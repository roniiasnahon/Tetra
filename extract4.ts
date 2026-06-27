import * as fs from 'fs';
const files = ['src/App.tsx', 'src/components/OnboardingScreen.tsx', 'src/components/DynamicShimmer.tsx', 'src/components/DesktopAuthBridge.tsx', 'src/components/TypewriterMarkdown.tsx', 'src/components/MainChat.tsx', 'src/components/AudioVisualizerPlayer.tsx', 'src/components/SidePanel.tsx', 'src/components/Settings.tsx', 'src/components/Toast.tsx', 'src/components/StatisticsTools.tsx', 'src/components/GetStartedChecklist.tsx', 'src/components/AuthenticationScreen.tsx'];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf-8');
  const regex = /useEffect\(\(\) => \{([\s\S]*?)\}, \[(.*?)\]\);/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
      const body = match[1];
      const deps = match[2];
      
      // Look for setSomething( in the direct body (not inside a nested function/listener)
      // This is a rough heuristic.
      const directSet = body.match(/set[A-Z][a-zA-Z0-9_]+\(/g);
      if (directSet) {
          // Check if it's not wrapped in a setTimeout/setInterval/addEventListener
          console.log(`[${file}] deps: [${deps}]`);
          console.log(body.substring(0, 300));
          console.log('---');
      }
  }
}
