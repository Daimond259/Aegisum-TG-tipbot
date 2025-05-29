#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function generateSecureKey(length = 32) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}

async function setup() {
    console.log('🌟 Aegisum Telegram Tip Bot Setup');
    console.log('=====================================\n');

    const envPath = path.join(__dirname, '..', '.env');
    const envExamplePath = path.join(__dirname, '..', '.env.example');

    // Check if .env already exists
    if (fs.existsSync(envPath)) {
        const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('Setup cancelled.');
            rl.close();
            return;
        }
    }

    console.log('📝 Please provide the following information:\n');

    // Telegram Bot Configuration
    console.log('🤖 TELEGRAM BOT CONFIGURATION');
    console.log('Get your bot token from @BotFather on Telegram');
    const botToken = await question('Bot Token: ');

    // Security Configuration
    console.log('\n🔐 SECURITY CONFIGURATION');
    const encryptionKey = generateSecureKey(32);
    const jwtSecret = generateSecureKey(64);
    console.log(`Generated encryption key: ${encryptionKey}`);
    console.log(`Generated JWT secret: ${jwtSecret}`);

    // Blockchain RPC Configuration
    console.log('\n⛓️  BLOCKCHAIN RPC CONFIGURATION');
    console.log('Configure RPC connections for each supported coin\n');

    const coins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];
    const rpcConfigs = {};

    for (const coin of coins) {
        console.log(`--- ${coin} Configuration ---`);
        const configure = await question(`Configure ${coin} RPC? (Y/n): `);
        
        if (configure.toLowerCase() !== 'n') {
            rpcConfigs[coin] = {
                host: await question(`${coin} RPC Host (127.0.0.1): `) || '127.0.0.1',
                port: await question(`${coin} RPC Port: `),
                user: await question(`${coin} RPC Username: `),
                pass: await question(`${coin} RPC Password: `),
                network: await question(`${coin} Network (mainnet): `) || 'mainnet'
            };
        }
        console.log('');
    }

    // Admin Configuration
    console.log('👑 ADMIN CONFIGURATION');
    console.log('Enter Telegram user IDs of bot administrators (comma-separated)');
    const adminIds = await question('Admin Telegram IDs: ');

    // Bot Settings
    console.log('\n⚙️  BOT SETTINGS');
    const cooldown = await question('Default cooldown seconds (30): ') || '30';
    const maxTip = await question('Maximum tip amount (1000): ') || '1000';
    const minTip = await question('Minimum tip amount (0.01): ') || '0.01';
    const txFee = await question('Transaction fee (0.001): ') || '0.001';

    // Generate .env file
    let envContent = `# Aegisum Telegram Tip Bot Configuration
# Generated on ${new Date().toISOString()}

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=${botToken}
TELEGRAM_WEBHOOK_URL=

# Database Configuration
DATABASE_PATH=./data/tipbot.db

# Security Configuration
ENCRYPTION_KEY=${encryptionKey}
JWT_SECRET=${jwtSecret}

`;

    // Add blockchain configurations
    for (const coin of coins) {
        if (rpcConfigs[coin]) {
            const config = rpcConfigs[coin];
            envContent += `# ${coin} Configuration
${coin}_RPC_HOST=${config.host}
${coin}_RPC_PORT=${config.port}
${coin}_RPC_USER=${config.user}
${coin}_RPC_PASS=${config.pass}
${coin}_NETWORK=${config.network}

`;
        } else {
            envContent += `# ${coin} Configuration (disabled)
#${coin}_RPC_HOST=127.0.0.1
#${coin}_RPC_PORT=
#${coin}_RPC_USER=
#${coin}_RPC_PASS=
#${coin}_NETWORK=mainnet

`;
        }
    }

    envContent += `# Bot Configuration
DEFAULT_COOLDOWN=${cooldown}
MAX_TIP_AMOUNT=${maxTip}
MIN_TIP_AMOUNT=${minTip}
TRANSACTION_FEE=${txFee}

# Admin Configuration
ADMIN_TELEGRAM_IDS=${adminIds}
APPROVED_GROUPS=

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/tipbot.log

# Development
NODE_ENV=production
PORT=3000
`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);

    // Create necessary directories
    const dirs = ['data', 'logs'];
    for (const dir of dirs) {
        const dirPath = path.join(__dirname, '..', dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 Created directory: ${dir}/`);
        }
    }

    console.log('\n✅ Setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Configure your blockchain nodes (ensure RPC is enabled)');
    console.log('3. Start the bot: npm start');
    console.log('\n📖 For detailed setup instructions, see docs/SETUP.md');
    console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
    console.log('• Keep your .env file secure and never commit it to version control');
    console.log('• Your encryption key is used to protect user wallets');
    console.log('• Make sure your blockchain RPC connections are secure');
    console.log('• Regularly backup your database');

    rl.close();
}

// Run setup
setup().catch((error) => {
    console.error('Setup failed:', error);
    rl.close();
    process.exit(1);
});