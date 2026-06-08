const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "import { Navigation2, Search, ExternalLink, Library, Play, Home, FolderOpen, PenTool, LayoutDashboard } from 'lucide-react';",
  "import { Navigation2, Search, ExternalLink, Library, Play, Home, FolderOpen, PenTool, LayoutDashboard } from 'lucide-react';\nimport { StatisticsTools } from './components/StatisticsTools';"
);

content = content.replace(
  "import { Edit2, ExternalLink, Unlink, Link as LinkIcon, PanelRight, Coffee, X } from 'lucide-react';",
  "import { Edit2, ExternalLink, Unlink, Link as LinkIcon, PanelRight, Coffee, X } from 'lucide-react';\nimport { StatisticsTools } from './components/StatisticsTools';"
);

content = content.replace(
  "const [sidebarView, setSidebarView] = useState<'files' | 'chats' | 'search' | 'library'>('files');",
  "const [sidebarView, setSidebarView] = useState<'files' | 'chats' | 'tools' | 'library'>('files');"
);

content = content.replace(
  "{ icon: 'ph:magnifying-glass', label: 'Search', onClick: () => setSidebarView('search'), active: sidebarView === 'search' }",
  "{ icon: 'ph:calculator', label: 'Tools', onClick: () => setSidebarView('tools'), active: sidebarView === 'tools' }"
);

const searchStart = content.indexOf("{sidebarView === 'search' && (");
if (searchStart > -1) {
  const replacement = `{sidebarView === 'tools' && (
                <div className="space-y-4 px-2">
                  <h3 className="text-[10px] text-[#52525b] uppercase font-bold tracking-wider mb-2">Statistics Tools</h3>
                  <StatisticsTools />
                </div>
              )}`;
  // Finding the end of this block is tricky but we know it ends right before `</div>\n\n            {/* Bottom Section */}`
  const searchEndStr = "</div>\n\n\n            {/* Bottom Section */}";
  const searchEndStrFallback = "</div>\n\n            {/* Bottom Section */}"; // checking for spacing variations
  
  let searchEnd = content.indexOf(searchEndStr, searchStart);
  if (searchEnd === -1) {
      searchEnd = content.indexOf(searchEndStrFallback, searchStart);
  }

  if (searchEnd > -1) {
     content = content.substring(0, searchStart) + replacement + "\n            " + content.substring(searchEnd);
     console.log("Successfully replaced the search block.");
  } else {
     console.log("Could not find the end of the search block!");
  }
} else {
  console.log("Could not find search block start.");
}

fs.writeFileSync('src/App.tsx', content);
