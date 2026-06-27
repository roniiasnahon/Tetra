import ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

function findBadDeps(sourceFile: ts.SourceFile) {
    const issues: string[] = [];
    
    // We want to find top-level variables in the component that are objects, arrays, or functions
    // and are passed to useEffect.
    
    function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
            const exp = node.expression;
            if (ts.isIdentifier(exp) && exp.text === 'useEffect') {
                const args = node.arguments;
                if (args.length === 2 && ts.isArrayLiteralExpression(args[1])) {
                    const deps = args[1].elements;
                    deps.forEach(dep => {
                        // Check if dep is an identifier (e.g. 'config', 'saveChat')
                        if (ts.isIdentifier(dep)) {
                            issues.push(`Line ${sourceFile.getLineAndCharacterOfPosition(dep.getStart()).line + 1}: Dependency '${dep.text}'`);
                        }
                    });
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    
    ts.forEachChild(sourceFile, visit);
    return issues;
}

const file = 'src/App.tsx';
const content = fs.readFileSync(file, 'utf-8');
const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
const issues = findBadDeps(sourceFile);
console.log('App.tsx dependencies:');
issues.forEach(i => console.log('  ', i));
