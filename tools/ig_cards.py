#!/usr/bin/env python3
"""인스타 게시물 이미지 만들기 (1080x1350, 표지기 카드뉴스 디자인).

content/ig/<id>.json 하나 = 게시물 하나. 실행하면 public/ig/<id>/1.png ... 과
public/ig/index.html(폰에서 저장·글 복사하는 운영자용 페이지, 검색 제외)을 만들어요.

사용: python3 tools/ig_cards.py            # 전체
      python3 tools/ig_cards.py <id>       # 하나만

JSON 형식:
{"id":"2026-10-22-csat", "title":"관리용 제목", "caption":"게시물 글 전체",
 "slides":[
  {"t":"cover","eyebrow":"수능 끝난 고3","title":"줄1<br>줄2","red":"빨간 강조 단어(제목 안 문자열)","chip":"📅 12/11 성적 발표"},
  {"t":"timeline","title":"남은 일정,<br>한 장에","items":[["11/19","수능"],["12/11","성적 발표",1]],"save":1,"src":"출처 ..."},
  {"t":"text","eyebrow":"① 지금 할 일","title":"...","sub":"...","bullets":["..."],"blanks":3,"chip":"...","call":"아래 큰 상자 문구(진짜는 ...)","stats":[["28","개 캠퍼스"]],"src":"출처 ..."},
  {"t":"flow","eyebrow":"...","title":"...","q1":"...","q1no":"...","q2":"...","yes":"...","no":"..."},
  {"t":"result","title":"...","img":"result_card_it.png"},
  {"t":"cta","title":"내 상황에 맞는<br>길 3개","sub":"...","chip":"20분 · 무료 · 가입 없음"}
 ]}
규칙: 사실(날짜·숫자·제도)은 공식 출처로 확인한 것만, 출처를 src 에 적는다. 지어낸 후기·실존 인물 얼굴·남의 캐릭터 금지.
"""
import base64, html, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'content' / 'ig', ROOT / 'public' / 'ig'
RIB = '<svg viewBox="0 0 60 80" width="{w}" height="{h}"><rect x="12" y="6" width="36" height="16" rx="4" fill="#E0473A"/><rect x="20" y="20" width="20" height="10" rx="4" fill="#A82E25"/><path d="M22 28 L38 28 L40 78 L30 68 L20 78 Z" fill="#E0473A"/></svg>'
rib = lambda w=40: RIB.format(w=w, h=int(w * 4 / 3))
CSS = '''*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:"Noto Sans CJK KR","Pretendard",sans-serif;background:#F7F3EA;color:#1F4A37;position:relative;word-break:keep-all;letter-spacing:-1px}
body.g{background:#1F4A37;color:#F7F3EA}
.logo{position:absolute;left:80px;top:70px;display:flex;align-items:center;gap:12px;font-size:36px}
.pg{position:absolute;right:80px;top:78px;font-size:30px;font-weight:700;opacity:.55}
.h{position:absolute;left:80px;right:80px;top:200px}
h1{font-size:104px;line-height:1.18;font-weight:900;letter-spacing:-4px}h2{font-size:92px;line-height:1.2;font-weight:900;letter-spacing:-3px}
.r{color:#E0473A}.sub{margin-top:36px;font-size:46px;line-height:1.45;font-weight:500;opacity:.85}
.chip{display:inline-flex;align-items:center;gap:14px;margin-top:56px;background:#E0473A;color:#fff;font-size:44px;font-weight:800;padding:20px 36px;border-radius:999px}
.eb{display:inline-block;font-size:38px;font-weight:800;color:#E0473A;margin-bottom:26px}
.src{position:absolute;left:80px;right:80px;bottom:70px;font-size:28px;font-weight:500;opacity:.7}
.save{position:absolute;right:80px;bottom:190px;font-size:36px;font-weight:800;color:#E0473A}
.tl{position:absolute;left:110px;top:440px;right:80px}.tl .it{position:relative;padding-left:110px;height:190px}
.tl .it:before{content:"";position:absolute;left:28px;top:60px;bottom:-60px;width:6px;background:#CFC6B2;border-radius:3px}
.tl .it:last-child:before{display:none}.tl .rb{position:absolute;left:0;top:0}
.tl .d{font-size:64px;font-weight:900}.tl .t{font-size:40px;font-weight:600;margin-top:4px;opacity:.85}.tl .hot .d{color:#E0473A}
.ul{margin-top:50px;list-style:none}.ul li{font-size:46px;font-weight:700;line-height:1.4;margin-bottom:30px;padding-left:56px;position:relative}
.ul li:before{content:"";position:absolute;left:0;top:14px;width:30px;height:36px;background:#E0473A;clip-path:polygon(0 0,100% 0,100% 100%,50% 75%,0 100%)}
.blank{margin-top:70px}.blank div{display:flex;align-items:flex-end;gap:24px;font-size:60px;font-weight:900;margin-bottom:56px}
.blank span{flex:1;border-bottom:6px solid #1F4A37;height:70px;opacity:.85}
.fc{position:absolute;left:80px;right:80px;top:520px}.q{background:#fff;border:4px solid #1F4A37;border-radius:28px;padding:30px 36px;font-size:46px;font-weight:800}
.ar{display:flex;justify-content:space-between;font-size:36px;font-weight:800;margin:18px 10px}
.end{display:flex;gap:24px;margin-top:10px}.end div{flex:1;border-radius:28px;padding:30px;font-size:42px;font-weight:800;text-align:center}
.y{background:#1F4A37;color:#F7F3EA}.n{background:#E0473A;color:#fff}
.stats{display:flex;gap:24px;margin-top:80px}.stats div{flex:1;background:#fff;border-radius:28px;padding:34px 20px;text-align:center;font-size:36px;font-weight:700}
.stats b{display:block;font-size:76px;font-weight:900;color:#1F4A37}
.phone{position:absolute;left:50%;transform:translateX(-50%);top:470px;width:560px;border-radius:64px;background:#111;padding:22px;box-shadow:0 30px 60px rgba(0,0,0,.25)}
.phone .scr{border-radius:44px;overflow:hidden;background:#F2F3EE}.phone img{width:100%;display:block}
.call{position:absolute;left:80px;right:80px;bottom:150px;background:#1F4A37;color:#F7F3EA;border-radius:36px;padding:52px 56px;font-size:58px;line-height:1.3;font-weight:900;letter-spacing:-2px}.call small{display:block;font-size:34px;font-weight:700;color:#E8A49C;margin-bottom:14px;letter-spacing:0}
.tag{position:absolute;left:80px;bottom:70px;font-size:26px;font-weight:700;opacity:.6}'''
e = lambda s: s or ''

