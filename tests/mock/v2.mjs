// 표지기 v2 서버 시험: 들어온 곳/검색어, 스키마 덧붙이기, 문의, 운영자 동작, 읽기 전용 키, 후기 승인, 동시 기록
// 실행: node --no-warnings ./v2.mjs
import { DatabaseSync } from "node:sqlite";
import { onRequestPost as ev } from "../../functions/api/event.js";
import { onRequestGet as st } from "../../functions/api/stats.js";
import { onRequestPost as fbPost } from "../../functions/api/feedback.js";
import { onRequestPost as askPost, onRequestGet as askGet } from "../../functions/api/ask.js";
import { onRequestPost as admin } from "../../functions/api/admin.js";
import { onRequestGet as reviewsGet } from "../../functions/api/reviews.js";

// ---- 흉내 D1 (node:sqlite) / KV ----
function D1(raw = new DatabaseSync(":memory:")) {
  const w = { raw, prepare(sql) { let args = []; const s = {
    bind(...a) { args = a; return s; },
    async run() { await null; raw.prepare(sql).run(...args); return { success: true }; },
    async all() { await null; return { results: raw.prepare(sql).all(...args) }; },
    async first() { await null; return raw.prepare(sql).get(...args) || null; } }; return s; } };
  return w;
}
function BrokenD1() { return { prepare() { const s = { bind() { return s; }, run: async () => { throw new Error("D1 down"); }, all: async () => { throw new Error("D1 down"); }, first: async () => { throw new Error("D1 down"); } }; return s; } }; }
function KV() {
  const m = new Map(), ttl = {};
  return { m, ttl, get: async k => m.get(k) ?? null, put: async (k, v, o) => { m.set(k, v); if (o && o.expirationTtl) ttl[k] = o.expirationTtl; },
    delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).sort().map(name => ({ name })), list_complete: true }) };
}
const ADMIN = "admin-key-1234", RO = "read-only-5678", RK = "reply-key-9012";
const req = (url, body, ip = "9.9.9.9", method = body ? "POST" : "GET") =>
  new Request(url, { method, headers: { "content-type": "application/json", "cf-connecting-ip": ip, "user-agent": "Mozilla/5.0 TESTUA" }, body: body ? JSON.stringify(body) : undefined });
const call = async (fn, env, url, body, ip) => { const r = await fn({ request: req(url, body, ip), env }); return { s: r.status, h: r.headers.get("cache-control"), j: await r.json() }; };
const E = (env, b, ip) => call(ev, env, "http://x/api/event", b, ip);
const S = (env, key, days = "30", ip) => call(st, env, `http://x/api/stats?key=${encodeURIComponent(key)}&days=${days}`, null, ip);
const A = (env, b, ip) => call(admin, env, "http://x/api/admin", b, ip);
const AP = (env, b, ip) => call(askPost, env, "http://x/api/ask", b, ip);
const AG = (env, code, ip) => call(askGet, env, `http://x/api/ask?code=${encodeURIComponent(code)}`, null, ip);
const F = (env, b, ip) => call(fbPost, env, "http://x/api/feedback", b, ip);
const R = env => call(reviewsGet, env, "http://x/api/reviews");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; console.log("FAIL", name, extra); } };
const CODE = /^[2-9A-HJKMNP-Z]{8}$/;

