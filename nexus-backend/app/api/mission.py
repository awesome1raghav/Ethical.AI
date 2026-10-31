import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.execution_context import ExecutionContext
from app.database.database import SessionLocal
from app.database.dependencies import get_db
from app.repositories.decision_repository import DecisionRepository, rehydrate
from app.repositories.mission_repository import MissionRepository
from app.schemas.mission import (ApproveRequest, MissionPlanStep, MissionRequest,
                                 MissionResponse)
from app.services.agent_registry.agent_factory import AgentFactory
from app.services.mission.create_mission import create_mission
from app.services.planner.models import rehydrate_plan
from app.services.runtime.execution_runtime import ExecutionRuntime
from app.tools.workspace import list_app_files

router = APIRouter(prefix="/mission", tags=["Mission"])
logger = logging.getLogger(__name__)


def _build_plan_steps(context) -> list:
    """
    Pair each planned step with its actually-assigned agent and its actual
    execution result. Shared by create/approve/get so all three report the
    same real state instead of three separately-computed views of it.
    """
    plan = context.execution_plan
    if not getattr(plan, "steps", None):
        return []

    assignments = AgentFactory.assign(plan)
    results_by_id = {r["step_id"]: r for r in context.step_results}

    out = []
    for step, assigned in zip(plan.steps, assignments):
        result = results_by_id.get(step.step_id)
        if result:
            status = result["status"]
            output = result.get("output")
            error = result.get("error")
        elif step.step_id == context.pending_step_id:
            status, output, error = "awaiting_approval", None, None
        elif step.step_id == getattr(context, "running_step_id", None):
            status, output, error = "running", None, None
        else:
            status, output, error = "pending", None, None

        out.append(MissionPlanStep(
            step_id=step.step_id,
            action=step.action,
            description=step.description,
            purpose=step.purpose,
            operation=step.operation.value,
            agent=assigned.agent.value,
            depends_on=step.depends_on,
            destructive=step.risk_surface.destructive,
            reversible=step.reversible,
            requires_human_approval=step.requires_human_approval,
            validation=step.validation,
            status=status,
            output=output,
            error=error,
        ))
    return out


def _response(mission, context) -> MissionResponse:
    plan = context.execution_plan
    helix = context.helix_result
    d = context.decision

    return MissionResponse(
        mission_id=mission.mission_id,
        trace_id=mission.trace_id,
        status=context.status,
        decision_id=context.decision_id or None,
        intent=d.intent.value if d else None,
        confidence=d.confidence if d else None,
        complexity_band=d.complexity_band.value if d else None,
        execution_mode=d.execution_mode.value if d else None,
        clarifying_question=d.clarifying_question if d else None,
        status_reason=context.status_reason or None,
        plan_id=getattr(plan, "plan_id", None),
        execution_strategy=getattr(getattr(plan, "execution_strategy", None), "value", None),
        steps=_build_plan_steps(context),
        requires_human_approval=bool(getattr(plan, "requires_human_approval", False)),
        pending_step_id=context.pending_step_id,
        running_step_id=getattr(context, "running_step_id", None),
        cancel_requested=bool(getattr(mission, "cancel_requested", False)),
        risk_level=getattr(getattr(helix, "risk", None), "value", None),
        risk_reason=getattr(helix, "reason", None),
        has_app_files=bool(list_app_files(mission.mission_id)),
    )


