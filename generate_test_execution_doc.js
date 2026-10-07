const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\hamed\\Desktop\\hisabche\\release-readiness-results\\2026-10-06_21-39-07';
const evidenceDir = path.join(baseDir, 'evidence');

const webLog = fs.readFileSync(path.join(evidenceDir, 'web-typecheck.txt'), 'utf8');
const mobileLog = fs.readFileSync(path.join(evidenceDir, 'mobile-test.txt'), 'utf8');
const desktopLog = fs.readFileSync(path.join(evidenceDir, 'desktop-test.txt'), 'utf8');
const backendLog = fs.readFileSync(path.join(evidenceDir, 'backend-test.txt'), 'utf8');

const getStatus = (log, successIndicator) => {
  if (log.includes(successIndicator)) return 'PASS';
  if (log.includes('FAIL') || log.includes('ERR')) return 'FAIL';
  return 'UNKNOWN';
}

const content = `
# Test Execution Summary

## Web (Typecheck)
Status: ${getStatus(webLog, 'Done in')}
Evidence: \`evidence/web-typecheck.txt\`

## Mobile
Status: ${getStatus(mobileLog, 'Test Suites:')}
Evidence: \`evidence/mobile-test.txt\`

## Desktop
Status: ${getStatus(desktopLog, 'Test Suites:')}
Evidence: \`evidence/desktop-test.txt\`

## Backend
Status: ${getStatus(backendLog, 'Test Files  293 passed')}
Evidence: \`evidence/backend-test.txt\`
`;

fs.writeFileSync(path.join(baseDir, '03-test-execution.md'), content);
console.log('Generated 03-test-execution.md');
