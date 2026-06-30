import * as fs from 'fs';

function checkDirectSetState(file) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/\bset[A-Z]\w*\(/) && !line.includes('useEffect') && !line.includes('onClick') && !line.includes('onChange') && !line.includes('=>') && !line.match(/function\s+\w+\s*\(/) && !line.includes('const ') && !line.includes('let ') && !line.includes('.then(') && !line.includes('.catch(') && !line.includes('setTimeout') && !line.includes('setInterval') && !line.includes('if (') && !line.includes('} else')) {
      // Just heuristically check for a bare setState call.
      // E.g. setTabs(...) at the top level of a component.
    }
  }
}
