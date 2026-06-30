import * as fs from 'fs';
import * as path from 'path';

function checkFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let inEffect = false;
  let effectLines: string[] = [];
  let effectStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('useEffect(() => {') || line.match(/useEffect\(\s*\w*\s*\(\)\s*=>\s*\{/)) {
      inEffect = true;
      effectLines = [line];
      effectStart = i;
    } else if (inEffect) {
      effectLines.push(line);
      if (line.match(/^\s*\}, \[(.*?)\]\);/)) {
        inEffect = false;
        const depsMatch = line.match(/^\s*\}, \[(.*?)\]\);/);
        const depsStr = depsMatch ? depsMatch[1] : '';
        const deps = depsStr.split(',').map(d => d.trim()).filter(d => d);
        
        // Check if any setXXX is called inside
        const text = effectLines.join('\n');
        const setCalls = Array.from(text.matchAll(/set([A-Z]\w*)\(/g)).map(m => m[1]);
        
        for (const setCall of setCalls) {
          const stateVar = setCall.charAt(0).toLowerCase() + setCall.slice(1);
          if (deps.includes(stateVar)) {
            console.log(`WARNING: File ${filePath}, Line ${effectStart + 1}`);
            console.log(`useEffect calls set${setCall} but depends on ${stateVar}!`);
            console.log(`Deps: ${deps.join(', ')}`);
            console.log('---');
          }
        }
      } else if (line.match(/^\s*\}\);/)) {
        inEffect = false;
        console.log(`WARNING: File ${filePath}, Line ${effectStart + 1}`);
        console.log(`useEffect with NO dependencies!`);
        console.log('---');
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
