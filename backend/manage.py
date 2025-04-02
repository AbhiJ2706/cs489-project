#!/usr/bin/env python
"""
Management script for the application.
"""
import argparse
import sys
from app.db.migrations import (
    create_migration,
    upgrade_database,
    downgrade_database,
    show_current_revision,
    list_migrations,
)


def main():
    """Main entry point for the management script."""
    parser = argparse.ArgumentParser(description="Management script for the application")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Migration commands
    migration_parser = subparsers.add_parser("migration", help="Database migration commands")
    migration_subparsers = migration_parser.add_subparsers(dest="migration_command", help="Migration command to run")

    # Create migration
    create_parser = migration_subparsers.add_parser("create", help="Create a new migration")
    create_parser.add_argument("message", help="Migration message")

    # Upgrade database
    upgrade_parser = migration_subparsers.add_parser("upgrade", help="Upgrade database")
    upgrade_parser.add_argument("--revision", default="head", help="Target revision (default: head)")

    # Downgrade database
    downgrade_parser = migration_subparsers.add_parser("downgrade", help="Downgrade database")
    downgrade_parser.add_argument("revision", help="Target revision")

    # Show current revision
    migration_subparsers.add_parser("current", help="Show current database revision")

    # List migrations
    migration_subparsers.add_parser("history", help="List all migrations")

    args = parser.parse_args()

    if args.command == "migration":
        if args.migration_command == "create":
            create_migration(args.message)
        elif args.migration_command == "upgrade":
            upgrade_database(args.revision)
        elif args.migration_command == "downgrade":
            downgrade_database(args.revision)
        elif args.migration_command == "current":
            show_current_revision()
        elif args.migration_command == "history":
            list_migrations()
        else:
            migration_parser.print_help()
    else:
        parser.print_help()


if __name__ == "__main__":
    sys.exit(main())
