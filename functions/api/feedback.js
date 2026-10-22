// 표지기 한마디 피드백 저장
// - 300자 이내 문장, 만족도, 상황 종류, 추천 경로 코드, '이건 아니에요' 선택만 받는다
// - 이름·연락처·IP는 저장하지 않는다. 같은 사람 하루 5번까지 (IP는 해시로만 이틀 보관)
// - 저장된 피드백은 90일 뒤 자동 삭제된다

const SITS = ["job", "move", "gap", "slump", "switch", "mil", "hs", "col", "ms", "drop", "retake"];
const PATHS = ["sec","fac","tec","pub","spo","sal","it","off","log","mkt","car","uni","avs","mlc","edu","bop","pln","pbc","svc","hcl","kid","adv","hsj","own","env","tch","nur","ckg","bty","aut","bld","mtc","eng","rea","ath","rail","avi","fin","tax","med","dsn","cns","lgl","arc","trd","diet","art","doc"];
// (SITS 는 아래에서 검사에 씀)
const FB = ["많이 됐어요", "조금 됐어요", "별로예요"];
const KEEP_DAYS = 90, PER_DAY = 5, MAX_TEXT = 300;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.PYOJIGI_KV) return json({ error: "off" }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (!b || typeof b !== "object") return json({ error: "bad_request" }, 400);

  const text = typeof b.text === "string" ? b.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "";
  const fb = FB.includes(b.fb) ? b.fb : null;
  const miss = {};
  if (b.miss && typeof b.miss === "object") for (const k in b.miss) if (PATHS.includes(k) && Number.isInteger(b.miss[k]) && b.miss[k] >= 0 && b.miss[k] <= 3) miss[k] = b.miss[k];
  if (!text && !fb && !Object.keys(miss).length) return json({ error: "empty" }, 400);

  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const who = await sha256(ip + "|" + day + "|" + (env.SALT || "pyojigi"));
  const rk = `fbr:${day}:${who}`;
  const n = +((await env.PYOJIGI_KV.get(rk)) || 0);
  if (n >= PER_DAY) return json({ error: "limit" }, 429);

  const rec = {
    at: new Date().toISOString(),
    fb, text, miss,
    sit: SITS.includes(b.sit) ? b.sit : null,
    top: Array.isArray(b.top) ? b.top.filter(k => PATHS.includes(k)).slice(0, 3) : []
  };
  const id = `fbk:${day}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await env.PYOJIGI_KV.put(id, JSON.stringify(rec), { expirationTtl: KEEP_DAYS * 86400 });
  await env.PYOJIGI_KV.put(rk, String(n + 1), { expirationTtl: 2 * 86400 });
  // 운영자 이메일로 바로 보내기 (Resend). 비밀 변수 RESEND_API_KEY, FEEDBACK_TO 가 있을 때만
  const mail = sendMail(env, rec);
  if (waitUntil) waitUntil(mail); else await mail;
  return json({ ok: true });
}

const PATH_NAME = { sec:"시설·첨단 보안직",fac:"반도체·제조 생산직",tec:"전기·설비 기술직",pub:"공무원·공기업",spo:"생활체육 지도자",sal:"영업·보험설계",it:"IT·데이터·AI",off:"사무·경영지원",log:"물류·운송",mkt:"콘텐츠·마케팅",car:"보건·돌봄",uni:"소방·경찰·교정",avs:"공항·항만 특수보안",mlc:"군무원·직업군인",edu:"교육·강사",bop:"영업관리·구매",pln:"기획·운영",pbc:"공무직·계약직",svc:"서비스·접객",hcl:"교대 없는 보건·의료",kid:"아동·청소년 지도",adv:"진학",hsj:"고졸 공채",own:"사업·프리랜서",env:"환경공무관·미화",tch:"학교 교사",nur:"간호사",ckg:"조리·외식",bty:"미용",aut:"자동차 정비",bld:"건설·인테리어 기능",mtc:"보건의료 기사",eng:"공학 엔지니어",rea:"공인중개사",ath:"운동선수",rail:"철도 기술직",avi:"항공정비사",fin:"금융·보험",tax:"세무·회계",med:"언론·출판·방송",dsn:"디자인",cns:"상담·심리",lgl:"법무 사무",arc:"건축·토목 기술직",trd:"무역·통번역",diet:"영양사",art:"문화예술",doc:"의약 면허직" };
const SIT_NAME = { job:"취업 준비", move:"이직 고민", gap:"쉬는 중", slump:"슬럼프", switch:"분야 전환", mil:"군 복무·전역", hs:"고등학생", col:"대학생", ms:"중학생", drop:"학교 밖", retake:"재수·N수" };
const WHY = ["연봉이 실제와 달라요", "나랑 안 맞아요", "이미 해 봤어요", "준비 기간이 비현실적이에요"];

export async function sendMail(env, rec, fetchFn = fetch) {
  if (!env.RESEND_API_KEY || !env.FEEDBACK_TO) return false;
  const miss = Object.entries(rec.miss || {}).map(([k, v]) => `${PATH_NAME[k] || k} - ${WHY[v] || v}`).join(" / ");
  const text = [
    `시각: ${rec.at.slice(0, 16).replace("T", " ")} (UTC)`,
    `상황: ${SIT_NAME[rec.sit] || "-"}`,
    `추천: ${(rec.top || []).map((k, i) => `${i + 1}) ${PATH_NAME[k] || k}`).join("  ") || "-"}`,
    `도움: ${rec.fb || "선택 안 함"}`,
    `이건 아니에요: ${miss || "없음"}`,
    `한마디: ${rec.text || "없음"}`,
    "", "표지기 결과 화면에서 보낸 익명 피드백이에요. 통계 페이지(/stats.html)에서도 볼 수 있어요."
  ].join("\n");
  try {
    const r = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { "authorization": `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.FEEDBACK_FROM || "표지기 <onboarding@resend.dev>", to: [env.FEEDBACK_TO], subject: `[표지기 피드백] ${rec.fb || "한마디"}${rec.text ? " · " + rec.text.slice(0, 30) : ""}`, text })
    });
    return r.ok;
  } catch { return false; }
}
