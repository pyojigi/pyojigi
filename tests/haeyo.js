// 해요체 검사: 사용자에게 보이는 글에 합니다체(~ㅂ니다)가 0건인지 본다 (페르소나 하은: '안정됩니다'·'미룹니다' 지적)
// 대상: 빌드된 public/ 의 모든 .html (운영자 통계 stats.html 제외). 먼저 python3 tools/build_web.py 를 돌린다.
// 빼는 것: 코드 주석, 정규식 안의 말(기타 칸 답 인식용 '없습니다|입니다'), 법정 고지 원문(쿠팡 파트너스 대가성 문구)
// 사용법: node tests/haeyo.js
const fs = require('fs'), path = require('path');
const PUB = path.resolve(__dirname, '../public');
const ALLOW = ['일정액의 수수료를 제공받습니다']; // 공정위 추천·보증 심사지침에 따른 쿠팡 파트너스 고지 문구 원문
const files = [];
(function walk(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const s = fs.statSync(p); if (s.isDirectory()) walk(p); else if (n.endsWith('.html') && n !== 'stats.html') files.push(p); } })(PUB);
// 받침이 ㅂ인 글자 + 니다 (합니다·입니다·습니다·됩니다…). '아니다' 같은 말은 안 걸림
const isB = c => { const x = c.charCodeAt(0) - 0xAC00; return x >= 0 && x <= 11171 && x % 28 === 17; };
const bad = [];
for (const f of files) {
  let s = fs.readFileSync(f, 'utf-8');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n').map(l => l.replace(/(^|[^:"'`\\])\/\/[^\n]*$/, '$1')).join('\n');
  const re = /([가-힣])니다/g; let m;
  while ((m = re.exec(s))) {
    if (!isB(m[1])) continue;
    const ctx = s.slice(Math.max(0, m.index - 30), m.index + 12);
    if (ALLOW.some(a => ctx.includes(a))) continue;
    const pre = s[m.index - 1] || '', post = s[m.index + 3] || '';
    if (/[|(]/.test(pre) || /[|)]/.test(post)) continue; // 정규식 보기 (…|입니다|…)
    bad.push(path.relative(PUB, f) + ': …' + ctx.replace(/\s+/g, ' ') + '…');
  }
}
console.log(`=== 해요체 검사: 페이지 ${files.length}개 ===`);
console.log(`합니다체 ${bad.length}건`);
bad.slice(0, 30).forEach(x => console.log('  • ' + x));
console.log(bad.length ? 'FAIL' : 'ALL PASS');
if (bad.length) process.exitCode = 1;
