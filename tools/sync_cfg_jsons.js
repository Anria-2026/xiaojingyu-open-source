/* ==========================================================================
   sync_cfg_jsons.js —— 工厂（h5_demo/js/game_cfg.js）→ 两份 json 的同步桥
   用法：node tools/sync_cfg_jsons.js [--dry] [--force]
     --dry    只打印将要做的改动，不写盘
     --force  整表覆盖（⚠️ 会覆盖你在编辑器里的编辑，确认不需要时才用）
   --------------------------------------------------------------------------
   ⚠️ 铁律（两次事故换来的）：**同步桥只能"补"，永远不能"改"**
     · 2026-09-07：`deepMerge(j.V35, F.V35)` 拿出厂覆盖真源 → 冲掉用户调的论文研究周期
     · 2026-09-10：EVENTS / OFFICE_HINTS 走"真源与出厂不同就**整表跳过**" →
       出厂新增条目永远进不了真源；而**游戏端 deepMerge 对数组是整体替换** →
       真源那份旧数组在运行时把新条目整段冲掉（工厂写了等于没写）。
       同一天又发现 `TEST_QA` 丢了 2 道测试题 —— 它根本不在当时的"名单"里。

   ⇒ 所以现在不再维护"哪张表要同步"的名单，改成**通用规则**：
     · 对象数组（元素是对象）→ **按稳定键补齐**（真源保留原顺序与原内容，只追加真源缺的）
     · 普通对象            → **深补缺失子键**（出厂当底座、真源覆盖出厂）
     · 值数组 / 标量        → **不动**（游戏端与真源都是整体替换，语义已一致）

   删除意图：真源里可写 `__removed: { "<键路径>": ["<稳定键>", ...] }`，
   同步桥会跳过这些键、不再补回。编辑器里删条目时应把键写进 `__removed`
   （否则"删了又被同步回来" —— 这是与"补"配套的另一半）。
   ========================================================================== */
"use strict";
const fs = require("fs");

const FORCE = process.argv.includes("--force");
const DRY = process.argv.includes("--dry");

global.window = { addEventListener: () => {} };
global.document = { getElementById: () => null };
eval(fs.readFileSync("h5_demo/js/game_cfg.js", "utf8"));
const F = window.GameCfg;

/* 编辑器**整区拥有**的子树：座位坐标由编辑器按画布反算后整块写，工厂那份只是新装默认值，
   拿它去"补"会把用户在画布上删掉的座位加回来 —— 所以整棵跳过。 */
const SKIP_PATHS = ["SCENES"];

/* **代码拥有**的字段（编辑器里没有编辑入口）：一律以工厂为准，真源里那份旧值直接覆盖。
   ⚠️ 为什么必须单独列：同步桥的"只补不改"是**为保护你在编辑器里的编辑**；
   但这些字段你根本没有编辑入口，真源里留着旧值只会让工厂的改动**永远不生效**。
   踩过的坑（2026-09-11）：轴的 icon 从 emoji 改成自绘 SVG 后，页面**仍显示 emoji** ——
   真源 V35.AXES.DEF[*].icon 里那份旧值把工厂盖住了。
   路径支持 `*` 通配一层（对象的所有键）。 */
const CODE_OWNED = [
  ["V35", "AXES", "DEF", "*", "icon"],
];

/* **已退役的键**：工厂里已经不存在了，真源 / 镜像里那份**必须删掉**。
   ⚠️ 为什么非要显式列：同步桥「只补不改」+ 编辑器「整区保存」⇒
   真源里那份旧键会**复活**回运行时（和"删了又被补回来"是同一类病）。
   写进来 = 宣告"这个键彻底不用了"（2026-09-12 用户拍板：游戏没上线，把记事本的
   别名兼容层 `alias` 与整张老表 `NOTEBOOK` 全删，配置里只留一套 ID）。
   路径写法与 CODE_OWNED 同款，`*` 通配一层。 */
