// apps/web/scripts/seo-link-graph.js
//
// SEO Engine — Group 1 / Phase 1: Internal Link Graph.
// Walks app/[lang]/**/page.tsx to discover real routes, scans app/** and
// packages/ui/src/components/ui/landing/** for internal href references,
// and reports incoming/outgoing counts, orphan pages, dead-end pages,
// link depth from the homepage, circular links, and broken internal links
// (hrefs that don't resolve to any discovered route).
//
// Usage: node scripts/seo-link-graph.js
"use strict";

/* eslint-disable @typescript-eslint/no-require-imports -- CJS script, require() is required here */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
/* eslint-enable @typescript-eslint/no-require-imports */

const webDir = __dirname.replace(/[\\/]scripts$/, "");
const repoRoot = path.join(webDir, "..", "..");
const appDir = path.join(webDir, "app");
const landingDir = path.join(repoRoot, "packages", "ui", "src", "components", "ui", "landing");

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, out);
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

// --- 1. Discover real routes from app/[lang]/**/page.tsx -----------------

const pageFiles = walk(appDir, (name) => name === "page.tsx");
const langRoot = path.join(appDir, "[lang]");

const routes = new Set();
for (const file of pageFiles) {
  if (!file.startsWith(langRoot)) continue; // skip root-level app/*.tsx (sitemap.ts etc.)
  let rel = path.dirname(path.relative(langRoot, file)).replace(/\\/g, "/");
  if (rel === ".") rel = "";
  // strip Next.js route groups like (dashboard)
  const segments = rel.split("/").filter((s) => s && !/^\(.*\)$/.test(s));
  routes.add("/" + segments.join("/"));
}

// --- 2. Scan source for internal hrefs ------------------------------------

const sourceFiles = [
  ...walk(appDir, (name) => /\.(tsx|ts)$/.test(name)),
  ...walk(landingDir, (name) => /\.(tsx|ts)$/.test(name)),
];

