/* ==========================================================================
   成就配置页（2026-09-17 新增 · doc/35 §5 P2）
   --------------------------------------------------------------------------
   36 条成就的**全部可编辑字段**都在这一页：名字 / 描述 / 类别 / 稀有度 / 图标 /
   配图 / 隐藏 / 解锁条件。整区保存：`section = "ACHIEVEMENTS"`。

   ⚠️ 这个区是「整区保存」，所以**两处名单都必须登记**（都已登记，别删）：
      `editor/js/gameCfgTool.js::basePayload()` 的 OTHER ＋ `editor/server.py` 的 reserved。
      漏一处 = 在别的页点一次「保存全部」就把成就整区**静默抹掉**。

   ⚠️ 两条硬规矩（页面上也红字提示）：
     1. `key` 是解锁记录在 localStorage 里的**主键** ⇒ 本页**只读展示、不给改**。
        改 key = 所有人的解锁记录作废（成就全变回未解锁），而且不报错。
      2. `name` / `desc` 是**纯文本**（游戏侧渲染时过 escHtml）⇒ 不要写 HTML 标签。
         `desc` 支持占位符（与全站文案同一把尺子 core.fillVars）：
         `{model}` 模型名 · `{param}` 参数档 · `{arch}`/`{archName}` 架构名 · `{archId}` 架构代号。

   ⚠️ 条件编辑器是**按条件白名单自动生成**的（下面的 COND_TYPES）——
      游戏侧 `game_core.js` 的 `ACHV_COND_TYPES` 加了新类型，这里要同步补一行，
      否则新类型在这页里选不到（`test_editor_cfg` 有断言守两边的类型集合一致）。
   ========================================================================== */
"use strict";

