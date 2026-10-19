// ==========================================================================
// test_save_migrate.js —— 存档迁移回归（DOC 26 P0）
// 用法：node test_save_migrate.js
// 覆盖：SAVE_VERSION 独立版本号 / migrate() 补齐旧档缺字段 / corpus.q 反解 /
//       老档(无 v35)判无效 / 新档幂等不破坏 / buildSnapshot 带 saveVersion
// 通过标准：无异常、断言全过
// ==========================================================================
"use strict";
global.window = { addEventListener: function () {} };
const fs = require("fs");
const path = require("path");

/* 本地 localStorage stub（存档层只依赖 getItem/setItem/removeItem） */
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const FILES = ["game_cfg.js", "v35_core.js", "game_core.js", "game_save.js"];
for (const f of FILES) {
  eval(fs.readFileSync(path.join(__dirname, "js", f), "utf8"));
}

const GS = window.GameSave;
let bad = 0;
function ok(name, cond, extra) {
  let line = (cond ? "✓ " : "✗ ") + name;
  if (extra) line += " — " + extra;
  console.log(line);
  if (!cond) bad++;
}

/* ① 独立存档版本号：与 cfg.version 无关 */
ok("SAVE_VERSION 为 6（新增具身时代持久状态）", GS.SAVE_VERSION === 6, "=" + GS.SAVE_VERSION);

/* ② migrate() 纯函数：最老档（无 saveVersion / state.v35 缺字段）补齐 */
(function () {
  const old = {
    state: {
      v35: {
        corpus: { items: 5, token: 3 },       // 反解：n=2*(5-3)=4, g=2*3-5=1 → [4,1,0]
        paper: { left: 0, done: false },      // 缺 kind
      },
      triggered: null,
      pending: undefined,
      engineers: null,
      ownedGpus: null,
      gpuTier: "standard",
      officePaused: undefined,
      usersMigrated: undefined,
    },
  };
  GS.migrate(old);
  const e = old.state.v35;
  ok("migrate: saveVersion 升级到当前版本", old.saveVersion === GS.SAVE_VERSION, "=" + old.saveVersion);
  /* 2026-09-10 doc/27 P1：维度容器改为「基础四维 + 全部能力轴」形状（值 0），
     这里断言全维度齐备且为 0（不再写死四维——否则每加一根轴都要来改测试）。 */
  ok("migrate: stageStart 补齐为全维度零值",
     window.V35.allDims().every((k) => e.stageStart[k] === 0)
     && Object.keys(e.stageStart).length === window.V35.allDims().length,
     JSON.stringify(e.stageStart));
  ok("migrate: extraPre/extraPost/extraData 补齐 = 0", e.extraPre === 0 && e.extraPost === 0 && e.extraData === 0);
  ok("migrate: paper.kind 补齐 = text_prob", e.paper.kind === "text_prob");
  ok("migrate: focusEverUsed/lvShift 补齐", e.focusEverUsed === false && e.lvShift === 0);
  ok("migrate: corpus.q 反解 = [4,1,0]", JSON.stringify(e.corpus.q) === JSON.stringify([4, 1, 0]), "[" + e.corpus.q + "]");
  ok("migrate: triggered/pending/engineers 补数组", Array.isArray(old.state.triggered) && Array.isArray(old.state.pending) && Array.isArray(old.state.engineers));
  ok("migrate: ownedGpus 由 gpuTier 反推 = ['standard']", JSON.stringify(old.state.ownedGpus) === JSON.stringify(["standard"]));
  ok("migrate: officePaused = false / usersMigrated = true", old.state.officePaused === false && old.state.usersMigrated === true);
})();

/* ③ migrate 幂等：新档（saveVersion=5 字段齐）不再改动 */
(function () {
  const fresh = {
    saveVersion: GS.SAVE_VERSION,
    state: { v35: { corpus: { items: 10, token: 5, q: [10, 0, 0] }, stageStart: { code: 0, text: 0, safety: 0, stability: 0 } },
      chatNode: null, notebook: [], _lastReplyIdx: {} },
  };
  const snapshot = JSON.stringify(fresh);
  GS.migrate(fresh);
  ok("migrate: 新档幂等（不破坏既有字段）", JSON.stringify(fresh) === snapshot);
})();

