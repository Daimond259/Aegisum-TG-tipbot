const logger = require('./logger');

class ValidationUtils {
    // Validate Telegram user ID
    static isValidTelegramId(id) {
        return Number.isInteger(id) && id > 0;
    }

    // Validate cryptocurrency amount
    static isValidAmount(amount, minAmount = 0.00000001, maxAmount = 1000000) {
        const num = parseFloat(amount);
        return !isNaN(num) && num >= minAmount && num <= maxAmount && num > 0;
    }

    // Validate coin symbol
    static isValidCoinSymbol(symbol) {
        const supportedCoins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];
        return supportedCoins.includes(symbol.toUpperCase());
    }

    // Validate cryptocurrency address (basic validation)
    static isValidAddress(address, coinSymbol) {
        if (!address || typeof address !== 'string') {
            return false;
        }

        // Basic address validation - in production, use coin-specific validation
        const addressPatterns = {
            'AEGS': /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Bitcoin-like
            'SHIC': /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
            'PEPE': /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
            'ADVC': /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
        };

        const pattern = addressPatterns[coinSymbol.toUpperCase()];
        return pattern ? pattern.test(address) : false;
    }

    // Validate transaction ID
    static isValidTxId(txid) {
        return /^[a-fA-F0-9]{64}$/.test(txid);
    }

    // Validate username
    static isValidUsername(username) {
        if (!username) return true; // Username is optional
        return /^[a-zA-Z0-9_]{5,32}$/.test(username);
    }

    // Validate password strength
    static isValidPassword(password) {
        if (!password || password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters long' };
        }
        
        if (password.length > 128) {
            return { valid: false, message: 'Password must be less than 128 characters' };
        }

        // Check for at least one number and one letter
        if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
            return { valid: false, message: 'Password must contain at least one letter and one number' };
        }

        return { valid: true };
    }

    // Validate mnemonic phrase
    static isValidMnemonic(mnemonic) {
        if (!mnemonic || typeof mnemonic !== 'string') {
            return false;
        }

        const words = mnemonic.trim().split(/\s+/);
        return words.length === 12 || words.length === 24;
    }

    // Sanitize user input
    static sanitizeInput(input, maxLength = 1000) {
        if (!input || typeof input !== 'string') {
            return '';
        }

        return input
            .trim()
            .slice(0, maxLength)
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .replace(/[\x00-\x1f\x7f]/g, ''); // Remove control characters
    }

    // Validate command parameters
    static validateTipCommand(params) {
        const errors = [];

        if (!params.recipient) {
            errors.push('Recipient is required');
        }

        if (!params.coin || !this.isValidCoinSymbol(params.coin)) {
            errors.push('Valid coin symbol is required (AEGS, SHIC, PEPE, ADVC)');
        }

        if (!params.amount || !this.isValidAmount(params.amount)) {
            errors.push('Valid amount is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static validateWithdrawCommand(params) {
        const errors = [];

        if (!params.coin || !this.isValidCoinSymbol(params.coin)) {
            errors.push('Valid coin symbol is required (AEGS, SHIC, PEPE, ADVC)');
        }

        if (!params.amount || !this.isValidAmount(params.amount)) {
            errors.push('Valid amount is required');
        }

        if (!params.address || !this.isValidAddress(params.address, params.coin)) {
            errors.push('Valid destination address is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static validateRainCommand(params) {
        const errors = [];

        if (!params.coin || !this.isValidCoinSymbol(params.coin)) {
            errors.push('Valid coin symbol is required (AEGS, SHIC, PEPE, ADVC)');
        }

        if (!params.amount || !this.isValidAmount(params.amount)) {
            errors.push('Valid amount is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static validateAirdropCommand(params) {
        const errors = [];

        if (!params.coin || !this.isValidCoinSymbol(params.coin)) {
            errors.push('Valid coin symbol is required (AEGS, SHIC, PEPE, ADVC)');
        }

        if (!params.amount || !this.isValidAmount(params.amount)) {
            errors.push('Valid amount is required');
        }

        if (!params.duration || !Number.isInteger(params.duration) || params.duration < 1 || params.duration > 60) {
            errors.push('Duration must be between 1 and 60 minutes');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Rate limiting validation
    static isRateLimited(lastAction, cooldownSeconds = 30) {
        if (!lastAction) return false;
        
        const now = new Date();
        const timeDiff = (now - new Date(lastAction)) / 1000;
        return timeDiff < cooldownSeconds;
    }

    // Validate group permissions
    static isAuthorizedUser(userId, authorizedIds = []) {
        return authorizedIds.includes(userId.toString());
    }

    // Format amount for display
    static formatAmount(amount, decimals = 8) {
        const num = parseFloat(amount);
        if (isNaN(num)) return '0';
        
        return num.toFixed(decimals).replace(/\.?0+$/, '');
    }

    // Parse amount from string
    static parseAmount(amountStr) {
        const amount = parseFloat(amountStr);
        return isNaN(amount) ? 0 : amount;
    }

    // Validate environment variables
    static validateEnvironment() {
        const required = [
            'TELEGRAM_BOT_TOKEN',
            'ENCRYPTION_KEY',
            'AEGS_RPC_HOST',
            'AEGS_RPC_PORT',
            'AEGS_RPC_USER',
            'AEGS_RPC_PASS'
        ];

        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        // Validate encryption key length
        if (process.env.ENCRYPTION_KEY.length !== 32) {
            throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
        }

        logger.info('Environment validation passed');
        return true;
    }
}

module.exports = ValidationUtils;