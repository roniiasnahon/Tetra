import fs from 'fs';
const file = 'node_modules/react-dom/cjs/react-dom.development.js';
if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace('throw Error( "Maximum update depth exceeded', 'console.trace("Max depth exceeded"); throw Error( "Maximum update depth exceeded');
    fs.writeFileSync(file, content);
    console.log("Patched react-dom");
} else {
    console.log("Not found");
}
