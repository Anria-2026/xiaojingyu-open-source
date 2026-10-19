/* Whale room: a furnished companion space within the shared Aqua modal. */
(function () {
  "use strict";
  const ui = window.GameUI;
  if (!ui || window.WhaleRoom) return;
  const room = { page: "affection", index: 0, pageSize: 6, preview: "", line: "", panel: null, core: null, state: null, pats: 0, patTimer: 0, patLine: "", patTalking: null, speechTimer: 0, speechPhase: "hidden", speechPop: 0, speechToken: 0 };
  const assets = new Map();
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const api = () => window.WhaleCare;
  const ready = () => !!(ui.core && ui.core.cfg && ui.core.state && ui.core.cfg.WHALE_CARE && ui.core.cfg.WHALE_CARE.ENABLED !== false && api());
  const available = () => ready() && api().bodyAvailable(ui.core);
  const button = (action, id, label, disabled, primary) => `<button type="button" class="dg-btn ${primary ? "dg-btn-primary" : ""} dg-btn-sm" data-care-action="${action}" data-id="${esc(id)}"${disabled ? " disabled" : ""}><span>${esc(label)}</span></button>`;
  const canTalk = () => typeof ui.whaleCanTalk !== "function" || ui.whaleCanTalk();
  const canRecall = () => !!(window.LifeFinale && typeof LifeFinale.canRecall === "function" && LifeFinale.canRecall(ui.core));
  const money = value => ui.formatMoney(value);
  const name = () => ui.core.whaleName();
  function speech(line) { return canTalk() ? (typeof ui.core.fillWhaleText === 'function' ? ui.core.fillWhaleText(line) : ui.core.fillVars(line)) : "咕嘎……"; }
  function roomSpeech() {
    const talking = canTalk();
    return room.patLine && room.patTalking === talking ? room.patLine : speech("回来啦，要一起歇一会儿吗？");
  }
  function nextPatLine() {
    const talking = canTalk();
    const lines = talking
      ? ["嗯？是在叫我吗？", "再摸一下嘛，就一下。", "有你陪着，今天也很开心。", "这里暖暖的，刚好可以歇一会儿。", "收到！今天的元气补充完毕。", "嘿嘿，这个小房间也有你的位置。"]
      : ["咕嘎？（抬头看你）", "咕～（蹭了蹭你的手）", "嘎嘎！（开心地晃了晃）", "咕噜咕噜……（眯起眼睛）", "咕、咕嘎！（伸手求摸摸）", "嘎～（乖乖靠近了一点）"];
    const choices = lines.filter(line => line !== room.patLine);
    room.patLine = choices[Math.floor(Math.random() * choices.length)];
    room.patTalking = talking;
    return room.patLine;
  }
  function syncSpeech() {
    const bubble = room.panel && room.panel.body.querySelector('.care-v2-room-speech');
    if (!bubble) return;
    bubble.textContent = roomSpeech();
    bubble.dataset.phase = room.speechPhase;
    bubble.dataset.pop = room.speechPop % 2 ? 'a' : 'b';
    bubble.hidden = room.speechPhase === 'hidden';
  }
  function stopSpeech() {
    clearTimeout(room.speechTimer); room.speechTimer = 0;
    room.speechToken++; room.speechPhase = 'hidden';
  }
  function showSpeech() {
    stopSpeech();
    const token = room.speechToken;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const enter = reduced ? 120 : 280, exit = reduced ? 120 : 240;
    room.speechPop++; room.speechPhase = 'enter'; syncSpeech();
    // Only deliberate interaction starts a new cycle. Asset/tick/resize refreshes
    // keep the same node and timer so a greeting cannot remain visible forever.
    const later = (phase, delay, next) => {
      room.speechTimer = setTimeout(() => {
        if (token !== room.speechToken || !room.panel) return;
        room.speechTimer = 0; room.speechPhase = phase; syncSpeech();
        if (next) next();
      }, delay);
    };
    later('hold', enter, () => later('exit', 3200, () => later('hidden', exit)));
  }
  function refreshScene(){const scene=window.V2OfficeScene,update=scene&&(scene.refreshLayout||scene.refresh);if(typeof update==='function')update.call(scene);}
  function loadOutfits() {
    if (!available()) return;
    const syncAssets=()=>{if(!ready())return;for(const row of ui.core.cfg.WHALE_OUTFITS||[]){api().setOutfitAvailable(row.id,assets.get(row.img)==='ready');
      if(api().setOutfitDragAvailable)api().setOutfitDragAvailable(row.id,!!row.dragImg&&assets.get(row.dragImg)==='ready');
      if(api().setOutfitWandAvailable)api().setOutfitWandAvailable(row.id,!!row.wandImg&&assets.get(row.wandImg)==='ready');}
      if(api().setOutfitWandAvailable)api().setOutfitWandAvailable('default',assets.get((ui.core.cfg.WHALE_CARE.AUTOMATION||{}).WAND_IMG||'resource/character/whale_wand_default.webp')==='ready');};
    for (const outfit of [...(ui.core.cfg.WHALE_OUTFITS || []), {wandImg:(ui.core.cfg.WHALE_CARE.AUTOMATION||{}).WAND_IMG||'resource/character/whale_wand_default.webp'}]) {
      for(const src of [outfit.img,outfit.dragImg,outfit.wandImg].filter(Boolean)){
        if(assets.has(src))continue;assets.set(src,'loading');const img=new Image();
        img.onload=()=>{assets.set(src,'ready');syncAssets();refresh();refreshScene();};
        img.onerror=()=>{assets.set(src,'missing');syncAssets();refresh();refreshScene();};img.src=src;
      }
    }
    syncAssets();
  }
  function affectionHTML() {
    const care = api().ensure(ui.core), cfg = ui.core.cfg.WHALE_CARE, curve = api().curve(ui.core), next = curve[care.lvl];
    const previous = Number(curve[care.lvl - 1]) || 0;
    const energy = api().energyStatus(ui.core);
    const progress = next == null ? 100 : Math.max(0, Math.min(100, (care.xp - previous) / Math.max(1, next - previous) * 100));
    const homeAction = (action, id, icon, title, note) => `<button type="button" class="care-v2-room-action" data-care-action="${action}" data-id="${id}"><i aria-hidden="true">${ui.icon ? ui.icon(icon,22) : ""}</i><span><b>${esc(title)}</b><small>${esc(note)}</small></span>${ui.icon ? ui.icon("chevR",14) : ""}</button>`;
    const character = esc(name());
    return `<section class="care-v2-room-scene" aria-label="${character}的蓝白科技小房间"><img class="care-v2-room-backdrop" src="resource/scene/whale_room_aqua_tech.webp" alt="蓝白色的二次元小房间，配有智能床头屏、鲸鱼抱枕和柔软地毯，与办公室保持同一套科技风格" draggable="false"><div class="care-v2-room-plaque"><span>WHALE'S ROOM</span><strong>一隅小憩</strong></div><div class="care-v2-room-companion"><div class="care-v2-room-speech" role="status" data-phase="hidden" hidden>${esc(roomSpeech())}</div><button type="button" class="care-v2-room-whale" data-care-action="pat" aria-label="摸摸${character}" title="摸摸${character}"><span class="care-v2-room-shadow"></span><img src="${esc(api().outfitSrc(ui.core,'stand',"resource/character/whale_stand.webp"))}" alt="${character}" draggable="false"><span class="care-v2-pat-hearts" aria-hidden="true"><i>♡</i><i>♡</i><i>✧</i></span></button></div><span class="care-v2-room-touch-hint">轻轻点一下，和她打个招呼</span></section>
      <section class="care-v2-room-bottom"><div class="care-v2-bond"><div class="care-v2-bond-title"><h3><b class="care-v2-character-name">${character}</b><span>好感 Lv.${care.lvl}</span></h3></div><div class="care-v2-progress" role="progressbar" aria-label="好感进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><i style="width:${progress}%"></i></div><p class="care-v2-progress-note"><b>${Math.floor(care.xp)} 好感</b><span>${next == null ? "已经是最亲密的伙伴啦" : "距下一级 " + Math.ceil(next - care.xp) + " 点"}</span></p><div class="care-v2-energy"><div><b>她的体力</b><span>${energy.value} / ${energy.max} · 投喂恢复</span></div><div class="care-v2-energy-track" role="progressbar" aria-label="${character}的体力" aria-valuemin="0" aria-valuemax="${energy.max}" aria-valuenow="${energy.value}"><i style="width:${energy.value/energy.max*100}%"></i></div></div></div><div class="care-v2-home-actions">${homeAction("page","feeding","fish","投喂","小零食时间")}${homeAction("page","wardrobe","shirt","换装","挑一套喜欢的")}${homeAction("chat","","chat","聊天","说说今天的事")}${homeAction("page","automation","star","体力管理",window.WhaleAutoCare && WhaleAutoCare.unlocked(ui.core)?"她来照顾大家":"具身开智出舱后开放")}${homeAction("page","companionship","heart","陪伴","每一点都有回应")}${canRecall()?homeAction("recall","","play","回忆","再走一遍我们的路"):""}</div></section>`;
  }
  function nameHTML() {
    return `<form class="care-v2-name-form dg-card" data-care-name-form><span class="care-v2-eyebrow">属于她自己的名字</span><h3>怎么称呼你身边的她？</h3><label for="care-name-input">名字</label><input id="care-name-input" name="whaleName" type="text" value="${esc(name())}" maxlength="12" autocomplete="off" aria-describedby="care-name-note care-name-feedback"><p id="care-name-note">最多 12 个字。名字会随本局存档保存，模型名字保持独立。</p><p id="care-name-feedback" class="care-v2-name-feedback" role="status"></p><div class="care-v2-actions"><button type="submit" class="dg-btn dg-btn-primary">保存名字</button>${button("page", "affection", "取消")}</div></form>`;
  }
  function companionshipHTML() {
    const cfg = ui.core.cfg.WHALE_CARE, buffs = api().bonuses(ui.core);
    return `<div class="care-v2-rules"><section class="dg-card"><h3>每天一点陪伴</h3><dl class="care-v2-rule-list"><div><dt>聊天 <b>+${cfg.XP.CHAT}</b></dt><dd>每天 ${cfg.CHAT_DAILY_CAP} 次</dd></div><div><dt>拖动 <b>+${cfg.XP.DROP}</b></dt><dd>每周 ${cfg.DROP_WEEKLY_CAP} 次</dd></div><div><dt>清除幻觉 <b>+${cfg.XP.ARCADE}</b></dt><dd>每周 ${cfg.ARCADE_WEEKLY_CAP} 次</dd></div><div><dt>评审 <b>+${cfg.XP.REVIEW}</b></dt><dd>每阶段一次</dd></div></dl><p class="care-v2-muted">次数按游戏日计算，暂停和读档不会刷新。</p></section>
      <section class="dg-card"><h3>相伴的小奖励</h3><div class="care-v2-bonus"><span class="care-v2-eyebrow">好感 Lv.${cfg.BUFFS.REST_LEVEL}</span><strong>休息恢复 +${Math.round(cfg.BUFFS.REST_BONUS * 100)}%</strong><small>${buffs.rest ? "已生效" : "达到等级后生效"}</small></div><div class="care-v2-bonus"><span class="care-v2-eyebrow">好感 Lv.${cfg.BUFFS.OUTPUT_LEVEL}</span><strong>产出 +${Math.round(cfg.BUFFS.OUTPUT_BONUS * 100)}%</strong><small>${buffs.output ? "已生效" : "达到等级后生效"}</small></div></section></div>`;
  }
  function feedingHTML() {
    const care = api().ensure(ui.core), cfg = ui.core.cfg.WHALE_CARE;
    const status = api().feedingStatus(ui.core), capped = status.rewardRemaining === 0;
    const ceiling = status.energy.ceiling == null ? status.energy.max : status.energy.ceiling;
    const growthAvailable = status.energy.max < ceiling && (cfg.SNACKS || []).some(snack => Number(snack.capacity) > 0);
    const note = capped && !status.energyAfterCap ? growthAvailable ? "好感已领完，大米饭仍可提升上限；每周投喂次数不变。" : "本阶段投喂已用完，下一阶段恢复次数。" : status.xpRoom === 0 ? "好感已满，投喂仍可补体力；每周投喂次数不变。" : capped ? "好感已领完，仍可付费补体力；每周投喂次数不变。" : "投喂补充她的体力，托管工作会消耗。";
    return `<div class="care-v2-feed-reserve"><span>她的体力 <b>${status.energy.value} / ${status.energy.max}</b></span><span>上限可成长至 <b>${ceiling}</b></span></div><div class="care-v2-quota"><span>本周投喂 <b>${care.feedsThisWeek} / ${status.weeklyMax}</b></span><span>好感奖励剩余 <b>${status.xpRoom === 0 ? 0 : status.rewardRemaining} 次</b></span></div><div class="care-v2-grid care-v2-feeding">${(cfg.SNACKS || []).map(snack => {
      const capacity = Math.max(0, Math.floor(Number(snack.capacity)||0));
      const capacityGain = Math.min(Math.max(0, ceiling - status.energy.max), capacity);
      // The enlarged pool is available during this same feed: a full 100/100
      // can become 120/120, rather than showing a misleading +0 preview.
      const recovery = Math.min(status.energy.max + capacityGain - status.energy.value, Math.max(0, Math.floor(Number(snack.energy)||0)));
      const xp = capped ? 0 : Math.min(status.xpRoom, Math.max(0, Number(snack.xp)||0));
      const disabled = care.feedsThisWeek >= status.weeklyMax || ui.core.state.funding < snack.cost || capped && !status.energyAfterCap && capacityGain === 0 || capacityGain === 0 && recovery === 0 && xp === 0;
      return `<section class="dg-card care-v2-item${capacity > 0 ? " care-v2-growth-card" : ""}" aria-label="${esc(snack.name)}"><img class="care-v2-snack" src="${esc(snack.img)}" alt="${esc(snack.name)}"><h3>${esc(snack.name)}</h3>${capacity > 0 ? '<span class="care-v2-growth-label">提升体力上限</span>' : ''}<p class="care-v2-benefits">${capacity > 0 ? `<span class="care-v2-capacity-benefit">上限 <b>+${capacityGain}</b>${capacityGain === 0 ? ' · 已达上限' : ''}</span>` : ''}<span>好感 <b>+${xp}</b></span><span>本次体力 <b>+${recovery}</b></span></p><strong class="care-v2-snack-price">${esc(money(snack.cost))}</strong>${button("feed", snack.id, "投喂", disabled, true)}</section>`;
    }).join("")}</div><p class="care-v2-muted">${note}</p>${room.line ? `<p class="care-v2-line" role="status">「${esc(speech(room.line))}」</p>` : ""}`;
  }
  function collectionHTML(wardrobe) {
    const list = api().wardrobe(ui.core);
    const interaction = row => !!(row.unlock && (row.unlock.follow === true || row.unlock.videoTriple === true));
    // Viewing art is read-only. Wearing and receipt checks retain their gates.
    const selected = list.find(row => row.id === room.preview);
    const reward = window.FollowOutfit, rewardStatus = reward ? reward.status(ui.core) : {busy:false,tip:""};
    const followControls = row => {
      if (!interaction(row) || row.unlocked) return "";
      const unconfigured = row.unlock.videoTriple === true && !(reward && reward.validBvid(row.unlock.videoBvid)), disabled = rewardStatus.busy || row.enabled === false;
      return `${unconfigured ? '<p class="care-v2-follow-note">指定视频待配置，暂不开放领取；可先预览。</p>' : ''}${row.enabled === false ? '<p class="care-v2-follow-note">这套时装暂不开放领取。</p>' : ''}<div class="care-v2-follow-actions">${row.unlock.follow === true ? button("follow-author", row.id, "前往关注", disabled) : ''}${row.unlock.videoTriple === true ? button("video-author", row.id, "前往视频三连", disabled) : ''}${button("follow-claim", row.id, rewardStatus.busy ? rewardStatus.phase==='navigating' ? "正在跳转…" : "正在核验…" : "核验领取", disabled || unconfigured, true)}</div>`;
    };
    const followNote = rewardStatus.tip ? `<p class="care-v2-follow-note" role="status">${esc(rewardStatus.tip)}</p>` : "";
    if (selected) return `<figure class="care-v2-preview"><div class="care-v2-preview-art"><img src="${esc(selected.fullImg || selected.img)}" alt="${esc(selected.name)}"></div><figcaption><strong>${esc(selected.name)}</strong>${selected.hint ? "<span>" + esc(selected.hint) + "</span>" : ""}${selected.desc ? "<span>" + esc(selected.desc) + "</span>" : ""}${followControls(selected)}${followNote}<div class="care-v2-actions">${button("preview-close", "", wardrobe?"返回换装":"返回相册")}${selected.kind==='outfit'&&selected.unlocked?button('equip',selected.id,selected.equipped?'正在穿着':'换上这套',selected.equipped,true):''}</div></figcaption></figure>`;
    // A receipt card has complete conditions and separate action buttons. Small
    // screens paginate instead of shrinking text or hiding those actions.
    const pageSize = window.innerHeight <= 450 || window.innerWidth <= 420 ? 1 : window.innerWidth <= 700 ? 2 : window.innerHeight <= 700 ? 3 : 6;
    if (room.pageSize !== pageSize) room.index = Math.floor(room.index * room.pageSize / pageSize);
    room.pageSize = pageSize;
    const pages = Math.max(1, Math.ceil(list.length / pageSize)); room.index = Math.max(0, Math.min(pages - 1, room.index));
    return `${wardrobe ? (window.innerHeight <= 450 ? "" : `<div class="care-v2-collection-intro"><p>穿上喜欢的衣服，一起上班。</p>${button("equip", "default", "默认装扮")}</div>`) : "<p>每张表情，都是一起经历过的小故事。点亮后可以看大图。</p>"}${followNote}<div class="care-v2-grid" data-care-page-size="${pageSize}">${list.slice(room.index * pageSize, room.index * pageSize + pageSize).map(row => `<section class="dg-card care-v2-item${row.unlocked ? "" : " dg-card-locked"}${interaction(row)?' care-v2-follow-item':''}"><button type="button" class="care-v2-picture" data-care-action="preview" data-id="${esc(row.id)}" aria-label="预览${esc(row.name)}"><img src="${esc(row.img)}" alt="${esc(row.name)}"></button><h3>${esc(row.name)}</h3><small class="care-v2-unlock">${esc(row.unlocked ? (row.equipped ? "正在穿着 ✓" : "已解锁") : row.hint)}</small>${followControls(row)}${(wardrobe || row.kind === "outfit") && row.unlocked ? button("equip", row.id, row.equipped ? "已穿上" : "换上这套", row.equipped,true) : ""}</section>`).join("")}</div>${!list.length ? "<p class=\"care-v2-muted\">衣柜正在准备中，可用装扮加载完成后会出现在这里。</p>" : ""}${pages > 1 ? `<nav class="care-v2-actions care-v2-pager" aria-label="衣柜分页">${button("index", room.index - 1, "上一页", room.index <= 0)}<span aria-live="polite">${room.index + 1} / ${pages}</span>${button("index", room.index + 1, "下一页", room.index >= pages - 1)}</nav>` : ""}`;
  }
  function body() {
    if (!available()) return "<p>鲸鱼房暂未开放。</p>";
    const page = room.page;
    const compactWardrobe = page === "wardrobe" && window.innerHeight <= 450 && !room.preview;
    const guide=window.WhaleAutoCare,step=guide&&guide.guideStep(ui.core),guideHTML=guide&&guide.guideHTML(ui.core,true)||"";
    return `<div class="care-v2-content" data-care-page="${esc(page)}" data-care-preview="${room.preview ? 'true' : 'false'}" data-care-guide="${step==null?"":step}">${guideHTML}${page !== "affection" ? `<div class="care-v2-page-nav">${button("page", "affection", "返回鲸鱼房")}<span>${page === "feeding" ? "小零食时间" : page === "wardrobe" ? "挑一套喜欢的装扮" : page === "companionship" ? "每一点陪伴，都有回应" : page === "automation" ? "" : "一起经历的小故事"}</span>${compactWardrobe ? button("equip", "default", "默认装扮") : ""}</div>` : ""}${page === "feeding" ? feedingHTML() : page === "wardrobe" ? collectionHTML(page === "wardrobe") : page === "companionship" ? companionshipHTML() : page === "automation" && window.WhaleAutoCare ? WhaleAutoCare.panelHTML(ui.core) : affectionHTML()}</div>`;
  }
  function refresh() {
    if (room.panel && (!available() || ui.core.state !== room.state)) { room.panel.close(); return; }
    if (room.panel && room.panel.host.isConnected) {
      const scrollBody = room.panel.body, previousPage = scrollBody.querySelector('.care-v2-content');
      const pageChanged = !previousPage || previousPage.dataset.carePage !== room.page, scrollTop = scrollBody.scrollTop;
      const scene = room.page === 'affection' && room.panel.body.querySelector('.care-v2-room-scene');
      if (scene) {
        const next = document.createElement('div'); next.innerHTML = body();
        const currentGuide=room.panel.body.querySelector('.care-auto-guide'),nextGuide=next.querySelector('.care-auto-guide');
        const currentContent=room.panel.body.querySelector('.care-v2-content'),nextContent=next.querySelector('.care-v2-content');
        if(currentContent&&nextContent)currentContent.dataset.careGuide=nextContent.dataset.careGuide;
        if(currentGuide&&nextGuide)currentGuide.replaceWith(nextGuide);else if(currentGuide)currentGuide.remove();else if(nextGuide&&currentContent)currentContent.prepend(nextGuide);
        const nextScene = next.querySelector('.care-v2-room-scene');
        const image = scene.querySelector('.care-v2-room-whale > img'), nextImage = nextScene.querySelector('.care-v2-room-whale > img');
        if (image.getAttribute('src') !== nextImage.getAttribute('src')) image.src = nextImage.getAttribute('src');
        image.alt = nextImage.alt;
        scene.setAttribute('aria-label',nextScene.getAttribute('aria-label'));
        const pet = scene.querySelector('.care-v2-room-whale'), nextPet = nextScene.querySelector('.care-v2-room-whale');
        pet.setAttribute('aria-label',nextPet.getAttribute('aria-label')); pet.title = nextPet.title;
        room.panel.body.querySelector('.care-v2-room-bottom').replaceWith(next.querySelector('.care-v2-room-bottom'));
      } else if (pageChanged || room.page !== 'name') room.panel.body.innerHTML = body();
      syncSpeech();
      room.panel.card.classList.toggle('care-v2-room-home',room.page === 'affection');
      room.panel.card.classList.toggle('care-v2-automation',room.page === 'automation');
      const title = {affection:"鲸鱼房",feeding:"投喂",wardrobe:"换装",companionship:"陪伴规则",automation:"团队体力管理",name:"修改名字"}[room.page] || "鲸鱼房";
      room.panel.card.querySelector('.modal-title > span').textContent = title;
      room.panel.card.setAttribute('aria-label', title); room.panel.fit();
      // Navigation starts at the heading; care/asset/resize updates keep the reader's place.
      scrollBody.scrollTop = pageChanged ? 0 : scrollTop;
    }
  }
  function open(page) {
    if (page && !["affection","feeding","wardrobe","companionship","automation"].includes(page)) return false;
    if (!available() || !window.V2Panels || !ui.core.state || ui.core.state.phase !== "office" || ui.core.state.minigame || ui.core.state.officeModal || ui._embodiedPodExitBusy) return false;
    if (room.panel) { room.page = page || "affection"; room.preview = ""; room.index = 0; if(window.FollowOutfit)window.FollowOutfit.sync(ui.core); refresh(); return true; }
    api().attach(ui.core); api().activate(ui.core); loadOutfits();
    if(window.FollowOutfit)window.FollowOutfit.sync(ui.core);
    room.page = page || "affection"; if(window.WhaleAutoCare)WhaleAutoCare.guidePage(ui.core,room.page); room.preview = ""; room.line = ""; room.patLine = ""; room.patTalking = null; room.index = 0; room.core = ui.core; room.state = ui.core.state;
    const release = window.OfficePause ? OfficePause.acquire(ui.core, "whale-room") : () => {};
    try {
      room.panel = V2Panels.open({ title: ({feeding:"投喂",wardrobe:"换装",companionship:"陪伴规则",automation:"团队体力管理",name:"修改名字"}[room.page] || "鲸鱼房"), icon: "heart", className: "care-v2-card" + (room.page === 'affection' ? ' care-v2-room-home' : room.page === 'automation' ? ' care-v2-automation' : ''), layout:"responsive", body: body(), onClose() { if(window.FollowOutfit)window.FollowOutfit.cancel(room.core); clearTimeout(room.patTimer); room.patTimer = 0; stopSpeech(); room.panel = null; room.core = null; room.state = null; release(); if(window.WhaleAutoCare)WhaleAutoCare.guideDismiss(ui.core); } });
      room.panel.host.classList.add('care-v2-host');
    } catch (error) { release(); throw error; }
    room.panel.body.addEventListener('submit', event => {
      const form = event.target.closest('[data-care-name-form]');
      if (!form || !room.panel || !room.panel.body.contains(form)) return;
      event.preventDefault(); event.stopPropagation();
      if (!available() || room.state !== ui.core.state) return;
      const input = form.querySelector('#care-name-input'), value = input.value.trim();
      if (!value) { form.querySelector('#care-name-feedback').textContent = '请输入她的名字。'; input.focus(); return; }
      const saved = ui.core.setWhaleName(value);
      if (ui.save && ui.save.autoSave) ui.save.autoSave(ui.core.state);
      if (window.GameBus) GameBus.emit('whale:name', {name:saved});
      room.page = 'affection'; refresh(); refreshScene();
      if (window.OfficeBubbles) OfficeBubbles.refresh();
      if (window.SFX) SFX.play('confirm');
      if (ui.toast) ui.toast('名字已改为「' + saved + '」');
    });
    room.panel.body.addEventListener("click", event => {
      const target = event.target.closest("[data-care-action]");
      if (!target || !room.panel.body.contains(target) || target.disabled) return;
      ui._clickHandled = true; ui._pressTarget=null; event.preventDefault();event.stopPropagation();
      const action = target.dataset.careAction, id = target.dataset.id;
      // The temporarily hidden rename page cannot be reached by stale markup.
      if (action === 'page' && id === 'name') return;
      if(action.startsWith("guide-")&&window.WhaleAutoCare){WhaleAutoCare.guideAction(ui.core,action);refresh();return;}
      if (action === "pat") {
        nextPatLine(); showSpeech();
        room.pats++;
        target.classList.remove('is-patted-a','is-patted-b');
        target.classList.add(room.pats % 2 ? 'is-patted-a' : 'is-patted-b');
        clearTimeout(room.patTimer);
        room.patTimer = setTimeout(() => { target.classList.remove('is-patted-a','is-patted-b'); room.patTimer = 0; },650);
        if (window.SFX) SFX.play('float',{vol:.3});
        return;
      }
      if (window.SFX) SFX.play(action === "feed" || action === "equip" ? "confirm" : "click");
      if (action === "follow-author" || action === "video-author" || action === "follow-claim") {
        const panel = room.panel, core = ui.core, state = core.state;
        const reward = window.FollowOutfit;
        if (!reward) { if(ui.toast)ui.toast("互动领取暂时不可用，请刷新后重试。"); return; }
        const task = action === "follow-author" ? reward.navigate(core) : action === "video-author" ? reward.navigateVideo(core, id) : reward.claim(core, id);
        refresh();
        task.then(result => { if(room.panel!==panel || ui.core!==core || core.state!==state || !result || result.reason==='stale')return; if(result.tip&&ui.toast)ui.toast(result.tip); refresh(); if(result.ok)refreshScene(); });
        return;
      }
      if (action === "recall") {
        if (!canRecall()) { refresh(); return; }
        // Release the room's pause receiver before the finale takes over.
        // This independent action never reaches the document replay handler.
        room.panel.close();
        LifeFinale.open({ replay: true });
        return;
      }
      if (action === "page") { room.page = id; room.index = 0; room.preview = ""; if(id==='wardrobe'&&window.FollowOutfit)window.FollowOutfit.sync(ui.core); if(window.WhaleAutoCare)WhaleAutoCare.guidePage(ui.core,id); }
      if (action === "index") room.index = Number(id);
      if (action === "preview") room.preview = id;
      if (action === "preview-close") room.preview = "";
      if (action === "feed") { const result = api().feed(ui.core, id); room.line = result.line || ""; if (result.ok && typeof ui.updateOfficeMain === "function") ui.updateOfficeMain(); if (ui.toast) ui.toast(result.ok ? speech(result.tip) : result.tip); }
      if (action === "equip") { const result = api().equip(ui.core, id); if (ui.toast) ui.toast(result.tip); if (result.ok) refreshScene(); }
      if(action === "auto-tab" && window.WhaleAutoCare)WhaleAutoCare.panelTab(ui.core,id);
      if (action === "auto-toggle" && window.WhaleAutoCare) { const result=WhaleAutoCare.toggle(ui.core,id); if(ui.toast)ui.toast(result.tip); }
      if (action === "chat") { room.panel.close(); const target = document.createElement("button"); target.dataset.action = "office-modal"; target.dataset.id = "test"; ui.onClick({ target, preventDefault() {} }); return; }
      refresh();
      if (action === 'page' && id === 'name') room.panel.body.querySelector('#care-name-input').focus({preventScroll:true});
    });
    showSpeech();
    return true;
  }
  ui.openWhaleRoom = open;
  // Main navigation is shared by several wrappers (including travel and
  // factory). Close this independent host before any destination handles the
  // actual click, so it cannot remain above the newly opened office panel.
  document.addEventListener('click', event => {
    const target = event.target && event.target.closest && event.target.closest('[data-action]');
    if (!room.panel || !target || target.disabled || room.panel.host.contains(target) || !ui.el.contains(target)) return;
    if (target.dataset.action === 'office-modal' || ['open-settings','open-save','open-codex','open-rank'].includes(target.dataset.action)) room.panel.close();
  }, true);
  window.WhaleRoom = { open, body, refresh, loadOutfits, close:()=>{if(room.panel)room.panel.close();}, isOpen: () => !!room.panel };
  window.addEventListener("resize", refresh);
  const core = window.GameCore;
  if (core) for (const name of ["loadState", "newGame"]) {
    const original = core[name];
    if (typeof original === "function") core[name] = function () { const result = original.apply(this, arguments); refresh(); return result; };
  }
  for (const name of ["init", "launch"]) { const original = ui[name]; if (typeof original === "function") ui[name] = function () { const result = original.apply(this, arguments); if (ready()) { api().attach(this.core); loadOutfits(); } return result; }; }
  if (window.GameBus) {
    GameBus.on("follow-outfit:changed", () => { refresh(); refreshScene(); });
    for (const type of ["care:changed", "week:start", "stage:start"]) GameBus.on(type, () => { loadOutfits(); refresh(); });
    GameBus.on("phase", () => { if (room.panel && (!ui.core || ui.core.state.phase !== "office")) room.panel.close(); });
  }
})();
