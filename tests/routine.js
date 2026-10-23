// 맞춤 준비계획 시간표 검사: 모든 기상·취침·일정·공부 시간 조합에서 겹침·빈틈·시간 합계 오류가 없는지
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'pyojigi.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = () => {}; const el = { hidden: false, setAttribute: noop, classList: { add: noop }, querySelectorAll: () => [], contains: () => false };
const document = { getElementById: () => el, createElement: () => ({}), addEventListener: noop };
const api = new Function('document', 'window', 'localStorage', 'setTimeout', script.replace(/\nrender\(\);\s*$/, '') + '\nreturn {routinePlan, rtShift};')(document, { scrollTo: noop }, { getItem: () => null, setItem: noop }, noop);
let n = 0, errs = 0, capped = 0, invalid = 0;
const bad = (m, rt) => { if (errs++ < 5) console.log('  • ' + m + ' ' + JSON.stringify(rt)); };
for (let wake = 240; wake <= 720; wake += 30) for (let sleep = 1200; sleep <= 1620; sleep += 30)
  for (const fix of ['yes', 'no']) for (const h of [30, 60, 120, 180, 240, 360]) {
    const outs = fix === 'yes' ? [] : [[null, null]];
    if (fix === 'yes') for (let out = 240; out <= 1380; out += 90) for (let home = 360; home <= 1560; home += 90) outs.push([out, home]);
    for (const [out, home] of outs) {
      const rt = { wake, sleep, fix, out, home, h }; n++;
      const r = api.routinePlan(rt);
      if (r.err) { invalid++; continue; }
      let t = r.W, study = 0;
      for (const x of r.rows) { if (x.a !== t) { bad(`빈틈/겹침 ${x.t} ${x.a}!=${t}`, rt); break; } if (x.b <= x.a) { bad('길이 0', rt); break; } if (x.kind === 'study') study += x.b - x.a; t = x.b; }
      if (t !== r.S) bad(`끝 시각 ${t}!=${r.S}`, rt);
      if (study !== r.got) bad(`공부 합계 ${study}!=${r.got}`, rt);
      if (r.got > h) bad('목표보다 많음', rt);
      if (r.capped) capped++;
    }
  }
for (const h of [30, 60, 120, 180, 240, 360]) { const s = api.rtShift({ h }); if (!(s.work > 0 && s.off > 0)) bad('교대 계산', { h }); }
console.log(`=== 준비계획 시간표 ${n.toLocaleString()}조합 === 오류 ${errs}건 | 입력 오류 안내 ${invalid} | 시간 부족으로 줄임 ${capped}`);
process.exit(errs ? 1 : 0);
