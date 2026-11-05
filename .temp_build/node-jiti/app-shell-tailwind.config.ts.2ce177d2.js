"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = void 0;













var _nodePath = require("node:path");
var _nodeUrl = require("node:url");



var _tailwind = _interopRequireDefault(require("../ui/tailwind.config"));function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };} // ══════════════════════════════════════════════════════════════════════════
// ⚠️ THE TAILWIND CONFIG BELONGS TO THE SHELL, NOT TO A HOST.
//
// It used to live in `apps/desktop/`. Vite searches for PostCSS and Tailwind
// config upward from its `root`, and the shared root is
// `packages/app-shell/src` — a directory that has no path to `apps/desktop`.
// So the search found nothing, `@tailwind utilities` passed through
// untouched, and the app rendered with a full design system and not one
// utility class applied.
//
// The globs are absolute for the same reason: two hosts build this from two
// different working directories.
// ══════════════════════════════════════════════════════════════════════════
const here = (0, _nodePath.dirname)((0, _nodeUrl.fileURLToPath)("file:///C:/Users/hamed/Desktop/hisabche/packages/app-shell/tailwind.config.ts"));const repo = (0, _nodePath.resolve)(here, '../..');const config = { ..._tailwind.default, content: [(0, _nodePath.resolve)(here, 'src/**/*.{ts,tsx}'), (0, _nodePath.resolve)(repo, 'packages/ui/src/**/*.{ts,tsx}')] };var _default = exports.default = config; /* v7-f30fbb09ee29ac47 */