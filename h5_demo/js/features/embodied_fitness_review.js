/* V5+ physical review is a performance of the real result, never a second scoring engine. */
(function () {
  'use strict';
  const sessions = new WeakMap(), EVENTS = ['run', 'jump', 'shot'];
  const INTRO_WORDS = ['大肥鱼！', '体能！', '测验！'];
  const TITLES = {run:'跑步',jump:'跳远',shot:'铅球'};
  const VERDICTS = {top:'S · 顶尖',excellent:'A · 优秀',pass:'B · 合格',fail:'未通过',veto:'未通过 · 需补强短板'};
  const clamp = (n,a,b) => Math.max(a,Math.min(b,Number(n)||0));
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = (ui,v) => ui.escHtml(String(v == null ? '' : v));
  const resource = v => window.ResourcePaths ? ResourcePaths.canonical(String(v)) : String(v);
  const allowed = ui => !!(ui.core && ui.core.state && ui.core.state.phase === 'review' && ui.core.embodiedAvailable && ui.core.embodiedAvailable(ui.core.state));
  function save(ui) { if (ui.save && ui.save.autoSave) ui.save.autoSave(ui.core.state); }
  function phase(core) {
    const cfg=core.cfg,s=core.state,city=cfg.CITY_JOURNEY||{},growth=((cfg.EMBODIED||{}).GROWTH_BY_VER||{})[s.ver]||{};
    const order=(cfg.VER_ORDER||[]).filter(ver=>core.embodiedAvailable({ver})),index=Math.max(0,order.indexOf(s.ver));
    const age=Number((city.AGES_BY_VER||{})[s.ver]) || [10,15,20,25][Math.min(3,index)];
    const cues=(((cfg.LIFE_STORY||{}).FINALE||{}).timeline||[]),walk=cues.find(cue=>cue.type==='wall' && Number(cue.age)===age && cue.sprite);
    return {age,place:age<=10?'小学操场':age<=15?'校园运动场':age<=20?'大学体育场':'城市运动场',distance:age<=10?50:age<=15?100:age<=20?200:400,
      sprite:resource(walk?walk.sprite:growth.sprite||(city.PORTRAITS_BY_VER||{})[s.ver]||'resource/character/whale_stand.webp'),
      frames:walk?Math.max(1,Number(walk.walkFrames)||1):1,columns:walk?Math.max(1,Number(walk.walkColumns)||1):1,rows:walk?Math.max(1,Number(walk.walkRows)||1):1,
      aspect:walk?Number(walk.walkAspect)||.75:.75,model:growth.model||s.ver};
  }
  function profile(core,event) {
    const s=core.state,caps=core.statCap(),keys=core.dimsOf(s),ratio=key=>clamp((Number(s[key])||0)/Math.max(1,Number(caps[key])||1),0,1);
    const overall=keys.reduce((total,key)=>total+ratio(key),0)/Math.max(1,keys.length);
    const physical=(ratio('embodiedCognition')+ratio('dexterousControl'))/2;
    const quality=clamp(overall*.3+physical*.7,0,1),p=phase(core);
    return {quality,mistakeChance:.02+(1-quality)*.65,duration:Math.round((event==='run'?9000:event==='jump'?6800:6500)+(1-quality)*5000),
      speed:2+quality*6,distance:p.distance,jump:1+quality*(p.age<=10?3:p.age<=15?4:5),throw:2+quality*(p.age<=10?5:p.age<=15?8:12),force:25+quality*75};
  }
  function reviewKey(s) { return [s.ver,s.week,s.arch,s.paramTarget,(s.verRetry||{})[s.ver]||0,s.retryCount||0].join('|'); }
  function effectiveGrade(core,record) {
    if(window.EmbodiedPresentation && EmbodiedPresentation.effectiveGrade)return EmbodiedPresentation.effectiveGrade(core,record);
    const r=record||core.state.result||{};
    if(r.missionFail===true||r.retry===true||r.missionHit===false||(r.mission&&r.mission.hit===false)||(/^(top|excellent|pass)$/.test(r.verdict)&&core.isMissionFail()))return 'fail';
    return r.verdict||'fail';
  }
  function ensure(ui) {
    const s=ui.core.state,key=reviewKey(s);let data=s.embodiedFitnessReview;
    // Earlier preview drafts included a score that the loader legitimately refreshes.
    // Migrate the same unfinished review without drawing a different event or schedule.
    if(data&&typeof data.key==='string'&&data.key.split('|').length===7&&data.key.split('|').slice(0,5).join('|')===key.split('|').slice(0,5).join('|'))data.key=key;
    if (!data || data.schema!==1 || data.key!==key || !EVENTS.includes(data.event)) {
      data=s.embodiedFitnessReview={schema:1,key,event:EVENTS[Math.min(2,Math.floor(Math.random()*3))],stage:'intro',elapsed:0,paused:false,complete:false};
      save(ui);
    }
    if (!['intro','enter','ready','running','results'].includes(data.stage)) {data.stage='ready';data.elapsed=0;data.complete=false;}
    if(!data.plan || !Array.isArray(data.plan.trials)) {
      const p=profile(ui.core,data.event),count=data.event==='run'?8:data.event==='jump'?5:4;
      data.plan={...p,trials:Array.from({length:count},(_,i)=>({at:(i+1)/(count+1),bad:Math.random()<p.mistakeChance}))};save(ui);
    }
    return data;
  }
  function valid(ui,run) { return sessions.get(ui)===run && ui.core.state===run.state && run.state.phase==='review' && reviewKey(run.state)===run.data.key && run.root.isConnected; }
  function stop(ui) {
    const run=sessions.get(ui);if(!run)return;
    if(run.timer!=null){clearInterval(run.timer);run.timer=null;}
    if(run.visibility){document.removeEventListener('visibilitychange',run.visibility);window.removeEventListener('pagehide',run.pagehide);run.visibility=null;}
    for(const node of run.audio.splice(0)){try{node.stop();}catch(_){}try{node.disconnect();}catch(_){}}
  }
  function sound(ui,run,kind) {
    if(!valid(ui,run)||document.hidden||run.data.paused)return;
    const manager=window.AudioMgr,ctx=manager&&manager.ctx;
    if(!ctx || ctx.state==='suspended')return;
    try {
      const gain=ctx.createGain(),osc=ctx.createOscillator(),now=ctx.currentTime,vol=clamp(window.SFX?SFX.vol:.5,0,1)*.24;
      gain.connect(manager.sfxGain||manager.master||ctx.destination);osc.connect(gain);
      osc.type=kind==='whistle'?'sine':'triangle';osc.frequency.setValueAtTime(kind==='whistle'?2100:150,now);
      osc.frequency.exponentialRampToValueAtTime(kind==='whistle'?2600:45,now+.16);
      gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(vol,now+.008);gain.gain.exponentialRampToValueAtTime(.001,now+(kind==='whistle'?.32:.2));
      osc.onended=()=>{try{osc.disconnect();gain.disconnect();}catch(_){}const at=run.audio.indexOf(osc);if(at>=0)run.audio.splice(at,1);};
      run.audio.push(osc);osc.start(now);osc.stop(now+.34);
    }catch(_){}
  }
  function write(run,key,value) {
    const node=run.root.querySelector('[data-fitness-stat="'+key+'"]');if(!node||node.textContent===value)return;
    node.textContent=value;node.dataset.pulse=String(Math.floor(run.data.elapsed/220)%2);
  }
  function sprite(run,time,moving) {
    const frame=moving&&!run.reduced?Math.floor(time/110)%run.phase.frames:Math.min(2,run.phase.frames-1),col=frame%run.phase.columns,row=Math.floor(frame/run.phase.columns);
    run.figure.style.backgroundPosition=(run.phase.columns>1?col/(run.phase.columns-1)*100:0)+'% '+(run.phase.rows>1?row/(run.phase.rows-1)*100:0)+'%';
  }
  function transition(ui,run,next) {
    run.data.stage=next;run.data.elapsed=0;run.data.complete=false;run.last=performance.now();run.word=-1;
    if(next==='ready'||next==='running'||next==='results')save(ui);
    if(next==='enter'||next==='results')sound(ui,run,'whistle');
    paint(ui,run);
  }
  function paint(ui,run) {
    if(!valid(ui,run)){stop(ui);return;}
    const data=run.data,root=run.root,time=data.elapsed,stage=data.stage,p=run.profile,reveal=root.querySelector('.fitness-reveal'),startButton=root.querySelector('[data-action="fitness-start"]'),settle=root.querySelector('[data-action="fitness-settle"]'),pause=root.querySelector('[data-action="fitness-pause"]');
    root.dataset.stage=stage;root.classList.toggle('is-paused',data.paused||document.hidden);
    startButton.hidden=stage!=='ready';settle.hidden=stage!=='results';settle.disabled=!data.complete;
    pause.disabled=stage==='ready'||data.complete;pause.textContent=data.paused?'继续演出':'暂停';
    const message=root.querySelector('.fitness-message'),intro=root.querySelector('.fitness-intro');
    intro.hidden=stage!=='intro';reveal.hidden=stage!=='results';
    if(stage==='intro') {
      const word=Math.min(2,Math.floor(time/(run.reduced?250:700)));
      if(run.word!==word){run.word=word;intro.querySelectorAll('.fitness-intro-line').forEach((line,index)=>{if(index<=word){line.textContent=INTRO_WORDS[index];line.classList.add('is-visible');line.setAttribute('aria-hidden','false');}});intro.dataset.word=String(word);sound(ui,run,'thump');}
      message.textContent='准备好，今天的挑战要来啦！';
      if(time>=(run.reduced?750:2100))transition(ui,run,'enter');
    } else if(stage==='enter') {
      run.runner.style.left=(5+Math.min(1,time/(run.reduced?350:1400))*17)+'%';sprite(run,time,true);
      message.textContent='哨声响起，小鲸鱼走入赛场。';if(time>=(run.reduced?350:1400))transition(ui,run,'ready');
    } else if(stage==='ready') {
      run.runner.style.left='22%';sprite(run,0,false);message.textContent='小鲸鱼已就位，点击「开始」为她加油！';
    } else if(stage==='running') {
      const total=run.reduced?1800:p.duration,progress=clamp(time/total,0,1),errors=p.trials.filter(trial=>trial.bad&&progress>=trial.at),mistakes=errors.length,lastFall=mistakes?errors[mistakes-1].at:0,falling=run.data.event==='run' && mistakes>0 && progress-lastFall<.055;
      sprite(run,time,true);root.classList.toggle('is-stumble',falling&&!run.reduced);
      if(data.event==='run') {
        run.runner.style.left=(22+progress*61)+'%';run.runner.style.bottom='19%';
        write(run,'one',String(mistakes)+' 次');write(run,'two',(falling?p.speed*.25:p.speed*(.92+.08*Math.sin(time/180))).toFixed(1)+' m/s');write(run,'three',Math.max(0,p.distance*(1-progress)).toFixed(0)+' m');
        message.textContent=falling?'哎呀！拍拍灰，继续向前！':progress>.85?'终点就在前面，加油！':'一步一步，把练习变成前进的力量！';
      } else if(data.event==='jump') {
        const flying=clamp((progress-.4)/.45,0,1),approach=Math.min(1,progress/.4);
        const arenaHeight=root.querySelector('.fitness-arena').clientHeight||1;
        const lift=Math.min(35,Math.max(0,(arenaHeight-run.runner.offsetHeight-arenaHeight*.19-12)/arenaHeight*100));
        run.runner.style.left=(12+approach*30+flying*(18+p.quality*23))+'%';run.runner.style.bottom=(19+(run.reduced?0:Math.sin(flying*Math.PI)*lift))+'%';
        write(run,'one',(p.speed*approach).toFixed(1)+' m/s');write(run,'two',(p.jump*flying).toFixed(2)+' m');write(run,'three',String(mistakes)+' 次');
        message.textContent=progress<.4?'助跑——找到自己的节奏！':progress<.85?'起跳！把勇气交给这一跃！':'落地，留下今天最远的脚印！';
      } else {
        const flight=clamp((progress-.46)/.43,0,1);run.runner.style.left='22%';run.runner.style.bottom='19%';
        run.figure.style.transform=run.reduced?'none':'rotate('+(progress<.46?-Math.sin(progress/.46*Math.PI)*16:Math.sin(flight*Math.PI)*10)+'deg)';
        run.ball.style.left=(28+flight*(28+p.quality*32))+'%';run.ball.style.bottom=(40+(run.reduced?0:Math.sin(flight*Math.PI)*36)-flight*20)+'%';
        write(run,'one',(p.force*Math.min(1,progress/.46)).toFixed(0)+'%');write(run,'two',(p.throw*flight).toFixed(2)+' m');write(run,'three',String(mistakes)+' 次');
        message.textContent=progress<.46?'稳稳站住，积蓄发力！':progress<.89?'出手！看它飞向更远的地方！':'落点确认，今天又进步了一点！';
      }
      root.querySelector('.fitness-progress i').style.width=progress*100+'%';
      if(progress>=1){root.classList.remove('is-stumble');run.figure.style.transform='';transition(ui,run,'results');}
    } else if(stage==='results') {
      sprite(run,0,false);message.textContent='终点哨声响起，成绩单送到啦！';
      const result=run.state.result||{},duration=run.reduced?100:650,score=Number(result.score)||0,grade=effectiveGrade(ui.core,result),stampText=grade==='fail'&&/^(top|excellent|pass)$/.test(result.verdict)?'任务目标未达成':VERDICTS[grade]||'评审完成';
      root.querySelector('.fitness-stamp').textContent=stampText;root.querySelector('.fitness-stamp').dataset.verdict=grade;
      root.querySelector('.fitness-score').textContent=time>=duration?String(score):String(Math.round(score*Math.min(1,time/duration)));
      const stamp=root.querySelector('.fitness-stamp');stamp.hidden=time<duration;
      if(time>=duration&&!run.stamped){run.stamped=true;root.classList.add('is-stamped');sound(ui,run,'thump');}
      if(time>=duration+250&&!data.complete){data.complete=true;settle.disabled=false;pause.disabled=true;save(ui);stop(ui);}
    }
  }
  function start(ui) {
    const run=sessions.get(ui);if(!run||!valid(ui,run)||run.data.complete||ui._evalWaitTut)return;
    stop(ui);run.last=performance.now();
    run.visibility=()=>{run.last=performance.now();run.root.classList.toggle('is-paused',run.data.paused||document.hidden);};
    run.pagehide=()=>{if(valid(ui,run)){run.data.paused=true;paint(ui,run);save(ui);}stop(ui);};
    document.addEventListener('visibilitychange',run.visibility);window.addEventListener('pagehide',run.pagehide);
    run.timer=setInterval(()=>{if(!valid(ui,run)){stop(ui);return;}const now=performance.now();if(!run.data.paused&&!document.hidden&&!ui._evalWaitTut)run.data.elapsed+=Math.min(150,Math.max(0,now-run.last));run.last=now;if(!run.data.paused&&!document.hidden&&!ui._evalWaitTut)paint(ui,run);},50);
  }
  function render(ui) {
    const prior=sessions.get(ui),data=ensure(ui),same=prior&&prior.state===ui.core.state&&prior.data===data;
    stop(ui);
    // A restored race can be replayed from the ready line; its selected event never changes.
    if(!same&&data.stage==='running'){data.stage='ready';data.elapsed=0;data.paused=false;save(ui);}
    if(data.stage==='results'&&!data.complete)data.elapsed=0;
    const p=phase(ui.core),event=data.event,labels=event==='run'?['摔倒次数','速度','剩余距离']:event==='jump'?['起跳速度','跳远距离','失误次数']:['发力','投掷距离','失误次数'];
    const role=ui.core.whaleRoleName?ui.core.whaleRoleName():'小鲸鱼';
    ui._evalSkin='fitness';ui._evalWaitTut=false;
    ui.el.innerHTML=`<section class="fitness-review" data-event="${event}" aria-label="大肥鱼的体能测验"><header class="fitness-head"><div><small>${esc(ui,ui.core.state.ver)} · ${p.age} 岁 · ${esc(ui,p.place)}</small><h1>大肥鱼的体能测验</h1><p>${esc(ui,role)}的${esc(ui,TITLES[event])}挑战${event==='run'?' · '+p.distance+' 米':event==='shot'?' · '+(p.age<=10?'轻量':p.age<=15?'少年':'标准')+'铅球':''}</p></div><span class="fitness-event-tag">${esc(ui,TITLES[event])}</span></header>
      <div class="fitness-stats">${labels.map((label,i)=>'<div class="fitness-stat"><span>'+label+'</span><b data-fitness-stat="'+['one','two','three'][i]+'">'+(i===2&&event==='run'?p.distance+' m':'0')+'</b></div>').join('')}</div>
      <div class="fitness-arena" aria-label="运动场"><div class="fitness-clouds" aria-hidden="true">☁　☁</div><div class="fitness-stands" aria-hidden="true">⚑　✦　⚑　✦　⚑</div><div class="fitness-track" aria-hidden="true"></div><div class="fitness-sand" aria-hidden="true"></div><span class="fitness-start-line" aria-hidden="true">起点</span><span class="fitness-finish-line" aria-hidden="true">终点</span><div class="fitness-runner" style="--fitness-aspect:${p.aspect}"><i class="fitness-runner-shadow"></i><div class="fitness-sprite" role="img" aria-label="${esc(ui,role)} · ${p.age} 岁" style="background-image:url(${esc(ui,JSON.stringify(p.sprite))});background-size:${p.columns*100}% ${p.rows*100}%"></div></div><i class="fitness-ball" aria-hidden="true"></i><div class="fitness-intro" aria-live="polite"><strong class="fitness-intro-line" aria-hidden="true"></strong><strong class="fitness-intro-line" aria-hidden="true"></strong><strong class="fitness-intro-line" aria-hidden="true"></strong></div><div class="fitness-reveal" hidden><small>体能测验 · 综合评审</small><b class="fitness-score">0</b><span>综合评分</span><strong class="fitness-stamp" data-verdict="${esc(ui,(ui.core.state.result||{}).verdict)}" hidden>${esc(ui,VERDICTS[(ui.core.state.result||{}).verdict]||'评审完成')}</strong></div></div>
      <div class="fitness-progress" aria-hidden="true"><i></i></div><p class="fitness-message" role="status"></p><footer class="fitness-foot"><button type="button" class="dg-btn dg-btn-ghost" data-action="fitness-pause">暂停</button><button type="button" class="dg-btn dg-btn-primary" data-action="fitness-start" hidden>开始 →</button><button type="button" class="dg-btn dg-btn-primary" data-action="fitness-settle" hidden disabled>进入结算 →</button></footer></section>`;
    const root=ui.el.querySelector('.fitness-review'),run={root,state:ui.core.state,data,phase:p,profile:data.plan,reduced:reduced(),runner:root.querySelector('.fitness-runner'),figure:root.querySelector('.fitness-sprite'),ball:root.querySelector('.fitness-ball'),audio:[],timer:null,visibility:null,last:0,word:-1,stamped:data.complete};
    sessions.set(ui,run);if(data.complete)run.data.elapsed=1000;paint(ui,run);start(ui);
  }
  function action(ui,act) {
    const run=sessions.get(ui);if(!run||!valid(ui,run))return false;
    if(act==='start'&&run.data.stage==='ready'){run.data.paused=false;transition(ui,run,'running');start(ui);return true;}
    if(act==='pause'&&run.data.stage!=='ready'&&!run.data.complete){run.data.paused=!run.data.paused;run.last=performance.now();save(ui);paint(ui,run);if(!run.data.paused)start(ui);return true;}
    if(act==='settle'&&run.data.stage==='results'&&run.data.complete&&!run.state.result.settled){stop(ui);ui._evalShown=0;ui._evalWaitTut=false;ui.core.finish();save(ui);ui.render();return true;}
    return false;
  }
  window.EmbodiedFitnessReview={allowed,render,start,stop,action,ensure,profile,phase,effectiveGrade};
})();
