/* First observed real-player cloud rankings are distinct from dated stage clears. */
(function(){
  'use strict';
  const cloud=window.ToyCloud,ui=window.GameUI;
  if(!cloud||!ui||cloud.__lifeMilestones||typeof cloud.fetchMine!=='function')return;
  cloud.__lifeMilestones=true;
  const save=state=>{if(window.GameSave&&typeof window.GameSave.autoSave==='function')window.GameSave.autoSave(state);};
  const sameRunScore=(core,ver,score)=>{
    const s=core.state,known=(s.lifeCloudSubmissions||{})[ver];
    if(known&&known.score===score)return true;
    if(typeof cloud.packScore!=='function')return false;
    const rows=[(s.stageMarks||{})[ver],...(s.codexLog||[]),...(s.modelHistory||[])];
    if(s.ver===ver&&s.result&&s.result.settled===true)rows.push({...s.result,ver,week:s.week});
    return rows.some(x=>x&&x.ver===ver&&['pass','excellent','top'].includes(x.verdict)&&!x.missionFail&&!x.retry&&Number.isFinite(Number(x.score))&&cloud.packScore(x.score,x.week,ver)===score);
  };
  if(typeof cloud.onReviewSettled==='function'){
    const settled=cloud.onReviewSettled;
    cloud.onReviewSettled=function(state,result){const score=settled.apply(this,arguments);if(Number.isSafeInteger(score)&&state&&result&&result.settled===true){state.lifeCloudSubmissions=state.lifeCloudSubmissions||{};const old=state.lifeCloudSubmissions[state.ver];if(!old||score>old.score){state.lifeCloudSubmissions[state.ver]={score,at:new Date().toISOString()};save(state);}}return score;};
  }
  const fetch=cloud.fetchMine;
  cloud.fetchMine=async function(){
    const core=ui.core,state=core&&core.state,ver=state&&state.ver;
    const result=await fetch.apply(this,arguments);
    if(!core||core.state!==state||state.ver!==ver||typeof core.recordLifeMilestone!=='function')return result;
    if(arguments[0]&&arguments[0]!=='all')return result;
    const requested=arguments[1]||ver,board=typeof cloud.boardFor==='function'?cloud.boardFor(requested):result&&result.board;
    if(!result||!result.ok||result.stale||!result.ranked||!Number.isSafeInteger(result.rank)||result.rank<1||board!==result.board||(cloud.boardFor&&board!==cloud.boardFor(ver))||!sameRunScore(core,ver,result.score))return result;
    const data={rank:Math.floor(Number(result.rank)),board:result.board,period:'all',score:result.score,source:'cloud-observed'};
    const marks=state.lifeMilestones||{},before10=!!marks.first_top10,before1=!!marks.first_rank1;
    if(data.rank<=10)core.recordLifeMilestone('first_top10',data);
    if(data.rank===1)core.recordLifeMilestone('first_rank1',data);
    if((data.rank<=10&&!before10)||(data.rank===1&&!before1))save(state);
    return result;
  };
})();
