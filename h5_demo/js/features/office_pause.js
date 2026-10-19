/* 办公室暂停所有权：每个来源只释放自己的暂停，运行期 token 不写入存档。 */
(function () {
  "use strict";
  if (window.OfficePause) return;
  const records = new WeakMap();
  const installed = new WeakSet();
  const installedUI = new WeakSet();
  const notices = new WeakMap();
  const log = [];
  let debug = !!window.__OFFICE_PAUSE_DEBUG;
  let sequence = 0;
  const passive = !!window.__OFFICE_PAUSE_PASSIVE;

  function stack() { return new Error("officePaused write").stack || ""; }
  function inferred(trace) {
    for (const name of ["showOfficeEvent", "showMinigameSpawn", "startMinigame", "finishMinigame", "onClick", "loadState", "startProject"]) {
      if (trace.includes(name)) return "legacy:" + name;
    }
    const caller = trace.split("\n").find(line => /game_(ui|core)\.js/.test(line));
    return caller ? "direct-write:" + caller.trim() : "direct-write";
  }
  function report(core, r, source, previous, requested, next, trace) {
    if (!debug) return;
    const s = r.state;
    const row = { no: ++sequence, at: Date.now(), source, previous, requested, next,
      changed: previous !== next, phase: s.phase, ver: s.ver, tickAt: s._tickAt || 0,
      mgWasPaused: s._mgWasPaused == null ? null : !!s._mgWasPaused,
      manual: r.manual, sources: Array.from(r.tokens.values()), stack: trace || stack() };
    log.push(row);
    if (log.length > 1000) log.shift();
    if (window.console && console.debug) console.debug("[officePaused]", row);
  }
  function commit(core, r, source, requested, trace) {
    const previous = r.actual;
    const next = passive ? !!requested : !!(r.manual || r.tokens.size);
    // 先按旧暂停态结算到当前真实时间，然后改变暂停位；速度模块从不写暂停。
    if (previous !== next && window.OfficeSpeed && OfficeSpeed.pauseChange) {
      OfficeSpeed.pauseChange(core, Date.now(), previous, next);
    }
    if (previous !== next && window.WhalebeeClock) WhalebeeClock.pauseChange(core, Date.now(), next);
    r.actual = next;
    if (previous !== next) r.pausedAt = next ? Date.now() : null;
    report(core, r, source, previous, !!requested, next, trace);
    const ui = window.GameUI;
    if (ui && ui.core === core) {
      decorate(ui);
      if (window.OfficeSpeed) OfficeSpeed.refresh(ui);
    }
  }
  function observe(core) {
    const s = core && core.state;
    if (!s || typeof s !== "object") return null;
    let r = records.get(s);
    if (r) return r;
    r = { state: s, manual: !!s.officePaused, actual: !!s.officePaused,
      tokens: new Map(), pausedAt: s.officePaused ? Date.now() : null, epoch: 0 };
    records.set(s, r);
    Object.defineProperty(s, "officePaused", { configurable: true, enumerable: true,
      get() { return r.actual; },
      set(value) {
        const trace = debug ? stack() : "";
        r.manual = !!value;
        commit(core, r, inferred(trace), value, trace);
      },
    });
    return r;
  }
  function acquire(core, source) {
    const r = observe(core);
    if (!r) return function () {};
    const key = {}, epoch = r.epoch;
    const label = String(source || "feature");
    r.tokens.set(key, label);
    commit(core, r, label + ":acquire", true);
    let released = false;
    return function () {
      if (released) return;
      released = true;
      if (core.state !== r.state || epoch !== r.epoch) return;
      r.tokens.delete(key);
      commit(core, r, label + ":release", false);
    };
  }
  function releaseSource(core, source) {
    const r = observe(core);
    if (!r) return;
    for (const [key, label] of r.tokens) if (label === source) r.tokens.delete(key);
    commit(core, r, source + ":release", false);
  }
  function setManual(core, value) {
    const r = observe(core);
    if (!r) return false;
    r.manual = !!value;
    commit(core, r, "manual:" + (r.manual ? "pause" : "resume"), r.manual);
    return r.manual;
  }
  function reset(core, source) {
    const r = observe(core);
    if (!r) return;
    r.tokens.clear(); r.manual = false; r.epoch++;
    commit(core, r, source || "lifecycle:reset", false);
    if ("_mgWasPaused" in r.state) r.state._mgWasPaused = null;
    if (window.OfficeSpeed && OfficeSpeed.reset) OfficeSpeed.reset(core);
  }
  function install(core) {
    core = core || window.GameCore;
    if (!core || installed.has(core)) return;
    installed.add(core);
    let current = core.state;
    Object.defineProperty(core, "state", { configurable: true, enumerable: true,
      get() { return current; },
      set(value) {
        const previousState = current, previousPaused = !!(current && current.officePaused);
        if (current && current !== value && !passive) {
          const old = records.get(current);
          if (old) { old.epoch++; old.tokens.clear(); }
        }
        current = value;
        const r = observe(core);
        if (r && !passive && r.actual !== !!(r.manual || r.tokens.size)) commit(core, r, "lifecycle:state-reattached", r.manual);
        if (r && previousState !== current && previousPaused !== r.actual) {
          report(core, r, "lifecycle:state-replaced", previousPaused, r.actual, r.actual);
        }
      },
    });
    observe(core);
    if (passive) return;
    // 读档/新阶段是原版已有的运行期暂停清理边界，不将旧 token 带入新会话。
    for (const name of ["loadState", "_enterStage", "startProject"]) {
      const original = core[name];
      if (typeof original !== "function") continue;
      core[name] = function () {
        const result = original.apply(this, arguments);
        reset(this, "lifecycle:" + name);
        if (name === "loadState" && this.state.minigame && this.state.phase === "office") {
          // 巡检正文在原版存档中可继续；恢复其真实所有者，绝不沿用旧暂停快照。
          acquire(this, "inspection");
        } else if (name === "_enterStage" && this.state.minigame) {
          this.state.minigame = null;
        }
        return result;
      };
    }
  }
  const sourceNames = { event: "事件处理中", "event-notice": "事件处理中",
    inspection: "巡检小游戏中", arcade: "小游戏中", "whale-room": "鲸鱼房" };
  function status(core) {
    const r = observe(core);
    const guide = !!(core && core.state && core.state.phase === "office" && core.guidePending && core.guidePending());
    const sources = r ? Array.from(r.tokens.values()) : [];
    const paused = !!(r && r.actual || guide);
    const canResume = !!(r && r.manual && !sources.length && !guide);
    const reasons = Array.from(new Set(sources.slice().reverse().map(s => sourceNames[s] || "当前玩法中")));
    if (guide) reasons.push("新手引导中");
    const reason = reasons[0] || (canResume ? "点击继续" : "手动暂停");
    return { paused, manual: !!(r && r.manual), guide, sources, canResume,
      text: paused ? "⏸ 已暂停 · " + reason : "", reasons };
  }
  function placeTag(ui, tag) {
    const shell = ui.el.querySelector(".office-shell"), scene = ui.el.querySelector(".office-scene");
    if (!shell || !scene || !tag.getBoundingClientRect) return;
    if(ui.core.embodiedAvailable&&ui.core.embodiedAvailable()){
      const frame=scene.getBoundingClientRect();if(!frame.width)return;
      const unit=scene.clientWidth/frame.width;
      // CSS owns this corner, so image/font reflow cannot stale its screen position.
      if(tag.parentElement!==scene)scene.appendChild(tag);
      tag.style.setProperty('--office-tag-unit',String(unit));
      tag.style.maxWidth=Math.max(0,scene.clientWidth-20*unit)+'px';
      tag.style.left='auto';tag.style.top='auto';
      tag.style.right=2*unit+'px';tag.style.bottom=2*unit+'px';tag.style.transform='none';
      return;
    }
    // 脱离场景的 transform/overflow 层，低于面板、高于引导与场景立绘。
    if (tag.parentElement !== shell) shell.appendChild(tag);
    const frame = scene.getBoundingClientRect(), root = shell.getBoundingClientRect();
    if (!frame.width || !root.width) return;
    const scale = root.width / (shell.offsetWidth || root.width);
    tag.style.setProperty('--office-tag-unit',String(1/scale));
    tag.style.maxWidth = Math.max(120, frame.width / scale - 20) + "px";
    const portrait=window.matchMedia&&window.matchMedia('(orientation: portrait)').matches;
    const gap = portrait ? 2 : 8 * scale;
    // Pause is screen chrome, never a camera actor. Anchor to the same window
    // corner even when engineer labels or the background move under the lens.
    // Anchor the corner itself. Font loading or a longer pause reason can
    // change the pill's size after layout without displacing its bottom edge.
    tag.style.left = (frame.right - gap - root.left) / scale + "px";
    const below=scene.classList.contains("v2a-pause-below");
    tag.style.top = (frame.bottom + (below?gap:-gap) - root.top) / scale + "px";
    tag.style.transform = below ? "translate(-100%, 0)" : "translate(-100%, -100%)";
    tag.style.right = "auto"; tag.style.bottom = "auto";

  }
  function decorate(ui) {
    if (!ui || !ui.el || !ui.core || !ui.core.state) return;
    const view = status(ui.core), button = ui.el.querySelector("#ob-pause");
    if (button) {
      // 图标显示最终状态，点击仍只切换玩家自己的暂停意愿。
      button.title = view.paused ? view.text + (view.canResume ? "" : "；" +
        (view.manual ? "仍保留手动暂停；点击取消手动暂停" : "结束后自动继续；点击设置手动暂停")) : "暂停";
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-pressed", String(view.paused));
      button.classList.toggle("office-is-paused", view.paused);
      if (ui.icon) button.innerHTML = ui.icon(view.paused ? "play" : "pause", 16);
    }
    const tag = ui.el.querySelector("#ob-pausedtag"),scene=ui.el.querySelector(".office-scene");
    if(scene)scene.classList.toggle("v2a-pause-below",!!(view.paused&&window.matchMedia?.("(orientation: portrait)").matches&&!ui.core.embodiedAvailable()));
    if (tag) {
      tag.style.display = view.paused ? "" : "none";
      tag.textContent = view.text;
      tag.setAttribute("role", "status"); tag.setAttribute("aria-live", "polite");
      if (view.canResume) tag.dataset.action = "office-pause";
      else tag.removeAttribute("data-action");
      delete tag.dataset.id;
      tag.title = view.canResume ? "点击继续" : view.reasons.join(" / ") +
        (view.manual ? "；仍保留手动暂停" : "；完成后自动继续");
      if (!view.guide && view.sources.length === 1 && view.sources[0] === "inspection" && ui.core.state.officeModal !== "minigame") {
        tag.dataset.action = "office-modal"; tag.dataset.id = "minigame";
        tag.title = "返回巡检；完成后" + (view.manual ? "仍保留手动暂停" : "自动继续");
      }
      if (view.paused) placeTag(ui, tag);
    }
  }
  function installUI(ui) {
    ui = ui || window.GameUI;
    if (passive || !ui || installedUI.has(ui)) return;
    installedUI.add(ui);
    for (const name of ["renderOffice", "updateOfficeMain", "applyUiScale"]) {
      const original = ui[name];
      if (typeof original !== "function") continue;
      ui[name] = function () { const result = original.apply(this, arguments); decorate(this); return result; };
    }
    const click = ui.onClick;
    if (typeof click === "function") ui.onClick = function (event) {
      const target = event && event.target && event.target.closest && event.target.closest("[data-action]");
      const s = this.core && this.core.state;
      const abandon = target && target.dataset.action === "office-modal-close" && s && s.officeModal === "minigame" && s.minigame;
      const result = click.apply(this, arguments);
      if (abandon && this.core.state === s) {
        s.minigame = null; s.pendingMinigame = null; s._mgWasPaused = null;
        releaseSource(this.core, "inspection");
        if (this.save && this.save.autoSave) this.save.autoSave(s);
        if (this.updateOfficeMain) this.updateOfficeMain();
      }
      return result;
    };
    const notice = ui.pushNotice;
    if (typeof notice === "function") ui.pushNotice = function (n, opts) {
      const opts0 = opts || {};
      const full = opts0.isEvent && this.core.evByNo && this.core.evByNo(n.no != null ? n.no : n.id);
      const release = opts0.isEvent && (full || n).pause !== false ? acquire(this.core, "event-notice") : null;
      const div = notice.apply(this, arguments);
      if (release) { if (div) notices.set(div, release); else release(); }
      if (this.updateOfficeMain) this.updateOfficeMain();
      return div;
    };
  }
  window.OfficePause = { acquire, releaseSource, setManual, reset, observe, install,
    installUI, decorate, status, sourceNames,
    releaseNotice(core, div) { const release = div && notices.get(div); if (release) { release(); notices.delete(div); } },
    toggleManual(core) { const r = observe(core); return r ? setManual(core, !r.manual) : false; },
    isManual(core) { const r = observe(core); return !!(r && r.manual); },
    pausedAt(core) { const r = observe(core); return r && r.pausedAt; },
    sources(core) { const r = observe(core); return r ? Array.from(r.tokens.values()) : []; },
    setDebug(value) { debug = !!value; return debug; },
    getLog() { return log.slice(); }, clearLog() { log.length = 0; },
  };
  install();
  installUI();
  window.addEventListener("resize", () => decorate(window.GameUI));
})();