// ---------- 1. 예전 events 테이블에서 시작 (ref, kw 칸 없음) ----------
{
  const raw = new DatabaseSync(":memory:");
  raw.exec(`CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, day TEXT NOT NULL, type TEXT NOT NULL,
    sit TEXT, age INTEGER, ag INTEGER, top1 TEXT, top2 TEXT, top3 TEXT, low INTEGER, fb TEXT, src TEXT, why INTEGER, qid TEXT)`);
  raw.exec(`INSERT INTO events (at, day, type) VALUES ('2026-10-01 10:00','2026-10-01','visit')`);
  const env = { DB: D1(raw), PYOJIGI_KV: KV(), ADMIN_KEY: ADMIN, SALT: "s", DEBUG: 1 };
  // 50명이 동시에 처음 들어와도 칸 덧붙이기가 한 번만 되고 하나도 안 빠져야 한다
  const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => E(env, { type: "visit", ref: i % 2 ? "Search.Naver.com" : "www.google.com", kw: i % 5 ? "보안직 연봉" : null })));
  ok("migration: 50 visits ok", rs.every(r => r.s === 200 && r.j.ok));
  const cols = raw.prepare("PRAGMA table_info(events)").all().map(c => c.name);
  ok("migration: ref/kw added", cols.includes("ref") && cols.includes("kw"), cols.join());
  ok("migration: old row kept, 51 rows", raw.prepare("SELECT COUNT(*) n FROM events").get().n === 51);
  // 같은 DB에 새 연결(새 env.DB 객체)로 다시 ensure 해도 오류 없음 (멱등)
  const env2 = { ...env, DB: D1(raw) };
  ok("migration: idempotent second ensure", (await E(env2, { type: "visit", ref: "m.search.daum.net" })).j.ok === true);
  const s = await S(env2, ADMIN);
  ok("migration: stats refs", s.j.refs["search.naver.com"] === 25 && s.j.refs["www.google.com"] === 25 && s.j.refs["m.search.daum.net"] === 1, JSON.stringify(s.j.refs));
  ok("migration: stats kws", s.j.kws["보안직 연봉"] === 40, JSON.stringify(s.j.kws));
}

// ---------- 2. 방문 값 검사 (D1) ----------
const raw = new DatabaseSync(":memory:");
const env = { DB: D1(raw), PYOJIGI_KV: KV(), ADMIN_KEY: ADMIN, FEEDBACK_KEY: RO, REPLY_KEY: RK, SALT: "s", DEBUG: 1 };
{
  await E(env, { type: "visit", src: "insta", ref: "https://evil.com/path", kw: "<script>alert(1)</script>\u0007 취업\n상담" + "가".repeat(60) });
  await E(env, { type: "visit", ref: "a".repeat(61) });
  await E(env, { type: "visit", ref: "Google.COM", kw: "   " });
  const rows = raw.prepare("SELECT src, ref, kw FROM events WHERE type='visit' ORDER BY id").all();
  ok("visit: url ref rejected", rows[0].ref === null && rows[0].src === "insta");
  ok("visit: kw cleaned, ≤40, no <>", rows[0].kw.length <= 40 && !/[<>\u0007\n]/.test(rows[0].kw), JSON.stringify(rows[0].kw));
  ok("visit: long ref rejected", rows[1].ref === null);
  ok("visit: ref lowercased, blank kw null", rows[2].ref === "google.com" && rows[2].kw === null);
  ok("leave: screen name ok", (await E(env, { type: "leave", at: "result_scr" })).s === 200);
  for (const sc of ["intro", "result", "cal", "dict", "all", "privacy", "ask", "mid"]) ok("leave: screen " + sc, (await E(env, { type: "leave", at: sc })).s === 200);
  ok("leave: q id ok", (await E(env, { type: "leave", at: "ms1" })).s === 200);
  ok("leave: 13 chars rejected", (await E(env, { type: "leave", at: "abcdefghijklm" })).s === 400);
  ok("leave: uppercase rejected", (await E(env, { type: "leave", at: "Q1" })).s === 400);
  ok("etc: goal ok", (await E(env, { type: "etc", q: "goal", t: "드론 조종사", once: true })).s === 200);
  ok("etc: plan ok", (await E(env, { type: "etc", q: "plan", t: "조주기능사", once: true })).s === 200);
  ok("etc: phone rejected", (await E(env, { type: "etc", q: "goal", t: "010-1234-5678" })).s === 400);
  ok("etc: digits rejected", (await E(env, { type: "etc", q: "goal", t: "연락 01012345678" })).s === 400);
  ok("etc: email rejected", (await E(env, { type: "etc", q: "goal", t: "a@b.com" })).s === 400);
  ok("etc: url rejected", (await E(env, { type: "etc", q: "cert", t: "https://x.y" })).s === 400);
  ok("etc: 31 chars rejected", (await E(env, { type: "etc", q: "goal", t: "가".repeat(31) })).s === 400);
  ok("etc: bad q rejected", (await E(env, { type: "etc", q: "inc", t: "기타" })).s === 400);
  ok("etc: old style (no once) ok", (await E(env, { type: "etc", q: "goal", t: "드론 조종사" })).s === 200);
  ok("etc: once stored as person", raw.prepare("SELECT COUNT(*) c FROM events WHERE type='etc' AND why=1").get().c === 2 && raw.prepare("SELECT COUNT(*) c FROM events WHERE type='etc' AND why IS NULL").get().c === 1);
  ok("etc: tags stripped", raw.prepare("SELECT kw FROM events WHERE type='etc' AND qid='goal'").get().kw === "드론 조종사");
}

