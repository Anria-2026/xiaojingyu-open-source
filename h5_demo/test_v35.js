/* ==========================================================================
   test_v35.js —— v35_core.js 无头验证（node 直接驱动真实引擎）
   跑法：node test_v35.js
   对齐目标 = doc/14 §6.2（doc/sim_v35.py 3000 次蒙特卡洛）。
   ⚠️ 2026-09-02 重新校准：每周语料增量改为由「架构 × 参数」决定后，
      最低档 dense+7B 从 40 降到 34（数据工程师到岗即能覆盖增量 —— 用户明确要求），
      缺口压力整体上移 → 预训练产出随之抬升。为让「优秀」仍是需要努力拿到的，
      优秀线 GREAT_SCORE 由 28 上调到 29。以下期望值 = 新设计实跑结果：
     A 认真玩   总分 ≈29.45 ± 2.20   优秀 ≈57%
     B 买60token 总分 ≈30.01          优秀 ≈68%（买语料仍是正收益，但不再一骑绝尘）
     C 加招1人   总分 ≈34.64          优秀 ≈98%
     D 挂机      总分 ≈22.35          优秀 = 0%
     E 探索      总分 ≈28.52          优秀 ≈41%
     F 全程加班  总分 ≈28.38          优秀 ≈38%
     W3 一测 text ≈14.3（咕嘎 ~68%）；W5 二测 text ≈31.3（完整 ~100%）
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

global.window = {};
eval(fs.readFileSync(path.join(__dirname, "js", "game_cfg.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "js", "v35_core.js"), "utf8"));
const V35 = window.V35;
const C = window.GameCfg.V35;

const N = 3000;
const TOTAL = C.WEEKS * C.TICKS_PER_WEEK;

function run(mode, opts, seed, until) {
  const st = V35.createState(mode, opts && opts.overtime, opts && opts.extraData);
  const rng = V35.mulberry32(seed);
  if (opts && opts.buy) V35.buyCorpus(st, opts.buy);             // 120 条外包（随机品质）
  V35.simulate(st, until || TOTAL, rng);
  return st;
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) * (x - m))));
};

function battery(name, mode, opts) {
  const totals = [];
  let ok = 0;
  const dims = { code: [], text: [], safety: [], stability: [] };
  for (let seed = 0; seed < N; seed++) {
    const st = run(mode, opts, seed);
    const r = V35.review(st);
    totals.push(r.total);
    if (r.excellent) ok++;
    for (const d of Object.keys(dims)) dims[d].push(st.stats[d]);
  }
  console.log(`${name.padEnd(22)} 总分 ${mean(totals).toFixed(2)} ± ${sd(totals).toFixed(2)}   优秀 ${(ok / N * 100).toFixed(1)}%   code ${mean(dims.code).toFixed(1)} text ${mean(dims.text).toFixed(1)} safety ${mean(dims.safety).toFixed(1)} stab ${mean(dims.stability).toFixed(1)}`);
  return { total: mean(totals), exc: ok / N * 100 };
}

console.log("### v35_core 无头验证（%d 次/档，目标 = doc/14 §6.2）", N);
const A = battery("A 认真玩", "serious");
const B = battery("B 买60token", "serious", { buy: 120 });
const Cc = battery("C 加招1人", "serious", { extraData: 1 });
const D = battery("D 挂机", "idle");
const E = battery("E 探索", "explore");
const F = battery("F 全程加班", "serious", { overtime: true });

/* 测试演出时间轴 */
for (const [until, label, ref] of [[18, "W3 一测", 14.2], [30, "W5 二测", 29.3]]) {
  const texts = [], tiers = { dumb: 0, full: 0 };
  for (let seed = 0; seed < 2000; seed++) {
    const st = run("serious", null, seed, until);
    texts.push(st.stats.text);
    tiers[V35.testTier(st).tier]++;
  }
  console.log(`${label}: text ${mean(texts).toFixed(2)}（参考 ${ref}）  咕嘎 ${(tiers.dumb / 20).toFixed(1)}%  完整 ${(tiers.full / 20).toFixed(1)}%`);
}

/* 断言（±统计容差） */
const assert = (cond, msg) => { if (!cond) { console.error("✗ FAIL: " + msg); process.exitCode = 1; } };
/* 期望值 = 2026-09-02 重新校准后的实跑值（见文件头说明） */
assert(Math.abs(A.total - 29.45) < 0.4, "A 总分 " + A.total.toFixed(2) + " ≈ 29.45");
assert(Math.abs(A.exc - 57.1) < 4, "A 优秀率 " + A.exc.toFixed(1) + " ≈ 57%");
assert(B.exc > 60 && B.exc < 80, "B 优秀率 " + B.exc.toFixed(1) + " ≈ 68%");
assert(Cc.exc >= 97, "C 优秀率 " + Cc.exc.toFixed(1) + " = 100%");
assert(D.exc < 1, "D 优秀率 " + D.exc.toFixed(1) + " = 0%");
assert(F.exc < A.exc, "F 加班 " + F.exc.toFixed(1) + "% 不得高于认真玩 " + A.exc.toFixed(1) + "%");
assert(D.total < A.total - 4, "挂机与认真玩拉开差距");
console.log(process.exitCode ? "\n存在失败项" : "\n✓ 全部通过——引擎与 doc/14 §6.2 数值一致");
