// frame your memory 앱 - 1단계 시작 화면 + 2단계 카메라 준비 화면

// 임시 명소 표 (7단계에서 Supabase 조회로 교체 예정)
const SPOTS = { ingu: '인구해변' };

// 화면 전환: id 화면만 .is-active, 나머지는 숨김. 'screenchange' 이벤트로 알림(윤슬 등이 구독)
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.toggle('is-active', el.id === id));
  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent('screenchange', { detail: { id } }));
}
function currentScreen() {
  const el = document.querySelector('.screen.is-active');
  return el ? el.id : '';
}

// URL ?spot= 값 (소문자, 영숫자·하이픈 2~32자만 허용, 아니면 null)
// 명소 추가는 Supabase spots 표에 한 줄만 넣으면 됨. SPOTS 는 오프라인 대비용
const SPOT_CODE = (() => {
  const v = (new URLSearchParams(location.search).get('spot') || '').toLowerCase();
  return /^[a-z0-9-]{2,32}$/.test(v) ? v : null;
})();
// 이태원 할로윈 시작 화면(?spot=itaewon): 바다 사진·반짝임 대신 포스터 모양 (index.html 머리의 표시와 같은 조건)
const IS_ITAEWON = SPOT_CODE === 'itaewon';
// 명소 이름: 처음엔 임시 표 값, Supabase 응답이 오면 갱신. 시작 화면에는 쓰지 않음 (6단계 네 컷 하단에 사용)
let SPOT_NAME = SPOT_CODE && Object.prototype.hasOwnProperty.call(SPOTS, SPOT_CODE) ? SPOTS[SPOT_CODE] : null;
// true = 서버에 있는 코드, false = 서버에 없는 코드, null = 모름(아직 조회 전 또는 네트워크 실패)
let SPOT_VALID = null;
if (SPOT_CODE) {
  fetchSpot(SPOT_CODE).then(spot => {
    if (spot) { SPOT_VALID = true; SPOT_NAME = spot.name; }
    else { SPOT_VALID = false; SPOT_NAME = null; }
    previewDrawn = { base: null, tone: undefined };   // 이름이 바뀌었을 수 있으니 미리보기를 다시 그리게
  }).catch(() => { /* 네트워크 실패: SPOT_VALID = null, 임시 표 이름 유지 */ });
}

// 촬영 기록: 새 촬영 세트마다 1번만. 테스트 모드(?fakecam=1)는 실제 숫자가 늘지 않게 기록 안 함 (?record=1 이면 기록)
let shotRecorded = false;
window.__sbDebug = {
  get spotCode() { return SPOT_CODE; },
  get spotName() { return SPOT_NAME; },
  get spotValid() { return SPOT_VALID; },
  get shotRecorded() { return shotRecorded; },
  lastRecord: null,
};

// 이용 흐름 기록: 명소 없음/없는 명소면 건너뜀, 테스트 모드(?fakecam=1)는 ?record=1 일 때만
let setNo = 0;            // 촬영 세트 번호 (촬영 시작할 때마다 +1)
let setTracked = false;   // 이번 세트의 사진 완성·필터 기록을 했는지
function track(type, ref = '') {
  try {
    const qs = new URLSearchParams(location.search);
    if (!SPOT_CODE || SPOT_VALID === false) return;
    if (qs.get('fakecam') === '1' && qs.get('record') !== '1') return;
    trackEvent(SPOT_CODE, type, ref);
  } catch (e) { /* 기록 실패는 무시 */ }
}
track('visit');

(function initStart() {
  document.getElementById('start-btn').addEventListener('click', () => startCamera());
})();

// 시작 버튼 위치: 사진 속 서퍼 실루엣 아래 끝(사진 높이의 58.5%) + 18px. 사진 크기 상수만 써서 로드 전/reduced-motion 에도 동작
// CSS cover + background-position(center, 40%) 와 같은 변환. 결과는 .start 의 --btn-top 으로 전달
const BG_W = 1126, BG_H = 2000, BG_POS_Y = 0.4, SURFER_BOTTOM = 0.585;
function placeStartButton() {
  if (IS_ITAEWON) return;   // 이태원: 버튼은 CSS 흐름 배치 (로고 아래)
  const start = document.getElementById('screen-start'), btn = document.getElementById('start-btn');
  if (!start || !btn) return;
  const W = window.innerWidth, H = window.innerHeight;
  const s = Math.max(W / BG_W, H / BG_H);
  const oy = (H - BG_H * s) * BG_POS_Y;
  let top = SURFER_BOTTOM * BG_H * s + oy + 18;
  const btnH = btn.offsetHeight || 56;
  const safeB = parseFloat(getComputedStyle(start).paddingBottom) || 0;   // = safe-area-inset-bottom
  const maxTop = H - safeB - 24 - btnH;
  const logo = start.querySelector('.logo-wrap');
  const logoBottom = logo ? logo.getBoundingClientRect().bottom : 0;
  top = Math.max(Math.min(top, maxTop), logoBottom + 16);
  top = Math.round(top);
  start.style.setProperty('--btn-top', top + 'px');
  // 렌즈: 버튼 속 사진을 뒤 배경(cover, 위치 40%)과 같은 화면 좌표에 맞춤. 눌림 scale 영향 없게 계산값 사용
  const lens = btn.querySelector('.lens');
  if (lens) {
    const left = (W - btn.offsetWidth) / 2, ox = (W - BG_W * s) / 2;
    lens.style.backgroundSize = `${BG_W * s}px ${BG_H * s}px`;
    lens.style.backgroundPosition = `${ox - left}px ${oy - top}px`;
  }
}

// 시작 화면 배경: 사진(CSS 배경) 위에 윤슬 반짝임만 얹는다
// 밝기 지도(오프스크린 160px) -> 밝은 곳에 확률 높게 점 배치 -> 제자리에서 빠르게 켜졌다 꺼짐 ('lighter' 합성)
// 이태원 제목: 'TRY FREE' 는 입 너비의 84%, 'PHOTOBOOTH' 는 67% 가 되게 글자 크기를 맞춤 (포스터 fitVampireTitle 과 같은 생각)
function fitVampTitle() {
  const box = document.getElementById('vamp');
  if (!box) return;
  const w = box.clientWidth;
  [['vamp-t1', 0.84], ['vamp-t2', 0.67]].forEach(([id, ratio]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.fontSize = '100px';                         // 100px 에서 잰 너비로 비례 계산
    const natural = el.getBoundingClientRect().width;
    if (natural > 0) el.style.fontSize = (100 * w * ratio / natural).toFixed(1) + 'px';
  });
}
if (IS_ITAEWON) {
  fitVampTitle();
  window.addEventListener('resize', fitVampTitle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitVampTitle);
  if (document.fonts && document.fonts.load) document.fonts.load('100px Eater', 'TRY FREE').then(fitVampTitle).catch(() => {});
}

(function sea() {
  if (IS_ITAEWON) return;   // 이태원: 바다 사진 내려받기·반짝임 없음
  const PHOTO = 'assets/bg-sea.jpg', POS_Y = 0.4;       // CSS background-position: center 40% 와 동일
  const MAP_W = 160;
  const canvas = document.getElementById('sea');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, sparks = [], raf = 0, last = 0;
  let zones = [];
  let lum = null, mapH = 0, imgW = 0, imgH = 0;          // 밝기 지도 (밝기^3, 0~1)
  let cdf = null, cellScreen = null;                     // 화면 기준 누적 가중치 / 셀 화면 좌표
  let dotCv = null, rayCv = null;                        // 스프라이트

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // 로고/시작 버튼 영역(12% 넓힘): 안쪽 반짝임은 dim 0.15
  function updateZones() {
    zones = [];
    for (const el of [document.querySelector('.logo'), document.getElementById('start-btn')]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const px = r.width * 0.06, py = r.height * 0.06;
      zones.push({ l: r.left - px, r: r.right + px, t: r.top - py, b: r.bottom + py });
    }
  }
  function inZone(x, y) {
    for (const z of zones) if (x >= z.l && x <= z.r && y >= z.t && y <= z.b) return true;
    return false;
  }

  // 스프라이트: 점(가운데 #fffbe8 -> 금색 #ffd08a -> 투명) / 빛살(가운데 밝고 양끝 투명)
  function buildSprites() {
    dotCv = makeCanvas(64, 64);
    const d = dotCv.getContext('2d');
    const g = d.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,251,232,1)');
    g.addColorStop(0.3, 'rgba(255,251,232,0.85)');
    g.addColorStop(0.6, 'rgba(255,208,138,0.4)');
    g.addColorStop(1, 'rgba(255,208,138,0)');
    d.fillStyle = g; d.fillRect(0, 0, 64, 64);
    rayCv = makeCanvas(64, 2);
    const r = rayCv.getContext('2d');
    const rg = r.createLinearGradient(0, 0, 64, 0);
    rg.addColorStop(0, 'rgba(255,251,232,0)');
    rg.addColorStop(0.5, 'rgba(255,251,232,1)');
    rg.addColorStop(1, 'rgba(255,251,232,0)');
    r.fillStyle = rg; r.fillRect(0, 0, 64, 2);
  }

  // 사진을 가로 160px 로 줄려 밝기 지도(밝기^3) 생성
  function buildLumMap(img) {
    imgW = img.naturalWidth; imgH = img.naturalHeight;
    mapH = Math.max(1, Math.round(MAP_W * imgH / imgW));
    const c = makeCanvas(MAP_W, mapH);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, MAP_W, mapH);
    const px = x.getImageData(0, 0, MAP_W, mapH).data;
    lum = new Float32Array(MAP_W * mapH);
    for (let i = 0; i < lum.length; i++) {
      const l = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
      lum[i] = l * l * l;
    }
  }

  // CSS cover + background-position(center, 40%) 와 같은 사진->화면 변환. 리사이즈마다 갱신
  function photoToScreen() {
    const scale = Math.max(W / imgW, H / imgH);
    return { s: scale, ox: (W - imgW * scale) * 0.5, oy: (H - imgH * scale) * POS_Y };
  }
  // 화면에 보이는 셀만 가중치(밝기^3)를 주어 누적합(cdf) 생성
  function buildCdf() {
    if (!lum) return;
    const { s, ox, oy } = photoToScreen();
    const n = lum.length;
    cdf = new Float32Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const cx = (i % MAP_W + 0.5) / MAP_W * imgW * s + ox;
      const cy = (Math.floor(i / MAP_W) + 0.5) / mapH * imgH * s + oy;
      if (cx >= 0 && cx <= W && cy >= 0 && cy <= H) sum += lum[i];
      cdf[i] = sum;
    }
    cdf.total = sum;
  }
  // 누적합으로 셀을 뽑고 셀 안에서 무작위 위치 -> 화면 좌표
  function samplePoint() {
    if (!cdf || !cdf.total) return null;
    const t = Math.random() * cdf.total;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < t) lo = m + 1; else hi = m; }
    const { s, ox, oy } = photoToScreen();
    const u = ((lo % MAP_W) + Math.random()) / MAP_W, v = (Math.floor(lo / MAP_W) + Math.random()) / mapH;
    const x = u * imgW * s + ox, y = v * imgH * s + oy;
    return (x < 0 || x > W || y < 0 || y > H) ? null : { x, y };
  }

  // 새 반짝임: 제자리. 반지름 위(먼 물) 0.6~1.5px, 아래 1.5~3.5px. 수명 0.15~0.6초
  function newSpark(spawnAged) {
    let p = null;
    for (let i = 0; i < 6 && !p; i++) p = samplePoint();
    if (!p) return { x: 0, y: 0, life: 1, age: -1, r: 1, a: 0, ray: 0, dim: 1 };
    const f = p.y / H;
    const life = rnd(0.15, 0.6);
    return {
      x: p.x, y: p.y, life,
      age: spawnAged ? rnd(0, life) : -rnd(0, 0.25),
      r: rnd(0.6, 1.5) * (1 - f) + rnd(1.5, 3.5) * f,   // 위(먼 물) 0.6~1.5px -> 아래 1.5~3.5px
      a: rnd(0.6, 1),
      ray: Math.random() < 0.08 ? rnd(3, 4) : 0,         // 약 8%만 빛살 (반지름의 3~4배)
      dim: inZone(p.x, p.y) ? 0.15 : 1
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    placeStartButton();
    updateZones();
    rebuild();
  }
  // 점들 재배치: 동시에 보이는 수 = W*H/1400 (상한 320)
  function rebuild() {
    if (reduce || !lum) { sparks = []; return; }
    buildCdf();
    const n = Math.min(320, Math.round(W * H / 1400));
    sparks = Array.from({ length: n }, () => newSpark(true));
  }

  // 빠른 상승(수명의 18%) 후 느린 감쇠 (제곱)
  function envelope(p) {
    return p < 0.18 ? p / 0.18 : Math.pow(1 - (p - 0.18) / 0.82, 2);
  }
  // 가로로 납작(가로:세로 1.6:1)한 빛 점 (+ 일부 가는 가로·세로 빛살)
  function glint(s, e) {
    const a = e * s.a * s.dim;
    if (a <= 0.01) return;
    const rx = s.r * (0.7 + 0.3 * e), ry = rx / 1.6;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(dotCv, s.x - rx, s.y - ry, rx * 2, ry * 2);
    if (s.ray) {
      const L = s.r * s.ray;                              // 한쪽 팔 길이
      ctx.globalAlpha = Math.min(0.35, a * 0.35);
      ctx.drawImage(rayCv, s.x - L, s.y - 0.5, L * 2, 1);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.PI / 2);
      ctx.drawImage(rayCv, -L, -0.5, L * 2, 1);          // 세로 빛살: 90도 회전
      ctx.restore();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of sparks) {
      if (s.age < 0 || s.age > s.life) continue;
      glint(s, envelope(s.age / s.life));
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      s.age += dt;
      if (s.age > s.life) sparks[i] = newSpark(false);
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && !reduce && lum) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  // 로고 이미지/폰트 로드 후 영역 재계산 + 각 점 dim 갱신
  function refreshZones() {
    placeStartButton();
    updateZones();
    for (const s of sparks) s.dim = inZone(s.x, s.y) ? 0.15 : 1;
  }
  const logoEl = document.querySelector('.logo');
  if (logoEl) {
    if (logoEl.complete) refreshZones();
    else logoEl.addEventListener('load', refreshZones);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshZones);

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden || currentScreen() !== 'screen-start') ? stop() : start());
  // 시작 화면일 때만 반짝임을 돌린다 (돌아오면 영역을 다시 잰다)
  document.addEventListener('screenchange', e => {
    if (e.detail.id === 'screen-start') { refreshZones(); start(); } else stop();
  });

  buildSprites();
  resize();
  if (!reduce) {                                         // reduced-motion 이면 사진만, 지도도 만들지 않음
    const img = new Image();
    img.onload = () => {
      buildLumMap(img);
      rebuild();
      if (currentScreen() === 'screen-start' && !document.hidden) start();
    };
    img.src = PHOTO;
  }
})();

