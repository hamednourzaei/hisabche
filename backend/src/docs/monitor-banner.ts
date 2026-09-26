// ============================================
// backend/src/docs/monitor-banner.ts
//
// The live CPU / RAM bar at the top of /docs (owner's request, 26 Sep 2026;
// public, percentages only — routes/system-metrics.routes.ts).
//
// Served through swagger-ui's `theme` option as its own .js and .css files:
// /docs runs under a strict CSP (`script-src 'self'`, no inline script or
// style attributes), and theme files are served from /docs itself, so they
// are allowed. Widths are set through the CSSOM (element.style), which the
// CSP permits; no inline `style="…"` markup is written.
//
// It shows the instance that holds the stream — with several instances each
// viewer sees one of them — and says so.
// ============================================

export const MONITOR_BANNER_CSS = `
#hisabche-monitor{position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;align-items:center;gap:14px;
  padding:10px 16px;background:#0f172a;color:#e2e8f0;font:13px/1.4 Tahoma,system-ui,sans-serif;direction:rtl;
  border-bottom:1px solid #1e293b}
#hisabche-monitor .hm-title{font-weight:700;display:flex;align-items:center;gap:6px}
#hisabche-monitor .hm-dot{width:8px;height:8px;border-radius:50%;background:#64748b;display:inline-block}
#hisabche-monitor .hm-dot.live{background:#22c55e}
#hisabche-monitor .hm-dot.down{background:#ef4444}
#hisabche-monitor .hm-meter{display:flex;align-items:center;gap:6px;min-width:170px}
#hisabche-monitor .hm-track{flex:1;height:8px;border-radius:4px;background:#1e293b;overflow:hidden;min-width:90px}
#hisabche-monitor .hm-fill{height:100%;width:0;background:#22c55e;transition:width .6s ease,background .6s ease}
#hisabche-monitor .hm-fill.warn{background:#f59e0b}
#hisabche-monitor .hm-fill.hot{background:#ef4444}
#hisabche-monitor .hm-num{font-variant-numeric:tabular-nums;min-width:48px;text-align:left;direction:ltr}
#hisabche-monitor .hm-muted{color:#94a3b8;font-size:12px}
`

export const MONITOR_BANNER_JS = `
(function () {
  function el(tag, cls, text) {
    var node = document.createElement(tag)
    if (cls) node.className = cls
    if (text) node.textContent = text
    return node
  }
  function meter(label) {
    var wrap = el('span', 'hm-meter')
    var track = el('span', 'hm-track')
    var fill = el('span', 'hm-fill')
    var num = el('span', 'hm-num', '—')
    track.appendChild(fill)
    wrap.appendChild(el('span', '', label))
    wrap.appendChild(track)
    wrap.appendChild(num)
    return { wrap: wrap, fill: fill, num: num }
  }
  function paint(m, value) {
    m.num.textContent = value.toFixed(1) + '%'
    m.fill.style.width = Math.max(0, Math.min(100, value)) + '%'
    m.fill.className = 'hm-fill' + (value >= 85 ? ' hot' : value >= 65 ? ' warn' : '')
  }
  function uptime(seconds) {
    var d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60)
    return (d ? d + ' روز ' : '') + h + ' ساعت ' + m + ' دقیقه'
  }

  function mount() {
    if (document.getElementById('hisabche-monitor')) return
    var bar = el('div')
    bar.id = 'hisabche-monitor'
    var dot = el('span', 'hm-dot')
    var title = el('span', 'hm-title')
    title.appendChild(dot)
    title.appendChild(document.createTextNode('وضعیت سرور (همین نمونه)'))
    var cpu = meter('CPU')
    var ram = meter('RAM')
    var up = el('span', 'hm-muted', '')
    var inflight = el('span', 'hm-muted', '')
    var status = el('span', 'hm-muted', 'در حال اتصال…')
    bar.appendChild(title)
    bar.appendChild(cpu.wrap)
    bar.appendChild(ram.wrap)
    bar.appendChild(up)
    bar.appendChild(inflight)
    bar.appendChild(status)
    document.body.insertBefore(bar, document.body.firstChild)

    function show(sample) {
      paint(cpu, sample.cpuPercent)
      paint(ram, sample.memoryPercent)
      up.textContent = 'روشن: ' + uptime(sample.uptimeSeconds)
      inflight.textContent = 'درخواست در جریان: ' + sample.inflightRequests
      dot.className = 'hm-dot live'
      status.textContent = 'زنده — به‌روزرسانی هر ۲ ثانیه'
    }

    if (!window.EventSource) {
      status.textContent = 'این مرورگر پخش زنده را پشتیبانی نمی‌کند'
      return
    }
    var source = new EventSource('/api/system/metrics/stream')
    source.onmessage = function (event) {
      try { show(JSON.parse(event.data)) } catch (e) { /* a malformed frame is skipped */ }
    }
    // EventSource reconnects by itself; this only says the link is down meanwhile.
    source.onerror = function () {
      dot.className = 'hm-dot down'
      status.textContent = 'اتصال قطع شد — تلاش دوباره…'
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
})()
`
