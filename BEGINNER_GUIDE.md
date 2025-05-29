# 🚀 BEGINNER'S STEP-BY-STEP INSTALLATION GUIDE

**For users with limited coding experience**

This guide will walk you through EXACTLY how to install and set up your Aegisum Telegram Tip Bot, step by step.

## 📋 What You Need Before Starting

### 1. Ubuntu Server
- A headless Ubuntu 20.04+ server
- At least 4GB RAM (8GB recommended)
- At least 50GB disk space
- SSH access to your server

### 2. Telegram Bot Token
- You'll need to create a Telegram bot first
- We'll show you how below

---

## 🎯 STEP 1: Create Your Telegram Bot

1. **Open Telegram** on your phone or computer
2. **Search for @BotFather** and start a chat
3. **Send the command**: `/newbot`
4. **Choose a name** for your bot (e.g., "Aegisum Tip Bot")
5. **Choose a username** (must end in 'bot', e.g., "aegisum_tip_bot")
6. **SAVE THE TOKEN** - BotFather will give you a token that looks like:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
   **⚠️ IMPORTANT: Keep this token safe! You'll need it later.**

---

## 🎯 STEP 2: Connect to Your Ubuntu Server

1. **Open your terminal** (or SSH client like PuTTY)
2. **Connect to your server**:
   ```bash
   ssh your-username@your-server-ip
   ```
   Replace `your-username` and `your-server-ip` with your actual details

3. **Update your server**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

## 🎯 STEP 3: Install the Tip Bot (EASIEST METHOD)

**Copy and paste this ONE command** into your terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/Daimond259/Aegisum-TG-tipbot/initial-implementation/scripts/install.sh | sudo bash
```

**What this does:**
- Downloads the installation script
- Installs Node.js and all dependencies
- Downloads the tip bot code
- Sets up the database
- Creates system services
- Guides you through configuration

---

## 🎯 STEP 4: Configuration (The Script Will Ask You)

The installation script will ask you for these details. **Have them ready:**

### A. Telegram Bot Token
- **What it asks**: "Enter your Telegram bot token:"
- **What to enter**: The token from Step 1 (e.g., `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### B. Encryption Key
- **What it asks**: "Enter encryption key (32 characters):"
- **What to enter**: A random 32-character string. You can use this generator:
  ```bash
  openssl rand -hex 16
  ```
  **⚠️ SAVE THIS KEY! You'll need it if you ever move the bot.**

### C. Admin User ID
- **What it asks**: "Enter admin Telegram user ID:"
- **How to find your ID**: 
  1. Message @userinfobot on Telegram
  2. It will reply with your user ID (a number like `123456789`)
  3. Enter this number

### D. Blockchain RPC Settings
For each coin (AEGS, SHIC, PEPE, ADVC), you'll need:
- **RPC Host**: IP address of your blockchain node (e.g., `127.0.0.1`)
- **RPC Port**: Port number (e.g., `8332`)
- **RPC Username**: Username for RPC access
- **RPC Password**: Password for RPC access

**⚠️ IMPORTANT**: You need to set up blockchain nodes for each coin first!

---

## 🎯 STEP 5: Set Up Blockchain Nodes (REQUIRED)

**You need running blockchain nodes for each supported coin.**

### For AEGS (Aegisum):
1. **Download Aegisum Core** from https://aegisum.com
2. **Install and sync** the blockchain
3. **Configure RPC** in `aegisum.conf`:
   ```
   server=1
   rpcuser=your_rpc_username
   rpcpassword=your_rpc_password
   rpcport=8332
   rpcallowip=127.0.0.1
   ```

### For Other Coins (SHIC, PEPE, ADVC):
- Follow similar steps for each coin's blockchain
- Each needs its own node running
- Each needs RPC configured

**📍 WHERE TO FIND CONFIG FILES:**
- Usually in `~/.coinname/` folder
- For example: `~/.aegisum/aegisum.conf`

---

## 🎯 STEP 6: Start the Bot

After installation completes:

```bash
# Start the bot service
sudo systemctl start aegisum-tipbot

# Enable it to start automatically
sudo systemctl enable aegisum-tipbot

# Check if it's running
sudo systemctl status aegisum-tipbot
```

