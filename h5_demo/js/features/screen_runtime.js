/* Screen ownership uses real browser locks and the documented Toy container API. */
(function(){
  'use strict';
  if(window.GameScreen)return;
  let sentinel=null,pending=null,epoch=0,blocked=false,suspended=false;
  const owners=new Set();
  const active=()=>!document.hidden&&!suspended&&(owners.size>0||!!window.Training?._shown);
  const status=value=>{document.documentElement.dataset.screenAwake=value;};
  function release(){
    epoch++;pending=null;const lock=sentinel;sentinel=null;
    if(lock)try{Promise.resolve(lock.release()).catch(()=>{});}catch(_){}
    status('off');
  }
  function sync(retry=false){
    if(!active()){release();return;}
    if(sentinel&&!sentinel.released||pending)return;
    if(!navigator.wakeLock?.request){status('unsupported');return;}
    if(blocked&&!retry)return;blocked=false;
    const ticket=++epoch;status('pending');
    let request;try{request=navigator.wakeLock.request('screen');}catch(_){blocked=true;status('blocked');return;}
    const task=Promise.resolve(request).then(lock=>{
      if(ticket!==epoch||!active()){try{Promise.resolve(lock.release()).catch(()=>{});}catch(_){}return;}
      sentinel=lock;status('active');
      lock.addEventListener?.('release',()=>{if(sentinel!==lock)return;sentinel=null;blocked=true;status(active()?'released':'off');});
    },()=>{if(ticket===epoch){blocked=true;status('blocked');}}).finally(()=>{if(pending===task)pending=null;});
    pending=task;
  }
  function hold(owner){owners.add(owner);sync(true);let done=false;return()=>{if(done)return;done=true;owners.delete(owner);sync();};}
  function presentation(root,onChange){
    const sdk=window.toy;let prior=null,current=null,off=null,supported=null,closed=false,owned=false,requesting=null,target=null;
    function update(state){
      if(closed||!state||!['portrait','landscape'].includes(state.orientation))return;
      if(!prior)prior={orientation:state.orientation,immersive:state.immersive===true};
      current=state;supported=true;
      if(target)root.dataset.fullscreen=state.orientation===target.orientation&&state.immersive===target.immersive?'active':'pending';
      onChange?.(state);sync(true);
    }
    if(sdk){
      try{if(typeof sdk.onContainerChange==='function')off=sdk.onContainerChange(update);}catch(_){}
      try{if(typeof sdk.getContainerState==='function')Promise.resolve(sdk.getContainerState()).then(update,()=>{});}catch(_){}
      try{if(typeof sdk.isSupport==='function')Promise.resolve(sdk.isSupport('setContainerMode')).then(value=>{if(!closed&&supported!==true)supported=value===true;},()=>{});}catch(_){}
    }
    function native(){
      const method=root.requestFullscreen||root.webkitRequestFullscreen;
      if(!method){root.dataset.fullscreen='unsupported';return Promise.resolve(false);}
      try{return Promise.resolve(method.call(root)).then(()=>{if(closed){owned=true;restore();}else{owned=true;root.dataset.fullscreen=document.fullscreenElement===root||document.webkitFullscreenElement===root?'active':'pending';try{Promise.resolve(screen.orientation?.lock?.('landscape')).catch(()=>{});}catch(_){}sync(true);}return true;},()=>{root.dataset.fullscreen='blocked';return false;});}
      catch(_){root.dataset.fullscreen='blocked';return Promise.resolve(false);}
    }
    function restore(){
      if(!owned)return;owned=false;
      if(target&&prior&&sdk?.setContainerMode)try{Promise.resolve(sdk.setContainerMode(prior)).catch(()=>{});}catch(_){}
      if(document.fullscreenElement===root||document.webkitFullscreenElement===root){try{Promise.resolve((document.exitFullscreen||document.webkitExitFullscreen)?.call(document)).catch(()=>{});}catch(_){}}
    }
    function request(){
      if(closed)return Promise.resolve(false);if(requesting)return requesting;
      root.dataset.fullscreen='pending';sync(true);
      if(sdk?.setContainerMode&&(supported===true||supported!==false&&/bili/i.test(navigator.userAgent))){
        target={orientation:'landscape',immersive:true};owned=!prior||prior.orientation!==target.orientation||prior.immersive!==target.immersive;
        try{requesting=Promise.resolve(sdk.setContainerMode(target)).then(()=>{if(closed)restore();return true;},()=>{target=null;owned=false;return closed?false:native();}).finally(()=>{requesting=null;});return requesting;}
        catch(_){target=null;owned=false;}
      }
      return native();
    }
    const changed=()=>{if(closed)return;root.dataset.fullscreen=document.fullscreenElement===root||document.webkitFullscreenElement===root?'active':'off';onChange?.(current);sync(true);};
    document.addEventListener('fullscreenchange',changed);document.addEventListener('webkitfullscreenchange',changed);
    return{request,close(){if(closed)return;closed=true;if(typeof off==='function')off();document.removeEventListener('fullscreenchange',changed);document.removeEventListener('webkitfullscreenchange',changed);if(!requesting)restore();}};
  }
  for(const name of ['open','close'])if(window.Training&&typeof Training[name]==='function'){const original=Training[name];Training[name]=function(){const result=original.apply(this,arguments);sync(true);return result;};}
  document.addEventListener('visibilitychange',()=>sync(true));
  window.addEventListener('pagehide',()=>{suspended=true;release();});window.addEventListener('pageshow',()=>{suspended=false;sync(true);});
  document.addEventListener('pointerdown',()=>sync(true),{passive:true});
  window.GameScreen={hold,sync,presentation,status:()=>document.documentElement.dataset.screenAwake};
})();
