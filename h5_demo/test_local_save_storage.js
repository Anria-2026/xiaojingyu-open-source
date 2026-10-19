'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'js/local_save_storage.js'),'utf8');
const settings=JSON.parse(fs.readFileSync(path.join(__dirname,'local_save_config.json'),'utf8'));
function boot(initial={},disk={revision:0,migrated:false,values:{}},fail=false,blocked=false){
 const native=new Map(Object.entries(initial)),alerts=[],calls=[];
 const storage={getItem:k=>native.has(k)?native.get(k):null,setItem:(k,v)=>native.set(k,String(v)),removeItem:k=>native.delete(k),key:i=>[...native.keys()][i]||null,clear:()=>native.clear(),get length(){return native.size;}};
 const window={alert:m=>alerts.push(m),GameCfg:{VER_ORDER:['V1']}};
 Object.defineProperty(window,'localStorage',{get(){if(blocked)throw Error('blocked browser');return storage;},configurable:true});
 const config={...settings,revision:disk.revision,migrated:disk.migrated,values:{...disk.values},token:'fixture'};
 function XHR(){}
 XHR.prototype.open=function(method,url,async){assert.equal(async,false);};XHR.prototype.setRequestHeader=function(){};
 XHR.prototype.send=function(raw){
  const request=JSON.parse(raw);calls.push(request);
  if(fail){this.status=500;this.responseText=JSON.stringify({ok:false,error:'synthetic disk failure'});return;}
  if(request.revision!==disk.revision){this.status=409;this.responseText=JSON.stringify({ok:false,error:'conflict'});return;}
  for(const [k,v] of Object.entries(request.values)){if(v==null)delete disk.values[k];else disk.values[k]=v;}
  if(request.action==='clear')disk.values={};disk.revision++;disk.migrated=true;
  this.status=200;this.responseText=JSON.stringify({ok:true,storage:disk});
 };
 const context=vm.createContext({window,XMLHttpRequest:XHR,console});
 vm.runInContext('('+source+')('+JSON.stringify(config)+')',context);
 Object.defineProperty(context,'localStorage',{get:()=>window.localStorage});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'js/game_save.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'js/achieve_store.js'),'utf8'),context);
 return {storage:window.localStorage,save:window.GameSave,achievements:window.AchieveStore,native,alerts,calls,disk};
}
const key='whale_dev_v35_auto',snapshot={saveVersion:6,state:{ver:'V1',v35:{},engineers:[]}};
let b=boot({[key]:'browser save',whale_music_vol:'0.7'});
assert.equal(b.storage.getItem(key),'browser save');assert.equal(b.disk.values[key],'browser save');assert.equal(b.native.get(key),'browser save');
b.storage.setItem('whale_music_vol','0.5');assert.equal(b.native.get('whale_music_vol'),'0.5');assert.equal(b.calls.length,1);
assert(b.save.writeSnapshot('auto',snapshot));assert.equal(b.save.load('auto').state.ver,'V1');
b.save.remove('auto');assert.equal(b.disk.values[key],undefined);assert.equal(b.storage.getItem(key),null);
b=boot({[key]:'stale browser'}, {revision:4,migrated:true,values:{[key]:'file save'}});assert.equal(b.storage.getItem(key),'file save');assert.equal(b.calls.length,0);
b=boot({}, {revision:2,migrated:true,values:{[key]:'safe'}},true);assert.equal(b.save.writeSnapshot('auto',snapshot),false);assert.equal(b.disk.values[key],'safe');assert.equal(b.native.has(key),false);assert.equal(b.alerts.length,1);
b=boot({}, {revision:0,migrated:false,values:{}},false,true);assert(b.save.writeSnapshot('auto',snapshot));assert(b.disk.values[key]);
assert(b.achievements.persistent());b.achievements.unlock('FILE_STORAGE_FIXTURE',{});assert(b.disk.values[b.achievements.KEY]);
console.log('PASS: browser migration, file precedence, native preferences, actual GameSave read/write/delete, failed writes, and disabled native storage.');
