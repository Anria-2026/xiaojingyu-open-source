/* ==========================================================================
   玩法界面（训练）—— 二次元可爱风
   --------------------------------------------------------------------------
   - 主场景右下角「开始训练」→ 打开本界面
   - 右上角：关闭 / 说明 / 菜单（音量）
   - 说明 / 菜单为二级小弹窗，点击任意处或关闭按钮手动关闭
   - 音量实时写 AudioMgr.master（音乐）与 SFX.vol（音效）
   ========================================================================== */
"use strict";

const Training = {
  el: null,
  _shown: false,

  init() {
    this.el = document.getElementById("training");
    const btn = document.getElementById("btn-train");
    btn.addEventListener("click", () => { SFX.play("ui"); this.open(); });

    // HUD 顶部操作按钮（存档/说明/菜单/关闭，招募阶段由玩法 HUD 动态渲染 id）
    // 改为 document 级事件委托，兼容静态与动态渲染的 id 按钮
    document.addEventListener("click", (e) => {
      if (e.target.closest("#train-close")) { SFX.play("click"); this.close(); }
      else if (e.target.closest("#train-help")) {
        SFX.play("click");
        // 玩法已启动 → 打开玩法内「简要说明」（含分阶段教学 + 当前达标线）；
        // 玩法未启动 → 回退旧的静态弹窗
        if (window.GameUI && window.GameUI.core && window.GameUI.core.state) GameUI.openHelp();
        else this.openPop("train-help-pop");
      }
      else if (e.target.closest("#train-menu")) { SFX.play("click"); this.openPop("train-menu-pop"); }
    });

    // 重新开始游戏（清档 + 重置到招募阶段）
    document.getElementById("train-restart").addEventListener("click", () => { SFX.play("click"); this.restartGame(); });

    // 弹窗关闭按钮
    document.querySelectorAll(".pop-btn[data-close]").forEach((b) => {
      b.addEventListener("click", () => { SFX.play("click"); this.closePop(b.dataset.close); });
    });
    // 点击弹窗遮罩（非卡片区域）关闭
    document.querySelectorAll(".train-pop").forEach((p) => {
      p.addEventListener("click", (e) => { if (e.target === p) this.closePop(p.id); });
    });

    // 音量条
    document.getElementById("vol-music").addEventListener("input", (e) => this.setMusic(+e.target.value));
    document.getElementById("vol-sfx").addEventListener("input", (e) => this.setSfx(+e.target.value));

    /* Toy 云存档 / 排行榜：绑定生命周期（页面隐藏时落盘）+ 补发失败的上报。
       非 Toy 环境（Vercel / 本地 / 预览页）内部会整块短路，零调用零报错。
       init() 自身幂等，重复调用无副作用。 */
    if (window.ToyCloud) {
      try { window.ToyCloud.init(); } catch (e) {}
    }
  },

  setMusic(v) { if (window.AudioMgr) AudioMgr.setMusicVolume(v); },  // 单点结算
  setSfx(v) { if (window.SFX) SFX.setVolume(v); },

  /* BGM 兜底（2026-09-01 修复「办公室没声音」）：进入玩法先恢复音频上下文；
     若没有正在播放的曲目（被 stop / 音量流程误杀），起播场景曲，保证办公室有 BGM。 */
  ensureBgm() {
    const m = window.AudioMgr;
    if (!m) return;
    m.resume();
    if (m.cur) return;                       // 已有播放中的曲目 → 不动它
    fetch("./data/bgm_config.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((cfg) => {
        const u = (cfg && cfg.scene) || "";
        if (u && !m.cur) m.playBgm(u);
      }).catch(() => {});
  },

  /* 重新开始游戏：二次确认后清空自动存档 + 重置养成进度到初始招募阶段并重绘
     2026-09-16：原生 confirm 在 Toy/B 站沙箱 iframe 里被静默拦截（永远返回 false）
     → 复用 GameUI.askConfirm 自家弹窗（沙箱里点不动确认按钮的根源） */
  restartGame() {
    if (!window.GameCore || !window.GameUI || !window.GameUI.el) return;
    window.GameUI.askConfirm("重新开始训练？", "将清空当前训练进度（含自动存档），重新回到初始招募阶段。", () => {
      if (window.GameSave) window.GameSave.remove("auto");
      window.GameCore.newGame();       // 生成全新状态 + 重刷候选人
      window.GameUI.render();          // 重绘到招募界面
      this.closePop("train-menu-pop"); // 关闭菜单弹窗
    }, { danger: true, okText: "重新开始" });
  },

  open() {
    if (this._shown) return;
    this._shown = true;
    /* 2026-08-30：el 兜底——menu 点击早于 main.js init 完成时 init 可能尚未绑定 */
    this.el = this.el || document.getElementById("training");
    this.el.hidden = false;
    this.closePop("train-help-pop");
    this.closePop("train-menu-pop");
    // 音量条恢复上次保存值（刷新不重置）
    const vm = document.getElementById("vol-music");
    const vs = document.getElementById("vol-sfx");
    try {
      if (vm) vm.value = String(parseFloat(localStorage.getItem("whale_music_vol") || "0.6"));
      if (vs) vs.value = String(parseFloat(localStorage.getItem("whale_sfx_vol") || "0.9"));
    } catch (e) {}
    // 大模型研发养成玩法：打开训练界面即启动/恢复（占位卡片让位给玩法）
    this.launchDevGame();
    this.ensureBgm();
  },

  /* 启动/恢复大模型研发养成玩法（有自动存档自动恢复；先加载外部配置） */
  async launchDevGame() {
    if (!window.GameUI || !window.GameCore) return;
    const dev = document.getElementById("devgame");
    const body = document.getElementById("train-body");
    if (dev) dev.hidden = false;
    if (body) body.hidden = true;
    try {
      // 「玩法配置」页保存的数值/事件覆盖出厂默认
      await GameCfg.loadExternal();
      GameUI.init(GameCore, GameSave);
      GameCore.init(GameCfg);
      GameUI.launch();
    } catch (e) {
      console.error("[Training] 玩法启动失败:", e);
    }
  },

  /* 关闭玩法界面时，保留进度（自动存档已实时写入），下次打开自动恢复 */
  close() {
    if (!this._shown) return;
    this._shown = false;
    this.el.hidden = true;
    const dev = document.getElementById("devgame");
    if (dev) dev.hidden = true;
  },

  openPop(id) {
    const p = document.getElementById(id);
    if (p) p.hidden = false;
  },
  closePop(id) {
    const p = document.getElementById(id);
    if (p) p.hidden = true;
  },
};

window.Training = Training;
