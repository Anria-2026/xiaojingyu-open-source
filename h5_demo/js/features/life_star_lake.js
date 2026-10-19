/* Pure SVG star trails, a calm mirror lake and music-born ripples. No dynamic raster filters. */
(function () {
  'use strict';
  if(window.LifeStarLake)return;
  const NS='http://www.w3.org/2000/svg',TAU=Math.PI*2,COLORS=['#ffffff','#bdeaff','#cfe0ff','#9db4ff'];
  const finite=(v,d)=>Number.isFinite(Number(v))?Number(v):d,fmt=v=>String(Math.round(v*1000)/1000);
  let serial=0;
  function create(doc){
    if(!doc||typeof doc.createElementNS!=='function')throw new TypeError('LifeStarLake requires a document');
    const prefix='life-star-lake-'+(++serial)+'-',id=n=>prefix+n,url=n=>'url(#'+id(n)+')';
    const node=(tag,attrs,parent)=>{const e=doc.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs||{}))e.setAttribute(k,String(v));if(parent)parent.appendChild(e);return e;};
    const set=(e,k,v)=>{v=String(v);if(e.getAttribute(k)!==v)e.setAttribute(k,v);};
    const element=node('svg',{xmlns:NS,'aria-hidden':'true',focusable:'false',role:'presentation',width:'100%',height:'100%',preserveAspectRatio:'none','data-life-star-lake':'','style':'display:block;width:100%;height:100%;overflow:hidden;pointer-events:none'});
    const defs=node('defs',{},element);
    function gradient(name,type,attrs,stops){const g=node(type,{id:id(name),...attrs},defs);for(const [offset,color,opacity]of stops)node('stop',{offset,'stop-color':color,'stop-opacity':opacity??1},g);return g;}
    gradient('sky-paint','linearGradient',{x1:0,y1:0,x2:0,y2:1},[['0%','#040719'],['58%','#091632'],['100%','#183754']]);
    const auraPaint=gradient('aura','radialGradient',{gradientUnits:'userSpaceOnUse'},[['0%','#608bb5',.11],['26%','#2e497d',.10],['70%','#172f55',.035],['100%','#05091a',0]]);
    gradient('lake','linearGradient',{x1:0,y1:0,x2:0,y2:1},[['0%','#182d44'],['45%','#0b1930'],['100%','#050c1d']]);
    gradient('nebula','radialGradient',{cx:'.5',cy:'.5',r:'.5'},[['0%','#6972d6',.13],['42%','#577bbb',.06],['100%','#376488',0]]);
    gradient('starlight','radialGradient',{cx:'.5',cy:'.5',r:'.5'},[['0%','#ffffff',.96],['8%','#d5f4ff',.78],['23%','#90d7ff',.3],['54%','#84bfff',.09],['100%','#6d9fea',0]]);
    gradient('water-bloom','radialGradient',{cx:'.5',cy:'.5',r:'.5'},[['0%','#a4d9fa',.16],['32%','#74baff',.085],['100%','#69a8e9',0]]);
    gradient('horizon','linearGradient',{x1:0,y1:0,x2:1,y2:0},[['0%','#7c9fbf',0],['25%','#96b4d4',.22],['68%','#cde6f5',.45],['100%','#648fb4',0]]);
    gradient('mist','radialGradient',{cx:'.5',cy:'.5',r:'.5'},[['0%','#aacfe8',.12],['100%','#4c719a',0]]);
    gradient('vignette','radialGradient',{cx:'.5',cy:'.45',r:'.74'},[['0%','#020512',0],['55%','#020512',0],['100%','#020512',.6]]);
    const fade=gradient('reflection-fade','linearGradient',{gradientUnits:'userSpaceOnUse',x1:0,x2:0,y1:0,y2:1},[['0%','#fff',.88],['24%','#fff',.76],['68%','#fff',.5],['100%','#fff',.12]]);
    // A tiny fixed blur softens reflected light. No full-water turbulence,
    // displacement or animated filter primitives are ever rasterized.
    const refraction=node('filter',{id:id('water-refraction'),filterUnits:'userSpaceOnUse',primitiveUnits:'userSpaceOnUse','color-interpolation-filters':'sRGB'},defs);
    node('feGaussianBlur',{in:'SourceGraphic',stdDeviation:'.4 .8'},refraction);
    const rippleGlow=node('filter',{id:id('ripple-glow'),x:'-12%',y:'-40%',width:'124%',height:'180%','color-interpolation-filters':'sRGB'},defs);
    node('feGaussianBlur',{stdDeviation:'1.35'},rippleGlow);
    const skyClip=node('clipPath',{id:id('sky-clip'),clipPathUnits:'userSpaceOnUse'},defs),skyRect=node('rect',{},skyClip);
    const lakeClip=node('clipPath',{id:id('lake-clip'),clipPathUnits:'userSpaceOnUse'},defs),lakeRect=node('rect',{},lakeClip);
    const mask=node('mask',{id:id('reflection-mask'),maskUnits:'userSpaceOnUse','mask-type':'alpha'},defs),maskRect=node('rect',{fill:url('reflection-fade')},mask);
    const sky=node('g',{id:id('sky')},defs),base=node('rect',{fill:url('sky-paint')},sky),aura=node('rect',{fill:url('aura')},sky);
    const nebula=node('g',{'data-lake-layer':'nebula'},sky);
    const distant=node('g',{'data-lake-layer':'distant','data-star-count':1440,'stroke-linecap':'round',fill:'none'},sky);
    const trails=node('g',{'data-lake-layer':'trails','data-arc-count':468,'stroke-linecap':'round',fill:'none'},sky);
    const dust=node('g',{'data-lake-layer':'inward-dust','data-particle-count':5200,fill:'none','stroke-linecap':'round'},sky);
    const stars=node('g',{'data-lake-layer':'stars',fill:'none',stroke:'#ecf6ff','stroke-linecap':'round'},sky);
    const direct=node('g',{'clip-path':url('sky-clip')},element);node('use',{href:'#'+id('sky')},direct);
    const lake=node('g',{'clip-path':url('lake-clip')},element),water=node('rect',{fill:url('lake')},lake);
    const reflected=node('g',{'mask':url('reflection-mask'),opacity:'.94'},lake),refracted=node('g',{filter:url('water-refraction'),'data-lake-layer':'refraction'},reflected),mirror=node('use',{href:'#'+id('sky'),'data-lake-reflection':''},refracted);
    const mist=node('ellipse',{fill:url('mist')},lake);
    const rippleBack=node('g',{'data-lake-layer':'ripples-back'},lake);
    const rippleFront=node('g',{'data-lake-layer':'ripples-front'},lake);
    // Music pulses keep their concentric wave rings below the horizon.
    const pulses=node('g',{'data-lake-layer':'music-ripples',fill:'none','pointer-events':'none'},element);
    const floating=node('g',{'data-lake-layer':'floating-dust','data-particle-count':352,fill:'none','stroke-linecap':'round'},element);
    const horizon=node('path',{fill:'none',stroke:url('horizon'),'stroke-width':'.7','data-lake-horizon':''},element),vignette=node('rect',{fill:url('vignette')},element);
    let width=0,height=0,skyHeight=0,px=0,py=0,visualTime=0,disposed=false,bands=[],dustGroups=[],starGroups=[],floatGroups=[],glintGroups=[],pulsePool=[],musicFrame=null;
    function layout(w,h){
      width=w;height=h;skyHeight=h*.5;const portrait=w<h;
      px=w*.5;py=skyHeight;
      const radius=2*(portrait?Math.max(w*.65,h*.42):Math.min(w*.49,h*.46)),unit=Math.max(.7,Math.min(1.3,radius/480));
      set(element,'data-orbit-center',fmt(px)+' '+fmt(py));
      set(element,'data-orbit-radius',fmt(radius));
      set(element,'viewBox','0 0 '+fmt(w)+' '+fmt(h));
      for(const e of [base,aura,skyRect]){set(e,'x',0);set(e,'y',0);set(e,'width',fmt(w));set(e,'height',fmt(skyHeight));}
      for(const e of [water,lakeRect,maskRect,mask]){set(e,'x',0);set(e,'y',fmt(skyHeight));set(e,'width',fmt(w));set(e,'height',fmt(h-skyHeight));}
      set(auraPaint,'cx',fmt(px));set(auraPaint,'cy',fmt(py));set(auraPaint,'r',fmt(radius*.82));
      set(refraction,'x',-24);set(refraction,'y',fmt(skyHeight-24));set(refraction,'width',fmt(w+48));set(refraction,'height',fmt(h-skyHeight+48));
      set(vignette,'width',fmt(w));set(vignette,'height',fmt(h));set(fade,'y1',fmt(skyHeight));set(fade,'y2',fmt(h));
      set(mirror,'transform','translate(0 '+fmt(h)+') scale(1 -1)');
      set(mist,'cx',fmt(px));set(mist,'cy',fmt(skyHeight+h*.006));set(mist,'rx',fmt(w*.53));set(mist,'ry',fmt(h*.022));
      set(horizon,'d','M0 '+fmt(skyHeight)+'H'+fmt(w));
      for(const group of [nebula,distant,trails,dust,stars,rippleBack,rippleFront,floating,pulses])group.replaceChildren();
      let seed=1729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},range=(a,b)=>a+(b-a)*random();
      const point=(x,y)=>'M'+fmt(x)+' '+fmt(y)+'h.01';
      for(let i=0;i<3;i++)node('ellipse',{cx:fmt(w*(.25+i*.25)),cy:fmt(skyHeight*(.38+i*.2)),rx:fmt(w*(.26-i*.025)),ry:fmt(skyHeight*.24),fill:url('nebula'),transform:'rotate('+(-22+i*18)+' '+fmt(w*(.25+i*.25))+' '+fmt(skyHeight*(.38+i*.2))+')'},nebula);
      starGroups=Array.from({length:8},(_,i)=>{
        let d='';for(let j=0;j<180;j++)d+=point(random()*w,random()*skyHeight);
        return node('path',{d,stroke:COLORS[i%4],'stroke-width':fmt(.45+i*.12),opacity:'.4'},distant);
      });
      const centers=Array.from({length:16},()=>random()*TAU);
      bands=Array.from({length:12},(_,i)=>{
        const layer=node('g',{'data-trail-band':i,'data-band-speed':fmt((.02+.05*(1-(i+.5)/12))*180/Math.PI)},trails);
        return {layer,speed:(.02+.05*(1-(i+.5)/12))*180/Math.PI,paths:['','','',''],glints:['',''],glintNodes:[],count:0};
      });
      for(let i=0;i<468;i++){
        const u=Math.pow(random(),1.5),r=radius*(.065+.935*u),b=bands[Math.min(11,Math.floor(u*12))],color=i%4;
        const a=centers[Math.floor(random()*16)]+range(-.6,.6),seg=Math.PI/3+random()*Math.PI/3;
        b.paths[color]+='M'+fmt(px+Math.cos(a)*r)+' '+fmt(py+Math.sin(a)*r)+'A'+fmt(r)+' '+fmt(r)+' 0 0 1 '+fmt(px+Math.cos(a+seg)*r)+' '+fmt(py+Math.sin(a+seg)*r);
        b.count++;
        for(let g=0;g<3;g++)if(random()>.38){const am=a+seg*(g+.5)/3;b.glints[(i+g)%2]+=point(px+Math.cos(am)*r,py+Math.sin(am)*r);}
      }
      for(let i=0;i<12;i++){
        const b=bands[i],fade=1-(i+.5)/12*.75;set(b.layer,'data-arc-count',b.count);
        for(let c=0;c<4;c++)if(b.paths[c])node('path',{d:b.paths[c],stroke:COLORS[c],'stroke-width':fmt((.3+fade)*unit*(.66+c*.13)),opacity:fmt((.12+fade*.55)*(.65+c*.14))},b.layer);
        b.glintNodes=b.glints.map((d,j)=>node('path',{d,stroke:j?'#d6ebff':'#ffffff','stroke-width':fmt((.85+fade*.7)*unit),opacity:'.6','data-trail-glints':j},b.layer));
      }
      dustGroups=Array.from({length:5},(_,i)=>{
        const group=node('g',{'data-inward-dust':i},dust);let a='',b='';
        for(let j=0;j<1040;j++){const angle=random()*TAU,r=radius*(.07+.89*Math.pow(random(),.7));const p=point(Math.cos(angle)*r,Math.sin(angle)*r);if(j%3)a+=p;else b+=p;}
        node('path',{d:a,stroke:COLORS[i%4],'stroke-width':fmt(.58*unit),opacity:'.65'},group);
        node('path',{d:b,stroke:'#c4e1ff','stroke-width':fmt(.95*unit),opacity:'.54'},group);
        return {group,phase:i/5};
      });
      glintGroups=Array.from({length:4},(_,j)=>{
        const group=node('g',{},stars);
        for(let i=0;i<6;i++){const x=range(.04,.96)*w,y=range(.06,.94)*skyHeight,r=range(1.2,2.5);node('circle',{cx:fmt(x),cy:fmt(y),r:fmt(r*4.2),fill:url('starlight'),stroke:'none','data-round-star':''},group);}
        return group;
      });
      floatGroups=Array.from({length:8},(_,i)=>{
        let d='';for(let j=0;j<44;j++)d+=point(range(-.04,1.04)*w,range(-.08,1.08)*h);
        return node('path',{d,stroke:COLORS[i%4],'stroke-width':fmt(.7+(i%3)*.5),opacity:'.24'},floating);
      });
      pulsePool=Array.from({length:16},(_,i)=>{
        const group=node('g',{'data-music-ripple':i,opacity:0},pulses);
        const rings=Array.from({length:3},(_,j)=>node('ellipse',{cx:0,cy:0,rx:1,ry:1,stroke:j===2?'#b8e7ff':'#75c5ff','stroke-width':j===2?'.65':j===1?'2.2':'5',...(j<2?{filter:url('ripple-glow')}:{}) ,'vector-effect':'non-scaling-stroke','data-ripple-soft':j<2?'glow':'edge'},group));
        return {group,rings};
      });
      for(let layer=0;layer<2;layer++){
        // Submerged light is a translucent bloom, never arbitrary line marks.
        for(let i=0;i<3;i++)node('ellipse',{cx:fmt(w*(.2+i*.3)),cy:fmt(skyHeight+(h-skyHeight)*(.13+layer*.38+i*.055)),rx:fmt(w*(.13+i*.018)),ry:fmt(h*(.008+layer*.009)),fill:url('water-bloom'),opacity:layer?'.65':'.48'},layer?rippleFront:rippleBack);
      }
    }
    function render(options={}){
      if(disposed)return;
      const w=Math.max(1,Math.min(32768,finite(options.width,width||1280))),h=Math.max(1,Math.min(32768,finite(options.height,height||720)));
      if(w!==width||h!==height)layout(w,h);
      if(options.reduced){visualTime=0;musicFrame=null;}else if(!options.paused||options.seek){visualTime=Math.max(0,finite(options.time,visualTime));musicFrame=options.music||null;}
      const t=visualTime,rotate=(degrees)=>'rotate('+fmt(degrees%360)+' '+fmt(px)+' '+fmt(py)+')';
      set(distant,'transform',rotate(t*.024));set(trails,'transform',rotate(t*.018));set(stars,'transform',rotate(t*.032));
      for(let i=0;i<bands.length;i++){
        const b=bands[i];set(b.layer,'transform',rotate(t*b.speed));set(b.layer,'opacity',fmt(.72+.22*Math.sin(t*.9+i*1.71)));
        for(let j=0;j<b.glintNodes.length;j++)set(b.glintNodes[j],'opacity',fmt(.12+.72*Math.pow(.5+.5*Math.sin(t*1.2+i*2.1+j*2.7),3)));
      }
      for(const {group,phase}of dustGroups){const p=(t/56+phase)%1,scale=1-p*.91,alpha=Math.min(1,p*7,(1-p)*8);set(group,'transform','translate('+fmt(px)+' '+fmt(py)+') rotate('+fmt(t*.48+phase*36)+') scale('+fmt(scale)+')');set(group,'opacity',fmt(alpha*.66));}
      starGroups.forEach((e,i)=>set(e,'opacity',fmt(.18+.44*Math.pow(.5+.5*Math.sin(t*(.33+i*.027)+i*1.74),2))));
      glintGroups.forEach((e,i)=>set(e,'opacity',fmt(.24+.68*Math.pow(.5+.5*Math.sin(t*.66+i*1.8),3))));
      floatGroups.forEach((e,i)=>{set(e,'transform','translate('+fmt(Math.sin(t*.08+i)*8)+' '+fmt(Math.sin(t*.045+i)*22)+')');set(e,'opacity',fmt((width<640?.13:.2)+.14*Math.pow(.5+.5*Math.sin(t*.36+i*1.7),2)));});
      // Fixed slots reconstruct from the song position. No emitters, random
      // frame clocks or accumulated particles survive pause/seek/rewind.
      const mt=finite(musicFrame?.time,-1),realMusic=musicFrame&&Number.isFinite(musicFrame.energy)&&window.LifeMusicPulse;
      // The public music sample deliberately keeps a five-second window. A
      // second read from the same measured song recovers older afterglow on a
      // seek without retaining emitter history or inventing beats.
      const earlier=realMusic?window.LifeMusicPulse.sample({src:window.LifeMusicPulse.track.src,time:Math.max(0,mt-4.2)}):null;
      const history=new Map();for(const beat of [...(earlier?.beats||[]),...(musicFrame?.beats||[])])history.set(beat.index??beat.at,beat);
      const beats=[...history.values()].filter(b=>mt>=b.at&&mt-b.at<9.2&&(!realMusic||b.index%2===0)).sort((a,b)=>a.at-b.at).slice(-pulsePool.length);
      pulsePool.forEach((p,i)=>{
        const beat=beats[i];if(!beat){set(p.group,'opacity',0);return;}
        const age=mt-beat.at,strength=Math.max(0,Math.min(1,finite(beat.strength,0))),index=finite(beat.index,i);
        const x=width*(.15+(((index*137.508)%360)/360)*.7),depth=.12+((index*37)%79)/100*.76,y=skyHeight+(height-skyHeight)*depth;
        const radius=Math.min(width*.22,155)*( .55+strength*.65),perspective=.18+depth*.2;
        set(p.group,'transform','translate('+fmt(x)+' '+fmt(y)+')');set(p.group,'opacity',fmt((.3+strength*.68)*Math.min(1,age*7)));
        p.rings.forEach((ring,j)=>{const v=Math.max(0,Math.min(1,age/4.2)),r=2+radius*Math.pow(v,.73);set(ring,'rx',fmt(r));set(ring,'ry',fmt(r*perspective));set(ring,'opacity',fmt(age<j*.08?0:Math.pow(1-v,1.65)*(j===2?.6:j===1?.35:.16)));});
      });
      set(stars,'opacity',fmt(.78+Math.sin(t*.31)*.10));
      set(rippleBack,'transform','translate('+fmt(Math.sin(t*.13)*Math.min(3,width*.005))+' 0)');
      set(rippleFront,'transform','translate('+fmt(Math.sin(t*.17+1)*Math.min(2,width*.004))+' 0)');
    }
    function destroy(){if(disposed)return;disposed=true;element.remove();element.replaceChildren();bands=[];dustGroups=[];starGroups=[];floatGroups=[];glintGroups=[];pulsePool=[];musicFrame=null;}
    return {element,render,destroy};
  }
  window.LifeStarLake={create};
})();
