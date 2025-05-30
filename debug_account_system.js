/**
 * Debug script to understand why the account system isn't working
 */

require('dotenv').config();
const BlockchainManager = require('./src/blockchain/blockchain-manager');

async function debugAccountSystem() {
    console.log('🔍 DEBUGGING ACCOUNT SYSTEM...\n');
    
    try {
        const blockchain = new BlockchainManager();
        const client = blockchain.getClient('AEGS');
        const testTelegramId = 777777;
        const accountName = `user_${testTelegramId}`;
        
        console.log(`📋 Testing account: ${accountName}\n`);
        
        // Step 1: Check if account exists
        console.log('1️⃣ Checking existing addresses for account...');
        try {
            const existingAddresses = await client.getAddressesByAccount(accountName);
            console.log(`   Existing addresses: ${JSON.stringify(existingAddresses)}`);
        } catch (error) {
            console.log(`   Error getting addresses: ${error.message}`);
        }
        
        // Step 2: Create a new address
        console.log('\n2️⃣ Creating new address...');
        const newAddress = await client.getNewAddress(accountName);
        console.log(`   New address: ${newAddress}`);
        
        // Step 3: Set account for the address (if needed)
        console.log('\n3️⃣ Setting account for address...');
        try {
            await client.setAccount(newAddress, accountName);
            console.log(`   ✅ Account set successfully`);
        } catch (error) {
            console.log(`   ⚠️ setAccount failed: ${error.message}`);
        }
        
        // Step 4: Check addresses again
        console.log('\n4️⃣ Checking addresses after creation...');
        try {
            const addressesAfter = await client.getAddressesByAccount(accountName);
            console.log(`   Addresses after: ${JSON.stringify(addressesAfter)}`);
        } catch (error) {
            console.log(`   Error getting addresses: ${error.message}`);
        }
        
        // Step 5: Check what account the address belongs to
        console.log('\n5️⃣ Checking account for the new address...');
        try {
            const addressAccount = await client.getAccount(newAddress);
            console.log(`   Address ${newAddress} belongs to account: "${addressAccount}"`);
        } catch (error) {
            console.log(`   Error getting account: ${error.message}`);
        }
        
        // Step 6: Check address info
        console.log('\n6️⃣ Checking address info...');
        const addressInfo = await client.getAddressInfo(newAddress);
        console.log(`   Address info:`, {
            ismine: addressInfo.ismine,
            iswatchonly: addressInfo.iswatchonly,
            solvable: addressInfo.solvable,
            label: addressInfo.label || 'no label'
        });
        
        // Step 7: Try to get address again using getUserWalletAddress
        console.log('\n7️⃣ Testing getUserWalletAddress...');
        const retrievedAddress = await blockchain.getUserWalletAddress(testTelegramId, 'AEGS');
        console.log(`   Retrieved address: ${retrievedAddress}`);
        console.log(`   Same as created? ${retrievedAddress === newAddress}`);
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    }
}

debugAccountSystem().catch(console.error);