// Galeri Piyasa landing — no dependencies. The estimate logic mirrors the app's src/lib/analysis/stats.ts.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const tl = (n) => `₺${nf.format(Math.round(n))}`;
  const short = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}M` : `${Math.round(n / 1000)}K`);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
  $('year').textContent = String(new Date().getFullYear());

  // ── boot lines ──
  const BOOT = [
    ['galeri_piyasa v0.1 — market price terminal', ''],
    ['apify actor: sahibinden-car-scraper', 'ok'],
    ['apify actor: arabam-cars-search-scraper', 'ok'],
    ['cache: 24h · dedup (source, listing_id)', 'ok'],
    ['privacy filter: seller phone / name never stored', 'ok'],
  ];
  (async () => {
    const el = $('boot');
    for (const [line, status] of BOOT) {
      const row = document.createElement('div');
      el.appendChild(row);
      if (reduced) row.textContent = line;
      else for (let i = 0; i <= line.length; i += 2) { row.textContent = line.slice(0, i); await sleep(12); }
      if (status) row.innerHTML = `[<span class="ok"> ok </span>] ${esc(line)}`;
      else row.textContent = `> ${line}`;
      await sleep(120);
    }
  })();

  // ── data ──
  let DATA = null;
  const HASAR = ['clean', 'painted panels', 'replaced panels', 'insurance record', 'heavy damage'];
  const group = (h) => (h === 0 ? 'temiz' : h === 4 ? 'agir' : 'hasarli');

  function percentile(sorted, p) {
    if (!sorted.length) return NaN;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }
  const median = (xs) => percentile([...xs].sort((a, b) => a - b), 0.5);
  const r5 = (n) => Math.round(n / 5000) * 5000;

  /** The app's estimateValue: same trim + year + km ±15% + damage group; relaxed below 5 matches. */
  function estimate(q, rows) {
    const steps = [
      [{ ver: true, hasar: true, yil: 0, km: 0.15 }, null],
      [{ ver: false, hasar: true, yil: 0, km: 0.15 }, 'trim'],
      [{ ver: false, hasar: false, yil: 0, km: 0.15 }, 'damage group'],
      [{ ver: false, hasar: false, yil: 1, km: 0.15 }, 'year ±1'],
      [{ ver: false, hasar: false, yil: 1, km: 0.3 }, 'km ±30%'],
    ];
    const relaxed = [];
    let similar = [];
    for (const [rule, label] of steps) {
      if (label && !(label === 'trim' && q.ver === null)) relaxed.push(label);
      const lo = q.km * (1 - rule.km);
      const hi = q.km * (1 + rule.km) + (q.km === 0 ? 10000 : 0);
      similar = rows.filter((r) =>
        (!rule.ver || q.ver === null || r[4] === q.ver) &&
        (!rule.hasar || group(r[3]) === group(q.hasar)) &&
        Math.abs(r[0] - q.yil) <= rule.yil && r[1] >= lo && r[1] <= hi);
      if (similar.length >= 5) break;
    }
    if (!similar.length) return null;
    const prices = similar.map((r) => r[2]).sort((a, b) => a - b);
    let med = percentile(prices, 0.5);
    if (relaxed.includes('damage group')) med *= [1.03, 0.99, 0.95, 0.98, 0.75][q.hasar];
    const days = similar.map((r) => r[6]).filter((d) => d !== null);
    return {
      median: r5(med), alis: r5(med * 0.95), satis: r5(med * 1.05),
      p25: r5(percentile(prices, 0.25)), p75: r5(percentile(prices, 0.75)),
      n: similar.length, relaxed, days: days.length ? Math.round(median(days)) : null,
    };
  }

  // ── histogram (ASCII) ──
  function renderHisto(marker) {
    const h = DATA.ozet.histogram;
    const max = Math.max(...h.map((b) => b.count));
    const width = window.innerWidth < 420 ? 16 : 22;
    const { p25, p75, median: med } = DATA.ozet;
    const lines = [`price distribution${' '.repeat(Math.max(1, width - 10))}p25 ┊ med ┊ p75`];
    for (const b of h) {
      const n = Math.max(1, Math.round((b.count / max) * width));
      const mid = b.to > p25 && b.from <= p75;
      const tags = [];
      if (med >= b.from && med < b.to) tags.push('← med');
      if (marker && marker >= b.from && marker < b.to) tags.push('◀ your car');
      lines.push(
        `${short(b.from).padStart(5)} │<span class="b${mid ? ' mid' : ''}">${'█'.repeat(n)}</span>${' '.repeat(width - n)} ${String(b.count).padStart(3)}` +
        (tags.length ? ` <span class="mark">${tags.join(' ')}</span>` : ''),
      );
    }
    $('histo').innerHTML = lines.join('\n');
  }

  // ── price ticker ──
  function renderTicker() {
    const rows = [...DATA.rows].sort(() => Math.random() - 0.5).slice(0, 24);
    const med = DATA.ozet.median;
    const items = rows.map((r) => {
      const d = ((r[2] - med) / med) * 100;
      const cls = d >= 0 ? 'up' : 'down';
      const arrow = d >= 0 ? '▲' : '▼';
      return `<span>EGEA ${esc(DATA.versiyonlar[r[4]] || '')} · ${r[0]} · ${nf.format(r[1])} km · <b>${tl(r[2])}</b> <i class="${cls}">${arrow} ${Math.abs(d).toFixed(1)}%</i></span>`;
    }).join('');
    $('ticker').innerHTML = items + items; // seamless loop
  }

  // ── terminal ──
  const out = $('t-out');
  async function typeOut(html) {
    out.innerHTML = '';
    const lines = html.split('\n');
    for (const line of lines) {
      out.innerHTML += `${line}\n`;
      await sleep(70);
    }
  }

  async function run(e) {
    e && e.preventDefault();
    if (!DATA) return;
    const q = {
      yil: Number($('f-yil').value),
      km: Number(String($('f-km').value).replace(/\D/g, '')) || 0,
      hasar: Number($('f-hasar').value),
      ver: $('f-ver').value === '' ? null : Number($('f-ver').value),
    };
    const est = estimate(q, DATA.rows);
    const head = `<span class="acc">$</span> whats_it_worth --year ${q.yil} --km ${nf.format(q.km)} --damage "${HASAR[q.hasar]}"${q.ver !== null ? ` --trim "${esc(DATA.versiyonlar[q.ver])}"` : ''}`;
    if (!est) {
      await typeOut(`${head}\n\n<span class="warn">[!] no comparable listings found.</span> try a different year or mileage.`);
      renderHisto(null);
      return;
    }
    const bar = '─'.repeat(44);
    await typeOut([
      head,
      `<span class="acc">[ ok ]</span> scanned ${DATA.ozet.count} listings · <span class="hl">${est.n}</span> comparables`,
      est.relaxed.length ? `<span class="warn">[relaxed]</span> ${est.relaxed.join(', ')}` : `<span class="acc">[ ok ]</span> strict match rule`,
      bar,
      `your car:`,
      `<span class="big">${tl(est.alis)} – ${tl(est.satis)}</span>`,
      `median <span class="hl">${tl(est.median)}</span> · buy at −5% / sell at +5%`,
      `p25–p75: ${tl(est.p25)} – ${tl(est.p75)}${est.days !== null ? ` · est. time on market ~${est.days} days` : ''}`,
      bar,
    ].join('\n'));
    renderHisto(est.median);
  }

  $('f-km').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '');
    e.target.value = d ? nf.format(Number(d)) : '';
  });
  $('estimate').addEventListener('submit', run);

  fetch('/demo-egea.json')
    .then((r) => r.json())
    .then((d) => {
      DATA = d;
      const o = d.ozet;
      $('h-median').textContent = tl(o.median);
      $('h-count').textContent = String(o.count);
      $('h-sources').textContent = `sahibinden ${o.bySource.sahibinden} · arabam ${o.bySource.arabam}`;
      $('h-band').textContent = `${tl(o.p25)} – ${tl(o.p75)}`;
      $('t-data').textContent = `${o.count} demo listings · ${d.kriter}`;
      const years = [...new Set(d.rows.map((r) => r[0]))].sort((a, b) => b - a);
      $('f-yil').innerHTML = years.map((y) => `<option${y === 2020 ? ' selected' : ''}>${y}</option>`).join('');
      $('f-ver').innerHTML += d.versiyonlar.map((v, i) => `<option value="${i}">${esc(v)}</option>`).join('');
      renderHisto(null);
      renderTicker();
      // run the first estimate automatically when the demo scrolls into view
      const io = new IntersectionObserver((entries) => {
        if (entries.some((x) => x.isIntersecting)) { io.disconnect(); run(); }
      }, { threshold: 0.3 });
      io.observe($('demo'));
    })
    .catch(() => { $('t-data').textContent = 'could not load demo data'; });
})();
