/* ==========================================================================
   事件配置页（大模型研发养成 · §8 可视化配置）
   --------------------------------------------------------------------------
   编辑事件池（id/类型/标题/正文/触发条件/选项+效果），可增删改。
   保存（section=EVENTS）→ 同步 h5_demo/data/game_cfg.json → 游戏生效。
   默认模板 = 游戏出厂事件（GameDefaults.EVENTS）。
   ========================================================================== */
"use strict";

window.EventTool = {
  data: null,

  /* 决策界面类型（uiType）：决定该事件用哪张立绘 + 标签；与【界面立绘】页一致 */
  UI_TYPES: {
    fixed:    { name: "固定", icon: "📌" },
    random:   { name: "随机", icon: "🎲" },
    reward:   { name: "前置（达标触发）", icon: "🔓" },
    positive: { name: "正面", icon: "✨" },
    negative: { name: "负面", icon: "⚠️" },
    critical: { name: "关键", icon: "🔥" },
    recruit:  { name: "招聘", icon: "📋" },
  },
  UI_ORDER: ["fixed", "random", "reward", "positive", "negative", "critical", "recruit"],
  /* 触发类型（type）：决定触发机制；cond（状态条件触发）/multi（团队条件随意） */
  TYPES: [
    ["random", "random 随机"],
    ["fixed", "fixed 固定"],
    ["reward", "reward 达标触发"],
    ["critical", "critical 关键"],
    ["team", "team 团队条件"],
    ["recruit_wait", "recruit_wait 等待招聘"],
    ["cond", "cond 状态条件（办公室循环）"],
  ],
  /* 条件触发字段（cond 事件 / 2026-09-03）：全部可缺省，满足的组合才触发
     2026-09-10 删除残留项「精力 ≥ / 精力 <」：它与「全队平均体力」语义重复
     （引擎里都用 avg energy 判定），且没有任何事件在用。 */
  /* 2026-09-10：「协作 ≥ / 协作 <」（coop_above / coop_below）随「协作」属性一起删除 ——
     引擎侧已不再支持这两个条件键。 */
  CONDS: [
    ["avg_energy_above", "全队平均体力 ≥"], ["avg_energy_below", "全队平均体力 <"],
    ["funding_above", "经费 ≥"], ["funding_below", "经费 <"],
    ["corpus_below", "语料(有效token) <"],
    /* 2026-09-07 P2/P3 新增（doc/20 §1.5） */
    ["brand_above", "品牌 >"], ["brand_below", "品牌 <"],
    ["param_at_least", "立项参数 ≥(B)"], ["staff_at_least", "在编人数 ≥"],
    ["gpu_below", "算力档位序 <(basic=0)"], ["corpus_above_ratio", "语料 > 阶段GATE ×"],
    ["quit_risk", "离职风险已置位"], ["poach_risk", "挖角风险已置位"],
    ["investor", "已拿投资旗标"]],

  async refresh() {
    /* 默认事件池在 GameDefaults.base 下（兼容旧的顶层结构） */
    const G = window.GameDefaults || {};
    const defEv = (G.base || G).EVENTS;
    try {
      const r = await (await fetch("/api/game-cfg")).json();
      if (window.CfgSync) CfgSync.note(r);
      const saved = r.config || {};
      this.cfg = saved;
      this.data = Array.isArray(saved.EVENTS) && saved.EVENTS.length
        ? EventTool.deepClone(saved.EVENTS)
        : EventTool.deepClone(defEv);
    } catch (e) {
      this.data = EventTool.deepClone(defEv);
    }
    // 归一化：补齐 uiType/enabled，并把已保存（游戏格式）转为编辑器工作副本格式
    this.data = this.data.map((ev) => EventTool.normEvent(ev));
    this.render();
  },

  /* 事件 → 编辑器工作副本：兼容已保存过的游戏格式（week 数组/prob 小数/trigger 对象） */
  normEvent(ev) {
    const e = EventTool.deepClone(ev);
    if (e.uiType === undefined) e.uiType = EventTool.uiTypeOf(e);
    if (e.enabled === undefined) e.enabled = true;
    if (e.type === "random") {
      if (Array.isArray(e.week)) {
        e.weekMin = e.week[0];
        e.weekMax = e.week[1];
      }
      /* 20260829r：游戏概率是小数（1 = 100%），编辑器用整数百分比；
         <=1 一律当小数转换（prob=1 的 100% 歧义按游戏语义处理）。
         注意不能挂在 week 数组条件下——T01/M02 这类 random 事件可能没有 week 字段。 */
      if (e.prob !== undefined && e.prob <= 1) e.prob = Math.round(e.prob * 100);
      if (e.trigger && !e.trigger.stat) e.triggerExtra = e.trigger;
    } else if (e.type === "reward" && e.trigger && e.trigger.stat) {
      e.triggerStat = e.trigger.stat;
      e.triggerMin = e.trigger.min;
      delete e.trigger;      // 信息已转入 triggerStat/Min，避免保留+重建双份
    } else if (e.type === "team" && !e.cond) e.cond = {};
    else if (e.type === "cond" && !e.cond) e.cond = {};
    return e;
  },

  /* 事件界面类型推导（与游戏 game_core.uiTypeOf 一致） */
  uiTypeOf(ev) {
    if (!ev) return "random";
    if (ev.uiType) return ev.uiType;
    if (ev.type === "fixed" || ev.type === "recruit_wait") return "fixed";
    if (ev.type === "critical") return "critical";
    if (ev.type === "reward") return "reward";
    if (ev.type === "team") {
      const c = ev.cond || {};
      if (c.energy_above != null) return "positive";
      return "negative";
    }
    return "random";
  },

  init() {
    $("#event-add").addEventListener("click", () => {
      /* 事件已编号化（doc/32 §8）：新事件自动分配 no（1xxx 段，永不变），
         同时给一个可读的 key（引擎里少数几处按 key 找事件，别重名）。 */
      const maxNo = this.data.reduce((a, e) => Math.max(a, Number(e.no) || 1000), 1000);
      const no = maxNo + 1;
      this.data.push({
        no: no, key: "E_new_" + no,
        type: "random", title: "新事件", desc: "",
        weekMin: 4, weekMax: 24, prob: 15,
        options: [{ text: "选项A", effects: {} }],
      });
      this.render();
    });
    this.refresh();
  },

  deepClone(o) {
    return o === null || typeof o !== "object" ? o : (Array.isArray(o) ? o.map((x) => this.deepClone(x)) :
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, this.deepClone(v)])));
  },

  render() {
    const wrap = $("#event-list");
    if (!wrap) return;
    UI.clear(wrap);
    if (!this.data.length) {
      wrap.append(h("div", { class: "dim" }, "暂无事件，点右上角「+ 新增事件」添加。"));
      return;
    }
    // 按界面类型（uiType）分组；未在预设类型中的放末尾「其他」
    const grouped = {};
    this.data.forEach((ev, i) => {
      const ut = ev.uiType || EventTool.uiTypeOf(ev);
      (grouped[ut] = grouped[ut] || []).push(i);
    });
    const used = new Set();
    this.UI_ORDER.forEach((ut) => {
      const idxs = grouped[ut];
      if (!idxs || !idxs.length) return;
      idxs.forEach((i) => used.add(i));
      this.appendGroup(wrap, ut, idxs);
    });
    const rest = [];
    this.data.forEach((ev, i) => { if (!used.has(i)) rest.push(i); });
    if (rest.length) this.appendGroup(wrap, null, rest);
  },

  appendGroup(wrap, uiType, idxs) {
    const meta = (uiType && this.UI_TYPES[uiType]) || { name: "其他", icon: "🗂" };
    const box = h("div", { class: "ev-group" },
      h("div", { class: "ev-group-head" },
        h("span", { class: "ev-group-title" }, `${meta.icon} ${meta.name}界面`),
        h("span", { class: "ev-group-count" }, idxs.length + " 个事件")));
    idxs.forEach((i) => box.append(this.eventCard(this.data[i], i)));
    wrap.append(box);
  },

  eventCard(ev, i) {
    const typeSel = h("select", {}, ...EventTool.TYPES.map(([v, l]) => h("option", { value: v }, l)));
    typeSel.value = ev.type;

    // 界面类型（uiType）：决定用哪张立绘 + 标签；改动后重新分组
    const uiTypeSel = h("select", {}, ...this.UI_ORDER.map((v) => {
      const m = this.UI_TYPES[v];
      return h("option", { value: v }, `${m.icon} ${m.name}`);
    }));
    uiTypeSel.value = ev.uiType || EventTool.uiTypeOf(ev);
    uiTypeSel.addEventListener("change", () => { ev.uiType = uiTypeSel.value; this.render(); });

    // 触发条件（按类型）
    const trigger = h("div", { class: "gcf-trigger" });
    if (ev.type === "fixed" || ev.type === "critical") {
      trigger.append(h("label", { class: "gcf-inline" }, "固定触发周",
        this.numIn(ev.week || 8, (v) => { ev.week = v; })));
    } else if (ev.type === "reward") {
      const statSel = h("select", {}, ...["code", "text", "safety", "stability"]
        .map((s) => h("option", { value: s, selected: ev.triggerStat === s ? "" : null }, s)));
      statSel.value = ev.triggerStat || "code";
      statSel.addEventListener("change", () => { ev.triggerStat = statSel.value; });
      trigger.append(h("label", { class: "gcf-inline" }, "能力达标", statSel,
        this.numIn(ev.triggerMin || 70, (v) => { ev.triggerMin = v; }, "70px")));
    } else if (ev.type === "team" || ev.type === "cond") {
      // 团队/状态条件：按条件字段触发（team=旧协作/精力；cond=办公室循环状态条件 2026-09-03）
      if (!ev.cond) ev.cond = {};
      EventTool.CONDS.forEach(([k, l]) => {
        const inp = h("input", { type: "number", value: ev.cond[k] != null ? String(ev.cond[k]) : "", style: "width:64px;" });
        inp.addEventListener("change", () => {
          if (inp.value === "") delete ev.cond[k];
          else ev.cond[k] = +inp.value;
        });
        trigger.append(h("label", { class: "gcf-inline" }, l, inp));
      });
      if (ev.type === "cond") {
        trigger.append(h("label", { class: "gcf-inline" }, "冷却(周)",
          this.numIn(ev.cooldown != null ? ev.cooldown : 3, (v) => { ev.cooldown = v; }, "56px")));
      }
    } else {
      trigger.append(h("label", { class: "gcf-inline" }, "周范围",
        this.numIn(ev.weekMin !== undefined ? ev.weekMin : 4, (v) => { ev.weekMin = v; }, "70px"), " ~ ",
        this.numIn(ev.weekMax !== undefined ? ev.weekMax : 24, (v) => { ev.weekMax = v; }, "70px")));
      trigger.append(h("label", { class: "gcf-inline" }, "概率 %",
        this.numIn(ev.prob !== undefined ? ev.prob : 15, (v) => { ev.prob = v; }, "70px")));
    }
    // 是否启用（enabled:false 表示预留、游戏不触发）
    const enCb = h("input", { type: "checkbox" });
    enCb.checked = ev.enabled !== false;
    enCb.addEventListener("change", () => { ev.enabled = enCb.checked; });
    trigger.append(h("label", { class: "check-field", style: "margin-left:14px;" }, enCb, h("span", {}, "启用此事件")));
    // 触发时是否暂停时间（2026-09-03：pause 字段，缺省 true=暂停；纯氛围事件可关掉让时间继续走）
    const pauseCb = h("input", { type: "checkbox" });
    pauseCb.checked = ev.pause !== false;
    pauseCb.addEventListener("change", () => { ev.pause = pauseCb.checked ? undefined : false; });
    trigger.append(h("label", { class: "check-field", style: "margin-left:10px;" }, pauseCb, h("span", {}, "触发时暂停时间")));
    // 起效版本 minVer（2026-09-06）：VER_ORDER 顺序比较，未到版本不进事件池（如挖角/加薪 V1.5 起）
    const VER_ORDER = (window.GameCfgTool && window.GameCfgTool.data && window.GameCfgTool.data.VER_ORDER) || (this.cfg && this.cfg.VER_ORDER) || (window.GameDefaults && window.GameDefaults.base && window.GameDefaults.base.VER_ORDER) || [];
    const verSel = h("select", {}, h("option", { value: "" }, "起效版本: 不限"),
      ...VER_ORDER.map((v) => h("option", { value: v }, "起效版本: " + v)));
    verSel.value = ev.minVer || "";
    verSel.addEventListener("change", () => {
      if (verSel.value) ev.minVer = verSel.value; else delete ev.minVer;
    });
    trigger.append(h("label", { class: "check-field", style: "margin-left:10px;" }, verSel));

    /* 2026-09-07 P3（doc/20 §1.4/1.5/1.6）：阶段白名单 stages（多选）+ 一次性 once
       + 特殊通道 special + 注资标记 inject。
       ⚠️ 这些键原本也会靠「未知字段保留」原样存回，但没有表单 = 只能手改 JSON。 */
    const STAGES = VER_ORDER;
    const stagesBox = h("div", { class: "gcf-inline", style: "margin-left:10px;" }, "阶段白名单");
    STAGES.forEach((sv) => {
      const cb = h("input", { type: "checkbox" });
      cb.checked = Array.isArray(ev.stages) && ev.stages.includes(sv);
      cb.addEventListener("change", () => {
        if (!Array.isArray(ev.stages)) ev.stages = [];
        const at = ev.stages.indexOf(sv);
        if (cb.checked && at < 0) ev.stages.push(sv);
        else if (!cb.checked && at >= 0) ev.stages.splice(at, 1);
        if (!ev.stages.length) delete ev.stages;      // 不写 = 通用
      });
      stagesBox.append(h("label", { class: "check-field" }, cb, h("span", {}, sv)));
    });
    trigger.append(stagesBox);

    const onceCb = h("input", { type: "checkbox" });
    onceCb.checked = !!ev.once;
    onceCb.addEventListener("change", () => { ev.once = onceCb.checked ? true : undefined; });
    trigger.append(h("label", { class: "check-field", style: "margin-left:10px;" },
      onceCb, h("span", {}, "一局只出一次(once)")));

    const injectCb = h("input", { type: "checkbox" });
    injectCb.checked = !!ev.inject;
    injectCb.addEventListener("change", () => { ev.inject = injectCb.checked ? true : undefined; });
    trigger.append(h("label", { class: "check-field", style: "margin-left:10px;" },
      injectCb, h("span", {}, "注资类(inject·不分红/兜底后冷却)")));

    const spIn = h("input", { class: "gcf-id", style: "width:110px;", value: ev.special || "", placeholder: "special(空=常规)" });
    spIn.addEventListener("input", () => { if (spIn.value) ev.special = spIn.value; else delete ev.special; });
    trigger.append(h("label", { class: "check-field", style: "margin-left:10px;" },
      h("span", {}, "特殊通道"), spIn));
    /* 自研架构提案事件（2026-09-13）：special="proposal" 时补一个「对应架构」输入框 ——
       引擎靠这个字段把「团队提案」和架构对上（pendingProposalEvent / 提案只在未批准时弹）。
       ⚠️ arch 不在表单的其他地方，不显示的话改这个事件就像在改一个空壳。 */
    if (ev.special === "proposal") {
      const archIn = h("input", { class: "gcf-id", style: "width:100px;", value: ev.arch || "", placeholder: "架构 id" });
      archIn.title = "对应架构 id（mla / dsa / csa）——批准后该架构直接解锁";
      archIn.addEventListener("input", () => { if (archIn.value) ev.arch = archIn.value; else delete ev.arch; });
      trigger.append(h("label", { class: "check-field", style: "margin-left:10px;" },
        h("span", {}, "对应架构"), archIn));
    }

    /* no = 唯一编号（分配后永不变，**不给编辑**：改它 = 老存档 / 引用全断）；
       key = 可读别名（引擎按 key 找少数几个事件：V35_POACH / V35_BAILOUT / E101） */
    const idIn = h("span", { class: "gcf-id", title: "唯一编号（1xxx 段，分配后永不变；引用与存档都认它）" },
      "no " + (ev.no != null ? ev.no : "?"));
    const keyIn = h("input", { class: "gcf-id", style: "width:150px;", value: ev.key || "", placeholder: "可读别名 key" });
    keyIn.title = "可读别名：引擎按 key 找少数几个事件（V35_POACH / V35_BAILOUT / E101）—— 改这些会断链";
    keyIn.addEventListener("input", () => { ev.key = keyIn.value.trim() || null; });
    const poolCb = h("label", { class: "check-field", title: "关掉 = 不进常规掷骰池（只由代码/其它系统主动触发，如系统事件）" },
      h("input", { type: "checkbox" }),
      h("span", {}, "进常规事件池"));
    if (ev.pool !== false) poolCb.querySelector("input").setAttribute("checked", "checked");
    poolCb.querySelector("input").addEventListener("change", (e2) => {
      if (e2.target.checked) delete ev.pool; else ev.pool = false;
    });
    const titleIn = h("input", { class: "gcf-title", value: ev.title || "", placeholder: "事件标题" });
    titleIn.addEventListener("input", () => { ev.title = titleIn.value; });
    typeSel.addEventListener("change", () => { ev.type = typeSel.value; this.render(); });
    const descTa = h("textarea", { class: "gcf-desc", rows: "2", placeholder: "事件正文（可多行）" }, ev.desc || "");
    descTa.addEventListener("input", () => { ev.desc = descTa.value; });

    const optsBox = h("div", { class: "gcf-opts" });
    (ev.options || []).forEach((o, oi) => optsBox.append(this.optCard(ev, i, oi)));
    const addOpt = h("button", { class: "btn btn-sm" }, "+ 添加选项");
    addOpt.addEventListener("click", () => { ev.options.push({ text: "", effects: {} }); this.render(); });

    const del = h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;" }, "删除事件");
    del.addEventListener("click", () => { this.data.splice(i, 1); this.render(); });

    return h("div", { class: "gcf-event" },
      h("div", { class: "gcf-event-head ev-head" }, idIn, keyIn, poolCb, typeSel, uiTypeSel, titleIn, del),
      trigger, descTa, optsBox, addOpt);
  },

  /* [feature:embodied-event-editor] */
  optCard(ev, i, oi) {
    const o = ev.options[oi];
    const textIn = h("input", { class: "gcf-opt-text", value: o.text || "", placeholder: "选项文本" });
    textIn.addEventListener("input", () => { o.text = textIn.value; });
    const effBox = h("div", { class: "gcf-effects" });
    const EFF_KEYS = [["code", "代码"], ["text", "文字"], ["safety", "安全"], ["stability", "稳定"],
      ["funding", "经费(元)"], ["brand", "品牌"], ["reputation", "口碑"], ["time_cost", "时间(周)"],
      /* 2026-09-06 P1 语料条数制 + 2026-09-07 P2/P3 新效果（doc/20 §1.6） */
      ["corpus_normal", "普通语料(条)"], ["corpus_good", "良好语料(条)"], ["corpus_best", "优质语料(条)"],
      ["quit_risk", "离职埋雷概率(0~1)"], ["poach_risk", "挖角埋雷概率(0~1)"],
      /* doc/27 §9：追加能力轴的轴键（引擎 applyEffects 本来就按 dimsOf 遍历，
         未激活该轴的模型会自动忽略 → 对纯四维阶段零影响） */
      ["memory", "记忆轴"], ["reasoning", "推理轴"], ["tool", "工具轴"],
      ["embodiedCognition", "物理认知轴"], ["dexterousControl", "灵巧操控轴"],
      /* 2026-09-14：**真放假**（本周下班不产出、体力挂起到下周上班才回）——
         值 = 放假期间攒的体力点数。事件文案写「放假」就必须用它，别再只塞 *_stat.energy。
         target_rest = 只放目标那一位；team_rest = 全员。 */
      ["target_rest", "目标放假(体力)"], ["team_rest", "全员放假(体力)"],
      ["target_salary_raise", "目标涨薪比例(0~1)"], ["team_salary_raise", "全员涨薪比例(0~1)"]];
    const isNumKey = (k) => EFF_KEYS.some(([k2]) => k2 === k) || ["embodied_offer","embodied_efficiency"].includes(k);
    EFF_KEYS.forEach(([k, label]) => {
      const ratio = /salary_raise$|_risk$/.test(k);
      const inp = h("input", { type: "number", value: (o.effects && o.effects[k]) != null ? o.effects[k] : "", step: ratio ? "0.01" : "1" });
      if (ratio) { inp.min = "0"; inp.max = "1"; }
      inp.addEventListener("input", () => {
        if (!o.effects) o.effects = {};
        o.effects[k] = inp.value === "" ? "" : +inp.value;
      });
      effBox.append(h("span", { class: "gcf-eff" }, h("label", {}, label), inp));
    });
    /* 20260829r：高级效果（对象/字符串，如 team_stat / recruit_open / minigame / set_flag / growth_pct）
       用 JSON 文本区编辑——以前这些键保存时会被 Number() 毁成 NaN，节点事件一保存就坏。 */
    const advKeys = () => Object.keys(o.effects || {}).filter((k) => !isNumKey(k));
    const advInit = advKeys();
    const advTa = h("textarea", {
      class: "gcf-desc gcf-eff-json", rows: "2",
      placeholder: "高级效果（JSON）：如 {\"team_stat\":{\"energy\":5}} 、\"minigame\":\"sft\" 、{\"dividend\":{\"pct\":0.1,\"times\":3}} 、{\"recruit_offer\":{\"tier\":\"high\",\"weeks\":3}} 、\"bailout\":true 、\"game_over\":\"bankrupt\" 、{\"approve_arch\":\"mla\"}（自研架构提案：批准后直接解锁，见【玩法配置】→ 架构 · 解锁方式）",
    }, advInit.length ? JSON.stringify(Object.fromEntries(advInit.map((k) => [k, o.effects[k]])), null, 1) : "");
    advTa.addEventListener("change", () => {
      if (!o.effects) o.effects = {};
      let parsed = null;
      try { parsed = JSON.parse(advTa.value || "{}"); }
      catch (e) { advTa.style.borderColor = "#ff6b6b"; advTa.title = "JSON 格式有误，未保存"; return; }
      advTa.style.borderColor = ""; advTa.title = "";
      advKeys().forEach((k) => { delete o.effects[k]; });
      Object.assign(o.effects, parsed || {});
    });
    const mark = () => { if (window.App && App.markCfgDirty) App.markCfgDirty(); };
    const invitationId=()=>{
      const ids=new Set((this.data||[]).flatMap(event=>(event.options||[]).map(option=>option.effects&&option.effects.embodied_offer&&option.effects.embodied_offer.id)));let id;
      do{const suffix=window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+(this._invitationCounter=(this._invitationCounter||0)+1).toString(36);id='invite_'+suffix;}while(ids.has(id));return id;
    };
    for (const [key,label,initial] of [
      ["embodied_offer","具身工程师入队邀请",{id:invitationId(),minLevel:3,maxLevel:5}],
      ["embodied_efficiency","具身时代临时效率",{mul:1,ticks:1}]
    ]) {
      const enabled=h("input",{type:"checkbox",checked:!!(o.effects&&o.effects[key])}),fields=h("div",{class:"gcf-effects"});
      enabled.checked=!!(o.effects&&o.effects[key]);
      enabled.addEventListener("change",()=>{o.effects=o.effects||{};if(enabled.checked)o.effects[key]={...initial};else delete o.effects[key];mark();this.render();});
      const box=h("div",{class:"gcf-row-card","data-embodied-effect":key},h("label",{},enabled,label),fields);
      const value=o.effects&&o.effects[key];fields.hidden=!value;
      if (value) {
        for(const [name,title] of (key==="embodied_offer"?[["id","邀请稳定编号"],["minLevel","最低词条等级"],["maxLevel","最高词条等级"]]:[["mul","产出倍率（0.5～1.25）"],["ticks","持续 tick（最多一周）"]])) {
          const inp=h("input",{type:name==="id"?"text":"number",value:value[name]??initial[name],"data-embodied-field":name,step:name==="mul"?"0.05":"1"});
          if(name==="id")inp.readOnly=true;
          else {inp.min=name==="mul"?.5:1;inp.max=name==="mul"?1.25:name==="ticks"?((this.cfg&&this.cfg.V35||{}).TICKS_PER_WEEK||6):5;}
          inp.addEventListener("input",()=>{if(name==='id')return;value[name]=inp.value===""?NaN:Number(inp.value);mark();});
          fields.append(h("label",{class:"gcf-field"},title,inp));
        }
        fields.append(h("p",{class:"gcf-tip"},key==="embodied_offer"?"邀请在招聘候选中等待座位，仍需按原招聘流程录用。邀请和临时效率需放在不同选项中。":"仅在具身阶段生效，持续最多一周；不会永久修改工程师或基础数值。"));
      }
      effBox.append(box);
    }
    effBox.append(advTa);
    const delOpt = h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;" }, "✕");
    delOpt.addEventListener("click", () => { ev.options.splice(oi, 1); this.render(); });
    return h("div", { class: "gcf-opt" },
      h("div", { class: "gcf-opt-head" },
        h("span", { class: "dim" }, "选项 " + String.fromCharCode(65 + oi)), delOpt),
      textIn, effBox);
  },

  /* [/feature:embodied-event-editor] */
  numIn(val, onchg, width) {
    const inp = h("input", { type: "number", value: String(val) });
    if (width) inp.style.width = width;
    inp.addEventListener("change", () => { const v = parseFloat(inp.value); if (!isNaN(v)) onchg(v); });
    return inp;
  },

  async save({ silent = false } = {}) {
    // 工作副本 → 游戏结构（触发条件合并、effects 去空值、保留 triggerExtra/cond/enabled）
    /* 20260829r：编辑器表单之外的顶层字段（test 聊天配置 / prologue 剧情 / pick 目标人 /
       weekAtLeast / repeat / cooldown / when 条件…）必须原样带回——
       以前重建对象只带 4 个字段，V1 节点事件（V1T1/V1T2 聊天演出）一保存就残废。
       prob 不进 KNOWN：random 分支显式写；team/reward 的 prob 走未知字段保留。 */
    const KNOWN = new Set(["id", "no", "key", "pool", "type", "title", "desc", "uiType", "enabled",
      "week", "weekMin", "weekMax", "trigger", "triggerStat", "triggerMin", "cond", "triggerExtra", "options"]);
    const events = this.data.map((ev) => {
      const e = {};
      for (const k of Object.keys(ev)) if (!KNOWN.has(k)) e[k] = EventTool.deepClone(ev[k]);
      e.no = ev.no; e.key = ev.key;             // 事件引用锚点（doc/32 §8）
      if (ev.pool === false) e.pool = false;    // 默认在池 → 不写，省配置
      e.type = ev.type; e.title = ev.title; e.desc = ev.desc;
      // 持久化界面类型（决定立绘 + 标签）；缺省按触发类型推导
      e.uiType = ev.uiType || EventTool.uiTypeOf(ev);
      // 预留事件（enabled:false）持久化，游戏跳过不触发
      if (ev.enabled === false) e.enabled = false;
      if (ev.type === "fixed" || ev.type === "critical") {
        // 20260829r：没有固定周的事件（E_EARLY / V_REFER 由引擎条件触发）不硬造 week=8
        if (ev.week != null) e.week = Number(ev.week) || 8;
      } else if (ev.type === "reward") {
        // 20260829r：只在表单里真的填过达标条件时才写 trigger——
        // M01 这类用 when 条件触发的 reward 事件不该被硬造一个默认 trigger
        if (ev.triggerStat) e.trigger = { stat: ev.triggerStat, min: Number(ev.triggerMin) || 70 };
      } else if (ev.type === "cond") {
        // 状态条件事件（办公室循环 2026-09-03）：只保留 cond；cooldown/repeat 走未知键保留
        const cond = {};
        EventTool.CONDS.forEach(([k]) => { if (ev.cond && ev.cond[k] !== undefined) cond[k] = Number(ev.cond[k]); });
        if (Object.keys(cond).length) e.cond = cond;
      } else if (ev.type === "team") {
        // 团队条件事件：无周/概率，带 cond 触发条件
        const cond = {};
        EventTool.CONDS.forEach(([k]) => { if (ev.cond && ev.cond[k] !== undefined) cond[k] = Number(ev.cond[k]); });
        if (Object.keys(cond).length) e.cond = cond;
      } else if (ev.type === "recruit_wait") {
        // 等待招聘：时间成本事件，无额外触发字段
      } else {
        // 20260829r：没有填周范围的事件（如 M02/T01 全周期触发）不硬造 week=[4,24]
        if (ev.weekMin != null || ev.weekMax != null) {
          e.week = [Number(ev.weekMin) || 4, Number(ev.weekMax) || 24];
        }
        e.prob = (Number(ev.prob) || 0) / 100;
        if (ev.triggerExtra && typeof ev.triggerExtra === "object") e.trigger = { ...ev.triggerExtra };
      }
      /* ⚠️ 这份名单必须与上面的 EFF_KEYS 对齐 —— 漏一个，该键保存时就会被当高级效果原样透传，
         于是**数字变字符串**（2026-09-14 实测漂了：corpus_normal/good/best 不在名单里，
         而它们是加法 → "80" 拼串会把语料算成 "08080"；quit_risk/poach_risk 也漏了）。
         doc/27 §9：轴键 memory / reasoning / tool 也在这里。 */
      const NUM_EFF = new Set(["code", "text", "safety", "stability", "funding", "brand", "reputation", "time_cost",
        "memory", "reasoning", "tool",
        "corpus_normal", "corpus_good", "corpus_best", "quit_risk", "poach_risk", "target_rest", "team_rest",
        "target_salary_raise", "team_salary_raise"]);
      e.options = (ev.options || []).map((o) => {
        const effects = {};
        for (const [k, v] of Object.entries(o.effects || {})) {
          if (v === "" || v === null || v === undefined) continue;
          /* 数值键转 Number；对象/字符串/布尔等高级效果原样保留（20260829r） */
          effects[k] = NUM_EFF.has(k) ? Number(v) : v;
        }
        return { text: o.text || "", effects };
      });
      return e;
    });
    /* silent=由右上角「保存全部」统一调用；失败抛错由 App 汇总 */
    const saveBody = async () => {
      const r = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "EVENTS", config: events,
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      if (window.CfgSync) CfgSync.update(d.mtime);
    };
    try {
      await saveBody();
      if (!silent) UI.toast("事件配置已保存并同步到游戏");
    } catch (e) {
      if (silent) throw e;
      UI.toast("保存失败：" + e.message, "err");
    }
  },
};

