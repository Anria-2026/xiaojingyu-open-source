'use strict';
// Synthetic storage only; no browser profile or actual Toy API is used.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname;let groups=0;
const copy=x=>JSON.parse(JSON.stringify(x));
function boot(){
 const local=new Map(),writes=[],events=[];let failKey=null,failRemoveKey=null,depth=0;
 const storage={getItem:key=>local.get(key)||null,setItem(key,value){if(key===failKey)throw Error('synthetic quota exceeded');local.set(key,String(value));writes.push(key);},removeItem(key){if(key===failRemoveKey)throw Error('synthetic removal failure');local.delete(key);}};
 const w={addEventListener(){},ToyCloud:{beginRestore(){depth++;events.push('begin');},endRestore(){depth--;events.push('end');},onLocalSaved(){events.push('upload');},flush(){events.push('flush');return Promise.resolve();}}};
 const math=Object.create(Math),b={window:w,Math:math,Date,console,setTimeout(){return 1;},clearTimeout(){},localStorage:storage};vm.createContext(b);
 for(const name of ['game_cfg','v35_core','game_core','game_save']){vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),b,{filename:name+'.js'});for(const key of ['GameCfg','V35','GameCore','GameSave'])if(w[key])b[key]=w[key];}
 const {GameCfg:c,GameCore:g,GameSave:save,V35:V}=w;c.applyExternalCfg(JSON.parse(fs.readFileSync(path.join(root,'data/game_cfg.json'),'utf8')));math.random=V.mulberry32(72);g.init(c);g.newGame();g.setModelName('synthetic restore fixture');g.startProject('synthetic restore fixture');
 const old=save.buildSnapshot(g.state);old.state.fixtureOld='previous-progress';local.set(save.AUTO_KEY,JSON.stringify(old));local.set(save.STAGE_KEY,JSON.stringify({...old,state:{...old.state,stageNo:-1}}));local.set(save.slotKey(2),JSON.stringify(old));writes.length=0;events.length=0;
 return{w,g,c,save,local,writes,events,rng:math.random,depth:()=>depth,fail:key=>failKey=key,failRemove:key=>failRemoveKey=key,snap:()=>save.buildSnapshot(g.state)};
}
function check(label,fn){fn();groups++;console.log('✓ '+label);}
function restoredSnapshot(env){const snap=env.snap();Object.assign(snap.state,{ver:'V3',phase:'office',funding:7654321,week:7,stageNo:3,modelName:'cloud-progress'});return snap;}
function unchanged(env,previous,raw,memory){assert.deepEqual([...env.local],raw);assert.strictEqual(env.g.state,previous);assert.equal(JSON.stringify(previous),memory);assert.equal(env.depth(),0);assert(!env.events.includes('flush')&&!env.events.includes('upload'));}
check('current save preserves stage/cash and commits auto plus repair anchor without uploading',()=>{
 const e=boot(),snap=restoredSnapshot(e),input=JSON.stringify(snap),manual=e.local.get(e.save.slotKey(2));const result=e.save.restoreSnapshot(snap,e.g);
 assert(result.ok,JSON.stringify(result));assert.equal(e.g.state.ver,'V3');assert.equal(e.g.state.funding,7654321);assert.equal(e.g.state.week,7);assert.equal(e.local.get(e.save.slotKey(2)),manual);assert.equal(JSON.stringify(snap),input);assert.equal(JSON.parse(e.local.get(e.save.AUTO_KEY)).state.modelName,'cloud-progress');assert.equal(JSON.parse(e.local.get(e.save.STAGE_KEY)).state.stageNo,3);assert.equal(e.depth(),0);assert.deepEqual(e.events,['begin','end']);
 // An entry may launch after menu restore; loading auto again must keep cash.
 const reloaded=e.save.load('auto');e.w.ToyCloud.beginRestore();e.g.loadState(reloaded.state);e.w.ToyCloud.endRestore();assert.equal(e.g.state.funding,7654321);
});
check('real new project and real production weekly records round-trip through restore',()=>{
 const e=boot(),initial=e.snap();assert(Array.isArray(initial.state.v35.weekly));assert.equal(initial.state.v35.weekly.length,0);assert(e.save.restoreSnapshot(initial,e.g).ok);
 for(let i=0;i<e.c.V35.TICKS_PER_WEEK+1;i++)e.w.V35.tick(e.g.state.v35,e.rng);
 const progressed=e.snap();assert(progressed.state.v35.weekly.length>0);const result=e.save.restoreSnapshot(progressed,e.g);assert(result.ok,JSON.stringify(result));assert.deepEqual(copy(e.g.state.v35.weekly),copy(progressed.state.v35.weekly));
});
check('sparse historical save migrates without fabricated money or mutation of the caller',()=>{
 const e=boot(),snap=restoredSnapshot(e);snap.saveVersion=0;snap.state.v35={};delete snap.state.triggered;delete snap.state.pending;delete snap.state.candidates;const input=JSON.stringify(snap);const result=e.save.restoreSnapshot(snap,e.g);
 assert(result.ok);assert.equal(e.g.state.funding,7654321);assert.equal(e.g.state.ver,'V3');assert(e.g.state.v35.energy&&e.g.state.v35.corpus);assert.equal(JSON.stringify(snap),input);
});
check('historical UI phases remain readable so existing core/UI migration can handle them',()=>{
 for(const phase of ['loop','minigame','recruit','buygpu','direction','evalshow']){const e=boot(),snap=restoredSnapshot(e);snap.state.phase=phase;const result=e.save.restoreSnapshot(snap,e.g);assert(result.ok,phase+': '+JSON.stringify(result));assert.equal(e.g.state.funding,7654321);assert.equal(e.g.state.ver,'V3');}
});
check('matching local stage identifiers never reuse an unrelated playthrough anchor',()=>{
 const e=boot(),snap=restoredSnapshot(e),stale=copy(snap);stale.state.modelName='unrelated local progress';stale.state.funding=111;stale.state.week=1;e.local.set(e.save.STAGE_KEY,JSON.stringify(stale));
 const result=e.save.restoreSnapshot(snap,e.g);assert(result.ok);assert(result.stageSaved);const anchor=e.save.loadStage();assert.equal(anchor.state.modelName,'cloud-progress');assert.equal(anchor.state.funding,7654321);assert.equal(anchor.state.week,7);assert.equal(anchor.state.stageNo,snap.state.stageNo);assert.equal(anchor.state.ver,snap.state.ver);
});
check('future format and stage refuse explicitly instead of silently falling back to V1',()=>{
 for(const change of [s=>s.saveVersion=100,s=>s.saveVersion=1.5,s=>s.state.ver='V99']){const e=boot(),snap=restoredSnapshot(e);change(snap);const previous=e.g.state,raw=[...e.local],memory=JSON.stringify(previous);const result=e.save.restoreSnapshot(snap,e.g);assert(!result.ok);assert(['unsupported-version','unsupported-stage'].includes(result.reason));unchanged(e,previous,raw,memory);}
});
check('invalid engine/candidate/member shapes cannot overwrite current state or local slots',()=>{
 for(const change of [s=>s.state.v35='corrupt',s=>s.state.candidates={bad:true},s=>s.state.engineers=[null],s=>s.state.v35.energy='corrupt',s=>s.state.v35.weekly={},s=>s.state.phase='future-phase']){const e=boot(),snap=restoredSnapshot(e);change(snap);const previous=e.g.state,raw=[...e.local],memory=JSON.stringify(previous);const result=e.save.restoreSnapshot(snap,e.g);assert(!result.ok);assert.equal(result.reason,'invalid-state');unchanged(e,previous,raw,memory);}
});
check('a late loadState exception discards buffered auto/stage writes and restores methods',()=>{
 const e=boot(),previous=e.g.state,raw=[...e.local],memory=JSON.stringify(previous),load=e.g.loadState,saveStage=e.save.saveStage,notify=e.save._notifyCloud;e.g.loadState=function(state){load.call(this,state);e.save.autoSave(this.state);throw Error('synthetic late load failure');};
 const result=e.save.restoreSnapshot(restoredSnapshot(e),e.g);assert(!result.ok);assert.equal(result.reason,'load-error');unchanged(e,previous,raw,memory);assert.strictEqual(e.save.saveStage,saveStage);assert.strictEqual(e.save._notifyCloud,notify);
});
check('failed automatic commit preserves both original slots and the exact original memory object',()=>{
 const e=boot(),previous=e.g.state,raw=[...e.local],memory=JSON.stringify(previous);e.fail(e.save.AUTO_KEY);const result=e.save.restoreSnapshot(restoredSnapshot(e),e.g);assert(!result.ok);assert.equal(result.reason,'storage-error');unchanged(e,previous,raw,memory);
});
check('optional stage commit failure keeps restored progress and clears unrelated retry anchor',()=>{
 const e=boot();e.fail(e.save.STAGE_KEY);const result=e.save.restoreSnapshot(restoredSnapshot(e),e.g);assert(result.ok);assert.equal(result.stageSaved,false);assert.equal(result.stageRemoved,true);assert.equal(e.g.state.funding,7654321);assert.equal(JSON.parse(e.local.get(e.save.AUTO_KEY)).state.funding,7654321);assert.equal(e.local.get(e.save.STAGE_KEY),undefined);assert.equal(e.depth(),0);
});
check('stage storage plus deletion failure is explicitly reported rather than claiming anchor safety',()=>{
 const e=boot(),oldStage=e.local.get(e.save.STAGE_KEY);e.fail(e.save.STAGE_KEY);e.failRemove(e.save.STAGE_KEY);const result=e.save.restoreSnapshot(restoredSnapshot(e),e.g);assert(result.ok);assert.equal(result.stageSaved,false);assert.equal(result.stageRemoved,false);assert.equal(e.local.get(e.save.STAGE_KEY),oldStage);assert.equal(e.g.state.funding,7654321);assert.equal(e.depth(),0);
});
check('pre-game uninitialized core receives available config; failure restores its null config/state',()=>{
 const e=boot(),snap=restoredSnapshot(e);e.g.cfg=null;e.g.state=null;assert(e.save.restoreSnapshot(snap,e.g).ok);assert.strictEqual(e.g.cfg,e.c);assert.equal(e.g.state.ver,'V3');
 const f=boot(),bad=restoredSnapshot(f);f.g.cfg=null;f.g.state=null;f.fail(f.save.AUTO_KEY);assert.equal(f.save.restoreSnapshot(bad,f.g).reason,'storage-error');assert.strictEqual(f.g.cfg,null);assert.strictEqual(f.g.state,null);
});
check('nested cloud guards keep their outer ownership and busy restores never enter a transaction',()=>{
 const e=boot();e.w.ToyCloud.beginRestore();assert(e.save.restoreSnapshot(restoredSnapshot(e),e.g).ok);assert.equal(e.depth(),1);e.w.ToyCloud.endRestore();assert.equal(e.depth(),0);e.save._snapshotRestoring=true;const before=[...e.local];assert.equal(e.save.restoreSnapshot(restoredSnapshot(e),e.g).reason,'busy');assert.deepEqual([...e.local],before);
});
console.log('All '+groups+' save restoration groups passed.');
