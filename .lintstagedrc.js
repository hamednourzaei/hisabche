// ============================================
// lint-staged
//
// Was a flat JSON config. With a large staged changeset (187 files during the
// UI-parity migration) the generated `eslint --fix <...all files>` exceeded
// Windows' 8191-character command-line limit and the commit died with
// "The command line is too long."
//
// Two changes keep it under the ceiling:
//   * paths are made relative to the repo root — the absolute prefix alone was
//     ~32 characters per file
//   * files are split into batches, each run as its own command
//
// lint-staged runs an array of returned commands in order, so batching changes
// nothing about what gets linted.
// ============================================

const path = require('path')

// Well under the 8191 hard limit: the shell, the binary path and pnpm's own
// wrapper all consume part of the same budget.
const MAX_COMMAND_LENGTH = 6000

/**
 * Split `files` into as few commands as will fit the length limit.
 */
function batched(command, files) {
  const relative = files.map((file) => path.relative(process.cwd(), file))

  const commands = []
  let current = []
  let length = command.length

  for (const file of relative) {
    const argument = `"${file}"`

    // Always keep at least one file per command — a single path longer than
    // the budget still has to run rather than produce an empty command.
    if (current.length > 0 && length + argument.length + 1 > MAX_COMMAND_LENGTH) {
      commands.push(`${command} ${current.join(' ')}`)
      current = []
      length = command.length
    }

    current.push(argument)
    length += argument.length + 1
  }

  if (current.length > 0) {
    commands.push(`${command} ${current.join(' ')}`)
  }

  return commands
}

module.exports = {
  '**/*.{ts,tsx,js,jsx,mjs,cjs}': (files) => [
    ...batched('eslint --fix', files),
    ...batched('prettier --write', files),
  ],
  '**/*.{json,css,md}': (files) => batched('prettier --write', files),
}
