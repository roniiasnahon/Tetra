import * as fs from 'fs';
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const start = 9139 - 1;
const end = 9651 - 1; // before AnimatePresence end
const chartModalLines = lines.slice(start, end + 1).join('\n');

const variables = [...new Set(chartModalLines.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g))];
console.log(variables.filter(v => ['chartType', 'setChartType', 'chartTitle', 'setChartTitle', 'chartLabels', 'chartValues', 'chartIndividualColors', 'chartDataColor', 'closeChartModal', 'handleInsertChart', 'chartBeingEdited', 'setChartLabels', 'setChartValues', 'setChartIndividualColors', 'setChartDataColor', 'colors'].includes(v)));
