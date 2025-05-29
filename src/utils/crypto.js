const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');

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

    // Derive wallet addresses from mnemonic
    deriveWalletAddress(mnemonic, coinSymbol, accountIndex = 0, addressIndex = 0) {
        try {
            // Convert mnemonic to seed
            const seed = bip39.mnemonicToSeedSync(mnemonic);
            
            // Create master key
            const root = bip32.fromSeed(seed);
            
            // Define derivation paths for different coins (BIP44)
            const derivationPaths = {
                'AEGS': `m/44'/0'/${accountIndex}'/0/${addressIndex}`, // Bitcoin-like
                'SHIC': `m/44'/0'/${accountIndex}'/0/${addressIndex}`, // Bitcoin-like
                'PEPE': `m/44'/0'/${accountIndex}'/0/${addressIndex}`, // Bitcoin-like
                'ADVC': `m/44'/0'/${accountIndex}'/0/${addressIndex}`  // Bitcoin-like
            };

            const derivationPath = derivationPaths[coinSymbol];
            if (!derivationPath) {
                throw new Error(`Unsupported coin: ${coinSymbol}`);
            }

            // Derive the key
            const child = root.derivePath(derivationPath);
            
            // Generate address based on coin type
            const address = this._generateAddressFromKey(child, coinSymbol);
            
            return {
                address,
                derivationPath,
                publicKey: child.publicKey.toString('hex'),
                privateKey: child.privateKey.toString('hex')
            };
        } catch (error) {
            throw new Error(`Address derivation failed: ${error.message}`);
        }
    }

    // Generate address from mnemonic and derivation path
    generateAddress(mnemonic, coinSymbol, accountIndex = 0) {
        try {
            const derivationData = this.deriveWalletAddress(mnemonic, coinSymbol, accountIndex);
            return derivationData.address;
        } catch (error) {
            throw new Error(`Address generation failed: ${error.message}`);
        }
    }

    // Generate address from derived key (internal method)
    _generateAddressFromKey(keyPair, coinSymbol) {
        // For Bitcoin-like coins, we'll use P2PKH addresses
        // In a real implementation, you'd need specific address generation for each coin
        
        const networks = {
            'AEGS': bitcoin.networks.bitcoin, // Use appropriate network params
            'SHIC': bitcoin.networks.bitcoin,
            'PEPE': bitcoin.networks.bitcoin,
            'ADVC': bitcoin.networks.bitcoin
        };

        const network = networks[coinSymbol] || bitcoin.networks.bitcoin;
        
        // Generate P2PKH address
        const { address } = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: network
        });

        return address;
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