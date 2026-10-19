/* ==========================================================================
   论文配置页（doc/32 §9 · 2026-09-13 新增）
   --------------------------------------------------------------------------
   为什么要有这一页：以前编辑器里**只有 5 个全局参数**（研究耗时 / 折合周数 /
   V1 文字概率 / V1 触发加成 / V1.5 语料倍率），**每篇论文的标题、简介、效果、
   数值全都改不了** —— 而论文是「读一篇就永久生效」的核心内容，全靠改工厂代码。

   本页维护三块（整区保存，section = "PAPER"）：
     ① POOL            论文池：唯一 ID `no` + 别名 `key` + 文案 + 效果（类型 + 数值）
     ② CANDIDATES_BY_VER  每阶段能研读的论文（只写数字 no）
     ③ LEGACY_NO       旧档兼容映射（**只读展示**：它必须只增不删，不给编辑入口）

   ⚠️ 三处**故意不在本页**（避免"两条写入路径"，改了会被另一页覆盖）：
     · 论文全局参数（研究耗时 / 折合周数 / 文字概率 …）→【玩法配置 → 论文研究】
     · 架构的钥匙论文 `ARCHITECTURES[*].unlockPaper` →【架构】页（那一页拥有 ARCHITECTURES）
     · 架构解锁方式 unlockBy / 自家报告 → 同上
   本页只做**反查展示**（「被哪些架构当钥匙」），提醒你改钥匙要去架构页。

   ⚠️ 效果文案预览 `paperEffectText()` 与游戏侧 `game_core.paperEffectText()` 是
      **同源两份**（编辑器加载不到 game_core.js）—— test_editor_cfg.js 有断言逐篇比对，
      改一处必须同步改另一处（两处都写了这句注释）。
   ========================================================================== */
"use strict";

