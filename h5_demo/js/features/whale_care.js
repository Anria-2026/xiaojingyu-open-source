/* Optional companionship. All bonuses are read at use time; no base balance/config edits. */
(function () {
  "use strict";
  if (window.WhaleCare) return;
  const DEFAULT_CURVE = [0, 80, 200, 400, 700, 1100, 1600, 2200, 2900, 3600];
  const outfitAssets = Object.create(null);
  const outfitDragAssets = Object.create(null);
  const outfitWandAssets = Object.create(null);
  const attached = new WeakSet();
  const arcadeClaims = new WeakSet();
  const productionWrapped = new WeakSet();
  let lastCore = null, busBound = false;
  const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const integer = (n, fallback) => Math.max(0, Math.floor(finite(n, fallback)));
  const config = (core) => (core && core.cfg && core.cfg.WHALE_CARE) || {};
  // Saved companionship and chat XP exist before the physical body.
  // Physical interactions and economic bonuses have a separate, strict gate.
  const enabled = (core) => !!(core && core.state && core.cfg && core.cfg.WHALE_CARE && config(core).ENABLED !== false);
  const bodyAvailable = (core) => enabled(core) && typeof core.embodiedBodyAvailable === "function" && core.embodiedBodyAvailable()
    && !!(core.state.embodiedEra && core.state.embodiedEra.podExitSeen)
    && (!window.FeatureUnlock || window.FeatureUnlock.meets(core, config(core).UNLOCK));
  const absWeek = (core) => integer(core.state.week, 0) + integer(core.state.weekOffset, 0);
  const stageKey = (core) => String(core.state.ver || "V1");
  const sourceXP = (core, key, fallback) => Math.max(0, finite((config(core).XP || {})[key], fallback));
  const currentCore = () => (window.GameUI && window.GameUI.core) || lastCore;
  function curve(core) {
    const raw = config(core).XP_LEVELS;
    if (!Array.isArray(raw) || raw.length !== 10 || raw[0] !== 0 || raw.some((v, i) => !Number.isFinite(v) || (i && v <= raw[i - 1]))) return DEFAULT_CURVE;
    return raw;
  }
  function level(core, xp) {
    const levels = curve(core);
    let lvl = 1;
    while (lvl < 10 && xp >= levels[lvl]) lvl++;
    return lvl;
  }
  function energyStatus(core) {
    const cfg = config(core).ENERGY || {};
    const care = core && core.state && core.state.care;
    const ceilingValue = Number(cfg.CEILING);
    const ceiling = Number.isFinite(ceilingValue) && ceilingValue >= 1 ? Math.min(500, Math.floor(ceilingValue)) : 500;
    const initialMax = Math.min(ceiling, Math.max(1, integer(cfg.MAX, 100)));
    const max = Math.min(ceiling, Math.max(initialMax, integer(care && care.energyMax != null ? care.energyMax : initialMax, initialMax)));
    const initial = Math.min(initialMax, integer(cfg.INITIAL, initialMax));
    return { max, ceiling, initialMax, initial, value: Math.min(max, Math.max(0, finite(care && care.energy != null ? care.energy : initial, initial))) };
  }
  function day(core) {
    const s = core.state;
    const perWeek = Math.max(1, finite((core.cfg.V35 || {}).TICKS_PER_WEEK, 6));
    // A game day, never a wall-clock day; reloads and pause cannot refresh the cap.
    const ticks = s.v35 ? finite(s.v35.tick, 0) : finite(s.rounds, finite(s.week, 0) * perWeek);
    return integer(s.weekOffset, 0) * 7 + Math.floor(Math.max(0, ticks) * 7 / perWeek);
  }
  function refreshUnlocks(core, care) {
    const remember = (id) => { if (!care.unlocked.includes(id)) care.unlocked.push(id); };
    for (const outfit of (core.cfg.WHALE_OUTFITS || [])) {
      const unlock = outfit.unlock || {};
      const id = "outfit:" + outfit.id;
      care.unlocked = care.unlocked.filter(value => value !== id);
      if (outfit.enabled !== false && window.FeatureUnlock && window.FeatureUnlock.meets(core, unlock, outfit.id)) remember(id);
    }
  }
  function ensure(core) {
    if (!enabled(core)) return null;
    const s = core.state;
    if (!s.care || typeof s.care !== "object" || Array.isArray(s.care)) s.care = {};
    const care = s.care;
    care.xp = Math.max(0, Math.min(curve(core)[9], finite(care.xp, 0)));
    care.lvl = level(core, care.xp);
    // The reserve and its purchased capacity persist across weeks/stages/loads.
    // Reading an old save initializes capacity, never refills existing energy.
    const energy = energyStatus(core);
    care.energyMax = energy.max;
    care.energy = energy.value;
    if (care.active == null) care.active = care.xp > 0;
    care.active = !!care.active;
    care.outfit = typeof care.outfit === "string" ? care.outfit : "";
    care.unlocked = Array.isArray(care.unlocked) ? [...new Set(care.unlocked.filter((x) => typeof x === "string"))] : [];
    for (const key of ["events", "stageFeeds", "reviewed"]) if (!care[key] || typeof care[key] !== "object" || Array.isArray(care[key])) care[key] = {};
    const week = absWeek(core);
    if (care.week == null) care.week = week;
    if (care.week !== week) { care.week = week; care.feedsThisWeek = 0; care.dropsThisWeek = 0; care.arcadesThisWeek = 0; }
    for (const key of ["feedsThisWeek", "dropsThisWeek", "arcadesThisWeek"]) care[key] = integer(care[key], 0);
    if (care.chatDay !== day(core)) { care.chatDay = day(core); care.chatsToday = 0; }
    care.chatsToday = integer(care.chatsToday, 0);
    refreshUnlocks(core, care);
    return care;
  }
  function checkEnergyNotice(core){
    if(!bodyAvailable(core)||core.state.phase!=='office')return;
    const care=ensure(core),notice=config(core).LOW_ENERGY_NOTICE,ui=window.GameUI;
    if(!notice||ui?.core!==core||typeof document==='undefined'||typeof document.getElementById!=='function'||!document.body)return;
    const low=energyStatus(core).value<notice.threshold;
    let box=document.getElementById('care-energy-notice');
    if(!low){if(care.lowEnergyAlerted){care.lowEnergyAlerted=false;if(ui.save?.autoSave)ui.save.autoSave(core.state);}if(box){clearTimeout(box._hideTimer);box.remove();}return;}
    if(care.lowEnergyAlerted)return;care.lowEnergyAlerted=true;
    if(!box){box=document.createElement('div');box.id='care-energy-notice';box.className='dg-toast care-energy-notice';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.appendChild(box);}
    box.textContent=[notice.title,String(notice.text).replace('{threshold}',notice.threshold)].join(' · ');box.classList.add('show');
    clearTimeout(box._hideTimer);box._hideTimer=setTimeout(()=>box.remove(),notice.ms);
    if(ui.save?.autoSave)ui.save.autoSave(core.state);
  }
  function changed(core, source) {
    checkEnergyNotice(core);
    const ui = window.GameUI;
    if (ui && ui.core === core && ui.save && typeof ui.save.autoSave === "function") ui.save.autoSave(core.state);
    if (window.GameBus) window.GameBus.emit("care:changed", { source, xp: core.state.care.xp, lvl: core.state.care.lvl });
  }
  function activate(core) {
    const care = ensure(core);
    if (care) care.active = true;
    return care;
  }
  // Arcade rewards can refill her own reserve before she leaves the chamber.
  // The arcade owns its stage gate; this does not grant a physical interaction.
  function restoreEnergy(core, amount, source) {
    if (!enabled(core) || !Number.isFinite(amount) || amount < 0) return 0;
    const care = ensure(core), status = energyStatus(core), before = status.value;
    care.energy = Math.min(status.max, before + amount);
    const restored = care.energy - before;
    if (restored > 0) changed(core, source || "energy");
    return restored;
  }
  function addXP(core, amount, source) {
    if (!enabled(core) || !Number.isFinite(Number(amount)) || !(Number(amount) > 0)) return 0;
    const care = activate(core), before = care.xp, priorLevel=care.lvl, priorOutfits=new Set(care.unlocked);
    care.xp = Math.min(curve(core)[9], care.xp + Math.max(0, finite(amount, 0)));
    care.lvl = level(core, care.xp);
    refreshUnlocks(core, care);
    changed(core, source || "care");
    if(care.lvl>priorLevel){
      const fresh=(core.cfg.WHALE_OUTFITS||[]).filter(outfit=>care.unlocked.includes('outfit:'+outfit.id)&&!priorOutfits.has('outfit:'+outfit.id));
      const notice=config(core).OUTFIT_NOTICE;
      if(fresh.length&&notice&&window.GameUI?.core===core&&typeof document!=='undefined'&&typeof document.getElementById==='function'&&document.body){
        const text=String(notice.text||'').replace(/\{outfits\}/g,fresh.map(o=>o.name).join('、'));
        let box=document.getElementById('care-outfit-notice');if(!box){box=document.createElement('div');box.id='care-outfit-notice';box.className='dg-toast care-outfit-notice';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.appendChild(box);}
        box.textContent=[notice.title,text].filter(Boolean).join(' · ');box.classList.add('show');
        clearTimeout(box._hideTimer);box._hideTimer=setTimeout(()=>box.remove(),notice.ms);
      }
    }
    return care.xp - before;
  }
  function event(core, id) {
    const care = activate(core);
    if (!care) return;
    care.events[id] = true;
    refreshUnlocks(core, care);
  }
  function bonuses(core) {
    const care = core && core.state && core.state.care;
    if (!bodyAvailable(core) || !care || !care.active) return { rest: 0, output: 0 };
    const lvl = level(core, Math.max(0, finite(care.xp, 0))), buffs = config(core).BUFFS || {};
    return {
      rest: lvl >= finite(buffs.REST_LEVEL, 5) ? Math.min(0.05, Math.max(0, finite(buffs.REST_BONUS, 0.05))) : 0,
      output: lvl >= finite(buffs.OUTPUT_LEVEL, 10) ? Math.min(0.03, Math.max(0, finite(buffs.OUTPUT_BONUS, 0.03))) : 0,
    };
  }
  function feedingStatus(core) {
    if (!enabled(core)) return null;
    const care = ensure(core), cfg = config(core), key = stageKey(core);
    const weeklyMax = integer(cfg.FEEDS_PER_WEEK, 3);
    const stageMax = integer(cfg.STAGE_MAX_WEEKS, 12) * weeklyMax;
    const stageUsed = integer(care.stageFeeds[key], 0);
    return { weeklyMax, weekUsed: care.feedsThisWeek, stageMax, stageUsed,
      rewardRemaining: Math.max(0, stageMax - stageUsed),
      energyAfterCap: cfg.ENERGY_FEED_AFTER_STAGE_CAP !== false, energy: energyStatus(core),
      xpRoom: Math.max(0, curve(core)[9] - care.xp) };
  }
  function feedQuote(core, id) {
    if (!bodyAvailable(core)) return { ok: false, tip: "V5 训练达到具身开智条件、出舱后开放投喂" };
    const care = ensure(core), cfg = config(core), snack = (cfg.SNACKS || []).find((x) => x.id === id);
    if (!snack) return { ok: false, tip: "没有找到这份零食" };
    const status = feedingStatus(core), rewardAvailable = status.rewardRemaining > 0;
    if (care.feedsThisWeek >= status.weeklyMax) return { ok: false, tip: "本周投喂次数已用完，下周再来吧" };
    const key = stageKey(core);
    const capacityGain = Math.min(status.energy.ceiling - status.energy.max, integer(snack.capacity, 0));
    const max = status.energy.max + capacityGain;
    if (!rewardAvailable && !status.energyAfterCap && capacityGain === 0) return { ok: false, tip: "本阶段的零食奖励已领完，下个阶段再一起分享" };
    const cost = Math.max(0, finite(snack.cost, 0)), recovery = Math.min(max, integer(snack.energy, 0));
    // A purchase needs real capacity, energy or affection value. Capacity
    // growth remains useful at full energy and after the stage's XP allowance.
    const xpAvailable = rewardAvailable && status.xpRoom > 0 && finite(snack.xp, 0) > 0;
    if (capacityGain === 0 && !xpAvailable && (care.energy >= max || recovery === 0))
      return { ok: false, tip: "体力已充足，暂无好感收益，消耗后再来投喂吧" };
    if (finite(core.state.funding, 0) < cost) return { ok: false, tip: "经费不足，先把零食记在愿望单里" };
    return {ok:true,care,snack,status,rewardAvailable,key,capacityGain,max,cost,recovery};
  }
  function canFeed(core){return bodyAvailable(core)&&(config(core).SNACKS||[]).some(snack=>feedQuote(core,snack.id).ok);}
  function feed(core,id){
    const quote=feedQuote(core,id);if(!quote.ok)return quote;
    const {care,snack,status,rewardAvailable,key,capacityGain,max,cost,recovery}=quote;
    core.applyEffects({ funding: -cost }, core.state);
    const beforeEnergy = care.energy;
    care.energyMax = max;
    care.energy = Math.min(max, care.energy + recovery);
    const energy = care.energy - beforeEnergy;
    care.feedsThisWeek++;
    care.stageFeeds[key] = integer(care.stageFeeds[key], 0) + 1;
    event(core, "feed");
    const xp = rewardAvailable ? addXP(core, snack.xp, "feed") : 0;
    const lines = (core.cfg.WHALE_LINES || {}).feed || [];
    const line = lines[(care.stageFeeds[key] - 1) % Math.max(1, lines.length)] || "好吃！老板，分你一点开心。";
    const ui = window.GameUI;
    if (ui && ui.core === core) {
      wrapUI(ui);
      ui._careFeedUntil = Date.now() + 6500;
      if (window.V2OfficeScene && typeof window.V2OfficeScene.refreshLayout === "function") {
        window.V2OfficeScene.refreshLayout();
        if (window.OfficeBubbles && typeof window.OfficeBubbles.say === "function") window.OfficeBubbles.say("feed");
      } else {
        if (typeof ui.updateOfficeScene === "function") ui.updateOfficeScene();
        if (typeof ui.showWhaleLine === "function") ui.showWhaleLine();
      }
    }
    changed(core, "feed");
    return { ok: true, tip: line, line, xp, energy, cost, capacityGain, max, rewardCapped: !rewardAvailable };
  }
  function hint(unlock, eventText) {
    return window.FeatureUnlock ? window.FeatureUnlock.describe(unlock).replace("经历 " + unlock.event, eventText || "经历 " + unlock.event) : "达到时装解锁条件";
  }
  function wardrobe(core) {
    if (!bodyAvailable(core)) return [];
    const care = ensure(core);
    if (!care) return [];
    return (core.cfg.WHALE_OUTFITS || []).filter((x) => outfitAssets[x.id] === true).map((x) => ({
      ...x, kind: "outfit", available: true, unlocked: care.unlocked.includes("outfit:" + x.id),
      equipped: care.outfit === x.id, hint: hint(x.unlock || {}),
    }));
  }
  function equip(core, id) {
    if (!bodyAvailable(core)) return { ok: false, tip: "V5 训练达到具身开智条件、出舱后开放换装" };
    const care = ensure(core);
    if (id && id !== "default") {
      const entry = wardrobe(core).find((x) => x.id === id);
      if (!entry) return { ok: false, tip: "这套衣服暂未到货" };
      if (!entry.unlocked) return { ok: false, tip: entry.hint };
    }
    care.active = true;
    care.outfit = id === "default" ? "" : (id || "");
    changed(core, "outfit");
    return { ok: true, tip: care.outfit ? "换好衣服啦" : "已换回默认服装" };
  }
  function chat(core, result) {
    if (!enabled(core) || core.state.officeModal !== "test" || !result || result.next !== "continue" || !result.reply) return;
    chatSent(core);
  }
  function chatSent(core) {
    if (!enabled(core) || core.state.phase !== "office") return 0;
    const care = activate(core);
    event(core, "chat");
    if (care.chatsToday >= integer(config(core).CHAT_DAILY_CAP, 2)) return 0;
    care.chatsToday++;
    return addXP(core, sourceXP(core, "CHAT", 4), "chat");
  }
  function arcadeRewardStatus(core) {
    if (!enabled(core)) return null;
    const care = ensure(core), max = integer(config(core).ARCADE_WEEKLY_CAP, 0), xp = sourceXP(core, 'ARCADE', 0);
    return { max, xp, used: care.arcadesThisWeek, remaining: xp > 0 && care.xp < curve(core)[9] ? Math.max(0, max - care.arcadesThisWeek) : 0 };
  }
  function arcadeReward(core, result) {
    if (!enabled(core) || !result || result.kind !== 'whack' || result.aborted || arcadeClaims.has(result)
      || !['S','A','B','C'].includes(result.grade) || !Number.isFinite(result.score) || result.score < 0
      || !core.cfg.ARCADE || core.cfg.ARCADE.ENABLED === false || typeof core.arcadeAvailable !== 'function' || !core.arcadeAvailable('whack')) return 0;
    arcadeClaims.add(result);
    const status = arcadeRewardStatus(core);
    if (!status || status.remaining <= 0) return 0;
    const care = ensure(core);
    care.arcadesThisWeek++;
    return addXP(core, status.xp * (typeof core.arcadeRewardMultiplier === 'function' ? core.arcadeRewardMultiplier(result.rewardDifficulty) : 1), 'arcade-whack');
  }
  function drop(core, payload) {
    if (!bodyAvailable(core) || !payload) return;
    const care = activate(core);
    if (care.dropsThisWeek >= integer(config(core).DROP_WEEKLY_CAP, 2)) { changed(core, "drop"); return; }
    care.dropsThisWeek++;
    addXP(core, sourceXP(core, "DROP", 5), "drop");
  }
  function review(core, result) {
    if (!enabled(core) || !core.state.care || !core.state.care.active || !result || !["pass", "excellent", "top"].includes(result.verdict)) return;
    const care = ensure(core), key = stageKey(core);
    if (care.reviewed[key]) return;
    care.reviewed[key] = true;
    event(core, "review");
    addXP(core, sourceXP(core, "REVIEW", 30), "review");
  }
  function wrapUI(ui) {
    if (!ui) return;
    if (typeof ui.officeWhaleSrc === "function" && !ui.officeWhaleSrc.__careWrapped) {
      const original = ui.officeWhaleSrc;
      const wrapped = function (face) {
        const core = this.core, care = core && core.state && core.state.care;
        return outfitSrc(core, face, original.apply(this, arguments));
      };
      wrapped.__careWrapped = true;
      ui.officeWhaleSrc = wrapped;
    }
    if (typeof ui.officeWhaleState === "function" && !ui.officeWhaleState.__careWrapped) {
      const original = ui.officeWhaleState;
      const wrapped = function () {
        if (bodyAvailable(this.core) && (this._careFeedUntil || 0) > Date.now()) return { face: "比耶", group: "feed" };
        return original.apply(this, arguments);
      };
      wrapped.__careWrapped = true;
      ui.officeWhaleState = wrapped;
    }
  }
  function outfitSrc(core, face, fallback) {
    const care = core && core.state && core.state.care;
    if (bodyAvailable(core) && care && care.active && care.outfit && outfitAssets[care.outfit] === true) {
      const outfit = (core.cfg.WHALE_OUTFITS || []).find(x => x.id === care.outfit);
      const missing=((window.GameUI || {})._missingOfficeImages || {});
      if (outfit && outfit.enabled !== false && (!outfit.unlock || !(outfit.unlock.follow || outfit.unlock.videoTriple) || window.FollowOutfit && window.FollowOutfit.owned(core, outfit.id))
          && (care.unlocked||[]).includes("outfit:" + outfit.id) && !missing[outfit.img]) {
        if(face==='drag'&&outfit.dragImg&&outfitDragAssets[outfit.id]===true&&!missing[outfit.dragImg])return outfit.dragImg;
        if(face==='wand'&&outfit.wandImg&&outfitWandAssets[outfit.id]===true&&!missing[outfit.wandImg])return outfit.wandImg;
        return outfit.img;
      }
    }
    if (face === 'wand' && bodyAvailable(core) && !(care && care.outfit) && outfitWandAssets.default === true)
      return (config(core).AUTOMATION || {}).WAND_IMG || 'resource/character/whale_wand_default.webp';
    return fallback;
  }
  function wrapProduction() {
    const engine = window.V35;
    if (!engine || typeof engine.tick !== "function" || productionWrapped.has(engine)) return;
    productionWrapped.add(engine);
    const original = engine.tick;
    const wrapped = function (state) {
      const core = currentCore();
      const bonus = core && core.state && core.state.v35 === state ? bonuses(core).output : 0;
      if (!bonus) return original.apply(this, arguments);
      // The engine reads this existing multiplier once. Restore even on failure;
      // the save, underlying config, RNG call count and clock remain untouched.
      const had = Object.prototype.hasOwnProperty.call(state, "qualityMul"), previous = state.qualityMul;
      state.qualityMul = (previous == null ? 1 : previous) * (1 + bonus);
      try { return original.apply(this, arguments); }
      finally { if (had) state.qualityMul = previous; else delete state.qualityMul; }
    };
    wrapped.__careWrapped = true;
    engine.tick = wrapped;
  }
  function attach(core) {
    if (!core) return;
    lastCore = core;
    wrapProduction();
    wrapUI(window.GameUI);
    if (!attached.has(core)) {
      attached.add(core);
      for (const method of ["newGame", "loadState"]) {
        if (typeof core[method] !== "function") continue;
        const original = core[method];
        core[method] = function () {
          if (window.FollowOutfit) window.FollowOutfit.reset(this);
          if(window.GameUI?.core===this&&typeof document!=='undefined'&&typeof document.getElementById==='function'){for(const id of ['care-outfit-notice','care-energy-notice']){const notice=document.getElementById(id);if(notice){clearTimeout(notice._hideTimer);notice.remove();}}}
          const value = original.apply(this, arguments); ensure(this);
          if (window.FollowOutfit) window.FollowOutfit.sync(this);
          return value;
        };
      }
      if (typeof core.c2Choose === "function") {
        const original = core.c2Choose;
        core.c2Choose = function () { const value = original.apply(this, arguments); chat(this, value); return value; };
      }
      if (typeof core.finish === "function") {
        const original = core.finish;
        core.finish = function () { const value = original.apply(this, arguments); review(this, value || this.state.result); return value; };
      }
      if (typeof core.restoreRested === "function") {
        const original = core.restoreRested;
        core.restoreRested = function () {
          this.__careRestDepth = (this.__careRestDepth || 0) + 1;
          try { return original.apply(this, arguments); }
          finally { this.__careRestDepth--; }
        };
      }
      if (typeof core.addEnergy === "function") {
        const original = core.addEnergy;
        core.addEnergy = function (engineer, amount) {
          const bonus = this.__careRestDepth && amount > 0 ? bonuses(this).rest : 0;
          return original.call(this, engineer, amount * (1 + bonus));
        };
      }
      if (typeof core.prodRate === "function") {
        const original = core.prodRate;
        core.prodRate = function () { return original.apply(this, arguments) * (1 + bonuses(this).output); };
      }
    }
    if (window.GameBus && !busBound) {
      busBound = true;
      window.GameBus.on("week:start", () => { const core = currentCore(); if (core && core.state && core.state.care) ensure(core); });
      window.GameBus.on("whale:drop", (payload) => drop(currentCore(), payload));
    }
    if (core.state) ensure(core);
    return core;
  }
  window.WhaleCare = { attach, ensure, activate, addXP, chatSent, arcadeReward, arcadeRewardStatus, restoreEnergy, feed, feedingStatus, canFeed, checkEnergyNotice, equip, wardrobe, bonuses, wrapUI, outfitSrc, bodyAvailable, energyStatus,
    curve: (core) => curve(core).slice(), day,
    setOutfitAvailable(id, available) { outfitAssets[id] = !!available; },
    setOutfitDragAvailable(id, available) { outfitDragAssets[id] = !!available; },
    setOutfitWandAvailable(id, available) { outfitWandAssets[id] = !!available; },
    outfitAvailable(id) { return outfitAssets[id] === true; },
  };
  const ui = window.GameUI;
  if (ui) for (const name of ["init", "launch"]) {
    const original = ui[name];
    if (typeof original === "function") ui[name] = function () {
      const result = original.apply(this, arguments);
      attach(this.core || arguments[0]);
      return result;
    };
  }
  attach(window.GameCore);
})();
