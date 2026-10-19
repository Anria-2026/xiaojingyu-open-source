/* Stage-bound physical-body procurement; no catch-up deductions or clock changes. */
(function () {
  'use strict';
  if (window.EmbodiedFactory) return;
  const core = window.GameCore, ui = window.GameUI;
  const integer = (v, fallback = 0) => Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : fallback;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = n => integer(n).toLocaleString('zh-CN');
  const bodyModels={'V5':'A1','V5.5':'A2','V6':'A3','V6.5':'A4'};
  let panel = null;
  function stage(c) {
    const s = c && c.state, cfg = c && c.cfg && c.cfg.FACTORY;
    if (!s || !cfg || cfg.ENABLED === false || !Object.prototype.hasOwnProperty.call(bodyModels,s.ver)) return null;
    const row = (cfg.BY_VER || {})[s.ver];
    if (!row || !Array.isArray(row.TIERS) || !row.TIERS.length) return null;
    const seen = new Set(), tiers = row.TIERS.filter(t => t && typeof t.id === 'string' && !seen.has(t.id) && seen.add(t.id))
      .map(t => ({...t, units:integer(t.units), price:integer(t.price), outputBonus:Math.max(0, Math.min(.5, Number(t.outputBonus) || 0))}));
    if (!tiers.length) return null;
    return {...row, ver:s.ver, MODEL:String(row.MODEL||bodyModels[s.ver]), NAME:String(row.NAME || '素体 '+bodyModels[s.ver]), REQUIRED_UNITS:Math.max(1,integer(row.REQUIRED_UNITS,1)), TIERS:tiers};
  }
  function ensure(c) {
    const cfg = stage(c); if (!cfg) return null;
    const s = c.state;
    if (!s.bodyFactory || typeof s.bodyFactory !== 'object' || Array.isArray(s.bodyFactory)) s.bodyFactory = {schema:1, stages:{}};
    if (!s.bodyFactory.stages || typeof s.bodyFactory.stages !== 'object' || Array.isArray(s.bodyFactory.stages)) s.bodyFactory.stages = {};
    let record = s.bodyFactory.stages[s.ver];
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      // A project begun before this feature continues unchanged. It earns no
      // fictional investment credit and its next project uses the normal gate.
      record = {tier:null, invested:0, legacyOperational:!!s.planDone};
      s.bodyFactory.stages[s.ver] = record;
    }
    record.invested = integer(record.invested);
    record.legacyOperational = record.legacyOperational === true;
    return record;
  }
  function status(c) {
    const cfg = stage(c); if (!cfg) return {enabled:false,ready:true,units:0,bonus:0};
    const record = ensure(c), tier = cfg.TIERS.find(t => t.id === record.tier);
    const legacy = !tier && record.legacyOperational && c.state.planDone;
    const units = tier ? tier.units : 0;
    return {enabled:true,ready:units >= cfg.REQUIRED_UNITS || legacy,legacy,units,required:cfg.REQUIRED_UNITS,
      bonus:tier ? tier.outputBonus : 0,tier:tier || null,record,cfg};
  }
  function requirement(c) {
    const st = status(c);
    return st.enabled && !st.ready ? String(c.cfg.FACTORY.UI.REQUIREMENT).replace('{body}',st.cfg.NAME) : '';
  }
  function quote(c, id) {
    const st = status(c); if (!st.enabled) return {ok:false,tip:'V5 开放素体购买'};
    const target = st.cfg.TIERS.find(t => t.id === id);
    if (!target) return {ok:false,tip:'没有这一款素体'};
    if (st.tier && (target.units <= st.tier.units || target.price <= st.record.invested)) return {ok:false,tip:'已拥有这款或更高规格的素体'};
    const cost = Math.max(0,target.price-st.record.invested);
    return {ok:true,target,cost,ver:st.cfg.ver,affordable:integer(c.state.funding) >= cost};
  }
  function save(c) {
    if (ui && ui.core === c && ui.save && ui.save.autoSave) ui.save.autoSave(c.state);
    else if (window.GameSave && GameSave.save) GameSave.save('auto',c.state);
  }
  function purchase(c, id) {
    if (!c || !c.state || c.state.phase !== 'office') return {ok:false,tip:'请回到办公室采购'};
    const q = quote(c,id);
    if (!q.ok) return q;
    if (!q.affordable) return {ok:false,tip:'经费不足，还需 '+number(q.cost-integer(c.state.funding))+' 元'};
    const record = ensure(c);
    if (q.cost > 0) c.state.funding = integer(c.state.funding)-q.cost;
    record.tier=q.target.id; record.invested=q.target.price; record.legacyOperational=false;
    record.purchasedAt=Date.now(); record.purchasedWeek=c.absWeek ? c.absWeek() : integer(c.state.week);
    save(c);
    if (window.GameBus) GameBus.emit('factory:purchased',{ver:q.ver,tier:record.tier,cost:q.cost,units:q.target.units});
    return {ok:true,cost:q.cost,units:q.target.units,tip:q.cost===0?String(c.cfg.FACTORY.UI.FREE_SUCCESS).replace('{body}',q.target.name):q.target.name+'已就绪 · 支出 '+number(q.cost)+' 元'};
  }
  /* [feature:portrait-factory-paged-quotes] */
  function body(c) {
    const st=status(c); if(!st.enabled)return '<p>具身智能阶段开放素体购买。</p>';
    const profile=st.cfg.PROFILE||({'V5':'小女孩体型 · 初次感知世界','V5.5':'成长少女体型 · 学习与生活','V6':'少女体型 · 独立走进社会','V6.5':'成熟少女体型 · 走向完整的一生'})[st.cfg.ver];
    // Keep the exact quote and procurement gate as the only financial source.
    // Compact whole ten-thousands; unusual configured amounts retain every yuan.
    const money=n=>{const v=integer(n);return v>=10000&&v%10000===0?number(v/10000)+'万':number(v);};
    const preview=/^resource\//.test(String(st.cfg.PREVIEW_IMG||''))?'<img class="body-model-preview" src="'+esc(st.cfg.PREVIEW_IMG)+'" alt="'+esc(st.cfg.MODEL+' 当前阶段形象')+'" decoding="async">':'';
    const freeUI=c.cfg.FACTORY.UI;
    const claimed=st.tier && st.tier.price===0 && st.record.invested===0;
    const stateText=st.legacy?'旧项目正常运行':st.tier?(st.ready?(claimed?freeUI.FREE_STATE:'已采购 · 可以立项'):'已采购 · 尚未满足立项'):'等待采购';
    const growth=Object.entries(bodyModels).map(([ver,model],i)=>{
      const row=(c.cfg.FACTORY.BY_VER||{})[ver]||{},active=ver===st.cfg.ver;
      return '<li'+(active?' class="is-active" aria-current="step"':'')+'><span class="body-factory-growth-dot">'+(i+1)+'</span><div><b>'+esc(row.MODEL||model)+'</b><small>'+esc(['初识世界','学习生活','独立生活','完整一生'][i])+'</small></div>'+(active?'<em>当前</em>':'')+'</li>';
    }).join('');
    return '<div class="body-factory-content"><section class="body-factory-hero"><div class="body-factory-art" data-body-model="'+esc(st.cfg.MODEL)+'"><span class="body-factory-model-label">'+esc(st.cfg.MODEL)+'</span>'+(preview||'<div class="body-model-figure" aria-hidden="true"><i class="body-model-head"></i><i class="body-model-torso"></i><i class="body-model-arm body-model-arm-left"></i><i class="body-model-arm body-model-arm-right"></i><i class="body-model-leg body-model-leg-left"></i><i class="body-model-leg body-model-leg-right"></i></div>')+'<small class="body-factory-art-caption">'+(preview?'当前阶段形象':'身体比例示意')+'</small></div><header class="body-factory-intro"><span>陪她一步步成长 · '+esc(st.cfg.ver)+'</span><h2>'+esc(st.cfg.NAME)+'</h2><p class="body-factory-profile">'+esc(profile)+'</p><p class="body-factory-description">'+esc(st.cfg.DESCRIPTION||'为她准备适合这一阶段的身体，让她从初识世界到独立生活。每个成长阶段单独采购。')+'</p><div class="body-factory-state'+(st.ready?' is-ready':'')+'" role="status">'+(ui&&ui.icon?ui.icon(st.ready?'check':'info',14):'')+'<span>'+esc(stateText)+'</span></div></header></section>'
      +'<ol class="body-factory-growth" aria-label="身体成长阶段">'+growth+'</ol>'
      +'<section class="body-factory-purchase"><header class="body-factory-purchase-heading"><div><h3>为这一阶段做好准备</h3><p>素体到位 <b>'+number(st.units)+' / '+number(st.required)+' 台</b></p></div><div class="body-factory-wallet"><span>可用经费</span><b title="'+number(c.state.funding)+' 元">¥'+money(c.state.funding)+'</b></div></header>'
      +(st.legacy?'<p class="body-factory-legacy">这份旧项目继续正常运行，更新不会追扣费用。下一次立项前，请完成本阶段采购。</p>':'')
      +'<div class="body-factory-tiers">'+st.cfg.TIERS.map((t,index)=>{
        const q=quote(c,t.id),current=!!st.tier&&st.tier.id===t.id,covered=!!st.tier&&!q.ok&&!current,owned=current||covered,blocked=!owned&&(!q.ok||!q.affordable);
        const free=t.price===0,received=current&&claimed;
        const badge=owned?(current?(received?freeUI.FREE_OWNED:'已购买'):'已覆盖'):blocked?'暂不可采购':free?freeUI.FREE_BADGE:st.tier?'可补差升级':'本阶段规格';
        const amount=q.ok?q.cost:t.price,label=owned?'规格价格':st.tier?'本次补差':'采购费用';
        const detail=owned?(current?'这款素体已经到位，无需重复支付。':'已购规格覆盖这款，无需重复采购。'):!q.ok?q.tip:!q.affordable?'还差 ¥'+money(q.cost-integer(c.state.funding))+' 元，即可采购。':free&&t.units>=st.required?freeUI.FREE_DETAIL:t.units>=st.required?'采购后满足本阶段立项所需。':'采购后还需 '+number(st.required-t.units)+' 台，才能满足立项所需。';
        return '<article data-factory-index="'+index+'" class="body-factory-tier'+(current?' is-current':covered?' is-covered':blocked?' is-blocked':'')+'" data-factory-state="'+(current?'current':covered?'covered':blocked?'blocked':'available')+'"><div class="body-factory-tier-copy"><span class="body-factory-tier-badge">'+esc(badge)+'</span><h3>'+esc(t.name)+'</h3><p>'+number(t.units)+' 台素体'+(t.outputBonus?' <span>· 具身岗位产出 +'+Math.round(t.outputBonus*100)+'%</span>':' <span>· 不占工程师工位</span>')+'</p></div><div class="body-factory-price"><span>'+label+'</span><strong title="'+number(amount)+' 元">'+(free?esc(freeUI.FREE_TEXT):'¥'+money(amount))+'</strong>'+(q.ok&&st.tier?'<small>完整规格 ¥'+money(t.price)+'</small>':'')+'</div><button type="button" class="dg-btn body-factory-buy'+(owned?'':' dg-btn-primary')+'" data-factory-tier="'+esc(t.id)+'"'+(owned||!q.ok||!q.affordable?' disabled':'')+'>'+esc(owned?(current?(received?freeUI.FREE_OWNED:'已购买'):'已覆盖'):!q.ok?'不可采购':!q.affordable?'经费不足':free?freeUI.FREE_ACTION:st.tier?'补差升级':'购买素体')+'</button><p class="body-factory-condition">'+esc(detail)+'</p></article>';
      }).join('')+'</div></section><footer class="body-factory-note">'+esc(st.cfg.NOTE||'每个成长阶段分别采购，上一阶段的投入不抵扣下一阶段的素体费用。已购规格不会重复扣费。')+'</footer></div>';
  }
  /* [/feature:portrait-factory-paged-quotes] */


  function close(options){if(panel){if(options&&options.discardReturn)panel.discardReturn();panel.close();}}
  const ordinaryMenus=new Set(['team','hire','recruit','news','plan','focus','paper','corpus','shop','test','review','guide','dividend']);
  function blocksSwitch(c){
    const s=c&&c.state;if(!s||s.phase!=='office'||s.minigame||ui._modal||ui._confirmOpen||ui._embodiedPodExitBusy||s.officeModal&&!ordinaryMenus.has(s.officeModal)||window.ArcadeGlue&&ArcadeGlue.active)return true;
    if(document.querySelector('.dg-modal-mask,.set-pop-mask,.ev-spawn,.insp-overlay,.sub-modal-overlay,.chat-zoom-mask,.nw-lightbox'))return true;
    const allowed=node=>!!(panel&&panel.host.contains(node))||!!(s.officeModal&&node.closest('#modalContainer'))||!!(window.OfficeMore&&OfficeMore.isOpen()&&node.closest('.v2b-panel-host')?.querySelector('.more-menu-card'))||!!(window.WhaleRoom&&WhaleRoom.isOpen()&&node.closest('.v2b-panel-host')?.querySelector('.care-v2-card'));
    return Array.from(document.querySelectorAll('.v2b-panel-host,.modal-mask')).some(node=>!allowed(node));
  }
  // Reserve the actual action column, rather than raising the scene over cards.
  function switchLayout(){
    const shell=ui.el&&ui.el.querySelector('.office-shell'),rail=shell&&shell.querySelector('.action-col');if(!shell||!rail)return;
    const active=!!stage(ui.core);if(shell.classList.contains('body-factory-switchable')!==active)shell.classList.toggle('body-factory-switchable',active);if(!active)return;
    const masks=shell.querySelectorAll('#modalContainer .modal-mask,.v2b-panel-host:has(.body-factory-card,.more-menu-card,.care-v2-card) .modal-mask');if(!masks.length)return;
    const r=rail.getBoundingClientRect();if(!r.width||!r.height)return;
    for(const mask of masks){
      const parent=mask.parentElement,b=parent.getBoundingClientRect(),scale=b.width/(parent.offsetWidth||b.width||1),horizontal=r.width>b.width*.5;
      const values={'--body-switch-left':horizontal?'0px':Math.max(0,(r.right-b.left+8)/scale)+'px','--body-switch-top':horizontal?Math.max(0,(r.bottom-b.top+8)/scale)+'px':'0px'};
      for(const [key,value]of Object.entries(values))if(mask.style.getPropertyValue(key)!==value)mask.style.setProperty(key,value);
    }
  }
  function restorePlan(target) {
    if(!target||ui.core!==target.core||target.core.state!==target.state||target.state.ver!==target.ver||target.state.phase!=='office'||target.state.officeModal||target.state.minigame||ui._confirmOpen||ui._embodiedPodExitBusy)return false;
    ui._planArch=target.arch;ui._planParam=target.param;ui._planMix={...target.mix};
    target.state.officeModal='plan';ui.render({soft:true});
    const button=ui.el.querySelector('#modalContainer [data-action="om-plan-confirm"]');
    if(button&&!button.disabled)button.focus({preventScroll:true});
    return true;
  }
  function open(options={}){
    const c=ui&&ui.core,s=c&&c.state;
    if(!stage(c)||!s||!window.V2Panels||blocksSwitch(c))return false;
    if(panel){panel.card.focus({preventScroll:true});return true;}
    if(window.OfficeMore&&OfficeMore.isOpen())OfficeMore.close();
    if(window.WhaleRoom&&WhaleRoom.isOpen())WhaleRoom.close();
    if(s.officeModal){s.officeModal=null;ui.closeOfficeModal();ui.render({soft:true});}
    if(window.OfficePause)OfficePause.sourceNames.factory='素体采购';
    const release=window.OfficePause?OfficePause.acquire(c,'factory'):()=>{},returnTo=options.returnToPlan||null;let restoreOnClose=true;
    try{panel=V2Panels.open({title:'素体',icon:'factory',className:'body-factory-card',layout:'responsive',body:body(c),onClose(){panel=null;release();if(restoreOnClose)restorePlan(returnTo);}});panel.discardReturn=()=>{restoreOnClose=false;};switchLayout();
      if(returnTo){
        const footer=panel.card.querySelector('.modal-footer');
        footer.innerHTML='<span class="body-factory-return-tip">采购完成后回到提案，保留当前选项</span><button type="button" class="skew-btn ghost" data-factory-return>返回提案</button>';
        footer.querySelector('[data-factory-return]').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();ui._clickHandled=true;ui._pressTarget=null;close();});
      }
  /* [feature:portrait-factory-page-click] */
      panel.body.addEventListener('click',event=>{
        const target=event.target.closest('[data-factory-tier]');if(!target||target.disabled)return;
  /* [/feature:portrait-factory-page-click] */
        event.preventDefault();event.stopPropagation();ui._clickHandled=true;ui._pressTarget=null;
        const result=purchase(c,target.dataset.factoryTier);if(ui.toast)ui.toast(result.tip);if(result.ok&&window.SFX)SFX.play('confirm');
        if(result.ok&&returnTo&&status(c).ready){close();return;}
        if(ui.updateOfficeMain)ui.updateOfficeMain();if(panel){panel.body.innerHTML=body(c);panel.fit();}
      });
    }catch(e){release();throw e;}
    return true;
  }
  function install(c){
    if(!c||c.__bodyFactoryWrapped)return;c.__bodyFactoryWrapped=true;
    const confirm=c.confirmPlan;c.confirmPlan=function(){const tip=requirement(this);if(tip&&!this.state.planDone)return {ok:false,tip};return confirm.apply(this,arguments);};
    const guide=c.guidePending;c.guidePending=function(){const old=guide.apply(this,arguments);if(old&&old.key==='plan'&&requirement(this))return {key:'factory',tip:requirement(this)};return old;};
    for(const name of ['newGame','loadState','_enterStage']){const fn=c[name];if(typeof fn==='function')c[name]=function(){const result=fn.apply(this,arguments);ensure(this);return result;};}
    ensure(c);
  }
  function wrapProduction(){
    const engine=window.V35;if(!engine||typeof engine.tick!=='function'||engine.tick.__bodyFactoryWrapped)return;
    const tick=engine.tick;
    const wrapped=function(state){
      const c=ui&&ui.core||core,st=c&&c.state&&c.state.v35===state?status(c):{bonus:0};
      const list=state&&state.productionMulList,previous=list&&list.embodied;
      if(!st.bonus||!Array.isArray(previous))return tick.apply(this,arguments);
      list.embodied=previous.map(n=>(Number.isFinite(Number(n))?Number(n):1)*(1+st.bonus));
      try{return tick.apply(this,arguments);}finally{list.embodied=previous;}
    };wrapped.__bodyFactoryWrapped=true;engine.tick=wrapped;
  }
  window.EmbodiedFactory={stage,ensure,status,requirement,quote,purchase,body,open,close,isOpen:()=>!!panel,install};
  install(core);wrapProduction();
  if(ui){
    // Seed the first unplanned proposal of this saved state/stage, before any
    // footer or body reads the draft. Later renders and procurement handoffs
    // retain the player's own architecture, parameter and corpus choices.
    const seededProposals=new WeakMap();
    function seedMissionProposal(receiver,key){
      const c=receiver.core,s=c&&c.state;
      if(!s||s.phase!=='office'||s.planDone||(key||s.officeModal)!=='plan'||!Object.prototype.hasOwnProperty.call(bodyModels,s.ver))return;
      let seen=seededProposals.get(s);if(seen&&seen.has(s.ver))return;
      const mission=typeof c.missionOf==='function'&&c.missionOf(s.ver),index=mission&&(c.cfg.ARCHITECTURES||[]).findIndex(a=>a.id===mission.arch),param=Number(mission&&mission.param);
      if(!mission||index<0||!Number.isFinite(param)||param<=0)return;
      receiver._planArch=index;receiver._planParam=param;
      if(!seen){seen=new Set();seededProposals.set(s,seen);}seen.add(s.ver);
    }
    const render=ui.render;ui.render=function(){seedMissionProposal(this);const result=render.apply(this,arguments);switchLayout();return result;};
    for(const name of ['applyUiScale','updateOfficeMain']){const original=ui[name];ui[name]=function(){const result=original.apply(this,arguments);switchLayout();return result;};}
    window.addEventListener('resize',switchLayout);
    const icon=ui.icon;ui.icon=function(name,size){if(name!=='factory')return icon.apply(this,arguments);const s=Number(size)||20;return '<svg class="dg-ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="6"/><circle cx="12" cy="7" r="2"/><path d="M8 16v-4a4 4 0 0 1 8 0v4M10 12v8m4-8v8"/></svg>';};
    const ready=ui.planReady;ui.planReady=function(){const tip=requirement(this.core);if(tip&&!this.core.state.planDone)return {ok:false,reason:'需先采购素体',factoryRequired:true,factoryTip:tip};return ready.apply(this,arguments);};
    // Initial open, lightweight refresh and the office's quiet render all use
    // metadata. updatePlanFooter alone runs only after an explicit input change.
    const factoryButton='<button type="button" class="skew-btn gold" data-action="factory-from-plan">去购买素体</button>';
    const meta=ui.officeModalMeta;ui.officeModalMeta=function(key){seedMissionProposal(this,key);const result=meta.apply(this,arguments);if(key==='plan'&&result&&this.planReady().factoryRequired&&!String(result.footer).includes('factory-from-plan'))return {...result,footer:result.footer+factoryButton};return result;};
    const update=ui.updatePlanFooter;ui.updatePlanFooter=function(){const result=update.apply(this,arguments),box=this.el.querySelector('#modalContainer[data-modal-key="plan"]'),pr=this.planReady();if(box){let btn=box.querySelector('[data-action="factory-from-plan"]');if(pr.factoryRequired&&!btn){const footer=box.querySelector('.modal-footer');if(footer){footer.insertAdjacentHTML('beforeend',factoryButton);this.invalidateFit();this.fitModalBody();}}else if(btn&&!pr.factoryRequired){btn.remove();this.invalidateFit();this.fitModalBody();}}return result;};
    // Arch-dependent parameter cards and mix attributes must be rebuilt from
    // the same current draft as the requirements and final core confirmation.
    // A sequence/state check prevents a late flip from changing a newer panel.
    const switchCard=ui.planCardSwitch;let flipSequence=0;
    ui.planCardSwitch=function(selector,total,index){
      if(selector!=='#archCard')return switchCard.apply(this,arguments);
      const c=this.core,s=c.state,box=this.el.querySelector('#modalContainer[data-modal-key="plan"]'),card=box&&box.querySelector(selector),seq=++flipSequence;
      if(!card){this.refreshOfficeBody();return;}
      const outClass='card-switching-out-left',inClass='card-switching-in-right';card.classList.add(outClass);
      this.updatePlanFooter();
      setTimeout(()=>{
        if(seq!==flipSequence||this.core!==c||c.state!==s||s.phase!=='office'||s.officeModal!=='plan'||!card.isConnected||box.dataset.modalKey!=='plan'||this._planArch!==index)return;
        this.refreshOfficeBody();
        const next=box.querySelector(selector);if(!next)return;next.classList.add(inClass);
        setTimeout(()=>{if(seq===flipSequence&&next.isConnected)next.classList.remove(inClass);},380);
      },190);
    };
    const click=ui.onClick;ui.onClick=function(event){const target=event&&event.target&&event.target.closest&&event.target.closest('[data-action]');if(!target||!((target.dataset.action==='office-modal'&&target.dataset.id==='factory')||target.dataset.action==='factory-from-plan')){if(panel&&target&&target.dataset.action==='office-modal'&&!target.disabled&&!panel.host.contains(target)&&!blocksSwitch(this.core))close({discardReturn:true});const result=click.apply(this,arguments);switchLayout();return result;}
      if(target.disabled)return false;if(event.preventDefault)event.preventDefault();if(event.stopPropagation)event.stopPropagation();this._clickHandled=true;this._pressTarget=null;
      let returnTo=null;
      if(target.dataset.action==='factory-from-plan'){
        const s=this.core.state;if(s.officeModal!=='plan')return false;
        returnTo={core:this.core,state:s,ver:s.ver,arch:this._planArch,param:this._planParam,mix:{...(this._planMix||{n:5,g:0,p:0})}};
      }
      if(window.SFX)SFX.play('click');const opened=open({returnToPlan:returnTo});if(!opened&&returnTo)restorePlan(returnTo);return opened;};
  }
})();
