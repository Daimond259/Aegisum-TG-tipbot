/**
 * Test script to verify address consistency fix
 * This ensures getUserWalletAddress() returns the same address consistently
 */

require('dotenv').config();
const BlockchainManager = require('./src/blockchain/blockchain-manager');

async function testAddressConsistency() {
    console.log('🔧 TESTING ADDRESS CONSISTENCY FIX...\n');
    
    try {
        // Initialize blockchain manager
        const blockchain = new BlockchainManager();
        
        // Test with AEGS
        const testCoin = 'AEGS';
        const testTelegramId = 888888; // Different test user ID
        
        console.log(`📋 Testing ${testCoin} address consistency for user ${testTelegramId}...`);
        
        // First call - should create new wallet
        console.log('🆕 First call (creating wallet)...');
        const address1 = await blockchain.getUserWalletAddress(testTelegramId, testCoin);
        console.log(`✅ Address 1: ${address1}`);
        
        // Second call - should return same address
        console.log('🔄 Second call (should return same address)...');
        const address2 = await blockchain.getUserWalletAddress(testTelegramId, testCoin);
        console.log(`✅ Address 2: ${address2}`);
        
        // Third call - should still return same address
        console.log('🔄 Third call (should still return same address)...');
        const address3 = await blockchain.getUserWalletAddress(testTelegramId, testCoin);
        console.log(`✅ Address 3: ${address3}`);
        
        // Check consistency
        if (address1 === address2 && address2 === address3) {
            console.log('\n🎉 SUCCESS! All addresses are consistent!');
            console.log(`📍 Consistent address: ${address1}`);
        } else {
            console.log('\n❌ FAILURE! Addresses are not consistent!');
            console.log(`Address 1: ${address1}`);
            console.log(`Address 2: ${address2}`);
            console.log(`Address 3: ${address3}`);
        }
        
        // Verify ownership
        const client = blockchain.getClient(testCoin);
        const addressInfo = await client.getAddressInfo(address1);
        console.log(`\n🔍 Address ownership: ismine=${addressInfo.ismine}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAddressConsistency().catch(console.error);