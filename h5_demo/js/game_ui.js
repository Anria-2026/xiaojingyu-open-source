/* ==========================================================================
   大模型研发养成玩法 —— UI 层（二次元可爱风，DOM 渲染 + 事件委托）
   --------------------------------------------------------------------------
   渲染入口：#devgame-render（在训练界面 #training 内）
   交互：事件委托监听 data-action / data-event / data-opt / data-slot
   状态流：recruit → buygpu → direction → loop(报告/事件/微调) → review → over
   任何有效操作后自动存档（GameSave.autoSave）。
   ========================================================================== */
"use strict";

/* 竖屏设计盒宽度（设计像素，2026-09-15 手机竖屏适配）：
   取「手机可用宽」量级 → scale = 可用宽/340 ≈ 1.0，桌面那套 12px/11px 字号按设计值
   原样渲染（清晰可见），且设计盒高度按容器比例推导 → 竖屏基本铺满、无 letterbox。 */
const PORTRAIT_BOX_W = 340;

window.GameUI = {
  el: null,             // #devgame-render
  core: null,           // GameCore
  save: null,           // GameSave
  _modal: null,         // 当前模态（存档界面等）
  _candPage: 0,         // 招聘页人物卡当前页码
  _candPages: 1,        // 总页数（每页 2 张，窄竖屏 1 张）
  /* 团队一览每页人数（**渲染与翻页必须共用这一个数**）。
     2026-09-13 用户定 6：8 行会让列表溢出列表盒、压到下方翻页按钮上
     （全局「二级界面禁滚动条」规则把 .team-list 的 overflow:hidden 击穿成 visible，
     详见 style.css 里 .team-list 那段注释）。
     2026-09-16 修 BUG：当时只改了 omTeam 的 per，**omTeamPage 漏改仍是 8** ——
     两处不一致 ⇒ 点「下一页」后按 8 人重排：7~8 人的队 pages 从 2 掉到 1，
     _teamPage 被 clamp 回 0 ⇒ slice(0,8) 把本该在下一页的人渲染到当前页最下方
     （6 行 → 8 行）⇒ 溢出压住翻页按钮 —— 正是玩家报的「没翻页，
     反而把下一页的人直接塞进当前页最下方、和按钮区域重叠」。 */
/* [feature:team-short-landscape-capacity-20261013] */
  get TEAM_PER_PAGE() { return window.innerWidth > window.innerHeight && window.innerHeight <= 450 ? 3 : 6; },
/* [/feature:team-short-landscape-capacity-20261013] */

  /* 点击反馈音分类（用户 2026-08-29「点击选项的时候加音效，反馈感更强」）：
     列在这里的 action 代表「决策落子」，用上扬的 confirm；其余（展开选人行 / 翻页 / 关闭）
     用短促的 click。统一在 onClick 入口播，各 case 内不再单独播，避免一个操作叠两声。 */
  CLICK_SFX_HEAVY: {
    "event-opt": 1, "direction": 1, "buy-tier": 1, "target": 1, "finetune": 1,
    "advance": 1, "name-confirm": 1, "finish": 1, "hire": 1, "act-target": 1,
    "to-review": 1, "go-buygpu": 1, "go-direction": 1, "newgame": 1,
  },

  init(core, save) {
    this.core = core;
    this.save = save;
  /* [feature:office-production-layer-init-20261013] */
    this.el = document.getElementById("devgame-render");
    if (!this.el) return;
    this.installOfficeProductionLifecycle();
  /* [/feature:office-production-layer-init-20261013] */
    // 事件委托
    this.el.addEventListener("click", (e) => this.onClick(e));
    /* 2026-09-12（用户实测「点翻页却触发辞退」）：记下**按下**那一刻的目标。
       面板正文会在 tick / 换人时重建，浏览器此时把 click 派发到「按下与松开的共同祖先」
       （常常是卡片本身 → 表现成"点了没反应"）；若中间恰好重算了 zoom，落点还会落到
       另一个按钮上 → 误触发（辞退/录用是真执行的）。onClick 里用它兜底。
       捕获阶段监听，保证在 game_ui 自己的任何处理之前拿到。 */
    this.el.addEventListener("pointerdown", (e) => {
      /* 2026-09-23：按压序号 —— 80ms 补发定时器触发时要核对「期间没有更新的按压」，
         否则快速连点时旧定时器会拿着**别人的** _pressTarget 补发（重复执行 / 张冠李戴） */
      this._pressSeq = (this._pressSeq || 0) + 1;
      this._pressTarget = e.target;
      this._pressX = e.clientX; this._pressY = e.clientY;
    }, true);
    /* 2026-09-16（用户反馈「立项参数 34B / 存档删除按钮有时候点不动」）：
       老 iOS（< Safari 13）**没有 Pointer Events** → pointerdown 不触发 → _pressTarget
       永远为 null → 整套按压兜底在老设备上全废（而老设备正是重建竞争的重灾区）。
       补 touchstart 同源记录（touches[0] 取坐标）；支持 Pointer Events 的设备上两个
       事件都会派发，写的是同一个值，无害。 */
    this.el.addEventListener("touchstart", (e) => {
      const t0 = (e.changedTouches || e.touches || [])[0];
      if (!t0) return;
      this._pressSeq = (this._pressSeq || 0) + 1;   // 与 pointerdown 同一个序号源
      this._pressTarget = e.target;
      this._pressX = t0.clientX; this._pressY = t0.clientY;
    }, true);
    /* 2026-09-12：**指针抬起兜底**。面板正文在按下与松开之间被重建时，浏览器可能
       **根本不给 click**（真机实测：按住翻页按钮 → 中途重建 → 松开 → 0 个 click 事件，
       于是「点了没反应」；反过来落点漂到别的按钮上就是「误触发辞退」）。
       这里在 pointerup 后 80ms 内没等到 click 就用「按下的那个目标」补发一次；
       位移超过 8px（拖拽/滚动）不算点击，避免误伤。 */
    this.el.addEventListener("pointerup", (e) => {
      this._pressUpX = e.clientX; this._pressUpY = e.clientY;
      this._pressUpCheck(e.clientX, e.clientY);
    }, true);
    /* 2026-09-16：老 iOS 补 touchend 通道（同 pointerup 语义，changedTouches[0] 取坐标） */
    this.el.addEventListener("touchend", (e) => {
      const t0 = (e.changedTouches || [])[0];
      if (!t0) return;
      this._pressUpX = t0.clientX; this._pressUpY = t0.clientY;
      this._pressUpCheck(t0.clientX, t0.clientY);
    }, true);
    /* 指针在面板卡片上时冻结「自适应缩放」：绝不把用户脚下的按钮挪走。
       （进入/离开成对判断，relatedTarget 还在卡片内就不算离开） */
    const setInCard = (v) => {
      if (this._pointerInCard === v) return;
      this._pointerInCard = v;
      /* 移开后再补算一次（异步，避免"改 zoom → 重新命中测试 → 再触发 pointerover"的自喂） */
      if (!v) setTimeout(() => { try { this.fitModalBody(); } catch (e) { /* 忽略 */ } }, 120);
    };
    this.el.addEventListener("pointerover", (e) => {
      if (e.target && e.target.closest && e.target.closest(".modal-card")) setInCard(true);
    });
    this.el.addEventListener("pointerout", (e) => {
      const to = e.relatedTarget;
      if (!(to && to.closest && to.closest(".modal-card"))) setInCard(false);
    });
    // 窗口缩放时重算 UI 比例（界面适配：所有 UI/背景/场景随窗口缩放）
    if (!this._resizeBound) {
      this._resizeBound = true;
      window.addEventListener("resize", () => {
  /* [feature:naming-pages-resize-20261013] */
        this.applyUiScale(); this.invalidateFit(); this.fitModalBody();
        if(this.core&&this.core.state&&this.core.state.phase==="naming"&&this._namingPer!==this.namingPerPage())this.renderNaming();
  /* [/feature:naming-pages-resize-20261013] */
  /* [feature:paper-page-capacity-resize] */
        if(this.core&&this.core.state.phase==="office"&&this.core.state.officeModal==="paper"&&this._paperPer!==this.paperPerPage())this.refreshOfficeBody();
  /* [/feature:paper-page-capacity-resize] */
  /* [feature:recruit-codex-capacity-resize] */
        if(this.el&&this.el.querySelector("#codexPop")&&this._cdxPer!==this.codexPerPage()){this._cdxPage=Math.floor((this._cdxPage||0)*(this._cdxPer||3)/this.codexPerPage());this.openCodexPop();}
        /* 旋转屏/地址栏收放时，媒体查询与布局在同一帧里换挡 —— 立刻再量一次太早，
           下一帧补算一遍（幂等，无副作用），避免竖屏首次进办公室时留一格旧尺寸。 */
  /* [/feature:recruit-codex-capacity-resize] */
        if (this._scaleRAF) cancelAnimationFrame(this._scaleRAF);
        this._scaleRAF = requestAnimationFrame(() => { this._scaleRAF = 0; this.applyUiScale(); });
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        /* 2026-09-16：通用确认弹窗 append 在最后 = 视觉最上层 → Esc 优先关它
           （closeModal 只关 DOM 里第一个 mask，会关掉底下的存档/说明弹窗而留上层）。 */
        if (this._confirmOpen) { this.closeConfirm(); return; }
        this.closeModal();
      }
    });
  },

  /* 启动玩法：有自动存档则恢复，否则开新档 */
  launch() {
    const s = this.core.state;
    const auto = this.save.load("auto");
    if (auto && auto.state && auto.state.phase) {
      /* [feature:cloud-launch-restore-lock] */
      const tc = window.ToyCloud;
      if (tc && tc.beginRestore) tc.beginRestore();
      try { this.core.restore(auto.state); }
      finally { if (tc && tc.endRestore) tc.endRestore(); }
      /* [/feature:cloud-launch-restore-lock] */
    } else if (!s || !s.phase) {
      this.core.newGame();
    }
    this._tickFails = 0; this._tickRecovered = false;   // 新会话重置自动兜底状态
    this._modal = null;
    this.render();
  },

  /* ---------------- 渲染入口 ----------------
     opts.soft = true 表示「同屏局部更新」（打卡 / 选微调 / 翻页 / 展开选人行 / 关弹窗），
     不重播页面进场动画，否则每点一下整页都抖一下；阶段切换等场景才播完整过渡。
     详见 style.css「全局过渡动画体系」。 */
  /* [feature:reward-content-pages-render-lifecycle] */
  render(opts) {
    if (!this.el) return;
    const s = this.core.state;
  /* [feature:office-readable-pages-render-cleanup] */
    if(s.phase!=="bonus")this.disposeRewardPages();
    if(this._officeReadPages&&(s.phase!=="office"||s.officeModal!==this._officeReadPages.key||this._officeReadPages.state!==s))this.disposeOfficeReadPages();
  /* [/feature:office-readable-pages-render-cleanup] */
  /* [/feature:reward-content-pages-render-lifecycle] */
  /* [feature:modal-content-pages-render-lifecycle] */
    const soft = !!(opts && opts.soft);
    if(this._modalPages&&(this._modalPages.kind!==this._modal||this._modalPages.state!==s))this.disposeModalPages();
  /* [/feature:modal-content-pages-render-lifecycle] */
    /* 2026-08-30：清掉所有 append 型浮层（教学 / 说明 / 团队 / 存档 / 辞退确认 / 已招聘）。
       这些是 innerHTML+= / insertAdjacentHTML 挂上的，office 主体改成只换 #officeMain 后
       不再随 render 重建，必须显式清；render 分派末尾会按 state 重新挂载该显示的那个。
       注意：无条件执行（含 soft）——否则点「知道了」走 soft render 时弹窗不会消失。
       例外：辞退确认弹窗（2026-09-12 用户反馈「每 tick 都会重置消失」）——它挂在自己的
       action 上，不随 render 重挂，这里跳过删除让它跨 tick 存活，确认/取消时单独移除。 */
    this.el.querySelectorAll(".dg-modal-mask").forEach((el) => {
      if (el.classList.contains("dg-fire-modal")) return;
      if (el.classList.contains("dg-confirm-modal")) return;   // 2026-09-16：通用确认弹窗同样跨 tick 存活
      /* 2026-09-23 修 BUG（玩家：存档界面开着时后台 tick 一刷新，删除等按钮就点不动，必须刷新）：
         存档弹窗**不再走「每 render 删掉重建」**。旧流程两个死法：
           ① 手势竞争——重建把玩家手指下的 DOM 换掉，浏览器把 click 派发到共同祖先，
              命中 mask 的 close-modal ⇒ 点「删除」变成「关闭」；
           ② 遮罩反转——重建用 insertAdjacentHTML(beforeend) 追加到末尾，排到了
              「确认删除」小弹窗（.dg-confirm-modal 免清理、留在原位）的**上面**，
              从此确认键被存档弹窗的遮罩盖住，怎么点都点不到。
         改为：开着期间原节点原地保留（内容刷新由改动动作显式摘掉重建，
         见 removeSlot / cloudUploadNow / cloudForget）。 */
      if (el.id === "saveModal" && this._modal === "save" && s.phase === "office") return;
      el.remove();
    });
    /* 2026-09-16（用户「工程师的气泡又不出来了」根因）：这行原本无条件执行 ——
       办公室每 ~10s 一个产出 tick 都会 render({soft:true})（1121 行）→ 气泡定时器
       每次都被清掉重排，30~60s 的倒计时永远活不到触发 → 气泡一次都出不来。
       改成只在真正离开办公室（phase ≠ office）时停；timer 回调自带
       phase/officePaused/officeModal 检查，在办公室期间常驻是安全的。 */
    if (s.phase !== "office") this.stopBubbleTimer();
    this.stopTestTypewriter();
    this.stopEvalShowTimer();  // 评审答题动画：离开该屏就停，避免泄漏
    /* V3.5.2 只保留四个阶段：命名 / 办公室 / 评审 / 结算 / 终局。
       旧阶段（loop / recruit / buygpu / direction / minigame / evalshow）一律归一到办公室——
       旧存档直入旧界面会导致「菜单点不开、不能重新开始」（用户 2026-09-01 反馈），
       且该旧 UI 已在 doc/14 §14 退役。 */
    /* [feature:v5-direct-review-phase] */
    /* [feature:v5-review-skip-fitness-phase] */
    // The sports module remains available for authored previews; gameplay commits the real review directly.
    if (s.phase === "review" && s.result && this.core.embodiedAvailable && this.core.embodiedAvailable(s)) this.settleEmbodiedReview();
    /* [/feature:v5-review-skip-fitness-phase] */
    /* [/feature:v5-direct-review-phase] */
    const phase = s.phase;
    /* 2026-09-04：三幕结算回归浅蓝基调（旧 stage-night 夜色已删，视觉 100% 来自 demo）；
       离开该阶段立刻停掉所有演出定时器（DOM 已重建，动画不能在旧节点上跑）。 */
    if (phase !== "bonus") this.clearBonusTimers();
    /* 2026-09-04：评审 / 结算界面单独配乐（BGM 配置可改，留空沿用主场景曲） */
    this.switchBgm(phase);
    if (!s.v35) { this.renderNaming(); return; }         // 旧档/未初始化 → 回到命名页（可重新开始）
    if (phase === "naming") this.renderNaming();
    else if (phase === "office") {
      /* 2026-09-05：小游戏并入办公室二级面板「数据定期巡检」，总结也在面板里展示，
         不再劫持一级界面（旧 _mgSummary 全屏分支已删）。 */
      this.renderOffice();
    }
    else if (phase === "minigame") { s.phase = "office"; this.renderOffice(); }  // 旧一级界面小游戏已废止 → 归一回办公室
    else if (phase === "review") {
      /* 评审答题动画：若有未看过的评审说明（t_review）→ 先弹说明，看完（关闭）才开播动画 */
      this._evalWaitTut = false;
      this.renderEvalShow();
      const rtut = this.core.tutorialPending();
      if (rtut) { this._evalWaitTut = true; this.renderTutorialModal(rtut); this.stopEvalShowTimer(); }
    }
    else if (phase === "bonus") this.renderBonus();
    else if (phase === "over") this.renderOver();
    else { s.phase = "office"; this.renderOffice(); }    // 任何旧阶段 → 归一到新办公室 UI
    // 模态（存档界面 / 说明面板）；都没有时，若该阶段有没看过的教学步骤则自动弹一次
    /* 2026-09-23：存档弹窗改成「缺了才建」——开着期间 tick render 不再动它（见上方清理注释）。
       各改动动作（save/delete/cloud）会显式摘掉旧节点，走这里重建出最新列表。 */
    if (this._modal === "save") {
      if (!this.el.querySelector("#saveModal")) this.renderSaveModal();
    }
    else if (this._modal === "help") this.renderHelpModal();
    else if (this._modal === "team") this.renderTeamModal();
    else if (phase === "office") {
      /* 新 UI：二级面板（团队/招聘/立项/攻关/论文/算力/测试/评审/说明）挂在 office 主界面之上。
         没有面板时要显式清空 #modalContainer——它不随 render 重建。 */
      if (s.officeModal) {
        this.renderOfficeModal(s.officeModal);
        const modalTut = this.core.tutorialPending();
        if (modalTut) this.renderTutorialModal(modalTut);
      } else {
        this.closeOfficeModal();
        const tut2 = this.core.tutorialPending();
        if (tut2) this.renderTutorialModal(tut2);
      }
    }
    else if (phase !== "review") {
      const tut = this.core.tutorialPending();
      if (tut) this.renderTutorialModal(tut);
    }
    // 已招聘 / 辞退确认弹窗不随 render 重挂（避免闪动），由各自 action 独立控制；
    // render 会重建 el.innerHTML 使弹窗 DOM 消失，此处同步重置标志位，否则下次打不开。
    // 2026-09-12：辞退确认弹窗已豁免清理（跨 tick 存活）→ 只有它真不在 DOM 里才重置标志位。
    if (!this.el.querySelector(".dg-fire-modal")) this._fireOpen = false;
    /* 2026-09-16：通用确认弹窗同款标志位同步（render 重建 DOM 后弹窗消失，别让 _confirmOpen 卡死） */
    /* [feature:cloud-confirm-orphan-cancel] */
    if (!this.el.querySelector(".dg-confirm-modal")) {
      const cancel = this._confirmCancel;
      this._confirmOpen = false; this._confirmCb = null; this._confirmCancel = null;
      if (cancel) cancel();
    }
    /* [/feature:cloud-confirm-orphan-cancel] */
    // 页面级进场动画（软更新跳过）
    if (!soft) this.playPageIn();
    /* 2026-08-30 彩条过渡：一级界面切换时彩色圆角彩条从左下扫向右上 */
    if (!soft) this.playTransition();
  },

  /* 按阶段切 BGM：评审（review）/ 结算演出（bonus）各有一条独立音轨。
     两个槽位留空时回落主场景曲，因此不配也不会没声音。
     同一个 URL 不重复切（playBgm 内部会作废在途请求，重复调用会打断正在播的曲子）。 */
  switchBgm(phase) {
    const A = window.AudioMgr, U = window.BGM_URLS;
    if (!A || !A.playBgm || !U) return;
    const want = (phase === "review" && U.review)
      || (phase === "bonus" && U.bonus)
      || U.scene || U.menu;
    if (!want || want === this._curBgm) return;
    this._curBgm = want;
    A.playBgm(want);
  },

  /* 重播页面进场动画：先摘 class 再强制重排，否则连续两次同名动画不会重新触发 */
  playPageIn() {
    if (!this.el) return;
    const board = this.el.querySelector(".dg-board");
    if (!board) return;
    board.classList.remove("dg-page-in");
    void board.offsetWidth;
    board.classList.add("dg-page-in");
  },

  /* 左侧置顶数值侧栏：品牌(星级)/算力/代码/文字/安全/稳定，从上到下，各带数值条。
     2026-08-28：数值条按「阶段上限」归一（旧版按 0-100 归一，上限 60 时永远填不满），
     并在条上画出该阶段的评审达标线刻度，让玩家随时知道"还差多少才算过"。 */

  /* 顶部布局壳：左侧置顶数值侧栏 + 顶部灵动岛（周数/经费/操作）。
   返回未闭合到 <div class="dg-main-body">，各 render 模板末尾需补 </div></div></div> */

  /* 每页人物卡数量：窄竖屏 1 张（翻页），其余 2 张并排（demo 同款） */
  candPerPage() {
    try {
      const pp = window.matchMedia("(max-width: 520px) and (orientation: portrait)");
      if (pp.matches) return 1;   // 真机窄竖屏：每页 1 张翻页；其余一律每页 2 张并排
    } catch (e) {}
    return 2;
  },

  /* 立绘图片源：按决策界面类型（uiType）取立绘（界面立绘配置页可配覆盖），
     兜底用 fixed 立绘；没有配置则回退默认。 */
  portraitSrc(uiType) {
    const c = this.core ? this.core.cfg : null;
    const ports = (c && c.UI_PORTS) || {};
    return ports[uiType] || ports.fixed || ports.default || "resource/character/简历求过.webp";
  },

  /* 决策界面类型元信息（名称/图标/标签样式类） */
  uiTypeMeta(uiType) {
    const c = this.core ? this.core.cfg : null;
    const T = (c && c.UI_TYPES) || {};
    return T[uiType] || T.fixed || { name: uiType || "固定", icon: "", cls: "u-fixed" };
  },
  uiTypeName(uiType) { return this.uiTypeMeta(uiType).name; },

  /* ---------------- 决策后：训练时间流逝动画 ----------------
     玩家每次关键决策（启动方向 / 推进双周 / 事件结算）后播放，让玩家感知时间流逝：
     顶部放大版时间轴（只显示本阶段半年窗口，起点从 V1 开始研发）+ 立绘轮播 PPT（间隔可配）
     + 齿轮转动音效 +「模型训练中」。
     灵感爆发（08 设计文档 §7.2）：动画期间随机 0~SPARK_MAX 名工程师发光，
     点击发光头像 → 该工程师本轮贡献额外成长（applySpark 结算）；亦可点「跳过」直接结束。
     动画播完后需点击「继续」才渲染下一状态 / 下一事件。 */
  trainAnim(cb) {
    if (this._trainAnim) return;   // 动画进行中，忽略重复调用（遮罩已挡住按钮，双保险）
    this._trainAnim = true;
    const s = this.core.state;
    const cfg = this.core.cfg || {};
    const ms = cfg.TRAIN_ANIM_MS || 3000;          // 动画总时长（毫秒，可配置）
    const portMs = cfg.TRAIN_PORT_MS || 1500;      // 立绘每张切换间隔（毫秒，可配置）
    const week = s.week || 0;
    const currentPct = this.weekPct(week);
    const list = this.trainPortraits();

    // 灵感爆发：动画开始时只随机一次；仅在有发光者时展示交互区
    const sparkIds = (this.core.pickSparks && typeof this.core.pickSparks === "function")
      ? this.core.pickSparks() : [];
    const activeEngs = s.engineers.filter((e) => !e.resigned);
    // 跳过按钮：仅当配置允许当前模型版本跳过时才渲染（V1 全程必须看完动画）
    const skipVers = cfg.TRAIN_SKIP_VERSIONS || ["V2", "V3", "V4"];
    const canSkip = skipVers.includes(s.ver || "V1");
    const sparkTimers = [];
    const sparkHTML = (sparkIds.length && activeEngs.length) ? `
        <div class="dg-spark-hint">💡 点击发光的工程师，触发灵感爆发！</div>
        <div class="dg-spark-row">${activeEngs.map((e) => `
          <button class="dg-spark-card${sparkIds.includes(e.id) ? " lit" : ""}" type="button" data-spark="${e.id}">
            ${e.avatar ? `<img class="dg-spark-avatar" src="${e.avatar}" alt="">` : `<span class="dg-spark-emoji">${this.typeIcon(e.type)}</span>`}
            <span class="dg-spark-name">${e.name}</span>
          </button>`).join("")}</div>` : "";

    const overlay = document.createElement("div");
    overlay.className = "dg-train-anim";
    overlay.innerHTML = `
      <div class="dg-train-inner">
        <div class="dg-tl">
          <div class="dg-tl-track">
            <div class="dg-tl-line"></div>
            <div class="dg-tl-fill" style="width:${(currentPct * 100).toFixed(1)}%"></div>
            <div class="dg-tl-dot" style="left:${(currentPct * 100).toFixed(1)}%"></div>
            <div class="dg-tl-marks">${this.trainMarks()}</div>
          </div>
          <div class="dg-tl-dates">
            <span id="dg-tl-now" class="dg-tl-now">${this.trainDateAt(0)}</span>
            <span class="dg-tl-week">第 <b>${week}</b> 周</span>
          </div>
        </div>
        <div class="dg-train-stage">${list.map((src, i) =>
          `<img class="dg-train-stage-img${i === 0 ? " active" : ""}" src="${src}" alt="">`).join("")}</div>
        <div class="dg-train-label">
          ${this.icon("gear", 21)}
          <span class="dg-train-label-text">模型训练中</span>
          <span class="dg-train-dot"></span>
        </div>
        ${sparkHTML}
        ${canSkip ? `<button class="dg-train-skip" type="button">跳过 ▶</button>` : ""}
        <button class="dg-continue-btn" type="button" hidden>${this.icon("chevR", 16)} 已就绪，点击继续</button>
      </div>`;
    document.body.appendChild(overlay);

    // 立绘轮播（PPT 交叉淡入淡出），切换间隔 = TRAIN_PORT_MS（可配置）
    let idx = 0;
    const imgs = overlay.querySelectorAll(".dg-train-stage-img");
    const timer = setInterval(() => {
      idx = (idx + 1) % list.length;
      imgs.forEach((im, i) => im.classList.toggle("active", i === idx));
    }, Math.max(400, portMs));

    // 齿轮转动音效
    if (window.SFX && SFX.gearLoop) SFX.gearLoop(ms, 0.5);

    // 灵感爆发：被选中的工程师立即进入可点击的发光态（BUG 修复 2026-08-29：
    // 原来要等 0.5~1.5s 的 setTimeout 才加 .lit，玩家在点亮前点击毫无反应 = 「点不动」。
    // 发光动画改由 CSS dg-spark-glow 做入场渐变，点击与发光解耦——只要卡片亮了就能点。）

    // 时间轴：日期从起点计数到当前周，指示点从 0 扫向当前进度
    const dot = overlay.querySelector(".dg-tl-dot");
    const fill = overlay.querySelector(".dg-tl-fill");
    const nowLb = overlay.querySelector("#dg-tl-now");
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      const nowPct = currentPct * p;
      if (dot) dot.style.left = (nowPct * 100).toFixed(1) + "%";
      if (fill) fill.style.width = (nowPct * 100).toFixed(1) + "%";
      if (nowLb) nowLb.textContent = this.trainDateAt(nowPct);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    // 收尾：停轮播/定时器、移除遮罩、渲染下一状态
    const cleanup = () => {
      clearInterval(timer);
      sparkTimers.forEach(clearTimeout);
      // 先淡出再移除（用户 2026-08-29：直接 remove 会硬切、观感像闪屏）。
      // 新页面此时已在遮罩下方淡入，两层交叠 = 交叉过渡，时间流逝的收尾才连贯。
      this._trainAnim = false;      // 立即解锁，避免淡出的 0.26s 内被判定为「动画中」
      overlay.classList.add("dg-anim-out");
      setTimeout(() => overlay.remove(), 280);
      if (cb) cb();
    };
    // 动画播完：停轮播、把「模型训练中」改为「训练完成」、亮起继续按钮
    const done = () => {
      clearInterval(timer);
      const lb = overlay.querySelector(".dg-train-label-text");
      if (lb) lb.textContent = "训练完成";
      const btn = overlay.querySelector(".dg-continue-btn");
      if (btn) btn.hidden = false;
      const skip = overlay.querySelector(".dg-train-skip");
      if (skip) skip.remove();
    };
    overlay.addEventListener("click", (e) => {
      // 「已就绪，点击继续」→ 进入下一状态 / 下一事件
      if (e.target.closest(".dg-continue-btn")) { cleanup(); return; }
      // 「跳过」→ 立即结束动画（不等播完），同样进入下一状态
      if (e.target.closest(".dg-train-skip")) { cleanup(); return; }
      // 点击发光工程师 → 灵感爆发结算（同一人一轮仅一次）
      const card = e.target.closest(".dg-spark-card.lit");
      if (card && !card.classList.contains("dg-spark-used")) {
        const res = this.core.applySpark ? this.core.applySpark(card.dataset.spark) : null;
        if (res) {
          card.classList.add("dg-spark-used");
          if (window.SFX) SFX.play("ui");
          const fl = document.createElement("span");
          fl.className = "dg-spark-float";
          fl.textContent = res.parts && res.parts.length ? `💡 ${res.parts.join(" ")}` : "💡 灵感一闪";
          card.appendChild(fl);
          setTimeout(() => fl.remove(), 1300);
        } else {
          // 已用过 / 本轮无可结算成长：也标灰，避免玩家反复点同一张卡却毫无反馈
          card.classList.add("dg-spark-used");
        }
      }
    });
    setTimeout(done, ms);
  },

  /* 进度比例：当前周在总时间轴（0~TOTAL_WEEKS）中的位置 0~1 */
  weekPct(week) {
    const total = Math.max(1, (this.core.cfg && this.core.cfg.TOTAL_WEEKS) || 24);
    return Math.min(1, Math.max(0, (week || 0) / total));
  },
  /* 时间轴：只显示「本阶段半年」窗口并放大。起点 = 从 V1 开始研发（默认 2023-06-26），
     终点 = 起点 + windowMonths 个月（默认 6 = 半年）。TRAIN_TIMELINE 可配置 startDate / windowMonths。 */
  trainAnchor() {
    const tl = (this.core.cfg && this.core.cfg.TRAIN_TIMELINE) || {};
    const start = this.parseDate(tl.startDate || "2023-06-26");
    const months = Math.max(1, (tl.windowMonths != null ? tl.windowMonths : 6));
    const end = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
    return { start, end };
  },
  /* 解析 "YYYY-MM-DD" → Date */
  parseDate(s) {
    const p = String(s).split("-").map((x) => parseInt(x, 10));
    const y = p[0] || 2023, m = (p[1] || 1) - 1, d = p[2] || 1;
    return new Date(y, m, d);
  },
  /* 时间轴上某进度(0~1)对应的日期：起点→终点 线性插值 */
  trainDateAt(p) {
    const a = this.trainAnchor();
    const t = a.start.getTime() + Math.min(1, Math.max(0, p)) * (a.end.getTime() - a.start.getTime());
    const d = new Date(t);
    return d.getFullYear() + "." + this.pad2(d.getMonth() + 1) + "." + this.pad2(d.getDate());
  },
  pad2(n) { return String(n).padStart(2, "0"); },
  /* 时间轴月份刻度（起点当月 ~ 终点当月）。无固定「终点版本」标记 —— 终点即配置的 endDate。 */
  trainMarks() {
    const a = this.trainAnchor();
    const span = a.end.getTime() - a.start.getTime();
    const marks = [];
    const m = new Date(a.start);
    m.setDate(1);
    /* 最小间距过滤（BUG 修复 2026-08-29）：起点之前的月份算出来是负数、会被 clamp 到 0，
       于是「起点前 N 个月」全叠在 0% 位置，最左侧出现一堆年月数字互相覆盖。
       改成按间距抽稀：与上一个已渲染刻度相距不足 MIN_GAP% 的直接跳过。 */
    const MIN_GAP = 9;
    let lastPos = -Infinity;
    while (m <= a.end) {
      const pos = Math.max(0, Math.min(100, Math.round(((m.getTime() - a.start.getTime()) / span) * 100)));
      if (pos - lastPos >= MIN_GAP) {
        marks.push(`<i class="dg-tl-mark" style="left:${pos}%"><span>${m.getFullYear()}.${this.pad2(m.getMonth() + 1)}</span></i>`);
        lastPos = pos;
      }
      m.setMonth(m.getMonth() + 1);
    }
    return marks.join("");
  },
  /* 训练立绘轮播列表（2026-09-03：外部配置项已删，直接用内置默认鲸鱼立绘） */
  trainPortraits() {
    return [
      "resource/character/叉腰.webp",
      "resource/character/比耶.webp",
      "resource/character/大拇哥.webp",
      "resource/character/看书.webp",
      "resource/character/笨笨的.webp",
      "resource/character/讨饭.webp",
      "resource/character/躺1.webp",
      "resource/character/简历求过.webp",
    ];
  },

  /* 统一决策界面模板：左侧数值侧栏（hud 已含）+ 中立绘 + 右侧内容。
     所有决策环节（招聘/买卡/方向/报告/事件/微调/评审）复用，保证布局一致。
     o = { kicker, title, sub, uiType, tag, headRight, children } */

  /* 文案模板：把占位符换成真实值（开局命名 2026-08-28；2026-09-19 收敛到 core.fillVars）
     ⚠️ 支持 {model}/{param}/{arch}/{archName}/{archId} —— 与聊天内容、新闻**同一把尺子**。
     ⚠️ **绝不转义**：TUTORIAL 文案里合法地写着 `<b>`（22 处）；转义由各渲染点自己做。
     ⚠️ 这里**不再留第二份替换实现**：全仓只允许 core.fillVars 一处（test_txt_vars.js 有断言守）。 */
  tpl(str) {
    if (this.core && this.core.fillVars) return this.core.fillVars(str);
    return String(str == null ? "" : str);   // 没 core（理论上不会）→ 原样返回，不静默吃内容
  },

  /* ---------------- 开局：给模型起名字（用户 2026-08-28 补充）----------------
     立项前的第一步。名字会跟着模型走完所有评审、新闻和结局，所有文案的
     {model} 占位符统一替换成它。留空 / 全空白 → 回退默认名。 */
  /* ==========================================================================
     办公室主界面（2026-08-30 新 UI · 对标《游戏发展国》）
     --------------------------------------------------------------------------
     布局完全复用 demo（doc/pages/小鲸鱼UI重构demo/pages/office.html）：
       顶部灵动岛（周数/品牌/经费/语料 + 存档/暂停/设置/说明）
     + 左侧行动列（团队/招聘/立项/攻关/论文/算力/测试/评审）
     + 办公室场景（员工头像按座位坐标摆放，产出满 → 发光）
     + 底部（模型四维数值 + 待收产出/全部收集）
     ========================================================================== */

  /* 左侧行动列定义（顺序 = demo；badge / countdown 由状态推导） */
  officeActions() {
    const s = this.core.state;
    const perWeek = (this.core.cfg.OFFICE || {}).ROUNDS_PER_WEEK || 7;
    const v35on = this.core.v35On && this.core.v35On();
    const focusLocked = false;   // 2026-09-03：攻关已不受「一测失败/入职 tick」锁定，立项后即开放（只卡语料门槛+经费）
    const testable = v35on && s.planDone && (s.week || 0) >= 3;
    /* 新手教学门（guidePending）：当前卡住的必要操作挂红 badge，时间暂停直到完成 */
    const guide = this.core.guidePending && this.core.guidePending();
    const list = [
      { key: "team", icon: "users", label: "团队" },
      /* 2026-09-03 二改：扩编入口挪进「招聘」面板右下角（发布需求），原位置换成新闻页（吃瓜） */
      { key: "news", icon: "news", label: "吃瓜",
        count: (s.newsUnread || 0) > 0 ? s.newsUnread : null },
      { key: "recruit", icon: "briefcase", label: "招聘",
        count: Math.max(0, (s.candidates || []).length) },
      { key: "plan", icon: "file", label: "立项",
        badge: guide && guide.key === "plan" ? "待立项" : (s.planDone ? null : "待立项") },
      { key: "focus", icon: "target", label: "攻关",
        badge: focusLocked ? "未解锁" : null,
        countdown: s.focusBoost ? Math.max(1, Math.ceil(s.focusBoost.roundsLeft / perWeek)) : null },
      { divider: true },
      { key: "corpus", icon: "database", label: "语料",
        badge: (this.core.v35On && this.core.v35On() && s.v35 && s.v35.gapState !== "ok") ? "缺口" : null },
      { key: "paper", icon: "book", label: "论文",
        badge: (!s.paperResearch && (s.paperCandidates || []).filter((id) => !this.core.hasPaper(id)).length > 0) ? "可研究" : null,
        countdown: s.paperResearch ? this.core.paperWeeksLeft() : null },
      { key: "shop", icon: "cpu", label: "算力",
        badge: guide && guide.key === "shop" ? "待采购" : null },
      { key: "test", icon: "chat", label: "测试",
        /* 「可测试」提示：本版本进行过一次测试后就消失（2026-09-03 用户反馈），跨阶段自动重现 */
        badge: testable && s.testBadgeVer !== (s.ver || "V1") ? "可测试" : null },
      { key: "review", icon: "shield", label: "评审",
        badge: this.core.canReview() ? "可评审" : null },
    ];
    /* UI 配置可改左侧按钮排列顺序（UI_CFG.actions = 有序 key 列表；
       divider 为分组分隔线占位。未配置的按钮按默认顺序补在后面，漏配不会丢按钮）。 */
    const uicfg = (this.core.cfg || {}).UI_CFG || {};
    if (Array.isArray(uicfg.actions) && uicfg.actions.length) {
      const byKey = {};
      list.forEach((it) => { byKey[it.divider ? "divider" : it.key] = it; });
      const out = [];
      uicfg.actions.forEach((k) => {
        if (byKey[k]) { out.push(byKey[k]); delete byKey[k]; }
      });
      Object.keys(byKey).forEach((k) => out.push(byKey[k]));
      return out;
    }
    return list;
  },

  modelDims(state) {
    const s = state || this.core.state;
    return this.core.displayDims ? this.core.displayDims(s) : this.core.dimsOf(s).map(key => ({key, label:this.core.statLabel(key), sources:[key]}));
  },
  /* [feature:corpus-unit-method-20261016] */
  /* 语料量级简化（2026-10-16）：单位为「亿 token」；≥1 万亿（10000 亿）时只保留整数万亿，省略以后 */
  officeIslandEvent() {
    const dividend = this.core.state.v35 && this.core.state.v35.dividend;
    return !!(dividend && dividend.left > 0);
  },
  officeDateLabel(compact) {
    if (compact == null) compact = !!this.el.querySelector('.island-topbar.island-compact');
    const full = this.dateLabel(this.absWeek());
    return compact ? full.replace(new RegExp(this.core.cfg.UI_CFG.ISLAND.YEAR_PREFIX_PATTERN), '') : full;
  },
  officeCorpusUnit(unit, compact) {
    if (compact == null) compact = !!this.el.querySelector('.island-topbar.island-compact');
    return compact ? unit.replace(new RegExp(this.core.cfg.UI_CFG.ISLAND.TOKEN_SUFFIX_PATTERN, 'i'), '') : unit;
  },
  fitOfficeIsland() {
    const island = this.el.querySelector('.island-topbar');
    if (!island || !island.clientWidth) return;
    const s=this.core.state, date=this.dateLabel(this.absWeek()), corpus=this.core.v35On()?this.corpusDisplay(s.corpus):null;
    const key=[island.clientWidth,window.innerWidth>window.innerHeight,date,s.funding,s.brand,s.corpus,s.fiscalDeficit,this.officeIslandEvent(),document.fonts&&document.fonts.status].join('|');
    if(island._fitKey===key)return;
    island._fitKey=key;
    island.classList.remove('island-compact');
    const dateEl=island.querySelector('#ob-date'),unitEl=island.querySelector('.corpus-chip i'),numEl=island.querySelector('#ob-corpus');
    if(dateEl)dateEl.textContent=date;
    if(corpus&&unitEl)unitEl.textContent=corpus.unit;
    if(corpus&&numEl)numEl.textContent=corpus.num;
    // Test the rendered full copy. Flexible padding/icons and subpixel rounding
    // are harmless; only an actual clipped group/chip/text or overflow compacts.
    const nodes=[island,...island.querySelectorAll('.top-left,.island-status,.top-right,.week-chip,.brand-chip,.money-chip,.corpus-chip,.chip-warn,.chip-dividend,.week-chip>span,.money-chip>span,.corpus-chip>span')];
    const compact=nodes.some(node=>node.clientWidth>0&&node.getClientRects().length>0&&node.scrollWidth>node.clientWidth+1);
    island.classList.toggle('island-compact',compact);
    if(dateEl)dateEl.textContent=this.officeDateLabel(compact);
    if(corpus&&unitEl)unitEl.textContent=this.officeCorpusUnit(corpus.unit,compact);
  },
  corpusDisplay(n) {
    const v = Number(n) || 0;
    return v >= 10000 ? { num: Math.floor(v / 10000), unit: " 万亿 token" } : { num: Math.round(v), unit: " 亿 token" };
  },
  /* [/feature:corpus-unit-method-20261016] */
  modelValue(key, state) { return this.core.displayValue ? this.core.displayValue(key, state) : Number((state || this.core.state)[key]) || 0; },
  modelCap(key) { return this.core.displayCap ? this.core.displayCap(key) : this.core.statCap()[key] || 0; },
  modelPass(key) { const p=this.core.passLine(); return this.core.displayPass ? this.core.displayPass(key) : Number(p[key] ?? (p.axMin || {})[key]) || 0; },
  officePassMarker(key) {
    const value=this.modelPass(key), cap=this.modelCap(key);
    if (!(value>0) || !(cap>0)) return '';
    const pct=Math.max(0,Math.min(100,value/cap*100));
    const label=String((this.core.cfg.UI_CFG||{}).REVIEW_PASS_LABEL||'').replace('{value}',String(Math.ceil(value)));
    return '<span class="stat-pass-marker" style="left:'+pct+'%" title="'+this.esc(label)+'" aria-label="'+this.esc(label)+'"><i></i><span style="transform:translateX(-'+pct+'%)">'+this.esc(label)+'</span></span>';
  },
  modelLabel(key) { const d=this.modelDims().find(d=>d.key===key); return d ? d.label : this.core.statLabel(key); },

  renderOffice() {
    const s = this.core.state;
    const c = this.core.cfg;
    const sc = this.core.scene();
    const alive = s.engineers.filter((e) => !e.resigned);
    const cap = this.core.statCap();

    // --- 顶部灵动岛 ---
    const brandStars = this.brandStars(s.brand);
    const v35on = this.core.v35On && this.core.v35On();
    /* [feature:corpus-unit-display-20261016] */
    /* 语料单位随量级简化：超万亿（≥10000 亿）只显示「N万亿」，否则保持「N 亿 token」，防止撑破胶囊 */
    const corpusDisp = v35on ? this.corpusDisplay(s.corpus) : null;
    /* [/feature:corpus-unit-display-20261016] */
    const topbar = `
      <div class="island-topbar${this.officeIslandEvent() ? " has-event" : ""}">
        <div class="top-left">
          <div class="week-chip">${this.icon("calendar", 14)}<span id="ob-date">${this.officeDateLabel()}</span></div>
          <div class="brand-chip" title="${this.brandTip()}"><span id="ob-brand">${brandStars}</span><span class="island-verbose">品牌</span></div>
          <div class="money-chip">${this.icon("coins", 14)}<span><span class="island-verbose">经费 </span><b id="ob-funding">${fmtMoney(s.funding)}</b></span></div>
        </div>
        <div class="island-status">
          <div class="corpus-chip">${this.icon("database", 14)}<span><span class="corpus-label">语料 </span><b id="ob-corpus">${corpusDisp ? corpusDisp.num : Math.round(s.corpus || 0)}</b>${v35on ? "<i>"+corpusDisp.unit+"</i>" : "/" + this.core.corpusCap()}</span>${v35on ? `<span class="corpus-gap ${this.v35GapInfo().cls}" id="ob-gap">${this.v35GapInfo().label}</span>` : ""}</div>
          <div class="chip-warn" id="ob-warn"${s.fiscalDeficit > 0 ? "" : ' style="display:none"'}>⚠️ 欠薪 <span id="ob-deficit">${fmtMoney(s.fiscalDeficit || 0)}</span></div>
          <!-- 2026-09-12：事件角标（原「分红中 N%（剩 N 笔）」太长会把灵动岛其它胶囊挤变形）——
               收敛成「事件 + 感叹号」，点击弹出详情面板（进行中的事件影响，见 officeModalBody 的 dividend 分支） -->
          <button class="chip-dividend" id="ob-dividend" data-action="office-modal" data-id="dividend"${this.officeIslandEvent() ? "" : ' style="display:none"'} title="有事件进行中 · 点击查看详情">事件<i class="dv-bang">!</i></button>
        </div>
        <div class="top-right">
          <button class="island-btn icon-only" title="存档" data-action="open-save">${this.icon("save", 16)}</button>
          <button class="island-btn icon-only" id="ob-pause" title="${s.officePaused ? "继续" : "暂停"}" data-action="office-pause">${this.icon(s.officePaused ? "play" : "pause", 16)}</button>
          <button class="island-btn icon-only" title="设置" data-action="open-settings">${this.icon("settings", 16)}</button>
          <button class="island-btn icon-only" title="玩法说明" data-action="office-modal" data-id="guide">${this.icon("help", 16)}</button>
        </div>
      </div>`;

    // --- 左侧行动列 ---
    const actions = this.officeActions().map((a) => {
      if (a.divider) return `<div class="action-divider"></div>`;
      const on = s.officeModal === a.key;
      const badge = a.badge ? `<span class="btn-badge plan-badge">${a.badge}</span>` : "";
      const cd = a.countdown ? `<span class="countdown-badge">${a.countdown}</span>` : "";
      const cnt = a.count ? `<span class="count-badge">${a.count}</span>` : "";
      return `<button class="action-btn${on ? " active" : ""}" data-action="office-modal" data-id="${a.key}" title="${a.label}">
        ${this.icon(a.icon, 20)}<span class="btn-label">${a.label}</span>${badge}${cd}${cnt}
      </button>`;
    }).join("");

    // --- 办公室场景 + 员工标记 ---
    const seats = sc.seats || [];
    /* 2026-09-16 修「头像重叠」：座位统一走 core.resolveSeats()（修幽灵/重复/越界），
       映射缺位 = 真座位不够（老档超编遗留）→ 底部溢出网格，绝不与人撞位。 */
    const seatMap = this.core.resolveSeats();
    const markers = alive.map((e, i) => {
      const si = seatMap[e.id];
      const seat = (si != null ? seats[si] : null) || { x: 6 + (i % 6) * 17.5, y: 86 + Math.floor(i / 6) * 12 };
      const full = !!s.prodFullByEng[e.id];
      const st = this.engStatus(e);
      /* 2026-09-04：爆发中的人，marker 带上燃烧特效（判定按岗位槽，一人一岗） */
      const cls = (full ? "full " : "") + (this.isBursting(e) ? "bursting " : "")
        + this.statusCls(st).replace("st-", "");
      return `
        <div class="emp-marker ${cls}" style="top:${seat.y}%; left:${seat.x}%;" data-eng="${e.id}">
          <div class="emp-status ${this.statusCls(st)}">${st}</div>
          <button type="button" class="emp-avatar" data-action="om-arrange-menu" data-id="${e.id}" aria-label="安排工程师"><img src="${this.engAvatar(e)}" alt=""></button>
          <button type="button" class="emp-name" data-action="om-arrange-menu" data-id="${e.id}">${e.name}</button>
          <div class="emp-stamina">${this.icon("zap", 14)}<span>${this.engEnergy(e)}</span></div>
          ${this.flameSpans(e.id)}
        </div>`;
    }).join("");

    // --- 底部模型数值 + 收集 ---
    const statRow = (k) => {
      /* 2026-09-01：主状态数值一律按整数显示（浮点累加会产生 33.29999999999999 这类长尾小数）
         2026-09-10 doc/27 P3：改为**维度驱动** —— 本模型激活的追加轴（记忆/推理/工具）自动多一行，
         样式与四维逐位相同（同 .stat-item / .stat-bar），只是配色走配置里的 gradient。
         「未激活 = 零痕迹」：没轴的模型这里一格都不会多。 */
      const v = Math.round(this.modelValue(k, s));
      const c = this.modelCap(k) || 1;
      /* 上限也按整数显示（2026-09-15 截图复查）：轴上限是算出来的小数（如工具轴 215.1），
         和其它四位整齐的整数摆在一起很跳；进度条仍用精确值算，只改显示。 */
      const cTxt = Math.ceil(c);
      const pct = Math.max(0, Math.min(100, (v / c) * 100));
      const ax = this.core.v35AxisIds && this.core.v35AxisIds(s).indexOf(k) >= 0;
      const color=(this.modelDims(s).find(d=>d.key===k)||{}).color;
      const style = color ? 'background:'+color : this.core.dimBarStyle(k);
      return `
        <div class="stat-item${ax ? " stat-item-axis" : ""}" data-stat="${k}">
          <div class="stat-label"><span>${this.modelLabel(k)}</span><b id="ob-val-${k}">${v} / ${cTxt}</b></div>
          <div class="stat-bar"><span id="ob-pass-${k}">${this.officePassMarker(k)}</span><div class="stat-bar-fill ${this.core.dimBarClass(k)}" id="ob-bar-${k}"${style ? ` style="width:${pct.toFixed(1)}%;${style}"` : ` style="width:${pct.toFixed(1)}%"`}></div></div>
        </div>`;
    };
    const archName = ((c.ARCHITECTURES || []).find((a) => a.id === s.arch) || {}).name || "—";

    /* 新手教学门横幅：必要操作未完成时置顶提示（时间已暂停，完成即自动继续） */
    const guide = this.core.guidePending && this.core.guidePending();
    const guideBanner = guide ? `
      <div class="office-guide-banner" id="ob-guide">
        ${this.icon("help", 14)}<span>新手引导 · ${guide.tip}（完成前游戏暂停）</span>
      </div>` : `<div class="office-guide-banner" id="ob-guide" style="display:none"></div>`;

    const main = `
      ${topbar}
      ${guideBanner}
      <div class="main-area">
        <div class="action-col">${actions}</div>
        <div class="office-scene">
          <img class="office-bg" src="${sc.bg || "resource/scene/office_v1.webp"}" alt="办公室" draggable="false"
               onload="if(window.GameUI){window.GameUI.updateOfficeMain();window.GameUI.applyUiScale();}">
          <div class="office-overlay"></div>
          <div class="office-night" id="ob-night"></div>
          <div class="notice-stack" id="ob-notices"></div>
          <div class="employee-markers" id="ob-markers">${markers}</div>
          <div class="office-paused-tag" id="ob-pausedtag"${s.officePaused ? "" : ' style="display:none"'} title="点击继续" data-action="office-pause">⏸ 已暂停 · 点击继续</div>
        </div>
      </div>
      <div class="bottom-panel">
        <div class="model-stats">
          <div class="model-title">
            <div class="model-name">${this.tpl("{model}")} ${(this.core.modelCode() || "V1").toLowerCase()}</div>
            <div class="model-ver" id="ob-ver">${s.paramTarget || 7}B · ${archName}</div>
            <div class="model-sub" id="ob-plan">${s.planDone ? "已立项" : "尚未立项"}</div>
          </div>
          <div class="stats-grid">
            ${this.modelDims(s).map((d) => statRow(d.key)).join("")}
          </div>
        </div>
        ${v35on ? "" : `
        <div class="collect-zone">
          <div class="collect-info">
            <span class="collect-label">待收产出</span>
            <span class="collect-val" id="totalProd"><span id="ob-prod">${this.core.totalProd()}</span><span> 点</span></span>
          </div>
          <button class="skew-btn" data-action="collect-all" style="width:100%;height:42px">
            ${this.icon("download", 14)}<span>全部收集</span></button>
        </div>`}
      </div>`;

    /* 主体与弹窗容器解耦：只在首次进入（或阶段切换）时重建整页，
       之后每次 render 只替换 #officeMain。#modalContainer 不动，
       二级面板就不会跟着重播入场动画（用户反馈「点完又闪一下」的根因）。 */
    /* #modalContainer 必须挂在 .office-shell 下、.office-scale 之外：
       .office-scale 带 transform:scale(--ui-scale)，弹窗若在它里面会被二次放大，
       于是「比 demo 大一圈」且 max-height 算不准 → 内容被截（集体活动按钮看不到一半）。 */
    const shell0 = this.el.querySelector(".office-shell");
    if (shell0) {
      /* 双 #modalContainer 修复（2026-09-01）：officeMain 模板自带一个空 mc，
         soft render 重建时旧 mc（含现役弹窗）又被 appendChild 迁入 shell0 → 双 mc 共存，
         querySelector('#modalContainer') 可能命中空壳 → 弹窗空白且无法关闭（录用卡死根因）。
         处理：保留"最后一个"（迁移来的旧 mc，含现役内容），删除其余。 */
      const allMc = this.el.querySelectorAll("#modalContainer");
      if (allMc.length > 1) {
        const keep = allMc[allMc.length - 1];
        for (const m of allMc) if (m !== keep) m.remove();
      }
      const mc = shell0.querySelector("#modalContainer");
      if (mc && mc.parentElement !== shell0) shell0.appendChild(mc);   // 老 DOM 迁移
    }

    /* 2026-09-10 doc/27 P3：轴集合变了必须**重建** #officeMain ——
       主体是「只建一次 + 增量更新」的（为了不让背景图重解码），增量更新改不了行数，
       于是「立项换组合」后轴行不会出现（有轴却不显示 = 玩家以为没这个功能）。
       轴集合是立项时定的，一个阶段内不会变 → 用它的签名当"需要重建"的信号。 */
    const axSig = [s.ver,sc.bg,this.modelDims(s).map(d=>d.key).join(",")].join("|");
    if (this._axSig !== axSig) {
      this._axSig = axSig;
      const om = this.el.querySelector("#officeMain");
      if (om) om.remove();
    }

    const oldMain = this.el.querySelector("#officeMain");
    if (oldMain) {
      /* 增量更新：只改会变的文本/数字/徽标/员工标记，**不重建 DOM**。
         整块 innerHTML 重建会让 <img class="office-bg"> 重新解码 → 每次点按钮背景都闪一下。 */
      this.updateOfficeMain();
    } else {
      this.el.innerHTML = `
        <div class="app-shell office-shell">
          <div class="office-scale">
            <div id="officeMain">${main}</div>
          </div>
          <div id="modalContainer"></div>
        </div>`;
    }
    /* [feature:corpus-unit-chip-20261016] */
    /* 首帧就按量级落一次语料单位（后续 tick 由 updateOfficeMain 续更），避免先显示「亿」再跳「万亿」 */
    if (corpusDisp) { const ce = this.el.querySelector("#ob-corpus"); if (ce) ce.textContent = corpusDisp.num; const cu = this.el.querySelector(".corpus-chip i"); if (cu) cu.textContent = this.officeCorpusUnit(corpusDisp.unit); }
    /* [/feature:corpus-unit-chip-20261016] */

    this.startOfficeTimer();
    this.startOfficeBubbleTimer();
    this.applyUiScale();
    this.fitOfficeIsland();
    this.updateDayNight();   // 进办公室先按当前时刻落一次色，避免第一秒是白的再跳暗
  },

  /* 座位百分比 → 场景容器百分比。
     背景图用 object-fit:cover，宽高比与容器不一致时会裁切；座位坐标是「背景图上的百分比」，
     直接当容器百分比用会整体偏移。这里按 cover 的缩放/裁切补偿回去。 */
  seatPosPct(seat) {
    const scene = this.el.querySelector(".office-scene");
    const img = this.el.querySelector(".office-bg");
    if (!seat || !scene || !img || !img.naturalWidth || !img.naturalHeight) {
      return seat ? { x: seat.x, y: seat.y } : { x: 30, y: 30 };
    }
    const Cw = scene.clientWidth, Ch = scene.clientHeight;
    const Bw = img.naturalWidth, Bh = img.naturalHeight;
    if (!Cw || !Ch) return { x: seat.x, y: seat.y };
    const s = Math.min(Cw / Bw, Ch / Bh);          // contain 缩放比（全图可见，不裁边）
    const offX = (Cw - Bw * s) / 2, offY = (Ch - Bh * s) / 2;
    const bx = (seat.x / 100) * Bw, by = (seat.y / 100) * Bh;   // 背景图上的像素
    const cx = bx * s + offX, cy = by * s + offY;               // 容器里的像素
    return { x: (cx / Cw) * 100, y: (cy / Ch) * 100 };
  },

  /* 日期显示：XX年XX月 第X周
     起始年/月在玩法配置里可配（cfg.DATE.START_YEAR / START_MONTH），
     每月按 4 周推算：第 1-4 周落在起始月，第 5 周起进到下个月。 */
  dateLabel(week) {
    if (this.core.embodiedAvailable() && this.core.ensureBodyCalendar()) return this.core.calendarLabel(week);
    const d = this.core.cfg.DATE || {};
    const y0 = d.START_YEAR != null ? d.START_YEAR : 2023;
    const m0 = d.START_MONTH != null ? d.START_MONTH : 6;
    const w = Math.max(0, Math.floor(week || 0));
    const monthsPassed = Math.floor(w / 4);          // 每月 4 周
    const total = (m0 - 1) + monthsPassed;
    const year = y0 + Math.floor(total / 12);
    const month = (total % 12) + 1;
    const weekOfMonth = (w % 4) + 1;
    return year + "年" + month + "月 第" + weekOfMonth + "周";
  },

  /* 顶栏日历用：本局从开局算起的绝对周数 = 当前阶段周 + 之前阶段累计（2026-09-08）。
     进入新阶段时 s.week 归零，但 weekOffset 记着走过的总周数 → 日期连续向前，不跳回起始月。 */
  absWeek() {
    const s = this.core.state || {};
    return (s.week || 0) + (s.weekOffset || 0);
  },

  /* 界面适配：按容器大小等比缩放（横屏设计基准 1280×720，与 demo 观感一致）。
     场景背景用 object-fit:contain → 任何窗口尺寸都完整显示整张场景图（用户拍板：永不裁掉场景）。
     V3.5.x：场景比例动态化 —— 背景可能 1:1 / 4:3 / 其他，顶部灵动岛 / 底部模型胶囊 / 左行动列
     由 applySceneLayout 按背景实际比例算出 --scene-w/--scene-h，紧贴场景伸缩，背景永不裁边。
     ── 2026-09-15 竖屏适配：竖屏改用一套「窄设计盒」—— 设计宽固定 PORTRAIT_BOX_W（≈手机可用宽），
     设计高按容器实际宽高比推导（clamp 660~1200）。于是手机 scale≈1：桌面那套 12px/11px 字号按
     设计值**原样渲染**（清晰可见、不缩水），且设计盒比例已按容器比例推导 → 竖屏基本铺满、无留白；
     平板/大屏自然放大（1.6 封顶）。两套盒子都是「设计坐标 + 整体等比缩放」，所以布局算法、
     命中区、座位百分比、fitModalBody 全部沿用，不会挤压变形。 */
  applyUiScale() {
    const shell = this.el && this.el.querySelector(".office-shell");
    if (!shell) return;
    const elW = this.el.clientWidth || window.innerWidth || 1280;
    const elH = this.el.clientHeight || window.innerHeight || 720;
    const portrait = this.isPortrait();
    /* 竖屏改用 .office-shell 的 padding box 当「可用槽位」：this.el.clientWidth 含 padding
       （竖屏左右各 10 / 横屏各 14.4），会让设计盒比真实槽位宽约 20~28px → 内容被裁，
       父容器（overflow-y:auto）还会冒出 5px 滚动条，而滚动条又改变 clientWidth → 自激抖动。
       横屏沿用原口径（与历史行为逐像素一致 → 零回归）。 */
    const w = portrait ? (shell.clientWidth || elW) : elW;
    const h = portrait ? (shell.clientHeight || elH) : elH;
    /* 设计盒：横屏固定 1280×720（桌面/平板像素级不变，零回归）；竖屏窄盒 + 高度自适应容器比例 */
    let boxW = 1280, boxH = 720, minS = 0.35, maxS = 3;
    if (portrait) {
      boxW = PORTRAIT_BOX_W;
      boxH = Math.round(Math.max(660, Math.min(1200, boxW * (h / Math.max(1, w)))));
      minS = 0.8; maxS = 1.6;
    }
    /* 整体等比缩放：scale = min(宽/设计宽, 高/设计高)。两轴取较小值 → 永不变形；
       窗口只单轴变宽/变高时 scale 不变（只改留白），只有整窗成比例变化才跟随缩放。
       竖屏向下取整（floor）：设计盒乘完必须**完全装进**可用槽位，否则会溢出 1~3px
       → 父容器冒出滚动条 → clientWidth 变化 → 再触发重算（自激抖动）。 */
    const k = Math.max(minS, Math.min(maxS, Math.min(w / boxW, h / boxH)));
    const scale = (portrait ? Math.floor(k * 100) : Math.round(k * 100)) / 100;
    shell.style.setProperty("--ui-scale", String(scale));
    /* 设计盒尺寸写入内联：竖屏与横屏盒宽不同，CSS 的 width/height 读这两个变量 */
    shell.style.setProperty("--box-w", boxW + "px");
    shell.style.setProperty("--box-h", boxH + "px");
    this._portrait = portrait;
    /* 便于真机排查（F12 看 data-orient 就知道走的是哪套布局） */
    if (shell.dataset.orient !== (portrait ? "portrait" : "landscape")) {
      shell.dataset.orient = portrait ? "portrait" : "landscape";
    }
    /* 场景布局永远按「设计坐标」算（与 .office-scale 的盒子一致），
       不随窗口实时宽高变化 → X 轴单轴拉伸不再挤压灵动岛/进度条 */
    this.fitOfficeIsland();
    this.applySceneLayout(shell, boxW, boxH, scale);
  },

  /* 是否走竖屏布局：必须与 CSS 的 @media (orientation: portrait) 同判据 ——
     两边不一致时，JS 算的场景尺寸会和 CSS 的排布错配（场景被挤掉/留大片空白）。 */
  isPortrait() {
    try {
      if (window.matchMedia) return window.matchMedia("(orientation: portrait)").matches;
    } catch (e) { /* 忽略：回落到宽高比较 */ }
    return (window.innerWidth || 0) <= (window.innerHeight || 0);
  },

  /* 办公室场景贴配角：按「可用区 + 背景实际宽高比」算一个不裁边的场景框，
     写进 --scene-w / --scene-h，让顶部岛、底部模型条、左行动列跟随场景框伸缩。
     换背景图（比例变 1:1 / 4:3 / 其他）也会随 naturalWidth/Height 自动重算。
     ── 竖屏（2026-09-15）：排布变成「岛 → 行动区 → 场景 → 数值条」四段（见 CSS 竖屏 @media）。
     ★ 关键点：竖屏下岛的宽度、行动区的宽度都按「设计盒内容宽」定宽，**与 --scene-w 解耦** ——
     否则「行动区换行行数 → 行动区高 → 可用高 → 场景宽 → 行动区行数」会形成循环依赖（会自激抖动）。 */
  applySceneLayout(shell, w, h, scale) {
    if (!shell) return;
    const img = shell.querySelector(".office-bg");
    let r = 4 / 3;   // 背景未就绪时的退化比例（桌面基准下 4:3 稳妥）
    if (img && img.naturalWidth && img.naturalHeight) r = img.naturalWidth / img.naturalHeight;
    else if (this._bgRatio) r = this._bgRatio;
    /* [feature:v2a-scene-layout] */
    /* Keep original 4:3 chrome geometry while Q art is contained inside. */
    if (this.core && this.core.cfg && this.core.scene().layoutRatio) r = this.core.scene().layoutRatio;
    /* [/feature:v2a-scene-layout] */
    this._bgRatio = r;
    /* 竖屏用「同一张图的模糊放大」垫在场景框里（照片上下的富余由它填满，不留白）。
       把背景地址写进 --scene-bg 供 CSS 的 .office-scene::before 使用。 */
    if (img && img.getAttribute("src")) {
      shell.style.setProperty("--scene-bg", "url('" + img.getAttribute("src") + "')");
    }
    /* 布局发生在设计坐标系（.office-scale 的盒子），已由调用方传入设计尺寸，
       不再随窗口/scale 变化。 */
    const W = w || 1280, H = h || 720;
    const portrait = !!this._portrait;
    /* 垂直被非场景占掉 = 上下 padding(各10) + 岛高 + 底条高 + 两个 gap(各10)。
       island/bottom 高度用真实测量（offsetHeight 返回未缩放前的布局高，恰与 W/H 同坐标系）；
       测量不到时退回固定常量，换背景比例 / 底部内容变高都不会把场景挤掉。
       竖屏另需扣掉「行动区高 + 主区内 gap」，以及引导横幅可见时的高度（竖屏横幅在文档流里）。 */
    const islandEl = shell.querySelector(".island-topbar");
    const bottomEl = shell.querySelector(".bottom-panel");
    const actionEl = shell.querySelector(".action-col");
    const PAD = 10, PAD_X = 14, GAP = 10;
    const islandH = islandEl && islandEl.offsetHeight ? islandEl.offsetHeight : 48;
    const bottomH = bottomEl && bottomEl.offsetHeight ? bottomEl.offsetHeight : 96;
    let chromeV = PAD * 2 + islandH + bottomH + GAP * 2;
    /* 水平被非场景占掉：横屏 = 左 pad14 + 行动列 64 + gap12 + 右 pad14 = 104；竖屏只有左右 pad */
    let chromeH = PAD_X * 2 + 64 + 12;
    let actionH = 0;
    if (portrait) {
      chromeH = PAD_X * 2;
      actionH = actionEl && actionEl.offsetHeight ? actionEl.offsetHeight : 96;
      chromeV += actionH + 12;
      /* 引导横幅在竖屏是「浮层」（position:absolute，见 CSS 竖屏段）→ 不吃文档流高度，
         高度已由 --guide-top 定位在场景上缘，故这里不再从可用高里扣它。 */
      /* 二级面板安全区（真实像素 = 设计值 × scale）：竖屏下只避让岛与底部数值条，
         行动区允许被面板盖住（一级按钮与面板本就互斥）→ 给面板多留高度。 */
      shell.style.setProperty("--modal-top", Math.round((PAD + islandH + GAP) * scale) + "px");
      shell.style.setProperty("--modal-bottom", Math.round((PAD + bottomH + GAP) * scale) + "px");
    }
    const availW = W - chromeH;
    const availH = H - chromeV;
    if (availW < 40 || availH < 40) return;
    let sceneW = Math.max(40, Math.round(Math.min(availW, availH * r)));
    /* 边界吸附：可用宽与场景宽只差 1~3px（余量刚好差一点点）时，让场景**保住满宽** ——
       用户要求「X 轴完整显示」，而这 1~3px 是换行/取整带来的抖动；被它挤掉会让
       「场景 = 满宽」变成不确定值（实测 312 会时有时无）。少掉的几像素由卡片 flex-shrink 吃。 */
    if (availW - sceneW > 0 && availW - sceneW <= 3) sceneW = availW;
    const sceneH = Math.max(40, Math.round(sceneW / r));
    if (portrait) {
      /* 新手引导横幅浮在场景上缘（竖屏不再占一整行，也不再把场景挤小）：
         main-area 顶边 + 行动区高 + 组内 gap12 − 4px。
         2026-09-16 起场景框贴照片高、不再吃余量（余量给底部数值条）→ 主区里没有
         「余量/2」的居中偏移了，横幅直接压在场景顶边。
         ⚠️ −4（= 场景顶边再往上 4px）是用户 2026-09-15 真机调好的位置（他给的 top:255px
         正好等于本机型场景顶边 259 − 4），**不要再动**；写成相对量是为了换机型/换卡高也跟得住。 */
      const mainTop = PAD + islandH + GAP;
      shell.style.setProperty("--guide-top", Math.round(mainTop + actionH + 12 - 4) + "px");
    }
    if (shell.dataset.sw === String(sceneW) && shell.dataset.sh === String(sceneH)) return; // 无变化跳过
    shell.dataset.sw = String(sceneW); shell.dataset.sh = String(sceneH);
    shell.style.setProperty("--scene-w", sceneW + "px");
    shell.style.setProperty("--scene-h", sceneH + "px");
  },

  /* 办公室主体的增量刷新（配合 renderOffice 的解耦，做到「点按钮背景不闪」） */
  updateOfficeMain() {
    const el = this.el, s = this.core.state, c = this.core.cfg;
    const alive = s.engineers.filter((e) => !e.resigned);
    const setTxt = (id, v) => { const n = el.querySelector("#" + id); if (n && n.textContent !== String(v)) n.textContent = v; };
    const show = (id, on) => { const n = el.querySelector("#" + id); if (n) n.style.display = on ? "" : "none"; };

    // ① 顶栏
    const dateEl = el.querySelector("#ob-date");
    if (dateEl) {
      const txt = this.officeDateLabel();
      if (dateEl.textContent !== txt) dateEl.textContent = txt;
    }
    setTxt("ob-funding", fmtMoney(s.funding));
    /* 2026-09-12：事件角标（分红等进行中的事件影响）——文本收敛为「事件!」，
       详情改到点击后的面板里（officeModalBody 的 dividend 分支），这里只负责显隐 */
    const island = el.querySelector(".island-topbar");
    if (island) island.classList.toggle("has-event", this.officeIslandEvent());
    const dvEl = el.querySelector("#ob-dividend");
    if (dvEl) {
      const dv = (s.v35 && s.v35.dividend) || null;
      dvEl.style.display = (dv && (dv.left || 0) > 0) ? "" : "none";
    }
    if (s.lastDividend && s.lastDividend !== s._divToastSeen) {
      s._divToastSeen = s.lastDividend;
      this.toast("分红 −" + fmtMoney(s.lastDividend.cut));
    }
    /* [feature:corpus-unit-update-20261016] */
    const cd = this.core.v35On && this.core.v35On() ? this.corpusDisplay(s.corpus) : null;
    setTxt("ob-corpus", cd ? cd.num : Math.round(s.corpus || 0));
    const cUnit = el.querySelector(".corpus-chip i");
    if (cd && cUnit) cUnit.textContent = this.officeCorpusUnit(cd.unit);
    /* [/feature:corpus-unit-update-20261016] */
    const gapEl = el.querySelector("#ob-gap");
    if (gapEl) { const g = this.v35GapInfo(); gapEl.textContent = g.label; gapEl.className = "corpus-gap " + g.cls; }
    /* ⚠️ 目前全项目**没有任何调用方**（语料区间条已从办公室顶栏移走）——
       这段是「选择器永远匹配不到」的死更新块，留着只作参考，别再往里加逻辑。 */
    const barEl = el.querySelector("#ob-corpus-bar .cm-cursor");
    if (barEl && s.v35) {
      const need = this.core.corpusDemand();
      const pct = (Math.floor(s.v35.corpus.token) / Math.max(1, need)) * 100;
      barEl.style.left = Math.min(100, Math.min(pct, 130) / 1.3).toFixed(1) + "%";
    }
    const brand = el.querySelector("#ob-brand");
    if (brand) { brand.textContent = this.brandStars(s.brand); if (brand.parentElement) brand.parentElement.title = this.brandTip(); }
    show("ob-warn", (s.fiscalDeficit || 0) > 0);
    setTxt("ob-deficit", fmtMoney(s.fiscalDeficit || 0));
    this.fitOfficeIsland();
    const pause = el.querySelector("#ob-pause");
    if (pause) {
      pause.title = s.officePaused ? "继续" : "暂停";
      pause.innerHTML = this.icon(s.officePaused ? "play" : "pause", 16);
    }

    // ② 左侧行动列：选中态 / 徽标 / 倒计时 / 计数
    const perWeek = (c.OFFICE || {}).ROUNDS_PER_WEEK || 7;
    /* 新手教学门横幅同步（增量刷新） */
    const guideEl = el.querySelector("#ob-guide");
    if (guideEl) {
      const g = this.core.guidePending && this.core.guidePending();
      if (g) {
        guideEl.style.display = "";
        guideEl.innerHTML = this.icon("help", 14) + `<span>新手引导 · ${g.tip}（完成前游戏暂停）</span>`;
      } else guideEl.style.display = "none";
    }
    this.officeActions().forEach((a) => {
      const btn = el.querySelector('.action-btn[data-id="' + a.key + '"]');
      if (!btn) return;
      btn.classList.toggle("active", s.officeModal === a.key);
      /* ⚠️ 2026-09-13 修 BUG（用户：「所有界面动画不要因为刷 tick 而重置」）：
         原实现是「先把所有徽标全删掉，再按需重建」——而 `.countdown-badge` 挂着
         `badge-pulse`（2s 无限脉冲）→ 每 tick 删了重建 = 脉冲从 0 重播，
         左侧行动列的倒计时角标每几秒就"跳一下"，看起来像界面在重置。
         改成**就地复用**：节点还在就只改文本，缺了才新建，多的才删；
         顺序有变才重排（appendChild 对文档内节点是"移动"，不会重启动画）。 */
      const ensureBadge = (sel, cls, text) => {
        let n = btn.querySelector(sel);
        if (!n) { n = document.createElement("span"); n.className = cls; btn.appendChild(n); }
        const t = String(text);
        if (n.textContent !== t) n.textContent = t;
        return n;
      };
      const keep = [];
      if (a.badge) keep.push(ensureBadge(".plan-badge", "btn-badge plan-badge", a.badge));
      if (a.countdown) keep.push(ensureBadge(".countdown-badge", "countdown-badge", a.countdown));
      if (a.count) keep.push(ensureBadge(".count-badge", "count-badge", a.count));
      const curBadges = [...btn.querySelectorAll(".btn-badge, .countdown-badge, .count-badge")];
      curBadges.forEach((n) => { if (keep.indexOf(n) < 0) n.remove(); });
      const ordered = keep.length === curBadges.length && keep.every((n, i) => n === curBadges[i]);
      if (!ordered) keep.forEach((n) => btn.appendChild(n));
    });

    // ③ 员工标记：按 id diff（只增删改变化的，背景图与场景不动）
    const wrap = el.querySelector("#ob-markers");
    if (wrap) {
      const seats = this.core.scene().seats || [];
      /* 2026-09-16 修「头像重叠」：与整卡渲染同源（resolveSeats + 溢出网格），见 office 主渲染注释 */
      const seatMap = this.core.resolveSeats();
      const want = {};
      alive.forEach((e, i) => {
        const si = seatMap[e.id];
        const seatRaw = (si != null ? seats[si] : null) || { x: 6 + (i % 6) * 17.5, y: 86 + Math.floor(i / 6) * 12 };
        const seat = this.seatPosPct(seatRaw);
        want[e.id] = { e, seat, i };
      });
      // 移除已不在职的
      wrap.querySelectorAll(".emp-marker").forEach((node) => {
        if (!want[node.dataset.eng]) node.remove();
      });
      // 更新/新增
      Object.keys(want).forEach((id) => {
        const { e, seat } = want[id];
        let node = wrap.querySelector('.emp-marker[data-eng="' + id + '"]');
        const full = !!s.prodFullByEng[id];
        const st = this.engStatus(e);
        const cls = "emp-marker " + (full ? "full " : "") + (this.isBursting(e) ? "bursting " : "")
          + this.statusCls(st).replace("st-", "");
        if (!node) {
          node = document.createElement("div");
          node.dataset.eng = id;
          node.innerHTML = `
            <div class="emp-status ${this.statusCls(st)}"></div>
            <button type="button" class="emp-avatar" data-action="om-arrange-menu" data-id="${e.id}" aria-label="安排工程师"><img src="${this.engAvatar(e)}" alt=""></button>
            <button type="button" class="emp-name" data-action="om-arrange-menu" data-id="${e.id}">${e.name}</button>
            <div class="emp-stamina">${this.icon("zap", 14)}<span></span></div>
            ${this.flameSpans(e.id)}`;
          wrap.appendChild(node);
        }
        node.className = cls;
        node.style.top = seat.y + "%";
        node.style.left = seat.x + "%";
        const p = node.querySelector(".emp-status");
        if (p) { p.textContent = st; p.className = "emp-status " + this.statusCls(st); }
        const stEl = node.querySelector(".emp-stamina span");
        /* 2026-09-12（根因定位）：这里以前是 `querySelector(".emp-stamina span")` + `if (stEl)`。
           而**初始模板**把体力写成裸文本（`.emp-stamina` 里没有 <span>），只有本分支新建的
           marker 才有 span —— 于是所有「首屏就渲染出来的人」选中 null、被 if 静默跳过：
           办公室体力永远停在进屏那一刻的数字，团队面板（整块重建）却是新的，两边对不上。
           历史上反复改的都是**取值口径**（e.energy → engEnergy），没碰到 DOM 结构，所以怎么改都不好。
           现在：① 初始模板与这里 DOM 同构（都带 span）；② 这里再做一次兜底——
              取不到 span 就把整块 .emp-stamina 重建成「图标 + span」，绝不静默失败。 */
        if (stEl) stEl.textContent = this.engEnergy(e);
        else {
          const box = node.querySelector(".emp-stamina");
          if (box) box.innerHTML = this.icon("zap", 14) + "<span>" + this.engEnergy(e) + "</span>";
        }
      });
    }
    show("ob-pausedtag", !!s.officePaused);

    // ④ 底部模型数值 + 待收产出
    const cap = this.core.statCap();
    this.modelDims(s).forEach(({key:k}) => {
      const v = Math.round(this.modelValue(k, s)), top = this.modelCap(k);
      const pct = Math.max(0, Math.min(100, (v / (top || 1)) * 100)).toFixed(1);
      setTxt("ob-val-" + k, v + " / " + Math.ceil(top));
      const bar = el.querySelector("#ob-bar-" + k);
      if (bar) bar.style.width = pct + "%";
      const marker = el.querySelector("#ob-pass-" + k);
      if (marker) { const html=this.officePassMarker(k); if(marker.innerHTML!==html) marker.innerHTML=html; }
    });
    const archName = ((c.ARCHITECTURES || []).find((a) => a.id === s.arch) || {}).name || "—";
    setTxt("ob-ver", (s.paramTarget || 7) + "B · " + archName);
    setTxt("ob-plan", s.planDone ? "已立项" : "尚未立项");
    setTxt("ob-prod", this.core.totalProd());
  },

  /* 品牌星级（升星条件可在玩法配置配：BRAND_STAR_BASE 一星门槛 / BRAND_STAR_STEP 步长） */
  brandStars(brand) {
    const c = this.core ? this.core.cfg : {};
    const base = c.BRAND_STAR_BASE != null ? c.BRAND_STAR_BASE : 80;
    const step = c.BRAND_STAR_STEP != null ? c.BRAND_STAR_STEP : 20;
    const n = this.core && this.core.brandStarsCount ? this.core.brandStarsCount(brand)
      : Math.max(0, Math.min(5, 1 + Math.floor(((brand || 0) - base) / Math.max(1, step))));
    return "★".repeat(n) + "☆".repeat(5 - n);
  },
  brandTip() {
    if (!this.core.brandProgress) return "品牌影响事件机遇与阶段结算收益";
    const p = this.core.brandProgress();
    return "品牌值 " + Math.round(p.value) + " · " + p.stars + " 星"
      + (p.next != null ? " · 下一星 " + Math.ceil(p.next) : " · 已达最高星级")
      + " · 阶段主奖金 +" + Math.round(p.rate * 100) + "%"
      + (p.value >= p.stageCap && p.stars < 5 ? " · 本阶段品牌已满，推进版本继续成长" : "");
  },

  /* 四维数值名（用于「主攻 XX」等文案） */
  statLabel(k) {
    return this.core && this.core.statLabel ? this.core.statLabel(k) : ({ code: "代码", text: "文字", safety: "安全", stability: "稳定" })[k] || k || "—";
  },

  /* 工程师头像图（游戏内 avatar 路径 / 配置 avatarIdx）
     2026-09-12：池子扩到 100 人 → 头像扩到 avatar_0~99.webp（python gen_avatars_webp.py 重跑）
     2026-09-03：头像重制为 resource/ui/avatar_0~29.webp —— 像素风、**像素圆底**
     （圆外透明，塞进圆形头像框严丝合缝；纯头部，无身体）。 */
  engAvatar(e) {
    if (e.avatar) return e.avatar;
    const i = (e.avatarIdx != null ? e.avatarIdx : 0);
    return "resource/ui/avatar_" + (Math.abs(i) % 100) + ".webp";   // 2026-09-12：头像已扩到 100 张
  },

  /* 燃烧粒子层（2026-09-05 重做，用户反馈旧渐变火苗太简陋）：
     头像上方 8 个火苗 span，参数由 id 哈希确定性生成（错峰循环，观感连续不机械）。
     显隐由 .bursting class 驱动（CSS display 控制），动画常驻 CSS infinite。 */
  flameSpans(id) {
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
    let out = '<div class="flame-fx" aria-hidden="true">';
    for (let i = 0; i < 8; i++) {
      const xl = ((h + i * 37) % 45) - 22;            // 水平像素偏移（容器宽 0，须用 px）
      const sz = 8 + ((h + i * 29) % 7);
      const dx = ((h + i * 13) % 13) - 6;
      const dur = (0.55 + ((h + i * 17) % 40) / 100).toFixed(2);
      const dl = (-((h + i * 23) % 70) / 100).toFixed(2);
      out += `<span class="flame-p" style="--xl:${xl}px;--sz:${sz}px;--dx:${dx}px;--dur:${dur}s;--dl:${dl}s"></span>`;
    }
    return out + "</div>";
  },

  /* 回合推进定时器：每 TICK_MS 走一帧，累计到 MS_PER_ROUND 推进一回合 */
  startOfficeTimer() {
    if (this._officeTimer) return;
    const tick = (this.core.cfg.OFFICE || {}).TICK_MS || 1000;
    this._officeTimer = setInterval(() => {
      const s = this.core.state;
      if (!s || s.phase !== "office" || s.officePaused) return;
      this.whalebeeTick(s);   // 趣味掉落：鲸bee（金币）调度（暂停/离屏时自然停摆）
      this.updateDayNight();  // 昼夜渐变：每秒重算，保证过渡是连续的而非每 tick 跳一档
      /* 时间循环必须自愈：任何一帧抛异常都不能让游戏「静默停在某一周」。
         历史上真出过：配置被污染 → 引擎 tick 抛 "object is not iterable" →
         时间永久停在第 1 周，玩家只看到「时间不走」，控制台之外毫无提示。
         2026-09-12 兜底升级：连续 3 帧异常 = 存档已坏到引擎跑不动 →
         自动回滚到「本阶段开头」的锚点存档（GameSave.saveStage，不占手动槽）
         重新开始本阶段；回滚后仍崩（说明是配置层的问题，不是状态层）就只
         提示一次，不再反复重置把玩家进度来回洗掉。 */
      let r;
      try {
        r = this.core.officeTick(Date.now());
        this._tickFails = 0;
      } catch (err) {
        console.error("[officeTick] 时间推进异常：", err);
        this._tickFails = (this._tickFails || 0) + 1;
        if (this._tickFails >= 3) {
          if (!this._tickRecovered) {
            this._tickRecovered = true;
            this.recoverFromStageAnchor();
          } else if (this._tickFails % 15 === 0) {
            this.toast("⚠️ 时间推进异常持续存在，建议「重新开始游戏」或回滚到手动存档");
          }
        } else {
          this.toast("⚠️ 时间推进异常：" + (err && err.message ? err.message : err));
        }
        return;
      }
      /* 2026-09-12：**每帧都做一次增量刷新**（不只是推进回合那一帧）。
         officeTick 每 MS_PER_ROUND(60s) 才返回一次日志，之前所有数字都绑在 `if (r)` 里，
         于是办公室的体力/四维/语料最多要等 1 分钟才动一次，玩家体感就是「办公室不刷新」。
         这里补一次纯 diff 刷新（updateOfficeMain 只改文本/样式/class，不重建 DOM、不解码背景图），
         开销极小；顺带覆盖「面板操作改了状态但没走 render」的边角情况。 */
      this.updateOfficeMain();
      if (r) {
        this.render({ soft: true });
        this.renderOfficeFloats(r.floats);
        if (r.notices && r.notices.length) r.notices.forEach((n) => this.pushNotice(n));  // 顶部小卡片：新闻/节点提示
        if (r.event) this.showOfficeEvent(r.event);      // V3.5.2：办公室事件（顶部卡片，时间暂停）
        if (r.vigour) this.toast("🔥 全员灵感迸发！体力 -15，本阶段词条升级概率 ×1.5");
        /* 2026-09-04：个人爆发（谁的体力攒够了谁才爆）——头像燃烧由 .emp-marker.bursting 承担 */
        if (r.bursts && r.bursts.length) {
          for (const b of r.bursts) this.toast(`🔥 ${b.name} 进入爆发状态！接下来产出翻倍`);
          if (window.SFX) SFX.play("fanfare", { vol: 0.55 });
        }
        if (r.milestone) this.toast("🏆 里程碑达成：二测达标，母公司奖励 30 万");
        if (r.bankrupt) this.toast("⚠️ 经费见底！再这样下去公司要完了");
        /* 破产预警（2026-09-29 用户要求）：经费 <2 个月 / <1 个月工资，每阶段两级各提示一次。
           引擎把「已提示过」的标记写进 s.bankruptWarn（按阶段复位）—— 所以提示的同时
           **必须落盘**，否则玩家关掉页面再进来，同一级警告会再挨一次。 */
        if (r.bankruptWarn) {
          this.toast(r.bankruptWarn.text);
          this.save.autoSave(s);
        }
        if (r.arrive) r.arrive.forEach((m) => this.toast(m));   // 到岗播报
        if (r.restBack && r.restBack.length) r.restBack.forEach((n) => this.toast("☀️ " + n + " 休息归来，体力已恢复"));
        /* 找到候选人已改走 OFFICE_HINTS 的 hire_done 类型（引擎层 log.notices → pushNotice），
           这里不再硬编码——旧的 r.hire 消费逻辑已删（2026-09-05）。 */
        if (r.toast) this.toast(r.toast);                  // 周节拍引导
        if (r.paperUnlocked && r.paperUnlocked.length) this.toast("🔓 论文解锁新架构：" + r.paperUnlocked.join("、") + "（已可用于下一阶段立项）");
        if (r.openModal && !s.officeModal) {
          /* 2026-09-09 修 BUG：openModal 原本在 render({soft}) 之后才置位，而「训练周期完成」
             （week >= V35.WEEKS）后 officeTick 直接 return、不再渲染 → 评审面板永远不弹，
             玩家只看到「时间静默停住、毫无提示」。置位后立刻补一次渲染把面板弹出来。 */
          s.officeModal = r.openModal;
          this.render({ soft: true });
        }
        /* 小游戏触发（2026-09-05 接回 V3.5 循环；2026-09-06 二改：不再直接弹面板，
           先走事件圆点（中间大圆点 → 点开卡片 → 开始巡检），与玩法事件同一套逻辑。
           同周撞上普通事件圆点时让路：不消费 minigameDone，下周结算顺延再弹。 */
        if (r.weekUp && !r.event) {
          const kind = this.minigameTrigger();   // 小写 sft/rm
          if (kind) {
            s.minigameDone[kind.toUpperCase()] = true;   // done 键与 minigameTrigger 内部检查（大写）一致
            this.showMinigameSpawn(kind);
            return;
          }
        }
        this.save.autoSave(s);
      }
    }, tick);
  },

  /* 兜底回滚（2026-09-12）：引擎 tick 连续崩溃 → 自动读「本阶段开头」锚点存档重来。
     成功与否都清掉恢复标记前的连续失败计数，避免回滚后立刻又被判定成坏档。 */
  recoverFromStageAnchor() {
    const snap = (this.save && this.save.loadStage) ? this.save.loadStage() : null;
    if (!snap || !snap.state || !snap.state.phase) {
      this.toast("⚠️ 连续检测到时间推进异常，且没有本阶段锚点存档——请到「存档」手动回滚或重新开始");
      return;
    }
    try {
      this.core.restore(snap.state);
    } catch (e) {
      console.error("[recoverFromStageAnchor] 锚点恢复失败：", e);
      this.toast("⚠️ 锚点恢复失败，请到「存档」手动回滚或重新开始");
      return;
    }
    this._tickFails = 0;
    this._modal = null;
    this.core.state.officeModal = null;
    this.save.autoSave(this.core.state);
    this.render();
    this.toast("🛟 检测到存档异常，已自动回到本阶段开头（每个阶段开始都会自动存一份锚点）");
  },

  /* 小游戏触发检查（2026-09-05）：MINIGAMES.TRIGGER 按 { ver, week, needRole } 配置，
     默认 SFT = V1·W4（后训练工程师到岗当周）、RM = V1.5·W2。每阶段各一次。 */
  minigameTrigger() {
    const s = this.core.state, c = this.core.cfg;
    if (this.core.embodiedAvailable(s)) { this.core.retireLegacyMinigame(s); return null; }
    const trg = (c.MINIGAMES || {}).TRIGGER || {};
    s.minigameDone = s.minigameDone || {};
    for (const kind of Object.keys(trg)) {
      const t = trg[kind];
      if (!t || s.minigameDone[kind]) continue;
      /* 2026-09-06：>= 而非 === —— 撞上玩法事件圆点时巡检让路，顺延一周仍要能弹 */
      if (s.ver !== t.ver || s.week < t.week) continue;
      const needRole = t.needRole || "post";
      if (!(s.engineers || []).some((e) => !e.resigned && this.core.v35RoleOf(e) === needRole
        && (e.joinTick == null || (s.v35 && s.v35.tick >= e.joinTick)))) continue;
      return kind.toLowerCase();   // 对外契约：小写（喂 minigameMeta/startMinigame）；done 键用大写，调用点桥接
    }
    return null;
  },

  /* 巡检「事件圆点」（2026-09-06 用户要求）：与玩法事件同一套圆点→胶囊→卡片交互，
     卡片只有一个「开始巡检」入口，点开才 startMinigame 进「数据定期巡检」面板。 */
  showMinigameSpawn(kind) {
    const s = this.core.state;
    if (this.core.embodiedAvailable(s)) { this.core.retireLegacyMinigame(s); return null; }
    if (this.el.querySelector("#ob-evspawn")) return;   // 已有事件/巡检在演出
    const meta = this.minigameMeta(kind);
    /* 2026-09-12（用户实测「体力加不动」）：圆点弹出即全场暂停 —— 玩家没注意到圆点时
       游戏静默冻结，体力/产出/时间全部不动还找不到原因。改为：**圆点只是提醒不暂停**，
       点「开始巡检」进面板时才由 startMinigame 暂停时间（_mgWasPaused 基线照旧）。 */
    const wasPaused = !!s.officePaused;
    const div = document.createElement("div");
    div.id = "ob-evspawn";
    div.className = "ev-spawn";
    div.innerHTML = `
      <div class="ev-morph">
        <div class="ev-rings"><i></i><i></i><i></i></div>
        <img class="ev-ic" src="resource/ui/favicon.png" alt="" aria-hidden="true">
        <div class="ev-capsule-title">${meta.title}</div>
        <div class="ev-body">
          <div class="ev-title">${meta.kicker}</div>
          <div class="ev-text">${meta.sub}</div>
          <div class="ev-opts"><button class="ev-opt" data-mgstart="1">开始巡检 ➜</button></div>
        </div>
      </div>
      <div class="ev-hint">触发巡检（点开始后暂停时间）</div>`;
    this.el.appendChild(div);
    div.querySelector(".ev-morph").addEventListener("click", () => {
      if (div.classList.contains("expand")) return;
      div.classList.add("expand");
      setTimeout(() => div.classList.add("open"), 480);
    });
    div.querySelector("[data-mgstart]").addEventListener("click", () => {
      /* 先还原圆点造成的暂停，再交给 startMinigame 记录它自己的暂停基线，
         否则 _mgWasPaused 会记住「圆点暂停态」→ 巡检结束后时间永久冻结。 */
      /* [feature:v2b-pause-inspection-spawn] */
      if (!window.OfficePause) s.officePaused = wasPaused;
      /* [/feature:v2b-pause-inspection-spawn] */
      div.classList.add("bye");
      setTimeout(() => div.remove(), 380);
      this.core.startMinigame(kind);
      if (window.SFX) SFX.play("fanfare", { vol: 0.5 });
      this.save.autoSave(s);
      this.render({ soft: true });   // soft：巡检打开不播彩条转场（2026-09-06 用户反馈）
      this.updateOfficeMain();
    });
    return div;
  },

  /* ---------------- 昼夜渐变（2026-09-04）----------------
     下班前慢慢变暗 → 下班期间维持最暗 → 上班前慢慢变亮 → 上班维持白天。
     返回值是「夜色浓度」0（白天）~1（最暗），由 #ob-night 遮罩的 opacity 消费。
     关键：按**真实时间**在相邻两个产出 tick 之间插值——tick 间隔约 10 秒（还带 ±3s 抖动），
     直接按整 tick 取值会每 10 秒硬跳一档，看起来像闪灯而不是天黑。 */
  dayNightAmount() {
    const c = this.core.cfg, s = this.core.state;
    const V = c.V35 || {}, D = V.DAYNIGHT || {};
    if (D.ENABLED === false) return 0;
    const st = s.v35;
    if (!st) return 0;
    const offS = V.OFF_START != null ? V.OFF_START : 18;
    const offL = V.OFF_LEN != null ? V.OFF_LEN : 3;
    const fade = D.FADE_TICKS != null ? D.FADE_TICKS : 1;
    if (fade <= 0) return 0;
    let t = st.tick || 0;
    if (s._tickAt) {
      const ms = Math.max(1000, (V.TICK_S || 10) * 1000);
      t += Math.min(1, Math.max(0, (Date.now() - s._tickAt) / ms));
    }
    const a = offS - fade, b = offS, ce = offS + offL, d = ce + fade;
    if (t <= a) return 0;                        // 上班：白天
    if (t < b) return (t - a) / fade;            // 下班前：渐暗
    if (t < ce) return 1;                        // 下班中：维持最暗
    if (t < d) return 1 - (t - ce) / fade;       // 上班前：渐亮
    return 0;                                    // 上班：白天
  },
  updateDayNight() {
    const el = this.el && this.el.querySelector("#ob-night");
    if (!el) return;
    const D = (this.core.cfg.V35 || {}).DAYNIGHT || {};
    const max = D.MAX_OPACITY != null ? D.MAX_OPACITY : 0.6;
    el.style.opacity = (this.dayNightAmount() * max).toFixed(3);
  },

  /* ---------------- 趣味掉落：鲸bee（金币）----------------
     每隔 INTERVAL_MIN~MAX 秒从办公室上方随机掉落一只鲸bee，缓缓下落：
     点击 = 随机经费入账（WHALEBEE.REWARD_MIN~MAX）；不点则从底部消失。
     挂在 .office-shell（soft render 不重建它），同一时间最多一只在场。 */
  whalebeeWait(c) {
    const a = c.INTERVAL_MIN != null ? c.INTERVAL_MIN : 30;
    const b = Math.max(a, c.INTERVAL_MAX != null ? c.INTERVAL_MAX : 90);
    return Math.round(a + Math.random() * (b - a));
  },
  whalebeeTick(s) {
    const c = (this.core.cfg || {}).WHALEBEE;
    if (!c || c.ENABLED === false) return;
    this._beeWait = this._beeWait == null ? this.whalebeeWait(c) : this._beeWait - 1;
    if (this._beeWait > 0) return;
    this._beeWait = this.whalebeeWait(c);
    this.spawnWhalebee(c, s);
  },
  spawnWhalebee(c, s) {
    const shell = this.el.querySelector(".office-shell");
    if (!shell || shell.querySelector(".whalebee")) return;
    const img = document.createElement("img");
    img.className = "whalebee";
    img.src = c.IMG || "resource/character/比耶.webp";
    img.alt = "鲸bee";
    img.draggable = false;
    const size = c.SIZE || 56;
    img.style.width = size + "px";
    img.style.height = size + "px";
    img.style.left = (5 + Math.random() * 80).toFixed(1) + "%";
    img.style.setProperty("--bee-fall", (c.FALL_MS || 9000) + "ms");
    img.addEventListener("click", () => {
      const v = Math.round((c.REWARD_MIN != null ? c.REWARD_MIN : 10000)
        + Math.random() * ((c.REWARD_MAX != null ? c.REWARD_MAX : 30000) - (c.REWARD_MIN != null ? c.REWARD_MIN : 10000)));
      s.funding += v;
      if (window.SFX) SFX.play("float");
      this.toast("🐝 捡到鲸bee！经费 +" + fmtMoney(v));
      this.save.autoSave(s);
      img.remove();
    });
    img.addEventListener("animationend", () => img.remove());   // 掉到底自动消失
    shell.appendChild(img);
  },

  /* 一级界面切换的彩条过渡（TRANSITION 配置可调时长/条数/颜色） */
  playTransition() {
    const c = (this.core.cfg.TRANSITION || {});
    if (c.ENABLED === false) return;
    const bars = c.BARS || 7;
    const colors = c.COLORS || ["#6fc3ff", "#ff9ad5", "#7ed4b0", "#ffcf8a", "#a78bfa"];
    const ms = c.MS || 620;
    const stagger = c.STAGGER != null ? c.STAGGER : 45;
    /* 彩条并排铺满整屏：每条厚度 = 100/bars 屏高并略微重叠（×1.35），
       整体旋转 -18deg 后从左下角扫向右上角，视觉上覆盖全屏。 */
    const thick = (100 / bars) * 1.35;
    const wrap = document.createElement("div");
    wrap.className = "dg-transition";
    wrap.innerHTML = Array.from({ length: bars }, (_, i) => {
      const top = i * (100 / bars) - (thick - 100 / bars) / 2;
      return `<i style="--bar-bg:${colors[i % colors.length]};--bar-h:${thick}vh;`
        + `--bar-top:${top}vh;--bar-ms:${ms}ms;--bar-delay:${i * stagger}ms"></i>`;
    }).join("");
    /* 转场彩条必须是最顶层（新手教学横幅/引导不属于它的遮挡层）。
       挂到 body 顶层，避免被游戏容器（可能带 transform 产生堆叠上下文）压住。 */
    (document.body || this.el).appendChild(wrap);
    setTimeout(() => wrap.remove(), ms + bars * stagger + 320);
  },

  /* 右上角「设置」：音量（demo 的三级弹窗卡片样式） */
  openSettingsPop() {
    if (this.el.querySelector("#settingsPop")) return;
    let mv = 0.6, sv = 0.9;
    try {
      mv = parseFloat(localStorage.getItem("whale_music_vol") || "0.6");
      sv = parseFloat(localStorage.getItem("whale_sfx_vol") || "0.9");
    } catch (e) {}
    const row = (kind, label, v) => `
      <div class="set-row">
        <div class="set-label"><span>${label}</span><b id="set-vol-${kind}-val">${Math.round(v * 100)}%</b></div>
        <input class="set-range" type="range" min="0" max="1" step="0.05" value="${v}" data-kind="${kind}">
      </div>`;
    const div = document.createElement("div");
    div.id = "settingsPop";
    div.className = "set-pop-mask";
    div.innerHTML = `
      <div class="sub-modal-card">
        <div class="sub-modal-header">
          <div class="sub-modal-title">${this.icon("settings", 14)}<span>设置</span></div>
          <button class="modal-close" data-action="settings-close" title="关闭">${this.icon("x", 13)}</button>
        </div>
        <div class="sub-modal-body set-body">
          ${row("music", "背景音乐", mv)}
          ${row("sfx", "音效", sv)}
          <div class="set-tip">音量会自动保存到本机。</div>
        </div>
        <div class="sub-modal-footer">
          <button class="skew-btn" data-action="open-codex">📖 模型库</button>
          <button class="skew-btn ghost" data-action="ask-newgame">🔁 重新开始</button>
          <button class="skew-btn ghost" data-action="settings-close">关闭</button>
        </div>
      </div>`;
    this.el.appendChild(div);
    const apply = (kind, v) => {
      try { localStorage.setItem(kind === "music" ? "whale_music_vol" : "whale_sfx_vol", String(v)); } catch (e) {}
      if (kind === "music") {
        if (window.AudioMgr) AudioMgr.setMusicVolume(v);
        /* 兜底：即便 AudioMgr 尚未初始化，也先持久化，AudioMgr._restoreVol 启动时读取 */
      }
      if (kind === "sfx" && window.SFX && SFX.setVolume) SFX.setVolume(v);
      const lab = div.querySelector("#set-vol-" + kind + "-val");
      if (lab) lab.textContent = Math.round(v * 100) + "%";
    };
    div.querySelectorAll("input.set-range").forEach((r) => {
      r.addEventListener("input", () => apply(r.dataset.kind, Math.max(0, Math.min(1, +r.value))));
    });
  },

  /* 模型库「缩略卡模式」判定（2026-09-30 用户：「竖屏下模型库卡片显示有问题，采用成就卡片
     同款适配逻辑，只显示缩略信息，但可以点开看详细」）。
     ⚠️ 判定**只此一处** —— CSS 不另写一套"是不是手机"的媒体查询，只认这里挂的 `.is-thumb` 类
        （与 menu.js 的 achvThumbMode 同一套口径，原因见那边注释：orientation 在 iframe / webview
        里口径不一致，短边才是"实际可用空间"）。
     ⚠️ 与成就墙的差异：这里额外要求**竖屏**（h ≥ w）。
        成就墙横竖屏都进缩略；而模型库卡片是竖版 3 列（aspect-ratio 3/4.2），**横屏手机 560px 弹窗下
        3 列每张 ~170px 宽，放得下全部信息、并不崩**（真机实测）⇒ 只对真正出问题的竖屏手机生效，
        桌面/平板（短边 > 560）与手机横屏一律维持原 3 列大卡（用户要求的"桌面/横屏不变"）。 */
  cdxThumbMode() {
    const w = window.innerWidth || 0, h = window.innerHeight || 0;
    if (!w || !h) return false;
    return h >= w && Math.min(w, h) <= 560;
  },

  /* 模型库（图鉴）（doc/24 · 2026-09-07）：入口在「设置 / 菜单」弹窗的「📖 模型库」。
     按「架构 × 参数」聚合，只跟当前存档；行列由 ARCHITECTURES × TARGET_PARAMS 驱动（不写死 20 格），
     以后加架构 / 加参数档会自动多出来。下面是训练流水（每次结算一条，CODEX.LOG_MAX 封顶）。 */
  openCodexPop() {
    const old = this.el.querySelector("#codexPop");
    if (old) old.remove();
    const s = this.core.state, c = this.core.cfg;
    const codex = (s.codex && typeof s.codex === "object") ? s.codex : {};
    /* DOC 26 P2 四档配色：合格蓝 / 优秀紫 / 顶尖金 */
    const V = { pass: "合格", excellent: "优秀", top: "顶尖" };
    const VCLS = { pass: "", excellent: " exc", top: " top" };
    const PASS_LIKE = ["pass", "excellent", "top"];
    /* 模型名是玩家自己起的（可含 < > " '），直接插进 HTML/属性会破版 —— 一律转义 */
    const H = (x) => String(x == null ? "" : x)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    /* ==========================================================================
       模型库（2026-09-11 按用户要求重做）
       --------------------------------------------------------------------------
       旧版是「架构 × 参数」矩阵网格：大部分格子是空的（没试过的组合），
       真正有信息的只有几格，还得靠 hover 才看得到 —— 玩家要的是「我练成过哪些模型」。
       新版规则（用户口述）：
         · **只收录通过的**（合格 / 优秀 / 顶尖）—— 没通过的组合不进模型库
         · **从阶段低的从左往右排**（V1 → V4.5；同阶段内按参数升序）—— 2026-09-12 用户要求
         · **左右翻页，每页最多 3 张**（PER 常量）
         · 格子改成**卡牌**质感，一张卡上把核心信息铺开（不再靠 hover）
       ========================================================================== */
    const archName = (id) => (((c.ARCHITECTURES || []).find((a) => a.id === id) || {}).name || id);
    /* 2026-09-12（用户要求）：**从阶段低的从左往右排**。
       以前只按 param 升序 → 7B 档把 V1 / V1.5 / V2.5 的卡混在一起，
       「V1 → V4.5」的阶段推进感完全看不出来。
       现在：① 按阶段（VER_ORDER 下标，与卡片上显示的 b.ver 同一字段）升序；
             ② 同阶段内再按参数升序；③ 都相同再按架构名，保证顺序稳定可预期。 */
    const vorder = c.VER_ORDER || [];
    const vIdx = (v) => { const i = vorder.indexOf(v); return i < 0 ? vorder.length : i; };
    const list = Object.keys(codex)
      .map((k) => Object.assign({ key: k }, codex[k]))
      .filter((e) => e && e.best && PASS_LIKE.indexOf(e.best.verdict) >= 0)
      .sort((a, b) => (vIdx(a.best && a.best.ver) - vIdx(b.best && b.best.ver))
        || (a.param - b.param)
        || String(a.arch).localeCompare(String(b.arch)));

    let times = 0, best = null;
    for (const k of Object.keys(codex)) {
      const e = codex[k];
      times += (e && e.times) || 0;
      if (e && e.best && (!best || e.best.score > best.score)) best = e.best;
    }

  /* [feature:recruit-codex-capacity-open] */
    const PER = this.codexPerPage(); this._cdxPer=PER;
  /* [/feature:recruit-codex-capacity-open] */
    if (this._cdxPage == null) this._cdxPage = 0;
    const total = Math.max(1, Math.ceil(list.length / PER));
    let page = Math.min(Math.max(0, this._cdxPage), total - 1);
    this._cdxPage = page;
    const pageList = list.slice(page * PER, page * PER + PER);

    const thumb = this.cdxThumbMode();
    const cardOf = (e, opts) => {
      const b = e.best;
      /* 缩略模式下点卡 = 看详细（与成就墙同款"缩略 → 点开"）。详细卡（opts.detail）本身不再挂
         action，否则点它会立刻把浮层关掉。桌面/横屏（thumb=false）不挂 action，卡片保持原样。 */
      const act = thumb && !(opts && opts.detail) ? ` data-action="codex-open" data-id="${H(e.key)}"` : "";
      /* 本组合的维度 = 基础四维 + 本组合激活的轴（与引擎同源，未激活的轴不显示 → 零痕迹） */
      const axIds = this.axesOf(e.arch, e.param, b.ver);
      const cardState = Object.assign({}, b, {arch:e.arch,paramTarget:e.param});
      const dims = this.modelDims(cardState).map(d=>d.key);
      /* 2026-09-12（用户要求）：卡片像一张真正的卡——顶部饰条定档位色、
         名字/参数/分数分层排版（数字用 --font-num）、顶尖卡带流光扫过 */
      /* 2026-09-12（用户要求）：竖版卡牌 + 品质花纹外框 —— 外框是带底图花纹的饰边层，
         内芯才是信息面；顶尖金框带流光，品质感拉满 */
      /* 2026-09-13（用户要求）：
         ①「结构 · 参数 · 版本」必须**固定一行**（以前长架构名会把版本挤下去 → 见 .cdx-card-sub 的 nowrap）
         ② 数值条**要能全部放下**（记忆往下的轴以前被裁掉）→ 改成两列小格（见 .cdx-card-bars 的 grid） */
      return `
        <div class="cdx-card${VCLS[b.verdict] || ""}"${act}>
          <div class="cdx-card-inner">
            <div class="cdx-card-top">
              <span class="cdx-card-name" title="${H(b.name) || "—"}">${H(b.name) || "—"}</span>
              <span class="cdx-vd">${V[b.verdict] || b.verdict || "—"}</span>
            </div>
            <div class="cdx-card-score">
              <b>${Math.round(b.score || 0)}</b><small>综合评分</small>
            </div>
            <div class="cdx-card-sub">
              <b>${archName(e.arch)}</b><i>·</i><b>${e.param}B</b><i>·</i><span>${H(b.ver || "")}</span>
            </div>
            <div class="cdx-card-bars">
              ${dims.map((k) => `<span class="cdx-dim${axIds.indexOf(k) >= 0 ? " ax" : ""}">
                <i>${this.modelLabel(k)}</i><b>${Math.round(this.modelValue(k,b))}</b></span>`).join("")}
            </div>
            <div class="cdx-card-times">${e.times > 1 ? "训练 " + e.times + " 次" : "初训"}</div>
          </div>
        </div>`;
    };

    const cards = pageList.length
      ? `<div class="cdx-cards${thumb ? " is-thumb" : ""}">${pageList.map((e) => cardOf(e)).join("")}</div>`
      : `<div class="cdx-empty">还没有通过评审的模型——跑完一次评审（合格及以上）就会收录到这里。</div>`;
    /* 2026-09-13：存下来给「只翻卡片区」用（codexGoto 不再重建整个弹窗） */
    this._cdxList = list;
    this._cdxCardOf = cardOf;

    const logRows = (s.codexLog || []).slice(-3).reverse().map((x) => {
      const ad = (c.ARCHITECTURES || []).find((a) => a.id === x.arch);
      return `<div class="cdx-log-row">
        <span class="cdx-log-ver">${x.ver}</span>
        <span class="cdx-log-name">${H(x.name) || "—"}</span>
        <span class="cdx-log-arch">${ad ? ad.name : H(x.arch)} · ${x.param}B</span>
        <span class="cdx-log-score">${Math.round(x.score || 0)}</span>
        <span class="cdx-log-vd v-${x.verdict || ""} ${VCLS[x.verdict] ? VCLS[x.verdict].trim() : ""}">${V[x.verdict] || x.verdict || "—"}</span>
      </div>`;
    }).join("");
    const log = logRows || `<div class="cdx-empty">还没有训练记录——跑完一次评审就会收录。</div>`;
    const stat = `<span class="cdx-stat-item">已通过 <b>${list.length}</b> 种组合</span>`
      + `<span class="cdx-stat-item">共训练 <b>${times}</b> 次</span>`
      + (best ? `<span class="cdx-stat-item gold">最高 <b>${Math.round(best.score || 0)}</b> 分 · ${H(best.name) || "—"}</span>` : "");

    const div = document.createElement("div");
    div.id = "codexPop";
    div.className = "set-pop-mask";
    div.innerHTML = `
      <div class="sub-modal-card codex-card">
        <div class="sub-modal-header">
          <div class="sub-modal-title">${this.icon("book", 14)}<span>模型库</span></div>
          <button class="modal-close" data-action="codex-close" title="关闭">${this.icon("x", 13)}</button>
        </div>
        <div class="sub-modal-body set-body">
          <div class="cdx-stat">${stat}</div>
          ${cards}
          <div class="gcf-subhead">训练流水（最近 3 条 · 位置留给卡片放数值）</div>
          <div class="cdx-log">${log}</div>
        </div>
        <div class="sub-modal-footer codex-footer">
          <div class="cdx-pager">
            <button class="skew-btn ghost sm" data-action="codex-page" data-id="-1" title="上一页"${page <= 0 ? " disabled" : ""}>${this.icon("chevL", 14)} 上一页</button>
            <span class="cdx-pageno">${page + 1} / ${total}</span>
            <button class="skew-btn ghost sm" data-action="codex-page" data-id="1" title="下一页"${page >= total - 1 ? " disabled" : ""}>下一页 ${this.icon("chevR", 14)}</button>
          </div>
          <button class="skew-btn ghost" data-action="codex-close">关闭</button>
        </div>
        <!-- 缩略模式下点卡打开的「详细卡」浮层：与成就墙 .achv-wall-detail 同款做法 ——
             它是 .sub-modal-card（position:relative + overflow:hidden）的直接子节点 ⇒ 裁在弹窗内；
             盖满整张弹窗 ⇒ 点任意处都能关（绑定见下方 openCodexDetail / codex-detail-close）。 -->
        <div class="cdx-detail" id="cdxDetail" data-action="codex-detail-close" hidden></div>
      </div>`;
    this.el.appendChild(div);
  },

  /* 模型库翻页（2026-09-13 用户要求）：**只重画卡片区**，不再整个弹窗重建。
     以前点翻页调 openCodexPop() → 弹窗整个拆掉重挂 = 整个二级界面闪一下重刷；
     现在只换 .cdx-cards 的内容 + 让卡片播一次「翻页」动画，其余（流水/统计/页脚）原地不动。 */
  codexGoto(delta) {
    const list = this._cdxList || [];
  /* [feature:recruit-codex-capacity-goto] */
    const PER = this.codexPerPage(); this._cdxPer=PER;
    const total = Math.max(1, Math.ceil(list.length / PER));
  /* [/feature:recruit-codex-capacity-goto] */
    const page = Math.min(Math.max(0, (this._cdxPage || 0) + delta), total - 1);
    if (page === this._cdxPage) return;
    this._cdxPage = page;
    const pop = this.el.querySelector("#codexPop");
    if (!pop) return;
    const wrap = pop.querySelector(".cdx-cards");
    if (wrap && this._cdxCardOf) {
      wrap.innerHTML = list.slice(page * PER, page * PER + PER).map((e) => this._cdxCardOf(e)).join("");
      /* 翻页只重画卡片区 ⇒ 上一页开着的详细浮层要顺手收掉，否则会盖着新页的卡 */
      this.closeCodexDetail();
      /* 重播翻页动画：先摘 class → 强制回流 → 再加回来（否则同一个 class 不会重播）。
         方向跟着翻页方向走：下一页从右进、上一页从左进。 */
      wrap.style.setProperty("--cdx-dir", (delta > 0 ? 18 : -18) + "px");
      wrap.classList.remove("flip");
      void wrap.offsetWidth;
      wrap.classList.add("flip");
    }
    const pageno = pop.querySelector(".cdx-pageno");
    if (pageno) pageno.textContent = (page + 1) + " / " + total;
    const btns = pop.querySelectorAll('[data-action="codex-page"]');
    if (btns[0]) btns[0].disabled = page <= 0;
    if (btns[1]) btns[1].disabled = page >= total - 1;
  },

  /* 模型库「缩略卡 → 点开看详细」（2026-09-30，与成就墙 openAchvDetail 同款）：
     把同一条 codex 记录交给 cardOf 的**非缩略版**（维度条 / 训练次数全在），填进 .cdx-detail 浮层。
     ⚠️ 别再写一套"详细卡"的 HTML —— 与缩略卡同源（cardOf），改一处必漏一处。
     ⚠️ 只改卡片区/浮层，不重建弹窗（弹窗节点与滚动位置原地不动）。 */
  openCodexDetail(key) {
    const e = (this._cdxList || []).find((x) => x.key === key);
    const box = this.el.querySelector("#codexPop .cdx-detail");
    if (!e || !box || !this._cdxCardOf) return;
    box.innerHTML = this._cdxCardOf(e, { detail: true });
    box.hidden = false;
  },

  closeCodexDetail() {
    const box = this.el.querySelector("#codexPop .cdx-detail");
    if (!box) return;
    box.hidden = true;
    box.innerHTML = "";   // 连装饰层一起清掉（顶尖卡流光会续播上一帧状态）
  },

  /* 开局命名（2026-09-22 用户：「玩家一开始的自定义名字功能给禁掉，改成让我预设 N 个
     不同选项让玩家选」）—— 从「输入框 + 小胶囊」改成**卡片网格单选**：
       · 玩家只能从 `MODEL_NAME_SUGGEST` 里挑一个，**不能自己打字**；N 由配置决定
         （编辑器「文本配置」页可增删，见 editor/js/textTool.js）。
       · 默认选中第一个（用户拍板）：进页就能直接确认，沿用原来「预填默认名」的顺畅感。
       · 选中态存在 `state.modelName` —— 本页是 soft render **整页重建**的，
         存 DOM 或 UI 临时字段都会在重渲染时丢，只有 state 活得过。
     ⚠️ 名字来自编辑器配置 ⇒ 一律先 escHtml 再进 innerHTML（旧代码直接拼，
        名字里带引号/尖括号会破版）。 */
/* [feature:naming-pages-render-20261013] */
  namingPerPage() { const w=window.innerWidth,h=window.innerHeight; return w>h&&h<=450 ? (w<700?6:12) : w<=450?6:18; },
  renderNaming() {
    const c = this.core.cfg;
    const s = this.core.state;
    const def = c.MODEL_NAME_DEFAULT || "小鲸鱼";
    const pool = (c.MODEL_NAME_SUGGEST || []).map((n) => String(n == null ? "" : n).trim()).filter(Boolean);
    /* 默认选中第一个：state.modelName 不在池里（旧档 / 默认名被改过）就落到池首 */
    const cur = pool.indexOf(s.modelName) >= 0 ? s.modelName : (pool[0] || def);
    if (pool.length) this.core.setModelName(cur);
    const per=this.namingPerPage();
    if(this._namingState!==s||this._namingPer!==per){this._namePage=Math.floor(Math.max(0,pool.indexOf(cur))/per);this._namingState=s;this._namingPer=per;}
    const pages=Math.max(1,Math.ceil(pool.length/per));this._namePage=Math.max(0,Math.min(pages-1,this._namePage||0));
    const cards = pool.slice(this._namePage*per,(this._namePage+1)*per).map((n) => {
      const on = n === cur;
      return `<button class="dg-name-card${on ? " is-on" : ""}" type="button" aria-pressed="${on}"
        data-action="name-pick" data-name="${this.escHtml(n)}">${this.escHtml(n)}</button>`;
    }).join("");
    /* 预设被清空时不能只留一片空白 —— 说清原因，玩家仍可点确认用默认名开局 */
    const grid = pool.length ? cards
      : `<div class="dg-name-empty">还没有配置预设名字，点「就叫这个」会直接用「${this.escHtml(def)}」。</div>`;
    this.el.innerHTML = `
      <div class="dg-naming-wrap">
        <div class="dg-board dg-naming">
          <div class="dg-board-title-row">
            <div>
              <span class="dg-kicker">${this.icon("star", 15)} 一切的开始</span>
              <h1 class="dg-board-title">给你的模型起个名字</h1>
              <p class="dg-board-sub">这个名字会跟着它走过每一次评审、每一条新闻、每一个结局。<br>想好了再定哦——当然，中途改主意也没人拦你。</p>
            </div>
          </div>
          <div class="dg-content-layout">
            <aside class="dg-portrait-slot" aria-label="鲸鱼娘立绘">
              <img class="dg-portrait-img" src="${(c.UI_PORTS || {}).naming || this.portraitSrc("recruit")}" alt="鲸鱼娘">
              <span class="dg-portrait-tag u-recruit">${this.icon("users", 13)} 待命名</span>
            </aside>
            <div class="dg-naming-body">
              <div class="dg-name-actions">
                <span class="dg-name-label">模型名称 · 挑一个</span>
                <button class="dg-btn" type="button" data-action="name-random">${this.icon("refresh", 13)} 随机一个</button>
              </div>
              <div class="dg-name-grid">${grid}</div>
              ${pages>1?`<nav class="dg-name-pager" aria-label="预设名字分页"><button type="button" class="dg-btn" data-action="name-page" data-step="-1" ${this._namePage===0?"disabled":""}>${this.icon("chevL",12)}</button><span>${this._namePage+1} / ${pages}</span><button type="button" class="dg-btn" data-action="name-page" data-step="1" ${this._namePage===pages-1?"disabled":""}>${this.icon("chevR",12)}</button></nav>`:""}
              <p class="dg-name-tip">${this.icon("info", 12)} 点一张卡就选定它，名字会出现在之后所有的文案里。</p>
            </div>
          </div>
          <footer class="dg-recruit-footer">
            <div class="dg-register-status">
              <span class="dg-register-hint">V1 · 预训练阶段</span>
              <span class="dg-soft-tag">${this.icon("shield", 12)} 教学关，一定能过</span>
            </div>
            <div class="dg-footer-actions">
              <button class="dg-btn dg-btn-primary dg-next-btn" type="button" data-action="name-confirm">
                就叫这个！开始立项 ${this.icon("chevR", 14)}</button>
            </div>
          </footer>
        </div>
      </div>`;
  },
/* [/feature:naming-pages-render-20261013] */
  /* 团队平均潜力：四维（代码/文字/安全/稳定）的均值。
     潜力是 v3.5 里唯一还决定「词条能否升级」的工程师数值，团队面板与弹窗共用这个口径。 */
  avgTalent(list) {
    const arr = list || (this.core.state.engineers || []).filter((e) => !e.resigned);
    if (!arr.length) return 0;
    /* ⚠️ 这里是「工程师潜力属性」，不是「模型能力维度」——沿用 core.ENG_STAT_KEYS，勿换成 dimsOf */
    const sum = arr.reduce((a, e) => {
      const ks=this.core.engStatKeys(e);
      const st = e.stats || {};
      return a + ks.reduce((b, k) => b + (st[k] || 0), 0) / ks.length;
    }, 0);
    return Math.round(sum / arr.length);
  },

  /* 该工程师此刻是否在爆发中（岗位槽口径，与引擎 GameCore.burstActive 一致）。
     2026-09-05：待入职（joinTick 未到）不燃烧——岗位槽爆发只属于已到岗的人，
     否则会出现「提示下周入职、人还没来就先烧起来」的错位（用户实测反馈）。 */
  isBursting(e) {
    const core = this.core;
    if (!core || !core.burstActive || !core.v35RoleOf) return false;
    if (!e || e.resigned) return false;
    const st = core.state && core.state.v35;
    if (st && e.joinTick != null && (st.tick || 0) < e.joinTick) return false;
    const role = core.v35RoleOf(e);
    return !!role && core.burstActive(role, e);
  },

  /* 运行态状态条（08 设计文档 §10.2）：绿=健康 / 黄=警告 / 红=危险。
     2026-09-04：原「体力 / 忠诚」两条里的忠诚是废弃数值（不参与结算、也无离职检定），
     显示它只会让玩家误以为有离职风险要盯 —— 移除，只留体力。 */
  statusBars(e) {
    const st = this.core.cfg.ENG_STATUS || {};
    this.core.ensureStatus(e);
    const rows = [
      { k: "energy", icon: "💚", name: "体力", warn: st.WARN_ENERGY != null ? st.WARN_ENERGY : 50, danger: st.LOW_ENERGY != null ? st.LOW_ENERGY : 30 },
    ];
    return `<div class="dg-statusbars">${rows.map((r) => {
      const v = this.core.clampNum(this.statusVal(e, r.k), 0, 100);
      const lvl = v <= r.danger ? "bad" : (v <= r.warn ? "warn" : "ok");
      const risk = v < r.danger ? " dg-status-risk" : "";
      return `
        <div class="dg-statusbar dg-status-${lvl}${risk}">
          <span class="dg-status-icon">${r.icon}</span>
          <span class="dg-status-name">${r.name}</span>
          <span class="dg-status-track"><span class="dg-status-fill" style="width:${v}%"></span></span>
          <span class="dg-status-val">${v}</span>
        </div>`;
    }).join("")}</div>`;
  },

  engCard(e, small) {
    const s = this.core.state;
    const tag = e.resigned ? '<span class="dg-dim">（已离职）</span>' : "";
    /* 2026-09-16：工程词条下线（game_cfg TRAIT_TYPES 已移除）——旧档/预置档案残留的
       engineer 词条不再显示（数据不动，纯显示端过滤，见 TRAIT_TYPES 注释） */
    const lv = (e.traits || []).filter((t) => t.type !== "engineer").map((t) => `${this.traitName(t.type)}Lv${t.level}`).join(" ");
    const tier = this.core.tierOf(e);
    // 已招募卡片：仅显示 2 项关键属性条（代码/文字），保持紧凑
    const mini = ["code", "text"].map((k) => {
      const v = (e.stats && e.stats[k]) != null ? Math.min(100, e.stats[k]) : 0;
      return `
        <div class="dg-statbar dg-statbar-mini">
          <span class="dg-statbar-label">${this.statName(k)}</span>
          <span class="dg-statbar-track ${this.typeColor(e.type)}"><span class="dg-statbar-fill ${this.typeColor(e.type)}" style="width:${v}%"></span></span>
          <span class="dg-statbar-val">${v}</span>
        </div>`;
    }).join("");
    // 运行态三围：small（招募页已聘列表）也显示，尽早建立"状态会掉"的认知
    const status = this.statusBars(e);
    // 快捷操作：仅完整卡片（双周行动台）且在职时显示
    /* 2026-09-06：慰问入口已随 A_H_CARE 行动卡退役（P7 团建改版）彻底删除，
       只保留「辞退」快捷按钮（走 A_H_FIRE，与行动面板共用同一套结算）。 */
    let ops = "";
    if (!small && !e.resigned) {
      /* 2026-09-12（用户定稿）：辞退唯一代价 = 赔付 2 倍月薪 —— AP 消耗废除，
         可用性只看 MIN_KEEP；辞退走 core.fire 直接结算（不再经行动卡 useAction） */
  /* [feature:last-engineer-card-fire] */
      const canFire = this.core.canFireEngineer(s);
  /* [/feature:last-engineer-card-fire] */
      const fireOk = canFire;
      const fireTip = fireOk ? "辞退（不可撤销，赔付 2 倍月薪）" : "不能辞退最后一名工程师";
      ops = `
        <div class="dg-eng-ops">
          <button class="dg-btn dg-btn-sm dg-btn-ghost dg-btn-danger" type="button" data-action="fire" data-id="${e.id}"
            ${fireOk ? "" : "disabled"} title="${fireTip}">🚪 辞退</button>
        </div>`;
    }
    return `
      <div class="dg-card dg-eng dg-type-${e.type} dg-tier-${tier.clsKey}${e.resigned ? " dg-dim-card" : ""}">
        <div class="dg-eng-head">
          <img class="dg-avatar dg-avatar-sm" src="${e.avatar || ""}" alt="">
          <div>
            <div class="dg-cand-name">${e.name}<span class="dg-dim"> ${e.gender || ""}·${e.age || "?"}岁</span>${tag}</div>
            <div class="dg-dim">${this.typeName(e.type)} · ${lv}</div>
          </div>
          <span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(e)}</span>
        </div>
        ${mini ? `<div class="dg-statbars dg-statbars-mini">${mini}</div>` : ""}
        ${status}
        ${ops}
      </div>`;
  },


  /* ---------------- 方向决策 ---------------- */
  /* 训练方案卡（P4）：架构 × 数据配方。V1 固定稠密 × 通用对话（只展示），
     并把两者的相性讲清楚——这是《游戏发展国》式「类型 × 题材」组合的第一课。 */

  /* ---------------- 行动卡面板（08 设计文档 §4，P1）----------------
     每双周固定 AP，玩家在「训练类（冲数值）」与「团队类（养团队）」之间分配。
     用户 2026-08-28：只做训练+团队两类，经营类砍掉。 */



  /* ---------------- 双周循环（报告 + 微调 / 事件） ---------------- */
  /* ---------------- 行业新闻（P6，用户 2026-08-29）----------------
     报纸头条样式：报名 + 日期 + 大标题 + 正文 + 单选项。
     保密研发期玩家也能「看到外面的世界在沸腾」，制造时代感。 */

  /* ---------------- SFT / RM 小游戏（P5，用户 2026-08-29）----------------
     SFT = 数据质检：一个 prompt 三个回答，挑值得进 SFT 数据集的那个；
     RM  = 偏好标注：一个 prompt 两个回答，选出更好的（给奖励模型当训练信号）。
     作答后立即给对错反馈与标注理由——把「后训练在干什么」教给玩家。 */
  minigameMeta(kind) {
    return kind === "sft"
      ? { title: "SFT · 数据质检", kicker: "后训练 · 监督微调", icon: "database",
          sub: "下面是候选的训练样本，点掉不合格的、留下值得教的——SFT 的质量全看这一步。",
          pickTip: "选出值得进 SFT 数据集的回答", optLabel: ["样本一", "样本二", "样本三"] }
      : { title: "RM · 偏好排序", kicker: "后训练 · 奖励模型", icon: "target",
          sub: "同一问题有 4 个回答，按「好 → 差」依次点选排位——你的排序就是奖励模型的训练信号。",
          pickTip: "按 好 → 差 依次点击排位", optLabel: ["回答 A", "回答 B", "回答 C", "回答 D"] };
  },

  /* ================= SFT / RM 小游戏（2026-09-05 改版：办公室事件面板）=================
     用户拍板：小游戏禁止用一级界面（旧 phase=minigame 全屏页已废止），共用事件触发链——
     周结算（MINIGAMES.TRIGGER）或事件选项（effects.minigame）触发，弹出二级面板
     「数据定期巡检」，时间像事件一样暂停。SFT = 三选一数据质检；RM = 4 条回答按 好→差 排位。 */
  minigameBodyHTML() {
    const s = this.core.state;
    if (s.minigame) return this.minigameQuizHTML(s.minigame);
    const sm = this._mgSummary;   // 刚完成：展示成绩总结（面板保持打开，点「完成巡检」关闭）
    if (sm) return this.minigameSummaryHTML(sm);
    return `<div class="om-empty-tip">本次巡检已完成，时间已恢复流动。</div>`;
  },

  /* [feature:office-feedback-quiz-marker-context] */
  minigameQuizHTML(m) {
  /* [feature:office-feedback-ui-1] */
  /* [/feature:office-feedback-ui-1] */
    const c = this.core.cfg;
    const meta = this.minigameMeta(m.kind);
    const bank = m.kind === "sft" ? (c.SFT_DATA || []) : (c.RM_SETS || []);
    const item = bank[m.order[m.round]];
    if (!item) return `<div class="om-empty-tip">巡检数据加载失败</div>`;
    const done = !!m.picked;
    const order = (m.optOrder && m.optOrder[m.round]) || [];
    let opts = "";
    if (m.kind === "sft") {
      opts = order.map((choice, i) => {
        const src = choice === 0 ? item.good : item.bads[choice - 1];
        const mark = done ? (choice === 0 ? " good" : " bad") : "";
        const sel = done && m.picked.idx === i ? " picked" : "";
        /* 2026-09-29（用户：作答后理由另起一行会把「下一题」挤出可视区）：
           理由挪到样本标签同行右侧，不再独占一行，选项纵向高度与作答前一致。 */
        const why = done && m.picked.idx === i
          ? `<span class="dg-mg-why">${m.picked.ok ? "✅ " : "❌ "}${m.picked.why}</span>`
          : (done ? `<span class="dg-mg-why">${choice === 0 ? "✅ " + item.good.why : "❌ " + src.why}</span>` : "");
        return `<button class="dg-mg-opt${mark}${sel}" type="button" data-action="mg-pick" data-id="${i}" ${done ? "disabled" : ""}>
          <span class="dg-mg-opt-head">
            <span class="dg-mg-opt-tag">${meta.optLabel[i]}</span>${why}
          </span>
          <span class="dg-mg-opt-text">${src.t}</span>
        </button>`;
      }).join("");
    } else {
      const ranked = m.rank || [];
      const n = order.length;
      opts = order.map((choice, i) => {
        const pos = ranked.indexOf(i);
        const isRanked = pos >= 0;
        const it = item.items[choice];
        /* 2026-09-29（与 SFT 同口径）：作答后的理由与名次标签同行，不再独占一行 ——
           竖屏下 4 条选项各多出一行会把「下一题」挤出可视区。 */
        const verdict = done ? `<span class="dg-mg-why">${it.why}</span>` : "";
        return `<button class="dg-mg-opt rank${isRanked ? " ranked" : ""}" type="button"
          data-action="${done ? "" : "mg-rank"}" data-id="${i}" ${done || isRanked ? "disabled" : ""}>
          <span class="dg-mg-opt-head">
            <span class="dg-mg-opt-tag">${isRanked ? "第 " + (pos + 1) + " 名" : meta.optLabel[i]}</span>${verdict}
          </span>
          <span class="dg-mg-opt-text">${it.t}</span>
        </button>`;
      }).join("");
    }
    const dots = Array.from({ length: m.total }, (_, i) =>
      `<span class="dg-mg-dot${i < m.round ? " on" : ""}${i === m.round ? " cur" : ""}"></span>`).join("");
    /* RM：排位条 + 提交按钮（4 个排满才可提交）
       2026-09-17（玩家反馈「点错了想修改，不能更改排序」）：加「重排」按钮 ——
       点一次 = 清空已排位次重来（core.minigameResetRank 一直有实现，但**从未接过 UI**，
       等于玩家点错只能硬着头皮提交）。排满之前也显示，随时可清。 */
    let rankBar = "";
    if (m.kind === "rm") {
      const ranked = m.rank || [];
      const slots = order.map((_, i) => `<span class="rk-slot${i < ranked.length ? " fill" : ""}">${i < ranked.length ? (i + 1) : "·"}</span>`).join("");
      const full = ranked.length >= order.length;
      rankBar = `<div class="dg-mg-rankbar">
        <span class="rk-label">排位：</span>${slots}
        ${(ranked.length && !done) ? `<button class="dg-btn dg-btn-sm dg-btn-ghost dg-mg-reset" type="button" data-action="mg-reset-rank">重排</button>` : ""}
        <button class="dg-btn dg-btn-primary dg-mg-submit" type="button" data-action="mg-submit" ${full && !done ? "" : "disabled"}>提交排序</button>
      </div>`;
    }
    return `
      <div class="dg-mg-card">
        <div class="dg-mg-kicker">${meta.kicker}</div>
        <div class="dg-mg-title">${meta.title}</div>
        <div class="dg-mg-head">
          <div class="dg-mg-q">${item.q}</div>
          <div class="dg-mg-dots">${dots}<b class="dg-mg-score">答对 ${m.hits}/${m.round + (done ? 1 : 0)}</b></div>
        </div>
        <div class="dg-mg-tip">${done && m.kind === "rm" && m.picked && m.picked.kind === "rank"
          ? (m.picked.perfect ? "🌟 排序全对！这就是奖励模型想要的标注。" : m.picked.score >= 0.5 ? "只差一步之遥——相邻位次有偏差。" : "排序偏差较大，看看正确名次。")
          : meta.pickTip}</div>
        <div class="dg-mg-opts ${m.kind}">${opts}</div>
        ${rankBar}
      </div>`;
  },

  /* [/feature:office-feedback-quiz-marker-context] */
  /* 小游戏总结：成绩 + 奖励明细（在巡检面板内展示） */
  minigameSummaryHTML(sm) {
    const meta = this.minigameMeta(sm.kind);
    const names = { code: "代码", text: "文字", safety: "安全", stability: "稳定" };
    const gains = Object.keys(sm.gains || {}).map((k) => `${names[k]} +${sm.gains[k]}`).join("　");
    const perfect = sm.hits >= sm.total;
    return `
      <div class="dg-mg-card">
        <div class="dg-mg-kicker">${meta.kicker}</div>
        <div class="dg-mg-title">${meta.title} · 完成</div>
        <div class="dg-mg-summary">
          <div class="dg-mg-score-big">${perfect ? "🌟 全对！" : `答对 ${sm.hits} / ${sm.total}`}</div>
          <div class="dg-mg-gains">${gains || "本次没有产生数值收益"}</div>
          <p class="dg-mg-note">${perfect
            ? "标注质量很高，这批数据可以直接进训练管线了。"
            : "有分歧的样本会被送回复审——真实工作中也是如此。"}</p>
        </div>
        <div class="dg-actions"></div>
      </div>`;
  },



  /* ---------------- 模型测试演出（P2，用户 2026-08-29）----------------
     V1 是内部保密研发，玩家唯一能"听到模型说话"的就是 W4 / W8 这两次测试。
     W4 输出乱码「咕嘎」，W8 输出「你好，我是{模型名}」——前后对照就是这一阶段的成长感。 */

  /* 模型回复逐字打出：乱码更慢 + 轻微抖动，正常回复匀速 */
  startTestTypewriter(text, garbled) {
    this.stopTestTypewriter();
    const el = this.el && this.el.querySelector("#dg-chat-out");
    if (!el) return;
    const full = this.tpl(String(text || ""));
    el.textContent = "";
    el.classList.toggle("typing", true);
    let i = 0;
    this._typeTimer = setInterval(() => {
      i += 1;
      el.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(this._typeTimer);
        this._typeTimer = null;
        el.classList.remove("typing");
      }
    }, garbled ? 110 : 55);
  },
  stopTestTypewriter() {
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
  },

  /* 事件选项是否付得起（2026-09-07 P3）：取该选项里**最坏**的经费支出
     （含 chance 的 success/fail 两条分支），超过现有经费就禁用。
     报价与引擎 applyEffects 共用前置校验；旧阶段纯账单可支付实际剩余余额。 */
  eventOptAffordable(o, s, evId) {
    const salary = this.core.eventOptionStatus && this.core.eventOptionStatus(o, evId, s);
    if (salary && (salary.active || salary.expenseActive)) return salary.ok;
    const worst = (eff) => {
      if (!eff) return 0;
      let d = 0;
      if (typeof eff.funding === "number") d += Math.min(0, eff.funding);
      if (eff.chance) d += Math.min(worst(eff.chance.success), worst(eff.chance.fail));
      return d;
    };
    return -worst(o && o.effects) <= (s.funding || 0);
  },

  /* 事件选项是否该「置灰/拦下」（2026-09-29 修死锁）：
     原规则「付不起就禁用」在**全部选项都付不起**时（如「电费涨价」唯一选项 -3 万、
     卡片弹出瞬间经费低于 3 万）会给出一个零可点选项的死事件 —— 玩家被卡住，
     且卡片占着 #ob-evspawn 不走，连带后续事件投递不了。
     现规则：有收益的费用严格按整笔报价拦截；旧阶段无收益的强制账单报价允许支付余额。
     没有引擎报价的旧回落仍保留原有「全部不足时放行」口径。 */
  eventOptDisabled(o, s, opts, evId) {
    const salary = this.core.eventOptionStatus && this.core.eventOptionStatus(o, evId, s);
    if (salary && (salary.active || salary.expenseActive)) return !salary.ok;
    const list = opts || [];
    const anyOk = list.some((x) => this.eventOptAffordable(x, s, evId));
    return anyOk && !this.eventOptAffordable(o, s, evId);
  },

  /* ---------------- 旧双周主循环 / 工作间 / 语料条（P3 消耗品）----------------
     整批随 V3.5.3 清理退役：渲染分发只认 naming / office / review(答题动画) /
     bonus / over；现役语料条见下方 corpusBarHTML(mini)——v35 区间条版本。 */

  /* 点击飘字：+1 代码 / 暴击高亮 */
  /* 轴的「实色」：从 AXES.DEF[*].color（渐变串）里取深色端 hex —— 飘字要用单色，
     但**不能另写一张色表**（那就是第二处真源）。取不到就回 ""，调用处不动颜色。 */
  axisSolid(id) {
    const c = ((this.core.axisDef(id) || {}).color) || "";
    const m = String(c).match(/#[0-9a-fA-F]{3,8}/g);
    return m && m.length ? m[m.length - 1] : "";
  },
  /* [feature:office-feedback-ui-2] */
  floatText(host, text, crit, color, production) {
  /* [/feature:office-feedback-ui-2] */
    if (!host) return;
  /* [feature:office-feedback-ui-3] */
    if (production) { this.queueOfficeFloat(host, production.amount, production.dim, color); return; }
  /* [/feature:office-feedback-ui-3] */
    const fl = document.createElement("span");
    fl.className = "dg-work-float" + (crit ? " crit" : "") + (color ? " ax" : "");
    /* doc/27 §5：轴产出用**轴配色**飘字（谁产的一眼可辨）。颜色来自配置，不是新色表。 */
    if (color) fl.style.color = color;
    fl.textContent = text;
    host.appendChild(fl);
    setTimeout(() => fl.remove(), 950);
  },


  /* ============ 顶部弹出小卡片（2026-09-03）============
     新闻 / 节点提示 / 办公室事件共用：从场景顶部滑入。
     - 新闻/提示：停留数秒自动滑出，不暂停时间，排队播放；
     - 事件（带 options）：不自动关，选择后关闭并恢复时间。 */
  pushNotice(n, opts) {
    const stack = this.el.querySelector("#ob-notices");
    if (!stack) return;
    const o = opts || {};
    // Coalesce recruitment updates while one is visible or waiting its turn.
    if (!o.isEvent && n.group && (
      Array.from(stack.children).some(card => card.dataset.noticeGroup === n.group)
      || (this._noticeQueue || []).some(item => item.group === n.group))) return;
    /* 同屏最多 2 张，多出来的排队（事件卡片不排队——引擎保证同时只有一条 pendingEvent） */
    if (!o.isEvent && stack.children.length >= 2) {
      this._noticeQueue = this._noticeQueue || [];
      this._noticeQueue.push(n);
      return;
    }
    const kindCls = o.isEvent ? ("ev-" + (n.uiType || "random")) : (n.kind === "news" ? "news" : "hint");
    const icon = o.isEvent ? "💬" : (n.kind === "news" ? "📰" : "🔔");
    const tag = o.isEvent ? "事件" : (n.tag || "");
    /* 2026-09-05：节点提示支持立绘（配置 avatar 字段才有，没配维持原样——结构上无 avatar 时布局等效） */
    const hasAv = !o.isEvent && n.avatar;
    const div = document.createElement("div");
    if (!o.isEvent && n.group) div.dataset.noticeGroup = n.group;
    div.className = "notice-card " + kindCls + (o.isEvent ? " is-event" : "") + (hasAv ? " has-avatar" : "");
    div.innerHTML = `
      ${o.isEvent ? "" : `<button class="nc-close" title="关闭">✕</button>`}
      <div class="nc-flex">
        ${hasAv ? `<img class="nc-avatar" src="${n.avatar}" alt="">` : ""}
        <div class="nc-main">
          <div class="nc-head"><span class="nc-icon">${icon}</span><span class="nc-tag">${tag}</span></div>
          ${n.title ? `<div class="nc-title">${this.core.chatVar(n.title)}</div>` : ""}
          <div class="nc-text">${this.core.chatVar(n.text || "")}</div>
        </div>
      </div>
      ${o.isEvent && (n.options || []).length ? `
        <div class="nc-opts">${n.options.map((op, i) =>
          `<button class="nc-opt" data-evopt="${i}">${this.core.chatVar(this.core.eventOptionText ? this.core.eventOptionText(op, n.id) : op.text || "")}</button>`).join("")}</div>` : ""}`;
    stack.appendChild(div);
    (window.requestAnimationFrame || ((fn) => setTimeout(fn, 16)))(() => div.classList.add("in"));
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      div.classList.remove("in");
      div.classList.add("out");
      setTimeout(() => {
        div.remove();
        /* 队列补位：上一张关了再放下一张 */
        if (this._noticeQueue && this._noticeQueue.length) {
          const next = this._noticeQueue.shift();
          this.pushNotice(next);
        }
      }, 380);
    };
    div.querySelector(".nc-close") && div.querySelector(".nc-close").addEventListener("click", () => {
      close();
    });
    if (!o.isEvent) setTimeout(close, n.ms || 6000);
    if (o.isEvent) {
      div.querySelectorAll("[data-evopt]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const r = this.core.applyEventOption(n.id, +btn.dataset.evopt);
          if (r && r.ok === false) { this.toast(r.tip || "暂时无法处理此选项"); return; }
          /* [feature:v2b-pause-notice-release] */
          if (window.OfficePause) OfficePause.releaseNotice(this.core, div);
          else this.core.state.officePaused = o.wasPaused;
          /* [/feature:v2b-pause-notice-release] */
          close();
          this.toast(r && r.tip ? r.tip : "已处理");
          this.save.autoSave(this.core.state);
          this.render({ soft: true });
        });
      });
    }
    return div;
  },

  /* ============ 办公室事件演出（2026-09-03 二改，用户定稿）============
     不用顶部滑动卡片——事件在**屏幕中央**以三段连贯动画展开：
       ① 大圆点出现 + 向外散发波动（ripple），下方文字「触发事件」；
       ② 玩家点击圆点 → 圆点横向展开成胶囊（标题浮现）；
       ③ 胶囊再纵向展开成卡片（正文 + 选项按钮浮现）。
     是否暂停时间由事件配置：字段 pause（缺省 true = 暂停；false = 时间继续走，
     卡片等玩家选完再消失）。新闻/节点提示仍走顶部小卡片（pushNotice）。 */
  showOfficeEvent(ev) {
    const s = this.core.state;
    if (this.el.querySelector("#ob-evspawn")) return;   // 已有事件在演出（引擎同时只有一条 pendingEvent）
    /* 事件引用已编号化（doc/32 §8）：log.event / pendingEvent 里带的是数字 no */
    const full = this.core.evByNo(ev.no != null ? ev.no : ev.id);
    if (!full) return;
    if (typeof this.core.eventEligibleForStage === "function" && !this.core.eventEligibleForStage(full, s)) {
      if (typeof this.core.healStageEvents === "function") this.core.healStageEvents();
      return;
    }
    /* {name} 占位符：引擎已解析目标人（targetName）→ 用它；通用事件兜底随机团队成员。
       2026-09-05 修复：此前 title/desc 直接输出，「有人在挖 {name}」把占位符亮给了玩家 */
    const whoName = ev.targetName || this.core.noticeTpl("{name}");
    /* ⚠️ 2026-09-19：事件文案除了 {name} 还要过**全站那把尺子**（{model}/{param}/{arch}）——
       以前只做 {name}，「给{model}办庆功会」这类事件文案会把占位符亮给玩家。
       ⚠️ 顺序：{name} 用**事件演出时算一次**的 whoName（noticeTpl 是随机的、不可重入渲染路径），
          之后 chatVar 是纯函数，刷 tick 也稳定。 */
    const rep = (str) => this.core.chatVar(String(str == null ? "" : str).replace(/\{name\}/g, whoName));
    const wasPaused = !!s.officePaused;
    /* [feature:v2b-pause-event-start] */
    const releasePause = window.OfficePause
      ? (full.pause !== false ? OfficePause.acquire(this.core, "event") : function () {}) : null;
    if (!releasePause && full.pause !== false) s.officePaused = true;    // pause 由事件配置逐条指定
    /* [/feature:v2b-pause-event-start] */
    /* 2026-09-05 修 BUG：showOfficeEvent 在 timer 的 render({soft}) 之后才置暂停，
       而暂停后 timer 直接 return 不再渲染 —— 「已暂停」标签永远不亮，表现为静默冻结。
       置暂停后立即同步一次顶栏/标签显示（updateOfficeMain 是增量 diff，开销极小）。 */
    this.updateOfficeMain();

    const div = document.createElement("div");
    div.id = "ob-evspawn";
    div.className = "ev-spawn";
    /* ⚠️ 2026-09-29：选项**不加 disabled 属性**——卡片是弹出那一瞬按当时的经费算的，
       之后经费回升（周结算入账等）也不会重建，属性禁用会永久锁死（用户报的
       「钱还有四万却点不了交电费」）。置灰只当提示，真正的拦截放在点击时按当前经费重算。 */
    const opts = full.options || [];
    div.innerHTML = `
      <div class="ev-morph">
        <div class="ev-rings"><i></i><i></i><i></i></div>
        <img class="ev-ic" src="resource/ui/favicon.png" alt="" aria-hidden="true">
        <div class="ev-capsule-title">${rep(full.title)}</div>
        <div class="ev-body">
          <div class="ev-title">${rep(full.title)}</div>
          <div class="ev-text">${rep(full.desc)}</div>
          <div class="ev-opts">${opts.map((o, i) => {
            /* 2026-09-07 P3：付不起的选项置灰（"白嫖 30 万选项"）；
               2026-09-29：全部付不起时一律不置灰（否则零可点 → 死事件） */
            const bad = this.eventOptDisabled(o, s, opts, full.no);
            const status = this.core.eventOptionStatus && this.core.eventOptionStatus(o, full.no);
            return `<button class="ev-opt${bad ? " lack" : ""}" data-evopt="${i}"${bad ? ' title="' + this.escHtml(status && status.tip || "经费不足") + '"' : ""}>${rep(this.core.eventOptionText ? this.core.eventOptionText(o, full.no) : o.text)}</button>`;
          }).join("")}</div>
        </div>
        <button class="ev-min" type="button" title="缩小，去点开其它面板看信息" aria-label="缩小事件">—</button>
      </div>
      <div class="ev-hint">触发事件</div>`;
    this.el.appendChild(div);

    const refreshOptions = () => {
      div.querySelectorAll("[data-evopt]").forEach((button) => {
        const option = opts[+button.dataset.evopt];
        const status = this.core.eventOptionStatus && this.core.eventOptionStatus(option, full.no);
        const bad = this.eventOptDisabled(option, s, opts, full.no);
        button.textContent = rep(this.core.eventOptionText ? this.core.eventOptionText(option, full.no) : option.text);
        button.classList.toggle("lack", bad);
        button.title = bad ? (status && status.tip || "经费不足") : "";
      });
    };

    /* ①→② 点击圆点：横向展开成胶囊；480ms 后胶囊 → 卡片（CSS transition 接力） */
    div.querySelector(".ev-morph").addEventListener("click", () => {
      if (div.classList.contains("expand")) return;
      refreshOptions(); // 缩小时可以查看团队/涨薪，再展开必须按最新工资刷新留任报价。
      div.classList.remove("min");          // 从缩小态点回来：先回到居中再展开
      div.classList.add("expand");
      setTimeout(() => div.classList.add("open"), 480);
    });

    /* 2026-09-29（玩家要求）：卡片可以「缩小」回圆点，好让玩家去点开团队/招聘等
       二级面板查信息辅助判断。以前只有单向展开，事件卡（z-index 200）一直盖在二级
       面板（z-index 100）之上 —— 玩家在下班窗口触发挖人事件后想辞退当事人，
       点「辞退」按钮实际落在事件卡上，表现为「下班期间辞退点不动」（根因）。
       ⚠️ 必须 stopPropagation：本按钮在 .ev-morph 内，点击会冒泡到上面那个展开
       处理器；而这里又是同步摘掉 .expand，冒泡到时判定条件已失效 → 会立刻重新展开。 */
    const minBtn = div.querySelector(".ev-min");
    if (minBtn) minBtn.addEventListener("click", (e2) => {
      e2.stopPropagation();
      div.classList.add("min");
      div.classList.remove("open");
      div.classList.remove("expand");       // 宽高/圆角过渡：卡片 → 58px 圆点
    });

    /* 选项：结算 → 收起 → 恢复时间（pause=false 时原本就没暂停，恢复为初值即可）
       2026-09-05：选项若排队了小游戏（effects.minigame → startMinigame 弹「数据定期巡检」
       面板并接管暂停态），这里不能把时间恢复——交给巡检面板的 _mgWasPaused 逻辑。 */
    div.querySelectorAll("[data-evopt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const opt = opts[+btn.dataset.evopt];
        if (opt && this.core.eventOptionText && this.core.eventOptionStatus) {
          const quote = this.core.eventOptionStatus(opt, full.no);
          const currentText = rep(this.core.eventOptionText(opt, full.no));
          if (quote.active && btn.textContent !== currentText) {
            refreshOptions();
            this.toast(quote.ok ? "工资已变化，留任费用已更新，请确认新的金额" : quote.tip);
            return;
          }
        }
        /* 2026-09-29：按**点击当下**的经费重算（卡片可能已放了很久，经费早已回升） */
        if (opt && this.eventOptDisabled(opt, s, opts, full.no)) {
          const status = this.core.eventOptionStatus && this.core.eventOptionStatus(opt, full.no);
          this.toast(status && status.tip ? status.tip : "经费不足，这个选项现在选不了"); return;
        }
        const r = this.core.applyEventOption(full.no, +btn.dataset.evopt);
        if (r && r.ok === false && !r.retired) { this.toast(r.tip || "暂时无法处理此选项"); return; }
        /* [feature:v2b-pause-event-release] */
        if (releasePause) releasePause();
        else if (!s.minigame) s.officePaused = wasPaused;
        /* [/feature:v2b-pause-event-release] */
        div.classList.add("bye");
        setTimeout(() => div.remove(), 380);
        this.toast(r && r.tip ? r.tip : "已处理");
        this.save.autoSave(s);
        this.render({ soft: true });
        this.updateOfficeMain();
      });
    });
    return div;
  },

  /* ---------------- V3.5.2 语料看板 / 飘字（U11/U13） ---------------- */
  v35GapInfo() {
    const s = this.core.state;
    const tag = (s.v35 && s.v35.gapState) || "ok";
    return {
      ok:  { label: "充裕", cls: "" },
      tight: { label: "吃紧", cls: "warn" },
      warn:  { label: "告急", cls: "bad" },
      out:   { label: "断粮", cls: "bad" },
    }[tag] || { label: "充裕", cls: "" };
  },
  /* 语料仓库弹窗（U13）：大数字 + 区间进度条 + 收支 + 采购（外包品质随机说明） */
  /* 语料区间条：顶栏迷你版（mini=true）与语料仓库弹窗大号版。
     刻度与 GAP_SLOW 减速机制同源（2026-09-06）：红 0-60% / 黄 60-充裕线% / 绿 ≥充裕线%，
     充裕线 free 读 V35.GAP_SLOW.FREE_ABOVE（玩法配置可配），60 分界与 130% 满刻度为展示约定。 */
  gapFreeLine() {
    const gs = ((this.core.cfg || {}).V35 || {}).GAP_SLOW || {};
    const free = gs.FREE_ABOVE != null ? +gs.FREE_ABOVE : 90;
    return Math.max(61, Math.min(129, free));   // 保证三段都为正（分界线 60 / 满刻度 130）
  },
  corpusBarHTML(mini) {
    const s = this.core.state;
    const st = s.v35;
    if (!st) return "";
    const need = this.core.corpusDemand();
    const pct = (Math.floor(st.corpus.token) / Math.max(1, need)) * 100;
    const cur = Math.min(100, Math.min(pct, 130) / 1.3).toFixed(1);
    const cls = mini ? "corpus-mini" : "corpus-range";
    const p = this.gapFreeLine();
    const wLack = (60 / 1.3).toFixed(1), wTight = ((p - 60) / 1.3).toFixed(1), wOk = ((130 - p) / 1.3).toFixed(1);
    const tip = "语料区间：红=不足(<60%) / 黄=吃紧(60–" + p + "%) / 绿=充裕(≥" + p + "%)，竖线=本周需求";
    return `<span class="${cls}"${mini ? ' id="ob-corpus-bar"' : ""} title="${tip}">`
      + `<i class="${mini ? "cm" : "cr"}-seg lack" style="width:${wLack}%"></i><i class="${mini ? "cm" : "cr"}-seg tight" style="width:${wTight}%"></i><i class="${mini ? "cm" : "cr"}-seg ok" style="width:${wOk}%"></i>`
      + `<u class="${mini ? "cm" : "cr"}-cursor" style="left:${cur}%"></u></span>`;
  },

  /* ============ 鲸华社新闻页（微博式二级界面，2026-09-03 二改）============
     中间：信息流（鲸华社 BOT 发布的新闻，转发/评论/点赞数据随刷新浮动）；
     右侧：鲸搜热榜（每 HOT_REFRESH_MS 自动重排 + 打标签「爆/热/新」）。
     打开页面即清未读（badge 清零）；feed 条目带刷出动画（打开时 stagger 依次弹出）。 */
  omNews() {
    const s = this.core.state;
    s.newsUnread = 0;                                   // 点进来即已读
    this._newsTick = (this._newsTick || 0) + 1;
    this.startNewsHotTimer();
    const feed = s.newsFeed || [];
    const feedHtml = feed.length
      ? feed.map((n, i) => this.newsPostHTML(n, i)).join("")
      : `<div class="nw-empty">暂时没有新瓜……先去训练室卷一卷吧 🐋</div>`;
    return `<div class="news-weibo" id="newsWeibo">
      <div class="nw-feed">${feedHtml}</div>
      <div class="nw-side">${this.newsSideHTML()}</div>
    </div>`;
  },

  /* 伪随机互动数据：种子 = 新闻 id + 热榜刷新 tick（确定性，数值随刷新自然浮动） */
  newsStats(n, tick) {
    const str = (n.id || "") + "#" + (tick || 0);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return {
      reposts: 800 + h % 52000,
      comments: 300 + (h >>> 3) % 26000,
      likes: 1200 + (h >>> 6) % 88000,
    };
  },
  fmtWan(v) { return v >= 10000 ? Math.round(v / 10000) + "万" : String(Math.round(v || 0)); },

  newsPostHTML(n, i) {
    const s = this.core.state, c = this.core.cfg;
    const acc = c.NEWS_ACCOUNT || {};
    const st = this.newsStats(n, this._newsTick || 0);
    const liked = !!(s.newsLiked || {})[n.id];
    const time = n.date ? n.date : "第 " + (n.week || s.week) + " 周";
    /* 同事评论区（2026-09-05 新设计点）：feed 旧条目无 comments 时懒生成一次并写回
       （2026-09-05 修 BUG：漏传 {id} 导致 byId 定制评论对旧条目永远不生效） */
    if (!Array.isArray(n.comments)) { n.comments = this.core.buildNewsComments({ id: n.id }); }
    const cmts = n.comments || [];
    const cmtHtml = cmts.length ? cmts.map((cm) => `
          <div class="nw-cmt"><span class="nw-cmt-ava">${(cm.who || "?").charAt(0)}</span><span class="nw-cmt-body"><b class="nw-cmt-who">${cm.who}</b>${cm.t}</span></div>`).join("")
      : `<div class="nw-cmt nw-cmt-empty">还没有同事评论，抢个沙发……</div>`;
    /* 新闻配图（2026-09-13 用户要求）：条目配了 img 才渲染；老存档的 feed 没这个字段 → 不渲染。
       onerror 隐藏整块（路径写错时不留破图占位），与顶部账号头像同一套容错。
       点图看原图（openNewsImg）：整块是 [data-action]，点图上任意位置都命中。 */
    const imgHtml = n.img
      ? `<div class="nw-img" data-action="nw-img" data-src="${this.escAttr(n.img)}" title="点击看原图"><img src="${this.escAttr(n.img)}" alt="${this.escAttr(n.imgAlt || n.title || "")}" loading="lazy" onerror="this.parentNode.style.display='none'"></div>`
      : "";
    return `<div class="nw-post" style="animation-delay:${Math.min(i * 0.07, 0.6).toFixed(2)}s">
      <div class="nw-head">
        <img class="nw-avatar" src="${acc.avatar || ""}" alt="" onerror="this.style.visibility='hidden'">
        <div class="nw-meta">
          <div class="nw-user">${acc.name || "鲸华社 BOT"}<i class="nw-v" title="官方账号">✓</i></div>
          <div class="nw-time">${time} · ${n.src || "鲸华社 BOT"} · 来自鲸搜</div>
        </div>
      </div>
      <div class="nw-text"><b>${this.core.chatVar(n.title || "")}</b><br>${this.core.chatVar(n.text || "")}</div>
      ${imgHtml}
      <div class="nw-actions">
        <span>${this.icon("menu3", 13)} 转发 ${this.fmtWan(st.reposts)}</span>
        <span class="nw-cmt-btn" data-action="nw-cmt" data-id="${n.id}">${this.icon("chat", 13)} 评论 ${this.fmtWan(st.comments)}</span>
        <span class="nw-like${liked ? " on" : ""}" data-action="nw-like" data-id="${n.id}">${liked ? "❤️" : "🤍"} 点赞 ${this.fmtWan(st.likes)}</span>
      </div>
      <div class="nw-cmts" hidden>${cmtHtml}</div>
    </div>`;
  },

  /* 新闻配图放大看原图（2026-09-13 用户要求）：
     点图 → 全屏铺满看原图；再点一下 / 点空白处关闭。
     单例节点挂在 #app 上（**不放在信息流里**）—— 信息流会因刷新/点赞重建 innerHTML，
     挂在里面的话放大层会被一起冲掉。 */
  openNewsImg(src) {
    if (!src) return;
    let box = this.el.querySelector(".nw-lightbox");
    if (!box) {
      box = document.createElement("div");
      box.className = "nw-lightbox";
      box.innerHTML = `<img alt=""><div class="nw-lightbox-tip">点击任意处关闭</div>`;
      box.addEventListener("click", () => box.classList.remove("show"));
      this.el.appendChild(box);
    }
    const im = box.querySelector("img");
    if (im) im.src = src;
    box.classList.add("show");
  },

  newsSideHTML() {
    const s = this.core.state, c = this.core.cfg;
    const cnt = (c.NEWS_PAGE || {}).HOT_COUNT || 8;
    const feed = s.newsFeed || [];
    const tick = this._newsTick || 0;
    /* 热搜榜 = 最近 N 条新闻按「本 tick 热度」排序（hash 随 tick 变 → 顺序与热度值自然浮动） */
    const items = feed.slice(0, cnt).map((n) => {
      const st = this.newsStats(n, tick);
      return { id: n.id, word: this.core.chatVar(n.title || ""), heat: st.likes + st.reposts * 2 + st.comments * 3 };
    }).sort((a, b) => b.heat - a.heat);
    const rows = items.map((it, i) => {
      const tag = i === 0 ? "爆" : i === 1 ? "热" : (i <= 3 ? "新" : ((it.heat + tick) % 9 === 0 ? "沸" : ""));
      return `<li>
        <span class="nw-rank${i < 3 ? " top" : ""}">${i + 1}</span>
        <span class="nw-word">${it.word}</span>
        ${tag ? `<i class="nw-tag nw-tag-${tag}">${tag}</i>` : ""}
        <span class="nw-heat">${this.fmtWan(it.heat)} 热度</span>
      </li>`;
    }).join("");
    return `<div class="nw-side-card">
      <div class="nw-side-head">🔥 鲸搜热榜<span class="nw-side-tip">每 ${Math.round(((c.NEWS_PAGE || {}).HOT_REFRESH_MS || 60000) / 1000)} 秒刷新</span></div>
      <ol class="nw-hot">${rows || '<li class="nw-hot-empty">热搜空空如也，等等看</li>'}</ol>
    </div>
    <div class="nw-side-card nw-side-foot">📢 榜单与数据由鲸华社 BOT 实时整活，如有雷同纯属巧合</div>`;
  },

  /* 热榜刷新定时器：面板开着才工作（每 tick 重渲染 feed 数据 + 热榜重排），关面板自清 */
  startNewsHotTimer() {
    if (this._newsHotTimer) return;
    this._newsHotTimer = setInterval(() => {
      const box = this.el.querySelector("#modalContainer");
      const alive = box && box.dataset.modalKey === "news" && box.querySelector("#newsWeibo");
      if (!alive) { clearInterval(this._newsHotTimer); this._newsHotTimer = null; return; }
      this._newsTick = (this._newsTick || 0) + 1;
      const s = this.core.state;
      const feedEl = box.querySelector(".nw-feed");
      const sideEl = box.querySelector(".nw-side");
      if (feedEl) {
        /* 数据刷新保阅读进度（2026-09-05 用户反馈）：记录滚动位置，重建 DOM 后恢复；
           展开的同事评论区也会被重建，一并记录展开态恢复 */
        const st0 = feedEl.scrollTop;
        const openIds = [...feedEl.querySelectorAll(".nw-cmts:not([hidden])")]
          .map((el) => { const p = el.closest(".nw-post"); const b = p && p.querySelector(".nw-cmt-btn"); return b && b.dataset.id; })
          .filter(Boolean);
        feedEl.innerHTML = (s.newsFeed || []).length
          ? (s.newsFeed || []).map((n, i) => this.newsPostHTML(n, i)).join("")
          : `<div class="nw-empty">暂时没有新瓜……先去训练室卷一卷吧 🐋</div>`;
        feedEl.scrollTop = st0;
        openIds.forEach((id) => {
          const btn = feedEl.querySelector('.nw-cmt-btn[data-id="' + id + '"]');
          const cbox = btn && btn.closest(".nw-post") && btn.closest(".nw-post").querySelector(".nw-cmts");
          if (btn && cbox) { cbox.hidden = false; btn.classList.add("on"); }
        });
      }
      if (sideEl) sideEl.innerHTML = this.newsSideHTML();
    }, (this.core.cfg.NEWS_PAGE || {}).HOT_REFRESH_MS || 60000);
  },

  /* 语料仓库（V3.5.3 重排版）：大数字 + 对齐的区间条/图例 + 品质库存（背包式）+ 采购 */
  omCorpus() {
    const s = this.core.state;
    const c = this.core.cfg.V35;
    const st = s.v35;
    if (!st) return this.omEmpty("corpus");
    const need = this.core.corpusDemand();
    const prod = Math.round(this.core.corpusProduction());
    const have = Math.floor(st.corpus.token);
    const g = this.v35GapInfo();
    const q = (st.corpus.q && st.corpus.q.length === 3) ? st.corpus.q : [st.corpus.items || 0, 0, 0];
    const mult = c.QUALITY_MULT || [0.5, 1.0, 1.5];
    const qbar = window.V35.qbar(st);
    const bonus = window.V35.qualityBonus(st);
    const qTier = qbar < 0.55 ? "粗劣" : qbar < 0.75 ? "普通为主" : qbar < 0.95 ? "良好为主" : "优质";
    const pct = Math.max(0, Math.min(130, (have / Math.max(1, need)) * 100));
    const price = Math.round(100 * c.CORPUS_CURVE.BUY.price);
    /* 每周增量现在由「架构 × 参数」决定（不再是一个写死的常数），判定要跟着走 */
    const lack = prod < this.core.corpusWeekAdd();
    /* 区间进度条（满刻度 = 需求的 130%）：红 0-60% 不足 / 黄 60-充裕线% 吃紧 / 绿 ≥充裕线% 充裕。
       2026-09-06 与 GAP_SLOW 减速机制同步，充裕线读 V35.GAP_SLOW.FREE_ABOVE（配置可改）。
       游标 = 持有；图例三段与色段等宽，位置严格对齐。 */
    const fp = this.gapFreeLine();
    const bar = `
      <div class="corpus-range" title="游标 = 当前持有占本周需求的百分比">
        <i class="cr-seg lack" style="width:${(60 / 1.3).toFixed(1)}%"></i><i class="cr-seg tight" style="width:${((fp - 60) / 1.3).toFixed(1)}%"></i><i class="cr-seg ok" style="width:${((130 - fp) / 1.3).toFixed(1)}%"></i>
        <div class="cr-cursor" style="left:${(Math.min(pct, 130) / 1.3).toFixed(1)}%" title="当前持有 ${have} 亿 token"></div>
      </div>
      <div class="corpus-range-legend">
        <span class="lack" style="width:${(60 / 1.3).toFixed(1)}%">不足 &lt;60%</span><span class="tight" style="width:${((fp - 60) / 1.3).toFixed(1)}%">吃紧 60–${fp}%</span><span class="ok" style="width:${((130 - fp) / 1.3).toFixed(1)}%">充裕 ≥${fp}%</span>
      </div>`;
    /* 品质库存（背包式）：三档各自条数 + 单条倍率 + 折算 token */
    const qCard = (name, cls, count, m) => `
      <div class="cm-quality ${cls}">
        <div class="cmq-head"><i class="cmq-dot"></i>${name}</div>
        <div class="cmq-count">${count}<i>条</i></div>
        <div class="cmq-sub">×${m} 亿 token/条 · ${Math.round(count * m)} 亿 token</div>
      </div>`;
    return `
      <div class="corpus-modal">
        <div class="cm-hero">
          <div class="cm-num">${have}<span> 亿 token</span></div>
          <span class="corpus-gap ${g.cls}">${g.label}</span>
        </div>
        ${bar}
        <div class="cm-quality-grid">
          ${qCard("普通", "normal", Math.round(q[0]), mult[0])}
          ${qCard("良好", "good", Math.round(q[1]), mult[1])}
          ${qCard("优质", "prime", Math.round(q[2]), mult[2])}
        </div>
        ${this.corpusSupplyCards(need, prod, qbar, qTier, bonus, lack)}
        <div class="cm-buy">
          ${this.corpusBuyBlock(c)}
        </div>
      </div>`;
  },
  /* 语料供需胶囊看板：需求 vs 产量对比 + 平均品质（替代原来的纯文本行，U13 胶囊化） */
  corpusSupplyCards(need, prod, qbar, qTier, bonus, lack) {
    const d = this.core.corpusWeekAdd();
    const ok = d <= prod;
    const pctDemand = Math.min(100, (prod / Math.max(1, d)) * 100);
    /* 数据工程师到岗前不显示"在产"观感：产量行改为等待提示 */
    const waiting = prod <= 0;
    /* 2026-09-16（用户：「明明已经很充足的情况下就不要弹红色的提醒了」）：
       「库存充裕」= 引擎 gapState 为 ok（持有 ÷ 累计需求 ≥ 充裕线，与顶部徽章同一口径）。
       周产量低于周新增只是**流量**缺口：库存储备够厚时，缺口是在吃库存、不是告急——
       （实测 16861 亿库存、每周差 65 亿 ≈ 两百多周才见底，而一局最多几十周）
       红色警示只在「有流量缺口 **且** 库存也撑不住」时出现。 */
    const supplyOk = !this.v35GapInfo().cls;
    const alarm = lack && !supplyOk;
    /* 需求/产量对比条：产量刻度 = 按需求归一到 100% */
    const barBlock = `
      <div class="cm-sup-chart">
        <div class="cms-row">
          <span class="cms-lab">本周新增需求</span>
          <div class="cms-track"><div class="cms-fill need" style="width:100%"></div><i class="cms-mark" style="left:100%"></i></div>
          <b class="cms-val">${d}<i> 亿</i></b>
        </div>
        <div class="cms-row">
          <span class="cms-lab">每周产量${"（理论）"}</span>
          ${waiting
            ? `<div class="cms-track"><div class="cms-fill wait" style="width:0%"></div></div><b class="cms-val wait">${this.icon("clock", 13)} 待数据工程师到岗</b>`
            : `<div class="cms-track"><div class="cms-fill ${alarm ? "lack" : "ok"}" style="width:${pctDemand}%"></div></div>
               <b class="cms-val ${alarm ? "lack" : "ok"}">≈${prod}<i> 亿</i></b>`}
        </div>
      </div>`;
    const verdict = waiting
      ? `<span class="cm-verdict wait">${this.icon("clock", 12)} 到岗开工后开始产语料</span>`
      : ok
        ? `<span class="cm-verdict avant">${this.icon("check", 12)} 产量充足</span>`
        : supplyOk
          ? `<span class="cm-verdict avant">${this.icon("check", 12)} 库存足以覆盖缺口</span>`
          : `<span class="cm-verdict lack">${this.icon("x", 12)} 产量吃紧</span>`;
    const qualityChip = `
      <div class="cm-quality-chip">
        <span class="cmqc-dot" style="background:${qbar >= 0.95 ? "#f2b84b" : qbar >= 0.75 ? "#6fc99a" : qbar >= 0.55 ? "#9aa8b5" : "#797f88"}"></span>
        <span>平均品质 <b>${qbar.toFixed(2)}</b></span>
        <span class="cmqc-tier">${qTier}</span>
        <span class="cmqc-bonus">${bonus > 0 ? `评审通过 +${bonus}%` : "评审无加成"}</span>
      </div>`;
    /* 红框只在**真的会出事**时出现（流量缺口 + 库存也撑不住）；库存充裕时不出，
       否则玩家刚看完成千上万点库存、转头被"缺口会越拉越大"吓一跳。 */
    const lackTip = alarm && !waiting
      ? `<div class="cm-lack-tip">${this.icon("alert", 13)} 周产量低于周新增需求，缺口会越拉越大——建议招募数据工程师或定期购买补足</div>`
      : "";
    /* 语料不足阶梯惩罚说明（2026-09-05 用户拍板并要求写进说明） */
    const gs = (this.core.cfg.V35 || {}).GAP_SLOW || {};
    const free = gs.FREE_ABOVE != null ? gs.FREE_ABOVE : 90;
    const step = gs.STEP != null ? gs.STEP : 10;
    /* 2026-09-16：这条是**常驻机制说明**（GAP_SLOW 阶梯惩罚），不是当前告警 ——
       改用中性 cm-info-tip；以前借 cm-lack-tip 的红色皮，库存充裕时也挂着个红框。 */
    const slowTip = `<div class="cm-info-tip">${this.icon("clock", 13)} 语料不足会拖慢团队产出节奏：满足率 ≥${free}% 无影响，每再低 ${step}%，产出周期 +1 秒（如 10 秒 → 12 秒）</div>`;
    return `            
        <div class="cm-supply">
          ${barBlock}
          <div class="cms-foot">${verdict}${qualityChip}</div>
        </div>
        ${lackTip}
        ${slowTip}`;
  },
  /* 外包采购胶囊化：抽卡式品质预览 + 单价/按钮 */
  corpusBuyBlock(c) {
    const price = Math.round(100 * (c.CORPUS_CURVE.BUY.price));
    return `
      <div class="cm-buy-title">外包采购</div>
      <div class="cm-buy-odds">
        <span class="cbo-item normal"><i class="cbdot"></i>普通 80%<em>1条=0.5 亿 token</em></span>
        <span class="cbo-item good"><i class="cbdot"></i>良好 20%<em>1条=1 亿 token</em></span>
      </div>
      <button class="skew-btn pink" data-action="buy-corpus" style="width:100%">
        ${this.icon("download", 14)}<span>一次采购 100 条 · ${price} 万</span></button>`;
  },
  /* 产出飘字（U11）：从对应岗位工程师头像飞出 +N；论文触发从文字条飞出。
     V3.5.3：产出加亮加粗 + 配音效（用户 2026-09-01 明确要求） */
  renderOfficeFloats(floats) {
    if (!floats || !floats.length || !this.core.v35On()) return;
    const s = this.core.state;
    const modern=this.core.embodiedAvailable&&this.core.embodiedAvailable();
    if(modern){const grouped=new Map();for(const f of floats){
      const dim=['code','text'].includes(f.dim)?'codeText':['safety','stability'].includes(f.dim)?'safetyStability':f.dim;
  /* [feature:multi-trait-dev-ui-001] */
      const key=f.who+':'+(f.engId != null ? f.engId : f.slot)+':'+dim,old=grouped.get(key);
  /* [/feature:multi-trait-dev-ui-001] */
      if(old){old.amount+=f.amount;old.focus=old.focus||f.focus;}else grouped.set(key,{...f,dim});
    }floats=[...grouped.values()];}
    const roleEng = {};
  /* [feature:multi-trait-dev-ui-002] */
    for (const role of ["pre", "data", "post", "embodied"]) {
      roleEng[role] = this.core.productionRoleEngs(s.v35, role);
  /* [/feature:multi-trait-dev-ui-002] */
    }
    /* 产出音效：同一 tick 内只响一次（静音时也会走，AudioMgr 内部会兜底） */
    let didSfx = false;
    for (const f of floats) {
      let host = null;
      if (f.who === "paper") host = this.el.querySelector('.stat-item[data-stat="'+(modern?'codeText':'text')+'"]');
      else {
  /* [feature:multi-trait-dev-ui-003] */
        const crew = roleEng[f.who] || [];
        const producer = crew[f.slot != null ? f.slot : 0];
        const engId = f.engId != null ? f.engId : (producer && producer.id);
  /* [/feature:multi-trait-dev-ui-003] */
        host = engId ? this.el.querySelector(`.emp-marker[data-eng="${engId}"] .emp-avatar`) : null;
      }
      if (!host) continue;
      const n = Math.max(1, Math.round(f.amount));
      /* 加亮加粗的产出飘字（gold）；**轴产出带轴配色**（doc/27 §5）——
         四维仍走默认金色，轴用自己那根的颜色，一眼能认出"这 +N 是轴给的"。 */
      /* axisSolid 对四维返回 ""，所以这里不必先判类型 */
      const axColor = this.axisSolid(f.dim);
  /* [feature:office-feedback-ui-4] */
      this.floatText(host, `+${n} ${this.statLabel(f.dim)}`, true, axColor, { amount:n, dim:f.dim });
  /* [/feature:office-feedback-ui-4] */
      /* 冒数字音效：专属 float 事件（灵感爆发 focus 仍用 confirm 强调） */
      if (!didSfx && window.SFX) { SFX.play(f.focus ? "confirm" : "float"); didSfx = true; }
    }
  /* [feature:office-feedback-ui-5] */
  },

  /* [feature:office-production-layer-queue-20261013] */
  /* Production text belongs to the scene. Its collision boxes stay in screen
     pixels; only the final drawing coordinates are converted to scene pixels. */
  clearOfficeProductionFloats() {
    if (this._officeFloatTimer) clearTimeout(this._officeFloatTimer);
    this._officeFloatTimer = null; this._officeFloatQueue = [];
    if (this.el) this.el.querySelectorAll(".office-production-float").forEach(n => n.remove());
  },
  officeProductionVisible(node) {
    if (!node || !node.isConnected || node.hidden || node.closest("[hidden]")) return false;
    for (let p=node; p; p=p.parentElement) {
      const css=getComputedStyle(p);
      if (css.display === "none" || css.visibility === "hidden" || css.visibility === "collapse") return false;
    }
    const r=node.getBoundingClientRect(); return r.width>0 && r.height>0;
  },
  officeProductionBlocked(checkDOM) {
    const s=this.core && this.core.state;
    if (!s || s.phase!=="office" || s.officeModal || s.officePaused || document.hidden || this._modal || this._confirmOpen || this._fireOpen || this._embodiedPodExitBusy) return true;
    for (const api of [window.OfficeMore,window.WhaleRoom,window.LifeFinale]) if (api && typeof api.isOpen==="function" && api.isOpen()) return true;
    if (window.ArcadeGlue && ArcadeGlue.active) return true;
    this._officeProductionPanels=(this._officeProductionPanels || []).filter(n => n.isConnected);
    if (this._officeProductionPanels.some(n => this.officeProductionVisible(n))) return true;
    if (!checkDOM) return false;
    // This bounded fallback runs only while output is pending/visible, never
    // from an office tick or a permanent observer. Rank/finale can live on body.
    return Array.from(document.querySelectorAll(".modal-mask,.dg-modal-mask,.set-pop-mask,.v2b-panel-host,.chat-zoom-mask,.nw-lightbox,.embodied-overlay,.life-finale,.dg-train-anim,.ev-spawn,.insp-overlay,.sub-modal-overlay")).some(n => this.officeProductionVisible(n));
  },
  installOfficeProductionLifecycle() {
    const ui=this;
    if (!this._officeProductionLifecycleInstalled) {
      this._officeProductionLifecycleInstalled=true;
      for (const name of ["renderOfficeModal","renderSaveModal","openSettingsPop","openCodexPop","openRank","openNewsImg","chatZoom","showOfficeEvent","showMinigameSpawn"]) {
        const original=this[name]; if (typeof original!=="function") continue;
        this[name]=function () {
          if (name!=="renderOfficeModal" || ui.core && ui.core.state && ui.core.state.officeModal) ui.clearOfficeProductionFloats();
          return original.apply(this,arguments);
        };
      }
      const click=this.onClick;
      this.onClick=function (event) {
        const target=event && event.target && event.target.closest && event.target.closest("[data-action]");
        if (target && ["office-view","office-pause","office-modal","open-save","open-help"].includes(target.dataset.action)) ui.clearOfficeProductionFloats();
        return click.apply(this,arguments);
      };
      window.addEventListener("resize",() => ui.clearOfficeProductionFloats());
    }
    const panels=window.V2Panels;
    if (panels && typeof panels.open==="function" && panels.open._officeProductionOwner!==ui) {
      const open=panels.open;
      panels.open=function () {
        ui.clearOfficeProductionFloats(); const panel=open.apply(this,arguments);
        ui._officeProductionPanels=(ui._officeProductionPanels || []).filter(n => n.isConnected);
        if (panel && panel.host) ui._officeProductionPanels.push(panel.host);
        return panel;
      };
      panels.open._officeProductionOwner=ui;
    }
  },
  queueOfficeFloat(host, amount, dim, color) {
    this.installOfficeProductionLifecycle();
    const state=this.core.state;
    if (this.officeProductionBlocked(false)) { this.clearOfficeProductionFloats(); return; }
    this._officeFloatQueue=(this._officeFloatQueue || []).filter(f => f.state===state && f.host.isConnected);
    const old=this._officeFloatQueue.find(f => f.host===host && f.dim===dim);
    if (old) old.amount+=amount; else this._officeFloatQueue.push({host,amount,dim,color,state});
    if (!this._officeFloatTimer) this.drainOfficeFloats();
  },
  drainOfficeFloats() {
    this._officeFloatTimer=null;
    const state=this.core.state, scene=this.el && this.el.querySelector(".office-scene");
    const queue=this._officeFloatQueue=(this._officeFloatQueue || []).filter(f => f.state===state && f.host.isConnected);
    if (!scene || this.officeProductionBlocked(queue.length || scene.querySelector(".office-production-float"))) { this.clearOfficeProductionFloats(); return; }
    if (!queue.length) return;
    const frame=scene.getBoundingClientRect(), sx=frame.width/(scene.offsetWidth || scene.clientWidth || frame.width), sy=frame.height/(scene.offsetHeight || scene.clientHeight || frame.height);
    const left=frame.left+(scene.clientLeft || 0)*sx, top=frame.top+(scene.clientTop || 0)*sy;
    const width=(scene.clientWidth || scene.offsetWidth || frame.width)*sx, height=(scene.clientHeight || scene.offsetHeight || frame.height)*sy;
    if (!(sx>0 && sy>0 && width>12 && height>12)) { this.clearOfficeProductionFloats(); return; }
    let layer=scene.querySelector(".office-production-layer");
    if (!layer) { layer=document.createElement("div"); layer.className="office-production-layer"; layer.setAttribute("aria-hidden","true"); scene.appendChild(layer); }
    const f=queue[0], r=f.host.getBoundingClientRect();
    if (!r.width || !r.height) queue.shift();
    else {
      const fl=document.createElement("span");
      fl.className="dg-work-float crit office-production-float"+(f.color ? " ax" : "");
      if (f.color) fl.style.color=f.color;
      fl.style.fontSize=(window.innerWidth<=600 ? 11 : 12)/sx+"px";
      fl.style.setProperty("--office-float-rise-start",8/sy+"px");
      fl.style.setProperty("--office-float-rise-mid",-2/sy+"px");
      fl.style.setProperty("--office-float-rise-end",-28/sy+"px");
      fl.textContent="+"+(Math.round(f.amount*10)/10)+" "+this.statLabel(f.dim);
      fl.style.visibility="hidden"; layer.appendChild(fl);
      const box=fl.getBoundingClientRect(), w=Math.max(1,(fl.offsetWidth ? fl.offsetWidth*sx : box.width)*1.12+12), h=Math.max(1,(fl.offsetHeight ? fl.offsetHeight*sy : box.height)*1.12+44);
      const live=Array.from(layer.querySelectorAll(".office-production-float[data-footprint]")).map(n => JSON.parse(n.dataset.footprint));
      const side=(this._officeFloatSide=(this._officeFloatSide || 0)+1)%2 ? -1 : 1;
      const candidates=[side,-side,0].flatMap(sign => [-12,-h-8,18].map(dy => ({
        x:Math.max(left+6,Math.min(left+width-w-6,r.left+r.width/2+sign*(w/2+8)-w/2)),
        y:Math.max(top+6,Math.min(top+height-h-6,r.top+dy)),w,h
      })));
      const q=candidates.find(p => p.x+p.w<=left+width-6 && p.y+p.h<=top+height-6 && live.every(a => p.x>=a.x+a.w+6 || p.x+p.w+6<=a.x || p.y>=a.y+a.h+6 || p.y+p.h+6<=a.y));
      if (q) {
        fl.dataset.footprint=JSON.stringify(q); fl.style.left=(q.x+q.w/2-left)/sx+"px"; fl.style.top=(q.y+32-top)/sy+"px";
        fl.style.visibility=""; queue.shift(); setTimeout(() => fl.remove(),950);
      } else fl.remove();
    }
    this._officeFloatTimer=setTimeout(() => this.drainOfficeFloats(),260);
  /* [/feature:office-production-layer-queue-20261013] */
  /* [/feature:office-feedback-ui-5] */
  },

  /* ============ 工程师状态气泡（2026-09-03）============
     每 30~60s（OFFICE_BUBBLE.EVERY_MS）随机一名在场工程师头顶冒泡 4s：
     体力<30 → 疲惫池「好累啊...」；下班窗口（V35.OFF_START 起 OFF_LEN 个 tick）→ 下班池
     「终于下班了...」；攻关中 → 攻关池；其余 → 正常工作台词池（WORK_BUBBLES）。 */
  startOfficeBubbleTimer() {
    if (this._bubbleTimer) return;
    const schedule = () => {
      const bc = this.core.cfg.OFFICE_BUBBLE || {};
      const [a, b] = bc.EVERY_MS || [30000, 60000];
      this._bubbleTimer = setTimeout(() => {
        this._bubbleTimer = null;
        const s = this.core.state;
        /* !s.officeModal（2026-09-16）：二级面板开着时别在背后白泡，等面板关了再冒 */
        if (s && s.phase === "office" && !s.officePaused && !s.officeModal
            && !(this.core.guidePending && this.core.guidePending())) {
          this.spawnOfficeBubble();
        }
        schedule();
      }, a + Math.random() * Math.max(0, b - a));
    };
    schedule();
  },

  spawnOfficeBubble() {
    const s = this.core.state, c = this.core.cfg;
    /* 2026-09-16：只从「场景里真有标记」的人里抽 —— 原来随机到没座位的工程师会
       在下面 marker 判空处静默 return，一次冒泡机会白费（人越多浪费概率越大）。 */
    const alive = (s.engineers || []).filter((e) => !e.resigned
  /* [feature:office-feedback-ui-6] */
      && (e.joinTick == null || (s.v35 && s.v35.tick != null && s.v35.tick >= e.joinTick))
      && (e.restWeek == null || e.restWeek !== (s.week || 0))   // 休假（本周休息）：同待入职，不在场 → 不冒泡
  /* [/feature:office-feedback-ui-6] */
      && this.el.querySelector(`.emp-marker[data-eng="${e.id}"]`));
    if (!alive.length || !s.planDone) return;
    const st = s.v35 || {};
    const v35 = c.V35 || {};
    /* 下班窗口：与引擎 v35_core.inOff 同一判定（全局 tick 落在 OFF_START ~ +OFF_LEN） */
    const offwork = st.tick != null && st.tick >= (v35.OFF_START || 18)
      && st.tick < (v35.OFF_START || 18) + (v35.OFF_LEN || 3);
    let pool, who;
    const tired = alive.filter((e) => (e.energy || 0) < 30);
    if (tired.length) {
      pool = c.WORK_BUBBLES_TIRED || ["好累啊..."];
      who = tired[Math.floor(Math.random() * tired.length)];
    } else if (offwork) {
      pool = c.WORK_BUBBLES_OFFWORK || ["终于下班了..."];
      who = alive[Math.floor(Math.random() * alive.length)];
    } else if (s.focusBoost) {
      pool = c.WORK_BUBBLES_FOCUS || [];
      who = alive[Math.floor(Math.random() * alive.length)];
    } else {
      pool = c.WORK_BUBBLES || [];
      who = alive[Math.floor(Math.random() * alive.length)];
    }
    if (!pool.length) return;
    const marker = this.el.querySelector(`.emp-marker[data-eng="${who.id}"]`);
    if (!marker || marker.querySelector(".emp-bubble")) return;
    const bub = document.createElement("div");
    bub.className = "emp-bubble";
    bub.textContent = pool[Math.floor(Math.random() * pool.length)];
    marker.appendChild(bub);
    const show = (c.OFFICE_BUBBLE || {}).SHOW_MS || 4000;
    setTimeout(() => bub.classList.add("bye"), Math.max(100, show - 300));
    setTimeout(() => bub.remove(), show);
  },

  stopBubbleTimer() {
    if (this._bubbleTimer) { clearTimeout(this._bubbleTimer); this._bubbleTimer = null; }
  },



  /* 工程师三状态取值：兼容 status 子对象与直接挂在工程师上的两种存档结构 */
  /* 体力显示的唯一真源：
     2026-09-22 起体力是**每人一份**（真源 e.energy），岗位标量 s.v35.energy[role] 只
     剩余「人均值」的派生含义 —— 显示某人的体力就必须读**他自己**的 e.energy。
     （旧注释说「引擎槽才是真源、e.energy 只是镜像」是共享槽时代的写法，已废。） */
  engEnergy(e) {
    return Math.round(e.energy || 0);
  },
  statusVal(e, k) {
    if (k === "energy") return this.engEnergy(e);
    const v = (e.status && e.status[k] != null) ? e.status[k] : e[k];
    return v == null ? 70 : v;
  },


  effectsText(eff) {
    if (!eff || !Object.keys(eff).length) return "";
    const map = {
      code: "代码", text: "文字", safety: "安全", stability: "稳定",
      funding: "经费", brand: "品牌", time_cost: "时间",
    };
    const parts = [];
    for (const [k, v] of Object.entries(eff)) {
      if (map[k] && v) parts.push(`${map[k]} ${v > 0 ? "+" : ""}${k === "funding" ? fmtMoney2(v) : Math.round(v)}`);
      else if (k === "funding") parts.push(`经费 ${fmtMoney2(v)}`);
      else if (k === "brand") parts.push(`品牌 ${v > 0 ? "+" : ""}${Math.round(v)}`);
      else if (k === "reputation") parts.push(`口碑 ${v > 0 ? "+" : ""}${v}★`);
      else if (k === "time_cost") parts.push(`时间 +${v}周`);
      else if (k === "parallel") parts.push("并行训练");
      /* 08 §9 P2 事件池：随机/条件结果与团队状态（选项文案已写明的不再重复，只补隐藏信息） */
      else if (k === "rand") parts.push("结果随机");
      else if (k === "if_stability_below") parts.push(`稳定 <${v} 有风险`);
      else if (k === "if_stat") parts.push("结果取决于能力");
      else if (k === "chance") parts.push("成功率与品牌相关");
      else if (k === "quit_risk") parts.push("下回合有人可能离职");
      else if (k === "target_resign") parts.push("TA 离职");
      else if (k === "target_trait_up") parts.push("TA 最高词条 +1");
      else if (k === "cand_bonus") parts.push("下轮候选 +1");
      else if (k === "investor") parts.push("此后需定期汇报");
      else if (k === "growth_pct") parts.push(`下轮成长 ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`);
      else if (k === "team_stat") parts.push(this.statText(v, "全员"));
      else if (k === "target_stat") parts.push(this.statText(v, "TA"));
    }
    return parts.join(" · ");
  },

  /* 工程师状态变动文案（2026-09-04）：只列体力。
     干劲/忠诚/协作都是废弃数值，写进提示等于承诺不存在的变化。 */
  statText(d, who) {
    const m = { energy: "体力" };
    return Object.entries(d).filter(([, v]) => v)
      .map(([k, v]) => `${who}${m[k] || k}${v > 0 ? "+" : ""}${Math.round(v)}`).join(" ");
  },

  /* ---------------- 内部评审（V3.5.3：旧「验收评审」整页 UI 已删除）----------------
     新流程：评审面板（omReview）由玩家点「开始评审」→ enterReview + buildEvalShow
     → 评审答题动画（renderEvalShow）→ finish → 三幕结算演出（renderBonus）
     → 第三幕主按钮 = 进入下一阶段 / 重训本阶段 / 末版通过后再战 V4.5。
     2026-09-17：通过 V4.5 已不再跳 renderOver 终局页（用户要求「重复 V4.5 阶段」）。 */

  /* ---------------- 结算收益文案（over 结算页专用；通过流程已由三幕结算演出覆盖）----------------
     全版本都有用户（内测千人级 / 公测百万级，core.finish 统一计算），这里只读。
     名次由**评审分**对榜现算（game_core.finish 写进 s.rank）。 */
  /* [feature:review-stage-budget-display] */
  settlementFundsHTML() {
    const current = Math.round(Number(this.core.state.funding) || 0);
    return '<div class="bonus-fund settlement-funds" aria-label="结算经费明细"><span data-funding-current="' + current
      + '">本轮结算后经费 <b>' + fmtMoney(current) + '</b></span></div>';
  },

  /* [/feature:review-stage-budget-display] */
  verdictRewardsHTML(r) {
    const s = this.core.state;
    /* 小模型收益已经在 items 明细里算过一次，这里只是标注，不能再加一遍（旧版重复累加过） */
    const total = (s.bonus && s.bonus.total) || 0;
    const miniTxt = (r.miniBonus || 0) > 0 ? `（含小模型 ${r.miniBonus / 10000} 万）` : "";
    if (r.usersGained != null && this.core.isPassLike(r)) {
      const gained = r.usersGained;
      return `
        <div class="dg-over-rewards">
          <span>本轮奖金 <b>+${fmtMoney(total)}</b>${miniTxt}</span>
          <span>新增用户 <b>${gained.toLocaleString()}</b>（累计 ${(s.users || 0).toLocaleString()}）</span>
          <span>全球模型能力榜 <b>第 ${s.rank || "—"} 名</b></span>
          ${r.brandAdd ? `<span>品牌值 <b>${r.brandAdd > 0 ? "+" : ""}${r.brandAdd}</b>（当前 ${r.brandNow != null ? r.brandNow : Math.round(s.brand || 0)}）</span>` : ""}
        </div>`;
    }
    return `
      <div class="dg-over-rewards">
        <span>本轮结算收益 <b>+${fmtMoney(total)}</b> ${miniTxt}</span>
        <span>${r.verdict === "veto" ? "评审未通过" : "反馈平平"}（评审通过后计入用户与全球模型能力榜）</span>
        ${r.brandAdd ? `<span>品牌值 <b>${r.brandAdd > 0 ? "+" : ""}${r.brandAdd}</b>（当前 ${r.brandNow != null ? r.brandNow : Math.round(s.brand || 0)}）</span>` : ""}
      </div>`;
  },

  /* ---------------- 结算 ---------------- */
  renderOver() {
    const s = this.core.state;
    /* V3.5.2 破产结局（唯一真失败）：不走常规结算，直接 Game Over 卡 */
    if (s.bankrupt) {
      /* 维度驱动（doc/27 P3/P4）：破产页也带轴；.dg-over-stats 本来就是 flex-wrap，多几枚胶囊自动换行 */
      const stats = this.modelDims(s)
        .map((d) => `<span class="dg-over-stat">${d.label} <b>${Math.round(this.modelValue(d.key,s))}</b></span>`).join("");
      this.el.innerHTML = `
        <div class="dg-over">
          <div class="dg-over-emoji">💀</div>
          <div class="dg-over-title">Game Over · 公司破产</div>
          <div class="dg-over-desc">母公司的拨款已经填不上工资的窟窿，账上分文不剩。<br>「${this.tpl("{model}")}」的研发到此为止——但这些经验不会白费，下一局会走得更稳。</div>
          <div class="dg-over-stats">${stats}</div>
          <div class="dg-over-score">存活 ${s.week} 周 · 版本 ${s.ver}</div>
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="newgame">🔁 重新开始</button>
            <button class="dg-btn" data-action="save">💾 查看存档</button>
          </div>
        </div>`;
      return;
    }
    const r = s.result;
    const verdictMap = {
      /* 结局文案用玩家自定义的模型名（{model} 占位符）；2026-09-03 去掉 emoji，改用立绘表达情绪 */
      pass: { t: "通过内部评审", d: "恭喜！「{model}」通过内部评审，追加研发经费。下一阶段将继续深化训练。" },
      excellent: { t: "优秀评审！", d: "总评远超目标！额外奖励品牌值与经费加成，团队状态正好。" },
      top: { t: "顶尖评审！！", d: "全场沸腾！「{model}」达到顶尖水准！最高规格奖励奉上，研发日志已可载入史册。" },
      fail: { t: "内部否决", d: "未能达到内部评审标准，需重新训练（保留部分经费）。可读档回到关键节点重试。" },
      veto: { t: "强制内部否决", d: "安全性不达标被内部否决，品牌值下降。安全是底线！" },
    };
    /* 2026-09-04：通过评审的流程已在奖励演出页走完（数值对比 / 奖金 / 收益 / 下一阶段按钮），
       这一页只剩「未通过」与「任务未达成」两种结局——通过时不能再说一遍「优秀评审！」（用户反馈重复）。
       2026-09-17（用户要求）：**删掉「🏆 通关」终局页** —— 通过 V4.5 不是终点，而是留在
       V4.5 反复刷分（见下 nextBtn 的 finalRepeat 分支）；旧的 finalWin 分支已移除。 */
    /* doc/23：任务未达成但评审通过 → 不算通关，也不是失败，而是"留在本阶段重训" */
    const MUI = ((this.core.cfg.MISSIONS || {}).UI) || {};
    const v = r.qualificationFailed ? {t:this.core.reviewFailurePolicy().UI.TITLE,d:this.core.reviewFailurePolicy().UI.DESCRIPTION} : r.retry
      ? { t: MUI.OVER_T || "任务未达成",
          /* [feature:gameplay-guide-mission-fallback-1-1] */
          d: MUI.OVER_D || "模型通过内部评审，但未达成本阶段任务：阶段不会推进，需要重训本阶段。主评审经费只按超过本版本已结算最高分的提升计算，同分或更低为 0；小模型等单列收入另算。" }
          /* [/feature:gameplay-guide-mission-fallback-1-1] */
      : (verdictMap[r.verdict] || verdictMap.fail);
    /* 维度驱动（doc/27 P3/P4）：结算页数值胶囊也带上本模型激活的轴 */
    const stats = this.modelDims(s)
      .map((d) => `<span class="dg-over-stat">${d.label} <b>${Math.round(this.modelValue(d.key,s))}</b></span>`).join("");
    /* 任务未达成若是因为**轴没练到位**，明确点出差在哪（否则玩家只看到"未达成"不知道差什么） */
    const _amin = (this.core.missionOf(s.ver) || {}).axisMin || {};
    const _shortAxes = Object.keys(_amin).filter((k) => (s[k] || 0) < _amin[k]);
    const axisHint = (r.retry && _shortAxes.length)
      ? `<div class="dg-over-axis-tip">轴未达标：${_shortAxes.map((k) => this.core.statLabel(k) + " " + Math.round(s[k] || 0) + " / " + _amin[k]).join("、")}——重训时优先喂这根轴。</div>`
      : "";
    /* P8 三收益：经费 / 内测反馈（V3 前）或 用户数+排行榜（V3 起，用户拍板）
       2026-09-04：抽成公共方法，奖励演出页（bonus）与结算页（over）共用一份文案。 */
    const c = this.core.cfg;
    const rewardsHTML = this.verdictRewardsHTML(r);
    const nextBtn = r.nextVer
      ? `<button class="dg-btn dg-btn-primary" data-action="next-stage">➜ 进入 ${r.nextVer} 阶段</button>`
      : (r.retry
        ? `<button class="dg-btn dg-btn-primary" data-action="retry-stage">🔁 重训 ${s.ver} 阶段</button>`
        : (r.finalRepeat
          ? `<button class="dg-btn dg-btn-primary" data-action="retry-stage">🔁 再战 ${s.ver} 阶段</button>`
          : ""));
    const finalText = "";
    /* 结算页顶部立绘（界面立绘配置可配，2026-09-03 替换原 🐳 emoji） */
    const overImg = (c.UI_PORTS || {}).over || "resource/character/stand.webp";
    this.el.innerHTML = `
      <div class="dg-over">
        <img class="dg-over-role" src="${overImg}" alt="鲸鱼娘" draggable="false">
        <div class="dg-over-title">${v.t}</div>
        <div class="dg-over-desc">${this.tpl(v.d)}</div>
        <div class="dg-over-stats">${stats}</div>
        ${axisHint}
        <div class="dg-over-score">总评 ${Math.round(r.score || 0)} · 目标参数 ${s.paramTarget != null ? s.paramTarget + "B" : "—"} · 版本 ${s.ver}</div>
        ${rewardsHTML}
        ${finalText}
        <div class="dg-actions center">
          ${nextBtn}
          ${this.rankEntryBtn()}
          <button class="dg-btn" data-action="newgame">🔁 重开一局</button>
          <button class="dg-btn" data-action="save">💾 查看存档</button>
        </div>
      </div>`;
  /* [feature:review-stage-budget-over] */
    const fundsAnchor = this.el.querySelector('.dg-over-rewards');
    if (fundsAnchor) fundsAnchor.insertAdjacentHTML('afterend', this.settlementFundsHTML(r));
  /* [/feature:review-stage-budget-over] */
  },

  /* ---------------- 存档界面（模态） ----------------
     列出全部手动槽（0~MAX_SLOTS-1，空槽也显示）+ 自动槽：
     - 空槽：可「保存到此」
     - 已有存档：可「覆盖保存」「读档」「删除」（覆盖/删除需确认） */
  /* ---------------- 教学弹窗（鲸鱼娘立绘 + 说明文本）----------------
     首次进入某阶段自动弹一次；关闭即记入 state.tutSeen，之后不再出现。 */
  /* [feature:review-week-tutorial-line] */
  reviewTutorialLine(text, tutorial) {
    const raw = String(text == null ? '' : text);
    const line = this.tpl(raw);
    // A stage-specific lesson keeps its own period; generic review lessons use
    // the same threshold as the real review gate without rewriting editor data.
    if (!tutorial || tutorial.phase !== 'review' || tutorial.ver || /\bV\d+(?:\.\d+)?\b/.test(raw)) return line;
    return line.replace(/第\s*\d+\s*周(?=\s*训练周期结束)/g, '第 ' + this.core.minWeeks(this.core.state.ver) + ' 周');
  },
  /* [/feature:review-week-tutorial-line] */
  /* [feature:review-week-tutorial] */
  renderTutorialModal(t) {
    /* 立绘优先用配置的 UI_PORTS.prologue（故事情节气泡专用），没有再按 port 取 */
    const port = t.port === "prologue" || !t.port
      ? ((this.core.cfg.UI_PORTS || {}).prologue || this.portraitSrc(t.port || "fixed"))
      : this.portraitSrc(t.port);
    const lines = (t.lines || []).map((l) => `<p>${this.reviewTutorialLine(l, t)}</p>`).join("");
    this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask dg-tut-mask" data-action="tut-close" data-id="${t.id}">
        <div class="dg-modal dg-tut">
          <div class="dg-tut-head">
            <img class="dg-tut-port" src="${port}" alt="鲸鱼娘">
            <div class="dg-tut-who">${this.icon("star", 13)} 鲸鱼娘 · 项目助手</div>
          </div>
          <div class="dg-tut-bubble">
            <div class="dg-tut-title">${this.tpl(t.title)}</div>
            ${lines}
          </div>
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="tut-close" data-id="${t.id}">
              知道了 ${this.icon("chevR", 13)}</button>
          </div>
        </div>
      </div>`);
  },

  /* [/feature:review-week-tutorial] */
  /* [feature:modal-content-pages-helper] */
  disposeModalPages(reset=true) {
    if (this._modalPages) this._modalPages.dispose();
    if (reset) this._modalPages=null;
  },
  paginateModal(mask, kind) {
    this.disposeModalPages();
    mask.classList.add('dg-single-page-mask');
    mask.querySelector('.dg-modal')?.classList.add('dg-single-page-modal');
  },
  /* ---------------- 右上角「说明」：随时可查的简要说明 ---------------- */
  /* [/feature:modal-content-pages-helper] */
  /* [feature:modal-content-pages-help-open] */
  openHelp() { if(this._modal!=="help")this.disposeModalPages(); this._modal = "help"; this.render({ soft: true }); },
  /* [/feature:modal-content-pages-help-open] */

  /* [feature:review-week-help] */
  /* [feature:modal-content-pages-help-render] */
  renderHelpModal() {
    const c = this.core.cfg, s = this.core.state;
    const cap = this.core.statCap();
    const pass = this.core.passLine();
    const secs = (c.TUTORIAL || []).map((t) => `
      <div class="dg-help-sec">
        <div class="dg-help-sec-title">${this.tpl(t.title)}</div>
        <p>${(t.lines || []).map((l) => this.reviewTutorialLine(l, t)).join("<br>")}</p>
      </div>`).join("");
    this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask" data-action="close-modal">
        <div class="dg-modal dg-help">
          <div class="dg-title">${this.icon("info", 15)} 玩法简要说明</div>
          <p class="dg-sub">随时点右上角「说明」回来看。当前：第 ${s.week} 周；本阶段最低评审周期 ${this.core.minWeeks(s.ver)} 周</p>
          <div class="dg-help-goal">
            <b>本阶段目标</b>：${this.modelDims(s).map(d=>d.label+" ≥ "+Math.ceil(this.modelPass(d.key))).join("、")}，总评 ≥ ${Math.ceil(pass.score)} 即通过内部评审。
          </div>
          <div class="dg-help-body">${secs}</div>
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="close-modal">关闭</button>
          </div>
        </div>
      </div>`);
    this.paginateModal(this.el.lastElementChild,"help");
  },
  /* [/feature:modal-content-pages-help-render] */
  /* [/feature:review-week-help] */
  /* ---------------- 团队状态面板（用户 2026-08-29：游戏过程中随时可查看）----------------
     任何阶段都能从顶部「团队」按钮打开，不开玩笑地展示全员三状态 + 词条 + 潜力 + 薪资，
     并在有人亮红灯时给出提示——管理团队是这个游戏的核心，状态必须随时可见。 */
  openTeam() { this._modal = "team"; this.render({ soft: true }); },

  renderTeamModal() {
    const s = this.core.state;
    const alive = s.engineers.filter((e) => !e.resigned);
    const gone = s.engineers.filter((e) => e.resigned);
    const avg = (k) => alive.length
      ? Math.round(alive.reduce((a, e) => a + this.statusVal(e, k), 0) / alive.length) : 0;
    const salary = alive.reduce((a, e) => a + (e.salary || 0), 0);
    const risks = alive.filter((e) => this.statusVal(e, "energy") < 30);
    // 复用招聘页同款工程师卡（统一人物卡片样式，用户 2026-08-29）：
    // 头像/名字/类型/词条/天赋徽章/潜力条/三状态条/辞退快捷操作
    const cards = alive.map((e) => this.engCard(e)).join("");
    this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask" data-action="close-modal">
        <div class="dg-modal dg-team-modal">
          <div class="dg-title">👥 团队状态 · 第 ${s.week} 周</div>
          <p class="dg-sub">体力决定产出效率；潜力三维（代码·算法·文字）决定词条升级概率——随时留意这两条。</p>
          <div class="dg-team-summary">
            <span>在岗 <b>${alive.length}</b> 人</span>
            <span>平均体力 <b>${avg("energy")}</b></span>
            <span>平均潜力 <b>${this.avgTalent(alive)}</b></span>
            <span>月薪合计 <b>${fmtMoney(salary * 2)}</b></span>
          </div>
          ${risks.length ? `<div class="dg-team-alert">⚠️ ${risks.map((e) => e.name).join("、")} 状态亮红灯，建议尽快用团队类行动卡处理。</div>` : ""}
          <div class="dg-team-list">${cards || '<div class="dg-empty">当前没有在职工程师</div>'}</div>
          ${gone.length ? `<p class="dg-dim dg-team-gone">已离职：${gone.map((e) => e.name).join("、")}</p>` : ""}
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="close-modal">关闭</button>
          </div>
        </div>
      </div>`);
  },

  /* ======================================================================
     Toy 排行榜弹层（2026-09-17）
     ----------------------------------------------------------------------
     刻意挂在 document.body、而不是 this.el(#devgame-render)：
     主菜单阶段 #devgame-render 整个容器是隐藏的，挂进去等于看不见。
     挂 body 之后主菜单与局内**共用同一个实现**；事件也自己接 ——
     onClick 只绑在 this.el 上，body 层的点击根本到不了那里。
     ====================================================================== */
  /* [feature:office-readable-pages-helper] */
  disposeOfficeReadPages() {
    const run=this._officeReadPages;if(!run)return;run.dispose();
    run.body.querySelectorAll('[data-read-node]').forEach(n=>{n.hidden=false;n.removeAttribute('data-read-node');});
    run.card.classList.remove('office-readable');run.body.classList.remove('reward-one-group');delete run.body.dataset.readGroup;
    this._officeReadPages=null;
  },

  /* [feature:recruit-codex-capacity-codex-getter] */
  codexPerPage(){const w=window.innerWidth||0,h=window.innerHeight||0;return w&&h&&w>h&&h<=450?1:3;},
  /* [/feature:recruit-codex-capacity-codex-getter] */

  fitOfficeReadPages(card,body) {
    this.disposeOfficeReadPages();
    return false;
  },

  /* [feature:read-content-pages-helpers] */
readNodePages(body,footer,groups,initial,opts){
    // Keep the authored nodes together. Content height never creates pages.
    const all={label:'',units:groups.flatMap(g=>g.units)},nodes=[...new Set(groups.flatMap(g=>g.units.flat().concat(g.parents)))];
    nodes.forEach(n=>n.dataset.readNode='');body.classList.add('read-single-page');
    const run={page:0,views:[all],closed:false,body,groups};
    run.show=()=>{if(run.closed)return;run.page=0;body.classList.remove('reward-one-group');delete body.dataset.readGroup;};
    run.layout=()=>{if(!run.closed&&body.isConnected)run.show();};
    run.dispose=()=>{run.closed=true;body.classList.remove('read-single-page');};
    run.show();return run;
  },mountRankPages(){const old=this._rankPages,R=this._rank,key=R&&R.period+"|"+R.ver,card=this._rankMask&&this._rankMask.firstChild;const initial=old&&old.owner===R&&old.key===key?old.page:0;if(old)old.dispose();if(!card)return;card.classList.add("lb-readable");const list=card.querySelector(".lb-list");if(!list)return;const body=document.createElement("div");body.className="lb-read-content";const info=document.createElement("div");info.className="lb-info";const copy=[card.querySelector(".dg-sub"),card.querySelector(".lb-mine")].filter(Boolean),head=card.querySelector(".lb-head");copy.forEach(n=>info.appendChild(n));card.insertBefore(body,head);body.appendChild(info);body.appendChild(head);body.appendChild(list);const run=this.readNodePages(body,card.querySelector(".dg-actions"),[{label:"\u73A9\u5BB6\u6392\u540D",parents:[head,list],units:[...list.children].map(n=>[head,n])},{label:"\u89C4\u5219\u548C\u6211\u7684\u540D\u6B21",parents:[info],units:copy.map(n=>[n])}],initial);run.owner=R;run.key=key;this._rankPages=run;run.layout()},disposeRewardPages(){const old=this._rewardPages;if(old)old.stages.forEach(p=>p.dispose())},mountRewardPages(){const old=this._rewardPages,s=this.core.state,same=old&&old.state===s&&old.result===s.result,memo={};if(same)old.stages.forEach((p,n)=>memo[n]=p.page);this.disposeRewardPages();const root=this.el.querySelector(".aqua-stage");if(!root)return;root.classList.add("reward-readable");const stages=new Map;const groups=n=>{const act=root.querySelector("#act-"+n),body=act.querySelector(".chart-card,.act2-grid,.act3-grid"),parent=sel=>body.querySelector(sel),each=sel=>[...body.querySelectorAll(sel)].map(x=>[x]);let rows=[];if(n===1)rows=[{label:"\u6A21\u578B\u8868\u73B0",parents:[parent(".chart-main")],units:[[parent(".chart-main")]]},{label:"\u8BC4\u5206\u4E0E\u80FD\u529B",parents:[parent(".chart-side")],units:each(".side-row")}];if(n===2){const panels=[...body.children];rows=[{label:"\u6A21\u578B\u80FD\u529B\u699C",parents:[panels[0],parent("#rankList")],units:each("#rankList>*")},{label:"\u7528\u6237\u53CD\u9988",parents:[panels[1],parent("#feedList")],units:each(".rank-tip,.user-stat,.feed-card")}]}if(n===3){const card=parent("#bonusCard"),chips=parent(".bonus-break"),units=[[parent(".bonus-label"),parent(".bonus-amount")],...each(".break-chip"),...each(".brand-benefit,.bonus-fund")];rows=[{label:"\u7ED3\u7B97\u5956\u91D1",parents:[card,chips],units}];const up=parent("#upgradePanel");if(up)rows.push({label:"\u5DE5\u7A0B\u5E08\u6210\u957F",parents:[up,parent("#upgradeList")],units:each(".upgrade-item")})}rows.forEach(g=>{g.parents=g.parents.filter(Boolean);g.units=g.units.map(u=>u.filter(Boolean)).filter(u=>u.length)});return{act,body,rows}};for(let n=1;n<=3;n++){const g=groups(n);stages.set(n,this.readNodePages(g.body,g.act.querySelector(".act-foot"),g.rows,memo[n],n===3?{singleWhenWide:true}:undefined))}this._rewardPages={state:s,result:s.result,stages}},
  openRank() {
  /* [/feature:read-content-pages-helpers] */
    this.closeRank();
    const state=this.curState(),boards=((window.GameCfg||{}).EMBODIED||{}).CLOUD_BOARDS||{};
    const ver=state&&boards[state.ver] ? state.ver : "V4.5";
    this._rank = { period: "all", ver, list: null, mine: null, loading: false, err: "" };
    const mask = document.createElement("div");
    mask.className = "dg-modal-mask lb-mask";
    mask.id = "toy-rank-modal";
    mask.innerHTML = '<div class="dg-modal lb-modal" role="dialog" aria-modal="true" aria-label="模型总榜"></div>';
    document.body.appendChild(mask);
    const card = mask.firstChild;
    card.innerHTML = this.rankHtml();
  /* [feature:rank-content-pages-open] */
    this._rankMask = mask;
    this.mountRankPages();
  /* [/feature:rank-content-pages-open] */
    if (window.Menu && window.Menu.syncAnimation) window.Menu.syncAnimation();
    /* 弹层在 this.el 之外，onClick 收不到 —— 绑定自己的委托 */
    card.addEventListener("click", (e) => this.onRankClick(e));
    /* 遮罩空白处关闭（点卡片内部不关） */
    mask.addEventListener("click", (e) => { if (e.target === mask) this.closeRank(); });
    /* Esc 关闭 —— 自带，不依赖菜单层那张 Esc 表 */
    this._rankEsc = (e) => { if (e.key === "Escape") this.closeRank(); };
    window.addEventListener("keydown", this._rankEsc);
    this.rankRefresh();
  },

  closeRank() {
  /* [feature:rank-content-pages-close] */
    this._rankRequest=(this._rankRequest||0)+1;
    if(this._rankPages)this._rankPages.dispose();this._rankPages=null;
  /* [/feature:rank-content-pages-close] */
    if (this._rankMask) { this._rankMask.remove(); this._rankMask = null; }
    if (this._rankEsc) { window.removeEventListener("keydown", this._rankEsc); this._rankEsc = null; }
    if (window.Menu && window.Menu.syncAnimation) window.Menu.syncAnimation();
  },

  /* 弹层内所有交互走这里（事件委托在卡片上，因为它在 this.el 之外） */
  onRankClick(e) {
    const b = e.target.closest("[data-rank-act]");
    if (!b) return;
    const act = b.dataset.rankAct;
    if (window.SFX) SFX.play("click");
    if (act === "close") { this.closeRank(); return; }
    if (act === "period") { this._rank.period = b.dataset.period || "all"; this._rank.loading=false; this.rankRefresh(); return; }
    if (act === "stage") { this._rank.ver=b.dataset.ver||"V4.5";this._rank.list=null;this._rank.mine=null;this._rank.loading=false;this.rankRefresh();return; }
    if (act === "retry") { this._rank.err = ""; this.rankRefresh(true); return; }
  },

  /* 拉数据后重渲染（结果由 ToyCloud 内部缓存 5 分钟，这里不轮询） */
  /* [feature:rank-content-pages-refresh] */
  rankRefresh(force) {
    const tc = window.ToyCloud, R = this._rank;
    const card = this._rankMask && this._rankMask.firstChild;
    if (!card) return;
    const request=this._rankRequest=(this._rankRequest||0)+1,period=R.period,ver=R.ver||"V4.5";
    const valid=()=>request===this._rankRequest&&this._rank===R&&R.period===period&&R.ver===ver&&this._rankMask&&this._rankMask.firstChild===card;
    if (!tc || !tc.available()) { R.loading=false;R.list=null;R.mine=null;card.innerHTML=this.rankHtml();this.mountRankPages();return; }
    R.loading = true; R.err = "";card.innerHTML = this.rankHtml();this.mountRankPages();
    Promise.all([tc.fetchBoard(period,ver,force),tc.fetchMine(period,ver,force)])
      .then(([b,m])=>{
        if(!valid())return;R.loading=false;
        if(b&&b.ok){R.list=b.list||[];}else{R.list=null;R.err=b&&b.reason||"error";}
        R.mine=m&&m.ok?m:null;card.innerHTML=this.rankHtml();this.mountRankPages();
      }).catch(()=>{if(!valid())return;R.loading=false;R.list=null;R.mine=null;R.err="error";card.innerHTML=this.rankHtml();this.mountRankPages();});
  },
  /* [/feature:rank-content-pages-refresh] */

  rankHtml() {
    const tc = window.ToyCloud;
    const R = this._rank || { period: "all", list: null, mine: null, loading: false, err: "" };
    const st = this.curState();
    const ver=R.ver||((st&&(((window.GameCfg||{}).EMBODIED||{}).CLOUD_BOARDS||{})[st.ver])?st.ver:"V4.5");
    const boards=((window.GameCfg||{}).EMBODIED||{}).CLOUD_BOARDS||{},isBody=!!boards[ver];
    const unlocked=isBody ? !!(st&&boards[st.ver]) : (tc ? tc.unlocked(st) : false);
    const title=isBody?ver+" 真实玩家云榜":"V4.5 模型总榜";
    const rule=isBody?"本阶段评审分数越高越靠前；同分时训练周数少者靠前，再同则先提交者靠前。":"最终评审分数越高越靠前；同分时 V4.5 周数少者靠前，再同则先上榜者靠前。";

    /* 未解锁：直接讲清条件，别摆一个空榜让玩家猜 */
    if (!unlocked) {
      return '<div class="dg-title">🏆 '+this.esc(title)+'</div>' +
        '<p class="dg-sub">旧总榜需要在 V4.5 拿到评审第一名；具身智能四阶段分别使用独立真实玩家云榜。</p>' +
        '<div class="lb-lock">' +
          '<div class="lb-lock-row"><span class="lb-lock-k">阶段进度</span><span class="lb-lock-v">' +
            (st ? (st.ver || "V1") : "尚未开局") + '</span></div>' +
          '<div class="lb-lock-row"><span class="lb-lock-k">评审名次</span><span class="lb-lock-v">' +
            (st && st.rank != null ? ("第 " + st.rank + " 名") : "—") + '</span></div>' +
          '<p class="lb-lock-tip">排名规则：最终评审分数越高越靠前；同分时 V4.5 训练周数越少越靠前；再相同则先上榜者靠前。</p>' +
        '</div>' +
        '<div class="dg-actions"><button class="dg-btn dg-btn-ghost" data-rank-act="close">关闭</button></div>';
    }

    if (!tc || !tc.available()) {
      /* 分原因：没有 SDK（Vercel / 本地直开）vs 有 SDK 但不在平台页面里。
         旧版一律说「当前环境不支持排行榜」—— 正式页若拿不到 toy_id 也会落到这里，
         把能用的环境说成不支持（2026-09-22 修）。 */
      const why = (tc && tc.hasSdk())
        ? "排行榜需要在 B站 Toy 页面内使用（请从 Toy 页面进入，并确认已登录 B站）。"
        : "当前离线，无法读取真实玩家云榜；本地不提供模拟名次。";
      return '<div class="dg-title">🏆 '+this.esc(title)+'</div>' +
        '<p class="dg-sub">' + why + '</p>' +
        '<div class="dg-actions"><button class="dg-btn dg-btn-ghost" data-rank-act="close">关闭</button></div>';
    }

    const stageTabs=st&&boards[st.ver]?'<div class="lb-tabs lb-stage-tabs">'+Object.keys(boards).map(stage=>'<button class="lb-tab'+(ver===stage?' on':'')+'" data-rank-act="stage" data-ver="'+this.esc(stage)+'">'+this.esc(stage)+'</button>').join('')+'</div>':'';
    const tabs = [["all", "总榜"], ["month", "月榜"], ["week", "周榜"]]
      .map(([k, label]) =>
        '<button class="lb-tab' + (R.period === k ? " on" : "") + '" data-rank-act="period" data-period="' + k + '">' + label + '</button>')
      .join("");

    let body;
    if (R.loading) body = '<div class="lb-tip">榜单加载中…</div>';
    else if (R.err) body = '<div class="lb-tip">榜单暂时不可用，请稍后再试。</div>';
    else if (!R.list || !R.list.length) body = '<div class="lb-tip">本阶段还没有玩家提交成绩。</div>';
    else {
      /* 「我」的名次（来自 getMyRank，与列表同一套口径）+ 本机模型信息。
         只有这两样凑齐了，才能给自己那一行补「模型名 · 架构参数 · 阶段」。 */
      const mineRank = (R.mine && R.mine.ranked) ? R.mine.rank : -1;
      const myMeta = R.mine && R.mine.ranked ? this.myModelMeta(R.mine.score, ver) : "";
      const rows = R.list.map((it) => {
        const u = tc.unpackScore(it.score,ver);
        const top3 = it.rank <= 3 ? (" lb-top" + it.rank) : "";
        /* 「我」这一行：用 getMyRank 的 rank 对齐列表（两者同一套口径），
           只有它能补上模型名/架构参数 —— 原因见 myModelMeta() 的注释。 */
        const isMe = mineRank > 0 && it.rank === mineRank && Number(it.score) === Number(R.mine.score);
        return '<div class="lb-row' + top3 + (isMe ? " lb-me" : "") + '">' +
          '<span class="lb-no">' + it.rank + '</span>' +
          '<span class="lb-name">' + this.esc(it.nickname || "匿名") +
            (isMe && myMeta ? '<span class="lb-meta">' + this.esc(myMeta) + '</span>' : "") +
          '</span>' +
          '<span class="lb-score">' + Math.round(u.score) + '</span>' +
          '<span class="lb-weeks">' + u.weeks + ' 周</span>' +
        '</div>';
      }).join("");
      body = '<div class="lb-head"><span class="lb-no">名次</span><span class="lb-name">训练师</span>' +
             '<span class="lb-score">评审分</span><span class="lb-weeks">周数</span></div>' +
             '<div class="lb-list">' + rows + '</div>';
    }

    /* 我的名次：是否上榜**必须看 ranked**（分数允许为 0 / 负）。
       接口失败（R.mine 为 null，reason !== 'unavailable'）时不给结论，避免误报「你没上榜」。 */
    let mineLine = "";
    if (R.mine && R.mine.ranked) {
      const u = tc.unpackScore(R.mine.score,ver);
      mineLine = '<div class="lb-mine">我的名次 <b>第 ' + R.mine.rank + ' 名</b>' +
                 '<span class="lb-mine-sub">' + Math.round(u.score) + ' 分 · ' + Math.round(u.weeks) + ' 周</span></div>';
    } else if (R.mine && R.mine.ranked === false) {
      mineLine = '<div class="lb-mine lb-mine-off">你还没有上榜成绩</div>';
    }

    return '<div class="dg-title">🏆 '+this.esc(title)+'</div>' +
      '<p class="dg-sub">'+this.esc(rule)+'</p>' +
      stageTabs+'<div class="lb-tabs">' + tabs + '</div>' +
      mineLine + body +
      '<div class="dg-actions">' +
        '<button class="dg-btn dg-btn-ghost" data-rank-act="retry">刷新</button>' +
        '<button class="dg-btn dg-btn-primary" data-rank-act="close">关闭</button>' +
      '</div>';
  },

  /* 轻量 HTML 转义（昵称来自服务端，仍按不可信处理） */
  esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  /* 局内「查看总榜」入口按钮：**只在解锁后出现**。
     未解锁时局内不摆按钮（点了只会看到条件说明，白占位置）；
     主菜单的入口则是常驻的，负责告诉玩家有这个玩法 + 怎么解锁。 */
  rankEntryBtn() {
    const tc = window.ToyCloud;
    const st = this.curState();
    const body=st&&((((window.GameCfg||{}).EMBODIED||{}).CLOUD_BOARDS||{})[st.ver]);
    if (!body&&(!tc||!tc.unlocked(st))) return "";
    return '<button class="dg-btn" type="button" data-action="open-rank">🏆 '+(body?'查看 '+this.esc(st.ver)+' 云榜':'查看总榜')+'</button>';
  },

  /* 当前游戏状态：局内取 core.state；主菜单阶段 core 尚未建立，
     回落到本地自动存档 —— 否则「已通关登顶」的玩家回到主菜单看榜单会被误判成未解锁。 */
  curState() {
    if (this.core && this.core.state) return this.core.state;
    try {
      /* 主菜单阶段不仅 core 没建，this.save 也还没注入（GameUI.init 没跑过），
         所以这里直接回落到全局 GameSave —— 两者都指向同一个存档层。 */
      const gs = this.save || window.GameSave;
      const d = gs && gs.load && gs.load("auto");
      return (d && d.state) || null;
    } catch (e) { return null; }
  },

  /* 本机模型信息文本：模型名 · 架构参数 · 阶段。
     ⚠️ 只有「我」这一行能显示它 —— 平台 getRankList 的返回字段写死为
     {rank, score, nickname, avatar}，没有自定义字段，拿不到别人的模型名/参数
     （名字是字符串，也塞不进唯一的整数 score；别人的云存档我们无权读）。 */
  myModelMeta(packed, ver) {
    const st = this.curState(), tc = window.ToyCloud;
    const fallback = "历史成绩 · 模型信息未匹配";
    if (!st || !tc || !Number.isSafeInteger(Number(packed))) return fallback;
    const decoded = tc.unpackScore(packed, ver), factor = ["V5","V5.5","V6","V6.5"].includes(ver) ? 1 : 10;
    const records = (st.codexLog || []).concat(st.modelHistory || [], Object.values(st.stageMarks || {}));
    Object.values(st.codex || {}).forEach(e => { if (e) records.push(e.first, e.best, e.last); });
    const matches = records.filter(x => x && x.name && x.arch && Number.isFinite(x.param) && x.param > 0
      && x.ver === ver && Number.isFinite(x.score)
      && Number.isFinite(x.week) && x.week === decoded.weeks
      && Math.round(x.score * factor) / factor === decoded.score
      && ["pass","excellent","top"].includes(x.verdict) && !x.missionFail && !x.retry);
    const identities = new Map(matches.map(x => [JSON.stringify([x.name, x.arch, x.param]), x]));
    if (identities.size !== 1) return fallback;
    const snap = identities.values().next().value;
    const parts = [snap.name, snap.param ? snap.param + "B" : "", snap.ver].filter(Boolean);
    const limit = typeof tc.legalScoreCap === "function" ? tc.legalScoreCap(ver) : null;
    if (limit != null && decoded.score > Math.round(limit * factor) / factor) parts.push("历史版本成绩");
    return parts.join(" · ");
  },

  /* ---------- 云存档操作（存档弹窗内触发） ---------- */
  cloudStatusLine() {
    const tc = window.ToyCloud;
    if (!tc) return '<div class="cloud-line">云端存档：模块未加载</div>';
    if (!tc.available()) {
      /* 文案按**真实原因**分：没有 SDK（Vercel / 本地直开）才是「环境不支持」；
         有 SDK 但不在平台页面里，是让玩家「从 Toy 页面进入」——
         旧版把「拿不到 toy_id」一律说成环境不支持，正式页也因此误导（2026-09-22 修）。 */
      const why = tc.hasSdk() ? "请从 B站 Toy 页面进入" : "当前环境不支持";
      return '<div class="cloud-line cloud-line-off">云端存档：' + why + '</div>';
    }
    const st = tc.status();
    if (st.cloudProtected) return '<div class="cloud-line cloud-line-off">' + this.escHtml(tc.errorMessage("cloud-exists")) + '</div>';
    if (st.broken) return '<div class="cloud-line cloud-line-off">云端存档：暂时不可用，稍后可手动重试</div>';
    if (!st.lastSyncAt) {
      /* 有过失败（但还没到熔断）⇒ 说清是「没连上」，别让玩家以为是没触发同步 */
      return st.failStreak > 0
        ? '<div class="cloud-line cloud-line-off">云端存档：连接异常，可点「上传云端」重试</div>'
        : '<div class="cloud-line">云端存档：本次会话尚未同步</div>';
    }
    const d = new Date(st.lastSyncAt);
    const pad = (n) => String(n).padStart(2, "0");
    return '<div class="cloud-line">云端存档：已同步 ' + pad(d.getHours()) + ":" + pad(d.getMinutes()) +
      (st.lastSyncSlim ? "（精简档）" : "") + '</div>';
  },

  /* 2026-09-23：存档弹窗开着期间 tick render 不再删掉重建（见 render 清理注释），
     改动槽位 / 云端状态后用这个显式换新列表 —— 摘掉旧节点，render 末尾会按
     _modal==="save" 重建出最新内容（少了哪一行一眼可见，不用整屏重挂）。 */
  refreshSaveModal() {
    const sm = this.el && this.el.querySelector("#saveModal");
  /* [feature:modal-content-pages-refresh-save] */
    if (sm) { if(this._modalPages&&this._modalPages.mask===sm)this.disposeModalPages(false); sm.remove(); }
  /* [/feature:modal-content-pages-refresh-save] */
  },

  /* [feature:cloud-ui-operations] */
  cloudOperationMessage(reason, code) {
    const tc = window.ToyCloud;
    return tc && tc.errorMessage ? tc.errorMessage(reason, code) : "云存档操作失败，请稍后重试。";
  },

  updateCloudButtons() {
    if (!this.el) return;
    const busy = !!(this._cloudUploadBusy || this._cloudRestoreBusy);
    this.el.querySelectorAll('#saveModal [data-action^="cloud-"]').forEach((button) => { button.disabled = busy; });
  },

  cloudUploadNow(overwrite) {
    if (this._cloudUploadBusy || this._cloudRestoreBusy) return;
    const tc = window.ToyCloud;
    if (!tc || !tc.available()) { this.toast(this.cloudOperationMessage("unavailable")); return; }
    this._cloudUploadBusy = true;
    this.updateCloudButtons();
    this.toast("正在上传云端…");
    return Promise.resolve().then(() => tc.flush(this.save.buildSnapshot(this.core.state), overwrite === true)).then((r) => {
      if (this._modal !== "save") return;
      if(r&&r.reason==="cloud-exists"){
        const copy=((this.core.cfg.CLOUD_SAVE||{}).UI)||{};
        this.askConfirm(copy.CONFIRM_TITLE,copy.CONFIRM_BODY,()=>this.cloudUploadNow(true),{okText:copy.CONFIRM_BUTTON,danger:true});
        return;
      }
      this.toast(r && r.ok ? "已同步到云端" : this.cloudOperationMessage(r && r.reason, r && r.code));
      this.refreshSaveModal();
      this.render({ soft: true });
    }).catch(() => {
      if (this._modal === "save") this.toast(this.cloudOperationMessage("error"));
    }).finally(() => { this._cloudUploadBusy = false; this.updateCloudButtons(); });
  },

  cancelCloudRestore() {
    this._cloudRestoreToken = (this._cloudRestoreToken || 0) + 1;
    this._cloudRestoreBusy = false;
    this._pendingCloudRestore = null;
    const tc = this._cloudRestoreCloud;
    this._cloudRestoreCloud = null;
    if (tc && tc.endRestore) tc.endRestore();
    this.updateCloudButtons();
  },

  cloudRestore() {
    if (this._cloudRestoreBusy || this._cloudUploadBusy || this._confirmOpen) return;
    const tc = window.ToyCloud;
    if (!tc || !tc.available()) { this.toast(this.cloudOperationMessage("unavailable")); return; }
    const tok = (this._cloudRestoreToken || 0) + 1;
    this._cloudRestoreToken = tok;
    this._cloudRestoreBusy = true;
    if (tc.beginRestore) { tc.beginRestore(); this._cloudRestoreCloud = tc; }
    this.updateCloudButtons();
    this.toast("正在读取云端存档…");
    return Promise.resolve().then(() => tc.fetchCloudSnapshot()).then((r) => {
      if (tok !== this._cloudRestoreToken) return;
      if (!r || !r.obj) {
        this.toast(this.cloudOperationMessage(r && r.reason, r && r.code));
        this.cancelCloudRestore();
        return;
      }
      if (this._modal !== "save" || this._confirmOpen) { this.cancelCloudRestore(); return; }
      this._pendingCloudRestore = r.obj;
      // 切到确认层不释放恢复锁；普通关闭/取消则作废这次读取。
      this.refreshSaveModal();
      this._modal = null;
      this.askConfirm(
        "读取云端存档",
        "将用云端存档覆盖本机的自动存档，并立即进入该进度。本机其他手动槽位不受影响，云端存档也不会被删除。",
        () => this.applyCloudRestore(),
        { okText: "覆盖并进入", onCancel: () => this.cancelCloudRestore() });
    }).catch(() => {
      if (tok !== this._cloudRestoreToken) return;
      this.toast(this.cloudOperationMessage("error"));
      this.cancelCloudRestore();
    });
  },

  applyCloudRestore() {
    const rec = this._pendingCloudRestore;
    try {
      if (!rec) return;
      const result = this.save.restoreSnapshot ? this.save.restoreSnapshot(rec, this.core) : { ok: false, reason: "unavailable" };
      if (!result.ok) { this.toast(this.cloudOperationMessage(result.reason)); return; }
      const tc=window.ToyCloud;if(tc&&tc.acceptCloudRestore)tc.acceptCloudRestore(rec);
      this._tickFails = 0; this._tickRecovered = false;
      this.render();
      this.toast(result.stageSaved === false ? "已载入云端存档；阶段备份未保存，自动存档已保留。" : "已载入云端存档");
    } catch (_) {
      this.toast(this.cloudOperationMessage("load-error"));
    } finally { this.cancelCloudRestore(); }
  },
  /* [/feature:cloud-ui-operations] */

  cloudForget() {
    /* [feature:cloud-delete-restore-guard] */
    if (this._cloudRestoreBusy || this._cloudUploadBusy) return;
    /* [/feature:cloud-delete-restore-guard] */
    const tc = window.ToyCloud;
    if (!tc || !tc.available()) { this.toast("当前环境不支持云存档"); return; }
    tc.forgetCloud().then((ok) => {
      this.toast(ok ? "已删除云端存档" : "删除失败，请稍后再试");
      this.refreshSaveModal();
      this.render({ soft: true });
    }).catch(() => { this.toast("删除失败"); });
  },

  /* [feature:cloud-ui-buttons] */
  /* [feature:modal-content-pages-save-render] */
  renderSaveModal() {
    const slots = [];
    // 手动槽：全量展示（含空槽），玩家可自由选择保存到哪个槽位
    for (let i = 0; i < this.save.MAX_SLOTS; i++) {
      const d = this.save.load(i);
      const slotNo = "槽位 " + (i + 1);
      slots.push(this.saveSlotHTML(i, slotNo, d));
    }
    // 自动槽：只读展示（不支持手动覆盖/删除）
    const auto = this.save.load("auto");
    if (auto) {
      slots.push(this.saveSlotHTML("auto", "📌 自动存档", auto, { auto: true }));
    }
    // 阶段锚点（2026-09-12 兜底机制）：每个阶段开始自动写，独立键不占槽位，仅提供读档
    const anchor = (this.save.loadStage) ? this.save.loadStage() : null;
    if (anchor) {
      slots.push(this.saveSlotHTML("stage", "🛟 本阶段开头（自动锚点）", anchor, { stage: true }));
    }
    this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask" id="saveModal" data-action="close-modal">
        <div class="dg-modal dg-modal-save">
          <div class="dg-title">💾 存档管理</div>
          <p class="dg-sub">点击任一槽位可保存/覆盖；已有存档的槽位支持读档与删除。</p>
          <div class="dg-save-list">${slots.join("")}</div>
          <!-- Toy 云存档区（2026-09-17）：非 Toy 环境整块显示「当前环境不支持」，
               不会摆出点了没反应的按钮。云端只同步、不自动覆盖本地 —— 恢复必须玩家手动点。 -->
          <div class="cloud-box">
            ${this.cloudStatusLine()}
            <div class="cloud-actions">
              <button class="dg-btn dg-btn-ghost" data-action="cloud-upload" ${this._cloudUploadBusy || this._cloudRestoreBusy ? "disabled" : ""}>立即同步</button>
              <button class="dg-btn dg-btn-ghost" data-action="cloud-restore" ${this._cloudUploadBusy || this._cloudRestoreBusy ? "disabled" : ""}>从云端恢复</button>
              <button class="dg-btn dg-btn-ghost" data-action="cloud-forget" ${this._cloudUploadBusy || this._cloudRestoreBusy ? "disabled" : ""}>删除云端存档</button>
            </div>
          </div>
          <div class="dg-actions">
            <button class="dg-btn dg-btn-primary" data-action="save-here">保存到第一个空槽</button>
            <button class="dg-btn dg-btn-ghost" data-action="close-modal">关闭</button>
          </div>
        </div>
      </div>`);
  },
  /* [/feature:modal-content-pages-save-render] */
  /* [/feature:cloud-ui-buttons] */

  /* 单个存档槽位 HTML：slot 为 数字下标 或 "auto" */
  saveSlotHTML(slot, name, d, opts) {
    const o = opts || {};
    const empty = !d;
    /* 2026-09-13（用户：「存档显示要写清是哪个阶段」）：第一行以**版本阶段**打头
       （V1 / V2.5 / V4 …），而不是原来的内部 phase 值（office / bonus 对玩家没有意义）。
       旧档没写 meta.ver → 从存档状态里回读 s.ver。 */
    const verTxt = d && ((d.meta && d.meta.ver) || (d.state && d.state.ver) || "V1");
    const info = empty
      ? `<div class="dg-dim">（空槽位）</div>`
      : `<div class="dg-dim">${verTxt} 阶段 · 经费 ${fmtMoney(d.meta.funding)} · 品牌 ${d.meta.brand}<br>代码 ${d.meta.code} 文字 ${d.meta.text} 安全 ${d.meta.safety} 稳定 ${d.meta.stability}</div>`;
    // 自动槽：仅读档；阶段锚点：仅读档；手动槽：保存到此（空槽）或 覆盖/读档/删除（有档）
    const ops = [];
    if (o.auto || o.stage) {
      const key = o.stage ? "stage" : "auto";
      ops.push(`<button class="dg-btn dg-btn-sm" data-action="load-slot" data-slot="${key}">读档</button>`);
    } else {
      ops.push(`<button class="dg-btn dg-btn-sm dg-btn-accent" data-action="save-slot" data-slot="${slot}">${empty ? "保存到此" : "覆盖保存"}</button>`);
      if (!empty) {
        ops.push(`<button class="dg-btn dg-btn-sm" data-action="load-slot" data-slot="${slot}">读档</button>`);
        ops.push(`<button class="dg-btn dg-btn-sm dg-btn-ghost dg-btn-danger" data-action="del-slot" data-slot="${slot}">删除</button>`);
      }
    }
    return `
      <div class="dg-save-row${empty ? " dg-save-row-empty" : ""}">
        <div class="dg-save-info">
          <div class="dg-save-name">${name}${d ? " · " + d.name : ""}</div>
          ${info}
        </div>
        <div class="dg-save-ops">${ops.join("")}</div>
      </div>`;
  },

  /* 二级面板渲染（完全对齐 demo 的 openModal）：
     · 卡片不存在 → 新建 + cardPop 入场动画
     · 卡片存在但换了面板 → 内容淡出 → 替换标题/图标/正文/页脚 → 淡入（**不重播 cardPop**）
     · 卡片存在且是同一个面板 → 静默刷新正文（面板内操作走这条路，零闪烁） */
  renderOfficeModal(key) {
    let box = this.el.querySelector("#modalContainer");
    /* 容器被关闭流程整块移除（closeOfficeModal）→ 重建办公室骨架后重试一次，
       否则后续任何二级面板都渲染不出来（扩编面板空正文的真因，2026-09-01 修复） */
    if (!box) {
      this.renderOffice();
      box = this.el.querySelector("#modalContainer");
      if (!box) return;
    }
    const meta = this.officeModalMeta(key);
    const card = box.querySelector(".modal-card");

    // ① 同一个面板：静默刷新
    if (card && box.dataset.modalKey === key) {
      /* ⚠️ 2026-09-14（用户第二次报「聊天界面还是受 tick 影响：老是闪一下自动刷新 / 聊天记录被卡没」）：
         聊天面板**彻底不参与 tick 的静默刷新** —— 这里直接 return。
         真凶：它的正文里那行状态文案是 `core.c2Status()` **每次随机取一句**，
         于是每 tick 生成的字符串都不一样 ⇒ 下面那条「内容没变就不重建」的签名比对永远不成立
         ⇒ **每 tick 重建一次正文**：入场动画重播（看起来在闪），发问途中还没 push 进 _omTestLog
         的临时气泡被重放丢掉（聊天记录像被吃掉了）。
         面板内一切更新都走 `refreshOfficeBody()`（发问 / 选项 / 推进 / 推送消息都显式调它），
         所以这里 return 不会漏刷新；换面板（key 不同）也照走下面的正常分支。 */
      if (key === "test") return;
      const bodyEl = card.querySelector(".modal-body");
      const footEl = card.querySelector(".modal-footer");
      if (bodyEl) {
        /* 2026-09-12（用户实测「安排/辞退按钮交替闪烁 + 误触发辞退」）：
           每 tick 的静默刷新会把面板正文整个重建 —— 鼠标下的 DOM 被反复替换，
           hover 交替闪烁；点击瞬间恰好重建就会点到重建后位移的元素上。
           修：先生成新正文，与上次写入的字符串完全一致时**跳过重建**（DOM 零扰动）。
           新闻页有滚动位置/留言展开态要恢复，仍走原重建逻辑。 */
        if (key !== "news") {
          const nextHtml = this.officeModalBody(key);
  /* [feature:office-readable-pages-stable-footer] */
          if (bodyEl.dataset.sig === nextHtml) {
            const pages=this._officeReadPages;
            if (footEl && !(pages && pages.body===bodyEl && pages.footerHTML===(meta.footer||""))) footEl.innerHTML = meta.footer || "";
            this.afterModalRender(false);
            return;
          }
  /* [/feature:office-readable-pages-stable-footer] */
          bodyEl.dataset.sig = nextHtml;
        }
        /* 吃瓜页（2026-09-05 用户反馈）：定时 tick 每 ~10s 重建正文会把滚动位置拉回最上方、
           点开的同事留言被收起 —— 重建前记录 scrollTop 与展开态，重建后恢复。 */
        const feedEl = key === "news" ? bodyEl.querySelector(".nw-feed") : null;
        const st0 = feedEl ? feedEl.scrollTop : 0;
        const openIds = feedEl ? [...feedEl.querySelectorAll(".nw-cmts:not([hidden])")]
          .map((el) => { const p = el.closest(".nw-post"); const b = p && p.querySelector(".nw-cmt-btn"); return b && b.dataset.id; })
          .filter(Boolean) : [];
        /* 2026-09-13：重建前拍动画快照（团队面板的 nameFadeIn、立项的 card-sweep 等会在这里被续上） */
        const animSnap = this.snapAnim(bodyEl);
        bodyEl.innerHTML = this.officeModalBody(key);
        /* 重建会把新节点上的 CSS 动画全部重置 → 按快照把进度续回来（见 snapAnim/restoreAnim）。
           ⚠️ 必须紧跟 innerHTML 同步执行：等下一拍再 restore，动画已经重新播完一遍了。 */
        this.restoreAnim(bodyEl, animSnap);
        this.invalidateFit();   // 正文真的换了 → 允许重算一次自适应缩放
        /* ⚠️ 根治「吃瓜刷新跳回顶部」（2026-09-06）：bodyEl.innerHTML 会销毁旧 .nw-feed，
           feedEl 是替换前捕获的引用、此刻已脱离文档——在它上面设 scrollTop 等于没设。
           必须重新查询**重建后的新节点**再恢复。热榜定时器/点赞那两处是原地
           feedEl.innerHTML（节点没被销毁），所以一直有效；唯独这条静默刷新路径漏了。 */
        if (feedEl) {
          const newFeed = bodyEl.querySelector(".nw-feed");
          if (newFeed) {
            newFeed.scrollTop = st0;
            openIds.forEach((id) => {
              const btn = newFeed.querySelector('.nw-cmt-btn[data-id="' + id + '"]');
              const cbox = btn && btn.closest(".nw-post") && btn.closest(".nw-post").querySelector(".nw-cmts");
              if (btn && cbox) { cbox.hidden = false; btn.classList.add("on"); }
            });
          }
        }
        /* 定时 tick（officeTick → render({soft:true})）每回合都会走到这里重建正文。
           若照常播入场动画，玩家就会看到「打开团队界面过一会儿自己重置、数值条又长一遍」。
           所以静默刷新：禁掉 pop-in 动画 + 进度条直接落到目标值，不重播。 */
        bodyEl.classList.add("no-pop");
      }
      if (footEl) footEl.innerHTML = meta.footer || "";
      this.afterModalRender(false);
      return;
    }

    // ② 切换面板：淡出 → 换内容 → 淡入
    if (card) {
      const bodyEl = card.querySelector(".modal-body");
      const footEl = card.querySelector(".modal-footer");
      const titleEl = card.querySelector(".modal-title span");
      const iconEl = card.querySelector(".title-icon");
      if (bodyEl) bodyEl.style.opacity = "0";
      if (footEl) footEl.style.opacity = "0";
      const apply = () => {
        if (titleEl) titleEl.textContent = meta.title;
        if (iconEl) iconEl.innerHTML = this.icon(meta.icon, 15);
        if (bodyEl) {
          bodyEl.className = "modal-body " + (meta.bodyClass || "");
          const nextHtml = this.officeModalBody(key);
          bodyEl.innerHTML = nextHtml;
          bodyEl.dataset.sig = nextHtml;   // 记录签名：静默刷新时「内容没变就不重建」
          this.invalidateFit();
          bodyEl.style.opacity = "1";
        }
        if (footEl) { footEl.innerHTML = meta.footer || ""; footEl.style.opacity = "1"; }
        this.afterModalRender(true);
      };
      setTimeout(apply, 120);
      box.dataset.modalKey = key;
      return;
    }

    // ③ 新开面板
    box.dataset.modalKey = key;
    box.innerHTML = `
      <div class="modal-mask">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">
              <div class="title-icon">${this.icon(meta.icon, 15)}</div>
              <span>${meta.title}</span>
            </div>
            <button class="modal-close" data-action="office-modal-close" title="关闭">${this.icon("x", 13)}</button>
          </div>
          <div class="modal-body ${meta.bodyClass || ""}"></div>
          <div class="modal-footer">${meta.footer || ""}</div>
        </div>
      </div>`;
    /* 2026-09-12：正文用 JS 写入并记录签名（静默刷新「内容没变不重建」依赖它） */
    {
      const nb = box.querySelector(".modal-body");
      const nextHtml = this.officeModalBody(key);
      if (nb) { nb.innerHTML = nextHtml; nb.dataset.sig = nextHtml; }
    }
    this.invalidateFit();
    this.afterModalRender(true);
  },

  /* 面板渲染后统一收尾：播入场动效 + 适配高度
     replay=false 用于「静默刷新」（定时 tick 重建正文）——不重播，否则每隔一会儿
     数值条就会自己重长一遍，看起来像界面重置了。 */
  afterModalRender(replay) {
    /* 2026-09-12：指针停在面板上时不重播入场动画 —— cardPopIn 会把卡片缩放到 1.02 再回落，
       鼠标底下的按钮跟着变大变小 = 命中目标在指针下反复切换（用户实测「左右频繁切换」）。
       移开鼠标后会自然恢复（下次重建时 replay 生效）。 */
    if (this._pointerInCard) replay = false;
    this.animateCoverageBars(replay !== false);
    this.animatePanelCards(replay !== false);
    this.fitModalBody();
    /* 2026-09-13：面板被静默刷新重建后，重建出来的语音条时长也是「…」→ 补一次 */
    this.primeVoicesIn(this.el.querySelector("#modalContainer"));
  },

  /* 二级界面高度适配：放不下就**整体缩放**，绝不加滚动条。
     （用户 2026-08-30 多次强调：禁止滑动条，兜底是缩放；只有员工简介和测试聊天允许滚。）
     做法：量 .modal-body 的内容高 / 可用高，超出时给 body 加 zoom（布局级缩放）。
     ══════════════════════════════════════════════════════════════════════════
     2026-09-12（用户实测「点翻页却触发辞退 / 点击区域整体偏移」的根因就在这里）：
     · zoom 是**布局级**缩放 —— 每重算一次，正文里所有元素的命中框都会整体挪一次，
       而且偏移量与「离正文左上角的距离」成正比（真机实测：zoom 0.6440 → 0.6228 时，
       左侧翻页按钮挪 3~7px，右侧按钮挪 20+px ⇒ 用户点左边、命中的却是右边那个）。
     · 旧实现每 tick 都跑「还原 zoom → 量 → 再设 zoom」，等于每回合把整个面板抖一遍：
       hover 目标在鼠标底下反复切换、按下与松开之间元素换人 → 误触发（辞退是会真执行的）。
     修法三条：
       ① **只有正文真的被重建过才重算**（_fitDone 标记；重建点负责置 false）；
       ② 缩放值只在这个面板窗口尺寸下要微调时保持不动（差 < 2% 直接沿用）；
       ③ **指针在卡片上（悬停/按住）时一律不重算** —— 绝不把用户脚下的按钮挪走。
     ══════════════════════════════════════════════════════════════════════════ */
  /* [feature:office-readable-pages-fit] */
  fitModalBody() {
    const card = this.el.querySelector(".modal-card");
    if (!card) return;
    const body = card.querySelector(".modal-body");
    if (!body) return;
    if(this.fitOfficeReadPages(card,body))return;
  /* [/feature:office-readable-pages-fit] */
    /* [feature:office-inspection-scroll-fit] */
    const inspection = this.core.state;
    const inspectionKind = inspection.minigame && inspection.minigame.kind;
  /* [feature:portrait-inspection-fit-policy] */
    const scrollInspection = false; // Inspection keeps the footer and uses the full-height fit.
  /* [/feature:portrait-inspection-fit-policy] */
    body.classList.toggle("inspection-scroll-body", scrollInspection);
    if (scrollInspection) {
      body.style.zoom = "";
      this._fitDone = true;
      this._fitK = 1;
      return;
    }
    /* [/feature:office-inspection-scroll-fit] */
    /* 信息流面板（新闻「吃瓜」页）例外：条目会随周数增多，走内部滚动而非整体缩放
       （2026-09-03）。缩放会把它挤成一团看不清，信息流需要滚动查看。
       2026-09-08：测试聊天面板同样例外 —— 缩放会把聊天区压得看不见，
       它自己也允许纵向滚动（见 style.css .test-modal-body）。 */
    if (body.classList && (body.classList.contains("news-weibo-body")
        || body.classList.contains("test-modal-body"))) {
      if (body.style.zoom) body.style.zoom = "";
      this._fitDone = true;
      this._fitK = 1;
      return;
    }
    if (this._pointerInCard) return;   // ③ 指针在面板上 → 保持现状，不挪任何东西
    if (this._fitDone) return;         // ① 自上次重建以来已算过 → 一个像素都不动
    /* 重入保护 + 节流：改 zoom 会让浏览器重新命中测试、可能再触发 pointerover/out，
       不做保护就会自己喂自己（真机实测能把页面转成卡死）。 */
    if (this._fitting) return;
    /* 节流挡下时必须补算，不能直接 return（2026-09-29 玩家反馈「立项面板正文底部被裁」）：
       invalidateFit() 只把 _fitDone 清零，紧接着的那次 fitModalBody 若正好落在上一次
       重算的 100ms 窗口内就会被挡掉 —— 之后再没人补算，面板永远停在旧 zoom 上，
       .modal-body{overflow:hidden} 把底部「预计周期/预算需求」整块裁掉。
       真机复现：footer 多出「外包补足」一行后 zoom 停在 0.68，正文裁 142px；
       强制补算一次 → zoom 0.5235、裁切 0。
       修：被挡掉时排一个「节流窗口结束后」的补算（同一时刻只排一个）。 */
    if (this._fitAt && Date.now() - this._fitAt < 100) {
      if (!this._fitRetry) {
        this._fitRetry = setTimeout(() => { this._fitRetry = 0; this._fitAt = 0; this.fitModalBody(); }, 120);
      }
      return;
    }
    this._fitting = true;
    this._fitAt = Date.now();
    try {
      this._fitBodyNow(card, body);
    } finally {
      this._fitting = false;
    }
  },

  /* fitModalBody 的实际计算部分（单独拆出来，方便加 try/finally 重入保护） */
  _fitBodyNow(card, body) {
    // 先还原再测量，否则量到的是上一次缩放后的值
    body.style.zoom = "";
    const head = card.querySelector(".modal-header");
    const foot = card.querySelector(".modal-footer");
    /* [feature:portrait-fit-available-height] */
    const avail = Math.max(0, Math.min(body.clientHeight, card.clientHeight - (head ? head.offsetHeight : 0) - (foot ? foot.offsetHeight : 0)) - 6);
    /* [/feature:portrait-fit-available-height] */
  /* [feature:portrait-intrinsic-fit] */
    // Grid/flex columns may own overflow without increasing their parent's
    // scrollHeight. Measure their intrinsic content in the same layout units.
    const offsetY = node => { let y=0; for(let p=node;p;p=p.offsetParent)y+=p.offsetTop || 0; return y; };
    const style = window.getComputedStyle(body);
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    let need = body.scrollHeight;
    body.querySelectorAll('.team-list-col,.team-detail-col,.recruit-list-col,.recruit-detail-col').forEach(column => {
      const y = Math.max(0, offsetY(column) - offsetY(body));
      need = Math.max(need, y + column.scrollHeight, column.scrollHeight + padding);
    });
  /* [/feature:portrait-intrinsic-fit] */
    /* 2026-09-29（玩家反馈「竖屏 RM 面板下一题按钮看不见」的根因之一）：
       卡片还没成型时（容器尚未显示 / 首帧布局未就绪）量到的是 0 —— 旧代码把它当成
       「放得下」并**把 _fitDone 置 true**，于是这一轮永远不会再重算，面板就停在
       zoom:1 上被 .modal-body{overflow:hidden} 把底部按钮直接裁掉（真机复现：
       cardH=0 → _fitK=1 → 400ms 后仍是 zoom:1，未作答态溢出 172px）。
       修：量不到就**不算量过**，下一拍重试一次（重试前清掉 100ms 节流闸）。 */
    if (!avail || !need) {
      this._fitDone = false;
      this._fitK = 1;
      if (!this._fitRetry && (this._fitRetryN = (this._fitRetryN || 0) + 1) <= 8) {
        this._fitRetry = setTimeout(() => { this._fitRetry = 0; this._fitAt = 0; this.fitModalBody(); }, 120);
      }
      return;
    }
    this._fitRetryN = 0;
    this._fitDone = true;      // ⚠️ 量过（有效）才算数 —— 否则放得下的面板会每 tick 重量一次
    if (need <= avail + 1) { this._fitK = 1; return; }
    /* ★ 必须用 zoom（布局级缩放），不能用 transform:scale ——
       transform 只缩小视觉、不改布局：body 布局高度还是 flex 分到的份，
       内容缩成一小条贴在顶部，下面全是大片空白（800×360 实测翻车）。
       zoom 连布局一起缩：body 布局高度 = 内容×k 正好填满，无空白、无截断。 */
    const k = Math.max(0.3, Math.min(1, avail / need));   // 0.3 以下字已不可读，该做移动布局了
    if (k >= 0.999) { body.style.zoom = ""; this._fitK = 1; return; }
    /* ② 微调不算数：与当前值差不到 2% 就沿用旧值 —— 面板内容高度每回合都会变一点点，
       跟着它反复改 zoom = 每回合抖一次（命中框整体挪动）。 */
    const cur = this._fitK != null ? this._fitK : (parseFloat(body.style.zoom) || 1);
    /* [feature:portrait-fit-reuse-safety] */
    if (cur <= k && Math.abs(k - cur) < 0.02) { body.style.zoom = cur.toFixed(4); return; }
    /* [/feature:portrait-fit-reuse-safety] */
    this._fitK = k;
    body.style.zoom = k.toFixed(4);
  },

  /* 面板正文被重建 → 允许 fitModalBody 重新算一次（否则它永远认为"算过了"） */
  invalidateFit() {
    this._fitDone = false;
  },

  /* 卡片依次浮现（demo 的 cardPopIn：scale 0.88 → 1.02 → 1，逐张延迟）
     replay=false（静默刷新）时直接清空内联动画，让 CSS 的 .no-pop 规则把它按掉 */
  animatePanelCards(replay) {
    const cards = this.el.querySelectorAll(".modal-card .pop-in");
    cards.forEach((c, i) => {
      if (!replay) { c.style.animation = ""; return; }
      c.style.animation = "none";
      void c.offsetWidth;
      c.style.animation = `cardPopIn 0.45s cubic-bezier(0.2, 1.2, 0.3, 1) ${i * 0.05}s forwards`;
    });
  },

  /* ==========================================================================
     动画抗重置（2026-09-13 用户：「所有界面动画不要因为刷 tick 而重置，这本来就是个很奇怪的逻辑」）
     --------------------------------------------------------------------------
     问题：办公室 tick 的静默刷新 = 重建面板正文（innerHTML），重建后**新节点上的 CSS 动画全部从头开始**。
     已有的 `.no-pop` 只能压住挂了 `.pop-in` 的那一类；不挂 `.pop-in` 的动画照旧重播 ——
     真机实测（CDP + animationstart 监听，10 个面板逐个巡检）：
       · team   → `nameFadeIn` ×3（`.team-name` / `.recruit-name` 上的名字浮现）
       · plan   → `card-sweep` ×1（`.arch-card::before` 的 3.5s 无限扫光）
     而这类「漏网」以后每加一个入场动画就会再来一次 —— 列举选择器治不了本。

     治法（不枚举、通用）：重建前把正文里**正在跑的每个动画**按 DOM 路径拍个快照，
     重建后按同一路径还原进度：
       · 一次性动画（iterations=1）→ `finish()` 直接判定为已播完，视觉上"没重播"
         （fill:both 会停在最终态，正是它重播前该有的样子）
       · 无限动画（iterations=Infinity）→ 把 currentTime 续上，流光/脉冲不跳帧
     代价：面板内几十个元素各调一次 getAnimations()，且只在「正文真的重建」时跑（tick 60s 一次）。
     ========================================================================== */
  /* root 下的元素 → 子节点下标路径（重建前后结构一致，所以路径可对齐） */
  domPathOf(root, el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== root) {
      const p = cur.parentNode;
      if (!p) return null;
      parts.unshift(Array.prototype.indexOf.call(p.children, cur));
      cur = p;
    }
    return cur === root ? parts : null;
  },
  elByPath(root, parts) {
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      if (!cur || !cur.children || !cur.children[parts[i]]) return null;
      cur = cur.children[parts[i]];
    }
    return cur;
  },
  snapAnim(root) {
    const out = [];
    if (!root || !root.querySelectorAll) return out;
    root.querySelectorAll("*").forEach((el) => {
      if (!el.getAnimations) return;
      let list;
      try { list = el.getAnimations(); } catch (e) { return; }
      if (!list.length) return;
      const path = this.domPathOf(root, el);
      if (!path) return;
      list.forEach((a) => {
        const name = a.animationName;
        if (!name) return;
        let iter = 1;
        try { iter = a.effect.getTiming().iterations; } catch (e) {}
        out.push({ path: path, name: name, t: a.currentTime || 0, inf: iter === Infinity || iter === "Infinity" });
      });
    });
    return out;
  },
  restoreAnim(root, snap) {
    if (!root || !snap || !snap.length) return;
    snap.forEach((s) => {
      const el = this.elByPath(root, s.path);
      if (!el || !el.getAnimations) return;
      let list;
      try { list = el.getAnimations(); } catch (e) { return; }
      for (const a of list) {
        if (a.animationName !== s.name) continue;
        try {
          if (s.inf) a.currentTime = s.t + (a.currentTime || 0);
          else a.finish();
        } catch (e) {}
        break;
      }
    });
  },

  /* 关闭二级面板：清空容器（卡片现在不随 render 重建，必须显式清） */
  /* [feature:office-readable-pages-close] */
  closeOfficeModal() {
    this.disposeOfficeReadPages();
    const box = this.el.querySelector("#modalContainer");
  /* [/feature:office-readable-pages-close] */
    if (!box || !box.dataset.modalKey) return;
    box.innerHTML = "";
    delete box.dataset.modalKey;
  },

  /* 面板内操作后的轻量刷新：只换正文，不动卡片、不播任何动画 */
  refreshOfficeBody() {
    const box = this.el.querySelector("#modalContainer");
    if (!box) return;
    const key = box.dataset.modalKey || this.core.state.officeModal;
    if (!key) return;
    const card = box.querySelector(".modal-card");
    if (!card) { this.renderOfficeModal(key); return; }
    const meta = this.officeModalMeta(key);
    const bodyEl = card.querySelector(".modal-body");
    const footEl = card.querySelector(".modal-footer");
    if (bodyEl) {
      bodyEl.className = "modal-body " + (meta.bodyClass || "");
      bodyEl.innerHTML = this.officeModalBody(key);
    }
    if (footEl) footEl.innerHTML = meta.footer || "";
    this.invalidateFit();   // 正文重建了 → 允许重算一次自适应缩放
    /* 这是「面板内操作」后的刷新（选人/翻页/切候选），demo 里这类操作会重播属性条动画，
       所以这里 replay=true；className 已被重置，no-pop 不会残留 */
    this.afterModalRender(true);
  },

  officeModalMeta(key) {
    const s = this.core.state;
    /* footer 随状态变：立项后不再显示「确认立项」；攻关中/研究中按钮换文案并禁用 */
    const pr = this.planReady ? this.planReady() : { ok: true };
    const planFooter = s.planDone
      ? `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>`
      : `<button class="skew-btn ghost" data-action="office-modal-close">取消</button>`
        /* 语料不足 → 直接给「外包补足」入口（2026-09-29 玩家反馈「V2 解锁不了」：
           任务组合门槛高于带入语料时，玩家只看到按钮置灰，不知道去哪补语料） */
        + (pr.corpusShort ? `<button class="skew-btn gold" data-action="om-plan-buycorpus">外包补足（${pr.corpusShort}亿）</button>` : "")
        + `<button class="skew-btn${pr.ok ? "" : " disabled"}" data-action="om-plan-confirm"${pr.ok ? "" : " disabled"}>${pr.ok ? "确认立项" : pr.reason}</button>`;
    const doing = s.focusBoost;
    const focusFooter = doing
      ? `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn disabled" disabled>攻关中…</button>`
      : `<button class="skew-btn ghost" data-action="office-modal-close">取消</button><button class="skew-btn pink" data-action="om-focus-start">开始攻关</button>`;
    const researching = s.paperResearch;
    const paperSelected = this.core.paperOf(this._paperPick);
    const paperReady = this._paperPick != null && paperSelected && !this.core.hasPaper(paperSelected.no)
      && (s.paperCandidates || []).some(id => this.core.paperNoOf(id) === paperSelected.no);
    const paperFooter = researching
      ? `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn disabled" disabled>研究中…</button>`
      : `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn${paperReady ? "" : " disabled"}" data-action="om-paper-start"${paperReady ? "" : " disabled"}>开始研究</button>`;
    const testable = this.core.canTest();
    const reviewable = this.core.canReview();
    const map = {
      team:    { title: "团队一览", icon: "users", bodyClass: "team-modal-body",
                 footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn pink" data-action="office-modal" data-id="hire">去扩编招聘</button>` },
      hire:  { title: "扩编招聘", icon: "briefcase", bodyClass: "hire-modal-body",
                 footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
      recruit: { title: "招募工程师", icon: "briefcase", bodyClass: "recruit-modal-body",
                 footer: `<button class="skew-btn ghost" data-action="office-modal-close">取消</button><button class="skew-btn ghost" data-action="office-modal" data-id="hire">发布需求</button><button class="skew-btn pink" data-action="om-hire">录用</button>` },
      news:    { title: "鲸华社 · 热点", icon: "news", bodyClass: "news-weibo-body",
                 footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
      plan:    { title: "新项目立项", icon: "file", bodyClass: "plan-modal-body", footer: planFooter },
      focus:   { title: "攻关训练", icon: "target", bodyClass: "", footer: focusFooter },
      paper:   { title: "论文研究", icon: "book", bodyClass: "", footer: paperFooter },
      corpus:  { title: "语料仓库", icon: "database", bodyClass: "",
                 footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
      shop:    { title: "购买算力", icon: "cpu", bodyClass: "shop-modal-body",
                 footer: `<button class="skew-btn ghost" data-action="office-modal-close">取消</button><button class="skew-btn gold" data-action="om-buygpu"${this._shopPick && !(s.ownedGpus || []).includes(this._shopPick) ? "" : " disabled"}>${(s.ownedGpus || []).includes(this._shopPick) ? "已拥有该档位，请选择其他档位" : "确认购买"}</button>` },
      test:    { title: "模型测试", icon: "chat", bodyClass: "test-modal-body",
                 /* 2026-09-11 用户要求：去掉「关闭」（右上角本来就有 ×）与「结束测试」；
                    「换个话题」挪到底部，与「清空对话」同款按钮并排。 */
                 footer: `<button class="skew-btn ghost" data-action="om-test-restart">↺ 换个话题</button>${testable ? `<button class="skew-btn ghost" data-action="om-test-clear">清空对话</button>` : ""}` },
      review:  { title: "项目评审", icon: "shield", bodyClass: "review-modal-body",
                 footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button><button class="skew-btn${reviewable ? " pink" : " disabled"}" data-action="om-start-review"${reviewable ? "" : " disabled"}>开始评审</button>` },
      guide:   { title: "玩法说明", icon: "help", bodyClass: "",
                 footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
      /* 2026-09-12：进行中的事件（灵动岛「事件!」角标点开的详情面板） */
      dividend: { title: "进行中的事件", icon: "zap", bodyClass: "",
                  footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` },
      /* 数据定期巡检（2026-09-05）：SFT/RM 小游戏共用的事件式面板（不再用一级界面）。
         footer 随状态变：巡检中可放弃（恢复暂停前状态）；总结态点「完成巡检」关闭。 */
      minigame: { title: "数据定期巡检", icon: "file", bodyClass: "mg-modal-body",
                  footer: s.minigame
  /* [feature:office-feedback-ui-7] */
                    ? `${s.minigame.picked ? `<button class="skew-btn pink" data-action="mg-next">${s.minigame.round + 1 >= s.minigame.total ? "完成标注，看总结 ➜" : "下一题 ➜"}</button>` : ""}<button class="skew-btn ghost" data-action="mg-abandon">放弃巡检</button>`
  /* [/feature:office-feedback-ui-7] */
                    : `<button class="skew-btn ghost" data-action="mg-done">完成巡检</button>` },
    };
    return map[key] || { title: key, bodyClass: "", footer: `<button class="skew-btn ghost" data-action="office-modal-close">关闭</button>` };
  },

  officeModalBody(key) {
    const s = this.core.state;
    switch (key) {
      case "team": return this.omTeam();
      case "recruit": return this.omRecruit();
      case "news": return this.omNews();
      case "hire": return window.V35HireUI ? window.V35HireUI.panel(this) : this.omEmpty("hire");
      case "corpus": return (this.core.v35On && this.core.v35On()) ? this.omCorpus() : this.omEmpty("corpus");
      case "plan": return s.planDone ? this.omPlanDone() : this.omPlan();
      case "focus": return s.planDone ? this.omFocus() : this.omEmpty("focus");
      case "paper": return this.omPaper();
      case "shop": return this.omShop();
      case "test": return this.core.canTest() ? this.omTest() : this.omEmpty("test");
      case "review": return s.planDone ? this.omReview() : this.omEmpty("review");
      case "guide": return this.omGuide();
      case "dividend": return this.omDividend();
      case "minigame": return this.minigameBodyHTML();   // 数据定期巡检（SFT/RM 共用事件式面板）
      default: return this.omEmpty(key);
    }
  },

  /* ---------------- 进行中的事件（2026-09-12）----------------
     灵动岛「事件!」角标点开的详情面板：列出当前仍生效的事件影响。
     目前唯一常驻项 = 投资人分红（收益入账抽成）；以后有同类长时事件影响
     （挂在 s.v35 上跨 tick 生效的）往这里加条目即可。 */
  /* [feature:gameplay-guide-dividend-copy] */
  omDividend() {
    const s = this.core.state;
    const dv = (s.v35 && s.v35.dividend) || null;
    const rows = [];
    if (dv && (dv.left || 0) > 0) {
      const pct = Math.round((dv.pct || 0) * 100);
      rows.push(`
        <div class="dve-card">
          <div class="dve-head"><span class="dve-tag">投资人分红</span><b class="dve-pct">${pct}%</b></div>
          <div class="dve-line">投资人要求后续 <b>${dv.left}</b> 笔收入需要分红 <b>${pct}%</b>（共 ${dv.times || dv.left} 笔）。</div>
          <div class="dve-line">每笔收益入账时先抽成再进账；抽满笔数后自动结束。</div>
          ${(dv.paid || 0) > 0 ? `<div class="dve-line dim">已累计抽成 ¥${Math.round(dv.paid / 10000)} 万</div>` : ""}
          <div class="dve-note">投资人注资、破产兜底款不算「收益」，不会被抽成。</div>
        </div>`);
    }
    if (s.investor) {
      rows.push(`<div class="dve-card"><div class="dve-head"><span class="dve-tag">投资人已入局</span></div>
        <div class="dve-line">投资人在关注公司经营，后续可能提出新的要求。</div></div>`);
    }
    if (!rows.length) {
      return `<div class="om-empty"><div class="om-empty-tip">当前没有进行中的事件</div></div>`;
    }
    return `<div class="dve-list">${rows.join("")}</div>`;
  },
  /* [/feature:gameplay-guide-dividend-copy] */

  /* 空态：一张图 + 一句话（图可在空态图配置里替换） */
  omEmpty(key) {
    const e = (this.core.cfg.EMPTY_STATES || {})[key] || { img: "", text: "暂时没有内容" };
    return `
      <div class="om-empty">
        <img src="${e.img}" alt="" onerror="this.style.display='none'">
        <div class="om-empty-tip">${e.text}</div>
      </div>`;
  },

  /* 面板内局部刷新：淡出 → 换内容 → 淡入（对齐 demo 的 selectTeamMember 等，
     不重建整个 body，避免「点一下闪一下」） */
  /* after：内容换完后的回调（用于重播数值条动画）。
     2026-09-02：以前换完内容就结束了，[data-width] 的新条停在 0% 没人再推它 →
     「点另一个候选人，属性条全空了再也刷不出来」。 */
  omSwap(sel, html, ms, after) {
    const el = this.el.querySelector(sel);
    if (!el) return false;
    const d = ms == null ? 120 : ms;
    /* 2026-09-12：换列（切候选人/切工程师）会改正文高度 → 让它重新算一次自适应缩放。
       注意 fitModalBody 在「指针还在面板上」时会自己跳过，等鼠标移开再补算（见那里的注释）。 */
    this.invalidateFit();
    if (!d) { el.innerHTML = html; if (after) after(); this.fitModalBody(); return true; }
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => {
      el.innerHTML = html;
      el.style.opacity = "1";
      el.style.transform = "none";
      if (after) after();
      this.fitModalBody();
    }, d);
    return true;
  },

  /* ---------------- 团队（demo：左列表 + 右「总览 / 个人详情」双模式） ---------------- */
  omTeam() {
    const s = this.core.state;
    const alive = s.engineers.filter((e) => !e.resigned);
    /* 每页人数：8 → **6**（2026-09-13 用户定）。
       原因：8 行时列表会顶到翻页区甚至溢出去（用户截图「最后一个人和翻页区域重叠」）。
       根因是 **fitModalBody 量不到 flex 容器内部的溢出** —— `.team-modal-body` 是
       `flex:1 + min-height:0`，高度由容器分配 ⇒ `.modal-body.scrollHeight === clientHeight`
       ⇒ 判不出"放不下" ⇒ 不缩放。与其改缩放探测，不如**从源头少放两行**：
       省出来的空间正好让卡片之间、卡片与翻页按钮之间充分隔开。 */
    const per = this.TEAM_PER_PAGE;
    const pages = Math.max(1, Math.ceil(alive.length / per));
    this._teamPage = Math.max(0, Math.min(pages - 1, this._teamPage || 0));
    const pageList = alive.slice(this._teamPage * per, this._teamPage * per + per);

    const rows = pageList.map((e) => {
      /* 2026-09-12（用户反馈）：团队一览恢复品质标识（一般/良好/优秀/天才…，与招聘页同款徽章） */
      const tier = this.core.tierOf(e);
      return `
      <div class="team-row pop-in${this._teamMode === "member" && this._teamPick === e.id ? " selected" : ""}"
           data-action="team-pick" data-id="${e.id}">
        <div class="team-avatar"><img src="${this.engAvatar(e)}" alt=""></div>
        <div class="team-info">
          <div class="team-name">${e.name}<span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(e)}</span></div>
          <div class="team-role">${this.typeName(e.type)}</div>
        </div>
        <div class="team-stats"><span class="team-chip">体力 ${this.engEnergy(e)}</span></div>
      </div>`;
    }).join("") || `<div class="test-empty-tip">还没有人，先去「招聘」</div>`;

    return `
      <div class="team-list-col">
        <div class="team-col-head">
          <span>团队成员</span>
          <span class="team-col-sub">${alive.length}/${this.core.seatCap()}</span>
        </div>
        <div class="team-list" id="teamList">${rows}</div>
        <div class="team-pagination">
          <button class="team-page-btn" data-action="team-page" data-id="-1" ${this._teamPage === 0 ? "disabled" : ""}>
            ${this.icon("chevL", 12)}</button>
          <div class="team-page-info">${this._teamPage + 1}/${pages}</div>
          <button class="team-page-btn" data-action="team-page" data-id="1" ${this._teamPage >= pages - 1 ? "disabled" : ""}>
            ${this.icon("chevR", 12)}</button>
        </div>
      </div>
      <div class="team-detail-col" id="teamDetail">
        ${this._teamMode === "member" && this._teamPick ? this.omTeamDetail() : this.omTeamOverview()}
      </div>`;
  },

  /* 团队总览（demo team.html 的 .stats-sidebar：
     📊 团队数据 → 总人数/平均体力/月薪总和/岗位分布 → 🎯 词条覆盖 → 🎉 团建活动） */
  omTeamOverview() {
    const s = this.core.state;
    const alive = s.engineers.filter((e) => !e.resigned);
    const avg = (k) => alive.length ? Math.round(alive.reduce((a, e) => a + (e[k] || 0), 0) / alive.length) : 0;
    /* 2026-09-02 删「平均协作」；2026-09-04 删「平均忠诚」（都是废弃数值，离职检定早已失效）；
       2026-09-13（用户要求）再删「平均潜力」—— 平均值看不出是谁在拖后腿，想看潜力点个人详情即可。
       腾出的位置换成**岗位分布**：一眼看清预训练 / 后训练 / 数据各几个人。
       岗位分布：固定列「预训练 / 后训练 / 数据」三项（用户点名的三项，人数为 0 也照显示 ——
       0 本身就是情报：「后训练还没人」正是 V3.5 后期的主要瓶颈）。
       ⚠️ 团队里若混进别的岗位（旧档遗留 type=engineer/infra 的人），**追加在后面** ——
       否则各岗位人数之和 ≠ 总人数，玩家会看到「有人凭空消失了」。 */
    const BASE_ROLES = ["pretrain", "post", "data"].concat(this.core.embodiedAvailable&&this.core.embodiedAvailable()?["embodied"]:[]);
    const roleN = {};
    alive.forEach((e) => { roleN[e.type] = (roleN[e.type] || 0) + 1; });
    const roleOrder = BASE_ROLES.concat(Object.keys(roleN).filter((t) => BASE_ROLES.indexOf(t) < 0));
    const roleDist = roleOrder.map((t) => `
      <span class="rd ${t}">${this.typeName(t)} <b>${roleN[t] || 0}</b>人</span>`).join("");
    /* monthlyPayroll 的单位是「元」，demo 显示的是「万/月」 */
    const pay = Math.round(this.core.monthlyPayroll() / 1000) / 10;
    /* 团建（每周一次）/ 聚餐（每 2 周一次）：两项都排满 → 入口置灰。
       ⚠️ 2026-09-22：聚餐冷却存的是**绝对周**（见 core.doTeamBuild），这里也必须用
       core.absWeek() 比；原来读 tb.meeting（该字段早已不用）→ 入口永不置灰。 */
    const tb = s.tbRound || {};
    const meetUsed = tb.meetingWeek != null && this.core.absWeek() - tb.meetingWeek < 2;
    const allUsed = !!tb.team && meetUsed;
    const item = (ico, label, val, unit, cls) => `
      <div class="stat-item">
        <span class="stat-item-label"><span class="ico">${ico}</span>${label}</span>
        <span class="stat-item-value${cls ? " " + cls : ""}">${val}${unit ? `<span class="unit">${unit}</span>` : ""}</span>
      </div>`;

    /* 词条覆盖：取团队在该方向上的最高词条等级，进度 = 等级 / 词条等级上限。
       ⚠️ 分母必须用「词条等级的全局上限」（TRAIT_BASE_SALARY 的 key 最大值 = 5），
       不能用 STAGE_TRAIT_MAX[ver] —— V1 阶段上限是 1，Lv1/1 = 100%，条永远满格。
       按 5 级归一：Lv1=20%、Lv2=40% … Lv5=100%。 */
    /* 2026-09-10 用户要求：词条覆盖去掉「工程」这一行（工程词条极少出现，常年空条） */
    const TYPES = (this.core.cfg.TRAIT_TYPES || ["pretrain", "post", "academic", "data"])
      .filter((t) => t !== "engineer" && (t !== "embodied" || this.core.embodiedAvailable&&this.core.embodiedAvailable()));
    const COLOR = { pretrain: "blue", post: "pink", data: "green", academic: "red" };
    const maxLv = Math.max(1, ...Object.keys(this.core.cfg.TRAIT_BASE_SALARY || {}).map(Number)) || 5;
    const rows = TYPES.map((t) => {
      const lvs = alive.flatMap((e) => (e.traits || []).filter((x) => x.type === t).map((x) => x.level || 0));
      const lv = lvs.length ? Math.max.apply(null, lvs) : 0;
      const pct = lv > 0 ? Math.max(8, Math.min(100, Math.round((lv / maxLv) * 100))) : 0;
      return `
        <div class="coverage-row">
          <span class="coverage-name">${this.traitName(t)}</span>
          <div class="coverage-bar"><div class="coverage-fill ${COLOR[t] || "blue"}" data-width="${pct}"></div></div>
          <span class="coverage-lv">Lv.<span class="lv-label">${lv}</span></span>
        </div>`;
    }).join("");

    return `
      <div class="team-overview">
        <div class="overview-header">
          <div class="overview-title">👥 团队总览</div>
          <div class="overview-subtitle">共 <b>${alive.length}</b> 名成员 · 平均体力 <b class="team-score">${avg("energy")}</b></div>
        </div>
        <div class="stats-card">
          <div class="stats-card-title">
            <span class="title-icon">📊</span>
            <span>团队数据</span>
            <span class="title-line"></span>
          </div>
          <div class="stat-items">
            ${item("👥", "总人数", alive.length, "/" + this.core.seatCap())}
            ${item("🔋", "平均体力", avg("energy"), "", "pink")}
            ${item("💰", "月薪总和", pay, "万/月", "gold")}
            <div class="stat-item">
              <span class="stat-item-label"><span class="ico">🧩</span>岗位分布</span>
              <span class="stat-item-value role-dist">${roleDist}</span>
            </div>
          </div>
          <div class="skill-coverage">
            <div class="coverage-title"><span>🎯</span><span>词条覆盖</span></div>
            <div class="coverage-bars">${rows}</div>
          </div>
          <button class="team-build-btn${allUsed ? " used" : ""}" data-action="om-team-activity"${allUsed ? " disabled" : ""}><span class="ico">🎉</span><span>团建活动</span></button>
        </div>
      </div>`;
  },

  /* 进度条入场（demo 的 animateCoverageBars / initStatsAnimation）：
     所有 [data-width] 的条（词条覆盖 + 候选人属性条）先归零，再依次长到目标宽度。
     replay=false（定时 tick 的静默刷新）时不做归零动画，直接落到目标值，
     避免玩家看到「进度条自己又长了一遍」。 */
  animateCoverageBars(replay) {
    const fills = this.el.querySelectorAll(".modal-card [data-width]");
    fills.forEach((f, i) => {
      const w = f.dataset.width || 0;
      if (!replay) {
        f.style.transition = "none";
        f.style.width = w + "%";
        void f.offsetWidth;          // 强制回流，让 transition:none 立即生效
        f.style.transition = "";
        return;
      }
      f.style.transition = "none";
      f.style.width = "0%";
      void f.offsetWidth;
      f.style.transition = "";
      setTimeout(() => { f.style.width = w + "%"; }, 150 + i * 80);
    });
  },

  /* 立项卡片切换（demo 的 card-switching-in-left/right 动画） */
  planCardSwitch(sel, total, idx) {
    const card = this.el.querySelector(sel);
    if (!card) { this.refreshOfficeBody(); return; }
    const outClass = "card-switching-out-left", inClass = "card-switching-in-right";
    card.classList.add(outClass);
    setTimeout(() => {
      if (sel === "#archCard") {
        /* 2026-09-03：架构卡片按「全表」渲染（不再 filter），未解锁 = 锁定态置灰。
           翻页后整卡重画（含锁定徽标/解锁原因/来源行），品质要求行与 footer 按钮随动。 */
        const c2 = this.core.cfg;
        const archs = c2.ARCHITECTURES || [];
        const a = archs[idx] || {};
        const locked = !this.core.archUnlock(a).ok;
        card.innerHTML = this.archCardInner(a);
        card.classList.toggle("locked", locked);
        const badge = card.closest(".plan-section").querySelector(".section-badge");
        if (badge) badge.textContent = (idx + 1) + " / " + total;
        /* 2026-09-06 修 BUG：翻页换架构时，「算力/语料/周期/预算」四行必须一起重画——
           以前只重画了卡片本身，要求行还停在旧架构（dense 达标），而 footer 按新架构
           （MoE 要标准档）置灰 → 玩家看到「算力要求 ✓ 达标」却点不动、提示算力不足。 */
        const maxP2 = ((c2.GPU_TIERS || {})[this.core.state.gpuTier || "basic"] || {}).maxParam || 7;
        const params2 = (c2.TARGET_PARAMS || [7, 13, 34, 70]).filter((p) => p <= maxP2);
        const pick2 = this._planParam && params2.indexOf(this._planParam) >= 0 ? this._planParam : (params2[0] || 7);
        const reqEl = this.el.querySelector("#mixReq");
        if (reqEl) reqEl.dataset.req = this.core.archQualityReq ? this.core.archQualityReq(a.id, pick2) : ((c2.ARCH_QUALITY_REQ || {})[a.id] || 0);
        const reqSec = this.el.querySelector("#planReqSection");
        if (reqSec) reqSec.innerHTML = this.planReqHTML(pick2);
        this.updateMixUI();
        this.updatePlanFooter();
      }
      card.classList.remove(outClass);
      card.classList.add(inClass);
      setTimeout(() => card.classList.remove(inClass), 380);
    }, 190);
  },

  /* 集体活动（demo 的 sub-modal）：团建 / 聚餐 / 动员大会 */
  omTeamActivity() {
    if (this.el.querySelector("#activityPop")) return;
    /* 2026-09-12（用户要求）：下班窗口内不能团建 */
    if (this.core.offworkNow && this.core.offworkNow()) {
      this.toast("🌙 都下班了，团建明天上班再安排");
      return;
    }
    /* 效果与 GameCore.doTeamBuild 对齐（数值从配置读）。
       2026-09-12：聚餐改「每 2 周一次」（meetingWeek = 上次聚餐周号）。 */
    const s = this.core.state;
    const tb = s.tbRound || {};
    const tb2 = this.core.cfg.TEAM_BUILD || {};
    const acts = [
      { kind: "team", icon: "🏔️", name: "团队旅游", cost: (tb2.TEAM_COST != null ? tb2.TEAM_COST : 100000),
        desc: "全员体力 +10", note: "每周一次", used: !!tb.team },
      { kind: "meeting", icon: "🍜", name: "聚餐", cost: 0, desc: "全员体力 +8", note: "每 2 周一次",
        used: tb.meetingWeek != null && this.core.absWeek() - tb.meetingWeek < 2 },
    ];
    const div = document.createElement("div");
    div.id = "activityPop";
    div.className = "sub-modal-overlay";
    div.innerHTML = `
      <div class="sub-modal-card">
        <div class="sub-modal-header">
          <div class="sub-modal-title">🎉 选择集体活动</div>
          <button class="modal-close" data-action="activity-close" title="关闭">${this.icon("x", 13)}</button>
        </div>
        <div class="sub-modal-body set-body">
          ${acts.map((a) => `
            <button class="shop-tier${a.used ? " used" : ""}" data-action="om-activity-do" data-id="${a.kind}"${a.used ? " disabled" : ""}>
              <div class="shop-tier-info">
                <div class="shop-tier-name">${a.icon} ${a.name}</div>
                <div class="shop-tier-spec">${a.desc}</div>
                ${a.note ? `<div class="shop-tier-note">${a.note}</div>` : ""}
              </div>
              <div class="shop-tier-price">${a.used ? "已安排" : (a.cost ? fmtMoney(a.cost) : "免费")}</div>
            </button>`).join("")}
        </div>
        <div class="sub-modal-footer">
          <button class="skew-btn ghost" data-action="activity-close">关闭</button>
        </div>
      </div>`;
    this.el.appendChild(div);
  },

  /* 个人详情（demo 的 detail-*） */
  omTeamDetail() {
    const s = this.core.state;
    const cur = s.engineers.find((e) => e.id === this._teamPick);
    if (!cur) return `<div class="test-empty-tip">成员已离开</div>`;
    /* 2026-09-02：去掉「精力」—— 它是工程师卡上的静态初始字段，与下面那条运行态
       「体力」重复显示，两个都是「体」会把人看晕。新体系只认运行态体力（影响产出效率）。 */
    const STATS = this.core.engStatKeys(cur).map(k=>[k,this.core.statName(k)]);
    const COLORS = {
      code: "linear-gradient(90deg,#6fc3ff,#2789c4)", algo: "linear-gradient(90deg,#7ed4f0,#3dbbd8)",
      text: "linear-gradient(90deg,#ffcf8a,#f2b84b)", engineering: "linear-gradient(90deg,#8fb8ff,#5f91ed)",
    };
    const stat = (k, name) => {
      const v = Math.round((cur.stats && cur.stats[k]) || 0);
      return `
        <div class="detail-stat-row">
          <div class="detail-stat-label"><span>${name}</span><b>${v}</b></div>
          <div class="detail-stat-bar"><div class="detail-stat-fill" style="width:${Math.min(100, v)}%;background:${COLORS[k]}"></div></div>
        </div>`;
    };
    /* 体力单独一条数值条（用户 2026-08-30：士气这一项没什么用，体力要看得见）。
       按余量变色：充足绿 / 偏低黄 / 见底红。 */
    const en = this.engEnergy(cur);
    const enColor = en >= 60 ? "linear-gradient(90deg,#7ed4b0,#53b98d)"
      : en >= 25 ? "linear-gradient(90deg,#ffd27a,#f2b84b)"
      : "linear-gradient(90deg,#ff9d8a,#f2705a)";
    const energyRow = `
      <div class="detail-stat-row">
        <div class="detail-stat-label"><span>⚡ 体力</span><b>${en}</b></div>
        <div class="detail-stat-bar"><div class="detail-stat-fill" style="width:${Math.max(0, Math.min(100, en))}%;background:${enColor}"></div></div>
      </div>`;
    const raiseBoost = this.core.raiseProductionStatus ? this.core.raiseProductionStatus(cur) : null;
  /* [feature:last-engineer-detail-fire] */
    return `
      <div class="detail-header">
        <div class="detail-avatar"><img src="${this.engAvatar(cur)}" alt=""></div>
        <div class="detail-name">${cur.name}</div>
        <div class="detail-role">${this.typeName(cur.type)}</div>
      </div>
      <div class="detail-stats">${STATS.map((x) => stat(x[0], x[1])).join("")}${energyRow}</div>
      <div class="detail-info-item">
        <div class="dii-title">当前状态</div>
        <div class="recruit-detail-tags">${(cur.traits || []).filter((t) => t.type !== "engineer").map((t) => `<span class="recruit-detail-tag" title="${this.traitDesc(t.type) || ""}" data-tip="${this.traitDesc(t.type) || ""}">${this.traitName(t.type)} Lv.${t.level || 1}</span>`).join("") || '<span class="recruit-detail-tag">无词条</span>'}</div>
      </div>
      <div class="detail-info-item">
        <div class="dii-title">薪资</div>
        ${fmtMoney(cur.salary)} / 月
        ${raiseBoost && raiseBoost.active ? `<div class="recruit-detail-tags" data-raise-production><span class="recruit-detail-tag">产出 +${Math.round((raiseBoost.mul - 1) * 100)}% · 剩余 ${raiseBoost.weeksLeft} 周</span></div>` : ""}
      </div>
      <div class="detail-actions">
        <button class="skew-btn sm" data-action="om-arrange-menu" data-id="${cur.id}"><span>安排</span></button>
        <button class="skew-btn sm danger" data-action="om-fire" data-id="${cur.id}" ${this.core.canFireEngineer(s) ? "" : 'disabled title="不能辞退最后一名工程师"'}><span>辞退</span></button>
        ${this.core.canFireEngineer(s) ? "" : '<span class="dg-dim">团队至少需要保留一名工程师</span>'}
      </div>`;
  /* [/feature:last-engineer-detail-fire] */
  },

  /* 「安排」的子菜单：原个人行动卡（谈心/培训/加薪/休息）合并到这里。
     以前点「安排」是直接执行一次谈心，玩家点了看不到任何面板，等于没反应。
     2026-09-09 用户要求：次数用完的选项直接置灰，不能点才不会误导。 */
  omArrangeMenu(engId) {
    /* 2026-09-23 修 BUG（玩家：快速循环「点头像 → 安排休息」后，后续头像点不动）：
       以前弹层开着时点别的头像 = **静默 return**（点了没反应）—— 快速循环里只要有
       一次弹层没关干净（手势被 tick render 打断 / 80ms 补发竞态），之后所有头像都
       像"卡死"。改成：已开着就先摘掉旧的，为刚点的这位重开 —— 玩家点头像的意图
       永远是「看这个人」，没有"忽略"的道理。 */
    this.el.querySelectorAll("#arrangePop").forEach((n) => n.remove());
    const s = this.core.state;
    /* 2026-09-12（用户要求）：下班窗口内不能安排 */
    if (this.core.offworkNow && this.core.offworkNow()) {
      this.toast("🌙 已经下班了，安排的事明天上班再说");
      return;
    }
    const e = s.engineers.find((x) => x.id === engId);
    if (!e) return;
    /* 2026-09-02：文案按 GameCore 里的真实效果逐项对齐（以前是旧数值体系的描述，
       点了和看到的不一样；加薪还被标成「免费」，实际要扣一个月的加薪额）。
       数值从配置读，改了配置文案跟着变，不再各写一份。
       2026-09-04：干劲 / 忠诚是 v3.5 之前的废弃数值（引擎不参与任何结算），
       面板上承诺「干劲 +10、忠诚 +4」等于骗人 —— 全部移除，只留真实生效的收益。
       培训按用户需求改为「哪项低就更容易抽到哪项」。 */
    const tb = this.core.cfg.TEAM_BUILD || {};
    const trainCost = tb.TRAIN_COST != null ? tb.TRAIN_COST : 30000;
    const restGain = tb.REST_ENERGY != null ? tb.REST_ENERGY : 35;
    const trainAdd = tb.TRAIN_STAT_ADD != null ? tb.TRAIN_STAT_ADD : 5;
    const trainEn = tb.TRAIN_ENERGY_COST != null ? tb.TRAIN_ENERGY_COST : 10;
    const talkGain = tb.TALK_ENERGY != null ? tb.TALK_ENERGY : 12;
    const raiseEn = tb.RAISE_ENERGY != null ? tb.RAISE_ENERGY : 30;
    const raiseAdd = Math.max(1000, Math.round((e.salary || 0) * 0.1));   // 与 raiseSalary 同算法
    const raiseBoostCfg = this.core.raiseProductionCfg ? this.core.raiseProductionCfg() : { weeks: 4, mul: 1.5 };
    /* ⚠️ 2026-09-22：四项「是否用完」的判定**不再在这里重写一份键**，统一走
       core.arrangeUsed(e)（唯一真源）。以前 UI 与 core 各写一份，一漂移就出现
       「面板显示还能谈、点了却说已经谈过」；而且两边都用阶段内时钟（s.week / s.rounds），
       进新阶段归零 → 冷却会错乱（谈心/聚餐那批 BUG）。 */
    const used = this.core.arrangeUsed(e);
    /* 2026-09-09：花钱的操作经费不足也置灰（培训/加薪），与引擎校验一致 */
    const poor = (cost) => cost > 0 && (s.funding || 0) < cost;
    /* 文案口径（2026-09-22）：体力是**这个人自己的**，效果直接写人，不再写「岗位共享」。 */
    const opts = [
      { kind: "talk",  icon: "💬", name: "谈心",  sub: `${e.name} 体力 +${talkGain}`, note: "每人每 2 周一次", cost: 0, disabled: used.talk, reason: "次数已用完" },
      { kind: "train", icon: "📚", name: "培训",  sub: `随机一项潜力 +${trainAdd}（${this.core.engStatKeys(e).map(k=>this.statName(k)).join("/")}等概率）、${e.name} 体力 -${trainEn}`, note: "每人每周一次", cost: trainCost, disabled: used.train || poor(trainCost), reason: used.train ? "次数已用完" : "经费不足" },
      /* [feature:integer-salary-copy] */
      { kind: "raise", icon: "💰", name: "加薪",  sub: `月薪 +${fmtMoney(raiseAdd)}（永久）、${e.name} 体力 +${raiseEn}、接下来 ${raiseBoostCfg.weeks} 周产出 +${Math.round((raiseBoostCfg.mul - 1) * 100)}%`, note: "每人每月一次", cost: raiseAdd, disabled: used.raise || poor(raiseAdd), reason: used.raise ? "次数已用完" : "经费不足" },
      /* [/feature:integer-salary-copy] */
      { kind: "rest",  icon: "😴", name: "安排休息",  sub: `本周下班不产出 · 下周上班 ${e.name} 体力 +${restGain}`, note: "每人每周两次", cost: 0, disabled: used.rest, reason: "次数已用完" },
    ];
    const div = document.createElement("div");
    div.id = "arrangePop";
    div.className = "sub-modal-overlay";
    div.innerHTML = `
      <div class="sub-modal-card">
        <div class="sub-modal-header">
          <div class="sub-modal-title">🧑‍💼 安排 ${e.name}</div>
          <button class="modal-close" data-action="arrange-close" title="关闭">${this.icon("x", 13)}</button>
        </div>
        <div class="sub-modal-body set-body">
          ${opts.map((o) => `
            <button class="shop-tier${o.disabled ? ' used' : ''}" data-action="om-arrange-do" data-kind="${o.kind}" data-id="${engId}"${o.disabled ? ' disabled tabindex="-1"' : ''}>
              <div class="shop-tier-info">
                <div class="shop-tier-name">${o.icon} ${o.name}${o.disabled ? ' <span style="opacity:.6;">（' + o.reason + '）</span>' : ''}</div>
                <div class="shop-tier-spec">${o.sub}</div>
                ${o.note ? `<div class="shop-tier-note">${o.note}</div>` : ""}
              </div>
              <div class="shop-tier-price">${o.cost ? fmtMoney(o.cost) : "免费"}</div>
            </button>`).join("")}
        </div>
        <div class="sub-modal-footer">
          <button class="skew-btn ghost" data-action="arrange-close">关闭</button>
        </div>
      </div>`;
    this.el.appendChild(div);
  },

  /* 点成员：只换右栏（淡出淡入），不重建整卡 */
  omTeamPick(id) {
    this._teamMode = "member";
    this._teamPick = id;
    this.el.querySelectorAll(".team-row").forEach((r) => r.classList.toggle("selected", r.dataset.id === id));
    this.omSwap("#teamDetail", this.omTeamDetail(), null, () => this.animateCoverageBars(true));
  },

  omTeamPage(delta) {
    const s = this.core.state;
    const alive = s.engineers.filter((e) => !e.resigned);
    /* ⚠️ 2026-09-16 修 BUG：这里原本写死 per = 8，而 omTeam 渲染用的是 6 ——
       两处不一致 ⇒ 点翻页后按 8 人重排，7~8 人的队 pages 从 2 掉到 1、
       _teamPage 被 clamp 回 0 ⇒ slice(0,8) 把下一页的人渲染到当前页最下方，
       6 行变 8 行撑出列表盒、压住下方翻页按钮（玩家报的「没翻页反而塞人+重叠」）。
       渲染与翻页必须共用同一个数 → 统一读 TEAM_PER_PAGE。 */
    const per = this.TEAM_PER_PAGE;
    const pages = Math.max(1, Math.ceil(alive.length / per));
    this._teamPage = Math.max(0, Math.min(pages - 1, (this._teamPage || 0) + delta));
    const pageList = alive.slice(this._teamPage * per, this._teamPage * per + per);
    const rows = pageList.map((e) => {
      const tier = this.core.tierOf(e);
      return `
      <div class="team-row${this._teamPick === e.id ? " selected" : ""}" data-action="team-pick" data-id="${e.id}">
        <div class="team-avatar"><img src="${this.engAvatar(e)}" alt=""></div>
        <div class="team-info">
          <div class="team-name">${e.name}<span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(e)}</span></div>
          <div class="team-role">${this.typeName(e.type)}</div>
        </div>
        <div class="team-stats"><span class="team-chip">体力 ${this.engEnergy(e)}</span></div>
      </div>`;
    }).join("");
    const list = this.el.querySelector("#teamList");
    if (list) list.innerHTML = rows;
    /* 翻页控件（页码 / 两个箭头）**限定在团队列表列内**再查：
       .team-page-btn / .team-page-info 是团队页与招聘页共用的 class，
       全局 querySelectorAll 会按文档顺序取到别人的按钮（顺序一变就改错对象）。 */
    const col = this.el.querySelector(".team-list-col");
    const info = col ? col.querySelector(".team-page-info") : null;
    if (info) info.textContent = (this._teamPage + 1) + "/" + pages;
    const btns = col ? col.querySelectorAll(".team-page-btn") : [];
    if (btns[0]) btns[0].disabled = this._teamPage === 0;
    if (btns[1]) btns[1].disabled = this._teamPage >= pages - 1;
  },

  /* ---------------- 招聘（demo：左候选人 + 右详情/简介） ---------------- */
  omRecruit() {
    const s = this.core.state;
    const cands = s.candidates || [];
    if (!cands.length) return this.omEmpty("recruit");
    const alive = s.engineers.filter((e) => !e.resigned).length;
    /* 分页（2026-09-08）：候选人一多整页会被整体缩放到看不清 —— 每页 8 人，多的翻页 */
  /* [feature:recruit-codex-capacity-list] */
    const PER = 8;
    const pages = Math.max(1, Math.ceil(cands.length / PER));
  /* [/feature:recruit-codex-capacity-list] */
    const page = Math.max(0, Math.min(pages - 1, this._recruitPage || 0));
  /* [feature:recruit-codex-capacity-pick] */
    this._recruitPage=page;
    const pageList = cands.slice(page * PER, page * PER + PER);
    if(!pageList.some(e=>e.id===this._recruitPick))this._recruitPick=pageList[0]?.id||null;
  /* [/feature:recruit-codex-capacity-pick] */
    const list = pageList.map((e) => {
      /* 2026-09-07：列表行补稀有度徽标（与团队页同一套 dg-tier-badge），扩编找到的人同样适用 */
      const tier = this.core.tierOf(e);
      return `
      <div class="recruit-row pop-in${this._recruitPick === e.id ? " selected" : ""}" data-action="recruit-pick" data-id="${e.id}">
        <div class="recruit-avatar"><img src="${this.engAvatar(e)}" alt=""></div>
        <div class="recruit-info">
          <div class="recruit-name">${e.name}<span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(e)}</span></div>
          <div class="recruit-role">${this.typeName(e.type)}</div>
        </div>
        <div class="recruit-salary">${fmtMoney(e.salary)}<span class="recruit-salary-unit">/月</span></div>
      </div>`;
    }).join("");
    return `
      <div class="recruit-list-col">
        <div class="team-col-head">
          <span>可招募候选人（${cands.length}）</span>
          <span class="team-col-sub">座位 ${alive}/${this.core.seatCap()}</span>
        </div>
        <div class="recruit-list">${list}</div>
        ${pages > 1 ? `<div class="team-pagination">
          <button class="team-page-btn" data-action="recruit-page" data-id="-1" ${page === 0 ? "disabled" : ""}>${this.icon("chevL", 12)}</button>
          <div class="team-page-info">${page + 1}/${pages}</div>
          <button class="team-page-btn" data-action="recruit-page" data-id="1" ${page >= pages - 1 ? "disabled" : ""}>${this.icon("chevR", 12)}</button>
        </div>` : ""}
      </div>
      <div class="recruit-detail-col" id="recruitDetail">${this.omRecruitDetail()}</div>`;
  },

  omRecruitDetail() {
    const s = this.core.state;
    const cands = s.candidates || [];
    const cur = cands.find((x) => x.id === this._recruitPick) || cands[0];
    if (!cur) return "";
    const COLORS = {
      code: "linear-gradient(90deg,#6fc3ff,#2789c4)", algo: "linear-gradient(90deg,#7ed4f0,#3dbbd8)",
      text: "linear-gradient(90deg,#ffcf8a,#f2b84b)", engineering: "linear-gradient(90deg,#8fb8ff,#5f91ed)",
    };
    /* 2026-09-10：协作（coop）与精力（energy）属性已彻底删除，属性条只剩 code/algo/text；
       却一直显示在候选人属性条里，玩家会以为它有用。 */
    const rows = this.core.engStatKeys(cur).map(k=>[k,this.core.statName(k)])
      .map((x) => {
        const k = x[0], name = x[1];
        const v = (cur.stats || {})[k] || 0;
        return `
          <div class="rds-row">
            <div class="rds-label"><span>${name}</span><b>${v}</b></div>
            <div class="rds-bar"><div class="rds-fill" style="width:0%;background:${COLORS[k]}" data-width="${Math.min(100, v)}"></div></div>
          </div>`;
      }).join("");
    const bio = cur.resume ? [cur.resume.exp, cur.resume.univ].filter(Boolean).join(" · ") : "";
    /* demo：词条标签放在「个人简介」卡片内部（recruit-detail-tags / recruit-detail-tag） */
    /* 2026-09-16：工程词条下线——先过滤再判空，否则只剩 engineer 时会渲染空标签容器 */
    const _visTraits = (cur.traits || []).filter((t) => t.type !== "engineer");
    const tags = _visTraits.length
      ? `<div class="recruit-detail-tags">${_visTraits.map((t) => `<span class="recruit-detail-tag" title="${this.traitDesc(t.type) || ""}" data-tip="${this.traitDesc(t.type) || ""}">${this.traitName(t.type)} Lv.${t.level || 1}</span>`).join("")}</div>`
      : "";
    /* 2026-09-07：详情头部补稀有度徽标 + 候选人有效期（反抽卡：超期自动走人，必须让玩家看见） */
    const tier = this.core.tierOf(cur);
      const ttlW = this.core.cfg.CANDIDATE_TTL_WEEKS || 0;
      /* ⚠️ 用**绝对周**算剩余耐心（2026-09-13 修「偶尔出现耐心 10 多周」）：
         过期时间与当前时间都走 absWeek()，跨阶段（s.week 归零）才不会凭空多出几周。 */
      const _expAbs = this.core.candExpireAbs ? this.core.candExpireAbs(cur) : null;
      const leftW = (_expAbs != null && ttlW > 0) ? Math.max(0, _expAbs - this.core.absWeek()) : null;
    const expireLine = leftW == null ? ""
      : `<div class="recruit-detail-expire${leftW <= 1 ? " urgent" : ""}">⏳ ${leftW <= 0 ? "本周结束他将另谋高就" : "他的耐心只剩 " + leftW + " 周，逾期不再等你"}</div>`;
    /* doc/27 §6.3.5：招 data / post 岗时提示「这个人能产哪根轴」——帮玩家**按轴挑人**。
       只列「他的词条能驱动 ∩ 本阶段真的激活了」的轴（取交集）：
       没激活的轴不显示 —— 否则会拿一根这局根本长不出来的轴去误导玩家。 */
    const axHint = (function () {
      /* ⚠️ activeAxes 挂在 window.V35 上（不是 core）—— 写成 this.core.activeAxes 会直接抛错 */
      const act = (window.V35 && window.V35.activeAxes) ? (window.V35.activeAxes(s) || []) : [];
      if (!act.length) return [];
      const hit = [];
      for (const t of (cur.traits || [])) {
        for (const id of this.traitAxes(t.type)) if (act.indexOf(id) >= 0 && hit.indexOf(id) < 0) hit.push(id);
      }
      return hit;
    }).call(this);
    const axHintHTML = axHint.length
      ? `<div class="recruit-detail-axhint">他带的词条能产出：<b>${axHint.map((id) => this.core.statLabel(id)).join(" / ")}</b></div>`
      : "";
    return `
      <div class="recruit-detail-header">
        <div class="recruit-detail-avatar"><img src="${this.engAvatar(cur)}" alt=""></div>
        <div class="recruit-detail-name">${cur.name}<span class="dg-tier-badge dg-tier-badge-sm ${tier.cls}">${this.core.tierLabel(cur)}</span></div>
        <div class="recruit-detail-role">${this.typeName(cur.type)}</div>
        <div class="recruit-detail-salary">月薪 ${fmtMoney(cur.salary)}<span class="recruit-salary-unit"> / 月</span></div>
        <div class="recruit-detail-arrive">到岗：${this.joinWeek(cur.type)}</div>
      </div>
      ${expireLine}
      <div class="recruit-detail-stats">${rows}</div>
      ${axHintHTML}
      <div class="recruit-detail-bio"><b>个人简介</b><br>${bio || "（这位候选人没留下简介）"}${tags}</div>`;
  },

  omRecruitPick(id) {
    this._recruitPick = id;
    this.el.querySelectorAll(".recruit-row").forEach((r) => r.classList.toggle("selected", r.dataset.id === id));
    /* 换完人重播属性条：新 DOM 的 [data-width] 是 0%，不推一把就永远不长 */
    this.omSwap("#recruitDetail", this.omRecruitDetail(), null, () => this.animateCoverageBars(true));
  },

  /* ---------------- 立项（demo：plan-modal-body 蓝图风） ---------------- */
  /* 阶段任务目标卡片（doc/23）：立项面板顶部常驻，实时反映"当前选择是否达成目标" */
  missionCardHTML(archId, param) {
    const c = this.core.cfg;
    const M = c.MISSIONS || {};
    if (M.ENABLED === false || !this.core.missionPreview) return "";
    const p = this.core.missionPreview(archId, param);
    const m = this.core.missionOf(this.core.state.ver);
    const UI = M.UI || {};
    const req = [];
    if (m.arch) {
      const ad = (c.ARCHITECTURES || []).find((a) => a.id === m.arch);
      req.push("架构 " + (ad ? ad.name : m.arch));
    }
    /* 2026-09-29 用户反馈：文案写成「参数 ≥ 13B」，玩家会以为「选更大的参数也符合」，
       但实际情况是只有任务钉死的那一档才走得通（更大参数语料门槛过不了、组合也不同）。
       文案改为直接写目标档位「参数 13B」。所有阶段共用这一行 → 一处改动全局生效。 */
    if (m.param) req.push("参数 " + m.param + "B");
    /* 2026-09-29 用户拍板：取消「这个组合此前没用过」这一条 —— 立项只问「架构 + 参数」，
       组合可以去重地反复训练（直到轴达标 / 分数达标为止）。 */
    /* ⚠️ 2026-09-14（用户要求）：**轴目标不再并进这一行** —— 立项卡只谈「架构 × 参数」两件事。
       轴达标与否是**结算时**才算的（isMissionFail），结算页在真没达标时会用诊断口径点出来
       （「轴未达标：记忆 120 / 375」），比在立项时列一串「记忆 ≥ 375、推理 ≥ 277…」有用得多。 */
    /* 三态：miss（不符合要求）> fixed（本阶段没得选）> hit（符合要求）。
       ⚠️ 立项阶段只谈「是否符合要求」——「达成」是结算之后的事，开局就绿标会让目标显得白给。 */
    const fixed = p.hit && this.planIsFixed();
    const cls = !p.hit ? "miss" : (fixed ? "fixed" : "hit");
    const state = !p.hit ? "不符合要求" : (fixed ? "配置已固定" : "符合要求");
    const mark = !p.hit ? "!" : (fixed ? "=" : "✓");
    const tip = !p.hit ? (UI.MISS || "") : (fixed ? (UI.FIXED || "") : (UI.HIT || ""));
    /* 布局（2026-09-08 用户要求）：标题一行 + 「要求：…」一行 = 正好两行。
       任务说明那句（"用最稳的…训出来"）与括号提醒都删掉 —— 达成状态看右侧状态标（符合/固定/不符合）即可。 */
    return `<div class="mission-card ${cls}" id="missionCard">
      <div class="mc-head">
        <span class="mc-icon">${mark}</span>
        <span class="mc-title">本阶段任务 · ${p.name || "达成训练目标"}</span>
        <span class="mc-state" title="${this.escAttr(tip)}">${state}</span>
      </div>
      <div class="mc-req">要求：${req.join(" · ")}</div>
    </div>`;
  },

  /* 架构解锁条件（一句话）：版本 + 论文钥匙（外部）/ 团队提案（自研）。立项卡片上常驻显示。
     2026-09-13：自研路线（unlockBy === "approval"：mla/dsa/csa）在现实中是我们自己发布的报告，
     不走研读 → 条件写成「团队提案 · 批准后立项」，不再显示「研读《别人的论文》」。 */
  archUnlockCond(a) {
    const c = this.core.cfg;
    const parts = [(a && a.unlock ? a.unlock : "V1") + " 阶段起"];
    if (a && a.unlockBy === "embodied") {
      const ok=(this.core.state.approvedArchs||[]).includes(a.id);
      parts.push(ok ? "具身团队方案已获授权" : a.id === "vla" ? "具身智能时代剧情 · 接受邀请后授权" : "专属团队提案 · 批准后立项");
    } else if (a && a.unlockBy === "approval") {
      const ok = this.core.archUnlock(a).approvalOk;
      parts.push(ok ? "团队方案已批准" : "团队提案 · 批准后立项");
    } else {
      const pt = (a && a.unlockPaper) ? this.core.paperOf(a.unlockPaper) : null;
      if (pt) parts.push("研读《" + pt.title + "》");
    }
    return parts.join(" · ");
  },
  /* 架构说明（点「!」弹出）：原型 / 特点 / 详细说明 / 解锁条件 / 来源论文（自研 = 我们的报告） */
  archInfoTip(a) {
    const c = this.core.cfg;
    const pt = (a && a.unlockPaper) ? this.core.paperOf(a.unlockPaper) : null;
    const bits = [];
    if (a && a.proto) bits.push(a.proto);
    if (a && a.trait) bits.push(a.trait);
    if (a && a.desc) bits.push(a.desc);
    /* 追加能力轴（doc/27 P1）：说清「能不能带出轴」与「需要多大参数 + 哪些词条岗位」 */
    const ax = (a && a.axes) || [];
    if (ax.length) {
      const D = this.axisDefs();
      bits.push("追加能力轴：" + ax.map((id) => {
        const d = D[id] || {};
        return (d.name || id) + "（≥" + (((d.source || {}).paramMin) || 0) + "B）";
      }).join("、"));
      bits.push("　产出岗位：" + this.axisDriverTip(ax));
    } else {
      bits.push("追加能力轴：无 —— 本架构只产出四维（代码/文字/安全/稳定）");
    }
    bits.push("解锁条件：" + this.archUnlockCond(a));
    /* 自研路线：这条路上我们自己提出并发布的报告 —— 不研读，改由团队提案批准 */
    if (a && ["approval","embodied"].includes(a.unlockBy) && a.selfReport) {
      bits.push("自家报告：《" + a.selfReport + "》"
        + (a.selfReportMeta ? "（" + a.selfReportMeta + "）" : "")
        + " —— 我们自己提出的路线，不需要研读");
    }
    if (pt) bits.push("来源论文：《" + pt.title + "》");
    return bits.join("\n");
  },
  escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
  /* ---------------- 追加能力轴（doc/27 P1）----------------
     判定与引擎**同一套口径**（架构 ∈ source.archs 且 参数 ≥ source.paramMin），
     杜绝「立项面板说会带出记忆轴、练完却没有」这类面板/引擎不一致。 */
  axisDefs() {
    const defs=(((this.core.cfg || {}).V35 || {}).AXES || {}).DEF || {};
    return Object.fromEntries(Object.keys(defs).map(id=>[id,this.core.axisDef ? this.core.axisDef(id) : defs[id]]));
  },
  axisChip(id) {
    const d = this.axisDefs()[id] || {};
    return `<span class="axis-chip">${this.axisIcon(id, 12)}${d.name || id}</span>`;
  },
  /* 该「架构 × 参数」组合实际会激活哪些轴 */
  axesOf(archId, param, ver) {
    const stage=ver || (this.core.state||{}).ver || "V1";
    if(window.V35&&window.V35.activeAxes)return window.V35.activeAxes({arch:archId,paramTarget:param,ver:stage});
    const A = ((this.core.cfg || {}).V35 || {}).AXES || {};
    if (A.ENABLED === false) return [];
    const D = A.DEF || {}, P = Number(param) || 0;
    return (A.ORDER || []).filter((id) => {
      const d = D[id];
      if (!d || !d.source) return false;
      if(d.source.minVer){const order=this.core.cfg.VER_ORDER||[];if(order.indexOf(stage)<order.indexOf(d.source.minVer))return false;}
      if ((d.source.archs || []).indexOf(archId) < 0) return false;
      return P >= (d.source.paramMin || 0);
    });
  },
  /* 该组合的轴由哪些词条驱动（告诉玩家该招什么人） */
  axisDriverTip(ids) {
    const D = this.axisDefs();
    const M = this.core.cfg.TRAIT_META || {};
    const need = {};
    for (const id of (ids || [])) {
      for (const dr of (((D[id] || {}).drivers) || [])) {
        const nm = (M[dr.role] || {}).name || dr.role;
        (need[nm] = need[nm] || []).push((D[id] || {}).name || id);
      }
    }
    return Object.keys(need).map((n) => n + "词条 → " + need[n].join("·")).join(" / ");
  },

  /* 架构卡片内容（omPlan 首屏与 planCardSwitch 翻页共用）：
     2026-09-08 用户要求 —— 只保留「架构名 + 解锁条件」，详细说明收进「!」按钮。
     2026-09-10 doc/27 P1：再加一行「带出哪些能力轴」。 */
  archCardInner(a) {
    const locked = !this.core.archUnlock(a).ok;
    const ax = (a && a.axes) || [];
    const axLine = ax.length
      ? `<div class="ac-axes"><i>带出</i>${ax.map((id) => this.axisChip(id)).join("")}</div>`
      : `<div class="ac-axes none">无追加能力轴</div>`;
    return `
      <div class="ac-name">${(a && a.name) || "—"}<span class="ac-info" data-tip="${this.escAttr(this.archInfoTip(a))}" title="点这里看架构说明">!</span>${locked ? '<i class="ac-lock">🔒 未解锁</i>' : ""}</div>
      <div class="ac-unlock">${locked ? "🔒 " : "✓ "}${this.archUnlockCond(a)}</div>
      ${axLine}`;
  },

  /* 立项面板当前选中的参数档（渲染 / 翻架构 / 确认三处共用，避免三套算法漂移） */
  planParamOptions(archId) {
    const c=this.core.cfg,s=this.core.state,a=(c.ARCHITECTURES||[]).find(a=>a.id===archId)||{};
    const gpuMax=((c.GPU_TIERS||{})[s.gpuTier||'basic']||{}).maxParam||7;
    const max=this.core.archMaxParam?this.core.archMaxParam(archId):gpuMax;
    return(c.TARGET_PARAMS||[7,13,34,70]).filter(p=>p>=(Number(a.minParam)||0)&&p<=gpuMax&&p<=max);
  },
  planPickParam() {
    const c = this.core.cfg, s = this.core.state;
    const maxP = ((c.GPU_TIERS || {})[s.gpuTier || "basic"] || {}).maxParam || 7;
    const archs = c.ARCHITECTURES || [];
    const ai = (((this._planArch || 0) % archs.length) + archs.length) % archs.length;
    const archId = (archs[ai] || {}).id;
    const archMaxP = this.core.archMaxParam ? this.core.archMaxParam(archId) : maxP;
    const params = this.planParamOptions(archId);
    return this._planParam && params.indexOf(this._planParam) >= 0 ? this._planParam : (params[0] || (archs[ai]||{}).minParam || 7);
  },
  /* 本阶段是否"没得选"（只有一个合法架构 且 只有一个可选参数档，如 V1）。
     2026-09-07 用户反馈：开局就显示「已达成」像白给 —— 这种阶段显示「配置已固定」更诚实。 */
  planIsFixed() {
    const c = this.core.cfg, s = this.core.state;
    const archs = (c.ARCHITECTURES || []).filter((a) => this.core.archUnlock(a).ok);
    const maxP = ((c.GPU_TIERS || {})[s.gpuTier || "basic"] || {}).maxParam || 7;
    const params = (c.TARGET_PARAMS || [7, 13, 34, 70]).filter((p) => p <= maxP);
    return archs.length <= 1 && params.length <= 1;
  },
  /* 翻架构 / 改参数后就地替换目标卡片（不重建面板——重建会重置语料滑条与翻页动画） */
  refreshMissionCard(archId, param) {
    const el = this.el.querySelector("#missionCard");
    if (!el || !this.core.missionPreview) return;
    const box = document.createElement("div");
    box.innerHTML = this.missionCardHTML(archId, param);
    const next = box.firstElementChild;
    if (next) el.replaceWith(next);
  },

  omPlan() {
    const c = this.core.cfg;
    const s = this.core.state;
    /* 架构：全部显示（含未解锁，未解锁置灰锁定，不可立项）。
       ⚠️ 2026-09-03 修复：此前这里 filter(archOpen) 只剩 1 个，而翻页/确认用的是全表
       （planCardSwitch / confirmPlan 都按 ARCHITECTURES 全表取），索引错位 →
       表现为「一开始只有一个选项，点一下翻页全出来了」——统一用全表 + 锁定态。 */
    const archs = c.ARCHITECTURES || [];
    const ai = (((this._planArch || 0) % archs.length) + archs.length) % archs.length;
    const arch = archs[ai] || {};
    const unlock = this.core.archUnlock(arch);
    const locked = !unlock.ok;
    const maxP = ((c.GPU_TIERS || {})[s.gpuTier || "basic"] || {}).maxParam || 7;
    const archMaxP = this.core.archMaxParam ? this.core.archMaxParam(arch.id) : maxP;
    const params = this.planParamOptions(arch.id);
    const pick = this.planPickParam();
    /* 语料品质配比：滑条状态存 this._planMix（{n,g,p} 格，0~5，合计 ≤ 5） */
    const mx = Object.assign({ n: 5, g: 0, p: 0 }, this._planMix || {});
    this._planMix = mx;
    const sumCells = mx.n + mx.g + mx.p;
    const CQ = c.CORPUS_QUALITY || {};
    const step = CQ.STEP || 0.2;
    const req = this.core.archQualityReq ? this.core.archQualityReq(arch.id, pick) : ((c.ARCH_QUALITY_REQ || {})[arch.id] || 0);
    const bonus = CQ.BONUS != null ? CQ.BONUS : 0.10;
    const penalty = CQ.PENALTY != null ? CQ.PENALTY : 0.15;
    const shareGP = (mx.g + mx.p) * step;
    const mixRow = (key, label, color) => {
      const val = mx[key];
      return `<div class="mix-row">
        <span class="mix-label" style="color:${color}">${label}</span>
        <input class="mix-range" type="range" min="0" max="5" step="1" value="${val}" data-mix="${key}" data-arch="${arch.id || ""}">
        <b class="mix-pct" id="mixPct-${key}">${Math.round(val * step * 100)}%</b>
      </div>`;
    };
    this.bindPlanMixInput();
    return `
      ${this.missionCardHTML(arch.id, pick)}
      <div class="plan-section">
        <div class="plan-section-title">架构选择 <span class="section-badge">${ai + 1} / ${archs.length}</span></div>
        <div class="arch-selector">
          <button class="arrow-btn" data-action="plan-arch" data-id="-1">${this.icon("chevL", 14)}</button>
          <div class="arch-card${locked ? " locked" : ""}" id="archCard">${this.archCardInner(arch)}</div>
          <button class="arrow-btn" data-action="plan-arch" data-id="1">${this.icon("chevR", 14)}</button>
        </div>
      </div>

      <div class="plan-quality-bar">
        <span class="pq-label">语料品质要求</span>
        <div class="mix-req" id="mixReq" data-req="${req}" data-step="${step}" data-bonus="${bonus}" data-penalty="${penalty}">
          ${this.mixReqHTML(req, shareGP, bonus, penalty)}
        </div>
      </div>

      <div class="plan-section">
        <div class="plan-section-title">语料品质配比 <span class="section-badge">20% 一档 · 自由搭配</span></div>
        <div class="mix-board">
          ${mixRow("n", "普通", "#8aa0b2")}
          ${mixRow("g", "良好", "#53b98d")}
          ${mixRow("p", "优质", "#a78bfa")}
          <div class="mix-sum" id="mixSum">合计 <b>${Math.round(sumCells * step * 100)}%</b><span class="mix-unused">（未分配部分按普通语料计）</span></div>
          ${this.mixPremiumHTML(mx)}
        </div>
      </div>

      <div class="plan-section">
        <div class="plan-section-title">模型参数 <span class="section-badge">越大越强</span></div>
        <div class="param-selector">
          ${params.map((p) => {
            const i = params.indexOf(p);
            /* 2026-09-13 用户要求：参数卡只留两行（档位 + B 数），删掉「≥284B 激活工具」
               —— 架构卡上「带出 记忆/推理/工具」已经注明，这里重复只会把字挤小看不清。 */
            return `
              <div class="param-item${pick === p ? " selected" : ""}" data-action="plan-param" data-id="${p}">
                <div class="pi-size">${p}<span class="pi-unit">B</span></div>
                <div class="pi-label">${arch.unlockBy==='embodied'?'具身基座':i === 0 ? "入门" : i === 1 ? "标准" : i === 2 ? "进阶" : "旗舰"}</div>
              </div>`;
          }).join("")}${!params.length?'<div class="plan-lack-tip">当前算力没有可用参数档，请先升级算力。</div>':''}
        </div>
      </div>

      <div class="plan-section" id="planReqSection">${this.planReqHTML(pick)}</div>`;
  },

  /* 立项「算力/语料/周期/预算」四行（2026-09-06 抽出单一来源）：
     首屏 omPlan 与翻页 planCardSwitch 都调它，按当前选中架构 + 参数实时算，
     杜绝「翻页后要求行还停在旧架构、显示达标却按钮置灰」的上下矛盾。 */
  planReqHTML(pick) {
    const c = this.core.cfg, s = this.core.state;
    const archs = c.ARCHITECTURES || [];
    const ai = (((this._planArch || 0) % archs.length) + archs.length) % archs.length;
    const arch = archs[ai] || {};
    const have = this.core.v35On && this.core.v35On() ? Math.floor(s.v35.corpus.token) : Math.floor(s.corpus || 0);
    const gpuOk = (() => {
      if (!arch.gpu) return true;
      return (c.GPU_TIER_ORDER.indexOf(s.gpuTier || "basic")) >= (c.GPU_TIER_ORDER.indexOf(arch.gpu));
    })();
    const curGpuName = ((c.GPU_TIERS || {})[s.gpuTier || "basic"] || {}).name || "—";
    const needGpuName = ((c.GPU_TIERS || {})[arch.gpu] || {}).name || "—";
    const gate = (this.core.archGate && this.core.v35On && this.core.v35On())
      ? this.core.archGate(arch.id, pick) : (arch.gate != null ? arch.gate : null);
    const gateTip = (gate != null && this.core.v35On && this.core.v35On())
      ? `<div class="mini-stat"><span class="ms-label">语料要求</span><div class="ms-bar"><div class="ms-fill" style="width:${Math.min(100, have / Math.max(1, gate) * 100)}%; background:linear-gradient(90deg,#9be0f5,var(--aqua-primary-deep))"></div></div><span class="ms-val ${have >= gate ? "ok" : "lack"}" title="需有效 token ≥ ${gate} 亿（当前 ${have} 亿）">${gate}亿 ${have >= gate ? "✓" : "✗"}</span></div>`
      : "";
    /* 语料不足时的「怎么办」（2026-09-29 玩家反馈「V2 解锁不了」）：
       给出两条可走的路 —— 外包补足（资金换语料）或先立项别的组合推进时间攒语料。
       不写清楚的话，玩家只看到 ✗ 和一个点不动的按钮。 */
    const corpusLackTip = (gate != null && this.core.v35On && this.core.v35On() && have < gate)
      ? `<div class="plan-lack-tip">${this.icon("alert", 13)}<span>语料还差 <b>${Math.ceil(gate - have)} 亿</b>：点底部「外包补足」用经费补齐；也可以先选一个门槛更低的组合立项，推进时间把语料攒够，再重训本阶段（未达成任务目标时结算仍会改发增量经费）。</span></div>`
      : "";
    const gpuReq = arch.gpu
      ? `<div class="mini-stat"><span class="ms-label">算力要求</span><div class="ms-bar"><div class="ms-fill" style="width:${Math.min(100, gpuOk ? 100 : 40)}%; background:${gpuOk ? "linear-gradient(90deg,#7ed4b0,#53b98d)" : "linear-gradient(90deg,#ffcf8a,#f2b84b)"}"></div></div><span class="ms-val ${gpuOk ? "ok" : "lack"}" title="${gpuOk ? "当前算力满足要求" : "当前" + curGpuName + "档，需" + needGpuName + "档"}">${needGpuName} ${gpuOk ? "✓" : "✗"}</span></div>`
      : "";
    const tiers = c.GPU_TIERS || {};
    const key = (c.GPU_TIER_ORDER || Object.keys(tiers)).find((k) => (tiers[k] || {}).maxParam >= pick) || "basic";
    const price = (tiers[key] || {}).price || 0;
  /* [feature:review-week-plan] */
    const weeks = this.core.minWeeks(s.ver);
  /* [/feature:review-week-plan] */
    /* 2026-09-13 用户要求：删掉「能力轴 记忆 推理 工具」那一行胶囊 + 下面那行「由 … 产出」
       —— 架构卡上「带出 记忆/推理/工具」已经注明，这里重复一遍只会把字挤得很小看不清。 */
    return `
      ${gpuReq}
      ${gateTip}
      ${corpusLackTip}
      <div class="mini-stat"><span class="ms-label">预计周期</span><div class="ms-bar"><div class="ms-fill" style="width:${Math.min(100, weeks / 20 * 100)}%"></div></div><span class="ms-val">${weeks}周</span></div>
      <div class="mini-stat"><span class="ms-label">预算需求</span><div class="ms-bar"><div class="ms-fill" style="width:${Math.min(100, price / 50000)}%; background: linear-gradient(90deg, #ffd27a, var(--aqua-gold))"></div></div><span class="ms-val">¥${Math.round(price / 10000)}万</span></div>`;
  },

  /* 品质滑条的联动：拖动任意一条时，其余两条保持，总量上限 5 格（合计 100%）。
     一次性绑定（this.el 常驻），data-mix 命中才处理，不影响其它 input。 */
  bindPlanMixInput() {
    if (this._mixBound) return;
    this._mixBound = true;
    this.el.addEventListener("input", (e) => {
      const t = e.target;
      if (!t || !t.dataset || !t.dataset.mix) return;
      const k = t.dataset.mix;
      const mx = this._planMix || { n: 5, g: 0, p: 0 };
      let v = Math.max(0, Math.min(5, Math.round(+t.value || 0)));
      const others = mx.n + mx.g + mx.p - mx[k];
      if (v + others > 5) v = Math.max(0, 5 - others);       // 总量约束：合计 ≤ 100%
      t.value = v;
      mx[k] = v;
      this._planMix = mx;
      this.updateMixUI();
    });
  },

  /* 滑条变化后局部刷新：百分比 / 合计 / 架构要求状态（不重建面板，拖拽不被打断） */
  /* 优质加成行（2026-09-12 用户定稿）：优质占比每 +20%，产出周期 -N 秒（10s → 9s/档）。
     omPlan 首屏与滑条联动共用，防文案漂移。 */
  mixPremiumHTML(mx) {
    const per = ((this.core.cfg.V35 || {}).PREMIUM_TICK_BONUS != null) ? this.core.cfg.V35.PREMIUM_TICK_BONUS : 1;
    const cells = Math.max(0, Math.min(5, Math.round((mx && mx.p) || 0)));
    const sec = cells * per;
    const base = (this.core.cfg.V35 || {}).TICK_S || 10;
    if (!(sec > 0)) {
      return `<div class="mix-premium" id="mixPremium">⚡ 优质加成：未启用 —— 配比里加入优质数据可缩短产出周期（每 +20% 优质 -${per} 秒）</div>`;
    }
    return `<div class="mix-premium on" id="mixPremium">⚡ 优质加成：产出周期 ${base} 秒 → <b>${Math.max(1, base - sec)} 秒</b>（每 +20% 优质 -${per} 秒）</div>`;
  },

  /* 语料品质要求行（omPlan 首屏与滑条联动共用同一段 HTML，防两处文案漂移）。
     2026-09-12 用户要求缩短：达标与否只用 ✓/✗ 表达（不达标红字），「产出速度 ×N」
     的效果数值收进悬停 title —— 原来的「≥60% —— ✗ 未达标：产出速度 ×0.85」太长，
     窄屏会把立项面板撑变形。 */
  mixReqHTML(req, shareGP, bonus, penalty) {
    if (!(req > 0)) return `<span class="mix-req-na">无要求</span>`;
    const ok = shareGP >= req - 1e-9;
    const need = `良好+优质 ≥ ${Math.round(req * 100)}%`;
    const tip = ok
      ? `配比达标：团队产出速度 ×${(1 + bonus).toFixed(2)}`
      : `未达标：团队产出速度 ×${(1 - penalty).toFixed(2)}，把「良好+优质」配比提到 ${Math.round(req * 100)}% 以上可消除`;
    return `<span class="mix-req-need">${need}</span><span class="${ok ? "mix-req-ok" : "mix-req-lack"} mix-req-mark" title="${tip}">${ok ? "✓" : "✗"}</span>`;
  },
  updateMixUI() {
    const c = this.core.cfg;
    const mx = this._planMix || { n: 5, g: 0, p: 0 };
    const CQ = c.CORPUS_QUALITY || {};
    const step = CQ.STEP || 0.2;
    const bonus = CQ.BONUS != null ? CQ.BONUS : 0.10;
    const penalty = CQ.PENALTY != null ? CQ.PENALTY : 0.15;
    const sumCells = mx.n + mx.g + mx.p;
    for (const k of ["n", "g", "p"]) {
      const el = this.el.querySelector("#mixPct-" + k);
      if (el) el.textContent = Math.round(mx[k] * step * 100) + "%";
    }
    const sumEl = this.el.querySelector("#mixSum");
    if (sumEl) sumEl.innerHTML = `合计 <b>${Math.round(sumCells * step * 100)}%</b><span class="mix-unused">（未分配部分按普通语料计）</span>`;
    const pmEl = this.el.querySelector("#mixPremium");
    if (pmEl) {
      const next = document.createElement("div");
      next.innerHTML = this.mixPremiumHTML(mx);
      const fresh = next.firstElementChild;
      if (fresh) pmEl.replaceWith(fresh);
    }
    const reqEl = this.el.querySelector("#mixReq");
    if (reqEl) {
      const req = parseFloat(reqEl.dataset.req || "0") || 0;
      const shareGP = (mx.g + mx.p) * step;
      reqEl.innerHTML = this.mixReqHTML(req, shareGP, bonus, penalty);
    }
    /* 品质语料库存不足会置灰确认按钮：每次拖滑条即时同步 footer 状态与原因 */
    this.updatePlanFooter();
  },

  /* 立项就绪态：当前选中的架构是否可立项（未解锁 / 算力不足 / 品质语料不足 → 置灰 + 原因） */
  planReady() {
    const c = this.core.cfg, s = this.core.state;
    /* 语料品质配比 → 库存校验（2026-09-03）：所选「良好/优质」格数不得超过库存中该品质的可配格数。
       ⚠️ 2026-09-30 修口径 BUG：与 game_core.js `confirmPlan()` 同口径 —— 按**折算 token**
       （条数 × QUALITY_MULT）比较，不再按原始条数（原口径会低估高品档占比，出现
       「面板显示优质折算占比 60%+，按钮却报优质不足」的自相矛盾）。两处**同口径、同文案**。 */
    if (this.core.v35On && this.core.v35On()) {
      const q = (s.v35 && s.v35.corpus && s.v35.corpus.q) || [];
      const mx = Object.assign({ n: 5, g: 0, p: 0 }, this._planMix || {});
      const MULT = (c.V35 && c.V35.QUALITY_MULT) || [0.5, 1.0, 1.5];
      const raw = (i) => (q[i] || 0) * (MULT[i] != null ? MULT[i] : 0.5);
      const total = raw(0) + raw(1) + raw(2);
      if (total > 0) {
        const maxG = Math.round((raw(1) / total) * 5);
        const maxP = Math.round((raw(2) / total) * 5);
        if (mx.g > maxG) return { ok: false, reason: `良好语料不足（良好折算 ${Math.round(raw(1))} / 共 ${Math.round(total)} 亿 token，最多可配 ${maxG}/5 格）` };
        if (mx.p > maxP) return { ok: false, reason: `优质语料不足（优质折算 ${Math.round(raw(2))} / 共 ${Math.round(total)} 亿 token，最多可配 ${maxP}/5 格）` };
      }
    }
    const archs = c.ARCHITECTURES || [];
    const ai = (((this._planArch || 0) % archs.length) + archs.length) % archs.length;
    const arch = archs[ai] || {};
    if (!this.core.archUnlock(arch).ok) {
      /* 按钮只显示「未解锁」；具体原因（需研读论文 / 版本未到）已在架构卡片的解锁条件行标注 */
      return { ok: false, reason: "未解锁" };
    }
    if(!this.planParamOptions(arch.id).length)return {ok:false,reason:'算力不足（至少 '+(arch.minParam||7)+'B）'};
    if (arch.gpu) {
      const order = c.GPU_TIER_ORDER || Object.keys(c.GPU_TIERS || {});
      const cur = order.indexOf(s.gpuTier || "basic");
      const need = order.indexOf(arch.gpu);
      if (cur >= 0 && need >= 0 && cur < need) return { ok: false, reason: "算力不足" };
    }
    /* 语料门槛（2026-09-29 玩家反馈「V2 解锁不了」）：
       ⚠️ 这里以前**完全不校验语料** —— 按钮是可点的，点下去才由 confirmPlan 回一句 toast
       「语料不足…」，玩家只看到「立项失败」，不知道该去补语料。
       而真实卡点在于：各阶段任务组合的立项门槛都高于「上一阶段正常通关带入的语料」
       （V1.5 300/带入 233、V2 500/469、V2.5 850/744…），未立项又冻结时间、语料涨不上去
       ⇒ 玩家在 V1.5 / V2 反复撞墙。
       这里把缺口直接摆到按钮上，footer 再给一个「外包补足」入口（见 officeModalMeta）。 */
    if (this.core.v35On && this.core.v35On()) {
      const gate = this.core.archGate ? this.core.archGate(arch.id, this.planPickParam()) : null;
      const have = (s.v35 && s.v35.corpus && s.v35.corpus.token) || 0;
      if (gate != null && have < gate) {
        const short = Math.ceil(gate - have);
        return { ok: false, reason: `语料不足（差 ${short} 亿）`, corpusShort: short, corpusGate: gate };
      }
    }
    return { ok: true };
  },

  /* 翻页/选参后同步 footer：未解锁/算力不足/语料不足 → 置灰并写明原因；
     语料不足时同时挂出/撤掉「外包补足」按钮（缺口随所选组合变） */
  updatePlanFooter() {
    const box = this.el.querySelector("#modalContainer");
    if (!box) return;
    const btn = box.querySelector('[data-action="om-plan-confirm"]');
    if (!btn) return;
    const pr = this.planReady();
    btn.disabled = !pr.ok;
    btn.classList.toggle("disabled", !pr.ok);
    btn.textContent = pr.ok ? "确认立项" : pr.reason;
    const foot = btn.parentElement;
    let buy = foot ? foot.querySelector('[data-action="om-plan-buycorpus"]') : null;
    if (pr.corpusShort) {
      if (!buy && foot) {
        buy = document.createElement("button");
        buy.className = "skew-btn gold";
        buy.dataset.action = "om-plan-buycorpus";
        foot.insertBefore(buy, btn);
        /* footer 多一行 → 可用高变小，必须重算自适应缩放，否则正文底部被裁
           （2026-09-29 玩家反馈「立项面板预计周期/预算需求看不见」） */
        this.invalidateFit();
        this.fitModalBody();
      }
      if (buy) buy.textContent = `外包补足（${pr.corpusShort}亿）`;
    } else if (buy) {
      buy.remove();
      this.invalidateFit();
      this.fitModalBody();
    }
  },


  omPlanDone() {
    const c = this.core.cfg, s = this.core.state;
    const arch = (c.ARCHITECTURES || []).find((a) => a.id === s.arch) || {};
    const line = (k, v) => `<div class="om-done-line"><span>${k}</span><b>${v}</b></div>`;
    const mix = (s.v35 && s.v35.qualityMix) || { n: 5, g: 0, p: 0 };
    const step = (c.CORPUS_QUALITY || {}).STEP || 0.2;
    const pct = (v) => Math.round((v || 0) * step * 100);
    const qm = (s.v35 && s.v35.qualityMul) || 1;
    const qTip = qm !== 1 ? `（产出速度 ×${qm.toFixed(2)}）` : "";
    /* doc/23：立项后仍要能回顾本阶段任务目标（只读状态，进结算前一直挂着） */
    const mm = s.mission || {};
    const mDef = this.core.missionOf ? this.core.missionOf(s.ver) : {};
    const mLine = (this.core.cfg.MISSIONS || {}).ENABLED === false || !mDef.name ? ""
      : line("本阶段任务", `${mDef.name}${mm.hit === false ? "（<i class=\"mc-miss\">未按目标走 · 结算改发增量经费</i>）" : "（<i class=\"mc-hit\">符合目标</i>）"}`);
    return `
      <div class="om-done">
        <div class="om-done-title">本项目已立项</div>
        ${line("架构", arch.name || "—")}
        ${line("语料配比", `普通 ${pct(mix.n)}% / 良好 ${pct(mix.g)}% / 优质 ${pct(mix.p)}%${qTip}`)}
        ${line("参数规模", (s.paramTarget || 7) + "B")}
        ${mLine}
        <div class="om-done-tip">下一阶段开始时可以重新立项。现在去「攻关」选一个方向冲产出吧。</div>
      </div>`;
  },

  /* ---------------- 攻关（demo：四象限选方向 + 详情条） ---------------- */
  /* 攻关消耗两行（语料门槛 / 经费）：omFocus 与 omFocusPick 共用同一份文案，
     避免「初始渲染」和「点选后局部更新」两套逻辑漂移。lack = 当前语料不达门槛（红字）。
     （2026-09-03：时长行删掉，改由四象限卡片的 qc-dur 显示「持续 N 周」。） */
  focusCostSpans() {
    const c = this.core.cfg;
    if (!(this.core.v35On && this.core.v35On())) {
      const F = c.FOCUS || {};
      const opt = (F.DIMS || [])[this._focusPick || 0] || {};
      return [
        { text: "⚡ " + (opt.stamina != null ? opt.stamina : 20) + " 体力" },
        { text: "📚 " + (opt.corpus != null ? opt.corpus : 500) + " 语料" },
        { text: "💰 " + fmtMoney(F.COST || 200000) },
      ];
    }
    const v = c.V35, s = this.core.state;
    /* 2026-09-12：门槛动态化 = 当前「架构×参数」组合立项门槛 × FOCUS_GATE_MUL（与 startFocus 同源） */
    const comboGate = this.core.archGate(s.arch, s.paramTarget);
    const gate = comboGate != null
      ? Math.round(comboGate * (v.FOCUS_GATE_MUL != null ? v.FOCUS_GATE_MUL : 1.3))
      : (v.FOCUS_CORPUS_GATE != null ? v.FOCUS_CORPUS_GATE : 0);
    const cur = Math.floor((s.v35 && s.v35.corpus ? s.v35.corpus.token : 0));
    const cost = v.FOCUS_COST != null ? v.FOCUS_COST : ((c.FOCUS || {}).COST || 200000);
    /* 2026-09-03：消耗区只留「语料门槛 + 经费」两行；
       持续时长挪到四象限卡片上显示（qc-dur「持续 N 周」，按配置换算）。 */
    return [
      { text: gate > 0 ? "📚 语料门槛 " + gate + " 亿 token（当前 " + cur + "）" : "📚 无需语料门槛",
        cls: gate > 0 && cur < gate ? "lack" : "" },
      { text: "💰 " + fmtMoney(cost), cls: (s.funding || 0) < cost ? "lack" : "" },
    ];
  },

  /* 攻关可选方向 = 四维（FOCUS.DIMS）+ **本模型激活的追加轴**（doc/27 P3）。
     轴做成独立一组放在四象限下面，不进象限 —— 四象限是四维的固定版式（q1~q4 绝对定位），
     硬塞会破坏 demo 版式；没轴时这一组整体不出现（零痕迹）。 */
  focusList() {
    const c = this.core.cfg;
    let list = (((c.FOCUS || {}).DIMS) || []).slice();
    if(this.core.embodiedAvailable&&this.core.embodiedAvailable())list=[
      {key:'codeText',name:'代码&文字',color:'#2789c4',tag:'语言与代码',icon:(list.find(d=>d.key==='code')||{}).icon||'',desc:'代码和文字两类产出同时获得攻关加成'},
      {key:'safetyStability',name:'安全&稳定',color:'#359e96',tag:'安全与可靠',icon:(list.find(d=>d.key==='safety')||{}).icon||'',desc:'安全和稳定两类产出同时获得攻关加成'},
    ];
    const axIds = this.core.v35AxisIds(this.core.state);
    if (!axIds.length) return list;
    const tick = (c.V35 || {}).TICKS_PER_WEEK || 6;
    const weeks = Math.round((((c.V35 || {}).FOCUS_TICKS || 18) / tick) * 10) / 10;
    for (const id of axIds) {
      const d = this.core.axisDef(id) || {};
      list.push({
        key: id, name: (d.name || id) + "能力", color: "#6d5ce0", tag: "追加轴",
        desc: d.tip || "", axis: true, bonus: "×" + ((c.V35 || {}).FOCUS_MUL || 1.5),
        duration: weeks + "周",
      });
    }
    return list;
  },

  /* [feature:portrait-focus-equal-cards] */
  omFocus() {
    const c = this.core.cfg;
    const all = this.focusList();
    const dims = all.filter((d) => !d.axis);
    const axDims = all.filter((d) => d.axis);
    const idx = this._focusPick || 0;
    const opt = all[idx] || all[0] || {};
    const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">${d.icon || ""}</svg>`;
    /* 2026-09-02 改版：攻关条件 = 语料门槛（一条线，不分方向）+ 一笔经费。
       旧的「文字门槛 / 代码门槛」两个提示胶囊已删除（那是分方向门槛时代的产物）。 */
    const costSpans = this.focusCostSpans()
      .map((t) => `<span class="${t.cls || ""}">${t.text}</span>`).join("");
    /* 2026-09-12（用户要求）：描述写清楚**实际效果**——不再用文案库里牛头不对马嘴的
       静态句（如「算法：提升写作与逻辑理解能力」），改为按当前配置实时生成。 */
    const v35eff = this.core.v35On && this.core.v35On();
    const effWeeks = Math.round((((c.V35 || {}).FOCUS_TICKS || 18) / ((c.V35 || {}).TICKS_PER_WEEK || 6)) * 10) / 10;
    const effMul = Math.round((((c.V35 || {}).FOCUS_MUL || 1.5) - 1) * 100);
    const effDesc = v35eff
      ? `接下来 ${effWeeks} 周内，产出「${opt.name}」相关收益额外 +${effMul}%`
      : (opt.desc || "");
    return `
      <div class="focus-intro">选择一个方向重点攻关，该方向的产出效率将大幅提升。</div>
      <div class="focus-choice-grid">
      ${dims.length===2?'<div class="focus-quadrant embodied-focus-pair">':'<div class="focus-quadrant">'}
        <div class="quadrant-axis quadrant-axis-h"></div>
        <div class="quadrant-axis quadrant-axis-v"></div>
        <div class="quadrant-center-label">能力方向</div>
        ${dims.map((d, i) => {
          const v35on = this.core.v35On && this.core.v35On();
          const bonus = v35on ? "×" + c.V35.FOCUS_MUL : (d.bonus || ("×" + (F.MUL || 1.5)));
          const dur = v35on
            ? "持续 " + (Math.round((c.V35.FOCUS_TICKS / (c.V35.TICKS_PER_WEEK || 6)) * 10) / 10) + " 周"
            : (d.duration || ((F.WEEKS || 4) + "周"));
          return `
          <div class="quadrant-card q${i + 1}${i === idx ? " selected" : ""}" data-action="focus-pick" data-id="${i}">
            <div class="qc-icon" style="color:${d.color || "#9b87f5"}">${svg(d)}</div>
            <div class="qc-name">${d.name}</div>
            <div class="qc-bonus">${bonus}</div>
            <div class="qc-dur">${dur}</div>
          </div>`;
        }).join("")}
      </div>
      ${axDims.length ? `
      <div class="focus-axis-title">追加能力轴（本阶段架构带出的）</div>
      <div class="focus-axis-row">
        ${axDims.map((d, j) => {
          const i = dims.length + j;
          const d0 = this.core.axisDef(d.key) || {};
          return `
          <div class="focus-axis-card${i === idx ? " selected" : ""}" data-action="focus-pick" data-id="${i}">
            <div class="fa-icon">${this.axisIcon(d.key, 18)}</div>
            <div class="fa-name">${d.name}</div>
            <div class="fa-bonus">${d.bonus}</div>
            <div class="fa-dur">持续 ${d.duration.replace("周", "")} 周</div>
          </div>`;
        }).join("")}
      </div>` : ""}
      </div>
      <div class="focus-detail" id="focusDetail">
        <div class="fd-left">
          <div class="fd-tag" style="background:${opt.color || "#9b87f5"}15;color:${opt.color || "#9b87f5"}">${opt.tag || opt.name || ""}</div>
          <div class="fd-desc">${effDesc}</div>
        </div>
        <div class="fd-right">
          <div class="fd-cost-label">消耗</div>
          <div class="fd-cost">${costSpans}</div>
        </div>
      </div>`;
  },

  /* [/feature:portrait-focus-equal-cards] */
  omFocusPick(i) {
    this._focusPick = i;
    const opt = this.focusList()[i] || {};
    /* 四象限卡（四维）与轴卡是两类 DOM，但**顺序一致**（四维在前、轴在后）→ 下标可直接对 */
    this.el.querySelectorAll(".quadrant-card, .focus-axis-card").forEach((el, k) => el.classList.toggle("selected", k === i));
    const box = this.el.querySelector("#focusDetail");
    if (box) {
      const tag = box.querySelector(".fd-tag"), desc = box.querySelector(".fd-desc");
      const spans = box.querySelectorAll(".fd-cost span");
      if (tag) {
        tag.textContent = opt.tag || opt.name || "";
        tag.style.background = (opt.color || "#9b87f5") + "15";
        tag.style.color = opt.color || "#9b87f5";
      }
      if (desc) desc.textContent = opt.desc || "";
      /* 与 omFocus 同一份文案来源（语料门槛 / 经费两行） */
      const costs = this.focusCostSpans();
      costs.forEach((cc, i) => {
        if (!spans[i]) return;
        spans[i].textContent = costs[i].text;
        spans[i].className = costs[i].cls || "";
      });
    }
  },

  /* ---------------- 论文（demo：paper-card 网格 + 倒计时徽标） ---------------- */
  /* [feature:paper-page-capacity-getter] */
  paperPerPage() {
    const w=window.innerWidth,h=window.innerHeight;
    return w<=h&&w<=360 || w>h&&h<=450 ? 1 : 2;
  },
  /* [/feature:paper-page-capacity-getter] */
  omPaper() {
    const c = this.core.cfg;
    const s = this.core.state;
    const pool = (c.PAPER || {}).POOL || [];
    /* 2026-09-06（用户要求）：已掌握的论文保留显示（owned 态 + 「已掌握」徽标），不再从面板隐藏 */
    const ids = [...new Set([...(s.paperCandidates || []), ...(s.papersOwned || [])])];
    const list = ids.map((id) => pool.find((p) => p.no === this.core.paperNoOf(id))).filter(Boolean);
    if (!list.length) return this.omEmpty("paper");
    const researching = s.paperResearch;
    /* v35：研究耗时按 V35 配置换算（玩法配置→ 论文研究 可调），不再写死「1 周」 */
    const v35on = this.core.v35On && this.core.v35On();
    const pw = (c.V35 && c.V35.TICKS_PER_WEEK) || 6;
    const rw = v35on ? Math.max(1, Math.round(((c.V35.PAPER_RESEARCH_TICKS || 6) / pw) * 10) / 10) : 0;
    /* 分页（2026-09-08 用户要求）：每页 2 篇，多的翻页。
       以前是整列滚动/整体缩放 → 论文一多字号被压到看不清。 */
  /* [feature:paper-page-capacity-render] */
    const PER = this.paperPerPage();
    const pages = Math.max(1, Math.ceil(list.length / PER));
    let page = Math.max(0, Math.min(pages - 1, this._paperPage || 0));
    if(this._paperPer!=null && this._paperPer!==PER){
      const selected=list.findIndex(p=>p.no===this.core.paperNoOf(this._paperPick));
      const anchor=selected>=0?selected:Math.min(list.length-1,Math.max(0,this._paperPage||0)*this._paperPer);
      page=Math.floor(anchor/PER);
    }
    this._paperPer=PER;this._paperPage=page;
    const pageList = list.slice(page * PER, page * PER + PER);
  /* [/feature:paper-page-capacity-render] */
    const pager = pages > 1
      ? `<div class="paper-pager">
           <button class="paper-page-btn" data-action="paper-page" data-id="-1" ${page <= 0 ? "disabled" : ""}>${this.icon("chevL", 12)}</button>
           <span class="paper-page-info">${page + 1} / ${pages}</span>
           <button class="paper-page-btn" data-action="paper-page" data-id="1" ${page >= pages - 1 ? "disabled" : ""}>${this.icon("chevR", 12)}</button>
         </div>`
      : "";
    return `
      <div class="paper-list">
        ${pageList.map((p) => {
          const owned = this.core.hasPaper(p.no);   // 旧档里可能是字符串 id → 走引擎统一判定
          const doing = researching && this.core.paperNoOf(researching.id) === p.no;
          const sel = this._paperPick != null && this.core.paperNoOf(this._paperPick) === p.no;
          return `
            <div class="paper-card${owned ? " owned" : ""}${sel ? " selected" : ""}${doing ? " researching" : ""}"
                 data-action="paper-pick" data-id="${p.no}">
              <div class="paper-meta-row">
                <div class="paper-venue">${p.venue} · 引用 ${p.cite}</div>
                <div class="paper-status${owned ? " owned" : ""}">${owned ? "已掌握" : (doing ? "研究中" : "可研究")}</div>
              </div>
              <div class="paper-title">${p.title}</div>
              <div class="paper-authors">${p.authors}</div>
              <div class="paper-tags">${(p.tags || []).map((t) => `<span class="paper-tag">${t}</span>`).join("")}</div>
              <div class="paper-desc">${p.desc || ""}</div>
              <div class="paper-footer">
                <span class="paper-effect">${this.paperEffectText(p)}</span>
                <span class="paper-cost">${v35on ? "📖 研究 " + rw + " 周 · 免费（永续生效）" : `📖 ${p.weeks} 周研究`}</span>
              </div>
              ${doing ? `<div class="paper-countdown"><span>剩 ${this.core.paperWeeksLeft()} 周</span></div>` : ""}
            </div>`;
        }).join("")}
      </div>
      ${pager}`;
  },

  /* 论文效果文案：唯一实现在 game_core.paperEffectText（doc/32 §9）——
     这里只做委托，别再写第二套分支（2026-09-13 之前就是两套，新 kind 漏在 UI 这侧）。 */
  paperEffectText(p) { return this.core.paperEffectText(p); },

  omPaperPick(id) {
    /* ⚠️ dataset 里拿到的是**字符串**，引擎口径是数字 no（doc/32）——
       不规整的话 _paperPick 存 "4006"，而重建时比较的是 === p.no(4006) → 选中态永远丢失。 */
    const no = this.core.paperNoOf(id);
    this._paperPick = no != null ? no : id;
    this.el.querySelectorAll(".paper-card").forEach((el) =>
      el.classList.toggle("selected", +el.dataset.id === this._paperPick));
    const footer = this.el.querySelector('#modalContainer[data-modal-key="paper"] .modal-footer');
    if (footer) footer.innerHTML = this.officeModalMeta("paper").footer;
  },

  /* ---------------- 算力（demo：左档位列表 + 右预览大图） ---------------- */
  omShop() {
    const c = this.core.cfg;
    const s = this.core.state;
    const tiers = Object.keys(c.GPU_TIERS || {});
    const cur = this._shopPick || s.gpuTier || tiers[0];
    /* ★ 打开面板就把选择定住：以前 _shopPick 是 undefined，footer 的「确认购买」
       disabled 条件（_shopPick && ...）永远为假 → 按钮永远点不了（开局买不了算力）。
       且 omShopPick 选档后不重渲染 footer，选了也不解锁 —— 双重死锁。 */
    this._shopPick = cur;
    /* 世代分页（2026-09-09 代际设计）：GPU_TIERS 按 gen 分页，页签切换世代 */
    const genOf = (k) => (c.GPU_TIERS[k] || {}).gen || "A100";
    const genOrder = (c.GPU_GEN_ORDER || ["A100"]).slice();
    tiers.forEach((k) => { if (genOrder.indexOf(genOf(k)) < 0) genOrder.push(genOf(k)); });
    if (genOrder.indexOf(this._shopGen) < 0) this._shopGen = genOf(cur);
    const genTiers = tiers.filter((k) => genOf(k) === this._shopGen);
    const showCur = genTiers.indexOf(cur) >= 0 ? cur : genTiers[0];
    const tabs = genOrder.length > 1
      ? `<div class="shop-gen-tabs">${genOrder.map((g) =>
          `<button class="shop-gen-tab${g === this._shopGen ? " active" : ""}" data-action="shop-gen" data-id="${g}">${g}</button>`
        ).join("")}</div>`
      : "";
    const t = (c.GPU_TIERS || {})[showCur] || {};
    return `
      <div class="shop-body">
        ${tabs}
        <div class="shop-columns">
          <div class="shop-tiers-col">
            ${genTiers.map((k) => {
              const x = c.GPU_TIERS[k];
              /* 算力可叠加（2026-09-06）：ownedGpus = 拥有集合；启用中（最高档）标「使用中」，其余已拥有标「已拥有」 */
              const owned = (s.ownedGpus || []).includes(k);
              return `
                <div class="shop-tier${showCur === k ? " selected" : ""}${owned ? " owned" : ""}" data-action="shop-pick" data-id="${k}">
                  <div class="shop-tier-info">
                    <div class="shop-tier-name">${x.name}档 · ${x.gpu}</div>
                    <div class="shop-tier-spec">参数上限 ${x.maxParam}B</div>
                  </div>
                  <div class="shop-tier-price">${s.gpuTier === k ? "使用中" : owned ? "已拥有" : fmtMoney(x.price)}</div>
                </div>`;
            }).join("")}
          </div>
          <div class="shop-preview-col">
            <div class="shop-preview-icon" id="shopPreviewIcon">
              <img class="shop-gpu-img" src="${t.icon || "resource/ui/a100_single.webp"}" alt="" draggable="false">
            </div>
            <div class="shop-preview-name" id="shopPreviewName">${t.name || ""}</div>
            <div class="shop-preview-spec">${t.gpu || ""}</div>
          </div>
        </div>
      </div>`;
  },

  omShopPick(k) {
    this._shopPick = k;
    const t = (this.core.cfg.GPU_TIERS || {})[k] || {};
    /* 点档位 → 跟随其世代页签（2026-09-09：避免预览/购买与列表错位） */
    if (t.gen) this._shopGen = t.gen;
    this.el.querySelectorAll(".shop-tier").forEach((el) => el.classList.toggle("selected", el.dataset.id === k));
    const icon = this.el.querySelector("#shopPreviewIcon");
    const name = this.el.querySelector("#shopPreviewName");
    if (icon) {
      icon.classList.remove("switching");
      void icon.offsetHeight;
      icon.classList.add("switching");
      setTimeout(() => {
        icon.innerHTML = `<img class="shop-gpu-img" src="${t.icon || "resource/ui/a100_single.webp"}" alt="" draggable="false">`;
      }, 150);
    }
    if (name) name.textContent = t.name || "";
    const spec = this.el.querySelector(".shop-preview-spec");
    if (spec) spec.textContent = (t.gpu || "");
    /* 选档后同步「确认购买」按钮可用态与文案（2026-09-06 修「所有档位都显示已持有」：
       以前只更新 disabled 不更新文案——选任何档，按钮文字仍停留在「已持有该档位」。 */
    const buy = this.el.querySelector('[data-action="om-buygpu"]');
    if (buy) {
      const owned = (this.core.state.ownedGpus || []).includes(k);
      buy.disabled = owned;
      buy.classList.toggle("disabled", owned);
      buy.textContent = owned ? "已拥有该档位，请选择其他档位" : "确认购买";
    }
  },

  /* ---------------- 测试（demo：聊天区 + 候选问题，局部 append 消息） ---------------- */
  omTest() {
    /* 2026-09-19：TEST_QA（候选问题）与老节点树已废弃 —— 测试面板只有对话树这一条路。 */
    return this.omTestTree();
  },
  /* ---------------- P4 对话树：测试聊天按阶段走节点树（doc/26 §5/§9/§11） ----------------
     保留上次进度（关闭面板再打开继续）；渲染历史消息 + 记事本收集册 + 选项；两档随机回复。
     2026-09-10 用户要求：节点文案只在「模型名字下方」显示一次（状态行），
     不再在消息区占位/选项行重复（原同一句会重复三次）。状态行取该阶段 root 的 text。 */
  omTestTree() {
    const core = this.core, s = core.state, c = core.cfg;
    /* 状态行 = 本阶段 root 的状态文案，随节点跳转**不变**（不会变成「……」）。
       2026-09-11（用户反馈「状态描述一直是一个」）：root 支持 `tiers`，
       按**当前测试档位**（咕嘎 / 能说人话，两档制 2026-09-14 砍掉半吊子）取不同文案 —— 与聊天回复同一套档位判定，
       所以状态行会跟着模型的真实水平变。没配 tiers 就回落 `text`（老配置兼容）。 */
    const tier = this.omTestTier();
    /* doc/29：新模型（CHAT_TREE2）的状态行在 `stage.status` 上（两档 dumb/full），
       老模型仍在 root.tiers —— 两条路都取"当前档位那一句"。
       ⚠️ 2026-09-14：`c2Status` 是**随机取一句**，每次渲染都重掷 ⇒ 正文每次都不一样
       ⇒ 「内容没变就不重建」的签名比对永远不成立（表现为每 tick 重建面板、一闪一闪）。
       这里按「阶段 | 档位」把这一句**缓存**下来；打开面板（omTestOpen）会清缓存重新掷。 */
    /* 状态行：CHAT_TREE2 的 status（两档），按「阶段 | 档位」缓存 —— 每次渲染都重掷会导致面板每 tick 重建 */
    const sk = (s.ver || "V1") + "|" + tier;
    if (this._chatStatusKey !== sk) {
      this._chatStatusKey = sk;
      this._chatStatusText = core.c2Status(tier) || "……";
    }
    const rootText = this._chatStatusText || "……";
    /* 选项来源同样分叉：新模型按 start/cond 判可见 */
    const opts = core.c2VisibleOpts();
    const msgs = (this._omTestLog || []).map((m, i) => this.chatLogHTML(m, i)).join("");
    const statusHTML = this._chatPendingStatus
      ? `<div class="test-status-line">${this.escHtml(this._chatPendingStatus)}</div>` : "";
    const artHTML = this._chatPendingArtifact
      ? `<pre class="test-artifact">${this.escHtml(this._chatPendingArtifact)}</pre>` : "";
    return `
      <div class="test-chat-area">
        <div class="test-chat-header">
          <div class="test-chat-avatar"><img src="${(c.UI_PORTS || {}).chat || "resource/character/stand.webp"}" alt="鲸鱼娘"></div>
          <div class="tch-meta">
            <div class="test-chat-title">${this.tpl("{model}")} ${s.ver || "V1"}</div>
            <div class="test-chat-status">${this.tpl(rootText)}</div>
          </div>
        </div>
        <div class="test-messages" id="testMessages">
          ${msgs}
        </div>
        ${statusHTML}
        ${artHTML}
        <div class="test-engineer-note" id="testEngineerNote"${this._omTestNote ? "" : ' style="display:none"'}>
          ${this.icon("chat", 12)}<span id="engineerNoteText">${this._omTestNote || ""}</span>
        </div>
      </div>
      <div class="test-suggest-row">
        <div class="test-suggest-options" id="testOptions">
          ${this.chatOptsHTML(opts)}
        </div>
      </div>`;
  },
  /* 打开测试面板：保留上次进度（关闭面板再打开继续），缺省时兜底初始化 */
  omTestOpen() {
    /* [feature:chat-open-recovery] */
    const ver = this.core.state.ver;
    const healed = this.core.healC2 && this.core.healC2();
    const endedWithoutLog = this.core.c2State && this.core.c2State().ended && !(this._omTestLog || []).length;
    if (healed || endedWithoutLog || (this._omTestVer != null && this._omTestVer !== ver)) this.resetOmTestChat();
    this._omTestVer = ver;
    /* [/feature:chat-open-recovery] */
    /* 2026-09-10 用户要求：保留上次聊天进度 —— 关闭面板再打开继续上次对话，
       不再清空消息 / 当前节点 / 记事本提示。要重开用「回开场」或「清空对话」。 */
    this._omTestLog = this._omTestLog || [];
    if (this._omTestNote == null) this._omTestNote = "";
    if (this._chatPendingStatus == null) this._chatPendingStatus = "";
    if (this._chatPendingArtifact == null) this._chatPendingArtifact = "";
    /* 2026-09-14：状态行的随机取句也在这里作废 —— 每次打开面板重新掷一句（手感保留），
       但同一次会话里保持稳定（见 omTestTree 的 _chatStatusKey 缓存）。 */
    this._chatStatusKey = null;
  },
  /* 选项渲染（2026-09-10 用户：「选项逻辑看不懂」重新梳理）：
     把「对话延续」和「元操作」拆成两行 —— 对话按钮只放真正的接话选项，
     「换个话题 / 结束测试」固定放成独立一行，不再把回开场/结束混进接话里。 */
  /* ==========================================================================
     底栏（doc/26 §1「界面（去掉输入框）」）—— 照设计稿做成微信那种三件套：
       [ 消息 ]   [    点击选择要说的话    ]   [ ＋ ]
     · 中间那块**占满原输入框区域**：点击弹出「当前可选的说话选项」（主线推进）
       —— 只有一个选项时，按钮上直接显示那句选项文本（设计稿明确要求）
     · 中间「要说的话」= 当前可点的分支选项（主线推进）
     · 右「＋」  = 玩家工具：记事本 / 图片 / 语音（V3.5 起开放）
     面板同一时刻只开一个（_chatPanel），点已开的那个收起。
     ⚠️ 2026-09-12 用户要求：**去掉左边的「消息」按钮** —— 原本设计就没有这个
     （辅助消息那套「已解锁话题 / 问过的话 / 再问一次上一题」随之整体删除）。
     ========================================================================== */
  /* [feature:chat-reply-options] */
  chatOptsHTML(opts, anim) {
    if (this.chatReplyBusy()) { this._chatOpts = []; return ""; }
    const list = (opts || []).filter((o) => o.to !== null && o.to !== "root");
    this._chatOpts = list;
    const one = list.length === 1 ? String(list[0].text || "") : "";
    /* 2026-09-13 用户要求（原「只有一个选项时直接显示那句选项文本」作废）：
       底部这颗按钮**永远只显示两种固定文案** —— 有得选 = 「点击选择消息」，
       没得选（节点走完 / 只有回开场） = 「这个话题聊完了」。
       好处：按钮宽度稳定（不会再被长短选项撑得一跳一跳），玩家一眼知道现在该干什么。 */
    const label = list.length ? "点击选择消息" : "这个话题聊完了";
    void one;   // 保留变量：老逻辑的痕迹，避免误删时看不出改过什么
    const panel = this._chatPanel;
    const toolsOK = this.chatToolsOpen();
    let sheet = "";
    if (panel === "opt" && list.length) sheet = this.chatSheetOpts(list);
    else if (panel === "tool") sheet = this.chatSheetTool();
    /* `anim` = 这次重画确实换了「面板状态」（开 / 关 / 一级↔二级）→ 才放展开动画；
       否则（例如切"语音字幕"开关）重放一次展开会显得莫名其妙。 */
    /* 2026-09-22 用户要求：**右侧「＋」工具按钮先隐藏** —— 记事本 / 图片 / 语音这套玩家工具
       玩法还没想好怎么做，先把入口藏起来。面板（chatSheetTool）与打开逻辑都保留着，
       想恢复把下面这行改回 true 即可（不用改别处）。 */
    const SHOW_CHAT_TOOL_BTN = false;
    if (sheet && anim) sheet = sheet.replace('class="chat-sheet"', 'class="chat-sheet cs-open"');
    return `
      <div class="chat-bar">
        <button class="cb-main${list.length ? "" : " cb-off"}" data-action="chat-panel" data-panel="opt"${list.length ? "" : " disabled"}>
          ${this.escHtml(label)}</button>
        ${SHOW_CHAT_TOOL_BTN ? `<button class="cb-side cb-plus${toolsOK ? "" : " cb-off"}${panel === "tool" ? " on" : ""}" data-action="chat-panel" data-panel="tool"
          title="${toolsOK ? "玩家工具（记事本 / 图片 / 语音）" : "V3.5 起开放"}">${this.icon("plus", 18)}</button>` : ""}
      </div>
      ${sheet}`;
  },
  /* [/feature:chat-reply-options] */
  /* 面板①：要说的话（当前可点的分支选项）
     ⚠️ 2026-09-19：选项按钮文本**必须走 chatVar** —— 以前只 escHtml，
     写 `{model}` 的选项在按钮上原样显示占位符，点下去气泡里却替换了（同一句话前后两个样）。 */
  chatSheetOpts(list) {
    return `<div class="chat-sheet">
      <div class="cs-head">选择要说的话</div>
      ${list.map((o) => {
        const key = o._id != null ? o._id : o._i;
        return `<button class="cs-item" data-action="om-test-opt" data-opt="${key}">
          <span>${this.escHtml(this.core.chatVar(String(o.text == null ? "" : o.text)))}</span>${this.icon("chevR", 13)}</button>`;
      }).join("")}
    </div>`;
  },
  /* 面板②：玩家工具 —— **记事本 / 图片 / 语音 三个按钮**（V3.5 起）
     ⚠️ 2026-09-12 用户第三次强调（原话：「玩家工具显示的按钮分别是记事本 图片 语音，
        点了记事本的按钮再弹出记事本的内容，和微信一样」）：
        **一级面板只放按钮**，点了哪个才进哪个的二级内容。
        上一次我把它改成"把记事本内容直接平铺在面板里"是**改错了方向**，已回退。
     原「辅助消息」面板（已解锁话题 / 问过的话 / 再问一次上一题）已按用户要求整体删除
     —— 底栏左边的「消息」按钮本来就不在设计里。 */
  chatSheetTool() {
    const T = (this.core.cfg.PLAYER_TOOLS) || {};
    const sub = this._chatSub;
    /* 二级：记事本内容 */
    if (sub === "note") return this.chatSheetNotes();
    /* 二级：图片 / 语音素材列表 */
    if (sub === "img" || sub === "voice") {
      const pool = (sub === "img" ? T.IMAGE_POOL : T.VOICE_POOL) || [];
      return `<div class="chat-sheet">
        <div class="cs-head">${sub === "img" ? "发一张图片" : "发一条语音"}
          <button class="cs-back" data-action="chat-sub" data-sub="">返回</button></div>
        ${pool.length ? pool.map((it, i) => `<button class="cs-item" data-action="chat-send-media" data-kind="${sub}" data-i="${i}">
            <span>${this.escHtml(it.name || it.src || "")}</span></button>`).join("")
          : `<div class="cs-note">还没配素材（缺少图片 / 语音）。</div>`}
      </div>`;
    }
    /* 一级：三个工具按钮 */
    const tools = [
      ["note", "note", "记事本", this.notebookList().length],
      ["img", "image", "图片", (T.IMAGE_POOL || []).length],
      ["voice", "audio", "语音", (T.VOICE_POOL || []).length],
    ];
    /* 2026-09-12（用户要求）：按钮压缩成小卡（不再铺满整行，后面可能还有新工具）；
       不显示"空"——没素材就只显示名字，别提醒玩家这里什么都没有 */
    return `<div class="chat-sheet">
      <div class="cs-head">玩家工具</div>
      <div class="cs-tools">${tools.map(([k, ic, name, n]) =>
        `<button class="cs-tool" data-action="chat-sub" data-sub="${k}">
          <i>${this.icon(ic, 16)}</i><span>${name}</span>${n ? `<em>${n} 项</em>` : ""}</button>`).join("")}</div>
    </div>`;
  },
  /* 已解锁记事本 → [{id, name, text}]
     ⚠️ 2026-09-12 用户拍板：游戏还没上线、没有老存档 → **把「别名 alias / 老 NOTEBOOK 表」
     那套兼容层整个删掉**。`s.notebook` 只存 ID（["1001"]），内容只从 `CHAT_TREE2.NOTES` 取。 */
  notebookList() {
    const T2 = ((this.core.cfg.CHAT_TREE2 || {}).NOTES) || {};
    const seen = [];
    (this.core.state.notebook || []).forEach((x) => {
      const id = String(x);
      if (!T2[id] || seen.indexOf(id) >= 0) return;      // 不在配置里的（老档脏数据）直接忽略
      seen.push(id);
    });
    return seen.map((id) => ({ id: id, name: T2[id].name || id, text: T2[id].text || "" }));
  },
/* [feature:chat-audio-caption-note] */
  /* 语音字幕开关已从面板移除；有正文的语音自动显示对应文字。
     chatSubOn() 保留为旧调用兼容入口。 */
  /* 记事本二级面板：已解锁的记录 + 返回键 */
/* [/feature:chat-audio-caption-note] */
  chatSheetNotes() {
    const list = this.notebookList();
    return `<div class="chat-sheet">
      <div class="cs-head">记事本（${list.length} 条）
        <button class="cs-back" data-action="chat-sub" data-sub="">返回</button></div>
      ${list.length ? list.map((n) => `<div class="cs-note-item"><b>${this.escHtml(this.core.chatVar(n.name))}</b>
          <span>${this.escHtml(this.core.chatVar(n.text))}</span></div>`).join("")
        : `<div class="cs-note">还没记下什么。先去跟她聊点有的没的。</div>`}
    </div>`;
  },
  /* 工具面板解锁：V3.5 起（doc/26 §2 表），可在 PLAYER_TOOLS.UNLOCK_VER 改 */
  chatToolsOpen() {
    const T = (this.core.cfg.PLAYER_TOOLS) || {};
    const need = T.UNLOCK_VER || "V3.5";
    const order = this.core.cfg.VER_ORDER || [];
    return order.indexOf(this.core.state.ver || "V1") >= order.indexOf(need);
  },
  /* 发图片 / 发语音：我发出去 → 状态流 → 她按池子里配的回应 */
  async chatSendMedia(kind, i) {
    const T = (this.core.cfg.PLAYER_TOOLS) || {};
    const it = ((kind === "img" ? T.IMAGE_POOL : T.VOICE_POOL) || [])[+i];
    if (!it || !it.src) return;
    const box = this.el.querySelector("#testMessages");
    if (!box) return;
    this._chatPanel = null; this._chatSub = null;
    const me = document.createElement("div");
    me.className = "msg-user msg-media";
    me.innerHTML = this.chatMediaHTML({ type: kind === "img" ? "image" : "audio", src: it.src });
    box.appendChild(me);
    if (kind === "voice" || kind === "img") this.primeVoiceSec(me.querySelector(".chat-voice"));
    this._omTestLog = this._omTestLog || [];
    this._omTestLog.push({ me: true, media: { type: kind === "img" ? "image" : "audio", src: it.src, text: "" } });
    box.scrollTop = box.scrollHeight;
    this.refreshChatBar();
    this.el.querySelectorAll(".cb-main, .cb-side").forEach((b) => { b.disabled = true; });
    const typing = document.createElement("div");
    typing.className = "msg-bot typing";
    typing.innerHTML = "<span>·</span><span>·</span><span>·</span>";
    box.appendChild(typing);
    box.scrollTop = box.scrollHeight;
    await new Promise((r) => setTimeout(r, 900));
    typing.remove();
    /* 过程可见（doc/26 §3）：按 BY_TOOL 刷出居中灰字状态流 */
    const tool = kind === "img" ? "vision" : "asr";
    if (this.core.callLogSteps) await this.chatSysSteps(this.core.callLogSteps(tool), box);
    const reply = it.reply || (kind === "img" ? "（她看了看这张图）……我看到了。" : "（她听了一下）……我听到了。");
    this._omTestLog.push({ me: false, text: reply });
    box.appendChild(this.msgEl("bot", reply));
    box.scrollTop = box.scrollHeight;
    this.refreshChatBar();
  },
  /* 只重画底栏（不动消息区）—— 面板开关、发完媒体后都要刷 */
  refreshChatBar() {
    const opts = this.core.c2VisibleOpts();
    this.renderChatBar(opts);
  },
  /* ==========================================================================
     底栏重画 + 面板开合动画（2026-09-12 用户：「点击加号以后要有展开的动画，现在直接切很生硬」）
     --------------------------------------------------------------------------
     三种情形分开处理（面板状态没变就只重画，不放动画）：
       · 打开    → 由 CSS 的 `.cs-open`（高度/内边距/淡入/上滑）负责，DOM 一插进去自己就跑
       · 一级↔二级 → 同上（换了一块新的 sheet，重新展开一次，视觉上是"翻页"）
       · 收起    → CSS 动画帮不上（节点已经被 innerHTML 摘掉）→ 把**刚摘下来的那个节点**
                   按原高度放回流里当"残影"，height/padding/margin/border 一起缩到 0 再移除。
                   它在流内，高度一缩，整条底栏自然跟着收回去，不会"啪"地跳一下。
     ========================================================================== */
  /* [feature:chat-reply-bar] */
  renderChatBar(opts) {
    const wrap = this.el.querySelector("#testOptions");
    if (!wrap) return;
    const key = (this._chatPanel || "") + "/" + (this._chatSub || "");
    const anim = key !== this._barKey;
    this._barKey = key;
    const oldSheet = wrap.querySelector(".chat-sheet");     // innerHTML 只是把它摘下来，引用还在
    wrap.innerHTML = this.chatOptsHTML(opts, anim);
    const sheet = wrap.querySelector(".chat-sheet");
    if (!sheet && oldSheet && anim && !this.chatReplyBusy()) {
      const ghost = oldSheet;
      ghost.classList.remove("cs-open");
      ghost.classList.add("cs-leaving");
      wrap.appendChild(ghost);
      const ease = "cubic-bezier(.22,.61,.36,1)";
      ghost.style.transition = "height .18s " + ease + ", padding .18s " + ease
        + ", margin .18s " + ease + ", border-width .18s " + ease + ", opacity .14s ease";
      requestAnimationFrame(() => {
        ghost.style.height = "0px";
        ghost.style.paddingTop = "0px";
        ghost.style.paddingBottom = "0px";
        ghost.style.marginBottom = "0px";
        ghost.style.borderWidth = "0px";
        ghost.style.opacity = "0";
      });
      setTimeout(() => ghost.remove(), 260);
    }
    this.el.querySelectorAll(".test-suggest-btn, .cb-main, .cb-side").forEach((b) => { b.disabled = this.chatReplyBusy() || b.classList.contains("cb-off"); });
  },
  /* [/feature:chat-reply-bar] */
  /* 点选项：玩家气泡 → 解锁记事本 → 锁按钮 + typing → 推进节点(两档回复/status/artifact) → 换选项
     ⚠️ data-opt 传的是 node.opts 的原始下标（chatOptsHTML 用 o._i），
        不能拿它去索引 chatVisibleOpts 的过滤结果 —— 有隐藏项时会串位（点 A 实际发 B）。 */
  /* 收尾：写状态条/artifact/备注 + 刷新选项行 */
  finishOmTestOpt() {
    const box = this.el.querySelector("#testMessages");
    if (!box) return;
    const core = this.core;
    const statusHTML = this._chatPendingStatus
      ? `<div class="test-status-line">${this.escHtml(this._chatPendingStatus)}</div>` : "";
    const artHTML = this._chatPendingArtifact
      ? `<pre class="test-artifact">${this.escHtml(this._chatPendingArtifact)}</pre>` : "";
    box.insertAdjacentHTML("beforeend", statusHTML + artHTML);
    box.scrollTop = box.scrollHeight;
    this.ensureTestChatVisible();
    const note = this.el.querySelector("#testEngineerNote");
    const noteText = this.el.querySelector("#engineerNoteText");
    if (this._omTestNote && note && noteText) { noteText.textContent = this._omTestNote; note.style.display = ""; }
    /* 2026-09-11 修 BUG（浏览器实测抓到的）：**记事本行不会跟着解锁刷新** ——
       omTestTree 只在打开面板时渲染一次，解锁后 chip 要等重开面板才出现，
       玩家会以为"没记上"。这里给它一个固定插槽，每次收尾都重刷。
       （老模型走 opt.unlockNote、新模型走回答的 noteFor，两条路共用这一处。） */
    /* 顶部那行记事本已删（用户要求）—— 记事本统一收在「＋」面板里；
       走统一的 renderChatBar，顺手把"选完自动收起面板"也做成收起动画 */
    this.refreshChatBar();
    this.el.querySelectorAll(".test-suggest-btn").forEach((b) => { b.disabled = false; });
  },
  /* ==========================================================================
     新模型（CHAT_TREE2）点选项：玩家气泡 → 打字 → 按档位挑回答 → 换选项
     --------------------------------------------------------------------------
     与老 omTestOpt 的区别只有两处：① 传进来的是**选项 ID**；② 回答由 c2Choose 统一挑
     （命中条件优先 → fallback 随机取一 → 该档没配内容回落咕嘎池/截断），
     其余（气泡、typing、状态行、artifact、记事本提示、act:"game"）完全沿用老口径。
     ========================================================================== */
  /* [feature:chat-reply-turn] */
  chatReplyAlive(turn) {
    const state = this.core && this.core.state;
    return !!(turn && this._chatReplyTurn === turn && this.core === turn.core &&
      state === turn.state && state.ver === turn.ver && state.phase === turn.phase &&
      this._omTestLog === turn.log && (!turn.accepted || (state.c2 === turn.c2 && String(state.c2.lastOpt) === turn.optId)));
  },
  chatReplyBusy() { return this.chatReplyAlive(this._chatReplyTurn); },
  releaseChatReply(turn) {
    if (this._chatReplyTurn !== turn) return;
    this._chatReplyTurn = null;
    if (this.el && this.el.querySelector('#testOptions')) this.refreshChatBar();
  },
  failChatReply(turn) {
    if (this._chatReplyTurn !== turn) return;
    this.releaseChatReply(turn);
    this.toast('回复显示暂时中断，可以继续聊天或换个话题');
  },
  /* [/feature:chat-reply-turn] */
  /* [feature:chat-reply-submit] */
  omTestOptC2(optId) {
    const core = this.core, s = core.state;
    let box = this.el.querySelector("#testMessages");
    if (!box || this.chatReplyBusy()) return false;
    this._omTestLog = this._omTestLog || [];
    const turn = { core, state:s, ver:s.ver, phase:s.phase, log:this._omTestLog, optId:String(optId), started:false };
    this._chatReplyTurn = turn; // Acquire before invoking any selection callbacks.
    const alive = () => this.chatReplyAlive(turn);
    try {
    const visible = core.c2VisibleOpts();
    if (!visible.some(o => String(o._id) === String(optId))) { this.releaseChatReply(turn); return false; }
    const r = core.c2Choose(String(optId), this.omTestTier());
    if (!r) { this.releaseChatReply(turn); return false; }
    turn.accepted = true; turn.c2 = s.c2;
    this._chatPanel = null; this._chatSub = null;
    this.refreshChatBar(); // Remove the actual current options immediately.
    s.testBadgeVer = s.ver || "V1";
    const meText = core.chatVar(r.opt.text || "");
    this._omTestLog = this._omTestLog || [];
    this._lastOptId = String(optId);
    this._omTestLog.push({ me: true, text: meText, optId: String(optId) });
    box.appendChild(this.msgEl("user", meText));
    box.scrollTop = box.scrollHeight;
    const a = r.reply;
    /* 记事本解锁提示（挂在**回答**上的 noteFor）—— 显示名只从 `CHAT_TREE2.NOTES` 取。
       then 链上每条都能挂 → 提示取**展平后最后一条**带 noteFor 的。 */
    const noteA = a ? core.c2FlattenThen(a).filter((x) => x && x.noteFor).pop() : null;
    if (noteA && core.c2Notes()[String(noteA.noteFor)]) {   // 2026-10-01：悬空 noteFor（NOTES 已无此 id）不提示
      const rec = core.c2Notes()[String(noteA.noteFor)] || {};
      if (window.SFX && SFX.play) SFX.play("ui");
      this._omTestNote = "记本子上了：" + core.chatVar(String(rec.name || noteA.noteFor));
    }
    this.ensureTestChatVisible();
    this.el.querySelectorAll(".test-suggest-btn").forEach((b) => { b.disabled = true; });
    const typing = document.createElement("div");
    typing.className = "msg-bot typing";
    typing.innerHTML = "<span>·</span><span>·</span><span>·</span>";
    box.appendChild(typing);
    box.scrollTop = box.scrollHeight;
    setTimeout(async () => {
      if (!alive() || turn.started) return;
      turn.started = true;
      try {
      box = this.el.querySelector("#testMessages") || box;
      typing.remove();
      this._chatPendingStatus = "";
      this._chatPendingArtifact = "";
      if (!a) { this.releaseChatReply(turn); this.finishOmTestOpt(); return; }
      /* 回答连回答（`then` 链 · 2026-09-21）：主回答播完，依次连播它的整棵 then 子树（各自成泡）。
         **支持任意层** —— 展平交给 core.c2FlattenThen（与引擎 lastAns 落点同一个助手，口径不会分叉）。
         典型配置：先一条独立思维链（type:"think"），再一条正文。链尾 id 是 lastAns 落点。 */
      const chain = core.c2FlattenThen(a);
      const pushBot = (txt) => {
        if (!txt || !alive()) return;
        box = this.el.querySelector("#testMessages") || box;
        this._omTestLog.push({ me: false, text: txt });
        box.appendChild(this.msgEl("bot", txt));
        box.scrollTop = box.scrollHeight;
      };
      for (const a of chain) {
        if (!alive()) return;
        box = this.el.querySelector("#testMessages") || box;
        this._chatPendingStatus = "";
        this._chatPendingArtifact = a.artifact || "";
        /* 过程：`think` 既是**独立类型**，也是**任何答案上的叠加字段**（a.think）——
           2026-09-16 用户要求「每个选项都要有思维链展示」⇒ link / image 这类答案也得挂得上思考框
           （link 分支会提前 return，所以只有把它做成叠加字段才可能有一致的过程展示）。 */
        const th = (a.type === "think") ? a : (a.think || null);
        if (a.type !== "cot" && !th && String(a.status || "").trim()) {
          await this.chatSysSteps(String(a.status).split("→"), box, turn);
          if (!alive()) return;
        }
        /* ① 文本（COT·简略型）：先"COT 前" → 居中灰字逐条播标识 → 再"COT 后" */
        if (a.type === "cot") {
          pushBot(core.chatVar(a.pre || ""));
          await this.chatCotPlay(a.steps, box, turn);
          if (!alive()) return;
          /* ⚠️ 2026-09-22 修（用户报「出现了重复的气泡」）：这里以前回落 `a.text` ——
             cot 的语义是「过程前(pre) → 标识(steps) → 过程后(post)」，**text 不参与**；
             而数据里的 text 常是「先配成 text 类型、后改成 cot」的残留
             （实例：#20551 的 text 与 pre 一字不差）⇒ 回落等于把同一句话播了两遍。
             现在只认 post（编辑器对 cot 也只给 pre / steps / post 三个输入框）。 */
          pushBot(core.chatVar(a.post || ""));
          continue;
        }
        /* ①' 思考框（think）：灰色面板逐行推进 → 再出正文（doc/34 §3.1）。
           · `type:"think"`  ⇒ 面板就是这条回答本体，播完接着出 post 正文
           · `a.think`（叠加）⇒ 播完**不 return**，继续走下面的 image / link / text 分支 */
        if (th) {
          pushBot(core.chatVar(a.pre || ""));
          await this.chatThinkPlay(th, box, turn);
          if (!alive()) return;
          if (a.type === "think") {
            pushBot(core.chatVar(a.post || a.text || ""));
            continue;
          }
        }
        /* ② 图片 / 视频 / 音频：气泡里放缩略图或语音条（点击放大 / 播放） */
        if (a.type === "image" || a.type === "video" || a.type === "audio") {
          const el = document.createElement("div");
          el.className = "msg-bot msg-media";
          el.innerHTML = this.chatMediaHTML(a);
          box.appendChild(el);
          if (a.type === "audio") this.primeVoiceSec(el.querySelector(".chat-voice"));
          this._omTestLog.push({ me: false, media: a });   // 存 media 对象，重建时才不会是文本占位
          box.scrollTop = box.scrollHeight;
          continue;
        }
        /* ③ 链接（2026-09-13 用户要求）：气泡里给一张可点开的链接卡，
           点它 **新建标签页** 打开你配的真实网址（<a target="_blank" rel="noopener noreferrer">）。 */
        if (a.type === "link") {
          const html = this.chatLinkHTML(a);
          this.renderGameMsg(html);
          this._omTestLog.push({ me: false, html });
          continue;
        }
        /* ④ 文本（含 act:"game" 网关 —— 老数据 1 处：V4.5「帮我做个游戏」）
           ⚠️ 2026-09-19：这里以前用 `a.text` **原文**（不走 chatVar）⇒ 写 {model} 会亮给玩家。
              统一先过 chatVar；{link} 不是占位符、不受影响（下面照旧检测）。 */
        let text = this.core.chatVar(a.text || "");
        if ((r.opt.act === "game" || a.act === "game") && text.indexOf("{link}") >= 0) {
          const g = this.omTestGame();
          if (g) {
            text = this.renderGameReply(text, g);
            this.renderGameMsg(text);
            this._omTestLog.push({ me: false, html: text });
            continue;
          }
        }
        pushBot(core.chatVar(text));
      }
      if (!alive()) return;
      this.releaseChatReply(turn);
      this.finishOmTestOpt();
      } catch (error) { if (alive()) this.failChatReply(turn); }
      finally { this.releaseChatReply(turn); }
    }, 900);
    return true;
    } catch (error) { this.failChatReply(turn); return false; }
  },
  /* [/feature:chat-reply-submit] */
  /* ==========================================================================
     聊天气泡里的三种非文本回答（doc/29 §5）
     --------------------------------------------------------------------------
     · image  缩略图 → 点击**放大**（全屏遮罩，点任意处关）
     · video  首帧缩略图 + 播放钮 → 点击**放大后播放**
     · audio  **微信同款语音条**：三段弧形图标 + 秒数，点击播放/暂停，播放中弧线跳动
     · cot    文本（COT）：先说她"COT 前"那句 → 气泡下方**小字逐条**播我配的标识
              （思考中/搜索中…，按配置顺序）→ 再补一句"COT 后"
     ========================================================================== */
  /* [feature:chat-media-path-helper-20261013] */
  chatResourceSrc(src) {
    const paths = window.ResourcePaths;
    return typeof src === "string" && paths && typeof paths.canonical === "function" ? paths.canonical(src) : src;
  },
  /* [/feature:chat-media-path-helper-20261013] */
  chatMediaHTML(a) {
  /* [feature:chat-media-path-render-20261013] */
    const src = this.escHtml(this.chatResourceSrc(a.src || ""));
  /* [/feature:chat-media-path-render-20261013] */
    if (!a.src) return `<span class="chat-media-missing">（没配文件：${this.escHtml(a.type)}）</span>`;
    if (a.type === "image") {
      /* 2026-09-16：图片下方的**一句台词**（`text`）—— 以前 image 只渲染 <img>，
         于是「（自拍）它把我画得太瘦了」这类配文全被吞掉、笑点丢一半。
         玩家自己发的图 text 为空 ⇒ 不出现这行。 */
      const cap = a.text ? `<i class="chat-media-cap">${this.escHtml(this.core.chatVar(a.text))}</i>` : "";
      return `<span class="chat-media-fig">`
        + `<img class="chat-media-img" src="${src}" alt="她发的图" `
        + `data-action="chat-zoom" data-kind="image" data-src="${src}">`
        + cap + `</span>`;
    }
    if (a.type === "video") {
      return `<span class="chat-media-video" data-action="chat-zoom" data-kind="video" data-src="${src}">`
        + `<video src="${src}" preload="metadata" muted playsinline></video>`
        + `<i class="chat-media-play">${this.icon("play", 18) || "▶"}</i></span>`;
    }
    if (a.type === "audio") {
      /* 微信语音条：左边三弧信号图标（自绘 SVG，不用 emoji），右边秒数 */
      const wave = `<svg class="cv-wave" width="16" height="16" viewBox="0 0 24 24" fill="none"`
        + ` stroke="currentColor" stroke-width="2.2" stroke-linecap="round">`
        + `<path d="M4 9v6"/><path d="M9 5.5v13"/><path d="M14 8v8"/><path d="M19 10.5v3"/></svg>`;
/* [feature:chat-audio-caption-visible] */
      /* 字幕：有正文的语音自动显示，台词仍挂在 data-cap 上供面板重建使用。
         玩家的语音没有 text，所以永远不出字幕 —— 只有她发的才带。
         ⚠️ 2026-09-22：这里以前**没走 chatVar** ⇒ 语音字幕里写 {model} 会原样亮给玩家
         （图片台词一直是走 chatVar 的，编辑器对 audio 的「正文」也提示了可用占位符 ⇒ 两处不一致）。 */
      const cap = a.text ? this.escHtml(this.core.chatVar(a.text)) : "";
      return `<span class="chat-voice" data-action="chat-voice" data-src="${src}" data-cap="${cap}">`
        /* [feature:chat-voice-replay-caption] */
        + wave + `<b class="cv-sec">…</b><button type="button" class="chat-voice-replay" data-action="chat-voice-replay" aria-label="从头重播这条语音">↻ 重播</button></span>`
        /* [/feature:chat-voice-replay-caption] */
        + (this.chatSubOn() && cap ? `<i class="chat-voice-cap">${cap}</i>` : "");
    }
    return "";
  },
  /* 字幕控件已退役：旧关闭偏好与缓存不能压制当前配置的语音正文。 */
  chatSubOn() {
    this._chatSubtitle = true;
    return true;
  },
  /* 旧调用兼容：恢复自动显示，并就地补上已渲染语音的文字。 */
  chatSubtitle(on) {
    this._chatSubtitle = this.chatSubOn();
    try { localStorage.setItem("xj_chat_sub", "1"); } catch (e) { /* 忽略 */ }
    this.el.querySelectorAll(".chat-voice").forEach((v) => {
      const p = v.parentNode;
      if (!p) return;
      const old = p.querySelector(".chat-voice-cap");
      const txt = v.dataset.cap || "";
      if (this._chatSubtitle && txt) {
        if (old) { old.textContent = txt; return; }
        const i = document.createElement("i");
        i.className = "chat-voice-cap";
        i.textContent = txt;
        v.insertAdjacentElement("afterend", i);
      } else if (old) old.remove();
    });
    this.refreshChatBar();
  },
/* [/feature:chat-audio-caption-visible] */
  /* 语音条：**渲染出来就把时长填上**（微信也是这样，不用等播放）；
     用一次性 Audio 读 metadata，不占播放器。 */
  primeVoiceSec(el) {
  /* [feature:chat-media-path-metadata-20261013] */
    if (!el || !el.dataset.src) return;
    el.dataset.src = this.chatResourceSrc(el.dataset.src);
  /* [/feature:chat-media-path-metadata-20261013] */
    const sec = el.querySelector(".cv-sec");
    /* ⚠️ 无头环境（jsdom）没有 Audio 构造器 → 直接兜底成文字，别让整个渲染抛异常
       （与「jsdom 里 canvas.getContext 返回 null」同款处理：入口先判空/判类型）。 */
    if (typeof Audio !== "function") {
      if (sec && sec.textContent === "…") sec.textContent = "语音";
      return;
    }
    const a = new Audio();
    a.preload = "metadata";
    const fill = () => { if (sec && isFinite(a.duration)) sec.textContent = Math.round(a.duration) + "″"; };
    a.onloadedmetadata = fill;
    a.src = el.dataset.src;
    /* ⚠️ 竞态：先设 src 再挂回调的话，命中缓存时 loadedmetadata 已经错过了 ——
       所以回调要先挂，再补一次 readyState 判断（两个方向都兜住）。 */
    if (a.readyState >= 1) fill();
    /* 2026-09-13：读不到 metadata（文件缺失 / 格式不支持）时别让秒数**永远停在「…」**——
       1.5s 还没拿到就用文字兜底，玩家至少知道这是一条语音。 */
    setTimeout(() => {
      if (sec && sec.textContent === "…") sec.textContent = "语音";
    }, 1500);
  },
  /* [feature:chat-voice-replay-controls] */
  /* 语音条：点击波形播放/暂停；明确的重播按钮总是从头播放。 */
  pauseChatVoice() {
    this._voiceRequest = (this._voiceRequest || 0) + 1;
    if (this._voiceAudio) this._voiceAudio.pause();
    if (this._voiceEl) this._voiceEl.classList.remove("playing");
  },
  chatVoice(el, replay = false) {
    if (!el) return;
  /* [feature:chat-media-path-playback-20261013] */
    const src = this.chatResourceSrc(el.dataset.src);
    if (src) el.dataset.src = src;
  /* [/feature:chat-media-path-playback-20261013] */
    if (!src) return;
    if (typeof Audio !== "function") return;     // 无头环境没有 Audio → 静默跳过（见 primeVoiceSec）
    if (!this._voiceAudio) this._voiceAudio = new Audio();
    const a = this._voiceAudio;
    if (!replay && this._voiceEl === el && !a.paused) { this.pauseChatVoice(); return; }
    if (window.CityJourney && CityJourney.pauseVoice) CityJourney.pauseVoice();
    const request = this._voiceRequest = (this._voiceRequest || 0) + 1;
    if (this._voiceEl && !a.paused) a.pause();
    if (this._voiceEl) this._voiceEl.classList.remove("playing");
  /* [/feature:chat-voice-replay-controls] */
    const sec = el.querySelector(".cv-sec");
    const fill = () => { if (sec && isFinite(a.duration)) sec.textContent = Math.round(a.duration) + "″"; };
    a.onloadedmetadata = fill;                 // 先挂回调
    /* [feature:chat-voice-replay-source] */
    a.onended = () => { if (request === this._voiceRequest) el.classList.remove("playing"); };
    if (this._chatVoiceSrc !== src) { a.src = src; this._chatVoiceSrc = src; }
    /* [/feature:chat-voice-replay-source] */
    a.currentTime = 0;
    if (a.readyState >= 1) fill();
    this._voiceEl = el;
    el.classList.add("playing");
    /* [feature:chat-voice-play-error] */
    /* [feature:chat-voice-replay-request-error] */
    const play = a.play();
    if (play && play.catch) play.catch((e) => { if (request !== this._voiceRequest) return; el.classList.remove("playing"); this.toast("这条语音放不出来：" + e.message); });
    /* [/feature:chat-voice-replay-request-error] */
    /* [/feature:chat-voice-play-error] */
  },
  /* 图片/视频点开放大（全屏遮罩，点任意处关闭） */
  chatZoom(kind, src) {
    const old = this.el.querySelector("#chatZoomMask");
    if (old) old.remove();
    const mask = document.createElement("div");
    mask.id = "chatZoomMask";
    mask.className = "chat-zoom-mask";
    mask.dataset.action = "chat-zoom-close";
    mask.innerHTML = kind === "video"
      ? `<video src="${this.escHtml(src)}" controls autoplay playsinline></video>`
      : `<img src="${this.escHtml(src)}" alt="放大查看">`;
    this.el.appendChild(mask);
    if (window.SFX && SFX.play) SFX.play("ui");
  },
  /* 过程可见（doc/26 §3）—— **居中、小字、灰色**的状态条，插在消息流里；
     结果气泡出现后**不删除**（保留"她刚才做了什么"的痕迹）。
     设计稿规定：一次最多 3 条，每条 STEP_MS（默认 700ms）→ 总时长 ≤ 2.1s，不拖沓。
     ⚠️ 不是挂在气泡下的小标签 —— 那是"系统状态条"的位置（居中独立一行）。 */
  /* [feature:chat-reply-status] */
  async chatSysSteps(steps, box, turn) {
    if (this.core.callLogOn && !this.core.callLogOn()) return;
    if (!box) box = this.el.querySelector("#testMessages");
    const list = (steps || []).map((x) => String(x == null ? "" : x).trim()).filter(Boolean).slice(0, 3);
    const ms = this.core.callLogStepMs ? this.core.callLogStepMs() : 700;
    for (const txt of list) {
      if (turn && !this.chatReplyAlive(turn)) return;
      /* ⚠️ 2026-09-13 修 BUG（用户实测「测试聊天界面的 COT 文本还是会因为刷 tick 而消失」）：
         两个成因，一次修掉 ——
         ① 这些步骤原先只 append 进 DOM、**没进 `_omTestLog`**，而办公室 tick 的静默刷新是
            「重建正文 → 从日志重放消息区」→ 重放时根本没有它们，凭空消失；
         ② 每步之间有 STEP_MS 的 await，若重建恰好发生在等待中，手里的 `box` 已脱离文档，
            后续步骤会 append 到一块「墓碑」上 —— 同样是看不见。
         所以：每拍重新确认容器在文档里；同时把这一步写进日志。 */
      if (!box || !box.isConnected) box = this.el.querySelector("#testMessages") || box;
      if (!box) return;
      /* ⚠️ 2026-09-19：替换**只做一次**，DOM 与日志存同一份（日志重放路径 chatLogHTML 会 escHtml，
         不再替一遍 —— 替两遍会把玩家名字里的 `{model}` 也再替一次，属于自找的二次替换） */
      const txtShown = this.core.chatVar(txt);
      const row = document.createElement("div");
      row.className = "chat-sys";
      row.textContent = "· " + txtShown;
      box.appendChild(row);
      box.scrollTop = box.scrollHeight;
      this._omTestLog = this._omTestLog || [];
      this._omTestLog.push({ me: false, sys: txtShown });
      await new Promise((r) => setTimeout(r, ms));
    }
  },
  /* [/feature:chat-reply-status] */
  /* ── cot（简略型）：**居中小字**逐条播标识 —— 就是状态流本身，用于"她正在做什么"的碎念。
     与下面的 think（可展开思考框）是**两个类型**：
       · cot   = 简略、不可折叠、居中灰字、跟着气泡走（状态式）
       · think = 可折叠的灰底面板、挂在某条回答上（内心 OS）        */
  /* [feature:chat-reply-cot] */
  async chatCotPlay(steps, box, turn) { await this.chatSysSteps(steps, box, turn); },

  /* [/feature:chat-reply-cot] */
  /* ==========================================================================
     think（可展开型思考框）—— 依据 doc/33 §3.15.3-4 那条设计语言：
       「**灰色是过程，黑色是结果，过程可看可不看**」
     --------------------------------------------------------------------------
     · 折叠头 = chevR 图标 + title（默认"思考过程"），点一下展开/收起
     · steps 里以 `♪` 开头 = **哼唱行**（斜体浅色）—— 见 doc/33 §3.15.2 的劳动号子
     · `data-idx` 指回 `_omTestLog` 的下标：折叠状态**写回内存对象** ⇒ tick 静默重建后不丢
       （与 chatMediaHTML / chatLinkHTML 同一个坑：只存渲染好的 HTML = 重建即失忆）
     ========================================================================== */
  chatThinkHTML(a, open, idx) {
    const src = a || {};
    const steps = (src.steps || src.lines || []);
    const body = steps.map((t) => {
      const s = String(t == null ? "" : t);
      const song = s.charAt(0) === "♪";                       // ⚠️ 判「哼唱行」用**原文**（占位符替换前）
      return `<div class="chat-think-line${song ? " song" : ""}">${this.escHtml(this.core.chatVar(s))}</div>`;
    }).join("");
    return `<div class="chat-think${open === false ? " collapsed" : ""}"`
      + ` data-action="chat-think-toggle" data-idx="${idx == null ? "" : idx}">`
      + `<div class="chat-think-head"><i>${this.icon("chevR", 12)}</i>`
      + `<span>${this.escHtml(this.core.chatVar(String(src.title == null ? "" : src.title) || "思考过程"))}</span></div>`
      + `<div class="chat-think-body">${body}</div></div>`;
  },
  /* 逐行淡入 → **播完自动收起**（用户 2026-09-16 原话：「思维链播放速度太慢太慢了，刷快点，
     3 秒刷完，然后自动收回去」）。
     ⚠️ 这里**不能**沿用 `callLogStepMs()`（= CALL_LOG.STEP_MS = 1700ms）：那是给 ≤3 条工具状态
        流定的节奏，思考框动辄 6~12 行 ⇒ 12 × 1.7s = **20.4 秒**，就是"太慢太慢了"的成因。
        现在按**总时长预算**均分（`CALL_LOG.THINK_TOTAL_MS`，默认 3000ms），单行再夹到 80~420ms。
     ⚠️ 每一拍都要确认容器还在文档里：tick 的静默重建会让手里的 box 变成"墓碑"（见 memory §静默失效） */
  /* [feature:chat-reply-think] */
  async chatThinkPlay(a, box, turn) {
    if (turn && !this.chatReplyAlive(turn)) return;
    this._omTestLog = this._omTestLog || [];
    const entry = { me: false, think: a, open: true };
    this._omTestLog.push(entry);
    const idx = this._omTestLog.length - 1;
    const host = document.createElement("div");
    host.className = "msg-bot msg-think";
    host.innerHTML = this.chatThinkHTML(a, true, idx);
    box.appendChild(host);
    box.scrollTop = box.scrollHeight;
    const budget = Number((this.core.callLogCfg && this.core.callLogCfg().THINK_TOTAL_MS) || 0) || 3000;
    const lines = Array.prototype.slice.call(host.querySelectorAll(".chat-think-line"));
    const ms = Math.max(80, Math.min(420, Math.round(budget / Math.max(1, lines.length))));
    lines.forEach((el) => el.classList.add("hide"));       // 先全部藏起来
    for (const el of lines) {
      if (turn && !this.chatReplyAlive(turn)) return;
      el.classList.remove("hide");                          // 再逐行放出来
      box.scrollTop = box.scrollHeight;
      await new Promise((r) => setTimeout(r, ms));
      if (turn && !this.chatReplyAlive(turn)) return;
      if (!box.isConnected) box = this.el.querySelector("#testMessages") || box;
    }
    /* 播完停一拍（让人看清最后一行）→ **自动收起**。
       收起状态写回**日志条目**（`entry.open`），所以 tick 静默重建后仍然是收起的；
       DOM 侧按 `data-idx` 现查现改 —— 重建过的话手里那个 host 已是墓碑。 */
    await new Promise((r) => setTimeout(r, 220));
    if (turn && !this.chatReplyAlive(turn)) return;
    entry.open = false;
    const live = this.el.querySelector('.chat-think[data-idx="' + idx + '"]');
    if (live) live.classList.add("collapsed");
  },
  /* [/feature:chat-reply-think] */
  msgEl(kind, text) {
    const div = document.createElement("div");
    div.className = kind === "user" ? "msg-user" : "msg-bot";
    div.style.whiteSpace = "pre-wrap";
    div.textContent = text == null ? "" : String(text);
    return div;
  },
  /* 聊天记录的一条 → HTML。
     ⚠️ 2026-09-13 修 BUG（用户实测「跳 tick 时语音条变成文本 [audio]resource/…wav」）：
     媒体条目（图片 / 语音）只存一句文字占位是不够的 —— 办公室 tick 的**静默刷新会重建面板正文**，
     然后从 `_omTestLog` 重放整个消息区；那时只能渲染出那句占位文字，语音条就"变成文本"了。
     所以媒体条目必须把 `media` 对象一起存下来，重放时用 chatMediaHTML 重建真正的气泡。 */
  chatLogHTML(m, i) {
    /* 过程标识（COT / 状态流）也走日志重放 —— 见 chatSysSteps 的注释（2026-09-13 抗重建） */
    if (m.sys != null) return `<div class="chat-sys">· ${this.escHtml(m.sys)}</div>`;
    /* think（可展开思考框）同样只存**对象**不存 HTML：折叠态由 m.open 还原（2026-09-16） */
    if (m.think) return `<div class="msg-bot msg-think">${this.chatThinkHTML(m.think, m.open !== false, i)}</div>`;
    const cls = m.me ? "msg-user" : "msg-bot";
    if (m.media) return `<div class="${cls} msg-media">${this.chatMediaHTML(m.media)}</div>`;
    return `<div class="${cls}">${m.html != null ? m.html : this.escHtml(m.text)}</div>`;
  },
  /* 重建出来的语音条时长同样是「…」→ 补一次（只补还没填上的，避免重复建 Audio） */
  primeVoicesIn(scope) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll(".chat-voice").forEach((v) => {
      const sec = v.querySelector(".cv-sec");
      if (sec && sec.textContent === "…") this.primeVoiceSec(v);
    });
  },

  /* 链接回答（2026-09-13 用户要求）：气泡里一张可点的链接卡，**新建标签页**打开。
     · url       必填，真实网址（编辑器里配）
     · linkText  可选，卡片主标题（默认「点开看看」）
     · text      可选，卡片上方的一句说明（支持 {model} 等占位符）
     ⚠️ 没配 url 时给一句提示，而不是渲染一个点了没反应的空链接 ——
        「配置漏填」不许表现成「按了没反应」（这是这个项目最容易踩的静默失效）。
     ⚠️ 只放 <a> 这一处 HTML：其他文本一律 escHtml 转义，url 也转义。 */
  chatLinkHTML(a) {
    const src = a || {};
    const url = String(src.url || "").trim();
    if (!url) return `<span class="chat-media-missing">（这条回答还没配链接）</span>`;
    const label = String(src.linkText || "").trim() || "点开看看";
    let host = "";
    try { host = new URL(url).hostname; } catch (e) { host = url.replace(/^https?:\/\//, "").split("/")[0]; }
    const head = src.text ? this.escHtml(this.core.chatVar(String(src.text))) + "\n" : "";
    return head
      + `<a class="chat-link-card" href="${this.escHtml(url)}" target="_blank" rel="noopener noreferrer"`
      + ` title="${this.escHtml(url)}（新标签页打开）">`
      + `<i class="chat-link-ic">${this.icon("external-link", 15)}</i>`
      + `<b class="chat-link-body"><span class="chat-link-title">${this.escHtml(label)}</span>`
      + `<span class="chat-link-host">${this.escHtml(host)}</span></b></a>`;
  },

  /* V4.5 做游戏：把回复里的 {link} 换成一个可点开的 <a class="test-game-link">（TEST_GAME.url）*/
  renderGameReply(tpl, g) {
    const url = (g && g.url) || "", linkText = (g && g.linkText) || "点击打开我做的游戏";
    const [before, after = ""] = String(tpl || "").split("{link}");
    return this.escHtml(before)
      + (url
          ? `<a href="${this.escHtml(url)}" target="_blank" rel="noopener noreferrer" class="test-game-link">${this.escHtml(linkText)}</a>`
          : this.escHtml(url))
      + this.escHtml(after);
  },
  renderGameMsg(html) {
    const box = this.el && this.el.querySelector("#testMessages");
    if (!box) return;
    const div = document.createElement("div");
    div.className = "msg-bot";
    div.style.whiteSpace = "pre-wrap";
    div.innerHTML = html;
    box.appendChild(div);
  },
  /* 清空测试聊天的会话进度（回开场 / 新开一局用；保留面板打开状态） */
  /* [feature:chat-reply-reset] */
  resetOmTestChat() {
    this._chatReplyTurn = null;
    this._omTestLog = [];
    this._omTestNote = "";
    this._chatPendingStatus = "";
    this._chatPendingArtifact = "";
    this.core.state.chatNode = null;          // 老模型
    if (this.core.c2Reset) this.core.c2Reset();  // doc/29 新模型：lastOpt/lastAns/ended 一起清
  },
  /* [/feature:chat-reply-reset] */
  /* 回开场（清空消息 + 回 root）*/
  omTestRestart() {
    this.resetOmTestChat();
    this.core.state.officeModal = "test";
    this.refreshOfficeBody();
  },
  /* 结束测试：清空会话并关闭对话面板（2026-09-10 与「换个话题」拆开的独立操作） */
  omTestEnd() {
    this.resetOmTestChat();
    this.core.state.officeModal = null;
    if (window.SFX) SFX.play("click");
    this.render({ soft: true });
  },

  /* 测试演出状态（两档制 2026-09-14 砍掉「半吊子」档：<60% 咕嘎 / ≥60% 完整）
     2026-09-06 修「界面提前一周会说人话」：输出档位不再纯看数值——
     NODE_WEEK（默认 5，= 第二次测试节点周 / 周节拍提醒同周）之前一律咕嘎，
     界面状态与节点提醒严格同周切换。 */
  omTestStatus(s) {
    const tier = this.omTestTier();
    return { dumb: "胡言乱语中", full: "能说人话了" }[tier];
  },
  omTestTier() {
    const s = this.core.state;
    if (this.core.v35On && this.core.v35On()) {
      const nodeW = ((this.core.cfg.V35 || {}).TEST || {}).NODE_WEEK;
      if (nodeW != null && (s.week || 0) < nodeW) return "dumb";   // 未到测试节点周：一律咕嘎
      return window.V35.testTier({ ver:s.ver, stats:s }).tier;
    }
    return (s.text || 0) >= 18 ? "full" : "dumb";
  },

  /* 小窗口下测试面板整体会滚动（见 style.css .test-modal-body），发问后把面板滚回顶部，
     保证聊天记录在视野内（否则玩家只看得到下方选项）。2026-09-08 */
  ensureTestChatVisible() {
    const body = this.el && this.el.querySelector(".test-modal-body");
    if (body) body.scrollTop = 0;
  },

  /* 发问：局部 append 气泡（不重建面板，聊天记录不丢） */
  /* ---- 测试聊天彩蛋：V4.5 让模型做个游戏，返回可点开的网站链接（2026-09-10）---- */
  omTestGame() { return this.core.cfg.TEST_GAME || { enabled: false, ver: "V4.5", q: "帮我做个游戏", ok: "", bad: "", url: "", linkText: "" }; },
  omTestGameEnabled() {
    const g = this.omTestGame();
    if (!g.enabled) return false;
    const order = this.core.cfg.VER_ORDER || [];
    const cur = order.indexOf(this.core.state.ver || "V1");
    const at = order.indexOf(g.ver || "V4.5");
    if (at < 0) return true;                    // 阶段键不在 VER_ORDER → 视为一直显示
    return cur >= at;
  },
  /* 点了「帮我做个游戏」：开智（full）才真正把游戏做出来——回复里带可点击链接；否则照常咕嘎 */
  omTestGameSend() {
    const g = this.omTestGame();
    const box = this.el.querySelector("#testMessages");
    if (!box || !g) return;
    this.core.state.testBadgeVer = this.core.state.ver || "V1";
    this._omTestLog = this._omTestLog || [];
    const tip = box.querySelector(".test-empty-tip");
    if (tip) tip.remove();
    const tier = this.omTestTier();
    const meText = g.q || "帮我做个游戏";
    this._omTestLog.push({ me: true, text: meText });
    const userMsg = document.createElement("div");
    userMsg.className = "msg-user";
    userMsg.textContent = meText;
    box.appendChild(userMsg);
    box.scrollTop = box.scrollHeight;
    this.ensureTestChatVisible();
    this.el.querySelectorAll(".test-suggest-btn").forEach((b) => { b.disabled = true; });
    const typing = document.createElement("div");
    typing.className = "msg-bot typing";
    typing.innerHTML = "<span>·</span><span>·</span><span>·</span>";
    box.appendChild(typing);
    box.scrollTop = box.scrollHeight;
    setTimeout(() => {
      typing.remove();
      const botMsg = document.createElement("div");
      botMsg.className = "msg-bot";
      botMsg.style.whiteSpace = "pre-wrap";
      if (tier === "full") {
        /* 开智：替换 {link} 为可点击链接（其余文本转义，只放链接这一处 HTML） */
        const ok = g.ok || "";
        const [before, after = ""] = ok.split("{link}");
        const url = g.url || "", linkText = g.linkText || "点击打开我做的游戏";
        const html = this.escHtml(before)
          + (url
              ? `<a href="${this.escHtml(url)}" target="_blank" rel="noopener noreferrer" class="test-game-link">${this.escHtml(linkText)}</a>`
              : this.escHtml(url))
          + this.escHtml(after);
        this._omTestLog.push({ me: false, html });
        botMsg.innerHTML = html;
      } else {
        const bad = g.bad || "咕嘎……%%￥#@&*";
        this._omTestLog.push({ me: false, text: bad });
        botMsg.textContent = bad;
      }
      box.appendChild(botMsg);
      box.scrollTop = box.scrollHeight;
      this.ensureTestChatVisible();
      const note = this.el.querySelector("#testEngineerNote");
      const noteText = this.el.querySelector("#engineerNoteText");
      this._omTestNote = tier === "full" ? "它真把游戏做出来了，还发了个链接。" : "它只是在胡言乱语——还不会做游戏。";
      if (note && noteText) { noteText.textContent = this._omTestNote; note.style.display = ""; }
      this.el.querySelectorAll(".test-suggest-btn").forEach((b) => { b.disabled = false; });
    }, 900);
  },

  /* ---------------- 评审（demo：review-certificate 证书风） ---------------- */
  omReview() {
    const s = this.core.state;
    const c = this.core.cfg;
    const cap = this.core.statCap();
    const pass = this.core.passLine();
    const r = this.core.evaluate();
    const can = this.core.canReview();
    const v35on = this.core.v35On && this.core.v35On();
    /* ⚠️ 2026-09-17 修 BUG（与作弊器「跳到评审后按钮置灰」同一类）：
       以前用全局 `V35.WEEKS`（=6）当分母，但各阶段最短可评审周数在
       `MIN_WEEKS_BY_VER`（V4.5 要 10 周）——于是 V4.5 的提示写着
       「第 6 周结束后可发起评审」，而按钮要等到第 10 周才亮，直接误导玩家。
       唯一真源 = core.minWeeks(ver)。 */
  /* [feature:review-week-period] */
    const totalW = this.core.minWeeks(s.ver);
  /* [/feature:review-week-period] */
    const COLORS = {
      code: "linear-gradient(90deg,#6fc3ff,#2789c4)", text: "linear-gradient(90deg,#7ed4f0,#3dbbd8)",
      safety: "linear-gradient(90deg,#ffcf8a,#f2b84b)", stability: "linear-gradient(90deg,#7ed4b0,#53b98d)",
    };
    const axIds = this.core.v35AxisIds(s);
    /* 目标值：四维取达标线；追加轴取 AXIS_MIN（没配就取轴自己的 passByVer） */
    const need = (k) => this.modelPass(k);
    const row = (k) => {
      const v = Math.round(this.modelValue(k, s));
      const c = this.modelCap(k) || 1;
      const pct = Math.max(0, Math.min(100, (v / c) * 100));
      const nd = Math.ceil(need(k));
      const ok = this.modelValue(k, s) >= need(k) && need(k) > 0;
      const isAx = axIds.indexOf(k) >= 0;
      const fill = isAx ? this.dimFill(k) : COLORS[k] || "linear-gradient(90deg,#6fc3ff,#2789c4)";
      return `
        <div class="review-stat${isAx ? " review-stat-axis" : ""}">
          <span class="rs-label">${this.modelLabel(k)}${v35on && isAx ? "能力" : ""}</span>
          <div class="rs-bar"><div class="rs-fill" style="width:${pct.toFixed(0)}%;background:${fill}"></div></div>
          <span class="rs-val${ok ? " ok" : ""}">${v}/${nd}</span>
        </div>`;
    };
    /* 权重明细（doc/27 P3）：只列「本模型存在的维度」，让玩家看见轴在总分里占多少。
       轴改胶囊（2026-09-11）：正文容器 overflow:hidden，原来 3 条全宽轴行让整页
       溢出 ~90px 被裁掉（实测 scrollH 609 / 可视 519）。 */
    const wTbl = ((c.V35 || {}).REVIEW || {}).WEIGHTS_BY_VER || {};
    const wRow = wTbl[s.ver || "V1"] || ((c.V35 || {}).REVIEW || {}).WEIGHTS || {};
    const wDims = this.modelDims(s).map(d=>({...d, weight:d.sources.reduce((n,k)=>n+(wRow[k]||0),0)})).filter(d=>d.weight>0);
    const wSum = wDims.reduce((n,d)=>n+d.weight,0) || 1;
    const wText = wDims.map(d=>d.label + " " + Math.round(d.weight/wSum*100) + "%").join(" · ");
    return `
      <div class="review-certificate">
        <div class="review-header">
          <div class="review-header-icon">${this.icon("shield", 20)}</div>
          <div class="review-header-text">
            <div class="review-header-title">项目评审报告</div>
            <div class="review-header-sub">REVIEW REPORT · ${s.ver || "V1"}</div>
          </div>
        </div>
        <div class="review-desc">
          ${v35on
            ? (can ? "训练周期已完成，<strong>由你决定何时发起评审</strong>。点「开始评审」进入" + (this.core.embodiedAvailable && this.core.embodiedAvailable() ? "具身实地测评" : "答题测评") + "，之后出具结算。" : `训练周期进行中（第 ${Math.min(s.week || 0, totalW)} / ${totalW} 周）——第 ${totalW} 周结束后可发起评审。`)
            : "指标达标后即可随时发起评审，评审通过进入下一阶段。"}
        </div>
        <div class="review-stats">
          ${this.modelDims(s).filter(d=>d.sources.every(k=>this.core.baseDims().includes(k))).map(d=>row(d.key)).join("")}
        </div>
        ${axIds.length ? `
        <div class="review-axis-sep">追加能力 · 只有特定「架构 × 参数」才有的轴</div>
        <div class="axis-pills" style="margin-top:8px">
          ${axIds.map((k) => {
            const d = this.core.axisDef(k, s.ver) || {};
            const v = Math.round(s[k] || 0);
            const nd = Math.ceil(need(k));
            const ok = need(k) > 0 && (s[k] || 0) >= need(k);
            const pct = Math.max(0, Math.min(100, (v / (cap[k] || 1)) * 100));
            return `<span class="axis-pill${ok ? " ok" : ""}" title="${d.tip || ""}">
              <span class="ap-ic">${this.axisIcon(k, 13)}</span>
              <span class="ap-name">${this.modelLabel(k)}</span>
              <span class="ap-num">${v}${nd ? `<i>/${nd}</i>` : ""}</span>
              <span class="ap-bar"><i style="width:${pct.toFixed(0)}%;background:${this.dimFill(k)}"></i></span>
            </span>`;
          }).join("")}
        </div>` : ""}
        ${wText ? `<div class="review-weights">加权：${wText}<span class="rw-note">（漏练的维度按 0 计入总分）</span></div>` : ""}
        ${r.qualificationFailed ? '<div class="review-failure-reasons">'+this.escHtml(this.core.reviewFailurePolicy().UI.PREVIEW.replace('{reasons}',r.failureItems.join('、')))+'</div>' : ''}
        <div class="review-countdown">
          <div class="rc-label">预估总评</div>
          <div class="rc-value">${Math.round(r.score || 0)}</div>
        </div>
        ${r.qualificationFailed ? `<div class="review-breakdown">${this.escHtml(this.core.reviewFailurePolicy().UI.SCORE)}</div>` : r.rawScore != null ? `<div class="review-breakdown">维度加权 ${Math.round(r.rawScore)} + 品质加成 ${r.qBonus >= 0 ? "+" : "−"}${Math.round(Math.abs(r.qBonus))}（优秀线 ${Math.ceil(r.excellentLine)}${r.topLine != null ? " · 顶尖线 " + Math.ceil(r.topLine) : ""}）</div>` : ""}
      </div>`;
  },

  /* ---------------- 玩法说明（顶栏「玩法说明」按钮）----------------
     分页展示：顶部一排胶囊 tab，正文只显示当前页，超长不再靠滚动条（用户 2026-09-02）。 */
  /* [feature:review-week-guide] */
  /* [feature:gameplay-guide-dynamic-pages] */
  /* [feature:portrait-guide-line-pagination] */
  omGuide() {
    const core = this.core, c = core.cfg, s = core.state, v = c.V35 || {};
    const pass = core.passLine();
    const money = value => { const n = Number(value); return Number.isFinite(n) ? (n % 10000 === 0 ? n / 10000 + " 万元" : n.toLocaleString("zh-CN") + " 元") : "未配置"; };
    const esc = value => this.escHtml(String(value == null ? "" : value));
    const order = c.VER_ORDER || ["V1"], vi = Math.max(0, order.indexOf(s.ver));
    const main = (c.PASS_PRIZE_BY_VER || {})[s.ver] ?? 300000 * (vi + 1);
    const tick = v.TICK_S || 10, tpw = v.TICKS_PER_WEEK || 6, TB = c.TEAM_BUILD || {};
    const axes = v.AXES || {}, defs = axes.DEF || {};
    const archName = id => { const a = (c.ARCHITECTURES || []).find(x => x.id === id); return esc(a ? a.name : id); };
    // Display a copied page: opening help must never edit authored TUTORIAL or state.
    const base = (c.TUTORIAL || []).map(t => {
      if (t.id !== "t_axis" || axes.ENABLED === false) return t;
      const rules = Object.entries(defs).filter(([, d]) => d && d.source).map(([key, d]) => {
        const a = d.source;
        return `<b>${esc(d.name || core.statLabel(key))}</b>：${(a.archs || []).map(archName).join(" / ") || "没有可用架构"}；参数 ≥ ${esc(a.paramMin || 0)}B${a.minVer ? "；阶段 ≥ " + esc(a.minVer) : "；架构须先解锁"}。`;
      });
      return { ...t, lines: (t.lines || []).concat(rules) };
    });
    const extra = [
      { id: "t_funds_live", title: "经费与重训", lines: [
        "<b>进入新阶段不再额外发放启动拨款</b>。经费来自评审结算、事件与其他明确标注的收入；工资、算力、语料、招聘和素体都需要预算。",
        `当前 <b>${esc(s.ver)}</b> 完成版本任务后的主评审奖为 <b>${money(main)}</b>；优秀追加 <b>${money(c.EXCELLENT_FUNDING || 0)}</b>，顶尖在优秀基础上再追加 <b>${money(c.TOP_FUNDING || 0)}</b>。实际收入与扣款看结算明细。`,
        `本阶段第 <b>${core.minWeeks(s.ver)} 周结束</b>后可发起评审。优秀要达到总评线并满足防偏科，顶尖还需达到优秀线的 <b>${esc(c.TOP_RATIO ?? 1.12)} 倍</b>；高评级不等于版本任务完成。`,
        "任务未达会留在本阶段；这类重训的主评审经费只按<b>超过本版本已结算最高分的增量</b>计算，同分或更低没有增量。不为已经结算过的同一结果重复入账。",
        "已完成任务的正常通过，包括末阶段再战，会重新按通过奖金结算；小模型等单列收入另算。<b>任务未达的同分重训没有主奖增量</b>，不等于所有单列收入都为零。",
        "重训和进入新阶段会重新立项、从零训练当前模型，团队和已购资源会保留；<b>发薪倒计时和候选冷却持续计时</b>，不会因为重训而重新给一个月工资缓冲。品牌星级会为本次主评审经费提供溢价，具体看结算明细。",
        "接受带分红条件的投资后，后续<b>每笔经营收益</b>按约定比例扣款并消耗笔数；注资、破产兜底款不参与，结算看实际净额。",
      ] },
      { id: "t_clock_live", title: "时钟与团队", lines: [
        `标准速度的<b>基础节拍约 ${tick} 秒 / tick</b>，<b>${tpw} tick = 1 周</b>。实际耗时还受节拍波动、语料不足延时与优质语料缩时影响，并非严格 ${tick * tpw} 秒一周。V3 起可切换 <b>1× / 2×</b>经营速度；小游戏与鲸bee保持原速。`,
        "<b>手动暂停</b>会停住经营计时；普通经营菜单不保证停止经营，阅读和安排前可先按暂停。有暂停锁的剧情或特定面板关闭后恢复原状态；必须选择的教学完成后才会放行。旅行等待使用真实时间，见下一页。",
        "工资每 <b>4 周</b>支付一次，金额按实际在职成员月薪合计；跨阶段与重训保留发薪倒计时。扩编时也要为后续工资留余量，座位满了须先腾出位置。",
        `V1 先录用首位工程师即可继续教学。数据工程师在 <b>${v.JOIN_DATA ?? 6} tick</b>后、后训练工程师在 <b>${v.JOIN_POST ?? 18} tick</b>后自动加入；要有空座，未到岗不产出。体力不足和安排休息会影响生产，安排休息后到下一周上班才恢复。`,
        `团队页可谈心、聚餐、休息、培训和涨薪，各项费用、次数与效果以操作卡为准。培训每人每个绝对周一次，每次 <b>${money(TB.TRAIN_COST ?? 30000)}</b>、体力消耗 <b>${esc(TB.TRAIN_ENERGY_COST ?? 10)}</b>；涨薪会改变后续月薪。`,
      ] },
      { id: "t_body_journey_live", title: "具身、旅行与回忆", lines: [
        "<b>具身阶段</b>除已有能力外，还要训练物理认知与灵巧操控，并招聘具身智能工程师。当前能力、参数、架构和任务条件以立项/评审面板为准。",
        "「素体」每阶段展示对应型号、必需台数与价格。先满足本阶段采购要求才能立项；<b>同阶段升级只补已投资后的差价</b>，已购或更低规格不能重复购买，新阶段采购按该阶段独立计算。",
        `觉醒不是只看总分：需两根具身能力轴分别达到本阶段觉醒门槛，并至少完成 <b>${Math.max(1, Math.min(52, Math.round(Number.isFinite(Number((c.EMBODIED || {}).AWAKEN_MIN_TRAINING_WEEKS ?? 2)) ? Number((c.EMBODIED || {}).AWAKEN_MIN_TRAINING_WEEKS ?? 2) : 2)))} 周</b>训练；觉醒与出舱流程完成后开放身体互动与旅行。`,
        "鲸鱼房可投喂与换装。投喂有<b>每周次数与阶段好感收益上限</b>，体力恢复、上限提升和费用看零食卡；换装按好感及解锁条件开放。托管的免费恢复和付费操作各有条件，不等于所有照料免费。",
        `「旅行鲸鱼」按配置站点顺序推进，每站还需满足阶段门槛。默认等待 <b>${esc((c.CITY_JOURNEY || {}).WAIT_MINUTES ?? 2)} 分钟真实时间</b>，站点可覆盖；办公室暂停、加速不改变它。成功回复后选项暂时隐藏，回答完成才显示下一轮；旅行进度与纪念节点随存档保存。`,
        `完成 <b>${esc((c.LIFE_STORY || {}).unlockStage || (c.EMBODIED || {}).FINAL_STAGE || order[order.length - 1])}</b> 的版本任务并结算后可观看一生演出；真正完整观看后的回忆可在鲸鱼房重播。演出的暂停、跳转与阅读不会推进办公室训练。`,
      ] },
    ];
    const secs = base.concat([this.guideTraitPage(), this.guideRecruitPage()], extra);
    const gi = this._guideIdx = Math.max(0, Number.isInteger(this._guideIdx) ? this._guideIdx : 0) % Math.max(1, secs.length);
    const active = secs[gi] || {};
    const lineCount = (window.innerHeight || 844) <= 600 ? 2 : 3;
    const lines = active.lines || [];
    const linePages = Math.max(1, Math.ceil(lines.length / lineCount));
    const linePage = this._guideLinePage = Math.max(0, Math.min(linePages - 1, Number.isInteger(this._guideLinePage) ? this._guideLinePage : 0));
    const lineBody = Array.from({length:linePages}, (_, page) => `<section class="omg-line-part" data-guide-line-part="${page}"${page === linePage ? "" : " hidden"}>${lines.slice(page * lineCount, (page + 1) * lineCount).map(l => `<p>${this.reviewTutorialLine(l, active)}</p>`).join("")}</section>`).join("");
    const linePager = linePages > 1 ? `<nav class="omg-line-pager" aria-label="当前主题内容分页"><button class="omg-tab" type="button" data-action="guide-line-page" data-guide-line-page="${linePage - 1}"${linePage === 0 ? " disabled" : ""}>上段</button><span aria-live="polite">本节 ${linePage + 1} / ${linePages}</span><button class="omg-tab" type="button" data-action="guide-line-page" data-guide-line-page="${linePage + 1}"${linePage >= linePages - 1 ? " disabled" : ""}>下段</button></nav>` : "";
    const tabs = secs.map((t, i) => `<button class="omg-tab${i === gi ? " active" : ""}" data-action="guide-page" data-guide-page="${i}" type="button" aria-selected="${i === gi}">${this.tpl(t.title || "")}</button>`).join("");
    return `<div class="guide-body paginated" data-guide-layout="readable">
      <style>
        .modal-card:has(.guide-body[data-guide-layout="readable"]){height:auto;max-height:calc(100% - 16px)}
        .modal-body:has(>.guide-body[data-guide-layout="readable"]){min-height:0}
        .guide-body[data-guide-layout="readable"]{flex:1;height:auto;min-height:0;gap:8px;overflow:visible}
        [data-guide-layout="readable"] .omg-goal{flex:none;padding:6px 9px;font-size:10.5px;line-height:1.5}
        [data-guide-layout="readable"] .omg-tabs{flex:none;flex-wrap:wrap;overflow:visible;max-width:100%;padding-bottom:4px}
        [data-guide-layout="readable"] .omg-tab{flex:none;white-space:nowrap}
        [data-guide-layout="readable"] .omg-page{flex:none;min-height:0;overflow:visible;padding-right:0}
        [data-guide-layout="readable"] .omg-page-title{flex:none}
        .omg-line-part{display:flex;flex-direction:column;gap:6px}
        .omg-line-part[hidden]{display:none!important}
        .omg-line-pager{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--aqua-ink-2);font-size:11px}
        [data-guide-layout="readable"] .omg-counters{flex:none;display:flex;align-items:center;justify-content:space-between;gap:6px}
        [data-guide-layout="readable"] .omg-counters .omg-tab{padding:5px 10px}
        @media (orientation:landscape) and (max-height:520px){
          .modal-card:has(.guide-body[data-guide-layout="readable"]) .modal-header{padding:6px 12px}
          .modal-card:has(.guide-body[data-guide-layout="readable"]) .modal-footer{padding:5px 12px}
          .modal-card:has(.guide-body[data-guide-layout="readable"]) .modal-footer .skew-btn{padding:5px 12px;min-height:30px}
          .modal-body:has(>.guide-body[data-guide-layout="readable"]){padding:8px 12px}
          .guide-body[data-guide-layout="readable"]{gap:6px}
          [data-guide-layout="readable"] .omg-goal{padding:4px 7px}
        }
      </style>
      <div class="omg-goal">本阶段能力目标：${this.modelDims().map(d => esc(d.label) + " ≥ " + Math.ceil(this.modelPass(d.key))).join("、")}。${core.v35On() ? `优秀总评线 ${Math.ceil(pass.score)}；第 ${core.minWeeks(s.ver)} 周结束后可发起评审。` : `总评 ≥ ${Math.ceil(pass.score)}，各项能力达标后即可评审。`}</div>
      <div class="omg-tabs" aria-label="玩法说明主题">${tabs}</div>
      <div class="omg-page" data-guide-id="${esc(active.id || "")}" tabindex="0"><div class="omg-page-title">${this.icon("info", 14)} ${this.tpl(active.title || "")}</div><div class="omg-page-lines">${lineBody}${linePager}</div></div>
      <div class="omg-counters"><button class="omg-tab" type="button" data-action="guide-page" data-guide-page="${Math.max(0, gi - 1)}" ${gi === 0 ? "disabled" : ""}>上一页</button><span aria-live="polite">页 ${gi + 1} / ${secs.length}</span><button class="omg-tab" type="button" data-action="guide-page" data-guide-page="${Math.min(secs.length - 1, gi + 1)}" ${gi === secs.length - 1 ? "disabled" : ""}>下一页</button></div>
    </div>`;
  },
  /* [/feature:portrait-guide-line-pagination] */
  /* [/feature:gameplay-guide-dynamic-pages] */

  /* [/feature:review-week-guide] */
  /* 玩法说明 · 招聘与反抽卡（doc/22 §7.4，2026-09-06 新增）
     数值全部实时读配置 —— 配置里改了费用 / 有效期 / 冷却，这里的文案跟着变。 */
  /* [feature:gameplay-guide-recruit-rules] */
  guideRecruitPage() {
    const c = this.core.cfg;
    const cost = c.RECRUIT_COST || 0, ttl = c.CANDIDATE_TTL_WEEKS || 0, lock = c.CANDIDATE_LOCK_WEEKS || 0;
    const money = n => n % 10000 === 0 ? n / 10000 + " 万元" : n.toLocaleString("zh-CN") + " 元";
    const roles = window.V35Hire ? V35Hire.roles(this.core) : (c.V35 || {}).HIRE_ROLES || {};
    const tpw = (c.V35 || {}).TICKS_PER_WEEK || 6;
    const waits = Object.values(roles).map(r => { const w = r.waitMin || [1, 3], lo = Math.max(1, w[0]), hi = Math.max(3, lo, w[1]); return `${this.escHtml(r.label || "岗位")} ${Math.round(lo * 6 / tpw * 100) / 100}～${Math.round(hi * 6 / tpw * 100) / 100}`; }).join("；");
    const rush = window.V35Hire && V35Hire.rushOptions(this.core);
    const lines = [
      "在「扩编」选择岗位发布需求；可多选，等待取所选岗位最慢范围。找不到合适人选时会继续寻访，当前剩余等待看扩编页。",
      waits ? `初次寻访等待范围（<b>游戏周</b>）：${waits}。经营暂停会停住订单，加速与语料节拍也影响实际耗时，不是固定真实分钟。` : "当前没有开放的寻访岗位。",
      "找到的人会进入<b>「招聘」页的候选列表</b>，再由你录用。人数受办公室座位上限约束，候选人不等于已入职。",
      cost > 0 ? `发布费为<b>每个岗位 ${money(cost)}</b>；选 N 个岗位收 N 次费用，不是整张订单只收一次。` : "当前配置下发布需求不收费。",
      ttl > 0 ? `普通与寻访候选都按<b>绝对周计时，等待 ${ttl} 周</b>后过期；跨阶段与重训不会把等待期清零。` : "当前候选人不会因等待时间自行离开。",
      lock > 0 ? `过期人选通常冷却 <b>${lock} 周</b>；只有符合阶段、岗位与去重条件的抽选池耗尽时，才恢复这个合法池的冷却人选。在职、已有候选、未开放人选仍不会重抽。` : "当前未设置候选冷却；在职与已有候选仍会去重。",
      "可抽词条等级按阶段和招聘规则变化，候选刷新不意味着清空整张工程师池或重置已录用的人。",
      rush ? `加急每次 <b>${money(rush.cost)}</b>，缩短订单 <b>${rush.weeks} 周</b>等待；<b>不推进办公室时间</b>，也不额外制造生产或工资周期。` : "",
    ].filter(Boolean);
    return { id: "t_recruit_live", title: "招聘与候选池", lines };
  },
  /* [/feature:gameplay-guide-recruit-rules] */

  /* 玩法说明 · 词条升级页（2026-09-05 新增；动态生成，数值全部实时读配置，
     配置改了门槛/除数，说明文案跟着变，不会再出现"说明和数值对不上"）。 */
  /* [feature:gameplay-guide-trait-rules] */
  guideTraitPage() {
    const c = this.core.cfg, core = this.core, min = core.traitUpgradeMinStat(), U = c.TRAIT_UPGRADE || {}, TB = c.TEAM_BUILD || {};
    const types = Object.keys(U.traits || {}), esc = v => this.escHtml(String(v));
    const pct = x => Math.round(x * 1000) / 10 + "%";
    const rows = types.map(t => {
      const ks = core.traitUpgradeStats(t), names = ks.map(k => esc(core.statName(k))).join(" + ");
      const tip = ks.length > 1 ? `（<b>${ks.length} 项都要</b>达标，再取平均）` : "";
      return `<b>${esc(this.traitName(t))}</b>：看 <b>${names}</b>${tip}；门槛处基础概率 Lv1→2 ${pct(core.traitUpgradeProb(t, 1, min))}、Lv2→3 ${pct(core.traitUpgradeProb(t, 2, min))}。`;
    });
    const stageCaps = Object.entries(c.STAGE_TRAIT_MAX || {}).map(([ver, cap]) => `${esc(ver)} Lv${esc(cap || 5)}`).join(" ／ ");
    const caps = c.TALENT_LV_CAP || {};
    const talentCaps = Object.entries({ gray: "一般", blue: "良好", pink: "优秀", orange: "天才", rainbow: "大牛" }).map(([k, label]) => `${label} Lv${esc(caps[k] ?? 5)}`).join(" ／ ");
    const lines = [
      "词条代表工程师的经验，等级影响基础产出区间；实际产出还受体力、休息、语料、论文与各项加成影响。",
  /* [feature:multi-trait-dev-ui-004] */
      "同一工程师的<b>多个不同生产词条同时生效、各自产出</b>，分别使用各自等级；具身词条仍须进入具身时代且模型激活对应轴，学术只辅助升级，同类重复只取最高一条。个人体力只结算一次，休假、未到岗或离职时全部产线停止。",
  /* [/feature:multi-trait-dev-ui-004] */
      `升级在<b>每次真正发起评审时判定一次</b>，任务未达的评审也会判定；不是每周自动升级。对应各项潜力均须 ≥ <b>${min}</b>，通过门槛后按实际平均潜力计算概率。以下只是门槛处基础概率，不含个人学术与临时增益。`,
      ...rows,
      `词条等级同时受<b>阶段上限</b>（${stageCaps || "未配置"}）与<b>天赋上限</b>（${talentCaps}）限制，取两者较低值。`,
      "未配置成长规则的学术词条本身不会升级；它会给<b>同一人的其他可成长词条</b>增加升级概率，多条学术取最高等级，不叠加。个人和临时增益以实际工程师状态为准。",
      "<b>灵感迸发</b>：基础三岗位平均体力达到 80，且本阶段仍有词条升级空间时，周结算有机会触发；全员消耗 15 体力，本次评审的词条升级概率乘 1.5，判定后消费，每轮阶段训练至多触发一次，重训后重新计。<b>短时产出爆发</b>另按岗位条件触发，只增加短时产出，不能把两种效果混为一谈。",
      `培训每人每个绝对周一次，从该岗位实际潜力属性中选一项：${TB.TRAIN_PICK === "low" ? "按低值加权，全部达到参考值时等概率" : "等概率随机"}。普通岗位是算法/代码/文字潜力，具身岗位把文字换成工程潜力；单次最多增加 <b>${esc(TB.TRAIN_STAT_ADD ?? 5)}</b>，潜力上限 100，<b>培训不会立即升词条</b>。费用和体力代价见团队操作卡。`,
    ];
    return { id: "t_trait", title: "工程师成长", lines };
  },
  /* [/feature:gameplay-guide-trait-rules] */

  /* ---------------- 内部评审 · 答题动画（X5 演出台）----------------
     逐题揭示：评审官提问 → 模型作答 → 判定对错；分数只是表演，
     最终结果仍以 evaluate() 的加权总评（第三幕结算演出揭晓）为准。 */
  /* 内部评审 · 答题测评动画（2026-09-03 重构）：
      一次只出一道题（不再把所有题平铺），配小鲸鱼三态立绘（等待/答对/答错）+ 气泡包装模型回答。
      节拍：显示第 n 题(等待) → 一拍揭晓对错(标识/立绘/音效/动效) → 一拍切下一题，直至全部答完。 */
  /* [feature:v5-direct-review-entry] */
  /* [feature:v5-review-skip-fitness-settle] */
  settleEmbodiedReview() {
    const core = this.core, s = core && core.state;
    if (!s || s.phase !== "review" || !s.result || !core.embodiedAvailable || !core.embodiedAvailable(s)) return false;
    this.stopEvalShowTimer();
    this._evalShown = 0; this._evalWaitTut = false; this._evalSkin = "";
    // Older in-race checkpoints are unpaid. Already committed checkpoints only recover their phase.
    const result = s.result.settled ? s.result : core.finish();
    if (!result || !result.settled) return false;
    if (s.phase === "review") s.phase = s.bonus && s.bonus.items && s.bonus.items.length && Number(s.bonus.total) > 0 ? "bonus" : "over";
    if (this.save && this.save.autoSave) this.save.autoSave(s);
    return true;
  },
  /* [/feature:v5-review-skip-fitness-settle] */
  /* [/feature:v5-direct-review-entry] */
  renderEvalShow() {
    /* [feature:v5-direct-review-render] */
    /* [feature:v5-review-skip-fitness-render] */
    if (this.core.state.phase === "review" && this.core.state.result && this.core.embodiedAvailable && this.core.embodiedAvailable(this.core.state)) {
      this.settleEmbodiedReview(); return this.render();
    }
    /* [/feature:v5-review-skip-fitness-render] */
    /* [/feature:v5-direct-review-render] */
    /* [feature:embodied-original-evaluation] */
    /* [feature:v5-review-skip-fitness-comment] */
    // Early stages retain questions; V5+ enters the original settlement directly.
    /* [/feature:v5-review-skip-fitness-comment] */
    /* [/feature:embodied-original-evaluation] */
    if (window.AgentReview && AgentReview.allowed(this)) { AgentReview.render(this); return; }
    const c = this.core.cfg, s = this.core.state;
    const es = s.evalShow || { qs: [], score: 0, total: 0 };
    const qs = es.qs || [];
    const n = qs.length;
    const rp = (c.EVAL_SHOW && c.EVAL_SHOW.ROLE_PORTS) || null;
    /* 2026-09-05（doc/17）：按题型切演出皮肤 —— bubble 对话气泡 / terminal CMD 终端 / reader 长文阅读台。
       终端与阅读台不需要小鲸鱼立绘（它们的"主角"是代码与原文），只有气泡皮肤才渲染立绘。 */
    const skin = es.skin || "bubble";
    this._evalSkin = skin;
    const isTerm = skin === "terminal", isReader = skin === "reader";
    const head = isTerm ? ["code", "内部评审 · 代码评测"]
      : isReader ? ["book", "内部评审 · 长文本评测"]
        : ["shield", "内部评审 · 答题测评"];
    /* 终端主题：holo（蓝色半透明投影 + 白字，默认）/ light（白底 + 蓝绿字） */
    const termTheme = isTerm && ((c.EVAL_SKIN || {}).code || {}).theme === "light" ? " theme-light" : "";
    /* 2026-09-08 用户反馈「代码评测界面立绘不见了」：终端 / 阅读台以前不渲染小鲸鱼。
       现在三种皮肤都有立绘 —— 气泡皮肤用卡内大立绘，终端/阅读台在标题栏放一个小头像
       （不压住代码与原文，但立绘/答对答错状态照常切换）。 */
    const headRole = (rp && (isTerm || isReader))
      ? `<img class="evalshow-role-sm" id="evRole" src="${rp.idle}" data-role="idle" alt="">` : "";
    const cardRole = (rp && !isTerm && !isReader)
      ? `<img class="evalshow-role" id="evRole" src="${rp.idle}" data-role="idle" alt="">` : "";
    this._evalShown = 0;      // 已揭晓答案的题数
    this._evalRevealedVis = false;  // 当前题是否已揭晓（等待 / 已判定）
    this._evalPaused = false; // 2026-09-12：暂停阅读（长题干给玩家留阅读时间）
    this.el.innerHTML = `
      <div class="dg-stage evalshow-stage${isReader ? " has-reader" : ""}">
        <div class="evalshow-head">
          ${headRole}
          <div class="evalshow-title">${this.icon(head[0], 15)} ${head[1]}</div>
          <div class="evalshow-meta"><span class="em-score">得分 <b>0</b> / ${n}</span> · 答对 0 / ${n}</div>
        </div>
        <div class="evalshow-card skin-${skin}${termTheme}" id="evCard">
        ${cardRole}
        <div class="${isTerm ? "term-cmd" : isReader ? "reader-src" : "evalshow-bub evalshow-bub-q"}" id="evQ"></div>
        <div class="evalshow-fb" id="evFB"></div>
        </div>
        <div class="evalshow-foot">
          <button class="dg-btn dg-btn-ghost" data-action="eval-pause" id="evPauseBtn">⏸ 暂停阅读</button>
          <button class="dg-btn dg-btn-primary" data-action="evalshow-done">${(c.EVAL_SHOW && c.EVAL_SHOW.SKIPPABLE) === false ? "" : "跳过 · 直出结果"}</button>
        </div>
      </div>`;
    if (n) this.fillEvalQ(0);
    this.startEvalShowTimer();
  },

  /* HTML 转义：题库里的代码含 < > & " 等字符，直接塞进 innerHTML 会截断标签。 */
  escHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },

  /* 填充当前题（等待态：只显示题目与小鲸鱼「等待&答题」立绘） */
  fillEvalQ(i) {
    const s = this.core.state;
    const qs = (s.evalShow && s.evalShow.qs) || [];
    const q = qs[i];
    const n = qs.length;
    const c = this.core.cfg;
    const rp = (c.EVAL_SHOW && c.EVAL_SHOW.ROLE_PORTS) || null;
    const card = this.el.querySelector("#evCard");
    if (card) { card.classList.remove("ok", "fail"); }
    const skin = this._evalSkin || "bubble";
    const qEl = this.el.querySelector("#evQ");
    const fb = this.el.querySelector("#evFB");
    /* 题目区：终端是一行命令；阅读台是「容量条 + 原文材料」；气泡是居中气泡 */
    if (qEl && q) {
      qEl.innerHTML = skin === "terminal"
        ? `<div class="tc-prompt">${this.escHtml(this.tpl(q.q || ""))}</div>`
        : skin === "reader"
          ? `<div class="rb-bar"><span class="rb-label">上下文</span>`
            + `<span class="rb-track"><i style="width:${this.readerTokenPct(q)}%"></i></span>`
            + `<b class="rb-num">${Math.round((q.material || "").length)} 字</b></div>`
            + `<div class="reader-material">${this.escHtml(q.material || "（材料缺失）")}</div>`
            + `<div class="reader-ask">${this.escHtml(q.q || "")}</div>`
          : `<div class="evalshow-num">题目 ${i + 1} / ${n}</div><div>${this.tpl(q.q || "")}</div>`;
      /* 2026-09-05（用户反馈）：长题目会被定高截断 —— 自适应降两档字号，
         卡片尺寸保持不变（立绘/反馈区位置不动） */
      if (skin === "bubble") this.fitEvalQ(qEl);
    }
    /* 回答区：先摆好皮肤骨架，真正的输出在 revealEvalQ 里 */
    if (fb) {
      fb.innerHTML = skin === "terminal"
        ? `<div class="term-screen"><div class="term-code" id="evCode"></div>`
          + `<div class="term-panel" id="evPanel"><div class="tp-row tp-dim">等待输出…</div></div></div>`
        : skin === "reader"
          ? `<div class="reader-out" id="evOut"><span class="ro-wait">阅读中…</span></div>`
            + `<div class="reader-metrics" id="evMetrics"></div>`
          : `<div class="evalshow-bub evalshow-bub-a">…</div>`;
    }
    const role = this.el.querySelector("#evRole");
    if (role && rp && rp.idle) { role.src = rp.idle; role.dataset.role = "idle"; }
  },

  /* 长文本：上下文容量条百分比（材料越长占比越高，上限按 2400 字封顶） */
  readerTokenPct(q) {
    const len = (q && q.material ? q.material.length : 0) || 0;
    return Math.max(8, Math.min(100, Math.round(len / 2400 * 100)));
  },

  /* 题目气泡自适应（2026-09-05）：内容超高就逐档降字号，不再截断 */
  fitEvalQ(qEl) {
    if (!qEl) return;
    qEl.classList.remove("fit-1", "fit-2");
    let guard = 0;
    while (qEl.scrollHeight > qEl.clientHeight + 1 && guard < 2) {
      qEl.classList.add(guard === 0 ? "fit-1" : "fit-2");
      guard += 1;
    }
  },

  /* 阅读台作答打字机：逐块吐字，让"长文本在生成"这件事看得见。
     上限 260 字——再长会超出节拍（MS_PER_Q）也会撑破卡片。 */
  startReaderType(i) {
    this.stopReaderType();
    const s = this.core.state;
    const q = ((s.evalShow || {}).qs || [])[i];
    const out = this.el && this.el.querySelector("#evOut");
    if (!q || !out) return;
    const skinCfg = (this.core.cfg.EVAL_SKIN || {}).long || {};
    const chunk = skinCfg.chunkSize || 8;
    const ms = skinCfg.outChunkMs || 30;
    const text = String(q.ok ? q.good : q.bad).slice(0, 260);
    out.textContent = "";
    let pos = 0;
    this._readerTimer = setInterval(() => {
      pos += chunk;
      out.textContent = text.slice(0, pos);
      if (pos >= text.length) this.stopReaderType();
    }, ms);
  },
  stopReaderType() {
    if (this._readerTimer) { clearInterval(this._readerTimer); this._readerTimer = null; }
  },

  /* 揭晓当前题答案：打上对/错标识 + 切换立绘 + 音效 + 动效 */
  revealEvalQ(i) {
    const s = this.core.state;
    const qs = (s.evalShow && s.evalShow.qs) || [];
    const q = qs[i];
    if (!q) return;
    const c = this.core.cfg;
    const rp = (c.EVAL_SHOW && c.EVAL_SHOW.ROLE_PORTS) || null;
    const card = this.el.querySelector("#evCard");
    if (card) card.classList.add(q.ok ? "ok" : "fail");
    const skin = this._evalSkin || "bubble";
    const fb = this.el.querySelector("#evFB");
    const hits = qs.slice(0, i + 1).filter((x) => x.ok).length;
    const rate = Math.round(hits / (i + 1) * 100);       // 本轮累计通过率

    if (skin === "terminal") {
      const skinCfg = (c.EVAL_SKIN || {}).code || {};
      const lineMs = skinCfg.lineMs || 90;
      const src = String(q.ok ? q.good : q.bad).split("\n");
      const cases = q.cases || 10;
      const passed = q.ok ? cases : Math.max(1, Math.round(cases * 0.75));
      if (fb) {
        fb.innerHTML = `
          <div class="term-screen">
            <div class="term-code">${src.map((ln, k) =>
    `<div class="tc-line" style="animation-delay:${k * lineMs}ms">`
    + `<span class="tc-no">${k + 1}</span><span class="tc-txt">${this.escHtml(ln) || "&nbsp;"}</span></div>`).join("")}</div>
            <div class="term-panel">
              <div class="tp-row"><span class="tp-k">编译</span><span class="tp-ok">OK</span></div>
              <div class="tp-row"><span class="tp-k">测试用例</span>
                <span class="tp-bar"><i style="width:${Math.round(passed / cases * 100)}%"></i></span>
                <b class="tp-num">${passed} / ${cases}</b></div>
              ${q.ok ? "" : `<div class="tp-bug">⚠ ${this.escHtml(q.tag || "逻辑错误")}：${this.escHtml(q.bug || "输出与预期不符")}</div>`}
              <div class="tp-verdict ${q.ok ? "ok" : "fail"}">
                ${q.ok ? "✓ AC · 本次通过" : "✗ WA · 存在缺陷"}
                <span class="tp-rate">一次性通过率 ${rate}%</span></div>
            </div>
          </div>`;
      }
    } else if (skin === "reader") {
      /* 长文本：作答区走打字机，底部给三个长文本专属指标 */
      this.startReaderType(i);
      const m = this.el.querySelector("#evMetrics");
      if (m) {
        const hitPct = q.ok ? 100 : (/遗忘/.test(q.tag || "") ? 33 : 40);
        const cover = q.ok ? "3 / 3" : "1 / 3";
        m.innerHTML = `
          <span class="rm-item"><span class="rm-k">记忆命中</span><b class="${q.ok ? "ok" : "fail"}">${hitPct}%</b></span>
          <span class="rm-item"><span class="rm-k">要点覆盖</span><b>${cover}</b></span>
          <span class="rm-item"><span class="rm-k">处理字数</span><b>${Math.round((q.material || "").length)}</b></span>`;
      }
      const out = this.el.querySelector("#evOut");
      if (out) out.classList.toggle("fail", !q.ok);
    } else if (fb) {
      fb.innerHTML = `
      <div class="evalshow-fb-badge ${q.ok ? "ok" : "fail"}">${q.ok ? "✓" : "✗"}</div>
      <div class="evalshow-bub evalshow-bub-a">${this.tpl(q.ok ? q.good : q.bad)}</div>`;
    }
    const role = this.el.querySelector("#evRole");
    if (role && rp) { const src = q.ok ? rp.ok : rp.fail; if (src) { role.src = src; role.dataset.role = q.ok ? "ok" : "fail"; } }
    if (window.SFX) SFX.play(q.ok ? "confirm" : "click");
    const meta = this.el.querySelector(".evalshow-meta");
    if (meta) meta.innerHTML = `<span class="em-score">得分 <b>${hits}</b> / ${qs.length}</span> · 答对 ${hits} / ${qs.length}`;
  },

  /* 答题动画节拍器：一拍揭晓当前题（标识/立绘/音效/动效），一拍切下一题
     若评审说明（t_review）还在弹 → 先暂停，看完说明才开播 */
  startEvalShowTimer() {
    this.stopEvalShowTimer();
    /* [feature:v5-fitness-review-start] */
    if (this._evalSkin === "fitness" && window.EmbodiedFitnessReview) { EmbodiedFitnessReview.start(this); return; }
    /* [/feature:v5-fitness-review-start] */
    if (this._evalSkin === "embodied" && window.EmbodiedPresentation) { EmbodiedPresentation.start(this); return; }
    if (this._evalSkin === "agents" && window.AgentReview) { AgentReview.start(this); return; }
    if (this._evalWaitTut) return;    // 新手说明未关 → 动画先不播
    const s = this.core.state;
    const qs = (s.evalShow && s.evalShow.qs) || [];
    const n = qs.length;
    if (!n || (this._evalShown || 0) >= n) return;
    const per = (this.core.cfg.EVAL_SHOW || {}).MS_PER_Q || 3000;
    const self = this;
    this._evalTimer = setInterval(() => {
      if (!self.el.querySelector("#evCard")) { self.stopEvalShowTimer(); return; }
      if (self._evalPaused) return;      // 暂停阅读中：计时器空转，恢复后继续
      if (!self._evalRevealedVis) {
        /* 揭晓当前第 _evalShown 题 */
        self._evalRevealedVis = true;
        self.revealEvalQ(self._evalShown);
      } else {
        /* 进入下一题 */
        self._evalShown += 1;
        if (self._evalShown >= n) {
          self.stopEvalShowTimer();
          const btn = self.el.querySelector('[data-action="evalshow-done"]');
          if (btn) { btn.textContent = "查看评审结果 ➜"; btn.disabled = false; }
          return;
        }
        self._evalRevealedVis = false;
        self.fillEvalQ(self._evalShown);
      }
    }, per);
  },
  stopEvalShowTimer() {
    /* [feature:v5-fitness-review-stop] */
    if (window.EmbodiedFitnessReview) EmbodiedFitnessReview.stop(this);
    /* [/feature:v5-fitness-review-stop] */
    if (window.EmbodiedPresentation) EmbodiedPresentation.stop(this);
    if (window.AgentReview) AgentReview.stop(this);
    if (this._evalTimer) { clearInterval(this._evalTimer); this._evalTimer = null; }
    /* 长文本皮肤的打字机也要一起停，否则切题/离开评审后它还在往已销毁的节点里写 */
    this.stopReaderType();
  },

  /* ================================================================
     奖励结算 · 三幕演出（2026-09-04 重做，doc/16 方案 v2）
     demo：doc/pages/评审通过 · 奖励结算演出_1/pages/评审通过 · 奖励结算演出.html
     ----------------------------------------------------------------
     第一幕 模型数值：四维分组柱状图（本阶段 vs 前 3 阶段，提升项金色高亮 + +Δ 徽章）
     第二幕 排行与反馈：全球模型能力榜（前 10 + 己方行）+ 用户数/评分 + 评价卡 ×3
     第三幕 总奖金：奖金滚动 + 构成 chips + 工程师词条升级卡 + 卡片内金币彩纸粒子
     状态机 rewardGoTo(n)：.act active/leaving 切换 + 顶部进度胶囊点亮；
     s.bonusAct 记录当前幕（读档重进结算演出页恢复；旧档缺字段从第 1 幕播）。
     浅蓝玻璃卡 + 彩色几何底纹，金色只用于「提升高亮 / 等级徽章 / 奖金」三个语义。
     ================================================================ */
  REWARD_ACTS: [
    { n: 1, label: "模型数值", icon: "barchart" },
    { n: 2, label: "排行与反馈", icon: "trophy" },
    { n: 3, label: "总奖金", icon: "coins" },
    /* 2026-09-16（doc/35）：第四幕「成就」。⚠️ 它**不是恒有**的 —— 本次没有新解锁时
       整幕不出现（幕数从 4 退回 3），所以 renderBonus 里要按实际情况过滤这张表。 */
    { n: 4, label: "成就", icon: "medal" },
  ],
  /* 成就稀有度映射：一张表同时决定「卡片描边 class / 扩散环层数 / 尘埃粒子数 / 默认图标」。
     ⚠️ 只在这里写一份 —— 弹卡与列表成品共用；颜色本身定义在 style.css 的 .rarity-* 里。
     `icon` = 该稀有度的**默认图标名**；某条成就想换，在配置里写 `icon: "…"` 即可覆盖。 */
  ACHV_RARITY: {
    "普通": { cls: "rarity-common", rings: 2, dust: 10, icon: "achvCommon" },
    "稀有": { cls: "rarity-rare", rings: 2, dust: 12, icon: "achvRare" },
    "史诗": { cls: "rarity-epic", rings: 3, dust: 15, icon: "achvEpic" },
    "传说": { cls: "rarity-legend", rings: 3, dust: 18, icon: "achvLegend" },
    /* 未解锁态（成就墙用）：灰烬微粒 —— 少、慢、接近灰 */
    "__locked": { cls: "rarity-locked", rings: 0, dust: 6, icon: "achvLocked" },
  },
  /* 弹卡节奏（doc/35 §4.2.2；一次解锁很多张时自动压短停留） */
  ACHV_REVEAL: { IN: 480, HOLD: 1400, OUT: 240, HOLD_MANY: 900, MANY_AT: 3, DUST_MAX: 18 },
  /* 解锁列表每页张数 —— 2026-09-29 用户两次校正后的最终口径：
       ① 「让成就卡文案显示完整，一页甚至可以只显示一张卡，让玩家翻页」
       ② 「成就卡是手机竖屏才是一页一个，电脑网页还是跟以前一样」
     ⇒ 竖屏 1 张（卡高随文案自适应、不截断，见 style.css 的竖屏 #act-4 覆盖）；桌面 4 张（旧行为）。
     ⚠️ 判据必须与 style.css 那段 `@media (orientation: portrait)` **同条件**：
        张数在 JS、列数在 CSS，两处判据不同源就会「一页 4 张却只画 1 列」。
     ⚠️ 不要直接读 ACHV_PER_PAGE 算分页 —— 一律走 achvPerPage()。 */
  ACHV_PER_PAGE: 4,
  ACHV_PER_PAGE_PORTRAIT: 1,
  /* [feature:reward-content-pages-short-achievements] */
  achvPerPage() {
    const portrait = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(orientation: portrait)").matches;
    if(!portrait&&window.innerHeight<500)return 1;
    return portrait ? this.ACHV_PER_PAGE_PORTRAIT : this.ACHV_PER_PAGE;
  },
  /* [/feature:reward-content-pages-short-achievements] */
  achvRarity(r) { return this.ACHV_RARITY[r] || this.ACHV_RARITY["普通"]; },
  /* 解锁时间 = **现实时间**（2026-09-17 用户明确要求：「成就解锁时间是现实的时间！」）
     ------------------------------------------------------------------
     存的那一份本来就是 `Date.now()`（真实 epoch 毫秒），所以这里只是**显示层**的事：
     格式化成 `2026-09-17 21:12`。
     ⚠️ 不要显示"第 N 周"那种**游戏内**时间 —— 成就墙是**跨局回顾**用的，
        玩家记住的是"我哪天拿到的"，而不是当时打到第几周（那是局内的临时刻度）。
     ⚠️ 时区走本机（`getFullYear/getMonth/...` 都是本地时区）—— 玩家看的当然是自己的表。 */
  achvTimeText(t) {
    const ms = Number(t);
    if (!isFinite(ms) || ms <= 0) return "";
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
      + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  },
  /* 成就专属图标渲染器（2026-09-16 二改：用户「图标太简单，要精致复杂一点」）
     ------------------------------------------------------------------
     为什么不复用 `icon()`：那套是 **24 viewBox + 纯线稿 + stroke-width 2.1**，
     笔画一多就糊成一团，做不出"宝石切面 / 冠冕层叠"这种细节。
     这里改用 **48 viewBox + 实心(solid)造型 + 白色高光面**：
       · 主体 `fill="currentColor"`（跟稀有度色走，一块实心色比一堆细线"重"得多）
       · 切面/高光 `fill="#fff"` + 低 opacity（宝石、星芒的"层"就是这么来的）
       · 只有必须的轮廓（锁梁、光芒）才用 stroke
     ⚠️ 项目硬规矩：图标一律自绘 SVG、禁 emoji；`fill` 一律写死，不许留空（会回落成黑）。
     ⚠️ 配置可覆盖：成就条目里写 `icon: "<名字>"` 即可（见 achvCardHtml）。 */
  ACHV_ICON_ART: {
    /* 普通 · 星芒徽章：环 + 实心核 + 四向光芒 */
    achvCommon:
      '<circle cx="24" cy="24" r="14.5" fill="none" stroke="currentColor" stroke-width="3.6"/>'
      + '<circle cx="24" cy="24" r="7.6" fill="currentColor"/>'
      + '<circle cx="24" cy="24" r="3.1" fill="#fff" opacity=".88"/>'
      + '<path d="M24 3.6v4.6M24 39.8v4.6M3.6 24h4.6M39.8 24h4.6" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
    /* 稀有 · 菱形宝石：外菱形 + 两块切面 + 内菱形 + 高光点 */
    achvRare:
      '<path d="M24 3.8 44.2 24 24 44.2 3.8 24Z" fill="currentColor"/>'
      + '<path d="M24 3.8 44.2 24 24 24Z" fill="#fff" opacity=".26"/>'
      + '<path d="M24 10.6 37.4 24 24 37.4 10.6 24Z" fill="#fff" opacity=".55"/>'
      + '<path d="M24 17.2 30.8 24 24 30.8 17.2 24Z" fill="currentColor"/>'
      + '<circle cx="24" cy="24" r="2.5" fill="#fff"/>',
    /* 史诗 · 八向绽放：主星 + 内星 + 双色核 + 十字光芒 */
    achvEpic:
      '<path d="M24 2.6 30.7 17.3 45.4 24 30.7 30.7 24 45.4 17.3 30.7 2.6 24 17.3 17.3Z" fill="currentColor"/>'
      + '<path d="M24 12.2 28.1 19.9 35.8 24 28.1 28.1 24 35.8 19.9 28.1 12.2 24 19.9 19.9Z" fill="#fff" opacity=".58"/>'
      + '<circle cx="24" cy="24" r="3.6" fill="#fff"/>'
      + '<circle cx="24" cy="24" r="1.7" fill="currentColor"/>'
      + '<path d="M24 0.8v3.4M24 43.8v3.4M0.8 24h3.4M43.8 24h3.4" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    /* 传说 · 冠冕：三尖冠体 + 底带 + 三颗宝石 + 顶部光芒 */
    achvLegend:
      '<path d="M5.4 15.6 14.8 24.4 24 8.2l9.2 16.2 9.4-8.8-3.7 21.2H9.1Z" fill="currentColor"/>'
      + '<rect x="9.1" y="34.4" width="29.8" height="6" rx="2.4" fill="currentColor"/>'
      + '<circle cx="24" cy="21.6" r="4" fill="#fff" opacity=".92"/>'
      + '<circle cx="13.6" cy="28.4" r="2.1" fill="#fff" opacity=".72"/>'
      + '<circle cx="34.4" cy="28.4" r="2.1" fill="#fff" opacity=".72"/>'
      + '<path d="M24 1.8v5M7.2 5.4l3.6 4.2M40.8 5.4l-3.6 4.2" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
    /* 未解锁 · 挂锁：实心锁体 + 锁梁 + 钥匙孔 + 铆钉 */
    achvLocked:
      '<rect x="9.4" y="19.6" width="29.2" height="23.2" rx="5.2" fill="currentColor"/>'
      + '<path d="M16.2 19.6v-5.4a7.8 7.8 0 0 1 15.6 0v5.4" fill="none" stroke="currentColor" stroke-width="3.8"/>'
      + '<circle cx="24" cy="29.2" r="3.4" fill="#fff" opacity=".92"/>'
      + '<path d="M24 32.4v4.8" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".92"/>'
      + '<circle cx="14.4" cy="23.6" r="1.5" fill="#fff" opacity=".55"/>'
      + '<circle cx="33.6" cy="23.6" r="1.5" fill="#fff" opacity=".55"/>',
  },
  achvIcon(name, size) {
    const art = this.ACHV_ICON_ART[name];
    if (!art) return this.icon(name, size);          // 兜底：配置里写了个普通图标名也认
    const s = size || 44;
    return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" aria-hidden="true">${art}</svg>`;
  },
  /* 稀有度升序（普通 → 传说），大招最后落（doc/35 §4.2.2 推荐的弹卡顺序） */
  ACHV_ORDER: { "普通": 0, "稀有": 1, "史诗": 2, "传说": 3 },
  /* 工程师类型 → 岗位名（第三幕升级卡「姓名 · 岗位」用） */
  ROLE_NAME: {
    pretrain: "算法工程师", post: "后训练工程师", academic: "研究员",
    engineer: "系统工程师", data: "数据工程师", safety: "安全工程师",
  },

  /* 结算数字滚动：easeOutCubic（与 demo countUp 同曲线）；setInterval 便于统一清理 */
  bonusCountUp(el, target, dur, opts) {
    if (!el) return;
    opts = opts || {};
    const dec = opts.decimals || 0;
    const fmtV = (v) => (dec ? v.toFixed(dec) : Math.round(v).toLocaleString());
    const t0 = performance.now();
    const iv = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtV(target * eased);
      if (k >= 1) {
        clearInterval(iv);
        el.textContent = fmtV(target);
        if (opts.done) opts.done();
      }
    }, 40);
    this._bonusTimers.push(iv);
  },
  bonusLater(fn, ms) { this._bonusTimeouts.push(setTimeout(fn, ms)); },
  clearBonusTimers() {
    (this._bonusTimers || []).forEach((t) => clearInterval(t));
    (this._bonusTimeouts || []).forEach((t) => clearTimeout(t));
    this._bonusTimers = [];
    this._bonusTimeouts = [];
  },

  /* 品牌收益只读引擎实际入账字段；旧存档无该项时不虚构奖励。 */
  brandBenefitHTML(benefit) {
    if (!benefit || !(benefit.base > 0)) return "";
    const stars = Math.max(0, Math.min(5, Math.floor(benefit.stars || 0)));
    const money = (n) => "¥" + Math.round(Number(n) || 0).toLocaleString();
    return `<div class="brand-benefit" aria-label="品牌带来的额外收益">
      <div class="brand-benefit-head"><span>${this.icon("star", 14)} 品牌正在创造价值</span><span class="brand-benefit-stars">${"★".repeat(stars) + "☆".repeat(5 - stars)}</span></div>
      <div class="brand-benefit-value"><span>额外净入账</span><b>+${money(benefit.net)}</b></div>
      <div class="brand-benefit-note">结算前 ${stars} 星品牌 · 主奖金 ${money(benefit.base)} × ${Math.round((benefit.rate || 0) * 100)}%${benefit.dividend > 0 ? " · 已扣分红 " + money(benefit.dividend) : ""}</div>
    </div>`;
  },

  /* ---------------- 结算页主渲染 ---------------- */
  renderBonus() {
    /* [feature:embodied-original-settlement] */
    // V5 additions are mounted around this original reward stage by the feature module.
    /* [/feature:embodied-original-settlement] */
    const s = this.core.state, c = this.core.cfg;
    const b = s.bonus || { items: [], total: 0 };
    const r = s.result || {};
    const exc = this.core.isExcLike(r);            // 优秀或顶尖
    const failureUI=((c.EMBODIED||{}).REVIEW_FAILURE||{}).UI||{};
    const failed=!!r.qualificationFailed;
    const tierLbl = (() => {
      if(failed)return failureUI.TITLE;
      const v = r.verdict;
      if (v === "top") return "S · 顶尖";
      if (v === "excellent") return "A · 优秀";
      if (v === "pass") return "B · 合格";
      if (v === "veto" || v === "fail") return "D · 不及格";
      return "—";
    })();
    const tierBadge = (() => {
      if(failed)return failureUI.BADGE;
      const v = r.verdict;
      if (v === "top") return "评审顶尖！问鼎阶段之巅";
      if (v === "excellent") return "评审优秀！远超阶段目标";
      return "评审通过！本阶段交付合格";
    })();
    const first = r.rankPrev == null;                    // 首次结算 = 新入榜
    const verIdx = (c.VER_ORDER || ["V1"]).indexOf(s.ver || "V1");
    const beta = this.core.isBeta(s.ver);                // 公开点 = core.PUBLIC_FROM_VER（V3.5）
    const thinking = verIdx >= 4;                        // V3 起思考模型时代（己方 meta 同步）
    this.clearBonusTimers();
    this._bonusPlayed = {};

    /* ---- 第一幕数据：四维 stats（demo 契约：history 旧→新 ≤3 条 + now，满分 100）----
       注意过滤本版快照：finish() 的 pushModelSnapshot 已把本版写进 modelHistory，
       不剔除的话「上一阶段」会变成自己（提升判定恒 false，p3 柱与本阶段柱等高）。 */
    const hist = (s.modelHistory || []).filter((h) => h && h.ver !== s.ver).slice(-3);
    /* [feature:v5-effective-chart-dimensions] */
    const embodiedChart = !!(this.core.embodiedAvailable && this.core.embodiedAvailable(s));
    const dims = embodiedChart ? this.modelDims(s).map(d => Object.assign({}, d, {
      icon: d.key === "codeText" ? "code" : d.key === "safetyStability" ? "shield" : "",
      iconHTML: d.key === "codeText" || d.key === "safetyStability" ? "" : this.axisIcon(d.key, 13),
    })) : [
      { key: "code", label: "代码", icon: "code" },
      { key: "text", label: "文字", icon: "type" },
      { key: "safety", label: "安全", icon: "shield" },
      { key: "stability", label: "稳定", icon: "activity" },
    ];
    const chartValue = (key, record) => Math.round(embodiedChart ? this.modelValue(key, record) : Number(record[key]) || 0);
    const stats = dims.map((d) => {
      const now = chartValue(d.key, s);
      const prevLast = hist.length ? chartValue(d.key, hist[hist.length - 1]) : null;
      return Object.assign({}, d, {
        now,
        history: hist.map((h) => chartValue(d.key, h)),
        /* [/feature:v5-effective-chart-dimensions] */
        up: prevLast != null && now > prevLast,          // 只与上一阶段比（demo 判定）
      });
    });
    const upCount = stats.filter((x) => x.up).length;

    /* ---- 第二幕数据：能力榜（前 10 + 己方行） ----
       ⚠️ 2026-09-13 重设计（用户拍板）：**榜单分取消**，榜上分数就是评审分（同一把尺子）。
          ⇒ 己方行显示的分数 = 本次评审总分本身，名次由 game_core.finish 直接比分数算出。 */
    const board = (c.RANK_BOARD_BY_VER || {})[s.ver || "V1"] || [];
    const meRank = s.rank || (board.length ? board.length + 1 : 11);   // 尚未结算 → 视作榜外
    const rankUpTxt = first ? "新入榜" : `上升 ${r.rankUp || 0} 位`;
    const meMeta = (first && meRank > 10)
      ? `当前排名第 ${meRank} 位 · 排名还很落后，继续加油`
      : (thinking ? "推理模型" : "语言模型");
    /* ── 己方行的能力分必须与名次**自洽**（2026-09-13 修用户实测「我分数比第二名还低却是第一」）──
       meRank 会随评审实际得分浮动（game_core.finish：
       `rank = heat.rank - floor((实际评分 - heat.score) / 2)`，V4 起生效），
       而 heat.score 是配置里**写死的常数** → 名次前进了、分数还停在原来那一档，
       于是渲染出「小鲸鱼 97.5 排第 1 / Aurora-X 99.2 排第 2」这种自相矛盾的榜。
       修法：分数**按名次从榜单插值** ——
         · 第 1 名 → 略高于榜首（守住"争第一"的数值观感）
         · 第 N 名（2 ≤ N ≤ 榜长）→ 落在第 N-1 名与第 N 名之间
         · 落榜（> 榜长）→ 取榜尾之下
       这样"看到的名次"和"看到的分数"永远一致，也不会再出现分数倒挂。 */
    const meScore = Math.round((r.score != null ? r.score : (r.rankScore || 0)) * 10) / 10;
    const meHeat = { rank: meRank, score: meScore };
    const rowsHtml = [];
    let inserted = false;
    board.forEach((row, i) => {
      if (meRank === i + 1) { inserted = true; rowsHtml.push(this.bonusMeRow(s, meRank, rankUpTxt, meMeta, meHeat, i)); }
      rowsHtml.push(this.bonusRankRow(row, i + 1, i + (inserted ? 1 : 0)));
    });
    if (!inserted) {
      /* 10 名外：省略行 + 己方行（带名次徽章） */
      rowsHtml.push(`<div class="rank-ellipsis" style="transition-delay:${(0.05 + board.length * 0.06).toFixed(2)}s">···</div>`);
      rowsHtml.push(this.bonusMeRow(s, meRank, rankUpTxt, meMeta, meHeat, board.length + 1));
    }
    /* 评价卡 ×3：四维最高两项好评 + 最低一项改进（doc/16 §3.4） */
    const feeds = this.bonusFeedCards(stats, beta, exc);
    /* 用户数：内测单位「人」，公测单位「万」 */
    const usersAll = s.users || 0;
    const usersShow = beta ? usersAll : Math.round(usersAll / 10000);
    const userUnit = beta ? " 人" : " 万";
    const gained = r.usersGained || 0;
    const trendPct = (first || usersAll <= gained) ? null : Math.round((gained / (usersAll - gained)) * 100);
    const trendTxt = trendPct == null ? "首批用户已入驻" : `+${Math.min(trendPct, 999)}% 较上阶段`;

    /* ---- 第三幕数据：奖金构成 chips（映射命名，不新增奖金项）----
       2026-09-05（用户要求）：品牌值变化也要在结算体现 —— 加一枚品牌 chip */
    const brandChip = b.brandAdd
      ? `<span class="break-chip">品牌值 <b>${b.brandAdd > 0 ? "+" : ""}${b.brandAdd} → ${r.brandNow != null ? r.brandNow : Math.round(s.brand || 0)}</b></span>` : "";
    const chipName = (label) => failed ? failureUI.CHIP : /品牌/.test(label) ? "品牌额外奖励" : /优秀/.test(label) ? "数值提升" : /小模型/.test(label) ? label : "基础交付";
    const chips = (b.items.map((it) =>
      `<span class="break-chip">${chipName(it.label)} <b>${it.value % 10000 === 0 ? Math.round(it.value / 10000) + " 万" : Math.round(it.value).toLocaleString("zh-CN") + " 元"}</b></span>`).join("")
      + brandChip)
      || `<span class="break-chip">本轮无额外奖金</span>`;
    const ups = (s.traitUpgrades || []).filter((u) => u && typeof u === "object" && u.name);

    /* ---- 柱状图 DOM：组内从左到右 = 从新到旧；生长顺序看 data-order（越旧越早长） ---- */
    /* [feature:v5-chart-labels] */
    const barsHtml = stats.map((st0) => {
      const history = st0.history.slice(-3);
      const prevLast = history.length ? history[history.length - 1] : null;
      const delta = prevLast != null ? st0.now - prevLast : 0;
      let mini = `<i class="mini-bar cur" data-h="${st0.now}" data-order="3" title="本阶段：${st0.now}">` +
        `<span class="bar-value">0</span>` +
        (st0.up ? `<span class="delta-chip">${this.icon("arrow-up", 10)}+${delta}</span>` : "") + `</i>`;
      history.slice().reverse().forEach((h, ri) => {
        const cls = ri === 0 ? " p3" : ri === 1 ? " p2" : "";
        mini += `<i class="mini-bar${cls}" data-h="${h}" data-order="${2 - ri}" title="历史阶段：${h}"></i>`;
      });
      return `<div class="bar-col${st0.up ? " up" : ""}">
          <div class="bar-track">${mini}</div>
          <!-- [feature:v5-chart-labels] -->
          <span class="bar-label">${st0.iconHTML || this.icon(st0.icon, 13)}${this.escHtml(st0.label)}</span>
          <!-- [/feature:v5-chart-labels] -->
        </div>`;
    }).join("");
    /* [/feature:v5-chart-labels] */

    /* 2026-09-12（用户要求）：「追加能力轴」从第三幕删除 → 改放**第一幕模型表现的侧栏**，
       与对比范围/提升项目/综合评分同款式；没轴零痕迹。达标口径沿用原胶囊（axisDef.passAt）。 */
    const axIds = this.core.v35AxisIds(s);
    const axRows = axIds.map((id, i) => {
      const d = this.core.axisDef(id, s.ver) || {};
      const v = Math.round(s[id] || 0);
      const line = d.passAt != null ? d.passAt : 0;
      const ok = line > 0 ? v >= line : v > 0;
      return `<div class="side-row ax"><span class="k">${this.axisIcon(id, 14)}${d.name || id}${line ? `<i class="ax-line">达标 ${line}</i>` : ""}</span><span class="v ${ok ? "up" : ""}">${v}${line ? " / " + line : ""}</span></div>`;
    }).join("");

    const meta = `${s.modelName || "小鲸鱼"} · ${s.ver} · ${s.paramTarget || 0}B`;
    /* ---- 第四幕数据：本次新解锁的成就（引擎在 finish() 里算好挂在 s.bonus.newAchv）----
       ⚠️ UI **零判定** —— 这里只做"读 + 按稀有度升序排"，不做任何条件判断
          （判定的唯一入口 = 引擎 checkAchievements，doc/35 §0）。
       ⚠️ 本次没有新解锁 ⇒ **整幕不出现**（幕数从 4 退回 3），不摆一张"本次无新成就"的空页。 */
    const achvCfg = c.ACHIEVEMENTS || [];
    const achvStore = this.core.achvStore ? this.core.achvStore() : null;
    /* ⚠️ 配置条目里**没有解锁时间**（`t` 只存在存储层）⇒ 必须把 store 的记录并进来，
       否则第四幕的卡显示不出"哪一天拿到的"（成就墙走 `AchieveStore.view()`，本来就带 t）。 */
    const newAchv = ((b && b.newAchv) || [])
      .map((k) => {
        const cfg = achvCfg.find((a) => a && a.key === k);
        if (!cfg) return null;
        const rec = achvStore && achvStore.get(k);
        return rec ? Object.assign({}, cfg, { t: rec.t, ver: rec.ver, week: rec.week }) : cfg;
      })
      .filter(Boolean)
      .sort((x, y) => (this.ACHV_ORDER[x.rarity] || 0) - (this.ACHV_ORDER[y.rarity] || 0));
    const hasAchv = newAchv.length > 0;
    const acts = this.REWARD_ACTS.filter((a) => a.n < 4 || hasAchv);
    this._bonusAchvList = newAchv;         // playAct4 与列表共用这一份，避免两处口径
    const steps = acts.map((a) =>
      `<span class="step-pill" data-step="${a.n}">${this.icon(a.icon, 12)}${a.label}</span>`).join("");
    /* 第三幕主按钮（阶段推进的唯一门）：
       有下一阶段 → 进入下一阶段；任务未达成 → 重训本阶段；
       末版 V4.5 通过 → **再战 V4.5**（用户 2026-09-17：通关不该是终局，要能反复刷分；
       此处原本跳「查看最终成果」终局页，现已删除）。 */
    const bonusAct = r.nextVer ? "next-stage"
      : ((r.retry || r.finalRepeat) ? "retry-stage" : "bonus-final");
    const bonusTxt = r.nextVer ? `进入 ${r.nextVer} 阶段 ➜`
      : (r.retry ? `重训 ${s.ver} 阶段 ➜`
        : (r.finalRepeat ? `再战 ${s.ver} 阶段 ➜` : "查看最终成果 ➜"));
    const nextBtn = `<button class="dg-btn dg-btn-primary bonus-next" type="button" data-action="${bonusAct}" disabled>
        ${bonusTxt}
      </button>`;
    /* 第三幕 → 第四幕的过场按钮（与第二幕 → 第三幕的写法完全同构）。
       ⚠️ 阶段推进按钮 `bonusAct` **只搬位置、不改语义** —— 它仍是唯一的推进门。 */
    const achvNextBtn = `<button class="dg-btn dg-btn-primary next-btn" type="button" data-action="bonus-next" data-step="4"><span>查看成就 ➜</span>${this.icon("medal", 15)}</button>`;
    /* 第四幕整段 HTML（只在本次有新解锁时生成；无解锁 = 空串 = 这一幕不存在） */
    const achvActHtml = !hasAchv ? "" : `
              <section class="act" id="act-4" aria-label="第四幕 成就">
                <div class="act-head">
                  <span class="pass-badge gold">${this.icon("medal", 15)}成就解锁</span>
                  <h1 class="act-title">本次新解锁成就</h1>
                  <p class="act-sub">共 ${newAchv.length} 个，按稀有度依次揭晓。</p>
                </div>
                <div class="achv-reveal" id="achvReveal">
                  <div class="achv-slot" id="achvRevealSlot"></div>
                  <div class="achv-reveal-foot">
                    <span class="achv-count" id="achvCount"></span>
                    <button class="achv-skip" type="button" data-action="achv-skip">跳过全部 ➜</button>
                  </div>
                </div>
                <div class="achv-grid" id="achvGrid" hidden></div>
                <div class="achv-pager" id="achvPager" hidden></div>
                <div class="act-foot">
                  <button class="dg-btn" type="button" data-action="bonus-replay">${this.icon("replay", 14)} 再看一遍</button>
                  ${nextBtn}
                </div>
              </section>`;
    /* 工程师成长 · 词条升级卡（2026-09-12 用户要求）：改**右侧竖列**——
       每页 3 人、多于 3 人翻页；与奖金卡左右并排，不再把第三幕竖向挤爆 */
    const PER = 3;
    if (this._upgPage == null) this._upgPage = 0;
  /* [feature:reward-content-pages-upgrade-total] */
    const upgTotal = 1; // 全部原卡留在DOM，由正文页控分组。
  /* [/feature:reward-content-pages-upgrade-total] */
    this._upgPage = Math.min(Math.max(0, this._upgPage), upgTotal - 1);
    const upgPage = this._upgPage;
  /* [feature:reward-content-pages-upgrade-source] */
    const upgSlice = ups;
  /* [/feature:reward-content-pages-upgrade-source] */
    const upgradeItem = (u, i) => {
      const eng = (s.engineers || []).find((e) => e.id === u.id);
      const av = eng ? this.engAvatar(eng) : "";
      return `<div class="upgrade-item" style="transition-delay:${(0.15 + i * 0.15).toFixed(2)}s">
          <span class="up-avatar role-${u.type || "pretrain"}">${av ? `<img src="${av}" alt="">` : (u.name || "?").charAt(0)}</span>
          <span class="up-info">
            <span class="up-name">${u.name} · ${this.ROLE_NAME[u.type] || "工程师"}</span>
            <span class="up-trait">${this.icon("star", 11)}${u.trait}</span>
          </span>
          <span class="lv-flow">
            <span class="lv-badge old">Lv.${u.from}</span>
            <span class="lv-arrow">${this.icon("arrow-right", 14)}</span>
            <span class="lv-badge new">Lv.${u.to}</span>
          </span>
        </div>`;
    };
    const upgradePanel = !ups.length ? "" : `
              <div class="upgrade-panel glass-card" id="upgradePanel">
                <h2 class="panel-title">${this.icon("medal", 15)}工程师成长 · 词条升级</h2>
                <div class="upgrade-list vertical" id="upgradeList">
                  ${upgSlice.map((u, i) => upgradeItem(u, i)).join("")}
                </div>
                ${upgTotal > 1 ? `<div class="upgrade-pager">
                  <button class="upg-btn" type="button" data-action="upg-page" data-id="-1"${upgPage <= 0 ? " disabled" : ""}>${this.icon("chevL", 13)} 上一页</button>
                  <span class="upg-pageno">${upgPage + 1} / ${upgTotal}</span>
                  <button class="upg-btn" type="button" data-action="upg-page" data-id="1"${upgPage >= upgTotal - 1 ? " disabled" : ""}>下一页 ${this.icon("chevR", 13)}</button>
                </div>` : ""}
              </div>`;


    this.el.innerHTML = `
      <div class="aqua-shell reward-page">
        <section class="aqua-stage" aria-label="奖励结算演出舞台">
          <div class="reward-shell">
            <header class="island-topbar" aria-label="顶部进度">
              <span class="island-title"><span class="dot"></span>${failed ? failureUI.BADGE : "评审通过 · 奖励结算"}</span>
              <div class="stage-steps" aria-label="结算进度">${steps}</div>
              <button class="stage-close" type="button" data-action="bonus-jump" aria-label="跳到结算">${this.icon("x", 16)}</button>
            </header>
            <div class="stage-body">

              <!-- 第一幕：本阶段模型数值（分组柱状图） -->
              <section class="act" id="act-1" aria-label="第一幕 模型数值">
                <div class="act-head">
                  <span class="pass-badge">${this.icon("badge-check", 15)}${tierBadge}</span>
                  <h1 class="act-title">本阶段模型表现</h1>
                  <p class="act-meta">${meta}</p>
                  <p class="act-sub">每项数值并列对比前 ${Math.max(1, hist.length)} 个阶段，较上一阶段提升的项目会点亮金色。</p>
                </div>
                <div class="chart-card glass-card">
                  <div class="chart-main">
                    <div class="chart-legend" aria-label="阶段图例（从新到旧）">
                      <span class="lg-item"><i class="lg-dot cur"></i>本阶段</span>
                      <span class="lg-item"><i class="lg-dot p3"></i>上一阶段</span>
                      <span class="lg-item"><i class="lg-dot p2"></i>前 2 阶段</span>
                      <span class="lg-item"><i class="lg-dot"></i>前 3 阶段</span>
                    </div>
                    <div class="bars" id="bars">${barsHtml}</div>
                  </div>
                  <aside class="chart-side">
                    <div class="side-row"><span class="k">${this.icon("git-compare", 14)}对比范围</span><span class="v">${hist.length ? "本阶段 vs 前 " + hist.length + " 阶段" : "首代模型 · 暂无历史对比"}</span></div>
                    <div class="side-row"><span class="k">${this.icon("trending-up", 14)}提升项目</span><span class="v up" id="upCount">0 项</span></div>
                    <div class="side-row"><span class="k">${this.icon("gauge", 14)}综合评分</span><span class="v" id="totalScore">0</span></div>
                    <div class="side-row"><span class="k">${this.icon("sparkles", 14)}评级</span><span class="v up">${tierLbl}</span></div>
                    ${axRows}
                  </aside>
                </div>
                <div class="act-foot">
                  <button class="dg-btn dg-btn-primary next-btn" type="button" data-action="bonus-next" data-step="2"><span>查看外网反响 ➜</span></button>
                  <span class="hint-tip">${this.icon("pointer", 12)}点击下一步，查看能力榜与用户反馈</span>
                </div>
              </section>

              <!-- 第二幕：全球模型能力榜 + 用户反馈 -->
              <section class="act" id="act-2" aria-label="第二幕 排行与反馈">
                <div class="act-head">
                  <h1 class="act-title">全球模型能力榜</h1>
                  <p class="act-sub">${beta
                    ? (first ? `「深海内测」进行中 · 首次上榜，当前排名第 ${meRank} 位，继续加油` : "「深海内测」进行中 · 榜上排名稳步上升")
                    : "模型正式上线后收获大量用户，排名快速攀升。"}</p>
                </div>
                <div class="act2-grid">
                  <div class="panel glass-card">
                    <h2 class="panel-title">${this.icon("trophy", 16)}全球模型能力榜</h2>
                    <div class="rank-list" id="rankList">${rowsHtml.join("")}</div>
                  </div>
                  <div class="panel glass-card">
                    <h2 class="panel-title">${this.icon("msg", 16)}${beta ? "「深海内测」· 用户反馈" : "外网用户反馈"}</h2>
                    ${beta ? `<span class="rank-tip">${this.icon("lock", 12)}保密测试中 · 模型未公开发布</span>` : ""}
                    <div class="user-stat">
                      <div class="stat-box">
                        <div class="num"><span id="userCount">0</span><small>${userUnit}</small></div>
                        <div class="lbl">${beta ? "内测用户" : "累计用户"}</div>
                        <div class="trend">${this.icon("trending-up", 11)} ${trendTxt}</div>
                      </div>
                      <div class="stat-box">
                        <div class="num"><span id="ratingVal">0</span><small> 分</small></div>
                        <div class="lbl">用户平均评分</div>
                        <div class="trend">${this.icon("star", 11)} 好评率 ${r.praiseRate || 90}%</div>
                      </div>
                    </div>
                    <div class="feed-list" id="feedList">${feeds}</div>
                  </div>
                </div>
                <div class="act-foot">
                  <button class="dg-btn dg-btn-primary next-btn" type="button" data-action="bonus-next" data-step="3"><span>结算</span>${this.icon("coins", 15)}</button>
                </div>
              </section>

              <!-- 第三幕：总奖金揭晓 + 工程师成长 -->
              <section class="act" id="act-3" aria-label="第三幕 总奖金">
                <div class="act-head">
                  <span class="pass-badge gold">${this.icon("crown", 15)}${failed ? failureUI.BADGE : exc ? "阶段大成功" : "评审通过"}</span>
                  <h1 class="act-title">本次结算总奖金</h1>
                  <p class="act-meta">${meta}</p>
                  <p class="act-sub">${failed ? this.escHtml(failureUI.DESCRIPTION) : "综合模型表现、排名上升与用户增长，奖励已到账。"}</p>
                </div>
                <div class="act3-grid">
                  <div class="bonus-card glass-card" id="bonusCard">
                    <span class="bonus-label">${this.icon("wallet", 14)}${failed ? failureUI.BONUS_LABEL : "研发奖金已发放"}</span>
                    <div class="bonus-amount"><span class="cur">¥</span><span id="bonusNum">0</span><span class="cur"> 万</span></div>
                    <div class="bonus-break">${chips}</div>
                    ${failed ? "" : this.brandBenefitHTML(b.brandBenefit || r.brandBenefit)}
                    <div class="bonus-fund">账上经费 <b>${fmtMoney(s.funding || 0)}</b></div>
                  </div>
                  ${upgradePanel}
                </div>
                <div class="act-foot">
                  <button class="dg-btn" type="button" data-action="bonus-replay">${this.icon("replay", 14)} 再看一遍</button>
                  ${this.rankEntryBtn()}
                  ${hasAchv ? achvNextBtn : nextBtn}
                </div>
              </section>
              ${achvActHtml}

            </div>
          </div>
        </section>
      </div>`;
  /* [feature:review-stage-budget-bonus] */
    // Future stage funding stays separate from the review reward already paid.
    const funds = this.el.querySelector('.bonus-fund');
    if (funds) funds.outerHTML = this.settlementFundsHTML(r);
  /* [/feature:review-stage-budget-bonus] */
  /* [feature:reward-content-pages-mount] */
    this.mountRewardPages();
    console.log("[奖励演出] 渲染完成，从第", s.bonusAct || 1, "幕开始（共", acts.length, "幕）");
  /* [/feature:reward-content-pages-mount] */
    this.rewardGoTo(Math.min(acts.length, Math.max(1, s.bonusAct || 1)));
  },

  /* 榜单行 / 己方行（第二幕） */
  /* ⚠️ 2026-09-13 重设计：原来那个 bonusMeScore()「按名次从榜单插值」的补丁已删除 ——
     榜单分取消后，己方行显示的就是评审分，名次也由同一个分数算出 ⇒ 不可能再出现分数倒挂。 */
  bonusRankRow(row, no, i) {
    return `<div class="rank-row" style="transition-delay:${(0.05 + i * 0.06).toFixed(2)}s">
        <span class="rank-no">${no}</span>
        <span><span class="rank-name">${row.name}</span><div class="rank-meta">${row.meta}</div></span>
        <span class="rank-score">${Math.round(row.score || 0)}</span>
      </div>`;
  },
  bonusMeRow(s, meRank, rankUpTxt, meMeta, heat, i) {
    return `<div class="rank-row me" style="transition-delay:${(0.05 + i * 0.06).toFixed(2)}s">
        <span class="rank-no">${meRank}</span>
        <span><span class="rank-name">${s.modelName || "小鲸鱼"} · ${s.ver}<span class="rank-up">${this.icon("arrow-up-right", 10)}${rankUpTxt}</span></span><div class="rank-meta">${meMeta}</div></span>
        <span class="rank-score">${Math.round(heat.score || 0)}</span>
      </div>`;
  },
  /* 评价卡 ×3：好评取四维最高两项、改进取最低一项；星级按时代与评审结果（doc/16 §3.4） */
  bonusFeedCards(stats, beta, exc) {
    const fb = this.core.cfg.USER_FEEDBACK || {};
    const generic = fb.generic || [];
    const pick = (arr) => {
      if (arr && arr.length) return arr[Math.floor(Math.random() * arr.length)];
      return generic.length ? generic[Math.floor(Math.random() * generic.length)] : { n: "匿名用户", t: "期待下一个版本。" };
    };
    const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
    const byNow = stats.slice().sort((a, b2) => b2.now - a.now);
    const cards = [];
    [byNow[0], byNow[1]].filter(Boolean).forEach((d, i) => {
      const star = beta ? (Math.random() < 0.3 ? 3 : 4) : (exc ? 5 : 4);
      cards.push({ f: pick((fb.praise || {})[d.key]), star, delay: 0.15 + i * 0.15 });
    });
    const worst = byNow.length ? byNow[byNow.length - 1].key : "code";
    cards.push({ f: pick((fb.improve || {})[worst]), star: beta ? (Math.random() < 0.5 ? 1 : 2) : (Math.random() < 0.5 ? 2 : 3), delay: 0.45 });
    return cards.map((cd) =>
      `<div class="feed-card" style="transition-delay:${cd.delay.toFixed(2)}s">
        <span class="feed-avatar">${(cd.f.n || "?").charAt(0)}</span>
        <span><span class="feed-name">${beta ? "【内测】" : ""}${cd.f.n}</span><span class="feed-stars">${stars(cd.star)}</span>
        <div class="feed-text">${cd.f.t}</div></span>
      </div>`).join("");
  },

  /* ---------------- 幕状态机（幕数**动态**：本次无成就解锁就只有 3 幕） ---------------- */
  /* 当前这次结算一共几幕。⚠️ 唯一判据 = s.bonus.newAchv 有没有内容（与 renderBonus 同源）。 */
  bonusLastAct() {
    const b = (this.core.state || {}).bonus || {};
    return ((b.newAchv || []).length) ? 4 : 3;
  },
  rewardGoTo(n) {
    const s = this.core.state;
    const last = this.bonusLastAct();
    /* ⚠️ `s.bonusAct` 是**存档字段**：幕数变成动态之后，旧档里存着的 4 有可能对应
       "这一次其实没有第四幕" ⇒ 读进来必须夹值，否则会停在一个不存在的幕上（白屏）。 */
    n = Math.min(Math.max(1, Number(n) || 1), last);
    s.bonusAct = n;                                   // 读档重进结算页从当前幕恢复
    console.log("[奖励演出] 切换到第", n, "幕（共", last, "幕）");
    for (let k = 1; k <= last; k++) {
      const el = this.el.querySelector("#act-" + k);
      if (!el) continue;
      if (k === n) {
        el.classList.remove("leaving");
        el.classList.add("active");
      } else if (el.classList.contains("active")) {
        el.classList.remove("active");
        el.classList.add("leaving");
        this.bonusLater(() => el.classList.remove("leaving"), 600);
      }
    }
    this.el.querySelectorAll(".step-pill").forEach((p) => {
      const sn = Number(p.dataset.step);
      p.classList.toggle("active", sn === n);
      p.classList.toggle("done", sn < n);
    });
    if (n === 1) this.playAct1();
    else if (n === 2) this.playAct2();
    else if (n === 3) this.playAct3();
  /* [feature:reward-content-pages-switch] */
    else if (n === 4) this.playAct4();
    const pages=this._rewardPages&&this._rewardPages.stages.get(n);if(pages)pages.layout();
  /* [/feature:reward-content-pages-switch] */
  },

  /* 第一幕：组间错峰 200ms、组内按 data-order 120ms 接力生长（本阶段最后长）+ 数值计数 */
  playAct1() {
    if (this._bonusPlayed[1]) return;
    this._bonusPlayed[1] = true;
    console.log("[奖励演出] 第一幕开始：分组柱状图生长");
    const r = this.core.state.result || {};
    const cols = this.el.querySelectorAll("#bars .bar-col");
    let upN = 0;
    /* 2026-09-12（用户反馈「Y 轴达到上限拉不开高低差」）：柱高原来 = 原始值直接当百分比
       （值 ≥100 全部顶满），改为按本图最大值归一 + 8% 顶部余量 → 高低差拉得开 */
    let scaleMax = 0;
    cols.forEach((col) => col.querySelectorAll(".mini-bar").forEach((b) => {
      scaleMax = Math.max(scaleMax, parseInt(b.dataset.h, 10) || 0);
    }));
    scaleMax = Math.max(1, scaleMax * 1.08);
    cols.forEach((col, i) => {
      const minis = col.querySelectorAll(".mini-bar");
      const valEl = col.querySelector(".bar-value");
      /* 本阶段柱：DOM 里 cur 在最前（组内从左到右 = 从新到旧），
         不能取 minis[minis.length-1]（那是 demo 原代码的笔误，会取到最旧的历史柱） */
      const curBar = col.querySelector(".mini-bar.cur");
      if (!curBar) return;
      const target = parseInt(curBar.dataset.h, 10) || 0;
      const isUp = col.classList.contains("up");
      if (isUp) upN++;
      const groupStart = 250 + i * 200;
      minis.forEach((bar) => {
        const v = parseInt(bar.dataset.h, 10) || 0;
        const h = Math.min(100, (v / scaleMax) * 100);
        const order = parseInt(bar.dataset.order || "0", 10);
        this.bonusLater(() => { bar.style.height = h + "%"; }, groupStart + order * 120);
      });
      this.bonusLater(() => {
        valEl.style.opacity = "1";
        valEl.style.transform = "translateX(-50%) translateY(0)";
        this.bonusCountUp(valEl, target, 900);
        if (window.SFX) SFX.play(isUp ? "float" : "click", { vol: 0.22 });
      }, groupStart + 3 * 120 + 120);
    });
    this.bonusLater(() => {
      const uc = this.el.querySelector("#upCount");
      if (uc) uc.textContent = upN + " 项";
      this.bonusCountUp(this.el.querySelector("#totalScore"), Math.round(r.score || 0), 1000);
      console.log("[奖励演出] 提升项目", upN, "项，综合评分", r.score);
    }, 250 + cols.length * 200 + 700);
  },

  /* 第二幕：定位动画（滚到己方模型 + 高亮脉冲）+ 用户数/评分滚动（榜单与评价卡入场为纯 CSS 错峰） */
  playAct2() {
    if (this._bonusPlayed[2]) return;
    this._bonusPlayed[2] = true;
    console.log("[奖励演出] 第二幕开始：排行与用户反馈");
    const s = this.core.state;
    const beta = this.core.isBeta(s.ver);
    const usersAll = s.users || 0;
    this.bonusCountUp(this.el.querySelector("#userCount"), beta ? usersAll : Math.round(usersAll / 10000), 1400);
    this.bonusCountUp(this.el.querySelector("#ratingVal"), (s.result || {}).userRating || 0, 1400, { decimals: 1 });
    /* 定位到我们自己（2026-09-05 用户需求二改）：**从榜单顶部平滑下滑**到己方行
       （rAF 缓动，1.4s easeInOutCubic），滚动到位后再亮一圈脉冲——
       之前直接跳到末尾很突兀；rAF 序号 token 防重播时旧动画抢位。 */
    this.bonusLater(() => {
      const me = this.el.querySelector("#rankList .rank-row.me");
      const list = me && me.parentElement;
      if (!list) return;
  /* [feature:reward-content-pages-locate] */
      const pages=this._rewardPages&&this._rewardPages.stages.get(2);if(pages){const i=pages.views.findIndex(v=>v.units.some(u=>u.includes(me)));if(i>=0&&s.bonusAct===2){pages.show(i);me.classList.add("locating");this.bonusLater(()=>me.classList.remove("locating"),1800);}return;}
      const target = Math.max(0, me.offsetTop - (list.clientHeight - me.offsetHeight) / 2);
  /* [/feature:reward-content-pages-locate] */
      const from = list.scrollTop, dist = target - from;
      if (dist <= 0) { me.classList.add("locating"); this.bonusLater(() => me.classList.remove("locating"), 1800); return; }
      const token = (this._rankScrollToken = (this._rankScrollToken || 0) + 1);
      const DUR = 1400, t0 = performance.now();
      const step = (t) => {
        if (token !== this._rankScrollToken) return;                 // 重播/重建 → 旧动画作废
        const k = Math.min(1, (t - t0) / DUR);
        const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // easeInOutCubic
        list.scrollTop = from + dist * ease;
        if (k < 1) requestAnimationFrame(step);
        else { me.classList.add("locating"); this.bonusLater(() => me.classList.remove("locating"), 1800); }
      };
      requestAnimationFrame(step);
    }, 900);   // 等入场错峰滑入结束后再定位
  },

  /* 第三幕：卡片内金币+彩纸两波喷发（demo spawnParticles 原生）+ 奖金滚动 */
  playAct3() {
    if (this._bonusPlayed[3]) return;
    this._bonusPlayed[3] = true;
    console.log("[奖励演出] 第三幕开始：总奖金揭晓");
    const card = this.el.querySelector("#bonusCard");
    const total = (((this.core.state.bonus || {}).total || 0) / 10000);
    this.bonusLater(() => {
      if (!card) return;
      this.spawnBonusParticles(card);
      this.bonusLater(() => { if (card.isConnected) this.spawnBonusParticles(card); }, 500);
    }, 350);
    this.bonusCountUp(this.el.querySelector("#bonusNum"), total, 1600, {
      done: () => {
        if (window.SFX) SFX.play("fanfare");
        this.readyBonusBtn();
      },
    });
    if (!total) this.readyBonusBtn();
  },
  spawnBonusParticles(card) {
    const colors = ["#4fb7ee", "#f2b84b", "#53b98d", "#e66b7a", "#7fd0f6", "#ffd98a"];
    /* jsdom / 无 rAF 环境（UI 回归测试）下用 setTimeout 兜底，粒子照常生成 */
    const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
    for (let i = 0; i < 28; i++) {
      const isCoin = i % 3 === 0;
      const p = document.createElement("span");
      p.className = isCoin ? "coin" : "confetti";
      if (!isCoin) p.style.background = colors[i % colors.length];
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const dur = 1.6 + Math.random() * 1.2;
      const drift = (Math.random() * 120 - 60) + "px";
      p.style.left = left + "%";
      p.style.transition = "transform " + dur + "s cubic-bezier(.22,1,.36,1) " + delay + "s," +
                           "opacity " + dur + "s ease " + delay + "s";
      card.appendChild(p);
      raf(() => {
        p.style.opacity = "1";
        p.style.transform = "translate(" + drift + ", 320px) rotate(" + (Math.random() * 540 - 270) + "deg)";
      });
      setTimeout(() => p.remove(), (dur + delay) * 1000 + 300);
    }
    console.log("[奖励演出] 粒子喷发完成");
  },

  /* ================================================================
     第四幕 · 成就（2026-09-16 · doc/35 §4.2）
     ----------------------------------------------------------------
     两个阶段：A 逐个弹卡（本方法）→ B 收成解锁列表（achvShowGrid）。
     ⚠️ 三层动画必须挂在**三个不同元素**上（卡体 badgePop / 扩散环 .achv-halo / 粒子 .achv-dust）——
       `animation` 是简写属性，一个元素只能拥有一组，挂在一起会互相冲掉（静默失效）。
     ⚠️ 阶段 A 期间页脚主按钮保持 disabled：它是阶段推进的**唯一门**，被误点会跳过整场演出。
     ================================================================ */
  playAct4() {
    if (this._bonusPlayed[4]) return;
    this._bonusPlayed[4] = true;
    const list = this._bonusAchvList || [];
    if (!list.length) { this.achvShowGrid(); return; }
    const R = this.ACHV_REVEAL;
    const hold = list.length > R.MANY_AT ? R.HOLD_MANY : R.HOLD;   // 张数多 → 压短停留
    this._achvIdx = 0;
    this._achvSkipped = false;
    console.log("[奖励演出] 第四幕开始：逐个弹卡", list.length, "张，单张", R.IN + hold + R.OUT, "ms");
    const slot = this.el.querySelector("#achvRevealSlot");
    const cnt = this.el.querySelector("#achvCount");
    const step = () => {
      if (!slot || !slot.isConnected) return;
      if (this._achvSkipped || this._achvIdx >= list.length) { this.achvShowGrid(); return; }
      const item = list[this._achvIdx];
      /* 整块重建 = 卡片重新挂载 ⇒ badgePop 会重播（光切 hidden 不会重播） */
      slot.innerHTML = this.achvCardHtml(item, false);
      const card = slot.querySelector(".achv-card");
      if (card) { void card.offsetWidth; card.classList.add("in"); }
      if (cnt) cnt.textContent = "第 " + (this._achvIdx + 1) + " / " + list.length + " 个";
      if (window.SFX) SFX.play("float", { vol: 0.25 });
      this._achvIdx += 1;
      this.bonusLater(step, R.IN + hold + R.OUT);
    };
    this.bonusLater(step, 260);
  },
  /* 「跳过全部」：立刻收成列表（并解禁页脚主按钮） */
  achvSkipAll() {
    if (this._achvSkipped) return;
    this._achvSkipped = true;
    this.clearBonusTimers();               // 掐掉还没跑的弹卡节拍，免得它又把弹卡铺回来
    this.achvShowGrid();
  },
  /* 阶段 B：把本次新解锁的成就收成网格列表，并**点亮页脚主按钮**
     （每页 6 张 = 3 列 × 2 行 + 翻页；照第三幕「词条升级」的 upg-page 套路） */
  achvShowGrid() {
    const rev = this.el.querySelector("#achvReveal");
    const grid = this.el.querySelector("#achvGrid");
    if (rev) rev.hidden = true;
    if (!grid) return;
    this._achvPage = 0;
    this.achvRenderPage();
    grid.hidden = false;
    this.readyBonusBtn();
  },
  /* 只换列表 DOM，不重播整幕（与第三幕 upg-page 同款） */
  achvRenderPage() {
    const grid = this.el.querySelector("#achvGrid");
    const pager = this.el.querySelector("#achvPager");
    if (!grid) return;
    const list = this._bonusAchvList || [];
    const PER = this.achvPerPage();     /* 竖屏 1 张 / 桌面 4 张 —— 与 style.css 的竖屏媒体查询同条件 */
    const total = Math.max(1, Math.ceil(list.length / PER));
    this._achvPage = Math.min(Math.max(0, this._achvPage || 0), total - 1);
    const page = this._achvPage;
    grid.innerHTML = list.slice(page * PER, page * PER + PER)
      .map((a) => this.achvCardHtml(a, true)).join("");
    grid.querySelectorAll(".achv-card").forEach((n, i) => {
      n.style.transitionDelay = (0.04 + i * 0.05).toFixed(2) + "s";
      n.classList.add("in");
    });
    if (pager) {
      pager.hidden = total <= 1;
      pager.innerHTML = total <= 1 ? "" :
        `<button class="upg-btn" type="button" data-action="achv-page" data-id="-1"${page <= 0 ? " disabled" : ""}>${this.icon("chevL", 13)} 上一页</button>
         <span class="upg-pageno">${page + 1} / ${total}</span>
         <button class="upg-btn" type="button" data-action="achv-page" data-id="1"${page >= total - 1 ? " disabled" : ""}>下一页 ${this.icon("chevR", 13)}</button>`;
    }
    if (window.SFX) SFX.play("confirm", { vol: 0.3 });
  },
  /* 成就卡 HTML（弹卡 / 解锁列表 / 主界面成就墙共用）
     `compact` = 不带辉光/环/粒子；`opts.locked` = 渲染成**未解锁（灰烬）态**（主界面成就墙用）。
     ------------------------------------------------------------------
     ⚠️ 结构**照抄模型库的卡牌语言**（2026-09-16 二改，用户：「换成模型库同款样式」）：
       .achv-wrap   ← 定位容器 + 承载稀有度变量
         ├ .achv-glow / .achv-halo ×2 / .achv-dust   ← 装饰（仅弹卡）
         └ .achv-card        ← **饰边层**：稀有度底色 + 双向花纹 + 描边（≡ .cdx-card）
             └ .achv-inner   ← **白色内卡**：图标 / 名字 / 品质徽章 / 描述 / 元信息（≡ .cdx-card-inner）
     竖版比例（`aspect-ratio: 3 / 4.2`）—— 用户明确否掉了"扁平长方形"。
     ⚠️ 三层动效必须挂在**三个不同元素**上：`animation` 是简写属性，一个元素只能拥有一组。
     ⚠️ `locked` 时稀有度色整档换成 `__locked`（灰）—— 但不能把真稀有度写进 DOM：
        未解锁的隐藏成就连稀有度都不该露（`AchieveStore.view()` 已脱敏，这里再兜一层）。 */
  achvCardHtml(a, compact, opts) {
    if (!a) return "";
    const locked = !!(opts && opts.locked);
    const rar = locked ? this.ACHV_RARITY["__locked"] : this.achvRarity(a.rarity);
    /* 图标：配置项 `icon` 优先，留空 → 按稀有度取默认（用户要求"先自己画，后面可配置改"） */
    const iconName = locked ? rar.icon : (a.icon || rar.icon || "medal");
    const art = (!locked && a.img)
      ? `<img src="${this.escAttr(a.img)}" alt="${this.escAttr(a.imgAlt || a.name || "")}" loading="lazy" onerror="this.parentNode.classList.add('art-missing')">`
      : `<span class="achv-glyph" aria-hidden="true">${this.achvIcon(iconName, compact ? 66 : 92)}</span>`;
    const meta = [];
    if (!locked) {
      /* 解锁时间走**现实时间**（`achvTimeText`），不再显示"第 N 周"的游戏内刻度 */
      const when = this.achvTimeText(a.t);
      if (a.ver) meta.push(this.escHtml(a.ver));
      if (when) meta.push(this.escHtml(when));
      else if (a.cat) meta.push(this.escHtml(a.cat) + " 类");
    }
    const vd = locked ? "未解锁" : (a.rarity || "");
    let deco = "";
    if (!compact) {
      deco += `<i class="achv-glow" aria-hidden="true"></i>`;
      /* 扩散环：层数按稀有度（2 层 / 3 层）—— 强度靠**层数与透明度**表达，不靠更大的半径 */
      for (let i = 0; i < (rar.rings || 0); i++) {
        deco += `<i class="achv-halo hl-${i === 0 ? "a" : "b"}" aria-hidden="true"></i>`;
      }
      /* 尘埃粒子：数量按稀有度；每颗的尺寸/漂移/时长/相位由 CSS 的 nth-child 静态表给
         （**不用 JS 随机** —— 否则同一张卡每次重播都不一样，玩家会当成抖动） */
      if (rar.dust) {
        const n = Math.min(rar.dust, this.ACHV_REVEAL.DUST_MAX);
        let dust = "";
        for (let i = 1; i <= n; i++) dust += "<i></i>";
        deco += `<i class="achv-dust" aria-hidden="true" data-particles="${n}">${dust}</i>`;
      }
    }
    return `<div class="achv-wrap ${rar.cls}${compact ? " compact" : ""}${locked ? " is-locked" : ""}" data-key="${this.escAttr(a.key || "")}" data-rarity="${this.escAttr(locked ? "" : (a.rarity || ""))}">
        ${deco}
        <div class="achv-card">
          <div class="achv-inner">
            <div class="achv-art">${art}</div>
            <div class="achv-name">${this.escHtml(a.name || "")}</div>
            <div class="achv-vd">${this.escHtml(vd)}</div>
            <div class="achv-desc">${this.escHtml(this.tpl(a.desc || ""))}</div>
            <div class="achv-meta">${meta.join(" · ")}</div>
          </div>
        </div>
      </div>`;
  },

  /* 「再看一遍」：清演出标志 + 柱高/数字归零，从第一幕重播 */
  rewardReplay() {
    console.log("[奖励演出] 重播第一幕");
    this._bonusPlayed = {};
    /* 第四幕的演出状态也要一起复位，否则重播到第四幕会直接落在列表上 */
    this._achvIdx = 0;
    this._achvSkipped = false;
    const rev = this.el.querySelector("#achvReveal");
    const grid = this.el.querySelector("#achvGrid");
    if (rev) rev.hidden = false;
    if (grid) { grid.hidden = true; grid.innerHTML = ""; }
    this.el.querySelectorAll("#bars .mini-bar").forEach((b) => { b.style.height = "0%"; });
    this.el.querySelectorAll("#bars .bar-value").forEach((v) => {
      v.textContent = "0";
      v.style.opacity = "0";
      v.style.transform = "translateX(-50%) translateY(8px)";
    });
    const uc = this.el.querySelector("#upCount");
    if (uc) uc.textContent = "0 项";
    const ts = this.el.querySelector("#totalScore");
    if (ts) ts.textContent = "0";
    const bn = this.el.querySelector("#bonusNum");
    if (bn) bn.textContent = "0";
    const btn = this.el.querySelector(".bonus-next");
    if (btn) btn.disabled = true;
    this.rewardGoTo(1);
  },

  /* 演出播完 → 底部按钮点亮（避免玩家在动画中途误点跳过） */
  readyBonusBtn() {
    const btn = this.el && this.el.querySelector(".bonus-next");
    if (!btn || !btn.disabled) return;
    btn.disabled = false;
    btn.classList.add("ready");
    if (window.SFX) SFX.play("click");
  },

  /* ---------------- 事件委托 ---------------- */
  /* pointerup / touchend 共用的「80ms 补发」判定（2026-09-16 从 pointerup 内联回调抽出）
     2026-09-23 修两个竞态（玩家：快速连点后按钮"卡死"/动作重复执行）：
       ① 目标要在**调度时**捕获 —— 旧代码在定时器回调里才读 this._pressTarget，
          快速连点时读到的已经是**下一个人**按的节点；
       ② 补发前核对 _pressSeq —— 调度后又发生了更新的按压，说明玩家的意图已经
          转移到新目标，这次旧补发必须作废（否则点 A 的补发落在 B 上）。 */
  _pressUpCheck(x, y) {
    const t = this._pressTarget;
    if (!t) return;
    if (Math.abs(x - (this._pressX || x)) > 8
      || Math.abs(y - (this._pressY || y)) > 8) { this._pressTarget = null; return; }
    if (!(t.closest && t.closest("[data-action]"))) { this._pressTarget = null; return; }
    const seq = this._pressSeq || 0;
    const tg0 = t;                       // 调度时捕获，回调里不再读共享字段
    this._clickHandled = false;
    setTimeout(() => {
      if (this._clickHandled) return;    // 正常的 click 已经处理过了
      if ((this._pressSeq || 0) !== seq) return;   // 期间有更新的按压 ⇒ 这次补发作废
      this._pressTarget = null;
      if (tg0) this.onClick({ target: tg0, clientX: this._pressUpX, clientY: this._pressUpY });
    }, 80);
  },

  onClick(e) {
    this._clickHandled = true;    // 告诉 pointerup 兜底：这次点击已经被正常处理了
    /* 词条说明气泡：data-tip 元素（无 data-action）点击/长按弹出（移动端点按；桌面端 title 悬停） */
    const tipEl = e.target.closest("[data-tip]");
    if (tipEl && !tipEl.closest("[data-action]")) {
      const tipText = tipEl.dataset.tip || tipEl.title || "";
      if (tipText) this.toggleTip(e.clientX, e.clientY, tipText);
      return;
    }
    /* 2026-09-12（用户实测「点翻页却触发辞退 / 点红框位置触发安排」）：
       click 的 target 是「按下与松开的共同祖先」—— 面板在这中间重建过（tick / 换人 / 自适应缩放），
       就变成卡片本身（无 data-action，点了没反应）甚至另一个按钮（误触发）。
       兜底：click 找不到动作目标时，回落到**按下的那一刻**的那个 [data-action]。
       2026-09-16（用户反馈「立项参数 34B / 存档删除按钮有时候点不动」）——
       原兜底有一条失效链：按下的是按钮 A → 每 tick 重建把 A 换成新节点 → 浏览器把 click
       派发到共同祖先 → _pressTarget(A) 已断开，旧 `isConnected` 检查拒绝它 → 本次 onClick
       又把 _clickHandled 置 true，80ms 补发被跳过 → 整条兜底链全灭 = 「点了没反应」。
       修（三环兜底，全部按 2026-09-12「防误触发」的口径收敛）：
       ① elementFromPoint 落点命中：重建后同位置必有同款新按钮，**action + data-id 都相同
          才认**（列表项被替换成别人时不误触发）；
       ② 按压目标重放（去掉 isConnected 限制）：旧节点的 dataset 仍可读，重放语义安全
          （core 侧对失效 id 全部 fail-safe）；
       ③ 老设备无按压记录时（touchstart 兜底也失效的极端情况）信落点命中。 */
    let t = e.target.closest("[data-action]");
    if (!t) {
      const cx = (e.clientX != null && !isNaN(e.clientX)) ? e.clientX : this._pressUpX;
      const cy = (e.clientY != null && !isNaN(e.clientY)) ? e.clientY : this._pressUpY;
      if (cx != null && !isNaN(cx)) {
        const el = document.elementFromPoint ? document.elementFromPoint(cx, cy) : null;
        const cand = el && el.closest ? el.closest("[data-action]") : null;
        const pt = this._pressTarget;
        const ptAct = pt && pt.closest ? pt.closest("[data-action]") : null;
        if (ptAct) {
          if (cand && cand !== ptAct
            && cand.dataset.action === ptAct.dataset.action
            && (cand.dataset.id || "") === (ptAct.dataset.id || "")) t = cand;
        } else if (cand) {
          t = cand;
        }
      }
      if (!t && this._pressTarget) {
        t = this._pressTarget.closest ? this._pressTarget.closest("[data-action]") : null;
      }
    }
    this._pressTarget = null;
    if (!t) return;
    this.hideTip();
    const act = t.dataset.action;
    const s = this.core.state;
    // 全局点击反馈音（决策类 confirm / 其余 click）
    if (window.SFX) SFX.play(this.CLICK_SFX_HEAVY[act] ? "confirm" : "click");
    switch (act) {
      /* ---- Toy 云存档 / 排行榜（2026-09-17）----
         注意：榜单弹层内部的按钮走 onRankClick 自己的委托（弹层挂在 body 上，
         不在 this.el 里，收不到这里的 onClick）。这里只处理「局内触发入口」与
         「存档弹窗内的云端按钮」这两类。 */
      case "open-rank":
        this.openRank();
        break;
      case "cloud-upload":
        this.cloudUploadNow();
        break;
      case "cloud-restore":
        this.cloudRestore();
        break;
      case "cloud-forget":
        this.askConfirm("删除云端存档",
          "将删除本账号在当前 Toy 下的云端存档。本机存档不受影响，但之后换设备无法再恢复。",
          () => this.cloudForget(), { okText: "删除", danger: true });
        break;
      /* ---- 开局命名（2026-09-22 起：只能从预设里挑，不能再自定义打字）----
         选中即写 state.modelName 再 soft render —— 选中态必须落在 state 上，
         本页每次重渲染都是整页重建（详见 renderNaming 的注释）。
         ⚠️ 这里**不播 SFX**：onClick 开头已对所有 data-action 统一播过点击音。 */
/* [feature:naming-pages-navigation-20261013] */
      case "name-page":
        this._namePage=(this._namePage||0)+(Number(t.dataset.step)||0);
        this.render({soft:true});
        break;
      case "name-pick":
/* [/feature:naming-pages-navigation-20261013] */
        this.core.setModelName(t.dataset.name || "");
        this.render({ soft: true });
        break;
      case "name-random": {
        const all = this.core.cfg.MODEL_NAME_SUGGEST || [];
        /* 排除当前选中的那个，保证点一次就换一个；池里只有一个名字时退化成选它自己 */
        const others = all.filter((n) => n !== this.core.state.modelName);
        const src = others.length ? others : all;
/* [feature:naming-pages-random-20261013] */
        if (src.length) this.core.setModelName(src[Math.floor(Math.random() * src.length)]);
        this._namePage=Math.floor(Math.max(0,all.indexOf(this.core.state.modelName))/this.namingPerPage());
/* [/feature:naming-pages-random-20261013] */
        this.render({ soft: true });
        break;
      }
      case "name-confirm":
        this.core.startProject(this.core.state.modelName);
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      case "cand-prev":
        if (this._candPage > 0) { this._candPage--; this.render({ soft: true }); }
        else this.candPeek(e.target, -1);   // 点不动时缓动提示
        break;
      case "cand-next":
        if (this._candPage < this._candPages - 1) { this._candPage++; this.render({ soft: true }); }
        else this.candPeek(e.target, 1);    // 点不动时缓动提示
        break;
      case "hire":
        {
          /* 2026-09-12：hire 可能返回 {ok:false, tip}（座位满等），两种返回都要正确处理 */
          const hr = this.core.hire(t.dataset.id);
          const okHire = hr === true || (hr && hr.ok === true);
          if (okHire) { this.core.snapshot(); this.save.autoSave(s); this.render({ soft: true }); }
          else this.toast((hr && hr.tip) || "无法录用");
        }
        break;
      /* ================= 办公室主界面（2026-08-30 新 UI）================= */
      case "office-modal": {
        const key = t.dataset.id;
        const s2 = this.core.state;
        s2.officeModal = s2.officeModal === key ? null : key;
        if (s2.officeModal === "recruit") this._recruitPick = (s2.candidates[0] || {}).id;
        if (s2.officeModal === "test") this.omTestOpen();
        /* 每次点开「团队」都回到团队总览面板（用户要求：不能停在某个人的详情页打不开总览） */
        if (s2.officeModal === "team") { this._teamMode = "overview"; this._teamPick = null; this._teamPage = 0; }
        if (window.SFX) SFX.play("click");
        this.render({ soft: true });
        break;
      }
      case "office-modal-close":
        this.core.state.officeModal = null;
        if (window.SFX) SFX.play("click");
        this.render({ soft: true });
        break;
      /* 新闻页点赞（2026-09-03）：只重渲染信息流，不动热榜
         2026-09-07 修「点赞闪一下」：原来整条 feed innerHTML 重建 → 所有 .nw-post 重播
         nwSlideIn 入场动画 + 头像 <img> 重建，肉眼看就是整页闪。改为**就地更新**被点的
         那个按钮（图标 + 计数 + .on），DOM 完全不动 —— 滚动位置/评论展开态天然保住。 */
      case "nw-like": {
        const nid = t.dataset.id;
        const s3 = this.core.state;
        s3.newsLiked = s3.newsLiked || {};
        const on = !s3.newsLiked[nid];
        s3.newsLiked[nid] = on;
        if (window.SFX) SFX.play("click");
        const nObj = (s3.newsFeed || []).find((n) => n.id === nid);
        const st3 = this.newsStats(nObj || { id: nid }, this._newsTick || 0);
        t.classList.toggle("on", on);
        t.textContent = (on ? "❤️" : "🤍") + " 点赞 " + this.fmtWan(st3.likes);
        break;
      }
      case "nw-img": {
        /* 点新闻配图 → 全屏看原图（2026-09-13 用户要求）。不重渲染信息流，只切放大层。 */
        this.openNewsImg(t.dataset.src);
        break;
      }
      case "nw-cmt": {
        /* 展开同事评论区（2026-09-05 新设计点）：只切换当前条目的展开态，不重渲染 */
        const post = t.closest(".nw-post");
        if (!post) break;
        const box = post.querySelector(".nw-cmts");
        if (box) box.hidden = !box.hidden;
        t.classList.toggle("on", !box.hidden);
        break;
      }
      case "office-pause": {
        /* [feature:v2b-pause-manual] */
        if (window.OfficePause) OfficePause.toggleManual(this.core);
        else this.core.state.officePaused = !this.core.state.officePaused;
        /* [/feature:v2b-pause-manual] */
        if (window.SFX) SFX.play("click");
        this.render({ soft: true });
        break;
      }
      /* [feature:portrait-guide-line-click] */
      case "guide-page": {
        this._guideLinePage = 0; this._guideIdx = parseInt(t.dataset.guidePage, 10) || 0;
        if (window.SFX) SFX.play("click");
        this.render({ soft: true });
        const hovered=this._pointerInCard;
        this._pointerInCard=false;this._fitAt=0;
        try { this.fitModalBody(); } finally { this._pointerInCard=hovered; }
        break;
      }
      case "guide-line-page": {
        const page = Number(t.dataset.guideLinePage);
        if (!Number.isInteger(page) || page < 0) break;
        this._guideLinePage = page;
        this.render({soft:true});
        const hovered=this._pointerInCard;
        this._pointerInCard=false;this._fitAt=0;
        try { this.fitModalBody(); } finally { this._pointerInCard=hovered; }
        break;
      }
      /* [/feature:portrait-guide-line-click] */
      case "collect-all": {
        const r = this.core.collectAll();
        if (!r.ok) { this.toast(r.tip || "还没有可收的产出"); break; }
        const gainTxt = this.modelDims(s)
          .filter((d) => r.results.some((x) => this.modelValue(d.key,x.inc) > 0))
          .map((d) => d.label + " +" + Math.round(r.results.reduce((a, x) => a + this.modelValue(d.key,x.inc), 0)))
          .join("、");
        this.toast("📦 收了 " + r.total + " 点产出：" + gainTxt);
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "open-settings":
        this.openSettingsPop();
        break;
      case "settings-close": {
        const pop = this.el.querySelector("#settingsPop");
        if (pop) pop.remove();
        break;
      }
      case "open-codex":
        this.openCodexPop();
        break;
      case "codex-close": {
        const pop = this.el.querySelector("#codexPop");
        if (pop) pop.remove();
        break;
      }
      case "codex-page": {
        /* DOC 26 P2：图鉴翻页卡牌。
           2026-09-13 重写：原来这里**又算了一遍总页数**（而且 per=4 与 openCodexPop 的 PER=3 不一致），
           然后调 openCodexPop() 把整个弹窗拆了重建 —— 总页数会与实际卡片数对不上，
           视觉上就是「翻页时整个二级界面闪一下重刷」。
           现在统一走 codexGoto()：单一真源（this._cdxList + PER=3），只重画卡片区 + 播翻页动画。 */
        this.codexGoto(Number(t.dataset.id) || 0);
        break;
      }
      /* 缩略卡点开看详细 / 点浮层任意处关闭（2026-09-30，与成就墙 achv 同款交互） */
      case "codex-open":
        this.openCodexDetail(t.dataset.id);
        break;
      case "codex-detail-close":
        this.closeCodexDetail();
        break;
      /* 面板内「选择类」操作：只改选中态 + 局部换内容，绝不重建面板 */
      case "team-pick":
        this.omTeamPick(t.dataset.id);
        break;
      case "team-page":
        this.omTeamPage(+t.dataset.id);
        break;
      case "recruit-page": {
        this._recruitPage = Math.max(0, (this._recruitPage || 0) + (+t.dataset.id || 0));
        this._recruitPick = null;
        this.refreshOfficeBody();
        break;
      }
      case "recruit-pick":
        this.omRecruitPick(t.dataset.id);
        break;
      case "focus-pick":
        this.omFocusPick(+t.dataset.id);
        break;
      case "paper-pick":
        this.omPaperPick(t.dataset.id);
        break;
      case "paper-page": {
        this._paperPage = Math.max(0, (this._paperPage || 0) + (+t.dataset.id || 0));
        this.refreshOfficeBody();
        break;
      }
      case "shop-pick":
        this.omShopPick(t.dataset.id);
        break;
      case "shop-gen": {
        /* 世代页签切换（2026-09-09 代际设计）：换世代后选中落到该世代第一档 */
        this._shopGen = t.dataset.id;
        const c = this.core.cfg;
        const tiers = Object.keys(c.GPU_TIERS || {});
        const first = tiers.find((k) => (c.GPU_TIERS[k] || {}).gen === t.dataset.id) || tiers[0];
        this._shopPick = first;
        this.refreshOfficeBody();
        if (this.afterModalRender) this.afterModalRender(false);
        break;
      }
      /* case "om-test-q" 已随 TEST_QA 一并删除（2026-09-19） */
      case "om-test-game":
        this.omTestGameSend();
        break;
      case "om-test-opt": {
        /* doc/29：新模型的选项 ID 是**字符串**（"10001"）—— 别做 + 号数字转换 */
        const raw = t.dataset.opt;
        this.omTestOptC2(raw);
        break;
      }
      /* ---- 气泡里的多媒体交互（doc/29 §5）---- */
      case "chat-zoom":
        this.chatZoom(t.dataset.kind, t.dataset.src);
        break;
      case "chat-zoom-close": {
        const mask = this.el.querySelector("#chatZoomMask");
        if (mask) { const v = mask.querySelector("video"); if (v) v.pause(); mask.remove(); }
        break;
      }
      case "chat-voice":
        this.chatVoice(t);
        break;
      /* [feature:chat-voice-replay-action] */
      case "chat-voice-replay":
        this.chatVoice(t.closest(".chat-voice"), true);
        break;
      /* [/feature:chat-voice-replay-action] */
      /* 思考框折叠（think）：状态**写回 `_omTestLog` 的内存对象**，
         这样 tick 静默重建 / 面板内 refreshOfficeBody 重放时，展开态不会被打回默认 */
      case "chat-think-toggle": {
        const el = t.closest(".chat-think");
        if (!el) break;
        const entry = (this._omTestLog || [])[+el.dataset.idx];
        const nowOpen = !el.classList.contains("collapsed");
        if (entry && entry.think) entry.open = !nowOpen;
        el.classList.toggle("collapsed", nowOpen);
        break;
      }
      /* ---- 底栏三件套与面板（doc/26 §1/§2）---- */
      case "chat-panel": {
        const p = t.dataset.panel;
        this._chatPanel = (this._chatPanel === p) ? null : p;   // 点已开的那个 = 收起
        this._chatSub = null;
        this.refreshChatBar();
        break;
      }
      case "chat-sub":
        this._chatSub = t.dataset.sub || null;
        this.refreshChatBar();
        break;
            case "chat-send-media":
        this.chatSendMedia(t.dataset.kind, t.dataset.i);
        break;
      case "om-test-restart":
        this.omTestRestart();
        break;
      case "om-test-end":
        this.omTestEnd();
        break;
      /* 面板内「提交类」操作：走核心逻辑后静默刷新正文 */
      case "plan-arch": {
        const archs = this.core.cfg.ARCHITECTURES || [];
        const n = archs.length || 1;
        this._planArch = (((this._planArch || 0) + (+t.dataset.id)) % n + n) % n;
        this.planCardSwitch("#archCard", n, this._planArch);
        /* doc/23：换架构后目标卡片的达成状态会变 —— 就地刷新（不重建面板，
           否则语料滑条与翻页动画会被重置） */
        this.refreshMissionCard((archs[this._planArch] || {}).id, this.planPickParam());
        break;
      }
      case "plan-param":
        this._planParam = +t.dataset.id;
        this.refreshOfficeBody();
        break;
      case "plan-corpus": {
        const n = (this.core.cfg.CORPUS_SOURCES || []).length || 1;
        this._planCorpus = (((this._planCorpus || 0) + (+t.dataset.id)) % n + n) % n;
        this.refreshOfficeBody();
        break;
      }
      /* 立项面板「外包补足」：按当前组合的缺口买到位（2026-09-29 玩家反馈「V2 解锁不了」）。
         走真实采购入口 buyCorpus（默认 100 条/次，单价 0.3 万/条，品质随机），
         买到够门槛为止；买不动了（经费不足）就如实告诉玩家还差多少。 */
      case "om-plan-buycorpus": {
        const need = this.planReady().corpusGate != null ? this.planReady().corpusGate : 0;
        let tries = 0, bought = 0, cost = 0, fail = "";
        while (tries++ < 30 && Math.floor(s.v35.corpus.token) < need) {
          const r = this.core.buyCorpus();
          if (!r.ok) { fail = r.tip || "经费不足"; break; }
          bought += r.bought || 0;
          cost += r.cost || 0;
        }
        const have = Math.floor(s.v35.corpus.token);
        if (bought) {
          this.toast(`🛒 外包采购 ${bought} 条（-${fmtMoney(cost)}）→ 当前 ${have} 亿`
            + (have < need ? `，仍差 ${Math.ceil(need - have)} 亿：${fail}` : "，已够本组合立项"));
          if (window.SFX) SFX.play("confirm");
          this.save.autoSave(s);
        } else if (fail) {
          this.toast(fail);
        }
        this.refreshOfficeBody();
        break;
      }
      case "om-plan-confirm": {
        const c = this.core.cfg;
        const archs = c.ARCHITECTURES || [];
        const arch = archs[((this._planArch || 0) % archs.length + archs.length) % archs.length] || {};
        if (!this.planReady().ok) { this.toast(this.planReady().reason + "，无法立项"); break; }
        const param = this.planPickParam();
        /* 阶段任务目标（doc/23）：未达成目标 → 二次确认「暂缓」，把代价说清楚再让玩家选 */
        const mpv = this.core.missionPreview ? this.core.missionPreview(arch.id, param) : { hit: true };
        if (mpv.hit === false) {
          /* 2026-09-16：原生 confirm 在沙箱 iframe 被静默拦截 → 自家确认弹窗，确认后续跑立项 */
          this.askConfirm("未达成任务目标", ((c.MISSIONS || {}).UI || {}).DEFER_TIP
            /* [feature:gameplay-guide-mission-fallback-2-1] */
            || "本次立项未满足本阶段任务的架构或参数要求。任务未达时将留在本阶段重训，主评审经费只对超过本版本已结算最高分的提升发放；同分或更低为 0，小模型等单列收入另算。确定仍然立项吗？", () => {
            /* [/feature:gameplay-guide-mission-fallback-2-1] */
            const r = this.core.confirmPlan({ arch: arch.id, param, mix: this._planMix });
            if (!r.ok) { this.toast(r.tip || "立项失败"); return; }
            this.toast("📄 立项完成：" + arch.name + " · " + param + "B"
              + (r.quality && r.quality.tip ? "（" + r.quality.tip + "）" : ""));
            if (window.SFX) SFX.play("confirm");
            this.save.autoSave(s);
            this.render({ soft: true });
          });
          break;
        }
        const r = this.core.confirmPlan({ arch: arch.id, param, mix: this._planMix });
        if (!r.ok) { this.toast(r.tip || "立项失败"); break; }
        this.toast("📄 立项完成：" + arch.name + " · " + param + "B"
          + (r.quality && r.quality.tip ? "（" + r.quality.tip + "）" : ""));
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "om-focus-start": {
        const dims = this.focusList();            // 四维 + 本模型激活的轴（doc/27 P3）
        const d = dims[this._focusPick || 0] || dims[0] || {};
        const r = this.core.startFocus(d.key);
        if (!r.ok) { this.toast(r.tip || "现在还不能攻关"); break; }
        const mul = (this.core.v35On && this.core.v35On())
          ? (this.core.cfg.V35.FOCUS_MUL || 2.5) : (this.core.cfg.FOCUS.MUL || 1.5);
        this.toast("🎯 攻关开始：" + (r.weeks || 1) + " 周内「" + d.name + "」产出 ×" + mul
          + (r.cost ? "（-" + fmtMoney(r.cost) + "）" : ""));
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "om-paper-start": {
        const id = this._paperPick;
        if (id == null || !this.core.paperOf(id) || this.core.hasPaper(id)
          || !(s.paperCandidates || []).some(value => this.core.paperNoOf(value) === this.core.paperNoOf(id))) break;
        const r = this.core.startPaper(id);
        if (!r.ok) { this.toast(r.tip || "现在还不能研究"); break; }
        const p = this.core.paperOf(id) || {};
        /* v35 的研究耗时由 V35.PAPER_RESEARCH_TICKS 决定（论文卡上的 weeks 是旧字段，
           不参与结算）—— 提示要说真话，否则玩家按「3 周」等，实际 1 周就好了。 */
        const v35 = this.core.v35On && this.core.v35On();
        const pwk = v35
          ? (s.paperResearch ? s.paperResearch.weeks : (p.weeks || 1))
          : (p.weeks || 3);
        this.toast("📖 开始研究《" + (p.title || id) + "》，" + pwk + " 周后出成果");
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "om-buygpu": {
        const r = this.core.buyGpu(this._shopPick || t.dataset.id || s.gpuTier || "basic");
        if (!r.ok) { this.toast(r.tip || "买不起"); break; }
        const g = this.core.cfg.GPU_TIERS[r.tier || this._shopPick || s.gpuTier] || {};
        this.toast("🖥 算力升级到「" + (g.name || "") + "」，参数上限 " + g.maxParam + "B");
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      /* 扩编：岗位卡 = 可勾选（2026-09-07 用户拍板：一次需求可同时要多个岗位） */
      case "hire-pick": {
        const key = t.dataset.role;
        const roles = window.V35Hire ? V35Hire.roles(this.core) : {};
        if (!roles[key]) break;
        if (!Array.isArray(this._hireRoles)) this._hireRoles = [];
        const i = this._hireRoles.indexOf(key);
        if (i >= 0) this._hireRoles.splice(i, 1); else this._hireRoles.push(key);
        this.refreshOfficeBody();
        break;
      }
      case "hire-all": {
        this._hireRoles = window.V35Hire ? Object.keys(V35Hire.roles(this.core)) : [];
        this.refreshOfficeBody();
        break;
      }
      case "hire-order": {
        /* 多选优先（面板勾选）；老入口只带 data-role 时按单岗位发布 */
        const sel = (this._hireRoles && this._hireRoles.length) ? this._hireRoles.slice()
          : (t.dataset.role ? [t.dataset.role] : []);
        if (!sel.length) { this.toast("先勾选要招的岗位"); break; }
        const rr = this.core.requestHire(sel);
        if (!rr.ok) { this.toast(rr.tip || "发布失败"); break; }
        /* rr.mins 这个字段名是历史遗留，实际是「等待周数」（1 周 = 6 tick）。
           以前提示写成「N 分钟内有消息」，与面板上的「预计需要 X~Y 周」自相矛盾。 */
        this.toast("📢 已发布需求：寻访 " + rr.label + "，预计 " + rr.mins + " 周内有消息"
          + (rr.cost ? "（-" + Math.round(rr.cost / 10000) + " 万）" : ""));
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "hire-rush": {
        const options = window.V35Hire ? V35Hire.rushOptions(this.core) : null;
        const rr = options ? V35Hire.rush(this.core) : { ok: false, tip: "招聘系统未加载" };
        if (!rr.ok) { this.toast(rr.tip || "加急失败"); break; }
        const found = rr.result;
        this.toast(found && found.found
          ? "📋 寻访完成，找到 " + found.count + " 位人选，请到「招聘」查看"
          : found ? "🔍 本轮暂未找到合适人选，已进入第 " + found.attempt + " 轮寻访"
          : "⚡ 招聘已加急，等待缩短 " + rr.weeks + " 周（-" + options.costText + "）");
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      /* 2026-09-07 删除 hire-confirm 通道：扩编找到的人进「招聘」页列表，走 om-hire 统一录用 */
      case "om-hire": {
        const id = this._recruitPick || ((s.candidates || [])[0] || {}).id;
        const cand = (s.candidates || []).find((x) => x.id === id);
        const r = this.core.hire(id);
        /* core.hire 返回 boolean（不是 {ok} 对象），这里两种都兼容 */
        const ok = (r === true) || (r && r.ok === true);
        if (!ok) { this.toast((r && r.tip) || "招不了（经费不够或本轮招满了）"); break; }
        /* 招聘提示与头像状态一致：数据/后训练到岗周未到 =「待入职」，别说「入职了」 */
        const eng = s.engineers.find((x) => x.id === (cand || {}).id) || s.engineers[s.engineers.length - 1];
        const jt = this.joinTickOf(eng);
        const tick = (s.v35 && s.v35.tick) || 0;
        const salaryTxt = "月薪 " + Math.round(((cand || {}).salary || 0) / 10000) + " 万，随每 4 周工资发放";
        if (jt > tick) {
          const wk = Math.floor(jt / ((this.core.cfg.V35 || {}).TICKS_PER_WEEK || 6)) + 1;
          this.toast("📝 " + ((cand || {}).name || "新人") + " 已签约，第 " + wk + " 周到岗（到岗前状态为「待入职」，不参与产出）；" + salaryTxt);
        } else {
          this.toast("🎉 " + ((cand || {}).name || "新人") + " 入职了！" + salaryTxt);
        }
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        /* 招完之后：候选人空了就关面板（卡片不该留在屏幕上），否则重选第一个并静默刷新 */
        if (!(s.candidates || []).length) {
          s.officeModal = null;
          this.render({ soft: true });
        } else {
          this._recruitPick = s.candidates[0].id;
          this.render({ soft: true });
          this.refreshOfficeBody();
        }
        break;
      }
      case "om-team-activity":
        this.omTeamActivity();
        break;
      case "activity-close": {
        const pop = this.el.querySelector("#activityPop");
        if (pop) pop.remove();
        break;
      }
      case "om-activity-do": {
        const pop = this.el.querySelector("#activityPop");
        if (pop) pop.remove();
        const r = this.core.doTeamBuild(t.dataset.id);
        this.toast(r.ok ? (r.msg || "活动完成") : ("✗ " + (r.tip || "现在办不了")));
        if (r.ok) { if (window.SFX) SFX.play("confirm"); this.save.autoSave(s); }
        this.render({ soft: true });
        this.refreshOfficeBody();
        break;
      }
      /* [feature:chat-reply-clear] */
      case "om-test-clear":
        this.resetOmTestChat();
        this.refreshOfficeBody();
        break;
      /* [/feature:chat-reply-clear] */
      case "om-arrange-menu":
        this.omArrangeMenu(t.dataset.id);
        break;
      case "arrange-close": {
        /* 2026-09-23：querySelectorAll 全摘 —— 残留一个就会挡住整屏（inset:0 的遮罩） */
        this.el.querySelectorAll("#arrangePop").forEach((n) => n.remove());
        break;
      }
      case "om-arrange-do": {
        this.el.querySelectorAll("#arrangePop").forEach((n) => n.remove());
        const id = t.dataset.id, kind = t.dataset.kind;
        const run = {
          talk: () => this.core.arrangeEngineer(id),
          train: () => this.core.trainEngineer(id),
          raise: () => this.core.raiseSalary(id),
          rest: () => this.core.restEngineer(id),
        }[kind];
        const r = run ? run() : { ok: false, tip: "没有这个操作" };
        this.toast(r.ok ? (r.tip || r.msg || "安排好了") : ("✗ " + (r.tip || "现在不方便")));
        if (r.ok) { if (window.SFX) SFX.play("confirm"); this.save.autoSave(s); }
        this.render({ soft: true });
        this.refreshOfficeBody();
        break;
      }
      case "om-train": {
        const r = this.core.trainEngineer(t.dataset.id);
        this.toast(r.ok ? ("📚 " + (r.tip || "培训完成")) : ("✗ " + (r.tip || "现在不能培训")));
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "om-rest": {
        const r = this.core.restEngineer(t.dataset.id);
        this.toast(r.ok ? ("⚡ " + (r.tip || "让他歇会儿")) : ("✗ " + (r.tip || "不能休息")));
        this.render({ soft: true });
        break;
      }
      case "om-raise": {
        const r = this.core.raiseSalary(t.dataset.id);
        this.toast(r.ok ? ("📈 " + (r.tip || "加薪完成")) : ("✗ " + (r.tip || "不能加薪")));
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "om-fire": {
        /* 修复：此前调用不存在的 renderFireConfirm（旧遗留，点击即报错弹窗打不开）。
           现复用行动卡同款辞退二次确认（fireConfirm）。 */
        this.fireConfirm(t.dataset.id);
        break;
      }
      case "om-start-review": {
        /* V3.5.3：评审由玩家自己发起 → 评审答题动画 → 三幕结算演出 */
        if (!this.core.canReview()) {
  /* [feature:review-week-click] */
          this.toast(this.core.v35On() ? `训练周期还没结束——第 ${this.core.minWeeks(s.ver)} 周结束后才能发起评审` : "还没达标，再练练");
  /* [/feature:review-week-click] */
          break;
        }
        s.officeModal = null;
        this.core.enterReview();          // 计算评审结果（phase=review）
        /* [feature:v5-no-question-build] */
        if (!this.core.embodiedAvailable || !this.core.embodiedAvailable(s)) this.core.buildEvalShow();
        /* [/feature:v5-no-question-build] */
        this._evalShown = 0;
        this.save.autoSave(s);
        this.render();
        break;
      }
    /* [feature:v5-fitness-review-actions] */
      case "fitness-start":
      case "fitness-pause":
      case "fitness-settle":
        if (window.EmbodiedFitnessReview) EmbodiedFitnessReview.action(this, act.slice(8));
        break;
    /* [/feature:v5-fitness-review-actions] */
      case "evalshow-done": {
    /* [feature:v5-fitness-review-settle-gate] */
        /* [feature:v5-review-skip-fitness-legacy-action] */
        if (this.core.state.phase === "review" && this.core.embodiedAvailable && this.core.embodiedAvailable(this.core.state)) { this.settleEmbodiedReview(); this.render(); break; }
        /* [/feature:v5-review-skip-fitness-legacy-action] */
    /* [/feature:v5-fitness-review-settle-gate] */
        /* 答题动画结束/跳过 → 结算奖金（phase=bonus；无奖励则直接 over） */
        this.stopEvalShowTimer();
        this._evalShown = 0;
        this.core.finish();
        this.save.autoSave(s);
        this.render();
        break;
      }
      case "bonus-done":        // 旧按钮兼容（旧存档停留在 bonus 页时仍可继续）
      case "bonus-final": {
        /* 演出页已展示完全部信息 → 最终成果页（over）。
           2026-09-17 起**不再有新入口**（末版通过改为「再战 V4.5」，见 bonusAct），
           这里只为旧存档/旧按钮留一条可继续的路。 */
        this.clearBonusTimers();
        if (!this.core.finishBonus()) break;   // phase：bonus → over
        this.save.autoSave(s);
        this.render();
        break;
      }
      case "bonus-next": {
        /* 幕推进：顶部进度胶囊随幕点亮（.act active/leaving 切换在 rewardGoTo 里）
           ⚠️ 上界取 bonusLastAct()（动态 3 或 4），不能再写死 3 —— 写死会让第四幕点不进去 */
        this.rewardGoTo(Math.min(this.bonusLastAct(), Math.max(1, parseInt(t.dataset.step, 10) || 1)));
        break;
      }
      case "bonus-jump": {
        /* 灵动岛关闭钮：等不及的玩家直接跳到**最后一幕**（有成就时是成就，否则是奖金结算） */
        this.rewardGoTo(this.bonusLastAct());
        break;
      }
      case "achv-skip": {
        /* 第四幕阶段 A → 阶段 B：跳过剩余弹卡，直接看解锁列表 */
        this.achvSkipAll();
        break;
      }
      case "achv-page": {
        /* 第四幕解锁列表翻页（每页 achvPerPage() 张：竖屏 1 / 桌面 4）——只换列表 DOM，不重播整幕 */
        const per = this.achvPerPage();
        const tot = Math.max(1, Math.ceil((this._bonusAchvList || []).length / per));
        this._achvPage = Math.min(Math.max(0, (this._achvPage || 0) + (+t.dataset.id || 0)), tot - 1);
        this.achvRenderPage();
        break;
      }
      case "eval-pause": {
        /* 2026-09-12（用户要求）：评审题目字数多 → 暂停/继续按钮，暂停逐题揭示计时 */
        this._evalPaused = !this._evalPaused;
        const pb = this.el.querySelector("#evPauseBtn");
        if (pb) pb.textContent = this._evalPaused ? "▶ 继续评审" : "⏸ 暂停阅读";
        if (window.SFX) SFX.play("click");
        break;
      }

      case "bonus-replay": {
        this.rewardReplay();
        break;
      }

      /* 2026-09-12：词条升级竖列翻页（每页 3 人）——只换列表 DOM，不重播整幕 */
      case "upg-page": {
        const upsAll = (s.traitUps || s.traitUpgrades || []).filter((u) => u && typeof u === "object" && u.name);
        const per = 3;
        const tot = Math.max(1, Math.ceil(upsAll.length / per));
        this._upgPage = Math.min(Math.max(0, this._upgPage + (+t.dataset.id || 0)), tot - 1);
        const pg = this._upgPage;
        const listEl = this.el.querySelector("#upgradeList");
        if (listEl) {
          listEl.innerHTML = upsAll.slice(pg * per, pg * per + per).map((u, i) => {
            const eng = s.engineers.find((e) => e.id === u.id);
            const av = eng ? this.engAvatar(eng) : "";
            return `<div class="upgrade-item" style="transition-delay:${(i * 0.1).toFixed(2)}s">
              <span class="up-avatar role-${u.type || "pretrain"}">${av ? `<img src="${av}" alt="">` : (u.name || "?").charAt(0)}</span>
              <span class="up-info">
                <span class="up-name">${u.name} · ${this.ROLE_NAME[u.type] || "工程师"}</span>
                <span class="up-trait">${this.icon("star", 11)}${u.trait}</span>
              </span>
              <span class="lv-flow">
                <span class="lv-badge old">Lv.${u.from}</span>
                <span class="lv-arrow">${this.icon("arrow-right", 14)}</span>
                <span class="lv-badge new">Lv.${u.to}</span>
              </span>
            </div>`;
          }).join("");
          const act = listEl.closest(".act");
          if (act) { listEl.querySelectorAll(".upgrade-item").forEach((n) => n.classList.add("in")); }
        }
        const pgno = this.el.querySelector(".upg-pageno");
        if (pgno) pgno.textContent = (pg + 1) + " / " + tot;
        const btns = this.el.querySelectorAll(".upgrade-pager .upg-btn");
        if (btns[0]) btns[0].disabled = pg <= 0;
        if (btns[1]) btns[1].disabled = pg >= tot - 1;
        break;
      }

      case "reroll":
        // 重新招募：触发「等待招聘」事件（时间成本事件化）；未触发则直接重刷
        this.core.requestRecruit();
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      case "go-buygpu":
        s.phase = "buygpu"; this.render();
        break;
      case "recruit-back":
        // 中途招聘（W4 / W8 节点）招完：若排了小游戏（W8 → SFT）先开它，否则回双周循环
        s.phase = "loop";
        if (s.pendingMinigame) {
          this.core.startMinigame(s.pendingMinigame);
        } else {
          s.loopStep = s.loopStep === "workshop" ? "workshop" : "report";
        }
        this.save.autoSave(s);
        this.render();
        break;
      /* ---- 团队建设（P7）：团建 / 开会 / 1v1 / 奖金 / 培训 ---- */
      case "tb-act": {
        if (t.dataset.target === "1") {
          // 目标类：先选人
          this._tbKind = t.dataset.kind;
          this.render({ soft: true });
          break;
        }
        const r = this.core.doTeamBuild(t.dataset.kind);
        if (!r.ok) { this.toast(r.tip || "无法执行"); break; }
        this.toast(r.msg || "完成");
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "tb-pick": {
        const r = this.core.doTeamBuild(this._tbKind, t.dataset.id);
        this._tbKind = null;
        if (!r.ok) { this.toast(r.tip || "无法执行"); this.render({ soft: true }); break; }
        this.toast(r.msg || "完成");
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "tb-cancel":
        this._tbKind = null;
        this.render({ soft: true });
        break;
      /* ---- 自由行动（P6）：刷论文 / 学术会议 / 采购数据 ---- */
      case "free-act": {
        const r = this.core.doFreeAction(t.dataset.kind);
        if (!r.ok) { this.toast(r.tip || "无法执行"); break; }
        this.toast(r.msg || "完成");
        if (window.SFX) SFX.play(t.dataset.kind === "paper" ? "click" : "confirm");
        this.save.autoSave(s);
        this.render({ soft: true });   // HUD 经费 / 品牌要刷新
        break;
      }
      /* ---- 小游戏：SFT 数据质检 / RM 偏好标注（P5） ---- */
      case "mg-pick": {
        if (this.core.minigamePick(+t.dataset.id) == null) break;
        if (window.SFX) SFX.play("click");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "mg-next": {
        const r = this.core.minigameNext();
        if (r && r.summary) this._mgSummary = r.summary;   // 最后一题 → 面板内成绩总结
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "mg-done":
        /* 巡检完成：关闭面板（时间已在 finishMinigame 恢复流动） */
        this._mgSummary = null;
        s.officeModal = null;
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      case "mg-abandon": {
        /* 放弃巡检：清空本次巡检进度并恢复时间（minigameDone 已标记，本阶段不再重复触发） */
        s.minigame = null;
        s.pendingMinigame = null;
        /* [feature:v2b-pause-inspection-abandon] */
        if (window.OfficePause) OfficePause.releaseSource(this.core, "inspection");
        else s.officePaused = !!s._mgWasPaused;
        /* [/feature:v2b-pause-inspection-abandon] */
        s._mgWasPaused = null;
        s.officeModal = null;
        this.toast("已放弃本次巡检");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "mg-rank": {
        /* RM 排序：点一次 = 排到下一个位次（X6 交互），刷新徽标 */
        const r0 = this.core.minigameRank(+t.dataset.id);
        if (r0) { if (window.SFX) SFX.play("click"); this.render({ soft: true }); }
        break;
      }
      case "mg-submit": {
        const rv = this.core.minigameSubmitRank();
        if (rv) { if (window.SFX) SFX.play(rv.perfect ? "confirm" : "click"); this.render({ soft: true }); }
        break;
      }
      case "mg-reset-rank": {
        /* 2026-09-17（玩家反馈）：重排 —— 清空本题已排位次，重新点选（点错了可以改） */
        const rr = this.core.minigameResetRank();
        if (rr) { if (window.SFX) SFX.play("click"); this.render({ soft: true }); }
        break;
      }
      case "buy-tier":
        if (this.core.buyTier(t.dataset.id)) { this.core.snapshot(); this.save.autoSave(s); this.render({ soft: true }); }
        break;
      case "target":
        this.core.chooseTarget(+t.dataset.id); this.save.autoSave(s); this.render({ soft: true });
        break;
      case "go-direction":
        s.phase = "direction"; this.save.autoSave(s); this.render();
        break;
      case "pick-arch": {
        const r = this.core.chooseArch(t.dataset.id);
        if (!r.ok) { this.toast(r.tip); break; }
        if (window.SFX) SFX.play("click");
        this.render({ soft: true });
        break;
      }
      case "pick-leader": {
        this.core.setLeader(t.dataset.id);
        if (window.SFX) SFX.play("click");
        this.render({ soft: true });
        break;
      }
      case "next-stage": {
        // P8：进入下一阶段（数值继承 / 周数重置 / 追加预算）
        // 2026-09-04：三幕结算演出已展示完全部结算信息，直接由此进下一阶段，不再经过 over 页
        this.clearBonusTimers();
        if (!this.core.startNextStage()) { this.toast("无法进入下一阶段"); break; }
        this.save.autoSave(s);
        this.render();
        break;
      }
      case "retry-stage": {
        /* doc/23 决策 ③：任务未达成 → 重训本阶段（不换版本、不发阶段预算）
           2026-09-17：末版 V4.5 通过后的「再战」走同一个入口，但提示文案要分开
           （通关后不是"重训"，也不该说"任务没达成"） */
        this.clearBonusTimers();
        const _fin = !!(s.result && s.result.finalRepeat && !s.result.retry);
        if (!this.core.retryStage()) { this.toast("当前不能重训"); break; }
        this.toast(_fin ? ("🔁 再战 " + s.ver + " 阶段：目标不变，冲更高总评")
/* [feature:gameplay-guide-retry-copy] */
                        : ("🔁 重训 " + s.ver + " 阶段：目标不变，继续训练争取达标"));
/* [/feature:gameplay-guide-retry-copy] */
        this.save.autoSave(s);
        this.render();
        break;
      }
      case "tune-draw": {
        const r = this.core.tuneDraw();
        if (!r.ok) { this.toast(r.tip); break; }
        this.toast(`🎰 抽出小模型：评分 ${r.score}${r.score >= 80 ? " 🌟 优品！结算 +10 万" : ""}`);
        if (window.SFX) SFX.play(r.score >= 80 ? "confirm" : "click");
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      }
      case "buy-corpus": {
        const r = this.core.buyCorpus();
        if (!r.ok) { this.toast(r.tip); break; }
        this.toast(`🛒 采购 ${r.bought} 条语料（-${fmtMoney(r.cost)}），其中良好 ${r.good != null ? r.good : "?"} 条`);
        if (window.SFX) SFX.play("confirm");
        this.save.autoSave(s);
        this.render({ soft: true });   // 语料条 + HUD 经费都要刷新
        break;
      }
      case "to-review":
        this.core.enterReview(); this.save.autoSave(s); this.render();
        break;
      case "event-opt": {
        const result = this.core.applyEventOption(t.dataset.event, +t.dataset.id);
        if (result && result.ok === false) { this.toast(result.tip || "暂时无法处理此选项"); break; }
        this.save.autoSave(s);
        this.trainAnim(() => this.render());   // 事件结算后播时间流逝动画，再显示下一事件/报告
        break;
      }
      case "finetune":
        this.core.chooseFineTune(+t.dataset.id);
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      /* ---- 行动卡（08 §4，P1）：工程师卡上的快捷按钮与行动面板共用同一套 AP 结算 ---- */
      case "act": {
        const a = this.core.actionById(t.dataset.id);
        if (a && a.target === "one") {
          // 需要选人：展开该卡下方的目标选择行（再次点同一张卡 = 收起）
          this._actPick = this._actPick === a.id ? null : a.id;
          this.render({ soft: true });
        } else {
          this.doAction(t.dataset.id, null);
        }
        break;
      }
      case "act-target":
        this.doAction(t.dataset.id, t.dataset.eng);
        break;
      case "act-cancel":
        this._actPick = null;
        this.render({ soft: true });
        break;
      /* 2026-09-06：case "comfort" 已删除——慰问随 A_H_CARE 行动卡退役 */
      case "fire":
        this.fireConfirm(t.dataset.id);   // 二次确认弹窗（辞退不可撤销）
        break;
      case "fire-confirm": {
        /* 2026-09-12：辞退直接走 core.fire（唯一代价 = 赔付 2 倍月薪），
           不再经行动卡 useAction —— AP 消耗废除后也不存在「行动点不足」挡辞退 */
        const r = this.core.fire(t.dataset.id);
        if (!r.ok) {
          this.closeFireModal();
          this.toast(r.reason === "min_keep" ? "不能辞退最后一名工程师" : "无法辞退");
          break;
        }
        this._modal = null;
        /* 2026-09-12 修：确认弹窗已豁免 render 清理（跨 tick 存活），这里必须**显式摘掉**——
           以前依赖 render 顺手清掉，豁免之后确认弹窗会永远留在屏幕上 */
        this.closeFireModal();
        this.save.autoSave(s);
        this.toast(`🚪 已辞退${r.name}，赔付 ${Math.round(r.severance / 10000)}万`);
        this.render({ soft: true });
        break;
      }
      case "finish":
        this.core.finish();
        this.save.autoSave(s);
        this.render({ soft: true });
        break;
      case "ask-newgame": {
        /* 二次确认：先变「确认重新开始？」，3 秒内再点一次才真重开（防误触丢存档） */
        const btn = this.el.querySelector('[data-action="ask-newgame"]');
        if (btn && btn.dataset.armed !== "1") {
          btn.dataset.armed = "1";
          btn.textContent = "⚠️ 确认重新开始？";
          btn.classList.add("pink");
          setTimeout(() => {
            if (!btn.isConnected) return;
            delete btn.dataset.armed;
            btn.textContent = "🔁 重新开始";
            btn.classList.remove("pink");
          }, 3000);
          break;
        }
        this.core.newGame(); this.resetOmTestChat(); this.save.remove("auto"); this.render();
        break;
      }
      case "newgame":
        this.core.newGame(); this.resetOmTestChat(); this.save.remove("auto"); this.render();
        break;
      case "open-save":   /* 顶栏存档按钮（2026-08-30：此前缺这个 case，点了没反应） */
      case "save":
        if (s.officeModal) s.officeModal = null;
  /* [feature:modal-content-pages-save-open] */
        if(this._modal!=="save")this.disposeModalPages();
        this._modal = "save"; this.render({ soft: true });
  /* [/feature:modal-content-pages-save-open] */
        break;
      case "save-slot":
        this.saveToSlot(t.dataset.slot);
        break;
      case "save-here":
        this.saveToFirstEmpty();
        break;
      case "load-slot":
        this.loadSlot(t.dataset.slot);
        break;
      case "del-slot":
        this.removeSlot(t.dataset.slot);
        break;
      /* ---- 双周三步流程 / 工作间 / 团队面板 ---- */
      case "act-tab":
        // P6：三 tab —— train / team / free（自由行动）
        this._actTab = ["team", "free"].includes(t.dataset.tab) ? t.dataset.tab : "train";
        this.render({ soft: true });
        break;
      case "loop-next":
        s.loopStep = t.dataset.step || "report";
        this.save.autoSave(s);
        this.render();          // 换屏 → 播完整页面过渡
        break;
      case "open-team":
        this.openTeam();
        break;
      /* ---- 教学 / 说明 ---- */
      case "tut-close":
        this.core.markTutorial(t.dataset.id);
        /* 先摘掉弹窗本身：它不随 render 重建，光靠 render 是关不掉的 */
        t.closest(".dg-modal-mask").remove();
        this.render({ soft: true });
        /* 评审说明看完 → 恢复答题动画（用户 2026-09-01：看完说明才播） */
        if (this.core.state.phase === "review") { this._evalWaitTut = false; this.startEvalShowTimer(); }
        break;
  /* [feature:modal-content-pages-route] */
      case "modal-page":
        if(this._modalPages&&!this._modalPages.closed&&this._modalPages.mask.contains(t))this._modalPages.show(this._modalPages.page+Number(t.dataset.step));
        break;
      case "open-help":
  /* [/feature:modal-content-pages-route] */
        this.openHelp();
        break;
      case "close-modal":
        this.closeModal();   // 自带 dg-modal-out 淡出动画，淡完由 render 的清理兜底
        break;
      case "close-fire":
        this.closeFireModal();
        break;
      /* 通用确认弹窗（2026-09-16 替代原生 confirm）：确认先收弹窗再执行回调 */
      case "confirm-ok": {
        const cb = this._confirmCb;
        /* [feature:cloud-confirm-ok-keep-lock] */
        this.closeConfirm(true);
        /* [/feature:cloud-confirm-ok-keep-lock] */
        if (cb) cb();
        break;
      }
      case "close-confirm":
        this.closeConfirm();
        break;
    }
  },

  /* 保存到指定槽位；已有存档则先确认覆盖（2026-09-16：原生 confirm 在沙箱 iframe 被静默拦截 → 自家弹窗） */
  saveToSlot(slot) {
    if (slot === "auto") return;
    const existing = this.save.load(slot);
    if (existing) {
      this.askConfirm("覆盖存档？", `槽位 ${+slot + 1} 已有存档（${existing.name}），覆盖后原存档将丢失。`, () => {
        this.save.save(slot, this.core.state);
        this._modal = null;
        this.render();
      });
      return;
    }
    this.save.save(slot, this.core.state);
    this._modal = null;
    this.render();
  },

  /* 保存到第一个空槽（全满则提示） */
  saveToFirstEmpty() {
    for (let i = 0; i < this.save.MAX_SLOTS; i++) {
      if (!this.save.load(i)) { this.save.save(i, this.core.state); this._modal = null; this.render({ soft: true }); return; }
    }
    this.toast(`存档槽已满（${this.save.MAX_SLOTS} 个），请先删除一个或覆盖已有槽位。`);   // 2026-09-16：alert → toast
  },

  /* 删除槽位（二次确认） */
  removeSlot(slot) {
    if (slot === "auto") return;
    const existing = this.save.load(slot);
    if (!existing) return;
    this.askConfirm("删除存档？", `确定删除槽位 ${+slot + 1} 的存档？删除后不可恢复。`, () => {
      this.save.remove(slot);
      this.refreshSaveModal();   // 2026-09-23：弹窗开着时显式换新列表（tick render 不再代劳）
      this.render({ soft: true });
    }, { danger: true, okText: "删除" });
  },

  loadSlot(slot) {
    this.askConfirm("读取存档？", "读档将覆盖当前进度，当前未保存的进度会丢失。", () => {
      /* "stage" = 本阶段开头的自动锚点（不占手动槽，兜底机制的一部分） */
      let d = null;
      if (slot === "stage") d = this.save.loadStage ? this.save.loadStage() : null;
      else d = this.save.load(slot);
      if (!d) { this.toast("该槽位为空"); return; }   // 2026-09-16：alert → toast
      this.core.restore(d.state);
      this._tickFails = 0; this._tickRecovered = false;   // 手动干预后重置自动兜底的状态
      this._modal = null;
      this.render({ soft: true });
    });
  },

  /* 关闭模态：先播淡出再重建 DOM（全局过渡动画体系，避免"啪"地消失） */
  /* [feature:cloud-modal-close-cancel] */
  closeModal() {
    this.cancelCloudRestore();
  /* [/feature:cloud-modal-close-cancel] */
  /* [feature:modal-content-pages-close] */
    this.disposeModalPages();
    if (this._closing) return;
  /* [/feature:modal-content-pages-close] */
    const mask = this.el && this.el.querySelector(".dg-modal-mask");
    if (!mask) {
      /* 三幕结算页没有可关模态：Esc 直接忽略（否则整页重渲染会让当前幕重播一遍） */
      if (this.core.state.phase === "bonus") return;
      this._modal = null; this.render({ soft: true }); return;
    }
    this._closing = true;
    mask.classList.add("dg-modal-out");
    setTimeout(() => { this._closing = false; this._modal = null; this.render({ soft: true }); }, 180);
  },

  /* 翻页点不动时的缓动提示（demo page-peek 同款）：卡片整体往该方向弹一下再回来 */
  candPeek(btn, dir) {
    const area = btn && btn.closest ? btn.closest(".dg-cand-area") : null;
    if (!area) return;
    area.classList.remove("dg-peek-next", "dg-peek-prev");
    void (area).offsetWidth;
    area.classList.add(dir < 0 ? "dg-peek-prev" : "dg-peek-next");
    setTimeout(() => area.classList.remove("dg-peek-next", "dg-peek-prev"), 540);
  },

  /* 轻量 toast 提示（团队操作反馈）：不打断节奏，2.4 秒自动消失。
     挂在 body 下 + z-index 200（全局分层表预留位），确保在玩法界面之上。 */
  toast(msg) {
    let el = document.getElementById("dg-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "dg-toast";
      el.className = "dg-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  },

  /* 词条/属性说明气泡：在点击坐标附近弹出一个临时说明（移动端点按词条胶囊） */
  toggleTip(x, y, text) {
    let tip = document.getElementById("ui-trait-tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "ui-trait-tip";
      tip.className = "ui-trait-tip";
      tip.style.position = "fixed";
      tip.style.zIndex = "99999";
      tip.style.maxWidth = "min(260px, 84vw)";
      tip.style.pointerEvents = "none";
      document.body.appendChild(tip);
    }
    const shown = tip.__shown;
    if (shown && tip.textContent === text) { this.hideTip(); return; }
    tip.textContent = text;
    // 视口内放置：优先在点击点下方，越界翻到上方
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = Math.max(8, Math.min(x - 130, vw - 268));
    let top = y + 14;
    if (top + 120 > vh) top = y - 120 - 8;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
    tip.style.opacity = "1";
    tip.style.transition = "none";
    tip.__shown = 1;
    clearTimeout(this._tipTimer);
    return;
  },
  hideTip() {
    const tip = document.getElementById("ui-trait-tip");
    if (!tip) return;
    tip.style.opacity = "0";
    tip.__shown = 0;
    clearTimeout(this._tipTimer);
    this._tipTimer = setTimeout(() => { if (tip && !tip.__shown) tip.remove(); }, 240);
  },

  /* 打出一张行动卡的统一入口：结算 → toast 反馈 → 自动存档 → 重渲染。
     辞退类（confirm）卡片由 fireConfirm 单独处理二次确认，不在这里直接结算。 */
  doAction(actionId, engId) {
    const a = this.core.actionById(actionId);
    if (!a) return;
    if (a.confirm) { this._actPick = null; this.fireConfirm(engId, actionId); return; }
    const r = this.core.useAction(actionId, engId);
    if (!r.ok) { this.toast(r.tip || "无法执行"); return; }
    this._actPick = null;
    this.save.autoSave(this.core.state);
    const cost = r.cost > 0 ? `（-${fmtMoney(r.cost)}）` : "";
    this.toast(`${a.icon} ${a.name}${cost}：${r.text || "已生效"}`);
    this.render({ soft: true });
  },

  /* 辞退二次确认（08 设计文档 §10.2）：必须列出全部后果，确认后才执行。
     用 insertAdjacentHTML 追加，关闭时只移除 DOM，不重渲染主体。 */
  fireConfirm(engId, actionId) {
    if (this._fireOpen) return;
    const s = this.core.state;
    const f = this.core.cfg.FIRE || {};
    const e = s.engineers.find((x) => x.id === engId);
  /* [feature:last-engineer-fire-confirm] */
    if (!e || e.resigned) return;
    if (!this.core.canFireEngineer(s)) { this.toast("不能辞退最后一名工程师"); return; }
    this._fireOpen = true;
  /* [/feature:last-engineer-fire-confirm] */
    /* 2026-09-12（用户定稿）：唯一负面效果 = 赔付月薪 × SEVERANCE_MUL（与 core.fire 同源） */
    const mul = f.SEVERANCE_MUL != null ? f.SEVERANCE_MUL : 2;
    const pay = Math.round((e.salary || 0) * mul);
    this.el.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask dg-fire-modal" data-action="close-fire">
        <div class="dg-modal dg-modal-fire">
          <div class="dg-title">⚠️ 确认辞退${e.name}？</div>
          <p class="dg-sub">辞退后不可恢复，需要支付经济补偿：</p>
          <ul class="dg-fire-list">
            <li>赔付 <b style="color:var(--aqua-error)">−${fmtMoney(pay)}</b>（月薪 × ${mul}，含代通知金）</li>
          </ul>
          <p class="dg-fire-warn">此操作不可撤销。</p>
          <div class="dg-actions">
            <button class="dg-btn" type="button" data-action="close-fire">再想想</button>
            <button class="dg-btn dg-btn-danger-solid" type="button" data-action="fire-confirm" data-id="${e.id}">🚪 辞退</button>
          </div>
        </div>
      </div>`);
  },

  /* 关闭辞退确认弹窗（仅移除 DOM，不动主体） */
  closeFireModal() {
    const m = this.el.querySelector(".dg-fire-modal");
    if (m) m.remove();
    this._fireOpen = false;
  },

  /* 通用确认弹窗（2026-09-16）：**替代原生 confirm()/alert()**。
     为什么必须换：Toy / B 站等平台把游戏嵌在 iframe 沙箱里（无 allow-modals），
     原生 confirm() 会被**静默拦截**返回 false——「确定覆盖 / 删除 / 读档」全变成
     永远选了取消，玩家看来就是「存档界面按钮点不动」（本地非沙箱所以复现不了）。
     挂载方式与辞退确认弹窗同款：insertAdjacentHTML + 独立 action，跨 tick 存活。 */
  askConfirm(title, body, onOk, opts) {
    if (this._confirmOpen) return;
    this._confirmOpen = true;
    this._confirmCb = onOk || null;
    /* [feature:cloud-confirm-cancel-hook] */
    this._confirmCancel = opts && opts.onCancel || null;
    /* [/feature:cloud-confirm-cancel-hook] */
    const root = this.el || document.body;
    root.insertAdjacentHTML("beforeend", `
      <div class="dg-modal-mask dg-confirm-modal" data-action="close-confirm">
        <div class="dg-modal">
          <div class="dg-title">⚠️ ${title}</div>
          <p class="dg-sub">${body}</p>
          ${opts && opts.warn ? `<p class="dg-fire-warn">${opts.warn}</p>` : ""}
          <div class="dg-actions">
            <button class="dg-btn" type="button" data-action="close-confirm">取消</button>
            <button class="dg-btn ${opts && opts.danger ? "dg-btn-danger-solid" : "dg-btn-primary"}" type="button" data-action="confirm-ok">${(opts && opts.okText) || "确定"}</button>
          </div>
        </div>
      </div>`);
  },

  /* 关闭通用确认弹窗（取消 / 蒙层点击都走这里；确认时先 close 再执行回调） */
  /* [feature:cloud-confirm-dismiss] */
  closeConfirm(confirmed) {
    const root = this.el || document.body;
    const m = root.querySelector(".dg-confirm-modal");
    if (m) m.remove();
    const cancel = this._confirmCancel;
    this._confirmOpen = false;
    this._confirmCb = null;
    this._confirmCancel = null;
    if (!confirmed && cancel) cancel();
  },
  /* [/feature:cloud-confirm-dismiss] */



  /* 已招聘迷你卡：头像/姓名/类型/词条 + 5维数值条 + 半年薪（省简历简介） */

  /* ---------------- 文案工具 ---------------- */
  typeName(t) { return this.core.cfg.ENGINEER_TYPES[t] ? this.core.cfg.ENGINEER_TYPES[t].name : t; },
  typeIcon(t) { return this.core.cfg.ENGINEER_TYPES[t] ? this.core.cfg.ENGINEER_TYPES[t].icon : "👤"; },
  /* 岗位到岗周（V3.5.3 开局一次招 3 人，到岗时间错开） */
  joinWeek(type) {
    return { pretrain: "即刻（第 1 周）", data: "第 2 周", post: "第 4 周" }[type] || "即刻";
  },
  /* 入职 tick：数据 W2 / 后训练 W4（与 V35.JOIN_DATA / JOIN_POST 一致）。
     口径与结算端（core 语料产能判断）严格对齐：joinTick == null = 即刻到岗。
     不按角色兜底推导——否则访客/老存档里没写 joinTick 的 data/post 会被误显示成
     「待入职」，而实际已经在产语料（显示与结算矛盾）。 */
  joinTickOf(e) {
    if (!(this.core.v35On && this.core.v35On())) return 0;
    if (e && e.joinTick != null) return e.joinTick;
    return 0;
  },
  /* 工程师状态：待入职 / 等立项 / 工作中 / 已下班 / 休假（V3.5 引擎状态的可读化）
     · 待入职：入职 tick 未到（仅 V1 开局 data/post 错开到岗）
     · 等立项：阶段尚未立项（V1.5 重进办公室重新立项期间／老员工 joinTick 已清 0）
     · 已下班：处于 V35.OFF_* 下班窗口
     · 休假：体力告罄歇工（低体力停产出）
     · 工作中：其余全部 */
  engStatus(e) {
    const s = this.core.state;
    const t = (s.v35 && s.v35.tick) || 0;
    if (!(s.planDone)) return "等立项";          // 阶段未立项：全员待命中（2026-09-03）
    if (t < this.joinTickOf(e)) return "待入职";
    if (!(this.core.v35On && this.core.v35On())) return "工作中";
    const v = this.core.cfg.V35 || {};
    const offS = v.OFF_START != null ? v.OFF_START : 0, offL = v.OFF_LEN != null ? v.OFF_LEN : 0;
    if (offL > 0 && t >= offS && t < offS + offL) return "已下班";
    /* 安排休息的人：本周下班休息（不产出），下周上班才回体力（2026-09-08） */
    if (e.restWeek != null && e.restWeek === (s.week || 0)) return "休假";
    const en = Math.round(e.energy || 0);
    if (en < (v.ENERGY_MIN != null ? v.ENERGY_MIN : 20)) return "休假";
    return "工作中";
  },
  /* 状态 → 徽标配色类 */
  statusCls(st) {
    return st === "待入职" ? "st-pending"
      : st === "等立项" ? "st-wait"
      : st === "已下班" ? "st-off"
      : st === "休假" ? "st-rest"
      : "";
  },
  /* 词条展示名：**优先读配置 TRAIT_META**（doc/27 §6.3 单一真源），缺失再走旧硬编码兜底 */
  traitName(t) {
    const m = (this.core.cfg.TRAIT_META || {})[t];
    if (m && m.name) return m.name;
    return { pretrain: "预训练", post: "后训练", academic: "学术", engineer: "工程", data: "数据", safety: "安全" }[t] || t;
  },
  /* 该词条能驱动哪些能力轴（词条说明/工程师卡片用；空数组 = 不产轴） */
  traitAxes(t) { return ((this.core.cfg.TRAIT_META || {})[t] || {}).axes || []; },
  /* 轴图标：配置 AXES.DEF[*].icon 存的是**自绘 SVG path**（24×24 线性风格，与 icon() 同款），
     这里统一包成 <svg>。⚠️ 别在调用处直接插 `d.icon`：它现在是 path 字符串，
     当文本插会渲染成一段乱码；而塞进别人的 <svg> 里（攻关四象限那种写法）又会被
     fill=none + 不匹配的 viewBox 吃掉 → 什么都不显示。**只走这个入口。** */
  axisIcon(id, size) {
    const d = this.core.axisDef(id) || {};
    const s = size || 15;
    if (!d.icon) return "";
    return `<svg class="dg-ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"`
      + ` stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"`
      + ` aria-hidden="true">${d.icon}</svg>`;
  },
  /* 某维度的填充色（数值条/仪表用）：四维走既有 COLORS，轴走配置 AXES.DEF[*].color（单点真源） */
  dimFill(k) {
    const st = this.core.dimBarStyle(k);
    if (st) return st.replace(/^background:/, "");
    return ({ code: "linear-gradient(90deg,#6fc3ff,#2789c4)", text: "linear-gradient(90deg,#7ed4f0,#3dbbd8)",
              safety: "linear-gradient(90deg,#ffcf8a,#f2b84b)", stability: "linear-gradient(90deg,#7ed4b0,#53b98d)" })[k]
      || "var(--aqua-primary-deep)";
  },
  /* 词条作用说明（词条胶囊 hover / 点击弹出）
     2026-09-05：补上**升级前置条件**（门槛与依据属性直接从配置读，改了配置文案跟着变，不再写死）。 */
  traitDesc(t) {
    /* 2026-09-03 全量更新：按 V3.5 实际产出分工描述（预训练→代码/文字、数据→语料、后训练→安全/稳定） */
    const base = {
  /* [feature:multi-trait-dev-ui-005] */
      pretrain: "预训练经验：拥有此词条即可产出代码 / 文字能力，与其他生产词条同时生效，按自身等级取产出档位",
      post: "后训练经验：拥有此词条即可产出安全 / 稳定能力，与其他生产词条同时生效，按自身等级取产出档位",
  /* [/feature:multi-trait-dev-ui-005] */
      academic: "学术研究：自身不升级，让同一位工程师的「其它词条」升级概率加算提升",
  /* [feature:multi-trait-dev-ui-006] */
      data: "数据经验：拥有此词条即可产出文字与语料（有效 token），与其他生产词条同时生效，语料品质按自身数据等级查表",
      embodied: "具身经验：进入具身时代后，与其他生产词条同时生效，按自身等级驱动模型已激活的物理认知 / 灵巧操控轴，两轴按原规则交替产出",
  /* [/feature:multi-trait-dev-ui-006] */
    }[t] || "";
    if (base) {
      /* 2026-09-10 doc/27 P3：词条说明追加「能驱动哪些追加能力轴」——
         玩家据此知道该招什么人（轴的产出岗位决定） */
      const axs = this.traitAxes(t);
      if (axs.length) {
        const nm = axs.map((id) => this.core.statLabel(id)).join(" / ");
        return base + "；也能驱动追加能力轴：<b>" + nm + "</b>（前提是本阶段架构真的带出了这根轴）";
      }
    }
    if (!base) return "";
    /* 学术词条：无升级规则，直接展示「按等级给其它词条的加算值」（2026-09-09） */
    if (t === "academic") {
      const B = ((this.core.cfg.TRAIT_UPGRADE || {}).ACADEMIC_BOOST) || [];
      const pct = (x) => (Math.round(x * 1000) / 10) + "%";
      return B.length
        ? `${base}：其它词条升级概率 +${B.map(pct).join(" / ")}（依次对应 Lv1~5，加算）`
        : base;
    }
    try {
      const keys = this.core.traitUpgradeStats(t);
      if (!keys || !keys.length) return base;
      const min = this.core.traitUpgradeMinStat();
      const names = keys.map((k) => this.statName(k)).join(" + ");
      const p1 = this.core.traitUpgradeProb(t, 1, min);
      const p2 = this.core.traitUpgradeProb(t, 2, min);
      const pct = (x) => (Math.round(x * 1000) / 10) + "%";
      /* 双属性额外说明「每一项都要达标、取平均值」——这是最容易误解的一点 */
      const how = keys.length > 1
        ? `${names} **均** ≥ ${min}（取平均值判定）`
        : `${names} ≥ ${min}`;
      return `${base}。\n升级条件：${how} 后，每次阶段结算有概率升级（Lv1→2 约 ${pct(p1)}、Lv2→3 约 ${pct(p2)}，数值越高概率越大）。`;
    } catch (e) {
      return base;
    }
  },
  abilityName(k) { return this.core.statLabel(k); },
  eventTypeName(t) { return { fixed: "固定", random: "随机", reward: "奖励", critical: "关键", chain: "连锁" }[t] || t; },
  checkName(k) { return { param: "参数规模", code: "代码", text: "文字", safety: "安全", stability: "稳定", score: "总评" }[k] || k; },
  /* 潜力属性中文名 = 工程师档案的 5 项真键（2026-09-10 doc/27 附注修复）
     —— 2026-09-10：初始体力固定 100；精力/协作属性已彻底删除，故只剩三项。 */
  statName(k) {
    return { code: "代码", algo: "算法", text: "文字", engineering: "工程" }[k] || k;
  },
  /* 工程师类型 → 数值条配色（CSS 类） */
  typeColor(t) {
    return { pretrain: "c-blue", post: "c-pink", data: "c-green" }[t] || "c-blue";
  },

  /* 统一线条图标（SVG，lucide 风格，currentColor 派生 —— 全界面复用同一套） */
  icon(name, size) {
    const s = size || 15;
    const p = {
      calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/>',
      coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
      star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
      zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
      /* ---- 2026-08-30 办公室新 UI ---- */
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
      cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
      chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      play: '<polygon points="5 3 19 12 5 21 5 3"/>',
      pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
      clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
      type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
      save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
      info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
      menu3: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
      x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      chevL: '<polyline points="15 18 9 12 15 6"/>',
      chevR: '<polyline points="9 18 15 12 9 6"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      /* ---- 2026-09-03 新闻页 ---- */
      news: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M16 3v16"/><path d="M8 7h5M8 11h5M8 15h5"/>',
      refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
      wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 12h-5a2 2 0 0 0 0 4h5"/>',
      gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
      /* ---- 2026-09-04 三幕结算演出（demo data-lucide 翻译） ---- */
      barchart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
      trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
      "badge-check": '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
      "git-compare": '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
      "trending-up": '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
      gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
      sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M19 3v4"/><path d="M21 5h-4"/>',
      pointer: '<path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/>',
      "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
      /* 2026-09-13：测试聊天「链接」类型用（外链箭头，lucide external-link） */
      "external-link": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
      "arrow-up": '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
      "arrow-up-right": '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
      msg: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      /* ---- 2026-09-12 「＋」玩家工具的三个按钮（原来引用了 image / audio / note，
            但这三个名字在表里根本不存在 → `icon()` 返回空串 → 按钮上一个图标都没有）---- */
      note: '<path d="M2 6h4M2 10h4M2 14h4M2 18h4"/><rect x="6" y="3" width="16" height="18" rx="2"/><path d="M11 8h6M11 12h6"/>',
      image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
      audio: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
      crown: '<path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3z"/><path d="M5 21h14"/>',
      medal: '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>',
      replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
      lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      /* ---- 2026-09-16 成就稀有度图标（自绘，逐级"更贵"）----
         ⚠️ 项目硬规矩：图标一律自绘 SVG，禁 emoji。
         ⚠️ 这几枚**可以被配置覆盖**：成就条目里写 `icon: "<名字>"` 即可（见 achvCardHtml）。
         设计思路：普通=单环点 / 稀有=菱形宝石 / 史诗=绽放花形+芯 / 传说=冠冕+宝石。
         `fill="currentColor" stroke="none"` 的那几笔是**实心点缀** ——
         线稿在小尺寸下糊成一团，得靠实心色块把层级拉开。 */
      achvCommon: '<circle cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="#fff" stroke="none"/>',
      achvRare: '<path d="M12 2.2 21.8 12 12 21.8 2.2 12Z"/><path d="M12 7.6 16.4 12 12 16.4 7.6 12Z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none"/>',
      achvEpic: '<path d="M12 1.8 15.3 8.7 22.2 12l-6.9 3.3L12 22.2l-3.3-6.9L1.8 12l6.9-3.3Z"/><path d="M12 6.8 14.8 12 12 17.2 9.2 12Z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="#fff" stroke="none"/><path d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4"/>',
      achvLegend: '<path d="M3.8 9.4 8.5 13.2 12 5.2l3.5 8 4.7-3.8-1.9 9.8H5.7Z"/><path d="M5.7 20.6h12.6"/><path d="M12 12.4 14 15l-2 2.6L10 15Z" fill="currentColor" stroke="none"/><path d="M12 1.6v2.2M5.4 3.2l1.2 2.1M18.6 3.2l-1.2 2.1"/>',
      achvLocked: '<rect x="3.4" y="10.2" width="17.2" height="11.4" rx="2.6"/><path d="M7.6 10.2V7.4a4.4 4.4 0 0 1 8.8 0v2.8"/><circle cx="12" cy="15.4" r="1.6" fill="currentColor" stroke="none"/><path d="M12 17v2.2"/>',
    };
    const d = p[name];
    if (!d) return "";
    return `<svg class="dg-ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  },
};

/* [feature:integer-money] */
function fmtMoney(n) {
  if (n === null || n === undefined) return "—";
  const value = Number(n);
  n = Number.isFinite(value) ? Math.round(value) : 0;
  const neg = n < 0, a = Math.abs(n);
  /* 超一亿（2026-10-16 用户要求）：单位统一为「亿」，保留到「万」，省略万以下。
     例：178,410,000 → ¥1亿7841万；不足一亿沿用原来的「整数元 / 整万」两种写法。 */
  if (a >= 100000000) {
    const yi = Math.floor(a / 100000000), wan = Math.floor((a % 100000000) / 10000);
    return "¥" + (neg ? "-" : "") + yi + "亿" + (wan > 0 ? wan + "万" : "");
  }
  if (a >= 10000 && a % 10000 === 0) return "¥" + (neg ? "-" : "") + (a / 10000) + "万";
  return "¥" + n.toLocaleString("zh-CN") + "元";
}
window.GameUI.formatMoney = fmtMoney;
/* [/feature:integer-money] */
function fmtMoney2(n) { return n > 0 ? "+" + fmtMoney(n) : fmtMoney(n); }
function fmt(n) { n = Math.round(Number(n) || 0); return n > 0 ? "+" + n : String(n); }
/* [feature:staff-raise-status-ui-20261012] */
(function(ui){
 if(!ui||ui._staffRaiseStatusUI)return;ui._staffRaiseStatusUI=true;
 const detail=ui.omTeamDetail;
 ui.omTeamDetail=function(){
  const html=detail.apply(this,arguments),api=window.StaffRaiseEvents;
  if(!api||!this.core||!this.core.state)return html;
  const employee=(this.core.state.engineers||[]).find(e=>e.id===this._teamPick),status=api.status(this.core,employee);
  if(!status.active)return html;
  const label='<div class="recruit-detail-tags" data-staff-raise-penalty><span class="recruit-detail-tag">薪酬失落 · 产出 -'+Math.round((1-status.mul)*100)+'% · 剩余 '+status.weeksLeft+' 周（涨薪可解除）</span></div>';
  return html.replace('<div class="dii-title">当前状态</div>','<div class="dii-title">当前状态</div>'+label);
 };
})(window.GameUI);
/* [/feature:staff-raise-status-ui-20261012] */