/* ③-b v3 → v4：末版 V4.5 通过的老档要补写 `r.finalRepeat`，并且**从废弃的终局页
   搬回结算演出最后一幕**（用户 2026-09-17：「不要这个界面了，删干净，
   直接在结算演出的成就那幕显示再战 V4.5」）。 */
(function () {
  const mk = (patch) => JSON.parse(JSON.stringify({
    saveVersion: 3,
    state: Object.assign({
      ver: "V4.5", phase: "over", week: 20,
      result: { verdict: "pass", score: 669.5, nextVer: null },
      bonus: { items: [{ label: "通过内部评审 · 阶段经费追加", value: 2400000 }], total: 2400000 },
    }, patch || {}),
  }));
  const a = mk();
  GS.migrate(a);
  ok("★ v3→v4：末版通过的老档 → 恢复V5入口", a.state.result.finalRepeat === false && a.state.result.nextVer === "V5" && a.state.embodiedEra.status === "intro");
  ok("★ v3→v4：同时从终局 over 页搬回结算演出（phase → bonus）", a.state.phase === "bonus", a.state.phase);
  ok("★ v3→v4：落在最后一幕（bonusAct=4，实际幕数由 rewardGoTo 夹值）", a.state.bonusAct === 4, String(a.state.bonusAct));

  /* 反向：非末版 / 被否决 / 重训 都不该被误补或误搬，否则会冒出不该有的「再战」按钮 */
  const b = mk({ ver: "V4", result: { verdict: "pass", score: 600, nextVer: "V4.5" } });
  GS.migrate(b);
  ok("v3→v4：非末版（有 nextVer）不补 finalRepeat、不动 phase",
    !b.state.result.finalRepeat && b.state.phase === "over");

  const c = mk({ result: { verdict: "fail", score: 300, nextVer: null } });
  GS.migrate(c);
  ok("v3→v4：未通过（fail）不补 finalRepeat、不动 phase",
    !c.state.result.finalRepeat && c.state.phase === "over");

  const d2 = mk({ phase: "bonus", result: { verdict: "pass", score: 669.5, nextVer: null, retry: true } });
  GS.migrate(d2);
  ok("v3→v4：任务未达成的重训档不补 finalRepeat", !d2.state.result.finalRepeat);

  const e2 = mk({ phase: "office", result: undefined });   // 没有 result（正常进行中的档）
  GS.migrate(e2);
  ok("v3→v4：进行中的档（无 result）不报错、不加字段、不动 phase",
    e2.state.result === undefined && e2.state.phase === "office");

  /* 兜底：万一老档没有 bonus 数据（搬不过去）→ 留在 over 页，但至少有「再战」按钮 */
  const f2 = mk({ bonus: undefined });
  GS.migrate(f2);
  ok("v3→v4：无 bonus 数据时不动 phase，但V5剧情状态已补",
    f2.state.result.nextVer === "V5" && !f2.state.result.finalRepeat && f2.state.phase === "over");
})();

/* ③-c v4 → v5（2026-09-30）：工程师潜力属性压回 0~100。
   2026-09-30 前的 trainEngineer 是 `stats[k] += 5` 从不夹紧（用户报「天赋理论上限 100，
   现在会突破上限」）⇒ 老档里可能留着 104 / 999 这类值，读档时就地压回 100。 */
