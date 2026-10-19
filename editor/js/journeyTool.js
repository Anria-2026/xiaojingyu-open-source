/* 旅行鲸鱼 · 对话树编辑器（2026-10-10）
   图谱与属性栏由 JourneyTreeView 提供，视觉样式派生自原测试聊天树。
   新消息类型【语音对白】：配置音频与秒数，预览里"消息出现即自动播放"（与游戏同语义）。
   整区保存 section=CITY_JOURNEY；单线顺序可编辑，稳定编号只读。 */
(function () {
  "use strict";
  if (window.JourneyTool) return;
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const STAGES = ["V5", "V5.5", "V6", "V6.5"];
  const TYPES = { text: "文本", image: "图片", voice: "语音对白" };
  const ANSWER_TYPES = { text: "文本回复", voice: "语音对白" };
  const integer = v => Number.isFinite(Number(v)) ? Number(v) : null;
  const audioURL = v => /^resource\/.*\.(?:mp3|m4a|wav|ogg|webm)$/i.test(String(v || "")) ? String(v) : "";
  const imageURL = v => /^resource\/.*\.(?:webp|png|jpe?g|gif)$/i.test(String(v || "")) ? String(window.ResourcePaths?ResourcePaths.canonical(String(v)):v) : "";
  const secondsOf = v => { const n = integer(v); return n == null ? 0 : n; };
  const roleText = s => String(s == null ? "" : s).replace(/\{whale\}/g, "小鲸鱼");
  const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const DEFAULT_WAIT_HINT = "请耐心等待她返回消息";

  const emptyJourney = () => ({ TITLE: "旅行小鲸鱼", ROUTE_VERSION: 2, WAIT_MINUTES: 2, REPLY_SECONDS: 3, AGES_BY_VER: {}, PORTRAITS_BY_VER: {}, OPENING: { id: "opening", label: "第一次，面对面", steps: [], departure: "", waitHint: "" }, STOPS: [] });

  const tool = {
    data: null, loaded: false, dirty: false, selected: "opening",
    undoStack: [], redoStack: [],
    _player: null, _playIndex: null, _timers: [], _playing: false, _voiceRequest: 0, _voiceDone: null, _voiceDurations: new Map(),

    /* ---------- 数据访问 ---------- */
    normalize(data) {
      const out = data && typeof data === "object" && !Array.isArray(data) ? clone(data) : emptyJourney();
      if (!out.OPENING || typeof out.OPENING !== "object" || Array.isArray(out.OPENING)) out.OPENING = emptyJourney().OPENING;
      if (!Array.isArray(out.STOPS)) out.STOPS = [];
      out.STOPS.forEach(stop => { if (stop && typeof stop === "object") { if (!Array.isArray(stop.arrivals)) stop.arrivals = []; if (!Array.isArray(stop.steps)) stop.steps = []; } });
      if (!Array.isArray(out.OPENING.steps)) out.OPENING.steps = [];
      ["AGES_BY_VER", "PORTRAITS_BY_VER"].forEach(key => { if (!out[key] || typeof out[key] !== "object" || Array.isArray(out[key])) out[key] = {}; });
      return out;
    },
    opening() { return this.data && this.data.OPENING || {}; },
    stops() { return this.data && Array.isArray(this.data.STOPS) ? this.data.STOPS : []; },
    node(id) {
      if (id === "opening") return this.opening();
      return this.stops().find(stop => stop && stop.id === id) || null;
    },
    isOpening(id) { return id === "opening"; },
    effectiveWaitMinutes(node) { return Math.max(.1, Math.min(1440, finite(node && node.waitMinutes, finite((this.data || {}).WAIT_MINUTES, 2)))); },
    effectiveWaitHint(node) { return node && node.waitHint || DEFAULT_WAIT_HINT; },
    effectiveReplySeconds(node, step) { return Math.max(1, Math.min(300, finite(step && step.replySeconds, finite(node && node.replySeconds, finite((this.data || {}).REPLY_SECONDS, 3))))); },
    imagePreviewHTML(value, alt) {
      const src = imageURL(value);
      if (!src) return '<p class="jt-image-status" role="status">' + (value ? '请选择 resource 目录内的图片。' : '选择图片后会在这里显示预览。') + '</p>';
      return '<img data-journey-image src="' + esc(src) + '" alt="' + esc(roleText(alt || "旅途照片")) + '"><p class="jt-image-status" role="status">正在加载图片预览…</p>';
    },
    imageStatus(event) {
      const image = event.target;
      if (!image || !image.matches || !image.matches('[data-journey-image]')) return;
      const box = image.closest('[data-journey-image-path]'), status = box && box.querySelector('.jt-image-status');
      if (!status) return;
      const failed = event.type === 'error';
      box.classList.toggle('is-failed', failed);
      box.dataset.journeyImageState = failed ? 'failed' : 'ready';
      status.textContent = failed ? '图片加载失败，请检查资源路径或重新选择图片。' : '图片预览 · ' + image.naturalWidth + ' × ' + image.naturalHeight;
    },

    /* ---------- 生命周期 ---------- */
    init() {
      const root = document.getElementById("journey-config");
      if (!root || this._initialized) return;
      this._initialized = true;
      root.addEventListener("input", event => { if (event.target.tagName !== "SELECT") this.input(event.target); });
      root.addEventListener("change", event => { if (event.target.tagName === "SELECT") this.input(event.target); });
      root.addEventListener("focusout", () => { this._editPath = null; if (window.JourneyTreeView) JourneyTreeView.refreshEffectiveFields(true); });
      root.addEventListener("load", event => this.imageStatus(event), true);
      root.addEventListener("error", event => this.imageStatus(event), true);
      root.addEventListener("click", async event => { if (event.target.tagName !== "SELECT") await this.click(event.target); });
      document.addEventListener("click", event => { const tab = event.target.closest && event.target.closest("[data-page]"); if (tab && tab.dataset.page !== "journey") this.stopSequence(); });
      window.addEventListener("pagehide", () => this.stopSequence());
    },
    async refresh() {
      this.stopSequence();
      if (!this.loaded) {
        try {
          const response = await fetch("/api/game-cfg");
          if (!response.ok) throw new Error("无法读取配置");
          const result = await response.json();
          if (window.CfgSync) window.CfgSync.note(result);
          /* [feature:journey-owner-source-load] */
          const saved = (result.config || {}).CITY_JOURNEY;
          this._savedSource = JSON.stringify(saved == null ? null : saved);
          /* [/feature:journey-owner-source-load] */
          const defaults = (window.GameDefaults && window.GameDefaults.base || {}).CITY_JOURNEY;
          this.data = this.normalize(saved == null ? defaults : saved);
          this.loaded = true;
        } catch (error) {
          const root = document.getElementById("journey-config");
          if (root) root.innerHTML = '<p class="jt-error" role="alert">读取旅行配置失败。请重新打开此分页，已有配置尚未改动。</p>';
          return;
        }
      }
      if (!this.node(this.selected)) this.selected = "opening";
      this.render();
    },
    mark() { this.dirty = true; if (typeof App !== "undefined" && App.markCfgDirty) App.markCfgDirty(); },
    remember() { this.undoStack.push(JSON.stringify({ data: this.data, selected: this.selected })); if (this.undoStack.length > 60) this.undoStack.shift(); this.redoStack = []; },
    undo() { const last = this.undoStack.pop(); if (!last) return; this.redoStack.push(JSON.stringify({ data: this.data, selected: this.selected })); const state = JSON.parse(last); this.data = state.data; this.selected = state.selected; this._editPath = null; this.mark(); this.render(); },
    redo() { const next = this.redoStack.pop(); if (!next) return; this.undoStack.push(JSON.stringify({ data: this.data, selected: this.selected })); const state = JSON.parse(next); this.data = state.data; this.selected = state.selected; this._editPath = null; this.mark(); this.render(); },

    /* ---------- 校验 ---------- */
    errors() {
      // Configuration semantics are the planner's responsibility.
      return [];
    },

    /* ---------- 保存 ---------- */
    async save({ silent = false } = {}) {
      /* [feature:journey-owner-source-check] */
      if (!this.loaded || !this.dirty) return;
      const errors = this.errors();
      if (errors.length) { this.renderErrors(errors); throw new Error(errors[0]); }
      // CfgSync is shared: another tool can advance its mtime while this draft is stale.
      const currentResponse = await fetch("/api/game-cfg");
      if (!currentResponse.ok) throw new Error("无法核对最新旅行配置，已有配置未覆盖");
      const current = await currentResponse.json();
      const currentSource = JSON.stringify((current.config || {}).CITY_JOURNEY == null ? null : current.config.CITY_JOURNEY);
      if (this._savedSource !== undefined && currentSource !== this._savedSource)
        throw new Error("旅行配置已被其他窗口修改。当前草稿已保留，请备份草稿并刷新后重试。");
      if (window.CfgSync) window.CfgSync.note(current);
      const payload = clone(this.data), postedSource = JSON.stringify(payload);
      const response = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "CITY_JOURNEY", config: payload, expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      /* [/feature:journey-owner-source-check] */
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "保存失败");
      if (window.CfgSync) window.CfgSync.update(result.mtime);
      /* [feature:journey-owner-source-saved] */
      this._savedSource = postedSource;
      // Edits made while the request was in flight remain unsaved work.
      this.dirty = JSON.stringify(this.data) !== postedSource;
      if (!silent && typeof UI !== "undefined" && UI.toast) UI.toast("旅行鲸鱼已保存并同步到游戏");
      /* [/feature:journey-owner-source-saved] */
      this.renderErrors([]);
      return true;
    },

    /* ---------- 编辑入口 ---------- */
    setPath(path, value) {
      const keys = String(path).split("|").map(k => /^\d+$/.test(k) ? Number(k) : k);
      let node = this.data;
      for (let i = 0; i < keys.length - 1; i++) { if (node[keys[i]] == null) return false; node = node[keys[i]]; }
      node[keys[keys.length - 1]] = value;
      return true;
    },
    pathValue(path) {
      const keys = String(path).split("|").map(k => /^\d+$/.test(k) ? Number(k) : k);
      return keys.reduce((node, key) => (node == null ? undefined : node[key]), this.data);
    },
    input(el) {
      if (el && el.dataset && el.dataset.journeyAction) { this.click(el); return; }
      const path = el.dataset && el.dataset.journeyPath;
      if (!path) return;
      const numeric = el.dataset.journeyNumber === "1";
      let value = el.dataset.journeyBoolean === "1" ? !!el.checked : el.value;
      // A missing legacy default is preserved, but explicitly clearing the global
      // reply wait is an invalid edit. Optional per-node overrides still inherit.
      if (numeric) value = value === "" ? (path === "REPLY_SECONDS" ? NaN : undefined) : Number(value);
      if (el.dataset.journeyOptional === "1" && (value === "" || value === undefined)) value = undefined;
      if (this._editPath !== path) { this.remember(); this._editPath = path; }
      if (value === undefined) { this.removePath(path); } else if (!this.setPath(path, value)) return;
      this.mark(); this.renderErrors();
      if (el.dataset.journeyRerender === "1") this.render();
      else { this.renderPreview(); if (window.JourneyTreeView) { JourneyTreeView.update(); JourneyTreeView.refreshEffectiveFields(); JourneyTreeView.refreshInspectorAssets(); } }
    },
    removePath(path) {
      const keys = String(path).split("|").map(k => /^\d+$/.test(k) ? Number(k) : k);
      let node = this.data;
      for (let i = 0; i < keys.length - 1; i++) { if (node[keys[i]] == null) return; node = node[keys[i]]; }
      delete node[keys[keys.length - 1]];
    },
    async click(target) {
      const el = target && target.closest ? target.closest("[data-journey-action]") : null;
      if (!el) return;
      const action = el.dataset.journeyAction, scope = el.dataset.journeyScope, index = el.dataset.journeyIndex == null ? null : Number(el.dataset.journeyIndex);
      const listOf = () => scope === "opening" ? this.opening() : this.node(scope);
      if (action === "select") { this.selected = el.dataset.journeyId; this.render(); return; }
      if (action === "undo") { this.undo(); return; }
      if (action === "redo") { this.redo(); return; }
      if (action === "preview-play") { this.playSequence(); return; }
      if (action === "preview-stop") { this.stopSequence(); return; }
      if (action === "preview-voice") { const active = this._player && !this._player.paused && this._voiceSrc === el.dataset.journeySrc && this._playIndex === Number(el.dataset.journeyIndex); this.stopSequence(); if (!active) this.playVoice(el.dataset.journeySrc || "", el); return; }
      if (action === "pick") {
        const kind = el.dataset.journeyKind === "audio" ? "audio" : "image";
        const path = el.dataset.journeyPath;
        if (!window.ResPicker) return;
        const value = await ResPicker.pick(this.pathValue(path) || "", { title: kind === "audio" ? "选择语音/音频" : "选择图片", kind });
        if (value === null) return;
        this.remember();
        this.setPath(path, value);
        this.mark(); this.render();
        return;
      }
      if (action === "add-stop") {
        this.remember();
        const stops = this.stops();
        // A deleted stop can still exist in players' completedStops and logs.
        // Never reuse its ordinal ID for a new destination.
        let id;
        do {
          const nonce = window.crypto && typeof window.crypto.randomUUID === "function"
            ? window.crypto.randomUUID()
            : Date.now().toString(36) + "_" + Math.random().toString(36).slice(2) + "_" + (this._newStopCounter = (this._newStopCounter || 0) + 1);
          id = "stop_" + nonce;
        } while (stops.some(stop => stop.id === id));
        const lastVer = stops.length ? stops[stops.length - 1].minVer : "V5";
        stops.push({ id, minVer: STAGES.includes(lastVer) ? lastVer : "V5", label: "新的报备站点", destination: "目的地", arrivals: [{ type: "text", text: "我到啦。" }], steps: [{ option: "路上顺利吗？", reply: "很顺利，风把好消息都带来了。" }] });
        this.selected = id; this.mark(); this.render();
        return;
      }
      if (action === "del-stop") {
        const index = Number(el.dataset.journeyIndex);
        this.remember(); this.stops().splice(index, 1);
        if (!this.node(this.selected)) this.selected = "opening";
        this.mark(); this.render(); return;
      }
      if (action === "move-stop") {
        const dir = Number(el.dataset.journeyDir), stops = this.stops(), to = index + dir;
        if (to < 0 || to >= stops.length) return;
        this.remember(); stops.splice(to, 0, stops.splice(index, 1)[0]);
        this.mark(); this.render(); return;
      }
      /* 列表项（报备 / 对话）通用增删移 */
      const host = listOf();
      if (!host) return;
      if (action === "add-arrival") {
        this.remember();
        host.arrivals = host.arrivals || [];
        host.arrivals.push({ type: "text", text: "我到啦。" });
        this.mark(); this.render(); return;
      }
      if (action === "add-step") {
        this.remember();
        host.steps = host.steps || [];
        host.steps.push({ option: "路上顺利吗？", reply: "很顺利，风把好消息都带来了。" });
        this.mark(); this.render(); return;
      }
      if (action === "del-arrival" || action === "del-step") {
        this.remember();
        if (window.JourneyTreeView) JourneyTreeView.clearMessagePositions(scope);
        (action === "del-arrival" ? host.arrivals : host.steps).splice(index, 1);
        this.mark(); this.render(); return;
      }
      if (action === "move-arrival" || action === "move-step") {
        const list = action === "move-arrival" ? host.arrivals : host.steps, to = index + Number(el.dataset.journeyDir);
        if (!list || to < 0 || to >= list.length) return;
        this.remember();
        if (window.JourneyTreeView) JourneyTreeView.clearMessagePositions(scope);
        list.splice(to, 0, list.splice(index, 1)[0]);
        this.mark(); this.render(); return;
      }
      if (action === "type-arrival") {
        this.remember();
        const item = host.arrivals[index];
        item.type = el.value;
        if (item.type === "text" && item.text == null) item.text = "";
        if (item.type === "image" && item.src == null) item.src = "";
        if (item.type === "voice") { if (item.src == null) item.src = ""; if (item.seconds == null) item.seconds = 4; }
        this.mark(); this.render(); return;
      }
      if (action === "type-reply") {
        this.remember();
        const step = host.steps[index];
        step.replyType = el.value === "voice" ? "voice" : "";
        if (step.replyType === "voice") { if (step.replySrc == null) step.replySrc = ""; }
        this.mark(); this.render(); return;
      }
    },

    /* ---------- 预览（与游戏同语义：语音出现即播） ---------- */
    ensurePlayer() {
      if (this._player) return this._player;
      try {
        this._player = new Audio(); this._player.preload = "none";
        this._player.addEventListener("ended", () => { this.syncVoiceUI(false); this.finishPreviewVoice(); });
        this._player.addEventListener("error", () => { this.syncVoiceUI(false); this.finishPreviewVoice(); });
        this._player.addEventListener("pause", () => this.syncVoiceUI());
        this._player.addEventListener("loadedmetadata", () => {
          if (Number.isFinite(this._player.duration) && this._player.duration > 0) {
            this._voiceDurations.set(this._voiceSrc, Math.max(1, Math.round(this._player.duration)));
            if (this._voiceDurations.size > 32) this._voiceDurations.delete(this._voiceDurations.keys().next().value);
            this.syncVoiceUI();
          }
        });
      } catch (e) { this._player = null; }
      return this._player;
    },
    finishPreviewVoice() { const done = this._voiceDone; this._voiceDone = null; if (done) done(); },
    playVoice(src, button, done) {
      const url = audioURL(src);
      if (!url) return false;
      const player = this.ensurePlayer();
      if (!player) return false;
      const request = ++this._voiceRequest;
      try {
        player.pause();
        if (this._voiceSrc !== url) { this._voiceSrc = url; player.src = url; }
        player.currentTime = 0;
        this._voiceDone = done || null;
        this._playIndex = button && button.dataset.journeyIndex != null ? Number(button.dataset.journeyIndex) : null;
        this.syncVoiceUI(true);
        const promise = player.play();
        if (promise && promise.catch) promise.catch(() => { if (request !== this._voiceRequest) return; this.syncVoiceUI(false); this.finishPreviewVoice(); });
        return true;
      } catch (e) { this._voiceDone = null; this.syncVoiceUI(false); return false; }
    },
    pauseVoice() { this._voiceRequest++; this._voiceDone = null; if (this._player) { try { this._player.pause(); } catch (e) { /* 忽略 */ } } this.syncVoiceUI(false); },
    syncVoiceUI(playing) {
      const root = document.getElementById("journey-config");
      if (!root) return;
      const active = playing === undefined ? !!this._player && !this._player.paused : !!playing;
      root.querySelectorAll("[data-journey-voice]").forEach(el => {
        el.classList.toggle("is-playing", active && Number(el.dataset.journeyVoice) === this._playIndex);
        const seconds = this._voiceDurations.get(el.dataset.journeySrc), label = el.querySelector("button b");
        if (label && seconds) label.textContent = seconds + "″";
      });
    },
    sequence() {
      const node = this.node(this.selected);
      if (!node) return [];
      const items = [];
      (node.arrivals || []).forEach(item => items.push({ kind: "whale", item }));
      (node.steps || []).forEach(step => { items.push({ kind: "me", item: step }); items.push({ kind: "reply", item: step }); });
      if (node.departure) items.push({ kind: "system", item: { text: node.departure } });
      if (this.selected === "opening" || this.stops().indexOf(node) < this.stops().length - 1) items.push({ kind: "system", item: { text: this.effectiveWaitHint(node) } });
      return items;
    },
    renderPreview() {
      const box = document.getElementById("journey-preview-log");
      if (!box) return;
      this.stopSequence();
      box.innerHTML = '<p class="jt-preview-empty">选择左侧节点，或点「按顺序播放」看这一站到达与对话的完整呈现。</p>';
    },
    playSequence() {
      this.stopSequence();
      const box = document.getElementById("journey-preview-log");
      const node = this.node(this.selected);
      if (!box || !node) return;
      box.innerHTML = "";
      this._playing = true;
      const items = this.sequence();
      const replyWait = step => Math.round(this.effectiveReplySeconds(node, step) * 1000);
      let order = 0;
      const later = (callback, ms) => this._timers.push(setTimeout(callback, ms));
      const advance = () => {
        if (!this._playing) return;
        if (order >= items.length) { this._playing = false; this._timers = []; return; }
        const entry = items[order], index = order++;
        const show = () => {
          if (!this._playing) return;
          const html = entry.kind === "system" ? '<p class="jt-preview-system">' + esc(roleText(entry.item.text)) + '</p>' : entry.kind === "me" ? this.previewReplyBubble(entry.item, true, false, index) : this.previewReplyBubble(entry.item, false, entry.kind === "reply", index);
          const wrap = document.createElement("div");
          wrap.innerHTML = html;
          const element = wrap.firstElementChild;
          box.appendChild(element);
          box.scrollTop = box.scrollHeight;
          const voice = element && element.getAttribute ? element.getAttribute("data-journey-src") : "";
          if (voice && this.playVoice(voice, { dataset: { journeyIndex: String(index) } }, () => later(advance, 200))) return;
          later(advance, entry.kind === "me" ? 0 : entry.kind === "reply" ? 700 : 1000);
        };
        if (entry.kind === "reply") later(show, replyWait(entry.item)); else show();
      };
      later(advance, 200);
    },
    stopSequence() {
      this._playing = false;
      this._timers.forEach(id => clearTimeout(id));
      this._timers = [];
      this.pauseVoice();
    },
    previewReplyBubble(item, me, reply, order) {
      if (reply && item && item.replyType === "voice") return this.previewVoiceBubble(audioURL(item.replySrc), 0, item.reply, order);
      if (!me && !reply && item && item.type === "voice") return this.previewVoiceBubble(audioURL(item.src), secondsOf(item.seconds), item.text, order);
      if (!me && !reply && item && item.type === "image") {
        const src = imageURL(item.src);
        return '<figure class="jt-bubble jt-bubble-whale jt-photo">' + (src ? '<img src="' + esc(src) + '" alt="' + esc(roleText(item.alt || "旅途自拍")) + '">' : '<span class="jt-missing">（未选图片）</span>') + '<figcaption>' + esc(roleText(item.caption || "")) + '</figcaption></figure>';
      }
      const text = me ? item.option : (reply ? item.reply : item.text);
      return '<div class="jt-bubble jt-bubble-' + (me ? "me" : "whale") + '">' + esc(roleText(text)) + '</div>';
    },
    previewVoiceBubble(src, seconds, caption, order) {
      seconds = this._voiceDurations.get(src) || 0;
      return '<div class="jt-bubble jt-bubble-whale jt-voice" data-journey-src="' + esc(src) + '" data-journey-voice="' + esc(order) + '"><button type="button" data-journey-action="preview-voice" data-journey-src="' + esc(src) + '" data-journey-index="' + esc(order) + '">' + waveSVG() + '<b>' + (seconds ? seconds + "″" : "语音") + '</b></button>' + (caption ? '<span>' + esc(roleText(caption)) + '</span>' : "") + '</div>';
    },
    renderErrors(errors) {
      const root = document.getElementById("journey-errors");
      if (!root) return;
      const list = errors === undefined ? this.errors() : errors;
      root.hidden = !list.length;
      root.textContent = list.join("\n");
    },

    /* ---------- 渲染 ---------- */
    render() {
      this._editPath = null;
      if (this.loaded && window.JourneyTreeView) JourneyTreeView.mount(this);
      this.renderErrors();
    }
  };

  function waveSVG() {
    return '<svg class="jt-wave" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9v6"/><path d="M9 5.5v13"/><path d="M14 8v8"/><path d="M19 10.5v3"/></svg>';
  }

  window.JourneyTool = tool;
})();
