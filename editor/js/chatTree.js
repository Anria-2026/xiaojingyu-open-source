/* ==========================================================================
   鲸鱼剧本配置页 · **数据层**（doc/29 · 选项树 · ID 关联 · 条件系统）
   --------------------------------------------------------------------------
   ⚠️ 2026-09-19 大清理：本文件原本还带一整套「老表单式 UI」（statusCard / notesCard /
   optCard / ansRow / condEditor / addOpt + 一堆只服务它们的辅助：st / opts / _maxId /
   nextOptId / nextAnsId / nextNoteId / optChoices / ansChoices / TIERS / TYPES / CONDS / q / ver）。
   自 2026-09-19 起 `render()` 第一行就把渲染交给**可视化编辑器** `window.ChatTreeView`，
   那套 UI 再也执行不到（DOM 里的 #chattree-root / #chattree-verbar / #chattree-add 也已删除）
   ⇒ 已整体删除，本文件只剩**数据与 IO**四件事：
        init()   绑「校验」按钮 + 首次载入
        refresh() 从 /api/game-cfg 拉配置 → 落成工作副本 this.data（再交给 ChatTreeView 画）
        validate() 结构与引用体检（写进 #chattree-result 面板）
        save()   把 ChatTreeView 的改动 syncBack 回 data → 分区 CHAT_TREE2 整区替换保存
   ⇒ **不要在这里加 UI 代码**：画布/属性面板/连线全在 `editor/js/chatTreeView.js`
     （由 `tools/gen_editor_chat_tree.js` 从 `tools/chat_tree_demo_shell.html` 生成）。

   ▍数据结构（引擎侧真源，改之前先读 doc/29）
     BY_VER[阶段] = {
       status: { dumb:[], full:[] },                 // 状态行：按档位各若干句（随机取一）
       opts: { "10001": {                            // 选项 = **玩家说的话**（树的节点）
         text,                                       //   内容（可用 {model}/{param}/{arch} 占位）
         start,                                      //   开场时是否出现（与 cond 是 OR）
         cond,                                       //   出现条件：none/prevAns/prevOpt/note/noNote/flag
         next,                                       //   走向：continue / start(回开场) / end(结束)
         ans: { dumb:[], full:[] }                   //   回答：分两档（未开智/开智），每条可带条件与类型
       } }
     }
     NOTES = { "1001": { name, text } }              // 记事本（**只有 ID，没有兼容用的别名了**）
     回答元素 = { id, type:"text|cot|think|image|audio|video|link", text|src|steps|post, cond, status, noteFor, who, artifact, act, think? }
   ▍ID 约定（全系统唯一）：选项 10001+ / 回答 20001+ / 记事本 1001+
   ▍保存 = 分区 CHAT_TREE2 **整区替换**（删条目能生效 —— 稀疏 diff 会在数组上留旧尾巴）
   ▍文案占位符：{model} 模型名 · {param} 参数档 · {arch}/{archName} 架构名 · {archId} 架构代号
     （引擎侧唯一实现 core.fillVars；编辑器里文案字段的候选项见 ChatTreeView 的输入提示）
   ▍回答类型与条件的**枚举真源在 ChatTreeView**（画布上的下拉），本文件不再各存一份
   ========================================================================== */
"use strict";