(function () {
  const mk = (stats) => ({
    saveVersion: 4,
    state: {
      v35: { corpus: { q: [1, 0, 0] } },
      engineers: [
        { id: "e1", name: "溢出者", stats },
        { id: "e2", name: "正常人", stats: { code: 60, algo: 70, text: 80 } },
        { id: "e3", name: "没属性" },
      ],
    },
  });
  const a = mk({ code: 104, algo: 999, text: 100 });
  GS.migrate(a);
  ok("★ v4→v5：工程师潜力越界值压回 100", a.state.engineers[0].stats.code === 100
    && a.state.engineers[0].stats.algo === 100 && a.state.engineers[0].stats.text === 100,
    JSON.stringify(a.state.engineers[0].stats));
  ok("★ v4→v5：未越界的潜力原样保留", a.state.engineers[1].stats.code === 60
    && a.state.engineers[1].stats.algo === 70 && a.state.engineers[1].stats.text === 80);
  ok("★ v4→v5：缺 stats 的工程师不报错", !!a.state.engineers[2]);
  const neg = mk({ code: -5 });
  GS.migrate(neg);
  ok("★ v4→v5：负数也压回 0（非负口径）", neg.state.engineers[0].stats.code === 0);
  /* 幂等：已在范围内的档再 migrate 一次不变 */
  const snap2 = JSON.stringify(a);
  GS.migrate(a);
  ok("★ v4→v5：幂等（二次 migrate 不改动）", JSON.stringify(a) === snap2);
})();

/* ④ 老档无 v35 → load 判无效（null），引导开新档 */
(function () {
  store[GS.AUTO_KEY] = JSON.stringify({ state: { week: 3, code: 5 } });   // 无 v35
  ok("load: 老档(无 v35) 判无效 → null", GS.load("auto") === null);
  delete store[GS.AUTO_KEY];
})();

/* ⑤ buildSnapshot 带 saveVersion；经 save→load 完整往返 */
(function () {
  const GC = window.GameCore;
  GC.init(window.GameCfg);
  const s = GC.newGame();
  s.modelName = "小鲸鱼";
  s.week = 4;
  s.paramTarget = 7;
  store[GS.AUTO_KEY] = null;
  const snap = GS.save("auto", s);
  ok("buildSnapshot: saveVersion = 当前版本", snap.saveVersion === GS.SAVE_VERSION);
  const loaded = GS.load("auto");
  ok("load: 新档往返成功且 saveVersion为当前版本", loaded && loaded.saveVersion === GS.SAVE_VERSION && loaded.state.week === 4);
  ok("load: 新档 v35 已归一（stageStart 存在）", loaded && loaded.state.v35 && loaded.state.v35.stageStart);
  delete store[GS.AUTO_KEY];
})();

/* ⑥ 旧档随时间演变：构造一个「没有 v35 归一字段的存档」塞进去 → load 补齐后再 loadState 不白屏 */
(function () {
  const GC = window.GameCore;
  const snap = {
    saveVersion: 0,
    state: {
      version: 1, ver: "V1", phase: "office", modelName: "老档",
      week: 5, weekOffset: 0, step: 0, funding: 500000, brand: 50, reputation: 0,
      code: 0, text: 0, safety: 0, stability: 0, gpuTier: "basic", ownedGpus: null,
      paramTarget: 7, engineers: [], candidates: [], triggered: null, parallel: false,
      eff_boost: 0, direction: null, pending: undefined, lastReport: null, lastGrowth: null,
      v35: { tick: 30, corpus: { items: 4, token: 2 } },
    },
  };
  store[GS.AUTO_KEY] = JSON.stringify(snap);
  const loaded = GS.load("auto");
  ok("load: 旧档经 migrate 后字段补齐", loaded && loaded.state.v35.stageStart && loaded.state.v35.corpus.q);
  if (loaded) {
    const st = loaded.state;
    GC.loadState(st);
    const r = GC.state;
    ok("loadState: 旧档不白屏（phase=office / v35 存在）", r.phase === "office" && r.v35 && r.code === 0);
    ok("loadState: saveVersion 兜底存在", r.saveVersion !== undefined);
  }
  delete store[GS.AUTO_KEY];
})();

/* ⑦ 存档加固（2026-09-12）：旧档 v35 缺后加字段（energy/quota/weekly/focus…）
   → loadState 模板化补全，tick 不再抛异常（此前表现=时间/体力全部卡死） */
