const fs = require('fs');
const path = require('path');
let testFiles = 0;
let totalTests = 0;
let packageCounts = {};
function walk(dir) {
    if(dir.includes('node_modules') || dir.includes('.next') || dir.includes('dist') || dir.includes('.turbo')) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walk(fullPath);
        } else if (file.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
            testFiles++;
            const content = fs.readFileSync(fullPath, 'utf8');
            const matches = content.match(/(?:^|\s)(?:it|test)\s*\(/gm);
            const count = matches ? matches.length : 0;
            totalTests += count;
            
            // Extract package name
            const match = fullPath.match(/packages[\\\/]([^\\\/]+)/) || fullPath.match(/apps[\\\/]([^\\\/]+)/) || fullPath.match(/backend/);
            const pkg = match ? (match[1] || 'backend') : 'other';
            packageCounts[pkg] = (packageCounts[pkg] || 0) + count;
        }
    }
}
walk(process.cwd());
console.log(JSON.stringify({ testFiles, totalTests, packageCounts }, null, 2));