// ---- 2단계: 카메라 준비 화면 ----
const camVideo = document.getElementById('cam-video');
const camView = document.getElementById('cam-view');
const camError = document.getElementById('cam-error');
let camStream = null;   // 현재 카메라 스트림
let wakeLock = null;    // 화면 꺼짐 방지 핸들
let camToken = 0;       // 오래된 비동기 응답 무시용

// 테스트용: URL에 ?fakecam=1 이면 getUserMedia 대신 canvas 가짜 영상을 쓴다 (그 외 동작은 실제와 동일)
const FAKE_CAM = new URLSearchParams(location.search).get('fakecam') === '1';
function makeFakeStream() {
  const cv = document.createElement('canvas');
  cv.width = 1280; cv.height = 720;
  const c = cv.getContext('2d');
  const stream = cv.captureStream(30);
  const track = stream.getVideoTracks()[0];
  const timer = setInterval(() => {
    if (track.readyState === 'ended') { clearInterval(timer); return; }
    const t = performance.now() / 1000;
    c.fillStyle = '#1f6f8b'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(640 + Math.cos(t * 1.5) * 400, 360 + Math.sin(t * 2) * 200, 60, 0, 6.2832); c.fill();
    c.font = 'bold 160px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('TEST', 640, 360);
  }, 33);
  return stream;
}

// 앱 안 브라우저(카톡, 인스타 등) 감지
function isInApp() {
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps/i.test(navigator.userAgent);
}

// 화면 꺼짐 방지 (미지원/실패는 조용히 무시)
async function requestWakeLock() {
  try {
    if (wakeLock) return;
    wakeLock = await navigator.wakeLock?.request('screen') || null;
    if (wakeLock) wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { wakeLock = null; }
}
function releaseWakeLock() {
  try { wakeLock?.release(); } catch (e) { /* 무시 */ }
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentScreen() === 'screen-camera' && camStream) requestWakeLock();
});

// 카메라 끄기
function stopCamera() {
  camToken++;
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  camStream = null;
  camVideo.srcObject = null;
  releaseWakeLock();
}

// 처음으로: 카메라·wake lock 정리 후 시작 화면
function goHome() {
  abortShoot();      // 촬영 중이면 타이머 취소, shots 비움
  stopCamera();
  showScreen('screen-start');
}

// 칸에 한국어(크게) + 영어(아래 작게, class="en") 채우기. en 이 없으면 한국어만
function setBilingual(el, ko, en) {
  el.textContent = ko || '';
  if (en) {
    const e = document.createElement('span');
    e.className = 'en'; e.lang = 'en'; e.textContent = en;
    el.appendChild(e);
  }
}

// 오류 안내 상자 표시. buttons: [{label, en, onClick, sub}], en: {title, msg, hint} 영어 줄(각각 선택)
function showCamError(title, msg, hint, buttons, en) {
  en = en || {};
  camView.hidden = true;
  camError.hidden = false;
  setBilingual(document.getElementById('err-title'), title, en.title);
  setBilingual(document.getElementById('err-msg'), msg, en.msg);
  const hintEl = document.getElementById('err-hint');
  setBilingual(hintEl, hint || '', hint ? en.hint : '');
  hintEl.hidden = !hint;
  const box = document.getElementById('err-btns');
  box.textContent = '';
  for (const b of [...buttons, { label: '처음으로', en: 'Home', onClick: goHome, sub: true }]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    setBilingual(btn, b.label, b.en);
    if (b.sub) btn.className = 'sub';
    btn.addEventListener('click', b.onClick);
    box.appendChild(btn);
  }
}

// 주소 복사 (실패하면 prompt로 주소 표시)
async function copyAddress() {
  try { await navigator.clipboard.writeText(location.href); alert('주소를 복사했어요'); }
  catch (e) { prompt('주소를 길게 눌러 복사해 주세요', location.href); }
}

// 카메라 시작 (skipInApp: '그래도 시도하기')
async function startCamera(skipInApp) {
  const token = ++camToken;
  abortShoot();      // 이전 촬영 흔적(shots, 타이머, 화면 상태) 정리
  showScreen('screen-camera');
  camView.hidden = true; camError.hidden = true;

  if (!skipInApp && isInApp()) {
    showCamError('앱 안에서는 카메라가 안 켜질 수 있어요',
      "카카오톡 같은 앱 안에서는 카메라가 안 켜질 수 있어요. 오른쪽 아래 ⋮ 또는 공유 버튼에서 'Safari로 열기'/'다른 브라우저로 열기'를 눌러 주세요",
      '', [{ label: '주소 복사', en: 'Copy link', onClick: copyAddress }, { label: '그래도 시도하기', en: 'Try anyway', onClick: () => startCamera(true), sub: true }],
      { title: 'The camera may not work inside this app', msg: 'Open this page in Safari or Chrome.' });
    return;
  }
  if (!FAKE_CAM && (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext)) {
    showCamError('카메라를 쓸 수 없어요', '이 주소에서는 카메라를 쓸 수 없어요(https 주소로 열어 주세요)', '', [],
      { msg: 'The camera needs a secure (https) address' });
    return;
  }
  try {
    const stream = FAKE_CAM ? makeFakeStream() : await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
    });
    if (token !== camToken) { stream.getTracks().forEach(t => t.stop()); return; } // 그 사이 처음으로 감
    camStream = stream;
    camVideo.srcObject = stream;
    camView.hidden = false;
    camVideo.play().catch(() => {});
    requestWakeLock();
    track('camera_on');
  } catch (e) {
    if (token !== camToken) return;
    const retry = { label: '다시 시도', en: 'Retry', onClick: () => startCamera(true) };
    switch (e && e.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        showCamError('카메라를 허용해야 찍을 수 있어요', '카메라 사용을 허용해 주세요.',
          "아이폰: 주소창의 'aA' → 웹 사이트 설정 → 카메라 '허용' / 갤럭시·크롬: 주소창 왼쪽 아이콘 → 권한 → 카메라 허용",
          [retry], { title: 'Please allow camera access',
            hint: "iPhone: tap 'aA' in the address bar → Website Settings → Camera → Allow · Android Chrome: tap the icon left of the address → Permissions → Camera → Allow" });
        break;
      case 'NotFoundError':
      case 'OverconstrainedError':
        showCamError('카메라를 찾을 수 없어요', '카메라가 있는 기기인지 확인해 주세요.', '', [retry], { title: 'No camera found' });
        break;
      case 'NotReadableError':
        showCamError('카메라를 쓸 수 없어요', '다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 시도해 주세요', '', [retry],
          { msg: 'Another app is using the camera. Close it and try again.' });
        break;
      default:
        showCamError('카메라를 켜지 못했어요', '잠시 후 다시 시도해 주세요.', '', [retry],
          { msg: "Couldn't start the camera. Please try again." });
    }
  }
}

// 3단계 대비: 비디오 원본에서 화면 뷰파인더(4:3, object-fit: cover)와 똑같이 보이는 가운데 영역을 돌려준다
// 3단계 촬영 때 캔버스에 이 영역만 그리고, 거울 방향으로 뒤집어 저장
function getCropRect(video) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const target = 4 / 3;
  let sw = vw, sh = vh;
  if (vw / vh > target) sw = vh * target;       // 4:3보다 가로로 길면 좌우를 자름
  else sh = vw / target;                        // 4:3보다 세로로 길면 위아래를 자름
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
}

// ---- 3단계: 거치대용 자동 촬영 6장 ----
const SHOT_TOTAL = 6;
// 테스트용: ?fast=1 이면 첫 카운트다운 3초, 사진 간 1초 (평소 10초 / 5초)
const FAST = new URLSearchParams(location.search).get('fast') === '1';
const FIRST_SEC = FAST ? 3 : 10, SHOT_SEC = FAST ? 1 : 5;
const MAX_W = 1440;                       // 저장 사진 가로 최대
const shots = [];                         // 찍은 사진 {blob, url, width, height}
let shooting = false;                     // 촬영 진행 중 (중복 탭 무시용)
let shootRun = 0;                         // 촬영 회차: 취소되면 올라가서 오래된 비동기 흐름을 무시
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const countdownEl = document.getElementById('countdown');
const prepLabelEl = document.getElementById('prep-label');
const shotCountEl = document.getElementById('shot-count');
const thumbsEl = document.getElementById('shot-thumbs');
const camTopEl = document.getElementById('cam-top');
const camBottomEl = document.getElementById('cam-bottom');
const flashEl = document.getElementById('flash');
// 안내 문구 (준비 상태 / 촬영 중)
const TXT_READY = '준비되면 화면을 눌러 주세요', TXT_READY_EN = 'Tap the screen when ready';
const TXT_POSE = '뒤로 물러나 포즈를 잡아 주세요', TXT_POSE_EN = 'Step back and strike a pose';
const TXT_SHOOT = '사진을 촬영합니다', TXT_SHOOT_EN = 'Taking photos';
const ALERT_MS = FAST ? 1000 : 2000;      // 시작 알림 시간 (2초, 깜빡임 3번)
const goAlertEl = document.getElementById('go-alert');
const shotCountTxtEl = document.getElementById('shot-count-txt');

// 타이머는 여기 한 곳에서만 만들고 지운다 (취소 시 clearTimers 한 번으로 전부 정리)
const timers = new Set();
function later(fn, ms) {
  const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
  timers.add(t);
}
function clearTimers() {
  timers.forEach(clearTimeout);
  timers.clear();
}

// 소리: Web Audio. 아이폰은 사용자 탭 안에서 만들거나 resume 해야 소리가 나므로 탭 순간(unlockAudio)에 호출. 실패는 조용히 무시
let audioCtx = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  } catch (e) { audioCtx = null; }
}
// 짧은 사인파 '삑'
function beep(freq, dur) {
  try {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.01);
    g.gain.setValueAtTime(0.3, t + dur - 0.02);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  } catch (e) { /* 무시 */ }
}
// 찰칵: 짧은 화이트노이즈(0.05초) + 하이패스
function shutterClick() {
  try {
    if (!audioCtx) return;
    const t = audioCtx.currentTime, len = Math.floor(audioCtx.sampleRate * 0.05);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audioCtx.createBufferSource(), hp = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 1500; g.gain.value = 0.4;
    src.connect(hp).connect(g).connect(audioCtx.destination);
    src.start(t);
  } catch (e) { /* 무시 */ }
}

// 큰 숫자 표시 (글자 크기 = 뷰파인더 높이의 70%, 바뀔 때 살짝 커졌다 작아짐 / reduced-motion 이면 애니메이션 없음)
// prep=true: 준비 카운트다운 (30% 크기, 흐릿한 가는 글씨, 위쪽 안내 띠 #prep-label 표시)
function showCount(n, prep) {
  const vf = countdownEl.parentElement;
  countdownEl.style.fontSize = Math.round(vf.clientHeight * (prep ? 0.3 : 0.7)) + 'px';
  countdownEl.classList.toggle('is-prep', !!prep);
  if (prepLabelEl) {
    if (prep) {
      prepLabelEl.querySelector('.ko').textContent = '포즈를 준비하세요!';
      prepLabelEl.querySelector('.en').textContent = 'Get ready to pose!';
    }
    prepLabelEl.hidden = !prep;
  }
  countdownEl.textContent = n;
  countdownEl.hidden = false;
  if (!reduceMotion && countdownEl.animate && prep) {
    countdownEl.animate([{ opacity: 0.64 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });   // 색 .55 기준 → .35→.55 로 나타남
  } else if (!reduceMotion && countdownEl.animate) {
    countdownEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'ease-out' });
  }
}
function hideCount() {
  countdownEl.hidden = true;
  countdownEl.classList.remove('is-prep');
  if (prepLabelEl) prepLabelEl.hidden = true;
}
function setShotCount(n) { shotCountTxtEl.textContent = '촬영 중 ' + n + ' / ' + SHOT_TOTAL; shotCountEl.hidden = false; placeShotCount(); }
// 진행 표시는 액자 바로 위에 겹쳐 놓아 (자리를 차지하지 않음) 액자가 움직이지 않게 한다
function placeShotCount() {
  const f = camView.querySelector('.frame');
  shotCountEl.style.top = (f.getBoundingClientRect().top - camView.getBoundingClientRect().top - 44) + 'px';
}
// 시작 알림: 짧은 두 음 차임 (카운트다운 삑과 다른 소리)
function chime() { beep(660, 0.14); later(() => beep(990, 0.22), 140); }
function hideGoAlert() { goAlertEl.hidden = true; }
function showGoAlert() { goAlertEl.hidden = false; chime(); }

