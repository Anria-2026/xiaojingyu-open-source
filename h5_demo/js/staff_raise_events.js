/* Personal salary conversations. Configuration and event prose remain in GameCfg. */
(function (W) {
  'use strict';
  const C = W.GameCore;
  if (!C || W.StaffRaiseEvents) return;
  const finite = (x, fallback) => Number.isFinite(Number(x)) ? Number(x) : fallback;
  const rounds = core => Math.max(0, finite((core.state || {}).absRounds, 0));
  const stage = core => Math.max(0, Math.floor(finite((core.state || {}).stageNo, 0)));
  const perWeek = core => core.productionRoundsPerWeek();
  const cfg = core => {
    const c = ((core.cfg || {}).TEAM_BUILD || {}).RAISE_EVENTS || {};
    return { enabled: c.ENABLED !== false,
      overdue: Math.max(0, Math.ceil(finite(c.NO_RAISE_WEEKS, 6))),
      upgrade: Math.max(0, Math.ceil(finite(c.UPGRADE_WAIT_WEEKS, 1))),
      max: Math.min(2, Math.max(0, Math.floor(finite(c.PER_STAGE_MAX, 2)))),
      probability: Math.min(1, Math.max(0, finite(c.REJECT_PROB, .35))),
      mul: Math.min(1, Math.max(.01, finite(c.REJECT_PROD_MUL, .85))),
      weeks: Math.max(0, Math.ceil(finite(c.REJECT_WEEKS, 2))) };
  };
  const isEvent = ev => !!ev && ev.special === 'staff_raise'
    && ['overdue', 'upgrade'].includes(ev.raiseReason);
  function ensure(core) {
    const s = core.state;
    if (!s.staffRaiseEvents || s.staffRaiseEvents.schema !== 1 || !Array.isArray(s.staffRaiseEvents.stages))
      s.staffRaiseEvents = { schema: 1, stages: [], lastOfferAbsWeek: null };
    return s.staffRaiseEvents;
  }
  function ledger(core) {
    const store = ensure(core), no = stage(core);
    let row = store.stages.find(r => r && r.stageNo === no);
    if (!row) { row = { stageNo: no, used: 0, askedIds: [], offers: [] }; store.stages.push(row); }
    row.used = Math.min(2, Math.max(0, Math.floor(finite(row.used, 0))));
    if (!Array.isArray(row.askedIds)) row.askedIds = [];
    if (!Array.isArray(row.offers)) row.offers = [];
    return row;
  }
  function eligible(core, e, includeRest) {
    const s = core.state;
    return !!e && e.id != null && !e.resigned
      && (e.joinTick == null || !s.v35 || finite(s.v35.tick, 0) >= finite(e.joinTick, Infinity))
      && (includeRest || e.restWeek !== (s.week || 0));
  }
  function status(core, e, round) {
    const p = e && e.staffRaisePenalty, now = round == null ? rounds(core) : finite(round, rounds(core));
    const until = p && finite(p.untilRound, 0), mul = p && finite(p.mul, 1);
    const active = !!e && !e.resigned && until > now && mul >= 0 && mul < 1;
    return { active, mul: active ? mul : 1, weeksLeft: active ? Math.ceil((until - now) / perWeek(core)) : 0 };
  }
  function blocked(core) {
    const s = core.state, st = s.v35 || {};
    const from = (core.cfg.V35 || {}).EVENTS_FROM_VER, order = core.cfg.VER_ORDER || [];
    return s.phase !== 'office' || !s.planDone || s.pendingEvent || (s.pending || []).length
      || s.pendingMinigame || s.minigame || s.officeModal || s.officePaused
      || (s.embodiedEra && ['intro', 'accepted', 'tutorial'].includes(s.embodiedEra.status))
      || st.leaveRisk || st.poachRisk || (s.fiscalDeficit || 0) > 0 || (s.funding || 0) < 0
      || (s.payrollDue != null && s.payrollDue <= 1 && (s.funding || 0) < core.payrollTotal())
      || (from && order.indexOf(s.ver || 'V1') < order.indexOf(from))
      || (core.guidePending && core.guidePending()) || (core.tutorialPending && core.tutorialPending())
      || (core.offworkNow && core.offworkNow());
  }
  function offer(core) {
    const policy = cfg(core);
    if (!policy.enabled || !policy.max || blocked(core)) return null;
    const week = core.absWeek(), store = ensure(core), row = ledger(core);
    if (row.used >= policy.max || store.lastOfferAbsWeek === week) return null;
    const crew = (core.state.engineers || []).filter(e => eligible(core, e) && !row.askedIds.includes(String(e.id)));
    for (const reason of ['upgrade', 'overdue']) {
      const ev = (core.cfg.EVENTS || []).find(e => isEvent(e) && e.raiseReason === reason && core.eventEligibleForStage(e));
      if (!ev) continue;
      const candidates = crew.filter(e => reason === 'overdue'
        ? finite(e.weeksNoRaise, 0) >= policy.overdue
        : e.staffRaiseUpgrade && Number.isFinite(e.staffRaiseUpgrade.atRound)
          && rounds(core) - e.staffRaiseUpgrade.atRound >= policy.upgrade * perWeek(core)
          && finite(e.salary, 0) <= finite(e.staffRaiseUpgrade.salary, 0));
      candidates.sort((a, b) => {
        const wait = e => reason === 'overdue' ? finite(e.weeksNoRaise, 0) : rounds(core) - e.staffRaiseUpgrade.atRound;
        return wait(b) - wait(a) || String(a.id).localeCompare(String(b.id));
      });
      const target = candidates[0];
      if (!target) continue;
      row.used++; row.askedIds.push(String(target.id)); store.lastOfferAbsWeek = week;
      const token = row.stageNo + ':' + row.used + ':' + ev.no;
      row.offers.push({ token, eventNo: ev.no, targetId: target.id, state: 'offered' });
      core.state.pendingEvent = { id: ev.no, targetId: target.id, staffRaiseToken: token, staffRaiseStageNo: row.stageNo };
      core.state._lastEvtTick = core.state.rounds;
      return Object.assign({}, ev, { targetName: target.name, targetId: target.id, staffRaiseToken: token });
    }
    return null;
  }
  function cancel(core, record, tip) {
    if (record) record.state = 'cancelled';
    core.state.pendingEvent = null;
    return { ok: true, cancelled: true, tip };
  }
  const oldApply = C.applyEventOption;
  C.applyEventOption = function (evId, optIdx, token) {
    const ev = this.evByNo(evId);
    if (!ev && this.state.pendingEvent && this.state.pendingEvent.staffRaiseToken
      && Number(evId) === Number(this.state.pendingEvent.id)) {
      const old = ledger(this).offers.find(r => r.token === this.state.pendingEvent.staffRaiseToken);
      return cancel(this, old, '这条调薪事件已从配置移除');
    }
    if (!isEvent(ev)) return oldApply.call(this, evId, optIdx);
    const s = this.state, pend = s.pendingEvent;
    if (!pend || this.evNoOf(pend.id) !== ev.no)
      return { ok: false, tip: '这次调薪建议已经处理过了' };
    if (token != null && token !== pend.staffRaiseToken)
      return { ok: false, tip: '这张调薪卡片已经失效，请处理当前建议' };
    const row = ledger(this), record = row.offers.find(r => r.token === pend.staffRaiseToken);
    if (!record || record.state !== 'offered' || record.eventNo !== ev.no || record.targetId !== pend.targetId
      || pend.staffRaiseStageNo !== stage(this))
      return cancel(this, record, '这次调薪建议已失效');
    const e = (s.engineers || []).find(x => x.id === record.targetId), opt = (ev.options || [])[optIdx];
    if (!cfg(this).enabled || !this.eventEligibleForStage(ev) || !eligible(this, e))
      return cancel(this, record, '员工当前不在岗，这次调薪建议已取消');
    if (!opt) return { ok: false, tip: '调薪选项不存在' };
    const result = oldApply.call(this, evId, optIdx);
    if (result && result.ok === false) return result;
    record.state = 'resolved'; record.choice = optIdx;
    if ((opt.effects || {}).staff_raise_reject) {
      const policy = cfg(this), hit = Math.random() < policy.probability;
      record.rejected = true; record.penalty = hit && policy.weeks > 0 && policy.mul < 1;
      if (record.penalty) e.staffRaisePenalty = { mul: policy.mul,
        untilRound: Math.max(finite((e.staffRaisePenalty || {}).untilRound, 0), rounds(this) + policy.weeks * perWeek(this)) };
      return Object.assign({}, result || {}, { tip: record.penalty
        ? e.name + '暂时有些失落：接下来 ' + policy.weeks + ' 周产出 -' + Math.round((1 - policy.mul) * 100) + '%；成功涨薪可恢复'
        : e.name + '接受了这次沟通，薪资暂时维持不变' });
    }
    return result;
  };
  const oldSalary = C.increaseSalary;
  C.increaseSalary = function (e, amount) {
    const before = finite(e && e.salary, 0), result = oldSalary.call(this, e, amount);
    if (e && finite(e.salary, 0) > before) { delete e.staffRaisePenalty; delete e.staffRaiseUpgrade; }
    return result;
  };
  const oldUpgrade = C.upgradeTraitsByTalent;
  C.upgradeTraitsByTalent = function () {
    const result = oldUpgrade.call(this);
    for (const id of new Set((result || []).map(x => x.id))) {
      const e = (this.state.engineers || []).find(x => x.id === id);
      if (eligible(this, e, true)) e.staffRaiseUpgrade = { atRound: rounds(this), salary: finite(e.salary, 0) };
    }
    return result;
  };
  const oldMul = C.raiseProductionMul;
  C.raiseProductionMul = function (e, round) { return oldMul.call(this, e, round) * status(this, e, round).mul; };
  const oldText = C.eventOptionText;
  C.eventOptionText = function (opt, evId) {
    const p = cfg(this), vars = { raise_reject_chance: Math.round(p.probability * 100),
      raise_reject_weeks: p.weeks, raise_reject_output: Math.round((1 - p.mul) * 100) };
    return oldText.call(this, opt, evId).replace(/\{(raise_reject_chance|raise_reject_weeks|raise_reject_output)\}/g, (_, key) => vars[key]);
  };
  const oldLoad = C.loadState;
  C.loadState = function (s) {
    const result = oldLoad.call(this, s);
    const store = ensure(this);
    for (const row of store.stages) for (const record of (row && row.offers) || [])
      if (record.state === 'offered') record.state = 'abandoned';
    return result;
  };
  W.StaffRaiseEvents = { status, offer };
})(window);
