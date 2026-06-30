import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

let start = 5715;
let stack = 0;
let inCondition = false;

for (let i = 5715; i < lines.length; i++) {
  if (!inCondition && lines[i].includes(' activeTab.fileId && activeTab.mimetype === "application/pdf" ? (')) {
    inCondition = true;
    stack = 1;
    continue;
  }
  if (inCondition) {
    stack += (lines[i].match(/\(/g) || []).length;
    stack -= (lines[i].match(/\)/g) || []).length;
    
    if (stack <= 0) {
      console.log('PDF viewer ends at', i);
      break;
    }
  }
}
