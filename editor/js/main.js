/* ==========================================================================
   入口：项目管理、分页初始化、保存/加载
   ========================================================================== */
"use strict";

const App = {
  project: new Project(),
  _lastSavedJson: "",   // 最近成功保存的内容（用于自动保存对比）
  _lastSnapJson: "",    // 最近生成过快照的内容（避免重复快照）

  async init() {
    // 加载 resource 目录列表（图片处理快捷按钮用；过滤音频等非美术目录）
    try {
      const d = await (await fetch("/api/list-dirs")).json();
      window.__resourceDirs = d.dirs || ["character", "scene", "event"];
    } catch (e) {
      window.__resourceDirs = ["character", "scene", "event"];
    }
    const AUDIO = ["sound", "audio", "music", "bgm", "sfx", "voice"];
    window.__artDirs = (window.__resourceDirs || []).filter((x) => !AUDIO.includes(x));
    if (!window.__artDirs.length) window.__artDirs = ["character", "scene", "event"];
    // 加载场景图列表
    try {
      const f = await (await fetch("/api/list-files/scene")).json();
      window.__sceneFiles = f.files || [];
    } catch (e) {
      window.__sceneFiles = [];
    }
    // 加载项目数据
    try {
      const p = await (await fetch("/api/load-project")).json();
      if (p && p.scenes && p.scenes.length) this.project = Project.fromJSON(p);
    } catch (e) { /* 空项目 */ }

    // 分页（§二.4；含 BGM / 玩法配置 / UI 配置 / 文本 / 界面立绘 / 事件 / 工程师 / 历史回溯页）
    UI.initTabs({
      map: () => { MapEditor.resize(); MapEditor.inspector(); },
      image: () => ImageTool.render(),
      /* 2026-09-11 doc/28：音效页底部新增「语音剪辑」（上传 wav → 剪辑 → 一键保存） */
      /* [feature:seed-audio-editor-tab] */
      sfx: () => { SFXTool.refresh(); if (window.VoiceClip) VoiceClip.init(); if (window.SeedAudioTool) SeedAudioTool.refresh(); },
      /* [/feature:seed-audio-editor-tab] */
      bgm: () => BgmTool.refresh(),
      gamecfg: () => GameCfgTool.refresh("base"),
      minigames: () => MinigamesTool.refresh(),
      /* [feature:outfits-editor-tab] */
      outfits: () => OutfitsTool.refresh(),
      /* [/feature:outfits-editor-tab] */
      "life-story": () => LifeStoryTool.refresh(),
      /* [feature:journey-editor] */
      journey: () => JourneyTool.refresh(),
      /* [/feature:journey-editor] */
      show: () => GameCfgTool.refresh("show"),
      trait: () => GameCfgTool.refresh("trait"),
      axis: () => GameCfgTool.refresh("axis"),
      uicfg: () => UICfgTool.refresh(),
      text: () => TextTool.refresh(),
      ui: () => UIPortraitTool.refresh(),
      event: () => EventTool.refresh(),
      notice: () => NoticeTool.refresh(),
      /* 2026-09-11：鲸鱼剧本已并入测试界面 —— 同一个玩法（测试聊天）不再分两个分页 */
      testui: () => { if (window.ChatTreeTool) ChatTreeTool.refresh(); },   // 2026-09-19：TEST_QA 已删，测试界面 = 对话树可视化编辑器
      engineer: () => EngineerTool.refresh(),
      paper: () => PaperTool.refresh(),
  achv: () => AchvTool.refresh(),
      history: () => HistoryTool.refresh(),
    });

    // 保存 / 加载
    $("#btn-save").addEventListener("click", () => this.save());
    $("#btn-load").addEventListener("click", () => this.load());

    // 确保至少有一个场景（须在 MapEditor.init 之前，其 layout 依赖 scene）
    if (this.project.scenes.length === 0) this.project.addScene("场景1");
    // 默认第一张场景图（若未配置）
    const sc0 = this.project.scene;
    if (!sc0.bg && window.__sceneFiles.length) {
      sc0.bg = window.__sceneFiles.includes("ocean.webp") ? "ocean.webp" : window.__sceneFiles[0];
    }
    if (!sc0.player.src) sc0.player.src = "stand.webp";

    // 启动地图编辑器
    MapEditor.init();
    MapEditor.loadScene(this.project.scene);
    MapEditor.inspector();

    // 初始化各配置页（事件绑定一次；切 tab 走 refresh 刷新数据）
    // 注意：顶层 const 不挂 window（只有 var/function 会），必须直接引用调用；
    // 用 window.X 判断会永远为 false → init 不执行 → 按钮/下拉全是死的（踩过的坑）
    ImageTool.init();
    if (window.VoiceClip) VoiceClip.init();          /* doc/28 语音剪辑 */
    SFXTool.init();
    /* [feature:seed-audio-editor-init] */
    if (window.SeedAudioTool) SeedAudioTool.init();
    /* [/feature:seed-audio-editor-init] */
    BgmTool.init();
    GameCfgTool.init();
    LifeStoryTool.init();
    /* [feature:journey-editor] */
    JourneyTool.init();
    /* [/feature:journey-editor] */
    UICfgTool.init();
    TextTool.init();
    UIPortraitTool.init();
    EventTool.init();
    NoticeTool.init();
    ChatTreeTool.init();
    EngineerTool.init();
    PaperTool.init();
AchvTool.init();
    HistoryTool.init();

    // ---- 自动保存（§二「数据驱动闭环」）：内容变化自动落盘 + 快照，刷新不丢工作 ----
    this._lastSavedJson = this.project.toJSON();
    this._lastSnapJson = this._lastSavedJson;
    this._cfgDirty = false;   // 配置分页有未落盘改动时点亮保存按钮（2026-09-05）
    setInterval(() => this.autoSave(), 2500);

    // ---- 视图记忆（§二.1）：恢复上次 tab/滚动/场景，离开时保存 ----
    history.scrollRestoration = "manual";
    ViewMemory.load();
    setTimeout(() => ViewMemory.apply(), 80);
    ViewMemory.bindScroll();
    window.addEventListener("beforeunload", () => ViewMemory.save());
    window.addEventListener("pagehide", () => {
      ViewMemory.save();
      this.flushPending();   // 关页/刷新前把未落盘的改动用 sendBeacon 补存
    });
  },

  /* 配置分页有未落盘改动 → 保存按钮点亮提醒（只有手动「保存全部」才会熄灭） */
  markCfgDirty() {
    if (this._cfgDirty) return;
    this._cfgDirty = true;
    const btn = document.getElementById("btn-save");
    if (btn) btn.classList.add("cfg-dirty");
  },

  /* 关页兜底：改动还没等到 2.5s 轮询就刷新/关页 → sendBeacon 补存（不生成快照防刷屏） */
  flushPending() {
    try {
      const j = this.project.toJSON();
      if (j === this._lastSavedJson) return;
      const body = JSON.stringify({ json: j, snapshot: false });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/save-project", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/save-project", { method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json" }, body });
      }
      this._lastSavedJson = j;
    } catch (e) { /* 关页阶段尽力而为 */ }
  },

  /* 自动保存轮询：内容有变化才静默保存 */
  autoSave() {
    const j = this.project.toJSON();
    if (j === this._lastSavedJson) return;
    this._lastSavedJson = j;
    this.save({ silent: true });
  },

  /* 保存（silent=静默自动保存；snapshot 由内容是否变化决定，避免重复快照）
     20260829r：右上角按钮改为「保存全部」——点一次 = 项目 + 所有配置分页
     （玩法配置 / 界面立绘 / 事件 / 工程师 / 气泡台词 / BGM / 音效）全部落盘同步，
     各分页不再有自己的保存按钮，忘点按钮导致没保存的问题就此根除。 */
  async save({ silent = false } = {}) {
    const json = this.project.toJSON();
    const snapshot = json !== this._lastSnapJson;
    if (!silent) this.setIndicator("保存中…");
    try {
      const res = await fetch("/api/save-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json, snapshot }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "未知");
      this._lastSavedJson = json;
      if (snapshot) this._lastSnapJson = json;
    } catch (e) {
      this.setIndicator("保存失败", "err");
      if (!silent) UI.toast("项目保存失败：" + e.message, "err");
      return false;
    }
    /* 2026-09-05 改（用户拍板）：自动保存 = **暂时保存**，只写项目 JSON（编辑器内容）。
       配置分页（玩法/事件/提示/BGM…）的落盘必须用户亲点「保存全部」——
       此前自动保存会把所有打开过的分页的**旧内存**一并写回，页面不刷新时
       文件上的新改动（如删掉的词条）会被旧数据覆盖回去（学术复活事故的根因）。
       项目 JSON 的自动落盘保留：那是编辑器自己的内容，刷新不丢工作。 */
    if (silent) {
      this.setIndicator("已自动保存（项目）· 配置待点「保存全部」 " + new Date().toLocaleTimeString("zh-CN", { hour12: false }), "ok");
      return true;
    }
    const cfg = await this.syncAllConfigs();
    if (cfg.ok) {
      UI.toast("✅ 项目 + 全部配置已保存并同步到游戏");
      this.setIndicator("已保存", "ok");
      this._cfgDirty = false;
      const btn = document.getElementById("btn-save");
      if (btn) btn.classList.remove("cfg-dirty");
      return true;
    }
    this.setIndicator("保存失败", "err");
    const msg = "以下配置保存失败：" + cfg.failed.map((f) => `${f.name}（${f.err}）`).join("、");
    UI.toast(msg, "err");
    return false;
  },

  /* 所有配置分页统一落盘。分页没打开过（工作副本未加载）就跳过——服务端数据保持原样。
     音效平台配置（API Key 等）只在输入框有内容时顺带提交，避免空值覆盖。 */
  async syncAllConfigs() {
    const jobs = [
      ["玩法配置", () => GameCfgTool.data && GameCfgTool.save({ silent: true })],
      ["完整的一生", () => LifeStoryTool.loaded && LifeStoryTool.dirty && LifeStoryTool.save({ silent: true })],
      /* [feature:journey-editor] */
      ["旅行鲸鱼", () => JourneyTool.loaded && JourneyTool.dirty && JourneyTool.save({ silent: true })],
      /* [/feature:journey-editor] */
      /* [feature:seed-audio-line-draft-save-all] */
      ["配音提示词草稿", () => window.SeedAudioTool?._initialized && SeedAudioTool.flushLineDrafts(false, { strict: true })],
      /* [/feature:seed-audio-line-draft-save-all] */
      ["UI配置", () => UICfgTool.loaded && UICfgTool.save({ silent: true })],
      ["文本", () => TextTool.loaded && TextTool.dirtyCount() && TextTool.save({ silent: true })],
      ["界面立绘", () => UIPortraitTool.data && UIPortraitTool.save({ silent: true })],
      ["事件", () => EventTool.data && EventTool.save({ silent: true })],
      ["新闻与提示", () => NoticeTool.hints && NoticeTool.news && NoticeTool.save({ silent: true })],
      ["鲸鱼剧本", () => ChatTreeTool.data && ChatTreeTool.save({ silent: true })],
      ["工程师", () => EngineerTool.data && EngineerTool.save({ silent: true })],
      ["论文", () => PaperTool.pool && PaperTool.save({ silent: true })],
  ["成就", () => AchvTool.data && AchvTool.save({ silent: true })],
      ["BGM", () => BgmTool.cfg && BgmTool.save({ silent: true })],
      ["音效映射", () => SFXTool.cfg && SFXTool.save({ silent: true })],
      /* 办公室座位：各阶段场景的座位坐标换算成百分比写入游戏 SCENES，
         容量 = 可招聘人数上限；游戏端 core.scene() 直接消费。 */
      ["办公室座位", async () => {
        const response = await fetch("/api/game-cfg");
        if (!response.ok) throw new Error("读取场景配置失败，未覆盖已有配置");
        const current = await response.json();
        if (window.CfgSync) CfgSync.note(current);
        /* [feature:v2a-map-save] */
        const cfg = await MapMovement.exportScenes(App.project.scenes, (current.config || {}).SCENES || {});
        /* [/feature:v2a-map-save] */
        return fetch("/api/game-cfg-save", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section: "SCENES", config: cfg,
                                 expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
        }).then(async (r) => {
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || "未知");
          if (window.CfgSync) CfgSync.update(d.mtime);
        });
      }],
    ];
    const failed = [];
    for (const [name, job] of jobs) {
      try {
        const p = job();
        if (p) await p;
      } catch (e) {
        failed.push({ name, err: e.message || "未知" });
      }
    }
    try {
      const keyIn = $("#sfx-key"), urlIn = $("#sfx-local-url");
      if ((keyIn && keyIn.value.trim()) || (urlIn && urlIn.value.trim())) {
        await SFXTool.saveServerCfg({ silent: true });
      }
    } catch (e) {
      failed.push({ name: "音效平台配置", err: e.message || "未知" });
    }
    return { ok: !failed.length, failed };
  },

  setIndicator(text, cls) {
    const ind = $("#save-indicator");
    if (!ind) return;
    ind.textContent = text;
    ind.className = "save-indicator" + (cls ? " " + cls : "");
  },

  /* 重载项目（历史恢复 / 恢复出厂后调用），并刷新地图编辑器 */
  async reload() {
    try {
      const p = await (await fetch("/api/load-project")).json();
      if (p && p.scenes && p.scenes.length) {
        this.project = Project.fromJSON(p);
        MapEditor.onSceneChanged();
        MapEditor.inspector();
      }
    } catch (e) {
      UI.toast("重载失败：" + e.message, "err");
    }
    this._lastSavedJson = this.project.toJSON();
    this._lastSnapJson = this._lastSavedJson;
    SFXTool.refresh();
    BgmTool.refresh();
    HistoryTool.refresh();
    return this.project;
  },

  async load() {
    const data = await (await fetch("/api/load-project")).json();
    if (data && data.scenes && data.scenes.length) {
      this.project = Project.fromJSON(data);
      MapEditor.onSceneChanged();
    } else {
      alert("没有可加载的项目数据");
    }
  },
};

window.addEventListener("DOMContentLoaded", () => App.init());
