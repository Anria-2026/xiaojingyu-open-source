/* ============================================================
   GameBus —— 玩法扩展模块之间的轻量事件总线（2026-10-01）
   --------------------------------------------------------------------------
   为什么要它：委托、好感、对手 AI、装修等扩展模块都要知道「过了一周」
   「玩家点了什么」「鲸鱼娘被放到哪」。与其各自去改 game_ui.js / game_core.js
   的主流程（8700 行，合并冲突大户），不如统一从这里订阅。

   标准事件（payload 字段）：
     ui:action     { action, id, el }        任意 [data-action] 元素被点击（包在 GameUI.onClick 外层）
     week:start    { absWeek, ver }          绝对周数变化（1Hz 轮询，页面隐藏时不跑）
     stage:start   { ver, prev }             阶段（ver）变化
     phase         { phase, prev }           GameCore.state.phase 变化
     whale:tap     {}                         办公室鲸鱼娘被轻点（拖动模块发出）
     whale:drop    { x, y }                   鲸鱼娘被放下；只记录位置
     arcade:result { kind, grade, score, practice, aborted }
     event:resolved{ key, no, opt, rival }    随机事件玩家选完选项（对手 AI 模块发出）

   约定：订阅方回调里抛错不会影响主流程（逐个 try/catch）。
   ============================================================ */
(function () {
  if (window.GameBus) return;

  const subs = Object.create(null);

  const GameBus = {
    on(type, fn) {
      (subs[type] || (subs[type] = [])).push(fn);
      return () => this.off(type, fn);
    },
    off(type, fn) {
      const list = subs[type];
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    once(type, fn) {
      const off = this.on(type, (p) => { off(); fn(p); });
      return off;
    },
    emit(type, payload) {
      const list = subs[type];
      if (!list || !list.length) return;
      for (const fn of list.slice()) {
        try { fn(payload || {}); } catch (e) { console.warn("[GameBus] " + type + " 订阅方出错", e); }
      }
    },
  };

  /* ---- ui:action：包一层 GameUI.onClick（GameUI 用箭头函数转发，调用时才查方法，所以后包也生效） ---- */
  function wrapUi() {
    const ui = window.GameUI;
    if (!ui || typeof ui.onClick !== "function" || ui.__busWrapped) return !!(ui && ui.__busWrapped);
    const orig = ui.onClick;
    ui.onClick = function (e) {
      const r = orig.apply(this, arguments);
      try {
        const t = e && e.target && e.target.closest && e.target.closest("[data-action]");
        if (t) GameBus.emit("ui:action", { action: t.dataset.action, id: t.dataset.id, el: t });
      } catch (err) { /* 忽略 */ }
      return r;
    };
    ui.__busWrapped = true;
    return true;
  }

  /* ---- 状态轮询：周 / 阶段 / phase 变化（1Hz，页面隐藏时跳过） ---- */
  let last = { absWeek: null, ver: null, phase: null, state: null };
  function poll(force) {
    wrapUi();
    if (!force && document.visibilityState === "hidden") return;
    const ui = window.GameUI;
    const s = ui && ui.core && ui.core.state;
    if (!s) return;
    if (last.state !== s) {            // 新局 / 读档：重置基线，不补发历史事件
      last = { absWeek: null, ver: null, phase: null, state: s };
    }
    const absWeek = (s.week || 0) + (s.weekOffset || 0);
    const ver = s.ver || "V1";
    if (last.phase !== s.phase) {
      const prev = last.phase; last.phase = s.phase;
      if (prev !== null) GameBus.emit("phase", { phase: s.phase, prev });
    }
    if (last.ver !== ver) {
      const prev = last.ver; last.ver = ver;
      if (prev !== null) GameBus.emit("stage:start", { ver, prev });
    }
    if (last.absWeek !== absWeek) {
      const prev = last.absWeek; last.absWeek = absWeek;
      if (prev !== null && absWeek > prev) GameBus.emit("week:start", { absWeek, ver });
    }
  }

  GameBus._poll = () => poll(true);   // 测试用：手动推进（忽略页面可见性）
  GameBus._wrapUi = wrapUi;
  window.GameBus = GameBus;
  wrapUi();                           // game_bus.js 在 game_ui.js 之后加载，能包就立刻包
  /* Node/jsdom 测试里别让定时器拖住进程退出 */
  if (typeof setInterval === "function" && !window.__GAMEBUS_NO_TIMER) {
    const iv = setInterval(() => poll(false), 1000);
    if (iv && typeof iv.unref === "function") iv.unref();
  }
})();
