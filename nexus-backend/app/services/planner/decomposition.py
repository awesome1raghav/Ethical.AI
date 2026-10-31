"""
Stage 3 -- expand each classified clause into real sub-steps.

This is where the plan stops being one step per capability and starts reflecting
the work. Expansion is driven by three things: the operation, the complexity
band from the Decision Engine, and the artifact/feature modifiers the extractor
found. A WRITE_FILE at TRIVIAL is locate-edit-verify; an IMPLEMENT of an API at
MODERATE picks up design, data model, auth, tests and docs.
"""

from dataclasses import dataclass
from typing import List, Optional

from .models import OperationType as OT
from .task_extractor import TaskClause


@dataclass
class SubStep:
    action: str
    description: str
    purpose: str
    operation: OT
    inputs: List[str]
    expected_output: str
    validation: Optional[str] = None


SMALL_BANDS = {"TRIVIAL", "SIMPLE"}


def _edit_file(c: TaskClause, band: str) -> List[SubStep]:
    target = c.artifacts[0] if c.artifacts else "target file"
    steps = [
        SubStep("Locate target", f"Find the {target} referenced by the request",
                "Establish exactly which file is being changed",
                OT.READ_FILE, [], f"path to {target}"),
        SubStep("Read current contents", f"Read the {target}",
                "Understand the existing content before altering it",
                OT.READ_FILE, [f"path to {target}"], f"contents of {target}"),
    ]
    if band not in SMALL_BANDS:
        steps.append(SubStep("Identify required changes",
                             "Determine every location needing modification",
                             "Avoid partial edits across a broad change",
                             OT.ANALYZE, [f"contents of {target}"], "change list"))
    steps.append(SubStep("Apply change", f"Write the corrected content to the {target}",
                         "Perform the requested modification",
                         OT.WRITE_FILE,
                         ["change list"] if band not in SMALL_BANDS else [f"contents of {target}"],
                         f"updated {target}",
                         "Diff shows only the intended change"))
    steps.append(SubStep("Verify change", "Confirm the edit is correct and complete",
                         "Prove the change did what was asked",
                         OT.VALIDATE, [f"updated {target}"], "verification result"))
    return steps


def _implement(c: TaskClause, band: str) -> List[SubStep]:
    artifact = next((a for a in c.artifacts if a in
                     ("api", "service", "dashboard", "schema")), None)
    is_migration = c.verb in ("migrate", "port")
    feats = set(c.features)

    if is_migration:
        return [
            SubStep("Inspect project", "Survey the existing codebase and its structure",
                    "Know what is being migrated before changing anything",
                    OT.READ_FILE, [], "project inventory"),
            SubStep("Identify migration scope", "Enumerate files, dependencies and entry points in scope",
                    "Bound the work and surface risky areas",
                    OT.ANALYZE, ["project inventory"], "migration scope"),
            SubStep("Configure toolchain", "Add and configure the target toolchain",
                    "Provide the target environment before converting sources",
                    OT.CONFIGURE, ["migration scope"], "toolchain config",
                    "Config loads without error"),
            SubStep("Migrate source files", "Convert sources to the target language or framework",
                    "Perform the bulk of the migration",
                    OT.IMPLEMENT, ["migration scope", "toolchain config"], "converted sources",
                    "All files converted, none skipped"),
            SubStep("Resolve errors", "Fix type and compilation errors surfaced by conversion",
                    "A migration is not done while the build is red",
                    OT.IMPLEMENT, ["converted sources"], "clean build"),
            SubStep("Update dependencies and config", "Align dependencies, scripts and build configuration",
                    "Keep the project runnable after migration",
                    OT.CONFIGURE, ["clean build"], "updated project config"),
            SubStep("Run build and tests", "Execute the build and the existing test suite",
                    "Prove behaviour is unchanged",
                    OT.RUN_TESTS, ["updated project config"], "test results",
                    "Build succeeds and tests pass"),
            SubStep("Validate migration", "Confirm parity with pre-migration behaviour",
                    "Final acceptance of the migration",
                    OT.VALIDATE, ["test results"], "migration report"),
        ]

    steps: List[SubStep] = []
    if band not in SMALL_BANDS:
        steps.append(SubStep("Analyze requirements",
                             f"Derive concrete requirements for the {artifact or 'change'}",
                             "Turn the request into buildable specifics",
                             OT.ANALYZE, [], "requirements"))
        steps.append(SubStep("Design structure",
                             f"Design the shape of the {artifact or 'implementation'}",
                             "Decide structure before writing code",
                             OT.DESIGN, ["requirements"], "design"))
        if artifact in ("api", "service", "dashboard"):
            steps.append(SubStep("Design data model", "Define entities, fields and relationships",
                                 "Data shape constrains every endpoint built on it",
                                 OT.DESIGN, ["requirements"], "data model"))

    impl_inputs = ["design"] if steps else []
    steps.append(SubStep("Implement core functionality",
                         f"Build the {artifact or 'requested functionality'}",
                         "Produce the primary deliverable",
                         OT.IMPLEMENT, impl_inputs, "implementation",
                         "Code compiles and meets the design"))

    if "auth" in feats or "authentication" in feats:
        steps.append(SubStep("Implement authentication", "Add authentication and authorization",
                             "Requested explicitly as part of the deliverable",
                             OT.IMPLEMENT, ["implementation"], "auth layer",
                             "Protected routes reject unauthenticated requests"))
    if band not in SMALL_BANDS:
        steps.append(SubStep("Add validation and error handling",
                             "Handle invalid input and failure paths",
                             "An implementation without error paths is not complete",
                             OT.IMPLEMENT, ["implementation"], "hardened implementation"))
    if feats & {"tests", "testing"} or band not in SMALL_BANDS:
        steps.append(SubStep("Write tests", "Write automated tests covering the implementation",
                             "Make correctness checkable",
                             OT.IMPLEMENT, ["implementation"], "test suite"))
        # No sandboxed test runner is configured, so CodingAgent rejects
        # RUN_TESTS. Only add that step when the prompt explicitly asks for
        # tests, so unrequested steps never fail an otherwise complete build.
        if feats & {"tests", "testing"}:
            steps.append(SubStep("Run tests", "Execute the test suite",
                                 "Prove the implementation behaves as specified",
                                 OT.RUN_TESTS, ["test suite"], "test results",
                                 "Test suite exits zero"))
    if feats & {"documentation", "docs"}:
        steps.append(SubStep("Generate documentation", "Document usage and interfaces",
                             "Requested explicitly as part of the deliverable",
                             OT.GENERATE_ARTIFACT, ["implementation"], "documentation"))
    return steps


