// 접근성 검사: node tests/a11y.js → ALL PASS
// 390px 폰 화면(밝은·어두운 모드)으로 첫 화면 → 질문 → 중간 화면 → 결과 화면까지 실제로 눌러 가며,
// 화면마다 ① 14px 미만 글자 ② 44px 미만 터치 영역 ③ 가로 넘침 ④ 글자 대비 4.5:1(큰 글자 3:1) 미달 ⑤ 이름 없는 버튼·링크·이미지를 센다.
// 장식(aria-hidden)과 문장 속 링크(WCAG 2.5.8 예외)는 세지 않는다. 기준을 넘으면 어디인지 보여 주고 실패.
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '../public/index.html');
const LIMIT = { small: 0, touch: 0, overflow: 0, contrast: 0, noname: 0 };

function audit() {
  const out = { small: [], touch: [], overflow: 0, contrast: [], noname: [] };
  const vis = e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || x.hidden) return false; if (x.getAttribute('aria-hidden') === 'true') return false; if (x !== e && x.getAttribute('role') === 'img') return false; } return true; };
  const rgb = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
  const mix = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const bgOf = e => { const st = []; for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let b = rgb(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]; if (b[3] < 1) b = [255, 255, 255, 1]; for (let i = st.length - 1; i >= 0; i--) b = mix(st[i], b); return b; };
  const opa = e => { let o = 1; for (let x = e; x; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const name = e => (e.className || e.id ? '' : ((x => x ? (x.id ? '#' + x.id : '.' + String(x.className).trim().split(/\s+/)[0]) + '>' : '')(e.parentElement && e.parentElement.closest('[class],[id]')))) + (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '')) + ' "' + (e.textContent || '').trim().slice(0, 18) + '"';
  out.overflow = document.documentElement.scrollWidth > window.innerWidth ? 1 : 0;
  for (const e of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'svg', 'SVG', 'path', 'OPTION'].includes(e.tagName)) continue;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own || !vis(e)) continue;
    const s = getComputedStyle(e), fs = parseFloat(s.fontSize);
    if (fs < 14) out.small.push(name(e) + ' ' + fs + 'px');
    if (e.closest('button:disabled')) continue;
    let f = rgb(s.color); if (!f) continue; const b = bgOf(e); f = mix([f[0], f[1], f[2], f[3] * opa(e)], b);
    const big = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 700);
    const r = ratio(f, b); if (r < (big ? 3 : 4.5)) out.contrast.push(name(e) + ' ' + r.toFixed(2));
  }
  for (const e of document.querySelectorAll('button, a[href], summary, input, select, textarea, [role=button]')) {
    if (!vis(e) && !(e.type === 'checkbox' && e.closest('label') && vis(e.closest('label')))) continue;
    let t = e;
    if (e.matches('input[type=checkbox],input[type=radio]') && e.closest('label')) t = e.closest('label');
    // 문장 속 링크는 예외 (WCAG 2.5.8 inline)
    if (e.tagName === 'A' && getComputedStyle(e).display === 'inline' && e.parentElement && [...e.parentElement.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) { } else {
      const r = t.getBoundingClientRect(); if (r.height < 43.5 || r.width < 43.5) out.touch.push(name(t) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    const nm = (e.getAttribute('aria-label') || e.textContent || e.value || e.placeholder || e.title || (e.labels && e.labels[0] && e.labels[0].textContent) || '').trim();
    if (!nm && !e.getAttribute('aria-labelledby')) out.noname.push(name(e));
  }
  for (const e of document.querySelectorAll('img')) if (!e.hasAttribute('alt')) out.noname.push(name(e));
  return out;
}

(async () => {
  const b = await chromium.launch();
  let bad = 0; const tot = { small: 0, touch: 0, overflow: 0, contrast: 0, noname: 0 };
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(300);
    const shots = [];
    const check = async tag => { const r = await p.evaluate(audit); shots.push([tag, r]); };
    await check('첫 화면');
    await p.click('#ag1'); await p.waitForFunction(() => st.phase === 'q');
    let n = 0, sawMid = 0;
    for (let g = 0; g < 160; g++) {
      const ph = await p.evaluate(() => st.phase);
      if (ph === 'mid') { if (!sawMid++) await check('중간 화면'); await p.click('#go'); continue; }
      if (ph !== 'q') break;
      n++; if (n === 2) await check('질문 화면');
      const key = await p.evaluate(() => st.phase + st.i + JSON.stringify(st.ans).length);
      await p.evaluate(n => {
        const nx = () => document.getElementById('next') && document.getElementById('next').click();
        if (document.getElementById('ta')) return nx();
        const o = [...document.querySelectorAll('#app .opt')].filter(e => e.offsetParent);
        if (!o.length) return nx();
        const multi = !!list()[st.i].multi; o[n % 3 === 0 && o.length > 1 ? 1 : 0].click(); if (multi) nx();
      }, n);
      await p.waitForFunction(k => st.phase + st.i + JSON.stringify(st.ans).length !== k, key, { timeout: 3000 })
        .catch(() => p.evaluate(() => document.getElementById('next') && document.getElementById('next').click()));
      await p.waitForTimeout(30);
    }
    await p.waitForFunction(() => st.phase === 'result'); await p.waitForTimeout(300);
    // 접힌 곳도 펼쳐서 검사
    await p.evaluate(() => document.querySelectorAll('#app details').forEach(d => d.open = true));
    await check('결과 화면');
    await p.click('#menuBtn'); await check('메뉴'); await p.click('#menuBtn');
    for (const [ph, tag] of [['ask', '문의 화면'], ['plan', '준비계획 입력'], ['cal', '캘린더'], ['dict', '직업백과'], ['all', '지원제도'], ['privacy', '개인정보']]) {
      await p.evaluate(ph => { st.phase = ph; render(); document.querySelectorAll('#app details').forEach(d => d.open = true); }, ph); await p.waitForTimeout(50); await check(tag);
    }
    for (const [tag, r] of shots) {
      const line = [];
      for (const k of Object.keys(LIMIT)) { const c = k === 'overflow' ? r[k] : r[k].length; tot[k] += c; if (c > LIMIT[k]) { bad++; line.push(`${k} ${c}: ${(r[k].slice ? r[k].slice(0, 6).join(' | ') : '')}`); } }
      if (line.length) console.log(`[${scheme}] ${tag}\n  ` + line.join('\n  '));
      if (process.env.A11Y_ALL) for (const k of ['small', 'touch', 'contrast']) console.log(`#${scheme} ${tag} ${k}\n` + [...new Set(r[k].map(x => x.replace(/ "[^"]*"/, '')))].join('\n'));
    }
    if (errs.length) { bad++; console.log('페이지 오류', errs); }
    await ctx.close();
  }
  await b.close();
  console.log(`작은 글자 ${tot.small} · 좁은 터치 ${tot.touch} · 가로 넘침 ${tot.overflow} · 대비 미달 ${tot.contrast} · 이름 없음 ${tot.noname}`);
  console.log(bad ? `실패 ${bad}건` : 'ALL PASS');
  process.exit(bad ? 1 : 0);
})();
