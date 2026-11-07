/* Browser suite. Usage: npm i puppeteer; node tests/browser-suite.js   (starts its own static server)
   Runs the REAL index.html + js/main.js in Chromium. GSAP is replaced by tests/gsap-standin.js (see header there).
   Real GSAP/ScrollTrigger is NOT exercised by this suite. */
const http=require("http"),fs=require("fs"),path=require("path"),puppeteer=require("puppeteer");
const ROOT=process.env.ROOT||path.join(__dirname,".."),PORT=8780,STAND=fs.readFileSync(path.join(__dirname,"gsap-standin.js"),"utf8");
const MIME={".html":"text/html",".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml",".jpg":"image/jpeg",".txt":"text/plain"};
const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]));if(f.endsWith("/"))f+="index.html";
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});r.end(d)})});
const results=[];const rec=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?"PASSED ":"FAILED ")+name+(detail?"  -> "+detail:""))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
async function open({w=1440,h=900,rm=false,gsap="standin",blockPhotos=false}={}){
 const p=await browser.newPage();await p.setViewport({width:w,height:h});
 if(rm)await p.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
 const log={errors:[],failed:[],listeners:{},photoReq:new Set()};
 p.on("pageerror",e=>log.errors.push(e.message));
 p.on("console",m=>{if(m.type()==="error"&&!/Failed to load resource|ERR_/.test(m.text()))log.errors.push(m.text())});
 await p.setRequestInterception(true);
 p.on("request",q=>{const u=q.url();if(/assets\/photos\/.*\.png/.test(u)){log.photoReq.add(u.split("/").pop());if(blockPhotos)return q.abort()}
  if(/cdnjs.*gsap\.min\.js/.test(u))return gsap==="standin"?q.respond({status:200,contentType:"text/javascript",body:STAND}):q.abort();
  if(/cdnjs.*ScrollTrigger/.test(u))return gsap==="standin"?q.respond({status:200,contentType:"text/javascript",body:"/*stub*/"}):q.abort();
  if(/fonts\.(googleapis|gstatic)/.test(u))return q.abort();q.continue()});
 p.on("requestfailed",q=>{if(!/fonts\.|cdnjs/.test(q.url()))log.failed.push(q.url())});
 p.on("response",r=>{if(r.status()>=400)log.failed.push(r.status()+" "+r.url().replace("http://localhost:"+PORT,""))});
 await p.evaluateOnNewDocument(()=>{window.__ls={};const a=window.addEventListener;window.addEventListener=function(t,...r){window.__ls[t]=(window.__ls[t]||0)+1;return a.call(this,t,...r)}});
 await p.goto(`http://localhost:${PORT}/index.html`,{waitUntil:"load"});await sleep(450);
 return{p,log};
}
const MACH=`(()=>{const r=__standIn.regs.find(r=>r.cfg&&r.cfg.trigger==="#machStage");return r.tl})()`;
const snap=()=>[...document.querySelectorAll(".mp")].map(m=>{const g=(s)=>m.querySelector(s),cs=e=>getComputedStyle(e);
 return[cs(g(".mt")).opacity,cs(g(".mt")).visibility,g(".mt").style.transform,g(".rise>span").style.transform,g(".shot").style.clipPath,g(".shot .inner").style.transform].join("|")}).join("\n");