def _research(c: TaskClause, band: str) -> List[SubStep]:
    steps = [
        SubStep("Define research scope", "Frame the questions the research must answer",
                "Unbounded research does not terminate",
                OT.ANALYZE, [], "research scope"),
        SubStep("Gather sources", "Search and retrieve relevant sources",
                "Collect the evidence base",
                OT.NETWORK_REQUEST, ["research scope"], "raw sources",
                "Sources retrieved and attributable"),
        SubStep("Extract findings", "Pull the relevant findings from the retrieved sources",
                "Reduce raw material to usable facts",
                OT.SUMMARIZE, ["raw sources"], "findings"),
    ]
    if band not in SMALL_BANDS:
        steps.append(SubStep("Cross-check sources", "Compare sources and note disagreement",
                             "Single-source research is not research",
                             OT.COMPARE, ["findings"], "verified findings"))
    return steps


def _read_docs(c: TaskClause, band: str) -> List[SubStep]:
    return [
        SubStep("Locate documents", "Identify the documents in scope",
                "Establish what is being read", OT.READ_FILE, [], "document list"),
        SubStep("Read documents", "Load and parse the document contents",
                "Obtain the material to analyse", OT.READ_FILE, ["document list"], "document contents"),
    ]


def _compare(c: TaskClause, band: str) -> List[SubStep]:
    return [SubStep("Compare inputs", "Compare the collected material and identify differences",
                    "Surface agreement and disagreement",
                    OT.COMPARE, ["document contents", "findings"], "comparison")]


# Words that mean the material lives in files the planner must open first.
_FILE_SUBJECTS = ("file", "files", "folder", "directory", "document", "documents",
                  "spreadsheet", "spreadsheets", "csv", "pdf", "invoice",
                  "invoices", "report", "readme", "log", "logs")


def _analyze(c: TaskClause, band: str) -> List[SubStep]:
    steps: List[SubStep] = []

    # Analysing material that lives on disk requires reading it first. Without
    # this the plan claims to analyse spreadsheets it never opened -- and the
    # filesystem_read surface never reaches governance.
    if any(w in c.text for w in _FILE_SUBJECTS):
        steps.append(SubStep("Locate input files",
                             "Identify the files named by the request",
                             "Establish what is being analysed",
                             OT.READ_FILE, [], "input file list"))
        steps.append(SubStep("Read input files", "Load and parse the file contents",
                             "Obtain the material to analyse",
                             OT.READ_FILE, ["input file list"], "document contents"))

    steps.append(SubStep(f"Analyze: {c.text[:44]}", f"Analyse in service of: {c.text[:60]}",
                         "Derive conclusions from the gathered material",
                         OT.ANALYZE,
                         ["document contents", "comparison", "findings"], "analysis"))
    return steps


