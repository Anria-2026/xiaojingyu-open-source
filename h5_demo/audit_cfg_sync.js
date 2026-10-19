// ==========================================================================
// audit_cfg_sync.js —— 配置「三处同步 + 污染 + 引擎冒烟」审计
// 用法：cd h5_demo && node audit_cfg_sync.js
// --------------------------------------------------------------------------
// 背景（2026-09-02 事故）：编辑器 deepMerge 把二维数组 [[1,2],[2,3]] 误判成
// 「对象数组」，保存后写成 [{0:1,1:2},{0:2,1:3}]；游戏合并配置后
// `const [lo,hi] = row` 抛 "object is not iterable" → 引擎每 tick 崩溃、
// 周数永远不推进（表现：时间永远停在第 1 周），而当时所有回归都跑的是
// 出厂默认配置，全程全绿 —— 这条链路完全没有测试覆盖。
//
// 配置实际有四处（editor/server.py 的 load_game_cfg 以 h5_demo/data/game_cfg.json 为唯一真源，
// editor/game_cfg_config.json 只是保存时的镜像，但页面若读到它也会把旧数据写回）：
//   game_cfg.js（出厂默认）→ gameDefaults.js（编辑器默认）
//   → data/game_cfg.json（游戏加载源，真源）→ editor/game_cfg_config.json（编辑器镜像）
//
// 本脚本守住五件事：
//   ① 出厂默认(game_cfg.js) ↔ 编辑器默认(gameDefaults.js) 逐叶子语义 diff
//   ② 两份 json（游戏真源 + 编辑器镜像）是否出现「被对象化的值数组」
//   ③ 编辑器 deepMerge 跑一遍，确认保存链路不会再写坏二维数组
//   ④ 用「出厂默认 + 游戏真源」合并后的真实配置跑引擎 tick 冒烟（不抛异常）
//   ⑤ 编辑器镜像 ↔ 游戏真源 的关键键是否齐备（缺失说明页面刷新后才会补回）
// ==========================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const P = (p) => fs.readFileSync(path.join(__dirname, p), "utf8");

let bad = 0;
const ok = (name, cond, detail) => {
  if (!cond) bad++;
  console.log((cond ? "  ✓ " : "  ✗ ") + name + (detail ? " —— " + detail : ""));
};
const flat = (o, p, out) => {
  for (const k of Object.keys(o || {})) {
    const v = o[k], key = p ? p + "." + k : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flat(v, key, out);
    else out[key] = v;
  }
  return out;
};

/* ---------- 环境：加载出厂默认 + 编辑器默认 ---------- */
global.window = { addEventListener: () => {} };
global.document = { getElementById: () => null };
const cfgSrc = P("js/game_cfg.js");
eval(cfgSrc);
const deepMerge = new Function(cfgSrc.match(/function deepMerge[\s\S]*?\n}/)[0] + "\nreturn deepMerge;")();
/* ④ 会把真源合并进 window.GameCfg（就地改），所以这里先留一份**纯出厂**快照，
   供 ⑨ 的对象数组守卫比对 —— 不然守卫会拿"已合并"的结果比它自己，永远为真。 */
const FACTORY_SNAP = JSON.parse(JSON.stringify(window.GameCfg));
eval(P("../editor/js/gameDefaults.js"));
const A = window.GameCfg.V35;
const B = window.GameDefaults.base.V35;

/* ---------- ① 出厂默认 ↔ 编辑器默认 ---------- */
console.log("① 出厂默认（game_cfg.js）↔ 编辑器默认（gameDefaults.js）V35");
const fa = flat(A, "", {}), fb = flat(B, "", {});
let diff = 0;
for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
  const x = JSON.stringify(fa[k]), y = JSON.stringify(fb[k]);
  if (x !== y) { diff++; console.log("    ✗ " + k + "  出厂=" + x + "  编辑器=" + y); }
}
ok("V35 逐叶子一致（" + Object.keys(fa).length + " 个叶子）", diff === 0, diff ? diff + " 处不一致" : "");

