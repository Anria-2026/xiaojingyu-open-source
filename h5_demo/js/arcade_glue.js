/* V2B 街机接线：只通过公开接口接入，所有暂停由 OfficePause 的独立租约管理。 */
(function (w) {
  'use strict';
  if (w.ArcadeGlue) return;
  let active = null;
  const games = core => ((core && core.cfg || {}).ARCADE || {}).GAMES || {};
  const known = (core, kind) => typeof kind === 'string' && Object.prototype.hasOwnProperty.call(games(core), kind);
  const abort = (kind, reason) => ({ kind, score: 0, grade: 'C', aborted: true, reason });
  function sound(name) { try { if (w.SFX) w.SFX.play(name, { vol: 0.35 }); } catch (_) {} }
  function notify(ui, message) { if (message && ui && typeof ui.toast === 'function') ui.toast(message); }
  function save(ui, state) { if (ui.save && typeof ui.save.autoSave === 'function') ui.save.autoSave(state); }
  function openArcade(kind) {
    kind = kind || 'menu';
    const ui = w.GameUI, core = ui && ui.core, state = core && core.state, cfg = core && core.cfg.ARCADE;
    if (!core || !state || typeof core.arcadeCanReward !== 'function') return Promise.resolve(abort(kind, 'no-game'));
    if (!cfg || cfg.ENABLED === false) { notify(ui, '小游戏厅暂未开放。'); return Promise.resolve(abort(kind, 'disabled')); }
    if (kind !== 'menu' && !known(core, kind)) return Promise.resolve(abort(kind, 'invalid-kind'));
    const row = games(core)[kind], unavailable = row && (typeof core.arcadeAvailable === 'function' ? !core.arcadeAvailable(kind) : row.enabled === false || w.FeatureUnlock && !w.FeatureUnlock.meets(core, row.unlock));
    const lock = kind === 'runner' ? (cfg.LOCKED || {}).runner || '节奏快打 · 制作中，敬请期待' : unavailable ? '这款小游戏尚未解锁。' : (cfg.LOCKED || {})[kind] || w.MiniArcade && w.MiniArcade.lockedMessage(kind);
    if (lock) { notify(ui, lock); return Promise.resolve(Object.assign(abort(kind, 'locked'), { locked: true })); }
    if (active) return active;
    if (state.minigame) { notify(ui, '请先完成或关闭当前巡检。'); return Promise.resolve(abort(kind, 'inspection-active')); }
    if (!w.MiniArcade || typeof w.MiniArcade.open !== 'function') return Promise.resolve(abort(kind, 'load-failed'));
    const phase = state.phase, ver = state.ver;
    const isCurrent = () => core.state === state && state.phase === phase && state.ver === ver;
    const release = w.OfficePause && typeof w.OfficePause.acquire === 'function' ? w.OfficePause.acquire(core, 'arcade') : () => {};
    const settled = new WeakMap(), reported = new WeakSet();
    let lastReward = '';
    function report(result) {
      if (!isCurrent() || !result || !known(core, result.kind) || result.locked || reported.has(result)) return;
      reported.add(result);
      if (w.GameBus) w.GameBus.emit('arcade:result', { kind: result.kind, grade: result.grade || 'C', score: Number(result.score) || 0, practice: !!result.practice, aborted: !!result.aborted });
    }
    const opts = {
      title: kind === 'menu' ? '小游戏厅' : games(core)[kind].title, isCurrent,
      difficulty: core.arcadeDifficulty(), practice: kind !== 'menu' && !core.arcadeCanReward(kind),
      games: cfg.GAMES, locked: cfg.LOCKED, whack: cfg.WHACK, sort: cfg.SORT, rice: cfg.RICE, rewards: cfg.REWARDS,
      rivals: Array.isArray(core.cfg.RIVALS) && core.cfg.RIVALS.length ? core.cfg.RIVALS : cfg.GUESTS || [],
      sprites: cfg.SPRITES, whaleSprites: cfg.WHALE_SPRITES,
      getStatus: game => core.officeArcadeStatus(game), rewardPreview: (game, grade, mode) => core.arcadeRewardPreview(game, grade, mode),
      rewardOverview: (game, mode) => core.arcadeRewardOverview(game, mode),
      rewardGrowth: () => typeof core.arcadeRewardGrowth === 'function' ? core.arcadeRewardGrowth() : '',
      onResult(result) {
        if (!isCurrent()) return '存档或阶段已切换，本局不发放奖励。';
        report(result);
        if (!result || result.aborted || !known(core, result.kind)) return '';
        if (settled.has(result)) return settled.get(result);
        const reward = core.arcadeReward(result.kind, result);
        const xp = w.WhaleCare ? w.WhaleCare.arcadeReward(core, result) : 0;
        const text = (((core.cfg.WHALE_CARE || {}).UI || {}).ARCADE_REWARD_TEXT || '').replace('{xp}', String(xp));
        const modelReward = result.practice && xp > 0 ? core.cfg.WHALE_CARE.UI.ARCADE_PRACTICE_TEXT : reward;
        const message = [modelReward, xp > 0 ? text : ''].filter(Boolean).join('；');
        settled.set(result, message); lastReward = message; save(ui, state);
        if (message && !result.practice) sound('confirm');
        return message;
      }
    };
    if (typeof ui.updateOfficeMain === 'function') ui.updateOfficeMain();
    sound('click');
    active = Promise.resolve().then(() => isCurrent() ? w.MiniArcade.open(kind, opts) : abort(kind, 'stale-session')).catch(error => {
      if (w.console && w.console.warn) w.console.warn('[Arcade] 小游戏加载失败', error);
      notify(ui, '小游戏暂时没有加载成功，请稍后重试。'); return abort(kind, 'load-failed');
    }).then(result => { report(result); return result; }).finally(() => {
      active = null; release();
      if (!isCurrent()) return;
      save(ui, state);
      if (typeof ui.render === 'function') ui.render({ soft: true });
      notify(ui, lastReward);
    });
    return active;
  }
  w.ArcadeGlue = { open: openArcade, get active() { return !!active; } };
  if (w.GameUI) w.GameUI.openArcade = openArcade;
})(window);
