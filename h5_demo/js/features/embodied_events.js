/* Experimental-era event outcomes. Existing Core remains the authority for costs, hires and caps. */
(function () {
  'use strict';
  const root=window, STAGES=['V5','V5.5','V6','V6.5'];
  const active=(core,state)=>!!core&&!!state&&STAGES.includes(state.ver);
  function offerPool(core,offer,state,resetCooldown) {
    const s=state||core.state;
    if(!active(core,s)||!offer)return[];
    const min=Math.max(1,Math.floor(Number(offer.minLevel)||3)),max=Math.min(5,Math.floor(Number(offer.maxLevel)||5));
    // Quotes preview recoverable candidates; only granting an invitation resets cooldown.
    return core.hireDrawPool(s.ver,{state:s,resetCooldown:resetCooldown===true,
      filter:e=>core.primaryTraitType(e)==='embodied'
        && core.engLevel(e)>=min && core.engLevel(e)<=max && core.hireWeightOf(e,s.ver)>0
        && core.engLevel(e)<=core.talentLvCap(e)});
  }
  function quote(core,eff,state) {
    const s=state||core.state,offer=eff&&eff.embodied_offer,buff=eff&&eff.embodied_efficiency;
    if(!offer&&!buff)return{ok:true};
    if(!active(core,s))return{ok:false,tip:'具身智能阶段才可进行这项安排'};
    if(offer){
      if(typeof offer.id!=='string'||!offer.id.trim())return{ok:false,tip:'这份入队邀请没有有效编号'};
      const previous=(s.embodiedEventInvites||{})[offer.id];
      if(previous)return{ok:false,tip:'这份入队邀请已发送，请在招聘中查看候选'};
      if(!offerPool(core,offer,s).length)return{ok:false,tip:'目前没有符合职级的未入队人选，可以选择短期顾问方案'};
    }
    if(buff){
      const weekTicks=Math.max(1,Math.floor((core.cfg.V35||{}).TICKS_PER_WEEK||6));
      if(!Number.isFinite(buff.mul)||buff.mul<.5||buff.mul>1.25||!Number.isInteger(buff.ticks)||buff.ticks<1||buff.ticks>weekTicks)
        return{ok:false,tip:'临时效率需为 50%～125%，持续不超过一周'};
    }
    return{ok:true};
  }
  function grantOffer(core,offer,state) {
    const s=state||core.state,pool=offerPool(core,offer,s,true);
    if(!pool.length)return{ok:false,tip:'这份入队邀请暂无合适人选'};
    // A real pool template is cloned through the normal talent/status/salary pipeline.
    const template=pool[Math.min(pool.length-1,Math.floor(Math.random()*pool.length))],candidate=core.cloneEng(template,0,s.ver);
    candidate.fromEvent=true;candidate.embodiedInvitation=offer.id;
    // A kindred applicant waits for a seat. Do not serialize Infinity or borrow role energy.
    delete candidate.expireAbsWeek;delete candidate.expireWeek;
    s.candidates=s.candidates||[];s.candidates.push(candidate);
    s.embodiedEventInvites=s.embodiedEventInvites||{};
    s.embodiedEventInvites[offer.id]={candidateId:candidate.id,key:candidate.key,week:core.absWeek()};
    const full=(s.engineers||[]).filter(e=>!e.resigned).length>=core.seatCap();
    return{ok:true,candidateId:candidate.id,tip:candidate.name+'（'+core.tierLabel(candidate)+'）已进入招聘候选；'
      +(full?'当前座位已满，TA 会等待你安排空位。':'可在招聘中查看薪资并录用。')};
  }
  function install(core,engine) {
    if(!core||core.__embodiedEventsInstalled)return false;
    const V=engine||root.V35;if(!V||typeof V.tick!=='function')return false;
    core.__embodiedEventsInstalled=true;
    const effects=core.applyEffects,status=core.eventEffectsQuote,option=core.applyEventOption,optionText=core.eventOptionText,tick=V.tick;
    core.eventEffectsQuote=function(eff,evId,state){
      const base=status.apply(this,arguments);if(!base.ok)return base;
      // The existing UI consults strict quotes when expenseActive is true. Invitations
      // also have prerequisites even though sending the invitation itself is free.
      const extra=quote(this,eff,state),managed=!!(eff&&(eff.embodied_offer||eff.embodied_efficiency));
      return Object.assign({},base,{expenseActive:base.expenseActive||managed},extra.ok?{}:extra);
    };
    core.applyEffects=function(eff,state){
      const s=state||this.state,check=this.eventEffectsQuote(eff,null,s);if(!check.ok)return{ok:false,tip:check.tip};
      const result=effects.apply(this,arguments);if(result&&result.ok===false)return result;
      if(eff&&eff.embodied_offer){const outcome=grantOffer(this,eff.embodied_offer,s);s._embodiedEventOutcome=outcome;return outcome;}
      if(eff&&eff.embodied_efficiency){
        const b=eff.embodied_efficiency;
        s.embodiedEventEfficiency={ver:s.ver,mul:b.mul,left:b.ticks};
      }
      return result;
    };
    core.applyEventOption=function(evId,optIdx){
      const event=this.evByNo(evId),eff=event&&event.options&&event.options[optIdx]&&event.options[optIdx].effects;
      delete this.state._embodiedEventOutcome;
      const result=option.apply(this,arguments),outcome=this.state._embodiedEventOutcome;delete this.state._embodiedEventOutcome;
      if(result&&result.ok===false)return result;
      return eff&&eff.embodied_offer&&outcome?Object.assign({},result||eff,outcome):result;
    };
    core.eventOptionText=function(opt,evId){
      const text=optionText.apply(this,arguments),s=this.state;
      return opt&&opt.effects&&opt.effects.embodied_offer
        &&(s.engineers||[]).filter(e=>!e.resigned).length>=this.seatCap()
        ?text+'（当前满座；邀请不会替换现有员工）':text;
    };
    V.tick=function(st,rng){
      const s=core.state,b=s&&s.embodiedEventEfficiency;
      if(!b)return tick.apply(this,arguments);
      if(!active(core,s)||b.ver!==s.ver){delete s.embodiedEventEfficiency;return tick.apply(this,arguments);}
      if(st!==s.v35||s.phase!=='office')return tick.apply(this,arguments);
      if(!Number.isFinite(b.mul)||b.mul<.5||b.mul>1.25||!Number.isInteger(b.left)||b.left<1||b.left>Math.max(1,(core.cfg.V35||{}).TICKS_PER_WEEK||6)){
        delete s.embodiedEventEfficiency;return tick.apply(this,arguments);
      }
      // Use the existing per-person multiplier seam before production. This covers the actual
      // quality-bucket corpus output too; it cannot magnify paper dim_bonus / paper floats.
      const prior=Number(st.tick)||0,original=st.productionMulList,enhanced={...(original||{})};
      for(const role of ['pre','data','post','embodied']){
        const list=Array.isArray(enhanced[role])?enhanced[role]:[];
        enhanced[role]=list.map(value=>(Number.isFinite(value)?value:1)*b.mul);
      }
      st.productionMulList=enhanced;
      let result;
      try{result=tick.apply(this,arguments);}finally{
        if(original===undefined)delete st.productionMulList;else st.productionMulList=original;
      }
      if(Number(st.tick)>prior){b.left-=1;if(b.left<=0)delete s.embodiedEventEfficiency;}
      return result;
    };
    return true;
  }
  root.EmbodiedEvents=Object.freeze({install,quote,offerPool});
  if(root.GameCore&&root.V35)install(root.GameCore,root.V35);
})();
