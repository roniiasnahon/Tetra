import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
const importStatement = `import { DocumentToolbar } from "./components/DocumentToolbar";\n`;
if (!content.includes('DocumentToolbar')) {
  // insert after first import
  content = content.replace(/(import.*?\n)/, `$1${importStatement}`);
}

const lines = content.split('\n');
const startIndex = lines.findIndex(l => l.includes('Floating Pill Formatting Bar'));
let endIndex = -1;
for (let i = startIndex; i < lines.length; i++) {
  if (lines[i].includes('Independent Scrollable Document Surface')) {
    endIndex = i - 1; // remove up to the line before this
    break;
  }
}

console.log('Start pill:', startIndex, 'End pill:', endIndex);

const toolbarCode = `                <DocumentToolbar
                  editorFont={editorFont}
                  setEditorFont={setEditorFont}
                  currentSelectionSize={currentSelectionSize}
                  changeSelectedFontSize={changeSelectedFontSize}
                  handleFormat={handleFormat}
                  editorAlign={editorAlign}
                  setEditorAlign={setEditorAlign}
                  setIsTablePickerOpen={setIsTablePickerOpen}
                  isTablePickerOpen={isTablePickerOpen}
                  tableGrid={tableGrid}
                  setTableGrid={setTableGrid}
                  handleInsertTable={handleInsertTable}
                  setIsChartModalOpen={setIsChartModalOpen}
                  setChartBeingEdited={setChartBeingEdited}
                />`;

// Replace the Pill with nothing (we'll move toolbarCode above)
lines.splice(startIndex, endIndex - startIndex + 1);

// Find "Document Editor Header Tools"
const headerIndex = lines.findIndex(l => l.includes('Document Editor Header Tools'));
// Wait, we want the toolbar to flow below or around the header tools.
// The header tools are absolute, so they don't affect flex flow.
// We can insert `toolbarCode` right before "Document Editor Header Tools"
lines.splice(headerIndex, 0, toolbarCode);

fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf8');
console.log('Updated App.tsx');
