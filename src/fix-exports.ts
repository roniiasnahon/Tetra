import * as fs from 'fs';
let content = fs.readFileSync('src/app-utils.tsx', 'utf8');

// The error was because I used `export const` inside a function body.
// I will just replace `  export const ` with `  const ` and `    export const ` with `    const ` globally.

content = content.replace(/^(\s+)export const /gm, '$1const ');
content = content.replace(/^(\s+)export let /gm, '$1let ');

fs.writeFileSync('src/app-utils.tsx', content, 'utf8');
console.log('Fixed exports in app-utils');
