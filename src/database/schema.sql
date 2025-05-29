-- Aegisum Telegram Tip Bot Database Schema

-- Users table - stores Telegram user information and wallet data
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    encrypted_seed TEXT, -- Encrypted mnemonic seed
    salt TEXT, -- Salt for encryption
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table - stores wallet addresses for each coin per user
CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    coin_symbol TEXT NOT NULL,
    address TEXT NOT NULL,
    derivation_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, coin_symbol)
);

-- Transactions table - stores all transaction history
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    txid TEXT,
    from_user_id INTEGER,
    to_user_id INTEGER,
    coin_symbol TEXT NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    fee DECIMAL(20, 8) DEFAULT 0,
    transaction_type TEXT NOT NULL, -- 'tip', 'rain', 'airdrop', 'deposit', 'withdrawal'
    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    telegram_message_id INTEGER,
    group_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    block_height INTEGER,
    FOREIGN KEY (from_user_id) REFERENCES users (id),
    FOREIGN KEY (to_user_id) REFERENCES users (id)
);

-- Balances table - cached balances for quick access
CREATE TABLE IF NOT EXISTS balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    coin_symbol TEXT NOT NULL,
    confirmed_balance DECIMAL(20, 8) DEFAULT 0,
    unconfirmed_balance DECIMAL(20, 8) DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, coin_symbol)
);

-- Groups table - approved Telegram groups
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_group_id INTEGER UNIQUE NOT NULL,
    group_name TEXT,
    is_approved BOOLEAN DEFAULT 0,
    cooldown_seconds INTEGER DEFAULT 30,
    max_tip_amount DECIMAL(20, 8) DEFAULT 1000,
    min_tip_amount DECIMAL(20, 8) DEFAULT 0.01,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Airdrops table - manages airdrop campaigns
CREATE TABLE IF NOT EXISTS airdrops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    coin_symbol TEXT NOT NULL,
    total_amount DECIMAL(20, 8) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    telegram_message_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    completed_at DATETIME,
    FOREIGN KEY (creator_user_id) REFERENCES users (id)
);

-- Airdrop participants table
CREATE TABLE IF NOT EXISTS airdrop_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    airdrop_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (airdrop_id) REFERENCES airdrops (id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(airdrop_id, user_id)
);

-- Rain events table
CREATE TABLE IF NOT EXISTS rain_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    coin_symbol TEXT NOT NULL,
    total_amount DECIMAL(20, 8) NOT NULL,
    recipient_count INTEGER NOT NULL,
    amount_per_recipient DECIMAL(20, 8) NOT NULL,
    telegram_message_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_user_id) REFERENCES users (id)
);

-- Rain recipients table
CREATE TABLE IF NOT EXISTS rain_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rain_event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    FOREIGN KEY (rain_event_id) REFERENCES rain_events (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- User cooldowns table
CREATE TABLE IF NOT EXISTS user_cooldowns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    command_type TEXT NOT NULL, -- 'tip', 'rain', 'airdrop'
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, group_id, command_type)
);

-- Blockchain sync status table
CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_symbol TEXT UNIQUE NOT NULL,
    last_block_height INTEGER DEFAULT 0,
    last_sync_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_coin ON wallets(user_id, coin_symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_user_coin ON transactions(from_user_id, coin_symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_balances_user_coin ON balances(user_id, coin_symbol);
CREATE INDEX IF NOT EXISTS idx_groups_telegram_id ON groups(telegram_group_id);
CREATE INDEX IF NOT EXISTS idx_airdrops_status ON airdrops(status);
CREATE INDEX IF NOT EXISTS idx_cooldowns_user_group ON user_cooldowns(user_id, group_id);

-- Insert default admin settings
INSERT OR IGNORE INTO admin_settings (setting_key, setting_value) VALUES
('default_cooldown', '30'),
('max_tip_amount', '1000'),
('min_tip_amount', '0.01'),
('transaction_fee', '0.001'),
('bot_version', '1.0.0');

-- Insert supported coins
INSERT OR IGNORE INTO sync_status (coin_symbol, last_block_height) VALUES
('AEGS', 0),
('SHIC', 0),
('PEPE', 0),
('ADVC', 0);