#!/usr/bin/env node

// COMPLETE WALLET FIX - Test and fix ALL wallet issues

require('dotenv').config();

const Database = require('./src/database/database');
const BlockchainManager = require('./src/blockchain/blockchain-manager');
const WalletManager = require('./src/wallet/wallet-manager');

async function completeWalletFix() {
    console.log('🚨 COMPLETE WALLET FIX - Testing and fixing ALL issues');
    
    try {
        // 1. Initialize database
        console.log('1. Connecting to database...');
        const db = new Database();
        await db.connect();
        console.log('✅ Database connected');
        
        // 2. Initialize blockchain manager (no initialize method needed)
        console.log('2. Setting up blockchain manager...');
        const blockchain = new BlockchainManager();
        console.log('✅ Blockchain manager created');
        
        // 3. Test blockchain connections
        console.log('3. Testing blockchain connections...');
        const connections = await blockchain.testConnections();
        console.log('Blockchain connections:', connections);
        
        // 4. Initialize wallet manager
        console.log('4. Setting up wallet manager...');
        const wallet = new WalletManager(db, blockchain);
        console.log('✅ Wallet manager created');
        
        // 5. Test wallet creation for each coin individually
        console.log('5. Testing individual coin wallet creation...');
        const testUserId = 'fix_test_' + Date.now();
        
        for (const coin of ['AEGS', 'SHIC', 'PEPE', 'ADVC']) {
            try {
                console.log(`\n🔍 Testing ${coin} wallet creation...`);
                
                // Test if coin is supported
                const isSupported = blockchain.isCoinSupported(coin);
                console.log(`${coin} supported:`, isSupported);
                
                if (isSupported) {
                    // Test wallet creation
                    const walletResult = await blockchain.createUserWallet(testUserId, coin);
                    console.log(`✅ ${coin} wallet created:`, walletResult.address);
                } else {
                    console.log(`❌ ${coin} not supported - daemon not running or configured`);
                }
            } catch (error) {
                console.error(`❌ ${coin} wallet creation failed:`, error.message);
            }
        }
        
        // 6. Test complete wallet creation
        console.log('\n6. Testing complete wallet creation...');
        try {
            const result = await wallet.createWallet(testUserId + '_complete', 'testpass123');
            console.log('🎉 COMPLETE WALLET CREATION RESULT:');
            console.log('Success:', result.success);
            console.log('Addresses created:', Object.keys(result.addresses || {}));
            console.log('Address details:', result.addresses);
        } catch (error) {
            console.error('❌ Complete wallet creation failed:', error.message);
        }
        
        // 7. Test address retrieval
        console.log('\n7. Testing address retrieval...');
        try {
            const addresses = await wallet.getWalletAddresses(testUserId + '_complete');
            console.log('Retrieved addresses:', addresses);
        } catch (error) {
            console.error('❌ Address retrieval failed:', error.message);
        }
        
        console.log('\n🎉 WALLET FIX TEST COMPLETED!');
        
    } catch (error) {
        console.error('❌ COMPLETE FIX FAILED:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

completeWalletFix();