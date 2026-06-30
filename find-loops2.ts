import * as fs from 'fs';
import * as path from 'path';

function checkFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // A crude regex to find useEffects and their dependency arrays
  const regex = /useEffect\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[(.*?)\]\s*\)/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const body = match[1];
    const depsStr = match[2];
    const deps = depsStr.split(',').map(d => d.trim()).filter(d => d);
    
    const setCalls = Array.from(body.matchAll(/set([A-Z]\w*)\(/g)).map(m => m[1]);
    
    for (const setCall of setCalls) {
      const stateVar = setCall.charAt(0).toLowerCase() + setCall.slice(1);
      if (deps.includes(stateVar)) {
        console.log(`Loop Risk in ${filePath}: set${setCall} depends on ${stateVar}`);
        console.log(`Deps: ${deps.join(', ')}`);
        console.log('---');
      }
    }
    
    // Also check for array/object literals in deps
    for (const dep of deps) {
      if (dep.includes('[') || dep.includes('{')) {
        console.log(`Literal Dep Risk in ${filePath}: ${dep}`);
      }
    }
  }
}

const walk = (dir: string) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      checkFile(fullPath);
    }
  }
};

walk('src');
