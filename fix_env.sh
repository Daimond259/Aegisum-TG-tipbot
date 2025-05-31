#!/bin/bash

echo "🔧 FIXING .ENV FILE FOR ALL DAEMONS"
echo "=================================="

# Create the fixed .env content
cat > .env << 'EOF'
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=8104147271:AAETCwNeWzLfRtJgGT3o_Teh0K00nm92OpI
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook

# Database Configuration
DATABASE_PATH=./data/tipbot.db

# Security Configuration
ENCRYPTION_KEY=hNPH7o5fGc29BGzcGdLNt43R3Be9LE72
JWT_SECRET=Jh0/x2mrsWHufl1uDJaDM/klaKd8XtUnhsYfyYXolUM=

# Blockchain RPC Configuration
# AEGS (Aegisum)
AEGS_RPC_HOST=127.0.0.1
AEGS_RPC_PORT=8332
AEGS_RPC_USER=aegsrpc
AEGS_RPC_PASS=pJFssAAUq9chHP3/c84IDRjR2WG6e6qfK4EbZMjVZu0=
AEGS_NETWORK=mainnet

# SHIC
SHIC_RPC_HOST=127.0.0.1
SHIC_RPC_PORT=8333
SHIC_RPC_USER=shicrpc
SHIC_RPC_PASS=csidLInNYHm1EGI651+mQ1VC8vu23v1p4NiZcfagCoM=
SHIC_NETWORK=mainnet

# PEPE
PEPE_RPC_HOST=127.0.0.1
PEPE_RPC_PORT=8334
PEPE_RPC_USER=peperpc
PEPE_RPC_PASS=IHQBqUZ1qoj9YDwghcgFu7S49xuSi1IcIo6f1HfwDbQ=
PEPE_NETWORK=mainnet

# ADVC
ADVC_RPC_HOST=127.0.0.1
ADVC_RPC_PORT=9982
ADVC_RPC_USER=advcrpc
ADVC_RPC_PASS=OaVODP1NFGd55Xs8cHB7GbbbSl9rPE+5MeYj0vUQm/8=
ADVC_NETWORK=mainnet

# Bot Configuration
DEFAULT_COOLDOWN=30
MAX_TIP_AMOUNT=1000
MIN_TIP_AMOUNT=0.01
TRANSACTION_FEE=0.001

# Admin Configuration
ADMIN_TELEGRAM_IDS=1651155083
APPROVED_GROUPS=

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/tipbot.log

# Development
NODE_ENV=production
PORT=3000
EOF

echo "✅ Fixed .env file - uncommented all RPC configurations"
echo "🔧 Now restart the bot to apply changes"
EOF