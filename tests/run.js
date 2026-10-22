// 사용법: node run.js <인원> [화면흐름 검사 인원]
const { M, SITS, randomPersona, check } = require('./logic.js');
const { runFlow } = require('./dom.js');
const N = +process.argv[2] || 1000, FLOWS = +(process.argv[3] || 0);
let seed = +(process.argv[4] || 12345); const rnd = () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);
const errCount = {}, errEx = {}, bySit = {}, top1 = {};
let low = 0, fb = 0, noPro = 0;
for (let i = 0; i < N; i++) {
  const a = randomPersona(rnd);
  const r = check(a);
  const k = SITS[a.sit];
  const b = bySit[k] = bySit[k] || { n: 0, low: 0, fb: 0, top: {} };
  b.n++;
  for (const e of r.errs) { errCount[e] = (errCount[e] || 0) + 1; if (!errEx[e]) errEx[e] = JSON.stringify(a); }
  if (!r.P) continue;
  if (r.low) { low++; b.low++; } if (r.fallback) { fb++; b.fb++; } if (!r.pro) noPro++;
  top1[r.P[0].n] = (top1[r.P[0].n] || 0) + 1; b.top[r.P[0].n] = (b.top[r.P[0].n] || 0) + 1;
}
const pct = (x, n) => (100 * x / n).toFixed(1) + '%';
console.log(`=== 로직 검사 ${N.toLocaleString()}명 ===`);
const errTotal = Object.values(errCount).reduce((a, b) => a + b, 0);
console.log(`오류 ${errTotal}건`);
for (const e in errCount) console.log(`  • ${e}: ${errCount[e]}건  예) ${errEx[e].slice(0, 220)}`);
console.log(`확신 낮음 ${pct(low, N)} | 조건 모두 만족하는 길 없음 ${pct(fb, N)} | 1위에 장점 출처 없음 ${pct(noPro, N)}`);
console.log('상황별:'); for (const k in bySit) { const b = bySit[k]; const t = Object.entries(b.top).sort((x, y) => y[1] - x[1]); console.log(`  ${k.padEnd(6)} ${String(b.n).padStart(7)}명 | 확신낮음 ${pct(b.low, b.n).padStart(6)} | 최다 1위 ${t[0][0]} ${pct(t[0][1], b.n)}`); }
const tops = Object.entries(top1).sort((x, y) => y[1] - x[1]);
console.log('전체 1위 상위 5:', tops.slice(0, 5).map(([n, c]) => `${n} ${pct(c, N)}`).join(', '));
const never = M.PATHS.filter(p => !top1[p.n]).map(p => p.n);
console.log('1위 0회:', never.join(', ') || '없음');
if (FLOWS) {
  let ok = 0; const ferr = {};
  for (let i = 0; i < FLOWS; i++) {
    try { runFlow(rnd, { skip: i % 3 === 0 ? 0.15 : 0, back: i % 4 === 0 ? 0.08 : 0 }); ok++; }
    catch (e) { ferr[e.message] = (ferr[e.message] || 0) + 1; }
  }
  console.log(`=== 화면 흐름 검사 ${FLOWS.toLocaleString()}회 === 통과 ${ok}`);
  for (const e in ferr) console.log(`  • ${e}: ${ferr[e]}회`);
}
