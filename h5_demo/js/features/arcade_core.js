/* 小游戏厅的核心接入：领奖记录、难度、周额度与结算全部在本模块。
   在 game_core.js 之后、rivals.js 之前加载；不加载时不改核心流程。
   配置仍由 game_cfg.js 管理，巡检小游戏 SFT/RM 仍由原引擎管理。 */
(function () {
  "use strict";
  const core = window.GameCore;
  if (!core || core.__arcadeCoreInstalled) return;
  core.__arcadeCoreInstalled = true;
  const games = owner => (((owner.cfg || {}).ARCADE || {}).GAMES || {});
  const hasKind = (owner, kind) => typeof kind === "string" && Object.prototype.hasOwnProperty.call(games(owner), kind);
  const defaults = { whack: { safety: 20, stability: 20 }, sort: { corpus_normal: 10, corpus_good: 10, corpus_best: 10 }, rice: { whale_energy: 20 } };
  const stageBudget = (unit, weeks, key) => {
    const total = unit * weeks;
    const bounded = Number.isFinite(total) ? Math.max(0, total) : 0;
    return wholeReward(bounded);
  };
  function rewardCaps(owner) {
    const configured = (((owner.cfg || {}).ARCADE || {}).REWARD_CAPS || {}), out = {};
    const value = (v, fallback) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
    for (const kind of Object.keys(defaults)) {
      out[kind] = {};
      for (const key of Object.keys(defaults[kind])) out[kind][key] = value((configured[kind] || {})[key], defaults[kind][key]);
    }
    return out;
  }
  function enabled(owner, kind) {
    const arc = (owner.cfg || {}).ARCADE || {}, row = games(owner)[kind];
    const order = (owner.cfg || {}).VER_ORDER || [], first = order.indexOf('V5');
    const stageAllowed = kind !== 'rice' || first >= 0 && order.indexOf((owner.state || {}).ver) >= first;
    return stageAllowed && arc.ENABLED !== false && hasKind(owner, kind) && kind !== "runner" && !(arc.LOCKED || {})[kind]
      && row.enabled !== false && !(window.FeatureUnlock && !window.FeatureUnlock.meets(owner, row.unlock));
  }
  // Rewards settle as whole units before quoting and budgeting. Normalize only
  // within a few floating-point units of an integer; ordinary
  // fractional rewards and historical remainders (0.6 / 0.9) still round down.
  const wholeReward = value => {
    const nearest = Math.round(value), tolerance = Number.EPSILON * Math.max(1, Math.abs(value)) * 4;
    return Math.abs(value - nearest) <= tolerance ? nearest : Math.floor(value);
  };
  const positive = value => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  };
  const configuredReward = value => positive(value);
  function capEffects(raw, caps) {
    const out = {};
    for (const key of Object.keys(caps)) {
      const configured = Math.min(caps[key], configuredReward(raw[key]));
      const value = key === 'whale_energy' ? configured : wholeReward(configured);
      if (value) out[key] = value;
    }
    return out;
  }
  Object.assign(core, {
  /* ---------------- 小游戏厅（独立于原 SFT/RM 巡检）----------------
     旧档无需升级存档版本：读写时补齐，领奖记录永远使用连续的绝对周。 */
  _arcadeState() {
    const s = this.state;
    const maximum = rewardCaps(this);
    if (!s) return { plays: {}, best: {} };
    if (!s.arcade || typeof s.arcade !== "object" || Array.isArray(s.arcade)) s.arcade = {};
    for (const k of ["plays", "best"]) {
      if (!s.arcade[k] || typeof s.arcade[k] !== "object" || Array.isArray(s.arcade[k])) s.arcade[k] = {};
    }
    for (const kind of Object.keys(games(this))) {
      if (!Array.isArray(s.arcade.plays[kind])) s.arcade.plays[kind] = [];
      if (!Number.isFinite(s.arcade.best[kind]) || s.arcade.best[kind] < 0) s.arcade.best[kind] = 0;
    }
    if (!s.arcade.stagePlays || typeof s.arcade.stagePlays !== "object" || Array.isArray(s.arcade.stagePlays)) s.arcade.stagePlays = {};
    if (!s.arcade.stageRewards || typeof s.arcade.stageRewards !== "object" || Array.isArray(s.arcade.stageRewards)) s.arcade.stageRewards = {};
    const ver = s.ver || "V1";
    if (!s.arcade.stagePlays[ver] || typeof s.arcade.stagePlays[ver] !== "object" || Array.isArray(s.arcade.stagePlays[ver])) {
      const start = Math.max(0, Number(s.weekOffset) || 0) + Math.max(0, Number(this.cfg.START_WEEK) || 0);
      s.arcade.stagePlays[ver] = Object.fromEntries(Object.keys(games(this)).map(kind => [kind, s.arcade.plays[kind].filter(week => Number.isFinite(week) && (week > start || ver === "V1" && week === start)).length]));
    }
    if (!s.arcade.stageRewards[ver] || typeof s.arcade.stageRewards[ver] !== "object" || Array.isArray(s.arcade.stageRewards[ver])) s.arcade.stageRewards[ver] = {};
    const legacy = s.arcade.rewardRevision !== 2;
    // Keep play history and records. Retired rewards must neither drain a new
    // resource pool nor reopen past reward weeks. Reserve an S-sized budget for
    // every legacy paid play, once, then only account actual new grants.
    for (const stage of new Set(Object.keys(s.arcade.stagePlays).concat(Object.keys(s.arcade.stageRewards)))) {
      const stagePlays = s.arcade.stagePlays[stage] || {};
      const ledger = s.arcade.stageRewards[stage] && typeof s.arcade.stageRewards[stage] === 'object' && !Array.isArray(s.arcade.stageRewards[stage])
        ? s.arcade.stageRewards[stage] : (s.arcade.stageRewards[stage] = {});
      for (const kind of Object.keys(maximum)) {
        const previous = ledger[kind], valid = previous && typeof previous === 'object' && !Array.isArray(previous);
        const used = Math.min(this.arcadeStageLimit(), positive(stagePlays[kind]));
        if (!legacy && valid) continue;
        if (!used && !valid) continue;
        const spent = {};
        for (const key of Object.keys(maximum[kind])) {
          const budget = stageBudget(maximum[kind][key] * this.arcadeRewardBudgetMultiplier(), this.arcadeStageLimit());
          spent[key] = Math.min(budget, Math.max(valid ? positive(previous[key]) : 0, stageBudget(maximum[kind][key], used)));
        }
        ledger[kind] = spent;
      }
    }
    s.arcade.rewardRevision = 2;
    return s.arcade;
  },
  arcadeStageLimit() {
    const n = Number(((this.cfg || {}).ARCADE || {}).STAGE_MAX_REWARD_WEEKS);
    return Math.max(0, Number.isFinite(n) ? Math.floor(n) : 0);
  },
  arcadeDifficulty() {
    const arc = (this.cfg || {}).ARCADE || {};
    const n = Number((arc.DIFFICULTY_BY_VER || {})[(this.state || {}).ver]);
    return Math.max(1, Math.min(5, Number.isFinite(n) ? Math.round(n) : 1));
  },
  arcadeRemaining(kind) {
    const arc = (this.cfg || {}).ARCADE;
    if (!this.state || !arc || !enabled(this, kind)) return 0;
    const quota = Number((arc.PLAYS_PER_WEEK || {})[kind]);
    const extra = 0;
    const limit = (Number.isFinite(quota) ? Math.max(0, Math.floor(quota)) : 0) + extra;
    const week = Math.max(0, Math.floor(Number(this.absWeek()) || 0));
    const a = this._arcadeState(), used = a.plays[kind].filter((w) => w === week).length;
    const stageUsed = Number(a.stagePlays[this.state.ver || "V1"][kind]) || 0;
    return Math.max(0, Math.min(limit - used, this.arcadeStageLimit() - stageUsed));
  },
  arcadeAvailable(kind) { return !!this.state && enabled(this, kind); },
  arcadeCanReward(kind) { return this.arcadeRemaining(kind) > 0; },
  officeArcadeStatus(kind) {
    const remaining = this.arcadeRemaining(kind);
    return { remaining, best: hasKind(this, kind) ? this._arcadeState().best[kind] || 0 : 0, practice: remaining <= 0 };
  },
  arcadeRecordBest(kind, result) {
    if (!this.state || !enabled(this, kind) || !result || result.aborted
      || (result.kind && result.kind !== kind) || !["S", "A", "B", "C"].includes(result.grade)
      || !Number.isFinite(result.score)) return false;
    const a = this._arcadeState();
    a.best[kind] = Math.max(a.best[kind], Math.floor(result.score));
    return true;
  },
  arcadeRewardGrowth() {
    return String(this.cfg.ARCADE.REWARD_GROWTH_TEXT || '').replace(/\{(easy|normal|hard)\}/g, (_,mode) => this.arcadeRewardMultiplier(mode));
  },
  arcadeRewardMultiplier(mode) {
    const value = Number(((this.cfg.ARCADE || {}).REWARD_MULT_BY_DIFFICULTY || {})[mode || 'easy']);
    return Number.isFinite(value) ? value : 1;
  },
  arcadeRewardBudgetMultiplier() {
    return Math.max(1, ...Object.values((this.cfg.ARCADE || {}).REWARD_MULT_BY_DIFFICULTY || {}).map(Number).filter(Number.isFinite));
  },
  arcadeRewardDetails(kind, grade, mode) {
    const maximum = rewardCaps(this);
    const multiplier = this.arcadeRewardMultiplier(mode), empty = { effects: {}, standardEffects: {}, multiplier, stageCapped: false, capacityCapped: false, weekCapped: false };
    if (!this.state || !enabled(this, kind) || !maximum[kind] || !['S', 'A', 'B', 'C'].includes(grade)) return empty;
    this._arcadeState();
    const raw = ((((this.cfg || {}).ARCADE || {}).REWARDS || {})[kind] || {})[grade] || {};
    const scaled = Object.fromEntries(Object.entries(raw).map(([key,value]) => [key, Number(value) * multiplier]));
    const limits = Object.fromEntries(Object.entries(maximum[kind]).map(([key,value]) => [key, value * multiplier]));
    const eff = capEffects(scaled, limits), standardEffects = Object.assign({}, eff), weekCapped = false;
    const s = this.state || {}, ver = s.ver || "V1", stage = (((s.arcade || {}).stageRewards || {})[ver] || {}), totals = stage[kind] || {};
    let stageCapped = false, capacityCapped = false, capacityUnavailable = false;
    for (const key of Object.keys(eff)) {
      const value = eff[key];
      const maximumTotal = stageBudget(maximum[kind][key] * this.arcadeRewardBudgetMultiplier(), this.arcadeStageLimit(), key);
      const previous = Math.min(maximumTotal, positive(totals[key]));
      // Do not round a fractional historical remainder up through the budget.
      let granted = Math.max(0, Math.min(value, maximumTotal - previous));
      // Fractional historical balances must not round up beyond the budget.
      if (key !== 'whale_energy') granted = wholeReward(granted);
      if (granted < value) stageCapped = true;
      if (!granted) delete eff[key];
      else eff[key] = granted;
    }
    // A fractional room left by a historical save must not turn an integer
    // capability reward into a fractional grant at the ordinary stat clamp.
    const statCaps = this.statCap();
    const rewardStats = Object.assign({}, s);
    for (const key of this.dimsOf(s)) if (eff[key]) {
      const limit = this.statLimit ? this.statLimit(key, statCaps, rewardStats) : (statCaps[key] || 0);
      const requested = eff[key];
      eff[key] = Math.min(eff[key],wholeReward(Math.max(0,limit - (Number(rewardStats[key]) || 0))));
      if (eff[key] < requested) capacityCapped = true;
      if (!eff[key]) delete eff[key];
      else rewardStats[key] = (Number(rewardStats[key]) || 0) + eff[key];
    }
    if (eff.whale_energy) {
      const care = window.WhaleCare;
      const status = ((this.cfg || {}).WHALE_CARE || {}).ENABLED !== false && care && typeof care.energyStatus === 'function' ? care.energyStatus(this) : null;
      const requested = eff.whale_energy;
      capacityUnavailable = !status || typeof care.restoreEnergy !== 'function';
      eff.whale_energy = !capacityUnavailable ? Math.min(eff.whale_energy, Math.max(0, status.max - status.value)) : 0;
      if (eff.whale_energy < requested) capacityCapped = true;
      if (!eff.whale_energy) delete eff.whale_energy;
    }
    return { effects: eff, standardEffects, multiplier, stageCapped, capacityCapped, capacityUnavailable, weekCapped };
  },
  arcadeRewardPreview(kind, grade, mode) {
    if (!hasKind(this, kind) || !["S", "A", "B", "C"].includes(grade)) return "无数值奖励";
    const quote = this.arcadeRewardDetails(kind, grade, mode), eff = quote.effects;
    const text = this.arcadeEffectsText(quote.standardEffects);
    const notices = [];
    if (quote.weekCapped && Object.keys(eff).length) notices.push("共用本周奖励额度");
    if (quote.stageCapped) notices.push(Object.keys(eff).length ? "按本阶段剩余额度发放" : "本阶段额度已用完");
    if (quote.capacityCapped) notices.push(quote.capacityUnavailable ? '小鲸鱼体力恢复暂不可用' : Object.keys(eff).length ? "受当前" + (kind === 'rice' ? '体力' : '能力') + "上限限制" : "当前" + (kind === 'rice' ? '体力' : '能力') + "已满");
    if (quote.stageCapped || quote.capacityCapped) notices.push('本次实际：' + (Object.keys(eff).length ? this.arcadeEffectsText(eff) : '+0'));
    return text + (notices.length ? "（" + notices.join("；") + "）" : "");
  },
  arcadeRewardOverview(kind, mode) {
    if (!hasKind(this, kind)) return null;
    const caps = rewardCaps(this)[kind];
    if (!caps) return null;
    const weeks = this.arcadeStageLimit(), a = this._arcadeState();
    const used = positive((a.stagePlays[(this.state || {}).ver || 'V1'] || {})[kind]);
    const quota = Math.max(0, Math.floor(Number((this.cfg.ARCADE.PLAYS_PER_WEEK || {})[kind]) || 0));
    const budget = {};
    for (const key of Object.keys(caps)) budget[key] = stageBudget(caps[key] * this.arcadeRewardBudgetMultiplier(), weeks);
    return {
      grades: ['S', 'A', 'B', 'C'].map(grade => ({ grade, text: this.arcadeRewardPreview(kind, grade, mode) })),
      limit: '每周 ' + quota + ' 次 · 本阶段剩余 ' + Math.max(0, weeks - used) + '/' + weeks + ' 次',
      budget: '阶段累计上限：' + this.arcadeEffectsText(budget),
      bonus: kind === 'whack' && window.WhaleCare ? (() => {
        const status = window.WhaleCare.arcadeRewardStatus(this);
        const template = (((this.cfg.WHALE_CARE || {}).UI || {}).ARCADE_BONUS_TEXT || '');
        return status ? template.replace(/\{(xp|remaining|max)\}/g, (_, key) => String(key === 'xp' ? status.xp * this.arcadeRewardMultiplier(mode) : status[key])) : '';
      })() : '',
      note: '标准奖档固定；触及阶段、能力或小鲸鱼体力上限时，同时列出本次实际奖励。'
    };
  },
  arcadeEffectsText(eff) {
    const out = [], plain = this.effectsText(eff);
    if (plain) out.push(plain);
    if (eff.whale_energy) out.push('小鲸鱼体力 +' + eff.whale_energy);
    for (const [key, name] of [['corpus_normal','普通'],['corpus_good','良好'],['corpus_best','优质']]) if (eff[key]) out.push(name + '语料 +' + eff[key] + ' 条');
    return out.join('、') || '无数值奖励';
  },
  arcadeReward(kind, result) {
    const maximum = rewardCaps(this);
    if (!this.arcadeRecordBest(kind, result)) return "";
    if (result.practice) return "练习模式，本局不发放奖励。";
    if (!this.arcadeCanReward(kind)) return "练习模式：本周奖励次数已用完。";
    const s = this.state, a = this._arcadeState();
    const rewardWeek = Math.max(0, Math.floor(Number(this.absWeek()) || 0));
    const quote = this.arcadeRewardDetails(kind, result.grade, result.rewardDifficulty), eff = quote.effects;
    // 阶段额外收益硬上限：默认十二周的标准 S 奖励；降低配置上限即时生效。
    const ver = s.ver || "V1", totals = a.stageRewards[ver][kind] || (a.stageRewards[ver][kind] = {}), cap = maximum[kind] || {};
    for (const key of Object.keys(eff)) {
      const current = eff[key];
      const maximumTotal = stageBudget(cap[key] * this.arcadeRewardBudgetMultiplier(), this.arcadeStageLimit(), key);
      totals[key] = Math.min(maximumTotal, positive(totals[key]) + current);
    }
    const dims = this.dimsOf(s);
    const before = {};
    for (const k of dims.concat(["funding", "brand", "reputation"])) before[k] = Number(s[k]) || 0;
    const corpusBefore = ((s.v35 || {}).corpus || {}).q || [0, 0, 0];
    const qualityBefore = corpusBefore.slice();
    const applied = Object.assign({}, eff);
    delete applied.whale_energy;
    // WhaleCare emits a save when energy changes. Include the completed reward
    // ledger and weekly play in that same snapshot, so reload cannot claim twice.
    a.plays[kind].push(rewardWeek);
    a.stagePlays[ver][kind] = (Number(a.stagePlays[ver][kind]) || 0) + 1;
    this.applyEffects(applied, s);
    const recovered = eff.whale_energy ? window.WhaleCare.restoreEnergy(this, eff.whale_energy, 'arcade-rice') : 0;
    const out = [], round = (n) => Math.round(n);
    for (const k of dims) {
      const delta = round((Number(s[k]) || 0) - before[k]);
      if (delta) out.push(this.statLabel(k) + " " + (delta > 0 ? "+" : "") + delta);
    }
    const corpus = (s.v35 || {}).corpus || {};
    const q = corpus.q || [0, 0, 0];
    const quality = ["普通", "良好", "优质"].map((name, i) => {
      const delta = round((q[i] || 0) - (qualityBefore[i] || 0));
      return delta ? name + "语料 " + (delta > 0 ? "+" : "") + delta + " 条" : "";
    }).filter(Boolean);
    // The reward is a whole number of corpus items. Effective tokens are a
    // derived quality measure, so keep their engine precision out of this label.
    if (quality.length) out.push(quality.join("、"));
    if (recovered) out.push('小鲸鱼体力 +' + recovered);
    const message = out.join("、") || (Object.keys(eff).length ? "本局奖励已结算，相关能力已达上限。" : quote.stageCapped ? "本阶段奖励总额已达上限（本局已计入次数）。" : "本局无数值奖励（已计入本周次数）。");
    return message + (quote.stageCapped && Object.keys(eff).length ? "；本阶段部分奖励已封顶，按剩余额度发放。" : "");
  },
  });
  // The upgrade compatibility layer must not wrap these helper-aware methods a
  // second time if their implementation is later refactored or instrumented.

  const applyEffects = core.applyEffects;
  core.applyEffects = function (eff, s) {
    const out = applyEffects.apply(this, arguments);
    s = s || this.state;
    /* 街机紧急任务只排队，由 arcade_glue 的事件圆点消费。 */
    if (s && eff && enabled(this, eff.arcade)) s.pendingArcade = eff.arcade;
    return out;
  };
})();