/* ---------- ② 两份 json 的值数组污染检测 ---------- */
console.log("② 二维数组污染检测（游戏真源 + 编辑器镜像）");
let J = null, jsonLoaded = false;
try {
  J = JSON.parse(P("data/game_cfg.json"));
  jsonLoaded = true;
} catch (e) {
  console.log("    （无编辑器产物，跳过 ②③④⑤）");
}
const scanPollution = (root) => {
  const polluted = [];
  (function walk(o, p) {
    if (Array.isArray(o)) {
      if (o.length && o.every((v) => v && typeof v === "object" && !Array.isArray(v)
          && Object.keys(v).every((k) => /^\d+$/.test(k)))) {
        polluted.push(p);
      }
      o.forEach((v, i) => walk(v, p + "[" + i + "]"));
      return;
    }
    if (o && typeof o === "object") for (const k of Object.keys(o)) walk(o[k], p ? p + "." + k : k);
  })(root, "");
  return polluted;
};
/* 编辑器镜像：editor/game_cfg_config.json（保存时的副本，页面若读到它会把旧数据写回真源） */
let M = null;
try { M = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "editor", "game_cfg_config.json"), "utf8")); } catch (e) {}
if (J) ok("游戏真源 data/game_cfg.json 无污染", scanPollution(J).length === 0, scanPollution(J).join(", "));
if (M) ok("编辑器镜像 game_cfg_config.json 无污染", scanPollution(M).length === 0, scanPollution(M).join(", "));

if (jsonLoaded) {

  /* ---------- ③ 编辑器 deepMerge 保存链路 ---------- */
  console.log("③ 编辑器保存链路（gameCfgTool.deepMerge）");
  eval(P("../editor/js/gameCfgTool.js"));
  const merged = window.GameCfgTool.deepMerge(
    JSON.parse(JSON.stringify(window.GameDefaults.base)), J).V35;
  const is2d = (a) => Array.isArray(a) && a.every((r) => Array.isArray(r));
  ok("保存后 TIER_RANGES 仍是二维数组", is2d(merged.TIER_RANGES), JSON.stringify(merged.TIER_RANGES[0]));
  ok("保存后 Q_TIERS 仍是二维数组", is2d(merged.Q_TIERS), JSON.stringify(merged.Q_TIERS[0]));
  ok("保存后 GAP_TIERS 仍是二维数组", is2d(merged.CORPUS_CURVE.GAP_TIERS), JSON.stringify(merged.CORPUS_CURVE.GAP_TIERS[0]));

  /* ---------- ④ 真实配置引擎冒烟 ---------- */
  console.log("④ 引擎冒烟（出厂默认 + json 合并后跑 24 tick）");
  deepMerge(window.GameCfg, J);
  eval(P("js/v35_core.js"));
  const V = window.V35;
  const st = V.createState("serious");
  let err = "";
  try {
    for (let i = 0; i < 24; i++) V.tick(st);
  } catch (e) {
    err = e.message;
  }
  ok("24 tick 无异常", !err, err);
  ok("周结算已发生（weekly 记录 = 4 条）", st.weekly.length === 4, "实际 " + st.weekly.length);
  ok("产出已累积", st.stats.code + st.stats.text > 0, JSON.stringify(st.stats));
  /* 攻关条件（2026-09-02 改版）应齐备 */
  ok("攻关语料门槛 FOCUS_CORPUS_GATE 已配置", typeof window.GameCfg.V35.FOCUS_CORPUS_GATE === "number",
     String(window.GameCfg.V35.FOCUS_CORPUS_GATE));
  ok("攻关经费 FOCUS_COST 已配置", typeof window.GameCfg.V35.FOCUS_COST === "number",
     String(window.GameCfg.V35.FOCUS_COST));
}

/* ---------- ⑤ 编辑器镜像 ↔ 游戏真源 关键键 ---------- */
if (M) {
  console.log("⑤ 编辑器镜像 ↔ 游戏真源（V35 关键键）");
  const fm = flat(M.V35 || {}, "", {}), fj = flat(J ? J.V35 || {} : {}, "", {});
  const missingInMirror = Object.keys(fj).filter((k) => fm[k] === undefined);
  const missingInGame = Object.keys(fm).filter((k) => fj[k] === undefined);
  ok("真源里的键镜像都有", missingInMirror.length === 0, missingInMirror.join(", "));
  ok("镜像里的键真源都有", missingInGame.length === 0, missingInGame.join(", "));
  /* 攻关改版与论文配置的新键必须落到真源（缺了说明编辑器页面还没刷新保存过） */
  for (const k of ["FOCUS_CORPUS_GATE", "FOCUS_COST", "PAPER_DATA_SPEED_MUL"]) {
    ok("真源含新键 " + k, fj[k] !== undefined, String(fj[k]));
  }
}

