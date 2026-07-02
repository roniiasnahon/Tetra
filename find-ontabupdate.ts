import ts from 'typescript';
import * as fs from 'fs';

function findRender(file: string) {
    const content = fs.readFileSync(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    
    function visit(node: ts.Node, depth: number) {
        let newDepth = depth;
        if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            newDepth = depth + 1;
        }
        
        if (ts.isCallExpression(node) && newDepth === 1) {
            const exp = node.expression;
            if (ts.isIdentifier(exp) && (exp.text.startsWith('set') || exp.text === 'onTabUpdate' || exp.text === 'syncWithParent' || exp.text === 'handleSendMessage')) {
                const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                console.log(`[${file}] Line ${lineAndChar.line + 1}: Direct call in render: ${exp.text}`);
            }
        }
        
        ts.forEachChild(node, child => visit(child, newDepth));
    }
    
    ts.forEachChild(sourceFile, child => visit(child, 0));
}

findRender('src/App.tsx');
findRender('src/components/ChatPanel.tsx');
findRender('src/components/MainChat.tsx');
findRender('src/components/SidebarPanel.tsx');
