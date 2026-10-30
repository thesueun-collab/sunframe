// Supabase 연결: SDK 없이 fetch 로 REST 직접 호출 (일반 스크립트, 전역 함수)
const SB_URL = 'https://tvafnelngianhthfwcru.supabase.co';
// 공개용 키 — 웹페이지에 넣어도 됨, 권한은 Supabase 규칙으로 제한
const SB_KEY = 'sb_publishable__8gcPGMEW9QaFiUmiE_BMQ__lODYKSa';

// REST 호출 공용: 6초 안에 못 끝나거나 응답이 오류면 throw. 성공하면 Response 반환
async function sbFetch(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(SB_URL + path, {
      ...opts,
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('Supabase ' + res.status);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// 명소 한 곳 조회: 있으면 {code,name,region}, 없으면 null (네트워크 실패는 throw)
async function fetchSpot(code) {
  const res = await sbFetch('/rest/v1/spots?code=eq.' + encodeURIComponent(code) + '&select=code,name,region');
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// 촬영 기록 1줄 추가. 성공 true / 실패 false (던지지 않음)
async function recordShot(code) {
  try {
    await sbFetch('/rest/v1/shots', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ spot_code: code }),
    });
    return true;
  } catch (e) {
    console.warn('recordShot failed:', e && e.message);
    return false;
  }
}

// 명소별 오늘/누적 촬영 횟수: [{code,name,today,total}]
async function fetchCounts() {
  const res = await sbFetch('/rest/v1/rpc/spot_counts', { method: 'POST', body: '{}' });
  return res.json();
}

// ---- 이용 흐름 기록 (funnel) ----
// 탭마다 랜덤 세션 id (sessionStorage: 새로고침해도 같은 id → 중복 집계 방지)
function getSessionId() {
  try {
    let id = sessionStorage.getItem('fym_sid');
    if (id && id.length >= 8) return id;
    id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
    sessionStorage.setItem('fym_sid', id);
    return id;
  } catch (e) {
    window.__fymSid = window.__fymSid || 'm' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    return window.__fymSid;
  }
}

// 이벤트 1건 기록: 기다리지 않고, 실패해도 던지지 않음.
// 같은 (세션, 종류, ref) 중복은 서버(트리거)가 조용히 무시함
function trackEvent(code, type, ref) {
  try {
    sbFetch('/rest/v1/events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ spot_code: code, session_id: getSessionId(), type, ref: String(ref == null ? '' : ref).slice(0, 40) }),
    }).catch(e => console.warn('track failed:', type, e && e.message));
  } catch (e) { /* 무시 */ }
}

// 명소별 이용 흐름 통계 (현황판용)
async function fetchFunnel() {
  const res = await sbFetch('/rest/v1/rpc/funnel_stats', { method: 'POST', body: '{}' });
  return res.json();
}
