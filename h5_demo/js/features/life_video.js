/* Native decoded movie clips: no frame extraction or green-key work in play. */
(function(){
  'use strict';
  if(window.LifeVideo)return;
  function create(options){
    const doc=options.document||document,host=options.host,loop=!!options.loop;
    const box=doc.createElement('div');box.className='life-native-media';
    const video=doc.createElement('video'),still=doc.createElement('img');
    video.muted=true;video.defaultMuted=true;video.setAttribute('muted','');video.setAttribute('playsinline','');video.playsInline=true;video.loop=loop;video.preload=options.preload||'auto';video.disablePictureInPicture=true;video.setAttribute('aria-hidden','true');
    still.src=options.poster||'';still.alt='';still.draggable=false;still.className='life-media-poster';
    box.append(video,still);host.appendChild(box);
    let dead=false,failed=false,pending=false,playing=false,lastTime=null,lastHold=null,desired=0,displayed=false,seekTarget=null;
    let frameReady=false,frameHandle=null,frameRevision=0,frameStarted=null;
    let frameCallbacks=typeof video.requestVideoFrameCallback==='function';
    const clock=()=>((doc.defaultView||window).performance?.now?.()??Date.now());
    const safari=/Apple/.test((doc.defaultView||window).navigator?.vendor||'')&&!/CriOS|EdgiOS|FxiOS/.test((doc.defaultView||window).navigator?.userAgent||'');
    const fallback=loop&&!!options.fallback&&(safari||!video.canPlayType('video/webm; codecs="vp9"'));
    if(fallback){failed=true;box.dataset.fallback='true';}else video.src=options.src;
    function cancelFirstFrame(reset=false){
      frameRevision++;if(frameHandle!=null)try{video.cancelVideoFrameCallback?.(frameHandle);}catch(_){}
      frameHandle=null;frameStarted=null;if(reset)frameReady=false;
    }
    function firstFrameReady(){
      if(dead)return false;if(failed)return true;
      if(!frameCallbacks)return video.readyState>=2&&playing&&!video.paused&&!lastHold;
      if(frameReady)return true;
      // Read by the caller's existing movie clock; no extra timer or RAF loop.
      // A decoder without a delivered callback must not hold a curtain forever.
      if(frameStarted!=null&&clock()-frameStarted>=1000&&video.readyState>=2&&playing&&!video.paused&&!lastHold&&!video.seeking){frameReady=true;cancelFirstFrame();return true;}
      return false;
    }
    function observeFirstFrame(){
      if(dead||failed||!frameCallbacks||frameReady||frameHandle!=null||!playing||video.paused||lastHold||video.seeking)return;
      if(frameStarted==null)frameStarted=clock();const revision=frameRevision;
      try{frameHandle=video.requestVideoFrameCallback((now,metadata)=>{
        // Cancellation does not guarantee an already queued native callback
        // disappears. A stale callback cannot clear a newer observation handle.
        if(dead||revision!==frameRevision)return;frameHandle=null;
        if(failed||!playing||video.paused||lastHold||video.seeking)return;
        if(Number(metadata?.mediaTime)>0){frameReady=true;frameStarted=null;return;}
        // The paused preload's time-zero frame can arrive after playing.
        if(!firstFrameReady())observeFirstFrame();
      });}catch(_){frameCallbacks=false;cancelFirstFrame();}
    }
    function seek(){try{if(video.readyState>=1){
      const target=Math.max(0,Math.min(desired,Number.isFinite(video.duration)?Math.max(0,video.duration-.035):desired));
      // Assigning the same frame restarts an asynchronous seek in real browsers.
      // Readiness/pause callbacks may repeat while that seek is completing.
      if(video.seeking&&seekTarget!=null&&Math.abs(seekTarget-target)<=.035)return;
      if(Math.abs(Number(video.currentTime)-target)>.035){seekTarget=target;video.currentTime=target;}
    }}catch(_){}}
    video.addEventListener('loadedmetadata',seek);
    video.addEventListener('seeked',()=>{seekTarget=null;observeFirstFrame();});
    video.addEventListener('playing',()=>{playing=true;pending=false;box.dataset.ready='true';if(lastHold)video.pause();else observeFirstFrame();});
    video.addEventListener('pause',()=>{playing=false;cancelFirstFrame();});
    // HAVE_CURRENT_DATA (2) still retains a decoded frame during waiting.
    // Only playing confirms consumption resumed; stalled alone can keep
    // consuming an already buffered range and must not stop the movie clock.
    video.addEventListener('waiting',()=>{playing=false;cancelFirstFrame();});
    video.addEventListener('error',()=>{failed=true;pending=false;cancelFirstFrame(true);box.dataset.error='true';});
    function render(input={}){
      if(dead)return;
      const hold=!!(input.paused||input.reduced||input.stopped),time=Math.max(0,Number(input.time)||0),duration=Number(options.duration)||Number(video.duration)||1;
      if(input.seek)cancelFirstFrame(true);else if(hold)cancelFirstFrame();
      desired=loop?time%duration:Math.min(time,Math.max(0,duration-.035));
      if(input.stopped||input.reduced){
        if(!video.paused)video.pause();const src=input.stopped?options.rest||options.poster:options.poster;
        if(still.getAttribute('src')!==src)still.src=src||'';still.hidden=false;video.hidden=true;lastHold=hold;lastTime=time;return;
      }
      if(failed){
        const src=!hold&&loop&&options.fallback?options.fallback:options.poster||'';
        if(still.getAttribute('src')!==src)still.src=src;
        still.hidden=false;video.hidden=true;lastHold=hold;lastTime=time;return;
      }
      video.hidden=false;if(still.getAttribute('src')!==options.poster)still.src=options.poster||'';
      const ready=video.readyState>=2;displayed=displayed||ready;still.hidden=displayed;box.dataset.ready=String(ready);
      // Buffering or a user pause must retain the decoder's current frame.
      // Only a genuine authored seek/discontinuity repositions native media.
      if(input.seek||lastTime==null||Math.abs(time-lastTime)>.35)seek();
      lastHold=hold;
      if(hold){if(!video.paused)video.pause();}
      else if(video.paused&&!pending&&!video.ended){pending=true;try{const promise=video.play();promise?.then(()=>{pending=false;},()=>{pending=false;box.dataset.blocked='true';});}catch(_){pending=false;}}
      if(!hold)observeFirstFrame();
      lastHold=hold;lastTime=time;
    }
    function destroy(){if(dead)return;dead=true;cancelFirstFrame(true);video.pause();video.removeAttribute('src');try{video.load();}catch(_){}still.removeAttribute('src');box.remove();}
    return {element:box,video,render,destroy,ready:()=>failed||video.readyState>=2,failed:()=>failed,playing:()=>playing,firstFrameReady};
  }
  window.LifeVideo={create};
})();