/* [feature:staff-raise-event-editor-20261012] */
(function(tool){
 if(!tool||tool._staffRaiseEventUI)return;tool._staffRaiseEventUI=true;
 tool.UI_TYPES.team={name:'员工 / HR',icon:'👥'};if(!tool.UI_ORDER.includes('team'))tool.UI_ORDER.push('team');
 const dirty=()=>{if(window.App&&App.markCfgDirty)App.markCfgDirty();};
 const card=tool.eventCard;
 tool.eventCard=function(ev){
  const node=card.apply(this,arguments);if(ev.special!=='staff_raise')return node;
  const head=node.querySelector('.gcf-event-head'),type=head.querySelector('select'),pool=head.querySelector('input[type="checkbox"]');type.disabled=true;type.title='薪酬沟通由专属条件系统投递';if(pool){pool.disabled=true;pool.title='系统条件事件，不进入常规随机池';}
  const trigger=node.querySelector('.gcf-trigger');
  for(const label of [...trigger.querySelectorAll(':scope > label')]){
   if(label.querySelector('input[type="number"]')||/一局只出一次|注资类/.test(label.textContent))label.remove();
  }
  const special=trigger.querySelector('input[placeholder="special(空=常规)"]');if(special){special.readOnly=true;special.title='员工薪酬事件通道';}
  const row=document.createElement('label');row.className='gcf-inline';row.appendChild(document.createTextNode('员工沟通原因 '));
  const reason=document.createElement('select');reason.dataset.staffRaiseReason='';
  for(const [value,text]of [['overdue','员工：久未涨薪'],['upgrade','HR：词条升级后未调薪']]){const option=document.createElement('option');option.value=value;option.textContent=text;reason.appendChild(option);}
  reason.value=ev.raiseReason;reason.addEventListener('change',()=>{ev.raiseReason=reason.value;dirty();});row.appendChild(reason);trigger.prepend(row);
  const note=document.createElement('p');note.className='gcf-tip';note.textContent='此事件按【玩法配置 → 团队 → 员工薪酬沟通】的阈值投递；两类每阶段合计最多2次、同人每阶段1次、每周1次。常规随机概率、冷却、条件和一次性标记不参与该通道。阶段白名单、起效阶段、启用与暂停设置仍有效。';trigger.appendChild(note);
  return node;
 };
 const optionCard=tool.optCard;
 tool.optCard=function(ev,i,oi){
  const node=optionCard.apply(this,arguments);if(ev.special!=='staff_raise')return node;
  const option=ev.options[oi],box=node.querySelector('.gcf-effects'),advanced=node.querySelector('.gcf-eff-json');
  const row=document.createElement('label');row.className='check-field';const enabled=document.createElement('input');enabled.type='checkbox';enabled.dataset.staffRaiseReject='';enabled.checked=!!(option.effects&&option.effects.staff_raise_reject===true);
  row.append(enabled,document.createTextNode('拒绝薪酬建议：按玩法配置概率触发该员工短期减产'));box.prepend(row);
  if(advanced){try{const value=JSON.parse(advanced.value||'{}');delete value.staff_raise_reject;advanced.value=Object.keys(value).length?JSON.stringify(value,null,1):'';}catch(_){}advanced.addEventListener('change',()=>{option.effects=option.effects||{};if(enabled.checked)option.effects.staff_raise_reject=true;else delete option.effects.staff_raise_reject;dirty();});}
  enabled.addEventListener('change',()=>{option.effects=option.effects||{};if(enabled.checked)option.effects.staff_raise_reject=true;else delete option.effects.staff_raise_reject;dirty();});
  return node;
 };
})(window.EventTool);
/* [/feature:staff-raise-event-editor-20261012] */