// ---------- 3. KV 만 있을 때 방문 ----------
{
  const kenv = { PYOJIGI_KV: KV(), ADMIN_KEY: ADMIN, FEEDBACK_KEY: RO };
  await E(kenv, { type: "visit", ref: "search.naver.com", kw: "경비지도사" });
  await E(kenv, { type: "visit", ref: "search.naver.com", kw: "경비지도사" });
  for (let i = 0; i < 100; i++) await E(kenv, { type: "visit", ref: `h${i}.com`, kw: `k${i}` });
  const day = [...kenv.PYOJIGI_KV.m.keys()].find(k => k.startsWith("st:"));
  const stv = JSON.parse(kenv.PYOJIGI_KV.m.get(day));
  ok("kv: ref counted", stv.ref["search.naver.com"] === 2 && stv.kw["경비지도사"] === 2);
  ok("kv: cap 80 keys", Object.keys(stv.ref).length === 80 && Object.keys(stv.kw).length === 80, Object.keys(stv.ref).length);
  await E(kenv, { type: "etc", q: "cert", t: "바리스타 2급", once: true });
  ok("kv: etc counted", JSON.parse(kenv.PYOJIGI_KV.m.get(day)).etc["cert:바리스타 2급"] === 1);
  ok("kv: st TTL 2y", kenv.PYOJIGI_KV.ttl[day] === 731 * 86400);
  const s = await S(kenv, RO);
  ok("kv stats: refs/kws/readonly", s.s === 200 && s.j.store === "kv" && s.j.refs["search.naver.com"] === 2 && s.j.kws["경비지도사"] === 2 && s.j.readonly === true && s.j.etc["cert:바리스타 2급"] === 1);
}

