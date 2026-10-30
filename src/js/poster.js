// QR 포스터: ?spot=코드 → 명소 이름 조회 + QR(SVG) 생성 + 화면 맞춤 축소
(function () {
  const $ = (id) => document.getElementById(id);
  const code = new URLSearchParams(location.search).get('spot') || '';
  const valid = /^[a-z0-9-]{2,32}$/.test(code);

  // 명소별 포스터 테마 (없으면 기본 크림 포스터). cls 는 <html> 에 붙는 클래스, 나머지는 문구/그림
  const POSTER_THEME = {
    itaewon: {
      vampire: true,                                                   // 할로윈 파티 전단 스타일(참고 전단 그림 바탕, 시트 내용을 JS 로 새로 만듦)
      cls: 'theme-vampire',
      logo: 'assets/logo-white.png',
      hideName: true,                                                  // 명소 이름 줄 없이 문구를 크게
      tagline: '무료 포토부스\n이용해보세요!',
      taglineEn: 'Try this free photo booth!',
      free: ['앱 설치 필요없음', 'No app needed'],   // 크게 강조하는 띠(아래 '앱 설치 없이 무료' 줄 대신)
      // [파일, 왼쪽 mm, 위 mm, 크기 mm, 회전 deg] — 가장자리 여백 8mm 이상, 로고·이름·QR 카드와 안 겹치게
      stickers: [
        ['01-pumpkin', 9, 10, 34, -12],
        ['06-bat', 164, 12, 34, 10],
        ['05-moon', 168, 100, 30, 8],
        ['03-blackcat', 9, 108, 34, -6],
        ['08-star', 10, 168, 24, 14],
        ['02-ghost', 160, 160, 36, 8],
        ['04-witchhat', 9, 244, 30, -10],
        ['10-skull', 167, 242, 30, 9]
      ]
    }
  };
  const theme = POSTER_THEME[code] || null;
  if (theme) document.documentElement.classList.add(theme.cls);

  $('print').addEventListener('click', () => window.print());
  // 이미지 파일 만들기용: ?export=1 이면 버튼·배경 없이 A4 종이만 원래 크기로 (헤드리스 크롬 스크린샷에 사용)
  const EXPORT = new URLSearchParams(location.search).get('export') === '1';
  if (EXPORT) document.documentElement.classList.add('export');

  // 화면 폭에 맞춰 A4 시트를 transform 으로 축소 (인쇄 땐 CSS 가 transform 제거)
  function fit() {
    const stage = $('stage'), sheet = $('sheet');
    if (stage.hidden) return;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:210mm;height:297mm';
    document.body.appendChild(probe);
    const w = probe.offsetWidth, h = probe.offsetHeight;
    probe.remove();
    const avail = document.documentElement.clientWidth - 32;
    const s = EXPORT ? 1 : Math.min(1, avail / w);
    sheet.style.setProperty('--s', s);
    fitVampireTitle();
    stage.style.width = w * s + 'px';
    stage.style.height = h * s + 'px';
    fitName();
  }

  // 명소 이름이 한 줄에 안 들어가면 글자 크기를 줄임
  function fitName() {
    const el = $('spot-name');
    if (el.hidden) return;
    el.style.fontSize = '';
    const max = el.parentElement.clientWidth - 2 * parseFloat(getComputedStyle(el.parentElement).paddingLeft);
    if (el.scrollWidth > max && max > 0) {
      el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * max / el.scrollWidth * 0.97) + 'px';
    }
  }


  // ── 할로윈 파티 전단(theme-vampire): 참고 전단 그림(assets/posters/itaewon-vampire-bg.jpg)을 바탕으로 쓰고 글씨만 HTML 로 올림 ──
  function applyVampire() {
    const sheet = $('sheet');
    sheet.innerHTML =
      '<h1 id="spot-name" class="spot-name" hidden></h1><p id="warn" class="warn" hidden></p>' +
      '<div class="v-title"><b>TRY FREE</b><span>PHOTOBOOTH</span></div>' +
      '<div class="v-left"><b>SCAN<br>THE QR</b><span>QR을 스캔하세요</span></div>' +
      '<section class="qr-card"><div id="qr" class="qr"></div><p id="qr-url" class="qr-url" hidden></p></section>' +
      '<div class="v-right"><b>NO APP<br>NEEDED</b><span>앱 설치 필요없음</span></div>' +
      '<p class="v-line v-ko">무료 포토부스 이용해보세요! · <i>Try this free photo booth!</i></p>' +
      '<p class="v-line v-en"><i>frame your memory</i> · @sunframestudio</p>';
  }

  // 전단 제목을 원본처럼 입안 폭에 꽉 차게: 줄마다 목표 폭(mm)에 맞춰 글자 크기를 계산
  const V_TITLE_W = { b: 166, span: 132 };
  function fitVampireTitle() {
    const t = document.querySelector('.v-title');
    if (!t) return;
    const pxPerMm = 96 / 25.4;
    for (const [sel, mm] of Object.entries(V_TITLE_W)) {
      const el = t.querySelector(sel);
      el.style.fontSize = '';
      const w = el.offsetWidth;                                   // transform(축소) 영향 없는 원래 크기
      if (w) el.style.fontSize = parseFloat(getComputedStyle(el).fontSize) * mm * pxPerMm / w + 'px';
    }
  }

  // 테마 적용: 로고·문구 교체 + 스티커 장식
  function applyTheme() {
    if (!theme) return;
    if (theme.vampire) { applyVampire(); return; }
    document.querySelector('.logo').src = theme.logo;
    if (theme.hideName) document.documentElement.classList.add('no-spot-name');
    const tg = document.querySelector('.tagline');
    tg.textContent = theme.tagline;
    const sm = document.createElement('small');
    sm.textContent = theme.taglineEn;
    tg.appendChild(sm);
    const deco = document.createElement('div');
    deco.className = 'deco';
    theme.stickers.forEach(([f, x, y, w, r]) => {
      const im = document.createElement('img');
      im.src = 'assets/stickers/halloween/' + f + '.png';
      im.alt = '';
      im.style.cssText = 'left:' + x + 'mm;top:' + y + 'mm;width:' + w + 'mm;transform:rotate(' + r + 'deg)';
      deco.appendChild(im);
    });
    $('sheet').prepend(deco);
    if (theme.free) {
      const fb = document.createElement('p');
      fb.className = 'free-badge';
      fb.textContent = theme.free[0];
      const fe = document.createElement('small');
      fe.textContent = theme.free[1];
      fb.appendChild(fe);
      document.querySelector('.foot').before(fb);
      document.documentElement.classList.add('has-free-badge');
    }
  }

  // 명소 이름 표시: '한글 English' 형태면 한글은 크게, 영어는 아래 줄에 작게 (앱 하단 문구와 같은 규칙)
  function setName(name) {
    const el = $('spot-name');
    const m = name.match(/^([^A-Za-z]*[가-힣][^A-Za-z]*?)\s+([A-Za-z].*)$/);
    el.textContent = '';
    if (!m) { el.textContent = name; return; }
    const ko = document.createElement('span'), en = document.createElement('span');
    ko.className = 'nm-ko'; ko.textContent = m[1];
    en.className = 'nm-en'; en.textContent = m[2];
    el.append(ko, en);
  }

  // QR 을 SVG path 로 직접 생성 (오류 정정 M, 주변 여백 4모듈)
  function drawQR(url) {
    const box = $('qr'), label = $('qr-url');
    try {
      if (typeof qrcode !== 'function') throw new Error('qrcode lib missing');
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const n = qr.getModuleCount(), q = 4;
      let d = '';
      for (let r = 0; r < n; r++) {
        let c = 0;
        while (c < n) {
          if (qr.isDark(r, c)) {
            let e = c;
            while (e < n && qr.isDark(r, e)) e++;
            d += 'M' + (c + q) + ' ' + (r + q) + 'h' + (e - c) + 'v1h-' + (e - c) + 'z';
            c = e;
          } else c++;
        }
      }
      const total = n + q * 2;
      box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total +
        '" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="' + total + '" height="' + total +
        '" fill="#fff"/><path d="' + d + '" fill="#1a1a1a"/></svg>';
    } catch (e) {
      console.warn('QR failed:', e && e.message);
      box.style.display = 'none';
      label.textContent = url;
      label.hidden = false;
    }
  }

  async function init() {
    if (!valid) {
      $('missing').hidden = false;
      return;
    }
    $('stage').hidden = false;
    applyTheme();
    // 로컬(localhost)에서 뽑은 포스터에도 실제 공개 주소가 들어가도록
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    drawQR((local ? 'https://sunframestudio.vercel.app' : location.origin) + '/?spot=' + code);
    $('spot-name').textContent = code;
    fit();
    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    try {
      const spot = await fetchSpot(code);
      if (!spot) throw new Error('not found');
      setName(spot.name);
    } catch (e) {
      console.warn('fetchSpot failed:', e && e.message);
      $('warn').hidden = false;
    }
    fit();
  }

  // 라이브러리(defer) 로드가 끝난 뒤 실행
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
  window.addEventListener('beforeprint', fitName);
})();
