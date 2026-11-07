(function(){
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)]; /* r = optional context element */

/* media slots: each [data-photo] shows its dark placeholder until the file loads; a missing or failed file fails silently.
   The hero (data-priority) loads at once; everything else loads when its section is within 1.5 screens (lazy). */
const loadSlot=f=>{if(f.__l)return;f.__l=1;const i=new Image();i.decoding="async";if(f.hasAttribute("data-priority"))i.fetchPriority="high";
 i.onload=()=>{i.alt=f.dataset.alt||"";(f.querySelector(".inner")||f).appendChild(i);requestAnimationFrame(()=>i.classList.add("on"));f.classList.add("has-media")};
 i.onerror=()=>{};i.src=f.dataset.photo};
{const slots=$$("[data-photo]");
 if("IntersectionObserver" in window){const io=new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting){e.target.__slots.forEach(loadSlot);o.unobserve(e.target)}}),{rootMargin:"60% 0px"});
  slots.forEach(f=>{if(f.hasAttribute("data-priority"))return loadSlot(f);const t=f.closest("section")||f;(t.__slots=t.__slots||[]).push(f);io.observe(t)})}
 else slots.forEach(loadSlot)}

/* nav colour follows whichever [data-nav] section is under the bar (works with pins, static layout and reduced motion) */
let heroFaded=false;
const navEl=$("#nav"),themed=$$("[data-nav]"),live=new Set();
const applyNav=()=>{const on=themed.filter(e=>live.has(e)),cur=on.length?on[on.length-1]:null;
 const light=cur?(cur.dataset.nav==="light"||(cur.id==="hero"&&heroFaded)):false;navEl.classList.toggle("light",light)};
if("IntersectionObserver" in window){const nio=new IntersectionObserver(es=>{es.forEach(e=>e.isIntersecting?live.add(e.target):live.delete(e.target));applyNav()},{rootMargin:"0px 0px -92% 0px"});themed.forEach(e=>nio.observe(e))}

/* full-screen menu: focus trap, Esc, inert page */
const btn=$("#menuBtn"),menu=$("#menu"),main=$("#top"),links=$$("#menu a");
let open=false;
function setMenu(v){
 open=v;btn.setAttribute("aria-expanded",v);btn.textContent=v?"Close":"Menu";
 document.body.classList.toggle("menu-open",v);main.inert=v;
 const g=window.gsap&&!matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(v){menu.style.visibility="visible";
  if(g){gsap.to(menu,{clipPath:"circle(150% at calc(100% - 70px) 40px)",duration:.8,ease:"power3.inOut"});gsap.fromTo(links,{yPercent:60,opacity:0},{yPercent:0,opacity:1,stagger:.06,duration:.7,delay:.3,ease:"power3.out"})}
  else menu.style.clipPath="none";
  links[0].focus()}
 else{
  if(g)gsap.to(menu,{clipPath:"circle(0 at calc(100% - 70px) 40px)",duration:.6,ease:"power3.inOut",onComplete:()=>menu.style.visibility="hidden"});
  else{menu.style.clipPath="circle(0 at 100% 0)";menu.style.visibility="hidden"}
  btn.focus()}
}
btn.onclick=()=>setMenu(!open);
links.forEach(a=>a.addEventListener("click",()=>{setMenu(false)}));
document.addEventListener("keydown",e=>{
 if(!open)return;
 if(e.key==="Escape")setMenu(false);
 if(e.key==="Tab"){const f=[btn,...links],i=f.indexOf(document.activeElement);
  if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}
  else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}}
});

/* road nodes: positioned with plain SVG so the static layout is right without GSAP */
const roadFg=$("#roadFg"),STOPS=[.04,.5,.97];
if(roadFg&&roadFg.getTotalLength){const L=roadFg.getTotalLength();$$(".nd").forEach((n,i)=>{const p=roadFg.getPointAtLength(L*STOPS[i]);n.setAttribute("cx",p.x);n.setAttribute("cy",p.y)})}

/* call-to-action links: point them at the real app by filling these in (empty = jump to the explaining section) */
const FARMRENT_LINKS={browse:"",list:"",login:""};
$$("a[data-app]").forEach(a=>{const u=FARMRENT_LINKS[a.dataset.app];if(u)a.href=u});
document.addEventListener("click",e=>{
 const a=e.target.closest("a[data-app]");
 if(!a||!window.parent||window.parent===window)return;
 const action=a.dataset.app;
 if(!["browse","list","login"].includes(action))return;
 e.preventDefault();
 window.parent.postMessage({type:"farmrent:navigate",action},window.location.origin);
});
window.addEventListener("message",e=>{
 if(e.origin!==window.location.origin||e.data?.type!=="farmrent:navigate"||e.data?.action!=="home")return;
 window.scrollTo({top:0,behavior:"smooth"});
});

