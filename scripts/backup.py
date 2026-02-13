"""
Database backup script.

Usage:
    python scripts/backup.py

Creates a timestamped copy of the SQLite database into data/backups/.
"""

import shutil
from datetime import datetime
from pathlib import Path

DB_PATH = Path("data/concierge.db")
BACKUP_DIR = Path("data/backups")


def main():
    if not DB_PATH.exists():
        print("❌ Database file not found. Nothing to back up.")
        return

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"concierge_backup_{timestamp}.db"

    shutil.copy(DB_PATH, backup_file)
    print(f"✅ Backup created: {backup_file}")


if __name__ == "__main__":
    main()
