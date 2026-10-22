// 검색 노출용 정적 페이지: 직업별(/jobs/), 상황별(/for/), 사이트 지도
// 사용: node gen_pages.js <public 폴더> [사이트 주소]
const fs = require('fs'), path = require('path');
const { M, randomPersona } = require(require('path').join(__dirname,'..','tests','logic.js'));
const html = fs.readFileSync(require('path').join(__dirname,'..','src','pyojigi.html'), 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const JOBD = new Function(js.match(/const JOBD=\{[\s\S]*?\n\};/)[0] + '\nreturn JOBD;')();
const DICT_CATS = new Function(js.match(/const DICT_CATS=\[[^\n]*\];/)[0] + '\nreturn DICT_CATS;')();
const OUT = process.argv[2], SITE = (process.argv[3] || process.env.SITE_URL || 'https://pyojigi.pages.dev').replace(/\/$/, '');
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = n => n.replace(/ \(.*\)$/, '');
const prepTxt = m => m <= 1 ? '1개월 이내' : m <= 3 ? '1~3개월' : m <= 6 ? '3~6개월' : m <= 12 ? '6개월~1년' : '1년 이상';
const yt = k => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(M.YTQ[k] || '');
const P = Object.fromEntries(M.PATHS.map(p => [p.key, p]));

const CSS = `.srcl{font-size:12px;color:var(--muted)}:root{--bg:#EEF0EA;--surface:#FAFBF7;--ink:#1D2B24;--muted:#5D6B63;--line:#D3D9CF;--pine:#24543F;--soft:#E3EBE2;--blaze:#F3E3C3;--wood:#6B5442}
@media (prefers-color-scheme:dark){:root{--bg:#121A16;--surface:#1A241F;--ink:#E6ECE6;--muted:#9AA89F;--line:#2E3B34;--pine:#7FB89A;--soft:#22302A;--blaze:#3A3020;--wood:#B89A80}}
*{box-sizing:border-box}html,body{overflow-x:clip}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Noto Sans CJK KR",sans-serif;word-break:keep-all;overflow-wrap:anywhere}
.w{max-width:720px;margin:0 auto;padding:20px 16px 48px}a{color:var(--pine)}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
header a.logo{display:flex;align-items:center;gap:8px;font-weight:800;font-size:20px;text-decoration:none;color:var(--ink);line-height:1.2}header a.logo svg{flex:none}header small{color:var(--muted);display:block;font-size:12px;font-weight:400}
h1{font-size:26px;line-height:1.3;margin:6px 0 10px}h2{font-size:19px;margin:28px 0 8px}h3{font-size:16px;margin:18px 0 6px}p.lede{color:var(--muted);margin:0 0 14px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.kv{display:grid;grid-template-columns:88px 1fr;gap:6px 12px;margin:0}.kv dt{color:var(--muted)}.kv dd{margin:0}
ul,ol{padding-left:20px}li{margin:4px 0}.src{font-size:13px;color:var(--muted)}
ol.qa li{margin:10px 0}ol.qa b{display:block}
.cta{display:block;text-align:center;background:var(--pine);color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:16px;margin:22px 0}
@media (prefers-color-scheme:dark){.cta{color:#10201A}}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.chips a{background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 12px;text-decoration:none;font-size:14px}
.sum{background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:12px 0}.sum ul{margin:6px 0 0}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0}th,td{border:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}th{background:var(--soft);font-weight:700}
.lost{text-align:center;padding:24px 0 8px}.lost svg{width:132px;height:auto}.lost h1{margin-top:12px}
footer{margin-top:36px;border-top:1px solid var(--line);padding-top:14px;font-size:13px;color:var(--muted)}footer nav{display:flex;flex-wrap:wrap;gap:4px 14px}
/* 앱 테마 (2026-10-22) */
:root{--bg:#F2F4F6;--surface:#FFFFFF;--ink:#191F28;--muted:#6B7684;--line:#E5E8EB;--pine:#0B8F5A;--soft:#F2F4F6;--tint:#E8F6EF;--blaze:#FFF4E5;--wood:#8B6F57}
@media (prefers-color-scheme:dark){:root{--bg:#101113;--surface:#1B1D20;--ink:#F2F4F6;--muted:#9EA4AA;--line:#2C2F33;--pine:#34C98A;--soft:#24272B;--tint:#16352A;--blaze:#3A2C14;--wood:#C2A68C}}
body{font-family:"Pretendard Variable","Pretendard",-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;letter-spacing:-.01em;-webkit-font-smoothing:antialiased}
h1{font-size:28px;font-weight:800;letter-spacing:-.035em}h2{font-size:20px;font-weight:700;letter-spacing:-.025em}h3{font-weight:700}
.card,.sum{border:0;border-radius:20px;box-shadow:0 1px 2px rgba(0,0,0,.04);padding:20px}
.sum{background:var(--tint)}
.cta{border-radius:14px;padding:17px}
.chips a{border:0;background:var(--surface);box-shadow:0 0 0 1.5px var(--line) inset;padding:8px 14px}
table{border-radius:14px;overflow:hidden}th{background:var(--soft)}
a{text-underline-offset:3px}`;

// 로고 (리본이 묶인 표지 기둥) — favicon.svg와 같은 모양
const LOGO = `<svg width="26" height="32" viewBox="0 30 220 230" aria-hidden="true"><rect x="95" y="38" width="30" height="40" rx="5" fill="#A82E25"/><path d="M8 62 C70 46 150 44 214 60" fill="none" stroke="var(--wood)" stroke-width="16" stroke-linecap="round"/><rect x="94" y="47" width="32" height="18" rx="4" fill="#D23F33"/><rect x="99" y="64" width="22" height="13" rx="5" fill="#A82E25"/><path d="M118 74 C128 92 131 108 136 124 L127 119 L123 128 C120 108 116 92 110 76 Z" fill="#A82E25"/><path d="M95 75 L123 75 C125 130 126 190 128 254 L112 239 L94 256 C95 190 95 130 95 75 Z" fill="#D23F33"/></svg>`;
const ORG = { '@type': 'Organization', name: '표지기', url: SITE + '/' };
const OG_W = 1200, OG_H = 630;
// 메타 설명은 160자 이내: 넘치면 문장/항목 경계에서 자르기
function clip(t, n = 160) {
  t = String(t).replace(/\s+/g, ' ').trim(); if (t.length <= n) return t;
  const cut = t.slice(0, n - 1); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('·'), cut.lastIndexOf(', '));
  return (i > n * 0.6 ? cut.slice(0, i) : cut.replace(/\s\S*$/, '')).replace(/[,·\s]+$/, '') + '…';
}
const crumbHtml = cr => cr.map(([n, u], i) => i < cr.length - 1 ? `<a href="${u}">${esc(n)}</a>` : esc(n)).join(' › ');
const crumbLd = cr => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: cr.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) });
const ldTag = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