/* refresh once, not once per breakpoint change */
let rt;const safeRefresh=()=>{if(window.ScrollTrigger)ScrollTrigger.refresh()};
addEventListener("orientationchange",()=>{clearTimeout(rt);rt=setTimeout(safeRefresh,350)});
addEventListener("load",safeRefresh);
document.fonts&&document.fonts.ready.then(safeRefresh);

if(!window.gsap||!window.ScrollTrigger){return}
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ignoreMobileResize:true}); /* mobile address bar must not re-flow the pins */
const mm=gsap.matchMedia();

mm.add({rm:"(prefers-reduced-motion: no-preference)",mobile:"(max-width:900px)"},ctx=>{
 if(!ctx.conditions.rm)return;
 const M=ctx.conditions.mobile,root=document.documentElement;
 root.classList.add("motion");

 /* --- HERO: aerial photograph. Entrance plays once; the scroll timeline only animates props the intro never touches --- */
 if(!window.__frIntroDone){window.__frIntroDone=true;
  gsap.set($$("#heroText .ln>span"),{yPercent:110});
  gsap.timeline({defaults:{ease:"power3.out"}})
   .from("#heroMedia .inner",{scale:1.12,duration:2.4,ease:"power2.out"},0)
   .to($$("#heroText .ln>span"),{yPercent:0,duration:1.1,stagger:.14},.25)
   .from([".lede",".hero-cta"],{opacity:0,y:22,duration:.9,stagger:.12},.85);}
 const X={immediateRender:false};
 gsap.timeline({defaults:{ease:"none"},scrollTrigger:{trigger:"#hero",start:"top top",end:"+="+(M?70:90)+"%",pin:true,scrub:M?.6:1,invalidateOnRefresh:true,anticipatePin:1,
   onUpdate:s=>{const f=s.progress>.82;if(f!==heroFaded){heroFaded=f;applyNav()}},onLeave:()=>{heroFaded=false;applyNav()}}})
  .fromTo("#heroMedia",{scale:1,yPercent:0},{scale:1.18,yPercent:5,duration:1,...X},0)
  .fromTo("#heroDim",{opacity:0},{opacity:.5,duration:.7,...X},0)
  .fromTo("#heroText",{yPercent:0,opacity:1},{yPercent:-16,opacity:0,duration:.55,...X},.05)
  .fromTo("#cue",{opacity:1},{opacity:0,duration:.15,...X},0)
  .fromTo("#heroFade",{opacity:0},{opacity:1,duration:.3,...X},.7);

 /* --- MACHINERY: pinned showcase driven by js/machinery-plan.js ---
    Photos wipe in on their own grid column; text sits in a different column and
    leaves BEFORE the next photo wipes and arrives AFTER it has finished. */
 const mp=$$(".mp"),n=mp.length,P=MachPlan.plan(n),names=mp.map(p=>$(".rise>span",p).textContent);
 const G={shot:mp.map(p=>$(".shot",p)),text:mp.map(p=>$(".mt",p)),name:mp.map(p=>$(".rise>span",p))};
 G.inner=mp.map(p=>$(".shot .inner",p));G.innerY=G.innerX=G.innerS=G.inner;
 /* guard: every scene must own distinct, in-scene elements (this is what the old context-less $() broke) */
 if(["shot","text","name","inner"].some(k=>new Set(G[k]).size!==n)||mp.some((p,i)=>!p.contains(G.shot[i])||!p.contains(G.text[i])||!p.contains(G.name[i])||!p.contains(G.inner[i])))console.error("FarmRent: machinery scenes are not independent");
 const fx=o=>{o=Object.assign({},o);if("clipL" in o){o.clipPath="inset(0 0 0 "+o.clipL+"%)";delete o.clipL}return o};
 const groups={};P.specs.forEach(s=>(groups[s.el+":"+s.k]=groups[s.el+":"+s.k]||[]).push(s));
 Object.values(groups).forEach(l=>{l.sort((a,b)=>a.t-b.t);gsap.set(G[l[0].el][l[0].k],fx(l[0].from))}); /* exact start state, so scrubbing back is exact */
 const setCount=i=>{$("#cNum").textContent=String(i+1).padStart(2,"0");$("#cName").textContent=names[i]};
 const mt=gsap.timeline({defaults:{ease:"none"},scrollTrigger:{trigger:"#machStage",start:"top top",end:"+="+Math.round(P.total*(M?36:44))+"%",pin:true,scrub:M?.6:1,anticipatePin:1,invalidateOnRefresh:true,
  onUpdate:s=>{const t=s.progress*mt.duration();let i=0;P.marks.forEach(m=>{if(t>=m)i++});setCount(i)}}});
 P.specs.forEach(s=>mt.fromTo(G[s.el][s.k],fx(s.from),Object.assign(fx(s.to),{duration:s.d,ease:s.ease,immediateRender:false}),s.t));
 if(mt.duration()<P.total)mt.to({},{duration:P.total-mt.duration()});
 setCount(0);
 /* strip lives after the pin spacer and has its own padding (see .strip-wrap) */
 gsap.to("#strip",{xPercent:-35,ease:"none",scrollTrigger:{trigger:"#strip",start:"top bottom",end:"bottom top",scrub:true}});

 /* --- DARK CHAPTER: hills rise, nav flips, statements enter and leave --- */
 gsap.fromTo("#hillup",{yPercent:100},{yPercent:0,ease:"none",scrollTrigger:{trigger:"#why",start:"top bottom",end:"top 40%",scrub:true}});
 const pl=$$(".p-line"),pt=gsap.timeline({defaults:{ease:"none"},scrollTrigger:{trigger:"#why",start:"top top",end:"bottom bottom",scrub:.8}});
 pl.forEach((l,i)=>{
  pt.fromTo(l,{opacity:0,y:60,yPercent:-50},{opacity:1,y:0,yPercent:-50,duration:.5,ease:"power2.out",immediateRender:i===0},i*1.4);
  if(i<pl.length-1)pt.fromTo(l,{opacity:1,y:0,yPercent:-50},{opacity:0,y:-60,yPercent:-50,duration:.5,ease:"power2.in",immediateRender:false},i*1.4+.95);
 });
 pt.fromTo(".stars",{yPercent:0},{yPercent:-15,duration:4.2,immediateRender:false},0);

 /* --- JOURNEYS: angled clip reveals + counter-parallax --- */
 [["#jrA1","polygon(0 0,0 0,0 100%,0 100%)","polygon(0 0,100% 0,86% 100%,0 100%)"],["#jrA2","polygon(100% 0,100% 0,100% 100%,100% 100%)","polygon(14% 0,100% 0,100% 100%,0 100%)"]].forEach(([s,a,b])=>{
  gsap.fromTo(s,{clipPath:a},{clipPath:b,ease:"none",scrollTrigger:{trigger:s,start:"top 90%",end:"top 35%",scrub:.6}});
  gsap.fromTo(s+" svg,"+s+" .inner",{scale:1.25},{scale:1,ease:"none",scrollTrigger:{trigger:s,start:"top 90%",end:"bottom 30%",scrub:true}});
 });
 $$(".jr-body li").forEach(li=>gsap.from(li,{x:-30,opacity:0,ease:"power2.out",scrollTrigger:{trigger:li,start:"top 88%",end:"top 68%",scrub:.5}}));

 /* --- PROCESS: road draws, tractor rides, steps light up --- */
 const bg=$("#roadFg"),len=bg.getTotalLength(),stops=STOPS,caps=$$(".cap");
 gsap.set(bg,{strokeDasharray:len,strokeDashoffset:len});
 const rd={p:0},place=()=>{const p=bg.getPointAtLength(len*rd.p);gsap.set("#rider",{x:p.x,y:p.y});bg.style.strokeDashoffset=len*(1-rd.p);
  caps.forEach((c,i)=>c.classList.toggle("on",rd.p>=stops[i]-.02))};
 place();
 gsap.to(rd,{p:1,ease:"none",onUpdate:place,scrollTrigger:{trigger:"#process",start:"top top",end:"+="+(M?100:140)+"%",pin:true,scrub:.8,anticipatePin:1,invalidateOnRefresh:true}});

 /* --- CTA: landscape layers rise --- */
 gsap.from(".cta-copy>*",{y:40,opacity:0,stagger:.12,ease:"power2.out",scrollTrigger:{trigger:".cta-copy",start:"top 80%",end:"top 40%",scrub:.5}});

 gsap.fromTo("#closeFrame .inner",{scale:1.25},{scale:1,ease:"none",scrollTrigger:{trigger:"#join",start:"top bottom",end:"top top",scrub:true}});
 return()=>{root.classList.remove("motion")};
});
})();
