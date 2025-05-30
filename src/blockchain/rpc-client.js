const axios = require('axios');
const logger = require('../utils/logger');

class RPCClient {
    constructor(config) {
        this.host = config.host;
        this.port = config.port;
        this.username = config.username;
        this.password = config.password;
        this.coinSymbol = config.coinSymbol;
        this.timeout = config.timeout || 30000;
        
        this.baseURL = `http://${this.host}:${this.port}`;
        this.auth = {
            username: this.username,
            password: this.password
        };
        
        this.logger = logger;
    }

    async call(method, params = []) {
        try {
            const response = await axios.post(this.baseURL, {
                jsonrpc: '2.0',
                id: Date.now(),
                method: method,
                params: params
            }, {
                auth: this.auth,
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.error) {
                throw new Error(`RPC Error: ${response.data.error.message}`);
            }

            return response.data.result;
        } catch (error) {
            this.logger.error(`RPC call failed for ${this.coinSymbol}:`, {
                method,
                params,
                error: error.message
            });
            throw error;
        }
    }

    // Basic blockchain information
    async getBlockchainInfo() {
        return this.call('getblockchaininfo');
    }

    async getNetworkInfo() {
        return this.call('getnetworkinfo');
    }

    async getWalletInfo() {
        return this.call('getwalletinfo');
    }

    // Block operations
    async getBlockCount() {
        return this.call('getblockcount');
    }

    async getBlockHash(height) {
        return this.call('getblockhash', [height]);
    }

    async getBlock(hash, verbosity = 1) {
        return this.call('getblock', [hash, verbosity]);
    }

    async getBestBlockHash() {
        return this.call('getbestblockhash');
    }

    // Transaction operations
    async getTransaction(txid, includeWatchOnly = false) {
        return this.call('gettransaction', [txid, includeWatchOnly]);
    }

    async getRawTransaction(txid, verbose = true) {
        return this.call('getrawtransaction', [txid, verbose]);
    }

    async sendRawTransaction(hexString) {
        return this.call('sendrawtransaction', [hexString]);
    }

    async createRawTransaction(inputs, outputs) {
        return this.call('createrawtransaction', [inputs, outputs]);
    }

    async signRawTransaction(hexString, prevTxs = [], privateKeys = []) {
        return this.call('signrawtransaction', [hexString, prevTxs, privateKeys]);
    }

    // Address and wallet operations
    async getNewAddress(label = '', addressType = 'legacy') {
        return this.call('getnewaddress', [label, addressType]);
    }

    async validateAddress(address) {
        return this.call('validateaddress', [address]);
    }

    async getAddressInfo(address) {
        return this.call('getaddressinfo', [address]);
    }

    async importAddress(address, label = '', rescan = false, p2sh = false) {
        return this.call('importaddress', [address, label, rescan, p2sh]);
    }

    async importPrivKey(privateKey, label = '', rescan = false) {
        return this.call('importprivkey', [privateKey, label, rescan]);
    }

    // Balance and UTXO operations
    async getBalance(account = '*', minConfirmations = 1) {
        return this.call('getbalance', [account, minConfirmations]);
    }

    async getReceivedByAddress(address, minConfirmations = 1) {
        return this.call('getreceivedbyaddress', [address, minConfirmations]);
    }

    async listUnspent(minConfirmations = 1, maxConfirmations = 9999999, addresses = []) {
        return this.call('listunspent', [minConfirmations, maxConfirmations, addresses]);
    }

    async listTransactions(account = '*', count = 10, skip = 0, includeWatchOnly = false) {
        return this.call('listtransactions', [account, count, skip, includeWatchOnly]);
    }

    // Sending operations
    async sendToAddress(address, amount, comment = '', commentTo = '') {
        return this.call('sendtoaddress', [address, amount, comment, commentTo]);
    }

    async sendMany(fromAccount, amounts, minConfirmations = 1, comment = '') {
        return this.call('sendmany', [fromAccount, amounts, minConfirmations, comment]);
    }

    // Fee estimation
    async estimateFee(blocks = 6) {
        try {
            return await this.call('estimatefee', [blocks]);
        } catch (error) {
            // Fallback to a default fee if estimation fails
            this.logger.warn(`Fee estimation failed for ${this.coinSymbol}, using default`);
            return 0.001;
        }
    }

    async estimateSmartFee(blocks = 6, estimateMode = 'CONSERVATIVE') {
        try {
            const result = await this.call('estimatesmartfee', [blocks, estimateMode]);
            return result.feerate || 0.001;
        } catch (error) {
            this.logger.warn(`Smart fee estimation failed for ${this.coinSymbol}, using default`);
            return 0.001;
        }
    }

    // Utility methods
    async ping() {
        try {
            await this.call('ping');
            return true;
        } catch (error) {
            return false;
        }
    }

    async isConnected() {
        try {
            await this.getBlockCount();
            return true;
        } catch (error) {
            return false;
        }
    }

    // Get transactions for an address (if supported)
    async getAddressTransactions(address, count = 10) {
        try {
            // This method varies by coin implementation
            // Some coins support 'getaddresstxids' or similar
            return await this.call('getaddresstxids', [{ addresses: [address] }]);
        } catch (error) {
            this.logger.warn(`Address transaction lookup not supported for ${this.coinSymbol}`);
            return [];
        }
    }

    // Wallet management methods
    async createWallet(walletName, disablePrivateKeys = false, blank = false, passphrase = '') {
        try {
            return await this.call('createwallet', [walletName, disablePrivateKeys, blank, passphrase]);
        } catch (error) {
            // Some older coins don't support createwallet, fallback to loading existing
            this.logger.warn(`createwallet not supported for ${this.coinSymbol}, using default wallet`);
            return { name: walletName, warning: 'Using default wallet' };
        }
    }

    async loadWallet(walletName) {
        try {
            return await this.call('loadwallet', [walletName]);
        } catch (error) {
            this.logger.warn(`loadwallet failed for ${this.coinSymbol}:`, error.message);
            throw error;
        }
    }

    async unloadWallet(walletName) {
        try {
            return await this.call('unloadwallet', [walletName]);
        } catch (error) {
            this.logger.warn(`unloadwallet failed for ${this.coinSymbol}:`, error.message);
            return false;
        }
    }

    async listWallets() {
        try {
            return await this.call('listwallets');
        } catch (error) {
            this.logger.warn(`listwallets not supported for ${this.coinSymbol}`);
            return [];
        }
    }

    async getWalletBalance(walletName = '') {
        try {
            if (walletName) {
                // For newer RPC versions with wallet endpoints
                return await this.call('getbalance');
            }
            return await this.getBalance();
        } catch (error) {
            this.logger.error(`Failed to get wallet balance for ${this.coinSymbol}:`, error.message);
            return 0;
        }
    }

    // Account-based operations (for older wallet systems)
    async getAccountAddress(account) {
        try {
            return await this.call('getaccountaddress', [account]);
        } catch (error) {
            // Fallback to getnewaddress with label
            return await this.getNewAddress(account);
        }
    }

    async setAccount(address, account) {
        try {
            return await this.call('setaccount', [address, account]);
        } catch (error) {
            this.logger.warn(`setaccount not supported for ${this.coinSymbol}`);
            return false;
        }
    }

    async getAccount(address) {
        try {
            return await this.call('getaccount', [address]);
        } catch (error) {
            this.logger.warn(`getaccount not supported for ${this.coinSymbol}`);
            return '';
        }
    }

    // Create a transaction with specific inputs and outputs
    async createTransaction(inputs, outputs, fee = 0.001) {
        try {
            // Create raw transaction
            const rawTx = await this.createRawTransaction(inputs, outputs);
            
            // Sign the transaction (requires wallet to be unlocked)
            const signedTx = await this.signRawTransaction(rawTx);
            
            if (!signedTx.complete) {
                throw new Error('Transaction signing incomplete');
            }
            
            return signedTx.hex;
        } catch (error) {
            this.logger.error(`Transaction creation failed for ${this.coinSymbol}:`, error);
            throw error;
        }
    }

    // Broadcast a signed transaction
    async broadcastTransaction(signedTxHex) {
        try {
            const txid = await this.sendRawTransaction(signedTxHex);
            this.logger.info(`Transaction broadcast successful for ${this.coinSymbol}:`, { txid });
            return txid;
        } catch (error) {
            this.logger.error(`Transaction broadcast failed for ${this.coinSymbol}:`, error);
            throw error;
        }
    }

    // Get mempool information
    async getMempoolInfo() {
        try {
            return await this.call('getmempoolinfo');
        } catch (error) {
            this.logger.warn(`Mempool info not available for ${this.coinSymbol}`);
            return null;
        }
    }

    // Get raw mempool
    async getRawMempool(verbose = false) {
        try {
            return await this.call('getrawmempool', [verbose]);
        } catch (error) {
            this.logger.warn(`Raw mempool not available for ${this.coinSymbol}`);
            return [];
        }
    }
}

module.exports = RPCClient;