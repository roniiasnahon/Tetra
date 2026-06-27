import * as fs from 'fs';
import * as path from 'path';

const serverTsPath = path.resolve(process.cwd(), 'server.ts');
let content = fs.readFileSync(serverTsPath, 'utf-8');

// Replace loadDownloadedPapersCache entirely
content = content.replace(/async function loadDownloadedPapersCache\(\) \{[\s\S]*?\}\n/g, '');

fs.writeFileSync(serverTsPath, content, 'utf-8');
console.log('Fixed loadDownloadedPapersCache!');
