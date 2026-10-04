---
name: hisabche-scripted-edits
description: How to change many files safely from this Windows shell — node scripts written with the Write tool, idempotent edits, retried writes, three-language JSON, and escapes that survive. Use before any multi-file edit, any i18n key addition, or any edit containing backslashes, backticks or non-ASCII separators.
---

# Scripted edits in this environment

The shell here (Git Bash on Windows, behind a formatter that rewrites files on
save) has eaten edits more than ten times. These rules are what is left after
each of them.

## The one rule

**Write the script with the Write tool into the scratchpad, then run
`node <file>.js`.** Never a heredoc, never `node -e` with anything but a
trivial one-liner, never `python -`.

A heredoc loses backslashes (`\d`, `\n`), breaks on a backtick, a dollar sign,
or a single quote inside Persian text, and fails with an EOF error that names
none of them.

## The script skeleton

```js
const fs = require('fs')

// Windows sometimes refuses a write with «UNKNOWN: unknown error, open».
const write = fs.writeFileSync
fs.writeFileSync = (file, data) => {
  for (let i = 0; ; i++) {
    try {
      return write(file, data)
    } catch (e) {
      if (i > 20) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300)
    }
  }
}

// Safe to run twice: an edit already applied is skipped, a missing anchor is loud.
const edit = (file, pairs) => {
  let s = fs.readFileSync(file, 'utf8')
  for (const [before, after] of pairs) {
    if (s.includes(after)) continue
    if (!s.includes(before)) throw new Error('missing in ' + file + ': ' + before.slice(0, 60))
    s = s.replace(before, after)
  }
  fs.writeFileSync(file, s)
}
```

- **Idempotent**, because a script that died after writing two of three
  language files will be run again.
- **Loud on a missing anchor**, because the formatter may have reflowed the
  line you copied.
- After running, count: `grep -c "newThing" file` should be exactly what you
  expect (an export added twice still compiles).

## Translation keys (fa / af / en)

Do it in one script, as objects — never by editing the JSON as text:

```js
for (const lang of ['fa', 'af', 'en']) {
  const file = 'packages/i18n/messages/' + lang + '/common.json'
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  json.myNamespace = M[lang]
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
}
```

Generate the guard row for `business-os-screens-keys.test.ts` from the same
object (`Object.keys(M.fa)`), so the guard and the keys cannot disagree.

Before overwriting an existing sentence, print it for each language — `af` is
sometimes a copy of `fa` and sometimes its own wording.

## Backslashes and invisible characters

- The Write tool turns a unicode escape in your content into the **real
  character**. A no-break space written that way is invisible in the file;
  eslint flags it, and replacing it with an ordinary space silently changes
  what a regex accepts.
- When the file must contain a literal backslash-escape (a regex class, a
  `RegExp` string), build it in a script from `String.fromCharCode(92)`:

  ```js
  const BS = String.fromCharCode(92)
  const D = '[0-9' + BS + 'u06F0-' + BS + 'u06F9]'
  ```

- Write the matching test from **char codes** (`String.fromCharCode(0x00a0)`),
  not from a literal you cannot see.
- In a regex written as a string, a bare dot is «any character». Write
  `[.]` or the class you mean.
- `\d` matches ASCII digits only. Persian (۰–۹) and Arabic-Indic (٠–٩) digits
  need an explicit class.

## Editing one place

- Use Edit for a single, unique replacement in a file you have just read.
- After a formatter rewrite, an exact-match replace can fail: read the lines
  again (`sed -n`) and match what is really there.
- To slice out a block, find it by `indexOf` of its first and last line and
  throw if either is missing.

## Never

- `git checkout -- <file>` to undo an experiment — it destroys the session's
  uncommitted work. Keep your own `.bak` copy and restore from it; delete the
  copy afterwards.
- Edit source while a build is running in the background.
- `cat > file` without a heredoc, or `python -` — both hang here.
