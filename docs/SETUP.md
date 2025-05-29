# Aegisum Telegram Tip Bot - Complete Setup Guide

This guide will walk you through setting up the Aegisum Telegram Tip Bot on a headless Ubuntu server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Preparation](#server-preparation)
3. [Blockchain Node Setup](#blockchain-node-setup)
4. [Bot Installation](#bot-installation)
5. [Configuration](#configuration)
6. [Running the Bot](#running-the-bot)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- Ubuntu 20.04 LTS or newer
- At least 4GB RAM (8GB recommended)
- 50GB+ free disk space (for blockchain data)
- Stable internet connection
- Root or sudo access

### Required Software
- Node.js 16+ and npm
- Git
- Blockchain daemon for each supported coin

## Server Preparation

### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install Git and Build Tools
```bash
sudo apt install -y git build-essential python3-dev
```

### 4. Create Bot User (Recommended)
```bash
sudo adduser tipbot
sudo usermod -aG sudo tipbot
su - tipbot
```

## Blockchain Node Setup

You need to set up blockchain nodes for each coin you want to support. This guide covers the general process.

### 1. Download Blockchain Software

For each coin (AEGS, SHIC, PEPE, ADVC), download the appropriate daemon:

```bash
# Example for AEGS (adjust URLs for other coins)
cd ~/
wget https://github.com/aegisum/aegisum/releases/download/v1.0.0/aegisum-linux.tar.gz
tar -xzf aegisum-linux.tar.gz
sudo cp aegisum*/bin/* /usr/local/bin/
```

### 2. Create Configuration Directories
```bash
mkdir -p ~/.aegisum ~/.shic ~/.pepe ~/.advc
```

### 3. Configure Each Blockchain

Create configuration files for each coin:

**~/.aegisum/aegisum.conf:**
```ini
# AEGS Configuration
rpcuser=aegsrpc
rpcpassword=your_secure_rpc_password_here
rpcallowip=127.0.0.1
rpcport=8332
server=1
daemon=1
txindex=1
addressindex=1
timestampindex=1
spentindex=1

# Network settings
listen=1
maxconnections=50

# Logging
debug=0
```

**~/.shic/shic.conf:**
```ini
# SHIC Configuration
rpcuser=shicrpc
rpcpassword=your_secure_rpc_password_here
rpcallowip=127.0.0.1
rpcport=8333
server=1
daemon=1
txindex=1
addressindex=1
timestampindex=1
spentindex=1
```

**~/.pepe/pepe.conf:**
```ini
# PEPE Configuration
rpcuser=peperpc
rpcpassword=your_secure_rpc_password_here
rpcallowip=127.0.0.1
rpcport=8334
server=1
daemon=1
txindex=1
addressindex=1
timestampindex=1
spentindex=1
```

**~/.advc/advc.conf:**
```ini
# ADVC Configuration
rpcuser=advcrpc
rpcpassword=your_secure_rpc_password_here
rpcallowip=127.0.0.1
rpcport=8335
server=1
daemon=1
txindex=1
addressindex=1
timestampindex=1
spentindex=1
```

### 4. Create Systemd Services

Create service files for automatic startup:

**/etc/systemd/system/aegisum.service:**
```ini
[Unit]
Description=AEGS Daemon
After=network.target

[Service]
Type=forking
User=tipbot
ExecStart=/usr/local/bin/aegisumd -daemon
ExecStop=/usr/local/bin/aegisum-cli stop
Restart=always
RestartSec=30
TimeoutStopSec=60
TimeoutStartSec=10
StartLimitInterval=120
StartLimitBurst=5

[Install]
WantedBy=multi-user.target
```

Create similar service files for other coins, adjusting the binary names and descriptions.

### 5. Start Blockchain Services
```bash
sudo systemctl daemon-reload
sudo systemctl enable aegisum shic pepe advc
sudo systemctl start aegisum shic pepe advc

# Check status
sudo systemctl status aegisum
```

### 6. Wait for Synchronization

The blockchains need to sync before the bot can work properly:

```bash
# Check sync status
aegisum-cli getblockchaininfo
shic-cli getblockchaininfo
pepe-cli getblockchaininfo
advc-cli getblockchaininfo
```

Wait until `"blocks"` equals `"headers"` for each chain.

## Bot Installation

### 1. Clone Repository
```bash
cd ~/
git clone https://github.com/Daimond259/Aegisum-TG-tipbot.git
cd Aegisum-TG-tipbot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Setup Script
```bash
npm run setup
```

Follow the interactive prompts to configure:
- Telegram bot token (get from @BotFather)
- RPC credentials for each blockchain
- Admin Telegram user IDs
- Bot settings (cooldowns, limits, etc.)

## Configuration

### 1. Telegram Bot Setup

1. Message @BotFather on Telegram
2. Create a new bot: `/newbot`
3. Choose a name and username
4. Copy the bot token for configuration

### 2. Environment Variables

The setup script creates a `.env` file. Key settings:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
ENCRYPTION_KEY=32_character_encryption_key

# Blockchain RPC (for each coin)
AEGS_RPC_HOST=127.0.0.1
AEGS_RPC_PORT=8332
AEGS_RPC_USER=aegsrpc
AEGS_RPC_PASS=your_rpc_password

# Admin settings
ADMIN_TELEGRAM_IDS=123456789,987654321
DEFAULT_COOLDOWN=30
```

### 3. Security Considerations

- **Encryption Key**: 32-character key used to encrypt user wallets
- **RPC Passwords**: Use strong, unique passwords for each blockchain
- **File Permissions**: Ensure `.env` is readable only by the bot user
- **Firewall**: Block external access to RPC ports

```bash
# Secure the .env file
chmod 600 .env

# Configure firewall (if using ufw)
sudo ufw allow ssh
sudo ufw allow from 127.0.0.1 to any port 8332:8335
sudo ufw enable
```

## Running the Bot

### 1. Test Run
```bash
# Test the bot
npm start
```

Check for any errors and ensure all blockchain connections work.

### 2. Create Systemd Service

**/etc/systemd/system/aegisum-tipbot.service:**
```ini
[Unit]
Description=Aegisum Telegram Tip Bot
After=network.target aegisum.service shic.service pepe.service advc.service
Wants=aegisum.service shic.service pepe.service advc.service

[Service]
Type=simple
User=tipbot
WorkingDirectory=/home/tipbot/Aegisum-TG-tipbot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=aegisum-tipbot

[Install]
WantedBy=multi-user.target
```

### 3. Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable aegisum-tipbot
sudo systemctl start aegisum-tipbot

# Check status
sudo systemctl status aegisum-tipbot

# View logs
sudo journalctl -u aegisum-tipbot -f
```

### 4. Configure Log Rotation

**/etc/logrotate.d/aegisum-tipbot:**
```
/home/tipbot/Aegisum-TG-tipbot/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 tipbot tipbot
    postrotate
        systemctl reload aegisum-tipbot
    endscript
}
```

## Bot Usage

### 1. Approve Groups

As an admin, add the bot to groups and approve them:
```
/setgroups
```

### 2. User Commands

Users can interact with the bot using:
- `/start` - Create or restore wallet
- `/balance` - Check balances
- `/deposit` - Get deposit addresses
- `/withdraw <coin> <amount> <address>` - Withdraw funds
- `/tip @user <coin> <amount>` - Tip another user
- `/rain <coin> <amount>` - Distribute to active users
- `/airdrop <coin> <amount> <minutes>` - Create timed airdrop

### 3. Admin Commands

Admins have additional commands:
- `/status` - Check bot and blockchain status
- `/setgroups` - Approve current group
- `/setcooldown <seconds>` - Set command cooldown
- `/setfees <coin> <fee>` - Set transaction fees

## Maintenance

### 1. Regular Tasks

**Daily:**
- Check service status: `sudo systemctl status aegisum-tipbot`
- Monitor logs: `sudo journalctl -u aegisum-tipbot --since "1 hour ago"`
- Check blockchain sync: `aegisum-cli getblockchaininfo`

**Weekly:**
- Update system: `sudo apt update && sudo apt upgrade`
- Check disk space: `df -h`
- Backup database: `cp data/tipbot.db backups/tipbot-$(date +%Y%m%d).db`

**Monthly:**
- Review logs for errors
- Update bot if new version available
- Check blockchain node versions

### 2. Backup Strategy

**Database Backup:**
```bash
# Create backup directory
mkdir -p ~/backups

# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp ~/Aegisum-TG-tipbot/data/tipbot.db ~/backups/tipbot_$DATE.db
find ~/backups -name "tipbot_*.db" -mtime +30 -delete
```

**Configuration Backup:**
```bash
# Backup configuration (excluding sensitive data)
tar -czf ~/backups/config_$(date +%Y%m%d).tar.gz \
    ~/Aegisum-TG-tipbot/package.json \
    ~/Aegisum-TG-tipbot/docs/ \
    ~/.aegisum/aegisum.conf \
    ~/.shic/shic.conf \
    ~/.pepe/pepe.conf \
    ~/.advc/advc.conf
```

### 3. Updates

**Bot Updates:**
```bash
cd ~/Aegisum-TG-tipbot
git pull origin main
npm install
sudo systemctl restart aegisum-tipbot
```

**Blockchain Updates:**
```bash
# Stop services
sudo systemctl stop aegisum-tipbot aegisum

# Update blockchain software
# (Download and install new version)

# Restart services
sudo systemctl start aegisum aegisum-tipbot
```

## Troubleshooting

### Common Issues

**1. Bot won't start:**
```bash
# Check logs
sudo journalctl -u aegisum-tipbot -n 50

# Common causes:
# - Missing environment variables
# - Database connection issues
# - Blockchain RPC connection failures
```

**2. Blockchain connection errors:**
```bash
# Test RPC connection
curl --user aegsrpc:your_password \
     --data-binary '{"jsonrpc":"1.0","id":"test","method":"getblockchaininfo","params":[]}' \
     -H 'content-type: text/plain;' \
     http://127.0.0.1:8332/

# Check if daemon is running
ps aux | grep aegisumd
```

**3. Database issues:**
```bash
# Check database file permissions
ls -la data/tipbot.db

# Test database connection
sqlite3 data/tipbot.db "SELECT COUNT(*) FROM users;"
```

**4. Memory issues:**
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Restart services if needed
sudo systemctl restart aegisum-tipbot
```

### Log Analysis

**Bot Logs:**
```bash
# Real-time logs
sudo journalctl -u aegisum-tipbot -f

# Error logs only
sudo journalctl -u aegisum-tipbot -p err

# Logs from specific time
sudo journalctl -u aegisum-tipbot --since "2023-01-01 00:00:00"
```

**Application Logs:**
```bash
# View application logs
tail -f ~/Aegisum-TG-tipbot/logs/combined.log
tail -f ~/Aegisum-TG-tipbot/logs/error.log
```

### Performance Monitoring

**System Resources:**
```bash
# CPU and memory usage
htop

# Disk usage
df -h
du -sh ~/Aegisum-TG-tipbot/

# Network connections
netstat -tulpn | grep :833
```

**Bot Performance:**
```bash
# Check bot status via admin command
# Send /status to the bot as an admin

# Database size
ls -lh data/tipbot.db

# Log file sizes
ls -lh logs/
```

## Security Best Practices

1. **Server Security:**
   - Keep system updated
   - Use SSH keys instead of passwords
   - Configure firewall properly
   - Regular security audits

2. **Bot Security:**
   - Secure .env file permissions
   - Regular backups
   - Monitor for suspicious activity
   - Keep admin list minimal

3. **Blockchain Security:**
   - Secure RPC credentials
   - Regular node updates
   - Monitor for unusual transactions
   - Backup wallet files

## Support

For additional help:
1. Check the logs first
2. Review this documentation
3. Search existing GitHub issues
4. Create a new issue with detailed information

Remember to never share sensitive information like private keys, RPC passwords, or encryption keys when seeking help.