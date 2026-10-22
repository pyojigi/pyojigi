#!/usr/bin/env python3
"""표지기 공유 미리보기 이미지(1200x630) 만들기.

gen_pages.js 를 먼저 돌린 뒤 실행해요. 생성된 /jobs/*.html, /for/*.html 의 h1 등을 읽어
public/og.png, public/og/<key>.png, public/og/for-<slug>.png, og/jobs.png, og/for.png 를 만들어요.

사용: python3 tools/og_images.py public
"""
import html as H
import io
import re
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

W, HGT = 1200, 630
MAX_BYTES = 120_000
FONT = '"Noto Sans CJK KR","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif'

# 표지 기둥 + 리본 + 숲길 (오른쪽 일러스트)
ART = """
<svg class="art" width="420" height="630" viewBox="0 0 420 630" aria-hidden="true">
  <defs>
    <linearGradient id="rb" x1="0" x2="1"><stop offset="0" stop-color="#E0473A"/><stop offset="1" stop-color="#C2352A"/></linearGradient>
  </defs>
  <!-- 숲길 (점선) -->
  <path d="M-40 640 C 60 560, 150 600, 190 520 S 210 430, 236 400" fill="none" stroke="#F3E3C3" stroke-opacity=".28" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 26"/>
  <!-- 기둥 -->
  <rect x="226" y="120" width="34" height="520" rx="8" fill="#7A5F49"/>
  <rect x="226" y="120" width="12" height="520" rx="6" fill="#8D7058" />
  <rect x="222" y="110" width="42" height="22" rx="8" fill="#6B5442"/>
  <!-- 매듭 -->
  <rect x="218" y="188" width="50" height="34" rx="7" fill="#A82E25"/>
  <rect x="214" y="196" width="58" height="22" rx="6" fill="url(#rb)"/>
  <!-- 날리는 리본 두 가닥 -->
  <path d="M268 204 C 300 196, 330 214, 372 204 L 360 226 L 380 246 C 336 252, 302 236, 268 222 Z" fill="url(#rb)"/>
  <path d="M266 216 C 292 236, 312 268, 344 296 L 320 296 L 322 320 C 296 292, 278 262, 260 230 Z" fill="#A82E25"/>
  <!-- 땅 -->
  <ellipse cx="243" cy="636" rx="150" ry="22" fill="#163828"/>
</svg>"""

MARK = """<svg width="30" height="36" viewBox="0 30 220 230" aria-hidden="true"><rect x="95" y="38" width="30" height="40" rx="5" fill="#A82E25"/><path d="M8 62 C70 46 150 44 214 60" fill="none" stroke="#B89A80" stroke-width="16" stroke-linecap="round"/><rect x="94" y="47" width="32" height="18" rx="4" fill="#E0473A"/><rect x="99" y="64" width="22" height="13" rx="5" fill="#A82E25"/><path d="M118 74 C128 92 131 108 136 124 L127 119 L123 128 C120 108 116 92 110 76 Z" fill="#A82E25"/><path d="M95 75 L123 75 C125 130 126 190 128 254 L112 239 L94 256 C95 190 95 130 95 75 Z" fill="#E0473A"/></svg>"""

# 은은한 등고선 (배경)
TOPO = "".join(
    f'<ellipse cx="{980}" cy="{120}" rx="{140 + i * 95}" ry="{90 + i * 62}" fill="none" stroke="#FFFFFF" stroke-opacity="{0.05 - i * 0.004:.3f}" stroke-width="2"/>'
    for i in range(10)
)

