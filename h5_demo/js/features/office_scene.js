/* Independent scene layers; original panels, layout and delegated actions remain authoritative. */
(function () {
  "use strict";
  const ui = window.GameUI, G = window.OfficeGeometry;
  if (!ui || !G) return;
  let layoutOnly = false;
  const modern = () => !ui.core.embodiedAvailable || ui.core.embodiedAvailable();
  const bodyVisible = () => !ui.core.embodiedBodyAvailable || ui.core.embodiedBodyAvailable();
  function projection(cw,ch,bw,bh,sc,focused,screenScale=1) {
    const g=G.contain(cw,ch,bw,bh);
    if(!focused)return g;
    const seats=(sc.seats||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    // Seat coordinates, background art and dragged feet all share the
    // same image-percent projection. Never enlarge only the background layer.
    const xs=seats.map(p=>p.x),ys=seats.map(p=>p.y),sideMargin=seats.length>=12?8:10;
    const x0=seats.length?G.clamp(Math.min(...xs)-sideMargin,0,100):20,
      x1=seats.length?G.clamp(Math.max(...xs)+sideMargin,0,100):80,
      y0=seats.length?G.clamp(Math.min(...ys)-16,0,100):27,
      y1=seats.length?G.clamp(Math.max(...ys)+16,0,100):87;
    let zoom=G.clamp(Math.min(cw/(g.w*(x1-x0)/100),ch/(g.h*(y1-y0)/100)),1,2.5);
    const portrait=window.matchMedia?window.matchMedia('(orientation: portrait)').matches:window.innerHeight>window.innerWidth;
    const readable=portrait&&seats.length>=12;
    // Fit the same camera image into the unchanged window, including readable
    // text and screen chrome. A 320px viewport cannot reserve a 14px label and
    // then silently clip an 18px font glyph to make the original zoom fit.
    const unit=1/(screenScale||1),top=30*unit,bottom=38*unit,labelH=20*unit;
    const narrow=ch/unit<220;
    const labelGap=(narrow?.8:1)*unit;
    if(readable&&Math.max(...ys)>Math.min(...ys)){
      const span=(Math.max(...ys)-Math.min(...ys))*g.h/100;
      const rows=Array.from(new Set(ys)).sort((a,b)=>a-b);
      const rowGap=Math.min(...rows.slice(1).map((y,i)=>(y-rows[i])*g.h/100));
      const height=z=>span*z+Math.max(unit,Math.min((narrow?20.25:40)*unit,rowGap*z-labelH-2*labelGap))+labelH+2*unit;
      // Solve for the actual avatar height, not an estimated constant. At
      // intermediate phone widths the old estimate left no feasible offset.
      if(height(zoom)>ch-top-bottom){let low=1,high=zoom;
        for(let i=0;i<32;i++){const mid=(low+high)/2;if(height(mid)<=ch-top-bottom)low=mid;else high=mid;}
        zoom=low;
      }
    }
    const w=g.w*zoom,h=g.h*zoom,ox=cw/2-(x0+x1)/200*w;
    let oy=ch/2-(y0+y1)/200*h,profile;
    if(readable){
      const points=seats.map(p=>({x:ox+p.x*w/100,y:oy+p.y*h/100}));
      let rowGap=Infinity;
      points.forEach((p,i)=>points.slice(i+1).forEach(q=>{const dy=Math.abs(p.y-q.y);if(dy>3*unit)rowGap=Math.min(rowGap,dy);}));
      const avatar=Math.max(unit,Math.min((narrow?20.25:40)*unit,rowGap-labelH-2*labelGap));
      const lower=top+avatar/2+unit-Math.min(...points.map(p=>p.y));
      const upper=ch-bottom-avatar/2-labelH-unit-Math.max(...points.map(p=>p.y));
      if(lower<=upper+.000001)oy+=G.clamp(0,lower,Math.max(lower,upper));
      profile={avatar,labelH,unit,gap:labelGap};
    }
    return {...g,scale:g.scale*zoom,w,h,ox,oy,zoom,labelProfile:profile};
  }
  function context() {
    const scene = ui.el && ui.el.querySelector(".office-scene");
    if (!scene || !ui.core || !ui.core.state || !ui.core.cfg) return null;
    const sc = ui.core.scene(), img = scene.querySelector(".office-bg");
    if (!modern()) ui._v2aOfficeFocused=false;
    // The camera class only styles scene descendants. Its outer rectangle is
    // identical in full-map and focused views, including portrait orientation.
    scene.classList.toggle('v2a-office-focused',!!ui._v2aOfficeFocused);
    scene.classList.toggle('v2a-office-legacy',!modern());
    const cw = scene.clientWidth, ch = scene.clientHeight;
    if (!sc.whale || !cw || !ch) return null;
    const rect=scene.getBoundingClientRect(),screenScale=Math.min(rect.width/cw,rect.height/ch)||1;
    return { scene, sc, g:projection(cw,ch,img.naturalWidth || sc.w,img.naturalHeight || sc.h,sc,!!ui._v2aOfficeFocused,screenScale), rect };
  }
  function pointer(p, ctx) {
    const {rect,g} = ctx;
    return G.unproject({x:(p.clientX-rect.left)*g.cw/rect.width,y:(p.clientY-rect.top)*g.ch/rect.height},g);
  }
  function markers(ctx) {
    const nodes=Array.from(ctx.scene.querySelectorAll(".emp-marker")),seatMap=layoutOnly
      ? (ui.core.state.seatOf || {}) : ui.core.resolveSeats();
    const seats=nodes.map((node,i)=>ctx.sc.seats[seatMap[node.dataset.eng]] || {x:6+(i%6)*17.5,y:86+Math.floor(i/6)*12});
    // The office shell itself may be scaled. Keep focused portraits at a
    // useful screen size instead of leaving their CSS size fixed at 28 px.
    const screenScale=Math.min(ctx.rect.width/ctx.g.cw,ctx.rect.height/ctx.g.ch)||1;
    const focused=!!ui._v2aOfficeFocused;
    const portraitMode=window.matchMedia?window.matchMedia('(orientation: portrait)').matches:window.innerHeight>window.innerWidth;
    const inlineLabels=portraitMode&&focused&&ctx.sc.seats.length>=12;
    const fixedLabels=!inlineLabels;
    ctx.scene.style.setProperty('--v2a-screen-unit',String(1/screenScale));
    // The eight-seat pixel office retains its original GitHub sizing. The
    // twelve-seat office has a separate profile and focused density limits.
    let avatar=modern()?(focused?48/screenScale:28):(portraitMode?34:69)/screenScale;
    let nearest=Infinity;
    if(focused&&ctx.sc.seats.length>=12){
      const points=ctx.sc.seats.map(p=>G.project(p,ctx.g));
      points.forEach((p,i)=>points.slice(i+1).forEach(q=>{nearest=Math.min(nearest,Math.max(Math.abs(p.x-q.x),Math.abs(p.y-q.y)));}));
      avatar=Math.min(avatar,Math.max(1,nearest-3/screenScale));
      if(inlineLabels){
        // Reserve the complete readable pill, including glyph ascent/descent.
        // Only the portrait size changes; its authored desk centre does not.
        let rowGap=Infinity;
        points.forEach((p,i)=>points.slice(i+1).forEach(q=>{const dy=Math.abs(p.y-q.y);if(dy>3/screenScale)rowGap=Math.min(rowGap,dy);}));
        const spacing=ctx.g.labelProfile?ctx.g.labelProfile.gap:1/screenScale;
        avatar=Math.min(avatar,Math.max(1,rowGap-20/screenScale-2*spacing));
      }
    }
    if(inlineLabels)avatar=Math.min(avatar,40/screenScale);
    if(inlineLabels&&ctx.g.labelProfile)avatar=Math.min(avatar,ctx.g.labelProfile.avatar);
    ctx.scene.style.setProperty('--v2a-avatar-size',avatar+'px');
    // Portrait text uses a readable screen size independent of camera and
    // shell zoom; its natural capsule is never narrowed to make a row fit.
    const nameFont=inlineLabels?12.25/screenScale:portraitMode?(modern()?13:11)/screenScale:16;
    const staminaFont=inlineLabels?11.25/screenScale:portraitMode?10.5/screenScale:12;
    ctx.scene.style.setProperty('--v2a-name-font-size',nameFont+'px');
    ctx.scene.style.setProperty('--v2a-stamina-font-size',staminaFont+'px');
    ctx.scene.style.setProperty('--v2a-inline-label-height',20/screenScale+'px');
    ctx.scene.style.setProperty('--v2a-label-pad',portraitMode?4/screenScale+'px':'6px');
    // A complete focused capsule may use the window width. The row solver
    // spreads labels, while full-map/legacy profiles retain their existing cap.
    const nameCap=inlineLabels?ctx.g.cw:Math.max(96/screenScale,64);
    ctx.scene.style.setProperty('--v2a-name-width',nameCap+'px');
    const metrics=nodes.map(node=>{
      // An existing full-map marker is scaled; a newly hired marker is not.
      // Measure both in the same local coordinates before laying out the row.
      node.style.transform='none';
      const name=node.querySelector(".emp-name"),status=node.querySelector(".emp-status"),stamina=node.querySelector('.emp-stamina');
      if(name)name.title=name.textContent;
      if(status){status.title=status.textContent;status.setAttribute("aria-label",status.textContent);}
      const portrait=node.querySelector('.emp-avatar');
      if(portrait){portrait.style.left='0px';portrait.style.top='0px';portrait.style.width=avatar+'px';portrait.style.height=avatar+'px';
        portrait.title=[name&&name.textContent,status&&status.textContent,stamina&&stamina.textContent].filter(Boolean).join(' · ');}
      let label=node.querySelector('.v2a-employee-label');
      if(!label){label=document.createElement('div');label.className='v2a-employee-label';node.appendChild(label);}
      label.classList.toggle('v2a-label-inline',inlineLabels);
      if(name&&name.parentNode!==label)label.appendChild(name);
      if(stamina&&stamina.parentNode!==label)label.appendChild(stamina);
      label.hidden=false;label.classList.remove('v2a-label-compact');label.style.width='';label.style.transform='';
      label.classList.add('v2a-label-measuring');
      // Measure only the text block. The root box always describes the avatar,
      // regardless of status DOM order or the width of an engineer's name.
      const nameWidth=Array.from(name?name.textContent:"").length*nameFont+(inlineLabels?0:portraitMode?8/screenScale+2:14);
      const staminaWidth=Array.from(stamina?stamina.textContent:'').length*staminaFont*.6+(inlineLabels?0:20);
      if(stamina){if(inlineLabels)stamina.setAttribute('aria-label','体力 '+stamina.textContent.trim());else stamina.removeAttribute('aria-label');}
      // Offset dimensions round to integer CSS pixels. Include the scrollable
      // text plus both borders and one rounding pixel so a short natural name
      // is not immediately ellipsised when the measured box is assigned back.
      const textWidth=el=>el&&el.offsetWidth?Math.ceil(Math.max(el.offsetWidth,el.scrollWidth+2))+1:0;
      const measured=Math.max(label.offsetWidth,textWidth(name),textWidth(stamina));
      const labelRect=inlineLabels&&label.getBoundingClientRect();
      const labelH=labelRect&&labelRect.height?labelRect.height/screenScale:label.offsetHeight || (inlineLabels?20/screenScale:40);
      const metric={avatar,labelW:Math.min(measured || (inlineLabels?nameWidth+staminaWidth+5/screenScale:Math.max(nameWidth,staminaWidth,40)),nameCap),
        labelH,compactH:inlineLabels?labelH:name&&name.offsetHeight || 24};
      label.classList.remove('v2a-label-measuring');
      return metric;
    });
    if(fixedLabels&&modern()&&metrics.length){
      // Size the original two capsules against the complete seat grid, so
      // hiring, roster order and device text metrics never change their side.
      const scale=focused?1:Math.min(1,ctx.g.w/640),gap=3*scale,padding=Math.min(4,ctx.g.cw/8,ctx.g.ch/8);
      const points=ctx.sc.seats.map(p=>G.project(p,ctx.g));
      let rowGap=Infinity,columnGap=Infinity;
      points.forEach((p,i)=>points.slice(i+1).forEach(q=>{
        const dx=Math.abs(p.x-q.x),dy=Math.abs(p.y-q.y);
        if(dy>3*scale)rowGap=Math.min(rowGap,dy);
        else if(dx>0)columnGap=Math.min(columnGap,dx);
      }));
      const bottom=ctx.g.ch-padding-Math.max(...points.map(p=>p.y))-avatar*scale/2-gap;
      const height=Math.min(rowGap-avatar*scale-2*gap,bottom)/scale;
      const width=(columnGap-2*gap)/scale;
      const labelScale=G.clamp(Math.min(1,height/Math.max(...metrics.map(m=>m.labelH)),width/Math.max(...metrics.map(m=>m.labelW))),.01,1);
      metrics.forEach(m=>{m.labelScale=labelScale;m.labelW*=labelScale;m.labelH*=labelScale;});
    }
    if(fixedLabels&&!modern()&&metrics.length){
      // Test the actual scaled rectangles against the occupied diagonal desks.
      // Unscaled widths can falsely constrain an otherwise distant row and
      // collapse every label to a tiny strip on a narrow phone.
      const points=seats.map(p=>G.project(p,ctx.g)),gap=3,padding=4;
      const overlap=(a,b)=>a.x<b.x+b.w-1e-6&&a.x+a.w>b.x+1e-6&&a.y<b.y+b.h-1e-6&&a.y+a.h>b.y+1e-6;
      const portraits=points.map(p=>({x:p.x-avatar/2,y:p.y-avatar/2,w:avatar,h:avatar}));
      const fits=fit=>{const boxes=points.map((p,i)=>({x:p.x-metrics[i].labelW*fit/2,y:p.y+avatar/2+gap,w:metrics[i].labelW*fit,h:metrics[i].labelH*fit}));
        return boxes.every((b,i)=>b.x>=padding&&b.x+b.w<=ctx.g.cw-padding&&b.y+b.h<=ctx.g.ch-padding
          &&!portraits.some(q=>overlap(b,q))&&!boxes.slice(i+1).some(q=>overlap(b,q)));};
      let fit=1;if(!fits(fit)){let low=0,high=1;for(let i=0;i<32;i++){const mid=(low+high)/2;if(fits(mid))low=mid;else high=mid;}fit=low;}
      fit=G.clamp(fit,.01,1);metrics.forEach(m=>{m.labelScale=fit;m.labelW*=fit;m.labelH*=fit;});
    }
    if(inlineLabels&&metrics.length){
      // Preserve complete labels even when four long names share a narrow row.
      // Fit whole rows together, never move one person's name above a neighbour.
      const padding=Math.min(4,ctx.g.cw/8,ctx.g.ch/8),gap=ctx.g.labelProfile?ctx.g.labelProfile.gap:1/screenScale;
      const rows=[];
      seats.forEach((seat,index)=>{const p=G.project(seat,ctx.g);let row=rows.find(r=>Math.abs(r.y-p.y)<=3);
        if(!row){row={y:p.y,indices:[]};rows.push(row);}row.indices.push(index);});
      const labelScale=Math.min(1,...rows.map(row=>
        (ctx.g.cw-2*padding-(2*gap+.001)*(row.indices.length-1)-.01)/row.indices.reduce((sum,i)=>sum+metrics[i].labelW,0)));
      metrics.forEach(m=>{m.labelScale=labelScale;m.labelW*=labelScale;m.labelH*=labelScale;});
    }
    const labelObstacles=Array.from(ui.el.querySelectorAll('.office-guide-banner,.v2a-office-controls,#ob-pausedtag,.whale-autocare-status')).map(node=>{
      const r=node.getBoundingClientRect();return {x:(r.left-ctx.rect.left)*ctx.g.cw/ctx.rect.width,
        y:(r.top-ctx.rect.top)*ctx.g.ch/ctx.rect.height,w:r.width*ctx.g.cw/ctx.rect.width,h:r.height*ctx.g.ch/ctx.rect.height};
    }).filter(b=>b.w>0&&b.h>0);
    const layout=G.markerLayout(seats,ctx.g,metrics,{scale:focused||!modern()?1:undefined,gap:inlineLabels?(ctx.g.labelProfile?ctx.g.labelProfile.gap:1/screenScale):undefined,fullLabels:inlineLabels,rowBelow:inlineLabels,fixedBelow:fixedLabels,minLabelWidth:!modern()&&portraitMode?44/screenScale:undefined,labelObstacles});
    layout.markers.forEach(box=>{
      const node=nodes[box.index],m=metrics[box.index];
      node.style.left=box.x+"px";node.style.top=box.y+"px";
      node.style.width=m.avatar+"px";node.style.height=m.avatar+"px";
      node.style.transform="scale("+layout.scale+")";
      const label=node.querySelector('.v2a-employee-label');label.hidden=!box.label;
      label.classList.toggle('v2a-label-compact',!!box.label&&box.label.compact);
      const labelScale=m.labelScale||1;label.style.transform=labelScale===1?'':'scale('+labelScale+')';
      label.style.transformOrigin='0 0';
      if(box.label){label.style.left=(box.label.x-box.x)/layout.scale+'px';
        label.style.top=(box.label.y-box.y)/layout.scale+'px';label.style.width=box.label.w/layout.scale/labelScale+'px';}
    });
    layout.avatarSize=avatar;
    ctx.scene._v2aMarkerLayout=layout;
    return layout;
  }
  function safeWhalePoint(ctx,p) {
    const node=whaleNode(ctx),ratio=node?parseFloat(node.style.aspectRatio)||1:1;
    const h=whaleHeight(ctx,node);
    const layout=ctx.scene._v2aMarkerLayout||{markers:[]},boxes=layout.obstacles||layout.markers;
    return G.safeWhalePoint(p,ctx.sc,ctx.g,boxes,{w:h*ratio,h}) || G.nearest(ctx.sc.spawn,ctx.sc);
  }
  function whaleNode(ctx) { return ctx.scene.querySelector('.v2a-whale') || ui.el.querySelector('.v2a-whale-layer .v2a-whale'); }
  function screenPoint(ctx,p) { const q=G.project(p,ctx.g);return {x:ctx.rect.left+q.x*ctx.rect.width/ctx.g.cw,y:ctx.rect.top+q.y*ctx.rect.height/ctx.g.ch}; }
  function gameBounds() {
    const r=ui.el.getBoundingClientRect(),v=window.visualViewport;
    const vx=v?v.offsetLeft:0,vy=v?v.offsetTop:0,vw=v?v.width:window.innerWidth,vh=v?v.height:window.innerHeight;
    const x=Math.max(vx,r.width?r.left:0),y=Math.max(vy,r.height?r.top:0);
    return {x,y,w:Math.max(0,Math.min(vx+vw,r.width?r.right:vw)-x),h:Math.max(0,Math.min(vy+vh,r.height?r.bottom:vh)-y)};
  }
  function whaleHeight(ctx,node) {
    const shell=ctx.scene.closest('.office-shell');
    const stored=shell&&parseFloat(shell.style.getPropertyValue('--whale-user-scale'));
    const chosen=Number.isFinite(stored)?stored:window.WhaleSize&&typeof window.WhaleSize.get==='function'?window.WhaleSize.get():1;
    const factor=G.clamp(Number.isFinite(chosen)?chosen:1,.8,1.8);
    const ratio=node?parseFloat(node.style.aspectRatio)||1:1,screenScale=ctx.rect.height/ctx.g.ch||1,bounds=gameBounds();
    // Keep one size calculation for drawing, marker avoidance and floating drag.
    // Reserve the return button and a small margin when the viewport is tiny.
    return Math.max(1,Math.min(ctx.sc.whale.h*ctx.g.h/100*factor,
      ctx.g.h-4,(ctx.g.w-4)/ratio,(bounds.h-32)/screenScale,(bounds.w-8)/ratio/screenScale));
  }
  function floatingSize(ctx,node) {
    // Once outside the map, the pet belongs to the screen rather than the
    // camera. Focusing the office must not resize or displace that screen pet.
    const full={...ctx,g:G.contain(ctx.g.cw,ctx.g.ch,ctx.g.bw,ctx.g.bh)};
    const h=whaleHeight(full,node)*ctx.rect.height/ctx.g.ch;
    return {w:h*(parseFloat(node.style.aspectRatio)||1),h};
  }
  const transientLayers='.modal-mask,.dg-modal-mask,.set-pop-mask,.sub-modal-overlay,.ev-spawn,.insp-overlay,.v2b-panel-host,.rl-more,.chat-zoom-mask,.nw-lightbox';
  function protectedBoxes() {
    return Array.from(document.querySelectorAll('button,[data-action],.emp-marker,.v2a-employee-label,.office-guide-banner')).filter(n=>
      !n.closest('.v2a-whale-layer')&&!n.closest(transientLayers)&&!n.classList.contains('v2a-whale')).map(n=>{
      const r=n.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};}).filter(b=>b.w&&b.h);
  }
  function safeFloating(ctx,node,p,avoid) {
    const size=floatingSize(ctx,node);
    // Reserve the return button below the sprite as part of the movable unit.
    return G.floatingFoot({x:p.x,y:p.y+24},gameBounds(),{w:Math.max(size.w,88),h:size.h+24},avoid?protectedBoxes():[]);
  }
  function floatingLayer(ctx,node) {
    let layer=ui.el.querySelector('.v2a-whale-layer');
    if(!layer){layer=document.createElement('div');layer.className='v2a-whale-layer';
      const back=document.createElement('button');back.type='button';back.className='v2a-whale-return';back.textContent='回到场景';
      back.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();ui._clickHandled=true;ui._pressTarget=null;returnHome();});
      layer.appendChild(back);}
    if(layer.parentNode!==ui.el)ui.el.appendChild(layer);
    if(node.parentNode!==layer){layer.appendChild(node);
      if(ui._v2aDrag)try{node.setPointerCapture(ui._v2aDrag.id);}catch(_){/* pointer capture unavailable in older webviews */}}
    node.classList.add('v2a-floating');return layer;
  }
  function moveFloating(ctx,node,p,dragging) {
    const layer=floatingLayer(ctx,node),size=floatingSize(ctx,node),back=layer.querySelector('.v2a-whale-return');
    node.style.height=size.h+'px';node.style.transform=`translate3d(${p.x}px,${p.y}px,0) translate(-50%,-100%)`;
    back.hidden=!!dragging;back.style.left=p.x+'px';back.style.top=(p.y+2)+'px';
    ui._v2aFloatingPoint={...p};
    syncFloatingVisibility();
    if(window.OfficeBubbles)window.OfficeBubbles.refresh();
  }
  function persistPosition(value) {
    if(layoutOnly)return;
    ui.core.state.officeWhalePosition=value;
    if(ui.save&&ui.save.autoSave)ui.save.autoSave(ui.core.state);
  }
  function returnHome() {
    const ctx=context();if(!ctx)return;const node=whaleNode(ctx);if(!node)return;
    ui._v2aWhalePoint=safeWhalePoint(ctx,ctx.sc.spawn||{x:84,y:81});
    persistPosition({mode:'scene',bg:ctx.sc.bg,...ui._v2aWhalePoint});
    node.classList.remove('v2a-floating');ctx.scene.appendChild(node);
    const layer=ui.el.querySelector('.v2a-whale-layer');if(layer)layer.remove();refresh();
  }
  function backdrop(ctx) {
    let fill=ctx.scene.querySelector('.v2a-scene-fill');
    if(!fill){fill=document.createElement('div');fill.className='v2a-scene-fill';fill.setAttribute('aria-hidden','true');ctx.scene.insertBefore(fill,ctx.scene.firstChild);}
    const img=ctx.scene.querySelector('.office-bg'),src=img.getAttribute('src')||ctx.sc.bg;
    fill.style.backgroundImage='url('+JSON.stringify(src)+')';
    img.style.left=ctx.g.ox+'px';img.style.top=ctx.g.oy+'px';
    img.style.width=ctx.g.w+'px';img.style.height=ctx.g.h+'px';
    img.style.right='auto';img.style.bottom='auto';img.style.transform='none';
    ctx.scene.classList.toggle('v2a-office-focused',!!ui._v2aOfficeFocused);
  }
  function setFocused(focused) {
    if(ui._v2aDrag||ui._v2aReturnFrame)return;
    if(window.WhaleAutoCare&&ui._whaleAutomationActor)WhaleAutoCare.cancel(ui.core);
    ui._v2aOfficeFocused=!!focused && modern();
    refreshLayout();
    if(window.OfficeBubbles)window.OfficeBubbles.refresh();
  }
  function viewControl(ctx) {
    // Screen chrome has one physical size in either camera mode. Update its
    // unit before reading any rectangles, including after shell resize/zoom.
    const screenScale=Math.min(ctx.rect.width/ctx.g.cw,ctx.rect.height/ctx.g.ch)||1;
    const controlUnit=1/screenScale;
    ctx.scene.style.setProperty('--v2a-control-unit',String(controlUnit));
    let controls=ctx.scene.querySelector('.v2a-office-controls');
    if(!controls){controls=document.createElement('div');controls.className='v2a-office-controls';ctx.scene.appendChild(controls);}
    let button=ctx.scene.querySelector('.v2a-office-view');
    if(!button){button=document.createElement('button');button.type='button';button.className='v2a-office-view';
      button.dataset.action='office-view';
      button.addEventListener('pointerdown',e=>e.stopPropagation());
      button.addEventListener('click',e=>ui.onClick(e));
    }
    if(button.parentElement!==controls)controls.appendChild(button);
    button.hidden=!modern();
    let speed=controls.querySelector('[data-action="office-speed-toggle"]');
    if(!speed){speed=document.createElement('button');speed.type='button';speed.className='v2a-office-speed';
      speed.dataset.action='office-speed-toggle';
      speed.addEventListener('pointerdown',e=>e.stopPropagation());
      speed.addEventListener('click',e=>ui.onClick(e));controls.insertBefore(speed,button);
    }
    button.textContent=ui._v2aOfficeFocused?'全图视角':'聚焦办公室';
    button.setAttribute('aria-pressed',String(!!ui._v2aOfficeFocused));
    button.title=ui._v2aOfficeFocused?'查看整个办公室并拖动鲸鱼娘':'放大工程师工位区域';
    button.disabled=!!ui._v2aDrag||!!ui._v2aReturnFrame;
    if(window.OfficeSpeed)window.OfficeSpeed.refresh(ui);
    // The guide belongs to the shell and paints above scene descendants.
    // Reserve its real screen rectangle instead of putting the new left-hand
    // speed button under the guide while only the camera remains reachable.
    const portrait=window.matchMedia?window.matchMedia('(orientation: portrait)').matches:window.innerHeight>window.innerWidth;
    const controlTop=(portrait?2:6)*controlUnit;
    controls.style.top=controlTop+'px';
    const box=controls.getBoundingClientRect();
    if(box.width&&box.height){
      const guides=Array.from(ui.el.querySelectorAll('.office-guide-banner')).map(node=>node.getBoundingClientRect());
      const covered=guides.filter(r=>r.width&&r.height&&box.left<r.right&&box.right>r.left&&box.top<r.bottom&&box.bottom>r.top);
      if(covered.length){const top=(Math.max(...covered.map(r=>r.bottom))-ctx.rect.top)*ctx.g.ch/ctx.rect.height+6*controlUnit;
        controls.style.top=G.clamp(top,controlTop,Math.max(controlTop,ctx.g.ch-box.height*ctx.g.ch/ctx.rect.height-4*controlUnit))+'px';}
    }
  }
  function pose(ctx, dragging) {
    // Bubble faces (sweating, tired, feeding, etc.) are conversation avatars,
    // not full-body art. Scene actors always stand unless actively dragged.
    const p=ctx.sc.whale.poses || {},face=dragging?'drag':'stand';
    const fallback=dragging?(ctx.sc.whale.drag||p.drag||ctx.sc.whale.stand||p.stand):(ctx.sc.whale.stand||p.stand);
    const standing=window.WhaleCare && typeof window.WhaleCare.outfitSrc==="function"?
      window.WhaleCare.outfitSrc(ui.core,face,fallback):fallback;
    return !dragging&&window.OfficeSleep?window.OfficeSleep.art(ui.core,standing,ctx.sc):standing;
  }
  function moveWhale(ctx,p) {
    const node=whaleNode(ctx);if(!node)return;
    const q=G.project(p,ctx.g);
    node.style.transform=`translate3d(${q.x}px,${q.y}px,0) translate(-50%,-100%)`;
    node.style.height=whaleHeight(ctx,node)+"px";
    node.dataset.x=String(p.x);node.dataset.y=String(p.y);
    if(window.OfficeBubbles)window.OfficeBubbles.refresh();
  }
  function installDrag(node) {
    node.addEventListener("pointerdown",e=>{
      if((e.button!=null&&e.button!==0)||ui._v2aDrag)return;
      if(node.closest('.v2a-overlay-blocked')){e.stopPropagation();ui._clickHandled=true;ui._pressTarget=null;}
      const ctx=context();if(!ctx)return;
      const p={...ui._v2aWhalePoint}, start=pointer(e,ctx),floating=node.classList.contains('v2a-floating');
      const screen=floating?{...ui._v2aFloatingPoint}:screenPoint(ctx,p);
      if(ui._v2aReturnFrame)window.cancelAnimationFrame(ui._v2aReturnFrame);
      ui._v2aReturnFrame=0;
      ui._v2aDrag={id:e.pointerId,ctx,p,start,latest:p,screen,floating,origin:ui.core.state.officeWhalePosition,downX:e.clientX,downY:e.clientY,moved:false,frame:0};
      try{node.setPointerCapture(e.pointerId);}catch(_){/* old webviews */}
    });
    function move(e){
      const d=ui._v2aDrag;if(!d||d.id!==e.pointerId)return;
      if(!d.moved&&Math.hypot(e.clientX-d.downX,e.clientY-d.downY)<5)return;
      const firstMove=!d.moved;
      d.moved=true;node.classList.add("v2a-dragging");
      if(e.cancelable)e.preventDefault();
      const raw={x:d.screen.x+e.clientX-d.downX,y:d.screen.y+e.clientY-d.downY};
      const foot=safeFloating(d.ctx,node,raw,false);d.screenLatest=foot?{x:foot.x,y:foot.y-24}:raw;
      d.latest=pointer({clientX:d.screenLatest.x,clientY:d.screenLatest.y},d.ctx);
      if(!d.frame)d.frame=window.requestAnimationFrame(()=>{d.frame=0;if(ui._v2aDrag!==d)return;
        ui._v2aWhalePoint={...d.latest};moveFloating(d.ctx,node,d.screenLatest,true);});
      const img=node.querySelector("img");const src=pose(d.ctx,true);if(img.getAttribute("src")!==src)img.src=src;
      if(firstMove&&window.OfficeBubbles)window.OfficeBubbles.say("drag");
    }
    function finish(e,cancelled){
      const d=ui._v2aDrag;if(!d||(e.pointerId!=null&&d.id!==e.pointerId))return;
      if(!cancelled&&Number.isFinite(e.clientX))move(e);
      if(d.frame)window.cancelAnimationFrame(d.frame);
      ui._v2aDrag=null;node.classList.remove("v2a-dragging");
      try{node.releasePointerCapture(d.id);}catch(_){}
      const outside=d.screenLatest&&(d.screenLatest.x<d.ctx.rect.left||d.screenLatest.x>d.ctx.rect.right||d.screenLatest.y<d.ctx.rect.top||d.screenLatest.y>d.ctx.rect.bottom)
        ||d.floating&&node.closest('.v2a-overlay-blocked');
      if(d.moved&&!cancelled&&!node.closest('.v2a-overlay-blocked')&&window.GameBus){
        window.GameBus.emit("whale:drop",{x:d.latest.x,y:d.latest.y});
      }
      if(d.moved||cancelled){
        ui._clickHandled=true;ui._pressTarget=null;ui._v2aSuppressClick=Date.now()+400;
        if((d.moved&&!cancelled&&outside)||(cancelled&&d.floating)){
          const from=cancelled?d.screen:d.screenLatest,fit=safeFloating(d.ctx,node,from,true)||safeFloating(d.ctx,node,from,false);
          if(fit){const p={x:fit.x,y:fit.y-24},bounds=gameBounds();
            if(!cancelled)persistPosition({mode:'floating',x:(p.x-bounds.x)/bounds.w,y:(p.y-bounds.y)/bounds.h});
            moveFloating(d.ctx,node,p,false);refresh();return;}
        }
        node.classList.remove('v2a-floating');d.ctx.scene.appendChild(node);
        const layer=ui.el.querySelector('.v2a-whale-layer');if(layer)layer.remove();
        const from=d.moved?d.latest:d.p,to=safeWhalePoint(d.ctx,from)||d.p;
        if(!cancelled)persistPosition({mode:'scene',bg:d.ctx.sc.bg,...to});
        ui._v2aReturnScene=d.ctx.scene;
        ui._v2aWhalePoint={...from};moveWhale(d.ctx,from);
        const reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const start=performance.now(),duration=reduced?0:220;
        const frame=t=>{if(!node.isConnected){ui._v2aReturnFrame=0;ui._v2aReturnScene=null;refresh();return;}
          const a=duration?G.clamp((t-start)/duration,0,1):1,k=1-Math.pow(1-a,3);
          const p={x:from.x+(to.x-from.x)*k,y:from.y+(to.y-from.y)*k};
          ui._v2aWhalePoint=p;moveWhale(d.ctx,p);
          if(a<1)ui._v2aReturnFrame=window.requestAnimationFrame(frame);else{
            ui._v2aReturnFrame=0;ui._v2aReturnScene=null;refresh();
            if(d.moved&&!cancelled&&window.OfficeBubbles)window.OfficeBubbles.say();
          }};
        ui._v2aReturnFrame=window.requestAnimationFrame(frame);
      }else refresh(); // A tap continues through the original data-action click path.
    }
    node.addEventListener("pointermove",move);node.addEventListener("pointerup",e=>{
      if(node.closest('.v2a-overlay-blocked')){e.stopPropagation();ui._clickHandled=true;ui._pressTarget=null;}
      finish(e,false);
    });
    node.addEventListener("pointercancel",e=>finish(e,true));node.addEventListener("lostpointercapture",e=>finish(e,true));
    ui._v2aCancelDrag=()=>finish({},true);
    node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();
      if(!node.closest('.v2a-overlay-blocked'))ui.onClick({target:node});}});
  }
  function whale(ctx) {
    if(ui._whaleAutomationActor)return;
    if (!bodyVisible()) {
      const old=whaleNode(ctx); if(old)old.remove();
      const layer=ui.el.querySelector('.v2a-whale-layer');if(layer)layer.remove();
      pod(ctx);return;
    }
    const closed=ctx.scene.querySelector('.embodied-pod');if(closed)closed.remove();
    let node=whaleNode(ctx);
    if(!node){node=document.createElement("div");node.className="v2a-whale";node.setAttribute("role","button");node.tabIndex=0;
      node.dataset.action="whale-pet";node.setAttribute("aria-label","轻触鲸鱼娘；可拖动");
      const img=document.createElement("img");img.alt="鲸鱼娘";img.draggable=false;
      img.addEventListener("load",()=>{if(img.naturalWidth&&img.naturalHeight){node.style.aspectRatio=String(img.naturalWidth/img.naturalHeight);refresh();}});
      node.appendChild(img);ctx.scene.appendChild(node);installDrag(node);
      node.addEventListener("click",e=>{if(Date.now()<(ui._v2aSuppressClick||0)||node.closest('.v2a-overlay-blocked')){e.stopPropagation();e.preventDefault();ui._clickHandled=true;ui._pressTarget=null;}},true);
    }
    if(ui._v2aDrag||ui._v2aReturnFrame)return;
    const saved=ui.core.state.officeWhalePosition;
    if(!ui._v2aWhalePoint)ui._v2aWhalePoint=safeWhalePoint(ctx,ctx.sc.spawn||{x:84,y:81});
    if(saved&&saved.mode==='floating'&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
      const bounds=gameBounds(),p={x:bounds.x+G.clamp(saved.x,0,1)*bounds.w,y:bounds.y+G.clamp(saved.y,0,1)*bounds.h};
      const fit=safeFloating(ctx,node,p,true)||safeFloating(ctx,node,p,false);
      if(fit){moveFloating(ctx,node,{x:fit.x,y:fit.y-24},false);
        const img=node.querySelector('img'),src=pose(ctx,false);if(img.getAttribute('src')!==src)img.src=src;return;}
      // A transient overlay or a temporarily unmeasurable viewport cannot
      // replace the player's saved floating anchor with the scene spawn.
      floatingLayer(ctx,node);syncFloatingVisibility();return;
    }
    if(node.classList.contains('v2a-floating')){node.classList.remove('v2a-floating');ctx.scene.appendChild(node);
      const layer=ui.el.querySelector('.v2a-whale-layer');if(layer)layer.remove();}
    if(ui._v2aSceneState!==ui.core.state||ui._v2aSceneBg!==ctx.sc.bg){
      ui._v2aSceneState=ui.core.state;ui._v2aSceneBg=ctx.sc.bg;
      ui._v2aWhalePoint=safeWhalePoint(ctx,saved&&saved.mode==='scene'&&saved.bg===ctx.sc.bg&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?saved:ctx.sc.spawn||{x:84,y:81});
    }
    // A view change reprojects the existing anchor; it is not a character move.
    // Focused labels may differ from the full-map layout, so avoid continuously
    // relocating a saved actor merely because the camera has been changed.
    if(!layoutOnly&&!ui._v2aOfficeFocused){const p=safeWhalePoint(ctx,ui._v2aWhalePoint);if(p)ui._v2aWhalePoint=p;}
    moveWhale(ctx,ui._v2aWhalePoint);
    const img=node.querySelector("img"),src=pose(ctx,false);if(img.getAttribute("src")!==src)img.src=src;
  }
  function pod(ctx) {
    let node=ctx.scene.querySelector('.embodied-pod');
    if(!modern()){if(node)node.remove();return;}
    if(!node){node=document.createElement('div');node.className='embodied-pod';node.setAttribute('aria-label','鲸鱼娘休眠仓，等待模型开智');
      node.innerHTML='<img src="resource/character/whale_pod.webp" alt="封闭的休眠仓" draggable="false"><span>休眠中 · 等待开智</span>';ctx.scene.appendChild(node);}
    const point=G.project(ctx.sc.pod||ctx.sc.spawn||{x:84,y:81},ctx.g);
    node.style.left=point.x+'px';node.style.top=point.y+'px';node.style.height=(ctx.g.h*((ctx.sc.pod||{}).h||29)/100)+'px';
    const info=ui.core.embodiedAwakening&&ui.core.embodiedAwakening();
    if(info){node.title=ui.core.state.planDone?info.requirements.map(d=>d.label+' '+d.value+' / '+d.target).join(' · '):'先正式立项，再训练具身能力；达到开智条件后才会出舱';}
  }
  function refresh(){
    const current=ui.el&&ui.el.querySelector(".office-scene"),d=ui._v2aDrag;
    if(d&&(!d.ctx.scene.isConnected||d.ctx.scene!==current)){
      if(d.frame)window.cancelAnimationFrame(d.frame);
      ui._v2aDrag=null;ui._clickHandled=true;ui._pressTarget=null;
      const old=whaleNode(d.ctx);if(old)old.classList.remove('v2a-dragging');
      try{if(old)old.releasePointerCapture(d.id);}catch(_){}
      ui._v2aWhalePoint=safeWhalePoint(d.ctx,d.latest)||d.p;
    }
    if(ui._v2aReturnFrame&&(!ui._v2aReturnScene||!ui._v2aReturnScene.isConnected||ui._v2aReturnScene!==current)){
      window.cancelAnimationFrame(ui._v2aReturnFrame);ui._v2aReturnFrame=0;ui._v2aReturnScene=null;
    }
    const ctx=context();syncFloatingVisibility();
    if(!ctx)return;ctx.scene.classList.add("v2a-scene");
    backdrop(ctx);viewControl(ctx);
    ctx.scene.style.setProperty('--v2a-screen-unit',String(ctx.g.cw/ctx.rect.width));
    // Chrome must have its final bounds before text placement, including the
    // first frame of an arrival, font load or camera change.
    if(window.OfficePause)OfficePause.decorate(ui);
    if(window.WhaleAutoCare)WhaleAutoCare.decorate();
    markers(ctx);whale(ctx);
    // Font/label measurement can settle the scene rectangle during this pass.
    // Re-anchor screen chrome to that final window, never move names around it.
    if(window.OfficePause)OfficePause.decorate(ui);
    if(window.WhaleAutoCare)WhaleAutoCare.decorate();
  }
  for(const name of ["renderOffice","updateOfficeMain","applyUiScale"]){const original=ui[name];
    ui[name]=function(){const result=original.apply(this,arguments);refresh();return result;};}
  const onClick=ui.onClick;
  ui.onClick=function(e){
    const button=e&&e.target&&e.target.closest&&e.target.closest('[data-action="office-view"],[data-action="office-speed-toggle"]');
    if(!button)return onClick.apply(this,arguments);
    this._clickHandled=true;this._pressTarget=null;
    if(e.preventDefault)e.preventDefault();if(e.stopPropagation)e.stopPropagation();
    if(button.disabled||!this.core.state||this.core.state.phase!=='office')return;
    if(window.SFX)window.SFX.play('click');
    if(button.dataset.action==='office-speed-toggle'){
      if(window.OfficeSpeed)window.OfficeSpeed.toggle(this.core);
      return;
    }
    setFocused(!this._v2aOfficeFocused);
  };
  for(const event of ["blur","resize"])window.addEventListener(event,()=>{if(ui._v2aCancelDrag)ui._v2aCancelDrag();if(window.WhaleAutoCare&&ui._whaleAutomationActor)WhaleAutoCare.cancel(ui.core);if(event==='resize')refreshLayout();});
  if(window.visualViewport)for(const event of ['resize','scroll'])window.visualViewport.addEventListener(event,refresh);
  if(document.fonts&&document.fonts.addEventListener)document.fonts.addEventListener('loadingdone',refreshLayout);
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&ui._v2aCancelDrag)ui._v2aCancelDrag();});
  function syncFloatingVisibility(){const layer=ui.el&&ui.el.querySelector('.v2a-whale-layer');
    if(!layer)return;
    layer.hidden=!ui.core||!ui.core.state||ui.core.state.phase!=='office';
    const blocked=!!(ui.core&&ui.core.state&&ui.core.state.officeModal)||Array.from(ui.el.querySelectorAll(transientLayers)).some(node=>{
      if(node.hidden||node.closest('[hidden]'))return false;
      const r=node.getBoundingClientRect();return r.width>0&&r.height>0;
    });
    layer.classList.toggle('v2a-overlay-blocked',blocked);
    const pet=layer.querySelector('.v2a-whale');if(pet)pet.tabIndex=0;
  }
  // Event and save overlays can open without an office tick. Observe only node
  // insertion/removal; never rewrite the original modal or its stacking rules.
  if(window.MutationObserver){const watch=new window.MutationObserver(changes=>{
    if(changes.some(change=>change.type==='childList'||change.target.matches&&change.target.matches(transientLayers)))syncFloatingVisibility();
  });
    watch.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','style']});}
  function refreshLayout(){const previous=layoutOnly;layoutOnly=true;try{refresh();}finally{layoutOnly=previous;}}
  window.V2OfficeScene={refresh,refreshLayout,context,projection,setFocused,pointer,moveWhale,markers,safeWhalePoint,whaleNode,gameBounds,safeFloating,returnHome};
})();
