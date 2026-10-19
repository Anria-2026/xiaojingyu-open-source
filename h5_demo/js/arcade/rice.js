(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.ArcadeCore) root.ArcadeCore.register('rice', api.game);
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const ART = 'resource/character/whale_rice_catch.webp';
  const whaleName = () => root.GameUI && root.GameUI.core && typeof root.GameUI.core.whaleName === 'function' ? root.GameUI.core.whaleName() : '鲸鱼娘';
  const LEVELS = Object.freeze([null,
    { interval: 760, travel: 3200, black: .15, scale: 1 },
    { interval: 650, travel: 2950, black: .18, scale: 1.15 },
    { interval: 570, travel: 2700, black: .21, scale: 1.3 },
    { interval: 500, travel: 2450, black: .24, scale: 1.45 },
    { interval: 440, travel: 2250, black: .27, scale: 1.6 }
  ].map(row => row && Object.freeze(row)));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const bounded = (v, fallback, lo, hi) => clamp(Number.isFinite(Number(v)) ? Number(v) : fallback, lo, hi);
  const artPath = opts => (opts && opts.whaleSprites || {}).riceCatch || ART;
  function settings(raw) {
    raw = raw || {}; const p = raw.points || {};
    return { durationSeconds: 30,
      points: { white: bounded(p.white, 10, 0, 100), gold: bounded(p.gold, 40, 0, 100),
        rainbow: bounded(p.rainbow, 60, 0, 100), black: bounded(p.black, -25, -100, 0) },
      magnetSeconds: bounded(raw.magnetSeconds, 5, 0, 8) };
  }
  function rulesForOptions(opts) {
    const cfg = settings(opts && opts.rice);
    const magnet = cfg.magnetSeconds ? '并开启 ' + cfg.magnetSeconds + ' 秒吸米' : '（吸米已关闭）';
    const black = cfg.points.black < 0 ? '黑米 −' + Math.abs(cfg.points.black) + ' 并清空连击' : '黑米不扣分，但会清空连击';
    return [cfg.durationSeconds + ' 秒接住天降大米：白米 +' + cfg.points.white + '，金米 +' + cfg.points.gold + '，彩米 +' + cfg.points.rainbow + ' ' + magnet + '。',
      '左右移动铁盆，躲开带叉的黑米！' + black + '，漏米不扣分，吸米只接好米。'];
  }
  function difficultyConfig(level) {
    const difficulty = Math.round(bounded(level, 1, 1, 5));
    return Object.assign({ difficulty }, LEVELS[difficulty]);
  }
  function createScoreState() {
    return { score: 0, hits: 0, misses: 0, misHits: 0, combo: 0, maxCombo: 0, bonusSeconds: 0, magnetUntil: 0 };
  }
  function catchRice(state, type, elapsed, options) {
    const cfg = settings(options);
    if (!Object.prototype.hasOwnProperty.call(cfg.points, type)) return { points: 0, bonusSeconds: 0 };
    const points = cfg.points[type]; state.score += points;
    if (type === 'black') { state.misHits++; state.combo = 0; }
    else { state.hits++; state.combo++; state.maxCombo = Math.max(state.maxCombo, state.combo); }
    let bonusSeconds = 0;
    if (type === 'rainbow') state.magnetUntil = elapsed + cfg.magnetSeconds * 1000;
    return { points, bonusSeconds };
  }
  function missRice(state, type) { if (type !== 'black') state.misses++; }
  function accuracy(state) { const n = state.hits + state.misses + state.misHits; return n ? state.hits / n : 0; }
  function gradeForScore(score, difficulty) {
    const scale = difficultyConfig(difficulty).scale;
    return score >= 530 * scale ? 'S' : score >= 360 * scale ? 'A' : score >= 180 * scale ? 'B' : 'C';
  }
  function layoutForSize(width, height) {
    const w = Math.max(180, Number(width) || 640), h = Math.max(70, Number(height) || 360);
    const figureHeight = Math.min(220, Math.max(60, h * .44), h * .74);
    const figureWidth = figureHeight * 2 / 3;
    // Source art: 1024x1536; basin mouth centered at (.50,.09), width .76.
    return { width: w, height: h, figureHeight, figureWidth, figureTop: h - figureHeight - 8,
      catchY: h - figureHeight - 8 + figureHeight * .09,
      halfBasin: figureWidth * .76 / (2 * w), edge: Math.min(.4, figureWidth / (2 * w) + .012) };
  }
  function crossedBasin(drop, oldProgress, newProgress, previousX, nextX, halfBasin, magnet) {
    if (oldProgress > 1 || newProgress < 1 || newProgress <= oldProgress) return false;
    const at = clamp((1 - oldProgress) / (newProgress - oldProgress), 0, 1);
    const catcherX = previousX + (nextX - previousX) * at;
    const radius = halfBasin * (magnet && drop.type !== 'black' ? 1.85 : 1) + .018;
    return Math.abs(drop.x - catcherX) <= radius;
  }
  function create(env) {
    const doc = env.host.ownerDocument, opts = env.opts || {}, cfg = settings(opts.rice), level = difficultyConfig(opts.difficulty);
    const random = env.rng || Math.random, state = createScoreState(), drops = [], localCleanups = [];
    let raf = 0, previous = null, elapsed = 0, started = false, running = false, destroyed = false, ended = false;
    let ready = false, loadingElapsed = 0, spawnAt = 400, playerX = .5, drag = null, held = new Set(), pulse = 0, feedbackUntil = 0, lastHud = '';
    let geometry = layoutForSize(640, 360);
    const reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    function listen(node, event, fn, options) {
      node.addEventListener(event, fn, options); localCleanups.push(() => node.removeEventListener(event, fn, options));
    }
    function sound(name, vol) { try { if (root.SFX && root.SFX.play) root.SFX.play(name, { vol }); } catch (_) {} }
    const game = el('div', 'ari-game'), style = el('style');
    style.textContent = `
      .ari-game {box-sizing:border-box;width:100%;height:100%;min-height:0;display:grid;grid-template-rows:44px 28px minmax(0,1fr) 44px 20px;gap:8px;padding:12px;color:var(--arc-ink,#1d4663);font-family:var(--font-main,sans-serif);user-select:none;touch-action:none;}
      .ari-game *,.ari-game *::before,.ari-game *::after{box-sizing:border-box;}
      .ari-hud{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
      .ari-stat{font-size:12px;line-height:17px;color:var(--arc-muted,#5b7f96);}.ari-stat:nth-child(2){text-align:center;}.ari-stat:last-child{text-align:right;}
      .ari-stat strong{display:block;font:700 22px/25px var(--font-num,Arial,sans-serif);color:var(--arc-deep,#2385b7);}
      .ari-legend{display:flex;align-items:center;justify-content:center;gap:12px;margin:0;font-size:12px;line-height:20px;white-space:nowrap;}
      .ari-legend span{display:flex;align-items:center;gap:4px;}.ari-legend .ari-grain{position:relative;inset:auto;display:inline-grid;width:15px;height:22px;font-size:11px;transform:rotate(18deg);}
      .ari-game .ari-board{position:relative;min-height:0;min-width:0;overflow:hidden!important;isolation:isolate;border:1px solid var(--arc-line,#b8e5f7);border-radius:16px;background:linear-gradient(180deg,#f2fcff 0%,#d5f3ff 66%,#c0e6f7 67%,#e9f8ff 100%);touch-action:none;}
      .ari-board::before{content:"";position:absolute;inset:18px 12% 33%;border:7px solid #fff;border-radius:12px;background:linear-gradient(90deg,transparent 49%,#fff 49% 51%,transparent 51%),linear-gradient(0deg,transparent 49%,#fff 49% 51%,transparent 51%),linear-gradient(135deg,#bde9fc,#eafbff);opacity:.65;pointer-events:none;}
      .ari-board::after{content:"";position:absolute;inset:67% 0 0;background:repeating-linear-gradient(90deg,transparent 0 68px,#b8deed66 69px 70px);pointer-events:none;z-index:-1;}
      .ari-drops{position:absolute;inset:0;z-index:2;pointer-events:none;}.ari-grain{position:absolute;left:0;top:0;display:grid;place-items:center;width:25px;height:35px;border:2px solid #7caec7;border-radius:65% 35% 60% 40%;background:#fffdf3;color:#5b7183;font:bold 18px/1 Arial;pointer-events:none;box-shadow:inset 3px 1px #fff9;}
      .ari-grain.is-gold{background:#ffe388;border-color:#ca982d;color:#9c6d00;}.ari-grain.is-rainbow{background:linear-gradient(140deg,#ffc4e4,#c6c5ff,#9cf0e8);border-color:#ac85ce;color:#76539b;}.ari-grain.is-black{background:#41546f;border-color:#213c55;color:#fff;box-shadow:inset 3px 1px #64738b;}
      .ari-catcher{position:absolute;left:0;top:0;z-index:3;pointer-events:none;}.ari-catcher-art{width:100%;height:100%;pointer-events:none;}.ari-catcher-art img{object-fit:contain;}.ari-catcher-art .arc-sprite-face{display:none;}
      .ari-fallback{position:absolute;inset:20% 13% 0;border-radius:45% 45% 18% 18%;background:linear-gradient(#87bee6 0 42%,#e4f4ff 42% 72%,#365e8c 72%);border:2px solid #46769e;}.ari-fallback::before{content:"";position:absolute;left:-10%;right:-10%;top:-20%;height:20%;border:3px solid #7595ac;border-radius:50%;background:#dceaf2;}.ari-fallback::after{content:attr(data-name);position:absolute;left:0;right:0;top:45%;font-size:12px;text-align:center;color:#245074;}
      .ari-fallback[hidden]{display:none;}.ari-catcher-art{transform-origin:50% 90%;}
      .ari-catcher.is-catching[data-pulse="a"] .ari-catcher-art{animation:ari-catch-a .22s ease-out;}.ari-catcher.is-catching[data-pulse="b"] .ari-catcher-art{animation:ari-catch-b .22s ease-out;}.ari-catcher.is-wrong[data-pulse="a"] .ari-catcher-art{animation:ari-oops-a .28s ease-out;}.ari-catcher.is-wrong[data-pulse="b"] .ari-catcher-art{animation:ari-oops-b .28s ease-out;}
      .ari-spark{position:absolute;left:50%;top:9%;width:6px;height:7px;border:1px solid #fff;background:#55bdeb;border-radius:2px;opacity:0;pointer-events:none;}.ari-catcher[data-rice="gold"] .ari-spark{background:#ecc759;}.ari-catcher[data-rice="rainbow"] .ari-spark{background:#b99ce0;}.ari-catcher.is-catching[data-pulse="a"] .ari-spark{animation:ari-spark-a .38s ease-out both;}.ari-catcher.is-catching[data-pulse="b"] .ari-spark{animation:ari-spark-b .38s ease-out both;}
      .ari-magnet{position:absolute;left:50%;top:9%;width:142%;height:30%;border:2px dashed #aa7ecf;border-radius:50%;transform:translate(-50%,-50%);background:#c8b6fb22;opacity:0;pointer-events:none;}.ari-catcher.is-magnetic .ari-magnet{opacity:1;}
      .ari-message{position:absolute;left:8px;right:8px;top:10px;z-index:4;margin:0;text-align:center;font-size:14px;font-weight:700;line-height:20px;color:#377a9f;pointer-events:none;text-shadow:0 1px #fff;}.ari-message.is-error{color:#c6586f;}
      .ari-pop{position:absolute;z-index:5;left:0;top:0;opacity:0;min-width:92px;text-align:center;color:#218ac1;font:bold 22px/28px var(--font-num,Arial);text-shadow:0 2px #fff;pointer-events:none;}.ari-pop.is-error{color:#cc5c76;}.ari-pop[data-pulse="a"]{animation:ari-score-a .48s ease-out both;}.ari-pop[data-pulse="b"]{animation:ari-score-b .48s ease-out both;}
      .ari-floor{position:absolute;left:0;right:0;bottom:0;height:26%;z-index:1;pointer-events:none;}
      .ari-controls{display:grid;grid-template-columns:1fr 1fr;gap:12px;}.ari-controls button{touch-action:none;min-height:44px;border:1px solid var(--arc-line,#b8e5f7);border-radius:12px;background:var(--arc-white,#fff);color:var(--arc-deep,#2789c4);font:700 16px/20px var(--font-main,sans-serif);cursor:pointer;}.ari-controls button:active{background:#d7effc;}
      .ari-help{margin:0;text-align:center;font-size:12px;line-height:20px;color:var(--arc-muted,#5b7f96);white-space:nowrap;}
      .ari-game.is-compact{grid-template-rows:34px minmax(0,1fr) 40px 18px;gap:5px;padding:6px 10px;}.ari-game.is-compact .ari-legend{display:none;}.ari-game.is-compact .ari-stat{font-size:11px;line-height:14px;}.ari-game.is-compact .ari-stat strong{font-size:18px;line-height:20px;}.ari-game.is-compact .ari-controls button{min-height:40px;}.ari-game.is-compact .ari-message{top:4px;font-size:12px;}.ari-game.is-compact .ari-help{font-size:11px;line-height:18px;}
      .ari-game.is-narrow{padding:10px 8px;gap:7px;}.ari-game.is-narrow .ari-legend{gap:7px;font-size:12px;}.ari-game.is-narrow .ari-help{font-size:12px;}.ari-game.is-narrow .ari-message{font-size:13px;}
      ${['a', 'b'].map(phase => `
      @keyframes ari-catch-${phase}{40%{transform:translateY(3px) scale(1.025,.98)}100%{transform:none}}
      @keyframes ari-oops-${phase}{25%{transform:rotate(-3deg)}60%{transform:rotate(3deg)}100%{transform:none}}
      @keyframes ari-spark-${phase}{0%{opacity:1;transform:translate(0,0) scale(.6)}100%{opacity:0;transform:translate(var(--sx),var(--sy)) rotate(75deg) scale(.25)}}
      `).join('')}
      @keyframes ari-score-a{0%{opacity:1;translate:0 0}100%{opacity:0;translate:0 -26px}}@keyframes ari-score-b{0%{opacity:1;translate:0 0}100%{opacity:0;translate:0 -26px}}
      .ari-game.is-reduced .ari-catcher-art,.ari-game.is-reduced .ari-spark{animation:none!important;}.ari-game.is-reduced .ari-pop[data-pulse]{animation:none;opacity:1;}.ari-game.is-paused *{animation-play-state:paused!important;}
    `;
    game.appendChild(style);
    const hud = el('div', 'ari-hud');
    function stat(label) { const box = el('div', 'ari-stat', label), value = el('strong', '', '0'); box.appendChild(value); hud.appendChild(box); return value; }
    const scoreText = stat('救回大白饭'), comboText = stat('连续接米'), timeText = stat('剩余时间');
    const legend = el('p', 'ari-legend');
    [['white', '白米', ''], ['gold', '高分', '★'], ['rainbow', '吸米', '+'], ['black', '躲开', '×']].forEach(([type, label, mark]) => {
      const item = el('span', '', label); item.prepend(el('i', 'ari-grain is-' + type, mark)); legend.appendChild(item);
    });
    const board = el('div', 'ari-board'); board.setAttribute('role', 'group'); board.setAttribute('aria-label', '接米区域，左右拖动移动' + whaleName() + '，轻点底部地板定位'); board.tabIndex = 0;
    const dropLayer = el('div', 'ari-drops'), catcher = el('div', 'ari-catcher'), fallback = el('span', 'ari-fallback'), magnet = el('i', 'ari-magnet');
    fallback.dataset.name=whaleName();
    const message = el('p', 'ari-message', whaleName() + '正在举起大铁盆……'), pop = el('span', 'ari-pop');
    pop.setAttribute('aria-hidden', 'true'); catcher.setAttribute('aria-hidden', 'true'); dropLayer.setAttribute('aria-hidden', 'true');
    let art;
    function assetReady(loaded) { if (destroyed) return; ready = true; fallback.hidden = !!loaded; message.textContent = '接住白米饭，黑米要躲开！'; }
    art = env.sprite(artPath(opts), whaleName() + '举起铁盆接米', 'ari-catcher-art', assetReady);
    if (env.sprite.length < 4) assetReady(true);
    catcher.append(art, fallback, magnet);
    [[-24,-16],[-12,-28],[12,-28],[24,-16]].forEach(([x,y]) => { const spark = el('i','ari-spark'); spark.style.setProperty('--sx',x+'px'); spark.style.setProperty('--sy',y+'px'); catcher.appendChild(spark); });
    board.append(el('div', 'ari-floor'), dropLayer, catcher, message, pop);
    const controls = el('div', 'ari-controls');
    [['left', '← 向左'], ['right', '向右 →']].forEach(([direction, label]) => {
      const button = el('button', '', label); button.type = 'button'; button.dataset.direction = direction;
      listen(button, 'pointerdown', event => { if (!running || event.button > 0) return; event.preventDefault(); held.add('button-' + direction); try { button.setPointerCapture(event.pointerId); } catch (_) {} });
      const release = () => held.delete('button-' + direction);
      listen(button, 'pointerup', release); listen(button, 'pointercancel', release); listen(button, 'lostpointercapture', release);
      listen(button, 'click', event => { if (running && event.detail === 0) moveTo(playerX + (direction === 'left' ? -.12 : .12)); });
      controls.appendChild(button);
    });
    const help = el('p', 'ari-help', '全区域左右拖动 · 轻点地板定位 · A/D 或 ← →');
    game.append(hud, legend, board, controls, help);
    game.classList.toggle('is-reduced', !!reduced); env.host.appendChild(game);
    function updateLayout() {
      if (destroyed) return;
      const hostBox = env.host.getBoundingClientRect();
      game.classList.toggle('is-compact', hostBox.height > 0 && hostBox.height < 350);
      game.classList.toggle('is-narrow', hostBox.width > 0 && hostBox.width < 420);
      help.textContent = hostBox.width > 0 && hostBox.width < 420 ? '拖动接米 · 点地板定位 · 按住方向键' : '全区域左右拖动 · 轻点地板定位 · A/D 或 ← →';
      const box = board.getBoundingClientRect();
      geometry = layoutForSize(box.width || hostBox.width - 24, box.height || hostBox.height - (hostBox.height < 350 ? 118 : 204));
      catcher.style.width = geometry.figureWidth + 'px'; catcher.style.height = geometry.figureHeight + 'px';
      moveTo(playerX); renderDrops();
    }
    const observer = typeof root.ResizeObserver === 'function' ? new root.ResizeObserver(updateLayout) : null;
    if (observer) observer.observe(env.host); listen(root, 'resize', updateLayout);
    function moveTo(x) { playerX = clamp(x, geometry.edge, 1 - geometry.edge); renderCatcher(); }
    function renderCatcher() {
      catcher.style.transform = 'translate3d(' + (playerX * geometry.width - geometry.figureWidth / 2).toFixed(2) + 'px,' + geometry.figureTop.toFixed(2) + 'px,0)';
      catcher.classList.toggle('is-magnetic', state.magnetUntil > elapsed);
    }
    function renderDrops() { drops.forEach(drop => { drop.node.style.transform = 'translate3d(' + (drop.x * geometry.width - 12.5).toFixed(2) + 'px,' + (drop.progress * geometry.catchY - 17.5).toFixed(2) + 'px,0) rotate(' + drop.angle + 'deg)'; }); }
    function clearInput() { held.clear(); drag = null; }
    listen(board, 'pointerdown', event => {
      if (!running || !ready || event.button > 0 || drag) return;
      event.preventDefault(); const box = board.getBoundingClientRect();
      drag = { id: event.pointerId, start: event.clientX, x: playerX, moved: false, y: event.clientY, box };
      try { board.setPointerCapture(event.pointerId); } catch (_) {}
    });
    listen(board, 'pointermove', event => {
      if (!running || !drag || event.pointerId !== drag.id) return;
      event.preventDefault(); const dx = event.clientX - drag.start;
      if (Math.abs(dx) > 4) drag.moved = true;
      moveTo(drag.x + dx / (drag.box.width || geometry.width));
    });
    listen(board, 'pointerup', event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (running && !drag.moved && event.clientY - drag.box.top >= (drag.box.height || geometry.height) * .70) moveTo((event.clientX - drag.box.left) / (drag.box.width || geometry.width));
      drag = null;
    });
    listen(board, 'pointercancel', () => { drag = null; }); listen(board, 'lostpointercapture', () => { drag = null; });
    function keyName(event) { return ['ArrowLeft', 'a', 'A'].includes(event.key) ? 'left' : ['ArrowRight', 'd', 'D'].includes(event.key) ? 'right' : ''; }
    listen(doc, 'keydown', event => {
      if (!running || event.ctrlKey || event.altKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target && event.target.tagName || '')) return;
      const name = keyName(event); if (name) { event.preventDefault(); held.add(name); }
    });
    listen(doc, 'keyup', event => { const name = keyName(event); if (name) { held.delete(name); if (running) event.preventDefault(); } });
    listen(root, 'blur', clearInput);
    function renderHud() {
      const left = Math.max(0, Math.ceil(cfg.durationSeconds - elapsed / 1000));
      const signature = [state.score, state.combo, left].join(':');
      if (signature !== lastHud) { scoreText.textContent = String(state.score); comboText.textContent = String(state.combo); timeText.textContent = left + ' 秒'; lastHud = signature; }
    }
    function spawn() {
      if (drops.length >= 24) return;
      const roll = random(), type = roll < level.black ? 'black' : roll < level.black + .08 ? 'rainbow' : roll < level.black + .19 ? 'gold' : 'white';
      const node = el('i', 'ari-grain is-' + type, { gold: '★', rainbow: '+', black: '×' }[type] || '');
      const drop = { type, x: .06 + random() * .88, progress: -.13, speed: 1 / (level.travel * (.88 + random() * .24)), angle: Math.round(random() * 36 - 18), node };
      drops.push(drop); dropLayer.appendChild(node);
    }
    function caught(drop) {
      const result = catchRice(state, drop.type, elapsed, cfg);
      const wrong = drop.type === 'black';
      message.textContent = wrong ? '糟糕，混进黑米了！' : drop.type === 'rainbow' ? '吸米开启！好米都到盆里来～' : drop.type === 'gold' ? '金米到！这盆饭金灿灿～' : '大白饭，接住啦！';
      message.classList.toggle('is-error', wrong); pop.classList.toggle('is-error', wrong);
      pop.textContent = (result.points >= 0 ? '+' : '') + result.points;
      pop.style.transform = 'translate3d(' + (playerX * geometry.width - 46) + 'px,' + Math.max(12, geometry.catchY - 44) + 'px,0)';
      pop.dataset.pulse = (++pulse % 2) ? 'a' : 'b';
      catcher.dataset.pulse = pop.dataset.pulse; catcher.dataset.rice = drop.type;
      catcher.classList.remove('is-catching', 'is-wrong');
      catcher.classList.add(wrong ? 'is-wrong' : 'is-catching');
      feedbackUntil = elapsed + 700;
      sound({ white: 'rice_catch', gold: 'rice_gold', rainbow: 'rice_rainbow', black: 'rice_black' }[drop.type], wrong ? .5 : .55);
    }
    function finish() {
      if (ended || destroyed) return; ended = true; running = false; root.cancelAnimationFrame(raf); raf = 0; clearInput();
      env.finish({ kind: 'rice', score: state.score, grade: gradeForScore(state.score, level.difficulty), accuracy: accuracy(state),
        maxCombo: state.maxCombo, hits: state.hits, misses: state.misses, misHits: state.misHits, bonusSeconds: state.bonusSeconds, aborted: false });
    }
    function frame(timestamp) {
      if (!running || destroyed || ended) return;
      const delta = previous == null ? 0 : Math.max(0, timestamp - previous); previous = timestamp;
      if (!ready) {
        loadingElapsed += delta;
        if (loadingElapsed >= 1500) assetReady(false);
        raf = root.requestAnimationFrame(frame); return;
      }
      const remaining = (cfg.durationSeconds) * 1000 - elapsed;
      const step = Math.min(delta, Math.max(0, remaining)); elapsed += step;
      const oldX = playerX, direction = Number(held.has('right') || held.has('button-right')) - Number(held.has('left') || held.has('button-left'));
      if (direction) moveTo(playerX + direction * step / 1000 * .72);
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i], previousProgress = drop.progress; drop.progress += step * drop.speed;
        if (state.magnetUntil > elapsed && drop.type !== 'black' && previousProgress > .55 && Math.abs(drop.x - playerX) < geometry.halfBasin * 1.85 + .018) {
          drop.x += (playerX - drop.x) * Math.min(.8, step / 180);
        }
        if (previousProgress < 1 && drop.progress >= 1) {
          if (crossedBasin(drop, previousProgress, drop.progress, oldX, playerX, geometry.halfBasin, state.magnetUntil > elapsed)) caught(drop);
          else missRice(state, drop.type);
          drop.node.remove(); drops.splice(i, 1);
        }
      }
      if (elapsed >= (cfg.durationSeconds) * 1000) { renderHud(); finish(); return; }
      if (elapsed >= spawnAt) { spawn(); spawnAt = elapsed + level.interval * (.9 + random() * .2); }
      if (feedbackUntil && elapsed >= feedbackUntil) {
        feedbackUntil = 0; pop.removeAttribute('data-pulse'); catcher.classList.remove('is-catching', 'is-wrong');
        message.classList.remove('is-error'); message.textContent = state.magnetUntil > elapsed ? '吸米中 · 黑米还是要躲开哦' : '接住白米饭，黑米要躲开！';
      }
      renderHud(); renderCatcher(); renderDrops(); raf = root.requestAnimationFrame(frame);
    }
    function pause() { running = false; previous = null; root.cancelAnimationFrame(raf); raf = 0; clearInput(); game.classList.add('is-paused'); }
    function destroy() {
      if (destroyed) return; destroyed = true; pause(); if (observer) observer.disconnect();
      localCleanups.splice(0).reverse().forEach(fn => fn()); drops.splice(0).forEach(drop => drop.node.remove()); game.remove();
    }
    updateLayout(); renderHud(); if (env.onCleanup) env.onCleanup(destroy);
    return { start() { if (started || destroyed) return; started = true; running = true; previous = null; raf = root.requestAnimationFrame(frame); },
      pause, resume() { if (!started || running || destroyed || ended) return; running = true; previous = null; game.classList.remove('is-paused'); raf = root.requestAnimationFrame(frame); }, destroy };
  }
  return { settings, LEVELS, difficultyConfig, createScoreState, catchRice, missRice, accuracy, gradeForScore, layoutForSize, crossedBasin,
    game: { title: '拯救大白饭', assets: opts => [artPath(opts)],
      durationSeconds: opts => settings(opts && opts.rice).durationSeconds,
      rules: rulesForOptions,
      controls: '触屏：全区域左右拖动，或轻点底部地板定位；也可按住下方方向按钮。键盘：A / D 或 ← / →。', create } };
});
