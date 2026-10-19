/* ==========================================================================
   BGM 配置页（§八 BGM 预加载/播放 + §九.7 BGM 下拉）
   --------------------------------------------------------------------------
   - BGM 素材库：resource/sound/BGM 实时扫描（/api/bgm-list），每曲可试听
   - 两个选曲下拉：主菜单 BGM / 主场景 BGM
   - 保存 → 服务端复制为 h5_demo/assets/bgm/menu_bgm.mp3 & scene_bgm.mp3
     （固定名，游戏运行时直接引用，二进制按字节复制），并写 bgm_config
   ========================================================================== */
"use strict";

const BgmTool = {
  files: [],            // BGM 素材库
  cfg: { menu: "", scene: "" },
  _audio: null,

  async refresh() {
    try {
      const [lib, cfg, st] = await Promise.all([
        fetch("/api/bgm-list").then((r) => r.json()),
        fetch("/api/bgm-config").then((r) => r.json()),
        fetch("/api/save-status").then((r) => r.json()),
      ]);
      this.files = lib.files || [];
      this.cfg = { menu: "", scene: "", review: "", bonus: "", ...(cfg || {}) };
      this.status = st || {};
    } catch (e) { /* 保留旧值 */ }
    this.render();
  },

  async init() {
    /* 20260829r：分页保存按钮已删，统一走右上角「保存全部」（App.save → syncAllConfigs） */
    $("#bgm-menu").addEventListener("change", (e) => { this.cfg.menu = e.target.value; });
    $("#bgm-scene").addEventListener("change", (e) => { this.cfg.scene = e.target.value; });
    /* 2026-09-04：评审 / 结算单独配乐 */
    $("#bgm-review").addEventListener("change", (e) => { this.cfg.review = e.target.value; });
    $("#bgm-bonus").addEventListener("change", (e) => { this.cfg.bonus = e.target.value; });
    await this.refresh();
  },

  /* 试听（参考几何战争 audio.previewBgm）：单例元素 + 二次点击切换 播放/暂停；
     用自记录的曲目名判断是否同一首（不依赖 el.src——浏览器会把空格编码导致判断失效） */
  preview(name) {
    if (!name) return;
    if (!this._audio) {
      this._audio = new Audio();
      this._audio.volume = 0.8;
      this._audio.loop = true;
    }
    if (this._curName === name) {
      if (this._audio.paused) this._audio.play().catch(() => UI.toast("播放失败：浏览器拦截了音频", "err"));
      else this._audio.pause();
      this.render();
      return;
    }
    this._curName = name;
    this._audio.src = "/resource/sound/BGM/" + encodeURIComponent(name);
    this._audio.play().catch(() => UI.toast("播放失败：找不到音频文件", "err"));
    this.render();
  },

  isPlaying(name) {
    return this._curName === name && this._audio && !this._audio.paused;
  },

  /* 保存选曲 → 同步到游戏运行时（silent=由右上角「保存全部」统一调用） */
  async save({ silent = false } = {}) {
    try {
      const r = await fetch("/api/bgm-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        menu: this.cfg.menu, scene: this.cfg.scene,
        review: this.cfg.review, bonus: this.cfg.bonus,
      }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      this.cfg = d.config || this.cfg;
      if (!silent) { UI.toast("BGM 已保存并同步到游戏运行时"); this.render(); }
    } catch (e) {
      if (silent) throw e;
      UI.toast("BGM 保存失败：" + e.message, "err");
    }
  },

  render() {
    // 四个槽位的选曲下拉（选项 = BGM 素材库 + 空）
    [["bgm-menu", this.cfg.menu], ["bgm-scene", this.cfg.scene],
      ["bgm-review", this.cfg.review], ["bgm-bonus", this.cfg.bonus]].forEach(([id, val]) => {
        const sel = $("#" + id);
        if (!sel) return;
        UI.clear(sel);
        sel.append(h("option", { value: "" }, "（不配置 / 内置）"));
        this.files.forEach((f) => sel.append(h("option", { value: f }, f)));
        sel.value = val || "";
      });

    // 素材库列表（缩略名 + 试听/设为菜单曲/设为场景曲）
    const lib = $("#bgm-lib");
    UI.clear(lib);
    this.files.forEach((f) => {
      const playing = this.isPlaying(f);
      lib.append(h("div", { class: "bgm-item" + (playing ? " playing" : "") },
        h("span", { class: "bgm-ico" }, playing ? "⏸" : "▶"),
        h("span", { class: "bgm-name", title: f }, f),
        h("button", { class: "btn btn-sm btn-ghost", onclick: () => this.preview(f) },
          playing ? "停止" : "试听"),
        h("button", { class: "btn btn-sm" + (this.cfg.menu === f ? " btn-on" : ""),
          onclick: () => { this.cfg.menu = f; this.render(); UI.toast("已选为主菜单 BGM（记得点「保存 BGM」）"); } }, "设为菜单"),
        h("button", { class: "btn btn-sm" + (this.cfg.scene === f ? " btn-on" : ""),
          onclick: () => { this.cfg.scene = f; this.render(); UI.toast("已选为主场景 BGM（记得点「保存 BGM」）"); } }, "设为场景"),
        h("button", { class: "btn btn-sm" + (this.cfg.review === f ? " btn-on" : ""),
          onclick: () => { this.cfg.review = f; this.render(); UI.toast("已选为评审界面 BGM（记得点「保存 BGM」）"); } }, "设为评审"),
        h("button", { class: "btn btn-sm" + (this.cfg.bonus === f ? " btn-on" : ""),
          onclick: () => { this.cfg.bonus = f; this.render(); UI.toast("已选为结算演出 BGM（记得点「保存 BGM」）"); } }, "设为结算")));
    });
    if (!this.files.length) {
      lib.append(h("div", { class: "dim" }, "resource/sound/BGM 目录为空，请先放入 BGM 音频（mp3/wav/ogg/m4a）。"));
    }

    // 同步状态
    const st = $("#bgm-sync");
    if (st) {
      const t = this.status && this.status.bgm_config ? this.status.bgm_config : "";
      st.textContent = t ? "最近同步到游戏运行时：" + t : "尚未同步（保存后生效）";
    }
  },
};

window.BgmTool = BgmTool;
