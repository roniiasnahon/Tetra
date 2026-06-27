import ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

function findDirectSetState(sourceFile: ts.SourceFile) {
    const issues: string[] = [];

    function visit(node: ts.Node, inFunctionBody: boolean) {
        if (ts.isCallExpression(node) && inFunctionBody) {
            const exp = node.expression;
            if (ts.isIdentifier(exp) && exp.text.startsWith('set')) {
                // Is this directly in the component body?
                // We're checking if we're not inside a useEffect, useLayoutEffect, useCallback, etc.
                // or an arrow function that is an event handler.
                let parent = node.parent;
                let isInsideEffectOrHandler = false;
                while (parent && !ts.isFunctionDeclaration(parent) && !ts.isArrowFunction(parent) && !ts.isFunctionExpression(parent)) {
                    parent = parent.parent;
                }
                
                // If the immediate function wrapper is a React component, this is a direct setState.
                // How to know if it's a component? It's usually the top-level function.
                if (parent) {
                    let grandParent = parent.parent;
                    let isTopLevel = false;
                    if (ts.isVariableDeclaration(grandParent) && ts.isVariableStatement(grandParent.parent.parent)) {
                        isTopLevel = true; // const MyComp = () => { ... }
                    } else if (ts.isSourceFile(parent.parent)) {
                        isTopLevel = true; // function MyComp() { ... }
                    }
                    
                    if (isTopLevel) {
                        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                        issues.push(`Line ${lineAndChar.line + 1}: Direct setState in render body: ${exp.text}`);
                    }
                }
            }
        }
        
        // We only care about function bodies
        const isFunc = ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node);
        ts.forEachChild(node, child => visit(child, inFunctionBody || isFunc));
    }
    
    ts.forEachChild(sourceFile, child => visit(child, false));
    return issues;
}

const files = ['src/App.tsx', 'src/components/OnboardingScreen.tsx', 'src/components/DynamicShimmer.tsx', 'src/components/DesktopAuthBridge.tsx', 'src/components/TypewriterMarkdown.tsx', 'src/components/MainChat.tsx', 'src/components/AudioVisualizerPlayer.tsx', 'src/components/SidePanel.tsx', 'src/components/Settings.tsx', 'src/components/Toast.tsx', 'src/components/StatisticsTools.tsx', 'src/components/GetStartedChecklist.tsx', 'src/components/AuthenticationScreen.tsx'];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const issues = findDirectSetState(sourceFile);
    if (issues.length > 0) {
        console.log(file);
        issues.forEach(i => console.log('  ', i));
    }
}
