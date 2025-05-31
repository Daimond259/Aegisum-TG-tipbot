#!/usr/bin/env node

// Load environment variables from the correct path
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

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
                    const height = await blockchainManager.getBlockHeight(coin);
                    console.log(`  Block height: ${height}`);
                }
            } catch (error) {
                console.log(`${coin}: ❌ Error - ${error.message}`);
            }
        }

        console.log('\n📝 Testing wallet creation for fresh test user...');
        const testUserId = Math.floor(Math.random() * 1000000000); // Random user ID
        const testPassword = 'TestPassword123!';

        try {
            console.log(`\n🔧 Creating wallet for user ID: ${testUserId}`);
            const result = await walletManager.createWallet(testUserId, testPassword);
            
            console.log('\n📋 WALLET CREATION RESULT:');
            console.log('Success:', result.success);
            console.log('Addresses created:', Object.keys(result.addresses || {}));
            console.log('Total addresses:', Object.keys(result.addresses || {}).length);
            
            if (result.addresses) {
                for (const [coin, address] of Object.entries(result.addresses)) {
                    console.log(`${coin}: ${address}`);
                }
            } else {
                console.log('❌ No addresses were created!');
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