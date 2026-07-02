const ts = require('typescript');
const fs = require('fs');

function findDirect(file) {
    const content = fs.readFileSync(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    
    const issues = [];
    
    function visit(node, depth) {
        // if it's a function declaration, arrow function, or method, depth increases
        let newDepth = depth;
        if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            newDepth = depth + 1;
        }
        
        if (ts.isCallExpression(node) && newDepth === 1) { // depth 1 is the component body
            const exp = node.expression;
            if (ts.isIdentifier(exp) && exp.text.startsWith('set')) {
                const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                issues.push(`Line ${lineAndChar.line + 1}: Direct call: ${exp.text}`);
            }
        }
        
        ts.forEachChild(node, child => visit(child, newDepth));
    }
    
    ts.forEachChild(sourceFile, child => visit(child, 0));
    if (issues.length) {
        console.log(file);
        issues.forEach(i => console.log('  ', i));
    }
}

findDirect('src/components/ChatPanel.tsx');
findDirect('src/components/MainChat.tsx');
findDirect('src/App.tsx');
