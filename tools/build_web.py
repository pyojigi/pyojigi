import re, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P=lambda *x: os.path.join(ROOT,*x)
src=open(P('src','pyojigi.html')).read()
def R(s,a,b):
    assert a in s, "MISSING: "+a[:90]; return s.replace(a,b,1)

# 1) 문서 머리와 몸 분리
i=src.index('<div class="wrap">')
head, body = src[:i], src[i:]
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
reset = '''<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:14px}
img{max-width:100%}
[hidden]{display:none!important}
</style>
'''
meta = '''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="google-site-verification" content="sYlME7471VsXeJt91Jrpw-SPSdKKNPL1IyIkw5MFWFc">
<meta name="naver-site-verification" content="5ac34010da8ecdce736ba237c5c402cedb749726">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,viewport-fit=cover">
<meta name="description" content="중학생·고등학생·자퇴·재수생·대학생·첫 취업 준비생을 위한 무료 진로 검사. 10분 질문으로 나한테 맞는 길 3개와 되는 법, 연봉, 받을 수 있는 지원을 정리해 드려요.">
<meta property="og:type" content="website">
<meta property="og:title" content="표지기 · 10대·20대 초 무료 진로 검사">
<meta property="og:description" content="10분 질문으로 내 진로 3개와 받을 수 있는 지원까지">
<meta property="og:image" content="https://pyojigi.pages.dev/og.png">
<meta property="og:url" content="https://pyojigi.pages.dev/">
<meta property="og:site_name" content="표지기">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:title" content="표지기 · 10대·20대 초 무료 진로 검사">
<meta name="twitter:image" content="https://pyojigi.pages.dev/og.png">
<link rel="canonical" href="https://pyojigi.pages.dev/">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"표지기","url":"https://pyojigi.pages.dev/","inLanguage":"ko"},{"@type":"WebApplication","name":"표지기 진로 검사","url":"https://pyojigi.pages.dev/","applicationCategory":"EducationalApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"KRW"},"inLanguage":"ko","audience":{"@type":"Audience","audienceType":"중학생, 고등학생, 대학생, 첫 취업 준비생"}}]}</script>
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F2F4F6">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
''' + reset
head = head.replace('<title>표지기</title>','<title>표지기 · 10대·20대 초 무료 진로 검사</title>')
doc = meta + head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n'

# 2) AI: 아티팩트 기능 대신 자체 서버(/api/ai)
doc = R(doc, '''let SAMPLE=null, sampleReady=false;
try{ window.claude?.use?.("sample").then(fn=>{SAMPLE=fn; sampleReady=true; const c=document.getElementById("aiCard"); if(c&&SAMPLE) c.hidden=false;}).catch(()=>{}); }catch(e){}''',
'''// 자체 서버의 AI 상담 (/api/ai). 브라우저에는 API 키가 없다.
async function SAMPLE(input, opts){
  opts=opts||{};
  const messages = typeof input==="string" ? [{role:"user",content:input}] : input;
  let res;
  try{ res = await fetch("/api/ai",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages}),signal:opts.signal}); }
  catch(e){ throw {code: e&&e.name==="AbortError" ? "cancelled" : "network"}; }
  let data={}; try{ data=await res.json(); }catch(e){}
  if(!res.ok || data.error) throw {code: data.error||"upstream"};
  if(opts.onText) opts.onText({text:data.text, delta:data.text});
  if(typeof data.left==="number"){ const n=document.getElementById("aiNote"); if(n) n.textContent = messages.length===1 ? `오늘 ${data.left}번 더 읽을 수 있어요.` : `오늘 질문 ${data.left}번 더 할 수 있어요.`; }
  return {text:data.text, truncated:!!data.truncated};
}''')
doc = R(doc, 'const AI_ERR={', 'const AI_ERR={limit:"오늘 사용할 수 있는 횟수를 다 썼어요. 내일 다시 이용해 주세요.",busy:"지금 이용하는 사람이 많아요. 잠시 뒤 다시 눌러 주세요.",network:"인터넷 연결을 확인하고 다시 눌러 주세요.",off:"AI 기능을 잠시 쉬고 있어요.",empty:"답이 비어 있어요. 다시 눌러 주세요.",')
doc = R(doc, 'card.hidden=!SAMPLE;', 'card.hidden=false;')
doc = R(doc, 'if(e&&["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].includes(e.code)) card.hidden=true;', 'if(e&&e.code==="off") card.hidden=true;')
doc = R(doc, '처음 누르면 사용 허락을 한 번 묻습니다.', '누르면 답 내용이 AI로 보내져요. 하루 3번까지 읽고, 이어서 질문할 수 있어요. 답변에 20초 정도 걸려요.')
doc = R(doc, 'out.textContent="읽는 중이에요...";', 'out.textContent="읽는 중이에요... 20초 정도 걸려요.";')

# 3) 익명 통계 전송
doc = R(doc, 'function track(ev){} // 웹 빌드에서 익명 통계 전송으로 바뀜', '''// 익명 통계 (답 내용·적은 문장은 보내지 않음)
function track(ev){ if(ev.type!=="visit" && !agreed()) return; try{ fetch("/api/event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(ev),keepalive:true}).catch(()=>{}); }catch(e){} }''')
doc = R(doc, 'const FB_API=null; // 웹 빌드에서 "/api/feedback"으로 바뀜', 'const FB_API="/api/feedback";')
doc = R(doc, 'document.getElementById("start").onclick=()=>{st={ans:{},i:0,phase:"q",mid:-1,review:0};save();render()};',
             'document.getElementById("start").onclick=()=>{st={ans:{},i:0,phase:"q",mid:-1,review:0};save();track({type:"start"});render()};')
