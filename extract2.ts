import * as fs from 'fs';
const files = ['src/components/OnboardingScreen.tsx', 'src/components/DynamicShimmer.tsx', 'src/components/DesktopAuthBridge.tsx', 'src/components/TypewriterMarkdown.tsx', 'src/components/MainChat.tsx', 'src/components/AudioVisualizerPlayer.tsx', 'src/components/SidePanel.tsx', 'src/components/Settings.tsx', 'src/components/Toast.tsx', 'src/components/StatisticsTools.tsx', 'src/components/GetStartedChecklist.tsx', 'src/components/AuthenticationScreen.tsx'];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf-8');
  const regex = /useEffect\(\(\) => \{[\s\S]*?\}\);/g; // Matches useEffect without dependencies
  let match;
  while ((match = regex.exec(content)) !== null) {
      console.log('No deps in', file);
      console.log('Body:', match[0].substring(0, 300));
      console.log('---');
  }
}