// ---------- 4. 문의 ----------
let code;
{
  ok("ask: no agree", (await AP(env, { kind: "문의", text: "안녕하세요" })).j.error === "agree");
  ok("ask: agree string rejected", (await AP(env, { kind: "문의", text: "안녕하세요", agree: "true" })).s === 400);
  const e1 = await AP(env, { kind: "문의", text: "   \n ", agree: true });
  ok("ask: empty", e1.s === 400 && e1.j.error === "empty");
  ok("ask: html-only is empty", (await AP(env, { kind: "문의", text: "<b></b>", agree: true })).j.error === "empty");
  ok("ask: 501 chars rejected", (await AP(env, { kind: "문의", text: "가".repeat(501), agree: true })).j.error === "long");
  const r = await AP(env, { kind: "오류 신고", text: "  <img src=x onerror=alert(1)>결과 화면이\n\n\n\n안 떠요  ", agree: true });
  code = r.j.code;
  ok("ask: created", r.s === 200 && r.j.ok && CODE.test(code) && r.h === "no-store", JSON.stringify(r));
  const g = await AG(env, code.toLowerCase());
  ok("ask: lookup (lowercase ok)", g.s === 200 && g.j.ok && g.j.kind === "오류 신고" && g.j.text === "결과 화면이\n\n안 떠요" && g.j.status === "open" && g.j.reply === null && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(g.j.at), JSON.stringify(g.j));
  ok("ask: lookup keys exact", JSON.stringify(Object.keys(g.j).sort()) === JSON.stringify(["at", "kind", "ok", "replied_at", "reply", "status", "text"]));
  ok("ask: notfound", (await AG(env, "ZZZZZZZZ")).s === 404 && (await AG(env, "bad")).j.error === "notfound");
  ok("ask: bad kind -> 문의", (await AP(env, { kind: "해킹", text: "제안이요", agree: true })).s === 200);
  for (let i = 0; i < 3; i++) await AP(env, { kind: "제안", text: "제안 " + i, agree: true });
  const lim = await AP(env, { kind: "제안", text: "여섯 번째", agree: true });
  ok("ask: 6th per day 429", lim.s === 429 && lim.j.error === "limit");
  ok("ask: other ip still ok", (await AP(env, { kind: "제안", text: "다른 사람", agree: true }, "8.8.8.8")).s === 200);
  let last; for (let i = 0; i < 30; i++) last = await AG(env, "ABCDEFGH", "7.7.7.7");
  ok("ask lookup: 30 allowed", last.s === 404);
  const l31 = await AG(env, code, "7.7.7.7");
  ok("ask lookup: 31st 429", l31.s === 429 && l31.j.error === "limit");
  const codes = new Set(); for (let i = 0; i < 2000; i++) codes.add((await import("../../functions/_lib/store.js")).newCode());
  ok("ask: codes unambiguous alphabet", [...codes].every(c => CODE.test(c)) && codes.size === 2000);
}

// ---------- 5. 운영자 동작 ----------
{
  ok("admin: wrong key 401", (await A(env, { key: "wrong-key-000", action: "close", code })).s === 401);
  ok("admin: FEEDBACK_KEY 401", (await A(env, { key: RO, action: "close", code })).s === 401);
  ok("admin: short ADMIN_KEY env 401", (await A({ ...env, ADMIN_KEY: "short" }, { key: "short", action: "close", code })).s === 401);
  ok("admin: no key 401", (await A(env, { action: "close", code })).s === 401);
  ok("admin: empty reply", (await A(env, { key: ADMIN, action: "reply", code, reply: "  " })).j.error === "empty");
  ok("admin: long reply", (await A(env, { key: ADMIN, action: "reply", code, reply: "가".repeat(1001) })).j.error === "long");
  ok("admin: reply unknown code 404", (await A(env, { key: ADMIN, action: "reply", code: "ZZZZZZZZ", reply: "x" })).s === 404);
  ok("admin: REPLY_KEY close 401", (await A(env, { key: RK, action: "close", code })).s === 401);
  ok("admin: REPLY_KEY review 401", (await A(env, { key: RK, action: "review", id: 1, approve: true })).s === 401);
  ok("admin: REPLY_KEY unknown 404", (await A(env, { key: RK, action: "reply", code: "ZZZZZZZZ", reply: "x" })).s === 404);
  ok("admin: REPLY_KEY same as FEEDBACK_KEY 401", (await A({ ...env, REPLY_KEY: RO }, { key: RO, action: "reply", code, reply: "x" })).s === 401);
  const rr = await A(env, { key: RK, action: "reply", code, reply: "확인했어요. <b>고쳤어요</b>\n고맙습니다!" });
  ok("admin: reply ok", rr.s === 200 && rr.j.ok && rr.h === "no-store");
  const g = await AG(env, code, "6.6.6.6");
  ok("ask: shows reply", g.j.status === "answered" && g.j.reply === "확인했어요. 고쳤어요\n고맙습니다!" && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(g.j.replied_at), JSON.stringify(g.j));
  ok("admin: REPLY_KEY no overwrite 409", (await A(env, { key: RK, action: "reply", code, reply: "덮어쓰기" })).s === 409);
  ok("admin: ADMIN can overwrite", (await A(env, { key: ADMIN, action: "reply", code, reply: "확인했어요. <b>고쳤어요</b>\n고맙습니다!" })).j.ok);
  ok("admin: close ok", (await A(env, { key: ADMIN, action: "close", code })).j.ok);
  ok("ask: closed", (await AG(env, code, "6.6.6.6")).j.status === "closed");
  ok("admin: bad action", (await A(env, { key: ADMIN, action: "drop_table" })).s === 400);
  // 틀린 키 계속 시도하면 막힘
  let lastBad; for (let i = 0; i < 21; i++) lastBad = await A(env, { key: "guess-" + i + "xxxx", action: "close", code }, "5.5.5.5");
  ok("admin: brute force 429", lastBad.s === 429);
}

