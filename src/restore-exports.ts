import * as fs from 'fs';
let content = fs.readFileSync('src/app-utils.tsx', 'utf8');

const functionsToExport = [
  'linkifyHtml',
  'renderLinkifiedText',
  'parseAssistantResponse',
  'extractTextFromPdf',
  'cleanJsonLeakFront',
  'formatAbstractText'
];

for (const fn of functionsToExport) {
  content = content.replace(new RegExp(`^const ${fn} =`, 'gm'), `export const ${fn} =`);
}

fs.writeFileSync('src/app-utils.tsx', content, 'utf8');
console.log('Restored exports in app-utils');
