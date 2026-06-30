import * as fs from 'fs';
const app = fs.readFileSync('src/App.tsx', 'utf8');

const startStr = `const linkifyHtml = (html: string): string => {`;
const endStr = `export const formatAbstractText = (text: string) => {`;
const endFunctionStr = `return formatted.trim();\n};\n`; // we need the end of formatAbstractText

const startIndex = app.indexOf(startStr);
const abstractFuncIndex = app.indexOf(endStr, startIndex);
const endIndex = app.indexOf(endFunctionStr, abstractFuncIndex) + endFunctionStr.length;

if (startIndex !== -1 && endIndex !== -1) {
  const codeToExtract = app.substring(startIndex, endIndex);
  
  const utilsCode = `import React from 'react';\nimport { pdfjs } from 'react-pdf';\n\n` + codeToExtract.replace(/const /g, 'export const ').replace(/export export/g, 'export');
  fs.writeFileSync('src/app-utils.tsx', utilsCode, 'utf8');
  
  // Now replace in App.tsx
  const newApp = "import { linkifyHtml, renderLinkifiedText, parseAssistantResponse, extractTextFromPdf, cleanJsonLeakFront, PDF_CACHE_NAME, preCachePdfFile, getOrCreateCachedPdf, formatAbstractText } from './app-utils';\n" + 
    app.substring(0, startIndex) + app.substring(endIndex);
  
  fs.writeFileSync('src/App.tsx', newApp, 'utf8');
  console.log("Extracted utils");
} else {
  console.log("Could not find bounds", startIndex, abstractFuncIndex, endIndex);
}
