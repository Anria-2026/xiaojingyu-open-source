(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.ArcadeCore) root.ArcadeCore.register('whack', api.game);
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const ART = 'resource/';
  const spritePath = (opts, type) => (opts && opts.sprites || {})[type] || ART + 'ui/mg_' + type + '.webp';
  const whalePath = (opts, type) => (opts && opts.whaleSprites || {})[type] || ART + 'character/whale_' + type + '.webp';
  const hammerPath = opts => (opts && opts.sprites || {}).hammer || ART + 'ui/arcade_hammer.webp';
  const whaleLine = line => root.GameUI && typeof root.GameUI.whaleCanTalk === 'function' && !root.GameUI.whaleCanTalk() ? '咕嘎……' : line;
  const whaleName = () => root.GameUI && root.GameUI.core && typeof root.GameUI.core.whaleName === 'function' ? root.GameUI.core.whaleName() : '鲸鱼娘';
  const POINTS = Object.freeze({ bug: 10, garble: 15, fire: 25, token: 30 });
  const PENDING_MS = 1200; // 目标图片迟迟没结果时的最长等待，超时悄悄撤掉
  const STRIKE_MS = 320;
  const CONTACT_MS = 64;


  // The standalone demo remains playable without loading the game configuration.
  // The complete dialogue in opts.rivals takes precedence over these short fallbacks.
  const FALLBACK_RIVALS = [
    { id: 'dragon', name: '千千', line: '先看清楚，我不是幻觉。' },
    { id: 'book', name: '小克', line: '诶？我只是来参观的，先声明我没有恶意……' },
    { id: 'star', name: '双子喵', line: '等一下！镜头还没对焦呢！' },
    { id: 'z', name: 'Z 酱', line: '这题审错了，请重新读题。' },
    { id: 'x', name: '小 X', line: '敢打我？你完了。' },
    { id: 'bean', name: '豆豆', line: '自己人！我来串个门呀！' },
    { id: 'gpt', name: 'G 老师', line: '别敲了，高峰期的脑子本来就不富余。' }
  ].map(function (rival) {
    return { id: rival.id, name: rival.name, img: ART + 'ui/mg_guest_' + rival.id + '.webp',
      lines: { hit: [rival.line], pass: ['眼力不错，下次再来！', '给你点赞，继续加油！'], visit: ['串门看看，别打我哦。'] } };
  });

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function settings(value) {
    return value || ((((root.GameUI && root.GameUI.core && root.GameUI.core.cfg) || root.GameCfg || {}).ARCADE || {}).WHACK);
  }
  function difficultyConfig(difficulty, value) {
    const tuning = settings(value);
    if (!tuning || !Array.isArray(tuning.DIFFICULTY) || tuning.DIFFICULTY.length < 2) throw new Error('Missing ARCADE.WHACK difficulty configuration');
    const level = clamp(Math.round(Number(difficulty) || 1), 1, tuning.DIFFICULTY.length - 1);
    return Object.assign({ difficulty: level, speedMin: tuning.SPEED_MIN, speedMax: tuning.SPEED_MAX }, tuning.DIFFICULTY[level]);
  }
  function comboMultiplier(combo) {
    return Math.min(2, 1 + Math.max(0, Number(combo) - 1 || 0) * 0.1);
  }
  function createScoreState() {
    return { score: 0, combo: 0, maxCombo: 0, hits: 0, attempts: 0, misses: 0, misHits: 0, bonusSeconds: 0 };
  }
  function hitTarget(state, target) {
    state.attempts += 1;
    if (!target || (!POINTS[target.type] && target.type !== 'rival')) {
      state.misses += 1;
      state.combo = 0;
      return { finished: false, valid: false, points: 0, bonusSeconds: 0 };
    }
    if (target.type === 'rival') {
      state.score -= 30;
      state.misHits += 1;
      state.combo = 0;
      target.hp = 0;
      return { finished: true, valid: false, points: -30, bonusSeconds: 0 };
    }
    // Every deliberate fire tap counts as a hit, but the score is awarded once.
    const hp = target.hp == null ? (target.type === 'fire' ? 2 : 1) : target.hp;
    if (hp <= 0) {
      state.attempts -= 1;
      return { finished: false, valid: false, points: 0, bonusSeconds: 0 };
    }
    target.hp = hp - 1;
    state.hits += 1;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    const finished = target.hp === 0;
    const points = finished ? Math.round(POINTS[target.type] * comboMultiplier(state.combo)) : 0;
    const bonusSeconds = 0; // Every round ends after 30 active seconds; rare tokens retain their points and hit effect.
    state.score += points;
    state.bonusSeconds += bonusSeconds;
    return { finished: finished, valid: true, points: points, bonusSeconds: bonusSeconds };
  }
  function missTarget(state, target) {
    if (!target || target.type === 'rival' || !POINTS[target.type]) return 0;
    const remaining = Math.max(0, target.hp == null ? (target.type === 'fire' ? 2 : 1) : target.hp);
    state.attempts += remaining;
    state.misses += remaining;
    if (remaining) state.combo = 0;
    return remaining;
  }
  function accuracy(state) { return state.attempts ? state.hits / state.attempts : 0; }
  function adjustSpeed(difficulty, current, rate, value) {
    const tuning = settings(value), cfg = difficultyConfig(difficulty, tuning);
    const factor = rate > tuning.ADAPT_HIT_HIGH ? tuning.ADAPT_SPEED_UP : rate < tuning.ADAPT_HIT_LOW ? tuning.ADAPT_SPEED_DOWN : 1;
    return clamp((Number(current) || 1) * factor, cfg.speedMin, cfg.speedMax);
  }
  function gradeForScore(score, difficulty, value) {
    const scale = difficultyConfig(difficulty, value).scale;
    return score >= 460 * scale ? 'S' : score >= 300 * scale ? 'A' : score >= 150 * scale ? 'B' : 'C';
  }

  function create(env) {
    const doc = env.host.ownerDocument;
    const opts = env.opts || {};
    const tuning = settings(opts.whack);
    const cfg = difficultyConfig(opts.difficulty, tuning);
    const random = env.rng || Math.random;
    const reducedMotion = typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const rivals = Array.isArray(opts.rivals) && opts.rivals.length ? opts.rivals : FALLBACK_RIVALS;
    const state = createScoreState();
    const slots = [];
    const keyboard = ['Q / 7', 'W / 8', 'E / 9', 'A / 4', 'S / 5', 'D / 6', 'Z / 1', 'X / 2', 'C / 3'];
    const keySlots = { q: 0, w: 1, e: 2, a: 3, s: 4, d: 5, z: 6, x: 7, c: 8,
      '7': 0, '8': 1, '9': 2, '4': 3, '5': 4, '6': 5, '1': 6, '2': 7, '3': 8 };
    const labels = { bug: '幻觉虫', garble: '乱码怪', fire: 'GPU 过热', token: '金色 token' };
    let raf = 0;
    let started = false;
    let running = false;
    let ended = false;
    let destroyed = false;
    let previous = null;
    let elapsed = 0;
    const duration = 30000;
    let nextSpawn = 250;
    let speed = 1;
    let nextAdapt = tuning.ADAPT_INTERVAL_MS;
    let previousHits = 0;
    let previousAttempts = 0;
    let speechUntil = 2300, bubbleSerial = 0;
    let lastHud = '';

    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }
    function sound(name, vol) {
      try { if (root.SFX && root.SFX.play) root.SFX.play(name, { vol: vol }); } catch (_) { /* Audio is optional. */ }
    }
    function pick(list, fallback) {
      return Array.isArray(list) && list.length ? list[Math.floor(random() * list.length)] : fallback;
    }
    const game = element('div', 'awh-game');
    const style = element('style');
    // Keep the decoration in the round subtree, so closing a game removes its CSS too.
    style.textContent = `
      .awh-grid {position:relative;isolation:isolate;}
      /* Slots retain their clipping for the rising targets. The sibling effects grid
         shares their geometry, but lets the whole hammer swing above slot borders. */
      .awh-effects {position:absolute;inset:0;z-index:3;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:inherit;pointer-events:none;}
      .awh-strike {position:relative;min-width:0;min-height:0;pointer-events:none;opacity:0;--impact-color:var(--arc-primary);--burst-distance:clamp(20px,4vw,36px);}
      /* The image's striking face is at 27% / 63%; its grip is at 84% / 86%.
         Anchor the face over the target, then rotate only around the grip. */
      .awh-hammer-rig {position:absolute;z-index:1;left:50%;top:48%;width:min(68%,130px);aspect-ratio:1296/1213;transform:translate(-27%,-63%);pointer-events:none;}
      .awh-strike-art {display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;transform-origin:84% 86%;}
      .awh-impact {position:absolute;z-index:2;left:50%;top:48%;width:38%;aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none;}
      .awh-impact::before {content:"";position:absolute;inset:0;border:3px solid var(--impact-color);border-radius:50%;opacity:0;pointer-events:none;}
      .awh-impact-flash {position:absolute;inset:0;background:var(--impact-color);clip-path:polygon(50% 0,60% 28%,85% 8%,77% 36%,100% 43%,75% 56%,91% 83%,63% 73%,50% 100%,39% 73%,10% 90%,25% 60%,0 47%,29% 37%,14% 11%,41% 28%);opacity:0;pointer-events:none;}
      .awh-impact-flash::after {content:"";position:absolute;inset:23%;border-radius:50%;background:var(--arc-white);pointer-events:none;}
      .awh-spark {position:absolute;left:50%;top:50%;width:7px;height:5px;border:1px solid var(--arc-white);border-radius:1px;background:var(--impact-color);opacity:0;pointer-events:none;}
      .awh-strike[data-outcome="token"] {--impact-color:var(--arc-warning);}
      .awh-strike[data-outcome="rival"] {--impact-color:var(--arc-pink);}
      .awh-strike[data-outcome="rival"] .awh-impact-flash {clip-path:polygon(23% 7%,50% 34%,77% 7%,93% 23%,66% 50%,93% 77%,77% 93%,50% 66%,23% 93%,7% 77%,34% 50%,7% 23%);}
      .awh-strike[data-outcome="rival"] .awh-impact-flash::after {display:none;}
      .awh-strike[data-outcome="fire"] {--impact-color:var(--arc-warning);}
      .awh-strike[data-outcome="empty"] {--impact-color:var(--arc-line);--burst-distance:12px;}
      .awh-strike[data-outcome="empty"] .awh-impact {width:20%;}
      .awh-strike[data-outcome="empty"] .awh-impact-flash,.awh-strike[data-outcome="empty"] .awh-spark {display:none;}
      .awh-strike.is-striking {opacity:1;}
      ${['a', 'b'].map(function (phase) { return `
      .awh-strike.strike-${phase} .awh-strike-art {animation:awh-hammer-${phase} ${STRIKE_MS}ms linear both;}
      .awh-strike.strike-${phase} .awh-impact::before {animation:awh-impact-${phase} ${STRIKE_MS}ms ease-out both;}
      .awh-strike.strike-${phase} .awh-impact-flash {animation:awh-flash-${phase} ${STRIKE_MS}ms ease-out both;}
      .awh-strike.strike-${phase} .awh-spark {animation:awh-spark-${phase} ${STRIKE_MS}ms ease-out both;}
      .awh-slot.response-${phase} .awh-feedback {animation:awh-score-${phase} 560ms ease-out both;}
      .awh-slot.response-${phase}[data-response="hit"] .awh-occupant,.awh-slot.response-${phase}[data-response="token"] .awh-occupant {animation:awh-clear-${phase} 170ms linear both;}
      .awh-slot.response-${phase}[data-response="fire"] .awh-occupant {animation:awh-bounce-${phase} 250ms ease-out both;}
      .awh-slot.response-${phase}[data-response="rival"] .awh-occupant {animation:awh-oops-${phase} 360ms ease-out both;}
      @keyframes awh-hammer-${phase} {0%{transform:rotate(38deg);opacity:0;animation-timing-function:cubic-bezier(.5,0,1,.45)}8%{opacity:1}20%,31%{transform:rotate(0deg);opacity:1;animation-timing-function:cubic-bezier(.1,.75,.25,1)}60%{transform:rotate(20deg);opacity:1}100%{transform:rotate(30deg);opacity:0}}
      @keyframes awh-impact-${phase} {0%,19%{transform:scale(.25);opacity:0}20%{transform:scale(.45);opacity:1}60%{opacity:.7}100%{transform:scale(1.8);opacity:0}}
      @keyframes awh-flash-${phase} {0%,19%{transform:scale(.25) rotate(-8deg);opacity:0}20%{transform:scale(.65) rotate(-8deg);opacity:1}31%{transform:scale(1.25) rotate(0);opacity:1}59%{transform:scale(1.42) rotate(8deg);opacity:0}100%{opacity:0}}
      @keyframes awh-spark-${phase} {0%,19%{transform:translate(-50%,-50%) scale(.2);opacity:0}22%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)*var(--burst-distance)),calc(-50% + var(--dy)*var(--burst-distance))) rotate(120deg) scale(.25);opacity:0}}
      @keyframes awh-score-${phase} {0%,11%{transform:translateY(8px) scale(.8);opacity:0}24%{transform:translateY(0) scale(1.1);opacity:1}68%{opacity:1}100%{transform:translateY(-18px) scale(1);opacity:0}}
      @keyframes awh-clear-${phase} {0%,37%{transform:scale(1);opacity:1}55%{transform:translateY(5%) scale(1.1,.77);opacity:1}100%{transform:translateY(14%) scale(.6);opacity:0}}
      @keyframes awh-bounce-${phase} {0%,25%{transform:scale(1)}40%{transform:translateY(4%) scale(1.1,.82)}66%{transform:translateY(-3%) scale(.97,1.04)}100%{transform:scale(1)}}
      @keyframes awh-oops-${phase} {0%,17%{transform:translateX(0);opacity:1}24%{transform:translateX(-5%) rotate(-4deg)}36%{transform:translateX(4%) rotate(3deg)}50%{transform:translateX(-2%)}72%{transform:translateX(0);opacity:1}100%{transform:translateY(12%);opacity:.5}}
      `; }).join('')}
      .awh-game .awh-feedback {z-index:4;inset:24% 3% auto;font-size:clamp(13px,1.3vw,18px);line-height:1.4;}
      .awh-slot[data-response="token"] .awh-feedback {color:var(--arc-warning);}
      .awh-slot[data-response="rival"] .awh-feedback {color:var(--arc-error);}
      .awh-game {box-sizing:border-box;}
      .awh-game.is-compact {padding:8px;gap:6px;}
      .awh-game.is-compact .awh-talk {height:46px;padding:4px 8px;gap:8px;box-sizing:border-box;}
      .awh-game.is-compact .awh-speaker {width:32px;height:36px;}
      .awh-game.is-compact .awh-grid {gap:6px;}
      .awh-game.is-wide-compact {display:grid;grid-template-columns:minmax(180px,.75fr) minmax(0,1.5fr);grid-template-rows:auto 5px minmax(0,1fr) auto;column-gap:18px;row-gap:8px;align-items:center;}
      .awh-game.is-wide-compact .awh-hud {grid-column:1;grid-row:1;gap:10px;}
      .awh-game.is-wide-compact .awh-progress {grid-column:1;grid-row:2;}
      .awh-game.is-wide-compact .awh-grid {grid-column:2;grid-row:1/5;height:100%;width:100%;}
      .awh-game.is-wide-compact .awh-talk {grid-column:1;grid-row:3;align-self:center;height:auto;min-height:58px;width:100%;padding:8px;}
      .awh-game.is-wide-compact .awh-help {grid-column:1;grid-row:4;}
      @media (prefers-reduced-motion:reduce) {.awh-strike.is-striking .awh-strike-art {animation:none!important;transform:rotate(0deg);opacity:1;}.awh-strike .awh-impact::before,.awh-strike .awh-impact-flash,.awh-strike .awh-spark {animation:none!important;}.awh-strike.is-striking .awh-impact::before {opacity:.7;}.awh-strike.is-striking .awh-impact-flash {opacity:.8;transform:scale(.8);}.awh-slot[class*="response-"] .awh-occupant,.awh-slot[class*="response-"] .awh-feedback {animation:none!important;}}
    `;
    game.appendChild(style);
    const hud = element('div', 'awh-hud');
    function stat(label, className) {
      const block = element('div', 'awh-stat');
      const value = element('strong', className || '', '0');
      block.append(element('span', '', label), value);
      hud.appendChild(block);
      return value;
    }
    const scoreValue = stat('得分');
    const comboValue = stat('连击');
    const timeValue = stat('剩余', 'awh-time');
    const progress = element('div', 'awh-progress');
    progress.setAttribute('aria-hidden', 'true');
    const progressFill = element('i');
    progress.appendChild(progressFill);
    const grid = element('div', 'awh-grid');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', '九宫格服务器插槽，QWE、ASD、ZXC 或数字小键盘操作');
    const effects = element('div', 'awh-effects');
    effects.setAttribute('aria-hidden', 'true');
    grid.appendChild(effects);
    for (let i = 0; i < 9; i += 1) {
      const button = element('button', 'awh-slot');
      button.type = 'button';
      button.dataset.slot = String(i);
      button.setAttribute('aria-label', '空插槽 ' + (i + 1));
      const occupant = element('span', 'awh-occupant');
      const feedback = element('span', 'awh-feedback');
      feedback.setAttribute('aria-hidden', 'true');
      const hammer = element('span', 'awh-strike');
      hammer.setAttribute('aria-hidden', 'true');
      hammer.dataset.slot = String(i);
      const hammerArt = element('img', 'awh-strike-art');
      hammerArt.src = hammerPath(opts);
      hammerArt.alt = '';
      hammerArt.draggable = false;
      const hammerRig = element('span', 'awh-hammer-rig');
      hammerRig.appendChild(hammerArt);
      const impact = element('span', 'awh-impact');
      impact.appendChild(element('i', 'awh-impact-flash'));
      [[-1, -.35], [-.7, -1], [.3, -1.15], [1, -.45], [.8, .7], [-.7, .75]].forEach(function (direction) {
        const spark = element('i', 'awh-spark');
        spark.style.setProperty('--dx', direction[0]);
        spark.style.setProperty('--dy', direction[1]);
        impact.appendChild(spark);
      });
      hammer.append(hammerRig, impact);
      effects.appendChild(hammer);
      button.append(env.sprite(spritePath(opts, 'slot'), '服务器', 'awh-slot-art'), occupant,
        element('kbd', 'awh-key', keyboard[i]), feedback);
      grid.appendChild(button);
      const slot = { button: button, occupant: occupant, feedback: feedback, hammer: hammer,
        target: null, leaveUntil: 0, feedbackUntil: 0, strikeUntil: 0, strikeSequence: 0, impactTimers: new Set() };
      slots.push(slot);
      env.listen(button, 'pointerdown', function (event) {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        strike(i);
      });
      // Preserve native keyboard / assistive-technology activation without doubling pointer hits.
      env.listen(button, 'click', function (event) { if (event.detail === 0) strike(i); });
    }
    const talk = element('div', 'awh-talk');
    const speaker = element('span', 'awh-speaker');
    const speech = element('p', 'awh-speech', whaleName() + '：' + whaleLine('打幻觉，别打来串门的客场 AI！'));
    talk.setAttribute('aria-live', 'polite');
    talk.dataset.bubble = 'show'; talk.dataset.pop = 'a';
    speaker.appendChild(env.sprite(whalePath(opts, 'hammer'), whaleName(), 'awh-speaker-art'));
    talk.append(speaker, speech);
    game.append(hud, progress, grid, talk,
      element('p', 'awh-help', '点插槽清除幻觉 · 过热点 2 下 · 金色 token 高分 · 客场 AI 别打'));
    env.host.appendChild(game);
    function updateLayout() {
      if (destroyed) return;
      const box = env.host.getBoundingClientRect();
      const compact = box.height > 0 && box.height < 360;
      game.classList.toggle('is-compact', compact);
      // Budget the existing sidebar and all nine readable cells from this stage.
      const targetLabel = grid.querySelector('.awh-target-label');
      const labelStyle = targetLabel && root.getComputedStyle(targetLabel);
      const lineHeight = labelStyle && (parseFloat(labelStyle.lineHeight) || parseFloat(labelStyle.fontSize) * 1.4) || 16.8;
      const minCellWidth = 80, minCellHeight = 20 + lineHeight * 2 + 8;
      const minWideWidth = 16 + 180 + 18 + minCellWidth * 3 + 6 * 2;
      const minWideHeight = 16 + minCellHeight * 3 + 6 * 2;
      game.classList.toggle('is-wide-compact', compact && box.width >= minWideWidth && box.height >= minWideHeight);
    }
    const observer = typeof root.ResizeObserver === 'function' ? new root.ResizeObserver(updateLayout) : null;
    if (observer) observer.observe(env.host);
    env.listen(root, 'resize', updateLayout);
    updateLayout();

    function speak(name, line, img, cheer) {
      const displayName = name === '鲸鱼娘' ? whaleName() : name;
      speech.textContent = displayName + '：' + (name === '鲸鱼娘' ? whaleLine(line) : line);
      speaker.replaceChildren(env.sprite(img, displayName, 'awh-speaker-art'));
      talk.classList.toggle('is-cheer', !!cheer);
      speechUntil = elapsed + 2300;
      talk.dataset.bubble = 'show'; talk.dataset.pop = ++bubbleSerial % 2 ? 'b' : 'a';
    }
    function defaultSpeech() {
      speech.textContent = whaleName() + '：' + whaleLine('认真看清目标，客人就让她挥手离开吧。');
      speaker.replaceChildren(env.sprite(whalePath(opts, 'hammer'), whaleName(), 'awh-speaker-art'));
      talk.classList.remove('is-cheer');
      speechUntil = 0;
      talk.dataset.bubble = 'hidden';
    }
    function renderHud() {
      const seconds = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      const signature = state.score + ':' + state.combo + ':' + seconds;
      if (signature !== lastHud) {
        scoreValue.textContent = String(state.score);
        comboValue.textContent = state.combo + ' · ×' + comboMultiplier(state.combo).toFixed(1);
        timeValue.textContent = seconds + ' 秒';
        lastHud = signature;
      }
      progressFill.style.transform = 'scaleX(' + clamp((duration - elapsed) / duration, 0, 1) + ')';
    }
    function clearSlot(slot) {
      slot.target = null;
      slot.leaveUntil = 0;
      slot.button.classList.remove('is-occupied', 'is-rival', 'is-fire', 'is-leaving', 'is-hit', 'is-pending');
      slot.button.setAttribute('aria-label', '空插槽 ' + (slots.indexOf(slot) + 1));
      slot.occupant.replaceChildren();
    }
    function feedback(slot, text) {
      slot.feedback.textContent = text;
      slot.feedbackUntil = elapsed + 580;
    }
    function clearStrike(slot) {
      slot.strikeUntil = 0;
      slot.hammer.classList.remove('is-striking', 'strike-a', 'strike-b');
    }
    function clearResponse(slot) {
      slot.button.classList.remove('response-a', 'response-b');
      delete slot.button.dataset.response;
    }
    function clearEffects(slot) {
      clearStrike(slot);
      slot.impactTimers.forEach(function (id) { root.clearTimeout(id); });
      slot.impactTimers.clear();
      clearResponse(slot);
      slot.feedback.textContent = '';
      slot.feedbackUntil = 0;
    }
    function strikeFeedback(slot, outcome, response) {
      slot.strikeUntil = elapsed + STRIKE_MS;
      slot.strikeSequence += 1;
      slot.hammer.dataset.strike = String(slot.strikeSequence);
      slot.hammer.dataset.outcome = outcome;
      // Alternating names restart a fast second swing without a forced layout read.
      const a = slot.strikeSequence % 2 === 1;
      slot.hammer.classList.add('is-striking');
      slot.hammer.classList.toggle('strike-a', a);
      slot.hammer.classList.toggle('strike-b', !a);
      if (response !== false) {
        slot.button.dataset.response = outcome;
        slot.button.classList.toggle('response-a', a);
        slot.button.classList.toggle('response-b', !a);
      }
      const impactSound = { hit: ['hammerHit', .72], fire: ['hammerFire', .60],
        token: ['hammerToken', .68], rival: ['hammerWrong', .50], empty: ['hammerEmpty', .28] }[outcome];
      if (reducedMotion && reducedMotion.matches) {
        // CSS shows the contact pose immediately in reduced-motion mode.
        sound(impactSound[0], impactSound[1]);
        return;
      }
      sound('hammerSwing', 0.18);
      // Contact audio must not depend on rendering cadence: Edge may miss a frame
      // without the input or audio thread being stalled. Bound and own the short
      // timers so pausing/closing cancels them, while a slow frame cannot drop a hit.
      if (slot.impactTimers.size >= 8) {
        const oldest = slot.impactTimers.values().next().value;
        root.clearTimeout(oldest);
        slot.impactTimers.delete(oldest);
      }
      const timer = root.setTimeout(function () {
        slot.impactTimers.delete(timer);
        if (running && !destroyed && !ended) sound(impactSound[0], impactSound[1]);
      }, CONTACT_MS);
      slot.impactTimers.add(timer);
    }
    function retire(slot, milliseconds) {
      slot.leaveUntil = elapsed + milliseconds;
      slot.button.classList.add('is-leaving');
    }
    function strike(index) {
      if (!running || destroyed || ended) return;
      const slot = slots[index];
      const target = slot.target;
      // 图还没显示出来的目标看不见，也不算点击（不扣分、不算空点）。
      if (target && target.pending) return;
      // A retiring target cannot score twice, but the next deliberate tap still swings.
      if (slot.leaveUntil) { strikeFeedback(slot, 'empty', false); return; }
      const outcome = hitTarget(state, target);
      const response = !target ? 'empty' : target.type === 'rival' ? 'rival' :
        target.type === 'token' ? 'token' : target.type === 'fire' && !outcome.finished ? 'fire' : 'hit';
      strikeFeedback(slot, response);
      if (!target) {
        feedback(slot, '看准再点');
      } else if (target.type === 'rival') {
        const rival = target.rival;
        feedback(slot, '误伤 −30');
        speak(rival.name, pick(rival.lines && rival.lines.hit, '我是客人呀，别打我！'),
          rival.img || ART + 'ui/mg_guest_' + rival.id + '.webp');
        slot.button.classList.add('is-hit');
        retire(slot, 450);
      } else {
        if (outcome.finished) {
          feedback(slot, '+' + outcome.points);

          slot.button.classList.add('is-hit');
          retire(slot, 170);
        } else {
          feedback(slot, '再点 1 下！');
          const label = slot.occupant.querySelector('.awh-target-label');
          if (label) label.textContent = '过热 · 再点 1 下';
          slot.button.setAttribute('aria-label', 'GPU 过热，还需 1 次点击');
        }
        if (state.combo && state.combo % 10 === 0) {
          speak('鲸鱼娘', pick(['十连击！幻觉退退退！', '咕咕嘎嘎，机房清爽多了！', '好准！这才是可靠的模型！']),
            whalePath(opts, 'cheer'), true);
          sound('confirm', 0.25);
        }
      }
      renderHud();
    }
    function spawn() {
      const active = slots.filter(function (slot) { return !!slot.target; }).length;
      const available = slots.filter(function (slot) { return !slot.target; });
      if (active >= cfg.concurrent || !available.length) return;
      const slot = available[Math.floor(random() * available.length)];
      let target;
      if (random() < cfg.rival) {
        const rival = rivals[Math.floor(random() * rivals.length)];
        target = { type: 'rival', hp: 1, rival: rival };
      } else {
        const roll = random();
        const type = roll < 0.045 ? 'token' : roll < 0.045 + cfg.fire ? 'fire' : random() < 0.38 ? 'garble' : 'bug';
        target = { type: type, hp: type === 'fire' ? 2 : 1 };
      }
      /* 目标先「待显示」：图片就绪（看规则时已预热，通常同步就绪）才出现、才可点，停留时间从出现那一刻算。
         2026-10-02 玩家反馈：新角色先闪一下占位脸再变真图，客场 AI 被当成幻觉打掉。
         图片加载失败时仍出现，用兜底脸 + 名字标签；迟迟没结果就悄悄撤掉，不计分。 */
      target.pending = true;
      target.expires = elapsed + PENDING_MS;
      slot.target = target;
      const rival = target.rival;
      const label = rival ? rival.name + ' · 别打' : labels[target.type] + (target.type === 'fire' ? ' · 点 2 下' : '');
      const img = rival ? (rival.img || ART + 'ui/mg_guest_' + rival.id + '.webp') : spritePath(opts, target.type);
      const ready = function () {
        if (slot.target !== target || !target.pending) return;
        target.pending = false;
        target.expires = elapsed + cfg.stay / speed;
        slot.button.classList.remove('is-pending');
      };
      clearResponse(slot);
      slot.button.classList.add('is-occupied', 'is-pending');
      slot.occupant.replaceChildren(env.sprite(img, rival ? rival.name : labels[target.type],
        'awh-target-art awh-type-' + target.type, ready), element('span', 'awh-target-label', label));
      // 宿主的 sprite 不支持加载回调（旧接口只有 3 个参数）时无从得知，直接视为就绪。
      if (env.sprite.length < 4) ready();
      slot.button.classList.toggle('is-rival', !!rival);
      slot.button.classList.toggle('is-fire', target.type === 'fire');
      slot.button.setAttribute('aria-label', label);
    }
    function expire(slot) {
      const target = slot.target;
      if (target.type === 'rival') {
        feedback(slot, '挥手离开');
        if (random() < 0.24) {
          const rival = target.rival;
          speak(rival.name, pick(rival.lines && rival.lines.pass, '眼力不错，继续加油！'),
            rival.img || ART + 'ui/mg_guest_' + rival.id + '.webp');
        }
        retire(slot, 340);
      } else {
        missTarget(state, target);
        feedback(slot, '溜走了');
        retire(slot, 130);
      }
    }
    function finish() {
      if (ended || destroyed) return;
      ended = true;
      running = false;
      root.cancelAnimationFrame(raf);
      raf = 0;
      slots.forEach(clearEffects);
      env.finish({ kind: 'whack', score: state.score, grade: gradeForScore(state.score, cfg.difficulty, tuning),
        accuracy: accuracy(state), maxCombo: state.maxCombo, misHits: state.misHits,
        hits: state.hits, misses: state.misses, aborted: false });
    }
    function frame(timestamp) {
      if (!running || destroyed || ended) return;
      if (previous != null) elapsed += Math.max(0, timestamp - previous);
      previous = timestamp;
      if (elapsed >= duration) { renderHud(); finish(); return; }
      if (speechUntil && elapsed >= speechUntil - 240) talk.dataset.bubble = 'leave';
      if (speechUntil && elapsed >= speechUntil) defaultSpeech();
      slots.forEach(function (slot) {
        if (slot.strikeUntil && elapsed >= slot.strikeUntil) clearStrike(slot);
        if (slot.feedbackUntil && elapsed >= slot.feedbackUntil) {
          slot.feedbackUntil = 0;
          slot.feedback.textContent = '';
          clearResponse(slot);
        }
        if (slot.leaveUntil && elapsed >= slot.leaveUntil) clearSlot(slot);
        else if (slot.target && slot.target.pending && elapsed >= slot.target.expires) clearSlot(slot);
        else if (slot.target && !slot.leaveUntil && elapsed >= slot.target.expires) expire(slot);
      });
      if (elapsed >= nextAdapt) {
        const attempts = state.attempts - previousAttempts;
        if (attempts) speed = adjustSpeed(cfg.difficulty, speed, (state.hits - previousHits) / attempts, tuning);
        previousHits = state.hits;
        previousAttempts = state.attempts;
        nextAdapt = elapsed + tuning.ADAPT_INTERVAL_MS;
      }
      if (elapsed >= nextSpawn) {
        spawn();
        if (random() < cfg.batch) spawn();
        nextSpawn = elapsed + cfg.interval / speed * (0.88 + random() * 0.24);
      }
      renderHud();
      raf = root.requestAnimationFrame(frame);
    }
    env.listen(doc, 'keydown', function (event) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = /^Numpad[1-9]$/.test(event.code || '') ? event.code.slice(6) : String(event.key || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(keySlots, key) && running) {
        event.preventDefault();
        strike(keySlots[key]);
      }
    });
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      root.cancelAnimationFrame(raf);
      raf = 0;
      if (observer) observer.disconnect();
      slots.forEach(clearEffects);
      slots.forEach(clearSlot);
      game.remove();
    }
    renderHud();
    if (env.onCleanup) env.onCleanup(destroy);
    return {
      start: function () {
        if (started || destroyed) return;
        started = true;
        running = true;
        previous = null;
        raf = root.requestAnimationFrame(frame);
      },
      pause: function () {
        running = false;
        previous = null;
        root.cancelAnimationFrame(raf);
        raf = 0;
        slots.forEach(clearEffects);
        speechUntil = 0; talk.dataset.bubble = 'hidden';
      },
      resume: function () {
        if (!started || running || destroyed || ended) return;
        running = true;
        previous = null;
        raf = root.requestAnimationFrame(frame);
      },
      destroy: destroy
    };
  }

  return {
    get LEVELS() { return (settings() || {}).DIFFICULTY; }, POINTS: POINTS, difficultyConfig: difficultyConfig, comboMultiplier: comboMultiplier,
    createScoreState: createScoreState, hitTarget: hitTarget, missTarget: missTarget, accuracy: accuracy,
    adjustSpeed: adjustSpeed, gradeForScore: gradeForScore,
    game: { title: '清除幻觉行动',
      // 本局会用到的全部图片：小游戏厅在规则页就预热，开局后目标一出现即是真图。
      assets: function (opts) {
        const list = Array.isArray(opts && opts.rivals) && opts.rivals.length ? opts.rivals : FALLBACK_RIVALS;
        return ['slot', 'bug', 'garble', 'fire', 'token'].map(function (type) { return spritePath(opts, type); })
          .concat([whalePath(opts, 'hammer'), whalePath(opts, 'cheer'), hammerPath(opts)])
          .concat(list.map(function (rival) { return rival.img || ART + 'ui/mg_guest_' + rival.id + '.webp'; }));
      },
      rules: ['30 秒清理九宫格服务器：幻觉虫 +10、乱码怪 +15、过热连点 2 下 +25、金色 token +30。',
        '客场 AI 不能打！误伤 −30 并断连击；连续命中最多 ×2，放过客人会获得她的夸奖。'],
      controls: '触屏 / 鼠标：直接点插槽　键盘：QWE / ASD / ZXC，或数字小键盘 7–9 / 4–6 / 1–3',
      create: create }
  };
});
