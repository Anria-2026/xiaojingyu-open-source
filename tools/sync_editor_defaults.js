/* ==========================================================================
   编辑器默认模板同步脚本（架构级修复 2026-09-05）
   --------------------------------------------------------------------------
   根因：editor/js/gameDefaults.js 曾是「游戏出厂默认的手工快照」，与
   h5_demo/js/game_cfg.js 各自漂移 → 编辑器「保存全部」把过期默认写回
   h5_demo/data/game_cfg.json，把只在代码里修好的 BUG 值重新钉死（复活）。
   修复：gameDefaults.js 一律由本脚本从 game_cfg.js 自动生成，勿手改。
   用法：node tools/sync_editor_defaults.js   （改完 game_cfg.js 后跑一次）
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "h5_demo", "js", "game_cfg.js");
const DST = path.join(ROOT, "editor", "js", "gameDefaults.js");

function syncEditorDefaults() {
const code = fs.readFileSync(SRC, "utf8");
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "game_cfg.js" });
const cfg = sandbox.window.GameCfg;
if (!cfg) throw new Error("game_cfg.js 未产出 window.GameCfg");
// A stale factory/script must not regenerate the retired entry-grant table.
delete cfg.STAGE_BUDGET;
// Keep the exact inverse evidence when this generated file is refreshed.
// Its former values are never exported; only the empty feature block remains.
const previous = fs.existsSync(DST) ? fs.readFileSync(DST, "utf8") : "";
// Preserve exact feature inverses when the generated values already agree.
// Reformatting a protected snapshot can erase those inverses even though its
// runtime configuration is unchanged (especially post-generation migrations).
if (previous) {
  const previousBox = { window: {}, console };
  vm.runInNewContext(previous, previousBox, { filename: "gameDefaults.js" });
  const plain = value => JSON.parse(JSON.stringify(value));
  if (require("node:util").isDeepStrictEqual(plain(previousBox.window.GameDefaults.base), plain(cfg))) {
    console.log("[sync_editor_defaults] 出厂值已完全同步，保留精确 feature 逆变换证据");
    return;
  }
  if (process.argv.includes("--check")) throw new Error("编辑器默认值与出厂配置不同步");
  const protectedHooks = [...previous.matchAll(/\/\* \[feature:([^\]]+)\] \*\//g)]
    .map(match => match[1]).filter(name => name !== "retired-stage-budget-defaults");
  if (protectedHooks.length) throw new Error("拒绝覆盖带精确逆变换的默认模板；请由配置迁移同步差异并登记 hook 后重跑：" + protectedHooks.join(", "));
}
if (process.argv.includes("--check")) throw new Error("编辑器默认模板不存在或不同步");
const retirementHook = previous.match(/^[ \t]*\/\* \[feature:retired-stage-budget-defaults\] \*\/[\s\S]*?^[ \t]*\/\* \[\/feature:retired-stage-budget-defaults\] \*\/[^\S\r\n]*(?:\r?\n|$)/m);

const json = JSON.stringify(cfg, null, 2);
// 校验可序列化（函数会被静默丢弃，这里显式拦一道防漏配置）
const roundtrip = JSON.parse(json);

const banner = `/* ==========================================================================
   玩法默认配置 —— 【自动生成】由 tools/sync_editor_defaults.js 从
   h5_demo/js/game_cfg.js 导出（2026-09-05 架构修复：消灭三份默认漂移，
   杜绝「编辑器保存把改过的 BUG 值写回 JSON」的复活机制）。
   ⚠️ 勿手改本文件：改游戏默认请改 game_cfg.js，然后运行
      node tools/sync_editor_defaults.js
   ========================================================================== */
"use strict";

window.GameDefaults = {
  base: ${json}
};
`;

const output = retirementHook ? banner.replace("  base: {\n", "  base: {\n" + retirementHook[0]) : banner;
fs.writeFileSync(DST, output, "utf8");
console.log("[sync_editor_defaults] 已生成", DST);
console.log("[sync_editor_defaults] base 顶层键数 =", Object.keys(roundtrip).length);
}
syncEditorDefaults();
