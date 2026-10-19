/* Office sleep is presentation-only; duty state stays owned by GameCore. */
(function () {
  'use strict';
  const ui=window.GameUI;
  if(!ui)return;
  let pop=0,bound=null,observer=null;
  const assets=Object.create(null);
  const overlays='.modal-mask,.dg-modal-mask,.set-pop-mask,.sub-modal-overlay,.ev-spawn,.insp-overlay,.v2b-panel-host,.rl-more,.chat-zoom-mask,.nw-lightbox,.embodied-overlay';
  function covered(){return Array.from(ui.el?ui.el.querySelectorAll(overlays):[]).concat(Array.from(document.querySelectorAll(overlays))).some(n=>!n.hidden&&!n.closest('[hidden]')&&window.getComputedStyle(n).display!=='none'&&window.getComputedStyle(n).visibility!=='hidden');}
  function crew(core){
    const s=core&&core.state,t=s&&s.v35&&s.v35.tick;
    return (s&&s.engineers||[]).filter(e=>e&&!e.resigned
      &&(e.joinTick==null||t!=null&&t>=e.joinTick));
  }
  function active(){
    const core=ui.core,s=core&&core.state;
    if(!s||s.phase!=='office'||typeof core.embodiedBodyAvailable!=='function'||!core.embodiedBodyAvailable()
      ||!s.embodiedEra||!s.embodiedEra.podExitSeen||ui._v2aDrag||ui._v2aReturnFrame||ui._whaleAutomationActor)return false;
    const people=crew(core),off=typeof core.offworkNow==='function'&&core.offworkNow();
    return people.length>0&&people.every(e=>off||e.restWeek===(s.week||0));
  }
  function actor(){return ui.el&&ui.el.querySelector('.v2a-whale');}
  function noseAnchor(){
    const core=ui.core,scene=core&&typeof core.scene==='function'?core.scene():null;
    const outfit=core&&core.state.care&&core.state.care.outfit;
    const img=actor()&&actor().querySelector('img'),src=img&&img.getAttribute('src');
    const entry=outfit&&(core.cfg.WHALE_OUTFITS||[]).find(row=>row.id===outfit&&(row.img===src||row.sleepImg===src));
    const value=(entry&&entry.sleepNose)||(scene&&scene.whale&&scene.whale.sleepNose);
    const fallback={x:42,y:37,size:11};if(!value)return fallback;
    const values=[value.x,value.y,value.size],unit=values.every(n=>typeof n==='number'&&n>0&&n<=1)?100:1;
    if(!values.every(n=>typeof n==='number'&&Number.isFinite(n)))return fallback;
    const result={x:value.x*unit,y:value.y*unit,size:value.size*unit};
    return result.x>0&&result.x<100&&result.y>0&&result.y<100&&result.size>=2&&result.size<=30?result:fallback;
  }
  function art(core,standing,scene){
    if(!active())return standing;
    const outfit=core.state.care&&core.state.care.outfit;
    const entry=outfit&&(core.cfg.WHALE_OUTFITS||[]).find(row=>row.id===outfit&&row.img===standing);
    const whale=scene&&scene.whale||{},src=entry?entry.sleepImg:whale.sleep||(whale.poses||{}).sleep;
    // A missing outfit variant must preserve that outfit's standing art.
    if(!src)return standing;
    if(assets[src]==null){assets[src]='loading';const image=new window.Image();
      image.onload=()=>{assets[src]=image.naturalWidth>0&&image.naturalHeight>0;if(window.V2OfficeScene)window.V2OfficeScene.refreshLayout();};
      image.onerror=()=>{assets[src]=false;};image.src=src;
    }
    return assets[src]===true?src:standing;
  }
  function dream(pulse){
    const node=actor(),s=ui.core&&ui.core.state;
    if(!node||!active())return false;
    let bubble=ui.el.querySelector('.office-sleep-dream');
    if(!bubble){bubble=document.createElement('div');bubble.className='office-sleep-dream';bubble.setAttribute('role','img');bubble.setAttribute('aria-label','小鲸鱼正在梦见米饭');
      const bowl=document.createElement('img');bowl.src='resource/ui/whale_rice_bowl.webp';bowl.alt='米饭';bowl.draggable=false;bubble.appendChild(bowl);ui.el.appendChild(bubble);}
    bubble.hidden=!!s.officeModal||!!ui._confirmOpen||document.hidden||!!node.closest('.v2a-overlay-blocked')||covered();
    if(bubble.hidden)return true;
    const r=node.getBoundingClientRect(),w=50,h=44;
    // Clamping a right-side dream into a narrow viewport must not move it over
    // its own sleeping face or nose. Reserve the full actor after clamping.
    const obstacles=[r,...Array.from(ui.el.querySelectorAll('.emp-avatar,.emp-name,.emp-stamina,.office-guide-banner,.v2a-office-controls')).map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.height)];
    const candidates=[{x:r.right+4,y:r.top-12},{x:r.right+4,y:r.top-52},{x:r.left-w-4,y:r.top-12},{x:r.right+4,y:r.top+r.height*.25}].map(q=>({x:Math.max(6,Math.min(window.innerWidth-w-6,q.x)),y:Math.max(6,Math.min(window.innerHeight-h-6,q.y))}));
    const q=candidates.find(q=>obstacles.every(o=>q.x>=o.right+4||q.x+w+4<=o.left||q.y>=o.bottom+4||q.y+h+4<=o.top));
    bubble.hidden=!q;
    if(q){bubble.style.left=q.x+'px';bubble.style.top=q.y+'px';}
    if(pulse)bubble.dataset.pop=++pop%2?'a':'b';
    return true;
  }
  function refresh(){
    const node=actor(),sleeping=active();
    if(node){node.classList.toggle('office-whale-sleeping',sleeping);let nose=node.querySelector('.office-whale-nose');
      if(sleeping&&!nose){nose=document.createElement('span');nose.className='office-whale-nose';nose.setAttribute('aria-hidden','true');node.appendChild(nose);}
      if(nose&&sleeping){const point=noseAnchor(),r=node.getBoundingClientRect(),style=window.getComputedStyle(node),width=parseFloat(style.width)||node.offsetWidth||r.width,localHeight=parseFloat(style.height)||node.offsetHeight||r.height,height=width*point.size*.0085;
        nose.style.left=(point.x-point.size/2)+'%';nose.style.width=point.size+'%';
        if(width>0&&localHeight>0){nose.style.height=height+'px';nose.style.top=(localHeight*point.y/100-height)+'px';}}
      if(nose&&!sleeping)nose.remove();
      const name=typeof ui.core.whaleName==='function'?ui.core.whaleName():'小鲸鱼';
      if(sleeping){node.setAttribute('aria-label',name+'正在睡觉；轻触看看米饭梦');const speech=ui.el.querySelector('.v2a-whale-bubble');if(speech){speech.hidden=true;speech.dataset.phase='hidden';}dream(false);}
      else node.setAttribute('aria-label','轻触'+name+'；可拖动');
    }
    if(!sleeping){const bubble=ui.el&&ui.el.querySelector('.office-sleep-dream');if(bubble)bubble.remove();}
    if(ui.el&&bound!==ui.el){bound=ui.el;
      const tap=e=>{const target=e.target&&e.target.closest&&e.target.closest('.v2a-whale');if(!target||!active()||(e.type==='keydown'&&!['Enter',' '].includes(e.key)))return;
        e.preventDefault();e.stopImmediatePropagation();ui._clickHandled=true;ui._pressTarget=null;dream(true);};
      bound.addEventListener('click',tap,true);bound.addEventListener('keydown',tap,true);
      if(window.MutationObserver){if(observer)observer.disconnect();observer=new window.MutationObserver(changes=>{
        const isOverlay=n=>n.nodeType===1&&(n.matches(overlays)||!!n.querySelector(overlays));
        if(changes.some(change=>change.type==='attributes'?change.target.matches(overlays):Array.from(change.addedNodes).concat(Array.from(change.removedNodes)).some(isOverlay)))refresh();
      });observer.observe(bound,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','style']});}
    }
  }
  for(const key of ['renderOffice','updateOfficeMain','renderOfficeModal','closeOfficeModal']){const original=ui[key];if(typeof original!=='function')continue;ui[key]=function(){const result=original.apply(this,arguments);refresh();return result;};}
  if(window.V2OfficeScene){for(const key of ['refresh','refreshLayout']){const original=window.V2OfficeScene[key];window.V2OfficeScene[key]=function(){const result=original.apply(this,arguments);refresh();return result;};}}
  // Drag movement uses this public layout hook from the scene's private closure.
  if(window.OfficeBubbles){const original=window.OfficeBubbles.refresh;window.OfficeBubbles.refresh=function(){const result=original.apply(this,arguments);refresh();return result;};}
  if(window.V2Panels){const original=window.V2Panels.open;window.V2Panels.open=function(options){const opts=options||{},closed=opts.onClose;const panel=original.call(this,{...opts,onClose(){if(closed)closed.apply(this,arguments);refresh();}});refresh();return panel;};}
  window.addEventListener('resize',refresh);document.addEventListener('visibilitychange',refresh);
  window.OfficeSleep={active,crew,refresh,dream,art,noseAnchor};
})();
