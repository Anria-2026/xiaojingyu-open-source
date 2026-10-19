(function (root) {
  'use strict';
  const modules = {};
  const resultArt = { S: 'resource/character/whale_cheer.webp', A: 'resource/character/whale_cheer.webp', B: 'resource/character/whale_stand.webp', C: 'resource/character/whale_hurt.webp' };
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function createRng(seed) {
    let n = typeof seed === 'number' ? seed >>> 0 : Array.from(String(seed == null ? Date.now() : seed)).reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
    return function () {
      n += 0x6D2B79F5;
      let t = n;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const api = { createRng, clamp, register(kind, module) { modules[kind] = module; }, open };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root || !root.document) return;
  root.ArcadeCore = api;
  const doc = root.document;
  /* 素材预热：看规则时就把本局要用的图下载并解码好，引用常驻本会话。
     之后小游戏里 new Image 同一地址会同步命中缓存，目标一出现就是真图，不会先闪占位脸。 */
  const warmed = new Map();
  function warm(paths) {
    (paths || []).forEach(src => {
      if (!src || warmed.has(src)) return;
      const image = new root.Image(); warmed.set(src, image);
      image.onload = () => { try { const d = image.decode && image.decode(); if (d && d.catch) d.catch(() => {}); } catch (_) {} };
      image.src = src;
    });
  }
  function el(tag, cls, text) {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function sound(name) { try { if (root.SFX) root.SFX.play(name, { vol: 0.35 }); } catch (_) {} }
  function button(label, action, primary) {
    const b = el('button', 'arc-btn dg-btn' + (primary ? ' dg-btn-primary' : ''));
    b.append(el('span',null,label));
    b.type = 'button'; b.onclick = () => { sound('click'); action(); }; return b;
  }
  function palette(node) {
    const style = root.getComputedStyle(node), p = {};
    ['background', 'surface', 'primary', 'deep', 'ink', 'muted', 'line', 'success', 'warning', 'error', 'pink'].forEach(k => { p[k] = style.getPropertyValue('--arc-' + k).trim(); });
    return p;
  }
  function drawSprite(ctx, img, x, y, width, height, type, colors) {
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      ctx.drawImage(img, x + (width - w) / 2, y + (height - h) / 2, w, h); return;
    }
    const p = colors, cx = x + width / 2, cy = y + height / 2, r = Math.min(width, height) * 0.38;
    ctx.save(); ctx.fillStyle = /fire|spike|hurt/.test(type) ? p.error : /token/.test(type) ? p.warning : /bug|garble/.test(type) ? p.success : /ghost/.test(type) ? p.pink : p.primary;
    ctx.strokeStyle = p.ink; ctx.lineWidth = 2; ctx.beginPath();
    if (type === 'spike') { ctx.moveTo(cx, cy-r); ctx.lineTo(cx+r, cy+r); ctx.lineTo(cx-r,cy+r); ctx.closePath(); }
    else if (/gpu|book|garble|slot/.test(type)) { ctx.roundRect ? ctx.roundRect(cx-r,cy-r,r*2,r*2,r*0.35) : ctx.rect(cx-r,cy-r,r*2,r*2); }
    else ctx.ellipse(cx, cy, r, r*0.86, 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.ink;
    for (const dx of [-0.32,0.32]) { ctx.beginPath(); ctx.arc(cx+r*dx,cy-r*.12,Math.max(2,r*.09),0,Math.PI*2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx,cy+r*.12,r*.24,0,Math.PI); ctx.stroke();
    if (/whale/.test(type)) { ctx.fillStyle=p.primary; ctx.beginPath(); ctx.ellipse(cx-r,cy+r*.3,r*.45,r*.22,-.5,0,Math.PI*2);ctx.fill(); }
    ctx.restore();
  }
  function open(initialKind, opts) {
    opts = opts || {};
    if (opts.isCurrent && !opts.isCurrent()) return Promise.resolve({ kind: initialKind, score: 0, grade: 'C', aborted: true, reason: 'stale-session' });
    const config = ((root.GameUI && root.GameUI.core && root.GameUI.core.cfg) || root.GameCfg || {}).ARCADE || {};
    const games = opts.games || config.GAMES || {};
    const core = root.GameUI && root.GameUI.core;
    const visibleKinds = () => Object.keys(games).filter(kind => kind !== 'rice' || core && typeof core.arcadeAvailable === 'function' && core.arcadeAvailable(kind));
    if (!root.V2Panels || typeof root.V2Panels.open !== 'function') return Promise.reject(new Error('原版面板模块尚未加载'));
    function lockedMessage(kind) {
      if (kind === 'runner') return (config.LOCKED || {}).runner || '节奏快打 · 制作中，敬请期待';
      const row = Object.prototype.hasOwnProperty.call(games, kind) && games[kind], core = root.GameUI && root.GameUI.core;
      if (kind === 'rice' && (!core || typeof core.arcadeAvailable !== 'function' || !core.arcadeAvailable(kind))) return '拯救大白饭在 V5 解锁。';
      if (row && (row.enabled === false || core && root.FeatureUnlock && !root.FeatureUnlock.meets(core, row.unlock))) return '这款小游戏尚未解锁。';
      if (root.MiniArcade && typeof root.MiniArcade.lockedMessage === 'function') return root.MiniArcade.lockedMessage(kind);
      const locks = opts.locked || config.LOCKED || { runner: '节奏快打 · 制作中，敬请期待' };
      return Object.prototype.hasOwnProperty.call(locks, kind) ? locks[kind] || '' : '';
    }
    const locked = lockedMessage(initialKind);
    if (locked) {
      if (root.MiniArcade && root.MiniArcade.notify) root.MiniArcade.notify(locked);
      return Promise.resolve({ kind: initialKind, score: 0, grade: 'C', aborted: true, locked: true });
    }
    return new Promise(resolve => {
      let closed = false, mode = 'menu', selected = initialKind, difficulty = clamp(Math.round(+opts.difficulty || 1),1,5), menuPage = 0;
      let controller = null, cleanups = [], globalCleanups = [], lastResult = null, sequence = 0, roundOpts = null;
      const rewardMode = kind => ({'-1':'easy','0':'normal','1':'hard'})[offsets[kind]] || 'normal';
      const best = {}, used = {}, offsets = Object.fromEntries(Object.keys(games).map(kind => [kind, 0]));
      const shell = root.V2Panels.open({ title: opts.title || '小游戏厅', icon: 'star', className: 'arcade-overlay', layout:'responsive', focusTrap:false, onClose: close,
        onEscape() { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); else close(); return true; } });
      const mask = shell.host, panel = shell.card, body = shell.body;
      mask.classList.add('arcade-overlay'); panel.classList.add('arcade-panel'); body.classList.add('arcade-body');
      const header = panel.querySelector('.modal-header'), heading = panel.querySelector('.modal-title span');
      const toolbar = el('div', 'arcade-toolbar'), pauseBtn = button('暂停', pause);
      const closeBtn = header.querySelector('.modal-close'); closeBtn.setAttribute('aria-label', '关闭小游戏');
      pauseBtn.hidden = true; toolbar.append(pauseBtn); header.insertBefore(toolbar, closeBtn);
      const pauseMask = el('div', 'arcade-pause'); pauseMask.hidden = true;
      const pauseCard = el('div', 'arcade-rule-card'), pauseActions = el('div','arcade-actions');
      pauseActions.append(button('继续', resume, true), button('结束本局', close));
      pauseCard.append(el('h3', null, '休息一下'), el('p', null, '游戏已暂停，准备好再继续。'), pauseActions);
      pauseMask.append(pauseCard); panel.append(pauseMask);
      const fit = () => { if (!closed && shell.fit) { shell.fit(); pauseMask.style.top = header.offsetHeight + 'px'; } };
      function listen(target, event, handler, options, list) {
        target.addEventListener(event,handler,options); (list || cleanups).push(() => target.removeEventListener(event,handler,options));
      }
      function clearRound() {
        if (controller) { controller.destroy(); controller = null; }
        cleanups.splice(0).reverse().forEach(fn => { try { fn(); } catch (_) {} });
        pauseMask.hidden = true; pauseBtn.hidden = true;
      }
      function status(kind) {
        let s = typeof opts.getStatus === 'function' ? opts.getStatus(kind) || {} : {};
        const remaining = Number.isFinite(s.remaining) ? s.remaining : (opts.practice ? 0 : Math.max(0,1-(used[kind]||0)));
        return { remaining, best: Math.max(+s.best || 0,best[kind]||0), practice: !!((typeof opts.getStatus !== 'function' && opts.practice) || s.practice || remaining <= 0) };
      }
      function gameOptions() { return Object.assign({whack:config.WHACK,sort:config.SORT,rice:config.RICE,sprites:config.SPRITES,whaleSprites:config.WHALE_SPRITES},opts); }
      function rewardInfo(kind) {
        const core = root.GameUI && root.GameUI.core;
        if (typeof opts.rewardOverview === 'function') return opts.rewardOverview(kind,rewardMode(kind));
        return core && typeof core.arcadeRewardOverview === 'function' ? core.arcadeRewardOverview(kind,rewardMode(kind)) : null;
      }
      function rewardTable(kind) {
        const info = rewardInfo(kind); if (!info) return null;
        const section=el('section','arcade-lobby-rewards');section.setAttribute('aria-label',games[kind].title+'奖励');
        section.append(el('h4',null,'评级奖励'),el('p','arcade-reward-limit',info.limit));
        const list=el('dl','arcade-reward-grades');
        info.grades.forEach(row=>{const grade=el('dt','arcade-reward-grade',row.grade),value=el('dd',null,row.text);grade.dataset.grade=row.grade;list.append(grade,value);});
        section.append(list,el('p','arcade-reward-budget',info.budget));
        if(info.bonus)section.append(el('p','arcade-reward-budget arcade-affection-reward',info.bonus));
        return section;
      }
      // onSettle(loaded) 可选：图片加载成功 / 失败时各回调一次（已在缓存里则同步回调），供小游戏决定何时让目标可点。
      function sprite(src,label,className,onSettle) {
        const span = el('span','arc-sprite ' + (className || ''));
        span.setAttribute('role','img'); span.setAttribute('aria-label',label || '');
        const face=el('span','arc-sprite-face','•ᴗ•'), image = new Image(); image.alt=''; image.draggable=false;
        let settled=false;
        const showImage=loaded=>{ span.classList.toggle('arc-loaded',loaded); face.hidden=loaded; image.hidden=!loaded; };
        const settle=loaded=>{ showImage(loaded); if(!settled && typeof onSettle==='function'){ settled=true; onSettle(loaded); } };
        showImage(false); face.hidden=true; span.append(face,image);
        image.onload=()=>settle(image.naturalWidth>0); image.onerror=()=>settle(false); image.src=src;
        if(image.complete && image.naturalWidth>0)settle(true);
        cleanups.push(()=>{ image.onload=image.onerror=null; image.removeAttribute('src'); }); return span;
      }
      function loadImages(paths) {
        const images = {};
        paths.forEach(path => { const image = new Image(); image.src=path; images[path]=image; });
        cleanups.push(()=>Object.values(images).forEach(image=>{ image.onload=image.onerror=null; image.removeAttribute('src'); }));
        return images;
      }
      function menu() {
        sequence++; clearRound(); mode='menu'; heading.textContent=(initialKind==='menu' && opts.title) || '鲸鱼小游戏厅'; body.replaceChildren(); panel.classList.remove('arcade-playing');
        panel.dataset.arcadeView='menu';
        const intro=el('div','arcade-intro'); intro.append(el('p',null,config.INTRO || '动动手指，换个心情。每款每周都有一次领奖机会。'));
        if(typeof opts.rewardGrowth==='function'){const growth=opts.rewardGrowth();if(growth)intro.append(el('p','arcade-growth-note',growth));}
        const cards=el('div','arcade-menu-grid');
        // Like the original team panel, keep a short page and reuse its button language.
        // Configured games remain reachable through short pages on mobile too.
  /* [feature:portrait-arcade-single-page] */
        const compact = root.innerHeight > root.innerWidth || root.innerHeight <= 450;
        const kinds=visibleKinds(), perPage=compact?1:2, pages=Math.max(1,Math.ceil(kinds.length/perPage));
  /* [/feature:portrait-arcade-single-page] */
        menuPage=clamp(menuPage,0,pages-1); cards.dataset.page=menuPage+1;
        kinds.slice(menuPage*perPage,(menuPage+1)*perPage).forEach(kind=>{
          const row=games[kind];
          const s=status(kind),card=el('article','arcade-menu-card'); card.dataset.kind=kind;
          const lock=lockedMessage(kind);
          const mark=el('div','arcade-card-art ' + kind), duration=el('span','arcade-duration','30 秒');
          const cardHeading=el('div','arcade-card-heading'), copy=el('div','arcade-card-copy'), description=el('p','arcade-card-desc',row.desc);
          mark.append(sprite(row.img || row.cover,row.title,'arcade-cover'));
          copy.append(el('h3',null,row.title),description,duration);cardHeading.append(mark,copy);card.append(cardHeading);
          if(lock) {
            card.classList.add('whl-arcade-locked'); card.setAttribute('aria-disabled','true');
            const icon=el('span','whl-arcade-lock'); icon.setAttribute('aria-hidden','true');
            icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>';
            mark.append(icon); description.textContent=lock; cards.append(card); return;
          }
          const stats=el('div','arcade-card-stats'); stats.append(el('span',null,'本周可领奖 '+s.remaining+' 次'),el('span',null,'历史最佳 '+s.best)); card.append(stats);
          const rewards=rewardTable(kind);if(rewards)card.append(rewards);
          const label=el('label','arcade-difficulty','难度 '), select=el('select'); select.setAttribute('aria-label',row.title+'难度');
          [['简单',-1],['普通',0],['困难',1]].forEach(([name,offset])=>{const option=el('option',null,name+' · '+clamp(difficulty+offset,1,5)+' 级');option.value=offset;option.selected=offset===offsets[kind];select.append(option);});
          select.onchange=()=>{offsets[kind]=+select.value;const old=card.querySelector('.arcade-lobby-rewards');if(old)old.replaceWith(rewardTable(kind));}; label.append(select);
          const cardActions=el('div','arcade-card-actions');cardActions.append(label,button(s.practice?'开始练习':'开始',()=>rules(kind,clamp(difficulty+offsets[kind],1,5)),true));card.append(cardActions);cards.append(card);
        });
        body.append(intro,cards);
        if(pages>1) {
          const pager=el('div','arcade-pagination'), previous=button('上一页',()=>{menuPage--;menu();}), next=button('下一页',()=>{menuPage++;menu();});
          previous.disabled=menuPage===0; next.disabled=menuPage===pages-1;
          const info=el('span','arcade-page-info',(menuPage+1)+' / '+pages); info.setAttribute('aria-live','polite');
          pager.append(previous,info,next); body.append(pager);
        }
        body.append(el('p','arcade-footnote',opts.practice?'独立试玩 · 成绩仅保留在本次小游戏厅中':'奖励按固定档位发放，受阶段额度及能力、小鲸鱼体力上限限制。次数用完仍可练习。')); fit(); body.scrollTop=0; closeBtn.focus({preventScroll:true});
      }
      async function rules(kind, level) {
        if (opts.isCurrent && !opts.isCurrent()) { close(); return; }
        if(lockedMessage(kind)) { menu(); return; }
        const token=++sequence; clearRound(); mode='loading'; selected=kind; body.replaceChildren(el('p','arcade-loading','准备小游戏……'));
        panel.classList.remove('arcade-playing');
        try { if (!modules[kind]) await root.MiniArcade._load(kind); } catch (error) {
          if (!closed && token===sequence) { body.replaceChildren(el('p',null,error.message),button('返回',menu)); } return;
        }
        if(closed || token!==sequence)return;
        if(opts.isCurrent && !opts.isCurrent()) { close(); return; }
        if(lockedMessage(kind)) { menu(); return; }
        if(!modules[kind]) { body.replaceChildren(el('p',null,'小游戏未能准备完成。'),button('返回',menu)); return; }
        mode='rules'; panel.dataset.arcadeView='rules'; panel.dataset.arcadeKind=kind; heading.textContent=games[kind].title; const module=modules[kind], s=status(kind);
        roundOpts=Object.assign(gameOptions(),{difficulty:level,rewardDifficulty:rewardMode(kind),practice:s.practice});
        if(typeof module.assets==='function') { try { warm(module.assets(roundOpts)); } catch (_) {} }
        const card=el('div','arcade-rule-card'), copy=el('div','arcade-rule-copy'), side=el('div','arcade-rule-side');
        const badges=el('p','arcade-eyebrow',(s.practice?'练习模式':'本周可领奖 '+s.remaining+' 次')+' · 难度 '+level+' / 5');
        copy.append(badges,el('h3',null,'开局前，记住这两点'));
        const ruleLines=typeof module.rules==='function'?module.rules(roundOpts):module.rules || [];
        ruleLines.slice(0,2).forEach((line,i)=>{const row=el('div','arcade-rule-line');row.append(el('span','arcade-rule-number',i+1),el('p',null,line));copy.append(row);});
        const diagram=el('div','arcade-controls');
        if(games[kind].controlsDiagram==='grid') { const keys=el('div','arcade-key-grid'); 'QWEASDZXC'.split('').forEach(k=>keys.append(el('kbd',null,k)));diagram.append(keys);
        } else if(games[kind].controlsDiagram==='sort') { const keys=el('div','arcade-sort-keys');keys.append(el('kbd',null,'← / A 丢弃'),el('span','arcade-sort-card','语料卡'),el('kbd',null,'→ / D 入库'));diagram.append(keys); }
        else if(games[kind].controlsDiagram==='rice') { diagram.classList.add('is-rice');const keys=el('div','arcade-rice-keys');keys.append(el('kbd',null,'← / A'),el('span','arcade-sort-card','举盆接米'),el('kbd',null,'→ / D'));diagram.append(keys); }
        else { const keys=el('div','arcade-lane-keys');keys.append(el('kbd',null,'F / D　↑ 上轨'),el('kbd',null,'J / K　↓ 下轨'));diagram.append(keys,el('p',null,'触屏：上半屏 / 下半屏\n双指可同时敲击两轨')); }
        side.append(diagram,el('p','arcade-footnote',module.controls || ''));
        if(typeof opts.rewardGrowth==='function'){const growth=opts.rewardGrowth();if(growth)copy.append(el('p','arcade-growth-note',growth));}
        if(!s.practice && typeof opts.rewardPreview==='function') {
          const preview=opts.rewardPreview(kind,'S',rewardMode(kind));if(preview)copy.append(el('p','arcade-reward-preview','S 级参考：'+preview));
        }
        const actions=el('div','arcade-actions');actions.append(button('返回大厅',menu),button('开始游戏',start,true));card.append(copy,side,actions);body.replaceChildren(card);
        fit(); body.scrollTop=0; actions.lastChild.focus({preventScroll:true});
      }
      function start() {
        if (opts.isCurrent && !opts.isCurrent()) { close(); return; }
        if (lockedMessage(selected)) { menu(); return; }
        if(mode!=='rules')return; clearRound(); mode='playing'; panel.dataset.arcadeView='playing'; pauseBtn.hidden=false; panel.classList.add('arcade-playing');
        const host=el('div','arcade-stage');body.replaceChildren(host); const p=palette(mask); fit();
        const roundId=++sequence;
        const env={host,opts:roundOpts,rng:createRng(roundOpts.seed),finish:r=>finish(r,roundId),listen,onCleanup:fn=>cleanups.push(fn),sprite,loadImages,palette:p,drawSprite:(ctx,img,x,y,w,h,type)=>drawSprite(ctx,img,x,y,w,h,type,p)};
        try { controller=modules[selected].create(env); controller.start(); if(doc.hidden)pause(); }
        catch(error) { clearRound();mode='error';panel.classList.remove('arcade-playing');body.replaceChildren(el('p',null,'暂时无法开始：'+error.message),button('返回大厅',menu)); }
      }
      async function finish(raw,roundId) {
        if(closed || roundId!==sequence || !['playing','paused'].includes(mode))return;
        if(opts.isCurrent && !opts.isCurrent()) { close(); return; }
        const result=Object.assign({},raw,{kind:selected,difficulty:roundOpts.difficulty,rewardDifficulty:roundOpts.rewardDifficulty,practice:roundOpts.practice,aborted:false});
        lastResult=result; mode='settling'; clearRound(); panel.classList.remove('arcade-playing');
        best[selected]=Math.max(best[selected]||0,result.score||0); if(!result.practice)used[selected]=(used[selected]||0)+1;
        body.replaceChildren(el('p','arcade-loading','正在记录本局成绩……'));
        let message=result.practice?'练习模式 · 本局不发放奖励':'本局完成';
        // Capture the same current-week/stage quote before onResult consumes it.
        // Re-querying after settlement would show the next round's smaller budget.
        let rewardPreview='';
        if(!result.practice && typeof opts.rewardPreview==='function')rewardPreview=opts.rewardPreview(result.kind,result.grade,result.rewardDifficulty)||'';
        try { if(typeof opts.onResult==='function')message=(await opts.onResult(result)) || message; }
        catch(_) { message='成绩已完成，奖励暂未结算。请返回游戏查看。'; }
        if(closed || roundId!==sequence)return;
        mode='result'; panel.dataset.arcadeView='result'; const card=el('div','arcade-result'),grade=el('div','arcade-grade',result.grade||'C');
        const hero=el('div','arcade-result-hero'), name=core&&typeof core.whaleName==='function'?core.whaleName():'鲸鱼娘';hero.append(sprite((config.RESULT_ART || resultArt)[result.grade] || resultArt.C,name+' · '+(result.grade||'C')+' 级结算','arcade-result-art'),grade);
        const summary=el('div','arcade-result-summary'); summary.append(hero,el('div','arcade-score',String(result.score || 0)),el('p','arcade-footnote','本局得分'));
        card.append(el('h3','arcade-result-title',result.grade==='S'?'咕咕嘎嘎，精彩发挥！':'辛苦啦，给大脑充上电'),summary);
        const stats=el('div','arcade-result-stats');
        [[games[selected].accuracyLabel,Math.round((result.accuracy || 0)*100)+'%'],['最大连击',result.maxCombo || 0]].concat(games[selected].mistakeLabel?[[games[selected].mistakeLabel,result.misHits || 0]]:[]).forEach(([k,v])=>{const item=el('div');item.append(el('strong',null,v),el('span',null,k));stats.append(item);});
        card.append(stats); const reward=el('div','arcade-reward');reward.append(el('strong',null,result.practice?'练习记录':'本局奖励'),el('p',null,String(message)));
        if(rewardPreview)reward.append(el('small',null,'等级奖励：'+rewardPreview));
        card.append(reward); const actions=el('div','arcade-actions');actions.append(button('返回大厅',menu),button('再来一局',()=>rules(result.kind,result.difficulty),true));card.append(actions);body.replaceChildren(card);fit();body.scrollTop=0;sound('confirm');actions.lastChild.focus({preventScroll:true});
      }
      function pause() { if(mode!=='playing')return;mode='paused';if(controller)controller.pause();pauseMask.style.top=header.offsetHeight+'px';pauseMask.hidden=false;pauseBtn.hidden=true;pauseActions.firstChild.focus(); }
      function resume() { if(mode!=='paused' || doc.hidden)return;mode='playing';pauseMask.hidden=true;pauseBtn.hidden=false;if(controller)controller.resume(); }
      function close() {
        if(closed)return; const unfinished=['playing','paused','rules','loading','error'].includes(mode);
        closed=true;sequence++;clearRound();globalCleanups.splice(0).forEach(fn=>fn());shell.close();
        resolve(!unfinished && lastResult ? lastResult : {kind:selected,score:0,grade:'C',practice:roundOpts ? !!roundOpts.practice : status(selected).practice,aborted:true});
      }
      listen(doc,'visibilitychange',()=>{if(doc.hidden)pause();},false,globalCleanups);
      listen(doc,'keydown',event=>{
        if(event.key==='Escape' && !event.defaultPrevented){event.preventDefault();event.stopPropagation();if(mode==='playing')pause();else if(mode==='paused')resume();else close();}
        if(event.key==='Tab') {const nodes=Array.from((mode==='paused'?pauseCard:panel).querySelectorAll('button,select,[tabindex="0"]')).filter(n=>!n.disabled && n.getClientRects().length); const first=nodes[0],last=nodes[nodes.length-1];if(first&&event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(first&&!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}}
      },true,globalCleanups);
      if(initialKind==='menu')menu();else rules(initialKind,difficulty);
    });
  }
})(typeof window !== 'undefined' ? window : null);