def red(title, word):
    return title.replace(word, f'<span class=r>{word}</span>', 1) if word else title

def slide(s, n, N):
    t, body, cls = s['t'], '', ''
    if t == 'cover':
        cls = 'g'
        body = f'<div class=h style="top:300px">{f"<div class=eb>{s["eyebrow"]}</div>" if s.get("eyebrow") else ""}<h1>{red(s["title"], s.get("red"))}</h1>{f"<div class=chip>{s["chip"]}</div>" if s.get("chip") else ""}</div><div class=src style="opacity:.6">넘겨서 보기 →</div>'
    elif t == 'timeline':
        its = ''.join(f'<div class="it{" hot" if len(i) > 2 and i[2] else ""}"><div class=rb>{rib(60)}</div><div class=d>{i[0]}</div><div class=t>{i[1]}</div></div>' for i in s['items'])
        body = f'<div class=h><h2>{s["title"]}</h2></div><div class=tl>{its}</div>{"<div class=save>🔖 저장해 두세요</div>" if s.get("save") else ""}'
    elif t == 'text':
        body = f'<div class=h>{f"<div class=eb>{s["eyebrow"]}</div>" if s.get("eyebrow") else ""}<h2>{red(s["title"], s.get("red"))}</h2>'
        if s.get('sub'): body += f'<div class=sub>{s["sub"]}</div>'
        if s.get('bullets'): body += '<ul class=ul>' + ''.join(f'<li>{b}</li>' for b in s['bullets']) + '</ul>'
        if s.get('blanks'): body += '<div class=blank>' + ''.join(f'<div>{k}<span></span></div>' for k in range(1, s['blanks'] + 1)) + '</div>'
        if s.get('chip'): body += f'<div class=chip>{s["chip"]}</div>'
        if s.get('stats'): body += '<div class=stats>' + ''.join(f'<div><b>{a}</b>{b}</div>' for a, b in s['stats']) + '</div>'
        body += '</div>'
        if s.get('call'): body += f'<div class=call><small>진짜는</small>{s["call"]}</div>'
    elif t == 'flow':
        body = f'<div class=h>{f"<div class=eb>{s["eyebrow"]}</div>" if s.get("eyebrow") else ""}<h2>{s["title"]}</h2></div><div class=fc><div class=q>{s["q1"]}</div><div class=ar><span>↓ 예</span><span>{s.get("q1no","아니오 →")}</span></div><div class=q>{s["q2"]}</div><div class=ar><span>↓ 예</span><span>↓ 아니오</span></div><div class=end><div class=y>{s["yes"]}</div><div class=n>{s["no"]}</div></div></div>'
    elif t == 'result':
        img = 'data:image/png;base64,' + base64.b64encode((SRC / s['img']).read_bytes()).decode()
        body = f'<div class=h style="top:180px"><h2 style="font-size:80px">{s["title"]}</h2></div><div class=phone><div class=scr><img src="{img}"></div></div><div class=tag>실제 검사 결과 화면 예시</div>'
    elif t == 'cta':
        cls = 'g'
        body = f'<div class=h style="top:330px"><h1>{s["title"]}</h1>{f"<div class=sub>{s["sub"]}</div>" if s.get("sub") else ""}<div class=chip style="font-size:52px;padding:26px 44px">{s.get("chip","20분 · 무료 · 가입 없음")}</div><div class=sub style="margin-top:60px;font-weight:800">👉 프로필 링크에서 시작</div></div>'
    else:
        raise ValueError('모르는 슬라이드 종류: ' + t)
    if s.get('src') and t != 'cover': body += f'<div class=src>출처: {s["src"]}</div>'
    logo = f'<div class=logo>{rib(34)}<b>표지기</b></div><div class=pg>{n}/{N}</div>'
    return f'<!doctype html><html><head><meta charset=utf-8><style>{CSS}</style></head><body class="{cls}">{logo}{body}</body></html>'

