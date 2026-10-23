// 표지기 서버 공용 도구 (라우트가 아님: onRequest 함수를 내보내지 않는다)
// - 모든 응답은 JSON, 기본 cache-control: no-store
// - IP 원문은 절대 저장하지 않고, 날짜·SALT 와 섞은 SHA-256 해시만 하루 횟수 세는 데 쓴다
// - 시각은 모두 한국 시간(KST) "YYYY-MM-DD HH:MM"

export const SITS = ["job", "move", "gap", "slump", "switch", "mil", "hs", "col", "ms", "drop", "retake"];
export const PATHS = ["sec","fac","tec","pub","spo","sal","it","off","log","mkt","car","uni","avs","mlc","edu","bop","pln","pbc","svc","hcl","kid","adv","hsj","own","env","tch","nur","ckg","bty","aut","bld","mtc","eng","rea","ath","rail","avi","fin","tax","med","dsn","cns","lgl","arc","trd","diet","art","doc","law","pro"];
export const FB = ["많이 됐어요", "조금 됐어요", "별로예요"];

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });

export const kstAt = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
export const kstDay = (back = 0) => kstAt(Date.now() - back).slice(0, 10);

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
// 같은 사람(같은 IP)을 하루 단위로만 알아보는 해시. IP 원문은 어디에도 남기지 않는다
export async function whoHash(request, env, day) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  return sha256(ip + "|" + day + "|" + (env.SALT || "pyojigi"));
}

// 키 비교 (길이가 같으면 끝까지 비교)
export function sameKey(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// "admin" | "readonly" | null
export function keyRole(env, key) {
  if (env.ADMIN_KEY && env.ADMIN_KEY.length >= 8 && sameKey(key, env.ADMIN_KEY)) return "admin";
  if (env.FEEDBACK_KEY && env.FEEDBACK_KEY.length >= 8 && sameKey(key, env.FEEDBACK_KEY)) return "readonly";
  return null;
}

// 사용자가 적은 글 정리: HTML 태그·꺾쇠·제어문자·방향 제어문자 제거. 길이 검사는 부르는 쪽에서
export function cleanText(s, multiline = false) {
  if (typeof s !== "string") return "";
  let t = s.replace(/<[^>]*>/g, " ").replace(/[<>]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g, " ");
  if (multiline) t = t.replace(/[ \t 　]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  else t = t.replace(/\s+/g, " ").trim();
  return t;
}

// ---------- D1 스키마 (처음 한 번, 예전 테이블이면 칸을 덧붙인다) ----------
export const SCHEMA = `CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL, day TEXT NOT NULL, type TEXT NOT NULL,
  sit TEXT, age INTEGER, ag INTEGER, top1 TEXT, top2 TEXT, top3 TEXT,
  low INTEGER, fb TEXT, src TEXT, why INTEGER, qid TEXT, ref TEXT, kw TEXT)`;
const STEPS = [
  `CREATE INDEX IF NOT EXISTS ev_day_type ON events(day, type)`,
  `CREATE TABLE IF NOT EXISTS asks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, at TEXT NOT NULL,
    kind TEXT NOT NULL, text TEXT NOT NULL, reply TEXT, replied_at TEXT,
    status TEXT NOT NULL DEFAULT 'open')`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, text TEXT NOT NULL,
    fb TEXT, sit TEXT, status TEXT NOT NULL DEFAULT 'pending')`,
  `CREATE INDEX IF NOT EXISTS rv_status ON reviews(status, id)`,
  `CREATE TABLE IF NOT EXISTS rl (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)`
];
const NEW_EVENT_COLS = ["ref", "kw"];
const readyFor = new WeakMap();
async function migrate(db) {
  await db.prepare(SCHEMA).run();
  const info = await db.prepare(`PRAGMA table_info(events)`).all();
  const have = new Set((info.results || []).map(r => r.name));
  for (const c of NEW_EVENT_COLS) {
    if (have.has(c)) continue;
    try { await db.prepare(`ALTER TABLE events ADD COLUMN ${c} TEXT`).run(); }
    catch (e) { if (!/duplicate column/i.test(String(e && e.message))) throw e; } // 다른 요청이 먼저 덧붙인 경우
  }
  for (const s of STEPS) await db.prepare(s).run();
}
export function ensure(db) {
  let p = readyFor.get(db);
  if (!p) { p = migrate(db).catch(e => { readyFor.delete(db); throw e; }); readyFor.set(db, p); }
  return p;
}

// ---------- 하루 횟수 제한 (D1 우선, 안 되면 KV). 허용이면 true ----------
export async function allow(env, bucket, who, day, limit) {
  const k = `${bucket}:${day}:${who}`;
  if (env.DB) {
    try {
      await ensure(env.DB);
      const r = await env.DB.prepare(`INSERT INTO rl (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`).bind(k, day).first();
      return ((r && r.n) || 1) <= limit;
    } catch (e) { if (env.DEBUG) console.log("DBERR rl", e.message); }
  }
  if (!env.PYOJIGI_KV) return true;
  const kk = `lim:${k}`;
  const n = +((await env.PYOJIGI_KV.get(kk)) || 0);
  if (n >= limit) return false;
  await env.PYOJIGI_KV.put(kk, String(n + 1), { expirationTtl: 2 * 86400 });
  return true;
}

// KV 목록 (cursor 따라가며 최대 max개 이름)
export async function kvKeys(kv, prefix, max = 2000) {
  const names = [];
  let cursor;
  do {
    const page = await kv.list({ prefix, cursor, limit: 1000 });
    for (const k of page.keys) names.push(k.name);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && names.length < max);
  return names;
}