/* ---------- ⑥ 对象数组逐位对齐（2026-09-06 BUG B10）----------
   deepMerge 对「对象数组」是**按索引**合并的，真源少一条就会整条链错位：
   真源 EVENTS 少了 E101 → 后面每条都与邻位混合 → V35_QUIT 的 cond 被覆盖成 null
   → 条件池永久非空 → 随机池被彻底饿死（20 条随机事件一次都不触发）。
   这里守住：真源的对象数组必须与出厂**逐位同 id**。 */
const ARR_KEYS = ["EVENTS"];
for (const ak of ARR_KEYS) {
  console.log("⑥ 对象数组逐位对齐 · " + ak);
  const fa = window.GameCfg[ak] || [];
  const ja = (J && J[ak]) || [];
  if (!fa.length) { ok("出厂 " + ak + " 非空", false); continue; }
  /* 2026-09-10 判据升级（配合 sync_cfg_jsons 的「按 id 补齐」）：
     deepMerge 对数组是**按下标**合并的，真正的危险是「同一位上 id 不同」= 串字段。
     真源比出厂**多**条目（编辑器里手工加的）是合法的，不算错位 —— 所以只比共同前缀。
     另外单独守住「出厂每条 id 真源都得有」，否则新版本加的事件永远进不了运行时。 */
  const n = Math.min(fa.length, ja.length);
  let mis = 0;
  for (let i = 0; i < n; i++) {
    const a = fa[i] && fa[i].id, b = ja[i] && ja[i].id;
    if (a !== b) {
      mis++;
      if (mis <= 5) console.log("    ✗ 第 " + i + " 位  出厂=" + a + "  真源=" + b);
    }
  }
  ok(ak + " 共同前缀逐位同 id（出厂 " + fa.length + " 条 / 真源 " + ja.length + " 条）", mis === 0,
    mis ? mis + " 处错位（deepMerge 按索引合并，会串字段）" : "");
  const jaIds = new Set(ja.map((x) => x && x.id));
  const missing = fa.map((x) => x && x.id).filter((id) => id && !jaIds.has(id));
  ok(ak + " 出厂的每条 id 真源都有（缺失=新内容进不了运行时）", missing.length === 0,
    missing.slice(0, 5).join(", "));
}

/* ---------- ⑦ 工程师「潜力属性」三维守卫（2026-09-10 退役字段）
   精力 energy / 协作 coop 已彻底删除；编辑器 8090 常年开着，标签页里的旧内存副本
   点一次「保存全部」就可能把键写回真源 —— 服务端已加 purge 护栏（editor/server.py），
   这里再从「四处数据」这个结果侧守一道：任何一处冒出来都直接红。 */
console.log("⑦ 工程师潜力属性 = 三维（精力 / 协作已退役）");
const RETIRED = ["coop", "energy"];
const checkEng = (arr, tag) => {
  const list = arr || [];
  const bads = list.filter((e) => e && e.stats && RETIRED.some((k) => k in e.stats));
  ok(tag + " 无退役键（coop / energy）", list.length > 0 && bads.length === 0,
    bads.length ? "污染 " + bads.length + " 条：" + bads.slice(0, 3).map((e) => e.id).join(",") : list.length + " 人");
};
checkEng(window.GameCfg.ENGINEERS, "出厂 game_cfg.js");
checkEng(window.GameDefaults.base.ENGINEERS, "编辑器默认 gameDefaults.js");
if (J) checkEng(J.ENGINEERS, "游戏真源 data/game_cfg.json");
if (M) checkEng(M.ENGINEERS, "编辑器镜像 game_cfg_config.json");
ok("出厂 ENG_STATUS.ENERGY_FROM_STATS 已删除", (window.GameCfg.ENG_STATUS || {}).ENERGY_FROM_STATS === undefined);
ok("出厂 ENG_STATUS.ENERGY_INIT = 100", (window.GameCfg.ENG_STATUS || {}).ENERGY_INIT === 100,
   String((window.GameCfg.ENG_STATUS || {}).ENERGY_INIT));
