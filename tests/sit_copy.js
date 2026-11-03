// 상황별 결과 문구 검사: 상황마다 결과 화면을 실제로 그려서, 그 상황에 나오면 안 되는 말이 0건인지 본다.
// (고등학생에게 '사표'·'퇴근 후'·'9개월째 첫 월급', 대학생에게 '합격 통보 받은 뒤 사표', 재직자에게 '돈이 급하면' 같은 지적이 다시 안 나오게)
// 사용법: node tests/sit_copy.js [상황마다 인원, 기본 300]
const { M, SITS, randomPersona } = require('./logic.js');
const { makeEnv, script } = require('./dom.js');
const N = +process.argv[2] || 300;
let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);
// 한 줄 고민에 자주 오는 말 (상황 문구를 부르는 말 위주)
const FREE = ['', '', '퇴사하고 싶은데 무서워요', '돈을 빨리 벌고 싶어요', '월급이 너무 적어요', '그만두고 싶어요', '뭘 해야 할지 모르겠어요', '학교 그만두고 싶어요', '전공이 안 맞아요', '게임 개발자 되고 싶어요'];

const env = makeEnv(); const timers = [];
const api = new Function('document', 'window', 'localStorage', 'setTimeout', 'AbortController',
  script + '\nreturn {get st(){return st}, set st(v){st=v}, render, tally, employed, sitKey, calcDraw};')(env.document, env.window, env.localStorage, f => timers.push(f), class { constructor() { this.signal = {}; } abort() {} });

function show(a) {
  api.st = { ans: a, i: 0, phase: 'result', mid: -1, done: 1, doneAt: Date.now(), did: 0, agree: 1 };
  api.render(); while (timers.length) timers.shift()();
  const h0 = env.getHTML(), rk = h0.match(/id="rc_k" value="([a-z]+)"/);
  if (rk) { env.document.getElementById('rc_k').value = rk[1]; api.calcDraw(); }
  const plan = env.document.getElementById('rc_plan');
  return env.getHTML() + (plan && plan.innerHTML ? plan.innerHTML : '');
}
const text = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');

