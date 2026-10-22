// 표지기 익명 이용 기록
// 답 내용, 적은 문장, 이름, IP, 브라우저 정보는 저장하지 않는다. 정해진 값(상황 종류, 나이대 번호, 추천된 길 코드, 만족도,
// 들어온 사이트 주소(호스트만)·검색어 40자)만 남긴다.
// D1 데이터베이스(DB)가 연결돼 있으면 한 건씩 기록(동시에 많이 와도 빠지지 않음), 없으면 KV에 날짜별 숫자만 센다.

import { SITS, PATHS, FB, json, ensure, SCHEMA, kstAt } from "../_lib/common.js";
export { ensure, SCHEMA };
const ST_TTL = 731 * 86400; // KV 날짜별 숫자는 2년 보관
const TYPES = ["visit", "start", "finish", "feedback", "copy", "miss", "leave", "etc"];
const ETC_Q = ["goal", "cert", "plan"]; // '기타'에 직접 적은 직업·자격 이름 (목록에 없던 것만)
const inc = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };
const incCap = (st, name, key, cap = 80) => { const o = st[name] = st[name] || {}; if (Object.keys(o).length < cap || o[key]) inc(o, key); };

// 들어온 곳: 이전 사이트 주소(호스트)만. 검색어: 40자 이내, 제어문자·꺾쇠 제거
export function cleanRef(v) {
  if (typeof v !== "string") return null;
  const h = v.trim().toLowerCase();
  return /^[a-z0-9.-]{1,60}$/.test(h) ? h : null;
}
export function cleanKw(v) {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return t || null;
}

// 받은 값을 검사해 저장할 한 줄로 만든다. 틀린 값이면 null
export function clean(e) {
  if (!e || typeof e.type !== "string" || !TYPES.includes(e.type)) return null;
  const r = { type: e.type, sit: null, age: null, ag: null, top1: null, top2: null, top3: null, low: null, fb: null, src: null, why: null, qid: null, ref: null, kw: null };
  if (e.type === "visit") {
    if (typeof e.src === "string" && /^[a-z0-9_-]{1,30}$/i.test(e.src)) r.src = e.src.toLowerCase();
    r.ref = cleanRef(e.ref); r.kw = cleanKw(e.kw);
  }
  else if (e.type === "finish") {
    if (SITS.includes(e.sit)) r.sit = e.sit;
    if (Number.isInteger(e.age) && e.age >= 0 && e.age <= 6) r.age = e.age;
    if (Number.isInteger(e.ag) && e.ag >= 0 && e.ag <= 3) r.ag = e.ag;
    const tops = Array.isArray(e.tops) ? e.tops.filter(k => PATHS.includes(k)).slice(0, 3) : (PATHS.includes(e.top) ? [e.top] : []);
    [r.top1, r.top2, r.top3] = [tops[0] || null, tops[1] || null, tops[2] || null];
    r.low = e.low === true ? 1 : 0;
  } else if (e.type === "feedback") { if (!FB.includes(e.fb)) return null; r.fb = e.fb; }
  else if (e.type === "miss") { if (!PATHS.includes(e.top) || !Number.isInteger(e.why) || e.why < 0 || e.why > 3) return null; r.top1 = e.top; r.why = e.why; }
  else if (e.type === "leave") { if (typeof e.at !== "string" || !/^[a-z0-9_-]{1,12}$/.test(e.at)) return null; r.qid = e.at; }
  else if (e.type === "etc") {
    // 직업·자격 이름만 받는다: 30자 이하, 숫자 5개 이상 연속(전화번호 등)·@(이메일)·주소 같은 건 거절
    if (!ETC_Q.includes(e.q) || typeof e.t !== "string") return null;
    const t = e.t.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF<>"'`]/g, " ").replace(/\s+/g, " ").trim();
    if (!t || t.length > 30 || /\d{5,}|@|https?:|www\.|\d+-\d+-\d+/i.test(t)) return null;
    r.qid = e.q; r.kw = t;
  }
  return r;
}

export async function onRequestPost({ request, env }) {
  let e;
  try { e = await request.json(); } catch { return json({ ok: false }, 400); }
  const r = clean(e);
  if (!r) return json({ ok: false }, 400);
  const at = kstAt(), day = at.slice(0, 10);              // 한국 시간

  if (env.DB) {
    try {
      await ensure(env.DB);
      await env.DB.prepare(`INSERT INTO events (at,day,type,sit,age,ag,top1,top2,top3,low,fb,src,why,qid,ref,kw) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(at, day, r.type, r.sit, r.age, r.ag, r.top1, r.top2, r.top3, r.low, r.fb, r.src, r.why, r.qid, r.ref, r.kw).run();
      return json({ ok: true });
    } catch (err) { if (env.DEBUG) console.log("DBERR", err.message); /* DB 문제가 생기면 아래 KV로 센다 */ }
  }
  if (!env.PYOJIGI_KV) return json({ ok: false }, 503);
  const key = `st:${day}`;
  const st = JSON.parse((await env.PYOJIGI_KV.get(key)) || "{}");
  if (r.type === "visit") { inc(st, "visit"); if (r.src) incCap(st, "src", r.src, 50); if (r.ref) incCap(st, "ref", r.ref); if (r.kw) incCap(st, "kw", r.kw); }
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
  else if (r.type === "leave") incCap(st, "leave", r.qid);
  else if (r.type === "etc") incCap(st, "etc", r.qid + ":" + r.kw, 100);
  await env.PYOJIGI_KV.put(key, JSON.stringify(st), { expirationTtl: ST_TTL });
  return json({ ok: true });
}
