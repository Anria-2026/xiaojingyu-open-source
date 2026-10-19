/* ==========================================================================
   新闻与提示配置页（2026-09-03 新增；2026-09-13 扩新闻配图 + 随机池 + 自家上线新闻）
   --------------------------------------------------------------------------
   四块内容，各自整区保存：
   - 节点提示 OFFICE_HINTS：type = payday(发薪前 ticksBefore tick) / week(第 week 周) /
     stage_enter(进入某阶段) / corpus_shortage / fund_low / axis_milestone / hire_done。
   - 时事新闻 NEWS_TIMELINE：date = 真实日期（yyyy-mm-dd），游戏第 N 周 =
     TRAIN_TIMELINE.startDate + (N-1)×7 天，落在该周的新闻周结算时优先弹出。
   - 🎲 随机氛围 NEWS（2026-09-13 新增编辑入口）：信息流里补充气氛的日常新闻池，
     按 NEWS_PAGE.NEW_EVERY_MIN 随机进流；以前只能在工厂代码里改，现在可编辑 + 配图。
   - 📣 自家模型上线 NEWS_SELF_RELEASE（2026-09-13 新增）：自研架构（mla/dsa/csa）训出来的
     模型上线时自动推的「某初创公司发布了…」吃瓜新闻，按架构一条。
   ⚠️ 新闻配图 img = resource/ 下的图片路径（留空 = 不显示图片）；建议放 resource/news/。
   ========================================================================== */
"use strict";

