const fs = require('fs');
const path = require('path');

const dir = 'llm-council-results/2026-10-06_19-06-20';
const files = [
  '02-agent-contrarian.md',
  '03-agent-first-principles.md',
  '04-agent-expansionist.md',
  '05-agent-outsider.md',
  '06-agent-executor.md'
];

// Read all
let reports = files.map(f => {
  let content = fs.readFileSync(path.join(dir, f), 'utf8');
  // Strip role
  content = content.replace(/## Role[\s\S]*?(?=## Executive Verdict)/i, '');
  return { file: f, content: content };
});

// Shuffle
for (let i = reports.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [reports[i], reports[j]] = [reports[j], reports[i]];
}

// Assign letters and concat
const letters = ['A', 'B', 'C', 'D', 'E'];
let mappingLog = 'Mapping (KEEP SECRET FROM AGENTS):\n';
let anonymizedOutput = '';

reports.forEach((r, index) => {
  const letter = letters[index];
  mappingLog += `Response ${letter} = ${r.file}\n`;
  anonymizedOutput += `==================================================\n`;
  anonymizedOutput += `# Response ${letter}\n`;
  anonymizedOutput += `==================================================\n\n`;
  anonymizedOutput += r.content + '\n\n';
});

fs.writeFileSync(path.join(dir, '07-anonymized-responses.md'), anonymizedOutput);
fs.writeFileSync(path.join(dir, 'secret-mapping.txt'), mappingLog);
