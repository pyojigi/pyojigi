// 웹 빌드용: 캘린더 구독 파일(cal.ics)과 일정별 파일(ev/*.ics) 만들기
const fs=require('fs'), path=require('path');
const {M}=require(require('path').join(__dirname,'..','tests','logic.js'));
const html=fs.readFileSync(require('path').join(__dirname,'..','src','pyojigi.html'),'utf8'); const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const blk=js.slice(js.indexOf('// ICS-START'),js.indexOf('// ICS-END'));
const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const F=new Function('ymd',blk+'\nreturn {icsOf,evUid};')(ymd);
const out=process.argv[2]; const today=ymd(new Date(Date.now()-30*864e5));
const evs=M.CAL.filter(e=>e.e>=today);
fs.writeFileSync(path.join(out,'cal.ics'),F.icsOf(evs,'표지기 정부·기업 일정'));
const dir=path.join(out,'ev'); fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir);
for(const e of M.CAL) fs.writeFileSync(path.join(dir,F.evUid(e)+'.ics'),F.icsOf([e]));
const ids=M.CAL.map(F.evUid); if(new Set(ids).size!==ids.length) throw new Error('UID 중복');
console.log('ics',evs.length,'feed /',M.CAL.length,'files');
