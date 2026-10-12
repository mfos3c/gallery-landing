// Galeri Piyasa landing — bağımlılıksız. Tahmin mantığı uygulamadaki src/lib/analysis/stats.ts ile aynıdır.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  const tl = (n) => `${nf.format(Math.round(n))} ₺`;
  const short = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}M` : `${Math.round(n / 1000)}B`);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
  $('year').textContent = String(new Date().getFullYear());

  // ── açılış (boot) satırları ──
  const BOOT = [
    ['galeri_piyasa v0.1 — piyasa analiz terminali', ''],
    ['apify actor: sahibinden-car-scraper', 'ok'],
    ['apify actor: arabam-cars-search-scraper', 'ok'],
    ['önbellek: 24 saat · dedup (source, listing_id)', 'ok'],
    ['kvkk filtresi: telefon / ad-soyad saklanmaz', 'ok'],
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

  // ── veri ──
  let DATA = null;
  const HASAR = ['temiz', 'boyalı', 'değişen', 'tramer kayıtlı', 'ağır hasar'];
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

  /** Uygulamadaki estimateValue: aynı versiyon + yıl + km ±%15 + hasar grubu; <5 örnekte gevşetilir. */
  function estimate(q, rows) {
    const steps = [
      [{ ver: true, hasar: true, yil: 0, km: 0.15 }, null],
      [{ ver: false, hasar: true, yil: 0, km: 0.15 }, 'versiyon'],
      [{ ver: false, hasar: false, yil: 0, km: 0.15 }, 'hasar durumu'],
      [{ ver: false, hasar: false, yil: 1, km: 0.15 }, 'yıl ±1'],
      [{ ver: false, hasar: false, yil: 1, km: 0.3 }, 'km ±%30'],
    ];
    const relaxed = [];
    let similar = [];
    for (const [rule, label] of steps) {
      if (label && !(label === 'versiyon' && q.ver === null)) relaxed.push(label);
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
    if (relaxed.includes('hasar durumu')) med *= [1.03, 0.99, 0.95, 0.98, 0.75][q.hasar];
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
    const lines = [`fiyat dağılımı${' '.repeat(Math.max(1, width - 6))}p25 ┊ med ┊ p75`];
    for (const b of h) {
      const n = Math.max(1, Math.round((b.count / max) * width));
      const mid = b.to > p25 && b.from <= p75;
      const tags = [];
      if (med >= b.from && med < b.to) tags.push('← med');
      if (marker && marker >= b.from && marker < b.to) tags.push('◀ senin araç');
      lines.push(
        `${short(b.from).padStart(5)} │<span class="b${mid ? ' mid' : ''}">${'█'.repeat(n)}</span>${' '.repeat(width - n)} ${String(b.count).padStart(3)}` +
        (tags.length ? ` <span class="mark">${tags.join(' ')}</span>` : ''),
      );
    }
    $('histo').innerHTML = lines.join('\n');
  }

  // ── fiyat şeridi ──
  function renderTicker() {
    const rows = [...DATA.rows].sort(() => Math.random() - 0.5).slice(0, 24);
    const med = DATA.ozet.median;
    const items = rows.map((r) => {
      const d = ((r[2] - med) / med) * 100;
      const cls = d >= 0 ? 'up' : 'down';
      const arrow = d >= 0 ? '▲' : '▼';
      return `<span>EGEA ${esc(DATA.versiyonlar[r[4]] || '')} · ${r[0]} · ${nf.format(r[1])} km · <b>${tl(r[2])}</b> <i class="${cls}">${arrow} ${Math.abs(d).toFixed(1)}%</i></span>`;
    }).join('');
    $('ticker').innerHTML = items + items; // kesintisiz döngü
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
    const head = `<span class="acc">$</span> bu_arac_kac_para --yil ${q.yil} --km ${nf.format(q.km)} --hasar "${HASAR[q.hasar]}"${q.ver !== null ? ` --versiyon "${esc(DATA.versiyonlar[q.ver])}"` : ''}`;
    if (!est) {
      await typeOut(`${head}\n\n<span class="warn">[!] benzer ilan bulunamadı.</span> km veya yılı değiştirip tekrar dene.`);
      renderHisto(null);
      return;
    }
    const bar = '─'.repeat(44);
    await typeOut([
      head,
      `<span class="acc">[ ok ]</span> ${DATA.ozet.count} ilan tarandı · <span class="hl">${est.n}</span> benzer ilan`,
      est.relaxed.length ? `<span class="warn">[gevşetildi]</span> ${est.relaxed.join(', ')}` : `<span class="acc">[ ok ]</span> tam eşleşme kuralı`,
      bar,
      `senin araç:`,
      `<span class="big">${tl(est.alis)} – ${tl(est.satis)}</span>`,
      `medyan <span class="hl">${tl(est.median)}</span> · %5 altı alış / %5 üstü satış`,
      `p25–p75: ${tl(est.p25)} – ${tl(est.p75)}${est.days !== null ? ` · tahmini ilan süresi ~${est.days} gün` : ''}`,
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
      $('h-band').textContent = `${nf.format(o.p25)} – ${tl(o.p75)}`;
      $('t-data').textContent = `${o.count} demo ilan · ${d.kriter}`;
      const years = [...new Set(d.rows.map((r) => r[0]))].sort((a, b) => b - a);
      $('f-yil').innerHTML = years.map((y) => `<option${y === 2020 ? ' selected' : ''}>${y}</option>`).join('');
      $('f-ver').innerHTML += d.versiyonlar.map((v, i) => `<option value="${i}">${esc(v)}</option>`).join('');
      renderHisto(null);
      renderTicker();
      // demo bölümü görününce ilk tahmini otomatik çalıştır
      const io = new IntersectionObserver((entries) => {
        if (entries.some((x) => x.isIntersecting)) { io.disconnect(); run(); }
      }, { threshold: 0.3 });
      io.observe($('demo'));
    })
    .catch(() => { $('t-data').textContent = 'demo veri yüklenemedi'; });
})();
