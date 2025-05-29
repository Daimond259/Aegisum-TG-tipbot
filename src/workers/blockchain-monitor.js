const logger = require('../utils/logger');
const ValidationUtils = require('../utils/validation');

class BlockchainMonitor {
    constructor(database, blockchainManager, walletManager) {
        this.db = database;
        this.blockchain = blockchainManager;
        this.wallet = walletManager;
        this.logger = logger;
        this.isRunning = false;
        this.monitorInterval = 30000; // 30 seconds
        this.supportedCoins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Blockchain monitor is already running');
            return;
        }

        this.isRunning = true;
        this.logger.info('Starting blockchain monitor...');

        // Start monitoring each supported coin
        for (const coin of this.supportedCoins) {
            if (this.blockchain.isCoinSupported(coin)) {
                this.monitorCoin(coin);
            } else {
                this.logger.warn(`Skipping ${coin} - blockchain not available`);
            }
        }
    }

    async stop() {
        this.isRunning = false;
        this.logger.info('Stopping blockchain monitor...');
    }

    async monitorCoin(coinSymbol) {
        const monitor = async () => {
            if (!this.isRunning) return;

            try {
                await this.syncBlocks(coinSymbol);
                await this.updateUserBalances(coinSymbol);
                await this.checkPendingTransactions(coinSymbol);
            } catch (error) {
                this.logger.error(`Monitor error for ${coinSymbol}:`, error);
            }

            // Schedule next check
            if (this.isRunning) {
                setTimeout(monitor, this.monitorInterval);
            }
        };

        // Start monitoring
        monitor();
    }

    async syncBlocks(coinSymbol) {
        try {
            // Get current blockchain height
            const currentHeight = await this.blockchain.getBlockHeight(coinSymbol);
            
            // Get last synced height from database
            const syncStatus = await this.db.get(
                'SELECT last_block_height FROM sync_status WHERE coin_symbol = ?',
                [coinSymbol]
            );

            const lastSyncedHeight = syncStatus ? syncStatus.last_block_height : 0;
            
            if (currentHeight <= lastSyncedHeight) {
                // No new blocks
                return;
            }

            this.logger.info(`Syncing ${coinSymbol} blocks ${lastSyncedHeight + 1} to ${currentHeight}`);

            // Process new blocks
            for (let height = lastSyncedHeight + 1; height <= currentHeight; height++) {
                await this.processBlock(coinSymbol, height);
                
                // Update sync status
                await this.db.run(
                    `UPDATE sync_status 
                     SET last_block_height = ?, last_sync_time = CURRENT_TIMESTAMP 
                     WHERE coin_symbol = ?`,
                    [height, coinSymbol]
                );

                // Don't process too many blocks at once
                if (height - lastSyncedHeight > 10) {
                    this.logger.info(`Processed 10 blocks for ${coinSymbol}, continuing in next cycle`);
                    break;
                }
            }

        } catch (error) {
            this.logger.error(`Block sync error for ${coinSymbol}:`, error);
        }
    }

    async processBlock(coinSymbol, height) {
        try {
            const client = this.blockchain.getClient(coinSymbol);
            const blockHash = await client.getBlockHash(height);
            const block = await client.getBlock(blockHash, 2); // Get full transaction details

            if (!block || !block.tx) {
                return;
            }

            // Process each transaction in the block
            for (const tx of block.tx) {
                await this.processTransaction(coinSymbol, tx, height);
            }

        } catch (error) {
            this.logger.error(`Block processing error for ${coinSymbol} at height ${height}:`, error);
        }
    }

    async processTransaction(coinSymbol, tx, blockHeight) {
        try {
            if (!tx.vout || tx.vout.length === 0) {
                return;
            }

            // Check each output for addresses we're monitoring
            for (const vout of tx.vout) {
                if (!vout.scriptPubKey || !vout.scriptPubKey.addresses) {
                    continue;
                }

                for (const address of vout.scriptPubKey.addresses) {
                    await this.processAddressTransaction(
                        coinSymbol,
                        address,
                        tx.txid,
                        vout.value,
                        blockHeight,
                        'deposit'
                    );
                }
            }

        } catch (error) {
            this.logger.error(`Transaction processing error for ${coinSymbol}:`, error);
        }
    }

    async processAddressTransaction(coinSymbol, address, txid, amount, blockHeight, type) {
        try {
            // Find user with this address
            const wallet = await this.db.get(
                'SELECT * FROM wallets WHERE address = ? AND coin_symbol = ?',
                [address, coinSymbol]
            );

            if (!wallet) {
                return; // Not our address
            }

            // Check if we already processed this transaction
            const existingTx = await this.db.get(
                'SELECT * FROM transactions WHERE txid = ? AND to_user_id = ?',
                [txid, wallet.user_id]
            );

            if (existingTx) {
                // Update confirmation status if needed
                if (existingTx.status === 'pending' && blockHeight) {
                    await this.db.updateTransactionStatus(
                        existingTx.id,
                        'confirmed',
                        txid,
                        blockHeight
                    );
                }
                return;
            }

            // Record new deposit transaction
            await this.db.createTransaction({
                txid: txid,
                fromUserId: null, // External deposit
                toUserId: wallet.user_id,
                coinSymbol: coinSymbol,
                amount: amount,
                fee: 0,
                transactionType: type,
                status: blockHeight ? 'confirmed' : 'pending',
                telegramMessageId: null,
                groupId: null
            });

            this.logger.info(`New ${type} detected:`, {
                coinSymbol,
                address,
                amount,
                txid,
                userId: wallet.user_id
            });

            // Update user balance will be handled by updateUserBalances

        } catch (error) {
            this.logger.error(`Address transaction processing error:`, error);
        }
    }

    async updateUserBalances(coinSymbol) {
        try {
            // Get all wallets for this coin
            const wallets = await this.db.all(
                'SELECT * FROM wallets WHERE coin_symbol = ?',
                [coinSymbol]
            );

            for (const wallet of wallets) {
                try {
                    // Get current balance from blockchain
                    const confirmedBalance = await this.blockchain.getAddressBalance(
                        wallet.address,
                        coinSymbol,
                        1 // 1 confirmation
                    );

                    const totalBalance = await this.blockchain.getAddressBalance(
                        wallet.address,
                        coinSymbol,
                        0 // 0 confirmations
                    );

                    const unconfirmedBalance = Math.max(0, totalBalance - confirmedBalance);

                    // Update database balance
                    await this.db.updateBalance(
                        wallet.user_id,
                        coinSymbol,
                        confirmedBalance,
                        unconfirmedBalance
                    );

                } catch (error) {
                    this.logger.error(`Balance update error for wallet ${wallet.address}:`, error);
                }
            }

        } catch (error) {
            this.logger.error(`User balance update error for ${coinSymbol}:`, error);
        }
    }

    async checkPendingTransactions(coinSymbol) {
        try {
            // Get pending transactions for this coin
            const pendingTxs = await this.db.all(
                'SELECT * FROM transactions WHERE coin_symbol = ? AND status = "pending" AND txid IS NOT NULL',
                [coinSymbol]
            );

            for (const tx of pendingTxs) {
                try {
                    const isConfirmed = await this.blockchain.isTransactionConfirmed(
                        tx.txid,
                        coinSymbol,
                        1 // Require 1 confirmation
                    );

                    if (isConfirmed) {
                        // Get transaction details to find block height
                        const txDetails = await this.blockchain.getTransaction(tx.txid, coinSymbol);
                        const blockHeight = txDetails ? txDetails.blockheight : null;

                        await this.db.updateTransactionStatus(
                            tx.id,
                            'confirmed',
                            tx.txid,
                            blockHeight
                        );

                        this.logger.info(`Transaction confirmed:`, {
                            txid: tx.txid,
                            coinSymbol,
                            amount: tx.amount
                        });
                    }

                } catch (error) {
                    this.logger.error(`Pending transaction check error for ${tx.txid}:`, error);
                }
            }

        } catch (error) {
            this.logger.error(`Pending transactions check error for ${coinSymbol}:`, error);
        }
    }

    // Manual balance refresh for a specific user
    async refreshUserBalance(telegramId, coinSymbol) {
        try {
            const user = await this.db.getUserByTelegramId(telegramId);
            if (!user) {
                throw new Error('User not found');
            }

            const address = await this.db.getWalletAddress(user.id, coinSymbol);
            if (!address) {
                throw new Error(`No ${coinSymbol} wallet found for user`);
            }

            // Get balance from blockchain
            const confirmedBalance = await this.blockchain.getAddressBalance(address, coinSymbol, 1);
            const totalBalance = await this.blockchain.getAddressBalance(address, coinSymbol, 0);
            const unconfirmedBalance = Math.max(0, totalBalance - confirmedBalance);

            // Update database
            await this.db.updateBalance(user.id, coinSymbol, confirmedBalance, unconfirmedBalance);

            this.logger.info(`Manual balance refresh completed:`, {
                telegramId,
                coinSymbol,
                address,
                confirmed: confirmedBalance,
                unconfirmed: unconfirmedBalance
            });

            return {
                confirmed: confirmedBalance,
                unconfirmed: unconfirmedBalance,
                total: confirmedBalance + unconfirmedBalance
            };

        } catch (error) {
            this.logger.error(`Manual balance refresh error:`, error);
            throw error;
        }
    }

    // Get monitoring statistics
    async getMonitoringStats() {
        try {
            const stats = {};

            for (const coin of this.supportedCoins) {
                if (!this.blockchain.isCoinSupported(coin)) {
                    stats[coin] = { available: false };
                    continue;
                }

                const syncStatus = await this.db.get(
                    'SELECT * FROM sync_status WHERE coin_symbol = ?',
                    [coin]
                );

                const currentHeight = await this.blockchain.getBlockHeight(coin);
                const lastSyncedHeight = syncStatus ? syncStatus.last_block_height : 0;
                const lastSyncTime = syncStatus ? syncStatus.last_sync_time : null;

                stats[coin] = {
                    available: true,
                    currentHeight,
                    lastSyncedHeight,
                    blocksBehind: Math.max(0, currentHeight - lastSyncedHeight),
                    lastSyncTime,
                    synced: currentHeight === lastSyncedHeight
                };
            }

            return stats;

        } catch (error) {
            this.logger.error('Failed to get monitoring stats:', error);
            throw error;
        }
    }

    // Force sync for a specific coin
    async forceSyncCoin(coinSymbol) {
        try {
            if (!this.blockchain.isCoinSupported(coinSymbol)) {
                throw new Error(`${coinSymbol} blockchain not available`);
            }

            this.logger.info(`Force syncing ${coinSymbol}...`);
            await this.syncBlocks(coinSymbol);
            await this.updateUserBalances(coinSymbol);
            await this.checkPendingTransactions(coinSymbol);

            this.logger.info(`Force sync completed for ${coinSymbol}`);

        } catch (error) {
            this.logger.error(`Force sync error for ${coinSymbol}:`, error);
            throw error;
        }
    }
}

module.exports = BlockchainMonitor;