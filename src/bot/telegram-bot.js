const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const ValidationUtils = require('../utils/validation');

class CommunityTipBot {
    constructor(token, database, walletManager, blockchainManager) {
        this.bot = new TelegramBot(token, { polling: true });
        this.db = database;
        this.wallet = walletManager;
        this.blockchain = blockchainManager;
        this.logger = logger;
        this.adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').filter(id => id);
        this.userSessions = new Map(); // Store temporary user data
        
        this.setupCallbackHandlers();
        this.setupErrorHandling();
    }

    async initialize() {
        try {
            await this.setupCommands();
            logger.info('Bot commands configured successfully');
        } catch (error) {
            logger.warn('Failed to setup bot commands:', error.message);
        }
    }

    // Add footer to all bot messages
    addFooter(message) {
        return `${message}\n\n<i>Powered by Aegisum EcoSystem</i>`;
    }

    // Enhanced sendMessage with automatic footer
    async sendMessage(chatId, text, options = {}) {
        const messageWithFooter = this.addFooter(text);
        return await this.bot.sendMessage(chatId, messageWithFooter, {
            parse_mode: 'HTML',
            ...options
        });
    }

    // Enhanced editMessageText with automatic footer
    async editMessageText(text, options = {}) {
        const messageWithFooter = this.addFooter(text);
        return await this.bot.editMessageText(messageWithFooter, {
            parse_mode: 'HTML',
            ...options
        });
    }

