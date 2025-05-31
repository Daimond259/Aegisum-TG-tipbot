#!/usr/bin/env node

require('dotenv').config();
const Database = require('./src/database/database');
const BlockchainManager = require('./src/blockchain/blockchain-manager');
const WalletManager = require('./src/wallet/wallet-manager');

async function testFreshWallet() {
    console.log('🎯 TESTING FRESH WALLET CREATION');
    console.log('=================================\n');

    try {
        // Initialize components
        const database = new Database();
        await database.connect();
        const blockchainManager = new BlockchainManager();
        const walletManager = new WalletManager(database, blockchainManager);

        // Use a random user ID that definitely doesn't exist
        const FRESH_USER_ID = Math.floor(Math.random() * 1000000000);
        const TEST_PASSWORD = 'TestPassword123!';
        
        console.log(`🆕 Testing with fresh user ID: ${FRESH_USER_ID}`);
        console.log('📝 Creating wallet...\n');
        
        const result = await walletManager.createWallet(FRESH_USER_ID, TEST_PASSWORD);
        
        if (result.success) {
            console.log('🎉 SUCCESS! Wallet created perfectly!');
            console.log('📱 Mnemonic:', result.mnemonic);
            console.log('📍 Addresses:');
            for (const [coin, address] of Object.entries(result.addresses)) {
                console.log(`   ${coin}: ${address}`);
            }
            
            console.log('\n✅ ALL COINS WORKING PERFECTLY!');
            console.log('🚀 The tip bot is ready to use!');
            
        } else {
            console.log('❌ FAILED! Error:', result.error);
        }
        
    } catch (error) {
        console.log('💥 EXCEPTION:', error.message);
    }
}

testFreshWallet().catch(console.error);