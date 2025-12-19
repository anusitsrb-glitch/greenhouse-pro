#!/bin/bash
# GreenHouse Pro - Backup Script
# Add to cron: 0 2 * * 0 /path/to/greenhouse-pro/infra/scripts/backup.sh
# Runs every Sunday at 2 AM

set -e

echo "🔄 Starting backup..."

cd "$(dirname "$0")/.."

# Run backup container
docker compose run --rm backup

echo "✅ Backup completed"

# List recent backups
echo ""
echo "📁 Recent backups:"
ls -lh ../backups/ | tail -5
