const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      callback(dirPath);
    }
  });
}

function fixRtlClasses(content) {
  let modified = content;
  
  // Replace ml- and mr-
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:|hover:|focus:|active:|group-hover:)?ml-([0-9a-z.-]+)\b/g, '$1ms-$2');
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:|hover:|focus:|active:|group-hover:)?mr-([0-9a-z.-]+)\b/g, '$1me-$2');
  
  // Replace pl- and pr-
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:|hover:|focus:|active:|group-hover:)?pl-([0-9a-z.-]+)\b/g, '$1ps-$2');
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:|hover:|focus:|active:|group-hover:)?pr-([0-9a-z.-]+)\b/g, '$1pe-$2');

  // Replace left- and right- (but ignore 1/2 for absolute centering)
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:)?left-((?!1\/2)[0-9a-z.-]+)\b/g, '$1start-$2');
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:)?right-((?!1\/2)[0-9a-z.-]+)\b/g, '$1end-$2');

  // Replace border-l- and border-r-
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:)?border-l-([0-9a-z.-]+)\b/g, '$1border-s-$2');
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:)?border-r-([0-9a-z.-]+)\b/g, '$1border-e-$2');
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:)?border-l\b/g, '$1border-s');
  modified = modified.replace(/\b(sm:|md:|lg:|xl:|2xl:)?border-r\b/g, '$1border-e');

  return modified;
}

const targetDirs = [
  path.join(__dirname, 'apps/web'),
  path.join(__dirname, 'packages/ui/src')
];

let changedFiles = 0;

targetDirs.forEach(dir => {
  walkDir(dir, (filepath) => {
    const original = fs.readFileSync(filepath, 'utf8');
    const fixed = fixRtlClasses(original);
    if (original !== fixed) {
      fs.writeFileSync(filepath, fixed, 'utf8');
      changedFiles++;
    }
  });
});

console.log(`Fixed RTL logical classes in ${changedFiles} files.`);
