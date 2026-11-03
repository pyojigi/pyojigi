// 기타 칸 알아듣기 검사: node tests/etc_match.js → ALL PASS
// 사람들이 실제로 적은 말·페르소나가 적은 말이 알맞은 보기에 맞는지. 새로 고칠 때마다 여기에 한 줄씩 더한다.
const {chromium}=require('playwright');
const E=[ // [질문, 적은 말, 맞아야 하는 보기 이름 앞부분(null 이면 못 찾아야 함)]
 ["cert","한식조리기능사","한식·양식"],["cert","제과제빵","제과기능사"],["cert","파티시에","제과기능사"],["cert","네일","미용사"],
 ["cert","메이크업","미용사"],["cert","산업안전기사","산업안전"],["cert","위험물기능사","위험물"],["cert","컴퓨터활용능력2급","컴퓨터활용능력"],
 ["cert","공조냉동","공조냉동기계"],["cert","설비보전","기계정비"],["cert","물류","물류관리사"],["cert","컴활","컴퓨터활용능력"],["cert","기계장치제어","일학습병행"],
 ["plan","양식조리기능사","한식·양식"],["plan","유기농업기능사","유기농업"],
 ["goal","급식 조리사","요리·제빵"],["goal","파티시에","요리·제빵"],["goal","게임 개발","IT"],["goal","전기기사","전기·설비"],
 ["goal","공무원","공무원·공기업"],["goal","교사","학교 교사"],["goal","9급","공무원·공기업"],["goal","코치","체육 지도"],
 ["cur","호텔 조리사","매장"],["cur","식당 주방","매장"],["cur","부사관","군인"],["cur","배달","물류"],
 ["goal","ㅁㄴㅇㄹ",null]];
(async()=>{ const b=await chromium.launch(); const p=await b.newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({status:200,body:'{}'}));
 await p.goto('file://'+require('path').resolve(__dirname,'../public/index.html'));
 const got=await p.evaluate(E=>E.map(([id,w])=>{ const q=Q.find(x=>x.id===id); const k=etcFind(q,w); return k<0?null:q.o[k][0]; }),E);
 let bad=0; E.forEach(([id,w,want],i)=>{ const g=got[i]; const ok=want===null?g===null:(g||"").startsWith(want); if(!ok){ bad++; console.log("FAIL",id,w,"→",g,"(기대:",want,")"); } });
 console.log(bad?`실패 ${bad}건`:`ALL PASS (${E.length}건)`); await b.close(); process.exit(bad?1:0); })();
