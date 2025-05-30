const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');

// Initialize BIP32 with secp256k1
const bip32 = BIP32Factory(ecc);

class CryptoUtils {
    constructor() {
        this.encryptionKey = process.env.ENCRYPTION_KEY;
        if (!this.encryptionKey || this.encryptionKey.length !== 32) {
            throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
        }
    }

    // Generate a new mnemonic seed phrase
    generateMnemonic() {
        return bip39.generateMnemonic(256); // 24 words
    }

    // Validate mnemonic
    validateMnemonic(mnemonic) {
        return bip39.validateMnemonic(mnemonic);
    }

    // Encrypt sensitive data
    encrypt(text, userPassword) {
        try {
            // Create a key from user password + system encryption key
            const key = CryptoJS.PBKDF2(userPassword + this.encryptionKey, 'salt', {
                keySize: 256 / 32,
                iterations: 10000
            });
            
            const encrypted = CryptoJS.AES.encrypt(text, key.toString()).toString();
            return encrypted;
        } catch (error) {
            throw new Error('Encryption failed: ' + error.message);
        }
    }

    // Decrypt sensitive data
    decrypt(encryptedText, userPassword) {
        try {
            // Create the same key from user password + system encryption key
            const key = CryptoJS.PBKDF2(userPassword + this.encryptionKey, 'salt', {
                keySize: 256 / 32,
                iterations: 10000
            });
            
            const decrypted = CryptoJS.AES.decrypt(encryptedText, key.toString());
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            throw new Error('Decryption failed: ' + error.message);
        }
    }

    // Generate salt for password hashing
    generateSalt() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Hash password with salt
    hashPassword(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    }

    // Verify password
    verifyPassword(password, hash, salt) {
        const hashToVerify = this.hashPassword(password, salt);
        return hashToVerify === hash;
    }

    // DEPRECATED: This method is no longer used
    // All address generation now happens via blockchain daemon RPC calls
    deriveWalletAddress(mnemonic, coinSymbol, accountIndex = 0, addressIndex = 0) {
        throw new Error('DEPRECATED: Address generation now uses blockchain daemon RPC calls only. Use BlockchainManager.createUserWallet() instead.');
    }

    // DEPRECATED: This method is no longer used
    // All address generation now happens via blockchain daemon RPC calls
    generateAddress(mnemonic, coinSymbol, accountIndex = 0) {
        throw new Error('DEPRECATED: Address generation now uses blockchain daemon RPC calls only. Use BlockchainManager.createUserWallet() instead.');
    }

    // DEPRECATED: This method is no longer used
    // All address generation now happens via blockchain daemon RPC calls
    _generateAddressFromKey(keyPair, coinSymbol) {
        throw new Error('DEPRECATED: Address generation now uses blockchain daemon RPC calls only. Use BlockchainManager.createUserWallet() instead.');
    }

    // Generate a secure random string
    generateSecureRandom(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    // Create a wallet backup
    createWalletBackup(mnemonic, userPassword) {
        const timestamp = new Date().toISOString();
        const backupData = {
            mnemonic,
            timestamp,
            version: '1.0.0'
        };
        
        return this.encrypt(JSON.stringify(backupData), userPassword);
    }

    // Restore wallet from backup
    restoreWalletBackup(encryptedBackup, userPassword) {
        try {
            const decryptedData = this.decrypt(encryptedBackup, userPassword);
            const backupData = JSON.parse(decryptedData);
            
            if (!this.validateMnemonic(backupData.mnemonic)) {
                throw new Error('Invalid mnemonic in backup');
            }
            
            return backupData;
        } catch (error) {
            throw new Error(`Wallet restore failed: ${error.message}`);
        }
    }
}

module.exports = CryptoUtils;