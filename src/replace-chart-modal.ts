import * as fs from 'fs';

let appLines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const importStatement = `import { ChartModal } from "./components/ChartModal";`;
if (!appLines.includes(importStatement)) {
  appLines.splice(20, 0, importStatement);
}

// Re-read lines to get correct indexes
appLines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const start = appLines.findIndex(line => line.includes('isChartModalOpen && ('));
const end = start + (9652 - 9139); 

const replacement = `        {isChartModalOpen && (
          <ChartModal
            closeChartModal={closeChartModal}
            chartType={chartType}
            setChartType={setChartType}
            chartTitle={chartTitle}
            setChartTitle={setChartTitle}
            colors={colors}
            chartDataColor={chartDataColor}
            setChartDataColor={setChartDataColor}
            chartLabels={chartLabels}
            setChartLabels={setChartLabels}
            chartValues={chartValues}
            setChartValues={setChartValues}
            chartIndividualColors={chartIndividualColors}
            setChartIndividualColors={setChartIndividualColors}
            handleInsertChart={handleInsertChart}
            chartBeingEdited={chartBeingEdited}
          />
        )}`;

appLines.splice(start, end - start + 1, replacement);
appLines.splice(20, 0, importStatement);

fs.writeFileSync('src/App.tsx', appLines.join('\n'), 'utf8');
console.log('Replaced ChartModal in App.tsx');
