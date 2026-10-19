/* ==========================================================================
   v35_hire.js —— 扩编招聘（游戏发展国模式）
   --------------------------------------------------------------------------
   流程：① 玩家在「扩编」面板选岗位提需求
        ② 进入寻访：等待 1~5 分钟（动态波动；稀有岗位等待更久）
        ③ 到点判定：稀有岗位找到概率更低；未找到自动再排一轮（最多 3 轮，第 3 轮必成）
        ④ 找到 → 面板出现候选人卡片 → 玩家点「录用」→ 进入编制
             · 引擎编制 +1（extraPre / extraData / extraPost，产出按人数叠加）
             · 工程师入队（显示用）+ 月薪支出增加
   配置：GameCfg.V35.HIRE_ROLES = { pretrain|data|post: { waitMin:[a,b], findProb, salary, label } }
   用法：V35Hire.request(core, role) / V35Hire.tick(core) / V35Hire.hire(core)
   ========================================================================== */
"use strict";
window.V35Hire = {
  roles: function (core) {
    var roles = Object.assign({}, (core.cfg.V35 && core.cfg.V35.HIRE_ROLES) || {});
    if (!core.embodiedAvailable || !core.embodiedAvailable()) delete roles.embodied;
    return roles;
  },

  /* 从共享池里抽一个**真实工程师**（doc/22 v1.2，2026-09-06；2026-09-12 改口径）
     ⚠️ 旧实现是 `for(i) if (pool[i].type === role) break` —— 永远取该岗位的第一个人，
        等于 46 人的池子只有 3 个人会被用到，天赋/等级/薪资全是写死的那一份。
     现在：先按本阶段等级上限收窄池子（下限恒 Lv1），再按「池子分布 × 等级权重」加权抽。
     2026-09-07：排除已在候选列表 / 已在职的人 —— 同一个人不能同时出现在两处，
     更不能招进来一个 id 重复的幽灵（assignSeat / 团队查找都按 id 定位）。 */
  pickFromPool: function (core, role) {
    if (role === "embodied" && (!core.embodiedAvailable || !core.embodiedAvailable())) return null;
    var s = core.state;
    var ver = s.ver || "V1";
/* [feature:hire-directed-cooldown-recovery] */
    var roleMatches = function (e) { return e.type === role; };
    // 先恢复本岗位正权重人选，不能被尚未冷却的零权重人选挡住恢复。
    var byRole = core.hireDrawPool(ver, {filter: function (e) {
      return roleMatches(e) && core.hireWeightOf(e, ver) > 0;
    }});
    // 保留原有全零权重保底；忙碌身份、阶段上限和禁入池条件仍由共享入口检查。
    if (!byRole.length) byRole = core.hireDrawPool(ver, {filter: roleMatches});
/* [/feature:hire-directed-cooldown-recovery] */
    if (!byRole.length) return null;
    /* 2026-09-12（用户拍板「招聘就是从圈定的池子里随便捞一个」）：
       权重口径与 core.genCandidates **完全统一** —— 池子分布说话 + 本阶段的等级权重，
       稀有度权重（HIRE_WEIGHTS / HIRE_STAGE_COEF）与口碑系数已退役，不再参与。
       该等级权重为 0 = 本阶段不出现；全体为 0（配置把可刷等级全锁死）时退回不加权，避免寻访卡死。 */
    var weighted = [];
    var totalW = 0;
    for (var i = 0; i < byRole.length; i++) {
      var e = byRole[i];
      var w = core.hireWeightOf ? core.hireWeightOf(e, ver) : 1;
      totalW += w;
      if (w <= 0) continue;
      var n = Math.max(1, Math.round(w * 10));
      for (var k = 0; k < n; k++) weighted.push(e);
    }
    /* 配置把可刷等级全锁死 → 退回不加权（保底，别让寻访永远空手） */
    if (totalW <= 0) {
      weighted = [];
      for (var i2 = 0; i2 < byRole.length; i2++) {
        for (var k2 = 0; k2 < 5; k2++) weighted.push(byRole[i2]);
      }
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  },

  /* ① 提需求（选岗位）—— 反抽卡：发布需求要花 RECRUIT_COST（doc/22 §7）
     2026-09-07（用户拍板）：一次需求可以**同时要多个岗位**（传数组，或单个 key）。
     等待周数取所选岗位里最慢的那一档；找到的人按勾选岗位轮流分配（见 tick）。 */
  request: function (core, role) {
    var s = core.state;
    var R = this.roles(core);
    var want = Array.isArray(role) ? role.slice() : (role ? [role] : []);
    if (!want.length) return { ok: false, tip: "先选一个岗位" };
    for (var i = 0; i < want.length; i++) {
      if (!R[want[i]]) return { ok: false, tip: "没有这个岗位：" + want[i] };
    }
    if (s.hireOrder) return { ok: false, tip: "已经有人在帮你筛选简历了，先等这一轮结果" };
/* [feature:recruit-seat-full-guard-20261016] */
    /* 2026-10-16（玩家反馈「满员时发布需求已置灰，但点击仍能招到人」）：把满员拦截
       从「只在面板置灰」升级为**真实闸门** —— 与 core.hire 用同一把尺子（seatCap）。
       面板来不及重绘、或其它入口直接调用 requestHire 时，满员一律不得再发布需求，避免白花发布费。 */
    var capN = core.seatCap ? core.seatCap() : 4;
    var aliveN = (s.engineers || []).filter(function (e) { return !e.resigned; }).length;
    if (aliveN >= capN) return { ok: false, seatFull: true, tip: "🚪 座位已满（" + aliveN + "/" + capN + "）：先辞退一人，再发布需求" };
/* [/feature:recruit-seat-full-guard-20261016] */
    /* 2026-09-12（用户实测「招聘可超出配置的人数上限」）：**硬闸门放在 core.hire**（录用那一刻，
       与地图「容量」同一把尺子），这里**不拦发布** —— 辞退即腾座位，玩家可能想先备好下一位人选。
       面板侧（v35_hire_ui.js）在满员时会把「发布需求」置灰并给出提示，避免白花发布费。 */
    /* 多选消耗叠加（2026-09-08 用户拍板）：勾 N 个岗位 = 付 N 次发布费 */
    var payCost = 0;
    if (core.payRecruitCost) {
      var pay = core.payRecruitCost(want.length);
      if (!pay.ok) return { ok: false, tip: pay.tip };
      payCost = pay.cost || 0;
    }
    /* 多岗位一起找 → 等待取最慢的那一档（min 取最大、max 取最大） */
    var lo = 1, hi = 3;
    for (var j = 0; j < want.length; j++) {
      var w = R[want[j]].waitMin || [1, 3];
      lo = Math.max(lo, w[0]); hi = Math.max(hi, w[1]);
    }
    if (hi < lo) hi = lo;
    var mins = Math.round(lo + Math.random() * (hi - lo));   // 等待周数为整数（1 分钟 = 1 周 = 6 tick）
    s.hireOrder = { roles: want, role: want[0], left: mins * 6, total: mins * 6, attempt: 1 };
    var label = want.map(function (r) { return (R[r] || {}).label || r; }).join("、");
    return { ok: true, mins: mins, role: want[0], roles: want, label: label, cost: payCost };
  },

  /* 一次寻访找到几个人：HIRE_FIND_N 依次是 1 / 2 / 3 人的概率（默认 70% / 20% / 10%） */
  rollFindN: function (core) {
    var w = (core.cfg.V35 && core.cfg.V35.HIRE_FIND_N) || [0.7, 0.2, 0.1];
    var r = Math.random(), acc = 0;
    for (var i = 0; i < w.length; i++) { acc += (w[i] || 0); if (r < acc) return i + 1; }
    return w.length;
  },

  /* 加急只减少这张招聘订单的等待，不推进办公室时钟或生产。 */
  rushOptions: function (core) {
    var v = core.cfg.V35 || {};
    var cost = v.HIRE_RUSH_COST == null ? 200000 : Number(v.HIRE_RUSH_COST);
    var weeks = v.HIRE_RUSH_WEEKS == null ? 1 : Number(v.HIRE_RUSH_WEEKS);
    var tpw = v.TICKS_PER_WEEK == null ? 6 : Number(v.TICKS_PER_WEEK);
    cost = Number.isFinite(cost) && cost >= 0 ? Math.round(cost) : 200000;
    weeks = Number.isFinite(weeks) && weeks >= 1 ? Math.floor(weeks) : 1;
    tpw = Number.isFinite(tpw) && tpw >= 1 ? Math.floor(tpw) : 6;
    return { cost: cost, weeks: weeks, ticks: weeks * tpw,
      costText: cost % 10000 === 0 ? (cost / 10000 + " 万") : (cost + " 元") };
  },

  rush: function (core) {
    var s = core.state, order = s.hireOrder;
    if (!order || !Number.isFinite(order.left) || order.left <= 0) return { ok: false, tip: "当前没有可加急的招聘需求" };
    var options = this.rushOptions(core);
    if ((s.funding || 0) < options.cost) return { ok: false, tip: "加急招聘需要 " + options.costText + "经费，账上不够了" };
    s.funding = (s.funding || 0) - options.cost;
    var before = order.left;
    order.left = Math.max(0, before - options.ticks);
    var result = order.left === 0 ? this.settle(core) : null;
    return { ok: true, cost: options.cost, weeks: options.weeks, ticksReduced: Math.min(before, options.ticks), result: result };
  },

  /* 按岗位造一个候选人（池子里的真人档案；池子空了才兜底造占位人） */
  buildCand: function (core, role) {
    if (role === "embodied" && (!core.embodiedAvailable || !core.embodiedAvailable())) return null;
    var cfgR = this.roles(core)[role] || {};
    var tpl = this.pickFromPool(core, role);
    if (tpl) return core.cloneEng(tpl);            // 完整档案，招聘页/团队页直接可用
    /* 池子被掏空的极端兜底：造一个占位人（字段补齐到招聘页能渲染），不至于卡死流程 */
    var names = ["林", "苏", "陈", "周", "吴", "郑"];
    var suffix = ["工", "老师", "同学", "", ""];
    var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    var traitOf = { pretrain: "pretrain", data: "data", post: "post", embodied: "embodied" }[role] || "pretrain";
    var cand = {
      id: "hire_x_" + Date.now() + "_" + Math.floor(Math.random() * 1000), type: role,
      name: pick(names) + pick(suffix),
      salary: cfgR.salary || 83333, stats: role === "embodied" ? { code: 60, algo: 60, engineering: 60 } : { code: 60, algo: 60, text: 60 },
      traits: [{ type: traitOf, level: 2 }], resume: {},
    };
    if (core.salaryOf) cand.salary = core.salaryOf(cand);
    /* 2026-10-01（玩家反馈「突然多了很多等待时间无限的周老师/同学」）：兜底占位人之前不走
       cloneEng ⇒ 没写 expireAbsWeek ⇒ candExpireAbs 返回 null ⇒ **永不过期**，在招聘列表
       里无限堆积。补上与 cloneEng 同款的失效周（只有 V1 保底 starter 允许不过期，占位人
       不是 starter）。老档里已堆积的幽灵人由 healCandExpire() 读档补票自愈。 */
    var _ttl = (core.cfg && core.cfg.CANDIDATE_TTL_WEEKS) || 0;
    if (_ttl > 0 && core.absWeek) cand.expireAbsWeek = core.absWeek() + _ttl;
    return cand;
  },

  /* ② 每 tick 推进寻访（officeAdvanceV35 末尾调用）
     2026-09-07（用户拍板）：找到的人**不再出现在扩编面板**，而是以完整档案
     （cloneEng：四维 / 词条 / 薪资 / 简历 / 头像 / 过期周）**进「招聘」页的候选人列表**，
     左侧「招聘」按钮的数字徽标自动 +1，玩家去那里像普通候选人一样录用。
     找到即清 hireOrder —— 可以马上发布下一个需求，多个人选可同时在列表里等着。 */
  tick: function (core) {
    var s = core.state;
    var o = s.hireOrder;
    if (!o) return null;
    o.left -= 1;
    if (o.left > 0) return null;
    return this.settle(core);
  },

  /* 正常等待与加急到零共用原寻访判定；失败照旧重试，第三轮必成。 */
  settle: function (core) {
    var s = core.state, o = s.hireOrder;
    if (!o || o.left > 0) return null;
    var cfgR = this.roles(core)[o.role] || {};
    var prob = cfgR.findProb != null ? cfgR.findProb : 0.8;
    if (o.attempt < 3 && Math.random() >= prob) {
      o.attempt += 1;
      o.left = Math.max(6, Math.round(o.total * 0.6));
      o.total = o.left;
      return { found: false, role: o.role, attempt: o.attempt, leftMin: (o.left / 6).toFixed(1) };
    }
    /* 找到了：**每个勾选岗位独立 roll 自己的人数**（2026-09-12 用户要求）——
       HIRE_FIND_N 是单岗位分布（70% 1 人 / 20% 2 人 / 10% 3 人），勾 N 个岗位 =
       各岗位各 roll 一次，合计 N~3N 人（勾 2 岗 = 2~6 人）。
       每找到一位就写进 s.candidates，下一位的 pickFromPool 会自动把他排除（同一个人不会重复）。 */
    var roles = (o.roles && o.roles.length) ? o.roles : [o.role];
    s.candidates = s.candidates || [];
    var found = [];
    for (var ri = 0; ri < roles.length; ri++) {
      var role = roles[ri];
      var n = this.rollFindN(core);           // 该岗位独立 roll 人数
      for (var i = 0; i < n; i++) {
        var cand = this.buildCand(core, role);
        if (!cand) continue;
        cand.fromHire = true;                 // 标记：扩编寻访找到的人（genCandidates 重刷时保留）
        if (!s.candidates.some(function (c) { return core.engUid(c) === core.engUid(cand); })) s.candidates.push(cand);
        found.push({
          name: cand.name,
          role: role,
          label: ((this.roles(core)[role] || {}).label) || role,
          tier: (core.tierLabel ? core.tierLabel(cand) : ((core.tierOf(cand) || {}).name || "一般")),
        });
      }
    }
    s.hireCandidate = null;                 // 旧字段清掉（候选人不再挂扩编面板）
    s.hireOrder = null;                     // 找到即收工，可立刻发布下一个需求
    return {
      found: true, role: roles[0], roles: roles, count: found.length, cands: found,
      label: found.map(function (f) { return f.label; }).join("、"),
    };
  },

  /* ③ 录用已移除（2026-09-07）：候选人现在进「招聘」页列表，由 core.hire(id) 统一录用。
     （旧 V35Hire.hire 只认 s.hireCandidate 单槽，还会绕过招聘页的座位/薪资展示，整套删除） */

  /* ④ 事件「慕名而来」的人选抽取（2026-09-07 P2，doc/20 v2.2 §1.6 recruit_offer spec）。
     与 pickFromPool 同款约束——本阶段等级上限、排除已在职/已在候选
     （冷却锁由 expireCandidates 的 expireWeek 链路兜住）——但**不限岗位**，并按 tier 收窄：
       tier:"high" = 最高天赋档（大牛优先，没有就往下取；同档内随机）
       tier:"mid"  = 优秀/良好档随机（两档都没有时退最高档，不至于空手）
     不突破 TALENT_LV_CAP 天花板、不突破阶段等级上限——事件不开后门。
     （2026-09-12：RARITY_TALENT_FLOOR 已随「等级档⊕天赋档」一起退役，这里不再有天赋保底。） */
  pickOfferCand: function (core, tier) {
    var s = core.state;
    var ver = s.ver || "V1";
/* [feature:hire-event-cooldown-recovery] */
    var free = core.hireDrawPool(ver);
/* [/feature:hire-event-cooldown-recovery] */
    if (!free.length) return null;
    var ORDER = ["rainbow", "orange", "pink", "blue", "gray"];
    var byKey = {};
    free.forEach(function (e) {
      var k = (core.tierOf(e) || {}).clsKey || "gray";
      (byKey[k] = byKey[k] || []).push(e);
    });
    var topArr = null;
    for (var i = 0; i < ORDER.length; i++) {
      if (byKey[ORDER[i]] && byKey[ORDER[i]].length) { topArr = byKey[ORDER[i]]; break; }
    }
    if (!topArr) return null;
    var rnd = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    if (tier === "high") return rnd(topArr);              // 最高稀有度档内随机
    /* mid：粉/蓝随机 */
    var pink = byKey.pink || [], blue = byKey.blue || [];
    if (!pink.length && !blue.length) return rnd(topArr); // 区间太窄 → 退最高档
/* [feature:hire-event-nonempty-tier] */
    if (!pink.length) return rnd(blue);
    if (!blue.length) return rnd(pink);
    return rnd(Math.random() < 0.5 ? pink : blue);
/* [/feature:hire-event-nonempty-tier] */
  },
};
