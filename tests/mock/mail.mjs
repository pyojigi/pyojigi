// 이메일 발송(Resend)은 없앴다: 피드백을 보내도 바깥으로 fetch 하지 않아야 한다
import { onRequestPost as fb } from "../../functions/api/feedback.js";
import * as mod from "../../functions/api/feedback.js";
const m = new Map();
const KV = { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } };
let calls = 0; globalThis.fetch = async () => { calls++; return { ok: true }; };
const env = { PYOJIGI_KV: KV, RESEND_API_KEY: "re_test", FEEDBACK_TO: "x@example.com" };
const r = await fb({ request: new Request("http://x", { method: "POST", body: JSON.stringify({ fb: "많이 됐어요", text: "2주 실험이 좋았어요", sit: "hs", top: ["hsj"] }) }), env });
console.log((await r.json()).ok === true && calls === 0 && !("sendMail" in mod) ? "ALL PASS (메일 안 보냄)" : "FAIL " + calls);
