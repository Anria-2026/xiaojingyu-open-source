/* ==========================================================================
   文本配置页（2026-09-03 新增）
   --------------------------------------------------------------------------
   检索游戏内所有说明文本 / 剧情文本：输入关键词实时过滤，找到后直接在
   文本框里改，点底部「保存修改」一次性落盘同步到游戏。
   覆盖的文本源（均已在游戏内实装使用）：
   - EVENTS   事件池（title / desc / options[].text）
   - TUTORIAL 教学弹窗（title / lines[]）
   - EMPTY_STATES 二级面板空态文案（text）
   - MODEL_NAME_SUGGEST 起名界面建议名
   保存：EVENTS 走独立分区整区替换；其余走 base 浅合并（顶层 key 覆盖）。
   ========================================================================== */
"use strict";

window.TextTool = {
  cfg: null,        // 整份配置（引用式修改）
  entries: [],      // 文本索引 [{sec, key, label, get, set, dirty}]
  kw: "",
  loaded: false,

  async refresh() {
    try {
      const j = await (await fetch("/api/game-cfg")).json();
      if (window.CfgSync) CfgSync.note(j);
      this.cfg = j.config || {};
    } catch (e) {
      this.cfg = {};
    }
    this.buildIndex();
    this.loaded = true;
    this.render();
  },

  init() { this.refresh(); },

  /* 把所有可编辑文本建成扁平索引，每个条目引用原对象（改值 = 直接改配置） */
  buildIndex() {
    const c = this.cfg;
    const E = [];
    /* del：可删条目的删除回调（目前只有起名建议名用 —— 2026-09-22） */
    const push = (sec, label, get, set, del) => E.push({ sec, label, get, set, del: del || null, dirty: false });

    (c.EVENTS || []).forEach((ev, i) => {
      const who = () => `事件 ${ev.id}「${ev.title || ""}」`;
      push("EVENTS", () => `${who()} · 标题`, () => ev.title || "", (v) => { ev.title = v; });
      push("EVENTS", () => `${who()} · 正文`, () => ev.desc || "", (v) => { ev.desc = v; });
      (ev.options || []).forEach((o, j) => {
        push("EVENTS", () => `${who()} · 选项 ${j + 1}`, () => o.text || "", (v) => { o.text = v; });
      });
    });

    (c.TUTORIAL || []).forEach((t) => {
      const who = () => `教学「${t.title || t.id}」`;
      push("TUTORIAL", () => `${who()} · 标题`, () => t.title || "", (v) => { t.title = v; });
      (t.lines || []).forEach((_, j) => {
        push("TUTORIAL", () => `${who()} · 第 ${j + 1} 段`, () => t.lines[j] || "", (v) => { t.lines[j] = v; });
      });
    });


    Object.keys(c.EMPTY_STATES || {}).forEach((k) => {
      const st = c.EMPTY_STATES[k];
      push("EMPTY_STATES", () => `空态文案 · ${k}`, () => st.text || "", (v) => { st.text = v; });
    });

    /* 起名建议名（2026-09-22 用户：「改成让我预设 N 个不同选项让玩家选」）——
       游戏内命名页已改成「只能从预设里挑」，所以项数要能自由增减：
       以前这里只 forEach 现成数组（只能改值），想从 12 个缩到 8 个都办不到。
       ⚠️ 增删后必须 buildIndex() 重建索引：条目是**按下标闭包**的，
          删掉 #3 之后 #4 起全部指错位置（改一个字会写到隔壁）。
       ⚠️ 重建会把 dirty 清掉 ⇒ 手动把本区标 dirty，否则「保存修改」认不出改动。 */
    (c.MODEL_NAME_SUGGEST || []).forEach((_, i) => {
      push("MODEL_NAME_SUGGEST", () => `建议名 #${i + 1}`,
        () => c.MODEL_NAME_SUGGEST[i] || "",
        (v) => { c.MODEL_NAME_SUGGEST[i] = v; },
        () => {
          const gone = c.MODEL_NAME_SUGGEST.splice(i, 1)[0];
          this.buildIndex();
          this.entries.filter((e) => e.sec === "MODEL_NAME_SUGGEST").forEach((e) => { e.dirty = true; });
          this.render();
          UI.toast(`已删除建议名「${gone}」，记得点保存修改`);
        });
    });

    /* ---- 工程师气泡台词池（2026-09-03）：正常 / 疲惫 / 下班 / 攻关 ---- */
    [
      ["WORK_BUBBLES", "工作台词"],
      ["WORK_BUBBLES_TIRED", "疲惫台词（体力<30）"],
      ["WORK_BUBBLES_OFFWORK", "下班台词（下班窗口）"],
      ["WORK_BUBBLES_FOCUS", "攻关台词"],
    ].forEach(([key, label]) => {
      (c[key] || []).forEach((_, j) => {
        push(key, () => `气泡 · ${label} #${j + 1}`,
          () => c[key][j] || "",
          (v) => { c[key][j] = v; });
      });
    });

    /* ---- 节点提示文案（2026-09-03）：与「新闻与提示」页联动，这里只改文案 ---- */
    (c.OFFICE_HINTS || []).forEach((ht) => {
      push("OFFICE_HINTS", () => `节点提示 ${ht.id || ""}（${ht.type || ""}）`,
        () => ht.text || "",
        (v) => { ht.text = v; });
    });

    /* ---- 鲸华社新闻账号（2026-09-03）：账号名可改，头像路径走配置文件 NEWS_ACCOUNT.avatar ---- */
    if (c.NEWS_ACCOUNT) {
      push("NEWS_ACCOUNT", () => `新闻账号 · 名字（头像路径在 NEWS_ACCOUNT.avatar）`,
        () => c.NEWS_ACCOUNT.name || "",
        (v) => { c.NEWS_ACCOUNT.name = v; });
    }

    this.entries = E;
  },

  dirtyCount() { return this.entries.filter((e) => e.dirty).length; },

  /* 过滤：关键词匹配文本内容或上下文标签（不区分大小写） */
  matched() {
    const kw = this.kw.trim().toLowerCase();
    if (!kw) return [];
    return this.entries.filter((e) => {
      const hay = (e.get() + " " + e.label()).toLowerCase();
      return hay.includes(kw);
    });
  },

  render() {
    const wrap = $("#textq-list");
    if (!wrap) return;
    UI.clear(wrap);

    /* 搜索框 + 计数 */
    const bar = h("div", { class: "textq-bar" },
      h("input", {
        class: "textq-kw", type: "text", id: "textq-kw",
        placeholder: "输入关键词实时检索（如：评审 / 挖角 / 你好 / 还没开智…）",
        value: this.kw,
      }),
      h("span", { class: "textq-count dim" },
        this.kw.trim() ? `命中 ${this.matched().length} 条` : `共 ${this.entries.length} 条文本，输入关键词开始检索`));
    const kwIn = bar.querySelector("#textq-kw");
    kwIn.addEventListener("input", () => {
      this.kw = kwIn.value;
      renderResults();
      const cnt = wrap.querySelector(".textq-count");
      if (cnt) cnt.textContent = this.kw.trim() ? `命中 ${this.matched().length} 条` : `共 ${this.entries.length} 条文本，输入关键词开始检索`;
    });

    const results = h("div", { class: "textq-results" });
    const renderResults = () => {
      UI.clear(results);
      const list = this.matched();
      if (!this.kw.trim()) {
        results.append(h("div", { class: "textq-empty dim" },
          "支持检索：事件标题/正文/选项 · 教学弹窗 · 测试问答 · 空态文案 · 起名建议名（搜「建议名」可增删）"));
        return;
      }
      if (!list.length) {
        results.append(h("div", { class: "textq-empty dim" }, "没有匹配的文本"));
        return;
      }
      let lastSec = "";
      list.forEach((e, idx) => {
        if (e.sec !== lastSec) {
          lastSec = e.sec;
          results.append(h("div", { class: "textq-sec" }, e.sec));
        }
        const ta = h("textarea", { class: "textq-ta", rows: "2" });
        ta.value = e.get();
        ta.addEventListener("input", () => {
          e.set(ta.value);
          e.dirty = true;
          ta.closest(".textq-item").classList.add("dirty");
          const btn = wrap.querySelector("#textq-save");
          if (btn) { btn.textContent = `💾 保存修改（${this.dirtyCount()} 处）`; btn.disabled = false; }
        });
        /* 可删条目右侧挂删除键（2026-09-22）。**至少留一项** —— 预设名池空掉的话游戏里
           就没得挑了（命名页虽有空态兜底，但那是配置事故，不该从 UI 上顺手做出来）。
           ⚠️ 判据要用全量 entries，不能用当前**搜索结果** —— 搜到 1 条时 list 里只有 1 条，
              会误判成"只剩一个"而把删除键锁死。 */
        const canDel = e.del && this.entries.filter((x) => x.sec === e.sec).length > 1;
        const delBtn = e.del ? h("button", {
          class: "textq-del", type: "button",
          title: canDel ? "删除这一项" : "至少要留一个名字",
          disabled: canDel ? null : "",
          onclick: canDel ? e.del : null,
        }, "✕") : null;
        results.append(h("div", { class: "textq-item" + (e.dirty ? " dirty" : "") },
          h("div", { class: "textq-label" }, e.label(), delBtn),
          ta));
        /* 建议名这一区的末尾追加「＋ 添加一个名字」（只在搜到该区时出现） */
        const next = list[idx + 1];
        if (e.sec === "MODEL_NAME_SUGGEST" && (!next || next.sec !== "MODEL_NAME_SUGGEST")) {
          results.append(h("button", {
            class: "btn textq-add", type: "button",
            onclick: () => {
              this.cfg.MODEL_NAME_SUGGEST.push("");
              this.buildIndex();
              this.entries.filter((x) => x.sec === "MODEL_NAME_SUGGEST").forEach((x) => { x.dirty = true; });
              this.render();
              UI.toast("已添加一个空名字，填好后记得点保存修改");
            },
          }, "＋ 添加一个名字"));
        }
      });
    };
    renderResults();

    const saveBtn = h("button", { class: "btn btn-primary", id: "textq-save", disabled: "" },
      `💾 保存修改${this.dirtyCount() ? `（${this.dirtyCount()} 处）` : ""}`);
    saveBtn.addEventListener("click", () => this.save());

    wrap.append(bar, results, h("div", { class: "textq-foot" }, saveBtn));
  },

  /* 保存：EVENTS 整区替换；其余 base 顶层 key 覆盖（只提交被改过的区） */
  async save({ silent = false } = {}) {
    if (!this.dirtyCount()) { UI.toast("没有需要保存的修改"); return; }
    try {
      const dirtySecs = new Set(this.entries.filter((e) => e.dirty).map((e) => e.sec));
      const baseKeys = ["TUTORIAL", "EMPTY_STATES", "MODEL_NAME_SUGGEST"];
      for (const sec of dirtySecs) {
        const body = baseKeys.includes(sec)
          ? { section: "base", config: { [sec]: JSON.parse(JSON.stringify(this.cfg[sec])) } }
          : { section: sec, config: JSON.parse(JSON.stringify(this.cfg[sec])) };
        if (window.CfgSync) body.expectMtime = CfgSync.expect();
        const r = await fetch("/api/game-cfg-save", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json();
        if (!d.ok) throw new Error(`${sec}：` + (d.error || "未知错误"));
        if (window.CfgSync) CfgSync.update(d.mtime);
      }
      this.entries.forEach((e) => { e.dirty = false; });
      if (!silent) UI.toast("文本修改已保存并同步到游戏");
      this.render();
    } catch (e) {
      if (silent) throw e;
      UI.toast("保存失败：" + e.message, "err");
    }
  },
};