def _run_mission_background(mission_id: str, trace_id: str, prompt: str, decision_id: str) -> None:
    """
    Runs the real mission pipeline (decision reuse, planning, HELIX/MATRIX,
    every agent step) outside the request/response cycle, in its own DB
    session -- the request-scoped session from create_new_mission is closed
    by the time this runs.

    The on_step hook persists a checkpoint after every step, so clients
    polling GET /api/mission/{id} see live progress.
    """
    db = SessionLocal()
    try:
        context = ExecutionContext(mission_id=mission_id, trace_id=trace_id, prompt=prompt)

        if decision_id:
            row = DecisionRepository.get(db, decision_id)
            if row:
                context.decision = rehydrate(row)
                context.decision_id = row.decision_id

        def on_step(ctx):
            MissionRepository.update_status(db, mission_id, ctx.status, ctx.status_reason)
            if ctx.execution_plan is not None:
                MissionRepository.save_checkpoint(db, mission_id, ctx)

        def is_cancelled():
            return MissionRepository.is_cancel_requested(db, mission_id)

        context = ExecutionRuntime.execute(context, on_step=on_step, is_cancelled=is_cancelled)

        if not context.decision_id and context.decision is not None:
            from app.utils.ids import generate_decision_id
            context.decision_id = generate_decision_id()
            DecisionRepository.create(
                db, context.decision_id, context.decision,
                mission_id=mission_id, trace_id=trace_id,
            )

        MissionRepository.update_status(db, mission_id, context.status, context.status_reason)
        if context.execution_plan is not None:
            MissionRepository.save_checkpoint(db, mission_id, context)
    except Exception as exc:  # noqa: BLE001
        # A background task's exception has nowhere else to go -- without this,
        # a crash here leaves the mission silently stuck at "accepted" forever,
        # which is exactly the kind of unexplained hang this whole API exists
        # to avoid.
        logger.exception("Mission %s crashed during background execution", mission_id)
        MissionRepository.update_status(
            db, mission_id, "failed", f"Mission execution crashed: {exc}"
        )
    finally:
        db.close()


@router.post("/", response_model=MissionResponse, summary="Create a new mission")
def create_new_mission(request: MissionRequest, background_tasks: BackgroundTasks,
                       db: Session = Depends(get_db)):

    mission = create_mission(db=db, prompt=request.prompt)

    context = ExecutionContext(
        mission_id=mission.mission_id,
        trace_id=mission.trace_id,
        prompt=request.prompt,
    )

    if request.decision_id:
        row = DecisionRepository.get(db, request.decision_id)
        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown decision_id: {request.decision_id}",
            )
        context.decision = rehydrate(row)
        context.decision_id = row.decision_id
        DecisionRepository.attach_mission(
            db, row.decision_id, mission.mission_id, mission.trace_id
        )

    # Respond immediately; progress is reported through GET /api/mission/{id}
    # as the background task checkpoints each step.
    context.status = "accepted"

    background_tasks.add_task(
        _run_mission_background,
        mission.mission_id, mission.trace_id, request.prompt, context.decision_id or None,
    )

    return _response(mission, context)


@router.get("/{mission_id}", response_model=MissionResponse, summary="Mission status")
def get_mission(mission_id: str, db: Session = Depends(get_db)):
    mission = MissionRepository.get(db, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail=f"Unknown mission: {mission_id}")

    checkpoint = MissionRepository.load_checkpoint(db, mission_id)
    context = ExecutionContext(
        mission_id=mission.mission_id, trace_id=mission.trace_id, prompt=mission.prompt,
        status=mission.status, status_reason=mission.status_reason or "",
    )
    if checkpoint:
        context.decision_id = checkpoint.get("decision_id") or ""
        if checkpoint.get("plan"):
            context.execution_plan = rehydrate_plan(checkpoint["plan"])
        context.step_results = checkpoint.get("step_results", [])
        context.approvals = checkpoint.get("approvals", {})
        context.pending_step_id = checkpoint.get("pending_step_id")
        context.running_step_id = checkpoint.get("running_step_id")

    # The checkpoint only carries a plan for mission-path runs. A chat-routed
    # mission has no plan (nothing to check-point) but still has a real,
    # already-persisted decision -- without this, intent/confidence/mode were
    # silently reported as null for every completed chat mission, even though
    # the classification happened and is sitting in the decisions
    # table right now.
    if context.decision is None and context.decision_id:
        row = DecisionRepository.get(db, context.decision_id)
        if row:
            context.decision = rehydrate(row)

    return _response(mission, context)


