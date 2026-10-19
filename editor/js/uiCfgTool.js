/* ==========================================================================
   UI 配置页（2026-09-03 新增）
   --------------------------------------------------------------------------
   配置游戏界面层面的东西，目前包含：
   1. 办公室左侧按钮排列顺序（UI_CFG.actions = 有序 key 列表，divider=分组线；
      游戏端 game_ui.officeActions() 按此排序，漏配的按钮自动补到末尾）
   2. 二级面板空态（EMPTY_STATES：每个面板一张图 + 一句话；图片可浏览选择）
   3. 「更多」二级按钮（UI_CFG.moreButtons：顺序、名称、图标、显示开关）
   4. 主界面「制作组名单」正文（UI_CFG.credits，2026-09-14 新增；纯文本、支持换行，
      留空 = 主界面不显示该入口）
   保存：UI_CFG 走独立分区（整区替换），EMPTY_STATES 走 base 稀疏提交
   （只钉 ≠ 出厂默认的条目，等于默认的走 resetKeys 删除，2026-09-06）。
   ========================================================================== */
"use strict";

window.UICfgTool = {
  cfg: null,        // UI_CFG 整区工作副本；保留当前页面没有编辑的字段
  empty: null,      // EMPTY_STATES 工作副本 { key: {img, text} }
  loaded: false,

  /* 办公室左侧按钮定义（与 h5_demo/js/game_ui.js officeActions() 默认顺序一致） */
  ACTIONS: [
    { key: "team",    label: "团队" },
    { key: "news",    label: "吃瓜" },
    { key: "hire",    label: "扩编" },
    { key: "recruit", label: "招聘" },
    { key: "plan",    label: "立项" },
    { key: "focus",   label: "攻关" },
    { key: "divider", label: "―― 分组线 ――" },
    { key: "corpus",  label: "语料" },
    { key: "paper",   label: "论文" },
    { key: "shop",    label: "算力" },
    { key: "test",    label: "测试" },
    { key: "review",  label: "评审" },
    { key: "more",    label: "更多" },
  ],
  EMPTY_KEYS: ["test", "recruit", "plan", "focus", "paper", "shop", "review"],
  MORE_BUTTONS: [
    { id: "whale-room", label: "鲸鱼房", icon: "heart", enabled: true },
    { id: "feeding", label: "投喂", icon: "fish", enabled: true },
    { id: "wardrobe", label: "换装", icon: "shirt", enabled: true },
    { id: "arcade", label: "小游戏厅", icon: "gamepad", enabled: true },
    { id: "whale-size", label: "鲸鱼大小", icon: "settings", enabled: true },
  ],
  MORE_ACTIONS: [
    { id: "team", label: "团队", icon: "users", enabled: true },
    { id: "news", label: "吃瓜", icon: "news", enabled: true },
    { id: "recruit", label: "招聘", icon: "briefcase", enabled: true },
    { id: "hire", label: "扩编", icon: "briefcase", enabled: true },
    { id: "plan", label: "立项", icon: "file", enabled: true },
    { id: "focus", label: "攻关", icon: "target", enabled: true },
    { id: "corpus", label: "语料", icon: "database", enabled: true },
    { id: "paper", label: "论文", icon: "book", enabled: true },
    { id: "shop", label: "算力", icon: "cpu", enabled: true },
    { id: "test", label: "测试", icon: "chat", enabled: true },
    { id: "review", label: "评审", icon: "shield", enabled: true },
  ],
  MORE_ICONS: [
    { key: "users", label: "团队", stroke: "2.1", svg: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>" },
    { key: "news", label: "新闻", stroke: "2.1", svg: "<path d=\"M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z\"/><path d=\"M16 3v16\"/><path d=\"M8 7h5M8 11h5M8 15h5\"/>" },
    { key: "briefcase", label: "招聘", stroke: "2.1", svg: "<rect x=\"2\" y=\"7\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2\"/><path d=\"M2 13h20\"/>" },
    { key: "file", label: "项目", stroke: "2.1", svg: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/>" },
    { key: "target", label: "目标", stroke: "2.1", svg: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>" },
    { key: "database", label: "语料", stroke: "2.1", svg: "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"/><path d=\"M21 12c0 1.66-4 3-9 3s-9-1.34-9-3\"/><path d=\"M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5\"/>" },
    { key: "book", label: "论文", stroke: "2.1", svg: "<path d=\"M4 19.5A2.5 2.5 0 0 1 6.5 17H20\"/><path d=\"M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z\"/>" },
    { key: "cpu", label: "算力", stroke: "2.1", svg: "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\"/><path d=\"M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3\"/>" },
    { key: "chat", label: "聊天", stroke: "2.1", svg: "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>" },
    { key: "shield", label: "评审", stroke: "2.1", svg: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/>" },
    { key: "heart", label: "爱心", svg: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>' },
    { key: "fish", label: "鱼", svg: '<path d="M3 12c4-7 10-7 15 0-5 7-11 7-15 0Z"/><path d="m18 12 4-4v8Z"/><circle cx="8" cy="11" r="1"/>' },
    { key: "shirt", label: "衣服", svg: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>' },
    { key: "gamepad", label: "手柄", svg: '<path d="M7 7h10c3 0 4 3 5 9 .5 3-2 5-4 2l-2-2H8l-2 2c-2 3-4.5 1-4-2C3 10 4 7 7 7Z"/><path d="M5 11h6M8 8v6"/><circle cx="17" cy="11" r=".7"/><circle cx="19" cy="13" r=".7"/>' },
    { key: "settings", label: "设置", svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
  ],

  defaultCfg() {
    const defaults = (((window.GameDefaults || {}).base || {}).UI_CFG || {});
    const cfg = JSON.parse(JSON.stringify(defaults));
    if (!Object.prototype.hasOwnProperty.call(cfg, "actions")) cfg.actions = this.ACTIONS.map((a) => a.key);
    if (!Object.prototype.hasOwnProperty.call(cfg, "moreButtons")) cfg.moreButtons = JSON.parse(JSON.stringify(this.MORE_BUTTONS));
    if (!Object.prototype.hasOwnProperty.call(cfg, "credits")) cfg.credits = "";
    return cfg;
  },

  moreButtons() { return Array.isArray(this.cfg.moreButtons) ? this.cfg.moreButtons : []; },

  moreCatalog() { return this.MORE_BUTTONS.concat(this.MORE_ACTIONS); },

  moreAssigned(key) { return this.moreButtons().some((row) => row.id === key && row.enabled !== false); },

  assignMore(key, intoMore) {
    const known = this.MORE_ACTIONS.find((row) => row.id === key);
    if (!known) return;
    if (!Array.isArray(this.cfg.moreButtons)) this.cfg.moreButtons = [];
    const matches = this.cfg.moreButtons.filter((row) => row.id === key);
    if (intoMore && !matches.length) this.cfg.moreButtons.push(JSON.parse(JSON.stringify(known)));
    else matches.forEach((row, i) => { row.enabled = !!intoMore && i === 0; });
    // Preserve the original main action order and each menu row's custom fields.
    this.render();
  },

  renderButtonPlacement() {
    const list = h("div", { class: "gcf-grid" });
    this.MORE_ACTIONS.filter((row) => row.id !== "hire").forEach((action) => {
      const select = h("select", { class: "uicfg-place-select", "aria-label": "按钮位置 · " + action.label,
        "data-button-place": action.id },
        h("option", { value: "main" }, "主界面"), h("option", { value: "more" }, "更多"));
      select.value = this.moreAssigned(action.id) ? "more" : "main";
      select.addEventListener("change", () => this.assignMore(action.id, select.value === "more"));
      list.append(h("div", { class: "gcf-field" }, h("label", {}, action.label), select));
    });
    return h("div", { class: "gcf-mod", id: "uicfg-button-placement" },
      h("div", { class: "gcf-mod-head" }, "🧭 按钮位置 · 主界面 / 更多"),
      h("p", { class: "gcf-tip" }, "选择「更多」会把对应按钮从主界面收进二级页签；选回「主界面」恢复原来的主按钮顺序。下方可调整二级按钮顺序、名称和图标。"), list);
  },

  iconPreview(key) {
    const icon = this.MORE_ICONS.find((x) => x.key === key);
    const span = h("span", { "aria-hidden": "true", style: { display: "inline-flex", width: "22px", height: "22px", alignItems: "center", justifyContent: "center" } });
    if (icon) span.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="' + (icon.stroke || (key === "settings" ? "2.1" : "1.8")) + '" stroke-linecap="round" stroke-linejoin="round">' + icon.svg + '</svg>';
    else span.textContent = "◇";
    return span;
  },

  async refresh() {
    const defCredits = (((window.GameDefaults || {}).base || {}).UI_CFG || {}).credits || "";
    try {
      const j = await (await fetch("/api/game-cfg")).json();
      if (window.CfgSync) CfgSync.note(j);
      const c = j.config || {};
      this.cfg = JSON.parse(JSON.stringify(c.UI_CFG || {}));
      const defaults = this.defaultCfg();
      Object.keys(defaults).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(this.cfg, key)) this.cfg[key] = defaults[key];
      });
      /* 制作组名单正文（2026-09-14）：只在**键缺失**时取出厂默认 ——
         空字符串是「有意清空」（主界面不显示入口），不能回落默认，否则清不掉。 */
      if (!Object.prototype.hasOwnProperty.call(c.UI_CFG || {}, "credits"))
        this.cfg.credits = (c.UI_CFG && typeof c.UI_CFG.credits === "string") ? c.UI_CFG.credits : defCredits;
      const defE = (window.GameDefaults.base && window.GameDefaults.base.EMPTY_STATES) || {};
      this.empty = {};
      this.EMPTY_KEYS.forEach((k) => {
        const s = c.EMPTY_STATES && c.EMPTY_STATES[k];
        const d = defE[k] || {};
        this.empty[k] = { img: (s && s.img) || d.img || "", text: (s && s.text) || d.text || "" };
      });
    } catch (e) {
      this.cfg = this.defaultCfg();
      this.empty = {};
      const defE = (((window.GameDefaults || {}).base || {}).EMPTY_STATES || {});
      this.EMPTY_KEYS.forEach((k) => { this.empty[k] = { img: (defE[k] || {}).img || "", text: (defE[k] || {}).text || "" }; });
    }
    this.loaded = true;
    this.render();
  },

  init() { this.refresh(); },

  label(key) {
    const a = this.ACTIONS.find((x) => x.key === key);
    return a ? a.label : key;
  },

  render() {
    const wrap = $("#uicfg-list");
    if (!wrap) return;
    UI.clear(wrap);

    /* ---- 1. 左侧按钮排列顺序 ---- */
    const list = h("div", { class: "uicfg-actions" });
    this.cfg.actions.forEach((key, i) => {
      const row = h("div", { class: "uicfg-action-row" },
        h("span", { class: "uicfg-idx" }, String(i + 1)),
        h("span", { class: "uicfg-label" }, this.label(key)));
      if (i > 0) {
        const up = h("button", { class: "btn btn-sm", title: "上移" }, "↑");
        up.addEventListener("click", () => this.move(i, -1));
        row.append(up);
      }
      if (i < this.cfg.actions.length - 1) {
        const down = h("button", { class: "btn btn-sm", title: "下移" }, "↓");
        down.addEventListener("click", () => this.move(i, 1));
        row.append(down);
      }
      const del = h("button", { class: "btn btn-sm btn-ghost", title: "从此列表移除（按钮仍存在，会补到末尾）" }, "✕");
      del.addEventListener("click", () => { this.cfg.actions.splice(i, 1); this.render(); });
      row.append(del);
      list.append(row);
    });
    /* 未在列表中的按钮：点击加入 */
    const rest = this.ACTIONS.map((a) => a.key).filter((k) => !this.cfg.actions.includes(k));
    const addRow = h("div", { class: "uicfg-add" });
    if (rest.length) {
      const sel = h("select", { class: "uport-sel" },
        h("option", { value: "", disabled: "", selected: "" }, "— 加入按钮 —"),
        rest.map((k) => h("option", { value: k }, this.label(k))));
      const add = h("button", { class: "btn btn-sm" }, "＋ 加入");
      add.addEventListener("click", () => {
        if (!sel.value) return;
        this.cfg.actions.push(sel.value);
        this.render();
      });
      addRow.append(sel, add);
    } else {
      addRow.append(h("span", { class: "dim" }, "全部按钮都已在列表中"));
    }

    const mod1 = h("div", { class: "gcf-mod" },
      h("div", { class: "gcf-mod-head" }, "🧭 办公室左侧按钮排列顺序"),
      h("p", { class: "gcf-tip" }, "从上到下即游戏内左侧按钮列的顺序；分组线只是视觉分隔。被移除的按钮会按默认顺序补在末尾，不会丢失。"),
      list, addRow);

    /* ---- 2. 二级面板空态 ---- */
    const grid = h("div", { class: "gcf-grid" });
    this.EMPTY_KEYS.forEach((k) => {
      const st = this.empty[k];
      const imgIn = h("input", { class: "gcf-opt-text", type: "text", value: st.img || "", placeholder: "resource/ui/xxx.webp" });
      imgIn.addEventListener("change", () => { st.img = imgIn.value.trim(); });
      const browse = h("button", { class: "btn btn-sm", type: "button" }, "📁 浏览");
      browse.addEventListener("click", () => {
        ResPicker.pick(st.img, { title: "空态图 · " + k }).then((p) => {
          if (!p) return;
          st.img = p; imgIn.value = p;
        });
      });
      const txtIn = h("input", { class: "gcf-opt-text", type: "text", value: st.text || "" });
      txtIn.addEventListener("change", () => { st.text = txtIn.value.trim(); });
      grid.append(h("div", { class: "gcf-field", style: { gridColumn: "1 / -1" } },
        h("label", {}, `空态 · ${k}`),
        h("div", { class: "gcf-img-row" }, imgIn, browse),
        h("div", { class: "gcf-img-row", style: { marginTop: "4px" } }, txtIn)));
    });
    const mod2 = h("div", { class: "gcf-mod" },
      h("div", { class: "gcf-mod-head" }, "🕳 二级面板空态（图 + 一句话）"),
      h("p", { class: "gcf-tip" }, "前置条件不满足时，面板只显示一张图和一句话（如「鲸鱼娘还没开智」）。"),
      grid);

    /* ---- 3. 主界面「制作组名单」（2026-09-14）---- */
    const creditsTa = h("textarea", { class: "gcf-desc", rows: "8",
      placeholder: "一行一条，空行=分段。例：\n企划 / 程序 / 数值：XXX\n美术：XXX" }, this.cfg.credits || "");
    creditsTa.addEventListener("input", () => { this.cfg.credits = creditsTa.value; });
    const mod3 = h("div", { class: "gcf-mod" },
      h("div", { class: "gcf-mod-head" }, "📜 主界面 · 制作组名单"),
      h("p", { class: "gcf-tip" },
        "位置：主界面「开始游戏」按钮**下方**的独立按钮，点开是一个二级弹窗（标题「制作组名单」，右上角 ✕ / 点空白处 / Esc 都能关）。"
        + "正文就是这里的纯文本，换行照排。**留空 = 主界面不显示这个入口。**"),
      h("div", { class: "gcf-field", style: { gridColumn: "1 / -1" } },
        h("label", {}, "名单正文"), creditsTa));

    wrap.append(this.renderButtonPlacement(), mod1, this.renderMoreButtons(), mod2, mod3);
  },

  renderMoreButtons() {
    const rows = this.moreButtons();
    const list = h("div", { class: "uicfg-actions" });
    rows.forEach((item, i) => {
      const known = this.moreCatalog().find((x) => x.id === item.id);
      const label = h("input", { type: "text", class: "gcf-opt-text", value: item.label == null ? (known ? known.label : item.id) : item.label,
        "aria-label": "按钮名称 · " + item.id, "data-more-label": item.id, style: { flex: "1", minWidth: "100px" } });
      const preview = h("button", { type: "button", class: "btn btn-sm", disabled: "", title: "游戏内按钮预览", "data-more-preview": item.id,
        style: { display: "inline-flex", alignItems: "center", gap: "6px", opacity: item.enabled === false ? ".45" : "1" } });
      const redraw = () => {
        UI.clear(preview);
        preview.append(this.iconPreview(item.icon), h("span", {}, item.label == null ? (known ? known.label : item.id) : item.label));
      };
      redraw();
      label.addEventListener("input", () => { item.label = label.value; redraw(); });
      const icon = h("select", { class: "uport-sel", "aria-label": "按钮图标 · " + item.id, "data-more-icon": item.id },
        this.MORE_ICONS.map((x) => h("option", { value: x.key }, x.label)));
      if (!this.MORE_ICONS.some((x) => x.key === item.icon)) icon.append(h("option", { value: item.icon || "" }, "当前图标 · " + (item.icon || "默认")));
      icon.value = item.icon || "";
      icon.addEventListener("change", () => { item.icon = icon.value; redraw(); });
      const enabled = h("input", { type: "checkbox", "aria-label": "显示按钮 · " + item.id, "data-more-enabled": item.id });
      enabled.checked = item.enabled !== false;
      enabled.addEventListener("change", () => {
        item.enabled = enabled.checked; preview.style.opacity = item.enabled ? "1" : ".45";
        if (this.MORE_ACTIONS.some((row) => row.id === item.id)) this.render();
      });
      const row = h("div", { class: "uicfg-action-row", "data-more-row": item.id,
        style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
        h("span", { class: "uicfg-idx" }, String(i + 1)), h("label", { style: { display: "inline-flex", alignItems: "center", gap: "4px" } }, enabled, "显示"),
        h("span", { class: "dim", style: { minWidth: "70px" } }, known ? known.label : item.id), label, icon, preview);
      const up = h("button", { type: "button", class: "btn btn-sm", title: "上移", "data-more-up": item.id }, "↑");
      up.disabled = i === 0;
      up.addEventListener("click", () => this.moveMore(i, -1));
      const down = h("button", { type: "button", class: "btn btn-sm", title: "下移", "data-more-down": item.id }, "↓");
      down.disabled = i === rows.length - 1;
      down.addEventListener("click", () => this.moveMore(i, 1));
      const remove = h("button", { type: "button", class: "btn btn-sm btn-ghost", title: "移除此入口", "data-more-remove": item.id }, "✕");
      remove.addEventListener("click", () => { rows.splice(i, 1); this.render(); });
      row.append(up, down, remove);
      list.append(row);
    });
    if (!rows.length) list.append(h("p", { class: "dim" }, "当前没有二级按钮，游戏内「更多」将显示空态。可在下方加入入口。"));
    const missing = this.moreCatalog().filter((x) => !rows.some((row) => row.id === x.id));
    const addRow = h("div", { class: "uicfg-add" });
    if (missing.length) {
      const select = h("select", { class: "uport-sel", "aria-label": "加入更多功能", "data-more-add-select": "" },
        h("option", { value: "" }, "— 加入功能 —"), missing.map((x) => h("option", { value: x.id }, x.label)));
      const add = h("button", { type: "button", class: "btn btn-sm", "data-more-add": "" }, "＋ 加入");
      add.addEventListener("click", () => {
        const item = this.moreCatalog().find((x) => x.id === select.value);
        if (!item) return;
        if (!Array.isArray(this.cfg.moreButtons)) this.cfg.moreButtons = [];
        this.cfg.moreButtons.push(JSON.parse(JSON.stringify(item)));
        this.render();
      });
      addRow.append(select, add);
    } else addRow.append(h("span", { class: "dim" }, "全部功能都已加入"));
    return h("div", { class: "gcf-mod", id: "uicfg-more-buttons" },
      h("div", { class: "gcf-mod-head" }, "☰ 更多 · 二级功能按钮"),
      h("p", { class: "gcf-tip" }, "主界面点击「更多」后展示这些按钮。从上到下为页签顺序；名称、图标可调整，右侧实时预览。主行动按钮关闭「显示」或移除后会回到主界面；鲸鱼房等二级功能关闭后则隐藏。"), list, addRow);
  },

  moveMore(i, dir) {
    const rows = this.moreButtons(), j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const item = rows[i]; rows[i] = rows[j]; rows[j] = item;
    this.render();
  },

  move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= this.cfg.actions.length) return;
    const tmp = this.cfg.actions[i]; this.cfg.actions[i] = this.cfg.actions[j]; this.cfg.actions[j] = tmp;
    this.render();
  },

  /* 保存：UI_CFG 独立分区 + EMPTY_STATES 走 base（顶层 key 替换） */
  async save({ silent = false } = {}) {
    try {
      const r = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "UI_CFG", config: JSON.parse(JSON.stringify(this.cfg)),
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      if (window.CfgSync) CfgSync.update(d.mtime);
      /* EMPTY_STATES 稀疏提交（2026-09-06 架构加固）：refresh() 里空态视图是
         「已存值 ∥ 出厂默认」的合并结果——整对象提交会把今天的默认文案/图钉进 JSON，
         之后代码再改默认就被旧钉值挡住（「BUG 复活」的另一种形态）。
         改为只提交 ≠ 当前出厂默认的条目；等于默认的条目走 resetKeys（段数组）
         从 JSON 删除 → 回落代码默认，值不变。 */
      const defE = (window.GameDefaults.base && window.GameDefaults.base.EMPTY_STATES) || {};
      const esOut = {}, esResets = [];
      this.EMPTY_KEYS.forEach((k) => {
        const cur = this.empty[k] || {};
        const dv = defE[k] || {};
        if (JSON.stringify(cur) === JSON.stringify(dv)) esResets.push(["EMPTY_STATES", k]);
        else esOut[k] = JSON.parse(JSON.stringify(cur));
      });
      const r2 = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "base", config: { EMPTY_STATES: esOut }, resetKeys: esResets,
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d2 = await r2.json();
      if (!d2.ok) throw new Error(d2.error || "未知错误");
      if (window.CfgSync) CfgSync.update(d2.mtime);
      if (!silent) UI.toast("UI 配置已保存并同步到游戏");
    } catch (e) {
      if (silent) throw e;
      UI.toast("保存失败：" + e.message, "err");
    }
  },
};