(function () {
  const GC = window.GameCore;
  GC.init(window.GameCfg);
  const st = GC.loadState({
    ver: "V1", phase: "office", modelName: "加固", week: 3, planDone: true,
    gpuTier: "basic", paramTarget: 7,
    v35: { tick: 20, arch: "dense", dataJoined: true },   // 只有半截引擎状态
  });
  const v = st.v35;
  ok("normalizeV35: energy 槽补齐且合法", v.energy && [v.energy.pre, v.energy.data, v.energy.post]
     .every((x) => typeof x === "number" && x >= 0 && x <= 100), JSON.stringify(v.energy));
  ok("normalizeV35: quota/weekly/focus/paper 补齐",
     Array.isArray(v.quota.pre) && Array.isArray(v.weekly) && v.focus && v.paper);
  ok("normalizeV35: 已有值不被覆盖", v.tick === 20 && v.arch === "dense");
  ok("normalizeV35: 幂等（再跑一次不变化）", (function () {
     const a = JSON.stringify(v); GC.normalizeV35(v); return JSON.stringify(v) === a; })());
  let threw = null;
  try { window.V35.simulate(v, 12); } catch (e) { threw = e; }
  ok("normalizeV35: 补全后引擎 tick 不抛异常", threw === null, threw && String(threw));
  ok("normalizeV35: tick 正常推进且体力仍在合法区间",
     v.tick === 32 && [v.energy.pre, v.energy.data, v.energy.post]
       .every((x) => x >= 0 && x <= 100), "tick=" + v.tick);
})();

/* ⑧ 阶段锚点存档（2026-09-12 兜底机制）：写读往返 + loadState 自动补锚 */
(function () {
  const GC = window.GameCore;
  GC.init(window.GameCfg);
  const st = GC.newGame();
  st.modelName = "锚点"; st.week = 2;
  const snap = window.GameSave.saveStage(st);
  ok("saveStage: 写入成功且带 saveVersion", !!snap && snap.saveVersion === GS.SAVE_VERSION);
  const back = window.GameSave.loadStage();
  ok("loadStage: 读回一致", back && back.state.week === 2 && back.state.v35);
  /* loadState：锚点缺失 / stageNo 不一致 → 自动补写一份 */
  window.GameSave.clearStage();
  GC.loadState(st);
  let a1 = window.GameSave.loadStage();
  ok("loadState: 无锚点时自动补写", !!a1 && a1.state.stageNo === 0);
  GC.state.stageNo = 5;
  window.GameSave.saveStage(GC.state);
  const before = window.GameSave.loadStage().state.week;
  GC.state.week = 9;                                   // 同阶段内推进（模拟读档前的进度）
  GC.loadState(GC.state);                              // stageNo 一致 → 锚点保持不动
  const a2 = window.GameSave.loadStage();
  ok("loadState: 同阶段内读档不推新锚点", a2.state.week === before, "锚点周=" + a2.state.week + " 当前周=9");
})();

/* ⑨ 品质保存 BUG 回归（2026-09-12 用户实测：打到 V1.5 语料全变普通）：
   _enterStage 把 tick 归零、语料跨阶段延续 → 老回填逻辑把带品质的 q 整表覆盖成全普通。
   守卫修复后：引擎与主状态已同步的档绝不回填，q 原样保留。 */
(function () {
  const GC = window.GameCore;
  GC.init(window.GameCfg);
  const snap = {
    saveVersion: 3,
    state: {
      ver: "V1.5", phase: "office", modelName: "品质", week: 1, planDone: true,
      gpuTier: "standard", paramTarget: 13,
      code: 30, text: 40, safety: 10, stability: 8,
      corpus: 300,                                  // 主状态语料（与引擎同步）
      v35: {
        tick: 0, ver: "V1.5", arch: "moe", paramTarget: 13,
        stats: { code: 30, text: 40, safety: 10, stability: 8 },
        corpus: { token: 300, items: 420, q: [220, 150, 50] },   // 优质 50 条不能丢
        energy: { pre: 90, data: 88, post: 92 },
      },
    },
  };
  store[GS.AUTO_KEY] = JSON.stringify(snap);
  const loaded = GS.load("auto");
  GS.load("auto") && GC.loadState(loaded.state);
  const q = GC.state.v35.corpus.q;
  ok("⑨ 阶段开头旧档：q 品质结构原样保留", JSON.stringify(q) === JSON.stringify([220, 150, 50]),
     JSON.stringify(q));
  ok("⑨ token 未被反解公式覆盖", GC.state.v35.corpus.token === 300, String(GC.state.v35.corpus.token));
  delete store[GS.AUTO_KEY];
})();

