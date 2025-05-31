#!/usr/bin/env node

require('dotenv').config();
const Database = require('./src/database/database');
const BlockchainManager = require('./src/blockchain/blockchain-manager');
const WalletManager = require('./src/wallet/wallet-manager');

async function debugTelegramError() {
    console.log('🔍 DEBUGGING TELEGRAM WALLET ERROR');
    console.log('===================================\n');

    try {
        // Initialize components exactly like the bot does
        console.log('📊 Connecting to database...');
        const database = new Database();
        await database.connect();
        console.log('✅ Database connected');

        console.log('⛓️  Initializing blockchain manager...');
        const blockchainManager = new BlockchainManager();
        console.log('✅ Blockchain manager initialized');

        console.log('💼 Initializing wallet manager...');
        const walletManager = new WalletManager(database, blockchainManager);
        console.log('✅ Wallet manager initialized');

        // Test with a new random user ID (like Telegram would)
        const TEST_USER_ID = Math.floor(Math.random() * 1000000000);
        const TEST_PASSWORD = 'MySecurePassword123!';
        
        console.log(`\n🆔 Testing with user ID: ${TEST_USER_ID}`);
        console.log('🔐 Testing with password:', TEST_PASSWORD);
        
        console.log('\n📝 Creating wallet (exactly like Telegram does)...');
        
        // This is exactly what happens when user clicks "Create New Wallet"
        const result = await walletManager.createWallet(TEST_USER_ID, TEST_PASSWORD);
        
        console.log('\n📋 FULL RESULT:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('\n🎉 SUCCESS! Wallet created perfectly!');
            console.log('📱 Mnemonic length:', result.mnemonic ? result.mnemonic.split(' ').length : 'UNDEFINED');
            console.log('📱 Mnemonic:', result.mnemonic || 'MISSING!');
            console.log('📍 Addresses:');
            for (const [coin, address] of Object.entries(result.addresses || {})) {
                console.log(`   ${coin}: ${address}`);
            }
        } else {
            console.log('\n❌ FAILED!');
            console.log('Error:', result.error);
            console.log('Details:', result.details);
        }
        
        // Test if we can retrieve the wallet
        console.log('\n🔍 Testing wallet retrieval...');
        const user = await database.getUserByTelegramId(TEST_USER_ID);
        console.log('User found:', !!user);
        if (user) {
            console.log('User ID:', user.id);
            console.log('Telegram ID:', user.telegram_id);
            console.log('Has encrypted wallet:', !!user.encrypted_wallet);
        }
        
    } catch (error) {
        console.log('\n💥 EXCEPTION:');
        console.log('Message:', error.message);
        console.log('Stack:', error.stack);
    }
}

debugTelegramError().catch(console.error);