TEMPLATE = """<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:{W}px;height:{H}px;overflow:hidden}}
body{{font-family:{FONT};background:#1F4A37;color:#FAFBF7;position:relative;word-break:keep-all}}
.bg{{position:absolute;inset:0}}
.art{{position:absolute;right:0;top:0}}
.wrap{{position:absolute;left:72px;top:60px;bottom:56px;width:780px;display:flex;flex-direction:column}}
.brand{{display:flex;align-items:center;gap:12px;font-size:30px;font-weight:700;letter-spacing:-.5px}}
.brand span{{font-size:21px;font-weight:500;color:#A9C4B4;letter-spacing:0;padding-left:14px;border-left:2px solid #3F6B57;margin-left:4px}}
.main{{flex:1;display:flex;flex-direction:column;justify-content:center}}
.kick{{display:inline-block;align-self:flex-start;font-size:22px;font-weight:700;color:#1F2A22;background:#E8A33D;border-radius:8px;padding:4px 14px 6px;margin-bottom:22px}}
h1{{font-weight:900;font-size:var(--fs,84px);line-height:1.16;letter-spacing:-2px;color:#FAFBF7}}
h1 .s1{{display:block;text-wrap:balance}}
h1 .s2{{display:block;font-weight:700;font-size:.56em;letter-spacing:-1px;color:#D5E4DA;margin-top:10px}}
.sub{{margin-top:24px;font-size:30px;font-weight:500;color:#CFE0D5;line-height:1.4;letter-spacing:-.5px}}
.pills{{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}}
.pills b{{font-size:24px;font-weight:700;color:#F6E7C8;border:2px solid #E8A33D;border-radius:999px;padding:5px 18px 7px}}
.foot{{font-size:22px;font-weight:500;color:#A9C4B4;letter-spacing:.2px}}
.foot b{{color:#FAFBF7;font-weight:700}}
</style></head><body>
<svg class="bg" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#1F4A37"/><circle cx="1010" cy="140" r="520" fill="#245440" opacity=".55"/>{TOPO}</svg>
{ART}
<div class="wrap">
  <div class="brand">{MARK}표지기<span>길 잃은 사람을 위한 리본</span></div>
  <div class="main">{kick}<h1 id="t">{title}</h1>{sub}{pills}</div>
  <div class="foot"><b>pyojigi.pages.dev</b> · 무료 진로 검사</div>
</div>
<script>
// 제목이 3줄을 넘거나 넘치면 글자를 줄여요
(function(){{const t=document.getElementById('t');let fs={fs};const lh=1.16;
 const main=document.querySelector('.main');
 while(fs>44){{t.style.setProperty('--fs',fs+'px');const lines=Math.round(t.querySelector('.s1').getBoundingClientRect().height/(fs*lh));
  if(lines<={maxl} && main.scrollHeight<=main.clientHeight+1)break;fs-=4;}}
 document.body.dataset.fs=fs;}})();
</script>
</body></html>"""


def esc(s):
    return H.escape(s, quote=True)


def card(title, title2="", sub="", kick="", pills=(), fs=84, maxl=2):
    t = f'<span class="s1">{esc(title)}</span>' + (f'<span class="s2">{esc(title2)}</span>' if title2 else "")
    return TEMPLATE.format(
        W=W, H=HGT, FONT=FONT, ART=ART, MARK=MARK, TOPO=TOPO, fs=fs, maxl=maxl,
        title=t,
        kick=f'<div class="kick">{esc(kick)}</div>' if kick else "",
        sub=f'<p class="sub">{esc(sub)}</p>' if sub else "",
        pills=('<div class="pills">' + "".join(f"<b>{esc(p)}</b>" for p in pills) + "</div>") if pills else "",
    )


def text(s):
    return H.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def find(pat, s, default=""):
    m = re.search(pat, s, re.S)
    return text(m.group(1)) if m else default


def jobs_specs(pub: Path):
    for f in sorted((pub / "jobs").glob("*.html")):
        if f.name == "index.html":
            continue
        h = f.read_text("utf-8")
        h1 = find(r"<h1>(.*?)</h1>", h)
        prep = find(r"<dt>준비 기간</dt><dd>(.*?)</dd>", h)
        sal = find(r"<dt>연봉</dt><dd>(.*?)</dd>", h)
        m = re.search(r"연 ([\d,]+)만원 → 경력 5년 이상 ([\d,]+)만원", sal)
        pills = [f"준비 기간 {prep}"] if prep else []
        if m:
            pills.append(f"연봉 {m.group(1)}~{m.group(2)}만원")
        yield f"og/{f.stem}.png", dict(kick="직업별 안내", title=h1, sub="하는 일 · 되는 법 · 자격증 · 준비 단계", pills=pills)