/* 编辑器服务端护栏必须在位（否则旧页面保存会复活退役键） */
const srv = (() => { try { return P("../editor/server.py"); } catch (e) { return ""; } })();
ok("editor/server.py 含 purge_retired_engineer_stats 护栏", srv.indexOf("purge_retired_engineer_stats") >= 0);
ok("护栏在 save_game_cfg 写盘前调用", /def save_game_cfg\(cfg\):\s*\n\s*cfg = purge_retired_game_cfg/.test(srv));
/* 2026-09-12：记事本兼容层（alias / 老 NOTEBOOK 表）退役 —— 护栏同样要在两端跑 */
ok("editor/server.py 含 purge_retired_keys 护栏（记事本别名退役）", srv.indexOf("purge_retired_keys") >= 0);
ok("该护栏在读取端也生效（load_game_cfg）", /return purge_retired_game_cfg\(data\)/.test(srv));
ok("该护栏在写盘端也生效（save_game_cfg）", srv.indexOf("cfg = purge_retired_game_cfg(cfg)") >= 0);

/* ---------- ⑧ legacy 死链已移除 + 无悬空调用（2026-09-10）----------
   背景：`phase` 现在只会是 "office"（startProject / _enterStage 都这么设），
   legacyPhases（loop/minigame/recruit/buygpu/direction）的触发器在两个文件里都没有渲染来源
   → startWorkshop / finishWorkshop / advance / baseTraining / makeReport / chooseDirection
     连同调用它们的 UI case 一并删除（共 314 行）。
   这里守两件事：① 它们别偷偷回来 ② game_ui 调用的 core 方法必须真实存在（防悬空调用）。 */
