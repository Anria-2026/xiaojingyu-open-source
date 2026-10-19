/* Keep the original reward bars; page complete dimension columns on narrow screens. */
(function () {
  'use strict';
  const ui=window.GameUI;if(!ui||window.EmbodiedReview)return;
  let run=null;
  const active=()=>!!(ui.core?.state&&ui.core.embodiedAvailable?.(ui.core.state));
  function bindContentPages(r){const pages=ui._rewardPages?.stages.get(1);if(!pages||pages._embodiedChart===r)return;pages._embodiedChart=r;const show=pages.show;pages.show=function(){const value=show.apply(this,arguments);r.layout();return value;};}
  function dispose(){if(!run)return;run.closed=true;window.removeEventListener('resize',run.resize);if(run.frame)cancelAnimationFrame(run.frame);run.nav.firstElementChild.onclick=run.nav.lastElementChild.onclick=null;run.nav.remove();run=null;}
  function mount(){
    const root=ui.el?.querySelector('.aqua-stage'),bars=root?.querySelector('#bars');
    if(!active()||!bars){dispose();return;}
    if(run&&run.bars===bars&&!run.closed){bindContentPages(run);run.layout();return;}
    dispose();const columns=[...bars.querySelectorAll('.bar-col')],legend=root.querySelector('.chart-legend');if(!columns.length||!legend)return;
    const nav=document.createElement('nav');nav.className='read-pages-nav dimension-pages-nav';nav.setAttribute('aria-label','模型维度分页');nav.style.cssText='width:100%;margin-top:4px';
    nav.innerHTML='<button type="button" class="dg-btn dg-btn-sm" aria-label="上一组模型维度">上一组</button><span aria-live="polite"></span><button type="button" class="dg-btn dg-btn-sm" aria-label="下一组模型维度">下一组</button>';legend.appendChild(nav);
    const prior=ui.core.state.embodiedChartPage||0,r={bars,root,state:ui.core.state,columns,nav,page:prior,size:columns.length,closed:false,frame:0};run=r;
    const prev=nav.firstElementChild,next=nav.lastElementChild,label=nav.querySelector('span');
    r.show=page=>{if(r.closed)return;r.page=Math.max(0,Math.min(Math.ceil(columns.length/r.size)-1,Number(page)||0));
      columns.forEach((col,i)=>{const hidden=Math.floor(i/r.size)!==r.page;col.hidden=hidden;col.style.display=hidden?'none':'';});
      const count=Math.ceil(columns.length/r.size),shown=Math.min(r.size,columns.length-r.page*r.size);bars.style.gridTemplateColumns='repeat('+shown+',minmax(0,1fr))';
      nav.hidden=count<=1;nav.style.display=count<=1?'none':'flex';label.textContent='维度 '+(r.page+1)+' / '+count+' · 共 '+columns.length+' 项';prev.disabled=r.page===0;next.disabled=r.page+1>=count;
    };
    r.layout=()=>{if(r.closed||!bars.isConnected)return;const width=bars.clientWidth;if(width<=0)return;
      const gap=parseFloat(getComputedStyle(bars).columnGap)||14,anchor=r.page*r.size;r.size=Math.max(1,Math.min(columns.length,Math.floor((width+gap)/(88+gap))));r.page=Math.floor(anchor/r.size);r.show(r.page);
    };
    const click=delta=>{if(r.closed||run!==r||r.state!==ui.core.state||r.state.phase!=='bonus'||!nav.isConnected)return;r.show(r.page+delta);r.state.embodiedChartPage=r.page;if(ui.save?.autoSave)ui.save.autoSave(r.state);};prev.onclick=()=>click(-1);next.onclick=()=>click(1);
    r.resize=()=>{if(r.closed||r.frame)return;r.frame=requestAnimationFrame(()=>{r.frame=0;r.layout();});};window.addEventListener('resize',r.resize);
    r.show(prior);r.layout();
    bindContentPages(r);
  }
  const pages=ui.mountRewardPages;ui.mountRewardPages=function(){const value=pages.apply(this,arguments);mount();return value;};
  const render=ui.render;ui.render=function(){if(run&&(run.state!==this.core.state||this.core.state.phase!=='bonus'))dispose();return render.apply(this,arguments);};
  window.EmbodiedReview={mount,dispose};
})();
