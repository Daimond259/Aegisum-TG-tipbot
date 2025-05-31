#!/usr/bin/env node

// Load environment variables from the correct path
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('🔍 DEBUGGING ENVIRONMENT VARIABLES');
console.log('==================================\n');

// Check ENCRYPTION_KEY
const encKey = process.env.ENCRYPTION_KEY;
console.log('ENCRYPTION_KEY:');
console.log('  Value:', encKey);
console.log('  Length:', encKey ? encKey.length : 'undefined');
console.log('  Type:', typeof encKey);
console.log('');

// Check RPC configurations
const coins = ['AEGS', 'SHIC', 'PEPE', 'ADVC'];

console.log('RPC CONFIGURATIONS:');
console.log('==================');

for (const coin of coins) {
    console.log(`\n${coin}:`);
    console.log(`  HOST: ${process.env[`${coin}_RPC_HOST`] || 'MISSING'}`);
    console.log(`  PORT: ${process.env[`${coin}_RPC_PORT`] || 'MISSING'}`);
    console.log(`  USER: ${process.env[`${coin}_RPC_USER`] || 'MISSING'}`);
    console.log(`  PASS: ${process.env[`${coin}_RPC_PASS`] ? '[SET]' : 'MISSING'}`);
    
    const hasAll = process.env[`${coin}_RPC_HOST`] && 
                   process.env[`${coin}_RPC_PORT`] && 
                   process.env[`${coin}_RPC_USER`] && 
                   process.env[`${coin}_RPC_PASS`];
    console.log(`  STATUS: ${hasAll ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);
}

console.log('\n🔧 TELEGRAM BOT:');
console.log(`  TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '[SET]' : 'MISSING'}`);

console.log('\n📊 DATABASE:');
console.log(`  PATH: ${process.env.DATABASE_PATH || 'MISSING'}`);