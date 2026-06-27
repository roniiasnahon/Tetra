import ts from 'typescript';
import * as fs from 'fs';

function analyzeFile(file: string) {
    const content = fs.readFileSync(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    
    console.log(`\n================ ${file} ================`);
    
    function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
            const exp = node.expression;
            if (ts.isIdentifier(exp) && exp.text === 'useEffect') {
                const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                console.log(`useEffect at line ${line}:`);
                const body = node.arguments[0];
                const deps = node.arguments[1];
                
                // Find all setX calls inside the body
                const setters: string[] = [];
                function findSetters(n: ts.Node) {
                    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
                        const name = n.expression.text;
                        if (name.startsWith('set') && !setters.includes(name)) {
                            setters.push(name);
                        }
                    }
                    ts.forEachChild(n, findSetters);
                }
                if (body) findSetters(body);
                
                // Print dependencies
                const depNames: string[] = [];
                if (deps && ts.isArrayLiteralExpression(deps)) {
                    deps.elements.forEach(el => {
                        depNames.push(el.getText(sourceFile));
                    });
                }
                
                console.log(`  Setters called: ${setters.join(', ') || 'none'}`);
                console.log(`  Dependencies: ${depNames.join(', ') || 'none (or empty array)'}`);
                
                // Warn if a setter matches any of the dependencies (direct loop)
                const stateVars = setters.map(s => {
                    // e.g. setMyVar -> myVar
                    const firstLower = s[3].toLowerCase();
                    return firstLower + s.substring(4);
                });
                
                stateVars.forEach((sv, idx) => {
                    if (depNames.includes(sv)) {
                        console.log(`  ⚠️ WARNING: State variable '${sv}' is updated by '${setters[idx]}' and is also in the dependency array!`);
                    }
                });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
}

const files = ['src/App.tsx', 'src/components/SidePanel.tsx', 'src/components/OnboardingScreen.tsx'];
for (const f of files) {
    if (fs.existsSync(f)) analyzeFile(f);
}
