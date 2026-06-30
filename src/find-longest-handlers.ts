import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

let currentHandler = null;
let currentLength = 0;
const lengths: Record<string, number> = {};

for(let i = 166; i < 11570; i++) {
  const line = lines[i].trim();
  if (line.startsWith('const handle') && line.includes('=')) {
    if (currentHandler) {
      lengths[currentHandler] = currentLength;
    }
    currentHandler = line.split('=')[0].replace('const', '').trim();
    currentLength = 0;
  }
  if (currentHandler) {
    currentLength++;
  }
}
if (currentHandler) lengths[currentHandler] = currentLength;

const sorted = Object.entries(lengths).sort((a, b) => b[1] - a[1]);
console.log(sorted.slice(0, 10));