// 흰색 플래시: 투명 -> 0.9 -> 투명 (약 250ms)
function flash() {
  if (flashEl.animate) flashEl.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0 }], { duration: 250, easing: 'ease-out' });
}

// 미리보기 6칸 만들기 / 찍힌 칸 채우기
function buildThumbs() {
  thumbsEl.textContent = '';
  for (let i = 0; i < SHOT_TOTAL; i++) {
    const c = document.createElement('div');
    c.className = 'th';
    thumbsEl.appendChild(c);
  }
}
function fillThumb(i, url) {
  const c = thumbsEl.children[i];
  if (!c) return;
  const img = document.createElement('img');
  img.src = url; img.alt = '';
  c.textContent = ''; c.appendChild(img); c.classList.add('on');
}

// 촬영 중 화면 상태 <-> 준비 상태 (카운트다운·진행 표시·썸네일 숨김, 로고·원래 안내 복원)
function setShootUI(on) {
  camView.classList.toggle('shooting', on);
  thumbsEl.hidden = !on;
  if (on) buildThumbs(); else { thumbsEl.textContent = ''; shotCountEl.hidden = true; hideCount(); hideGoAlert(); }
  const ko = camBottomEl.querySelector('.ko'), en = camBottomEl.querySelector('.en');
  ko.textContent = on ? TXT_POSE : TXT_READY;
  en.textContent = on ? TXT_POSE_EN : TXT_READY_EN;
}

// shots 비우고 미리보기 URL 해제
function clearShots() {
  for (const s of shots) URL.revokeObjectURL(s.url);
  shots.length = 0;
  shotRecorded = false;     // 새 촬영 세트: 다시 기록 가능
  clearToneCache();         // 5단계 미리보기·캐시도 함께 비움
}

// 촬영 취소/초기화: 모든 타이머 취소 + 진행 중 비동기 무효화 + shots 비움 + 준비 상태 복원
function abortShoot() {
  shootRun++;
  clearTimers();
  shooting = false;
  clearShots();
  setShootUI(false);
}

// n초 카운트다운: n..1 을 1초 간격으로 보여 주고 끝나면 done. 마지막 3초(3,2,1)에 '삑'
// opts.prep: 준비 카운트다운(안내 띠·작은 숫자), opts.silent: 삑 소리 없음
function countdown(n, id, done, opts) {
  const prep = !!(opts && opts.prep), silent = !!(opts && opts.silent);
  let left = n;
  const tick = () => {
    if (id !== shootRun) return;
    showCount(left, prep);
    if (!silent && left <= 3) beep(880, 0.08);
    later(() => {
      left--;
      if (left > 0) tick(); else done();
    }, 1000);
  };
  tick();
}

// 지금 영상에서 뷰파인더와 같은 영역(getCropRect)만, 화면처럼 거울 방향으로 JPEG 로 만든다
// 크기: crop 크기 그대로 (가로 1440 초과면 비율 유지 축소). 못 찍으면 null
function capturePhoto() {
  const v = camVideo;
  if (!v.videoWidth || !v.videoHeight) return Promise.resolve(null);
  const { sx, sy, sw, sh } = getCropRect(v);
  let w = Math.round(sw), h = Math.round(sh);
  if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.translate(w, 0); ctx.scale(-1, 1);                 // 좌우 반전 (거울)
  ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
  return new Promise(resolve => {
    cv.toBlob(b => resolve(b ? { blob: b, url: URL.createObjectURL(b), width: w, height: h } : null), 'image/jpeg', 0.92);
  });
}

// 사진 한 장: 5초 카운트다운 -> 삑/찰칵/플래시 -> 캡처 -> 저장. 6장이면 마무리, 아니면 다음 장
function runShot(id) {
  if (id !== shootRun) return;
  const ko = camBottomEl.querySelector('.ko'), en = camBottomEl.querySelector('.en');
  ko.textContent = TXT_SHOOT; en.textContent = TXT_SHOOT_EN;
  setShotCount(shots.length + 1);
  countdown(SHOT_SEC, id, async () => {
    if (id !== shootRun) return;
    hideCount();
    beep(1320, 0.12); shutterClick(); flash();
    const shot = await capturePhoto();
    if (id !== shootRun) { if (shot) URL.revokeObjectURL(shot.url); return; }   // 기다리는 사이 취소됨
    if (shot) { shots.push(shot); fillThumb(shots.length - 1, shot.url); }      // 못 찍었으면 같은 순번을 다시
    if (shots.length >= SHOT_TOTAL) later(() => finishShoot(id), 700);          // 마지막 썸네일을 잠깐 보여 줌
    else runShot(id);
  });
}

// 6장 완료: 카메라 끄고 확인 화면으로 (shots 는 유지)
function finishShoot(id) {
  if (id !== shootRun) return;
  clearTimers();
  shooting = false;
  setShootUI(false);
  stopCamera();
  track('shoot_done', setNo);
  selected.length = 0;      // 새 촬영이므로 고른 것 초기화
  renderSelect();
  showScreen('screen-select');
}

// 준비 완료(화면 어디든 터치) -> 촬영 시작. 촬영 중 탭은 무시
function onCameraReady() {
  if (shooting) return;
  unlockAudio();                     // 사용자 탭 안에서 오디오 허용
  shooting = true;
  shotRecorded = false;
  setNo++; setTracked = false;
  const id = ++shootRun;
  setShootUI(true);
  countdown(FIRST_SEC, id, () => {
    hideCount(); showGoAlert();
    later(() => { if (id !== shootRun) return; hideGoAlert(); runShot(id); }, ALERT_MS);
  }, { silent: true, prep: true });   // 처음 10초(뒤로 물러날 시간) 후 사진마다 5초
}

// 촬영 중 탭이 숨겨지면 멈추고 준비 상태로 되돌림 (카메라는 유지)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && shooting) abortShoot();
});

// ---- 4단계: 6장 중 4장 고르기 ----
const PICK_TOTAL = 4;
const selected = [];            // 고른 shots 인덱스 (고른 순서). 5·6단계에서 네 컷 순서로 사용
let hintTimer = 0;
const selGrid = document.getElementById('sel-grid');
const selNext = document.getElementById('sel-next');

// 고른 수·번호 배지·'다음' 버튼 상태를 selected 에 맞춰 갱신
function updateSelect() {
  setBilingual(document.getElementById('sel-count'), selected.length + ' / ' + PICK_TOTAL + ' 선택', '· selected');
  selGrid.classList.toggle('full', selected.length >= PICK_TOTAL);
  selGrid.querySelectorAll('.pick').forEach((btn, i) => {
    const order = selected.indexOf(i);
    const badge = btn.querySelector('.badge');
    btn.setAttribute('aria-pressed', order >= 0 ? 'true' : 'false');
    badge.hidden = order < 0;
    badge.textContent = order >= 0 ? order + 1 : '';
  });
  selNext.disabled = selected.length !== PICK_TOTAL;
}

// 4장 넘게 누르면 안내를 2초 보여 줌
function showPickHint() {
  const hint = document.getElementById('sel-hint');
  setBilingual(hint, '4장까지 고를 수 있어요', 'You can pick up to 4');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { hint.textContent = ''; }, 2000);
}

function onPick(i, btn) {
  const at = selected.indexOf(i);
  if (at >= 0) selected.splice(at, 1);                 // 빼면 뒤 번호가 당겨짐
  else if (selected.length < PICK_TOTAL) selected.push(i);
  else {                                               // 이미 4장: 고르지 않고 흔들기 + 안내
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      btn.classList.remove('shake');
      void btn.offsetWidth;                            // 애니메이션 다시 시작
      btn.classList.add('shake');
    }
    showPickHint();
    return;
  }
  updateSelect();
}

// 6칸 그리드를 새로 그림 (selected 는 호출 전에 비우거나 유지해서 넘김)
function renderSelect() {
  clearTimeout(hintTimer);
  document.getElementById('sel-hint').textContent = '';
  selGrid.textContent = '';
  shots.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pick'; btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', (i + 1) + '번 사진 photo ' + (i + 1));
    btn.addEventListener('animationend', () => btn.classList.remove('shake'));
    const img = document.createElement('img');
    img.src = s.url; img.alt = '';
    const badge = document.createElement('span');
    badge.className = 'badge'; badge.hidden = true; badge.setAttribute('aria-hidden', 'true');
    btn.append(img, badge);
    btn.addEventListener('click', () => onPick(i, btn));
    selGrid.appendChild(btn);
  });
  updateSelect();
}
document.getElementById('sel-retake').addEventListener('click', () => { selected.length = 0; clearShots(); startCamera(true); });
document.getElementById('sel-home').addEventListener('click', () => { selected.length = 0; goHome(); });

// ---- 5단계: 색감 고르기 ----
const TONES = ['softlight', 'grainy', 'rio', 'graphite'];
let tone = null;                       // 고른 색감 (6단계 최종 합성에서 사용)
const PREVIEW_W = 600, THUMB_W = 160;        // 네 컷 미리보기 / 버튼 썸네일 가로
let previewBase = [];                        // 고른 4장을 가로 600px 로 줄인 원본 canvas (고른 순서)
let previewCache = { softlight: [], grainy: [], rio: [], graphite: [] };   // previewCache[tone][i] = 색감 적용된 canvas (dataURL 아님)
let thumbCache = {};                         // thumbCache[tone] = 첫 번째 고른 사진의 160px 색감 canvas
let toneRun = 0;                             // 비동기 회차: 정리되면 올라가서 오래된 처리 결과를 무시
const toneList = document.getElementById('tone-list');
const toneBtns = [...document.querySelectorAll('#tone-list .tone')];
const filterMake = document.getElementById('filter-make');
const filterPhotos = document.getElementById('filter-photos');

// 사용자가 준 설정값, 숫자는 시작점이며 결과 느낌 우선 (라이트룸식 값. 없는 항목은 0)
const TONE_PRESETS = {
  // softlight·rio 는 측정 LUT 사용(js/luts.js)
  grainy: { exposure: 0.05, contrast: -5, highlights: -12, shadows: 8, whites: -3, blacks: 5, temp: 2, tint: 1, saturation: -5, vibrance: -3, clarity: -3, texture: -5, dehaze: 0, grain: { amount: 28, size: 22, rough: 45 }, fade: 3 },
  graphite: { exposure: 0.05, contrast: 18, highlights: -18, shadows: 5, whites: 8, blacks: -18, saturation: -100, clarity: 5, texture: 3, dehaze: 2, grain: { amount: 8, size: 15, rough: 30 },
    bw: { red: 8, orange: 12, yellow: -5, green: -15, aqua: -5, blue: -12, purple: -5, magenta: 3 } },
};
const HUE_BANDS = [['red', 0], ['orange', 30], ['yellow', 60], ['green', 120], ['aqua', 180], ['blue', 225], ['purple', 270], ['magenta', 315]];

const smooth = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
// 8개 색 대역 가중치 w=max(0,1-|Δhue|/45) (원형 거리). 겹치면 가중합
function bandSum(h, vals, key) {
  let s = 0;
  for (let k = 0; k < 8; k++) {
    const v = vals[HUE_BANDS[k][0]]; if (!v) continue;
    let dh = Math.abs(h - HUE_BANDS[k][1]); if (dh > 180) dh = 360 - dh;
    const w = 1 - dh / 45;
    if (w > 0) s += w * (key ? v[key] : v);
  }
  return s;
}
function hue2rgb(p, q, t) {
  if (t < 0) t += 1; else if (t > 1) t -= 1;
  return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
}
// 분리형 박스 블러 (가로·세로 각 1회, 반경 r, 가장자리는 끝값 반복). src -> out, tmp 는 같은 크기 작업 버퍼
function boxBlur(src, out, tmp, w, h, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w; let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + (k < 0 ? 0 : k >= w ? w - 1 : k)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n;
      const a = x + r + 1, b = x - r;
      acc += src[row + (a >= w ? w - 1 : a)] - src[row + (b < 0 ? 0 : b)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[(k < 0 ? 0 : k >= h ? h - 1 : k) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      const a = y + r + 1, b = y - r;
      acc += tmp[(a >= h ? h - 1 : a) * w + x] - tmp[(b < 0 ? 0 : b) * w + x];
    }
  }
}

