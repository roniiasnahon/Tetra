import * as fs from 'fs';

const appLines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const chartLines = appLines.slice(9139, 9652);

let modalContent = fs.readFileSync('src/components/ChartModal.tsx', 'utf8');
modalContent = modalContent.replace(
  '    <motion.div\n      initial={{ opacity: 0 }}\n      animate={{ opacity: 1 }}\n      exit={{ opacity: 0 }}\n      role="dialog"\n      aria-modal="true"\n      className="fixed inset-0 bg-black/75 z-[110] flex items-center justify-center p-4"\n    >\n      {/* We will inject the rest of the modal JSX here */}\n    </motion.div>',
  chartLines.join('\n')
);

fs.writeFileSync('src/components/ChartModal.tsx', modalContent, 'utf8');
console.log('Injected chart modal content');