// ---------- 6. 후기 (동의 -> 서버가 바로 승인/거절 -> 운영자가 뒤집을 수 있음) ----------
{
  ok("feedback: no public flag still ok", (await F(env, { fb: "많이 됐어요", text: "그냥 한마디", sit: "job" }, "1.1.1.1")).j.ok === true);
  ok("feedback: public w/o text no review", (await F(env, { fb: "조금 됐어요", public: true }, "1.1.1.1")).j.ok === true);
  ok("feedback: public:'true' string ignored", (await F(env, { text: "문자열 동의", public: "true" }, "1.1.1.1")).j.ok === true);
  ok("feedback: public ok", (await F(env, { fb: "많이 됐어요", text: "<i>보안직</i> 길이 생각보다 현실적이었어요 카톡으로 공유함", sit: "mil", public: true, top: ["sec"] }, "1.1.1.1")).j.ok === true);
  ok("feedback: second public", (await F(env, { fb: "별로예요", text: "광고 같아요 ㅅㅂ", public: true }, "1.1.1.1")).j.ok === true);
  const rows = raw.prepare("SELECT * FROM reviews ORDER BY id").all();
  ok("reviews: only consented+text stored, auto-rejected (no pending)", rows.length === 2 && rows.every(r => r.status === "rejected") && rows[0].text === "보안직 길이 생각보다 현실적이었어요 카톡으로 공유함" && rows[0].sit === "mil", JSON.stringify(rows));
  let pub = await R(env);
  ok("reviews: rejected ones not public", pub.s === 200 && pub.j.reviews.length === 0 && pub.h === "public, max-age=300", pub.h);
  ok("admin review: readonly key 401", (await A(env, { key: RO, action: "review", id: rows[0].id, approve: true })).s === 401);
  ok("admin review: bad approve", (await A(env, { key: ADMIN, action: "review", id: rows[0].id, approve: "yes" })).s === 400);
  ok("admin review: approve", (await A(env, { key: ADMIN, action: "review", id: rows[0].id, approve: true })).j.ok);
  ok("admin review: reject (string id)", (await A(env, { key: ADMIN, action: "review", id: String(rows[1].id), approve: false })).j.ok);
  ok("admin review: unknown 404", (await A(env, { key: ADMIN, action: "review", id: 999, approve: true })).s === 404);
  pub = await R(env);
  const v = pub.j.reviews;
  ok("reviews: approved visible, exact fields", v.length === 1 && v[0].text === "보안직 길이 생각보다 현실적이었어요 카톡으로 공유함" && v[0].fb === "많이 됐어요" && v[0].sit === "mil" && /^\d{4}-\d\d-\d\d$/.test(v[0].day) && JSON.stringify(Object.keys(v[0]).sort()) === '["day","fb","sit","text"]', JSON.stringify(pub.j));
  // 20개만
  for (let i = 0; i < 25; i++) raw.prepare("INSERT INTO reviews (at, text, fb, sit, status) VALUES (?, ?, NULL, NULL, 'approved')").run("2026-01-01 00:00", "옛 후기 " + i);
  ok("reviews: max 20, newest first", (await R(env)).j.reviews.length === 20 && (await R(env)).j.reviews[0].text.startsWith("보안직"));
  ok("admin: delete_review", (await A(env, { key: ADMIN, action: "delete_review", id: rows[1].id })).j.ok && !raw.prepare("SELECT 1 FROM reviews WHERE id=?").get(rows[1].id));
}


