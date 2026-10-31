"""
Compare mission records between the frontend and backend SQLite databases.

Read-only: reports missions that exist in one store but not the other and
never modifies either database.

Usage:
    python scripts/verify_databases.py
"""

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DB = ROOT / "frontend" / "data" / "database.db"
BACKEND_DB = ROOT / "nexus-backend" / "nexus.db"


def load_missions(db_path: Path, query: str) -> dict[str, str]:
    """Return {mission_id: status} for every row the query yields."""
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        return {row[0]: row[1] for row in conn.execute(query)}


def main() -> int:
    try:
        frontend = load_missions(
            FRONTEND_DB,
            "SELECT id, status FROM missions WHERE id != 'global-chat'",
        )
        backend = load_missions(BACKEND_DB, "SELECT mission_id, status FROM missions")
    except (FileNotFoundError, sqlite3.Error) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    only_frontend = sorted(frontend.keys() - backend.keys())
    only_backend = sorted(backend.keys() - frontend.keys())
    status_mismatch = sorted(
        mid for mid in frontend.keys() & backend.keys() if frontend[mid] != backend[mid]
    )

    print(f"Frontend missions: {len(frontend)}")
    print(f"Backend missions:  {len(backend)}")
    for label, ids in (
        ("Only in frontend", only_frontend),
        ("Only in backend", only_backend),
        ("Status differs", status_mismatch),
    ):
        if ids:
            print(f"\n{label} ({len(ids)}):")
            for mid in ids:
                print(f"  - {mid}")

    in_sync = not (only_frontend or only_backend or status_mismatch)
    print("\nResult:", "in sync" if in_sync else "out of sync")
    return 0 if in_sync else 1


if __name__ == "__main__":
    sys.exit(main())