/* 鲸 bee 使用真实的活跃毫秒；UI 回调频率和经营倍率都不改变掉落节奏。 */
(function () {
  "use strict";
  if (window.WhalebeeClock) return;
  const records = new WeakMap(), installed = new WeakSet();
  function blocked(ui) {
    const s = ui.core && ui.core.state;
    return !s || s.phase !== "office" || !!s.officePaused || !!document.hidden;
  }
  function settle(ui, now, nextBlocked) {
    if (!ui || typeof ui.whalebeeWait !== "function") return null;
    const s = ui.core && ui.core.state, cfg = ui.core && ui.core.cfg && ui.core.cfg.WHALEBEE;
    if (!s || !cfg) return null;
    let r = records.get(ui);
    if (!r || r.state !== s) {
      if (r && ui.el) ui.el.querySelectorAll(".whalebee").forEach(node => node.remove());
      r = { state:s, at:now, remaining:ui.whalebeeWait(cfg) * 1000, blocked:blocked(ui) };
      records.set(ui,r);
    }
    if (!r.blocked && cfg.ENABLED !== false) r.remaining -= Math.max(0, now - r.at);
    r.at = now; r.blocked = nextBlocked == null ? blocked(ui) : nextBlocked;
    if (ui.el) ui.el.querySelectorAll(".whalebee").forEach(node => {
      node.style.animationPlayState = r.blocked ? "paused" : "running";
      node.style.pointerEvents = r.blocked ? "none" : "";
    });
    return r;
  }
  function install(ui) {
    if (!ui || installed.has(ui) || typeof ui.whalebeeWait !== "function") return;
    installed.add(ui);
    ui.whalebeeTick = function (s) {
      const cfg = this.core && this.core.cfg && this.core.cfg.WHALEBEE;
      const r = settle(this, Date.now());
      if (!r || !cfg || cfg.ENABLED === false || r.blocked || s !== this.core.state || r.remaining > 0) return;
      // Drop at most once after a delayed foreground callback; no burst catch-up.
      r.remaining = Math.max(0, this.whalebeeWait(cfg) * 1000);
      this.spawnWhalebee(cfg,s);
    };
    const render = ui.render;
    if (typeof render === "function") ui.render = function () {
      // Phase switches may never enter the office heartbeat. Observe their
      // boundary as well, so coming back from a report cannot bank hidden time.
      settle(this,Date.now());
      const result = render.apply(this,arguments);
      settle(this,Date.now());
      return result;
    };
  }
  window.WhalebeeClock = {
    install,
    pauseChange(core, now, paused) {
      const ui = window.GameUI;
      if (ui && ui.core === core) settle(ui,now,!!paused || !!document.hidden || !core.state || core.state.phase !== "office");
    }
  };
  document.addEventListener("visibilitychange", () => { const ui=window.GameUI; if(ui)settle(ui,Date.now()); });
  install(window.GameUI);
})();