const RETIRED = [
  /* [feature:retired-stage-budget-sync] */
  ["STAGE_BUDGET"], // Stage entry preserves the settled balance.
  /* [/feature:retired-stage-budget-sync] */
  ["NOTEBOOK"],
  ["CHAT_TREE2", "NOTES", "*", "alias"],
  /* 2026-09-12（用户拍板：招聘概率改由池子分布 + 等级权重决定）——
     这四个键在工厂里已删除，真源/镜像里的旧值必须一起清掉，否则会「复活」回来
     并让人以为它们还在生效。 */
  ["HIRE_WEIGHTS"],            // 稀有度权重（旧：天赋越高刷出概率越小）
  ["HIRE_STAGE_COEF"],         // 阶段稀有度系数
  ["HIRE_REPUTATION_COEF"],    // 口碑星级 → 高级人才加成
  ["RARITY_TALENT_FLOOR"],     // 橙/彩天赋保底（前提「稀有度=等级档⊕天赋档」已废）
  ["HIRE_LV_RANGE_BY_VER", "*", "dist"],   // 旧的「各等级概率」——新形状是 {max, lv}
  ["HIRE_LV_RANGE_BY_VER", "*", "min"],    // 旧的下限——用户定：下限统一 Lv1，不再配
  /* 2026-09-13（C 方案「双线制」）——架构的「通过门槛系数」passMul 退役：
     评审线改为**按任务钉死的 (架构,参数) 组合实测标定**（REVIEW.BY_VER），
     架构特征已经含在实测值里，再乘一次是重复计算 → 引擎不再读它。 */
  ["ARCHITECTURES", "*", "passMul"],
  /* 2026-09-13：能力榜重设计（榜单分取消、统一用评审分）—— 手写的「名次 / 能力分」退役：
     名次现在由 game_core.finish 拿评审分对榜现算（1 + 比她分高的人数）。 */
  ["RANK_HEAT_BY_VER"],
  /* 2026-09-16 二轮（用户「infra/工程词条都删干净没有」）——
     Infra 架构岗位 2026-09-09 退役：HIRE_ROLES.infra 必须清掉，否则「只补不改」同步桥
     会把它复活回运行时；PROD_TRAIT_MUL.engineer 同理（词条池已无 engineer，
     预置档案里的 {"type":"engineer"} 也已改值成 pretrain，见 game_cfg.js 203 注释）。 */
  ["V35", "HIRE_ROLES", "infra"],
  ["V35", "PROD_TRAIT_MUL", "engineer"],
  /* 2026-09-19（用户拍板）：`PUBLIC_BY_VER` 退役 —— 唯一读它的是
     game_core.triggerEvents()，而那个函数**全项目无调用方**（doc/00-版本记录 记过）
     ⇒ 死配置，改它不影响任何一局。对外事件的阶段门槛改由每个事件自己的
     `stages` 白名单表达。 */
  ["PUBLIC_BY_VER"],
];

const deepCopy = (o) => JSON.parse(JSON.stringify(o));
const isPlainObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isObjArr = (v) => Array.isArray(v) && v.length > 0 && v.every(isPlainObj);

/* 稳定键：优先 id，其次 **key**（2026-09-18 提前），再几个常见文本字段，最后退回内容签名。
   ---------------------------------------------------------------------------
   ⚠️ 2026-09-18 根治（成就改名踩出来的）：原来顺序是 ["id","q","text","name","title","type","key"]，
   `key` 排在**最后** ⇒ 对「有 name 但没有 id/q/text」的表（如 ACHIEVEMENTS）**永远轮不到 key**，
   稳定键落到 `name` ⇒ **一改名字，审计就认为这条丢了，同步桥会把出厂旧条目补回来造重复**
   （实测：成就改名 26 条 ⇒ 36 条变 62 条重复）。
   现在把 `key` 提到所有「显示用文本字段」之前：改文案字段（name/title/desc）不再影响条目身份。
   ⚠️ 必须与 h5_demo/audit_cfg_sync.js 的 KEYF **保持完全一致** —— 两边口径不同比不改更糟。 */
const KEY_FIELDS = ["id", "key", "q", "text", "name", "title", "type"];
function stableKey(x) {
  if (!isPlainObj(x)) return String(x);
  for (const k of KEY_FIELDS) if (typeof x[k] === "string" && x[k]) return k + ":" + x[k];
  return "sig:" + JSON.stringify(x).slice(0, 160);
}

/* 只补缺失子键：出厂当底座、真源覆盖出厂（真源已有的值一个都不动）
   ⚠️ 2026-10-01：字典条目的「有意删除」必须在这里也认账。
   本函数以出厂为底座 —— 真源删掉的键不在覆盖层 ⇒ 会被原样带回（复活）。
   syncNode 的逐键跳过只挡住递归路径，挡不住上级「补入缺失子键」时 fillDefaults
   对整棵子树的盖章写入（2026-10-01 实际发生过：NOTES / CHAT_TREE2 约 30 条
   已删聊天选项被整树带回，test_chat_tree 抓住）。
   规则：出厂有、真源没有、且 __removed[本容器路径] 列了它 ⇒ 不补。 */
function fillDefaults(base, over, removed, path) {
  const p = path || [];
  const out = deepCopy(base || {});
  const rm = (removed || {})[p.join(".")] || [];
  for (const k of rm) {
    if (k in out && !(k in (over || {}))) delete out[k];
  }
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    if (isPlainObj(v) && isPlainObj(out[k])) out[k] = fillDefaults(out[k], v, removed, p.concat(k));
    else out[k] = deepCopy(v);
  }
  return out;
}

