#!/bin/bash

# Configuration
BACKUP_DIR="/backups"
DB_NAME=${MYSQL_DATABASE}
DB_USER=${MYSQL_USER}
DB_PASS=${MYSQL_PASSWORD}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=7

echo "📅 Starting backup for $DB_NAME at $(date)"

# Create backup
mysqldump -h mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_DIR/backup_${TIMESTAMP}.sql"

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: backup_${TIMESTAMP}.sql"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Rotation: Delete backups older than RETENTION_DAYS
echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup_*.sql" -type f -mtime +$RETENTION_DAYS -delete

echo "🏁 Backup process completed at $(date)"
