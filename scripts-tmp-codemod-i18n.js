// Temporary codemod: migrate react-i18next `t()` calls to next-intl style within a single file's text.
// - Finds `t(` calls (not tOriginal, not other identifiers ending in t)
// - Parses the argument list respecting string/template literal boundaries and nested parens
// - If there are exactly 2 args and the 2nd arg is a quoted string literal (not an object/array), drop it
// - Leaves object-literal 2nd args (interpolation values) untouched
// - Leaves 1-arg calls untouched
// - Also handles 3-arg calls (t(key, fallbackString, valuesObject)) by dropping the fallback string, keeping key + values object
// Usage: node scripts-tmp-codemod-i18n.js <file1> <file2> ...

const fs = require('fs');

function findMatchingParenEnd(str, openIdx) {
  let depth = 0;
  let i = openIdx;
  for (; i < str.length; i++) {
    const c = str[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    } else if (c === '"' || c === "'" || c === '`') {
      i = skipString(str, i, c);
    }
  }
  return -1;
}

function skipString(str, idx, quote) {
  let i = idx + 1;
  for (; i < str.length; i++) {
    if (str[i] === '\\') { i++; continue; }
    if (str[i] === quote) return i;
  }
  return i;
}

// Split top-level args (respecting nested parens/brackets/braces/strings)
function splitArgs(str) {
  const args = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"' || c === "'" || c === '`') {
      const end = skipString(str, i, c);
      cur += str.slice(i, end + 1);
      i = end;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) {
      args.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim().length) args.push(cur);
  return args.map((a) => a.trim());
}

function isQuotedStringLiteral(arg) {
  if (arg.length < 2) return false;
  const first = arg[0];
  const last = arg[arg.length - 1];
  return (first === '"' || first === "'" || first === '`') && first === last;
}

function processFile(path, fnName) {
  let src = fs.readFileSync(path, 'utf8');
  let out = '';
  let i = 0;
  let changed = 0;
  const re = new RegExp(`(?<![\\w$.])${fnName}\\(`, 'g');
  let match;
  let lastIndex = 0;
  while ((match = re.exec(src))) {
    const openIdx = match.index + match[0].length - 1; // index of '('
    const closeIdx = findMatchingParenEnd(src, openIdx);
    if (closeIdx === -1) continue;
    const inner = src.slice(openIdx + 1, closeIdx);
    const args = splitArgs(inner);
    let newInner = inner;
    if (args.length === 2 && isQuotedStringLiteral(args[1])) {
      newInner = args[0];
      changed++;
    } else if (args.length === 3 && isQuotedStringLiteral(args[1])) {
      // t(key, fallbackString, valuesObject) -> t(key, valuesObject)
      newInner = `${args[0]}, ${args[2]}`;
      changed++;
    }
    out += src.slice(lastIndex, openIdx + 1) + newInner;
    lastIndex = closeIdx;
    re.lastIndex = closeIdx; // continue scanning after this call (in case of nested, though rare)
  }
  out += src.slice(lastIndex);
  if (changed > 0) {
    fs.writeFileSync(path, out, 'utf8');
  }
  console.log(path, 'changed', changed, 'call sites');
}

const args = process.argv.slice(2);
let fnName = 't';
let files = args;
if (args[0] === '--fn') {
  fnName = args[1];
  files = args.slice(2);
}
files.forEach((f) => processFile(f, fnName));
