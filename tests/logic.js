// 추천 로직만 떼어내 빠르게 대량 검사한다.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','src','pyojigi.html'), 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const core = js.slice(js.indexOf('const CH'), js.indexOf('const app=')).replace(/let st = load\(\)[\s\S]*?\nst\.phase="intro";/, 'let st={ans:{}};');
const rea = js.slice(js.indexOf('function msReality'), js.indexOf('function salBar'));
const sup = js.slice(js.indexOf('// 직무별 장점'), js.indexOf('const ymd='));
const prepTxt = js.match(/function prepTxt[^\n]*/)[0];
const M = new Function(core + rea + sup + prepTxt + '\nreturn {LIC,JOBD:typeof JOBD!=="undefined"?JOBD:null,ROAD:typeof ROAD!=="undefined"?ROAD:null,AIX:typeof AIX!=="undefined"?AIX:null,AIXT:typeof AIXT!=="undefined"?AIXT:null,SITVIS,AGEMAP,ENG_MJ,MAJLINK,MAJORS,Q,PATHS,PRO,YTQ,TRAIT,GUIDE,JOBS,CAL,WAITING,setAns:a=>{st={ans:a}},list,tally,score,lowConf,reality,supports,corpSupports,sitKey,employed,freeAnswer,freeGoal,goalKey,guideKey,runCalc};')();

const SITQ = M.Q.find(q => q.id === 'sit'); const SITS = SITQ.o.map(o => o[2].sit);
const SENT = ['경비 일은 안정적인데 이대로 10년 갈 수 있을지 모르겠다','소방관이 되고 싶은데 나이가 걱정돼요','공무원은 싫고 돈을 많이 벌고 싶다','개발자로 전향하고 싶어요','뭘 해야 할지 모르겠어요','면접에서 계속 떨어져요','부모님 눈치가 보여요','생활비가 한 달밖에 안 남았어요','환경미화원 준비 중이에요','요양보호사 따서 일하고 싶어요','무기력해서 아무것도 하기 싫어요','교대 근무라 공부할 시간이 없어요','죽고 싶을 만큼 힘들어요','스펙이 하나도 없어요','대학원 진학할지 취업할지 고민','반도체 공장 들어가고 싶어요','영업은 말고 사무직 원해요','ㅁㄴㅇㄹ','<script>alert(1)</script>','30대인데 너무 늦은 것 같아요','AI 쪽으로 가고 싶은 꿈이 있어요','태권도 사범으로 가고 싶다','퇴사하고 싶은데 무서워요','그냥 다 귀찮다'];
for (const p of M.PATHS) { if (!M.GUIDE[p.key]) throw new Error('준비 안내 없음 ' + p.key); if (!M.JOBS[p.key]) throw new Error('세부 직업 없음 ' + p.key); if (!M.YTQ[p.key]) throw new Error('영상 검색어 없음 ' + p.key); }
function randomPersona(rnd, forceSit) {
  const a = {};
  a.sit = forceSit != null ? forceSit : Math.floor(rnd() * SITS.length);
  const ags = [0, 1, 2, 3].filter(g => M.SITVIS[g].includes(a.sit));
  a.ag = ags[Math.floor(rnd() * ags.length)]; a.age = M.AGEMAP[a.ag];
  M.setAns(a);
  for (let guard = 0; guard < 200; guard++) {
    const q = M.list().find(q => q.id !== 'sit' && q.id !== 'ag' && !(q.id in a));
    if (!q) break;
    if (q.text) { a[q.id] = rnd() < 0.6 ? SENT[Math.floor(rnd() * SENT.length)] : ''; continue; }
    if (q.multi) { const n = 1 + Math.floor(rnd() * 3); const set = new Set(); for (let i = 0; i < n; i++) set.add(Math.floor(rnd() * q.o.length)); let arr = [...set]; if (q.none != null && arr.includes(q.none)) arr = [q.none]; a[q.id] = arr; continue; }
    // 하고 싶은 일은 절반은 '아직 없다'
    if (q.id === 'goal' && rnd() < 0.5) { a[q.id] = 0; continue; }
    a[q.id] = Math.floor(rnd() * q.o.length);
  }
  // 상황과 모순되는 기본 답 정리 (고등학생은 10대·고교 재학 등)
  const k = SITS[a.sit];
  if (k === 'col') { a.edu = 5; a.exp = Math.min(a.exp, 1); }
  if (a.edu === 4) a.edu = 0;
  if (k !== 'col' && a.edu === 5) a.edu = 2;
  return a;
}

