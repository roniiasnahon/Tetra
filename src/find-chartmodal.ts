import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

let start = 9139 - 1; // 0 indexed
let stack = 0;
let inModal = false;

for (let i = start; i < lines.length; i++) {
  if (lines[i].includes('{isChartModalOpen && (')) {
    inModal = true;
    stack = 1;
    continue;
  }
  if (inModal) {
    stack += (lines[i].match(/<motion\.div/g) || []).length;
    stack -= (lines[i].match(/<\/motion\.div>/g) || []).length;
    if (stack <= 0) {
      console.log('ChartModal ends at', i + 1); // 1 indexed
      break;
    }
  }
}
