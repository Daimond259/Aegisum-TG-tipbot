#!/usr/bin/env node

/**
 * Transfer Legacy Funds Script
 * 
 * This script transfers funds from the legacy watch-only address
 * to a new wallet-owned address after the private key is imported.
 */

require('dotenv').config();
const BlockchainManager = require('../src/blockchain/blockchain-manager');

async function transferLegacyFunds() {
    console.log('💸 Starting legacy funds transfer...');
    
    const bm = new BlockchainManager();
    const client = bm.getClient('AEGS');
    
    try {
        const legacyAddress = 'AJhBetbwWntjmYoeMXeRady41NcAYjm4KM';
        const yourTelegramId = 1651155083;
        
        // Check if legacy address is now spendable (private key imported)
        const legacyInfo = await client.getAddressInfo(legacyAddress);
        console.log('🔍 Legacy address info:');
        console.log(`   - Is mine: ${legacyInfo.ismine}`);
        console.log(`   - Watch only: ${legacyInfo.iswatchonly}`);
        console.log(`   - Can spend: ${legacyInfo.ismine && !legacyInfo.iswatchonly}`);
        
        if (!legacyInfo.ismine || legacyInfo.iswatchonly) {
            console.log('❌ Cannot transfer: Legacy address private key not imported');
            console.log('💡 First import the private key with:');
            console.log(`   /usr/local/bin/aegisum-cli importprivkey "YOUR_PRIVATE_KEY" "legacy_import" true`);
            return;
        }
        
        // Get legacy balance
        const legacyBalance = await client.getBalance('*');
        console.log(`💰 Total wallet balance: ${legacyBalance} AEGS`);
        
        if (legacyBalance <= 0) {
            console.log('❌ No funds to transfer');
            return;
        }
        
        // Create new address
        const newWallet = await bm.createUserWallet(yourTelegramId, 'AEGS');
        console.log(`🎯 New address: ${newWallet.address}`);
        
        // Calculate transfer amount (leave small fee)
        const fee = 0.001;
        const transferAmount = legacyBalance - fee;
        
        if (transferAmount <= 0) {
            console.log('❌ Insufficient funds for transfer (need fee)');
            return;
        }
        
        console.log(`📤 Transferring ${transferAmount} AEGS to new address...`);
        
        // Send funds to new address
        const txid = await client.sendToAddress(newWallet.address, transferAmount);
        console.log(`✅ Transfer successful! TXID: ${txid}`);
        
        console.log('');
        console.log('🎉 TRANSFER COMPLETED!');
        console.log(`   - Amount: ${transferAmount} AEGS`);
        console.log(`   - To: ${newWallet.address}`);
        console.log(`   - TXID: ${txid}`);
        console.log('');
        console.log('⏳ Wait for 1 confirmation, then your bot balance will update!');
        
    } catch (error) {
        console.error('❌ Transfer failed:', error);
    }
}

// Run the transfer
transferLegacyFunds().then(() => {
    console.log('✅ Transfer script completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});