// 상황별로 나오면 안 되는 말 [말(정규식), 설명]
const STU = [[/사표/, '사표'], [/퇴근 후/, '퇴근 후'], [/경력이 있다면/, '경력이 있다면'], [/회사 안에서/, '회사 안에서'], [/합격 통보/, '합격 통보'], [/내 군 경력/, '군 경력(군인 아님)'], [/내 경력과 대조/, '내 경력과 대조'], [/지금 일이나 생활에서/, '지금 일이나 생활에서']];
const BAN = {
  ms: [...STU, [/개월째 · 약/, '첫 월급 개월째'], [/첫 월급까지/, '첫 월급까지'], [/link\.coupang|inf\.run/, '제휴 링크']],
  hs: [...STU, [/먼저 일하면서/, '먼저 일하면서'], [/link\.coupang|inf\.run/, '제휴 링크'], [/국비 과정 찾아 내일배움카드로 등록/, '1주차 내일배움카드'], [/관련 채용공고 보기/, '채용공고 링크(학생)'], [/청년미래적금/, '성인용 적금 예시']],
  col: [...STU, [/먼저 일하면서/, '먼저 일하면서']],
  retake: [...STU, [/먼저 일하면서/, '먼저 일하면서']],
  drop: [...STU, [/link\.coupang|inf\.run/, '제휴 링크']],
  move: [[/돈이 급하면/, '돈이 급하면(재직자)']],
  slump: [[/돈이 급하면/, '돈이 급하면(재직자)']],
};
const errs = {}, ex = {}; let n = 0, cpn = 0;
const bad = (k, why, a, h) => { const key = k + ' · ' + why; errs[key] = (errs[key] || 0) + 1; if (!ex[key]) ex[key] = JSON.stringify(a).slice(0, 200) + (h ? '\n      …' + h : ''); };
for (let si = 0; si < SITS.length; si++) {
  const k = SITS[si];
  for (let i = 0; i < N; i++) {
    const a = randomPersona(rnd, si); a.free = FREE[i % FREE.length];
    let h; try { h = show(a); } catch (e) { bad(k, '예외 ' + e.message, a); continue; }
    n++;
    const tx = text(h); M.setAns(a); const { t, f } = M.tally(); const emp = M.employed(f);
    // '맞는 이유'의 성장 지향은 나이·상황 보기 점수만으로 붙지 않는다 (고2 건우: 10대 +1 로 '성장 지향')
    { const tw = { ...t }; for (const id of ['ag', 'sit']) { const q = M.Q.find(x => x.id === id), o = q && a[id] != null && q.o[a[id]]; if (o) for (const x in o[1]) tw[x] = (tw[x] || 0) - o[1][x]; }
      if ((tw.growth || 0) < 2) { const m = h.match(/맞는 이유: [^<]*성장 지향/); if (m) bad(k, '나이·상황 점수만으로 성장 지향', a, m[0]); } }
    const rules = (BAN[k] || []).filter(r => (!(k === 'move' || k === 'slump') || emp) && !(f.cur === 'mil' && r[1].startsWith('군 경력')));
    if ((k === 'switch' || k === 'mil') && emp) rules.push([/돈이 급하면/, '돈이 급하면(재직자)']);
    // 배달·대리·프리랜서(plat)·입대 앞둠(enl)·복무 중: 직장인 문구 대신 지금 일 유지·전역 뒤 기준 (배달 라이더 서진·상병 도현)
    const SF = M.Q.find(q => q.id === 'sit').o[a.sit][2] || {}, svc = k === 'mil' && f.inSvc;
    if (SF.plat) rules.push([/퇴근 후나 휴무일/, '퇴근 후나 휴무일(플랫폼 일)'], [/사표/, '사표(플랫폼 일)'], [/다니면서/, '다니면서(플랫폼 일)'], [/먼저 일하면서/, '먼저 일하면서(플랫폼 일)'], [/회사 안에서/, '회사 안에서(플랫폼 일)']);
    if (SF.enl) rules.push([/퇴근 후나 휴무일/, '퇴근 후나 휴무일(입대 앞둠)'], [/사표/, '사표(입대 앞둠)'], [/먼저 일하면서/, '먼저 일하면서(입대 앞둠)'], [/첫 월급\s+\d+개월째/, '전역 뒤 없이 첫 월급 개월째(입대 앞둠)']);
    if (svc) rules.push([/먼저 일하면서/, '먼저 일하면서(복무 중)'], [/첫 월급\s+\d+개월째/, '전역 뒤 없이 첫 월급 개월째(복무 중)']);
    // 예체능 입시 방향 바꿈(artq): 문화예술·교육 카드에 입시 경험 한 줄 (실용음악 고3 예린)
    if (f.artq) for (const x of (h.match(/<article class="path[^"]*" id="path-\d">[\s\S]*?<\/article>/g) || [])) if (/<h2>(문화예술|교육·강사)/.test(x) && !/예체능 입시 경험/.test(x)) bad(k, '예체능 입시 경험 한 줄 없음(art·edu 카드)', a);
    if (!f.artq && /예체능 입시 경험<\/b>/.test(h)) bad(k, '예체능 입시 경험(artq 아님)', a);
    if (k === 'col' && !f.senior) rules.push([/개월째 · 약/, '첫 월급 개월째(졸업반 아님)']);
    if (k === 'hs' && f.go !== 'hsj') rules.push([/개월째 · 약/, '첫 월급 개월째(취업 아님)']);
    if (a.ag === 0) rules.push([/link\.coupang|inf\.run/, '제휴 링크(10대)'], [/>교대 가능</, '교대 가능 태그(10대)']);
    rules.push([/data-go="money">(돈 지원|받을 수 있는 돈) 0개/, '돈 지원 0개 버튼']);
    for (const [re, why] of rules) { const src = /data-go|>교대|link\.|inf\./.test(re.source) ? h : tx; const m = src.match(re); if (m) bad(k, why, a, src.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, ' ')); }
    // 모든 상황: 쿠팡 링크가 있으면 대가성 문구가 반드시 같이 (법적 표시)
    if (/link\.coupang/.test(h)) cpn++;
    if (/link\.coupang/.test(h) && !h.includes('쿠팡 파트너스 활동의 일환으로')) bad(k, '쿠팡 링크인데 대가성 문구 없음', a);
    if (/inf\.run/.test(h) && !h.includes('운영자가 수수료를 받아요')) bad(k, '제휴 강의인데 제휴 표시 없음', a);
    if (/undefined|NaN|\[object Object\]/.test(tx)) bad(k, '화면에 undefined/NaN', a);
  }
}
function YK(k) { return ['hs', 'ms', 'drop', 'retake'].includes(k); }
// 페르소나 지적을 그대로 재현하는 고정 사례: [이름, 상황 번호, 덮어쓸 답, 나오면 안 되는 말, 꼭 나와야 하는 말]
const idx = (id, test) => M.Q.find(q => q.id === id).o.findIndex(test);
const COOK = idx('cert', o => /조리기능사/.test(o[0])), GCKG = idx('goal', o => o[2] && o[2].goal === 'ckg'), GIT = idx('goal', o => o[2] && o[2].goal === 'it'), GTEC = idx('goal', o => o[2] && o[2].goal === 'tec');
const FIX = [
  ['조리기능사 가진 20대 취준생(가진 자격 교재·조리학원 안내 금지)', 0, { ag: 1, age: 2, cert: [COOK], goal: GCKG }, [/박문각 한식조리기능사/, /집 근처 조리학원/, /조리학원·국비 과정 등록/], [/두 번째/]],
  ['조리과 고3 다경(조리기능사·요리 목표·바로 취업)', 6, { ag: 0, age: 0, h1: 1, h2: 1, cert: [COOK], goal: GCKG }, [/조리학원/, /link\.coupang/], []],
  ['게임 개발 고2 건우(일반고·진학 모름·IT 목표)', 6, { ag: 0, age: 0, h1: 0, h2: 3, goal: GIT }, [/개월째 · 약/, /K-디지털/, /먼저 일하면서/, /link\.coupang|inf\.run/], [/정보처리기능사/, /졸업 전에 해 볼 것/]],
  ['특성화고 전기 고3(취업)', 6, { ag: 0, age: 0, h1: 1, h2: 1, goal: GTEC }, [/국비 과정 찾아 내일배움카드로 등록/, /내일배움카드 국비 과정 하나를 찜/], [/학교/]],
  // 고3 9월 이후엔 '3학년 1학기부터 공고' 대신 졸업 전 남은 기간 기준, '공고 목록 요청' 대신 지금 열린 공고 확인 (다경)
  ['조리과 고3 다경(3학년·바로 취업)', 6, { ag: 0, age: 0, h0: 2, h1: 1, h2: 1, cert: [COOK], goal: GCKG }, new Date().getMonth() >= 8 ? [/3학년 1학기부터 공고/, /공고 목록을 요청/] : [/공고 목록을 요청/], new Date().getMonth() >= 8 ? [/졸업 전 남은 기간/, /하이파이브/] : []],
  // 학교 밖 청소년 첫 월급 카드에 지금 버는 돈 구간과 비교한 한 줄 (자퇴생 지호)
  ['자퇴생 지호(알바 월 50~100만원)', 9, { ag: 0, age: 0, d4: 2 }, [/지금 버는 돈\(한 달 100/], [/지금 버는 돈\(한 달 50~100만원\)과 비교하면[^.]*최대 약 [\d,]+만원/]],
  ['자퇴생(알바 안 함)', 9, { ag: 0, age: 0, d4: 0 }, [/지금 버는 돈\(/], []],
  ['실용음악 고3 예린(예체능 입시 방향 바꿈·문화예술 목표)', 6, { ag: 0, age: 0, h0: 2, h1: 0, h2: 4, goal: idx('goal', o => o[2] && o[2].goal === 'art') }, [], [/예체능 입시 경험<\/b>/]],
  ['전공 안 맞는 간호학과 2학년 지수', 7, { ag: 1, age: 2, c1: 0, c2: 2, c3: 1, mj: undefined }, [/합격 통보/, /개월째 · 약/], [/major-mismatch\.html/]],
];
for (const [name, si, ov, no, must] of FIX) {
  for (let i = 0; i < 20; i++) {
    const a = randomPersona(rnd, si); Object.assign(a, ov); a.free = FREE[i % FREE.length];
    const h = show(a), tx = text(h); n++;
    for (const re of no) { const m = (re.source.includes('link') ? h : tx).match(re); if (m) bad('고정', name + ' · 금지 ' + re.source, a); }
    for (const re of must) if (!re.test(h)) bad('고정', name + ' · 없음 ' + re.source, a);
  }
}
const total = Object.values(errs).reduce((x, y) => x + y, 0);
console.log(`=== 상황별 결과 문구 검사 ${n}명 (상황마다 ${N}명) ===`);
console.log(`오류 ${total}건 (쿠팡 교재 링크가 나온 결과 ${cpn}건, 모두 대가성 문구 확인)`);
for (const e in errs) console.log(`  • ${e}: ${errs[e]}건  예) ${ex[e]}`);
if (total) process.exitCode = 1;
