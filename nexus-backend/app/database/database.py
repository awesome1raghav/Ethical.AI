from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./nexus.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def migrate_missions_table():
    """
    Additive column migration. Base.metadata.create_all() only creates missing
    TABLES -- it does not add columns to a table that already exists, and the
    `missions` table already existed before status_reason/checkpoint were added
    to the model.
    """
    from sqlalchemy import text

    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(missions)"))}
        additions = {
            "status_reason": "TEXT",
            "checkpoint": "TEXT",
            "cancel_requested": "BOOLEAN DEFAULT 0",
        }
        for column, col_type in additions.items():
            if column not in existing:
                conn.execute(text(f"ALTER TABLE missions ADD COLUMN {column} {col_type}"))
        conn.commit()


def reap_orphaned_missions():
    """
    Run once at startup, before the app accepts requests.

    Missions execute in background tasks owned by the process that started
    them. If that process exits mid-mission, its rows stay in an in-progress
    status forever. Since no mission can be running before this process
    starts, any row still marked accepted/executing/running is marked failed.

    Returns the IDs of the missions that were marked failed.
    """
    from sqlalchemy import text

    in_progress = ("accepted", "executing", "running")
    placeholders = ", ".join(f"'{s}'" for s in in_progress)
    with engine.connect() as conn:
        result = conn.execute(text(
            f"SELECT mission_id FROM missions WHERE status IN ({placeholders})"
        ))
        orphaned = [row[0] for row in result]
        if orphaned:
            conn.execute(
                text(
                    f"UPDATE missions SET status = 'failed', "
                    f"status_reason = 'Mission was still in progress when the backend "
                    f"restarted and could not resume automatically.' "
                    f"WHERE status IN ({placeholders})"
                )
            )
            conn.commit()
    return orphaned
