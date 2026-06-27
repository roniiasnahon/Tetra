import ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

function findUseEffects(sourceFile: ts.SourceFile) {
    const issues: string[] = [];

    function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
            const exp = node.expression;
            if (ts.isIdentifier(exp) && exp.text === 'useEffect' ||
                (ts.isPropertyAccessExpression(exp) && exp.name.text === 'useEffect')) {
                
                const args = node.arguments;
                if (args.length === 1) {
                    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    issues.push(`Line ${lineAndChar.line + 1}: No dependency array`);
                } else if (args.length === 2) {
                    const deps = args[1];
                    if (ts.isArrayLiteralExpression(deps)) {
                        // Check if any element is an object literal or array literal
                        deps.elements.forEach(el => {
                            if (ts.isObjectLiteralExpression(el) || ts.isArrayLiteralExpression(el)) {
                                const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                                issues.push(`Line ${lineAndChar.line + 1}: Object/Array literal in deps`);
                            }
                        });
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    
    visit(sourceFile);
    return issues;
}

const files = ['src/App.tsx', 'src/components/OnboardingScreen.tsx', 'src/components/DynamicShimmer.tsx', 'src/components/DesktopAuthBridge.tsx', 'src/components/TypewriterMarkdown.tsx', 'src/components/MainChat.tsx', 'src/components/AudioVisualizerPlayer.tsx', 'src/components/SidePanel.tsx', 'src/components/Settings.tsx', 'src/components/Toast.tsx', 'src/components/StatisticsTools.tsx', 'src/components/GetStartedChecklist.tsx', 'src/components/AuthenticationScreen.tsx'];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const issues = findUseEffects(sourceFile);
    if (issues.length > 0) {
        console.log(file);
        issues.forEach(i => console.log('  ', i));
    }
}
