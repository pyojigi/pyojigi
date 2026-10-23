// 페이지 스크립트를 가짜 DOM 위에서 실행해, 실제 클릭 흐름(시작→질문→중간결과→빈 질문 복귀→결과)을 끝까지 돌려 본다.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','src','pyojigi.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEnv() {
  const els = {};
  const mk = (id, extra = {}) => (els[id] = els[id] || Object.assign({ id, hidden: false, disabled: false, textContent: '', value: '', onclick: null, onsubmit: null, classList: { add() {}, remove() {} }, dataset: {}, append() {}, style: {} }, extra));
  let appHTML = '';
  const app = { get innerHTML() { return appHTML; }, set innerHTML(v) { appHTML = v; for (const k in els) if (!['app', 'trail', 'trailBox', 'metaCh', 'metaN', 'resetBtn', 'navResult', 'menuBtn', 'menuPanel'].includes(k)) delete els[k]; }, firstElementChild: { classList: { add() {} } },
    querySelector() { return null; },
    querySelectorAll(sel) { if (sel !== '.opt') return []; if (app._optsFor === appHTML) return app._opts; app._optsFor = appHTML; const out = []; const re = /<button type="button" class="opt[^"]*" data-k="(\d+)"/g; let m; while ((m = re.exec(appHTML))) { const b = { dataset: { k: m[1] }, classList: { add() {} }, onclick: null }; out.push(b); } app._opts = out; return out; } };
  els.app = app;
  ['trail', 'trailBox', 'metaCh', 'metaN', 'resetBtn', 'navResult', 'menuBtn'].forEach(id => mk(id)); mk('menuPanel', { hidden: true, querySelectorAll: () => [], contains: () => false }); els.menuBtn.setAttribute = () => {};
  const document = {
    getElementById(id) { if (id === 'app') return app; if (els[id]) return els[id]; if (appHTML.includes(`id="${id}"`)) { const e = mk(id); if (id === 'ta') { const m = appHTML.match(/<textarea id="ta"[^>]*>([\s\S]*?)<\/textarea>/); e.value = m ? m[1] : ''; } return e; } return null; },
    createElement() { return { className: '', textContent: '', append() {} }; },
    addEventListener() {}
  };
  const store = {};
  const window = { scrollTo() {}, claude: undefined };
  const localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  return { els, app, document, window, localStorage, getHTML: () => appHTML };
}

