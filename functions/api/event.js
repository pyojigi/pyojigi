// 표지기 익명 이용 기록
// 답 내용, 적은 문장, 이름, IP는 저장하지 않는다. 정해진 값(상황 종류, 나이대 번호, 추천된 길 코드, 만족도)만 남긴다.
// D1 데이터베이스(DB)가 연결돼 있으면 한 건씩 기록(동시에 많이 와도 빠지지 않음), 없으면 KV에 날짜별 숫자만 센다.

const SITS = ["job", "move", "gap", "slump", "switch", "mil", "hs", "col", "ms", "drop", "retake"];
const PATHS = ["sec","fac","tec","pub","spo","sal","it","off","log","mkt","car","uni","avs","mlc","edu","bop","pln","pbc","svc","hcl","kid","adv","hsj","own","env","tch","nur","ckg","bty","aut","bld","mtc","eng","rea","ath","rail","avi","fin","tax","med","dsn","cns","lgl","arc","trd","diet","art","doc"];
const FB = ["많이 됐어요", "조금 됐어요", "별로예요"];
const TYPES = ["visit", "start", "finish", "feedback", "copy", "miss", "leave"];

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const inc = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };

export const SCHEMA = `CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL, day TEXT NOT NULL, type TEXT NOT NULL,
  sit TEXT, age INTEGER, ag INTEGER, top1 TEXT, top2 TEXT, top3 TEXT,
  low INTEGER, fb TEXT, src TEXT, why INTEGER, qid TEXT)`;
export const INDEX = `CREATE INDEX IF NOT EXISTS ev_day_type ON events(day, type)`;
let ready = false;
export async function ensure(db) {
  if (ready) return;
  await db.prepare(SCHEMA).run();
  await db.prepare(INDEX).run();
  ready = true;
}

// 받은 값을 검사해 저장할 한 줄로 만든다. 틀린 값이면 null
export function clean(e) {
  if (!e || typeof e.type !== "string" || !TYPES.includes(e.type)) return null;
  const r = { type: e.type, sit: null, age: null, ag: null, top1: null, top2: null, top3: null, low: null, fb: null, src: null, why: null, qid: null };
  if (e.type === "visit") { if (typeof e.src === "string" && /^[a-z0-9_-]{1,30}$/i.test(e.src)) r.src = e.src.toLowerCase(); }
  else if (e.type === "finish") {
    if (SITS.includes(e.sit)) r.sit = e.sit;
    if (Number.isInteger(e.age) && e.age >= 0 && e.age <= 6) r.age = e.age;
    if (Number.isInteger(e.ag) && e.ag >= 0 && e.ag <= 3) r.ag = e.ag;
    const tops = Array.isArray(e.tops) ? e.tops.filter(k => PATHS.includes(k)).slice(0, 3) : (PATHS.includes(e.top) ? [e.top] : []);
    [r.top1, r.top2, r.top3] = [tops[0] || null, tops[1] || null, tops[2] || null];
    r.low = e.low === true ? 1 : 0;
  } else if (e.type === "feedback") { if (!FB.includes(e.fb)) return null; r.fb = e.fb; }
  else if (e.type === "miss") { if (!PATHS.includes(e.top) || !Number.isInteger(e.why) || e.why < 0 || e.why > 3) return null; r.top1 = e.top; r.why = e.why; }
  else if (e.type === "leave") { if (typeof e.at !== "string" || !/^[a-z0-9]{1,8}$/.test(e.at)) return null; r.qid = e.at; }
  return r;
}

export async function onRequestPost({ request, env }) {
  let e;
  try { e = await request.json(); } catch { return json({ ok: false }, 400); }
  const r = clean(e);
  if (!r) return json({ ok: false }, 400);
  const now = new Date(Date.now() + 9 * 3600e3);              // 한국 시간
  const at = now.toISOString().slice(0, 16).replace("T", " "), day = at.slice(0, 10);

  if (env.DB) {
    try {
      await ensure(env.DB);
      await env.DB.prepare(`INSERT INTO events (at,day,type,sit,age,ag,top1,top2,top3,low,fb,src,why,qid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(at, day, r.type, r.sit, r.age, r.ag, r.top1, r.top2, r.top3, r.low, r.fb, r.src, r.why, r.qid).run();
      return json({ ok: true });
    } catch (err) { if (env.DEBUG) console.log("DBERR", err.message); /* DB 문제가 생기면 아래 KV로 센다 */ }
  }
  if (!env.PYOJIGI_KV) return json({ ok: false }, 503);
  const key = `st:${day}`;
  const st = JSON.parse((await env.PYOJIGI_KV.get(key)) || "{}");
  if (r.type === "visit") { inc(st, "visit"); if (r.src) { st.src = st.src || {}; if (Object.keys(st.src).length < 50 || st.src[r.src]) inc(st.src, r.src); } }
  else if (r.type === "start") inc(st, "start");
  else if (r.type === "finish") {
    inc(st, "finish");
    if (r.sit) { st.sit = st.sit || {}; inc(st.sit, r.sit); }
    if (r.age != null) { st.age = st.age || {}; inc(st.age, String(r.age)); }
    if (r.ag != null) { st.ag = st.ag || {}; inc(st.ag, String(r.ag)); }
    if (r.top1) { st.top = st.top || {}; inc(st.top, r.top1); }
    st.top3 = st.top3 || {}; for (const k of [r.top1, r.top2, r.top3]) if (k) inc(st.top3, k);
    if (r.low) inc(st, "low");
    st.runs = st.runs || []; if (st.runs.length < 300) st.runs.push({ at, sit: r.sit, ag: r.ag, tops: [r.top1, r.top2, r.top3].filter(Boolean) });
  }
  else if (r.type === "feedback") { st.fb = st.fb || {}; inc(st.fb, r.fb); }
  else if (r.type === "copy") inc(st, "fbCopy");
  else if (r.type === "miss") { st.miss = st.miss || {}; inc(st.miss, r.top1 + ":" + r.why); }
  else if (r.type === "leave") { st.leave = st.leave || {}; if (Object.keys(st.leave).length < 80 || st.leave[r.qid]) inc(st.leave, r.qid); }
  await env.PYOJIGI_KV.put(key, JSON.stringify(st));
  return json({ ok: true });
}