/* 对象数组：按稳定键补齐（保留真源顺序与内容，只追加真源缺的）
   ⚠️ 2026-09-11 二次加固：**同一条目（稳定键相同）也要深补缺失子键**。
   原来只"追加真源缺的条目"，于是「出厂给**已有条目**新增字段」永远进不了真源；
   而游戏端 deepMerge 对数组是**整体替换** → 真源那份旧数组会把新字段整段冲掉
   （工厂写了等于没写）。踩过：给语音回答加 `status`（COT）后，真源里那份旧数组没有它。
   规则不变 —— 仍是"只补不改"：只补缺失子键，真源已有的值一个都不动。 */
function fillArray(cur, factory, removed, key) {
  const fmap = new Map();
  factory.forEach((x) => { const k = stableKey(x); if (!fmap.has(k)) fmap.set(k, x); });
  const have = new Set(cur.map(stableKey));
  const add = factory.filter((x) => {
    const k = stableKey(x);
    return !have.has(k) && (removed[key] || []).indexOf(k) < 0;
  });
  let filled = 0, filledKeys = [];
  const merged = cur.map((x) => {
    if (!isPlainObj(x)) return x;
    const k = stableKey(x);
    const f = fmap.get(k);
    if (!f) return x;
    if ((removed[key] || []).indexOf(k) >= 0) return x;   // 明确删掉的，别动
    if (!hasMissingKey(f, x)) return x;                   // 键齐全 → 原样保留（不动值也不改键序）
    filled++; if (filledKeys.length < 4) filledKeys.push(k);
    return fillDefaults(f, x, removed, key.split(".").concat(k));
  });
  return { out: merged.concat(deepCopy(add)), added: add.map(stableKey), filled, filledKeys };
}

/* 出厂条目里有没有「真源这条缺的子键」（只认键的存在性，不比值 —— 避免键序差异被当成改动） */
function hasMissingKey(base, over, depth) {
  if (!isPlainObj(base) || !isPlainObj(over)) return false;
  if ((depth || 0) > 6) return false;
  for (const k of Object.keys(base)) {
    if (!(k in over)) return true;
    if (isPlainObj(base[k]) && isPlainObj(over[k]) && hasMissingKey(base[k], over[k], (depth || 0) + 1)) return true;
  }
  return false;
}

/* 递归工厂，只处理"真源里同路径也存在"的键 */
function syncNode(cur, factory, path, removed, notes) {
  /* ⚠️ 2026-09-19 补上「删除意图」的另一半：**字典键**也要认 `__removed`。
     此前只有 fillArray（对象数组）查 removed ⇒ 用户把某个**字典条目**（如 CHAT_TREE2 的
     `opts.10065` / `NOTES.1002`）有意删掉后，下面那道"深补缺失子键"仍会把它**补回来**
     ⇒ 「删了又被同步回来」；而且下次谁看到真源少了东西都会以为出事故（真发生过一次）。
     ⇒ 约定与数组完全一致：**按容器路径列被删的键**，例如
         `__removed: { "CHAT_TREE2.BY_VER.V1.opts": ["10065"], "CHAT_TREE2.NOTES": ["1002"] }` */
  const removedHere = (removed || {})[path.join(".")] || [];
  for (const k of Object.keys(factory || {})) {
    const fv = factory[k], cv = cur[k];
    if (cv === undefined) continue;                  // 真源没有 → 运行时用出厂，不必写
    const p = path.concat(k), pk = p.join(".");
    if (removedHere.indexOf(k) >= 0) { notes.push(pk + ": 跳过（__removed 标记的有意删除）"); continue; }
    if (SKIP_PATHS.indexOf(pk) >= 0) { notes.push(pk + ": 跳过（编辑器整区拥有）"); continue; }
    if (isObjArr(fv) && Array.isArray(cv)) {
      if (FORCE) { cur[k] = deepCopy(fv); notes.push(pk + ": ⚠️ 整表覆盖（--force）"); continue; }
      const r = fillArray(cv, fv, removed, pk);
      if (r.added.length || r.filled) {
        cur[k] = r.out;
        if (r.added.length) {
          notes.push(pk + ": 补入 " + r.added.length + " 条 [" + r.added.slice(0, 4).join(", ")
            + (r.added.length > 4 ? " …" : "") + "]");
        }
        if (r.filled) {
          notes.push(pk + ": 已有条目补入缺失子键 × " + r.filled + " [" + r.filledKeys.join(", ")
            + (r.filled > 4 ? " …" : "") + "]");
        }
      }
    } else if (isPlainObj(fv) && isPlainObj(cv)) {
      if (FORCE) { cur[k] = deepCopy(fv); notes.push(pk + ": ⚠️ 整表覆盖（--force）"); continue; }
      /* 见函数头注释：字典级的「有意删除」在循环开头就已经 continue 掉了，这里不用再判。
         ⚠️ 2026-09-19：**只有真缺键才写回**。原来这里判 `JSON.stringify(fillDefaults(...)) !== before`，
         而 fillDefaults 是以出厂为底座再覆盖真源 ⇒ **键序变成出厂的顺序** ⇒ 即使内容一个不缺，
         字符串也不相等 ⇒ 每次都报"补入缺失子键、有改动"。后果：`sync --dry` 永远显示"有改动"，
         「有改动」这个信号就废了（今天正是靠它才发现真源真的丢了内容）。 */
      if (missingKeysDeep(fv, cv, removed, p).length) {
        cur[k] = fillDefaults(fv, cv, removed, p);
        notes.push(pk + ": 补入缺失子键");
      }
      syncNode(cur[k], fv, p, removed, notes);
    }
    /* 值数组 / 标量：不动 —— 游戏端与真源都是整体替换，语义已经一致 */
  }
}