doc = R(doc, 'function finish(){ st.phase="result"; st.done=1; save(); render(); }',
             'function finish(){ const first=!st.done; st.phase="result"; st.done=1; save(); render(); if(first){ try{ const P=score(); track({type:"finish",sit:sitKey(),age:st.ans.age,ag:st.ans.ag,top:P[0].key,tops:P.slice(0,3).map(p=>p.key),low:lowConf(P)}); }catch(e){} etcFlush(); } }')
doc = R(doc, 'b.onclick=()=>{ st.fb=b.dataset.fb; save();', 'b.onclick=()=>{ if(st.fb!==b.dataset.fb) track({type:"feedback",fb:b.dataset.fb}); st.fb=b.dataset.fb; save();')
doc = R(doc, 'fbCopy.onclick=()=>{', 'fbCopy.onclick=()=>{ track({type:"copy"});')
doc = R(doc, 'render();\n</script>', """// 들어온 곳: 이전 사이트 주소의 도메인과 검색어만 (전체 주소는 보내지 않음)
try{ const v={type:"visit",src:(new URLSearchParams(location.search).get("src")||"").slice(0,20)};
  try{ if(document.referrer){ const u=new URL(document.referrer); if(u.hostname!==location.hostname){ v.ref=u.hostname.toLowerCase().slice(0,60); const kw=["query","q","wd","search_query","keyword","p","oquery"].map(k=>u.searchParams.get(k)).find(Boolean); if(kw) v.kw=kw.slice(0,40); } } }catch(e){}
  track(v); }catch(e){ track({type:"visit"}); }
render();
</script>""")

# 4) 개인정보 안내 (자체 서버 기준)
doc = R(doc, '''      <h3>운영자는 답을 받지 않아요</h3>
      <p class="hint" style="color:var(--ink)">질문에 고른 답과 적은 문장은 서버로 보내지 않고, 지금 쓰는 기기의 브라우저에만 저장돼요. 중간에 나갔다가 이어서 하기 위한 용도예요. 다른 사람이나 운영자는 볼 수 없어요.</p>''',
'''      <h3>답은 내 기기에만 저장돼요</h3>
      <p class="hint" style="color:var(--ink)">질문에 고른 답과 적은 문장은 지금 쓰는 기기의 브라우저에만 저장돼요. 중간에 나갔다가 이어서 하기 위한 용도이고, 운영자는 볼 수 없어요.</p>
      <h3>익명 이용 통계</h3>
      <p class="hint" style="color:var(--ink)">서비스를 고치기 위해 방문·시작·완주 시각(분 단위), 상황 종류(예: 고등학생), 나이대, 추천된 길 3개, 만족도 버튼, '이 추천은 아니에요' 선택, 결과 전에 그만둔 질문 번호만 기록해요. 누가 했는지 알 수 없게 남기고, 답 내용, 적은 문장, 이름, 연락처, IP 주소는 저장하지 않아요.</p>
      <h3>한마디 피드백</h3>
      <p class="hint" style="color:var(--ink)">결과 화면에서 '피드백 보내기'를 누를 때만 그 한마디(300자 이내)와 만족도, 상황 종류, 추천 결과가 서버에 저장돼 운영자가 읽어요. 90일 뒤 자동으로 지워지니 이름·연락처는 적지 마세요. 같은 사람이 하루 5번까지 보낼 수 있고, 이를 세려고 IP 주소를 알아볼 수 없게 바꾼 값만 이틀 보관해요.</p>''')
doc = R(doc, '''결과 화면에서 '내 이야기 읽어 주기'를 누르면, 그때 답 내용이 Anthropic의 AI(Claude)로 보내져 답변을 만들어요. 처음 누를 때 사용 허락을 묻고, 누르지 않으면 아무것도 보내지 않아요.''',
'''결과 화면에서 '내 이야기 읽어 주기'를 누르면, 그때 답 내용이 Anthropic의 AI(Claude)로 보내져 답변을 만들어요. 표지기 서버는 답변 내용을 저장하지 않아요. 하루 이용 횟수를 세기 위해 IP 주소를 알아볼 수 없게 바꾼 값만 이틀 동안 보관한 뒤 자동으로 지워요. 누르지 않으면 아무것도 보내지 않아요.''')
doc = R(doc, '문의·제안', '<a href="/jobs/">직업별 안내</a> · <a href="/for/">상황별 안내</a> · <a href="/guide/">진로 가이드</a> · 문의·제안')
open(P('public','index.html'),'w').write(doc)
print('built', len(doc))
# 5) 캘린더 파일 (구독용 cal.ics, 일정별 ev/*.ics)
import subprocess
print(subprocess.run(['node',P('tools','gen_ics.js'),P('public')],capture_output=True,text=True,check=True).stdout.strip())
# 6) 검색 노출용 정적 페이지 (/jobs/, /for/, sitemap.xml) — 도메인을 사면 SITE_URL만 바꾸기
import os
SITE_URL=os.environ.get('SITE_URL','https://pyojigi.pages.dev')
print(subprocess.run(['node',P('tools','gen_pages.js'),P('public'),SITE_URL],capture_output=True,text=True,check=True).stdout.strip())
# 7) 페이지별 공유 이미지
print(subprocess.run(['python3',P('tools','og_images.py'),P('public')],capture_output=True,text=True,check=True).stdout.strip()[-200:])
