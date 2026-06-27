import * as fs from 'fs';

// Since writing a full AST scope analyzer is hard, we can just look at `useEffect` dependency arrays
// and check if any of the dependencies are functions or objects defined in the component body.
// But another way is to look at all useMemos and useCallbacks.
// Wait! Is there an array literal or object literal passed to a component that uses it in useEffect?
// Let's just find the component causing the error!
// We can patch console.error in index.html or main.tsx to print the component stack!

const mainTsxPath = 'src/main.tsx';
let main = fs.readFileSync(mainTsxPath, 'utf8');

if (!main.includes('const originalError')) {
    main = `
const originalError = console.error;
console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Maximum update depth exceeded')) {
        console.trace("Max update depth exceeded trace:");
    }
    originalError(...args);
};
` + main;
    fs.writeFileSync(mainTsxPath, main);
}
