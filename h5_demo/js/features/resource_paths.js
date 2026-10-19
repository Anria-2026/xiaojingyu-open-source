/* Canonical resource categories. Exact migration aliases retain old player/editor configurations. */
(function (w) {
  'use strict';
  if (w.ResourcePaths) return;
  const aliases = Object.freeze({
  "resource/audio/sfx/click.wav": "resource/sound/sfx/click.wav",
  "resource/audio/sfx/confirm.wav": "resource/sound/sfx/confirm.wav",
  "resource/audio/sfx/float.wav": "resource/sound/sfx/float.wav",
  "resource/audio/sfx/jump.wav": "resource/sound/sfx/jump.wav",
  "resource/audio/sfx/land.wav": "resource/sound/sfx/land.wav",
  "resource/audio/sfx/move.wav": "resource/sound/sfx/move.wav",
  "resource/audio/sfx/ui.wav": "resource/sound/sfx/ui.wav",
  "resource/audio/sfx_tmp/float_20260902_224628_8689.wav": "resource/sound/sfx/float_alt_20260902_224628_8689.wav",
  "resource/audio/voice/亲亲.wav": "resource/sound/voice/亲亲.wav",
  "resource/audio/voice/哈喽哈喽.wav": "resource/sound/voice/哈喽哈喽.wav",
  "resource/audio/voice/总可以了吧.wav": "resource/sound/voice/总可以了吧.wav",
  "resource/audio/voice/挨电2.wav": "resource/sound/voice/挨电2.wav",
  "resource/story/life/growth/journey_eldercare_a3.png": "resource/story/journey_eldercare_a3.webp",
  "resource/story/life/growth/journey_market_a2.png": "resource/story/journey_market_a2.webp",
  "resource/story/life/growth/journey_rain_a2.png": "resource/story/journey_rain_a2.webp",
  "resource/story/life/growth/journey_work_a3.png": "resource/story/journey_work_a3.webp",
  "resource/story/life/growth/life_birth_child.png": "resource/story/life_birth_child.webp",
  "resource/story/life/growth/life_growing_girl.png": "resource/story/life_growing_girl.webp",
  "resource/story/life/growth/life_mature_whale.png": "resource/story/life_mature_whale.webp",
  "resource/story/life/growth/life_young_woman.png": "resource/story/life_young_woman.webp",
  "resource/story/life/growth/review_a1_live.png": "resource/story/review_a1_live.webp",
  "resource/story/life/growth/review_a1_news.png": "resource/story/review_a1_news.webp",
  "resource/story/life/growth/review_a2_first_task.png": "resource/story/review_a2_first_task.webp",
  "resource/story/life/growth/review_a2_graduation.png": "resource/story/review_a2_graduation.webp",
  "resource/story/life/growth/review_a3_first_work.png": "resource/story/review_a3_first_work.webp",
  "resource/story/life/growth/review_a3_graduation.png": "resource/story/review_a3_graduation.webp",
  "resource/story/life/journey_night.png": "resource/story/journey_night.webp",
  "resource/story/life/memorial/photos/awake.png": "resource/story/awake.webp",
  "resource/story/life/memorial/photos/body-v55.png": "resource/story/body-v55.webp",
  "resource/story/life/memorial/photos/body-v6.png": "resource/story/body-v6.webp",
  "resource/story/life/memorial/photos/body-v65.png": "resource/story/body-v65.webp",
  "resource/story/life/memorial/photos/city-eldercare.png": "resource/story/city-eldercare.webp",
  "resource/story/life/memorial/photos/city-market.png": "resource/story/city-market.webp",
  "resource/story/life/memorial/photos/city-school.png": "resource/story/city-school.webp",
  "resource/story/life/memorial/photos/city-work.png": "resource/story/city-work.webp",
  "resource/story/life/memorial/photos/clear-V1.5.png": "resource/story/clear-V1.5.webp",
  "resource/story/life/memorial/photos/clear-V2.5.png": "resource/story/clear-V2.5.webp",
  "resource/story/life/memorial/photos/clear-V3.5.png": "resource/story/clear-V3.5.webp",
  "resource/story/life/memorial/photos/clear-V5.5.png": "resource/story/clear-V5.5.webp",
  "resource/story/life/memorial/photos/clear-V5.png": "resource/story/clear-V5.webp",
  "resource/story/life/memorial/photos/clear-V6.5.png": "resource/story/clear-V6.5.webp",
  "resource/story/life/memorial/photos/clear-V6.png": "resource/story/clear-V6.webp",
  "resource/story/life/memorial/photos/first-project.png": "resource/story/first-project.webp",
  "resource/story/life/memorial/photos/first-rank1.png": "resource/story/first-rank1.webp",
  "resource/story/life/memorial/photos/first-top10.png": "resource/story/first-top10.webp",
  "resource/story/life/memorial/photos/first-v1.png": "resource/story/first-v1.webp",
  "resource/story/life/memorial/photos/v2.png": "resource/story/v2.webp",
  "resource/story/life/memorial/photos/v3.png": "resource/story/v3.webp",
  "resource/story/life/memorial/photos/v4.png": "resource/story/v4.webp",
  "resource/story/life/memorial/photos/v45.png": "resource/story/v45.webp",
  "resource/story/life/memorial/walk_age10_smooth.png": "resource/story/walk_age10_smooth.webp",
  "resource/story/life/memorial/walk_age15_smooth.png": "resource/story/walk_age15_smooth.webp",
  "resource/story/life/memorial/walk_age20_smooth.png": "resource/story/walk_age20_smooth.webp",
  "resource/story/life/memorial/walk_age25_smooth.png": "resource/story/walk_age25_smooth.webp",
  "resource/story/life/review_firstjob.png": "resource/story/review_firstjob.webp",
  "resource/story/life/review_graduation.png": "resource/story/review_graduation.webp",
  "resource/story/awake.png": "resource/story/awake.webp",
  "resource/story/body-v55.png": "resource/story/body-v55.webp",
  "resource/story/body-v6.png": "resource/story/body-v6.webp",
  "resource/story/body-v65.png": "resource/story/body-v65.webp",
  "resource/story/city-eldercare.png": "resource/story/city-eldercare.webp",
  "resource/story/city-market.png": "resource/story/city-market.webp",
  "resource/story/city-school.png": "resource/story/city-school.webp",
  "resource/story/city-work.png": "resource/story/city-work.webp",
  "resource/story/clear-V1.5.png": "resource/story/clear-V1.5.webp",
  "resource/story/clear-V2.5.png": "resource/story/clear-V2.5.webp",
  "resource/story/clear-V3.5.png": "resource/story/clear-V3.5.webp",
  "resource/story/clear-V5.5.png": "resource/story/clear-V5.5.webp",
  "resource/story/clear-V5.png": "resource/story/clear-V5.webp",
  "resource/story/clear-V6.5.png": "resource/story/clear-V6.5.webp",
  "resource/story/clear-V6.png": "resource/story/clear-V6.webp",
  "resource/story/first-project.png": "resource/story/first-project.webp",
  "resource/story/first-rank1.png": "resource/story/first-rank1.webp",
  "resource/story/first-top10.png": "resource/story/first-top10.webp",
  "resource/story/first-v1.png": "resource/story/first-v1.webp",
  "resource/story/journey_eldercare_a3.png": "resource/story/journey_eldercare_a3.webp",
  "resource/story/journey_market_a2.png": "resource/story/journey_market_a2.webp",
  "resource/story/journey_night.png": "resource/story/journey_night.webp",
  "resource/story/journey_rain_a2.png": "resource/story/journey_rain_a2.webp",
  "resource/story/journey_work_a3.png": "resource/story/journey_work_a3.webp",
  "resource/story/life_birth_child.png": "resource/story/life_birth_child.webp",
  "resource/story/life_growing_girl.png": "resource/story/life_growing_girl.webp",
  "resource/story/life_mature_whale.png": "resource/story/life_mature_whale.webp",
  "resource/story/life_young_woman.png": "resource/story/life_young_woman.webp",
  "resource/story/review_a1_live.png": "resource/story/review_a1_live.webp",
  "resource/story/review_a1_news.png": "resource/story/review_a1_news.webp",
  "resource/story/review_a2_first_task.png": "resource/story/review_a2_first_task.webp",
  "resource/story/review_a2_graduation.png": "resource/story/review_a2_graduation.webp",
  "resource/story/review_a3_first_work.png": "resource/story/review_a3_first_work.webp",
  "resource/story/review_a3_graduation.png": "resource/story/review_a3_graduation.webp",
  "resource/story/review_firstjob.png": "resource/story/review_firstjob.webp",
  "resource/story/review_graduation.png": "resource/story/review_graduation.webp",
  "resource/story/v2.png": "resource/story/v2.webp",
  "resource/story/v3.png": "resource/story/v3.webp",
  "resource/story/v4.png": "resource/story/v4.webp",
  "resource/story/v45.png": "resource/story/v45.webp",
  "resource/story/walk_age10_smooth.png": "resource/story/walk_age10_smooth.webp",
  "resource/story/walk_age15_smooth.png": "resource/story/walk_age15_smooth.webp",
  "resource/story/walk_age20_smooth.png": "resource/story/walk_age20_smooth.webp",
  "resource/story/walk_age25_smooth.png": "resource/story/walk_age25_smooth.webp"
});
  const folded = Object.create(null);
  for (const name of Object.keys(aliases)) folded[name.toLowerCase()] = aliases[name];
  function canonical(value) {
    if (typeof value !== 'string') return value;
    const match = /^(\/?)(resource[\\/].*?)([?#].*)?$/i.exec(value);
    if (!match) return value;
    let name = match[2].replace(/\\/g, '/');
    try { name = decodeURIComponent(name); } catch (_) {}
    const target = folded[name.toLowerCase()];
    return target ? match[1] + target + (match[3] || '') : value;
  }
  // Copy only changed branches; caller-owned configuration and save data stay intact.
  function migrate(value) {
    const seen = new WeakMap();
    function visit(item) {
      if (typeof item === 'string') return canonical(item);
      if (!item || typeof item !== 'object') return item;
      const proto = Object.getPrototypeOf(item);
      if (!Array.isArray(item) && proto !== null && proto !== Object.prototype &&
          !(proto.constructor && proto.constructor.name === 'Object')) return item;
      if (seen.has(item)) return seen.get(item);
      const result = Array.isArray(item) ? [] : Object.create(proto);
      seen.set(item, result);
      let changed = false;
      for (const key of Object.keys(item)) {
        const next = visit(item[key]);
        Object.defineProperty(result, key, {value:next,enumerable:true,writable:true,configurable:true});
        if (next !== item[key]) changed = true;
      }
      return changed ? result : item;
    }
    return visit(value);
  }
  function install(cfg) {
    if (!cfg || cfg.__resourcePathsInstalled || typeof cfg.applyExternalCfg !== 'function') return false;
    const initialized = migrate(cfg);
    for (const key of Object.keys(initialized)) if (initialized[key] !== cfg[key]) cfg[key] = initialized[key];
    const original = cfg.applyExternalCfg;
    cfg.applyExternalCfg = function () {
      const args = Array.from(arguments);
      args[0] = migrate(args[0]);
      return original.apply(this, args);
    };
    // loadExternal currently uses its lexical merge helper rather than this method.
    // Canonicalize after that read completes, before awaiting callers initialize gameplay.
    if (typeof cfg.loadExternal === 'function') {
      const load = cfg.loadExternal;
      cfg.loadExternal = function () {
        const target = this;
        const finish = result => {
          const next = migrate(target);
          for (const key of Object.keys(next)) if (next[key] !== target[key]) target[key] = next[key];
          return result;
        };
        const result = load.apply(target, arguments);
        return result && typeof result.then === 'function' ? result.then(finish) : finish(result);
      };
    }
    Object.defineProperty(cfg, '__resourcePathsInstalled', {value:true,configurable:true});
    return true;
  }
  w.ResourcePaths = Object.freeze({canonical,migrate,install,aliases});
  if (w.GameDefaults) {
    const defaults = migrate(w.GameDefaults);
    for (const key of Object.keys(defaults)) if (defaults[key] !== w.GameDefaults[key]) w.GameDefaults[key] = defaults[key];
  }
  install(w.GameCfg);
})(window);
