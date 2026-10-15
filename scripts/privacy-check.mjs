import fs from 'node:fs';
const assets=['main.js','manifest.json'];
for(const file of assets){const s=fs.readFileSync(file,'utf8');for(const p of [/\/Users\/[A-Za-z0-9_-]+\//,/192\.168\.\d+\.\d+/,/[a-f0-9]{64}/,/couchDB_PASSWORD/,/BEGIN (RSA |EC )?PRIVATE KEY/])if(p.test(s))throw Error(`Private data pattern in ${file}`);}
if(fs.existsSync('data.json'))throw Error('Never distribute client settings');
console.log('Release assets: privacy allowlist checks passed.');