/* V3 起的经营倍速：仅结算经营时钟，不修改 UI 心跳、RAF 或独立互动时钟。 */
(function () {
  "use strict";
  if (window.OfficeSpeed) return;
  const clocks = new WeakMap(), installed = new WeakSet();
  function allowed(core) {
    const s = core && core.state, order = core && core.cfg && core.cfg.VER_ORDER || [];
    const first = order.indexOf("V3"), current = s ? order.indexOf(s.ver) : -1;
    return !!(s && s.phase === "office" && first >= 0 && current >= first);
  }
  function clock(core, now) {
    const s = core && core.state;
    if (!s || typeof s !== "object") return null;
    let r = clocks.get(s);
    if (!r || r.ver !== s.ver) {
      // 阶段改变的正常路径会由 OfficePause.reset 处理；也防止旧档/外部换阶段沿用倍率。
      if (r) s._tickAt = 0;
      r = { at: now, multiplier: 1, paused: !!s.officePaused, ver: s.ver };
      clocks.set(s, r);
    }
    return r;
  }
  function settle(core, now, paused) {
    const s = core && core.state, r = clock(core, now);
    if (!r) return null;
    const elapsed = Math.max(0, now - r.at);
    if (s.phase === "office" && s._tickAt) {
      if (r.paused) {
        // UI 在暂停期间不调用 tick；顺移起点排除这段墙钟时间，保留暂停前进度。
        s._tickAt += elapsed;
      } else if (!paused && !(core.guidePending && core.guidePending())) {
        // 引擎照常用真实 now 判定，额外只计活跃时间；不调用 officeAdvance(2)。
        s._tickAt -= elapsed * (allowed(core) ? r.multiplier - 1 : 0);
      }
    }
    r.at = now; r.paused = !!paused;
    return r;
  }
  function getMultiplier(core) {
    const r = clock(core, Date.now());
    return allowed(core) && r ? r.multiplier : 1;
  }
  function refresh(ui) {
    ui = ui || window.GameUI;
    const button = ui && ui.el && ui.el.querySelector('[data-action="office-speed-toggle"]');
    if (!button) return;
    const enabled = allowed(ui.core), multiplier = getMultiplier(ui.core);
    button.hidden = false;
    button.classList.toggle("v2a-speed-locked", !enabled);
    const view=String(enabled)+':'+multiplier;
    if(button.dataset.speedView!==view){button.innerHTML=(enabled?'':ui.icon('lock',12))+'<span>'+(enabled?multiplier+'×':'2×')+'</span>';button.dataset.speedView=view;}
    button.title = enabled ? "经营时间 " + multiplier + " 倍速；点击切换为 " + (multiplier === 2 ? 1 : 2) + " 倍速。小游戏与鲸bee保持原速" : "V3 阶段起解锁 2 倍加速";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(multiplier === 2));
    button.setAttribute("aria-disabled", String(!enabled));
    // 阶段锁定仍接收点击以说明解锁条件；拖拽中才暂时禁用交互。
    button.disabled = !!ui._v2aDrag || !!ui._v2aReturnFrame;
  }
  function setMultiplier(core, multiplier) {
    const r = settle(core, Date.now(), !!(core && core.state && core.state.officePaused));
    if (!r) return 1;
    r.multiplier = allowed(core) && multiplier === 2 ? 2 : 1;
    if (window.GameUI && GameUI.core === core) refresh(GameUI);
    return r.multiplier;
  }
  function pauseChange(core, now, previous, next) {
    const r = clock(core, now);
    if (!r) return;
    r.paused = !!previous;
    settle(core, now, previous);
    r.paused = !!next;
  }
  function reset(core) {
    const s = core && core.state;
    if (!s) return;
    clocks.delete(s);
    s._tickAt = 0;
    if (window.GameUI && GameUI.core === core) refresh(GameUI);
  }
  function install(core) {
    core = core || window.GameCore;
    if (!core || installed.has(core) || typeof core.officeTick !== "function") return;
    installed.add(core);
    const original = core.officeTick;
    core.officeTick = function (now) {
      now = Number.isFinite(now) ? now : Date.now();
      settle(this, now, !!(this.state && this.state.officePaused));
      // 每次 UI timer 回调只进原引擎一次，让暂停事件先由原 UI 消费。
      return original.call(this, now);
    };
  }
  window.OfficeSpeed = { allowed, getMultiplier, setMultiplier, pauseChange, reset, refresh, install,
    toggle(core) {
      if (!allowed(core)) {
        const ui = window.GameUI;
        if (ui && ui.core === core && typeof ui.toast === "function") ui.toast("V3 阶段起解锁 2 倍加速");
        return 1;
      }
      return setMultiplier(core, getMultiplier(core) === 2 ? 1 : 2);
    },
  };
  install();
  refresh();
})();
