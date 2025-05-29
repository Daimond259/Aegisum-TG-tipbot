#!/bin/bash

# Aegisum Tip Bot Backup Script
# This script creates backups of the database and configuration

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$HOME/tipbot-backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Starting Aegisum Tip Bot Backup${NC}"
echo "Date: $(date)"
echo "Project: $PROJECT_DIR"
echo "Backup: $BACKUP_DIR"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if bot is running
check_bot_status() {
    if systemctl is-active --quiet aegisum-tipbot 2>/dev/null; then
        log "Bot is running - creating hot backup"
        BOT_RUNNING=true
    else
        log "Bot is stopped - creating cold backup"
        BOT_RUNNING=false
    fi
}

# Backup database
backup_database() {
    log "Backing up database..."
    
    local db_file="$PROJECT_DIR/data/tipbot.db"
    local backup_file="$BACKUP_DIR/database_$DATE.db"
    
    if [ -f "$db_file" ]; then
        if [ "$BOT_RUNNING" = true ]; then
            # Hot backup using SQLite backup API
            sqlite3 "$db_file" ".backup '$backup_file'"
        else
            # Cold backup - simple copy
            cp "$db_file" "$backup_file"
        fi
        
        # Verify backup
        if sqlite3 "$backup_file" "SELECT COUNT(*) FROM users;" > /dev/null 2>&1; then
            log "Database backup successful: $(basename "$backup_file")"
            echo "  Size: $(du -h "$backup_file" | cut -f1)"
        else
            error "Database backup verification failed"
            return 1
        fi
    else
        warning "Database file not found: $db_file"
    fi
}

# Backup configuration
backup_config() {
    log "Backing up configuration..."
    
    local config_backup="$BACKUP_DIR/config_$DATE.tar.gz"
    
    # Create temporary directory for config files
    local temp_dir=$(mktemp -d)
    
    # Copy configuration files (excluding sensitive data)
    if [ -f "$PROJECT_DIR/package.json" ]; then
        cp "$PROJECT_DIR/package.json" "$temp_dir/"
    fi
    
    if [ -d "$PROJECT_DIR/docs" ]; then
        cp -r "$PROJECT_DIR/docs" "$temp_dir/"
    fi
    
    # Copy blockchain configs (remove sensitive data)
    for coin in aegisum shic pepe advc; do
        local config_file="$HOME/.$coin/$coin.conf"
        if [ -f "$config_file" ]; then
            # Remove sensitive lines and copy
            grep -v -E '^rpc(user|password)=' "$config_file" > "$temp_dir/${coin}.conf" 2>/dev/null || true
        fi
    done
    
    # Create archive
    if [ "$(ls -A "$temp_dir")" ]; then
        tar -czf "$config_backup" -C "$temp_dir" .
        log "Configuration backup successful: $(basename "$config_backup")"
        echo "  Size: $(du -h "$config_backup" | cut -f1)"
    else
        warning "No configuration files found to backup"
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
}

# Backup logs
backup_logs() {
    log "Backing up logs..."
    
    local logs_backup="$BACKUP_DIR/logs_$DATE.tar.gz"
    local logs_dir="$PROJECT_DIR/logs"
    
    if [ -d "$logs_dir" ] && [ "$(ls -A "$logs_dir")" ]; then
        tar -czf "$logs_backup" -C "$PROJECT_DIR" logs/
        log "Logs backup successful: $(basename "$logs_backup")"
        echo "  Size: $(du -h "$logs_backup" | cut -f1)"
    else
        warning "No logs found to backup"
    fi
}

# Create backup manifest
create_manifest() {
    log "Creating backup manifest..."
    
    local manifest_file="$BACKUP_DIR/manifest_$DATE.txt"
    
    cat > "$manifest_file" << EOF
Aegisum Tip Bot Backup Manifest
===============================

Backup Date: $(date)
Bot Status: $([ "$BOT_RUNNING" = true ] && echo "Running" || echo "Stopped")
Project Directory: $PROJECT_DIR
Backup Directory: $BACKUP_DIR

Files in this backup:
EOF
    
    # List backup files
    find "$BACKUP_DIR" -name "*_$DATE.*" -type f | while read -r file; do
        echo "  $(basename "$file") - $(du -h "$file" | cut -f1)" >> "$manifest_file"
    done
    
    log "Manifest created: $(basename "$manifest_file")"
}

# Cleanup old backups
cleanup_old_backups() {
    local keep_days=${1:-30}
    
    log "Cleaning up backups older than $keep_days days..."
    
    local deleted_count=0
    
    # Find and delete old backup files
    find "$BACKUP_DIR" -name "database_*.db" -mtime +$keep_days -type f | while read -r file; do
        rm -f "$file"
        ((deleted_count++))
    done
    
    find "$BACKUP_DIR" -name "config_*.tar.gz" -mtime +$keep_days -type f | while read -r file; do
        rm -f "$file"
        ((deleted_count++))
    done
    
    find "$BACKUP_DIR" -name "logs_*.tar.gz" -mtime +$keep_days -type f | while read -r file; do
        rm -f "$file"
        ((deleted_count++))
    done
    
    find "$BACKUP_DIR" -name "manifest_*.txt" -mtime +$keep_days -type f | while read -r file; do
        rm -f "$file"
        ((deleted_count++))
    done
    
    if [ $deleted_count -gt 0 ]; then
        log "Deleted $deleted_count old backup files"
    else
        log "No old backup files to delete"
    fi
}

# Show backup summary
show_summary() {
    log "Backup Summary:"
    echo ""
    echo "Backup Location: $BACKUP_DIR"
    echo "Files created:"
    
    find "$BACKUP_DIR" -name "*_$DATE.*" -type f | while read -r file; do
        echo "  📁 $(basename "$file") ($(du -h "$file" | cut -f1))"
    done
    
    echo ""
    echo "Total backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"
    echo "Available space: $(df -h "$BACKUP_DIR" | tail -1 | awk '{print $4}')"
}

# Main execution
main() {
    # Check if running as correct user
    if [ "$USER" != "tipbot" ] && [ "$USER" != "root" ]; then
        warning "Consider running as 'tipbot' user for proper permissions"
    fi
    
    # Check dependencies
    if ! command -v sqlite3 &> /dev/null; then
        error "sqlite3 is required but not installed"
        exit 1
    fi
    
    # Perform backup
    check_bot_status
    backup_database
    backup_config
    backup_logs
    create_manifest
    
    # Cleanup old backups (keep 30 days by default)
    cleanup_old_backups 30
    
    # Show summary
    show_summary
    
    log "✅ Backup completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--cleanup-days N]"
        echo ""
        echo "Options:"
        echo "  --cleanup-days N    Keep backups for N days (default: 30)"
        echo "  --help, -h          Show this help message"
        exit 0
        ;;
    --cleanup-days)
        if [ -n "$2" ] && [ "$2" -eq "$2" ] 2>/dev/null; then
            CLEANUP_DAYS="$2"
        else
            error "Invalid cleanup days value: $2"
            exit 1
        fi
        ;;
esac

# Run main function
main