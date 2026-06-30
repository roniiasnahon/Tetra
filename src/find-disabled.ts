import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
let count = 0;
let stack = 0;
let start = 0;
for (let i = 5300; i < 6000; i++) {
  if (lines[i].includes('{false && (')) {
    start = i;
    stack = 1;
  } else if (start > 0) {
    stack += (lines[i].match(/\(/g) || []).length;
    stack -= (lines[i].match(/\)/g) || []).length;
    if (stack <= 0) {
      console.log('Disabled block ends at', i);
      break;
    }
  }
}