function page({ url, title, desc, body, crumbs, ld = [], og = '/og.png', ogAlt, noindex = false, type = 'article', article = true, foot = true }) {
  desc = clip(desc);
  const blocks = [];
  if (article) blocks.push({ '@context': 'https://schema.org', '@type': 'Article', headline: title.replace(/ \| 표지기$/, ''), description: desc, dateModified: TODAY, inLanguage: 'ko', author: ORG, publisher: ORG, image: SITE + og, mainEntityOfPage: SITE + url });
  blocks.push(...ld);
  if (crumbs) blocks.push(crumbLd(crumbs));
  const img = SITE + og;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE + url}">`}
<meta property="og:type" content="${type}"><meta property="og:site_name" content="표지기"><meta property="og:locale" content="ko_KR"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">${noindex ? '' : `<meta property="og:url" content="${SITE + url}">`}
<meta property="og:image" content="${img}"><meta property="og:image:width" content="${OG_W}"><meta property="og:image:height" content="${OG_H}"><meta property="og:image:alt" content="${esc(ogAlt || title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${img}">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="theme-color" content="#F2F4F6">
${blocks.map(ldTag).join('\n')}<style>${CSS}</style></head><body><div class="w">
<header><a class="logo" href="/">${LOGO}<span>표지기<small>길 잃은 사람을 위한 리본</small></span></a><a href="/jobs/">직업 안내</a></header>
${crumbs ? `<nav class="src" aria-label="현재 위치">${crumbHtml(crumbs)}</nav>` : ''}
${body}
<footer><nav aria-label="사이트 링크"><a href="/">20분 진로 검사</a><a href="/jobs/">직업별 안내</a><a href="/for/">상황별 안내</a>${HAS_GUIDE() ? '<a href="/guide/">진로 가이드</a>' : ''}<a href="/privacy.html">개인정보 처리방침</a><a href="/#ask">문의</a></nav>${foot ? `<p>연봉·일정은 출처 기준이며 바뀔 수 있어요. 마지막 확인 ${TODAY}.</p>` : ''}</footer>
</div></body></html>`;
}

// ---------- 직업별 ----------
const CAT = {}; for (const [, name, keys] of DICT_CATS) if (keys) for (const k of keys) CAT[k] = name;
function jobPage(p) {
  const k = p.key, G = M.GUIDE[k] || { cert: [], how: '', links: [] }, PRO = M.PRO[k], R = M.ROAD[k] || [], A = M.AIX[k], J = M.JOBS[k] || [];
  const nm = short(p.n);
  const sal = p.sal ? `연 ${p.sal[0].toLocaleString()}만원 → 경력 5년 이상 ${p.sal[1].toLocaleString()}만원 정도 (대략)` : (p.salNote || '진학 경로라 연봉 대신 학과별 진로를 비교해 보세요.');
  const title = `${nm} 되는 법, 연봉, 자격증 | 표지기`;
  const desc = `${nm}: ${J.slice(0, 4).join(', ')}. 준비 기간 ${prepTxt(p.prep)}, ${p.sal ? `연봉 연 ${p.sal[0].toLocaleString()}~${p.sal[1].toLocaleString()}만원 정도. ` : ''}${p.need.split('.')[0]}.`;
  const body = `<h1>${esc(nm)} 되는 법</h1><p class="lede">${esc(p.n)}${CAT[k] ? ' · ' + esc(CAT[k]) : ''}</p>
