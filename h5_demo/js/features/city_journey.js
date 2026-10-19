/* V5 city reports are a persistent, linear journey on the real-world clock. */
(function () {
  'use strict';
  if (window.CityJourney) return;
  const ui=window.GameUI, coreAPI=window.GameCore, page=document, surface=window;
  const cfg=c=>((c&&c.cfg)||{}).CITY_JOURNEY||{};
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const text=(c,value)=>typeof c.fillWhaleText==='function'?c.fillWhaleText(value):c.fillVars(value);
  const isEra=c=>!!(c&&c.state&&(typeof c.embodiedAvailable==='function'?c.embodiedAvailable():/^V(?:5(?:\.5)?|[6-9])$/.test(c.state.ver||'')));
  const enabled=c=>isEra(c)&&cfg(c).ENABLED!==false&&Array.isArray(cfg(c).STOPS)&&cfg(c).STOPS.length>0;
  const ready=c=>enabled(c)&&!!(c.state.embodiedEra&&c.state.embodiedEra.bodyAwakened&&c.state.embodiedEra.podExitSeen);
  const stops=c=>(cfg(c).STOPS||[]).filter(s=>s&&typeof s.id==='string'&&s.id&&Array.isArray(s.steps)&&s.steps.length);
  const stages=['V5','V5.5','V6','V6.5'];
  const legacyStops=['hospital','school','market','rain','work','eldercare','night','home'];
  const routeVersion=c=>Math.max(1,Math.floor(finite(cfg(c).ROUTE_VERSION,1)));
  const passed=(j,id)=>j.completedStops.includes(id)||(j.skippedStops||[]).includes(id);
  const nextStop=(c,j)=>stops(c).find(n=>!passed(j,n.id)&&requiredVer(c,n)===contentVer(c));
  function requiredVer(c,n) {
    // The face-to-face opening belongs to the body awakening, even if training
    // advances before the player reads it. Keep its real pending reply deliverable.
    if(n&&n.id==='opening')return contentVer(c);
    if(n&&typeof n.minVer==='string'&&/^V\d+(?:\.\d+)?$/.test(n.minVer))return n.minVer;
    const index=Math.max(0,stops(c).findIndex(s=>s.id===(n&&n.id)));
    return stages[Math.min(3,Math.floor(index/(routeVersion(c)>=2?5:2)))];
  }
  /* 有效内容阶段（2026-10-16 用户要求）：按玩家当前立项的「架构 + 参数」匹配逐阶段目标
     （core.modelCode）—— 在 V5.5 选回 V5 的组合就回到 V5 的旅途内容（例：稀疏·7B 回到 V1）。
     非具身阶段的组合（如 dense·7B → V1）在旅途里没有对应站点，回落到当前的 s.ver。 */
  const contentVer=c=>{
    const code=c&&typeof c.modelCode==='function'?c.modelCode():(c&&c.state&&c.state.ver);
    return stages.includes(code)?code:((c&&c.state&&c.state.ver)||stages[0]);
  };
  function unlocked(c,n) {
    const min=requiredVer(c,n),current=contentVer(c),order=c.cfg.VER_ORDER||[],a=order.indexOf(current),b=order.indexOf(min);
    if(a>=0&&b>=0)return a>=b;
    const rank=v=>/^V\d+(?:\.\d+)?$/.test(String(v||''))?Number(String(v).slice(1)):-1;
    return rank(current)>=rank(min);
  }
  const lockText=(c,n)=>'后续内容在'+requiredVer(c,n)+'后解锁';
  const headerText=(c,st)=>st.kind==='replying'?(node(c,ensure(c))?.label||''):st.text;
  const idleText=st=>st.kind==='locked'?st.text:st.kind==='complete'?'已平安回家':st.kind==='replying'?'正在回复':'她正在路上';
  const idleIcon=st=>st.kind==='locked'?'🔒':st.kind==='complete'?'♡':'◷';
  const persist=c=>{if(window.GameSave&&typeof GameSave.autoSave==='function')GameSave.autoSave(c.state);};
  const sound=key=>{if(window.SFX&&typeof SFX.play==='function')SFX.play(key,{vol:.35});};
  const asset=src=>/^(?:resource\/|https?:\/\/)/i.test(String(src||''))?(window.ResourcePaths?ResourcePaths.canonical(String(src)):String(src)):'';
  const voiceSeconds=v=>Math.max(0,Math.round(Math.min(300,finite(v,0))));
  // 语音对白：单例播放器 + 「已自动播过」的键（at|src，跨重渲染去重）
  let voicePlayer=null,voiceSrc='',voiceIndex=null,voicePlaying=false,voiceRequest=0;const voicePlayed=new Set(),voiceDurations=new Map();
  const voiceKey=m=>String(m.at)+'|'+String(m.src);
  const waitPolicy=c=>Math.max(1,Math.floor(finite(cfg(c).WAIT_POLICY_VERSION,1)));
  // Source-bound history follows the authored script without replaying a report.
  // Old replies already carry stable node/step IDs; use those and report labels
  // to recover the adjacent choice/arrival source, never an unrelated free log.
  function refreshHistory(c,j){
    const nodes=[cfg(c).OPENING,...stops(c)].filter(Boolean),byId=new Map(nodes.map(n=>[n.id,n]));
    let changed=false,active=null,arrivalIndex=0,arriving=false,priorReply=null;
    function bind(m,source){if(!m.source){m.source=source;changed=true;}}
    for(let i=0;i<j.log.length;i++){
      const m=j.log[i];if(!m||typeof m!=='object')continue;
      if(!m.source){
        if((m.type==='text'||m.type==='voice')&&byId.has(m.nodeId)&&Number.isInteger(m.step))bind(m,{nodeId:m.nodeId,kind:'reply',index:m.step});
        else if(m.type==='user'){
          const next=j.log[i+1],p=next&&byId.has(next.nodeId)&&Number.isInteger(next.step)?next:i===j.log.length-1?j.pendingReply:null;
          if(p&&byId.has(p.nodeId)&&Number.isInteger(p.step))bind(m,{nodeId:p.nodeId,kind:'option',index:p.step});
        }else if(m.type==='system'){
          const n=nodes.find(n=>n.id!=='opening'&&(n.label===m.text||(n.legacyLabels||[]).includes(m.text)));
          if(n)bind(m,{nodeId:n.id,kind:'label'});
          else if(priorReply&&m.text===priorReply.departure)bind(m,{nodeId:priorReply.id,kind:'departure'});
          else if(priorReply&&/请耐心等待她返回消息/.test(m.text||''))bind(m,{nodeId:priorReply.id,kind:'waitHint'});
        }else if(arriving&&active){
          const row=(active.arrivals||[])[arrivalIndex];
          if(row&&row.type===m.type)bind(m,{nodeId:active.id,kind:'arrival',index:arrivalIndex});
        }
        // Legacy arrival text uses the same type as replies; resolve only inside
        // a confirmed report header, before the first player choice.
        if(!m.source&&arriving&&active){const row=(active.arrivals||[])[arrivalIndex];if(row&&row.type===m.type)bind(m,{nodeId:active.id,kind:'arrival',index:arrivalIndex});}
      }
      const source=m.source,n=source&&byId.get(source.nodeId);if(!n)continue;
      const assign=(key,value)=>{if(m[key]!==value){m[key]=value;changed=true;}};
      if(source.kind==='label'){active=n;arriving=true;arrivalIndex=0;assign('text',String(n.label||n.destination||'新的旅途消息'));}
      else if(source.kind==='arrival'){
        const row=(n.arrivals||[])[source.index];if(!row)continue;
        assign('type',row.type);assign('text',String(row.text||''));
        if(row.type==='image'){assign('src',asset(row.src));assign('alt',String(row.alt||n.label||'{whale}的旅途自拍'));assign('caption',String(row.caption||n.label||''));}
        if(row.type==='voice'){assign('src',asset(row.src));assign('seconds',voiceSeconds(row.seconds));}
        arrivalIndex=source.index+1;
      }else if(source.kind==='option'||source.kind==='reply'){
        const step=(n.steps||[])[source.index];if(!step)continue;arriving=false;
        assign('text',String(source.kind==='option'?step.option||'':step.reply||''));
        if(source.kind==='reply'){
          priorReply=n;const src=step.replyType==='voice'&&asset(step.replySrc);
          assign('type',src?'voice':'text');
          if(src){assign('src',src);assign('seconds',voiceSeconds(step.replySeconds));}
          else for(const key of ['src','seconds'])if(Object.prototype.hasOwnProperty.call(m,key)){delete m[key];changed=true;}
        }
      }else if(source.kind==='departure')assign('text',String(n.departure||''));
      else if(source.kind==='waitHint')assign('text',String(n.waitHint||'请耐心等待她返回消息'));
    }
    if(j.pendingReply){
      const p=j.pendingReply,n=byId.get(p.nodeId),step=n&&(n.steps||[])[p.step];
      if(step){const value=String(step.reply||''),voice=step.replyType==='voice'&&asset(step.replySrc)?{src:asset(step.replySrc),seconds:voiceSeconds(step.replySeconds)}:null;
        if(p.text!==value){p.text=value;changed=true;}
        if(JSON.stringify(p.voice||null)!==JSON.stringify(voice)){p.voice=voice;changed=true;}
      }
    }
    return changed;
  }
  function ensure(c) {
    const s=c.state;
    const existed=!!(s.cityJourney&&typeof s.cityJourney==='object'&&!Array.isArray(s.cityJourney));
    if(!s.cityJourney||typeof s.cityJourney!=='object'||Array.isArray(s.cityJourney))s.cityJourney={};
    const j=s.cityJourney;
    const priorRoute=existed?Math.max(1,Math.floor(finite(j.routeVersion,1))):routeVersion(c);
    const priorWaitPolicy=existed?Math.max(1,Math.floor(finite(j.waitPolicyVersion,1))):waitPolicy(c);
    const defaults={schema:2,routeVersion:routeVersion(c),waitPolicyVersion:waitPolicy(c),openingDone:false,nodeId:'opening',step:0,waitingUntil:0,nextStopId:null,completed:false,unread:false,completedStops:[],skippedStops:[],log:[],seen:{},pendingReply:null};
    Object.keys(defaults).forEach(k=>{if(j[k]==null)j[k]=defaults[k];});
    j.schema=2;j.step=Math.max(0,Math.floor(finite(j.step,0)));j.waitingUntil=Math.max(0,finite(j.waitingUntil,0));
    const priorWaitDeadline=j.waitingUntil;
    if(!Array.isArray(j.completedStops))j.completedStops=[];
    j.completedStops=[...new Set(j.completedStops.filter(x=>typeof x==='string'))];
    if(!Array.isArray(j.skippedStops))j.skippedStops=[];
    j.skippedStops=[...new Set(j.skippedStops.filter(x=>typeof x==='string'))];
    if(!Array.isArray(j.log))j.log=[];
    if(!j.seen||typeof j.seen!=='object'||Array.isArray(j.seen))j.seen={};
    // The expanded route must never replay childhood ahead of a saved adult report.
    // Only newly inserted stops behind the saved cursor are skipped; the history,
    // active reply and real-time deadline are retained verbatim.
    let migrated=false;
    if(priorRoute<2&&routeVersion(c)>=2){
      const route=stops(c),anchor=route.findIndex(n=>n.id===(j.nodeId&&j.nodeId!=='opening'?j.nodeId:j.nextStopId));
      const completedIndex=route.reduce((last,n,i)=>j.completedStops.includes(n.id)?Math.max(last,i):last,-1);
      const before=j.completed?route.length:anchor>=0?anchor:completedIndex+1;
      route.slice(0,before).forEach(n=>{if(!legacyStops.includes(n.id)&&!passed(j,n.id))j.skippedStops.push(n.id);});
      j.routeVersion=routeVersion(c);migrated=true;
    }
    // A missing/edited stop must not turn a previously valid save into a dead end.
    if(j.openingDone&&j.nodeId==='opening')j.nodeId=null;
    if(j.nodeId&&j.nodeId!=='opening'&&!stops(c).some(n=>n.id===j.nodeId))j.nodeId=null;
    if(j.nextStopId&&!stops(c).some(n=>n.id===j.nextStopId))j.nextStopId=null;
    /* 2026-10-16 用户要求：按「当前内容阶段」推进 —— 若正进行中的站点属于别的阶段，
       先把它的进度按阶段存进 j.parked[ver] 并让出位置，当前阶段照常继续；
       等玩家通过立项组合回到那个阶段时，再原样恢复（「还没刷完的消息继续往后刷」）。 */
    if(!j.parked||typeof j.parked!=='object'||Array.isArray(j.parked))j.parked={};
    {
      const activeNode=j.nodeId&&j.nodeId!=='opening'?stops(c).find(n=>n.id===j.nodeId):null;
      if(activeNode&&requiredVer(c,activeNode)!==contentVer(c)){
        j.parked[requiredVer(c,activeNode)]={nodeId:j.nodeId,step:j.step,pendingReply:j.pendingReply||null,waitingUntil:j.waitingUntil||0,waitingStartedAt:j.waitingStartedAt||0};
        j.nodeId=null;j.step=0;j.pendingReply=null;j.waitingUntil=0;j.waitingStartedAt=0;migrated=true;
      }
      const parked=j.parked[contentVer(c)];
      if(parked&&!j.nodeId&&!j.completed&&stops(c).some(n=>n.id===parked.nodeId)){
        j.nodeId=parked.nodeId;j.step=Math.max(0,Math.floor(finite(parked.step,0)));
        j.pendingReply=parked.pendingReply||null;j.waitingUntil=Math.max(0,finite(parked.waitingUntil,0));j.waitingStartedAt=Math.max(0,finite(parked.waitingStartedAt,0));
        delete j.parked[contentVer(c)];migrated=true;
      }
    }
    const current=node(c,j);
    if(current&&Array.isArray(current.steps)&&current.steps.length)j.step=Math.min(j.step,current.steps.length-1);
    if(j.pendingReply){
      const p=j.pendingReply;
      if(!p||typeof p!=='object'||Array.isArray(p)||!current||p.nodeId!==j.nodeId||p.step!==j.step||!Number.isFinite(p.dueAt)||typeof p.text!=='string'||j.completed){j.pendingReply=null;persist(c);}
    }
    /* 2026-10-16：推进到新阶段后是否丢弃旧阶段未完成报备 —— 与既有「跨阶段续报备」守护测试
       （test_city_journey_stages：V5.5 仍可继续/完成 V5 站点）冲突，故不改消息流转。
       旧阶段照片混进新阶段结算的问题已在 embodied_presentation.travelMemories 按真实 log+阶段过滤解决。 */
    if(j.openingDone&&!j.nodeId&&!j.completed){
      const next=nextStop(c,j);
      if(next){
        const priorDeadline=j.waitingUntil;
        j.nextStopId=next.id;
        if(!unlocked(c,next))j.waitingUntil=0;
        else if(!j.waitingUntil){j.waitingStartedAt=Date.now();j.waitingUntil=j.waitingStartedAt+waitMs(c,next);}
        if(j.waitingUntil!==priorDeadline)persist(c);
      }
      else if(!stops(c).some(n=>!passed(j,n.id))){j.completed=true;j.waitingUntil=0;j.nextStopId=null;}
      /* 本阶段站点刷完、但后面阶段还有站点：不做成「已平安回家」，把下一章站点挂上并等它解锁。 */
      else{const gate=stops(c).find(n=>!passed(j,n.id));j.nextStopId=gate?gate.id:null;j.waitingUntil=0;j.waitingStartedAt=0;}
    }
    if(refreshHistory(c,j))migrated=true;
    if(priorWaitPolicy<waitPolicy(c)){
      if(priorWaitDeadline>0&&j.waitingUntil>0){
        const target=stops(c).find(n=>n.id===j.nextStopId);
        const now=Date.now(),validStart=value=>Number.isFinite(value)&&value>0&&value<=now;
        const marker=[...j.log].reverse().find(m=>m&&m.source&&m.source.kind==='waitHint'&&validStart(m.at));
        const start=validStart(j.waitingStartedAt)?j.waitingStartedAt:marker?marker.at:now;
        j.waitingUntil=Math.min(j.waitingUntil,start+waitMs(c,target));j.waitingStartedAt=start;
      }
      j.waitPolicyVersion=waitPolicy(c);migrated=true;
    }
    if(migrated)persist(c);
    return j;
  }
  function waitMs(c,node) {
    const fallback=finite(cfg(c).WAIT_MINUTES,3);
    const minutes=finite(node&&node.waitMinutes,fallback);
    return Math.max(0.1,Math.min(1440,minutes))*60000;
  }
  function node(c,j) {
    const p=j||ensure(c);
    if(p.nodeId==='opening')return cfg(c).OPENING||{id:'opening',label:'第一次，面对面',steps:[]};
    return stops(c).find(n=>n.id===p.nodeId)||null;
  }
  function append(j,type,value,extra) {
    j.log.push(Object.assign({type,text:String(value||''),at:Date.now()},extra||{}));
  }
  function token(c) {
    const j=ensure(c),n=node(c,j);
    return ready(c)&&!j.pendingReply&&n&&requiredVer(c,n)===contentVer(c)&&unlocked(c,n)&&n.steps[j.step]&&!j.completed?String(n.id)+':'+j.step:null;
  }
  function replyMs(c,n,step) {
    const seconds=finite(step&&step.replySeconds,finite(n&&n.replySeconds,finite(cfg(c).REPLY_SECONDS,3)));
    return Math.round(Math.max(1,Math.min(300,seconds))*1000);
  }
  function finishReply(c,j,n,pending,at) {
    const index=pending.step,value=pending.text,voice=pending.voice;
    const source={nodeId:n.id,kind:'reply',index};
    if(voice&&voice.src)append(j,'voice',value,{nodeId:n.id,step:index,source,src:voice.src,seconds:voice.seconds});
    else append(j,'text',value,{nodeId:n.id,step:index,source});
    j.seen[n.id+':'+index]=at;j.step=index+1;
    c.state.testBadgeVer=c.state.ver;
    if(j.step>=n.steps.length){
      if(n.id==='opening')j.openingDone=true;
      else if(!j.completedStops.includes(n.id))j.completedStops.push(n.id);
      if(n.departure)append(j,'system',n.departure,{source:{nodeId:n.id,kind:'departure'}});
      const next=nextStop(c,j);
      j.nodeId=null;j.step=0;j.unread=false;
      if(next){
        j.nextStopId=next.id;
        j.waitingUntil=unlocked(c,next)?at+waitMs(c,next):0;j.waitingStartedAt=j.waitingUntil?at:0;
        append(j,'system',unlocked(c,next)?n.waitHint||'请耐心等待她返回消息':lockText(c,next),unlocked(c,next)?{source:{nodeId:n.id,kind:'waitHint'}}:null);
      }
      else if(!stops(c).some(x=>!passed(j,x.id))){j.completed=true;j.nextStopId=null;j.waitingUntil=0;}
      else{
        /* 本阶段刷完、但后面阶段还有站点：不算回家，给一条「下一章锁定」提示并等待。 */
        const gate=stops(c).find(x=>!passed(j,x.id));
        j.nextStopId=gate?gate.id:null;j.waitingUntil=0;j.waitingStartedAt=0;
        if(gate)append(j,'system',lockText(c,gate),{source:{nodeId:n.id,kind:'waitHint'}});
      }
    }
  }
  function choose(c,key) {
    if(!ready(c))return{ok:false,reason:'sleeping'};
    const j=ensure(c),n=node(c,j),step=n&&n.steps[j.step];
    if(n&&!unlocked(c,n))return{ok:false,reason:'locked'};
    if(j.pendingReply)return{ok:false,reason:'pending'};
    if(!step||typeof key!=='string'||key!==token(c))return{ok:false,reason:'stale'};
    const from=j.log.length,now=Date.now();
    append(j,'user',step.option,{source:{nodeId:n.id,kind:'option',index:j.step}});
    const voice=step.replyType==='voice'&&asset(step.replySrc)?{src:asset(step.replySrc),seconds:voiceSeconds(step.replySeconds)}:null;
    j.pendingReply={nodeId:n.id,step:j.step,key:String(key),text:String(step.reply||''),voice,sentAt:now,dueAt:now+replyMs(c,n,step)};
    if(window.WhaleCare&&(j.pendingReply.text||voice))window.WhaleCare.chatSent(c);
    persist(c);
    return{ok:true,from,pending:!!j.pendingReply,replyDueAt:j.pendingReply&&j.pendingReply.dueAt,completed:j.completed,waitingUntil:j.waitingUntil};
  }
  function poll(c,at) {
    if(!ready(c))return false;
    const j=ensure(c),now=finite(at,Date.now());
    if(j.pendingReply){
      const pending=j.pendingReply,n=node(c,j);
      /* 停在别的阶段的进行中报备先冻结：只有「当前内容阶段」的站点才继续送达（回到该阶段再续）。 */
      if(!n||requiredVer(c,n)!==contentVer(c)||!unlocked(c,n)||now<pending.dueAt)return false;
      // Clear the saved envelope before delivery so repeated polls cannot duplicate it.
      j.pendingReply=null;
      finishReply(c,j,n,pending,now);j.unread=true;
      persist(c);return true;
    }
    if(j.completed||j.nodeId||!j.waitingUntil||now<j.waitingUntil)return false;
    const n=stops(c).find(x=>x.id===j.nextStopId&&!passed(j,x.id)&&requiredVer(c,x)===contentVer(c));
    if(!n||!unlocked(c,n))return false;
    // Offline time can reveal one report. The next timer starts only after its replies.
    j.nodeId=n.id;j.step=0;j.waitingUntil=0;j.nextStopId=null;j.unread=true;
    append(j,'system',n.label||n.destination||'新的旅途消息',{source:{nodeId:n.id,kind:'label'}});
    (n.arrivals||[]).forEach((m,index)=>{
      if(!m||!['text','image','voice'].includes(m.type))return;
      const source={nodeId:n.id,kind:'arrival',index};
      if(m.type==='image'){
        const src=asset(m.src);if(src)append(j,'image','',{source,src,alt:String(m.alt||n.label||'{whale}的旅途自拍'),caption:String(m.caption||n.label||'')});
      }else if(m.type==='voice'){
        const src=asset(m.src);if(src)append(j,'voice',String(m.text||''),{source,src,seconds:voiceSeconds(m.seconds)});
      }else append(j,'text',m.text,{source});
    });
    if(typeof c.recordLifeMilestone==='function')c.recordLifeMilestone('city_'+n.id,{nodeId:n.id,label:n.label,ver:requiredVer(c,n),age:(cfg(c).AGES_BY_VER||{})[requiredVer(c,n)]});
    persist(c);
    if(window.GameBus&&typeof GameBus.emit==='function')GameBus.emit('city:report',{id:n.id,label:n.label});
    return true;
  }
  function status(c,at) {
    if(!ready(c))return{kind:'sleeping',text:'休眠仓仍未开启 · 开智出舱后开始城市旅途'};
    const j=ensure(c),n=node(c,j);
    if(j.completed)return{kind:'complete',text:'已平安回家 · 明天也属于她'};
    /* 全局第一个未完成的站点（任何阶段）就是「下一章」的门：它没解锁就显示锁定提示。 */
    const gate=stops(c).find(s=>!passed(j,s.id));
    if(gate&&!unlocked(c,gate))return{kind:'locked',text:lockText(c,gate),minVer:requiredVer(c,gate)};
    /* 只有「当前内容阶段」的站点算进行中；停在别的阶段的报备视作冻结（回到该阶段才继续）。 */
    const onStage=x=>!!x&&requiredVer(c,x)===contentVer(c),active=onStage(n)?n:null;
    const pending=active||stops(c).find(s=>s.id===j.nextStopId);
    if(pending&&!unlocked(c,pending))return{kind:'locked',text:lockText(c,pending),minVer:requiredVer(c,pending)};
    if(j.pendingReply&&active){
      const seconds=Math.max(0,Math.ceil((j.pendingReply.dueAt-finite(at,Date.now()))/1000));
      return{kind:'replying',seconds,text:(active.label?active.label+' · ':'')+'正在回复',unread:false};
    }
    if(active)return{kind:active.id==='opening'?'opening':'report',text:active.label||'收到新的旅途消息',unread:j.unread};
    const next=stops(c).find(s=>s.id===j.nextStopId),left=Math.max(0,Math.ceil((j.waitingUntil-finite(at,Date.now()))/1000));
    const time=left>=60?Math.floor(left/60)+' 分 '+String(left%60).padStart(2,'0')+' 秒':left+' 秒';
    return{kind:'waiting',seconds:left,text:'正在前往'+((next&&next.destination)||'下一站')+' · 约 '+time+' 后收到报备'};
  }
  function allSeen(c) {
    const j=ensure(c),nodes=[cfg(c).OPENING,...stops(c)].filter(Boolean);
    return nodes.length>1&&j.completed&&nodes.every(n=>j.skippedStops.includes(n.id)||(n.steps||[]).every((_,i)=>Object.prototype.hasOwnProperty.call(j.seen,n.id+':'+i)));
  }
  function chapter(c) {
    const j=ensure(c),ver=contentVer(c);
    const route=stops(c).filter(s=>requiredVer(c,s)===ver),age=(cfg(c).AGES_BY_VER||{})[ver];
    const total=route.length,done=route.filter(s=>j.completedStops.includes(s.id)).length;
    const phase={V5:'初识世界','V5.5':'渐渐独立',V6:'学会担当','V6.5':'理解陪伴'}[ver]||'当前旅途';
    return {ver,age,total,done,text:phase+' · 已报备 '+done+' / '+total};
  }
  function markRead(c) {
    if(!ready(c))return;
    const j=ensure(c);if(j.unread){j.unread=false;persist(c);}
  }
  function logHTML(c,m,index,from) {
    const fresh=index>=from?' city-message-new':'';
    if(m.type==='system')return'<div class="city-system'+fresh+'">'+esc(text(c,m.text))+'</div>';
    if(m.type==='image')return'<figure class="city-photo'+fresh+'"><button type="button" data-action="city-photo" data-city-index="'+index+'" aria-label="放大查看'+esc(text(c,m.caption||'城市自拍'))+'"><img src="'+esc(asset(m.src))+'" alt="'+esc(text(c,m.alt))+'" loading="lazy" decoding="async"></button><figcaption>'+esc(text(c,m.caption))+'</figcaption></figure>';
    if(m.type==='voice'){const playing=voicePlaying&&voiceIndex===index,seconds=voiceDurations.get(asset(m.src));return'<div class="city-message city-message-whale city-voice'+fresh+(playing?' is-playing':'')+'"><div class="city-voice-controls"><button type="button" class="city-voice-play" data-action="city-voice" data-city-index="'+index+'" data-city-src="'+esc(asset(m.src))+'" aria-label="播放或暂停语音对白"><svg class="cv-wave" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9v6"/><path d="M9 5.5v13"/><path d="M14 8v8"/><path d="M19 10.5v3"/></svg><b class="cv-sec">'+(seconds?seconds+'″':'语音')+'</b></button><button type="button" class="city-voice-replay" data-action="city-voice-replay" data-city-index="'+index+'" aria-label="从头重播这条语音">↻ 重播</button></div>'+(m.text?'<span class="city-voice-cap">'+esc(text(c,m.text))+'</span>':'')+'</div>';}
    return'<div class="city-message '+(m.type==='user'?'city-message-me':'city-message-whale')+fresh+'">'+esc(text(c,m.text))+'</div>';
  }
  /* 2026-10-16 用户要求：旅行小鲸鱼头像所有阶段统一用同一张，不再随阶段切换 */
  const TRAVEL_PORTRAIT='resource/character/whale_头像.webp';
  function headerHTML(c,st) {
    return '<header class="city-chat-head"><img src="'+esc(asset(TRAVEL_PORTRAIT))+'" alt="'+esc(c.whaleName())+'"><div><p data-city-status>'+esc(text(c,headerText(c,st)))+'</p></div><span class="city-chat-dot" aria-hidden="true"></span></header>';
  }
  function controlsInner(c,st,step,key) {
    return step
      ?'<button type="button" class="city-reply" data-action="city-reply" data-city-token="'+esc(key)+'">'+esc(text(c,step.option))+'<span aria-hidden="true">↗</span></button>'
      :'<div class="city-waiting"'+(st.kind==='waiting'?' role="timer"':st.kind==='replying'?' role="status"':'')+'>'+(st.kind==='replying'?'<span class="city-typing-dots" aria-hidden="true"><b></b><b></b><b></b></span>':'<i aria-hidden="true">'+idleIcon(st)+'</i>')+'<span data-city-waiting>'+esc(text(c,idleText(st)))+'</span></div>';
  }
  /* 2026-10-16 用户要求：旅行聊天只显示「当前内容阶段」的消息 —— 回到某阶段就显示当初解锁到的位置。
     无法归属站点的旧存档行保留（不能丢玩家真实收到过的记录）。 */
  function visibleLog(c,j){
    const nodes=new Map([cfg(c).OPENING,...stops(c)].filter(Boolean).map(n=>[n.id,n]));
    return j.log.filter(row=>{const n=nodes.get(row&&row.nodeId);return !n||requiredVer(c,n)===contentVer(c);});
  }
  // The UI may miss the single poll that delivered a report (reopen/load or an
  // interrupted render). Compare the saved cursor, not just that poll's return.
  function revision(c,j) {
    return JSON.stringify([contentVer(c),j.log.length,j.nodeId,j.step,j.nextStopId,
      j.pendingReply&&j.pendingReply.dueAt,j.openingDone,j.completed]);
  }
  function bodyHTML(c,from=Infinity) {
    const st=status(c);
    if(st.kind==='sleeping')return'<section class="city-sleeping"><img src="resource/character/whale_pod.webp" alt="封闭的休眠仓"><h2>等她真正醒来，再一起看看世界</h2><p>正式立项并完成具身开智训练后，'+esc(c.whaleName())+'会走出休眠仓。这段面对面的相遇，将开启她自己的城市旅途。</p></section>';
    const j=ensure(c),n=node(c,j),key=token(c),step=key&&n&&n.steps[j.step];
    const rows=visibleLog(c,j);
    const prompt=rows.length?'':'你们终于可以面对面地聊一聊了。';
    return'<section class="city-chat" data-city-revision="'+esc(revision(c,j))+'" data-city-kind="'+esc(st.kind)+'">'+headerHTML(c,st)
      +'<div class="city-messages" id="cityMessages" role="log" aria-label="旅行小鲸鱼聊天记录">'+(prompt?'<p class="city-chat-empty">'+prompt+'</p>':'')+rows.map((m,i)=>logHTML(c,m,i,from)).join('')+'</div>'
      +'<footer class="city-chat-controls">'+controlsInner(c,st,step,key)+'</footer></section>';
  }
  function syncVoiceClass(){const box=page.getElementById('cityMessages');if(!box)return;[...box.querySelectorAll('.city-voice')].forEach(el=>{const btn=el.querySelector('.city-voice-play'),i=btn?Number(btn.dataset.cityIndex):-1,seconds=btn&&voiceDurations.get(btn.dataset.citySrc),sec=el.querySelector('.cv-sec');el.classList.toggle('is-playing',voicePlaying&&i===voiceIndex);if(sec&&seconds)sec.textContent=seconds+'″';});}
  function stopVoice(){voicePlaying=false;voiceIndex=null;syncVoiceClass();}
  function ensurePlayer(){if(voicePlayer)return voicePlayer;try{voicePlayer=new Audio();voicePlayer.preload='none';voicePlayer.addEventListener('ended',stopVoice);voicePlayer.addEventListener('loadedmetadata',()=>{if(voicePlayer&&Number.isFinite(voicePlayer.duration)&&voicePlayer.duration>0){voiceDurations.set(voiceSrc,Math.max(1,Math.round(voicePlayer.duration)));if(voiceDurations.size>32)voiceDurations.delete(voiceDurations.keys().next().value);syncVoiceClass();}});}catch(e){voicePlayer=null;}return voicePlayer;}
  function playVoice(c,index){const j=ensure(c),m=j.log[index];if(!m||m.type!=='voice')return false;const src=asset(m.src);if(!src)return false;const player=ensurePlayer();if(!player)return false;
    const request=++voiceRequest;
    try{if(ui&&typeof ui.pauseChatVoice==='function')ui.pauseChatVoice();player.pause();if(voiceSrc!==src){voiceSrc=src;player.src=src;}player.currentTime=0;voiceIndex=index;voicePlaying=true;syncVoiceClass();const p=player.play();if(p&&p.catch)p.catch(()=>{if(request===voiceRequest)stopVoice();});return true;}catch(e){if(request===voiceRequest)stopVoice();return false;}}
  function pauseVoice(){voiceRequest++;if(voicePlayer)try{voicePlayer.pause();}catch(_){}stopVoice();}
  function replayVoice(c,index){return playVoice(c,index);}
  function toggleVoice(c,index){if(voicePlaying&&voiceIndex===index)pauseVoice();else playVoice(c,index);}
  // 新出现的语音消息自动播一次；播不动（浏览器手势策略）时保留气泡可点按重播。
  function autoplayVoices(c,box){if(!box)return;const j=ensure(c);[...box.querySelectorAll('.city-voice.city-message-new')].forEach(el=>{const btn=el.querySelector('[data-city-index]'),i=btn?Number(btn.dataset.cityIndex):-1,m=j.log[i];if(!m||m.type!=='voice'||!asset(m.src))return;const key=voiceKey(m);if(voicePlayed.has(key))return;voicePlayed.add(key);if(voicePlayed.size>64)voicePlayed.delete(voicePlayed.values().next().value);playVoice(c,i);});}
  let viewer=null,viewerKeydown=null,viewerOwner=null,viewerFocus=null,disposed=false;
  function closePhoto() {
    if(viewer)viewer.remove();viewer=null;viewerOwner=null;
    if(viewerKeydown)page.removeEventListener('keydown',viewerKeydown,true);viewerKeydown=null;
    const focus=viewerFocus;viewerFocus=null;if(!disposed&&surface.document===page&&focus&&focus.isConnected&&typeof focus.focus==='function')focus.focus({preventScroll:true});
  }
  function openPhoto(c,index) {
    if(disposed||surface.document!==page||!page.body)return false;
    const m=ensure(c).log[index];if(!m||m.type!=='image'||!asset(m.src))return false;
    closePhoto();viewerOwner=c.state;viewerFocus=page.activeElement;
    viewer=page.createElement('section');viewer.className='city-photo-viewer';viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-label',text(c,m.caption||'城市自拍'));
    viewer.innerHTML='<button type="button" class="city-photo-close" aria-label="关闭自拍">×</button><figure><img src="'+esc(asset(m.src))+'" alt="'+esc(text(c,m.alt))+'"><figcaption>'+esc(text(c,m.caption))+'</figcaption></figure>';
    page.body.appendChild(viewer);
    viewer.addEventListener('click',e=>{if(e.target===viewer||e.target.closest('.city-photo-close'))closePhoto();e.stopPropagation();});
    viewerKeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePhoto();}else if(e.key==='Tab'&&viewer){e.preventDefault();viewer.querySelector('button').focus({preventScroll:true});}};page.addEventListener('keydown',viewerKeydown,true);
    viewer.querySelector('button').focus({preventScroll:true});return true;
  }
  const messageScrolls=new WeakMap();
  function nearMessageEnd(box){return box.scrollHeight-box.clientHeight-box.scrollTop<=8;}
  // Follow a new message only while reading the tail. A gesture owns the
  // position immediately, including while images or queued frames settle.
  function scrollMessagesToEnd(box) {
    if(!box)return;
    let state=messageScrolls.get(box);
    if(!state){
      state={generation:0};messageScrolls.set(box,state);
      const cancel=()=>{state.generation++;};
      for(const event of ['pointerdown','touchstart','wheel','keydown'])box.addEventListener(event,cancel,{passive:true});
    }
    const generation=++state.generation;let last=box.scrollTop,height=box.scrollHeight,client=box.clientHeight;
    const stick=()=>{
      if(!box.isConnected||state.generation!==generation)return;
      if(Math.abs(box.scrollTop-last)>1&&box.scrollHeight===height&&box.clientHeight===client){state.generation++;return;}
      box.scrollTop=box.scrollHeight;last=box.scrollTop;height=box.scrollHeight;client=box.clientHeight;
    };
    stick();
    if(window.requestAnimationFrame)window.requestAnimationFrame(()=>{stick();window.requestAnimationFrame(stick);});
    box.querySelectorAll('img').forEach(img=>{if(!img.complete){img.addEventListener('load',stick,{once:true});img.addEventListener('error',stick,{once:true});}});
  }
  function renderedCount(box){return box?box.querySelectorAll('.city-message,.city-system,.city-photo,.city-voice').length:0;}
  /* 增量刷新：只往 .city-messages 末尾补新消息；头/控制区仅在签名变化时重建。
     整块正文 innerHTML 重建会让图片重新解码、滚动弹回中间（用户反馈的「闪一下 / 跳到中间」）。 */
  function refreshCityBody(u) {
    if(!u||!u.el||!u.core)return false;
    const root=u.el.querySelector('.city-chat'),box=u.el.querySelector('#cityMessages');
    if(!root||!box)return false;
    const follow=nearMessageEnd(box);
    const j=ensure(u.core),rows=visibleLog(u.core,j),total=rows.length,from=renderedCount(box);
    if(total<from)return false;                 // 可见消息比已渲染的少（切阶段/重开/清空）→ 交给整块重建
    if(total>from){
      const html=rows.slice(from,total).map((m,i)=>logHTML(u.core,m,from+i,from)).join('');
      if(html)box.insertAdjacentHTML('beforeend',html);
      const empty=box.querySelector('.city-chat-empty');if(empty)empty.remove();
    }
    autoplayVoices(u.core,box);
    const st=status(u.core),n=node(u.core,j),key=token(u.core),step=key&&n&&n.steps[j.step];
    root.dataset.cityKind=st.kind;
    const sig=[st.kind,key||'',step?step.option:'',idleText(st)].join('|');
    const controlsChanged=root.dataset.citySig!==sig;
    if(controlsChanged){const ctrl=root.querySelector('.city-chat-controls');if(ctrl)ctrl.innerHTML=controlsInner(u.core,st,step,key);root.dataset.citySig=sig;}
    root.dataset.cityRevision=revision(u.core,j);
    if(follow&&(total>from||controlsChanged))scrollMessagesToEnd(box);
    return true;
  }
  function decorate(u,scroll) {
    if(!u||!u.el||!enabled(u.core))return;
    const root=u.el.querySelector('.city-chat'),box=u.el.querySelector('#cityMessages');
    if(root&&box){autoplayVoices(u.core,box);if(scroll)scrollMessagesToEnd(box);}
  }
  function updateStatus(u) {
    const root=u.el&&u.el.querySelector('.city-chat');if(!root)return;
    const target=root.querySelector('[data-city-status]'),st=status(u.core);
    if(target&&target.textContent!==text(u.core,headerText(u.core,st)))target.textContent=text(u.core,headerText(u.core,st));
    root.dataset.cityKind=st.kind;
    const wait=root.querySelector('.city-waiting'),hint=root.querySelector('[data-city-waiting]');
    if(hint&&hint.textContent!==text(u.core,idleText(st)))hint.textContent=text(u.core,idleText(st));
    if(wait){
      const icon=wait.querySelector('i');if(icon&&icon.textContent!==idleIcon(st))icon.textContent=idleIcon(st);
      if(st.kind==='waiting')wait.setAttribute('role','timer');else if(st.kind==='replying')wait.setAttribute('role','status');else wait.removeAttribute('role');
    }
  }
  const api={cfg,enabled,ready,ensure,node,token,choose,poll,status,allSeen,chapter,markRead,waitMs,replyMs,requiredVer,unlocked,contentVer,bodyHTML,openPhoto,closePhoto,decorate,playVoice,replayVoice,pauseVoice,toggleVoice,voiceState:()=>({playing:voicePlaying,index:voiceIndex,src:voiceSrc})};
  window.CityJourney=api;
  if(!ui||!coreAPI)return;
  const canTest=coreAPI.canTest;
  coreAPI.canTest=function(){return enabled(this)?true:canTest.apply(this,arguments);};
  const oldAchv=coreAPI.achvChatAllSeen;
  coreAPI.achvChatAllSeen=function(){
    const C=cfg(this);if(C.ENABLED===false||!Array.isArray(C.STOPS)||!C.STOPS.length)return oldAchv.apply(this,arguments);
    const byVer=((this.cfg.CHAT_TREE2||{}).BY_VER)||{},order=this.cfg.VER_ORDER||['V1'],first=order.indexOf('V5'),seen=(this.state.c2&&this.state.c2.seen)||{},need=[];
    order.filter((_,i)=>first<0||i<first).forEach(v=>Object.values((byVer[v]||{}).opts||{}).forEach(o=>['dumb','full'].forEach(k=>((o.ans||{})[k]||[]).forEach(a=>{if(a&&a.id!=null&&!need.includes(String(a.id)))need.push(String(a.id));}))));
    return need.length>0&&need.every(id=>Object.prototype.hasOwnProperty.call(seen,id))&&allSeen(this);
  };
  const modalMeta=ui.officeModalMeta;
  ui.officeModalMeta=function(key){const meta=modalMeta.apply(this,arguments);if(key==='test'&&enabled(this.core))return Object.assign({},meta,{title:'旅行小鲸鱼',bodyClass:'test-modal-body city-journey-body',footer:''});return meta;};
  const omTest=ui.omTest;
  ui.omTest=function(){if(!enabled(this.core))return omTest.apply(this,arguments);const from=this._cityAnimateFrom==null?Infinity:this._cityAnimateFrom;this._cityAnimateFrom=Infinity;return bodyHTML(this.core,from);};
  const omOpen=ui.omTestOpen;
  ui.omTestOpen=function(){if(!enabled(this.core))return omOpen.apply(this,arguments);poll(this.core);markRead(this.core);this._cityAnimateFrom=Infinity;};
  const restart=ui.omTestRestart,reset=ui.resetOmTestChat;
  ui.omTestRestart=function(){if(enabled(this.core))return false;return restart.apply(this,arguments);};
  ui.resetOmTestChat=function(){if(enabled(this.core))return false;return reset.apply(this,arguments);};
  const end=ui.omTestEnd;
  ui.omTestEnd=function(){if(!enabled(this.core))return end.apply(this,arguments);this.core.state.officeModal=null;this.closeOfficeModal();this.render({soft:true});};
  const actions=ui.officeActions;
  ui.officeActions=function(){return actions.apply(this,arguments).map(a=>{if(a.key!=='test'||!enabled(this.core))return a;const j=ready(this.core)?ensure(this.core):null,st=status(this.core);return Object.assign({},a,{label:'旅行小鲸鱼',disabled:false,badge:j&&j.unread&&st.kind!=='locked'?'新报备':j&&!j.openingDone?'新旅途':null,tip:st.kind==='locked'?text(this.core,st.text):ready(this.core)?'与'+this.core.whaleName()+'的旅途保持联系':'具身开智后开启旅行小鲸鱼'});});};
  const after=ui.afterModalRender;
  ui.afterModalRender=function(){const result=after.apply(this,arguments);if(enabled(this.core)&&this.core.state.officeModal==='test')decorate(this,true);return result;};
  /* 旅行聊天就地增量刷新（避免整块重建导致的闪烁）；其余面板仍走原刷新路径。 */
  const originalRefreshBody=ui.refreshOfficeBody;
  ui.refreshOfficeBody=function(){
    if(enabled(this.core)&&ready(this.core)&&this.core.state.officeModal==='test'&&refreshCityBody(this))return;
    return originalRefreshBody.apply(this,arguments);
  };
  const close=ui.closeOfficeModal;
  ui.closeOfficeModal=function(){pauseVoice();if(typeof this.pauseChatVoice==='function')this.pauseChatVoice();closePhoto();return close.apply(this,arguments);};
  const onClick=ui.onClick;
  ui.onClick=function(e){
    const t=e.target&&e.target.closest?e.target.closest('[data-action]'):null,act=t&&t.dataset.action;
    if(enabled(this.core)&&['city-reply','city-photo','city-voice','city-voice-replay','om-test-clear','om-test-restart','om-test-opt','chat-panel','chat-send-media'].includes(act)){
      this._clickHandled=true;this._pressTarget=null;if(e.preventDefault)e.preventDefault();if(e.stopPropagation)e.stopPropagation();
      if(act==='city-photo'){openPhoto(this.core,Number(t.dataset.cityIndex));return;}
      if(act==='city-voice'){toggleVoice(this.core,Number(t.dataset.cityIndex));return;}
      if(act==='city-voice-replay'){replayVoice(this.core,Number(t.dataset.cityIndex));return;}
      if(act!=='city-reply')return;
      const r=choose(this.core,t.dataset.cityToken);if(!r.ok)return;
      this._cityAnimateFrom=r.from;sound('click');this.refreshOfficeBody();decorate(this,true);const reply=this.el&&this.el.querySelector('[data-action="city-reply"]');if(reply)reply.focus({preventScroll:true});if(this.updateOfficeMain)this.updateOfficeMain();return;
    }
    return onClick.apply(this,arguments);
  };
  const service=()=>{
    if(disposed||surface.document!==page)return;
    if(!ui.core||!ui.core.state)return;
    if(viewer&&(viewerOwner!==ui.core.state||ui.core.state.officeModal!=='test'||ui.core.state.phase!=='office'))closePhoto();
    if(!enabled(ui.core))return;
    const j=ready(ui.core)?ensure(ui.core):null,from=j?j.log.length:0,arrived=poll(ui.core);
    if(arrived){
      if(ui.core.state.phase==='office'&&ui.core.state.officeModal==='test'){
        markRead(ui.core);ui._cityAnimateFrom=from;ui.refreshOfficeBody();decorate(ui,false);
      }
      if(ui.core.state.phase==='office'&&ui.updateOfficeMain)ui.updateOfficeMain();
      if(!page.hidden)sound('ui');
    }
    if(j&&ui.core.state.phase==='office'&&ui.core.state.officeModal==='test'){
      const root=ui.el&&ui.el.querySelector('.city-chat');
      if(root&&root.dataset.cityRevision!==revision(ui.core,j)){
        markRead(ui.core);ui.refreshOfficeBody();decorate(ui,false);
      }
    }
    updateStatus(ui);
  };
  let timer=surface.setInterval(service,1000);
  const visible=()=>{
    if(disposed||surface.document!==page||page.hidden)return;
    if(timer==null)timer=surface.setInterval(service,1000);
    service();
  };
  function dispose(){if(disposed)return;disposed=true;pauseVoice();if(voicePlayer){if(voicePlayer.removeAttribute)voicePlayer.removeAttribute('src');voicePlayer=null;}voiceDurations.clear();voicePlayed.clear();surface.clearInterval(timer);timer=null;page.removeEventListener('visibilitychange',visible);surface.removeEventListener('pagehide',pagehide);surface.removeEventListener('pageshow',visible);closePhoto();}
  // Mobile hosts can hide and then restore the same document even without a
  // persisted BFCache entry. Suspension must not permanently destroy polling.
  function pagehide(){pauseVoice();closePhoto();surface.clearInterval(timer);timer=null;}
  page.addEventListener('visibilitychange',visible);surface.addEventListener('pagehide',pagehide);surface.addEventListener('pageshow',visible);
  api.dispose=dispose;
  api.service=service;
})();
