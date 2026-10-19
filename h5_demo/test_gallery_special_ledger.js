'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {runtime}=require('./test_helpers/v2_runtime');
const {prepare}=require('./test_helpers/embodied_original_fixture');
const source=fs.readFileSync(path.join(__dirname,'js/features/gallery.js'),'utf8');
const r=runtime(['js/features/gallery.js']);r.w.eval(source);
const {w,core:c,ui:u}=r,api=w.WhaleGallery,stages=['V5','V5.5','V6','V6.5'],grades=['fail','pass','excellent','top'];
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('✓ '+name);};
function reset(){api.close();w.localStorage.clear();w.Menu._loadCloud=null;c.state=null;c.newGame();c.state.ver='V5';c.state.phase='office';c.state.result=null;return c.state;}
function award(ver='V5',grade='top'){
 prepare(r,ver,grade==='fail'?'pass':grade);if(grade==='fail'){for(const key of c.dimsOf(c.state))c.state[key]=0;c.state.mission.hit=false;}else if(grade==='pass'){const caps=c.statCap();let found=false;for(let pct=0;pct<=100;pct++){for(const key of c.dimsOf(c.state))c.state[key]=Math.floor(caps[key]*pct/100);if(c.evaluate().verdict==='pass'&&!c.isMissionFail()){found=true;break;}}assert(found,ver+' passing mission');}c.enterReview();const score=c.state.result.score;c.finish();assert(c.state.result.settled);assert.equal(c.state.result.score,score);
 return w.EmbodiedPresentation.specialCG(c,c.state.result,ver);
}
function dump(){return Array.from({length:w.localStorage.length},(_,i)=>{const key=w.localStorage.key(i);return[key,w.localStorage.getItem(key)];}).sort();}
try{
 check('16个真实评审结果按stage+grade领取一次，跨新档不变动评分/奖金且只读标题可见',()=>{
  reset();for(const ver of stages)for(const grade of grades){const cg=award(ver,grade),s=c.state;assert.equal(cg.id,ver+':'+grade);assert.equal(api.hasSpecialRevealed(c,cg),false,cg.id+' first pending');const money=s.funding,result=JSON.stringify(s.result);assert(api.claimSpecialReveal(c,cg),cg.id+' first claim');assert.equal(api.claimSpecialReveal(c,cg),false);assert.equal(api.unlockSpecial(c,cg),false);assert.equal(s.funding,money);assert.equal(JSON.stringify(s.result),result);}
  const ledger=JSON.parse(w.localStorage.getItem(api.SPECIAL_LEDGER_KEY));assert.equal(Object.keys(ledger.entries).length,16);assert(Object.values(ledger.entries).every(row=>row.revealed&&row.revealedAt));
  c.newGame();assert.equal(api.list(c).filter(row=>row.category==='special').length,16);const before=dump();assert.equal(api.listSaved().filter(row=>row.category==='special').length,16);assert.deepEqual(dump(),before);
 });
 check('重建浏览器运行环境可恢复首次账本，第二次真实同CG评审无再次领取',()=>{
  const data=dump(),again=runtime(['js/features/gallery.js']);try{for(const[key,value]of data)again.w.localStorage.setItem(key,value);again.w.eval(source);prepare(again,'V5','top');again.core.enterReview();again.core.finish();const cg=again.w.EmbodiedPresentation.specialCG(again.core,again.core.state.result);assert(again.w.WhaleGallery.hasSpecialRevealed(again.core,cg));assert.equal(again.w.WhaleGallery.claimSpecialReveal(again.core,cg),false);assert.equal(again.w.WhaleGallery.list(again.core).filter(row=>row.category==='special').length,16);}finally{again.close();}
 });
 check('老schema2闭封/开盖/飞图的当前历史与旧unlock都不冒充已看，读取完全无写入',()=>{
  for(const stage of ['closed','opening','flying']){
   reset();const cg=award();w.localStorage.clear();delete c.state.whaleGallery.specialLedger;c.state.embodiedReward={version:2,part:'special',cg:{stage}};
   const state=JSON.stringify(c.state),storage=dump();assert(api.specialStatus(c,cg).unlocked);assert(!api.hasSpecialRevealed(c,cg),stage);api.list(c);api.listSaved();assert.equal(JSON.stringify(c.state),state);assert.deepEqual(dump(),storage);assert(api.claimSpecialReveal(c,cg));assert.equal(api.claimSpecialReveal(c,cg),false);
  }
 });
 check('旧已揭晓/original和schema1已阅读静默迁移；无进度的当前结算保持待揭晓',()=>{
  for(const progress of [{version:2,part:'special',cg:{stage:'revealed'}},{version:2,part:'original',cg:{stage:'closed'}},{version:1,part:'special',beat:1},{version:1,part:'original',beat:0},null]){
   reset();const cg=award();w.localStorage.clear();delete c.state.whaleGallery.specialLedger;c.state.embodiedReward=progress;
   assert.equal(api.hasSpecialRevealed(c,cg),!!progress);if(progress)assert.equal(api.claimSpecialReveal(c,cg),false);else assert(api.claimSpecialReveal(c,cg));
  }
 });
 check('旧手动/自动/阶段锚点/缓存云档历史只读补收，解锁入口才持久化迁移',()=>{
  const base=reset(),save=w.GameSave,rows=stages.map((ver,i)=>({ver,verdict:grades[i],missionHit:true}));
  const snapshots=rows.map(row=>{const s=save.clone(base);s.codexLog=[row];return save.buildSnapshot(s);});
  w.localStorage.setItem(save.AUTO_KEY,JSON.stringify(snapshots[0]));w.localStorage.setItem(save.slotKey(0),JSON.stringify(snapshots[1]));w.localStorage.setItem(save.STAGE_KEY,JSON.stringify(snapshots[2]));w.Menu._loadCloud={state:'ok',snap:snapshots[3]};
  const before=dump(),state=JSON.stringify(c.state);for(const row of rows){const cg=w.EmbodiedPresentation.specialCG(c,{...row,settled:true},row.ver);assert(api.hasSpecialRevealed(c,cg));}assert.equal(JSON.stringify(c.state),state);assert.deepEqual(dump(),before);assert.equal(w.localStorage.getItem(api.SPECIAL_LEDGER_KEY),null);
  const cg=award('V5','top');w.localStorage.setItem(save.AUTO_KEY,JSON.stringify(snapshots[0]));w.localStorage.setItem(save.STAGE_KEY,JSON.stringify(snapshots[2]));assert(api.unlockSpecial(c,cg)===false,'real finish already unlocks once');const persisted=JSON.parse(w.localStorage.getItem(api.SPECIAL_LEDGER_KEY));for(const row of rows)assert(persisted.entries[row.ver+':'+row.verdict].revealed);
 });
 check('存档ledger可在浏览器总账丢失时恢复，未知未来schema不覆盖',()=>{
  reset();const cg=award();assert(api.claimSpecialReveal(c,cg));const s=w.GameSave.clone(c.state);w.localStorage.clear();c.loadState(s);assert(api.hasSpecialRevealed(c,cg));assert.equal(api.claimSpecialReveal(c,cg),false);
  const future={version:9,entries:{custom:{keep:true}},newField:'preserved'};c.state.whaleGallery.specialLedger=future;const before=JSON.stringify(future);assert.equal(api.unlockSpecial(c,cg),false);assert.equal(api.claimSpecialReveal(c,cg),false);assert.equal(JSON.stringify(future),before);
 });
 check('显式newGame在替换老auto前保存真实历史，当前pending迁移仍未揭晓且原返回值保持',()=>{
  let s=reset();s.codexLog=[{ver:'V6',verdict:'excellent',missionHit:true}];w.GameSave.autoSave(s);const cg=w.EmbodiedPresentation.specialCG(c,{verdict:'excellent',settled:true},'V6');c.state=null;const result=c.newGame();assert.equal(result,c.state);assert(api.hasSpecialRevealed(c,cg));assert(JSON.parse(w.localStorage.getItem(api.SPECIAL_LEDGER_KEY)).entries['V6:excellent'].revealed);
  reset();const pending=award('V5.5','top');w.localStorage.clear();delete c.state.whaleGallery.specialLedger;c.state.embodiedReward={version:2,part:'special',cg:{stage:'flying'}};c.newGame();assert(api.specialStatus(c,pending).unlocked);assert(!api.hasSpecialRevealed(c,pending));
 });
 check('只接受真实已结算当前CG，预览/伪造路径/未知stage或grade不消耗资格',()=>{
  reset();const cg=award();const money=c.state.funding,before=dump();
  for(const bad of [{...cg,id:'V7:top',ver:'V7'},{...cg,verdict:'veto'},{...cg,id:'V5:excellent',verdict:'excellent'},{...cg,src:'resource/story/other.webp'},null]){assert.equal(api.claimSpecialReveal(c,bad),false);assert.equal(api.unlockSpecial(c,bad),false);}
  c.state.result.settled=false;assert.equal(api.claimSpecialReveal(c,cg),false);assert.equal(api.unlockSpecial(c,cg),false);c.state.result.settled=true;assert.equal(c.state.funding,money);assert.deepEqual(dump(),before);assert(!api.hasSpecialRevealed(c,cg));
 });
 check('单图查看器只读且转义文案，Esc/关闭/返回均恢复焦点且onClose恰一次',()=>{
  reset();const cg=award(),button=w.document.createElement('button');button.textContent='查看CG';w.document.body.appendChild(button);let closed=0,leaks=0;const leak=()=>leaks++;w.document.addEventListener('click',leak);
  try{for(const action of ['escape','back','close']){button.focus();const before=dump(),money=c.state.funding,result=JSON.stringify(c.state.result);assert(api.openSpecialImage(c,{...cg,title:'<img src=x onerror=alert(1)>'},{returnFocus:button,onClose:()=>closed++}));const root=w.document.querySelector('.whale-gallery-single');assert(root);assert.equal(root.querySelectorAll('.whale-gallery-viewer img').length,1);assert(root.querySelector('h3').textContent.includes('<img'));assert.equal(root.querySelector('h3 img'),null);assert.equal(root.querySelector('.whale-gallery-view-nav').hidden,true);assert(c.state.officePaused);assert(!api.hasSpecialRevealed(c,cg));assert.deepEqual(dump(),before);if(action==='escape')w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));else root.querySelector('[data-gallery="'+action+'"]').click();assert(!api.isOpen());assert.equal(w.document.activeElement,button);assert.equal(c.state.officePaused,false);assert.equal(c.state.funding,money);assert.equal(JSON.stringify(c.state.result),result);assert.deepEqual(dump(),before);api.close();}assert.equal(closed,3);assert.equal(leaks,0);}finally{api.close();button.remove();w.document.removeEventListener('click',leak);}
 });
 check('大图只释放自身暂停所有权，切换存档自动清理不会推进支付',()=>{
  reset();const cg=award(),release=w.OfficePause.acquire(c,'other-dialog');assert(api.openImage(c,cg));api.close();assert(c.state.officePaused);release();assert(!c.state.officePaused);let closed=0;api.openSpecialImage(c,cg,{onClose:()=>closed++});c.newGame();const before={phase:c.state.phase,ver:c.state.ver,funding:c.state.funding,result:c.state.result};u.render();assert(!api.isOpen());assert.equal(closed,1);assert.deepEqual({phase:c.state.phase,ver:c.state.ver,funding:c.state.funding,result:c.state.result},before);
 });
 check('localStorage写失败仅用存档/会话后备且首次仍单次；未知浏览器schema原样保留',()=>{
  reset();const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(key,value){if(key===api.SPECIAL_LEDGER_KEY)throw Error('quota');return original.call(this,key,value);};
  try{const cg=award();assert(api.claimSpecialReveal(c,cg));assert.equal(api.claimSpecialReveal(c,cg),false);assert(c.state.whaleGallery.specialLedger.entries[cg.id].revealed);c.newGame();assert(api.hasSpecialRevealed(c,cg));assert.equal(w.localStorage.getItem(api.SPECIAL_LEDGER_KEY),null);}finally{w.Storage.prototype.setItem=original;}
  const future=JSON.stringify({version:7,entries:{keep:'unknown'}});w.localStorage.setItem(api.SPECIAL_LEDGER_KEY,future);const cg=award('V6','excellent');assert(api.claimSpecialReveal(c,cg));assert.equal(w.localStorage.getItem(api.SPECIAL_LEDGER_KEY),future);
  for(const raw of ['null','false','0','[]','broken']){w.localStorage.setItem(api.SPECIAL_LEDGER_KEY,raw);api.unlockSpecial(c,cg);assert.equal(w.localStorage.getItem(api.SPECIAL_LEDGER_KEY),raw);}
 });
 assert.deepEqual(r.errors,[]);console.log('✓ special CG ledger '+checks+' groups');
}finally{api.close();r.close();}
