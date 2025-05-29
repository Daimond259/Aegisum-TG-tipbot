#!/bin/bash

# Aegisum Tip Bot Installation Script
# This script installs and configures the Aegisum Telegram Tip Bot

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
INSTALL_USER="tipbot"
INSTALL_DIR="/home/$INSTALL_USER/Aegisum-TG-tipbot"

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

# Function to ask yes/no questions
ask_yes_no() {
    local question=$1
    local default=${2:-"n"}
    
    while true; do
        if [ "$default" = "y" ]; then
            read -p "$question (Y/n): " answer
            answer=${answer:-"y"}
        else
            read -p "$question (y/N): " answer
            answer=${answer:-"n"}
        fi
        
        case $answer in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_status "ERROR" "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check system requirements
check_system_requirements() {
    print_status "INFO" "Checking system requirements..."
    
    # Check Ubuntu version
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [ "$ID" != "ubuntu" ]; then
            print_status "WARNING" "This script is designed for Ubuntu. Your OS: $ID"
            if ! ask_yes_no "Continue anyway?"; then
                exit 1
            fi
        fi
        
        # Check version
        local version_id=$(echo $VERSION_ID | cut -d. -f1)
        if [ "$version_id" -lt 20 ]; then
            print_status "WARNING" "Ubuntu 20.04+ recommended. Your version: $VERSION_ID"
        fi
    fi
    
    # Check available memory
    local mem_gb=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$mem_gb" -lt 4 ]; then
        print_status "WARNING" "At least 4GB RAM recommended. Available: ${mem_gb}GB"
    fi
    
    # Check available disk space
    local disk_gb=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$disk_gb" -lt 50 ]; then
        print_status "WARNING" "At least 50GB free space recommended. Available: ${disk_gb}GB"
    fi
    
    print_status "OK" "System requirements check completed"
}

# Update system packages
update_system() {
    print_status "INFO" "Updating system packages..."
    
    apt update
    apt upgrade -y
    
    print_status "OK" "System packages updated"
}

# Install required packages
install_packages() {
    print_status "INFO" "Installing required packages..."
    
    # Install Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    # Install packages
    apt install -y \
        nodejs \
        git \
        build-essential \
        python3-dev \
        sqlite3 \
        curl \
        wget \
        unzip \
        htop \
        ufw \
        logrotate \
        bc
    
    # Verify Node.js installation
    local node_version=$(node --version)
    local npm_version=$(npm --version)
    
    print_status "OK" "Node.js $node_version and npm $npm_version installed"
}

# Create tipbot user
create_user() {
    print_status "INFO" "Creating tipbot user..."
    
    if id "$INSTALL_USER" &>/dev/null; then
        print_status "WARNING" "User $INSTALL_USER already exists"
    else
        adduser --disabled-password --gecos "" "$INSTALL_USER"
        usermod -aG sudo "$INSTALL_USER"
        print_status "OK" "User $INSTALL_USER created"
    fi
}

# Install the bot
install_bot() {
    print_status "INFO" "Installing Aegisum Tip Bot..."
    
    # Create installation directory
    if [ -d "$INSTALL_DIR" ]; then
        print_status "WARNING" "Installation directory already exists"
        if ask_yes_no "Remove existing installation?"; then
            rm -rf "$INSTALL_DIR"
        else
            print_status "ERROR" "Installation cancelled"
            exit 1
        fi
    fi
    
    # Copy files to installation directory
    mkdir -p "$INSTALL_DIR"
    cp -r "$PROJECT_DIR"/* "$INSTALL_DIR"/
    
    # Set ownership
    chown -R "$INSTALL_USER:$INSTALL_USER" "$INSTALL_DIR"
    
    # Install npm dependencies
    print_status "INFO" "Installing npm dependencies..."
    cd "$INSTALL_DIR"
    sudo -u "$INSTALL_USER" npm install --production
    
    print_status "OK" "Bot installed to $INSTALL_DIR"
}

# Configure systemd service
configure_systemd() {
    print_status "INFO" "Configuring systemd service..."
    
    # Copy service file
    cp "$INSTALL_DIR/config/systemd/aegisum-tipbot.service" /etc/systemd/system/
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable service
    systemctl enable aegisum-tipbot
    
    print_status "OK" "Systemd service configured"
}

# Configure logrotate
configure_logrotate() {
    print_status "INFO" "Configuring log rotation..."
    
    # Copy logrotate configuration
    cp "$INSTALL_DIR/config/logrotate/aegisum-tipbot" /etc/logrotate.d/
    
    # Test logrotate configuration
    if logrotate -d /etc/logrotate.d/aegisum-tipbot >/dev/null 2>&1; then
        print_status "OK" "Log rotation configured"
    else
        print_status "WARNING" "Log rotation configuration may have issues"
    fi
}

# Configure firewall
configure_firewall() {
    print_status "INFO" "Configuring firewall..."
    
    if ask_yes_no "Configure UFW firewall?" "y"; then
        # Reset UFW to defaults
        ufw --force reset
        
        # Set default policies
        ufw default deny incoming
        ufw default allow outgoing
        
        # Allow SSH
        ufw allow ssh
        
        # Allow local RPC connections only
        ufw allow from 127.0.0.1 to any port 8332:8335
        
        # Enable UFW
        ufw --force enable
        
        print_status "OK" "Firewall configured"
    else
        print_status "WARNING" "Firewall configuration skipped"
    fi
}

# Create backup script
setup_backup_script() {
    print_status "INFO" "Setting up backup script..."
    
    # Make backup script executable
    chmod +x "$INSTALL_DIR/scripts/backup.sh"
    
    # Create backup directory
    sudo -u "$INSTALL_USER" mkdir -p "/home/$INSTALL_USER/tipbot-backups"
    
    # Add to crontab for daily backups
    if ask_yes_no "Setup daily automatic backups?" "y"; then
        local cron_line="0 2 * * * $INSTALL_DIR/scripts/backup.sh >/dev/null 2>&1"
        (sudo -u "$INSTALL_USER" crontab -l 2>/dev/null; echo "$cron_line") | sudo -u "$INSTALL_USER" crontab -
        print_status "OK" "Daily backup scheduled at 2:00 AM"
    fi
}

# Setup monitoring
setup_monitoring() {
    print_status "INFO" "Setting up monitoring script..."
    
    # Make monitor script executable
    chmod +x "$INSTALL_DIR/scripts/monitor.sh"
    
    # Add to crontab for hourly monitoring
    if ask_yes_no "Setup hourly monitoring checks?" "y"; then
        local cron_line="0 * * * * $INSTALL_DIR/scripts/monitor.sh --system --services >/dev/null 2>&1"
        (sudo -u "$INSTALL_USER" crontab -l 2>/dev/null; echo "$cron_line") | sudo -u "$INSTALL_USER" crontab -
        print_status "OK" "Hourly monitoring scheduled"
    fi
}

# Run initial configuration
run_initial_config() {
    print_status "INFO" "Running initial configuration..."
    
    cd "$INSTALL_DIR"
    
    if ask_yes_no "Run the setup wizard now?" "y"; then
        sudo -u "$INSTALL_USER" npm run setup
        print_status "OK" "Initial configuration completed"
    else
        print_status "WARNING" "Setup wizard skipped - run 'npm run setup' later"
    fi
}

# Display post-installation instructions
show_post_install_instructions() {
    echo ""
    echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Configure your blockchain nodes (AEGS, SHIC, PEPE, ADVC)"
    echo "2. If you skipped the setup wizard, run: sudo -u $INSTALL_USER npm run setup"
    echo "3. Start the bot: sudo systemctl start aegisum-tipbot"
    echo "4. Check status: sudo systemctl status aegisum-tipbot"
    echo "5. View logs: sudo journalctl -u aegisum-tipbot -f"
    echo ""
    echo -e "${BLUE}📁 Important Directories:${NC}"
    echo "• Bot installation: $INSTALL_DIR"
    echo "• Configuration: $INSTALL_DIR/.env"
    echo "• Database: $INSTALL_DIR/data/tipbot.db"
    echo "• Logs: $INSTALL_DIR/logs/"
    echo "• Backups: /home/$INSTALL_USER/tipbot-backups/"
    echo ""
    echo -e "${BLUE}🔧 Useful Commands:${NC}"
    echo "• Start bot: sudo systemctl start aegisum-tipbot"
    echo "• Stop bot: sudo systemctl stop aegisum-tipbot"
    echo "• Restart bot: sudo systemctl restart aegisum-tipbot"
    echo "• View logs: sudo journalctl -u aegisum-tipbot -f"
    echo "• Monitor status: sudo -u $INSTALL_USER $INSTALL_DIR/scripts/monitor.sh"
    echo "• Create backup: sudo -u $INSTALL_USER $INSTALL_DIR/scripts/backup.sh"
    echo ""
    echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
    echo "• Keep your .env file secure"
    echo "• Regularly backup your database"
    echo "• Monitor logs for suspicious activity"
    echo "• Keep the system updated"
    echo ""
    echo -e "${BLUE}📖 Documentation:${NC}"
    echo "• Setup guide: $INSTALL_DIR/docs/SETUP.md"
    echo "• README: $INSTALL_DIR/README.md"
    echo ""
}

# Main installation function
main() {
    echo -e "${GREEN}🚀 Aegisum Telegram Tip Bot Installer${NC}"
    echo "======================================"
    echo ""
    
    # Pre-installation checks
    check_root
    check_system_requirements
    
    # Confirm installation
    if ! ask_yes_no "Proceed with installation?" "y"; then
        print_status "INFO" "Installation cancelled"
        exit 0
    fi
    
    # Installation steps
    update_system
    install_packages
    create_user
    install_bot
    configure_systemd
    configure_logrotate
    configure_firewall
    setup_backup_script
    setup_monitoring
    run_initial_config
    
    # Show completion message
    show_post_install_instructions
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo "  --user USER   Install for specific user (default: tipbot)"
        echo ""
        echo "This script will:"
        echo "• Update system packages"
        echo "• Install Node.js and dependencies"
        echo "• Create tipbot user"
        echo "• Install the bot"
        echo "• Configure systemd service"
        echo "• Setup log rotation"
        echo "• Configure firewall"
        echo "• Setup backup and monitoring"
        exit 0
        ;;
    --user)
        if [ -n "$2" ]; then
            INSTALL_USER="$2"
            INSTALL_DIR="/home/$INSTALL_USER/Aegisum-TG-tipbot"
        else
            print_status "ERROR" "User not specified"
            exit 1
        fi
        ;;
esac

# Run main installation
main