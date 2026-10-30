/* 해변네컷 이용 장면 데모
 * 하나의 시간 t(초)를 갱신하고, render(t) 가 그 시간의 모습을 전부 계산해 그리는 방식이에요.
 * (requestAnimationFrame + 상태 함수) → 일시정지·처음부터·진행 막대 이동이 모두 같은 코드로 돼요.
 */
(function () {
  'use strict';

  /* ===== 장면별 시간표 (초). 자막은 한국어(ko)/영어(en) ===== */
  const SCENES = [
    { id: 1, start: 0,  end: 4,  ko: '강원 양양 인구해변',         en: 'Ingu Beach, Yangyang' },
    { id: 2, start: 4,  end: 8,  ko: '포스터를 발견했어요',         en: 'Spotted the poster' },
    { id: 3, start: 8,  end: 12, ko: 'QR을 스캔하면 바로 시작',     en: 'Scan the QR — no app needed' },
    { id: 4, start: 12, end: 16, ko: '휴대폰을 거치대에 세워두세요',   en: 'Stand your phone on the holder' },
    { id: 5, start: 16, end: 22, ko: '카운트다운에 맞춰 6장 촬영',   en: '6 shots with a countdown' },
    { id: 6, start: 22, end: 28, ko: '4장 고르고, 필터와 스티커',    en: 'Pick 4, add a filter & stickers' },
    { id: 7, start: 28, end: 32, ko: '나만의 해변네컷 완성!',       en: 'Your beach photo strip!' },
    { id: 8, start: 32, end: 36, ko: '', en: '' }                      // 마무리 카드(자막 없음)
  ];
  const END_HOLD = 2;                                   // 마무리 뒤 멈춰 있는 시간
  const TOTAL = SCENES[SCENES.length - 1].end + END_HOLD; // 38초
  const XFADE = 0.4;                                    // 장면 전환 크로스페이드

  /* ===== 무대 좌표 상수 (1600x900) ===== */
  const GROUND_Y = 690;            // 사람이 서는 모래 위 y
  const STRIDE = 70;               // 반 걸음(px). 걸음 흔들림 위상 = π·x/STRIDE
  const M = { x: 720, y: 503.5 };  // 이젤 선반에 세워둔 휴대폰 중심(선반 윗면 y=586)
  const QR = { x: 672, y: 420, w: 96, h: 96 };
  const SHOTS = 6;
  const SHOT_T0 = 16;              // 5장면 시작, 한 장 1초
  const PICKS = [1, 0, 4, 5];      // 6장 중 고른 4장(번호 1~4 순서)
  const POSE_OF_SHOT = ['v', 'heart', 'jump', 'v', 'heart', 'jump'];
  const STK_DIR = 'assets/stickers/';
  const IMAGES = ['assets/logo-black-hd.png', 'assets/logo-white.png', 'assets/bg-sea.jpg']
    .concat(['01-dolphin', '03-starfish-yellow', '04-turtle', '09-shell', '12-clownfish', '14-hibiscus'].map(n => STK_DIR + n + '.png'));

  /* ===== 수학 도우미 ===== */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = u => { u = clamp(u); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };   // ease-in-out
  const easeOutBack = u => { u = clamp(u); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }; // 톡 튀어나옴
  // 키프레임 보간: a=[[시간,값],...], 구간마다 ease-in-out
  function kf(t, a) {
    if (t <= a[0][0]) return a[0][1];
    for (let i = 0; i < a.length - 1; i++) {
      if (t < a[i + 1][0]) return lerp(a[i][1], a[i + 1][1], ease((t - a[i][0]) / (a[i + 1][0] - a[i][0])));
    }
    return a[a.length - 1][1];
  }
  // a 에서 f 초 동안 나타나고, b 부터 f 초 동안 사라지는 0~1 창
  const win = (t, a, b, f = XFADE) => ease((t - a) / f) * (1 - ease((t - b) / f));
  // 장면 i 의 가중치 (경계마다 0.4초 크로스페이드)
  function sceneW(i, t) {
    const s = SCENES[i];
    const inn = i === 0 ? ease((t - 0.5) / XFADE) : ease((t - (s.start - XFADE / 2)) / XFADE);
    const out = ease((t - (s.end - XFADE / 2)) / XFADE);
    return inn * (1 - out);
  }
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  function seeded(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }

  /* ===== 키프레임 표 ===== */
  // 사람 x 위치: 왼쪽에서 걸어 들어옴 → 포스터 앞 → 이젤 선반에 휴대폰 올림 → 오른쪽으로 물러남 → (촬영 뒤) 휴대폰 가지러 다녀옴
  const PX = [[0, -200], [4.2, -200], [7.2, 560], [11.4, 560], [12.1, 575], [13.9, 575], [15.7, 1000], [22, 1000], [22.8, 850], [23.5, 850], [24.4, 1000], [40, 1000]];
  // 휴대폰: 사람 기준 상대 위치(주머니 → 스캔 → 들고 걷기 → 가슴 앞 → 주머니)
  const REL = { pocket: [30, -168], scan: [118, -240], carry: [56, -205], chest: [2, -205], place: [135, -187], grab: [-130, -187] };
  const REL_T = [[8.4, 'pocket'], [9.4, 'scan'], [11.4, 'scan'], [12.1, 'carry'], [13.0, 'place'], [22.8, 'grab'], [23.3, 'carry'], [24.2, 'chest'], [28.9, 'chest'], [29.6, 'pocket']];
  const RX = REL_T.map(([t, k]) => [t, REL[k][0]]);
  const RY = REL_T.map(([t, k]) => [t, REL[k][1]]);
  const PH_ROT = [[9.0, 0], [9.6, -8], [11.4, -8], [12.0, 0]];
  const PH_WM = [[13.0, 0], [13.4, 1], [22.9, 1], [23.3, 0]];            // 1이면 이젤 선반에 세워둔 상태
  const PH_ALPHA = [[8.4, 0], [8.8, 1], [29.2, 1], [29.7, 0]];
  const HOLD_R = [[0, 0], [8.4, 0], [8.8, 1], [13.4, 1], [13.9, 0], [22.7, 0], [23.1, 1], [28.9, 1], [29.6, 0]];
  const HOLD_L = [[0, 0], [22.6, 0], [23.0, 1], [28.9, 1], [29.5, 0]];
  const TILT = [[7.0, 0], [7.8, 12], [8.8, 12], [9.4, 0]];               // 고개 기울임(도)
  const POSTER_SCALE = [[7.2, 1], [8.0, 1.1], [8.8, 1.1], [9.4, 1]];     // 포스터 살짝 확대
  // 포즈: 손 목표(사람 기준 좌표), 하트/브이/엄지 표시, 웃음 정도
  const POSES = {
    rest:  { rx: 42, ry: -122, lx: -42, ly: -122, heart: 0, v: 0, thumb: 0, smile: .45 },
    v:     { rx: 72, ry: -350, lx: -42, ly: -122, heart: 0, v: 1, thumb: 0, smile: 1 },
    heart: { rx: 14, ry: -352, lx: -14, ly: -352, heart: 1, v: 0, thumb: 0, smile: 1 },
    jump:  { rx: 66, ry: -340, lx: -66, ly: -340, heart: 0, v: 0, thumb: 0, smile: 1 },
    thumb: { rx: 70, ry: -292, lx: -42, ly: -122, heart: 0, v: 0, thumb: 1, smile: 1 }
  };
  const POSE_TL = (function () {
    const a = [[0, 'rest'], [SHOT_T0, 'rest']];
    for (let k = 0; k < SHOTS; k++) { a.push([SHOT_T0 + k + .38, POSE_OF_SHOT[k]], [SHOT_T0 + k + .92, POSE_OF_SHOT[k]]); }
    a.push([22.6, 'rest'], [30.2, 'rest'], [30.9, 'thumb'], [33, 'thumb'], [33.6, 'rest']);
    return a;
  })();
  const POSE_KEYS = Object.keys(POSES.rest);
  function poseAt(t) {
    const a = POSE_TL; let i = 0;
    if (t <= a[0][0]) return POSES[a[0][1]];
    if (t >= a[a.length - 1][0]) return POSES[a[a.length - 1][1]];
    while (t >= a[i + 1][0]) i++;
    const u = ease((t - a[i][0]) / (a[i + 1][0] - a[i][0])), p = POSES[a[i][1]], q = POSES[a[i + 1][1]], o = {};
    POSE_KEYS.forEach(k => { o[k] = lerp(p[k], q[k], u); });
    return o;
  }
  // 점프: 점프 포즈(3번째·6번째 샷)에서만 위로 뜸
  function jumpAt(t) {
    const k = Math.floor(t - SHOT_T0);
    if (k < 0 || k >= SHOTS || POSE_OF_SHOT[k] !== 'jump') return 0;
    return 70 * Math.sin(Math.PI * clamp((t - SHOT_T0 - k - .3) / .55));
  }
  const personX = t => kf(t, PX);

  /* ===== 요소 참조 ===== */
  const E = {};
  ['stage', 'box', 'player', 'poster', 'person', 'head', 'mouth', 'heart', 'fxV', 'fxT', 'shPerson', 'phone', 'phoneL', 'phGlow', 'phHalo', 'beam', 'brk', 'check', 'count', 'countN', 'corner', 'cornerN', 'dim', 'bp', 'scrStart', 'scrEdit', 'scrPick', 'sBtn', 'nextB', 'grid6', 'grid4', 'warm', 'chips', 'tray', 'strip', 'save', 'saveT', 'card', 'capband', 'caps', 'flash', 'fade', 'loading', 'bigplay', 'bPlay', 'bRestart', 'bar', 'fill', 'thumb', 'time', 'icoPlay', 'icoPause', 'clouds', 'birds', 'waves', 'glitter', 'wet', 'foam', 'pqr']
    .forEach(id => { E[id] = $(id); });
  const L = {}; ['legL', 'legR', 'shL', 'shR', 'shoeL', 'shoeR', 'a1L', 'a2L', 'a1sL', 'hL', 'a1R', 'a2R', 'a1sR', 'hR'].forEach(id => { L[id] = $(id); });

  /* ===== 장면 요소 만들기 ===== */
  // 포스터 QR: 실제 QR 이 아니라 모양만 흉내 낸 가짜 무늬(정사각 격자 블록)
  function buildFakeQR() {
    const n = 25, rnd = seeded(7); let d = '';
    const finder = (x, y) => x < 8 && y < 8 || x > n - 9 && y < 8 || x < 8 && y > n - 9;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      if (rnd() > .52) d += `M${x} ${y}h1v1h-1z`;
    }
    const f = (ox, oy) => `M${ox} ${oy}h7v7h-7zM${ox + 1} ${oy + 1}v5h5v-5z M${ox + 2} ${oy + 2}h3v3h-3z`;
    E.pqr.innerHTML = `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path fill="#1a1a1a" fill-rule="evenodd" d="${d}${f(0, 0)}${f(n - 7, 0)}${f(0, n - 7)}"/></svg>`;
  }
  const bgItems = { clouds: [], birds: [], waves: [], glitter: [] };
  function buildBackground() {
    [[120, 120, 1], [820, 70, .8], [1330, 160, 1.1]].forEach(([x, y, s]) => {
      const g = svgEl('g', { fill: '#fbe0c4', opacity: .7 }, E.clouds);
      svgEl('ellipse', { cx: 0, cy: 0, rx: 90 * s, ry: 22 * s }, g); svgEl('ellipse', { cx: -30 * s, cy: -14 * s, rx: 44 * s, ry: 22 * s }, g); svgEl('ellipse', { cx: 34 * s, cy: -10 * s, rx: 36 * s, ry: 18 * s }, g);
      bgItems.clouds.push({ g, x, y, sp: 3 + s * 2 });
    });
    [[300, 150, 26], [560, 210, 30]].forEach(([x, y, sp], i) => {
      const p = svgEl('path', { d: 'M0 0 q10 -11 20 0 q10 -11 20 0' }, E.birds);
      bgItems.birds.push({ p, x, y, sp, ph: i * 2 });
    });
    const r = seeded(21);
    for (let i = 0; i < 9; i++) {
      const el = svgEl('rect', { height: 5, rx: 2.5, fill: '#9cc3d6', opacity: .4 }, E.waves);
      bgItems.waves.push({ el, x: r() * 1500, y: 352 + i * 15 + r() * 6, w: 90 + r() * 170, ph: r() * 6.28 });
    }
    for (let i = 0; i < 22; i++) {
      const x = 1010 + (r() - .5) * 520 * (0.35 + (i % 7) / 9), y = 348 + r() * 128;
      const el = svgEl('ellipse', { rx: 7 + r() * 9, ry: 2.2 + r() * 1.5, fill: '#ffe9b0' }, E.glitter);
      bgItems.glitter.push({ el, x, y, ph: r() * 6.28, sp: 1.6 + r() * 2 });
    }
    let w = 'M-100 0'; for (let i = 0; i < 19; i++) w += 'q25 -14 50 0 t50 0';
    bgItems.foamD = w + 'L1800 70L-100 70Z';
    E.foam.setAttribute('d', bgItems.foamD); E.wet.setAttribute('d', bgItems.foamD);
  }
  function updateBackground(t) {
    bgItems.clouds.forEach(c => c.g.setAttribute('transform', `translate(${((c.x + t * c.sp + 200) % 1900) - 200} ${c.y})`));
    bgItems.birds.forEach(b => b.p.setAttribute('transform', `translate(${((b.x + t * b.sp) % 1800) - 100} ${b.y + Math.sin(t * 1.3 + b.ph) * 10}) scale(${1 + Math.sin(t * 7 + b.ph) * .12} ${1 + Math.sin(t * 7 + b.ph) * .35})`));
    bgItems.waves.forEach(w => { w.el.setAttribute('x', w.x + Math.sin(t * .5 + w.ph) * 26); w.el.setAttribute('y', w.y); w.el.setAttribute('width', w.w); });
    bgItems.glitter.forEach(g => {
      const a = Math.max(0, Math.sin(t * g.sp + g.ph)); const s = .5 + a * .7;
      g.el.setAttribute('opacity', (.12 + .88 * a * a * a).toFixed(3));
      g.el.setAttribute('transform', `translate(${g.x + Math.sin(t * .4 + g.ph) * 8} ${g.y}) scale(${s})`);
    });
    E.foam.setAttribute('transform', `translate(${-((t * 10) % 100)} ${480 + Math.sin(t * .9) * 6})`);
    E.wet.setAttribute('transform', `translate(${-((t * 6 + 40) % 100)} ${496 + Math.sin(t * .9 + 1) * 5})`);
  }

  // 사진 한 컷(노을 바다 + 사람 실루엣)
  function photoSVG(i) {
    const pose = POSE_OF_SHOT[i], cx = 80 + [0, -18, 14, 20, -12, 8][i], sx = [52, 100, 70, 112, 40, 90][i];
    const j = pose === 'jump' ? -12 : 0;
    let arms = '', legs = `<line x1="${cx - 4}" y1="90" x2="${cx - 5}" y2="110"/><line x1="${cx + 4}" y1="90" x2="${cx + 5}" y2="110"/>`, extra = '';
    if (pose === 'v') { arms = `<line x1="${cx + 7}" y1="70" x2="${cx + 17}" y2="46"/><line x1="${cx + 17}" y1="46" x2="${cx + 14}" y2="38"/><line x1="${cx + 17}" y1="46" x2="${cx + 21}" y2="38"/><line x1="${cx - 7}" y1="70" x2="${cx - 12}" y2="90"/>`; }
    if (pose === 'heart') { arms = `<line x1="${cx + 7}" y1="70" x2="${cx + 3}" y2="44"/><line x1="${cx - 7}" y1="70" x2="${cx - 3}" y2="44"/>`; extra = `<path d="M${cx} 44 c-9 -6 -7 -14 0 -9 c7 -5 9 3 0 9z" fill="#e98a6b" stroke="none"/>`; }
    if (pose === 'jump') { arms = `<line x1="${cx + 7}" y1="70" x2="${cx + 19}" y2="48"/><line x1="${cx - 7}" y1="70" x2="${cx - 19}" y2="48"/>`; legs = `<line x1="${cx - 4}" y1="90" x2="${cx - 11}" y2="104"/><line x1="${cx + 4}" y1="90" x2="${cx + 11}" y2="104"/>`; }
    return `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice"><rect width="160" height="64" fill="url(#phSky)"/><circle cx="${sx}" cy="58" r="19" fill="#fff1c9" opacity=".35"/><circle cx="${sx}" cy="58" r="11" fill="#fde7b8"/>` +
      `<rect y="64" width="160" height="22" fill="url(#phSea)"/><rect x="${sx - 14}" y="69" width="9" height="2" rx="1" fill="#ffe6a8"/><rect x="${sx + 4}" y="75" width="12" height="2" rx="1" fill="#ffe6a8"/><rect y="86" width="160" height="34" fill="#ead2a8"/>` +
      (pose === 'jump' ? `<ellipse cx="${cx}" cy="112" rx="9" ry="2.5" fill="#c9ad7f" opacity=".6"/>` : '') +
      `<g transform="translate(0 ${j})" stroke="#3a2b30" stroke-width="4.6" stroke-linecap="round" fill="none">${legs}${arms}<rect x="${cx - 8}" y="66" width="16" height="26" rx="7" fill="#3a2b30" stroke="none"/><circle cx="${cx}" cy="58" r="7.5" fill="#3a2b30" stroke="none"/>${extra}</g></svg>`;
  }
  const FILTER_CSS = a => `sepia(${(.35 * a).toFixed(3)}) saturate(${(1 + .3 * a).toFixed(3)}) hue-rotate(${(-6 * a).toFixed(2)}deg) brightness(${(1 + .04 * a).toFixed(3)})`;
  const STICKERS = [   // 장면6: 휴대폰 안 스티커 (x,y 는 2×2 사진 격자 기준) / 띠 위 위치(sx,sy)
    { f: '03-starfish-yellow', x: 0,   y: 36,  s: 66, r: -12, t: 26.5, sx: 0,   sy: 24,  ss: 62 },
    { f: '14-hibiscus',        x: 222, y: 30,  s: 62, r: 10,  t: 27.0, sx: 168, sy: 300, ss: 64 },
    { f: '09-shell',           x: 204, y: 166, s: 60, r: -8,  t: 27.5, sx: 150, sy: 586, ss: 58 }
  ];
  const stkEls = [];
  function buildScreens() {
    // 6장 고르기
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = photoSVG(i) + '<div class="sel"></div><div class="badge"></div>';
      E.grid6.appendChild(d);
    }
    // 고른 4장(2×2)
    PICKS.forEach((p, n) => {
      const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = photoSVG(p) + `<div class="num">${n + 1}</div>`; E.grid4.insertBefore(d, E.warm);
    });
    STICKERS.forEach(s => {
      const im = document.createElement('img'); im.className = 'stk'; im.src = STK_DIR + s.f + '.png';
      Object.assign(im.style, { left: s.x + 'px', top: s.y + 'px', width: s.s + 'px', height: s.s + 'px' }); E.grid4.appendChild(im); stkEls.push(im);
    });
    [['윤슬', 'Glimmer'], ['모래알', 'Sand'], ['노을', 'Golden Hour'], ['밤바다', 'Night Sea']].forEach(([k, e]) => {
      const c = document.createElement('div'); c.className = 'chip'; c.innerHTML = `${k}<small>${e}</small>`; E.chips.appendChild(c);
    });
    ['03-starfish-yellow', '14-hibiscus', '09-shell', '01-dolphin', '04-turtle', '12-clownfish'].forEach(f => {
      const d = document.createElement('div'); d.innerHTML = `<img src="${STK_DIR}${f}.png" alt="">`; E.tray.appendChild(d);
    });
    E.chipEls = E.chips.children; E.trayEls = E.tray.children; E.badges = E.grid6.querySelectorAll('.badge'); E.sels = E.grid6.querySelectorAll('.sel'); E.cells6 = E.grid6.children;
    // 완성 네 컷 띠: 1:3 크림 띠, 사진 4칸 + 하단 로고·'인구해변'·날짜
    const d = new Date(), ds = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
    let h = ''; PICKS.forEach(p => { h += `<div class="sp" data-f>${photoSVG(p)}</div>`; });
    h += `<div class="sf"><b>인구해변</b><img src="assets/logo-black-hd.png" alt=""><i>${ds}</i></div>`;
    E.strip.innerHTML = h;
    STICKERS.forEach(s => {
      const im = document.createElement('img'); im.className = 'stk'; im.src = STK_DIR + s.f + '.png';
      Object.assign(im.style, { left: s.sx + 'px', top: s.sy + 'px', width: s.ss + 'px', height: s.ss + 'px', transform: `rotate(${s.r}deg)` }); E.strip.appendChild(im);
    });
    E.stripPhotos = E.strip.querySelectorAll('.sp');
    // 자막
    SCENES.forEach(s => { if (!s.ko) return; const c = document.createElement('div'); c.className = 'cap'; c.innerHTML = `<b>${s.ko}</b><span>${s.en}</span>`; E.caps.appendChild(c); });
    E.capEls = E.caps.children;
  }
  // 사진 색칠에 쓰는 공용 그라데이션(폭 0 SVG 에 한 번만 정의)
  function buildDefs() {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('width', 0); s.setAttribute('height', 0); s.style.position = 'absolute';
    s.innerHTML = '<defs><linearGradient id="phSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb6d9"/><stop offset=".4" stop-color="#f6c89a"/><stop offset=".8" stop-color="#f2a97a"/><stop offset="1" stop-color="#e98a6b"/></linearGradient><linearGradient id="phSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f93ad"/><stop offset="1" stop-color="#3d6f8c"/></linearGradient></defs>';
    document.body.appendChild(s);
  }

  /* ===== 사람 그리기 (막대 + 둥근 끝) ===== */
  const L1 = 60, L2 = 58, LEG = 146, HIP_Y = -148, SH_Y = -236;
  const line = (el, x1, y1, x2, y2) => { el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2); };
  // 팔 2마디 역운동학: 손 목표로 팔꿈치 위치 계산(더 아래쪽 팔꿈치를 고름)
  function ik(sx, sy, tx, ty) {
    let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy); const max = L1 + L2 - .5;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    d = Math.max(d, 24);
    const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), base = Math.atan2(dy, dx);
    const c1 = [sx + L1 * Math.cos(base + a), sy + L1 * Math.sin(base + a)], c2 = [sx + L1 * Math.cos(base - a), sy + L1 * Math.sin(base - a)];
    const e = c1[1] > c2[1] ? c1 : c2;
    return { ex: e[0], ey: e[1], hx: sx + dx, hy: sy + dy };
  }
  function drawArm(side, tx, ty) {
    const sx = side === 'L' ? -34 : 34, r = ik(sx, SH_Y, tx, ty), k = .42;
    line(L['a1' + side], sx, SH_Y, r.ex, r.ey); line(L['a2' + side], r.ex, r.ey, r.hx, r.hy);
    line(L['a1s' + side], sx, SH_Y, sx + (r.ex - sx) * k, SH_Y + (r.ey - SH_Y) * k);
    L['h' + side].setAttribute('cx', r.hx); L['h' + side].setAttribute('cy', r.hy);
    return r;
  }
  function phoneAbs(t) {
    const wm = kf(t, PH_WM), px = personX(t);
    return {
      x: lerp(px + kf(t, RX), M.x, wm), y: lerp(GROUND_Y + kf(t, RY), M.y, wm),
      rot: kf(t, PH_ROT), a: kf(t, PH_ALPHA)
    };
  }
  function updatePerson(t) {
    const x = personX(t), v = Math.abs(personX(t + .04) - personX(t - .04)) / .08, amp = clamp(v / 50);
    const phase = Math.PI * x / STRIDE, sw = Math.sin(phase) * 24 * amp * Math.PI / 180;
    const jump = jumpAt(t), bob = Math.abs(Math.sin(phase)) * 5 * amp, y = GROUND_Y - jump - bob;
    E.person.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    E.shPerson.setAttribute('cx', x); E.shPerson.setAttribute('cy', GROUND_Y + 4); E.shPerson.setAttribute('rx', 48 - jump * .25); E.shPerson.setAttribute('opacity', 1 - jump / 160);
    // 다리 흔들림(걷기)
    [['L', -15, sw], ['R', 15, -sw]].forEach(([s, hx, a]) => {
      const fx = hx + LEG * Math.sin(a), fy = HIP_Y + LEG * Math.cos(a);
      line(L['leg' + s], hx, HIP_Y, fx, fy); line(L['sh' + s], hx, HIP_Y, hx + (fx - hx) * .34, HIP_Y + (fy - HIP_Y) * .34);
      L['shoe' + s].setAttribute('cx', fx); L['shoe' + s].setAttribute('cy', fy + 3);
    });
    // 팔: 포즈 손 목표 ↔ 휴대폰 잡기 목표 섞기
    const p = poseAt(t), ph = phoneAbs(t), hr = kf(t, HOLD_R), hl = kf(t, HOLD_L);
    const rx = lerp(p.rx, ph.x - x + 14, hr), ry = lerp(p.ry, ph.y - GROUND_Y + 36, hr);
    const lx = lerp(p.lx, ph.x - x - 22, hl), ly = lerp(p.ly, ph.y - GROUND_Y + 36, hl);
    const R = drawArm('R', rx, ry); drawArm('L', lx, ly);
    // 손 위 브이/엄지
    E.fxV.setAttribute('transform', `translate(${R.hx} ${R.hy})`); E.fxV.setAttribute('opacity', p.v * (1 - hr));
    E.fxT.setAttribute('transform', `translate(${R.hx} ${R.hy})`); E.fxT.setAttribute('opacity', p.thumb * (1 - hr));
    // 하트, 고개 기울임, 표정
    const hs = p.heart; E.heart.setAttribute('opacity', hs); E.heart.setAttribute('transform', `translate(0 ${-398 + Math.sin(t * 5) * 3}) scale(${.6 + .4 * hs})`);
    E.head.setAttribute('transform', `rotate(${kf(t, TILT)} 0 -258)`);
    E.mouth.setAttribute('d', `M-11 -276 Q0 ${-276 + 6 + 14 * p.smile} 11 -276`);
    return ph;
  }
  function updatePhone(t, ph) {
    const wm = kf(t, PH_WM), a = ph.a, k = clamp(wm * 1.6);
    E.phone.setAttribute('opacity', a * (1 - k));
    E.phone.setAttribute('transform', `translate(${ph.x.toFixed(2)} ${ph.y.toFixed(2)}) rotate(${ph.rot.toFixed(2)}) scale(${lerp(1, 77 / 58, wm).toFixed(3)})`);
    E.phoneL.setAttribute('opacity', a * k);
  }

  /* ===== 장면별 효과 ===== */
  function updateScan(t) {
    const s = win(t, 9.7, 11.1, .25), u = clamp((t - 9.8) / 1.5);
    E.brk.setAttribute('opacity', win(t, 9.6, 11.4, .25));
    E.beam.setAttribute('opacity', s);
    E.beam.setAttribute('y', QR.y + QR.h * (.5 - .5 * Math.cos(u * Math.PI * 3)) - 3);
    const c = win(t, 11.3, 12.3, .25), sc = easeOutBack((t - 11.3) / .35);
    E.check.setAttribute('opacity', c);
    E.check.setAttribute('transform', `translate(790 428) scale(${(sc * (.9 + .1 * c)).toFixed(3)})`);
  }
  function updateShots(t) {
    const w = sceneW(4, t), k = clamp(Math.floor(t - SHOT_T0), 0, SHOTS - 1), u = t - SHOT_T0 - k;
    let digit = '', pop = 1;
    if (t >= SHOT_T0 && t < SHOT_T0 + SHOTS) {
      if (u < .3) { digit = '3'; pop = u / .3; } else if (u < .58) { digit = '2'; pop = (u - .3) / .28; } else if (u < .86) { digit = '1'; pop = (u - .58) / .28; }
    }
    if (digit) { if (E.countN.textContent !== digit) E.countN.textContent = digit; }
    E.count.style.opacity = digit ? w : 0;
    E.count.style.transform = `scale(${1 + .35 * (1 - ease(pop / .6))})`;
    const cn = (k + 1) + '/' + SHOTS; if (E.cornerN.textContent !== cn) E.cornerN.textContent = cn;
    E.corner.style.opacity = w;
    // 플래시: 샷마다 한 번(총 6번), 짧게 하얗게
    let f = 0;
    for (let i = 0; i < SHOTS; i++) { const d = t - (SHOT_T0 + i + .88); if (d > -.05 && d < .32) f = Math.max(f, d < 0 ? 1 + d / .05 : 1 - ease(d / .32)); }
    E.flash.style.opacity = (.92 * f).toFixed(3);
    E.phGlow.setAttribute('opacity', (.85 * f).toFixed(3)); E.phHalo.setAttribute('opacity', (.9 * f).toFixed(3));   // 선반 위 휴대폰 화면에서 번쩍
  }
  function updateInset(t) {
    const start = win(t, 9.8, 11.9, .4), edit = win(t, 22.3, 29.8, .5);
    E.bp.style.opacity = Math.max(start, edit).toFixed(3);
    E.bp.style.transform = `scale(${t < 17 ? .68 : 1})`;
    E.scrStart.style.opacity = t < 17 ? 1 : 0;
    E.sBtn.style.transform = `scale(${kf(t, [[11.3, 1], [11.45, .92], [11.65, 1]])})`;
    E.sBtn.style.background = t > 11.4 && t < 17 ? '#e98a6b' : '#f6efe4'; E.sBtn.style.color = t > 11.4 && t < 17 ? '#fff' : '#1a1a1a';
    // 장면6: 사진 고르기 → 필터·스티커
    E.scrPick.style.opacity = t < 17 ? 0 : (1 - ease((t - 24.8) / .4));
    E.scrEdit.style.opacity = t < 17 || t < 24.6 ? 0 : 1;
    if (t >= 22 && t < 25.3) {
      for (let i = 0; i < 6; i++) {
        const c = E.cells6[i], a = ease((t - (22.5 + i * .08)) / .35);
        c.style.opacity = a; c.style.transform = `scale(${.92 + .08 * a})`;
        const pi = PICKS.indexOf(i), pt = pi >= 0 ? 23.1 + pi * .4 : 99, b = easeOutBack((t - pt) / .3);
        E.badges[i].style.transform = `scale(${b})`; if (pi >= 0) E.badges[i].textContent = pi + 1;
        E.sels[i].style.opacity = b > 0 ? 1 : 0;
        if (pi < 0) c.style.opacity = a * (1 - .5 * ease((t - 24.1) / .4));
      }
      const nb = E.nextB; const on = t > 24.3;
      nb.style.background = on ? '#e98a6b' : '#d9cdbb'; nb.style.color = on ? '#fff' : '#1a1a1a';
      nb.style.transform = `scale(${kf(t, [[24.45, 1], [24.6, .93], [24.8, 1]])})`;
    }
    if (t >= 24.4 && t < 30.3) {
      const a = kf(t, [[25.7, 0], [26.3, 1]]);
      E.grid4.style.filter = a > 0 ? FILTER_CSS(a) : 'none'; E.warm.style.opacity = a;
      for (let i = 0; i < 4; i++) {
        const c = E.chipEls[i], sel = i === 2 && t > 25.65;
        c.classList.toggle('on', sel);
        c.style.transform = i === 2 ? `scale(${kf(t, [[25.5, 1], [25.65, .92], [25.85, 1]])})` : '';
      }
      STICKERS.forEach((s, i) => {
        const sc = easeOutBack((t - s.t) / .4);
        stkEls[i].style.transform = `rotate(${s.r}deg) scale(${sc})`;
        const tr = E.trayEls[i]; tr.style.background = t > s.t - .25 && t < s.t + .2 ? '#f2d9c4' : '#fff';
        tr.style.transform = `scale(${1 - .08 * win(t, s.t - .3, s.t - .1, .1)})`;
      });
    }
  }
  function updateStrip(t) {
    const a = ease((t - 28.1) / .35), sc = lerp(.42, 1, easeOutBack((t - 28.1) / 1.1));
    E.strip.style.opacity = a * (1 - ease((t - 31.6) / .4));
    E.strip.style.transform = `translateY(${(1 - clamp((t - 28.1) / 1.1)) * 14}px) scale(${sc.toFixed(3)})`;
    const f = FILTER_CSS(1); E.stripPhotos.forEach(p => { p.style.filter = f; });
    const sv = win(t, 29.5, 31.6, .4); E.save.style.opacity = sv;
    E.save.style.transform = `scale(${kf(t, [[30.3, 1], [30.45, .92], [30.65, 1]])})`;
    const done = t > 30.7; if (E.save.classList.contains('done') !== done) { E.save.classList.toggle('done', done); E.saveT.innerHTML = done ? '✓ 저장됨 <small>Saved</small>' : '사진 저장 <small>Save photo</small>'; }
  }
  function updateCard(t) {
    const a = win(t, 31.8, 99, .4);
    E.card.style.opacity = a;
    const items = [['.c-logo', 32.2], ['.c-ko', 32.6], ['.c-en', 32.95], ['.c-loc', 33.4], ['.c-handle', 33.8]];
    if (!E.cardItems) E.cardItems = items.map(([s, ts]) => [E.card.querySelector(s), ts]);
    E.cardItems.forEach(([el, ts]) => { const u = ease((t - ts) / .55); el.style.opacity = u; el.style.transform = `translateY(${(1 - u) * 22}px)`; });
    if (!E.cardSt) E.cardSt = [].slice.call(E.card.querySelectorAll('.c-st'));
    E.cardSt.forEach((el, i) => { const u = easeOutBack((t - (33.2 + i * .25)) / .5); el.style.transform = `translateY(${Math.sin(t * 2 + i * 1.7) * 9}px) rotate(${Math.sin(t * 1.3 + i) * 6}deg) scale(${u})`; });
  }
  function updateCaptions(t) {
    let m = 0;
    for (let i = 0; i < E.capEls.length; i++) { const w = sceneW(i, t); m = Math.max(m, w); E.capEls[i].style.opacity = w; E.capEls[i].style.transform = `translateY(${(1 - w) * 12}px)`; }
    E.capband.style.opacity = m.toFixed(3);
  }

  /* ===== 한 프레임 그리기 ===== */
  function render(t) {
    updateBackground(t);
    const ps = kf(t, POSTER_SCALE); E.poster.style.transform = `scale(${ps.toFixed(3)})`;
    const ph = updatePerson(t); updatePhone(t, ph); updateScan(t); updateShots(t);
    E.dim.style.opacity = (.9 * win(t, 22.3, 31.4, .5)).toFixed(3);
    updateInset(t); updateStrip(t); updateCard(t); updateCaptions(t);
    E.fade.style.opacity = Math.max(1 - ease(t / 2.2), ease((t - 37.4) / .6)).toFixed(3);   // 처음 페이드인 / 끝 페이드아웃
    // 조작 막대
    const r = t / TOTAL; E.fill.style.width = (r * 100) + '%'; E.thumb.style.left = (r * 100) + '%';
    const tx = fmt(t) + ' / ' + fmt(TOTAL); if (tx !== E.timeTxt) { E.timeTxt = tx; E.time.textContent = tx; }
    E.bar.setAttribute('aria-valuenow', Math.round(t)); E.bar.setAttribute('aria-valuemax', TOTAL);
  }
  const fmt = s => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ===== 재생 제어 (rAF 가 t 를 올림) ===== */
  let t = 0, playing = false, last = 0, dirty = true, started = false, resumeOnShow = false;
  function setPlaying(p) {
    playing = p; last = performance.now();
    E.icoPlay.style.display = p ? 'none' : ''; E.icoPause.style.display = p ? '' : 'none';
    E.bPlay.setAttribute('aria-label', p ? '일시정지' : '재생');
    E.bigplay.hidden = p || !E.needsBig; if (p) E.needsBig = false;
  }
  function seek(v) { t = clamp(v, 0, TOTAL - .001); dirty = true; }
  function tick(ts) {
    if (playing) { t += Math.min((ts - last) / 1000, .1); last = ts; if (t >= TOTAL) t -= TOTAL; render(t); }   // 끝나면 자동으로 처음부터 반복
    else if (dirty) { render(t); dirty = false; }
    requestAnimationFrame(tick);
  }

  /* ===== 화면 맞춤: 무대를 폭/높이에 맞게 scale ===== */
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight, narrow = vw < 720;
    const ctrl = narrow ? 0 : 56;
    const s = Math.min(vw / 1600, (vh - ctrl) / 900);
    E.player.classList.toggle('overlay', narrow);
    E.player.style.width = (1600 * s) + 'px'; E.box.style.width = (1600 * s) + 'px'; E.box.style.height = (900 * s) + 'px';
    E.stage.style.transform = `scale(${s})`;
  }

  /* ===== 시작 ===== */
  function preload() {
    const imgs = Promise.all(IMAGES.map(src => new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = src; })));
    const fonts = Promise.race([
      Promise.all([document.fonts.load('700 20px NanumHuman', '가나다'), document.fonts.load('800 20px NanumHuman', '가나다'), document.fonts.load('20px Jua', '가나다'), document.fonts.load('500 20px Fredoka', 'Abc123'), document.fonts.load('600 20px Fredoka', 'Abc123')]).catch(() => 0),
      new Promise(res => setTimeout(res, 5000))
    ]);
    return Promise.all([imgs, fonts]);
  }
  function init() {
    buildDefs(); buildFakeQR(); buildBackground(); buildScreens(); fit();
    window.addEventListener('resize', fit); window.addEventListener('orientationchange', fit);
    render(0); requestAnimationFrame(tick);
    E.bPlay.onclick = () => setPlaying(!playing);
    E.bigplay.onclick = () => setPlaying(true);
    E.bRestart.onclick = () => { seek(0); setPlaying(true); };
    // 진행 막대: 클릭·드래그로 시간 이동
    let drag = false, was = false;
    const posToT = e => { const r = E.bar.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width) * TOTAL; };
    E.bar.addEventListener('pointerdown', e => { drag = true; was = playing; setPlaying(false); E.bar.setPointerCapture(e.pointerId); seek(posToT(e)); });
    E.bar.addEventListener('pointermove', e => { if (drag) seek(posToT(e)); });
    const up = () => { if (!drag) return; drag = false; if (was) setPlaying(true); };
    E.bar.addEventListener('pointerup', up); E.bar.addEventListener('pointercancel', up);
    E.bar.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { seek(t + 2); e.preventDefault(); } else if (e.key === 'ArrowLeft') { seek(t - 2); e.preventDefault(); } });
    document.addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { setPlaying(!playing); e.preventDefault(); } });
    // 탭을 숨기면 멈추고, 돌아오면 이어서
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { resumeOnShow = playing; if (playing) setPlaying(false); }
      else if (resumeOnShow) { resumeOnShow = false; setPlaying(true); }
    });
    E.loading.hidden = true;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { seek(3.5); E.needsBig = true; setPlaying(false); }    // 움직임 줄이기: 자동 재생 대신 '재생' 버튼 대기
    else setPlaying(true);
    // 확인용: ?t=초 → 그 장면에서 멈춤
    const qt = parseFloat(new URLSearchParams(location.search).get('t'));
    if (!isNaN(qt)) { seek(qt); setPlaying(false); render(t); }
  }
  function boot() {
    ['stage', 'box', 'player'].forEach(() => 0);
    // 로딩 문구는 초기 HTML 에 이미 있음
    preload().then(init);
  }
  // 요소 참조는 DOM 준비 후 위에서 이미 수집됨(defer 스크립트)
  boot();
})();
