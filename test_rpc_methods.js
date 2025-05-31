#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

async function testRPCMethods() {
    const coins = [
        { name: 'AEGS', port: process.env.AEGS_RPC_PORT, user: process.env.AEGS_RPC_USER, pass: process.env.AEGS_RPC_PASS },
        { name: 'SHIC', port: process.env.SHIC_RPC_PORT, user: process.env.SHIC_RPC_USER, pass: process.env.SHIC_RPC_PASS },
        { name: 'PEPE', port: process.env.PEPE_RPC_PORT, user: process.env.PEPE_RPC_USER, pass: process.env.PEPE_RPC_PASS },
        { name: 'ADVC', port: process.env.ADVC_RPC_PORT, user: process.env.ADVC_RPC_USER, pass: process.env.ADVC_RPC_PASS }
    ];

    for (const coin of coins) {
        console.log(`\n🔍 Testing ${coin.name} RPC methods...`);
        
        const rpcConfig = {
            method: 'post',
            url: `http://127.0.0.1:${coin.port}/`,
            auth: {
                username: coin.user,
                password: coin.pass
            },
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        };

        // Test basic methods
        const methods = [
            'getblockcount',
            'help',
            'getwalletinfo',
            'listwallets',
            'getnewaddress',
            'getaccountaddress',
            'getaddressesbyaccount'
        ];

        for (const method of methods) {
            try {
                const response = await axios({
                    ...rpcConfig,
                    data: {
                        jsonrpc: '1.0',
                        id: 'test',
                        method: method,
                        params: method === 'getaccountaddress' ? [''] : method === 'getaddressesbyaccount' ? [''] : []
                    }
                });
                
                if (method === 'help') {
                    console.log(`✅ ${method}: Available (${response.data.result.split('\n').length} commands)`);
                } else if (method === 'listwallets') {
                    console.log(`✅ ${method}: ${JSON.stringify(response.data.result)}`);
                } else {
                    console.log(`✅ ${method}: ${response.data.result}`);
                }
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    console.log(`❌ ${method}: Method not found (404)`);
                } else if (error.response && error.response.data && error.response.data.error) {
                    console.log(`⚠️  ${method}: ${error.response.data.error.message}`);
                } else {
                    console.log(`❌ ${method}: ${error.message}`);
                }
            }
        }
    }
}

testRPCMethods().catch(console.error);