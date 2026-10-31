from dataclasses import dataclass, field


@dataclass
class ResearchState:

    browser_results: list = field(default_factory=list)

    documents: list = field(default_factory=list)

    sources: list = field(default_factory=list)

    analysis: str = ""

    report: str = ""


@dataclass
class ExecutionContext:

    # Mission
    mission_id: str = ""

    trace_id: str = ""

    prompt: str = ""

    # Lifecycle
    # accepted -> executing -> completed | blocked | awaiting_approval | failed
    status: str = "executing"

    # Reason a terminal status was reached (block reason, approval reason)
    status_reason: str = ""

    # Validation
    validation_passed: bool = False

    # Intent
    intent: str = ""

    # Decision Engine record (set by the runtime, or supplied by the caller
    # via decision_id so a mission is classified exactly once).
    decision = None
    decision_id: str = ""

    # Runtime
    execution_mode: str = ""

    # Capability
    capabilities: list = field(default_factory=list)

    # Planner
    execution_plan: list = field(default_factory=list)

    # Agents
    assigned_agents: list = field(default_factory=list)

    # Per-step execution ledger. Each entry: {step_id, agent, status, output, error}.
    # This is the real record of what each step actually did -- populated by
    # AgentExecutor, never fabricated. Seeded from a checkpoint on resume so
    # already-completed steps are not re-run.
    step_results: list = field(default_factory=list)

    # step_id -> True once a human has explicitly approved that specific step.
    # Never defaulted to True for a gated step; silence must never mean approval.
    approvals: dict = field(default_factory=dict)

    # Set by AgentExecutor when it pauses; cleared once that step is approved
    # and re-run. None means nothing is currently pending.
    pending_step_id: str = None

    # Set by AgentExecutor right before it hands a step to its agent, cleared
    # once that step resolves (completed/failed/paused). Lets a client polling
    # mid-execution see "this step is actively running right now" rather than
    # just "done" vs "not done yet" -- without it there is no way to tell a
    # step that hasn't started from one currently in progress.
    running_step_id: str = None

    # HELIX
    helix_result = None

    # MATRIX
    matrix_result = None

    # Brain
    selected_model = None

    # Agents
    selected_agents: list = field(default_factory=list)

    # Events & Observability
    events: list = field(default_factory=list)

    # Domain States
    research: ResearchState = field(default_factory=ResearchState)

    # Output
    ai_response = None
    response = None

    @property
    def browser_results(self):

        return self.research.browser_results

    @browser_results.setter
    def browser_results(self, val):

        self.research.browser_results = val

    @property
    def documents(self):

        return self.research.documents

    @documents.setter
    def documents(self, val):

        self.research.documents = val

    @property
    def analysis(self):

        return self.research.analysis

    @analysis.setter
    def analysis(self, val):

        self.research.analysis = val

    @property
    def report(self):

        return self.research.report

    @report.setter
    def report(self, val):

        self.research.report = val

    @property
    def sources(self):

        return self.research.sources

    @sources.setter
    def sources(self, val):

        self.research.sources = val

    def emit(self, step: str, status: str, message: str = ""):

        from datetime import datetime, timezone
        event = {
            "step": step,
            "status": status,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.events.append(event)
        return event
