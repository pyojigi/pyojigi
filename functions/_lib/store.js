// 문의(asks)와 후기(reviews) 저장소: D1 우선, D1이 없거나 실패하면 KV
// KV 키: ask:<code>, rv:<id>  (KV 후기 id는 "k"로 시작해 D1 숫자 id와 겹치지 않는다)
import { ensure, kstAt, kvKeys } from "./common.js";

export const ASK_KINDS = ["문의", "오류 신고", "제안"];
export const CODE_ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 0 O 1 I L 없음 (31자)
export const CODE_RE = /^[2-9A-HJKMNP-Z]{8}$/;
const YEAR = 365 * 864e5;
const KV_DONE_TTL = 400 * 86400; // 답변·완료된 문의는 KV에서도 저절로 사라진다

export function newCode() {
  let out = "";
  while (out.length < 8) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    for (const b of buf) if (b < 248 && out.length < 8) out += CODE_ALPHA[b % 31]; // 치우침 없이
  }
  return out;
}

const pickAsk = r => r && ({ id: r.id ?? null, code: r.code, at: r.at, kind: r.kind, text: r.text, reply: r.reply ?? null, replied_at: r.replied_at ?? null, status: r.status || "open" });
const pickReview = r => r && ({ id: r.id, at: r.at, text: r.text, fb: r.fb ?? null, sit: r.sit ?? null, status: r.status || "pending" });

async function db(env) {
  if (!env.DB) return null;
  await ensure(env.DB);
  return env.DB;
}
const dbErr = (env, e) => { if (env.DEBUG) console.log("DBERR", e.message); };

// ---------- 문의 ----------
export async function createAsk(env, kind, text) {
  const at = kstAt();
  try {
    const d = await db(env);
    if (d) {
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        try { await d.prepare(`INSERT INTO asks (code, at, kind, text, status) VALUES (?, ?, ?, ?, 'open')`).bind(code, at, kind, text).run(); return code; }
        catch (e) { if (!/unique/i.test(String(e.message))) throw e; }
      }
      throw new Error("code collision");
    }
  } catch (e) { dbErr(env, e); }
  if (!env.PYOJIGI_KV) return null;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    if (await env.PYOJIGI_KV.get(`ask:${code}`)) continue;
    await env.PYOJIGI_KV.put(`ask:${code}`, JSON.stringify({ code, at, kind, text, reply: null, replied_at: null, status: "open" }));
    return code;
  }
  return null;
}

export async function getAsk(env, code) {
  try { const d = await db(env); if (d) { const r = await d.prepare(`SELECT * FROM asks WHERE code = ?`).bind(code).first(); if (r) return pickAsk(r); } }
  catch (e) { dbErr(env, e); }
  if (!env.PYOJIGI_KV) return null;
  const raw = await env.PYOJIGI_KV.get(`ask:${code}`);
  return raw ? pickAsk(JSON.parse(raw)) : null;
}

// fields: {reply?, replied_at?, status}. 바뀌면 true
export async function updateAsk(env, code, fields) {
  try {
    const d = await db(env);
    if (d) {
      const r = fields.reply != null
        ? await d.prepare(`UPDATE asks SET reply = ?, replied_at = ?, status = ? WHERE code = ? RETURNING id`).bind(fields.reply, fields.replied_at, fields.status, code).first()
        : await d.prepare(`UPDATE asks SET status = ? WHERE code = ? RETURNING id`).bind(fields.status, code).first();
      if (r) return true;
    }
  } catch (e) { dbErr(env, e); }
  if (!env.PYOJIGI_KV) return false;
  const raw = await env.PYOJIGI_KV.get(`ask:${code}`);
  if (!raw) return false;
  const rec = { ...JSON.parse(raw), ...fields };
  await env.PYOJIGI_KV.put(`ask:${code}`, JSON.stringify(rec), rec.status === "open" ? undefined : { expirationTtl: KV_DONE_TTL });
  return true;
}

export async function listAsks(env, limit = 200) {
  const out = [];
  try { const d = await db(env); if (d) out.push(...((await d.prepare(`SELECT * FROM asks ORDER BY at DESC, id DESC LIMIT ?`).bind(limit).all()).results || []).map(pickAsk)); }
  catch (e) { dbErr(env, e); }
  if (env.PYOJIGI_KV) {
    const names = await kvKeys(env.PYOJIGI_KV, "ask:", 2000);
    const recs = [];
    for (const n of names) { const raw = await env.PYOJIGI_KV.get(n); if (raw) recs.push(pickAsk(JSON.parse(raw))); }
    out.push(...recs);
  }
  out.sort((a, b) => b.at.localeCompare(a.at) || (b.id || 0) - (a.id || 0));
  return out.slice(0, limit);
}

