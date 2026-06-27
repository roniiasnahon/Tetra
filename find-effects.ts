import fs from 'fs';

function findUseEffects(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const results = [];

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('useEffect')) {
            // Find where this useEffect ends and its dependency array
            let bracketCount = 0;
            let foundStart = false;
            let effectBody = "";
            let deps = "NO_DEPS_FOUND";

            for (let j = i; j < lines.length; j++) {
                const line = lines[j];
                if (!foundStart && line.includes('useEffect(() => {')) {
                    foundStart = true;
                    bracketCount = 1;
                    continue;
                }
                if (foundStart) {
                    // Check for matching closing bracket
                    for (let k = 0; k < line.length; k++) {
                        if (line[k] === '{') bracketCount++;
                        if (line[k] === '}') bracketCount--;
                        
                        if (bracketCount === 0) {
                            // We found the end of the arrow function
                            // Now look for the dependency array
                            const remaining = line.slice(k+1);
                            const nextLines = lines.slice(j+1, j+5).join(' ');
                            const fullSuffix = remaining + ' ' + nextLines;
                            const match = fullSuffix.match(/,\s*\[(.*?)\]\);/);
                            if (match) {
                                deps = match[1];
                            } else if (fullSuffix.includes('});')) {
                                deps = "EMPTY_OR_NO_ARRAY";
                            }
                            break;
                        }
                    }
                    if (bracketCount === 0) break;
                }
            }
            results.push({ line: i + 1, deps });
        }
    }
    return results;
}

const files = ['src/App.tsx', 'src/components/SidePanel.tsx', 'src/components/OnboardingScreen.tsx', 'src/components/StatisticsTools.tsx'];
files.forEach(f => {
    console.log(`--- ${f} ---`);
    try {
        const effects = findUseEffects(f);
        effects.forEach(e => console.log(`Line ${e.line}: [${e.deps}]`));
    } catch (err) {
        console.log(`Error reading ${f}`);
    }
});
