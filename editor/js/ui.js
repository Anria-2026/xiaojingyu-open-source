/* ==========================================================================
   UI 框架：分页切换 + 通用面板构建工具（所有编辑器分页共用）
   ========================================================================== */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** 便捷创建元素：h("div", {class:"x", onclick:fn}, "文本", childNode...) */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const UI = {
  _tabMap: {},

  /** 初始化顶部导航分页（§二.4） */
  initTabs(map) {
    this._tabMap = map;
    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.page, tab));
    });
  },

  /** 编程式切页（视图记忆恢复用） */
  switchTab(page, tabEl) {
    const tab = tabEl || $$(".tab").find((t) => t.dataset.page === page);
    if (!tab) return;
    $$(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    $$(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + page));
    const fn = this._tabMap[page];
    if (fn) fn();
  },

  /** 全局 toast（挂 document.body 直接子级，高 z-index，§三.3 铁律） */
  toast(msg, type = "ok", ms = 2600) {
    let t = $("#ui-toast");
    if (!t) {
      t = h("div", { id: "ui-toast", class: "ui-toast" });
      document.body.append(t);
    }
    t.textContent = msg;
    t.className = "ui-toast " + (type === "err" ? "err" : "");
    t.style.opacity = "1";
    t.style.transform = "translate(-50%, 0)";
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translate(-50%, -8px)";
    }, ms);
  },

  /** 字段：数字输入 */
  numField(label, value, onchange, step = 1, min = null, max = null) {
    const input = h("input", { type: "number", value: String(value), step: String(step) });
    if (min !== null) input.min = String(min);
    if (max !== null) input.max = String(max);
    input.addEventListener("change", () => {
      const v = parseFloat(input.value);
      if (!isNaN(v)) onchange(v);
    });
    return h("div", { class: "field" }, h("label", {}, label), input);
  },

  /** 字段：文本输入 */
  textField(label, value, onchange) {
    const input = h("input", { type: "text", value: String(value) });
    input.addEventListener("change", () => onchange(input.value));
    return h("div", { class: "field" }, h("label", {}, label), input);
  },

  /** 字段：下拉选择 */
  selectField(label, options, value, onchange) {
    const sel = h("select", {});
    for (const o of options) {
      sel.append(h("option", { value: String(o.value) }, String(o.label)));
    }
    sel.value = String(value);
    sel.addEventListener("change", () => onchange(sel.value));
    return h("div", { class: "field" }, h("label", {}, label), sel);
  },

  /** 字段：勾选框 */
  checkField(label, checked, onchange) {
    const cb = h("input", { type: "checkbox" });
    cb.checked = !!checked;
    cb.addEventListener("change", () => onchange(cb.checked));
    return h("div", { class: "check-field" }, cb, h("span", {}, label));
  },

  /** 分区标题 */
  section(title, ...children) {
    return h("div", {}, h("h3", {}, title), ...children);
  },

  /** 清空面板 */
  clear(el) { while (el.firstChild) el.removeChild(el.firstChild); },
};

/* ==========================================================================
   视图记忆（§二.1）：记住当前 tab + 各页滚动位置 + 当前场景，刷新自动复位
   - history.scrollRestoration='manual'，动态渲染完成后才 scrollTo
   - 监听 scroll(rAF 节流) + beforeunload/pagehide 保存
   ========================================================================== */
const ViewMemory = {
  key: "editor_view_memory_v1",
  data: { tab: "map", scene: 0, tool: "select", scrolls: {} },
  _raf: 0,

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.key) || "null");
      if (d && typeof d === "object") this.data = Object.assign(this.data, d);
    } catch (e) {}
    return this.data;
  },

  save() {
    // 收集每个可滚动面板的 scrollTop
    const scrolls = {};
    $$(".page").forEach((p) => {
      const sc = p.querySelector(".scroll-region") || p;
      if (sc.scrollTop !== undefined) scrolls[p.id] = sc.scrollTop || 0;
    });
    const act = document.querySelector(".tab.active");
    this.data.tab = act ? act.dataset.page : this.data.tab;
    this.data.scrolls = scrolls;
    if (window.App && App.project) this.data.scene = App.project.active;
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
  },

  /* scroll 节流保存（rAF 合并连发） */
  bindScroll() {
    document.addEventListener("scroll", () => {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this.save(); });
    }, true);
  },

  /* 恢复：切回上次 tab，并在渲染完成后滚动到位 */
  apply() {
    const d = this.data;
    if (d.tab && UI._tabMap[d.tab]) UI.switchTab(d.tab);
    const pid = "page-" + d.tab;
    const delay = () => {
      const page = $("#" + pid);
      const sc = page ? page.querySelector(".scroll-region") : null;
      if (sc && sc.scrollTop !== undefined) sc.scrollTop = (d.scrolls || {})[pid] || 0;
    };
    setTimeout(delay, 80);
    setTimeout(delay, 300);
  },
};