/* 出厂有、真源缺的键（递归；`removed[路径]` 里列出的键算"有意删除"，不算缺）
   ⚠️ 只判**键的存在性**，不比值 —— 用来决定"要不要写回"，避免键序差异造成的假改动。
   ⚠️ `removed` 必须**整张传下去**并按**每层的路径**取（2026-09-19 第一版只传了第一层，
      嵌套层的 `__removed` 被忽略 ⇒ 又把有意删掉的键当成"缺"）。 */
function missingKeysDeep(base, over, removed, path) {
  const out = [];
  if (!isPlainObj(base) || !isPlainObj(over)) return out;
  const p = path || [];
  const rm = (removed || {})[p.join(".")] || [];
  for (const k of Object.keys(base)) {
    if (rm.indexOf(k) >= 0) continue;
    if (!(k in over)) { out.push(p.concat(k).join(".")); continue; }
    if (isPlainObj(base[k]) && isPlainObj(over[k])) out.push.apply(out, missingKeysDeep(base[k], over[k], removed, p.concat(k)));
  }
  return out;
}

/* 按「代码拥有」名单把工厂值写回真源（支持 * 通配一层） */
function syncCodeOwned(j, factory, notes, path, pat) {
  const key = pat[0];
  if (key === "*") {
    for (const k of Object.keys(j || {})) {
      if (!isPlainObj(j[k]) || !isPlainObj(factory[k])) continue;
      syncCodeOwned(j[k], factory[k], notes, path.concat(k), pat.slice(1));
    }
    return;
  }
  const last = pat.length === 1;
  if (last) {
    if (factory[key] === undefined) return;
    if (j[key] === factory[key]) return;
    j[key] = deepCopy(factory[key]);
    notes.push(path.concat(key).join(".") + ": 代码拥有 → 以工厂为准");
    return;
  }
  if (!isPlainObj(j[key]) || !isPlainObj(factory[key])) return;
  syncCodeOwned(j[key], factory[key], notes, path.concat(key), pat.slice(1));
}

/* 按「已退役」名单把键从真源里删掉（支持 * 通配一层） */
function purgeRetired(j, notes, path, pat) {
  const key = pat[0];
  if (key === "*") {
    for (const k of Object.keys(j || {})) {
      if (!isPlainObj(j[k])) continue;
      purgeRetired(j[k], notes, path.concat(k), pat.slice(1));
    }
    return;
  }
  if (pat.length === 1) {
    if (!isPlainObj(j) || !Object.prototype.hasOwnProperty.call(j, key)) return;
    delete j[key];
    notes.push(path.concat(key).join(".") + ": 已退役 → 删除");
    return;
  }
  if (!isPlainObj(j[key])) return;
  purgeRetired(j[key], notes, path.concat(key), pat.slice(1));
}

let changed = 0;
for (const p of ["h5_demo/data/game_cfg.json", "editor/game_cfg_config.json"]) {
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const removed = isPlainObj(j.__removed) ? j.__removed : {};
  const before = JSON.stringify(j);
  const notes = [];
  syncNode(j, F, [], removed, notes);
  for (const pat of CODE_OWNED) syncCodeOwned(j, F, notes, [], pat);
  for (const pat of RETIRED) purgeRetired(j, notes, [], pat);
  const diff = JSON.stringify(j) !== before;
  if (DRY) {
    console.log("· " + p + (diff ? "（有改动，--dry 未写盘）" : "（无改动）"));
  } else {
    if (diff) { fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n"); changed++; }
    console.log("✓ " + p + (diff ? "" : "（无变化）"));
  }
  if (!notes.length) console.log("   · 无新内容");
  notes.forEach((n) => console.log("   · " + n));
}
if (DRY) console.log("\n（--dry 模式：以上为将要写入的内容）");
else console.log("\n完成：" + changed + " 个文件被更新。");
