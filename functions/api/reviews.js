// 표지기 실제 후기: 사용자가 공개에 동의하고, 운영자가 승인한 한마디만 보여 준다
// GET /api/reviews -> {ok:true, reviews:[{text, fb, sit, day}]}  (최근 승인 20개, 5분 캐시)
import { json } from "../_lib/common.js";
import { listReviews } from "../_lib/store.js";

export async function onRequestGet({ env }) {
  const cache = { "cache-control": "public, max-age=300" };
  let list = [];
  try { list = await listReviews(env, { approvedOnly: true, limit: 20 }); }
  catch (e) { if (env.DEBUG) console.log("REVIEWERR", e.message); }
  return json({ ok: true, reviews: list.map(r => ({ text: r.text, fb: r.fb, sit: r.sit, day: r.at.slice(0, 10) })) }, 200, cache);
}
