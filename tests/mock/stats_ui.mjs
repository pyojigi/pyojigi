import { fileURLToPath as __f } from 'node:url'; import __p from 'node:path'; const __PUB = __p.join(__p.dirname(__f(import.meta.url)), '..', '..', 'public');
// stats.html 화면 시험 (390px). /api/** 는 흉내 JSON
// 실행: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node ./stats_ui.mjs
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import net from "node:net";

const port = await new Promise(r => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn("timeout", ["120", "python3", "-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", __PUB], { stdio: "ignore" });
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/stats.html`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

const XSS = `<img src=x onerror="window.__xss=1">"'`;
const data = ro => ({
  days: [{ day: "2026-10-22", visit: 41, start: 30, finish: 22, fb: { "많이 됐어요": 5, "조금 됐어요": 2 }, src: { insta: 9 }, sit: { job: 10, mil: 6 }, top: { sec: 7, it: 5 }, top3: { sec: 12 } }, { day: "2026-10-21", visit: 12 }],
  refs: { "search.naver.com": 18, "www.google.com": 9, "m.search.daum.net": 4, "very-long-subdomain-name.example-community-site.co.kr": 2 },
  kws: { "보안직 연봉": 7, "경비지도사 시험 일정": 3, [XSS]: 1 },
  runs: [{ at: "2026-10-22 13:20", sit: "job", ag: 1, tops: ["sec", "fac", "tec"] }],
  total: { finish: 300, visit: 1200 }, since: "2026-09-01", store: "d1",
  feedback: [{ at: "2026-10-22T04:10:00Z", fb: "많이 됐어요", text: "좋아요", sit: "mil", top: ["sec"], miss: {} }],
  asks: [
    { id: 3, code: "K7M2Q9XA", at: "2026-10-22 14:05", kind: "오류 신고", text: "결과 화면에서 공유 버튼이 안 눌려요.\n아이폰 사파리예요. " + XSS, reply: null, replied_at: null, status: "open" },
    { id: 2, code: "P4T8W3ZC", at: "2026-10-21 09:40", kind: "문의", text: "경비지도사 준비 기간이 정말 6개월이면 되나요?", reply: "평균적으로 그 정도예요.\n큐넷 일정도 꼭 확인해 주세요.", replied_at: "2026-10-21 21:00", status: "answered" },
    { id: 1, code: "H6N5R2YB", at: "2026-10-20 08:00", kind: "제안", text: "다크 모드가 있으면 좋겠어요", reply: null, replied_at: null, status: "closed" }
  ],
  reviews: [
    { id: 7, at: "2026-10-22 12:00", text: "보안직 길이 생각보다 현실적이었어요. " + XSS, fb: "많이 됐어요", sit: "mil", status: "pending" },
    { id: 6, at: "2026-10-21 18:00", text: "질문이 길었지만 결과가 구체적이라 좋았어요", fb: "조금 됐어요", sit: "job", status: "approved" },
    { id: "kmgx12ab", at: "2026-10-20 10:00", text: "광고 같아요", fb: "별로예요", sit: null, status: "rejected" }
  ],
  reviewCounts: { pending: 1, approved: 1, rejected: 1 },
  readonly: ro
});

const browser = await chromium.launch();
const out = [];
for (const ro of [false, true]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const posts = []; let loads = 0;
  page.on("pageerror", e => out.push("PAGEERROR " + e.message));
  page.on("dialog", d => d.accept());
  await page.route("**/api/**", async route => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/stats") { loads++; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data(ro)) }); }
    if (u.pathname === "/api/admin") { posts.push(JSON.parse(route.request().postData())); return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); }
    return route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"notfound"}' });
  });
  await page.goto(`http://127.0.0.1:${port}/stats.html`);
  await page.fill("#k", ro ? "read-only-5678" : "admin-key-1234");
  await page.click("button[type=submit]");
  await page.waitForSelector("#out .kpis");
  const info = await page.evaluate(() => ({
    xss: window.__xss, scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
    btns: document.querySelectorAll("#out button[data-act]").length, textareas: document.querySelectorAll("#out textarea").length,
    h2: [...document.querySelectorAll("h2")].map(h => h.textContent), csv: !!document.getElementById("csv")
  }));
  out.push(`${ro ? "readonly" : "admin"}: xss=${info.xss} scrollW=${info.scrollW}/${info.innerW} buttons=${info.btns} textareas=${info.textareas} csv=${info.csv}`);
  if (!ro) out.push("sections: " + info.h2.join(" | "));
  await page.screenshot({ path: `./stats_${ro ? "readonly" : "admin"}_390.png`, fullPage: true });
  if (!ro) {
    await page.fill("#rp-K7M2Q9XA", "확인해 볼게요. 고맙습니다!");
    await page.click('button[data-act=reply][data-code="K7M2Q9XA"]');
    await page.waitForSelector("#toast.on");
    const t1 = await page.textContent("#toast");
    await page.screenshot({ path: "./stats_toast_390.png" });
    await page.click('button[data-act=approve][data-id="7"]');
    await page.waitForFunction(() => document.getElementById("toast").textContent.startsWith("승인"));
    await page.click('button[data-act=delete][data-id="kmgx12ab"]');
    await page.waitForFunction(() => document.getElementById("toast").textContent.startsWith("삭제"));
    await page.click('button[data-act=close][data-code="P4T8W3ZC"]');
    await page.waitForFunction(() => document.getElementById("toast").textContent.startsWith("완료"));
    out.push(`toast="${t1}" posts=${JSON.stringify(posts.map(p => ({ ...p, key: p.key ? "***" : null })))} reloads=${loads}`);
  }
  await page.close();
}
await browser.close();
srv.kill();
console.log(out.join("\n"));