window.NoticeTool = {
  hints: null,      // OFFICE_HINTS 工作副本
  news: null,       // NEWS_TIMELINE 工作副本
  rnews: null,      // NEWS（随机氛围池）工作副本
  selfNews: null,   // NEWS_SELF_RELEASE 工作副本 { enabled, byArch: {...} }

  HINT_TYPES: [
    ["stage_enter", "stage_enter · 进入阶段时（推荐：版本节点提示）"],
    ["week", "week · 指定周提示"],
    ["review_ready", "review_ready · 本阶段可评审时"],
    ["payday", "payday · 发薪前提醒"],
    ["corpus_shortage", "corpus_shortage · 语料不足"],
    ["fund_low", "fund_low · 经费预警"],
    ["axis_milestone", "axis_milestone · 能力轴里程碑"],
    ["hire_done", "hire_done · 找到候选人（变量 {name} {role} {tier}）"],
  ],

  /* 阶段表（配「限定阶段」/stage_enter 用） */
  VER_ORDER: (window.GameDefaults && window.GameDefaults.base && window.GameDefaults.base.VER_ORDER)
    || ["V1", "V1.5", "V2", "V2.5", "V3", "V3.5", "V4", "V4.5"],

  /* 触发频率（2026-09-08 用户要求）：game 整局一次 / stage 每阶段一次 / always 每次都弹 */
  FREQ_TYPES: [
    ["game", "一次性（整局只弹一次）"],
    ["stage", "每阶段一次"],
    ["always", "每次满足都弹"],
  ],

  async refresh() {
    let saved = {};
    try {
      const r = await (await fetch("/api/game-cfg")).json();
      if (window.CfgSync) CfgSync.note(r);
      saved = r.config || {};
    } catch (e) { /* 离线回落默认 */ }
    /* 默认模板在 GameDefaults.base 下（兼容旧的顶层结构） */
    const G = window.GameDefaults || {};
    const def = G.base || G;
    this.hints = Array.isArray(saved.OFFICE_HINTS) && saved.OFFICE_HINTS.length
      ? this.clone(saved.OFFICE_HINTS) : this.clone(def.OFFICE_HINTS || []);
    this.news = Array.isArray(saved.NEWS_TIMELINE) && saved.NEWS_TIMELINE.length
      ? this.clone(saved.NEWS_TIMELINE) : this.clone(def.NEWS_TIMELINE || []);
    /* 2026-09-13：随机氛围池（以前没有编辑入口，只能在工厂代码里改）与自家上线新闻 */
    this.rnews = Array.isArray(saved.NEWS) && saved.NEWS.length
      ? this.clone(saved.NEWS) : this.clone(def.NEWS || []);
    const sr = saved.NEWS_SELF_RELEASE || def.NEWS_SELF_RELEASE || { enabled: true, byArch: {} };
    this.selfNews = this.clone(sr);
    if (!this.selfNews.byArch) this.selfNews.byArch = {};
    /* 自研架构必须都能配（mla/dsa/csa）：缺的用出厂默认补齐，避免"配置里看不到这条" */
    const srDef = (def.NEWS_SELF_RELEASE || {}).byArch || {};
    for (const k of Object.keys(srDef)) {
      if (!this.selfNews.byArch[k]) this.selfNews.byArch[k] = this.clone(srDef[k]);
    }
    this.render();
  },

  clone(o) {
    return o === null || typeof o !== "object" ? o : (Array.isArray(o) ? o.map((x) => this.clone(x)) :
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, this.clone(v)])));
  },

  init() {
    $("#hint-add").addEventListener("click", () => {
      this.hints.push({ id: "H_NEW" + (this.hints.length + 1), type: "week", week: 2,
        freq: "game", text: "新的节点提示文案" });
      this.render();
    });
    $("#news-add").addEventListener("click", () => {
      this.news.push({ id: "TL_NEW" + (this.news.length + 1), date: "2023-07-01",
        src: "时事快讯", title: "新的新闻标题", desc: "新闻正文……" });
      this.render();
    });
    /* 随机氛围新闻池（2026-09-13 新增编辑入口） */
    const radd = $("#rnews-add");
    if (radd) radd.addEventListener("click", () => {
      this.rnews.push({ id: "N_NEW" + (this.rnews.length + 1), cat: "行业八卦",
        src: "圈内传闻", title: "新的随机新闻标题", desc: "新闻正文……" });
      this.render();
    });
    this.refresh();
  },

  render() {
    const hintWrap = $("#hint-list");
    const newsWrap = $("#news-list");
    if (!hintWrap || !newsWrap) return;
    UI.clear(hintWrap);
    UI.clear(newsWrap);
    if (!this.hints.length) hintWrap.append(h("div", { class: "dim" }, "暂无节点提示，点「+ 新增提示」添加。"));
    this.hints.forEach((ht, i) => hintWrap.append(this.hintCard(ht, i)));
    if (!this.news.length) newsWrap.append(h("div", { class: "dim" }, "暂无时事新闻，点「+ 新增新闻」添加。"));
    this.news.forEach((n, i) => newsWrap.append(this.newsCard(n, i)));
    const hc = $("#hint-count"), nc = $("#news-count");
    if (hc) hc.textContent = this.hints.length + " 条";
    if (nc) nc.textContent = this.news.length + " 条";
    /* 🎲 随机氛围新闻池（可编辑 + 配图） */
    const rWrap = $("#rnews-list");
    if (rWrap) {
      UI.clear(rWrap);
      if (!this.rnews.length) rWrap.append(h("div", { class: "dim" }, "暂无随机新闻。"));
      this.rnews.forEach((n, i) => rWrap.append(this.newsCard(n, i, "rnews")));
      const rc = $("#rnews-count");
      if (rc) rc.textContent = this.rnews.length + " 条";
    }
    /* 📣 自家模型上线新闻（按架构） */
    const sWrap = $("#selfnews-list");
    if (sWrap) {
      UI.clear(sWrap);
      const on = h("select", {}, ...[["1", "开启"], ["0", "关闭"]]
        .map(([v, l]) => h("option", { value: v }, l)));
      on.value = this.selfNews.enabled === false ? "0" : "1";
      on.addEventListener("change", () => { this.selfNews.enabled = on.value === "1"; });
      sWrap.append(h("div", { class: "gcf-inline", style: "margin-bottom:8px;display:flex;gap:6px;align-items:center;" },
        h("span", { class: "dim", style: "font-size:12px;" }, "总开关"), on));
      for (const id of Object.keys(this.selfNews.byArch || {})) {
        sWrap.append(this.selfNewsCard(id));
      }
    }
  },

  txtInput(val, onchg, placeholder, cls) {
    const inp = h("input", { class: cls || "gcf-title", value: val == null ? "" : String(val), placeholder: placeholder || "" });
    inp.addEventListener("input", () => onchg(inp.value));
    return inp;
  },

  numInput(val, onchg, width) {
    const inp = h("input", { type: "number", value: val == null ? "" : String(val), style: "width:" + (width || "70px") + ";" });
    inp.addEventListener("change", () => { const v = parseFloat(inp.value); if (!isNaN(v)) onchg(v); });
    return inp;
  },

  hintCard(ht, i) {
    const typeSel = h("select", {}, ...this.HINT_TYPES.map(([v, l]) => h("option", { value: v }, l)));
    typeSel.value = ht.type || "week";
    typeSel.addEventListener("change", () => { ht.type = typeSel.value; this.render(); });

    const trig = h("div", { class: "gcf-trigger" });
    if (ht.type === "stage_enter") {
      /* 2026-09-12 新增：进入某阶段时弹一次（默认该阶段第 1 周）。
         「阶段」必填 —— 没配阶段它永远不会触发（这里不给「不限」选项，防止配了个哑提示）。 */
      const vs = h("select", {}, ...this.VER_ORDER.map((v) => h("option", { value: v }, v)));
      vs.value = ht.ver || "V3";
      vs.addEventListener("change", () => { ht.ver = vs.value; });
      trig.append(h("label", { class: "gcf-inline" }, "进入阶段", vs),
        h("label", { class: "gcf-inline" }, "第几周",
          this.numInput(ht.week != null ? ht.week : 1, (v) => { ht.week = v; })));
    } else if (ht.type === "axis_milestone") {
      /* 2026-09-12 补：轴里程碑以前在编辑器里没法表示（下拉里根本没这个类型），
         一碰类型选择框就会被改写成 week —— 等于把配置改坏。现在补齐。 */
      const axs = h("select", {},
        ...[["memory", "记忆"], ["reasoning", "推理"], ["tool", "工具"]]
          .map(([v, l]) => h("option", { value: v }, l)));
      axs.value = ht.axis || "memory";
      axs.addEventListener("change", () => { ht.axis = axs.value; });
      trig.append(h("label", { class: "gcf-inline" }, "哪根轴", axs),
        h("label", { class: "gcf-inline" }, "门槛比例",
          this.numInput(ht.pct != null ? ht.pct : 0.5, (v) => { ht.pct = v; })));
    } else if (ht.type === "payday") {
      trig.append(h("label", { class: "gcf-inline" }, "提前 tick 数",
        this.numInput(ht.ticksBefore != null ? ht.ticksBefore : 6, (v) => { ht.ticksBefore = v; })));
    } else if (ht.type === "week") {
      trig.append(h("label", { class: "gcf-inline" }, "第几周",
        this.numInput(ht.week != null ? ht.week : 2, (v) => { ht.week = v; })));
    } else if (ht.type === "review_ready") {
      trig.append(h("span", { class: "dim" }, "触发：达到本阶段实际最短评审周数且已立项（周结算检查）"));
    } else {
      trig.append(h("span", { class: "dim" }, ht.type === "corpus_shortage"
        ? "触发：语料库存 < 本周需求（周结算检查）"
        : ht.type === "hire_done"
          ? "触发：寻访找到候选人时（每次都弹，支持变量 {name} {role} {tier}）"
          : "触发：经费 < 本月工资单（周结算检查）"));
    }
    /* 限定阶段（可选，除 stage_enter 外都适用）：配了就只有该阶段会弹。
       以前没有这个字段 → 「V3 才该说的话」只能配成 week，结果每个阶段第 N 周都弹（靠 freq 去重）。 */
    if (ht.type !== "stage_enter") {
      const vs2 = h("select", {}, ...[["", "（不限阶段）"]].concat(this.VER_ORDER.map((v) => [v, v]))
        .map(([v, l]) => h("option", { value: v }, l)));
      vs2.value = ht.ver || "";
      vs2.addEventListener("change", () => { if (vs2.value) ht.ver = vs2.value; else delete ht.ver; });
      trig.append(h("label", { class: "gcf-inline", style: "margin-left:12px;" }, "限定阶段", vs2));
    }
    const onceCb = h("select", { style: "margin-left:12px;" },
      ...this.FREQ_TYPES.map(([v, l]) => h("option", { value: v }, l)));
    onceCb.value = ht.freq || (ht.once === false ? "always" : "game");
    onceCb.addEventListener("change", () => { ht.freq = onceCb.value; delete ht.once; });
    trig.append(h("label", { class: "gcf-inline", style: "margin-left:14px;" }, "触发频率", onceCb));

    const idIn = this.txtInput(ht.id, (v) => { ht.id = v; }, "提示 id", "gcf-id");
    const textTa = h("textarea", { class: "gcf-desc", rows: "2", placeholder: "弹出文案" }, ht.text || "");
    textTa.addEventListener("input", () => { ht.text = textTa.value; });
    /* 2026-09-05：立绘（可选）。配了路径，游戏顶部提示卡左侧会显示这张立绘；不配维持原样。 */
    const avIn = this.txtInput(ht.avatar || "", (v) => { ht.avatar = v.trim() || null; },
      "resource/character/叉腰.webp", "gcf-title");
    avIn.placeholder = "立绘路径（可选，留空 = 不显示）";
    avIn.style.width = "100%";
    const avBtn = h("button", { class: "btn btn-sm btn-ghost", style: "flex:0 0 auto;" }, "浏览");
    avBtn.addEventListener("click", () => {
      if (!window.ResPicker) return;
      window.ResPicker.pick(avIn.value.trim(), { title: "选择节点提示立绘" }).then((p) => {
        if (!p) return;
        avIn.value = p;
        ht.avatar = p;
      });
    });
    const avRow = h("div", { class: "gcf-inline", style: "display:flex;gap:6px;align-items:center;width:100%;" },
      h("span", { class: "dim", style: "flex:0 0 auto;font-size:12px;" }, "立绘"), avIn, avBtn);
    const del = h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;" }, "删除");
    del.addEventListener("click", () => { this.hints.splice(i, 1); this.render(); });

    return h("div", { class: "gcf-event" },
      h("div", { class: "gcf-event-head ev-head" }, idIn, typeSel, del),
      trig, textTa, avRow);
  },

  /* 新闻卡（时事新闻 / 随机氛围池共用）：id +（日期或分类）+ 来源 + 标题 + 正文 + 配图 */
  newsCard(n, i, which) {
    const list = which === "rnews" ? this.rnews : this.news;
    const idIn = this.txtInput(n.id, (v) => { n.id = v; }, "新闻 id", "gcf-id");
    const head = h("div", { class: "gcf-event-head ev-head" }, idIn);
    if (which === "rnews") {
      /* 随机池没有日期，只有分类（用于 UI 分池/风格，可留空） */
      const catIn = this.txtInput(n.cat, (v) => { n.cat = v; }, "分类（可空）", "gcf-title");
      catIn.style.maxWidth = "130px";
      head.append(catIn);
    } else {
      const dateIn = this.txtInput(n.date, (v) => { n.date = v; }, "yyyy-mm-dd", "gcf-title");
      dateIn.style.maxWidth = "110px";
      dateIn.title = "真实日期：游戏第 N 周 = startDate + (N-1)×7 天";
      head.append(dateIn);
    }
    const srcIn = this.txtInput(n.src, (v) => { n.src = v; }, "来源（如 AI 前线周报）", "gcf-title");
    const titleIn = this.txtInput(n.title, (v) => { n.title = v; }, "新闻标题", "gcf-title");
    const del = h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;" }, "删除");
    del.addEventListener("click", () => { list.splice(i, 1); this.render(); });
    head.append(srcIn, titleIn, del);
    const descTa = h("textarea", { class: "gcf-desc", rows: "2", placeholder: "新闻正文（可用 {name} 指代团队成员）" }, n.desc || "");
    descTa.addEventListener("input", () => { n.desc = descTa.value; });
    return h("div", { class: "gcf-event" }, head, descTa, this.imgRow(n));
  },

  /* 配图行（2026-09-13 用户要求）：路径输入 + 浏览（ResPicker）+ 缩略图预览。
     路径留空 = 这条新闻不带图（游戏里不会出现白框）。
     建议把图放 resource/news/ 下（ResPicker 会自动列出这个目录）。 */
  imgRow(n) {
    const inp = this.txtInput(n.img || "", (v) => { n.img = v.trim() || null; },
      "resource/news/xxx.webp", "gcf-title");
    inp.placeholder = "配图路径（可选，留空 = 不显示图）";
    inp.style.width = "100%";
    const thumb = h("img", { alt: "预览",
      style: "width:72px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex:0 0 auto;" });
    const sync = () => {
      const p = (inp.value || "").trim();
      /* 只在有路径时才写 src（空 src 属性会让浏览器去请求当前页地址）；
         清空时改回「隐藏」而不是删属性 —— 少一次 DOM 操作，也避免残留请求。 */
      if (p) { thumb.setAttribute("src", "/" + p); thumb.style.display = ""; }
      else { thumb.style.display = "none"; }
    };
    inp.addEventListener("input", sync);
    const btn = h("button", { class: "btn btn-sm btn-ghost", style: "flex:0 0 auto;" }, "浏览");
    btn.addEventListener("click", () => {
      if (!window.ResPicker) return;
      window.ResPicker.pick(inp.value.trim(), { title: "选择新闻配图" }).then((p) => {
        if (!p) return;
        n.img = p; inp.value = p; sync();
      });
    });
    const altIn = this.txtInput(n.imgAlt || "", (v) => { n.imgAlt = v.trim() || ""; },
      "图片说明（可选）", "gcf-title");
    altIn.style.width = "100%";
    sync();
    return h("div", {},
      h("div", { class: "gcf-inline", style: "display:flex;gap:6px;align-items:center;width:100%;" },
        h("span", { class: "dim", style: "flex:0 0 auto;font-size:12px;" }, "配图"), inp, btn, thumb),
      h("div", { class: "gcf-inline", style: "display:flex;gap:6px;align-items:center;width:100%;margin-top:4px;" },
        h("span", { class: "dim", style: "flex:0 0 auto;font-size:12px;" }, "图说"), altIn));
  },

  /* 自家模型上线新闻（按架构一条）：模型上线时自动推的那条吃瓜新闻。
     占位符（与聊天/UI 文案**同一把尺子**，都是 core.fillVars）：
     {model} 模型名 · {param} 参数档（纯数字，如 70）· {arch}/{archName} 架构显示名 · {archId} 架构代号。 */
  selfNewsCard(archId) {
    const it = this.selfNews.byArch[archId];
    const tag = h("span", { class: "gcf-id" }, archId);
    const tip = h("span", { class: "dim", style: "font-size:12px;" },
      "占位符：{model} 模型名 · {param} 参数档(数字) · {arch} 架构名 · {archId} 架构代号");
    const srcIn = this.txtInput(it.src, (v) => { it.src = v; }, "来源", "gcf-title");
    const titleIn = this.txtInput(it.title, (v) => { it.title = v; }, "标题模板", "gcf-title");
    const descTa = h("textarea", { class: "gcf-desc", rows: "3", placeholder: "正文模板" }, it.desc || "");
    descTa.addEventListener("input", () => { it.desc = descTa.value; });
    return h("div", { class: "gcf-event" },
      h("div", { class: "gcf-event-head ev-head" }, tag, tip),
      h("div", { class: "gcf-inline", style: "display:flex;gap:6px;width:100%;" }, srcIn, titleIn),
      descTa, this.imgRow(it));
  },

  async save({ silent = false } = {}) {
    const post = async (section, config) => {
      const r = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, config,
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error((d.error || "未知错误") + "（" + section + "）");
      if (window.CfgSync) CfgSync.update(d.mtime);
    };
    try {
      await post("OFFICE_HINTS", this.hints);
      await post("NEWS_TIMELINE", this.news);
      /* 2026-09-13：随机氛围池 + 自家上线新闻也由本页整区保存（都带配图字段） */
      await post("NEWS", this.rnews);
      await post("NEWS_SELF_RELEASE", this.selfNews);
      if (!silent) UI.toast("新闻与提示配置已保存并同步到游戏");
    } catch (e) {
      if (silent) throw e;
      UI.toast("保存失败：" + e.message, "err");
    }
  },
};