def _resume_mission_background(mission_id: str, pending: str) -> None:
    """
    Mirrors _run_mission_background for the resume path: the checkpoint's
    approvals are already durably saved by approve_mission before this task
    is even queued, so this only needs to reload it and keep executing with
    the same per-step on_step persistence.
    """
    from app.agents.agent_executor import AgentExecutor

    db = SessionLocal()
    try:
        mission = MissionRepository.get(db, mission_id)
        checkpoint = MissionRepository.load_checkpoint(db, mission_id)
        if not mission or not checkpoint or not checkpoint.get("plan"):
            return

        context = ExecutionContext(
            mission_id=mission.mission_id, trace_id=mission.trace_id, prompt=mission.prompt,
        )
        context.decision_id = checkpoint.get("decision_id") or ""
        context.execution_plan = rehydrate_plan(checkpoint["plan"])
        context.step_results = checkpoint.get("step_results", [])
        context.approvals = dict(checkpoint.get("approvals", {}))
        if pending:
            context.emit("AgentExecutor", "APPROVED", f"Human approved step {pending}; resuming")
        else:
            context.emit("AgentExecutor", "APPROVED", "Human approved mission start; executing")

        def on_step(ctx):
            MissionRepository.update_status(db, mission_id, ctx.status, ctx.status_reason)
            MissionRepository.save_checkpoint(db, mission_id, ctx)

        def is_cancelled():
            return MissionRepository.is_cancel_requested(db, mission_id)

        assignments = AgentFactory.assign(context.execution_plan)
        context = AgentExecutor.execute(assignments, context, on_step=on_step, is_cancelled=is_cancelled)

        if context.status in ("awaiting_approval", "cancelled"):
            pass  # status/reason already set by AgentExecutor -- do not overwrite
        elif context.pending_step_id is None and context.status not in ("failed",):
            context.status = "completed"

        MissionRepository.update_status(db, mission_id, context.status, context.status_reason)
        MissionRepository.save_checkpoint(db, mission_id, context)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Mission %s crashed during background resume", mission_id)
        MissionRepository.update_status(
            db, mission_id, "failed", f"Mission execution crashed: {exc}"
        )
    finally:
        db.close()


@router.post("/{mission_id}/approve", response_model=MissionResponse,
            summary="Approve the pending step and resume execution")
def approve_mission(mission_id: str, background_tasks: BackgroundTasks,
                    request: ApproveRequest = ApproveRequest(),
                    db: Session = Depends(get_db)):
    mission = MissionRepository.get(db, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail=f"Unknown mission: {mission_id}")

    if mission.status != "awaiting_approval":
        raise HTTPException(
            status_code=409,
            detail=f"Mission is not awaiting approval (status: {mission.status})",
        )

    checkpoint = MissionRepository.load_checkpoint(db, mission_id)
    if not checkpoint or not checkpoint.get("plan"):
        raise HTTPException(status_code=409, detail="No resumable checkpoint for this mission")

    pending = checkpoint.get("pending_step_id")

    # Two distinct approval shapes share this endpoint:
    #   (1) a specific step is pending (AgentExecutor already paused on it)
    #   (2) the mission itself was halted before AgentExecutor ever ran (the
    #       mission-level HELIX gate fired on overall risk) -- approving here
    #       means "you may begin," and any individual step still gated by its
    #       own requires_human_approval will pause again in its own right.
    if pending:
        if request.step_id and request.step_id != pending:
            raise HTTPException(
                status_code=409,
                detail=f"step_id mismatch: pending step is {pending}, not {request.step_id}",
            )
    elif checkpoint.get("step_results"):
        # Execution was underway and nothing is pending -- there is nothing to approve.
        raise HTTPException(status_code=409, detail="No step is currently pending approval")

    # Persist the approval and a "running" status durably before returning --
    # background execution reloads this exact checkpoint, so there is one
    # source of truth for what was approved, not two copies that could drift.
    approvals = dict(checkpoint.get("approvals", {}))
    if pending:
        approvals[pending] = True   # explicit grant -- silence is never approval
    checkpoint["approvals"] = approvals

    context = ExecutionContext(
        mission_id=mission.mission_id, trace_id=mission.trace_id, prompt=mission.prompt,
    )
    context.decision_id = checkpoint.get("decision_id") or ""
    context.execution_plan = rehydrate_plan(checkpoint["plan"])
    context.step_results = checkpoint.get("step_results", [])
    context.approvals = approvals
    context.pending_step_id = None
    context.status = "running"

    MissionRepository.update_status(db, mission.mission_id, "running", None)
    MissionRepository.save_checkpoint(db, mission.mission_id, context)

    background_tasks.add_task(_resume_mission_background, mission_id, pending)

    return _response(mission, context)


