// 추천 점수 변경 전후 비교 (운영자 결정 2026-11-03: 점수 변경은 전후 결과를 모의 검사로 비교해 나빠지는 게 없을 때만)
// 사용법: node tests/score_diff.js [기준 git ref=HEAD] [무작위 인원=5000] [보여 줄 예시 수=30]
//   기준(바꾸기 전) = git 의 <ref>:src/pyojigi.html, 바꾼 뒤 = 지금 작업 중인 src/pyojigi.html
//   같은 답을 두 코드에 넣어 1~3순위가 어떻게 바뀌는지 세고, '나빠졌을 수 있는' 경우를 따로 센 뒤, 바뀐 사례를 무작위로 뽑아 보여 준다.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const REF = process.argv[2] || 'HEAD', N = +(process.argv[3] || 5000), SHOW = +(process.argv[4] || 30);

function load(html) {
  const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const core = js.slice(js.indexOf('const CH'), js.indexOf('const app=')).replace(/let st = load\(\)[\s\S]*?\nst\.phase="intro";/, 'let st={ans:{}};');
  return new Function(core + '\nreturn {AGEMAP,Q,PATHS,MAJLINK,MAJORS,setAns:a=>{st={ans:a}},list,tally,score,sitKey,goalKey};')();
}
const before = load(execFileSync('git', ['show', REF + ':src/pyojigi.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }));
const after = load(fs.readFileSync(path.join(ROOT, 'src', 'pyojigi.html'), 'utf8'));
const { randomPersona } = require('./logic.js');

let seed = 20261103; const rnd = () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);

// 페르소나(PERSONAS.md·할 일 목록): 고정 답 + 나머지는 무작위로 채워 여러 변형을 만든다
// 값: 보기 글자의 일부(문자열), 보기 번호(숫자), 여러 개 고르기는 배열
const PERSONAS = [
  ['1 인스타 고2 특성화고', { ag: '10대', sit: '고등학생', h1: '특성화고', h2: '바로 취업', goal: '아직 없다' }],
  ['2 의심 많은 휴학생(경영 22)', { ag: '20대', sit: '대학', major: '경영학', c1: '1~2학년', c2: '그럭저럭', c3: '다른 분야', goal: '아직 없다', inc: '없음' }],
  ['3 지친 재수생', { ag: '20대', sit: '재수', r2: '계속할지', goal: '아직 없다' }],
  ['4 중3', { ag: '10대', sit: '중학생', goal: '아직 없다' }],
  ['5 공대 민준(기계 3학년)', { ag: '20대', sit: '대학', major: '기계·자동차', c2: '잘 맞는다', c3: '전공 살려', goal: '아직 없다', inc: '없음', buffer: '3~6개월', prep: '6개월~1년', learn: '설명서', five: '기술 하나' }],
  ['5b 공대 민준(목표 엔지니어)', { ag: '20대', sit: '대학', major: '기계·자동차', c2: '잘 맞는다', c3: '전공 살려', goal: '공학 엔지니어', inc: '없음', prep: '6개월~1년' }],
  ['6 상병 도현(운전병)', { ag: '20대', sit: '군 복무', mi0: '복무 중', mi1: '의무복무', mi2: '운전', edu: '고졸', goal: '아직 없다' }],
  ['7 디자인 서윤', { ag: '20대', sit: '대학', major: '디자인', c2: '잘 맞는다', c3: '전공 살려', goal: '아직 없다', inc: '없음', prep: '6개월~1년' }],
  ['8 저시력 하은(고졸 19)', { ag: '10대', sit: '취업 준비', edu: '고졸', exp: '없음', goal: '아직 없다' }],
  ['9 자퇴생 지호', { ag: '10대', sit: '학교를 그만뒀다', d2: '빨리 돈', d3: '아직 안 했다', goal: '아직 없다' }],
  ['10 전기과 고3(교사 검증)', { ag: '10대', sit: '고등학생', h1: '특성화고', h2: '바로 취업', goal: '아직 없다', cert: ['딱히 없음'] }],
  ['11 반수 수아(경영 1학년)', { ag: '20대', sit: '대학', major: '경영학', c1: '1~2학년', c2: '그럭저럭', c3: '다른 분야', goal: '아직 없다', inc: '없음', buffer: '6개월 이상' }],
  ['12 공장 태윤(같은 업계)', { ag: '20대', sit: '이직', cur: '생산·제조', edu: '고졸', major: '해당 없음', exp: '1년 미만', m2: '같은 업계', move: '떠날 수 없다', shift: '괜찮다', inc: '250만원 이상', goal: '아직 없다' }],
  ['12b 공장 태윤(교대 불가)', { ag: '20대', sit: '이직', cur: '생산·제조', edu: '고졸', exp: '1년 미만', m2: '업계 자체', shift: '절대', move: '떠날 수 없다', inc: '250만원 이상', goal: '아직 없다' }],
  ['13 실용음악 예린(고3)', { ag: '10대', sit: '고등학생', h1: '일반고', h2: '모르겠다', goal: '문화예술', prep: 2 }],
  ['14 배달 서진', { ag: '20대', sit: '취업 준비', cur: '물류', edu: '고졸', inc: '250만원 이상', goal: '아직 없다' }],
  ['15 간호학과 지수(안 맞음)', { ag: '20대', sit: '대학', major: '간호학', c2: '안 맞는다', c3: '다른 분야', goal: '아직 없다', inc: '없음' }],
  ['15b 간호학과 지수(공무원)', { ag: '20대', sit: '대학', major: '간호학', c2: '안 맞는다', c3: '공무원', goal: '아직 없다' }],
  ['16 게임 건우(고2)', { ag: '10대', sit: '고등학생', h1: '일반고', h2: '모르겠다', goal: 'IT', prep: 2, sit8: 0 }],
  ['17 조리과 다경(밤엔 자야)', { ag: '10대', sit: '고등학생', h1: '특성화고', h2: '바로 취업', goal: '요리', shift: '밤엔 자야', cert: ['한식'] }],
  ['17b 조리과 다경(목표 없음)', { ag: '10대', sit: '고등학생', h1: '특성화고', h2: '모르겠다', goal: '아직 없다', cert: ['한식'] }],
  ['18 전자과 4년제 졸업', { ag: '20대', sit: '취업 준비', edu: '4년제', major: '전자·전기', goal: '아직 없다' }],
];
const VARIANTS = 40;

function optIdx(q, v) {
  const os = q.o.map(o => o[0]);
  if (typeof v === 'number') return v;
  let i = q.o.findIndex(o => String(o[0]).includes(v));
  if (i < 0 && q.oy) i = q.oy.findIndex(o => o && String(o).includes(v));
  if (i < 0) throw new Error(`페르소나 보기 못 찾음: ${q.id} '${v}' (${os.join(' / ')})`);
  return i;
}
function personaAnswers(spec, M) {
  const a = {};
  // 목록 순서대로: spec 에 있으면 그 답, 없으면 무작위
  M.setAns(a);
  for (let guard = 0; guard < 200; guard++) {
    const q = M.list().find(q => !(q.id in a));
    if (!q) break;
    if (q.id in spec) { a[q.id] = q.multi ? [].concat(spec[q.id]).map(v => optIdx(q, v)) : optIdx(q, spec[q.id]); if (q.id === 'ag') a.age = M.AGEMAP[a.ag]; continue; }
    if (q.text) { a[q.id] = ''; continue; }
    if (q.multi) { const n = 1 + Math.floor(rnd() * 3), s = new Set(); for (let i = 0; i < n; i++) s.add(Math.floor(rnd() * q.o.length)); let arr = [...s]; if (q.none != null && arr.includes(q.none)) arr = [q.none]; a[q.id] = arr; continue; }
    a[q.id] = Math.floor(rnd() * q.o.length);
  }
  // 상황과 모순되는 기본 답 정리 (tests/logic.js randomPersona 와 같은 규칙)
  M.setAns(a); const k = M.sitKey();
  if (k === 'col') { a.edu = 5; if (a.exp != null) a.exp = Math.min(a.exp, 1); }
  if (a.edu === 4) a.edu = 0;
  if (k !== 'col' && a.edu === 5) a.edu = 2;
  return a;
}

function run(M, a) { M.setAns(JSON.parse(JSON.stringify(a))); const R = M.score(); const { f } = M.tally(); return { R, f, k: M.sitKey(), g: M.goalKey(f) }; }
const WANTK = { pub: ['pub', 'pbc'], it: ['it'], tec: ['tec', 'aut', 'bld', 'eng', 'rail', 'avi'], ppl: ['car', 'edu', 'spo', 'kid', 'svc', 'hcl', 'tch', 'nur', 'mtc'], sal: ['sal', 'bop', 'own', 'rea'], art: ['mkt', 'bty'], uni: ['uni'] };

// 나빠졌을 수 있는 것: 원하는 길·직접 고른 분야·전공 길·지금 경력 길이 3위 밖으로, 싫다고 한 조건(위반)이 있는 길이 새로 3위 안에
function worse(b, a, ans) {
  const out = [], b3 = b.R.slice(0, 3), a3 = a.R.slice(0, 3), bk = b3.map(p => p.key), ak = a3.map(p => p.key), f = a.f;
  if (a.g && bk.includes(a.g) && !ak.includes(a.g)) out.push('하고 싶은 일이 3위 밖으로');
  if (f.want && bk.some(x => WANTK[f.want].includes(x)) && !ak.some(x => WANTK[f.want].includes(x))) out.push('직접 고른 분야가 3위 밖으로');
  const ml = after.MAJLINK[f.mj] || [];
  if (ml.length && f.majfit !== -1 && ans.c3 !== 1 && bk.some(x => ml.includes(x)) && !ak.some(x => ml.includes(x))) out.push('전공 길이 3위 밖으로');
  if (f.cur && a.k === 'move' && f.same && bk.includes(f.cur) && !ak.includes(f.cur)) out.push('같은 업계 원하는데 지금 경력 길이 3위 밖으로');
  if (a3.some(p => p.v.length) && !b3.some(p => p.v.length)) out.push('싫다고 한 조건에 걸린 길이 새로 3위 안에');
  if (a3.some(p => p.s <= -9999)) out.push('제외된 길이 3위 안에');
  return out;
}

const SITN = { job: '취업준비', move: '이직', gap: '쉬는중', slump: '슬럼프', switch: '전환', mil: '군', hs: '고등학생', col: '대학생', ms: '중학생', drop: '학교밖', retake: '재수' };
function brief(M, a) {
  const pick = id => { const q = M.Q.find(q => q.id === id); if (!q || a[id] == null) return null; const v = [].concat(a[id]).map(i => q.o[i] && String(q.o[i][0]).replace(/\s*\(.*?\)/g, '').slice(0, 14)); return `${id}=${v.join('+')}`; };
  return ['ag', 'edu', 'major', 'cur', 'goal', 'inc', 'buffer', 'prep', 'shift', 'move', 'h1', 'h2', 'c1', 'c2', 'c3', 'm2', 'w1', 'd2', 'mi2'].map(pick).filter(Boolean).join(' · ');
}

if (process.env.SHOW_PERSONAS) { for (const [name, spec] of PERSONAS) { const a = personaAnswers(spec, after); const r = run(after, a); console.log(`${name} · ${SITN[r.k]} · ${brief(after, a)}\n   지금: ${r.R.slice(0, 3).map(p => p.n).join(' > ')}`); } process.exit(0); }
const cases = [];
for (let i = 0; i < N; i++) cases.push({ who: '무작위', a: randomPersona(rnd) });
for (const [name, spec] of PERSONAS) for (let v = 0; v < VARIANTS; v++) cases.push({ who: name, a: personaAnswers(spec, after) });

let ch1 = 0, chSet = 0, chOrder = 0; const wc = {}, changed = [], perP = {};
for (const c of cases) {
  const b = run(before, c.a), a = run(after, c.a);
  const bk = b.R.slice(0, 3).map(p => p.key), ak = a.R.slice(0, 3).map(p => p.key);
  const pp = perP[c.who] = perP[c.who] || { n: 0, ch: 0, w: 0, ex: null };
  pp.n++;
  if (bk.join() === ak.join()) continue;
  pp.ch++;
  if (bk[0] !== ak[0]) ch1++;
  if ([...bk].sort().join() !== [...ak].sort().join()) chSet++; else chOrder++;
  const w = worse(b, a, c.a); for (const x of w) wc[x] = (wc[x] || 0) + 1; if (w.length) pp.w++;
  const row = { c, b, a, w, k: a.k }; changed.push(row); if (!pp.ex) pp.ex = row;
}
const T = cases.length, pct = x => (100 * x / T).toFixed(2) + '%';
console.log(`=== 점수 전후 비교: 기준 ${REF} → 지금 src | 무작위 ${N}명 + 페르소나 ${PERSONAS.length}종×${VARIANTS} = ${T}명 ===`);
console.log(`1~3순위가 달라짐 ${changed.length}명 (${pct(changed.length)}) | 1순위 바뀜 ${ch1} (${pct(ch1)}) | 3개 구성 바뀜 ${chSet} (${pct(chSet)}) | 순서만 바뀜 ${chOrder}`);
console.log('나빠졌을 수 있는 경우:', Object.keys(wc).length ? Object.entries(wc).map(([k, v]) => `${k} ${v}명`).join(', ') : '0건');
console.log('\n페르소나별 (바뀐 수/전체, 나빠짐 의심):');
for (const [name] of PERSONAS) { const p = perP[name]; console.log(`  ${name.padEnd(22)} ${p.ch}/${p.n}${p.w ? '  ⚠ ' + p.w : ''}`); }
const fmt = (R, n = 3) => R.slice(0, n).map(p => `${p.n.replace(/\s*\(.*?\)/g, '')}(${p.s}${p.v.length ? ',✗' + p.v.join('/') : ''})`).join(' > ');
function show(row, i) {
  const { c, b, a, w } = row;
  console.log(`\n[${i}] ${c.who} · ${SITN[row.k] || row.k} · ${brief(after, c.a)}`);
  console.log(`   전: ${fmt(b.R)}`);
  console.log(`   후: ${fmt(a.R)}`);
  const nk = a.R.slice(0, 3).filter(p => !b.R.slice(0, 3).some(q => q.key === p.key));
  for (const p of nk) console.log(`   + ${p.n.replace(/\s*\(.*?\)/g, '')}: ${p.note ? p.note + ' · ' : ''}맞는 이유 ${p.why.join(', ') || '-'}`);
  if (w.length) console.log(`   ⚠ ${w.join(', ')}`);
}
const bad = changed.filter(r => r.w.length);
if (bad.length) { console.log(`\n--- 나빠짐 의심 사례 (최대 ${SHOW}개) ---`); bad.slice(0, SHOW).forEach((r, i) => show(r, i + 1)); }
// 바뀐 사례 중 무작위 SHOW 개 (고정 씨앗이라 매번 같은 사례)
const pool = changed.filter(r => !r.w.length); let s2 = 7; const r2 = () => (s2 = (s2 * 16807) % 2147483647, (s2 - 1) / 2147483646);
for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r2() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
console.log(`\n--- 바뀐 사례 무작위 ${Math.min(SHOW, pool.length)}개 ---`);
pool.slice(0, SHOW).forEach((r, i) => show(r, i + 1));
