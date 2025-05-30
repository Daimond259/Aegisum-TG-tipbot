#!/usr/bin/env node

/**
 * CRITICAL WALLET FIX TEST
 * 
 * This script tests the wallet ownership fix to ensure generated addresses
 * are actually owned by the tipbot wallet.
 */

require('dotenv').config();
const BlockchainManager = require('./src/blockchain/blockchain-manager');

async function testWalletFix() {
    console.log('🔧 TESTING WALLET OWNERSHIP FIX...\n');
    
    try {
        // Initialize blockchain manager
        const blockchain = new BlockchainManager();
        
        // Test with AEGS (the coin that had the problem)
        const testCoin = 'AEGS';
        const testTelegramId = 999999; // Test user ID
        
        console.log(`📋 Testing ${testCoin} wallet creation for user ${testTelegramId}...`);
        
        // Create a new wallet
        const walletData = await blockchain.createUserWallet(testTelegramId, testCoin);
        console.log(`✅ Generated address: ${walletData.address}`);
        console.log(`📝 Account name: ${walletData.accountName}`);
        
        // Verify the address is owned by our wallet
        const client = blockchain.getClient(testCoin);
        const addressInfo = await client.getAddressInfo(walletData.address);
        
        console.log('\n🔍 ADDRESS OWNERSHIP CHECK:');
        console.log(`Address: ${walletData.address}`);
        console.log(`Is Mine: ${addressInfo.ismine}`);
        console.log(`Is Watch Only: ${addressInfo.iswatchonly}`);
        console.log(`Solvable: ${addressInfo.solvable}`);
        
        if (addressInfo.ismine) {
            console.log('\n✅ SUCCESS! Address is owned by tipbot wallet!');
            
            // Test getting the address again
            const retrievedAddress = await blockchain.getUserWalletAddress(testTelegramId, testCoin);
            console.log(`🔄 Retrieved same address: ${retrievedAddress}`);
            
            if (retrievedAddress === walletData.address) {
                console.log('✅ Address retrieval works correctly!');
            } else {
                console.log('❌ Address retrieval returned different address!');
            }
            
            // Test balance (should be 0)
            const balance = await blockchain.getUserWalletBalance(testTelegramId, testCoin);
            console.log(`💰 Balance: ${balance} ${testCoin}`);
            
        } else {
            console.log('\n❌ CRITICAL ERROR! Address is NOT owned by tipbot wallet!');
            console.log('🚨 The fix did not work - addresses are still not owned!');
            process.exit(1);
        }
        
        // Test with all supported coins
        console.log('\n🔄 Testing all supported coins...');
        const coins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];
        
        for (const coin of coins) {
            if (blockchain.isCoinSupported(coin)) {
                try {
                    const testId = 888888 + coins.indexOf(coin);
                    const wallet = await blockchain.createUserWallet(testId, coin);
                    const info = await blockchain.getClient(coin).getAddressInfo(wallet.address);
                    
                    console.log(`${coin}: ${wallet.address} (ismine: ${info.ismine})`);
                    
                    if (!info.ismine) {
                        console.log(`❌ ${coin} address is NOT owned by wallet!`);
                    }
                } catch (error) {
                    console.log(`⚠️  ${coin}: ${error.message}`);
                }
            } else {
                console.log(`⚠️  ${coin}: Not supported/connected`);
            }
        }
        
        console.log('\n🎉 WALLET FIX TEST COMPLETED!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testWalletFix().catch(console.error);