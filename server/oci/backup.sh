#!/usr/bin/env bash
set -euo pipefail

IP="144.24.32.76"
BACKUP_DIR="/home/bridger/Developer/mc/data/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
SERVERS=(lobby creative survival the-walls parkour dropper exponential hot-and-heavy planet-parkour)
REMOTE_TMP="/tmp/mc-backup-$TIMESTAMP.tar.gz"
RESOURCE_PACKS_TMP="/tmp/mc-resource-packs-$TIMESTAMP.tar.gz"

echo "Backing up from $IP"

# Compress worlds on server
echo "  Compressing worlds on server..."
ssh "root@$IP" "cd /var/lib/minecraft && tar czf $REMOTE_TMP ${SERVERS[*]}"

# Download worlds
echo "  Downloading worlds..."
mkdir -p "$BACKUP_DIR"
scp "root@$IP:$REMOTE_TMP" "$BACKUP_DIR/$TIMESTAMP.tar.gz"

# Cleanup remote worlds archive
ssh "root@$IP" "rm -f $REMOTE_TMP"

# Backup resource packs
echo "  Compressing resource packs on server..."
ssh "root@$IP" "cd /var/lib/minecraft && tar czf $RESOURCE_PACKS_TMP resource-packs/"

echo "  Downloading resource packs..."
scp "root@$IP:$RESOURCE_PACKS_TMP" "$BACKUP_DIR/$TIMESTAMP-resource-packs.tar.gz"

ssh "root@$IP" "rm -f $RESOURCE_PACKS_TMP"

echo ""
echo "Backup complete:"
ls -lh "$BACKUP_DIR/$TIMESTAMP.tar.gz"
ls -lh "$BACKUP_DIR/$TIMESTAMP-resource-packs.tar.gz"
