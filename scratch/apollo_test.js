import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

const apiKey = process.env.APOLLO_API_KEY;
if (!apiKey) {
    console.error('No APOLLO_API_KEY in env');
    process.exit(1);
}

async function test(name, url, headers, body = null) {
    console.log(`\nTesting ${name}...`);
    try {
        const options = {
            method: body ? 'POST' : 'GET',
            headers,
        };
        if (body) options.body = JSON.stringify(body);
        
        const res = await fetch(url, options);
        console.log(`Status: ${res.status} ${res.statusText}`);
        if (!res.ok) {
            console.log(await res.text());
        } else {
            console.log('Success!');
        }
    } catch (e) {
        console.error(e);
    }
}

async function run() {
    // Test 1: Health check (GET)
    await test('Health check (GET) with api_key in URL', `https://api.apollo.io/v1/auth/health?api_key=${apiKey}`, {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
    });

    // Test 2: Health check (GET) with Bearer
    await test('Health check (GET) with Bearer', `https://api.apollo.io/v1/auth/health`, {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    });

    // Test 3: Search with x-api-key
    await test('Search with x-api-key', 'https://api.apollo.io/api/v1/mixed_people/search', {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'x-api-key': apiKey
    }, {
        q_organization_domains: 'apple.com',
        page: 1
    });

    // Test 4: Search with Bearer
    await test('Search with Bearer', 'https://api.apollo.io/api/v1/mixed_people/search', {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    }, {
        q_organization_domains: 'apple.com',
        page: 1
    });

}

run();