/* ⑩ 工程师 ID 化迁移（2026-09-14 · doc/32 §10.3）
   老档：实例主键是字符串 "eng_42"；新形态：池子条目 no(2001+) + key，实例主键 "e"+no。
   ⚠️ 判据**不是**「我列了哪些字段」，而是**全量遍历整个存档**扫旧字符串 —— 漏一个字段就红。 */
(function () {
  const GC = window.GameCore;
  const leg = GC.cfg.ENGINEERS_LEGACY_NO || {};
  const keys = Object.keys(leg);
  const k1 = keys[0], k2 = keys[1], k3 = keys[2];
  const n1 = leg[k1], n2 = leg[k2], n3 = leg[k3], u1 = "e" + n1, u2 = "e" + n2, u3 = "e" + n3;
  const legacyState = {
    ver: "V1.5", phase: "office", modelName: "旧档", week: 3, planDone: true,
    code: 30, text: 40, safety: 10, stability: 8,
    engineers: [
      { id: k1, name: "甲", type: "pretrain", traits: [{ type: "pretrain", level: 2 }], stats: { algo: 60 }, resigned: false },
      { id: k2, name: "乙", type: "post", traits: [{ type: "post", level: 2 }], stats: { code: 60 }, resigned: false },
    ],
    /* ⚠️ 候选人用**第三个**样本：读档会剔掉「已在团队里」的候选人（按 id 去重），
       用 k1 的话这条会被引擎正当地丢掉，测不到迁移。 */
    candidates: [{ id: k3, name: "候选人甲", type: "data", traits: [{ type: "data", level: 1 }], stats: { text: 50 } }],
    leader: k1, lastLeader: k2, _evTarget: k1, sparkUsed: [k2],
    tbTalked: {}, tbTrained: {}, workClicks: {}, workQuota: {},
    prodByEng: {}, prodFullByEng: {}, seatOf: {}, _candLocked: {},
    actionLog: [{ id: "act_1", targetId: k1 }],
    v35: {
      tick: 0, ver: "V1.5", arch: "moe", paramTarget: 13,
      stats: { code: 30, text: 40, safety: 10, stability: 8 },
      corpus: { token: 300, items: 420, q: [220, 150, 50] },
      energy: { pre: 90, data: 88, post: 92 },
      leaveWho: k1, poachWho: k2, riskWho: k1, prodAcc: {},
    },
  };
  legacyState.tbTalked[k1] = true;
  legacyState.tbTrained[k1 + ":3"] = true;               // ⚠️ 带 :week 后缀的键
  legacyState.workClicks[k1] = 2;
  legacyState.workQuota[k1] = 3;
  legacyState.prodByEng[k1] = 12;
  legacyState.prodFullByEng[k2] = true;
  legacyState.seatOf[k1] = 0; legacyState.seatOf[k2] = 1;
  legacyState._candLocked[k2] = 99;
  legacyState.v35.prodAcc[k1] = 5;

  GC.restore(JSON.parse(JSON.stringify(legacyState)));
  const s = GC.state;
  ok("⑩ 实例主键折成 e+no（并补上 no）",
    s.engineers[0].id === u1 && s.engineers[0].no === n1 && s.engineers[1].id === u2,
    s.engineers.map((e) => e.id).join(","));
  ok("⑩ 候选人也折了", s.candidates[0].id === u3 && s.candidates[0].no === n3, s.candidates[0].id);
  ok("⑩ 键表全迁（含 :week 后缀，旧键必须消失）",
    s.tbTalked[u1] === true && s.tbTrained[u1 + ":3"] === true && s.tbTrained[k1 + ":3"] === undefined
    && s.workClicks[u1] === 2 && s.workQuota[u1] === 3 && s.prodByEng[u1] === 12
    && s.prodFullByEng[u2] === true && s.seatOf[u1] === 0 && s._candLocked[u2] === 99
    && s.v35.prodAcc[u1] === 5);
  ok("⑩ 值指针全迁（负责人 / 事件目标 / 风险人 / 行动记录 / 火花）",
    s.leader === u1 && s.lastLeader === u2 && s._evTarget === u1
    && s.v35.leaveWho === u1 && s.v35.poachWho === u2 && s.v35.riskWho === u1
    && s.actionLog[0].targetId === u1 && s.sparkUsed[0] === u2);
  /* ⭐ 全量遍历：键 + 值都不许再有旧 id（`key` 是可读别名，故意保留，跳过） */
  const left = [];
  const OLD = new Set(keys);
  const walk = (o, path) => {
    if (o == null) return;
    if (typeof o === "string") { if (OLD.has(o)) left.push(path + " = " + o); return; }
    if (Array.isArray(o)) { o.forEach((v, i) => walk(v, path + "[" + i + "]")); return; }
    if (typeof o !== "object") return;
    Object.keys(o).forEach((k) => {
      const ci = k.indexOf(":");
      if (OLD.has(ci < 0 ? k : k.slice(0, ci))) left.push(path + " 的键 " + k);
      if (k !== "key") walk(o[k], path + "." + k);
    });
  };
  walk(s, "state");
  ok("⑩ 全量遍历：存档里零旧 id 残留（键 + 值）", left.length === 0, left.slice(0, 6).join(" / "));
  /* 幂等：再读一次档，什么都不该变 */
  const snap = JSON.stringify(s);
  GC.restore(JSON.parse(snap));
  ok("⑩ 幂等：重复读档结果不变", JSON.stringify(GC.state) === snap);
})();

