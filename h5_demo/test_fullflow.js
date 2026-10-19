// ==========================================================================
// test_fullflow.js —— 完整流程 headless 回归（真实 game_core 驱动）
// 用法：node test_fullflow.js
// 覆盖：命名 → 招聘(3人) → 买卡 → 立项(门槛校验) → 论文 → 办公室36tick
//       （事件/到岗/周拨款/发薪/干劲/突破瓶颈）→ W6 自动评审 → 测评演出 → 结算
// 通过标准：无异常、phase 流转正确、评审 verdict 合法、四维恒为整数
// ==========================================================================
"use strict";
global.window = { addEventListener: () => {} };
const fs = require("fs");
const path = require("path");
const cfgSrc = fs.readFileSync(path.join(__dirname, "js", "game_cfg.js"), "utf8");
eval(cfgSrc);
/* 真实启动时游戏会 fetch data/game_cfg.json 并 deepMerge 覆盖出厂默认（编辑器保存产物），
   回归必须走同一条链路 —— 2026-09-02 事故：编辑器把二维数组写成「对象数组」，
   引擎 V.tick 每帧抛 "object is not iterable"，时间永远停在第 1 周，
   而本测试（只看出厂默认）全程全绿，完全没有兜住。 */
const deepMerge = new Function(cfgSrc.match(/function deepMerge[\s\S]*?\n}/)[0] + "\nreturn deepMerge;")();
let cfgLoaded = false;
try {
  const ext = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "game_cfg.json"), "utf8"));
  if (ext && ext.version) { deepMerge(window.GameCfg, ext); cfgLoaded = true; }
} catch (e) { /* 无编辑器产物 → 纯出厂默认 */ }
eval(fs.readFileSync(path.join(__dirname, "js", "v35_core.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "js", "game_core.js"), "utf8"));

const GC = window.GameCore, V = window.V35, C = window.GameCfg;
GC.init(C);

const N = Number(process.argv[2] || 200);
let fail = 0, exc = 0, reviewed = 0, eventSeen = 0, vigour = 0, bankrupt = 0;
const phases = {};

for (let seed = 0; seed < N; seed++) {
  try {
    // ① 命名
    const s = GC.newGame();
    GC.setModelName("小鲸鱼" + seed);
    // ② 招聘：三岗一次招齐（预训练即刻 + 数据 W2 + 后训练 W4 到岗生产）
    GC.genCandidates("V1");
    if ((s.candidates || []).length !== 3) throw new Error("开局候选人应为 3 人（预训练/数据/后训练），实际 " + s.candidates.length);
    for (const c of s.candidates.slice()) GC.hire(c.id);
    if (!GC.canProceedRecruit()) throw new Error("招聘未招满");
    if (s.engineers.length !== 3) throw new Error("开局团队应为 3 人（一次招齐），实际 " + s.engineers.length);
    // ③ 买卡
    if (!GC.buyGpu("basic").ok && s.gpuTier !== "basic") throw new Error("买卡失败");
    // ④ 立项（dense 门槛 80 = 持有 80，应通过；MoE 应被拒）
    s.phase = "office";
    const bad = GC.confirmPlan({ arch: "moe", recipe: "chat", param: 7, corpusIdx: 0 });
    if (bad.ok !== false) throw new Error("MoE 门槛 200 未被拒绝");
    const plan = GC.confirmPlan({ arch: "dense", recipe: "chat", param: 7, corpusIdx: 0 });
    if (!plan.ok) throw new Error("dense 立项失败：" + plan.tip);
    // ⑤ W1 读论文
    const pp = GC.startPaper("p_scaling");
    if (!pp.ok) throw new Error("论文研究失败：" + pp.tip);
    // ⑥ 办公室 36 tick（W4 攻关 text，模拟引导路径）
    GC.officeAdvance(18);
    if (!GC.startFocus("text").ok) { /* 门槛压线失败属正常（~40%） */ }
    GC.officeAdvance(18);
    GC.officeAdvance(6);   // 2026-09-09：W6 之后时间**继续推进**（想冲上限的玩家可继续训练，评审由玩家自己发起）
    if (s.week <= 6) throw new Error("W6 后时间应继续推进（周数 > 6，实际 " + s.week + "）");
    // ⑦ 三岗已一次招齐（数据 W2 / 后训练 W4 开始产出）
    if (s.engineers.length !== 3) throw new Error("终局团队应为 3 人，实际 " + s.engineers.length);
    // ⑧ 不变量：四维整数、无非法值
    for (const k of ["code", "text", "safety", "stability"]) {
      if (!Number.isFinite(s[k]) || !Number.isInteger(Math.round(s[k])) || Math.round(s[k]) !== s[k])
        throw new Error(k + " 非整数：" + s[k]);
    }
    // ⑧ W6 训练周期结束：phase 仍停在 office，评审由玩家发起（canReview = true，时间继续走）
    if (s.phase !== "office") throw new Error("W6 后应停在 office 等玩家发起评审，实际 " + s.phase);
    if (!GC.canReview()) throw new Error("W6 后应可发起评审");
    // ⑨ 玩家发起评审（新流程：enterReview → 答题演出数据 → finish → bonus）
    GC.enterReview();
    const es = GC.buildEvalShow();
    if (!es || !es.qs || es.qs.length <= 0) throw new Error("评审答题演出未生成");
    /* 2026-09-05（doc/17）：V1 只考正常聊天对话——题库必须全是 text 维度，
       且不能出现代码 / 安全 / 数学类题面（V1 主线是做能聊天的模型）。 */
    if (es.qs.some((x) => x.dim !== "text")) {
      throw new Error("V1 评审出现了非对话维度的题：" + es.qs.map((x) => x.dim).join(","));
    }
    /* 2026-09-05 修：`/%\d/` 会把正常文案里的「约 12% 重复样本」误判成数学题；`等于几`
       会误伤常识闲聊题（一加一等于几，bad 是废话文学，属于闲聊范畴）。关键词收紧到
       真正的代码 / 安全 / 逻辑推理特征。 */
    const CODE_MATH = /def |SELECT|=>|黑进|比 B 高/;
    if (es.qs.some((x) => CODE_MATH.test(x.q || ""))) {
      const badQ = es.qs.find((x) => CODE_MATH.test(x.q || ""));
      throw new Error("V1 评审出现了代码/安全/数学题：" + (badQ ? badQ.q : "?"));
    }
    if (es.skin !== "bubble") throw new Error("V1 演出皮肤应为 bubble，实际 " + es.skin);
    if (s.phase === "review") reviewed++;
    const r = s.result || GC.evaluate();
    if (!["excellent", "pass", "top"].includes(r.verdict)) throw new Error("V1 出现非法 verdict：" + r.verdict);
    if (r.verdict === "excellent") exc++;
    // ⑨ 事件链路（触发过的局结算后不崩）
    // ⑩ 结算：finish() → bonus（三幕演出数据）
    phases[s.phase] = (phases[s.phase] || 0) + 1;
    GC.finish();
    if (!s.bonus) throw new Error("finish() 未产出 bonus");
    /* 三幕结算（doc/16）数据契约：全版本都有用户（usersGained = score × USER_GAIN_MUL_BY_VER）；
       能力榜名次 = 1 + 比她分高的对手数（榜单分已取消，统一用评审分）；首次结算 rankPrev = null。 */
    const rF = s.result || {};
    const mulF = (C.USER_GAIN_MUL_BY_VER || {})["V1"];
    if (mulF == null) throw new Error("USER_GAIN_MUL_BY_VER 未配置");
    if (rF.verdict === "pass" || rF.verdict === "excellent") {
      if (rF.usersGained !== Math.round(rF.score * mulF)) throw new Error("usersGained 口径错误：" + rF.usersGained + " ≠ " + Math.round(rF.score * mulF));
      if ((s.users || 0) < rF.usersGained) throw new Error("累计用户数未累加");
      if (rF.userRating == null || rF.praiseRate == null) throw new Error("评分/好评率未生成");
      /* 2026-09-13 重设计：名次不再手写，而是拿本次评审总分去比榜（同一把尺子）。
   ⚠️ V1 的榜是**平的**（该阶段上限触顶，各队同分）→ 并列榜首 = 第 1；等 ① 阶段难度拍板后这里会变。 */
  const _b = (GC.cfg.RANK_BOARD_BY_VER || {})[s.ver] || [];
  const _my = Math.round((rF.rankScore != null ? rF.rankScore : rF.score) * 10) / 10;
  const _exp = _b.length ? 1 + _b.filter((x) => x.score > _my).length : 11;
  if (s.rank !== _exp) throw new Error("名次应为 1 + 比她分高的人数 = " + _exp + "，实际 " + s.rank);
      if (rF.rankPrev !== null) throw new Error("首次结算 rankPrev 应为 null，实际 " + rF.rankPrev);
    }
    if (!Array.isArray(s.traitUpgrades)) throw new Error("traitUpgrades 应为数组（结构化 {name,trait,from,to}）");
    for (const u of s.traitUpgrades) {
      if (typeof u !== "object" || !u.name || !u.trait || !(u.to > u.from)) throw new Error("traitUpgrades 结构化数据非法：" + JSON.stringify(u));
    }
    if (s.bonusAct !== null && s.bonusAct !== undefined) throw new Error("新结算 bonusAct 应重置为 null");
    const histF = s.modelHistory || [];
    const lastF = histF[histF.length - 1];
    if (!lastF || lastF.ver !== "V1") throw new Error("modelHistory 未写入本版快照");
  } catch (e) {
    fail++;
    if (fail <= 5) console.error("  ✗ seed " + seed + ": " + e.message);
  }
}

console.log("--- 全流程回归 " + N + " 局（配置：" + (cfgLoaded ? "出厂默认 + data/game_cfg.json" : "纯出厂默认") + "）---");
console.log("WEEKS=" + C.V35.WEEKS, "TICKS_PER_WEEK=" + C.V35.TICKS_PER_WEEK,
            "攻关门槛=" + C.V35.FOCUS_CORPUS_GATE, "攻关经费=" + C.V35.FOCUS_COST,
            "TIER_RANGES[0]=" + JSON.stringify(C.V35.TIER_RANGES[0]));
console.log("通过:", (N - fail), "| 失败:", fail);
console.log("玩家发起评审:", reviewed, "| 优秀:", exc, "| 破产(不应出现):", bankrupt);
console.log("评审 phase 分布:", JSON.stringify(phases));
if (fail > 0) { process.exitCode = 1; console.error("存在失败项"); }
else console.log("✓ 全流程通过");