// 개인정보처리방침의 보관 기간 지키기 (통계 페이지를 열 때마다 정리)
//   이용 기록(events) 2년, 답변·완료 문의 1년, 거절한 후기 90일, 하루 횟수 기록은 지난 날짜 삭제
//   (한마디 피드백 fbk: 는 KV 90일 TTL, KV 날짜별 숫자 st: 는 2년 TTL)
export async function purgeOld(env) {
  const cutoff = kstAt(Date.now() - YEAR);
  const evCut = kstAt(Date.now() - 2 * YEAR).slice(0, 10), rvCut = kstAt(Date.now() - 90 * 864e5);
  try {
    const d = await db(env);
    if (d) {
      await d.prepare(`DELETE FROM events WHERE day < ?`).bind(evCut).run();
      await d.prepare(`DELETE FROM asks WHERE status IN ('answered','closed') AND COALESCE(replied_at, at) < ?`).bind(cutoff).run();
      await d.prepare(`DELETE FROM reviews WHERE status = 'rejected' AND at < ?`).bind(rvCut).run();
      await d.prepare(`DELETE FROM rl WHERE day < ?`).bind(kstAt().slice(0, 10)).run();
    }
  } catch (e) { dbErr(env, e); }
  if (env.PYOJIGI_KV && env.PYOJIGI_KV.delete) {
    for (const n of await kvKeys(env.PYOJIGI_KV, "ask:", 2000)) {
      const raw = await env.PYOJIGI_KV.get(n); if (!raw) continue;
      const r = JSON.parse(raw);
      if (r.status !== "open" && (r.replied_at || r.at) < cutoff) await env.PYOJIGI_KV.delete(n);
    }
    for (const n of await kvKeys(env.PYOJIGI_KV, "rv:", 2000)) {
      const raw = await env.PYOJIGI_KV.get(n); if (!raw) continue;
      const r = JSON.parse(raw);
      if (r.status === "rejected" && r.at < rvCut) await env.PYOJIGI_KV.delete(n);
    }
  }
}

// ---------- 후기 ----------
export async function createReview(env, { text, fb, sit, status = "pending" }) {
  if (status !== "approved" && status !== "rejected") status = "pending";
  const at = kstAt();
  try { const d = await db(env); if (d) { await d.prepare(`INSERT INTO reviews (at, text, fb, sit, status) VALUES (?, ?, ?, ?, ?)`).bind(at, text, fb, sit, status).run(); return true; } }
  catch (e) { dbErr(env, e); }
  if (!env.PYOJIGI_KV) return false;
  const id = "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await env.PYOJIGI_KV.put(`rv:${id}`, JSON.stringify({ id, at, text, fb, sit, status }));
  return true;
}

// id: D1이면 숫자(또는 숫자 문자열), KV면 "k..." 문자열
export function reviewId(v) {
  if (Number.isInteger(v) && v > 0) return v;
  if (typeof v === "string" && /^[1-9][0-9]{0,15}$/.test(v)) return +v;
  if (typeof v === "string" && /^k[a-z0-9]{1,24}$/.test(v)) return v;
  return null;
}

export async function setReview(env, id, status) { // status: approved|rejected|null(삭제)
  if (typeof id === "number") {
    try {
      const d = await db(env);
      if (d) {
        const r = status
          ? await d.prepare(`UPDATE reviews SET status = ? WHERE id = ? RETURNING id`).bind(status, id).first()
          : await d.prepare(`DELETE FROM reviews WHERE id = ? RETURNING id`).bind(id).first();
        return !!r;
      }
    } catch (e) { dbErr(env, e); }
    return false;
  }
  if (!env.PYOJIGI_KV) return false;
  const raw = await env.PYOJIGI_KV.get(`rv:${id}`);
  if (!raw) return false;
  if (status) await env.PYOJIGI_KV.put(`rv:${id}`, JSON.stringify({ ...JSON.parse(raw), status }));
  else if (env.PYOJIGI_KV.delete) await env.PYOJIGI_KV.delete(`rv:${id}`);
  else return false;
  return true;
}

export async function listReviews(env, { approvedOnly = false, limit = 200 } = {}) {
  const out = [];
  try {
    const d = await db(env);
    if (d) {
      const sql = approvedOnly ? `SELECT * FROM reviews WHERE status = 'approved' ORDER BY at DESC, id DESC LIMIT ?` : `SELECT * FROM reviews ORDER BY at DESC, id DESC LIMIT ?`;
      out.push(...((await d.prepare(sql).bind(limit).all()).results || []).map(pickReview));
    }
  } catch (e) { dbErr(env, e); }
  if (env.PYOJIGI_KV) {
    for (const n of await kvKeys(env.PYOJIGI_KV, "rv:", 2000)) {
      const raw = await env.PYOJIGI_KV.get(n); if (!raw) continue;
      const r = pickReview(JSON.parse(raw));
      if (!approvedOnly || r.status === "approved") out.push(r);
    }
  }
  out.sort((a, b) => b.at.localeCompare(a.at) || (typeof b.id === "number" && typeof a.id === "number" ? b.id - a.id : 0));
  return out.slice(0, limit);
}

export async function reviewCounts(env) {
  const c = { pending: 0, approved: 0, rejected: 0 };
  try {
    const d = await db(env);
    if (d) for (const r of (await d.prepare(`SELECT status, COUNT(*) AS n FROM reviews GROUP BY status`).all()).results || []) c[r.status] = (c[r.status] || 0) + r.n;
  } catch (e) { dbErr(env, e); }
  if (env.PYOJIGI_KV) for (const n of await kvKeys(env.PYOJIGI_KV, "rv:", 2000)) { const raw = await env.PYOJIGI_KV.get(n); if (raw) { const s = JSON.parse(raw).status || "pending"; c[s] = (c[s] || 0) + 1; } }
  return c;
}
