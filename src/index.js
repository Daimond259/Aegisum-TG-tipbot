require('dotenv').config();

const Database = require('./database/database');
const BlockchainManager = require('./blockchain/blockchain-manager');
const WalletManager = require('./wallet/wallet-manager');
const CommunityTipBot = require('./bot/telegram-bot');
const WorkerManager = require('./workers');
const ValidationUtils = require('./utils/validation');
const logger = require('./utils/logger');

class CommunityTipBotApp {
    constructor() {
        this.db = null;
        this.blockchain = null;
        this.wallet = null;
        this.bot = null;
        this.workers = null;
        this.isRunning = false;
    }

    async initialize() {
        try {
            logger.info('Initializing Community Tip Bot...');

            // Validate environment variables
            ValidationUtils.validateEnvironment();

            // Initialize database
            logger.info('Connecting to database...');
            this.db = new Database();
            await this.db.connect();

            // Initialize blockchain manager
            logger.info('Initializing blockchain connections...');
            this.blockchain = new BlockchainManager();
            
            // Test blockchain connections
            const connectionResults = await this.blockchain.testConnections();
            const connectedCoins = Object.entries(connectionResults)
                .filter(([coin, status]) => status.connected)
                .map(([coin]) => coin);
            
            if (connectedCoins.length === 0) {
                logger.warn('No blockchain connections available - bot will run in limited mode');
            } else {
                logger.info(`Connected to blockchains: ${connectedCoins.join(', ')}`);
            }

            // Initialize wallet manager
            logger.info('Initializing wallet manager...');
            this.wallet = new WalletManager(this.db, this.blockchain);

            // Initialize Telegram bot
            logger.info('Initializing Telegram bot...');
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (!botToken) {
                throw new Error('TELEGRAM_BOT_TOKEN is required');
            }
            
            this.bot = new CommunityTipBot(botToken, this.db, this.wallet, this.blockchain);

            // Initialize workers
            logger.info('Initializing background workers...');
            this.workers = new WorkerManager(this.db, this.blockchain, this.wallet, this.bot);

            logger.info('Aegisum Tip Bot initialized successfully');

        } catch (error) {
            logger.error('Initialization failed:', error);
            throw error;
        }
    }

    async start() {
        try {
            if (this.isRunning) {
                logger.warn('Bot is already running');
                return;
            }

            logger.info('Starting Aegisum Tip Bot...');

            // Start Telegram bot
            this.bot.start();

            // Start background workers
            await this.workers.start();

            this.isRunning = true;

            // Setup graceful shutdown
            this.setupGracefulShutdown();

            logger.info('🚀 Community Tip Bot is now running!');
            console.log('🤖 Bot is active and monitoring...');
            console.log('📊 Use Ctrl+C to stop gracefully');

            // Log initial status
            await this.logStatus();

        } catch (error) {
            logger.error('Failed to start bot:', error);
            throw error;
        }
    }

    async stop() {
        try {
            if (!this.isRunning) {
                return;
            }

            logger.info('Stopping Community Tip Bot...');

            this.isRunning = false;

            // Stop workers
            if (this.workers) {
                await this.workers.stop();
            }

            // Stop Telegram bot
            if (this.bot) {
                this.bot.stop();
            }

            // Close database connection
            if (this.db) {
                await this.db.close();
            }

            logger.info('Community Tip Bot stopped successfully');

        } catch (error) {
            logger.error('Error during shutdown:', error);
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            shutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }

    async logStatus() {
        try {
            const status = await this.getStatus();
            logger.info('Bot status:', status);
        } catch (error) {
            logger.error('Failed to get status:', error);
        }
    }

    async getStatus() {
        try {
            const status = {
                running: this.isRunning,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: require('../package.json').version
            };

            if (this.workers) {
                status.workers = await this.workers.getStatus();
            }

            if (this.blockchain) {
                status.blockchain = await this.blockchain.testConnections();
            }

            return status;

        } catch (error) {
            logger.error('Failed to get status:', error);
            return { error: error.message };
        }
    }

    async healthCheck() {
        try {
            if (!this.isRunning) {
                return { status: 'stopped', healthy: false };
            }

            const health = await this.workers.healthCheck();
            return health;

        } catch (error) {
            logger.error('Health check failed:', error);
            return { status: 'error', healthy: false, error: error.message };
        }
    }

    // Admin methods
    async refreshUserBalance(telegramId, coinSymbol) {
        if (!this.workers) {
            throw new Error('Workers not initialized');
        }
        return this.workers.refreshUserBalance(telegramId, coinSymbol);
    }

    async forceSyncCoin(coinSymbol) {
        if (!this.workers) {
            throw new Error('Workers not initialized');
        }
        return this.workers.forceSyncCoin(coinSymbol);
    }

    async getDetailedStats() {
        if (!this.workers) {
            throw new Error('Workers not initialized');
        }
        return this.workers.getDetailedStats();
    }
}

// Create and start the bot if this file is run directly
if (require.main === module) {
    const bot = new CommunityTipBotApp();
    
    bot.initialize()
        .then(() => bot.start())
        .catch((error) => {
            console.error('Failed to start bot:', error);
            process.exit(1);
        });
}

module.exports = CommunityTipBotApp;