function runFlow(rnd, opts = {}) {
  const env = makeEnv();
  const timers = [];
  const setTimeout = (fn) => { timers.push(fn); };
  const ctx = new Function('document', 'window', 'localStorage', 'setTimeout', 'AbortController', script + '\nreturn {get st(){return st}, render, list, missing};');
  const api = ctx(env.document, env.window, env.localStorage, setTimeout, class { constructor() { this.signal = {}; } abort() {} });
  const click = id => { const e = env.document.getElementById(id); if (!e || !e.onclick) throw new Error('버튼 없음: ' + id + ' / phase=' + api.st.phase); e.onclick(); while (timers.length) timers.shift()(); };
  { const ag = env.document.getElementById('agree'); if (!ag) throw new Error('동의 체크 없음'); click('start'); if (api.st.phase !== 'intro') throw new Error('동의 없이 시작됨'); ag.checked = true; click('start'); }
  let steps = 0, skipped = 0;
  while (api.st.phase !== 'result') {
    if (++steps > 400) throw new Error('무한 루프: phase=' + api.st.phase + ' i=' + api.st.i);
    const h = env.getHTML();
    if (/undefined|NaN|\[object Object\]/.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) throw new Error('화면에 undefined/NaN: ' + (h.match(/.{40}(undefined|NaN|\[object Object\]).{40}/) || [''])[0]);
    if (api.st.phase === 'mid') { click('go'); continue; }
    if (api.st.phase !== 'q') throw new Error('예상 못한 phase ' + api.st.phase);
    const L = api.list(), q = L[api.st.i];
    if (!q) throw new Error('질문 없음 i=' + api.st.i);
    if (rnd() < (opts.back || 0) && api.st.i > 0 && !api.st.review) { click('back'); continue; }
    if (q.text) { env.document.getElementById('ta').value = ['테스트 문장','소방관이 되고 싶어요','뭘 해야 할지 모르겠다',''][Math.floor(rnd()*4)]; click('next'); continue; }
    if (!api.st.review && rnd() < (opts.skip || 0)) { skipped++; click('next'); continue; }
    const btns = env.app.querySelectorAll('.opt');
    if (!btns.length) throw new Error('보기 없음 ' + q.id);
    if (q.multi) { const picks = [...new Set([Math.floor(rnd() * btns.length), Math.floor(rnd() * btns.length)])]; const cur = api.st.ans[q.id] || []; for (const j of picks) { if (cur.includes(j)) continue; env.app.querySelectorAll('.opt')[j].onclick(); } if (!(api.st.ans[q.id] || []).length) env.app.querySelectorAll('.opt')[0].onclick(); const got = api.st.ans[q.id] || []; if (q.none != null && got.includes(q.none) && got.length > 1) throw new Error('없음과 다른 보기가 같이 선택됨 ' + q.id); click('next'); }
    else { const b = btns[Math.floor(rnd() * btns.length)]; b.onclick(); while (timers.length) timers.shift()(); }
  }
  const h = env.getHTML();
  const paths = (h.match(/<article class="path/g) || []).length;
  if (paths !== 3) throw new Error('결과 경로 카드 ' + paths + '개');
  if (/undefined|NaN|\[object Object\]/.test(h)) throw new Error('결과 화면에 undefined/NaN: ' + (h.match(/.{50}(undefined|NaN|\[object Object\]).{30}/) || [''])[0]);
  const miss = api.missing().length;
  // 맞춤 준비계획: 입력 화면과 여러 생활 패턴의 결과 화면에 빈 값이 없는지
  if (!h.includes('id="rtGo"') || !h.includes('id="imgRes"')) throw new Error('저장·준비계획 버튼 없음');
  api.st.rt = null; api.st.phase = 'plan'; api.render(); { const ph = env.getHTML(); if (!ph.includes('id="rtMake"')) throw new Error('준비계획 입력 화면 없음'); if (/undefined|NaN|\[object Object\]/.test(ph)) throw new Error('준비계획 입력에 undefined/NaN'); }
  const P0 = (h.match(/data-miss="([a-z]+)"/) || [])[1];
  const pick = a => a[Math.floor(rnd() * a.length)];
  const fix = pick(['yes', 'no', 'shift']), wake = pick([300, 360, 420, 480, 600]), sleep = pick([1260, 1350, 1410, 1440, 1500]);
  api.st.rt = { k: P0, wk: pick([4, 13, 26, 52]), wake, sleep, fix, out: fix === 'yes' ? wake + pick([30, 60, 90]) : null, home: fix === 'yes' ? pick([960, 1080, 1140, 1260]) : null, h: pick([30, 60, 120, 180, 240, 360]) };
  api.st.rtEdit = 0; api.render();
  { const ph = env.getHTML(); if (/undefined|NaN|\[object Object\]/.test(ph)) throw new Error('준비계획에 undefined/NaN: ' + JSON.stringify(api.st.rt) + ' ' + (ph.match(/.{60}(undefined|NaN|\[object Object\]).{30}/) || [''])[0]);
    if (!ph.includes('id="rtImg"') && !ph.includes('id="rtMake"')) throw new Error('준비계획 화면 이상 ' + JSON.stringify(api.st.rt)); }
  api.st.phase = 'result'; api.st.rtEdit = 0;
  api.st.phase = 'cal'; api.render();
  for (let j = 0; j < 14; j++) { const nx = env.document.getElementById(j < 7 ? 'calNext' : 'calPrev'); if (!nx) throw new Error('캘린더 이동 버튼 없음'); nx.onclick(); const ch = env.getHTML(); if (/undefined|NaN|\[object Object\]/.test(ch)) throw new Error('캘린더에 undefined/NaN'); if (!/class="cgrid"/.test(ch)) throw new Error('캘린더 격자 없음'); }
  if (!/막막함에 대한 짧은 답|class="path/.test(h)) throw new Error('결과 화면 구성 이상');
  if (api.st.ans.free && !h.includes('막막함에 대한 짧은 답')) throw new Error('막막함 답 카드 없음');
  if (api.st.ans.goal > 0 && !h.includes('하고 싶은 일 준비 안내')) throw new Error('하고 싶은 일 준비 안내 없음');
  api.st.phase = 'dict'; api.render(); if (/undefined|NaN|\[object Object\]/.test(env.getHTML())) throw new Error('직업백과사전에 undefined/NaN');
  api.st.phase = 'privacy'; api.render();
  api.st.phase = 'all'; api.render(); if (/undefined|NaN|\[object Object\]/.test(env.getHTML())) throw new Error('모아보기에 undefined/NaN');
  if (!env.getHTML().includes('돈 지원')) throw new Error('모아보기에 돈 지원 없음');
  if (miss > 0 && skipped === 0) throw new Error('빈 질문 남음 ' + miss);
  return { steps, skipped, miss };
}
module.exports = { runFlow };
