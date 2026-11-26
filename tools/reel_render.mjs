// 릴스 영상 만들기 (1080x1920, 30fps, 무음 오디오 포함)
// 사용: node tools/reel_render.mjs content/ig/reels/<id>.html content/ig/reel_<이름>.mp4
//       node tools/reel_render.mjs <html> --still 1.5 6 12   → 그 시각 화면을 scratch 에 jpg 로 (첫 렌더 전에 눈으로 확인)
// HTML 약속: window.render(t초) 가 그 순간 화면을 그린다(같은 t면 항상 같은 그림).
//            window.SCENES = [[시작초, 끝초], ...] 장면 나눔(끝초의 마지막 값 = 영상 길이).
import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs"; import path from "node:path"; import os from "node:os";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/opt/npm-tools/node_modules/playwright/index.mjs")); }
const [html, out, ...rest] = process.argv.slice(2);
if (!html || !out) { console.log("사용: node tools/reel_render.mjs <html> <out.mp4 | --still t1 t2 ...>"); process.exit(1); }
const FPS = 30, abs = path.resolve(html);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto("file://" + abs); await p.evaluate(() => document.fonts.ready);
const tmpd = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
if (out === "--still") {
  for (const t of rest) { await p.evaluate(t => render(+t), t); const f = path.join(tmpd, `still_${t}.jpg`); await p.screenshot({ path: f, type: "jpeg", quality: 85 }); console.log(f); }
  await b.close(); process.exit(0);
}
const scenes = await p.evaluate(() => window.SCENES);
if (!Array.isArray(scenes) || !scenes.length) throw new Error("window.SCENES 가 없어요");
const list = [];
for (const [i, [a, z]] of scenes.entries()) {
  const tmp = path.join(tmpd, `sc${i}.tmp.mp4`), fin = path.join(tmpd, `sc${i}.mp4`);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), tmp], { stdio: ["pipe", "inherit", "inherit"] });
  for (let n = Math.round(a * FPS); n < Math.round(z * FPS); n++) {
    await p.evaluate(t => render(t), n / FPS);
    const buf = await p.screenshot({ type: "jpeg", quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
  }
  ff.stdin.end(); const code = await new Promise(r => ff.on("close", r)); if (code !== 0) throw new Error("ffmpeg 장면 " + i);
  fs.renameSync(tmp, fin); list.push(`file '${fin}'`);
}
await b.close();
fs.writeFileSync(path.join(tmpd, "list.txt"), list.join("\n") + "\n");
const v = path.join(tmpd, "v.mp4"), o2 = out + ".tmp.mp4";
const run = a => { const r = spawnSync("ffmpeg", a, { stdio: "inherit" }); if (r.status !== 0) throw new Error("ffmpeg " + a.join(" ")); };
run(["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(tmpd, "list.txt"), "-c", "copy", v]);
run(["-v", "error", "-y", "-i", v, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", o2]);
fs.renameSync(o2, out); fs.rmSync(tmpd, { recursive: true, force: true });
console.log("만듦", out, scenes[scenes.length - 1][1] + "초");
