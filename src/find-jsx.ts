import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const counts = [];
let inDiv = 0;
let divStart = 0;

for (let i = 5205; i < 12199; i++) {
  if (lines[i].includes('{activeTab.type === "document" &&')) {
    console.log("document tab at line", i);
  }
  if (lines[i].includes('{activeTab.type === "chat" &&')) {
    console.log("chat tab at line", i);
  }
  if (lines[i].includes('<SidebarPanel')) {
    console.log("SidebarPanel at line", i);
  }
}
