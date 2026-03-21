#!/usr/bin/env bash
set -euo pipefail

IP="144.24.32.76"
BACKUP_DIR="/home/bridger/Developer/mc/data/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
SERVERS=(lobby creative survival the-walls parkour dropper exponential)
REMOTE_TMP="/tmp/mc-backup-$TIMESTAMP.tar.gz"

echo "Backing up from $IP"

# Compress on server
echo "  Compressing on server..."
ssh "root@$IP" "cd /var/lib/minecraft && tar czf $REMOTE_TMP ${SERVERS[*]}"

# Download
echo "  Downloading..."
mkdir -p "$BACKUP_DIR"
scp "root@$IP:$REMOTE_TMP" "$BACKUP_DIR/$TIMESTAMP.tar.gz"

# Cleanup remote
ssh "root@$IP" "rm -f $REMOTE_TMP"

echo ""
echo "Backup complete: $BACKUP_DIR/$TIMESTAMP.tar.gz"
ls -lh "$BACKUP_DIR/$TIMESTAMP.tar.gz"