def build(ids=None):
    posts = sorted((json.loads(p.read_text(encoding='utf-8')) for p in SRC.glob('*.json')), key=lambda x: x['id'], reverse=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page(viewport={'width': 1080, 'height': 1350})
        for p in posts:
            if ids and p['id'] not in ids: continue
            d = OUT / p['id']; d.mkdir(parents=True, exist_ok=True)
            for old in d.glob('*.png'): old.unlink()
            N = len(p['slides'])
            for i, s in enumerate(p['slides'], 1):
                pg.set_content(slide(s, i, N)); pg.wait_for_timeout(250)
                pg.screenshot(path=str(d / f'{i}.png'), type='png')
            print('made', p['id'], N, 'slides')
        b.close()
    rows = ''
    for p in posts:
        imgs = ''.join(f'<a href="{p["id"]}/{i}.png" download="pyojigi_{p["id"]}_{i}.png"><img src="{p["id"]}/{i}.png" loading="lazy" alt="{i}번"></a>' for i in range(1, len(p['slides']) + 1))
        rows += f'<section><h2>{html.escape(p.get("title", p["id"]))}</h2><p class=m>{p["id"]} · {len(p["slides"])}장 · 이미지를 길게 눌러 저장하고 1번부터 순서대로 올려요</p><div class=g>{imgs}</div><textarea readonly>{html.escape(p["caption"])}</textarea><button onclick="navigator.clipboard.writeText(this.previousElementSibling.value);this.textContent=\'복사했어요\'">글 복사</button></section>'
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'index.html').write_text(f'''<!doctype html><html lang=ko><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><title>인스타 게시물 · 표지기 운영</title>
<style>body{{font-family:system-ui,sans-serif;background:#F7F3EA;color:#1F4A37;margin:0;padding:16px;max-width:720px;margin:auto}}h1{{font-size:22px}}section{{background:#fff;border-radius:16px;padding:16px;margin:16px 0}}h2{{font-size:18px;margin:0 0 4px}}.m{{font-size:13px;opacity:.7;margin:0 0 10px}}
.g{{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}}.g img{{width:100%;border-radius:8px;display:block}}textarea{{width:100%;box-sizing:border-box;height:150px;margin-top:10px;font:14px/1.5 system-ui;border:1px solid #ddd;border-radius:8px;padding:8px}}
button{{margin-top:8px;width:100%;padding:12px;border:0;border-radius:10px;background:#1F4A37;color:#fff;font-size:16px;font-weight:700}}</style></head>
<body><h1>인스타 게시물 (운영자용)</h1><p class=m>새 게시물이 맨 위예요. 이 페이지는 검색에 안 나와요.</p>{rows}</body></html>''', encoding='utf-8')

if __name__ == '__main__':
    build(set(sys.argv[1:]) or None)
