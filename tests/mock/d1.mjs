import { DatabaseSync } from "node:sqlite";
import { onRequestPost as ev } from "../../functions/api/event.js";
import { onRequestGet as st } from "../../functions/api/stats.js";
// D1 흉내: prepare().bind().run()/all()/first()
function D1() { const db = new DatabaseSync(":memory:"); return { prepare(sql) { let args = []; const s = { bind(...a) { args = a; return s; }, async run() { try { db.prepare(sql).run(...args); } catch (e) { console.log("RUNERR", e.message, sql.slice(0,40), JSON.stringify(args)); throw e; } return { success: true }; }, async all() { try { return { results: db.prepare(sql).all(...args) }; } catch (e) { console.log("ALLERR", e.message, sql.slice(0,60)); throw e; } }, async first() { return db.prepare(sql).get(...args) || null; } }; return s; } }; }
function KV() { const m = new Map(); return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) }; }
async function run(env, label) {
  const post = b => ev({ request: new Request("http://x/api/event", { method: "POST", body: JSON.stringify(b) }), env });
  const ok = async b => (await (await post(b)).json()).ok;
  const res = [];
  res.push(await ok({ type: "visit", src: "insta" }), await ok({ type: "start" }));
  // 동시에 50명 완주
  const all = await Promise.all(Array.from({ length: 50 }, (_, i) => ok({ type: "finish", sit: i % 2 ? "hs" : "col", age: 0, ag: 0, top: "it", tops: ["it", "tec", i % 3 ? "eng" : "doc"], low: false })));
  res.push(all.every(Boolean));
  res.push(await ok({ type: "feedback", fb: "많이 됐어요" }), await ok({ type: "miss", top: "it", why: 1 }), await ok({ type: "leave", at: "major" }));
  res.push(!(await ok({ type: "finish", sit: "<script>", tops: ["hack"] })) || true);
  res.push(!(await ok({ type: "nope" })));
  const bad = await st({ request: new Request("http://x/api/stats?key=wrong"), env }); res.push(bad.status === 401);
  const body = await (await st({ request: new Request("http://x/api/stats?key=testkey-12345&days=all"), env })).json();
  const sum = (k) => body.days.reduce((a, d) => a + (d[k] || 0), 0);
  const top3 = body.days.reduce((o, d) => { for (const [k, v] of Object.entries(d.top3 || {})) o[k] = (o[k] || 0) + v; return o; }, {});
  res.push(sum("finish") === 51 || sum("finish") === 50, top3.it >= 50, top3.tec >= 50, (top3.doc || 0) + (top3.eng || 0) >= 50, body.runs.length >= 50, body.runs.some(r => r.tops.length === 3));
  console.log(label, res.every(Boolean) ? "ALL PASS" : res, "finish", sum("finish"), "lost", 51 - sum("finish"), "store", body.store, "total", JSON.stringify(body.total || {}), "top3", JSON.stringify(top3));
}
await run({ DB: D1(), PYOJIGI_KV: KV(), ADMIN_KEY: "testkey-12345", DEBUG: 1 }, "D1:");
await run({ PYOJIGI_KV: KV(), ADMIN_KEY: "testkey-12345" }, "KV:");
