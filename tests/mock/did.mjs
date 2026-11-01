// 하루 뒤 확인(did·didw)과 고민상담 문의가 저장되고 통계에 나오는지
import { DatabaseSync } from "node:sqlite";
import { onRequestPost as ev } from "../../functions/api/event.js";
import { onRequestGet as st } from "../../functions/api/stats.js";
import { onRequestPost as ask } from "../../functions/api/ask.js";
function D1() { const db = new DatabaseSync(":memory:"); return { prepare(sql) { let args = []; const s = { bind(...a) { args = a; return s; }, async run() { try { db.prepare(sql).run(...args); } catch (e) { console.log("RUNERR", e.message, sql.slice(0,40), JSON.stringify(args)); throw e; } return { success: true }; }, async all() { try { return { results: db.prepare(sql).all(...args) }; } catch (e) { console.log("ALLERR", e.message, sql.slice(0,60)); throw e; } }, async first() { return db.prepare(sql).get(...args) || null; } }; return s; } }; }
function KV(){ const m=new Map(); return { get:async k=>m.get(k)??null, put:async(k,v)=>{m.set(k,v)}, list:async({prefix})=>({keys:[...m.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}) }; }
const env={DB:D1(),PYOJIGI_KV:KV(),ADMIN_KEY:"testkey-12345"};
const post=async b=>(await (await ev({request:new Request("http://x",{method:"POST",body:JSON.stringify(b)}),env})).json()).ok;
const r=[await post({type:"did",why:0,top:"log"}),await post({type:"did",why:1}),await post({type:"didw",what:"cert"}),!(await post({type:"did",why:5})),!(await post({type:"didw",what:"x"}))];
const a=await (await ask({request:new Request("http://x",{method:"POST",body:JSON.stringify({kind:"고민상담",text:"뭐부터 해야 할지 모르겠어요",agree:true})}),env})).json();
const b=await (await st({request:new Request("http://x/api/stats?key=testkey-12345&days=7"),env})).json();
const d=b.days.find(x=>x.didAns)||{};
r.push(d.didAns?.["0"]===1, d.didAns?.["1"]===1, d.didWhat?.cert===1, !!a.code, b.asks[0]?.kind==="고민상담");
console.log(r.every(Boolean)?"ALL PASS":r, JSON.stringify(d.didAns), JSON.stringify(d.didWhat), b.asks[0]?.kind);
