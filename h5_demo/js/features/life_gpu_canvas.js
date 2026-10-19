/* Native-resolution textured-quad bridge for the finale compositor.
 * Geometry and gradient painting remain Canvas2D bakes; playback uploads each
 * immutable bake once and mirrors the sky through a shared GPU framebuffer.
 * This deliberately implements only the Canvas2D operations used by playback.
 */
(function(){
  'use strict';
  if(window.LifeGPUCanvas)return;
  const VERTEX_SIZE=5,QUAD_FLOATS=6*VERTEX_SIZE,MAX_QUADS=512;
  const finite=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
  const identity=()=>[1,0,0,1,0,0];
  const multiply=(m,a,b,c,d,e,f)=>[m[0]*a+m[2]*b,m[1]*a+m[3]*b,m[0]*c+m[2]*d,m[1]*c+m[3]*d,m[0]*e+m[2]*f+m[4],m[1]*e+m[3]*f+m[5]];
  const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  function bounds(m,x,y,w,h){
    const p=[point(m,x,y),point(m,x+w,y),point(m,x,y+h),point(m,x+w,y+h)];
    return[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
  }
  const intersect=(a,b)=>a?[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])]:b.slice();
  function create(element,options={}){
    if(!element||typeof element.getContext!=='function')return null;
    const doc=element.ownerDocument||window.document,attributes={alpha:false,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'};
    let gl=null,is2=false;
    try{gl=element.getContext('webgl2',attributes);is2=!!gl;if(!gl)gl=element.getContext('webgl',attributes)||element.getContext('experimental-webgl',attributes);}catch(error){return null;}
    if(!gl)return null;
    let program=null,buffer=null,framebuffer=null,skyTexture=null,disposed=false,lost=false;
    const shaders=[];
    let sourceCache=new WeakMap(),paintCache=new Map(),textures=new Set(),activeTarget=null,batchTexture=null,batchClip=null,count=0;
    const vertices=new Float32Array(MAX_QUADS*QUAD_FLOATS),stats={uploads:0,uploadedPixels:0,drawCalls:0,quads:0,errorChecks:0,uploadPolls:0};
    const targets={main:{width:1,height:1,framebuffer:null},sky:{width:1,height:1,framebuffer:null}};
    const skyToken={width:1,height:1};
    let pixelRatio=1,uploadFence=null,uploadsPending=false,uploadsDirty=false;
    // getError can wait for previously submitted GPU work. During preparation
    // a zero-timeout fence poll lets the owner yield until that work is ready;
    // the same error check still happens before preparation is accepted.
    const deferValidation=options.deferValidation===true&&is2&&['fenceSync','clientWaitSync','deleteSync','flush','getError'].every(key=>typeof gl[key]==='function')&&['SYNC_GPU_COMMANDS_COMPLETE','ALREADY_SIGNALED','CONDITION_SATISFIED','TIMEOUT_EXPIRED','WAIT_FAILED'].every(key=>gl[key]!==undefined);
    function clearUploadFence(){if(uploadFence){gl.deleteSync(uploadFence);uploadFence=null;}}
    function clearUploadValidation(){clearUploadFence();uploadsPending=uploadsDirty=false;}
    function checkUploadErrors(){if(typeof gl.getError==='function'){stats.errorChecks++;if(gl.getError()!==gl.NO_ERROR)throw new Error('LifeGPUCanvas texture allocation failed');}}
    function uploaded(){if(deferValidation){uploadsPending=true;uploadsDirty=true;}else checkUploadErrors();}
    function compile(type,code){const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error('LifeGPUCanvas shader: '+message);}shaders.push(shader);return shader;}
    function parameters(){gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
    let maxTexture=4096;
    let positionLocation,uvLocation,alphaLocation,sizeLocation;
    try{
      maxTexture=gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096;
      const prefix=is2?'#version 300 es\n':'',attribute=is2?'in':'attribute',varyingOut=is2?'out':'varying',varyingIn=is2?'in':'varying';
      const vs=compile(gl.VERTEX_SHADER,prefix+'precision highp float;\n'+attribute+' vec2 a_position;\n'+attribute+' vec2 a_uv;\n'+attribute+' float a_alpha;\nuniform vec2 u_size;\n'+varyingOut+' vec2 v_uv;\n'+varyingOut+' float v_alpha;\nvoid main(){gl_Position=vec4(a_position.x/u_size.x*2.0-1.0,1.0-a_position.y/u_size.y*2.0,0.0,1.0);v_uv=a_uv;v_alpha=a_alpha;}');
      const fs=compile(gl.FRAGMENT_SHADER,prefix+'precision highp float;\nuniform sampler2D u_texture;\n'+varyingIn+' vec2 v_uv;\n'+varyingIn+' float v_alpha;\n'+(is2?'out vec4 outputColor;\n':'')+'void main(){'+(is2?'outputColor=texture':'gl_FragColor=texture2D')+'(u_texture,v_uv)*v_alpha;}');
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);for(const shader of shaders)gl.deleteShader(shader);shaders.length=0;
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('LifeGPUCanvas link: '+gl.getProgramInfoLog(program));
      gl.useProgram(program);positionLocation=gl.getAttribLocation(program,'a_position');uvLocation=gl.getAttribLocation(program,'a_uv');alphaLocation=gl.getAttribLocation(program,'a_alpha');sizeLocation=gl.getUniformLocation(program,'u_size');
      gl.uniform1i(gl.getUniformLocation(program,'u_texture'),0);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices.byteLength,gl.DYNAMIC_DRAW);
      framebuffer=gl.createFramebuffer();skyTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,skyTexture);parameters();targets.sky.framebuffer=framebuffer;
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.activeTexture(gl.TEXTURE0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    }catch(error){for(const shader of shaders)gl.deleteShader(shader);if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);if(framebuffer)gl.deleteFramebuffer(framebuffer);if(skyTexture)gl.deleteTexture(skyTexture);return null;}
    function bind(target){gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.viewport(0,0,target.width,target.height);activeTarget=target;}
    function scissor(clip,target){
      if(!clip){gl.disable(gl.SCISSOR_TEST);return;}
      const x=Math.max(0,Math.ceil(clip[0])),y=Math.max(0,Math.ceil(clip[1])),right=Math.min(target.width,Math.floor(clip[2])),bottom=Math.min(target.height,Math.floor(clip[3]));
      gl.enable(gl.SCISSOR_TEST);gl.scissor(x,target.height-bottom,Math.max(0,right-x),Math.max(0,bottom-y));
    }
    function flush(){
      if(!count||disposed||lost)return;
      gl.useProgram(program);gl.bindFramebuffer(gl.FRAMEBUFFER,activeTarget.framebuffer);gl.viewport(0,0,activeTarget.width,activeTarget.height);scissor(batchClip,activeTarget);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,batchTexture);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,vertices.subarray(0,count));
      gl.enableVertexAttribArray(positionLocation);gl.vertexAttribPointer(positionLocation,2,gl.FLOAT,false,VERTEX_SIZE*4,0);gl.enableVertexAttribArray(uvLocation);gl.vertexAttribPointer(uvLocation,2,gl.FLOAT,false,VERTEX_SIZE*4,8);gl.enableVertexAttribArray(alphaLocation);gl.vertexAttribPointer(alphaLocation,1,gl.FLOAT,false,VERTEX_SIZE*4,16);
      gl.uniform2f(sizeLocation,activeTarget.width,activeTarget.height);gl.drawArrays(gl.TRIANGLES,0,count/VERTEX_SIZE);stats.drawCalls++;count=0;
    }
    // A synchronous layout can validate immediately rather than busy-looping a
    // fence. Asynchronous preparation calls pollUploads in separate idle tasks.
    function validateUploads(){
      if(disposed||lost)return false;if(!uploadsPending)return true;
      flush();clearUploadValidation();checkUploadErrors();return true;
    }
    function pollUploads(){
      if(disposed||lost)return false;if(!uploadsPending)return true;
      if(!deferValidation)return validateUploads();
      stats.uploadPolls++;
      if(uploadsDirty||!uploadFence){flush();clearUploadFence();uploadFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);uploadsDirty=false;gl.flush();if(!uploadFence){clearUploadValidation();checkUploadErrors();throw new Error('LifeGPUCanvas upload fence allocation failed');}}
      const result=gl.clientWaitSync(uploadFence,0,0);
      if(result===gl.TIMEOUT_EXPIRED)return false;
      clearUploadValidation();
      if(result===gl.ALREADY_SIGNALED||result===gl.CONDITION_SATISFIED){checkUploadErrors();return true;}
      checkUploadErrors();throw new Error('LifeGPUCanvas upload fence wait failed');
    }
    function upload(source){
      if(disposed||lost||!source)return null;
      if(source===skyToken)return{texture:skyTexture,width:skyToken.width,height:skyToken.height,flipped:true};
      let record=sourceCache.get(source);if(record)return record;
      const w=source.naturalWidth||source.videoWidth||source.width,h=source.naturalHeight||source.videoHeight||source.height;
      if(!w||!h)return null;if(w>maxTexture||h>maxTexture)throw new RangeError('LifeGPUCanvas bake exceeds GPU texture limit');
      flush();const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);parameters();gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);uploaded();}catch(error){gl.deleteTexture(texture);throw error;}
      record={texture,width:w,height:h,flipped:false};sourceCache.set(source,record);textures.add(texture);stats.uploads++;stats.uploadedPixels+=w*h;return record;
    }
    function enqueue(target,clip,record,m,alpha,sx,sy,sw,sh,dx,dy,dw,dh){
      if(disposed||lost||!record||alpha<=0||!sw||!sh||!dw||!dh)return;
      // A Canvas source crop outside its bitmap also crops the destination.
      if(sw<0){sx+=sw;sw=-sw;}if(sh<0){sy+=sh;sh=-sh;}if(dw<0){dx+=dw;dw=-dw;}if(dh<0){dy+=dh;dh=-dh;}
      const x0=Math.max(0,sx),y0=Math.max(0,sy),x1=Math.min(record.width,sx+sw),y1=Math.min(record.height,sy+sh);if(x1<=x0||y1<=y0)return;
      const left=dx+(x0-sx)/sw*dw,top=dy+(y0-sy)/sh*dh,right=dx+(x1-sx)/sw*dw,bottom=dy+(y1-sy)/sh*dh;
      const sameClip=(!clip&&!batchClip)||(clip&&batchClip&&clip.every((v,i)=>v===batchClip[i]));
      if(activeTarget!==target||batchTexture!==record.texture||!sameClip||count+QUAD_FLOATS>vertices.length){flush();bind(target);batchTexture=record.texture;batchClip=clip?clip.slice():null;}
      const corners=[point(m,left,top),point(m,right,top),point(m,left,bottom),point(m,right,bottom)],u0=x0/record.width,u1=x1/record.width,v0=record.flipped?1-y0/record.height:y0/record.height,v1=record.flipped?1-y1/record.height:y1/record.height,uv=[[u0,v0],[u1,v0],[u0,v1],[u1,v1]];
      for(const index of [0,1,2,2,1,3]){const p=corners[index],t=uv[index];vertices[count++]=p[0];vertices[count++]=p[1];vertices[count++]=t[0];vertices[count++]=t[1];vertices[count++]=alpha;}stats.quads++;
    }
    function context(target){
      let matrix=identity(),alpha=1,fillStyle='#000',clipBox=null,pathBox=null,stack=[];
      const api={canvas:target===targets.main?element:skyToken,
        save(){stack.push({matrix:matrix.slice(),alpha,fillStyle,clipBox:clipBox?clipBox.slice():null});},
        restore(){const state=stack.pop();if(state){matrix=state.matrix;alpha=state.alpha;fillStyle=state.fillStyle;clipBox=state.clipBox;}},
        setTransform(a,b,c,d,e,f){if(typeof a==='object'){const m=a;a=m.a;b=m.b;c=m.c;d=m.d;e=m.e;f=m.f;}matrix=[a,b,c,d,e,f].map((v,i)=>finite(v,i===0||i===3?1:0));},
        resetTransform(){matrix=identity();},
        transform(a,b,c,d,e,f){matrix=multiply(matrix,a,b,c,d,e,f);},
        translate(x,y){matrix=multiply(matrix,1,0,0,1,x,y);},scale(x,y){matrix=multiply(matrix,x,0,0,y,0,0);},rotate(r){const c=Math.cos(r),s=Math.sin(r);matrix=multiply(matrix,c,s,-s,c,0,0);},
        beginPath(){pathBox=null;},rect(x,y,w,h){const box=bounds(matrix,x,y,w,h);pathBox=pathBox?[Math.min(pathBox[0],box[0]),Math.min(pathBox[1],box[1]),Math.max(pathBox[2],box[2]),Math.max(pathBox[3],box[3])]:box;},clip(){if(pathBox)clipBox=intersect(clipBox,pathBox);},
        drawImage(source,...args){const record=upload(source);if(!record)return;let sx=0,sy=0,sw=record.width,sh=record.height,dx,dy,dw=sw,dh=sh;if(args.length===2)[dx,dy]=args;else if(args.length===4)[dx,dy,dw,dh]=args;else if(args.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=args;else throw new TypeError('LifeGPUCanvas drawImage requires 3, 5 or 9 arguments');enqueue(target,clipBox,record,matrix,alpha,sx,sy,sw,sh,dx,dy,dw,dh);},
        fillRect(x,y,w,h){
          if(!w||!h)return;
          let rows=paintCache.get(fillStyle);if(!rows){rows=new Map();paintCache.set(fillStyle,rows);}const key=[x,y,w,h,pixelRatio].join(',');let record=rows.get(key);
          if(!record){const canvas=doc.createElement('canvas'),pw=Math.max(1,Math.ceil(Math.abs(w)*pixelRatio)),ph=Math.max(1,Math.ceil(Math.abs(h)*pixelRatio));canvas.width=pw;canvas.height=ph;const c=canvas.getContext('2d');if(!c)return;c.setTransform(pixelRatio,0,0,pixelRatio,-Math.min(x,x+w)*pixelRatio,-Math.min(y,y+h)*pixelRatio);c.fillStyle=fillStyle;c.fillRect(x,y,w,h);record=upload(canvas);canvas.width=canvas.height=1;rows.set(key,record);}
          enqueue(target,clipBox,record,matrix,alpha,0,0,record.width,record.height,x,y,w,h);
        },
        clearRect(x,y,w,h){if(disposed||lost||!w||!h)return;flush();bind(target);const box=intersect(clipBox,bounds(matrix,x,y,w,h));scissor(box,target);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);},
        flush,
        _reset(){matrix=identity();alpha=1;fillStyle='#000';clipBox=pathBox=null;stack=[];}
      };
      Object.defineProperties(api,{globalAlpha:{get:()=>alpha,set:v=>{if(Number.isFinite(Number(v))&&v>=0&&v<=1)alpha=Number(v);}},fillStyle:{get:()=>fillStyle,set:v=>{if(v!=null)fillStyle=v;}},imageSmoothingEnabled:{get:()=>true,set:()=>{}},imageSmoothingQuality:{get:()=>'low',set:()=>{}}});return api;
    }
    const mainContext=context(targets.main),skyContext=context(targets.sky);
    function clearTextures(){for(const texture of textures)gl.deleteTexture(texture);textures.clear();sourceCache=new WeakMap();paintCache=new Map();}
    function resize(w,h,ratio=1){
      if(disposed||lost)return false;const nextRatio=Math.max(1,finite(ratio,1)),cw=Math.max(1,finite(w,1)),ch=Math.max(1,finite(h,1)),pw=Math.max(1,Math.floor(cw*nextRatio)),ph=Math.max(1,Math.floor(ch*nextRatio)),sh=Math.max(1,Math.ceil(ch*.5*nextRatio));if(pw>maxTexture||ph>maxTexture)throw new RangeError('LifeGPUCanvas viewport exceeds GPU texture limit');
      flush();clearUploadValidation();clearTextures();pixelRatio=nextRatio;element.width=pw;element.height=ph;targets.main.width=pw;targets.main.height=ph;targets.sky.width=pw;targets.sky.height=sh;skyToken.width=pw;skyToken.height=sh;
      gl.bindTexture(gl.TEXTURE_2D,skyTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,pw,sh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,skyTexture,0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('LifeGPUCanvas incomplete sky framebuffer');
      uploaded();
      mainContext._reset();skyContext._reset();activeTarget=null;batchTexture=null;batchClip=null;count=0;return true;
    }
    function onLost(event){event.preventDefault();lost=true;count=0;clearUploadValidation();options.onContextLost?.();}
    element.addEventListener?.('webglcontextlost',onLost);
    function destroy(){if(disposed)return;flush();disposed=true;element.removeEventListener?.('webglcontextlost',onLost);clearUploadValidation();clearTextures();gl.deleteTexture(skyTexture);gl.deleteFramebuffer(framebuffer);gl.deleteBuffer(buffer);gl.deleteProgram(program);count=0;activeTarget=null;}
    try{resize(options.width||1,options.height||1,options.pixelRatio||1);}catch(error){destroy();return null;}
    return{context:mainContext,sky:{canvas:skyToken,ctx:skyContext},resize,flush,upload,pollUploads,validateUploads,destroy,get ready(){return!disposed&&!lost;},get available(){return!disposed&&!lost;},inspect:()=>({...stats,pixelRatio,width:targets.main.width,height:targets.main.height,skyWidth:skyToken.width,skyHeight:skyToken.height,textures:textures.size,webgl:is2?2:1,deferValidation,uploadValidationPending:uploadsPending,pendingUploadFence:!!uploadFence,ready:!disposed&&!lost})};
  }
  window.LifeGPUCanvas={create};
})();
