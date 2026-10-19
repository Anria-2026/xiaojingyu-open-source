/* ==========================================================================
   历史回溯页（§二.6 历史记录 + 恢复默认；§十 改前备份、改后可回滚）
   --------------------------------------------------------------------------
   - 每次保存（含自动保存）都生成配置快照 → 此处列出全部快照
   - 可恢复任意快照（项目 / 音效 / BGM / 平台配置），恢复后自动重载 + 同步运行时
   - 恢复出厂默认：先快照当前状态（可再回滚），再重置为最小默认项目
   ========================================================================== */
"use strict";

const HistoryTool = {
  backups: [],

  async refresh() {
    try {
      const d = await (await fetch("/api/history-list")).json();
      this.backups = d.backups || [];
    } catch (e) { this.backups = []; }
    this.render();
  },

  init() {
    $("#history-reset").addEventListener("click", () => this.resetDefaults());
    $("#history-clear").addEventListener("click", () => this.clearAll());
    this.refresh();
  },

  render() {
    const tbody = $("#history-list");
    UI.clear(tbody);
    if (!this.backups.length) {
      tbody.append(h("tr", {}, h("td", { colspan: 5 }, h("div", { class: "dim" }, "暂无历史快照——保存项目后会自动生成，用于随时回溯。" ))));
      return;
    }
    this.backups.forEach((b) => {
      const files = (b.files || []).join("、") || "—";
      tbody.append(h("tr", {},
        h("td", { class: "hist-time" }, b.time || b.id || ""),
        h("td", {}, b.reason || "save"),
        h("td", { class: "hist-files" }, files),
        h("td", {}, h("div", { class: "sfx-ops" },
          h("button", { class: "btn btn-sm", onclick: () => this.restore(b.id) }, "↩ 恢复"),
          h("button", { class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;",
            onclick: () => this.deleteOne(b.id) }, "✕")))));
    });
  },

  async restore(id) {
    if (!confirm("确定恢复到该快照？当前项目 / 音效 / BGM 配置将被覆盖（覆盖前会自动生成新快照）。")) return;
    try {
      const r = await fetch("/api/history-restore", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!d.ok) { UI.toast("恢复失败：" + (d.error || ""), "err"); return; }
      await App.reload();              // 前端重载项目
      UI.toast("已恢复到快照 " + id);
    } catch (e) {
      UI.toast("恢复失败：" + e.message, "err");
    }
  },

  async deleteOne(id) {
    if (!confirm("删除该快照？此操作不可恢复。")) return;
    try {
      const d = await (await fetch("/api/history-delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })).json();
      this.backups = d.backups || [];
      this.render();
    } catch (e) {}
  },

  async resetDefaults() {
    if (!confirm("恢复出厂默认：项目将重置为空白场景，音效/BGM 配置清空。\n（当前状态会先存为快照，可从历史回溯页找回）")) return;
    try {
      const r = await fetch("/api/reset-defaults", { method: "POST" });
      const d = await r.json();
      if (!d.ok) { UI.toast("重置失败：" + (d.error || ""), "err"); return; }
      await App.reload();
      UI.toast("已恢复出厂默认（历史中可找回原状态）");
    } catch (e) {
      UI.toast("重置失败：" + e.message, "err");
    }
  },

  async clearAll() {
    if (!confirm("清空全部历史快照？（会先保留一份当前状态快照）")) return;
    try {
      const d = await (await fetch("/api/history-clear", { method: "POST" })).json();
      this.backups = d.backups || [];
      this.render();
    } catch (e) {}
  },
};

window.HistoryTool = HistoryTool;
