(function () {
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
  const ease=v=>v*v*(3-2*v);
  function seed(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.codePointAt(0),16777619);return h>>>0;}
  function noise(h){h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return ((h^(h>>>16))>>>0)/4294967295;}
  function create(options) {
    options=options||{};
    const doc=options.document||window.document,host=options.host,label=options.textElement;
    if(!doc||!host||!label)throw new TypeError('LifeTextDissolve requires document, host and textElement');
    const view=doc.defaultView||window,owned=!options.canvas,canvas=options.canvas||doc.createElement('canvas');
    const oldCanvas={className:canvas.className,width:canvas.width,height:canvas.height,aria:canvas.getAttribute('aria-hidden')},originalText=label.textContent||'',originalNodes=[...label.childNodes],originalAria=label.getAttribute('aria-label'),hadClass=label.classList.contains('life-text-dissolve-source');
    canvas.classList.add('life-text-dissolve-canvas');canvas.setAttribute('aria-hidden','true');
    if(!canvas.parentNode)host.appendChild(canvas);
    let context=null;try{context=canvas.getContext('2d');}catch(_){}
    let dead=false,text='',chars=[],points=[],layoutKey='',sampled=false,degraded=false,reads=0,lastProgress=null,frameKey='',sizeKey='',width=0,height=0,scale=1;
    function style(node){try{return view.getComputedStyle(node);}catch(_){return {};}}
    function setText(value){
      text=String(value==null?'':value);const fragment=doc.createDocumentFragment();chars=[];
      const segmenter=view.Intl&&view.Intl.Segmenter?new view.Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
      const graphemes=segmenter?[...segmenter.segment(text)].map(x=>x.segment):Array.from(text);
      const lines=[[]];
      for(const char of graphemes){
        if(char==='\n'||char==='\r\n'){fragment.appendChild(doc.createTextNode(char));lines.push([]);continue;}
        const span=doc.createElement('span');span.className='life-text-dissolve-char';span.textContent=char;span.setAttribute('aria-hidden','true');fragment.appendChild(span);
        if(/\S/u.test(char)){const item={node:span,text:char,position:0};chars.push(item);lines[lines.length-1].push(item);}
      }
      for(const line of lines)line.forEach((char,i)=>{char.position=line.length>1?i/(line.length-1):0;});
      label.replaceChildren(fragment);label.classList.add('life-text-dissolve-source');label.setAttribute('aria-label',text);
      layoutKey='';sampled=false;degraded=false;points=[];lastProgress=null;frameKey='';
    }
    setText(originalText);
    function resize(w,h){
      width=Math.max(1,Math.round(Number(w)||host.clientWidth||host.getBoundingClientRect().width||1));
      height=Math.max(1,Math.round(Number(h)||host.clientHeight||host.getBoundingClientRect().height||1));
      const dpr=clamp(view.devicePixelRatio||1,1,2);scale=Math.min(dpr,Math.sqrt(4500000/(width*height)));
      const next=[width,height,scale].join('/');if(next===sizeKey)return false;sizeKey=next;
      canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      frameKey='';return true;
    }
    function geometry(){
      const hr=host.getBoundingClientRect(),rect=label.getBoundingClientRect(),s=style(label);
      const key=[text,width,height,rect.width,rect.height,s.fontSize,s.fontFamily,s.fontWeight,s.fontStyle,s.lineHeight,s.letterSpacing].join('|');
      return {key,hr,rect,s,x:rect.left-hr.left,y:rect.top-hr.top};
    }
    function sample(g){
      layoutKey=g.key;sampled=false;degraded=true;points=[];
      if(!context||!chars.length||g.rect.width<=0||g.rect.height<=0)return;
      const off=doc.createElement('canvas'),ratio=Math.min(1.5,1800/g.rect.width,540/g.rect.height);
      off.width=Math.max(1,Math.ceil(g.rect.width*ratio));off.height=Math.max(1,Math.ceil(g.rect.height*ratio));
      let ctx=null;try{ctx=off.getContext('2d',{willReadFrequently:true});}catch(_){}if(!ctx)return;
      const boxes=[],fontSize=Number.parseFloat(g.s.fontSize)||32;
      try{
        ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='alphabetic';
        for(let i=0;i<chars.length;i++){
          const char=chars[i],rect=char.node.getBoundingClientRect(),s=style(char.node),size=Number.parseFloat(s.fontSize)||fontSize;
          const family=s.fontFamily||g.s.fontFamily||'sans-serif',weight=s.fontWeight||g.s.fontWeight||'600',fontStyle=s.fontStyle||g.s.fontStyle||'normal';
          ctx.font=fontStyle+' '+weight+' '+(size*ratio)+'px '+family;
          const metrics=ctx.measureText(char.text),ascent=Number(metrics.fontBoundingBoxAscent)||size*ratio*.8,descent=Number(metrics.fontBoundingBoxDescent)||size*ratio*.2;
          const x=(rect.left-g.rect.left)*ratio,y=(rect.top-g.rect.top)*ratio,rw=rect.width*ratio,rh=rect.height*ratio;
          if(rw<=0||rh<=0)continue;
          ctx.fillText(char.text,x,y+(rh-ascent-descent)/2+ascent);
          boxes.push({x,y,width:rw,height:rh,index:i,start:.05+char.position*.52});
        }
        const pixels=ctx.getImageData(0,0,off.width,off.height).data;reads++;
        const candidates=[],step=2;
        for(const box of boxes){
          const minX=Math.max(0,Math.floor(box.x)),minY=Math.max(0,Math.floor(box.y)),maxX=Math.min(off.width,Math.ceil(box.x+box.width)),maxY=Math.min(off.height,Math.ceil(box.y+box.height));
          for(let y=minY;y<maxY;y+=step)for(let x=minX;x<maxX;x+=step){
            if(!(pixels[(y*off.width+x)*4+3]>=48))continue;
            const within=clamp((x-box.x)/box.width),birth=box.start+within*.22;
            candidates.push({x:x/ratio,y:y/ratio,birth,index:box.index});
          }
        }
        const budget=width<=640?1000:2200,stride=Math.max(1,Math.ceil(candidates.length/budget)),hash=seed(text);
        for(let i=0;i<candidates.length;i+=stride){
          const p=candidates[i],n=noise(hash^Math.imul(i+1,2654435761));
          points.push({...p,dx:(noise(hash+i*7)-.5)*48,dy:35+n*58,wave:n*6.283185307,radius:.42+n*.52,color:n<.34?'#258fc8':n<.68?'#53bde8':'#79d3f2'});
        }
        sampled=points.length>0;degraded=!sampled;
      }catch(_){points=[];sampled=false;degraded=true;}
      // No persistent offscreen texture or pixel array remains after sampling.
      off.width=off.height=1;
    }
    function masks(progress){
      for(let i=0;i<chars.length;i++){
        const start=.05+chars[i].position*.52,cut=clamp((progress-start)/.22),node=chars[i].node;
        const mask=cut<=0?'none':cut>=1?'linear-gradient(transparent,transparent)':'linear-gradient(to right,transparent '+Math.max(0,cut*100-6).toFixed(3)+'%,#000 '+Math.min(100,cut*100+6).toFixed(3)+'%)';
        if(node.style.maskImage!==mask){node.style.maskImage=mask;node.style.webkitMaskImage=mask;}
        node.style.opacity=cut>=1?'0':'1';
      }
    }
    function render(input){
      if(dead)return {particles:0,sampled:false,progress:0,degraded:true};input=input||{};
      if(input.text!=null&&String(input.text)!==text)setText(input.text);
      resize(input.width,input.height);
      let progress=clamp(input.progress);
      if(input.paused&&lastProgress!=null&&!input.seek)progress=lastProgress;
      lastProgress=progress;
      // The visible title is untouched until dissolution actually starts.
      if(progress<=0&&!input.reduced&&frameKey==='idle/'+sizeKey)return {particles:points.length,sampled,progress:0,degraded,reads};
      const g=geometry();if(!input.reduced&&progress>0&&g.key!==layoutKey)sample(g);
      const effective=input.reduced||degraded||!context?0:progress,next=[g.key,g.x,g.y,effective,!!input.reduced].join('/');
      if(next===frameKey)return {particles:points.length,sampled,progress:effective,degraded,reads};frameKey=next;
      masks(effective);label.dataset.dissolveProgress=String(effective);
      if(context){
        context.setTransform(scale,0,0,scale,0,0);context.clearRect(0,0,width,height);
        if(!input.reduced&&sampled&&effective>0&&effective<1){
          for(const p of points){
            if(effective<=p.birth)continue;
            const age=clamp((effective-p.birth)/(1-p.birth)),lift=ease(age),opacity=Math.pow(1-age,1.15)*clamp((effective-p.birth)/.018);
            context.globalAlpha=opacity;context.fillStyle=p.color;
            const x=g.x+p.x+p.dx*lift+Math.sin(p.wave+age*4)*4*lift,y=g.y+p.y-p.dy*lift;
            if(typeof context.arc==='function'){
              context.globalAlpha=opacity*.16;context.beginPath();context.arc(x,y,p.radius*2.4,0,Math.PI*2);context.fill();
              context.globalAlpha=opacity;context.beginPath();context.arc(x,y,p.radius*.5,0,Math.PI*2);context.fill();
            }else context.fillRect(x-p.radius/2,y-p.radius/2,p.radius,p.radius);
          }
        }
        context.globalAlpha=1;
      }
      if(progress<=0&&!input.reduced)frameKey='idle/'+sizeKey;
      return {particles:points.length,sampled,progress:effective,degraded,reads};
    }
    function destroy(){
      if(dead)return;dead=true;
      if(context){context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);}
      if(text===originalText)label.replaceChildren(...originalNodes);else label.textContent=text;
      if(!hadClass)label.classList.remove('life-text-dissolve-source');
      if(originalAria==null)label.removeAttribute('aria-label');else label.setAttribute('aria-label',originalAria);
      delete label.dataset.dissolveProgress;points=[];chars=[];
      if(owned){canvas.remove();canvas.width=canvas.height=1;}else{canvas.className=oldCanvas.className;canvas.width=oldCanvas.width;canvas.height=oldCanvas.height;if(oldCanvas.aria==null)canvas.removeAttribute('aria-hidden');else canvas.setAttribute('aria-hidden',oldCanvas.aria);}
      context=null;
    }
    return {element:canvas,render,destroy};
  }
  window.LifeTextDissolve={create};
})();