<div class="card"><dl class="kv"><dt>준비 기간</dt><dd>${prepTxt(p.prep)}</dd><dt>연봉</dt><dd>${esc(sal)}</dd><dt>필요한 것</dt><dd>${esc(p.need)}</dd>${G.how ? `<dt>준비 순서</dt><dd>${esc(G.how)}</dd>` : ''}${A ? `<dt>AI 영향</dt><dd>${esc(M.AIXT[A][0])} · ${esc(M.AIXT[A][1])}</dd>` : ''}</dl></div>
${J.length ? `<h2>세부 직업</h2>${J.map(j => { const d = JOBD[j]; return `<div class="card"><b>${esc(j)}</b>${d ? `<p>${esc(d[0])}</p>${d[1] ? `<p class="src">되는 법 · ${esc(d[1])}</p>` : ''}` : ''}</div>`; }).join('')}` : ''}
${G.cert.length ? `<h2>자격증·시험</h2><ul>${G.cert.map(c => `<li><b>${esc(c[0])}</b> · ${esc(c[1])}${c[2] ? ` <a href="${esc(c[2])}" rel="noopener">바로가기</a>` : ''}</li>`).join('')}</ul>` : ''}
${R.length ? `<h2>준비 단계 (대략적인 시간)</h2><ol>${R.map(r => `<li>${esc(r[0])} <span class="src">약 ${r[1]}시간</span></li>`).join('')}</ol>` : ''}
${PRO ? `<h2>이 일의 장점</h2><div class="card"><p>${esc(PRO.t)}</p><p class="src">출처: <a href="${esc(PRO.url)}" rel="noopener">${esc(PRO.src)}</a></p></div>` : ''}
<h2>오늘 해 볼 것</h2><ul><li>${esc(p.first)}</li>${p.try ? `<li>${esc(p.try)}</li>` : ''}<li><a href="${yt(k)}" rel="noopener">현직자 영상 보기 (유튜브)</a></li></ul>
<a class="cta" href="/?src=job-${k}">이 길이 나한테 맞는지 20분 검사로 확인하기</a>
<h2>같은 분야 다른 직업</h2><div class="chips">${M.PATHS.filter(x => x.key !== k && CAT[x.key] === CAT[k]).map(x => `<a href="/jobs/${x.key}.html">${esc(short(x.n))}</a>`).join('')}</div>`;
  const url = `/jobs/${k}.html`;
  const occ = { '@context': 'https://schema.org', '@type': 'Occupation', name: nm, description: clip(`${p.n}. ${J.length ? '세부 직업: ' + J.join(', ') + '. ' : ''}${p.need}`, 300), inLanguage: 'ko', mainEntityOfPage: SITE + url, occupationLocation: { '@type': 'Country', name: '대한민국' } };
  if (CAT[k]) occ.occupationalCategory = CAT[k];
  if (G.cert.length) occ.qualifications = G.cert.map(c => c[0]).join(', ');
  if (G.how) occ.educationRequirements = G.how;
  if (p.sal) occ.estimatedSalary = [{ '@type': 'MonetaryAmountDistribution', name: '연봉 (신입 ~ 경력 5년 이상, 대략)', currency: 'KRW', duration: 'P1Y', minValue: p.sal[0] * 10000, maxValue: p.sal[1] * 10000 }];
  return { url, h1: `${nm} 되는 법`, html: page({ url, title, desc, body, og: `/og/${k}.png`, ogAlt: `${nm} 되는 법 · 표지기`, ld: [occ], crumbs: [['표지기', '/'], ['직업별 안내', '/jobs/'], [nm, url]] }) };
}

// ---------- 상황별 ----------
// 상황마다 실제 검사에서 3위 안에 많이 나온 길 (페르소나 3,000명)
let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);
const SITQ = M.Q.find(q => q.id === 'sit');
function topFor(sitIdx, extra) {
  const cnt = {};
  for (let i = 0; i < 3000; i++) { const a = randomPersona(rnd, sitIdx); Object.assign(a, extra || {}); M.setAns(a); for (const p of M.score().slice(0, 3)) cnt[p.key] = (cnt[p.key] || 0) + 1; }
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
}
const SI = k => SITQ.o.findIndex(o => o[2].sit === k);
const SIT = [
 ['job', '첫 취업 준비가 막막할 때 (20대 초)', '첫 취업이 막막한 20대 초반을 위한 진로 정리: 지원 방향 좁히기, 국민취업지원제도·내일배움카드, 폴리텍·기업 무료 교육까지.', SI('job'), { ag: 1, age: 1 },
  ['지원 수보다 방향이 먼저예요. 계속 떨어진다면 한 직무로 좁혀 자기소개서를 그 직무의 말로 다시 쓰세요.', '수입이 없거나 적다면 국민취업지원제도로 상담·훈련을 받으며 조건이 맞으면 월 60만원씩 6개월 구직촉진수당을 받을 수 있어요.', '국민내일배움카드로 5년간 300만원(저소득층 등 최대 500만원)까지 국비 훈련을 받을 수 있어요.'],
  [['고용24 (국민취업지원제도·내일배움카드)', 'https://www.work24.go.kr'], ['한국폴리텍대학 하이테크·전문기술과정', 'https://ipsi.kopo.ac.kr']]],
 ['mil', '군 복무 중·전역 후 진로 (20대 초)', '군 복무 중이거나 막 전역한 20대 초반이라면: 군 경력·주특기를 살리는 직업, 복무 중 딸 수 있는 자격, 제대군인 지원.', SI('mil'), null,
  ['복무 중에도 자격증 시험을 볼 수 있어요. 전역 전에 하나를 따 두면 전역 뒤가 빨라져요.', '주특기와 조직 생활 경험은 보안, 소방·경찰, 군무원, 설비 쪽에서 그대로 강점이 돼요.', '국가보훈부 제대군인지원센터에서 전직 상담과 교육을 받을 수 있어요.'],
  [['제대군인지원센터', 'https://www.vnet.go.kr']]],
 ['nouni', '대학 안 가고 할 수 있는 일', '대학에 안 가도 갈 수 있는 길: 고졸 공채, 특성화고·마이스터고, 폴리텍 2년제·국비 기술 과정, 자격증 하나로 시작하는 직업.', SI('hs'), { h2: 1 },
  ['고졸 공채(공기업·대기업 생산·기술직)는 고3 1학기부터 공고가 나와요. 자격증 1개와 출결이 가장 큰 무기예요.', '기술을 배우고 싶다면 한국폴리텍대학 2년제(2027학년도 5,550명 모집)나 15세 이상 누구나 지원할 수 있는 전문기술과정이 있어요.', '일하면서 나중에 대학에 가는 길(선취업 후진학)도 있어요. 먼저 일하고 필요할 때 공부를 더해도 늦지 않아요.'],
  [['잡알리오 (공공기관 채용)', 'https://job.alio.go.kr'], ['폴리텍 입시', 'https://ipsi.kopo.ac.kr'], ['큐넷 (국가기술자격)', 'https://www.q-net.or.kr']]],
 ['twenty', '스무 살·20대 초 진로 고민', '스무 살, 20대 초반에 진로가 막막하다면: 지금 정할 것과 미뤄도 되는 것, 무료로 해 볼 수 있는 것, 청년 지원.', SI('job'), { ag: 1, age: 1 },
  ['20대 초반에 정할 건 평생 직업이 아니라 첫 방향 하나예요. 두세 개 길을 2주씩 작게 해 보고 덜 지치는 쪽을 고르세요.', '하고 싶은 게 없다면 커리어넷 직업흥미검사(무료)부터 해 보세요.', '만 19~34세 청년은 청년월세 지원, 국민취업지원제도 같은 청년 지원을 받을 수 있어요. 조건은 고용24·복지로에서 확인하세요.'],
  [['커리어넷', 'https://www.career.go.kr'], ['고용24', 'https://www.work24.go.kr'], ['복지로', 'https://www.bokjiro.go.kr']]],
 ['col', '대학생 진로 고민 (전공 살리기 vs 다른 길)', '대학생 진로 고민: 전공을 살리는 길과 다른 길, 대학일자리플러스센터, 졸업 전 인턴·현장실습의 힘.', SI('col'), null,
  ['전공이 안 맞는 건 흔한 일이에요. 사무·영업·IT·공공기관처럼 전공을 크게 안 보는 채용이 많아요.', '졸업 전 인턴이나 현장실습 한 번이 서류에서 전공보다 강할 때가 많아요.', '학교마다 있는 대학일자리플러스센터에서 진로 상담, 이력서 첨삭, 모의면접을 무료로 받을 수 있어요.'],
  [['커리어넷 학과정보', 'https://www.career.go.kr']]],
 ['hs', '고등학생 진로 (대학 진학 vs 고졸 취업)', '고등학생 진로: 대학 진학이라면 학과부터, 고졸 취업이라면 3학년 1학기 공채와 자격증·출결, 폴리텍 2년제까지.', SI('hs'), null,
  ['진학을 원한다면 \'어느 대학\'보다 \'어느 학과\'가 먼저예요. 학과가 곧 첫 직업을 정해요.', '바로 취업한다면 고졸 공채는 3학년 1학기부터 공고가 나와요. 자격증 1개와 출결이 가장 큰 무기예요.', '한국폴리텍대학 2년제는 2027학년도에 전국 28개 캠퍼스 159개 학과에서 5,550명을 뽑아요.'],
  [['커리어넷', 'https://www.career.go.kr'], ['폴리텍 입시', 'https://ipsi.kopo.ac.kr']]],
 ['csat', '수능 끝난 고3 진로 (정시·재수·취업)', '수능이 끝난 고3이라면: 성적 발표(12월 11일)와 정시 원서(2027년 1월 4~7일) 전에 학과부터 정하기, 재수 기준, 폴리텍·고졸 취업 같은 다른 길.', SI('hs'), null,
  ['2027학년도 수능 성적은 12월 11일에 나오고, 정시 원서는 2027년 1월 4일부터 7일 사이에 대학마다 3일 이상 받아요. 그 전에 가고 싶은 학과부터 좁혀 두세요.', '재수를 고민한다면 \'목표 학과가 분명한지\', \'1년 더 공부할 힘과 돈이 있는지\'를 먼저 따져 보세요. 막연한 재수는 오래 걸려요.', '바로 기술을 배우고 싶다면 한국폴리텍대학 2027학년도 신입생 원서를 2027년 1월 22일까지 받아요.'],
  [['어디가 (대입정보포털)', 'https://www.adiga.kr'], ['커리어넷 학과정보', 'https://www.career.go.kr'], ['폴리텍 입시', 'https://ipsi.kopo.ac.kr']]],
 ['ms', '중학생 진로·고등학교 고르기', '중학생 진로: 지금 정할 건 직업보다 고등학교 방향. 일반고·특성화고·마이스터고·예체고 차이와 원서 시기, 진로체험.', SI('ms'), null,
  ['중학생 때 정할 건 평생 직업이 아니라 고등학교 방향이에요.', '원서는 마이스터고(10월), 특성화고(대부분 11월), 일반고(12월) 순서예요. 지역마다 날짜가 달라요.', '커리어넷 직업흥미검사(무료)와 꿈길 진로체험으로 먼저 알아보세요.'],
  [['커리어넷', 'https://www.career.go.kr'], ['꿈길', 'https://www.ggoomgil.go.kr'], ['하이파이브 (특성화고·마이스터고)', 'https://www.hifive.go.kr']]],
 ['drop', '자퇴 후 진로 (검정고시·꿈드림·폴리텍)', '학교를 그만뒀다면: 검정고시로 고졸 학력 인정, 꿈드림 학교 밖 청소년 지원, 폴리텍 기술 과정.', SI('drop'), null,
  ['학교를 그만둔 건 끝이 아니에요. 검정고시(1년에 두 번, 보통 4월·8월)에 붙으면 고졸 학력이 인정돼 대학, 공무원 시험, 고졸 채용에 지원할 수 있어요.', '꿈드림(학교 밖 청소년 지원센터)은 만 9~24세에게 상담, 검정고시 준비, 직업 체험·훈련을 무료로 도와줘요.', '기술을 배우고 싶다면 폴리텍 전문기술과정은 15세 이상 구직자라면 학력과 상관없이 지원할 수 있어요.'],
  [['꿈드림', 'https://www.kdream.or.kr'], ['청소년1388', 'https://www.1388.go.kr'], ['폴리텍 입시', 'https://ipsi.kopo.ac.kr']]],
 ['retake', '재수·N수 중 진로 고민', '재수·N수 중 진로가 고민된다면: 목표 학과 다시 보기, 계속할지 정하는 기준, 폴리텍 같은 다른 진학.', SI('retake'), null,
  ['재수는 목표 학과가 분명할 때 힘이 나요.', '계속할지 고민된다면 \'올해 성적이 어디까지 오르면 계속\'처럼 기준을 먼저 정해 두세요.', '기술을 배워 바로 취업하는 폴리텍 2년제 같은 진학도 있어요.'],
  [['커리어넷 학과정보', 'https://www.career.go.kr'], ['폴리텍 입시', 'https://ipsi.kopo.ac.kr']]],
];
// '먼저 확인할 것' 3개에 붙는 질문 (FAQPage 구조화 데이터와 화면에 같이 씀)
const FAQ_Q = {
  job: ['계속 떨어지는데 무엇부터 바꿔야 하나요?', '구직 중에 생활비 지원을 받을 수 있나요?', '취업 교육을 무료로 받을 수 있나요?'],
  mil: ['군 복무 중에도 자격증을 딸 수 있나요?', '군 경력을 살릴 수 있는 일이 있나요?', '전역 후 진로 상담은 어디서 받나요?'],
  nouni: ['고졸로 공기업·대기업에 갈 수 있나요?', '대학 대신 기술을 배울 곳이 있나요?', '나중에 대학에 가고 싶어지면 어떻게 하나요?'],
  twenty: ['20대 초반에 평생 직업을 정해야 하나요?', '하고 싶은 게 없으면 무엇부터 하나요?', '20대 청년이 받을 수 있는 지원이 있나요?'],
  col: ['전공이 안 맞으면 어떻게 하나요?', '졸업 전에 무엇을 해 두면 좋나요?', '학교에서 무료로 진로 상담을 받을 수 있나요?'],
  hs: ['대학에 가고 싶다면 무엇부터 정해야 하나요?', '고졸 취업은 언제부터 준비하나요?', '폴리텍 2년제는 얼마나 뽑나요?'],
  csat: ['수능 성적은 언제 나오고 정시 원서는 언제 내나요?', '재수는 어떻게 정하나요?', '수능 말고 바로 기술을 배울 길이 있나요?'],
  ms: ['중학생 때 직업을 정해야 하나요?', '고등학교 원서는 언제 내나요?', '중학생이 무료로 진로를 알아볼 방법이 있나요?'],
  drop: ['자퇴하면 대학이나 취업은 어떻게 하나요?', '학교 밖 청소년은 어디서 도움받을 수 있나요?', '학력이 없어도 기술을 배울 수 있나요?'],
  retake: ['재수는 언제 해 볼 만한가요?', '계속할지 그만둘지 어떻게 정하나요?', '수능 말고 다른 진학 길도 있나요?'],
};
function sitPage([slug, h1, desc, sitIdx, extra, tips, links]) {
  const tops = topFor(sitIdx, extra).filter(k => P[k]).slice(0, 6);
  const Q = FAQ_Q[slug]; if (!Q || Q.length !== tips.length) throw new Error('FAQ_Q 누락: ' + slug);
  const body = `<h1>${esc(h1)}</h1><p class="lede">${esc(desc)}</p>
