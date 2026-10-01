(() => {
  'use strict';

  // =========================================================================
  // 状態
  // =========================================================================
  const state = { data: null, tier: 'S3', step: 2, horizon: 1, page: 0 };
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);

  // =========================================================================
  // ユーティリティ
  // =========================================================================
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => (n == null ? '—' : n.toLocaleString('ja-JP'));
  const pct = (x, d = 1) => (x == null ? '—' : (x * 100).toFixed(d) + '%');

  function parseDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dow = (iso) => parseDate(iso).getDay();
  const md = (iso) => { const d = parseDate(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const mdw = (iso) => `${md(iso)}(${DOW[dow(iso)]})`;
  function todayIso() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  const daysFromToday = (iso) => Math.round((parseDate(iso) - parseDate(todayIso())) / 86400000);
  const isUpcoming = (iso) => daysFromToday(iso) >= 0;
  const dayName = (iso) => ['今日', '明日', '明後日'][daysFromToday(iso)] || '　';
  const dowClass = (iso) => ({ 0: 'sun', 6: 'sat', 1: 'mon' }[dow(iso)] || '');

  function axisNum(n) {
    if (n >= 100000) return Math.round(n / 10000) + '万';
    if (n >= 10000) return (Math.round(n / 1000) / 10) + '万';
    return n.toLocaleString('ja-JP');
  }

  function niceStep(rough) {
    const p = Math.pow(10, Math.floor(Math.log10(rough)));
    const f = rough / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }

  const seriesId = () => `${state.tier}+${state.step}`;
  const currentSeries = () => state.data.series.find((s) => s.id === seriesId());

  // =========================================================================
  // グラフ (SVG)
  // cfg = { dates[], band:{lo[],hi[]}, lines:[{cls, values[]}], dots:[{cls, values[]}],
  //         todayIdx, tooltip(i) -> html, minH }
  // =========================================================================
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function pathFrom(points) {
    // points: [[x,y]|null,...]。null で線を切る
    let d = '', pen = false;
    for (const p of points) {
      if (!p) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      pen = true;
    }
    return d;
  }

  function drawChart(el, cfg) {
    el.innerHTML = '';
    const n = cfg.dates.length;
    const vals = [];
    const collect = (arr) => arr && arr.forEach((v) => { if (v != null) vals.push(v); });
    if (cfg.band) { collect(cfg.band.lo); collect(cfg.band.hi); }
    cfg.lines.forEach((l) => collect(l.values));
    cfg.dots.forEach((l) => collect(l.values));
    if (!n || !vals.length) {
      el.innerHTML = '<p class="note" style="padding:24px 0">表示できるデータがありません</p>';
      return;
    }

    const W = Math.max(el.clientWidth, 260);
    const H = Math.round(Math.min(320, Math.max(210, W * 0.55)));
    const m = { l: 46, r: 12, t: 14, b: 26 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;

    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi === lo) { hi += 1; lo -= 1; }
    const step = niceStep((hi - lo) / 4);
    const yMin = Math.max(0, Math.floor((lo - (hi - lo) * 0.05) / step) * step);
    const yMax = Math.ceil((hi + (hi - lo) * 0.05) / step) * step;
    const X = (i) => m.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
    const Y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, el);

    // 目盛り
    const grid = svgEl('g', { class: 'grid' }, svg);
    const axis = svgEl('g', { class: 'axis' }, svg);
    for (let v = yMin; v <= yMax + step / 2; v += step) {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, grid);
      const t = svgEl('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, axis);
      t.textContent = axisNum(v);
    }
    const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 62))));
    for (let i = 0; i < n; i += every) {
      const t = svgEl('text', { x: X(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : 'middle' }, axis);
      t.textContent = md(cfg.dates[i]);
    }

    // 今日の線
    if (cfg.todayIdx != null && cfg.todayIdx > 0) {
      const x = X(cfg.todayIdx);
      svgEl('line', { class: 'today-line', x1: x, x2: x, y1: m.t, y2: m.t + ih }, svg);
      const t = svgEl('text', { class: 'today-label', x: x + 4, y: m.t + 10 }, svg);
      t.textContent = '今日';
    }

    // 予測範囲
    if (cfg.band) {
      const top = [], bottom = [];
      cfg.band.lo.forEach((l, i) => {
        const h = cfg.band.hi[i];
        if (l != null && h != null) { top.push([X(i), Y(h)]); bottom.unshift([X(i), Y(l)]); }
      });
      if (top.length > 1) {
        const pts = top.concat(bottom).map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        svgEl('polygon', { class: 'band', points: pts }, svg);
      }
    }

    // 線
    cfg.lines.forEach((l) => {
      svgEl('path', { class: l.cls, d: pathFrom(l.values.map((v, i) => (v == null ? null : [X(i), Y(v)]))) }, svg);
    });

    // 点
    cfg.dots.forEach((l) => {
      l.values.forEach((v, i) => {
        if (v == null) return;
        svgEl('circle', { class: l.cls, cx: X(i), cy: Y(v), r: l.r || 3 }, svg);
      });
    });

    // ホバー/タップで値表示
    const guide = svgEl('line', { class: 'guide', y1: m.t, y2: m.t + ih, x1: 0, x2: 0, visibility: 'hidden' }, svg);
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.style.display = 'none';
    el.appendChild(tip);

    const show = (ev) => {
      const rect = svg.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
      const x = X(i);
      guide.setAttribute('x1', x); guide.setAttribute('x2', x);
      guide.setAttribute('visibility', 'visible');
      tip.innerHTML = cfg.tooltip(i);
      tip.style.display = 'block';
      const scale = rect.width / W;
      const tw = tip.offsetWidth;
      let left = x * scale + 10;
      if (left + tw > rect.width) left = x * scale - tw - 10;
      tip.style.left = Math.max(0, left) + 'px';
    };
    const hide = () => { guide.setAttribute('visibility', 'hidden'); tip.style.display = 'none'; };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('pointercancel', hide);
  }

  // =========================================================================
  // ページ1: 予報
  // =========================================================================
  const TIER_COLOR = { S: '#ff3b5a', A: '#ff58bc', B: '#b251ff', C: '#427eff', D: '#0db6ef' };
  // ランク色の区分: S / A / B / C(C5〜C1) / D
  const colorGroup = (tier) => (tier === 'D' ? 'D' : tier[0]);

  function buildChips() {
    const tiers = state.data.tiers;
    const rows = [];
    for (let i = 0; i < tiers.length; i += 3) {
      rows.push(tiers.slice(i, i + 3).reverse());
    }
    const reordered = rows.flat();
    $('tierChips').innerHTML = reordered
      .map((t) => `<button type="button" class="tier-btn" data-group="${colorGroup(t)}" data-tier="${esc(t)}">${esc(t)}</button>`).join('');
  }

  function updateChipStates() {
    document.querySelectorAll('#tierChips .tier-btn').forEach((b) => {
      const on = b.dataset.tier === state.tier;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    document.querySelectorAll('#stepChips .tier-btn').forEach((b) => {
      const on = Number(b.dataset.step) === state.step;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    document.querySelectorAll('#horizonChips .tier-btn').forEach((b) => {
      const on = Number(b.dataset.h) === state.horizon;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  function renderForecast() {
    const s = currentSeries();
    const title = `${state.tier} +${state.step}`;
    $('fcTitle').textContent = `${title} の予測`;
    if (!s) return;

    const fc = s.forecast;
    const dayLabel = ['今日', '明日', '明後日'];
    $('fcStats').innerHTML = [0, 1, 2].map((k) => {
      const f = fc.find((x) => daysFromToday(x.date) === k);
      const label = f ? `${dayLabel[k]} ${md(f.date)}(${DOW[dow(f.date)]})` : dayLabel[k];
      return `<div class="stat"><div class="label">${esc(label)}</div>` +
        `<div class="value">${f ? num(f.value) : '—'}</div>` +
        `<div class="range">${f ? num(f.lo) + '〜' + num(f.hi) : ''}</div></div>`;
    }).join('');

    // グラフ: 過去21日 + 予測
    const hist = s.history.slice(-21);
    const dates = hist.map((h) => h.date).concat(fc.map((f) => f.date));
    const nh = hist.length;
    const pad = (arr, front) => (front ? arr.concat(new Array(fc.length).fill(null)) : new Array(nh).fill(null).concat(arr));
    const actual = pad(hist.map((h) => h.actual), true);
    const est = pad(hist.map((h) => (h.actual == null ? h.filled : null)), true);
    const filledLine = pad(hist.map((h) => h.filled), true);
    // 予測線は最後の実測/推定値から繋ぐ
    const fcVals = pad(fc.map((f) => f.value), false);
    const lastHistIdx = nh - 1;
    if (hist[lastHistIdx] && hist[lastHistIdx].filled != null && fc.length) fcVals[lastHistIdx] = hist[lastHistIdx].filled;
    const lo = pad(fc.map((f) => f.lo), false);
    const hi = pad(fc.map((f) => f.hi), false);
    const todayIdx = dates.indexOf(todayIso());
    const fcMap = new Map(fc.map((f) => [f.date, f]));

    drawChart($('fcChart'), {
      dates,
      band: { lo, hi },
      lines: [{ cls: 'line-actual', values: filledLine.map((v, i) => (i < nh ? v : null)) }, { cls: 'line-forecast', values: fcVals }],
      dots: [
        { cls: 'dot-actual', values: actual },
        { cls: 'dot-est', values: est },
        { cls: 'dot-forecast', values: fcVals.map((v, i) => (i >= nh ? v : null)), r: 3.5 },
      ],
      todayIdx,
      tooltip: (i) => {
        const d = dates[i];
        const f = fcMap.get(d);
        let body = '';
        if (f) body = `予測 <b>${num(f.value)}</b><br>範囲 ${num(f.lo)}〜${num(f.hi)}`;
        else if (i < nh && hist[i].actual != null) body = `実測 <b>${num(hist[i].actual)}</b>`;
        else if (i < nh) body = `未登録 (推定 ${num(hist[i].filled)})`;
        return `${esc(mdw(d))}<br>${body}`;
      },
    });

    // 予測テーブル
    const fcShown = fc.filter((f) => isUpcoming(f.date));
    const head = '<tr><th></th>' + fcShown.map((f) => `<th class="${dowClass(f.date)}">${dayName(f.date)}<br>${esc(mdw(f.date))}</th>`).join('') + '</tr>';
    const rowMax = '<tr><td>最大</td>' + fcShown.map((f) => `<td>${num(f.hi)}</td>`).join('') + '</tr>';
    const rowVal = '<tr><td><b>予測</b></td>' + fcShown.map((f) => `<td><b>${num(f.value)}</b></td>`).join('') + '</tr>';
    const rowMin = '<tr><td>最小</td>' + fcShown.map((f) => `<td>${num(f.lo)}</td>`).join('') + '</tr>';
    $('fcTable').classList.add('transposed');
    $('fcTable').innerHTML = `<thead>${head}</thead><tbody>${rowMax}${rowVal}${rowMin}</tbody>`;

    const latest = s.latest;
    const parts = [];
    if (latest) parts.push(`最新の実測: ${mdw(latest.date)} ${num(latest.value)}`);
    if (s.mape_h3 != null) parts.push(`このボーダーの直近${state.data.accuracy.days}日の平均誤差: ${pct(s.mape_h3)}`);
    $('fcNote').textContent = parts.join(' ／ ');

    renderMatrix();
    renderTierSteps();
  }

  // 選択中のランクの +2 / +4 / +6 を一週間先まで
  function renderTierSteps() {
    $('tierTitle').textContent = `${state.tier}のボーダー`;
    const list = [2, 4, 6].map((st) => state.data.series.find((x) => x.id === `${state.tier}+${st}`));
    if (list.some((x) => !x)) { $('tierTable').innerHTML = ''; return; }
    const dates = list[0].forecast.map((f) => f.date).filter(isUpcoming);
    const head = '<tr><th>上昇幅</th>' + dates.map((d) => `<th class="${dowClass(d)}">${dayName(d)}<br>${esc(md(d))}(${DOW[dow(d)]})</th>`).join('') + '</tr>';
    const body = list.map((x, k) => {
      const st = [2, 4, 6][k];
      const cells = dates.map((d) => {
        const f = x.forecast.find((y) => y.date === d);
        return `<td class="${dowClass(d) === 'mon' ? 'mon' : ''}">${f ? num(f.value) : '—'}</td>`;
      }).join('');
      return `<tr data-step="${st}" data-tier="${state.tier}" class="${st === state.step ? 'selected' : ''}" tabindex="0"><td><i class="dot" style="background:${TIER_COLOR[colorGroup(state.tier)]}"></i>+${st}</td>${cells}</tr>`;
    }).join('');
    $('tierTable').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  }

  function renderMatrix() {
    const step = state.step;
    $('matrixTitle').textContent = `ランク別の予測一覧（+${step}）`;
    const list = state.data.tiers.map((t) => state.data.series.find((s) => s.id === `${t}+${step}`)).filter(Boolean);
    const dates = list[0] ? list[0].forecast.map((f) => f.date).filter(isUpcoming) : [];
    const head = '<tr><th>ランク</th>' + dates.map((d) => `<th class="${dowClass(d)}">${dayName(d)}<br>${esc(md(d))}(${DOW[dow(d)]})</th>`).join('') + '</tr>';
    const body = list.map((s) => {
      const cells = dates.map((d) => {
        const f = s.forecast.find((x) => x.date === d);
        return `<td class="${dowClass(d) === 'mon' ? 'mon' : ''}">${f ? num(f.value) : '—'}</td>`;
      }).join('');
      return `<tr data-tier="${esc(s.tier)}" class="${s.tier === state.tier ? 'selected' : ''}" tabindex="0"><td><i class="dot" style="background:${TIER_COLOR[colorGroup(s.tier)]}"></i>${esc(s.tier)}</td>${cells}</tr>`;
    }).join('');
    $('matrixTable').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  }

  // =========================================================================
  // ページ2: 精度
  // =========================================================================
  function renderCompare() {
    const s = currentSeries();
    const h = state.horizon;
    const when = { 1: '当日', 2: '前日', 3: '一昨日' }[h];
    const shown = { 1: '今日', 2: '明日', 3: '明後日' }[h];
    $('cmpTitle').textContent = `${state.tier} +${state.step}：${when}に見た予測と実際`;
    $('horizonHelp').textContent = `${when}の時点で「${shown}」として表示されていた予測と、実際に登録されたボーダーを比べています。`;
    if (!s) return;
    const key = 'p' + h;
    const hist = s.history;
    const dates = hist.map((x) => x.date);
    const actual = hist.map((x) => x.actual);
    const pred = hist.map((x) => x[key]);

    const both = hist.filter((x) => x.actual != null && x[key] != null);
    const apes = both.map((x) => Math.abs(x[key] - x.actual) / x.actual);
    const mape = apes.length ? apes.reduce((a, b) => a + b, 0) / apes.length : null;
    const within10 = apes.length ? apes.filter((a) => a <= 0.1).length / apes.length : null;
    const over = both.filter((x) => x[key] > x.actual).length;
    $('cmpStats').innerHTML =
      `<div class="stat"><div class="label">平均の誤差</div><div class="value">${pct(mape)}</div></div>` +
      `<div class="stat"><div class="label">±10%以内</div><div class="value">${pct(within10, 0)}</div></div>` +
      `<div class="stat"><div class="label">比べた日数</div><div class="value">${both.length}日</div>` +
      `<div class="range">${both.length ? `高め${over}・低め${both.length - over}` : ''}</div></div>`;

    drawChart($('cmpChart'), {
      dates,
      lines: [{ cls: 'line-forecast', values: pred }],
      dots: [{ cls: 'dot-actual', values: actual }],
      tooltip: (i) => {
        const a = actual[i], p = pred[i];
        const diff = a != null && p != null ? `<br>差 ${(((p - a) / a) * 100).toFixed(1)}%` : '';
        return `${esc(mdw(dates[i]))}<br>実際 <b>${num(a)}</b><br>予測 <b>${num(p)}</b>${diff}`;
      },
    });

    const recent = hist.filter((x) => x.actual != null).slice(-14);
    const rows = recent.map((x) => {
      const p = x[key];
      let diff = '—', cls = 'na';
      if (p != null) {
        const r = (p - x.actual) / x.actual;
        diff = (r > 0 ? '+' : '') + (r * 100).toFixed(1) + '%';
        cls = Math.abs(r) <= 0.1 ? 'good' : Math.abs(r) > 0.25 ? 'bad' : '';
      }
      return `<tr><td class="${dowClass(x.date)}">${esc(mdw(x.date))}</td><td>${num(x.actual)}</td><td>${num(p)}</td><td class="${cls}">${diff}</td></tr>`;
    }).join('');
    $('cmpTable').innerHTML = `<thead><tr><th>日付</th><th>実際</th><th>予測</th><th>差</th></tr></thead><tbody>${rows}</tbody>`;
  }

  function renderAccuracy() {
    const a = state.data.accuracy;
    $('accDays').textContent = a.days;
    $('accStats').innerHTML =
      `<div class="stat"><div class="label">今日の予測</div><div class="value">${pct(a.by_h && a.by_h[1])}</div></div>` +
      `<div class="stat"><div class="label">明日の予測</div><div class="value">${pct(a.by_h && a.by_h[2])}</div></div>` +
      `<div class="stat"><div class="label">明後日の予測</div><div class="value">${pct(a.by_h && a.by_h[3])}</div></div>`;
    const groups = [['S', 'S'], ['A', 'A'], ['B', 'B'], ['C5-C3', 'C5〜C3'], ['C2-D', 'C2〜D']];
    $('accTable').innerHTML = '<thead><tr><th>ランク</th><th>平均の誤差</th></tr></thead><tbody>' +
      groups.map(([k, label]) => `<tr><td>${label}</td><td>${pct(a.by_group && a.by_group[k])}</td></tr>`).join('') + '</tbody>';
  }

  // =========================================================================
  // ページ3 / 共通表示
  // =========================================================================
  function renderMeta() {
    const d = state.data;
    const mape = d.accuracy && d.accuracy.mape_all;
    if (mape != null) $('aboutMape').textContent = Math.round(mape * 100);
    // 更新日時は表示しない。更新が止まっているときだけ警告する
    const stale = Math.round((parseDate(todayIso()) - parseDate(d.today)) / 86400000);
    const box = $('staleNotice');
    if (stale >= 2) {
      box.hidden = false;
      box.textContent = `予測データが ${stale} 日前のものです。更新が止まっている可能性があります。`;
    } else {
      box.hidden = true;
    }
  }

  function renderAll() {
    updateChipStates();
    renderForecast();
    renderCompare();
    fitHeight();
  }

  // =========================================================================
  // ページ切り替え (メニュー / キー / スワイプ。切り替え時は画面が横にスライドする)
  // =========================================================================
  const PAGES = 3;
  const wrapper = $('sliderWrapper');
  const container = $('sliderContainer');
  const header = $('siteHeader');
  const menuBtn = $('menuBtn');
  const menuItems = [...document.querySelectorAll('#menuPanel .menu-item')];

  function fitHeight() {
    const page = $('page' + state.page);
    if (page) wrapper.style.height = page.offsetHeight + 'px';
  }

  function goToPage(i, opts = {}) {
    state.page = Math.max(0, Math.min(PAGES - 1, i));
    container.style.transform = `translateX(-${(state.page * 100) / PAGES}%)`;
    menuItems.forEach((b) => {
      const on = Number(b.dataset.page) === state.page;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    for (let p = 0; p < PAGES; p++) {
      const el = $('page' + p);
      if (p === state.page) el.removeAttribute('inert'); else el.setAttribute('inert', '');
    }
    fitHeight();
    // グラフは非表示中に幅が取れないので、表示時に描き直す
    if (state.data) { renderForecast(); renderCompare(); fitHeight(); }
    if (!opts.silent) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ヘッダーのメニューボタン
  function setMenu(open) {
    header.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    $('menuPanel').setAttribute('aria-hidden', !open);
  }
  const isMenuOpen = () => header.classList.contains('menu-open');

  menuBtn.addEventListener('click', () => setMenu(!isMenuOpen()));
  $('menuPanel').addEventListener('click', (e) => {
    const b = e.target.closest('.menu-item');
    if (b) goToPage(Number(b.dataset.page));
  });

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') goToPage(state.page + 1);
    else if (e.key === 'ArrowLeft') goToPage(state.page - 1);
  });

  // スマホ: カードの外側でのフリック
  let touchX = 0, touchY = 0;
  window.addEventListener('touchstart', (e) => {
    if (e.target.closest('.container')) return;
    if (e.touches.length === 1) { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (e.target.closest('.container')) return;
    if (e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) goToPage(state.page + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // =========================================================================
  // 選択操作
  // =========================================================================
  function select(tier, step) {
    if (tier) state.tier = tier;
    if (step) state.step = step;
    try { localStorage.setItem(SEL_KEY, seriesId()); } catch (e) { /* 保存できなくても動作に影響なし */ }
    if (history.replaceState) history.replaceState(null, '', `#${encodeURIComponent(seriesId())}`);
    renderAll();
  }

  $('tierChips').addEventListener('click', (e) => {
    const b = e.target.closest('.tier-btn');
    if (b) select(b.dataset.tier, null);
  });
  $('stepChips').addEventListener('click', (e) => {
    const b = e.target.closest('.tier-btn');
    if (b) select(null, Number(b.dataset.step));
  });
  $('horizonChips').addEventListener('click', (e) => {
    const b = e.target.closest('.tier-btn');
    if (!b) return;
    state.horizon = Number(b.dataset.h);
    updateChipStates();
    renderCompare();
    fitHeight();
  });
  const onMatrix = (e) => {
    const tr = e.target.closest('tr[data-tier]');
    if (!tr) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    select(tr.dataset.tier, null);
  };
  // 選択ランクの +2/+4/+6 の表: 行をタップで上昇幅を切り替え
  const onStepRow = (e) => {
    const tr = e.target.closest('tr[data-step]');
    if (!tr) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    select(null, Number(tr.dataset.step));
  };
  $('tierTable').addEventListener('click', onStepRow);
  $('tierTable').addEventListener('keydown', onStepRow);
  $('matrixTable').addEventListener('click', onMatrix);
  $('matrixTable').addEventListener('keydown', onMatrix);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (state.data) { renderForecast(); renderCompare(); } fitHeight(); }, 120);
  });

  // =========================================================================
  // 起動
  // =========================================================================
  const SEL_KEY = 'iriam-border-selection';

  function initialSelection() {
    const re = /^([A-Z]\d?)\+(\d)$/;
    let m = decodeURIComponent(location.hash.slice(1)).match(re);
    if (!m) {
      try { m = (localStorage.getItem(SEL_KEY) || '').match(re); } catch (e) { m = null; }
    }
    if (m && state.data.tiers.includes(m[1]) && [2, 4, 6].includes(Number(m[2]))) {
      state.tier = m[1];
      state.step = Number(m[2]);
    } else if (!state.data.tiers.includes(state.tier)) {
      state.tier = state.data.tiers[0];
    }
  }

  async function load() {
    try {
      const res = await fetch('data/forecast.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.series || !data.series.length) throw new Error('empty');
      state.data = data;
    } catch (err) {
      console.error('forecast.json の読み込みに失敗しました', err);
      $('updatedText').textContent = '予測データを読み込めませんでした。時間をおいて再度お試しください。';
      fitHeight();
      return;
    }
    initialSelection();
    buildChips();
    renderMeta();
    renderAccuracy();
    const q = Number(new URLSearchParams(location.search).get('page'));
    goToPage(Number.isInteger(q) && q >= 0 && q < PAGES ? q : 0, { silent: true });
    renderAll();
  }

  window.addEventListener('hashchange', () => {
    if (!state.data) return;
    const before = seriesId();
    initialSelection();
    if (seriesId() !== before) renderAll();
  });

  goToPage(0, { silent: true });
  load();

  // 0時を過ぎたら日付表示を更新する (数値は予測データの更新時に入れ替わる)
  let lastDate = todayIso();
  function refreshDates() {
    const now = todayIso();
    if (now === lastDate) return;
    lastDate = now;
    if (state.data) { renderForecast(); renderCompare(); fitHeight(); }
  }
  function scheduleMidnight() {
    const n = new Date();
    const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1);
    setTimeout(() => { refreshDates(); scheduleMidnight(); }, next - n);
  }
  scheduleMidnight();
  setInterval(refreshDates, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDates(); });
  window.addEventListener('focus', refreshDates);
})();
