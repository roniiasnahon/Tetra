import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const functionStarts = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('export default function App') || lines[i].startsWith('function ') || lines[i].match(/const [a-zA-Z0-9_]+ =/)) {
    functionStarts.push({ line: i + 1, text: lines[i].substring(0, 50) });
  }
}
console.log(functionStarts.slice(0, 30));
