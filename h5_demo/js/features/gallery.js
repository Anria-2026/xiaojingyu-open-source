/* Travel/memories stay in their save; 16 special CG unlocks/reveals span this browser's saves. */
(function () {
  'use strict';
  if (window.WhaleGallery) return;
  const labels={all:'全部',travel:'旅行小鲸鱼',memorial:'纪念墙',special:'特殊结算 CG'};
  const categories=['travel','memorial','special'];
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset=v=>/^(?:\/?resource\/|https?:\/\/)/i.test(String(v||''))?(window.ResourcePaths?window.ResourcePaths.canonical(String(v)):String(v)):'';
  const text=(c,v)=>c&&typeof c.fillWhaleText==='function'?c.fillWhaleText(String(v||'')):String(v||'');
  const closeIcon='<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const emptyIcon='<svg width="54" height="54" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="8" width="34" height="31" rx="5"/><circle cx="17" cy="18" r="3"/><path d="M8 32l10-9 8 6 6-5 8 8"/></svg>';
  let session=null;
  const SPECIAL_LEDGER_KEY='whale_special_cg_ledger_v1';
  const specialStages=['V5','V5.5','V6','V6.5'],specialGrades=['fail','pass','excellent','top'];
  let fallbackEntries={};
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  function specialRow(c,row){
    if(!row||!specialStages.includes(row.ver)||!specialGrades.includes(row.verdict)||row.id!==row.ver+':'+row.verdict)return null;
    const authored=window.EmbodiedPresentation?.specialCG(c,{verdict:row.verdict,settled:true},row.ver);
    return authored&&authored.id===row.id?authored:null;
  }
  function mergeEntry(entries,row,revealed){
    if(!row||!specialStages.includes(row.ver)||!specialGrades.includes(row.verdict)||row.id!==row.ver+':'+row.verdict)return;
    const old=entries[row.id]||{};
    entries[row.id]={id:row.id,ver:row.ver,verdict:row.verdict,unlocked:true,revealed:!!(old.revealed||revealed),unlockedAt:old.unlockedAt||row.unlockedAt||row.at||null,revealedAt:old.revealedAt||row.revealedAt||null};
  }
  function mergeLedger(entries,ledger){
    if(!object(ledger)||ledger.version!==1||!object(ledger.entries))return;
    for(const [id,row] of Object.entries(ledger.entries))if(object(row)&&row.id===id&&row.unlocked===true)mergeEntry(entries,row,row.revealed===true);
  }
  function storedLedger(){
    try{const raw=localStorage.getItem(SPECIAL_LEDGER_KEY);return{raw,value:raw?JSON.parse(raw):null};}catch(_){return{raw:null,value:null,blocked:true};}
  }
  // Parsing old slots never loads a game, mutates its state, or commits a migration.
  function savedContexts(){
    const save=window.GameSave,out=[];if(!save)return out;
    const cfg=titleConfig(),add=value=>{try{const snap=save.parse(typeof value==='string'?value:JSON.stringify(value));if(!object(snap?.state))return;const c=Object.create(window.GameCore||{});Object.defineProperties(c,{state:{value:snap.state},cfg:{value:cfg}});out.push(c);}catch(_){}};
    try{add(localStorage.getItem(save.AUTO_KEY));}catch(_){}
    if(save.STAGE_KEY)try{add(localStorage.getItem(save.STAGE_KEY));}catch(_){}
    for(let slot=0;slot<save.MAX_SLOTS;slot++)try{add(localStorage.getItem(save.slotKey(slot)));}catch(_){}
    const cloud=window.Menu?._loadCloud;if(cloud?.state==='ok'&&cloud.snap)add(cloud.snap);
    return out;
  }
  function specialEvidence(c,entries){
    const s=c?.state;if(!s)return;
    mergeLedger(entries,s.whaleGallery?.specialLedger);
    const presentation=window.EmbodiedPresentation;if(!presentation?.specialCG)return;
    const current=s.result?.settled===true&&['bonus','over'].includes(s.phase)?presentation.specialCG(c,s.result,s.ver):null,p=s.embodiedReward;
    const read=!!(p&&(!p.cgId||p.cgId===current?.id)&&(p.part==='original'&&p.cg?.mediaSkipped!==true||p.cg?.stage==='revealed'||p.version===1&&p.part==='special'&&Number(p.beat)>0));
    const add=row=>{const cg=specialRow(c,row);if(cg)mergeEntry(entries,{...cg,at:row.at},cg.id===current?.id?read:entries[cg.id]?.revealed!==false);};
    const unlocks=s.whaleGallery?.unlocks;if(object(unlocks))for(const row of Object.values(unlocks))if(row?.category==='special')add(row);
    const history=[...Object.values(s.stageMarks||{}),...(Array.isArray(s.codexLog)?s.codexLog:[]),...(Array.isArray(s.modelHistory)?s.modelHistory:[])];
    Object.values(s.codex||{}).forEach(row=>{if(object(row))history.push(row.first,row.best,row.last);});
    for(const row of history)if(row){const cg=presentation.specialCG(c,row,row.ver);if(cg)add({...cg,at:row.at});}
    if(current)mergeEntry(entries,current,read);
  }
  function specialLedger(c){
    const entries={};mergeLedger(entries,storedLedger().value);mergeLedger(entries,{version:1,entries:fallbackEntries});
    // Saved backup ledgers are explicit facts; pending current-history duplicates are not.
    for(const context of savedContexts())specialEvidence(context,entries);
    specialEvidence(c,entries);return{version:1,entries};
  }
  function specialStatus(c,row){const cg=specialRow(c,row);if(!cg)return{unlocked:false,revealed:false};const entry=specialLedger(c).entries[cg.id];return{unlocked:!!entry,revealed:!!entry?.revealed};}
  function hasSpecialRevealed(c,row){return specialStatus(c,row).revealed;}
  function commitSpecial(c,cg,reveal){
    if(object(c.state.whaleGallery?.specialLedger)&&c.state.whaleGallery.specialLedger.version!==1)return false;
    const unlocks=store(c);if(!unlocks)return false;
    const ledger=specialLedger(c),old=ledger.entries[cg.id],now=new Date().toISOString();
    // Unlocking the current result itself is evidence of ownership, never of viewing it.
    const explicit=specialLedgerExplicit(c,cg.id),changed=reveal?!old?.revealed:!explicit&&!old?.revealed;
    if(reveal&&!changed)return false;
    mergeEntry(ledger.entries,{...cg,unlockedAt:old?.unlockedAt||now,revealedAt:reveal?now:old?.revealedAt},reveal);
    const key='special:'+cg.id;let stateChanged=false;
    if(!Object.prototype.hasOwnProperty.call(unlocks,key)){unlocks[key]={...normalize('special',cg),at:now};stateChanged=true;}
    if(JSON.stringify(c.state.whaleGallery.specialLedger)!==JSON.stringify(ledger)){c.state.whaleGallery.specialLedger=ledger;stateChanged=true;}
    persistBrowserLedger(ledger);
    if(stateChanged&&window.GameSave?.autoSave)window.GameSave.autoSave(c.state);
    return changed;
  }
  function persistBrowserLedger(ledger){
    const stored=storedLedger(),raw=JSON.stringify(ledger);
    // Preserve unknown/corrupt schemas; the save and session remain a safe fallback.
    if(!stored.blocked&&(stored.raw==null||stored.value?.version===1&&object(stored.value.entries))){try{if(stored.raw!==raw)localStorage.setItem(SPECIAL_LEDGER_KEY,raw);fallbackEntries={};}catch(_){fallbackEntries=ledger.entries;}}
    else fallbackEntries=ledger.entries;
  }
  function specialLedgerExplicit(c,id){
    const entries={};mergeLedger(entries,storedLedger().value);mergeLedger(entries,{version:1,entries:fallbackEntries});mergeLedger(entries,c.state.whaleGallery?.specialLedger);
    return !!entries[id]||!!c.state.whaleGallery?.unlocks?.['special:'+id];
  }
  function store(c){
    const s=c&&c.state;if(!s)return null;
    if(!s.whaleGallery||typeof s.whaleGallery!=='object'||Array.isArray(s.whaleGallery))s.whaleGallery={version:1,unlocks:{}};
    const g=s.whaleGallery;if(Number(g.version)>1)return null;g.version=1;
    if(!g.unlocks||typeof g.unlocks!=='object'||Array.isArray(g.unlocks))g.unlocks={};
    return g.unlocks;
  }
  function normalize(category,row){
    const src=asset(row&&row.src);if(!categories.includes(category)||!src)return null;
    const id=String(row.id||src),key=category+':'+id;
    return {key,id,category,src,title:String(row.title||row.caption||row.alt||labels[category]),ver:String(row.ver||''),verdict:String(row.verdict||''),nodeId:String(row.nodeId||''),milestone:String(row.milestone||''),at:row.at||null};
  }
  function remember(c,category,rows){
    if(!c||!c.state||!Array.isArray(rows))return false;
    const items=rows.map(row=>normalize(category,row)).filter(Boolean);if(!items.length)return false;
    const unlocks=store(c);if(!unlocks)return false;let changed=false;
    for(const item of items){
      if(Object.prototype.hasOwnProperty.call(unlocks,item.key))continue;
      unlocks[item.key]={...item,at:item.at||new Date().toISOString()};changed=true;
    }
    if(changed&&window.GameSave&&typeof window.GameSave.autoSave==='function')window.GameSave.autoSave(c.state);
    return changed;
  }
  function unlockSpecial(c,row){
    if(!c?.state?.result||c.state.result.settled!==true||!row||!['fail','pass','excellent','top'].includes(row.verdict))return false;
    const expected=window.EmbodiedPresentation?.specialCG(c,c.state.result,c.state.ver);
    if(!expected||row.id!==expected.id||row.verdict!==expected.verdict||asset(row.src)!==asset(expected.src))return false;
    return commitSpecial(c,expected,false);
  }
  function claimSpecialReveal(c,row){
    if(!c?.state?.result||c.state.result.settled!==true)return false;
    const expected=window.EmbodiedPresentation?.specialCG(c,c.state.result,c.state.ver);
    if(!expected||row?.id!==expected.id||row.verdict!==expected.verdict||asset(row.src)!==asset(expected.src))return false;
    return commitSpecial(c,expected,true);
  }
  function unlockTravel(c,rows){return remember(c,'travel',(rows||[]).map(row=>({...row,id:row.src,ver:row.ver||c.state.ver})));}
  const milestoneKey=card=>card.milestone==='stage'?'stage_'+card.stage:card.milestone;
  function memorialRows(cards,marks){return (cards||[]).filter(card=>card&&marks[milestoneKey(card)]?.achieved).map(card=>({id:card.id||milestoneKey(card),src:card.photo,title:card.title,ver:card.stage,milestone:milestoneKey(card),at:marks[milestoneKey(card)]?.at}));}
  function unlockMemorial(c,cards,marks){return remember(c,'memorial',memorialRows(cards,marks||{}));}
  // This reader also runs before GameUI/Core initialization on the title screen.
  // It follows the finale's saved evidence without swapping global active state.
  function observedMilestones(c){
    const s=c.state,good=row=>row&&row.at&&!Number.isNaN(Date.parse(row.at));
    const records=Object.values(s.stageMarks||{}).concat(s.codexLog||[],Object.values(s.codex||{}).flatMap(row=>row?[row.first,row.best,row.last]:[]),s.rankLog||[],s.modelHistory||[]).filter(Boolean);
    const stamps=records.filter(good).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)),explicit=s.lifeMilestones||{};
    const mark=row=>({achieved:!!row,at:good(row)?row.at:null});
    const first=(key,match)=>mark(good(explicit[key])?explicit[key]:stamps.find(match)||records.find(match));
    const out={first_project:mark(explicit.first_project),first_V1:mark((s.stageMarks||{}).V1),first_top10:first('first_top10',row=>Number.isFinite(Number(row.rank))&&Number(row.rank)>=1&&Number(row.rank)<=10),first_rank1:first('first_rank1',row=>Number(row.rank)===1),body_awake:mark(explicit.body_awake)};
    for(const ver of c.cfg.VER_ORDER||[])out['stage_'+ver]=mark((s.stageMarks||{})[ver]);
    for(const ver of ['V5','V5.5','V6','V6.5'])out['body_'+ver]=good(explicit['body_'+ver])?mark(explicit['body_'+ver]):out['stage_'+ver];
    if(!out.first_project.achieved&&records.length)out.first_project.achieved=true;
    if(Object.values(s.rank1Params||{}).some(Boolean)){out.first_rank1.achieved=true;out.first_top10.achieved=true;}
    if(!out.body_awake.achieved&&s.embodiedEra?.bodyAwakened&&s.embodiedEra.podExitSeen)out.body_awake.achieved=true;
    const stops=(c.cfg.CITY_JOURNEY||{}).STOPS||[],journey=s.cityJourney||{},log=Array.isArray(journey.log)?journey.log:[];
    for(const stop of stops){
      const key='city_'+stop.id,unique=stops.filter(row=>row.label===stop.label).length===1;
      const line=log.find(row=>row&&(row.nodeId===stop.id||unique&&row.type==='system'&&row.text===stop.label));
      const record=line&&Number.isFinite(Number(line.at))&&Number(line.at)>0?{...line,at:new Date(Number(line.at)).toISOString()}:line;
      out[key]=mark(good(explicit[key])?explicit[key]:record);
      if((journey.completedStops||[]).includes(stop.id))out[key].achieved=true;
    }
    return out;
  }
  function list(c,withBrowser=true){
    if(!c||!c.state)return [];
    const s=c.state,out=[],keys=new Set(),photos=new Set();
    const add=(category,row)=>{const item=normalize(category,row);if(!item||keys.has(item.key)||photos.has(category+':'+item.src))return;keys.add(item.key);photos.add(category+':'+item.src);out.push(item);};
    const stored=s.whaleGallery&&s.whaleGallery.unlocks;
    if(stored&&typeof stored==='object'&&!Array.isArray(stored))Object.values(stored).forEach(row=>{
      if(!row||!categories.includes(row.category))return;
      // A saved unlock keeps its evidence/date/path; current authored captions may be revised.
      const cg=row.category==='special'&&window.EmbodiedPresentation?.specialCG(c,{verdict:row.verdict,settled:true},row.ver);
      add(row.category,cg&&cg.id===row.id&&asset(cg.src)===asset(row.src)?{...row,title:cg.title}:row);
    });
    // Received photos are already persistent journey facts. Merely reaching a stage is insufficient.
    for(const row of (s.cityJourney&&Array.isArray(s.cityJourney.log)?s.cityJourney.log:[]))if(row&&row.type==='image')add('travel',{...row,id:row.src,title:row.caption||row.alt,nodeId:row.nodeId||row.source?.nodeId});
    const finale=(c.cfg.LIFE_STORY||{}).FINALE||{},marks=observedMilestones(c);
    const cards=(finale.wallCards||[]).concat(...(finale.timeline||[]).filter(cue=>cue&&Array.isArray(cue.wallCards)).map(cue=>cue.wallCards));
    memorialRows(cards,marks).forEach(row=>add('memorial',row));
    // Older saves retain committed review snapshots without an explicit gallery field.
    const history=[...Object.values(s.stageMarks||{}),...(Array.isArray(s.codexLog)?s.codexLog:[]),...(Array.isArray(s.modelHistory)?s.modelHistory:[])];
    Object.values(s.codex||{}).forEach(row=>{if(row&&typeof row==='object')history.push(row.first,row.best,row.last);});
    if(s.result&&s.result.settled===true&&['bonus','over'].includes(s.phase))history.push({...s.result,ver:s.ver});
    const presentation=window.EmbodiedPresentation;
    if(presentation&&typeof presentation.specialCG==='function')for(const row of history){if(row){const cg=presentation.specialCG(c,row,row.ver);if(cg)add('special',cg);}}
    if(withBrowser)for(const row of Object.values(specialLedger(c).entries)){const cg=specialRow(c,row);if(cg)add('special',{...cg,at:row.unlockedAt});}
    return out;
  }
  function titleConfig(){
    const base=window.GameCore?.cfg||window.GameCfg||{},external=typeof EXT_CFG==='object'&&EXT_CFG||{};
    const merge=(a,b)=>{if(!b||typeof b!=='object'||Array.isArray(b))return b===undefined?a:b;const out={...(a||{})};for(const key of Object.keys(b))out[key]=b[key]&&typeof b[key]==='object'&&!Array.isArray(b[key])?merge(out[key],b[key]):b[key];return out;};
    const cfg={...base,...external};
    for(const key of ['LIFE_STORY','CITY_JOURNEY','EMBODIED'])cfg[key]=merge(base[key],external[key]);
    return cfg;
  }
  function savedItems(){
    const save=window.GameSave,cfg=titleConfig(),out=[],keys=new Set(),photos=new Set();
    const addRow=row=>{if(keys.has(row.key)||photos.has(row.category+':'+row.src))return;keys.add(row.key);photos.add(row.category+':'+row.src);out.push(row);};
    if(!save){const context={cfg,state:{}};for(const row of Object.values(specialLedger(context).entries)){const cg=specialRow(context,row);if(cg)addRow(normalize('special',cg));}return out;}
    const addSnapshot=value=>{
      let snap;try{const raw=typeof value==='string'?value:JSON.stringify(value);snap=save.parse(raw);}catch(_){return;}
      if(!snap||!snap.state||typeof snap.state!=='object'||Array.isArray(snap.state))return;
      const context=Object.create(window.GameCore||{});Object.defineProperties(context,{state:{value:snap.state,enumerable:true},cfg:{value:cfg,enumerable:true}});
      try{for(const row of list(context,false)){if(keys.has(row.key)||photos.has(row.category+':'+row.src))continue;keys.add(row.key);photos.add(row.category+':'+row.src);out.push({...row,title:text(context,row.title)});}}catch(_){/* A malformed older slot must not block the remaining saved pictures. */}
    };
    // Read raw snapshots. No loadState, save, restore or migration is committed.
    try{addSnapshot(localStorage.getItem(save.AUTO_KEY));}catch(_){}
    for(let slot=0;slot<save.MAX_SLOTS;slot++)try{addSnapshot(localStorage.getItem(save.slotKey(slot)));}catch(_){}
    const cloud=window.Menu?._loadCloud;if(cloud?.state==='ok'&&cloud.snap)addSnapshot(cloud.snap);
    const context={cfg,state:{}};for(const row of Object.values(specialLedger(context).entries)){const cg=specialRow(context,row);if(cg)addRow(normalize('special',{...cg,at:row.unlockedAt}));}
    return out;
  }
  function openMenu(){
    const menu=window.Menu;if(menu?.started)return false;
    const context={cfg:titleConfig(),state:{phase:'menu'},fillWhaleText:value=>String(value||'')};
    return open(context,{menu:menu||null,items:savedItems(),fromMenu:true});
  }
  function filtered(r){return r.items.filter(item=>r.category==='all'||item.category===r.category);}
  function paint(r){
    const rows=filtered(r),body=r.root.querySelector('.whale-gallery-content');
    r.root.querySelectorAll('[data-gallery-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.galleryFilter===r.category)));
    body.innerHTML=rows.length?'<div class="whale-gallery-grid">'+rows.map(item=>'<button type="button" class="whale-gallery-card" data-gallery-open="'+esc(item.key)+'" aria-label="查看'+esc(text(r.core,item.title))+'"><span class="whale-gallery-image"><img src="'+esc(item.src)+'" alt="'+esc(text(r.core,item.title))+'" loading="lazy" decoding="async"></span><span class="whale-gallery-card-copy"><small>'+esc(item.ver||labels[item.category])+'</small><strong>'+esc(text(r.core,item.title))+'</strong></span></button>').join('')+'</div>':'<div class="whale-gallery-empty"><span aria-hidden="true">'+emptyIcon+'</span><h3>这里还没有解锁的图片</h3><p>'+ (r.fromMenu?'已保存的旅行照片、达成的纪念节点，以及各等级评审的特殊 CG，都能在这里重温。':'旅行收到的照片、达成的纪念节点，以及各等级评审的特殊 CG，都会保存在这个存档的画廊里。') +'</p></div>';
    r.root.querySelector('.whale-gallery-count').textContent=rows.length+' 张已解锁';
  }
  function hideViewer(r){if(r.singleImage){close();return;}r.viewerKey=null;r.root.querySelector('.whale-gallery-viewer').hidden=true;r.root.querySelector('.whale-gallery-content').hidden=false;r.root.querySelector('.whale-gallery-tabs').hidden=false;[...r.root.querySelectorAll('[data-gallery-open]')].find(button=>button.dataset.galleryOpen===r.lastKey)?.focus({preventScroll:true});}
  function view(r,key){
    const rows=filtered(r),index=rows.findIndex(item=>item.key===key),item=rows[index];if(!item)return false;
    r.viewerKey=key;r.lastKey=key;
    const viewer=r.root.querySelector('.whale-gallery-viewer');viewer.hidden=false;r.root.querySelector('.whale-gallery-content').hidden=true;r.root.querySelector('.whale-gallery-tabs').hidden=true;
    viewer.innerHTML='<div class="whale-gallery-view-tools"><button type="button" data-gallery="back">← 返回画廊</button><span>'+String(index+1)+' / '+rows.length+'</span></div><figure><img src="'+esc(item.src)+'" alt="'+esc(text(r.core,item.title))+'" decoding="async"><figcaption><small>'+esc(labels[item.category])+(item.ver?' · '+esc(item.ver):'')+'</small><h3>'+esc(text(r.core,item.title))+'</h3></figcaption></figure><div class="whale-gallery-view-nav"><button type="button" data-gallery="prev" '+(rows.length<2?'disabled':'')+' aria-label="上一张图片">← 上一张</button><button type="button" data-gallery="next" '+(rows.length<2?'disabled':'')+' aria-label="下一张图片">下一张 →</button></div>';
    if(r.singleImage){viewer.querySelector('[data-gallery="back"]').textContent='← 关闭大图';viewer.querySelector('.whale-gallery-view-tools span').hidden=true;viewer.querySelector('.whale-gallery-view-nav').hidden=true;}
    viewer.querySelector('[data-gallery="back"]').focus({preventScroll:true});return true;
  }
  function move(r,direction){const rows=filtered(r),index=rows.findIndex(item=>item.key===r.viewerKey);if(rows.length>1)view(r,rows[(index+direction+rows.length)%rows.length].key);}
  function close(){
    const r=session;if(!r)return false;session=null;
    document.removeEventListener('keydown',r.keyboard,true);r.root.remove();document.body.style.overflow=r.bodyOverflow;r.release?.();if(r.fromMenu&&r.menu){r.menu.galleryOpen=false;r.menu.syncAnimation?.();}
    if(r.previousFocus&&r.previousFocus.isConnected)r.previousFocus.focus({preventScroll:true});r.onClose?.();return true;
  }
  function open(c,options={}){
    if(!c||!c.state||!document.body)return false;close();
    const root=document.createElement('section');root.className='whale-gallery'+(options.singleImage?' whale-gallery-single':'');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','whaleGalleryTitle');
    const r={root,core:c,state:c.state,phase:c.state.phase,ver:c.state.ver,items:options.items||list(c),fromMenu:!!options.fromMenu,menu:options.menu||null,singleImage:!!options.singleImage,onClose:typeof options.onClose==='function'?options.onClose:null,category:'all',viewerKey:null,lastKey:'',previousFocus:options.returnFocus||document.activeElement,bodyOverflow:document.body.style.overflow,release:null};session=r;
    root.innerHTML='<div class="whale-gallery-panel"><header class="whale-gallery-header"><div><small>OUR GALLERY</small><h2 id="whaleGalleryTitle">小鲸鱼画廊</h2><span class="whale-gallery-count"></span></div><button type="button" class="whale-gallery-close" data-gallery="close" aria-label="关闭画廊">'+closeIcon+'</button></header><nav class="whale-gallery-tabs" aria-label="图片分类">'+Object.keys(labels).map(category=>'<button type="button" data-gallery-filter="'+category+'" aria-pressed="'+(category==='all')+'">'+labels[category]+' <span>'+r.items.filter(item=>category==='all'||item.category===category).length+'</span></button>').join('')+'</nav><main class="whale-gallery-content"></main><div class="whale-gallery-viewer" hidden></div></div>';
    for(const type of ['pointerdown','pointerup','touchstart','touchend'])root.addEventListener(type,e=>e.stopPropagation(),{passive:true});
    root.addEventListener('click',e=>{e.stopPropagation();if(c.state!==r.state){close();return;}if(e.target===root){close();return;}const button=e.target.closest('button');if(!button||button.disabled)return;
      if(button.dataset.gallery==='close')close();else if(button.dataset.gallery==='back')hideViewer(r);else if(button.dataset.gallery==='prev')move(r,-1);else if(button.dataset.gallery==='next')move(r,1);else if(button.dataset.galleryFilter){r.category=button.dataset.galleryFilter;paint(r);}else if(button.dataset.galleryOpen)view(r,button.dataset.galleryOpen);
    });
    r.keyboard=e=>{if(session!==r)return;if(c.state!==r.state){close();return;}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(r.viewerKey)hideViewer(r);else close();}else if(r.viewerKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();e.stopImmediatePropagation();move(r,e.key==='ArrowLeft'?-1:1);}else if(e.key==='Tab'){const buttons=[...root.querySelectorAll('button')].filter(button=>!button.disabled&&!button.closest('[hidden]')),index=buttons.indexOf(document.activeElement),next=index+(e.shiftKey?-1:1);if(index<0||next<0||next>=buttons.length){e.preventDefault();buttons[(next+buttons.length)%buttons.length]?.focus({preventScroll:true});}}};
    document.addEventListener('keydown',r.keyboard,true);document.body.appendChild(root);document.body.style.overflow='hidden';if(r.fromMenu&&r.menu){r.menu.galleryOpen=true;r.menu.syncAnimation?.();}else if(!r.fromMenu&&window.OfficePause)r.release=window.OfficePause.acquire(c,'whale-gallery');paint(r);root.querySelector('[data-gallery="close"]').focus({preventScroll:true});return true;
  }
  function openImage(c,row,returnFocus,options={}){
    if(!c?.state||!row)return false;
    const item=normalize(row.category||'special',row);if(!item)return false;
    // This is a viewer, including explicit story previews; it grants no collection/reveal fact.
    if(!open(c,{items:[item],singleImage:true,returnFocus,onClose:options.onClose}))return false;
    return view(session,item.key);
  }
  function openSpecialImage(c,row,options={}){return openImage(c,row,options.returnFocus,options);}
  window.WhaleGallery={open,openMenu,openImage,openSpecialImage,listSaved:savedItems,close,isOpen:()=>!!session,list,unlockSpecial,unlockTravel,unlockMemorial,specialStatus,hasSpecialRevealed,claimSpecialReveal,SPECIAL_LEDGER_KEY};
  // An explicit new game may replace the only legacy autosave/stage anchor.
  // Preserve its real CG facts first; merely opening/listing the gallery stays read-only.
  const game=window.GameCore;
  if(game&&typeof game.newGame==='function'){const newGame=game.newGame;game.newGame=function(){const ledger=specialLedger(this);if(Object.keys(ledger.entries).length)persistBrowserLedger(ledger);return newGame.apply(this,arguments);};}
  // Capture the menu entry before its corner/document handlers can route a tap.
  document.addEventListener('click',event=>{const button=event.target?.closest?.('#menu-gallery');if(!button)return;event.preventDefault();event.stopImmediatePropagation();if(!window.Menu?.started)openMenu();},true);
  const menu=window.Menu;
  if(menu&&typeof menu.animationBlocked==='function'){const blocked=menu.animationBlocked;menu.animationBlocked=function(){return !!this.galleryOpen||blocked.apply(this,arguments);};}
  if(menu&&typeof menu.startGame==='function'){const start=menu.startGame;menu.startGame=function(){if(session?.fromMenu)close();return start.apply(this,arguments);};}
  const ui=window.GameUI;if(ui&&typeof ui.render==='function'){const render=ui.render;ui.render=function(){if(session&&(session.core.state!==session.state||session.core.state.phase!==session.phase||session.core.state.ver!==session.ver))close();return render.apply(this,arguments);};}
})();