<h2>먼저 확인할 것</h2><ol class="qa">${tips.map((t, i) => `<li><b>${esc(Q[i])}</b>${esc(t)}</li>`).join('')}</ol>
<h2>이 상황에서 많이 추천되는 길</h2><p class="src">표지기 검사에서 같은 상황의 응답 3,000건을 돌려 3위 안에 많이 나온 길이에요.</p>
<div class="chips">${tops.map(k => `<a href="/jobs/${k}.html">${esc(short(P[k].n))}</a>`).join('')}</div>
<h2>도움받을 곳</h2><ul>${links.map(l => `<li><a href="${esc(l[1])}" rel="noopener">${esc(l[0])}</a></li>`).join('')}</ul>
<a class="cta" href="/?src=for-${slug}">내 상황에 맞는 길 3개 찾기 (20분, 무료)</a>`;
  const url = `/for/${slug}.html`;
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'ko', mainEntity: tips.map((t, i) => ({ '@type': 'Question', name: Q[i], acceptedAnswer: { '@type': 'Answer', text: t } })) };
  return { url, h1, html: page({ url, title: `${h1} | 표지기`, desc, body, og: `/og/for-${slug}.png`, ogAlt: `${h1} · 표지기`, ld: [faq], crumbs: [['표지기', '/'], ['상황별 안내', '/for/'], [h1, url]] }) };
}

// ---------- 404 ----------
const BIG_POST = `<svg viewBox="0 0 220 280" role="img" aria-label="리본이 없는 표지 기둥"><path d="M110 40 L110 268" stroke="var(--wood)" stroke-width="14" stroke-linecap="round"/><path d="M20 66 C70 52 150 50 200 64" fill="none" stroke="var(--wood)" stroke-width="14" stroke-linecap="round"/><path d="M138 120 C150 132 150 150 138 160" fill="none" stroke="#D23F33" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 10" opacity=".7"/><text x="150" y="112" font-size="40" font-weight="700" fill="#D23F33" font-family="system-ui,sans-serif">?</text><path d="M20 268 L200 268" stroke="#9AA89F" stroke-width="4" stroke-linecap="round" stroke-dasharray="4 12"/></svg>`;
function notFound() {
  const body = `<div class="lost">${BIG_POST}<h1>이 길에는 리본이 없어요</h1><p class="lede">주소가 바뀌었거나 잘못 적힌 것 같아요. 괜찮아요, 아래 리본을 따라가면 다시 길이 나와요.</p></div>
<a class="cta" href="/?src=404">20분 진로 검사 시작하기</a>
<div class="card"><b>이런 곳은 어때요?</b><ul><li><a href="/jobs/">직업별 안내</a> · 되는 법, 연봉, 자격증, 준비 기간</li><li><a href="/for/">상황별 안내</a> · 중학생, 고등학생, 자퇴, 재수, 대학생, 첫 취업</li><li><a href="/">처음 화면으로</a></li></ul></div>`;
  return page({ url: '/404.html', title: '페이지를 찾을 수 없어요 | 표지기', desc: '찾는 페이지가 없어요. 20분 진로 검사, 직업별 안내, 상황별 안내에서 다시 길을 찾아보세요.', body, noindex: true, type: 'website', article: false, foot: false });
}

