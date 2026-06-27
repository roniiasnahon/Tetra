import * as fs from 'fs';
const app = fs.readFileSync('src/App.tsx', 'utf-8');
const regex = /useEffect\(\(\) => \{[\s\S]*?\}, \[(.*?)\]\);/g;
let match;
while ((match = regex.exec(app)) !== null) {
  if (match[0].includes('set') && !match[0].includes('setInterval') && !match[0].includes('setTimeout')) {
     console.log('Dependencies:', match[1]);
     console.log('Body:', match[0].substring(0, 300));
     console.log('---');
  }
}
