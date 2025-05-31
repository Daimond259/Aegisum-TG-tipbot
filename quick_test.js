#!/usr/bin/env node

require('dotenv').config();

async function quickTest() {
    console.log('🚀 QUICK DAEMON TEST');
    console.log('===================\n');

    // Test each daemon directly
    const axios = require('axios');
    
    const daemons = {
        'AEGS': { port: process.env.AEGS_RPC_PORT || 8332, user: process.env.AEGS_RPC_USER, pass: process.env.AEGS_RPC_PASS },
        'SHIC': { port: process.env.SHIC_RPC_PORT || 8333, user: process.env.SHIC_RPC_USER, pass: process.env.SHIC_RPC_PASS },
        'PEPE': { port: process.env.PEPE_RPC_PORT || 8334, user: process.env.PEPE_RPC_USER, pass: process.env.PEPE_RPC_PASS },
        'ADVC': { port: process.env.ADVC_RPC_PORT || 8335, user: process.env.ADVC_RPC_USER, pass: process.env.ADVC_RPC_PASS }
    };

    for (const [coin, config] of Object.entries(daemons)) {
        console.log(`\n🔍 Testing ${coin} (port ${config.port}):`);
        
        try {
            const response = await axios.post(`http://127.0.0.1:${config.port}/`, {
                jsonrpc: '1.0',
                id: 'test',
                method: 'getinfo',
                params: []
            }, {
                auth: {
                    username: config.user,
                    password: config.pass
                },
                timeout: 5000
            });

            const info = response.data.result;
            console.log(`✅ ${coin}: Connected - Blocks: ${info.blocks || info.blockcount}`);
            
            // Test address generation
            const addrResponse = await axios.post(`http://127.0.0.1:${config.port}/`, {
                jsonrpc: '1.0',
                id: 'test',
                method: 'getnewaddress',
                params: ['test']
            }, {
                auth: {
                    username: config.user,
                    password: config.pass
                },
                timeout: 5000
            });

            console.log(`📍 ${coin}: New address: ${addrResponse.data.result}`);

        } catch (error) {
            if (error.response) {
                console.log(`❌ ${coin}: HTTP ${error.response.status} - ${error.response.statusText}`);
            } else if (error.code === 'ECONNREFUSED') {
                console.log(`❌ ${coin}: Connection refused (daemon not running?)`);
            } else {
                console.log(`❌ ${coin}: ${error.message}`);
            }
        }
    }
}

quickTest().catch(console.error);