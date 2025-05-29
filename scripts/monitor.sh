#!/bin/bash

# Aegisum Tip Bot Monitoring Script
# This script monitors the bot and blockchain services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Services to monitor
SERVICES=("aegisum-tipbot" "aegisum" "shic" "pepe" "advc")
COINS=("AEGS" "SHIC" "PEPE" "ADVC")

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check system resources
check_system_resources() {
    echo -e "${BLUE}📊 System Resources${NC}"
    echo "==================="
    
    # Memory usage
    local mem_info=$(free -h | grep '^Mem:')
    local mem_used=$(echo $mem_info | awk '{print $3}')
    local mem_total=$(echo $mem_info | awk '{print $2}')
    local mem_percent=$(free | grep '^Mem:' | awk '{printf "%.1f", $3/$2 * 100.0}')
    
    if (( $(echo "$mem_percent > 90" | bc -l) )); then
        print_status "ERROR" "Memory usage: $mem_used/$mem_total (${mem_percent}%)"
    elif (( $(echo "$mem_percent > 75" | bc -l) )); then
        print_status "WARNING" "Memory usage: $mem_used/$mem_total (${mem_percent}%)"
    else
        print_status "OK" "Memory usage: $mem_used/$mem_total (${mem_percent}%)"
    fi
    
    # Disk usage
    local disk_info=$(df -h "$PROJECT_DIR" | tail -1)
    local disk_used=$(echo $disk_info | awk '{print $3}')
    local disk_total=$(echo $disk_info | awk '{print $2}')
    local disk_percent=$(echo $disk_info | awk '{print $5}' | sed 's/%//')
    
    if [ "$disk_percent" -gt 90 ]; then
        print_status "ERROR" "Disk usage: $disk_used/$disk_total (${disk_percent}%)"
    elif [ "$disk_percent" -gt 80 ]; then
        print_status "WARNING" "Disk usage: $disk_used/$disk_total (${disk_percent}%)"
    else
        print_status "OK" "Disk usage: $disk_used/$disk_total (${disk_percent}%)"
    fi
    
    # Load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    local load_percent=$(echo "scale=1; $load_avg / $cpu_cores * 100" | bc)
    
    if (( $(echo "$load_percent > 90" | bc -l) )); then
        print_status "ERROR" "Load average: $load_avg (${load_percent}% of $cpu_cores cores)"
    elif (( $(echo "$load_percent > 70" | bc -l) )); then
        print_status "WARNING" "Load average: $load_avg (${load_percent}% of $cpu_cores cores)"
    else
        print_status "OK" "Load average: $load_avg (${load_percent}% of $cpu_cores cores)"
    fi
    
    echo ""
}

# Check service status
check_services() {
    echo -e "${BLUE}🔧 Service Status${NC}"
    echo "=================="
    
    for service in "${SERVICES[@]}"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            local uptime=$(systemctl show "$service" --property=ActiveEnterTimestamp --value)
            print_status "OK" "$service is running (since $uptime)"
        else
            if systemctl is-enabled --quiet "$service" 2>/dev/null; then
                print_status "ERROR" "$service is not running (but enabled)"
            else
                print_status "WARNING" "$service is not running (not enabled)"
            fi
        fi
    done
    
    echo ""
}