    setupCommands() {
        // Set bot commands
        this.bot.setMyCommands([
            { command: 'start', description: 'Create or restore wallet' },
            { command: 'balance', description: 'Show your balances' },
            { command: 'deposit', description: 'Show deposit addresses' },
            { command: 'withdraw', description: 'Withdraw funds to external address' },
            { command: 'tip', description: 'Tip another user' },
            { command: 'rain', description: 'Distribute coins to active users' },
            { command: 'airdrop', description: 'Create a timed airdrop' },
            { command: 'history', description: 'Show transaction history' },
            { command: 'help', description: 'Show help information' }
        ]);

        // Command handlers
        this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
        this.bot.onText(/\/balance/, (msg) => this.handleBalance(msg));
        this.bot.onText(/\/deposit/, (msg) => this.handleDeposit(msg));
        this.bot.onText(/\/withdraw (.+)/, (msg, match) => this.handleWithdraw(msg, match));
        this.bot.onText(/\/tip (.+)/, (msg, match) => this.handleTip(msg, match));
        this.bot.onText(/\/rain (.+)/, (msg, match) => this.handleRain(msg, match));
        this.bot.onText(/\/airdrop (.+)/, (msg, match) => this.handleAirdrop(msg, match));
        this.bot.onText(/\/history/, (msg) => this.handleHistory(msg));
        this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));

        // Admin commands
        this.bot.onText(/\/setgroups/, (msg) => this.handleSetGroups(msg));
        this.bot.onText(/\/setcooldown (.+)/, (msg, match) => this.handleSetCooldown(msg, match));
        this.bot.onText(/\/setfees (.+)/, (msg, match) => this.handleSetFees(msg, match));
        this.bot.onText(/\/status/, (msg) => this.handleStatus(msg));

        // Handle text messages for wallet setup
        this.bot.on('message', (msg) => this.handleMessage(msg));
    }

    setupCallbackHandlers() {
        this.bot.on('callback_query', (callbackQuery) => {
            this.handleCallbackQuery(callbackQuery);
        });
    }

    setupErrorHandling() {
        this.bot.on('error', (error) => {
            this.logger.error('Telegram bot error:', error);
        });

        this.bot.on('polling_error', (error) => {
            this.logger.error('Telegram polling error:', error);
        });
    }

    // Utility methods
    async ensureUser(msg) {
        const user = msg.from;
        await this.db.createUser(user.id, user.username, user.first_name, user.last_name);
        await this.db.updateUserActivity(user.id);
        return await this.db.getUserByTelegramId(user.id);
    }

    async checkGroupPermissions(msg) {
        if (msg.chat.type === 'private') {
            return true; // Allow all commands in private chat
        }

        const isApproved = await this.db.isGroupApproved(msg.chat.id);
        if (!isApproved) {
            await this.sendMessage(msg.chat.id, 
                '❌ This group is not approved for bot usage. Contact an admin to add this group.');
            return false;
        }

        return true;
    }

    async checkCooldown(userId, groupId, commandType) {
        const onCooldown = await this.db.checkCooldown(userId, groupId, commandType);
        if (onCooldown) {
            const cooldownSeconds = await this.db.getAdminSetting('default_cooldown', 30);
            return { onCooldown: true, seconds: cooldownSeconds };
        }
        
        await this.db.updateCooldown(userId, groupId, commandType);
        return { onCooldown: false };
    }

    isAdmin(userId) {
        return this.adminIds.includes(userId.toString());
    }

    // Command handlers
    async handleStart(msg) {
        try {
            await this.ensureUser(msg);
            
            const hasWallet = await this.wallet.hasWallet(msg.from.id);
            
            if (hasWallet) {
                await this.sendMessage(msg.chat.id, 
                    '👛 Welcome back! Your wallet is already set up.\n\n' +
                    'Use /balance to check your balances or /help for available commands.');
                return;
            }

            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🆕 Create New Wallet', callback_data: 'create_wallet' },
                        { text: '🔄 Restore Wallet', callback_data: 'restore_wallet' }
                    ]
                ]
            };

            await this.sendMessage(msg.chat.id,
                '🌟 Welcome to Aegisum Tip Bot!\n\n' +
                '🪙 Supported coins: AEGS, SHIC, PEPE, ADVC\n\n' +
                '🔐 This bot creates non-custodial wallets - you control your private keys!\n\n' +
                'Choose an option to get started:',
                { reply_markup: keyboard }
            );

        } catch (error) {
            this.logger.error('Start command error:', error);
            await this.sendMessage(msg.chat.id, '❌ An error occurred. Please try again.');
        }
    }

    async handleBalance(msg) {
        try {
            if (!await this.checkGroupPermissions(msg)) return;
            
            await this.ensureUser(msg);
            
            const hasWallet = await this.wallet.hasWallet(msg.from.id);
            if (!hasWallet) {
                await this.sendMessage(msg.chat.id, 
                    '❌ You don\'t have a wallet yet. Use /start to create one.');
                return;
            }

            const balances = await this.wallet.getUserBalances(msg.from.id);
            
            let message = '💰 Your Balances:\n\n';
            
            for (const [coin, balance] of Object.entries(balances)) {
                const confirmed = ValidationUtils.formatAmount(balance.confirmed);
                const unconfirmed = ValidationUtils.formatAmount(balance.unconfirmed);
                
                message += `${coin}: ${confirmed}`;
                if (balance.unconfirmed > 0) {
                    message += ` (${unconfirmed} pending)`;
                }
                message += '\n';
            }

            message += '\n💡 Use /deposit to get your deposit addresses';

            await this.sendMessage(msg.chat.id, message);

        } catch (error) {
            this.logger.error('Balance command error:', error);
            await this.sendMessage(msg.chat.id, '❌ Failed to get balances. Please try again.');
        }
    }

    async handleDeposit(msg) {
        try {
            if (!await this.checkGroupPermissions(msg)) return;
            
            await this.ensureUser(msg);
            
            const hasWallet = await this.wallet.hasWallet(msg.from.id);
            if (!hasWallet) {
                await this.sendMessage(msg.chat.id, 
                    '❌ You don\'t have a wallet yet. Use /start to create one.');
                return;
            }

            const addresses = await this.wallet.getWalletAddresses(msg.from.id);
            
            let message = '📥 Your Deposit Addresses:\n\n';
            
            for (const [coin, address] of Object.entries(addresses)) {
                message += `${coin}:\n\`${address}\`\n\n`;
            }

            message += '⚠️ Only send the corresponding coin to each address!';

            await this.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

        } catch (error) {
            this.logger.error('Deposit command error:', error);
            await this.sendMessage(msg.chat.id, '❌ Failed to get deposit addresses. Please try again.');
        }
    }

    async handleWithdraw(msg, match) {
        try {
            if (!await this.checkGroupPermissions(msg)) return;
            
            const params = match[1].split(' ');
            if (params.length !== 3) {
                await this.sendMessage(msg.chat.id, 
                    '❌ Usage: /withdraw [coin] [amount] [address]\n' +
                    'Example: /withdraw AEGS 10.5 AegsAddress123...');
                return;
            }

            const [coin, amountStr, address] = params;
            const validation = ValidationUtils.validateWithdrawCommand({
                coin: coin.toUpperCase(),
                amount: ValidationUtils.parseAmount(amountStr),
                address
            });

            if (!validation.valid) {
                await this.sendMessage(msg.chat.id, '❌ ' + validation.errors.join('\n'));
                return;
            }

            await this.ensureUser(msg);
            
            const hasWallet = await this.wallet.hasWallet(msg.from.id);
            if (!hasWallet) {
                await this.sendMessage(msg.chat.id, 
                    '❌ You don\'t have a wallet yet. Use /start to create one.');
                return;
            }

            // Store withdrawal request and ask for password
            this.userSessions.set(msg.from.id, {
                action: 'withdraw',
                coin: coin.toUpperCase(),
                amount: ValidationUtils.parseAmount(amountStr),
                address,
                chatId: msg.chat.id
            });

            await this.sendMessage(msg.chat.id, 
                '🔐 Please enter your wallet password to confirm the withdrawal:');

        } catch (error) {
            this.logger.error('Withdraw command error:', error);
            await this.sendMessage(msg.chat.id, '❌ Withdrawal failed. Please try again.');
        }
    }

    async handleTip(msg, match) {
        try {
            if (!await this.checkGroupPermissions(msg)) return;
            
            // Check cooldown
            const cooldown = await this.checkCooldown(msg.from.id, msg.chat.id, 'tip');
            if (cooldown.onCooldown) {
                await this.sendMessage(msg.chat.id, 
                    `⏰ Please wait ${cooldown.seconds} seconds between tips.`);
                return;
            }

            const params = match[1].split(' ');
            if (params.length !== 3) {
                await this.sendMessage(msg.chat.id, 
                    '❌ Usage: /tip @username [coin] [amount]\n' +
                    'Example: /tip @alice AEGS 5.0');
                return;
            }

            let [recipient, coin, amountStr] = params;
            
            // Remove @ from username if present
            recipient = recipient.replace('@', '');
            
            const validation = ValidationUtils.validateTipCommand({
                recipient,
                coin: coin.toUpperCase(),
                amount: ValidationUtils.parseAmount(amountStr)
            });

            if (!validation.valid) {
                await this.sendMessage(msg.chat.id, '❌ ' + validation.errors.join('\n'));
                return;
            }

            await this.ensureUser(msg);
            
            // Find recipient user
            const recipientUser = await this.db.get(
                'SELECT * FROM users WHERE username = ? OR telegram_id = ?',
                [recipient, recipient]
            );

            if (!recipientUser) {
                await this.sendMessage(msg.chat.id, 
                    '❌ Recipient not found. They need to start the bot first.');
                return;
            }

            if (recipientUser.telegram_id === msg.from.id) {
                await this.sendMessage(msg.chat.id, '❌ You cannot tip yourself!');
                return;
            }

            const amount = ValidationUtils.parseAmount(amountStr);
            const coinSymbol = coin.toUpperCase();

            // Check sender balance
            const balances = await this.wallet.getUserBalances(msg.from.id);
            if (balances[coinSymbol].confirmed < amount) {
                await this.sendMessage(msg.chat.id, 
                    `❌ Insufficient ${coinSymbol} balance. You have ${ValidationUtils.formatAmount(balances[coinSymbol].confirmed)} ${coinSymbol}`);
                return;
            }

            // Perform internal transfer
            const result = await this.wallet.transferBetweenUsers(
                msg.from.id,
                recipientUser.telegram_id,
                amount,
                coinSymbol,
                'tip'
            );

            if (result.success) {
                const senderName = msg.from.username || msg.from.first_name;
                const recipientName = recipientUser.username || recipientUser.first_name;
                
                await this.sendMessage(msg.chat.id,
                    `✅ ${senderName} tipped ${ValidationUtils.formatAmount(amount)} ${coinSymbol} to ${recipientName}! 🎉`);
                
                // Notify recipient if in private chat
                if (msg.chat.type === 'private') {
                    try {
                        await this.sendMessage(recipientUser.telegram_id,
                            `🎉 You received a tip of ${ValidationUtils.formatAmount(amount)} ${coinSymbol} from ${senderName}!`);
                    } catch (error) {
                        // Recipient might have blocked the bot
                        this.logger.warn('Could not notify tip recipient:', error.message);
                    }
                }
            }

        } catch (error) {
            this.logger.error('Tip command error:', error);
            await this.sendMessage(msg.chat.id, '❌ Tip failed. Please try again.');
        }
    }

    async handleRain(msg, match) {
        try {
            if (!await this.checkGroupPermissions(msg)) return;
            
            if (msg.chat.type === 'private') {
                await this.sendMessage(msg.chat.id, '❌ Rain can only be used in groups.');
                return;
            }

            // Check cooldown
            const cooldown = await this.checkCooldown(msg.from.id, msg.chat.id, 'rain');
            if (cooldown.onCooldown) {
                await this.sendMessage(msg.chat.id, 
                    `⏰ Please wait ${cooldown.seconds} seconds between rain commands.`);
                return;
            }

            const params = match[1].split(' ');
            if (params.length !== 2) {
                await this.sendMessage(msg.chat.id, 
                    '❌ Usage: /rain [coin] [amount]\n' +
                    'Example: /rain AEGS 50.0');
                return;
            }

            const [coin, amountStr] = params;
            const validation = ValidationUtils.validateRainCommand({
                coin: coin.toUpperCase(),
                amount: ValidationUtils.parseAmount(amountStr)
            });

            if (!validation.valid) {
                await this.sendMessage(msg.chat.id, '❌ ' + validation.errors.join('\n'));
                return;
            }

            await this.ensureUser(msg);
            
            const amount = ValidationUtils.parseAmount(amountStr);
            const coinSymbol = coin.toUpperCase();

            // Check sender balance
            const balances = await this.wallet.getUserBalances(msg.from.id);
            if (balances[coinSymbol].confirmed < amount) {
                await this.sendMessage(msg.chat.id, 
                    `❌ Insufficient ${coinSymbol} balance. You have ${ValidationUtils.formatAmount(balances[coinSymbol].confirmed)} ${coinSymbol}`);
                return;
            }

            // Get recently active users (last 10 minutes)
            const activeUsers = await this.db.all(`
                SELECT DISTINCT u.* FROM users u
                WHERE u.last_activity > datetime('now', '-10 minutes')
                AND u.telegram_id != ?
                AND u.encrypted_seed IS NOT NULL
            `, [msg.from.id]);

            if (activeUsers.length === 0) {
                await this.sendMessage(msg.chat.id, '❌ No active users found for rain.');
                return;
            }

            const amountPerUser = amount / activeUsers.length;
            if (amountPerUser < 0.00000001) {
                await this.sendMessage(msg.chat.id, '❌ Amount too small to distribute.');
                return;
            }

            // Perform rain distribution
            let successCount = 0;
            for (const user of activeUsers) {
                try {
                    await this.wallet.transferBetweenUsers(
                        msg.from.id,
                        user.telegram_id,
                        amountPerUser,
                        coinSymbol,
                        'rain'
                    );
                    successCount++;
                } catch (error) {
                    this.logger.error('Rain transfer failed:', error);
                }
            }

            const senderName = msg.from.username || msg.from.first_name;
            await this.sendMessage(msg.chat.id,
                `🌧️ ${senderName} made it rain ${ValidationUtils.formatAmount(amount)} ${coinSymbol}!\n` +
                `💰 ${successCount} users received ${ValidationUtils.formatAmount(amountPerUser)} ${coinSymbol} each! 🎉`);

        } catch (error) {
            this.logger.error('Rain command error:', error);
            await this.sendMessage(msg.chat.id, '❌ Rain failed. Please try again.');
        }
    }

    async handleAirdrop(msg, match) {
        try {
            if (!await this.checkGroupPermissions(msg)) return;
            
            if (msg.chat.type === 'private') {
                await this.sendMessage(msg.chat.id, '❌ Airdrops can only be used in groups.');
                return;
            }

            // Check cooldown
            const cooldown = await this.checkCooldown(msg.from.id, msg.chat.id, 'airdrop');
            if (cooldown.onCooldown) {
                await this.sendMessage(msg.chat.id, 
                    `⏰ Please wait ${cooldown.seconds} seconds between airdrop commands.`);
                return;
            }

            const params = match[1].split(' ');
            if (params.length !== 3) {
                await this.sendMessage(msg.chat.id, 
                    '❌ Usage: /airdrop [coin] [amount] [duration_minutes]\n' +
                    'Example: /airdrop AEGS 100.0 5');
                return;
            }

            const [coin, amountStr, durationStr] = params;
            const validation = ValidationUtils.validateAirdropCommand({
                coin: coin.toUpperCase(),
                amount: ValidationUtils.parseAmount(amountStr),
                duration: parseInt(durationStr)
            });

            if (!validation.valid) {
                await this.sendMessage(msg.chat.id, '❌ ' + validation.errors.join('\n'));
                return;
            }

            await this.ensureUser(msg);
            
            const amount = ValidationUtils.parseAmount(amountStr);
            const duration = parseInt(durationStr);
            const coinSymbol = coin.toUpperCase();

            // Check sender balance
            const balances = await this.wallet.getUserBalances(msg.from.id);
            if (balances[coinSymbol].confirmed < amount) {
                await this.sendMessage(msg.chat.id, 
                    `❌ Insufficient ${coinSymbol} balance. You have ${ValidationUtils.formatAmount(balances[coinSymbol].confirmed)} ${coinSymbol}`);
                return;
            }

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🎁 Join Airdrop', callback_data: 'join_airdrop' }]
                ]
            };

            const senderName = msg.from.username || msg.from.first_name;
            const airdropMsg = await this.sendMessage(msg.chat.id,
                `🎁 AIRDROP STARTED! 🎁\n\n` +
                `💰 Amount: ${ValidationUtils.formatAmount(amount)} ${coinSymbol}\n` +
                `⏰ Duration: ${duration} minutes\n` +
                `👤 Started by: ${senderName}\n\n` +
                `Click the button below to join!`,
                { reply_markup: keyboard }
            );

            // Create airdrop in database
            const user = await this.db.getUserByTelegramId(msg.from.id);
            await this.db.createAirdrop(
                user.id,
                msg.chat.id,
                coinSymbol,
                amount,
                duration,
                airdropMsg.message_id
            );

        } catch (error) {
            this.logger.error('Airdrop command error:', error);
            await this.sendMessage(msg.chat.id, '❌ Airdrop creation failed. Please try again.');
        }
    }

    async handleHistory(msg) {
        try {
            if (!await this.checkGroupPermissions(msg)) return;
            
            await this.ensureUser(msg);
            
            const hasWallet = await this.wallet.hasWallet(msg.from.id);
            if (!hasWallet) {
                await this.sendMessage(msg.chat.id, 
                    '❌ You don\'t have a wallet yet. Use /start to create one.');
                return;
            }

            const transactions = await this.wallet.getTransactionHistory(msg.from.id, 10);
            
            if (transactions.length === 0) {
                await this.sendMessage(msg.chat.id, '📜 No transaction history found.');
                return;
            }

            let message = '📜 Recent Transactions:\n\n';
            
            transactions.forEach((tx, index) => {
                const direction = tx.direction === 'sent' ? '📤' : '📥';
                const amount = ValidationUtils.formatAmount(tx.amount);
                const date = new Date(tx.created_at).toLocaleDateString();
                
                message += `${direction} ${tx.type.toUpperCase()}\n`;
                message += `${amount} ${tx.coin} - ${tx.status}\n`;
                message += `${date}\n`;
                if (tx.txid) {
                    message += `TxID: \`${tx.txid.substring(0, 16)}...\`\n`;
                }
                message += '\n';
            });

            await this.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

        } catch (error) {
            this.logger.error('History command error:', error);
            await this.sendMessage(msg.chat.id, '❌ Failed to get transaction history. Please try again.');
        }
    }

    async handleHelp(msg) {
        const helpText = `
🚀 Community Tip Bot Help

💰 WALLET COMMANDS:
/start - Create or restore wallet
/balance - Show your balances
/deposit - Show deposit addresses
/withdraw [coin] [amount] [address] - Withdraw funds

🎁 COMMUNITY COMMANDS:
/tip @user [coin] [amount] - Tip another user
/rain [coin] [amount] - Distribute to active users
/airdrop [coin] [amount] [minutes] - Create timed airdrop

📊 INFO COMMANDS:
/history - Show transaction history
/help - Show this help

🪙 SUPPORTED COINS:
AEGS, SHIC, PEPE, ADVC

⚠️ IMPORTANT:
• This is a non-custodial wallet - you control your keys
• Keep your password and backup phrase safe
• Only send supported coins to deposit addresses
• Commands have cooldowns to prevent spam

💡 Need help? Contact the admins!
        `;

        await this.sendMessage(msg.chat.id, helpText);
    }

    // Admin command handlers
    async handleSetGroups(msg) {
        if (!this.isAdmin(msg.from.id)) {
            await this.sendMessage(msg.chat.id, '❌ Admin access required.');
            return;
        }

        if (msg.chat.type === 'private') {
            await this.sendMessage(msg.chat.id, '❌ Use this command in the group you want to approve.');
            return;
        }

        try {
            await this.db.addApprovedGroup(msg.chat.id, msg.chat.title);
            await this.sendMessage(msg.chat.id, '✅ This group has been approved for bot usage.');
        } catch (error) {
            this.logger.error('Set groups error:', error);
            await this.sendMessage(msg.chat.id, '❌ Failed to approve group.');
        }
    }

    async handleStatus(msg) {
        if (!this.isAdmin(msg.from.id)) {
            await this.sendMessage(msg.chat.id, '❌ Admin access required.');
            return;
        }

        try {
            const connections = await this.blockchain.testConnections();
            
            let message = '🔧 Bot Status:\n\n';
            
            for (const [coin, status] of Object.entries(connections)) {
                const icon = status.connected ? '✅' : '❌';
                message += `${icon} ${coin}: `;
                
                if (status.connected) {
                    message += `Block ${status.blockHeight}\n`;
                } else {
                    message += `Disconnected (${status.error})\n`;
                }
            }

            await this.sendMessage(msg.chat.id, message);

        } catch (error) {
            this.logger.error('Status command error:', error);
            await this.sendMessage(msg.chat.id, '❌ Failed to get status.');
        }
    }

    // Message handler for wallet setup
    async handleMessage(msg) {
        if (!msg.text || msg.text.startsWith('/')) return;

        const session = this.userSessions.get(msg.from.id);
        if (!session) return;

        try {
            if (session.action === 'create_wallet_password') {
                await this.processCreateWallet(msg, session);
            } else if (session.action === 'restore_wallet_mnemonic') {
                await this.processRestoreMnemonic(msg, session);
            } else if (session.action === 'restore_wallet_password') {
                await this.processRestorePassword(msg, session);
            } else if (session.action === 'withdraw') {
                await this.processWithdraw(msg, session);
            }
        } catch (error) {
            this.logger.error('Message handling error:', error);
            await this.sendMessage(msg.chat.id, '❌ An error occurred. Please try again.');
            this.userSessions.delete(msg.from.id);
        }
    }

    // Callback query handler
    async handleCallbackQuery(callbackQuery) {
        const data = callbackQuery.data;
        const msg = callbackQuery.message;
        const userId = callbackQuery.from.id;

        try {
            if (data === 'create_wallet') {
                this.userSessions.set(userId, { action: 'create_wallet_password' });
                await this.sendMessage(msg.chat.id, 
                    '🔐 Please enter a strong password for your wallet:\n\n' +
                    '• At least 8 characters\n' +
                    '• Include letters and numbers\n' +
                    '• Keep it safe - you\'ll need it to access your funds!');
            } else if (data === 'restore_wallet') {
                this.userSessions.set(userId, { action: 'restore_wallet_mnemonic' });
                await this.sendMessage(msg.chat.id, 
                    '🔄 Please enter your 12 or 24-word backup phrase:');
            } else if (data === 'join_airdrop') {
                await this.processJoinAirdrop(callbackQuery);
            }

            await this.bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            this.logger.error('Callback query error:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Error occurred' });
        }
    }

    // Wallet creation process
    async processCreateWallet(msg, session) {
        const password = msg.text;
        
        // Delete the password message for security
        try {
            await this.bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (error) {
            // Ignore deletion errors
        }

        const passwordValidation = ValidationUtils.isValidPassword(password);
        if (!passwordValidation.valid) {
            await this.sendMessage(msg.chat.id, '❌ ' + passwordValidation.message);
            return;
        }

        try {
            const result = await this.wallet.createWallet(msg.from.id, password);
            
            if (result.success) {
                await this.sendMessage(msg.chat.id, 
                    '✅ Wallet created successfully!\n\n' +
                    '🔑 BACKUP PHRASE (SAVE THIS SAFELY!):\n' +
                    `\`${result.mnemonic}\`\n\n` +
                    '⚠️ Write this down and store it safely. You\'ll need it to recover your wallet!\n\n' +
                    'Use /balance to check your balances.',
                    { parse_mode: 'Markdown' }
                );
            } else {
                await this.sendMessage(msg.chat.id,
                    '❌ Failed to create wallet: ' + (result.error || 'Unknown error') + '\n\n' +
                    'Please try again with /start'
                );
            }
        } catch (error) {
            this.logger.error('Wallet creation error:', error);
            await this.sendMessage(msg.chat.id,
                '❌ An error occurred while creating your wallet:\n' +
                error.message + '\n\n' +
                'Please try again with /start'
            );
        }

        this.userSessions.delete(msg.from.id);
    }

    async processRestoreMnemonic(msg, session) {
        const mnemonic = msg.text.trim();
        
        // Delete the mnemonic message for security
        try {
            await this.bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (error) {
            // Ignore deletion errors
        }

        if (!ValidationUtils.isValidMnemonic(mnemonic)) {
            await this.sendMessage(msg.chat.id, 
                '❌ Invalid backup phrase. Please enter 12 or 24 words.');
            return;
        }

        session.mnemonic = mnemonic;
        session.action = 'restore_wallet_password';
        this.userSessions.set(msg.from.id, session);

        await this.sendMessage(msg.chat.id, 
            '🔐 Now enter a password for your restored wallet:');
    }

    async processRestorePassword(msg, session) {
        const password = msg.text;
        
        // Delete the password message for security
        try {
            await this.bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (error) {
            // Ignore deletion errors
        }

        const passwordValidation = ValidationUtils.isValidPassword(password);
        if (!passwordValidation.valid) {
            await this.sendMessage(msg.chat.id, '❌ ' + passwordValidation.message);
            return;
        }

        const result = await this.wallet.restoreWallet(msg.from.id, session.mnemonic, password);
        
        if (result.success) {
            await this.sendMessage(msg.chat.id, 
                '✅ Wallet restored successfully!\n\n' +
                'Use /balance to check your balances.');
        }

        this.userSessions.delete(msg.from.id);
    }

    async processWithdraw(msg, session) {
        const password = msg.text;
        
        // Delete the password message for security
        try {
            await this.bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (error) {
            // Ignore deletion errors
        }

        const result = await this.wallet.sendTransaction(
            msg.from.id,
            session.address,
            session.amount,
            session.coin,
            password
        );

        if (result.success) {
            await this.sendMessage(session.chatId,
                `✅ Withdrawal successful!\n\n` +
                `💰 Amount: ${ValidationUtils.formatAmount(session.amount)} ${session.coin}\n` +
                `📍 To: \`${session.address}\`\n` +
                `🔗 TxID: \`${result.txid}\`\n` +
                `💸 Fee: ${ValidationUtils.formatAmount(result.fee)} ${session.coin}`,
                { parse_mode: 'Markdown' }
            );
        }

        this.userSessions.delete(msg.from.id);
    }

    async processJoinAirdrop(callbackQuery) {
        const userId = callbackQuery.from.id;
        const messageId = callbackQuery.message.message_id;
        const chatId = callbackQuery.message.chat.id;

        // Find the airdrop
        const airdrop = await this.db.get(
            'SELECT * FROM airdrops WHERE telegram_message_id = ? AND status = "active"',
            [messageId]
        );

        if (!airdrop) {
            await this.bot.answerCallbackQuery(callbackQuery.id, 
                { text: 'Airdrop not found or expired' });
            return;
        }

        // Check if airdrop is still active
        if (new Date() > new Date(airdrop.expires_at)) {
            await this.bot.answerCallbackQuery(callbackQuery.id, 
                { text: 'Airdrop has expired' });
            return;
        }

        // Ensure user exists and has wallet
        await this.ensureUser(callbackQuery);
        const hasWallet = await this.wallet.hasWallet(userId);
        
        if (!hasWallet) {
            await this.bot.answerCallbackQuery(callbackQuery.id, 
                { text: 'You need to create a wallet first (/start)' });
            return;
        }

        // Join airdrop
        const user = await this.db.getUserByTelegramId(userId);
        await this.db.joinAirdrop(airdrop.id, user.id);

        await this.bot.answerCallbackQuery(callbackQuery.id, 
            { text: 'Successfully joined the airdrop!' });
    }

    // Start the bot
    start() {
        this.logger.info('Telegram bot started');
        console.log('🚀 Community Tip Bot is now running!');
    }

    // Stop the bot
    stop() {
        this.bot.stopPolling();
        this.logger.info('Telegram bot stopped');
    }
}

module.exports = CommunityTipBot;