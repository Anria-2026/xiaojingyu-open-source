/* V4+ 多 Agent 评审演出。只消费引擎已生成的题目与 evaluate()，不修改任何评分/经营状态。 */
(function () {
  "use strict";
  const sessions = new WeakMap();
  const LABELS = { code: "代码工程", text: "语言理解", safety: "安全核验", stability: "稳定测试", memory: "长程记忆", reasoning: "推理规划", tool: "工具协作" };
  const int = (n) => Math.round(Number(n) || 0);
  const motionReduced = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function allowed(ui) {
    const order = (ui.core.cfg.VER_ORDER || ["V1", "V1.5", "V2", "V2.5", "V3", "V3.5", "V4", "V4.5"]);
    const threshold = order.indexOf("V4"), current = order.indexOf(ui.core.state.ver);
    return threshold >= 0 && current >= threshold;
  }
  function stopTimer(run) {
    if (run && run.timer != null) { clearInterval(run.timer); run.timer = null; }
  }
  function stop(ui) {
    const run = sessions.get(ui);
    stopTimer(run);
    if (run && run.pages) run.pages.dispose();
  }
  /* [feature:agent-review-pages] */
function pages(ui,run){if(run.pages&&!run.pages.closed)return;const root=run.root,grid=root.querySelector(".agent-window-grid"),bar=root.querySelector(".agent-orchestrator");const nav=document.createElement("span");nav.className="agent-page-controls";nav.style.cssText="display:flex;align-items:center;gap:4px;flex-shrink:0";nav.innerHTML='<button type="button" aria-label="\u4E0A\u4E00\u7EC4 Agent">\u2039</button><b aria-live="polite"></b><button type="button" aria-label="\u4E0B\u4E00\u7EC4 Agent">\u203A</button>';bar.appendChild(nav);const prev=nav.firstElementChild,next=nav.lastElementChild,label=nav.querySelector("b");[prev,next].forEach(b=>{b.style.cssText="width:26px;height:26px;padding:0;border:1px solid #b8e5f7;border-radius:7px;background:#fff;color:#2789c4;font:inherit;cursor:pointer"});label.style.cssText="min-width:27px;text-align:center;font-variant-numeric:tabular-nums";bar.style.gap="6px";grid.style.overflow="hidden";grid.style.gridAutoRows="minmax(0,1fr)";run.lanes.forEach(lane=>{lane.question.style.cssText="display:block;-webkit-line-clamp:unset;overflow:auto;max-height:3.1em;min-height:1.55em";lane.answer.parentElement.style.cssText="overflow:auto;flex:1;min-height:1.6em";lane.answer.style.cssText="display:block;-webkit-line-clamp:unset;overflow:visible"});const pager=run.pages={page:0,size:run.lanes.length,closed:false,frame:0};const show=()=>{const count=Math.ceil(run.lanes.length/pager.size);pager.page=Math.min(Math.max(0,pager.page),count-1);run.lanes.forEach((lane,i)=>{lane.el.style.display=Math.floor(i/pager.size)===pager.page?"":"none"});nav.style.display=count>1?"flex":"none";label.textContent=pager.page+1+"/"+count;prev.disabled=pager.page===0;next.disabled=pager.page+1===count};pager.layout=()=>{if(pager.closed||!root.isConnected)return;const short=innerWidth>innerHeight&&innerHeight<500;root.style.display=short?"grid":"";root.style.gridTemplateAreas=short?'"head result" "bar bar" "lanes lanes" "foot foot"':"";root.style.gridTemplateColumns=short?"minmax(0,1.25fr) minmax(0,1fr)":"";root.style.gridTemplateRows=short?"auto auto minmax(0,1fr) auto":"";root.style.gap=short?"8px":"";root.style.padding=short?"12px 16px":"";[".agent-review-head",".agent-review-result",".agent-orchestrator",".agent-window-grid",".agent-review-foot"].forEach((selector,i)=>{root.querySelector(selector).style.gridArea=short?["head","result","bar","lanes","foot"][i]:""});root.querySelector(".agent-live").style.display=short?"none":"";run.lanes.forEach(lane=>{lane.el.querySelector(".agent-window-body").style.cssText=short?"padding:6px;gap:4px":"";lane.el.querySelector("header").style.padding=short?"6px 9px":"";lane.question.style.maxHeight=short?"1.55em":"3.1em"});const anchor=pager.page*pager.size,style=getComputedStyle(grid);const columns=Math.max(1,style.gridTemplateColumns.trim().split(/\s+/).length),gap=parseFloat(style.rowGap)||0;pager.size=Math.min(run.lanes.length,columns*Math.max(1,Math.floor((grid.clientHeight+gap)/(200+gap))));pager.page=Math.floor(anchor/pager.size);show()};const resize=()=>{if(!pager.closed&&!pager.frame)pager.frame=requestAnimationFrame(()=>{pager.frame=0;pager.layout()})};prev.onclick=()=>{pager.page--;show()};next.onclick=()=>{pager.page++;show()};window.addEventListener("resize",resize);pager.dispose=()=>{if(pager.closed)return;pager.closed=true;window.removeEventListener("resize",resize);if(pager.frame)cancelAnimationFrame(pager.frame);prev.onclick=next.onclick=null;nav.remove()};pager.layout()}
  /* [/feature:agent-review-pages] */
  function buildLanes(qs) {
    const lanes = Array.from({ length: Math.min(6, Math.max(1, qs.length)) }, (_, i) => ({ id: i, jobs: [], done: 0, active: -1 }));
    qs.forEach((q, i) => lanes[i % lanes.length].jobs.push(q));
    return lanes;
  }
  function render(ui) {
    stop(ui);
    const s = ui.core.state, es = s.evalShow || {}, qs = es.qs || [];
    const lanes = buildLanes(qs);
    const run = { lanes, qs, elapsed: 0, last: 0, timer: null, finished: false, result: s.result || ui.core.evaluate(), reduced: motionReduced() };
    sessions.set(ui, run);
    ui._evalSkin = "agents";
    ui._evalShown = 0;
    ui._evalPaused = false;
    const esc = (v) => ui.escHtml(v);
    const canSkip = (ui.core.cfg.EVAL_SHOW || {}).SKIPPABLE !== false;
    ui.el.innerHTML = `<section class="agent-review" aria-label="多 Agent 并行评审">
      <header class="agent-review-head">
        <span class="agent-review-symbol" aria-hidden="true">${ui.icon("sparkles", 24)}</span>
        <div><div class="agent-review-eyebrow">${esc(s.ver)} · AGENT WORKSPACE</div><h1>让协作，超越单个答案</h1><p>鲸鱼娘正在调度 ${lanes.length} 个 Agent，并行完成评审任务</p></div>
        <span class="agent-live"><i></i>并行运行</span>
      </header>
      <div class="agent-orchestrator"><span>${ui.icon("git-compare", 15)}任务编排</span><div class="agent-overall-track"><i></i></div><b class="agent-overall-count">0 / ${qs.length}</b></div>
      <div class="agent-window-grid">${lanes.map((lane) => {
        const first = lane.jobs[0] || {};
        return `<article class="agent-window" data-agent="${lane.id}" style="--agent-delay:${lane.id * 70}ms">
          <header><span class="agent-window-dots" aria-hidden="true"><i></i><i></i><i></i></span><b>AGENT ${String(lane.id + 1).padStart(2, "0")}</b><span class="agent-window-status">就绪</span></header>
          <div class="agent-window-body"><div class="agent-assignment">${esc(LABELS[first.dim] || "综合验证")}<small class="agent-job-count">0 / ${lane.jobs.length}</small></div>
          <p class="agent-question">等待任务分发…</p><div class="agent-answer" aria-label="Agent 输出"><span>正在建立协作通道</span><i class="agent-caret" aria-hidden="true"></i></div></div>
          <footer><span class="agent-job-phase">准备接收任务</span><div class="agent-task-track"><i></i></div><b class="agent-window-result" hidden></b></footer>
        </article>`;
      }).join("")}</div>
      <div class="agent-review-result" aria-live="polite"><div><span class="agent-result-label">汇总节点</span><strong class="agent-result-title">等待各 Agent 提交结果</strong><small class="agent-result-note">所有任务完成后，一次揭晓综合评分</small></div><div class="agent-score"><b>—</b><span>综合评分</span></div></div>
      <footer class="agent-review-foot"><button class="dg-btn dg-btn-ghost" data-action="eval-pause" id="evPauseBtn">⏸ 暂停阅读</button><button class="dg-btn dg-btn-primary" data-action="evalshow-done"${canSkip ? "" : " disabled"}>${canSkip ? "跳过 · 查看结果" : "正在评审…"}</button></footer>
    </section>`;
    lanes.forEach((lane) => {
      lane.el = ui.el.querySelector('[data-agent="' + lane.id + '"]');
      lane.status = lane.el.querySelector(".agent-window-status");
      lane.question = lane.el.querySelector(".agent-question");
      lane.answer = lane.el.querySelector(".agent-answer span");
      lane.phase = lane.el.querySelector(".agent-job-phase");
      lane.track = lane.el.querySelector(".agent-task-track i");
      lane.count = lane.el.querySelector(".agent-job-count");
    });
    run.root = ui.el.querySelector(".agent-review");
    run.state = s;
    run.ver = s.ver;
    ui.startEvalShowTimer();
  }
  function complete(ui, run) {
    run.finished = true;
    ui._evalShown = run.qs.length;
    stopTimer(run);
    run.lanes.forEach((lane) => {
      const hits = lane.jobs.filter((q) => q.ok).length;
      const badge = lane.el.querySelector(".agent-window-result");
      badge.hidden = false;
      badge.textContent = hits + " / " + lane.jobs.length + " 项通过";
      lane.el.classList.add("is-reported");
      lane.status.textContent = "已提交";
      lane.phase.textContent = "结果已汇入总评";
    });
    const root = ui.el.querySelector(".agent-review");
    if (!root) return;
    root.classList.add("is-complete");
    root.querySelector(".agent-live").textContent = "协作完成";
    root.querySelector(".agent-overall-count").textContent = run.qs.length + " / " + run.qs.length;
    root.querySelector(".agent-overall-track i").style.width = "100%";
    root.querySelector(".agent-score b").textContent = int(run.result.score);
    const verdicts = { top: "S · 顶尖表现", excellent: "A · 优秀表现", pass: "B · 达到目标", fail: "继续打磨，再次出发", veto: "发现短板，需要改进" };
    root.querySelector(".agent-result-title").textContent = verdicts[run.result.verdict] || "评审报告已生成";
    root.querySelector(".agent-result-note").textContent = /^(top|excellent|pass)$/.test(run.result.verdict)
      ? "综合评分按模型各项能力加权；查看本阶段结算结果"
      : "综合评分按模型各项能力加权；查看报告，寻找下一步改进方向";
    const button = root.querySelector('[data-action="evalshow-done"]');
    button.disabled = false;
    button.textContent = "查看评审结果 →";
    const pause = root.querySelector('[data-action="eval-pause"]');
    if (pause) { pause.disabled = true; pause.textContent = "✓ 协作完成"; }
    if (run.pages) run.pages.layout();

    if (window.SFX) window.SFX.play("confirm");
  }
  function advance(ui, run, elapsed) {
    let done = 0;
    const duration = run.reduced ? 900 : 2500;
    run.lanes.forEach((lane) => {
      const local = Math.max(0, elapsed - (run.reduced ? 0 : 280 * lane.id));
      const completed = Math.min(lane.jobs.length, Math.floor(local / duration));
      done += completed;
      lane.done = completed;
      lane.count.textContent = completed + " / " + lane.jobs.length;
      if (!lane.jobs.length) return;
      const index = Math.min(lane.jobs.length - 1, completed);
      const q = lane.jobs[index];
      const ratio = completed === lane.jobs.length ? 1 : (local % duration) / duration;
      if (lane.active !== index) {
        lane.active = index;
        lane.question.textContent = ui.tpl(q.q || "综合能力验证");
        lane.el.classList.add("is-working");
      }
      const text = String(ui.tpl(q.ok ? q.good || "验证通过" : q.bad || "发现需要改进的回答"));
      lane.answer.textContent = ratio < .22 ? (q.material ? "读取材料，提取关键上下文…" : "拆解目标，规划执行步骤…")
        : (run.reduced ? text : text.slice(0, Math.max(1, Math.ceil(text.length * Math.min(1, (ratio - .22) / .58)))));
      lane.phase.textContent = ratio < .22 ? "解析任务" : ratio < .8 ? "独立执行 · 生成回答" : "交叉核验 · 提交结果";
      lane.status.textContent = completed === lane.jobs.length ? "等待汇总" : ratio < .22 ? "规划中" : ratio < .8 ? "执行中" : "核验中";
      lane.track.style.width = Math.round(ratio * 100) + "%";
      lane.el.classList.toggle("is-waiting", completed === lane.jobs.length);
    });
    const root = ui.el.querySelector(".agent-review");
    if (!root) { stop(ui); return; }
    root.querySelector(".agent-overall-count").textContent = done + " / " + run.qs.length;
    root.querySelector(".agent-overall-track i").style.width = (run.qs.length ? Math.round(done / run.qs.length * 100) : 100) + "%";
    if (done >= run.qs.length) complete(ui, run);
  }
  function start(ui) {
    const run = sessions.get(ui);
    stopTimer(run);
    if (run && run.root.isConnected) pages(ui, run);
    if (!run || run.finished || ui._evalWaitTut) return;
    run.last = performance.now();
    run.timer = setInterval(() => {
      if (ui.core.state !== run.state || ui.core.state.ver !== run.ver || ui.core.state.phase !== "review" || !run.root.isConnected) { stopTimer(run); if (run.pages) run.pages.dispose(); return; }
      const now = performance.now();
      // 暂停或退到后台时，不追补这一段演出时间；与办公室倍速完全独立。
      if (!ui._evalPaused && !document.hidden) run.elapsed += Math.min(250, Math.max(0, now - run.last));
      run.last = now;
      if (!ui._evalPaused && !document.hidden) advance(ui, run, run.elapsed);
    }, 100);
  }
  window.AgentReview = { allowed, render, start, stop };
})();
