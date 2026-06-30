import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const stateVars = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const [') && lines[i].includes('useState')) {
    stateVars.push(lines[i].trim());
  }
}
console.log(stateVars.join('\n'));
