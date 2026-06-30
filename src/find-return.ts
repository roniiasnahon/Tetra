import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('return (')) {
    console.log(`Found return at line ${i + 1}`);
    break;
  }
}
