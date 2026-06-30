import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
// We want to keep 0 to 5671.
// We want to remove 5672 to 6539.
// We want to keep 6540 to end.
const newLines = [...lines.slice(0, 5671), ...lines.slice(6539)];
fs.writeFileSync('src/App.tsx', newLines.join('\n'), 'utf8');
console.log("Removed lines 5672-6539");
