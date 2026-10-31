"""
Shared, bounded workspace directory helpers.

Every real, on-disk file write anywhere in this system (FileAgent's single-file
reads/writes, CodingAgent's generated-app files) resolves paths through here,
so path-traversal protection lives in exactly one place instead of one
hand-copied version per agent that could quietly drift out of sync.
"""

from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent.parent / "workspace"

# Real, generated multi-file projects live one level below WORKSPACE, keyed by
# mission id -- concurrent missions must not share a namespace the way
# FileAgent's flat single-file workspace still does.
APPS_DIR = WORKSPACE / "apps"


def safe_path(base: Path, relative: str) -> Path:
    """
    Resolve `relative` to a real path strictly inside `base`. Rejects path
    traversal (`../`) and absolute paths -- callers pass untrusted,
    prompt-derived or model-generated strings here.
    """
    candidate = (base / relative).resolve()
    if base not in candidate.parents and candidate != base:
        raise ValueError(f"Path '{relative}' resolves outside {base}; refused.")
    return candidate


def app_dir(mission_id: str) -> Path:
    return safe_path(APPS_DIR, mission_id)


def list_app_files(mission_id: str) -> list[Path]:
    """Real files currently on disk for this mission's generated app, or an
    empty list if none were ever written."""
    d = app_dir(mission_id)
    if not d.is_dir():
        return []
    return sorted(p for p in d.rglob("*") if p.is_file())


def read_app_files(mission_id: str, max_bytes_per_file: int = 20_000) -> dict[str, str]:
    """Real file contents, keyed by path relative to this mission's app dir --
    read fresh from disk each call so a later step sees exactly what an
    earlier step actually wrote, not a text summary of it."""
    d = app_dir(mission_id)
    out: dict[str, str] = {}
    for p in list_app_files(mission_id):
        try:
            out[str(p.relative_to(d))] = p.read_text(encoding="utf-8", errors="replace")[:max_bytes_per_file]
        except Exception:
            continue
    return out
