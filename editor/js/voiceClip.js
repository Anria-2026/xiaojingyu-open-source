/* ==========================================================================
   语音剪辑（doc/28）—— 音效配置页底部新增
   --------------------------------------------------------------------------
   做什么：**上传任意 .wav → 剪辑 → 一键保存到指定文件夹**。
   为什么要它：聊天玩法要播玩家/角色发的语音，录音原始素材一头一尾都是静音、
   响度也不齐，直接塞进游戏会出现「点了半天没声音 / 音量忽大忽小」。
   与「图片处理」页同款流程（上传 → 参数 → 输出目录 → 一键写入）：
     · 前端收集 base64（FileReader）→ POST /api/voice-clip
     · 后端 voice_proc.py（纯标准库）处理 → 写 resource/<输出目录>/<文件名>
     · 返回结果带 /resource/... 的 url → 直接试听处理后效果
   处理链（顺序固定）：裁切 → 去头尾静音 → 淡入淡出 → 峰值归一 → 声道
   ========================================================================== */
"use strict";

const VoiceClip = {
  items: [],            // {id,name,file,size,outName,outDir,cropStart,cropEnd,status,url,info}
  batch: {
    trimSilence: true, silenceThresh: 0.01, silencePadMs: 60,
    fadeInMs: 30, fadeOutMs: 30,
    normalize: true, targetDbfs: -1,
    channels: "keep",
  },
  /* 输出目录候选：语音相关放 audio/ 下，和 sfx / sound 并列，游戏里按 /resource/... 取 */
  DIRS: ["audio/voice", "audio/voice/chat", "audio/voice/event", "audio/sfx"],
  batchDir: "audio/voice",
  _uid: 0,
  _audio: null,         // 单例播放器：避免多行同时出声
  _playing: null,

  init() {
    const box = $("#voice-box");
    if (!box) return;
    /* 隐藏的文件输入：accept 只放 wav（后端只吃 PCM wav，别的格式会在服务端报错） */
    this.fileInput = h("input", {
      type: "file", multiple: "multiple", accept: ".wav,audio/wav,audio/x-wav", style: { display: "none" },
    });
    box.append(this.fileInput);
    this.fileInput.addEventListener("change", () => {
      for (const f of this.fileInput.files) this.addFile(f);
      this.fileInput.value = "";
      this.render();
    });
    this.render();
  },

  addFile(file) {
    if (!/\.wav$/i.test(file.name)) {
      UI.toast("只支持 .wav：" + file.name, "err");
      return;
    }
    const base = file.name.replace(/\.wav$/i, "");
    this.items.push({
      id: "v" + (++this._uid),
      name: file.name,
      file,
      size: file.size,
      outName: base + ".wav",
      outDir: this.batchDir,
      cropStart: "", cropEnd: "",
      status: "待处理", url: null, info: null,
    });
  },

  /* ---------------------------------------------------------------- 渲染 */
  render() {
    const box = $("#voice-box");
    if (!box) return;
    UI.clear(box);
    box.append(this.fileInput);

    /* ---- 标题 + 说明 ---- */
    box.append(h("div", { class: "sfx-gen-head" }, "🎙 语音剪辑（上传 wav → 剪辑 → 一键保存到指定文件夹）"));
    /* ⚠️ 这里是 DOM 不是 markdown —— 别再写 **加粗**，那会原样显示一堆星号 */
    box.append(h("div", { class: "sfx-hint" },
      h("span", {}, "用来处理聊天玩法里的语音：上传任意 .wav → 调参数（可逐条改目标名 / 输出目录 / 裁切）→ 点「一键保存」。"),
      h("br"),
      /* [feature:voice-clip-exact-hint-20261012] */
      h("span", {}, "有裁剪选区时按选区精确保留；未设置选区才使用去头尾静音。淡入淡出、峰值归一和声道设置仍生效；只接受未压缩 PCM wav（16-bit 最稳）。")));
      /* [/feature:voice-clip-exact-hint-20261012] */

    /* ---- 批量默认参数 ---- */
    const b = this.batch;
    const num = (label, key, step, min, max, unit) => h("label", { class: "vc-num" },
      label, h("input", {
        type: "number", value: b[key], step, min, max,
        onchange: (e) => { b[key] = e.target.value === "" ? "" : +e.target.value; },
      }), unit ? h("i", {}, unit) : null);
    const batchRow = h("div", { class: "vc-batch" },
      /* [feature:voice-clip-exact-checkbox-20261012] */
      UI.checkField("去头尾静音（整段）", b.trimSilence, (v) => { b.trimSilence = v; }),
      /* [/feature:voice-clip-exact-checkbox-20261012] */
      num("阈值", "silenceThresh", 0.005, 0, 1),
      num("留白", "silencePadMs", 10, 0, 1000, "ms"),
      num("淡入", "fadeInMs", 5, 0, 2000, "ms"),
      num("淡出", "fadeOutMs", 5, 0, 2000, "ms"),
      UI.checkField("峰值归一", b.normalize, (v) => { b.normalize = v; }),
      num("目标", "targetDbfs", 0.5, -40, 0, "dBFS"),
      h("label", { class: "vc-num" }, "声道",
        h("select", { onchange: (e) => { b.channels = e.target.value; } },
          h("option", { value: "keep" }, "保持原样"),
          h("option", { value: "mono" }, "单声道（推荐语音）"))),
      h("button", {
        class: "btn btn-sm", onclick: () => {
          this.items.forEach((it) => { it.outDir = this.batchDir; });
          this.render();
          UI.toast("批量输出目录已应用到 " + this.items.length + " 条");
        },
      }, "批量目录→全部"));

    /* ---- 工具条 ---- */
    const bar = h("div", { class: "vc-bar" },
      h("button", { class: "btn btn-primary", onclick: () => this.fileInput.click() }, "＋ 添加 wav 文件"),
      h("label", { class: "vc-num" }, "输出目录",
        (() => {
          const sel = h("select", { onchange: (e) => { this.batchDir = e.target.value; } },
            this.DIRS.map((d) => h("option", { value: d, selected: d === this.batchDir ? "selected" : null }, d)));
          return sel;
        })()),
      h("div", { class: "spacer" }),
      h("button", { class: "btn btn-sm btn-ghost", onclick: () => { this.items = []; this.render(); } }, "清空列表"),
      h("button", { class: "btn btn-primary", onclick: () => this.run() }, "🎬 一键保存"));

    box.append(batchRow, bar);

    /* ---- 列表 ---- */
    if (!this.items.length) {
      box.append(h("div", { class: "vc-empty" }, "还没有文件。点「＋ 添加 wav 文件」选任意 .wav（可多选）。"));
      return;
    }
    const list = h("div", { class: "vc-list" });
    this.items.forEach((it) => {
      list.append(this.row(it));
      if (it.editing) list.append(this.editor(it));   /* 剪辑面板：内联展开在该行下面 */
    });
    box.append(list);

    this.statusEl = h("span", { class: "img-status" }, "共 " + this.items.length + " 条");
    box.append(this.statusEl);
  },

  row(it) {
    const dirIn = h("input", {
      class: "vc-in vc-dir", type: "text", value: it.outDir,
      onchange: (e) => { it.outDir = e.target.value.trim(); },
    });
    /* 目录快捷按钮：与图片处理页同款 path-chip 词汇 */
    const chips = h("div", { class: "vc-chips" },
      ["audio/voice", "audio/voice/chat"].map((d) => h("button", {
        class: "path-chip" + (it.outDir === d ? " active" : ""),
        onclick: () => { it.outDir = d; this.render(); },
      }, d.replace("audio/", ""))));
    const crop = h("span", { class: "vc-crop" },
      h("input", { class: "vc-in vc-t", type: "number", step: "0.01", min: "0", placeholder: "起", value: it.cropStart, onchange: (e) => { it.cropStart = e.target.value; } }),
      "~",
      h("input", { class: "vc-in vc-t", type: "number", step: "0.01", min: "0", placeholder: "止", value: it.cropEnd, onchange: (e) => { it.cropEnd = e.target.value; } }),
      h("i", {}, "s"));
    const playBtn = (label, fn, on) => h("button", {
      class: "btn btn-sm btn-ghost" + (on ? " active" : ""), onclick: fn,
    }, label);
    const cut = (it.cropStart !== "" || it.cropEnd !== "")
      ? (it.cropStart || "0") + "s ~ " + (it.cropEnd || "末尾") : "整段";
    return h("div", { class: "vc-row" },
      h("div", { class: "vc-file" },
        h("b", { title: it.name }, it.name),
        h("i", {}, Math.round(it.size / 1024) + "KB")),
      h("input", { class: "vc-in vc-name", type: "text", value: it.outName, onchange: (e) => { it.outName = e.target.value.trim(); } }),
      dirIn, chips, crop,
      h("div", { class: "vc-acts" },
        /* 主入口：可视化剪辑（拖波形选段），比手填秒数直观 */
        h("button", {
          class: "btn btn-sm" + (it.editing ? " btn-primary" : ""),
          onclick: () => { it.editing = !it.editing; this.render(); },
        }, "✂ 剪辑"),
        h("span", { class: "vc-cut" }, cut),
        playBtn(this._playing === it.id + ":in" ? "⏸ 原声" : "▶ 原声", () => this.preview(it, "in"), this._playing === it.id + ":in"),
        it.url ? playBtn(this._playing === it.id + ":out" ? "⏸ 处理后" : "▶ 处理后", () => this.preview(it, "out"), this._playing === it.id + ":out") : null,
        h("button", { class: "btn btn-sm btn-ghost", onclick: () => { this.items = this.items.filter((x) => x !== it); this.render(); } }, "✕")),
      /* 状态与信息单独一行（整行铺满）：处理完会带「1.35s → 0.39s（去静音 960ms）· 1ch · 40KB」 */
      (it.status === "待处理" && !it.info) ? null : h("div", { class: "vc-msg" },
        h("span", { class: "vc-status" + (it.ok === true ? " ok" : it.ok === false ? " err" : "") }, it.status),
        it.info ? h("span", { class: "vc-info" },
          it.info.inSec + "s → " + it.info.outSec + "s",
          (it.info.trimmedMs ? "（缩短 " + it.info.trimmedMs + "ms）" : ""),
          " · " + it.info.outChannels + "ch · " + (it.outKB != null ? it.outKB + "KB" : "—") + "）") : null));
  },

  /* ================================================================
     可视化剪辑面板：画波形 + 拖两端手柄选段 + 试听选区
     （2026-09-11 用户要的是"能拖的剪辑界面"，不是让他手填两个时间点。
       项目里**没有**现成的音频剪辑 UI —— 生成音频后只有 试听/应用/删除，
       所以这里从零写一个；后端不用改：裁切本来就吃 cropStart/cropEnd。）
     ================================================================ */
  editor(it) {
    const wrap = h("div", { class: "vc-editor" });
    const info = h("span", { class: "vc-ed-info" }, "读取波形中…");
    const cv = h("canvas", { class: "vc-canvas" });
    const dimL = h("div", { class: "vc-dimp vc-dimp-l" });
    const dimR = h("div", { class: "vc-dimp vc-dimp-r" });
    const hL = h("i", { class: "vc-h vc-h-l", title: "拖我选起点" });
    const hR = h("i", { class: "vc-h vc-h-r", title: "拖我选终点" });
    const sel = h("div", { class: "vc-sel" });
    sel.append(hL, hR);
    const wave = h("div", { class: "vc-wave" }, cv, dimL, dimR, sel);

    const bar = h("div", { class: "vc-ed-bar" },
      info,
      h("div", { class: "spacer" }),
      h("button", { class: "btn btn-sm btn-ghost", onclick: () => this.playSel(it) }, "▶ 试听选区"),
      /* [feature:voice-clip-full-selection-explicit] */
      h("button", { class: "btn btn-sm btn-ghost", onclick: () => { it._sel = { a: 0, b: 1 }; it._selectionExplicit = true; this._syncSel(it, wave, sel, dimL, dimR, info); } }, "↺ 全选"),
      /* [/feature:voice-clip-full-selection-explicit] */
      h("button", { class: "btn btn-sm", onclick: () => {
        /* [feature:voice-clip-selection-use-precision] */
        const range = this.selectionRange(it);
        it.cropStart = range.start;
        it.cropEnd = Number(it._sel.b) === 1 ? "" : range.end;
        it._selectionExplicit = true;
        it.editing = false; this.render();
        UI.toast("已选段 " + range.start.toFixed(2) + "s ~ " + range.end.toFixed(2) + "s，点「一键保存」写入");
        /* [/feature:voice-clip-selection-use-precision] */
      } }, "✓ 用这段"),
      h("button", { class: "btn btn-sm btn-ghost", onclick: () => { it.editing = false; this.render(); } }, "✕ 关闭"));

    wrap.append(h("div", { class: "vc-ed-head" },
      "✂ " + it.name + " —— 拖两端的手柄选择要保留的片段（选区外会变暗）"), wave, bar);

    /* 面板要先挂进 DOM 才能量宽度 → 下一拍再解码/绘制 */
    setTimeout(() => {
      this._loadWave(it).then(() => {
        this._paint(it, wave, sel, dimL, dimR, info, cv);
        const drag = (which) => (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const rect = wave.getBoundingClientRect();
          const move = (e) => {
            const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const s = it._sel;
            /* [feature:voice-clip-drag-selection-explicit] */
            if (which === "l") s.a = Math.min(f, s.b - 0.004);
            else s.b = Math.max(f, s.a + 0.004);
            it._selectionExplicit = true;
            /* [/feature:voice-clip-drag-selection-explicit] */
            this._syncSel(it, wave, sel, dimL, dimR, info);
          };
          const up = () => {
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", up);
          };
          document.addEventListener("pointermove", move);
          document.addEventListener("pointerup", up);
        };
        hL.addEventListener("pointerdown", drag("l"));
        hR.addEventListener("pointerdown", drag("r"));
      }).catch((e) => { info.textContent = "波形读取失败：" + e.message; });
    }, 0);
    return wrap;
  },

  /* 解码 + 抽峰值（每像素一个 min/max 幅度，够画包络了） */
  async _loadWave(it) {
    /* [feature:voice-clip-wave-buffer-cache-20261012] */
    if (it._peaks && it._dur && it._buffer) return;
    /* [/feature:voice-clip-wave-buffer-cache-20261012] */
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!this._ac) this._ac = new AC();
    /* ⚠️ decodeAudioData 会「吃掉」传入的 ArrayBuffer → 每次都要新的 */
    const buf = await this._ac.decodeAudioData(await it.file.arrayBuffer());
    /* [feature:voice-clip-wave-buffer-20261012] */
    it._buffer = buf; it._dur = buf.duration;
    /* [/feature:voice-clip-wave-buffer-20261012] */
    const ch = buf.getChannelData(0);
    /* [feature:voice-clip-wave-all-samples-count] */
    const N = 1000;
    /* [/feature:voice-clip-wave-all-samples-count] */
    const pk = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let mx = 0;
      /* [feature:voice-clip-wave-tail-samples] */
      const s0 = Math.floor(i * ch.length / N), s1 = Math.floor((i + 1) * ch.length / N);
      for (let k = s0; k < s1; k++) { const v = Math.abs(ch[k] || 0); if (v > mx) mx = v; }
      /* [/feature:voice-clip-wave-tail-samples] */
      pk[i] = mx;
    }
    it._peaks = pk;
    if (!it._sel) it._sel = { a: 0, b: 1 };
  },

  _paint(it, wave, sel, dimL, dimR, info, cv) {
    const w = Math.max(240, wave.clientWidth || cv.parentElement.clientWidth || 760);
    const hh = 88;
    cv.width = w; cv.height = hh;
    const g = cv.getContext("2d");
    g.clearRect(0, 0, w, hh);
    const pk = it._peaks, mid = hh / 2;
    if (pk) {
      /* 已选区间内用亮色、外面用暗色 —— 不靠遮罩也能一眼看出选段 */
      const s = it._sel, x0 = s.a * w, x1 = s.b * w;
      for (let x = 0; x < w; x++) {
        const a = Math.max(1, pk[Math.floor((x / w) * pk.length)] * (hh / 2 - 4));
        g.fillStyle = (x >= x0 && x <= x1) ? "#6ea8ff" : "#3d5570";
        g.fillRect(x, mid - a, 1, a * 2);
      }
    }
    this._syncSel(it, wave, sel, dimL, dimR, info);
  },

  /* [feature:voice-clip-precise-selection-range] */
  selectionRange(it) {
    const buffer = it._buffer, rate = Number(buffer?.sampleRate), length = Number(buffer?.length);
    const decoded = Number(buffer?.duration);
    const sampledLength = Number.isFinite(rate) && rate > 0 && Number.isFinite(length) && length > 0 ? length / rate : 0;
    const duration = Number.isFinite(decoded) && decoded > 0 ? decoded : sampledLength || Math.max(0, Number(it._dur) || 0);
    const sampled = sampledLength || duration;
    const selection = it._sel || { a: 0, b: 1 };
    const fraction = value => Math.max(0, Math.min(1, Number(value) || 0));
    const a = fraction(selection.a), b = fraction(selection.b);
    return { start: Math.min(duration, a * sampled), end: b === 1 ? duration : Math.min(duration, b * sampled), duration };
  },
  /* [/feature:voice-clip-precise-selection-range] */
  _syncSel(it, wave, sel, dimL, dimR, info) {
    const w = wave.clientWidth || 760;
    const s = it._sel || (it._sel = { a: 0, b: 1 });
    const x0 = Math.round(s.a * w), x1 = Math.round(s.b * w);
    sel.style.left = x0 + "px";
    sel.style.width = Math.max(2, x1 - x0) + "px";
    dimL.style.width = x0 + "px";
    dimR.style.left = x1 + "px";
    dimR.style.width = Math.max(0, w - x1) + "px";
    /* [feature:voice-clip-selection-display-range] */
    const range = this.selectionRange(it), d = range.duration;
    const a = range.start, b = range.end;
    /* [/feature:voice-clip-selection-display-range] */
    info.textContent = "选区 " + a.toFixed(2) + "s ~ " + b.toFixed(2) + "s（长 " + (b - a).toFixed(2)
      + "s / 全长 " + d.toFixed(2) + "s）";
  },

  /* [feature:voice-clip-playback-boundary-20261012] */
  _clearSelectionPlayback() {
    this._selectionToken = (this._selectionToken || 0) + 1;
    const playback = this._selectionPlayback;
    this._selectionPlayback = null;
    if (!playback) return;
    playback.source.onended = null;
    try { playback.source.stop(); } catch (_) {}
    playback.source.disconnect();
  },

  /* WebAudio stops at the exact saved selection, without timeupdate overshoot. */
  async playSel(it) {
    this._clearSelectionPlayback();
    const token = this._selectionToken;
    if (this._audio) { this._audio.pause(); this._audio.onended = null; }
    this._playing = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!this._ac) this._ac = new AC();
      // Resume during the click gesture, before awaiting waveform decoding.
      const resume = this._ac.state === "suspended" ? this._ac.resume() : Promise.resolve();
      await Promise.all([this._loadWave(it), resume]);
      if (this._selectionToken !== token) return;
      /* [feature:voice-clip-selection-play-precision] */
      const range = this.selectionRange(it), s0 = range.start, s1 = range.end;
      /* [/feature:voice-clip-selection-play-precision] */
      if (!(s1 > s0)) throw new Error("选区为空，请重新选择");
      const source = this._ac.createBufferSource();
      source.buffer = it._buffer;
      source.connect(this._ac.destination);
      const playback = { source, token };
      this._selectionPlayback = playback;
      source.onended = () => {
        if (this._selectionPlayback !== playback || this._selectionToken !== token) return;
        this._selectionPlayback = null;
        source.onended = null;
        source.disconnect();
      };
      source.start(0, s0, s1 - s0);
      this.render();
    } catch (e) {
      if (this._selectionToken !== token) return;
      this._clearSelectionPlayback();
      UI.toast("试听失败：" + e.message, "err");
    }
  },

  /* ---------------------------------------------------------------- 播放 */
  preview(it, which) {
    const key = it.id + ":" + which;
    if (!this._audio) this._audio = new Audio();
    const a = this._audio;
    this._clearSelectionPlayback();
    if (this._playing === key) { a.pause(); this._playing = null; this.render(); return; }
    a.pause();
    if (which === "in") {
      if (this._origUrl) URL.revokeObjectURL(this._origUrl);
      this._origUrl = URL.createObjectURL(it.file);
      a.src = this._origUrl;
    } else {
      a.src = it.url;
    }
    a.currentTime = 0;
    this._playing = key;
    a.onended = () => { this._playing = null; this.render(); };
    a.play().catch((e) => { UI.toast("试听失败：" + e.message, "err"); this._playing = null; this.render(); });
    this.render();
  },
  /* [/feature:voice-clip-playback-boundary-20261012] */
  /* ---------------------------------------------------------------- 保存 */
  async run() {
    if (!this.items.length) { UI.toast("先添加 wav 文件", "err"); return; }
    const b = this.batch;
    this.statusEl && (this.statusEl.textContent = "正在处理…");
    try {
      const payload = [];
      for (const it of this.items) {
        it.status = "读取中…"; it.ok = null;
        const dataUrl = await this.fileToDataUrl(it.file);
        payload.push({
          filename: it.name, dataUrl, outDir: it.outDir || this.batchDir, outName: it.outName,
          opts: {
            cropStart: it.cropStart === "" ? null : it.cropStart,
            cropEnd: it.cropEnd === "" ? null : it.cropEnd,
            /* [feature:voice-clip-exact-payload-20261012] */
            // Manual boundaries describe the exact saved selection; do not trim it again.
            trimSilence: !!b.trimSilence && [it.cropStart, it.cropEnd].every(v => v == null || String(v).trim() === ""),
            silenceThresh: +b.silenceThresh || 0.01,
            /* [/feature:voice-clip-exact-payload-20261012] */
            silencePadMs: +b.silencePadMs || 0,
            fadeInMs: +b.fadeInMs || 0, fadeOutMs: +b.fadeOutMs || 0,
            normalize: !!b.normalize, targetDbfs: +b.targetDbfs || -1,
            channels: b.channels || "keep",
          },
        });
      }
      const res = await fetch("/api/voice-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      let ok = 0, fail = 0;
      (data.results || []).forEach((r) => {
        const it = this.items.find((x) => x.name === r.filename);
        if (!it) return;
        if (r.ok) {
          /* [feature:voice-clip-preview-version-20261012] */
          const revision = (this._previewRevision = (this._previewRevision || 0) + 1);
          it.ok = true; it.url = r.url ? r.url + (r.url.includes("?") ? "&" : "?") + "vc=" + Date.now() + "-" + revision : null;
          it.info = r.info; it.outKB = r.outKB;   /* outKB 在结果层级，不在 info 里 */
          /* [/feature:voice-clip-preview-version-20261012] */
          it.status = "✓ 已保存 → " + r.outPath;
          ok++;
        } else {
          it.ok = false; it.status = "✗ " + (r.error || "失败");
          fail++;
        }
      });
      this.render();
      if (this.statusEl) {
        this.statusEl.textContent = "完成：成功 " + ok + " 项" + (fail ? "，失败 " + fail + " 项" : "") ;
        this.statusEl.className = "img-status " + (fail ? "err" : "ok");
      }
      UI.toast(fail ? ("完成，但有 " + fail + " 项失败") : ("已保存 " + ok + " 条语音"), fail ? "err" : "ok");
    } catch (e) {
      if (this.statusEl) { this.statusEl.textContent = "处理失败：" + e.message; this.statusEl.className = "img-status err"; }
      UI.toast("处理失败：" + e.message, "err");
    }
  },

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  },

  refresh() { this.init(); },
};

/* 显式暴露：顶层 const 不挂 window（与 sfxTool / imageTool 同理） */
window.VoiceClip = VoiceClip;
