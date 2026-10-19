/* Runtime compositor for the code-generated SVG lake. No external bitmap assets.
 * SVG remains the geometry source; its paths are baked only when size changes.
 * Playback rotates five cached layers and mirrors one sky frame into the lake.
 */
(function(){
  'use strict';
  if(window.LifeStarCompositor)return;
  const TAU=Math.PI*2,ORBIT_SCALE=1.2,ORBIT_BRIGHTNESS=1.5,ORBIT_STROKE_SCALE=1.3;
  const MAX_ORBIT_CACHE_PIXELS=4000000;
  // Include the sky and local atlases in this budget; never trade native DPR
  // for frame rate. Oversized viewports retain parsed paths for any layer that
  // cannot fit, while ordinary desktop sizes cache the expensive orbit arcs.
  const MAX_CACHE_PIXELS=112000000;
  const PALETTE=['#d9efff','#b6edee','#d3cbff','#f0d4ec','#f6e9c5','#ebf8ff'];
  const BOKEH_COLORS=[[172,223,255],[152,242,223],[193,180,255],[243,196,224],[250,231,175],[223,242,255]];
  const BOKEH_SIZE=128,RING_WIDTH=720,RING_HEIGHT=432,RING_RADIUS=280,RING_PHASES=3,RING_STYLES=3,RING_ROWS=5,RING_PERSPECTIVE=.5,RING_STAGGER=.6;
  const RING_CORE=[[5,.5],[5,.5],[1.6,.2]],RING_BLOOM=[7,20],RING_REACH=.6,RING_BEAT_INTERVAL=12;
  // Atlas cells are cropped to the measured non-transparent bbox of a ripple
  // (half-extent 318 x 176 CSS px including the baked bloom, measured at 1x and
  // 2x DPR). RING_WIDTH/RING_HEIGHT keep describing the logical footprint, so
  // placement maths and the perspective halo margins are untouched: the cheap
  // crop only drops fully transparent atlas margin from every stamp.
  const RING_CELL_W=648,RING_CELL_H=368;
  const FOLD_BAND=4,ALPHA_FLOOR=.004;
  const WATER_SIZE=48,WATER_COUNT=108,WATER_COLORS=[[67,158,255],[73,233,255]];
    const finite=(n,d)=>Number.isFinite(Number(n))?Number(n):d;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const random=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let n=Math.imul(seed^seed>>>15,1|seed);n^=n+Math.imul(n^n>>>7,61|n);return((n^n>>>14)>>>0)/4294967296;};
  // Unequal hand-sized breaks, not a periodic dash or sine-gated template.
  // Each seed includes tiny glints, medium pieces, long crests and varied gaps.
  const ARC_VARIANTS=[8191,68897,137261].map(seed=>{
    const next=random(seed),arcs=[];let at=next()*.12;
    for(let i=0;at<TAU;i++){
      const kind=i%5,span=kind===0||kind===3?.018+next()*.052:kind===2?.12+next()*.13:.35+next()*.43;
      const length=Math.min(span,TAU-at);if(length>.012)arcs.push([at,length]);
      at+=span+.07+next()*.33;
    }return{start:next()*TAU,arcs};
  });
  // Reference cubic-bezier(.12,.75,.3,1), inverted once outside playback.
  // It reaches a substantial radius before the quick 8% luminance peak.
  const EXPANSION=Float32Array.from({length:257},(_,index)=>{
    const x=index/256;if(!index||index===256)return x;
    let lo=0,hi=1;for(let i=0;i<20;i++){const t=(lo+hi)/2,u=1-t,bx=3*u*u*t*.12+3*u*t*t*.3+t*t*t;if(bx<x)lo=t;else hi=t;}
    const t=(lo+hi)/2,u=1-t;return 3*u*u*t*.75+3*u*t*t+t*t*t;
  });
  const expansion=life=>{const at=clamp(life,0,1)*256,index=Math.min(255,Math.floor(at)),mix=at-index;return EXPANSION[index]+(EXPANSION[index+1]-EXPANSION[index])*mix;};
  function create(doc,options={}){
    const source=options.source;
    if(!doc||!source?.element||typeof source.render!=='function')throw new TypeError('LifeStarCompositor requires an SVG source');
    const canvas=()=>{const c=doc.createElement('canvas');c.setAttribute('aria-hidden','true');c.setAttribute('data-life-star-compositor','svg-cache');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';return c;};
    let element=canvas(),gpu=null,context=null,paintContext=null;
    function useCPU(){
      gpu?.destroy();gpu=null;
      const next=canvas();if(element.parentNode)element.parentNode.replaceChild(next,element);element.width=element.height=1;element=next;
      try{context=element.getContext('2d',{alpha:false,desynchronized:true});}catch(e){context=null;}
      paintContext=context;element.dataset.renderer='canvas2d';
    }
    if(options.gpu!==false&&window.LifeGPUCanvas){
      gpu=LifeGPUCanvas.create(element,{deferValidation:true,onContextLost:()=>{if(disposed)return;cancelPreparation();useCPU();prepared=false;drawStamp='';}});
    }
    if(gpu){context=gpu.context;try{const p=doc.createElement('canvas');p.width=p.height=1;paintContext=p.getContext('2d');}catch(e){}if(!paintContext)useCPU();else element.dataset.renderer='webgl';}
    else{try{context=element.getContext('2d',{alpha:false,desynchronized:true});}catch(e){}if(!context)useCPU();else{paintContext=context;element.dataset.renderer='canvas2d';}}
    const originalVisibility=source.element.style.visibility;
    const Path=doc.defaultView?.Path2D||window.Path2D;
    let width=0,height=0,pixelScale=1,radius=0,skyHeight=0,visualTime=0,musicFrame=null,footsteps=[],disposed=false,drawStamp='';
    let prepared=false,preparation=null,layoutRevision=0;
    let cached=[],background=null,skyFrame=null,foreground=null,foregroundTexture=null,orbitLayers=[],dustLayers=[],glow=null,ring=null,waterGlow=null,waterPoints=[],frameRings=0,frameWater=0,orbitSeen=0,orbitKept=0;
    let waterPaint=null,waterVeilPaint=null,vignettePaint=null,bloomPaint=null;
    const waveLights=new Float32Array(16*4);let waveLightCount=0;
    const make=(w,h)=>{const canvas=doc.createElement('canvas');canvas.width=Math.max(1,Math.ceil(w));canvas.height=Math.max(1,Math.ceil(h));let ctx=null;try{ctx=canvas.getContext('2d');}catch(e){}cached.push(canvas);return{canvas,ctx};};
    function release(){for(const c of cached){c.width=1;c.height=1;}cached=[];background=skyFrame=foreground=foregroundTexture=glow=ring=waterGlow=null;orbitLayers=[];dustLayers=[];waterPoints=[];waterPaint=waterVeilPaint=vignettePaint=bloomPaint=null;frameRings=frameWater=0;}
    const number=(node,name,fallback=0)=>finite(node.getAttribute(name),fallback);
    const group=name=>source.element.querySelector('[data-lake-layer="'+name+'"]');
    function strokePath(ctx,node){
      const d=node.getAttribute('d');if(!d)return;
      ctx.globalAlpha=number(node,'opacity',1);ctx.strokeStyle=node.getAttribute('stroke')||'#c8e8ff';ctx.lineWidth=number(node,'stroke-width',.8);ctx.lineCap='round';
      ctx.stroke(new Path(d));
    }
    const pathRecord=(node,color,geometry)=>{const d=geometry===undefined?node.getAttribute('d')||'':geometry;return{path:new Path(d),geometry:d,opacity:number(node,'opacity',1),stroke:color||node.getAttribute('stroke')||'#c8e8ff',width:number(node,'stroke-width',.8),glow:color&&!node.hasAttribute('data-trail-glints')};};
    function orbitRecord(node,color){
      let geometry=node.getAttribute('d')||'';
      if(!node.hasAttribute('data-trail-glints'))geometry=geometry.replace(/M[^M]*/g,segment=>{
        // The stable SVG arc order discards every fifth trail once at layout.
        // Texture and native-path playback share the exact same 80% selection.
        const keep=orbitSeen++%5!==0;if(keep)orbitKept++;return keep?segment:'';
      });
      const record=pathRecord(node,color,geometry);record.opacity=clamp(record.opacity*ORBIT_BRIGHTNESS,0,1);record.width*=ORBIT_STROKE_SCALE;record.featherScale=ORBIT_STROKE_SCALE;return record;
    }
    function paths(ctx,rows,alpha=1){for(const p of rows){ctx.strokeStyle=p.stroke;ctx.lineCap='round';
      // Huge native-DPR orbits use pre-parsed paths and three feathered bands.
      // This keeps the slight halo without allocating giant blurred textures.
      if(p.glow){ctx.globalAlpha=p.opacity*alpha*.065;ctx.lineWidth=p.width+4.2*(p.featherScale||1);ctx.stroke(p.path);ctx.globalAlpha=p.opacity*alpha*.12;ctx.lineWidth=p.width+1.6*(p.featherScale||1);ctx.stroke(p.path);}
      ctx.globalAlpha=p.opacity*alpha;ctx.lineWidth=p.width;ctx.stroke(p.path);
    }}
    function radial(ctx,x,y,r,stops){const gradient=ctx.createRadialGradient(x,y,0,x,y,r);for(const [at,color]of stops)gradient.addColorStop(at,color);return gradient;}
    // Frame-invariant gradients are built once per layout. None of them read the
    // clock, so creating them again on every playback tick was pure garbage.
    function paints(){
      const c=paintContext;if(!c)return;
      waterPaint=c.createLinearGradient(0,skyHeight,0,height);waterPaint.addColorStop(0,'#182d44');waterPaint.addColorStop(.45,'#0b1930');waterPaint.addColorStop(1,'#050c1d');
      waterVeilPaint=c.createLinearGradient(0,skyHeight,0,height);waterVeilPaint.addColorStop(0,'rgba(5,12,29,.06)');waterVeilPaint.addColorStop(.68,'rgba(5,12,29,.4)');waterVeilPaint.addColorStop(1,'rgba(5,12,29,.88)');
      vignettePaint=c.createRadialGradient(width*.5,height*.45,height*.16,width*.5,height*.45,Math.max(width,height)*.7);vignettePaint.addColorStop(0,'rgba(2,5,18,0)');vignettePaint.addColorStop(.55,'rgba(2,5,18,0)');vignettePaint.addColorStop(1,'rgba(2,5,18,.55)');
      bloomPaint=radial(c,0,0,width*.15,[[0,'rgba(137,207,255,.06)'],[1,'rgba(105,168,233,0)']]);
    }
    function drawRingCell(g,row,phase){
      const style=row===0?0:row===RING_ROWS-1?2:1,life=phase/(RING_PHASES-1),seed=row*1.73,cx=phase*RING_CELL_W+RING_CELL_W/2,cy=row*RING_CELL_H+RING_CELL_H/2;
      let d='';const variant=ARC_VARIANTS[row-1],arcs=style===1?variant.arcs:[[0,TAU]];
      for(const [at,span]of arcs){const count=Math.max(2,Math.ceil(span*96));for(let j=0;j<=count;j++){
        // Phase motion happens before perspective, so the oval never tilts.
        const angle=at+span*j/count+(style===1?variant.start+life*.20:0),rr=RING_RADIUS*(1+.003*Math.sin(angle*5+seed+life*.45)+.0015*Math.sin(angle*13-seed));
        const x=cx+Math.cos(angle)*rr,y=cy+Math.sin(angle)*rr;d+=(j?'L':'M')+x.toFixed(3)+' '+y.toFixed(3);
      }}if(style!==1)d+='Z';
      const crest=new Path(d),[initial,final]=RING_CORE[style],rim=final+(initial-final)*Math.pow(1-life,1.2);
      // A clear narrow crest with two restrained bloom scales. All blur is
      // baked into this local atlas; no frame-sized filter runs in playback.
      g.save();g.translate(cx,cy);g.scale(1,RING_PERSPECTIVE);g.translate(-cx,-cy);
      g.lineCap='round';g.strokeStyle=style===0?'#f8fcff':style===1?'#cfe4ff':'#9cc7ff';g.lineWidth=rim;g.shadowColor=g.strokeStyle;
      g.globalAlpha=style===0?.23:.18;g.shadowBlur=RING_BLOOM[1]*pixelScale;g.stroke(crest);
      g.globalAlpha=style===0?.48:.38;g.shadowBlur=RING_BLOOM[0]*pixelScale;g.stroke(crest);
      g.globalAlpha=1;g.shadowBlur=0;g.stroke(crest);g.restore();
    }
    function* atlas(){
      glow=make(BOKEH_SIZE*PALETTE.length*pixelScale,BOKEH_SIZE*pixelScale);glow.canvas.dataset.lifeAtlas='bokeh';let g=glow.ctx;
      // The Court reference uses a bright, rounded light core with a restrained
      // halo. Bake that falloff once; no blurred frame-sized particle passes.
      if(g){g.setTransform(pixelScale,0,0,pixelScale,0,0);for(let i=0;i<PALETTE.length;i++){
        const rgb=BOKEH_COLORS[i],rgba=a=>'rgba('+rgb.join(',')+','+a+')',x=i*BOKEH_SIZE+64;
        // A translucent lens disk, a narrow luminous rim and restrained halo.
        // Large spots retain their round core instead of becoming fuzzy blobs.
        g.fillStyle=radial(g,x,64,64,[[0,rgba(.92)],[.31,rgba(.84)],[.46,rgba(.64)],[.51,rgba(.48)],[.60,rgba(.12)],[.77,rgba(.035)],[1,rgba(0)]]);g.fillRect(i*BOKEH_SIZE,0,BOKEH_SIZE,BOKEH_SIZE);
      }}
      if(gpu)yield 'bokeh-atlas';
      waterGlow=make(WATER_SIZE*WATER_COLORS.length*pixelScale,WATER_SIZE*pixelScale);waterGlow.canvas.dataset.lifeAtlas='water-glint';g=waterGlow.ctx;
      if(g){g.setTransform(pixelScale,0,0,pixelScale,0,0);for(let i=0;i<WATER_COLORS.length;i++){
        const rgb=WATER_COLORS[i],rgba=a=>'rgba('+rgb.join(',')+','+a+')',x=i*WATER_SIZE+WATER_SIZE/2;
        // A tiny pale nucleus sits inside a readable blue/cyan fluorescent
        // core. Broad coloured shoulders keep the lake lights from becoming
        // one-pixel white stars against the bright mirrored orbit trails.
        g.fillStyle=radial(g,x,WATER_SIZE/2,WATER_SIZE/2,[[0,'rgba(215,249,255,1)'],[.07,'rgba(147,237,255,.98)'],[.10,rgba(.98)],[.28,rgba(.92)],[.45,rgba(.50)],[.70,rgba(.12)],[1,rgba(0)]]);g.fillRect(i*WATER_SIZE,0,WATER_SIZE,WATER_SIZE);
      }}
      if(gpu)yield 'water-glint-atlas';
      const next=random(904173),clusters=Array.from({length:6},(_,index)=>({x:.08+next()*.84,y:index>=4?.68+next()*.22:.10+next()*.75,phase:next()*TAU,speed:.22+next()*.16}));
      waterPoints=Array.from({length:WATER_COUNT},(_,index)=>{
        const unit=next(),angle=next()*TAU,cluster=clusters[Math.floor(index/14)%6];
        return{x:index<84?clamp(cluster.x+Math.cos(angle)*unit*.045,0,1):next(),y:index<84?clamp(cluster.y+Math.sin(angle)*unit*.045,0,1):next(),unit:next(),phase:next()*TAU,speed:.32+next()*.56,groupPhase:cluster.phase,groupSpeed:cluster.speed,color:index%WATER_COLORS.length};
      });
      ring=make(RING_CELL_W*RING_PHASES*pixelScale,RING_CELL_H*RING_ROWS*pixelScale);ring.canvas.dataset.lifeAtlas='ripple';g=ring.ctx;
      if(g){g.setTransform(pixelScale,0,0,pixelScale,0,0);
        for(let row=0;row<RING_ROWS;row++)for(let phase=0;phase<RING_PHASES;phase++){
          if(!gpu){drawRingCell(g,row,phase);continue;}
          // Keep the full native atlas, but bake each bloom into a small CPU
          // surface. A 45-pass blur queue on the whole atlas stalls some GPUs.
          // Integer boundaries share the original global raster grid even at
          // fractional DPR; the final cell owns the atlas's ceil remainder.
          const x0=Math.floor(phase*RING_CELL_W*pixelScale),x1=phase===RING_PHASES-1?ring.canvas.width:Math.floor((phase+1)*RING_CELL_W*pixelScale);
          const y0=Math.floor(row*RING_CELL_H*pixelScale),y1=row===RING_ROWS-1?ring.canvas.height:Math.floor((row+1)*RING_CELL_H*pixelScale);
          let tile=null,t=null,copied=false;
          try{
            tile=doc.createElement('canvas');tile.width=x1-x0;tile.height=y1-y0;
            t=tile.getContext('2d',{willReadFrequently:true});
            if(t){
              t.setTransform(pixelScale,0,0,pixelScale,-x0,-y0);drawRingCell(t,row,phase);
              g.save();try{g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.shadowBlur=0;g.drawImage(tile,x0,y0);copied=true;}finally{g.restore();}
            }
          }catch(error){/* Unsupported scratch contexts retain the native bake. */}
          finally{if(tile){tile.width=1;tile.height=1;}}
          if(!copied)drawRingCell(g,row,phase);
          // No temporary surface survives this yield or prepare cancellation.
          yield 'ripple-cell-'+row+'-'+phase;
        }g.shadowBlur=0;g.globalAlpha=1;
      }
    }
    function bokeh(ctx,color,x,y,size,alpha){if(alpha<ALPHA_FLOOR)return;ctx.globalAlpha=alpha;ctx.drawImage(glow.canvas,color*BOKEH_SIZE*pixelScale,0,BOKEH_SIZE*pixelScale,BOKEH_SIZE*pixelScale,x-size,y-size,size*2,size*2);}
    function waterGlints(ctx){
      frameWater=0;const margin=9,waterHeight=height-skyHeight;
      if(width<margin*2||waterHeight<margin*2)return;
      for(const point of waterPoints){
        const x=margin+point.x*(width-margin*2)+Math.sin(visualTime*.14+point.phase)*2.2;
        const y=skyHeight+margin+point.y*(waterHeight-margin*2)+Math.cos(visualTime*.11+point.phase)*1.5;
        let excited=0;
        for(let i=0;i<waveLightCount;i++){
          const at=i*4,r=waveLights[at+2],distance=Math.hypot(x-waveLights[at],(y-waveLights[at+1])/RING_PERSPECTIVE);
          excited=Math.max(excited,Math.max(0,1-Math.abs(distance-r)/(7+r*.08))*waveLights[at+3]);
        }
        const individual=.5+.5*Math.sin(visualTime*point.speed+point.phase),group=.5+.5*Math.sin(visualTime*point.groupSpeed+point.groupPhase),shimmer=individual*.62+group*.38,size=(1.8+Math.pow(point.unit,2)*4.2)*(1+excited*.12);
        ctx.globalAlpha=Math.min(.95,.28+shimmer*.55+excited*.30);
        ctx.drawImage(waterGlow.canvas,point.color*WATER_SIZE*pixelScale,0,WATER_SIZE*pixelScale,WATER_SIZE*pixelScale,x-size,y-size*.72,size*2,size*1.44);frameWater++;
      }
    }
    // Geometry consists of circular M/A orbit segments and M/h.01 dust dots.
    // Measure the actual retained paths, not the outermost film-wide radius:
    // inner orbit bands occupy a much smaller square. A circular bound remains
    // safe through every authored rotation. Unknown commands keep the old box.
    function geometryExtent(rows,absolute,nativeFeather){
      let extent=0,padding=0;
      for(const row of rows){
        const d=row.geometry,known=!d.replace(/M\s*[-\d.e+]+[ ,]+[-\d.e+]+\s*A\s*[-\d.e+]+[ ,]+[-\d.e+]+\s+0\s+0\s+1\s+[-\d.e+]+[ ,]+[-\d.e+]+/gi,'').replace(/M\s*[-\d.e+]+[ ,]+[-\d.e+]+h\.01/gi,'').trim();
        if(!known)return radius;
        /* [feature:life-star-compat-move-matches] */
        const moveRegex=/M\s*([-\d.e+]+)[ ,]+([-\d.e+]+)/gi;let moveMatch;
        while((moveMatch=moveRegex.exec(d))){
          const x=Number(moveMatch[1])-(absolute?width/2:0),y=Number(moveMatch[2])-(absolute?skyHeight:0);
          extent=Math.max(extent,Math.hypot(x,y)+.011);
        }
        /* [/feature:life-star-compat-move-matches] */
        /* [feature:life-star-compat-arc-matches] */
        const arcRegex=/A\s*([-\d.e+]+)[ ,]+([-\d.e+]+)/gi;let arcMatch;
        while((arcMatch=arcRegex.exec(d)))extent=Math.max(extent,Math.abs(Number(arcMatch[1])),Math.abs(Number(arcMatch[2])));
        /* [/feature:life-star-compat-arc-matches] */
        const stroke=row.width+(nativeFeather&&row.glow?4.2*(row.featherScale||1):0);
        padding=Math.max(padding,stroke*ORBIT_SCALE/2+(!nativeFeather&&row.glow?2.1*3:0));
      }
      return Math.min(radius,extent*ORBIT_SCALE+padding+2/pixelScale);
    }
    function geometryTexture(rows,absolute,kind){
      const oldEdge=Math.ceil(radius*2*pixelScale),nativeFeather=oldEdge*oldEdge>MAX_ORBIT_CACHE_PIXELS;
      // Preserve the old low-resolution shadow raster grid; high-resolution
      // paths keep their three feathered strokes, baked at the exact native DPR.
      const rasterScale=nativeFeather?pixelScale:oldEdge/(radius*2),extent=geometryExtent(rows,absolute,nativeFeather);
      const left=Math.max(0,Math.floor(oldEdge/2-extent*rasterScale)),right=Math.min(oldEdge,Math.ceil(oldEdge/2+extent*rasterScale)),edge=Math.max(1,right-left);
      if(cached.reduce((n,c)=>n+c.width*c.height,0)+edge*edge>MAX_CACHE_PIXELS)return null;
      const texture=make(edge,edge),ctx=texture.ctx;if(!ctx)return null;
      texture.canvas.dataset.lifeGeometry=kind;
      texture.canvas.dataset.nativeInk=nativeFeather?'feather':'shadow';
      const origin=(oldEdge/2-left)/rasterScale;
      if(gpu&&nativeFeather)return{canvas:texture.canvas,origin,rasterScale,extent,_nativeBake:{ctx,rows,absolute}};
      ctx.setTransform(rasterScale,0,0,rasterScale,0,0);ctx.translate(origin,origin);ctx.scale(ORBIT_SCALE,ORBIT_SCALE);if(absolute)ctx.translate(-width/2,-skyHeight);
      if(nativeFeather)paths(ctx,rows);
      else for(const row of rows){ctx.globalAlpha=row.opacity;ctx.strokeStyle=row.stroke;ctx.lineWidth=row.width;ctx.lineCap='round';ctx.shadowColor=row.stroke;ctx.shadowBlur=row.glow?2.1*pixelScale:0;ctx.stroke(row.path);}
      ctx.shadowBlur=0;ctx.globalAlpha=1;
      return{canvas:texture.canvas,origin,rasterScale,extent};
    }
    function* bakeGeometryTiles(layer){
      const bake=layer?._nativeBake;if(!bake)return;
      const target=layer.canvas,g=bake.ctx,size=1024;
      const transform=(ctx,x=0,y=0)=>{ctx.setTransform(layer.rasterScale,0,0,layer.rasterScale,-x,-y);ctx.translate(layer.origin,layer.origin);ctx.scale(ORBIT_SCALE,ORBIT_SCALE);if(bake.absolute)ctx.translate(-width/2,-skyHeight);};
      try{
        for(let y=0;y<target.height;y+=size)for(let x=0;x<target.width;x+=size){
          let tile=null,copied=false;
          try{
            tile=doc.createElement('canvas');tile.width=Math.min(size,target.width-x);tile.height=Math.min(size,target.height-y);
            const ctx=tile.getContext('2d',{willReadFrequently:true});
            if(ctx){
              // Native feathering uses no shadow kernel. An integer tile offset
              // preserves every authored path and its antialiasing raster grid.
              transform(ctx,x,y);paths(ctx,bake.rows);
              g.save();try{g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.shadowBlur=0;g.drawImage(tile,x,y);copied=true;}finally{g.restore();}
            }
          }catch(error){/* A failed scratch bake uses the original whole layer. */}
          finally{if(tile){tile.width=1;tile.height=1;}}
          if(!copied){
            // Earlier tiles already contain alpha. Remove them before the full
            // native fallback, so an unsupported hint never doubles the ink.
            g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,target.width,target.height);transform(g);paths(g,bake.rows);g.shadowBlur=0;g.globalAlpha=1;return;
          }
          yield 'geometry-tile';
        }
      }finally{delete layer._nativeBake;}
    }
    function bakeOrbit(bands,start,end){
      let speed=0;const rows=[];
      for(let i=start;i<end;i++){speed+=number(bands[i],'data-band-speed');rows.push(...[...bands[i].querySelectorAll('path')].map((p,j)=>orbitRecord(p,PALETTE[(i+j*3)%PALETTE.length])));}
      const texture=geometryTexture(rows,true,'orbit');
      return{...(texture||{rows,absolute:true,scale:ORBIT_SCALE}),speed:speed/(end-start),phase:start*.47};
    }
    function bakeDust(groups,start,end,phase){
      const rows=[];for(let i=start;i<end;i++)rows.push(...[...groups[i].querySelectorAll('path')].map(p=>pathRecord(p)));
      return{...(geometryTexture(rows,false,'dust')||{rows,scale:ORBIT_SCALE}),phase};
    }
    function* layoutSteps(w,h,asyncValidation=false){
      release();drawStamp='';width=w;height=h;skyHeight=h*.5;orbitSeen=orbitKept=0;
      // Preserve the viewport's physical resolution, including Retina screens.
      // Optimization is geometric baking and a shared sky, never downsampling.
      pixelScale=Math.max(1,finite(doc.defaultView?.devicePixelRatio,1));
      element.width=Math.max(1,Math.floor(w*pixelScale));element.height=Math.max(1,Math.floor(h*pixelScale));
      if(gpu)try{gpu.resize(w,h,pixelScale);}catch(error){useCPU();element.width=Math.max(1,Math.floor(w*pixelScale));element.height=Math.max(1,Math.floor(h*pixelScale));}
      element.dataset.framePixels=String(element.width*element.height);
      element.dataset.pixelRatio=String(pixelScale);
      // This is the sole SVG render during a playback size. No frame clocks
      // mutate the source DOM, its SVG filters or its thousands of points.
      source.render({width:w,height:h,time:0,music:null,reduced:true});
      radius=finite(source.element.getAttribute('data-orbit-radius'),Math.min(w*.98,h*.92))*ORBIT_SCALE;
      if(!context||!Path){element.hidden=true;source.element.style.visibility=originalVisibility;prepared=true;return;}
      yield 'source';
      yield* atlas();paints();
      yield 'atlas';
      background=make(element.width,Math.ceil(skyHeight*pixelScale));skyFrame=gpu?gpu.sky:make(element.width,Math.ceil(skyHeight*pixelScale));
      const b=background.ctx;
      if(!b||!skyFrame.ctx){element.hidden=true;source.element.style.visibility=originalVisibility;prepared=true;return;}
      b.setTransform(pixelScale,0,0,pixelScale,0,0);
      let paint=b.createLinearGradient(0,0,0,skyHeight);paint.addColorStop(0,'#040719');paint.addColorStop(.58,'#091632');paint.addColorStop(1,'#183754');b.fillStyle=paint;b.fillRect(0,0,w,skyHeight);
      b.fillStyle=radial(b,w/2,skyHeight,radius*.82,[[0,'rgba(96,139,181,.11)'],[.26,'rgba(46,73,125,.10)'],[.7,'rgba(23,47,85,.035)'],[1,'rgba(5,9,26,0)']]);b.fillRect(0,0,w,skyHeight);
      for(let i=0;i<3;i++){b.save();b.translate(w*(.25+i*.25),skyHeight*(.38+i*.2));b.scale(1,.34);b.fillStyle=radial(b,0,0,w*(.26-i*.025),[[0,'rgba(105,114,214,.13)'],[.42,'rgba(87,123,187,.06)'],[1,'rgba(55,100,136,0)']]);b.fillRect(-w*.4,-w*.4,w*.8,w*.8);b.restore();}
      for(const path of group('distant')?.querySelectorAll('path')||[])strokePath(b,path);
      for(const star of group('stars')?.querySelectorAll('circle')||[]){const r=number(star,'r');bokeh(b,0,number(star,'cx'),number(star,'cy'),r,.76);}
      yield 'background';
      const bands=[...group('trails').querySelectorAll('[data-trail-band]')];
      for(let i=0;i<3;i++){const layer=bakeOrbit(bands,i*4,(i+1)*4);if(layer)orbitLayers.push(layer);yield* bakeGeometryTiles(layer);yield 'orbit-'+i;}
      const dust=[...group('inward-dust').querySelectorAll('[data-inward-dust]')];
      const firstDust=bakeDust(dust,0,3,0);dustLayers.push(firstDust);yield* bakeGeometryTiles(firstDust);yield 'dust-0';
      const lastDust=bakeDust(dust,3,5,.5);dustLayers.push(lastDust);yield* bakeGeometryTiles(lastDust);yield 'dust-1';
      foreground=[...group('floating-dust')?.querySelectorAll('path')||[]].map(p=>pathRecord(p));
      if(gpu){
        // Native DPR ink is baked once, including a margin for the moving dust.
        // WebGL then reuses these exact pixels rather than repainting paths.
        const pad=24;foregroundTexture=make((width+pad*2)*pixelScale,(height+pad*2)*pixelScale);
        foregroundTexture.ctx.setTransform(pixelScale,0,0,pixelScale,pad*pixelScale,pad*pixelScale);paths(foregroundTexture.ctx,foreground);
        try{
          if([...orbitLayers,...dustLayers].some(l=>l.rows))throw new Error('Native geometry exceeds cache budget');
          // Upload one native bake per preparation task. A fast reader must not
          // pay for all texture transfers in the curtain's covered switch.
          for(const c of cached){gpu.upload(c);yield 'upload';}
          const c=context;c.setTransform(pixelScale,0,0,pixelScale,0,0);c.globalAlpha=1;
          c.fillStyle=waterPaint;c.fillRect(0,skyHeight,width,height-skyHeight);gpu.flush();yield 'water-paint';
          c.fillStyle=waterVeilPaint;c.fillRect(0,skyHeight,width,height-skyHeight);gpu.flush();yield 'water-veil';
          c.fillStyle=bloomPaint;c.fillRect(-width*.15,-width*.15,width*.3,width*.3);gpu.flush();yield 'bloom-paint';
          c.fillStyle=vignettePaint;c.fillRect(0,0,width,height);gpu.flush();yield 'vignette-paint';
          // A WebGL error query is a synchronous GPU fence. During background
          // preparation, poll a zero-time fence in separate idle tasks first;
          // direct seeks retain synchronous validation and never spin on it.
          if(asyncValidation&&gpu.pollUploads){while(!gpu.pollUploads())yield 'upload-validation';}
          else gpu.validateUploads?.();
        }
        catch(error){useCPU();yield* layoutSteps(w,h,asyncValidation);return;}
      }
      source.element.style.visibility='hidden';element.hidden=false;
      element.dataset.orbitCaches=String(orbitLayers.length);element.dataset.dustCaches=String(dustLayers.length);
      element.dataset.cachePixels=String(cached.reduce((n,c)=>n+c.width*c.height,0));
      element.dataset.geometryMode=[...orbitLayers,...dustLayers].some(l=>l.rows)?'native-path-cache':'native-textures';
      element.dataset.geometryCacheLimit=String(MAX_CACHE_PIXELS);
      element.dataset.geometryTextures=String([...orbitLayers,...dustLayers].filter(l=>l.canvas).length);
      element.dataset.geometryLimited=String([...orbitLayers,...dustLayers].some(l=>l.rows));
      element.dataset.orbitRadius=String(radius);element.dataset.orbitScale=String(ORBIT_SCALE);
      element.dataset.lightColors=String(PALETTE.length);
      element.dataset.orbitOriginalCount=String(orbitSeen);element.dataset.orbitArcCount=String(orbitKept);element.dataset.orbitBrightness=String(ORBIT_BRIGHTNESS);element.dataset.orbitStrokeScale=String(ORBIT_STROKE_SCALE);
      element.dataset.ripplePerspective=String(RING_PERSPECTIVE);element.dataset.rippleStagger=String(RING_STAGGER);element.dataset.rippleStyles='solid,arcs,echo';element.dataset.rippleBloom=RING_BLOOM.join(',');
      element.dataset.rippleCell=RING_CELL_W+','+RING_CELL_H;element.dataset.rippleFootprint=RING_WIDTH+','+RING_HEIGHT;element.dataset.rippleRadius=String(RING_RADIUS);
      prepared=true;
    }
    function cancelPreparation(){
      if(!preparation)return;
      const task=preparation;preparation=null;layoutRevision++;
      task.cancel?.();task.iterator.return();task.resolve(false);
    }
    function layout(w,h){
      cancelPreparation();layoutRevision++;prepared=false;
      const iterator=layoutSteps(w,h);while(!iterator.next().done){}
    }
    // Only preparation owns scheduled work. Playback still has no local clock.
    // A caller may provide a callback scheduler (returning an optional cancel
    // function); otherwise each bake runs in a separate browser idle task.
    function prepare(input={},scheduler=options.schedule){
      if(disposed)return Promise.resolve(false);
      const w=Math.max(1,Math.min(32768,finite(input.width,width||1280))),h=Math.max(1,Math.min(32768,finite(input.height,height||720))),ratio=Math.max(1,finite(doc.defaultView?.devicePixelRatio,1));
      if(prepared&&w===width&&h===height&&ratio===pixelScale)return Promise.resolve(true);
      if(preparation&&preparation.width===w&&preparation.height===h&&preparation.pixelRatio===ratio)return preparation.promise;
      cancelPreparation();prepared=false;
      const task={width:w,height:h,pixelRatio:ratio,revision:++layoutRevision,iterator:layoutSteps(w,h,true),cancel:null};
      task.promise=new Promise((resolve,reject)=>{task.resolve=resolve;task.reject=reject;});preparation=task;
      const view=doc.defaultView||window,schedule=input.schedule||scheduler;
      const enqueue=()=>{
        if(typeof schedule==='function'){const cancel=schedule(step);task.cancel=typeof cancel==='function'?cancel:null;}
        else if(typeof view.requestIdleCallback==='function'){const id=view.requestIdleCallback(step,{timeout:250});task.cancel=()=>view.cancelIdleCallback?.(id);}
        else{const id=view.setTimeout(step,0);task.cancel=()=>view.clearTimeout(id);}
      };
      const step=()=>{
        task.cancel=null;
        if(disposed||preparation!==task||task.revision!==layoutRevision)return;
        if(task.pixelRatio!==Math.max(1,finite(doc.defaultView?.devicePixelRatio,1))){cancelPreparation();return;}
        try{
          const result=task.iterator.next();
          if(result.done){preparation=null;task.resolve(prepared);}
          else enqueue();
        }catch(error){if(preparation===task){preparation=null;prepared=false;release();element.hidden=true;source.element.style.visibility=originalVisibility;}task.reject(error);}
      };
      try{enqueue();}catch(error){preparation=null;task.iterator.return();task.reject(error);}
      return task.promise;
    }
    function cachedLayer(ctx,layer,degrees,scale,alpha){
      if(alpha<=.001)return;
      ctx.save();ctx.translate(width/2,skyHeight);ctx.rotate(degrees*Math.PI/180);ctx.scale(scale,scale);ctx.globalAlpha=alpha;
      if(layer.rows){ctx.scale(layer.scale||1,layer.scale||1);if(layer.absolute)ctx.translate(-width/2,-skyHeight);paths(ctx,layer.rows,alpha);}
      else{
        // Canvas clips output, but submitting the whole enormous transparent
        // source still costs blending bandwidth. The inverse viewport bounds
        // select only native source pixels that can reach this sky frame.
        const angle=degrees*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),corners=[[-width/2,-skyHeight],[width/2,-skyHeight],[-width/2,0],[width/2,0]];
        let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
        for(const [x,y]of corners){const rx=(x*cos+y*sin)/scale,ry=(-x*sin+y*cos)/scale;x0=Math.min(x0,rx);x1=Math.max(x1,rx);y0=Math.min(y0,ry);y1=Math.max(y1,ry);}
        const rs=layer.rasterScale,o=layer.origin,c=layer.canvas;
        const sx=Math.max(0,Math.floor((x0+o)*rs)-2),sy=Math.max(0,Math.floor((y0+o)*rs)-2),ex=Math.min(c.width,Math.ceil((x1+o)*rs)+2),ey=Math.min(c.height,Math.ceil((y1+o)*rs)+2);
        if(ex>sx&&ey>sy)ctx.drawImage(c,sx,sy,ex-sx,ey-sy,sx/rs-o,sy/rs-o,(ex-sx)/rs,(ey-sy)/rs);
      }ctx.restore();
    }
    function music(ctx){
      frameRings=0;waveLightCount=0;
      const mt=finite(musicFrame?.time,-1),actual=musicFrame&&Number.isFinite(musicFrame.energy)&&window.LifeMusicPulse;
      // The measured sample has a short public window. Recover a longer wave
      // history from the same track, so an 8-14s ripple survives pause and seek.
      const history=new Map();
      if(actual)for(const offset of [12.6,8.4,4.2])for(const beat of window.LifeMusicPulse.sample({src:window.LifeMusicPulse.track.src,time:Math.max(0,mt-offset)})?.beats||[])history.set(beat.index??beat.at,beat);
      for(const beat of musicFrame?.beats||[])history.set(beat.index??beat.at,beat);
      const ordered=[...history.values()].filter(b=>mt>=b.at).sort((a,b)=>a.at-b.at);
      const waves=ordered.filter(b=>mt-b.at<15.2&&(!actual||b.index%RING_BEAT_INTERVAL===0)).slice(-4);
      const steps=footsteps.filter(step=>visualTime>=step.at&&visualTime-step.at<3.4).slice(-12);
      for(const step of steps){const foot={...step,foot:true};waves.push(foot);}
      const waterHeight=height-skyHeight,margin=4,halfHeight=RING_HEIGHT/(RING_RADIUS*2),halfWidth=RING_WIDTH/(RING_RADIUS*2);
      // A ripple's own placement: foot contacts stay where the step landed,
      // music beats spread over the remaining water instead of one horizon line.
      const waveCenter=(beat,index)=>{
        if(beat.foot){const x=width*beat.x,y=height*beat.y;
          // Keep the footprint in place; shrink its whole halo near the edge.
          return{x,y,depth:.7,reach:Math.max(0,Math.min(width*.06,72,(Math.min(y-skyHeight,height-y)-margin)/halfHeight,(Math.min(x,width-x)-margin)/halfWidth))};
        }
        const depth=.12+((Math.abs(index)*37)%79)/100*.76;
        const reach=Math.max(0,Math.min((260+300*depth)*(width/1440)*(.55+.45*depth)*RING_REACH,width*.14,(waterHeight*.44-margin)/halfHeight));
        // Place inside the remaining water, rather than clamping all distant
        // sources onto one shared horizon line. Preserve a spread in depth.
        const haloY=reach*halfHeight+margin,haloX=reach*halfWidth+margin;
        return{x:haloX+(width-haloX*2)*(.08+(((Math.abs(index)*137.508)%360)/360)*.84),
          y:skyHeight+haloY+(waterHeight-haloY*2)*(.08+depth*.84),depth,reach};
      };
      // The wavefront is clipped to the water, so no halo crosses the horizon.
      ctx.save();ctx.beginPath();ctx.rect(0,skyHeight,width,height-skyHeight);ctx.clip();
      for(let i=0;i<waves.length;i++){
        const beat=waves[i],age=(beat.foot?visualTime:mt)-beat.at,strength=clamp(finite(beat.strength,.6),0,1),index=finite(beat.index,i);
        const {x,y,reach}=waveCenter(beat,index);
        if(reach<.5)continue;
        const duration=beat.foot?2.4:8+(Math.abs(index)%7),stagger=beat.foot?.16:RING_STAGGER,variant=Math.abs(Math.floor(index/RING_BEAT_INTERVAL))%ARC_VARIANTS.length;
        for(let style=0;style<RING_STYLES;style++){
          const localAge=age-style*stagger;if(localAge<=0||localAge>=duration)continue;
          const life=localAge/duration,start=Math.min(6,reach),r=start+(reach-start)*expansion(life),alpha=Math.min(1,life/.08)*Math.pow(1-life,1.25)*(.65+strength*.35)*(style===0?1:style===1?.62:.24),frame=life*(RING_PHASES-1),first=Math.floor(frame),mix=frame-first;
          // The phase morph occurs in the circular domain during bake. The
          // ellipse never rotates on screen; neighbours blend without popping.
          const scale=r/RING_RADIUS,dw=RING_CELL_W*scale,dh=RING_CELL_H*scale,row=style===2?RING_ROWS-1:style===0&&(beat.foot||variant===0)?0:1+(variant+style)%ARC_VARIANTS.length;
          const stamp=(phase,weight)=>{if(weight<.001)return;ctx.globalAlpha=alpha*weight;ctx.drawImage(ring.canvas,phase*RING_CELL_W*pixelScale,row*RING_CELL_H*pixelScale,RING_CELL_W*pixelScale,RING_CELL_H*pixelScale,x-dw/2,y-dh/2,dw,dh);};
          stamp(first,1-mix);stamp(Math.min(RING_PHASES-1,first+1),mix);frameRings++;
          if(style===0&&waveLightCount<waveLights.length/4){const at=waveLightCount++*4;waveLights[at]=x;waveLights[at+1]=y;waveLights[at+2]=r;waveLights[at+3]=alpha;}
        }
      }
      waterGlints(ctx);
      ctx.restore();
      // Owner decision (2026-10-09): the rising light spots are removed. The
      // long-lived concentric waves and the lake fluorescence stay as they are.
      ctx.globalAlpha=1;
    }
    function draw(){
      if(element.hidden||!context||!skyFrame)return;
      if(!waterPaint)paints();
      const t=visualTime,s=skyFrame.ctx;
      // drawImage below covers the whole sky frame, so a clear pass is redundant.
      s.setTransform(1,0,0,1,0,0);s.globalAlpha=1;s.drawImage(background.canvas,0,0);
      s.setTransform(pixelScale,0,0,pixelScale,0,0);
      for(const layer of orbitLayers)cachedLayer(s,layer,t*(layer.speed+.018),1,.72+.22*Math.sin(t*.9+layer.phase));
      for(const layer of dustLayers){const phase=(t/56+layer.phase)%1,scale=1-phase*.91,alpha=Math.min(1,phase*7,(1-phase)*8)*.43;cachedLayer(s,layer,t*.48+layer.phase*36,scale,alpha);}
      const c=context;c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.clearRect(0,0,element.width,element.height);c.setTransform(pixelScale,0,0,pixelScale,0,0);
      c.drawImage(skyFrame.canvas,0,0,width,skyHeight);
      c.fillStyle=waterPaint;c.fillRect(0,skyHeight,width,height-skyHeight);
      // Native-resolution scan bands bend the mirrored star trails very gently.
      // No SVG turbulence filter and no full-frame blur work runs during play.
      // One setTransform per band replaces save/translate/scale/restore, and the
      // band is measured in CSS px so high-DPR screens no longer double the pass.
      c.save();c.globalAlpha=.76;
      const sky=skyFrame.canvas;
      for(let y=0;y<skyHeight;y+=FOLD_BAND){const bh=Math.min(FOLD_BAND,skyHeight-y),depth=y/skyHeight,shift=Math.sin(y*.036-t*.7)*(1+depth*1.4)+Math.sin(y*.081+t*.42)*.5;
        c.setTransform(pixelScale,0,0,-pixelScale,pixelScale*shift,pixelScale*(height-y));
        c.drawImage(sky,0,y*pixelScale,sky.width,bh*pixelScale,0,0,width,bh+.25/pixelScale);}
      c.restore();
      c.fillStyle=waterVeilPaint;c.fillRect(0,skyHeight,width,height-skyHeight);
      // Water blooms remain smooth gradients, never arbitrary line marks.
      for(let i=0;i<3;i++){c.save();c.translate(width*(.2+i*.3),skyHeight+height*(.07+i*.035));c.scale(1,.05);c.fillStyle=bloomPaint;c.fillRect(-width*.15,-width*.15,width*.3,width*.3);c.restore();}
      music(c);c.save();c.translate(Math.sin(t*.08)*8,-Math.sin(t*.045)*12);
      if(gpu){c.globalAlpha=.16+.08*Math.sin(t*.19);c.drawImage(foregroundTexture.canvas,-24,-24,width+48,height+48);}else paths(c,foreground,.16+.08*Math.sin(t*.19));
      c.restore();c.globalAlpha=1;
      c.fillStyle=vignettePaint;c.fillRect(0,0,width,height);
      gpu?.flush();
    }
    function render(input={}){
      if(disposed)return;
      const w=Math.max(1,Math.min(32768,finite(input.width,width||1280))),h=Math.max(1,Math.min(32768,finite(input.height,height||720)));
      const resized=!prepared||w!==width||h!==height||pixelScale!==Math.max(1,finite(doc.defaultView?.devicePixelRatio,1));if(resized)layout(w,h);
      if(input.reduced){visualTime=0;musicFrame=null;footsteps=[];}else if(!input.paused||input.seek){visualTime=Math.max(0,finite(input.time,visualTime));musicFrame=input.music||null;footsteps=input.footsteps||[];}
      const stamp=w+','+h+','+visualTime+','+finite(musicFrame?.time,-1)+','+Boolean(input.reduced);
      if((!input.paused||input.seek||input.reduced||resized)&&(stamp!==drawStamp||input.seek)){
        try{draw();}catch(error){if(!gpu)throw error;useCPU();layout(w,h);draw();}
        drawStamp=stamp;
      }
    }
    function destroy(){if(disposed)return;disposed=true;cancelPreparation();prepared=false;gpu?.destroy();gpu=null;release();element.width=1;element.height=1;element.remove();source.element.style.visibility=originalVisibility;context=paintContext=null;}
    const inspect=()=>({ready:prepared,preparing:!!preparation,limited:[...orbitLayers,...dustLayers].some(l=>l.rows),cacheLimit:MAX_CACHE_PIXELS,radius,pixelRatio:pixelScale,framePixels:element.width*element.height,cachePixels:cached.reduce((n,c)=>n+c.width*c.height,0),rings:frameRings,waterParticles:frameWater,colors:PALETTE.length,orbitOriginal:orbitSeen,orbitArcs:orbitKept,orbitBrightness:ORBIT_BRIGHTNESS,orbitStrokeScale:ORBIT_STROKE_SCALE,ripplePerspective:RING_PERSPECTIVE,rippleStagger:RING_STAGGER,rippleCore:RING_CORE,rippleBloom:RING_BLOOM,rippleCell:[RING_CELL_W,RING_CELL_H],rippleFootprint:[RING_WIDTH,RING_HEIGHT],rippleRadius:RING_RADIUS,rippleArcVariants:ARC_VARIANTS.length,rippleReachScale:RING_REACH,rippleBeatInterval:RING_BEAT_INTERVAL});
    return{get element(){return element;},render,prepare,destroy,inspect};
  }
  window.LifeStarCompositor={create};
})();