@router.post("/{mission_id}/cancel", response_model=MissionResponse,
            summary="Request cancellation of a running mission")
def cancel_mission(mission_id: str, db: Session = Depends(get_db)):
    """
    Request cooperative cancellation. The running task checks this flag
    between steps, so the mission stops at the next step boundary; a step
    already in progress finishes first, and completed work is not undone.
    """
    mission = MissionRepository.get(db, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail=f"Unknown mission: {mission_id}")

    terminal = ("completed", "failed", "blocked", "needs_clarification", "cancelled")
    if mission.status in terminal:
        raise HTTPException(
            status_code=409,
            detail=f"Mission already reached a terminal state ({mission.status}); nothing to cancel.",
        )

    if mission.status == "awaiting_approval":
        # No background task is running right now to ever notice
        # cancel_requested -- the mission is inert, sitting in the
        # DB waiting for a human. Finalize the cancellation directly instead
        # of setting a flag nothing will check until a resume that should
        # never happen.
        mission = MissionRepository.update_status(
            db, mission_id, "cancelled",
            "Cancelled by user while awaiting approval.",
        )
    else:
        # A background task is actively running (accepted/executing/running)
        # and will notice this at the next step boundary via is_cancelled.
        mission = MissionRepository.request_cancel(db, mission_id)

    checkpoint = MissionRepository.load_checkpoint(db, mission_id)
    context = ExecutionContext(
        mission_id=mission.mission_id, trace_id=mission.trace_id, prompt=mission.prompt,
        status=mission.status, status_reason=mission.status_reason or "",
    )
    if checkpoint:
        context.decision_id = checkpoint.get("decision_id") or ""
        if checkpoint.get("plan"):
            context.execution_plan = rehydrate_plan(checkpoint["plan"])
        context.step_results = checkpoint.get("step_results", [])
        context.approvals = checkpoint.get("approvals", {})
        context.pending_step_id = checkpoint.get("pending_step_id")
        context.running_step_id = checkpoint.get("running_step_id")
    if context.decision is None and context.decision_id:
        row = DecisionRepository.get(db, context.decision_id)
        if row:
            context.decision = rehydrate(row)

    return _response(mission, context)


@router.get("/{mission_id}/download", summary="Download this mission's generated app as a zip")
def download_mission_app(mission_id: str, db: Session = Depends(get_db)):
    """
    Zips whatever CodingAgent actually wrote to workspace/apps/{mission_id}/
    and streams it back. Returns 404 if the mission does not exist, or if
    it exists but never produced any real files -- never a zip containing a
    placeholder or an empty-but-200 response standing in for "nothing was
    built."
    """
    mission = MissionRepository.get(db, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail=f"Unknown mission: {mission_id}")

    files = list_app_files(mission_id)
    if not files:
        raise HTTPException(
            status_code=404,
            detail=f"Mission {mission_id} has no generated app files to download.",
        )

    import io
    import zipfile

    from fastapi.responses import StreamingResponse

    from app.tools.workspace import app_dir as _app_dir_for
    base_dir = _app_dir_for(mission_id)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            zf.write(path, arcname=str(path.relative_to(base_dir)))
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{mission_id}.zip"'},
    )
