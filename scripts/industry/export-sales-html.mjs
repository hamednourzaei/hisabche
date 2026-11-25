// ============================================
// scripts/industry/export-sales-html.mjs
//
// Converts docs/sales/67-INDUSTRIES-PAIN-AND-GAP-MATRIX.md and
// docs/sales/HISABCHE-INTERNET-MARKET-RESEARCH-V1.md into standalone,
// offline-ready RTL dark-mode HTML documents matching the preview UI
// shown by the user.
// ============================================

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')

const FILES = [
  {
    src: 'docs/sales/67-INDUSTRIES-PAIN-AND-GAP-MATRIX.md',
    out: 'docs/sales/67-INDUSTRIES-PAIN-AND-GAP-MATRIX.html',
    title: 'ماتریس غیرتکراری دردهای واقعی ۶۷ صنف حسابچه',
  },
  {
    src: 'docs/sales/HISABCHE-INTERNET-MARKET-RESEARCH-V1.md',
    out: 'docs/sales/HISABCHE-INTERNET-MARKET-RESEARCH-V1.html',
    title: 'ماتریس تحقیقات اینترنتی بازار و شواهد بیرونی ۶۷ صنف حسابچه (V1)',
  },
]

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderInline(raw) {
  // Split around inline code spans first so code isn't double-formatted
  const parts = raw.split(/(`[^`]+`)/g)
  return parts
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        const inner = part.slice(1, -1)
        const escaped = escapeHtml(inner)
        if (inner === 'SUPPORTED') {
          return `<span class="badge-supported">${escaped}</span>`
        }
        return `<code dir="ltr">${escaped}</code>`
      }
      let h = escapeHtml(part)
      h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      h = h.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" dir="ltr">$1</a>',
      )
      return h
    })
    .join('')
}

function parseCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function mdToHtmlBody(md) {
  const lines = md.split(/\r?\n/)
  const out = []
  const toc = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed === '---') {
      out.push('<hr />')
      i += 1
      continue
    }

    if (trimmed.startsWith('# ')) {
      out.push(`<h1>${renderInline(trimmed.slice(2))}</h1>`)
      i += 1
      continue
    }

    if (trimmed.startsWith('## ')) {
      const text = trimmed.slice(3)
      const id = `sec-${toc.length + 1}`
      toc.push({ id, text, level: 2 })
      out.push(`<h2 id="${id}">${renderInline(text)}</h2>`)
      i += 1
      continue
    }

    if (trimmed.startsWith('### ')) {
      const text = trimmed.slice(4)
      const id = `sub-${toc.length + 1}`
      toc.push({ id, text, level: 3 })
      out.push(`<h3 id="${id}">${renderInline(text)}</h3>`)
      i += 1
      continue
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(renderInline(lines[i].trim().replace(/^>\s?/, '')))
        i += 1
      }
      out.push(`<blockquote>${quoteLines.join('<br />')}</blockquote>`)
      continue
    }

    if (trimmed.startsWith('- ')) {
      const items = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(`<li>${renderInline(lines[i].trim().slice(2))}</li>`)
        i += 1
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (trimmed.startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim())
        i += 1
      }
      if (tableLines.length >= 2) {
        const headers = parseCells(tableLines[0])
        const bodyRows = tableLines.slice(2)
        const thead = `<thead><tr>${headers.map((h) => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`
        const tbody = `<tbody>${bodyRows
          .map((rowLine) => {
            const cells = parseCells(rowLine)
            return `<tr>${cells.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`
          })
          .join('')}</tbody>`
        out.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`)
      }
      continue
    }

    // Paragraph (may span consecutive non-empty plain lines)
    const para = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().startsWith('- ') &&
      lines[i].trim() !== '---'
    ) {
      para.push(renderInline(lines[i].trim()))
      i += 1
    }
    out.push(`<p>${para.join('<br />')}</p>`)
  }

  return { bodyHtml: out.join('\n'), toc }
}

