/* Physical companion: explicit opt-in, existing business actions, real-time animation. */
(function () {
  'use strict';
  if (window.WhaleAutoCare) return;
  const own = new WeakMap(), tutorialSessions = new WeakMap(), kinds = ['talk', 'raise', 'rest', 'meeting', 'team'];
  const finite = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentUI = () => window.GameUI;
  function settings(core) {
    const cfg = ((core && core.cfg && core.cfg.WHALE_CARE) || {}).AUTOMATION || {};
    return { enabled: cfg.ENABLED !== false,
      threshold: clamp(Math.floor(finite(cfg.ENERGY_THRESHOLD, 80)), 0, 100),
      restThreshold: clamp(Math.floor(finite(cfg.REST_THRESHOLD, 30)), 0, 100),
      teamThreshold: clamp(Math.floor(finite(cfg.TEAM_THRESHOLD, 80)), 0, 100),
      costs: Object.fromEntries(kinds.map(kind => [kind, clamp(Math.floor(finite((cfg.ENERGY_COSTS || {})[kind], kind === 'meeting' ? 8 : kind === 'team' ? 12 : 5)), 1, window.WhaleCare ? WhaleCare.energyStatus(core).max : 100)])),
      interval: clamp(finite(cfg.INTERVAL_SECONDS, 1), 1, 3600) * 1000 };
  }
  function unlocked(core) {
    if (!core || !core.state || !window.WhaleCare || !WhaleCare.bodyAvailable(core) || !settings(core).enabled) return false;
    const era = core.state.embodiedEra;
    return !!(era && era.bodyAwakened && era.podExitSeen);
  }
  function ensure(core) {
    const care = window.WhaleCare && WhaleCare.ensure(core);
    if (!care) return null;
    if (!care.automation || typeof care.automation !== 'object' || Array.isArray(care.automation)) care.automation = {};
    for (const kind of kinds) care.automation[kind] = care.automation[kind] === true;
    return care.automation;
  }
  function enabled(core) {
    return unlocked(core) && kinds.some(kind => (core.state.care.automation || {})[kind] === true);
  }
  function energyAvailable(core) {
    if (!enabled(core)) return false;
    const prefs=core.state.care.automation||{}, cfg=settings(core), energy=WhaleCare.energyStatus(core).value;
    return kinds.some(kind => prefs[kind] === true && energy >= cfg.costs[kind]);
  }
  function save(core) {
    const ui = currentUI();
    if (ui && ui.core === core && ui.save && ui.save.autoSave) ui.save.autoSave(core.state);
  }
  function guideState(core) {
    if (!unlocked(core)) return null;
    const care=WhaleCare.ensure(core);
    ensure(core);
    if (!care.automationTutorial || typeof care.automationTutorial!=='object' || Array.isArray(care.automationTutorial))
      care.automationTutorial={version:1,step:0,done:false};
    const guide=care.automationTutorial;
    guide.version=1;guide.step=clamp(Math.floor(finite(guide.step,0)),0,3);guide.done=guide.done===true;
    return guide;
  }
  function guideRuntime(core) {
    let run=tutorialSessions.get(core);
    if(!run || run.state!==core.state){if(run&&run.panel)run.panel.close();run={state:core.state,panel:null,snoozed:false,handoff:false};tutorialSessions.set(core,run);}
    return run;
  }
  function guideStep(core) {const g=guideState(core);return g&&!g.done?g.step:null;}
  function guideMark(core,step,done) {const g=guideState(core);if(!g)return false;g.step=clamp(step,0,3);g.done=done===true;save(core);return true;}
  function guideHTML(core, compact) {
    const step=guideStep(core);if(step==null)return '';
    const character=core.whaleName(),cfg=settings(core),energy=WhaleCare.energyStatus(core),pages=[
      ['从今天起，我也能照顾大家了','有了身体，'+character+'可以走到同事身边，帮团队恢复元气。所有托管选项都由你亲自决定。'],
      ['打开「体力管理」','在下面找到聊天右侧的「体力管理」。点进去，选择你愿意交给她的安排。'],
      ['先试试免费的「先聊一聊」','点击下方第一项开关。工程师体力低于 '+cfg.threshold+'，且谈心冷却结束时，她会逐个去陪他们聊天。'],
      [character+'已经准备好了','免费谈心托管已开启。加薪和休假仍保持你自己的选择，不会因为完成教程而自动开启。关闭鲸鱼房回到办公室，就能看到她走到工位旁举起魔法棒。']
    ],page=pages[step];
    if(compact){
      const line=step===3?'免费谈心已开启，付费安排由你自行选择。':step===2?'开启「先聊一聊」，她就会逐个照顾体力不足的同事。':page[1];
      return '<section class="care-auto-guide care-auto-guide-compact" aria-label="团队托管新手引导"><div><small>第一次值班 · '+(step+1)+' / 4</small><p>'+esc(line)+'</p></div><div class="care-auto-guide-actions">'+(step===3?'<button type="button" class="dg-btn dg-btn-primary" data-care-action="guide-finish">完成</button>':step===1?'<button type="button" class="dg-btn dg-btn-primary" data-care-action="page" data-id="automation">开启托管</button>':'')+'<button type="button" class="dg-btn" data-care-action="guide-skip">跳过</button></div></section>';
    }
    return '<section class="care-auto-guide" aria-label="团队托管新手引导"><small>'+esc(character)+'的第一次值班 · '+(step+1)+' / 4</small><h3>'+esc(page[0])+'</h3><p>'+esc(page[1])+'</p><p>她的体力 '+energy.value+' / '+energy.max+'；每次谈心消耗 '+cfg.costs.talk+' 点，投喂可恢复。</p>'
      +(step===3?'<p>「加薪补充元气」会扣除经费并永久提高月薪，只有你主动开启才执行。</p>':'')
      +'<div class="care-auto-guide-actions">'+(step===0?'<button type="button" class="dg-btn dg-btn-primary" data-care-action="guide-enter">进入鲸鱼房 →</button>':step===1?'<button type="button" class="dg-btn dg-btn-primary" data-care-action="page" data-id="automation">打开体力管理 →</button>':step===3?'<button type="button" class="dg-btn dg-btn-primary" data-care-action="guide-finish">完成引导</button>':'')
      +'<button type="button" class="dg-btn" data-care-action="guide-skip">跳过引导</button></div></section>';
  }
  function guideDismiss(core) {if(core&&core.state)guideRuntime(core).snoozed=true;}
  function guideAction(core,action) {
    if(guideStep(core)==null)return false;
    const run=guideRuntime(core);
    if(action==='guide-enter'){
      guideMark(core,1,false);run.handoff=true;if(run.panel)run.panel.close();run.handoff=false;run.snoozed=false;
      return !!(window.WhaleRoom&&WhaleRoom.open('affection'));
    }
    if(action==='guide-skip'||action==='guide-finish'){
      guideMark(core,3,true);run.handoff=true;if(run.panel)run.panel.close();run.handoff=false;
      if(window.WhaleRoom&&WhaleRoom.isOpen())WhaleRoom.refresh();return true;
    }
    return false;
  }
  function guidePage(core,page) {
    const step=guideStep(core);if(step==null)return;
    if(page==='automation'&&(step===0||step===1))guideMark(core,(ensure(core)||{}).talk?3:2,false);
  }
  function guideToggle(core,kind,isOn) {
    const step=guideStep(core);if(step==null||kind!=='talk')return;
    if(isOn&&(step===1||step===2))guideMark(core,3,false);
    if(!isOn&&step===3)guideMark(core,2,false);
  }
  function guidePoll() {
    const ui=currentUI(),core=ui&&ui.core,s=core&&core.state;
    if(!s||s.phase!=='office'||!window.V2Panels||guideStep(core)==null)return false;
    const run=guideRuntime(core);
    if(run.snoozed||run.panel||s.officeModal||s.minigame||s.pendingEvent||ui._confirmOpen||ui._embodiedPodExitBusy||document.hidden
      ||window.WhaleRoom&&WhaleRoom.isOpen()||window.OfficeMore&&OfficeMore.isOpen()
      ||document.querySelector('.modal-mask,.dg-modal-mask,.set-pop-mask,.v2b-panel-host,.ev-spawn,.insp-overlay,.sub-modal-overlay,.embodied-overlay,.chat-zoom-mask,.nw-lightbox'))return false;
    if(guideStep(core)>0)return !!(window.WhaleRoom&&WhaleRoom.open(guideStep(core)===1?'affection':'automation'));
    if(window.OfficePause)OfficePause.sourceNames['autocare-tutorial']='托管新手引导';
    const release=window.OfficePause?OfficePause.acquire(core,'autocare-tutorial'):()=>{};
    try{run.panel=V2Panels.open({title:core.whaleName()+'想帮帮忙',icon:'heart',className:'care-auto-tutorial-card',layout:'responsive',body:guideHTML(core),onClose(){run.panel=null;release();if(!run.handoff)run.snoozed=true;}});
      run.panel.body.addEventListener('click',e=>{const target=e.target.closest('[data-care-action]');if(!target)return;e.preventDefault();e.stopPropagation();ui._clickHandled=true;ui._pressTarget=null;if(window.SFX)SFX.play('click');guideAction(core,target.dataset.careAction);});
    }catch(e){release();throw e;}
    return true;
  }
  function toggle(core, kind) {
    if (!kinds.includes(kind) || !unlocked(core)) return {ok:false, tip:'具身开智出舱后可管理团队体力'};
    const prefs = ensure(core); prefs[kind] = !prefs[kind];
    guideToggle(core,kind,prefs[kind]);save(core); decorate();
    return {ok:true, enabled:prefs[kind], tip:({talk:'自动谈心',raise:'自动加薪',rest:'自动休假',meeting:'自动聚餐',team:'自动团队旅游'})[kind] + (prefs[kind] ? '已开启' : '已关闭') + (prefs[kind] && !energyAvailable(core) ? '，'+core.whaleName()+'体力不足，等待投喂' : '')};
  }
  function operable(core, finishing) {
    const s = core && core.state;
    if (!enabled(core) || (!finishing && !energyAvailable(core)) || !s || s.phase !== 'office' || !s.planDone || s.minigame || s.pendingEvent) return false;
    // Ordinary menus may pause production, but never cancel an opted-in care batch.
    if(s.officePaused){const pause=window.OfficePause,view=pause&&pause.status(core);
      if(!view||view.manual||!view.sources.length||view.sources.some(source=>!['factory','whale-room'].includes(source)))return false;}
    if (typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden')) return false;
    if (core.offworkNow && core.offworkNow()) return false;
    if (core.guidePending && core.guidePending()) return false;
    const ui = currentUI();
    if (ui && ui.core === core && (ui._embodiedPodExitBusy || ui._v2aDrag || ui._v2aReturnFrame)) return false;
    return true;
  }
  function onDuty(core, e) {
    const s = core.state;
    return !!e && !e.resigned && e.restWeek !== (s.week || 0)
      && (e.joinTick == null || s.v35 && finite(s.v35.tick, 0) >= e.joinTick);
  }
  function quote(core, kind, id) {
    const prefs = core.state && core.state.care && core.state.care.automation || {};
    if (!kinds.includes(kind) || !operable(core) || prefs[kind] !== true) return null;
    const cfg = settings(core);
    if (WhaleCare.energyStatus(core).value < cfg.costs[kind]) return null;
    if (kind === 'meeting' || kind === 'team') {
      const crew=(core.state.engineers||[]).filter(e=>onDuty(core,e));
      if(!crew.length || crew.reduce((n,e)=>n+clamp(finite(e.energy,0),0,100),0)/crew.length >= cfg.teamThreshold) return null;
      const tb=core.state.tbRound||{},week=core.absWeek?core.absWeek():finite(core.state.week,0);
      if(kind==='team'?tb.team===true:tb.meetingWeek!=null&&week-tb.meetingWeek<2)return null;
      const cost=kind==='team'?Math.max(0,finite((core.cfg.TEAM_BUILD||{}).TEAM_COST,100000)):0;
      if(finite(core.state.funding,0)<cost)return null;
      return {kind,id:null,name:kind==='team'?'团队旅游':'聚餐',cost,whaleEnergyCost:cfg.costs[kind]};
    }
    const e = (core.state.engineers || []).find(e => e.id === id);
    if (!onDuty(core, e)) return null;
    const energy = clamp(finite(e.energy, 0), 0, 100), used = core.arrangeUsed(e);
    if (energy >= (kind === 'rest' ? Math.min(cfg.threshold, cfg.restThreshold) : cfg.threshold) || used[kind]) return null;
    const cost = kind === 'raise' ? Math.max(1000, Math.round(finite(e.salary, 0) * .1)) : 0;
    if (finite(core.state.funding, 0) < cost) return null;
    return {kind, id, name:e.name, energy, cost, whaleEnergyCost:cfg.costs[kind]};
  }
  const actionKey=q=>q.kind+':'+(q.id==null?'team':q.id);
  function nextAction(core, visited) {
    if (!operable(core)) return null;
    const crew = (core.state.engineers || []).filter(e => onDuty(core, e)).slice().sort((a,b) => finite(a.energy,0)-finite(b.energy,0));
    for (const kind of ['talk','raise','rest']) for (const e of crew) { const q = quote(core, kind, e.id); if (q && (!visited || !visited.has(actionKey(q)))) return q; }
    for(const kind of ['meeting','team']){const q=quote(core,kind);if(q&&(!visited||!visited.has(actionKey(q))))return q;}
    return null;
  }
  function execute(core, action) {
    const q = action && quote(core, action.kind, action.id);
    if (!q) return {ok:false, tip:'安排条件已变化，本次跳过'};
    const crew=(core.state.engineers||[]).filter(e=>!e.resigned),before=new Map(crew.map(e=>[e.id,finite(e.energy,0)])),funding=core.state.funding;
    const collective=q.kind==='meeting'||q.kind==='team';
    const fn = {talk:'arrangeEngineer',raise:'raiseSalary',rest:'restEngineer'}[q.kind];
    if (collective?typeof core.doTeamBuild!=='function':!fn||typeof core[fn]!=='function') return {ok:false, tip:'这项安排暂不可用'};
    const result = collective?core.doTeamBuild(q.kind):core[fn](q.id);
    if (!result || !result.ok) return result || {ok:false};
    const care = WhaleCare.ensure(core); care.energy = Math.max(0, care.energy - q.whaleEnergyCost);
    const gains=crew.filter(e=>collective||e.id===q.id).map(e=>({id:e.id,name:e.name,gain:Math.round(Math.max(0,finite(e.energy,0)-before.get(e.id)))}));
    const prefs = ensure(core);
    prefs.last = {id:q.id, name:q.name, kind:q.kind, gain:collective?null:(gains[0]||{}).gain||0, gains, cost:Math.round(Math.max(0,funding-core.state.funding)), whaleEnergyCost:q.whaleEnergyCost, week:core.absWeek ? core.absWeek() : finite(core.state.week,0), pending:q.kind==='rest'};
    save(core);
    if (window.GameBus) GameBus.emit('care:managed', {...prefs.last});
    return {...result, ...prefs.last};
  }
  function panelTab(core, tab) {
    const r=runtime(core);r.panelTab=tab==='team'?'team':'personal';return r.panelTab;
  }
  function panelHTML(core) {
    const cfg = settings(core), prefs = ensure(core) || {}, open = unlocked(core), tb = core.cfg.TEAM_BUILD || {}, energy=WhaleCare.energyStatus(core), tab=runtime(core).panelTab||'personal';
    const boost = core.raiseProductionCfg ? core.raiseProductionCfg() : {weeks:4,mul:1.5};
    const controls = tab==='team' ? [
      ['meeting','一起聚餐','免费 · 全员体力 +8','平均体力低于 '+cfg.teamThreshold+' 时安排，每两周一次。'],
      ['team','团队旅游','每次 '+Math.round(finite(tb.TEAM_COST,100000)).toLocaleString('zh-CN')+' 元 · 全员体力 +10','平均体力低于 '+cfg.teamThreshold+' 时安排，每周一次。开启即允许自动扣费。']
    ] : [
      ['talk','先聊一聊','免费 · 体力 +' + Math.round(finite(tb.TALK_ENERGY,12)), '体力低于 ' + cfg.threshold + '，两周冷却结束后逐人安排。'],
      ['raise','加薪补充元气','体力 +' + Math.round(finite(tb.RAISE_ENERGY,30)) + ' · 每人每月一次', '体力低于 '+cfg.threshold+' 时，支付月薪 10%（最低 1,000 元），月薪永久增加相同金额。'],
      ['rest','安排休假','免费 · 本周停止产出', '体力低于 ' + Math.min(cfg.threshold,cfg.restThreshold) + ' 时休假，下周上班恢复体力 +' + Math.round(finite(tb.REST_ENERGY,35)) + '。']
    ];
    const last=prefs.last,collective=last&&(last.kind==='team'||last.kind==='meeting');
    return '<section class="care-auto-console" data-care-auto-tab="'+tab+'"><div class="care-auto-energy"><span>'+esc(core.whaleName())+'的体力</span><b>'+energy.value+' / '+energy.max+'</b><small>'+(!open?'出舱后开放':enabled(core)&&!energyAvailable(core)?'等待投喂':'投喂恢复')+'</small></div>'
      +'<nav class="care-auto-tabs" aria-label="托管项目"><button type="button" data-care-action="auto-tab" data-id="personal" aria-pressed="'+(tab==='personal')+'">个人照顾</button><button type="button" data-care-action="auto-tab" data-id="team" aria-pressed="'+(tab==='team')+'">团队活动</button></nav>'
      + '<div class="care-auto-options">' + controls.map(([id,title,benefit,desc]) => '<button type="button" class="care-auto-option'+(prefs[id]?' is-on':'')+'" data-care-action="auto-toggle" data-id="'+id+'" role="switch" aria-checked="'+!!prefs[id]+'"'+(!open?' disabled':'')+'><span class="care-auto-option-head"><b>'+title+'</b><span class="care-auto-switch" aria-hidden="true">'+(prefs[id]?'已开启':'已关闭')+'</span></span><strong>'+benefit+'</strong><span class="care-auto-description">'+desc+'</span><small>她的体力 −'+cfg.costs[id]+(id==='raise'?' · 涨薪后 '+Math.ceil(boost.weeks)+' 周产出 +'+Math.round((boost.mul-1)*100)+'% · 开启允许扣费':'')+'</small></button>').join('')+'</div>'
      +'<p class="care-auto-note">仅经营时执行；体力或经费不足会跳过，暂停与离线不补扣。</p>'
      +(last?'<p class="care-auto-last" role="status">最近：'+esc(last.name)+' · '+(last.pending?'已安排休假':collective?'全员已恢复体力':'体力 +'+Math.round(last.gain||0))+'</p>':'')+'</section>';
  }
  function runtime(core) {
    let r = own.get(core);
    if (!r) { r = {state:core.state,last:null,elapsed:0,animation:null}; own.set(core,r); }
    if (r.state !== core.state) { cancel(core); r.state=core.state; r.last=null; r.elapsed=0; }
    return r;
  }
  function cancel(core) {
    const r = own.get(core), a = r && r.animation, ui = currentUI();
    if (!a) return;
    r.animation=null; r.elapsed=0;
    if (a.frame) window.cancelAnimationFrame(a.frame);
    if (a.actor) a.actor.remove();
    if (a.effects) a.effects.remove();
    if (a.source && a.source.isConnected) a.source.style.visibility = a.sourceVisibility;
    if (ui && ui._whaleAutomationActor === a) ui._whaleAutomationActor = null;
  }
  function decorate() {
    const ui = currentUI(), core = ui && ui.core, shell = ui && ui.el && ui.el.querySelector('.office-shell');
    if (!shell) return;
    if(window.WhaleCare)WhaleCare.checkEnergyNotice(core);
    let label = shell.querySelector('.whale-autocare-status');
    if (!enabled(core) || core.state.phase !== 'office') { if(label)label.remove(); return; }
    const scene=shell.querySelector('.office-scene');
    if(!scene){if(label)label.remove();return;}
    if (!label) {label=document.createElement('div');label.className='whale-autocare-status';label.setAttribute('role','status');}
    if(label.parentElement!==scene)scene.appendChild(label);
    const cw=scene.clientWidth,ch=scene.clientHeight;
    const unit=finite(Number(scene.style.getPropertyValue('--v2a-screen-unit')),1)||1;
    const portrait=window.matchMedia&&window.matchMedia('(orientation: portrait)').matches;
    const pause=shell.querySelector('#ob-pausedtag');
    const frame=scene.getBoundingClientRect(),screenScale=frame.width/cw||1;
    const pauseBox=pause&&pause.getBoundingClientRect();
    const reserved=pauseBox&&pauseBox.height>0?pauseBox.width/screenScale+10*unit:0;
    label.style.left=reserved?4*unit+'px':'50%';
    label.style.transform=reserved?'none':'';
    const image=scene.querySelector('.office-bg'),iy=image?finite(parseFloat(image.style.top),0):0;
    const iw=image?finite(parseFloat(image.style.width),cw):cw,ih=image?finite(parseFloat(image.style.height),ch):ch;
    label.style.bottom=(portrait?2*unit:Math.max(6,ch-Math.min(ch,iy+ih)+6))+'px';
    scene.style.setProperty('--autocare-caption-bottom',label.style.bottom);
    label.style.maxWidth=Math.max(0,reserved?cw-reserved-8*unit:portrait?cw-8*unit:Math.min(cw,iw)-24)+'px';
    const status = energyAvailable(core) ? core.whaleName()+'托管中...' : core.whaleName()+'体力不足，等待投喂';
    if (label.textContent !== status) label.textContent = status;
    label.classList.toggle('is-working',!!ui._whaleAutomationActor);
    label.title = operable(core) ? '优先免费谈心；仅执行已开启的项目' : '当前暂停安排，恢复经营后继续';
  }
  function animate(core, action) {
    if(!action || !kinds.includes(action.kind))return false;
    const ui=currentUI(), scene=window.V2OfficeScene, ctx=scene&&scene.context(), source=ctx&&scene.whaleNode(ctx);
    if (!ui || ui.core!==core || !ctx || !source || ui._whaleAutomationActor || ui._embodiedPodExitBusy) return false;
    const sr=ctx.rect||ctx.scene.getBoundingClientRect(), ar=source.getBoundingClientRect();
    if (!sr.width || !sr.height || !ar.height) return false;
    const sx=ctx.scene.clientWidth/sr.width, sy=ctx.scene.clientHeight/sr.height, cw=ctx.scene.clientWidth,ch=ctx.scene.clientHeight;
    const h=clamp(ar.height*sy,70,ch*.48), w=h*(ar.width/ar.height);
    const home={x:clamp((ar.left+ar.width/2-sr.left)*sx,w*.5,cw-w*.5),y:clamp((ar.bottom-sr.top)*sy,h,ch-8)};
    const spots=new Map();
    for(const marker of ctx.scene.querySelectorAll('.emp-marker')){
      const mr=marker.getBoundingClientRect(), p={x:(mr.left+mr.width/2-sr.left)*sx,y:(mr.top-sr.top)*sy};
      spots.set(marker.dataset.eng,{marker,p,to:{x:clamp((mr.right-sr.left)*sx+w*.43,w*.5,cw-w*.5),y:clamp((mr.bottom-sr.top)*sy+h*.35,h,ch-8)}});
    }
    if(action.id!=null&&!spots.has(String(action.id)))return false;
    const actor=document.createElement('div');actor.className='whale-autocare-actor';actor.setAttribute('aria-hidden','true');
    const stand=WhaleCare.outfitSrc(core,'stand','resource/character/whale_stand.webp'), wand=WhaleCare.outfitSrc(core,'wand',stand);
    for(const [pose,src] of [['stand',stand],['wand',wand]]){const art=document.createElement('img');art.alt='';art.draggable=false;art.src=src;art.dataset.pose=pose;actor.appendChild(art);}
    actor.style.width=w+'px';actor.style.height=h+'px';ctx.scene.appendChild(actor);
    const effects=document.createElement('div');effects.className='whale-autocare-effects';effects.setAttribute('aria-hidden','true');ctx.scene.appendChild(effects);
    const a={actor,effects,source,sourceVisibility:source.style.visibility,state:core.state,scene:ctx.scene,spots,home,current:home,from:home,to:home,action:null,visited:new Set(),frame:0,stage:'',phase:'',started:null,committed:false,effectNodes:new Map(),count:0};
    source.style.visibility='hidden';ui._whaleAutomationActor=a;runtime(core).animation=a;decorate();
    const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wave=reduced?120:300, hold=reduced?100:90;
    const blend=(p,q,v)=>({x:p.x+(q.x-p.x)*v,y:p.y+(q.y-p.y)*v});
    const ease=t=>t*t*(3-2*t);
    const pose=phase=>{if(a.phase!==phase){a.phase=phase;actor.dataset.phase=phase;}};
    const pos=p=>{a.current=p;actor.style.transform='translate3d('+p.x+'px,'+p.y+'px,0) translate(-50%,-100%)';};
    const moveDuration=(p,q)=>reduced?60:clamp(Math.hypot(p.x-q.x,p.y-q.y)/1.1,140,360);
    const emit=(gain,pending)=>{
      const spot=spots.get(String(gain.id));if(!spot)return;
      const stamina=spot.marker.querySelector('.emp-stamina span'),e=(core.state.engineers||[]).find(e=>e.id===gain.id);
      if(stamina&&e)stamina.textContent=Math.round(finite(e.energy,0));
      let effect=a.effectNodes.get(gain.id);
      if(!effect){effect=document.createElement('div');effect.className='whale-autocare-effect';effect.innerHTML='<i></i><i></i><i></i><b></b>';effects.appendChild(effect);a.effectNodes.set(gain.id,effect);}
      effect.querySelector('b').textContent=pending?'休假已安排':'+'+gain.gain+' 体力';
      effect.style.left=spot.p.x+'px';effect.style.top=spot.p.y+'px';
      effect.dataset.pop=effect.dataset.pop==='a'?'b':'a';
    };
    const orbit=()=>{
      const all=[...spots.values()].map(p=>p.to);if(!all.length)return [home];
      const x0=clamp(Math.min(...all.map(p=>p.x))-w*.5,w*.5,cw-w*.5),x1=clamp(Math.max(...all.map(p=>p.x))+w*.5,w*.5,cw-w*.5);
      const y0=clamp(Math.min(...all.map(p=>p.y))-h*.25,h,ch-8),y1=clamp(Math.max(...all.map(p=>p.y))+h*.18,h,ch-8);
      const corners=[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
      let n=0;for(let i=1;i<4;i++)if(Math.hypot(corners[i].x-a.current.x,corners[i].y-a.current.y)<Math.hypot(corners[n].x-a.current.x,corners[n].y-a.current.y))n=i;
      return [...corners.slice(n),...corners.slice(0,n),corners[n]];
    };
    const begin=(q,now)=>{
      a.action=q;a.from={...a.current};a.committed=false;a.started=now;
      if(q.kind==='meeting'||q.kind==='team'){a.stage='orbit';a.route=orbit();a.route.unshift(a.from);a.segmentLengths=a.route.slice(1).map((p,i)=>Math.hypot(p.x-a.route[i].x,p.y-a.route[i].y));a.routeLength=a.segmentLengths.reduce((x,y)=>x+y,0);a.duration=reduced?350:1500;pose('team');}
      else{const spot=spots.get(String(q.id));if(!spot)return false;a.stage='walk';a.to=spot.to;a.duration=moveDuration(a.from,a.to);pose('walk');}
      return true;
    };
    const advance=now=>{
      let q=nextAction(core,a.visited);
      while(q&&q.id!=null&&!spots.has(String(q.id))){a.visited.add(actionKey(q));q=nextAction(core,a.visited);}
      if(q&&a.count<(core.state.engineers||[]).length*3+2&&begin(q,now))return;
      a.stage='return';a.started=now;a.from={...a.current};a.to=home;a.duration=moveDuration(a.from,home);pose('return');
    };
    if(!begin(action,null)){cancel(core);return false;}pos(home);
    const tick=now=>{
      if (runtime(core).animation!==a) return;
      if (core.state!==a.state || !operable(core,true) || !actor.isConnected || !source.isConnected) {cancel(core);decorate();return;}
      if(a.started==null)a.started=now;
      const elapsed=now-a.started;
      if(a.stage==='walk'||a.stage==='return'){
        pos(blend(a.from,a.to,ease(clamp(elapsed/a.duration,0,1))));
        if(elapsed>=a.duration){if(a.stage==='return'){
          source.style.visibility=a.sourceVisibility;actor.hidden=true;
          a.stage='settle';a.started=now;a.duration=Math.max(0,(a.lastEffect||0)+900-now);
          if(!a.duration){cancel(core);decorate();return;}
        }else{a.stage='wave';a.started=now;pose('wave');}}
      }else if(a.stage==='orbit'){
        let distance=clamp(elapsed/a.duration,0,1)*a.routeLength,index=0;
        while(index<a.segmentLengths.length-1&&distance>a.segmentLengths[index])distance-=a.segmentLengths[index++];
        pos(blend(a.route[index],a.route[index+1],clamp(distance/(a.segmentLengths[index]||1),0,1)));
        if(elapsed>=a.duration){a.stage='wave';a.started=now;pose('wave');}
      }else if(a.stage==='wave'){
        if(!a.committed&&elapsed>=wave*.55){
          a.committed=true;a.visited.add(actionKey(a.action));a.count++;
          const result=execute(core,a.action);
          if(result.ok){a.lastEffect=now;for(const gain of result.gains||[])emit(gain,result.pending);if(window.SFX)SFX.play('care-wand',{vol:.45});decorate();}
        }
        if(elapsed>=wave+hold)advance(now);
      }else if(a.stage==='settle'&&elapsed>=a.duration){cancel(core);decorate();return;}
      a.frame=window.requestAnimationFrame(tick);
    };
    a.frame=window.requestAnimationFrame(tick);return true;
  }
  function poll(now) {
    const ui=currentUI(), core=ui&&ui.core;if(!core||!core.state)return;
    guidePoll();
    const r=runtime(core), time=finite(now,Date.now());decorate();
    const delta=r.last==null?0:clamp(time-r.last,0,500);r.last=time;
    if(!operable(core,r.animation&&r.animation.committed)){cancel(core);r.elapsed=0;return;}
    if(r.animation)return;
    r.elapsed+=delta;
    if(r.elapsed<settings(core).interval)return;
    r.elapsed=0;const action=nextAction(core);if(action)animate(core,action);
  }
  window.WhaleAutoCare={settings,ensure,unlocked,enabled,energyAvailable,toggle,operable,nextAction,quote,execute,panelHTML,panelTab,poll,cancel,decorate,animate,
    guideState,guideStep,guideHTML,guideAction,guidePage,guideDismiss,guidePoll};
  if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',()=>{const ui=currentUI();if(ui&&ui.core){cancel(ui.core);const r=runtime(ui.core);r.last=null;r.elapsed=0;}});
  if(window.GameBus)for(const name of ['phase','stage:start'])GameBus.on(name,()=>{const ui=currentUI();if(ui&&ui.core)cancel(ui.core);decorate();});
  const ui=currentUI();if(ui&&typeof ui.applyUiScale==='function'){const scale=ui.applyUiScale;ui.applyUiScale=function(){const result=scale.apply(this,arguments);decorate();return result;};}
  window.addEventListener('resize',decorate);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',decorate);
  if(typeof setInterval==='function'&&!window.__GAMEBUS_NO_TIMER){const id=setInterval(()=>poll(Date.now()),250);if(id&&id.unref)id.unref();}
})();
