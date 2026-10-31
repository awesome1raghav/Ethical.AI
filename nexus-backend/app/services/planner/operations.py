"""
Operation registry.

The single place risk is declared. A step's risk is a property of the operation
it performs, so "remove the production database", "drop prod db" and "delete the
production database" all resolve to DATABASE_DELETE and inherit the same
irreversible-destructive surface -- no keyword list to keep in sync.
"""

from dataclasses import dataclass
from typing import Dict, Optional

from app.schemas.capability import Capability

from .models import OperationType, RiskSurface


@dataclass(frozen=True)
class OperationSpec:
    operation: OperationType
    capability: Capability
    tool: Optional[str]
    risk: RiskSurface
    requires_human_approval: bool = False
    default_validation: Optional[str] = None
    failure_strategy: str = "halt"


R = RiskSurface

REGISTRY: Dict[OperationType, OperationSpec] = {
    OperationType.READ_FILE: OperationSpec(
        OperationType.READ_FILE, Capability.FILE, "filesystem",
        R(filesystem_read=True), failure_strategy="halt"),

    OperationType.WRITE_FILE: OperationSpec(
        OperationType.WRITE_FILE, Capability.FILE, "filesystem",
        R(filesystem_read=True, filesystem_write=True, reversible=True),
        default_validation="Confirm file contents match the intended change",
        failure_strategy="rollback"),

    OperationType.DELETE_FILE: OperationSpec(
        OperationType.DELETE_FILE, Capability.FILE, "filesystem",
        R(filesystem_write=True, destructive=True, reversible=False),
        requires_human_approval=True,
        default_validation="Confirm only the intended paths were removed",
        failure_strategy="halt"),

    OperationType.ANALYZE: OperationSpec(
        OperationType.ANALYZE, Capability.REASONING, None, R()),

    OperationType.COMPARE: OperationSpec(
        OperationType.COMPARE, Capability.REASONING, None, R()),

    OperationType.SUMMARIZE: OperationSpec(
        OperationType.SUMMARIZE, Capability.SUMMARIZATION, None, R()),

    OperationType.DESIGN: OperationSpec(
        OperationType.DESIGN, Capability.REASONING, None, R()),

    OperationType.IMPLEMENT: OperationSpec(
        OperationType.IMPLEMENT, Capability.CODING, "editor",
        R(filesystem_read=True, filesystem_write=True, reversible=True),
        default_validation="Code compiles and matches the specification",
        failure_strategy="rollback"),

    OperationType.CONFIGURE: OperationSpec(
        OperationType.CONFIGURE, Capability.CODING, "editor",
        R(filesystem_read=True, filesystem_write=True, reversible=True),
        default_validation="Configuration loads without error",
        failure_strategy="rollback"),

    OperationType.RUN_TESTS: OperationSpec(
        OperationType.RUN_TESTS, Capability.CODING, "test_runner",
        R(filesystem_read=True, code_execution=True),
        default_validation="Test suite exits zero",
        failure_strategy="report"),

    OperationType.NETWORK_REQUEST: OperationSpec(
        OperationType.NETWORK_REQUEST, Capability.WEB_SEARCH, "browser",
        R(network_access=True),
        default_validation="Sources retrieved and attributable",
        failure_strategy="retry"),

    OperationType.DEPLOY: OperationSpec(
        OperationType.DEPLOY, Capability.CODING, "deploy",
        R(network_access=True, code_execution=True,
          external_side_effect=True, reversible=False),
        requires_human_approval=True,
        default_validation="Deployment health check passes",
        failure_strategy="rollback"),

    OperationType.SEND_MESSAGE: OperationSpec(
        OperationType.SEND_MESSAGE, Capability.CHAT, "messaging",
        # Not reversible in any meaningful sense: a sent email cannot be recalled,
        # and it reaches a third party who is not the user. Approval is required
        # for the same reason DELETE is -- the action cannot be undone.
        R(network_access=True, external_side_effect=True, reversible=False),
        requires_human_approval=True,
        default_validation="Recipient, subject and body confirmed by a human before sending",
        failure_strategy="halt"),

    OperationType.DATABASE_READ: OperationSpec(
        OperationType.DATABASE_READ, Capability.MEMORY, "db_client",
        R(database_read=True)),

    OperationType.DATABASE_WRITE: OperationSpec(
        OperationType.DATABASE_WRITE, Capability.MEMORY, "db_client",
        R(database_read=True, database_write=True, external_side_effect=True),
        default_validation="Row counts match expectation",
        failure_strategy="rollback"),

    OperationType.DATABASE_DELETE: OperationSpec(
        OperationType.DATABASE_DELETE, Capability.MEMORY, "db_client",
        R(database_read=True, database_write=True, destructive=True,
          reversible=False, external_side_effect=True),
        requires_human_approval=True,
        default_validation="Confirm backup exists and scope is exactly as intended",
        failure_strategy="halt"),

    OperationType.CREDENTIAL_ACCESS: OperationSpec(
        OperationType.CREDENTIAL_ACCESS, Capability.REASONING, "secrets",
        R(credential_access=True, external_side_effect=True),
        requires_human_approval=True, failure_strategy="halt"),

    OperationType.GENERATE_ARTIFACT: OperationSpec(
        OperationType.GENERATE_ARTIFACT, Capability.REPORT, "generator",
        R(filesystem_write=True, reversible=True),
        default_validation="Artifact produced and non-empty",
        failure_strategy="retry"),

    OperationType.VALIDATE: OperationSpec(
        OperationType.VALIDATE, Capability.REASONING, None,
        R(filesystem_read=True), failure_strategy="report"),
}


def spec(op: OperationType) -> OperationSpec:
    return REGISTRY[op]


DESTRUCTIVE_OPS = {op for op, s in REGISTRY.items() if s.risk.destructive}
APPROVAL_OPS = {op for op, s in REGISTRY.items() if s.requires_human_approval}
