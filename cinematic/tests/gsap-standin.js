/* TEST-ONLY stand-in for the GSAP/ScrollTrigger API surface that js/main.js uses.
   It is NOT GSAP. It exists so the real, unmodified main.js can execute in a browser where GSAP cannot be downloaded.
   Timelines are seeked by progress (like a scrub); easing is ignored (linear); pins are not simulated. */
(function(){
 var S=new WeakMap(),touched=new Map(),regs=[],looseTls=[],mmItems=[],refreshCount=0,NUM=/-?\d*\.?\d+/g,
 RES={duration:1,ease:1,immediateRender:1,stagger:1,transformOrigin:1,onUpdate:1,repeat:1,yoyo:1,scrollTrigger:1,delay:1,overwrite:1,lazy:1};
 function toEls(t){if(typeof t==="string")return[].slice.call(document.querySelectorAll(t));if(t&&t.nodeType)return[t];if(Array.isArray(t))return t.reduce(function(a,x){return a.concat(toEls(x))},[]);return[t]}
 function st(el){var s=S.get(el);if(!s){s={};S.set(el,s)}return s}
 function save(el){if(el.nodeType&&!touched.has(el))touched.set(el,el.getAttribute("style"))}
 function dflt(p){return p==="autoAlpha"||p==="opacity"||p==="scale"?1:0}
 function cur(el,p){if(!el.nodeType)return el[p]!==undefined?el[p]:dflt(p);var s=st(el);if(s[p]!==undefined)return s[p];if(p==="clipPath")return getComputedStyle(el).clipPath;if(p==="opacity"||p==="autoAlpha"){var o=parseFloat(getComputedStyle(el).opacity);return isNaN(o)?1:o}return dflt(p)}
 function put(el,p,v){if(el.nodeType)st(el)[p]=v;else el[p]=v}
 function interp(a,b,r){if(typeof a==="number"&&typeof b==="number")return a+(b-a)*r;
  if(typeof a==="string"&&typeof b==="string"){var na=a.match(NUM),nb=b.match(NUM);if(na&&nb&&na.length===nb.length){var i=0;return b.replace(NUM,function(){var v=+na[i]+(+nb[i]-+na[i])*r;i++;return +v.toFixed(3)})}}return r>=1?b:a}
 function render(el){if(!el.nodeType)return;var s=st(el);save(el);var tf=[];
  if(s.x!==undefined||s.y!==undefined)tf.push("translate("+(s.x||0)+"px,"+(s.y||0)+"px)");
  if(s.xPercent!==undefined||s.yPercent!==undefined)tf.push("translate("+(s.xPercent||0)+"%,"+(s.yPercent||0)+"%)");
  if(s.scale!==undefined)tf.push("scale("+s.scale+")");if(tf.length)el.style.transform=tf.join(" ");
  var a=s.autoAlpha!==undefined?s.autoAlpha:s.opacity;if(a!==undefined)el.style.opacity=a;
  if(s.autoAlpha!==undefined)el.style.visibility=s.autoAlpha>0?"inherit":"hidden";
  ["clipPath","backgroundColor","color","strokeDasharray","strokeDashoffset"].forEach(function(k){if(s[k]!==undefined)el.style[k]=s[k]})}
 function val(v){return typeof v==="function"?v():v}
 function props(o){return Object.keys(o||{}).filter(function(k){return!RES[k]})}
 function Timeline(o){o=o||{};this.kids=[];this.defaults=o.defaults||{};this.cfg=o.scrollTrigger||null;this.base=new Map();this.dur=0;
  if(this.cfg)regs.push({tl:this,cfg:this.cfg});else looseTls.push(this)}
 Timeline.prototype.duration=function(){return this.dur};
 Timeline.prototype._add=function(targets,from,to,pos,isFrom){var self=this,d=Object.assign({},this.defaults,to),els=toEls(targets);
  if(isFrom){var f=d;to={};props(f).forEach(function(p){to[p]=cur(els[0],p)});d=Object.assign({},this.defaults,f);from=f}
  var dur=d.duration===undefined?.5:d.duration,t0=typeof pos==="number"?pos:this.dur,stag=typeof d.stagger==="number"?d.stagger:0;
  var imm=from?d.immediateRender!==false:false;
  var tw={els:els,from:from,to:isFrom?to:to,t0:t0,dur:dur,stag:stag,upd:d.onUpdate,imm:imm};
  props(isFrom?from:to).concat(props(from)).forEach(function(p){els.forEach(function(el){var key=p;var m=self.base.get(el)||{};if(!(key in m)){m[key]=cur(el,p);self.base.set(el,m)}})});
  if(imm){els.forEach(function(el){props(from).forEach(function(p){put(el,p,val(from[p]))});render(el)})}
  this.kids.push(tw);this.dur=Math.max(this.dur,t0+dur+stag*(els.length-1));return this};
 Timeline.prototype.to=function(t,v,p){return this._add(t,null,v,p)};
 Timeline.prototype.from=function(t,v,p){return this._add(t,v,null,p,true)};
 Timeline.prototype.fromTo=function(t,f,v,p){return this._add(t,f,v,p)};
 Timeline.prototype.set=function(t,v,p){return this._add(t,v,Object.assign({},v,{duration:0}),p)};
 Timeline.prototype.seek=function(r){var self=this,time=Math.max(0,Math.min(1,r))*this.dur,keys=new Map();
  this.kids.forEach(function(tw){tw.els.forEach(function(el,i){props(tw.from&&!tw.isFromOnly?Object.assign({},tw.to,tw.from):tw.to).forEach(function(p){var k=keys.get(el)||{};(k[p]=k[p]||[]).push({tw:tw,i:i});keys.set(el,k)})})});
  keys.forEach(function(map,el){Object.keys(map).forEach(function(p){
   var list=map[p].sort(function(a,b){return a.tw.t0+a.i*a.tw.stag-(b.tw.t0+b.i*b.tw.stag)}),v=(self.base.get(el)||{})[p];if(v===undefined)v=dflt(p);
   for(var n=0;n<list.length;n++){var tw=list[n].tw,s0=tw.t0+list[n].i*tw.stag,e0=s0+tw.dur,fv=tw.from&&p in tw.from?val(tw.from[p]):v,tv=val(tw.to[p]);
    if(time>=e0){v=tv}else if(time>s0){v=interp(fv,tv,(time-s0)/tw.dur);break}else{if(tw.imm&&tw.from&&p in tw.from)v=fv;break}}
   put(el,p,v)});render(el)});
  this.kids.forEach(function(tw){if(tw.upd)tw.upd()});this.progress=r};
 function loose(kind,t,a,b,c){var pos=kind==="fromTo"?b:a;var vars=kind==="fromTo"?c:b;var o=kind==="fromTo"?c:(kind==="from"?a2(b):b);
  var cfg=(kind==="fromTo"?c:b).scrollTrigger;var tl=new Timeline(cfg?{scrollTrigger:cfg}:{});
  if(kind==="fromTo")tl.fromTo(t,a,Object.assign({},c),0);else if(kind==="from")tl.from(t,b,0);else tl.to(t,b,0);
  if(!cfg)tl.seek(1);return tl}
 function a2(x){return x}
 var mmRun=function(it){touched.clear&&0;var conditions={};Object.keys(it.conds).forEach(function(k){conditions[k]=matchMedia(it.conds[k]).matches});it.cleanup=it.fn({conditions});
  looseTls.forEach(function(t){t.seek(1)})};
 window.gsap={registerPlugin:function(){},
  set:function(t,v){toEls(t).forEach(function(el){props(v).forEach(function(p){put(el,p,val(v[p]))});render(el)})},
  to:function(t,v){return loose("to",t,v,v)},from:function(t,v){return loose("from",t,v,v)},fromTo:function(t,f,v){return loose("fromTo",t,f,v,v)},
  timeline:function(o){return new Timeline(o)},
  matchMedia:function(){return{add:function(conds,fn){var it={conds:conds,fn:fn};mmItems.push(it);mmRun(it)}}}};
 window.ScrollTrigger={registerPlugin:function(){},config:function(){},refresh:function(){refreshCount++},create:function(cfg){regs.push({tl:null,cfg:cfg});return{}}};
 window.__standIn={regs:regs,
  refreshCount:function(){return refreshCount},
  seek:function(tl,r){tl.seek(r);if(tl.cfg&&tl.cfg.onUpdate)tl.cfg.onUpdate({progress:r,isActive:true})},
  revert:function(){mmItems.forEach(function(it){if(typeof it.cleanup==="function")it.cleanup()});regs.length=0;looseTls.length=0;touched.forEach(function(s,el){s===null?el.removeAttribute("style"):el.setAttribute("style",s)});touched.clear()},
  rerun:function(){this.revert();mmItems.forEach(mmRun)}};
})();