// ---------- 개인정보 처리방침 ----------
const PRIV_DATE = '2026-10-22';
function privacy() {
  const mail = `<a class="mailto" href="#" data-u="songminhyeok1005" data-d="naver.com">songminhyeok1005 [at] naver.com</a>`;
  const body = `<h1>개인정보 처리방침</h1><p class="lede">표지기(이하 '서비스')는 이름, 연락처, 계정 없이 쓰는 무료 진로 검사예요. 개인정보 보호법 제30조에 따라 어떤 정보를 왜, 얼마나 오래 다루는지 알려 드려요.</p>
<div class="sum"><b>한눈에 보기</b><ul>
<li>검사 답과 직접 적은 문장은 <b>내 기기(브라우저)에만</b> 저장되고 서버로 보내지 않아요.</li>
<li>서버에는 누구인지 알 수 없는 <b>익명 이용 기록</b>만 남아요. 회원가입, 이름, 전화번호는 받지 않아요.</li>
<li>IP 주소는 원래 값을 저장하지 않고, 알아볼 수 없게 바꾼 값(해시)만 하루 이용 횟수 제한용으로 2일 보관해요.</li>
<li><b>AI 상담 버튼을 누른 경우에만</b> 그 내용이 답변을 만들기 위해 Anthropic(미국)으로 전송돼요.</li>
<li>쿠키를 쓰지 않고, 다른 회사에 개인정보를 제공하지 않아요.</li>
<li>궁금한 점이나 삭제 요청은 ${mail}로 보내 주세요.</li>
</ul></div>

<h2>1. 처리 목적</h2><ul>
<li>서비스 개선을 위한 통계 (어느 질문에서 많이 그만두는지, 추천이 도움이 됐는지 등)</li>
<li>문의·피드백 답변</li>
<li>후기 게시 (공개에 동의한 경우에만)</li>
<li>AI 상담 답변 생성 (AI 상담 버튼을 누른 경우에만)</li>
<li>같은 기기에서 짧은 시간에 너무 많이 요청하는 것을 막기 위한 이용 횟수 제한</li></ul>

<h2>2. 처리 항목</h2>
<h3>서버로 보내지 않는 것</h3><p>검사에서 고른 답, 직접 적은 문장, 결과 화면의 계획은 이용자 기기의 브라우저 저장소(localStorage)에만 저장돼요. 표지기 서버로 보내지 않아요.</p>
<h3>서버에 남는 것</h3><ul>
<li><b>익명 이용 기록</b>: 방문·검사 시작·완주 시각(분 단위), 상황 종류(예: 고등학생, 대학생), 나이대, 추천된 길 3개, 만족도 버튼, '이 추천은 아니에요' 선택, 그만둔 질문, 유입 경로(이전 사이트 주소의 도메인)와 검색어(전달된 경우), '기타' 칸에 직접 적은 직업·자격 이름 중 목록에 없던 것(30자 이내, 숫자·이메일·주소가 들어간 글은 받지 않아요)</li>
<li><b>피드백·문의 내용</b>: 이용자가 직접 적어 보낸 경우</li>
<li><b>후기 공개 동의 여부</b>: 후기를 남긴 경우</li>
<li><b>IP 주소를 바꾼 값(해시)</b>: IP 원문은 저장하지 않아요</li></ul>
<p class="src">익명 이용 기록에는 이름, 연락처, 계정 같은 개인을 알아볼 수 있는 정보가 없어요.</p>

<h2>3. 처리 및 보유 기간</h2><div class="tw"><table><thead><tr><th>항목</th><th>보유 기간</th></tr></thead><tbody>
<tr><td>피드백</td><td>받은 날부터 90일</td></tr>
<tr><td>문의</td><td>답변을 마친 날부터 1년</td></tr>
<tr><td>익명 이용 기록</td><td>기록된 날부터 2년</td></tr>
<tr><td>공개 후기</td><td>게시 철회를 요청할 때까지</td></tr>
<tr><td>IP 해시 (이용 횟수 제한)</td><td>2일</td></tr>
<tr><td>브라우저에 저장된 검사 답</td><td>이용자가 직접 지울 때까지 (서버에는 없음)</td></tr>
</tbody></table></div>

<h2>4. 제3자 제공</h2><p>개인정보를 다른 사람이나 회사에 제공하지 않아요. 법령에 따라 수사기관 등이 정해진 절차로 요구하는 경우는 예외예요.</p>

<h2>5. 처리 위탁과 국외 이전</h2><p>서비스를 운영하려고 아래 회사에 일을 맡기고 있어요. 두 회사 모두 미국에 있어서 정보가 국외로 이전돼요.</p>
<div class="card"><b>Cloudflare, Inc. (미국)</b><dl class="kv" style="margin-top:8px"><dt>연락처</dt><dd>privacyquestions@cloudflare.com</dd><dt>맡긴 일</dt><dd>사이트 호스팅, 기록 저장</dd><dt>이전 항목</dt><dd>2번 '서버에 남는 것' 전부</dd><dt>시기·방법</dt><dd>이용할 때마다 암호화 통신(HTTPS)으로 전송</dd><dt>보유 기간</dt><dd>3번의 보유 기간과 같아요</dd></dl></div>
<div class="card"><b>Anthropic, PBC (미국)</b><dl class="kv" style="margin-top:8px"><dt>연락처</dt><dd>privacy@anthropic.com</dd><dt>맡긴 일</dt><dd>AI 상담 답변 생성</dd><dt>이전 항목</dt><dd>AI 상담을 누를 때 보내는 검사 답 요약과 적은 질문</dd><dt>시기·방법</dt><dd>AI 상담 버튼을 누른 때에만 암호화 통신(HTTPS)으로 전송</dd><dt>보유 기간</dt><dd>표지기 서버는 답변을 저장하지 않아요. Anthropic에서는 <a href="https://www.anthropic.com/legal/privacy" rel="noopener">Anthropic 개인정보 처리방침</a>에 따른 기간 동안만 보관돼요.</dd></dl></div>
<p><b>거부하는 방법과 그 결과</b>: AI 상담 버튼을 누르지 않으면 Anthropic으로 아무것도 전송되지 않고, 검사와 결과는 그대로 쓸 수 있어요. Cloudflare는 사이트를 보여 주는 곳이라 거부하면 사이트를 이용할 수 없어요.</p>

<h2>6. 만 14세 미만 이용자</h2><p>표지기는 이름, 연락처처럼 개인을 알아볼 수 있는 정보를 받지 않아요. 문의나 피드백을 적을 때도 이름, 전화번호, 학교 이름 같은 개인정보는 적지 말아 주세요. 혹시 적혀 있으면 확인하는 즉시 지워요.</p>

<h2>7. 파기 절차와 방법</h2><p>보유 기간이 지나거나 목적을 이룬 정보는 지체 없이(늦어도 5일 안에) 지워요. 전자 기록은 다시 살릴 수 없는 방법으로 삭제하고, 종이 문서는 만들지 않아요. 이용 기록은 기간이 지나면 자동으로 지워지도록 정해 두었어요.</p>

<h2>8. 이용자의 권리와 행사 방법</h2><p>이용자(만 14세 미만이면 법정대리인)는 언제든 자기 정보의 열람, 정정, 삭제, 처리 정지를 요청할 수 있어요.</p><ul>
<li>방법: ${mail}로 요청 내용을 보내 주세요. 10일 안에 처리 결과를 알려 드려요.</li>
<li>익명 기록은 누구의 것인지 알 수 없어서, 보낸 문의·피드백·후기라면 보낸 날짜와 내용 일부를 함께 알려 주시면 찾기 쉬워요.</li>
<li>브라우저에 저장된 검사 답은 이용자가 직접 지울 수 있어요 (아래 10번).</li></ul>

<h2>9. 안전성 확보 조치</h2><ul>
<li>모든 통신은 암호화(HTTPS)해요.</li>
<li>저장된 기록은 관리자 키가 있는 운영자만 볼 수 있게 접근을 제한해요.</li>
<li>IP 주소는 원문 없이 알아볼 수 없게 바꾼 값(해시)만 다뤄요.</li>
<li>필요 이상의 정보를 받지 않아요.</li></ul>

<h2>10. 쿠키와 브라우저 저장소</h2><p>표지기는 쿠키를 쓰지 않아요. 검사를 이어서 하거나 결과를 다시 보기 위해 브라우저 저장소(localStorage)만 써요. 이 정보는 내 기기에만 있어요.</p>
<p>지우는 법: 브라우저 설정에서 '사이트 데이터 삭제'(크롬: 설정 › 개인정보 및 보안 › 서드 파티 쿠키 › 모든 사이트 데이터 및 권한 보기 › pyojigi.pages.dev 삭제)를 하거나, 시크릿(비공개) 창에서 이용하면 창을 닫을 때 지워져요. 저장을 막으면 검사 중간 저장과 결과 다시 보기가 되지 않아요.</p>

<h2>11. 개인정보 보호책임자</h2><div class="card"><dl class="kv"><dt>책임자</dt><dd>표지기 운영자</dd><dt>이메일</dt><dd>${mail}</dd></dl><p class="src">개인정보 열람 청구, 문의, 불만 처리도 같은 곳에서 받아요.</p></div>

<h2>12. 권익 침해 구제 방법</h2><p>개인정보 침해에 대한 상담이나 신고가 필요하면 아래 기관에 문의할 수 있어요.</p><ul>
<li>개인정보침해신고센터: (국번 없이) 118 · <a href="https://privacy.kisa.or.kr" rel="noopener">privacy.kisa.or.kr</a></li>
<li>개인정보분쟁조정위원회: 1833-6972 · <a href="https://www.kopico.go.kr" rel="noopener">kopico.go.kr</a></li>
<li>대검찰청: (국번 없이) 1301 · <a href="https://www.spo.go.kr" rel="noopener">spo.go.kr</a></li>
<li>경찰청: (국번 없이) 182 · <a href="https://ecrm.police.go.kr" rel="noopener">ecrm.police.go.kr</a></li></ul>

<h2>13. 시행일과 변경</h2><p>이 방침은 ${PRIV_DATE}부터 시행해요. 내용이 바뀌면 시행 7일 전부터 이 페이지에 알리고, 이용자에게 불리한 중요한 변경은 30일 전부터 알려요.</p>
<script>document.querySelectorAll('a.mailto').forEach(function(a){var m=a.dataset.u+'@'+a.dataset.d;a.href='mailto:'+m;a.textContent=m;});</script>`;
  const url = '/privacy.html';
  return page({ url, title: '개인정보 처리방침 | 표지기', desc: '표지기가 다루는 정보와 보유 기간, 국외 이전(Cloudflare·Anthropic), 이용자 권리와 요청 방법을 알려 드려요. 검사 답은 내 기기에만 저장돼요.', body, type: 'website', article: false, foot: false,
    ld: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: '개인정보 처리방침', inLanguage: 'ko', datePublished: PRIV_DATE, dateModified: PRIV_DATE, publisher: ORG, url: SITE + url }],
    crumbs: [['표지기', '/'], ['개인정보 처리방침', url]] });
}