def for_specs(pub: Path):
    for f in sorted((pub / "for").glob("*.html")):
        if f.name == "index.html":
            continue
        h = f.read_text("utf-8")
        h1 = find(r"<h1>(.*?)</h1>", h)
        m = re.match(r"^(.*?)\s*\((.*)\)\s*$", h1)
        t1, t2 = (m.group(1), m.group(2)) if m else (h1, "")
        tops = re.search(r"많이 추천되는 길</h2>.*?<div class=\"chips\">(.*?)</div>", h, re.S)
        names = [text(x) for x in re.findall(r"<a [^>]*>(.*?)</a>", tops.group(1))][:3] if tops else []
        sub = "먼저 확인할 것 · 많이 추천되는 길 · 도움받을 곳"
        yield f"og/for-{f.stem}.png", dict(kick="상황별 진로 안내", title=t1, title2=t2, sub=sub, pills=names)


def all_specs(pub: Path):
    yield "og.png", dict(title="20분이면 내 길 3개가 보여요", sub="중학생·고등학생·대학생·첫 취업 무료 진로 검사",
                          pills=["가입 없이", "답은 내 기기에만 저장"], fs=88)
    n = len([f for f in (pub / "jobs").glob("*.html") if f.name != "index.html"])
    yield "og/jobs.png", dict(kick="직업별 안내", title=f"{n}개 분야, 되는 법·연봉·자격증", sub="준비 기간과 오늘 해 볼 것까지 한곳에")
    yield "og/for.png", dict(kick="상황별 진로 안내", title="지금 내 상황에서 갈 수 있는 길", sub="중학생 · 고등학생 · 자퇴 · 재수 · 대학생 · 첫 취업")
    yield from jobs_specs(pub)
    yield from for_specs(pub)


def save_png(raw: bytes, out: Path):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    for colors in (256, 192, 128, 96, 64):
        q = im.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        buf = io.BytesIO()
        q.save(buf, "PNG", optimize=True)
        if buf.tell() <= MAX_BYTES:
            break
    out.write_bytes(buf.getvalue())
    return buf.tell(), colors


def main():
    pub = Path(sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parent.parent / "public"))
    if not (pub / "jobs").is_dir():
        sys.exit("먼저 gen_pages.js 를 실행하세요 (jobs/ 폴더가 없어요)")
    (pub / "og").mkdir(exist_ok=True)
    specs = list(all_specs(pub))
    keep = {pub / name for name, _ in specs}
    for old in (pub / "og").glob("*.png"):  # 사라진 페이지의 이미지는 지우기
        if old not in keep:
            old.unlink()
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": HGT}, device_scale_factor=1)
        big = []
        for name, spec in specs:
            pg.set_content(card(**spec), wait_until="load")
            pg.evaluate("document.fonts.ready")
            # 한글 글꼴 확인 (없으면 네모 깨짐)
            ok = pg.evaluate("document.fonts.check('900 80px \"Noto Sans CJK KR\"', '표지기')")
            if not ok:
                sys.exit("Noto Sans CJK KR 글꼴을 찾을 수 없어요 (fc-list :lang=ko 확인)")
            size, colors = save_png(pg.screenshot(type="png"), pub / name)
            fs = pg.evaluate("document.body.dataset.fs")
            if size > MAX_BYTES:
                big.append((name, size))
            print(f"{name:28s} {size/1024:6.1f}KB colors={colors} fs={fs}")
        b.close()
    print(f"done {len(specs)} images" + (f", over {MAX_BYTES//1000}KB: {big}" if big else ""))


if __name__ == "__main__":
    main()
