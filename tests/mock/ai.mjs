import { onRequestPost } from "../../functions/api/ai.js";
const m=new Map(); const KV={get:async k=>m.get(k)??null,put:async(k,v)=>{m.set(k,v)}};
let calls=0; globalThis.fetch=async(url,opt)=>{calls++; const b=JSON.parse(opt.body); return new Response(JSON.stringify({content:[{type:"text",text:"테스트 답 "+b.model}],stop_reason:"end_turn"}),{status:200});};
const req=(body,ip="1.2.3.4")=>new Request("http://x/api/ai",{method:"POST",headers:{"content-type":"application/json","cf-connecting-ip":ip},body:JSON.stringify(body)});
const r=[];
let x=await onRequestPost({request:req({messages:[{role:"user",content:"안녕"}]}),env:{PYOJIGI_KV:KV}}); r.push(["no key",x.status]);
const env={PYOJIGI_KV:KV,ANTHROPIC_API_KEY:"k",SALT:"s"};
for(let i=0;i<4;i++){ x=await onRequestPost({request:req({messages:[{role:"user",content:"읽어줘"}]}),env}); r.push(["read"+i,x.status,(await x.json()).text||""]); }
x=await onRequestPost({request:req({messages:[{role:"assistant",content:"x"}]}),env}); r.push(["bad",x.status]);
console.log(JSON.stringify(r), "upstream calls", calls);