/* ⑪ 读档不白送产出（2026-09-23 用户实测：「一直刷新重进的话，属性会莫名其妙增加，
      或者说增加得特别快」）
   根因：产出节流时钟 `_tickAt` 是 **epoch 毫秒**、随存档一起持久化，而 loadState 没重置它
   ⇒ 读档后 `now - _tickAt` 是「上次游戏到现在」的间隔（重进必过加载屏 + 主菜单，>10s）
   ⇒ 第一次 tick 白送一回合产出；连刷 10 次白送 9 回合 ≈ 90 秒产出。
   与 officePaused / pendingEvent 同一条口径：**运行期时钟不跨会话持久**。 */
(function () {
  const GC = window.GameCore;
  GC.init(window.GameCfg);
  GC.newGame();
  GC.setModelName("时钟鲸");
  GC.startProject("时钟鲸");
  for (const c of GC.state.candidates.slice(0, 3)) GC.hire(c.id);
  GC.state.gpuTier = "basic";
  GC.state.planDone = true;
  GC.state.officePaused = false;
  ok("⑪ 前置：引导门放行（否则 officeTick 提前 return，测不到节流逻辑）",
    GC.guidePending() === null, JSON.stringify(GC.guidePending()));

  const T = 1700000000000, HOUR = 3600 * 1000;
  GC.state._tickAt = T;                                   // 上次游戏里的产出时刻
  const saved = JSON.parse(JSON.stringify(GC.state));      // 存档（带着 _tickAt）
  ok("⑪ 存档确实带着 _tickAt（漏点前提）", saved._tickAt === T, String(saved._tickAt));

  GC.loadState(saved);                                    // 读档 = 刷新重进
  ok("⑪ loadState 复位产出时钟（不再跨会话持久）", GC.state._tickAt === 0, String(GC.state._tickAt));
  ok("⑪ 读档后第一次 tick 不白送产出", GC.officeTick(T + HOUR) === null);

  /* 反向守卫：修复不能把正常产出卡死 —— 满一个周期后必须照常推进 */
  GC.state._tickAt = T;
  ok("⑪ 满一个周期后照常推进（没把产出卡死）", GC.officeTick(T + 60000) !== null);
})();