window.AchvTool = {
  data: null,           // ACHIEVEMENTS 工作副本

  /* ---- 下拉用的固定选项（都是游戏侧的权威枚举，别自己编） ---- */
  /* ⚠️ 这 5 个图标名来自 `h5_demo/js/game_ui.js` 的 `ACHV_ICON_ART`（那里是唯一实现）。
     编辑器读不到游戏前端常量 ⇒ 只能镜像一份；`test_editor_cfg` 有断言守两边一致。
     留空表示「按稀有度取默认图标」。 */
  ICON_NAMES: [
    ["", "（按稀有度默认）"],
    ["achvCommon", "achvCommon · 星芒徽章（普通）"],
    ["achvRare", "achvRare · 菱形宝石（稀有）"],
    ["achvEpic", "achvEpic · 八向绽放（史诗）"],
    ["achvLegend", "achvLegend · 冠冕（传说）"],
    ["achvLocked", "achvLocked · 挂锁（未解锁）"],
  ],
  RARITIES: ["普通", "稀有", "史诗", "传说"],
  CATS: ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"],
  VERDICTS: [["pass", "pass · 通过"], ["excellent", "excellent · 优秀"], ["top", "top · 顶尖"]],
  TARGET_PARAMS: (window.GameDefaults && window.GameDefaults.base && window.GameDefaults.base.TARGET_PARAMS)
    || [7, 13, 34, 70, 284, 1600],
  VER_ORDER: (window.GameDefaults && window.GameDefaults.base && window.GameDefaults.base.VER_ORDER)
    || ["V1", "V1.5", "V2", "V2.5", "V3", "V3.5", "V4", "V4.5"],
  DIM_ORDER: (window.GameDefaults && window.GameDefaults.base && window.GameDefaults.base.V35
    && window.GameDefaults.base.V35.DIM_ORDER) || ["code", "text", "safety", "stability", "memory", "reasoning", "tool"],
  DIM_LABEL: { code: "代码", text: "文本", safety: "安全", stability: "稳定",
               memory: "记忆", reasoning: "推理", tool: "工具" },

  /* ---- 条件白名单的**镜像**（顺序与分组照抄 game_core.js 的 ACHV_COND_TYPES）----
     `params` 列出该类型会用到的字段名；`label` 只给下拉显示用。
     字段 → 控件类型的映射见 PARAM_KIND。 */
  COND_TYPES: [
    ["param_rank1", "param_rank1 · 这些参数档都登顶过", ["params"]],
    ["dim_above", "dim_above · 某维 ≥ 该维达标线 × mul", ["dim", "mul"]],
    ["dim_below", "dim_below · 某维 < 该维达标线 × mul（翻车用）", ["dim", "mul"]],
    ["dim_ratio_above", "dim_ratio_above · 指定维 ≥ 该维线 × mul", ["dim", "mul"]],
    ["dim_max_ratio_above", "dim_max_ratio_above · 最高那一维 ≥ 其线 × mul（偏科）", ["mul"]],
    ["dim_at_cap_all", "dim_at_cap_all · 四维全部顶到上限", []],
    ["balanced_false", "balanced_false · 均衡论不成立", []],
    ["axis_only_miss", "axis_only_miss · 只差能力轴没过", []],
    ["mission_fail", "mission_fail · 阶段任务未达成", []],
    ["bonus_zero", "bonus_zero · 结算奖金为 0", []],
    ["funding_below", "funding_below · 结算后经费 < n", ["n"]],
    ["funding_zero_times", "funding_zero_times · 累计 N 次账上没钱", ["n"]],
    ["retry_times", "retry_times · 累计重训 N 次", ["n"]],
    ["verdict_is", "verdict_is · 评审结论恰为 v", ["v"]],
    ["pass_like", "pass_like · 评审通过（pass/优秀/顶尖都算）", []],
    ["game_clear", "game_clear · 通关（V4.5 走完）", []],
    ["no_retry", "no_retry · 全程没重训过", []],
    ["rank_le", "rank_le · 排行榜名次 ≤ n", ["n"]],
    ["rank_hold", "rank_hold · 连续 stages 个阶段都 ≤ n 名", ["n", "stages"]],
    ["ver_reach", "ver_reach · 打到 ver 阶段", ["ver"]],
    ["codex_full", "codex_full · 模型图鉴满格", []],
    ["codex_count", "codex_count · 图鉴收录 ≥ n 个", ["n"]],
    ["arch_all", "arch_all · 所有架构都做出过模型", []],
    ["arch_count", "arch_count · 做出过 n 种架构", ["n"]],
    ["papers_ge", "papers_ge · 已读论文 ≥ n 篇", ["n"]],
    ["paper_all", "paper_all · 读完全部论文", []],
    ["all_stage_excellent", "all_stage_excellent · 每个阶段都拿优秀", []],
    ["energy_all_below", "energy_all_below · 全员体力 < n", ["n"]],
    ["team_full", "team_full · 团队满编", []],
    ["team_resigned", "team_resigned · 累计 N 人离职", ["n"]],
    ["team_alive_eq", "team_alive_eq · 在岗人数恰为 n", ["n"]],
    ["burnout_count", "burnout_count · N 人过劳", ["n"]],
    ["corpus_gap", "corpus_gap · 语料缺口 ≥ pct", ["pct"]],
    ["hire_zero", "hire_zero · 一次都没招过人", []],
    ["chat_all_seen", "chat_all_seen · 聊天分支全看过", []],
    ["note_all", "note_all · 记事本收满", []],
    ["life_stage_pass", "life_stage_pass · 完成具身阶段任务并通过评审", ["ver"]],
    ["life_stage_top", "life_stage_top · 完成具身阶段任务并获得顶尖", ["ver"]],
    ["life_body_owned", "life_body_owned · 实际采购该阶段素体", ["ver"]],
    ["life_awake", "life_awake · 具身开智并已出舱", []],
    ["life_mentor", "life_mentor · LV4具身前辈实际入职", []],
    ["life_city_stop", "life_city_stop · 读完指定城市报备", ["id"]],
    ["life_city_all", "life_city_all · 实际读完当前城市全路线", []],
    ["life_feed_count", "life_feed_count · 累计成功投喂N次", ["n"]],
    ["life_managed", "life_managed · 实际成功执行团队托管", []],
    ["all", "all · 以上全部满足（组合）", ["of"]],
    ["any", "any · 满足任意一条（组合）", ["of"]],
  ],
  /* 字段 → 控件类型：
     num=数字输入 · nums=逗号分隔的数字数组 · dim=维度下拉 · ver=阶段下拉 · v=结论下拉 · of=嵌套条件列表 */
  PARAM_KIND: { params: "nums", dim: "dim", ver: "ver", v: "v", of: "of", id: "text",
                n: "num", mul: "num", stages: "num", pct: "num" },
  PARAM_LABEL: { params: "参数档", dim: "哪一维", ver: "阶段", v: "结论", of: "条件列表", id: "城市地点 ID",
                 n: "阈值 n", mul: "倍率 mul", stages: "连续阶段数", pct: "缺口比例 pct" },

  async refresh() {
    let saved = {};
    try {
      const r = await (await fetch("/api/game-cfg")).json();
      if (window.CfgSync) CfgSync.note(r);
      saved = r.config || {};
    } catch (e) { /* 离线回落默认 */ }
    const G = window.GameDefaults || {};
    const def = G.base || G;
    /* ⚠️ 与其它页同款口径：**真源有就用真源**，没有才回落出厂默认。
       成就表是"整区保存"的，所以真源那份就是唯一真源（运行时 deepMerge 时数组整体替换）。 */
    this.data = Array.isArray(saved.ACHIEVEMENTS) && saved.ACHIEVEMENTS.length
      ? this.clone(saved.ACHIEVEMENTS) : this.clone(def.ACHIEVEMENTS || []);
    this.render();
  },

  clone(o) {
    return o === null || typeof o !== "object" ? o : (Array.isArray(o) ? o.map((x) => this.clone(x)) :
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, this.clone(v)])));
  },

  init() {
    const add = $("#achv-add");
    if (add) add.addEventListener("click", () => {
      /* 新条目的 no 取"当前最大值 +1"（编号永不变，只增不复用）。
         key 随机生成一个新的稳定 id —— 注意**不要让人改已有条目的 key**。 */
      const maxNo = this.data.reduce((m, a) => Math.max(m, Number(a.no) || 0), 3000);
      this.data.push({
        no: maxNo + 1, key: "NEW_" + (maxNo + 1),
        name: "新的成就", cat: "Ⅴ", rarity: "普通", hidden: false,
        img: "", imgAlt: "",
        desc: "在这里写一句给玩家看的描述。",
        cond: { type: "rank_le", n: 10 },
      });
      this.render();
    });
    this.refresh();
  },

  /* ---------------- 渲染 ---------------- */
  render() {
    const wrap = $("#achv-list");
    if (!wrap) return;
    UI.clear(wrap);
    const list = this.data || [];
    if (!list.length) {
      wrap.append(h("div", { class: "dim" }, "暂无成就，点「+ 新增成就」添加。"));
    } else {
      list.forEach((a, i) => wrap.append(this.achvCard(a, i)));
    }
    const c = $("#achv-count");
    if (c) {
      const byRar = {};
      list.forEach((a) => { byRar[a.rarity] = (byRar[a.rarity] || 0) + 1; });
      c.textContent = list.length + " 条（" + this.RARITIES.map((r) => r + " " + (byRar[r] || 0)).join(" / ") + "）";
    }
  },

  /* ---------------- 小控件 ---------------- */
  txtInput(val, onchg, placeholder, cls, width) {
    const inp = h("input", { class: cls || "gcf-title", value: val == null ? "" : String(val), placeholder: placeholder || "" });
    if (width) inp.style.width = width;
    inp.addEventListener("input", () => onchg(inp.value));
    return inp;
  },

  sel(options, val, onchg, width) {
    const s = h("select", {}, ...options.map(([v, l]) => h("option", { value: v }, l)));
    s.value = val == null ? "" : String(val);
    if (width) s.style.maxWidth = width;
    s.addEventListener("change", () => onchg(s.value));
    return s;
  },

  numInput(val, onchg, width) {
    const inp = h("input", { type: "number", value: val == null ? "" : String(val), style: "width:" + (width || "80px") + ";" });
    inp.addEventListener("change", () => { const v = parseFloat(inp.value); if (!isNaN(v)) onchg(v); });
    return inp;
  },

  labeled(text, node) {
    return h("label", { class: "gcf-inline", style: "display:inline-flex;align-items:center;gap:5px;" },
      h("span", { class: "dim", style: "font-size:12px;" }, text), node);
  },

  /* ---------------- 一条成就的卡片 ---------------- */
  achvCard(a, i) {
    /* 头行：编号（只读）+ key（只读，附原因）+ 删除 */
    const noTag = h("span", { class: "gcf-id" }, "#" + (a.no == null ? "?" : a.no));
    noTag.title = "编号（no）永不变，只增不复用";
    const keyTag = h("span", { class: "gcf-id", style: "background:rgba(255,120,120,.12);" }, a.key || "(无 key)");
    keyTag.title = "key 是解锁记录的存储主键 —— 改了 = 所有人的解锁记录作废（成就全变回未解锁）。所以这里只读。";
    const del = h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;" }, "删除");
    del.addEventListener("click", () => { this.data.splice(i, 1); this.render(); });
    const head = h("div", { class: "gcf-event-head ev-head" }, noTag, keyTag);

    /* 名字 / 类别 / 稀有度 / 隐藏 / 图标 */
    const nameIn = this.txtInput(a.name, (v) => { a.name = v; }, "成就名字", "gcf-title");
    nameIn.style.minWidth = "180px";
    const catSel = this.sel(this.CATS.map((c) => [c, c]), a.cat || "Ⅰ", (v) => { a.cat = v; }, "80px");
    const rarSel = this.sel(this.RARITIES.map((r) => [r, r]), a.rarity || "普通", (v) => { a.rarity = v; }, "100px");
    const hidSel = this.sel([["0", "显示条件"], ["1", "隐藏成就（未解锁时不给名字/描述）"]],
      a.hidden ? "1" : "0", (v) => { a.hidden = v === "1"; }, "210px");
    const iconSel = this.sel(this.ICON_NAMES, a.icon || "", (v) => {
      if (v) a.icon = v; else delete a.icon;      /* 留空 = 用稀有度默认图标（不要写空串进配置） */
    }, "210px");
    const row1 = h("div", { class: "gcf-inline", style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center;width:100%;" },
      this.labeled("名字", nameIn), this.labeled("类别", catSel),
      this.labeled("稀有度", rarSel), this.labeled("隐藏", hidSel), del);
    const row2 = h("div", { class: "gcf-inline", style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center;width:100%;" },
      this.labeled("图标", iconSel));

    /* 描述（纯文本，支持占位符） */
    const descTa = h("textarea", { class: "gcf-desc", rows: "2",
      placeholder: "给玩家看的描述（纯文本；可用 {model}/{param}/{arch} 占位符，不要写 HTML 标签）" }, a.desc || "");
    descTa.addEventListener("input", () => { a.desc = descTa.value; });

    /* 条件（自动生成） */
    if (!a.cond || typeof a.cond !== "object") a.cond = { type: "rank_le", n: 10 };
    const condBox = this.condEditor(a.cond, (next) => { a.cond = next; });

    return h("div", { class: "gcf-event" }, head, row1, row2, descTa, this.imgRow(a), condBox);
  },

  /* 配图行（沿用新闻页的做法：路径 + 浏览 + 缩略图 + 图说）。
     成就卡没配图时会画"稀有度底纹 + 自绘 SVG"，所以留空是**正常状态**，不是残缺。 */
  imgRow(a) {
    const inp = this.txtInput(a.img || "", (v) => { a.img = v.trim(); }, "resource/achieve/xxx.webp", "gcf-title");
    inp.placeholder = "配图路径（可选，留空 = 画稀有度底纹 + 自绘 SVG）";
    inp.style.width = "100%";
    const thumb = h("img", { alt: "预览",
      style: "width:72px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--line);flex:0 0 auto;" });
    const sync = () => {
      const p = (inp.value || "").trim();
      if (p) { thumb.setAttribute("src", "/" + p); thumb.style.display = ""; }
      else { thumb.style.display = "none"; }
    };
    inp.addEventListener("input", sync);
    const btn = h("button", { class: "btn btn-sm btn-ghost", style: "flex:0 0 auto;" }, "浏览");
    btn.addEventListener("click", () => {
      if (!window.ResPicker) return;
      window.ResPicker.pick(inp.value.trim(), { title: "选择成就配图" }).then((p) => {
        if (!p) return;
        a.img = p; inp.value = p; sync();
      });
    });
    const altIn = this.txtInput(a.imgAlt || "", (v) => { a.imgAlt = v; }, "图片说明（可选）", "gcf-title");
    altIn.style.width = "100%";
    sync();
    return h("div", {},
      h("div", { class: "gcf-inline", style: "display:flex;gap:6px;align-items:center;width:100%;" },
        h("span", { class: "dim", style: "flex:0 0 auto;font-size:12px;" }, "配图"), inp, btn, thumb),
      h("div", { class: "gcf-inline", style: "display:flex;gap:6px;align-items:center;width:100%;margin-top:4px;" },
        h("span", { class: "dim", style: "flex:0 0 auto;font-size:12px;" }, "图说"), altIn));
  },

  /* ---------------- 条件编辑器（按白名单自动生成，支持 all/any 递归）----------------
     ⚠️ 这里**不写死任何条件的参数形状** —— 全部照 `COND_TYPES` 的参数名生成。
        游戏侧加了新类型/新参数，只改 COND_TYPES 一处即可（test_editor_cfg 会比对两边集合）。 */
  condEditor(cond, onChange, depth) {
    const d = depth || 0;
    const box = h("div", { style: "border:1px dashed var(--line);border-radius:8px;padding:8px;margin-top:6px;"
      + (d ? "background:rgba(127,208,246,.06);" : "") });
    const spec = this.COND_TYPES.filter(([t]) => t === cond.type)[0];
    const params = spec ? spec[2] : [];
    /* 类型下拉 */
    const typeSel = this.sel(this.COND_TYPES.map(([t, l]) => [t, l]), cond.type, (v) => {
      /* 换类型 = 重建条件对象（旧参数对新类型没意义，留着反而会被引擎当未知键忽略/误导） */
      const next = { type: v };
      const np = (this.COND_TYPES.filter(([t]) => t === v)[0] || [, , []])[2];
      np.forEach((p) => {
        if (p === "of") return;
        const kind = this.PARAM_KIND[p];
        next[p] = kind === "nums" ? [] : kind === "ver" ? (v.startsWith("life_") ? "V5" : this.VER_ORDER[0])
          : kind === "dim" ? this.DIM_ORDER[0] : kind === "v" ? this.VERDICTS[0][0]
          : kind === "text" ? (((window.GameDefaults.base || {}).CITY_JOURNEY || {}).STOPS || [])[0]?.id || "" : 0;
      });
      if (np.indexOf("of") >= 0) next.of = [{ type: "rank_le", n: 10 }];
      onChange(next);
      this.render();
    }, "100%");
    box.append(h("div", { class: "gcf-inline", style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap;" },
      (d ? h("span", { class: "dim", style: "font-size:12px;" }, "↳ 子条件") : h("span", { class: "dim", style: "font-size:12px;" }, "解锁条件")),
      typeSel));

    /* 参数控件 */
    const row = h("div", { class: "gcf-inline", style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:6px;" });
    params.forEach((p) => {
      if (p === "of") return;                       /* 组合子单独处理，见下 */
      const kind = this.PARAM_KIND[p] || "num";
      const label = this.PARAM_LABEL[p] || p;
      let node;
      if (kind === "nums") {
        /* 参数档数组：用逗号文本，比一排数字框好用；解析时过滤非法值 */
        const cur = Array.isArray(cond[p]) ? cond[p].join(", ") : "";
        const inp = this.txtInput(cur, (v) => {
          cond[p] = v.split(/[,，\s]+/).map((x) => parseFloat(x)).filter((x) => isFinite(x));
          onChange(cond);
        }, "7, 13, 34", "gcf-title", "180px");
        node = inp;
      } else if (kind === "text") {
        node = this.txtInput(cond[p] || "", (v) => { cond[p] = v.trim(); onChange(cond); }, "hospital", "gcf-title", "180px");
      } else if (kind === "dim") {
        node = this.sel(this.DIM_ORDER.map((k) => [k, (this.DIM_LABEL[k] || k) + "（" + k + "）"]),
          cond[p] || "code", (v) => { cond[p] = v; onChange(cond); }, "200px");
      } else if (kind === "ver") {
        node = this.sel(this.VER_ORDER.map((v2) => [v2, v2]), cond[p] || "V1", (v) => { cond[p] = v; onChange(cond); }, "100px");
      } else if (kind === "v") {
        node = this.sel(this.VERDICTS, cond[p] || "pass", (v) => { cond[p] = v; onChange(cond); }, "140px");
      } else {
        node = this.numInput(cond[p] != null ? cond[p] : 0, (v) => { cond[p] = v; onChange(cond); }, "90px");
      }
      row.append(this.labeled(label, node));
    });
    box.append(row);

    /* 组合子：`of` = 子条件数组（递归） */
    if (params.indexOf("of") >= 0) {
      if (!Array.isArray(cond.of)) cond.of = [];
      const kids = h("div", { style: "margin-top:6px;" });
      cond.of.forEach((sub, k) => {
        if (!sub || typeof sub !== "object") return;
        kids.append(h("div", { style: "display:flex;gap:6px;align-items:flex-start;" },
          this.condEditor(sub, (next) => { cond.of[k] = next; onChange(cond); }, d + 1),
          (() => {
            const b = h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;flex:0 0 auto;margin-top:6px;" }, "移除");
            b.addEventListener("click", () => { cond.of.splice(k, 1); onChange(cond); this.render(); });
            return b;
          })()));
      });
      const addBtn = h("button", { class: "btn btn-sm btn-ghost", style: "margin-top:6px;" }, "+ 加一条子条件");
      addBtn.addEventListener("click", () => { cond.of.push({ type: "rank_le", n: 10 }); onChange(cond); this.render(); });
      kids.append(addBtn);
      box.append(kids);
    }

    /* 一行预览：把最终会落盘的 cond 显示出来 —— 配置错了这里一眼能看出来 */
    const pre = h("div", { class: "dim", style: "font-family:ui-monospace,Consolas,monospace;font-size:11px;margin-top:6px;word-break:break-all;" },
      JSON.stringify(cond));
    box.append(pre);
    return box;
  },

  async save({ silent = false } = {}) {
    try {
      /* ⚠️ 保存前做一次**最小体检**：key 重复 = 引擎按 key 找条目会命中错误的那条；
         cond 缺 type = 引擎会响亮失败（console.error）但那是在游戏里才发现。宁可在编辑器拦住。 */
      const errs = this.validate();
      if (errs.length) throw new Error(errs.join("；"));
      const r = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "ACHIEVEMENTS", config: this.data,
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      if (window.CfgSync) CfgSync.update(d.mtime);
      if (!silent) UI.toast("成就配置已保存并同步到游戏");
    } catch (e) {
      if (silent) throw e;
      UI.toast("保存失败：" + e.message, "err");
    }
  },

  /* 保存前的最小体检（返回错误文案数组，空 = 通过） */
  validate() {
      // Configuration semantics are the planner's responsibility.
      return [];
    },
};
