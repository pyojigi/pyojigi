// 표지기 한마디 피드백 저장
// - 300자 이내 문장(HTML 제거), 만족도, 상황 종류, 추천 경로 코드, '이건 아니에요' 선택만 받는다
// - 이름·연락처·IP·브라우저 정보는 저장하지 않는다. 같은 사람 하루 5번까지 (IP는 해시로만 이틀 보관)
// - 저장된 피드백은 90일 뒤 자동 삭제된다. 이메일로 보내지 않고 통계 페이지(/stats.html)에서만 본다
// - public: true (사용자가 "이 한마디를 사이트 후기로 공개해도 좋아요"에 체크)이고 한마디가 있으면
//   후기 승인 대기(pending)로도 넣는다. 운영자가 승인해야만 /api/reviews 에 보인다
import { SITS, PATHS, FB, json, kstDay, whoHash, allow, cleanText } from "../_lib/common.js";
import { createReview } from "../_lib/store.js";

// 후기 자동 공개 (2026-10-23 운영자 결정): 아래에 하나도 안 걸리면 바로 공개, 걸리면 운영자 승인 대기
// 연락처·주소·링크 / 학교 이름 / 욕설·성적 표현 / 위기 신호 / 너무 짧은 글
const HOLD = [
  /\d{4,}|\d{2,4}-\d{3,4}-\d{4}|@|https?:|www\.|\.com|\.kr|카톡|카카오톡|오픈채팅|오픈톡|인스타|디엠|dm\b|텔레그램|연락/i,
  /[가-힣]{2,}(초등학교|중학교|고등학교|대학교|고교|중학|여고|여중|공고|상고)/,
  /씨발|시발|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|좆|존나|졸라|개새|새끼|꺼져|미친|닥쳐|fuck|shit|섹스|야동|성인/i,
  /죽고 ?싶|자살|살기 ?싫|사라지고 ?싶|자해|극단|죽어|뛰어내/,
];
export function autoOK(text) { return typeof text === "string" && text.trim().length >= 5 && !HOLD.some(r => r.test(text)); }

const KEEP_DAYS = 90, PER_DAY = 5, MAX_TEXT = 300;

export async function onRequestPost({ request, env }) {
  if (!env.PYOJIGI_KV) return json({ error: "off" }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (!b || typeof b !== "object") return json({ error: "bad_request" }, 400);

  const text = cleanText(b.text).slice(0, MAX_TEXT).trim();
  const fb = FB.includes(b.fb) ? b.fb : null;
  const miss = {};
  if (b.miss && typeof b.miss === "object") for (const k in b.miss) if (PATHS.includes(k) && Number.isInteger(b.miss[k]) && b.miss[k] >= 0 && b.miss[k] <= 3) miss[k] = b.miss[k];
  if (!text && !fb && !Object.keys(miss).length) return json({ error: "empty" }, 400);

  const day = kstDay();
  const who = await whoHash(request, env, day);
  if (!(await allow(env, "fb", who, day, PER_DAY))) return json({ error: "limit" }, 429);

  const sit = SITS.includes(b.sit) ? b.sit : null;
  const isPublic = b.public === true && !!text;
  const rec = {
    at: new Date().toISOString(),
    fb, text, miss, sit,
    top: Array.isArray(b.top) ? b.top.filter(k => PATHS.includes(k)).slice(0, 3) : [],
    public: isPublic
  };
  const id = `fbk:${day}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await env.PYOJIGI_KV.put(id, JSON.stringify(rec), { expirationTtl: KEEP_DAYS * 86400 });
  if (isPublic) { try { await createReview(env, { text, fb, sit, status: autoOK(text) ? "approved" : "pending" }); } catch (e) { if (env.DEBUG) console.log("REVIEWERR", e.message); } }
  return json({ ok: true });
}
