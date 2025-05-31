const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class Database {
    constructor(dbPath = process.env.DATABASE_PATH || './data/tipbot.db') {
        this.dbPath = dbPath;
        this.db = null;
        
        // Ensure data directory exists
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error('Database connection failed:', err);
                    reject(err);
                } else {
                    logger.info('Connected to SQLite database');
                    this.initializeSchema().then(resolve).catch(reject);
                }
            });
        });
    }

    async initializeSchema() {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) {
                    logger.error('Schema initialization failed:', err);
                    reject(err);
                } else {
                    logger.info('Database schema initialized');
                    resolve();
                }
            });
        });
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    logger.error('Database run error:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    logger.error('Database get error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    logger.error('Database all error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async beginTransaction() {
        return this.run('BEGIN TRANSACTION');
    }

    async commit() {
        return this.run('COMMIT');
    }

    async rollback() {
        return this.run('ROLLBACK');
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        logger.error('Database close error:', err);
                        reject(err);
                    } else {
                        logger.info('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // User management methods
    async createUser(telegramId, username, firstName, lastName) {
        const sql = `
            INSERT INTO users (telegram_id, username, first_name, last_name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET
                username = excluded.username,
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                updated_at = CURRENT_TIMESTAMP,
                last_activity = CURRENT_TIMESTAMP
        `;
        return this.run(sql, [telegramId, username, firstName, lastName]);
    }

    async getUserByTelegramId(telegramId) {
        const sql = 'SELECT * FROM users WHERE telegram_id = ?';
        return this.get(sql, [telegramId]);
    }

    async updateUserActivity(telegramId) {
        const sql = 'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE telegram_id = ?';
        return this.run(sql, [telegramId]);
    }

    async updateUser(userId, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        
        const sql = `UPDATE users SET ${setClause} WHERE id = ?`;
        values.push(userId);
        
        return this.run(sql, values);
    }

    // Wallet management methods
    async createWallet(userId, coinSymbol, address, derivationPath) {
        const sql = `
            INSERT INTO wallets (user_id, coin_symbol, address, derivation_path)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, coin_symbol) DO UPDATE SET
                address = excluded.address,
                derivation_path = excluded.derivation_path
        `;
        return this.run(sql, [userId, coinSymbol, address, derivationPath]);
    }

    async getUserWallets(userId) {
        const sql = 'SELECT * FROM wallets WHERE user_id = ?';
        return this.all(sql, [userId]);
    }

    async getWalletAddress(userId, coinSymbol) {
        const sql = 'SELECT address FROM wallets WHERE user_id = ? AND coin_symbol = ?';
        const result = await this.get(sql, [userId, coinSymbol]);
        return result ? result.address : null;
    }

    // Balance management methods
    async updateBalance(userId, coinSymbol, confirmedBalance, unconfirmedBalance = 0) {
        const sql = `
            INSERT INTO balances (user_id, coin_symbol, confirmed_balance, unconfirmed_balance, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, coin_symbol) DO UPDATE SET
                confirmed_balance = excluded.confirmed_balance,
                unconfirmed_balance = excluded.unconfirmed_balance,
                updated_at = CURRENT_TIMESTAMP
        `;
        return this.run(sql, [userId, coinSymbol, confirmedBalance, unconfirmedBalance]);
    }

    async getUserBalance(userId, coinSymbol) {
        const sql = 'SELECT * FROM balances WHERE user_id = ? AND coin_symbol = ?';
        const result = await this.get(sql, [userId, coinSymbol]);
        return result || { confirmed_balance: 0, unconfirmed_balance: 0 };
    }

    async getUserBalances(userId) {
        const sql = 'SELECT * FROM balances WHERE user_id = ?';
        return this.all(sql, [userId]);
    }

    // Transaction methods
    async createTransaction(data) {
        const sql = `
            INSERT INTO transactions (
                txid, from_user_id, to_user_id, coin_symbol, amount, fee,
                transaction_type, status, telegram_message_id, group_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        return this.run(sql, [
            data.txid, data.fromUserId, data.toUserId, data.coinSymbol,
            data.amount, data.fee, data.transactionType, data.status,
            data.telegramMessageId, data.groupId
        ]);
    }

    async updateTransactionStatus(id, status, txid = null, blockHeight = null) {
        let sql = 'UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP';
        let params = [status];

        if (txid) {
            sql += ', txid = ?';
            params.push(txid);
        }

        if (blockHeight) {
            sql += ', block_height = ?, confirmed_at = CURRENT_TIMESTAMP';
            params.push(blockHeight);
        }

        sql += ' WHERE id = ?';
        params.push(id);

        return this.run(sql, params);
    }

    async getUserTransactions(userId, limit = 10) {
        const sql = `
            SELECT * FROM transactions 
            WHERE from_user_id = ? OR to_user_id = ?
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        return this.all(sql, [userId, userId, limit]);
    }

    // Group management methods
    async addApprovedGroup(telegramGroupId, groupName) {
        const sql = `
            INSERT INTO groups (telegram_group_id, group_name, is_approved)
            VALUES (?, ?, 1)
            ON CONFLICT(telegram_group_id) DO UPDATE SET
                group_name = excluded.group_name,
                is_approved = 1,
                updated_at = CURRENT_TIMESTAMP
        `;
        return this.run(sql, [telegramGroupId, groupName]);
    }

    async isGroupApproved(telegramGroupId) {
        const sql = 'SELECT is_approved FROM groups WHERE telegram_group_id = ?';
        const result = await this.get(sql, [telegramGroupId]);
        return result ? result.is_approved === 1 : false;
    }

    async getGroupSettings(telegramGroupId) {
        const sql = 'SELECT * FROM groups WHERE telegram_group_id = ?';
        return this.get(sql, [telegramGroupId]);
    }

    // Cooldown management
    async checkCooldown(userId, groupId, commandType) {
        const sql = `
            SELECT last_used FROM user_cooldowns 
            WHERE user_id = ? AND group_id = ? AND command_type = ?
        `;
        const result = await this.get(sql, [userId, groupId, commandType]);
        
        if (!result) return false;
        
        const cooldownSeconds = await this.getAdminSetting('default_cooldown', 30);
        const lastUsed = new Date(result.last_used);
        const now = new Date();
        const timeDiff = (now - lastUsed) / 1000;
        
        return timeDiff < cooldownSeconds;
    }

    async updateCooldown(userId, groupId, commandType) {
        const sql = `
            INSERT INTO user_cooldowns (user_id, group_id, command_type, last_used)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, group_id, command_type) DO UPDATE SET
                last_used = CURRENT_TIMESTAMP
        `;
        return this.run(sql, [userId, groupId, commandType]);
    }

    // Admin settings
    async getAdminSetting(key, defaultValue = null) {
        const sql = 'SELECT setting_value FROM admin_settings WHERE setting_key = ?';
        const result = await this.get(sql, [key]);
        return result ? result.setting_value : defaultValue;
    }

    async setAdminSetting(key, value) {
        const sql = `
            INSERT INTO admin_settings (setting_key, setting_value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(setting_key) DO UPDATE SET
                setting_value = excluded.setting_value,
                updated_at = CURRENT_TIMESTAMP
        `;
        return this.run(sql, [key, value]);
    }

    // Airdrop methods
    async createAirdrop(creatorUserId, groupId, coinSymbol, totalAmount, durationMinutes, telegramMessageId) {
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
        const sql = `
            INSERT INTO airdrops (
                creator_user_id, group_id, coin_symbol, total_amount,
                duration_minutes, telegram_message_id, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        return this.run(sql, [
            creatorUserId, groupId, coinSymbol, totalAmount,
            durationMinutes, telegramMessageId, expiresAt.toISOString()
        ]);
    }

    async joinAirdrop(airdropId, userId) {
        const sql = `
            INSERT INTO airdrop_participants (airdrop_id, user_id)
            VALUES (?, ?)
            ON CONFLICT(airdrop_id, user_id) DO NOTHING
        `;
        return this.run(sql, [airdropId, userId]);
    }

    async getActiveAirdrops() {
        const sql = `
            SELECT * FROM airdrops 
            WHERE status = 'active' AND expires_at > datetime('now')
        `;
        return this.all(sql);
    }

    async getAirdropParticipants(airdropId) {
        const sql = `
            SELECT ap.*, u.telegram_id, u.username 
            FROM airdrop_participants ap
            JOIN users u ON ap.user_id = u.id
            WHERE ap.airdrop_id = ?
        `;
        return this.all(sql, [airdropId]);
    }

    async completeAirdrop(airdropId) {
        const sql = `
            UPDATE airdrops 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.run(sql, [airdropId]);
    }
}

module.exports = Database;