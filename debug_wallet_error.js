#!/usr/bin/env node

require('dotenv').config();
const WalletManager = require('./src/wallet/wallet-manager');

async function debugWalletError() {
    console.log('🐛 DEBUGGING WALLET CREATION ERROR');
    console.log('==================================\n');

    const walletManager = new WalletManager();
    const TEST_USER_ID = 1651155083;
    const TEST_PASSWORD = 'TestPassword123!';
    
    try {
        console.log('📝 Attempting to create wallet...');
        const result = await walletManager.createWallet(TEST_USER_ID, TEST_PASSWORD);
        
        console.log('✅ Wallet creation result:', result);
        
        if (result.success) {
            console.log('🎉 SUCCESS! Wallet created properly');
            console.log('Mnemonic:', result.mnemonic);
            console.log('Addresses:', result.addresses);
        } else {
            console.log('❌ FAILED! Error:', result.error);
        }
        
    } catch (error) {
        console.log('💥 EXCEPTION during wallet creation:');
        console.log('Error message:', error.message);
        console.log('Stack trace:', error.stack);
    }
}

debugWalletError().catch(console.error);