// ---------- 6-1. 후기 전부 자동 (깨끗한 글은 바로 공개, 걸리는 글은 바로 거절, 대기 없음) ----------
{
  const raw2 = new DatabaseSync(":memory:"); const env2 = { DB: D1(raw2), PYOJIGI_KV: KV(), ADMIN_KEY: ADMIN, SALT: "s" };
  await F(env2, { fb: "많이 됐어요", text: "결과가 생각보다 잘 맞아서 좋았어요", public: true, sit: "hs" }, "2.2.2.2");
  for (const t of ["서울고등학교 다녀요 좋았어요", "010-1234-5678 연락 주세요", "진짜 죽고 싶었는데", "이거 존나 별로임", "좋아요"]) await F(env2, { fb: "많이 됐어요", text: t, public: true }, "2.2.2." + t.length);
  const rs = raw2.prepare("SELECT text, status FROM reviews ORDER BY id").all();
  ok("auto: clean review approved", rs[0].status === "approved", JSON.stringify(rs));
  ok("auto: risky reviews rejected, none pending", rs.slice(1).every(r => r.status === "rejected") && rs.length === 6 && !rs.some(r => r.status === "pending"), JSON.stringify(rs));
  ok("auto: rejected can be flipped to approved by admin", (await A(env2, { key: ADMIN, action: "review", id: raw2.prepare("SELECT id FROM reviews WHERE text LIKE '서울고%'").get().id, approve: true })).j.ok);
  const pub2 = await R(env2);
  ok("auto: clean one + admin-flipped one public", pub2.j.reviews.length === 2 && pub2.j.reviews.some(r => r.text === "결과가 생각보다 잘 맞아서 좋았어요"), JSON.stringify(pub2.j));
}
// ---------- 7. 통계: 읽기 전용 키, 새 항목, 1년 지난 문의 정리 ----------
{
  raw.prepare("INSERT INTO asks (code, at, kind, text, reply, replied_at, status) VALUES (?,?,?,?,?,?,?)").run("OLDANSWR", "2024-09-01 10:00", "문의", "옛 문의", "답", "2024-09-02 10:00", "answered");
  raw.prepare("INSERT INTO asks (code, at, kind, text, status) VALUES (?,?,?,?,?)").run("OLDOPEN2", "2024-09-01 10:00", "문의", "아직 열림", "open");
  raw.prepare("INSERT INTO events (at, day, type) VALUES (?,?,?)").run("2024-09-01 10:00", "2024-09-01", "visit");   // 2년 넘음 -> 삭제
  raw.prepare("INSERT INTO events (at, day, type) VALUES (?,?,?)").run("2025-01-10 10:00", "2025-01-10", "visit");   // 2년 안 -> 남김
  raw.prepare("INSERT INTO reviews (at, text, status) VALUES (?,?,?)").run("2026-06-01 10:00", "옛 거절", "rejected");   // 90일 넘음 -> 삭제
  raw.prepare("INSERT INTO reviews (at, text, status) VALUES (?,?,?)").run("2026-06-01 10:00", "옛 승인", "approved");   // 승인은 남김
  raw.prepare("INSERT INTO reviews (at, text, status) VALUES (?,?,?)").run("2026-09-20 10:00", "최근 거절", "rejected"); // 90일 안 -> 남김
  const before = raw.prepare("SELECT COUNT(*) n FROM events").get().n;
  ok("stats: random key 401", (await S(env, "nope-nope-nope")).s === 401);
  ok("purge: random key does not purge", raw.prepare("SELECT COUNT(*) n FROM events").get().n === before);
  const ro = await S(env, RO);
  const j = ro.j;
  ok("stats ro: 200 readonly", ro.s === 200 && j.readonly === true && ro.h === "no-store");
  ok("stats ro: etc list", j.etc && j.etc["goal:드론 조종사"] === 1 && j.etcOld && j.etcOld["goal:드론 조종사"] === 1 && j.etc["plan:조주기능사"] === 1, JSON.stringify(j.etc));
  ok("stats ro: has refs/kws/asks/reviews", typeof j.refs === "object" && typeof j.kws === "object" && Array.isArray(j.asks) && Array.isArray(j.reviews) && j.refs["google.com"] === 1);
  ok("purge: events >2y deleted, <2y kept", !raw.prepare("SELECT 1 FROM events WHERE day='2024-09-01'").get() && !!raw.prepare("SELECT 1 FROM events WHERE day='2025-01-10'").get());
  ok("purge: rejected >90d deleted, others kept", !raw.prepare("SELECT 1 FROM reviews WHERE text='옛 거절'").get() && !!raw.prepare("SELECT 1 FROM reviews WHERE text='옛 승인'").get() && !!raw.prepare("SELECT 1 FROM reviews WHERE text='최근 거절'").get());
  ok("purge: old answered ask deleted, old open kept (on any stats load)", !j.asks.some(a => a.code === "OLDANSWR") && j.asks.some(a => a.code === "OLDOPEN2"));
  ok("stats: keeps old fields", Array.isArray(j.days) && Array.isArray(j.runs) && Array.isArray(j.feedback) && j.store === "d1" && j.total);
  const ad = await S(env, ADMIN);
  ok("stats admin: readonly false", ad.j.readonly === false);
  ok("stats admin: purge idempotent", !ad.j.asks.some(a => a.code === "OLDANSWR") && ad.j.asks.some(a => a.code === "OLDOPEN2"));
  const a0 = ad.j.asks.find(a => a.code === code);
  ok("stats: ask all fields", a0 && ["id", "code", "at", "kind", "text", "reply", "replied_at", "status"].every(k => k in a0), JSON.stringify(a0));
  ok("stats: reviews all statuses + counts", ad.j.reviews.length >= 26 && ad.j.reviewCounts.approved === 27 && "pending" in ad.j.reviewCounts, JSON.stringify(ad.j.reviewCounts));
  ok("stats: public flag kept on feedback", ad.j.feedback.some(f => f.public === true));
}

