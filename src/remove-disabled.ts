import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const newLines = [...lines.slice(0, 5301), ...lines.slice(6388)];
fs.writeFileSync('src/App.tsx', newLines.join('\n'), 'utf8');
console.log("Removed lines 5301-6387");
