// 현황판: 30초마다 fetchCounts(), 탭 숨김 시 중단, 실패 시 10초 후 재시도
(function () {
  const OK_MS = 30000, RETRY_MS = 10000;
  const grid = document.getElementById('grid');
  const notice = document.getElementById('notice');
  const updated = document.getElementById('updated');
  const btn = document.getElementById('refresh');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cells = new Map(); // code -> {title, today, total}
  let last = null, timer = null, busy = false, loaded = false;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = (n) => Number(n).toLocaleString('ko-KR');

  function stat(ko, en) {
    const box = el('div', 'stat');
    const lbl = el('div', 'lbl', ko + ' ');
    lbl.appendChild(el('small', null, en));
    const val = el('div', 'val');
    const num = el('span', 'num', '–');
    val.append(num, el('span', 'unit', '회'));
    box.append(lbl, val);
    return { box, num };
  }

  function placeholder() {
    grid.replaceChildren();
    const e = el('div', 'empty', '아직 명소가 없어요 ');
    e.appendChild(el('small', null, 'No spots yet'));
    grid.appendChild(e);
  }

  function pop(node) {
    if (reduce.matches) return;
    node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop');
  }

  function setNum(c, key, v) {
    const old = c[key + 'V'];
    c[key].textContent = fmt(v);
    if (old !== undefined && v > old) pop(c[key]);
    c[key + 'V'] = v;
  }

  const ALL = new URLSearchParams(location.search).get('all') === '1';
  const STEPS = [
    ['visit', 'QR 접속', 'QR visits'], ['camera_on', '카메라 켜짐', 'Camera on'], ['shoot_done', '촬영 완료', 'Shots done'],
    ['photo_done', '사진 완성', 'Photo made'], ['ad_done', '광고 끝까지 봄', 'Ad watched'], ['save', '사진 저장', 'Saved'],
  ];
  const FILTER_NAMES = { softlight: '윤슬', grainy: '모래알', rio: '노을', graphite: '밤바다', none: '필터 없음' };
  const pct = (a, b) => (b > 0 ? Math.min(100, Math.round(a / b * 100)) + '%' : '–');   // 기록 시작 전 세션 등으로 100% 넘는 경우는 100%로

  // 숫자 칸 (오를 때 pop 효과) — c.nums[key] = {node, v}
  function numNode(c, key) {
    const n = el('span', 'n', '–'); c.nums[key] = { node: n, v: undefined }; return n;
  }
  function setN(c, key, v) {
    const o = c.nums[key]; if (!o) return;
    o.node.textContent = fmt(v);
    if (o.v !== undefined && v > o.v) pop(o.node);
    o.v = v;
  }
  function lblCell(ko, en) { const d = el('div', 'fl', ko + ' '); d.appendChild(el('small', null, en)); return d; }

  function buildCard(r) {
    const c = { nums: {}, pcts: {}, bars: {}, hourBars: [], filters: null };
    const card = el('article', 'spot');
    c.title = el('h2'); c.title.textContent = r.name;
    const t = stat('오늘', 'Today'), a = stat('전체', 'Total');
    c.today = t.num; c.total = a.num;
    const pair = el('div', 'pair'); pair.append(t.box, a.box);
    const cap = el('p', 'cap', '사진 장수 기준 · 아래 흐름은 사람(접속) 수 '); cap.appendChild(el('small', null, 'Photos · funnel below counts people'));
    card.append(c.title, pair, cap);

    const head = el('div', 'frow fhead');
    head.append(el('div'), el('div', 'fc', '오늘'), el('div', 'fc', '전체'), el('div', 'fc', '이전 대비'));
    const fun = el('div', 'funnel'); fun.appendChild(head);
    STEPS.forEach(([k, ko, en], i) => {
      const row = el('div', 'frow');
      const lab = lblCell(ko, en);
      const bar = el('div', 'bar'); const fill = el('i'); bar.appendChild(fill); c.bars[k] = fill;
      lab.appendChild(bar);
      const pc = el('div', 'fc pc', '–'); c.pcts[k] = pc;
      row.append(lab, el('div', 'fc', null), el('div', 'fc', null), i === 0 ? el('div', 'fc pc', '기준') : pc);
      row.children[1].appendChild(numNode(c, k + '.today'));
      row.children[2].appendChild(numNode(c, k + '.total'));
      fun.appendChild(row);
    });
    card.appendChild(fun);

    card.appendChild(el('hr', 'div'));
    const ex = el('div', 'funnel');
    [['ad_shown', '광고 노출', 'Ad shown', false], ['ad_click', '광고 링크 클릭', 'Ad link clicks', false],
     ['coupon_save', '쿠폰 저장', 'Coupon saved', true], ['coupon_use', '쿠폰 사용', 'Coupon used', true]].forEach(([k, ko, en, soon]) => {
      const row = el('div', 'frow');
      row.append(lblCell(ko, en));
      if (soon) {
        const s2 = el('div', 'soon', '0 · 준비 중 '); s2.appendChild(el('small', null, 'Coming soon'));
        row.append(s2);
      } else {
        row.append(el('div', 'fc', null), el('div', 'fc', null), el('div', 'fc'));
        row.children[1].appendChild(numNode(c, k + '.today')); row.children[2].appendChild(numNode(c, k + '.total'));
      }
      ex.appendChild(row);
    });
    card.appendChild(ex);

    const hh = el('h3', 'sec', '시간대별 오늘 사진 '); hh.appendChild(el('small', null, 'Photos today by hour'));
    const chart = el('div', 'hours');
    for (let h = 0; h < 24; h++) {
      const col = el('div', 'hc'); const b = el('i'); b.title = h + '시';
      col.appendChild(b);
      if (h % 6 === 0) col.appendChild(el('span', 'hl', String(h)));
      chart.appendChild(col); c.hourBars.push(b);
    }
    card.append(hh, chart);

    const fh = el('h3', 'sec', '인기 필터 '); fh.appendChild(el('small', null, 'Popular filters'));
    c.filters = el('ol', 'filters');
    card.append(fh, c.filters);
    c.card = card;
    return c;
  }

  function fillCard(c, r, counts) {
    c.title.textContent = r.name;
    const f = r.funnel || {};
    const g = (k, w) => Number(((f[k] || r[k]) || {})[w]) || 0;
    if (counts) { setNum(c, 'today', Number(counts.today) || 0); setNum(c, 'total', Number(counts.total) || 0); }
    const base = g('visit', 'total');
    STEPS.forEach(([k], i) => {
      setN(c, k + '.today', g(k, 'today')); setN(c, k + '.total', g(k, 'total'));
      c.bars[k].style.width = (base > 0 ? Math.min(100, g(k, 'total') / base * 100) : 0) + '%';
      if (i > 0) c.pcts[k].textContent = pct(g(k, 'total'), g(STEPS[i - 1][0], 'total'));
    });
    ['ad_shown', 'ad_click'].forEach((k) => { setN(c, k + '.today', g(k, 'today')); setN(c, k + '.total', g(k, 'total')); });
    const hours = Array.isArray(r.hours) ? r.hours : [];
    const mx = Math.max(1, ...hours.map(Number));
    c.hourBars.forEach((b, h) => { const v = Number(hours[h]) || 0; b.style.height = v ? Math.max(6, v / mx * 100) + '%' : '2px'; b.title = h + '시 · ' + v; });
    const fl = Array.isArray(r.filters) ? r.filters : [];
    c.filters.replaceChildren();
    if (!fl.length) c.filters.appendChild(el('li', 'none', '아직 없어요'));
    fl.forEach((x) => {
      const li = el('li'); li.append(el('span', null, FILTER_NAMES[x.ref] || x.ref), el('b', null, fmt(x.total) + '회'));
      li.appendChild(el('small', null, ' 오늘 ' + fmt(x.today)));
      c.filters.appendChild(li);
    });
  }

  function render(funnel, counts) {
    let rows = Array.isArray(funnel) ? funnel : [];
    if (!ALL) rows = rows.filter((r) => r.code !== 'test');
    if (!rows.length) { cells.clear(); render.codes = null; placeholder(); return; }
    const byCode = new Map((Array.isArray(counts) ? counts : []).map((x) => [x.code, x]));
    const codes = rows.map((r) => r.code).join('|');
    if (render.codes !== codes) { // 명소 목록이 바뀐 경우에만 카드 재구성
      render.codes = codes; cells.clear(); grid.replaceChildren();
      rows.forEach((r) => { const c = buildCard(r); cells.set(r.code, c); grid.appendChild(c.card); });
    }
    rows.forEach((r) => { const c = cells.get(r.code); if (c) fillCard(c, r, byCode.get(r.code)); });
  }

  function schedule(ms) { clearTimeout(timer); timer = setTimeout(load, ms); }

  async function load() {
    clearTimeout(timer);
    if (busy) return;
    busy = true; btn.disabled = true;
    let ok = false;
    try {
      const [fu, co] = await Promise.all([fetchFunnel(), fetchCounts()]);
      render(fu, co);
      ok = true; loaded = true; notice.hidden = true;
      last = new Date();
      updated.textContent = '마지막 갱신 ' + last.toTimeString().slice(0, 8) + ' · 30초마다 자동 새로고침 / Updated ' + last.toTimeString().slice(0, 8) + ' · auto-refresh every 30s';
    } catch (e) {
      console.warn('stats load failed:', e && e.message);
      notice.hidden = false; // 마지막 숫자는 그대로 유지
    } finally {
      busy = false; btn.disabled = false;
    }
    if (!document.hidden) schedule(ok ? OK_MS : RETRY_MS);
  }

  btn.addEventListener('click', load);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer); else load();
  });

  // 처음 로딩 중: 숫자 자리에 '–'
  grid.replaceChildren();
  const ph = stat('오늘', 'Today'); // 로딩 자리표시용 임시 카드
  const card = el('article', 'spot'); const h = el('h2', null, '–');
  const pair = el('div', 'pair'); pair.append(ph.box, stat('전체', 'Total').box);
  card.append(h, pair); grid.appendChild(card);
  load();
})();