// ---------- 8. KV 만 / D1 고장 시 문의·후기 ----------
for (const [label, kenv] of [["kv-only", { PYOJIGI_KV: KV(), ADMIN_KEY: ADMIN, FEEDBACK_KEY: RO }], ["d1-broken", { DB: BrokenD1(), PYOJIGI_KV: KV(), ADMIN_KEY: ADMIN }]]) {
  const r = await AP(kenv, { kind: "제안", text: "KV에 저장", agree: true });
  ok(label + ": ask created", r.s === 200 && CODE.test(r.j.code));
  ok(label + ": ask in KV", !!(await kenv.PYOJIGI_KV.get("ask:" + r.j.code)));
  ok(label + ": reply", (await A(kenv, { key: ADMIN, action: "reply", code: r.j.code, reply: "네" })).j.ok);
  const g = await AG(kenv, r.j.code);
  ok(label + ": lookup answered", g.j.reply === "네" && g.j.status === "answered");
  ok(label + ": answered TTL set", kenv.PYOJIGI_KV.ttl["ask:" + r.j.code] === 400 * 86400);
  await F(kenv, { text: "KV 후기 인스타", fb: "많이 됐어요", public: true });
  const s = await S(kenv, ADMIN);
  const rv = s.j.reviews[0];
  ok(label + ": stats lists ask+review (auto-rejected, '인스타')", s.j.asks.length === 1 && rv && rv.status === "rejected" && /^k/.test(rv.id), JSON.stringify(s.j.reviews));
  ok(label + ": approve kv review", (await A(kenv, { key: ADMIN, action: "review", id: rv.id, approve: true })).j.ok);
  ok(label + ": public kv review", (await R(kenv)).j.reviews[0]?.text === "KV 후기 인스타");
  await kenv.PYOJIGI_KV.put("rv:kold1", JSON.stringify({ id: "kold1", at: "2026-01-01 00:00", text: "옛 거절", status: "rejected" }));
  await kenv.PYOJIGI_KV.put("rv:kold2", JSON.stringify({ id: "kold2", at: "2026-01-01 00:00", text: "옛 대기", status: "pending" }));
  await S(kenv, ADMIN);
  ok(label + ": kv purge old rejected review", !(await kenv.PYOJIGI_KV.get("rv:kold1")) && !!(await kenv.PYOJIGI_KV.get("rv:kold2")));
  await kenv.PYOJIGI_KV.delete("rv:kold2");
  ok(label + ": delete kv review", (await A(kenv, { key: ADMIN, action: "delete_review", id: rv.id })).j.ok && (await R(kenv)).j.reviews.length === 0);
}