/* ⑫ 评审演出「读档自愈」（2026-09-30 玩家实测：「我的旧存档进评审的时候直接跳过答题了」）
   机制：`renderEvalShow()` 的题**只来自存档里的 `s.evalShow`**，而 loadState / migrate
   **从不重建**它 ⇒ 凡是「进了评审、但那一刻没写 evalShow」的存档（历史 to-review 入口 /
   更老版本），读档后一律是「演出台在、一道题都没有、只剩『跳过 · 直出结果』」。
   loadState 现在按需重建 —— 判据必须是「缺失 / 空」，**已有演出绝不重抽**（刷新不换题）。 */
(function () {
  const GC = window.GameCore;
  GC.init(window.GameCfg);
  GC.newGame();
  GC.setModelName("自愈鲸");
  GC.enterReview();
  ok("⑫ 前置：enterReview 后 phase=review", GC.state.phase === "review", GC.state.phase);
  /* 演出台是 UI 侧（om-start-review）补建的 → core 只管阶段与总评。
     正因如此，「review 阶段的存档」**可能压根没带 evalShow**（历史 to-review 入口 /
     中途写档），读档重建就是唯一的补法。 */
  ok("⑫ 前置：core.enterReview 不建演出（演出由 UI 补建 ⇒ 老档可能缺）",
     !GC.state.evalShow);
  const score0 = GC.state.result && GC.state.result.score;

  /* ① 老档形态：phase=review 但压根没有 evalShow → 读档重建 */
  const noShow = JSON.parse(JSON.stringify(GC.state));
  delete noShow.evalShow;
  GC.loadState(noShow);
  ok("⑫ 老档缺 evalShow → 读档重建（不再是「零题演出」）",
     !!(GC.state.evalShow && (GC.state.evalShow.qs || []).length > 0),
     GC.state.evalShow ? GC.state.evalShow.qs.length + " 题" : "(无)");
  ok("⑫ 重建只补演出，不动总评", GC.state.result && GC.state.result.score === score0,
     String(GC.state.result && GC.state.result.score));

  /* ①-b 空演出形态（qs: []，buildEvalShow 的兜底产物）同样算「缺失」 */
  const emptyShow = JSON.parse(JSON.stringify(GC.state));
  emptyShow.evalShow = { qs: [], total: 0, per: 0, score: 0, hits: 0 };
  GC.loadState(emptyShow);
  ok("⑫ evalShow 为空数组 → 也重建",
     !!(GC.state.evalShow && (GC.state.evalShow.qs || []).length > 0));

  /* ② 反向守卫：已有演出（玩家刷新在中途）→ 绝不重抽，题目与顺序原样 */
  const withShow = JSON.parse(JSON.stringify(GC.state));
  const beforeQ = JSON.stringify(withShow.evalShow.qs);
  const beforeS = withShow.evalShow.score;
  GC.loadState(withShow);
  ok("⑫ 已有演出 → 读档不重抽（刷新不换题、不重掷对错）",
     JSON.stringify(GC.state.evalShow.qs) === beforeQ && GC.state.evalShow.score === beforeS);

  /* ③ 反向守卫：非评审阶段不预生成演出（免得白占存档体积、也别让办公室页拿到脏数据） */
  const offPhase = JSON.parse(JSON.stringify(GC.state));
  offPhase.phase = "office";
  delete offPhase.evalShow;
  GC.loadState(offPhase);
  ok("⑫ 非评审阶段不预生成 evalShow", !GC.state.evalShow);
})();

console.log(bad ? "失败 " + bad + " 项 ❌" : "全部通过 ✅");
process.exit(bad ? 1 : 0);