(async()=>{
 await new Promise(r=>srv.listen(PORT,r));
 browser=await puppeteer.launch({headless:"new",args:["--no-sandbox"],...(process.env.CHROME?{executablePath:process.env.CHROME}:{})});
 const Plan=require("../js/machinery-plan.js"),P=Plan.plan(3);

 /* ===== A. wiring: each scene drives only its own elements ===== */
 {const {p,log}=await open();
  const r=await p.evaluate(`(()=>{const tl=${MACH},mp=[...document.querySelectorAll(".mp")],T=${JSON.stringify(P.specs)},total=tl.duration();
   const outside=tl.kids.filter(tw=>tw.els.some(e=>!(e.closest&&e.closest(".mp")))).length;
   const S=sel=>[...document.querySelectorAll(".mp")].map(m=>[...m.querySelectorAll(sel)].map(e=>e.getAttribute("style")||"").join("|"));
   const changed=(sel,a,b)=>{__standIn.seek(tl,(a-.01)/total);const s0=S(sel);__standIn.seek(tl,Math.min(1,(b+.01)/total));return S(sel).map((x,i)=>x!==s0[i])};
   const sp=(el,k,fn)=>T.find(s=>s.el===el&&s.k===k&&(!fn||fn(s)));
   const exit=k=>sp("text",k,s=>s.to.autoAlpha===0),enter=k=>sp("text",k,s=>s.to.autoAlpha===1),wipe=k=>sp("shot",k);
   const TXT=".mt,.rise>span",PH=".shot,.shot .inner",o={outside};
   o.exit0=changed(TXT,exit(0).t,exit(0).t+exit(0).d);o.enter1=changed(TXT,enter(1).t,enter(1).t+enter(1).d);
   o.exit1=changed(TXT,exit(1).t,exit(1).t+exit(1).d);o.enter2=changed(TXT,enter(2).t,enter(2).t+enter(2).d);
   o.wipe1=changed(PH,wipe(1).t,wipe(1).t+wipe(1).d);o.wipe2=changed(PH,wipe(2).t,wipe(2).t+wipe(2).d);return o})()`);
  const J=JSON.stringify,okA=r.outside===0&&J(r.exit0)==="[true,false,false]"&&J(r.enter1)==="[false,true,false]"&&J(r.exit1)==="[false,true,false]"&&J(r.enter2)==="[false,false,true]"&&r.wipe1[1]&&!r.wipe1[2]&&r.wipe2[2]&&!r.wipe2[0];
  rec("Scene independence: text exits/enters and photo wipes touch only the owning scene (tractor/harvester/sprayer)",okA,J(r));
  rec("No 'scenes are not independent' console error / page errors (desktop, motion)",log.errors.length===0,log.errors.join(" | "));
  await p.close()}

 /* ===== B. sweeps: forward, reverse, fast jumps, repeated; exclusivity, determinism, counter ===== */
 {const {p,log}=await open();
  const out=await p.evaluate(`(()=>{const tl=${MACH},N=400,snapFn=${snap.toString()},vis=()=>[...document.querySelectorAll(".mt")].filter(e=>{const c=getComputedStyle(e);return c.visibility!=="hidden"&&+c.opacity>.02}).length;
   const rec={max:0,counterBad:[],noShot0:0};const marks=${JSON.stringify(P.marks)},tot=tl.duration();
   const check=(pr)=>{__standIn.seek(tl,pr);rec.max=Math.max(rec.max,vis());const t=pr*tot;let i=0;marks.forEach(m=>{if(t>=m)i++});
    const want=String(i+1).padStart(2,"0");if(document.querySelector("#cNum").textContent!==want)rec.counterBad.push([pr.toFixed(3),want,document.querySelector("#cNum").textContent]);
    if(document.querySelectorAll(".shot")[0].style.clipPath.replace(/\\s/g,"")!=="inset(0px0px0px0%)"&&!/inset\\(0(px)? 0(px)? 0(px)? 0(%|px)?\\)/.test(document.querySelectorAll(".shot")[0].style.clipPath))rec.noShot0++};
   const checkpoints=[0,.1,.2,.33,.5,.62,.7,.8,.9,1];const fwd={},rev={},rnd={};
   for(let i=0;i<=N;i++)check(i/N);checkpoints.forEach(c=>{__standIn.seek(tl,c);fwd[c]=snapFn()});
   for(let i=N;i>=0;i--)check(i/N);checkpoints.forEach(c=>{__standIn.seek(tl,c);rev[c]=snapFn()});
   const order=checkpoints.slice().sort(()=>Math.random()-.5);for(let k=0;k<3;k++)order.forEach(c=>{__standIn.seek(tl,Math.random());__standIn.seek(tl,c);rnd[c]=snapFn()});
   for(let rep=0;rep<5;rep++){for(let i=0;i<=40;i++)check(i/40);for(let i=40;i>=0;i--)check(i/40)}
   __standIn.seek(tl,0);const start=snapFn();__standIn.seek(tl,1);const end=snapFn();
   const same=checkpoints.every(c=>fwd[c]===rev[c]&&fwd[c]===rnd[c]);
   return{max:rec.max,counterBad:rec.counterBad.slice(0,3),counterBadN:rec.counterBad.length,same,start,end}})()`);
  rec("Only one machinery text block visible at any progress (forward+reverse, 800 steps)",out.max<=1,"max visible="+out.max);
  rec("Reverse scrolling and random fast jumps give identical states to forward scrolling (10 checkpoints)",out.same);
  rec("01/03 counter matches the plan at every step",out.counterBadN===0,JSON.stringify(out.counterBad));
  rec("Repeated visits (5 round trips) leave no stuck/invisible state",out.max<=1&&out.same);
  const L=out.start.split("\n"),E=out.end.split("\n");
  rec("Start state: tractor visible, others hidden; End state: sprayer visible, others hidden",L[0].startsWith("1|visible")&&L[1].split("|")[1]==="hidden"&&L[2].split("|")[1]==="hidden"&&E[2].startsWith("1|visible")&&E[0].split("|")[1]==="hidden"&&E[1].split("|")[1]==="hidden",L.map(x=>x.slice(0,12)).join(" / ")+"  ->  "+E.map(x=>x.slice(0,12)).join(" / "));
  await p.close()}

 /* ===== C. geometry during the sequence, per viewport (no overlap, no clipping, no off-screen) ===== */
 for(const [w,h] of [[1440,900],[1366,768],[768,1024],[390,844],[360,640]]){
  const {p,log}=await open({w,h});
  const r=await p.evaluate(`(()=>{const tl=${MACH},stage=document.querySelector("#machStage");stage.scrollIntoView();const o={ov:0,clip:0,off:0,n:0};
   const side=getComputedStyle(stage).gridTemplateAreas.replace(/"/g,"").trim().startsWith("text photo");
   for(let i=0;i<=200;i++){__standIn.seek(tl,i/200);o.n++;document.querySelectorAll(".mp").forEach(m=>{const mt=m.querySelector(".mt");const c=getComputedStyle(mt);if(c.visibility==="hidden"||+c.opacity<.98)return;
    const sh=m.querySelector(".shot").getBoundingClientRect();["h3 .rise","p",".note"].forEach(s=>{const e=m.querySelector(s),b=e.getBoundingClientRect();if(side?b.right>sh.left+1:b.top<sh.bottom-1)o.ov++;if(b.bottom>innerHeight+1||b.right>innerWidth+1||b.left<-1)o.off++});
    const rs=m.querySelector("h3 .rise");if(rs.scrollWidth>rs.clientWidth+2)o.clip++})}
   return o})()`);
  rec(`Machinery geometry ${w}x${h}: no text/photo overlap, no clipped titles, nothing off-screen`,r.ov===0&&r.clip===0&&r.off===0,JSON.stringify(r));
  await p.close()}

 /* ===== D. resize / orientation / breakpoint re-run: no duplicate triggers or listeners ===== */
 {const {p,log}=await open();
  const a=await p.evaluate(`(()=>({machTl:__standIn.regs.filter(r=>r.cfg&&r.cfg.trigger==="#machStage").length,motion:document.documentElement.classList.contains("motion"),ls:{...window.__ls}}))()`);
  await p.setViewport({width:390,height:844});await p.evaluate("__standIn.rerun()");await sleep(100);
  await p.setViewport({width:1440,height:900});await p.evaluate("__standIn.rerun()");await sleep(100);await p.setViewport({width:768,height:1024});await p.evaluate("__standIn.rerun()");
  const b=await p.evaluate(`(()=>({machTl:__standIn.regs.filter(r=>r.cfg&&r.cfg.trigger==="#machStage").length,motion:document.documentElement.classList.contains("motion"),ls:{...window.__ls},introFlag:!!window.__frIntroDone,counter:document.querySelector("#cNum").textContent,t0:getComputedStyle(document.querySelector(".mp .mt")).opacity}))()`);
  rec("Breakpoint changes (desktop>mobile>desktop>tablet): one machinery trigger, motion class restored",b.machTl===1&&b.motion&&a.machTl===1,JSON.stringify({before:a.machTl,after:b.machTl}));
  rec("No listener duplication across breakpoint changes (load/orientationchange registered once)",(b.ls.load||0)===(a.ls.load||0)&&(b.ls.orientationchange||0)===1&&(b.ls.orientationchange||0)===(a.ls.orientationchange||0),JSON.stringify({load:[a.ls.load,b.ls.load],orient:[a.ls.orientationchange,b.ls.orientationchange]}));
  rec("State resets cleanly after re-run (counter 01, tractor text visible)",b.counter==="01"&&+b.t0>.98,JSON.stringify({counter:b.counter,t0:b.t0}));
  const before=await p.evaluate("__standIn.refreshCount()");await p.evaluate("window.dispatchEvent(new Event('orientationchange'))");await sleep(500);const after=await p.evaluate("__standIn.refreshCount()");
  rec("ScrollTrigger.refresh() runs after an orientation change",after>before,before+" -> "+after);
  rec("No page errors during resize/rerun",log.errors.length===0,log.errors.join(" | "));
  await p.close()}

 /* ===== E. reduced motion + no-GSAP static layout ===== */
 for(const [label,opt] of [["reduced-motion (GSAP present)",{rm:true}],["GSAP failed to load",{gsap:"none"}]]){
  const {p,log}=await open(opt);
  const r=await p.evaluate(`(()=>{const hidden=[...document.querySelectorAll(".mt,.p-line,.cap,.jr-body li,.hero-text,.hero h1 .ln>span,.lede,.hero-cta,.cta-copy>*")].filter(e=>{const c=getComputedStyle(e);return c.visibility==="hidden"||+c.opacity<.9||c.display==="none"}).map(e=>e.className||e.tagName);
   const nodes=[...document.querySelectorAll(".nd")].map(n=>n.getAttribute("cx")),dup=[...document.querySelectorAll("[id]")].map(e=>e.id).filter((x,i,a)=>a.indexOf(x)!==i);
   return{motion:document.documentElement.classList.contains("motion"),hidden:hidden.slice(0,5),nodesPlaced:nodes.every(x=>x&&x!=="0"),dup,overflowX:document.documentElement.scrollWidth>innerWidth,rider:getComputedStyle(document.querySelector("#rider")).display}})()`);
  rec(`Static layout (${label}): no .motion class, all copy visible, road nodes placed, rider hidden, no duplicate ids, no overflow`,!r.motion&&r.hidden.length===0&&r.nodesPlaced&&r.rider==="none"&&r.dup.length===0&&!r.overflowX,JSON.stringify(r));
  rec(`Static layout (${label}): no JS errors`,log.errors.length===0,log.errors.join(" | "));
  await p.close()}

 /* ===== F. menu + keyboard + links (motion mode, and reduced-motion mode) ===== */
 for(const [label,opt] of [["motion",{}],["reduced-motion",{rm:true}]]){
  const {p,log}=await open(opt);const R={};
  await p.click("#menuBtn");await sleep(300);
  R.open=await p.evaluate(`(()=>({exp:document.querySelector("#menuBtn").getAttribute("aria-expanded"),vis:getComputedStyle(document.querySelector("#menu")).visibility,focus:document.activeElement.textContent.trim(),inert:document.querySelector("#top").inert,lock:getComputedStyle(document.body).overflow}))()`);
  const inside=async()=>p.evaluate(`(()=>{const a=document.activeElement;return a.id==="menuBtn"||!!a.closest("#menu")})()`);
  let trap=true;for(let i=0;i<10;i++){await p.keyboard.press("Tab");if(!await inside())trap=false}
  for(let i=0;i<10;i++){await p.keyboard.down("Shift");await p.keyboard.press("Tab");await p.keyboard.up("Shift");if(!await inside())trap=false}
  await p.keyboard.press("Escape");await sleep(900);
  R.closed=await p.evaluate(`(()=>({exp:document.querySelector("#menuBtn").getAttribute("aria-expanded"),vis:getComputedStyle(document.querySelector("#menu")).visibility,focus:document.activeElement.id,inert:document.querySelector("#top").inert,lock:getComputedStyle(document.body).overflow}))()`);
  await p.click("#menuBtn");await sleep(300);await p.evaluate(`document.querySelector('#menu a[href="#journeys"]').click()`);await sleep(900);
  R.link=await p.evaluate(`(()=>({hash:location.hash,exp:document.querySelector("#menuBtn").getAttribute("aria-expanded"),vis:getComputedStyle(document.querySelector("#menu")).visibility,inert:document.querySelector("#top").inert}))()`);
  rec(`Menu (${label}): opens, aria-expanded, first link focused, page inert, scroll locked`,R.open.exp==="true"&&R.open.vis==="visible"&&R.open.focus==="Home"&&R.open.inert===true&&R.open.lock==="hidden",JSON.stringify(R.open));
  rec(`Menu (${label}): Tab and Shift+Tab stay trapped inside the menu (20 presses)`,trap);
  rec(`Menu (${label}): Escape closes, returns focus to Menu button, unlocks page`,R.closed.exp==="false"&&R.closed.vis==="hidden"&&R.closed.focus==="menuBtn"&&R.closed.inert===false&&R.closed.lock!=="hidden",JSON.stringify(R.closed));
  rec(`Menu (${label}): clicking a link closes the menu and navigates (#journeys)`,R.link.hash==="#journeys"&&R.link.exp==="false"&&R.link.vis==="hidden"&&R.link.inert===false,JSON.stringify(R.link));
  rec(`Menu (${label}): no JS errors`,log.errors.length===0,log.errors.join(" | "));
  await p.close()}
 {const {p}=await open();const r=await p.evaluate(`(()=>{const miss=[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute("href")).filter(h=>h.length>1&&!document.querySelector(h)&&!document.querySelector("symbol"+h));return{miss:[...new Set(miss)],ctas:[...document.querySelectorAll("a[data-app]")].map(a=>a.getAttribute("href"))}})()`);
  rec("All in-page links (nav, menu, CTAs, skip link) resolve to an existing element",r.miss.length===0,JSON.stringify(r));await p.close()}


 const scrollAll=async p=>{const H=await p.evaluate("document.documentElement.scrollHeight");for(let y=0;y<=H;y+=Math.round(await p.evaluate("innerHeight")*.6)){await p.evaluate(`window.scrollTo(0,${y})`);await sleep(120)}await sleep(900);await p.evaluate("window.scrollTo(0,0)")};
 /* ===== G. photographs: lazy loading, real photos present, and graceful fallback when blocked ===== */
 {const {p,log}=await open({w:1440,h:900,gsap:"none"});
  await sleep(500);const atLoad=[...log.photoReq];
  rec("Lazy loading: hero loads at once; farmer, owner and closing photographs wait until their sections are near",atLoad.includes("hero-aerial.png")&&!atLoad.some(n=>/farmer|equipment-owner|closing/.test(n)),JSON.stringify(atLoad));
  await scrollAll(p);
  const r=await p.evaluate(`(()=>({slots:document.querySelectorAll("[data-photo]").length,loaded:document.querySelectorAll(".has-media").length,imgs:document.images.length,broken:[...document.images].filter(i=>!i.naturalWidth).length,alts:[...document.images].every(i=>i.alt&&i.alt.length>20),dbl:[...document.querySelectorAll("[data-photo]")].filter(f=>/\.png\.png/.test(f.dataset.photo)||/\.jpg/.test(f.dataset.photo)).length}))()`);
  rec("Real photographs: all 7 load (exact .png names), 0 broken images, every image has meaningful alt text, no .jpg / .png.png references",r.slots===7&&r.loaded===7&&r.broken===0&&r.alts&&r.dbl===0,JSON.stringify(r));
  rec("Network with photos present: every photograph returns 200, nothing else fails",log.failed.length===0,JSON.stringify(log.failed));
  rec("Console with photos present: no errors",log.errors.length===0,log.errors.join(" | "));
  await p.close()}
 for(const [w,h] of [[1440,900],[390,844]]){
  const {p,log}=await open({w,h,gsap:"standin",blockPhotos:true});await scrollAll(p);
  const r=await p.evaluate(`(()=>({withMedia:document.querySelectorAll(".has-media").length,broken:[...document.images].filter(i=>!i.naturalWidth).length,ph:document.querySelectorAll(".ph").length,visiblePh:[...document.querySelectorAll(".ph")].filter(e=>+getComputedStyle(e).opacity>.9).length,illus:[...document.querySelectorAll(".jr-art>svg")].filter(e=>+getComputedStyle(e).opacity>.9).length,overflowX:document.documentElement.scrollWidth>innerWidth,title:!!document.querySelector("#heroTitle").offsetHeight}))()`);
  rec(`Photographs blocked/missing (${w}x${h}): 0 broken images, 5 dark placeholders + 2 illustration fallbacks showing, headline intact, no overflow`,r.withMedia===0&&r.broken===0&&r.visiblePh===5&&r.illus===2&&!r.overflowX&&r.title,JSON.stringify(r));
  rec(`Photographs blocked/missing (${w}x${h}): all 7 requested exactly once and failure is silent`,log.photoReq.size===7&&log.errors.length===0,log.photoReq.size+" requested; errors="+log.errors.join("|"));
  await p.close()}
 /* ===== H. static layout audit across sizes (overflow, clipping, off-screen text) ===== */
 for(const [w,h] of [[1440,900],[1366,768],[768,1024],[390,844],[360,640]]){
  for(const mode of ["standin","none"]){
   const {p}=await open({w,h,gsap:mode});
   const r=await p.evaluate(`(()=>{const o={overflowX:document.documentElement.scrollWidth>innerWidth,clipped:[],off:[]};
    document.querySelectorAll("h1,h2,h3,.p-line,.pl,.cap p,.jr-body li,.hero-copy p,.menu a,.btn,.pill").forEach(e=>{const b=e.getBoundingClientRect();if(!b.width)return;if(b.right>innerWidth+2&&!e.closest(".menu,.strip-wrap"))o.off.push((e.className||e.tagName)+":"+Math.round(b.right));
     let a=e;while(a&&a!==document.body){const c=getComputedStyle(a);if(c.overflow==="hidden"&&a!==e&&a.scrollWidth>a.clientWidth+3&&!a.matches(".strip-wrap,.hero,.scene,.jr-wrap,.proc,.cta,.shot,.frame,.mach-stage,body,.bridge"))o.clipped.push(a.className||a.tagName);a=a.parentElement}});
    o.clipped=[...new Set(o.clipped)];return o})()`);
   rec(`Layout ${w}x${h} (${mode==="standin"?"motion mode":"static"}): no horizontal overflow, no off-screen or clipped text`,!r.overflowX&&r.off.length===0&&r.clipped.length===0,JSON.stringify(r));
   await p.close()}}

 /* ===== I. nav colour follows the section under it (static and motion layouts) ===== */
 for(const mode of ["none","standin"]){
  const {p}=await open({gsap:mode});
  const r=await p.evaluate(`(async()=>{const nav=document.querySelector("#nav"),bad=[];const w=ms=>new Promise(r=>setTimeout(r,ms));
   for(const el of document.querySelectorAll("[data-nav]")){el.scrollIntoView({block:"start"});await w(250);const light=nav.classList.contains("light");if(light!==(el.dataset.nav==="light"))bad.push((el.id||el.className)+" wants "+el.dataset.nav+" got "+(light?"light":"dark"))}
   window.scrollTo(0,0);await w(250);return{bad,n:document.querySelectorAll("[data-nav]").length,top:nav.classList.contains("light")}})()`);
  rec(`Nav colour (${mode==="none"?"static":"motion"}): readable over all ${r.n} marked sections (ivory on dark, forest on light), dark at the top`,r.bad.length===0&&!r.top&&r.n===8,JSON.stringify(r));await p.close()}

 /* ===== J. hero + closing composition at five viewports ===== */
 for(const [w,h] of [[1440,900],[1366,768],[768,1024],[390,844],[360,640]]){
  const {p,log}=await open({w,h,gsap:"standin"});await sleep(1500);
  const r=await p.evaluate(`(()=>{const q=s=>document.querySelector(s),rc=s=>q(s).getBoundingClientRect(),o={};
   const t=rc("#heroText"),nav=rc("#nav"),h1=q("#heroTitle");
   o.heroBelowNav=t.top>=nav.bottom-4;o.heroInside=t.left>=0&&t.right<=innerWidth+1&&t.bottom<=innerHeight;
   o.h1Clipped=[...h1.querySelectorAll(".ln")].some(l=>l.scrollWidth>l.clientWidth+2);
   o.heroLines=[...h1.querySelectorAll(".ln")].map(l=>Math.round(l.getBoundingClientRect().height/parseFloat(getComputedStyle(h1).fontSize)*100)/100);
   const cue=q("#cue"),cd=getComputedStyle(cue).display!=="none"?rc("#cue"):null;o.cueClear=!cd||cd.left>=t.right||cd.top>=t.bottom;
   const hs=getComputedStyle(q("#hero"));o.heroH=Math.round(rc("#hero").height);o.vh=innerHeight;
   const ct=rc(".cta .btns"),ft=rc(".foot");o.ctaClear=ct.bottom<=ft.top+2;o.ctaInside=ct.right<=innerWidth+1&&ct.top>=0;
   o.ctaClipped=q("#cTitle").scrollWidth>q("#cTitle").clientWidth+2;o.btnH=Math.min(...[...document.querySelectorAll(".hero-cta .pill,.cta .pill")].map(b=>b.getBoundingClientRect().height));
   o.overflowX=document.documentElement.scrollWidth>innerWidth;return o})()`);
  const ok=r.heroBelowNav&&r.heroInside&&!r.h1Clipped&&r.cueClear&&r.ctaClear&&r.ctaInside&&!r.ctaClipped&&r.btnH>=44&&!r.overflowX&&Math.abs(r.heroH-h)<=2;
  rec(`Hero + closing ${w}x${h}: full-height hero, text clear of nav/cue/footer, no clipping, buttons >=44px, no overflow`,ok,JSON.stringify(r));await p.close()}

 /* ===== K. crops: is each photograph's subject fully inside its window? (computed from real geometry and the real images) ===== */
 const SUBJ={"hero-aerial":{sun:[.69,.15,.78,.32]},"tractor-closeup":{tractor:[.19,.05,.91,.92]},harvester:{combine:[.19,.08,.995,.72]},sprayer:{sprayer:[.04,.22,.97,.70]},farmer:{farmer:[.11,.02,.58,.99]},"equipment-owner":{owner:[.12,.02,.48,.99]},"closing-landscape":{sun:[.72,.33,.80,.49]}};
 for(const [w,h] of [[1440,900],[1366,768],[768,1024],[390,844],[360,640]]){
  const {p}=await open({w,h,gsap:"standin"});await scrollAll(p);await sleep(600);
  const r=await p.evaluate(`((SUBJ)=>{const out=[];document.querySelectorAll("[data-photo]").forEach(f=>{const img=f.querySelector("img");if(!img)return out.push({n:f.dataset.photo,err:"no img"});
    const name=f.dataset.photo.split("/").pop().replace(".png",""),W=img.clientWidth,H=img.clientHeight,iw=img.naturalWidth,ih=img.naturalHeight,s=Math.max(W/iw,H/ih),dw=iw*s,dh=ih*s;
    const pos=getComputedStyle(img).objectPosition.split(" ").map(v=>parseFloat(v)/100),ox=(W-dw)*pos[0],oy=(H-dh)*pos[1];
    const fw=f.clientWidth,fh=f.clientHeight,top=(H-fh)/2,worst={};
    [-1,0,1].forEach(k=>{const sh=(f.classList.contains("shot")?.022*H:0)*k;const x1=Math.max(0,0),x2=Math.min(W,fw),y1=Math.max(0,top+sh),y2=Math.min(H,top+fh+sh);
     Object.entries(SUBJ[name]).forEach(([lab,[a,b,c,d]])=>{const bx1=ox+a*dw,bx2=ox+c*dw,by1=oy+b*dh,by2=oy+d*dh;const ix=Math.max(0,Math.min(bx2,x2)-Math.max(bx1,x1)),iy=Math.max(0,Math.min(by2,y2)-Math.max(by1,y1));
      const fr=ix*iy/((bx2-bx1)*(by2-by1));worst[lab]=Math.min(worst[lab]===undefined?1:worst[lab],fr)})});
    out.push({n:name,ratio:+(fw/fh).toFixed(2),vis:worst})});return out})(${JSON.stringify(SUBJ)})`);
  const mobileOnlyOK=n=>w>900||true;
  // hero/closing subjects are single points of interest (sun): required on <=900px; people and machinery: required everywhere.
  const bad=r.filter(x=>x.err||Object.entries(x.vis).some(([l,v])=>{const need=/hero|closing/.test(x.n)?(w<=900?.98:0):.98;return v<need}));
  rec(`Crops ${w}x${h}: every machine and person fully visible (>=98%), sun visible on phone/tablet`,bad.length===0&&r.length===7,JSON.stringify(bad.length?bad:r.map(x=>x.n+":"+Object.values(x.vis).map(v=>Math.round(v*100)).join("/")+"%@"+x.ratio)));await p.close()}
 console.log("\nSUMMARY: "+results.filter(r=>r.ok).length+" passed, "+results.filter(r=>!r.ok).length+" failed");
 fs.writeFileSync(path.join(__dirname,"last-run.json"),JSON.stringify(results,null,1));
 await browser.close();srv.close();process.exit(results.some(r=>!r.ok)?1:0);
})().catch(e=>{console.error("SUITE CRASH",e);process.exit(2)});
