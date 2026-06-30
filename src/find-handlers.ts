import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const functionStarts = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const handle') && lines[i].includes('=')) {
    functionStarts.push(lines[i].trim());
  }
}
console.log(`Found ${functionStarts.length} handler functions`);
console.log(functionStarts.slice(0, 50).join('\n'));
