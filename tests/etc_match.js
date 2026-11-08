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
 ["goal","아직 모름","아직 없다"],["goal","몰라요","아직 없다"],["goal","모르겠어요","아직 없다"],["cur","그냥 대학생인데요","일해본 적 없음"],["cur","취준생","일해본 적 없음"],
 // 2026-11-03 작업자 A: 서진(2종 소형·운전 일), 태윤(설비보전·공조냉동 그거), 예린(음향·실용음악), 민준(기계설계·생산기술·품질관리), 지수·지호(고민·상황 말은 보기에 맞추지 않음)
 ["cert","2종 소형 (오토바이)",null],["cert","원동기 2종소형",null],["cert","2종 보통","운전면허"],["cert","공조냉동 그거","공조냉동기계"],["cert","한국사 자격증","한국사능력검정"],
 ["goal","운전 일","물류·운전"],["goal","화물 운전","물류·운전"],["goal","버스 기사","물류·운전"],["goal","배달 말고 운전 일","물류·운전"],
 ["goal","설비보전","전기·설비"],["goal","음향 엔지니어","문화예술"],["goal","실용음악","문화예술"],["goal","엔터 회사","문화예술"],
 ["goal","기계설계","공학 엔지니어"],["goal","설계 엔지니어","공학 엔지니어"],["goal","생산기술","공학 엔지니어"],["goal","품질관리","공학 엔지니어"],
 ["goal","병원 말고 다른 일",null],["goal","간호학과 자퇴",null],["goal","편의점 야간",null],["cert","검정고시",null],["cert","없음",null],
 // 2026-11-07 하린: 호텔 프런트 계약직
 ["cur","호텔 프런트","매장"],["cur","프론트","매장"],["cur","리셉션","매장"],["cur","호텔 리셉션 계약직","매장"],
 // 2026-11-08 리나: 다문화 가정·베트남어
 ["goal","통역","무역·통번역"],["goal","통역사","무역·통번역"],["goal","베트남어 통역","무역·통번역"],["goal","이중언어","무역·통번역"],["goal","수어 통역사",null],
 ["cert","FLEX","외국어 점수"],["cert","오픽","외국어 점수"],["cert","TOPIK","외국어 점수"],["plan","FLEX 베트남어","외국어 점수"],["cert","IELTS","외국어 점수"],["cert","베트남어",null],["cert","이중언어",null],
 ["goal","ㅁㄴㅇㄹ",null]];
// 못 찾았을 때 나오는 답 (etcSay): [질문, 적은 말, 상황, 답에 있어야 할 말]
const S=[["cert","없음",null,"딱히 없음"],["goal","병원 말고 다른 일","col","한 줄 칸"],["goal","간호학과 자퇴","col","한 줄 칸"],
 ["cert","검정고시","drop","검정고시 질문이 따로"],["goal","편의점 야간","drop","아직 없다"],["cert","2종 소형 (오토바이)","job","물류·운송"],["goal","우주비행사","job",null],["cert","베트남어","hs","FLEX"],["cert","중국어 회화","job","무역·통번역"]];
(async()=>{ const b=await chromium.launch(); const p=await b.newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({status:200,body:'{}'}));
 await p.goto('file://'+require('path').resolve(__dirname,'../public/index.html'));
 const got=await p.evaluate(E=>E.map(([id,w])=>{ const q=Q.find(x=>x.id===id); const k=etcFind(q,w); return k<0?null:q.o[k][0]; }),E);
 const said=await p.evaluate(S=>S.map(([id,w,sit])=>{ const sq=Q.find(x=>x.id==="sit"); st.ans.sit=sit?sq.o.findIndex(o=>o[2]&&o[2].sit===sit):undefined; const q=Q.find(x=>x.id===id); const r=etcSay(q,w); return r?r.msg:null; }),S);
 let bad=0; S.forEach(([id,w,sit,want],i)=>{ const g=said[i]; const ok=want===null?g===null:(g||"").includes(want); if(!ok){ bad++; console.log("FAIL 답",id,w,"→",g,"(기대:",want,")"); } });
 E.forEach(([id,w,want],i)=>{ const g=got[i]; const ok=want===null?g===null:(g||"").startsWith(want); if(!ok){ bad++; console.log("FAIL",id,w,"→",g,"(기대:",want,")"); } });
 console.log(bad?`실패 ${bad}건`:`ALL PASS (${E.length+S.length}건)`); await b.close(); process.exit(bad?1:0); })();