// ---------- 가이드 (content/guides/*.md) ----------
// 형식: 맨 위 'title: ', 'desc: ', 'h1: ' 줄, 빈 줄 뒤 본문(마크다운 일부: ## / ### 제목, - 목록, 1. 목록, **굵게**, [출처: URL]).
// '## 자주 묻는 질문' 아래 '**Q. ...**' / 'A. ...' 는 FAQPage 구조화 데이터로도 넣어요.
const GDIR = path.join(__dirname, '..', 'content', 'guides');
function HAS_GUIDE() { return fs.existsSync(GDIR) && fs.readdirSync(GDIR).some(f => f.endsWith('.md')); }
const inl = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\[출처: (https?:\/\/[^\]\s]+)\]/g, (m, u) => ` <a class="srcl" href="${u}" rel="noopener nofollow">[출처]</a>`).replace(/\[출처: 위와 같음\]/g, '')
  .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (m, a, u) => `${a}<a href="${u}" rel="noopener">${u.replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/\/.*$/, '')}</a>`);
function md(src) {
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of src.split('\n')) {
    const l = raw.trimEnd();
    if (!l.trim()) { close(); continue; }
    let m;
    if ((m = l.match(/^(#{2,4})\s+(.*)$/))) { close(); const n = Math.min(m[1].length, 3); out.push(`<h${n}>${inl(m[2])}</h${n}>`); continue; }
    if ((m = l.match(/^\s*-\s+(.*)$/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inl(m[1])}</li>`); continue; }
    if ((m = l.match(/^\s*\d+\.\s+(.*)$/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inl(m[1])}</li>`); continue; }
    close(); out.push(`<p>${inl(l)}</p>`);
  }
  close(); return out.join('\n');
}
function guidePage(file) {
  const raw = fs.readFileSync(path.join(GDIR, file), 'utf8');
  const [head, ...rest] = raw.split(/\n\s*\n/); const body = rest.join('\n\n');
  const meta = {}; for (const l of head.split('\n')) { const m = l.match(/^(\w+):\s*(.*)$/); if (m) meta[m[1]] = m[2].trim(); }
  if (!meta.title || !meta.desc || !meta.h1) throw new Error('가이드 머리말 누락: ' + file);
  const slug = file.replace(/\.md$/, ''), url = `/guide/${slug}.html`;
  const faq = []; const fm = body.split(/##\s*자주 묻는 질문/)[1] || '';
  for (const m of fm.matchAll(/\*\*Q\.\s*(.+?)\*\*\s*\n\s*A\.\s*(.+)/g)) faq.push({ '@type': 'Question', name: m[1].trim(), acceptedAnswer: { '@type': 'Answer', text: m[2].replace(/\[출처:[^\]]*\]/g, '').trim() } });
  const html = `<h1>${esc(meta.h1)}</h1>${md(body)}<a class="cta" href="/?src=guide-${slug}">내 상황에 맞는 길 3개 찾기 (20분, 무료)</a>`;
  return { url, h1: meta.h1, html: page({ url, title: `${meta.title} | 표지기`, desc: meta.desc, body: html, ld: faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq }] : [], crumbs: [['표지기', '/'], ['진로 가이드', '/guide/'], [meta.h1, url]] }) };
}

// ---------- 쓰기 ----------
for (const d of ['jobs', 'for', 'guide']) { fs.rmSync(path.join(OUT, d), { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, d)); }
const written = {}; // url -> html (검사용)
const put = (url, file, h) => { fs.writeFileSync(path.join(OUT, file), h); written[url] = h; };
const pages = [];
const jobPages = M.PATHS.map(jobPage); for (const g of jobPages) { put(g.url, g.url, g.html); pages.push(g.url); }
const sitPages = SIT.map(sitPage); for (const g of sitPages) { put(g.url, g.url, g.html); pages.push(g.url); }
const cats = DICT_CATS.filter(c => c[2]);
const collection = (url, name, desc, items) => ({ '@context': 'https://schema.org', '@type': 'CollectionPage', name, description: desc, url: SITE + url, inLanguage: 'ko', isPartOf: { '@type': 'WebSite', name: '표지기', url: SITE + '/' },
  mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.h1, url: SITE + g.url })) } });
{
  const desc = `${M.PATHS.length}개 직업 분야의 하는 일, 되는 법, 연봉, 자격증, 준비 기간을 한곳에 모았어요.`;
  put('/jobs/', 'jobs/index.html', page({ url: '/jobs/', title: '직업별 되는 법·연봉·자격증 모음 | 표지기', desc, type: 'website', article: false, og: '/og/jobs.png', ogAlt: '직업별 안내 · 표지기',
    ld: [collection('/jobs/', '직업별 안내', desc, jobPages)],
    body: `<h1>직업별 안내</h1><p class="lede">${M.PATHS.length}개 분야의 하는 일, 되는 법, 연봉, 자격증, 준비 기간.</p>${cats.map(c => `<h2>${esc(c[1])}</h2><div class="chips">${c[2].filter(k => P[k]).map(k => `<a href="/jobs/${k}.html">${esc(short(P[k].n))}</a>`).join('')}</div>`).join('')}<a class="cta" href="/?src=jobs">내게 맞는 길 3개 찾기 (20분, 무료)</a>`,
    crumbs: [['표지기', '/'], ['직업별 안내', '/jobs/']] }));
}
{
  const desc = '중학생, 고등학생, 자퇴, 재수, 대학생, 군 복무, 첫 취업 준비 등 10대·20대 초 상황별 진로 안내.';
  put('/for/', 'for/index.html', page({ url: '/for/', title: '10대·20대 초 상황별 진로 안내 (중고생·자퇴·재수·대학생·첫 취업) | 표지기', desc, type: 'website', article: false, og: '/og/for.png', ogAlt: '상황별 진로 안내 · 표지기',
    ld: [collection('/for/', '상황별 안내', desc, sitPages)],
    body: `<h1>상황별 안내</h1><ul>${SIT.map(s => `<li><a href="/for/${s[0]}.html">${esc(s[1])}</a></li>`).join('')}</ul><a class="cta" href="/?src=for">내 상황에 맞는 길 3개 찾기 (20분, 무료)</a>`,
    crumbs: [['표지기', '/'], ['상황별 안내', '/for/']] }));
}
const guidePages = fs.existsSync(GDIR) ? fs.readdirSync(GDIR).filter(f => f.endsWith('.md')).sort().map(guidePage) : [];
for (const g of guidePages) { put(g.url, g.url, g.html); pages.push(g.url); }
if (guidePages.length) {
  const desc = '국민내일배움카드, 청년 지원, 고졸 취업, 전공 고민처럼 10대·20대 초가 많이 찾는 진로 정보를 공식 출처로 정리했어요.';
  put('/guide/', 'guide/index.html', page({ url: '/guide/', title: '10대·20대 초 진로 가이드 (지원 제도·취업 준비) | 표지기', desc, type: 'website', article: false,
    ld: [collection('/guide/', '진로 가이드', desc, guidePages)],
    body: `<h1>진로 가이드</h1><ul>${guidePages.map(g => `<li><a href="${g.url}">${esc(g.h1)}</a></li>`).join('')}</ul><a class="cta" href="/?src=guide">내 상황에 맞는 길 3개 찾기 (20분, 무료)</a>`,
    crumbs: [['표지기', '/'], ['진로 가이드', '/guide/']] }));
  pages.push('/guide/');
}
put('/privacy.html', 'privacy.html', privacy());
put('/404.html', '404.html', notFound());
pages.push('/jobs/', '/for/', '/privacy.html');
const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` + ['/', ...pages].map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n') + '\n</urlset>\n';
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sm);
// robots.txt: 기존 규칙 유지 + 필수 규칙 보장 + Sitemap 줄 하나
let rb = fs.existsSync(path.join(OUT, 'robots.txt')) ? fs.readFileSync(path.join(OUT, 'robots.txt'), 'utf8') : 'User-agent: *\n';
rb = rb.replace(/^Sitemap:.*$/gim, '').replace(/\n{2,}/g, '\n').trimEnd() + '\n';
for (const r of ['Allow: /', 'Disallow: /stats.html', 'Disallow: /api/', 'Disallow: /ig/']) if (!rb.split('\n').includes(r)) rb += r + '\n';
fs.writeFileSync(path.join(OUT, 'robots.txt'), rb + `Sitemap: ${SITE}/sitemap.xml\n`);

// ---------- 검사: JSON-LD 파싱, 제목·설명 중복, 설명 길이 ----------
const errs = [], titles = {}, descs = {};
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
let ldCount = 0;
for (const [u, h] of Object.entries(written)) {
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { const o = JSON.parse(m[1]); if (!o['@type']) errs.push(u + ' JSON-LD @type 없음'); ldCount++; } catch (e) { errs.push(u + ' JSON-LD 파싱 실패: ' + e.message); } }
  if (u !== '/404.html' && !/"@type":"BreadcrumbList"/.test(h)) errs.push(u + ' BreadcrumbList 없음');
  const t = unesc((h.match(/<title>(.*?)<\/title>/) || [])[1] || ''), d = unesc((h.match(/<meta name="description" content="(.*?)">/) || [])[1] || '');
  if (!t) errs.push(u + ' title 없음'); if (!d) errs.push(u + ' description 없음');
  if (d.length > 160) errs.push(`${u} description ${d.length}자`);
  (titles[t] = titles[t] || []).push(u); (descs[d] = descs[d] || []).push(u);
  if (!/<a href="\/privacy.html">/.test(h) || !/<a href="\/#ask">/.test(h)) errs.push(u + ' footer 링크 누락');
}
for (const [t, us] of Object.entries(titles)) if (us.length > 1) errs.push('title 중복: ' + t + ' ' + us.join(', '));
for (const [d, us] of Object.entries(descs)) if (us.length > 1) errs.push('description 중복: ' + us.join(', '));
if (errs.length) { console.error('검사 실패:\n' + errs.join('\n')); process.exit(1); }
console.log('pages', pages.length + 1, '(+404)', 'json-ld', ldCount, 'ok · site', SITE);