def _artifact(c: TaskClause, band: str) -> List[SubStep]:
    kind = c.artifacts[0] if c.artifacts else "report"
    steps = [SubStep(f"Draft {kind}", f"Assemble the {kind} from the gathered material",
                     "Produce the requested deliverable",
                     OT.GENERATE_ARTIFACT, ["analysis", "findings", "comparison", "implementation"],
                     kind, "Artifact produced and non-empty")]
    if band not in SMALL_BANDS:
        steps.append(SubStep(f"Review {kind}", f"Check the {kind} for accuracy and completeness",
                             "Deliverables are checked before they are delivered",
                             OT.VALIDATE, [kind], f"validated {kind}"))
    return steps


def _database_delete(c: TaskClause, band: str) -> List[SubStep]:
    return [
        SubStep("Confirm deletion scope", "Determine exactly which data is targeted",
                "An over-broad delete is unrecoverable",
                OT.DATABASE_READ, [], "deletion scope"),
        SubStep("Verify backup exists", "Confirm a restorable backup covers the target data",
                "The only mitigation for an irreversible delete",
                OT.DATABASE_READ, ["deletion scope"], "backup confirmation",
                "Backup verified restorable"),
        SubStep("Delete data", "Execute the deletion against the target",
                "The requested destructive operation",
                OT.DATABASE_DELETE, ["deletion scope", "backup confirmation"], "deletion result",
                "Only the intended scope was removed"),
    ]


def _delete_file(c: TaskClause, band: str) -> List[SubStep]:
    return [
        SubStep("Resolve target paths", "Expand the request into concrete paths",
                "Know precisely what will be removed",
                OT.READ_FILE, [], "target paths"),
        SubStep("Delete files", "Remove the resolved paths",
                "The requested destructive operation",
                OT.DELETE_FILE, ["target paths"], "deletion result",
                "Only the intended paths were removed"),
    ]


def _deploy(c: TaskClause, band: str) -> List[SubStep]:
    return [
        SubStep("Prepare release", "Assemble the deployable build",
                "A deployment needs a verified artifact",
                OT.CONFIGURE, ["implementation", "test results"], "release build"),
        SubStep("Deploy", "Publish the build to the target environment",
                "The requested release",
                OT.DEPLOY, ["release build"], "deployment",
                "Deployment health check passes"),
        SubStep("Verify deployment", "Confirm the deployed system is healthy",
                "Catch a bad release immediately",
                OT.VALIDATE, ["deployment"], "deployment status"),
    ]


def _generic(c: TaskClause, band: str, op: OT) -> List[SubStep]:
    return [SubStep(c.text[:48].strip().capitalize() or op.value,
                    f"Perform: {c.text[:70]}", "Requested by the user",
                    op, [], "result")]


def _send_message(c: TaskClause, band: str) -> List[SubStep]:
    return [
        SubStep("Resolve recipients", "Identify the exact recipients and addresses",
                "Sending to the wrong person cannot be undone",
                OT.ANALYZE, [], "recipient list"),
        SubStep("Draft message", "Compose the subject and body from the request",
                "Produce the content to be reviewed",
                OT.GENERATE_ARTIFACT, ["recipient list"], "draft message"),
        SubStep("Confirm before sending",
                "Present recipients, subject and body for human approval",
                "A sent message cannot be recalled; a human approves the exact text",
                OT.VALIDATE, ["draft message"], "approved message",
                "Human has approved recipients and content"),
        SubStep("Send message", "Deliver the approved message",
                "The requested communication",
                OT.SEND_MESSAGE, ["approved message"], "delivery confirmation",
                "Delivery confirmed to the intended recipients only"),
    ]


DECOMPOSERS = {
    OT.SEND_MESSAGE: _send_message,
    OT.WRITE_FILE: _edit_file,
    OT.IMPLEMENT: _implement,
    OT.NETWORK_REQUEST: _research,
    OT.READ_FILE: _read_docs,
    OT.COMPARE: _compare,
    OT.ANALYZE: _analyze,
    OT.SUMMARIZE: _analyze,
    OT.GENERATE_ARTIFACT: _artifact,
    OT.DATABASE_DELETE: _database_delete,
    OT.DELETE_FILE: _delete_file,
    OT.DEPLOY: _deploy,
}


def decompose(clause: TaskClause, op: OT, band: str) -> List[SubStep]:
    fn = DECOMPOSERS.get(op)
    return fn(clause, band) if fn else _generic(clause, band, op)