// 측정 LUT (base64 -> Uint8Array, 처음 쓸 때 한 번만 풀어 캐시)
const lutCache = {};
function getLut(name) {
  if (!lutCache[name]) {
    const bin = atob(MEASURED_LUTS[name]);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    lutCache[name] = u;
  }
  return lutCache[name];
}
// 17×17×17 LUT 삼선형 보간. imageData 를 제자리에서 바꾸고 알파는 유지
function applyLut(imageData, lut) {
  const d = imageData.data, n = d.length, k = 16 / 255;
  for (let i = 0; i < n; i += 4) {
    const fr = d[i] * k, fg = d[i + 1] * k, fb = d[i + 2] * k;
    let r0 = fr | 0, g0 = fg | 0, b0 = fb | 0;
    if (r0 > 15) r0 = 15; if (g0 > 15) g0 = 15; if (b0 > 15) b0 = 15;
    const tr = fr - r0, tg = fg - g0, tb = fb - b0;
    const i000 = ((r0 * 17 + g0) * 17 + b0) * 3;
    const i001 = i000 + 3, i010 = i000 + 51, i011 = i010 + 3;
    const i100 = i000 + 867, i101 = i100 + 3, i110 = i100 + 51, i111 = i110 + 3;
    for (let c = 0; c < 3; c++) {
      const c00 = lut[i000 + c] + (lut[i001 + c] - lut[i000 + c]) * tb;
      const c01 = lut[i010 + c] + (lut[i011 + c] - lut[i010 + c]) * tb;
      const c10 = lut[i100 + c] + (lut[i101 + c] - lut[i100 + c]) * tb;
      const c11 = lut[i110 + c] + (lut[i111 + c] - lut[i110 + c]) * tb;
      const c0 = c00 + (c01 - c00) * tg, c1 = c10 + (c11 - c10) * tg;
      const v = Math.round(c0 + (c1 - c0) * tr);
      d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
}

// 디테일 부드럽게: RGB 각 채널을 가우시안 근사(분리형 박스 블러 3회)로 흐린 뒤 out = blur + keep*(orig - blur). 알파 유지
// 박스 폭 w=√(12σ²/3+1) (박스 3회 표준 공식), 반지름 r=(w-1)/2. 기존 boxBlur(1회분, 가장자리 반복)를 재사용
function softenDetail(imageData, sigma, keep) {
  const d = imageData.data, W = imageData.width, H = imageData.height, N = W * H;
  const w = Math.sqrt(12 * sigma * sigma / 3 + 1);
  const r = Math.max(1, Math.round((w - 1) / 2));
  const orig = new Float32Array(N), a = new Float32Array(N), b = new Float32Array(N), tmp = new Float32Array(N);
  for (let c = 0; c < 3; c++) {
    for (let i = 0, j = c; i < N; i++, j += 4) a[i] = orig[i] = d[j];
    boxBlur(a, b, tmp, W, H, r);
    boxBlur(b, a, tmp, W, H, r);
    boxBlur(a, b, tmp, W, H, r);          // 결과는 b
    for (let i = 0, j = c; i < N; i++, j += 4) {
      const v = Math.round(b[i] + keep * (orig[i] - b[i]));
      d[j] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
}

// 6단계 합성과 미리보기가 같은 함수 — 같은 색
// imageData.data(RGBA)를 제자리에서 바꾼다. ctx.filter 는 사파리 미지원이라 픽셀을 직접 계산 (값은 0~1 실수 sRGB)
function applyTone(imageData, tone) {
  if (tone === 'softlight') {
    applyLut(imageData, getLut(tone));
    // 윤슬(softlight)은 색 변환 + 세부를 약 30% 부드럽게(측정: 920px 폭에서 가우시안 σ≈5px, 30% 섞기). 사진 폭에 비례해 미리보기·저장본 느낌 동일
    softenDetail(imageData, imageData.width * 5 / 920, 0.7);
    return;
  }
  if (tone === 'rio') { applyLut(imageData, getLut(tone)); return; }
  const P = TONE_PRESETS[tone];
  if (!P) return;
  const d = imageData.data, W = imageData.width, H = imageData.height, N = W * H;
  const buf = new Float32Array(N * 3);
  const isBW = !!P.bw, hasHsl = !!P.hsl;
  const gain = Math.pow(2, P.exposure || 0);                              // a. 노출
  const cK = 1 + (P.contrast || 0) / 100 * 0.6;                           // b. 대비
  const sh = (P.shadows || 0) / 100, hi = (P.highlights || 0) / 100, wh = (P.whites || 0) / 100, bl = (P.blacks || 0) / 100;
  const tmpK = (P.temp || 0) / 100 * 0.12, tntK = (P.tint || 0) / 100 * 0.08;
  const satK = 1 + (P.saturation || 0) / 100, vibK = (P.vibrance || 0) / 100;
  for (let p = 0, i = 0, o = 0; p < N; p++, i += 4, o += 3) {
    let r = d[i] / 255 * gain, g = d[i + 1] / 255 * gain, b = d[i + 2] / 255 * gain;
    r = (r - 0.5) * cK + 0.5; g = (g - 0.5) * cK + 0.5; b = (b - 0.5) * cK + 0.5;
    // c. 밝은/어두운 영역 (루마 기준 smoothstep 가중치, 세 채널에 같은 dL -> 색 유지)
    let L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const dL = 0.25 * sh * (1 - smooth(0, 0.6, L)) + 0.25 * hi * smooth(0.4, 1, L)
             + 0.15 * wh * smooth(0.75, 1, L) + 0.15 * bl * (1 - smooth(0, 0.25, L));
    r += dL; g += dL; b += dL;
    // d. 화이트밸런스 (tint+ = 마젠타 쪽)
    r += tmpK; b -= tmpK; g -= tntK;
    if (!isBW) {
      // e. 채도/생동감: s = max-min, L 다시 계산
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let s = mx - mn; if (s > 1) s = 1; else if (s < 0) s = 0;
      L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const f = satK * (1 + vibK * (1 - s));
      r = L + (r - L) * f; g = L + (g - L) * f; b = L + (b - L) * f;
    }
    if (isBW || hasHsl) {
      // f. 색상별: HSL 로 바꿔 대역 가중합 적용 (rio: hue/sat/lum, graphite: 흑백 밝기)
      r = r < 0 ? 0 : r > 1 ? 1 : r; g = g < 0 ? 0 : g > 1 ? 1 : g; b = b < 0 ? 0 : b > 1 ? 1 : b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
      let h = 0, s = 0;
      if (dd > 1e-6) {
        s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
        h = mx === r ? ((g - b) / dd + (g < b ? 6 : 0)) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
        h *= 60;
      }
      if (isBW) {
        const gray = l + bandSum(h, P.bw) / 100 * 0.4 * s;
        r = g = b = gray;
      } else if (dd > 1e-6) {
        h += bandSum(h, P.hsl, 'hue') * 0.3;
        h = ((h % 360) + 360) % 360;
        s *= 1 + bandSum(h, P.hsl, 'sat') / 100; if (s > 1) s = 1; else if (s < 0) s = 0;
        let l2 = l + bandSum(h, P.hsl, 'lum') / 100 * 0.15 * s; l2 = l2 < 0 ? 0 : l2 > 1 ? 1 : l2;
        const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s, pp = 2 * l2 - q, hh = h / 360;
        r = hue2rgb(pp, q, hh + 1 / 3); g = hue2rgb(pp, q, hh); b = hue2rgb(pp, q, hh - 1 / 3);
      }
    }
    buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
  }

  // g. 선명도: 루마 버퍼 -> 박스 블러 -> detail = L - blurL, k*detail 을 세 채널에 더함 (dehaze 는 clarity 에 0.5배로 합산)
  const k = ((P.clarity || 0) + (P.texture || 0) + (P.dehaze || 0) * 0.5) / 100 * 1.0;
  if (k !== 0) {
    const lum = new Float32Array(N), blur = new Float32Array(N), tmp = new Float32Array(N);
    for (let p = 0, o = 0; p < N; p++, o += 3) lum[p] = 0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2];
    boxBlur(lum, blur, tmp, W, H, Math.max(1, Math.round(W / 300)));
    for (let p = 0, o = 0; p < N; p++, o += 3) {
      const t = k * (lum[p] - blur[p]);
      buf[o] += t; buf[o + 1] += t; buf[o + 2] += t;
    }
  }

  // h. 필름 입자: 흑백 입자(세 채널 같은 값). 칸 크기는 폭에 비례 -> 미리보기와 최종에서 같은 크기로 보임
  const G = P.grain;
  if (G && G.amount > 0) {
    const cell = Math.max(1, Math.round(W / 600 * (0.6 + G.size / 25)));
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
    const grid = new Float32Array(gw * gh);
    let seed = 1234567;
    const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const gauss = () => rnd() + rnd() + rnd() - 1.5;                       // 근사 가우시안
    for (let q = 0; q < grid.length; q++) grid[q] = gauss();
    // 세기 0.45: 근사 가우시안(표준편차 0.5)과 보간이 입자를 약하게 만들어 보정 — grainy(28) 중간톤 표준편차 약 11/255
    const rough = G.rough / 100, A = G.amount / 100 * 0.45;
    for (let y = 0; y < H; y++) {
      const fy = y / cell, iy = Math.floor(fy), ty = fy - iy, r0 = iy * gw, r1 = r0 + gw;
      for (let x = 0; x < W; x++) {
        const fx = x / cell, ix = Math.floor(fx), tx = fx - ix;
        const top = grid[r0 + ix] * (1 - tx) + grid[r0 + ix + 1] * tx;
        const bot = grid[r1 + ix] * (1 - tx) + grid[r1 + ix + 1] * tx;
        const n = (top * (1 - ty) + bot * ty) * (1 - rough) + gauss() * rough;   // n1 보간 격자 + n2 픽셀 단위
        const o = (y * W + x) * 3;
        const L = 0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2];
        const m = 1 - Math.abs(2 * L - 1) * 0.5;                            // 중간톤에서 가장 강하게
        const v = A * m * n;
        buf[o] += v; buf[o + 1] += v; buf[o + 2] += v;
      }
    }
  }

  // i. 페이드 (grainy) 후 0~1 clamp -> 0~255 반올림
  const fd = (P.fade || 0) / 100 * 0.5, fo = fd * 0.15;
  for (let p = 0, i = 0, o = 0; p < N; p++, i += 4, o += 3) {
    for (let c = 0; c < 3; c++) {
      let v = buf[o + c] * (1 - fd) + fo;
      d[i + c] = Math.round((v < 0 ? 0 : v > 1 ? 1 : v) * 255);
    }
  }
}

// 사진 blob 을 가로 w 로 줄인 canvas 로. 큰 이미지는 createImageBitmap, 실패(구형 브라우저)하면 Image 로 대체
async function shrinkBlob(blob, w) {
  let src = null, bitmap = null, url = '';
  try { bitmap = await createImageBitmap(blob); src = bitmap; }
  catch (e) {
    url = URL.createObjectURL(blob);
    src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; });
  }
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = Math.max(1, Math.round(w * sh / sw));
  cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
  if (bitmap && bitmap.close) bitmap.close();
  if (url) URL.revokeObjectURL(url);
  return cv;
}
// 색감 적용한 복사본 canvas (원본 base 는 그대로 둠)
function toneCopy(base, t) {
  const cv = document.createElement('canvas');
  cv.width = base.width; cv.height = base.height;
  const ctx = cv.getContext('2d', { willReadFrequently: !!t });
  ctx.drawImage(base, 0, 0);
  if (!t) return cv;                                      // 필터 없음: 원본 복사본
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  applyTone(img, t);
  ctx.putImageData(img, 0, 0);
  return cv;
}

// 메모리 정리: 미리보기·캐시 비움, 색감은 원본으로
function clearToneCache() {
  toneRun++;
  previewBase = [];
  previewCache = { softlight: [], grainy: [], rio: [], graphite: [] };
  thumbCache = {};
  tone = null;
  clearStickers();          // 사진 구성이 바뀔 수 있으므로 스티커도 비움
  filterPhotos.textContent = '';
  toneList.classList.remove('has-pick');
  toneBtns.forEach(b => { b.querySelector('.thumb').textContent = ''; b.setAttribute('aria-pressed', 'false'); });
}

function setToneBusy(busy) {
  toneBtns.forEach(b => { b.disabled = busy; });
  filterMake.disabled = busy;
}

// 색감 t 를 화면에 반영: 캐시에 없으면 한 번만 만들고, 있으면 canvas 만 바꿔 끼움 (즉시)
// t 가 null 이면 필터 없이 원본(previewBase 복사본)을 보여 줌 (계산 없음)
async function showTone(t) {
  const run = toneRun;
  if (t && previewCache[t].length !== previewBase.length) {
    setToneBusy(true);
    await new Promise(r => setTimeout(r, 0));             // 버튼 비활성이 먼저 그려지게 한 틱 양보
    if (run !== toneRun) return;
    previewCache[t] = previewBase.map(b => toneCopy(b, t));
    setToneBusy(false);
  }
  tone = t;
  toneBtns.forEach(b => b.setAttribute('aria-pressed', t && b.dataset.tone === t ? 'true' : 'false'));
  toneList.classList.toggle('has-pick', !!t);
  const list = t ? previewCache[t] : previewBase.map(b => toneCopy(b, null));
  filterPhotos.replaceChildren(...list.map((cv, i) => {
    const d = document.createElement('div'); d.className = 'ph';
    const n = document.createElement('span'); n.className = 'num'; n.textContent = i + 1;
    d.append(cv, n); return d;
  }));
}
toneBtns.forEach(b => b.addEventListener('click', () => { if (!b.disabled) showTone(b.dataset.tone === tone ? null : b.dataset.tone); }));

