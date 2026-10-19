/* V2A: original employee speech schedule/pools; small measured bubbles with speaker tails. */
(function () {
  "use strict";
  const ui=window.GameUI,G=window.OfficeGeometry;
  if(!ui||!G)return;
  let observer=null,observed=null,scheduled=0,timer=0,hideTimer=0,enterTimer=0,exitTimer=0,speechPop=0;
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  function place(body,cw,ch,w,h,labels){
    const mid=body.x+body.w/2;
    const candidates=[{x:mid-w/2,y:body.y-h-8},{x:body.x-w-8,y:body.y},{x:body.x+body.w+8,y:body.y},
      {x:mid-w/2,y:body.y+body.h+8}];
    for(const r of labels){
      candidates.push({x:mid-w/2,y:r.y-h-5},{x:mid-w/2,y:r.y+r.h+5},
        {x:r.x-w-5,y:body.y-h-8},{x:r.x+r.w+5,y:body.y-h-8},
        {x:r.x-w-5,y:r.y+r.h+5},{x:r.x+r.w+5,y:r.y+r.h+5});
    }
    candidates.push({x:5,y:ch-h-5},{x:cw-w-5,y:ch-h-5},{x:5,y:5},{x:cw-w-5,y:5});
    let best=null,cost=Infinity;
    candidates.forEach((p,i)=>{
      const q={x:G.clamp(p.x,5,Math.max(5,cw-w-5)),y:G.clamp(p.y,5,Math.max(5,ch-h-5)),w,h};
      if(labels.some(r=>overlap(q,r)))return; // employee names/stamina/status are hard obstacles
      const dx=Math.max(body.x-q.x-q.w,q.x-body.x-body.w,0),dy=Math.max(body.y-q.y-q.h,q.y-body.y-body.h,0);
      const v=Math.hypot(dx,dy)*10+(overlap(q,body)?1e6:0)+i*.1;
      if(v<cost){best=q;cost=v;}
    });
    return best;
  }
  function decorate(b,name){
    if(b.querySelector(".v2a-bubble-text"))return;
    const line=b.textContent;b.textContent="";
    const speaker=document.createElement("b");speaker.className="v2a-bubble-name";speaker.textContent=name;
    const text=document.createElement("span");text.className="v2a-bubble-text";text.textContent=line;
    b.append(speaker,text);b.classList.add("v2a-bubble");b.setAttribute("aria-label",name+"："+line);
  }
  const whaleName=()=>ui.core&&typeof ui.core.whaleName==='function'?ui.core.whaleName():'鲸鱼娘';
  function decorateWhale(b){
    const old=b.querySelector('.v2a-bubble-text');
    if(b._v2aWhaleRawLine==null)b._v2aWhaleRawLine=old?old.textContent:b.textContent;
    const name=whaleName(),raw=b._v2aWhaleRawLine,line=ui.core&&typeof ui.core.fillWhaleText==='function'?ui.core.fillWhaleText(raw):raw;
    if(!old)b.textContent=line;
    decorate(b,name);
    const speaker=b.querySelector('.v2a-bubble-name'),text=b.querySelector('.v2a-bubble-text');
    if(speaker.textContent!==name)speaker.textContent=name;
    if(text.textContent!==line)text.textContent=line;
    const label=name+'：'+line;
    if(b.getAttribute('aria-label')!==label)b.setAttribute('aria-label',label);
    if(b.title!==label)b.title=label;
  }
  function layout(scene,b,body,origin,labels){
    const sr=scene.getBoundingClientRect(),cw=scene.clientWidth,ch=scene.clientHeight;
    if(!cw||!ch||!sr.width)return;
    const sx=sr.width/cw,sy=sr.height/ch;
    const marker=b.closest(".emp-marker");
    const parentRect=marker&&marker.getBoundingClientRect();
    const fx=marker&&marker.offsetWidth?parentRect.width/sx/marker.offsetWidth:1;
    const fy=marker&&marker.offsetHeight?parentRect.height/sy/marker.offsetHeight:1;
    // Bubble text keeps a readable screen size at either camera scale. Its
    // intrinsic width must not shrink to the avatar-only marker's 28/48px box.
    const screenScale=sx*fx;
    b.style.fontSize=12/screenScale+"px";
    b.style.minWidth=Math.min(112,sr.width-12)/screenScale+"px";
    b.style.maxWidth=Math.min(200,sr.width-12)/screenScale+"px";
    let w=b.offsetWidth*fx,h=b.offsetHeight*fy;
    if(!w||!h)return;
    let best=place(body,cw,ch,w,h,labels);
    if(!best){b.style.maxWidth=Math.min(140,sr.width-12)/screenScale+"px";w=b.offsetWidth*fx;h=b.offsetHeight*fy;best=place(body,cw,ch,w,h,labels);}
    if(!best){b.style.visibility="hidden";return;} // Never cover employee information on a crowded edited map.
    b.style.visibility="visible";
    b.style.left=(best.x-origin.x)/fx+"px";b.style.top=(best.y-origin.y)/fy+"px";
    const cx=body.x+body.w/2,cy=body.y+body.h/2;
    let side;
    if(best.y+h<=body.y)side="down";else if(best.y>=body.y+body.h)side="up";else side=best.x+w<=cx?"right":"left";
    b.dataset.tail=side;
    b.style.setProperty("--v2a-tail-x",G.clamp((cx-best.x)/fx,8,Math.max(8,b.offsetWidth-8))+"px");
    b.style.setProperty("--v2a-tail-y",G.clamp((cy-best.y)/fy,8,Math.max(8,b.offsetHeight-8))+"px");
  }
  function refresh(){
    if(!officeWhaleVisible()){clearTimeout(timer);timer=0;clearSpeech(true);}
    const scene=ui.el&&ui.el.querySelector(".office-scene.v2a-scene");
    if(!scene)return;
    if(observed!==scene&&window.MutationObserver){if(observer)observer.disconnect();observed=scene;
      observer=new window.MutationObserver(schedule);observer.observe(scene,{childList:true,subtree:true,characterData:true});}
    const employeeBubbles=Array.from(scene.querySelectorAll(".emp-bubble"));
    const b=ui.el.querySelector(".v2a-whale-bubble"),node=window.V2OfficeScene?window.V2OfficeScene.whaleNode({scene}):scene.querySelector(".v2a-whale");
    if(b&&!b.hidden)decorateWhale(b);
    if(node&&officeWhaleVisible()){
      const name=whaleName(),label='轻触'+name+'；可拖动',img=node.querySelector('img');
      if(node.getAttribute('aria-label')!==label)node.setAttribute('aria-label',label);
      if(img&&img.alt!==name)img.alt=name;
    }
    if(!employeeBubbles.length&&(!b||b.hidden))return;
    const sr=scene.getBoundingClientRect(),cw=scene.clientWidth,ch=scene.clientHeight;
    if(!sr.width||!cw||!ch)return;
    const sx=sr.width/cw,sy=sr.height/ch;
    const measure=node=>{const r=node.getBoundingClientRect();return {x:(r.left-sr.left)/sx,y:(r.top-sr.top)/sy,w:r.width/sx,h:r.height/sy};};
    const labels=Array.from(scene.querySelectorAll(".emp-name,.emp-stamina,.emp-status,.v2a-office-controls")).map(measure);
    const avatars=Array.from(scene.querySelectorAll(".emp-avatar"));
    // The guide and pause badge occupy higher shell layers. They remain hard
    // obstacles even though they are outside the scaled scene's subtree.
    for(const node of ui.el.querySelectorAll(".office-guide-banner,#ob-pausedtag")) {
      const r=measure(node);if(r.w>0&&r.h>0)labels.push(r);
    }
    employeeBubbles.forEach(b=>{
      const marker=b.closest(".emp-marker"),name=marker.querySelector(".emp-name");decorate(b,name?name.textContent:"同事");
      const portrait=marker.querySelector(".emp-avatar");
      layout(scene,b,measure(portrait),measure(marker),labels.concat(avatars.filter(node=>node!==portrait).map(measure)));
    });
    if(b&&node&&!b.hidden){
      if(node.classList.contains('v2a-floating')){
        const layer=node.parentNode;if(b.parentNode!==layer)layer.appendChild(b);
        const bounds=window.V2OfficeScene.gameBounds(),r=node.getBoundingClientRect();
        b.style.maxWidth=Math.min(180,bounds.w-12)+'px';
        const target={x:r.left-bounds.x,y:r.top-bounds.y,w:r.width,h:r.height};
        const q=place(target,bounds.w,bounds.h,b.offsetWidth,b.offsetHeight,[]);
        b.style.visibility=q?'visible':'hidden';
        if(q){b.style.left=(bounds.x+q.x)+'px';b.style.top=(bounds.y+q.y)+'px';b.dataset.tail=q.y<target.y?'down':'up';
          b.style.setProperty('--v2a-tail-x',G.clamp(target.x+target.w/2-q.x,8,Math.max(8,b.offsetWidth-8))+'px');}
      }else{if(b.parentNode!==scene)scene.appendChild(b);layout(scene,b,measure(node),{x:0,y:0},labels);}
    }
  }
  function schedule(){if(scheduled)return;scheduled=window.requestAnimationFrame(()=>{scheduled=0;refresh();});}
  function officeWhaleVisible(){
    const core=ui.core,s=core&&core.state;
    return !!(s&&typeof core.embodiedBodyAvailable==="function"&&core.embodiedBodyAvailable()
      &&s.embodiedEra&&s.embodiedEra.podExitSeen);
  }
  function canTalk(){if(typeof ui.whaleCanTalk==="function")return ui.whaleCanTalk();const s=ui.core.state;return s.ver!=="V1"||ui.omTestTier()!=="dumb";}
  function state(){const s=ui.core.state,alive=(s.engineers||[]).filter(e=>!e.resigned);
    if(!canTalk())return {face:"stand",group:"early"};
    if(s.care&&s.care.active&&ui.core.cfg.WHALE_CARE&&ui.core.cfg.WHALE_CARE.ENABLED!==false&&(ui._careFeedUntil||0)>Date.now())return {face:"比耶",group:"feed"};
    if(s.officePaused)return {face:"躺1",group:"paused"};
    if(ui.core.offworkNow&&ui.core.offworkNow())return {face:"躺1",group:"night"};
    const payroll=ui.core.payrollTotal?ui.core.payrollTotal():0;
    if((s.fiscalDeficit||0)>0||(s.funding||0)<Math.max(50000,payroll))return {face:"冒汗",group:"lowFunds"};
    if(alive.length&&alive.every(e=>ui.engEnergy(e)<30))return {face:"冒汗",group:"tired"};
    if(s.paperResearch)return {face:"看书",group:"training"};
    if(s.result&&ui.core.isPassLike&&ui.core.isPassLike(s.result))return {face:"比耶",group:"goodNews"};
    if(ui.core.canReview&&ui.core.canReview())return {face:"比耶",group:"review"};
    if(s.rank!=null&&s.rank>0&&s.rank<=3)return {face:"得意墨镜",group:"idle"};
    return {face:"stand",group:s.planDone?"training":"idle"};
  }
  function group(){return state().group;}
  function clearSpeech(hide){
    clearTimeout(hideTimer);clearTimeout(enterTimer);clearTimeout(exitTimer);
    hideTimer=enterTimer=exitTimer=0;
    if(hide){const b=ui.el&&ui.el.querySelector('.v2a-whale-bubble');if(b){b.hidden=true;b.dataset.phase='hidden';}}
  }
  function say(kind){
    if(!officeWhaleVisible()){clearTimeout(timer);timer=0;clearSpeech(true);return;}
    if(window.OfficeSleep&&window.OfficeSleep.active()){clearSpeech(true);window.OfficeSleep.dream(kind!=null);return;}
    const scene=ui.el&&ui.el.querySelector(".office-scene.v2a-scene"),s=ui.core&&ui.core.state;
    if(!scene||!s||s.phase!=="office"||document.hidden||s.officeModal||(ui._v2aDrag&&kind!=="drag"))return;
    let b=ui.el.querySelector(".v2a-whale-bubble");if(!b){b=document.createElement("div");b.className="v2a-whale-bubble v2a-bubble";scene.appendChild(b);}
    const lines=ui.core.cfg.WHALE_LINES||{},configured=lines[kind||group()];
    const pool=Array.isArray(configured)&&configured.length?configured:(lines.idle||["老板，今天也一起加油吧。"]);
    clearSpeech(false);
    const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    b._v2aWhaleRawLine=canTalk()?pool[Math.floor(Math.random()*pool.length)]:"咕嘎……";b.textContent=b._v2aWhaleRawLine;b.hidden=false;
    b.dataset.phase='enter';b.dataset.pop=++speechPop%2?'a':'b';decorateWhale(b);refresh();
    enterTimer=setTimeout(()=>{enterTimer=0;if(!officeWhaleVisible()){clearSpeech(true);return;}b.dataset.phase='hold';},reduced?120:280);
    hideTimer=setTimeout(()=>{hideTimer=0;b.dataset.phase='exit';
      exitTimer=setTimeout(()=>{exitTimer=0;b.hidden=true;b.dataset.phase='hidden';},reduced?120:240);
    },Math.max(300,Number((ui.core.cfg.OFFICE_BUBBLE||{}).SHOW_MS)||4000));
  }
  function start(){if(!officeWhaleVisible()){clearTimeout(timer);timer=0;clearSpeech(true);return;}if(timer||document.hidden)return;
    const c=ui.core&&ui.core.cfg;if(!c)return;const [a,b]=(c.OFFICE_BUBBLE||{}).EVERY_MS||[20000,45000];
    timer=setTimeout(()=>{timer=0;say();if(ui.core.state&&ui.core.state.phase==="office")start();},a+Math.random()*(b-a));
  }
  for(const name of ["spawnOfficeBubble","renderOffice","updateOfficeMain"]){const original=ui[name];
    ui[name]=function(){const r=original.apply(this,arguments);refresh();if(name==="renderOffice")start();return r;};}
  const stop=ui.stopBubbleTimer;ui.stopBubbleTimer=function(){clearTimeout(timer);timer=0;clearSpeech(true);return stop.apply(this,arguments);};
  document.addEventListener("visibilitychange",()=>{if(document.hidden){clearTimeout(timer);timer=0;clearSpeech(true);}else if(ui.core&&ui.core.state&&ui.core.state.phase==="office")start();});
  window.addEventListener("resize",schedule);
  window.OfficeBubbles={refresh,place,decorate,canTalk,group,state,say};
})();
