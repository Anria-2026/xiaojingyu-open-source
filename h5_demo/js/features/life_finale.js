/* A saved, code-rendered finale; history comes from this player's own records. */
(function () {
  'use strict';
  if (window.LifeFinale || !window.GameUI) return;
  const ui=window.GameUI, types=['dialogue','memory','journey','split','ending','caption','effect','wall'];
  const tracks=['scene','memory','journey','caption','fx'];
  let run=null;
  const number=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const integer=v=>Math.round(number(v)).toLocaleString('zh-CN');
  const cfg=c=>((c.cfg.LIFE_STORY||{}).FINALE||{});
  const edition=c=>Math.max(1,Math.floor(number(cfg(c).version,1)));
  const finalStage=c=>String(cfg(c).unlockStage||((c.cfg.EMBODIED||{}).FINAL_STAGE)||(c.cfg.VER_ORDER||[]).slice(-1)[0]||'V6.5');
  const markedStage=(c,p)=>String(p.stage||(number(p.version,1)===1?'V5.5':finalStage(c)));
  const roleText=(c,v)=>c.fillWhaleText?c.fillWhaleText(String(v||'')):String(v||'');
  const roleName=c=>c.whaleName?c.whaleName():'鲸鱼娘';
  const title=c=>roleText(c,(c.cfg.LIFE_STORY||{}).TITLE||'给她完整的一生');
  const asset=v=>/^(?:\/?resource\/|https?:\/\/)/i.test(String(v||''))?(window.ResourcePaths?ResourcePaths.canonical(String(v)):String(v)):'';
  const reduced=()=>!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function timeline(c) {
    const list=LifeTimeline.normalize(cfg(c).timeline,cfg(c));
    const inherited={};
    /* 空串 = 作者显式留空：该段不显示（背景黑场、没有立绘），不再沿用同轨前一段；
       undefined/null = 从未设置过，才沿用前一段。与编辑器预览同一口径。 */
    for(const cue of list){const prior=inherited[cue.track]||(inherited[cue.track]={background:'',sprite:''});
      prior.background=cue.background===''?'':(asset(cue.background)||prior.background);
      prior.sprite=cue.sprite===''?'':(asset(cue.sprite)||prior.sprite);
      cue.background=prior.background;cue.sprite=prior.sprite;}
    return list;
  }
  function history(s) {
    const order=(ui.core.cfg.VER_ORDER||[]), marks=s.stageMarks||{}, snapshots=s.modelHistory||[];
    return order.map(ver=>{
      const first=marks[ver], fallback=snapshots.find(x=>x&&x.ver===ver), p=first||fallback;
      if(!p)return {ver,missing:true,date:'首次记录未保存',score:null};
      const validAt=first&&first.at&&!Number.isNaN(Date.parse(first.at));
      return {ver,missing:false,first:!!first,date:validAt?new Date(first.at).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}):'首次时间未保存',
        at:validAt?first.at:null,score:Math.round(number(p.score)),week:Math.floor(number(p.week)),team:Math.floor(number(p.team)),users:Math.floor(number(p.users)),
        brand:Math.floor(number(p.brand)),name:String(p.name||''),verdict:p.verdict||'',arch:p.arch||'',param:Math.floor(number(p.param))};
    });
  }
  function milestones(s) {
    const good=x=>x&&x.at&&!Number.isNaN(Date.parse(x.at));
    const records=Object.values(s.stageMarks||{}).concat(s.codexLog||[],Object.values(s.codex||{}).flatMap(x=>x?[x.first,x.best,x.last]:[]),s.rankLog||[],s.modelHistory||[]).filter(Boolean);
    const stamps=records.filter(good).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const explicit=s.lifeMilestones||{};
    const entry=(key,record,exact=false)=>({key,at:good(record)?record.at:null,date:good(record)?new Date(record.at).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}):'日期未留存',exact,achieved:!!record,source:record&&record.source||'',record:record||null});
    const first=(key,match)=>good(explicit[key])?entry(key,explicit[key],true):entry(key,stamps.find(match)||records.find(match));
    const out={first_project:entry('first_project',explicit.first_project,true),first_V1:entry('first_V1',(s.stageMarks||{}).V1,true),first_top10:first('first_top10',x=>Number.isFinite(Number(x.rank))&&Number(x.rank)>=1&&Number(x.rank)<=10),first_rank1:first('first_rank1',x=>Number(x.rank)===1),body_awake:entry('body_awake',explicit.body_awake,true)};
    for(const ver of ui.core.cfg.VER_ORDER||[])out['stage_'+ver]=entry('stage_'+ver,(s.stageMarks||{})[ver],true);
    for(const ver of ['V5','V5.5','V6','V6.5'])out['body_'+ver]=good(explicit['body_'+ver])?entry('body_'+ver,explicit['body_'+ver],true):out['stage_'+ver];
    if(!out.first_project.achieved&&records.length)out.first_project.achieved=true;
    if(Object.values(s.rank1Params||{}).some(Boolean)){out.first_rank1.achieved=true;out.first_top10.achieved=true;}
    if(!out.body_awake.achieved&&s.embodiedEra&&s.embodiedEra.bodyAwakened&&s.embodiedEra.podExitSeen)out.body_awake.achieved=true;
    const stops=((ui.core.cfg.CITY_JOURNEY||{}).STOPS||[]),log=(s.cityJourney||{}).log||[];
    for(const stop of stops){
      const key='city_'+stop.id,labelUnique=stops.filter(n=>n.label===stop.label).length===1;
      const line=Array.isArray(log)?log.find(x=>x&&(x.nodeId===stop.id||labelUnique&&x.type==='system'&&x.text===stop.label)):null;
      const prior=line&&Number.isFinite(Number(line.at))&&Number(line.at)>0?{...line,at:new Date(Number(line.at)).toISOString()}:line;
      out[key]=good(explicit[key])?entry(key,explicit[key],true):entry(key,prior,false);
      if(((s.cityJourney||{}).completedStops||[]).includes(stop.id))out[key].achieved=true;
    }
    return out;
  }
  function wallCards(r,cue) {return Array.isArray(cue.wallCards)?cue.wallCards:Array.isArray(cfg(r.core).wallCards)?cfg(r.core).wallCards:[];}
  // Old wallSpeed values were pixels per second; the new value is a relative pace.
  // All pace weights share the fixed walking interval, so every viewport reaches
  // the last card once, at the same point in the soundtrack.
  const wallPace=cue=>LifeTimeline.wallPace(cue);
  const wallProgress=r=>LifeTimeline.wallProgress(r.wallCues,r.elapsed);
  function bounds(r,el) {
    if(!el)return null;const b=el.getBoundingClientRect();if(!r.softwareLandscape)return b;
    const host=r.host.getBoundingClientRect(),left=b.top-host.top,top=host.right-b.right;
    return {left,top,right:left+b.height,bottom:top+b.width,width:b.height,height:b.width};
  }
  function measureWall(r) {
    const wall=r.wall;if(!wall||!wall.cycle)return;
    wall.viewportWidth=bounds(r,wall.viewport).width||window.innerWidth||1280;
    const viewportHeight=bounds(r,wall.viewport).height||0;
    // Fit the frame to the original photograph, then bound it by the stage.
    const size=Math.max(1,Math.min(viewportHeight-20,wall.viewportWidth*.72));
    for(const card of wall.cycle.children){
      const image=card.querySelector('.life-wall-photo img'),photo=card.querySelector('.life-wall-photo');
      const ratio=image?.naturalWidth&&image?.naturalHeight?image.naturalWidth/image.naturalHeight:1;
      card.style.setProperty('--life-wall-photo-ratio',String(ratio));
      card.style.setProperty('--life-wall-card-size',size+'px');
      if(photo)for(let pass=0;pass<4;pass++){
        const overhead=card.offsetHeight-photo.offsetHeight,edge=card.offsetWidth-photo.offsetWidth;
        const width=Math.max(1,Math.min(size,(size-overhead)*ratio+edge));
        if(Math.abs(card.offsetWidth-width)<1)break;
        card.style.setProperty('--life-wall-card-size',width+'px');
      }
    }
    wall.width=bounds(r,wall.cycle).width||Math.max(1,wall.cycle.children.length)*(size+24);
    const unit=wall.width/Math.max(1,wall.cycle.children.length);
    const offsets=[];
    wall.cards=[...wall.cycle.children].map((el,i)=>{const rect=bounds(r,el),width=el.offsetWidth||rect.width||unit,height=el.offsetHeight||rect.height||0;
      const room=Math.max(0,(viewportHeight-height)/2-18),amplitude=Math.min(wall.viewportWidth<=640?18:30,room);
      offsets.push([-1,.65,-.35,1,-.7][i%5]*amplitude+'px');return {el,width,first:i===0,center:(el.offsetLeft||i*unit)+width/2};});
    wall.cards.forEach((card,i)=>card.el.style.setProperty('--card-offset',offsets[i]));
    wall.lead=wall.viewportWidth/2-(wall.cards[0]?.center||0);
    wall.travel=Math.max(0,(wall.cards[wall.cards.length-1]?.center||0)-(wall.cards[0]?.center||0));
    for(const card of wall.cards)card.enterAt=wallEnterAt(r,wall.travel?Math.max(0,Math.min(1,(card.center+wall.lead-wall.viewportWidth*.70)/wall.travel)):0);
    wall.stillProgress=wallProgress(r);
    const rootRect=bounds(r,r.root),pathRect=bounds(r,wall.walker?.parentElement),figure=bounds(r,wall.walker);
    if(pathRect&&figure&&rootRect.height>0)wall.footGeometry={left:(pathRect.left-rootRect.left)/rootRect.width,width:pathRect.width/rootRect.width,y:(figure.bottom-rootRect.top)/rootRect.height};
    measureWalkPlan(r,pathRect,figure);
  }
  function wallImages(r) {
    if(run!==r)return;
    let waiting=false;
    const viewport=r.wall?.viewport,region=bounds(r,viewport),copy=r.core.cfg.IMAGE_LOADING.UI;
    if(region)for(const card of r.wall.cards||[]){
      const image=card.el.querySelector('.life-wall-photo img');if(!image)continue;
      const rect=bounds(r,card.el);
      // Transform-driven walls do not scroll a native viewport. Promote nearby
      // images explicitly, instead of relying on lazy-load heuristics.
      if(rect.right>=region.left-region.width*.5&&rect.left<=region.right+region.width*.5&&image.loading==='lazy')image.loading='eager';
      if(image.loading==='lazy')continue;
      const state=window.ImageResources.watch(image),ready=image.complete&&image.naturalWidth>0&&image.naturalHeight>0;
      const failed=state?.phase==='failed',button=card.el.querySelector('[data-life="photo-retry"]');
      if(button){button.hidden=ready;button.disabled=!failed;button.textContent=failed?copy.FAILED:copy.LOADING;}
      card.el.querySelector('.life-wall-photo').classList.toggle('is-loading',!ready);
      if(rect.right>region.left&&rect.left<region.right&&!ready)waiting=true;
    }
    if(waiting){r.root.classList.remove('is-entering','is-film-entering');r.filmEntryUntil=null;}
    if(waiting!==!!r.imageBlocked){r.imageBlocked=waiting;r.last=performance.now();r.root.classList.toggle('is-paused',held(r));if(waiting)r.audio?.pause();else if(!held(r))playMusic(r);}
  }
  function loadBackground(r,source) {
    const generation=r.backgroundGeneration=(r.backgroundGeneration||0)+1;
    r.backgroundFailed=false;r.root.querySelector('[data-life="images"]').hidden=true;
    if(!source){r.root.querySelector('.life-background').style.backgroundImage='';return;}
    window.ImageResources.load(source,{signal:r.imageAbort?.signal,ready:image=>{
      if(run!==r||generation!==r.backgroundGeneration)return;
      const current=r.root.querySelector('.life-background'),previous=r.root.querySelector('.life-background-previous');
      previous.style.backgroundImage=current.style.backgroundImage;previous.classList.remove('is-leaving');
      current.style.backgroundImage='url('+JSON.stringify(image.currentSrc||image.src)+')';
      if(!held(r)&&!r.reduced){void previous.offsetWidth;previous.classList.add('is-leaving');}
    }}).catch(()=>{if(run!==r||generation!==r.backgroundGeneration)return;r.backgroundFailed=true;r.root.querySelector('[data-life="images"]').hidden=false;});
  }
  const wallEnterAt=(r,progress)=>LifeTimeline.wallTimeAt(r.wallCues,progress);
  function walkGrid(cue) {
    const frames=Math.max(1,Math.min(12,Math.floor(number(cue.walkFrames,4))));
    const columns=Math.max(1,Math.min(12,Math.floor(number(cue.walkColumns,frames)))),rows=Math.max(1,Math.min(12,Math.floor(number(cue.walkRows,1))));
    return {frames:Math.min(frames,columns*rows),columns,rows,size:columns*100+'% '+rows*100+'%'};
  }
  function walkAspect(cue) {return Math.max(.3,Math.min(2,number(cue.walkAspect,.75)));}
  function wallHTML(r,cue) {
    const cards=wallCards(r,cue);
    const cardHTML=cards.map((card,index)=>{const key=card.milestone==='stage'?'stage_'+card.stage:card.milestone,mark=r.milestones[key]||{date:'日期未留存',achieved:false},photo=mark.achieved?asset(card.photo):'';
      const score=mark.record&&mark.record.score!=null&&Number.isFinite(Number(mark.record.score))?'<span class="life-wall-score">综合评审 '+integer(mark.record.score)+'</span>':'';
      return '<figure class="life-wall-card'+(!mark.achieved?' is-unrecorded':'')+'" data-milestone="'+esc(key)+'" style="--card-n:'+index+'">'+(photo?'<div class="life-wall-photo"><img src="'+esc(photo)+'" alt="'+esc(roleText(r.core,card.title))+'" draggable="false" loading="'+(index<2?'eager':'lazy')+'" decoding="async"><button type="button" data-life="photo-retry" hidden></button></div>':'<div class="life-wall-no-photo'+(!mark.achieved?' is-locked':'')+'"'+(mark.achieved?' aria-hidden="true"':' role="status"')+'>'+(mark.achieved?'✧':'未解锁')+'</div>')+'<figcaption><h2>'+esc(roleText(r.core,card.title||'一起走过的日子'))+'</h2><div class="life-wall-meta"><time'+(mark.at?' datetime="'+esc(mark.at)+'"':'')+'>'+esc(mark.achieved?mark.date:'未解锁')+'</time>'+score+'</div></figcaption></figure>';}).join('');
    const grid=walkGrid(cue),frames=grid.frames,sprite=asset(cue.sprite);
    /* [feature:life-body-appearance-html] */
    return '<div class="life-memorial"><div class="life-wall-heading"><small>'+esc(title(r.core))+'</small><h1>'+esc(roleText(r.core,cue.caption||'那些一起走过的日子'))+'</h1></div><div class="life-wall-viewport"><div class="life-wall-track"><div class="life-wall-cycle">'+cardHTML+'</div></div></div><div class="life-walking-path"><div class="life-path-reflection"></div><div class="life-walker" role="img" aria-label="'+esc(roleName(r.core))+' · '+esc(cue.age||'')+' 岁素体外观"><div class="life-walk-shadow"></div><div class="life-walk-sprite" style="--walk-frames:'+frames+';--walk-columns:'+grid.columns+';--walk-rows:'+grid.rows+';background-size:'+grid.size+';background-image:'+esc(sprite?'url('+JSON.stringify(sprite)+')':'none')+'"></div><i class="life-footstep"></i><i class="life-footstep"></i></div><span class="life-age-label">'+esc(cue.age||'')+' <small>岁素体外观 · '+esc(roleText(r.core,cue.text||'带着好奇，继续向前'))+'</small></span></div></div>';
    /* [/feature:life-body-appearance-html] */
  }
  const held=r=>r.dialogueHidden||r.paused||r.orientationBlocked||r.mediaBlocked||r.imageBlocked||r.pageSuspended||document.hidden;
  function walkClip(r,cue){return cue.walkVideo?{src:asset(cue.walkVideo),poster:asset(cue.walkPoster),fallback:asset(cue.walkFallback),duration:number(cue.walkDuration),aspect:number(cue.walkAspect,.75)}:(cfg(r.core).walkClips||{})[cue.age];}
  // Reserve the whole growth route up front. A new body owns its forward lane
  // permanently; fading the preceding body never subtracts that displacement.
  function measureWalkPlan(r,pathRect,figure){
    if(!r.wall?.walker)return;
    const width=Math.max(1,pathRect?.width||r.width||window.innerWidth||1280),height=figure?.height||Math.max(1,r.height||window.innerHeight||720)*.22;
    const offsets=new Map();let offset=0,prior=null,firstHalf=0,lastHalf=0;
    for(const cue of r.wallCues){const clip=walkClip(r,cue),key=clip?.src||'sprite:'+cue.sprite+':'+cue.age,half=height*number(clip?.aspect,walkAspect(cue))/width*50;
      if(!prior)firstHalf=half;else if(prior.key!==key)offset+=(prior.half+half+2)*.5;
      offsets.set(cue.id,offset);prior={key,half};lastHalf=half;
    }
    const start=Math.max(12,firstHalf+3),end=100-lastHalf-4;
    const weights=r.wallCues.map(c=>({start:walkMotion(r,c.start).time,end:walkMotion(r,c.end).time,pace:wallPace(c)}));
    r.walkPlan={offsets,start,travel:Math.max(0,end-start-offset),lastOffset:offset,weights,total:weights.reduce((n,c)=>n+(c.end-c.start)*c.pace,0)};
  }
  function walkOffset(r,cue){return r.walkPlan?.offsets.get(cue?.id)??(cue?.walkMode==='stop'?r.walkPlan?.lastOffset||0:0);}
  const walkMotion=(r,time=r.elapsed)=>LifeTimeline.walkMotion(r.wallCues,r.walkStop,number(cfg(r.core).audioStartAt),time);
  function walkProgress(r){
    const clock=walkMotion(r).time,total=r.walkPlan?.total||0;
    return total?Math.max(0,Math.min(1,r.walkPlan.weights.reduce((n,c)=>n+Math.max(0,Math.min(c.end-c.start,clock-c.start))*c.pace,0)/total)):1;
  }
  function renderWalkMedia(r,media,motion,seek){
    // Zero freezes the current decoded frame, rather than switching to an
    // unrelated resting poster. Native rates below 1/16 are not portable.
    const rate=Math.max(.0625,Math.round(motion.rate*16)/16);if(Math.abs(number(media.video.playbackRate,1)-rate)>.0001)try{media.video.playbackRate=rate;}catch(_){}
    const audio=r.audio,musicWaiting=audio&&r.elapsed>=Math.max(0,number(cfg(r.core).audioStartAt))&&r.elapsed<audioEnd(r)&&!r.audioEnded&&(!r.audioPlaying||audio.paused||audio.seeking||audio.readyState<2);
    /* [feature:life-curtain-media-running] */
    const presenting=!!r.introTransition?.awaitingFrame;
    media.render({time:motion.time,paused:held(r)||motion.parked||!presenting&&(musicWaiting||!!r.introTransition&&!filmUnderCurtain(r)),reduced:r.reduced||r.cue.motion==='none',seek});
    /* [/feature:life-curtain-media-running] */
  }
  function syncMedia(r,seek=false){
    const cue=r.cue;if(!cue)return;
    const motion=walkMotion(r);
    if(r.walkMedia)renderWalkMedia(r,r.walkMedia,motion,seek);
    if(r.walkOutgoing){
      const old=r.walkOutgoing,age=Math.max(0,r.visualClock-old.at),e=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
      renderWalkMedia(r,old.media,motion,seek);
      old.host.style.opacity=String(1-e((age-.7)/1.2));
      r.wall.walker.style.opacity=String(e(age/.8));
      if(age>=1.9)clearOutgoing(r);
    }
    if(r.closeupMedia&&cue.endingStyle==='video'){
      const media=r.closeupMedia,external=r.paused||r.orientationBlocked||r.pageSuspended||document.hidden;
      // Decoder readiness can hold the film clock, but must never hold its own
      // play request. Otherwise canplay -> seek -> buffering repeats forever.
      media.render({time:Math.max(0,r.elapsed-cue.start),paused:external,seek});
      const finished=media.video.ended||media.video.currentTime>=cue.duration-.08;
      r.mediaBlocked=!media.failed()&&!finished&&(!media.ready()||!external&&!media.playing());if(r.mediaBlocked&&r.audio&&!r.audio.paused)r.audio.pause();
      if(!r.closeupShown&&media.ready()&&media.playing()&&media.firstFrameReady?.()!==false){r.closeupShown=true;r.closeupRevealAt=Math.max(0,r.elapsed-cue.start);}
    }
    r.root.classList.toggle('is-media-buffering',!!r.mediaBlocked&&!r.paused&&!r.orientationBlocked&&!r.pageSuspended&&!document.hidden);
    r.root.classList.toggle('is-paused',held(r));
    const veil=r.root.querySelector('.life-media-veil');if(!veil)return;
    const local=Math.max(0,r.elapsed-cue.start),ease=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};let alpha=0,color='#f7fcff';
    if(cue.type==='wall'&&cue.walkMode==='stop'){const white=Math.min(cue.duration,Math.max(.1,number(cue.whiteFade,3)));alpha=ease((local-Math.max(0,cue.duration-white))/white);}
    if(cue.endingStyle==='video'){
      const white=number(cue.whiteFade,1.15),start=Math.max(0,cue.duration-white);
      if(local>=start){color='#f7fcff';alpha=ease((local-start)/white);}else alpha=r.closeupShown?1-ease((local-(r.closeupRevealAt||0))/.65):1;
    }
    veil.style.backgroundColor=color;veil.style.opacity=String(alpha);
  }
  function clearOutgoing(r){
    r.walkOutgoing?.media.destroy();r.walkOutgoing?.host.remove();r.walkOutgoing=null;
    if(r.wall?.walker)r.wall.walker.style.opacity='';r.root.removeAttribute('data-age-transition');
  }
  function preloadHost(r){const host=document.createElement('div');host.className='life-media-preload';host.setAttribute('aria-hidden','true');r.root.appendChild(host);return host;}
  function prepareWalk(r,cue){
    const clip=cue&&walkClip(r,cue);if(!clip||!window.LifeVideo||clip.src===r.walkSource)return;
    if(r.preparedWalk?.src===clip.src)return;
    r.preparedWalk?.media.destroy();r.preparedWalk?.host.remove();const host=preloadHost(r);
    const media=LifeVideo.create({document,host,loop:true,...clip});
    media.render({time:walkMotion(r,cue.start).time,paused:true});r.preparedWalk={src:clip.src,media,host};
  }
  function prepareCloseup(r,cue){
    if(!cue||!window.LifeVideo)return null;const key=cue.id+'/'+asset(cue.video);
    if(r.preparedCloseup?.key===key)return r.preparedCloseup;
    r.preparedCloseup?.media.destroy();r.preparedCloseup?.host.remove();const host=preloadHost(r);
    const media=LifeVideo.create({document,host,src:asset(cue.video),poster:asset(cue.poster),duration:cue.duration,loop:false});
    media.render({time:0,paused:true});return r.preparedCloseup={key,media,host};
  }
  function attachMedia(r,cue,seek=false){
    const clip=cue.type==='wall'&&walkClip(r,cue),host=r.wall.walker;
    if(r.walkOutgoing&&(seek||cue.type!=='wall'))clearOutgoing(r);
    if(!clip||!host||!window.LifeVideo){r.walkMedia?.destroy();r.walkMedia=null;r.walkSource=null;}
    else if(r.walkSource!==clip.src||!r.walkMedia?.element.isConnected){
      if(r.walkMedia&&!seek&&!held(r)&&!r.reduced){
        clearOutgoing(r);
        const old=document.createElement('div');old.className='life-walker has-walk-video life-walk-outgoing';old.setAttribute('aria-hidden','true');old.style.cssText=host.style.cssText;old.style.aspectRatio=String(r.walkAspect||.75);old.appendChild(r.walkMedia.element);host.parentElement.appendChild(old);
        r.walkOutgoing={media:r.walkMedia,host:old,at:r.visualClock,offset:r.walkOffset||0};host.style.opacity='0';r.root.dataset.ageTransition='crossfade-ahead';
      }else r.walkMedia?.destroy();
      const prepared=r.preparedWalk?.src===clip.src?r.preparedWalk:null;
      r.walkMedia=prepared?prepared.media:LifeVideo.create({document,host,loop:true,...clip});
      if(prepared){host.appendChild(prepared.media.element);prepared.host.remove();r.preparedWalk=null;}
      r.walkSource=clip.src;r.walkDuration=clip.duration;r.walkAspect=clip.aspect;host.style.aspectRatio=String(clip.aspect||walkAspect(cue));host.classList.add('has-walk-video');
    }
    r.walkOffset=walkOffset(r,cue);
    if(cue.endingStyle!=='video'){r.closeupMedia?.destroy();r.closeupMedia=null;r.mediaBlocked=false;}
    else if(window.LifeVideo){
      r.closeupMedia?.destroy();const prepared=prepareCloseup(r,cue);r.closeupMedia=prepared.media;r.preparedCloseup=null;r.root.querySelector('.life-closeup-screen').appendChild(r.closeupMedia.element);prepared.host.remove();r.closeupShown=seek&&r.elapsed-cue.start>.1;r.closeupRevealAt=r.closeupShown?0:null;
      const media=r.closeupMedia;r.mediaBlocked=!media.ready();if(r.mediaBlocked)r.audio?.pause();
      for(const event of ['loadeddata','canplay','playing','waiting','error'])media.video.addEventListener(event,()=>{if(run!==r||r.closeupMedia!==media)return;const was=r.mediaBlocked;r.last=performance.now();syncMedia(r);if(was&&!r.mediaBlocked&&!held(r))playMusic(r);});
    }
    r.root.classList.toggle('has-closeup-video',cue.endingStyle==='video');r.root.classList.toggle('has-final-caption',cue.endingStyle==='white');syncMedia(r,seek);
  }
  function orientation(r){
    /* 2026-10-16 用户要求：剧情对话阶段同样要求横屏 —— 此前只有非对白 cue 才拦竖屏
       （r.cue.type!=='dialogue'），对白可以在竖屏下继续；现在对白（含开场对白）也一并拦。 */
    const was=r.orientationBlocked,portrait=window.innerHeight>window.innerWidth;
    r.softwareLandscape=!!r.landscapeAccepted&&portrait;
    const width=r.softwareLandscape?window.innerHeight:window.innerWidth,height=r.softwareLandscape?window.innerWidth:window.innerHeight;
    r.host.classList.toggle('is-rotated',r.softwareLandscape);r.host.style.width=width+'px';r.host.style.height=height+'px';
    r.root.style.setProperty('--life-vw',width/100+'px');r.root.style.setProperty('--life-vh',height/100+'px');
    const modes={portrait:height>width||width<=640,'portrait-700':height>width&&height<=700,'portrait-740':height>width&&height<=740,'short-650':height<=650,'landscape-460':width>=height&&height<=460,'landscape-500':width>=height&&height<=500,compact:width<=640,'short-480':height<=480,landscape:width>=height};
    for(const [mode,active] of Object.entries(modes))r.root.classList.toggle('life-layout-'+mode,active);
    r.orientationBlocked=cfg(r.core).forceLandscape!==false&&!!r.cue&&portrait&&!r.landscapeAccepted;
    r.root.classList.toggle('needs-landscape',r.orientationBlocked);r.root.querySelector('.life-rotate-gate').hidden=!r.orientationBlocked;r.last=performance.now();
    if(r.orientationBlocked){r.audio?.pause();r.introAudio?.pause();}else if(was&&!held(r)){playMusic(r);playIntro(r);}
    r.root.classList.toggle('is-paused',held(r));syncMedia(r);
  }
  function farewellHTML(r,cue) {
    const white=cue.endingStyle==='white',sprite=asset(cue.sprite);
    const framing=' style="object-fit:'+(cue.fit==='cover'?'cover':'contain')+';object-position:'+number(cue.focusX,50)+'% '+number(cue.focusY,100)+'%"';
    const caption=roleText(r.core,cue.caption||''),copy=white?caption.split('\n').map((line,i)=>'<span class="life-farewell-line" data-caption-line="'+i+'">'+esc(line)+'</span>').join('\n'):esc(caption);
    return '<div class="life-farewell'+(white?' is-white':'')+'">'+(!white&&sprite?'<div class="life-farewell-portrait"><img src="'+esc(sprite)+'" alt="'+esc(roleName(r.core))+'" draggable="false"'+framing+'></div>':'')+'<div class="life-farewell-copy"><small>'+esc(roleText(r.core,cue.speaker||'小鲸鱼'))+'</small><h1>'+copy+'</h1>'+(cue.text?'<p>'+esc(roleText(r.core,cue.text))+'</p>':'')+'</div></div>';
  }
  function captionLines(r,label){
    r.captionLines=[];if(!label)return;
    if(!label.querySelector('.life-farewell-line')){const nodes=[...label.childNodes],fragment=document.createDocumentFragment();let line=null,index=0;
      for(const node of nodes){if(node.nodeType===3&&/\n/.test(node.textContent)){fragment.appendChild(node);line=null;index++;continue;}if(!line){line=document.createElement('span');line.className='life-farewell-line';line.dataset.captionLine=String(index);fragment.appendChild(line);}line.appendChild(node);}label.replaceChildren(fragment);}
    r.captionLines=[...label.querySelectorAll('.life-farewell-line')];
  }
  function eligible(c) {
    if(!c||!c.state||cfg(c).enabled===false||!timeline(c).length)return false;
    const s=c.state,r=s.result||((s.stageMarks||{})[finalStage(c)]);
    return s.ver===finalStage(c)&&['bonus','over'].includes(s.phase)&&r&&['pass','excellent','top'].includes(r.verdict)&&!r.retry&&!r.missionFail&&!(s.mission&&s.mission.hit===false);
  }
  function saved(c) {
    const s=c.state;
    // Keep the once-watched entitlement before an edition migration replaces
    // progress. Never invent a date for historical completion without one.
    const watched=recallRecord(c);if(watched&&watched!==s.lifeFinaleWatched)s.lifeFinaleWatched={status:'watched',at:validDate(watched.completedAt||watched.at)?watched.completedAt||watched.at:null,legacy:true,version:watched.version||1,stage:watched.stage||'V5.5'};
    if(!s.lifeFinale||typeof s.lifeFinale!=='object'||Array.isArray(s.lifeFinale))s.lifeFinale={version:edition(c),stage:finalStage(c),status:'pending',cueId:null,elapsed:0};
    else if(number(s.lifeFinale.version,1)!==edition(c)||markedStage(c,s.lifeFinale)!==finalStage(c)){
      const prior=s.lifeFinale;s.lifeFinale={version:edition(c),stage:finalStage(c),status:'pending',cueId:null,elapsed:0,previous:{version:prior.version||1,stage:prior.stage||'V5.5',status:prior.status,completedAt:prior.completedAt||null,...(prior.completionReason!=null?{completionReason:prior.completionReason,watchIncomplete:!!prior.watchIncomplete}:{})}};
    }
    return s.lifeFinale;
  }
  function persist(r,force=false) {
    if(r.replay||r.state!==r.core.state)return;
    const now=Date.now();if(!force&&now-r.savedAt<2000)return;r.savedAt=now;
    const p=saved(r.core);p.status='playing';p.cueId=r.cue&&r.cue.id;p.elapsed=Math.max(0,r.elapsed);p.cueElapsed=r.cue?Math.max(0,r.elapsed-r.cue.start):0;p.watchIncomplete=!!r.watchIncomplete;
    p.dialogueOffset=r.cue&&r.cue.type==='dialogue'?(r.dialogueStart||0)+r.typed:null;
    p.dialogueCursor=r.cue&&r.cue.type==='dialogue'?{start:r.dialogueStart||0,typed:r.typed}:null;
    const voice=r.voice?.status();p.dialogueVoice=r.cue?.type==='dialogue'&&voice?.src?{src:voice.src,time:voice.time,ended:voice.state==='ended',finishedFor:voice.finishedFor}:null;
    p.copyCursors=Object.fromEntries((r.copyReaders||[]).filter(x=>x.pages.length>1).map(x=>[x.key,{start:x.starts[x.page]}]));
    if(window.GameSave&&GameSave.autoSave)GameSave.autoSave(r.state);
  }
  function completed(c) {const p=c&&c.state&&c.state.lifeFinale;return !!(p&&p.status==='complete'&&number(p.version,1)===edition(c)&&markedStage(c,p)===finalStage(c));}
  function validDate(v){return typeof v==='string'&&v.length>0&&!Number.isNaN(Date.parse(v));}
  function recallRecord(c){
    const s=c?.state;if(!s)return null;const explicit=s.lifeFinaleWatched;
    if(explicit&&typeof explicit==='object'&&!Array.isArray(explicit)&&explicit.status==='watched'&&(validDate(explicit.at)||explicit.legacy===true))return explicit;
    let p=s.lifeFinale;const seen=new Set();for(let depth=0;p&&typeof p==='object'&&!Array.isArray(p)&&depth<12&&!seen.has(p);depth++,p=p.previous){seen.add(p);
      if(p.completionReason==null&&(p.status==='complete'||validDate(p.completedAt)))return p;
      if(p.completionReason==='watched'&&validDate(p.completedAt))return p;
    }return null;
  }
  function canRecall(c=ui.core){return !!recallRecord(c);}
  function graphHTML(rows) {
    const known=rows.filter(x=>!x.missing&&Number.isFinite(x.score));if(known.length<2)return '';
    const max=Math.max(1,...known.map(x=>x.score)),points=known.map((x,i)=>({record:x,x:22+i*316/Math.max(1,known.length-1),y:82-number(x.score)/max*60}));
    const path=points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
    return '<figure class="life-real-chart" aria-label="真实历程评分趋势"><svg viewBox="0 0 360 108" role="img"><title>已保存阶段的综合评审分</title><path class="life-chart-grid" d="M22 22H338 M22 52H338 M22 82H338"/><path class="life-chart-area" d="'+path+' L338 82 L22 82 Z"/><path class="life-chart-line" d="'+path+'"/>'+points.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5"/><text x="'+p.x+'" y="100" text-anchor="middle">'+esc(p.record.ver)+'</text>').join('')+'</svg><figcaption>每一步，都是你们真实走过的路</figcaption></figure>';
  }
  function memoryHTML(r,stage) {
    const rows=r.records, target=rows.find(x=>x.ver===stage), known=rows.filter(x=>!x.missing), max=Math.max(1,...known.map(x=>x.score||0));
    if(stage==='all'||!stage)return '<div class="life-memory-heading"><small>一路走来的真实记录</small><h2>'+integer(known.length)+' 个阶段</h2></div>'+graphHTML(rows)+'<div class="life-history-bars">'+rows.map(x=>'<div class="life-history-row"><span>'+esc(x.ver)+'</span><i><em style="--fill:'+Math.max(2,number(x.score)/max*100)+'%"></em></i><b>'+(x.missing?'—':integer(x.score))+'</b></div>').join('')+'</div><p class="life-memory-note">每一次认真，都留在这里。</p>';
    if(!target||target.missing)return '<div class="life-memory-heading"><small>'+esc(stage)+'</small><h2>一路同行</h2></div><p class="life-memory-note">旧存档未保存这一阶段的首次记录。<br>那些一起走过的时光，依然是故事的一部分。</p>';
    const past=known.filter(x=>rows.indexOf(x)<=rows.indexOf(target));
    return '<div class="life-memory-heading"><small>'+esc(target.ver)+' · '+(target.first?'第一次通过':'已保存的阶段成绩')+'</small><h2>'+esc(target.name||'小鲸鱼')+'</h2><time>'+esc(target.date)+'</time></div><div class="life-score"><b>'+integer(target.score)+'</b><span>综合评审分</span></div><div class="life-memory-stats"><div><b>'+integer(target.week)+'</b><span>训练周数</span></div><div><b>'+integer(target.team)+'</b><span>并肩伙伴</span></div><div><b>'+integer(target.users)+'</b><span>累计用户</span></div></div>'+graphHTML(past)+'<div class="life-history-bars">'+past.slice(-5).map(x=>'<div class="life-history-row"><span>'+esc(x.ver)+'</span><i><em style="--fill:'+Math.max(2,number(x.score)/max*100)+'%"></em></i><b>'+integer(x.score)+'</b></div>').join('')+'</div>';
  }
  function cueAt(r) {let current=null;for(const c of r.primary){if(c.start<=r.elapsed)current=c;else break;}return current;}
  function audioAt(r,cue) {return Math.max(0,cue&&cue.audioAt!=null&&cue.audioAt!==''?number(cue.audioAt)+Math.max(0,r.elapsed-cue.start):number(cfg(r.core).audioOffset)+r.elapsed-number(cfg(r.core).audioStartAt));}
  function audioEnd(r){const f=cfg(r.core);return f.audioDuration!=null&&f.audioDuration!==''?Math.max(0,number(f.audioStartAt))+Math.max(.1,number(f.audioDuration)):Infinity;}
  function seekMusic(r) {
    if(!r.audio)return;
    const offset=audioAt(r,r.cue);
    r.audioEnded=false;
    try{r.audio.currentTime=Math.min(offset,Number.isFinite(r.audio.duration)?Math.max(0,r.audio.duration-.1):offset);}catch(e){}
  }
  function preloadMusic(r) {
    if(r.audio)return;
    const src=asset(cfg(r.core).bgm);if(!src)return;
    r.audio=document.createElement('audio');r.audio.dataset.lifeAudio='film';r.audio.src=src;r.audio.preload='auto';r.audio.loop=false;r.root.appendChild(r.audio);
    r.audio.addEventListener('loadedmetadata',()=>{if(run===r&&r.audioStarted)seekMusic(r);});
    r.audio.addEventListener('playing',()=>{if(run===r&&(held(r)||r.copyHold)){r.audio.pause();return;}if(run===r&&!held(r)){r.audioPlaying=true;r.audioError=false;r.musicBlocked=false;r.last=performance.now();r.root.querySelector('[data-life="music"]').hidden=true;}});
    for(const event of ['waiting','pause'])r.audio.addEventListener(event,()=>{r.audioPlaying=false;});
    r.audio.addEventListener('ended',()=>{r.audioPlaying=false;r.audioEnded=true;});
    r.audio.addEventListener('error',()=>{if(run===r){r.audioPlaying=false;r.audioError=true;const b=r.root.querySelector('[data-life="music"]');b.hidden=false;b.textContent='重试音乐';b.title='音乐加载失败，点击重试。演出会保留当前位置。';}});
    r.audio.volume=Math.max(0,Math.min(1,number(window.AudioMgr&&AudioMgr.musicVol,.6)));
    try{r.audio.load();}catch(e){}
  }
  function ownOfficeMusic(r) {
    if(r.musicOwned)return;r.musicOwned=true;
    const m=window.AudioMgr;
    if(m){r.oldBgm=(m.cur&&m.cur.url)||(m.want&&m.want.url)||null;m.seq=(m.seq||0)+1;m.want=null;if(m.stopBgm)m.stopBgm();}
  }
  function introMusic(r) {
    if(r.introAudio||!r.cue||r.cue.type!=='dialogue'||r.elapsed>=Math.max(0,number(cfg(r.core).audioStartAt)))return;
    // An empty intro track now means silence: the former fallback to the main
    // song made "clear the field" impossible to express (owner decision 2026-10-09).
    const src=asset(cfg(r.core).introBgm);if(!src)return;
    ownOfficeMusic(r);
    const a=r.introAudio=document.createElement('audio');a.dataset.lifeAudio='intro';a.src=src;a.preload='auto';a.loop=true;a.volume=Math.max(0,Math.min(1,number(window.AudioMgr&&AudioMgr.musicVol,.6)));r.root.appendChild(a);
    a.addEventListener('playing',()=>{if(run===r){r.introError=false;if(!r.audioStarted)r.root.querySelector('[data-life="music"]').hidden=true;}});
    a.addEventListener('error',()=>{if(run===r&&!r.audioStarted){r.introError=true;const b=r.root.querySelector('[data-life="music"]');b.hidden=false;b.textContent='重试音乐';}});
    try{a.load();}catch(e){}playIntro(r);
  }
  function playIntro(r) {
    if(!r.introAudio||r.introFinished||held(r)||r.copyHold)return;
    const attempt=r.introAttempt=(r.introAttempt||0)+1;
    const p=r.introAudio.play();if(p&&p.catch)p.catch(()=>{if(run===r&&attempt===r.introAttempt&&!r.audioStarted){const b=r.root.querySelector('[data-life="music"]');b.hidden=false;}});
  }
  function updateIntro(r,dt) {
    if(!r.introAudio||r.introFinished)return;
    const t=r.introTransition,timing=LifeTimeline.prologueTiming(r.reduced);
    if(!t||t.kind==='entry')return;
    const progress=Math.min(1,Math.max(0,(r.visualClock-t.at)/timing.fadeOut));
    r.introAudio.volume=Math.max(0,Math.min(1,number(window.AudioMgr&&AudioMgr.musicVol,.6)))*(1-progress);
    if(progress>=1){r.introFinished=true;r.introAudio.pause();}
  }
  function music(r,cue) {
    /* [feature:life-curtain-music-start] */
    if(r.introTransition&&!filmUnderCurtain(r)||r.audioStarted||r.elapsed<Math.max(0,number(cfg(r.core).audioStartAt))||r.elapsed>=audioEnd(r))return;
    /* [/feature:life-curtain-music-start] */
    preloadMusic(r);if(!r.audio)return;
    r.audioStarted=true;
    ownOfficeMusic(r);
    seekMusic(r);
    playMusic(r);
  }
  function playMusic(r) {
    /* [feature:life-curtain-music-play] */
    if(!r.audio||!r.audioStarted||held(r)||r.copyHold||r.introTransition&&!filmUnderCurtain(r)||r.elapsed>=audioEnd(r))return;
    /* [/feature:life-curtain-music-play] */
    const attempt=r.playAttempt=(r.playAttempt||0)+1;
    const p=r.audio.play();if(p&&p.then)p.then(()=>{if(run===r&&attempt===r.playAttempt&&!held(r)&&!r.copyHold&&!r.audio.paused&&r.audio.readyState>=2){r.audioPlaying=true;r.musicBlocked=false;r.last=performance.now();}},()=>{if(run===r&&attempt===r.playAttempt&&!held(r)&&!r.copyHold){r.audioPlaying=false;r.musicBlocked=true;const b=r.root.querySelector('[data-life="music"]');if(b)b.hidden=false;}});
  }
  function journeyHTML(r,cue,narration='') {
    const sprite=asset(cue.sprite),cutout=cue.fit==='contain'||/\/(growth|character)\//.test(sprite),focus=number(cue.focusX,50)+'% '+number(cue.focusY,50)+'%';
    return '<article class="life-journey'+(cutout?' is-cutout':'')+'"><div class="life-chapter-label">'+esc(roleText(r.core,cue.journeyTitle||'小鲸鱼的旅途'))+'</div>'+(sprite?'<div class="life-photo-frame"><div class="life-growth-halo" aria-hidden="true"></div><img src="'+esc(sprite)+'" alt="'+esc(roleText(r.core,cue.rightCaption||cue.caption||'小鲸鱼成长的片段'))+'" draggable="false" style="object-fit:'+(cue.fit==='cover'?'cover':'contain')+';object-position:'+focus+'"></div>':'<div class="life-photo-missing"><span aria-hidden="true">✧</span></div>')+'<div class="life-journey-copy"><p>'+esc(roleText(r.core,cue.rightCaption||cue.caption||''))+'</p>'+narration+'</div></article>';
  }
  function sceneHTML(r,cue) {
    const sprite=asset(cue.sprite),body=roleText(r.core,cue.text),narration=body?'<p class="life-cue-narration">'+esc(body)+'</p>':'';
    const framing=' style="object-fit:'+(cue.fit==='cover'?'cover':'contain')+';object-position:'+number(cue.focusX,50)+'% '+number(cue.focusY,50)+'%"';
    if(cue.type==='wall')return wallHTML(r,cue);
    if(cue.endingStyle==='video')return '<div class="life-video-slate" aria-label="'+esc(roleName(r.core))+' · 微笑"></div>';
    if(cue.type==='ending'&&['portrait','white'].includes(cue.endingStyle))return farewellHTML(r,cue);
    if(cue.type==='dialogue')return '<div class="life-vn-character">'+(sprite?'<img src="'+esc(sprite)+'" alt="'+esc(roleName(r.core))+'" draggable="false"'+framing+'>':'')+'</div><div class="life-dialogue-box"><span class="life-speaker">'+esc(/^(鲸鱼娘|小鲸鱼|\{whale\})$/.test(cue.speaker||'鲸鱼娘')?roleName(r.core):roleText(r.core,cue.speaker))+'</span><p class="life-dialogue-text"></p><small class="life-dialogue-hint">轻触任意空白处继续 <span aria-hidden="true">▸</span></small><small class="life-dialogue-page" hidden></small></div>';
    if(cue.type==='ending')return '<div class="life-ending-figure">'+(sprite?'<img src="'+esc(sprite)+'" alt="'+esc(roleName(r.core))+'" draggable="false"'+framing+'>':'')+'</div><div class="life-ending-orbits" aria-hidden="true"><i></i><i></i><i></i></div><div class="life-ending-copy"><small>'+esc(title(r.core))+'</small><h1 class="life-ending-title">'+Array.from(roleText(r.core,cue.caption||'感谢你陪伴小鲸鱼成长')).map((x,i)=>'<span style="--i:'+i+'">'+esc(x)+'</span>').join('')+'</h1><p>'+esc(body||'每一段新的旅途，都从你们的陪伴开始。')+'</p></div>';
    if(cue.type==='caption')return '<div class="life-film-title"><small>'+esc(title(r.core))+'</small><h1>'+esc(roleText(r.core,cue.caption||cue.text))+'</h1>'+(cue.caption?narration:'')+'</div>';
    if(cue.type==='effect')return '<div class="life-light-burst" aria-hidden="true"><i></i><i></i><i></i></div>';
    const memory='<article class="life-memory"><div class="life-chapter-label">'+esc(roleText(r.core,cue.leftCaption||'你的研发历程'))+'</div>'+memoryHTML(r,cue.stage)+(cue.type==='memory'?narration:'')+'</article>';
    const journey=journeyHTML(r,cue,narration);
    return '<div class="'+(cue.type==='split'?'life-split':'life-single')+'">'+(cue.type==='memory'?memory:cue.type==='journey'?journey:memory+journey)+'</div>';
  }
  function renderLayers(r,skipReading=false) {
    const active=r.list.filter(c=>c.track!=='scene'&&c.start<=r.elapsed&&r.elapsed<c.end),key=active.map(c=>c.id+'@'+c.index).join('|');
    if(key===r.layerKey)return;r.layerKey=key;r.layers=active;
    r.root.querySelector('.life-aux-layers').innerHTML=active.map(c=>{const content={...c,type:c.track==='memory'?'memory':c.track==='journey'?'journey':c.track==='caption'?'caption':'effect'};return '<div class="life-aux-clip life-aux-'+c.track+'" data-layer-id="'+esc(c.id)+'" data-camera="'+esc(c.camera||'still')+'" data-transition="'+esc(c.transition||'dissolve')+'" data-motion="'+esc(c.motion||'fade')+'">'+(c.background?'<div class="life-layer-background" style="background-image:url('+esc(JSON.stringify(c.background))+');background-position:'+number(c.focusX,50)+'% '+number(c.focusY,50)+'%" aria-hidden="true"></div>':'')+sceneHTML(r,content)+'</div>';}).join('');
    r.root.classList.toggle('has-memory-layer',active.some(c=>c.track==='memory'));r.root.classList.toggle('has-journey-layer',active.some(c=>c.track==='journey'));
    if(!skipReading)readCopies(r);
  }
  function paintCopy(reader) {
    if(!reader.layout){reader.node.innerHTML=reader.html;delete reader.node.dataset.copyPage;delete reader.node.dataset.copyPages;return;}
    reader.node.innerHTML='<span class="life-reader-text">'+esc(reader.pages[reader.page])+'</span><small class="life-copy-page">正文 '+(reader.page+1)+' / '+reader.pages.length+'</small>';
    reader.node.dataset.copyPage=String(reader.page+1);reader.node.dataset.copyPages=String(reader.pages.length);
  }
  function nextLabel(r) {return r.cue?.type==='dialogue'?'继续 ▸':r.cue?.type==='ending'&&r.cue===r.primary[r.primary.length-1]?'留住这段回忆':'下一幕 ▸';}
  function readCopies(r,cursors={},reflow=false) {
    const existing=new Map((r.copyReaders||[]).filter(x=>x.node.isConnected).map(x=>[x.node,x])),readers=[];
    const nodes=r.root.querySelectorAll('.life-scene .life-memory>.life-cue-narration,.life-scene .life-journey-copy,.life-aux-layers .life-memory>.life-cue-narration,.life-aux-layers .life-journey-copy');
    for(const node of nodes){
      let reader=existing.get(node);const panel=node.closest('article'),layer=node.closest('[data-layer-id]'),key=(layer?'aux:'+layer.dataset.layerId:'scene')+':'+(panel.classList.contains('life-memory')?'memory':'journey');
      if(reader&&!reflow){readers.push(reader);continue;}
      const offset=reader?reader.starts[reader.page]:Math.max(0,number(cursors[key]&&cursors[key].start));
      if(!reader)reader={node,panel,key,html:node.innerHTML,text:panel.classList.contains('life-memory')?node.textContent:[...node.querySelectorAll('p')].map(x=>x.textContent).filter(Boolean).join('\n\n')};
      node.innerHTML=reader.html;node.classList.remove('life-readable-copy');panel.classList.remove('has-readable-pages');node.style.removeProperty('height');node.style.removeProperty('max-height');
      const style=getComputedStyle(node),font=parseFloat(style.fontSize)||14,line=parseFloat(style.lineHeight)||font*1.8;
      const copyWidth=()=>{const s=getComputedStyle(node);return Math.max(80,(bounds(r,node).width||Math.min(760,(r.width||window.innerWidth||390)-72))-(parseFloat(s.paddingLeft)||0)-(parseFloat(s.paddingRight)||0));};let width=copyWidth();
      const probe=document.createElement('span');probe.className='life-copy-measure';probe.setAttribute('aria-hidden','true');probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;display:block;white-space:pre-wrap;overflow-wrap:anywhere;width:'+width+'px;font:'+style.font+';font-size:'+font+'px;line-height:'+line+'px;letter-spacing:'+style.letterSpacing+';';panel.appendChild(probe);
      const room=()=>{const b=bounds(r,panel),n=bounds(r,node),h=panel.clientHeight||b.height||(r.height||window.innerHeight||844)*(panel.closest('.life-split')?.31:.67),panelStyle=getComputedStyle(panel),padding=(parseFloat(panelStyle.paddingBottom)||16)+(parseFloat(panelStyle.paddingTop)||16);let left=h-Math.max(0,n.top-b.top)-(parseFloat(panelStyle.paddingBottom)||16)-22;
        if(panel.classList.contains('has-readable-pages')){left=h-padding-22;if(panel.classList.contains('life-memory'))for(const child of panel.children){const s=getComputedStyle(child);if(child!==node&&child!==probe&&s.display!=='none')left-=(bounds(r,child).height||0)+(parseFloat(s.marginTop)||0)+(parseFloat(s.marginBottom)||0);}}
        return Math.max(line,Math.min(h*.5-22,left));};
      let available=room();probe.textContent=reader.text;
      const estimate=Math.ceil(Array.from(reader.text).length/Math.max(1,Math.floor(width/font*.85)))*line;
      const fullHeight=bounds(r,probe).height||estimate;
      let pages=[reader.text];reader.layout=fullHeight>available+1;
      if(reader.layout){
        node.classList.add('life-readable-copy');panel.classList.add('has-readable-pages');node.textContent='';available=room();width=copyWidth();probe.style.width=width+'px';
        const chars=Array.from(reader.text);pages=[];
        for(let start=0;start<chars.length;){let end=Math.min(chars.length,start+Math.max(1,Math.floor(width/font*.85)*Math.max(1,Math.floor(available/line))));probe.textContent=chars.slice(start,end).join('');
          if(bounds(r,probe).height>available+1){let lo=start+1,hi=end;while(lo<hi){const mid=Math.ceil((lo+hi)/2);probe.textContent=chars.slice(start,mid).join('');if(bounds(r,probe).height<=available+1)lo=mid;else hi=mid-1;}end=lo;}
          pages.push(chars.slice(start,end).join(''));start=end;
        }
      }
      probe.remove();reader.pages=pages.length?pages:[''];reader.starts=[];let start=0;for(const p of reader.pages){reader.starts.push(start);start+=p.length;}reader.page=0;while(reader.page<reader.pages.length-1&&reader.starts[reader.page+1]<=offset)reader.page++;
      node.classList.toggle('life-readable-copy',reader.layout);panel.classList.toggle('has-readable-pages',reader.layout);
      if(reader.layout){node.style.height=available+22+'px';node.style.maxHeight=available+22+'px';}paintCopy(reader);readers.push(reader);
    }
    const wasHeld=r.copyHold;r.copyReaders=readers;r.copyHold=readers.some(x=>x.pages.length>1);
    r.root.classList.toggle('is-reading-copy',r.copyHold);if(r.copyHold){r.audio?.pause();r.introAudio?.pause();}
    else if(wasHeld){playMusic(r);playIntro(r);}
    if(r.copyHold)r.root.querySelector('[data-life="next"]').textContent=readers.some(x=>x.page<x.pages.length-1)?'继续阅读 ▸':nextLabel(r);
  }
  function paintDialogue(r) {
    const p=r.root.querySelector('.life-dialogue-text');if(!p)return;
    const text=(r.pageText||'').slice(0,r.typed);if(p.textContent!==text)p.textContent=text;
    const label=r.root.querySelector('.life-dialogue-page'),page=(r.dialoguePage+1)+' / '+r.dialoguePages.length,hidden=r.dialoguePages.length<2;
    if(label.hidden!==hidden)label.hidden=hidden;if(label.textContent!==page)label.textContent=page;
    if(r.root.dataset.dialoguePage!==String(r.dialoguePage+1))r.root.dataset.dialoguePage=String(r.dialoguePage+1);if(r.root.dataset.dialoguePages!==String(r.dialoguePages.length))r.root.dataset.dialoguePages=String(r.dialoguePages.length);
  }
  function voiceState(r,status) {
    if(run!==r)return;r.root.dataset.dialogueVoice=status.state;
    const button=r.root.querySelector('[data-life="voice"]');if(!button)return;
    button.hidden=!status.src||r.cue?.type!=='dialogue';
    button.textContent=status.state==='failed'?'重试配音':status.state==='blocked'?'播放配音':'重播配音';
    button.title=status.state==='failed'?'配音暂时无法播放，自动模式会继续显示文字。点击重试。':status.state==='blocked'?'浏览器需要一次点击才能播放配音。':'重新播放当前这句配音';
  }
  function startVoice(r,cue,cursor) {
    if(!window.LifeDialogueVoice)return;
    if(!r.voice)r.voice=LifeDialogueVoice.create({document,host:r.root,onState:status=>voiceState(r,status)});
    r.voice.sync(held(r)||!!r.copyHold||!!r.introTransition);
    const src=cue?.type==='dialogue'?asset(cue.voice):'',saved=cursor?.src===src?cursor:null;
    r.voice.start(src,{time:saved?.time,ended:saved?.ended,finishedFor:saved?.finishedFor});
  }
  function dialoguePage(r,index,typed=0) {
    r.dialoguePage=Math.max(0,Math.min(r.dialoguePages.length-1,index));r.pageText=r.dialoguePages[r.dialoguePage]||'';
    r.dialogueStart=r.dialoguePages.slice(0,r.dialoguePage).reduce((n,p)=>n+p.length,0);r.typed=Math.min(r.pageText.length,Math.max(0,typed));r.cueWall=r.typed/32;r.pageWait=0;paintDialogue(r);
  }
  function paginateDialogue(r,offset=0,cursor=null) {
    const p=r.root.querySelector('.life-dialogue-text');if(!p)return;
    const style=getComputedStyle(p),font=parseFloat(style.fontSize)||18,line=parseFloat(style.lineHeight)||font*1.7;
    const width=bounds(r,p).width||Math.max(160,Math.min(1000,(r.width||window.innerWidth||390)-64));
    const available=Math.max(line*2,Math.min(line*9,parseFloat(style.maxHeight)||(r.height||window.innerHeight||844)*.18));
    const lines=Math.max(2,Math.floor(available/line));r.root.style.setProperty('--dialogue-lines',String(lines));
    // A constant reading slot keeps the actor and dialogue panel still while
    // letters appear and consecutive sentences have different line counts.
    const slot=lines*line+'px';r.root.style.setProperty('--dialogue-text-height',slot);p.style.height=slot;p.style.minHeight=slot;
    const budget=Math.max(12,Math.floor(width/font*.92)*lines),chars=Array.from(r.fullText),pages=[];
    const probe=document.createElement('p');probe.className='life-dialogue-text life-dialogue-measure';probe.setAttribute('aria-hidden','true');
    probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:'+width+'px;height:auto;max-height:none;overflow:visible;margin:0;font-size:'+font+'px;line-height:'+line+'px;';
    r.root.querySelector('.life-dialogue-box').appendChild(probe);
    for(let at=0;at<chars.length;){
      let end=Math.min(chars.length,at+budget);probe.textContent=chars.slice(at,end).join('');
      if(bounds(r,probe).height>available+1){let lo=at+1,hi=end;while(lo<hi){const mid=Math.ceil((lo+hi)/2);probe.textContent=chars.slice(at,mid).join('');if(bounds(r,probe).height<=available+1)lo=mid;else hi=mid-1;}end=lo;}
      if(end<chars.length){for(let split=end;split>at+Math.floor((end-at)*.75);split--)if(/[。！？；\n]/.test(chars[split-1])){end=split;break;}}
      pages.push(chars.slice(at,end).join(''));at=end;
    }
    probe.remove();r.dialoguePages=pages.length?pages:[''];let page=0,start=0;
    // The absolute text offset alone cannot distinguish the end of one page
    // from the unread start of the next. Keep that intent through save/resize,
    // while old saves without a cursor retain their completed-page behavior.
    const pageBeginning=cursor&&Number.isInteger(cursor.start)&&cursor.start>=0&&cursor.typed===0&&cursor.start===offset;
    while(page<r.dialoguePages.length-1&&(start+r.dialoguePages[page].length<offset||pageBeginning&&start+r.dialoguePages[page].length===offset)){start+=r.dialoguePages[page].length;page++;}
    dialoguePage(r,page,offset-start);
  }
  function renderCue(r,cue,options={}) {
    r.textDissolve?.destroy();r.textDissolve=null;
    r.captionLines=[];
    const previousCue=r.cue,previousPose=dialoguePose(r);r.cue=cue;r.typed=0;r.cueWall=0;r.fullText=roleText(r.core,cue&&cue.text);r.particles=[];
    const root=r.root;root.dataset.type=cue.type;root.dataset.motion=cue.motion||'fade';root.dataset.cue=cue.id;root.dataset.transition=cue.transition||'dissolve';root.dataset.camera=cue.camera||'still';root.dataset.endingStyle=cue.endingStyle||'';
    root.classList.toggle('is-intro-dialogue',introDialogue(r,cue));
    const bg=backgroundAsset(r,cue),sprite=asset(cue.sprite);
    const sameDialogue=previousCue?.type==='dialogue'&&cue.type==='dialogue'&&dialogueVisualKey(r,previousCue)===dialogueVisualKey(r,cue);
    root.classList.toggle('is-dialogue-continuing',sameDialogue);
    if(cue.type==='dialogue')setDialogueCamera(r,cue,sameDialogue,previousPose);
    const background=root.querySelector('.life-background'),previous=root.querySelector('.life-background-previous');
    background.style.backgroundPosition=number(cue.focusX,50)+'% '+number(cue.focusY,50)+'%';
    if(bg!==r.background){r.background=bg;loadBackground(r,bg);}
    // 开场对白段默认铺整块黑幕，.is-intro-dialogue 会连 .life-background 一起隐藏；
    // 但作者明确为某段指定了背景图时，编辑器监看照常显示这张图。这里只在「开场对白 + 有背景图」时
    // 单独恢复背景层（其余装饰层仍保持黑场），让运行时与编辑器一致，而不是整屏黑。
    if(introDialogue(r,cue)&&bg){background.style.display='block';background.style.visibility='visible';}
    else{background.style.removeProperty('display');background.style.removeProperty('visibility');}
    effectCue(r);
    const scene=root.querySelector('.life-scene');
    const priorPortrait=scene.querySelector('.life-farewell-portrait>img'),priorWalker=scene.querySelector('.life-walk-sprite');
    const oldPortrait=priorPortrait&&priorPortrait.getAttribute('src'),oldWalk=priorWalker&&{image:priorWalker.style.backgroundImage,position:priorWalker.style.backgroundPosition,size:priorWalker.style.backgroundSize,aspect:walkAspect(previousCue||{})};
    const wallKey=cue.type==='wall'?JSON.stringify(wallCards(r,cue)):null;
    const keepWall=wallKey!=null&&wallKey===r.wallKey&&scene.querySelector('.life-memorial');
    const keepDialogue=previousCue?.type==='dialogue'&&cue.type==='dialogue'&&scene.querySelector('.life-dialogue-box');
    if(keepDialogue){
      const character=scene.querySelector('.life-vn-character');let img=character.querySelector('img');
      if(sprite){if(!img){img=document.createElement('img');img.draggable=false;character.appendChild(img);}if(img.getAttribute('src')!==sprite)img.setAttribute('src',sprite);img.alt=roleName(r.core);img.style.objectFit=cue.fit==='cover'?'cover':'contain';img.style.objectPosition=number(cue.focusX,50)+'% '+number(cue.focusY,100)+'%';}else img?.remove();
      const speaker=scene.querySelector('.life-speaker'),name=/^(鲸鱼娘|小鲸鱼|\{whale\})$/.test(cue.speaker||'鲸鱼娘')?roleName(r.core):roleText(r.core,cue.speaker);if(speaker.textContent!==name)speaker.textContent=name;
    }else if(keepWall){
      scene.querySelector('.life-wall-heading h1').textContent=roleText(r.core,cue.caption||'那些一起走过的日子');
      /* [feature:life-body-appearance-label] */
      scene.querySelector('.life-age-label').innerHTML=esc(cue.age||'')+' <small>岁素体外观 · '+esc(roleText(r.core,cue.text||'带着好奇，继续向前'))+'</small>';
      /* [/feature:life-body-appearance-label] */
      /* [feature:life-body-appearance-a11y] */
      scene.querySelector('.life-walker').setAttribute('aria-label',roleName(r.core)+' · '+(cue.age||'')+' 岁素体外观');
      /* [/feature:life-body-appearance-a11y] */
      priorWalker.style.backgroundImage=sprite?'url('+JSON.stringify(sprite)+')':'none';
      const grid=walkGrid(cue);priorWalker.style.setProperty('--walk-frames',String(grid.frames));priorWalker.style.setProperty('--walk-columns',String(grid.columns));priorWalker.style.setProperty('--walk-rows',String(grid.rows));priorWalker.style.backgroundSize=grid.size;
      scene.querySelectorAll('.life-walk-previous').forEach(el=>el.remove());
    }else scene.innerHTML=sceneHTML(r,cue);
    if(cue.endingStyle==='white'&&window.LifeTextDissolve){const label=scene.querySelector('.life-farewell-copy h1');if(label)r.textDissolve=LifeTextDissolve.create({document,host:scene,textElement:label});}
    if(cue.endingStyle==='white')captionLines(r,scene.querySelector('.life-farewell-copy h1'));
    const walkingFigure=scene.querySelector('.life-walker');if(walkingFigure)walkingFigure.style.aspectRatio=String(walkAspect(cue));
    if(cue.type==='wall'&&!r.preview&&!r.replay&&r.core.state===r.state&&window.WhaleGallery)window.WhaleGallery.unlockMemorial(r.core,wallCards(r,cue),r.milestones);
    r.wallKey=wallKey;
    if(!r.paused&&!r.reduced&&cue.motion!=='none'){
      const portrait=scene.querySelector('.life-farewell-portrait'),walker=scene.querySelector('.life-walker');
      if(portrait&&oldPortrait&&oldPortrait!==asset(cue.sprite)){const previous=document.createElement('img');previous.src=oldPortrait;previous.alt='';previous.setAttribute('aria-hidden','true');previous.className='life-farewell-previous';portrait.appendChild(previous);portrait.classList.add('is-crossfading');}
      if(walker&&oldWalk&&oldWalk.image&&oldWalk.image!==scene.querySelector('.life-walk-sprite').style.backgroundImage){const previous=document.createElement('div');previous.className='life-walk-previous';previous.setAttribute('aria-hidden','true');previous.style.backgroundImage=oldWalk.image;previous.style.backgroundPosition=oldWalk.position;previous.style.backgroundSize=oldWalk.size;previous.style.aspectRatio=String(oldWalk.aspect);previous.style.width=oldWalk.aspect/walkAspect(cue)*100+'%';previous.style.left='50%';previous.style.right='auto';previous.style.translate='-50% 0';walker.appendChild(previous);}
    }
    if(!keepWall){r.wall={cycle:scene.querySelector('.life-wall-cycle'),viewport:scene.querySelector('.life-wall-viewport'),track:scene.querySelector('.life-wall-track'),walker:scene.querySelector('.life-walker'),sprite:scene.querySelector('.life-walk-sprite'),width:0};measureWall(r);}
    r.wall.stillProgress=wallProgress(r);wallImages(r);
    if(!keepWall&&r.wall.cycle)for(const image of r.wall.cycle.querySelectorAll('img'))image.addEventListener('load',()=>{if(run===r&&image.isConnected){measureWall(r);updateVisuals(r);}},{once:true});
    attachMedia(r,cue,!!options.seek);orientation(r);
    if(r.wall.walker)r.wall.walker.classList.toggle('is-stopped',cue.walkMode==='stop');
    const flash=root.querySelector('.life-transition-flash');if(!sameDialogue){flash.classList.remove('is-triggered');if(cue.transition==='flash'&&!r.paused&&!r.reduced){void flash.offsetWidth;flash.classList.add('is-triggered');}}
    root.querySelector('.life-top-caption').textContent=roleText(r.core,cue.caption)||title(r.core);
    root.querySelector('.life-chapter-index').textContent=String(r.primary.indexOf(cue)+1).padStart(2,'0')+' / '+String(r.primary.length).padStart(2,'0');
    root.querySelector('[data-life="next"]').textContent=nextLabel(r);
    root.querySelector('[data-life="auto"]').hidden=cue.type!=='dialogue';
    root.querySelector('[data-life="dialogue"]').hidden=cue.type!=='dialogue';
    if(cue.type!=='dialogue')setDialogueHidden(r,false);
    if(cue.type==='dialogue'){paginateDialogue(r,number(options.dialogueOffset),options.dialogueCursor);introMusic(r);}
    startVoice(r,cue,options.dialogueVoice);
    if(cue.type==='wall'&&(!previousCue||previousCue.type!=='wall')&&!r.paused&&!r.reduced){r.filmEntryUntil=r.visualClock+1.2;root.classList.add('is-film-entering');}
    if(window.SFX&&cue.type!=='dialogue'&&cue.type!=='wall'&&!cue.endingStyle)SFX.play(cue.type==='ending'?'fanfare':'float',{vol:.22});
    renderLayers(r,true);readCopies(r,options.copyCursors||{},true);
    const alreadyStarted=r.audioStarted;
    music(r,cue);
    if(r.audio&&alreadyStarted&&(options.seek||cue.audioAt!=null&&cue.audioAt!==''))seekMusic(r);
    updateVisuals(r);drawEffect(r,!!options.seek);
    persist(r,true);
  }
  function renderWaiting(r) {
    r.voice?.start('');
    r.textDissolve?.destroy();r.textDissolve=null;
    r.cue=null;r.effectHost.hidden=true;r.root.dataset.backgroundEffect='';r.root.dataset.type='waiting';r.root.dataset.cue='';r.root.dataset.motion='none';r.root.querySelector('.life-scene').innerHTML='';
    r.root.querySelector('.life-top-caption').textContent=title(r.core);r.root.querySelector('.life-chapter-index').textContent='';renderLayers(r);
    r.root.querySelector('[data-life="auto"]').hidden=true;r.root.querySelector('[data-life="next"]').textContent='开始演出 ▸';persist(r,true);
  }
  function dissolve(r) {
    if(r.reduced||r.cue.motion==='none')return;
    if(r.dissolved===r.cue.id)return;r.dissolved=r.cue.id;
    const label=r.root.querySelector('.life-ending-title');if(!label)return;
    const cr=bounds(r,r.canvas),rect=bounds(r,label);
    // Bound the particles and draw real glyph pixels instead of random confetti.
    const off=document.createElement('canvas'),w=Math.min(900,Math.max(1,Math.round(rect.width))),h=Math.max(1,Math.round(rect.height));off.width=w;off.height=h;
    const ctx=off.getContext&&off.getContext('2d');if(ctx){const style=getComputedStyle(label);ctx.fillStyle='#9fe9ff';ctx.font='700 '+style.fontSize+' '+style.fontFamily;ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(label.textContent,w/2,h/2,w);try{
      const pixels=ctx.getImageData(0,0,w,h).data,candidates=[];
      for(let y=0;y<h;y+=5)for(let x=0;x<w;x+=5)if(pixels[(y*w+x)*4+3]>60)candidates.push([x,y]);
      const stride=Math.max(1,Math.ceil(candidates.length/160));for(let i=0;i<candidates.length;i+=stride){const [x,y]=candidates[i];r.particles.push({x:rect.left-cr.left+x*rect.width/w,y:rect.top-cr.top+y,vx:(Math.random()-.35)*45,vy:-20-Math.random()*45,age:0});}
    }catch(e){}}
    label.classList.add('is-dissolving');
  }
  function draw(r,dt) {
    drawEffect(r);
    const ctx=r.context;if(!ctx)return;const width=r.width,height=r.height;
    if(introDialogue(r,r.cue)){if(r.canvasDirty){ctx.clearRect(0,0,width,height);r.canvasDirty=false;}return;}
    const active=r.particles.length||(!r.reduced&&r.cue?.endingStyle!=='white'&&r.cue?.endingStyle!=='video'&&!starLake(r,r.cue));
    if(!active){if(r.canvasDirty){ctx.clearRect(0,0,width,height);r.canvasDirty=false;}return;}
    ctx.clearRect(0,0,width,height);r.canvasDirty=true;
    if(!r.reduced&&(!r.cue||r.cue.motion!=='none')&&r.cue?.endingStyle!=='white'&&!starLake(r,r.cue)){ctx.fillStyle='#9de5ff';r.stars.forEach(p=>{const x=(p.x*width+Math.sin(r.visualClock*.15+p.y*6)*8),y=(p.y*height-r.visualClock*3+height*20)%height;ctx.globalAlpha=.15+.35*(.5+.5*Math.sin(r.visualClock+p.x*8));ctx.beginPath();ctx.arc(x,y,p.radius,0,Math.PI*2);ctx.fill();});
      // A few travelling threads connect the two histories; no per-frame DOM or allocation.
      ctx.strokeStyle='#9bdcfa';ctx.lineWidth=.8;
      for(let i=0;i<4;i++){const t=(r.visualClock*.035+i*.25)%1,x=t*width,y=height*(.28+i*.12)+Math.sin(t*Math.PI)*30;ctx.globalAlpha=Math.sin(t*Math.PI)*.17;ctx.beginPath();ctx.moveTo(x-45,y+14);ctx.quadraticCurveTo(x-20,y,x,y);ctx.stroke();}
    }
    r.particles.forEach(p=>{p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=8*dt;ctx.globalAlpha=Math.max(0,1-p.age/3);ctx.fillStyle='#74d8ff';ctx.fillRect(p.x,p.y,2.5,2.5);});ctx.globalAlpha=1;
  }
  // Only the opening contiguous dialogue belongs to the black prologue. Later
  // authored dialogue keeps its own scenery, and direct film seeks stay direct.
  function introDialogue(r,cue) {const index=r.primary.indexOf(cue);return index>=0&&index<r.introCount;}
  /* [feature:life-curtain-running-clock] */
  // The covered scene is already the actual film. Its timeline, main music
  // and decoded walk frames start together; only the curtain keeps fading.
  function filmUnderCurtain(r) {return !!r.introTransition&&r.introTransition.kind!=='entry'&&r.introTransition.switchedAt!=null;}
  /* [/feature:life-curtain-running-clock] */
  function paintIntroCurtain(r) {
    const t=r.introTransition;if(!r.introCurtain)return;
    if(!t){r.introCurtain.style.opacity='0';delete r.root.dataset.introTransition;return;}
    const timing=LifeTimeline.prologueTiming(r.reduced);
    const p=Math.max(0,Math.min(1,t.kind==='entry'?(r.visualClock-t.at)/timing.entry:t.switchedAt==null?(r.visualClock-t.at)/timing.fadeOut:t.revealAt==null?1:1-(r.visualClock-t.revealAt)/timing.fadeIn));
    r.introCurtain.style.opacity=String(p*p*(3-2*p));
    r.root.dataset.introTransition=t.kind==='entry'?'entry':t.switchedAt==null?'out':t.revealAt==null||p===1?'covered':'in';
  }
  function advanceIntroCurtain(r) {
    const t=r.introTransition;if(!t)return false;
    const timing=LifeTimeline.prologueTiming(r.reduced);
    if(t.kind==='entry'){
      if(r.visualClock-t.at<timing.entry){paintIntroCurtain(r);return true;}
      r.introTransition=null;r.root.classList.remove('is-prologue-entry');r.elapsed=t.next.start;
      renderCue(r,t.next,{seek:true});paintIntroCurtain(r);return true;
    }
    if(t.switchedAt==null){
      if(r.visualClock-t.at<timing.fadeOut){paintIntroCurtain(r);return true;}
      // Even an immediately skipped prologue prepares off the animation frame.
      // Hold the opaque curtain until its exact native-size bakes are ready.
      if(starLake(r,t.next)){
        prepareStar(r);const renderer=r.starCompositor;
        if(renderer?.prepare&&renderer.inspect?.().ready===false){
          r.introCurtain.style.opacity='1';
          if(!t.preparing){t.preparing=true;renderer.prepare({width:r.width,height:r.height}).then(()=>{if(run===r&&r.introTransition===t)t.preparing=false;}).catch(()=>{if(run===r&&r.introTransition===t)t.prepareFailed=true;});}
          if(!t.prepareFailed)return true;
        }
      }
      // Set a fully opaque curtain before building/warming the original scene.
      /* [feature:life-curtain-switch-note] */
      // Film time and the main soundtrack start with this covered switch.
      /* [/feature:life-curtain-switch-note] */
      t.switchedAt=r.visualClock;r.introCurtain.style.opacity='1';
      r.elapsed=t.next.start;renderCue(r,t.next,{seek:true});t.awaitingFrame=!r.reduced&&r.cue.motion!=='none'&&!!r.walkMedia?.firstFrameReady;t.firstFrameWaitAt=r.visualClock;return true;
    }
    // The native decoder can report "playing" before its first moving frame
    // reaches the compositor. Keep the cut opaque until that frame arrives.
    if(t.awaitingFrame){if(r.walkMedia?.firstFrameReady?.()===false&&r.visualClock-t.firstFrameWaitAt<1){paintIntroCurtain(r);return true;}t.awaitingFrame=false;syncMedia(r,true);}
    if(t.revealAt==null){
      if(r.visualClock-t.switchedAt<timing.hold){paintIntroCurtain(r);return true;}
      t.revealAt=r.visualClock;
    }
    if(r.visualClock-t.revealAt>=timing.fadeIn){r.introTransition=null;paintIntroCurtain(r);syncMedia(r,true);music(r,r.cue);}
    return true;
  }
  function starLake(r,cue) {
    if(!cue||introDialogue(r,cue)||['white','video'].includes(cue.endingStyle))return false;
    const explicit=cue.backgroundEffect||'',effect=explicit||cfg(r.core).backgroundEffect||'star-lake';
    // Explicit/film none takes precedence over legacy migration. A per-cue
    // star-lake overrides film none; ordinary authored pictures stay pictures.
    return effect==='star-lake'&&(explicit==='star-lake'||!asset(cue.background)||legacyLake(cue));
  }
  function legacyLake(cue) {return /\/lake_moon_bg\.(png|webp|jpe?g)$/i.test(String(cue&&cue.background||''));}
  function backgroundAsset(r,cue) {
    // The old built-in bitmap is retired even when vectors are turned off.
    return cue?.endingStyle==='white'||legacyLake(cue)||starLake(r,cue)?'':asset(cue?.background);
  }
  function effectCue(r) {
    const enabled=starLake(r,r.cue);r.root.dataset.backgroundEffect=enabled?'star-lake':'';r.effectHost.hidden=!enabled;
    if(enabled)prepareStar(r);
    drawEffect(r);
  }
  function prepareStar(r) {
    if(r.starLake||!window.LifeStarLake)return;
    r.starLake=LifeStarLake.create(document);
    if(window.LifeStarCompositor&&window.Path2D){r.starCompositor=LifeStarCompositor.create(document,{source:r.starLake});r.effectHost.appendChild(r.starCompositor.element);}
    else r.effectHost.appendChild(r.starLake.element);
  }
  function prepareWallPhotos(r) {
    if(r.wallPhotoPreloads)return;
    // Only the two eager opening cards are decoded during the black prologue.
    // Keep later cards lazy and retain these images until this run is closed.
    r.wallPhotoPreloads=wallCards(r,r.wallCues[0]||{}).slice(0,2).filter(card=>r.milestones[card.milestone==='stage'?'stage_'+card.stage:card.milestone]?.achieved).map(card=>asset(card.photo)).filter(Boolean).map(src=>{
      const image=document.createElement('img');image.decoding='async';image.src=src;
      image.decode?.().catch(()=>{});return image;
    });
  }
  function warmStar(r) {
    if(!r.introCount||!r.primary.some(c=>starLake(r,c)))return;
    // The black prologue stays black. Build its later scenery after the first
    // paint while the player reads, rather than at the curtain's covered cut.
    const warm=()=>{
      r.starWarm=null;if(run!==r)return;prepareWallPhotos(r);prepareWalk(r,r.wallCues[0]);prepareStar(r);const renderer=r.starCompositor||r.starLake;
      const input={width:r.width,height:r.height,time:0,seek:true,paused:true,reduced:r.reduced};
      const paint=ready=>{if(ready&&run===r&&r.effectHost.hidden&&r.width===input.width&&r.height===input.height)renderer.render(input);};
      if(renderer?.prepare)renderer.prepare(input).then(paint).catch(()=>{});else paint(true);
    };
    r.starWarm=window.requestIdleCallback?{idle:true,id:window.requestIdleCallback(warm,{timeout:1500})}:{idle:false,id:setTimeout(warm,100)};
  }
  function drawEffect(r,seek=false) {
    if(!r.starLake||r.effectHost.hidden)return;
    const audio=r.audioStarted?r.audio:introDialogue(r,r.cue)?r.introAudio:null;
    const music=audio&&audio.readyState>=2&&window.LifeMusicPulse?LifeMusicPulse.sample({src:audio.currentSrc||audio.src,time:audio.currentTime}):null;
    const input={time:r.visualClock,width:r.width,height:r.height,music,footsteps:r.footsteps||[],seek,reduced:r.reduced||r.cue?.motion==='none',paused:held(r)};
    (r.starCompositor||r.starLake).render(input);
    if(r.starCompositor?.element.hidden){if(!r.starLake.element.isConnected)r.effectHost.prepend(r.starLake.element);r.starLake.render(input);}
    else if(r.starCompositor&&r.starLake.element.isConnected)r.starLake.element.remove();
  }
  function dialogueVisualKey(r,cue) {
    const effect=starLake(r,cue),background=backgroundAsset(r,cue);
    return JSON.stringify([effect?'effect:star-lake':background,asset(cue.sprite),cue.fit==='cover'?'cover':'contain',number(cue.focusX,50),number(cue.focusY,100),!effect&&background?number(cue.focusY,50):null,cue.motion==='none']);
  }
  function dialogueBounds(r,cue) {
    const key=dialogueVisualKey(r,cue);let first=r.primary.indexOf(cue),last=first;
    while(first>0&&r.primary[first-1].type==='dialogue'&&dialogueVisualKey(r,r.primary[first-1])===key)first--;
    while(last+1<r.primary.length&&r.primary[last+1].type==='dialogue'&&dialogueVisualKey(r,r.primary[last+1])===key)last++;
    return {first,last,start:r.primary[first].start,end:r.primary[last].end};
  }
  function cameraMode(cue) {return cue.camera||(cue.motion==='pan'?'push':'still');}
  function initialPose(mode) {return {scale:['pull','drift-left','drift-right'].includes(mode)?1.07:1,x:0,y:0};}
  function targetPose(mode) {return {scale:['push','drift-left','drift-right'].includes(mode)?1.07:1,x:mode==='drift-left'?-2.5:mode==='drift-right'?2.5:0,y:mode==='push'?-4:0};}
  function dialoguePose(r) {
    const c=r.dialogueCamera;if(!c)return null;let p=Math.max(0,Math.min(1,(c.seed+r.visualClock-c.at)/c.duration));
    if(c.ease)p=p*p*(3-2*p);
    return {scale:c.from.scale+(c.to.scale-c.from.scale)*p,x:c.from.x+(c.to.x-c.from.x)*p,y:c.from.y+(c.to.y-c.from.y)*p};
  }
  function setDialogueCamera(r,cue,continuing,previousPose) {
    const mode=cameraMode(cue),bounds=dialogueBounds(r,cue);let first=bounds.first,from=initialPose(cameraMode(r.primary[first])),groups=[];
    // An authored seek reconstructs each preceding camera endpoint. During a
    // live next-line click, use the pose actually on screen instead: reading
    // faster than a cue's duration must never snap to its authored endpoint.
    while(first<=bounds.last){let last=first;const groupMode=cameraMode(r.primary[first]);while(last<bounds.last&&cameraMode(r.primary[last+1])===groupMode)last++;
      const group={mode:groupMode,first,last,start:r.primary[first].start,end:r.primary[last].end,from,to:targetPose(groupMode),ease:groups.length>0};groups.push(group);from=group.to;first=last+1;}
    const index=r.primary.indexOf(cue),group=groups.find(g=>g.first<=index&&g.last>=index);
    if(continuing&&r.dialogueCamera?.mode===mode)return;
    r.dialogueCamera={mode,from:continuing&&previousPose?previousPose:group.from,to:group.to,at:r.visualClock,seed:continuing?0:Math.max(0,r.elapsed-group.start),duration:Math.max(.1,continuing?group.end-cue.start:group.end-group.start),ease:continuing||group.ease};
  }
  function poseTransform(p,mode) {
    if(mode==='still'&&p.scale===1&&!p.x&&!p.y)return '';
    return 'scale('+p.scale+') translateX('+p.x+'%) translateY('+p.y+'px)';
  }
  function cameraTransform(r,cue) {
    if(r.reduced||!cue||cue.motion==='none')return '';
    const camera=cue===r.cue&&cue.type==='dialogue'&&r.dialogueCamera;if(camera)return poseTransform(dialoguePose(r),camera.mode);
    const p=Math.max(0,Math.min(1,(r.elapsed-cue.start)/cue.duration)),mode=cameraMode(cue);
    if(mode==='push')return 'scale('+(1+p*.07)+') translateY('+(-p*4)+'px)';
    if(mode==='pull')return 'scale('+(1.07-p*.07)+')';
    if(mode==='drift-left')return 'scale(1.07) translateX('+(-p*2.5)+'%)';
    if(mode==='drift-right')return 'scale(1.07) translateX('+(p*2.5)+'%)';
    return '';
  }
  function updateVisuals(r) {
    syncMedia(r);
    paintIntroCurtain(r);
    if(r.textDissolve&&r.cue){const out=Math.min(1.8,r.cue.duration),local=r.elapsed-r.cue.start;r.textDissolve.render({progress:Math.max(0,Math.min(1,(local-(r.cue.duration-out))/out)),reduced:r.reduced||r.cue.motion==='none',paused:held(r)});}
    if(r.captionLines?.length){const local=Math.max(0,r.elapsed-r.cue.start);r.captionLines.forEach((line,i)=>{const u=r.reduced?1:Math.max(0,Math.min(1,(local-i*.85)/.85)),p=u*u*(3-2*u);line.style.opacity=String(p);line.style.transform='translateY('+((1-p)*8)+'px)';});}
    // A root custom property invalidates the whole inherited SVG/media tree.
    // Only the two-pixel progress bar consumes this clock.
    r.progress.style.setProperty('--life-progress',String(Math.max(0,Math.min(1,r.elapsed/r.total))));
    const entry=Math.max(0,Math.min(1,r.visualClock/1.2)),filmEntry=r.filmEntryUntil==null?1:Math.max(0,Math.min(1,1-(r.filmEntryUntil-r.visualClock)/1.2));
    if(entry>=1&&r.root.classList.contains('is-entering'))r.root.classList.remove('is-entering');
    if(filmEntry>=1&&r.root.classList.contains('is-film-entering'))r.root.classList.remove('is-film-entering');
    wallImages(r);
    const transform=cameraTransform(r,r.cue);r.root.querySelector('.life-background').style.transform=transform;
    if(r.cue&&r.cue.type==='wall'){
      const {cycle,track,walker,sprite,lead,travel}=r.wall,motion=walkMotion(r),film=motion.time,progress=wallProgress(r),still=r.reduced||r.cue.motion==='none'||motion.parked;
      const position=lead-(r.reduced||r.cue.motion==='none'?r.wall.stillProgress:progress)*travel;
      if(track&&cycle)track.style.transform='translateX('+position+'px)';
      for(const card of r.wall.cards||[]){const center=card.center+position,half=card.width/2,u=Math.max(0,Math.min(1,r.elapsed-card.enterAt)),entry=r.reduced||card.first?1:u*u*(3-2*u),exit=Math.max(0,Math.min(1,(center+half)/Math.max(1,half+r.wall.viewportWidth*.16))),visibility=r.reduced?1:Math.min(entry,exit);if(card.entry!==entry){card.entry=entry;card.el.style.setProperty('--card-entry',String(entry));}if(card.visibility!==visibility){card.visibility=visibility;card.el.style.setProperty('--card-visibility',String(visibility));}}
      const grid=walkGrid(r.cue),fps=Math.max(1,number(r.cue.walkFps,5));
      if(walker){const base=r.reduced?50:(r.walkPlan?.start||12)+walkProgress(r)*(r.walkPlan?.travel||0),position=base+(r.reduced?0:walkOffset(r,r.cue));walker.style.left=position+'%';walker.style.setProperty('--step',String(still?0:Math.sin(film*Math.PI*2*fps/grid.frames)));
        if(r.walkOutgoing)r.walkOutgoing.host.style.left=(base+r.walkOutgoing.offset)+'%';
        const period=r.walkDuration?r.walkDuration/2:grid.frames/fps/2,index=Math.floor(film/Math.max(.3,period));
        if(!still&&r.lastFootIndex!==index){r.lastFootIndex=index;r.footsteps=(r.footsteps||[]).filter(p=>r.visualClock-p.at<3.4);const g=r.wall.footGeometry||{left:0,width:1,y:.85};r.footsteps.push({at:r.visualClock,x:g.left+g.width*(position+(index%2?1:-1))/100,y:g.y,strength:.65,index});}
      }
      if(sprite&&!r.walkMedia){const frame=still?Math.max(0,Math.min(grid.frames-1,Math.floor(number(r.cue.walkRestFrame)))):Math.floor(film*fps)%grid.frames,x=frame%grid.columns,y=Math.floor(frame/grid.columns);sprite.dataset.frame=String(frame);sprite.style.backgroundSize=grid.size;sprite.style.backgroundPosition=(grid.columns>1?x*100/(grid.columns-1):0)+'% '+(grid.rows>1?y*100/(grid.rows-1):100)+'%';}
    }
    r.root.querySelectorAll('.life-scene .life-photo-frame img,.life-scene .life-vn-character img,.life-scene .life-ending-figure img,.life-scene .life-farewell-portrait>img:not(.life-farewell-previous)').forEach(img=>img.style.transform=transform);
    r.layers.forEach(c=>{const layer=[...r.root.querySelectorAll('[data-layer-id]')].find(x=>x.dataset.layerId===c.id);if(!layer)return;layer.style.setProperty('--clip-progress',String(Math.max(0,Math.min(1,(r.elapsed-c.start)/c.duration))));layer.querySelectorAll('.life-photo-frame img,.life-layer-background').forEach(img=>img.style.transform=cameraTransform(r,c));});
  }
  function next() {
    const r=run;if(!r||r.orientationBlocked||r.introTransition)return;
    const more=(r.copyReaders||[]).filter(x=>x.page<x.pages.length-1);if(more.length){more.forEach(x=>{x.page++;paintCopy(x);});r.root.querySelector('[data-life="next"]').textContent=(r.copyReaders||[]).some(x=>x.page<x.pages.length-1)?'继续阅读 ▸':nextLabel(r);persist(r,true);return;}
    if(!r.cue){if(!r.primary.length){close({complete:true});return;}r.elapsed=r.primary[0].start;renderCue(r,r.primary[0],{seek:true});return;}
    if(r.dialogueHidden){setDialogueHidden(r,false);return;}
    if(r.cue.type==='dialogue'&&r.typed<r.pageText.length){r.typed=r.pageText.length;paintDialogue(r);persist(r,true);return;}
    if(r.cue.type==='dialogue'&&r.dialoguePage<r.dialoguePages.length-1){dialoguePage(r,r.dialoguePage+1);persist(r,true);return;}
    const pos=r.primary.indexOf(r.cue);if(pos>=r.primary.length-1){if(armFinishPrompt(r,'manual'))return;close({complete:true,reason:'manual'});return;}
    if(introDialogue(r,r.cue)&&!introDialogue(r,r.primary[pos+1])){
      r.introTransition={next:r.primary[pos+1],at:r.visualClock,switchedAt:null};
      r.voice?.sync(true);
      r.root.querySelector('[data-life="next"]').textContent='转场中…';paintIntroCurtain(r);return;
    }
    if(!r.replay&&r.cue.type!=='dialogue'&&r.elapsed<r.cue.end-.02)r.watchIncomplete=true;
    r.elapsed=r.primary[pos+1].start;renderCue(r,r.primary[pos+1],{seek:true});
  }
  function setDialogueHidden(r,hidden){
    r.dialogueHidden=!!hidden;r.root.classList.toggle('is-dialogue-hidden',r.dialogueHidden);
    const button=r.root.querySelector('[data-life="dialogue"]'),labels=cfg(r.core).controls||{};
    if(button){button.textContent=labels[r.dialogueHidden?'showDialogue':'hideDialogue']||'';button.setAttribute('aria-pressed',String(r.dialogueHidden));}
    const box=r.root.querySelector('.life-dialogue-box');if(box)box.setAttribute('aria-hidden',String(r.dialogueHidden));
    r.root.classList.toggle('is-paused',held(r));r.last=performance.now();
    if(held(r)){r.audio?.pause();r.introAudio?.pause();}else{playMusic(r);playIntro(r);}
    r.voice?.sync(held(r)||!!r.copyHold||!!r.introTransition);syncMedia(r);
  }
  function pause(value) {
    const r=run;if(!r)return;r.paused=value==null?!r.paused:!!value;if(r.paused){r.root.classList.remove('is-entering','is-film-entering');r.filmEntryUntil=null;}r.last=performance.now();r.root.classList.toggle('is-paused',held(r));
    const b=r.root.querySelector('[data-life="pause"]');b.textContent=r.paused?'▶':'Ⅱ';b.setAttribute('aria-label',r.paused?'继续演出':'暂停演出');
    if(r.audio){if(held(r))r.audio.pause();else playMusic(r);}persist(r,true);
    if(r.introAudio){if(held(r))r.introAudio.pause();else playIntro(r);}
    r.voice?.sync(held(r)||!!r.copyHold||!!r.introTransition);syncMedia(r);drawEffect(r);
  }
  function frame(now) {
    const r=run;if(!r)return;if(r.state!==r.core.state||r.phase!==r.state.phase||r.ver!==r.state.ver){close();return;}
    if(r.cue?.type==='wall'){const next=r.wallCues.find(c=>c.start>r.elapsed&&c.start-r.elapsed<=8);if(next)prepareWalk(r,next);}
    if(r.walkStop&&r.cue?.type==='wall'&&r.elapsed>=r.walkStop.start-8){const next=r.primary.find(c=>c.endingStyle==='video'&&c.start>=r.walkStop.end-.01);if(next)prepareCloseup(r,next);}
    const dt=Math.max(0,Math.min(.1,(now-r.last)/1000));r.last=now;
    r.voice?.sync(held(r)||!!r.copyHold||!!r.introTransition);
    if(!held(r)){
      r.visualClock+=dt;
      const introHold=advanceIntroCurtain(r);
      if(r.introTransition?.kind==='entry'){r.raf=requestAnimationFrame(frame);return;}
      r.voice?.sync(held(r)||!!r.copyHold||!!r.introTransition);r.voice?.tick(dt,now);
      music(r,r.cue);
      /* [feature:life-curtain-frame-advance] */
      const musicStart=Math.max(0,number(cfg(r.core).audioStartAt)),introBlocked=introHold&&(!filmUnderCurtain(r)||r.introTransition.switchedAt===r.visualClock);let advance=r.copyHold||introBlocked?0:dt;
      /* [/feature:life-curtain-frame-advance] */
      // Reach the soundtrack's boundary exactly, then wait for real playback.
      // Metadata must not seek over time spent loading or awaiting permission.
      if(r.audio){
        /* [feature:life-curtain-audio-boundary] */
        if(!r.copyHold&&!introBlocked&&r.elapsed<musicStart&&r.elapsed+dt>=musicStart-1e-9)advance=musicStart-r.elapsed;
        /* [/feature:life-curtain-audio-boundary] */
        else if(r.elapsed>=musicStart&&r.elapsed<audioEnd(r)&&!r.audioEnded&&(!r.audioPlaying||r.audio.paused||r.audio.seeking||r.audio.readyState<2))advance=0;
      }
      r.cueWall+=advance;
      if(!r.cue)r.elapsed+=advance;
      else if(r.cue.type==='dialogue'){
        r.typed=Math.max(r.typed,Math.min(r.pageText.length,Math.floor(r.cueWall*32)));paintDialogue(r);
        r.elapsed=Math.min(r.cue.end-.01,r.elapsed+advance);
        if(r.auto&&!introHold&&r.typed===r.pageText.length){
          r.pageWait+=advance;
          if(r.dialoguePage<r.dialoguePages.length-1){if(r.pageWait>=1.6){dialoguePage(r,r.dialoguePage+1);persist(r,true);}}
          else {const voice=r.voice?.status(),voiced=!!voice?.src,waiting=voiced&&['loading','playing'].includes(voice.state),done=voiced&&voice.state==='ended'?r.voice.readyAfter(1):r.pageWait>=1.6;
            if(!waiting&&done&&(voiced||r.elapsed>=r.cue.end-.01))next();}
        }
      }else{
        r.elapsed+=advance;music(r,r.cue);
        if(!r.copyHold&&r.audio&&!r.audio.paused&&!r.audio.seeking&&r.audio.readyState>=2&&r.elapsed<audioEnd(r)){
          const anchor=r.cue.audioAt!=null&&r.cue.audioAt!==''?number(r.cue.audioAt):number(cfg(r.core).audioOffset)+r.cue.start-number(cfg(r.core).audioStartAt);
          const audioElapsed=r.cue.start+Math.max(0,r.audio.currentTime-anchor);
          if(Math.abs(audioElapsed-r.elapsed)>.2)r.elapsed=audioElapsed;
        }
      }
      music(r,r.cue);if(r.audio&&r.elapsed>=audioEnd(r)&&!r.audio.paused)r.audio.pause();
      /* [feature:life-curtain-completion-boundary] */
      if(r.introTransition&&r.elapsed>=r.total)r.elapsed=Math.max(0,r.total-.01);
      else if(r.elapsed>=r.total){r.elapsed=Math.max(0,r.total-.01);if(armFinishPrompt(r,'natural'))return;close({complete:true,reason:'natural'});return;}
      /* [/feature:life-curtain-completion-boundary] */
      const cue=cueAt(r);if(cue!==r.cue){if(cue)renderCue(r,cue);else renderWaiting(r);}renderLayers(r);
      const local=r.cue?Math.max(0,r.elapsed-r.cue.start):0;
      updateVisuals(r);
      if(r.cue&&r.cue.type==='ending'&&!r.cue.endingStyle&&local>=r.cue.duration-3)dissolve(r);
      if(r.audio){const base=Math.max(0,Math.min(1,number(window.AudioMgr&&AudioMgr.musicVol,.6))),end=Math.min(r.total,audioEnd(r)),seconds=number(cfg(r.core).fadeSeconds,3);const fade=seconds<=0?1:Math.min(1,Math.max(0,(end-r.elapsed)/Math.max(.1,seconds)));r.audio.volume=base*fade;}
      updateIntro(r,dt);
      // The lake compositor now repaints on every animation frame instead of the
      // former 30 fps cap (owner asked for >=60 fps; removing the rising light
      // spots freed the budget). The 8 ms gate still covers 60/75/90/120 Hz
      // screens up to 125 Hz, and skipped dt is accumulated so the dissolve
      // particles keep a true clock.
      r.drawDt=(r.drawDt||0)+dt;
      if(now-(r.lastVisualFrame||0)>=8){const step=r.drawDt;r.drawDt=0;r.lastVisualFrame=now;draw(r,step);}
      persist(r);
    }
    if(r.mediaBlocked&&!r.orientationBlocked&&!r.paused)syncMedia(r);
    wallImages(r);
    r.raf=requestAnimationFrame(frame);
  }
  function resize(r) {
    orientation(r);const b=bounds(r,r.root);r.width=Math.max(1,b.width||parseFloat(r.host.style.width));r.height=Math.max(1,b.height||parseFloat(r.host.style.height));const d=Math.min(1.5,window.devicePixelRatio||1);
    r.canvas.width=Math.round(r.width*d);r.canvas.height=Math.round(r.height*d);if(r.context)r.context.setTransform(d,0,0,d,0,0);
    measureWall(r);if(r.cue?.type==='dialogue')paginateDialogue(r,(r.dialogueStart||0)+r.typed,{start:r.dialogueStart||0,typed:r.typed});if(r.cue)readCopies(r,{},true);updateVisuals(r);drawEffect(r);
  }
  function open(options={}) {
    if(run)return false;const core=ui.core;if(!core||!core.state)return false;
    const preview=options.preview===true,replay=options.replay===true||preview,restart=options.restart===true&&!replay;
    if(!preview&&(replay?!canRecall(core):!eligible(core)))return false;
    if(!preview&&!replay&&!restart&&completed(core))return false;
    const list=timeline(core);if(!list.length)return false;
    const settingsPop=ui.el&&ui.el.querySelector('#settingsPop');if(settingsPop)settingsPop.remove();
    ui.hideTip?.();
    const old=replay||restart?null:saved(core);let elapsed=replay?Math.max(0,number(options.elapsed)):Math.max(0,number(old?.elapsed));
    if(restart){const p=saved(core);Object.assign(p,{status:'pending',cueId:null,elapsed:0,cueElapsed:0,watchIncomplete:false,completionReason:null,completedAt:null});}
    const resumed=!replay&&old?.status==='playing'&&list.find(x=>x.id===old.cueId);
    if(resumed)elapsed=resumed.start+Math.min(Math.max(0,resumed.duration-.01),Math.max(0,number(old.cueElapsed,elapsed-resumed.start)));
    const root=document.createElement('section');root.className='life-finale';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',title(core));
    root.innerHTML='<div class="life-background"></div><div class="life-background-previous"></div><div class="life-background-effect" aria-hidden="true" hidden></div><div class="life-atmosphere"></div><div class="life-cinema-light" aria-hidden="true"><i></i><i></i><i></i></div><div class="life-transition-flash" aria-hidden="true"></div><canvas class="life-particles" aria-hidden="true"></canvas><div class="life-closeup-screen"></div><div class="life-media-veil" aria-hidden="true"></div><div class="life-rotate-gate" role="status" hidden><div class="life-rotate-phone" aria-hidden="true">↻</div><h2>请旋转屏幕</h2><p>横屏观看，留住我们一起走过的每一步。</p><button type="button" data-life="landscape">进入横屏演出</button><small></small></div><header><div class="life-heading"><small>BLUE ENVELOPE</small><span class="life-top-caption"></span></div><div class="life-controls"><button type="button" data-life="music" hidden>开启音乐</button><button type="button" data-life="auto">自动</button><button type="button" data-life="pause" aria-label="暂停演出">Ⅱ</button><button type="button" data-life="skip">跳过</button></div></header><main class="life-scene"></main><div class="life-aux-layers"></div><footer><div class="life-progress"><i></i></div><span>'+esc(title(core))+'</span><span class="life-chapter-index"></span><button type="button" data-life="next">继续 ▸</button></footer>';
    window.ImageResources.install();
    const labels=cfg(core).controls||{};
    const gate=root.querySelector('.life-rotate-gate');gate.querySelector('small').textContent=labels.rotateHint;
    root.querySelector('.life-controls').insertAdjacentHTML('afterbegin','<button type="button" data-life="fullscreen">'+esc(labels.fullscreen)+'</button><button type="button" data-life="dialogue" aria-pressed="false">'+esc(labels.hideDialogue)+'</button><button type="button" data-life="voice" hidden>重播配音</button>');
    root.querySelector('.life-controls').insertAdjacentHTML('afterbegin','<button type="button" data-life="images" hidden>'+esc(core.cfg.IMAGE_LOADING.UI.RETRY)+'</button>');
    root.style.setProperty('--life-dialogue-opacity',String(Math.max(0,Math.min(1,number(cfg(core).dialoguePanelOpacity)))));
    const musicEnd=cfg(core).audioDuration!=null&&cfg(core).audioDuration!==''?Math.max(0,number(cfg(core).audioStartAt))+Math.max(.1,number(cfg(core).audioDuration)):0;
    const r={imageAbort:typeof AbortController==='function'?new AbortController():null,root,core,state:core.state,phase:core.state.phase,ver:core.state.ver,replay,preview,restart,watchIncomplete:!!old?.watchIncomplete,list,primary:list.filter(c=>c.track==='scene'),layers:[],layerKey:null,total:Math.max(musicEnd,...list.map(x=>x.end)),elapsed,last:performance.now(),visualClock:0,savedAt:0,paused:false,pageSuspended:false,auto:false,records:history(core.state),milestones:milestones(core.state),particles:[],stars:Array.from({length:72},()=>({x:Math.random(),y:Math.random(),radius:Math.random()*1.5+.3})),reduced:reduced(),audio:null,raf:null,release:null,previousFocus:document.activeElement,bodyOverflow:document.body.style.overflow};
    if(preview&&options.unlockMemories===true){
      // The cheat opens every configured photo only in this read-only film.
      // Real dates/scores stay intact; missing records are never invented.
      for(const cue of list.filter(c=>c.type==='wall'))for(const card of wallCards(r,cue)){
        const key=card.milestone==='stage'?'stage_'+card.stage:card.milestone;
        r.milestones[key]={...(r.milestones[key]||milestones({}).first_project),key,achieved:true};
      }
    }
    run=r;
    const introEnd=r.primary.findIndex(c=>c.type!=='dialogue');r.introCount=introEnd<0?r.primary.length:introEnd;
    r.introCurtain=document.createElement('div');r.introCurtain.className='life-intro-curtain';r.introCurtain.setAttribute('aria-hidden','true');root.appendChild(r.introCurtain);
    r.finishPrompt=document.createElement('div');r.finishPrompt.className='life-finish-prompt';r.finishPrompt.hidden=true;r.finishPrompt.innerHTML='<div class="life-finish-card" role="dialog" aria-modal="true" aria-label="演出结束"><small>BLUE ENVELOPE</small><h2>演出到这里，就全部结束了</h2><p>这一生已经收进回忆，随时可以在鲸鱼房回看。</p><div class="life-finish-actions"><button type="button" data-life="office">返回办公室</button><button type="button" data-life="replay-end">再看一遍</button></div></div>';root.appendChild(r.finishPrompt);
    r.wallCues=r.primary.filter(c=>c.type==='wall'&&c.walkMode!=='stop');
    const lastWalk=r.wallCues.at(-1);r.walkStop=lastWalk&&r.primary.find(c=>c.type==='wall'&&c.walkMode==='stop'&&c.start>=lastWalk.end-.01);
    root.classList.toggle('reduce-motion',r.reduced);
    if(!r.reduced)root.classList.add('is-entering');
    r.screenHost=document.createElement('div');r.screenHost.className='life-presentation-screen';r.host=document.createElement('div');r.host.className='life-presentation';r.host.appendChild(root);r.screenHost.appendChild(r.host);document.body.appendChild(r.screenHost);document.body.style.overflow='hidden';if(window.OfficePause)r.release=OfficePause.acquire(core,'life-finale');
    preloadMusic(r);
    r.progress=root.querySelector('.life-progress');r.canvas=root.querySelector('.life-particles');r.effectHost=root.querySelector('.life-background-effect');try{r.context=r.canvas.getContext('2d');}catch(e){r.context=null;}resize(r);
    r.resize=()=>resize(r);window.addEventListener('resize',r.resize);
    if(window.GameScreen){r.releaseScreen=GameScreen.hold(root);r.screen=GameScreen.presentation(r.screenHost,()=>{if(run===r)resize(r);});}
    root.onclick=e=>{e.stopPropagation();const btn=e.target.closest('[data-life]');if(!btn){if(r.cue?.type==='dialogue'&&!e.target.closest('button,a,input,textarea,select,[role="button"],.life-controls'))next();return;}
      if(['landscape','fullscreen'].includes(btn.dataset.life)){
        if(btn.dataset.life==='landscape'){r.landscapeAccepted=true;resize(r);}
        r.screen?.request().then(requested=>{if(run===r&&!requested&&ui.toast)ui.toast((cfg(core).controls||{}).fullscreenFailed);});return;
      }
      if(btn.dataset.life==='images'){loadBackground(r,r.background);return;}
      if(btn.dataset.life==='photo-retry'){const image=btn.parentElement.querySelector('img');if(image)window.ImageResources.retry(image);wallImages(r);return;}
      if(btn.dataset.life==='dialogue'){setDialogueHidden(r,!r.dialogueHidden);return;}
      if(r.orientationBlocked)return;
      if(btn.dataset.life==='next')next();else if(btn.dataset.life==='skip')close({complete:true,reason:'skip'});else if(btn.dataset.life==='pause')pause();
      else if(btn.dataset.life==='auto'){r.auto=!r.auto;btn.textContent=r.auto?'自动 ✓':'自动';btn.setAttribute('aria-pressed',String(r.auto));if(r.auto&&r.voice?.status().state==='blocked'){r.pageWait=0;r.voice.retry();}}
      else if(btn.dataset.life==='voice'){r.pageWait=0;r.voice?.retry();}
      else if(btn.dataset.life==='music'){if(!r.audioStarted&&r.introAudio){if(r.introError){r.introError=false;try{r.introAudio.load();}catch(e){}}playIntro(r);}else{if(r.audioError){r.audioError=false;try{r.audio.load();}catch(e){}if(r.audioStarted)seekMusic(r);}r.musicBlocked=false;playMusic(r);}btn.hidden=true;btn.textContent='开启音乐';btn.removeAttribute('title');}else if(btn.dataset.life==='office'){returnToOffice(r);}else if(btn.dataset.life==='replay-end'){replayEnding(r);}};
    root.addEventListener('image-state-change',()=>wallImages(r));
    root.addEventListener('pointerdown',e=>e.stopPropagation());
    r.keyboard=e=>{if(!run||run!==r||r.orientationBlocked)return;if(e.code==='Space'||e.key==='Enter'){if(e.target.tagName==='BUTTON')return;e.preventDefault();next();}else if(e.key==='Escape'){e.preventDefault();pause();}else if(e.key==='Tab'){const buttons=[...root.querySelectorAll('button')].filter(b=>!b.hidden&&!b.disabled);const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    document.addEventListener('keydown',r.keyboard);const first=cueAt(r),entry=!resumed&&first===r.primary[0]&&introDialogue(r,first)&&elapsed<=first.start;
    if(entry){root.classList.remove('is-entering');root.classList.add('is-prologue-entry');r.cue=null;r.introTransition={kind:'entry',next:first,at:r.visualClock};paintIntroCurtain(r);}
    else if(first)renderCue(r,first,{seek:true,dialogueOffset:resumed&&old?old.dialogueOffset:0,dialogueCursor:resumed&&old?old.dialogueCursor:null,dialogueVoice:resumed&&old?old.dialogueVoice:null,copyCursors:resumed&&old?old.copyCursors:null});else renderWaiting(r);
    root.querySelector('[data-life="next"]').focus({preventScroll:true});r.raf=requestAnimationFrame(frame);if(introDialogue(r,first))warmStar(r);return true;
  }
  /* 2026-10-17 用户要求：终章演出播完，在白屏（farewell.is-white 收尾幕）上弹出确认框，
     主按钮「返回办公室」。完成事实在这里先落档，避免玩家看完却中途关页丢进度。 */
  function recordCompletion(r,reason){
    if(r.completionRecorded||r.replay||r.core.state!==r.state)return;
    r.completionRecorded=true;
    const alreadyWatched=canRecall(r.core),p=saved(r.core),watched=reason==='natural'&&!r.watchIncomplete;
    p.status='complete';p.elapsed=r.total;p.cueId=r.list[r.list.length-1].id;p.completionReason=watched?'watched':reason||'manual';p.watchIncomplete=!!r.watchIncomplete;
    if(!p.completedAt)p.completedAt=new Date().toISOString();
    if(watched&&!alreadyWatched)r.state.lifeFinaleWatched={status:'watched',at:p.completedAt,version:edition(r.core),stage:finalStage(r.core)};
    if(window.GameSave&&GameSave.autoSave)GameSave.autoSave(r.state);
  }
  // 演出播完（自然播完或点末幕按钮）时停住画面，改在收尾白屏上弹出确认框。
  function armFinishPrompt(r,reason){
    if(r.preview||r.replay||r.restart)return false;
    if(r.finishArmed)return true;
    recordCompletion(r,reason);r.finishArmed=true;
    r.root.classList.add('is-finishing');
    if(r.finishPrompt){r.finishPrompt.hidden=false;const b=r.finishPrompt.querySelector('[data-life="office"]');if(b)try{b.focus({preventScroll:true});}catch(e){b.focus();}}
    return true;
  }
  // 主按钮：关闭演出并回到办公室（终阶段沿用官方「再战」入口，其余情况原地渲染）。
  function returnToOffice(r){
    const core=r.core,g=window.GameUI;
    close({complete:true,reason:'manual'});
    if(!g||g.core!==core||!core.state)return;
    const s=core.state;if(s.phase!=='bonus'&&s.phase!=='over'){g.render();return;}
    if(g.clearBonusTimers)g.clearBonusTimers();
    if(typeof core.retryStage==='function'&&core.retryStage()){if(window.GameSave&&GameSave.autoSave)GameSave.autoSave(s);}
    else s.phase='office';
    g.render();
  }
  // 次按钮：从头再放一次这段演出（已看过走重播，否则走重置重播）。
  function replayEnding(r){
    const core=r.core;close({complete:true,reason:'manual'});
    open(canRecall(core)?{replay:true}:{restart:true});
  }
  function close(options={}) {
    const r=run;if(!r)return false;
    if(options.complete&&!r.replay&&r.core.state===r.state)recordCompletion(r,options.reason);else persist(r,true);
    run=null;r.imageAbort?.abort();r.screen?.close();r.releaseScreen?.();if(r.starWarm){if(r.starWarm.idle)window.cancelIdleCallback?.(r.starWarm.id);else clearTimeout(r.starWarm.id);r.starWarm=null;}r.walkMedia?.destroy();r.walkOutgoing?.media.destroy();r.walkOutgoing?.host.remove();r.closeupMedia?.destroy();r.preparedCloseup?.media.destroy();r.preparedCloseup?.host.remove();r.preparedWalk?.media.destroy();r.preparedWalk?.host.remove();r.starCompositor?.destroy();r.starLake?.destroy();r.textDissolve?.destroy();if(r.raf!=null)cancelAnimationFrame(r.raf);window.removeEventListener('resize',r.resize);document.removeEventListener('keydown',r.keyboard);
    for(const image of r.wallPhotoPreloads||[])image.removeAttribute('src');r.wallPhotoPreloads=null;
    r.voice?.destroy();for(const audio of [r.audio,r.introAudio])if(audio){audio.pause();audio.removeAttribute('src');try{audio.load();}catch(e){}}
    r.screenHost.remove();document.body.style.overflow=r.bodyOverflow;if(r.release)r.release();
    if(r.oldBgm&&window.AudioMgr&&r.state===r.core.state&&AudioMgr.playBgm)AudioMgr.playBgm(r.oldBgm);
    if(r.previousFocus&&r.previousFocus.isConnected)r.previousFocus.focus({preventScroll:true});
    const settlement=ui._embodiedBonusPages;
    if(options.complete&&!r.replay&&!r.preview&&r.state===ui.core.state&&settlement&&!settlement.closed&&settlement.state===r.state&&settlement.result===r.state.result)settlement.refreshFooter?.();
    return true;
  }
  function refresh() {if(run&&(run.state!==ui.core.state||run.phase!==ui.core.state.phase||run.ver!==ui.core.state.ver))close();if(!run&&eligible(ui.core)&&!completed(ui.core)){
      // The embodied finale follows the actual final settlement. Explicit
      // preview/replay and a saved in-progress film keep their existing routes.
      const p=ui._embodiedBonusPages,s=ui.core.state;
      if(s.phase==='bonus'&&p&&!p.closed&&p.root.isConnected&&p.state===s&&p.result===s.result&&!p.finaleReady&&!(s.lifeFinale&&s.lifeFinale.status==='playing'))return;
      open();
    }}
  const originalRender=ui.render;ui.render=function(){const result=originalRender.apply(this,arguments);refresh();return result;};
  const settings=ui.openSettingsPop;ui.openSettingsPop=function(){const result=settings.apply(this,arguments);if((canRecall(this.core)||completed(this.core))&&this.el){const footer=this.el.querySelector('#settingsPop .sub-modal-footer');if(footer&&!footer.querySelector('[data-action="life-replay"]'))footer.insertAdjacentHTML('afterbegin','<button class="skew-btn ghost" data-action="life-replay">'+(canRecall(this.core)?'回看':'重新观看')+' · 完整的一生</button>');}return result;};
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-action="life-replay"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();open(canRecall(ui.core)?{replay:true}:{restart:true});},true);
  document.addEventListener('visibilitychange',()=>{if(!run)return;run.last=performance.now();run.root.classList.toggle('is-paused',held(run));if(document.hidden){run.audio?.pause();run.introAudio?.pause();}else if(!run.paused){playMusic(run);playIntro(run);}syncMedia(run);drawEffect(run);persist(run,true);});
  window.addEventListener('pagehide',()=>{if(!run)return;persist(run,true);run.pageSuspended=true;if(run.raf!=null)cancelAnimationFrame(run.raf);run.raf=null;run.audio?.pause();run.introAudio?.pause();run.root.classList.add('is-paused');syncMedia(run);drawEffect(run);});
  window.addEventListener('pageshow',()=>{if(!run||!run.pageSuspended)return;const r=run;r.pageSuspended=false;r.last=performance.now();r.root.classList.toggle('is-paused',held(r));if(!r.paused){playMusic(r);playIntro(r);}drawEffect(r);r.raf=requestAnimationFrame(frame);});
  for(const event of ['visibilitychange','pagehide','pageshow']){
    const target=event==='visibilitychange'?document:window;
    target.addEventListener(event,()=>{if(run)run.voice?.sync(held(run)||!!run.copyHold||!!run.introTransition);});
  }
  window.LifeFinale={open,preview:options=>open({...options,preview:true}),close,isOpen:()=>!!run,refresh,history,milestones,timeline,eligible,completed,canRecall,next,pause,finalStage};
})();
