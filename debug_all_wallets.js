#!/usr/bin/env node

const Database = require('./src/database/database');
const BlockchainManager = require('./src/blockchain/blockchain-manager');
const WalletManager = require('./src/wallet/wallet-manager');
const logger = require('./src/utils/logger');

async function debugAllWallets() {
    console.log('🔍 DEBUGGING ALL WALLET CREATION');
    console.log('===================================\n');

    try {
        // Initialize components
        console.log('📊 Connecting to database...');
        const db = new Database();
        await db.connect();
        console.log('✅ Database connected');

        console.log('⛓️  Initializing blockchain manager...');
        const blockchainManager = new BlockchainManager();
        // BlockchainManager doesn't have initialize method, it auto-initializes
        console.log('✅ Blockchain manager initialized');

        console.log('💼 Initializing wallet manager...');
        const walletManager = new WalletManager(db, blockchainManager);
        console.log('✅ Wallet manager initialized\n');

        // Test blockchain connections
        console.log('🔗 Testing blockchain connections:');
        const supportedCoins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];
        
        for (const coin of supportedCoins) {
            try {
                const isSupported = blockchainManager.isCoinSupported(coin);
                console.log(`${coin}: ${isSupported ? '✅ Connected' : '❌ Not connected'}`);
                
                if (isSupported) {
                    const info = await blockchainManager.getBlockchainInfo(coin);
                    console.log(`  Block height: ${info.blocks}`);
                }
            } catch (error) {
                console.log(`${coin}: ❌ Error - ${error.message}`);
            }
        }

        console.log('\n📝 Testing wallet creation for test user...');
        const testUserId = 999999999;
        const testPassword = 'TestPassword123!';

        try {
            const result = await walletManager.createWallet(testUserId, testPassword);
            
            console.log('\n📋 WALLET CREATION RESULT:');
            console.log('Success:', result.success);
            console.log('Addresses created:', Object.keys(result.addresses || {}));
            
            if (result.addresses) {
                for (const [coin, address] of Object.entries(result.addresses)) {
                    console.log(`${coin}: ${address}`);
                }
            }
            
            if (result.error) {
                console.log('Error:', result.error);
            }

        } catch (error) {
            console.log('\n💥 WALLET CREATION ERROR:');
            console.log('Message:', error.message);
            console.log('Stack:', error.stack);
        }

        await db.close();
        
    } catch (error) {
        console.log('\n💥 INITIALIZATION ERROR:');
        console.log('Message:', error.message);
        console.log('Stack:', error.stack);
    }
}

debugAllWallets().catch(console.error);