// Matches href="/foo", href={`/foo`}, href={"/foo"}, and object-literal `href: "/foo"`
// (nav-link config arrays) — internal absolute paths only.
const HREF_RE = /href[=:]\s*\{?["'`](\/[a-zA-Z0-9\-_/[\]#]*)["'`]\}?/g;

// i18n message keys ("dashboard.salesChart") and raw route paths ("/legal/terms")
// aren't visible prose — Group 11 keyword extraction must not treat them as content.
const I18N_KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;
const ROUTE_PATH_RE = /^\/[a-zA-Z0-9\-_/]*$/;
function isContentNoise(token) {
  return I18N_KEY_RE.test(token) || ROUTE_PATH_RE.test(token);
}

function normalize(href) {
  // drop hash/query, drop locale prefix (en/af), collapse trailing slash
  let p = href.split("#")[0].split("?")[0];
  p = p.replace(/^\/(en|af)(?=\/|$)/, "");
  if (p.length > 1) p = p.replace(/\/$/, "");
  return p === "" ? "/" : p;
}

// Anchor text near an href: either JSX children right after the tag
// (`href="/x">Text<`) or a sibling `fallback`/`label` field in the same
// flat object literal (nav-link config arrays).
const ANCHOR_JSX_RE = /href=\{?["'`][^"'`]*["'`]\}?[^>]*>\s*([^<{][^<]*)</;
const ANCHOR_FIELD_RE = /(?:fallback|label)\s*:\s*["'`]([^"'`]+)["'`]/;

// Raw text content (quoted strings) per route, used as a keyword source.
const routeText = new Map([...routes].map((r) => [r, ""]));

// edges: Map<fromRoute, Set<toNormalizedHref>>
const edges = new Map();
const brokenLinks = []; // { from, href }
const anchorText = new Map(); // `${from}=>${to}` -> text

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  let fromRoute = null;
  if (file.startsWith(langRoot) && path.basename(file) === "page.tsx") {
    let rel = path.dirname(path.relative(langRoot, file)).replace(/\\/g, "/");
    if (rel === ".") rel = "";
    const segments = rel.split("/").filter((s) => s && !/^\(.*\)$/.test(s));
    fromRoute = "/" + segments.join("/");
  } else {
    // shared component (e.g. landing scenes, footer) — attribute links to the homepage,
    // since that's where they're actually rendered on the public site.
    fromRoute = "/";
  }

  if (routeText.has(fromRoute)) {
    const strings = (content.match(/["'`][^"'`]{3,}["'`]/g) || []).filter((s) => !isContentNoise(s.slice(1, -1)));
    routeText.set(fromRoute, routeText.get(fromRoute) + " " + strings.join(" "));
  }

  let match;
  while ((match = HREF_RE.exec(content)) !== null) {
    const raw = match[1];
    if (raw.includes("[") || raw.includes("]")) continue; // dynamic segment placeholder, not a real link
    const norm = normalize(raw);
    if (!edges.has(fromRoute)) edges.set(fromRoute, new Set());
    edges.get(fromRoute).add(norm);
    if (!routes.has(norm)) brokenLinks.push({ from: fromRoute, href: raw });

    const context = content.slice(match.index, match.index + 200);
    const jsxAnchor = ANCHOR_JSX_RE.exec(context);
    const fieldAnchor = ANCHOR_FIELD_RE.exec(content.slice(Math.max(0, match.index - 150), match.index + 150));
    const text = (jsxAnchor && jsxAnchor[1].trim()) || (fieldAnchor && fieldAnchor[1].trim());
    if (text) anchorText.set(`${fromRoute}=>${norm}`, text);
  }
}

// --- 3. Incoming / outgoing counts ----------------------------------------

const incoming = new Map([...routes].map((r) => [r, 0]));
const outgoing = new Map([...routes].map((r) => [r, 0]));

for (const [from, tos] of edges) {
  for (const to of tos) {
    if (!routes.has(to)) continue; // broken link, already recorded
    if (routes.has(from)) outgoing.set(from, outgoing.get(from) + 1);
    incoming.set(to, incoming.get(to) + 1);
  }
}

// --- 4. Link depth from homepage (BFS) ------------------------------------

const depth = new Map([...routes].map((r) => [r, Infinity]));
depth.set("/", 0);
const queue = ["/"];
while (queue.length) {
  const cur = queue.shift();
  const tos = edges.get(cur) || new Set();
  for (const to of tos) {
    if (!routes.has(to)) continue;
    if (depth.get(to) > depth.get(cur) + 1) {
      depth.set(to, depth.get(cur) + 1);
      queue.push(to);
    }
  }
}

// --- 5. Circular links (simple 2-cycle + DFS back-edge detection) --------

const circular = [];
const visiting = new Set();
const visited = new Set();
function dfs(node, stack) {
  visiting.add(node);
  stack.push(node);
  for (const to of edges.get(node) || []) {
    if (!routes.has(to)) continue;
    if (visiting.has(to)) {
      const cycleStart = stack.indexOf(to);
      circular.push([...stack.slice(cycleStart), to].join(" -> "));
    } else if (!visited.has(to)) {
      dfs(to, stack);
    }
  }
  stack.pop();
  visiting.delete(node);
  visited.add(node);
}
for (const r of routes) if (!visited.has(r)) dfs(r, []);

// --- 6. Internal Authority (PageRank / link equity) ------------------------
//
// Standard iterative PageRank over the same route graph built above.
// Dangling nodes (no valid outgoing links) redistribute their weight evenly
// across all routes, as is conventional, so dead-end pages don't leak equity.

const DAMPING = 0.85;
const ITERATIONS = 50;
const routeList = [...routes];
const n = routeList.length;

const validOut = new Map(routeList.map((r) => [r, [...(edges.get(r) || [])].filter((t) => routes.has(t))]));

let authority = new Map(routeList.map((r) => [r, 1 / n]));
for (let i = 0; i < ITERATIONS; i++) {
  const next = new Map(routeList.map((r) => [r, (1 - DAMPING) / n]));
  let danglingMass = 0;
  for (const r of routeList) {
    const outs = validOut.get(r);
    if (outs.length === 0) {
      danglingMass += authority.get(r);
      continue;
    }
    const share = (DAMPING * authority.get(r)) / outs.length;
    for (const to of outs) next.set(to, next.get(to) + share);
  }
  if (danglingMass > 0) {
    const share = (DAMPING * danglingMass) / n;
    for (const r of routeList) next.set(r, next.get(r) + share);
  }
  authority = next;
}

// Link equity: each route's authority normalized against the strongest page (homepage).
const maxAuthority = Math.max(...authority.values());
const linkEquity = new Map(routeList.map((r) => [r, authority.get(r) / maxAuthority]));

// Weak pages: indexable, reachable routes whose link equity falls below 20% of the
// homepage's — i.e. authority propagation from "/" barely reaches them.
const weakPages = routeList
  .filter((r) => r !== "/" && depth.get(r) !== Infinity && linkEquity.get(r) < 0.2)
  .sort((a, b) => linkEquity.get(a) - linkEquity.get(b));

// --- 7. Semantic Linking (keywords / topics — no embeddings engine exists yet) ---
//
// No semantic/NLP engine exists in this repo, so topics are derived from simple
// keyword-frequency extraction over each route's quoted string literals, per the
// fallback strategy: keywords -> topical clusters -> contextual link suggestions.

const STOPWORDS = new Set([
  // English
  "the","and","for","with","this","that","from","your","you","are","was","were",
  "has","have","not","but","can","will","all","our","use","used","into","also",
  "more","here","click","page","link","true","false","null","undefined","div",
  "flex","text","gap","size","icon","key","href","classname","props","lang",
  // Framework/markup identifiers (Group 11 patch — these are never real content)
  "class","id","src","style","children","html","body","span","button","input",
  "onclick","onchange","aria","role","type","name","value","data",
  // Persian
  "و","در","به","از","که","این","را","با","برای","است","های","یک","هم","تا","یا",
  "شد","شده","کرد","می","آن","ها","اگر","چه","هر","نیز","دیگر","خود","کنید","کنیم",
  // Brand name — appears on every page (header/footer), never a stuffing signal
  "hisabche","حسابچه",
]);

const GENERIC_ANCHORS = new Set([
  "بیشتر بدانید","بیشتر","اینجا","کلیک کنید","مشاهده","اینجا کلیک کنید",
  "click here","here","learn more","more","read more","see more",
]);

function extractKeywords(text) {
  const words = (text.toLowerCase().match(/[\p{L}]{3,}/gu) || []).filter((w) => !STOPWORDS.has(w));
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
}

const keywords = new Map([...routes].map((r) => [r, extractKeywords(routeText.get(r) || "")]));

// Topical clusters: group routes by their single dominant keyword.
const clusters = new Map(); // topic -> [route]
for (const r of routes) {
  const topic = keywords.get(r)[0];
  if (!topic) continue;
  if (!clusters.has(topic)) clusters.set(topic, []);
  clusters.get(topic).push(r);
}
const topicOf = new Map();
for (const [topic, members] of clusters) for (const r of members) topicOf.set(r, topic);
const topicalClusters = [...clusters.entries()].filter(([, members]) => members.length >= 2);

// Hub pages: routes whose outgoing links bridge >=2 distinct topical clusters.
const hubPages = routeList.filter((r) => {
  const targets = validOut.get(r).filter((t) => t !== r);
  const distinctTopics = new Set(targets.map((t) => topicOf.get(t)).filter(Boolean));
  return distinctTopics.size >= 2;
});

// Contextual link suggestions: routes that share a topic but aren't linked yet.
const contextualSuggestions = [];
for (const [topic, members] of clusters) {
  if (members.length < 2) continue;
  for (const a of members) {
    for (const b of members) {
      if (a === b) continue;
      const existing = validOut.get(a) || [];
      if (!existing.includes(b)) contextualSuggestions.push({ from: a, to: b, topic });
    }
  }
}

// Anchor improvements: existing internal links whose anchor text is generic
// boilerplate ("learn more" / "بیشتر بدانید") instead of descriptive/keyword-rich.
const anchorImprovements = [];
for (const [key, text] of anchorText) {
  const [from, to] = key.split("=>");
  if (!routes.has(to)) continue;
  if (GENERIC_ANCHORS.has(text.trim().toLowerCase()) || GENERIC_ANCHORS.has(text.trim())) {
    const suggestedTopic = keywords.get(to)?.[0];
    anchorImprovements.push({ from, to, text, suggestion: suggestedTopic || null });
  }
}

// --- 8. Advanced Linking ----------------------------------------------------

const orphans = [...routes].filter((r) => r !== "/" && incoming.get(r) === 0);
const deadEnds = [...routes].filter((r) => outgoing.get(r) === 0);

// Soft orphans: reachable from the homepage, but only through a single incoming
// link — one broken/removed link away from becoming a true orphan.
const softOrphans = [...routes].filter((r) => r !== "/" && depth.get(r) !== Infinity && incoming.get(r) === 1);

// Crawl traps: internal hrefs that carry query params (faceted/sort/filter
// variants) or repeat a path segment back-to-back — classic infinite-URL patterns.
const crawlTraps = [];
for (const [from, tos] of edges) {
  for (const to of tos) {
    if (to.includes("?") || /([a-z0-9-]+)\/\1(\/|$)/.test(to)) crawlTraps.push({ from, to });
  }
}

// Breadcrumb suggestions: any route nested two or more segments deep should
// expose a breadcrumb trail back through each ancestor segment.
const breadcrumbSuggestions = routeList
  .filter((r) => r.split("/").filter(Boolean).length >= 2)
  .map((r) => {
    const segments = r.split("/").filter(Boolean);
    const trail = ["/"];
    let acc = "";
    for (const s of segments) {
      acc += `/${s}`;
      trail.push(acc);
    }
    return { route: r, trail };
  });

// Silos: group routes by their top-level path segment and suggest interlinking
// within each silo (e.g. all /legal/* pages should cross-link each other).
const silos = new Map(); // topSegment -> [route]
for (const r of routeList) {
  const top = r.split("/").filter(Boolean)[0];
  if (!top) continue;
  if (!silos.has(top)) silos.set(top, []);
  silos.get(top).push(r);
}
const siloSuggestions = [...silos.entries()].filter(([, members]) => members.length >= 2);

// Pagination detection: source referencing page/limit/offset query params or a
// Pagination component, without matching rel=prev/next — flagged for review.
const paginationHits = [];
const PAGINATION_RE = /[?&](page|limit|offset)=|<Pagination\b/;
const REL_PREV_NEXT_RE = /rel=["'`](prev|next)["'`]/;
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (PAGINATION_RE.test(content) && !REL_PREV_NEXT_RE.test(content)) {
    paginationHits.push(path.relative(repoRoot, file).replace(/\\/g, "/"));
  }
}

// Recommendation engine: roll every prior-phase finding into one prioritized list.
const recommendations = [
  ...brokenLinks.map((b) => ({ severity: "P0", issue: `broken internal link ${b.href}`, at: b.from })),
  ...crawlTraps.map((c) => ({ severity: "P1", issue: `possible crawl trap ${c.to}`, at: c.from })),
  ...orphans.map((r) => ({ severity: "P1", issue: "orphan page (0 incoming links)", at: r })),
  ...softOrphans.map((r) => ({ severity: "P2", issue: "soft orphan (only 1 incoming link)", at: r })),
  ...deadEnds.filter((r) => r !== "/").map((r) => ({ severity: "P2", issue: "dead-end page (0 outgoing links)", at: r })),
  ...weakPages.map((r) => ({ severity: "P2", issue: "weak internal authority", at: r })),
  ...anchorImprovements.map((a) => ({ severity: "P3", issue: `generic anchor text "${a.text}"`, at: a.from })),
  ...paginationHits.map((f) => ({ severity: "P3", issue: "pagination without rel=prev/next", at: f })),
].sort((a, b) => a.severity.localeCompare(b.severity));

// --- 9. Report --------------------------------------------------------------

console.log(`\nInternal Link Graph — ${routes.size} routes, ${sourceFiles.length} files scanned\n`);

console.log("Route".padEnd(32), "In", "Out", "Depth", "  Authority", "Equity");
for (const r of [...routes].sort()) {
  const d = depth.get(r);
  console.log(
    r.padEnd(32),
    String(incoming.get(r)).padEnd(3),
    String(outgoing.get(r)).padEnd(4),
    String(d === Infinity ? "unreachable" : d).padEnd(12),
    authority.get(r).toFixed(4).padEnd(10),
    linkEquity.get(r).toFixed(4)
  );
}

console.log(`\nOrphan pages (0 incoming links, excluding "/"): ${orphans.length ? orphans.join(", ") : "none"}`);
console.log(`Dead-end pages (0 outgoing internal links): ${deadEnds.length ? deadEnds.join(", ") : "none"}`);
console.log(`Circular links: ${circular.length ? circular.join(" | ") : "none"}`);
console.log(
  `\nBroken internal links (${brokenLinks.length}):`,
  brokenLinks.length ? "" : "none"
);
for (const b of brokenLinks) {
  console.log(`  ${b.href}  (linked from ${b.from})`);
}

console.log(
  `\nWeak pages (reachable, link equity < 0.2 relative to homepage): ${
    weakPages.length ? weakPages.map((r) => `${r} (${linkEquity.get(r).toFixed(3)})`).join(", ") : "none"
  }`
);

console.log(`\nTopical clusters: ${topicalClusters.length ? "" : "none"}`);
for (const [topic, members] of topicalClusters) {
  console.log(`  "${topic}": ${members.join(", ")}`);
}

console.log(`\nHub pages (bridge >=2 topical clusters): ${hubPages.length ? hubPages.join(", ") : "none"}`);

console.log(`\nContextual link suggestions (${contextualSuggestions.length}):`, contextualSuggestions.length ? "" : "none");
for (const s of contextualSuggestions) {
  console.log(`  ${s.from} -> ${s.to}  (shared topic: "${s.topic}")`);
}

console.log(`\nAnchor text improvements (${anchorImprovements.length}):`, anchorImprovements.length ? "" : "none");
for (const a of anchorImprovements) {
  console.log(
    `  "${a.text}" (${a.from} -> ${a.to})${a.suggestion ? ` — consider working "${a.suggestion}" into the anchor text` : ""}`
  );
}

console.log(`\nSoft orphans (reachable, only 1 incoming link): ${softOrphans.length ? softOrphans.join(", ") : "none"}`);

console.log(`\nCrawl traps (${crawlTraps.length}):`, crawlTraps.length ? "" : "none");
for (const c of crawlTraps) {
  console.log(`  ${c.to}  (linked from ${c.from})`);
}

console.log(`\nBreadcrumb suggestions (${breadcrumbSuggestions.length}):`, breadcrumbSuggestions.length ? "" : "none");
for (const b of breadcrumbSuggestions) {
  console.log(`  ${b.route}: ${b.trail.join(" > ")}`);
}

console.log(`\nSilo suggestions (interlink within each group): ${siloSuggestions.length ? "" : "none"}`);
for (const [top, members] of siloSuggestions) {
  console.log(`  /${top}/*: ${members.join(", ")}`);
}

console.log(`\nPagination without rel=prev/next (${paginationHits.length}):`, paginationHits.length ? "" : "none");
for (const f of paginationHits) {
  console.log(`  ${f}`);
}

console.log(`\nRecommendation engine — prioritized action list (${recommendations.length}):`);
for (const r of recommendations) {
  console.log(`  [${r.severity}] ${r.issue}  (${r.at})`);
}
console.log("");

// --- 10. Incremental Crawl (Group 2 — Phases 2.1 / 2.2 / 2.3) ---------------
//
// HTTP crawl over the routes discovered above:
//  - 2.1 Incremental: sha256 hash per page, skip unchanged, reuse cached result.
//  - 2.2 Resume: progress is persisted after every page in
//    scripts/.seo-crawl-progress.json, so a killed run resumes instead of
//    re-crawling from scratch; the file is cleared once a run finishes clean.
//  - 2.3 Parallel queue + retry + rate limiting: bounded worker concurrency,
//    capped per-page retries with backoff, and a delay between requests.

const CRAWL_BASE_URL = process.env.CRAWL_BASE_URL || "http://localhost:3039";
const CRAWL_CACHE_FILE = path.join(__dirname, ".seo-crawl-cache.json");
const CRAWL_PROGRESS_FILE = path.join(__dirname, ".seo-crawl-progress.json");
const CRAWL_CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY) || 4;
const CRAWL_MAX_RETRIES = Number(process.env.CRAWL_MAX_RETRIES) || 2;
const CRAWL_DELAY_MS = Number(process.env.CRAWL_DELAY_MS) || 50;

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function hashPage(html) {
  const normalized = html.replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// Canonical href, robots noindex, and <title> — read straight off the crawled
// HTML so Group 4 (Canonical) and Group 9 (JS SEO) can work off real output.
function extractPageMeta(html) {
  const canonicalMatch = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html);
  const noindexMatch = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.exec(html);
  const titleMatch = /<title>([^<]*)<\/title>/i.exec(html);
  return {
    canonical: canonicalMatch ? canonicalMatch[1] : null,
    noindex: !!noindexMatch,
    title: titleMatch ? titleMatch[1].trim() : null,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url) {
  let lastErr;
  for (let attempt = 0; attempt <= CRAWL_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < CRAWL_MAX_RETRIES) await sleep(CRAWL_DELAY_MS * (attempt + 1));
    }
  }
  throw lastErr;
}

async function incrementalCrawl() {
  const cache = loadJson(CRAWL_CACHE_FILE);
  const progress = loadJson(CRAWL_PROGRESS_FILE); // route -> result, from a previously interrupted run

  const crawled = [];
  const skipped = [];
  const failed = [];
  const pageMeta = new Map();

  // Resumed routes: already processed in a prior (interrupted) run — reuse
  // their result without re-fetching.
  for (const [route, result] of Object.entries(progress)) {
    if (!routeList.includes(route)) continue;
    if (result.status === "failed") failed.push({ route, error: result.error });
    else if (result.status === "skipped") skipped.push({ route, hash: result.hash });
    else crawled.push({ route, hash: result.hash, previousHash: result.previousHash });
    if (result.meta) pageMeta.set(route, result.meta);
    if (result.status !== "failed") {
      cache[route] = { hash: result.hash, crawledAt: result.crawledAt || new Date().toISOString(), meta: result.meta };
    }
  }

  const pending = routeList.filter((r) => !progress[r]);
  let cursor = 0;

  async function worker() {
    while (cursor < pending.length) {
      const route = pending[cursor++];
      let html;
      try {
        html = await fetchWithRetry(`${CRAWL_BASE_URL}${route}`);
      } catch (err) {
        failed.push({ route, error: err.message });
        progress[route] = { status: "failed", error: err.message };
        saveJson(CRAWL_PROGRESS_FILE, progress);
        continue;
      }

      const hash = hashPage(html);
      const meta = extractPageMeta(html);
      pageMeta.set(route, meta);
      const prior = cache[route];

      if (prior && prior.hash === hash) {
        skipped.push({ route, hash }); // unchanged — reuse cached result, no re-crawl needed
        progress[route] = { status: "skipped", hash, meta };
      } else {
        crawled.push({ route, hash, previousHash: prior ? prior.hash : null });
        cache[route] = { hash, crawledAt: new Date().toISOString(), meta };
        progress[route] = { status: "crawled", hash, previousHash: prior ? prior.hash : null, meta, crawledAt: cache[route].crawledAt };
      }
      saveJson(CRAWL_PROGRESS_FILE, progress);
      if (CRAWL_DELAY_MS > 0) await sleep(CRAWL_DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CRAWL_CONCURRENCY, pending.length) }, worker));

  if (crawled.length > 0 || skipped.length > 0) saveJson(CRAWL_CACHE_FILE, cache);
  if (fs.existsSync(CRAWL_PROGRESS_FILE)) fs.unlinkSync(CRAWL_PROGRESS_FILE); // run finished clean — clear resume state

  return { crawled, skipped, failed, pageMeta };
}

// --- 11. Canonical (Group 4) -------------------------------------------------
//
// Built from live pageMeta (canonical href + noindex), so it only reports on
// whatever the crawl phase actually reached.
function analyzeCanonical(pageMeta) {
  const canonicalOf = new Map(); // route -> normalized target route (or null if none/external)
  const findings = { loops: [], chains: [], crossDomain: [], noindexConflicts: [] };

  for (const [route, meta] of pageMeta) {
    if (!meta.canonical) continue;
    let targetRoute = null;
    try {
      const u = new URL(meta.canonical, CRAWL_BASE_URL);
      if (u.origin !== new URL(CRAWL_BASE_URL).origin) {
        findings.crossDomain.push({ route, canonical: meta.canonical });
      }
      targetRoute = normalize(u.pathname);
    } catch {
      continue;
    }
    canonicalOf.set(route, targetRoute);
    if (meta.noindex && targetRoute === route) {
      findings.noindexConflicts.push({ route, reason: "page is noindex but canonicalizes to itself" });
    }
  }

  // Chains / loops: follow canonical -> canonical until it stabilizes or repeats.
  for (const [route] of canonicalOf) {
    const seen = [route];
    let cur = route;
    while (canonicalOf.has(cur) && canonicalOf.get(cur) !== cur) {
      cur = canonicalOf.get(cur);
      if (seen.includes(cur)) {
        findings.loops.push([...seen, cur].join(" -> "));
        break;
      }
      seen.push(cur);
    }
    if (seen.length > 2 && !findings.loops.some((l) => l.startsWith(seen.join(" -> ")))) {
      findings.chains.push(seen.join(" -> "));
    }
  }

  return findings;
}

// --- 12. Sitemap (Group 5) ---------------------------------------------------
//
// Parses the literal `{ path: "..." }` entries out of app/sitemap.ts (the
// existing sitemap generator) and diffs them against the routes discovered
// from the filesystem and, when available, live crawl results.
function analyzeSitemap(crawlResults) {
  const sitemapFile = path.join(appDir, "sitemap.ts");
  let sitemapRoutes = [];
  if (fs.existsSync(sitemapFile)) {
    const content = fs.readFileSync(sitemapFile, "utf8");
    sitemapRoutes = [...content.matchAll(/\{\s*path:\s*["'`]([^"'`]*)["'`]\s*\}/g)].map((m) => (m[1] === "" ? "/" : m[1]));
  }

  const sitemapSet = new Set(sitemapRoutes);
  const missingFromSitemap = routeList.filter(
    (r) => r !== "/" && depth.get(r) !== Infinity && !sitemapSet.has(r) && !(pageMetaHas(crawlResults, r) && crawlResults.pageMeta.get(r).noindex)
  );
  const orphanSitemapUrls = sitemapRoutes.filter((r) => !routes.has(r));
  const non200 = crawlResults.failed.filter((f) => sitemapSet.has(f.route));

  return { sitemapRoutes, missingFromSitemap, orphanSitemapUrls, non200 };
}
function pageMetaHas(crawlResults, route) {
  return crawlResults.pageMeta.has(route);
}

// --- 13. Robots (Group 6) -----------------------------------------------------
//
// Parses the existing `disallow` list out of app/robots.ts and cross-checks it
// against indexable routes, plus a live fetch of /robots.txt for reachability.
async function analyzeRobots(sitemapAnalysis) {
  const robotsFile = path.join(appDir, "robots.ts");
  let disallow = [];
  if (fs.existsSync(robotsFile)) {
    const content = fs.readFileSync(robotsFile, "utf8");
    const disallowMatch = /disallow:\s*\[([^\]]*)\]/.exec(content);
    if (disallowMatch) disallow = [...disallowMatch[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  }

  const blockedIndexable = routeList.filter((r) => sitemapAnalysis.sitemapRoutes.includes(r) && disallow.some((d) => r.startsWith(d)));

  let robotsUnreachable = null;
  try {
    const res = await fetch(`${CRAWL_BASE_URL}/robots.txt`);
    if (!res.ok) robotsUnreachable = `HTTP ${res.status}`;
  } catch (err) {
    robotsUnreachable = err.message;
  }

  return { disallow, blockedIndexable, robotsUnreachable };
}

// --- 14. Duplicate Content (Group 7) -----------------------------------------
//
// Reuses the sha256 hashes computed during the crawl: routes sharing an exact
// hash are exact duplicates. Similarity between non-identical pages falls back
// to Jaccard overlap of their extracted keywords (Group 3's semantic engine).
function analyzeDuplicateContent(cache) {
  const byHash = new Map();
  for (const [route, entry] of Object.entries(cache)) {
    if (!routes.has(route)) continue;
    if (!byHash.has(entry.hash)) byHash.set(entry.hash, []);
    byHash.get(entry.hash).push(route);
  }
  const exactClusters = [...byHash.values()].filter((members) => members.length >= 2);
  const exactRoutes = new Set(exactClusters.flat());

  const canonicalSuggestions = exactClusters.map((members) => {
    const best = members.reduce((a, b) => (linkEquity.get(b) > linkEquity.get(a) ? b : a));
    return { members, suggestedCanonical: best, similarity: 1 };
  });

  // Near-duplicates: routes not already an exact match, but with high keyword
  // overlap (Jaccard >= 0.7 over Group 3's extracted keyword sets).
  const candidates = [...routes].filter((r) => !exactRoutes.has(r) && keywords.get(r).length > 0);
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const similarity = jaccard(keywords.get(a), keywords.get(b));
      if (similarity >= 0.7) {
        const best = linkEquity.get(b) > linkEquity.get(a) ? b : a;
        canonicalSuggestions.push({ members: [a, b], suggestedCanonical: best, similarity });
      }
    }
  }

  return { exactClusters, canonicalSuggestions };
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

// --- 15. Crawl Health (Group 8) -----------------------------------------------
//
// Extends the crawl-trap detection from Group 1/Phase 4: parameter explosion
// (>=2 query params on one href) and duplicate URL variants (two different raw
// hrefs that normalize to the same route — trailing slash, locale prefix, etc).
function analyzeCrawlHealth() {
  const parameterExplosion = [];
  for (const [from, tos] of edges) {
    for (const to of tos) {
      const qIndex = to.indexOf("?");
      if (qIndex !== -1 && to.slice(qIndex + 1).split("&").length >= 2) {
        parameterExplosion.push({ from, to });
      }
    }
  }
  // Duplicate URL variants: same normalized target reached via >1 distinct raw href spellings.
  const rawByNorm = new Map();
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    let match;
    const re = new RegExp(HREF_RE.source, "g");
    while ((match = re.exec(content)) !== null) {
      const raw = match[1];
      if (raw.includes("[") || raw.includes("]")) continue;
      const norm = normalize(raw);
      if (!rawByNorm.has(norm)) rawByNorm.set(norm, new Set());
      rawByNorm.get(norm).add(raw);
    }
  }
  const duplicateVariants = [...rawByNorm.entries()].filter(([, raws]) => raws.size > 1).map(([norm, raws]) => ({ route: norm, variants: [...raws] }));

  return { parameterExplosion, duplicateVariants };
}

// --- 16. JavaScript SEO (Group 9) --------------------------------------------
//
// Static check: client components ("use client") that also set document.title
// or render metadata-shaped tags themselves — that content only exists after
// hydration, so it's invisible to a non-JS crawl of the initial HTML.
function analyzeJsSeo() {
  const hits = [];
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    if (!/^\s*["']use client["']/.test(content)) continue;
    const clientOnlyTitle = /document\.title\s*=/.test(content);
    const clientOnlyMeta = /createElement\(["']meta["']\)|<meta\b/.test(content) && !/generateMetadata/.test(content);
    const clientOnlySchema = /application\/ld\+json/.test(content) && /useEffect|useState/.test(content);
    if (clientOnlyTitle || clientOnlyMeta || clientOnlySchema) {
      hits.push({
        file: path.relative(repoRoot, file).replace(/\\/g, "/"),
        clientOnlyTitle,
        clientOnlyMeta,
        clientOnlySchema,
      });
    }
  }
  return hits;
}

// --- 17. Content (Group 11) ---------------------------------------------------
//
// Reuses Group 3's keyword extraction: flags routes with too little extracted
// signal (low topical coverage) and routes where one keyword dominates the
// text (over-optimization / keyword stuffing).
// Stuffing detection thresholds — configurable rather than hardcoded magic numbers.
const STUFFING_MIN_VISIBLE_WORDS = 40; // below this, density is too noisy to judge
const STUFFING_MIN_OCCURRENCES = 5;
const STUFFING_DENSITY_THRESHOLD = 0.05;
const STUFFING_CONFIDENCE_THRESHOLD = 0.5;

function analyzeContent() {
  const lowCoverage = routeList.filter((r) => r !== "/" && keywords.get(r).length < 3);
  const overOptimized = [];
  for (const r of routeList) {
    const text = routeText.get(r) || "";
    const words = (text.toLowerCase().match(/[\p{L}]{3,}/gu) || []).filter((w) => !STOPWORDS.has(w) && !isContentNoise(w));
    const visibleTextLength = words.join(" ").length;
    if (words.length < STUFFING_MIN_VISIBLE_WORDS) continue; // not enough visible content to judge

    const top = keywords.get(r)[0];
    if (!top) continue;
    const occurrences = words.filter((w) => w === top).length;
    const density = occurrences / words.length;
    if (occurrences < STUFFING_MIN_OCCURRENCES || density <= STUFFING_DENSITY_THRESHOLD) continue;

    // Confidence grows with both occurrence count and how much visible text backs
    // it up — a handful of repeats in a thin page is far less reliable than the
    // same density measured over a full page of copy.
    const confidence = Math.min(1, occurrences / (STUFFING_MIN_OCCURRENCES * 2)) * Math.min(1, visibleTextLength / 500);
    if (confidence < STUFFING_CONFIDENCE_THRESHOLD) continue; // suppress low-confidence warnings

    overOptimized.push({ route: r, keyword: top, density, occurrences, visibleTextLength, confidence });
  }
  return { lowCoverage, overOptimized };
}

// --- 18. Scoring (Group 10) ---------------------------------------------------
//
// Every recommendation gets severity/priority/impact/confidence/fixComplexity
// so downstream consumers can sort/filter without re-deriving it.
function score(severity, impact, confidence, fixComplexity) {
  return { severity, priority: severity, impact, confidence, fixComplexity };
}

async function main() {
  const { crawled, skipped, failed, pageMeta } = await incrementalCrawl();
  const cache = loadJson(CRAWL_CACHE_FILE);

  console.log(`Incremental Crawl (base: ${CRAWL_BASE_URL}, concurrency: ${CRAWL_CONCURRENCY})`);
  if (failed.length === routeList.length) {
    console.log(
      `  skipped — target unreachable (${failed[0] ? failed[0].error : "no response"}). Start the dev server to run the crawl phase.\n`
    );
  } else {
    console.log(
      `  ${crawled.length} changed/new (re-crawled), ${skipped.length} unchanged (skipped, cache reused), ${failed.length} failed\n`
    );
    for (const c of crawled) {
      console.log(`  [changed]   ${c.route}  ${c.previousHash ? `${c.previousHash.slice(0, 8)} -> ` : "(new) "}${c.hash.slice(0, 8)}`);
    }
    for (const s of skipped) {
      console.log(`  [unchanged] ${s.route}  ${s.hash.slice(0, 8)} (reused from cache, no re-crawl)`);
    }
    for (const f of failed) {
      console.log(`  [failed]    ${f.route}  ${f.error}`);
    }
    console.log("");
  }

  const crawlResults = { crawled, skipped, failed, pageMeta };
  const hasLiveData = pageMeta.size > 0;

  // --- Group 4: Canonical ---
  const canonical = analyzeCanonical(pageMeta);
  console.log(`Canonical — loops (${canonical.loops.length}), chains (${canonical.chains.length}), cross-domain (${canonical.crossDomain.length}), noindex conflicts (${canonical.noindexConflicts.length})`);
  if (!hasLiveData) console.log("  no data — crawl phase found nothing to inspect");
  for (const l of canonical.loops) console.log(`  [loop]  ${l}`);
  for (const c of canonical.chains) console.log(`  [chain] ${c}`);
  for (const c of canonical.crossDomain) console.log(`  [cross-domain] ${c.route} -> ${c.canonical}`);
  for (const c of canonical.noindexConflicts) console.log(`  [noindex-conflict] ${c.route}: ${c.reason}`);
  console.log("");

  // --- Group 5: Sitemap ---
  const sitemapAnalysis = analyzeSitemap(crawlResults);
  console.log(
    `Sitemap — ${sitemapAnalysis.sitemapRoutes.length} listed, missing (${sitemapAnalysis.missingFromSitemap.length}), orphan sitemap URLs (${sitemapAnalysis.orphanSitemapUrls.length}), non-200 (${sitemapAnalysis.non200.length})`
  );
  console.log(`  missing from sitemap: ${sitemapAnalysis.missingFromSitemap.length ? sitemapAnalysis.missingFromSitemap.join(", ") : "none"}`);
  console.log(`  orphan sitemap URLs (no matching route): ${sitemapAnalysis.orphanSitemapUrls.length ? sitemapAnalysis.orphanSitemapUrls.join(", ") : "none"}`);
  console.log(`  non-200 sitemap URLs: ${sitemapAnalysis.non200.length ? sitemapAnalysis.non200.map((f) => `${f.route} (${f.error})`).join(", ") : "none"}`);
  console.log("");

  // --- Group 6: Robots ---
  const robots = await analyzeRobots(sitemapAnalysis);
  console.log(`Robots — disallow rules: ${robots.disallow.length ? robots.disallow.join(", ") : "none"}`);
  console.log(`  blocked indexable pages: ${robots.blockedIndexable.length ? robots.blockedIndexable.join(", ") : "none"}`);
  console.log(`  /robots.txt: ${robots.robotsUnreachable ? `unreachable (${robots.robotsUnreachable})` : "reachable"}`);
  console.log("");

  // --- Group 7: Duplicate Content ---
  const duplicates = analyzeDuplicateContent(cache);
  console.log(`Duplicate content — exact clusters (${duplicates.exactClusters.length}), near-duplicate pairs (${duplicates.canonicalSuggestions.length - duplicates.exactClusters.length})`);
  for (const c of duplicates.canonicalSuggestions) {
    console.log(`  ${c.members.join(" == ")}  (similarity ${c.similarity.toFixed(2)}) -> suggest canonical: ${c.suggestedCanonical}`);
  }
  console.log("");

  // --- Group 8: Crawl Health ---
  const crawlHealth = analyzeCrawlHealth();
  console.log(
    `Crawl health — parameter explosion (${crawlHealth.parameterExplosion.length}), duplicate URL variants (${crawlHealth.duplicateVariants.length})`
  );
  for (const p of crawlHealth.parameterExplosion) console.log(`  [param-explosion] ${p.to}  (linked from ${p.from})`);
  for (const v of crawlHealth.duplicateVariants) console.log(`  [variant] ${v.route}: ${v.variants.join(", ")}`);
  console.log("");

  // --- Group 9: JavaScript SEO ---
  const jsSeo = analyzeJsSeo();
  console.log(`JavaScript SEO — client-only metadata risk (${jsSeo.length}):`, jsSeo.length ? "" : "none");
  for (const h of jsSeo) {
    const flags = [h.clientOnlyTitle && "title", h.clientOnlyMeta && "meta", h.clientOnlySchema && "schema"].filter(Boolean).join(", ");
    console.log(`  ${h.file}  (${flags})`);
  }
  console.log("");

  // --- Group 11: Content ---
  const content = analyzeContent();
  console.log(`Content — low topical coverage (${content.lowCoverage.length}), over-optimized (${content.overOptimized.length})`);
  console.log(`  low coverage: ${content.lowCoverage.length ? content.lowCoverage.join(", ") : "none"}`);
  for (const o of content.overOptimized) {
    console.log(
      `  [over-optimized] ${o.route}: "${o.keyword}"  density=${(o.density * 100).toFixed(1)}% occurrences=${o.occurrences} visibleTextLength=${o.visibleTextLength} confidence=${o.confidence.toFixed(2)}`
    );
  }
  console.log("");

  // --- Group 10: Scoring — extend every finding above with a uniform score ---
  const scored = [
    ...recommendations.map((r) => ({ ...r, ...score(r.severity, "medium", "medium", "low") })),
    ...canonical.loops.map((l) => ({ issue: `canonical loop: ${l}`, at: l, ...score("P0", "high", "high", "medium") })),
    ...canonical.crossDomain.map((c) => ({ issue: `cross-domain canonical -> ${c.canonical}`, at: c.route, ...score("P1", "high", "high", "low") })),
    ...canonical.noindexConflicts.map((c) => ({ issue: c.reason, at: c.route, ...score("P1", "medium", "high", "low") })),
    ...sitemapAnalysis.missingFromSitemap.map((r) => ({ issue: "missing from sitemap", at: r, ...score("P1", "medium", "high", "low") })),
    ...sitemapAnalysis.orphanSitemapUrls.map((r) => ({ issue: "orphan sitemap URL (no route)", at: r, ...score("P2", "low", "high", "low") })),
    ...robots.blockedIndexable.map((r) => ({ issue: "blocked by robots.txt but indexable", at: r, ...score("P0", "high", "high", "low") })),
    ...duplicates.canonicalSuggestions.map((c) => ({ issue: `duplicate content cluster (${c.members.length} pages)`, at: c.members[0], ...score("P1", "high", "high", "medium") })),
    ...jsSeo.map((h) => ({ issue: "client-only metadata (invisible pre-hydration)", at: h.file, ...score("P2", "medium", "medium", "medium") })),
    ...content.overOptimized.map((o) => ({ issue: `keyword stuffing risk: "${o.keyword}"`, at: o.route, ...score("P3", "low", "medium", "low") })),
  ].sort((a, b) => a.severity.localeCompare(b.severity));

  console.log(`Scored recommendation engine — full prioritized list (${scored.length}):`);
  for (const r of scored) {
    console.log(`  [${r.severity}] ${r.issue}  (${r.at})  impact=${r.impact} confidence=${r.confidence} fix=${r.fixComplexity}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
