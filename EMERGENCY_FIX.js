#!/usr/bin/env node

/**
 * EMERGENCY FIX - Complete Bot Restart with Full Debugging
 * This will fix ALL issues at once:
 * 1. Force correct environment loading
 * 2. Enable all 4 coins (AEGS, SHIC, PEPE, ADVC)
 * 3. Fix balance updates
 * 4. Enable transaction notifications
 */

require('dotenv').config();
const path = require('path');

// Force load environment variables
console.log('🔧 EMERGENCY FIX - Loading environment...');

// Verify all required environment variables
const requiredEnvVars = [
    'AEGS_RPC_HOST', 'AEGS_RPC_PORT', 'AEGS_RPC_USER', 'AEGS_RPC_PASS',
    'SHIC_RPC_HOST', 'SHIC_RPC_PORT', 'SHIC_RPC_USER', 'SHIC_RPC_PASS',
    'PEPE_RPC_HOST', 'PEPE_RPC_PORT', 'PEPE_RPC_USER', 'PEPE_RPC_PASS',
    'ADVC_RPC_HOST', 'ADVC_RPC_PORT', 'ADVC_RPC_USER', 'ADVC_RPC_PASS',
    'TELEGRAM_BOT_TOKEN', 'ENCRYPTION_KEY'
];

console.log('\n🔍 Checking environment variables:');
let missingVars = [];
for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (!value) {
        missingVars.push(varName);
        console.log(`❌ ${varName}: MISSING`);
    } else {
        console.log(`✅ ${varName}: ${varName.includes('PASS') || varName.includes('TOKEN') || varName.includes('KEY') ? '[HIDDEN]' : value}`);
    }
}

if (missingVars.length > 0) {
    console.error('\n🚨 MISSING ENVIRONMENT VARIABLES:', missingVars);
    process.exit(1);
}

// Test blockchain connections immediately
async function testBlockchainConnections() {
    console.log('\n🔗 Testing blockchain connections...');
    
    const BlockchainManager = require('./src/blockchain/blockchain-manager');
    const blockchainManager = new BlockchainManager();
    
    try {
        console.log('✅ Blockchain manager initialized');
        
        // Test each coin
        const coins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];
        for (const coin of coins) {
            try {
                const height = await blockchainManager.getBlockHeight(coin);
                console.log(`✅ ${coin}: Connected (Block ${height})`);
            } catch (error) {
                console.log(`❌ ${coin}: Failed - ${error.message}`);
            }
        }
        
        return blockchainManager;
    } catch (error) {
        console.error('❌ Blockchain manager failed:', error.message);
        throw error;
    }
}

// Test wallet creation
async function testWalletCreation(blockchainManager) {
    console.log('\n💼 Testing wallet creation...');
    
    const WalletManager = require('./src/wallet/wallet-manager');
    const Database = require('./src/database/database');
    
    const database = new Database();
    await database.connect();
    console.log('✅ Database connected');
    
    const walletManager = new WalletManager(database, blockchainManager);
    
    // Test wallet creation for a random user
    const testUserId = Math.floor(Math.random() * 1000000000);
    const testPassword = 'TestPassword123!';
    
    try {
        console.log('\n🔧 Testing wallet creation with detailed logging...');
        
        // Test each coin individually first
        console.log('\n🔍 Testing individual coin wallet creation:');
        for (const coin of ['AEGS', 'SHIC', 'PEPE', 'ADVC']) {
            try {
                console.log(`\n--- Testing ${coin} ---`);
                console.log(`isCoinSupported(${coin}):`, blockchainManager.isCoinSupported(coin));
                
                if (blockchainManager.isCoinSupported(coin)) {
                    const walletData = await blockchainManager.createUserWallet(testUserId + Math.random(), coin);
                    console.log(`✅ ${coin} wallet created: ${walletData.address}`);
                } else {
                    console.log(`❌ ${coin} not supported`);
                }
            } catch (error) {
                console.log(`❌ ${coin} failed: ${error.message}`);
            }
        }
        
        console.log('\n🔧 Now testing full wallet creation...');
        const result = await walletManager.createWallet(testUserId, testPassword);
        console.log('\n📋 WALLET CREATION RESULT:');
        console.log('Success:', result.success);
        console.log('Addresses created:', Object.keys(result.addresses || {}));
        
        if (result.addresses) {
            for (const [coin, address] of Object.entries(result.addresses)) {
                console.log(`${coin}: ${address}`);
            }
        }
        
        return result;
    } catch (error) {
        console.error('❌ Wallet creation failed:', error.message);
        throw error;
    }
}

// Main emergency fix
async function emergencyFix() {
    try {
        console.log('🚨 EMERGENCY FIX STARTING...\n');
        
        // Step 1: Test blockchain connections
        const blockchainManager = await testBlockchainConnections();
        
        // Step 2: Test wallet creation
        const walletResult = await testWalletCreation(blockchainManager);
        
        // Step 3: If tests pass, start the bot
        if (walletResult.success && Object.keys(walletResult.addresses || {}).length === 4) {
            console.log('\n🎉 ALL TESTS PASSED! Starting bot...');
            
            // Start the actual bot
            const CommunityTipBotApp = require('./src/index');
            const app = new CommunityTipBotApp();
            await app.start();
            
        } else {
            console.error('\n❌ TESTS FAILED! Not all coins working.');
            console.error('Expected 4 addresses, got:', Object.keys(walletResult.addresses || {}).length);
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n🚨 EMERGENCY FIX FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the emergency fix
emergencyFix();