**✅ Success looks like:**
```
● aegisum-tipbot.service - Aegisum Telegram Tip Bot
   Loaded: loaded
   Active: active (running)
```

---

## 🎯 STEP 7: Test Your Bot

1. **Find your bot** on Telegram (search for the username you created)
2. **Send `/start`** to your bot
3. **The bot should respond** with a welcome message
4. **Try `/help`** to see all commands

---

## 📁 WHERE EVERYTHING IS LOCATED

### Bot Files:
- **Main folder**: `/opt/aegisum-tipbot/`
- **Configuration**: `/opt/aegisum-tipbot/.env`
- **Database**: `/opt/aegisum-tipbot/data/tipbot.db`
- **Logs**: `/var/log/aegisum-tipbot/`

### Important Commands:
```bash
# View logs
sudo journalctl -u aegisum-tipbot -f

# Restart bot
sudo systemctl restart aegisum-tipbot

# Stop bot
sudo systemctl stop aegisum-tipbot

# Edit configuration
sudo nano /opt/aegisum-tipbot/.env
```

---

## 🔧 WHAT TO CHANGE AND WHERE

### 1. Bot Token (if you need to change it):
```bash
sudo nano /opt/aegisum-tipbot/.env
```
Find the line: `TELEGRAM_BOT_TOKEN=` and change the value

### 2. Add/Remove Approved Groups:
Use the bot command `/setgroups` as an admin

### 3. Change Fees:
Use the bot command `/setfees` as an admin

### 4. Blockchain Settings:
```bash
sudo nano /opt/aegisum-tipbot/.env
```
Look for lines like:
```
AEGS_RPC_HOST=127.0.0.1
AEGS_RPC_PORT=8332
AEGS_RPC_USER=your_username
AEGS_RPC_PASS=your_password
```

**After any changes, restart the bot:**
```bash
sudo systemctl restart aegisum-tipbot
```

---

## 🆘 TROUBLESHOOTING

### Bot Won't Start:
```bash
# Check logs for errors
sudo journalctl -u aegisum-tipbot -n 50

# Check if all blockchain nodes are running
ps aux | grep -E "(aegisum|shic|pepe|advc)"
```

### Bot Not Responding:
1. Check if the service is running: `sudo systemctl status aegisum-tipbot`
2. Check logs: `sudo tail -f /var/log/aegisum-tipbot/error.log`
3. Verify bot token is correct in `/opt/aegisum-tipbot/.env`

### Database Issues:
```bash
# Check database file exists
ls -la /opt/aegisum-tipbot/data/

# Reset database (⚠️ THIS DELETES ALL DATA)
sudo rm /opt/aegisum-tipbot/data/tipbot.db
sudo systemctl restart aegisum-tipbot
```

---

## 📞 GETTING HELP

### Check These First:
1. **Service status**: `sudo systemctl status aegisum-tipbot`
2. **Recent logs**: `sudo journalctl -u aegisum-tipbot -n 20`
3. **Error logs**: `sudo tail /var/log/aegisum-tipbot/error.log`

### Log Locations:
- **Application logs**: `/var/log/aegisum-tipbot/app.log`
- **Error logs**: `/var/log/aegisum-tipbot/error.log`
- **System logs**: `sudo journalctl -u aegisum-tipbot`

---

## ✅ SUCCESS CHECKLIST

- [ ] Ubuntu server is running and updated
- [ ] Telegram bot created and token saved
- [ ] Installation script completed successfully
- [ ] All blockchain nodes are running and synced
- [ ] RPC credentials configured correctly
- [ ] Bot service is active and running
- [ ] Bot responds to `/start` command
- [ ] Admin commands work (you can use `/stats`)

---

## 🎉 YOU'RE DONE!

Your Aegisum Telegram Tip Bot is now running! Users can:
- Create wallets with `/start`
- Check balances with `/balance`
- Tip each other with `/tip @user coin amount`
- Participate in rain and airdrops

**Remember**: This is a non-custodial bot, so users control their own private keys!

---

**Need more help?** Check the other documentation files:
- `QUICKSTART.md` - Quick reference
- `docs/SETUP.md` - Detailed technical setup
- `DEPLOYMENT_SUMMARY.md` - Complete feature overview