// '기타' 칸 기록이 검사 1번에 질문마다 정확히 1건만 나가는지 (확인을 여러 번 누르거나 고쳐 적어도, 중간에 나갔다 와도)
// 실행: node tests/etc_once.js
const { makeEnv, script } = require('./dom.js');
let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)); if (!c) bad++; };
function run(mode) {
  const env = makeEnv(); const T = []; const timers = []; let hide = null;
  env.window.addEventListener = (n, f) => { if (n === 'pagehide') hide = f; };
  const s = script.replace('function track(ev){}', 'function track(ev){ __T.push(JSON.parse(JSON.stringify(ev))); }');
  const api = new Function('document', 'window', 'localStorage', 'setTimeout', 'AbortController', '__T', s + '\nreturn {get st(){return st}, list};')(env.document, env.window, env.localStorage, f => timers.push(f), class { constructor() { this.signal = {}; } abort() {} }, T);
  const flush = () => { while (timers.length) timers.shift()(); };
  const click = id => { env.document.getElementById(id).onclick(); flush(); };
  click('start');
  let typed = false, n = 0;
  while (api.st.phase !== 'result' && ++n < 300) {
    if (api.st.phase === 'mid') { click('go'); continue; }
    const q = api.list()[api.st.i];
    if (q.text) { env.document.getElementById('ta').value = ''; click('next'); continue; }
    if (q.id === 'goal' && !typed) {
      typed = true;
      for (const t of ['우주', '우주비행', '우주비행사', '우주비행사']) { env.document.getElementById('etcIn').value = t; env.document.getElementById('etcGo').onclick(); }
      if (mode === 'leave') { hide(); hide(); }
      click('next'); continue;
    }
    const b = env.app.querySelectorAll('.opt');
    if (q.multi) { b[b.length - 1].onclick(); flush(); click('next'); } else { b[0].onclick(); flush(); }
  }
  hide && hide();
  return { T: T.filter(e => e.type === 'etc'), phase: api.st.phase };
}
for (const mode of ['finish', 'leave']) {
  const r = run(mode);
  ok(`${mode}: 결과까지 감`, r.phase === 'result', r.phase);
  ok(`${mode}: etc 정확히 1건`, r.T.length === 1, JSON.stringify(r.T));
  ok(`${mode}: 마지막에 적은 이름`, r.T[0] && r.T[0].t === '우주비행사' && r.T[0].once === true, JSON.stringify(r.T));
}
console.log(bad ? `실패 ${bad}건` : 'ALL PASS');
process.exit(bad ? 1 : 0);
