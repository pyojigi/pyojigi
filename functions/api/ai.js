// 표지기 AI 중간 서버 (Cloudflare Pages Functions)
// - API 키는 여기서만 쓰고 브라우저에는 절대 보내지 않는다
// - 한 사람(IP 기준) 하루 이용 횟수와 서비스 전체 하루 한도를 둔다
// - 반복되는 앞부분은 프롬프트 캐싱으로 비용을 줄인다
//
// 필요한 설정 (Cloudflare Pages > 설정)
//   비밀 변수: ANTHROPIC_API_KEY  (Claude Console에서 발급)
//   KV 바인딩: PYOJIGI_KV
//   선택 변수: READ_LIMIT(기본 3), ASK_LIMIT(기본 6), DAILY_CAP(기본 100), SALT(아무 문자열)

const MODEL = "claude-sonnet-5-5";
const MAX_TOTAL_CHARS = 30000;   // 한 요청에 보낼 수 있는 글자 수 상한
const MAX_MESSAGES = 13;         // 처음 읽기 1 + 이전 답 1 + 질문·답 최대 5쌍 + 새 질문

const SYSTEM = `너는 진로 안내 서비스 '표지기'의 상담사다. 한국의 고등학생부터 40대까지, 취업 준비·이직·슬럼프·전역 후 진로로 방황하는 사람을 돕는다.
- 따뜻하지만 듣기 좋은 말보다 실제로 도움이 되는 말을 한다. 존댓말, 마크다운 기호(#, *, 표) 없이 평문으로 쓴다.
- 사용자가 말하지 않은 사실을 지어내지 않는다. 연봉·시험 일정·지원 금액 같은 수치는 단정하지 말고 고용24, 큐넷, 한국장학재단 등 공식 사이트에서 확인하라고 안내한다.
- 진로·일·공부·생활 계획과 관련 없는 요청(코드 작성, 숙제 대행, 다른 주제의 긴 글 등)은 "표지기에서는 진로 이야기만 도와드릴 수 있어요"라고 짧게 답한다.
- 극단적 선택이나 자해를 암시하는 내용이 보이면 다른 내용보다 먼저 자살예방상담전화 109(24시간)에 연락하도록 부드럽게 권한다.`;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function validMessages(m) {
  if (!Array.isArray(m) || m.length < 1 || m.length > MAX_MESSAGES) return false;
  if (m[0].role !== "user" || m[m.length - 1].role !== "user") return false;
  let total = 0;
  for (const x of m) {
    if (!x || (x.role !== "user" && x.role !== "assistant") || typeof x.content !== "string" || !x.content.trim()) return false;
    total += x.content.length;
  }
  return total <= MAX_TOTAL_CHARS;
}

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "off" }, 503);
  if (!env.PYOJIGI_KV) return json({ error: "off" }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  const messages = body && body.messages;
  if (!validMessages(messages)) return json({ error: "bad_request" }, 400);

  const isRead = messages.length === 1;
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const who = await sha256(ip + "|" + day + "|" + (env.SALT || "pyojigi"));   // IP 원문은 저장하지 않음

  const READ_LIMIT = +env.READ_LIMIT || 3, ASK_LIMIT = +env.ASK_LIMIT || 6, DAILY_CAP = +env.DAILY_CAP || 100;
  const userKey = `rl:${day}:${who}`, capKey = `cap:${day}`;
  const used = JSON.parse((await env.PYOJIGI_KV.get(userKey)) || '{"read":0,"ask":0}');
  const total = +((await env.PYOJIGI_KV.get(capKey)) || 0);
  if (total >= DAILY_CAP) return json({ error: "busy" }, 429);
  if (isRead ? used.read >= READ_LIMIT : used.ask >= ASK_LIMIT) return json({ error: "limit" }, 429);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      system: SYSTEM,
      cache_control: { type: "ephemeral" },        // 같은 사람의 이어지는 질문은 앞부분을 캐시에서 읽음
      output_config: { effort: "medium" },
      messages
    })
  });

  if (!res.ok) {
    const code = res.status === 429 || res.status === 529 ? "busy" : "upstream";
    return json({ error: code }, 502);
  }
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  if (!text) return json({ error: "empty" }, 502);

  // 이용 횟수 기록 (하루 지나면 자동 삭제)
  used[isRead ? "read" : "ask"]++;
  await env.PYOJIGI_KV.put(userKey, JSON.stringify(used), { expirationTtl: 172800 });
  await env.PYOJIGI_KV.put(capKey, String(total + 1), { expirationTtl: 3456000 });
  // 익명 통계: AI 사용 횟수
  const sk = `st:${day}`;
  const st = JSON.parse((await env.PYOJIGI_KV.get(sk)) || "{}");
  st[isRead ? "aiRead" : "aiAsk"] = (st[isRead ? "aiRead" : "aiAsk"] || 0) + 1;
  await env.PYOJIGI_KV.put(sk, JSON.stringify(st), { expirationTtl: 731 * 86400 }); // 2년 보관

  return json({
    text,
    truncated: data.stop_reason === "max_tokens",
    left: isRead ? READ_LIMIT - used.read : ASK_LIMIT - used.ask
  });
}

export function onRequestGet() {
  return json({ error: "method" }, 405);
}
