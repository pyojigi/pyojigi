// 표지기 문의·오류 신고·제안
// POST /api/ask {kind, text, agree:true} -> {ok:true, code}   (code: 답변 확인용 8자리)
// GET  /api/ask?code=XXXXXXXX            -> {ok:true, kind, text, at, status, reply, replied_at}
// - 이름·연락처·IP·브라우저 정보는 받지도 저장하지도 않는다 (IP는 하루 횟수 세는 해시로만)
// - 같은 사람 하루 문의 5건, 답변 조회 30번까지 (확인 코드 맞히기 방지)
// - 답변·완료된 문의는 1년 뒤 지운다 (운영자가 통계 페이지를 열 때 정리)
import { json, kstDay, whoHash, allow, cleanText } from "../_lib/common.js";
import { ASK_KINDS, CODE_RE, createAsk, getAsk } from "../_lib/store.js";

const MAX_TEXT = 500, PER_DAY = 5, LOOKUPS_PER_DAY = 30;

export async function onRequestPost({ request, env }) {
  if (!env.DB && !env.PYOJIGI_KV) return json({ error: "off" }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (!b || typeof b !== "object") return json({ error: "bad_request" }, 400);
  if (b.agree !== true) return json({ error: "agree" }, 400);
  const kind = ASK_KINDS.includes(b.kind) ? b.kind : "문의";
  const text = cleanText(b.text, true);
  if (!text) return json({ error: "empty" }, 400);
  if (text.length > MAX_TEXT) return json({ error: "long" }, 400);

  const day = kstDay();
  const who = await whoHash(request, env, day);
  if (!(await allow(env, "ask", who, day, PER_DAY))) return json({ error: "limit" }, 429);

  const code = await createAsk(env, kind, text);
  if (!code) return json({ error: "off" }, 503);
  return json({ ok: true, code });
}

export async function onRequestGet({ request, env }) {
  if (!env.DB && !env.PYOJIGI_KV) return json({ error: "off" }, 503);
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").trim().toUpperCase().replace(/[\s-]/g, "");
  const day = kstDay();
  const who = await whoHash(request, env, day);
  if (!(await allow(env, "look", who, day, LOOKUPS_PER_DAY))) return json({ error: "limit" }, 429);
  if (!CODE_RE.test(code)) return json({ error: "notfound" }, 404);
  const a = await getAsk(env, code);
  if (!a) return json({ error: "notfound" }, 404);
  return json({ ok: true, kind: a.kind, text: a.text, at: a.at, status: a.status, reply: a.reply, replied_at: a.replied_at });
}
