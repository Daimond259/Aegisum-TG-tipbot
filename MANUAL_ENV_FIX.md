# 🔧 MANUAL .ENV FIX

## Issue 1: RPC Configuration
Your .env file still has commented out lines. You need to uncomment these:

```bash
# Edit your .env file:
nano ~/.env

# Find these lines and UNCOMMENT them (remove the #):
#SHIC_RPC_HOST=127.0.0.1
#SHIC_RPC_PORT=8333
#PEPE_RPC_HOST=127.0.0.1  
#PEPE_RPC_PORT=8334

# Should become:
SHIC_RPC_HOST=127.0.0.1
SHIC_RPC_PORT=8333
PEPE_RPC_HOST=127.0.0.1
PEPE_RPC_PORT=8334
```

## Issue 2: ENCRYPTION_KEY Length
Your current key is 32 characters, but the system expects exactly 32 bytes.

**Replace this line in your .env:**
```
ENCRYPTION_KEY=hNPH7o5fGc29BGzcGdLNt43R3Be9LE72
```

**With this (exactly 32 characters):**
```
ENCRYPTION_KEY=hNPH7o5fGc29BGzcGdLNt43R3Be9LE72
```

## Quick Fix Commands:
```bash
cd ~/Aegisum-TG-tipbot

# Fix RPC configs
sed -i 's/#SHIC_RPC_HOST=/SHIC_RPC_HOST=/' .env
sed -i 's/#SHIC_RPC_PORT=/SHIC_RPC_PORT=/' .env  
sed -i 's/#PEPE_RPC_HOST=/PEPE_RPC_HOST=/' .env
sed -i 's/#PEPE_RPC_PORT=/PEPE_RPC_PORT=/' .env

# Restart bot
pm2 restart aegisum-tipbot

# Test
node debug_all_wallets.js
```