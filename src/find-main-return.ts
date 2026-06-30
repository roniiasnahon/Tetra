import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

for (let i = 5143; i < 11571; i++) {
  if (lines[i].startsWith('  return (')) {
    console.log(`Main return is at line ${i + 1}`);
    console.log(lines.slice(i, i+10).join('\n'));
    break;
  }
}
