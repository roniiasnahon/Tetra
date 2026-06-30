import ts from 'typescript';
import * as fs from 'fs';

function findDirectSetState(sourceFile: ts.SourceFile) {
    const issues: string[] = [];

    function visit(node: ts.Node, depthFromComponent: number) {
        if (ts.isCallExpression(node)) {
            const exp = node.expression;
            if (ts.isIdentifier(exp) && exp.text.startsWith('set')) {
                // If depth is 0, it means we are directly inside the component body,
                // without any intervening functions!
                if (depthFromComponent === 0) {
                    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    issues.push(`Line ${lineAndChar.line + 1}: Direct setState in render body: ${exp.text}`);
                }
            }
        }
        
        let newDepth = depthFromComponent;
        if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            // Is it the component itself?
            // Component is usually at depth -1, so it becomes 0.
            newDepth = depthFromComponent + 1;
        }
        
        ts.forEachChild(node, child => visit(child, newDepth));
    }
    
    ts.forEachChild(sourceFile, child => visit(child, -1));
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
