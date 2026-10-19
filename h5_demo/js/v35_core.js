/* ==========================================================================
   v35_core.js —— V3.5.2 核心循环引擎（doc/14 定稿模型的唯一实现）
   --------------------------------------------------------------------------
   · 消费 GameCfg.V35 配置块；与 doc/sim_v35.py 逐行同构（蒙特卡洛已校准）
   · 纯逻辑无 DOM：可在 node 里无头跑（doc/test_v35.js），也可被 game_core 调用
   · 职责：产出 tick（配额洗牌 + 整数区间 roll）、语料需求曲线、论文永续、
     攻关、突破瓶颈、测试演出三档、评审总分制
   · 不负责：UI 演出、事件弹窗、存档（由 game_core / game_ui 承接）
   ========================================================================== */
"use strict";

window.V35 = (function () {
  const C = () => window.GameCfg.V35;

  /* ==========================================================================
     能力维度 · 单点真源（P0 · 2026-09-10，doc/27）
     --------------------------------------------------------------------------
     现状：四维字面量 ["code","text","safety","stability"] 曾散落在
     game_core(17) / game_ui(3) / 本文件(1)，共 21 处 —— 加一根维度就要改 21 个地方，
     漏一处就是「算了但不显示」或「显示但不进评审」。
     收敛后：所有地方一律走 dimsOf() / dimObj()，字面量只允许出现在 DIM_ORDER 里。
     · 基础四维恒定存在（DIM_ORDER）
     · 追加能力轴（记忆 memory / 推理 reasoning / 工具 tool）由 P1 的 AXES 配置接入
       activeAxes()；P0 阶段恒为空数组 → 行为与改造前逐位一致。
     ⚠️ 每次返回新数组：调用方可安全 push/sort，不会污染真源（与原先的字面量语义一致）。
     ========================================================================== */
  const DIM_ORDER = ["code", "text", "safety", "stability"];

  /* 全部维度 = 基础四维 + 所有**可能**出现的轴（= 容器形状）。
     stats / stageStart / cap / 存档字段一律按这个建，值默认 0 —— 好处是轴激活状态变化时
     不必重建容器、也不会出现「半途多键/少键」；展示与评审**不看它**，那是 dimsOf() 的职责。 */
  function allDims() {
    const A = C().AXES || {};
    return DIM_ORDER.concat(A.ORDER || []);
  }

  /* 本模型当前「存在」的追加能力轴 —— 激活 = **架构 × 参数 双条件**，缺一不可。
     入参兼容两种状态形状：引擎槽 st（st.arch / st.paramTarget）与根存档 s（s.arch / s.v35.arch）。
     未立项（arch 为空）→ 无轴：立项面板在玩家选完之前不该先显示轴。 */
  function activeAxes(st) {
    const A = C().AXES;
    if (!A || A.ENABLED === false) return [];
    const src = st || {};
    const arch = src.arch != null ? src.arch : (src.v35 && src.v35.arch);
    if (!arch) return [];
    const param = src.paramTarget != null ? src.paramTarget
                : (src.v35 && src.v35.paramTarget);
    const P = Number(param) || 0;
    return (A.ORDER || []).filter((id) => {
      const d = (A.DEF || {})[id];
      if (!d || !d.source) return false;
      if (d.source.minVer) { const vs = (window.GameCfg || {}).VER_ORDER || []; if (vs.indexOf(src.ver || "V1") < vs.indexOf(d.source.minVer)) return false; }
      if ((d.source.archs || []).indexOf(arch) < 0) return false;
      return P >= (d.source.paramMin || 0);
    });
  }

  /* 本模型的维度（**展示 / 遍历 / 评审口径**）= 基础四维 + 本模型激活轴（每次新数组） */
  function dimsOf(st) {
    return DIM_ORDER.concat(activeAxes(st));
  }

  /* 建对象：默认按 allDims()（容器）；传 keys 则按指定维度列表 */
  function dimObj(value, keys) {
    const o = {};
    for (const k of (keys || allDims())) o[k] = typeof value === "function" ? value(k) : value;
    return o;
  }

  /* V5 合并的是能力预算与判定，存档继续保存原字段。两个原产线共享总上限，
     不因其中一项先达到旧上限而丢掉后续产出；旧阶段保持原有独立四维。 */
  function mergedGroups(st) {
    const order = (window.GameCfg || {}).VER_ORDER || [];
    const first = order.indexOf("V5");
    return first >= 0 && order.indexOf((st || {}).ver) >= first
      ? [{ key: "codeText", sources: DIM_ORDER.slice(0, 2) },
         { key: "safetyStability", sources: DIM_ORDER.slice(2, 4) }] : [];
  }
  function statLimit(st, key, caps, stats) {
    const group = mergedGroups(st).find(g => g.sources.includes(key));
    if (!group) return caps[key] != null ? caps[key] : Infinity;
    const values = stats || (st || {}).stats || st || {};
    const budget = group.sources.reduce((n, k) => n + (Number(caps[k]) || 0), 0);
    const others = group.sources.filter(k => k !== key).reduce((n, k) => n + Math.max(0, Number(values[k]) || 0), 0);
    return Math.max(0, budget - others);
  }
  function clampStats(st, values, caps) {
    const out = {};
    const groups = mergedGroups(st), paired = new Set(groups.flatMap(g => g.sources));
    for (const key of allDims()) {
      let value = Math.max(0, Number(values[key]) || 0);
      if (value === Infinity && paired.has(key)) {
        value = groups.find(g => g.sources.includes(key)).sources.reduce((n, k) => n + (Number(caps[k]) || 0), 0);
      }
      out[key] = paired.has(key) || caps[key] == null ? value : Math.min(caps[key], value);
    }
    for (const group of groups) {
      const [a, b] = group.sources, budget = Math.max(0, (Number(caps[a]) || 0) + (Number(caps[b]) || 0));
      const sum = out[a] + out[b];
      if (sum > budget) {
        out[a] = Math.floor(budget * out[a] / sum);
        out[b] = budget - out[a];
      }
    }
    return out;
  }

  /* 某根轴在当前阶段的上限；缺阶段 → null = 不封顶。
     ⚠️ 2026-09-13 用户拍板：轴上限**与四维同口径** ——
        capByVer 是「参数倍率 = 1.0 的基准值」，引擎按 PARAM_CAP_MUL[paramTarget] 缩放
        （与 CAP_BY_VER / statCap 完全对称）。以前是「绝对上限、不乘倍率」，
        口径与四维不一致 → 玩家调大参数时轴不跟着涨，越到后期越容易提前触顶。 */
  function axisCap(ver, id, param) {
    const d = ((C().AXES || {}).DEF || {})[id];
    const t = (d && d.capByVer) || {};
    const x = t[ver];
    if (typeof x !== "number") return null;
    /* ⚠️ PARAM_CAP_MUL 是**顶层**键（不在 V35 里）—— C() 返回的是 window.GameCfg.V35，别搞错 */
    const PM = (window.GameCfg || {}).PARAM_CAP_MUL || {};
    const mul = PM[String(param)] != null ? PM[String(param)] : 1;
    return Math.round(x * mul * 10) / 10;
  }

  /* 某根轴在当前阶段的「达标线」（AXES.DEF[*].passByVer）；缺阶段 → null */
  function axisPass(ver, id) {
    const d = ((C().AXES || {}).DEF || {})[id];
    const t = (d && d.passByVer) || {};
    const x = t[ver];
    return typeof x === "number" ? x : null;
  }

  /* ---------- 评审线参数缩放（2026-09-24 修「通过线比数值上限还高」）----------
     MIN_DIM / AXIS_MIN / GREAT_SCORE 全部按 MISSIONS.BY_VER **钉死的 (架构,参数)** 标定。
     但主线可以「暂缓」：玩家可用同阶段**任意没用过的组合**重训（combo 规则），
     参数档变小 ⇒ statCap 按 PARAM_CAP_MUL 缩小，线却停在原位 ——
     实测 V3.5 用 34B（×1.3，上限 468）时文字线 513 > 468，物理上不可能通过（用户截图）。
     ⇒ 线统一乘「当前参数倍率 / 钉死参数倍率」：线/上限比例恒定，
        小参数不会更容易、也不会不可能；钉死组合（含全部既有测试）scale = 1，行为逐位不变。 */
  function lineScale(ver, param) {
    const G = window.GameCfg || {};
    const PM = G.PARAM_CAP_MUL || {};
    const pin = ((G.MISSIONS || {}).BY_VER || {})[ver || "V1"];
    const pinP = pin && pin.param != null ? pin.param : null;
    if (pinP == null) return 1;              // 该阶段没有钉死参数 → 无从缩放，保持原线
    const cur = param != null ? param : pinP;
    const cm = (PM[String(cur)] != null ? PM[String(cur)] : 1);
    const bm = (PM[String(pinP)] != null ? PM[String(pinP)] : 1);
    if (!bm || !isFinite(cm / bm)) return 1;
    return cm / bm;
  }

  /* ---------- 工具 ---------- */
  const eff = (e) => 0.5 + 0.5 * e / 100;               // 体力效率：0.5 + 0.5×体力/100
  const focusMatches = (focus, dim) => focus === dim
    || (focus === "codeText" && (dim === "code" || dim === "text"))
    || (focus === "safetyStability" && (dim === "safety" || dim === "stability"));
  const inOff = (t) => t >= C().OFF_START && t < C().OFF_START + C().OFF_LEN;

  /* 值数组归一化（防御）：配置/存档偶发把二维数组 [[1,2],[2,3]] 序列化成
     [{0:1,1:2},{0:2,1:3}]，此时 `const [lo,hi] = row` 会抛 "object is not iterable"，
     整个 tick 崩掉 → 周数永远不推进（2026-09-02 事故：时间永远停在第 1 周）。
     这里统一兜底还原成真数组，配置再被污染也不会让引擎停摆。 */
  function rows(arr, fallback) {
    if (!Array.isArray(arr) || !arr.length) return fallback || [];
    return arr.map(function (r) {
      if (Array.isArray(r)) return r;
      if (r && typeof r === "object") {
        const ks = Object.keys(r).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b);
        if (ks.length) return ks.map((k) => r[k]);
      }
      return [r, r];
    });
  }

  /* 可种子化随机（游戏内传 Math.random 即可；无头测试传种子 rng） */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  /* 随机舍入：floor + 按小数部分概率进位——保期望，且结果恒为整数（用户要求模型数值不出小数） */
  const roundI = (rng, g) => Math.floor(g) + (rng() < g - Math.floor(g) ? 1 : 0);
  function shuffled(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- 状态 ----------
     mode: "serious"(攻关 text，默认路线) / "explore"(攻关 code) / "idle"(挂机)
     overtime: 强征加班（每 tick 都在岗）
     extraData: 额外数据工程师人数（V1 不实装，保留字段） */
  function createState(mode, overtime, extraData, extraPre, extraPost) {
    const v = C();
    return {
      mode: mode || "serious",
      ver: "V1",                             // 当前阶段（startNextStage 更新；驱动曲线/品质列）
      overtime: !!overtime,
      extraData: extraData || 0,
      extraPre: extraPre || 0,                          // 扩招：额外预训练工程师编制
      extraPost: extraPost || 0,                        // 扩招：额外后训练工程师编制
      tick: 0,
      stats: dimObj(0),                       // 全维度初值（基础四维 + 追加轴）
      stageStart: dimObj(0),                  // 阶段起点快照：评审按「本阶段增量」计（V1 起点=0，与全量等价）
      /* q = 三档品质各自条数 [普通, 良好, 优质]（背包式库存展示用；token/items 仍是总口径） */
      corpus: { token: v.CORPUS_CURVE.INIT_TOKEN, items: v.CORPUS_CURVE.INIT_ITEMS,
                 q: [v.CORPUS_CURVE.INIT_ITEMS, 0, 0] },
      energy: { pre: 100, data: 100, post: 100, embodied: 100 },
      extraEmbodied: 0, restEmbodied: 0, embodiedJoined: false,
      /* 正在「下班休息」的工程师数（2026-09-08）：安排休息 = 本周不产出，下周上班才回体力。
         由 GameCore.syncResting() 每个 tick 按工程师的 restWeek 写入；这里只做产出扣减。 */
      restPre: 0, restData: 0, restPost: 0,
      quota: { pre: [], post: [] },          // 当前配额余量
      preMul: 1,                             // 语料缺口 → 预训练产出系数
      lvShift: 0,                            // 突破瓶颈：产出档位 +1
      preTraitLv: 1, postTraitLv: 1,         // 当前主岗工程师主词条等级（game_core 注入；无头测试兜底 1）
      /* 论文研究倒计时 / 永续生效 / 已开研。
         axis / axisProb / axisAdd = 2026-09-10 doc/27 P5：论文「附赠」的轴效果
         （永续：每 tick 概率 axisProb 给 axis 加 axisAdd），由 game_core.startPaper 写入。 */
      paper: { left: 0, done: false, started: false, kind: "text_prob", axis: null, axisProb: 0, axisAdd: 1 },
      focus: { dim: null, left: 0 },         // 攻关
      focusEverUsed: false,                  // 突破差异化：本阶段是否有攻关投入
      weekly: [],                            // 每周语料结算记录（看板/红字用）
      gapState: "ok",                        // ok | tight | warn | out（四色标签）
      prodLog: [],                           // 飘字日志 {who, dim, amount}（最近由 tick 填充）
      /* 语料品质配比（2026-09-03）：立项时选好写入；qualityMul = 达标提速 / 不达标降速 */
      qualityMix: null,                      // { n, g, p } = 普通/良好/优质 格数（0~5，合计 ≤ 5）
      qualityMul: 1,                         // 全产出速度系数（见 tick 中 qm）
    };
  }

  /* ---------- 单个产出 tick（10s）----------
     返回本 tick 的飘字列表 [{ who, dim, amount, focus }] */
  function tick(st, rng) {
    const v = C();
    rng = rng || Math.random;
    const t = st.tick;
    const qm = st.qualityMul != null ? st.qualityMul : 1;   // 语料品质配比系数（2026-09-03）
    /* 值数组归一化（见 rows 说明）：配置被污染也不至于让 tick 抛异常 */
    const tierRanges = rows(v.TIER_RANGES, [[1, 2]]);
    const gapTiers = rows(v.CORPUS_CURVE.GAP_TIERS, [[0.05, 1], [0.15, 0.9], [0.3, 0.6], [9, 0]]);
    /* joined 判定：
       pre 恒在岗；data（语料产能）以游戏侧实际到岗为准（st.dataJoined 覆盖），
       无覆盖时按 tick≥JOIN_DATA（无头 sim 默认）；post 同款走 st.postJoined。 */
    /* ⚠️ 2026-09-13 修 BUG（用户实测「两个后训练 lv4，产出却远低于一个预训练 lv4」）：
       post 原来写死 `t >= v.JOIN_POST`，而 **t 每阶段从 0 重跑**（`_enterStage` 里
       `s.v35.tick = 0`）—— 于是每个阶段的前 18/36 tick = **3 周整条后训练产线不产出**，
       同时 pre 是 `true` 恒在岗、data 早已硬对齐实体 ⇒ 三者语义完全不一致。
       越到后期越荒谬：V4 明明养着一队后训练工程师，每阶段开局仍要干等 3 周。
       现在与 data 同款：**团队里真有已到岗的 post 工程师才开工**（game_core 注入 st.postJoined），
       无覆盖时（无头 sim）才回落到旧的 tick 判定。 */
    const joined = {
      pre: st.preJoined === undefined ? true : !!st.preJoined,
      data: st.dataJoined === undefined ? (t >= v.JOIN_DATA) : !!st.dataJoined,
      post: st.postJoined === undefined ? (t >= v.JOIN_POST) : !!st.postJoined,
      embodied: !!st.embodiedJoined,
    };
    const onduty = !inOff(t) || st.overtime;
    const offNow = inOff(t);
    const otMul = st.overtime && offNow ? v.OVERTIME_MUL : 1;
    const floats = [];

    /* 体力：仅已入职者结算。
       2026-09-12 修（用户实测「体力卡在个位数加不动」）：V3.5 重写时把旧模型的
       「低体力停产 + 自然回复」分支弄丢了 —— 上班每 tick 固定 -1.5 永不回复，
       下班回血只在 tick 18~20 的一次性窗口出现，体力后期只跌不涨、跌到 0 就永久趴窝。
       补回旧模型语义：体力 < ENERGY_MIN(20) 时停产并按 ENERGY_REST 自然回复，
       回到门槛以上恢复产出（玩家仍可用团建/谈心/加薪主动拉满）。 */
    /* 论文效果（2026-09-13）：由 game_core.paperEffects() 每 tick 注入 st.paperFx。
       ⚠️ 只作用于**产出这一块** —— 不碰 TICK_S / EVENT_EVERY / TICKS_PER_WEEK：
       「产出效率」= 单位时间产出更高，不会让游戏时间变快、也不改事件频率。 */
    const fx = st.paperFx || {};
    const fxRoll = fx.extraRoll || {};
    const fxBonus = fx.dimBonus || {};
    const fxEnergy = fx.roleEnergy || {};
    const fxAmp = fx.axisAmp || {};
    const fxRate = fx.axisRate || {};
    const fxFocusAdd = fx.focusAdd || 0;
    const rollProb = (role) => (fxRoll[role] || 0) + (fxRoll.all || 0);
    /* 体力按**编制下标逐人**结算（2026-09-22，用户要求「选谁谈心就只恢复谁的体力」）。
       st.energyList = { pre:[..], data:[..], post:[..] } 由 game_core 每 tick 注入，
       下标 = 产出编制序号（已扣本周休息 / 未到岗，与 dataTraitLvs 同款口径），
       **只存活这一 tick**：tick 结束后 game_core 回写到 e.energy 并删掉它。
       没有该数组（无头 sim / 旧档 / 非 V3.5）⇒ 回落到旧的**岗位共享标量** st.energy[k]，
       行为与改版前逐位一致（同岗位多人等体力时，逐人与共享的产出结果完全相同）。 */
    const enListOf = (k) => (st.energyList && Array.isArray(st.energyList[k])) ? st.energyList[k] : null;
    const enAt = (k, i, fallback) => {
      const a = enListOf(k);
      const x = a ? a[i] : undefined;
      return typeof x === "number" ? x : fallback;
    };
  /* [feature:multi-trait-dev-v35-001] */
    /* 个人倍率/各生产词条等级与 energyList 使用相同编制顺序；无头旧路径默认倍率 1。 */
  /* [/feature:multi-trait-dev-v35-001] */
    const productionMulAt = (k, i) => {
      const x = st.productionMulList && st.productionMulList[k] && st.productionMulList[k][i];
      return typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 1;
    };
    const traitLvAt = (k, i, fallback) => {
      const x = st.traitLevelList && st.traitLevelList[k] && st.traitLevelList[k][i];
      return typeof x === "number" && x > 0 ? x : fallback;
    };
    /* 标量 st.energy[k] 始终维护成该岗位的**人均值**（派生量）：事件门槛、周产出估算、
       旧 UI 都还在读它，不能让它变成孤儿字段。 */
    const syncSlot = (k) => {
      const a = enListOf(k);
      if (!a || !a.length) return;
      let sum = 0, n = 0;
      for (const x of a) { if (typeof x === "number") { sum += x; n++; } }
      if (n) st.energy[k] = Math.round(sum / n);
    };
  /* [feature:multi-trait-dev-v35-002] */
    const settledEnergy = new Map(); // 同一真人的多条产线共用一次体力结算
  /* [/feature:multi-trait-dev-v35-002] */
    for (const k of Object.keys(joined)) {
      if (!joined[k]) continue;
      const _costMul = fxEnergy[k] != null ? fxEnergy[k] : 1;   // 论文 role_energy：体力消耗倍率
      const a = enListOf(k);
      if (!a) {   /* 旧路径：岗位共享标量（无头 sim / 旧档） */
        if (!onduty) { st.energy[k] = Math.min(100, st.energy[k] + v.ENERGY_REST); continue; }
        if (st.energy[k] < v.ENERGY_MIN) {
          st.energy[k] = Math.min(v.ENERGY_MIN, st.energy[k] - v.ENERGY_TICK * _costMul);
          continue;
        }
        st.energy[k] = Math.max(0, st.energy[k] + v.ENERGY_TICK * _costMul);
        continue;
      }
      for (let i = 0; i < a.length; i++) {
        if (typeof a[i] !== "number") continue;
  /* [feature:multi-trait-dev-v35-003] */
        const owner = st.energyOwnerList && st.energyOwnerList[k] && st.energyOwnerList[k][i];
        if (owner != null && settledEnergy.has(owner)) { a[i] = settledEnergy.get(owner); continue; }
        const primaryRole = owner != null && st.energyRoleById ? st.energyRoleById[owner] : k;
        const costMul = owner != null ? (fxEnergy[primaryRole] != null ? fxEnergy[primaryRole] : 1) : _costMul;
        if (!onduty) a[i] = Math.min(100, a[i] + v.ENERGY_REST);
        else if (a[i] < v.ENERGY_MIN) a[i] = Math.min(v.ENERGY_MIN, a[i] - v.ENERGY_TICK * costMul);
        else a[i] = Math.max(0, a[i] + v.ENERGY_TICK * costMul);
        if (owner != null) settledEnergy.set(owner, a[i]);
  /* [/feature:multi-trait-dev-v35-003] */
      }
      syncSlot(k);
    }

    /* 攻关：W4 起（V1 引导选最薄弱维度）；autoFocus=false 时由游戏侧 startFocus 手动开 */
    if (st.mode !== "idle" && st.autoFocus !== false && t === v.JOIN_POST && st.focus.left === 0) {
      st.focusEverUsed = true;
      st.focus.dim = st.mode === "explore" ? "code" : "text";
      st.focus.left = v.FOCUS_TICKS;
    }
    /* 论文：由游戏侧 startPaper 手动开研（paperManual=true）；无头测试走自动 */
    if (st.mode !== "idle" && st.paperManual !== true && t === v.JOIN_DATA
        && !st.paper.started && !st.paper.done) {
      st.paper.started = true;
      st.paper.left = v.PAPER_RESEARCH_TICKS;
    }
    /* W5 突破瓶颈：预训练产出档位 +1（区间整体上移一档；挂机玩家不触发） */
    if (st.mode !== "idle" && (!v.BREAKTHROUGH.REQUIRE_FOCUS || st.focusEverUsed) && t === v.BREAKTHROUGH.TICK) {
      st.lvShift += v.BREAKTHROUGH.SHIFT;
    }

    /* ---- 预训练工程师（W1 在岗，吃语料，受缺口惩罚；extraPre = 扩招编制数）----
       安排休息的人（restPre）本周下班、不产出（2026-09-08）。 */
    /* 单次预训练产出（闭包）：论文 extra_roll = 按概率**再跑一遍**它 */
    const preProduce = (preIdx, en) => {
      if (!st.quota.pre.length) st.quota.pre = shuffled(rng, v.PRE_QUOTA);
      const dim = st.quota.pre.pop();
  /* [feature:multi-trait-dev-v35-004] */
      /* 词条等级 → 产出档位（DOC「词条等级接入产出」）：按本人 pre 生产词条等级查表，
         突破瓶颈(lvShift)在词条等级档位上再上移一档。默认对齐 TIER_RANGES。 */
  /* [/feature:multi-trait-dev-v35-004] */
      const preTiers = rows(v.PRE_TRAIT_TIERS || v.TIER_RANGES, [[1, 2]]);
      const preLv = Math.max(1, Math.min(5, traitLvAt("pre", preIdx, st.preTraitLv || 1)));
      const tierIdx = Math.min((preLv - 1) + (st.lvShift || 0), preTiers.length - 1);
      const [lo, hi] = preTiers[tierIdx] || [1, 2];
            let g = randInt(rng, lo, hi) * eff(en) * st.preMul * otMul * qm * productionMulAt("pre", preIdx);
            const hitFocus = st.focus.left > 0 && focusMatches(st.focus.dim, dim);
            if (hitFocus) g *= (v.FOCUS_MUL + fxFocusAdd);   // 论文 focus_mul 叠加
            g += (fxBonus[dim] || 0);                        // 论文 dim_bonus：该维度额外 +N
            g = roundI(rng, g);
            st.stats[dim] += g;
      floats.push({ who: "pre", slot: preIdx, dim, amount: g, focus: hitFocus });
      if (dim === "text" && st.paper.done && st.paper.kind === "text_prob" && rng() < v.PAPER_TEXT_PROB) {
        st.stats.text += v.PAPER_TEXT_ADD;               // 论文永续：10% 概率 +1
        floats.push({ who: "paper", dim: "text", amount: v.PAPER_TEXT_ADD, focus: false });
      }
    };
    for (let _p = 0; _p < Math.max(0, 1 + (st.extraPre || 0) - (st.restPre || 0)); _p++) {
      const _en = enAt("pre", _p, st.energy.pre);
      if (joined.pre && onduty && _en >= v.ENERGY_MIN) {
        preProduce(_p, _en);
        if (rng() < rollProb("pre")) preProduce(_p, _en);   // 论文 extra_roll
      }
    }

    /* ---- 数据工程师（W2 入职）：text +0.3 / 语料 8 条×品质 ----
       单次产出抽成闭包（2026-09-13 补）：论文 extra_roll 对**数据岗也生效** ——
       原来这一支内联在循环里，只有 pre / post 能「再产一次」⇒ 4008（scope:"data"）白配。
       ⚠️ 本编制序号必须**传参**（dataTraitLvs[i] 与循环下标对齐）——闭包里引用循环内的 i 会取到最后一轮。 */
    const dataProduce = (dataIdx, en) => {
      /* V1.5 论文（LoRA）：数据工程师语料产量 ×倍率（配置可改，玩法配置 → 论文研究） */
      const dataSpeed = v.PAPER_DATA_SPEED_MUL != null ? v.PAPER_DATA_SPEED_MUL : 1.10;
      const k = eff(en) * otMul * qm * productionMulAt("data", dataIdx)
        * (st.paper.done && st.paper.kind === "data_speed" ? dataSpeed : 1.0);
      /* DOC「数据词条 → 语料品质」：品质概率按本编制 **各自 data 词条等级** 查表
         （dataTraitLvs[i] 由 game_core.teamDataTraitLevels 提供，下标与循环对齐）。
         无表/无等级 → 回落基础 QUALITY_PROB。 */
      const lv = Array.isArray(st.dataTraitLvs) ? (st.dataTraitLvs[dataIdx] || 1) : 1;
      const probTbl = (Array.isArray(v.QUALITY_PROB_BY_DATA_LV) && v.QUALITY_PROB_BY_DATA_LV[lv - 1])
        ? v.QUALITY_PROB_BY_DATA_LV[lv - 1] : v.QUALITY_PROB;
      const P0 = probTbl[0] || 0, P1 = probTbl[1] || 0;
      const r = rng();
      const qi = r < P0 ? 0 : (r < P0 + P1 ? 1 : 2);
      const n = v.DATA_ITEMS * k;
      st.corpus.token += n * v.QUALITY_MULT[qi];
      st.corpus.items += n;
      st.corpus.q[qi] += n;                // 分品质库存（背包展示）
      const dt = roundI(rng, v.DATA_TEXT * k) + (fxBonus.text || 0);   // 论文 dim_bonus
      st.stats.text += dt;
      floats.push({ who: "data", slot: dataIdx, dim: "text", amount: dt, focus: false });
      if (st.paper.done && st.paper.kind === "text_prob" && rng() < v.PAPER_TEXT_PROB) {
        st.stats.text += v.PAPER_TEXT_ADD;             // 论文永续
        floats.push({ who: "paper", dim: "text", amount: v.PAPER_TEXT_ADD, focus: false });
      }
    };
    for (let i = 0; i < Math.max(0, 1 + st.extraData - (st.restData || 0)); i++) {
      const _en = enAt("data", i, st.energy.data);
      if (joined.data && onduty && _en >= v.ENERGY_MIN) {
        dataProduce(i, _en);
        if (rng() < rollProb("data")) dataProduce(i, _en);   // 论文 extra_roll（数据岗）
      }
    }

    /* ---- 后训练工程师（W4 入职）：safety / stability（extraPost = 扩招编制数）---- */
    /* 单次后训练产出（闭包）—— 2026-09-13 补：后训练也能吃攻关（原来只有 pre 能） */
    const postProduce = (postIdx, en) => {
      if (!st.quota.post.length) st.quota.post = shuffled(rng, v.POST_QUOTA);
      const dim = st.quota.post.pop();
  /* [feature:multi-trait-dev-v35-005] */
      /* 词条等级 → 产出档位（DOC「词条等级接入产出」）：按本人 post 生产词条等级查表。 */
  /* [/feature:multi-trait-dev-v35-005] */
      const postTiers = rows(v.POST_TRAIT_TIERS || v.TIER_RANGES, [[1, 2]]);
      const postLv = Math.max(1, Math.min(5, traitLvAt("post", postIdx, st.postTraitLv || 1)));
      const tierIdx = Math.min(postLv - 1, postTiers.length - 1);
      const [lo, hi] = postTiers[tierIdx] || [1, 2];
      let g = randInt(rng, lo, hi) * eff(en) * otMul * qm * productionMulAt("post", postIdx);
      const hitFocus = st.focus.left > 0 && focusMatches(st.focus.dim, dim);   // 后训练也能攻关
      if (hitFocus) g *= (v.FOCUS_MUL + fxFocusAdd);
      g += (fxBonus[dim] || 0);                                     // 论文 dim_bonus
      g = roundI(rng, g);
      st.stats[dim] += g;
      floats.push({ who: "post", slot: postIdx, dim, amount: g, focus: hitFocus });
    };
    for (let _q = 0; _q < Math.max(0, 1 + (st.extraPost || 0) - (st.restPost || 0)); _q++) {
      const _en = enAt("post", _q, st.energy.post);
      if (joined.post && onduty && _en >= v.ENERGY_MIN) {
        postProduce(_q, _en);
        if (rng() < rollProb("post")) postProduce(_q, _en);   // 论文 extra_roll
      }
    }

    /* ---- 追加能力轴（doc/27 §4.2 渠道①：岗位「顺带」产出）----
       轴没有独立岗位：由 AXES.DEF[*].drivers 指定的岗位在**原有循环之外**再多 roll 一次
       （记忆←数据 / 推理←后训练 / 工具←后训练+数据，两路相加）。
       ⚠️ 条件项（语料品质 / 算力 / 体力 / 下班 / 攻关）只调**系数**，本身不产生数值。 */
    if (onduty) {
      const axIds = activeAxes(st);
      if (axIds.length) {
        /* ⚠️ CORPUS_QUALITY / AXIS_TRAIT_TIERS 都是**顶层**配置键（不在 V35 里）——
           立项时 game_core 用同一个 STEP 算 shareGP，两处必须同源。 */
        const CQ = (window.GameCfg || {}).CORPUS_QUALITY || {};
        const shareGP = st.qualityMix
          ? ((st.qualityMix.g || 0) + (st.qualityMix.p || 0)) * (CQ.STEP != null ? CQ.STEP : 0.2)
          : 0;
        const haveOf = (role) => {
          const K = {data:"Data",post:"Post",pre:"Pre",embodied:"Embodied"}[role];
          return Math.max(0, 1 + (st["extra" + K] || 0) - (st["rest" + K] || 0));
        };
        for (const id of axIds) {
          const def = ((v.AXES || {}).DEF || {})[id];
          if (!def) continue;
          const cr = def.corpusReq || {};
          const reqGood = cr.good || 0;
          const corpusMul = (reqGood > 0 && shareGP < reqGood - 1e-9)
            ? (cr.missMul != null ? cr.missMul : 0.7) : 1;
          const am = (def.archMul || {})[st.arch || "dense"];
          const aMul = am != null ? am : 1;
          const tiers = rows((((window.GameCfg || {}).AXIS_TRAIT_TIERS) || {})[id], [[1, 2]]);
          const prob = Math.min(1, (def.tickProb != null ? def.tickProb : 0.3) + (fxRate[id] || 0));   // + 论文 axis_rate
          let gain = 0;
  /* [feature:multi-trait-dev-v35-006] */
          const contributions = [];
  /* [/feature:multi-trait-dev-v35-006] */
          for (const dr of (def.drivers || [])) {
            const role = dr.role;
            if (role === "embodied" && def.alternateIndex != null && t % 2 !== def.alternateIndex) continue;
            if (!joined[role]) continue;                    // 该岗位还没到岗
            const n = haveOf(role);                          // 在岗编制数（已扣本周休息）
            for (let i = 0; i < n; i++) {
              const _en = enAt(role, i, st.energy[role] || 0);
              if (_en < v.ENERGY_MIN) continue;                // 体力门槛逐人判定（不再整岗位一刀切）
              if (rng() >= prob) continue;
              let lv = 1;
              if (role === "data") lv = (Array.isArray(st.dataTraitLvs) ? st.dataTraitLvs[i] : 1) || 1;
              else if (role === "post") lv = traitLvAt(role, i, st.postTraitLv || 1);
              else lv = traitLvAt(role, i, role === "embodied" ? 1 : (st.preTraitLv || 1));
              const ti = Math.min(Math.max(1, lv) - 1, tiers.length - 1);
              const [lo, hi] = tiers[ti] || [1, 2];
              const personalGain = randInt(rng, lo, hi) * eff(_en) * otMul * qm * aMul * corpusMul
                    * (fxAmp[id] != null ? fxAmp[id] : 1) * productionMulAt(role, i);   // 论文 axis_amp
              gain += personalGain;
  /* [feature:multi-trait-dev-v35-007] */
              contributions.push({ who: role, slot: i, raw: personalGain });
  /* [/feature:multi-trait-dev-v35-007] */
            }
          }
          const hitFocus = st.focus.left > 0 && st.focus.dim === id;
          if (gain > 0) {
            if (hitFocus) gain *= (v.FOCUS_MUL + fxFocusAdd);   // 论文 focus_mul
            gain += (fxBonus[id] || 0);                          // 论文 dim_bonus（轴也吃）
            const gi = roundI(rng, gain);
            if (gi > 0) {
              st.stats[id] += gi;
  /* [feature:multi-trait-dev-v35-008] */
              if (contributions.length) {
  /* [/feature:multi-trait-dev-v35-008] */
                // Keep the aggregate roll unchanged, then attribute the exact integer total to each actual worker.
  /* [feature:multi-trait-dev-v35-009] */
                const totalRaw = contributions.reduce((n, x) => n + x.raw, 0);
  /* [/feature:multi-trait-dev-v35-009] */
                let remaining = gi;
  /* [feature:multi-trait-dev-v35-010] */
                contributions.forEach((x, i) => {
                  const amount = i === contributions.length - 1 ? remaining : Math.floor(gi * x.raw / totalRaw);
  /* [/feature:multi-trait-dev-v35-010] */
                  remaining -= amount;
  /* [feature:multi-trait-dev-v35-011] */
                  if (amount > 0) floats.push({ who: x.who, slot: x.slot, dim: id, amount, focus: hitFocus });
  /* [/feature:multi-trait-dev-v35-011] */
                });
              } else floats.push({ who: ((def.drivers || [])[0] || {}).role || "axis", dim: id, amount: gi, focus: hitFocus });
            }
          }
        }
        /* ---- 论文永续（轴）：doc/27 P5 ----
           已掌握一篇带 axis 效果的论文后，每 tick 有 axisProb 概率给那根轴 +axisAdd。
           只在该轴**本阶段激活**时才可能命中（未激活的模型零痕迹）。 */
        if (st.paper.done && st.paper.axis && axIds.indexOf(st.paper.axis) >= 0
            && (st.paper.axisProb || 0) > 0 && rng() < st.paper.axisProb) {
          const ad = st.paper.axisAdd != null ? st.paper.axisAdd : 1;
          st.stats[st.paper.axis] += ad;
          floats.push({ who: "paper", dim: st.paper.axis, amount: ad, focus: false });
        }
      }
    }

    if (onduty) {
      if (st.focus.left > 0) st.focus.left--;
      if (st.paper.left > 0 && --st.paper.left === 0) st.paper.done = true;
    }

    /* 周末结算：语料需求曲线 */
    if ((t + 1) % v.TICKS_PER_WEEK === 0) {
      const wk = (t + 1) / v.TICKS_PER_WEEK;
      const need = needAt(st, wk);   // GATE +（基准 × 架构系数 × 参数系数）×（wk-1）
      const gap = need > 0 ? Math.max(0, (need - st.corpus.token) / need) : 0;
      let mul = 1, tag = "ok";
      const tiers = gapTiers;
      for (const [hi2, m] of tiers) {
        if (gap <= hi2) { mul = m; break; }
      }
      if (st.weekMulOverride) { mul *= st.weekMulOverride; st.weekMulOverride = null; }   // 事件：下周产出系数
      if (gap <= tiers[0][0]) { mul = tiers[0][1]; }
      else if (gap <= tiers[1][0]) { mul = tiers[1][1]; }
      else if (gap <= tiers[2][0]) { mul = tiers[2][1]; }
      else { mul = tiers[3][1]; }
      st.preMul = mul;
      /* tag 只进 weekly 日志；展示档位 st.gapState 统一由下方流量口径负责（不再在此覆写，
         否则周末水位跳升会把看板档位打回去——「一会儿充足一会儿吃紧」的锯齿根因） */
      st.weekly.push({ week: wk, need, have: st.corpus.token, gap, mul, tag });
    }

    /* gapState 每 tick 重算 —— **与语料仓库进度条刻度严格同口径**（2026-09-05 用户拍板：
       「当前状态一定要跟进度条上的刻度标识吻合」；2026-09-06 刻度与 GAP_SLOW 减速机制
       同步：充裕线 = 满足率 FREE_ABOVE（默认 90）——90~100 已无减速惩罚，展示「充裕」；
       60~90 吃紧 / <60 不足）。刻度 = 持有 token 占本周需求水位（GATE + 累计增量，
       即 corpusDemand 同构）的百分比。买语料 / 产出入账后下一次 tick 立即生效；
       【滞回】降档带 8% 缓冲带（ok 需 <FREE_ABOVE-8 才降 / tight 需 <52 才降），
       彻底消除阈值附近的反复横跳。 */
    {
      const wkNow = Math.ceil((t + 1) / v.TICKS_PER_WEEK);
      const needNow = needAt(st, wkNow);
      const pctNow = needNow > 0 ? (st.corpus.token / needNow) * 100 : 100;
      const free = (v.GAP_SLOW && v.GAP_SLOW.FREE_ABOVE != null) ? v.GAP_SLOW.FREE_ABOVE : 90;
      const prev = st.gapState;
      let tag = pctNow >= free ? "ok" : pctNow >= 60 ? "tight" : "warn";
      if (prev === "ok" && tag === "tight" && pctNow >= free - 8) tag = "ok";
      else if (prev === "tight" && tag === "warn" && pctNow >= 52) tag = "tight";
      st.gapState = tag;
    }

    st.tick = t + 1;
    st.prodLog = floats;
    return floats;
  }

  /* ---------- 语料需求 ---------- */
  /* 「架构 × 参数」组合要求覆盖表（2026-09-12 开放配置）：
     GameCfg.ARCH_PARAM_REQ = { "架构id@参数B": { gate, weekAdd, quality } }，
     三项都可省略 —— 省略项回落旧链路（架构 gate / 基准×架构×参数 / ARCH_QUALITY_REQ）。
     表挂在**顶层** GameCfg 上（与 ARCH_QUALITY_REQ 同级，同页可改）。 */
  function comboReq(arch, param) {
    const T = ((typeof window !== "undefined" && window.GameCfg) || {}).ARCH_PARAM_REQ || {};
    return T[(arch || "dense") + "@" + (Number(param) || 0)] || null;
  }
  /* 每周新增需求 = 基准 × 架构系数 × 参数系数（2026-09-02 改版）；
     2026-09-12：ARCH_PARAM_REQ["架构@参数"].weekAdd 可整值覆盖（V1.5 语料要求过高 →
     用户直接按组合配置，不用再间接乘系数）。
     立项时由游戏侧把 arch / paramTarget 写进 st；缺省按最低档 dense+7B，保证旧档不炸。
     必须与游戏侧 GameCore.corpusWeekAdd() 完全同构 —— 两边算出的 need 不一致会导致
     UI 显示「产量充足」而引擎按缺口扣产出。 */
  function weekAdd(st) {
    const cc = C().CORPUS_CURVE || {};
    const arch = st.arch || "dense";
    const param = st.paramTarget || 7;
    const combo = comboReq(arch, param);
    if (combo && combo.weekAdd != null) return Math.max(0, Math.round(combo.weekAdd));
    const base = cc.WEEK_ADD_BASE != null ? cc.WEEK_ADD_BASE : 30;
    const am = (cc.WEEK_ADD_BY_ARCH || {})[arch];
    const pm = (cc.WEEK_ADD_BY_PARAM || {})[String(param)];
    return Math.round(base * (am != null ? am : 1) * (pm != null ? pm : 1));
  }
  /* 第 wk 周的累计需求（need）；GATE 启动门槛按阶段走 STAGES */
  function needAt(st, wk) {
    const v = C();
    const stageCurve = (v.STAGES || {})[st.ver] || { GATE: v.CORPUS_CURVE.GATE, WEEK_ADD: v.CORPUS_CURVE.WEEK_ADD };
    return stageCurve.GATE + weekAdd(st) * (wk - 1);
  }
  /* 满体力周产量（对外：UI 供需看板用；内部与 GameCore.corpusProduction 同口径） */
  function weeklyProductionFull(st) {
    return weeklyProductionEstimate(st) * C().TICKS_PER_WEEK;
  }

  /* ---------- 语料 ---------- */
  function qbar(st) {
    return st.corpus.items > 0 ? st.corpus.token / st.corpus.items : C().QUALITY_MULT[0];
  }
  /* 品质分档加成（先落档再取值）
     每行 = [q̄ 上限, V1, V1.5, V2, V2.5+]；2026-09-04 加两道兜底：
     ① 配置只填了 V1 一列时，取列越界会拿到 undefined → 评审总分变 NaN。
        这里回落到该行最后一列（= 当前实际生效的 V1 值，线上行为完全不变）；
     ② 配置被污染（行退化成对象/undefined）时兜底 0，绝不让 NaN 流进总分。
     若日后按 doc/14 §1.4 补齐四列，这里自动按阶段取值，无需再改。 */
  function qualityBonus(st) {
    const q = qbar(st);
    const order = window.GameCfg.VER_ORDER || ["V1"];
    const col = Math.min((order.indexOf(st.ver || "V1") + 1), 4);   // V1→列1, V1.5→列2 …
    const qt = rows(C().Q_TIERS,
      [[0.55, 0, -2, -4, -6], [0.75, 2, 0, -2, -4], [0.95, 4, 3, 2, 0], [9.99, 6, 5, 4, 2]]);
    const pick = (row) => {
      const v = row ? row[Math.min(col, row.length - 1)] : undefined;
      return Number.isFinite(v) ? v : 0;
    };
    for (const row of qt) if (q < row[0]) return pick(row);
    return pick(qt[qt.length - 1]);
  }
  /* 采购：外包语料品质随机——每条约 80% 普通 / 20% 良好（买 10 份约 2 份良好）。
     返回 { good, costWan }；调用方按单价×条数扣经费 */
  function buyCorpus(st, items, rng) {
    rng = rng || Math.random;
    const buy = C().CORPUS_CURVE.BUY;
    let good = 0;
    for (let i = 0; i < items; i++) if (rng() < (buy.goodProb != null ? buy.goodProb : 0.2)) good++;
    const token = (items - good) * C().QUALITY_MULT[0] + good * C().QUALITY_MULT[1];
    st.corpus.token += token;
    st.corpus.items += items;
    st.corpus.q[0] += items - good;         // 分品质库存（背包展示）
    st.corpus.q[1] += good;
    return { good, token, costWan: items * (buy.price != null ? buy.price : 0.3) };
  }
  /* 每 tick 期望产量（满体力口径，与体力无关）。
     ⚠️ 以前这里算了 k=eff(体力) 却没用上，调用方（corpusProduction）又乘了一个线性的
     体力/100 —— 两头都不对，导致周产量被系统性低估，看板永远红字「产量吃紧」。
     现在的口径：周产量 = 本函数 × TICKS_PER_WEEK × eff(当前体力)，eff 与产出演算同款。 */
  function weeklyProductionEstimate(st) {
    const qm = st && st.qualityMul != null ? st.qualityMul : 1;
    /* ⚠️ 2026-09-16 修 BUG：**必须乘数据岗产出编制数** —— 引擎每 tick 的 data 产出是
       `for (i < 1 + extraData - restData)` 循环（见本文件 tick 的 dataProduce），
       5 个数据工程师就产 5 份；这里以前只按「1 份」算 ⇒ 无论招多少数据工程师，
       看板「每周产量（理论）」都纹丝不动（玩家报的「已经 5 个数据工程师了，
       还是显示这么多产量」）。
       编制口径与引擎逐字对齐：Math.max(0, 1 + extraData - restData)。
       （extraData 由 game_core 维护 = 在岗已到岗人数 - 1，录用时即时 +1、每 tick 校准。） */
    const crew = st ? Math.max(0, 1 + (st.extraData || 0) - (st.restData || 0)) : 1;
    const muls = st && st.productionMulList && st.productionMulList.data;
  /* [feature:multi-trait-dev-v35-012] */
    let estimate = 0;
  /* [/feature:multi-trait-dev-v35-012] */
    for (let i = 0; i < crew; i++) {
      const m = Array.isArray(muls) ? muls[i] : 1;
  /* [feature:multi-trait-dev-v35-013] */
      const personalMul = typeof m === "number" && Number.isFinite(m) && m >= 0 ? m : 1;
      const level = Array.isArray(st && st.dataTraitLvs) ? st.dataTraitLvs[i] : null;
      const probs = level != null
        ? ((C().QUALITY_PROB_BY_DATA_LV || [])[Math.max(1, level) - 1] || C().QUALITY_PROB || [0.5, 0.4, 0.1])
        : [0.5, 0.4, 0.1]; // 未注入真人词条的旧无头模拟保持原期望
      const expectedQuality = probs.reduce((n, p, q) => n + p * (C().QUALITY_MULT[q] || 0), 0);
      estimate += C().DATA_ITEMS * expectedQuality * personalMul;
  /* [/feature:multi-trait-dev-v35-013] */
    }
  /* [feature:multi-trait-dev-v35-014] */
    return estimate * qm;
  /* [/feature:multi-trait-dev-v35-014] */
  }

  /* ---------- 测试演出 ---------- */
  /* 两档制（2026-09-14 用户拍板砍掉「半吊子」档）：<TEST.DUMB 未开智 / ≥TEST.DUMB 开智 */
  function testTier(st) {
    const v = C();
    const language = mergedGroups(st).length ? (Number(st.stats.code) || 0) + (Number(st.stats.text) || 0) : st.stats.text;
    const ratio = language / v.TEST.TARGET;
    return { ratio, tier: ratio < v.TEST.DUMB ? "dumb" : "full" };
  }

  /* ---------- 评审 ---------- */
  /* 评审（支持阶段增量口径）：baseline=阶段起点快照；V1 快照为 0，增量=全量，完全向后兼容 */
  function review(st, baseline) {
    const b = baseline || dimObj(0);
    const d = (k) => Math.max(0, (st.stats[k] || 0) - (b[k] || 0));

    const v = C();
    const R = v.REVIEW || {};
    const ver = st.ver || "V1";
    const per = (R.BY_VER || {})[ver] || {};
    /* ---- 逐阶段权重（doc/27 §7.1 · P2）----
       V1 / V1.5 的 WEIGHTS_BY_VER 与旧 WEIGHTS 逐位一致 → 老阶段 raw 完全不变；
       有轴阶段把 text 匀一部分给轴（轴占 15%~36%）。 */
    const w = (R.WEIGHTS_BY_VER || {})[ver] || R.WEIGHTS || {};
    const dims = dimsOf(st);
    /* ---- 2026-09-30 修「砍轴刷分」（用户拍板方案 1）----
       分母改用**本阶段权重表全量**（Σ 本表所有键），而不再用「模型实际存在维度」的权重和。
       旧口径：少激活轴的模型 wsum 更小 ⇒ 四维上限被等比放大，玩家「砍掉轴」反而刷分。
       实测（V4.5 四维全顶格）：csa 全轴 915 < mla 单轴 1055 < dense 无轴 1088，
       而榜首按钉死组合（917）标定 ⇒ 少轴模型轻松登顶（排行榜刷到 1057 即此）。
       新口径：缺失维度实打实丢那部分权重（= 直接 Σ(w×值)）；钉死组合轴全激活、
       wsum = 1.00 ⇒ 满分 / 评审线（GREAT_SCORE 等）逐位不变。 */
    const wsum = Object.keys(w).reduce((a, k) => a + (w[k] || 0), 0);
    const normal = (v.AXES || {}).NORMALIZE !== false;
    const denom = normal ? (wsum > 0 ? wsum : 1) : 1;
    /* ---- 2026-10-01 记忆分数加成 scoreMul（用户拍板）----
       背景：记忆 cap 下调后新满分 ~879 < 旧配置云榜成绩 917 ⇒ 云端登顶数学上不可能。
       方案：给轴的**分数贡献**挂 scoreMul（乘在分子、**不进分母 Σw**）——
       记忆占比上升、新满分回到 ~922 略高于旧 917，云榜老成绩被慢慢替换（不换榜、榜单连续）。
       ⚠️ 归一化口径下单纯调大 w.memory 会**降**总分（记忆 cap 660 < 四维 1088），
       必须走乘法且不进分母。⚠️ 改 scoreMul ⇒ 满分变化 ⇒ GREAT_SCORE/RANK_BOARD 必须重标
       （tools/measure_review_lines.js 唯一入口）。防刷分实测（k=1.5, V4.5）：
       csa 922 > dsa 900 > mla 825，钉死组合仍最高，砍轴刷分不复活。 */
    const _axDef = (v.AXES || {}).DEF || {};
    const _mul = (k) => (_axDef[k] && _axDef[k].scoreMul) || 1;
    const groups = mergedGroups(st), paired = new Set(groups.flatMap(g => g.sources));
    const original = dims.filter(k => !paired.has(k)).reduce((a, k) => a + (w[k] || 0) * _mul(k) * d(k), 0);
    const merged = groups.reduce((a, g) => a + g.sources.reduce((n, k) => n + d(k), 0)
      * 0.5 * g.sources.reduce((n, k) => n + (w[k] || 0), 0), 0);
    const raw = (original + merged) / denom;
    const bonus = qualityBonus(st);
    const total = raw + bonus;
    /* ---- 逐阶段评审标准（2026-09-08）：新立项四维从 0 起，标准必须随阶段抬升。
       取 V35.REVIEW.BY_VER[当前阶段]，缺阶段回落到全局 MIN_DIM / GREAT_SCORE。
       2026-09-24：再乘 lineScale（参数档偏离钉死组合时线随之缩放，见 lineScale 注释）——
       返回值里的 minDim / axMin / greatScore 也是**缩放后**的，UI 显示与判定必须同一把尺子。 */
    const _sc = lineScale(ver, st.paramTarget != null ? st.paramTarget : (st.v35 && st.v35.paramTarget));
    const _scN = (x) => Math.round(x * _sc);
    const _mdRaw = per.MIN_DIM || R.MIN_DIM || { code: 18, text: 22, safety: 7, stability: 7 };
    const minDim = {};
    Object.keys(_mdRaw).forEach((k) => { minDim[k] = _scN(_mdRaw[k]); });
    const great = _scN(per.GREAT_SCORE != null ? per.GREAT_SCORE
      : (R.GREAT_SCORE != null ? R.GREAT_SCORE : 29));
    /* 四维防偏科（MIN_DIM）与轴防偏科（AXIS_MIN，doc/27 §7.4）都**只卡优秀 / 顶尖档**。
       AXIS_MIN 里没有的维度（含未激活的轴）自动忽略。 */
    const axMin = {};
    Object.keys(per.AXIS_MIN || {}).forEach((k) => { axMin[k] = _scN(per.AXIS_MIN[k]); });
    const balanced = dims.filter(k => !paired.has(k)).every((k) => st.stats[k] >= (minDim[k] != null ? minDim[k] : 0))
      && groups.every(g => g.sources.reduce((n, k) => n + (st.stats[k] || 0), 0)
        >= g.sources.reduce((n, k) => n + (minDim[k] || 0), 0));
    const axisOk = dims.every((k) => axMin[k] == null || (st.stats[k] || 0) >= axMin[k]);
    const excellent = total >= great && balanced && axisOk;
    return {
      raw, bonus, total, balanced, axisOk, excellent, greatScore: great, minDim, axMin,
      axes: activeAxes(st), wsum: denom,
      result: excellent ? "excellent" : "pass",       // V1 无失败档
      qbar: qbar(st),
    };
  }

  /* ---------- 便捷：跑满 N tick（无头验证/挂机结算用） ---------- */
  function simulate(st, ticks, rng) {
    for (let i = 0; i < ticks; i++) tick(st, rng);
    return st;
  }

  /* 语料满足率（%）：持有 token 占本周需求水位 —— 与 gapState/进度条同口径。
     语料不足阶梯惩罚（2026-09-05 用户拍板）用它当标尺：≥90 产出正常，
     90 以下每低 10%，产出周期 +1 秒（见 game_core.officeTick）。 */
  function gapPct(st) {
    const wk = Math.ceil((((st.tick || 0)) + 1) / C().TICKS_PER_WEEK) || 1;
    const need = needAt(st, wk);
    return need > 0 ? (st.corpus.token / need) * 100 : 100;
  }

  return { createState, tick, simulate, qbar, qualityBonus, buyCorpus,
           weeklyProductionEstimate, weeklyProductionFull, weekAdd, needAt, gapPct,
           testTier, review, mulberry32, comboReq, lineScale,
           /* 能力维度真源（doc/27）：全项目唯一允许出现四维字面量的地方。
              DIM_ORDER = 基础四维 / allDims = 容器形状（4+3）/ dimsOf = 本模型口径 / activeAxes = 激活判定 */
           DIM_ORDER, allDims, activeAxes, dimsOf, dimObj, mergedGroups, statLimit, clampStats,
           /* 轴的逐阶段上限 / 达标线（UI 与 game_core 封顶共用同一真源） */
           axisCap, axisPass };
})();
