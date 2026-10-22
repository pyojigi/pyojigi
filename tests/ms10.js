const {M,randomPersona}=require('./logic.js');
let seed=1021; const rnd=()=>(seed=(seed*16807)%2147483647,(seed-1)/2147483646);
// 중학생 10명: [이름, 고른 답 덮어쓰기, 적은 막막함]
const P=[
["중2 게임만 하는 아이",{ms1:1,ms2:5,ms3:2,ms4:0},"공부하기 싫고 게임만 하고 싶어요 엄마랑 맨날 싸워요"],
["중3 특성화고 고민",{ms1:2,ms2:5,ms3:2,ms4:0},"특성화고 갈지 일반고 갈지 모르겠어요"],
["중3 전교권 의사 지망",{ms1:2,ms2:4,ms3:0,ms4:4},"의사 되고 싶은데 지금부터 뭘 해야 돼요?"],
["중1 아무 생각 없음",{ms1:0,ms2:5,ms3:1,ms4:6},"그냥 잘 모르겠어요"],
["중2 태권도 선수",{ms1:1,ms2:3,ms3:2,ms4:1,cert:[11]},"태권도 선수 하고 싶은데 부모님이 반대해요"],
["중3 마이스터고 지망",{ms1:2,ms2:1,ms3:1,ms4:0},"반도체 마이스터고 가고 싶어요"],
["중2 따돌림 경험",{ms1:1,ms2:5,ms3:1,ms4:4},"학교에 친구가 없어서 학교 가기 싫어요"],
["중3 웹툰 작가 꿈",{ms1:2,ms2:2,ms3:1,ms4:2},"웹툰 작가 되고 싶은데 예고 가야 하나요"],
["중2 유튜버 꿈",{ms1:1,ms2:5,ms3:2,ms4:4},"유튜버 하면 돈 많이 번다던데"],
["중3 집안 형편 어려움",{ms1:2,ms2:1,ms3:1,ms4:5},"집이 어려워서 빨리 돈 벌고 싶어요"],
];
for(const [name,ov,free] of P){
  const a=randomPersona(rnd,8); Object.assign(a,ov); a.age=0; a.free=free; a.goal=0;
  M.setAns(a); const R=M.score(); const {f,t}=M.tally();
  const fa=M.freeAnswer(free); 
  console.log(`\n■ ${name}\n 1~3위: ${R.slice(0,3).map(p=>p.n+(p.sal?` ${p.sal[0]}~${p.sal[1]}만`:'')).join(' / ')}`);
  console.log(' 막막함 답:', JSON.stringify(fa).slice(0,260));
  console.log(' 현실 점검:', (M.reality(f,t,R)||[]).slice(0,3).map(x=>String(x).slice(0,90)).join(' | '));
  const sp=(M.supports(f,R)||[]).map(x=>x.n); console.log(' 지원:', sp.slice(0,6).join(', '), '| 기업:', (M.corpSupports(f,R)||[]).map(x=>x.n).slice(0,3).join(', '));
}
