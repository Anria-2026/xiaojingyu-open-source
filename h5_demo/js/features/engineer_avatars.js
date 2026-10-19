/* Engineer portraits only. Stable identity migration preserves gameplay and original visitors. */
(function (w) {
  'use strict';
  if (w.EngineerAvatars) return;
  const legacy = src => /^resource\/ui\/avatar_(?:\d|[1-9]\d)\.webp$/i.test(String(src || ''));
  const modernIndex = i => Number.isInteger(i) && i >= 100 && i <= 233;
  // Only the nine previously shipped embodied identities shared these default portraits.
  // A player's other modern/custom choice is deliberate and must survive migration.
  function retiredBodyDefault(e) {
    if (!e || e.avatarCustomized === true || /^vis_/.test(String(e.id || '')) || e.visitorId) return false;
    const no = e.no != null ? Number(e.no) : /^e\d+$/.test(String(e.id || '')) ? Number(e.id.slice(1)) : null;
    const key = String(e.key || e.id || '');
    let old = no >= 2104 && no <= 2112 ? no - 2004 : null;
    if (no == null) old = key === 'eng_embodied_mentor' ? 100 : /^eng_embodied_0[1-8]$/.test(key) ? 100 + Number(key.slice(-2)) : null;
    if (old == null) return false;
    return (!e.avatar || e.avatar === 'resource/ui/avatar_' + old + '.webp') &&
      (e.avatarIdx == null || Number(e.avatarIdx) === old) && !!(e.avatar || e.avatarIdx != null);
  }
  // Capture factory portrait identities before an old external/local configuration can overwrite them.
  const factory = ((w.GameCfg || {}).ENGINEERS || []).map(e => ({no:e.no,key:e.key,avatar:e.avatar,avatarIdx:e.avatarIdx}));
  function template(core, e) {
    if (!e || /^vis_/.test(String(e.id || '')) || e.visitorId) return null;
    const cfg = core && core.cfg || w.GameCfg || {};
    let no = e.no;
    if (no == null && /^e\d+$/.test(String(e.id || ''))) no = Number(e.id.slice(1));
    if (no == null && core && core.cfg && typeof core.engNoOf === 'function') no = core.engNoOf(e);
    const matches = row => no != null ? Number(row.no) === Number(no) : !!(e.key || e.id) && row.key === (e.key || e.id);
    const configured = (cfg.ENGINEERS || []).find(matches);
    return configured && configured.avatar && !legacy(configured.avatar) && !retiredBodyDefault(configured) ? configured : factory.find(matches) || null;
  }
  function avatar(core, e) {
    if (!e) return null;
    const row = template(core, e);
    if (!row) return null;
    const retired = retiredBodyDefault(e);
    if (e.avatar && !legacy(e.avatar) && !retired) return e.avatar;
    if (modernIndex(e.avatarIdx) && !retired) return 'resource/ui/avatar_' + e.avatarIdx + '.webp';
    return row.avatar && !legacy(row.avatar) ? row.avatar : null;
  }
  // Display-only cache revision; saved/custom portrait paths keep their stable identity.
  function url(src) {
    return /^resource\/ui\/avatar_(?:20[3-9]|21\d|22\d|23[0-3])\.webp$/i.test(String(src || '')) ? src + '?v=20261008m' : src;
  }
  function person(core, e) {
    const src = avatar(core, e);
    if (!src || !e || (e.avatar && !legacy(e.avatar) && !retiredBodyDefault(e))) return;
    e.avatar = src;
    const match = /^resource\/ui\/avatar_(\d+)\.webp$/i.exec(src);
    if (match) e.avatarIdx = Number(match[1]);
  }
  function migrate(core, state) {
    if (!state || typeof state !== 'object') return state;
    for (const key of ['engineers','candidates']) for (const e of Array.isArray(state[key]) ? state[key] : []) person(core,e);
    return state;
  }
  function install(core, ui, save) {
    if (core && !core.__engineerAvatars) {
      core.__engineerAvatars = true;
      for (const name of ['newGame','loadState','genCandidates']) {
        const original = core[name];
        if (typeof original === 'function') core[name] = function () { const result=original.apply(this,arguments);migrate(this,this.state);return result; };
      }
      const clone = core.cloneEng;
      if (typeof clone === 'function') core.cloneEng = function () { const e=clone.apply(this,arguments);person(this,e);return e; };
      migrate(core,core.state);
    }
    if (ui && !ui.__engineerAvatars && typeof ui.engAvatar === 'function') {
      ui.__engineerAvatars = true;
      const original = ui.engAvatar;
      ui.engAvatar = function (e) { return url(avatar(this.core || core,e) || original.apply(this,arguments)); };
    }
    if (save && !save.__engineerAvatars && typeof save.migrate === 'function') {
      save.__engineerAvatars = true;
      const original = save.migrate;
      save.migrate = function () { const value=original.apply(this,arguments);if(value&&value.state)migrate(core,value.state);return value; };
    }
  }
  w.EngineerAvatars={avatar,url,migrate,install};
  install(w.GameCore,w.GameUI,w.GameSave);
})(window);
