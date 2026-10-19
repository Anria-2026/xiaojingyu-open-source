/* ==========================================================================
   音效模块（SFX）
   --------------------------------------------------------------------------
   - 复用 AudioMgr 的 AudioContext（js/menu.js），不新建上下文
   - 两种音效来源：
     1) 程序化合成（零资源可爱音效，默认即刻可用）
     2) 配置文件音效（音效配置页指定 resource/sound/sfx 下的文件）
   - 配置：h5_demo/data/sfx_config.json（由 server 同步生成）
       { "events": { "move": "assets/sfx/move.wav", ... } }
     未配置的 event → 走程序化合成兜底
   ========================================================================== */
"use strict";

const SFX = {
  volKey: "whale_sfx_vol",  // 音效音量持久化（localStorage，刷新不重置）
  vol: 0.9,
  config: null,           // { events: { eventName: url }, volumes: { eventName: 0..1 } }
  volumes: {},            // 单事件音量倍率（音效页配置，缺省 1）
  fileCache: {},          // 解码缓存：url -> AudioBuffer
  fileP: {},              // 解码中的 Promise

  /* 读取外部音效配置（失败不阻塞，回退程序化）+ 恢复保存的音量 */
  async init() {
    try {
      const v = parseFloat(localStorage.getItem(this.volKey));
      if (!isNaN(v) && v >= 0 && v <= 1) this.vol = v;
    } catch (e) {}
    try {
      const r = await fetch("./data/sfx_config.json", { cache: "no-store" });
      if (r.ok) this.config = await r.json();
    } catch (e) { this.config = null; }
    this.volumes = (this.config && this.config.volumes) || {};
  },

  setVolume(v) {
    this.vol = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(this.volKey, String(this.vol)); } catch (e) {}
  },

  /* 单个事件的音量（音效页可调，缺省 1 = 不额外衰减）。
     总音量 = 玩家设置的全局音效音量 × 该事件音量 × 调用方临时系数。 */
  volOf(name) {
    const v = this.volumes ? this.volumes[name] : null;
    return v == null ? 1 : Math.max(0, Math.min(1, +v));
  },

  /* [feature:album-cg-paper-sfx-2] */
  _paperEvents: ["albumPhotoPlace", "cgEnvelopeArrive", "cgEnvelopeOpen", "cgPhotoReveal"],

  /* Audio-time-owned gestures: callers can cancel even while a custom file is decoding. */
  _paperHandle(name, opts) {
    let finish;
    const handle = { event: name, grade: opts.grade || "pass", duration: 0,
      startedAt: null, state: "pending", stopped: false,
      done: new Promise(resolve => { finish = resolve; }) };
    const signal = opts.signal;
    const hidden = () => { if (typeof document !== "undefined" && document.hidden) handle.stop(); };
    const leave = () => handle.stop();
    handle._finish = reason => {
      if (handle.state === "ended" || handle.state === "stopped" || handle.state === "muted" || handle.state === "unavailable") return;
      handle.state = reason;
      if (handle._dispose) handle._dispose();
      if (signal && signal.removeEventListener) signal.removeEventListener("abort", leave);
      if (typeof document !== "undefined" && document.removeEventListener) document.removeEventListener("visibilitychange", hidden);
      if (window.removeEventListener) window.removeEventListener("pagehide", leave);
      finish({ event: name, reason });
    };
    handle.stop = () => {
      if (handle.stopped || ["ended", "stopped", "muted", "unavailable"].indexOf(handle.state) >= 0) return;
      handle.stopped = true;
      if (handle._stopAudio) handle._stopAudio(); else handle._finish("stopped");
    };
    if (signal && signal.addEventListener) signal.addEventListener("abort", leave, { once: true });
    if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("visibilitychange", hidden);
    if (window.addEventListener) window.addEventListener("pagehide", leave);
    if (signal && signal.aborted) handle.stop();
    hidden();
    return handle;
  },

  _paperVolume(name, opts) {
    const value = this.vol * this.volOf(name) * (opts.vol === undefined ? 1 : +opts.vol);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  },

  _playPaper(name, opts) {
    const handle = this._paperHandle(name, opts);
    if (handle.stopped) return handle;
    if (!this._paperVolume(name, opts)) { handle._finish("muted"); return handle; }
    const manager = window.AudioMgr;
    if (!manager) { handle._finish("unavailable"); return handle; }
    const file = this.config && this.config.events && this.config.events[name];
    if (file) {
      this._paperFile(file, name, opts, handle).catch(() => {
        if (!handle.stopped) this._paperSynth(name, opts, handle);
      });
    } else this._paperSynth(name, opts, handle);
    return handle;
  },

  _paperGraph(ctx, manager, name, opts, handle) {
    const nodes = [], sources = [];
    const out = ctx.createGain(); nodes.push(out);
    out.gain.setValueAtTime(this._paperVolume(name, opts), ctx.currentTime);
    out.connect(manager.sfxGain || manager.master);
    let pending = 0;
    handle.startedAt = ctx.currentTime; handle.state = "playing";
    handle._dispose = () => {
      nodes.forEach(node => { try { node.disconnect(); } catch (e) {} });
      handle._dispose = null;
    };
    handle._stopAudio = () => {
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + .018);
      sources.forEach(source => { try { source.stop(now + .022); } catch (e) {} });
      if (ctx.state === "suspended" || ctx.state === "closed") handle._finish("stopped");
    };
    const own = (source, extra) => {
      nodes.push(source, ...(extra || [])); sources.push(source); pending++;
      source.onended = () => {
        if (--pending === 0) handle._finish(handle.stopped ? "stopped" : "ended");
      };
      return source;
    };
    return { out, own, nodes, sources };
  },

  async _paperFile(url, name, opts, handle) {
    const manager = window.AudioMgr;
    await manager.resume();
    if (handle.stopped) return;
    const ctx = this._ctx();
    if (!ctx) { handle._finish("unavailable"); return; }
    const buffer = this.fileCache[url] || await (this.fileP[url] || this._decode(url));
    if (handle.stopped) return;
    if (!buffer) throw new Error("Custom paper sound is unavailable");
    const graph = this._paperGraph(ctx, manager, name, opts, handle);
    const source = graph.own(ctx.createBufferSource());
    source.buffer = buffer; source.connect(graph.out);
    handle.duration = buffer.duration;
    source.start(ctx.currentTime);
  },

  _paperSynth(name, opts, handle) {
    const manager = window.AudioMgr;
    if (!manager || handle.stopped) return;
    const resumed = manager.resume();
    if (resumed && resumed.catch) resumed.catch(() => handle.stop());
    const ctx = this._ctx();
    if (!ctx) { handle._finish("unavailable"); return; }
    const aliases = { S: "top", A: "excellent", veto: "fail" };
    const grade = aliases[opts.grade] || opts.grade || "pass";
    handle.grade = grade;
    const graph = this._paperGraph(ctx, manager, name, opts, handle), t0 = ctx.currentTime;
    const high = ctx.createBiquadFilter(), low = ctx.createBiquadFilter();
    high.type = "highpass"; high.frequency.value = 90; high.Q.value = .5;
    low.type = "lowpass"; low.frequency.value = 5100; low.Q.value = .5;
    high.connect(low); low.connect(graph.out); graph.nodes.push(high, low);
    const tone = (at, frequency, end, duration, peak, destination) => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      graph.own(oscillator, [gain]); oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, t0 + at);
      oscillator.frequency.exponentialRampToValueAtTime(end, t0 + at + duration);
      gain.gain.setValueAtTime(.00001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + at + .012);
      gain.gain.exponentialRampToValueAtTime(.00001, t0 + at + duration);
      oscillator.connect(gain); gain.connect(destination || high);
      oscillator.start(t0 + at); oscillator.stop(t0 + at + duration + .025);
    };
    const paper = (at, duration, peak, from, to, attack) => {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * (duration + .03)), ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(), band = ctx.createBiquadFilter(), gain = ctx.createGain();
      graph.own(source, [band, gain]); source.buffer = buffer;
      band.type = "bandpass"; band.Q.value = .58;
      band.frequency.setValueAtTime(from, t0 + at);
      band.frequency.exponentialRampToValueAtTime(to, t0 + at + duration);
      gain.gain.setValueAtTime(.00001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + at + (attack || .006));
      gain.gain.exponentialRampToValueAtTime(.00001, t0 + at + duration);
      source.connect(band); band.connect(gain); gain.connect(high);
      source.start(t0 + at); source.stop(t0 + at + duration + .025);
    };
    if (name === "albumPhotoPlace") {
      handle.duration = .48;
      paper(0, .15, .095, 1550, 750, .018);
      tone(.018, 180, 85, .09, .075);
      [[.055,.065,.055],[.115,.045,.04],[.19,.065,.026]].forEach(row => paper(row[0], row[1], row[2], 2100, 900));
    } else if (name === "cgEnvelopeArrive") {
      handle.duration = .72;
      paper(0, .32, .11, 450, 1900, .15);
      paper(.28, .18, .075, 2200, 850);
      tone(.29, 310, 160, .105, .12); tone(.29, 1500, 980, .035, .018);
    } else if (name === "cgEnvelopeOpen") {
      handle.duration = .76;
      [0,.035,.08,.13,.18].forEach((at, index) => paper(at, .095, .055 + index * .006, 1700 + index * 300, 3100));
      paper(.28, .19, .08, 1400, 850, .018);
      paper(.2, .3, .045, 900, 1700, .10); tone(.30, 140, 110, .08, .04);
    } else {
      const styles = {
        fail: { duration: .90, notes: [293.66,349.23], step: .17, decay: .34, echo: .13 },
        pass: { duration: 1.10, notes: [392,493.88,587.33], step: .14, decay: .42, echo: .16 },
        excellent: { duration: 1.45, notes: [493.88,587.33,739.99,987.77], step: .135, decay: .55, echo: .20 },
        top: { duration: 1.72, notes: [523.25,659.25,783.99,987.77,1174.66,1567.98], step: .11, decay: .58, echo: .24 }
      };
      const style = styles[grade] || styles.pass; handle.duration = style.duration;
      paper(0, .4, .07, 450, 2200, .15); paper(.055, .13, .04, 1500, 800);
      const crystal = ctx.createGain(), delay = ctx.createDelay(.5), echo = ctx.createGain();
      crystal.gain.value = 1; delay.delayTime.value = style.echo; echo.gain.value = .18;
      crystal.connect(high); crystal.connect(delay); delay.connect(echo); echo.connect(high);
      graph.nodes.push(crystal, delay, echo);
      tone(.06, 196, 196, .48, .025); tone(.06, 293.66, 293.66, .48, .018);
      style.notes.forEach((frequency, index) => {
        const at = .12 + index * style.step;
        tone(at, frequency, frequency * 1.0015, style.decay, .092, crystal);
        tone(at + .009, frequency * 2, frequency * 1.998, style.decay * .62, .013, crystal);
      });
    }
    // A silent audio-clock sentinel includes the full scheduled/echo tail.
    const sentinel = graph.own(ctx.createBufferSource());
    sentinel.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); sentinel.connect(graph.out);
    sentinel.start(t0 + handle.duration);
  },
  /* [/feature:album-cg-paper-sfx-2] */
  /* 统一播放入口：先查配置，无则程序化 */
  /* [feature:album-cg-paper-sfx-1] */
  async play(name, opts = {}) {
    if (this._paperEvents.indexOf(name) >= 0) return this._playPaper(name, opts);
    const file = this.config && this.config.events && this.config.events[name];
  /* [/feature:album-cg-paper-sfx-1] */
    if (file) { await this.playFile(file, Object.assign({ event: name }, opts)); return; }
    this.synth(name, opts);
  },

  /* 进入游戏前预解码全部已配置音效文件（复用 fileCache/fileP，首播零延迟）。
     在加载界面（loading）调用：无需用户手势即可创建 suspended 上下文并解码，
     解码结果与 playFile 共享同一缓存，进游戏后首音效即刻出声不断顿。
     若此刻 SFX.init 尚未运行（config 为空），就地读取一次音效配置。 */
  async preload() {
    if (!this.config) {
      try {
        const r = await fetch("./data/sfx_config.json", { cache: "no-store" });
        if (r.ok) this.config = await r.json();
      } catch (e) {}
    }
    const ev = this.config && this.config.events;
    if (!ev) return;
    const urls = [];
    for (const k in ev) if (ev[k]) urls.push(ev[k]);
    await Promise.all(urls.map((u) => this._decode(u).catch(() => {})));
  },

  /* 预解码单个音效进 fileCache：与 playFile 的解码逻辑一致，二者共享 fileP/fileCache */
  async _decode(url) {
    const m = window.AudioMgr;
    if (!m) return;
    m._ensure();                                  // 确保上下文已创建（loading 期无手势也可 decode）
    if (!m.ctx) return;
    if (this.fileCache[url] || this.fileP[url]) return;
    this.fileP[url] = (async () => {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("sfx " + r.status);
      const ab = await r.arrayBuffer();
      return await m.ctx.decodeAudioData(ab.slice(0));
    })();
    try { const b = await this.fileP[url]; this.fileCache[url] = b; return b; }
    catch (e) { delete this.fileP[url]; return null; }
  },

  _ctx() {
    const m = window.AudioMgr;
    return m ? m.ctx : null;
  },

  _now() { const c = this._ctx(); return c ? c.currentTime : 0; },

  /* ---------------- 文件音效（配置指定） ---------------- */
  async playFile(url, opts = {}) {
    const m = window.AudioMgr;
    if (!m) return;
    await m.resume();
    const ctx = this._ctx();
    if (!ctx) return;
    let buf = this.fileCache[url];
    if (!buf) {
      try {
        if (this.fileP[url]) buf = await this.fileP[url];
        else {
          this.fileP[url] = (async () => {
            const r = await fetch(url, { cache: "no-store" });
            const ab = await r.arrayBuffer();
            return await ctx.decodeAudioData(ab.slice(0));
          })();
          buf = await this.fileP[url];
          this.fileCache[url] = buf;
        }
      } catch (e) { return; }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const v = this.vol * this.volOf(opts.event) * (opts.vol !== undefined ? opts.vol : 1);
    g.gain.setValueAtTime(v, this._now());
    src.connect(g); g.connect(m.sfxGain || m.master);
    src.start();
    // 播完即断开：防止频繁音效（移动/点击）在音频图中累积节点（移动端性能）
    src.onended = () => { try { g.disconnect(); src.disconnect(); } catch (e) {} };
  },

  /* ---------------- 程序化合成（可爱小音效） ---------------- */
  synth(name, opts = {}) {
    const m = window.AudioMgr;
    if (!m) return;
    m.resume();
    const ctx = this._ctx();
    if (!ctx) return;
    const v = this.vol * this.volOf(name) * (opts.vol !== undefined ? opts.vol : 1);
    const t0 = this._now();
    const out = ctx.createGain();
    out.gain.value = v;
    out.connect(m.sfxGain || m.master);
    // out 是整段音效的输出节点：播完（按各音效最大时长）统一断开，
    // 避免每次音效都在 master 上累积一个永久空闲的 gain（移动端性能）
    const sequenceDurations = { "care-wand": 0.65, embodiedAwaken: 1.35, embodiedNews: 0.95, embodiedLive: 1.9 };
    const outMs = (sequenceDurations[name] || (name === "fanfare" ? 0.8 : name === "sort_gold" || name === "rice_rainbow" ? 0.4 : name === "hammerToken" || name === "rice_gold" ? 0.34 : name === "sort_correct" || name === "rice_yue" ? 0.28 : name === "confirm" ? 0.22 : 0.2)) * 1000;
    setTimeout(() => { try { out.disconnect(); } catch (e) {} }, outMs);

    switch (name) {
      case "care-wand":
        [784,1175,1568].forEach((f,i)=>this._blip(ctx,out,t0+i*.09,f,f*1.025,.30,"sine",.22));
        this._noise(ctx,out,t0,.12,.035,2800,1400); break;
      case "embodiedAwaken":
        this._blip(ctx,out,t0,196,392,.72,"sine",.16);
        [523,659,784,1046].forEach((f,i)=>this._blip(ctx,out,t0+.34+i*.14,f,f*1.015,.47,"sine",.19));
        this._noise(ctx,out,t0+.18,.48,.045,650,2600); break;
      case "embodiedNews":
        [523,659,784,1046].forEach((f,i)=>this._blip(ctx,out,t0+i*.12,f,f,.38,"triangle",.21));
        this._noise(ctx,out,t0+.66,.035,.11,3200,1800); break;
      case "embodiedLive":
        [523,659,784].forEach(f=>this._blip(ctx,out,t0,f,f,1.45,"sine",.09));
        [784,1046,1175,1318,1568].forEach((f,i)=>this._blip(ctx,out,t0+i*.24,f,f,.42,"triangle",.16));
        [0,.48,.96,1.44].forEach(dt=>{this._blip(ctx,out,t0+dt,125,55,.13,"sine",.18);this._noise(ctx,out,t0+dt+.20,.065,.04,3000,1900);});
        break;
      case "move": this._blip(ctx, out, t0, 620, 900, 0.085, "triangle", 0.5); break;   // 蹦跳
      case "click": this._blip(ctx, out, t0, 880, 760, 0.07, "sine", 0.7); break;       // 点击
      case "hammer": // 短促木槌低音与清脆接触声，共用全局/单事件音量和节点清理。
        this._blip(ctx, out, t0, 190, 60, 0.12, "triangle", 0.7);
        this._blip(ctx, out, t0, 1150, 380, 0.055, "sine", 0.3);
        break;
      case "hammerSwing": this._noise(ctx,out,t0,.055,.22,1700,600); break;
      case "hammerHit":
        this._noise(ctx,out,t0,.035,.30,1900,550);
        this._blip(ctx,out,t0,210,65,.105,"triangle",.72);
        this._blip(ctx,out,t0,920,440,.042,"sine",.32); break;
      case "hammerFire":
        this._noise(ctx,out,t0,.045,.28,1400,350);
        this._blip(ctx,out,t0,145,58,.12,"triangle",.62);
        this._blip(ctx,out,t0,430,240,.075,"sine",.23); break;
      case "hammerToken":
        this._blip(ctx,out,t0,240,90,.09,"triangle",.55);
        this._blip(ctx,out,t0,1046,1080,.12,"sine",.38);
        this._blip(ctx,out,t0+.055,1568,1660,.2,"sine",.3); break;
      case "hammerWrong":
        this._noise(ctx,out,t0,.05,.18,650,240);
        this._blip(ctx,out,t0,320,125,.15,"sine",.55); break;
      case "hammerEmpty":
        this._noise(ctx,out,t0,.025,.18,2100,750);
        this._blip(ctx,out,t0,260,140,.055,"triangle",.5); break;
      case "sort_grab": this._noise(ctx,out,t0,.035,.17,2500,1700); break;
      case "sort_swipe": this._noise(ctx,out,t0,.085,.25,3200,650); break;
      case "sort_correct":
        this._blip(ctx,out,t0,784,830,.095,"sine",.52);
        this._blip(ctx,out,t0+.065,1175,1245,.15,"sine",.36); break;
      case "sort_gold":
        [1046,1318,1568].forEach((f,i)=>this._blip(ctx,out,t0+i*.055,f,f*1.06,.19,"sine",.38)); break;
      case "sort_wrong":
        this._blip(ctx,out,t0,390,290,.075,"triangle",.32);
        this._blip(ctx,out,t0+.065,245,180,.10,"sine",.38); break;
      case "sort_miss": this._blip(ctx,out,t0,350,160,.13,"sine",.38); break;
      case "rice_bite":
        this._noise(ctx,out,t0,.045,.10,850,460);
        this._blip(ctx,out,t0+.025,270,180,.075,"sine",.28); break;
      case "rice_yue":
        this._blip(ctx,out,t0,420,210,.14,"sine",.32);
        this._blip(ctx,out,t0+.075,230,135,.15,"sine",.25); break;
      case "rice_catch":
        this._blip(ctx,out,t0,690,950,.075,"sine",.42);
        this._noise(ctx,out,t0,.025,.07,1200,600); break;
      case "rice_gold":
        this._blip(ctx,out,t0,1046,1175,.12,"sine",.38);
        this._blip(ctx,out,t0+.065,1568,1660,.18,"sine",.30); break;
      case "rice_rainbow":
        [784,1046,1568].forEach((f,i)=>this._blip(ctx,out,t0+i*.055,f,f*1.12,.20,"sine",.32)); break;
      case "rice_black":
        this._blip(ctx,out,t0,310,130,.13,"sine",.40);
        this._noise(ctx,out,t0,.035,.08,520,230); break;
      case "ui": this._blip(ctx, out, t0, 520, 720, 0.09, "triangle", 0.6); break;      // 弹窗
      case "confirm": this._blip(ctx, out, t0, 700, 1040, 0.12, "sine", 0.6);
                      this._blip(ctx, out, t0 + 0.06, 1040, 1220, 0.14, "sine", 0.55); break;
      case "float": this._blip(ctx, out, t0, 1320, 1760, 0.085, "sine", 0.45);
                    this._blip(ctx, out, t0 + 0.05, 1760, 2100, 0.1, "sine", 0.35); break;  // 产出冒数字（叮铃上扬）
      /* 号角（2026-09-04 奖励演出「超越上一代模型」）：C-E-G-C 上扬琶音 + 顶部闪亮长音 */
      case "fanfare": {
        const seq = [[660, 680], [830, 860], [990, 1030], [1320, 1580]];
        seq.forEach((f, i) => this._blip(ctx, out, t0 + i * 0.1, f[0], f[1], 0.24, "triangle", 0.5));
        this._blip(ctx, out, t0 + 0.42, 1580, 1980, 0.34, "sine", 0.42);
        break;
      }
      default: this._blip(ctx, out, t0, 660, 880, 0.08, "sine", 0.5);
    }
  },

  /* 齿轮转动（训练时间流逝动画）：在 dur(ms) 内连续合成有节奏的齿轮咔哒声。
     dur ≤ 0 时静音返回。音高/间隔略作不规则，模拟齿轮棘轮锯齿感。 */
  gearLoop(dur, vol) {
    dur = dur || 0;
    if (dur <= 0) return;
    const m = window.AudioMgr;
    if (!m) return;
    m.resume();
    const ctx = this._ctx();
    if (!ctx) return;
    const out = ctx.createGain();
    out.gain.value = this.vol * (vol !== undefined ? vol : 0.5);
    out.connect(m.sfxGain || m.master);
    const t0 = this._now();
    const endT = t0 + dur / 1000;
    let t = t0, n = 0;
    while (t < endT) {
      // 咔哒主体（方波，短促，带阻尼）
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(58, t + 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.42, t + 0.011);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 0.09);
      o.onended = () => { try { g.disconnect(); o.disconnect(); } catch (e) {} };
      t += 0.07 + (n % 3) * 0.012;   // 轻微不规则 → 齿轮棘轮感
      n++;
    }
    setTimeout(() => { try { out.disconnect(); } catch (e) {} }, dur + 180);
  },

  /* A tiny shared noise buffer gives paper/air/wood texture without audio files.
     Each gesture owns only its short source/filter/envelope; all disconnect. */
  _noise(ctx, out, t0, dur, peak, from, to) {
    if (!this._noiseData || this._noiseContext !== ctx) {
      const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.12),ctx.sampleRate);
      const data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      this._noiseData=buffer;this._noiseContext=ctx;
    }
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this._noiseData;filter.type='bandpass';filter.Q.value=.65;
    filter.frequency.setValueAtTime(from,t0);filter.frequency.exponentialRampToValueAtTime(to,t0+dur);
    gain.gain.setValueAtTime(.0001,t0);gain.gain.exponentialRampToValueAtTime(peak,t0+.004);
    gain.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    source.connect(filter);filter.connect(gain);gain.connect(out);
    source.start(t0);source.stop(t0+dur+.01);
    source.onended=()=>{try{source.disconnect();filter.disconnect();gain.disconnect();}catch(e){}};
  },

  /* 单音：振荡器 + 音高包络 + 音量包络（短促可爱） */
  _blip(ctx, out, t0, f0, f1, dur, type, peak) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    // 播完即断开：短促音频繁触发（移动/点击）时防止节点在图中累积（移动端性能）
    o.onended = () => { try { g.disconnect(); o.disconnect(); } catch (e) {} };
  },
};

window.SFX = SFX;
