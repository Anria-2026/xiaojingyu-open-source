(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.ArcadeCore) root.ArcadeCore.register('sort', api.game);
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const ART = 'resource/';
  const whaleLine = line => root.GameUI && typeof root.GameUI.whaleCanTalk === 'function' && !root.GameUI.whaleCanTalk() ? '咕嘎……' : line;
  const whaleName = () => root.GameUI && root.GameUI.core && typeof root.GameUI.core.whaleName === 'function' ? root.GameUI.core.whaleName() : '鲸鱼娘';
  const POINTS = Object.freeze({ good: 10, junk: 10, trap: 15, gold: 30, rival: 10 });
  const ICONS = Object.freeze({ good: 'book', junk: 'garble', trap: 'bug', gold: 'token' });
  const WHALE = Object.freeze({ riceIdle: ART + 'character/whale_rice_idle.webp', riceBite: ART + 'character/whale_rice_bite.webp', riceYue: ART + 'character/whale_rice_yue.webp' });
  const PENDING_MS = 1200;
  const LEVELS = Object.freeze([null,
    { windowMs: 3200, trap: 0, preview: 1, scale: 1 },
    { windowMs: 2800, trap: 0.08, preview: 1, scale: 1.2 },
    { windowMs: 2400, trap: 0.16, preview: 2, scale: 1.4 },
    { windowMs: 2000, trap: 0.23, preview: 2, scale: 1.6 },
    { windowMs: 1600, trap: 0.30, preview: 3, scale: 1.8 }
  ].map(function (row) { return row && Object.freeze(row); }));
  // Only used by independent hosts that supply no SORT config. An explicitly
  // edited CARDS array (including []) is authoritative and never repopulated.
  const FALLBACK_CARDS = [
    { id: 'code', type: 'good', text: '带注释的排序代码' },
    { id: 'manual', type: 'good', text: '中英对照的说明书' },
    { id: 'ad', type: 'junk', text: '全场一折！点我领取' },
    { id: 'repeat', type: 'junk', text: '同一句话重复99遍' },
    { id: 'wrong', type: 'trap', text: '教科书级：1+1=3' },
    { id: 'gold', type: 'gold', text: '逐条核验的精标语料' }
  ];
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function number(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
  // The modal may occupy a narrow column on a large desktop. Size the game from
  // its host, rather than guessing the available room from the window ratio.
  function layoutForSize(width, height, previewCount) {
    const w = Math.max(240, number(width, 720)), h = Math.max(220, number(height, 480));
    const layout = w >= 500 && h < 350 ? 'compact' : w <= 460 ? 'portrait' : 'wide';
    const showPreview = previewCount > 0 && (layout === 'compact' || h >= (layout === 'portrait' ? 470 : 360));
    const workplaceHeight = layout === 'compact' ? h - 20 : h - 186;
    const speakerSize = layout === 'portrait' ? Math.round(clamp(h * .20, 88, 120)) : layout === 'compact' ? 62 : Math.round(clamp(workplaceHeight - 98, 64, 168));
    const beltHeight = workplaceHeight - (layout === 'portrait' ? speakerSize + 14 : 0);
    const cardHeight = Math.max(82, beltHeight - (showPreview ? (layout === 'compact' ? 34 : 42) : 0) - 22 - 24 - 16);
    return { layout: layout, showPreview: showPreview, cardHeight: cardHeight,
      artSize: Math.round(clamp(cardHeight - 98, 0, layout === 'compact' ? 80 : 104)),
      speakerSize: speakerSize };
  }
  function installStyle(doc) {
    if (doc.getElementById('aso-layout-style')) return;
    const style = doc.createElement('style'); style.id = 'aso-layout-style';
    style.textContent = `
      .aso-game.aso-refined {box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:42px 4px minmax(0,1fr) 58px 18px;gap:10px;width:100%;height:100%;min-width:0;min-height:0;padding:12px;color:var(--arc-ink);font-family:var(--font-main,sans-serif);overflow:hidden;}
      .aso-refined *, .aso-refined *::before, .aso-refined *::after {box-sizing:border-box;}
      .aso-refined .aso-hud {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-width:760px;align-self:stretch;grid-column:1;grid-row:1;}
      .aso-refined .aso-stat {min-width:0;gap:3px;font-size:12px;line-height:16px;}
      .aso-refined .aso-stat:nth-child(2) {text-align:center;}.aso-refined .aso-stat:last-child {text-align:right;}
      .aso-refined .aso-stat strong {font:700 20px/24px var(--font-num,Arial,sans-serif);white-space:nowrap;}
      .aso-refined .aso-progress {grid-column:1;grid-row:2;width:100%;max-width:760px;}
      .aso-refined .aso-workplace {grid-column:1;grid-row:3;width:100%;height:100%;max-width:760px;display:grid;grid-template-columns:152px minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:14px;align-items:stretch;min-width:0;min-height:0;}
      .aso-refined .aso-talk {min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;align-self:stretch;}
      .aso-refined .aso-speaker {position:relative;width:min(100%,var(--aso-speaker-size,152px));height:var(--aso-speaker-size,168px);flex:none;pointer-events:none;transform-origin:50% 92%;}
      .aso-refined .aso-rice-art {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
      .aso-refined .aso-rice-art[hidden] {display:none!important;}
      .aso-refined .aso-rice-art img {object-fit:contain;object-position:50% 100%;}
      .aso-refined .aso-rice-mood {position:absolute;right:2%;top:8%;font:700 20px/1.2 var(--font-main,sans-serif);color:var(--arc-deep);opacity:0;pointer-events:none;}
      .aso-refined .aso-talk[data-reaction="tasty"] .aso-rice-mood {opacity:1;animation:aso-rice-delight .65s ease-out both;}
      .aso-refined .aso-talk[data-reaction="yue"] .aso-rice-mood {opacity:1;color:var(--arc-error);animation:aso-rice-delight .65s ease-out both;}
      .aso-refined .aso-talk[data-reaction="bite"] .aso-speaker[data-take="a"] {animation:aso-rice-bite-a .22s ease-in-out;}
      .aso-refined .aso-talk[data-reaction="bite"] .aso-speaker[data-take="b"] {animation:aso-rice-bite-b .22s ease-in-out;}
      .aso-refined .aso-talk[data-reaction="tasty"] .aso-speaker {animation:aso-rice-tasty .55s ease-in-out;}
      .aso-refined .aso-talk[data-reaction="yue"] .aso-speaker {animation:aso-rice-yue .46s ease-out;}
      .aso-refined .aso-talk[data-reaction="tasty"] .aso-voice {border-color:var(--arc-primary);background:#f1fbff;}
      .aso-refined .aso-talk[data-reaction="yue"] .aso-voice {border-color:#f0b6c5;background:#fff5f8;}
      .aso-refined .aso-voice {width:100%;min-width:0;max-height:100%;padding:10px 12px;background:var(--arc-white);border:1px solid var(--arc-line);border-radius:12px;overflow:auto;}
      .aso-refined .aso-speaker-name {display:block;margin-bottom:4px;font-size:12px;font-weight:700;line-height:16px;color:var(--arc-deep);}
      .aso-refined .aso-speech {margin:0;padding:0;border:0;background:none;border-radius:0;color:var(--arc-muted);font-size:14px;line-height:1.55;overflow-wrap:anywhere;}
      .aso-refined .aso-speech::before {content:none;}
      .aso-refined .aso-belt {display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:42px minmax(0,1fr) 22px;gap:8px;align-items:stretch;justify-content:stretch;width:100%;height:100%;min-width:0;min-height:0;padding:12px;border:1px solid var(--arc-line);border-radius:14px;background:linear-gradient(180deg,var(--arc-background),var(--arc-soft));overflow:hidden;}
      .aso-refined .aso-belt.no-preview {grid-template-rows:minmax(0,1fr) 22px;}
      .aso-refined .aso-previews {grid-column:1;grid-row:1;display:flex;align-items:stretch;justify-content:center;width:100%;height:42px;min-width:0;gap:6px;overflow:hidden;pointer-events:none;}
      .aso-refined .aso-previews[hidden] {display:none;}
      .aso-refined .aso-active {grid-column:1;grid-row:2;display:grid;place-items:stretch center;width:100%;height:100%;max-width:none;min-width:0;min-height:0;flex:none;overflow:hidden;touch-action:none;}
      .aso-refined .aso-belt.no-preview .aso-active {grid-row:1;}
      .aso-refined .aso-card {min-width:0;border-radius:10px;background:var(--arc-white);}
      .aso-refined .aso-card.is-current {width:min(100%,360px);height:100%;min-height:0;border-width:1px;box-shadow:0 8px 20px -16px var(--arc-deep);}
      .aso-refined .aso-card.is-current .aso-card-content {height:calc(100% - 5px);min-height:0;display:flex;flex-direction:column;justify-content:center;gap:6px;padding:10px 12px;}
      .aso-refined .aso-card-art {width:var(--aso-art-size,96px);height:var(--aso-art-size,96px);flex:none;pointer-events:none;}
      .aso-refined[data-art="none"] .aso-card.is-current .aso-card-art {display:none;}
      .aso-refined .aso-card-label {font-size:12px;line-height:16px;color:var(--arc-muted);flex:none;}
      .aso-refined .aso-card-text {display:block;min-width:0;max-width:100%;margin:0;color:var(--arc-ink);font-family:var(--font-main,sans-serif);white-space:normal;overflow-wrap:anywhere;text-align:center;font-size:16px;font-weight:700;line-height:1.5;flex:0 1 auto;min-height:0;overflow:auto;}
      .aso-refined .aso-card.is-preview {width:112px;height:42px;flex:0 1 112px;opacity:.7;border-width:1px;}
      .aso-refined .aso-card.is-preview .aso-card-content {height:100%;padding:4px 6px;display:flex;flex-direction:row;justify-content:flex-start;gap:5px;}
      .aso-refined .aso-card.is-preview .aso-card-art {display:block;width:28px;height:28px;flex:none;}
      .aso-refined .aso-card.is-preview .aso-card-text {display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1;overflow:hidden;white-space:normal;text-align:left;font-size:11px;font-weight:500;line-height:1.35;max-height:2.7em;}
      .aso-refined .aso-card.is-preview .aso-card-label, .aso-refined .aso-card.is-preview .aso-window {display:none;}
      .aso-refined .aso-card.is-pending {opacity:0;pointer-events:none;}
      .aso-refined .aso-card.is-leaving {opacity:0;pointer-events:none;}
      .aso-refined .aso-feedback {grid-column:1;grid-row:3;width:100%;height:22px;min-height:0;margin:0;font:700 14px/22px var(--font-main,sans-serif);text-align:center;white-space:nowrap;pointer-events:none;}
      .aso-refined .aso-belt.no-preview .aso-feedback {grid-row:2;}
      .aso-refined .aso-empty {grid-column:1;grid-row:1/-1;place-self:center;max-width:100%;font-size:14px;line-height:1.5;}
      .aso-refined .aso-empty[hidden] {display:none;}
      .aso-refined .aso-actions {grid-column:1;grid-row:4;max-width:760px;min-width:0;height:58px;gap:12px;align-self:stretch;}
      .aso-refined .aso-action {width:100%;min-width:0;min-height:58px;height:58px;padding:6px 14px;gap:2px;background:var(--btn-bg,var(--arc-white));color:var(--btn-fg,var(--arc-deep));overflow:hidden;}
      .aso-refined .aso-keep {--btn-fg:#fff;}
      .aso-refined .aso-discard {--btn-fg:var(--arc-error);}
      .aso-refined .aso-action strong {color:inherit;font-size:18px;line-height:23px;}.aso-refined .aso-action span {color:inherit;font-size:12px;line-height:16px;}
      .aso-refined .aso-help {grid-column:1;grid-row:5;font-size:12px;line-height:18px;text-align:center;overflow:hidden;}
      .aso-refined[data-layout="portrait"] .aso-workplace {grid-template-columns:minmax(0,1fr);grid-template-rows:calc(var(--aso-speaker-size) + 6px) minmax(0,1fr);gap:8px;}
      .aso-refined[data-layout="portrait"] .aso-talk {flex-direction:row;gap:10px;}
      .aso-refined[data-layout="portrait"] .aso-speaker {width:var(--aso-speaker-size);height:var(--aso-speaker-size);}
      .aso-refined[data-layout="portrait"] .aso-voice {flex:1;padding:7px 10px;}
      .aso-refined[data-layout="portrait"] .aso-speaker-name {margin-bottom:2px;}
      .aso-refined[data-layout="portrait"] .aso-speech {font-size:13px;line-height:18px;}
      .aso-refined[data-layout="portrait"] .aso-belt {padding:10px;}
      .aso-refined[data-layout="portrait"] .aso-action {padding-left:10px;padding-right:10px;}
      .aso-refined[data-layout="compact"] {grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);grid-template-rows:42px 4px minmax(0,1fr) 58px 18px;column-gap:14px;row-gap:8px;padding:10px;}
      .aso-refined[data-layout="compact"] .aso-workplace {display:contents;}
      .aso-refined[data-layout="compact"] .aso-talk {grid-column:1;grid-row:3;flex-direction:row;gap:8px;justify-content:flex-start;}
      .aso-refined[data-layout="compact"] .aso-speaker {width:62px;height:62px;}
      .aso-refined[data-layout="compact"] .aso-voice {flex:1;padding:8px 10px;}
      .aso-refined[data-layout="compact"] .aso-speech {font-size:13px;line-height:19px;}
      .aso-refined[data-layout="compact"] .aso-belt {grid-column:2;grid-row:1/6;grid-template-rows:34px minmax(0,1fr) 22px;padding:10px;}
      .aso-refined[data-layout="compact"] .aso-belt.no-preview {grid-template-rows:minmax(0,1fr) 22px;}
      .aso-refined[data-layout="compact"] .aso-previews,.aso-refined[data-layout="compact"] .aso-card.is-preview {height:34px;}
      .aso-refined[data-layout="compact"] .aso-card.is-preview .aso-card-art {width:24px;height:24px;}
      .aso-refined[data-layout="compact"] .aso-card.is-current .aso-card-content {padding:8px 10px;gap:4px;}
      .aso-refined[data-layout="compact"] .aso-card.is-current.is-long .aso-card-art {display:none;}
      .aso-refined[data-layout="compact"] .aso-stat strong {font-size:18px;line-height:24px;}
      .aso-refined[data-layout="compact"] .aso-help {font-size:11px;}
      .aso-game.aso-refined {position:relative;isolation:isolate;}
      .aso-refined .aso-active {overflow:visible!important;touch-action:pan-y;}
      .aso-refined .aso-card.is-current {position:relative;cursor:grab;touch-action:pan-y;user-select:none;transition:transform .19s cubic-bezier(.2,.8,.2,1),box-shadow .16s,border-color .16s;transform-origin:50% 85%;}
      .aso-refined .aso-card.is-arriving {animation:aso-arrive .18s cubic-bezier(.2,.8,.2,1);}
      .aso-refined .aso-card.is-current.is-grabbed {cursor:grabbing;animation:none;transition:box-shadow .12s,border-color .12s;box-shadow:0 10px 24px -12px var(--arc-deep);}
      .aso-refined .aso-card.is-pending {animation:none;}
      .aso-refined .aso-decision {position:absolute;top:9px;left:50%;z-index:2;display:block;padding:4px 12px;border:2px solid currentColor;border-radius:6px;background:var(--arc-white);font:700 14px/20px var(--font-main,sans-serif);white-space:nowrap;opacity:0;transform:translate(-50%,-5px) rotate(-5deg);pointer-events:none;transition:opacity .12s,transform .12s;}
      .aso-refined .aso-card[data-intent="keep"] {border-color:var(--arc-primary);}.aso-refined .aso-card[data-intent="discard"] {border-color:var(--arc-error);}
      .aso-refined .aso-card[data-intent] .aso-decision {opacity:1;transform:translate(-50%,0) rotate(-5deg);color:var(--arc-deep);}
      .aso-refined .aso-card[data-intent="discard"] .aso-decision {color:var(--arc-error);transform:translate(-50%,0) rotate(5deg);}
      .aso-refined .aso-card.is-preview .aso-decision {display:none;}
      .aso-refined .aso-action {transition:box-shadow .14s,filter .14s;}
      .aso-refined .aso-action.is-target {box-shadow:0 0 0 3px var(--arc-line),0 6px 18px -10px var(--arc-deep);filter:brightness(1.08);}
      .aso-refined .aso-fx {position:absolute;inset:0;z-index:4;overflow:hidden;pointer-events:none!important;contain:layout paint;}
      .aso-refined .aso-fx * {pointer-events:none!important;}
      .aso-refined .aso-card.is-flight {position:absolute;min-height:0;max-width:none;opacity:1;cursor:default;transition:none;transform-origin:50% 50%;animation:aso-file-away .30s cubic-bezier(.22,.6,.28,1) forwards;}
      .aso-refined .aso-card.is-flight.is-wrong {border-color:var(--arc-error);background:#fff1f4;}
      .aso-refined .aso-card.is-flight .aso-window {display:none;}
      .aso-refined .aso-score-pop {position:absolute;z-index:1;font:700 20px/1.3 var(--font-num,Arial,sans-serif);white-space:nowrap;color:var(--arc-deep);text-shadow:0 1px 0 #fff;animation:aso-score-rise .52s ease-out forwards;}
      .aso-refined .aso-score-pop.is-error {color:var(--arc-error);}.aso-refined .aso-score-pop.is-gold {color:#c9972a;}
      .aso-refined .aso-spark {position:absolute;width:7px;height:7px;border-radius:2px;background:var(--arc-primary);animation:aso-spark .46s ease-out forwards;}
      .aso-refined .aso-spark.is-gold {background:#edbf58;}.aso-refined .aso-spark.is-error {background:var(--arc-error);}
      .aso-refined .aso-action[data-pulse="a"] {animation:aso-bin-a .24s ease-out;}.aso-refined .aso-action[data-pulse="b"] {animation:aso-bin-b .24s ease-out;}
      .aso-refined .aso-feedback[data-pulse="a"] {animation:aso-feedback-a .24s ease-out;}.aso-refined .aso-feedback[data-pulse="b"] {animation:aso-feedback-b .24s ease-out;}
      @keyframes aso-arrive {from{opacity:.25;transform:translateY(-16px) scale(.96);}to{opacity:1;transform:none;}}
      @keyframes aso-file-away {0%{opacity:1;transform:rotate(var(--flight-start,0deg));}45%{opacity:.96;}100%{opacity:0;transform:translate(var(--flight-x),var(--flight-y)) rotate(var(--flight-turn)) scale(.18);}}
      @keyframes aso-score-rise {0%{opacity:0;transform:translate(-50%,4px) scale(.8);}18%{opacity:1;transform:translate(-50%,-3px) scale(1.08);}100%{opacity:0;transform:translate(-50%,-35px) scale(1);}}
      @keyframes aso-spark {from{opacity:.95;transform:translate(0,0) rotate(0);}to{opacity:0;transform:translate(var(--spark-x),var(--spark-y)) rotate(100deg) scale(.3);}}
      @keyframes aso-bin-a {35%{filter:brightness(1.2);box-shadow:inset 0 0 0 3px #ffffffb0;}100%{filter:none;}}
      @keyframes aso-bin-b {35%{filter:brightness(1.2);box-shadow:inset 0 0 0 3px #ffffffb0;}100%{filter:none;}}
      @keyframes aso-feedback-a {from{opacity:.35;transform:translateY(4px);}to{opacity:1;transform:none;}}
      @keyframes aso-feedback-b {from{opacity:.35;transform:translateY(4px);}to{opacity:1;transform:none;}}
      @keyframes aso-rice-bite-a {0%{transform:translateY(0) rotate(0);}48%{transform:translateY(2px) rotate(-3deg) scale(.97);}100%{transform:translateY(0) rotate(0);}}
      @keyframes aso-rice-bite-b {0%{transform:translateY(0) rotate(0);}48%{transform:translateY(2px) rotate(-3deg) scale(.97);}100%{transform:translateY(0) rotate(0);}}
      @keyframes aso-rice-tasty {0%,100%{transform:none;}28%{transform:translateY(-5px) rotate(-2deg);}60%{transform:translateY(1px) rotate(2deg);}82%{transform:translateY(-2px);}}
      @keyframes aso-rice-yue {0%,100%{transform:none;}28%{transform:translate(3px,3px) rotate(5deg);}45%{transform:translate(-2px,4px) rotate(3deg);}65%{transform:translate(2px,2px) rotate(4deg);}82%{transform:translate(-1px,1px);}}
      @keyframes aso-rice-delight {0%{opacity:0;transform:translateY(7px) scale(.65);}30%{opacity:1;transform:translateY(-2px) scale(1.1);}100%{opacity:1;transform:translateY(-5px) scale(1);}}
      @media(prefers-reduced-motion:reduce) {.aso-refined,.aso-refined * {animation:none!important;transition:none!important;}.aso-refined .aso-fx{display:none;}}
    `;
    doc.head.append(style);
  }
  function difficultyConfig(difficulty, config) {
    const level = clamp(Math.round(number(difficulty, 1)), 1, 5);
    const row = config && Array.isArray(config.DIFFICULTY) && config.DIFFICULTY[level] || {};
    const base = LEVELS[level];
    return { difficulty: level, windowMs: clamp(number(row.windowMs, base.windowMs), 600, 10000),
      trap: clamp(number(row.trap, base.trap), 0, 0.5),
      preview: clamp(Math.round(number(row.preview, base.preview)), 0, 3),
      scale: clamp(number(row.scale, base.scale), 0.5, 5) };
  }
  function comboMultiplier(combo) { return Math.min(2, 1 + Math.max(0, number(combo, 0) - 1) * 0.1); }
  function createScoreState() {
    return { score: 0, combo: 0, maxCombo: 0, hits: 0, attempts: 0, misses: 0, misHits: 0, bonusSeconds: 0 };
  }
  function expectedChoice(card) { return card && ['good', 'gold', 'rival'].includes(card.type) ? 'keep' : 'discard'; }
  function sortCard(state, card, choice) {
    if (!card || card.done || card.pending || !POINTS[card.type] || !['keep', 'discard'].includes(choice)) {
      return { finished: false, valid: false, points: 0, bonusSeconds: 0 };
    }
    card.done = true;
    state.attempts += 1;
    if (choice !== expectedChoice(card)) {
      state.score -= 15; state.combo = 0; state.misHits += 1;
      return { finished: true, valid: false, points: -15, bonusSeconds: 0 };
    }
    state.hits += 1; state.combo += 1; state.maxCombo = Math.max(state.maxCombo, state.combo);
    const points = Math.round(POINTS[card.type] * comboMultiplier(state.combo));
    const bonusSeconds = 0;
    state.score += points; state.bonusSeconds += bonusSeconds;
    return { finished: true, valid: true, points: points, bonusSeconds: bonusSeconds, gold: card.type === 'gold' };
  }
  function missCard(state, card) {
    if (!card || card.done || card.pending || !POINTS[card.type]) return 0;
    card.done = true; state.attempts += 1; state.misses += 1; state.combo = 0;
    return 1;
  }
  function accuracy(state) { return state.attempts ? state.hits / state.attempts : 0; }
  function gradeForScore(score, difficulty, config) {
    const scale = difficultyConfig(difficulty, config).scale;
    return score >= 500 * scale ? 'S' : score >= 300 * scale ? 'A' : score >= 150 * scale ? 'B' : 'C';
  }
  function cardsForOptions(opts) {
    const config = opts && opts.sort;
    const cards = config ? (Array.isArray(config.CARDS) ? config.CARDS : []) : FALLBACK_CARDS;
    return cards.filter(function (card) { return card && ['good', 'junk', 'trap', 'gold'].includes(card.type) && String(card.text || '').trim(); })
      .map(function (card) { return { id: card.id, type: card.type, text: String(card.text).trim(),
        img: card.img || (opts && opts.sprites || {})[ICONS[card.type]] || ART + 'ui/mg_' + ICONS[card.type] + '.webp' }; });
  }
  function rivalsForOptions(opts) {
    return Array.isArray(opts && opts.rivals) ? opts.rivals.filter(function (rival) { return rival && rival.img && rival.name; }) : [];
  }
  function assets(opts) {
    return Array.from(new Set(Object.values(Object.assign({}, WHALE, opts && opts.whaleSprites || {})).concat(cardsForOptions(opts).map(function (card) { return card.img; }))
      .concat(rivalsForOptions(opts).map(function (rival) { return rival.img; }))));
  }
  function create(env) {
    const doc = env.host.ownerDocument, opts = env.opts || {}, config = opts.sort || {};
    installStyle(doc);
    const cfg = difficultyConfig(opts.difficulty, config), cards = cardsForOptions(opts), rivals = rivalsForOptions(opts);
    const whale = Object.assign({}, WHALE, opts.whaleSprites || {});
    const random = env.rng || Math.random, state = createScoreState(), queue = [], cleanups = [];
    const buckets = {};
    cards.forEach(function (card) { (buckets[card.type] || (buckets[card.type] = [])).push(card); });
    const goldChance = clamp(number(config.GOLD_CHANCE, 0.04), 0, 0.1);
    const rivalChance = clamp(number(config.RIVAL_CHANCE, 0.10), 0, 0.3);
    let raf = 0, started = false, running = false, ended = false, destroyed = false;
    let previous = null, elapsed = 0, duration = 30000;
    let current = null, reaction = null, reactionSerial = 0, lastHud = '', drag = null, effectSerial = 0, bubbleUntil = 2400, bubbleSerial = 0;
    const effects = [];
    function element(tag, cls, text) {
      const node = doc.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node;
    }
    function listen(target, name, fn, options) {
      if (env.listen) env.listen(target, name, fn, options); else target.addEventListener(name, fn, options);
      cleanups.push(function () { target.removeEventListener(name, fn, options); });
    }
    function pick(list) { return list[Math.floor(random() * list.length)]; }
    function sound(name, vol) { try { if (root.SFX && root.SFX.play) root.SFX.play(name, { vol: vol }); } catch (_) {} }
    const game = element('div', 'aso-game aso-refined'), hud = element('div', 'aso-hud');
    function stat(label, cls) {
      const block = element('div', 'aso-stat'), value = element('strong', cls, '0');
      block.append(element('span', '', label), value); hud.append(block); return value;
    }
    const scoreValue = stat('得分', 'aso-score'), comboValue = stat('连击', 'aso-combo'), timeValue = stat('剩余', 'aso-time');
    const progress = element('div', 'aso-progress'), progressFill = element('i'); progress.setAttribute('aria-hidden', 'true'); progress.append(progressFill);
    const workplace = element('div', 'aso-workplace'), talk = element('aside', 'aso-talk');
    const speaker = element('span', 'aso-speaker'), voice = element('div', 'aso-voice'), speakerName = element('span', 'aso-speaker-name', whaleName()), speech = element('p', 'aso-speech', whaleLine('开饭啦！帮我挑好语料。'));
    const riceArt = {}, mood = element('span', 'aso-rice-mood'); mood.setAttribute('aria-hidden', 'true');
    [['idle', 'riceIdle', '鲸鱼娘端着一碗大米饭'], ['bite', 'riceBite', '鲸鱼娘正在吃一口米饭'], ['yue', 'riceYue', '鲸鱼娘吃到坏语料后嫌弃地作呕']].forEach(function (item) {
      const node = env.sprite(whale[item[1]], item[2].replace('鲸鱼娘', whaleName()), 'aso-speaker-art aso-rice-art');
      node.dataset.rice = item[0]; node.hidden = item[0] !== 'idle'; riceArt[item[0]] = node; speaker.append(node);
    });
    speaker.append(mood); talk.dataset.reaction = 'idle'; talk.setAttribute('aria-live', 'polite'); voice.append(speakerName, speech); talk.append(speaker, voice);
    voice.dataset.bubble = 'show'; voice.dataset.pop = 'a';
    const belt = element('div', 'aso-belt'), previews = element('div', 'aso-previews'), active = element('div', 'aso-active');
    previews.setAttribute('aria-label', '即将送达的语料卡'); active.setAttribute('aria-label', '当前语料卡');
    const feedback = element('p', 'aso-feedback', ''); feedback.setAttribute('aria-live', 'polite');
    const empty = element('p', 'aso-empty', cards.length ? '正在准备语料卡……' : '卡片池为空，请在编辑器补充');
    belt.append(previews, active, empty, feedback); workplace.append(talk, belt);
    const actions = element('div', 'aso-actions');
    function action(choice, label, key) {
      const button = element('button', 'aso-action dg-btn ' + (choice === 'keep' ? 'dg-btn-primary aso-keep' : 'dg-btn-danger aso-discard'));
      button.type = 'button'; button.dataset.choice = choice; button.append(element('strong', '', label), element('span', '', key));
      listen(button, 'pointerdown', function (event) { if (event.button != null && event.button !== 0) return; event.preventDefault(); decide(choice); });
      listen(button, 'click', function (event) { if (event.detail === 0) decide(choice); }); actions.append(button); return button;
    }
    const discardButton = action('discard', '丢弃', '← / A'), keepButton = action('keep', '入库', '→ / D');
    const fx = element('div', 'aso-fx'); fx.setAttribute('aria-hidden', 'true');
    game.append(hud, progress, workplace, actions, element('p', 'aso-help', '左滑丢弃 · 右滑入库 · 精标高分'), fx);
    env.host.append(game);
    let layoutSignature = '';
    function resize() {
      if (destroyed) return;
      const next = layoutForSize(env.host.clientWidth || 720, env.host.clientHeight || 480, cfg.preview);
      const signature = next.layout + ':' + next.showPreview + ':' + next.artSize + ':' + next.speakerSize;
      if (signature === layoutSignature) return;
      layoutSignature = signature; game.dataset.layout = next.layout;
      game.dataset.art = next.artSize < 28 ? 'none' : 'visible';
      game.style.setProperty('--aso-art-size', next.artSize + 'px');
      game.style.setProperty('--aso-speaker-size', next.speakerSize + 'px');
      belt.classList.toggle('no-preview', !next.showPreview);
      previews.hidden = !next.showPreview;
    }
    if (typeof root.ResizeObserver === 'function') {
      const observer = new root.ResizeObserver(resize); observer.observe(env.host);
      cleanups.push(function () { observer.disconnect(); });
    } else listen(root, 'resize', resize);
    resize();
    function ricePhase(phase, text) {
      talk.dataset.reaction = phase;
      const visible = phase === 'tasty' ? 'idle' : phase;
      Object.keys(riceArt).forEach(function (key) { riceArt[key].hidden = key !== visible; });
      mood.textContent = phase === 'tasty' ? '✦' : phase === 'yue' ? '呃…' : '';
      const canTalk = !root.GameUI || typeof root.GameUI.whaleCanTalk !== 'function' || root.GameUI.whaleCanTalk();
      speech.textContent = canTalk ? text : phase === 'tasty' ? '咕嘎～（好吃！）' : phase === 'yue' ? '呜……（好难吃）' : phase === 'bite' ? '啊呜……' : '咕嘎……';
      if (phase !== 'idle') { bubbleUntil = elapsed + 1600; voice.dataset.bubble = 'show'; voice.dataset.pop = ++bubbleSerial % 2 ? 'b' : 'a'; }
    }
    function resetReaction() { reaction = null; ricePhase('idle', speech.textContent); }
    function eatRice(outcome) {
      // One state on the game clock: a new decision replaces the previous bite,
      // so rapid input never queues old reactions or outlives this round.
      reaction = { valid: outcome.valid, biteUntil: elapsed + 220, until: elapsed + 1500, reacted: false };
      speaker.dataset.take = ++reactionSerial % 2 ? 'a' : 'b'; ricePhase('bite', '啊呜……');
      sound('rice_bite', .30);
    }
    function updateReaction() {
      if (bubbleUntil && elapsed >= bubbleUntil - 240) voice.dataset.bubble = 'leave';
      if (bubbleUntil && elapsed >= bubbleUntil) { bubbleUntil = 0; voice.dataset.bubble = 'hidden'; }
      if (!reaction) return;
      if (elapsed >= reaction.until) { resetReaction(); return; }
      if (!reaction.reacted && elapsed >= reaction.biteUntil) {
        reaction.reacted = true;
        ricePhase(reaction.valid ? 'tasty' : 'yue', reaction.valid ? '好吃！' : '好难吃……');
        if (!reaction.valid) sound('rice_yue', .25);
      }
    }
    function availability() {
      const enabled = running && current && !current.pending && !current.done && !destroyed && !ended;
      discardButton.disabled = keepButton.disabled = !enabled;
      if (current) current.node.setAttribute('aria-disabled', String(!enabled));
    }
    function clearDrag() {
      if (drag && drag.target) {
        const node = drag.target.node;
        node.classList.remove('is-grabbed'); node.style.transform = ''; delete node.dataset.intent;
      }
      drag = null; discardButton.classList.remove('is-target'); keepButton.classList.remove('is-target');
    }
    function effect(node, lifetime) {
      fx.append(node); effects.push({ node: node, until: elapsed + lifetime });
      // Fast keyboard input can outpace an animation. Bound decoration without
      // throttling actions or throwing away a card that has not been judged.
      while (effects.length > 36) effects.shift().node.remove();
    }
    function clearEffects() { effects.splice(0).forEach(function (item) { item.node.remove(); }); }
    function pulse(node) { node.dataset.pulse = ++effectSerial % 2 ? 'a' : 'b'; }
    function feedbackEffects(target, choice, outcome) {
      const rect = game.getBoundingClientRect(), cardRect = target.node.getBoundingClientRect();
      const button = choice === 'keep' ? keepButton : discardButton, buttonRect = button.getBoundingClientRect();
      const scale = rect.width && game.clientWidth ? rect.width / game.clientWidth : 1;
      const x = (cardRect.left + cardRect.width / 2 - rect.left) / scale;
      const y = (cardRect.top + cardRect.height / 2 - rect.top) / scale;
      const bx = (buttonRect.left + buttonRect.width / 2 - rect.left) / scale;
      const by = (buttonRect.top + buttonRect.height / 2 - rect.top) / scale;
      const width = target.node.offsetWidth || cardRect.width / scale || 200;
      const height = target.node.offsetHeight || cardRect.height / scale || 160;
      const rotation = drag ? clamp((drag.dx || 0) / 14, -10, 10) : 0;
      clearDrag();
      const node = target.node;
      node.classList.remove('is-arriving', 'is-grabbed'); node.classList.add('is-leaving', 'is-flight');
      node.classList.toggle('is-wrong', !outcome.valid);
      node.setAttribute('aria-hidden', 'true'); node.dataset.intent = choice;
      node.querySelector('.aso-decision').textContent = choice === 'keep' ? '入库' : '丢弃';
      Object.assign(node.style, { left: (x - width / 2) + 'px', top: (y - height / 2) + 'px', width: width + 'px', height: height + 'px' });
      node.style.setProperty('--flight-start', rotation + 'deg');
      node.style.setProperty('--flight-x', (bx - x) + 'px'); node.style.setProperty('--flight-y', (by - y) + 'px');
      node.style.setProperty('--flight-turn', choice === 'keep' ? '16deg' : '-16deg');
      effect(node, 310); pulse(button); pulse(feedback);
      const label = outcome.missed ? '漏卡' : (outcome.valid ? '+' : '') + outcome.points;
      const pop = element('span', 'aso-score-pop' + (!outcome.valid ? ' is-error' : outcome.gold ? ' is-gold' : ''), label);
      pop.style.left = bx + 'px'; pop.style.top = (by - buttonRect.height / scale / 2 - 8) + 'px'; effect(pop, 540);
      if (!outcome.missed) for (let i = 0; i < (outcome.gold ? 8 : 4); i++) {
        const spark = element('i', 'aso-spark' + (!outcome.valid ? ' is-error' : outcome.gold ? ' is-gold' : ''));
        const angle = Math.PI * (1.12 + i / (outcome.gold ? 9 : 5) * .76);
        spark.style.left = bx + 'px'; spark.style.top = (by - buttonRect.height / scale / 2) + 'px';
        spark.style.setProperty('--spark-x', (Math.cos(angle) * 38) + 'px'); spark.style.setProperty('--spark-y', (Math.sin(angle) * 36) + 'px'); effect(spark, 480);
      }
    }
    function renderHud() {
      const seconds = Math.max(0, Math.ceil((duration - elapsed) / 1000)), signature = state.score + ':' + state.combo + ':' + seconds;
      if (lastHud !== signature) {
        scoreValue.textContent = String(state.score); comboValue.textContent = state.combo + ' · ×' + comboMultiplier(state.combo).toFixed(1);
        timeValue.textContent = seconds + ' 秒'; lastHud = signature;
      }
      progressFill.style.transform = 'scaleX(' + clamp((duration - elapsed) / duration, 0, 1) + ')';
      if (current && !current.pending && !current.done) current.timer.style.transform = 'scaleX(' + clamp((current.expires - elapsed) / cfg.windowMs, 0, 1) + ')';
    }
    function chooseCard() {
      if (!cards.length) return null;
      const roll = random(); let type;
      if (roll < cfg.trap && buckets.trap && buckets.trap.length) type = 'trap';
      else if (roll >= cfg.trap && roll < cfg.trap + goldChance && buckets.gold && buckets.gold.length) type = 'gold';
      else if (roll >= cfg.trap + goldChance && roll < cfg.trap + goldChance + rivalChance && rivals.length) {
        const rival = pick(rivals);
        return { type: 'rival', text: rival.name + '的开源数据集', img: rival.img, rival: { name: rival.name, img: rival.img } };
      } else type = random() < 0.5 ? 'good' : 'junk';
      const list = buckets[type] || cards.filter(function (card) { return card.type !== 'trap' || cfg.trap > 0; });
      return list.length ? Object.assign({}, pick(list)) : null;
    }
    function prepareCard() {
      const target = chooseCard(); if (!target) return null;
      target.pending = true; target.pendingUntil = elapsed + PENDING_MS;
      const node = element('div', 'aso-card is-pending' + (target.type === 'gold' ? ' is-gold' : ''));
      node.classList.toggle('is-long', Array.from(target.text).length >= 42);
      target.node = node; node.dataset.type = target.type; node.setAttribute('role', 'group'); node.setAttribute('aria-label', '待显示语料卡'); node.title = target.text;
      const info = element('div', 'aso-card-content'), timerTrack = element('div', 'aso-window'), timer = element('i'); target.timer = timer;
      timerTrack.setAttribute('aria-hidden', 'true'); timerTrack.append(timer);
      function ready() {
        if (destroyed || target.cancelled || !target.pending) return;
        target.pending = false; node.classList.remove('is-pending'); node.setAttribute('aria-label', target.text);
        if (target === current) { target.expires = elapsed + cfg.windowMs; availability(); }
      }
      info.append(env.sprite(target.img, '语料图标', 'aso-card-art', ready), element('span', 'aso-card-label', target.type === 'gold' ? '金色精标 · 入库 +30' : '当前语料'),
        element('p', 'aso-card-text', target.text)); node.append(info, timerTrack, element('span', 'aso-decision'));
      if (env.sprite.length < 4) ready();
      return target;
    }
    function fillQueue() {
      while (queue.length < cfg.preview + 1) { const target = prepareCard(); if (!target) break; queue.push(target); }
    }
    function showQueue() {
      current = queue[0] || null; active.replaceChildren(); previews.replaceChildren();
      queue.forEach(function (target, index) {
        target.node.classList.toggle('is-current', index === 0); target.node.classList.toggle('is-preview', index !== 0);
        target.node.classList.toggle('is-arriving', index === 0);
        (index ? previews : active).append(target.node);
      });
      if (current && !current.pending) current.expires = elapsed + cfg.windowMs;
      empty.hidden = !!current; availability();
    }
    function nextCard(keepFlight) {
      clearDrag();
      if (queue.length) { const retired = queue.shift(); retired.cancelled = true; if (!keepFlight) retired.node.remove(); }
      fillQueue(); showQueue();
    }
    function decide(choice) {
      if (!running || destroyed || ended || !current || current.pending || current.done) return;
      const outcome = sortCard(state, current, choice); if (!outcome.finished) return;
      feedback.textContent = outcome.valid ? '+' + outcome.points : '分错 −15';
      feedback.classList.toggle('is-error', !outcome.valid);
      if (!outcome.valid) {
        try { if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(30); } catch (_) {}
      }
      sound('sort_swipe', .28);
      sound(!outcome.valid ? 'sort_wrong' : outcome.gold ? 'sort_gold' : 'sort_correct', !outcome.valid ? .36 : outcome.gold ? .46 : .40);
      eatRice(outcome);
      feedbackEffects(current, choice, outcome); nextCard(true); renderHud();
    }
    function finish() {
      if (ended || destroyed) return; ended = true; running = false; clearDrag(); clearEffects(); resetReaction(); root.cancelAnimationFrame(raf); raf = 0; availability();
      env.finish({ kind: 'sort', score: state.score, grade: gradeForScore(state.score, cfg.difficulty, config), accuracy: accuracy(state),
        maxCombo: state.maxCombo, hits: state.hits, misses: state.misses, misHits: state.misHits, bonusSeconds: state.bonusSeconds, aborted: false });
    }
    function frame(timestamp) {
      if (!running || destroyed || ended) return;
      if (previous != null) elapsed += Math.max(0, timestamp - previous); previous = timestamp;
      if (elapsed >= duration) { renderHud(); finish(); return; }
      for (let i = effects.length - 1; i >= 0; i--) if (elapsed >= effects[i].until) { effects[i].node.remove(); effects.splice(i, 1); }
      updateReaction();
      if (current && current.pending && elapsed >= current.pendingUntil) nextCard(); // Quietly remove unseen cards; no missed-card penalty.
      else if (current && !current.pending && !current.done && elapsed >= current.expires) {
        missCard(state, current); feedback.textContent = '漏卡 · 连击归零'; feedback.classList.remove('is-error');
        sound('sort_miss', .24); feedbackEffects(current, 'discard', { valid: false, points: 0, missed: true }); nextCard(true);
      }
      renderHud(); raf = root.requestAnimationFrame(frame);
    }
    listen(doc, 'keydown', function (event) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target && event.target.tagName; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (event.target && event.target.isContentEditable)) return;
      const key = String(event.key || '').toLowerCase(), choice = ['arrowleft', 'a'].includes(key) ? 'discard' : ['arrowright', 'd'].includes(key) ? 'keep' : '';
      if (choice && running) { event.preventDefault(); decide(choice); }
    });
    listen(active, 'pointerdown', function (event) {
      if (!running || !current || current.pending || current.done || (event.button != null && event.button !== 0)) return;
      if (drag || event.isPrimary === false) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, target: current, dx: 0 };
      current.node.classList.remove('is-arriving'); current.node.classList.add('is-grabbed');
      current.node.style.transform = 'translateY(-3px) scale(1.015)'; sound('sort_grab', .18);
      if (active.setPointerCapture && event.pointerId != null) { try { active.setPointerCapture(event.pointerId); } catch (_) {} }
    });
    listen(active, 'pointermove', function (event) {
      if (!drag || drag.id !== event.pointerId || drag.target !== current || !running) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      // Preserve vertical scrolling for unusually long cards. Only a horizontal
      // gesture takes ownership; native pointercancel restores a grabbed card.
      if (!drag.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) { clearDrag(); return; }
      if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) drag.horizontal = true;
      if (!drag.horizontal) return;
      event.preventDefault(); drag.dx = dx;
      const limit = Math.max(80, Math.min(180, active.clientWidth * .48 || 120));
      current.node.style.transform = 'translate(' + clamp(dx, -limit, limit) + 'px,' + clamp(dy * .16 - 3, -18, 12) + 'px) rotate(' + clamp(dx / 14, -10, 10) + 'deg) scale(1.015)';
      const intent = Math.abs(dx) >= 18 ? (dx > 0 ? 'keep' : 'discard') : '';
      if (intent) current.node.dataset.intent = intent; else delete current.node.dataset.intent;
      current.node.querySelector('.aso-decision').textContent = intent === 'keep' ? '入库' : '丢弃';
      discardButton.classList.toggle('is-target', intent === 'discard'); keepButton.classList.toggle('is-target', intent === 'keep');
    }, { passive: false });
    listen(active, 'pointerup', function (event) {
      const start = drag; if (!start || start.id !== event.pointerId || start.target !== current) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.2) { event.preventDefault(); decide(dx > 0 ? 'keep' : 'discard'); }
      else clearDrag();
    });
    listen(active, 'pointercancel', clearDrag);
    listen(active, 'lostpointercapture', clearDrag);
    listen(doc, 'visibilitychange', function () { if (doc.hidden) pause(); });
    function pause() { running = false; previous = null; clearDrag(); clearEffects(); resetReaction(); bubbleUntil = 0; voice.dataset.bubble = 'hidden'; root.cancelAnimationFrame(raf); raf = 0; availability(); }
    function destroy() {
      if (destroyed) return; destroyed = true; pause(); cleanups.splice(0).reverse().forEach(function (fn) { fn(); });
      queue.forEach(function (target) { target.cancelled = true; target.node.remove(); }); queue.length = 0; current = null; game.remove();
    }
    renderHud(); availability(); if (env.onCleanup) env.onCleanup(destroy);
    return { start: function () {
      if (started || destroyed) return; started = true; running = true; previous = null; fillQueue(); showQueue(); raf = root.requestAnimationFrame(frame);
    }, pause: pause, resume: function () {
      if (!started || running || destroyed || ended || doc.hidden) return;
      running = true; previous = null; availability(); raf = root.requestAnimationFrame(frame);
    }, destroy: destroy };
  }
  return { LEVELS: LEVELS, POINTS: POINTS, difficultyConfig: difficultyConfig, comboMultiplier: comboMultiplier,
    createScoreState: createScoreState, sortCard: sortCard, missCard: missCard, expectedChoice: expectedChoice, accuracy: accuracy,
    gradeForScore: gradeForScore, assets: assets,
    layoutForSize: layoutForSize,
    game: { title: '语料分拣', assets: assets,
      rules: ['30 秒分拣语料：好语料入库、垃圾和陷阱丢弃。分对 +10，陷阱 +15；金边精标入库 +30。',
        '连击最多 ×2；分错 −15 并断连击，漏卡只断连击。对手送来的开源数据集也是好语料！'],
      controls: '左边丢弃 / 右边入库 · 卡片左滑 / 右滑 · 键盘 ← / A 丢弃，→ / D 入库', create: create }
  };
});