// 색감 화면 준비: 고른 4장 줄이기 + 버튼 썸네일 4개 + 기본 색감(윤슬) 그리기. 취소되면 false
async function prepareTone() {
  clearToneCache();
  const run = toneRun;
  const base = [];
  for (const i of selected) base.push(await shrinkBlob(shots[i].blob, PREVIEW_W));
  const thumbBase = await shrinkBlob(shots[selected[0]].blob, THUMB_W);
  if (run !== toneRun) return false;
  previewBase = base;
  for (const b of toneBtns) {
    const t = b.dataset.tone;
    thumbCache[t] = toneCopy(thumbBase, t);
    b.querySelector('.thumb').replaceChildren(thumbCache[t]);
  }
  await showTone(null);                                    // 처음엔 필터 없음(원본)
  return run === toneRun;
}

// 다음: 색감 화면을 준비(처리 중엔 버튼 비활성)한 뒤 이동
selNext.addEventListener('click', async () => {
  if (selected.length !== PICK_TOTAL) return;
  selNext.disabled = true;
  try { if (await prepareTone()) showScreen('screen-filter'); }
  catch (e) { /* 디코딩 실패: 화면은 그대로 둠 */ }
  selNext.disabled = selected.length !== PICK_TOTAL;
  setToneBusy(false);
});
// 다시 고르기: 선택을 유지한 채 고르기 화면으로 (미리보기는 다음 누를 때 다시 만듦)
document.getElementById('filter-back').addEventListener('click', () => showScreen('screen-select'));
// ---- 6단계: 네 컷 합치기 + 하단 로고·명소·날짜 + 사진 저장 ----
// 캔버스 1200x3600. 좌우·위 여백 70, 사진 칸 1060x795(4:3), 칸 사이 26 -> y = 70, 891, 1712, 2533 (마지막 끝 3328)
const STRIP_W = 1200, STRIP_H = 3600;
// 명소별 프레임 색(없으면 기본 크림 바탕 + 검정 글씨). 이태원(할로윈 에디션)은 검정 바탕 + 크림 글씨 + 흰 로고
const SPOT_STRIP = { itaewon: { bg: '#0a0a0a', ink: '#f6efe4', logo: 'assets/logo-white.png' } };
const STRIP_THEME = (SPOT_CODE && SPOT_STRIP[SPOT_CODE]) || { bg: '#f6efe4', ink: '#1a1a1a', logo: 'assets/logo-black.png' };
const STRIP_BG = STRIP_THEME.bg, STRIP_INK = STRIP_THEME.ink;
document.documentElement.style.setProperty('--strip-bg', STRIP_BG);   // 미리보기 틀·무대 바탕도 같은 색으로
const CELL_X = 70, CELL_W = 1060, CELL_H = 795, CELL_GAP = 26, CELL_TOP = 70;
// 하단 영역 y 3328~3600: 가운데 로고 + 바로 아래 계정 글씨, 왼쪽 명소 이름, 오른쪽 날짜 (drawStripFooter 가 완성·미리보기 공용)
// 사용자가 비교 페이지(docs/하단-배치비교.html)에서 고른 C1안: 로고 345, 계정 글씨는 로고 아래 간격 3에서 4px 위로
const LOGO_W = 345, FOOT_TOP = CELL_TOP + 4 * CELL_H + 3 * CELL_GAP;   // FOOT_TOP = 3328 (하단 칸 3328~3600)
const FOOT_GAP = 30, FOOT_FONT_MIN = 28;                                  // 로고와 양옆 글자 칸 사이 간격, 자동 축소 최소 크기
// 글꼴: 한글 Jua, 날짜·계정 Fredoka (둘 다 SIL OFL, 구글 폰트) — 사용자 선택 1번 조합
// 명소별 하단 글꼴(이름 두 줄: 한글 ko, 영어 en / 오른쪽 날짜 date). 없으면 Jua + Fredoka. 손글씨체는 같은 px 에서 작아 보여 크게
const SPOT_NAME_FONT = { itaewon: { ko: ['400', 88, 'GgeuTeuMeoRi'], en: ['400', 56, 'GgeuTeuMeoRi'], date: ['400', 66, 'GgeuTeuMeoRi', 4] } };   // 4번째 값 = 글자 테두리 두께(px): 굵기가 하나뿐인 손글씨체를 굵게
const FOOT_SPOT_FONT = ['400', 56, 'Jua'], FOOT_DATE_FONT = (SPOT_NAME_FONT[SPOT_CODE] || {}).date || ['600', 50, 'Fredoka'];
// 이름이 '한글 영어'면 왼쪽 칸에 두 줄. 두 줄 폭이 오른쪽 날짜 폭과 비슷하도록 한글 66·영어 40
const FOOT_SPOT_KO2_FONT = (SPOT_NAME_FONT[SPOT_CODE] || {}).ko || ['400', 66, 'Jua'];
const FOOT_SPOT_EN_FONT = (SPOT_NAME_FONT[SPOT_CODE] || {}).en || ['600', 40, 'Fredoka'], FOOT_SPOT_EN_GAP = 10;
const FOOT_HANDLE = '@sunframestudio', FOOT_HANDLE_FONT = ['500', 28, 'Fredoka'], FOOT_HANDLE_GAP = 3, FOOT_HANDLE_UP = 4;
let logoImgPromise = null;                    // 검정 로고는 한 번만 불러 재사용
function loadLogo() {
  if (!logoImgPromise) {
    logoImgPromise = new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = STRIP_THEME.logo; });
    logoImgPromise.catch(() => { logoImgPromise = null; });   // 실패하면 다음에 다시 시도
  }
  return logoImgPromise;
}
loadLogo().catch(() => {});                    // 미리 불러 두기

// 명소별 하단 왼쪽 로고(행사 CI 등): 있으면 명소 이름 글자 대신 이 그림을 그림. 없거나 불러오기 실패하면 이름 글자로
const SPOT_LOGOS = { gncoffee: 'assets/spots/gncoffee.png' };
const SPOT_FOOT_LOGO_W = { cafepokpo: 200 };    // 명소별 가운데 우리 로고 폭(없으면 LOGO_W), 계정 글씨는 24px
const FOOT_SPOT_LOGO_MAXH = 0.7;               // 하단 칸 높이 대비 최대 높이
let spotLogoPromise = null;
function loadSpotLogo() {
  const url = SPOT_CODE && SPOT_LOGOS[SPOT_CODE];
  if (!url) return Promise.resolve(null);
  if (!spotLogoPromise) {
    // 스티커와 같은 방식: onload 를 먼저 걸고 decode() 와 먼저 끝나는 쪽으로 진행, 10초 넘으면 실패
    spotLogoPromise = (async () => {
      const im = new Image();
      const loaded = new Promise((ok, no) => { im.onload = ok; im.onerror = () => no(new Error('spot logo load failed')); });
      im.src = url;
      const decoded = im.decode().catch(() => loaded);
      const timeout = new Promise((_, no) => setTimeout(() => no(new Error('spot logo load timeout')), 10000));
      await Promise.race([decoded, loaded, timeout]);
      if (!im.naturalWidth) throw new Error('spot logo not loaded');
      return im;
    })();
    spotLogoPromise.catch(() => { spotLogoPromise = null; });
  }
  return spotLogoPromise;
}
if (SPOT_CODE && SPOT_LOGOS[SPOT_CODE]) loadSpotLogo().catch(() => {});

const pad2 = n => String(n).padStart(2, '0');

// 사진 blob 을 열어 CanvasImageSource 로: createImageBitmap, 실패하면 Image 로 대체. close() 로 정리
async function openPhoto(blob) {
  try { const bm = await createImageBitmap(blob); return { src: bm, w: bm.width, h: bm.height, close: () => bm.close && bm.close() }; }
  catch (e) {
    const url = URL.createObjectURL(blob);
    try {
      const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      return { src: im, w: im.naturalWidth, h: im.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch (err) { URL.revokeObjectURL(url); throw err; }
  }
}

// ---- 스티커 붙이기 (색감 고르기 다음, 완성 전) ----
// 좌표계: 완성 사진 1200x3600 으로 통일. 무대(화면)는 이 좌표 x (무대폭 / 1200) 배율로 그리고, composeStrip 은 그대로 1200x3600 에 그림
const STICKER_MAX = 20, STICKER_W0 = 330, STICKER_W_MIN = 80, STICKER_W_MAX = 1100;
const stickerStage = document.getElementById('sticker-stage');
const stickerPreview = document.getElementById('sticker-preview');
const stickerSel = document.getElementById('sticker-sel');
const stickerTray = document.getElementById('sticker-tray');
const stickerClip = document.createElement('div');       // 스티커들이 놓이는 층 (사진 밖으로 나간 부분 잘라 냄)
stickerClip.className = 'stk-clip';
stickerStage.insertBefore(stickerClip, stickerSel);
let stickers = [];                    // 붙인 스티커 {sid, id, x, y(중심), w(폭), rot(라디안)}. 뒤에 있을수록 위에 그려짐
let stickerSid = 0;                   // 스티커 고유번호 발급용
let selSid = 0;                       // 선택된 스티커 sid (0 이면 없음)
let stageK = 1;                       // 화면 배율 = 무대 폭 / 1200
const stickerEls = new Map();         // sid -> .stk 요소
let stickerCat = new Map();           // id -> {id,file,w,h,ko,en}
let catalogPromise = null;
const stickerImgCache = new Map();    // id -> Image 로드 Promise (합성용, 한 번만)
const stickerDecoded = new Map();     // id -> 디코딩 끝난 Image (없거나 null 이면 아직)
let previewDrawn = { base: null, tone: undefined };   // 미리보기를 그린 시점의 원본·색감 (같으면 다시 안 그림)
let limitTimer = 0;
let zTop = 0;                         // 스티커 z-index 최댓값 (선택하면 ++zTop 으로 맨 앞)
// 스티커 그림을 고치면 STICKER_V 를 올릴 것 — 예전 그림이 캐시에 남지 않게
const STICKER_V = '4';
// 장소별 전용 스티커 폴더 (없으면 기본 폴더 assets/stickers/)
const SPOT_STICKERS = { cafepokpo: 'cafepokpo/', itaewon: 'halloween/' };
const stickerUrl = file => 'assets/stickers/' + (SPOT_STICKERS[SPOT_CODE] || '') + file + '?v=' + STICKER_V;

// 테스트용: 스티커 배열을 읽기만 가능하게 노출 (쓰기 없음)
window.__stickerDebug = { get stickers() { return stickers.map(s => ({ ...s })); }, stage: stickerStage };

// 스티커 목록(index.json) 한 번만 불러 오기
function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(stickerUrl('index.json')).then(r => r.json()).then(list => {
      stickerCat = new Map(list.map(it => [it.id, it]));
      return list;
    });
    catalogPromise.catch(() => { catalogPromise = null; });
  }
  return catalogPromise;
}
// 스티커 이미지 한 번만 불러 재사용 (합성용)
function loadStickerImg(id) {
  if (!stickerImgCache.has(id)) {
    const it = stickerCat.get(id);
    const p = (async () => {
      const im = new Image();
      // 불러오기 완료(onload)를 먼저 걸어 둠. decode() 는 화면이 숨겨지면 끝없이 미뤄질 수 있어서
      // decode 와 onload 중 먼저 끝나는 쪽으로 넘어가고, 둘 다 10초 안에 안 되면 실패(그 스티커만 건너뜀)
      const loaded = new Promise((ok, no) => { im.onload = ok; im.onerror = () => no(new Error('sticker load failed')); });
      im.src = stickerUrl(it.file);
      const decoded = im.decode().catch(() => loaded);
      const timeout = new Promise((_, no) => setTimeout(() => no(new Error('sticker load timeout')), 10000));
      await Promise.race([decoded, loaded, timeout]);
      if (!im.naturalWidth) throw new Error('sticker not loaded');
      return im;
    })();
    stickerDecoded.set(id, null); p.then(im => stickerDecoded.set(id, im), () => {});
    p.catch(() => { stickerImgCache.delete(id); stickerDecoded.delete(id); });
    stickerImgCache.set(id, p);
  }
  return stickerImgCache.get(id);
}
// 스티커 높이 = 폭 x 이미지 비율
const stickerH = s => { const it = stickerCat.get(s.id); return it ? s.w * it.h / it.w : s.w; };

