import * as fs from 'fs';
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const regex = /useEffect\(\(\) => \{[\s\S]*?\}\);/g;
let match;
while ((match = regex.exec(content)) !== null) {
    if (!match[0].endsWith('],')) {
      console.log('App.tsx No deps:', match[0].substring(0, 300));
      console.log('---');
    }
}
