// 표지기 운영자 동작: POST /api/admin {key, action, ...}
//   {action:"reply", code, reply}        문의에 답변 (1~1000자) -> 상태 'answered'
//   {action:"close", code}               문의 완료 -> 상태 'closed'
//   {action:"review", id, approve}       후기 승인(true) / 거절(false)
//   {action:"delete_review", id}         후기 삭제
// key 는 ADMIN_KEY 면 전부 된다. REPLY_KEY(자동 답변용)는 아직 답이 없는 문의에 "reply" 만 된다.
// 읽기 전용 FEEDBACK_KEY 는 여기서 거절한다 (401)
// 틀린 키는 같은 사람 하루 20번까지만 시도할 수 있다
import { json, kstAt, kstDay, whoHash, allow, cleanText, sameKey } from "../_lib/common.js";
import { CODE_RE, getAsk, updateAsk, setReview, reviewId } from "../_lib/store.js";

const MAX_REPLY = 1000, BAD_KEY_PER_DAY = 20;

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (!b || typeof b !== "object") return json({ error: "bad_request" }, 400);
  const isAdmin = !!env.ADMIN_KEY && env.ADMIN_KEY.length >= 8 && sameKey(b.key, env.ADMIN_KEY);
  const isReply = !isAdmin && !!env.REPLY_KEY && env.REPLY_KEY.length >= 8 && env.REPLY_KEY !== env.FEEDBACK_KEY && sameKey(b.key, env.REPLY_KEY);
  if (!isAdmin && !(isReply && b.action === "reply")) {
    const day = kstDay();
    if (!(await allow(env, "badkey", await whoHash(request, env, day), day, BAD_KEY_PER_DAY))) return json({ error: "limit" }, 429);
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.DB && !env.PYOJIGI_KV) return json({ error: "off" }, 503);

  const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
  switch (b.action) {
    case "reply": {
      if (!CODE_RE.test(code)) return json({ error: "bad_request" }, 400);
      const reply = cleanText(b.reply, true);
      if (!reply) return json({ error: "empty" }, 400);
      if (reply.length > MAX_REPLY) return json({ error: "long" }, 400);
      if (isReply) { // 자동 답변은 아직 답이 없는 문의에만. 운영자 답을 덮어쓰지 않는다
        const cur = await getAsk(env, code);
        if (!cur) return json({ error: "notfound" }, 404);
        if (cur.status !== "open") return json({ error: "answered" }, 409);
      }
      return (await updateAsk(env, code, { reply, replied_at: kstAt(), status: "answered" })) ? json({ ok: true }) : json({ error: "notfound" }, 404);
    }
    case "close": {
      if (!CODE_RE.test(code)) return json({ error: "bad_request" }, 400);
      return (await updateAsk(env, code, { status: "closed" })) ? json({ ok: true }) : json({ error: "notfound" }, 404);
    }
    case "review": {
      const id = reviewId(b.id);
      if (id == null || typeof b.approve !== "boolean") return json({ error: "bad_request" }, 400);
      return (await setReview(env, id, b.approve ? "approved" : "rejected")) ? json({ ok: true }) : json({ error: "notfound" }, 404);
    }
    case "delete_review": {
      const id = reviewId(b.id);
      if (id == null) return json({ error: "bad_request" }, 400);
      return (await setReview(env, id, null)) ? json({ ok: true }) : json({ error: "notfound" }, 404);
    }
    default: return json({ error: "bad_request" }, 400);
  }
}
