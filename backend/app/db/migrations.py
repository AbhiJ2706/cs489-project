"""
Alembic migration utilities for the application.
"""
import os
import sys
from pathlib import Path
from alembic import command
from alembic.config import Config

# Get the project root directory
ROOT_DIR = Path(__file__).parent.parent.parent.absolute()


def get_alembic_config() -> Config:
    """Get Alembic configuration."""
    alembic_cfg = Config(os.path.join(ROOT_DIR, "alembic.ini"))
    return alembic_cfg


def create_migration(message: str) -> None:
    """Create a new migration with Alembic.
    
    Args:
        message: Migration message
    """
    alembic_cfg = get_alembic_config()
    command.revision(alembic_cfg, message=message, autogenerate=True)
    print(f"Created migration with message: {message}")


def upgrade_database(revision: str = "head") -> None:
    """Upgrade database to the specified revision.
    
    Args:
        revision: Target revision, default is 'head'
    """
    alembic_cfg = get_alembic_config()
    command.upgrade(alembic_cfg, revision)
    print(f"Upgraded database to revision: {revision}")


def downgrade_database(revision: str) -> None:
    """Downgrade database to the specified revision.
    
    Args:
        revision: Target revision
    """
    alembic_cfg = get_alembic_config()
    command.downgrade(alembic_cfg, revision)
    print(f"Downgraded database to revision: {revision}")


def show_current_revision() -> None:
    """Show current database revision."""
    alembic_cfg = get_alembic_config()
    command.current(alembic_cfg)


def list_migrations() -> None:
    """List all migrations."""
    alembic_cfg = get_alembic_config()
    command.history(alembic_cfg)
