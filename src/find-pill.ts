import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

let start = -1;
let end = -1;
let stack = 0;
let started = false;

for (let i = 6450; i < 7100; i++) {
  if (lines[i] && lines[i].includes('Floating Pill Formatting Bar')) {
    start = i;
  }
  if (start !== -1 && !started && lines[i].includes('<div')) {
    started = true;
  }
  
  if (started) {
    stack += (lines[i].match(/<div/g) || []).length;
    stack -= (lines[i].match(/<\/div>/g) || []).length;
    
    if (stack <= 0) {
      end = i;
      break;
    }
  }
}
console.log(start, end);