function buildDocument({ title, src, bodyHtml, toc }) {
  const navLinks = toc
    .filter((t) => t.level === 2 || t.level === 3)
    .map((t) => `<a class="nav-item level-${t.level}" href="#${t.id}">${escapeHtml(t.text)}</a>`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #111215;
      --surface: #181a1f;
      --surface-2: #1f2229;
      --border: #2b2f38;
      --text: #e6e8ec;
      --muted: #9ca3af;
      --accent: #60a5fa;
      --badge-bg: #1f2937;
      --badge-fg: #7dd3fc;
      --badge-border: #334155;
      --code-bg: #222630;
      --code-fg: #93c5fd;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: "Vazirmatn", "Segoe UI", Tahoma, sans-serif;
      line-height: 1.75;
      font-size: 14px;
    }
    .layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      min-height: 100vh;
    }
    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      background: var(--surface);
      border-inline-end: 1px solid var(--border);
      padding: 16px 14px;
    }
    .sidebar-title {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 10px;
      font-weight: 700;
    }
    .search-box {
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-family: inherit;
      font-size: 13px;
      margin-bottom: 12px;
    }
    .nav-item {
      display: block;
      text-decoration: none;
      color: var(--text);
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 12.5px;
      margin-bottom: 2px;
    }
    .nav-item:hover { background: var(--surface-2); color: var(--accent); }
    .nav-item.level-2 { font-weight: 700; color: #f3f4f6; margin-top: 8px; }
    .nav-item.level-3 { padding-inline-start: 16px; color: var(--muted); font-size: 12px; }
    .content {
      padding: 28px 36px 64px;
      max-width: 1400px;
      min-width: 0;
    }
    .meta-pill {
      display: inline-block;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 10px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 14px;
      color: #f9fafb;
    }
    h2 {
      font-size: 18px;
      margin: 28px 0 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
      color: #f3f4f6;
    }
    h3 {
      font-size: 16px;
      margin: 26px 0 8px;
      color: #f3f4f6;
    }
    blockquote {
      margin: 10px 0 14px;
      padding: 10px 14px;
      background: var(--surface);
      border-inline-start: 3px solid var(--accent);
      border-radius: 6px;
      color: #d1d5db;
    }
    hr {
      border: 0;
      border-top: 1px solid var(--border);
      margin: 24px 0;
    }
    ul { padding-inline-start: 22px; }
    li { margin-bottom: 6px; }
    a { color: var(--accent); word-break: break-all; }
    code {
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 12px;
      background: var(--code-bg);
      color: var(--code-fg);
      padding: 2px 6px;
      border-radius: 5px;
      display: inline-block;
      margin: 1px 0;
    }
    .badge-supported {
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 11.5px;
      font-weight: 700;
      background: var(--badge-bg);
      color: var(--badge-fg);
      border: 1px solid var(--badge-border);
      padding: 2px 8px;
      border-radius: 6px;
      display: inline-block;
      letter-spacing: 0.3px;
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      margin: 10px 0 22px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: start;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      border-inline-end: 1px solid var(--border);
      vertical-align: middle;
    }
    th:last-child, td:last-child { border-inline-end: 0; }
    tr:last-child td { border-bottom: 0; }
    th {
      background: var(--surface-2);
      color: #f3f4f6;
      font-weight: 700;
      font-size: 13px;
      white-space: nowrap;
    }
    tbody tr:hover td { background: rgba(255, 255, 255, 0.02); }
    .hidden-row { display: none; }
    @media (max-width: 960px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { position: static; height: auto; border-inline-end: 0; border-bottom: 1px solid var(--border); }
      .content { padding: 18px 14px; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-title">منبع: <code dir="ltr">${escapeHtml(src)}</code></div>
      <input id="filterInput" class="search-box" type="search" placeholder="جستجو در صنف، درد یا کد قابلیت..." />
      <nav id="tocNav">
        ${navLinks}
      </nav>
    </aside>
    <main class="content">
      <div class="meta-pill">حسابچه · نمای گرافیکی HTML راست‌به‌چپ (RTL Dark UI)</div>
      ${bodyHtml}
    </main>
  </div>
  <script>
    const input = document.getElementById('filterInput');
    input?.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      document.querySelectorAll('tbody tr').forEach((tr) => {
        if (!q) {
          tr.classList.remove('hidden-row');
          return;
        }
        const match = tr.textContent.toLowerCase().includes(q);
        tr.classList.toggle('hidden-row', !match);
      });
    });
  </script>
</body>
</html>
`
}

for (const entry of FILES) {
  const md = fs.readFileSync(path.join(ROOT, entry.src), 'utf8')
  const { bodyHtml, toc } = mdToHtmlBody(md)
  const html = buildDocument({ title: entry.title, src: entry.src, bodyHtml, toc })
  fs.writeFileSync(path.join(ROOT, entry.out), html, 'utf8')
  console.log(
    JSON.stringify({
      out: entry.out,
      sections: toc.length,
      bytes: Buffer.byteLength(html, 'utf8'),
    }),
  )
}
