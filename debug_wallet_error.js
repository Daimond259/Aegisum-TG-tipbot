#!/usr/bin/env node

require('dotenv').config();
const Database = require('./src/database/database');
const BlockchainManager = require('./src/blockchain/blockchain-manager');
const WalletManager = require('./src/wallet/wallet-manager');

async function debugWalletError() {
    console.log('🐛 DEBUGGING WALLET CREATION ERROR');
    console.log('==================================\n');

    try {
        // Initialize database
        console.log('📊 Initializing database...');
        const database = new Database();
        await database.initialize();
        console.log('✅ Database initialized');

        // Initialize blockchain manager
        console.log('⛓️  Initializing blockchain manager...');
        const blockchainManager = new BlockchainManager();
        await blockchainManager.initialize();
        console.log('✅ Blockchain manager initialized');

        // Check which coins are connected
        const status = await blockchainManager.getConnectionStatus();
        console.log('🔗 Connection status:', status);

        // Initialize wallet manager with proper dependencies
        console.log('💼 Initializing wallet manager...');
        const walletManager = new WalletManager(database, blockchainManager);
        console.log('✅ Wallet manager initialized');

        const TEST_USER_ID = 1651155083;
        const TEST_PASSWORD = 'TestPassword123!';
        
        console.log('\n📝 Attempting to create wallet...');
        const result = await walletManager.createWallet(TEST_USER_ID, TEST_PASSWORD);
        
        console.log('✅ Wallet creation result:', result);
        
        if (result.success) {
            console.log('🎉 SUCCESS! Wallet created properly');
            console.log('Mnemonic:', result.mnemonic);
            console.log('Addresses:', result.addresses);
        } else {
            console.log('❌ FAILED! Error:', result.error);
        }
        
    } catch (error) {
        console.log('💥 EXCEPTION during wallet creation:');
        console.log('Error message:', error.message);
        console.log('Stack trace:', error.stack);
    }
}

debugWalletError().catch(console.error);