// ---------- 9. 동시에 50명 완주 (D1, 새 DB) ----------
{
  const r2 = new DatabaseSync(":memory:");
  const cenv = { DB: D1(r2), PYOJIGI_KV: KV(), ADMIN_KEY: ADMIN };
  const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => E(cenv, { type: "finish", sit: "job", ag: 1, tops: ["it", "sec", "fac"], low: i % 2 === 0 })));
  const n = r2.prepare("SELECT COUNT(*) n FROM events WHERE type='finish'").get().n;
  ok("concurrency: 50 finishes, 0 lost", rs.every(r => r.j.ok) && n === 50, n);
  const s = await S(cenv, ADMIN);
  ok("concurrency: stats sees 50", s.j.days[0].finish === 50 && s.j.runs.length === 50);
}

// ---------- 10. 개인정보: IP 원문·브라우저 정보 저장 안 함 ----------
{
  const dump = JSON.stringify(["events", "asks", "reviews", "rl"].map(t => raw.prepare(`SELECT * FROM ${t}`).all())) + JSON.stringify([...env.PYOJIGI_KV.m.entries()]);
  ok("privacy: no raw ip", !/9\.9\.9\.9|8\.8\.8\.8|7\.7\.7\.7|1\.1\.1\.1/.test(dump));
  ok("privacy: no user agent", !/Mozilla|TESTUA/.test(dump));
}

// 자동 승인 전 '승인 대기'로 남은 옛 후기는 통계를 열면 자동 규칙대로 정리된다 (D1·KV 둘 다)
{
  const { createReview } = await import("../../functions/_lib/store.js");
  for (const [label, penv] of [["d1", { DB: D1(), PYOJIGI_KV: KV(), ADMIN_KEY: ADMIN, FEEDBACK_KEY: RO }], ["kv", { PYOJIGI_KV: KV(), ADMIN_KEY: ADMIN, FEEDBACK_KEY: RO }]]) {
    await createReview(penv, { text: "진로 고민에 도움이 많이 됐어요", fb: null, sit: "ms" });
    await createReview(penv, { text: "👍", fb: null, sit: "mil" });
    const s = await S(penv, RO);
    const st2 = Object.fromEntries(s.j.reviews.map(r => [r.text, r.status]));
    ok(`old pending cleanup ${label}`, s.s === 200 && st2["진로 고민에 도움이 많이 됐어요"] === "approved" && st2["👍"] === "rejected" && s.j.reviewCounts.pending === 0, JSON.stringify([st2, s.j.reviewCounts]));
    ok(`old pending cleanup ${label}: public`, (await R(penv)).j.reviews.length === 1);
  }
}

console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL PASS (${pass} checks)`);
process.exit(fail ? 1 : 0);