window.PaperTool = {
  pool: null,       // PAPER.POOL 工作副本
  cands: null,      // PAPER.CANDIDATES_BY_VER 工作副本
  legacy: null,     // PAPER.LEGACY_NO（只读展示）
  _sel: null,       // 当前选中的 no

  /* 效果类型：与 game_core.paperEffectText 的 switch 一一对应 */
  KINDS: [
    ["extra_roll", "额外产出机会（按概率再产一次）"],
    ["dim_bonus", "维度加分（每次产出 +N）"],
    ["role_energy", "岗位体力消耗倍率"],
    ["axis_amp", "能力轴 · 单次产出倍率"],
    ["axis_rate", "能力轴 · 触发概率 +"],
    ["focus_mul", "攻关加成 +"],
    /* 旧口径（v1/v1.5/v3 时代的论文还在用，保留可编辑，别删） */
    ["text_prob", "（旧）文字概率 +N"],
    ["data_speed", "（旧）数据语料产量倍率"],
    ["energy", "（旧）体力消耗倍率"],
    ["prod", "（旧）维度产出效率"],
  ],
  SCOPES: [["all", "三个岗位"], ["pre", "预训练"], ["data", "数据"], ["post", "后训练"]],
  ROLES: [["pre", "预训练"], ["data", "数据"], ["post", "后训练"]],
  DIMS: [["code", "代码"], ["text", "文字"], ["safety", "安全"], ["stability", "稳定"],
         ["memory", "记忆"], ["reasoning", "推理"], ["tool", "工具"], ["all", "全维度"]],
  AXES: [["memory", "记忆"], ["reasoning", "推理"], ["tool", "工具"]],
  UNLOCK_BY: [["study", "研读（外部论文）"], ["event", "事件提案（自家报告）"]],

  VER_ORDER: (window.GameDefaults && window.GameDefaults.base && window.GameDefaults.base.VER_ORDER)
    || ["V1", "V1.5", "V2", "V2.5", "V3", "V3.5", "V4", "V4.5"],

  clone(o) {
    return o === null || typeof o !== "object" ? o : (Array.isArray(o) ? o.map((x) => this.clone(x)) :
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, this.clone(v)])));
  },

  async refresh() {
    let saved = {};
    try {
      const r = await (await fetch("/api/game-cfg")).json();
      if (window.CfgSync) CfgSync.note(r);
      saved = r.config || {};
    } catch (e) { /* 离线回落默认 */ }
    const G = window.GameDefaults || {};
    const def = G.base || G;
    const sp = saved.PAPER || {}, dp = def.PAPER || {};
    this.pool = this.clone(sp.POOL || dp.POOL || []);
    this.cands = this.clone(sp.CANDIDATES_BY_VER || dp.CANDIDATES_BY_VER || {});
    /* 旧档映射只读展示：真源里的为准，没有就用出厂 */
    this.legacy = this.clone((sp.LEGACY_NO && Object.keys(sp.LEGACY_NO).length ? sp.LEGACY_NO : dp.LEGACY_NO) || {});
    if (this._sel == null || !this.pool.some((p) => p.no === this._sel)) this._sel = (this.pool[0] || {}).no || null;
    this.render();
  },

  init() {
    const add = $("#paper-add");
    if (add) add.addEventListener("click", () => {
      /* 新论文的 no：从现有最大值 +1（doc/32：4xxx 段专用于论文，分配后永不变） */
      const maxNo = this.pool.reduce((a, p) => Math.max(a, +p.no || 4000), 4000);
      const no = maxNo + 1;
      this.pool.push({ no: no, key: "paper_" + no, unlockBy: "study", ver: "",
        title: "新论文标题", venue: "arXiv 20xx", cite: "0", authors: "et al.",
        tags: [], desc: "论文简介……", effect: { kind: "dim_bonus", dim: "code", add: 1 }, weeks: 1 });
      this._sel = no;
      this.markDirty();
      this.render();
    });
    const addc = $("#paper-cand-add");
    if (addc) addc.addEventListener("click", () => {
      /* 给每个阶段补一个空位不直观 —— 候选是「阶段 → 论文列表」，这里只做「重置为出厂」 */
      const dp = ((window.GameDefaults || {}).base || {}).PAPER || {};
      this.cands = this.clone(dp.CANDIDATES_BY_VER || {});
      this.markDirty();
      this.render();
    });
    this.refresh();
  },

  markDirty() { if (window.App && App.markCfgDirty) App.markCfgDirty(); },

  /* ---------------- 效果文案（与 game_core.paperEffectText 同源） ---------------- */
  paperEffectText(p) {
    const V = (((window.GameDefaults || {}).base || {}).V35) || {};
    const e = p && p.effect;
    if (!e) return "—";
    const pct = (x) => Math.round((x || 0) * 100) + "%";
    const ROLE = { pre: "预训练", data: "数据", post: "后训练" };
    const DIM = { code: "代码", text: "文字", safety: "安全", stability: "稳定",
                  memory: "记忆", reasoning: "推理", tool: "工具" };
    const roleOf = (r) => ROLE[r] || r || "";
    /* [feature:paper-preview-configured-axis-name] */
    const cfg = (window.GameCfgTool && window.GameCfgTool.data) || (window.GameDefaults || {}).base || {};
    const dimOf = (d) => {
      if (DIM[d]) return DIM[d];
      const names = (cfg.EMBODIED || {}).AXIS_NAMES || {};
      if (typeof names[d] === "string" && names[d].trim()) return names[d].trim();
      const axes = ((cfg.V35 || {}).AXES || {}).DEF || {};
      return axes[d] && axes[d].name || d || "";
    };
    /* [/feature:paper-preview-configured-axis-name] */
    switch (e.kind) {
      case "extra_roll": {
        const who = e.scope && e.scope !== "all" ? roleOf(e.scope) + "岗" : "三个岗位";
        return who + "每次产出有 " + pct(e.prob) + " 概率再多产一次（永续）";
      }
      case "dim_bonus":
        return "每次产出「" + dimOf(e.dim) + "」额外 +" + (e.add != null ? e.add : 1) + "（永续）";
      case "role_energy": {
        const m = e.mul != null ? e.mul : 1;
        return roleOf(e.role) + "岗体力消耗 " + (m <= 1 ? "−" : "+") +
               Math.abs(Math.round((m - 1) * 100)) + "%（永续）";
      }
      case "axis_amp":
        return "「" + dimOf(e.axis) + "」轴单次产出 ×" + (e.mul != null ? e.mul : 1) + "（永续）";
      case "axis_rate":
        return "「" + dimOf(e.axis) + "」轴触发概率 +" + pct(e.add) + "（永续）";
      case "axis_add":
        return "「" + dimOf(e.axis) + "」轴每次触发额外 +" + (e.add != null ? e.add : 1) + "（永续）";
      case "focus_mul": {
        const base = V.FOCUS_MUL != null ? V.FOCUS_MUL : 1.5;
        const add = e.add != null ? e.add : 0;
        return "攻关加成 +" + add + "（" + base + " → " + Math.round((base + add) * 100) / 100 + "，永续）";
      }
      case "text_prob": {
        const prob = V.PAPER_TEXT_PROB != null ? V.PAPER_TEXT_PROB : (e.prob != null ? e.prob : 0.1);
        const add = V.PAPER_TEXT_ADD != null ? V.PAPER_TEXT_ADD : (e.add != null ? e.add : 1);
        return "文字能力增长时 " + pct(prob) + " 概率 +" + add + "（永续）";
      }
      case "data_speed": {
        const m = e.mul != null ? e.mul : (V.PAPER_DATA_SPEED_MUL != null ? V.PAPER_DATA_SPEED_MUL : 1.1);
        return "数据工程师语料产量 +" + Math.round((m - 1) * 100) + "%（永续）";
      }
      case "energy":
        return "研发体力消耗 −" + Math.abs(Math.round((1 - (e.mul != null ? e.mul : 1)) * 100)) + "%（永续）";
      case "prod": {
        const m = e.mul != null ? e.mul : 1;
        return (e.dim === "all" || !e.dim ? "全能力" : dimOf(e.dim)) + "产出效率 +" +
               Math.round((m - 1) * 100) + "%（永续）";
      }
      default:
        return e.mul != null ? "基础训练效率 +" + Math.round((e.mul - 1) * 100) + "%" : "—";
    }
  },

  /* ---------------- 渲染 ---------------- */
  render() {
    const wrap = $("#paper-list");
    if (!wrap || !this.pool) return;
    UI.clear(wrap);
    const gl = $("#paper-global");
    if (gl) { UI.clear(gl); gl.append(this.globalCard()); }
    const ca = $("#paper-cand-list");
    if (ca) {
      UI.clear(ca);
      this.VER_ORDER.forEach((v) => ca.append(this.candRow(v)));
      const cc = $("#paper-cand-count");
      if (cc) {
        const bad = this.candProblems();
        cc.textContent = bad.length ? "⚠ " + bad.join("；") : "引用全部有效";
        cc.style.color = bad.length ? "#ff6b6b" : "";
      }
    }
    const lg = $("#paper-legacy");
    if (lg) {
      UI.clear(lg);
      lg.append(h("div", { class: "dim", style: "font-size:12px;line-height:1.7;" },
        "旧档映射（只读，只增不删）：老存档里存的是字符串 id，读档时按此表换成数字 no。",
        h("br"), JSON.stringify(this.legacy || {})));
    }
    this.pool.forEach((p) => wrap.append(this.paperCard(p)));
    const cnt = $("#paper-count");
    if (cnt) cnt.textContent = this.pool.length + " 篇";
  },

  /* 只读展示：论文全局参数（真正改的地方在玩法配置页，避免两条写入路径） */
  globalCard() {
    const V = (((window.GameDefaults || {}).base || {}).V35) || {};
    const kv = (k, label, unit) => h("span", { class: "gcf-id", style: "margin-right:10px;" },
      label + " " + (V[k] != null ? V[k] : "?") + (unit || ""));
    return h("div", { class: "gcf-inline", style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center;" },
      h("span", { class: "dim", style: "font-size:12px;" }, "论文全局参数（只读 · 去【玩法配置 → 论文研究】改）："),
      kv("PAPER_RESEARCH_TICKS", "研究耗时", " tick"),
      kv("PAPER_TEXT_PROB", "旧·文字概率"),
      kv("PAPER_TEXT_ADD", "旧·文字加值"),
      kv("PAPER_DATA_SPEED_MUL", "旧·语料倍率"));
  },

  /* 阶段候选：下拉选一篇（只写数字 no） */
  candRow(ver) {
    const cur = (this.cands[ver] || [])[0];
    const sel = h("select", {}, ...[[null, "（不配 · 回落随机候选）"]].concat(
      this.pool.map((p) => [p.no, p.no + " " + (p.title || "")])).map(([v, l]) =>
        h("option", { value: v == null ? "" : String(v) }, l)));
    sel.value = cur == null ? "" : String(cur);
    sel.addEventListener("change", () => {
      if (!sel.value) delete this.cands[ver];
      else this.cands[ver] = [Number(sel.value)];
      this.markDirty();
      this.render();
    });
    const whoOwns = this.ownersOf(cur);
    return h("div", { class: "gcf-inline", style: "display:flex;gap:8px;align-items:center;margin:3px 0;" },
      h("span", { style: "flex:0 0 52px;font-size:12px;" }, ver),
      sel,
      h("span", { class: "dim", style: "font-size:11px;" },
        whoOwns.length === 1 ? "=" + whoOwns[0] + " 的钥匙？" : (whoOwns.length ? "被引用：" + whoOwns.join("/") : "")));
  },

  /* 引用了这篇论文的「架构钥匙」（反查，只读 —— 钥匙在【架构】页改） */
  ownersOf(no) {
    const archs = (((window.GameDefaults || {}).base || {}).ARCHITECTURES) || [];
    return archs.filter((a) => a.unlockPaper === no).map((a) => a.id);
  },

  /* 引用体检：候选里的 no 必须存在于池子（引用了不存在的论文 = 死链） */
  candProblems() {
    const bad = [];
    const nos = new Set(this.pool.map((p) => +p.no));
    Object.keys(this.cands || {}).forEach((v) => {
      (this.cands[v] || []).forEach((n) => { if (!nos.has(+n)) bad.push(v + " → " + n + " 不存在"); });
    });
    return bad;
  },

  paperCard(p) {
    const set = (fn) => { fn(); this.markDirty(); this.refreshPreview(p, card); };
    const idIn = h("input", { class: "gcf-id", value: String(p.no == null ? "" : p.no), title: "唯一 ID（4xxx 段，分配后永不变）" });
    idIn.addEventListener("change", () => set(() => { p.no = Number(idIn.value) || p.no; }));
    const keyIn = h("input", { class: "gcf-title", value: p.key || "", placeholder: "别名（位置键，仅调试用）" });
    keyIn.style.maxWidth = "130px";
    keyIn.addEventListener("input", () => set(() => { p.key = keyIn.value.trim() || null; }));
    const verSel = h("select", {}, ...[["", "（无阶段）"]].concat(this.VER_ORDER.map((v) => [v, v]))
      .map(([v, l]) => h("option", { value: v }, l)));
    verSel.value = p.ver || "";
    verSel.addEventListener("change", () => set(() => { if (verSel.value) p.ver = verSel.value; else delete p.ver; }));
    const bySel = h("select", {}, ...this.UNLOCK_BY.map(([v, l]) => h("option", { value: v }, l)));
    bySel.value = p.unlockBy || "study";
    bySel.addEventListener("change", () => set(() => { p.unlockBy = bySel.value; }));
    const del = h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;" }, "删除");
    del.addEventListener("click", () => {
      const owners = this.ownersOf(+p.no);
      if (owners.length && !confirm("有架构把这篇当钥匙（" + owners.join("/") + "），删了它们就永远解锁不了。仍要删除？")) return;
      this.pool = this.pool.filter((x) => x !== p);
      this.render();
      this.markDirty();
    });

    const titleIn = this.txtInput(p.title, (v) => set(() => { p.title = v; }), "论文标题");
    const venueIn = this.txtInput(p.venue, (v) => set(() => { p.venue = v; }), "期刊/来源");
    venueIn.style.maxWidth = "150px";
    const citeIn = this.txtInput(p.cite, (v) => set(() => { p.cite = v; }), "引用数");
    citeIn.style.maxWidth = "90px";
    const auIn = this.txtInput(p.authors, (v) => set(() => { p.authors = v; }), "作者");
    auIn.style.maxWidth = "150px";
    const tagIn = this.txtInput((p.tags || []).join(","), (v) => set(() => {
      p.tags = v.split(",").map((s) => s.trim()).filter(Boolean);
    }), "标签（逗号分隔）");
    const descTa = h("textarea", { class: "gcf-desc", rows: "2", placeholder: "论文简介（玩家看的那段话）" }, p.desc || "");
    descTa.addEventListener("input", () => { p.desc = descTa.value; this.markDirty(); });

    const weeksIn = h("input", { type: "number", value: p.weeks == null ? "" : String(p.weeks), style: "width:70px;", title: "旧口径研读周数（v35 引擎按 V35.PAPER_RESEARCH_TICKS 算）" });
    weeksIn.addEventListener("change", () => set(() => { const v = parseFloat(weeksIn.value); if (!isNaN(v)) p.weeks = v; }));

    const eff = this.effectRow(p, set);
    const pv = h("div", { class: "gcf-id", style: "margin-top:4px;color:#2b6cb0;" }, "效果预览：" + this.paperEffectText(p));
    const own = this.ownersOf(+p.no);
    const ownTag = own.length
      ? h("span", { class: "gcf-id", style: "color:#b7791f;", title: "钥匙在【架构】页改" }, "★ " + own.join("/") + " 的钥匙")
      : null;

    const card = h("div", { class: "gcf-event" },
      h("div", { class: "gcf-event-head ev-head" }, idIn, keyIn, verSel, bySel, ownTag, del),
      h("div", { class: "gcf-inline", style: "display:flex;gap:6px;width:100%;" }, titleIn, venueIn, citeIn, auIn),
      h("div", { class: "gcf-inline", style: "display:flex;gap:6px;width:100%;margin-top:4px;" }, tagIn, weeksIn),
      descTa, eff, pv);
    return card;
  },

  /* 效果编辑：类型下拉 + 该类型对应的数值字段（doc/32 §3「效果类型和数值分别给配置项」） */
  effectRow(p, set) {
    if (!p.effect) p.effect = { kind: "dim_bonus", dim: "code", add: 1 };
    const e = p.effect;
    const row = h("div", { class: "gcf-inline", style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px;" });

    const kindSel = h("select", {}, ...this.KINDS.map(([v, l]) => h("option", { value: v }, l)));
    kindSel.value = e.kind || "dim_bonus";
    kindSel.addEventListener("change", () => {
      /* 换类型时清掉旧参数（避免残留字段把文案算歪，也避免同步桥"只补不改"留下垃圾）。
         新类型的默认参数由下面 blank() 给。 */
      const k = kindSel.value;
      const blank = {
        extra_roll: { kind: k, scope: "all", prob: 0.05 },
        dim_bonus: { kind: k, dim: "code", add: 1 },
        role_energy: { kind: k, role: "pre", mul: 0.85 },
        axis_amp: { kind: k, axis: "memory", mul: 1.2 },
        axis_rate: { kind: k, axis: "memory", add: 0.05 },
        focus_mul: { kind: k, add: 0.2 },
        text_prob: { kind: k, prob: 0.1, add: 1 },
        data_speed: { kind: k, mul: 1.1 },
        energy: { kind: k, mul: 0.85 },
        prod: { kind: k, dim: "all", mul: 1.1 },
      };
      p.effect = this.clone(blank[k] || { kind: k });
      this.markDirty();
      this.render();
    });
    row.append(h("span", { class: "dim", style: "font-size:12px;" }, "效果"), kindSel);

    const numF = (label, key, step, val) => {
      const it = h("input", { type: "number", step: String(step), value: val == null ? "" : String(val), style: "width:76px;" });
      it.addEventListener("change", () => set(() => { const v = parseFloat(it.value); if (!isNaN(v)) e[key] = v; }));
      return h("label", { class: "gcf-inline", style: "gap:3px;" }, label, it);
    };
    const selF = (label, key, opts) => {
      const s = h("select", {}, ...opts.map(([v, l]) => h("option", { value: v }, l)));
      s.value = e[key] || opts[0][0];
      s.addEventListener("change", () => set(() => { e[key] = s.value; }));
      return h("label", { class: "gcf-inline", style: "gap:3px;" }, label, s);
    };

    switch (e.kind) {
      case "extra_roll":
        row.append(selF("岗位", "scope", this.SCOPES), numF("概率", "prob", 0.01, e.prob));
        break;
      case "dim_bonus":
        row.append(selF("维度", "dim", this.DIMS.filter(([v]) => v !== "all")), numF("每次 +", "add", 1, e.add));
        break;
      case "role_energy":
        row.append(selF("岗位", "role", this.ROLES), numF("体力倍率", "mul", 0.05, e.mul));
        break;
      case "axis_amp":
        row.append(selF("轴", "axis", this.AXES), numF("倍率", "mul", 0.05, e.mul));
        break;
      case "axis_rate":
        row.append(selF("轴", "axis", this.AXES), numF("概率 +", "add", 0.01, e.add));
        break;
      case "focus_mul":
        row.append(numF("加成 +", "add", 0.05, e.add));
        break;
      case "text_prob":
        row.append(numF("概率", "prob", 0.01, e.prob), numF("每次 +", "add", 1, e.add));
        break;
      case "data_speed":
      case "energy":
        row.append(numF("倍率", "mul", 0.05, e.mul));
        break;
      case "prod":
        row.append(selF("维度", "dim", this.DIMS), numF("倍率", "mul", 0.05, e.mul));
        break;
      default:
        row.append(numF("倍率", "mul", 0.05, e.mul));
    }
    return row;
  },

  refreshPreview(p, card) { this.render(); },

  txtInput(val, onchg, placeholder, cls) {
    const inp = h("input", { class: cls || "gcf-title", value: val == null ? "" : String(val), placeholder: placeholder || "" });
    inp.addEventListener("input", () => onchg(inp.value));
    return inp;
  },

  /* ---------------- 保存（整区：section = "PAPER"） ---------------- */
  async save({ silent = false } = {}) {
    const payload = { POOL: this.pool, CANDIDATES_BY_VER: this.cands };
    if (this.legacy && Object.keys(this.legacy).length) payload.LEGACY_NO = this.legacy;
    try {
      const r = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "PAPER", config: payload,
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      if (window.CfgSync) CfgSync.update(d.mtime);
      if (!silent) UI.toast("论文配置已保存并同步到游戏");
    } catch (e) {
      if (silent) throw e;
      UI.toast("保存失败：" + e.message, "err");
    }
  },
};
