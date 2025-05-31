const CryptoUtils = require('../utils/crypto');
const ValidationUtils = require('../utils/validation');
const logger = require('../utils/logger');

class WalletManager {
    constructor(database, blockchainManager) {
        this.db = database;
        this.blockchain = blockchainManager;
        this.crypto = new CryptoUtils();
        this.logger = logger;
        this.supportedCoins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];
    }

    // Create a new wallet for a user using real blockchain wallets
    async createWallet(telegramId, password = null) {
        try {
            // Check if user already exists
            let user = await this.db.getUserByTelegramId(telegramId);
            
            if (user) {
                // Check if user already has wallets
                const existingWallets = await this.db.getUserWallets(user.id);
                if (existingWallets.length > 0) {
                    throw new Error('Wallet already exists for this user');
                }
            } else {
                // Create new user record
                await this.db.createUser(telegramId, null, null, null);
                user = await this.db.getUserByTelegramId(telegramId);
            }

            // Generate mnemonic for wallet recovery
            const mnemonic = this.crypto.generateMnemonic();
            this.logger.info(`Generated mnemonic for user ${telegramId}`);

            // Encrypt and store mnemonic if password provided
            let encryptedWallet = null;
            if (password) {
                const walletData = {
                    mnemonic: mnemonic,
                    telegramId: telegramId,
                    createdAt: new Date().toISOString()
                };
                encryptedWallet = this.crypto.encrypt(JSON.stringify(walletData), password);
                
                // Update user with encrypted wallet
                await this.db.updateUser(user.id, { encrypted_wallet: encryptedWallet });
                this.logger.info(`Encrypted wallet stored for user ${telegramId}`);
            }

            // Create real blockchain wallets for all supported coins
            const addresses = {};
            const walletResults = {};
            
            for (const coin of this.supportedCoins) {
                try {
                    if (this.blockchain.isCoinSupported(coin)) {
                        // Create real wallet on blockchain daemon
                        const walletData = await this.blockchain.createUserWallet(telegramId, coin);
                        addresses[coin] = walletData.address;
                        walletResults[coin] = walletData;
                        
                        // Store wallet info in database
                        await this.db.createWallet(user.id, coin, walletData.address, walletData.walletName);
                        
                        // Initialize balance
                        await this.db.updateBalance(user.id, coin, 0, 0);
                        
                        this.logger.info(`Created real ${coin} wallet for user ${telegramId}: ${walletData.address}`);
                    } else {
                        this.logger.warn(`${coin} blockchain not available, skipping wallet creation`);
                    }
                } catch (error) {
                    this.logger.error(`Failed to create ${coin} wallet for user ${telegramId}:`, error);
                    // Continue with other coins even if one fails
                }
            }

            if (Object.keys(addresses).length === 0) {
                throw new Error('Failed to create any wallets - no blockchain connections available');
            }

            this.logger.info(`Real blockchain wallets created successfully for user ${telegramId}:`, addresses);
            
            return {
                success: true,
                mnemonic: mnemonic,
                addresses,
                walletDetails: walletResults,
                message: 'Real blockchain wallets created successfully!',
                encrypted: !!password
            };

        } catch (error) {
            this.logger.error(`Wallet creation failed for user ${telegramId}:`, error);
            throw error;
        }
    }

    // Restore wallet from mnemonic
    async restoreWallet(telegramId, mnemonic, password) {
        try {
            // Validate inputs
            if (!ValidationUtils.isValidMnemonic(mnemonic)) {
                throw new Error('Invalid mnemonic phrase');
            }

            if (!this.crypto.validateMnemonic(mnemonic)) {
                throw new Error('Invalid mnemonic phrase');
            }

            const passwordValidation = ValidationUtils.isValidPassword(password);
            if (!passwordValidation.valid) {
                throw new Error(passwordValidation.message);
            }

            // Get or create user
            let user = await this.db.getUserByTelegramId(telegramId);
            if (!user) {
                await this.db.createUser(telegramId, null, null, null);
                user = await this.db.getUserByTelegramId(telegramId);
            }

            // Encrypt the mnemonic
            const encryptedSeed = this.crypto.encrypt(mnemonic, password);
            const salt = this.crypto.generateSalt();

            // Update user with encrypted seed
            await this.db.run(
                'UPDATE users SET encrypted_seed = ?, salt = ? WHERE id = ?',
                [encryptedSeed, salt, user.id]
            );

            // Create real blockchain wallets for all supported coins (no longer using crypto derivation)
            const addresses = {};
            for (const coin of this.supportedCoins) {
                try {
                    if (this.blockchain.isCoinSupported(coin)) {
                        // Create real wallet on blockchain daemon
                        const walletData = await this.blockchain.createUserWallet(telegramId, coin);
                        addresses[coin] = walletData.address;
                        
                        // Store wallet info in database
                        await this.db.createWallet(user.id, coin, walletData.address, walletData.labelName);
                        
                        // Initialize balance
                        await this.db.updateBalance(user.id, coin, 0, 0);
                        
                        this.logger.info(`Restored real ${coin} wallet for user ${telegramId}: ${walletData.address}`);
                    } else {
                        this.logger.warn(`${coin} blockchain not available, skipping wallet restoration`);
                    }
                } catch (error) {
                    this.logger.error(`Failed to restore ${coin} wallet for user ${telegramId}:`, error);
                }
            }

            this.logger.info(`Wallet restored successfully for user ${telegramId}`);
            
            return {
                success: true,
                addresses
            };

        } catch (error) {
            this.logger.error(`Wallet restoration failed for user ${telegramId}:`, error);
            throw error;
        }
    }

    // Get user's wallet addresses
    async getWalletAddresses(telegramId) {
        try {
            const user = await this.db.getUserByTelegramId(telegramId);
            if (!user) {
                throw new Error('User not found');
            }

            const wallets = await this.db.getUserWallets(user.id);
            const addresses = {};
            
            wallets.forEach(wallet => {
                addresses[wallet.coin_symbol] = wallet.address;
            });

            return addresses;
        } catch (error) {
            this.logger.error(`Failed to get wallet addresses for user ${telegramId}:`, error);
            throw error;
        }
    }

    // Get user balances from real blockchain wallets
    async getUserBalances(telegramId) {
        try {
            const user = await this.db.getUserByTelegramId(telegramId);
            if (!user) {
                throw new Error('User not found');
            }

            const result = {};
            
            // Get real balances from blockchain for each supported coin
            for (const coin of this.supportedCoins) {
                try {
                    if (this.blockchain.isCoinSupported(coin)) {
                        // Get real balance from blockchain daemon
                        const confirmedBalance = await this.blockchain.getUserWalletBalance(telegramId, coin);
                        
                        result[coin] = {
                            confirmed: confirmedBalance,
                            unconfirmed: 0, // TODO: Implement unconfirmed balance tracking
                            total: confirmedBalance
                        };
                        
                        // Update database with current balance
                        await this.db.updateBalance(user.id, coin, confirmedBalance, 0);
                    } else {
                        // Fallback to database balance if blockchain not available
                        const dbBalance = await this.db.getUserBalance(user.id, coin);
                        result[coin] = {
                            confirmed: dbBalance ? parseFloat(dbBalance.confirmed_balance) : 0,
                            unconfirmed: dbBalance ? parseFloat(dbBalance.unconfirmed_balance) : 0,
                            total: dbBalance ? parseFloat(dbBalance.confirmed_balance) + parseFloat(dbBalance.unconfirmed_balance) : 0
                        };
                    }
                } catch (error) {
                    this.logger.error(`Failed to get ${coin} balance for user ${telegramId}:`, error);
                    // Set zero balance if there's an error
                    result[coin] = {
                        confirmed: 0,
                        unconfirmed: 0,
                        total: 0
                    };
                }
            }

            return result;
        } catch (error) {
            this.logger.error(`Failed to get balances for user ${telegramId}:`, error);
            throw error;
        }
    }

    // Update user balance from blockchain
    async updateUserBalance(telegramId, coinSymbol) {
        try {
            const user = await this.db.getUserByTelegramId(telegramId);
            if (!user) {
                throw new Error('User not found');
            }

            const address = await this.db.getWalletAddress(user.id, coinSymbol);
            if (!address) {
                throw new Error(`No ${coinSymbol} wallet found for user`);
            }

            if (!this.blockchain.isCoinSupported(coinSymbol)) {
                this.logger.warn(`Blockchain not available for ${coinSymbol}`);
                return { confirmed: 0, unconfirmed: 0 };
            }

            // Get confirmed balance
            const confirmedBalance = await this.blockchain.getAddressBalance(address, coinSymbol, 1);
            
            // Get unconfirmed balance (0 confirmations minus confirmed)
            const totalBalance = await this.blockchain.getAddressBalance(address, coinSymbol, 0);
            const unconfirmedBalance = Math.max(0, totalBalance - confirmedBalance);

            // Update database
            await this.db.updateBalance(user.id, coinSymbol, confirmedBalance, unconfirmedBalance);

            this.logger.debug(`Balance updated for user ${telegramId} (${coinSymbol}):`, {
                confirmed: confirmedBalance,
                unconfirmed: unconfirmedBalance
            });

            return {
                confirmed: confirmedBalance,
                unconfirmed: unconfirmedBalance,
                total: confirmedBalance + unconfirmedBalance
            };

        } catch (error) {
            this.logger.error(`Failed to update balance for user ${telegramId} (${coinSymbol}):`, error);
            throw error;
        }
    }

    // Send transaction
    async sendTransaction(telegramId, toAddress, amount, coinSymbol, password) {
        try {
            // Validate inputs
            if (!ValidationUtils.isValidAddress(toAddress, coinSymbol)) {
                throw new Error('Invalid destination address');
            }

            if (!ValidationUtils.isValidAmount(amount)) {
                throw new Error('Invalid amount');
            }

            if (!ValidationUtils.isValidCoinSymbol(coinSymbol)) {
                throw new Error('Unsupported coin');
            }

            // Get user and decrypt wallet
            const user = await this.db.getUserByTelegramId(telegramId);
            if (!user || !user.encrypted_seed) {
                throw new Error('Wallet not found');
            }

            // Get user's wallet address from database
            const userWallet = await this.db.getUserWallet(user.id, coinSymbol);
            if (!userWallet) {
                throw new Error(`No ${coinSymbol} wallet found for user`);
            }

            // Check balance
            const balance = await this.getUserBalances(telegramId);
            if (balance[coinSymbol].confirmed < amount) {
                throw new Error('Insufficient confirmed balance');
            }

            // Send transaction via blockchain using real wallet
            const result = await this.blockchain.sendFromUserWallet(
                telegramId,
                toAddress,
                amount,
                coinSymbol
            );

            // Record transaction in database
            await this.db.createTransaction({
                txid: result.txid,
                fromUserId: user.id,
                toUserId: null, // External address
                coinSymbol: coinSymbol,
                amount: amount,
                fee: result.fee,
                transactionType: 'withdrawal',
                status: 'pending',
                telegramMessageId: null,
                groupId: null
            });

            // Update balance (subtract amount + fee)
            const newBalance = balance[coinSymbol].confirmed - amount - result.fee;
            await this.db.updateBalance(user.id, coinSymbol, newBalance, balance[coinSymbol].unconfirmed);

            this.logger.info(`Transaction sent successfully:`, {
                user: telegramId,
                txid: result.txid,
                amount,
                coinSymbol,
                to: toAddress
            });

            return result;

        } catch (error) {
            this.logger.error(`Transaction failed for user ${telegramId}:`, error);
            throw error;
        }
    }

    // Internal transfer between users
    async transferBetweenUsers(fromTelegramId, toTelegramId, amount, coinSymbol, transactionType = 'tip') {
        try {
            // Validate inputs
            if (!ValidationUtils.isValidAmount(amount)) {
                throw new Error('Invalid amount');
            }

            if (!ValidationUtils.isValidCoinSymbol(coinSymbol)) {
                throw new Error('Unsupported coin');
            }

            // Get users
            const fromUser = await this.db.getUserByTelegramId(fromTelegramId);
            const toUser = await this.db.getUserByTelegramId(toTelegramId);

            if (!fromUser || !toUser) {
                throw new Error('User not found');
            }

            // Check sender balance
            const fromBalance = await this.db.getUserBalance(fromUser.id, coinSymbol);
            if (fromBalance.confirmed_balance < amount) {
                throw new Error('Insufficient balance');
            }

            // Start transaction
            await this.db.beginTransaction();

            try {
                // Update balances
                const newFromBalance = fromBalance.confirmed_balance - amount;
                await this.db.updateBalance(fromUser.id, coinSymbol, newFromBalance, fromBalance.unconfirmed_balance);

                const toBalance = await this.db.getUserBalance(toUser.id, coinSymbol);
                const newToBalance = toBalance.confirmed_balance + amount;
                await this.db.updateBalance(toUser.id, coinSymbol, newToBalance, toBalance.unconfirmed_balance);

                // Record transaction
                const txResult = await this.db.createTransaction({
                    txid: null, // Internal transfer
                    fromUserId: fromUser.id,
                    toUserId: toUser.id,
                    coinSymbol: coinSymbol,
                    amount: amount,
                    fee: 0,
                    transactionType: transactionType,
                    status: 'confirmed',
                    telegramMessageId: null,
                    groupId: null
                });

                await this.db.commit();

                this.logger.info(`Internal transfer completed:`, {
                    from: fromTelegramId,
                    to: toTelegramId,
                    amount,
                    coinSymbol,
                    type: transactionType
                });

                return {
                    success: true,
                    transactionId: txResult.id,
                    amount,
                    coinSymbol
                };

            } catch (error) {
                await this.db.rollback();
                throw error;
            }

        } catch (error) {
            this.logger.error(`Internal transfer failed:`, error);
            throw error;
        }
    }

    // Get transaction history
    async getTransactionHistory(telegramId, limit = 10) {
        try {
            const user = await this.db.getUserByTelegramId(telegramId);
            if (!user) {
                throw new Error('User not found');
            }

            const transactions = await this.db.getUserTransactions(user.id, limit);
            
            // Format transactions for display
            return transactions.map(tx => ({
                id: tx.id,
                txid: tx.txid,
                type: tx.transaction_type,
                coin: tx.coin_symbol,
                amount: parseFloat(tx.amount),
                fee: parseFloat(tx.fee),
                status: tx.status,
                date: tx.created_at,
                direction: tx.from_user_id === user.id ? 'sent' : 'received'
            }));

        } catch (error) {
            this.logger.error(`Failed to get transaction history for user ${telegramId}:`, error);
            throw error;
        }
    }

    // Check if user has wallet
    async hasWallet(telegramId) {
        try {
            const user = await this.db.getUserByTelegramId(telegramId);
            return user && user.encrypted_seed ? true : false;
        } catch (error) {
            this.logger.error(`Failed to check wallet for user ${telegramId}:`, error);
            return false;
        }
    }

    // Verify user password
    async verifyPassword(telegramId, password) {
        try {
            const user = await this.db.getUserByTelegramId(telegramId);
            if (!user || !user.encrypted_seed) {
                return false;
            }

            try {
                const mnemonic = this.crypto.decrypt(user.encrypted_seed, password);
                return this.crypto.validateMnemonic(mnemonic);
            } catch (error) {
                return false;
            }
        } catch (error) {
            this.logger.error(`Password verification failed for user ${telegramId}:`, error);
            return false;
        }
    }

    // Create wallet backup
    async createBackup(telegramId, password) {
        try {
            const user = await this.db.getUserByTelegramId(telegramId);
            if (!user || !user.encrypted_seed) {
                throw new Error('Wallet not found');
            }

            const mnemonic = this.crypto.decrypt(user.encrypted_seed, password);
            if (!mnemonic) {
                throw new Error('Invalid password');
            }

            return this.crypto.createWalletBackup(mnemonic, password);
        } catch (error) {
            this.logger.error(`Backup creation failed for user ${telegramId}:`, error);
            throw error;
        }
    }

    // Get supported coins
    getSupportedCoins() {
        return this.supportedCoins;
    }
}

module.exports = WalletManager;