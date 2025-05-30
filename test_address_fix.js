/**
 * Test script to verify the address consistency fix with in-memory cache
 */

require('dotenv').config();
const BlockchainManager = require('./src/blockchain/blockchain-manager');

async function testAddressFix() {
    console.log('🔧 TESTING ADDRESS CONSISTENCY FIX WITH CACHE...\n');
    
    try {
        // Initialize blockchain manager
        const blockchain = new BlockchainManager();
        
        // Test with AEGS
        const testCoin = 'AEGS';
        const testTelegramId = 999999; // New test user ID
        
        console.log(`📋 Testing ${testCoin} address consistency for user ${testTelegramId}...`);
        
        // First call - should create new wallet and cache it
        console.log('🆕 First call (creating wallet and caching)...');
        const address1 = await blockchain.getUserWalletAddress(testTelegramId, testCoin);
        console.log(`✅ Address 1: ${address1}`);
        
        // Second call - should return cached address
        console.log('🔄 Second call (should return cached address)...');
        const address2 = await blockchain.getUserWalletAddress(testTelegramId, testCoin);
        console.log(`✅ Address 2: ${address2}`);
        
        // Third call - should still return cached address
        console.log('🔄 Third call (should still return cached address)...');
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
        
        // Test with different user to ensure isolation
        console.log('\n🔄 Testing with different user...');
        const testTelegramId2 = 888888;
        const address4 = await blockchain.getUserWalletAddress(testTelegramId2, testCoin);
        console.log(`✅ Different user address: ${address4}`);
        console.log(`🔍 Different from first user? ${address4 !== address1}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAddressFix().catch(console.error);