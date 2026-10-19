/* Extra systems share one visible office entry and the existing modal/pause lifecycle. */
(function () {
  "use strict";
  const ui = window.GameUI;
  if (!ui || window.OfficeMore) return;
  const factory = JSON.parse(JSON.stringify((window.GameCfg.UI_CFG || {}).moreButtons || []));
  const info = {
    "whale-room": { label: "鲸鱼房", icon: "heart", desc: "好感与陪伴", page: "affection" },
    feeding: { desc: "给小鲸补充能量", page: "feeding" },
    wardrobe: { desc: "选择喜欢的时装", page: "wardrobe" },
    arcade: { desc: "清除幻觉 · 语料分拣 · 拯救大白饭" },
    "whale-size": { desc: "调整角色显示大小" },
    team: { label: "团队", icon: "users", desc: "查看与安排工程师", legacy: true },
    news: { label: "吃瓜", icon: "news", desc: "行业新闻与热点", legacy: true },
    recruit: { label: "招聘", icon: "briefcase", desc: "查看候选人并录用", legacy: true },
    hire: { label: "扩编", icon: "briefcase", desc: "发布招聘需求", legacy: true },
    plan: { label: "立项", icon: "file", desc: "配置项目目标", legacy: true },
    focus: { label: "攻关", icon: "target", desc: "安排团队攻关", legacy: true },
    corpus: { label: "语料", icon: "database", desc: "查看与补充语料", legacy: true },
    paper: { label: "论文", icon: "book", desc: "研究新的论文", legacy: true },
    shop: { label: "算力", icon: "cpu", desc: "选购算力设备", legacy: true },
    factory: { label: "素体", icon: "factory", desc: "购买适合当前阶段的身体" },
    test: { label: "测试", icon: "chat", desc: "与小鲸鱼测试聊天", legacy: true },
    review: { label: "评审", icon: "shield", desc: "查看项目评审", legacy: true },
  };
  const glyphs = {
    more: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    fish: '<path d="M3 12c4-7 10-7 15 0-5 7-11 7-15 0Z"/><path d="m18 12 4-4v8Z"/><circle cx="8" cy="11" r="1"/>',
    shirt: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>',
    gamepad: '<path d="M7 7h10c3 0 4 3 5 9 .5 3-2 5-4 2l-2-2H8l-2 2c-2 3-4.5 1-4-2C3 10 4 7 7 7Z"/><path d="M5 11h6M8 8v6"/><circle cx="17" cy="11" r=".7"/><circle cx="19" cy="13" r=".7"/>',
  };
  const icon = ui.icon;
  ui.icon = function (name, size) {
    const found = icon.apply(this, arguments);
    if (found || !glyphs[name]) return found;
    const s = Number(size) || 20;
    return '<svg class="dg-ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+glyphs[name]+'</svg>';
  };
  const escape = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let panel = null;
  const hasFactory = () => !!(window.EmbodiedFactory && ui.core && EmbodiedFactory.stage(ui.core));
  const physical = new Set(['whale-room','feeding','wardrobe','whale-size']);
  const embodied = () => !!(ui.core && ui.core.state && typeof ui.core.embodiedAvailable === 'function' && ui.core.embodiedAvailable());
  function rows() {
    const cfg = ui.core && ui.core.cfg.UI_CFG || {};
    const source = Array.isArray(cfg.moreButtons) ? cfg.moreButtons : factory;
    const seen = new Set();
    const list = source.filter(row => row && row.id !== 'factory' && !(embodied() && row.id === 'whale-room') && Object.prototype.hasOwnProperty.call(info, row.id) && row.enabled !== false &&
      (!physical.has(row.id) || embodied()) && !seen.has(row.id) && seen.add(row.id));
    // V5 起小鲸鱼占原语料栏位，语料功能移入更多；兼容旧编辑器配置。
    if (embodied() && !seen.has('corpus')) list.unshift({id:'corpus',label:'语料',icon:'database',enabled:true});
    // From V5 the factory is the required main entry. Compute stays reachable
    // here, even when an older editor config has not collected its button yet.
    if (hasFactory() && !seen.has('shop')) list.push({id:'shop',label:'算力',icon:'cpu',enabled:true});
    return list;
  }
  function available(id) {
    const c = ui.core && ui.core.cfg || {};
    if (info[id] && info[id].legacy) return true;
    if (id === "arcade") return !!(window.ArcadeGlue && c.ARCADE && c.ARCADE.ENABLED !== false);
    const body = !!(window.WhaleCare && WhaleCare.bodyAvailable(ui.core));
    if (id === "whale-size") return !!window.WhaleSize && embodied();
    return !!(window.WhaleRoom && body);
  }
  function lockReason(id) {
    if (['whale-room','feeding','wardrobe','whale-size'].includes(id)) {
      const cfg = (ui.core && ui.core.cfg.WHALE_CARE) || {};
      if (cfg.ENABLED === false) return '鲸鱼陪伴功能已关闭';
      if (!ui.core || !ui.core.embodiedBodyAvailable || !ui.core.embodiedBodyAvailable() || !ui.core.state.embodiedEra || !ui.core.state.embodiedEra.podExitSeen) return 'V5 具身训练开智后开放（完成出舱）';
    }
    return '暂未开放';
  }
  function syncButton() {
    const roomButton = ui.el && ui.el.querySelector('.action-btn[data-id="whale-room"]');
    if (roomButton) {
      const active = !!(window.WhaleRoom && WhaleRoom.isOpen());
      roomButton.classList.toggle('active',active);
      roomButton.title = available('whale-room') ? ui.core.cfg.WHALE_CARE.UI.LABEL : lockReason('whale-room');
      roomButton.setAttribute('aria-expanded',String(active));
      roomButton.setAttribute('aria-haspopup','dialog');
    }
    const button = ui.el && ui.el.querySelector('.action-btn[data-id="more"]');
    if (!button) return;
    button.classList.toggle("active", !!panel);
    button.setAttribute("aria-expanded", String(!!panel));
    button.setAttribute("aria-haspopup", "dialog");
  }
  function close() { if (panel) panel.close(); }
  function pageBody() {
    const list = rows();
    if (!list.length) return '<p class="office-more-empty">暂无可用功能</p>';
    return '<p class="office-more-intro">'+(embodied()?'工作之余，也来陪'+escape(ui.core.whaleName())+'放松一下。':'工作之余，动动手指换个心情。')+'<span>'+list.length+' 个入口</span></p>'
      +'<div class="office-more-tabs" aria-label="其他功能">'+list.map(row => {
        const meta = info[row.id], label = row.label || meta.label || row.id, enabled = available(row.id);
        const state = meta.legacy && actions.call(ui).find(action => action.key === row.id);
        const note = state && (state.badge || (state.count != null && state.count > 0 ? state.count + " 条待查看" : null));
        return '<button type="button" class="office-more-tab" data-action="office-more-feature" data-id="'+escape(row.id)+'"'+(enabled ? '' : ' disabled title="'+escape(lockReason(row.id))+'"')+'>'
          +'<span class="office-more-icon">'+(ui.icon(row.icon || meta.icon,24) || ui.icon("star",24))+'</span>'
          +'<span class="office-more-copy"><span class="office-more-label">'+escape(label)+'</span><small>'+escape(enabled ? note || meta.desc : lockReason(row.id))+'</small></span>'
          +'<span class="office-more-chevron" aria-hidden="true">'+(enabled ? '›' : ui.icon('lock',16))+'</span></button>';
      }).join('')+'</div>';
  }
  function select(id) {
    if (!panel || !panel.isCurrent() || !rows().some(row => row.id === id) || !available(id)) return false;
    close();
    if (info[id].legacy) {
      // Reuse the actual office action handler, including candidate selection,
      // tutorial rendering, GameBus subscribers and destination pause ownership.
      const target = document.createElement("button");
      target.dataset.action = "office-modal"; target.dataset.id = id;
      onClick.call(ui, {target, preventDefault(){}, stopPropagation(){}});
      return true;
    }
    if (id === "arcade") { ui.openArcade("menu"); return true; }
    if (id === "whale-size") {
      ui.openSettingsPop();
      const slider = ui.el.querySelector("#ws-size-range");
      if (slider) slider.focus();
      return true;
    }
    return window.WhaleRoom.open(info[id].page);
  }
  function open() {
    const s = ui.core && ui.core.state;
    if (!s || s.phase !== "office" || s.officeModal || s.minigame || ui._confirmOpen || ui._embodiedPodExitBusy || !window.V2Panels) return false;
    if (panel) { panel.card.focus(); return true; }
    if (window.WhaleRoom && WhaleRoom.isOpen()) WhaleRoom.close();
    if ((window.ArcadeGlue && ArcadeGlue.active)
      || document.querySelector('.modal-mask,.set-pop-mask,.dg-modal-mask,.v2b-panel-host,.chat-zoom-mask,.nw-lightbox,.ev-spawn,.insp-overlay,.sub-modal-overlay')) return false;
    {
      panel = V2Panels.open({title:"更多",icon:"more",className:"more-menu-card",layout:"responsive",body:pageBody(),onClose(){panel=null;syncButton();}});
      panel.card.tabIndex = -1;
      panel.host.addEventListener("click",e=>{if(e.target.classList.contains("modal-mask"))close();});
      syncButton();
    }
    return true;
  }
  const actions = ui.officeActions;
  ui.officeActions = function () {
    const gathered = new Set(rows().filter(row => info[row.id].legacy).map(row => row.id));
    const original = actions.apply(this, arguments);
    const list = original.map(row => embodied() && row.key === 'corpus'
      ? {key:'whale-room',icon:'heart',label:this.core.cfg.WHALE_CARE.UI.LABEL,badge:available('whale-room')?(WhaleCare.canFeed(this.core)?this.core.cfg.WHALE_CARE.UI.FEED_BADGE:null):'未解锁'} : row)
      .filter(row => row.key !== "more" && !gathered.has(row.key) && (!physical.has(row.key) || embodied()));
    if (hasFactory()) {
      const need = EmbodiedFactory.requirement(this.core), order = ((this.core.cfg.UI_CFG || {}).actions || []);
      const factory = {key:'factory',icon:'factory',label:'素体',badge:need?'待采购':null};
      const configured = order.indexOf('factory'), oldSlot = original.findIndex(row=>row.key==='shop');
      const following = configured >= 0 ? order.slice(configured+1) : original.slice(oldSlot+1).map(row=>row.divider?'divider':row.key);
      let index=list.length;
      for(const key of following){const next=list.findIndex(row=>(row.divider?'divider':row.key)===key);if(next>=0){index=next;break;}}
      list.splice(index,0,factory);
    }
    // Removed actions must not leave an empty divider at either edge.
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].divider && (i === 0 || i === list.length - 1 || list[i - 1].divider)) list.splice(i, 1);
    }
    const more = {key:"more",icon:"more",label:"更多",
      badge: original.some(row => gathered.has(row.key) && row.badge) ? "待处理" : null};
    const order = ((this.core.cfg.UI_CFG || {}).actions || []);
    const at = order.indexOf("more");
    if (at < 0) { list.push(more); return list; }
    // Insert relative to the next configured action, retaining legacy fallback order.
    let index = list.length;
    for (const key of order.slice(at + 1)) {
      const next = list.findIndex(row => (row.divider ? "divider" : row.key) === key);
      if (next >= 0) { index = next; break; }
    }
    list.splice(index,0,more); return list;
  };
  const onClick = ui.onClick;
  function openWhaleRoom() {
    const s = ui.core && ui.core.state;
    if (!s || !embodied() || s.phase !== 'office') return false;
    if (!available('whale-room')) { if(ui.toast)ui.toast(lockReason('whale-room')); return false; }
    if (s.minigame || ui._confirmOpen || ui._embodiedPodExitBusy || (window.ArcadeGlue && ArcadeGlue.active)
      || document.querySelector('.dg-modal-mask,.set-pop-mask,.chat-zoom-mask,.nw-lightbox,.ev-spawn,.insp-overlay,.sub-modal-overlay')) return false;
    close();
    if (document.querySelector('.v2b-panel-host') && !(window.WhaleRoom && WhaleRoom.isOpen())) return false;
    if (s.officeModal) { s.officeModal=null; ui.closeOfficeModal(); }
    const opened=WhaleRoom.open('affection');syncButton();return opened;
  }
  ui.onClick = function (event) {
    let target = event && event.target && event.target.closest && event.target.closest("[data-action]");
    // 与原 UI 同一恢复语义：软刷新可能把 click 派给按钮的共同祖先。
    // 在进入旧 office-modal 路由前识别按压目标，避免 whale-room 变成未知面板。
    const tip = event && event.target && event.target.closest && event.target.closest('[data-tip]');
    if (!target && !(tip && !tip.closest('[data-action]'))) {
      const pressed = this._pressTarget && this._pressTarget.closest && this._pressTarget.closest('[data-action]');
      const x = event && event.clientX != null ? event.clientX : this._pressUpX;
      const y = event && event.clientY != null ? event.clientY : this._pressUpY;
      const hit = x != null && y != null && document.elementFromPoint && document.elementFromPoint(x,y);
      const candidate = hit && hit.closest && hit.closest('[data-action]');
      if (pressed) target = candidate && candidate.dataset.action === pressed.dataset.action
        && (candidate.dataset.id || '') === (pressed.dataset.id || '') ? candidate : pressed;
      else target = candidate;
    }
    const action = target && target.dataset.action;
    if (!(action === "office-modal" && ['more','whale-room'].includes(target.dataset.id)) && action !== "office-more-feature") {
      if (panel && target && !panel.host.contains(target)) close();
      return onClick.apply(this,arguments);
    }
    this._clickHandled = true; this._pressTarget = null;
    if(event.preventDefault)event.preventDefault(); if(event.stopPropagation)event.stopPropagation();
    if(target.disabled)return;
    if(window.SFX)SFX.play("click");
    if (action === 'office-modal' && target.dataset.id === 'whale-room') return openWhaleRoom();
    return action === "office-more-feature" ? select(target.dataset.id) : open();
  };
  for (const name of ["renderOffice", "updateOfficeMain"]) {
    const original = ui[name];
    ui[name] = function () { const result = original.apply(this, arguments); syncButton(); return result; };
  }
  window.OfficeMore = {open,close,select,rows,isOpen:()=>!!panel};
})();
