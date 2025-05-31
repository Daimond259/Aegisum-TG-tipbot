#!/usr/bin/env node

// EMERGENCY WALLET TEST - Test the EXACT wallet creation flow the bot uses

require('dotenv').config();

const Database = require('./src/database/database');
const BlockchainManager = require('./src/blockchain/blockchain-manager');
const WalletManager = require('./src/wallet/wallet-manager');

async function emergencyWalletTest() {
    console.log('🚨 EMERGENCY WALLET TEST - Testing exact bot flow');
    
    try {
        // Initialize exactly like the bot does
        console.log('1. Initializing database...');
        const db = new Database();
        await db.initialize();
        console.log('✅ Database initialized');
        
        console.log('2. Initializing blockchain manager...');
        const blockchain = new BlockchainManager();
        await blockchain.initialize();
        console.log('✅ Blockchain manager initialized');
        
        console.log('3. Initializing wallet manager...');
        const wallet = new WalletManager(db, blockchain);
        console.log('✅ Wallet manager initialized');
        
        // Test the EXACT wallet creation the bot uses
        console.log('4. Testing wallet creation for test user...');
        const testUserId = 'emergency_test_' + Date.now();
        
        const result = await wallet.createWallet(testUserId, 'testpassword123');
        
        console.log('🎉 WALLET CREATION RESULT:');
        console.log('Success:', result.success);
        console.log('Addresses:', result.addresses);
        console.log('Mnemonic:', result.mnemonic ? 'Generated' : 'Missing');
        
        // Test getting addresses
        console.log('5. Testing address retrieval...');
        const addresses = await wallet.getWalletAddresses(testUserId);
        console.log('Retrieved addresses:', addresses);
        
        // Test balance check
        console.log('6. Testing balance check...');
        const balances = await wallet.getBalances(testUserId);
        console.log('Balances:', balances);
        
        console.log('🎉 ALL TESTS PASSED!');
        
    } catch (error) {
        console.error('❌ EMERGENCY TEST FAILED:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

emergencyWalletTest();