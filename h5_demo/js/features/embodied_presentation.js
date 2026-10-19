/* V5 presentation consumes persistent progression and real review results only. */
(function () {
  'use strict';
  const ui=window.GameUI;if(!ui)return;
  const sessions=new WeakMap();
  let overlay=null,release=null,owner=null,transition=false,podTimer=null,whiteRun=null;
  const reduced=()=>!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc=v=>ui.escHtml(String(v==null?'':v));
  const story=v=>esc(ui.core.fillWhaleText?ui.core.fillWhaleText(v):v);
  const num=v=>Math.round(Number(v)||0).toLocaleString('zh-CN');
  const ceiling=v=>Math.ceil(Number(v)||0).toLocaleString('zh-CN');
  const resource=v=>window.ResourcePaths?ResourcePaths.canonical(String(v)):String(v);
  const asset=(key,fallback)=>resource(((ui.core.cfg.EMBODIED||{}).ASSETS||{})[key]||fallback);
  const sound=(key,vol=.5,options={})=>window.SFX?.play(key,{vol,...options});
  const allowed=u=>!!(u.core.embodiedAvailable&&u.core.embodiedAvailable());
  function cancelWhite(){
    const run=whiteRun;if(!run)return;
    whiteRun=null;transition=false;run.cancelled=true;
    if(run.timer!=null)clearTimeout(run.timer);
    if(run.raf!=null)cancelAnimationFrame(run.raf);
    run.fade.removeEventListener('transitionend',run.onEnd);run.fade.remove();
  }
  function whiteTransition(){
    if(transition||whiteRun)return;
    transition=true;
    const fade=document.createElement('div');fade.className='embodied-white-transition';fade.setAttribute('aria-hidden','true');document.body.appendChild(fade);
    const run={state:ui.core.state,ver:ui.core.state.ver,phase:ui.core.state.phase,fade,timer:null,raf:null,accepted:false,leaving:false,ready:false,cancelled:false,onEnd:null};
    whiteRun=run;
    const valid=()=>whiteRun===run&&!run.cancelled&&ui.core.state===run.state;
    const remove=()=>{if(whiteRun===run)cancelWhite();};
    const onWhite=()=>{
      if(!valid()||run.state.ver!==run.ver||run.state.phase!==run.phase){remove();return;}
      if(run.ready)return;run.ready=true;
      if(run.timer!=null){clearTimeout(run.timer);run.timer=null;}
      // The fallback also reaches a fully opaque frame before changing the office.
      fade.style.transition='none';fade.style.opacity='1';fade.classList.add('is-white');
      run.raf=requestAnimationFrame(()=>{
        run.raf=null;if(!valid()||run.state.ver!==run.ver||run.state.phase!==run.phase){remove();return;}
        const ok=ui.core.acceptEmbodiedEra();dispose();transition=false;run.accepted=!!ok;
        if(!ok){remove();ui.toast('阶段状态已变化，请重新进入下一阶段');ui.render();return;}
        ui._v2aOfficeFocused=false;ui.render();
        run.raf=requestAnimationFrame(()=>{
          run.raf=null;if(!valid()){remove();return;}
          run.leaving=true;fade.style.transition='';fade.style.opacity='';fade.classList.remove('is-white');
          run.timer=setTimeout(remove,reduced()?0:650);
        });
      });
    };
    run.onEnd=e=>{
      if(e.target!==fade||e.propertyName!=='opacity')return;
      if(run.leaving)remove();else if(!run.accepted)onWhite();
    };
    fade.addEventListener('transitionend',run.onEnd);sound('confirm');
    run.raf=requestAnimationFrame(()=>{
      run.raf=null;if(!valid()){remove();return;}
      // Flush the transparent starting style so browsers animate the inserted layer.
      fade.getBoundingClientRect();fade.classList.add('is-white');
      if(reduced())run.raf=requestAnimationFrame(onWhite);
      else run.timer=setTimeout(onWhite,650);
    });
  }
  function dispose(){
    if(overlay)overlay.remove();overlay=null;
    if(release)release();release=null;owner=null;
    if(podTimer){clearInterval(podTimer);podTimer=null;}
    ui._embodiedPodExitBusy=false;
  }
  function mount(kind,content){
    if(overlay&&overlay.dataset.kind===kind&&owner===ui.core.state){if(!overlay.isConnected)ui.el.appendChild(overlay);return overlay;}
    dispose();owner=ui.core.state;
    if(window.OfficePause)release=OfficePause.acquire(ui.core,'embodied-story');
    overlay=document.createElement('section');overlay.className='embodied-overlay';overlay.dataset.kind=kind;
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.innerHTML=content;ui.el.appendChild(overlay);
    for(const type of ['pointerdown','pointerup'])overlay.addEventListener(type,e=>{e.stopPropagation();ui._pressTarget=null;});
    overlay.addEventListener('click',e=>{
      e.stopPropagation();ui._clickHandled=true;ui._pressTarget=null;
      if(overlay===e.currentTarget&&owner===ui.core.state&&!e.target.closest('button,a,input,select,textarea,[role="button"]')&&overlay._advance)overlay._advance();
    });
    const button=overlay.querySelector('button');if(button)button.focus({preventScroll:true});
    return overlay;
  }
  function stepAction(el,selector,action){
    const run=()=>{if(el===overlay&&el.isConnected&&owner===ui.core.state&&!transition)action();};
    el._advance=run;
    el.querySelector(selector).onclick=e=>{e.stopPropagation();ui._clickHandled=true;ui._pressTarget=null;run();};
  }
  function intro(){
    const st=ui.core.embodiedStatus(),inviter=esc(st.inviter||'团队工程师');
    const el=mount('intro',`<div class="embodied-story-card"><header><span class="embodied-kicker">NEXT CHAPTER · 具身智能</span><h1>从屏幕之内，走向真实世界</h1><p>${story('一次来自老朋友的邀请，为小鲸鱼打开了新的门。')}</p></header>
      <div class="embodied-comic-strip">
        <article style="--panel:0"><div class="embodied-comic-art" role="img" aria-label="工程师向团队介绍大学前辈"></div><span class="embodied-panel-no">01 · 一通电话</span><p><b>${inviter}</b>：「我大学时的前辈，现在是大厂具身智能研发负责人。看完我们的模型，他想来聊聊。」</p></article>
        <article style="--panel:1"><div class="embodied-comic-art" role="img" aria-label="具身智能研发负责人带来合作邀请"></div><span class="embodied-panel-no">02 · 新的伙伴</span><p>前辈：「你们已经让 AI 学会理解、推理与协作。我想加入团队，和大家一起让它看懂空间，学会行动。」</p></article>
        <article style="--panel:2"><div class="embodied-comic-art" role="img" aria-label="团队携手走进新实验室"></div><span class="embodied-panel-no">03 · 走进现实</span><p>${story('一间新的实验室、十二个工位，以及一座安静的休眠仓。鲸鱼娘的下一次成长，将发生在真实世界。')}</p></article>
      </div><footer><small class="embodied-story-progress" aria-live="polite"></small><div class="embodied-story-controls"><button type="button" class="embodied-secondary" data-embodied="previous">上一页</button><button type="button" class="embodied-primary" data-embodied="next">下一句 →</button><button type="button" class="embodied-primary" data-embodied="accept" hidden>开启具身智能时代 →</button></div></footer></div>`);
    el.querySelectorAll('.embodied-comic-art').forEach(panel=>{panel.style.backgroundImage='url('+JSON.stringify(asset('intro','resource/story/embodied_intro.webp'))+')';});
    const e=ui.core.embodiedEra(),page=Math.max(0,Math.min(2,Math.floor(Number(e.introStep)||0)));
    el.dataset.page=page;
    el.querySelectorAll('.embodied-comic-strip article').forEach((panel,n)=>{panel.hidden=n!==page;});
    el.querySelector('.embodied-story-progress').textContent=(page+1)+' / 3 · 点击画面继续';
    el.querySelector('[data-embodied="previous"]').disabled=page===0;
    el.querySelector('[data-embodied="next"]').hidden=page===2;
    el.querySelector('[data-embodied="accept"]').hidden=page!==2;
    el.querySelectorAll('[data-embodied]').forEach(button=>{button.onclick=null;});
    const turn=n=>{e.introStep=n;ui.core.embodiedPersist();sound('click');intro();};
    stepAction(el,page===2?'[data-embodied="accept"]':'[data-embodied="next"]',()=>{
      if(page<2)turn(page+1);else whiteTransition();
    });
    el.querySelector('[data-embodied="previous"]').onclick=event=>{
      event.stopPropagation();ui._clickHandled=true;ui._pressTarget=null;
      if(el===overlay&&owner===ui.core.state&&!transition&&page>0)turn(page-1);
    };
  }
  function tutorial(){
    const st=ui.core.embodiedStatus(),awake=st.awakening||{},req=awake.requirements||[];
    const minWeeks=Math.ceil(awake.minTicks/((ui.core.cfg.V35||{}).TICKS_PER_WEEK||6));
    const configuredRatio=(ui.core.cfg.EMBODIED||{}).AWAKEN_RATIO;
    const ratio=Math.max(0,Math.min(1,configuredRatio==null||!Number.isFinite(Number(configuredRatio))?0.25:Number(configuredRatio)));
    const awakenPercent=Number((ratio*100).toFixed(6));
    const pages=[
      {title:'欢迎来到具身智能实验室',tag:'01 / 04 · 新办公室',body:'这里拥有十二个工位，旧团队与具身智能工程师可以一起工作。右上角的「聚焦办公室」会完整展示全部工位，方便安排每一位工程师。',hint:'办公室是观赏场景，所有功能由左侧按钮进入；工程师头像仍可点击安排。'},
      {title:'让理解与行动接起来',tag:'02 / 04 · 新架构',body:'视觉—语言—动作模型（VLA）已经获得研发授权。它把看到的场景、听到的指令与实际动作连接起来。'+(st.mentorPending?'大学前辈正在等候工位，空出一席后会自动加入。':'大学前辈已作为具身智能 LV4 工程师加入团队。'),hint:'打开「立项」，选择本阶段授权架构；具身智能岗位负责新增的两项能力。'},
      {title:'能力面板也升级了',tag:'03 / 04 · 新能力',body:'原来的代码与文字合并显示为「代码&文字」，安全与稳定合并为「安全&稳定」。原有能力、上限和产出都会相加保留，为新的具身能力留出位置。',hint:'新增能力：'+req.map(d=>d.label).join('、')+'。记忆、推理、工具继续参与模型评审。'},
      {title:'休眠仓还在等待她醒来',tag:'04 / 04 · 具身开智',body:'立项不会直接开仓。正式立项后训练至少 '+minWeeks+' 周，'+req.map(d=>d.label).join('、')+'各达到对应评审达标线的 '+awakenPercent+'%，鲸鱼娘才会开智出舱。',hint:'具体目标随立项参数变化，以休眠仓显示为准。出舱后开放鲸鱼房、投喂、换装与团队托管，并引导你亲自开启托管选项。小游戏一直可玩。'}
    ];
    const i=Math.min(pages.length-1,Math.max(0,st.tutorialStep||0)),p=pages[i];
    const el=mount('tutorial-'+i,`<div class="embodied-tutorial-card"><div class="embodied-kicker">${p.tag}</div><h1>${p.title}</h1><p>${story(p.body)}</p><div class="embodied-tutorial-hint">${story(p.hint)}</div><div class="embodied-step-dots">${pages.map((_,n)=>'<i class="'+(n<=i?'on':'')+'"></i>').join('')}</div><footer><span>游戏已暂停，可以慢慢阅读</span><button class="embodied-primary">${i===pages.length-1?'了解了，去立项 →':'下一步 →'}</button></footer></div>`);
    stepAction(el,'button',()=>{
      ui.core.markEmbodiedTutorial(i===pages.length-1?'done':i+1);sound('click');dispose();
      if(i===pages.length-1){ui.core.state.officeModal='plan';ui.render();}else tutorial();
    });
  }
  function awakening(){
    if(ui._embodiedPodExitBusy)return;
    const sc=ui.core.scene(),fallback=(sc.whale||{}).stand||'resource/character/stand.webp';
    const src=window.WhaleCare?WhaleCare.outfitSrc(ui.core,'stand',fallback):fallback;
    const el=mount('awakening',`<div class="embodied-awakening-card"><span class="embodied-kicker">EMBODIED ONLINE · 具身开智</span><h1>这一次，我真的走到你身边了。</h1><div class="embodied-awakening-stage"><div class="embodied-pod-halo"></div><img class="embodied-awake-pod" src="resource/character/whale_pod.webp" alt="休眠仓正在开启"><img class="embodied-awake-whale" src="${esc(src)}" alt="鲸鱼娘走出休眠仓"><span class="embodied-awake-message">「原来，现实世界是这样的呀！」</span></div><footer><span>具身系统已就绪 · 鲸鱼房现已开放</span><button class="embodied-primary">欢迎醒来 →</button></footer></div>`);
    ui._embodiedPodExitBusy=true;sound('embodiedAwaken',.6);
    let completed=false;
    const done=()=>{
      if(completed||el!==overlay||owner!==ui.core.state)return;completed=true;
      // An older save may retain a screen-pet anchor from the pre-era design.
      // Her first physical appearance starts beside this office's chamber.
      const home=sc.spawn||{x:84,y:81};
      ui.core.state.officeWhalePosition={mode:'scene',bg:sc.bg,x:home.x,y:home.y};
      ui._v2aWhalePoint=null;ui._v2aSceneState=null;
      ui.core.completeBodyAwakening();dispose();if(window.V2OfficeScene)V2OfficeScene.refreshLayout();if(window.WhaleAutoCare)WhaleAutoCare.guidePoll();
    };
    stepAction(el,'button',done);
    let elapsed=0,last=performance.now();
    podTimer=setInterval(()=>{const now=performance.now();if(!el.isConnected||owner!==ui.core.state){dispose();return;}
      if(!document.hidden)elapsed+=Math.min(250,now-last);last=now;
      el.classList.toggle('is-animation-paused',document.hidden);
      if(elapsed>=(reduced()?1200:6500))done();},100);
  }
  function refresh(){
    if(!ui.core||!ui.core.embodiedStatus||!ui.el){cancelWhite();return;}
    if(whiteRun&&(whiteRun.state!==ui.core.state||(!whiteRun.accepted&&(whiteRun.state.ver!==whiteRun.ver||whiteRun.state.phase!==whiteRun.phase))))cancelWhite();
    if(transition)return;
    if(owner&&owner!==ui.core.state)dispose();
    if(overlay&&!overlay.isConnected&&owner===ui.core.state)ui.el.appendChild(overlay);
    const s=ui.core.state;
    // Reconcile the real roster even when an older save already claimed arrival.
    if(s.phase==='office'&&allowed(ui)){
      warmReviewMedia(ui.core);
      const count=(s.engineers||[]).length;ui.core.grantEmbodiedMentor();
      if((s.engineers||[]).length!==count){ui.render();return;}
    }
    const st=ui.core.embodiedStatus(),scene=ui.el.querySelector('.office-scene');
    let notice=ui.el.querySelector('.embodied-mentor-notice');
    if(s.phase==='office'&&allowed(ui)&&st.mentorPending&&scene){
      if(!notice){notice=document.createElement('p');notice.className='embodied-mentor-notice';notice.setAttribute('role','status');scene.appendChild(notice);}
      notice.textContent='前辈正在等候入职：空出一个工位后，具身智能 LV4 工程师将自动加入。';
    }else if(notice)notice.remove();
    if(st.pendingIntro){intro();return;}
    if(s.phase!=='office'){if(overlay)dispose();return;}
    if(!allowed(ui)){if(overlay)dispose();return;}
    if(st.status==='tutorial'){tutorial();return;}
    if(st.bodyAwakened&&!st.podExitSeen){awakening();return;}
    if(overlay)dispose();
  }
  const scenes={
    top:{title:'让世界，看见她的现场',tag:'S · 顶尖 / WHALE LIVE',image:'resource/story/embodied_live.webp',sound:'embodiedLive',beats:[['舞台连接完成','视觉、语言与动作，在同一拍完成协作。'],['聚光灯亮起','鲸鱼娘感知观众、理解指令，把推理变成自然流畅的动作。'],['这一刻，属于整个团队','一次真实世界的精彩演出，也是下一段旅程的开始。']]},
    excellent:{title:'今天的头条，是小鲸鱼',tag:'A · 优秀 / FUTURE NEWS',image:'resource/story/embodied_news.webp',sound:'embodiedNews',beats:[['连线实验室','小鲸鱼完成具身智能阶段评审，团队成果受到关注。'],['从答案到行动','面对真实环境，她能理解空间并完成连续操作。'],['镜头转向幕后','每一次可靠的动作，都来自团队无数次认真训练。']]},
    pass:{title:'第一步，稳稳地迈出去',tag:'B · 合格 / FIELD REPORT',image:'resource/story/embodied_intro.webp',sound:'confirm',beats:[['实地测试开始','把看到的环境转换为可以执行的计划。'],['任务检查完成','本次实地测试完成，团队正在整理评审反馈。'],['下一步，继续拓展边界','把今天的每一份反馈，变成下一次进步。']]},
    fail:{title:'再调整一次，离成功更近一点',tag:'继续训练 / LAB REPORT',image:'resource/story/embodied_intro.webp',sound:'ui',beats:[['实地测试记录','评审发现了需要优先补齐的能力。'],['保留这次经验','回到模型报告，查看具体差距与任务要求。'],['团队仍在这里','从薄弱的环节开始，再试一次。']]}
  };
  const lifeScenes={
    excellent:{variant:'graduation',title:'毕业之后，也要带着好奇心',tag:'A · 优秀 / 她的毕业典礼',image:'resource/story/review_graduation.png',sound:'fanfare',beats:[['一起上完最后一课','她与同学讨论、动手实践，也学会认真倾听不同的答案。'],['接过毕业证','这一次，她用自己的双手，接住了一段努力过的时光。'],['从这里去向世界','教室的门在身后合上，属于她的未来在眼前展开。']]},
    top:{variant:'firstjob',title:'这是我独立完成的第一份工作',tag:'S · 顶尖 / 她的第一份工作',image:'resource/story/review_firstjob.png',sound:'embodiedAwaken',beats:[['任务自己拆解','小鲸鱼观察环境、理解要求，把工作整理成可以执行的步骤。'],['独立完成并交付','从规划到动手，她逐项确认结果，交付了自己负责的任务。'],['获得同事认可','同事认真地说了一声谢谢。她开始找到自己在这个世界的位置。']]}
  };
  function reviewSkin(u,r,ver=u.core.state.ver){
    const embodied=u.core.cfg.EMBODIED||{},assets=embodied.ASSETS||{},order=u.core.cfg.VER_ORDER||[];
    const life=order.indexOf(ver)>=order.indexOf('V5.5')&&order.indexOf('V5.5')>=0&&lifeScenes[r.verdict];
    const preset=life||scenes[r.verdict]||scenes.fail;
    const key=life?(r.verdict==='top'?'firstjob':'graduation'):(r.verdict==='top'?'live':r.verdict==='excellent'?'news':'intro');
    const stage=((assets.REVIEW_BY_STAGE||embodied.REVIEW_BY_STAGE||{})[ver]||{})[r.verdict]||{};
    const growth=(embodied.GROWTH_BY_VER||{})[ver]||{};
    const selected=typeof stage==='string'?{image:stage}:stage;
    const text=v=>u.core.fillWhaleText?u.core.fillWhaleText(v):v;
    const out={...preset,...selected,image:resource(selected.image||assets[key]||preset.image),sprite:selected.showSprite===false?'':resource(selected.sprite||growth.sprite||'')};
    const captions=Array.isArray(selected.beats)?selected.beats:Array.isArray(selected.captions)?selected.captions:preset.beats;
    out.beats=preset.beats.map((fallback,i)=>{const row=captions[i];return(Array.isArray(row)?[row[0]||fallback[0],row[1]||fallback[1]]:row&&typeof row==='object'?[row.title||fallback[0],row.text||row.body||fallback[1]]:[fallback[0],typeof row==='string'?row:fallback[1]]).map(text);});
    out.title=text(out.title);out.tag=text(out.tag);return out;
  }
  // Stage success and the raw review label can differ when an axis/task missed its target.
  function effectiveGrade(core,r=core.state?.result,ver=core.state?.ver){
    if(!r)return null;
    if(['fail','veto'].includes(r.verdict)||r.missionFail===true||r.retry===true||r.missionHit===false||r.mission?.hit===false)return 'fail';
    if(r===core.state?.result&&ver===core.state?.ver&&typeof core.isMissionFail==='function'&&core.isMissionFail())return 'fail';
    return ['pass','excellent','top'].includes(r.verdict)?r.verdict:null;
  }
  // One parser serves the real review and the gallery's committed old records.
  function specialCG(core,r,ver=core.state?.ver){
    const order=core.cfg.VER_ORDER||[],first=order.indexOf('V5'),grade=effectiveGrade(core,r,ver);
    if(first<0||order.indexOf(ver)<first||!grade||r.settled===false||r===core.state?.result&&r.settled!==true)return null;
    const skin=reviewSkin({core},{...r,verdict:grade},ver);
    return{id:ver+':'+grade,ver,verdict:grade,sourceVerdict:r.verdict,src:skin.image,title:skin.title,tag:skin.tag};
  }
  function stop(u){u._embodiedBonusPages?.dispose();const run=sessions.get(u);if(run&&run.timer!=null){clearInterval(run.timer);run.timer=null;}}

  // Only photos the player actually received are recalled, in arrival order.
  // A received photo belongs to its stop's requiredVer chapter, so the settlement
  // never claims the whole stage's authored pictures as unlocked facts.
  function travelMemories(u){
    const c=u.core,s=c.state,out=[],seen=new Set(),api=window.CityJourney;
    const stops=((c.cfg.CITY_JOURNEY||{}).STOPS||[]).filter(node=>node&&typeof node.id==='string');
    const byId=new Map(stops.map(node=>[node.id,node]));
    for(const row of (s.cityJourney&&Array.isArray(s.cityJourney.log)?s.cityJourney.log:[])){
      if(!row||row.type!=='image'||!row.src)continue;
      const src=resource(row.src);if(!src||seen.has(src))continue;
      const node=byId.get(row.nodeId||row.source?.nodeId),ver=node?(api?api.requiredVer(c,node):node.minVer):null;
      // An unresolvable legacy row is still a real received photo; only skip rows we can place elsewhere.
      if(node&&ver!==s.ver)continue;
      seen.add(src);
      out.push({src,caption:row.caption||row.alt||(node&&node.label)||'旅行回忆',nodeId:node&&node.id});
    }
    return out;
  }

  const originalEval=ui.renderEvalShow,originalBonus=ui.renderBonus,originalGoTo=ui.rewardGoTo,originalFeed=ui.bonusFeedCards,originalClick=ui.onClick,originalReadPages=ui.readNodePages;
  function review(u){return originalEval.call(u);}
  function start(){}
  function fanComments(u){
    const config=(u.core.cfg.EMBODIED||{}).USER_FEEDBACK||{};
    const praise=Array.isArray(config.praise)&&config.praise.length?config.praise:[{n:'路过的姐姐',t:'有了身体的小鲸鱼也太可爱了，想和她一起逛街。'},{n:'每天都来看你',t:'看着她一点点长大，好像也陪着她走过了很多新的地方。'}];
    const improve=Array.isArray(config.improve)&&config.improve.length?config.improve:[{n:'等你慢慢长大',t:'有些动作还会犹豫也没关系，希望她继续成长，去看更大的世界。'}];
    return [praise[0],praise[praise.length>1?1:0],improve[0]].map((row,i)=>'<div class="feed-card" style="--fan-delay:'+(i*.12).toFixed(2)+'s;transition-delay:'+(i*.12).toFixed(2)+'s"><span class="feed-avatar">'+esc(String(row.n||'鲸鱼粉丝').charAt(0))+'</span><span><span class="feed-name">'+esc(row.n||'鲸鱼粉丝')+'</span><div class="feed-text">'+story(row.t||'期待她继续成长。')+'</div></span></div>').join('');
  }
  ui.bonusFeedCards=function(){return allowed(this)?'':originalFeed.apply(this,arguments);};
  // The original pager keeps each feed-card as a unit; put comments first so
  // entering this act never opens a numbers-only or ranking-only page.
  ui.readNodePages=function(body,footer,groups,initial,opts){
    if(body?.classList.contains('act2-grid')&&body.closest('.embodied-original-reward')){
      groups=groups.filter(group=>!group.parents.some(node=>node?.classList.contains('embodied-retired-feedback')));
      const comments=group=>group.units.some(unit=>unit.some(node=>node?.classList.contains('feed-card')));
      groups=[...groups].sort((a,b)=>Number(comments(b))-Number(comments(a)));
      initial=0;
    }
    const run=originalReadPages.call(this,body,footer,groups,initial,opts);
    if(body?.classList.contains('act2-grid')&&body.closest('.embodied-original-reward')){
      const layout=run.layout;
      // Translated entrance frames add phantom scroll overflow to the feed-list.
      // Measure its resting cards, then restore the original staggered entrance.
      run.layout=function(){body.classList.add('embodied-measuring-comments');try{return layout.apply(this,arguments);}finally{body.classList.remove('embodied-measuring-comments');}};
    }
    return run;
  };
  /* [feature:cg-envelope-captions-20261015] */
  const cgCaptions={"V5":{"fail":{"title":"失去快乐童年的中转站","description":"没准备好就被推上评审席，笨手笨脚的小鲸鱼只好在中转站和包裹作伴。能力不合格就进评审，你这是要毁了她吗！"},"pass":{"title":"今天也好好做了小朋友","description":"书包、课本、朋友和一小块点心。好好做个普通小朋友，也是值得珍惜的成长。"},"excellent":{"title":"第一次，登上城市新闻","description":"镜头第一次对准了她，小鲸鱼带着一点害羞，把努力的成果介绍给这座城市。"},"top":{"title":"第一次，唱给这个世界听","description":"小小的麦克风握在手里，属于小鲸鱼的第一场演唱会开场了。今天的掌声，也属于陪她成长的你。"}},"V5.5":{"fail":{"title":"补考界的常驻居民","description":"别人去春游，她和越来越厚的补考练习册留在教室里。别急着评审，再陪她补齐这一课吧。"},"pass":{"title":"生活委员，准时到站","description":"记得同学的需要，也把自己的事情安排妥当。小鲸鱼成了让大家放心的生活委员。"},"excellent":{"title":"她的第一张毕业纪念","description":"穿着熟悉的校服，和朋友留下一张毕业合照。第一段青春，终于有了可以收藏的模样。"},"top":{"title":"这个夏天，和朋友一起去海边","description":"暑假、海风和朋友，追着浪花笑个不停。这个夏天，就让小鲸鱼尽情做个快乐的少女。"}},"V6":{"fail":{"title":"黄袍加身，骑手报到","description":"投出的简历还没有回音，小鲸鱼先黄袍加身，骑着电动车认真送好每一份外卖。"},"pass":{"title":"试用期也有自己的工位","description":"试用期的第一天，小鲸鱼终于有了自己的工位。虽然有些紧张，新的生活已经开始。"},"excellent":{"title":"少女，走向更宽广的世界","description":"抱着毕业证和鲜花，回头看一眼熟悉的校园。她已经准备好，去更广阔的世界走走。"},"top":{"title":"今夜，盛装赴约","description":"换上晚礼服，小鲸鱼走进灯光璀璨的宴会厅。今夜，她可以从容地站在聚光灯下。"}},"V6.5":{"fail":{"title":"全自动躺平，暂停营业","description":"机械臂端早餐，扫地机器人打理房间。小鲸鱼把一切交给自动化，宣布今天也暂停营业。"},"pass":{"title":"把小日子过成自己的答案","description":"下班后的热汤和窗外晚霞，都是努力生活的回礼。小鲸鱼把普通的小日子，过成了自己的答案。"},"excellent":{"title":"优秀团队","description":"第一次组建自己的团队，开始带项目了！墨镜一戴，步伐一齐——这个团队，主打一个配合默契。"},"top":{"title":"墨镜一戴，出发去兜风","description":"墨镜一戴，系好安全带，开着跑车穿过熟悉的城市。小鲸鱼把人生的方向盘，稳稳握在自己手里。"}}};
  /* [/feature:cg-envelope-captions-20261015] */
  function captionFor(core,record,ver=core.state?.ver){
    const grade=effectiveGrade(core,record,ver)||record?.verdict,stage=(((core.cfg.EMBODIED||{}).ASSETS||{}).REVIEW_BY_STAGE||{})[ver]?.[grade]||{};
    const fallback=cgCaptions[ver]?.[grade],skin=reviewSkin({core},{...record,verdict:grade},ver);
    const description=typeof stage.description==='string'&&stage.description.trim()?stage.description:fallback?.description||skin.beats.map(row=>row[1]).find(Boolean)||'把这一刻，好好收藏。';
    const fill=value=>core.fillWhaleText?core.fillWhaleText(value):value;
    return {title:skin.title||fallback?.title||'特别回忆',description:fill(description)};
  }
  function freshReward(){return{version:2,part:'photos',photo:0,paused:false,photoFx:{},cg:{stage:'closed',elapsed:0,arrivalElapsed:0,cues:{},firstReveal:false,danmakuPlayed:false,danmakuElapsed:0}};}
  const firstComments={
    V5:{top:['小小歌手，闪闪发光！','这次真是顶尖发挥！','牢梁，今天可以夸她！','第一份掌声送给她。','满分舞台，奶音开麦！','这个小歌手未来可期。','牢梁快看，她笑得多开心。','第一场演唱会就爆满啦。'],excellent:['上新闻的小朋友真棒！','第一次面对镜头呢。','认真长大的样子好可爱。','牢梁，记得给她加餐。','采访里一点也不怯场。','镜头感满分的小朋友。','这波掌声是她应得的。','牢梁，记得存好这份报纸。'],pass:['小朋友今天也进步啦。','书包点心都准备好！','慢慢长大，大家都在。','牢梁，别忘了课间休息。','今天也是乖乖小朋友。','书包背得比昨天稳了。','一点点进步也值得夸。','牢梁，陪她慢慢来。'],fail:['呜呜呜这么小就出来工作了','真的好可怜，童年还给她！','牢梁！出来挨打！','我要哭死了，快接她回家！','她还这么小，别催了。','童年不是用来赶进度的。','牢梁，你良心不会痛吗！','先抱抱她，再说别的。']},
    'V5.5':{top:['这个夏天就去玩吧！','少女的满分假期来了。','牢梁，准她放个假！','把青春好好收藏。','海边这张我能看一整天。','青春就该是这个样子。','牢梁，休假条给她批了！','整个夏天都在发光。'],excellent:['第一张毕业照，真好。','认真走完了这一课。','牢梁，今天请夸夸她。','下一段青春继续加油。','校服真的很适合她。','毕业快乐，前程似锦。','少女终于笑着毕业了。','牢梁，记得送她一束花。'],pass:['生活委员，稳稳到站。','照顾别人也照顾自己。','一点点成长，也很棒。','牢梁，别把她累坏啦。','被大家信任的样子真好。','从今天起她是靠谱的大人。','课代表小鲸鱼上线。','牢梁，也请照顾好她。'],fail:['补考也要留点休息呀。','牢梁，作业别再加了！','先陪她补齐这一课吧。','慢慢来，青春还很长。','练习册都比人高了。','牢梁，别让她一直补考。','青春期也需要喘口气。','等她把这一课补满再出发。']},
    V6:{top:['盛装赴约，气场全开！','今天的她闪闪发光。','牢梁，这次眼光不错！','新生活值得热烈庆祝。','晚礼服也太惊艳了。','宴会厅里最亮的那一位。','牢梁，快准备好请柬。','这一晚，她说了算。'],excellent:['毕业快乐，勇敢出发。','世界很大，慢慢去看。','牢梁，记得送束花呀。','努力终于有了回声。','学士帽抛起来的那一刻。','毕业证拿得稳稳的。','少女要去更远的地方了。','牢梁，祝她一路顺风。'],pass:['第一份工位，打卡！','紧张也没关系，加油。','牢梁，请善待新同事。','独立生活从今天开始。','新工位开张啦。','第一天上班辛苦啦。','慢慢来，都会好起来的。','牢梁，午饭记得请客。'],fail:['先心疼一下赶路的她。','牢梁，别只会催单呀！','认真生活也值得被看见。','下次评审前陪她补课。','黄袍加身也一直在努力。','风雨里也要好好吃饭。','牢梁，别让她跑断腿。','等她说一声“今天收工”。']},
    'V6.5':{top:['方向盘握在自己手里！','这一刻，自由又耀眼。','牢梁，准时下班去兜风。','一路走来，辛苦啦。','跑车配她，绝了。','整座城市的风景都是她的。','牢梁，批准她兜风一整天。','自由的样子真好看。'],excellent:['这支团队，配合真默契。','带着伙伴一起往前走。','牢梁，团建预算批一下！','她也成了可靠的领队。','抬棺舞安排得明明白白。','第一次带项目就这么稳。','团队里有她真让人安心。','牢梁，优胜奖品多发一份。'],pass:['普通日子也闪着光。','热汤晚霞，都是回礼。','牢梁，今天别加班啦。','把生活过成自己的答案。','下班后的晚霞真好。','小日子也有小确幸。','牢梁，让她早点回家。','平凡的一天也值得记录。'],fail:['暂停营业，也该歇歇。','牢梁，让她安心躺会儿！','成熟了也会觉得累呀。','休息好了，再慢慢出发。','全自动躺平也太真实了。','牢梁，别打扰她充电。','累的时候就该停下来。','等她睡饱，再出发。']}
  };
  const commentInterval=1500,commentDuration=5200;
  function commentRows(run){const c=run.u.core,rows=firstComments[run.cg?.ver]?.[run.cg?.verdict]||[];return rows.map(t=>c.fillWhaleText?c.fillWhaleText(t):t);}
  function commentEnd(run){return Math.max(0,(commentRows(run).length-1)*commentInterval+commentDuration);}
  function clearDanmaku(run){run.specialAct?.querySelector('.cg-danmaku')?.replaceChildren();}
  function layoutDanmaku(run){
    const theatre=run.specialAct?.querySelector('.cg-theatre'),host=theatre?.querySelector('.cg-danmaku');if(!host)return;
    const height=Math.max(0,theatre.getBoundingClientRect().height);
    run.commentLanes=Math.max(3,Math.min(8,Math.floor(height/34)));
    run.commentGap=Math.max(20,Math.floor(Math.max(0,height-20)/run.commentLanes));
    host.classList.remove('is-photo-edge','is-compact');
    host.dataset.lanes=String(run.commentLanes);
    Object.assign(host.style,{left:'0px',top:'0px',width:'100%',height:'100%'});
  }
  function paintDanmaku(run,force=false){
    const host=run.specialAct?.querySelector('.cg-danmaku');if(!host)return;const cg=rewardProgress(run.u).cg,elapsed=Number(cg.danmakuElapsed)||0,end=commentEnd(run),loop=run.danmakuLoop===true;
    // 循环播放：首揭后不再“播完就没了”，按整轮时长取模循环播放。
    const phase=loop&&end>0?elapsed%end:elapsed;
    const active=cg.firstReveal===true&&cg.danmakuPlayed===true&&cg.stage==='revealed'&&(loop||elapsed<end);
    host.hidden=!active;if(!active)return;layoutDanmaku(run);if(!run.commentLanes)return;
    if(!host.children.length)host.innerHTML=commentRows(run).map((text,i)=>'<span class="cg-danmaku-line" data-comment="'+i+'">'+esc(text)+'</span>').join('');
    const paused=cinematicPaused(run),visible=[];for(let i=0;i<host.children.length;i++){const age=phase-i*commentInterval;if(age>=0&&age<commentDuration)visible.push(i);}
    // 每条弹幕按航道轮转铺满整片舞台（不再只有 1~2 条重排）。
    [...host.children].forEach((node,i)=>{const shown=visible.includes(i),age=phase-i*commentInterval;node.hidden=!shown;if(!shown){node._commentShown=false;node._commentAge=undefined;return;}node.style.top=(6+(i%run.commentLanes)*(run.commentGap||20))+'px';
      if(!node._commentShown||force||run.commentsPaused!==paused||age!==node._commentAge){node.style.setProperty('--comment-travel',((Number(host.clientWidth)||200)+(Number(node.offsetWidth)||200))+'px');node.style.animationName=reduced()?'cg-comment-fade':'cg-comment-drift';node.style.animationDuration=commentDuration+'ms';const animation=node.getAnimations?.()[0];if(animation){animation.currentTime=Math.max(0,Math.min(commentDuration,age));if(paused)animation.pause();else animation.play();}node._commentShown=true;}
      node._commentAge=age;
    });run.commentsPaused=paused;
  }
  function revealOnce(run){
    const p=rewardProgress(run.u),gallery=window.WhaleGallery;if(p.cg.danmakuPlayed)return;
    const first=!!gallery?.claimSpecialReveal?.(run.u.core,run.cg);p.cg.firstReveal=first;p.cg.danmakuPlayed=true;p.cg.danmakuElapsed=first?0:commentEnd(run);run.danmakuLoop=first;saveProgress(run.u);
  }
  function openCGImage(u,target){
    const run=u._embodiedBonusPages,p=rewardProgress(u);if(!run||!cinematicAlive(run)||p.part!=='special'||p.cg.stage!=='revealed'||cinematicPaused(run)||!window.WhaleGallery?.openSpecialImage)return false;
    run.zoomOpen=true;stopCinematicClock(run);clearCinematicAudio(run);paintCinematic(run,true);
    const close=()=>{if(!cinematicAlive(run))return;run.zoomOpen=false;paintCinematic(run,true);if(target?.isConnected&&!target.disabled)target.focus({preventScroll:true});startCinematicClock(run);};
    if(!WhaleGallery.openSpecialImage(u.core,run.cg,{returnFocus:target,onClose:close})){close();return false;}return true;
  }
  function rewardProgress(u){
    const s=u.core.state;let p=s.embodiedReward;
    if(!p||![1,2].includes(p.version))p=s.embodiedReward=freshReward();
    if(p.version===1){
      // A legacy beat beyond zero means the photograph was already being read.
      // Keep that view silently; beat zero receives the new explicit opening.
      const read=p.part==='original'||p.part==='special'&&Number(p.beat)>0;
      p.version=2;p.paused=false;p.photoFx={};p.cg={stage:read?'revealed':'closed',elapsed:read?1600:0,arrivalElapsed:read?650:0,cues:read?{arrive:true,open:true,reveal:true}:{}};
      delete p.beat;
    }
    if(!p.photoFx||typeof p.photoFx!=='object')p.photoFx={};
    if(!p.cg||typeof p.cg!=='object')p.cg=freshReward().cg;
    if(!p.cg.cues||typeof p.cg.cues!=='object')p.cg.cues={};
    if(!['closed','opening','flying','revealed'].includes(p.cg.stage))p.cg.stage='closed';
    return p;
  }
  function saveProgress(u){if(u.save&&u.save.autoSave)u.save.autoSave(u.core.state);}
  function originalAct(run,n){return Number(n)===2&&(!run?.rankPanel||run.rankPanel.hidden)?3:n;}
  // Bitmap geometry is normalized from the installed images' measured alpha bounds.
  // Alpha >= 16 excludes faint stray pixels around the delivered cardboard edge.
  const envelopeArt={back:{canvas:[1576,998],bounds:[47,135,1482,735]},pocket:{canvas:[1576,998],bounds:[25,124,1527,797]},flap:{canvas:[2001,786],bounds:[22,98,1959,674]},seal:{canvas:[1254,1254],bounds:[73,65,1106,1104]}};
  function envelopeLayer(layer,image=layer){
    return '<span class="cg-envelope-layer cg-envelope-'+layer+'" data-envelope-layer="'+layer+'" aria-hidden="true"><img class="cg-envelope-bitmap" data-envelope-image="'+image+'" src="'+resource((ui.core.cfg.EMBODIED.ASSETS.ENVELOPE||{})[image]||'')+'" alt="" draggable="false"></span>';
  }
  function alignEnvelopeArt(run){
    const envelope=run.specialAct?.querySelector('.cg-envelope');if(!envelope)return;
    for(const image of envelope.querySelectorAll('[data-envelope-image]')){
      const row=envelopeArt[image.dataset.envelopeImage];if(!row)continue;
      const [cw,ch]=row.canvas,[x,y,w,h]=row.bounds;
      image.style.width=(cw/w*100)+'%';image.style.height=(ch/h*100)+'%';image.style.left=(-x/w*100)+'%';image.style.top=(-y/h*100)+'%';
    }
    const back=envelopeArt.back;if(!back)return;const ratio=back.bounds[2]/back.bounds[3];envelope.style.setProperty('--envelope-aspect',String(ratio));
    const seal=envelopeArt.seal;if(seal)envelope.style.setProperty('--envelope-seal-aspect',String(seal.bounds[2]/seal.bounds[3]));
    for(const name of ['pocket','flap']){const row=envelopeArt[name];if(row)envelope.style.setProperty('--envelope-'+name+'-height',(row.bounds[3]/row.bounds[2]*ratio*100)+'%');}
    const flap=envelopeArt.flap;if(flap){const depth=flap.bounds[3]/flap.bounds[2]*ratio;envelope.style.setProperty('--envelope-open-scale',String(.9*ratio/(1+depth)));envelope.style.setProperty('--envelope-open-top',(50+45*depth/(1+depth))+'%');}
  }
  let mediaWarmKey='',mediaWarm=[];
  // Only warm the current stage, not the whole story or its audio. Failed loads
  // are bounded; entering the actual letter provides an explicit retry action.
  function loadReviewImage(image,policy,changed,retry=false){
    const source=image.dataset.cgSource||image.getAttribute('src')||'';
    // This loader owns bounded retries; exclude the menu's generic image retry.
    image.dataset.cgSource=source;image.setAttribute('onerror','');
    let timer=null,attempt=0,closed=false;
    const clear=()=>{if(timer!=null)clearTimeout(timer);timer=null;};
    const done=()=>{if(closed)return;clear();image.dataset.cgLoad='ready';changed();};
    const failed=()=>{if(closed)return;clear();if(attempt<policy.RETRIES){attempt++;timer=setTimeout(()=>start(true),policy.RETRY_DELAY_MS);}else{image.dataset.cgLoad='failed';changed();}};
    const start=bust=>{if(closed)return;clear();image.dataset.cgLoad='loading';changed();timer=setTimeout(failed,policy.TIMEOUT_MS);
      if(bust){const url=new URL(source,document.baseURI);url.searchParams.set('cg_retry',String(Date.now())+'-'+attempt);image.src=url.href;}
      if(image.complete&&image.naturalWidth>0)done();
    };
    image.addEventListener('load',done);image.addEventListener('error',failed);start(retry);
    return()=>{closed=true;clear();image.removeEventListener('load',done);image.removeEventListener('error',failed);};
  }
  function warmReviewMedia(core){
    const c=core.cfg.EMBODIED,policy=c?.REVIEW_MEDIA;if(!policy)return;
    const assets=c.ASSETS||{},urls=[...Object.values(assets.ENVELOPE||{}),...Object.values(assets.REVIEW_BY_STAGE?.[core.state.ver]||{}).map(row=>typeof row==='string'?row:row?.image)].filter(Boolean).map(resource);
    const key=JSON.stringify(urls);if(key===mediaWarmKey)return;
    mediaWarm.forEach(row=>row.dispose());mediaWarm=[];mediaWarmKey=key;
    for(const url of new Set(urls)){const image=new Image();image.src=url;mediaWarm.push({image,dispose:loadReviewImage(image,policy,()=>{})});}
  }
  function watchReviewMedia(run,retry=false){
    if(!run?.specialAct)return;run.mediaCleanup?.();
    const images=[...run.specialAct.querySelectorAll('.cg-envelope-bitmap,.special-cg-image')],cleanup=[];
    run.mediaState='loading';
    const changed=()=>{
      if(!cinematicAlive(run))return;
      const states=images.map(image=>image.dataset.cgLoad),status=states.includes('failed')?'failed':states.every(value=>value==='ready')?'ready':'loading';
      run.mediaState=status;paintCinematic(run,true);
      if(status==='ready')startCinematicClock(run);else stopCinematicClock(run);
    };
    images.forEach(image=>{image.dataset.cgLoad='loading';});
    images.forEach(image=>cleanup.push(loadReviewImage(image,run.u.core.cfg.EMBODIED.REVIEW_MEDIA,changed,retry)));
    run.mediaCleanup=()=>cleanup.forEach(dispose=>dispose());changed();
  }
  function fitReviewMedia(run){
    const space=run.specialAct?.querySelector('.cg-reveal-space');if(!space)return;
    const w=space.clientWidth,h=space.clientHeight;if(!w||!h)return;
    const envelope=space.querySelector('.cg-envelope'),photo=space.querySelector('.cg-photo'),image=space.querySelector('.special-cg-image');
    const layout=run.u.core.cfg.EMBODIED.REVIEW_MEDIA.LAYOUT,bounds=envelopeArt.back.bounds,ratio=bounds[2]/bounds[3],width=Math.min(layout.ENVELOPE_MAX_WIDTH,w*layout.ENVELOPE_WIDTH_RATIO,h*layout.ENVELOPE_HEIGHT_RATIO*ratio);
    envelope.style.width=width+'px';envelope.style.height=width/ratio+'px';
    const photoRatio=image.naturalWidth&&image.naturalHeight?image.naturalWidth/image.naturalHeight:layout.PHOTO_ASPECT,photoWidth=Math.min(w*layout.PHOTO_WIDTH_RATIO,Math.max(0,h-layout.PHOTO_MARGIN)*photoRatio);
    photo.style.width=photoWidth+'px';photo.style.height=photoWidth/photoRatio+'px';
  }

  function cinematicAlive(run){return !run.closed&&run.u._embodiedBonusPages===run&&run.u.core.state===run.state&&run.result===run.state.result&&['bonus','over'].includes(run.state.phase)&&run.root.isConnected;}
  function cinematicPaused(run){return !!(document.hidden||rewardProgress(run.u).paused||run.pageHidden||run.zoomOpen);}
  function clearCinematicAudio(run){run.audioEpoch++;for(const controller of run.audioControllers)controller.abort();run.audioControllers.clear();for(const handle of run.audioHandles)handle.stop?.();run.audioHandles.clear();}
  function cinematicSound(run,key){
    if(!cinematicAlive(run)||cinematicPaused(run))return;
    const epoch=run.audioEpoch,controller=typeof AbortController==='function'?new AbortController():{abort(){},signal:undefined};run.audioControllers.add(controller);
    Promise.resolve(sound(key,.68,{grade:run.cg?.verdict,signal:controller.signal})).then(handle=>{
      run.audioControllers.delete(controller);if(!handle)return;
      if(!cinematicAlive(run)||cinematicPaused(run)||epoch!==run.audioEpoch){handle.stop?.();return;}
      run.audioHandles.add(handle);Promise.resolve(handle.done).then(()=>run.audioHandles.delete(handle));
    }).catch(()=>{});
  }
  function cue(run,key,event){const p=rewardProgress(run.u);if(p.cg.cues[key])return;p.cg.cues[key]=true;saveProgress(run.u);cinematicSound(run,event);}
  function durations(){return reduced()?{open:80,total:240,arrive:180,land:80,photo:180}:{open:520,total:1600,arrive:650,land:400,photo:620};}
  function stopCinematicClock(run){if(run.cinematicTimer!=null){clearInterval(run.cinematicTimer);run.cinematicTimer=null;}}
  function clearSparks(run){run.specialAct?.querySelector('.cg-sparks')?.replaceChildren();}
  function burst(run,opening=false){
    if(reduced())return;const host=run.specialAct?.querySelector('.cg-sparks');if(!host)return;
    host.innerHTML=Array.from({length:opening?6:18},(_,i)=>{const angle=(i*137.5-110)*Math.PI/180,radius=opening?45+i%3*12:82+i%5*24;return'<i class="'+(i%3?'cg-spark-star':'cg-spark-dot')+'" style="--spark-x:'+Math.round(Math.cos(angle)*radius)+'px;--spark-y:'+Math.round(Math.sin(angle)*radius-40)+'px;--spark-turn:'+(i*37)+'deg;--spark-delay:'+(i%4*30)+'ms;--spark-size:'+(i%3?8+i%4*3:4)+'px"></i>';}).join('');
  }
  function photoFx(run){const p=rewardProgress(run.u),key=String(p.photo);return p.photoFx[key]||(p.photoFx[key]={elapsed:0,placed:false});}
  function paintCinematic(run,force=false){
    if(!cinematicAlive(run))return;const p=rewardProgress(run.u),timing=durations(),paused=cinematicPaused(run);
    run.root.classList.toggle('is-cinematic-paused',paused);
    const active=p.part==='special'?run.specialAct:run.photosAct;
    active?.querySelector('[data-action="embodied-reward-pause"]')?.setAttribute('aria-pressed',String(!!p.paused));
    const pause=active?.querySelector('[data-action="embodied-reward-pause"]');if(pause)pause.textContent=p.paused?'继续演出':'暂停演出';
    if(p.part==='photos'){
      const current=run.photosAct.querySelector('figure.is-current'),fx=photoFx(run);run.photosAct.querySelector('[data-action="embodied-reward-next"]').disabled=paused;
      if(current&&(force||run.visualPhoto!==p.photo)){current.style.setProperty('--album-offset','-'+Math.min(timing.photo,Number(fx.elapsed)||0)+'ms');current.classList.toggle('is-settled',Number(fx.elapsed)>=timing.photo);run.visualPhoto=p.photo;}
      return;
    }
    if(p.part!=='special'||!run.specialAct)return;
    const stage=p.cg.stage,theatre=run.specialAct.querySelector('.cg-theatre'),changed=stage!==run.visualStage;
    if(force||changed){
      theatre.classList.toggle('cg-restored',force&&stage==='revealed');theatre.dataset.cgState=stage;theatre.style.setProperty('--cg-opening-offset','-'+Math.min(timing.open,Number(p.cg.elapsed)||0)+'ms');theatre.style.setProperty('--cg-flight-offset','-'+Math.max(0,(Number(p.cg.elapsed)||0)-timing.open)+'ms');theatre.style.setProperty('--cg-arrive-offset','-'+Math.min(timing.arrive,Number(p.cg.arrivalElapsed)||0)+'ms');
      theatre.style.setProperty('--cg-open-duration',timing.open+'ms');theatre.style.setProperty('--cg-flight-duration',(timing.total-timing.open)+'ms');theatre.classList.toggle('is-arrived',Number(p.cg.arrivalElapsed)>=timing.arrive);
      if(changed&&stage==='revealed'&&!force)theatre.classList.add('cg-just-revealed');run.visualStage=stage;
    }
    theatre.dataset.elapsed=String(Math.round(Number(p.cg.elapsed)||0));
    fitReviewMedia(run);
    const media=run.mediaState||'loading',mediaReady=media==='ready',mediaFailed=media==='failed',copy=run.u.core.cfg.EMBODIED.REVIEW_MEDIA.UI;
    theatre.dataset.mediaState=media;
    const retry=run.specialAct.querySelector('[data-action="embodied-cg-retry"]');if(retry){retry.hidden=!mediaFailed;retry.disabled=paused;}
    const ready=stage==='revealed',next=run.specialAct.querySelector('[data-action="embodied-reward-next"]'),envelope=theatre.querySelector('[data-action="embodied-cg-open"]');
    envelope.disabled=stage!=='closed'||paused||!mediaReady;envelope.setAttribute('aria-expanded',String(stage!=='closed'));
    next.disabled=(!ready&&!mediaFailed)||paused;next.textContent=mediaFailed?copy.CONTINUE:ready?'查看模型表现 ➜':'等待这份回忆展开';
    theatre.querySelector('.cg-caption').setAttribute('aria-hidden',String(!ready));theatre.querySelector('.cg-photo').setAttribute('aria-hidden',String(!ready));
    run.specialAct.querySelector('.hint-tip').textContent=paused?'演出已暂停':mediaFailed?copy.FAILED:!mediaReady?copy.LOADING:ready?'特殊 CG 已收藏':stage==='closed'?'小鲸鱼的来信 · 点击拆开':'正在展开这份特别回忆';
    const zoom=theatre.querySelector('[data-action="embodied-cg-zoom"]');if(zoom)zoom.disabled=!ready||paused||!mediaReady;
    paintDanmaku(run,force);
  }
  function advanceCinematic(run,delta){
    if(!cinematicAlive(run)){run.dispose();return;}if(cinematicPaused(run))return;const p=rewardProgress(run.u),t=durations();let pending=false;
    if(p.part==='photos'&&run.photos.length){
      const fx=photoFx(run);fx.elapsed=Math.min(t.photo,(Number(fx.elapsed)||0)+delta);
      if(!fx.placed&&fx.elapsed>=t.land){fx.placed=true;saveProgress(run.u);cinematicSound(run,'albumPhotoPlace');}
      if(fx.elapsed>=t.photo)run.photosAct.querySelector('figure.is-current')?.classList.add('is-settled');pending=fx.elapsed<t.photo;
    }else if(p.part==='special'){
      if(run.mediaState!=='ready'){paintCinematic(run);stopCinematicClock(run);return;}
      const cg=p.cg;
      if(cg.stage==='closed'){cg.arrivalElapsed=Math.min(t.arrive,(Number(cg.arrivalElapsed)||0)+delta);if(cg.arrivalElapsed>=(reduced()?80:400))cue(run,'arrive','cgEnvelopeArrive');pending=cg.arrivalElapsed<t.arrive;}
      else if(cg.stage!=='revealed'){
        cg.elapsed=Math.min(t.total,(Number(cg.elapsed)||0)+delta);
        if(cg.elapsed>=t.open&&cg.stage==='opening'){cg.stage='flying';burst(run);cue(run,'reveal','cgPhotoReveal');saveProgress(run.u);}
        if(cg.elapsed>=t.total){revealOnce(run);cg.stage='revealed';clearSparks(run);saveProgress(run.u);}else pending=true;
      }
      if(cg.stage==='revealed'&&cg.firstReveal===true&&cg.danmakuPlayed===true){const end=commentEnd(run);
        // 循环播放时弹幕永不“结束”，时钟保持运转直到离开这一幕。
        if(run.danmakuLoop===true){cg.danmakuElapsed=(Number(cg.danmakuElapsed)||0)+delta;pending=true;}
        else{cg.danmakuElapsed=Math.min(end,(Number(cg.danmakuElapsed)||0)+delta);pending=cg.danmakuElapsed<end;}
      }
    }
    paintCinematic(run);if(!pending)stopCinematicClock(run);
  }
  function startCinematicClock(run){
    if(!cinematicAlive(run)||cinematicPaused(run)||run.cinematicTimer!=null)return;
    run.lastFrame=performance.now();run.cinematicTimer=setInterval(()=>{const now=performance.now(),delta=Math.max(0,Math.min(100,now-run.lastFrame));run.lastFrame=now;advanceCinematic(run,delta);},40);
  }
  function syncCinematic(run){
    const p=rewardProgress(run.u),key=p.part+':'+(p.part==='photos'?p.photo:'');
    if(run.pageKey!==key){stopCinematicClock(run);clearCinematicAudio(run);clearSparks(run);run.pageKey=key;run.visualStage=null;run.visualPhoto=null;paintCinematic(run,true);}
    else paintCinematic(run);
    if(p.part==='original'){stopCinematicClock(run);return;}startCinematicClock(run);
  }
  function openEnvelope(u){
    const run=u._embodiedBonusPages,p=rewardProgress(u);if(!run||!cinematicAlive(run)||cinematicPaused(run)||p.part!=='special'||p.cg.stage!=='closed'||run.mediaState!=='ready')return false;
    p.cg.stage='opening';p.cg.elapsed=0;p.cg.cues.arrive=true;cue(run,'open','cgEnvelopeOpen');burst(run,true);paintCinematic(run);saveProgress(u);startCinematicClock(run);return true;
  }
  function pauseCinematic(u){
    const run=u._embodiedBonusPages;if(!run||!cinematicAlive(run))return false;const p=rewardProgress(u);p.paused=!p.paused;run.pageHidden=false;
    if(p.paused){stopCinematicClock(run);clearCinematicAudio(run);clearSparks(run);}paintCinematic(run);saveProgress(u);if(!p.paused)startCinematicClock(run);return true;
  }
  function showPrelude(u){
    const run=u._embodiedBonusPages;if(!run||run.closed||run.state!==u.core.state)return;
    const p=rewardProgress(u),cg=run.specialAct;if(p.part==='special'&&!cg)p.part='original';
    const active=p.part==='photos'?run.photosAct:p.part==='special'?run.specialAct:null;
    for(const act of run.root.querySelectorAll('.act')){act.classList.toggle('active',act===active);act.classList.remove('leaving');}
    run.root.dataset.embodiedPart=p.part;
    for(const pill of run.root.querySelectorAll('.step-pill')){const key=pill.dataset.embodiedPart;pill.classList.toggle('active',key===p.part);pill.classList.toggle('done',key==='photos'&&p.part!=='photos'||key==='special'&&p.part==='original');}
    if(!active){syncCinematic(run);if(u.core.state.phase==='over'){u.render();return;}originalGoTo.call(u,originalAct(run,u.core.state.bonusAct||1));return;}
    if(p.part==='photos'){
      p.photo=Math.max(0,Math.min(Math.max(0,run.photos.length-1),Math.floor(Number(p.photo)||0)));
      active.querySelectorAll('figure').forEach((node,i)=>{const current=i===p.photo,depth=p.photo-i;node.hidden=depth<0||depth>2;node.classList.toggle('is-current',current);node.classList.toggle('is-past',depth>0);node.style.setProperty('--album-depth',String(Math.max(0,depth)));node.style.setProperty('--album-turn',String(current?(i%2?2:-2):[-7,6,-4][Math.min(2,Math.max(0,depth-1))])+'deg');node.style.zIndex=String(i+1);node.setAttribute('aria-hidden',String(!current));if(current)node.setAttribute('aria-current','true');else node.removeAttribute('aria-current');});
      const album=active.querySelector('.embodied-photo-album');if(album)album.dataset.photoIndex=String(p.photo);
      active.querySelector('.hint-tip').textContent=run.photos.length?(p.photo+1)+' / '+run.photos.length+' · 本阶段旅行照片':'本阶段尚未收到旅行照片';active.querySelector('[data-action="embodied-reward-next"]').textContent=p.photo+1<run.photos.length?'下一张照片 ➜':cg?'查看特殊 CG ➜':'查看模型表现 ➜';
    }
    syncCinematic(run);
  }
  function stepPrelude(u){
    const run=u._embodiedBonusPages;if(!run||!cinematicAlive(run))return false;const p=rewardProgress(u);if(p.part==='original'||cinematicPaused(run))return false;
    if(p.part==='photos'){if(p.photo+1<run.photos.length)p.photo++;else p.part=run.specialAct?'special':'original';}
    else{if(p.cg.stage!=='revealed'&&run.mediaState!=='failed')return false;if(p.cg.stage!=='revealed')p.cg.mediaSkipped=true;p.part='original';}
    showPrelude(u);saveProgress(u);sound('click',.3);return true;
  }
  function installCinematic(run){
    alignEnvelopeArt(run);
    if(run.specialAct){const retry=document.createElement('button');retry.type='button';retry.className='dg-btn dg-btn-ghost';retry.dataset.action='embodied-cg-retry';retry.textContent=run.u.core.cfg.EMBODIED.REVIEW_MEDIA.UI.RETRY;retry.hidden=true;run.specialAct.querySelector('.act-foot').prepend(retry);watchReviewMedia(run);}
    run.onMediaResize=()=>{if(cinematicAlive(run))fitReviewMedia(run);};
    window.addEventListener('resize',run.onMediaResize);
    if(typeof window.ResizeObserver==='function'){if(run.specialAct){run.mediaObserver=new window.ResizeObserver(run.onMediaResize);run.mediaObserver.observe(run.specialAct.querySelector('.cg-reveal-space'));}}
    for(const act of [run.photosAct,run.specialAct])if(act)act.querySelector('.act-foot').insertAdjacentHTML('afterbegin','<button type="button" class="dg-btn dg-btn-ghost cinematic-pause" data-action="embodied-reward-pause" aria-pressed="false">暂停演出</button>');
    run.onVisibility=()=>{if(!cinematicAlive(run))return;if(document.hidden){stopCinematicClock(run);clearCinematicAudio(run);clearSparks(run);saveProgress(run.u);}paintCinematic(run);if(!document.hidden)startCinematicClock(run);};
    run.onPageHide=()=>{if(!cinematicAlive(run))return;run.pageHidden=true;rewardProgress(run.u).paused=true;stopCinematicClock(run);clearCinematicAudio(run);clearSparks(run);paintCinematic(run);saveProgress(run.u);};
    document.addEventListener('visibilitychange',run.onVisibility);window.addEventListener('pagehide',run.onPageHide);
    run.onAnimation=event=>{if(!cinematicAlive(run)||cinematicPaused(run)||rewardProgress(run.u).part!=='special')return;const cg=rewardProgress(run.u).cg,t=durations();
      if(event.target.classList.contains('cg-envelope-flap')&&event.animationName==='embodied-cg-flap-open'&&cg.stage==='opening')cg.elapsed=t.open;
      else if(event.target.classList.contains('cg-photo')&&event.animationName==='embodied-cg-photo-fly'&&cg.stage==='flying')cg.elapsed=t.total;else return;advanceCinematic(run,0);
    };
    run.specialAct?.querySelector('.cg-envelope-flap')?.addEventListener('animationend',run.onAnimation);run.specialAct?.querySelector('.cg-photo')?.addEventListener('animationend',run.onAnimation);
    const image=run.specialAct?.querySelector('.special-cg-image');if(image){const fit=()=>{if(cinematicAlive(run)&&image.naturalWidth&&image.naturalHeight)run.specialAct.querySelector('.cg-reveal-space').style.setProperty('--cg-ratio',String(image.naturalWidth/image.naturalHeight));};image.onload=fit;if(image.complete)fit();}
  }
  function cloudBonus(u,s,r){
    const run=u._embodiedBonusPages,tc=window.ToyCloud;if(!run?.rankPanel||!run.rankList||window.__TOY_MOCK__||!tc||!tc.available())return Promise.resolve(false);
    const panel=run.rankPanel,list=run.rankList,ver=s.ver;
    const hide=()=>{if(run.closed||u._embodiedBonusPages!==run||u.core.state!==s||s.result!==r)return false;panel.hidden=true;list.innerHTML='';run.root.classList.remove('has-real-cloud-rank');run.root.querySelector('#act-2').hidden=true;run.root.querySelector('#act-2').classList.add('embodied-retired-feedback');run.root.querySelector('.step-pill[data-step="2"]')?.remove();u.mountRewardPages();return false;};
    return Promise.all([tc.fetchBoard('all',ver,false),tc.fetchMine('all',ver,false)]).then(([board,mine])=>{
      if(run.closed||u._embodiedBonusPages!==run||u.core.state!==s||s.result!==r)return false;
      const rows=board&&board.ok&&Array.isArray(board.list)?board.list:[];if(!rows.length)return hide();
      list.innerHTML=rows.map((row,i)=>'<div class="rank-row" style="transition-delay:'+(0.05+i*.06).toFixed(2)+'s"><span class="rank-no">'+num(row.rank||i+1)+'</span><span><span class="rank-name">'+esc(row.nickname||row.name||'玩家')+'</span><div class="rank-meta">真实玩家成绩</div></span><span class="rank-score">'+num(tc.unpackScore(row.score,ver).score)+'</span></div>').join('');
      panel.hidden=false;run.root.classList.add('has-real-cloud-rank');const act=run.root.querySelector('#act-2');act.hidden=false;act.classList.remove('embodied-retired-feedback');act.setAttribute('aria-hidden','false');act.querySelector('.act-title').textContent='真实玩家云榜';act.querySelector('.act-sub').textContent='与真实玩家的本阶段评审成绩对比';act.querySelector('.act2-grid').style.gridTemplateColumns='minmax(0,1fr)';if(!run.root.querySelector('.step-pill[data-step="2"]'))run.root.querySelector('.step-pill[data-step="3"]').insertAdjacentHTML('beforebegin','<span class="step-pill" data-step="2">真实云榜</span>');run.root.querySelector('#act-1 [data-action="bonus-next"] span').textContent='查看真实云榜 ➜';u.mountRewardPages();const pages=u._rewardPages?.stages.get(2);if(pages)pages.layout();return true;
    }).catch(hide);
  }
  function mountOriginalAdditions(u){
    const s=u.core.state,r=s.result||{},root=u.el.querySelector('.aqua-stage');if(!root)return;
    const old=u._embodiedBonusPages;old?.dispose();root.classList.add('embodied-original-reward');
    const body=root.querySelector('.stage-body'),photos=travelMemories(u),candidate=specialCG(u.core,r),p=rewardProgress(u),skin=reviewSkin(u,{...r,verdict:effectiveGrade(u.core,r)||r.verdict});
    if(candidate&&p.part!=='original'&&p.cg.stage!=='revealed'&&!p.cg.firstReveal)p.skipSpecial=!!window.WhaleGallery?.hasSpecialRevealed(u.core,candidate);else if(p.skipSpecial===undefined)p.skipSpecial=false;
    const cg=p.skipSpecial?null:candidate;
    // A restored revealed photo remains readable, while its consumed comments stay silent.
    if(!(old?.state===s&&old?.result===r)&&p.cg.danmakuPlayed)p.cg.danmakuElapsed=commentEnd({u,cg:candidate});
    const create=(id,title,sub,content)=>{const act=document.createElement('section');act.className='act embodied-reward-memory';act.id=id;act.innerHTML='<div class="act-head"><span class="pass-badge">'+esc(s.ver)+' · 旅程回忆</span><h1 class="act-title">'+esc(title)+'</h1><p class="act-sub">'+esc(sub)+'</p></div><div class="glass-card embodied-reward-picture">'+content+'</div><div class="act-foot"><button type="button" class="dg-btn dg-btn-primary next-btn" data-action="embodied-reward-next">下一步 ➜</button><span class="hint-tip"></span></div>';body.insertBefore(act,body.firstChild);return act;};
    const photosAct=create('act-photos','一路走来，都是新的发现','本阶段解锁的旅行照片',photos.length?'<div class="embodied-photo-album" aria-label="本阶段旅行相簿"><span class="album-note" aria-hidden="true">OUR JOURNEY</span><div class="album-stack">'+photos.map((photo,i)=>'<figure data-photo="'+i+'"><span class="album-tape" aria-hidden="true"></span><img src="'+esc(photo.src)+'" alt="'+story(photo.caption)+'" draggable="false"><figcaption><small>'+String(i+1).padStart(2,'0')+'</small>'+story(photo.caption)+'</figcaption></figure>').join('')+'</div><span class="album-note album-date" aria-hidden="true">'+esc(s.ver)+' · 旅行的每一步，都值得记住</span></div>':'<p class="memory-empty">带着好奇心，下一段旅程还在等她。</p>');
    const gradeName={fail:'不及格',pass:'合格',excellent:'优秀',top:'顶尖'};
    const gradeLetter={top:'S',excellent:'A',pass:'B',fail:'F'},gradeText={top:'顶尖评审',excellent:'优秀评审',pass:'合格评审',fail:'评审未达标'};
    const caption=captionFor(u.core,r),specialAct=cg?create('act-special','特别回忆',gradeName[cg.verdict]+'评审 · 小鲸鱼的来信','<div class="cg-theatre" data-cg-state="closed" data-grade="'+esc(cg.verdict)+'"><div class="cg-reveal-space"><div class="cg-soft-halo" aria-hidden="true"></div><button type="button" class="cg-envelope" data-action="embodied-cg-open" aria-label="打开这封特别回忆" aria-expanded="false"><span class="cg-envelope-shadow"></span>'+envelopeLayer('back')+envelopeLayer('letter','back')+envelopeLayer('pocket')+envelopeLayer('flap')+envelopeLayer('seal')+'<span class="cg-envelope-address" aria-hidden="true"><small>A MEMORY FOR YOU</small><b>小鲸鱼的来信</b></span></button><figure class="cg-photo" aria-hidden="true"><button type="button" class="cg-image-zoom" data-action="embodied-cg-zoom" aria-label="查看CG大图" disabled></button><img class="special-cg-image" src="'+esc(skin.image)+'" alt="'+esc(caption.title)+'" draggable="false"><span class="cg-photo-sheen" aria-hidden="true"></span><div class="embodied-cg-grade cg-rating-label" data-cg-grade="'+esc(cg.verdict)+'" aria-label="'+esc(gradeLetter[cg.verdict]+' · '+gradeText[cg.verdict])+'"><span class="cg-grade-face"><strong data-letter="'+esc(gradeLetter[cg.verdict])+'"><span>'+esc(gradeLetter[cg.verdict])+'</span></strong><small>'+esc(gradeText[cg.verdict])+'</small><i class="cg-grade-star cg-grade-star-1" aria-hidden="true"></i><i class="cg-grade-star cg-grade-star-2" aria-hidden="true"></i><i class="cg-grade-star cg-grade-star-3" aria-hidden="true"></i></span></div></figure><div class="cg-sparks" aria-hidden="true"></div></div><div class="cg-danmaku" aria-label="首次CG粉丝留言" hidden></div><div class="cg-caption" aria-hidden="true"><h2>'+esc(caption.title)+'</h2><p>'+esc(caption.description)+'</p></div></div>'):null;
    if(r.qualificationFailed)root.querySelector('.island-title').innerHTML='<span class="dot"></span>'+esc(u.core.reviewFailurePolicy().UI.BADGE);
    else if(candidate?.verdict==='fail')root.querySelector('.island-title').innerHTML='<span class="dot"></span>本次评审未达标 · 特殊结算';
    const pills=root.querySelector('.stage-steps');pills.insertAdjacentHTML('afterbegin','<span class="step-pill" data-embodied-part="photos">旅行照片</span>'+(cg?'<span class="step-pill" data-embodied-part="special">特殊 CG</span>':''));root.querySelector('[data-action="bonus-jump"]')?.remove();
    if(window.__TOY_MOCK__||!window.ToyCloud?.available())root.querySelectorAll('[data-action="open-rank"]').forEach(button=>button.remove());
    // Feedback now accompanies the first CG reveal; keep the original chart/reward acts.
    const retiredFeedback=root.querySelector('#act-2');if(retiredFeedback){retiredFeedback.hidden=true;retiredFeedback.classList.add('embodied-retired-feedback');retiredFeedback.setAttribute('aria-hidden','true');retiredFeedback.querySelector('.act2-grid>.panel:last-child').classList.add('embodied-retired-feedback');}root.querySelector('.step-pill[data-step="2"]')?.remove();const rankPanel=retiredFeedback?.querySelector('.act2-grid>.panel'),rankList=rankPanel?.querySelector('#rankList');if(rankPanel)rankPanel.hidden=true;if(rankList)rankList.innerHTML='';
    root.querySelector('#act-1 .hint-tip').textContent='点击下一步，查看本轮评审结算';root.querySelector('#act-1 [data-action="bonus-next"] span').textContent='查看结算 ➜';root.querySelector('#act-3 .act-sub').textContent=r.qualificationFailed?u.core.reviewFailurePolicy().UI.DESCRIPTION:'本轮奖励已按实际评审结算到账。';
    const run={u,state:s,result:r,root,photos,cg,skin,photosAct,specialAct,rankPanel,rankList,closed:false,cinematicTimer:null,audioEpoch:0,audioControllers:new Set(),audioHandles:new Set(),finaleReady:old?.state===s&&old?.result===r&&old.finaleReady,refreshFooter(){if(this.closed)return;for(const button of root.querySelectorAll('.bonus-next')){if(window.LifeFinale&&LifeFinale.eligible(u.core)&&!LifeFinale.completed(u.core)){if(!button.dataset.originalLabel)button.dataset.originalLabel=button.textContent;button.textContent='结算完成 · 观看结局 ➜';}else if(button.dataset.originalLabel)button.textContent=button.dataset.originalLabel;}},dispose(){if(this.closed)return;this.closed=true;if(this.zoomOpen)window.WhaleGallery?.close();this.mediaCleanup?.();this.mediaObserver?.disconnect();window.removeEventListener('resize',this.onMediaResize);clearDanmaku(this);stopCinematicClock(this);clearCinematicAudio(this);clearSparks(this);document.removeEventListener('visibilitychange',this.onVisibility);window.removeEventListener('pagehide',this.onPageHide);this.specialAct?.querySelector('.cg-photo')?.removeEventListener('animationend',this.onAnimation);this.specialAct?.querySelector('.cg-envelope-flap')?.removeEventListener('animationend',this.onAnimation);}};u._embodiedBonusPages=run;
    installCinematic(run);
    u.mountRewardPages();showPrelude(u);run.refreshFooter();cloudBonus(u,s,r);
  }
  ui.renderBonus=function(){const value=originalBonus.apply(this,arguments);if(allowed(this))mountOriginalAdditions(this);return value;};
  ui.rewardGoTo=function(n){if(allowed(this)&&['bonus','over'].includes(this.core.state.phase)&&rewardProgress(this).part!=='original')return;const value=originalGoTo.call(this,allowed(this)?originalAct(this._embodiedBonusPages,n):n);if(allowed(this))this.el.querySelector('.aqua-stage')?.setAttribute('data-embodied-part','original');return value;};
  // 「再看一遍」回到最前面的旅行照片环节：只重放演出，不重新解锁也不重复支付。
  const replayReward=ui.rewardReplay;
  ui.rewardReplay=function(){
    const run=this._embodiedBonusPages;
    if(!allowed(this)||!run||!cinematicAlive(run))return replayReward.apply(this,arguments);
    const p=rewardProgress(this);
    p.part='photos';p.photo=0;p.cg.stage='closed';p.cg.elapsed=0;p.cg.arrivalElapsed=0;p.cg.cues={};p.cg.danmakuElapsed=0;
    run.visualStage=null;run.visualPhoto=null;run.pageKey=null;
    // The reset runs first so rewardReplay's own rewardGoTo(1) cannot animate the original bars
    // while the travel-photo act is hidden; reaching the original acts still replays them.
    const result=replayReward.apply(this,arguments);
    showPrelude(this);saveProgress(this);
    return result;
  };
  ui.onClick=function(event){
    const target=event?.target?.closest?.('[data-action]')||this._pressTarget?.closest?.('[data-action]'),action=target?.dataset.action,s=this.core&&this.core.state;
    if(allowed(this)&&['bonus','over'].includes(s.phase)){
      if(action==='embodied-cg-retry'){event.preventDefault?.();event.stopPropagation?.();this._clickHandled=true;this._pressTarget=null;if(!target.disabled&&target.isConnected)watchReviewMedia(this._embodiedBonusPages,true);return;}
      if(action==='embodied-cg-zoom'){event.preventDefault?.();event.stopPropagation?.();this._clickHandled=true;this._pressTarget=null;if(!target.disabled&&target.isConnected)openCGImage(this,target);return;}
      if(['embodied-cg-open','embodied-reward-pause'].includes(action)){event.preventDefault?.();event.stopPropagation?.();this._clickHandled=true;this._pressTarget=null;if(!target.disabled&&target.isConnected)(action==='embodied-cg-open'?openEnvelope:pauseCinematic)(this);return;}
      if(action==='embodied-reward-next'){event.preventDefault?.();event.stopPropagation?.();this._clickHandled=true;this._pressTarget=null;if(!target.disabled&&target.isConnected)stepPrelude(this);return;}
      if(action==='bonus-jump')return;
      if(['next-stage','retry-stage','bonus-final','bonus-done'].includes(action)){
        if(rewardProgress(this).part!=='original'||target.disabled||!target.isConnected)return;
        if(window.LifeFinale&&LifeFinale.eligible(this.core)&&!LifeFinale.completed(this.core)){this._clickHandled=true;this._pressTarget=null;event.preventDefault?.();event.stopPropagation?.();this._embodiedBonusPages.finaleReady=true;LifeFinale.open();return;}
      }
    }
    return originalClick.apply(this,arguments);
  };
  function bonus(u){return u.renderBonus();}
  const describe=ui.traitDesc;
  ui.traitDesc=function(t){
    if(t!=='embodied')return describe.apply(this,arguments);
    const keys=this.core.traitUpgradeStats(t)||['algo','engineering'],names=keys.map(k=>this.statName(k)).join('、'),min=this.core.traitUpgradeMinStat();
    return '具身智能经验：在具身智能岗位产出物理认知与灵巧操控，词条等级越高产出越高。\n升级条件：'+names+'均达到 '+min+'，取平均值判定；每次阶段结算按数据词条的概率曲线升级。';
  };
  const overview=ui.omTeamOverview;
  ui.omTeamOverview=function(){
    const html=overview.apply(this,arguments),pay=Math.round(this.core.monthlyPayroll()/10000);
    return html.replace(/(<span class="stat-item-value gold">)[\d.]+(<span class="unit">万\/月<\/span>)/,(_,a,b)=>a+pay+b);
  };
  function compactModel(){
    const root=ui.el,s=ui.core&&ui.core.state;
    if(!root||!s)return;
    const card=root.querySelector('.model-stats'),ver=root.querySelector('#ob-ver');
    if(!card||!ver)return;
    const short={vla:'VLA',hvla:'ER·VLA'}[s.arch];
    card.classList.toggle('has-embodied-model',!!short);
    if(short){const arch=((ui.core.cfg.ARCHITECTURES||[]).find(a=>a.id===s.arch)||{}).name||short;
      ver.textContent=(s.paramTarget||7)+'B · '+short;ver.title=arch;
    }
    const name=card.querySelector('.model-name');if(name)name.title=name.textContent;
  }
  const render=ui.render;ui.render=function(){
    const result=render.apply(this,arguments),s=this.core?.state;
    // A zero-reward failure keeps phase=over. Its photo/CG prelude returns to the original report.
    if(allowed(this)&&s.phase==='over'&&!s.bankrupt&&s.result?.settled&&specialCG(this.core,s.result)&&rewardProgress(this).part!=='original')this.renderBonus();
    refresh();compactModel();
    if(s?.phase!=='bonus'&&!(s?.phase==='over'&&this._embodiedBonusPages?.state===s&&rewardProgress(this).part!=='original'))this._embodiedBonusPages?.dispose();
    return result;
  };
  const update=ui.updateOfficeMain;ui.updateOfficeMain=function(){const result=update.apply(this,arguments);refresh();compactModel();return result;};
  const core=window.GameCore,finish=core.finish;core.finish=function(){
    const s=this.state,wasSettled=s.result&&s.result.settled,result=finish.apply(this,arguments),gallery=window.WhaleGallery;
    if(!wasSettled&&result&&result.settled&&allowed({core:this})){
      s.embodiedReward=freshReward();
      if(!gallery)return result;
      const cg=specialCG(this,result);s.embodiedReward.cgId=cg?.id||null;s.embodiedReward.specialNewSettlement=true;s.embodiedReward.skipSpecial=!!(cg&&gallery.hasSpecialRevealed(this,cg));if(cg)gallery.unlockSpecial(this,cg);
      gallery.unlockTravel(this,travelMemories({core:this}));
    }
    return result;
  };
  window.EmbodiedPresentation={warmReviewMedia,allowed,refresh,review,bonus,cloudBonus,effectiveGrade,specialCG,captionFor,start,stop,dispose(){cancelWhite();dispose();ui._embodiedBonusPages?.dispose();}};
})();
