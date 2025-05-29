# Quick Start Guide

Get your Aegisum Telegram Tip Bot up and running in minutes!

## 🚀 One-Line Installation

For a fresh Ubuntu 20.04+ server:

```bash
curl -fsSL https://raw.githubusercontent.com/Daimond259/Aegisum-TG-tipbot/main/scripts/install.sh | sudo bash
```

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Ubuntu 20.04+ server with root access
- [ ] At least 4GB RAM and 50GB disk space
- [ ] Telegram bot token from @BotFather
- [ ] Blockchain nodes for supported coins (AEGS, SHIC, PEPE, ADVC)

## 🔧 Manual Installation

### 1. Clone Repository
```bash
git clone https://github.com/Daimond259/Aegisum-TG-tipbot.git
cd Aegisum-TG-tipbot
```

### 2. Run Installation Script
```bash
sudo ./scripts/install.sh
```

### 3. Configure the Bot
```bash
sudo -u tipbot npm run setup
```

### 4. Start the Bot
```bash
sudo systemctl start aegisum-tipbot
sudo systemctl enable aegisum-tipbot
```

## ⚙️ Quick Configuration

### Telegram Bot Setup
1. Message @BotFather on Telegram
2. Create new bot: `/newbot`
3. Copy the bot token
4. Use token in setup wizard

### Blockchain Configuration
For each coin you want to support:

1. **Download and install the blockchain daemon**
2. **Create configuration file** (e.g., `~/.aegisum/aegisum.conf`):
   ```ini
   rpcuser=aegsrpc
   rpcpassword=your_secure_password
   rpcallowip=127.0.0.1
   rpcport=8332
   server=1
   daemon=1
   txindex=1
   ```
3. **Start the daemon**: `aegisumd -daemon`
4. **Wait for sync**: `aegisum-cli getblockchaininfo`

### Admin Setup
1. Get your Telegram user ID (message @userinfobot)
2. Add your ID to `ADMIN_TELEGRAM_IDS` in setup
3. Approve groups with `/setgroups` command

## 🎯 First Steps After Installation

### 1. Check Status
```bash
sudo systemctl status aegisum-tipbot
sudo journalctl -u aegisum-tipbot -f
```

### 2. Monitor Health
```bash
sudo -u tipbot /home/tipbot/Aegisum-TG-tipbot/scripts/monitor.sh
```

### 3. Test the Bot
1. Start a chat with your bot on Telegram
2. Send `/start` to create a wallet
3. Send `/help` to see available commands

### 4. Approve Groups
1. Add bot to your Telegram group
2. As admin, send `/setgroups` in the group
3. Test with `/balance` or `/help`

## 🔍 Troubleshooting

### Bot Won't Start
```bash
# Check logs
sudo journalctl -u aegisum-tipbot -n 50

# Common issues:
# - Missing .env file: Run setup wizard
# - Database permissions: Check file ownership
# - Blockchain connections: Verify RPC settings
```

### Blockchain Connection Issues
```bash
# Test RPC connection
curl --user rpcuser:rpcpass \
     --data-binary '{"jsonrpc":"1.0","id":"test","method":"getblockchaininfo","params":[]}' \
     -H 'content-type: text/plain;' \
     http://127.0.0.1:8332/

# Check if daemon is running
ps aux | grep aegisumd
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R tipbot:tipbot /home/tipbot/Aegisum-TG-tipbot

# Fix permissions
sudo chmod 600 /home/tipbot/Aegisum-TG-tipbot/.env
```

## 📊 Monitoring & Maintenance

### Daily Tasks
```bash
# Check status
sudo systemctl status aegisum-tipbot

# View recent logs
sudo journalctl -u aegisum-tipbot --since "1 hour ago"

# Monitor resources
sudo -u tipbot /home/tipbot/Aegisum-TG-tipbot/scripts/monitor.sh
```

### Weekly Tasks
```bash
# Update system
sudo apt update && sudo apt upgrade

# Check backups
ls -la /home/tipbot/tipbot-backups/

# Review logs for errors
sudo journalctl -u aegisum-tipbot -p err --since "1 week ago"
```

### Backup & Recovery
```bash
# Manual backup
sudo -u tipbot /home/tipbot/Aegisum-TG-tipbot/scripts/backup.sh

# Restore from backup
sudo systemctl stop aegisum-tipbot
sudo -u tipbot cp /home/tipbot/tipbot-backups/database_YYYYMMDD.db /home/tipbot/Aegisum-TG-tipbot/data/tipbot.db
sudo systemctl start aegisum-tipbot
```

## 🎮 User Commands

### Wallet Commands
- `/start` - Create or restore wallet
- `/balance` - Check balances
- `/deposit` - Get deposit addresses
- `/withdraw AEGS 10.5 AegsAddress123...` - Withdraw funds
- `/history` - Transaction history

### Community Commands
- `/tip @username AEGS 5.0` - Tip a user
- `/rain SHIC 100` - Distribute to active users
- `/airdrop PEPE 500 5` - Create 5-minute airdrop

### Admin Commands
- `/status` - Bot and blockchain status
- `/setgroups` - Approve current group
- `/setcooldown 30` - Set 30-second cooldown

## 🆘 Getting Help

1. **Check the logs first**: `sudo journalctl -u aegisum-tipbot -f`
2. **Review documentation**: `/home/tipbot/Aegisum-TG-tipbot/docs/SETUP.md`
3. **Run diagnostics**: `sudo -u tipbot /home/tipbot/Aegisum-TG-tipbot/scripts/monitor.sh`
4. **Search issues**: [GitHub Issues](https://github.com/Daimond259/Aegisum-TG-tipbot/issues)
5. **Ask for help**: [Aegisum Community](https://t.me/aegisum)

## 🔐 Security Checklist

- [ ] Secure .env file permissions (`chmod 600`)
- [ ] Strong RPC passwords for all blockchains
- [ ] Firewall configured (UFW enabled)
- [ ] Regular backups scheduled
- [ ] Log monitoring in place
- [ ] Admin user IDs properly configured
- [ ] System updates automated

## 🎉 You're Ready!

Your Aegisum Telegram Tip Bot is now ready to serve your community! 

Start by:
1. Testing wallet creation with `/start`
2. Adding the bot to your community groups
3. Approving groups with `/setgroups`
4. Encouraging users to try tipping and airdrops

Happy tipping! 🪙✨