console.log("⑧ legacy 死链已移除 + 无悬空调用");
const coreSrc = P("js/game_core.js");
const uiSrc = P("js/game_ui.js");
for (const fn of ["startWorkshop", "finishWorkshop", "baseTraining", "chooseDirection", "makeReport"]) {
  ok("game_core 已移除 " + fn + "()", !new RegExp("^  " + fn + "\\(", "m").test(coreSrc));
}
ok("game_ui 已移除「已招聘迷你卡」链", uiSrc.indexOf("renderHiredModal") < 0 && uiSrc.indexOf("hiredMiniCard") < 0);
const coreMethods = new Set([...coreSrc.matchAll(/^  ([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]));
const uiCalls = new Set([...uiSrc.matchAll(/\b(?:this\.core|core)\.([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]));
const dangling = [...uiCalls].filter((n) => !coreMethods.has(n));
ok("game_ui 调用的 core 方法全部存在（检查 " + uiCalls.size + " 个）", dangling.length === 0, dangling.join(","));

/* ---------- ⑨ 对象数组「真源 ⊇ 出厂」通用守卫（2026-09-10）----------
   为什么必须通用：**游戏端 deepMerge 对数组是整体替换** —— 真源里那份旧数组会把
   出厂条目整段盖掉（工厂写了等于没写）。而每漏一张表就丢一批内容，且**不报错**：
     · 2026-09-10 发现 TEST_QA 丢 2 道测试题、EVAL_BANK.chat.low 丢 1 道 —— 两张表都不在
       当时"要同步的名单"里。所以这里改成**遍历全部对象数组**，不再维护名单。
   判据：真源里的每一条（按稳定键）都要能对上出厂的每一条（`__removed` 标记的删除除外）。
   修法：跑 `node ../tools/sync_cfg_jsons.js`（只补不改）。 */
console.log("⑨ 对象数组通用守卫（真源必须含出厂的每一条）");
(function () {
  const isPO = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const isOA = (v) => Array.isArray(v) && v.length > 0 && v.every(isPO);
  const KEYF = ["id", "key", "q", "text", "name", "title", "type"];   // ⚠️ 必须与 tools/sync_cfg_jsons.js 的 KEY_FIELDS 完全一致（2026-09-18 把 key 提到 name 之前，见该文件注释）
  const sk = (x) => {
    if (!isPO(x)) return String(x);
    for (const k of KEYF) if (typeof x[k] === "string" && x[k]) return k + ":" + x[k];
    return "sig:" + JSON.stringify(x).slice(0, 160);
  };
  const SKIP = ["SCENES"];      // 编辑器整区拥有（座位坐标）
  /* 出厂条目里有没有「真源这条缺的子键」—— 只认键的存在性，不比值（避免键序差异误报） */
  const missKeys = (base, over, pre, out) => {
    if (!isPO(base) || !isPO(over)) return;
    if ((pre || "").split(".").length > 6) return;
    for (const k of Object.keys(base)) {
      const p2 = pre ? pre + "." + k : k;
      if (!(k in over)) { out.push(p2); continue; }
      if (isPO(base[k]) && isPO(over[k])) missKeys(base[k], over[k], p2, out);
    }
  };
  const walk = (fac, jj, path, removed, st) => {
    /* ⚠️ 2026-09-19：**字典级**的有意删除也要跳过（与 tools/sync_cfg_jsons.js 的约定一致：
       按**容器路径**列被删的键，如 `__removed["CHAT_TREE2.BY_VER.V1.opts"] = ["10065"]`）。
       在此之前只有对象数组那条分支看 removed ⇒ 用户有意删掉的字典条目会被报成"缺内容"。 */
    const removedHere = (removed || {})[path.join(".")] || [];
    for (const k of Object.keys(fac || {})) {
      if (removedHere.indexOf(k) >= 0) continue;
      const fv = fac[k], jv = (jj || {})[k];
      if (jv === undefined) continue;                       // 真源没有 → 运行时用出厂，没问题
      const p = path.concat(k), pk = p.join(".");
      if (SKIP.indexOf(pk) >= 0) continue;
      if (isOA(fv) && Array.isArray(jv)) {
        st.n++;
        const jmap = new Map();
        jv.forEach((x) => { const k2 = sk(x); if (!jmap.has(k2)) jmap.set(k2, x); });
        const rm = (removed || {})[pk] || [];
        const miss = fv.map(sk).filter((x) => !jmap.has(x) && rm.indexOf(x) < 0);
        if (miss.length) { st.bad++; st.list.push(pk + " 缺 " + miss.length + " 条（" + miss.slice(0, 2).join(", ") + "）"); }
        /* ⑨-1 **已有条目也要子键齐全**（2026-09-11 新增）------------------------
           只比"条目在不在"会漏掉「出厂给**已有条目**新增字段」这一类 ——
           而游戏端 deepMerge 对数组是**整体替换** → 真源那份旧数组让新字段在运行时完全失效
           （工厂写了等于没写，且不报错）。踩过三例（全是这次新增守卫才发现的）：
             · ARCHITECTURES[*].axes 缺 → 立项面板不显示「带出：记忆/推理/工具」
             · ENGINEERS[*].energy 缺（29 人）→ 档案不带初始体力（引擎会兜底成 100）
             · CHAT_TREE2 回答缺 status → 语音链的 COT（思考中/调用工具中）不播
           修法同样是 `node ../tools/sync_cfg_jsons.js`（只补缺失子键，不改已有值）。 */
        const subMiss = [];
        fv.forEach((fe) => {
          const kk = sk(fe);
          const je = jmap.get(kk);
          if (!je || rm.indexOf(kk) >= 0) return;
          const lack = [];
          missKeys(fe, je, "", lack);
          if (lack.length) subMiss.push(kk + "（缺 " + lack.slice(0, 3).join("/") + (lack.length > 3 ? "…" : "") + "）");
        });
        if (subMiss.length) {
          st.bad2++;
          st.list2.push(pk + " × " + subMiss.length + " 条：" + subMiss.slice(0, 2).join("；"));
        }
      } else if (isPO(fv) && isPO(jv)) walk(fv, jv, p, removed, st);
    }
  };
  for (const [j, tag] of [[J, "游戏真源 data/game_cfg.json"], [M, "编辑器镜像 game_cfg_config.json"]]) {
    if (!j) continue;
    const st = { n: 0, bad: 0, list: [], bad2: 0, list2: [] };
    walk(FACTORY_SNAP, j, [], isPO(j.__removed) ? j.__removed : {}, st);
    ok(tag + " 的对象数组 ⊇ 出厂（检查 " + st.n + " 处）", st.bad === 0,
      st.bad ? st.bad + " 处缺失 → 跑 node ../tools/sync_cfg_jsons.js 补：" + st.list.slice(0, 3).join("；") : "");
    ok(tag + " 的数组条目子键 ⊇ 出厂（检查 " + st.n + " 处）", st.bad2 === 0,
      st.bad2 ? st.bad2 + " 处缺子键 → 跑 node ../tools/sync_cfg_jsons.js 补：" + st.list2.slice(0, 3).join("；") : "");
  }

  /* ⑨-2 「代码拥有」字段：真源里不能留着旧值把工厂盖住（2026-09-11 踩坑）
     同步桥的"只补不改"是为保护你在编辑器里的编辑；但有些字段**编辑器里没有编辑入口**，
     真源里留旧值只会让工厂的改动**永远不生效** —— 轴的 icon 从 emoji 改成自绘 SVG 后，
     页面仍显示 emoji，就是这个原因。名单与 tools/sync_cfg_jsons.js 的 CODE_OWNED 同源。 */
  const CODE_OWNED = [["V35", "AXES", "DEF", "*", "icon"]];
  const walkOwned = (fac, jj, pat, path, miss) => {
    const k = pat[0];
    if (k === "*") {
      for (const kk of Object.keys(jj || {})) {
        if (!isPO(jj[kk]) || !isPO((fac || {})[kk])) continue;
        walkOwned(fac[kk], jj[kk], pat.slice(1), path.concat(kk), miss);
      }
      return;
    }
    if (pat.length === 1) {
      if ((fac || {})[k] === undefined) return;
      if (jj[k] !== fac[k]) miss.push(path.concat(k).join("."));
      return;
    }
    if (!isPO(jj[k]) || !isPO((fac || {})[k])) return;
    walkOwned(fac[k], jj[k], pat.slice(1), path.concat(k), miss);
  };
  for (const [j, tag] of [[J, "游戏真源"], [M, "编辑器镜像"]]) {
    if (!j) continue;
    const miss = [];
    for (const pat of CODE_OWNED) walkOwned(FACTORY_SNAP, j, pat, [], miss);
    ok(tag + " 的「代码拥有」字段与出厂一致（不能被旧值盖住）", miss.length === 0,
      miss.length ? miss.join("、") + " → 跑 node ../tools/sync_cfg_jsons.js 刷新" : "");
  }

  /* ⑩ 已退役的键不许回潮（2026-09-12）
     同步桥「只补不改」+ 编辑器「整区保存」⇒ 工厂删掉的键会在真源里**复活**回运行时。
     这里给退役键设哨兵；名单与 tools/sync_cfg_jsons.js 的 RETIRED 同源。
     踩过：记事本的别名兼容层 `alias` / 老表 `NOTEBOOK`（用户拍板「上线前也删掉」）；
     2026-09-12 又退役了招聘的稀有度权重四件套 + 旧的等级概率/下限（改由池子分布 + 等级权重决定）。 */
  const RETIRED = [
    /* [feature:retired-stage-budget-audit] */
    ["STAGE_BUDGET"], // Factory, saved overrides and editor mirrors must all retire it.
    /* [/feature:retired-stage-budget-audit] */
    ["NOTEBOOK"],
    ["CHAT_TREE2", "NOTES", "*", "alias"],
    ["HIRE_WEIGHTS"],
    ["HIRE_STAGE_COEF"],
    ["HIRE_REPUTATION_COEF"],
    ["RARITY_TALENT_FLOOR"],
    ["HIRE_LV_RANGE_BY_VER", "*", "dist"],
    ["HIRE_LV_RANGE_BY_VER", "*", "min"],
    /* 2026-09-13：架构「通过门槛系数」passMul 退役（评审线改为按任务组合实测标定，
       见 REVIEW.BY_VER 注释）——同步桥的 RETIRED 里有同一条，这里守哨兵。 */
    ["ARCHITECTURES", "*", "passMul"],
    /* 2026-09-13：能力榜重设计 —— 手写名次/能力分退役（名次改为按评审分现算） */
    ["RANK_HEAT_BY_VER"],
    /* 2026-09-19（用户拍板）：`PUBLIC_BY_VER` 退役 —— 死配置，唯一读它的
       game_core.triggerEvents() 全项目无调用方。门槛改用各事件的 stages。 */
    ["PUBLIC_BY_VER"],
  ];
  const findRetired = (j, pat, path, hit) => {
    const k = pat[0];
    if (k === "*") {
      for (const kk of Object.keys(j || {})) {
        if (!isPO(j[kk])) continue;
        findRetired(j[kk], pat.slice(1), path.concat(kk), hit);
      }
      return;
    }
    if (pat.length === 1) {
      if (isPO(j) && Object.prototype.hasOwnProperty.call(j, k)) hit.push(path.concat(k).join("."));
      return;
    }
    if (!isPO(j[k])) return;
    findRetired(j[k], pat.slice(1), path.concat(k), hit);
  };
  for (const [j, tag] of [[J, "游戏真源"], [M, "编辑器镜像"], [FACTORY_SNAP, "出厂 game_cfg.js"]]) {
    if (!j) continue;
    const hit = [];
    for (const pat of RETIRED) findRetired(j, pat, [], hit);
    ok(tag + " 无退役键（" + RETIRED.map((p) => p.join(".")).join(" / ") + "）", hit.length === 0,
      hit.length ? "发现 " + hit.join("、") + " → 跑 node ../tools/sync_cfg_jsons.js 清掉" : "");
  }
})();

/* ---------- ⑩ 稳定键口径一致 + 顺序正确（2026-09-18 加）----------
   背景：成就改名曾把「稳定键落到 name」的隐患炸出来 —— 只改真源的名字，审计 ⑨ 就报「缺 26 条」，
   而同步桥**真的会把出厂旧条目补回真源**（36 条 → 62 条重复成就，且不报错）。
   根治 = 把 `key` 提到所有「显示用文本字段」（name / title）之前。
   这里守两件事：
     ① 两份实现（tools/sync_cfg_jsons.js 的 KEY_FIELDS 与本文的 KEYF）必须**一字不差** ——
        两边口径不同比不改更糟（审计说没问题、同步桥却去补，或反过来）；
     ② `key` 确实排在 `name` 之前（否则改名又会把条目身份改掉）。 */
console.log("⑩ 稳定键口径一致");
(function () {
  const pick = (src) => {
    const m = String(src).match(/KEY_?F(?:IELDS)?\s*=\s*(\[[^\]]*\])/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  };
  const syncList = pick(P("../tools/sync_cfg_jsons.js"));
  const auditList = pick(fs.readFileSync(__filename, "utf8"));
  ok("sync_cfg_jsons.js 与 audit_cfg_sync.js 的稳定键顺序完全一致",
    !!syncList && !!auditList && syncList.join(",") === auditList.join(","),
    "sync=" + JSON.stringify(syncList) + " audit=" + JSON.stringify(auditList));
  const ki = (auditList || []).indexOf("key"), ni = (auditList || []).indexOf("name");
  ok("稳定键里 key 排在 name / title 之前（改名字不再影响条目身份）",
    ki >= 0 && ni >= 0 && ki < ni, "key@" + ki + " name@" + ni);
})();

/* [feature:retired-stage-budget-config-audit] */
console.log("⑪ 阶段启动预算已退役");
for (const [cfg, label] of [[window.GameCfg, "运行时配置"], [window.GameDefaults.base, "编辑器默认"]]) {
  ok(label + " 不暴露 STAGE_BUDGET", !Object.prototype.hasOwnProperty.call(cfg, "STAGE_BUDGET"));
}
const historicalMirror = JSON.parse(P("../editor/game_cfg_config.json"));
ok("编辑器镜像不残留 STAGE_BUDGET", !Object.prototype.hasOwnProperty.call(historicalMirror, "STAGE_BUDGET"));
ok("server 读写清理名单包含 STAGE_BUDGET", /cfg\.pop\("STAGE_BUDGET", None\)/.test(P("../editor/server.py")));
/* [/feature:retired-stage-budget-config-audit] */
console.log("");
console.log(bad ? "✗ 审计未通过：" + bad + " 项" : "✓ 配置同步 / 污染 / 引擎冒烟 全部通过");
process.exit(bad ? 1 : 0);
