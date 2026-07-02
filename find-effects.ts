import ts from 'typescript';
import * as fs from 'fs';

function findRenderSetState(file: string) {
    const content = fs.readFileSync(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    
    function visit(node: ts.Node, inComponentBody: boolean) {
        let isComponent = false;
        
        // Identify top-level component function
        if (ts.isFunctionDeclaration(node) && node.name && node.name.text[0] === node.name.text[0].toUpperCase()) {
            isComponent = true;
        } else if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name) && node.name.text[0] === node.name.text[0].toUpperCase()) {
            if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
                isComponent = true;
            }
        }
        
        const isNestedFunc = ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node);
        
        // If we are currently inside a component body, and we hit a nested function, we are no longer in the render body.
        const currentlyInRender = inComponentBody && !isNestedFunc;
        const newInComponentBody = isComponent || currentlyInRender;
        
        if (ts.isCallExpression(node) && newInComponentBody) {
            const exp = node.expression;
            if (ts.isIdentifier(exp) && exp.text.startsWith('set')) {
                const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                console.log(`[${file}] Line ${lineAndChar.line + 1}: Direct call in render: ${exp.text}`);
            }
        }
        
        ts.forEachChild(node, child => visit(child, newInComponentBody));
    }
    
    ts.forEachChild(sourceFile, child => visit(child, false));
}

findRenderSetState('src/App.tsx');
findRenderSetState('src/components/ChatPanel.tsx');
findRenderSetState('src/components/MainChat.tsx');
findRenderSetState('src/components/SidebarPanel.tsx');