// 스티커 직접 그리기: 브라우저 drawImage 의 확대·회전 보간(사파리 링잉)을 피하려고 픽셀을 직접 계산한다.
// 미리 곱한 알파(0~1) Float32Array 로 쌍선형 보간하므로 결과는 항상 주변 값 사이에 머문다(밝은 테두리 없음).
const stickerPixCache = new Map();
// 디코딩된 이미지 -> {w,h,data} (RGBA 미리 곱한 값 0~1). 원본 크기 오프스크린 캔버스에서 읽음
function premulFromImage(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const src = x.getImageData(0, 0, w, h).data, out = new Float32Array(w * h * 4);
  for (let i = 0; i < out.length; i += 4) {
    const a = src[i + 3] / 255;
    out[i] = src[i] / 255 * a; out[i + 1] = src[i + 1] / 255 * a; out[i + 2] = src[i + 2] / 255 * a; out[i + 3] = a;
  }
  c.width = c.height = 0;
  return { w, h, data: out };
}
function getStickerPixels(id) {
  let p = stickerPixCache.get(id);
  if (!p) {
    const img = stickerDecoded.get(id);
    if (!img) return null;
    p = { ...premulFromImage(img), mips: null };
    stickerPixCache.set(id, p);
  }
  return p;
}
// 한 단계(가로세로 절반, 올림) 줄이기: 2x2 박스 평균(미리 곱한 값)
function halvePremul(l) {
  const w = Math.max(1, (l.w + 1) >> 1), h = Math.max(1, (l.h + 1) >> 1), d = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = x * 2, x1 = Math.min(x0 + 1, l.w - 1), y0 = y * 2, y1 = Math.min(y0 + 1, l.h - 1);
    const i00 = (y0 * l.w + x0) * 4, i10 = (y0 * l.w + x1) * 4, i01 = (y1 * l.w + x0) * 4, i11 = (y1 * l.w + x1) * 4, o = (y * w + x) * 4;
    for (let c = 0; c < 4; c++) d[o + c] = (l.data[i00 + c] + l.data[i10 + c] + l.data[i01 + c] + l.data[i11 + c]) / 4;
  }
  return { w, h, data: d };
}
// pix: {w,h,data,mips}. ctx 의 바탕(불투명)에 스티커(중심 s.x,s.y 폭 s.w 높이 h 회전 s.rot)를 src-over 로 합성
function drawStickerPixels(ctx, s, h, pix, cw, ch) {
  const sw = s.w, rot = s.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
  const hw = sw / 2, hh = h / 2;
  const ex = Math.abs(hw * cs) + Math.abs(hh * sn), ey = Math.abs(hw * sn) + Math.abs(hh * cs);   // 회전한 사각형의 경계 상자 반폭
  const x0 = Math.max(0, Math.floor(s.x - ex)), x1 = Math.min(cw, Math.ceil(s.x + ex));
  const y0 = Math.max(0, Math.floor(s.y - ey)), y1 = Math.min(ch, Math.ceil(s.y + ey));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return;
  // 축소가 클 때만(목표/원본 < 0.5) 절반씩 줄인 단계에서 목표의 1~2배 크기를 고름
  let lv = { w: pix.w, h: pix.h, data: pix.data };
  const scale = sw / pix.w;
  if (scale < 0.5) {
    if (!pix.mips) pix.mips = [lv];
    const L = Math.floor(Math.log2(1 / scale));
    while (pix.mips.length <= L && (pix.mips[pix.mips.length - 1].w > 1 || pix.mips[pix.mips.length - 1].h > 1)) pix.mips.push(halvePremul(pix.mips[pix.mips.length - 1]));
    lv = pix.mips[Math.min(L, pix.mips.length - 1)];
  }
  const sW = lv.w, sH = lv.h, d = lv.data;
  const img = ctx.getImageData(x0, y0, bw, bh), o = img.data;
  const kx = sW / sw, ky = sH / h;
  for (let y = 0; y < bh; y++) {
    const dy = y0 + y + 0.5 - s.y;
    for (let x = 0; x < bw; x++) {
      const dx = x0 + x + 0.5 - s.x;
      const u = ((dx * cs + dy * sn) * kx + sW / 2) - 0.5, v = ((-dx * sn + dy * cs) * ky + sH / 2) - 0.5;
      const iu = Math.floor(u), iv = Math.floor(v);
      if (iu < -1 || iv < -1 || iu >= sW || iv >= sH) continue;
      const fu = u - iu, fv = v - iv;
      const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
      const in0x = iu >= 0, in1x = iu + 1 < sW, in0y = iv >= 0, in1y = iv + 1 < sH;
      const i00 = (iv * sW + iu) * 4, i10 = i00 + 4, i01 = i00 + sW * 4, i11 = i01 + 4;
      const m00 = in0x && in0y ? w00 : 0, m10 = in1x && in0y ? w10 : 0, m01 = in0x && in1y ? w01 : 0, m11 = in1x && in1y ? w11 : 0;
      const a = (m00 ? m00 * d[i00 + 3] : 0) + (m10 ? m10 * d[i10 + 3] : 0) + (m01 ? m01 * d[i01 + 3] : 0) + (m11 ? m11 * d[i11 + 3] : 0);
      if (a <= 0) continue;
      const r = (m00 ? m00 * d[i00] : 0) + (m10 ? m10 * d[i10] : 0) + (m01 ? m01 * d[i01] : 0) + (m11 ? m11 * d[i11] : 0);
      const g = (m00 ? m00 * d[i00 + 1] : 0) + (m10 ? m10 * d[i10 + 1] : 0) + (m01 ? m01 * d[i01 + 1] : 0) + (m11 ? m11 * d[i11 + 1] : 0);
      const b = (m00 ? m00 * d[i00 + 2] : 0) + (m10 ? m10 * d[i10 + 2] : 0) + (m01 ? m01 * d[i01 + 2] : 0) + (m11 ? m11 * d[i11 + 2] : 0);
      const k = (y * bw + x) * 4, ia = 1 - a;
      const R = r * 255 + o[k] * ia + 0.5, G = g * 255 + o[k + 1] * ia + 0.5, B = b * 255 + o[k + 2] * ia + 0.5;
      o[k] = R > 255 ? 255 : R; o[k + 1] = G > 255 ? 255 : G; o[k + 2] = B > 255 ? 255 : B; o[k + 3] = 255;   // Uint8ClampedArray 가 내림 처리(+0.5 로 반올림)
    }
  }
  ctx.putImageData(img, x0, y0);
}
function drawStickerManual(ctx, s) {
  const pix = getStickerPixels(s.id);
  if (!pix) return false;
  drawStickerPixels(ctx, s, stickerH(s), pix, STRIP_W, STRIP_H);
  return true;
}

// 목록 칸(2열 그리드) 만들기: 누르면 무대에 붙임
function buildTray(list) {
  stickerTray.replaceChildren(...list.map(it => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tray-btn'; b.title = it.en; b.setAttribute('aria-label', it.ko + ' ' + it.en);
    const img = document.createElement('img'); img.src = stickerUrl(it.file); img.alt = ''; img.draggable = false;
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = it.ko;
    b.append(img, nm);
    b.addEventListener('click', () => addSticker(it.id));
    return b;
  }));
}

// 한도(20개) 초과 안내를 2초 보여 줌
function showLimit() {
  document.getElementById('sticker-guide').hidden = true;
  document.getElementById('sticker-limit').hidden = false;
  clearTimeout(limitTimer);
  limitTimer = setTimeout(() => {
    document.getElementById('sticker-guide').hidden = false;
    document.getElementById('sticker-limit').hidden = true;
  }, 2000);
}

// 스티커 한 개의 화면 표시 갱신: 화면 위치 = 좌표 x 배율, 중심 기준(translate -50%) 회전. 드래그 중엔 이것만 호출(rAF 로 묶음)
function placeEl(el, s) {
  const k = stageK, h = stickerH(s);
  el.style.width = s.w * k + 'px';
  el.style.height = h * k + 'px';
  el.style.transform = `translate(${s.x * k}px, ${s.y * k}px) translate(-50%, -50%) rotate(${s.rot}rad)`;
}
function updateSel() {
  const s = stickers.find(t => t.sid === selSid);
  stickerSel.hidden = !s;
  if (s) placeEl(stickerSel, s);
}
const dirty = new Set();              // 다시 그릴 스티커 (rAF 한 번에 묶어 처리)
let rafId = 0;
function scheduleDraw(s) {
  dirty.add(s);
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    for (const t of dirty) { const el = stickerEls.get(t.sid); if (el) placeEl(el, t); }
    dirty.clear();
    updateSel();
  });
}

function makeStickerEl(s) {
  const el = document.createElement('div');
  el.className = 'stk'; el.dataset.sid = s.sid;
  const done = stickerDecoded.get(s.id);
  let img;
  if (done) { img = done.cloneNode(); }                              // 디코딩 끝난 그림 복제 (같은 주소라 바로 그려짐)
  else { img = document.createElement('img'); img.decoding = 'sync'; img.src = stickerUrl(stickerCat.get(s.id).file); }
  img.alt = ''; img.draggable = false;
  el.appendChild(img);
  stickerEls.set(s.sid, el);
  stickerClip.appendChild(el);
  placeEl(el, s);
  return el;
}
// 무대의 스티커 DOM 을 stickers 배열에서 다시 만듦 (화면 들어올 때·크기 바뀔 때)
function renderStickers() {
  stageK = stickerStage.getBoundingClientRect().width / STRIP_W || 1;
  stickerClip.textContent = ''; stickerEls.clear();
  zTop = 0;
  for (const s of stickers) makeStickerEl(s).style.zIndex = ++zTop;   // 배열 순서대로 1..n
  updateSel();
}
// 선택: 맨 앞(배열 끝·DOM 끝)으로 올림. null 이면 선택 해제
function selectSticker(s) {
  selSid = s ? s.sid : 0;
  if (s) {
    const at = stickers.indexOf(s);
    if (at !== stickers.length - 1) { stickers.splice(at, 1); stickers.push(s); }
    const el = stickerEls.get(s.sid); if (el) el.style.zIndex = ++zTop;   // DOM 을 옮기지 않고 z-index 로 맨 앞에
  }
  updateSel();
}
function addSticker(id) {
  if (stickers.length >= STICKER_MAX) { showLimit(); return; }
  stageK = stickerStage.getBoundingClientRect().width / STRIP_W || stageK;
  const rnd = () => Math.round((Math.random() * 2 - 1) * 80);          // 겹치지 않게 +-80 흩뿌림
  const s = { sid: ++stickerSid, id, x: STRIP_W / 2 + rnd(), y: STRIP_H / 2 + rnd(), w: STICKER_W0, rot: 0 };
  stickers.push(s);
  makeStickerEl(s).style.zIndex = ++zTop;
  selectSticker(s);
}
function removeSticker(s) {
  stickers = stickers.filter(t => t !== s);
  const el = stickerEls.get(s.sid); if (el) el.remove();
  stickerEls.delete(s.sid); dirty.delete(s);
  selSid = 0; gest = null; ptrs.clear();
  updateSel();
}
// 스티커 전부 비움 (새 촬영·다시 찍기·처음으로·고르기에서 다음)
function clearStickers() {
  stickers = []; selSid = 0; gest = null; ptrs.clear(); dirty.clear();
  stickerClip.textContent = ''; stickerEls.clear(); zTop = 0;
  stickerSel.hidden = true;
  previewDrawn = { base: null, tone: undefined };
}

