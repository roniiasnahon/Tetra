const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(getFiles(file));
    } else { 
      if (file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}

const files = getFiles('src');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('useEffect(')) {
      let foundDeps = false;
      let hasNoDeps = false;
      for (let j = i; j < Math.min(i + 100, lines.length); j++) {
        if (lines[j].match(/\},\s*\[/)) {
           foundDeps = true;
           break;
        } else if (lines[j].match(/\}\s*\)\s*;/)) {
           hasNoDeps = true;
           break;
        }
      }
      if (hasNoDeps && !foundDeps) {
         console.log(`${file}:${i} - No deps array found!`);
      }
    }
  }
});
