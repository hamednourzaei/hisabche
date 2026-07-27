// apps/web/scripts/copy-standalone-assets.js
//
// Next.js "output: standalone" never copies public/ or .next/static/
// into the standalone bundle — that's documented, required manual step,
// not a bug in Next.js itself. Skipping it is what caused public/*.png
// (e.g. dashboard-desktop.png) to 404 in production even though the
// files exist in the repo.
"use strict";

const fs = require("fs");
const path = require("path");

const webDir = __dirname.replace(/[\\/]scripts$/, "");
const standaloneWebDir = path.join(webDir, ".next", "standalone", "apps", "web");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(standaloneWebDir)) {
  console.log("[copy-standalone-assets] no standalone output found, skipping");
  process.exit(0);
}

copyDir(path.join(webDir, "public"), path.join(standaloneWebDir, "public"));
copyDir(path.join(webDir, ".next", "static"), path.join(standaloneWebDir, ".next", "static"));

console.log("[copy-standalone-assets] copied public/ and .next/static/ into .next/standalone/apps/web");