// 하단 한 줄 공용: s = 배율(완성 1, 미리보기 0.5). 글꼴·로고를 기다린 뒤 그림. 두 그림이 같은 좌표식을 쓴다
async function drawStripFooter(ctx, s) {
  const fam = f => f[0] + ' ' + f[1] + 'px ' + f[2];
  // 구글 폰트 한글은 글자 묶음(unicode-range)별로 나뉘어 있어서, 실제로 그릴 글자를 같이 넘겨야 그 묶음까지 불러옴
  const sample = (SPOT_NAME || '') + '0123456789.' + FOOT_HANDLE;
  try { await Promise.all([FOOT_SPOT_FONT, FOOT_SPOT_KO2_FONT, FOOT_SPOT_EN_FONT, FOOT_DATE_FONT, FOOT_HANDLE_FONT].map(f => document.fonts.load(fam(f), sample))); } catch (e) { /* 글꼴 실패해도 진행 */ }
  let logo = null;
  try { logo = await loadLogo(); } catch (e) { /* 로고 없이 진행 */ }
  let spotLogo = null;
  try { spotLogo = await loadSpotLogo(); } catch (e) { /* 실패하면 명소 이름 글자로 */ }
  // 로고 + 그 아래 계정 글씨를 한 덩어리로 보고 하단 칸 가운데에(덩어리 계산은 간격 3 기준), 계정 글씨만 4px 위로. 양옆 글자는 로고 세로 중심(cy)
  const lw = (SPOT_CODE && SPOT_FOOT_LOGO_W[SPOT_CODE]) || LOGO_W;          // 그릴 로고 폭(명소별 줄이기)
  const hpx = lw === LOGO_W ? FOOT_HANDLE_FONT[1] : 24;                     // 계정 글씨 크기
  const ratio = logo ? logo.naturalHeight / logo.naturalWidth : 0;
  const lh = lw * ratio;
  const blockH = lh + FOOT_HANDLE_GAP + hpx;
  const top = (FOOT_TOP + STRIP_H) / 2 - blockH / 2;
  // 양옆 글자 중심선은 원래 크기(LOGO_W·28px) 기준 그대로 -> 로고를 줄여도 이름·날짜 위치 안 변함
  const lh0 = LOGO_W * ratio;
  const cy = (FOOT_TOP + STRIP_H) / 2 - (lh0 + FOOT_HANDLE_GAP + FOOT_HANDLE_FONT[1]) / 2 + lh0 / 2;
  if (logo) ctx.drawImage(logo, (STRIP_W - lw) / 2 * s, top * s, lw * s, lh * s);
  ctx.save();
  ctx.fillStyle = STRIP_INK; ctx.globalAlpha = 0.75;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = FOOT_HANDLE_FONT[0] + ' ' + hpx * s + 'px ' + FOOT_HANDLE_FONT[2] + ', system-ui, sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = 1 * s + 'px';
  ctx.fillText(FOOT_HANDLE, STRIP_W / 2 * s, (top + lh + FOOT_HANDLE_GAP + hpx / 2 - FOOT_HANDLE_UP) * s);
  ctx.restore();
  const now = new Date();
  const date = now.getFullYear() + '.' + pad2(now.getMonth() + 1) + '.' + pad2(now.getDate());
  const half = STRIP_W / 2, gap = LOGO_W / 2 + FOOT_GAP;
  const cols = [];
  if (spotLogo) {                                                               // 왼쪽 칸: 명소 로고(이름 글자 대신), 날짜와 같은 중심선
    const bx = CELL_X, bw = half - gap - CELL_X, bh = (STRIP_H - FOOT_TOP) * FOOT_SPOT_LOGO_MAXH;
    const k = Math.min(bw / spotLogo.naturalWidth, bh / spotLogo.naturalHeight);
    const w = spotLogo.naturalWidth * k, h = spotLogo.naturalHeight * k;
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(spotLogo, (bx + (bw - w) / 2) * s, (cy - h / 2) * s, w * s, h * s);
    ctx.restore();
  } else if (SPOT_NAME) {                                                       // 왼쪽 칸
    const nm = SPOT_NAME.match(/^([^A-Za-z]*[가-힣][^A-Za-z]*?)\s+([A-Za-z].*)$/);   // '한글 영어' 두 줄
    if (nm) cols.push([nm[1], FOOT_SPOT_KO2_FONT, CELL_X, half - gap, nm[2]]);
    else cols.push([SPOT_NAME, FOOT_SPOT_FONT, CELL_X, half - gap]);
  }
  cols.push([date, FOOT_DATE_FONT, half + gap, CELL_X + CELL_W]);              // 오른쪽 칸
  ctx.save();
  ctx.fillStyle = STRIP_INK;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const fit = (text, f, x0, x1) => {                               // 칸보다 넓으면 글자 크기를 줄이고, 실제 글자 모양 치수를 돌려줌
    let px = f[1];
    for (;;) {
      ctx.font = f[0] + ' ' + px * s + 'px ' + f[2] + ', system-ui, sans-serif';
      if ('letterSpacing' in ctx) ctx.letterSpacing = 0.04 * px * s + 'px';   // 0.04em
      if (ctx.measureText(text).width <= (x1 - x0) * s || px <= FOOT_FONT_MIN) break;
      px--;
    }
    const m = ctx.measureText(text);
    return { a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, font: ctx.font, ls: ctx.letterSpacing };
  };
  for (const [text, f, x0, x1, en] of cols) {
    const cx = (x0 + x1) / 2 * s;
    const l1 = fit(text, f, x0, x1);
    // 글꼴마다 줄 안에서 글자가 앉는 높이가 달라서(Jua·Fredoka), 실제 글자 모양의 위·아래 끝 가운데를 로고 중심(cy)에 맞춤
    if (!en) {
      const ty = cy * s + (l1.a - l1.d) / 2;
      if (f[3]) { ctx.save(); ctx.strokeStyle = STRIP_INK; ctx.lineWidth = f[3] * s; ctx.lineJoin = 'round'; ctx.strokeText(text, cx, ty); ctx.restore(); }   // 굵게: 같은 색 테두리를 먼저
      ctx.fillText(text, cx, ty); continue;
    }
    // 두 줄: 한글 줄 아래 끝을 오른쪽 날짜 글자 아래 끝에 맞추고, 영어 줄은 그 아래에
    const dt = fit(date, FOOT_DATE_FONT, half + gap, CELL_X + CELL_W);
    const bottom = cy * s + (dt.a + dt.d) / 2;
    const l2 = fit(en, FOOT_SPOT_EN_FONT, x0, x1);
    ctx.fillText(en, cx, bottom + FOOT_SPOT_EN_GAP * s + l2.a);     // 2번째 줄(지금 글꼴이 영어 줄)
    ctx.font = l1.font; if ('letterSpacing' in ctx) ctx.letterSpacing = l1.ls;
    ctx.fillText(text, cx, bottom - l1.d);
  }
  ctx.restore();
}

// 무대 미리보기: 완성 사진(composeStrip)과 같은 배치를 0.5배(600x1800)로. 상수·글자 크기 모두 x0.5
async function drawStripPreview(cv) {
  const S = 0.5;
  const ctx = cv.getContext('2d');
  cv.width = STRIP_W * S; cv.height = STRIP_H * S;
  ctx.fillStyle = STRIP_BG; ctx.fillRect(0, 0, cv.width, cv.height);
  const list = tone && previewCache[tone].length === previewBase.length ? previewCache[tone] : previewBase;   // 색감 적용본 또는 원본
  const dw = CELL_W * S, dh = CELL_H * S;
  list.forEach((src, k) => {
    const sc = Math.max(dw / src.width, dh / src.height);           // cover
    const x = CELL_X * S, y = (CELL_TOP + k * (CELL_H + CELL_GAP)) * S;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, dw, dh); ctx.clip();
    ctx.drawImage(src, x + (dw - src.width * sc) / 2, y + (dh - src.height * sc) / 2, src.width * sc, src.height * sc);
    ctx.restore();
  });
  await drawStripFooter(ctx, S);
}

// 스티커 화면 진입: 화면 전환 -> 배율 측정·스티커 다시 배치 -> 사진·색감이 바뀐 경우에만 미리보기 다시 그림
async function enterSticker() {
  selSid = 0;
  showScreen('screen-sticker');
  try { const list = await loadCatalog(); if (!stickerTray.children.length) buildTray(list); /* 미리 불러 디코딩 (기다리지 않음) */ list.forEach(it => loadStickerImg(it.id).catch(() => {})); } catch (e) { /* 목록 실패: 스티커 없이 진행 */ }
  renderStickers();
  if (previewDrawn.base !== previewBase || previewDrawn.tone !== tone) {
    previewDrawn = { base: previewBase, tone };
    await drawStripPreview(stickerPreview);
  }
}
window.addEventListener('resize', () => { if (currentScreen() === 'screen-sticker') renderStickers(); });

// ---- 조작 (Pointer Events: 마우스·터치 공통) ----
// ptrs: 누르고 있는 포인터 {x,y}(화면 좌표). gest: 진행 중인 동작 {mode: move | handle | pinch, s, ...시작 값}
const ptrs = new Map();
let gest = null;
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const stageRect = () => stickerStage.getBoundingClientRect();

function beginMove(s, pid, px, py) {
  gest = { mode: 'move', s, pid, px, py, x0: s.x, y0: s.y };
}
function beginPinch(s) {
  const [a, b] = [...ptrs.values()];
  gest = { mode: 'pinch', s, d0: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), a0: Math.atan2(b.y - a.y, b.x - a.x),
    mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, x0: s.x, y0: s.y, w0: s.w, r0: s.rot };
}
function beginHandle(s, pid, px, py) {
  const r = stageRect();
  const cx = r.left + s.x * stageK, cy = r.top + s.y * stageK;       // 스티커 중심의 화면 좌표
  gest = { mode: 'handle', s, pid, cx, cy, d0: Math.max(1, Math.hypot(px - cx, py - cy)), a0: Math.atan2(py - cy, px - cx), w0: s.w, r0: s.rot };
}

stickerStage.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.target.closest('.sel-x')) return;                              // ✕ 는 click 으로 처리
  stageK = stageRect().width / STRIP_W || stageK;
  try { stickerStage.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2 && gest && gest.mode !== 'handle') { beginPinch(gest.s); return; }   // 두 번째 손가락: 확대·회전·이동
  if (ptrs.size > 1) return;
  if (e.target.closest('.sel-h')) {
    const s = stickers.find(t => t.sid === selSid);
    if (s) beginHandle(s, e.pointerId, e.clientX, e.clientY);
    return;
  }
  const el = e.target.closest('.stk');
  const s = el && stickers.find(t => t.sid === +el.dataset.sid);
  if (s) { selectSticker(s); beginMove(s, e.pointerId, e.clientX, e.clientY); }
  else { selectSticker(null); gest = null; }                           // 빈 곳: 선택 해제
  e.preventDefault();
});
stickerStage.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (!gest) return;
  const g = gest, s = g.s;
  if (g.mode === 'move' && e.pointerId === g.pid) {
    s.x = clampN(g.x0 + (e.clientX - g.px) / stageK, 0, STRIP_W);      // 중심이 사진 밖으로 완전히 나가지 않게
    s.y = clampN(g.y0 + (e.clientY - g.py) / stageK, 0, STRIP_H);
  } else if (g.mode === 'handle' && e.pointerId === g.pid) {
    const d = Math.hypot(e.clientX - g.cx, e.clientY - g.cy), a = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
    s.w = clampN(g.w0 * d / g.d0, STICKER_W_MIN, STICKER_W_MAX);       // 중심~손가락 거리 비율 = 크기 비율
    s.rot = g.r0 + (a - g.a0);                                         // 각도 차이 = 회전
  } else if (g.mode === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    s.w = clampN(g.w0 * Math.hypot(b.x - a.x, b.y - a.y) / g.d0, STICKER_W_MIN, STICKER_W_MAX);
    s.rot = g.r0 + (Math.atan2(b.y - a.y, b.x - a.x) - g.a0);
    s.x = clampN(g.x0 + ((a.x + b.x) / 2 - g.mx) / stageK, 0, STRIP_W);   // 중점 이동 = 위치 이동
    s.y = clampN(g.y0 + ((a.y + b.y) / 2 - g.my) / stageK, 0, STRIP_H);
  } else return;
  scheduleDraw(s);
});
function endPointer(e) {
  if (!ptrs.delete(e.pointerId)) return;
  if (!gest) return;
  if (gest.mode === 'pinch' && ptrs.size === 1) {                      // 한 손가락 남으면 그 손가락으로 이동 이어 감
    const [id, p] = [...ptrs.entries()][0];
    beginMove(gest.s, id, p.x, p.y);
  } else if (!ptrs.size || e.pointerId === gest.pid) gest = null;
}
stickerStage.addEventListener('pointerup', endPointer);
stickerStage.addEventListener('pointercancel', endPointer);
stickerSel.querySelector('.sel-x').addEventListener('click', () => {
  const s = stickers.find(t => t.sid === selSid);
  if (s) removeSticker(s);
});

document.getElementById('sticker-make').addEventListener('click', () => { selectSticker(null); startResult(); });
// 뒤로: 색감 화면으로 (스티커 유지)
document.getElementById('sticker-back').addEventListener('click', () => { selectSticker(null); showScreen('screen-filter'); });

// 색감은 미리보기와 같은 applyTone 사용. 결과 {blob, url, fileName} (url 은 쓰고 나면 revokeObjectURL 필요)
async function composeStrip() {
  await loadLogo();                                                  // 로고 못 불러오면 여기서 실패 처리
  const cv = document.createElement('canvas');
  cv.width = STRIP_W; cv.height = STRIP_H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = STRIP_BG; ctx.fillRect(0, 0, STRIP_W, STRIP_H);

  // 사진 칸: 1060x795 임시 캔버스에 cover 로 그리고 색감 적용 후 본 캔버스로
  const tmp = document.createElement('canvas');
  tmp.width = CELL_W; tmp.height = CELL_H;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  for (let k = 0; k < selected.length; k++) {
    const photo = await openPhoto(shots[selected[k]].blob);
    try {
      const sc = Math.max(CELL_W / photo.w, CELL_H / photo.h);      // cover (원본이 4:3 이면 그대로 맞음)
      const dw = photo.w * sc, dh = photo.h * sc;
      tctx.clearRect(0, 0, CELL_W, CELL_H);
      tctx.drawImage(photo.src, (CELL_W - dw) / 2, (CELL_H - dh) / 2, dw, dh);
    } finally { photo.close(); }
    if (tone) {                                                      // tone 이 null 이면 필터 건너뜀
      const data = tctx.getImageData(0, 0, CELL_W, CELL_H);
      applyTone(data, tone);
      tctx.putImageData(data, 0, 0);
    }
    ctx.drawImage(tmp, CELL_X, CELL_TOP + k * (CELL_H + CELL_GAP));
  }
  tmp.width = tmp.height = 0;                                        // 임시 캔버스 메모리 해제

  // 하단: 로고(가운데) + 왼쪽 명소 이름 + 오른쪽 날짜
  await drawStripFooter(ctx, 1);

  // 스티커: 사진·로고·글자 위에 배열 순서대로(나중 것이 위). 좌표는 무대와 같은 1200x3600
  for (const s of stickers) {
    let img = null;
    try { img = await loadStickerImg(s.id); } catch (e) { continue; }   // 이미지 못 불러오면 그 스티커만 건너뜀
    drawStickerManual(ctx, s);                                         // 직접 픽셀 계산(사파리 보간 링잉 회피)
  }

  const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.95));
  let preview = null;
  if (blob) {
    try {                                                            // 미리보기: 원본 픽셀을 읽어 면적 평균으로 직접 축소 (읽은 뒤 바로 버림)
      const box = previewBox();
      preview = document.createElement('canvas');
      areaAverageToCanvas(cv.getContext('2d').getImageData(0, 0, STRIP_W, STRIP_H), preview, box.tw);
      preview.style.width = box.cssW + 'px'; preview.style.height = box.cssH + 'px';
    } catch (e) { preview = null; }
  }
  cv.width = cv.height = 0;
  if (!blob) throw new Error('toBlob failed');
  const now = new Date();                                            // 파일 이름용 촬영 시각
  const fileName = 'frame-your-memory-' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + '-' + pad2(now.getHours()) + pad2(now.getMinutes()) + '.jpg';
  return { blob, url: URL.createObjectURL(blob), fileName, preview };
}

