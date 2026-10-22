// 운영자 통계: /api/stats?key=관리자키&days=30   (days=all 이면 처음부터 전부)
// 필요한 설정: 비밀 변수 ADMIN_KEY (본인만 아는 긴 문자열)
import { ensure } from "./event.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kst = (ms = 0) => new Date(Date.now() + 9 * 3600e3 - ms).toISOString().slice(0, 10);

async function fromDB(db, n) {
  await ensure(db);
  const from = n ? kst((n - 1) * 864e5) : "0000-00-00";
  const q = async (sql, ...b) => (await db.prepare(sql).bind(...b).all()).results || [];
  const rows = await q(`SELECT day, type, COUNT(*) AS c FROM events WHERE day >= ? GROUP BY day, type`, from);
  const by = {};
  for (const r of rows) { const d = by[r.day] = by[r.day] || { day: r.day }; d[{ copy: "fbCopy", leave: "leaveN", miss: "missN", feedback: "fbN" }[r.type] || r.type] = r.c; }
  const group = async (col, where, keyName = col) => {
    const rs = await q(`SELECT day, ${col} AS k, COUNT(*) AS c FROM events WHERE day >= ? AND ${where} AND ${col} IS NOT NULL GROUP BY day, ${col}`, from);
    for (const r of rs) { const d = by[r.day] = by[r.day] || { day: r.day }; (d[keyName] = d[keyName] || {})[String(r.k)] = r.c; }
  };
  await group("src", "type='visit'");
  await group("sit", "type='finish'");
  await group("age", "type='finish'");
  await group("ag", "type='finish'");
  await group("top1", "type='finish'", "top");
  await group("fb", "type='feedback'");
  await group("qid", "type='leave'", "leave");
  const lows = await q(`SELECT day, COUNT(*) AS c FROM events WHERE day >= ? AND type='finish' AND low=1 GROUP BY day`, from);
  for (const r of lows) (by[r.day] = by[r.day] || { day: r.day }).low = r.c;
  const miss = await q(`SELECT day, top1 || ':' || why AS k, COUNT(*) AS c FROM events WHERE day >= ? AND type='miss' GROUP BY day, k`, from);
  for (const r of miss) { const d = by[r.day] = by[r.day] || { day: r.day }; (d.miss = d.miss || {})[r.k] = r.c; }
  // 3위 안에 나온 길 (1·2·3순위 모두)
  const t3 = await q(`SELECT day, k, COUNT(*) AS c FROM (SELECT day, top1 AS k FROM events WHERE type='finish' AND day >= ? UNION ALL SELECT day, top2 FROM events WHERE type='finish' AND day >= ? UNION ALL SELECT day, top3 FROM events WHERE type='finish' AND day >= ?) WHERE k IS NOT NULL GROUP BY day, k`, from, from, from);
  for (const r of t3) { const d = by[r.day] = by[r.day] || { day: r.day }; (d.top3 = d.top3 || {})[r.k] = r.c; }
  const days = Object.values(by).sort((a, b) => b.day.localeCompare(a.day));
  if (n) { const have = new Set(days.map(d => d.day)); for (let i = 0; i < n; i++) { const d = kst(i * 864e5); if (!have.has(d)) days.push({ day: d }); } days.sort((a, b) => b.day.localeCompare(a.day)); }
  const runs = await q(`SELECT at, sit, ag, age, top1, top2, top3 FROM events WHERE type='finish' AND day >= ? ORDER BY id DESC LIMIT 2000`, from);
  const all = await q(`SELECT type, COUNT(*) AS c, MIN(day) AS first FROM events GROUP BY type`);
  const total = {}; let since = null; for (const r of all) { total[r.type] = r.c; if (!since || r.first < since) since = r.first; }
  return { days, runs: runs.map(r => ({ at: r.at, sit: r.sit, ag: r.ag, age: r.age, tops: [r.top1, r.top2, r.top3].filter(Boolean) })), total, since, store: "d1" };
}

async function fromKV(kv, n) {
  const days = [];
  const N = n || 366;
  for (let i = 0; i < N; i++) {
    const d = kst(i * 864e5);
    const raw = await kv.get(`st:${d}`);
    if (raw || n) days.push({ day: d, ...(raw ? JSON.parse(raw) : {}) });
  }
  const runs = [];
  for (const d of days) for (const r of (d.runs || []).slice().reverse()) runs.push(r);
  for (const d of days) delete d.runs;
  return { days, runs, store: "kv" };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  if (!env.ADMIN_KEY || key.length < 8 || key !== env.ADMIN_KEY) return json({ error: "unauthorized" }, 401);
  const dp = url.searchParams.get("days") || "30";
  const n = dp === "all" ? 0 : Math.min(Math.max(parseInt(dp, 10) || 30, 1), 366);

  let out = null;
  if (env.DB) { try { out = await fromDB(env.DB, n); } catch (e) { if (env.DEBUG) console.log("DBERR", e.message); out = null; } }
  if (!out) { if (!env.PYOJIGI_KV) return json({ error: "off" }, 503); out = await fromKV(env.PYOJIGI_KV, n); }

  // 받은 한마디 (KV): 최근 것부터 최대 100개
  const feedback = [];
  if (env.PYOJIGI_KV) {
    const from = out.days.length ? out.days[out.days.length - 1].day : kst();
    const notes = [];
    let cursor;
    do {
      const page = await env.PYOJIGI_KV.list({ prefix: "fbk:", cursor, limit: 1000 });
      for (const k of page.keys) if (k.name.slice(4, 14) >= from) notes.push(k.name);
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor && notes.length < 2000);
    notes.sort().reverse();
    for (const name of notes.slice(0, 100)) { const raw = await env.PYOJIGI_KV.get(name); if (raw) feedback.push(JSON.parse(raw)); }
  }
  return json({ ...out, feedback });
}
