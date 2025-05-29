const BlockchainMonitor = require('./blockchain-monitor');
const AirdropManager = require('./airdrop-manager');
const logger = require('../utils/logger');

class WorkerManager {
    constructor(database, blockchainManager, walletManager, telegramBot) {
        this.db = database;
        this.blockchain = blockchainManager;
        this.wallet = walletManager;
        this.bot = telegramBot;
        this.logger = logger;

        // Initialize workers
        this.blockchainMonitor = new BlockchainMonitor(database, blockchainManager, walletManager);
        this.airdropManager = new AirdropManager(database, walletManager, telegramBot);

        this.isRunning = false;
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Worker manager is already running');
            return;
        }

        this.isRunning = true;
        this.logger.info('Starting worker manager...');

        try {
            // Start blockchain monitor
            await this.blockchainMonitor.start();
            
            // Start airdrop manager
            await this.airdropManager.start();

            this.logger.info('All workers started successfully');

        } catch (error) {
            this.logger.error('Failed to start workers:', error);
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        this.logger.info('Stopping worker manager...');

        try {
            // Stop all workers
            await this.blockchainMonitor.stop();
            await this.airdropManager.stop();

            this.logger.info('All workers stopped successfully');

        } catch (error) {
            this.logger.error('Error stopping workers:', error);
        }
    }

    // Get status of all workers
    async getStatus() {
        try {
            const status = {
                running: this.isRunning,
                blockchainMonitor: {
                    running: this.blockchainMonitor.isRunning,
                    stats: await this.blockchainMonitor.getMonitoringStats()
                },
                airdropManager: {
                    running: this.airdropManager.isRunning,
                    stats: await this.airdropManager.getAirdropStats()
                }
            };

            return status;

        } catch (error) {
            this.logger.error('Failed to get worker status:', error);
            throw error;
        }
    }

    // Force refresh balance for a user
    async refreshUserBalance(telegramId, coinSymbol) {
        return this.blockchainMonitor.refreshUserBalance(telegramId, coinSymbol);
    }

    // Force sync for a specific coin
    async forceSyncCoin(coinSymbol) {
        return this.blockchainMonitor.forceSyncCoin(coinSymbol);
    }

    // Manually complete an airdrop
    async completeAirdrop(airdropId) {
        return this.airdropManager.manuallyCompleteAirdrop(airdropId);
    }

    // Manually cancel an airdrop
    async cancelAirdrop(airdropId, reason) {
        return this.airdropManager.manuallyCancelAirdrop(airdropId, reason);
    }

    // Health check for all workers
    async healthCheck() {
        const health = {
            overall: 'healthy',
            workers: {},
            timestamp: new Date().toISOString()
        };

        try {
            // Check blockchain monitor
            health.workers.blockchainMonitor = {
                status: this.blockchainMonitor.isRunning ? 'running' : 'stopped',
                healthy: this.blockchainMonitor.isRunning
            };

            // Check airdrop manager
            health.workers.airdropManager = {
                status: this.airdropManager.isRunning ? 'running' : 'stopped',
                healthy: this.airdropManager.isRunning
            };

            // Check blockchain connections
            const blockchainStatus = await this.blockchain.testConnections();
            health.blockchain = blockchainStatus;

            // Determine overall health
            const allWorkersHealthy = Object.values(health.workers).every(w => w.healthy);
            const anyBlockchainConnected = Object.values(blockchainStatus).some(b => b.connected);

            if (!allWorkersHealthy) {
                health.overall = 'degraded';
            } else if (!anyBlockchainConnected) {
                health.overall = 'warning';
            }

        } catch (error) {
            health.overall = 'unhealthy';
            health.error = error.message;
            this.logger.error('Health check failed:', error);
        }

        return health;
    }

    // Restart all workers
    async restart() {
        this.logger.info('Restarting all workers...');
        
        await this.stop();
        
        // Wait a moment before restarting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await this.start();
        
        this.logger.info('All workers restarted');
    }

    // Get detailed statistics
    async getDetailedStats() {
        try {
            const stats = {
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                workers: await this.getStatus()
            };

            // Add database statistics
            const dbStats = await this.getDatabaseStats();
            stats.database = dbStats;

            return stats;

        } catch (error) {
            this.logger.error('Failed to get detailed stats:', error);
            throw error;
        }
    }

    async getDatabaseStats() {
        try {
            const stats = {};

            // User statistics
            const userCount = await this.db.get('SELECT COUNT(*) as count FROM users');
            stats.totalUsers = userCount.count;

            const activeUsers = await this.db.get(`
                SELECT COUNT(*) as count FROM users 
                WHERE last_activity > datetime('now', '-24 hours')
            `);
            stats.activeUsersToday = activeUsers.count;

            // Transaction statistics
            const totalTxs = await this.db.get('SELECT COUNT(*) as count FROM transactions');
            stats.totalTransactions = totalTxs.count;

            const todayTxs = await this.db.get(`
                SELECT COUNT(*) as count FROM transactions 
                WHERE created_at > datetime('now', '-24 hours')
            `);
            stats.transactionsToday = todayTxs.count;

            // Balance statistics
            const totalBalances = await this.db.all(`
                SELECT coin_symbol, SUM(confirmed_balance) as total 
                FROM balances 
                GROUP BY coin_symbol
            `);
            stats.totalBalances = {};
            totalBalances.forEach(balance => {
                stats.totalBalances[balance.coin_symbol] = parseFloat(balance.total);
            });

            // Airdrop statistics
            const totalAirdrops = await this.db.get('SELECT COUNT(*) as count FROM airdrops');
            stats.totalAirdrops = totalAirdrops.count;

            const activeAirdrops = await this.db.get(`
                SELECT COUNT(*) as count FROM airdrops 
                WHERE status = 'active'
            `);
            stats.activeAirdrops = activeAirdrops.count;

            return stats;

        } catch (error) {
            this.logger.error('Failed to get database stats:', error);
            return {};
        }
    }
}

module.exports = WorkerManager;