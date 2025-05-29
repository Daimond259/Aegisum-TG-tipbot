const RPCClient = require('./rpc-client');
const logger = require('../utils/logger');
const ValidationUtils = require('../utils/validation');

class BlockchainManager {
    constructor() {
        this.clients = new Map();
        this.supportedCoins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];
        this.logger = logger;
        this.initializeClients();
    }

    initializeClients() {
        this.supportedCoins.forEach(coin => {
            try {
                const config = {
                    host: process.env[`${coin}_RPC_HOST`] || '127.0.0.1',
                    port: process.env[`${coin}_RPC_PORT`],
                    username: process.env[`${coin}_RPC_USER`],
                    password: process.env[`${coin}_RPC_PASS`],
                    coinSymbol: coin,
                    timeout: 30000
                };

                if (!config.port || !config.username || !config.password) {
                    this.logger.warn(`Incomplete RPC configuration for ${coin}, skipping`);
                    return;
                }

                const client = new RPCClient(config);
                this.clients.set(coin, client);
                this.logger.info(`RPC client initialized for ${coin}`);
            } catch (error) {
                this.logger.error(`Failed to initialize RPC client for ${coin}:`, error);
            }
        });
    }

    getClient(coinSymbol) {
        const client = this.clients.get(coinSymbol.toUpperCase());
        if (!client) {
            throw new Error(`No RPC client available for ${coinSymbol}`);
        }
        return client;
    }

    async testConnections() {
        const results = {};
        
        for (const [coin, client] of this.clients) {
            try {
                const isConnected = await client.isConnected();
                results[coin] = {
                    connected: isConnected,
                    error: null
                };
                
                if (isConnected) {
                    const info = await client.getBlockchainInfo();
                    results[coin].blockHeight = info.blocks;
                    results[coin].network = info.chain;
                }
            } catch (error) {
                results[coin] = {
                    connected: false,
                    error: error.message
                };
            }
        }
        
        return results;
    }

    // Address validation
    async validateAddress(address, coinSymbol) {
        try {
            const client = this.getClient(coinSymbol);
            const result = await client.validateAddress(address);
            return result.isvalid || false;
        } catch (error) {
            this.logger.error(`Address validation failed for ${coinSymbol}:`, error);
            return false;
        }
    }

    // Get balance for an address
    async getAddressBalance(address, coinSymbol, minConfirmations = 1) {
        try {
            const client = this.getClient(coinSymbol);
            const balance = await client.getReceivedByAddress(address, minConfirmations);
            return parseFloat(balance) || 0;
        } catch (error) {
            this.logger.error(`Failed to get balance for ${address} (${coinSymbol}):`, error);
            return 0;
        }
    }

    // Get unspent outputs for an address
    async getAddressUTXOs(address, coinSymbol, minConfirmations = 1) {
        try {
            const client = this.getClient(coinSymbol);
            const utxos = await client.listUnspent(minConfirmations, 9999999, [address]);
            return utxos || [];
        } catch (error) {
            this.logger.error(`Failed to get UTXOs for ${address} (${coinSymbol}):`, error);
            return [];
        }
    }

    // Send transaction
    async sendTransaction(fromAddress, toAddress, amount, coinSymbol, privateKey = null) {
        try {
            const client = this.getClient(coinSymbol);
            
            // Validate addresses
            const fromValid = await this.validateAddress(fromAddress, coinSymbol);
            const toValid = await this.validateAddress(toAddress, coinSymbol);
            
            if (!fromValid || !toValid) {
                throw new Error('Invalid address provided');
            }

            // Get UTXOs for the from address
            const utxos = await this.getAddressUTXOs(fromAddress, coinSymbol);
            
            if (utxos.length === 0) {
                throw new Error('No unspent outputs available');
            }

            // Calculate total available
            const totalAvailable = utxos.reduce((sum, utxo) => sum + utxo.amount, 0);
            
            // Estimate fee
            const estimatedFee = await client.estimateSmartFee();
            const fee = Math.max(estimatedFee, 0.001); // Minimum fee
            
            const totalNeeded = amount + fee;
            
            if (totalAvailable < totalNeeded) {
                throw new Error(`Insufficient funds. Available: ${totalAvailable}, Needed: ${totalNeeded}`);
            }

            // Select UTXOs to use
            let selectedUTXOs = [];
            let selectedAmount = 0;
            
            for (const utxo of utxos) {
                selectedUTXOs.push({
                    txid: utxo.txid,
                    vout: utxo.vout
                });
                selectedAmount += utxo.amount;
                
                if (selectedAmount >= totalNeeded) {
                    break;
                }
            }

            // Create outputs
            const outputs = {};
            outputs[toAddress] = amount;
            
            // Add change output if necessary
            const change = selectedAmount - totalNeeded;
            if (change > 0.00001) { // Only add change if it's significant
                outputs[fromAddress] = change;
            }

            // Create and sign transaction
            const rawTx = await client.createRawTransaction(selectedUTXOs, outputs);
            
            let signedTx;
            if (privateKey) {
                // Sign with provided private key
                signedTx = await client.signRawTransaction(rawTx, [], [privateKey]);
            } else {
                // Sign with wallet (requires unlocked wallet)
                signedTx = await client.signRawTransaction(rawTx);
            }

            if (!signedTx.complete) {
                throw new Error('Transaction signing failed');
            }

            // Broadcast transaction
            const txid = await client.sendRawTransaction(signedTx.hex);
            
            this.logger.info(`Transaction sent successfully:`, {
                coinSymbol,
                txid,
                from: fromAddress,
                to: toAddress,
                amount,
                fee
            });

            return {
                txid,
                fee,
                amount,
                success: true
            };

        } catch (error) {
            this.logger.error(`Transaction failed for ${coinSymbol}:`, error);
            throw error;
        }
    }

    // Get transaction details
    async getTransaction(txid, coinSymbol) {
        try {
            const client = this.getClient(coinSymbol);
            const tx = await client.getTransaction(txid);
            return tx;
        } catch (error) {
            this.logger.error(`Failed to get transaction ${txid} for ${coinSymbol}:`, error);
            return null;
        }
    }

    // Get current block height
    async getBlockHeight(coinSymbol) {
        try {
            const client = this.getClient(coinSymbol);
            return await client.getBlockCount();
        } catch (error) {
            this.logger.error(`Failed to get block height for ${coinSymbol}:`, error);
            return 0;
        }
    }

    // Monitor address for new transactions
    async getAddressTransactions(address, coinSymbol, limit = 10) {
        try {
            const client = this.getClient(coinSymbol);
            
            // Try to get address-specific transactions if supported
            try {
                return await client.getAddressTransactions(address, limit);
            } catch (error) {
                // Fallback: get all wallet transactions and filter
                const allTxs = await client.listTransactions('*', limit * 2);
                return allTxs.filter(tx => 
                    tx.address === address || 
                    (tx.details && tx.details.some(detail => detail.address === address))
                ).slice(0, limit);
            }
        } catch (error) {
            this.logger.error(`Failed to get transactions for ${address} (${coinSymbol}):`, error);
            return [];
        }
    }

    // Import address for monitoring
    async importAddress(address, coinSymbol, label = 'tipbot') {
        try {
            const client = this.getClient(coinSymbol);
            await client.importAddress(address, label, false); // Don't rescan for performance
            this.logger.info(`Address imported for monitoring:`, { address, coinSymbol });
            return true;
        } catch (error) {
            this.logger.error(`Failed to import address ${address} for ${coinSymbol}:`, error);
            return false;
        }
    }

    // Get network fee estimate
    async getFeeEstimate(coinSymbol, blocks = 6) {
        try {
            const client = this.getClient(coinSymbol);
            return await client.estimateSmartFee(blocks);
        } catch (error) {
            this.logger.warn(`Fee estimation failed for ${coinSymbol}, using default`);
            return 0.001;
        }
    }

    // Check if transaction is confirmed
    async isTransactionConfirmed(txid, coinSymbol, requiredConfirmations = 1) {
        try {
            const tx = await this.getTransaction(txid, coinSymbol);
            return tx && tx.confirmations >= requiredConfirmations;
        } catch (error) {
            this.logger.error(`Failed to check confirmation for ${txid} (${coinSymbol}):`, error);
            return false;
        }
    }

    // Get blockchain synchronization status
    async getSyncStatus(coinSymbol) {
        try {
            const client = this.getClient(coinSymbol);
            const info = await client.getBlockchainInfo();
            
            return {
                blocks: info.blocks,
                headers: info.headers,
                synced: info.blocks === info.headers,
                syncProgress: info.verificationprogress || 1,
                chain: info.chain
            };
        } catch (error) {
            this.logger.error(`Failed to get sync status for ${coinSymbol}:`, error);
            return null;
        }
    }

    // Batch transaction sending (for rain/airdrops)
    async sendBatchTransactions(transactions, coinSymbol) {
        const results = [];
        
        for (const tx of transactions) {
            try {
                const result = await this.sendTransaction(
                    tx.fromAddress,
                    tx.toAddress,
                    tx.amount,
                    coinSymbol,
                    tx.privateKey
                );
                results.push({ ...tx, ...result, success: true });
            } catch (error) {
                this.logger.error(`Batch transaction failed:`, { tx, error: error.message });
                results.push({ ...tx, success: false, error: error.message });
            }
        }
        
        return results;
    }

    // Get supported coins
    getSupportedCoins() {
        return Array.from(this.clients.keys());
    }

    // Check if coin is supported
    isCoinSupported(coinSymbol) {
        return this.clients.has(coinSymbol.toUpperCase());
    }
}

module.exports = BlockchainManager;