function check(a) {
  const errs = [];
  M.setAns(a);
  let t, f, P, real, sp;
  try { ({ t, f } = M.tally()); P = M.score(); real = M.reality(f, t, P); sp = M.supports(f, P); }
  catch (e) { return { errs: ['예외: ' + e.message], P: null }; }
  const k = M.sitKey(), top = P[0], top3 = P.slice(0, 3);
  if (P.some(p => Number.isNaN(p.s))) errs.push('점수 NaN');
  if (top3.some(p => p.s <= -9999)) errs.push('제외된 경로가 상위 3위 안에 나옴');
  if (top.v.length && P.some(p => p.s > -9999 && !p.v.length)) errs.push('조건 맞는 경로가 있는데 위반 경로가 1위');
  const leaving = k === 'switch' || (k === 'move' && !f.same) || (k === 'slump' && f.sl === 'work') || (k === 'gap' && f.gw === 'fit');
  const strongLeave = k === 'switch' || f.mv === 'fit' || f.sl === 'work' || f.gw === 'fit';
  if (strongLeave && f.cur === top.key && M.goalKey(f) !== top.key) errs.push('떠나려는 현재 직무가 1위');
  const FAM = { sec: ['avs'], avs: ['sec'], pub: ['pbc'], pbc: ['pub'] };
  if (strongLeave && f.cur && top3.some(p => (FAM[f.cur] || []).includes(p.key) && M.goalKey(f) !== p.key)) errs.push('떠나려는 직무와 같은 계열이 상위 3위');
  if (top3.some(p => p.key === 'mlc') && !(k === 'mil' || f.cur === 'mil')) errs.push('군 경험 없는데 직업군인 경로');
  if (k === 'hs' && top3.some(p => ['sal', 'bop', 'own', 'pln', 'pbc', 'rea'].includes(p.key))) errs.push('고등학생에게 부적합 경로');
  if (top3.some(p => p.key === 'eng') && !(f.c_eng || k === 'ms' || (M.ENG_MJ.includes(f.mj) && (k === 'col' || [1, 2, 3].includes(a.edu))) || M.goalKey(f) === 'eng')) errs.push('공학 전공 없이 엔지니어');
  if (top3.some(p => p.key === 'ath') && !(M.goalKey(f) === 'ath' || f.hsT === 'pe' || ((f.maj === 'spo' || f.c_sport) && a.age <= 3))) errs.push('선수 경력 없이 운동선수');
  if (top3.some(p => p.key === 'mtc') && !(f.c_mtc || ['hs','ms','drop','retake'].includes(k) || f.mj === 'allied' || M.goalKey(f) === 'mtc')) errs.push('보건 학과 경로 없이 보건의료 기사');
  if ((!['hs','col','drop','retake'].includes(k) && top3.some(p => p.key === 'adv')) || (!['hs','drop'].includes(k) && top3.some(p => p.key === 'hsj'))) errs.push('학생 전용 경로가 비학생에게');
  if (k === 'col' && top3.some(p => p.key === 'hsj')) errs.push('대학생에게 고졸 경로');
  if (k === 'hs' && f.go === 'adv' && !top3.some(p => p.key === 'adv')) errs.push('진학 원하는 고등학생에게 진학 경로 없음');
  if (k === 'hs' && f.go === 'hsj' && !top3.some(p => p.key === 'hsj')) errs.push('취업 원하는 고등학생에게 고졸 취업 경로 없음');
  if (k === 'col' && f.grad && !top3.some(p => p.key === 'adv')) errs.push('대학원 원하는 대학생에게 진학 경로 없음');
  if (top3.some(p => p.key === 'bop') && !(['sal','off','log','fac'].includes(f.cur)) && f.want !== 'sal') errs.push('경력 없는 사람에게 경력직 경로');
  if (top3.some(p => p.key === 'hcl') && !(f.c_hcl || f.mj === 'nurse' || f.mj === 'allied')) errs.push('면허 없이 보건·의료직');
  if (k === 'hs' && real.some(x => /생활비가|버틸 수 있는 기간/.test(x))) errs.push('고등학생에게 생활비 문구');
  if (top3.some(p => p.key === 'spo') && !(f.maj === 'spo' || f.c_sport || f.p_spo || M.goalKey(f) === 'spo' || (t.body || 0) >= 5)) errs.push('체육 배경 없이 체육');
  if (top3.some(p => !M.YTQ[p.key])) errs.push('영상 검색어 없음');
  if (['job', 'col', 'hs', 'switch'].includes(k) && top3.some(p => ['off', 'it'].includes(p.key)) && !real.some(x => x.startsWith('한국은행 분석'))) errs.push('AI 영향 높은 길인데 현실 점검 문구 없음');
  if (top3.some(p => !p.n || !p.first || !p.try || !p.need)) errs.push('경로 문구 빠짐');
  if ((k === 'hs') && sp.some(x => x.n === '국민내일배움카드')) errs.push('고등학생에게 내일배움카드');
  if (new Set(real).size !== real.length) errs.push('현실 점검 문구 중복');
  if (new Set(sp.map(x => x.n)).size !== sp.length) errs.push('지원제도 중복');
  if (!sp.length) errs.push('지원제도 0개');
  if (k === 'mil' && f.spec === 'eod' && !top3.some(p => p.key === 'avs') && !f.noShift) errs.push('폭발물 경력인데 공항보안 상위 3위 밖');
  const WN = { pub: ['pub', 'pbc'], it: ['it'], tec: ['tec', 'aut', 'bld', 'eng', 'rail', 'avi'], ppl: ['car', 'edu', 'spo', 'kid', 'svc', 'hcl', 'tch', 'nur', 'mtc'], sal: ['sal', 'bop', 'own', 'rea'], art: ['mkt', 'bty'], uni: ['uni'] };
  if (f.want) { const ws = P.filter(p => WN[f.want].includes(p.key)); const valid = ws.filter(p => p.s > -9999 && !p.v.length);
    const inTop = top3.some(p => WN[f.want].includes(p.key));
    if (valid.length && !inTop) errs.push('직접 고른 희망 분야(가능한데도) 상위 3위 밖');
    if (!inTop && !real.some(x => x.startsWith('직접 고르신 분야'))) errs.push('희망 분야를 뺀 이유 설명 없음'); }
  if (top3.some(p => p.key === 'tch') && !(f.c_tch || ['hs','ms','drop','retake'].includes(k) || k === 'col' || a.edu === 2 || a.edu === 3 || M.goalKey(f) === 'tch')) errs.push('교원자격 경로 없는 사람에게 교사');
  if (top3.some(p => p.key === 'nur') && !(f.c_nur || ['hs','ms','drop','retake'].includes(k) || f.mj === 'nurse' || M.goalKey(f) === 'nur')) errs.push('간호 경로 없는 사람에게 간호사');
  const g = M.goalKey(f);
  if (g) { const gp = P.find(p => p.key === g); const valid = gp && gp.s > -9999 && !gp.v.length; const inTop = top3.some(p => p.key === g);
    if (!gp) errs.push('하고 싶은 일 경로 없음');
    if (valid && !inTop) errs.push('하고 싶은 일(가능한데도) 상위 3위 밖');
    if (!inTop && !real.some(x => x.startsWith('하고 싶다고 고른'))) errs.push('하고 싶은 일을 뺀 이유 설명 없음'); }
  const gk = M.guideKey(f); if (gk && !M.GUIDE[gk]) errs.push('준비 안내 없음');
  if (a.free) { const fa = M.freeAnswer(a.free); if (!fa.length || fa.length > 3) errs.push('막막함 답 개수 이상');
    if (/죽고/.test(a.free) && !fa[0].includes('109')) errs.push('위기 문장에 상담 안내가 맨 앞에 없음');
    if (/싫|말고/.test(a.free) && M.freeGoal(a.free)) errs.push('싫다는 분야를 하고 싶은 일로 오인'); }
  if (k === 'hs' && sp.some(x => x.corp)) errs.push('고등학생에게 기업 프로그램');
  if (sp.some(x => /^SSAFY/.test(x.n)) && (a.age > 3 || M.employed(f))) errs.push('SSAFY 조건 밖 추천');
  if (sp.some(x => /^SK 아이젠/.test(x.n)) && (a.age < 1 || a.age > 4)) errs.push('아이젠 나이 조건 밖 추천');
  if (sp.filter(x => x.corp).length > 4) errs.push('기업 프로그램 4개 초과');
  if (top3.some(p => !p.why)) errs.push('맞는 이유 배열 없음');
  if (top3.some(p => p.key === 'doc') && !(f.c_doc || ['hs','ms','drop','retake'].includes(k) || M.goalKey(f) === 'doc')) errs.push('학생·지망자가 아닌데 의약 면허직');
  if (k === 'drop' || k === 'retake') {
    if (top3.some(p => ['sal','bop','own','pln','pbc','rea'].includes(p.key))) errs.push('학교 밖·재수생에게 맞지 않는 길');
    if (k === 'drop' && M.corpSupports(f, P).length) errs.push('학교 밖 청소년에게 기업 프로그램');
    const fa = M.freeAnswer(a.free || '').join(' ');
    if (/국민취업지원제도|수입부터/.test(fa)) errs.push('청소년에게 어른용 답: ' + fa.slice(0, 50));
  }
  if (k === 'ms') {
    if (top3.some(p => ['sal','bop','own','pln','pbc','rea','adv','hsj','avs','mlc','hcl'].includes(p.key))) errs.push('중학생에게 맞지 않는 길');
    const bad = ['국민취업지원제도','청년월세 지원','실업급여 (구직급여)','국가장학금','청년미래적금','내일배움카드'];
    if (sp.some(x => bad.some(b => x.n.startsWith(b)))) errs.push('중학생에게 어른 지원: ' + sp.map(x=>x.n).join(','));
    if (M.corpSupports(f, P).length) errs.push('중학생에게 기업 프로그램');
    const fa = M.freeAnswer(a.free || '').join(' ');
    if (/국민취업지원제도|수입부터|통장 버팀|사표/.test(fa)) errs.push('중학생에게 어른용 답: ' + fa.slice(0, 60));
  }
  return { errs, P, f, k, low: M.lowConf(P), fallback: top.v.length > 0, pro: !!M.PRO[top.key] };
}
module.exports = { M, SITS, randomPersona, check };
