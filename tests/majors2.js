const {M,randomPersona}=require('./logic.js');
// [학과, MAJORS 보기 번호, 그 학과 졸업생이 실제로 많이 가는 길 (워크넷·통계 기준으로 따로 정함)]
const MAJ=[["국어국문",0,["med","off","mkt","pln","edu","pub","tch"]],["영어·외국어",1,["trd","svc","edu","off","mkt","tch"]],["사학·철학",2,["pub","edu","off","tch","art"]],["심리학",3,["cns","kid","car","edu","off"]],["사회복지학",4,["car","kid","pbc","pub","cns"]],["행정·정치",5,["pub","pbc","off","lgl"]],["법학",6,["lgl","pub","off","pbc"]],["미디어·언론",7,["med","mkt","pln","dsn"]],["유아교육",8,["tch","kid"]],["교육·사범",9,["tch","edu","kid"]],["관광·항공서비스",10,["svc","pln"]],
["경영학",11,["off","sal","bop","pln","mkt","fin"]],["경제·금융",12,["fin","off","pub","pln"]],["회계·세무",13,["tax","off","fin"]],["무역·통상",14,["trd","bop","off","log","sal"]],
["컴퓨터",15,["it","eng"]],["전자·전기",16,["eng","tec","it","fac","rail"]],["기계·자동차",17,["eng","aut","tec","fac","avi","rail"]],["화공·신소재",18,["eng","fac"]],["건축·토목",19,["arc","bld","eng","pub"]],["산업공학",20,["eng","pln","off","fac"]],
["간호학",21,["nur","hcl"]],["보건계열",22,["mtc","hcl"]],["생명·화학",23,["eng","fac","it"]],["수학·통계",24,["it","fin","tch","edu","off"]],["식품영양",25,["diet","ckg"]],["농림·환경",26,["env","pub","fac"]],
["체육",27,["spo","tch","uni","ath"]],["디자인",28,["dsn","mkt"]],["음악·연극영화",29,["art","edu","mkt","own"]]];
let seed=20261021; const rnd=()=>(seed=(seed*16807)%2147483647,(seed-1)/2147483646);
const N=+process.argv[2]||10; let W=0,H=0,O=0,OF=0,C=0; const bad=[];
for(const [name,mopt,good] of MAJ){
  let want=0,hit=0,ex=[];
  for(let i=0;i<N;i++){
    const a=randomPersona(rnd,7); a.major=mopt; a.edu=5; a.age=[1,1,2,2,2,1,2,3,1,2][i%10];
    a.c2=i%10<6?0:(i%10<8?1:2); a.c3=i%10<6?0:[1,2,3,1][i%10-6]; a.goal=0;
    M.setAns(a); const R=M.score(); const t3=R.slice(0,3).map(p=>p.key);
    if(a.c2===0&&a.c3===0){ const ml=M.MAJLINK[M.MAJORS[mopt][2].mj]; const ok=R.some(p=>ml.includes(p.key)&&p.s>-9999&&!p.v.length);
      if(!ok){C++; continue;} want++; if(t3.some(k=>good.includes(k))) hit++; else ex.push(t3.join(","));}
    if(a.c3===1){O++; if(!good.includes(R[0].key)) OF++;}
  }
  W+=want;H+=hit; console.log(`${name} | ${hit}/${want} | ${ex.slice(0,2).join(" / ")}`);
  if(hit<want) bad.push(name);
}
console.log(`\n본인이 고른 '싫은 조건'에 전공 쪽 길이 모두 걸린 ${C}명은 제외 (억지로 넣지 않음)`);
console.log(`\n전공 살려 취업 원하는 ${W}명 중 ${H}명(${Math.round(100*H/W)}%) 맞는 길 3위 안`);
console.log(`다른 분야 원하는 ${O}명 중 ${OF}명(${Math.round(100*OF/O)}%)은 1순위가 전공 밖 길`);
if(H/W<0.9){console.log('FAIL'); process.exit(1);}