const resultWait = document.getElementById('result-wait');
const resultDone = document.getElementById('result-done');
const resultCanvas = document.getElementById('result-canvas');
const resultSave = document.getElementById('result-save');
const resultNote = document.getElementById('result-note');
let result = null;            // 완성 결과 {blob, url, fileName, file}
let resultRun = 0;            // 합성 회차: 정리되거나 다시 시작되면 올라가서 오래된 결과를 버림
let noteTimer = 0;

// 미리보기 표시 크기: CSS(.result-canvas)와 같은 규칙. 폭 <= min(칸 폭, 460), 높이 <= min(64dvh, 100dvh-250px), 비율 1:3
function previewBox() {
  const par = resultDone.parentElement, cs = getComputedStyle(par);
  const availW = par.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const vh = window.innerHeight;
  const maxH = Math.min(vh * 0.64, vh - 250);
  const cssW = Math.max(1, Math.min(availW > 0 ? availW : window.innerWidth, 460, maxH / 3));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  // 캔버스 점 개수와 화면 표시 크기를 정확히 1:1 로: 점 개수(정수)를 먼저 정하고 CSS 크기를 거기서 역산
  // (소수점 차이라도 남으면 브라우저가 다시 축소하면서 링잉이 생길 수 있음)
  const tw = Math.max(1, Math.min(STRIP_W, Math.floor(cssW * dpr)));
  const th = Math.round(tw * STRIP_H / STRIP_W);
  return { cssW: tw / dpr, cssH: th / dpr, tw };
}

// 면적 평균 축소: 목표 픽셀 하나가 덮는 원본 영역(정수 배가 아니어도 가장자리 가중)의 평균. 링잉 없음.
// 원본 행을 가로로 먼저 줄여 rowBuf 에 두고, 세로로 목표 행에 가중 누적. 루프 안 할당 없음 (버퍼는 미리 한 번)
function areaAverageToCanvas(src, cv, tw) {
  const sw = src.width, sh = src.height, th = Math.max(1, Math.round(tw * sh / sw));
  cv.width = tw; cv.height = th;
  const ctx = cv.getContext('2d');
  const out = ctx.createImageData(tw, th), od = out.data, sd = src.data;
  const sx = sw / tw, sy = sh / th, norm = 1 / (sx * sy);
  const rowBuf = new Float32Array(tw * 3), acc = new Float32Array(tw * 3);
  let rowY = -1;
  for (let i = 0; i < th; i++) {
    const y0 = i * sy, y1 = Math.min(sh, y0 + sy);
    acc.fill(0);
    for (let y = Math.floor(y0); y < y1 && y < sh; y++) {
      const wy = Math.min(y + 1, y1) - Math.max(y, y0);
      if (wy <= 0) continue;
      if (y !== rowY) {                                              // 같은 원본 행이 두 목표 행에 걸치면 다시 계산하지 않음
        rowY = y;
        const base = y * sw * 4;
        for (let j = 0; j < tw; j++) {
          const x0 = j * sx, x1 = Math.min(sw, x0 + sx);
          let r = 0, g = 0, b = 0;
          for (let x = Math.floor(x0); x < x1 && x < sw; x++) {
            const wx = Math.min(x + 1, x1) - Math.max(x, x0);
            const p = base + x * 4;
            r += sd[p] * wx; g += sd[p + 1] * wx; b += sd[p + 2] * wx;
          }
          const q = j * 3;
          rowBuf[q] = r; rowBuf[q + 1] = g; rowBuf[q + 2] = b;
        }
      }
      for (let k = 0; k < tw * 3; k++) acc[k] += rowBuf[k] * wy;
    }
    const o = i * tw * 4;
    for (let j = 0; j < tw; j++) {
      const q = j * 3, p = o + j * 4;
      od[p] = acc[q] * norm + 0.5; od[p + 1] = acc[q + 1] * norm + 0.5; od[p + 2] = acc[q + 2] * norm + 0.5; od[p + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

// 결과 화면에서 가로 폭이 20% 이상 바뀌면 blob 을 다시 열어 같은 방식으로 다시 그림
let previewTw = 0, previewRedo = 0;
async function redrawPreview() {
  if (!result || currentScreen() !== 'screen-result') return;
  const run = resultRun, box = previewBox();
  if (Math.abs(box.tw - previewTw) < previewTw * 0.2) return;
  const my = ++previewRedo;
  let bmp = null, tmp = null;
  try {
    bmp = await createImageBitmap(result.blob);
    tmp = document.createElement('canvas'); tmp.width = bmp.width; tmp.height = bmp.height;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(bmp, 0, 0);
    const data = tctx.getImageData(0, 0, bmp.width, bmp.height);
    if (run !== resultRun || my !== previewRedo) return;
    areaAverageToCanvas(data, resultCanvas, box.tw);
    resultCanvas.style.width = box.cssW + 'px'; resultCanvas.style.height = box.cssH + 'px';
    previewTw = box.tw;
  } catch (e) { /* 실패하면 기존 미리보기 유지 */ }
  finally { if (bmp) bmp.close(); if (tmp) tmp.width = tmp.height = 0; }
}
window.addEventListener('resize', redrawPreview);
window.__resultDebug = { get canvas() { return resultCanvas; } };

// 결과 정리: 진행 중 합성 무효화 + 안내 지우기 + URL 해제 + 이미지·저장 버튼 비움
function clearResult() {
  resultRun++;
  clearTimeout(noteTimer);
  resultNote.textContent = '';
  resultCanvas.width = resultCanvas.height = 0; resultCanvas.style.width = resultCanvas.style.height = '';
  previewTw = 0; previewRedo++;
  resultSave.disabled = true;
  adWatched = false; closeAd();
  if (result) URL.revokeObjectURL(result.url);
  result = null;
}

// 완성 화면 진입: 만드는 중 표시 -> composeStrip -> 완성 표시. 이미 진행 중이면 새 회차가 이전 것을 무효화
async function startResult() {
  clearResult();
  const run = resultRun;
  resultWait.hidden = false; resultDone.hidden = true;
  showScreen('screen-result');
  // 촬영 횟수 기록: 기다리지 않고 호출 (실패해도 화면엔 표시 없음). 세트당 1번, 테스트 모드는 ?record=1 일 때만
  const qs = new URLSearchParams(location.search);
  if (SPOT_CODE && SPOT_VALID !== false && !shotRecorded && (!FAKE_CAM || qs.get('record') === '1')) {
    shotRecorded = true;
    recordShot(SPOT_CODE).then(ok => { window.__sbDebug.lastRecord = ok; });
  }
  if (!setTracked) {                                                  // 세트당 1번: 사진 완성 + 고른 필터
    setTracked = true;
    track('photo_done', setNo);
    track('filter', tone || 'none');
  }
  let r = null;
  try { r = await composeStrip(); } catch (e) { r = null; }
  if (run !== resultRun) { if (r) { URL.revokeObjectURL(r.url); if (r.preview) r.preview.width = r.preview.height = 0; } return; }
  if (!r) {                                                           // 합성 실패: 스티커 화면으로 돌아가 다시 시도하게 함
    alert('사진을 만들지 못했어요. 다시 시도해 주세요\nCouldn\'t make the photo. Please try again.');
    enterSticker();
    return;
  }
  const { preview, ...rest } = r;
  result = { ...rest, file: new File([r.blob], r.fileName, { type: 'image/jpeg' }) };   // 공유용 File 은 미리 만들어 둠
  if (preview) {                                                      // 미리 줄여 둔 캔버스를 보이는 캔버스로 옮김
    resultCanvas.width = preview.width; resultCanvas.height = preview.height;
    resultCanvas.style.width = preview.style.width; resultCanvas.style.height = preview.style.height;
    resultCanvas.getContext('2d').drawImage(preview, 0, 0);          // 같은 크기 1:1 복사 (축소 아님)
    previewTw = preview.width;
    preview.width = preview.height = 0;
  }
  resultWait.hidden = true; resultDone.hidden = false;
  resultSave.disabled = false;
}

function showSaveNote(desktop) {
  if (desktop) setBilingual(resultNote, '다운로드 폴더에 저장했어요', 'Saved to your Downloads folder');
  else setBilingual(resultNote, '사진첩이나 다운로드 폴더를 확인해 주세요', 'Check your Photos or Downloads');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { resultNote.textContent = ''; }, 3000);
}

// 휴대폰(손가락 터치 기기)만 공유창 사용. 노트북은 공유창에 '이미지 저장'이 없어서 바로 내려받기
const IS_PHONE = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;

// 저장: 아이폰은 탭 직후에만 공유창이 열리므로 핸들러 안에서 await 없이 바로 share 호출
function doSave() {
  if (!result) return;
  track('save', setNo);
  const { file, url, fileName } = result;
  if (IS_PHONE && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    navigator.share({ files: [file], title: 'frame your memory' })
      .then(() => showSaveNote(false))
      .catch(e => { if (!e || e.name !== 'AbortError') downloadResult(url, fileName); });   // 취소는 조용히 무시, 그 외 실패는 내려받기로
  } else {
    downloadResult(url, fileName);
  }
}
function downloadResult(url, fileName) {
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  showSaveNote(!IS_PHONE);
}

// 색감 화면의 '다음': 스티커 화면으로
filterMake.addEventListener('click', enterSticker);
// 뒤로: 결과만 정리하고 스티커 화면으로 (고른 사진·색감·스티커 유지)
document.getElementById('result-back').addEventListener('click', () => { clearResult(); enterSticker(); });
// 처음으로: 결과·shots·selected·tone 모두 정리 (goHome 이 abortShoot -> clearShots -> clearToneCache 로 shots·tone 정리)
document.getElementById('result-home').addEventListener('click', () => { clearResult(); selected.length = 0; goHome(); });

document.getElementById('cam-back').addEventListener('click', e => { e.stopPropagation(); goHome(); });
camView.addEventListener('click', onCameraReady);


// ---- 광고 게이트: 저장 버튼 -> 광고(카운트다운) -> 사진 저장하기 버튼에서 원래 저장(doSave) 실행 ----
// ad.json 이 꺼져 있거나 못 불러오면 광고 없이 바로 저장 (저장을 막지 않음). ?ad=0 강제 끔, ?ad=1 강제 켬
let adWatched = false, adConf = null, adTimer = 0;
const adQ = new URLSearchParams(location.search).get('ad');
const adEl = document.getElementById('ad-overlay');
const adSaveBtn = document.getElementById('ad-save');
const adCount = document.getElementById('ad-count');
const adBar = document.getElementById('ad-bar');
if (adQ !== '0') {
  fetch('ad.json', { cache: 'no-store' }).then(r => r.json()).then(j => {
    if (adQ === '1' && j) j.enabled = true;
    if (j && j.enabled && j.ad) { adConf = j; renderAd(j.ad); }
  }).catch(() => { adConf = null; });
}
function adText(id, ko, en) { const el = document.getElementById(id); if (el) setBilingual(el, ko, en); }
function renderAd(a) {
  const img = document.getElementById('ad-img');
  if (a.image) img.src = a.image; else img.hidden = true;
  adText('ad-title', a.title, a.titleEn);
  adText('ad-body', a.body, a.bodyEn);
  const cta = document.getElementById('ad-cta');
  setBilingual(cta, a.cta, a.ctaEn);
  if (a.link && /^https?:\/\//i.test(a.link)) { cta.href = a.link; cta.target = '_blank'; cta.rel = 'noopener'; cta.addEventListener('click', () => track('ad_click', setNo)); } else cta.hidden = true;
  document.getElementById('ad-note').textContent = a.note || '';
}
function closeAd() {
  clearInterval(adTimer); adTimer = 0;
  if (adEl) adEl.hidden = true;
}
function openAd() {
  const total = FAST ? 2 : Math.max(1, Number(adConf.seconds) || 10);
  let left = total, last = performance.now();
  adSaveBtn.disabled = true;
  adEl.hidden = false;
  track('ad_shown', setNo);
  const paint = () => {
    const n = Math.ceil(left);
    setBilingual(adCount, n + '초 후 저장할 수 있어요', 'You can save in ' + n + 's');
    adBar.style.width = (100 * (1 - left / total)) + '%';
  };
  paint();
  clearInterval(adTimer);
  adTimer = setInterval(() => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    if (document.hidden) return;                       // 탭이 가려져 있으면 멈춤
    left = Math.max(0, left - Math.min(dt, 0.5));
    paint();
    if (left <= 0) {
      clearInterval(adTimer); adTimer = 0;
      adWatched = true; adSaveBtn.disabled = false;
      track('ad_done', setNo);
      setBilingual(adCount, '이제 저장할 수 있어요', 'Ready to save');
    }
  }, 100);
}
resultSave.addEventListener('click', () => {
  if (!result) return;
  if (adConf && !adWatched) openAd(); else doSave();
});
adSaveBtn.addEventListener('click', () => {
  if (adSaveBtn.disabled) return;
  doSave();                                            // 탭 안에서 바로 원래 저장 실행
  closeAd();
});
document.getElementById('ad-back').addEventListener('click', closeAd);