window.ChatTreeTool = {
  data: null,          // 工作副本 { NOTES, BY_VER }
  VER_ORDER: ["V1", "V1.5", "V2", "V2.5", "V3", "V3.5", "V4", "V4.5"],

  /* ---------------------------------------------------------------- 数据 */
  async refresh() {
    let saved = {};
    try {
      const r = await (await fetch("/api/game-cfg")).json();
      if (window.CfgSync) CfgSync.note(r);
      saved = r.config || {};
    } catch (e) { /* 离线回落默认 */ }
    const G = window.GameDefaults || {};
    const def = G.base || G;
    const pick = (saved.CHAT_TREE2 && saved.CHAT_TREE2.BY_VER) ? saved.CHAT_TREE2
      : ((def.CHAT_TREE2 && def.CHAT_TREE2.BY_VER) ? def.CHAT_TREE2 : { NOTES: {}, BY_VER: {} });
    this.data = this.clone(pick);
    this.render();
  },
  clone(o) {
    return o === null || typeof o !== "object" ? o : (Array.isArray(o) ? o.map((x) => this.clone(x)) :
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, this.clone(v)])));
  },
  notes() { return this.data.NOTES = this.data.NOTES || {}; },
  noteChoices() { return Object.keys(this.notes()).sort((a, b) => (+a) - (+b)); },

  /* ---------------------------------------------------------------- 启动 */
  init() {
    /* ⚠️ 2026-09-19：原「＋ 新增选项」按钮（#chattree-add）随老表单 UI 删除 ——
       新界面里加选项在画布上（阶段右上角 ＋）。这里只留「校验」。 */
    const va = $("#chattree-validate");
    if (va) va.addEventListener("click", () => this.validate());
    this.refresh();
  },

  /* ---------------------------------------------------------------- 渲染 */
  render() {
    /* 渲染**全部**交给可视化编辑器（ChatTreeView）。
       这里不再有回落 UI：那条路 2026-09-19 已随 dom 一起删除，留着只会变成"整套死代码"。 */
    if (window.ChatTreeView) return window.ChatTreeView.mount(this);
    console.error("[ChatTreeTool] ChatTreeView 没加载（checklist: editor/index.html 是否引入了 chatTreeView.js）");
  },

  /* ---------------------------------------------------------------- 校验 */
  /* 体检：ID 重复 / 空内容 / 悬空引用 / 类型缺字段 —— 结果写进顶部的 #chattree-result 面板。
     ⚠️ 2026-09-19 修：面板 id 在新 DOM 里**一度不存在** ⇒ validate() 一进门就 return，
     按钮点了**完全没反应**（静默失效）。现在面板由 ChatTreeView 的 DOM 提供，这里只负责填。 */
  validate() {
    const box = $("#chattree-result");
    if (!box) return;
    UI.clear(box);
    const errs = [], warns = [];
    const seen = new Set(), allOpt = new Set(), allAns = new Set();
    /* 回答连回答（`then` 链 · 2026-09-21）的**递归展平**（深度优先前序）+ 环检测。
       返回 [{a, depth, cycle}]；同一对象在链上出现两次 = 成环（按对象引用判，跨根不误报）。 */
    const flattenThen = (node, out, seenRefs, depth) => {
      out = out || []; seenRefs = seenRefs || new Set(); depth = depth || 0;
      if (!node || typeof node !== "object") return out;
      if (seenRefs.has(node)) { out.push({ a: node, depth: depth, cycle: true }); return out; }
      seenRefs.add(node);
      out.push({ a: node, depth: depth, cycle: false });
      (Array.isArray(node.then) ? node.then : []).forEach((s) => flattenThen(s, out, seenRefs, depth + 1));
      return out;
    };
    Object.keys(this.data.BY_VER || {}).forEach((v) => {
      const t = this.data.BY_VER[v] || {};
      Object.keys(t.opts || {}).forEach((oid) => {
        allOpt.add(oid);
        const an = t.opts[oid].ans || {};
        ["dumb", "full"].forEach((k) => (an[k] || []).forEach((a) => {
          /* 链上回答**也是回答** —— id 同样全树唯一，而且**可以被 cond 引用**
             （引擎的落点是链尾 ⇒ 后续选项就该指向链尾 id）。任意层都要收进来。 */
          flattenThen(a).forEach((e) => { if (e.a.id != null) allAns.add(String(e.a.id)); });
        }));
      });
    });
    const noteIds = this.noteChoices();
    const chkCond = (v, where, c) => {
      if (!c) return;
      if ((c.type === "prevAns" || c.type === "prevOpt") && !(c.ids || []).length) errs.push(v + " " + where + "：选了条件但没选具体 ID");
      if (c.type === "prevAns") (c.ids || []).forEach((x) => { if (!allAns.has(String(x))) errs.push(v + " " + where + "：引用了不存在的回答 ID " + x); });
      if (c.type === "prevOpt") (c.ids || []).forEach((x) => { if (!allOpt.has(String(x))) errs.push(v + " " + where + "：引用了不存在的选项 ID " + x); });
      if ((c.type === "note" || c.type === "noNote") && c.id != null && noteIds.indexOf(String(c.id)) < 0) errs.push(v + " " + where + "：引用了不存在的记事本 " + c.id);
    };
    Object.keys(this.data.BY_VER || {}).forEach((v) => {
      const t = this.data.BY_VER[v] || {};
      const ids = Object.keys(t.opts || {});
      if (!ids.length) { warns.push(v + "：还没有任何选项"); return; }
      if (!ids.some((k) => t.opts[k].start)) warns.push(v + "：没有「开场时显示」的选项 → 玩家进不去");
      ids.forEach((oid) => {
        const o = t.opts[oid];
        if (seen.has(oid)) errs.push("选项 ID 重复：" + oid); else seen.add(oid);
        if (!String(o.text || "").trim()) errs.push(v + " 选项 " + oid + "：内容为空");
        chkCond(v, "选项 " + oid, o.cond);
        if (o.next === "continue") {
          const total = ["dumb", "full"].reduce((n, k) => n + ((o.ans || {})[k] || []).length, 0);
          if (!total) warns.push(v + " 选项 " + oid + "「" + o.text + "」：一条回答都没配 → 会走咕嘎池");
        }
        ["dumb", "full"].forEach((k) => ((o.ans || {})[k] || []).forEach((a0) => {
          /* 回答连回答（`then` 链）：主回答 + 链上回答（**任意层**）一起校验 */
          flattenThen(a0).forEach(({ a, depth, cycle }) => {
          if (cycle) { errs.push(v + " 回答 " + a.id + "：连播链连成了环（会无限循环播放）"); return; }
          if (seen.has(String(a.id))) errs.push("回答 ID 重复：" + a.id); else seen.add(String(a.id));
          chkCond(v, "回答 " + a.id, a.cond);
          const isMedia = a.type === "image" || a.type === "audio" || a.type === "video";
          if (isMedia && !String(a.src || "").trim()) errs.push(v + " 回答 " + a.id + "：类型是" + a.type + " 但没指定文件");
          if ((!a.type || a.type === "text") && !String(a.text || "").trim()) errs.push(v + " 回答 " + a.id + "：文本内容为空");
          if (a.type === "cot") {
            const empty = !String(a.pre || "").trim() && !((a.steps || []).length) && !String(a.post || "").trim();
            if (empty) errs.push(v + " 回答 " + a.id + "：COT 类型但「前 / 标识 / 后」全是空的");
            else if (!String(a.post || "").trim()) warns.push(v + " 回答 " + a.id + "：COT 没配「后文本」，标识播完就没了收尾");
          }
          if (a.type === "think") {
            if (!((a.steps || []).length)) errs.push(v + " 回答 " + a.id + "：思考框类型但「思考」正文是空的（展开后是个空盒子）");
            else if (!String(a.post || "").trim()) warns.push(v + " 回答 " + a.id + "：思考框没配「正文」，展开完就没了她最后那句话");
          }
          /* 链接类型（2026-09-13）：没填网址 = 玩家看到一张点了没反应的卡 → 直接报错拦住 */
          if (a.type === "link" && !String(a.url || "").trim()) {
            errs.push(v + " 回答 " + a.id + "：类型是 link 但没填网址（玩家会看到一张点了没反应的卡）");
          }
          if (a.noteFor && noteIds.indexOf(String(a.noteFor)) < 0) errs.push(v + " 回答 " + a.id + "：解锁了不存在的记事本 " + a.noteFor);
          /* 链上回答（depth>0）的硬规矩：链上**必播** ⇒ 不能配条件 */
          if (depth > 0) {
            if (a.cond && a.cond.type && a.cond.type !== "fallback") {
              errs.push(v + " 回答 " + a.id + "：它在连播链上（必播），不能配条件");
            }
          }
          });
        }));
      });
    });
    const summary = (errs.length ? "✗ " + errs.length + " 处错误" : "✓ 校验通过")
      + " · 警告 " + warns.length + "（选项 " + allOpt.size + " · 回答 " + allAns.size + " · 记事本 " + noteIds.length + "）";
    box.hidden = false;                                     // 有内容才露出来（DOM 里默认 hidden）
    box.append(h("div", { class: errs.length ? "hd err" : "hd ok" }, summary));
    errs.slice(0, 40).forEach((e) => box.append(h("div", { class: "err" }, e)));
    warns.slice(0, 40).forEach((w) => box.append(h("div", { class: "warn" }, "⚠ " + w)));
    /* 面板在画布左下角，可能不在视野里 ⇒ 再给一声**简短**的即时反馈
       （别把整条 summary 复读一遍 —— 面板里已经有全文了） */
    UI.toast(errs.length ? ("✗ 校验发现 " + errs.length + " 处错误（见左下清单）")
      : ("✓ 校验通过 · 警告 " + warns.length), errs.length ? "err" : "ok");
    box.scrollTop = 0;
  },

  /* ---------------------------------------------------------------- 保存 */
  async save({ silent = false } = {}) {
    if (window.ChatTreeView) window.ChatTreeView.syncBack();   // 把画布上的改动写回 data
    try {
      const r = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "CHAT_TREE2", config: this.data,
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      if (window.CfgSync) CfgSync.update(d.mtime);
      if (!silent) UI.toast("🐳 对话树（新结构）已保存并同步到游戏");
      return true;
    } catch (e) {
      if (!silent) UI.toast("保存失败：" + e.message, "err");
      return false;
    }
  },
};
