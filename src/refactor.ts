import * as fs from 'fs';
const app = fs.readFileSync('src/App.tsx', 'utf8');
const startStr = `const TRANSLATIONS = {`;
const endStr = `};`;

const startIndex = app.indexOf(startStr);
let endIndex = app.indexOf(endStr, startIndex);
// wait, if I use regex to match TRANSLATIONS up to the end:
const match = app.match(/const TRANSLATIONS = \{[\s\S]*?\n\};\n/);
if (match) {
  const newApp = "import { TRANSLATIONS } from './translations';\n" + app.replace(match[0], '');
  fs.writeFileSync('src/App.tsx', newApp, 'utf8');
  console.log("Replaced TRANSLATIONS");
} else {
  console.log("Could not find TRANSLATIONS");
}
