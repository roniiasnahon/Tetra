import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

let start = -1;
let end = -1;
let stack = 0;

for (let i = 5671; i < lines.length; i++) {
  if (lines[i].includes('=== "library_LEGACY"')) {
    start = i;
    stack = 1;
    continue;
  }
  if (start !== -1) {
    stack += (lines[i].match(/\(/g) || []).length;
    stack -= (lines[i].match(/\)/g) || []).length;
    
    if (stack <= 0) {
      end = i;
      break;
    }
  }
}

console.log("library_LEGACY start:", start, "end:", end);