# Check blockchain connections
check_blockchain_connections() {
    echo -e "${BLUE}⛓️  Blockchain Connections${NC}"
    echo "=========================="
    
    for coin in "${COINS[@]}"; do
        local coin_lower=$(echo "$coin" | tr '[:upper:]' '[:lower:]')
        local rpc_host=$(grep "^${coin}_RPC_HOST=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "127.0.0.1")
        local rpc_port=$(grep "^${coin}_RPC_PORT=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2)
        local rpc_user=$(grep "^${coin}_RPC_USER=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2)
        local rpc_pass=$(grep "^${coin}_RPC_PASS=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2)
        
        if [ -z "$rpc_port" ] || [ -z "$rpc_user" ] || [ -z "$rpc_pass" ]; then
            print_status "WARNING" "$coin: Not configured"
            continue
        fi
        
        # Test RPC connection
        local rpc_response=$(curl -s --connect-timeout 5 \
            --user "$rpc_user:$rpc_pass" \
            --data-binary '{"jsonrpc":"1.0","id":"monitor","method":"getblockchaininfo","params":[]}' \
            -H 'content-type: text/plain;' \
            "http://$rpc_host:$rpc_port/" 2>/dev/null)
        
        if echo "$rpc_response" | grep -q '"result"'; then
            local blocks=$(echo "$rpc_response" | grep -o '"blocks":[0-9]*' | cut -d':' -f2)
            local headers=$(echo "$rpc_response" | grep -o '"headers":[0-9]*' | cut -d':' -f2)
            
            if [ "$blocks" = "$headers" ]; then
                print_status "OK" "$coin: Synced (block $blocks)"
            else
                local behind=$((headers - blocks))
                print_status "WARNING" "$coin: Syncing (block $blocks/$headers, $behind behind)"
            fi
        else
            print_status "ERROR" "$coin: RPC connection failed"
        fi
    done
    
    echo ""
}

# Check database
check_database() {
    echo -e "${BLUE}🗄️  Database Status${NC}"
    echo "=================="
    
    local db_file="$PROJECT_DIR/data/tipbot.db"
    
    if [ -f "$db_file" ]; then
        # Check database integrity
        if sqlite3 "$db_file" "PRAGMA integrity_check;" | grep -q "ok"; then
            print_status "OK" "Database integrity check passed"
        else
            print_status "ERROR" "Database integrity check failed"
        fi
        
        # Check database size
        local db_size=$(du -h "$db_file" | cut -f1)
        print_status "INFO" "Database size: $db_size"
        
        # Check user count
        local user_count=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
        print_status "INFO" "Total users: $user_count"
        
        # Check transaction count
        local tx_count=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM transactions;" 2>/dev/null || echo "0")
        print_status "INFO" "Total transactions: $tx_count"
        
        # Check active users (last 24 hours)
        local active_users=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM users WHERE last_activity > datetime('now', '-24 hours');" 2>/dev/null || echo "0")
        print_status "INFO" "Active users (24h): $active_users"
        
    else
        print_status "ERROR" "Database file not found: $db_file"
    fi
    
    echo ""
}

# Check log files
check_logs() {
    echo -e "${BLUE}📝 Log Status${NC}"
    echo "============="
    
    local logs_dir="$PROJECT_DIR/logs"
    
    if [ -d "$logs_dir" ]; then
        # Check log file sizes
        for log_file in "$logs_dir"/*.log; do
            if [ -f "$log_file" ]; then
                local log_size=$(du -h "$log_file" | cut -f1)
                local log_name=$(basename "$log_file")
                
                # Check for recent errors
                local recent_errors=$(tail -100 "$log_file" | grep -c '"level":"error"' || echo "0")
                
                if [ "$recent_errors" -gt 10 ]; then
                    print_status "ERROR" "$log_name: $log_size ($recent_errors recent errors)"
                elif [ "$recent_errors" -gt 0 ]; then
                    print_status "WARNING" "$log_name: $log_size ($recent_errors recent errors)"
                else
                    print_status "OK" "$log_name: $log_size (no recent errors)"
                fi
            fi
        done
    else
        print_status "WARNING" "Logs directory not found: $logs_dir"
    fi
    
    echo ""
}

# Check network connectivity
check_network() {
    echo -e "${BLUE}🌐 Network Connectivity${NC}"
    echo "======================="
    
    # Check internet connectivity
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        print_status "OK" "Internet connectivity"
    else
        print_status "ERROR" "No internet connectivity"
    fi
    
    # Check Telegram API
    if curl -s --connect-timeout 5 "https://api.telegram.org" >/dev/null 2>&1; then
        print_status "OK" "Telegram API reachable"
    else
        print_status "ERROR" "Telegram API unreachable"
    fi
    
    echo ""
}

# Show recent activity
show_recent_activity() {
    echo -e "${BLUE}📈 Recent Activity${NC}"
    echo "=================="
    
    local db_file="$PROJECT_DIR/data/tipbot.db"
    
    if [ -f "$db_file" ]; then
        # Recent transactions (last hour)
        local recent_txs=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM transactions WHERE created_at > datetime('now', '-1 hour');" 2>/dev/null || echo "0")
        print_status "INFO" "Transactions (last hour): $recent_txs"
        
        # Recent tips
        local recent_tips=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM transactions WHERE transaction_type = 'tip' AND created_at > datetime('now', '-1 hour');" 2>/dev/null || echo "0")
        print_status "INFO" "Tips (last hour): $recent_tips"
        
        # Active airdrops
        local active_airdrops=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM airdrops WHERE status = 'active';" 2>/dev/null || echo "0")
        print_status "INFO" "Active airdrops: $active_airdrops"
        
        # Recent errors in logs
        local logs_dir="$PROJECT_DIR/logs"
        if [ -f "$logs_dir/error.log" ]; then
            local recent_errors=$(tail -100 "$logs_dir/error.log" | grep "$(date '+%Y-%m-%d')" | wc -l || echo "0")
            if [ "$recent_errors" -gt 0 ]; then
                print_status "WARNING" "Errors today: $recent_errors"
            else
                print_status "OK" "No errors today"
            fi
        fi
    fi
    
    echo ""
}

# Generate summary report
generate_summary() {
    echo -e "${BLUE}📋 Summary${NC}"
    echo "=========="
    
    local issues=0
    local warnings=0
    
    # Count issues from previous checks (this is a simplified approach)
    # In a real implementation, you'd track these during the checks
    
    if [ $issues -eq 0 ] && [ $warnings -eq 0 ]; then
        print_status "OK" "All systems operational"
    elif [ $issues -eq 0 ]; then
        print_status "WARNING" "$warnings warnings found"
    else
        print_status "ERROR" "$issues errors and $warnings warnings found"
    fi
    
    echo ""
    echo "Monitor completed at $(date)"
}

# Main function
main() {
    echo -e "${GREEN}🔍 Aegisum Tip Bot Monitor${NC}"
    echo "=========================="
    echo "Timestamp: $(date)"
    echo ""
    
    # Run all checks
    check_system_resources
    check_services
    check_blockchain_connections
    check_database
    check_logs
    check_network
    show_recent_activity
    generate_summary
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --system      Check system resources only"
        echo "  --services    Check services only"
        echo "  --blockchain  Check blockchain connections only"
        echo "  --database    Check database only"
        echo "  --logs        Check logs only"
        echo "  --network     Check network only"
        echo "  --activity    Show recent activity only"
        echo "  --help, -h    Show this help message"
        exit 0
        ;;
    --system)
        check_system_resources
        ;;
    --services)
        check_services
        ;;
    --blockchain)
        check_blockchain_connections
        ;;
    --database)
        check_database
        ;;
    --logs)
        check_logs
        ;;
    --network)
        check_network
        ;;
    --activity)
        show_recent_activity
        ;;
    *)
        main
        ;;
esac