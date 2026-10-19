/* ==========================================================================
   工程师配置页（大模型研发养成）
   --------------------------------------------------------------------------
   编辑工程师候选池：档案（姓名/性别/年龄/学历/头像）、词条（工作经验）、
   潜力属性（协作/精力/代码/算法/文字）、稀有度、月薪、简历（大学+经历）、可刷出阶段。
   按岗位（type）分组，同岗位相邻、每行两张卡，便于浏览。
   保存（section=ENGINEERS）→ 同步游戏。avatarIdx → resource/ui/avatar_N.webp（工程师使用 100～233 共 134 张头像）。
   ========================================================================== */
"use strict";

window.EngineerTool = {
  data: null,

  /* 岗位分组顺序与标签（与游戏 ENGINEER_TYPES 一致；infra 已退役 2026-09-09，2026-09-16 下拉同步移除） */
  get TYPE_ORDER() {
    const defs=(window.GameDefaults && window.GameDefaults.base)||{}, types=Object.assign({},defs.ENGINEER_TYPES,(this.cfg||{}).ENGINEER_TYPES);
    return Object.keys(types).length ? Object.entries(types).filter(([id])=>!["infra","engineer"].includes(id)).map(([id,row])=>[id,row.name||id]) : [["pretrain","预训练"],["post","后训练"],["data","数据"],["embodied","具身智能"]];
  },
  /* 稀有度档位（2026-09-12：名字从配置 TIER_COLORS 取，见 rarityOptions()；
     这里只留档位键，空 = 自动根据潜力属性推导） */
  /* 可用头像张数（resource/ui/avatar_0~(N-1).webp，由 python gen_avatars_webp.py 生成） */
  /* [feature:v2a-avatar-picker] */
  /* Reason: the engineer picker uses modern portraits; legacy files remain for original visitors. */
  AVATAR_COUNT: 234,
  AVATAR_START: 100,
  portraitUrl(index) {
    return "/resource/ui/avatar_" + index + ".webp" + (index >= 203 && index <= 233 ? "?v=20261008m" : "");
  },
  modernAvatarIndex(e, fallback = 0) {
    const valid = n => Number.isInteger(n) && n >= this.AVATAR_START && n < this.AVATAR_COUNT;
    const from = row => {
      const explicit = Number(row && row.avatarIdx);
      if (valid(explicit)) return explicit;
      const match = /(?:^|\/)avatar_(\d+)\.webp$/.exec(row && row.avatar || "");
      return match && valid(+match[1]) ? +match[1] : null;
    };
    const defaults = window.GameDefaults || {}, rows = (defaults.base || defaults).ENGINEERS || [];
    const match = e && ((e.no != null && rows.find(row => Number(row.no) === Number(e.no))) ||
      ((e.key || e.id) && rows.find(row => row.key === (e.key || e.id))));
    const direct = from(e);
    const oldBodyDefault = !(e && e.avatarCustomized === true) && match && Number(match.no) >= 2104 && Number(match.no) <= 2112 &&
      direct === Number(match.no) - 2004 && (!e.avatar || e.avatar === 'resource/ui/avatar_' + direct + '.webp');
    if (direct != null && !oldBodyDefault) return direct;
    const mapped = from(match);
    if (mapped != null) return mapped;
    const offset = Number.isFinite(Number(fallback)) ? Math.abs(Math.trunc(Number(fallback))) : 0;
    return this.AVATAR_START + offset % (this.AVATAR_COUNT - this.AVATAR_START);
  },
  /* [/feature:v2a-avatar-picker] */

  RARITY_KEYS: ["gray", "blue", "pink", "orange", "rainbow"],

  async refresh() {
    /* 默认工程师池在 GameDefaults.base 下（兼容旧的顶层结构） */
    const G = window.GameDefaults || {};
    const defEng = (G.base || G).ENGINEERS;
    try {
      const r = await (await fetch("/api/game-cfg")).json();
      if (window.CfgSync) CfgSync.note(r);
      const saved = r.config || {};
      this.cfg = saved;                       // 供稀有度 / 薪资 / 保底校验实时预览
      this.data = Array.isArray(saved.ENGINEERS) && saved.ENGINEERS.length
        ? EngineerTool.norm(saved.ENGINEERS)
        : EngineerTool.norm(defEng);
    } catch (e) {
      this.data = EngineerTool.norm(defEng);
    }
    this.render();
  },

  /* 归一化：老配置的 avatar 全路径 → avatarIdx */
  norm(list) {
    /* [feature:v2d-avatar-editor-normalize] */
    return list.map((e, index) => {
    /* [/feature:v2d-avatar-editor-normalize] */
      const n = EngineerTool.deepClone(e);
      /* [feature:v2d-avatar-editor-normalize-index] */
      n.avatarIdx = EngineerTool.modernAvatarIndex(n, index);
      /* [/feature:v2d-avatar-editor-normalize-index] */
      if (!n.stage) n.stage = ["V1"];
      if (!n.type) n.type = this.primaryType(n);
      this.normalizeTalent(n);
      return n;
    });
  },

  deepClone(o) {
    return o === null || typeof o !== "object" ? o : (Array.isArray(o) ? o.map((x) => this.deepClone(x)) :
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, this.deepClone(v)])));
  },

  primaryType(e) {
    if (e && e.type) return e.type;
    return ((e && e.traits) || []).find(t => t && ["pretrain","post","data","embodied"].includes(t.type))?.type || "pretrain";
  },
  statKeys(e) { return this.primaryType(e) === "embodied" ? ["code","algo","engineering"] : ["code","algo","text"]; },
  normalizeTalent(e) {
    if (!e) return e;
    const stats=e.stats || (e.stats={}), embodied=this.primaryType(e)==="embodied";
    const key=embodied?"engineering":"text", previous=embodied?"text":"engineering";
    // A deliberate zero is a real talent value, including old templates.
    if(stats[key]==null)stats[key]=stats[previous]!=null?stats[previous]:70;
    const value=Number(stats[key]);stats[key]=Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):70;
    delete stats[previous];delete stats.energy;delete stats.coop;
    return e;
  },
  mainTrait(e) { return ((e && e.traits) || []).find(t => t && t.type === this.primaryType(e)) || {type:this.primaryType(e),level:1}; },

  init() {
    $("#eng-add").addEventListener("click", () => {
      /* ⚠️ ID 化（2026-09-14）：池子条目 = `no`（编号，永不变）+ `key`（= 历史 id 形态的可读别名），
         `id` 已删。新人 = 当前最大编号 + 1；key 保证唯一（撞了就顺延）。 */
      const no = this.data.reduce((m, e) => Math.max(m, e.no || 0), 2000) + 1;
      let key = "eng_" + String(no).slice(-2);
      let g = 0;
      while (this.data.some((e) => e.key === key)) { g++; key = "eng_" + String(no) + "_" + g; }
      this.data.push({
        no, key,
        /* [feature:v2d-avatar-editor-new] */
        name: "新工程师", gender: "男", age: 26, edu: "硕士", avatarIdx: this.modernAvatarIndex({ no, key }, this.data.length),
        /* [/feature:v2d-avatar-editor-new] */
        type: "pretrain", rarity: "", traits: [{ type: "pretrain", level: 1 }],
        salary: 150000, stats: { code: 70, algo: 70, text: 70 },
        resume: { univ: "", exp: "" }, stage: ["V1"],
      });
      this.render();
    });
    this.refresh();
  },

  /* 按「岗位 × 词条等级」两级分组（2026-09-06，doc/22）
     池子扩到 56 人后，只按岗位分一组会有十几张卡堆在一起，
     所以再按主词条等级拆一层；开局固定 / 未进池的单独成组。 */
  render() {
    const wrap = $("#eng-list");
    if (!wrap) return;
    UI.clear(wrap);
    if (!this.data.length) {
      wrap.append(h("div", { class: "dim" }, "暂无工程师，点右上角「+ 新增工程师」添加。"));
      return;
    }
    const starters = [], inactive = [], byType = {};
    this.data.forEach((e, i) => {
      if (e.starter) { starters.push(i); return; }
      if (e.pool === false) { inactive.push(i); return; }
      const t = e.type || "pretrain";
      const lv = this.traitLv(e);
      byType[t] = byType[t] || {};
      (byType[t][lv] = byType[t][lv] || []).push(i);
    });

    wrap.append(this.summaryBar());
    if (starters.length) this.appendGroup(wrap, "开局固定（V1 保底，不走随机、不过期）", starters);
    this.TYPE_ORDER.forEach(([type, label]) => {
      const lvMap = byType[type];
      if (!lvMap) return;
      Object.keys(lvMap).sort((a, b) => a - b).forEach((lv) => {
        this.appendGroup(wrap, label + " 岗位 · 词条 Lv" + lv, lvMap[lv]);
      });
    });
    if (inactive.length) this.appendGroup(wrap, "未进候选池（pool:false · 架构岗暂不启用）", inactive);
  },

  /* 顶部概览：总数 / 各级人数 / 未进池人数，一眼看出池子结构对不对 */
  summaryBar() {
    const cnt = { pool: 0, inactive: 0, starter: 0, byLv: {} };
    this.data.forEach((e) => {
      if (e.starter) { cnt.starter++; return; }
      if (e.pool === false) { cnt.inactive++; return; }
      cnt.pool++;
      const lv = this.traitLv(e);
      cnt.byLv[lv] = (cnt.byLv[lv] || 0) + 1;
    });
    const lvTxt = Object.keys(cnt.byLv).sort((a, b) => a - b)
      .map((lv) => "Lv" + lv + " " + cnt.byLv[lv]).join(" / ") || "—";
    const parts = [
      "候选人池 " + cnt.pool + " 人",
      "等级分布：" + lvTxt,
      "开局固定 " + cnt.starter + " 人",
      "未进池 " + cnt.inactive + " 人",
    ];
    return h("div", { class: "gcf-preview" }, parts.join("　·　"));
  },

  /* 主词条等级 */
  traitLv(e) {
    const t = this.mainTrait(e);
    return (t && t.level) || 1;
  },

  /* 核心天赋（与游戏 GameCore.coreTalentOf 同口径） */
  coreTalent(e) {
    const U = (this.cfg && this.cfg.TRAIT_UPGRADE) || ((window.GameDefaults && window.GameDefaults.base)||{}).TRAIT_UPGRADE || {};
    const t = this.mainTrait(e);
    let keys = (t && U.traits && U.traits[t.type] && U.traits[t.type].stats) || null;
    if (!keys || !keys.length) {
      keys = { pretrain: ["algo"], post: ["algo"], engineer: ["code"], data: ["code", "text"], embodied: ["algo","engineering"], academic: ["text"] }[t && t.type]
        || { pretrain: ["algo"], post: ["algo"], infra: ["code"], data: ["code"] }[e && e.type] || ["algo"];
    }
    this.normalizeTalent(e);
    const s = (e && e.stats) || {};
    let sum = 0;
    keys.forEach((k) => { sum += (s[k] || 0); });
    return sum / keys.length;
  },

  /* 稀有度下拉项：档位名从配置 TIER_COLORS 取（唯一真源；不在编辑器里再抄一份名字） */
  rarityOptions() {
    const TC = ((this.cfg || {}).TIER_COLORS) || (window.GameDefaults && window.GameDefaults.base
      && window.GameDefaults.base.TIER_COLORS) || {};
    const fb = { gray: "一般", blue: "良好", pink: "优秀", orange: "天才", rainbow: "大牛" };
    return [["", "🎲 自动（按潜力）"]].concat(this.RARITY_KEYS.map((k) => [k, (TC[k] && TC[k].name) || fb[k] || k]));
  },
  /* 档位名（派生行显示用，同 rarityOptions 同一来源） */
  tierName(key) {
    const TC = ((this.cfg || {}).TIER_COLORS) || (window.GameDefaults && window.GameDefaults.base
      && window.GameDefaults.base.TIER_COLORS) || {};
    return (TC[key] && TC[key].name) || key;
  },

  /* 该工程师的等级 = 拥有的**最高**词条等级（与游戏 GameCore.engLevel 同口径）
     2026-09-25：学术（academic）是辅助词条，**不计入等级** —— 口径必须与游戏一致，
     否则编辑器会把「低天赋 + 高学术」的好数据误报成超天花板脏数据。 */
  engLv(e) {
    let lv = 0;
    ((e && e.traits) || []).forEach((t) => {
      if (t.type === "academic") return;
      lv = Math.max(lv, t.level || 1);
    });
    return lv || 1;
  },

  /* 天赋档自动判定（与游戏 GameCore.tierOf **同口径**：只看天赋数值 + 读配置 TIER_THRESHOLDS）
     2026-09-12 用户拍板改版：天赋档不再和词条等级取高；等级以「-lvN」的形式跟在档位后面。 */
  autoTier(e) {
    const T = (this.cfg && this.cfg.TIER_THRESHOLDS) || [60, 70, 80, 90];
    const t = this.coreTalent(e);
    return t >= (T[3] != null ? T[3] : 90) ? "rainbow"
      : t >= (T[2] != null ? T[2] : 80) ? "orange"
      : t >= (T[1] != null ? T[1] : 70) ? "pink"
      : t >= (T[0] != null ? T[0] : 60) ? "blue" : "gray";
  },

  /* 该档位的词条等级天花板（配置 TALENT_LV_CAP）——超过就是脏数据（红字提示） */
  lvCapOf(tierKey) {
    const C = (this.cfg && this.cfg.TALENT_LV_CAP) || {};
    return C[tierKey] != null ? C[tierKey] : 5;
  },

  /* 薪资（与游戏 GameCore.salaryOf 同口径） */
  salaryOf(e) {
    const B = (this.cfg && this.cfg.TRAIT_BASE_SALARY) || { 1: 90000, 2: 140000, 3: 210000, 4: 300000, 5: 420000 };
    const lv = this.traitLv(e);
    const base = B[lv] || 90000;
    const t = Math.max(0, Math.min(100, this.coreTalent(e)));
    return Math.round(base * (0.6 + (t / 100) * (t / 100) * 0.8));
  },

  appendGroup(wrap, label, idxs) {
    const grid = h("div", { class: "eng-grid" });
    idxs.forEach((i) => grid.append(this.engCard(this.data[i], i)));
    wrap.append(h("div", { class: "eng-group" },
      h("div", { class: "eng-group-head" }, label, h("span", { class: "eng-group-count" }, idxs.length + " 人")),
      grid));
  },

  engCard(e, i) {
    this.normalizeTalent(e);
    /* engineer 已退役（2026-09-16 二轮清理）：下拉不再提供，旧档案里的 engineer 词条由 server.py 清洗成 pretrain */
    const defaults=(window.GameDefaults && window.GameDefaults.base)||{}, cfg=this.cfg||{}, data=(window.GameCfgTool && window.GameCfgTool.data)||{};
    const meta=Object.assign({},defaults.TRAIT_META,cfg.TRAIT_META,data.TRAIT_META);
    const TRAITS=[...new Set([...(data.TRAIT_TYPES||cfg.TRAIT_TYPES||defaults.TRAIT_TYPES||[]),...(e.traits||[]).map(row=>row.type)])].map(id=>[id,(meta[id]||{}).name||id]);
    const STAGES=(data.VER_ORDER||cfg.VER_ORDER||defaults.VER_ORDER||[]).map(id=>[id,id+" 版本"]);

    // 基本信息行
    const nameIn = h("input", { class: "gcf-id", value: e.name || "", placeholder: "姓名" });
    nameIn.addEventListener("input", () => { e.name = nameIn.value; });
    const genderSel = h("select", {}, h("option", { value: "男" }, "男"), h("option", { value: "女" }, "女"));
    genderSel.value = e.gender || "男";
    genderSel.addEventListener("change", () => { e.gender = genderSel.value; });
    const ageIn = h("input", { type: "number", value: String(e.age || 26), style: "width:60px;" });
    ageIn.addEventListener("change", () => { e.age = +ageIn.value; });
    const eduSel = h("select", {}, ...["学士", "硕士", "博士"].map((x) => h("option", { value: x }, x)));
    eduSel.value = e.edu || "硕士";
    eduSel.addEventListener("change", () => { e.edu = eduSel.value; });

    // 岗位（type）选择：改动后重新分组
    const typeSel = h("select", { "data-eng-role": "1" }, ...this.TYPE_ORDER.map(([v, l]) => h("option", { value: v }, l)));
    typeSel.value = e.type || "pretrain";
    typeSel.addEventListener("change", () => { e.type = typeSel.value; this.normalizeTalent(e); this.render(); });

    // 稀有度选择（空 = 自动）※ 覆盖自动计算
    const rarSel = h("select", {}, ...this.rarityOptions().map(([v, l]) => h("option", { value: v }, l)));
    rarSel.value = (e.rarity && e.rarity !== "auto") ? e.rarity : "";
    rarSel.addEventListener("change", () => {
      if (rarSel.value) e.rarity = rarSel.value;
      else delete e.rarity;
    });

    const salaryIn = h("input", { type: "number", value: String(e.salary || 150000), step: "10000", style: "width:100px;" });
    const halfYear = h("span", { class: "dim", style: "font-size:0.85em;" },
      "半年薪 " + EngineerTool.fmtMoney((e.salary || 150000) * 6));
    salaryIn.addEventListener("change", () => {
      e.salary = +salaryIn.value;
      halfYear.textContent = "半年薪 " + EngineerTool.fmtMoney(e.salary * 6);
    });

    /* [feature:v2d-avatar-editor-card] */
    // 沿用原头像下拉与预览，只列出仍存在的新版头像 100～233。
    e.avatarIdx = this.modernAvatarIndex(e, i);
    const avatarPrev = h("img", { class: "eng-avatar-prev", src: this.portraitUrl(e.avatarIdx) });
    const avatarSel = h("select", {}, ...Array.from({ length: this.AVATAR_COUNT - this.AVATAR_START }, (_, offset) => {
      const k = this.AVATAR_START + offset;
      return h("option", { value: String(k) }, "头像 " + k);
    }));
    avatarSel.value = String(e.avatarIdx);
    avatarSel.addEventListener("change", () => {
      const picked = Number(avatarSel.value);
      if (Number.isInteger(picked) && picked >= this.AVATAR_START && picked < this.AVATAR_COUNT) e.avatarCustomized = true;
      e.avatarIdx = this.modernAvatarIndex({ ...e, avatarIdx: picked }, i);
      avatarSel.value = String(e.avatarIdx);
      avatarPrev.src = this.portraitUrl(e.avatarIdx);
    });
    /* [/feature:v2d-avatar-editor-card] */

    // 词条（可增删）
    const traitsBox = h("div", { class: "gcf-traits" });
    const renderTraits = () => {
      UI.clear(traitsBox);
      (e.traits || []).forEach((t, ti) => {
        const sel = h("select", {}, ...TRAITS.map(([v, l]) => h("option", { value: v }, l)));
        sel.value = t.type;
        sel.addEventListener("change", () => { t.type = sel.value; });
        const lv = h("input", { type: "number", value: String(t.level), min: "1", max: "5", style: "width:56px;" });
        lv.addEventListener("change", () => { t.level = Math.max(1, Math.min(5, +lv.value || 1)); });
        const del = h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;" }, "✕");
        del.addEventListener("click", () => { e.traits.splice(ti, 1); renderTraits(); });
        traitsBox.append(h("span", { class: "gcf-trait-edit" }, sel, "Lv", lv, del));
      });
    };
    renderTraits();
    const addTrait = h("button", { class: "btn btn-sm" }, "+ 词条");
    addTrait.addEventListener("click", () => {
      if (!e.traits) e.traits = [];
      if (e.traits.length < 3) { e.traits.push({ type: "pretrain", level: 1 }); renderTraits(); }
    });

    // Ordinary roles use text; embodied engineers train engineering instead.
    // Energy is a separate status and never an editable talent dimension.
    const statsBox = h("div", { class: "gcf-effects" });
    this.statKeys(e)
        .map((k) => [k, ({ code: "代码", algo: "算法", text: "文字", engineering:"工程" })[k]]).forEach(([k, l]) => {
      const inp = h("input", { "data-eng-stat":k, type: "number", value: String((e.stats && e.stats[k]) != null ? e.stats[k] : 70), min: "0", max: "100", step:"1" });
      inp.addEventListener("change", () => {
        if (!e.stats) e.stats = {};
        e.stats[k] = Math.max(0, Math.min(100, Math.round(+inp.value || 0)));
      });
      statsBox.append(h("span", { class: "gcf-eff" }, h("label", {}, l), inp));
    });

    // 简历
    const univIn = h("input", { class: "gcf-opt-text", value: (e.resume && e.resume.univ) || "", placeholder: "毕业大学/学历" });
    univIn.addEventListener("input", () => { if (!e.resume) e.resume = {}; e.resume.univ = univIn.value; });
    const expTa = h("textarea", { class: "gcf-desc", rows: "2", placeholder: "过往工作经历" }, (e.resume && e.resume.exp) || "");
    expTa.addEventListener("input", () => { if (!e.resume) e.resume = {}; e.resume.exp = expTa.value; });

    // 可刷出阶段（多选）
    const stageBox = h("div", { class: "gcf-trigger" });
    STAGES.forEach(([v, l]) => {
      const cb = h("input", { type: "checkbox" });
      cb.checked = (e.stage || []).includes(v);
      cb.addEventListener("change", () => {
        if (!e.stage) e.stage = [];
        if (cb.checked && !e.stage.includes(v)) e.stage.push(v);
        if (!cb.checked) e.stage = e.stage.filter((x) => x !== v);
      });
      stageBox.append(h("label", { class: "check-field" }, cb, h("span", {}, l)));
    });

    const del = h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;" }, "删除");
    del.addEventListener("click", () => { this.data.splice(i, 1); this.render(); });

    // 头部：头像 + 姓名/性别/年龄/学历 + 岗位/稀有度 + 月薪/删除
    return h("div", { class: "eng-card" },
      h("div", { class: "eng-card-head" }, avatarPrev,
        h("div", { class: "eng-card-idc" }, nameIn,
          h("div", { class: "eng-card-meta" }, genderSel, ageIn, eduSel),
          /* ID 化（2026-09-14）：把条目的**编号**摆出来 —— 内容随便改，编号永不变，
             引用（V1_STARTERS / 存档主键）认的都是它。 */
          h("div", { class: "eng-card-ids", style: "font-size:11px;color:#8899aa;margin-top:2px;" },
            "编号 " + (e.no != null ? e.no : "—") + " · key " + (e.key || "—"))),
        h("label", { class: "eng-sel-field" }, "岗位", typeSel),
        h("label", { class: "eng-sel-field" }, "稀有度", rarSel),
        h("label", { class: "eng-sel-field" }, "头像", avatarSel),
        del),
      h("div", { class: "eng-salary-row" },
        h("span", { class: "dim" }, "月薪"), salaryIn, halfYear, addTrait),
      this.deriveRow(e, i),
      h("div", { class: "gcf-subhead" }, "词条（工作经验 · 确定加成）"), traitsBox,
      h("div", { class: "gcf-subhead" }, "潜力属性（影响成长与词条升级）"), statsBox,
      h("div", { class: "gcf-subhead" }, "简历"), univIn, expTa,
      h("div", { class: "gcf-subhead" }, "可刷出阶段"), stageBox);
  },

  /* 派生信息行（2026-09-06，doc/22；2026-09-12 改口径）：核心天赋 / 天赋档-lv / 建议薪资 实时回显，
     **词条等级超过该天赋档天花板**时红字警告，另附「是否进候选池」开关。 */
  deriveRow(e, i) {
    const t = Math.round(this.coreTalent(e));
    const key = e.rarity || this.autoTier(e);
    const lv = this.engLv(e);
    const cap = this.lvCapOf(key);
    const sal = this.salaryOf(e);
    const nm = this.tierName(key);
    const row = h("div", { class: "gcf-preview" });
    row.append(h("span", {}, "核心天赋 " + t));
    row.append(h("span", {}, "标识 " + nm + "-lv" + lv + (e.rarity ? "（手填档位）" : "（自动）")));
    row.append(h("span", {}, "建议月薪 " + this.fmtMoney(sal)));
    if (lv > cap) {
      row.append(h("span", { style: "color:#ff6b6b;" },
        "⚠ " + nm + " 的词条等级上限是 lv" + cap + "，当前 lv" + lv + "（超出不会被收录进池子）"));
    }
    if (lv >= 5) {
      row.append(h("span", { class: "dim" }, "lv5 为最高级，天赋不再影响成长"));
    }
    const poolCb = h("input", { type: "checkbox" });
    poolCb.checked = e.pool !== false;
    poolCb.addEventListener("change", () => {
      if (poolCb.checked) delete e.pool; else e.pool = false;
      this.render();
    });
    row.append(h("label", { class: "check-field", style: "margin-left:auto;" }, poolCb, h("span", {}, "进候选池")));
    return row;
  },

  /* 保存（silent=由右上角「保存全部」统一调用；失败抛错由 App 汇总） */
  /* ID 化兜底（2026-09-14）：老标签页 / 手改过的配置里可能还是 `id` 形态 → 一律规整成
     `no`（优先按 LEGACY 表从旧 id 折回，**编号不漂**）+ `key`（沿用旧 id）；删掉退役的 `id`。
     这样即使编辑器标签页是 ID 化之前打开的，保存也不会把整个池子写回旧形态。
     单独成方法（不塞在 save 里）是为了能在无浏览器回归里同步调用断言。 */
  normalizeIds() {
    const LEG = (this.cfg && this.cfg.ENGINEERS_LEGACY_NO) || {};
    let maxNo = this.data.reduce((m, e) => Math.max(m, e.no || 0), 2000);
    this.data.forEach((e) => {
      if (!e.key && e.id) e.key = e.id;
      if (e.no == null && e.key && LEG[e.key] != null) e.no = LEG[e.key];
      if (e.no == null) e.no = ++maxNo;
      if (!e.key) {
        let k = "eng_" + e.no, g = 0;
        while (this.data.some((x) => x !== e && x.key === k)) k = "eng_" + e.no + "_" + (++g);
        e.key = k;
      }
      if (e.id !== undefined) delete e.id;
    });
    return this.data;
  },

  /* 保存（silent=由右上角「保存全部」统一调用；失败抛错由 App 汇总） */
  async save({ silent = false } = {}) {
    this.normalizeIds();
    this.data.forEach(e=>this.normalizeTalent(e));
    // avatarIdx → avatar 全路径（游戏端直接用）
    const list = this.data.map((e) => ({
      ...e,
      /* [feature:v2d-avatar-editor-save] */
      avatarIdx: this.modernAvatarIndex(e),
      avatar: "resource/ui/avatar_" + this.modernAvatarIndex(e) + ".webp",
      /* [/feature:v2d-avatar-editor-save] */
      stage: e.stage && e.stage.length ? e.stage : ["V1"],
    }));
    try {
      const r = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "ENGINEERS", config: list,
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      if (window.CfgSync) CfgSync.update(d.mtime);
      if (!silent) UI.toast("工程师配置已保存并同步到游戏");
    } catch (e) {
      if (silent) throw e;
      UI.toast("保存失败：" + e.message, "err");
    }
  },

  /* 金额格式化：万为单位 */
  fmtMoney(n) {
    if (n == null) return "0";
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(n % 10000 ? 1 : 0) + " 万";
    return String(n);
  },
};
