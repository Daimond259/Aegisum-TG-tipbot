#!/usr/bin/env node

require('dotenv').config();
const BlockchainManager = require('./src/blockchain/blockchain-manager');

async function checkDaemons() {
    console.log('🔍 CHECKING ALL DAEMON CONNECTIONS');
    console.log('===================================\n');

    const blockchainManager = new BlockchainManager();
    const coins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];
    
    for (const coin of coins) {
        console.log(`\n🔍 Testing ${coin}:`);
        console.log('─'.repeat(20));
        
        try {
            // Check if coin is supported
            const isSupported = blockchainManager.isCoinSupported(coin);
            console.log(`Supported: ${isSupported ? '✅' : '❌'}`);
            
            if (!isSupported) {
                console.log(`❌ ${coin} daemon not running or not configured`);
                continue;
            }

            // Test basic RPC call
            const client = blockchainManager.clients[coin];
            const info = await client.getInfo();
            console.log(`✅ ${coin} daemon running - Block: ${info.blocks || info.blockcount || 'unknown'}`);
            
            // Test wallet functionality
            try {
                const balance = await client.getBalance();
                console.log(`💰 Wallet balance: ${balance} ${coin}`);
            } catch (error) {
                console.log(`⚠️  Wallet balance error: ${error.message}`);
            }
            
            // Test address generation
            try {
                const address = await client.getNewAddress('test');
                console.log(`📍 New address: ${address}`);
            } catch (error) {
                console.log(`❌ Address generation failed: ${error.message}`);
            }
            
        } catch (error) {
            console.log(`❌ ${coin} connection failed: ${error.message}`);
        }
    }
    
    console.log('\n🎯 SUMMARY');
    console.log('===========');
    console.log('Check which daemons need to be started above.');
}

checkDaemons().catch(console.error);