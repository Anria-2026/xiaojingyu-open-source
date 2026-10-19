/* ==========================================================================
   大模型研发养成玩法 —— 核心引擎（阶段机 + 双周循环 + 事件引擎 + 结算）
   --------------------------------------------------------------------------
   阶段机：recruit 招募 → buygpu 买卡 → direction 方向 → loop 双周循环
           → review 内部评审 → over 结算
   双周循环：推进 2 周 → 基础训练成长 → 事件触发 → 事件选项结算 → 报告+微调决策
   所有数值变化走 applyEffects 单点结算（参考几何战争"资源共享单点结算"经验）。
   ========================================================================== */
"use strict";

window.GameCore = {
  cfg: null,
  state: null,

  /* ---------------- 初始化 / 新档 ---------------- */
  init(cfg) {
    this.cfg = cfg;
    const achievements = this.achvStore();
    if (achievements && achievements.observe) achievements.observe(this);
    // Queue validation must wait for the effective (externally merged) configuration.
    if (window.ToyCloud && typeof window.ToyCloud.flushQueue === "function") window.ToyCloud.flushQueue().catch(() => {});
  },

  /* ==========================================================================
     「公开点」—— **唯一**的一处定义（2026-09-19 用户拍板：公开点 = V3.5）
     --------------------------------------------------------------------------
     背景：这个项目里「模型什么时候对公众开放」（= 保密期内测 ↔ 公测）曾经被写在
     四个地方，而且各写各的数字：
       · 教程 `t_v3_launch` 的 `ver` 与文案（game_cfg.js）
       · 结算页皮肤 `beta`（**硬编码 `verIdx < 4`**，共 3 处：game_ui ×2 / game_core ×1）
       · 注释里那句「V3 = 首次正式公开上线」
     2026-09-19 用户把公开点从 V3 挪到 **V3.5**（「V3 还没训好模型」）——
     上一轮只挪了教程，把 `beta` 落下了 ⇒ 教程说「V3.5 才公开」、结算页在 V3 就喊
     「外网用户反馈」，两边打架。现在收敛成这一处：`beta` 由它推出来，
     `test_ui_dom` 有断言守「教程 ver === PUBLIC_FROM_VER」。
     ⚠️ 改它 = 改公开点。改完请一起想：教程 ver、V1.5/V2 那批「保密期」事件（stages）、
        以及有没有阶段专属文案承诺了别的时点。
     ⚠️ `thinking`（V3 起「思考模型时代」，game_ui）是**另一件事**（模型能力代际，非公开点），
        不要顺手一起挪。 */
  PUBLIC_FROM_VER: "V3.5",
  /* 该阶段是否还在「深海内测」保密期（结算页皮肤 / 用户数单位 / 评分档位都用它） */
  isBeta(ver) {
    const V = this.cfg.VER_ORDER || ["V1"];
    const pub = V.indexOf(this.PUBLIC_FROM_VER);
    const i = V.indexOf(ver != null ? ver : ((this.state || {}).ver || "V1"));
    return pub < 0 || i < 0 ? false : i < pub;
  },

  newState() {
    const c = this.cfg;
    const s = {
      version: c.version,
      saveVersion: 0,                      // DOC 26 P0：存档格式版本号（由 game_save.migrate 升级，新档写入 1）
      ver: c.CUR_VERSION || "V1",        // 当前游戏版本（V1/V2/V3/V4，决定鲸鱼娘台词池）
      phase: "naming",         // naming 命名 | recruit | buygpu | direction | loop | review | over
      whaleName: null, // Independent character name, initialized after first naming.
      modelName: c.MODEL_NAME_DEFAULT || "小鲸鱼",   // 玩家自定义的模型名（文案 {model} 占位符）
      week: 0,                 // 当前周（初始化阶段为 0）
      weekOffset: 0,           // 跨阶段累计的周数（顶栏日历连续显示用，2026-09-08）
      bodyCalendar: null,      // 具身时代显示日历；不改生产、工资、冷却使用的累计周。
      step: 0,                 // 已完成双周决策次数
      funding: c.INIT_FUNDING,
      brand: c.INIT_BRAND,
      reputation: 0,           // 口碑（0-5 星）
      ...window.V35.dimObj(0),   // 能力维度初值（基础四维 + 追加轴，真源见 v35_core）
      gpuTier: null,           // 启用中的算力档位 id（= 已持有的最高档，决定参数上限/事件判定）
      ownedGpus: [],           // 已拥有的算力档位集合（可叠加购买，2026-09-06；低档位留存作后续事件触发条件）
      paramTarget: null,       // 目标参数规模（B）
      engineers: [],           // 已招募工程师
      candidates: [],          // 待招募候选人
      triggered: [],           // 已触发事件记录 {id, choice}
      parallel: false,         // 是否并行训练
      direction: null,         // 初始化方向选择
      pending: [],             // 本回合待展示事件队列
      lastReport: null,        // 最近一次双周报告文本
      lastGrowth: null,        // 最近一次能力成长摘要
      freeActions: null,       // 本轮自由行动可用状态（P6：{paper:true, conference:true}）
      verIdx: 0,               // 当前版本在 VER_ORDER 中的下标（P8 阶段流转）
      leader: null,            // 本阶段基线负责人（P8：立项时指定）
      lastLeader: null,        // 上一阶段负责人（连任判定用）
      leaderOverworked: false, // 连任导致精力透支（产出 ×0.7）
      tuneDrawsLeft: 0,        // 本阶段评审可用的后训练抽卡次数
      miniModels: [],          // 后训练抽卡产出的小模型 [{score}]
      users: 0,                // 累计用户数（三幕结算：全版本都有用户，内测千人级 / 公测百万级）
      rank: null,              // 全球模型能力榜名次（结算时按**评审分**对榜现算，见 finish）
      tbRound: null,           // 团队建设·本轮一次类（P7：{team:true 已团建, meeting:true 已开会}）
      tbTalked: null,          // 团队建设·1v1 已谈过的人（P7：{engId:true}）
      tbTrained: null,         // 团队建设·已培训的人（P7：{engId:true}）
      minigame: null,          // 进行中的小游戏（P5：SFT 数据质检 / RM 偏好标注）
      pendingMinigame: null,   // 排队中的小游戏（W8 招聘完成后接 SFT）
      arch: "dense",           // 模型架构（P4，V1 固定稠密，后续版本由玩家选）
      recipe: "chat",          // 数据配方（P4，V1 固定通用对话）
      corpus: (window.V35 && c.V35) ? c.V35.CORPUS_CURVE.INIT_TOKEN : (c.CORPUS ? c.CORPUS.INIT : 20),   // 语料（v35：有效 token；旧：万条）
      corpusShort: 0,          // 语料缺口比例（0~1）—— 原 baseTraining 的成长打折已随该函数删除，
                              //   现仅 v35 引擎的「语料缺口语速惩罚」在跑（见 officeTick）
      hireQuota: 3,            // V3.5.3：开局一口招 3 人（预训练即刻 + 数据 W2 + 后训练 W4 到岗）
      hiredThisRound: 0,       // 本次招聘已招几人
      hireFlow: "init",        // init 开局招聘（下一步买卡） / mid 中途招聘（下一步回训练）
      loopStep: "report",      // 双周三步子流程（用户 2026-08-29）：report 看报告 → action 双周行动 → focus 攻关方向
      fineTuneDraft: null,     // 已选择的重点攻关方向（推进时才生效）
      focus: null,             // 攻关方向 {key, boost, text}（legacy 双周链已删；v35 攻关走 s.focusBoost）
      lastFineTune: null,      // 最近一次已生效的攻关记录 {text, focus, boost}
      ap: (window.V35 && c.V35) ? 0 : (c.AP_PER_ROUND != null ? c.AP_PER_ROUND : 2),  // 行动点（v35 无此系统 → 0）
      actionLog: [],           // 本双周已打出的行动卡记录 [{id, name, targetName}]
      flags: {},               // 事件连锁标记（08 §9：M01 选 A 后可能埋 m01_leak）
      candBonus: 0,            // 事件挂的下轮候选人数加成（M07 / W06）
      tutSeen: [],             // 已看过的教学步骤 id（用户 2026-08-28：玩法变复杂，需要引导）
      investor: false,         // 投资人已入局（解锁 C02 汇报压力）
      result: null,            // 内部评审结果
      /* ---- X3：立项四步向导（方案 → 负责人 → 语料 → 确认）---- */
      dirStep: "plan",         // plan | leader | corpus | confirm
      dirPick: null,           // 已选的语料来源（选项下标），confirm 时才生效
      /* ---- X5 演出 / X6 新闻与拜访 ---- */
      pendingNews: null,       // 本轮新闻（X6：脱离事件池，独立掷骰 → UI 顶部横幅）
      newsSeen: [],            // 已出现过的新闻 id（尽量不重复）
      visitors: [],            // 已拜访过的大牛 id
      pendingVisitor: null,    // 本轮来访的大牛（{id,name,title,say,arch}）
      evalShow: null,          // 测评演出台数据（X5：{qs,total,score}）
      evalShowDone: false,     // 本阶段测评秀是否已播过（读档/重进不再重复）
      bonus: null,             // 结算奖金明细（X7：{items,total}）
      /* ---- 2026-08-30 办公室主循环（新 UI，对标《游戏发展国》）---- */
      rounds: 0,               // 已流逝回合数（1 回合 = OFFICE.MS_PER_ROUND）——**每阶段归零**
      absRounds: 0,            // 绝对回合数（跨阶段累加、永不归零）：冷却/月度额度按它记账
      officePaused: false,     // 暂停中（时间不流逝）
      planDone: false,         // 是否已立项（未立项 → 立项按钮带「待立项」红标）
      planDraft: null,         // 立项草稿 {arch, recipe, param, corpus}
      mission: null,           // 本阶段任务判定 {ver, arch, param, hit, reason, name, desc}
      incBase: 0,              // 增量经费基准：已"付过钱"的最高分（doc/23 §3.3）
      retryCount: 0,           // 本局重训次数（任务未达成 → 留在本阶段重来）
      codex: {},               // 模型库（图鉴）：{"arch:param": {times, best, first, last}}（doc/24）
      codexLog: [],            // 训练流水：每次结算追加一条（上限 CODEX.LOG_MAX）
      stageMarks: {},          // 阶段打点：{ver: 首次「通过」的完整快照}（结局动画用，doc/24）
      prodByEng: {},           // 各员工待收集产出 {engId: number}
      prodFullByEng: {},       // 产出槽已满（头像发光提示）{engId: true}
      focusBoost: null,        // 攻关中 {dim, mul, roundsLeft}
      paperResearch: null,     // 论文研究中 {id, weeks, startWeek}
      papersOwned: [],         // 已掌握的论文 id
      /* 已批准的「自研架构」（2026-09-13 用户要求）：自研路线（ARCHITECTURES[*].unlockBy ===
         "approval"：mla / dsa / csa）不走研读论文，改由团队提案事件写入这里 → 直接解锁。
         跨阶段保留；老档缺它时 loadState 会补成 []。 */
      approvedArchs: [],
      paperCandidates: [],     // 当前面板展示的候选论文 id（一屏 3 篇）
      payrollDue: (window.V35 && c.V35) ? c.V35.TICKS_PER_WEEK * 4 : ((c.PAYROLL && c.PAYROLL.PERIOD_ROUNDS) || 28), // 距下次发工资（v35：4 周 = 24 tick）
      fiscalDeficit: 0,        // 累计欠薪
      pardonUsed: false,       // 首次欠薪免责是否已用掉
      /* 2026-09-29 破产预警（用户要求）：{ver, two, one} —— 每阶段两级各提示一次。
         ver 变了就整体复位（进新阶段重新武装），见 bankruptWarn()。 */
      bankruptWarn: null,
      officeModal: null,       // 当前打开的二级面板 key
      seatOf: {},              // 员工 → 座位 id 的映射
      v35: null,               // V3.5.2 核心循环引擎状态（ensureV35 惰性创建）
      breakthroughSeen: false, // W5「突破瓶颈」剧情弹窗只弹一次
      /* ---- P4 对话树（doc/26 §5/§9/§11）---- */
      chatNode: null,          // 当前对话树节点 id（null=回到该阶段 root；跨阶段重置）
      notebook: [],            // 已解锁记事本 id（跨阶段保留，如 ["1001","1002"]）
      _lastReplyIdx: {},       // 三档随机去重：{(阶段:节点): 上次用过的下标}
      stageNo: 0,              // 阶段计数器（阶段锚点存档的归属标识，_enterStage 递增）
    };
    this.ensureV35(s);
    return s;
  },

  /* 新档：第一步是「给模型起名字」，确认后由 startProject 进入立项（招聘） */
  newGame() { this.state = this.newState(); return this.state; },

  /* ---------------- V3.5.2 引擎接入（doc/14；实现 = v35_core.js）----------------
     引擎只负责「产出 / 语料 / 攻关 / 论文 / 评审判定」的数值；经济、事件、UI 仍走本文件。
     autoFocus=false：攻关由玩家一测失败后手动选方向（引擎不再自动开）。
     paperManual=true：论文由玩家 W1 手动开研（引擎不再自动开）。 */
  v35On() {
    const c = this.cfg, s = this.state;
    return !!(c.V35 && window.V35 && s && s.v35);
  },
  ensureV35(s) {
    const c = this.cfg;
    if (!s || !c.V35 || !window.V35) return null;
    if (!s.v35) {
      s.v35 = window.V35.createState("serious", false, 0);
      s.v35.autoFocus = false;
      s.v35.paperManual = true;
    }
    return s.v35;
  },
  /* 当前是否处于下班窗口（2026-09-12 用户要求：下班后不能安排/团建）。
     与 v35_core.inOff / UI 状态灯同一口径：全局 tick ∈ [OFF_START, OFF_START+OFF_LEN)。 */
  offworkNow() {
    const s = this.state, v = this.cfg.V35;
    if (!s || !s.v35 || !v) return false;
    const t = s.v35.tick;
    const offS = v.OFF_START != null ? v.OFF_START : 18;
    const offL = v.OFF_LEN != null ? v.OFF_LEN : 3;
    return t != null && t >= offS && t < offS + offL;
  },

  /* 主职业以实例登记的 type 为准；副职升级不自动换岗（doc/53）。
     缺 type 的旧档优先用原工程师模板，再取首条非学术词条，绝不按最高等级重选。 */
  primaryTraitType(e) {
    if (!e) return null;
    if (e.type) return e.type;
    const tpl = this.engOf(e) || (e.key ? this.engByKey(e.key) : null);
    if (tpl && tpl.type) return tpl.type;
    const ts = e.traits || [];
    const t = ts.find((x) => x && x.type && x.type !== "academic") || ts.find((x) => x && x.type);
    return t ? t.type : "pretrain";
  },
  mainTrait(e) {
    const type = this.primaryTraitType(e);
    const ts = (e && e.traits) || [];
    return ts.find((t) => t && t.type === type)
      || (type === "infra" ? ts.find((t) => t && t.type === "engineer") : null)
      || { type, level: 1 };
  },
  /* 工程师 → 引擎岗位 key：按固定主职业映射。 */
  v35RoleOf(e) {
    const map = { pretrain: "pre", academic: "pre", engineer: "pre", infra: "pre", data: "data", post: "post", safety: "post", embodied: "embodied" };
    return e ? (map[this.primaryTraitType(e)] || null) : null;
  /* [feature:multi-trait-dev-core-001] */
  },
  /* 每种生产词条独立生效；同类重复仅取最高等级。职业/薪资仍走原主岗。 */
  productionTraitLevel(e, role) {
    const type = { pre: "pretrain", data: "data", post: "post", embodied: "embodied" }[role];
    if (!type) return 0;
    let level = 0;
    for (const t of (e && e.traits) || []) {
      if (t && t.type === type) level = Math.max(level, Number(t.level) || 1);
    }
    return level;
  },
  productionRoleEngs(st, role, includeRest) {
    const s = this.state, wk = s.week || 0;
    if (role === "embodied" && !this.embodiedAvailable(s)) return [];
    return (s.engineers || []).filter((e) => !e.resigned
      && this.productionTraitLevel(e, role) > 0
      && (includeRest || e.restWeek !== wk)
      && (e.joinTick == null || !st || st.tick == null || st.tick >= e.joinTick));
  /* [/feature:multi-trait-dev-core-001] */
  },
  /* 按 v35 岗位键（pre/data/post）反查当前在岗的对应工程师 id（首个未离职） */
  v35EngIdOfRole(role) {
    const s = this.state;
    const e = this.teamRoleEngs(s.v35, role)[0];
    return e ? e.id : null;
  },
  /* 岗位中文名（pre/data/post → 预训练/数据/后训练）——提示文案统一从这里取，
     不要再各写一张表（paperEffectText 里的同名局部表可逐步收编）。 */
  v35RoleName(role) {
    return ({ pre: "预训练", data: "数据", post: "后训练", embodied: "具身智能" })[role] || role || "";
  },

  /* ================= 工程师池引用规范化（doc/32 §10.3 · 2026-09-14 ID 化）=================
     池子每条 = `no`（2001+，**永不变**）+ `key`（= 原 id 字符串 "eng_42"，可读别名）+ 内容。
     **读引用一律过 engNoOf()**：认 no 数字 / 实例主键 "e2001" / 旧字符串 "eng_42"（查 LEGACY 表）/ 对象。
     **实例的运行时主键 `id` = "e" + no**（仍是字符串 ⇒ 所有 {engId:…} 映射、UI 传参、座位表
     一律不用改；换 id 只在 cloneEng 一处发生）。旧档由 readState 里的 healEngineerIds() 折叠过来。 */
  engNoOf(ref) {
    if (ref == null) return null;
    if (typeof ref === "object") return ref.no != null ? ref.no : this.engNoOf(ref.id);
    if (typeof ref === "number") return ref;
    const t = String(ref);
    if (/^e\d+$/.test(t)) return +t.slice(1);               // 实例主键
    const leg = this.cfg.ENGINEERS_LEGACY_NO || {};
    if (leg[t] != null) return leg[t];                      // 旧档字符串 id
    if (/^\d+$/.test(t)) return +t;                         // 纯数字
    return null;                                            // vis_* 之类的外来访客
  },
  engIdOf(no) { return no == null ? null : "e" + no; },
  /* ⚠️ **统一身份键**（2026-09-14 ID 化）：池子模板（有 `no`）与实例（有 `id`）必须能对上同一个键，
     否则就是「两把尺子」——踩过：招聘寻访用 `busy[c.id]`（候选人=新形态 "e2047"）配
     `busy[e.id]`（模板没有 id ⇒ undefined）⇒ 同一个模板会被重复抽中、再去重丢掉一个（9 人变 8 人），
     冷却表 `_candLocked` 同理（过期的人照样能被捞回来）。
     ⇒ 一律走这个函数取键：模板/实例 → "e"+no；访客（vis_*，没有 no）→ 自己的 id。 */
  engUid(x) {
    if (x == null) return null;
    const no = this.engNoOf(x);
    if (no != null) return this.engIdOf(no);
    return x.id != null ? String(x.id) : null;
  },
  /* 池子条目（配置侧查询一律过这两个，代码里不写死 no） */
  engOf(ref) {
    const no = this.engNoOf(ref);
    if (no == null) return null;
    return (this.cfg.ENGINEERS || []).find((e) => e.no === no) || null;
  },
  engByKey(key) { return (this.cfg.ENGINEERS || []).find((e) => e.key === key) || null; },
  engNoByKey(key) { const e = this.engByKey(key); return e ? e.no : null; },
  hasEng(ref) { return !!this.engOf(ref); },

  /* ---------------- 新手教学（用户 2026-08-28）----------------
     按 TUTORIAL 数组顺序，返回第一条「当前阶段该看、且还没看过」的步骤。
     event 步骤额外要求当前确实有待处理事件，避免开局就剧透。
     step 步骤（X8）再额外要求 loopStep 对上——行动页 / 工作间各自有自己的教学。 */
  tutorialPending() {
    const s = this.state;
    const list = this.cfg.TUTORIAL || [];
    s.tutSeen = Array.isArray(s.tutSeen) ? s.tutSeen : [];
    for (const t of list) {
      if (s.tutSeen.includes(t.id)) continue;
      if (t.ver && t.ver !== (s.ver || "V1")) continue;
      if (t.event) {
        if (s.phase === "loop" && s.pending && s.pending.length) return t;
        continue;
      }
      if (t.phase !== s.phase) continue;
      /* 阶段限定先于事件、面板等入口判断，测试档缺已读记录也不会补播初期教学。 */
      if (t.step && s.loopStep !== t.step) continue;
      /* 2026-09-11（用户反馈「为什么开局就弹」）：标了 axis 的教学要等**本模型真的长出轴**再讲 ——
         V1/V1.5 根本没有轴，开局讲它是空谈（玩家既看不到轴、也还没做过架构选择）。 */
      if (t.axis && !(s.planDone && window.V35.activeAxes(s).length > 0)) continue;
      /* 2026-08-30：新 UI 的二级面板教学（modal 字段 = 打开哪个面板时才弹），
         例如「招聘」面板第一次打开才讲招聘规则，避免开局一次性灌完。 */
      if (t.modal && s.officeModal !== t.modal) continue;
      /* 2026-09-01：非面板教学（无 modal，如 t_office）在面板打开时不弹——
         否则每次切面板都会把教学盖在面板上，关闭后还容易让人搞不清停在哪个界面。 */
      if (!t.modal && s.officeModal) continue;
      return t;
    }
    return null;
  },
  markTutorial(id) {
    const s = this.state;
    s.tutSeen = Array.isArray(s.tutSeen) ? s.tutSeen : [];
    if (id && !s.tutSeen.includes(id)) s.tutSeen.push(id);
  },

  /* 设置模型名（去空白 / 截断 / 空值回退默认名） */
  whaleName(state) {
    const s=state||this.state||{};
    const raw=s.whaleName==null?s.modelName:s.whaleName;
    return String(raw||"小鲸鱼").trim().replace(/[\s·_-]*[vV]\d+(?:\.\d+)?$/," ").trim().slice(0,12)||"小鲸鱼";
  },
  setWhaleName(value) {
    this.state.whaleName=String(value==null?"":value).trim().slice(0,12)||"小鲸鱼";
    if(window.GameSave&&GameSave.saveAuto)GameSave.saveAuto(this.state);
    return this.state.whaleName;
  },
  fillWhaleText(value) { return this.fillVars(String(value==null?"":value).replace(/小鲸鱼|鲸鱼娘/g,()=>"{whale}")); },
  setModelName(name) {
    const c = this.cfg;
    const n = String(name == null ? "" : name).trim().slice(0, c.MODEL_NAME_MAXLEN || 10);
    this.state.modelName = n || (c.MODEL_NAME_DEFAULT || "小鲸鱼");
    return this.state.modelName;
  },

  /* 命名完成 → 进入项目立项（招聘阶段才刷候选人，保证 recruit 页一定有人可选） */
  /* 起好名字 → 直接进入办公室主界面（2026-08-30 新 UI：不再先进招聘小房间）
     办公室里：立项前点「立项」按钮立项目，点「招聘」招人，其余时间看员工产出。 */
  startProject(name) {
    this.setModelName(name);
    if(this.state.whaleName==null)this.state.whaleName=this.whaleName();
    this.state.phase = "office";
    this.state.officePaused = false;
    this.state.planDone = false;
    this.state.week = this.cfg.START_WEEK != null ? this.cfg.START_WEEK : 0;
    this.recordLifeMilestone("first_project");
    /* V3.5.3 开局一口招 3 人（预训练即刻 + 数据 W2 + 后训练 W4）。强制配额=3：
       即使 state 被旧档带出的 hireQuota=1 污染，开局也一次刷满 V1 保底 3 人 */
    this.state.hireQuota = Math.max(3, this.state.hireQuota || 0);
    this.genCandidates(this.state.ver || "V1");
    this.refreshPaperCandidates();
    return this.state;
  },

  /* 立项确认（新：模型参数在这里决定，不再在买算力时决定）
     draft = {arch, recipe, param, corpusIdx} */
  /* ---------------- 收益入账统一入口（doc/20 v2.2 §7.3，2026-09-07 P3）----------------
     分红挂在 s.v35.dividend：此后**每笔收益入账**先抽 pct，抽满 times 笔自动结束。
     ⚠️ 必须走这个入口，因为「什么算收益」有三类不算（v2.1 写死）：
       ① budget  阶段预算（否则抽成比例放大，代价性质完全变了）
       ② invest  注资（投资人给的本钱，不是公司赚的钱 —— 分红抽的是经营收益）
       ③ bailout 兜底款（救命钱，同理）
     另外「事件正收入」里带 investor 旗标的那几笔（VC_TERM / INV_FOLLOW / INVESTOR_WHISPER）
     自动按 invest 处理（见 applyEffects）。 */
  addFundingIncome(amount, opts) {
    const s = this.state;
    const n = Math.max(0, Math.round(amount || 0));
    const kind = (opts && opts.kind) || "other";
    if (n <= 0) return { amount: 0, dividend: 0, net: 0, kind };
    if (kind === "budget" || kind === "invest" || kind === "bailout") {
      s.funding = (s.funding || 0) + n;
      return { amount: n, dividend: 0, net: n, kind };
    }
    const d = (s.v35 && s.v35.dividend) || null;
    let cut = 0, left = 0;
    if (d && d.pct > 0 && (d.left || 0) > 0) {
      cut = Math.round(n * d.pct);
      d.left -= 1;
      d.paid = (d.paid || 0) + cut;
      left = d.left;
      if (d.left <= 0) s.v35.dividend = null;    // 抽满 times 笔自动结束
    }
    s.funding = (s.funding || 0) + (n - cut);
    return { amount: n, dividend: cut, net: n - cut, kind, left };
  },

  /* 品牌共用口径：阶段约束防止前期事件刷满星，整数奖励向真实到账对齐。 */
  brandLimit(ver) {
    const by = this.cfg.BRAND_CAP_BY_VER || {};
    const n = Number(by[ver || (this.state && this.state.ver) || "V1"]);
    return Number.isFinite(n) ? Math.max(0, Math.min(200, Math.floor(n))) : 200;
  },
  brandStarsCount(brand) {
    const base = Number(this.cfg.BRAND_STAR_BASE ?? 80), step = Math.max(1, Number(this.cfg.BRAND_STAR_STEP ?? 30));
    const value = Math.max(0, Math.min(this.brandLimit(), Number(brand) || 0));
    return Math.max(0, Math.min(5, Math.floor((value - base) / step) + 1));
  },
  brandProgress() {
    const value = Math.max(0, Math.min(this.brandLimit(), Math.floor(Number(this.state.brand) || 0)));
    const stars = this.brandStarsCount(value);
    return { value, stars, next: stars >= 5 ? null : Number(this.cfg.BRAND_STAR_BASE ?? 80) + stars * Number(this.cfg.BRAND_STAR_STEP ?? 30),
      stageCap: this.brandLimit(), rate: Math.max(0, Math.min(1, Number(this.cfg.BRAND_INCOME_PER_STAR ?? 0.03))) * stars };
  },
  changeBrand(amount, state) {
    const s = state || this.state, cap = this.brandLimit(s.ver);
    const before = Math.max(0, Math.min(cap, Math.floor(Number(s.brand) || 0)));
    s.brand = Math.max(0, Math.min(cap, before + Math.trunc(Number(amount) || 0)));
    return s.brand - before;
  },

  /* 收益入账（分红口径的中间层：UI toast / 记账都看返回值） */
  payoutIncome(amount, opts) {
    const r = this.addFundingIncome(amount, opts);
    if (r.dividend > 0) {
      this.state.lastDividend = { cut: r.dividend, left: r.left };
    }
    return r;
  },

  /* ---------------- 立项要求单一真源（2026-09-12，任务「语料要求开放配置」）----------------
     「架构 × 参数」组合的语料门槛 / 品质配比要求：
     查表顺序 = V35.ARCH_PARAM_REQ["架构@参数"]（玩法配置可改的覆盖表）
                → 旧链路（ARCHITECTURES[].gate / ARCH_QUALITY_REQ[架构]）。
     表里没配的组合行为与改版前完全一致；周语料增量的同款覆盖在 V35.weekAdd() 里。 */
  archGate(archId, param) {
    const c = this.cfg;
    const cr = (window.V35 && window.V35.comboReq) ? window.V35.comboReq(archId, param) : null;
    if (cr && cr.gate != null) return Math.max(0, Math.round(cr.gate));
    const a = (c.ARCHITECTURES || []).find((x) => x.id === archId);
    return a ? a.gate : null;
  },
  archQualityReq(archId, param) {
    const c = this.cfg;
    const cr = (window.V35 && window.V35.comboReq) ? window.V35.comboReq(archId, param) : null;
    if (cr && cr.quality != null) return Math.max(0, Math.min(1, +cr.quality || 0));
    return (c.ARCH_QUALITY_REQ || {})[archId] || 0;
  },

  confirmPlan(draft) {
    const c = this.cfg, s = this.state;
    if (s.planDone) return { ok: false, tip: "已经立项了" };
    /* 开局引导门（doc/13 §3.4）：先招人 → 再买算力 → 才能立项开工 */
    if (!(s.engineers || []).some((e) => !e.resigned)) {
      return { ok: false, tip: "团队里还没有工程师，先去「招聘」招人" };
    }
    if (!s.gpuTier) {
      return { ok: false, tip: "还没有算力——先去「算力」购买 GPU，没算力开不了工" };
    }
    const d = draft || {};
    const arch = d.arch || "dense";
    const recipe = d.recipe || "chat";
    const param = d.param || 7;
    // V3.5.2：架构语料门槛（立项时持有量 = 开局赠予）
    const aDef = (c.ARCHITECTURES || []).find((a) => a.id === arch);
    // 架构解锁门槛：版本 + 论文双门槛（论文驱动）
    if (aDef && !this.archUnlock(aDef).ok) {
      return { ok: false, tip: this.unlockReqTip(aDef) };
    }
    if (aDef && aDef.gate != null) {
      const gate = this.archGate(arch, param);   // 架构×参数覆盖表 → 架构 gate（2026-09-12）
      const have = this.v35On() ? s.v35.corpus.token : (s.corpus || 0);
      if (gate != null && have < gate) {
        return { ok: false, tip: `语料不足：${aDef.name} 需有效 token ≥ ${gate}（当前 ${Math.floor(have)}）` };
      }
    }
    // 架构还有算力门槛要求（beyond 参数上限）：当前算力档位不得低于架构要求的下限档
    if (aDef && aDef.gpu) {
      const order = c.GPU_TIER_ORDER || Object.keys(c.GPU_TIERS || {});
      const curI = order.indexOf(s.gpuTier || "basic");
      const needI = order.indexOf(aDef.gpu);
      if (curI >= 0 && needI >= 0 && curI < needI) {
        const needName = ((c.GPU_TIERS || {})[aDef.gpu] || {}).name || aDef.gpu;
        return { ok: false, tip: `算力要求：${aDef.name} 需要${needName}档算力起步，先去「算力」升级` };
      }
    }
    // 参数规模校验：不得超过算力档位上限 ∪ 架构最大可选参数
    const capNow = this.archMaxParam(arch);
    if (aDef && aDef.minParam != null && param < aDef.minParam) {
      return { ok: false, tip: `${aDef.name} 需要至少 ${aDef.minParam}B 的云端基座` };
    }
    if (param > capNow) {
      return { ok: false, tip: `参数 ${param}B 超出上限 ${capNow}B，先升级算力或换架构` };
    }
    s.arch = arch;
    s.recipe = recipe;
    s.paramTarget = param;
    s.planDone = true;
    /* 阶段任务目标（doc/23）：立项即判定。2026-09-29 起只看「架构 + 参数」
       （组合去重已取消 → 不再写 usedCombos，同一组合可以反复训练）。 */
    const mj = this.missionJudge(s, arch, param);
    const mDef = this.missionOf(s.ver);
    s.mission = { ver: s.ver, arch, param, hit: !!mj.hit, reason: mj.reason || "",
                  name: mDef.name || "", desc: mDef.desc || "" };
    /* 语料品质配比（2026-09-03）：三品质 20% 一档（合计 ≤ 5 格），未分配按普通计；
       架构对「良好+优质」占比（ARCH_QUALITY_REQ）达标 → 提速 / 不达标 → 降速（CORPUS_QUALITY 可配） */
    const CQ = c.CORPUS_QUALITY || {};
    const step = CQ.STEP || 0.2;
    let mix = d.mix || {};
    const cell = (v) => Math.max(0, Math.min(5, Math.round(+v || 0)));
    const mixCells = { n: cell(mix.n), g: cell(mix.g), p: cell(mix.p) };
    if (mixCells.n + mixCells.g + mixCells.p > 5) mixCells.n = Math.max(0, 5 - mixCells.g - mixCells.p);
    /* 语料品质配比 → 库存校验（2026-09-03）：所选「良好/优质」格数不得超出库存中该品质的可配格数。
       ⚠️ 2026-09-30 修口径 BUG：必须按**折算 token**（条数 × QUALITY_MULT）比较，不能按原始条数 ——
       语料面板每档展示的就是「条数 × 倍率 → 折算 token」，语料要求 / 门槛（archGate）也全是 token 口径；
       按条数算会系统性低估高品档（1 条优质 = 3 条普通的价值），于是出现玩家反馈的自相矛盾：
       「语料面板显示优质折算占比 60%+、语料也充裕，立项按钮却报『优质语料不足（库存可配约 2/5 格）』」。
       ⚠️ game_ui.js `planReady()` 里的镜像判定必须与本处**同口径、同文案**（按钮置灰用那份）。 */
    if (this.v35On()) {
      const q = (s.v35 && s.v35.corpus && s.v35.corpus.q) || [];
      const MULT = (c.V35 && c.V35.QUALITY_MULT) || [0.5, 1.0, 1.5];
      const raw = (i) => (q[i] || 0) * (MULT[i] != null ? MULT[i] : 0.5);
      const total = raw(0) + raw(1) + raw(2);
      if (total > 0) {
        const maxG = Math.round((raw(1) / total) * 5);
        const maxP = Math.round((raw(2) / total) * 5);
        if (mixCells.g > maxG) return { ok: false, tip: `良好语料不足（良好折算 ${Math.round(raw(1))} / 共 ${Math.round(total)} 亿 token，最多可配 ${maxG}/5 格）` };
        if (mixCells.p > maxP) return { ok: false, tip: `优质语料不足（优质折算 ${Math.round(raw(2))} / 共 ${Math.round(total)} 亿 token，最多可配 ${maxP}/5 格）` };
      }
    }
    const shareGP = (mixCells.g + mixCells.p) * step;               // 良好+优质合计占比
    const req = this.archQualityReq(arch, param);                   // 架构×参数覆盖表 → 顶层表（2026-09-12）
    const bonus = CQ.BONUS != null ? CQ.BONUS : 0.10;
    const penalty = CQ.PENALTY != null ? CQ.PENALTY : 0.15;
    const qualityMul = req <= 0 ? 1 : (shareGP >= req - 1e-9 ? 1 + bonus : 1 - penalty);
    /* 同步给 v35 引擎：每周语料增量按「架构 × 参数」算，引擎结算需求曲线要用 */
    if (s.v35) {
      s.v35.arch = arch; s.v35.paramTarget = param;
      s.v35.qualityMix = mixCells;
      s.v35.qualityMul = qualityMul;
    }
    /* V3.5.4：移除「语料来源」立项步骤（用户要求），不再有 corpusIdx 一次性增减益 */
    s.direction = null;
    s.embodiedPlanTick = (s.v35 && s.v35.tick) || 0;
    s.embodiedTrainingTicks = 0;
    s.triggered.push({ id: "plan", choice: `${arch}/${recipe}/${param}B`, week: s.week || 0 });
    return {
      ok: true, arch, recipe, param,
      mission: s.mission,
      quality: { cells: mixCells, shareGP, req, mul: qualityMul,
                 tip: req > 0 ? (qualityMul > 1 ? `语料品质达标：产出速度 ×${qualityMul.toFixed(2)}` : `语料品质未达标：产出速度 ×${qualityMul.toFixed(2)}`) : null },
    };
  },

  /* 购买算力（2026-09-06 改为可叠加持有）：
     ownedGpus = 拥有的档位集合（重复买同档拒绝）；gpuTier = 其中最高档
     （参数上限 / 事件判定用它）。低档位买来不浪费——后续事件可按「是否拥有某档」触发。 */
  buyGpu(tier) {
    const c = this.cfg, s = this.state;
    const t = (c.GPU_TIERS || {})[tier];
    if (!t) return { ok: false, tip: "没有这一档" };
    if (!Array.isArray(s.ownedGpus)) s.ownedGpus = s.gpuTier ? [s.gpuTier] : [];
    if (s.ownedGpus.includes(tier)) return { ok: false, reason: "owned", tip: "已拥有该档位，无需重复购买" };
    if ((s.funding || 0) < t.price) return { ok: false, tip: "经费不够" };
    s.funding -= t.price;
    s.ownedGpus.push(tier);
    // 启用档切到已持有的最高档；参数目标只在最高档上限缩水时压回
    const order = c.GPU_TIER_ORDER || Object.keys(c.GPU_TIERS || {});
    const top = order.filter((k) => s.ownedGpus.includes(k))
      .sort((a, b) => ((c.GPU_TIERS[b] || {}).maxParam || 0) - ((c.GPU_TIERS[a] || {}).maxParam || 0))[0];
    if (top) s.gpuTier = top;
    const maxNow = (c.GPU_TIERS[s.gpuTier] || {}).maxParam || 7;
    if (s.paramTarget > maxNow) s.paramTarget = maxNow;
    return { ok: true, tier, price: t.price, maxParam: t.maxParam };
  },

  /* 是否拥有某档算力（可叠加持有；后续事件触发条件用，如 cond.owned_gpu="standard"） */
  ownsGpu(tierId) {
    const s = this.state;
    if (!Array.isArray(s.ownedGpus)) s.ownedGpus = s.gpuTier ? [s.gpuTier] : [];
    return s.ownedGpus.includes(tierId);
  },

  /* 读档：校验 + 合并默认结构（防旧档缺字段） */
  loadState(s) {
    const def = this.newState();
    this.state = Object.assign(def, s || {});
    /* DOC 26 P0：存档格式版本号兜底（新档由 game_save 写入，这里防老档/直接 newState 无该字段） */
    if (this.state.saveVersion === undefined) this.state.saveVersion = 0;
    if (!Array.isArray(this.state.triggered)) this.state.triggered = [];
    if (!Array.isArray(this.state.pending)) this.state.pending = [];
    if (!Array.isArray(this.state.engineers)) this.state.engineers = [];
    /* 已批准的自研架构（2026-09-13）：老档没有这个字段 → 补空数组，
       否则 archUnlock 里 `.includes` 会在 undefined 上抛错（表现为整个立项面板打不开）。 */
    if (!Array.isArray(this.state.approvedArchs)) this.state.approvedArchs = [];
    /* 算力可叠加（2026-09-06）：旧档没有 ownedGpus → 按已有 gpuTier 反推 */
    if (!Array.isArray(this.state.ownedGpus)) {
      this.state.ownedGpus = this.state.gpuTier ? [this.state.gpuTier] : [];
    }
    if (this.state.fineTuneDraft === undefined) this.state.fineTuneDraft = null;
    if (this.state.lastFineTune === undefined) this.state.lastFineTune = null;
    // 版本校验：以 VER_ORDER（阶段唯一权威顺序）为准；异常/旧档缺失时回退当前正式版本。
    // 否则读取存档后 genCandidates 会按高版本系数概率刷出顶级人才（曾出现）。
    // ⚠️ 2026-09-09 修：原来借用 TRAIN_STAGES（= 工程师可刷出阶段，只列 V1/V2/V3/V4 大版本）
    //    做校验，导致 V1.5/V2.5/V3.5 存档重载被回退成 V1（半阶段进度丢失）。
    const order = this.cfg.VER_ORDER || ["V1"];
    if (order.indexOf(this.state.ver) < 0) this.state.ver = this.cfg.CUR_VERSION || "V1";
  /* [feature:review-income-base-load] */
    // Only committed records repair the old retry reset; never change saved cash.
    this.state.incBase = this.reviewIncomeBase(this.state);
  /* [/feature:review-income-base-load] */
    if(this.state.phase!=="naming"&&this.state.whaleName==null)this.state.whaleName=this.whaleName();
    [...(this.state.engineers||[]),...(this.state.candidates||[])].forEach(e=>{
      this.healEngineeringTalent(e);
      if(e)this.ensureStatus(e); // 缺个人体力独立初始化，已有值（包括0）保留。
    });
    if(this.embodiedAvailable(this.state)){this.state.rank=null;if(this.state.result){for(const key of ["rankPrev","rankUp","rankBoardLen"])this.state.result[key]=null;}}
    // 旧档已结算收入保留；品牌只校正到当前阶段允许的范围，不储存超额待解锁值。
    this.changeBrand(0);
    if (!this.state.brandMilestones || typeof this.state.brandMilestones !== "object" || Array.isArray(this.state.brandMilestones)) {
      this.state.brandMilestones = {};
      order.slice(0, order.indexOf(this.state.ver)).forEach(v => { this.state.brandMilestones[v] = true; });
    }
    /* 三幕结算（doc/16 §9）旧档用户数一次性迁移：旧规则 V1~V2.5 没有用户（恒 0），
       V3+ 按 score×1200 累计；新规则全版本都有用户（内测千人级 / 公测百万级）。
       只迁移一次：内测阶段出现 users > 10000 只可能是旧口径脏档（新规则内测封顶约 6 千），清零；
       公测旧档与内测正常用户数（新规则 V1 ≈ 800）一律保留。 */
    if (!this.state.usersMigrated) {
      this.state.usersMigrated = true;
      const vorder = this.cfg.VER_ORDER || ["V1"];
      if ((this.state.users || 0) > 10000 && vorder.indexOf(this.state.ver) < 4) this.state.users = 0;
    }
    /* 2026-09-05 用户反馈「W4 之后无提示停走」：暂停状态不该跨会话持久——
       事件弹窗（pause）把 officePaused=true 写进了存档，读档后事件卡不重挂 →
       时间冻结、界面无任何解释。读档一律恢复运行；悬挂事件也一并丢弃（不跨会话补弹）。 */
    this.state.officePaused = false;
    this.state.pendingEvent = null;
    /* 2026-10-04 死档兜底：提案「让路计时」也一并清。它记的是「本次让路从第几个 tick 开始等」，
       跨会话沿用会把新阶段/新存档的**第一次**让路直接判成超时（还没开始等就被接管）⇒ 抢弹窗。 */
    this.state._propYieldSince = null;
    /* 2026-09-23 修 BUG（玩家：「一直刷新重进的话，属性会莫名其妙增加，或者增加得特别快」）：
       产出节流时钟 `_tickAt` 是 **epoch 毫秒**，会随存档一起持久化；而 officeTick 用
       `now - _tickAt >= 周期` 判定是否推进 ⇒ 读档后这个间隔是「上次游戏到现在」，
       必然远超一个产出周期（重进要过加载屏 + 主菜单，>10s）⇒ **读档后第一次 tick 白送一回合产出**。
       反复刷新 = 反复白送（实测连刷 10 次白送 9 回合 ≈ 90 秒产出，属性肉眼可见地涨）。
       与上面 officePaused / pendingEvent 同一条口径：**运行期时钟不该跨会话持久**。
       置 0 即可 —— officeTick 里 `if (!s._tickAt) s._tickAt = now` 会重新起算，
       下一次产出仍要等满一个周期，节奏不受影响。 */
    this.state._tickAt = 0;
    /* ---- 成就计数器的**读档自愈**（doc/35 §4.1.1 / §6.11）----
       ① `hireCount` 缺失且队里已超过开局三人 ⇒ 老档会被当成"零招聘"，**白送**传说成就
          （「三人成军」）⇒ 置 1 表示"招过人"；
       ② `s.c2.seen` 缺失 ⇒ 用 `lastAns` 至少补种一条（能补一点是一点，聊过的部分不白丢）；
       ③ 其余计数器（verRetry / rank1Params / rankLog / fundingZeroTimes）缺字段一律按 0 起算
          —— 这是可接受的：这些成就从本版本起重新累计。 */
    if (this.state.hireCount == null && (this.state.engineers || []).length > 3) {
      this.state.hireCount = 1;
    }
    if (this.state.c2 && typeof this.state.c2 === "object"
        && (!this.state.c2.seen || typeof this.state.c2.seen !== "object")) {
      const _la = this.state.c2.lastAns;
      this.state.c2.seen = {};
      if (_la) this.state.c2.seen[String(_la)] = this.state.week || 0;
    }
    /* [feature:chat-load-cursor] */
    this.healC2();
    /* [/feature:chat-load-cursor] */
    this.achvCounters();
    // 招募阶段读档：
    // - V1 保底是确定性刷出 → 仅在「还没招人」时重刷保底；已招人则保留存档候选人。
    //   （BUG 修复 2026-08-28：此前无条件重刷，导致刷新浏览器后已招聘的两人
    //    又出现在候选人列表——同一批人既在团队里又能再招一遍。）
    // - 非 V1 → 保留存档中已抽到的候选人，仅当缺失时置空。
    // - 兜底：候选人里剔除已在团队中的 id；工程师按 id 去重。
    // 2026-08-30 新 UI：招聘在办公室里以二级面板进行，phase 恒为 office
    if (this.state.phase === "recruit" || this.state.phase === "office") {
      // 读档时直接跳过命名页：能存到档说明早就命名过了（老存档 phase 也不会是 naming）
      if (!this.state.modelName) this.state.modelName = this.cfg.MODEL_NAME_DEFAULT || "小鲸鱼";
      if (this.state.ver === "V1" && this.state.engineers.length === 0) {
        this.state.hireQuota = Math.max(3, this.state.hireQuota || 0);   // 开局强制一口 3 人
        this.genCandidates(this.state.ver);
      } else if (!Array.isArray(this.state.candidates)) {
        this.state.candidates = [];
      }
      const hiredIds = new Set(this.state.engineers.map((e) => e.id));
      if (Array.isArray(this.state.candidates)) {
        this.state.candidates = this.state.candidates.filter((c) => !hiredIds.has(c.id));
      }
      // 极端兜底：团队内重复 id（历史脏档）去重，保留第一个
      const seen = new Set();
      this.state.engineers = this.state.engineers.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    }
    const legacyPhases = ["loop", "minigame", "recruit", "buygpu", "direction"];
    // V3.5.2 迁移：旧档补建引擎状态（数值从主状态回填；旧语料按普通品质折算条数）
    const v35 = this.ensureV35(this.state);
    /* 存档加固（2026-09-12）：旧档缺后加字段会让引擎 tick 每帧抛异常 ——
       表现即「时间/体力全部卡住不动，只弹异常提示」。这里把 v35 补全到
       当前版本 createState() 的模板形状（只补缺、不覆盖），以后引擎加任何
       新字段，旧档读入即自动补齐，不再逐版本打补丁。 */
  /* [feature:last-engineer-load-risk] */
    if (v35) this.normalizeV35(v35);
    this.clearLonePoachRisk(this.state);
  /* [/feature:last-engineer-load-risk] */
    /* 2026-09-12 修 BUG（用户旧档实测：打到 V1.5 语料品质全变普通）：下面这段迁移只该
       服务「引擎状态刚建、还没接管过」的最老档 —— 原判定只看 tick===0，而 _enterStage
       每次进新阶段都会把 tick 归零、语料跨阶段延续 → 阶段开头的正常存档读入时也命中，
       引擎里带品质结构的 corpus（q=[普通,良好,优质]）被「按全普通反解」的旧公式整表覆盖。
       守卫：主状态与引擎已同步（差值 <1）→ 说明引擎早已接管，绝不回填。 */
    if (v35 && v35.tick === 0) {
      const _corpusSynced = v35.corpus
        && Math.abs((v35.corpus.token || 0) - (this.state.corpus || 0)) < 1;
      const _statsSynced = v35.stats
        && Math.abs((v35.stats.code || 0) - (this.state.code || 0)) < 1
        && Math.abs((v35.stats.text || 0) - (this.state.text || 0)) < 1;
      if (!_corpusSynced && !_statsSynced
          && ((this.state.code || 0) + (this.state.text || 0) + (this.state.corpus || 0) > 0)) {
        v35.tick = this.state.rounds || 0;
        v35.stats = { code: this.state.code || 0, text: this.state.text || 0,
                      safety: this.state.safety || 0, stability: this.state.stability || 0 };
        const _mi = Math.round((this.state.corpus || 0) / 0.5);
        v35.corpus = { token: this.state.corpus || 0, items: _mi, q: [_mi, 0, 0] };
      }
    }
    /* 老档修复（2026-09-08）：论文研究卡死 —— 阶段切换重置了 v35.paper 但没清 s.paperResearch，
       left 已归 0 → 完成判定永不成立。读档时直接把在研论文结掉，别让玩家继续卡着。 */
    if (this.state.paperResearch && v35 && v35.paper && !v35.paper.done && (v35.paper.left || 0) <= 0) {
      const _spid = this.state.paperResearch.id;
      if (_spid && (this.state.papersOwned || []).indexOf(_spid) < 0) {
        (this.state.papersOwned = this.state.papersOwned || []).push(_spid);
      }
      this.state.paperResearch = null;
    }
    /* 2026-09-30 修 BUG（玩家：「旧存档进评审直接跳过答题」）：评审页的题**只来自存档里的
       `s.evalShow`**（renderEvalShow 只读它），而 loadState / migrate **从不重建**它 ⇒
       凡是「进了评审、但那一刻没写 evalShow」的存档（历史 `to-review` 入口 / 更老版本），
       读档后一律是「演出台在、一道题都没有、只剩『跳过 · 直出结果』」——玩家的观感就是
       直接跳过了答题。这里按需重建（存档自愈，与上面几条同一条口径）。
       ⚠️ 只影响演出观感：总评 `s.result` 早在 enterReview() 里算好，重建不动它。 */
    if (this.state.phase === "review"
        && (!this.state.evalShow || !(this.state.evalShow.qs || []).length)) {
      this.buildEvalShow();
    }

    /* V3.5.2 旧流程存档归一：老档可能停在双周循环/招聘/买卡等旧 phase，
       直接丢回办公室（v35 流程承接元进度），否则会卡在旧 UI 且菜单失灵 */
    if (legacyPhases.includes(this.state.phase)) {
      this.state.phase = 'office';
      this.state.pending = [];
      this.state.pendingMinigame = null;
      this.state.loopStep = 'report';
      this.state.fineTuneDraft = null;
      this.state.workClicks = {};
      this.state.workQuota = {};
      this.state.workGain = null;
      this.state.corpusShort = 0;
      this.state.corpusDemand = null;
      this.state.focus = null;
      this.state.focusBoost = null;
      this.state.officeModal = null;
      this.state.officePaused = false;
      this.state._tickAt = 0;
      // 团队为空 → 重新刷 V1 保底并打开招聘面板
      if (!this.state.engineers.length) {
        this.state.hireQuota = Math.max(3, this.state.hireQuota || 0);   // 开局强制一口 3 人
        this.genCandidates('V1');
        this.state.officeModal = 'recruit';
      }
    }
    // 旧流程已掌握的论文 → 引擎侧永续效果生效
    if ((this.state.papersOwned || []).length) {
      v35.paper.started = true;
      v35.paper.done = true;
    }
    /* 扩编寻访单校验（2026-09-12 配合 game_save 保留 hireOrder）：跨会话恢复的
       寻访单若已残缺（缺岗位/缺时长），宁可丢弃也不能让 V35Hire.tick 每帧崩 */
    if (this.state.hireOrder
        && (!Array.isArray(this.state.hireOrder.roles) || !this.state.hireOrder.roles.length
            || !(this.state.hireOrder.total > 0))) {
      this.state.hireOrder = null;
    }
    /* ---- 阶段锚点兜底（2026-09-12）----
       每个阶段开始都会写「本阶段开头」快照（GameSave.saveStage，独立键不占手动槽）。
       老档 / 锚点缺失时，首次读档即补一份当前状态当锚点（老档最早已是此刻，
       之后每个阶段切换都会正常刷新锚点）。stageNo = 阶段计数器，防止同一阶段
       内多次读档把锚点越推越新。 */
    /* ---- 论文候选自愈（2026-09-13 用户反馈「旧存档还是没看到解锁 V3.5 的论文」）----
       paperCandidates 是存进存档的快照：改配置 / 调钥匙链条都不会让旧档重算。
       读档时按当前配置补一次（只补不删，详见 healPaperCandidates）。放在锚点写入之前，
       这样阶段锚点里存的也是补好的候选。 */
    this.healPaperCandidates();
    this.healEventIds();
    this.healEngineerIds();          // 2026-09-14 工程师 ID 化：旧档主键 "eng_42" → "e2047"
    this.healNotebook();             // 2026-10-01 记事本：清掉 NOTES 表里已不存在的幽灵 id（老档 ["1001","1002"]）
    this.healCandExpire();           // 2026-10-01 招聘：给无失效周的兜底占位人补票（老档里无限等待的「周老师」们）
    this.healTraitDups();            // 2026-10-04 词条：折叠同 type 重复（旧档快照里带着「预训练LV4+LV3」）
/* [feature:embodied-recruit-stage-load] */
    this.healEngineerRoles();        // doc/53：缺主职业的旧档一次迁移，副职升级不换岗
    // 历史候选快照不能绕过 V5 门槛；已在职成员及合法候选快照原样保留。
    if (Array.isArray(this.state.candidates)) this.state.candidates = this.state.candidates.filter(e => this.hireStageEligible(e, this.state.ver));
/* [/feature:embodied-recruit-stage-load] */
    for (const role of ["pre", "data", "post", "embodied"]) this.syncEnergySlot(role);
    this.syncResting();              // 旧档休假者的爆发立即清理，不等待下一 tick
    this.healEmbodiedEra();
    const previousCalendar = this.state.bodyCalendar;
    const bodyCalendar = this.ensureBodyCalendar();
    const calendarChanged = bodyCalendar && bodyCalendar !== previousCalendar;
    this.healStageEvents();          // V5 旧事件与 SFT/RM 暂停所有者不跨主题残留
    this.healDimOverCap();           // 2026-10-04 维度：把超出 statCap 的四维/轴拉回上限（改档刷分）
    if (this.state.phase === "review") this.refreshReviewResult();
    if (typeof this.state.stageNo !== "number") this.state.stageNo = 0;
    if (window.GameSave && window.GameSave.loadStage && window.GameSave.saveStage) {
      const anchor = window.GameSave.loadStage();
      if (!anchor || !anchor.state || anchor.state.stageNo !== this.state.stageNo) {
        window.GameSave.saveStage(this.state);
      }
    }
    // Persist repair before the player can leave without taking an action.
    // The stage repair writes only its calendar field, never its training state.
    if (bodyCalendar && window.GameSave) {
      if (calendarChanged && typeof window.GameSave.autoSave === "function") window.GameSave.autoSave(this.state);
      if (typeof window.GameSave.patchStageBodyCalendar === "function") window.GameSave.patchStageBodyCalendar(this.state);
    }
    this.checkLifeAchievements(); // Quiet old-save backfill; keep the current reward reveal.
    return this.state;
  },

  /* ---------------- 存档加固：引擎状态模板化补全（2026-09-12）----------------
     根因：v35 引擎状态由 createState() 建形状，但 migrate() 只逐版本补过一小批字段——
     任何「后加字段没进 migrate」的旧档，V35.tick 一进来就在缺字段处抛 TypeError
     （energy/quota/weekly/focus/paper 全都可能踩），officeTick 每秒 toast 异常、
     时间与体力全部卡死（用户实测：旧存档体力不升不降）。
     这里统一按**当前版本的 createState() 模板** deep-fill：
       · 只补缺失键、绝不覆盖已有值 → 幂等，重复调用无副作用；
       · 以后 createState() 加任何新字段，旧档读入自动补齐——不再需要逐版本打补丁；
       · 数值字段做合法性兜底（NaN / 负数 / 越界拉回），配置再脏也不让 NaN 流进引擎。 */
  normalizeV35(st) {
    if (!st || !window.V35) return st;
    const tpl = window.V35.createState(st.mode || "serious", !!st.overtime,
      st.extraData || 0, st.extraPre || 0, st.extraPost || 0);
    const fill = (dst, src) => {
      for (const k of Object.keys(src)) {
        const v = src[k], d = dst[k];
        if (d === undefined || d === null) { dst[k] = v; continue; }
        if (v && typeof v === "object" && !Array.isArray(v)
            && d && typeof d === "object" && !Array.isArray(d)) fill(d, v);
      }
      return dst;
    };
    fill(st, tpl);
    const num = (v, dft) => (typeof v === "number" && isFinite(v)) ? v : dft;
    /* 体力槽：0~100 夹紧（NaN 会让整个槽永远停在原值） */
    for (const k of ["pre", "data", "post", "embodied"]) {
      st.energy[k] = Math.max(0, Math.min(100, num(st.energy[k], 100)));
    }
    /* 数值容器：stats 全维度非负；语料非负；tick 非负整数 */
    for (const k of Object.keys(st.stats)) st.stats[k] = Math.max(0, num(st.stats[k], 0));
    st.corpus.token = Math.max(0, num(st.corpus.token, 0));
    st.corpus.items = Math.max(0, num(st.corpus.items, 0));
    if (!Array.isArray(st.corpus.q) || st.corpus.q.length !== 3) st.corpus.q = [0, 0, 0];
    st.corpus.q = st.corpus.q.map((x) => Math.max(0, num(x, 0)));
    st.tick = Math.max(0, Math.floor(num(st.tick, 0)));
    st.preMul = num(st.preMul, 1) || 1;
    st.qualityMul = num(st.qualityMul, 1) || 1;
    if (st.ver == null) st.ver = this.state.ver || "V1";
    return st;
  },

  /* ---------------- 招募 ----------------
     候选人从配置的工程师池（GameCfg.ENGINEERS）刷出：
     - V1 阶段：固定刷保底候选人（V1_STARTERS），不走概率、不收费
     - 其它阶段：**共享池**（doc/22 v1.2）—— 不再按 e.stage 白名单分组
       （旧规则下 V1.5 / V2.5 / V3.5 池子 = 0 人，那三个阶段根本招不到人）；
       2026-09-12 用户拍板：「从本阶段圈定的池子里随机捞」，概率 = **池子自身的分布**
       × HIRE_LV_RANGE_BY_VER[阶段].lv 的等级权重（只限上限、不限下限）
     - 天赋数值带 ±HIRE_FLOAT 随机浮动；薪资随浮动后的核心天赋重算
     - 完整档案（头像/简历/属性/词条）来自配置 */
/* [feature:embodied-recruit-stage-eligibility] */
  /* 所有候选渠道共用同一阶段门槛；副具身词条也在 V5 开放，不裁改档案。 */
  hireStageEligible(e, stage) {
    if (!e) return false;
    const template = this.engOf(e);
    const traits = Array.isArray(e.traits) ? e.traits : ((template && template.traits) || []);
    const requiresBody = this.primaryTraitType(e) === "embodied"
      || traits.some(t => t && t.type === "embodied");
    return !requiresBody || this.embodiedAvailable({ ver: stage || (this.state && this.state.ver) || "V1" });
  },
  genCandidates(stage) {
/* [/feature:embodied-recruit-stage-eligibility] */
    const c = this.cfg;
    const st = stage || this.state.ver || "V1";
    const week = this.state.week || 0;
    // V1 保底：固定 n 位，强制招募
    if (st === "V1" && c.V1_STARTERS && c.V1_STARTERS.length) {
      // P2：开局只刷第 1 位（算法工程师），后续人员由 W4 / W8 的节点事件逐个引入
      const n = Math.max(1, Math.min(this.state.hireQuota || 1, c.V1_STARTERS.length));
      /* ⚠️ ID 化后这里比的是**池子编号**（V1_STARTERS 里存的是 no）——
         用 engNoOf 兜一层，旧配置里还写着 "eng_v1a" 也能认。 */
      const ids = c.V1_STARTERS.slice(0, n).map((x) => this.engNoOf(x));
      /* 2026-09-29 修「卡出两个苏小满」：重刷候选（如 E101「等待招聘」事件）时**排除已在职者**，
         否则开局三人会被原样再列一遍，录用即产生同 id 的重复成员（刷新后被 loadState 去重，
         所以玩家看到的是「刷新就没了」）。 */
      const hired = new Set(this.state.engineers.map((e) => this.engUid(e)));
/* [feature:embodied-recruit-stage-starters] */
      const starters = (c.ENGINEERS || []).filter((e) => ids.indexOf(e.no) >= 0 && !hired.has(this.engUid(e)) && this.hireStageEligible(e, st));
/* [/feature:embodied-recruit-stage-starters] */
      /* 2026-09-07：保留扩编寻访（fromHire）与事件慕名而来（fromEvent）的人 ——
         刷候选 ≠ 作废玩家花 3 万等来的人选 / 事件履约的人选 */
/* [feature:embodied-recruit-stage-starter-kept] */
      const keep = (this.state.candidates || []).filter((x) => (x.fromHire || x.fromEvent) && this.hireStageEligible(x, st));
/* [/feature:embodied-recruit-stage-starter-kept] */
      this.state.candidates = starters.map((e) => this.cloneEng(e)).concat(keep);
      return this.state.candidates;
    }
    this.expireCandidates(week);
    /* 2026-09-12 用户拍板的新规则：**从圈定的池子里随便捞一个** ——
       ① 池子 = 本阶段等级上限内的候选人（hirePool）
       ② 谁的概率大，取决于**池子自身的分布**（哪个等级人多就更容易出）
       ③ 阶段只额外给一份「等级权重」（hireWeightOf）来微调
       稀有度权重 / 阶段稀有度系数 / 口碑系数（HIRE_WEIGHTS 等）已退役，不再参与抽取。 */
/* [feature:hire-refresh-cooldown-recovery] */
    // 寻访/事件候选已履约，先保留并排除；普通刷新不能清空或重刷其耐心。
/* [feature:embodied-recruit-stage-refresh-kept] */
    const keepHire = (this.state.candidates || []).filter(x => (x.fromHire || x.fromEvent) && this.hireStageEligible(x, st));
/* [/feature:embodied-recruit-stage-refresh-kept] */
    const pool = this.hireDrawPool(st, {
      candidates: keepHire,
      filter: e => this.hireWeightOf(e, st) > 0,
    });
    if (!pool.length) { this.state.candidates = keepHire; return this.state.candidates; }
/* [/feature:hire-refresh-cooldown-recovery] */
    const float = c.HIRE_FLOAT || 0;
    const weighted = [];
    for (const e of pool) {
      const w = this.hireWeightOf(e, st);
      for (let k = 0; k < Math.max(1, Math.round(w * 100)); k++) weighted.push(e);
    }
    // 加权抽取（重复放入按权重放大命中概率），去重取 CANDIDATE_COUNT 位
    // 候选人数 = 基础 + 事件奖励位（08 §9：M07 高校讲座 / W06 行业标杆 → 下轮候选 +1）
    const bonus = this.state.candBonus || 0;
    const want = 4 + bonus;   // 论文面板每页 4 篇（原 CANDIDATE_COUNT 配置已退役）
    const picked = [];
    const seen = new Set();
    let guard = 0;
    while (picked.length < want && weighted.length && guard++ < 500) {
      const idx = Math.floor(Math.random() * weighted.length);
      const e = weighted[idx];
      if (seen.has(e.no)) continue;         // ID 化：去重键 = 池子编号
      seen.add(e.no);
      picked.push(e);
    }
    // 池内不足时补随机
    for (const e of pool) {
      if (picked.length >= want) break;
      if (!seen.has(e.no)) { seen.add(e.no); picked.push(e); }
    }
/* [feature:hire-refresh-preserve-offers] */
    this.state.candidates = picked.map((e) => this.cloneEng(e, float, st)).concat(keepHire);
/* [/feature:hire-refresh-preserve-offers] */
    if (bonus) this.state.candBonus = 0;
    return this.state.candidates;
  },

  /* 工程师天赋档（2026-09-12 用户拍板：**只看天赋数值本身**，不再和词条等级取高）
     阈值是配置 TIER_THRESHOLDS（[良好, 优秀, 天才, 大牛] 四档下限，配置可改）——
     代码里不再写死任何数字。想显示「天才-lv3」请用 tierLabel(e)。
     若配置给这个人手填了 rarity（rare 角色），直接采用（覆盖自动判定）。 */
  tierOf(e) {
    const C = this.cfg.TIER_COLORS || {};
    if (e && e.rarity && C[e.rarity]) {
      return { clsKey: e.rarity, ...C[e.rarity] };
    }
    const T = this.cfg.TIER_THRESHOLDS || [60, 70, 80, 90];
    const t = this.coreTalentOf(e);
    const key = t >= (T[3] != null ? T[3] : 90) ? "rainbow"
      : t >= (T[2] != null ? T[2] : 80) ? "orange"
      : t >= (T[1] != null ? T[1] : 70) ? "pink"
      : t >= (T[0] != null ? T[0] : 60) ? "blue" : "gray";
    return { clsKey: key, ...(C[key] || {}) };
  },

  /* 该工程师的「等级」= 拥有的**最高**那条词条的等级（2026-09-12 用户定）
     ⚠️ 与 mainTraitLevel（固定主职业对应词条）不同 —— 标识、招聘等级、等级上限都用这个。
     ⚠️ 2026-09-25 用户定：**学术（academic）是辅助词条，不计入等级**。
        学术自身不升级，只给同一人的其它词条加算升级概率（TRAIT_UPGRADE.ACADEMIC_BOOST），
        若算进等级，会把「低天赋 + 高学术」的人当成高等级人：卡在后期的招聘阶段、
        标识虚高，还会被 TALENT_LV_CAP（建池规则）挡在池外 —— 三处都不是它的语义。 */
  engLevel(e) {
    let lv = 0;
    for (const t of (e && e.traits) || []) {
      if (t.type === "academic") continue;                       // 辅助词条不计等级
      lv = Math.max(lv, t.level || 1);
    }
    return lv || 1;
  },

  /* 该工程师的天赋档能到多高的词条等级（配置 TALENT_LV_CAP；缺省 5） */
  talentLvCap(e) {
    const C = this.cfg.TALENT_LV_CAP || {};
    const k = (this.tierOf(e) || {}).clsKey || "gray";
    return C[k] != null ? C[k] : 5;
  },

  /* 对外显示标识（2026-09-12 用户定）：天赋档 + "-lv" + 最高词条等级，例如「天才-lv3」「一般-lv2」
     ⚠️ 2026-09-25：等级走 engLevel —— **学术（辅助词条）不计入**，学术等级不体现在标识里。 */
  tierLabel(e) {
    const n = (this.tierOf(e) || {}).name || "";
    return n + "-lv" + this.engLevel(e);
  },

  /* 事件界面类型（uiType）推导：决定决策界面用哪张立绘 + 标签样式。
     事件配置了 uiType 直接用；旧数据/未配置时按触发类型与条件兜底。 */
  uiTypeOf(ev) {
    if (!ev) return "random";
    if (ev.uiType) return ev.uiType;
    if (ev.type === "fixed" || ev.type === "recruit_wait") return "fixed";
    if (ev.type === "critical") return "critical";
    if (ev.type === "reward") return "reward";
    if (ev.type === "team") {
      const c = ev.cond || {};
      if (c.energy_above != null) return "positive";
      return "negative";
    }
    return "random";
  },

  /* 2026-09-12：tierOfValue(v) 已删除 —— 它是「按某个数值取档位」的旧接口，全项目零调用方，
     而「天赋档」的定义现在唯一走 tierOf(e)（读配置 TIER_THRESHOLDS）。
     留着一个同语义的第二实现，正是「两套来源、改一套不生效」那类坑的温床。 */

  /* ---------------- 共享工程师池 + 反抽卡（doc/22 v1.2，2026-09-06）----------------
     旧规则 `ENGINEERS.filter(e => e.stage.includes(ver))` 有三个硬伤：
       ① 39 人只分 V1 / V2 / V3 / V4 四组 → **V1.5 / V2.5 / V3.5 池子 = 0 人**，那三个阶段根本招不到人
       ② 权重只按稀有度，与词条等级无关
       ③ 词条等级由档案写死，与阶段无关
     2026-09-06：一个池子，阶段只决定「能刷出哪些词条等级」。
     2026-09-12（用户拍板）：阶段只限**等级上限**（下限恒 Lv1）+ 给各等级一份额外权重。 */
/* [feature:hire-pool-cooldown-recovery] */
  hirePool(st, options) {
    const c = this.cfg;
    const opts = options || {};
    const stt = opts.state || this.state || {};
    const weekAbs = (stt.week || 0) + (stt.weekOffset || 0);              // 冷却记的是**绝对周**（见 expireCandidates 的说明）
    const locked = stt._candLocked || {};
    const range = (c.HIRE_LV_RANGE_BY_VER || {})[st] || {};
    /* 2026-09-12 用户定：**所有阶段只限制上限，下限统一 Lv1**（不再有 min）。 */
    const max = range.max != null ? range.max : 5;
    return (c.ENGINEERS || []).filter((e) => {
/* [feature:embodied-recruit-stage-pool] */
      if (!this.hireStageEligible(e, st || stt.ver)) return false;
/* [/feature:embodied-recruit-stage-pool] */
      if (e.pool === false || e.starter) return false;          // pool:false 不入随机池（infra 退役 2026-09-09 后纯防御）/ 开局固定人不走随机
      /* ⚠️ ID 化：冷却表记的是**实例主键**（"e"+no）→ 这里必须用 engUid 折成同一个键，
         直接写 locked[e.id] 会因为模板没有 id 而恒为 undefined（冷却静默失效）。 */
      if (!opts.ignoreCooldown && locked[this.engUid(e)] > weekAbs) return false;        // 过期冷却中
      return this.engLevel(e) <= max;                           // 本阶段能捞到的最高等级
    });
  },

  /* 只在实际抽取的可用池耗尽时恢复冷却。报价可用 resetCooldown:false 预览，
     不能因打开面板就更改冷却；岗位/职级/权重等额外限制由调用方 filter 提供。 */
  hireDrawPool(st, options) {
    const opts = options || {}, s = opts.state || this.state || {};
    const candidates = opts.candidates || s.candidates || [];
    const busy = new Set([...(s.engineers || []), ...candidates].map(e => this.engUid(e)));
    const eligible = e => !busy.has(this.engUid(e)) && (!opts.filter || opts.filter(e));
    const available = this.hirePool(st, {state:s}).filter(eligible);
    if (available.length) return available;
    const recovered = this.hirePool(st, {state:s, ignoreCooldown:true}).filter(eligible);
    if (opts.resetCooldown !== false && s._candLocked) {
      for (const e of recovered) delete s._candLocked[this.engUid(e)];
    }
    return recovered;
  },

/* [/feature:hire-pool-cooldown-recovery] */
  /* 本阶段各等级的抽取权重（配置 HIRE_LV_RANGE_BY_VER[阶段].lv，索引 = 等级 - 1）
     语义：1 = 与池子里的人数成正比（**池子分布说话**：哪个等级人多就更容易出）；
           0 = 该等级本阶段完全不出现；数值越大越偏向该等级。 */
  hireLvWeights(st) {
    const r = (this.cfg.HIRE_LV_RANGE_BY_VER || {})[st] || {};
    return Array.isArray(r.lv) ? r.lv : [1, 1, 1, 1, 1];
  },
  /* 单个候选人在本阶段的抽取权重（0 = 不参与抽取） */
  hireWeightOf(e, st) {
    const w = this.hireLvWeights(st);
    const i = this.engLevel(e) - 1;
    return (i >= 0 && i < w.length) ? (w[i] || 0) : 0;
  },

  /* [feature:multi-trait-dev-core-002] */
  /* 主职业对应词条等级；副职等级可更高，但不影响岗位、薪资或主职词条的产出档位。 */
  /* [/feature:multi-trait-dev-core-002] */
  mainTraitLevel(e) {
    const t = this.mainTrait(e);
    return (t && t.level) || 1;
  },
  /* 数据词条等级（读工程师里 data 词条；没有 data 词条按 1 级）——
     注意：不是 mainTraitLevel（那是取主职业，可能是非 data 词条），
     而是**专门找 data 类型的词条等级**（数据工程师的语料品质由它决定）。 */
  dataTraitLevel(e) {
    for (const t of (e && e.traits) || []) if (t.type === "data") return t.level || 1;
    return 1;
  },
  /* 按**产出编制下标**取某岗位的在岗工程师（顺序与引擎 `1 + extraX - restX` 的产出循环一致：
     未离职 / 已到岗 / 本周不休息）。体力逐人结算靠这份顺序做「值数组 ↔ 人」的映射。
     2026-09-22：原来只有 teamDataTraitLevels 内联了这套筛选——再抄一份迟早两边跑偏，
     统一收口到这里，词条等级与体力都按同一份顺序取。 */
  teamRoleEngs(st, role) {
    const s = this.state, wk = s.week || 0;
    const out = [];
    for (const e of s.engineers || []) {
      if (e.resigned) continue;
      if (this.v35RoleOf(e) !== role) continue;
      if (e.restWeek === wk) continue;                    // 本周休息 → 不产出 → 不进循环
      if (e.joinTick != null && st && st.tick != null && st.tick < e.joinTick) continue;  // 未到岗
      out.push(e);
    }
    return out;
  },
  /* 岗位标量 s.v35.energy[role] = 该岗位在岗人的**平均体力**（派生量）。
     2026-09-22 起体力真源是**每人一份**的 e.energy；这个标量只留给事件门槛、
     周产出估算、旧 UI 读，不再是真源。 */
  syncEnergySlot(role) {
    const s = this.state;
    if (!role || !s || !s.v35 || !s.v35.energy || s.v35.energy[role] == null) return;
    const engs = this.teamRoleEngs(s.v35, role);
    if (!engs.length) return;
    let sum = 0;
    for (const e of engs) { this.ensureStatus(e); sum += e.energy || 0; }
    s.v35.energy[role] = Math.round(sum / engs.length);
  },
  /* 团队数据词条等级数组（DOC「数据词条 → 语料品质」）：
     每个进引擎 data 产出循环的数据工程师**各自**的 data 词条等级，顺序同上。 */
  teamDataTraitLevels(st) {
  /* [feature:multi-trait-dev-core-003] */
    return this.productionRoleEngs(st, "data").map((e) => this.productionTraitLevel(e, "data"));
  /* [/feature:multi-trait-dev-core-003] */
  },

  /* [feature:multi-trait-dev-core-004] */
  /* 主岗等级标量仅供旧无头路径兜底；真人生产读每条产线逐人的 traitLevelList。
     取第一个在职、未离职、已到岗的 pre/post 工程师，返回其主词条等级；
     pre/post 各只有 1 个编制 + 扩招，产出循环 index 0 即主岗，取第一位足够。
     找不到返回 1（引擎回落起手档）。 */
  /* [/feature:multi-trait-dev-core-004] */
  teamRoleTraitLevel(st, role) {
    const s = this.state, wk = s.week || 0;
    for (const e of s.engineers || []) {
      if (e.resigned) continue;
      if (this.v35RoleOf(e) !== role) continue;
      if (e.restWeek === wk) continue;                    // 本周休息 → 不产出 → 用不上
      if (e.joinTick != null && st && st.tick != null && st.tick < e.joinTick) continue;  // 未到岗
      return this.mainTraitLevel(e);
    }
    return 1;
  },
  teamPreTraitLevel(st)  { return this.teamRoleTraitLevel(st, "pre"); },
  teamPostTraitLevel(st) { return this.teamRoleTraitLevel(st, "post"); },

  /* 核心天赋：按主词条对应的属性（TRAIT_UPGRADE.stats）取平均；
     没配规则的类型回落到岗位默认键，保证任何工程师都能算出一个数。 */
  coreTalentOf(e) {
    const type = this.primaryTraitType(e);
    let keys = type ? this.traitUpgradeStats(type) : [];
    if (!keys.length) {
      keys = { pretrain: ["algo"], post: ["algo"], engineer: ["code"], data: ["code", "text"], academic: ["text"] }[type]
        || { pretrain: ["algo"], data: ["code"], post: ["algo"], infra: ["code"] }[e && e.type] || ["algo"];
    }
    this.healEngineeringTalent(e);
    const s = (e && e.stats) || {};
    let sum = 0;
    for (const k of keys) sum += (s[k] || 0);
    return sum / keys.length;
  },

  /* 薪资 = 词条基准 × (0.6 + (核心天赋/100)² × 0.8)（doc/22 §2.4）
     天赋影响约 33%，所以「高天赋低等级」的苗子比同等级的普通人明显贵。 */
  salaryOf(e) {
    const c = this.cfg;
    const lv = this.mainTraitLevel(e);
    const base = (c.TRAIT_BASE_SALARY || {})[lv] || 90000;
    const t = Math.max(0, Math.min(100, this.coreTalentOf(e)));
    return Math.round(base * (0.6 + (t / 100) * (t / 100) * 0.8));
  },

  /* 候选人过期（doc/22 §7）：刷出后 CANDIDATE_TTL_WEEKS 周未录用 → 失效，
     并在 CANDIDATE_LOCK_WEEKS 周内不再进入池子（防止反复刷新抽卡）。
     ⚠️ 2026-09-13 修 BUG（用户实测「偶尔会出现耐心 10 多周的候选人，不是统一 3 周吗」）：
     过期时间以前记的是**阶段内周数**（`state.week`），而 `_enterStage` 会把 `s.week` 归零、
     把已走的周数并进 `s.weekOffset`（见 5038 行）⇒
       ① 上一阶段末期刷出的候选人，进新阶段后 `expireWeek - s.week` 直接暴涨
          （第 6 周刷出 → 新阶段第 0 周显示「耐心还剩 9 周」）；
       ② `week >= exp` 因为归零**永远不成立** → 候选人**永不失效**，一直挂在招聘列表里。
     改用**绝对周** `absWeek()`（= week + weekOffset）记账；旧档的 `expireWeek` 按
     `+ weekOffset` 迁移一次（它原本就是按阶段内周数写的，加上偏移正好还原成绝对周）。 */
  candExpireAbs(cd) {
    const s = this.state;
    if (cd.expireAbsWeek != null) return cd.expireAbsWeek;
    if (cd.expireWeek != null) return cd.expireWeek + (s.weekOffset || 0);   // 旧档迁移
    return null;
  },
  expireCandidates(week) {
    const c = this.cfg, s = this.state;
    if (!Array.isArray(s.candidates) || !s.candidates.length) return [];
    const ttl = c.CANDIDATE_TTL_WEEKS || 0;
    const lock = c.CANDIDATE_LOCK_WEEKS || 0;
    if (ttl <= 0) return [];
    const now = this.absWeek();
    const gone = [];
    const keep = [];
    for (const cd of s.candidates) {
      const exp = this.candExpireAbs(cd);
      if (exp != null && now >= exp) {
        gone.push(cd);
        if (lock > 0) {
          s._candLocked = s._candLocked || {};
          /* ⚠️ 键走 engUid（与 hirePool 的读侧同一把尺子）：旧档候选人 id 是 "eng_42"
             也能折成 "e2047"，新形态直接就是它。 */
          const _u = this.engUid(cd);
          if (_u) s._candLocked[_u] = now + lock;
        }
      } else keep.push(cd);
    }
    if (gone.length) s.candidates = keep;
    return gone;
  },

  /* 发布需求 / 换一批的费用（固定值，配置可改；填 0 = 免费）。
     times：一次需求同时要几个岗位（2026-09-08 用户拍板：多选消耗叠加，按岗位数计费）。
     返回 {ok, cost, tip} —— 钱不够时 ok=false，由 UI 决定怎么提示。 */
  payRecruitCost(times) {
    const c = this.cfg, s = this.state;
    const n = Math.max(1, Math.round(times || 1));
    const cost = Math.max(0, Math.round(c.RECRUIT_COST || 0)) * n;
    if (!cost) return { ok: true, cost: 0 };
    if ((s.funding || 0) < cost) {
      return { ok: false, cost, tip: `发布需求需要 ${Math.round(cost / 10000)} 万经费，账上不够了` };
    }
    s.funding -= cost;
    return { ok: true, cost };
  },

  /* 深拷贝候选人；带天赋随机浮动（基准 ±HIRE_FLOAT），薪资随浮动后的天赋重算 */
  cloneEng(e, float, stage) {
    const c = this.cfg;
    const f = float || 0;
    const template={...e,stats:{...(e.stats||{})}};this.healEngineeringTalent(template);
    const stats = template.stats;
    if (f > 0) {
      for (const k of this.engStatKeys(template)) {
        if (stats[k] != null) stats[k] = Math.max(0, Math.min(100, stats[k] + Math.round((Math.random() * 2 - 1) * f)));
      }
    }
    // 词条等级受阶段上限约束
    const maxLv = (c.STAGE_TRAIT_MAX || {})[stage] || 5;
    /* 2026-10-04（玩家反馈「某些工程师会出现两个一样的词条，只是等级不一样，比如预训练LV4 LV3」）：
       **同 type 词条在 cloneEng 处折叠成一条（取最高等级）**。
       根因是配置里的数据笔误（8 个模板写成 `pretrain Lv2 + pretrain Lv1`，最离谱的是
       `pretrain Lv1 + pretrain Lv1` 两条一模一样）。为什么它会一路长成 Lv4+Lv3：
         · 产出侧只认同 type 的有效等级 ⇒ 同类第二条本来就是死配置；
         · 升级侧 upgradeTraitsByTalent 却**逐条独立掷骰** ⇒ 两条各自升级、还会同时触发，
           于是慢慢拉开成 Lv4 + Lv3 —— 面板/UI 一渲染就是两个「预训练」标签（4067/4267 行
           直接 map 出每个 tag），玩家看到的就是「重复词条」，而实际收益只有一条。
       在唯一入口折叠 = 配置笔误立刻自愈，且**不改任何数值**（取最高那条本来就是生效的那条）。
       ⚠️ 顺带按 TRAIT_META 声明顺序稳定排序，避免折叠后顺序抖动。
       ⚠️ 已入职的老存档身上仍可能带着重复的实例（存档快照）→ 读档自愈见 healTraitDups()。 */
    const traits = [];
    const _dupAt = new Map();
    for (const t of (e.traits || [])) {
      const lv = Math.min(t.level, maxLv);
      if (_dupAt.has(t.type)) {
        const j = _dupAt.get(t.type);
        if (lv > traits[j].level) traits[j] = { ...traits[j], level: lv };
      } else {
        _dupAt.set(t.type, traits.length);
        traits.push({ ...t, level: lv });
      }
    }
    const out = {
      ...e,
      traits,
      stats,
      resume: { ...(e.resume || {}) },
      stage: [...(e.stage || ["V1"])],
      ...this.initStatus(e),
    };
    /* ⚠️ ID 化（2026-09-14）：池子条目**没有 `id` 了**（只有 `no` + `key`）→
       实例主键 `id` 在**这一处**生成 = "e" + no（仍是字符串，下游 {engId:…} 全不用改）；
       访客（vis_*）没有 no → 保留自带 id。两边都没有才兜底造一个（避免出现 undefined 键）。 */
    const _eno = this.engNoOf(e);
    if (_eno != null) { out.no = _eno; out.id = this.engIdOf(_eno); }
    else if (out.id == null) { out.id = "e_tmp_" + Math.random().toString(36).slice(2, 8); }
    /* 新实例登记主职业；旧模板缺 type 时亦在候选人成形时固定。 */
    out.type = this.primaryTraitType(out);
    /* 薪资跟着浮动后的核心天赋走（doc/22 §2.4），否则招到的 A 档可能按 C 档价 */
    out.salary = this.salaryOf(out);
    /* 反抽卡：写入失效周（doc/22 §7）—— V1 保底 3 人不过期。
       ⚠️ 记**绝对周**（absWeek = week + weekOffset），否则跨阶段归零后会"耐心暴涨"且永不失效。 */
    const ttl = c.CANDIDATE_TTL_WEEKS || 0;
    if (ttl > 0 && !e.starter) out.expireAbsWeek = this.absWeek() + ttl;
    return out;
  },

  /* ---------------- 工程师运行态（2026-09-04 精简）----------------
     stats = 潜力（静态，入职即定，决定词条升级概率）；energy = 运行态体力（唯一的状态条）。
     历史：morale（干劲）与 loyalty（忠诚）是 v3.5 之前的数值，v35 引擎不参与任何结算、
     离职检定也早已随 phase 归一到 office 而不再执行 —— 它们只剩「写了但没用」，
     面板与事件文案还在承诺这些收益，等于骗人。2026-09-04 全量移除，只保留体力。
     兼容：老存档缺字段时按需补齐（ensureStatus）。 */
  initStatus(e) {
    const st = this.cfg.ENG_STATUS || {};
    /* 2026-09-10：初始体力**固定 ENERGY_INIT（100）** —— 「精力」属性已删除，不再由属性推导 */
    return { energy: st.ENERGY_INIT != null ? st.ENERGY_INIT : 100 };
  },

  /* 老存档 / 缺字段兜底：就地补齐状态，返回该工程师 */
  ensureStatus(e) {
    if (e.energy == null) {
      const d = this.initStatus(e);
      if (e.energy == null) e.energy = d.energy;
    }
    return e;
  },

  hire(id) {
    const c = this.cfg;
    const s = this.state;
    const idx = s.candidates.findIndex((x) => x.id === id);
    // 人数上限改为「本次招聘配额」（P2：V1 开局只招 1 人，中途再逐次补人），
    // 不再用全局 RECRUIT_COUNT 卡团队总人数
    // ⚠️ 2026-09-07 修：配额只限**开局三连招的专用流程**（phase==="recruit"）。
    //    办公室阶段 s.hiredThisRound 早就是 3 且永不重置 → 中期招聘（事件刷人 /
    //    扩编寻访进列表的人）全被这条卡死，点「录用」永远弹「招不了」。
    //    办公室招聘的约束是工资 / 座位 / 候选人有效期，不是这个一次性配额。
    const quotaOn = s.phase === "recruit";
/* [feature:embodied-recruit-stage-hire] */
    if (idx < 0 || (quotaOn && (s.hiredThisRound || 0) >= (s.hireQuota || 1))) return false;
    if (!this.hireStageEligible(s.candidates[idx], s.ver)) {
      return { ok: false, reason: "stage_locked", tip: "具身智能工程师在 V5 起开放招聘" };
    }
/* [/feature:embodied-recruit-stage-hire] */
    /* 2026-09-12（用户实测可超出配置人数上限）：录用此前**没有任何人数上限校验**——
       场景座位数（地图配置的 cap）只用于显示。补上：在编人数 ≥ 座位上限 → 拒绝录用 */
    const capN = this.seatCap();
    const aliveN = s.engineers.filter((x) => !x.resigned).length;
    if (aliveN >= capN) {
      this.toastSeatFull = true;
      return { ok: false, reason: "seat_full", tip: `座位已满（${aliveN}/${capN}）：先辞退一人再录用` };
    }
    const eng = s.candidates[idx];
    /* 2026-09-29 修「有概率卡出两个苏小满」：录用前按 engUid 兜底查重 ——
       候选可能来自重刷（E101「等待招聘」）/ 旧存档 / 事件，若该人已在团队里，
       直接拒绝并把这条候选移除，避免同一 id 进队两次（办公室渲染两个标记，
       刷新后被 loadState 按 id 去重 → 玩家看到「刷新就没了」）。 */
    if (s.engineers.some((e) => this.engUid(e) === this.engUid(eng))) {
      s.candidates.splice(idx, 1);
      return { ok: false, reason: "dup", tip: "TA 已经在团队里了" };
    }
    /* 录用保留候选人自己的体力，缺字段只用个人初始值；岗位均值不是成员体力源。 */
    this.ensureStatus(eng);
    eng.weeksNoRaise = 0;   // 2026-09-05：挖角计时从入职起算（否则开局累计的周数会算到新人头上，「刚招人就被挖」）
    s.engineers.push(eng);
    /* 成就「三人成军」（doc/35 §3.6）：只数**真招聘**，开局三人（starter）不算 ——
       否则所有人开局就有 3 笔，成就永远拿不到。 */
    if (!eng.starter) s.hireCount = (s.hireCount || 0) + 1;
    s.hiredThisRound = (s.hiredThisRound || 0) + 1;
    s.candidates.splice(idx, 1);
    this.assignSeat(eng.id);   // 2026-08-30：按配置的座位表占一个空位
    /* V3.5.3：入职错开 —— 数据/后训练工程师写完入职 tick，
       到岗前头像显示「待入职」，且不参与语料产能结算（见 officeAdvanceV35） */
    if (this.v35On && this.v35On() && eng.joinTick == null) {
      const v = this.cfg.V35 || {};
      if (this.v35RoleOf(eng) === "data") eng.joinTick = v.JOIN_DATA != null ? v.JOIN_DATA : 6;
      else if (this.v35RoleOf(eng) === "post") eng.joinTick = v.JOIN_POST != null ? v.JOIN_POST : 18;
    }
    /* 2026-09-07：扩编编制同步 —— 引擎产出按 1+extraX 模拟各岗位人数（v35_core 140/160/182），
       原来只有旧 V35Hire.hire 自己加这个计数；现在录用统一走 core.hire，
       **非开局**（!starter）的招聘都要让对应岗位编制 +1，谁进编制谁就有产出。
       开局三人是「1 + extra」里那个 1，不能加（否则开局产出翻倍）。 */
    if (this.v35On && this.v35On() && s.v35 && !eng.starter) {
      const role = this.v35RoleOf(eng);
      /* ⚠️ v35RoleOf 返回的是引擎槽键 "pre"/"data"/"post"（不是岗位名 "pretrain"）——
         以前这里判 "pretrain"，预训练工程师的编制计数从未生效（产出比实际少一人），
         2026-09-07 P2 回归压测抓出。 */
      if (role === "pre") s.v35.extraPre = (s.v35.extraPre || 0) + 1;
      else if (role === "data") s.v35.extraData = (s.v35.extraData || 0) + 1;
      else if (role === "post") s.v35.extraPost = (s.v35.extraPost || 0) + 1;
    }
    this.syncEnergySlot(this.v35RoleOf(eng));
    return true;
  },

  /* 本次招聘是否招满：按「本次已招人数」判断而非团队总人数
     （P2：中途招聘时团队里已经有老员工，数总人数会立刻判定为招满） */
  canProceedRecruit() {
    const s = this.state;
    return (s.hiredThisRound || 0) >= (s.hireQuota || 1);
  },

  /* 打开招聘：quota=本次招几人，pick=指定人选 id（教学关固定刷出，保证流程可控），
     flow=init（下一步买卡）/ mid（下一步回训练） */
/* [feature:embodied-recruit-stage-pick] */
  openRecruit(opts) {
    const s = this.state;
    const selected = opts && opts.pick && (this.engOf(opts.pick) || this.engByKey(opts.pick));
    if (selected && !this.hireStageEligible(selected, s.ver)) return false;
/* [/feature:embodied-recruit-stage-pick] */
    s.phase = "recruit";
    s.hireQuota = (opts && opts.quota) || 1;
    s.hireFlow = (opts && opts.flow) || "mid";
    s.hiredThisRound = 0;
    const pick = opts && opts.pick;
    if (pick) {
      /* ⚠️ ID 化：pick 可能是 no 数字 / "e2001" / 旧字符串 —— 一律过 engOf() */
      const e = this.engOf(pick) || this.engByKey(pick);
      s.candidates = e ? [this.cloneEng(e)] : [];
    } else {
      this.genCandidates(s.ver || "V1");
    }
    return true;
  },

  /* ---------------- 买卡 ---------------- */
  /* 当前阶段开放的算力档位（用户 2026-08-29：V1 固定只让买最低档） */
  allowedGpuTiers() {
    const c = this.cfg, s = this.state;
    const list = (c.GPU_TIERS_BY_VER || {})[s.ver || "V1"];
    return (Array.isArray(list) && list.length) ? list : (c.GPU_TIER_ORDER || []);
  },

  buyTier(tierId) {
    const c = this.cfg;
    const s = this.state;
    const t = c.GPU_TIERS[tierId];
    if (!t || s.funding < t.price) return false;
    if (!this.allowedGpuTiers().includes(tierId)) return false;   // 本阶段未开放
    // 幂等（2026-09-06 对齐可叠加持有）：已拥有同档位不再扣费（防快速双击 / 重复结算把经费扣光）
    if (!Array.isArray(s.ownedGpus)) s.ownedGpus = s.gpuTier ? [s.gpuTier] : [];
    if (s.ownedGpus.includes(tierId)) return true;
    s.funding -= t.price;
    s.ownedGpus.push(tierId);
    // 启用档只升不降（= 已持有最高档）；低档位留存作后续事件触发条件
    if (!s.gpuTier || t.maxParam > ((c.GPU_TIERS[s.gpuTier] || {}).maxParam || 0)) s.gpuTier = tierId;
    return true;
  },

  /* 选择目标参数规模（≤ 算力档位上限） */
  chooseTarget(param) {
    const c = this.cfg;
    const s = this.state;
    const maxP = c.GPU_TIERS[s.gpuTier].maxParam;
    if (!c.TARGET_PARAMS.includes(param) || param > maxP) return false;
    s.paramTarget = param;
    return true;
  },

  /* 某架构能选的最大可选参数（2026-09-09）：取 架构 maxParam 与 当前算力档位 maxParam 的较小值。
     架构 maxParam 填 0/空(null) 视为不限（只用算力档位上限）。 */
  /* [feature:embodied-parameter-stage-cap] */
  archMaxParam(archId) {
    const c = this.cfg, s = this.state;
    const a = (c.ARCHITECTURES || []).find((x) => x.id === archId);
    const gpuMax = (c.GPU_TIERS[s.gpuTier || "basic"] || {}).maxParam || 7;
    let cap = a && a.maxParam > 0 ? Math.min(a.maxParam, gpuMax) : gpuMax;
    // Latest configured stage cap carries forward; old architectures stay unchanged.
    const by = a && a.maxParamByVer, order = c.VER_ORDER || ["V1"];
    if (by && typeof by === "object" && !Array.isArray(by)) {
      const at = order.indexOf(s.ver || "V1");
      let stageCap = null;
      for (const ver of order.slice(0, at < 0 ? 0 : at + 1)) {
        if (!Object.prototype.hasOwnProperty.call(by, ver)) continue;
        const value = Number(by[ver]);
        if (Number.isFinite(value) && value > 0) stageCap = value;
      }
      if (stageCap != null) cap = Math.min(cap, stageCap);
    }
    return cap;
  },
  /* [/feature:embodied-parameter-stage-cap] */

  /* X3（用户 2026-08-29：立项一屏塞不下 → 拆四步，一步一屏，不滚动）
     步骤：plan 训练方案 → leader 指定负责人 → corpus 语料来源 → confirm 确认开训。
     前三步只写草稿（dirPick / leader），点确认才真正结算（confirmDirection）。 */
  setDirStep(step) {
    const s = this.state;
    if (!["plan", "leader", "corpus", "confirm"].includes(step)) return false;
    s.dirStep = step;
    return true;
  },


  /* ---------------- 方向决策（初始化 §3.04） ---------------- */
  confirmDirection() {
    const s = this.state;
    const idx = s.dirPick == null ? 0 : s.dirPick;
    // 用户 2026-08-28 数值瘦身：方向决策的一次性加成同步降档（8/15/5 → 3/4/2），避免开局白送大量数值
    const opts = [
      { text: "A. 蒸馏 GPT 输出获得语料", effects: { code: 3, text: 3, brand: -20 }, flag: "distill" },
      { text: "B. 雇佣数据生产专员（-20万）", effects: { funding: -200000, text: 4, safety: 2 }, flag: "hire_data" },
      { text: "C. 大规模爬取公开语料（+2周，安全-4）", effects: { time_cost: 2, safety: -4 }, flag: "scrape" },
    ];
    const o = opts[idx];
    if (!o) return;
    s.direction = o.flag;
    // P4/P8：V1 固定 dense × chat；V1.5 起玩家在定方向页自选（未选则回退默认）
    if (!s.arch) s.arch = "dense";
    if (!s.recipe) s.recipe = "chat";
    // P8：负责人——未指定则默认第一位在岗；连任 → overworked（透支团队）
    if (!s.leader) {
      const first = s.engineers.find((e) => !e.resigned);
      s.leader = first ? first.id : null;
    }
    s.leaderOverworked = !!(s.leader && s.lastLeader && s.leader === s.lastLeader);
    if (s.leaderOverworked) {
      /* 2026-09-16：全员效果走 addEnergyAll（体力真源是岗位槽，逐人循环会叠加） */
      this.addEnergyAll(-10);
    }
    this.applyEffects(o.effects, s);
    // 进入双周循环：从第 4 周开始（或 + time_cost）
    s.week = this.cfg.START_WEEK + (o.effects.time_cost || 0);
    s.phase = "loop";
    s.step = 0;
    // 记录方向选择（连锁事件预留：E001A 蒸馏 → 需 V3，V1 不触发）
    s.triggered.push({ id: "direction", choice: o.flag, week: 0 });
    s.dirStep = "plan";
    /* X6：立项目录定下来后，检查有没有大牛的伏笔可以回收（选了他关注的方向 → 上门自荐） */
    this.maybeRefer();
  },

  /* ================= X6 业内人士拜访 · 伏笔链 =================
     第一段「拜访」：每轮独立掷骰（不走事件池），大牛上门聊几句 → 记下他关注的方向
       （s.flags["mentor_<arch 或 recipe 的 id>"] = true）。
     第二段「自荐」：玩家真选了这个方向 → 立项后他上门自荐（maybeRefer → V_REFER 事件）。
     不打断流程：拜访用剧情气泡展示，看完继续。 */
  rollVisitor() {
    const c = this.cfg, s = this.state;
    const prob = (c.VISIT_PROB_BY_VER || {})[s.ver || "V1"] != null
      ? (c.VISIT_PROB_BY_VER || {})[s.ver || "V1"] : 0.25;
    s.visitors = Array.isArray(s.visitors) ? s.visitors : [];
    s.flags = s.flags || {};
    if (s.pendingVisitor) return null;
    if (Math.random() >= prob) return null;
    // 没来过的人里随机挑一位（V1 保密期只来一位，别把新手淹没在客套里）
    const pool = (c.VISITORS || []).filter((v) => !s.visitors.includes(v.id));
    if (!pool.length) return null;
    const v = pool[Math.floor(Math.random() * pool.length)];
    s.visitors.push(v.id);
    s.flags["mentor_" + v.arch] = true;     // 伏笔：记住他关注的方向
    s.pendingVisitor = { id: v.id, name: v.name, title: v.title, say: v.say || [], arch: v.arch };
    return s.pendingVisitor;
  },

  /* 伏笔回收：当前架构或配方 == 某位大牛关注的方向，且他还没进过队 → 上门自荐 */
  maybeRefer() {
    const c = this.cfg, s = this.state;
    s.flags = s.flags || {};
    s.visitors = Array.isArray(s.visitors) ? s.visitors : [];
    /* ⚠️ 合并后按 key 查（"V_REFER" 从来不在 EVENTS 里 → 这里一直是 no-op，留着只做兼容） */
    const ev = this.evByKey("V_REFER");
    if (!ev) return null;
    const hiredIds = new Set(s.engineers.map((e) => e.id));
    for (const v of c.VISITORS || []) {
      if (!s.flags["mentor_" + v.arch]) continue;
      if (hiredIds.has("vis_" + v.id)) continue;            // 已经招进来了
      if (v.arch !== s.arch) continue;                          // 方向对不上
      s.pendingVisitor = { id: v.id, name: v.name, title: v.title, say: [], arch: v.arch };
      const who = s.engineers.find((e) => !e.resigned);
      s.pending = [{ ...ev,
        targetId: who ? who.id : null,
        targetName: v.name,
        visitorId: v.id,
      }];
      return v;
    }
    return null;
  },

  /* 签下上门自荐的大牛：一次性签字费 + 高月薪，换 Lv.2 词条（越级奖励） */

  /* ================= X6 行业新闻：脱离事件池，独立掷骰 =================
     旧版新闻在事件池里优先级最低（3.5），被玩法事件长期压制 → 玩家「一条都没见过」。
     改为每轮独立掷骰：命中就把新闻挂到 s.pendingNews，由 UI 用顶部横幅展示（不打断流程）。
     2026-09-03：v3.5 办公室循环改走 NEWS_TIMELINE 时间线（周结算优先），
     本随机池作为「本周没配时间线新闻」时的氛围补充。 */
  rollNews() {
    const c = this.cfg, s = this.state;
    const freq = (c.NEWS_FREQ_BY_VER || {})[s.ver || "V1"];
    if (freq == null || freq <= 0) return null;
    s.newsSeen = Array.isArray(s.newsSeen) ? s.newsSeen : [];
    if (s.pendingNews) return null;                     // 上一条还没看
    if (Math.random() > freq) return null;              // freq=1 → 每轮必出；0.5 → 一半概率
    const pool = (c.NEWS || []).filter((n) => !s.newsSeen.includes(n.id));
    const src = pool.length ? pool : (c.NEWS || []);    // 全部看完 → 重新开始轮
    if (!src.length) return null;
    const n = src[Math.floor(Math.random() * src.length)];
    s.newsSeen.push(n.id);
    // 文案里的 {name} 指向团队里的一员（新闻是"你们看到的新闻"）
    const who = s.engineers.filter((e) => !e.resigned);
    const pick = who.length ? who[Math.floor(Math.random() * who.length)] : null;
    s.pendingNews = { ...n, who: pick ? pick.name : "组里的同学" };
    return s.pendingNews;
  },

  /* ---------------- 节点提示 / 时事新闻（2026-09-03，顶部小卡片）----------------
     游戏 第 N 周 = TRAIN_TIMELINE.startDate + (N-1)×7 天；NEWS_TIMELINE 按 date 配到周。 */
  gameWeekOfDate(dateStr) {
    const c = this.cfg;
    const start = new Date((c.TRAIN_TIMELINE && c.TRAIN_TIMELINE.startDate) || "2023-06-26");
    const d = new Date(dateStr);
    const diff = Math.floor((d - start) / 86400000);
    return diff < 0 ? 1 : Math.floor(diff / 7) + 1;
  },
  /* 本局绝对周数 = 当前阶段周 + 之前阶段累计（2026-09-08）。
     新闻时间线 / 随机新闻都按它对齐 —— 否则进入新阶段 s.week 归零，
     时间线新闻永远匹配不上（表现为「都 8 月了还在推 7 月的新闻」）。 */
  absWeek() {
    const s = this.state || {};
    return (s.week || 0) + (s.weekOffset || 0);
  },
  /* 具身日历只改变显示日期与新闻时钟。操作时钟 absWeek 保持连续。
     V5 第一次进入定在旧阶段典型 136 周 + 4 周准备后的第 141 周。
     旧具身档按保存的训练周推回起点，不把当前阶段训练时间清零。 */
  validBodyCalendar(marker, state) {
    if (!marker || typeof marker !== "object" || Array.isArray(marker) || marker.schema !== 1
        || !Number.isSafeInteger(marker.offsetWeeks) || !Number.isSafeInteger(marker.anchorWeek) || marker.anchorWeek < 1
        || !/^\d{4}-\d{2}-\d{2}$/.test(marker.anchorDate || "")) return false;
    const parsed = Date.parse(marker.anchorDate + "T00:00:00Z");
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== marker.anchorDate) return false;
    const s = state || this.state || {};
    const operational = (Number(s.week) || 0) + (Number(s.weekOffset) || 0);
    const week = Math.max(0, Math.floor(Number.isFinite(operational) ? operational : 0) + marker.offsetWeeks);
    const projected = parsed + (week - marker.anchorWeek) * 7 * 86400000;
    return Number.isSafeInteger(week) && Number.isFinite(new Date(projected).getTime());
  },
  ensureBodyCalendar(state) {
    const s = state || this.state;
    if (!s || !this.embodiedAvailable(s)) return null;
    const saved = s.bodyCalendar;
    if (this.validBodyCalendar(saved, s)) return saved;
    const cfg = (this.cfg.EMBODIED || {}).CALENDAR || {};
    const anchorWeek = Math.max(1, Math.floor(Number(cfg.ANCHOR_WEEK) || 141));
    const bodyVersions = (this.cfg.VER_ORDER || []).filter(v => this.embodiedAvailable({ ver: v }));
    const current = bodyVersions.indexOf(s.ver);
    const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
    const abs = nonnegative(s.week) + nonnegative(s.weekOffset);
    const origin = (s.lifeMilestones || {}).body_V5;
    let elapsed = nonnegative(s.week), estimatedStages = [];
    if (origin && Number.isFinite(origin.absWeek) && origin.absWeek >= 0 && origin.absWeek <= abs) {
      elapsed = abs - origin.absWeek;
    } else {
      const attempts = (Array.isArray(s.codexLog) ? s.codexLog : []).filter(x => x && x.ver === s.ver
        && Number.isFinite(Number(x.week)) && Number(x.week) >= 0);
      const lastAttempt = attempts[attempts.length - 1];
      // A settled current review is already represented by s.week. Earlier
      // attempts of this same stage are time that must survive old-save repair.
      if (lastAttempt && s.result && (s.result.settled || s.phase === "bonus" || s.phase === "over")
          && nonnegative(lastAttempt.week) === nonnegative(s.week)) attempts.pop();
      elapsed += attempts.reduce((sum, x) => sum + nonnegative(x.week), 0);
      for (const ver of bodyVersions.slice(0, Math.max(0, current))) {
        const log = (Array.isArray(s.codexLog) ? s.codexLog : []).filter(x => x && x.ver === ver
          && Number.isFinite(Number(x.week)) && Number(x.week) >= 0);
        if (log.length) elapsed += log.reduce((sum, x) => sum + nonnegative(x.week), 0);
        else {
          const snapshots = [(s.stageMarks || {})[ver], ...(Array.isArray(s.modelHistory) ? s.modelHistory : []).filter(x => x && x.ver === ver)]
            .filter(x => x && Number.isFinite(Number(x.week)) && Number(x.week) >= 0);
          if (snapshots.length) elapsed += Math.max(...snapshots.map(x => nonnegative(x.week)));
          else {
            const idx = (this.cfg.VER_ORDER || []).indexOf(ver);
            elapsed += nonnegative((this.cfg.MIN_WEEKS_BY_VER || [])[idx]);
            estimatedStages.push(ver);
          }
        }
      }
    }
    const anchorDate = this.calendarDateForWeek(anchorWeek);
    s.bodyCalendar = { schema: 1, anchorWeek, anchorDate, offsetWeeks: anchorWeek + elapsed - abs,
      normalizedAt: new Date().toISOString(), inferredElapsedWeeks: elapsed, estimatedStages };
    return s.bodyCalendar;
  },
  calendarWeek(abs, state) {
    const s = state || this.state || {}, marker = this.ensureBodyCalendar(s);
    const operational = abs == null ? (Number(s.week) || 0) + (Number(s.weekOffset) || 0) : Number(abs);
    return Math.max(0, Math.floor(Number.isFinite(operational) ? operational : 0) + (marker ? marker.offsetWeeks : 0));
  },
  calendarDateForWeek(week) {
    const start = (this.cfg.TRAIN_TIMELINE || {}).startDate || "2023-06-26";
    const parsed = Date.parse(start + "T00:00:00Z");
    const epoch = Number.isFinite(parsed) ? parsed : Date.UTC(2023, 5, 26);
    return new Date(epoch + (Math.max(1, Math.floor(Number(week) || 1)) - 1) * 7 * 86400000).toISOString().slice(0, 10);
  },
  calendarDate(abs, state) {
    const s = state || this.state || {}, marker = this.ensureBodyCalendar(s), week = this.calendarWeek(abs, s);
    if (!marker) return this.calendarDateForWeek(week);
    return new Date(Date.parse(marker.anchorDate + "T00:00:00Z") + (week - marker.anchorWeek) * 7 * 86400000).toISOString().slice(0, 10);
  },
  calendarLabel(abs) {
    const date = this.calendarDate(abs), parts = date.split("-").map(Number);
    return parts[0] + "年" + parts[1] + "月 第" + Math.ceil(parts[2] / 7) + "周";
  },
  calendarNewsAtCurrentWeek() {
    const s = this.state, marker = this.ensureBodyCalendar(s), done = s.newsTimelineDone || {};
    const week = this.calendarWeek();
    const dated = (this.cfg.NEWS_TIMELINE || []).filter(n => n.id && n.title && !done[n.id]
      && (marker ? marker.anchorWeek + Math.floor((Date.parse(n.date + "T00:00:00Z") - Date.parse(marker.anchorDate + "T00:00:00Z")) / (7 * 86400000))
        : this.gameWeekOfDate(n.date)) === week);
    if (!marker) return dated;
    const elapsed = week - marker.anchorWeek;
    const relative = (((this.cfg.EMBODIED || {}).CALENDAR || {}).NEWS_TIMELINE || []).filter(n => n.id && n.title
      && Number.isInteger(n.week) && n.week === elapsed && !done[n.id]).map(n => ({ ...n, date: this.calendarDate() }));
    return dated.concat(relative).filter((n, i, list) => list.findIndex(x => x.id === n.id) === i);
  },
  publishCalendarNews() {
    const s = this.state;
    s.newsTimelineDone = s.newsTimelineDone || {};
    const news = this.calendarNewsAtCurrentWeek();
    for (const n of news) {
      s.newsTimelineDone[n.id] = true;
      this.pushNews({ ...n, text: this.fillWhaleText(this.noticeTpl(n.desc || n.text || "")) });
    }
    return news.length;
  },
  /* 只在真实发生的新事件写时间。读档/日历迁移不补写历史首次。 */
  recordLifeMilestone(key, data) {
    const s = this.state;
    if (!s || !key) return null;
    if (!s.lifeMilestones || typeof s.lifeMilestones !== "object" || Array.isArray(s.lifeMilestones)) s.lifeMilestones = {};
    if (s.lifeMilestones[key]) return s.lifeMilestones[key];
    return (s.lifeMilestones[key] = { ...(data || {}), at: new Date().toISOString(), ver: s.ver || "V1",
      week: s.week || 0, absWeek: this.absWeek(), calendarDate: this.calendarDate(),
      modelName: s.modelName || "", whaleName: this.whaleName() });
  },
  /* 本月工资单总额（fund_low 提示 / 预警共用） */
  payrollTotal() {
    return (this.state.engineers || []).filter((e) => !e.resigned).reduce((a, e) => a + (e.salary || 0), 0);
  },
  /* 文案里的 {name} 指向团队一员（与 rollNews 同款替换） */
  noticeTpl(str) {
    if (!str || str.indexOf("{name}") < 0) return str;
    const alive = (this.state.engineers || []).filter((e) => !e.resigned);
    const who = alive.length ? alive[Math.floor(Math.random() * alive.length)].name : "组里的同学";
    return str.replace(/\{name\}/g, who);
  },
  /* 新闻入流统一入口（2026-09-13 抽出）：原来「推新闻」只是 officeAdvanceV35 里的一个局部闭包，
     于是发生在别处的新闻（如「模型上线」在 _enterStage）根本推不进去。现在两处共用这一份。
     支持配图：img = resource/ 下的图片路径（提示与新闻页可配）；
     老存档的 feed 条目没有 img → UI 不渲染图片（不会出现白框）。 */
  pushNews(o) {
    const c = this.cfg, s = this.state;
    const n = o || {};
    if (!n.title) return null;
    s.newsFeed = s.newsFeed || [];
    const feedMax = (c.NEWS_PAGE && c.NEWS_PAGE.FEED_MAX) || 60;
    const item = {
      id: n.id || ("NW_" + s.rounds),
      title: n.title,
      text: n.text || "",
      src: n.src || "鲸华社 BOT",
      week: this.absWeek(),
      date: n.date || (this.embodiedAvailable(s) ? this.calendarDate() : null),
      img: n.img || null,
      imgAlt: n.imgAlt || "",
      comments: this.buildNewsComments({ id: n.id }),
    };
    s.newsFeed.unshift(item);
    if (s.newsFeed.length > feedMax) s.newsFeed.length = feedMax;   // 上限截断：最老的先出流
    s.newsUnread = (s.newsUnread || 0) + 1;
    return item;
  },
  /* 新闻评论区（2026-09-05 新设计点）：每条新闻随机 1~2 条同事评论。
     文案按新闻 id 从 NEWS_COMMENTS.byId 定制（贴合内容，不重复）；未定制的回退 pool 通用池。
     评论者 = 在职工程师随机（没有在职工程师回落「隔壁组的同学」）。 */
  buildNewsComments(n) {
    const c = this.cfg, s = this.state;
    const NC = c.NEWS_COMMENTS || {};
    let pool = (n && n.id && Array.isArray((NC.byId || {})[n.id])) ? NC.byId[n.id]
      : (Array.isArray(NC.pool) ? NC.pool : []);
    const alive = (s.engineers || []).filter((e) => !e.resigned);
    const num = pool.length ? Math.min(pool.length, 1 + Math.floor(Math.random() * 2)) : 0;
    const used = new Set();
    const list = [];
    for (let i = 0; i < num; i++) {
      let t = pool[Math.floor(Math.random() * pool.length)];
      let guard = 6;
      while (used.has(t) && guard-- > 0) t = pool[Math.floor(Math.random() * pool.length)];
      if (used.has(t) || !t) continue;
      used.add(t);
      const who = alive.length ? alive[Math.floor(Math.random() * alive.length)].name : "隔壁组的同学";
      list.push({ who, t });
    }
    return list;
  },


  /* 提前评审（X2，用户 2026-08-29）：数值已达标时问玩家「现在评 / 再练两周」，
     避免达标后还要空耗几周（原反馈：8 周达标后完全没有目标感）。
     V1 例外（用户拍板）：必须先跑完固定剧情（W3 咕嘎 + W5 会说话）。 */
  canEarlyReview() {
    const c = this.cfg, s = this.state;
    if (this.v35On()) return false;   // V3.5.2：W6 自动评审，无提前评审
    const er = c.EARLY_REVIEW || {};
    if (er.enabled === false) return false;
    if (s.week >= c.TOTAL_WEEKS) return false;                 // 末周走正常评审
    if (s.week < (er.minWeek != null ? er.minWeek : 4)) return false;
    /* 2026-09-13 清死代码：E_EARLY 标记早已没有任何地方写入；EARLY_REVIEW_NEED 引用的事件
       （V1T2 等 V1 教学剧情）2026-08-30 就随办公室改版下线了 → 这两个判据永远为假。
       提前评审本身在 V3.5 下也不存在（v35On() 直接 return false）。 */
    const r = this.evaluate();
    return this.isPassLike(r);
  },



  /* 架构解锁门槛：版本已到，且满足它的解锁方式 ——
     · unlockBy === "approval"（**自研路线**，mla/dsa/csa，2026-09-13 用户要求）：
       这条技术路线是我们自己提出并发布的（现实中 = DeepSeek-V2 / V3.2 / V4），
       凭什么还要玩家去研读别人的论文 → 改为「团队提案 → 老板批准」（写 s.approvedArchs）。
     · 其它（外部论文路线）：研读完 unlockPaper 即可（没有 unlockPaper 的 = 不设门槛）。
     返回体保留 verOk / paperOk，新增 approvalOk（守卫与 UI 都按这三位判）。 */
  archUnlock(a) {
    const c = this.cfg, s = this.state;
    if (!a) return { ok: true, verOk: true, paperOk: true, approvalOk: true };
    const order = c.VER_ORDER || ["V1"];
    const vi = order.indexOf(s.ver || "V1");
    const verOk = order.indexOf((a.unlock || "V1")) <= vi;
    const byApproval = a.unlockBy === "approval" || a.unlockBy === "embodied";
    const approved = Array.isArray(s.approvedArchs) ? s.approvedArchs : [];
    const approvalOk = !byApproval || approved.includes(a.id);
    const paperOk = byApproval || !a.unlockPaper || this.hasPaper(a.unlockPaper);
    return { ok: verOk && paperOk && approvalOk, verOk, paperOk, approvalOk, byApproval };
  },
  /* 未解锁时的拒绝文案：区分「版本未到」「待团队提案」「论文未研读」 */
  unlockReqTip(a) {
    const c = this.cfg;
    if (a && (a.unlockBy === "approval" || a.unlockBy === "embodied")) {
      return `${a.name} 还在等团队把方案定下来 —— 进入 ${a.unlock} 后由团队提案、你点头即可立项`;
    }
    const pt = a && a.unlockPaper ? this.paperOf(a.unlockPaper) : null;
    if (a && a.unlockPaper && pt) return `${a.name} 需要先研读《${pt.title}》才能解锁`;
    return a ? `${a.name} 将在 ${a.unlock} 解锁` : "";
  },

  /* 选择架构 / 数据配方（P8）：V1 固定展示，V1.5 起在定方向页真正可选。
     只允许 direction 阶段改（已进训练不可换）。 */
  chooseArch(id) {
    const c = this.cfg, s = this.state;
    if (s.phase !== "direction") return { ok: false, tip: "只能在立项时选择" };
    if ((s.ver || "V1") === "V1") return { ok: false, tip: "V1 阶段使用固定方案" };
    const a = (c.ARCHITECTURES || []).find((x) => x.id === id);
    if (!a) return { ok: false, tip: "未知架构" };
    const u = this.archUnlock(a);
    if (!u.ok) return { ok: false, tip: this.unlockReqTip(a) };
    s.arch = id;
    return { ok: true };
  },

  /* ---------------- 自由行动（P6，用户 2026-08-29）----------------
     必选操作（AP 行动卡）之外的可选动作：刷论文 / 学术会议 / 采购数据。
     刷论文和会议每轮各一次（免费或花钱），采购数据随时可用（花钱+囤积上限）。 */
  FREE_CONFERENCE_COST: 100000,   // 学术会议报名 + 差旅（元）

  doFreeAction(kind) {
    const c = this.cfg, s = this.state;
    if (kind === "corpus") return this.buyCorpus();   // 采购不改论文/会议次数状态
    s.freeActions = s.freeActions || { paper: true, conference: true };
    if (kind === "paper") {
      if (!s.freeActions.paper) return { ok: false, tip: "这轮已经刷过论文了，下轮再来" };
      s.freeActions.paper = false;
      // 刷论文：45% 挖到宝（随机 1 维 +2）/ 35% 只有水文 / 20% 组内讨论热烈
      const roll = Math.random();
      const cap = this.statCap();
      if (roll < 0.45) {
        const keys = this.baseDims();
        const k = keys[Math.floor(Math.random() * keys.length)];
        const before = s[k];
        s[k] = Math.min(this.statLimit(k, cap), s[k] + 2);
        return { ok: true, msg: `📄 挖到一篇好论文！${this.statLabel(k)} +${s[k] - before}` };
      }
      if (roll < 0.8) return { ok: true, msg: "📄 刷了一晚上 arXiv，全是水文。信息量 ≈ 0。" };
      /* 2026-09-16：全员效果走 addEnergyAll（按岗位去重）——体力真源是岗位槽，
         逐人循环会把同岗位 N 人的量叠到同一个槽上 */
      this.addEnergyAll(4);
      return { ok: true, msg: "📄 论文本身一般，但组内讨论很热烈，全员体力 +4" };
    }
    if (kind === "conference") {
      if (!s.freeActions.conference) return { ok: false, tip: "这轮已经参加过学术会议了" };
      const cost = c.FREE_CONFERENCE_COST != null ? c.FREE_CONFERENCE_COST : this.FREE_CONFERENCE_COST;
      if (s.funding < cost) return { ok: false, tip: `经费不足（需要 ${cost / 10000} 万）` };
      s.freeActions.conference = false;
      s.funding -= cost;
      const brandGain = this.changeBrand(4);
      this.addEnergyAll(4);   // 2026-09-16：全员 → 按岗位去重（同岗位多人不再叠加）
      /* 提示里的花费用实际 cost（FREE_CONFERENCE_COST 可配置），不写死「-10 万」 */
      return { ok: true, msg: `🎓 学术会议收获不小：品牌 +${brandGain}、全员体力 +4（-${Math.round(cost / 10000)} 万经费）` };
    }
    return { ok: false, tip: "未知的自由行动" };
  },

  /* ---------------- 团队建设（P7，用户 2026-08-29）----------------
     团建 / 开会 / 1v1 谈话 / 奖金激励 / 员工培训。
     限制是金钱+体力而不是次数：团建/开会每轮一次；1v1、培训每人每轮一次；
     奖金不限次（钱是唯一限制）。培训涨属性 → 属性越高，阶段结算时
     词条升级/学新词条概率越大（与 upgradeTraitsByTalent 联动）。 */
  doTeamBuild(kind, targetId) {
    const c = this.cfg, s = this.state;
    const tb = c.TEAM_BUILD || {};
    /* 2026-09-12：聚餐改「每 2 周一次」→ meeting 改存上次周号（meetingWeek）；
       team（旅游）保持每周一次。下班窗口内一律不能团建。 */
    s.tbRound = s.tbRound || { team: false, meeting: false };
    if (this.offworkNow() && (kind === "team" || kind === "meeting")) {
      return { ok: false, tip: "🌙 都下班了还团什么建，明天上班再说吧" };
    }
    s.tbTalked = s.tbTalked || {};
    s.tbTrained = s.tbTrained || {};
    const DEF = { team: 100000, meeting: 0, talk: 0, bonus: 200000, train: 150000 };
    const cost = (k) => {
      const key = k.toUpperCase() + "_COST";
      return tb[key] != null ? tb[key] : DEF[k];
    };
    const pay = (k) => {
      const v = cost(k);
      if (s.funding < v) return { ok: false, tip: `经费不足（需要 ${v / 10000} 万）` };
      s.funding -= v;
      return null;
    };
    const clamp = (v) => Math.max(0, Math.min(100, v));
    if (kind === "team") {
      if (s.tbRound.team) return { ok: false, tip: "本周已经团建过了，下周再来" };
      const blocked = pay("team");
      if (blocked) return blocked;
      s.tbRound.team = true;
      /* 2026-09-22：体力「每人一份」→ 全员 +10 就是**每人各 +10**（addEnergyAll 逐人）。
         共享槽时代那套「按岗位去重」的补丁（同岗位 N 人会把同一个槽加 N 次）已随
         体力个人化一并取消。 */
      this.addEnergyAll(10);
      return { ok: true, msg: "🎉 团建圆满结束：全员体力 +10" };
    }
    if (kind === "meeting") {
      /* ⚠️ 2026-09-22 修 BUG（用户报「聚餐冷却到了两周也还是不重置」）：
         原来存/比的是 s.week（**阶段内**周数），而 _enterStage 会把 s.week 归零、
         已走的周数并进 weekOffset ⇒ 进新阶段后 `s.week − meetingWeek` 变成负数，
         永远 < 2 → 聚餐被永久锁死（等满两周也不恢复）。
         改用连续时钟 absWeek()（= week + weekOffset），跨阶段单调递增。 */
      const mw = s.tbRound.meetingWeek;
      const now = this.absWeek();
      if (mw != null && now - mw < 2) {
        return { ok: false, tip: "这两周已经聚餐过了，下下周再来吧" };
      }
      s.tbRound.meetingWeek = now;
      this.addEnergyAll(8);   // 2026-09-22：同上——全员效果逐人各 +8
      /* ⚠️ 文案要和 UI 上的活动名一致：面板里这一项叫「🍜 聚餐」，
         以前这里写的是「开会对齐了方向」，点了聚餐却弹出开会，对不上。 */
      return { ok: true, msg: "🍜 聚餐热热闹闹：全员体力 +8" };
    }
    // 目标类操作：先选人
    const e = s.engineers.find((x) => x.id === targetId && !x.resigned);
    if (!e) return { ok: false, tip: "先选一位工程师" };
    this.ensureStatus(e);
    if (kind === "talk") {
      if (s.tbTalked[e.id]) return { ok: false, tip: `这轮已经和 ${e.name} 谈过了` };
      s.tbTalked[e.id] = true;
      /* 2026-09-17：数值原来写死 5，与配置 TEAM_BUILD.TALK_ENERGY(=12) / 线上
         `arrangeEngineer` 的口径不一致（同一件事两个数，一旦有 UI 重新接上这条路径
         就会「面板写 +12、实际 +5」）。统一读配置，默认值与 arrangeEngineer 相同。
         ⚠️ 本路径目前**无 UI 入口**（tb-act / tb-pick 已无发射方，只有测试在调），
         保留是因为 team / meeting 两支仍被 test_p2events / test_corpus 覆盖。 */
      const talkGain = ((c.TEAM_BUILD || {}).TALK_ENERGY != null) ? c.TEAM_BUILD.TALK_ENERGY : 12;
      const dEn = this.addEnergy(e, talkGain);
      return { ok: true, msg: `🗣 和 ${e.name} 单独聊了聊：体力 +${dEn}` };
    }
    if (kind === "bonus") {
      const blocked = pay("bonus");
      if (blocked) return blocked;
      /* 2026-09-17：同上 —— 原写死 20，配置 RAISE_ENERGY(=30) / raiseSalary 都是 30 */
      const raiseEn = ((c.TEAM_BUILD || {}).RAISE_ENERGY != null) ? c.TEAM_BUILD.RAISE_ENERGY : 30;
      const dEn = this.addEnergy(e, raiseEn);
      /* 花费按实际 BONUS_COST（可配置），不写死「-20 万」 */
      return { ok: true, msg: `💰 ${e.name} 收到特别奖金：体力 +${dEn}（-${Math.round(cost("bonus") / 10000)} 万）` };
    }
    if (kind === "rest") {
      /* X2：个人休息（2026-09-08 改版）——让人下班，本周不产出，下周上班才回体力 */
      if (s.freeActions == null) s.freeActions = {};
      if ((s.tbRested || {})[e.id]) return { ok: false, tip: `${e.name} 这轮已经在休息了` };
      const gain = tb.REST_ENERGY != null ? tb.REST_ENERGY : 35;
      e.restWeek = s.week || 0;
      e.energyPending = (e.energyPending || 0) + gain;
      this.syncResting();
      s.tbRested = s.tbRested || {};
      s.tbRested[e.id] = true;
      // 本轮该人点击次数归零（休息去了）
      s.workClicks = s.workClicks || {};
      if (s.workQuota) s.workQuota[e.id] = (s.workClicks[e.id]) || 0;
      return { ok: true, msg: `😴 ${e.name} 下班休息了：本周不产出，下周上班恢复体力 +${gain}` };
    }
    if (kind === "train") {
      if (s.tbTrained[e.id]) return { ok: false, tip: `${e.name} 这轮已经培训过了` };
      const need = tb.TRAIN_ENERGY != null ? tb.TRAIN_ENERGY : 20;
      if (e.energy < need) return { ok: false, tip: `${e.name} 太累了（体力 ≥${need} 才能培训，当前 ${e.energy}）` };
      const blocked = pay("train");
      if (blocked) return blocked;
      s.tbTrained[e.id] = true;
      this.addEnergy(e, -need);
      const keys = this.baseDims();
      const k = keys[Math.floor(Math.random() * keys.length)];
      const cap = this.statCap();
      const before = s[k];
      s[k] = Math.min(this.statLimit(k, cap), s[k] + 3);
      return { ok: true, msg: `🏋 ${e.name} 培训归来：${this.statLabel(k)} +${s[k] - before}（属性越高，阶段结算时词条升级概率越大）` };
    }
    return { ok: false, tip: "未知的团队建设操作" };
  },

  /* ---------------- SFT / RM 小游戏（P5，用户 2026-08-29）----------------
     后训练的两块互动内容：
     SFT = 监督微调的数据质检（三选一挑值得进数据集的回答），
     RM   = 奖励模型的偏好标注（二选一选出更好的回答）。
     每题答对给数值奖励、全对有 CLEAR_BONUS，轮数与奖励可调。 */
  startMinigame(kindRaw) {
    const c = this.cfg, s = this.state;
    const kind = String(kindRaw || "").toLowerCase();   // 事件里写 "sft"/"rm"，配置键是大写
    if (this.embodiedAvailable(s) && (kind === "sft" || kind === "rm")) {
      this.retireLegacyMinigame(s);
      return false;
    }
    const mg = (c.MINIGAMES || {})[kind.toUpperCase()];
    /* X6：RM 从「二选一」改成「4 个回答按好→差排序」（题库 RM_SETS） */
    const bank = kind === "sft" ? (c.SFT_DATA || []) : (c.RM_SETS || []);
    if (!mg || !bank.length) return false;
    const rounds = Math.min(mg.ROUNDS || 3, bank.length);
    // 抽题 + 固定选项顺序（SFT 三选一要打乱好答案位置）
    const idx = [...bank.keys()];
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    /* 2026-09-05（用户拍板）：小游戏不再切一级界面（phase=minigame 全屏页已废止），
       共用事件触发链——周结算/事件选项触发后，弹出办公室二级面板「数据定期巡检」，
       时间像事件一样暂停（_mgWasPaused 记录触发前的暂停态，结束/关闭后恢复）。 */
    /* [feature:v2b-pause-inspection-start] */
    if (window.OfficePause) {
      if (!s.minigame) OfficePause.acquire(this, "inspection");
    } else {
      s._mgWasPaused = !!s.officePaused;
      s.officePaused = true;
    }
    /* [/feature:v2b-pause-inspection-start] */
    s.officeModal = "minigame";
    // 选项顺序也在开局固定（SFT 三选一：0=好答案；RM 四条排序：全部打乱）
    const optOrder = idx.slice(0, rounds).map((bankIdx) => {
      const it = bank[bankIdx];
      const n = kind === "sft" ? 3 : ((it && it.items) ? it.items.length : 4);
      const arr = [...Array(n).keys()];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
    s.minigame = {
      kind, round: 0, total: rounds, hits: 0,
      order: idx.slice(0, rounds),
      optOrder,
      picked: null,            // 本题已选：{ idx, ok, why }（SFT）
      rank: [],                // RM 排序：已点击的选项下标，按顺序即玩家排的名次
      log: [],                 // 每题结果，总结页展示
      gains: {},               // 奖励合计（总结页展示）
    };
    s.pendingMinigame = null;
    return true;
  },

  /* 作答：SFT 三选一传选项下标（RM 排序请用 minigameRank / minigameSubmitRank）。
     只记录与反馈，奖励统一在 finishMinigame 结算（中途读档不会重复加值）。 */
  minigamePick(optIdx) {
    const c = this.cfg, s = this.state;
    const m = s.minigame;
    if (!m || m.picked || m.kind !== "sft") return null;
    const bank = m.kind === "sft" ? (c.SFT_DATA || []) : (c.RM_SETS || []);
    const item = bank[m.order[m.round]];
    if (!item) return null;
    let ok = false, why = "";
    {
      // 选项顺序：good + bads 已在开局打乱并固定
      const choice = m.optOrder[m.round][optIdx];
      ok = choice === 0;   // 0 = good
      const src = choice === 0 ? item.good : item.bads[choice - 1];
      why = src.why;
      m.picked = { idx: optIdx, ok, why, choice };
    }
    if (ok) m.hits += 1;
    m.log.push({ q: item.q, ok, score: ok ? 1 : 0 });
    return m.picked;
  },

  /* ---- X6：RM 偏好排序（点击依次排位，不用拖拽）----
     点一次 = 把该回答排到「下一个位次」；rank 数组即玩家排出的顺序。 */
  minigameRank(optIdx) {
    const s = this.state;
    const m = s.minigame;
    if (!m || m.kind !== "rm" || m.picked) return null;
    m.rank = Array.isArray(m.rank) ? m.rank : [];
    const n = (m.optOrder[m.round] || []).length;
    if (m.rank.includes(optIdx)) return null;         // 已排过，忽略
    if (m.rank.length >= n) return null;
    m.rank.push(optIdx);
    return { rank: m.rank.slice(), full: m.rank.length >= n };
  },
  minigameResetRank() {
    const m = this.state.minigame;
    if (!m) return null;
    m.rank = [];
    return { rank: [] };
  },
  /* 提交排序：与标准答案比对 → 全对 1.0 分；只有相邻位次错位 0.5 分；其余 0 分 */
  minigameSubmitRank() {
    const c = this.cfg, s = this.state;
    const m = s.minigame;
    if (!m || m.kind !== "rm" || m.picked) return null;
    const item = (c.RM_SETS || [])[m.order[m.round]];
    if (!item) return null;
    const order = m.optOrder[m.round] || [];
    const n = order.length;
    if ((m.rank || []).length < n) return null;
    // 玩家排出的第 i 名 → 该回答的标准名次
    let maxOff = 0, perfect = true;
    const detail = [];
    m.rank.forEach((optIdx, i) => {
      const it = item.items[order[optIdx]];
      const std = it.rank || (i + 1);
      const off = Math.abs(std - (i + 1));
      maxOff = Math.max(maxOff, off);
      if (off !== 0) perfect = false;
      detail.push({ pos: i + 1, std, off, why: it.why, t: it.t });
    });
    const score = perfect ? 1 : (maxOff <= 1 ? 0.5 : 0);
    m.hits += score;
    m.log.push({ q: item.q, ok: score >= 1, score });
    m.picked = { kind: "rank", score, perfect, maxOff, detail };
    return m.picked;
  },

  minigameNext() {
    const s = this.state;
    const m = s.minigame;
    if (!m) return null;
    m.round += 1;
    m.picked = null;
    m.rank = [];
    if (m.round >= m.total) return { summary: this.finishMinigame() };
    return { next: true };
  },

  finishMinigame() {
    const c = this.cfg, s = this.state;
    const m = s.minigame;
    if (!m) return null;
    const mg = (c.MINIGAMES || {})[String(m.kind).toUpperCase()] || {};
    // 结算奖励：每题答对按 HIT 累加，全对再给 CLEAR_BONUS（都受数值上限约束）
    // 2026-09-12（用户要求）：奖励 × 阶段系数（MINIGAMES.VER_MUL，越往后越多，四舍五入取整）
    const verMul = ((c.MINIGAMES || {}).VER_MUL || {})[s.ver || "V1"];
    const mul0 = typeof verMul === "number" ? verMul : 1;
    const cap = this.statCap();
    const gains = {};
    const addReward = (table, mult) => {
      for (const k of Object.keys(table || {})) {
        // 取整后再加：RM 排序有 0.5 的半分，不能把小数留在能力值里
        if (this.dimsOf(s).indexOf(k) < 0) continue;   // doc/27 P5：未激活的轴不给（零痕迹）
        const v = Math.round((table[k] || 0) * mult * mul0);
        if (!v) continue;
        const before = s[k];
        s[k] = Math.min(this.statLimit(k, cap), Math.max(0, s[k] + v));
        gains[k] = (gains[k] || 0) + (s[k] - before);
      }
    };
    /* X6：RM 排序的得分是 0 / 0.5 / 1，按分数比例给奖励（四舍五入到整数）。
       SFT 每题得分是 0 / 1，走同一条逻辑。 */
    for (let i = 0; i < m.total; i++) {
      const rec = m.log[i];
      if (!rec) continue;
      const mult = rec.score != null ? rec.score : (rec.ok ? 1 : 0);
      if (mult > 0) addReward(mg.HIT, mult);
    }
    // 全对才有 CLEAR_BONUS（RM 要求每题都排对）
    const perfectAll = m.hits >= m.total - 1e-6;
    if (perfectAll) addReward(mg.CLEAR_BONUS, 1);
    for (const k of Object.keys(gains)) gains[k] = Math.round(gains[k]);
    // 计入双周报告
    /* 轴也要有中文名 —— 统一走 statLabel（单点真源），不要再另写一张 4 键表 */
    const gainTxt = Object.keys(gains).map((k) => `${this.statLabel(k)} +${gains[k]}`).join("、");
    if (gainTxt) {
      const label = m.kind === "sft" ? "SFT 数据质检" : "RM 偏好标注";
      s.lastReport = (s.lastReport || "") + `
🏷 ${label}（${m.hits}/${m.total} 对）：${gainTxt}`;
    }
    const summary = { kind: m.kind, hits: m.hits, total: m.total, gains, perfect: perfectAll };
    s.minigame = null;
    s.pendingMinigame = null;
    /* 2026-09-05：巡检结束 → 恢复时间（触发前若是暂停态则维持），总结留在巡检面板里展示。
       不再自动切评审：训练周期结束时时间自动停走，评审由玩家在「评审」面板自己发起。 */
    /* [feature:v2b-pause-inspection-finish] */
    if (window.OfficePause) OfficePause.releaseSource(this, "inspection");
    else s.officePaused = !!s._mgWasPaused;
    /* [/feature:v2b-pause-inspection-finish] */
    s._mgWasPaused = null;
    return summary;
  },

  /* ---------------- 语料 = 消耗品（P3，用户 2026-08-29）----------------
     训练每双周吃语料、data 词条工程师产出语料，玩家维持供需平衡。
     缺口不停摆：按比例给成长打折（成长 ×(1 - 缺口比例 × 0.6)）。 */
  /* 本双周语料需求（万条）：按参数规模，攻关代码/文字时吃得更多 */
  corpusDemand() {
    const c = this.cfg, s = this.state;
    if (this.v35On()) {
      /* 2026-09-05 彻底统一口径：直接调用引擎 v35_core.needAt（与看板 gapState/周末打折
         同一实现）——此前这里是手写的同构公式，与引擎一旦漂移就会出现
         「看板刻度/状态标签/提示」三套口径打架（用户反复反馈的根因）。 */
      const wk = Math.max(1, Math.ceil(s.v35.tick / c.V35.TICKS_PER_WEEK));
      return window.V35.needAt(s.v35, wk);
    }
    const cc = c.CORPUS || {};
    const table = cc.DEMAND_BY_PARAM || {};
    const base = table[String(s.paramTarget)] != null ? table[String(s.paramTarget)] : (table["7"] || 6);
    const mul = (s.focus && (s.focus.key === "text" || s.focus.key === "code")) ? (cc.FOCUS_MUL || 1.2) : 1;
    return Math.round(base * mul * 10) / 10;
  },

  /* v3.5 语料每周新增需求（与每周产量可比）
     2026-09-02 改版：**由架构 × 参数决定**，不再是一个按阶段写死的常数。
     开局默认最低档（dense + 7B）时，数据工程师到岗开工即可覆盖增量；
     选更贵的架构 / 更大的参数，增量抬升，逼玩家扩招数据岗或买语料。
     2026-09-05 彻底统一口径：直接调用引擎 v35_core.weekAdd（单一实现，杜绝漂移）。 */
  corpusWeekAdd() {
    const c = this.cfg, s = this.state;
    if (this.v35On()) {
      return window.V35.weekAdd(s.v35);
    }
    return this.corpusDemand();
  },

  /* 本双周语料产能（万条）：全员 data 词条等级 × 每级产能 × 精力比例。
     注意：不是只有「数据工程师」才产语料——按实际携带的 data 词条算（用户拍板）。 */
  corpusProduction() {
    const c = this.cfg;
    if (this.v35On()) {
      const s = this.state;
  /* [feature:multi-trait-dev-core-005] */
      /* 语料预估直接读取已到岗的实际数据词条，不依赖上一 tick 的岗位开关缓存。 */
      const engs = this.productionRoleEngs(s.v35, "data");
  /* [/feature:multi-trait-dev-core-005] */
      if (!engs.length) return 0;
  /* [feature:multi-trait-dev-core-006] */
      /* 体力系数与引擎一致：eff = 0.5 + 0.5×体力/100。 */
  /* [/feature:multi-trait-dev-core-006] */
      /* 个人涨薪倍率与个人体力共同进入同一编制的周产量，避免一人加薪给全组加成。
         临时估算对象不写引擎、不写存档；基础品质期望沿用 weeklyProductionEstimate。 */
      const estimate = { ...s.v35, extraData: engs.length - 1, restData: 0,
  /* [feature:multi-trait-dev-core-007] */
        dataTraitLvs: engs.map((e) => this.productionTraitLevel(e, "data")),
  /* [/feature:multi-trait-dev-core-007] */
        productionMulList: { data: engs.map((e) => {
          const en = this.ensureStatus(e).energy;
          return (0.5 + 0.5 * Math.max(0, en) / 100) * this.raiseProductionMul(e);
        }) } };
      /* 爆发沿用岗位口径；休假人员已从估算编制剔除。 */
      const bMul = this.burstActive("data") ? this.burstCfg().mul : 1;
      return Math.round(window.V35.weeklyProductionEstimate(estimate)
        * c.V35.TICKS_PER_WEEK * bMul * 10) / 10;
    }
    const per = (c.CORPUS && c.CORPUS.PROD_PER_LV) || 8;
    let lv = 0;
    for (const e of this.state.engineers) {
      if (e.resigned) continue;
      this.ensureStatus(e);
      for (const t of e.traits || []) {
        if (t.type === "data") lv += t.level * Math.max(0, e.energy || 0) / 100;
      }
    }
    return Math.round(lv * per * 10) / 10;
  },

  /* 采购语料（V3.5.2：外包品质随机——每条约 80% 普通 / 20% 良好，买 10 份约 2 份良好）
     旧模型：n 万条，花 n × 单价经费，受囤积上限约束 */
  buyCorpus(n) {
    const c = this.cfg, s = this.state;
    if (this.v35On()) {
      const items = n || 100;                              // 默认一次 100 条
      const buy = c.V35.CORPUS_CURVE.BUY;
      const costWan = items * (buy.price != null ? buy.price : 0.3);
      const cost = Math.round(costWan * 10000);            // 元，与引擎单价同口径
      if ((s.funding || 0) < cost) {
        return { ok: false, tip: `经费不足（需要 ${Math.round(costWan)} 万）` };
      }
      /* 2026-10-09：先验预算再入库，失败不消费随机数、不留下品质库存。
         旧回滚只减 token/items，漏掉 q，导致反复失败后重开面板条数虚增。 */
      const r = window.V35.buyCorpus(s.v35, items);
      s.funding -= cost;
      s.corpus = Math.round(s.v35.corpus.token * 10) / 10;
      return { ok: true, bought: items, cost, good: r.good, random: true };
    }
    const cc = c.CORPUS || {};
    const pack = n || cc.BUY_PACK || 10;
    // BUY_PRICE 单位是「万经费/万条」，经费字段是元 → ×10000
    const price = (cc.BUY_PRICE != null ? cc.BUY_PRICE : 1.5) * 10000 * pack;
    const cap = cc.CAP != null ? cc.CAP : 60;
    if (s.corpus >= cap) return { ok: false, tip: "语料库已经囤满了" };
    if (s.funding < price) return { ok: false, tip: `经费不足（需要 ${price} 万）` };
    const capLeft = Math.max(0, cap - s.corpus);
    const real = Math.min(pack, capLeft);
    s.funding -= price * (real / pack);   // 按实际买入量扣费
    s.corpus = Math.round((s.corpus + real) * 10) / 10;
    return { ok: true, bought: real, cost: Math.round(price * (real / pack)) };
  },

  /* ---------------- 工作间：点击增量（P1，用户 2026-08-29）----------------
     次数 = floor(精力 / PER_ENERGY)，每次点击消耗精力但不"点光"——
     精力低则次数少，玩家可以用团建 / 休假补精力后再点。 */
  workshopClicks(e) {
    const c = this.cfg, s = this.state;
    this.ensureStatus(e);
    const per = (c.WORK_CLICK && c.WORK_CLICK.PER_ENERGY) || 10;
    const byEnergy = Math.floor(Math.max(0, e.energy || 0) / per);
    /* 配额取「开局锁定的」与「当前精力重算的」较大值：
       - 锁定值保证点击过程中不会因为精力 -3 而越点越少
       - 当前值保证玩家中途用团建把精力补回来后，次数也跟着涨回去 */
    const quota = Math.max(((s.workQuota || {})[e.id]) || 0, byEnergy);
    const used = ((s.workClicks || {})[e.id]) || 0;
    return Math.max(0, quota - used);
  },

  /* 团队本轮剩余点击总数（判断是否还能点 / 一键全员是否可用） */
  workshopTotalLeft() {
    const s = this.state;
    return s.engineers.filter((e) => !e.resigned)
      .reduce((a, e) => a + this.workshopClicks(e), 0);
  },

  /* ==========================================================================
     办公室主循环（2026-08-30 新 UI）
     --------------------------------------------------------------------------
     对标《游戏发展国》：主界面一直在办公室，时间自动流逝（1 回合 = MS_PER_ROUND），
     每回合工程师消耗体力产出 → 累积到个人产出槽；玩家随时「收集」转模型数值。
     ========================================================================== */

  /* 当前办公室地图（座位 + 背景 + 容量） */
  scene() {
    const c = this.cfg, s = this.state;
    const era = c.EMBODIED || {};
    const key = this.embodiedAvailable(s) ? (era.NEW_SCENE_ID || "embodied") : (era.OLD_SCENE_ID || "v1");
    return (c.SCENES && c.SCENES[key]) || (c.SCENES && c.SCENES.v1) || { label: key, bg: "", cap: 4, seats: [] };
  },

  /* 语料囤积上限（新 UI 顶部 HUD 用） */
  corpusCap() {
    const c = this.cfg, s = this.state;
    if (this.v35On()) return 999999;   // 新模型：语料无囤积上限（需求曲线天然约束）
    return ((c.CORPUS_CAP_BY_VER || {})[s.ver || "V1"]) || (c.CORPUS && c.CORPUS.CAP) || 60;
  },

  /* 当前模型的「代号」：按实际训练规格（架构 + 参数下限）匹配逐阶段目标表 MISSIONS.BY_VER，
     让刷小模型评分的玩家看到的是**小模型自己的代号**（如 dense·7B → V1），
     而不是正在进行的游戏阶段版本号（2026-09-09 用户要求）。 */
  modelCode() {
    const c = this.cfg, s = this.state;
    const arch = s.arch || "dense";
    const param = s.paramTarget || 7;
    const BY = (c.MISSIONS && c.MISSIONS.BY_VER) || {};
    const order = c.VER_ORDER || ["V1", "V1.5", "V2", "V2.5", "V3", "V3.5", "V4", "V4.5"];
    const at=order.indexOf(s.ver);
    for (const ver of order.slice(0,at<0?order.length:at+1).reverse()) {
      const m = BY[ver];
      if (!m) continue;
      if (m.arch && m.arch !== arch) continue;
      if (m.param != null && param < m.param) continue;
      return ver;
    }
    return s.ver || "V1";
  },

  /* 是否可进入评审（V3.5.2：第 6 周末自动进入；V1 无失败档，但不允许提前白嫖评审） */
  canReview() {
    const c = this.cfg, s = this.state;
    if (!s.planDone) return false;
    if (s.phase !== "office") return false;
    if (this.v35On()) return (s.week || 0) >= this.minWeeks(s.ver);
    const r = this.evaluate();
    return this.isPassLike(r);
  },

  /* 本阶段最短可评审周数（DOC 26 P1）：按 MIN_WEEKS_BY_VER 按下标对齐 VER_ORDER 取，
     越界（配置漏配/未知阶段）取末项兜底；缺省回到旧版 V35.WEEKS。 */
  minWeeks(ver) {
    const c = this.cfg;
    const arr = c.MIN_WEEKS_BY_VER;
    if (Array.isArray(arr) && arr.length) {
      const order = c.VER_ORDER || [];
      const i = order.indexOf(ver || "");
      if (i >= 0 && i < arr.length) return arr[i];
      if (i < 0) return arr[arr.length - 1];      // 未知阶段 → 取最大的最短周数（最保守）
    }
    if (this.v35On()) return (c.V35 && c.V35.WEEKS) || 6;
    return 6;
  },

  /* 是否可测试（K3：测试 = 中途聊天，不评分；需要先立项且模型有点东西） */
  canTest() {
    const s = this.state;
    if (!s.planDone) return false;
    const hasStat = this.dimsOf(s).some((k) => (s[k] || 0) > 0);
    return hasStat || this.totalProd() > 0;
  },

  /* ==========================================================================
     P4 对话树 CHAT_TREE 引擎（doc/26 §5/§9/§11；2026-09-10 实装）
     --------------------------------------------------------------------------
     测试聊天按阶段走「节点对话树」：选项 → 跳转节点 → 三档随机回复 → 记事本双向。
     byCombo 为未来「实际立项架构×参数」取差异化文案预留；当前按 s.ver 直取整阶段树。
     ========================================================================== */
  /* 当前应展示的节点：chatNode 失效/为空 → 回该阶段 root */
  /* 解锁记事本：幂等 push（跨阶段保留），返回是否新增 */
  /* 选项隐藏判定：requireNote(含 ! 取反) / requireFlag:"auto" / needParam */
  _optHidden(opt) {
    const s = this.state, nb = s.notebook || [];
    const rn = opt.requireNote;
    if (rn) {
      const neg = rn[0] === "!";
      const id = neg ? rn.slice(1) : rn;
      const has = nb.includes(id);
      if (neg ? has : !has) return true;       // !id = 没拿过才显示
    }
    if (opt.requireFlag === "auto") {
      /* 托管训练 V4.5 之后才实装；当前 autoOn 不存在 → 恒隐藏 */
      if (!(this.autoOn && typeof this.autoOn === "function" && this.autoOn())) return true;
    }
    if (opt.needParam) {
      const need = parseFloat(opt.needParam);
      if (!need || !(s.paramTarget >= need)) return true;
    }
    return false;
  },
  /* 两档随机回复（2026-09-14 砍掉 half 档）：full 随机取1(去重) / dumb 走 GIBBERISH。
     variant:"note" 的节点 full 存 [有记事本, 无记事本] 两组，按 notebook 有/无取。 */
  /* ==========================================================================
     文案占位符 —— **唯一实现**（2026-09-19 收敛：以前有三套，口径还互相矛盾）
     --------------------------------------------------------------------------
     以前 `core.chatVar`（{param} 带 "B"、{arch}=显示名）与 NEWS_SELF_RELEASE 的 fill()
     （{param} 不带单位、{arch}=**代号**）是两份独立实现 ⇒ 同一个占位符在两处值不一样，
     而且 ui.tpl 只支持 {model}。现在统一到这一把尺子，三处都调它：

       {model}   玩家自定义模型名（开局命名；空 → MODEL_NAME_DEFAULT）
       {param}   参数档，**纯数字**（如 70）；未立项 / 没定参数 → 空串
       {arch}    架构**显示名**（如 moe-CSA）
       {archName} 同 {arch}（保留别名，兼容既有 8 处新闻文案）
       {archId}  架构**代号**（如 mla / dsa / csa）

     ⚠️ 三条不许动：
     ① **不转义**。TUTORIAL 文案里合法地写着 `<b>`（22 处），转义会把它们变成字面文本；
        转义是各渲染点自己的事（大多数点已 escHtml）。
     ② 顺序无关：`\{arch\}` 的正则要求紧跟 `}`，吃不掉 `{archName}` / `{archId}`。
     ③ 新增占位符只改这里 + 下面编辑器里的提示，别再各写一份。
     ========================================================================== */
  chatVars() {
    const s = this.state, c = this.cfg;
    const archCfg = (c.ARCHITECTURES || []).find((a) => a.id === s.arch) || {};
    const archId = s.arch || "";
    const archName = archCfg.name || archId || "—";
    return {
      whale: this.whaleName(),
      model: s.modelName || c.MODEL_NAME_DEFAULT || "模型",
      param: s.paramTarget != null ? String(s.paramTarget) : "",
      arch: archName,
      archName: archName,
      archId: archId,
    };
  },
  fillVars(str) {
    const v = this.chatVars();
    return String(str == null ? "" : str)
      .replace(/\{whale\}/g, () => v.whale)
      .replace(/\{model\}/g, v.model)
      .replace(/\{param\}/g, v.param)
      .replace(/\{archName\}/g, v.archName)
      .replace(/\{archId\}/g, v.archId)
      .replace(/\{arch\}/g, v.arch);
  },
  /* 兼容旧名（测试与既有调用点都用它）：等价于 fillVars */
  chatVar(str) { return this.fillVars(str); },

  /* ==========================================================================
     新模型：CHAT_TREE2（doc/29 · 选项树 · ID 关联）—— 与上面的老 chat* 并存
     --------------------------------------------------------------------------
     老模型「以她的话为节点」，新模型「以**玩家的选项**为节点」，前后关系只用 ID 关联。
     **有 `CHAT_TREE2.BY_VER[阶段]` 就走新逻辑，没有就回落老逻辑**（老存档/老配置不炸）。
     状态 `s.c2 = { lastOpt, lastAns, ended }`：老档没有这个字段 → 视为"开场"。
     ========================================================================== */
  c2Tree() {
    const byVer = ((this.cfg || {}).CHAT_TREE2 || {}).BY_VER || {};
    return byVer[this.state.ver] || null;
  },
  c2On() { return !!this.c2Tree(); },
  c2Notes() { return ((this.cfg || {}).CHAT_TREE2 || {}).NOTES || {}; },
  c2State() {
    const s = this.state;
    if (!s.c2 || typeof s.c2 !== "object") s.c2 = { lastOpt: null, lastAns: null, ended: false };
    if (s.c2.ended === undefined) s.c2.ended = false;
    return s.c2;
  },
  /* [feature:chat-stage-cursor] */
  /* 会话游标属于当前阶段；已看回答集合属于整局，重开话题不能丢成就记录。 */
  c2Reset() {
    const old = this.state.c2;
    const seen = old && old.seen && typeof old.seen === "object" && !Array.isArray(old.seen) ? old.seen : {};
    this.state.c2 = { lastOpt: null, lastAns: null, ended: false, ver: this.state.ver, seen };
  },
  /* 老档没有阶段标记时，按当前选项及其全部回答链校验；合法分支/终点不强制重开。 */
  healC2() {
    const c2 = this.c2State(), tree = this.c2Tree();
    if (!c2.seen || typeof c2.seen !== "object" || Array.isArray(c2.seen)) {
      c2.seen = {};
      if (c2.lastAns) c2.seen[String(c2.lastAns)] = this.state.week || 0;
    }
    if (!tree) return false;
    const opt = c2.lastOpt == null ? null : (tree.opts || {})[String(c2.lastOpt)];
    let invalid = c2.ver != null && c2.ver !== this.state.ver;
    if (c2.lastOpt != null && !opt) invalid = true;
    if (c2.lastAns != null) {
      const replies = opt && opt.ans || {};
      const known = Object.keys(replies).some(tier => Array.isArray(replies[tier])
        && replies[tier].some(answer => this.c2FlattenThen(answer).some(x => x.id != null && String(x.id) === String(c2.lastAns))));
      if (!known) invalid = true;
    }
    if (invalid) this.c2Reset();
    else c2.ver = this.state.ver;
    return invalid;
  },
  /* [/feature:chat-stage-cursor] */
  /* 记事本判定：**只认数字 ID**（2026-09-12 用户拍板：游戏还没上线、没有老存档，
     把「别名 alias / 老 NOTEBOOK 表」那套兼容层整个删掉，配置里只留一套 ID）。
     `s.notebook` 现在就是 ID 数组（["1001"]）。 */
  c2HasNote(id) {
    if (id == null) return false;
    return (this.state.notebook || []).indexOf(String(id)) >= 0;
  },
  c2UnlockNote(id) {
    if (id == null) return false;
    const nid = String(id);
    /* 2026-10-01：NOTES 内容表清空后，树上还留着悬空 noteFor（V3.10030 / V3.5.10200 → "1002"）。
       不在 NOTES 里的 id 一律拒绝解锁 —— 防幽灵记事本进存档（老档幽灵 id 由 healNotebook 清）。 */
    if (!this.c2Notes()[nid]) return false;
    /* 2026-09-19：原来委托给老树的 chatUnlockNote，老树删除后必须自己实现（幂等 push）。 */
    const n = this.state.notebook = Array.isArray(this.state.notebook) ? this.state.notebook : [];
    if (!n.includes(nid)) { n.push(nid); return true; }
    return false;
  },
  /* 条件判定（选项与回答共用同一套 type，见 doc/29 §2.3） */
  c2CondOk(c, oid) {
    if (!c) return false;
    const c2 = this.c2State();
    switch (c.type) {
      case "none": return true;                                  // 选项侧：开场
      case "fallback": return true;                              // 回答侧：兜底
      case "prevOpt": return (c.ids || []).indexOf(c2.lastOpt) >= 0;
      case "prevAns": return (c.ids || []).indexOf(c2.lastAns) >= 0;
      case "note": return this.c2HasNote(c.id);
      case "noNote": return !this.c2HasNote(c.id);
      case "flag": return !!(this.autoOn && typeof this.autoOn === "function" && this.autoOn());
      default: return false;
    }
  },
  /* 可见选项：`start`（开场）**或** `cond` 命中 —— OR 关系 */
  c2VisibleOpts() {
    const t = this.c2Tree();
    if (!t) return [];
    const c2 = this.c2State();
    if (c2.ended) return [];
    const atStart = !c2.lastOpt && !c2.lastAns;
    const out = [];
    for (const id of Object.keys(t.opts || {})) {
      const o = t.opts[id];
      /* 走向 start/end 的选项属于元操作 —— UI 有固定的「换个话题 / 结束测试」按钮，
         不再重复塞进对话选项行（老模型里它们是 "回开场/结束" 两个选项，同一个意思） */
      if (o.next === "start" || o.next === "end") continue;
      const byStart = !!o.start && atStart;
      const byCond = o.cond && o.cond.type !== "none" && this.c2CondOk(o.cond);
      if (byStart || byCond) out.push(Object.assign({}, o, { _id: id }));
    }
    return out;
  },
  /* 状态行：老模型取 root.tiers，新模型取 stage.status（两档 dumb/full，2026-09-14 砍掉 half） */
  c2Status(tier) {
    const t = this.c2Tree();
    if (!t) return "";
    const k = tier === "full" ? "full" : "dumb";
    const arr = ((t.status || {})[k]) || [];
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : "";
  },
  /* 挑回答：**命中条件优先** → 否则在 fallback 里随机取一 → 该档没内容按老口径回落 */
  c2PickReply(o, tier, oid) {
    const s = this.state, c = this.cfg;
    const tk = tier === "full" ? "full" : "dumb";
    const list = (((o.ans || {})[tk]) || []).slice();
    const hit = list.filter((a) => a.cond && a.cond.type !== "fallback" && this.c2CondOk(a.cond));
    const pool = hit.length ? hit : list.filter((a) => !a.cond || a.cond.type === "fallback");
    if (!pool.length) {
      if (tk === "dumb") {                                        // 未开智没配内容 → 全局咕嘎池
        const g = (c.GIBBERISH && c.GIBBERISH.slice()) || ["咕嘎……%%￥#@&*"];
        return { id: null, type: "text", text: g[Math.floor(Math.random() * g.length)], cond: null };
      }
      const fb = ((((o.ans || {}).full) || [])[0]) || null;
      if (fb) return fb;
      const g2 = (c.GIBBERISH && c.GIBBERISH.slice()) || ["咕嘎……%%￥#@&*"];
      return { id: null, type: "text", text: g2[Math.floor(Math.random() * g2.length)], cond: null };
    }
    /* 同类多条 → 随机取一，且尽量不连着重复同一条（与 chatPickReply 同口径） */
    const idxMap = s._lastReplyIdx = (s._lastReplyIdx && typeof s._lastReplyIdx === "object") ? s._lastReplyIdx : {};
    const key = "c2:" + (s.ver || "V1") + ":" + (oid || o._id || "");
    const cand = (pool.length > 1 && idxMap[key] != null) ? pool.filter((_, i) => i !== idxMap[key]) : pool;
    const pick = cand[Math.floor(Math.random() * cand.length)];
    idxMap[key] = pool.indexOf(pick);
    return pick;
  },
  /* 选一个选项：记 lastOpt → 挑回答 → 记 lastAns → 返回 { opt, reply, next } */
  c2Choose(optId, tier) {
    const t = this.c2Tree();
    if (!t) return null;
    const o = (t.opts || {})[String(optId)];
    if (!o) return null;
    const c2 = this.c2State();
    c2.lastOpt = String(optId);
    c2.ended = false;
    if (o.next === "start") { c2.lastAns = null; return { opt: o, optId: String(optId), reply: null, next: "start" }; }
    if (o.next === "end") { c2.lastAns = null; c2.ended = true; return { opt: o, optId: String(optId), reply: null, next: "end" }; }
    const a = this.c2PickReply(o, tier || "full", String(optId));
    /* 回答连回答（`then` 链，2026-09-21）：回答可挂 `then:[回答…]` 依次连播——
       典型配置：先播一条独立思维链（type:"think"），再播正常正文（各自成泡）。
       **支持任意层**：链上的回答自己还能继续挂 then（递归展平，深度优先）。
       ⚠️ 落点口径：**链尾**（展平后的最后一条）才算这条回答的结尾 ⇒ lastAns 记链尾 id，
       后续选项的 cond.ids 请指向链尾（不是主回答）。 */
    const chain = this.c2FlattenThen(a);                   // [a, ...所有后代]
    const tail = chain.length ? chain[chain.length - 1] : a;
    c2.lastAns = (tail && tail.id) ? String(tail.id) : null;
    /* 成就「把评测玩成 gal game」（doc/35 §3.6）：累计"看到过哪些回答"。
       `lastAns` 只记最后一次 ⇒ 必须另存一份只增不减的集合。
       ⚠️ 这是**新字段**，老档没有 → 读档自愈时用 lastAns 至少补种一条（见 loadState）。
       then 链上每一条都算「看到过」，每一条都能解锁记事本。 */
    chain.forEach((x) => {
      if (!x || !x.id) return;
      if (!c2.seen || typeof c2.seen !== "object") c2.seen = {};
      if (!c2.seen[String(x.id)]) c2.seen[String(x.id)] = this.state.week || 0;
      if (x.noteFor) this.c2UnlockNote(x.noteFor);           // 这条回答解锁记事本（链上每条都认）
    });
    return { opt: o, optId: String(optId), reply: a, next: "continue" };
  },

  /* 回答连回答（`then` 链）的**递归展平**：深度优先，返回 [node, ...它的所有后代]。
     ⚠️ 深度上限只是**兜底**（脏数据成环时不至于把引擎卡死）—— 正常配置远达不到；
        成环由编辑器侧的连线防环 + 校验拦住（见 chatTreeView.canConnect / chatTree 校验）。 */
  c2FlattenThen(node, out, depth) {
    out = out || [];
    depth = depth || 0;
    if (!node || typeof node !== "object" || depth > 50) return out;
    out.push(node);
    const subs = Array.isArray(node.then) ? node.then : [];
    for (const sub of subs) this.c2FlattenThen(sub, out, depth + 1);
    return out;
  },

  /* ---- 过程可见（doc/26 §3）：CALL_LOG 配置读取 ---- */
  callLogCfg() { return (this.cfg || {}).CALL_LOG || {}; },
  callLogOn() { return this.callLogCfg().ENABLED !== false; },
  callLogStepMs() { return Number(this.callLogCfg().STEP_MS) || 700; },
  callLogSteps(tool) {
    const C = this.callLogCfg();
    const by = (C.BY_TOOL || {})[tool];
    return (by && by.length ? by : (C.DEFAULT || ["正在思考…", "正在调用工具…"]));
  },

  /* 开始最终评审 → 播测评演出台（K5） */
  startReview() {
    const s = this.state;
    if (!this.canReview()) return { ok: false, tip: "还没达标，再练练" };
    /* 2026-10-04：与 enterReview() 同口径清悬挂事件。V3.5 的评审是玩家从面板主动发起的
       （不经过 enterReview），而 canReview() 不看 pendingEvent —— 玩家完全可能带着一张
       没作答的 pause:false 卡片点评审，那张卡的 id 会一路带进下一阶段（见 _enterStage 注释）。 */
    s.pendingEvent = null;
    s.result = this.evaluate();
    return { ok: true, result: s.result };
  },

  /* 该地图可招人数上限 = min(cap, 座位数)。
     ⚠️ 2026-09-12（用户实测「招聘可超出配置的人数上限」）：这里以前只认 `sc.cap`，
     而地图页的输入框叫「容量（可招人数上限）」、存的是 **`sc.seatCap`**
     （配置的字段名，main.js 保存全部时才映射成 cap）——两个名字并存，
     只要那次映射没发生，用户改的容量就永远不会被游戏读到，而且**不报错**。
     现在两个键都认（cap 优先），任一侧有值都生效。 */
  seatCap() {
    const sc = this.scene();
    const cap = sc.cap != null ? sc.cap : (sc.seatCap != null ? sc.seatCap : 4);
    return Math.max(1, Math.min(cap, (sc.seats || []).length || 4));
  },

  /* ==========================================================================
     座位（2026-08-30）：地图【🪑 座位】工具配置的座位，决定头像在场景里的位置，
     cap 决定可招人数上限。招聘即占座，辞退即释放。
     ========================================================================== */
  assignSeat(engId) {
    const s = this.state;
    const seats = this.scene().seats || [];
    s.seatOf = s.seatOf || {};
    if (!seats.length) return -1;
    /* 2026-09-16 修「头像重叠」：占用只看**在编**的人——事件离职（target_resign）
       历史上不 freeSeat，幽灵条目会把座位占满，逼新人走 -1 回退与人撞位。
       Set 天然去重，重复条目也不会扩大占用。 */
    const used = new Set(
      s.engineers.filter((x) => !x.resigned && s.seatOf[x.id] != null).map((x) => s.seatOf[x.id])
    );
    for (let i = 0; i < seats.length; i++) {
      if (!used.has(i)) { s.seatOf[engId] = i; return i; }
    }
    return -1;   // 座位满了
  },

  /* 座位批量解析（2026-09-16 修「头像重叠」，UI 办公室渲染统一走这里）：
     为全体在编工程师产出 { engId: seatIdx }，并就地修复 seatOf 的三类脏数据——
     ① 幽灵座位：事件离职历史上不 freeSeat，resigned 的人还占着座位（assignSeat 已改为只看在编，
        这里第一遍也只信在编的映射）；② 重复占位：异常路径让两人在编共享同一下标 → 先到先得，后者补空位；
     ③ 越界：旧档/换图残留的 seatOf 值超出 seats 范围 → 作废重分。
     在编 > 座位数（2026-09-12 上限闸门之前的老档超编遗留）时，多出的人**不写入 seatOf**、
     映射里缺位 → UI 落到真实座位之外的确定性溢出网格，绝不与任何真座位重叠。 */
  resolveSeats() {
    const s = this.state;
    const seats = this.scene().seats || [];
    const alive = s.engineers.filter((e) => !e.resigned);
    s.seatOf = s.seatOf || {};
    const out = {};
    const used = new Set();
    for (const e of alive) {                      // 第一遍：合法映射直接沿用
      const v = s.seatOf[e.id];
      if (Number.isInteger(v) && v >= 0 && v < seats.length && !used.has(v)) {
        out[e.id] = v; used.add(v);
      }
    }
    for (const e of alive) {                      // 第二遍：缺座的按空位顺序补齐
      if (out[e.id] != null) continue;
      for (let i = 0; i < seats.length; i++) {
        if (!used.has(i)) { out[e.id] = i; used.add(i); s.seatOf[e.id] = i; break; }
      }
    }
    /* 第三遍：seatOf 卫生——清掉幽灵（离职者/失踪者）与越界残留，存档不带垃圾 */
    const aliveSet = new Set(alive.map((e) => e.id));
    for (const k of Object.keys(s.seatOf)) {
      const v = s.seatOf[k];
      if (!aliveSet.has(k) || !Number.isInteger(v) || v < 0 || v >= seats.length) delete s.seatOf[k];
    }
    return out;
  },

  freeSeat(engId) {
    if (this.state.seatOf) delete this.state.seatOf[engId];
  },

  /* 员工当前座位下标（没分配就现分一个） */
  seatIndex(engId) {
    const s = this.state;
    s.seatOf = s.seatOf || {};
    if (s.seatOf[engId] == null) return this.assignSeat(engId);
    return s.seatOf[engId];
  },

  /* 单个工程师每回合的产出速率（词条 / 体力 / 主属性 / 攻关 / 论文 加成） */
  prodRate(e, atRound) {
    const c = this.cfg, s = this.state;
    const O = c.OFFICE || {};
    this.ensureStatus(e);
    const mainType = this.mainTrait(e).type || "pretrain";
    const mainLv = this.mainTraitLevel(e);
    const traitMul = (O.PROD_TRAIT_MUL || {})[mainType] || 1;
    /* 2026-09-05：原读 TRAIT_POTENTIAL（旧升级配置，已删）。这里只是产量系数的属性依据，内置即可。 */
    const statKey = ({ pretrain: "algo", post: "algo", engineer: "code", data: "code", academic: "algo" })[mainType] || "algo";
    const statVal = (e.stats || {})[statKey] || 0;
    let rate = (O.PROD_BASE || 0.8)
      * traitMul
      * (1 + (e.energy || 0) * (O.PROD_ENERGY_MUL || 0.008))
      * (1 + statVal * (O.PROD_STAT_MUL || 0.006))
      * (1 + (mainLv - 1) * 0.15)
      * this.raiseProductionMul(e, atRound);
    // 攻关加成（只加选定方向）
    if (s.focusBoost && s.focusBoost.roundsLeft > 0 && s.focusBoost.dim === this.mainDimOf(e)) {
      rate *= s.focusBoost.mul;
    }
    // 已掌握论文的效果（产出类）
    for (const pid of s.papersOwned || []) {
      const p = this.paperOf(pid);
      if (!p) continue;
      if (p.effect.kind === "prod" && (p.effect.dim === "all" || p.effect.dim === this.mainDimOf(e))) {
        rate *= p.effect.mul;
      }
    }
    return Math.round(rate * 100) / 100;
  },

  /* 该员工的产出换算到哪个维度（由其主词条决定） */
  mainDimOf(e) {
    const map = { pretrain: "code", post: "text", academic: "code", engineer: "stability", data: "safety", safety: "safety" };
    return map[this.mainTrait(e).type] || "code";
  },

  /* 一次 tick（由 UI 每秒调用；内部按 MS_PER_ROUND 判断是否推进一回合） */
  officeTick(now) {
    const c = this.cfg, s = this.state;
    const O = c.OFFICE || {};
    if (s.officePaused || s.phase !== "office") return null;
    /* V3.5.2：训练周期（V35.WEEKS 周）结束后**时间不再停走**（2026-09-09 用户拍板）——
       想冲击上限的玩家可继续训练，评审用同一个「评审」面板随时自己发起；
       周数超过 WEEKS 后语料需求曲线继续上涨，形成自然的天花板。
       不要再自动停摆或弹评审（那会让想冲上限的人被卡死）。 */
    /* 新手教学：必要操作未完成 → 直接暂停游戏（招聘 → 买算力 → 立项），完成后自动继续 */
    if (this.guidePending()) {
      s._tickAt = now;
      /* ⚠️ 2026-09-13（血泪）：这一行 return null 会让 officeAdvanceV35 **根本不执行** ——
         而「还没立项」正是自研架构提案必须出现的时刻（玩家没有可选架构就立不了项）。
         只在 officeAdvanceV35 里挂提案 = 真机上永远弹不出来（测试直调引擎会假绿通过）。
         所以引导门这里也要跑一次提案检查，返回与引擎同形状的最小日志让 UI 照常弹卡。 */
      return this.proposalTick();
    }
    /* V3.5.2：10 秒一个产出 tick（V35.TICK_S）；旧模型仍为 MS_PER_ROUND
       V3.5.4：产出速度在 10±3 秒之间随机波动（每个产出周期独立抖动）
       2026-09-05 语料不足阶梯惩罚（用户拍板）：满足率 ≥90% 无影响；
       90 以下每低 10%，产出周期 +1 秒（10s → 12s → 14s…），团队整体节奏变慢。 */
    let ms = this.v35On() ? c.V35.TICK_S * 1000 : (O.MS_PER_ROUND || 60000);
    if (this.v35On()) {
      const jitter = (c.V35 && c.V35.TICK_JITTER != null) ? c.V35.TICK_JITTER : 3;   // ±3s
      ms += (Math.random() * 2 - 1) * (jitter * 1000);
      /* 语料不足 → 产出周期延长（分阶梯，缺省 90 分界 / 每 10% +1s，可配 V35.GAP_SLOW） */
      const gs = (c.V35 && c.V35.GAP_SLOW) || {};
      const free = gs.FREE_ABOVE != null ? gs.FREE_ABOVE : 90;
      const step = gs.STEP != null ? gs.STEP : 10;
      const delay = gs.DELAY_MS != null ? gs.DELAY_MS : 1000;
      const pct = window.V35 && window.V35.gapPct ? window.V35.gapPct(s.v35) : 100;
      if (pct < free) ms += Math.floor((free - pct) / step + 1e-9) * delay;
      /* 优质加成（2026-09-12 用户定稿）：优质配比每 +20%，产出周期 -N 秒。
         与语料不足的 +N 秒惩罚同场叠加，下限夹 1s。 */
      const premiumS = this.qualityPremiumS();
      if (premiumS > 0) ms -= premiumS * 1000;
      ms = Math.max(1000, ms);
    }
    if (!s._tickAt) s._tickAt = now;
    if (now - s._tickAt < ms) return null;
    s._tickAt = now;
    return this.officeAdvance(1);
  },

  /* 引导门（未完成必要操作 → 时间暂停）期间的「团队提案」检查（2026-09-13）：
     officeTick 在 guidePending() 非空时直接 return，officeAdvanceV35 不会执行；
     而「尚未立项」恰恰是自研架构提案必须出现的时刻 → 这里单独跑一次，
     返回与 officeAdvanceV35 同形状的最小日志（UI 只看 r.event 就会弹卡）。
     已批准 / 没有待提案 → 返回 null；**未批准则每帧重投**（见下方说明）。 */
  proposalTick() {
    const s = this.state;
    if (!s) return null;
    const ev = this.pendingProposalEvent();
    if (!ev) return null;
    /* ⚠️ 2026-09-29：这里**不再 return null**（原写法「已在屏上就不重复投递」）——
       s.pendingEvent 只代表「引擎投过」，不代表「UI 弹出来了」。UI 那一帧若因别的卡片
       在屏上而静默丢弃，旧写法就再也不投 ⇒ 提案被卡没（用户报的 bug）。
       现在由 pendingProposalEvent() 内部做让路判断，未批准就每帧投；UI 自己按 #ob-evspawn 去重。 */
    s.pendingEvent = { id: ev.no };
    s._lastEvtTick = s.rounds;
    return { rounds: 0, weekUp: false, payroll: null, paperDone: null,
             breakthrough: false, floats: [], weekly: null, event: ev };
  },

  /* 新手教学门：返回当前「卡住的必要操作」（null = 引导已完成，时间正常流逝）
     顺序固定：招聘第一名工程师 → 采购算力 → 立项（doc/13 §3.4 开局引导） */
  guidePending() {
    const s = this.state;
    if (!this.v35On() || s.phase !== "office") return null;
    if (!(s.engineers || []).some((e) => !e.resigned)) return { key: "recruit", tip: "先完成招聘——团队里还没有工程师" };
    if (!s.gpuTier) return { key: "shop", tip: "先采购算力——没有 GPU，工程师开不了工" };
    if (!s.planDone) {
      /* 2026-10-04（死档兜底）：本阶段主线若是**自研架构**（等团队提案才能解锁），
         光说「先完成立项」是死路 —— 立项面板里那个架构是灰的，玩家不知道要**等一张提案卡**，
         于是干等 / 以为坏了（玩家原话「提案没正常触发，导致立项卡住」）。
         这里点名说清「团队会提方案，看到卡片点批准即可」，把死路变成可行动指引。 */
      const need = ((((this.cfg || {}).MISSIONS || {}).BY_VER || {})[s.ver || "V1"] || {}).arch;
      const a = ((this.cfg || {}).ARCHITECTURES || []).find((x) => x.id === need) || null;
      if (a && (a.unlockBy === "approval" || a.unlockBy === "embodied") && !this.archUnlock(a).approvalOk) {
        return { key: "plan", tip: "等团队提方案：" + a.name + " 要「团队提案」批准后才能立项，"
          + "办公室会弹出「" + a.name + " 提了一个新架构设想」，看到后点「批准立项」", arch: a.id, archName: a.name };
      }
      return { key: "plan", tip: "先完成立项——立项之后训练才会开始" };
    }
    return null;
  },

  /* 自研路线「团队提案」事件（2026-09-13 用户要求）：
     自研架构（ARCHITECTURES[*].unlockBy === "approval"：mla / dsa / csa）在现实中就是
     我们自己提出并发布的报告（DeepSeek-V2 / V3.2 / V4），凭什么还让玩家去研读别人的论文？
     → 改为「团队提出架构设想 → 老板批准 → 架构组合直接解锁」。
     触发条件：到了该阶段 + 该阶段主线要求的架构是自研 + 还没批准。
     ⚠️ 优先级高于常规事件掷骰（主线卡着时不该被「内测群冒泡了」抢走弹窗）。
     ⚠️ 必须写 log.event —— s.pendingEvent 全项目没有读取方（跟 V35_BAILOUT 同理）。
     ⚠️ 「强制触发」= 只要还没批准就**每帧都可以重投**，不再记「本阶段问过」：
        2026-09-29 修「提案被卡没」—— 旧实现用 s._propAsked 在**排程那一刻**就记「问过」，
        而 UI 的 showOfficeEvent 在已有别的卡片在屏上时会静默 return（比如 pause:false 的
        「电费涨价」还等着玩家作答），于是这一次投递被丢弃、_propAsked 也已置位 →
        提案永远不再出现 ⇒ 自研架构拿不到、主线卡死。选项也不再提供「先搁一搁」（只有一个选项）。 */
  pendingProposalEvent() {
    const c = this.cfg, s = this.state;
    if (!this.v35On()) return null;
    const ver = s.ver || "V1";
    const need = (((c.MISSIONS || {}).BY_VER || {})[ver] || {}).arch;
    if (!need) return null;
    const a = (c.ARCHITECTURES || []).find((x) => x.id === need);
    if (!a || !["approval", "embodied"].includes(a.unlockBy)) return null;
    if (this.archUnlock(a).approvalOk) return null;                        // 已经批过了
    const ev = (c.EVENTS || []).find((e) => e.special === "proposal"
      && e.arch === a.id && e.enabled !== false);
    if (!ev) return null;
    /* ---- 让路判定（2026-10-04 修「V2 提案永不出现 → 立项死锁」）----
       ⚠️⚠️ 旧写法「pendingEvent 被**别的**事件占住就 return null」是个**无期限**的等待：
       pendingEvent 只在 applyEventOption 里清，而它跨阶段会**残留**（_enterStage 不清它，
       startReview 也不清）—— 玩家在 V1.5 弹了一张 pause:false 的「电费涨价」没作答就去点了评审，
       进 V2 后 pendingEvent 仍指着 1002 ⇒ 提案**永远**让路 ⇒ 玩家看到 mla 灰着、
       guidePending 又卡着「先完成立项」⇒ 时间不推进 + 立项选不了 = 死锁。
       同一条判据还挡住常规事件掷骰（`!s.pendingEvent`），于是整个事件系统一起僵住。

       现在：让路只在「占位事件确实还是活的」时成立 —— 两个可判据任一为真就**接管**（自愈）：
         ① 占位的是 special 事件（proposal / V35_BAILOUT）—— 它们不靠掷骰投递，
            残留必然是脏状态；
         ② 该事件 id 已不在 EVENTS 里（被删/退役的旧档残留）。
       剩下一种合法让路 = 另一张**真·掷骰事件**在屏上等玩家作答，这个保留（抢弹窗体验更差）。 */
    if (s.pendingEvent && this.evNoOf(s.pendingEvent.id) !== ev.no) {
      const busy = this.evNoOf(s.pendingEvent.id);
      const busyEv = busy != null ? (c.EVENTS || []).find((e) => e.no === busy) : null;
      const stale = !busyEv || !!busyEv.special;   // 查无此事件 / 特殊事件 → 残留脏状态
      /* ⚠️ 2026-10-04 死档兜底（第三层）：合法让路也**必须有上限**。
         「另一张真·掷骰事件在屏上」这个理由本身成立（不抢玩家正在看的弹窗），
         但玩家**可能一直不答**（卡最小化、忘了、或干脆没意识到那是张卡）
         ⇒ 提案永远不来 ⇒ 又是死档（时间不推进 + 立项灰着）。
         所以：让路超过 N 个 tick 之后**强制接管** —— 宁可抢一次弹窗，也不能让主线卡死。
         ⚠️ N 取「一轮训练周期」量级：足够玩家从容答完一张卡，又不会等到天荒地老。 */
      /* ⚠️ 计时哨兵用 `== null`（未起算）而不是数字 0：
         若把「未起算」当成 0 来算已等时长，`rounds - 0` 在中后期是个大数
         ⇒ **第一次让路就判定超时、立刻抢弹窗**（等于没有让路，体验反而更差）。
         所以未起算时 elapsed 恒为 0（刚开始等），起算后才按 rounds 差值算。 */
      const maxYield = (c.V35 && c.V35.TICKS_PER_WEEK ? c.V35.TICKS_PER_WEEK * 6 : 36);
      const elapsed = s._propYieldSince == null ? 0 : (s.rounds || 0) - s._propYieldSince;
      if (!stale && elapsed < maxYield) {
        /* 还在耐心等待期内：第一次让路时记下起算点，之后继续让路 */
        if (s._propYieldSince == null) s._propYieldSince = s.rounds || 0;
        return null;
      }
      /* 等待期已过（或本来就是脏残留）→ 接管，并清掉让路计时 */
      s._propYieldSince = null;
      s.pendingEvent = null;   // 放行前先清干净，下面两处投递分支都写 pendingEvent
    }
    s._propYieldSince = null;   // 闸门空着（本次真投出去了）→ 清计时，下次让路重新起算
    /* 提议人 = 对应岗位里潜力最高的在职者（文案里的 {name}）——讲得出方案的总得是最懂的那位 */
    const sum = (e2) => (e2 && e2.stats
      ? (e2.stats.code || 0) + (e2.stats.algo || 0) + (e2.stats.text || 0) : 0);
    const alive = s.engineers.filter((e) => !e.resigned
      && (e.joinTick == null || (s.v35 && s.v35.tick >= e.joinTick)));
    const roleWant = a.id === "mla" ? "data" : "post";
    const role = alive.filter((e) => this.v35RoleOf(e) === roleWant);
    const who = (role.length ? role : alive).slice().sort((x, y) => sum(y) - sum(x))[0];
    return who ? Object.assign({}, ev, { targetName: who.name }) : ev;
  },

  /* 推进 n 个回合（产出 / 体力 / 攻关倒计时 / 论文倒计时 / 工资） */
  officeAdvance(n) {
    const c = this.cfg, s = this.state;
    if (this.v35On()) return this.officeAdvanceV35(n);
    const O = c.OFFICE || {};
    const P = c.PAYROLL || {};
    const alive = s.engineers.filter((e) => !e.resigned);
    const log = { rounds: n, weekUp: false, payroll: null, paperDone: null, focusEnd: null };
    const beforeWeek = s.week;

    for (let i = 0; i < n; i++) {
      s.rounds = (s.rounds || 0) + 1;
      s.absRounds = (s.absRounds || 0) + 1;   // 绝对回合（跨阶段不清零，见 newState）
      // 周数推进（ROUNDS_PER_WEEK 回合 = 1 周）
      if ((O.ROUNDS_PER_WEEK || 7) > 0 && s.rounds % (O.ROUNDS_PER_WEEK || 7) === 0) {
        s.week = Math.min(c.TOTAL_WEEKS || 99, (s.week || 0) + 1);
        log.weekUp = true;
      }
      for (const e of alive) {
        this.ensureStatus(e);
        const cost = (O.WORK_ENERGY_COST || 1) * (this.energyCostMul());
        if ((e.energy || 0) >= (O.WORK_ENERGY_MIN || 20)) {
          // 产出累积（不满槽才加）
          const gain = this.prodRate(e, Math.max(0, (s.absRounds || 0) - 1));
          const cur = (s.prodByEng[e.id]) || 0;
          const cap = O.SLOT_CAP || 24;
          const next = Math.min(cap, cur + gain);
          s.prodByEng[e.id] = Math.round(next * 100) / 100;
          if (next >= cap - 0.001) s.prodFullByEng[e.id] = true;
          e.energy = Math.max(0, (e.energy || 0) - cost);
        } else {
          // 体力不足 → 自然回复（不产出）
          e.energy = Math.min(100, (e.energy || 0) + (O.REST_ENERGY || 8));
        }
      }
      // 攻关倒计时
      if (s.focusBoost && s.focusBoost.roundsLeft > 0) {
        s.focusBoost.roundsLeft -= 1;
        if (s.focusBoost.roundsLeft <= 0) {
          log.focusEnd = s.focusBoost.dim;
          s.focusBoost = null;
        }
      }
      // 论文倒计时
      if (s.paperResearch && s.week >= s.paperResearch.startWeek + s.paperResearch.weeks) {
        const pid = this.paperNoOf(s.paperResearch.id);   // 旧档可能是字符串 id → 规整成 no
        if (!s.papersOwned) s.papersOwned = [];
        if (pid != null) s.papersOwned.push(pid);
        log.paperDone = pid;
        s.paperResearch = null;
        this.refreshPaperCandidates();
      }
      // 工资
      s.payrollDue = (s.payrollDue != null ? s.payrollDue : P.PERIOD_ROUNDS || 28) - 1;
      if (s.payrollDue <= 0) {
        s.payrollDue = P.PERIOD_ROUNDS || 28;
        log.payroll = this.doPayroll();
      }
    }
    log.week = s.week;
    return log;
  },

  /* V3.5.2 主循环推进：引擎 tick → 产出并入主状态 / 周结算 / 论文完成 / 工资
     说明：主状态 s[code/text/safety/stability] 由「引擎飘字 + 事件」共同累积，
     是评审判定的唯一数据源；引擎内部 stats 仅作生产演算，不回写覆盖。 */
  /* ---------------- 爆发状态（2026-09-04，模仿《游戏发展国》）----------------
     每个人（岗位槽）**独立**判定，不是全员：谁的体力攒够了，谁才可能爆。
     触发 = 扣一笔体力，换接下来 N 个 tick 该人的产出翻倍，头像带燃烧特效。
     状态存在 s.v35.burst（剩余 tick）/ s.v35.burstCd（冷却），按岗位槽存是因为
     v35 引擎的体力与产出都是按岗位槽记的（一人一岗，槽即人）。 */
  burstCfg() {
    const B = (this.cfg.V35 && this.cfg.V35.BURST) || {};
    return {
      enabled: B.ENABLED !== false,
      minEnergy: B.MIN_ENERGY != null ? B.MIN_ENERGY : 62,
      prob: B.PROB != null ? B.PROB : 0.1,
      cost: B.COST != null ? B.COST : 20,
      ticks: B.TICKS != null ? B.TICKS : 3,
      mul: B.MUL != null ? B.MUL : 2,
      cooldown: B.COOLDOWN != null ? B.COOLDOWN : 10,
      minWeek: B.MIN_WEEK != null ? B.MIN_WEEK : 1,
    };
  },
  /* 某岗位此刻是否在爆发中（UI 燃烧特效与产出倍率共用一个口径） */
  burstActive(role, eng) {
    const st = this.state && this.state.v35;
    if (!(st && st.burst && st.burst[role] > 0)) return false;
    const crew = this.teamRoleEngs(st, role);
    return eng ? crew.some((e) => e === eng || e.id === eng.id) : crew.length > 0;
  },
  /* ---------------- 离职 / 挖角风险（2026-09-04 重建）----------------
     忠诚删除后，离职得有新的依据——按用户拍板的两条：
     ① 长期低体力：某岗位连续 TICKS 个 tick 体力 < ENERGY → 该人想离职（V35_QUIT）
     ② 久未涨薪：某人连续 WEEKS 周没涨过薪 → 有概率被挖（V35_POACH）
     这里只负责**置风险标记**，弹哪个事件由事件池的 cond 决定；事件弹出后标记清掉。 */
  tickLeaveRisk() {
  /* [feature:last-engineer-tick-risk] */
    const c = this.cfg, s = this.state, st = s.v35;
    this.clearLonePoachRisk(s);
  /* [/feature:last-engineer-tick-risk] */
    if (!st || !st.energy) return;
    if (this.embodiedAvailable(s)) {
      st.leaveRisk = false; st.poachRisk = false;
      st.leaveWho = null; st.poachWho = null; st.riskWho = null;
      return;
    }
    const vc = c.V35 || {};
    const L = vc.LEAVE || {}, P = vc.POACH || {};
    st.lowE = st.lowE || { pre: 0, data: 0, post: 0, embodied: 0 };
    if (st.leaveRisk || st.poachRisk) return;        // 已有待弹的事件：先别叠新风险
    // ① 连续低体力
    for (const k of ["pre", "data", "post", "embodied"]) {
      const eng = s.engineers.find((e) => !e.resigned && this.v35RoleOf(e) === k
        && (e.joinTick == null || st.tick >= e.joinTick));
      if (!eng) { st.lowE[k] = 0; continue; }
      if ((st.energy[k] || 0) < (L.ENERGY != null ? L.ENERGY : 25)) st.lowE[k] = (st.lowE[k] || 0) + 1;
      else st.lowE[k] = 0;
      if (st.lowE[k] >= (L.TICKS != null ? L.TICKS : 12)
        && Math.random() < (L.PROB != null ? L.PROB : 0.5)) {
        st.leaveRisk = true;
        st.leaveWho = eng.id;
        break;
      }
    }
    // ② 久未涨薪 → 被挖（待入职不算：人都还没上岗，谈不上「很久没加薪」）
    //    挖角事件（V35_POACH）带 minVer 时，未到版本连风险标记都不置位——
    //    否则 poachRisk 恒 true 会堵住条件池，把离职风险事件也一起憋住（2026-09-06）。
  /* [feature:last-engineer-tick-poach] */
    if (!st.leaveRisk && this.activeEngineerCount(s) > 1) {
      const poachEv = this.evByKey("V35_POACH");
  /* [/feature:last-engineer-tick-poach] */
      const poachVerOk = !(poachEv && poachEv.minVer
        && (c.VER_ORDER || []).indexOf(poachEv.minVer) > (c.VER_ORDER || []).indexOf(s.ver || "V1"));
      if (poachVerOk) {
        for (const e of s.engineers) {
          if (e.resigned) continue;
          if (e.joinTick != null && st.tick < e.joinTick) continue;
          if ((e.weeksNoRaise || 0) < (P.WEEKS != null ? P.WEEKS : 4)) continue;
          if (Math.random() >= (P.PROB != null ? P.PROB : 0.35)) continue;
          st.poachRisk = true;
          st.poachWho = e.id;
          break;
        }
      }
    }
  },

  tickBurst() {
    const s = this.state, st = s.v35;
    const B = this.burstCfg();
    if (!B.enabled || !st || !st.energy) return [];
    /* 2026-09-05 用户反馈「下了班还会触发爆发」：下班窗口内不新增爆发，
       进行中的也立即熄灭（人都下班了，火焰没有道理还烧着）。
       判定与 v35_core.inOff / UI「已下班」状态同窗口（OFF_START ~ +OFF_LEN）。 */
    const tNow = st.tick || 0;
    const offS = this.cfg.V35.OFF_START != null ? this.cfg.V35.OFF_START : 18;
    const offL = this.cfg.V35.OFF_LEN != null ? this.cfg.V35.OFF_LEN : 3;
    if (tNow >= offS && tNow < offS + offL) {
      if (st.burst && (st.burst.pre > 0 || st.burst.data > 0 || st.burst.post > 0 || st.burst.embodied > 0)) {
        st.burst = { pre: 0, data: 0, post: 0, embodied: 0 };
      }
      return [];
    }
    st.burst = st.burst || { pre: 0, data: 0, post: 0, embodied: 0 };
    st.burstCd = st.burstCd || { pre: 0, data: 0, post: 0, embodied: 0 };
    const fired = [];
    for (const k of ["pre", "data", "post", "embodied"]) {
      if (st.burstCd[k] > 0) st.burstCd[k] -= 1;
      /* 休假/未到岗/已离职者不触发、不维持爆发，清理先于活动倒计时。 */
      const eng = this.teamRoleEngs(st, k)[0];
      if (!eng) { st.burst[k] = 0; continue; }
      if (st.burst[k] > 0) { st.burst[k] -= 1; continue; }
      if ((s.week || 0) < B.minWeek) continue;
      this.syncEnergySlot(k);
      if ((st.energy[k] || 0) < B.minEnergy) continue;
      if (st.burstCd[k] > 0) continue;
      if (Math.random() >= B.prob) continue;
      st.burst[k] = B.ticks;
      st.burstCd[k] = B.ticks + B.cooldown;
      /* 2026-09-22：扣的是**人**的体力（体力每人一份）——原来直接写共享槽，
         现在那只是派生的人均值，写了会被 tick 的 syncSlot 冲掉。 */
      this.addEnergyRole(k, -B.cost);
      fired.push({ role: k, name: eng.name });
    }
    return fired;
  },

  officeAdvanceV35(n) {
    const c = this.cfg, s = this.state;
    const v = c.V35, V = window.V35;
    const log = { rounds: n, weekUp: false, payroll: null, paperDone: null,
                  breakthrough: false, floats: [], weekly: null };
    const capAll = this.statCap();   // 2026-09-12：本阶段各维上限（tick 累计封顶用）
    for (let i = 0; i < n; i++) {
      /* ---- 自研路线「团队提案」（2026-09-13）----
         ⚠️ 必须放在下面 `!s.planDone` 的 continue **之前**：玩家要推进时间就得先立项，而立项要选
         架构 —— 自研架构正等着「批准」这一步。放到 continue 后面就变成
         「必须立项才能推进时间 / 立项又必须等提案」的鸡生蛋死锁。
         命中后 s.pendingEvent 会被占住 → 下面常规事件掷骰自动跳过（它本来就要求 !s.pendingEvent）。 */
      if (!log.event) {
        const propEv = this.pendingProposalEvent();
        /* ⚠️ 2026-09-29：**不再看 s.pendingEvent** —— 那是「引擎已投递」而不是「UI 已弹卡」。
           UI 的 showOfficeEvent 在已有别的卡片在屏上时会静默 return（如未作答的 pause:false
           「电费涨价」），这一次投递就丢了；此时 pendingEvent 已置位 → 旧写法永不重投 ⇒
           提案被卡没、自研架构拿不到。
           pendingProposalEvent() 内部已自带让路规则（被**别的**事件占住 → null；
           被**本提案自己**占住 → 放行），所以这里每帧重投是安全的：
           卡片真的在屏上时 UI 会自行去重，玩家一作答 approvedArchs 立刻为真 → 自动停投。 */
        if (propEv) {
          s.pendingEvent = { id: propEv.no };
          s._lastEvtTick = s.rounds;
          log.event = propEv;
        }
      }
      /* 训练周期结束后时间**不再停走**（2026-09-03 用户要求）：继续正常推进，
         评审随时可发起；周数超过 WEEKS 后语料需求曲线自然继续上涨。 */
      if (!s.planDone) continue;            // 未立项：引擎不动（与「待立项」引导一致）
      s.rounds = (s.rounds || 0) + 1;
      s.absRounds = (s.absRounds || 0) + 1;   // 绝对回合（跨阶段不清零，见 newState）
      /* V3.5.2 到岗：数据 W2 / 后训练 W4 自动入职（阈值式入职：tick≥JOIN_* 即入，
         防止存档/迁移导致 tick 跳号后永远对不上精确 tick 而不入职）。
         ⚠️ 2026-09-12：到岗此前**直接 push，绕过一切人数上限**——玩家把容量配成 2 也会变成 3 人。
         现在与录用同一条闸门（seatCap）：没名额就等下一个 tick（判定条件是「队里还没有他」，
         所以天然会重试，不会永久丢失）。容量配到低于 3 时开局会缺人 —— 那是配置本身的取舍，
         地图页已给出提示，不做静默兜底。 */
      const roomLeft = () => s.engineers.filter((e) => !e.resigned).length < this.seatCap();
      /* ⚠️ ID 化（2026-09-14）：模板用 engByKey("…") 认（代码里不写死编号）；
         「队里有没有他」比的是**实例的 no**（实例由 cloneEng 带上 no）。 */
      const dataTpl = this.engByKey("eng_v1b");
      const dataNo = dataTpl ? dataTpl.no : null;
/* [feature:embodied-recruit-stage-arrival-data] */
      if (dataTpl && (!Array.isArray(dataTpl.stage) || dataTpl.stage.indexOf(s.ver || "V1") >= 0)
          && this.hireStageEligible(dataTpl, s.ver) && s.v35.tick >= v.JOIN_DATA && !s.engineers.some((e) => e.no === dataNo)) {
/* [/feature:embodied-recruit-stage-arrival-data] */
        if (roomLeft()) {
          const eng = this.cloneEng(dataTpl);
          s.engineers.push(eng);
          this.assignSeat(eng.id);
          this.syncEnergySlot("data");
          log.arrive = log.arrive || [];
          log.arrive.push("📅 数据工程师 " + eng.name + " 到岗，语料产线开工");
        } else if (!s._seatFullWarned) {
          s._seatFullWarned = true;
          log.toast = "🚪 座位已满，到岗的新人还在门口等着——先辞退一人再让他们进来";
        }
      }
      const postTpl = this.engByKey("eng_v1c");
      const postNo = postTpl ? postTpl.no : null;
/* [feature:embodied-recruit-stage-arrival-post] */
      if (postTpl && (!Array.isArray(postTpl.stage) || postTpl.stage.indexOf(s.ver || "V1") >= 0)
          && this.hireStageEligible(postTpl, s.ver) && s.v35.tick >= v.JOIN_POST && !s.engineers.some((e) => e.no === postNo)) {
/* [/feature:embodied-recruit-stage-arrival-post] */
        if (roomLeft()) {
          const eng = this.cloneEng(postTpl);
          s.engineers.push(eng);
          this.assignSeat(eng.id);
          this.syncEnergySlot("post");
          log.arrive = log.arrive || [];
          log.arrive.push("📅 后训练工程师 " + eng.name + " 到岗");
        } else if (!s._seatFullWarned) {
          s._seatFullWarned = true;
          log.toast = "🚪 座位已满，到岗的新人还在门口等着——先辞退一人再让他们进来";
        }
      }
      /* 扩编寻访推进（提需求后倒计时到点 → 判定是否找到） */
      if (window.V35Hire) {
        const hr = window.V35Hire.tick(this);
        if (hr) log.hire = hr;
        /* 2026-09-05：找到候选人 → 走 OFFICE_HINTS 的 **hire_done 类型**（配置驱动，
           文案/立绘在「提示与新闻」页可改，与其它节点提示同一条通道）。
           支持变量 {name} / {role} / {tier}。每批找到候选人只弹一条，不走 hintsDone 永久去重。 */
        if (hr && hr.found) {
          // A recruitment batch is one update regardless of candidate count.
          const cds = (hr.cands && hr.cands.length) ? hr.cands : (hr.cand ? [hr.cand] : []);
          const cd = cds[0];
          if (cd) for (const h of (c.OFFICE_HINTS || [])) {
            if (h.type !== "hire_done") continue;
            if (h.ver && h.ver !== (s.ver || "V1")) continue;
            const txt = this.noticeTpl(String(h.text || "")
              .replace(/\{name\}/g, cd.name || "")
              .replace(/\{role\}/g, cd.label || cd.role || "")
              .replace(/\{tier\}/g, cd.tier || ""));
            (log.notices = log.notices || []).push({
              kind: "hint", group: h.type, tag: h.tag || "寻访有结果",
              text: txt, avatar: h.avatar || null,
            });
            break;
          }
        }
      }
      /* 语料产能开关 = 团队里是否真有已到岗的数据工程师（硬对齐实际队伍，杜绝"没到岗也在产"）。
         到岗 tick（joinTick）未到的数据工程师视为未入职，不开启语料产能。 */
  /* [feature:multi-trait-dev-core-008] */
      s.v35.preJoined = this.productionRoleEngs(s.v35, "pre", true).length > 0;
      s.v35.dataJoined = this.productionRoleEngs(s.v35, "data", true).length > 0;
  /* [/feature:multi-trait-dev-core-008] */
      /* 后训练产线开关（2026-09-13 补齐，与上面 dataJoined 完全同款）——
         修 BUG：引擎里 `joined.post` 原本写死 `tick >= JOIN_POST(18)`，而 tick **每阶段从 0 重跑**
         ⇒ 每个阶段前 3 周后训练整条线不产出（预训练却是恒在岗），后期越玩差距越大。
         改为硬对齐实际队伍：有已到岗的 post 工程师才开工。 */
  /* [feature:multi-trait-dev-core-009] */
      s.v35.postJoined = this.productionRoleEngs(s.v35, "post", true).length > 0;
  /* [/feature:multi-trait-dev-core-009] */
      /* ⚠️ 2026-09-13 修 BUG（同一条产线人数的第三个漏洞）：产出编制数与实体工程师**脱钩** ——
         `extraPre/Data/Post` 只在 `hire()` 里 `+= 1`，**辞退、离职都不减**
         ⇒「辞掉一半人，产出照旧按满编制算」。这里每 tick 按**实际在岗**人数重算。
         引擎按 `1 + extraX - restX` 数人，所以 extraX = 在岗人数 - 1；
         休息的人仍由 syncResting 写的 restX 扣，这里**不重复排除**（liveOf 不过滤 restWeek）。 */
  /* [feature:multi-trait-dev-core-010] */
      const liveOf = (role) => this.productionRoleEngs(s.v35, role, true).length;
  /* [/feature:multi-trait-dev-core-010] */
      /* 论文效果汇总（2026-09-13 实装）：引擎每 tick 从 st.paperFx 读，改配置立即生效 */
      s.v35.paperFx = this.paperEffects();
      s.v35.extraPre  = Math.max(0, liveOf("pre")  - 1);
      s.v35.extraData = Math.max(0, liveOf("data") - 1);
      s.v35.extraPost = Math.max(0, liveOf("post") - 1);
      s.v35.embodiedJoined = this.embodiedAvailable() && liveOf("embodied") > 0;
      s.v35.extraEmbodied = Math.max(0, liveOf("embodied") - 1);
      /* DOC「数据词条 → 语料品质」：每个数据工程师按**各自** data 词条等级决定自己产出的
         语料品质概率（不是全局固定）。写进 s.v35.dataTraitLvs（数组，与引擎 data 产出循环
         的 `1+extraData-restData` 下标对齐：每个进循环的 data 编制对应一个等级）。
         未到岗/本周休息的不计入；无 data 词条按 1 级。 */
      s.v35.dataTraitLvs = this.teamDataTraitLevels(s.v35);
  /* [feature:multi-trait-dev-core-011] */
      /* DOC「词条等级接入产出」：pre/post 标量仅供旧无头路径兜底，真人逐词条等级见下方数组。
         与 data 一样防止「休了还在产」——休息/未到岗的不计入（回落 1 档）。 */
  /* [/feature:multi-trait-dev-core-011] */
      s.v35.preTraitLv  = this.teamPreTraitLevel(s.v35);
      s.v35.postTraitLv = this.teamPostTraitLevel(s.v35);
      /* 爆发状态：在引擎 tick 之前结算，本 tick 触发的爆发立即作用于本次产出 */
      const burstFired = this.tickBurst();
      if (burstFired.length) log.bursts = (log.bursts || []).concat(burstFired);
      this.tickLeaveRisk();          // 离职 / 挖角风险（2026-09-04）
      this.syncResting();      // 本周安排休息的人下班 → 引擎按岗位减人（2026-09-08）
      /* 体力逐人注入（2026-09-22，用户要求「选谁谈心就只恢复谁的体力」）：
         把各岗位在岗工程师的体力做成**值数组**交给引擎，引擎按编制下标逐人衰减/回复、
         逐人判定体力门槛；tick 结束立即回写（见下面「体力回写」）。瞬时字段，不进存档。 */
      const _enOrder = {};
      s.v35.energyList = {};
  /* [feature:multi-trait-dev-core-012] */
      s.v35.energyOwnerList = {};
      s.v35.energyRoleById = {};
  /* [/feature:multi-trait-dev-core-012] */
      s.v35.productionMulList = {};         // 个人涨薪增产，与体力数组使用同一编制顺序
  /* [feature:multi-trait-dev-core-013] */
      s.v35.traitLevelList = {};            // 各生产词条按本人自己的等级读取
  /* [/feature:multi-trait-dev-core-013] */
      for (const _k of ["pre", "data", "post", "embodied"]) {
        if (s.v35.energy[_k] == null) continue;
  /* [feature:multi-trait-dev-core-014] */
        const _engs = this.productionRoleEngs(s.v35, _k);
  /* [/feature:multi-trait-dev-core-014] */
        /* 缺个人字段只补本人初始体力，不能从岗位均值回灌。已有个人值始终保留。 */
        for (const _e of _engs) this.ensureStatus(_e);
        _enOrder[_k] = _engs;
        s.v35.energyList[_k] = _engs.map((e) => (e.energy || 0));
        s.v35.productionMulList[_k] = _engs.map((e) => this.raiseProductionMul(e, Math.max(0, (s.absRounds || 0) - 1)));
  /* [feature:multi-trait-dev-core-015] */
        s.v35.traitLevelList[_k] = _engs.map((e) => this.productionTraitLevel(e, _k));
        s.v35.energyOwnerList[_k] = _engs.map((e) => e.id);
        for (const e of _engs) s.v35.energyRoleById[e.id] = this.v35RoleOf(e);
  /* [/feature:multi-trait-dev-core-015] */
      }
      const floats = V.tick(s.v35);
      if (this.embodiedAvailable()) s.embodiedTrainingTicks = Math.max(0, (s.embodiedTrainingTicks || 0)) + 1;
      /* 体力回写：引擎已按人结算完毕 → 写回 e.energy，岗位标量同步成人均值，然后删掉瞬时数组。
         ⚠️ 这里以前是把 e.energy **镜像成岗位标量**（同组所有人一个数）——那正是
         「对钟野谈心，林初晓体力也加了」的根因，别再改回去。 */
      if (s.v35.energyList) {
        for (const _k of ["pre", "data", "post", "embodied"]) {
          const _arr = s.v35.energyList[_k], _engs = _enOrder[_k];
          if (!_arr || !_engs) continue;
          for (let _i = 0; _i < _engs.length; _i++) {
            if (typeof _arr[_i] === "number") _engs[_i].energy = Math.round(_arr[_i]);
          }
          this.syncEnergySlot(_k); // 派生均值以实际回写的个人整数体力为准。
        }
        delete s.v35.energyList;
      }
      delete s.v35.productionMulList;
      delete s.v35.traitLevelList;
  /* [feature:multi-trait-dev-core-016] */
      delete s.v35.energyOwnerList;
      delete s.v35.energyRoleById;
  /* [/feature:multi-trait-dev-core-016] */
      for (const f of floats) {
  /* [feature:multi-trait-dev-core-017] */
        /* 固化本 tick 真正产出者；周界恢复休假或后续 tick 不再改变浮字归属。 */
        const producer = f.slot != null && _enOrder[f.who] ? _enOrder[f.who][f.slot] : null;
        if (producer) f.engId = producer.id;
  /* [/feature:multi-trait-dev-core-017] */
        /* 爆发中的岗位产出翻倍（2026-09-04）：只翻倍「人」的产出，
           论文（who:"paper"）那类附加产出不吃爆发加成，否则会白白放大永续效果。 */
        const bMul = this.burstActive(f.who) ? this.burstCfg().mul : 1;
        const fv = (bMul === 1) ? f : { ...f, amount: f.amount * bMul };
        log.floats.push(fv);
        /* 引擎产出并入主状态；四舍五入为整数——否则浮点累加会出现 33.29999999999999 这类长尾小数 */
        /* 2026-09-12（用户实测 119/103 破上限）：生产累计此前没有 cap——
           其它路径（收集/事件/小游戏奖励）都走 statCap 封顶，唯独这条 tick 主产线漏了 */
        if (fv.dim && s[fv.dim] != null) {
          const _cap = this.statLimit(fv.dim, capAll);
          s[fv.dim] = Math.min(_cap, Math.round((s[fv.dim] || 0) + fv.amount));
        }
        /* v35：产出计入对应岗位工程师的常驻「产出 N」徽标（旧路径 prodByEng 不填 v35） */
        if (fv.who && fv.who !== "paper" && fv.amount) {
  /* [feature:multi-trait-dev-core-018] */
          const engId = fv.engId != null ? fv.engId : this.v35EngIdOfRole(fv.who);
  /* [/feature:multi-trait-dev-core-018] */
          if (engId) {
            s.v35.prodAcc = s.v35.prodAcc || {};
            s.v35.prodAcc[engId] = (s.v35.prodAcc[engId] || 0) + fv.amount;
          }
        }
      }
      /* 攻关倒计时（2026-09-16 修「倒计时卡在 3 不动」：V35 重构时漏搬了旧分支
         officeAdvance 2387 的递减块 → roundsLeft 永远停在 FOCUS_TICKS(18)/6=3，
         且 2225 的产出加成判定读的就是 focusBoost → 加成还永不过期。双修。）
         ⚠️ s.v35.focus 是 V35 分支 startFocus 的闸门（3128「已经在攻关中」），
            到期必须一并清零，否则攻关结束后永远无法再次开攻关。 */
      if (s.focusBoost && s.focusBoost.roundsLeft > 0) {
        s.focusBoost.roundsLeft -= 1;
        if (s.focusBoost.roundsLeft <= 0) {
          s.focusBoost = null;
          s.v35.focus = { dim: null, left: 0 };
        }
      }
      /* 兜底：四维主状态恒为整数且不破上限（事件/其它加成都可能带小数；
         2026-09-12：夹 statCap——已破上限的旧存档在读档后的第一 tick 被拉回上限内） */
      for (const _k of this.dimsOf(s)) {
        if (s[_k] != null) {
          const _ck = this.statLimit(_k, capAll);
          s[_k] = Math.min(_ck, Math.round(s[_k]));
        }
      }
      s._lastFloats = floats;               // UI 飘字用（U11）
      if (s.v35.lvShift > 0 && !s.breakthroughSeen) { log.breakthrough = true; s.breakthroughSeen = true; }
      // 周推进：TICKS_PER_WEEK 个 tick = 1 周
      if (s.rounds % v.TICKS_PER_WEEK === 0) {
        /* 2026-09-09：训练周期结束后继续正常推进，周数不再封顶在 TOTAL_WEEKS——
           玩家可冲击上限，周数越高语料需求越难，自然形成天花板。 */
        s.week = (s.week || 0) + 1;
        log.weekUp = true;
        /* 2026-09-09：团建 / 聚餐改为「每周一次」——办公室流程不走 startWorkshop，
           过去 tbRound 从不重置（团建一次后永久锁死，玩家以为次数没了）。每周推进时刷新。 */
        /* 2026-09-12：聚餐改每 2 周一次（meetingWeek 存上次周号，不再每周清）；
           旅游（team）保持每周一次，照旧每周重置 */
        s.tbRound = { team: false, meetingWeek: (s.tbRound || {}).meetingWeek };
        /* 2026-09-04：每过一周，所有人「多久没涨薪」+1（挖角风险的计时器）。
           2026-09-05：待入职（joinTick 未到）不计——新人从到岗那周起算。 */
        for (const _e of s.engineers) {
          if (_e.resigned) continue;
          if (_e.joinTick != null && s.v35.tick < _e.joinTick) continue;
          _e.weeksNoRaise = (_e.weeksNoRaise || 0) + 1;
        }
        /* 上周安排休息的人：新的一周「上班」→ 恢复体力（2026-09-08 用户拍板） */
        const _restBack = this.restoreRested();
        if (_restBack.length) log.restBack = (log.restBack || []).concat(_restBack);
        /* 2026-09-06 反抽卡（doc/22 §7）：候选人超过有效期未录用 → 失效并进入冷却
           （2026-09-07 起扩编寻访找到的人也进 s.candidates，过期统一走这里） */
        /* 2026-09-07：调试开关——第 N 周直接触发一次破产（验收 V35_BAILOUT 兜底 /
           分红 / 二次破产 Game Over 全链路，「调试」模块可开）。
           只置一次信号（s._dbgBankruptDone），之后的判定走正常破产链路：
           首次 → 弹兜底事件；兜底已用过 → 真 Game Over。 */
        const DBG = c.DEBUG || {};
        if (DBG.FORCE_BANKRUPT && !s._dbgBankruptDone
            && s.week >= (DBG.FORCE_BANKRUPT_WEEK != null ? DBG.FORCE_BANKRUPT_WEEK : 2)) {
          s._dbgBankruptDone = true;
          s.funding = 0;
          s.fiscalDeficit = Math.max(1, this.payrollTotal() || 0);
          log.debugBankrupt = true;
        }
        const _gone = this.expireCandidates(s.week);
        if (_gone.length) log.candidatesExpired = _gone.map((x) => x.name || x.id);
        /* 2026-09-07 P2（doc/20 v2.2 §1.6）：recruit_offer 到期 → 慕名而来的人选履约，
           从共享池抽真实完整档案进「招聘」页候选列表（fromEvent 标记，genCandidates 保留），
           弹 hire_done 提示、「招聘」按钮徽标 +1；之后 TTL / 冷却锁照走，与普通候选人无异 */
        /* ⚠️ 2026-09-22：dueWeek 存的是**绝对周**（见 applyEffects），这里也必须用 absWeek()
           比 —— 原用 s.week，跨阶段归零后判定永不成立，挂单的人选一直不到岗。 */
        if (s.v35.eventOffer && this.absWeek() >= s.v35.eventOffer.dueWeek) {
          const offer = s.v35.eventOffer;
          s.v35.eventOffer = null;           // 先清单：抽不到人也别每周重试（事件自带冷却兜底）
          const tpl = (window.V35Hire && window.V35Hire.pickOfferCand)
            ? window.V35Hire.pickOfferCand(this, offer.tier) : null;
          if (tpl) {
            const cand = this.cloneEng(tpl);
            cand.fromEvent = true;
            cand.expireAbsWeek = this.absWeek() + (c.CANDIDATE_TTL_WEEKS || 2);
            s.candidates = s.candidates || [];
            if (!s.candidates.some((x) => x.id === cand.id)) s.candidates.push(cand);
            const stageHints = (c.OFFICE_HINTS || []).filter((h) => !h.ver || h.ver === (s.ver || "V1"));
            const hd = stageHints.find((h) => h.id === "H_EVENT_OFFER")
              || stageHints.find((h) => h.type === "hire_done");
            if (hd && !(log.notices || []).some(n => n.group === hd.type)) {
              const txt = this.noticeTpl(String(hd.text || "")
                .replace(/\{name\}/g, cand.name || "")
                .replace(/\{tier\}/g, this.tierLabel(cand)));
              (log.notices = log.notices || []).push({
                kind: "hint", group: hd.type, tag: hd.tag || "慕名而来", text: txt, avatar: hd.avatar || null,
              });
            }
            log.eventOffer = { name: cand.name, tier: this.tierLabel(cand) };
          }
        }
        log.weekly = s.v35.weekly[s.v35.weekly.length - 1] || null;
        /* 里程碑：二测开智（≥TEST.DUMB，2026-09-14 砍掉半吊子档后改挂两档线）→ 一次性 30 万（W5 结算） */
        if (s.week >= 5 && !s._milestonePaid && V.testTier({ver:s.ver,stats:s}).tier === "full") {
          this.payoutIncome(300000, { kind: "milestone" });
          s._milestonePaid = true; log.milestone = 300000;
        }
        /* 干劲十足（§11-F）：全员平均体力 ≥80 → 50% 触发，词条升级概率 ×1.5（阶段结算消费），耗体力 15 */
        const avgE = (s.v35.energy.pre + s.v35.energy.data + s.v35.energy.post) / 3;
        /* 仅当本阶段词条仍有升级空间（STAGE_TRAIT_MAX > 当前最高词条等级）才触发，否则纯亏体力 */
        const maxLv = (c.STAGE_TRAIT_MAX || {})[s.ver || "V1"] || 1;
        const canUp = (s.engineers || []).some((e) => !e.resigned && (e.traits || []).some((t) => (t.level || 1) < maxLv));
        if (avgE >= 80 && canUp && !s.traitProbBoost && !s._vigourUsed && Math.random() < 0.5) {
          s.traitProbBoost = true; s._vigourUsed = true;
          /* 2026-09-22：体力「每人一份」后，扣的必须是**人**的体力 —— 原来直接写
             s.v35.energy[role] 是共享槽时代的写法，现在那只是派生的人均值，
             写了会被 tick 的 syncSlot 立刻冲掉（等于白扣）。 */
          this.addEnergyAll(-15);
          log.vigour = true;
        }
        /* 周节拍提示统一由 OFFICE_HINTS 配置，避免另一套未限定阶段的初期引导跨阶段重播。 */
        /* ---- 节点提示（2026-09-03）：week / corpus_shortage / fund_low 三类在周结算检查 ---- */
        s.hintsDone = s.hintsDone || {};
        for (const h of (c.OFFICE_HINTS || [])) {
          /* 2026-09-12：可选 ver 字段 —— 配了就只在该阶段生效（所有类型通用）。
             「进入某个阶段才该说的话」（例如 V3 正式上线）靠它表达。 */
          if (h.ver && h.ver !== (s.ver || "V1")) continue;
          if (h.type === "payday") continue;                 // payday 在逐 tick 检查（见下）
          let hit = false;
          /* 2026-09-12 新增 stage_enter：**进入该阶段时**弹一次（默认该阶段第 1 周，可配 week 覆盖）。
             与 week 的区别：week 只看周数（任何阶段的第 N 周都会命中，靠 freq 去重），
             stage_enter 天然带阶段语义，配合 ver 用。 */
          if (h.type === "stage_enter" && s.week === (h.week != null ? h.week : 1)) hit = true;
          else if (h.type === "week" && s.week === h.week) hit = true;
          else if (h.type === "review_ready" && this.canReview()) hit = true;
          /* 2026-09-05：语料提示与看板档位同口径（gapState 流量口径）——
             旧条件 token < corpusDemand 是「库存 vs 累计水位」，看板却是另一套 → 永远对不上 */
          else if (h.type === "corpus_shortage" && s.v35.gapState && s.v35.gapState !== "ok") hit = true;
          else if (h.type === "fund_low" && (s.funding || 0) < this.payrollTotal()) hit = true;
          /* 2026-09-10 doc/27 P4：追加能力轴里程碑 ——
             门槛线取「本阶段任务的 axisMin」，没配就取该轴 passByVer；
             只有本阶段**真的激活了这根轴**才可能触发（没轴零痕迹）。 */
          else if (h.type === "axis_milestone") {
            const axIds = window.V35.activeAxes(s);
            if (h.axis && axIds.indexOf(h.axis) >= 0) {
              /* 2026-09-24：线与评审同尺 —— 乘 lineScale（参数档偏离钉死组合时轴上限已在
                 axisCap 缩过，线不缩的话里程碑会永远差一截）。 */
              const _msc = window.V35.lineScale ? window.V35.lineScale(s.ver || "V1", s.paramTarget) : 1;
              const need = ((this.missionOf(s.ver) || {}).axisMin || {})[h.axis];
              const line = Math.round((need != null ? need : (window.V35.axisPass(s.ver, h.axis) || 0)) * _msc);
              const mark = (h.pct != null ? h.pct : 0.5) * line;
              if (line > 0 && (s[h.axis] || 0) >= mark) hit = true;
            }
          }
          /* 触发频率（2026-09-08 用户要求，「新闻与提示」页可配）：
               game   = 整局只弹一次（默认；一次性引导类，如「数据工程师本周到岗」）
               stage  = 每阶段最多一次（如发薪预警）
               always = 每次满足条件都弹
             兼容旧配置：没有 freq 时，once === false → always，否则 → game。 */
          const freq = h.freq || (h.once === false ? "always" : "game");
          const doneKey = freq === "always" ? null
            : (freq === "stage" ? (h.id + "@" + (s.ver || "V1")) : h.id);
          if (hit && (!doneKey || !s.hintsDone[doneKey])) {
            if (doneKey) s.hintsDone[doneKey] = true;
            /* {axis} 必须先替换再走 noticeTpl —— noticeTpl 会把 {name} 换成随机在职工程师，
               轴名不能被它吞掉（顺序反了就会弹出一句带随机人名的怪文案）。 */
            const hTxt = h.axis ? String(h.text || "").replace(/\{axis\}/g, this.statLabel(h.axis)) : h.text;
            (log.notices = log.notices || []).push({ kind: "hint", tag: "节点提示", text: this.noticeTpl(hTxt), avatar: h.avatar || null });
          }
        }
        /* ---- 时事新闻（2026-09-03 二改）：不再弹顶部卡片打断玩家，统一进
           「鲸华社」新闻页信息流（s.newsFeed），未读数挂左列「吃瓜」按钮 badge。
           节点提示（hints）仍走顶部小卡片。 ---- */
        s.newsFeed = s.newsFeed || [];
        s.newsTimelineDone = s.newsTimelineDone || {};
        const pushFeed = (id, title, text, src, date, img, imgAlt) =>
          this.pushNews({ id, title, text, src, date, img, imgAlt });
        const tl = this.calendarNewsAtCurrentWeek();
        if (tl.length) {
          for (const n of tl) {
            s.newsTimelineDone[n.id] = true;
            pushFeed(n.id, n.title, this.fillWhaleText(this.noticeTpl(n.desc)), n.src, n.date, n.img, n.imgAlt);
          }
        } else if (Math.random() < (c.NEWS_PAGE && c.NEWS_PAGE.NEW_EVERY_MIN
          ? Math.min(1, 1 / Math.max(1, c.NEWS_PAGE.NEW_EVERY_MIN)) : 0.5)) {
          /* 随机新闻：平均每 NEW_EVERY_MIN 分钟一条（1 分钟 = 1 周，每周掷一次骰）；
             默认 3 分钟/条。剧情节点新闻（NEWS_TIMELINE）不受此概率限制。 */
          const rn = this.rollNews();
          if (rn) pushFeed(rn.id, rn.title, this.noticeTpl(rn.desc), rn.src, null, rn.img, rn.imgAlt);
        }
        /* V3.5.2 事件：每 EVENT_EVERY tick 掷一次（EVENT_PROB）；
           2026-09-03 分层：条件池（type:"cond" / 带 cond，如全员体力过低）优先，随机池兜底；
           cooldown 单位 = 周，命中过的事件在冷却期内不重复出。
           2026-09-07（doc/20 v2.2 P1）：① EVENTS_FROM_VER 总闸——版本序低于该值（V1 教学期）
           整个掷骰块静默，零事件打扰；② stages 白名单——事件可限定只在某几个阶段出现，
           不写 = 通用（EVENTS_FROM_VER 只管掷骰块，拦不住 E101 这类被其它系统主动触发的事件）。 */
        const _verGate = !v.EVENTS_FROM_VER
          || (c.VER_ORDER || []).indexOf(s.ver || "V1") >= (c.VER_ORDER || []).indexOf(v.EVENTS_FROM_VER);
        /* [feature:staff-raise-weekly-offer] */
        if (_verGate && !log.event && window.StaffRaiseEvents) {
          const salaryEv = window.StaffRaiseEvents.offer(this);
          if (salaryEv) log.event = salaryEv;
        }
        /* [/feature:staff-raise-weekly-offer] */
        if (_verGate
            && s.week >= 2 && !s.pendingEvent
            && s.rounds - (s._lastEvtTick || 0) >= (v.EVENT_EVERY || 9)
            && Math.random() < (v.EVENT_PROB != null ? v.EVENT_PROB : 0.7)) {
          /* ⚠️ 2026-09-13：原来靠 id 的 "V35_" 前缀 认「这是掷骰池事件」——
             id 编号化后前缀没了，改成**显式字段** pool !== false（默认在池；配置可逐条关掉）。 */
  /* [feature:last-engineer-office-pool] */
          const all = (c.EVENTS || []).filter((e) => this.eventEligibleForStage(e, s)
            && !this.poachEventBlocked(e, s) && e.pool !== false
  /* [/feature:last-engineer-office-pool] */
            && e.enabled !== false
            /* B6（2026-09-06）：special 事件（破产兜底 V35_BAILOUT 等）只由专门路径触发，
               永不进常规池 —— 以前没排掉，账上有几百万也会弹出「母公司董事来了」。 */
            && !e.special
            /* stages 白名单（2026-09-07）：事件限定阶段；不写 = 通用 */
            && !(Array.isArray(e.stages) && e.stages.length && !e.stages.includes(s.ver || "V1"))
            /* minVer：起效版本（VER_ORDER 顺序比较）——兼容字段，新事件请用 stages */
            && !(e.minVer && (c.VER_ORDER || []).indexOf(e.minVer) > (c.VER_ORDER || []).indexOf(s.ver || "V1"))
            /* 2026-09-07 P3：兜底套利冷却——拿过 200 万救命钱后的 8 周内，
               注资类事件（inject:true，如 VC_TERM / INV_FOLLOW / INVESTOR_WHISPER）不触发
               （否则「故意破产吃 10%×3 → 立刻用 5%×4 覆盖」= 白拿 500 万还降费率）
               ⚠️ 2026-09-22：改用绝对周 absWeek() —— 原用 s.week，进新阶段归零后
               这个"8 周冷却"会被无限拉长（同聚餐那类 BUG）。
               ⚠️ 2026-10-02：inject 事件的三道门（套利冷却 / 分红结清 / **不缺钱不触发**）
               收敛为唯一实现 `injectPoolBlocked(s, e)` —— 逐条注释见方法体，
               test_p3capital ④b/④c 与引擎共用同一把尺。 */
            && !(e.inject && this.injectPoolBlocked(s, e)));
          s._evtLastAt = s._evtLastAt || {};
          s._evtOnce = s._evtOnce || {};
          /* B8（2026-09-06）：真正的「一次性」—— once 记在 s._evtOnce 里，
             **跨阶段保留**（与 cooldown 不同：cooldown 是按 rounds 算的，跨阶段会失效）。
             ⚠️ 以前没有这个字段，只能用超大 cooldown 假装一次性，而 rounds 每阶段归零 →
             冷却判定永远不成立 → 该事件反而被永久锁死（B1）。 */
          const cdOk = (ev) => {
            if (ev.once && s._evtOnce[ev.no]) return false;
            if (ev.cooldownGroup && s._evtGroupLastAt
                && s._evtGroupLastAt[ev.cooldownGroup] != null
                && (s.absRounds || 0) - s._evtGroupLastAt[ev.cooldownGroup]
                  < (ev.cooldown || 4) * (v.TICKS_PER_WEEK || 6)) return false;
            return !ev.cooldown || !s._evtLastAt[ev.no]
              || s.rounds - s._evtLastAt[ev.no] >= ev.cooldown * (v.TICKS_PER_WEEK || 6);
          };
          const condOk = (cond) => !cond || (
            (cond.avg_energy_below == null || avgE < cond.avg_energy_below)
            && (cond.avg_energy_above == null || avgE > cond.avg_energy_above)
            && (cond.funding_below == null || (s.funding || 0) < cond.funding_below)
            && (cond.funding_above == null || (s.funding || 0) > cond.funding_above)
            && (cond.corpus_below == null || s.v35.corpus.token < cond.corpus_below)
            /* 2026-09-04：离职 / 挖角风险（由 tickLeaveRisk 置位，弹过就清） */
            && (cond.quit_risk == null || !!s.v35.leaveRisk)
            && (cond.poach_risk == null || !!s.v35.poachRisk)
            /* 2026-09-07 P2（doc/20 v2.2 §1.5）：品牌 / 立项参数 / 编制 / 算力档 / 语料盈余 / 投资旗标 */
            && (cond.brand_above == null || (s.brand || 0) > cond.brand_above)
            && (cond.brand_below == null || (s.brand || 0) < cond.brand_below)
            && (cond.param_at_least == null || (s.paramTarget || 0) >= cond.param_at_least)
            && (cond.staff_at_least == null
              || s.engineers.filter((e) => !e.resigned).length >= cond.staff_at_least)
            && (cond.gpu_below == null || (c.GPU_TIER_ORDER || Object.keys(c.GPU_TIERS || {}))
              .indexOf(s.gpuTier || "basic") < cond.gpu_below)
            && (cond.corpus_above_ratio == null || s.v35.corpus.token
              > (((v.STAGES || {})[s.ver || "V1"] || {}).GATE
                || ((c.V35.CORPUS_CURVE || {}).GATE) || 0) * cond.corpus_above_ratio)
            && (cond.investor == null || !!s.investor === !!cond.investor));
          /* ---- 缺钱权重（2026-09-30 用户要求：投资人事件「越缺钱越容易触发」，目标 ≥50%）----
             事件可写 `poor: { months, max }`：经费低于「months 个月工资」时按
             `months×月薪 ÷ 经费` **连续**放大池内权重（上限 max）。两条效果叠加：
               ① 池内加权抽取（不再是均匀随机）→ 越缺钱占比越高；
               ② 加成生效（权重 > 1）时**额外获得条件池资格**（COND_PRIORITY 0.6 的 60% 优先权），
                  但仍保留随机池资格 ⇒ 缺钱时概率从 ~3% 抬到 50%+，有钱时几乎不变。
             ⚠️ 用「几个月工资」而不是绝对金额 —— 后期经费量级是前期的十几倍，
                绝对阈值在 V3 之后永远不成立（同破产预警的口径）。 */
          const poorMul = (e) => {
            const p = e && e.poor;
            if (!p) return 1;
            const pay = this.monthlyPayroll() || 0;
            if (!(pay > 0)) return 1;
            const f = Math.max(1, s.funding || 0);
            const ref = pay * (p.months != null ? p.months : 3);
            if (f >= ref) return 1;
            const max = p.max != null ? p.max : 12;
            return Math.max(1, Math.min(max, ref / f));
          };
          const wt = (e) => Math.max(0, e.weight != null ? e.weight : 1) * poorMul(e);
          /* 池内加权抽取（权重全为 0 时退回均匀随机，保证不会「抽不出事件」） */
          const pickW = (arr) => {
            const ws = arr.map(wt);
            const tot = ws.reduce((a, b) => a + b, 0);
            if (!(tot > 0)) return arr[Math.floor(Math.random() * arr.length)];
            let r = Math.random() * tot;
            for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
            return arr[arr.length - 1];
          };
          const conds = all.filter((e) => (e.type === "cond" || e.cond) && cdOk(e) && condOk(e.cond));
          const rands = all.filter((e) => e.type !== "cond" && !e.cond && cdOk(e));
          /* 软条件：`poor` 加成生效的事件追加进条件池（仍在随机池里） */
          all.forEach((e) => {
            if (e.poor && poorMul(e) > 1 && cdOk(e) && rands.indexOf(e) >= 0 && conds.indexOf(e) < 0) conds.push(e);
          });
          /* B5（2026-09-06）：旧写法 `conds.length ? conds : rands` 是「条件池绝对优先」，
             只要条件池非空，随机池就永远抽不到 —— 实测 V2 典型场景随机池 0.00 次/阶段，
             20 条随机事件从未触发过。
             新规则：硬优先（离职/挖角/小模型完成，这类错过就有后果）必走条件池；
             否则掷 COND_PRIORITY 决定给谁；一侧为空就取另一侧。 */
          const hard = conds.filter((e) => e.cond
            && (e.cond.quit_risk != null || e.cond.poach_risk != null || e.cond.mini_done != null));
          let pool;
          if (hard.length) pool = hard;
          else if (conds.length && rands.length) {
            pool = Math.random() < (v.COND_PRIORITY != null ? v.COND_PRIORITY : 0.6) ? conds : rands;
          } else pool = conds.length ? conds : rands;
          if (pool.length) {
            /* 2026-09-30：池内由「均匀随机」改为「按 weight × 缺钱加成」加权抽取 */
            const ev = pickW(pool);
            s.pendingEvent = { id: ev.no };
            s._lastEvtTick = s.rounds;
            s._evtLastAt[ev.no] = s.rounds;
            if (ev.cooldownGroup) {
              s._evtGroupLastAt = s._evtGroupLastAt || {};
              s._evtGroupLastAt[ev.cooldownGroup] = s.absRounds || 0;
            }
            if (ev.once) s._evtOnce[ev.no] = true;
            /* 风险类事件弹过一次就把标记清掉，否则会一直排在条件池最前面反复弹 */
            if (ev.cond && ev.cond.quit_risk) {
              s.v35.leaveRisk = false;
              s.v35.lowE = { pre: 0, data: 0, post: 0, embodied: 0 };
              s.v35.riskWho = s.v35.leaveWho;      // 交给事件去定位目标人（弹完再清）
            }
            if (ev.cond && ev.cond.poach_risk) { s.v35.poachRisk = false; s.v35.riskWho = s.v35.poachWho; }
            /* 2026-09-05：解析目标人随事件带给 UI（文案 {name} 占位符）——
               风险事件 = 触发风险的那一位；带 pick 的事件走 pickEventTarget；
               弹完清 riskWho（此前只写不清，残留会把下一个无关事件也锁到同一个人） */
            let evTarget = null;
            if (s.v35.riskWho) {
              evTarget = s.engineers.find((e) => !e.resigned && e.id === s.v35.riskWho) || null;
            } else if (ev.pick) {
              evTarget = this.pickEventTarget(ev, s.engineers.filter((e) => !e.resigned
                && (e.joinTick == null || s.v35.tick >= e.joinTick)));
            }
            s.v35.riskWho = null;
            /* 2026-09-16 修 BUG（「说的是 a、走的却是 b」）：targetId 必须随事件入队——
               此前 targetName 只写进 log.event（UI 展示用），applyEventOption 却从
               s.pending 找 targetId，办公室事件根本不在 s.pending 里 → _evTarget 永远
               null → tgt() 兜底「在编第一个」→ 弹窗指名 a、离职/加状态的却是 b。 */
            if (evTarget) s.pendingEvent.targetId = evTarget.id;
            log.event = evTarget ? Object.assign({}, ev, { targetName: evTarget.name }) : ev;
          }
        }
      }
      // 展示同步：语料（有效 token）
      // ⚠️ 2026-09-22：这里原有一句「各工程师体力（引擎为准）」把 e.energy 镜像成岗位标量，
      //    体力改「每人一份」后已删除 —— 逐人结算由 tick 后的回写负责，再镜像一次会覆盖掉个人差异。
      s.corpus = Math.round(s.v35.corpus.token * 10) / 10;
      // 训练周期结束后不再停走（2026-09-03 用户要求），时间继续推进、评审随时可发起
      // 论文研究完成 → 并入已掌握
      if (s.paperResearch && s.v35.paper.done) {
        const pid = this.paperNoOf(s.paperResearch.id);   // 旧档可能是字符串 id → 规整成 no
        if (!s.papersOwned) s.papersOwned = [];
        // 论文研读完成 → 若对应架构可解锁，记录用于 UI 播放提示
        log.paperUnlocked = (c.ARCHITECTURES || [])
          .filter((a) => this.paperNoOf(a.unlockPaper) === pid && this.archUnlock(a).ok).map((a) => a.name);
        s.papersOwned.push(pid);
        log.paperDone = pid;
        s.paperResearch = null;
        this.refreshPaperCandidates();
      }
      // 工资：4 周 = 1 个月薪周期（6 tick/周 → 24 tick）
      const period = v.TICKS_PER_WEEK * 4;
      s.payrollDue = (s.payrollDue != null ? s.payrollDue : period) - 1;
      if (s.payrollDue <= 0) { s.payrollDue = period; log.payroll = this.doPayroll(); }
      /* 节点提示：发工资提前 N tick 提醒（每个工资周期一次，发薪后由 doPayroll 重置） */
      for (const h of (c.OFFICE_HINTS || [])) {
        if (h.type !== "payday") continue;
        if (h.ver && h.ver !== (s.ver || "V1")) continue;
        const before = h.ticksBefore != null ? h.ticksBefore : 6;
        if (s.payrollDue === before && !s._hintPayday) {
          s._hintPayday = true;
          (log.notices = log.notices || []).push({ kind: "hint", tag: "节点提示", text: h.text, avatar: h.avatar || null });
        }
      }
      /* 破产预警（2026-09-29 用户要求）：每月发薪后按「剩余经费 ÷ 月工资」判两级。
         放在破产判定之前 —— 欠薪中 bankruptWarn() 自己会返回 null，不会和兜底卡抢。 */
      const bw = this.bankruptWarn();
      if (bw) log.bankruptWarn = bw;
      /* V3.5.2 破产判定：欠薪未清（首次免责已用）= 资不抵债 → 唯一真失败
         2026-09-07 P3（doc/20 v2.2 §7.2）：**首次**破产先弹 V35_BAILOUT 特殊事件拦截
         （老客户预付 + 母公司担保 → 200 万 + 三笔 10% 分红；拒绝 = Game Over），
         第二次破产（s.bailoutUsed）才有真失败。
         ⚠️ 拦截时把 fiscalDeficit 清零、funding 夹到 0，否则每 tick 都会重复弹卡。 */
      if (s.fiscalDeficit > 0 || s.funding < 0) {
        const rescue = this.cfg.BAILOUT;
        const bailoutEv = this.evByKey((rescue.EVENT_BY_VER || {})[s.ver] || rescue.DEFAULT_EVENT);
        const bailoutEffect = bailoutEv && (bailoutEv.options || []).find(o => o.effects && o.effects.bailout);
        const usedFlag = bailoutEffect && typeof bailoutEffect.effects.bailout === "string" ? bailoutEffect.effects.bailout : rescue.DEFAULT_USED_FLAG;
        if (bailoutEv && !s[usedFlag]) {
          /* ⚠️ UI（game_ui 的 tick 回调）只看 **log.event** 才弹事件卡；s.pendingEvent
             在全项目没有任何读取方 —— 只写它等于死写，玩家点了作弊器也看不到兜底事件。 */
          s.pendingEvent = { id: bailoutEv.no };
          if (bailoutEv) log.event = bailoutEv;
          s.fiscalDeficit = 0;
          s.funding = Math.max(0, s.funding || 0);
          log.bailout = true;
          break;
        }
        s.flags = s.flags || {};
        s.flags.bankrupt = true;
        s.bankrupt = true;
        s.phase = 'over';
        log.bankrupt = 'over';
        break;
      }
    }
    log.week = s.week;
    return log;
  },

  /* 优质加成秒数（2026-09-12 用户定稿）：立项配比里优质格数 × PREMIUM_TICK_BONUS（秒/格）。
     优质数据 = 超额奖励：按配比选定的优质占比缩短产出周期（10s → 9s/档，全选优质最高 -5s）。
     qualityMix 为空（老档/未立项）→ 0；配置填 0 = 整体关闭。 */
  qualityPremiumS() {
    const s = this.state, st = s && s.v35;
    if (!st || !st.qualityMix) return 0;
    const per = (this.cfg.V35 && this.cfg.V35.PREMIUM_TICK_BONUS != null)
      ? this.cfg.V35.PREMIUM_TICK_BONUS : 1;
    if (!(per > 0)) return 0;
    const cells = Math.max(0, Math.min(5, Math.round(st.qualityMix.p || 0)));
    return cells * per;
  },

  /* 体力消耗倍率（FlashAttention 类论文会减少消耗） */
  energyCostMul() {
    const c = this.cfg, s = this.state;
    let mul = 1;
    for (const pid of s.papersOwned || []) {
      const p = this.paperOf(pid);
      if (p && p.effect && p.effect.kind === "energy") mul *= p.effect.mul;
    }
    return mul;
  },

  /* 收集一个员工的产出 → 转模型数值（暴击 / 连收加成） */
  collect(engId) {
    const c = this.cfg, s = this.state;
    if (this.v35On()) return { ok: false, tip: "全自动产出，无需收集" };
    const O = c.OFFICE || {};
    const e = s.engineers.find((x) => x.id === engId && !x.resigned);
    if (!e) return { ok: false, tip: "找不到这位工程师" };
    const raw = (s.prodByEng[engId]) || 0;
    if (raw <= 0) return { ok: false, tip: "还没有可收的产出" };
    // 连收计数（连续收集不同的人）
    s._comboCount = (s._comboCount || 0) + 1;
    const combo = s._comboCount >= (O.COLLECT_COMBO_AT || 3);
    const crit = Math.random() < (O.CRIT_CHANCE || 0.05);
    let val = raw * (crit ? (O.CRIT_MUL || 2) : 1) * (combo ? (O.COLLECT_COMBO_MUL || 1.15) : 1);
    val = Math.round(val);
    // 分配到维度（主维度为主，少量分给其余）
    const dim = this.mainDimOf(e);
    const cap = this.statCap();
    const inc = this.newDims(0, s);
    inc[dim] = Math.max(1, Math.round(val * 0.7));
    for (const k of this.baseDims()) {
      if (k === dim) continue;
      inc[k] = Math.max(0, Math.round(val * 0.1));
    }
    for (const k of Object.keys(inc)) {
      const before = s[k];
      s[k] = Math.min(this.statLimit(k, cap), Math.max(0, s[k] + inc[k]));
      inc[k] = s[k] - before;
    }
    // 清空产出槽
    s.prodByEng[engId] = 0;
    s.prodFullByEng[engId] = false;
    return {
      ok: true, name: e.name, dim, dimName: this.statLabel(dim),
      raw: Math.round(raw * 10) / 10, value: val, inc, crit, combo,
      left: this.totalProd(),
    };
  },

  /* 一键全部收集（按产出从多到少依次收，连收加成生效） */
  collectAll() {
    const s = this.state;
    const alive = s.engineers.filter((e) => !e.resigned)
      .sort((a, b) => ((s.prodByEng[b.id]) || 0) - ((s.prodByEng[a.id]) || 0));
    const results = [];
    s._comboCount = 0;
    for (const e of alive) {
      const r = this.collect(e.id);
      if (r.ok) results.push(r);
    }
    s._comboCount = 0;
    return { ok: results.length > 0, results, total: results.reduce((a, r) => a + r.value, 0) };
  },

  /* 待收集产出总和（向下取整显示） */
  totalProd() {
    const s = this.state;
    const sum = Object.values(s.prodByEng || {}).reduce((a, v) => a + (v || 0), 0);
    return Math.floor(sum);
  },

  /* 周结算：把没收集完的产出统一结算（效率折扣） */
  settleIdleProd() {
    const c = this.cfg, s = this.state;
    if (this.v35On()) return { ok: false, total: 0 };   // 全自动产出：无闲置结算
    const O = c.OFFICE || {};
    const mul = O.IDLE_SETTLE_MUL != null ? O.IDLE_SETTLE_MUL : 0.7;
    const cap = this.statCap();
    let total = 0;
    for (const e of s.engineers.filter((x) => !x.resigned)) {
      const raw = (s.prodByEng[e.id]) || 0;
      if (raw <= 0) continue;
      const dim = this.mainDimOf(e);
      const val = Math.max(1, Math.round(raw * mul));
      const before = s[dim];
      s[dim] = Math.min(this.statLimit(dim, cap), Math.max(0, s[dim] + val));
      total += s[dim] - before;
      s.prodByEng[e.id] = 0;
      s.prodFullByEng[e.id] = false;
    }
    return { ok: total > 0, total, mul };
  },

  /* ---------------- 攻关（选方向 → N 周产出提升）---------------- */
  startFocus(dim) {
    const c = this.cfg, s = this.state;
    const F = c.FOCUS || {};
    const combined = dim === "codeText" || dim === "safetyStability";
    if (combined && !this.embodiedAvailable()) return { ok: false, tip: "合并能力攻关在具身智能时代开放" };
    if (!combined && this.dimsOf(s).indexOf(dim) < 0) return { ok: false, tip: "本模型尚未激活这个能力方向" };
    if (this.v35On()) {
      const v = c.V35;
      if (!s.planDone) return { ok: false, tip: "先立项，再谈攻关" };
      /* 2026-09-03：攻关不再要求「一测失败」解锁，也不与后训练入职(J0IN_POST)绑定——
         立项后即开放，只受下方「语料门槛 + 经费」约束（2026-09-02 改版，只卡一条线）。 */
      if (s.v35.focus.left > 0) return { ok: false, tip: "已经在攻关中了" };
      /* 2026-09-02 改版：条件只剩「语料门槛」一条线（不分方向）+ 一笔经费。
         FOCUS_GATES 是旧设计的分方向门槛，仅在没有新键时兜底，避免旧配置直接放行。 */
      /* 2026-09-12（用户要求）：攻关语料门槛**动态化** =
         当前「架构 × 参数」组合的立项语料门槛 × FOCUS_GATE_MUL（默认 1.3，配置可改）。
         没有组合门槛（理论上不会，立项后必有）时回落静态 FOCUS_CORPUS_GATE。 */
      const comboGate = this.archGate(s.arch, s.paramTarget);
      const gate = comboGate != null
        ? Math.round(comboGate * (v.FOCUS_GATE_MUL != null ? v.FOCUS_GATE_MUL : 1.3))
        : (v.FOCUS_CORPUS_GATE != null ? v.FOCUS_CORPUS_GATE : ((v.FOCUS_GATES || {})[dim]));
      if (gate != null && s.v35.corpus.token < gate) {
        return { ok: false, tip: `语料不足：需有效 token ≥ ${gate}（当前 ${Math.floor(s.v35.corpus.token)}）` };
      }
      const cost = v.FOCUS_COST != null ? v.FOCUS_COST : (F.COST || 200000);
      if ((s.funding || 0) < cost) return { ok: false, tip: `经费不够（需要 ${Math.round(cost / 10000)} 万）` };
      s.funding -= cost;
      s.v35.focus = { dim, left: v.FOCUS_TICKS };
      s.v35.focusEverUsed = true;
      s.focusBoost = { dim, mul: v.FOCUS_MUL, roundsLeft: v.FOCUS_TICKS };   // 供 UI 显示
      return { ok: true, dim, cost, weeks: v.FOCUS_TICKS / v.TICKS_PER_WEEK };
    }
    if (!s.planDone) return { ok: false, tip: "先立项，再谈攻关" };
    if (s.focusBoost) return { ok: false, tip: "已经在攻关中了" };
    const cost = F.COST || 200000;
    if ((s.funding || 0) < cost) return { ok: false, tip: `经费不够（需要 ${Math.round(cost / 10000)} 万）` };
    s.funding -= cost;
    s.focusBoost = { dim, mul: F.MUL || 1.5, roundsLeft: (F.WEEKS || 4) * ((c.OFFICE && c.OFFICE.ROUNDS_PER_WEEK) || 7) };
    return { ok: true, dim, cost, weeks: F.WEEKS || 4 };
  },

  /* ---------------- 论文研究 ---------------- */
  /* 「当前阶段该读的论文」唯一口径（三个调用点共用：refresh 两条分支 + 读档自愈）：
       = 阶段配置论文（CANDIDATES_BY_VER[ver]）
       + 架构钥匙论文（门槛 = 「**下一阶段**就要解锁」→ `_vi + 1`，见下）
     已研读 / 在研的一律排除；返回去重后的 id 列表（顺序 = 阶段论文在前、钥匙论文在后）。 */
  stagePapersNeeded() {
    const c = this.cfg, s = this.state;
    const out = [];
    /* 一律以「数字 no」入列：旧档 / 老配置里可能是字符串 id（见 paperNoOf） */
    const want = (id) => {
      const no = this.paperNoOf(id);
      if (no == null) return;
      if (this.hasPaper(no)) return;
      if (s.paperResearch && this.paperNoOf(s.paperResearch.id) === no) return;
      if (out.indexOf(no) < 0) out.push(no);
    };
    const byVer = ((c.PAPER && c.PAPER.CANDIDATES_BY_VER) || {})[s.ver || "V1"];
    if (byVer) byVer.forEach(want);
    /* 防死锁兜底（2026-09-07 doc/25）：架构钥匙论文只在本阶段出现一次，
       错过一次就永远读不到 → 主线任务（如 V2 必须 MLA）会把玩家永久卡住。
       凡是「版本已到、但还没研读」的架构钥匙论文，一律补进候选。
       2026-09-12：门槛从「已到解锁阶段」放宽到「**下一阶段**就要解锁」——
       钥匙论文必须在架构解锁**前一阶段**就能读到，否则就是鸡生蛋：
       进 V3.5 才拿到 dsa 的钥匙 p_cai，而 V3.5 的任务就是立项 dsa/70（用户实测「卡住了」）。 */
    const _order = c.VER_ORDER || ["V1"];
    const _vi = _order.indexOf(s.ver || "V1");
    for (const a of (c.ARCHITECTURES || [])) {
      if (!a.unlockPaper) continue;
      if (_order.indexOf(a.unlock || "V1") > _vi + 1) continue;
      want(a.unlockPaper);
    }
    return out;
  },

  refreshPaperCandidates() {
    const c = this.cfg, s = this.state;
    const pool = (c.PAPER && c.PAPER.POOL) || [];
    /* V3.5.2：每阶段只解锁 1 篇（CANDIDATES_BY_VER）；未配置的阶段走旧随机候选 */
    const byVer = (c.PAPER && c.PAPER.CANDIDATES_BY_VER || {})[s.ver || "V1"];
    const doing = s.paperResearch ? this.paperNoOf(s.paperResearch.id) : null;
    if (byVer) {
      s.paperCandidates = byVer.map((x) => this.paperNoOf(x))
        .filter((no) => no != null && !this.hasPaper(no) && doing !== no);
    } else {
      const cnt = (c.PAPER && c.PAPER.CANDIDATE_COUNT) || 3;
      const avail = pool.filter((p) => !this.hasPaper(p.no) && doing !== p.no);
      // 洗牌取前 cnt 篇（一屏放得下）
      for (let i = avail.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [avail[i], avail[j]] = [avail[j], avail[i]];
      }
      s.paperCandidates = avail.slice(0, cnt).map((p) => p.no);
    }
    /* 钥匙论文兜底（口径见 stagePapersNeeded） */
    for (const id of this.stagePapersNeeded()) {
      if (s.paperCandidates.indexOf(id) < 0) s.paperCandidates.push(id);
    }
    return s.paperCandidates;
  },

  /* 旧存档论文候选自愈（2026-09-13 用户反馈「我的旧存档还是没看到解锁 V3.5 的论文」）：
     ⚠️ `s.paperCandidates` 是**存进存档的快照** —— 配置改了、钥匙论文链条调了、桥补了新论文，
     旧档都不会重算，玩家永远停在当年那份列表上（症状 = 论文面板里就是没有该读的那篇，
     而且面板只读不重算，打开多少次都没用）。
     读档时按当前配置补一次，**只补不删**（不洗牌 → 每次读档结果一致、老候选保留）：
       ① 剔除已从 POOL 退役的 id（老配置残留，点开只会是坏卡）；
       ② 补入 stagePapersNeeded()（阶段论文 + 钥匙论文）。
     幂等：重复读档 / 新档读入都不会重复添加。返回本次补入条数（断言可见）。 */
  healPaperCandidates() {
    const s = this.state;
    if (!Array.isArray(s.paperCandidates)) s.paperCandidates = [];
    /* 先做「字符串 id → 数字 no」的存档迁移（幂等）：老档里 `["p_mla"]` 变成 `[4005]` */
    s.papersOwned = (Array.isArray(s.papersOwned) ? s.papersOwned : [])
      .map((x) => this.paperNoOf(x)).filter((no, i, a) => no != null && a.indexOf(no) === i);
    s.paperCandidates = s.paperCandidates.map((x) => this.paperNoOf(x))
      .filter((no, i, a) => no != null && a.indexOf(no) === i);
    if (s.paperResearch && s.paperResearch.id != null) {
      const no = this.paperNoOf(s.paperResearch.id);
      if (no != null) s.paperResearch.id = no; else s.paperResearch = null;   // 在研的那篇已退役 → 放掉
    }
    const pool = (this.cfg.PAPER && this.cfg.PAPER.POOL) || [];
    if (pool.length) {
      const ids = new Set(pool.map((p) => p.no));
      s.paperCandidates = s.paperCandidates.filter((id) => ids.has(id));
    }
    let added = 0;
    for (const id of this.stagePapersNeeded()) {
      if (s.paperCandidates.indexOf(id) < 0) { s.paperCandidates.push(id); added++; }
    }
    return added;
  },

  /* 记事本自愈（2026-10-01 玩家反馈「记事本都清空了还解锁 1002」）：
     s.notebook 是存档快照，配置删了它不会自愈。读档时按当前 NOTES 表过滤 ——
     只留表里还认得的 id（顺带去重）。与 healPaperCandidates 同款：幂等、每次读档结果一致。 */
  healNotebook() {
    const s = this.state;
    if (!Array.isArray(s.notebook)) s.notebook = [];
    const notes = this.c2Notes();
    s.notebook = s.notebook.map(String).filter((id, i, a) => notes[id] && a.indexOf(id) === i);
  },

  /* 候选人失效周自愈（2026-10-01）：buildCand 兜底占位人曾经不写 expireAbsWeek ⇒ 永不过期
     ⇒ 在招聘列表里无限堆积（玩家反馈「等待时间无限的周老师/同学」）。老档里已堆积的
     无过期候选人这里补一次票（absWeek + TTL），之后走 expireCandidates 正常老化离场。
     ⚠️ 只补**没有**失效信息的；V1 保底 starter（有意不过期）不动；幂等：已有 expireAbsWeek
     / expireWeek 的原样保留。 */
  healCandExpire() {
    const s = this.state;
    if (!Array.isArray(s.candidates)) return;
    const ttl = this.cfg.CANDIDATE_TTL_WEEKS || 0;
    if (ttl <= 0) return;
    for (const cd of s.candidates) {
      if (!cd || cd.starter) continue;
      if (cd.expireAbsWeek != null || cd.expireWeek != null) continue;
      cd.expireAbsWeek = this.absWeek() + ttl;
    }
  },

  /* 事件引用的存档迁移（doc/32 §8）：旧档里 `s.triggered[].id` / `s._evtOnce` /
     `s._evtLastAt` / `s.pendingEvent.id` 存的都是字符串事件 id，这里一次性换成数字 no。
     ⚠️ 只换**认得的**：`s.triggered` 里混着非事件标记（plan / direction / E_EARLY 之类），
        换不动就原样留着 —— 一刀切会把它们清成 null。幂等：数字进 → 数字出。 */
  healEventIds() {
    const s = this.state;
    if (Array.isArray(s.triggered)) {
      s.triggered.forEach((t) => {
        if (!t || t.id == null) return;
        const no = this.evNoOf(t.id);
        if (no != null) t.id = no;
      });
    }
    const rekey = (obj) => {
      if (!obj || typeof obj !== "object") return {};
      const out = {};
      Object.keys(obj).forEach((k) => {
        const no = this.evNoOf(k);
        out[no != null ? no : k] = obj[k];      // 认不出（非事件键）→ 原样保留
      });
      return out;
    };
    s._evtOnce = rekey(s._evtOnce);
    s._evtLastAt = rekey(s._evtLastAt);
    if (s.pendingEvent && s.pendingEvent.id != null) {
      const no = this.evNoOf(s.pendingEvent.id);
      if (no != null) s.pendingEvent.id = no; else s.pendingEvent = null;   // 事件已退役 → 放掉
    }
    if (Array.isArray(s.pending)) {
      s.pending.forEach((p) => {
        if (p && p.id != null) { const no = this.evNoOf(p.id); if (no != null) p.id = no; }
        if (p && p.no == null && p.key != null) p.no = this.evNoOf(p.key);
      });
    }
  },
  /* ---------------- 工程师 ID 化：读档自愈（2026-09-14 · doc/32 §10.3）----------------
     老档里工程师实例的主键还是 `"eng_42"` 这种字符串 id，而池子条目现在只有 `no`（编号）+ `key`（原 id）。
     这里把**实例 + 候选**补上 `no`、把主键折成规范形态 `"e"+no`，并把所有以旧 id 为
     **键 / 值**的字段一起迁移（技能表 / 座位表 / 产出累计 / 冷却表 / 负责人 / 事件目标人…）。
     ⚠️ 两条硬规矩（与 healPaperCandidates / healEventIds 同款）：
       ① **幂等**：只认「查 LEGACY 表能认出」的旧字符串，跑第二遍什么都不动；
       ② **只换认得的**：认不出的键/值原样保留，绝不猜。
     ⚠️ `key` 字段**不迁**（它就是留着旧字符串做可读别名的）。
     ⚠️ test_save_migrate 有一条「走 GC.restore 真路径 → 全量遍历存档、断言旧字符串零残留」的守卫，
        漏了哪个字段它会直接点出来。 */
  healEngineerIds() {
    const s = this.state;
    if (!s) return;
    const leg = this.cfg.ENGINEERS_LEGACY_NO || {};
    const noOfOld = (x) => (typeof x === "string" && leg[x] != null ? leg[x] : null);
    /* ① 实体（在职 + 候选）：补 no、换 id */
    const fixEnt = (e) => {
      if (!e || typeof e !== "object") return;
      const no = this.engNoOf(e);
      if (no == null) return;                       // 访客（vis_*）等非池子人 → 不动
      if (e.no !== no) e.no = no;
      const want = this.engIdOf(no);
      if (e.id !== want) e.id = want;
    };
    (s.engineers || []).forEach(fixEnt);
    (s.candidates || []).forEach(fixEnt);
    /* ② 键重命名：任何「旧 id（可带 : 后缀，如 tbTrained 的 "eng_42:3"）」的**对象键** */
    const rekeyIn = (obj) => {
      if (!obj || typeof obj !== "object") return;
      Object.keys(obj).forEach((k) => {
        const i = k.indexOf(":");
        const base = i < 0 ? k : k.slice(0, i), suf = i < 0 ? "" : k.slice(i);
        const no = noOfOld(base);
        if (no == null) return;
        const nk = this.engIdOf(no) + suf;
        if (nk === k) return;
        obj[nk] = obj[k];
        delete obj[k];
      });
    };
    ["tbTalked", "tbRested", "tbTrained", "workClicks", "workQuota",
      "prodByEng", "prodFullByEng", "seatOf", "_candLocked"].forEach((k) => rekeyIn(s[k]));
    rekeyIn((s.v35 || {}).prodAcc);
    /* ③ 值指针（显式清单；这些字段存的是**工程师主键字符串**本身） */
    const fixVal = (holder, k) => { if (!holder) return; const no = noOfOld(holder[k]); if (no != null) holder[k] = this.engIdOf(no); };
    fixVal(s, "leader");
    fixVal(s, "lastLeader");
    fixVal(s, "_evTarget");
    fixVal(s.v35, "leaveWho");
    fixVal(s.v35, "poachWho");
    fixVal(s.v35, "riskWho");
    (s.actionLog || []).forEach((a) => fixVal(a, "targetId"));
    if (Array.isArray(s.sparkUsed)) {
      s.sparkUsed = s.sparkUsed.map((x) => { const no = noOfOld(x); return no != null ? this.engIdOf(no) : x; });
    }
  },
  /* 同 type 词条去重（2026-10-04 玩家反馈「两个一样的词条，只是等级不一样」）——
     与 cloneEng 里的折叠**同一条口径（同 type 取最高等级）**，两处必须一致：
       · cloneEng 管**新招进来的人**（配置笔误当场自愈）；
       · 这里管**已在职 / 在候选池里的人**（存档快照，改配置不会重算 ⇒ 旧档会一直带着重复）。
     覆盖三处清单：engineers / candidates / miniModels（小模型也有词条？无则空跑，代价为零）。
     幂等：已折叠过的再跑一次结果相同、不抛错。返回被改动的条数（测试用）。 */
  foldTraitDups(e) {
    if (!e || !Array.isArray(e.traits)) return 0;
    const before = e.traits.length;
    const out = [], at = new Map();
    for (const t of e.traits) {
      if (!t || !t.type) continue;                    // 脏数据（无 type）直接丢
      if (at.has(t.type)) {
        const j = at.get(t.type);
        if ((t.level || 1) > (out[j].level || 1)) out[j] = { ...out[j], level: t.level };
      } else { at.set(t.type, out.length); out.push({ ...t }); }
    }
    e.traits = out;
    return before - out.length;
  },
  /* 旧档职业迁移只补缺，保留玩家/编辑器明确登记的 type 和所有技能。 */
  healEngineerRoles() {
    const s = this.state;
    if (!s) return 0;
    let n = 0;
    for (const k of ["engineers", "candidates", "miniModels"]) {
      for (const e of s[k] || []) {
        if (!e || e.type) continue;
        e.type = this.primaryTraitType(e); n++;
      }
    }
    return n;
  },
  healTraitDups() {
    const s = this.state;
    if (!s) return 0;
    let n = 0;
    for (const k of ["engineers", "candidates"]) {
      for (const e of (s[k] || [])) n += this.foldTraitDups(e);
    }
    for (const e of (s.miniModels || [])) n += this.foldTraitDups(e);
    return n;
  },
  /* 维度超上限自愈（2026-10-04 玩家报「排行榜有人 1600+ 分」）：
     把超出 `statCap()` 的四维与轴**拉回上限**（状态层一起改，面板显示与存档都干净）。
     正常玩法的值本来就 ≤ cap（tick 主产线两处已夹），所以这是**纯兜底**、零正常影响。

     ⚠️ 为什么读档也要管：`evaluate()` 出口那次夹紧只保护「算出来的分」，
        状态层留着脏值的话 —— ① 面板显示一个玩家永远达不到的数字；
        ② 任何**不经过 evaluate 的读侧**（图鉴快照 `pushModelSnapshot` / `recordCodex`
           存的是当时的四维）会把脏值一起写进历史记录，事后无法分辨。
     ⚠️ 口径与 `statCap()` 完全一致（同一把尺子）：四维走 `CAP_BY_VER × PARAM_CAP_MUL`，
        追加轴走 `V35.axisCap`（未激活的轴不动，它恒为 0）。
     ⚠️ 只夹**超出**的部分，负值也顺手归零（与 729 行的模板补全同款）。
     幂等：夹完再跑一次结果相同。返回被改动的维度数（测试用）。 */
  healDimOverCap() {
    const s = this.state;
    if (!s) return 0;
    let cap;
    try { cap = this.statCap(); } catch (e) { return 0; }   // 配置缺失时不硬崩
    if (!cap) return 0;
    let n = 0;
    if (window.V35.mergedGroups(s).length) {
      const clean = window.V35.clampStats(s, s, cap);
      const engine = s.v35 && s.v35.stats ? window.V35.clampStats(s, s.v35.stats, cap) : null;
      for (const k of window.V35.allDims()) {
        if (typeof s[k] === "number" && s[k] !== clean[k]) { s[k] = clean[k]; n++; }
        if (engine && typeof s.v35.stats[k] === "number") s.v35.stats[k] = engine[k];
      }
      return n;
    }
    const clamp1 = (k) => {
      const cv = cap[k];
      if (cv == null || !isFinite(cv)) return;
      const v = s[k];
      if (typeof v !== "number" || !isFinite(v)) return;
      const w = Math.max(0, Math.min(cv, v));
      if (w !== v) { s[k] = w; n++; }
      /* v35.stats 是引擎态的同一份值（evaluate 的 stats 读 s[k]，但引擎 tick 内部用
         v35.stats）—— 两边都夹，否则「面板 1088、引擎 2000」继续不一致。 */
      if (s.v35 && s.v35.stats && typeof s.v35.stats[k] === "number") {
        const mv = Math.max(0, Math.min(cv, s.v35.stats[k]));
        if (mv !== s.v35.stats[k]) s.v35.stats[k] = mv;
      }
    };
    for (const k of this.dimsOf(s)) clamp1(k);
    for (const k of (window.V35 && window.V35.allDims ? window.V35.allDims() : [])) clamp1(k);
    return n;
  },
  startPaper(pid) {
    const c = this.cfg, s = this.state;
    const p = this.paperOf(pid);
    if (!p) return { ok: false, tip: "找不到这篇论文" };
    pid = p.no;                                  // 存档只存数字 no（字符串 id 一律规整掉）
    if (this.v35On()) {
      /* 用 s.paperResearch 判「在研」——不要用 paper.started/paper.done：
         读档时 loadState 会把「已掌握论文」的 paper.done 置 true，旧判据会让新研究永远开不了。 */
      if (s.paperResearch) return { ok: false, tip: "正在研究中，等这篇做完" };
      if (this.hasPaper(pid)) return { ok: false, tip: "已经掌握" };
      s.v35.paper.started = true;                        // 引擎不再自动开研
      s.v35.paper.done = false;                          // 新研究开始 → 引擎按新 kind 重算（完成时才生效）
      s.v35.paper.kind = p.effect.kind || 'text_prob';
      /* doc/27 P5：论文可「附赠」一根轴（永续：每 tick 概率 +N 加到该轴） */
      s.v35.paper.axis = (p.effect && p.effect.axis) || null;
      s.v35.paper.axisProb = (p.effect && p.effect.axisProb) != null ? p.effect.axisProb : 0;
      s.v35.paper.axisAdd = (p.effect && p.effect.axisAdd) != null ? p.effect.axisAdd : 1;
      s.v35.paper.left = c.V35.PAPER_RESEARCH_TICKS;     // 只耗时，不花钱
      /* 展示用周数按配置换算（玩法配置→ 论文研究 可调耗时） */
      const pw = c.V35.TICKS_PER_WEEK || 6;
      s.paperResearch = { id: pid, weeks: Math.max(1, Math.round((c.V35.PAPER_RESEARCH_TICKS / pw) * 10) / 10),
                          startWeek: s.week || 0 };
      return { ok: true, paper: p, free: true };
    }
    if (s.paperResearch) return { ok: false, tip: "正在研究中，等这篇做完" };
    if (this.hasPaper(pid)) return { ok: false, tip: "已经掌握" };
    s.paperResearch = { id: pid, weeks: p.weeks, startWeek: s.week || 0 };
    return { ok: true, paper: p };
  },

  /* 论文还需几周（面板倒计时用）。2026-09-08：优先按引擎剩余 tick 算 ——
     跨阶段时 s.week 会归零，用 startWeek + weeks − s.week 会算成负数（永远显示「剩 1 周」）。 */
  paperWeeksLeft() {
    const c = this.cfg, s = this.state;
    const pr = s.paperResearch;
    if (!pr) return 0;
    const tpw = (c.V35 && c.V35.TICKS_PER_WEEK) || 6;
    if (this.v35On() && s.v35 && s.v35.paper && (s.v35.paper.left || 0) > 0) {
      return Math.max(1, Math.ceil((s.v35.paper.left || 0) / tpw));
    }
    return Math.max(1, (pr.startWeek || 0) + (pr.weeks || 1) - (s.week || 0));
  },

  /* ---------------- 工资与欠薪 ---------------- */
  doPayroll() {
    const c = this.cfg, s = this.state;
    const P = c.PAYROLL || {};
    s._hintPayday = false;       // 发薪后重新武装「提前一周提醒」
    const alive = s.engineers.filter((e) => !e.resigned);
    const total = alive.reduce((a, e) => a + (e.salary || 0), 0) * 1;   // 月工资（一次付一个月）
    const res = { total, paid: true, deficit: 0, left: [], pardoned: false };
    if (total <= 0) return res;
    if ((s.funding || 0) >= total) {
      s.funding -= total;
      return res;
    }
    // 经费不足 → 欠薪
    const short = total - (s.funding || 0);
    s.funding = 0;
    s.fiscalDeficit = (s.fiscalDeficit || 0) + short;
    res.paid = false;
    res.deficit = short;
    /* 全员体力打击（2026-09-04）：原「士气 -25，过低则离职」走的是废弃的 morale，
       实际既没扣到东西也没人会走，欠薪等于毫无代价。改为扣体力（唯一生效的状态条）。
       2026-09-22：全员效果一律走 addEnergyAll（体力「每人一份」，逐人各扣）。 */
    /* ⚠️★ 2026-09-30 修 BUG（用户报「破产兜底事件没有正常触发」）：
       首次免责（母公司代缴）原来在这里 `s.fiscalDeficit = 0` 把欠薪抹掉，而破产判定
       （officeAdvanceV35 同 tick 更靠后，见 L3244）看的正是 `fiscalDeficit > 0 || funding < 0`
       —— 免责清帐后两个条件同时不成立 ⇒ **V35_BAILOUT 兜底卡永远弹不出来**。
       实测 tmp/probe_bailout.js（真发薪路径）：第 1 次付不出 → log.bailout / log.event.key 全为空；
       第 2 次才弹兜底。玩家体感就是「欠薪了，然后什么都没发生」，整条破产链（兜底 →
       二次破产 GG）从第二次欠薪才开始。
       现在：首次免责只免「全员体力打击」，欠薪照记 ⇒ 首次欠薪就进兜底链（与 doc/20 v2.2 §7.2
       「首次破产先弹 V35_BAILOUT 拦截」的原始设计一致）。 */
    if (P.FIRST_PARDON && !s.pardonUsed) {
      s.pardonUsed = true;
      res.pardoned = true;
    } else {
      this.addEnergyAll(-(P.DEFICIT_ENERGY_HIT != null ? P.DEFICIT_ENERGY_HIT : 20));
    }
    return res;
  },

  /* 欠款金额（用于 HUD 警示） */
  payrollDue() { return this.state.payrollDue || 0; },
  monthlyPayroll() {
    return this.state.engineers.filter((e) => !e.resigned).reduce((a, e) => a + (e.salary || 0), 0);
  },

  /* 投资人（inject:true）事件能不能进掷骰池 —— 三道门的唯一实现（引擎过滤与
     test_p3capital ④b/④c 共用一把尺，改动别只改一处）。任一命中 = 本 tick 不进池：
     ① 兜底套利冷却（2026-09-07，绝对周口径）——吃过度款后 8 周内不再来；
     ② 分红未结清（2026-10-01 用户要求）——applyEffects 挂分红是**整体替换**，
        未结清时再注资会顶掉老分红的剩余笔数；
     ③ 不缺钱（2026-10-02 用户要求）——经费 ≥「几个月工资」时不触发：
        玩家账上几千万还弹「投资人只给两三百万」只会让人困惑 ⇒ 投资人只雪中送炭，
        不锦上添花。阈值 = 该事件 poor.months（缺钱加权用的同一个月数，缺省 3）：
        ≥ 阈值 = 加权本来就不生效，现在连入场资格也没有；< 阈值 = 加权按原样放大。
        用月工资口径而不是绝对金额 —— 后期经费量级是前期的十几倍，绝对阈值必失真
        （同 poorMul / bankruptWarn 的理由）。月薪为 0（极端态）无法判断 → 不拦。 */
  injectPoolBlocked(st, e) {
    if (st._bailoutCooldownUntil && this.absWeek() < st._bailoutCooldownUntil) return true;
    if (st.v35 && st.v35.dividend && (st.v35.dividend.left || 0) > 0) return true;
    const months = (e && e.poor && e.poor.months != null) ? e.poor.months : 3;
    const pay = this.monthlyPayroll() || 0;
    return pay > 0 && (st.funding || 0) >= pay * months;
  },

  /* 破产预警（2026-09-29 用户要求）：经费 < 2 个月工资 → 黄牌；< 1 个月 → 红牌。
     · **每个阶段两级各提示一次**：状态存在 s.bankruptWarn = { ver, two, one }，
       换阶段（ver 变了）整体复位 ⇒ 新阶段重新武装，两级都能再提示一次。
     · 跳到更低一档时（例如一口气买到 <1 个月）直接把更高级那档也标成已用，
       否则回头做别的事经费回升再降，会补一条早就过期的小警告。
     · 欠薪中（fiscalDeficit > 0）不再预警 —— 那时已经进破产链，兜底/GG 比提示更重要。
     返回 null = 本次不提示；否则 { level:1|2, pay, fund, months, text }，由 UI 负责弹提示 + 存档。 */
  bankruptWarn() {
    const s = this.state;
    if (!s || s.phase === "over" || s.bankrupt) return null;
    if (s.fiscalDeficit > 0) return null;
    const pay = this.monthlyPayroll();
    if (!(pay > 0)) return null;
    if (!s.bankruptWarn || s.bankruptWarn.ver !== s.ver) {
      s.bankruptWarn = { ver: s.ver, two: false, one: false };
    }
    const w = s.bankruptWarn;
    const fund = s.funding || 0;
    const months = fund / pay;
    if (fund < pay && !w.one) {
      w.one = true; w.two = true;      // 直接掉到更低的档 → 高档不再补提示
      return { level: 2, pay: pay, fund: fund, months: months,
        text: "🚨 经费不足一个月工资（约 " + Math.round(pay / 10000) + " 万）！下次发薪就要欠薪了，再撑不住就只有破产兜底那一次机会。" };
    }
    if (fund < pay * 2 && !w.two) {
      w.two = true;
      return { level: 1, pay: pay, fund: fund, months: months,
        text: "⚠️ 经费已不足两个月工资（月薪约 " + Math.round(pay / 10000) + " 万），注意留够发薪的钱。" };
    }
    return null;
  },

  /* 点击一位工程师：随机 1 个维度 +ADD（暴击 ×CRIT_MULT），消耗精力与一次机会。
     返回 {ok, stat, statName, add, crit, name, left}；不可点时返回 {ok:false, tip}。 */
  clickEngineer(engId) {
    const c = this.cfg, s = this.state;
    const w = c.WORK_CLICK || {};
    const e = s.engineers.find((x) => x.id === engId && !x.resigned);
    if (!e) return { ok: false, tip: "找不到这位工程师" };
    const left = this.workshopClicks(e);
    if (left <= 0) return { ok: false, tip: `${e.name} 已经点不动了，先让他歇会儿` };
    const keys = this.baseDims();
    const k = keys[Math.floor(Math.random() * keys.length)];
    const crit = Math.random() < (w.CRIT_PROB != null ? w.CRIT_PROB : 0.3);
    let add = (w.ADD != null ? w.ADD : 1) * (crit ? (w.CRIT_MULT || 2) : 1);
    // 连击（X2）：连点 COMBO_AT 次触发一次额外加成，给增量玩法一点 combo 爽感
    s.workClicks = s.workClicks || {};
    const used = (s.workClicks[e.id]) || 0;
    const comboAt = w.COMBO_AT != null ? w.COMBO_AT : 5;
    const combo = used > 0 && (used + 1) % comboAt === 0;
    if (combo) add += (w.COMBO_ADD != null ? w.COMBO_ADD : 1);
    const cap = this.statCap();
    const before = s[k];
    s[k] = Math.min(this.statLimit(k, cap), Math.max(0, s[k] + add));
    const real = s[k] - before;
    // 精力消耗（会被 clamp 到 0，但次数已按精力算过，不会"点光"）
    /* 2026-09-22：走 addEnergy 而不是直写 e.energy —— 体力是每人一份了，
       addEnergy 顺带把岗位派生标量（人均值）一起同步，避免两套数打架。 */
    this.addEnergy(e, -(w.ENERGY_COST != null ? w.ENERGY_COST : 2));
    s.workClicks[e.id] = used + 1;
    s.workGain = s.workGain || this.newDims(0, s);
    s.workGain[k] = (s.workGain[k] || 0) + real;
    /* 数据词条：干活时就地产语料（X2）——之前只在 finishWorkshop 结算，
       玩家看着数据工程师在燃烧却看不到语料增长，很违和。 */
    let corpusAdd = 0;
    if ((e.traits || []).some((t) => t.type === "data")) {
      const cc = this.cfg.CORPUS || {};
      const capW = cc.CAP != null ? cc.CAP : 60;
      const per = cc.PROD_PER_LV != null ? cc.PROD_PER_LV : 8;
      corpusAdd = Math.round((per / 12) * 10) / 10;   // 一次点击 ≈ 双周产能的 1/12
      const c0 = s.corpus || 0;
      s.corpus = Math.min(capW, Math.round((c0 + corpusAdd) * 10) / 10);
      corpusAdd = Math.round((s.corpus - c0) * 10) / 10;
    }
    return {
      ok: true, stat: k, statName: this.statLabel(k), add: real, crit, combo,
      corpusAdd, name: e.name, left: this.workshopClicks(e),
    };
  },

  /* 一键全员：把全员剩余次数一次性点完（团队 ≥ ALL_MIN_TEAM 才可用） */
  clickAllEngineers() {
    const c = this.cfg, s = this.state;
    const min = (c.WORK_CLICK && c.WORK_CLICK.ALL_MIN_TEAM) || 5;
    const alive = s.engineers.filter((e) => !e.resigned);
    if (alive.length < min) return { ok: false, tip: `团队满 ${min} 人才能一键全员` };
    const results = [];
    let guard = 0;
    for (const e of alive) {
      while (this.workshopClicks(e) > 0 && guard++ < 500) {
        const r = this.clickEngineer(e.id);
        if (!r.ok) break;
        results.push(r);
      }
    }
    if (!results.length) return { ok: false, tip: "大家这轮都点不动了" };
    return { ok: true, results, count: results.length };
  },


  clampNum(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); },

  /* ---------------- 工程师状态衰减 + 离职判定（08 设计文档 §5.1 / §5.2）----------------
     每双周：体力先恢复 ENERGY_RECOVER 再扣 ENERGY_DECAY。
     2026-09-04：干劲/忠诚与「低忠诚自然离职」已随废弃数值一并移除，
     离职只可能来自事件显式挂的 target_resign / quitRisk。
     返回本轮离职名单（由 advance 并入报告）。
     兜底：不允许全员离职（用户 2026-08-28 决定：辞退/离职都不能让团队清零）。 */

  /* ---------------- 慰问（已删除 2026-09-06）----------------
     慰问入口随 P7 团建改版退役（A_H_CARE 行动卡删除后 UI 已无入口），
     补体力走「团建 / 聚餐 / 1v1 / 奖金 / 休息」这些团队建设操作。 */

  /* ==========================================================================
     个人操作（2026-08-30 新 UI：团队面板 → 点人 → 右侧「安排/培训/休息/加薪/辞退」）
     ========================================================================== */

  /* 找在职工程师（新 UI 统一入口，带错误提示） */
  _eng(engId, tip) {
    const e = this.state.engineers.find((x) => x.id === engId && !x.resigned);
    return e || null;
  },

  /* 个人安排四项的「是否已用完」判定（**唯一真源**：core 校验与 UI 置灰都读这里）。
     ⚠️ 以前 core 与 game_ui 各写一份键，一漂移就出现「面板显示能点、点了说已用过」。
     ⚠️ 2026-09-22 修 BUG：冷却一律改用**绝对时钟**记账 ——
       `s.week / s.rounds` 每次进新阶段都会归零，用它记冷却会出现两类症状：
       ① 冷却永不重置（聚餐的 meetingWeek 在新阶段里变成"未来时间"，差值恒为负）；
       ② 阶段开头凭空撞车 / 提前开闸（桶号倒退，撞上上阶段用过的键，或只隔 1 周就放行）。
     现在：周类冷却用 absWeek()（= week + weekOffset，跨阶段单调），
     月类额度用 absRounds（= 绝对回合数，跨阶段累加）。 */
  arrangeUsed(e) {
    const s = this.state;
    const wk = this.absWeek();
    const per = ((this.cfg.PAYROLL || {}).PERIOD_ROUNDS) || 28;
    const monthBucket = Math.floor((s.absRounds || 0) / per);
    const lastTalk = s.tbTalked && s.tbTalked[e.id + ":aw"];
    return {
      /* 谈心：记上次谈心的**绝对周**，满 2 周才恢复（键值 = 周号） */
      talk: typeof lastTalk === "number" && wk - lastTalk < 2,
      /* 培训：每人每周一次（键按绝对周） */
      train: !!(s.tbTrained && s.tbTrained[e.id + ":w" + wk]),
      /* 加薪：每人每月一次（键按绝对回合换算的月桶） */
      raise: !!(s.raisedCount && s.raisedCount[e.id + ":" + monthBucket]),
      /* 休息：每人每周两次；或本周正在休息（restWeek 仍是阶段内周，进新阶段会清） */
      rest: ((s.restCount && s.restCount[e.id + ":w" + wk]) || 0) >= 2
        || e.restWeek === (s.week || 0),
    };
  },

  /* 安排：一对一谈话，聊完松快些（回体力），不花钱，每 2 周一次
     2026-09-04：原来是「干劲+10 忠诚+4 体力-3」——两个加成都落在废弃数值上，实际只剩扣体力，
     等于纯亏。改为回体力，与「谈心缓解压力」的语义一致，且是真实生效的收益。
     ⚠️ 2026-09-17 曾因「体力真源是岗位共享槽」改成**按岗位去重 + 文案说明全组共享**；
     2026-09-22 用户明确要求「选谁谈心就只恢复谁的体力」→ 体力已改为**每人一份**
     （真源 e.energy，见 addEnergy），所以这里**回到按人记账**：同岗位两个人各谈一次，
     各自 +12，互不影响。
     ⚠️ 2026-09-22 修 BUG（用户报「冷却期间再点会重新冷却」）：原键是
     `:w + floor(s.week / 2)`（阶段内周数分桶）——s.week 每阶段归零 → 桶号倒退，
     既可能撞上上阶段用过的桶（明明隔了两周仍显示"已聊过"），也可能只隔 1 周就提前
     开桶（玩家看到"还在冷却却又能点"）。改为记绝对周 + 满 2 周判定。 */
  arrangeEngineer(engId) {
    const s = this.state;
    const c = this.cfg;
    const e = this._eng(engId);
    if (!e) return { ok: false, tip: "找不到这位工程师" };
    if (this.offworkNow()) return { ok: false, tip: "🌙 已经下班了，明天上班再聊吧" };
    this.ensureStatus(e);
    s.tbTalked = s.tbTalked || {};
    if (this.arrangeUsed(e).talk) return { ok: false, tip: e.name + "这两周已经聊过了" };
    s.tbTalked[e.id + ":aw"] = this.absWeek();
    const gain = ((c.TEAM_BUILD || {}).TALK_ENERGY != null) ? (c.TEAM_BUILD || {}).TALK_ENERGY : 12;
    const got = this.addEnergy(e, gain);
    return { ok: true, tip: e.name + " 聊完松快了些：体力 +" + Math.round(got) };
  },

  /* 培训：花一笔钱换随机属性 +，每周一次
     2026-09-04（用户需求）：不是均匀随机——**数值越低的能力被抽中的概率越大**（木桶效应，
     补短板），权重 = (参考上限 − 当前值)，全满时退化为等概率。 */
  trainEngineer(engId) {
    const s = this.state, c = this.cfg;
    const e = this._eng(engId);
    if (!e) return { ok: false, tip: "找不到这位工程师" };
    if (this.offworkNow()) return { ok: false, tip: "🌙 已经下班了，明天上班再培训吧" };
    const cost = ((c.TEAM_BUILD || {}).TRAIN_COST != null) ? c.TEAM_BUILD.TRAIN_COST : 30000;
    if (s.funding < cost) return { ok: false, tip: "经费不足（需要 " + Math.round(cost / 10000) + " 万）" };
    s.tbTrained = s.tbTrained || {};
    /* 2026-09-22：键改用**绝对周**（原来用 s.week，进新阶段归零 → 新阶段第 0 周
       会和上阶段第 0 周撞车，误报"本周已培训过"）。见 arrangeUsed 的说明。 */
    if (this.arrangeUsed(e).train) return { ok: false, tip: e.name + " 本周已经培训过了" };
    s.funding -= cost;
    s.tbTrained[e.id + ":w" + this.absWeek()] = true;
    this.ensureStatus(e);
    e.stats = e.stats || {};
    this.healEngineeringTalent(e);
    const keys = this.engStatKeys(e);   // Embodied engineers train engineering instead of text.
    /* 培训加哪一项（2026-09-10 用户拍板：默认**等概率随机**）。
       旧的「低值加权」会优先把点数灌进当前最低的那项，玩家难以预期；等概率最直观。
       想切回旧手感：把 TEAM_BUILD.TRAIN_PICK 改成 "low"。 */
    const TB = c.TEAM_BUILD || {};
    let k;
    if ((TB.TRAIN_PICK || "random") === "low") {
      const ref = TB.TRAIN_WEIGHT_REF != null ? TB.TRAIN_WEIGHT_REF : 100;
      const w = keys.map((q) => Math.max(0, ref - (e.stats[q] || 0)));
      const sum = w.reduce((a, b) => a + b, 0);
      if (sum <= 0) {
        k = keys[Math.floor(Math.random() * keys.length)];      // 全部顶格 → 等概率兜底
      } else {
        let r = Math.random() * sum;
        k = keys[keys.length - 1];
        for (let i = 0; i < keys.length; i++) { r -= w[i]; if (r <= 0) { k = keys[i]; break; } }
      }
    } else {
      k = keys[Math.floor(Math.random() * keys.length)];
    }
    const add = ((c.TEAM_BUILD || {}).TRAIN_STAT_ADD != null) ? (c.TEAM_BUILD || {}).TRAIN_STAT_ADD : 5;
    /* ⚠️ 2026-09-30 修 BUG（用户报「天赋理论上限 100，现在会突破上限」）：
       这里原来是 `e.stats[k] += add`，**从不夹紧** —— 反复培训就能把潜力顶到 100 以上。
       潜力属性的口径就是 0-100（game_cfg「工程师潜力属性（与词条区分）」注明 stats 0-100；
       建池的 cloneEng 也是 `Math.min(100, …)` 夹紧的，只有培训这一条路会把数值顶穿）。
       夹到 100，并按**实际增量**报数（顶格时可能是 +0，别再说 +5 骗人）。 */
    const before = e.stats[k] || 0;
    e.stats[k] = Math.min(100, before + add);
    const gained = e.stats[k] - before;
    const dEn = this.addEnergy(e, -((c.TEAM_BUILD || {}).TRAIN_ENERGY_COST != null
      ? (c.TEAM_BUILD || {}).TRAIN_ENERGY_COST : 10));
    /* 提示只列真实生效的数值：属性 +N、体力 −N（干劲 +3 已随废弃数值一并删除）
       ⚠️ 2026-09-22：体力已「每人一份」，扣的就是**这个人**的体力，文案直接写人。 */
    return { ok: true, tip: e.name + " 培训完成：" + this.statName(k) + " +" + Math.round(gained) + "、体力 " + Math.round(dEn) };
  },

  /* 安排休息：让人下班，本周不再产出；到下一周「上班」才回体力（2026-09-08 用户拍板）。
     以前是点了立刻 +35 体力、还能照常产出 —— 等于白嫖，现在改成「用一周产出换体力」。 */
  restEngineer(engId) {
    const s = this.state;
    const e = this._eng(engId);
    if (!e) return { ok: false, tip: "找不到这位工程师" };
    if (this.offworkNow()) return { ok: false, tip: "🌙 人都下班了，就谈不上休息安排了" };
    if (e.restWeek === (s.week || 0)) return { ok: false, tip: e.name + " 这周已经在休息了" };
    s.restCount = s.restCount || {};
    /* 2026-09-22：键改用**绝对周**（同谈心/培训；否则新阶段第 0 周与上阶段第 0 周撞车，
       开局就误报"本周已经休息两次了"）。 */
    const key = e.id + ":w" + this.absWeek();
    s.restCount[key] = (s.restCount[key] || 0);
    if (s.restCount[key] >= 2) return { ok: false, tip: e.name + " 本周已经休息两次了" };
    s.restCount[key]++;
    this.ensureStatus(e);
    /* 2026-09-02：回体力按配置（可改），提示里的数字也跟着走 */
    const gain = (this.cfg.TEAM_BUILD || {}).REST_ENERGY != null
      ? (this.cfg.TEAM_BUILD || {}).REST_ENERGY : 35;
    /* 不再立刻回体力：挂起，等下周上班时 restoreRested() 统一恢复。
       本周该人从产出编制里剔除（syncResting → v35.restPre/Data/Post）。 */
    e.restWeek = s.week || 0;
    e.energyPending = (e.energyPending || 0) + gain;
    this.syncResting();
    /* ⚠️ 2026-09-22：体力已「每人一份」，回的就是**这个人**的体力（旧的「同岗位取最大
       pending 只回一次」已废），文案照实写。 */
    return { ok: true, tip: `${e.name} 下班休息了：本周不产出，下周上班时体力 +${Math.round(gain)}` };
  },

  /* 涨薪的个人增产时钟：四周 = 当前引擎每周回合数 × 4。
     absRounds 跨阶段连续且暂停不走；重复成功涨薪刷新截止回合，不叠倍率。
     产出用推进前回合判定，恰好覆盖截止前的全部回合；UI 用当前回合显示余额。 */
  productionRoundsPerWeek() {
    const c = this.cfg || {};
    const n = this.v35On() ? (c.V35 || {}).TICKS_PER_WEEK : (c.OFFICE || {}).ROUNDS_PER_WEEK;
    return Math.max(1, Number(n) || 6);
  },
  raiseProductionCfg() {
    const t = (this.cfg || {}).TEAM_BUILD || {};
    return {
      mul: Math.max(1, Number(t.RAISE_PROD_MUL != null ? t.RAISE_PROD_MUL : 1.5) || 1),
      weeks: Math.max(0, Number(t.RAISE_PROD_WEEKS != null ? t.RAISE_PROD_WEEKS : 4) || 0),
    };
  },
  refreshRaiseProduction(e) {
    const b = this.raiseProductionCfg();
    e.raiseProdUntilRound = Math.max(0, Number((this.state || {}).absRounds) || 0)
      + Math.ceil(b.weeks * this.productionRoundsPerWeek());
    return this.raiseProductionStatus(e);
  },
  raiseProductionStatus(e, atRound) {
    const now = atRound != null ? Number(atRound) : Number((this.state || {}).absRounds) || 0;
    const end = Number(e && e.raiseProdUntilRound);
    const left = Number.isFinite(end) ? Math.max(0, end - now) : 0;
    const mul = this.raiseProductionCfg().mul;
    const active = !!e && !e.resigned && left > 0 && mul > 1;
    return { active, mul: active ? mul : 1, roundsLeft: active ? left : 0,
      weeksLeft: active ? Math.ceil(left / this.productionRoundsPerWeek()) : 0 };
  },
  raiseProductionMul(e, atRound) { return this.raiseProductionStatus(e, atRound).mul; },

  /* 在职涨薪的唯一写入口：手动涨薪和事件调薪共用；招人时的定薪不算涨薪。 */
  increaseSalary(e, amount) {
    const add = Math.max(0, Math.round(Number(amount) || 0));
    if (!e || e.resigned || !add) return null;
    e.salary = Math.max(0, Math.round(Number(e.salary) || 0)) + add;
    e.weeksNoRaise = 0;
    return this.refreshRaiseProduction(e);
  },

  /* 事件费用按当前实际月薪报价，展示与执行共用，不修改配置或状态。
     target_salary_raise / team_salary_raise = 涨薪比例，同时预付这一份月薪增额。
     全员报价逐人取整再求和，避免 UI 合计与实际扣款不同。 */
  eventSalaryQuote(eff, evId, state) {
    const s = state || this.state, effect = eff || {};
    const team = effect.team_salary_raise != null;
    const raw = team ? effect.team_salary_raise : effect.target_salary_raise;
    if (raw == null) return { active: false, ok: true, cost: 0, salaryCost: 0, raises: [] };
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1)
      return { active: true, ok: false, tip: "调薪比例需要在 0% 到 100% 之间", raises: [] };
    const no = this.evNoOf(evId != null ? evId : (s.pendingEvent || {}).id);
    const pend = (s.pending || []).find((p) => this.evNoOf(p.no != null ? p.no : p.id) === no)
      || (s.pendingEvent && this.evNoOf(s.pendingEvent.id) === no ? s.pendingEvent : null);
    const targetId = s._evTarget || (pend && pend.targetId);
    const crew = (s.engineers || []).filter((e) => !e.resigned
      && (e.joinTick == null || !s.v35 || s.v35.tick >= e.joinTick)
      && (team || e.id === targetId));
    if (!crew.length) return { active: true, ok: false, tip: "目标工程师已不在岗，不能调薪", raises: [] };
    const raises = crew.map((e) => ({ id: e.id,
      add: Math.max(1, Math.round(Math.max(0, Number(e.salary) || 0) * rate)) }));
    const salaryCost = raises.reduce((sum, r) => sum + r.add, 0);
    const cost = salaryCost + Math.max(0, -(Number(effect.funding) || 0));
    const boost = this.raiseProductionCfg(), pct = Math.round(rate * 100);
    return { active: true, ok: (s.funding || 0) >= cost, team, raises, salaryCost, cost, pct,
      weeks: Math.ceil(boost.weeks), prodPct: Math.round((boost.mul - 1) * 100),
      tip: (s.funding || 0) >= cost ? "" : "经费不足（需要 " + cost.toLocaleString("zh-CN") + " 元）" };
  },
  /* Expense quotes are read-only. Conditional outcomes reserve their worst cost,
     matching the existing event UI without rolling an outcome during rendering. */
  eventFundingCost(eff, seen) {
    if (!eff || typeof eff !== "object") return 0;
    const visited = seen || new Set();
    if (visited.has(eff)) return 0;
    visited.add(eff);
    const branch = values => Math.max(0, ...values.map(value => this.eventFundingCost(value, new Set(visited))));
    let cost = Math.max(0, -(Number(eff.funding) || 0));
    if (eff.chance) cost += branch([eff.chance.success, eff.chance.fail]);
    if (Array.isArray(eff.rand)) cost += branch(eff.rand);
    if (eff.if_stat) cost += branch([eff.if_stat.then, eff.if_stat.else]);
    if (eff.if_stability_below != null) cost += branch([eff.flip, eff.normal]);
    return cost;
  },
  eventEffectsQuote(eff, evId, state) {
    const s = state || this.state, effect = eff || {};
    const salary = this.eventSalaryQuote(effect, evId, s);
    if (salary.active && !salary.ok && !salary.raises.length) return salary;
    const requestedFundingCost = this.eventFundingCost(effect), requestedCost = (salary.salaryCost || 0) + requestedFundingCost;
    // Historical mandatory bills have no reward to obtain. Keep their existing
    // pay-the-remaining-balance behavior so an old one-option event cannot deadlock.
    const pureLegacyBill = this.eventLegacyBillAllowed(effect, evId, s);
    const fundingCost = pureLegacyBill ? Math.min(Math.max(0, s.funding || 0), requestedFundingCost) : requestedFundingCost;
    const cost = (salary.salaryCost || 0) + fundingCost;
    const ok = salary.ok && (s.funding || 0) >= cost;
    return Object.assign({}, salary, { expenseActive: requestedCost > 0, fundingCost, cost, requestedCost,
      partialPayment: pureLegacyBill && cost < requestedCost, ok,
      tip: ok ? "" : "经费不足（需要 " + Math.ceil(cost).toLocaleString("zh-CN") + " 元）" });
  },
  eventLegacyBillAllowed(effect, evId, state) {
    const s = state || this.state;
    if (this.embodiedAvailable(s) || Number(effect.funding) >= 0
      || Object.keys(effect).some(key => key !== "funding")) return false;
    // Partial payment belongs only to an existing, unavoidable one-option bill.
    // Arbitrary effects and paid alternatives must still pay their full cost.
    const isBill = ev => ev && ev.era !== "embodied" && Array.isArray(ev.options)
      && ev.options.length === 1 && ev.options[0].effects === effect;
    return evId != null ? isBill(this.evByNo(evId)) : this.evList().some(isBill);
  },
  eventOptionStatus(opt, evId, state) { return this.eventEffectsQuote((opt || {}).effects, evId, state); },
  eventOptionText(opt, evId) {
    const q = this.eventOptionStatus(opt, evId);
    const vars = { raise_pct: q.pct == null ? "—" : q.pct,
      raise_cost: q.salaryCost == null ? "—" : q.salaryCost.toLocaleString("zh-CN"),
      raise_weeks: q.weeks == null ? Math.ceil(this.raiseProductionCfg().weeks) : q.weeks,
      raise_output: q.prodPct == null ? Math.round((this.raiseProductionCfg().mul - 1) * 100) : q.prodPct };
    const text = String((opt || {}).text || "").replace(/\{(raise_pct|raise_cost|raise_weeks|raise_output)\}/g, (_, k) => vars[k]);
    return q.partialPayment ? text + "（余额不足，本次实际支出 " + Math.round(q.cost).toLocaleString("zh-CN") + " 元）" : text;
  },

  /* 加薪：月薪 +10%，回体力并获得四周个人产出 +50%；每人每月一次
     2026-09-04：原「忠诚+8 干劲+8」全是废弃数值，涨薪实际毫无收益（只有更高的工资支出）。
     改成回体力——"钱给到位，状态就回来了"，是真实生效的收益。
     ⚠️ 2026-09-22：与谈心同一条口径 —— 体力已「每人一份」，加的是**这个人**的体力。
     旧的「体力那一半按岗位×月去重」是共享槽时代的补丁，已废。 */
  raiseSalary(engId) {
    const s = this.state;
    const c = this.cfg;
    const e = this._eng(engId);
    if (!e) return { ok: false, tip: "找不到这位工程师" };
    if (this.offworkNow()) return { ok: false, tip: "🌙 已经下班了，涨薪的事明天上班再谈" };
    s.raisedCount = s.raisedCount || {};
    /* 2026-09-22：月桶改用**绝对回合** absRounds（原用 s.rounds，每阶段归零 →
       桶号倒退：阶段开头有人被误判"本月已加过薪"、也有人白捡一次加薪）。 */
    const bucket = Math.floor((s.absRounds || 0) / ((this.cfg.PAYROLL || {}).PERIOD_ROUNDS || 28));
    const key = e.id + ":" + bucket;
    if (this.arrangeUsed(e).raise) return { ok: false, tip: e.name + " 这个月已经加过薪了" };
    const add = Math.max(1000, Math.round((e.salary || 0) * 0.1));
    if (s.funding < add) return { ok: false, tip: "经费不足（需要 " + Math.round(add / 10000) + " 万）" };
    s.funding -= add;
    s.raisedCount[key] = true;
    const boost = this.increaseSalary(e, add);
    this.ensureStatus(e);
    const gain = ((c.TEAM_BUILD || {}).RAISE_ENERGY != null) ? (c.TEAM_BUILD || {}).RAISE_ENERGY : 30;
    const got = this.addEnergy(e, gain);
    return { ok: true, boost, tip: e.name + " 加薪 +" + add.toLocaleString("zh-CN") + " 元/月：体力 +" + Math.round(got)
      + (boost.active ? "；接下来 " + boost.weeksLeft + " 周产出 +" + Math.round((boost.mul - 1) * 100) + "%" : "") };
  },

  /* [feature:engineer-potential-names] */
  /* 潜力属性中文名（培训提示用）—— 工程师潜力三维 code / algo / text，
     ⚠️ 2026-09-30 补 `algo`：本表原只有模型四维（code/text/safety/stability），
     trainEngineer 抽到 algo 时提示会退化成英文键 —— 玩家看到「algo +5」以为没加算法潜力。 */
  statName(k) {
    return ({ code: "代码潜力", algo: "算法潜力", text: "文字潜力", engineering: "工程潜力",
              safety: "安全性", stability: "稳定性" })[k] || k;
  },

  /* [/feature:engineer-potential-names] */
  /* [feature:last-engineer-helpers] */
  /* 在职编制沿用 !resigned；离职与辞退均不得清空团队。 */
  activeEngineerCount(s) {
    return ((s || this.state).engineers || []).filter((e) => e && !e.resigned).length;
  },
  fireMinKeep() {
    const value = Number((this.cfg.FIRE || {}).MIN_KEEP);
    return Number.isFinite(value) ? Math.max(1, value) : 1;
  },
  canFireEngineer(s) { return this.activeEngineerCount(s) > this.fireMinKeep(); },
  clearLonePoachRisk(s) {
    s = s || this.state;
    if (this.activeEngineerCount(s) > 1 || !s.v35) return;
    const st = s.v35;
    if (!st.poachRisk && st.poachWho == null && st.riskWho == null) return;
    st.riskWho = null;
    st.poachRisk = false;
    st.poachWho = null;
  },
  isPoachEvent(ev) {
    if (!ev) return false;
    const key = ev.key || this.evKeyOf(ev.no != null ? ev.no : ev.id);
    if (key === "V35_POACH" || key === "V35_20_HEADHUNT_STORM") return true;
    if (ev.cond && ev.cond.poach_risk != null) return true;
    const hasRisk = (value) => value && typeof value === "object"
      && (Number(value.poach_risk) > 0 || Object.values(value).some(hasRisk));
    return (ev.options || []).some((opt) => hasRisk(opt.effects));
  },
  poachEventBlocked(ev, s) {
    return this.activeEngineerCount(s) <= 1 && this.isPoachEvent(ev);
  },
  /* [/feature:last-engineer-helpers] */
  /* ---------------- 辞退（2026-09-12 用户定稿：负面效果只有赔付）----------------
     唯一代价 = 赔付月薪 × SEVERANCE_MUL（默认 2 倍，含代通知金）——
     旧的「返还半年薪 / 全员体力 -10 / 品牌 -5」已废除，不再读取旧配置键。
     经费不足也允许辞退（扣到负数走既有的欠薪/兜底链路；辞退本身是降月薪支出的止损手段）。
     不允许辞退到最后一人（MIN_KEEP，用户 2026-08-28 决定）。
     返回 { ok, reason, severance, name } —— reason: no_eng | resigned | min_keep */
  fire(engId) {
    const c = this.cfg, s = this.state;
    const f = c.FIRE || {};
  /* [feature:last-engineer-fire] */
    const e = s.engineers.find((x) => x.id === engId);
    if (!e) return { ok: false, reason: "no_eng" };
    if (e.resigned) return { ok: false, reason: "resigned" };
    if (!this.canFireEngineer(s)) return { ok: false, reason: "min_keep" };
    this.freeSeat(engId);   // 仅成功辞退才释放座位
  /* [/feature:last-engineer-fire] */
    const mul = f.SEVERANCE_MUL != null ? f.SEVERANCE_MUL : 2;
    const severance = Math.round((e.salary || 0) * mul);
    s.funding -= severance;
    e.resigned = true;
  /* [feature:last-engineer-fire-risk] */
    e.resignReason = "fired";
    this.clearLonePoachRisk(s);
  /* [/feature:last-engineer-fire-risk] */
    s.flags = s.flags || {};
    s.flags.fired = true;            // 08 §9 T14「座位空了」的触发条件
    return { ok: true, name: e.name, severance };
  },

  /* ---------------- 行动点 / 行动卡（08 设计文档 §4，P1）----------------
     每双周固定 AP（AP_PER_ROUND=2），玩家用行动卡把 AP 花在「冲数值」或「养团队」上——
     两类永远互相抢这 2 点，就是策略张力来源（用户 2026-08-28：只做训练+团队，经营类砍掉）。
     效果一律走 applyEffects / ensureStatus 单点结算，数值受 CAP 封顶与瘦身标准约束。 */

  actionById(id) {
    return (this.cfg.ACTIONS || []).find((a) => a.id === id) || null;
  },

  /* 卡片当前是否可打（UI 用它决定 disabled + 灰字原因）。不含依赖目标的动态成本。 */
  actionState(a) {
    const s = this.state;
    if (!a) return { ok: false, reason: "no_action", tip: "卡片不存在" };
    if (a.enabled === false) return { ok: false, reason: "disabled", tip: "暂未开放" };
    if ((s.ap || 0) < (a.ap || 1)) return { ok: false, reason: "no_ap", tip: "行动点不足" };
    if (a.cost > 0 && s.funding < a.cost) return { ok: false, reason: "no_fund", tip: "经费不足" };
    if (a.minWeek && s.week < a.minWeek) return { ok: false, reason: "locked", tip: `第 ${a.minWeek} 周后解锁` };
    if (a.needGpu && !this.gpuAtLeast(a.needGpu)) return { ok: false, reason: "locked", tip: "算力档位不足" };
    if (a.cond === "avgEnergyBelow45" && this.avgEnergy() >= 45) return { ok: false, reason: "locked", tip: "平均体力 ≥ 45 时不可用" };
    if (a.target === "one" && !s.engineers.some((e) => !e.resigned)) {
      return { ok: false, reason: "no_eng", tip: "没有在职工程师" };
    }
    return { ok: true };
  },

  /* 算力档位是否达到（含）指定档 */
  gpuAtLeast(tierId) {
    const order = this.cfg.GPU_TIER_ORDER || [];
    const cur = this.state.gpuTier;
    const ci = order.indexOf(cur), ti = order.indexOf(tierId);
    return ci >= 0 && ti >= 0 && ci >= ti;
  },

  /* 在职工程师平均体力 */
  avgEnergy() {
    const act = this.state.engineers.filter((e) => !e.resigned);
    if (!act.length) return 0;
    act.forEach((e) => this.ensureStatus(e));
    return act.reduce((a, e) => a + (e.energy || 0), 0) / act.length;
  },

  /* 维度短名（数值条 / 飘字 / 报告用）。追加轴的名字走配置 AXES.DEF[*].name（单点真源），
     这样将来在配置里改轴名，界面自动跟着变。 */
  statLabel(k) {
    const names = (this.cfg.EMBODIED || {}).AXIS_NAMES || {};
    if (typeof names[k] === "string" && names[k].trim()) return names[k].trim();
    const ax = ((this.cfg.V35 || {}).AXES || {}).DEF || {};
    if (ax[k] && ax[k].name) return ax[k].name;
    return { code: "代码", text: "文字", safety: "安全", stability: "稳定", codeText: "代码&文字", safetyStability: "安全&稳定" }[k] || k;
  },
  /* 数值条配色：四维走 CSS 类（沿用现有样式），轴走配置里的 gradient（内联），
     避免为了三根轴再加一批 CSS 类，也让颜色跟着配置走。 */
  dimBarClass(k) { return { code: "code", text: "text", safety: "safe", stability: "stable" }[k] || ""; },
  dimBarStyle(k) {
    const ax = ((this.cfg.V35 || {}).AXES || {}).DEF || {};
    return (ax[k] && ax[k].color) ? ("background:" + ax[k].color) : "";
  },

  /* 能力数值 → 展示文案（行动卡反馈用） */
  effectsText(eff) {
    const out = [];
    for (const k of this.dimsOf()) {   // 无状态上下文：走 this.state
      if (eff[k]) out.push(`${this.statLabel(k)} ${eff[k] > 0 ? "+" : ""}${Math.round(eff[k])}`);
    }
    if (eff.brand) out.push(`品牌 ${eff.brand > 0 ? "+" : ""}${Math.round(eff.brand)}`);
    return out.join("、");
  },

  statsText(st, all) {
    const names = { energy: "体力" };
    const out = [];
    for (const k of ["energy"]) {
      if (st[k]) out.push(`${names[k]} ${st[k] > 0 ? "+" : ""}${Math.round(st[k])}`);
    }
    if (!out.length) return "";
    return (all ? "全员 " : "") + out.join("、");
  },

  /* 打出一张行动卡。targetId：target==="one" 时必填。
     返回 { ok, reason, tip, name, icon, text } —— text 为给玩家的反馈文案。 */
  useAction(actionId, targetId) {
    const c = this.cfg, s = this.state;
    const a = this.actionById(actionId);
    if (!a) return { ok: false, reason: "no_action", tip: "卡片不存在" };
    const stt = this.actionState(a);
    if (!stt.ok) return stt;

    // 目标工程师校验
    let target = null;
    if (a.target === "one") {
      target = s.engineers.find((e) => e.id === targetId);
      if (!target) return { ok: false, reason: "need_target", tip: "请先选择工程师" };
      if (target.resigned) return { ok: false, reason: "resigned", tip: "该工程师已离职" };
      this.ensureStatus(target);
      if (a.oncePerRound && (s.actionLog || []).some((x) => x.id === a.id && x.targetId === targetId)) {
        return { ok: false, reason: "once", tip: "本双周已对该人使用过" };
      }
    }

    // 经费（含依赖目标的动态成本）
    let cost = a.cost || 0;
    if (a.costOf === "salary3" && target) cost = (target.salary || 0) * 3;
    if (a.costOf === "halfSalary" && target) cost = (target.salary || 0) * 6;
    if (cost > 0) {
      if (s.funding < cost) return { ok: false, reason: "no_fund", tip: "经费不足" };
      s.funding -= cost;
    }

    const parts = [];

    // ① 复用既有核心方法（辞退，P0-b 已实装，保证单一逻辑源）
    /* 2026-09-06：via === "comfort" 分支已随慰问功能一并删除 */
    if (a.via === "fire") {
      const r = this.fire(targetId);
      if (!r.ok) {
        if (cost > 0) s.funding += cost;
        return { ok: false, reason: r.reason,
          tip: r.reason === "min_keep" ? "不能辞退最后一名工程师" : "无法辞退" };
      }
      parts.push(`已辞退${r.name}，赔付 ${Math.round(r.severance / 10000)}万`);
    } else {
      // ② 能力数值（受 CAP 封顶）；条件达成时替换为 bonusIf 的效果
      let eff = a.effects;
      // 条件达成时替换为 bonusIf 的效果（新增 safetyBelow；原仅支持 stabilityBelow）
      if (a.bonusIf) {
        const w = a.bonusIf;
        const key = w.stat || (w.when === "stabilityBelow" ? "stability" : w.when === "safetyBelow" ? "safety" : null);
        if (key && s[key] < (w.val != null ? w.val : 50)) eff = w.effects;
      }
      if (eff) {
        this.applyEffects(eff, s);
        const t = this.effectsText(eff);
        if (t) parts.push(t);
      }
      // ③ 随机数值（用户 2026-08-28 指定：送外培训 = 随机增加某个数值 +N）
      if (a.randomStat) {
        const keys = this.baseDims();
        const k = keys[Math.floor(Math.random() * keys.length)];
        const cap = this.statCap();
        s[k] = Math.min(this.statLimit(k, cap), Math.max(0, s[k] + a.randomStat));
        parts.push(`${this.statLabel(k)} +${a.randomStat}`);
      }
      // ④ 冲参数规模（受算力档位上限约束）
      if (a.paramUp) {
        const order = c.TARGET_PARAMS || [];
        const ci = order.indexOf(s.paramTarget);
        const ni = Math.min(order.length - 1, ci + (a.paramUp || 1));
        const maxP = (c.GPU_TIERS[s.gpuTier] || {}).maxParam;
        if (ci >= 0 && ni > ci && order[ni] <= (maxP || 0)) {
          s.paramTarget = order[ni];
          parts.push(`目标参数 → ${order[ni]}B`);
        } else {
          parts.push("参数已到算力上限");
        }
      }
      // ⑤ 工程师状态：本人 / 全员 / 其余人
      if (a.stats && target) {
        for (const k of ["energy"]) {
          if (a.stats[k]) target[k] = this.clampNum(target[k] + a.stats[k], 0, 100);
        }
        const t = this.statsText(a.stats);
        if (t) parts.push(t);
      }
      if (a.allStats) {
        for (const e of s.engineers) {
          if (e.resigned) continue;
          this.ensureStatus(e);
          for (const k of ["energy"]) {
            if (a.allStats[k]) e[k] = this.clampNum(e[k] + a.allStats[k], 0, 100);
          }
        }
        const t = this.statsText(a.allStats, true);
        if (t) parts.push(t);
      }
      if (a.othersStats && target) {
        for (const e of s.engineers) {
          if (e.resigned || e.id === target.id) continue;
          this.ensureStatus(e);
          for (const k of ["energy"]) {
            if (a.othersStats[k]) e[k] = this.clampNum(e[k] + a.othersStats[k], 0, 100);
          }
        }
        parts.push("其余人体力 " + (a.othersStats.energy > 0 ? "+" : "") + a.othersStats.energy);
      }
    }

    // ⑥ 本轮成长倍率（s.eff_boost —— ⚠️ 当前无人消费，见 doc/27 §14 的空头承诺清单）
    if (a.effBoost) {
      s.eff_boost = (s.eff_boost || 0) + a.effBoost;
      parts.push(a.effBoost > 0 ? `本轮成长 +${Math.round(a.effBoost * 100)}%` : `本轮成长 ${Math.round(a.effBoost * 100)}%`);
    }

    // ⑦ 扣 AP + 记账
    s.ap = (s.ap || 0) - (a.ap || 1);
    s.actionLog = s.actionLog || [];
    s.actionLog.push({ id: a.id, name: a.name, targetId: targetId || null, targetName: target ? target.name : null });

    return { ok: true, name: a.name, icon: a.icon, cost,
      text: parts.filter(Boolean).join("、") };
  },

  /* ---------------- 阶段化能力上限（用户 2026-08-28：每阶段 ×2，不受 100 限制）----------------
     实际上限 = round(CAP_BY_VER[阶段] × PARAM_CAP_MUL[目标参数规模])
     阶段决定量级（V1:60 → V4:480），参数规模做乘区（7B×1.0 → 70B×1.5）。
     所有需要封顶的地方（微调 / 基础训练 / 行动卡 / 灵感爆发 / 事件结算 / 报告提示）统一走这里。 */
  /* ---------------- 能力维度（P0 · 2026-09-10 · doc/27）----------------
     全项目四维真源 = v35_core.js 的 V35.dimsOf / V35.dimObj。
     本文件禁止再出现 ["code","text","safety","stability"] 字面量；
     追加能力轴（记忆/推理/工具）接入后这里自动带上，调用方无需再改。 */
  dimsOf(s) { return window.V35.dimsOf(s || this.state); },   // 本模型维度 = 基础四维 + 本模型激活轴（展示/遍历/评审口径）
  v35AxisIds(s) { return window.V35.activeAxes(s || this.state); },   // 本模型激活的追加轴（UI 判断"是不是轴"用）
  /* 轴的定义（名称 / 图标 / 配色 / 说明 / 达标线），UI 统一从这里取，不要在界面里写死轴名。
     第二个参数传阶段时附带该阶段的门槛（cap/pass），不传就只给静态定义。 */
  axisDef(id, ver) {
    const source = (((this.cfg.V35 || {}).AXES || {}).DEF || {})[id] || {};
    const d = source.name ? Object.assign({}, source, { name: this.statLabel(id) }) : source;
    if (!d.source) return d;
    if (!ver) return d;
    /* 2026-09-24：达标线显示与评审**同尺** —— 线按参数档缩放（cap 已随参数档缩放，
       线不缩会「线高于上限」）。⚠️ 内联实现：这里曾挂过 `this.axisPassAt(ver,id)`，
       但方法定义没落盘、调用留下 ⇒ 一进评审页就 TypeError 崩整个 UI（玩家实测「闪退」）。
       别再抽方法——要么内联，要么先加方法再加调用。 */
    const _ap = window.V35.axisPass(ver, id);
    const _sc = window.V35.lineScale ? window.V35.lineScale(ver, (this.state || {}).paramTarget) : 1;
    return Object.assign({}, d, {
      capAt: window.V35.axisCap(ver, id, (this.state || {}).paramTarget),   // UI 显示的上限要跟当前参数档一致
      passAt: typeof _ap === "number" ? Math.round(_ap * _sc) : _ap,
    });
  },
  baseDims() { return window.V35.DIM_ORDER; },                // 基础四维：成长环 / 随机泛化加维用（轴不走这两条渠道）
  newDims(v) { return window.V35.dimObj(v); },                // 容器形状：基础四维 + 所有轴（值 0）
  newBaseDims(v) { return window.V35.dimObj(v, window.V35.DIM_ORDER); },
  /* 工程师「潜力属性」= **三维 code / algo / text**（与界面显示一致）——
     与「模型能力维度」同名不同义，**勿混用 dimsOf**。
     ⚠️ 2026-09-10 两轮修订：
       ① 本表原写作 ["code","text","safety","stability"]（= 模型四维），但工程师档案里
          根本没有 safety / stability；培训的「低值加权」又把"不存在的键(=0)"当成最缺，
          → 约 2/3 培训费写进无人读取的字段，且 algo（预训练/后训练升级唯一依据）永远抽不到。
       ② 用户拍板：**精力 energy 与 协作 coop 彻底删除** —— 字段 / 49 份档案 / 培训池 /
          事件条件(coop_below,coop_above)与效果(eff.coop) / 界面展示 全部清除 → 只剩三维。
     三维 = 词条升级的全部依据：algo → 预训练·后训练；code + text → 数据。
     初始体力不再来自属性，固定 ENG_STATUS.ENERGY_INIT（100）。 */
  ENG_STAT_KEYS: ["code", "algo", "text"],
  engStatKeys(e) {return e&&(e.type==="embodied"||this.primaryTraitType(e)==="embodied")?["code","algo","engineering"]:this.ENG_STAT_KEYS.slice();},
  healEngineeringTalent(e) {
    if(!e||!this.engStatKeys(e).includes("engineering"))return e;
    e.stats=e.stats||{};
    if(e.stats.engineering==null){const old=Number(e.stats.text);e.stats.engineering=Number.isFinite(old)?old:70;}
    e.stats.engineering=Math.max(0,Math.min(100,Math.round(Number(e.stats.engineering)||0)));
    delete e.stats.text;
    return e;
  },

  statCap() {
    const c = this.cfg, s = this.state;
    const base = (c.CAP_BY_VER || {})[s.ver || "V1"] || 60;
    const mul = (c.PARAM_CAP_MUL || {})[s.paramTarget] || 1;
    const n = Math.round(base * mul);
    const cap = this.newDims(n);
    /* 追加轴（doc/27 P2）：上限与四维**同口径**（2026-09-13 用户拍板）——
       AXES.DEF[*].capByVer 是「倍率 1.0 的基准值」，同样乘 PARAM_CAP_MUL。
       未激活的轴不动（它恒为 0）。 */
    for (const id of (window.V35.activeAxes(s) || [])) {
      const v = window.V35.axisCap(s.ver || "V1", id, s.paramTarget);
      if (v != null) cap[id] = v;
    }
    return cap;
  },

  /* 原字段的当前可用上限；V5 两组源字段各自可用同一组剩余预算。 */
  statLimit(key, caps, stats) {
    return window.V35.statLimit(this.state, key, caps || this.statCap(), stats || this.state);
  },

  /* ==========================================================================
     论文效果汇总（2026-09-13 实装）
     --------------------------------------------------------------------------
     · 权威数据 = `s.papersOwned`（已掌握论文列表，元素为**数字 no**，跨阶段保留）
     · 效果**实时从配置查**（不存快照）⇒ 以后改数值立即生效、无需迁移存档
     · 叠加规则：**概率类相加 / 倍率类相乘 / 加分类相加**
     返回形状（引擎 v35_core 每 tick 读一次 st.paperFx）：
       { extraRoll:  {all,pre,data,post},       // 该岗位「额外多产一次」的概率（相加）
         dimBonus:   {code,text,…,tool},        // 该维度每次产出额外 +N（相加）
         roleEnergy: {pre,data,post},           // 该岗位体力消耗倍率（相乘）
         axisAmp:    {memory,reasoning,tool},   // 该轴单次产出倍率（相乘）
         axisRate:   {memory,reasoning,tool},   // 该轴触发概率增量（相加）
         focusAdd:   number }                   // 攻关倍率增量（相加）
     ========================================================================== */
  paperEffects() {
    const c = this.cfg, s = this.state;
    const out = { extraRoll: {}, dimBonus: {}, roleEnergy: {}, axisAmp: {}, axisRate: {}, focusAdd: 0 };
    const pool = (c.PAPER || {}).POOL || [];
    for (const raw of (s.papersOwned || [])) {
      const no = this.paperNoOf(raw);
      if (no == null) continue;
      const p = pool.find((x) => x.no === no);
      if (!p || !p.effect) continue;
      const e = p.effect;
      switch (e.kind) {
        case "extra_roll": {
          const k = e.scope || "all";
          out.extraRoll[k] = (out.extraRoll[k] || 0) + (e.prob || 0);
          break;
        }
        case "dim_bonus":
          if (e.dim) out.dimBonus[e.dim] = (out.dimBonus[e.dim] || 0) + (e.add || 0);
          break;
        case "role_energy": {
          const r = e.role || "pre";
          out.roleEnergy[r] = (out.roleEnergy[r] || 1) * (e.mul != null ? e.mul : 1);
          break;
        }
        case "axis_amp":
          if (e.axis) out.axisAmp[e.axis] = (out.axisAmp[e.axis] || 1) * (e.mul != null ? e.mul : 1);
          break;
        case "axis_rate":
          if (e.axis) out.axisRate[e.axis] = (out.axisRate[e.axis] || 0) + (e.add || 0);
          break;
        case "focus_mul":
          out.focusAdd += (e.add || 0);
          break;
        default:
          /* 旧 kind（text_prob / data_speed）由 v35_core 直接读 st.paper 处理，这里不汇总 */
          break;
      }
      /* 轴「附赠」（旧字段 effect.axis + axisProb）：与 kind 并存，一并计入触发概率 */
      if (e.axis && e.axisProb) out.axisRate[e.axis] = (out.axisRate[e.axis] || 0) + e.axisProb;
    }
    return out;
  },
  /* 论文引用统一走数字 no（doc/32 §0：ID 与内容解耦）。
     ⚠️ 全项目**禁止**用字符串 id 比较（POOL 里已经没有 `id` 字段了）——
        读引用先过 paperNoOf()，写引用一律写 POOL[].no。 */
  paperNoOf(v) {
    if (typeof v === "number") return v;
    /* 数字字符串 → 数字 no（2026-09-16 修「找不到这篇论文」）：UI 点击链路
       paper-pick 传的是 dataset.id（"4002"），不认的话 omPaperPick 原样存字符串、
       startPaper 一路传到底 → paperOf 返回 null 报错，且选中态（=== p.no）永远丢失 */
    if (typeof v === "string" && /^\s*\d+\s*$/.test(v)) return +v.trim();
    const map = (this.cfg.PAPER || {}).LEGACY_NO || {};
    if (v != null && map[v] != null) return map[v];
    /* 位置键（V1.5_paper / opt_scaling）也认，方便调试与旧代码过渡 */
    const p = ((this.cfg.PAPER || {}).POOL || []).find((x) => x.key === v);
    return p ? p.no : null;
  },
  /* no（或任何旧写法）→ 论文对象；找不到返回 null */
  paperOf(v) {
    const no = this.paperNoOf(v);
    if (no == null) return null;
    return ((this.cfg.PAPER || {}).POOL || []).find((x) => x.no === no) || null;
  },
  /* 是否已掌握（两侧都规整成 no，旧档字符串照样命中） */
  hasPaper(v) {
    const no = this.paperNoOf(v);
    if (no == null) return false;
    return (this.state.papersOwned || []).some((x) => this.paperNoOf(x) === no);
  },

  /* ---- 事件引用统一走数字 no（doc/32 §8，2026-09-13）----
     ⚠️ 事件表 37 条之间**没有任何互相引用**（没有 when.after / 没有链式 next）——
        id 只出现在三处：① 存档（triggered / _evtOnce / _evtLastAt / pendingEvent）
        ② 代码对少数几个事件的硬查 ③ UI 传参。所以这里只要「规范化 + 按 key 查」。
     · 读引用（可能是旧档字符串）→ evNoOf()；写引用一律写 ev.no；
     · 代码里查特定事件 → evByKey("V35_POACH")（key = 原 id 字符串，稳定可读，不抄编号）；
     · evList() = EVENTS + 独立的系统事件 RECRUIT_WAIT_EVENT（E101）。 */
  evList() {
    const c = this.cfg;
    const out = (c.EVENTS || []).slice();
    if (c.RECRUIT_WAIT_EVENT) out.push(c.RECRUIT_WAIT_EVENT);
    return out;
  },
  evNoOf(v) {
    if (typeof v === "number") return v;
    const map = this.cfg.EVENTS_LEGACY_NO || {};
    if (v != null && map[v] != null) return map[v];
    const e = this.evList().find((x) => x.key === v);
    return e ? e.no : null;
  },
  evKeyOf(v) {
    if (typeof v !== "number") return v;
    const e = this.evList().find((x) => x.no === v);
    return e ? e.key : null;
  },
  evByNo(v) {
    const no = this.evNoOf(v);
    return no == null ? null : (this.evList().find((e) => e.no === no) || null);
  },
  evByKey(k) { return this.evList().find((e) => e.key === k) || null; },

  /* The embodied era has its own ordinary stories. Financial rescue, proposals
     and waiting for recruitment remain available through their system paths. */
  eventEligibleForStage(ev, state) {
    if (!ev || ev.enabled === false) return false;
    const s = state || this.state, order = this.cfg.VER_ORDER || [], ver = s.ver || "V1";
    if (Array.isArray(ev.stages) && ev.stages.length && !ev.stages.includes(ver)) return false;
    if (ev.minVer && order.indexOf(ev.minVer) > order.indexOf(ver)) return false;
    const late = this.embodiedAvailable(s);
    if (!late) return ev.era !== "embodied";
    if (ev.special || ev.type === "recruit_wait" || ev.key === "E101") return true;
    if (ev.era !== "embodied") return false;
    return !ev.requiresBody || !!(s.embodiedEra && s.embodiedEra.bodyAwakened && s.embodiedEra.podExitSeen);
  },
  retireLegacyMinigame(state) {
    const s = state || this.state;
    if (!this.embodiedAvailable(s)) return false;
    const legacy = kind => ["sft", "rm"].includes(String(kind || "").toLowerCase());
    let cleared = false;
    if (legacy(s.pendingMinigame)) { s.pendingMinigame = null; cleared = true; }
    if (s.minigame && legacy(s.minigame.kind)) {
      const wasPaused = s._mgWasPaused;
      s.minigame = null; s._mgWasPaused = null; cleared = true;
      if (s.officeModal === "minigame") s.officeModal = null;
      if (window.OfficePause) OfficePause.releaseSource(this, "inspection");
      else s.officePaused = !!wasPaused;
    }
    return cleared;
  },
  healStageEvents() {
    const s = this.state;
    const allowed = p => p && this.eventEligibleForStage(this.evByNo(p.no != null ? p.no : p.id), s);
    if (s.pendingEvent && !allowed(s.pendingEvent)) s.pendingEvent = null;
    if (Array.isArray(s.pending)) s.pending = s.pending.filter(allowed);
    this.retireLegacyMinigame(s);
  },

  /* 论文效果 → 玩家看得懂的一句话（**唯一实现**，doc/32 §9）。
     · game_ui 的论文卡片 / 结算提示都走这里；
     · 论文页有一份同源副本（`editor/js/gameCfgTool.js` 的 paperEffectText），
       test_editor_cfg.js 有断言逐篇比对两者 —— 改这里必须同步改那边。
     ⚠️ 2026-09-13 补：新增的 6 种 kind（extra_roll / dim_bonus / role_energy /
        axis_amp / axis_rate / focus_mul）以前**没有分支** ⇒ 论文面板 12/14 篇显示「—」
        （玩家根本看不到效果），role_energy 还会落进 `if (e.mul)` 被写成「基础训练效率 +-15%」。
     ⚠️ 效果数值一律从 effect 里读，**不许写进标题/简介**（改文案不影响玩法）。 */
  paperEffectText(p) {
    const c = this.cfg, e = p && p.effect;
    if (!e) return "—";
    const V = c.V35 || {};
    const pct = (x) => Math.round((x || 0) * 100) + "%";
    const ROLE = { pre: "预训练", data: "数据", post: "后训练" };
    const DIM = { code: "代码", text: "文字", safety: "安全", stability: "稳定",
                  memory: "记忆", reasoning: "推理", tool: "工具" };
    const roleOf = (r) => ROLE[r] || r || "";
    /* [feature:paper-effect-configured-axis-name] */
    const dimOf = (d) => DIM[d] || this.statLabel(d) || d || "";
    /* [/feature:paper-effect-configured-axis-name] */
    switch (e.kind) {
      /* ① 效率类：按概率「再产一次」等价于缩短间隔，且不动 TICK_S */
      case "extra_roll": {
        const who = e.scope && e.scope !== "all" ? roleOf(e.scope) + "岗" : "三个岗位";
        return who + "每次产出有 " + pct(e.prob) + " 概率再多产一次（永续）";
      }
      /* ② 单维度每次产出 +N（整数，玩家可感知） */
      case "dim_bonus":
        return "每次产出「" + dimOf(e.dim) + "」额外 +" + (e.add != null ? e.add : 1) + "（永续）";
      /* ③ 某岗位体力消耗下降 */
      case "role_energy": {
        const m = e.mul != null ? e.mul : 1;
        return roleOf(e.role) + "岗体力消耗 " + (m <= 1 ? "−" : "+") +
               Math.abs(Math.round((m - 1) * 100)) + "%（永续）";
      }
      /* ④ 轴：单次产出倍率 / 触发概率增量 / 维度加分 */
      case "axis_amp":
        return "「" + dimOf(e.axis) + "」轴单次产出 ×" + (e.mul != null ? e.mul : 1) + "（永续）";
      case "axis_rate":
        return "「" + dimOf(e.axis) + "」轴触发概率 +" + pct(e.add) + "（永续）";
      case "axis_add":
        return "「" + dimOf(e.axis) + "」轴每次触发额外 +" + (e.add != null ? e.add : 1) + "（永续）";
      /* ⑤ 攻关倍率增量（focus_mul 与 FOCUS_MUL 相加） */
      case "focus_mul": {
        const base = V.FOCUS_MUL != null ? V.FOCUS_MUL : 1.5;
        const add = e.add != null ? e.add : 0;
        return "攻关加成 +" + add + "（" + base + " → " + Math.round((base + add) * 100) / 100 + "，永续）";
      }
      /* ---- 以下 4 种是旧口径（v1.5/v3 的论文在用），保留原措辞与口径 ---- */
      case "text_prob": {
        const prob = V.PAPER_TEXT_PROB != null ? V.PAPER_TEXT_PROB : (e.prob != null ? e.prob : 0.1);
        const add = V.PAPER_TEXT_ADD != null ? V.PAPER_TEXT_ADD : (e.add != null ? e.add : 1);
        return "文字能力增长时 " + pct(prob) + " 概率 +" + add + "（永续）";
      }
      case "data_speed": {
        const m = e.mul != null ? e.mul : (V.PAPER_DATA_SPEED_MUL != null ? V.PAPER_DATA_SPEED_MUL : 1.1);
        return "数据工程师语料产量 +" + Math.round((m - 1) * 100) + "%（永续）";
      }
      case "energy":
        return "研发体力消耗 −" + Math.abs(Math.round((1 - (e.mul != null ? e.mul : 1)) * 100)) + "%（永续）";
      case "prod": {
        const m = e.mul != null ? e.mul : 1;
        return (e.dim === "all" || !e.dim ? "全能力" : dimOf(e.dim)) + "产出效率 +" +
               Math.round((m - 1) * 100) + "%（永续）";
      }
      default:
        return e.mul != null ? "基础训练效率 +" + Math.round((e.mul - 1) * 100) + "%" : "—";
    }
  },
  /* 当前阶段评审线（2026-09-13 用户拍板 C 方案「双线制」）。
     ---------------------------------------------------------------
     **唯一真源 = V35.REVIEW.BY_VER[阶段]**（玩法配置 → 评审 可逐项改）：
       · MIN_DIM      四维达标线    ← 「8 人全 lv3、无论文」实测产出 × 0.9
       · AXIS_MIN     轴防偏科线    ← 与 MISSIONS.BY_VER[*].axisMin 同源（配置自动联动）
       · GREAT_SCORE  优秀线（总分）← 「8 人全 lv5、论文叠满」实测总分 × 0.95
     ⚠️ 为什么不再用「上限 × 60% / 75%」：词条 lv3 的产出档位是 [3,6]、lv5 是 [5,12]，
        全队 lv3 天然只发挥约 55% —— 同一根按满编高中档标定的线，lv3 永远摸不到。
     ⚠️ 为什么不再按参数倍率缩放：每个阶段的 (架构,参数) 由 MISSIONS.BY_VER 钉死，
        标准就按那套组合标定 ——「挑个小参数混过去」不再成立。
     ⚠️ 架构 `passMul` 同日起退役：架构特征已经含在实测值里，再乘一次是重复计算。
     ⚠️ 这个返回值同时喂 UI（达标线展示 / 轴胶囊 / 顶尖线 topLine）与 evaluate() 的 checks，
        必须与 v35_core.review() 读的 MIN_DIM / AXIS_MIN / GREAT_SCORE **完全同源** ——
        否则就是用户骂过的「显示一条线、判定另一条线」。V1 教学关的豁免值也直接取 BY_VER.V1。 */
  passLine() {
    const c = this.cfg, s = this.state;
    if (!this.v35On()) return (c.PASS_BY_VER || {})[s.ver || "V1"] || c.PASS;
    const R = c.V35.REVIEW || {};
    const per = (R.BY_VER || {})[s.ver || "V1"] || {};
    /* 2026-09-24：线按参数档缩放（V35.lineScale，唯一实现在 v35_core）——
       暂缓主线后用小参数重训时，上限变小、线若停在原位会超过上限（物理上不可能通过）。
       钉死组合 scale=1 ⇒ 既有行为与全部既有断言逐位不变。 */
    const sc = (window.V35 && window.V35.lineScale) ? window.V35.lineScale(s.ver || "V1", s.paramTarget) : 1;
    const scMap = (o) => {
      const out = {};
      Object.keys(o || {}).forEach((k) => { out[k] = Math.round((o[k] || 0) * sc); });
      return out;
    };
    const m0 = scMap(per.MIN_DIM || R.MIN_DIM || { code: 18, text: 22, safety: 7, stability: 7 });
    const g0 = per.GREAT_SCORE != null ? per.GREAT_SCORE
      : (R.GREAT_SCORE != null ? R.GREAT_SCORE : 29);
    return { minParam: 7, code: m0.code, text: m0.text, safety: m0.safety,
             stability: m0.stability, score: Math.round(g0 * sc), axMin: scMap(per.AXIS_MIN || {}) };
  },
  /* 词条升级（用户 2026-08-29：前期唯一途径 = 进入下一阶段时按天赋概率升级。
     事件/行动卡不再提供词条 +1 奖励；双周循环内也不再概率升级）。
     属性（潜力）≥ 阈值时，对应词条有概率升一级；「干劲十足」的 traitProbBoost 在此消费。 */
  /* ================= 阶段结算 · 词条按天赋概率升级 =================
     （2026-09-04 三幕结算改造）返回结构化数组 [{id, name, type, trait, from, to}]，
     第三幕「工程师成长 · 词条升级」卡直接渲染；无升级 = 空数组 → 面板整体隐藏。 */
  upgradeTraitsByTalent() {
    const c = this.cfg, s = this.state;
    const maxLv = (c.STAGE_TRAIT_MAX || {})[s.ver || "V1"] || 5;
    const U = c.TRAIT_UPGRADE || {};
    /* 门槛：只认新配置 TRAIT_UPGRADE（旧键已删）。缺失时硬编码下限，防配置被清空。 */
    const minStat = U.MIN_STAT != null ? U.MIN_STAT : 70;
    /* 学术词条（2026-09-09）：自身不升级，只给同一位工程师的「其它词条」加算升级概率。
       多枚学术词条取最高（不叠加）；等级 → 加算值见 TRAIT_UPGRADE.ACADEMIC_BOOST。 */
    const ABOOST = U.ACADEMIC_BOOST || [];
    const academicBoostOf = (eng) => {
      let b = 0;
      for (const t of eng.traits || []) {
        if (t.type !== "academic") continue;
        const v = ABOOST[Math.min(Math.max(0, (t.level || 1) - 1), ABOOST.length - 1)] || 0;
        if (v > b) b = v;
      }
      return b;
    };
    this.healEngineerRoles();              // 在任何技能升级前固定缺失的主职业
    const upgrades = [];
    for (const e of s.engineers) {
      if (e.resigned) continue;
      /* 2026-09-12 用户定：词条等级上限还要再叠一层「天赋档天花板」——
         一般 / 良好 最高 Lv3、优秀 最高 Lv4、天才 / 大牛 最高 Lv5。
         没有这一层，一个「一般」的人练几段就变 lv5，「天赋一般的最高只到 lv3」这条规则等于没生效。 */
      const engMaxLv = Math.min(maxLv, this.talentLvCap(e));
      const ab = academicBoostOf(e);
      const main = this.mainTrait(e);
      const ordered = main && (e.traits || []).includes(main)
        ? [main].concat((e.traits || []).filter((t) => t !== main)) : (e.traits || []);
      for (const t of ordered) {
        if (t.level >= engMaxLv) continue;
        /* 依据属性：新配置是数组（可多选）；旧配置是单值或 "duo"（代码+文字）。
           2026-09-05：新配置存在时，**没配规则的类型（如学术自身）一律不再升级**—— */
        const rule = (U.traits || {})[t.type] || null;
        if (!rule) continue;                      // 没配升级规则的类型（含学术自身）不再升级
        const keys = rule.stats || [];
        if (!keys.length) continue;
        /* 多选：每一项都要 ≥ 门槛；分子 = 各项平均值 */
        let sum = 0;
        let ok = true;
        for (const k of keys) {
          const v = e.stats ? (e.stats[k] || 0) : 0;
          if (v < minStat) { ok = false; break; }
          sum += v;
        }
        if (!ok) continue;
        const statVal = sum / keys.length;
        /* 除数按等级取：div[i] 用于 Lv(i+1) → Lv(i+2)；越界则用最后一个（不再升级或保持最难） */
        const divs = (rule.div && rule.div.length) ? rule.div : [900, 1200, 1500, 1800];
        const divisor = divs[Math.min(Math.max(0, t.level - 1), divs.length - 1)];
        let prob = statVal / divisor;
        prob += ab;                          // 学术加成（加算，作用于「其它词条」）
        if (s.traitProbBoost) prob *= 1.5;   // 灵感迸发：词条升级概率 ×1.5
        if (Math.random() < prob) {
          const from = t.level;
          t.level += 1;
          upgrades.push({ id: e.id, name: e.name, type: t.type, trait: this.traitName(t.type), from, to: t.level });
        }
      }
    }
    s.traitProbBoost = false;
    return upgrades;
  },

  /* 词条升级概率（供 UI/预览与文案复用，口径与 upgradeTraitsByTalent 完全一致）。
     academicBoost：该工程师身上学术词条带来的加算值（可选，作用于「其它词条」）。 */
  traitUpgradeProb(type, level, statVal, academicBoost) {
    const c = this.cfg;
    const U = c.TRAIT_UPGRADE || {};
    const rule = (U.traits || {})[type];
    const divs = (rule && rule.div && rule.div.length) ? rule.div : [900, 1200, 1500, 1800];
    const di = Math.min(Math.max(0, (level || 1) - 1), divs.length - 1);
    return (statVal || 0) / divs[di] + (academicBoost || 0);
  },
  /* 学术词条加算值：等级 → TRAIT_UPGRADE.ACADEMIC_BOOST（供 UI 文案/预览复用） */
  academicBoostOf(level) {
    const c = this.cfg;
    const B = ((c.TRAIT_UPGRADE || {}).ACADEMIC_BOOST) || [];
    if (!B.length) return 0;
    return B[Math.min(Math.max(0, (level || 1) - 1), B.length - 1)] || 0;
  },
  /* 词条升级依据的属性键（数组，可多选） */
  traitUpgradeStats(type) {
    const c = this.cfg;
    const U = c.TRAIT_UPGRADE || {};
    const rule = (U.traits || {})[type];
    return (rule && rule.stats && rule.stats.length) ? rule.stats.slice() : [];
  },
  traitUpgradeMinStat() {
    const c = this.cfg;
    const U = c.TRAIT_UPGRADE || {};
    return U.MIN_STAT != null ? U.MIN_STAT : 70;
  },

  /* （V3.5.2：paramLimitByTraits 已删除——词条不限制参数档，参数只受算力+语料限制） */


  /* 词条展示名：**优先读配置 `TRAIT_META`**（doc/27 §6.3.2 单一真源），缺失再走旧硬编码兜底。
     2026-09-11：core 侧原来还是硬编码 —— 与 `game_ui.traitName` 形成**两处真源**，
     改配置只改一边就会出现"面板和日志叫法不一样"。现在两边都以配置为准。 */
  traitName(t) {
    const m = (((this.cfg || {}).TRAIT_META || {})[t] || {}).name;
    if (m) return m;
    return { pretrain: "预训练", post: "后训练", academic: "学术", engineer: "工程", data: "数据", safety: "安全" }[t] || t;
  },

  /* ---------------- 灵感爆发（08 设计文档 §7） ----------------
     训练动画期间：随机 0~SPARK_MAX 名在职工程师「发光」；
     玩家点击 → 该工程师本轮贡献额外成长（按本轮成长量 × SPARK_BONUS，正成长保底 +1）。
     pickSparks 在动画开始时调用（只随机一次）；applySpark 在点击时结算，同一人一轮只可触发一次。 */
  pickSparks() {
    const c = this.cfg, s = this.state;
    const prob = c.SPARK_PROB != null ? c.SPARK_PROB : 0.4;
    const max = c.SPARK_MAX != null ? c.SPARK_MAX : 2;
    const active = s.engineers.filter((e) => !e.resigned);
    const picks = [];
    for (const e of active) {
      if (picks.length >= max) break;
      if (Math.random() < prob) picks.push(e.id);
    }
    return picks;
  },

  applySpark(engId) {
    const c = this.cfg, s = this.state;
    const e = s.engineers.find((x) => x.id === engId && !x.resigned);
    if (!e || !s.lastGrowth) return null;
    s.sparkUsed = Array.isArray(s.sparkUsed) ? s.sparkUsed : [];
    if (s.sparkUsed.includes(engId)) return null;
    const bonus = c.SPARK_BONUS != null ? c.SPARK_BONUS : 0.25;
    const cap = this.statCap();
    const names = { code: "代码", text: "文字", safety: "安全", stability: "稳定" };
    const parts = [];
    for (const k of this.baseDims()) {
      const g = s.lastGrowth[k] || 0;
      if (g <= 0) continue;   // 只有正成长才享受灵感加成
      const add = Math.max(1, Math.round(g * bonus));
      s[k] = Math.min(this.statLimit(k, cap), s[k] + add);
      s.lastGrowth[k] += add;
      parts.push(`${names[k]} +${add}`);
    }
    s.sparkUsed.push(engId);
    if (!parts.length) return { name: e.name, parts: [] };
    const line = `💡 ${e.name} 灵感爆发！${parts.join("、")}`;
    s.lastReport = (s.lastReport || "") + (s.lastReport ? "\n" : "") + line;
    return { name: e.name, parts };
  },

  /* ---------------- 事件触发 ---------------- */
  /* 通用条件判定（08 §9）：把"品牌/经费/能力/团队状态/词条/flag/后续链"全部收敛到 when，
     事件数据保持纯配置，新增事件不用再改引擎。
     avg：energy 读运行态体力（会衰减，才有经营压力）。 */
  matchWhen(when, ctx) {
    const s = this.state;
    const { week, active, avg } = ctx;
    if (when.week && (week < when.week[0] || week > when.week[1])) return false;
    const S = (k) => s[k] || 0;
    if (when.brand_at_least != null && !(S("brand") >= when.brand_at_least)) return false;
    if (when.funding_below != null && !(s.funding < when.funding_below)) return false;
    if (when.funding_at_least != null && !(s.funding >= when.funding_at_least)) return false;
    if (when.stat_any && !when.stat_any.some(([k, v]) => S(k) >= v)) return false;      // 或关系
    if (when.stat_all && !when.stat_all.every(([k, v]) => S(k) >= v)) return false;      // 与关系
    if (when.stat_below && !when.stat_below.some(([k, v]) => S(k) < v)) return false;
    if (when.avg) {
      for (const [k, v] of Object.entries(when.avg)) {
        if (k.endsWith("_below")) { if (!(avg(k.slice(0, -6), 70) < v)) return false; }
        else if (k.endsWith("_at_least")) { if (!(avg(k.slice(0, -9), 70) >= v)) return false; }
      }
    }
    if (when.someone) {
      for (const [k, v] of Object.entries(when.someone)) {
        const ok = k.endsWith("_below")
          ? active.some((e) => e[k.slice(0, -6)] < v)
          : active.some((e) => e[k.slice(0, -9)] >= v);
        if (!ok) return false;
      }
    }
    if (when.has_trait_any && !active.some((e) => e.traits.some((t) => when.has_trait_any.includes(t.type)))) return false;
    // 目标参数 > 算力档位能撑住的上限（V3.5.2：改查算力 maxParam，词条不再限参数）
    if (when.param_over_cap) {
      const maxP = (this.cfg.GPU_TIERS[s.gpuTier] || {}).maxParam || 7;
      if (!(s.paramTarget > maxP)) return false;
    }
    if (when.trait_count_at_least) {
      const need = when.trait_count_at_least;
      const n = active.reduce((a, e) => a + e.traits.filter((t) => t.type === need.type).length, 0);
      if (n < need.n) return false;
    }
    if (when.flag && !(s.flags && s.flags[when.flag])) return false;
    if (when.investor && !s.investor) return false;          // 投资人已入局才出现（C02）
    // 后续链：指定事件选了指定选项之后才可能出现（概率在选项的 set_flag_prob 里掷一次，避免重复掷骰）
    if (when.after) {
      const rec = s.triggered.filter((t) => t.id === when.after.ev).pop();
      if (!rec) return false;
      if (when.after.choice != null && rec.choice !== when.after.choice) return false;
    }
    return true;
  },

  /* 事件目标人解析（08 §9 团队线：按 pick 选出目标人，避免额外选人 UI）
     2026-09-04：lowest/highest_loyalty 与 lowest_morale 指向已移除的忠诚/干劲，
     统一回落到「体力最低/最高者」，旧配置不会失效（仍按状态最差/最好的人命中）。 */
  pickEventTarget(ev, active) {
  /* [feature:last-engineer-target] */
    if (!ev.pick || !active.length || this.poachEventBlocked(ev)) return null;
  /* [/feature:last-engineer-target] */
    const by = (k, dir) => [...active].sort((a, b) => (a[k] - b[k]) * dir)[0];
    /* 2026-09-04：离职/挖角风险事件，目标人就是触发风险的那一位（v35.riskWho） */
    if (ev.pick === "risk_who") {
      const st = this.state.v35 || {};
      const hit = active.find((e) => !e.resigned && e.id === st.riskWho);
      if (hit) return hit;
      return by("energy", 1);
    }
    if (ev.pick === "lowest_loyalty") return by("energy", 1);   // 废弃字段 → 回落到体力最低者
    if (ev.pick === "highest_loyalty") return by("energy", -1);
    if (ev.pick === "lowest_morale") return by("energy", 1);
    if (ev.pick === "random") return active[Math.floor(Math.random() * active.length)];
    return null;
  },

  triggerEvents() {
    const c = this.cfg, s = this.state;
    const week = s.week;
    const gpuIdx = c.GPU_TIER_ORDER.indexOf(s.gpuTier);
    const candidates = [];
    // 队伍平均（团队事件判定用）：energy 读运行态体力
    const active = s.engineers.filter((e) => !e.resigned);
    active.forEach((e) => this.ensureStatus(e));
    const avg = (k, def) => {
      if (!active.length) return def;
      const val = (e) => e[k];
      return active.reduce((a, e) => a + (val(e) != null ? val(e) : def), 0) / active.length;
    };
    const ctx = { week, active, avg };

  /* [feature:last-engineer-legacy-pool] */
    for (const ev of c.EVENTS) {
      if (this.poachEventBlocked(ev, s)) continue;
      if (!this.eventEligibleForStage(ev, s)) continue;
  /* [/feature:last-engineer-legacy-pool] */
      if (ev.type === "recruit_wait") continue;      // 仅由 requestRecruit 主动触发
      /* minVer：起效版本（VER_ORDER 顺序比较，与 v35 掷骰同口径） */
      if (ev.minVer && (c.VER_ORDER || []).indexOf(ev.minVer) > (c.VER_ORDER || []).indexOf(s.ver || "V1")) continue;
      /* ⚠️ 保密 / 对外曝光的阶段门槛**不在这里判**（2026-09-19 用户拍板）：
         这里以前读 PUBLIC_BY_VER，但本函数（triggerEvents）**全项目无调用方** ⇒
         那处配置是死的（改它不影响任何一局，2026-09-19 实测确认并退役）。
         真正生效的掷骰在 officeAdvanceV35 的事件块：对外事件靠**每个事件自己的
         `stages` 白名单**限定阶段（EVENTS[*].stages）。 */
      // 已触发 / 冷却：repeat 事件可重复出现，cooldown 控制再次出现的间隔周数
      const rec = s.triggered.filter((t) => t.id === ev.no).pop();
      if (rec && !ev.repeat) continue;
      if (rec && ev.cooldown != null && week - rec.week < ev.cooldown) continue;
      if (ev.when && !this.matchWhen(ev.when, ctx)) continue;

      let hit = null;
      if (ev.type === "team") {
        const cond = ev.cond || {};
        let ok = true;
        if (cond.energy_below != null && !(avg("energy", 70) < cond.energy_below)) ok = false;
        if (cond.energy_above != null && !(avg("energy", 70) > cond.energy_above)) ok = false;
        // 团队状态告急优先于随机事件（原 priority 4 最低，导致 E104「疲惫懈怠」几乎排不上队）
        if (ok && Math.random() < (ev.prob || 0.2)) hit = { ev, priority: 2.5 };
      } else if (ev.type === "fixed" || ev.type === "critical") {
        /* weekAtLeast（P2 2026-08-29）：节点事件（如 W8 模型测试）用「≥ 指定周」触发。
           用等值判断时，一旦周数被事件的 time_cost 推过 8 周，该事件就永远不会再出现。 */
        if (typeof ev.week === "number") {
          const hitWeek = ev.weekAtLeast ? (week >= ev.week) : (week === ev.week);
          if (hitWeek) hit = { ev, priority: ev.type === "critical" ? 0 : 1 };
        }
      } else if (ev.type === "news") {
        /* 行业新闻（P6）：保密期也可见（不是针对玩家的事件），优先级最低——
           有玩法事件时新闻让路，单独刷出来制造时代感。 */
        const w = ev.week || [0, c.TOTAL_WEEKS];
        if (week < w[0] || week > w[1]) continue;
        if (Math.random() < (ev.prob || 0.25)) hit = { ev, priority: 3.5 };
      } else if (ev.type === "random") {
        const w = ev.week || [0, c.TOTAL_WEEKS];
        if (week < w[0] || week > w[1]) continue;
        if (ev.trigger) {
          if (ev.trigger.gpu_at_least && gpuIdx < c.GPU_TIER_ORDER.indexOf(ev.trigger.gpu_at_least)) continue;
          if (ev.trigger.target_param_at_most && s.paramTarget > ev.trigger.target_param_at_most) continue;
        }
        if (Math.random() < (ev.prob || 0.2)) hit = { ev, priority: 3 };
      } else if (ev.type === "reward") {
        const t = ev.trigger;
        if (t && t.stat && !(s[t.stat] >= t.min)) continue;
        hit = { ev, priority: 2 };
      }
      if (hit) candidates.push(hit);
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.priority - b.priority);
    const picked = candidates[0].ev;
    // 需要"某个人"的事件：解析目标人后随事件带给 UI（文案里的 {name} 占位符）
    const target = this.pickEventTarget(picked, active);
    return target ? { ...picked, targetId: target.id, targetName: target.name } : picked;
  },

  /* 应用事件选项效果（单点结算：能力/经费/品牌/时间/算力/连锁/团队）
     特殊：E101 等待招聘 → 结算后按当前阶段重刷候选人 */
  applyEventOption(evId, optIdx) {
    const c = this.cfg, s = this.state;
    const ev = this.evByNo(evId);
    if (!ev) return null;
    if (!this.eventEligibleForStage(ev, s)) {
      this.healStageEvents();
      return { ok: false, retired: true, tip: "这个事件已随阶段退役，不会再触发" };
    }
    const opt = ev.options[optIdx];
    if (!opt) return null;
  /* [feature:last-engineer-pending-poach] */
    let eff = opt.effects || {};
    this._staffGuardTip = null;
    this.clearLonePoachRisk(s);
    /* 卡片入队后可能已辞退/离职；以结算当下人数为准，取消旧挖角并放行办公室。 */
    if (this.poachEventBlocked(ev, s)) {
      s.pending = [];
      s.pendingEvent = null;
      s.officePaused = false;
      s._evTarget = null;
      s._evVisitor = null;
      return { tip: "团队至少需要保留一名工程师，这次挖角已取消" };
    }
  /* [/feature:last-engineer-pending-poach] */
    const salaryCheck = this.eventOptionStatus(opt, evId);
    if (!salaryCheck.ok) return { ok: false, tip: salaryCheck.tip };
    // 目标人（"有人想离职"等事件由 pick 选出）：从 pending 取出，供 target_* 效果结算
    const _no = this.evNoOf(evId);
    /* 2026-09-16 修 BUG：V3.5 办公室事件只入 s.pendingEvent（不入 s.pending），
       找不到时补查 pendingEvent —— 否则 _evTarget 永远 null（目标错位根源之二）。 */
    const pend = (s.pending || []).find((p) => this.evNoOf(p.no != null ? p.no : p.id) === _no)
      || (s.pendingEvent && this.evNoOf(s.pendingEvent.id) === _no ? s.pendingEvent : null);
    s._evTarget = pend && pend.targetId ? pend.targetId : null;
    // X6：上门自荐的大牛（V_REFER）——招人时按这个 id 建卡
    s._evVisitor = (pend && pend.visitorId) || (s.pendingVisitor && s.pendingVisitor.id) || null;
  /* [feature:last-engineer-event-tip] */
    const applied = this.applyEffects(eff, s);
    if (this._staffGuardTip) eff = Object.assign({}, eff, { tip: this._staffGuardTip });
    this._staffGuardTip = null;
    s._evTarget = null;
    s._evVisitor = null;
  /* [/feature:last-engineer-event-tip] */
    if (applied && applied.ok === false) return applied;
    const _isWait = this.evKeyOf(evId) === "E101";     // 系统事件「等待招聘」（不记 fired）
    if (!_isWait) s.triggered.push({ id: _no, choice: optIdx, week: s.week });
    // 等待招聘：时间流逝（time_cost 已结算），然后按当前阶段重刷候选人
    if (_isWait) {
      s.pending = [];
      s.pendingEvent = null;   // 2026-09-16：与 s.pending 同步清，防残留占住事件掷骰闸门
      this.genCandidates(s.ver || "V1");
      return eff;
    }
    // 事件处理完 → 若无事件残留，检查评审点
    s.pending = [];
    /* 2026-09-05 修 BUG：V3.5 办公室事件触发时把 id 写进 s.pendingEvent（officeAdvanceV35），
       但这里只清了旧流程的 s.pending —— pendingEvent 残留导致「一次评审周期内事件只弹一次，
       之后永远不再触发」。选完选项即解除占用，让引擎可以继续掷骰下一个事件。 */
    s.pendingEvent = null;
    /* 排队的小游戏（P5）：事件若没触发招聘 → 立即开（W10 的 RM 标注走这条）；
       若触发了招聘 → 留给「recruit-back」在招完人后消费（W8 的 SFT 走那条）。
       2026-09-05：小游戏已改为办公室事件面板（不再切一级界面），office 阶段同样立即开。 */
    if (s.pendingMinigame && (s.phase === "loop" || s.phase === "office")) {
      // 评审点也照常开小游戏：finishMinigame 里 week>=TOTAL 会进评审，玩家不会白点
      this.startMinigame(s.pendingMinigame);
      return eff;
    }
    /* V3.5.2：评审由玩家在「评审」面板自己发起，事件路径不再自动切评审 */
    if (!this.v35On() && (s.week >= c.TOTAL_WEEKS)) this.enterReview();
    return salaryCheck.active ? Object.assign({}, eff, { tip: "调薪已生效："
      + (salaryCheck.team ? "全员" : "该工程师") + "接下来 " + salaryCheck.weeks
      + " 周产出 +" + salaryCheck.prodPct + "%" }) : eff;
  },

  /* 统一效果结算（能力封顶 / 经费 / 品牌 0-200 / 口碑 0-5 / 时间 / 算力 / 连锁 / 团队） */
  /* [feature:last-engineer-effects-risk] */
  applyEffects(eff, s) {
    const c = this.cfg;
    this.clearLonePoachRisk(s);
  /* [/feature:last-engineer-effects-risk] */
    /* 先校验全笔费用与目标再改状态，资金不足时体力/工资/增产时钟均不变。 */
    const salaryQuote = this.eventEffectsQuote(eff, null, s);
    if (!salaryQuote.ok) return { ok: false, tip: salaryQuote.tip };
    if (salaryQuote.active) {
      if (!salaryQuote.ok) return { ok: false, tip: salaryQuote.tip };
      s.funding -= salaryQuote.salaryCost;
      salaryQuote.raises.forEach((r) => this.increaseSalary(s.engineers.find((e) => e.id === r.id), r.add));
    }
    const cap = this.statCap();
    for (const k of this.dimsOf(s)) {
      if (eff[k]) s[k] = Math.min(this.statLimit(k, cap, s), Math.max(0, s[k] + eff[k]));
    }
    /* 2026-09-07 P3（doc/20 v2.2 §7.3）：正数经收益入账统一入口（分红抽成在这里发生）。
       注资类（同选项立了 investor 旗标 = 投资人给的本钱）与兜底款不抽成。 */
    if (eff.funding) {
      if (eff.funding > 0 && this.v35On()) {
        this.payoutIncome(eff.funding, { kind: eff.investor ? "invest" : (eff.bailout ? "bailout" : "event") });
      } else {
        s.funding = Math.max(0, s.funding + eff.funding);
      }
    }
    /* 语料：事件给的语料**按条数 + 分品质**计（B7，2026-09-06）。
       corpus_normal / corpus_good / corpus_best = 条数，有效 token = 条数 × QUALITY_MULT[档]
       （默认 普通 0.5 / 良好 1.0 / 优质 1.5）。
       旧字段 corpus_token 保留兜底：只写它时按普通品质折算条数，老事件行为不变。 */
    if (this.v35On() && (eff.corpus_token || eff.corpus_normal || eff.corpus_good || eff.corpus_best)) {
      const QM = (c.V35 && c.V35.QUALITY_MULT) || [0.5, 1.0, 1.5];
      const q = s.v35.corpus.q || (s.v35.corpus.q = [0, 0, 0]);
      let addItems = 0, addTok = 0;
      /* 2026-09-07 P2（doc/20 v2.1 负数规则）：正数 = 入该档位库存；**负数 = 只从写的这一档
         扣库存**（corpus_normal:-80 只扣普通档，不得挪用良好/优质垫），扣到 0 为止不穿仓；
         token / items 按实扣数同步减（token 按被扣档的系数算）。 */
      const give = (n, qi) => {
        if (!n) return;
        const qm = (QM[qi] != null ? QM[qi] : 0.5);
        if (n > 0) {
          q[qi] = (q[qi] || 0) + n;      // 分品质库存（背包展示）
          addItems += n;
          addTok += n * qm;
        } else {
          const take = Math.min(q[qi] || 0, -n);   // 库存不够就全扣光，不穿仓
          if (take > 0) {
            q[qi] -= take;
            addItems -= take;
            addTok -= take * qm;
          }
        }
      };
      give(eff.corpus_normal, 0);
      give(eff.corpus_good, 1);
      give(eff.corpus_best, 2);
      if (!addItems && eff.corpus_token) {
        /* 兜底：只写了 token（老配置）→ 假定全普通品质反推条数，保证 q̄ 口径一致 */
        const items = eff.corpus_token / (QM[0] || 0.5);
        give(items, 0);
      }
      if (addItems) {
        s.v35.corpus.token += addTok;
        s.v35.corpus.items += addItems;
        s.corpus = Math.round(s.v35.corpus.token * 10) / 10;
      }
    }
    if (eff.brand) this.changeBrand(eff.brand, s);
    if (eff.reputation) s.reputation = Math.min(5, Math.max(0, s.reputation + eff.reputation));
    if (eff.time_cost) s.week += eff.time_cost;
    if (eff.week_mul && this.v35On()) s.v35.weekMulOverride = eff.week_mul;   // V3.5.2：下周产出系数
    if (eff.parallel) s.parallel = true;
    // 团队事件效果（设计 §七）
    if (eff.trait_prob_boost) s.traitProbBoost = true;      // 词条升级概率 ×1.5

    /* ---- 08 §9 事件池扩充：随机/条件结果 + 团队与目标人状态 + 连锁标记 ---- */
    // 随机二选一（各 50%，如 T02 坦诚沟通）
    if (eff.rand && eff.rand.length) this.applyEffects(eff.rand[Math.random() < 0.5 ? 0 : 1], s);
    // 条件结果（M03 科技博主测评：稳定 < 50 会翻车）
    if (eff.if_stability_below != null) {
      const sub = s.stability < eff.if_stability_below ? eff.flip : eff.normal;
      if (sub) this.applyEffects(sub, s);
    }
    // 条件结果（M08 数据说话：能力达标才加分，否则翻车）
    if (eff.if_stat) {
      const okAny = eff.if_stat.any ? eff.if_stat.any.some(([k, v]) => (s[k] || 0) >= v) : true;
      const okAll = eff.if_stat.all ? eff.if_stat.all.every(([k, v]) => (s[k] || 0) >= v) : true;
      this.applyEffects((okAny && okAll) ? (eff.if_stat.then || {}) : (eff.if_stat.else || {}), s);
    }
    // 成功率事件（C05 政府项目申报：成功率 = 基础 + 品牌/200 × 权重）
    if (eff.chance) {
      const p = (eff.chance.base || 0) + ((s.brand || 0) / 200) * (eff.chance.brandWeight || 0);
      this.applyEffects(Math.random() < p ? (eff.chance.success || {}) : (eff.chance.fail || {}), s);
    }
    // 全员三围增减
    if (eff.team_stat) {
      /* 2026-09-22：体力「每人一份」→ energy 走 addEnergyAll（逐人各结算一次，
         耗时与其余键一样是逐人循环）；其余键仍逐人结算。 */
      if (eff.team_stat.energy) this.addEnergyAll(eff.team_stat.energy);
      const rest = Object.assign({}, eff.team_stat);
      delete rest.energy;
      if (Object.keys(rest).length) {
        for (const e of s.engineers) {
          if (e.resigned) continue;
          this.ensureStatus(e);
          this.applyStat(e, rest);
        }
      }
    }
    /* 2026-09-16 修 BUG：去掉「在编第一个」兜底 —— 目标人解析失败（旧档无 targetId /
       目标已离职）时事件空放，绝不随机结算到别人头上（弹窗指名 a 就必须只影响 a）。 */
    const tgt = () => s._evTarget
      ? s.engineers.find((e) => e.id === s._evTarget && !e.resigned) : null;
    if (eff.target_stat) {
      const t = tgt();
      if (t) { this.ensureStatus(t); this.applyStat(t, eff.target_stat); }
    }
    /* ⚠️ 2026-09-14 新增 `target_rest`：**真放假** —— 与「安排休息」按钮走同一条通路
       （`restWeek` 本周下班 + 体力**挂起到下周上班才恢复** + `syncResting()` 把 TA 从本周产出编制里剔除）。
       为什么要有它：V35_QUIT「撑不住了」的 A/B 两个选项文案写着「放假」，effect 却只塞 `target_stat.energy`
       —— 人照样上班产出、体力当场回满，等于「说了放假其实没放」（用户 2026-09-14 报的）。
       值 = 放假期间攒的体力（number；不给数字就用 TEAM_BUILD.REST_ENERGY 兜底）。 */
    if (eff.target_rest != null) {
      const t = tgt();
      if (t) {
        this.ensureStatus(t);
        const gain = typeof eff.target_rest === "number" ? eff.target_rest
          : (((c.TEAM_BUILD || {}).REST_ENERGY != null) ? c.TEAM_BUILD.REST_ENERGY : 35);
        t.restWeek = s.week || 0;                                   // 本周下班（不产出）
        t.energyPending = (t.energyPending || 0) + gain;            // 挂起：下周一上班时统一恢复
        this.syncResting();                                         // 重算本周各岗位在休人数
      }
    }
  /* [feature:last-engineer-resign] */
    if (eff.target_resign) {
      const t = tgt();
      if (t && this.activeEngineerCount(s) > 1) {
        t.resigned = true;
        this.freeSeat(t.id);   // 仅实际离职者释放座位
        this.clearLonePoachRisk(s);
      } else if (t) {
        this._staffGuardTip = "团队至少需要保留一名工程师，最后一名工程师已留任";
      }
    }
  /* [/feature:last-engineer-resign] */
    /* `team_rest`：**全员真放假** —— 与 target_rest 同一条通路，逐个设 restWeek/energyPending。
       （事件 1008「团队快撑不住了」的 A 选项文案写着「放假」，以前只塞 team_stat.energy。） */
    if (eff.team_rest != null) {
      const gain2 = typeof eff.team_rest === "number" ? eff.team_rest
        : (((c.TEAM_BUILD || {}).REST_ENERGY != null) ? c.TEAM_BUILD.REST_ENERGY : 35);
      (s.engineers || []).forEach((e) => {
        if (e.resigned) return;
        this.ensureStatus(e);
        e.restWeek = s.week || 0;
        e.energyPending = (e.energyPending || 0) + gain2;
      });
      this.syncResting();
    }
    /* 2026-09-07 P2（doc/20 v2.1 spec）：quit_risk / poach_risk = **概率埋雷**。
       quit_risk:0.15 = 选项结算时掷 15% → 从在岗且已到岗的工程师里随机选一位，
       置位 s.v35.leaveRisk/leaveWho（挖角同理 poachRisk/poachWho）。本效果本身
       不产生数值变化——下一轮掷骰 V35_QUIT/V35_POACH 走硬优先通道弹出「涨薪/放假/放行」
       抉择，真正的代价由玩家自己选。没掷中就什么都没发生（期望为负，抉择张力所在）。
       （旧语义 = 给目标人挂 e.quitRisk 等 decayStatus 掷骰，而 decayStatus 是死代码，
       实际从不生效；配置里也没有任何事件在用旧语义，安全替换。） */
    if (eff.quit_risk != null && Math.random() < eff.quit_risk) {
      const riskPool = s.engineers.filter((e) => !e.resigned
        && (e.joinTick == null || s.v35.tick >= e.joinTick));
      const w = riskPool[Math.floor(Math.random() * riskPool.length)];
      if (w) { s.v35.leaveRisk = true; s.v35.leaveWho = w.id; }
    }
  /* [feature:last-engineer-poach-effect] */
    if (this.activeEngineerCount(s) > 1 && eff.poach_risk != null && Math.random() < eff.poach_risk) {
  /* [/feature:last-engineer-poach-effect] */
      const riskPool2 = s.engineers.filter((e) => !e.resigned
        && (e.joinTick == null || s.v35.tick >= e.joinTick));
      const w2 = riskPool2[Math.floor(Math.random() * riskPool2.length)];
      if (w2) { s.v35.poachRisk = true; s.v35.poachWho = w2.id; }
    }
    /* 随机四维 +N：V35_TIRED 等事件一直在用，但只有行动卡那段实现了它 —— 事件里的
       randomStat 从来没生效过（承诺「本项能力 +2」却什么都没加）。这里补上。 */
    if (eff.randomStat) {
      const _dk = this.baseDims(); const k = _dk[Math.floor(Math.random() * _dk.length)];
      const cap = this.statCap();
      s[k] = Math.min(this.statLimit(k, cap), Math.max(0, (s[k] || 0) + eff.randomStat));
      s.lastRandomStat = { dim: k, add: eff.randomStat };
    }
    if (eff.cand_bonus) s.candBonus = (s.candBonus || 0) + eff.cand_bonus;   // 下轮候选人数 +N
    if (eff.set_flag) { s.flags = s.flags || {}; s.flags[eff.set_flag] = true; }
    if (eff.set_flag_prob && Math.random() < eff.set_flag_prob.prob) {
      s.flags = s.flags || {};
      s.flags[eff.set_flag_prob.flag] = true;
    }
    if (eff.investor) s.investor = true;        // 投资人已入局 → 解锁 C02 + INVESTOR 条件池事件
    /* 2026-09-13（用户要求）：approve_arch —— 「团队提出架构设想」事件里批准立项。
       自研路线（ARCHITECTURES[*].unlockBy === "approval"）不研读论文，批准即解锁：
       写入 s.approvedArchs → archUnlock 的 approvalOk 通过 → 立项面板立刻可选该架构组合。
       幂等（已批准过不重复塞）；非法架构 id 直接忽略，绝不让脏配置写进存档。 */
    if (eff.approve_arch) {
      const arch = (c.ARCHITECTURES || []).find((x) => x.id === eff.approve_arch);
      if (arch && (arch.unlockBy === "approval" || (arch.unlockBy === "embodied" && this.embodiedAvailable()
        && (c.VER_ORDER || []).indexOf(s.ver) >= (c.VER_ORDER || []).indexOf(arch.unlock)))) {
        s.approvedArchs = Array.isArray(s.approvedArchs) ? s.approvedArchs : [];
        if (!s.approvedArchs.includes(arch.id)) s.approvedArchs.push(arch.id);
        s.lastApprovedArch = { id: arch.id, name: arch.name, week: this.absWeek() };
      }
    }
    /* 2026-09-07 P3（doc/20 v2.2 §7.3）：dividend{pct,times} —— 挂上之后每笔收益先抽 pct，
       抽满 times 笔自动结束（addFundingIncome 里结算）。重复挂 = 覆盖成新条件。 */
    if (eff.dividend && this.v35On()) {
      s.v35.dividend = {
        pct: eff.dividend.pct != null ? eff.dividend.pct : 0.1,
        times: eff.dividend.times != null ? eff.dividend.times : 3,
        left: eff.dividend.times != null ? eff.dividend.times : 3,
        paid: 0,
      };
    }
    /* P3 破产兜底（§7.2）：经费重置到 200 万 + 欠薪清零 + 挂分红（事件侧已带 dividend）。
       第二次破产没有兜底 → 直接 Game Over（见 officeAdvanceV35 的破产判定）。 */
    if (eff.bailout) {
      const rescue = this.cfg.BAILOUT;
      const usedFlag = typeof eff.bailout === "string" ? eff.bailout : rescue.DEFAULT_USED_FLAG;
      s[usedFlag] = true;
      s.fiscalDeficit = 0;
      s.funding = Math.max(s.funding || 0, Number(eff.bailoutFunding ?? rescue.DEFAULT_FUNDING));
      s._bailoutCooldownUntil = this.absWeek() + rescue.COOLDOWN_WEEKS;   // 套利冷却：8 周内注资类事件不触发（绝对周）
      this.addFundingIncome(0, { kind: "bailout" });
    }
    /* P3：拒绝兜底 / 直接破产结局 */
    if (eff.game_over) {
      s.flags = s.flags || {};
      s.flags.bankrupt = true;
      s.bankrupt = true;
      s.phase = "over";
      s.gameOverReason = eff.game_over === true ? "bankrupt" : String(eff.game_over);
    }
    /* 2026-09-07 P2（doc/20 v2.1 spec）：recruit_offer:{tier,weeks} = 慕名而来的人选。
       只挂单不立即给人：周结算检查到期（dueWeek）→ 从共享池抽真实档案（pickOfferCand：
       阶段等级区间 / 排除已在职已候选 / 按档收窄稀有度）→ cloneEng 完整档案打 fromEvent
       标记进「招聘」页候选列表，TTL 照走。免费绕过 RECRUIT_COST 是设计意图（事件奖励）。 */
    if (eff.recruit_offer && this.v35On()) {
      s.v35.eventOffer = {
        tier: eff.recruit_offer.tier || "mid",
        /* ⚠️ 2026-09-22：dueWeek 改用绝对周 —— 原用 s.week，跨阶段归零后
           `s.week >= dueWeek` 迟迟不成立，挂单的候选人会一直不到岗。 */
        dueWeek: this.absWeek() + (eff.recruit_offer.weeks || 3),
      };
    }
    /* 中途招聘（P2 节点事件）：{ quota, pick, flow }。
       pick 指定人选 → 教学关固定刷出，保证 W4/W8 的招聘节点确定性触发。 */
    if (eff.recruit_open) this.openRecruit(eff.recruit_open);
    /* 小游戏（P5）：先排队——若本事件同时触发招聘（W8），招完人再开 */
    if (eff.minigame) s.pendingMinigame = eff.minigame;
  },

  /* ★ 体力增减的唯一入口（2026-09-22 起体力是**每人一份**，真源 = e.energy）。
     ⚠️ 历史教训（2026-09-02）：曾经「任何只改 e.energy 的操作都会在下一 tick 被覆盖丢失」
     —— 那时真源是岗位共享槽、tick 结束会把槽值刷到每个人身上。**现在反过来**：
     直接写 s.v35.energy[role] 的操作才会被冲掉（那只是 tick 算出来的**人均值**派生量）。
     所有增减体力的地方都必须走这里，别直写任一侧。
     返回实际变化量（提示文案用真实值，不写死数字）。 */
  /* 安排休息（2026-09-08 用户拍板）：休息的人本周「下班」——不产出，到下一周（上班）才回体力。
     引擎按岗位槽产出，这里把「本周在休息的人」按岗位统计进 v35.restPre/Data/Post，
     v35_core.tick 的产出循环会相应减人（全休 = 该岗位本周停产）。 */
  syncResting() {
    const s = this.state, st = s && s.v35;
    if (!st) return;
    const wk = s.week || 0;
    const cnt = { pre: 0, data: 0, post: 0, embodied: 0 };
    for (const e of s.engineers || []) {
      if (e.resigned) continue;
      if (e.joinTick != null && st.tick != null && st.tick < e.joinTick) continue;
      if (e.restWeek === wk) {
  /* [feature:multi-trait-dev-core-019] */
        for (const k of Object.keys(cnt)) {
          if (this.productionTraitLevel(e, k) > 0) cnt[k] += 1;
        }
  /* [/feature:multi-trait-dev-core-019] */
      }
    }
    st.restPre = cnt.pre; st.restData = cnt.data; st.restPost = cnt.post; st.restEmbodied = cnt.embodied;
    if (st.burst) for (const k of ["pre", "data", "post", "embodied"]) {
      if (!this.teamRoleEngs(st, k).length) st.burst[k] = 0;
    }
  },

  /* 每个 tick 结束（周结算）后，把上一周休息的人恢复体力（上班回血）。
     返回恢复的人名数组，供 UI 提示。 */
  restoreRested() {
    const s = this.state, st = s && s.v35;
    if (!st) return [];
    const back = [];
    /* 2026-09-22：体力已改成**每人一份**（见 addEnergy），所以按人各回各的 pending 即可 ——
       旧的「同岗位取最大 pending 只回一次」是共享槽时代的妥协，已废。 */
    for (const e of s.engineers || []) {
      if (e.resigned) continue;
      if (e.restWeek == null || (s.week || 0) <= e.restWeek) continue;
      const gain = e.energyPending != null ? e.energyPending
        : (((this.cfg.TEAM_BUILD || {}).REST_ENERGY != null) ? this.cfg.TEAM_BUILD.REST_ENERGY : 35);
      this.addEnergy(e, gain);
      e.restWeek = null; e.energyPending = 0;
      back.push(e.name);
    }
    return back;
  },

  addEnergy(e, delta) {
    if (!e) return 0;
    this.ensureStatus(e);
    const s = this.state;
    const clamp = (v) => Math.max(0, Math.min(100, v));
    /* 2026-09-22：体力**每人一份**，真源就是 e.energy（用户要求「选谁谈心就只恢复谁的体力」）。
       岗位标量 s.v35.energy[role] 退化成该岗位在岗人的**人均值**（派生量），
       只有事件门槛 / 周产出估算 / 旧 UI 还在读它。 */
    const b = e.energy || 0;
    e.energy = clamp(b + delta);
    if (this.v35On && this.v35On() && s.v35 && s.v35.energy) {
      const key = this.v35RoleOf(e);
      if (key && s.v35.energy[key] != null) this.syncEnergySlot(key);
    }
    return Math.round(e.energy - b);
  },

  /* 单个**岗位**增减（仅 V3.5）：2026-09-22 起 = 给该岗位每个在岗人各 +delta。
     旧的「岗位共享槽」概念已随体力个人化取消（原来写槽再镜像给全组，正是
     「点 A 却动了 B 的体力」的来源）。 */
  addEnergyRole(role, delta) {
    const s = this.state;
    if (!role || !s) return 0;
    let sum = 0;
    for (const e of this.teamRoleEngs(s.v35, role)) sum += this.addEnergy(e, delta);
    return sum;
  },

  /* ★ 全员体力增减。
     2026-09-22：体力改「每人一份」后，这里就是**逐人各 +delta** ——
     旧的「按岗位去重，每个槽只结算一次」是共享槽时代的补丁（那时同岗位 N 人会把
     同一个槽加 N 次，玩家报「团建有时候能直接把体力加满」）。个人化之后
     「全员 +10 = 每人 +10」既符合直觉，也不再需要去重。 */
  addEnergyAll(delta) {
    const s = this.state;
    if (!s) return 0;
    let sum = 0;
    for (const e of s.engineers || []) {
      if (e.resigned) continue;
      sum += this.addEnergy(e, delta);
    }
    return sum;
  },

  /* 工程师状态增减；2026-09-10「精力 / 协作」属性已删除，这里只剩体力 */
  applyStat(e, d) {
    if (d.energy) this.addEnergy(e, d.energy);
  },

  /* 重新招募：触发「等待招聘」事件（时间成本事件化，不硬扣周数）。
     80% 概率触发 E101；无论是否触发，本次候选作废、待事件处理后再刷新。 */
  requestRecruit() {
    const c = this.cfg, s = this.state;
    if (s.phase !== "recruit") return null;
    /* 反抽卡（doc/22 §7）：换一批要花 RECRUIT_COST，钱不够直接拒绝。
       V1 的开局保底 3 人免费（本来就是强制招募，不是玩家主动刷）。 */
    const pay = this.payRecruitCost();
    if (!pay.ok) return { denied: true, tip: pay.tip };
    /* 等「等待招聘」卡（可重复触发，不记 fired）。
       2026-09-11：优先取独立的 RECRUIT_WAIT_EVENT —— 它是**系统事件**，已从 EVENTS 池里搬出
       （放池子里会在【事件】分页显示成普通事件，玩家删了又被同步桥补回来）。
       保留 EVENTS 里的兜底查找，老配置/老存档仍然能用。 */
    const ev = c.RECRUIT_WAIT_EVENT || this.evByKey("E101");
    if (ev && Math.random() < (c.WAIT_RECRUIT_PROB != null ? c.WAIT_RECRUIT_PROB : 0.8)) {
      s.pending = [{ ...ev, engineKey: "E" + ev.no }];
      return ev;
    }
    // 未触发事件：直接按当前阶段重刷候选人
    // ⚠️ 不要在这里 s.candidates = [] —— genCandidates 本身就是整表替换，
    //    而且要靠旧列表识别 fromHire / fromEvent（扩编寻访 / 事件慕名而来的人），先清空会把他们弄丢
    this.genCandidates(s.ver || "V1");
    return null;
  },

  /* ---------------- 微调决策（报告后的玩家操作） ----------------
     点选只暂存（fineTuneDraft），不立即改数；正式推进（advance）时才应用。
     同一轮可反复切换选择，最后一次为准。 */
  chooseFineTune(idx) {
    const c = this.cfg, s = this.state;
    const o = c.FINE_TUNE_OPTIONS[idx];
    if (!o) return;
    s.fineTuneDraft = idx;
  },

  /* 取消本轮已选的微调方向 */
  clearFineTune() { this.state.fineTuneDraft = null; },

  /* ---------------- 内部评审（§5.3） ---------------- */
  enterReview() {
    const s = this.state;
  /* [feature:review-entry-idempotent] */
    // A settled reward page must retain its original result and income lock.
    if (s.phase === "review" || s.phase === "over" || s.phase === "bonus") return;
  /* [/feature:review-entry-idempotent] */
    s.pendingEvent = null;   // V3.5.2：清理悬挂事件（跨阶段不补弹）
    /* 阶段结算：词条按天赋概率升级（用户 2026-08-29：进入下一阶段时唯一的升级途径）
       2026-09-04：无条件赋值（原来只在有升级时才写，没升级时上一阶段的记录会残留到下一阶段，
       第三幕升级卡就会显示过期的名单）。 */
    const ups = this.upgradeTraitsByTalent();
    s.traitUpgrades = ups;
    s.phase = "review";
    /* 每阶段评审刷新抽卡次数（无条件刷）：TUNE_DRAWS_BY_VER 按版本覆盖，
       V1 为 0 —— V1 没有"上一代模型"可抽（X2，用户拍板）。 */
    const byVer = this.cfg.TUNE_DRAWS_BY_VER || {};
    const draws = byVer[s.ver || "V1"] != null ? byVer[s.ver || "V1"]
      : (this.cfg.TUNE_DRAWS != null ? this.cfg.TUNE_DRAWS : 3);
    s.tuneDrawsLeft = draws;
    s.result = this.evaluate();
    // 08 §9 T08 期权承诺的延迟结算：承诺时给好处，最终评审没过则全员体力 -12
    if (s.flags && s.flags.t08_option && !this.isPassLike(s.result)) {
      /* 承诺落空：全员体力 -12（原「忠诚 -35」随废弃数值移除）
         2026-09-22：全员效果走 addEnergyAll —— 体力「每人一份」，逐人各扣。 */
      this.addEnergyAll(-12);
    }
  },

  /* ================= X5 测评演出台（用户拍板：10 题 10 秒）=================
     结算前让模型「逐条答题」，分数蹭蹭涨。判定不是玩家操作，而是按模型真实数值
     算答对率（数值越高越容易答对）+ 少量随机 —— 练得好的人，演出也好看。
     演出分只是表演，最后揭晓的仍是 evaluate() 的加权总评（UI 会把数字滚到真实值）。 */
  /* ---------------- 评测题库选取（2026-09-05，doc/17 方案 v2）----------------
     **架构 → 题型，阶段 → 难度**。题型支持三种写法：
       "chat"                    单一
       ["chat", "code"]          等比例混合
       { chat: 60, code: 40 }    加权混合
     皮肤取权重最大的那个题型（混合题库里决定演出长相），旧存档无 s.arch 时兜底 dense/chat。 */
  pickEvalBank() {
    const c = this.cfg, s = this.state;
    const P = c.EVAL_BANK_PICK || {};
    const ver = s.ver || "V1";
    const arch = s.arch || "dense";
    const diff = (P.difficultyByVer || {})[ver] || "low";
    const byVer = (P.archToBankByVer || {})[ver] || {};
    const raw = byVer[arch] != null ? byVer[arch] : (P.archToBank || {})[arch];
    let mix = [];
    if (typeof raw === "string") mix = [{ bank: raw, w: 1 }];
    else if (Array.isArray(raw)) mix = raw.map((b) => ({ bank: b, w: 1 }));
    else if (raw && typeof raw === "object") mix = Object.keys(raw).map((b) => ({ bank: b, w: +raw[b] || 0 }));
    mix = mix.filter((m) => m.w > 0);
    if (!mix.length) mix = [{ bank: P.fallback || "chat", w: 1 }];
    const mainBank = mix.slice().sort((a, b) => b.w - a.w)[0].bank;
    return {
      diff, mix, mainBank,
      skin: (c.EVAL_SKIN_BIND || {})[mainBank] || "bubble",
    };
  },

  buildEvalShow() {
    const c = this.cfg, s = this.state;
    const ES = c.EVAL_SHOW || {};
    const w = c.EVAL_WEIGHTS || { code: 0.2, text: 0.45, safety: 0.2, stability: 0.15 };
    const cap = this.statCap();
    const pass = this.passLine();
    const pick = this.pickEvalBank();
    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    /* ① 各题型的候选池（新题库 EVAL_BANK；为空则兜底旧的扁平 EVAL_QA，旧存档不白屏） */
    let pools = pick.mix.map((m) => ({
      bank: m.bank, w: m.w,
      items: ((((c.EVAL_BANK || {})[m.bank] || {})[pick.diff]) || []).slice(),
    })).filter((p) => p.items.length);
    let usedFlat = false;
    if (!pools.length && (c.EVAL_QA || []).length) {
      pools = [{ bank: "chat", w: 1, items: (c.EVAL_QA || []).slice() }];
      usedFlat = true;
    }
    if (!pools.length) {
      s.evalShow = { qs: [], total: 0, per: 0, score: 0, hits: 0, skin: pick.skin, bank: pick.mainBank, difficulty: pick.diff };
      return s.evalShow;
    }
    pools.forEach((p) => shuffle(p.items));

    /* ② 按权重分配题数（总量 QA_COUNT，且不超过任一池的条数 —— 宁可少几题也不重复出题） */
    const want = Math.max(1, ES.QA_COUNT || 10);
    const totalW = pools.reduce((a, p) => a + p.w, 0);
    const quota = pools.map((p) => Math.min(p.items.length, Math.max(1, Math.round(want * p.w / totalW))));
    let sum = quota.reduce((a, b) => a + b, 0);
    let guard = 0;
    while (sum > want && guard++ < 100) {                 // 多了：从最多的那份减
      let k = 0;
      for (let i = 1; i < quota.length; i++) if (quota[i] > quota[k]) k = i;
      if (quota[k] <= 1) break;
      quota[k]--; sum--;
    }
    guard = 0;
    while (sum < want && guard++ < 100) {                 // 少了：补给还有余量的池
      let k = -1;
      for (let i = 0; i < pools.length; i++) if (quota[i] < pools[i].items.length) { k = i; break; }
      if (k < 0) break;
      quota[k]++; sum++;
    }

    /* ③ 取题 + 逐题算答对率（公式不变） */
    let picked = [];
    pools.forEach((p, i) => {
      for (let k = 0; k < quota[i]; k++) picked.push({ ...p.items[k], bank: p.bank });
    });
    shuffle(picked);                                       // 打乱题型顺序，避免同类题扎堆
    const minP = ES.MIN_P != null ? ES.MIN_P : 0.05;
    const maxP = ES.MAX_P != null ? ES.MAX_P : 0.98;
    const qs = [];
    for (const src of picked) {
      const cur = s[src.dim] || 0;
      const line = Math.max(1, pass[src.dim] || (pass.axMin || {})[src.dim] || 1);
      const ratio = Math.min(1.35, cur / line);            // 达标 1.0；超额还能再高一点
      const jitter = (Math.random() * 2 - 1) * (ES.JITTER != null ? ES.JITTER : 0.12);
      /* 答对率 = BASE + SPAN × 达标度 ± JITTER，再夹进 MIN_P ~ MAX_P。
         注意：**只是演出观感**，最终总评走 evaluate()，与这里答对几题无关。 */
      const p = Math.max(minP, Math.min(maxP,
        (ES.BASE != null ? ES.BASE : 0.28) + (ES.SPAN != null ? ES.SPAN : 0.55) * ratio + jitter));
      qs.push({
        q: src.q, dim: src.dim, good: src.good, bad: src.bad,
        bank: src.bank, tag: src.tag || null,
        /* 皮肤专用字段：长文本题的原文、代码题的测试用例数与 BUG 说明。
           这三个之前漏带了 —— 阅读台会显示「材料缺失」、处理字数恒为 0。 */
        material: src.material || null,
        cases: src.cases || null,
        bug: src.bug || null,
        ok: Math.random() < p, p: Math.round(p * 100) / 100,
      });
    }
    // 满分 = 该阶段四维顶格的加权分（与 evaluate 同一套权重）
    const full = cap.code * w.code + cap.text * w.text + cap.safety * w.safety + cap.stability * w.stability;
    const per = qs.length ? full / qs.length : 0;
    const score = qs.reduce((a, x) => a + (x.ok ? per : 0), 0);
    s.evalShow = {
      qs, total: Math.round(full * 10) / 10, per: Math.round(per * 10) / 10,
      score: Math.round(score * 10) / 10, hits: qs.filter((x) => x.ok).length,
      /* 供 UI 选演出皮肤（第二批实装）；flat 兜底时仍给 bubble */
      bank: pick.mainBank, difficulty: pick.diff, skin: usedFlat ? "bubble" : pick.skin,
      mix: pick.mix.map((m) => m.bank),
    };
    return s.evalShow;
  },

  /* Score ceilings use the same production evaluator and current configuration.
     They describe attainable combinations, not the technical integer packing limit. */
  reviewScoreCeiling(ver) {
    const c = this.cfg || window.GameCfg, V = window.V35;
    if (!c || !V || !(c.VER_ORDER || []).includes(ver)) return null;
    const order = c.VER_ORDER, vi = order.indexOf(ver);
    const quality = ((c.V35 || {}).QUALITY_MULT || []).filter(Number.isFinite);
    if (!quality.length) return null;
    const lo = Math.min(...quality), hi = Math.max(...quality);
    const candidates = [lo, hi].concat(((c.V35 || {}).Q_TIERS || [])
      .map(row => Number(row[0])).filter(q => Number.isFinite(q) && q >= lo && q <= hi));
    const q = candidates.reduce((best, x) => V.qualityBonus({ver, corpus:{token:x, items:1}})
      > V.qualityBonus({ver, corpus:{token:best, items:1}}) ? x : best, lo);
    const tiers = (c.GPU_TIERS_BY_VER || {})[ver] || c.GPU_TIER_ORDER || [];
    const gpuMax = Math.max(0, ...tiers.map(id => Number((c.GPU_TIERS[id] || {}).maxParam) || 0));
    let ceiling = null;
    for (const a of c.ARCHITECTURES || []) {
      if (order.indexOf(a.unlock || "V1") > vi) continue;
      for (const param of c.TARGET_PARAMS || []) {
        if (param > gpuMax || (a.maxParam > 0 && param > a.maxParam) || (a.minParam > 0 && param < a.minParam)) continue;
        const state = {ver, arch:a.id, paramTarget:param, corpus:{token:q, items:1}};
        const base = Math.round(((c.CAP_BY_VER || {})[ver] || 60) * ((c.PARAM_CAP_MUL || {})[param] || 1));
        const cap = V.dimObj(base);
        for (const id of V.activeAxes(state)) {
          const value = V.axisCap(ver, id, param);
          if (value != null) cap[id] = value;
        }
        state.stats = V.clampStats(state, cap, cap);
        const score = Math.round(V.review(state).total * 10) / 10;
        if (Number.isFinite(score)) ceiling = Math.max(ceiling == null ? 0 : ceiling, score);
      }
    }
    return ceiling;
  },

  /* Questions are presentation data: repairing a result never rerolls evalShow. */
  refreshReviewResult() {
    const s = this.state, old = s && s.result;
    if (!old || old.settled || !this.v35On()) return old;
    Object.assign(old, this.evaluate());
    delete old.missionFail;
    delete old.retry;
    return old;
  },

  reviewFailurePolicy() {const p=(this.cfg.EMBODIED||{}).REVIEW_FAILURE;return p&&p.STAGES.includes(this.state.ver)?p:null;},
  qualifyReview(result,stats) {
    const p=this.reviewFailurePolicy();if(!p)return result;
    const s=this.state,groups=window.V35.mergedGroups(s),paired=new Set(groups.flatMap(g=>g.sources)),items=[];
    const need=result.pass,format=(dim,value,min)=>String(p.UI.DIM).replace('{dim}',this.statLabel(dim)).replace('{value}',Math.round(value)).replace('{need}',Math.ceil(min));
    for(const group of groups){const value=group.sources.reduce((n,k)=>n+(stats[k]||0),0),min=group.sources.reduce((n,k)=>n+(need[k]||0),0);if(value<min)items.push(format(group.key,value,min));}
    for(const k of this.baseDims().filter(k=>!paired.has(k))){if((stats[k]||0)<(need[k]||0))items.push(format(k,stats[k]||0,need[k]));}
    const required={...(need.axMin||{})};for(const[k,v]of Object.entries(this.missionOf(s.ver).axisMin||{}))required[k]=Math.max(required[k]||0,v);
    for(const[k,min]of Object.entries(required))if((stats[k]||0)<min)items.push(format(k,stats[k]||0,min));
    const direction=this.missionJudge(s,s.arch,s.paramTarget);result.directionMismatch=!direction.hit;
    if(!direction.hit)items.unshift(p.UI.DIRECTION);
    result.qualifyingScore=result.score;result.qualificationFailed=items.length>0;result.failureItems=items;
    if(items.length){result.baseVerdict=result.verdict;result.verdict='fail';result.score=Math.round(Math.min(result.score,result.excellentLine*p.SCORE_RATIO)*10)/10;result.checks.score=false;result.reasons=[...items,p.UI.SCORE];}
    return result;
  },

  evaluate() {
    const c = this.cfg, s = this.state;
    const w = c.EVAL_WEIGHTS;
    const pass = this.passLine();
    const cap = this.statCap();
    /* V3.5.2：总分制（加权维度 + 品质分档加成），V1 无失败档（破产才是失败） */
    if (this.v35On()) {
      const V = window.V35;
      /* ⚠️ 必须按 V35.allDims()（四维 + 轴）建 stats，并把 arch/paramTarget 一起传 ——
         2026-09-13 修：此前只传四维、也不传 arch/paramTarget ⇒ V35.review 内部
         activeAxes(st) 读不到 arch，**恒返回 []** ⇒ 轴既不计分、axisOk 也恒真，
         表现为「练了轴不涨分、没练轴不扣分」；而 test_axis 直调 V.review(rig) 时
         rig 自带 arch 所以全绿 —— 教科书式的「真机入口 ≠ 直调引擎」假绿。 */
      const stats = V.clampStats(s, s, cap);
      /* ⚠️⚠️ 2026-10-04：喂给 review 的 stats **先按 statCap 夹一次**（此前直接原样读 s[k]）。
         根因：玩家改存档 / 改内存（F12 直接写 GameCore.state.xxx）能把维度顶到 cap 的
         1.7 倍，而 V35.review 只做加权求和、**自己不夹上限** ⇒ 分数线性膨胀。
         实测维度 = cap×1.75 → 1626.1 分，**与排行榜上刷到的 1600+ 精确吻合**
         （上报上限 SCORE_CAP=1677 拦不住落在区间内的值）。
         ⚠️ 这是**只夹「喂给评分的快照」**、不改 s[k] 本身：状态层保持玩家看到的样子，
            免得面板上的数字突然被拉回上限（那是另一个问题，走 healDimOverCap 的读档自愈）。
         ⚠️ 正常玩法的值本来就 ≤ cap（tick 主产线 2944/2972 两处已夹）⇒ 零影响。 */
      /* 必须带上 ver：品质加成表 Q_TIERS 是按阶段分列的（doc/14 §1.4）。
         2026-09-04 前这里只传 {stats, corpus}，V35 内部默认按 V1 取列 →
         中后期「囤垃圾语料要扣分」的设计从来没有生效过。 */
      const r = V.review({ stats, corpus: s.v35.corpus, ver: s.ver,
                           arch: s.arch, paramTarget: s.paramTarget });
      const checks = {
        code: stats.code >= pass.code, text: stats.text >= pass.text,
        safety: stats.safety >= pass.safety, stability: stats.stability >= pass.stability,
        score: r.total >= pass.score,
      };
      V.mergedGroups(s).forEach(group => {
        const ok = group.sources.reduce((n, k) => n + (stats[k] || 0), 0)
          >= group.sources.reduce((n, k) => n + (pass[k] || 0), 0);
        checks[group.key] = ok;
        group.sources.forEach(k => { checks[k] = ok; });
      });
      /* 轴也进 checks（评审页的轴胶囊按需取用）：线取 passLine().axMin（= REVIEW.AXIS_MIN） */
      (r.axes || []).forEach((k) => {
        const nd = (pass.axMin || {})[k];
        if (nd != null) checks[k] = (stats[k] || 0) >= nd;
      });
      /* DOC 26 P2 评级四档：顶尖 = 达优秀线且 ≥ 优秀线×TOP_RATIO（且均衡）。
         顶尖被视为「更强的优秀」（结算/图鉴/任务全部按优秀通道处理）。 */
      const topRatio = c.TOP_RATIO != null ? c.TOP_RATIO : 1.12;
      const topLine = Math.round(pass.score * topRatio * 10) / 10;
      let verdict = r.excellent ? "excellent" : "pass";
      if (r.excellent && r.balanced && r.total >= topLine) verdict = "top";
      return this.qualifyReview({
        score: Math.round(r.total * 10) / 10, rawScore: Math.round(r.raw * 10) / 10,
        qBonus: r.bonus, qbar: r.qbar, balanced: r.balanced,
        checks, reasons: [],
        verdict,
        param: s.paramTarget, pass, cap,
        excellentLine: pass.score,   // 逐阶段优秀线（passLine 已按阶段取，2026-09-08）
        topLine,
      },stats);
    }
    let score = s.code * w.code + s.text * w.text + s.safety * w.safety + s.stability * w.stability;
    const reasons = [];
    /* 惩罚线 = 该阶段达标线本身（而非固定常数）：达标 → 不罚；不达标 → 雪上加霜。
       旧版固定 35/40 是相对 V1 上限 60 标的，达标线降到 10 后会误伤所有正常玩法。 */
    if (s.safety < pass.safety) {
      score *= c.EVAL_SAFETY_PENALTY_MUL;
      reasons.push(`安全性 ${s.safety} < 达标线 ${pass.safety}，总评 ×${c.EVAL_SAFETY_PENALTY_MUL}`);
    }
    if (s.stability < pass.stability) {
      score *= c.EVAL_STABILITY_PENALTY_MUL;
      reasons.push(`稳定性 ${s.stability} < 达标线 ${pass.stability}，总评 ×${c.EVAL_STABILITY_PENALTY_MUL}`);
    }
    score = Math.round(score * 10) / 10;
    const checks = {
      param: s.paramTarget >= pass.minParam,
      code: s.code >= pass.code,
      text: s.text >= pass.text,
      safety: s.safety >= pass.safety,
      stability: s.stability >= pass.stability,
      score: score >= pass.score,
    };
    /* 「优秀」与「强制否决」同样随阶段缩放：
       · 优秀线 = 该阶段四维顶格加权满分 × EXCELLENT_RATIO
       · 否决线 = 安全达标线 × EVAL_VETO_RATIO（V1 → 10×0.6=6，教学关不会被秒杀） */
    const full = cap.code * w.code + cap.text * w.text + cap.safety * w.safety + cap.stability * w.stability;
    const r10 = (n) => Math.round(n * 10) / 10;
    const excellentLine = r10(full * (c.EXCELLENT_RATIO != null ? c.EXCELLENT_RATIO : 0.8));
    const vetoLine = Math.round(pass.safety * (c.EVAL_VETO_RATIO != null ? c.EVAL_VETO_RATIO : 0.6));
    let verdict = "pass";
    const vetoOn = (c.VETO_BY_VER || {})[s.ver || "V1"] !== false;
    if (vetoOn && s.safety < vetoLine) {
      verdict = "veto";
      reasons.push(`安全性 ${s.safety} < ${vetoLine}，强制内部否决`);
    } else if (Object.values(checks).every(Boolean)) {
      verdict = score >= excellentLine ? "excellent" : "pass";
    } else {
      verdict = "fail";
    }
    return { score, checks, reasons, verdict, param: s.paramTarget, pass, cap, excellentLine, vetoLine };
  },

  /* 结算结局效果（三幕结算演出，doc/16 方案 v2）：
     通过/优秀 → 奖金明细存 s.bonus、用户增长与能力榜名次写进 result，phase 进 "bonus" 播三幕演出；
     被否决/未通过 → 无奖金，直接进 over。
     2026-09-17：末版 V4.5 通过后**不再进终局页**（用户要求），第三幕主按钮 = 再战 V4.5（r.finalRepeat）。 */
  finish() {
    const c = this.cfg, s = this.state;
    const r = s.result;
    if (!r) return;
    if (r.settled) return r;
    this.refreshReviewResult();
    this.changeBrand(0);
    const brandBefore = s.brand, brandStars = this.brandStarsCount(brandBefore);
    let brandBase = 0;
    const vi = (c.VER_ORDER || ["V1"]).indexOf(s.ver || "V1");
    const items = [];
    let brandAdd = 0;
    // ① 经费：各阶段通过奖金（PASS_PRIZE_BY_VER 可配，缺省回退 30万×阶段序号）
    if(this.reviewFailurePolicy()&&s.mission?.ver===s.ver)s.mission.hit=this.missionJudge(s,s.arch,s.paramTarget).hit;
    const mFail = r.qualificationFailed || this.isPassLike(r) && this.isMissionFail();
    if (mFail) {
      /* 未达成任务目标 → 增量经费（doc/23 §3.3）：只按"比已付过钱的最高分好多少"给钱，
         且不推进阶段（r.retry）。Δ≤0 直接 0 元——不倒扣，"负收益"来自奖金覆盖不了工资。 */
      const mp = this.calcMissionPay(r);
      r.mission = { hit: false, delta: mp.delta, q: mp.q, ratio: mp.ratio, main: mp.main, pay: mp.pay };
      r.missionFail = true;
      brandBase = mp.pay;
      /* 优秀评级的品牌加成照发：品牌是「评级的结果」，跟任务目标是否达成无关
         （未达成只影响经费口径，不该顺手把口碑也扣了） */
      if (this.isExcLike(r)) {
        brandAdd += this.changeBrand(c.EXCELLENT_BRAND);
        if (r.verdict === "top") brandAdd += this.changeBrand(c.TOP_BRAND);
      }
      const MUI = ((c.MISSIONS || {}).UI) || {};
      if (mp.pay > 0) {
        this.payoutIncome(mp.pay, { kind: "mission" });
        /* [feature:gameplay-guide-mission-fallback-1-1] */
        items.push({ icon: "\u{1F4C9}", label: r.qualificationFailed ? this.reviewFailurePolicy().UI.ITEM : String(MUI.ITEM_MISS || "较本版本已结算最高分 +{d} 分 · 增量经费").replace("{d}", mp.delta), value: mp.pay });
        /* [/feature:gameplay-guide-mission-fallback-1-1] */
      } else {
        /* [feature:gameplay-guide-mission-fallback-2-1] */
        items.push({ icon: "\u{1F4C9}", label: r.qualificationFailed ? this.reviewFailurePolicy().UI.ZERO : MUI.ITEM_NONE || "未超过本版本已结算最高分 · 无增量经费", value: 0 });
        /* [/feature:gameplay-guide-mission-fallback-2-1] */
      }
    } else if (this.isPassLike(r)) {
      const base = (c.PASS_PRIZE_BY_VER || {})[s.ver || "V1"] != null
        ? c.PASS_PRIZE_BY_VER[s.ver || "V1"] : 300000 * (vi + 1);
      brandBase = base;
      s.brandMilestones = s.brandMilestones || {};
      if (!s.brandMilestones[s.ver]) {
        brandAdd += this.changeBrand((c.BRAND_PASS_BY_VER || {})[s.ver] || 0);
        s.brandMilestones[s.ver] = true;
      }
      this.payoutIncome(base, { kind: "pass" });
      items.push({ icon: "🏦", label: "通过内部评审 · 阶段经费追加", value: base });
      if (this.isExcLike(r)) {
        const ecb = c.EXCELLENT_BRAND != null ? c.EXCELLENT_BRAND : 0;
        const actualExcellentBrand = this.changeBrand(ecb);
        this.payoutIncome(c.EXCELLENT_FUNDING, { kind: "excellent" });
        brandAdd += actualExcellentBrand;
        items.push({ icon: "🌟", label: "优秀评级 · 额外奖励", value: c.EXCELLENT_FUNDING });
        if (r.verdict === "top") {
          const tcb = c.TOP_BRAND != null ? c.TOP_BRAND : 0;
          const actualTopBrand = this.changeBrand(tcb);
          this.payoutIncome(c.TOP_FUNDING, { kind: "top" });
          brandAdd += actualTopBrand;
          items.push({ icon: "👑", label: "顶尖评级 · 追加奖励", value: c.TOP_FUNDING });
        }
      }
    } else if (r.verdict === "veto") {
      brandAdd += this.changeBrand(c.VETO_BRAND);
    }
    // ② 后训练抽卡收益：评分 ≥80 的小模型给额外经费与口碑
    let miniBonus = 0, miniCount = 0;
    for (const m of r.qualificationFailed ? [] : s.miniModels || []) {
      const mb = c.MINI_MODEL_BONUS != null ? c.MINI_MODEL_BONUS : 100000;
      if (m.score >= 80) { miniBonus += mb; miniCount += 1; brandAdd += this.changeBrand(2); }
    }
    if (miniBonus) {
      this.payoutIncome(miniBonus, { kind: "mini" });
      items.push({ icon: "🎰", label: `小模型收益（${miniCount} 个优品）`, value: miniBonus });
    }
    // 品牌溢价只作用于本次主评审经费，重训无分数提升时基数为零。
    const brandRate = brandStars * Math.max(0, Math.min(1, Number(c.BRAND_INCOME_PER_STAR ?? 0.03)));
    const brandGross = !r.qualificationFailed && this.isPassLike(r) ? Math.floor(Math.max(0, brandBase) * brandRate + 1e-8) : 0;
    const brandPay = brandGross > 0 ? this.payoutIncome(brandGross, { kind: "brand" }) : { dividend: 0, net: 0 };
    const brandBenefit = { stars: brandStars, rate: brandRate, base: Math.round(brandBase), gross: brandGross,
      dividend: brandPay.dividend, net: brandPay.net, brandBefore, brandAfter: s.brand };
    if (brandGross > 0) items.push({ icon: "★", label: "品牌溢价 · " + brandStars + " 星加成", value: brandGross });
    r.brandBenefit = brandBenefit;
    // ③ 下一版本：通过且不是最后一版 → 结局页给「进入下一阶段」
    const order = c.VER_ORDER || ["V1"];
    r.nextVer = this.isPassLike(r) && !r.missionFail && vi < order.length - 1
      ? order[vi + 1] : null;
    /* 任务未达成但评审通过 → 不推进阶段，改为重训本阶段（doc/23 决策 ③） */
    r.retry = !!(r.missionFail && (this.isPassLike(r) || r.qualificationFailed));
    /* 末版（V4.5）通过：没有下一阶段，但**不该是"通关即终局"** —— 用户 2026-09-17
       要求「通过 V4.5 后重复 V4.5 阶段」（可以反复刷分/冲榜）。
       ⚠️ 不复用 r.retry：那个标记带「任务未达成」语义（文案用 MUI.OVER_*、重训计数、
          成就口径都绑着它），而通关成就 game_clear 又要求 !r.retry。 */
    r.finalRepeat = !!(this.isPassLike(r) && !r.missionFail && vi >= order.length - 1);
    r.miniBonus = miniBonus;
    /* ④ 用户数 / 能力榜名次：全版本结算都算（内测千人级 / 公测百万级，量级由
       USER_GAIN_MUL_BY_VER 区分，旧 USERS_BY_VER 已废弃）。在结算时算一次写进
       state，渲染只读——旧版写在 render 里，每次重渲染都会再加一遍。 */
    const mul = (c.USER_GAIN_MUL_BY_VER || {})[s.ver || "V1"];
    if (this.isPassLike(r) && mul != null) {
      const gained = Math.round(r.score * mul);
      s.users = (s.users || 0) + gained;
      r.usersGained = gained;
      /* 用户平均评分 / 好评率（第二幕统计框用）：内测 3.6~4.1 分 / 78~85%，
         公测 4.5~4.8 分 / 92~96%（f(verdict)，doc/16 §3.5）。结算时算一次存进 result，
         读档重进结算页数字不会变。 */
      const rnd = (a, b2) => a + Math.random() * (b2 - a);
      const isExc = this.isExcLike(r);
      const beta = this.isBeta(s.ver);   // 公开点唯一来源：GameCore.PUBLIC_FROM_VER（V3.5）
      r.userRating = Math.round((beta
        ? (isExc ? rnd(3.9, 4.1) : rnd(3.6, 3.9))
        : (isExc ? rnd(4.6, 4.8) : rnd(4.5, 4.7))) * 10) / 10;
      r.praiseRate = Math.round(beta
        ? (isExc ? rnd(82, 85) : rnd(78, 83))
        : (isExc ? rnd(93, 96) : rnd(92, 94)));
    }
    /* 能力榜名次：**只用评审分**（2026-09-13 重设计，用户拍板）。
       榜单（RANK_BOARD_BY_VER）里那些对手的分数，就是「该阶段不同团队水平」的**实测评审分** ——
       与玩家同一把尺子 ⇒ 名次可以**直接比分数**，不需要任何换算或插值。
       ⚠️ 旧实现是「手写名次 + 手写榜单分」两套刻度混算：`rank = heat.rank - floor((评分 - heat.score)/2)`，
          heat.score 是 0~100 而评分是三位数 ⇒ 那个减法恒为负 ⇒ **V4 里任何队伍都拿第 1**（已修）。 */
    const board = (c.RANK_BOARD_BY_VER || {})[s.ver || "V1"] || [];
    const myScore = Math.round((r.score || 0) * 10) / 10;
    /* 名次 = 1 + 比我分高的对手数（同分并列，取靠前位置） */
    const bodyRanking = this.embodiedAvailable(s);
    const rank = bodyRanking ? null : (board.length ? 1 + board.filter((row) => (row.score || 0) > myScore).length : 11);
    r.rankPrev = bodyRanking ? null : (s.rank != null ? s.rank : null);
    r.rankUp = bodyRanking ? null : (r.rankPrev != null ? Math.max(0, r.rankPrev - rank) : null);
    s.rank = rank;
    if (this.isPassLike(r) && !r.missionFail && !r.retry && rank != null && rank >= 1 && rank <= 10) {
      this.recordLifeMilestone("first_top10", { rank });
      if (rank === 1) this.recordLifeMilestone("first_rank1", { rank });
    }
    r.rankScore = myScore;                 // 榜上己方行显示的就是评审分本身
    r.rankBoardLen = bodyRanking ? null : board.length;         // 供 UI 判「10 名外」（榜单条数由配置决定）
    const total = items.reduce((a, x) => a + x.value, 0);
    s.bonus = {
      items, total, brandAdd, brandBenefit, verdict: r.verdict,
      ver: s.ver, score: r.score, nextVer: r.nextVer,
    };
    /* 品牌值变化随结果持久化（2026-09-05 用户要求：结算界面要体现品牌值升降） */
    r.brandAdd = brandAdd;
    r.brandNow = Math.round(s.brand || 0);
    s.bonusAct = null;   // 新一轮结算演出从第一幕开始播（读档重进才按 bonusAct 恢复）
    /* 版本快照：奖励演出要用「本版数值 vs 上一版数值」做对比（2026-09-04） */
    this.pushModelSnapshot(s, r);
    /* 增量经费基准（doc/23 §3.3）：已"付过钱"的最高分。
       重训时按这个基准比较，不为同一段进步付第二次钱。 */
    s.incBase = Math.max(s.incBase || 0, Math.round((r.qualifyingScore ?? r.score ?? 0) * 10) / 10);
    /* 模型库（图鉴）+ 阶段打点（doc/24） */
    this.recordCodex(r);
    this.recordStageMark(r);
    this.recordLifeAchievementResult(r);
    /* ---- 成就系统的「本局累计」计数（doc/35 · 2026-09-16）----
       全部写在这里/既有唯一入口里，**不新增第二条写入路径**（技能 §7.4 的教训）。
       顺序要紧：先更计数，再判成就 —— 否则同一次结算里刚达成的条件读不到。 */
    this.achvCounters();
    if (rank === 1) s.rank1Params[s.paramTarget || 0] = true;     // 「登顶」= 排行榜第一
    if (rank != null) s.rankLog.push({ ver: s.ver || "V1", rank: rank });
    if (s.rankLog.length > 40) s.rankLog.splice(0, s.rankLog.length - 40);
    if (r.retry) s.verRetry[s.ver || "V1"] = (s.verRetry[s.ver || "V1"] || 0) + 1;
    if (Number(s.funding || 0) <= 0) s.fundingZeroTimes += 1;
    /* 成败共用同一套判定 ⇒「翻车成就」天然免费；结果挂 s.bonus.newAchv 给第四幕 */
    this.checkAchievements(r);
    /* 只有拿到钱的结局才播奖金演出；被否决/未通过就直接进结算页（那不是值得庆祝的时刻）。 */
    s.phase = (items.length && total > 0) ? "bonus" : "over";
    r.settled = true;
    // The real result is complete before the one cloud submission hook runs.
    if (window.ToyCloud) {
      try { window.ToyCloud.onReviewSettled(s, r); } catch (e) {}
    }
    return s.result;
  },

  /* ---- DOC 26 P2 评级四档判定辅助 ----
     verdict：pass=合格 / excellent=优秀 / top=顶尖 / veto|fail=不及格。
     top 视为「更强的优秀」——所有原 excellent 分支一律用 isExcLike()，省得处处 `|| "top"`。 */
  isPassLike(r) { const v = r && r.verdict; return v === "pass" || v === "excellent" || v === "top"; },
  isExcLike(r)  { const v = r && r.verdict; return v === "excellent" || v === "top"; },
  isTopV(r)     { return !!(r && r.verdict === "top"); },
  /* 优秀/顶尖的附加奖励：顶尖在优秀基础上额外发 TOP_FUNDING/TOP_BRAND */
  excFunding() { return (this.cfg.EXCELLENT_FUNDING != null ? this.cfg.EXCELLENT_FUNDING : 500000); },
  topFunding() { return (this.cfg.TOP_FUNDING != null ? this.cfg.TOP_FUNDING : 800000); },

  /* ===== 阶段任务目标（doc/23）=====
     手游任务链：每阶段一个目标，达成 → 主线奖金 + 推进；暂缓 → 增量经费（30%~70%）+ 留在本阶段重训。
     判定口径（2026-09-29 用户拍板）：只问「架构 + 参数」两道 —— 架构 == 任务钉死的、
     参数 ≥ 任务下限。不再看「这个组合此前用过没有」（组合去重整条退场：
     玩家可以反复训练同一组合，直到轴达标 / 分数达标为止）。 */
  missionOf(ver) {
    const M = this.cfg.MISSIONS || {};
    return (M.BY_VER || {})[(ver != null ? ver : (this.state && this.state.ver)) || "V1"] || {};
  },
  /* 判定：本阶段选 (arch, param) 是否达成任务目标 */
  missionJudge(s, arch, param) {
    const st = s || this.state;
    const M = this.cfg.MISSIONS || {};
    if (M.ENABLED === false) return { hit: true, reason: "off" };
    const m = this.missionOf(st.ver);
    if (m.arch && arch !== m.arch) return { hit: false, reason: "arch", need: m };
    if (m.param && (param || 0) < m.param) return { hit: false, reason: "param", need: m };
    return { hit: true, need: m };
  },
  /* 本阶段任务是否未达成（结算时读 s.mission；老档/缺字段按达成处理，避免一加载就被判暂缓） */
  isMissionFail() {
    const s = this.state, M = this.cfg.MISSIONS || {};
    if (M.ENABLED === false) return false;
    const m = s.mission;
    if (!m || m.ver !== s.ver) return false;
    if (m.hit === false && !(this.reviewFailurePolicy() && this.missionJudge(s,s.arch,s.paramTarget).hit)) return true;
    /* 2026-09-10 doc/27 P4：**轴达标**也是任务达成条件之一 ——
       立项时只能判「架构 × 参数」组合，轴要练完才知道 → 判定放这里（结算时）。
       未配置 axisMin 的阶段不受影响；老档（无该字段）同样不受影响。 */
    const amin = (this.missionOf(s.ver) || {}).axisMin || {};
    for (const id of Object.keys(amin)) {
      if ((s[id] || 0) < amin[id]) return true;
    }
    return false;
  },
  /* 任务轴目标的展示文案（立项任务卡 / 结算页共用；无目标返回空串） */
  missionAxisText(ver) {
    const amin = (this.missionOf(ver != null ? ver : (this.state && this.state.ver)) || {}).axisMin || {};
    const ids = Object.keys(amin);
    if (!ids.length) return "";
    return ids.map((id) => this.statLabel(id) + " ≥ " + amin[id]).join("、");
  },
  /* 未达成时的增量经费（doc/23 §3.3）
     Δ = 本版分 − 已付过钱的最高分（s.incBase）；ΔLine = 本阶段通过线 − 上一阶段通过线。
     用通过线间距归一化，而不是百分比 —— evaluate 的 score 是累计全量，
     百分比会让人人顶到 70% 上限。 */
  /* [feature:review-income-base-history] */
  reviewIncomeBase(state) {
    const s = state || this.state || {};
    let base = Number(s.incBase);
    if (!Number.isFinite(base) || base < 0) base = 0;
    // These archives are written only by finish(), after a committed review.
    // Cloud slim snapshots may drop codexLog and keep only the codex best.
    const archives = [s.modelHistory, s.codexLog];
    if (s.codex && typeof s.codex === "object" && !Array.isArray(s.codex)) {
      for (const entry of Object.values(s.codex)) {
        if (entry && typeof entry === "object") archives.push([entry.first, entry.best, entry.last]);
      }
    }
    for (const records of archives) {
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        if (!record || record.ver !== s.ver) continue;
        const score = Number(record.qualifyingScore ?? record.score);
        if (Number.isFinite(score) && score >= 0) base = Math.max(base, score);
      }
    }
    return base;
  },
  /* [/feature:review-income-base-history] */
  calcMissionPay(r) {
    const c = this.cfg, s = this.state, M = c.MISSIONS || {};
    const INC = M.INC || { FLOOR: 0.30, CEIL: 0.70, SLOPE: 0.40 };
    const order = c.VER_ORDER || ["V1"];
    const vi = Math.max(0, order.indexOf(s.ver || "V1"));
    const line = ((c.PASS_BY_VER || {})[s.ver || "V1"] || {}).score || 1;
    const pv = vi > 0 ? order[vi - 1] : null;
    const pLine = pv ? (((c.PASS_BY_VER || {})[pv] || {}).score || 0) : 0;
    const dLine = Math.max(1, line - pLine);
    const delta = Math.round(((r.qualifyingScore ?? r.score ?? 0) - (s.incBase || 0)) * 10) / 10;
    const q = delta / dLine;
    const prize = (c.PASS_PRIZE_BY_VER || {})[s.ver || "V1"] != null
      ? c.PASS_PRIZE_BY_VER[s.ver || "V1"] : 300000 * (vi + 1);
    const main = prize + (this.isExcLike(r) ? (c.EXCELLENT_FUNDING || 0) + (this.isTopV(r) ? (c.TOP_FUNDING || 0) : 0) : 0);
    let ratio = 0;
    if (delta > 0) ratio = r.qualificationFailed ? INC.FLOOR : Math.min(INC.CEIL, Math.max(INC.FLOOR, (INC.FLOOR || 0) + (INC.SLOPE || 0) * q));
    return { delta, q: Math.round(q * 100) / 100, ratio: Math.round(ratio * 100) / 100,
             main, pay: Math.round(main * ratio) };
  },
  /* 立项面板用：当前草稿是否达成目标 + 提示文案 */
  missionPreview(arch, param) {
    const s = this.state, M = this.cfg.MISSIONS || {};
    if (M.ENABLED === false) return { hit: true, name: "", desc: "", tip: "" };
    const m = this.missionOf(s.ver);
    const j = this.missionJudge(s, arch, param);
    const UI = M.UI || {};
    return { hit: !!j.hit, reason: j.reason || "", name: m.name || "本阶段任务", desc: m.desc || "",
             /* 2026-09-10 doc/27 P4：轴目标（立项时先告知，结算时才算数）。
                ⚠️ 2026-09-14：立项卡**已不再渲染** axisText（用户要求删掉那串「记忆 ≥ …」）——
                字段保留给核心侧/测试用（missionAxisText 是格式化真源）；轴没达标时由
                结算页以诊断口径提示（见 game_ui 的 dg-over-axis-tip）。 */
             axisMin: m.axisMin || {}, axisText: this.missionAxisText(s.ver),
             tip: j.hit ? (UI.HIT || "") : (UI.MISS || "") };
  },

  /* ===== 模型库（图鉴）+ 阶段打点（doc/24 · 2026-09-07）=====
     图鉴按「架构:参数」聚合，只跟**当前存档**（用户拍板，不做跨局 localStorage）。
     ⚠️ 不写死 20 格：网格渲染由配置 ARCHITECTURES × TARGET_PARAMS 驱动，
        以后加架构 / 加参数档会自动多出来；配置外的 key（老档、改配）也会补进行列。 */
  codexKey(arch, param) { return (arch || "dense") + ":" + (param != null ? param : 7); },
  /* 一次结算的完整快照（图鉴条目与阶段打点共用，字段尽量全，供结局动画取用） */
  codexSnap(r) {
    const s = this.state;
    return {
      name: s.modelName || "", ver: s.ver || "V1", week: s.week || 0,
      qualifyingScore: r.qualifyingScore ?? r.score, qualificationFailed: !!r.qualificationFailed,
      score: Math.round((r.score || 0) * 10) / 10, verdict: r.verdict || "", missionFail: !!r.missionFail, retry: !!r.retry,
      arch: s.arch || "dense", param: s.paramTarget || 0,
      code: Math.round(s.code || 0), text: Math.round(s.text || 0),
      safety: Math.round(s.safety || 0), stability: Math.round(s.stability || 0),
      /* 2026-09-10 doc/27 P3：追加能力轴也进快照（图鉴卡片 / 流水 / 阶段打点都要用）。
         四维键保留在上面是为了兼容老档与既有 UI 读取点，这里是**增量**。 */
      ...(window.V35.activeAxes(s) || []).reduce((o, k) => (o[k] = Math.round(s[k] || 0), o), {}),
      brand: Math.round(s.brand || 0), users: Math.round(s.users || 0),
      rank: s.rank != null ? s.rank : null,
      team: (s.engineers || []).filter((e) => !e.resigned).length,
      funding: Math.round(s.funding || 0),
      missionHit: s.mission ? s.mission.hit !== false : true,
      at: new Date().toISOString(),
    };
  },
  /* 图鉴收录：跑完评审（任何评级）即收录；best 只在刷新最高分时覆盖 */
  recordCodex(r) {
    const s = this.state;
    if (!s.codex || typeof s.codex !== "object") s.codex = {};
    if (!Array.isArray(s.codexLog)) s.codexLog = [];
    const snap = this.codexSnap(r);
    const key = this.codexKey(snap.arch, snap.param);
    const e = s.codex[key] || (s.codex[key] = { arch: snap.arch, param: snap.param, times: 0, best: null, first: null, last: null });
    e.times += 1;
    if (!e.first) e.first = snap;
    e.last = snap;
    if (!e.best || snap.score > e.best.score || snap.score === e.best.score && snap.qualifyingScore > (e.best.qualifyingScore ?? e.best.score)) e.best = snap;
    const cap = ((this.cfg.CODEX || {}).LOG_MAX) || 100;
    s.codexLog.push(snap);
    if (s.codexLog.length > cap) s.codexLog.splice(0, s.codexLog.length - cap);
    return e;
  },
  /* 阶段打点：只记「首次通过」（用户 2026-09-07 拍板）——该阶段第一次 pass/excellent 才写，
     后续重训（无论更高分还是未达成）都不再覆盖 */
  recordStageMark(r) {
    const s = this.state;
    if (!s.stageMarks || typeof s.stageMarks !== "object") s.stageMarks = {};
    const ver = s.ver || "V1";
    if (s.stageMarks[ver]) return s.stageMarks[ver];
    if (!this.isPassLike(r)) return null;   // DOC 26 P2：top 也计入"首次通过"
    s.stageMarks[ver] = this.codexSnap(r);
    return s.stageMarks[ver];
  },

  /* ================================================================
     成就系统（2026-09-16 新增 · doc/35）
     ----------------------------------------------------------------
     · **判定入口**：`finish()` 里 `recordStageMark(r)` 之后调一次 `checkAchievements(r)`。
       成败两种情形共用同一套判定 ⇒「翻车成就」天然免费，不需要第二条路径。
     · **真源 = `window.AchieveStore`**（独立 localStorage 键，跨局永存），
       **不是**存档内字段 —— 用户拍板"重开新档也要在"，只有独立键能做到。
       本次新解锁的 key 数组挂 `s.bonus.newAchv`，给第四幕演出当数据源（UI 零判定）。
     · ⚠️ **未知 `cond.type` 必须响亮地失败**（`console.error` + 返回 false），
       绝不能静默跳过 —— 那是本项目最贵的教训（技能 §7.10「文案承诺了，机制没跟上」）。
     · ⚠️ **条件里不许写死条数**（全部论文 / 全架构 / 全聊天分支一律现取真源），
       否则以后往内容里加东西，这些成就就静默变成死成就或白送。
     ================================================================ */
  ACHV_COND_TYPES: {
    /* Ⅰ 登顶 */            param_rank1: ["params"],
    /* 维度类 */            dim_above: ["dim", "mul"], dim_below: ["dim", "mul"],
                             dim_ratio_above: ["dim", "mul"], dim_max_ratio_above: ["mul"],
                             dim_at_cap_all: [], balanced_false: [], axis_only_miss: [],
    /* 结局类 */            mission_fail: [], bonus_zero: [], funding_below: ["n"],
                             funding_zero_times: ["n"], retry_times: ["n"],
                             verdict_is: ["v"], pass_like: [], game_clear: [], no_retry: [],
    /* 排名类 */            rank_le: ["n"], rank_hold: ["n", "stages"],
    /* 进度/收集类 */        ver_reach: ["ver"], codex_full: [], codex_count: ["n"],
                             arch_all: [], arch_count: ["n"], papers_ge: ["n"], paper_all: [],
                             all_stage_excellent: [],
    /* 团队/资源类 */        energy_all_below: ["n"], team_full: [], team_resigned: ["n"],
                             team_alive_eq: ["n"], burnout_count: ["n"], corpus_gap: ["pct"],
                             hire_zero: [],
    /* 内容类（隐藏成就） */  chat_all_seen: [], note_all: [],
    /* 具身一生（doc/70） */ life_stage_pass: ["ver"], life_stage_top: ["ver"],
                             life_body_owned: ["ver"], life_awake: [], life_mentor: [],
                             life_city_stop: ["id"], life_city_all: [], life_feed_count: ["n"], life_managed: [],
    /* 组合 */              all: ["of"], any: ["of"],
  },

  /* Durable, save-local facts. No current stage or unread report is a success. */
  lifeAchievementStages() {
    return ["V5", "V5.5", "V6", "V6.5"].filter(ver => (this.cfg.VER_ORDER || []).includes(ver));
  },
  lifeAchievementPassed(record, ver, top) {
    return !!(record && record.ver === ver && record.missionFail === false && record.missionHit !== false
      && record.retry !== true && (top ? record.verdict === "top" : ["pass", "excellent", "top"].includes(record.verdict)));
  },
  recordLifeAchievementResult(r) {
    const s = this.state, ver = s && s.ver;
    const record = {...r, ver, missionFail:!!(r && r.missionFail)};
    if (!r || !this.lifeAchievementStages().includes(ver) || !this.lifeAchievementPassed(record, ver)) return false;
    return this.rememberLifeAchievementStage({...record, at:new Date().toISOString()});
  },
  rememberLifeAchievementStage(record) {
    const s = this.state, ver = record && record.ver;
    if (!this.lifeAchievementStages().includes(ver) || !this.lifeAchievementPassed(record, ver)) return false;
    if (!s.lifeAchievements || typeof s.lifeAchievements !== "object" || Array.isArray(s.lifeAchievements)) s.lifeAchievements = {schema:1, stages:{}};
    if (!s.lifeAchievements.stages || typeof s.lifeAchievements.stages !== "object" || Array.isArray(s.lifeAchievements.stages)) s.lifeAchievements.stages = {};
    const old = s.lifeAchievements.stages[ver];
    if (this.lifeAchievementPassed(old, ver) && (old.verdict === "top" || record.verdict !== "top")) return false;
    const fact = {ver, verdict:record.verdict, missionFail:false, retry:false};
    if (typeof record.at === "string" && Number.isFinite(Date.parse(record.at))) fact.at = record.at;
    s.lifeAchievements.stages[ver] = fact;
    return true;
  },
  lifeAchievementStage(ver, top) {
    if (!this.lifeAchievementStages().includes(ver)) return false;
    const s = this.state, records = [], mark = (s.stageMarks || {})[ver];
    if (mark && typeof mark === "object") records.push({...mark, ver:mark.ver || ver});
    records.push(...(Array.isArray(s.modelHistory) ? s.modelHistory : []), ...(Array.isArray(s.codexLog) ? s.codexLog : []));
    Object.values(s.codex || {}).forEach(entry => { if (entry && typeof entry === "object") records.push(entry.first, entry.best, entry.last); });
    const result = s.result;
    if (s.ver === ver && result && result.settled === true) records.push({...result, ver});
    records.filter(r => this.lifeAchievementPassed(r, ver)).forEach(r => this.rememberLifeAchievementStage(r));
    return this.lifeAchievementPassed(s.lifeAchievements && s.lifeAchievements.stages && s.lifeAchievements.stages[ver], ver, top);
  },
  lifeAchievementCondition(cond) {
    if (!cond || typeof cond !== "object") return false;
    if (String(cond.type || "").startsWith("life_")) return true;
    return ["all", "any"].includes(cond.type) && Array.isArray(cond.of) && cond.of.some(c => this.lifeAchievementCondition(c));
  },
  checkLifeAchievements() {
    const s = this.state, store = this.achvStore(), newly = [];
    if (!s || !store) return newly;
    for (const a of this.cfg.ACHIEVEMENTS || []) {
      if (!a || !a.key || !this.lifeAchievementCondition(a.cond) || store.has(a.key)) continue;
      try {
        if (this.achvCondOk(a.cond, null) && store.unlock(a.key, {ver:s.ver || "", week:s.week || 0, slot:"life-backfill"})) newly.push(a.key);
      } catch (e) { console.warn("[ACHV] life backfill", a.key, e); }
    }
    return newly;
  },

  achvStore() {
    return (typeof window !== "undefined" && window.AchieveStore) ? window.AchieveStore : null;
  },
  /* 「本局累计」类计数：全部在既有写入点顺手 +1，**不新增写入路径** */
  achvCounters() {
    const s = this.state;
    if (!s.verRetry || typeof s.verRetry !== "object") s.verRetry = {};
    if (!s.rank1Params || typeof s.rank1Params !== "object") s.rank1Params = {};
    if (!Array.isArray(s.rankLog)) s.rankLog = [];
    if (!isFinite(Number(s.hireCount))) s.hireCount = 0;
    if (!isFinite(Number(s.fundingZeroTimes))) s.fundingZeroTimes = 0;
    return s;
  },
  achvRetryTotal() {
    const vr = this.state.verRetry || {};
    return Object.keys(vr).reduce((a, k) => a + (Number(vr[k]) || 0), 0);
  },
  achvAliveCount() {
    return (this.state.engineers || []).filter((e) => e && !e.resigned).length;
  },
  achvArchGot() {
    const got = {};
    Object.keys(this.state.codex || {}).forEach((k) => {
      const a = String(k).split(":")[0];
      if (a) got[a] = (got[a] || 0) + 1;
    });
    return got;
  },
  achvArchAll() {
    const all = (this.cfg.ARCHITECTURES || []).filter((a) => a && a.id).map((a) => a.id);
    if (!all.length) return false;
    const got = this.achvArchGot();
    return all.every((id) => got[id] > 0);
  },
  /* 图鉴满格：**只算合法格**（落在各架构自身 maxParam 之内）。
     ⚠️ 不用 archMaxParam() —— 它会把当前算力档位也算进去，是**会随时间变**的值
     （低档位时格子少、买了 GPU 格子变多）⇒ 用它会让成就时而白送时而死锁。 */
  achvCodexFull() {
    const c = this.cfg, s = this.state;
    const archs = (c.ARCHITECTURES || []).filter((a) => a && a.id);
    const params = c.TARGET_PARAMS || [];
    if (!archs.length || !params.length) return false;
    const widest = Math.max.apply(null, params);
    let cells = 0;
    for (const a of archs) {
      const mx = a.maxParam > 0 ? a.maxParam : widest;
      for (const p of params) {
        if (p > mx) continue;                     // 非法格：永远填不上，算进去就是死成就
        cells++;
        if (!s.codex || !s.codex[a.id + ":" + p]) return false;
      }
    }
    return cells > 0;
  },
  /* 论文全掌握：真源 = PAPER.CANDIDATES_BY_VER，范围 = **全部阶段**（2026-09-24 用户拍板）——
     旧口径只数「已到达阶段」，V1 读完当期 1 篇就白拿史诗。论文只在所属阶段出现
     ⇒ 要求全 8 篇 = 每个阶段的论文都要在当期读完、一路走到 V4.5。 */
  achvPaperAll() {
    const c = this.cfg, s = this.state;
    const order = c.VER_ORDER || ["V1"];
    const byVer = (c.PAPER && c.PAPER.CANDIDATES_BY_VER) || {};
    const need = [];
    order.forEach((v) => {
      (byVer[v] || []).forEach((p) => {
        const no = (p && typeof p === "object") ? p.no : p;
        if (no != null && need.indexOf(no) < 0) need.push(no);
      });
    });
    if (!need.length) return false;
    const owned = (s.papersOwned || []).map((x) => this.paperNoOf(x));
    return need.every((no) => owned.indexOf(no) >= 0);
  },
  /* 记事本收集齐：真源 = CHAT_TREE2.NOTES（现取，不写死条数） */
  achvNoteAll() {
    const ids = Object.keys(((this.cfg.CHAT_TREE2 || {}).NOTES) || {});
    if (!ids.length) return false;
    const nb = (this.state.notebook || []).map(String);
    return ids.every((id) => nb.indexOf(String(id)) >= 0);
  },
  /* 看遍聊天测试全部答案：真源 = CHAT_TREE2.BY_VER[*].opts[*].ans[dumb|full]，
     范围 = **全部阶段**（2026-09-24 用户拍板）——
     旧口径只数「已到达阶段」，V1 把当期树聊完就白拿传说。
     c2.seen 跨阶段累积（_enterStage 只清 chatNode/_lastReplyIdx）⇒ 一局内可达。 */
  achvChatAllSeen() {
    const c = this.cfg, s = this.state;
    const byVer = ((c.CHAT_TREE2 || {}).BY_VER) || {};
    const order = c.VER_ORDER || ["V1"];
    const seen = (s.c2 && s.c2.seen) || {};
    const need = [];
    order.forEach((v) => {
      const opts = ((byVer[v] || {}).opts) || {};
      Object.keys(opts).forEach((oid) => {
        const ans = (opts[oid] && opts[oid].ans) || {};
        ["dumb", "full"].forEach((k) => {
          (ans[k] || []).forEach((a) => {
            if (a && a.id != null && need.indexOf(String(a.id)) < 0) need.push(String(a.id));
          });
        });
      });
    });
    if (!need.length) return false;
    /* ⚠️ 必须用 hasOwnProperty 判存在，**不能** `!!seen[id]` ——
       这一格存的是"哪一周看到的"，而第 0 周写入的值就是 `0`（falsy）⇒
       用真值判断会把 V1 开局看到的那几条全部当成"没看过"（踩过）。 */
    return need.every((id) => Object.prototype.hasOwnProperty.call(seen, id));
  },

  /* 单条条件判定。`r` = s.result（evaluate() 的返回） */
  achvCondOk(cond, r) {
    const c = this.cfg, s = this.state;
    if (!cond || typeof cond !== "object") return false;
    const t = cond.type;
    if (!this.ACHV_COND_TYPES[t]) {
      if (typeof console !== "undefined" && console.error) {
        console.error("[成就] 未知条件类型 " + t + " ⇒ 该成就永远不会解锁（引擎与配置不同源？）");
      }
      return false;
    }
    const pass = this.passLine();
    const cap = this.statCap();
    const dims = ["code", "text", "safety", "stability"];
    const mul = cond.mul != null ? Number(cond.mul) : 1;
    const groups = window.V35.mergedGroups(s);
    const sources = d => (groups.find(g => g.key === d || g.sources.includes(d)) || { sources: [d] }).sources;
    const line = d => sources(d).reduce((n, k) => n + Number(pass[k] || 0), 0);
    const val = d => sources(d).reduce((n, k) => n + Number(s[k] || 0), 0);
    const maxRatio = () => {
      let best = 0;
      dims.forEach((d) => { const l = line(d); if (l > 0) best = Math.max(best, val(d) / l); });
      return best;
    };
    switch (t) {
      case "param_rank1": {
        const got = s.rank1Params || {};
        return (cond.params || []).length > 0 && cond.params.every((p) => !!got[p]);
      }
      case "dim_above":  return val(cond.dim) >= line(cond.dim) * mul;
      case "dim_below":  return val(cond.dim) < line(cond.dim) * mul;
      case "dim_ratio_above":     return !!r && r.balanced === false && val(cond.dim) >= line(cond.dim) * mul;
      case "dim_max_ratio_above": return !!r && r.balanced === false && maxRatio() >= mul;
      case "dim_at_cap_all":
        return dims.every((d) => cap[d] != null && Math.round(val(d)) === Math.round(sources(d).reduce((n, k) => n + (cap[k] || 0), 0)));
      case "balanced_false": return !!r && r.balanced === false;
      case "axis_only_miss": {
        /* 四维全过线、总评也过线，**只**差能力轴 —— 精确到"唯一的失败原因就是轴" */
        if (!this.v35On()) return false;
        const ck = (r && r.checks) || {};
        return !!(ck.code && ck.text && ck.safety && ck.stability && ck.score
                  && r.excellent === false && r.axisOk === false);
      }
      case "mission_fail": return !!(s.mission && s.mission.ver===s.ver && !this.missionJudge(s,s.arch,s.paramTarget).hit);
      case "retry_times": return ((s.verRetry || {})[s.ver || "V1"] || 0) >= Number(cond.n || 0);
      case "bonus_zero": return !!s.bonus && Number(s.bonus.total || 0) <= 0;
      case "funding_below": return Number(s.funding || 0) <= Number(cond.n || 0);
      case "funding_zero_times": return Number(s.fundingZeroTimes || 0) >= Number(cond.n || 0);
      case "rank_le": return s.rank != null && Number(s.rank) <= Number(cond.n);
      case "rank_hold": {
        const need = Math.max(1, Number(cond.stages || 1));
        const log = (s.rankLog || []).slice(-need);
        return log.length >= need && log.every((x) => x && Number(x.rank) <= Number(cond.n));
      }
      case "verdict_is": return !!r && r.verdict === cond.v;
      case "pass_like": return this.isPassLike(r);
      case "ver_reach": {
        const order = c.VER_ORDER || ["V1"];
        const want = order.indexOf(cond.ver);
        return want >= 0 && order.indexOf(s.ver || "V1") >= want;
      }
      case "codex_full": return this.achvCodexFull();
      case "codex_count": return Object.keys(s.codex || {}).length >= Number(cond.n || 0);
      case "arch_all": return this.achvArchAll();
      case "arch_count": return Object.keys(this.achvArchGot()).length >= Number(cond.n || 0);
      case "papers_ge": return (s.papersOwned || []).length >= Number(cond.n || 0);
      case "paper_all": return this.achvPaperAll();
      case "energy_all_below": {
        /* 2026-09-22：体力是每人一份，岗位标量只剩「该岗位人均体力」的派生含义
         ⇒ 这里判的是「三个岗位的人均体力都 ≤ n」。 */
        if (!this.v35On()) return false;
        const e = (s.v35 || {}).energy || {};
        if (e.pre == null || e.data == null || e.post == null) return false;
        const n = Number(cond.n || 0);
        return Number(e.pre) <= n && Number(e.data) <= n && Number(e.post) <= n;
      }
      case "team_full": return this.isPassLike(r) && this.achvAliveCount() >= this.seatCap();
      case "team_resigned":
        return (s.engineers || []).filter((e) => e && e.resigned).length >= Number(cond.n || 1);
      case "team_alive_eq": return this.isPassLike(r) && this.achvAliveCount() === Number(cond.n);
      case "burnout_count":
        return (s.engineers || []).filter((e) => e && !e.resigned && Number(e.energy || 0) <= 0).length >= Number(cond.n || 0);
      case "corpus_gap": {
        /* 语料缺口：直接读 V35 周结算写下的 weekly 记录（gap 是 0~1 的比例） */
        const wk = ((s.v35 || {}).weekly || []).slice(-1)[0];
        const gap = wk && wk.gap != null ? Number(wk.gap) * 100 : 0;
        return gap >= Number(cond.pct || 0);
      }
      case "game_clear": return !!(r && !r.nextVer && !r.retry && this.isPassLike(r));
      case "no_retry":
        return !!(r && !r.nextVer && !r.retry && this.isPassLike(r)) && this.achvRetryTotal() === 0;
      case "all_stage_excellent": {
        /* ⚠️ 必须**打满全部阶段**才算，否则 V1 拿到优秀就提前解锁了。
           ⚠️ `stageMarks` 只记「首次通过」⇒ 某阶段第一次是 pass、后来重训到优秀也不算
              （这是有意的：这是"每一段第一次就打成优秀"的完美主义成就）。 */
        const order = c.VER_ORDER || ["V1"];
        const marks = s.stageMarks || {};
        if (order.some((v) => !marks[v])) return false;
        return order.every((v) => {
          const m = marks[v];
          return !!m && (m.verdict === "excellent" || m.verdict === "top");
        });
      }
      case "chat_all_seen": return this.achvChatAllSeen();
      case "note_all": return this.achvNoteAll();
      case "hire_zero": return Number(s.hireCount || 0) === 0;
      case "life_stage_pass": return this.lifeAchievementStage(cond.ver, false);
      case "life_stage_top": return this.lifeAchievementStage(cond.ver, true);
      case "life_body_owned": {
        if (!this.lifeAchievementStages().includes(cond.ver)) return false;
        const row = ((c.FACTORY || {}).BY_VER || {})[cond.ver], rec = s.bodyFactory && s.bodyFactory.stages && s.bodyFactory.stages[cond.ver];
        return !!(row && rec && (row.TIERS || []).some(t => t && t.id === rec.tier && Number(t.units) >= Math.max(1, Number(row.REQUIRED_UNITS) || 1)
          && Number.isFinite(Number(rec.invested)) && Number(rec.invested) >= Number(t.price)
          && (Number(rec.invested) > 0 || Number(t.price) === 0 && Number.isFinite(Number(rec.purchasedAt)) && Number.isFinite(Number(rec.purchasedWeek)))));
      }
      case "life_awake": return !!(s.embodiedEra && s.embodiedEra.bodyAwakened === true && s.embodiedEra.podExitSeen === true);
      case "life_mentor": {
        const mentor = this.engByKey((c.EMBODIED || {}).MENTOR_KEY || "eng_embodied_mentor");
        return !!(mentor && (s.engineers || []).some(e => e && (e.no === mentor.no || e.key === mentor.key)
          && (e.traits || []).some(t => t && t.type === "embodied" && Number(t.level) >= 4)));
      }
      case "life_city_stop": {
        const route = ((c.CITY_JOURNEY || {}).STOPS || []).filter(n => n && n.id && Array.isArray(n.steps) && n.steps.length);
        return !!(typeof cond.id === "string" && route.some(n => n.id === cond.id) && s.cityJourney
          && Array.isArray(s.cityJourney.completedStops) && s.cityJourney.completedStops.includes(cond.id));
      }
      case "life_city_all": {
        const route = ((c.CITY_JOURNEY || {}).STOPS || []).filter(n => n && n.id && Array.isArray(n.steps) && n.steps.length);
        const done = s.cityJourney && s.cityJourney.completedStops;
        return route.length > 0 && Array.isArray(done) && route.every(n => done.includes(n.id));
      }
      case "life_feed_count": {
        const care = s.care, n = Number(cond.n);
        return !!(care && care.events && care.events.feed === true && Number.isInteger(n) && n > 0
          && this.lifeAchievementStages().reduce((total, ver) => {
            const value = (care.stageFeeds || {})[ver];
            return total + (Number.isSafeInteger(value) && value > 0 ? value : 0);
          }, 0) >= n);
      }
      case "life_managed": {
        const last = s.care && s.care.automation && s.care.automation.last;
        return !!(last && ["talk", "raise", "rest"].includes(last.kind) && typeof last.id === "string" && last.id
          && Number.isSafeInteger(last.whaleEnergyCost) && last.whaleEnergyCost > 0
          && ((last.kind === "rest" && last.pending === true) || Number(last.gain) > 0));
      }
      case "all": return (cond.of || []).length > 0 && cond.of.every((x) => this.achvCondOk(x, r));
      case "any": return (cond.of || []).some((x) => this.achvCondOk(x, r));
      default:
        console.error("[成就] 条件类型已在白名单里但引擎没实现：" + t);
        return false;
    }
  },

  /* 跑一次全表判定，返回**本次真正新解锁**的 key 数组（顺序 = 配置顺序） */
  checkAchievements(r) {
    const s = this.state;
    const store = this.achvStore();
    const list = this.cfg.ACHIEVEMENTS || [];
    if (!store || !list.length) return [];
    this.achvCounters();
    const newly = [];
    for (const a of list) {
      if (!a || !a.key) continue;
      if (store.has(a.key)) continue;                    // 已解锁 → 跳过（永不重复）
      let ok = false;
      try { ok = this.achvCondOk(a.cond, r); }
      catch (e) {
        console.error("[成就] 条件判定抛错：" + a.key, e);   // 单条出错不许拖垮整场结算
        ok = false;
      }
      if (!ok) continue;
      store.unlock(a.key, {
        ver: s.ver || "V1", week: s.week || 0,
        verdict: (r && r.verdict) || "", slot: "auto",
      });
      newly.push(a.key);
    }
    /* 第四幕的数据源：与 s.bonus.items/total 同处、随结算存活，读档重进结算页能恢复 */
    if (s.bonus && typeof s.bonus === "object") s.bonus.newAchv = newly.slice();
    if (newly.length) console.log("[成就] 本次新解锁", newly.length, "条：", newly.join(", "));
    return newly;
  },

  /* 图鉴网格：行 = 架构、列 = 参数档，全部来自配置；配置外的实际记录补在后面 */
  codexGrid() {
    const c = this.cfg, s = this.state;
    const archs = (c.ARCHITECTURES || []).map((a) => ({ id: a.id, name: a.name || a.id }));
    const params = (c.TARGET_PARAMS || [7, 13, 34, 70]).slice();
    const codex = s.codex || {};
    for (const k of Object.keys(codex)) {
      const [a, p] = String(k).split(":");
      if (!archs.some((x) => x.id === a)) archs.push({ id: a, name: a });
      const np = Number(p);
      if (np && params.indexOf(np) < 0) params.push(np);
    }
    params.sort((x, y) => x - y);
    return { archs, params, codex };
  },

  /* 模型快照存档（2026-09-04 奖励演出对比用）
     每次结算把本版最终数值写进 s.modelHistory（同版本重训 = 覆盖，不重复累积）；
     s.prevSnap = 最后一条「不同版本」的快照，作为奖励演出的对比基准（首版为 null）。 */
  pushModelSnapshot(s, r) {
    if (!s) return null;
    const v35 = this.v35On && this.v35On();
    const corpus = v35 && s.v35 && s.v35.corpus ? s.v35.corpus.token : (s.corpus || 0);
    const snap = {
      ver: s.ver || "V1",
      param: s.paramTarget || 0,
      code: Math.round(s.code || 0),
      text: Math.round(s.text || 0),
      safety: Math.round(s.safety || 0),
      stability: Math.round(s.stability || 0),
      qualifyingScore: r ? r.qualifyingScore ?? r.score : 0, qualificationFailed: !!r?.qualificationFailed,
      score: r ? Math.round((r.score || 0) * 10) / 10 : 0,
      brand: Math.round(s.brand || 0),
      users: Math.round(s.users || 0),
      corpus: Math.round(corpus || 0),
      papers: (s.papersOwned || []).length,
      mini: (s.miniModels || []).length,
      team: (s.engineers || []).filter((e) => !e.resigned).length,
      week: s.week || 0,
      verdict: r ? r.verdict : "",
      arch: s.arch || "dense", missionFail: !!(r && r.missionFail), retry: !!(r && r.retry), missionHit: !(s.mission && s.mission.hit === false),
      ...(window.V35.activeAxes(s) || []).reduce((o,k)=>(o[k]=Math.round(s[k]||0),o), {}),
    };
    if (!Array.isArray(s.modelHistory)) s.modelHistory = [];
    /* 先取对比基准（写入前），否则同版本覆盖会把自己当成上一版 */
    let prev = null;
    for (let i = s.modelHistory.length - 1; i >= 0; i--) {
      if (s.modelHistory[i] && s.modelHistory[i].ver !== snap.ver) { prev = s.modelHistory[i]; break; }
    }
    const idx = s.modelHistory.findIndex((x) => x && x.ver === snap.ver);
    if (idx >= 0) s.modelHistory[idx] = snap; else s.modelHistory.push(snap);
    s.prevSnap = prev;
    return snap;
  },

  /* 三幕结算演出播完 → 进入最终成果页（over，仅通关时用） */
  finishBonus() {
    const s = this.state;
    if (s.phase !== "bonus") return false;
    s.phase = "over";
    return true;
  },

  /* [feature:stage-budget-quote] */
  // 阶段启动预算已取消；旧配置不得产生额外入账或缺省拨款。
  /* [/feature:stage-budget-quote] */
  /* [feature:review-only-stage-comments] */
  /* 进入下一阶段（P8）：余额继承 / 周数重置 / 重选架构配方负责人。
     2026-09-04：奖励演出页已整合结算信息，通过评审后直接从 bonus 页进入下一阶段，
     不再额外插一页 over（旧规则要求 phase === "over"，现两者皆可）。
     只允许在 over 或 bonus 且 nextVer 存在时调用。 */
  /* [/feature:review-only-stage-comments] */
  startNextStage() {
    const s = this.state, r = s.result;
    if (!r || !r.nextVer || (s.phase !== "over" && s.phase !== "bonus")) return false;
    if (s.ver === "V4.5" && r.nextVer === "V5" && !this.embodiedEra().entered) return this.beginEmbodiedIntro();
    return this._enterStage(r.nextVer);
  },
  /* 重开本阶段。两个来源：
     · 任务目标未达成（doc/23 决策 ③）—— 不换版本、不发阶段预算，其余与进入下一阶段一致。
       代价 = 再付一次工资 + 6 周时间，而增量经费只有主线的 30%~70% → 净收益可能为负（决策 ②）。
     · 末版 V4.5 通过后的「再战」—— 同样是 _enterStage(null)，但**不计重训**
       （重训计数是成就 NO_RETRY 的口径，通关后再玩不该算"重训过"）。 */
  retryStage() {
    const s = this.state, r = s.result;
    if (!r || (!r.retry && !r.finalRepeat) || (s.phase !== "over" && s.phase !== "bonus")) return false;
    if (r.finalRepeat && this.embodiedEligible()) {
      this.healEmbodiedEra();
      return this.startNextStage();
    }
    if (r.retry) s.retryCount = (s.retryCount || 0) + 1;
    return this._enterStage(null);
  },
  /* 进入 / 重开一个阶段：newVer 为空 = 重训当前阶段（不推进版本、不发阶段预算） */
  _enterStage(newVer) {
    const c = this.cfg, s = this.state;
    const order = c.VER_ORDER || ["V1"];
    this.ensureBodyCalendar(); // 旧具身档直接跨阶段时，先保留已有阶段的耗时。
    /* ---- 自家模型上线 · 吃瓜新闻（2026-09-13 用户要求）----
       自研路线（mla/dsa/csa）训出来的模型评审通过、推进到下一阶段时，行业侧会爆出
       「某初创公司发布了 XX 模型，引发开源社区狂欢」（脱敏第三人称，玩家的模型名不上屏）。
       ⚠️ 必须在下面清零四维/重置立项**之前**读 s.arch 与 s.paramTarget ——
          这里读到的才是刚上线那个模型的规格（s.arch / s.paramTarget 在 _enterStage 里不重置）。
       ⚠️ 只在真正推进版本时推（重训 newVer 为空 → 同一个模型不该二次「上线」）；
          同一架构只推一次（s.newsSelfDone，跨阶段保留）。 */
    if (newVer) {
      const SR = c.NEWS_SELF_RELEASE || {};
      const tpl = SR.enabled !== false ? (SR.byArch || {})[s.arch] : null;
      const archCfg = (c.ARCHITECTURES || []).find((x) => x.id === s.arch);
      if (tpl && archCfg) {
        s.newsSelfDone = s.newsSelfDone || {};
        if (!s.newsSelfDone[archCfg.id]) {
          s.newsSelfDone[archCfg.id] = true;
          /* 占位符用**公共那把尺子**（core.fillVars）—— 以前这里是独立实现，{arch} 给代号、
             {param} 不带单位，与 core.chatVar 冲突。现在 {arch}/{archName}=显示名、{archId}=代号。 */
          const fill = (str) => this.fillVars(str);
          this.pushNews({
            id: "SELF_" + archCfg.id, title: fill(tpl.title), text: fill(tpl.desc),
            src: tpl.src, img: tpl.img, imgAlt: tpl.imgAlt,
          });
        }
      }
    }
    /* 2026-09-29：`_propAsked`「本阶段问过」标记随「提案强制触发」一起退场
       （提案只有一个选项＝批准立项，批准后 archUnlock().approvalOk 自然为真 → 不再触发）。 */
    // 连任判定：同一人再扛一阶段基线 → overworked（透支团队）
    s.lastLeader = s.leader;
    s.leaderOverworked = false;
    s.leader = null;
    // 版本推进 + 周期重置（重训时 newVer 为空 → s.ver 保持不变）
    if (newVer) {
      s.ver = newVer; s.verIdx = order.indexOf(newVer);
      /* P4 对话树：跨阶段回新 root，随机去重置空；记事本（外部资产）保留 */
      s.chatNode = null; s._lastReplyIdx = {};
      /* [feature:chat-enter-stage] */
      this.c2Reset();
      /* [/feature:chat-enter-stage] */
    }
    /* 日历连续累计（2026-09-08 用户拍板）：进入新阶段/重训时把本阶段已走的周数存进 weekOffset，
       顶栏日期用 week + weekOffset 显示 —— 否则每次进新阶段都跳回起始月份（6 月）。 */
    s.weekOffset = (s.weekOffset || 0) + (s.week || 0);
    s.week = c.START_WEEK != null ? c.START_WEEK : 0;
    /* 新阶段 = 新模型：四维数值从 0 重新开始（2026-09-08 用户拍板「新立项数值清空」）。
       历史成绩留在 s.modelHistory / s.codex，不在这里累积。 */
    /* 2026-09-12（用户实测「开局记忆没清空」）：原来只清基础四维——追加轴
       （记忆/推理/工具）的残留会带进新模型。按容器 allDims 全维度清零
       （含当前未激活的轴：跨阶段激活状态会变，残留必须一并抹掉）。 */
    for (const _dk of window.V35.allDims()) s[_dk] = 0;
    s.code = 0; s.text = 0; s.safety = 0; s.stability = 0;
    s.step = 0;
    /* 2026-08-30 新 UI：下一阶段回到办公室重新立项（不再走 direction 四步向导） */
    s.phase = "office";
    s.planDone = false;
    s.planDraft = null;
    s.mission = null;
    s.prodByEng = {};
    s.prodFullByEng = {};
    s.officeModal = null;
    s.loopStep = "report";
    s.pending = [];
    /* 2026-10-04：跨阶段清掉**悬挂的 pendingEvent**（与上面 s.pending 同一条口径）。
       旧代码只清 s.pending、不清 pendingEvent ⇒ 上一阶段那张没作答的 pause:false 卡片
       （如「电费涨价」）会一直占着闸门：常规事件掷骰要求 !s.pendingEvent（整个事件系统僵住），
       而自研提案的让路判据也会因此永远不放行 ⇒ 玩家在 V2 看到 mla 灰着、又因为
       guidePending「先完成立项」推不动时间 = **立项死锁**（玩家反馈「V2 提案没触发」）。
       读档侧早已有同口径的自愈（loadState 里 officePaused/pendingEvent/_tickAt 一起清）。 */
    s.pendingEvent = null;
    s._propYieldSince = null;     // 2026-10-04：提案让路计时同口径清（跨阶段沿用会立刻判超时 ⇒ 抢弹窗）
    s.triggered = [];            // 节点事件（V1T1/V1T2/V1R1）只在 V1 出现，但保险起见清空
    /* 节点提示不再按阶段重置；初期引导另由配置 ver 限定，缺已读记录的后期测试档也不会补播。
       hintsDone 跨阶段保留；通用评审/资源提示按配置 freq 决定是否每阶段重现。
       payday 的周期旗仍然重置（它是「发薪前提醒」，每阶段该重新武装）。 */
    s.hintsDone = s.hintsDone || {};
    s._hintPayday = false;
    s.ap = c.AP_PER_ROUND != null ? c.AP_PER_ROUND : 2;
    s.actionLog = [];
    s.corpusShort = 0;
    s.workClicks = {};
    s.workGain = null;
  /* [feature:review-only-stage-reset-comment] */
    // 阶段切换只恢复团队状态；资金已在本轮评审结算时入账。
  /* [/feature:review-only-stage-reset-comment] */
    /* [feature:stage-budget-income] */
    // 2026-10-10 用户明确取消：进入下一阶段保留已结算余额，不再追加启动预算。
    /* [/feature:stage-budget-income] */
    /* 阶段间隔的休假回血（2026-09-16：改走 addEnergyAll —— v35 下体力真源是**岗位级
       引擎槽**，既不能直接改 e.energy（会被下一 tick 覆盖），也不能逐人 addEnergy
       （同岗位 N 人会把 +30 叠成 +60/+90）。 */
    this.addEnergyAll(30);
    for (const e of s.engineers) {
      if (e.resigned) continue;
      e.restWeek = null; e.energyPending = 0;   // 新阶段：清掉上阶段的休息挂起
      e.joinTick = 0;   // 已是团队老人：清掉 V1 里 data/post 的错开到岗 tick（joinTick 仅 V1 首次生效），
                        // 否则新阶段 tick 从 0 重计、t < joinTick 会误显示成「待入职」（2026-09-03）
    }
    // 抽卡资源刷新；小模型库存保留（继续抽卡收益入下阶段结算）
    s.tuneDrawsLeft = c.TUNE_DRAWS != null ? c.TUNE_DRAWS : 3;
    s.result = null;
    /* 论文研究中跨阶段（2026-09-08 用户拍板）：**继续研究，不打断**。
       下面会重建 s.v35.paper —— 先把在研进度（剩余 tick / kind）存下来再还原，
       否则倒计时归零、完成判定永不成立 → 面板卡在「剩 1 周」。 */
    const _paperKeep = (s.paperResearch && s.v35 && s.v35.paper && !s.v35.paper.done
      && (s.v35.paper.left || 0) > 0)
      ? { left: s.v35.paper.left, kind: s.v35.paper.kind,
          axis: s.v35.paper.axis, axisProb: s.v35.paper.axisProb, axisAdd: s.v35.paper.axisAdd } : null;
    /* V3.5.2 引擎对接：新阶段重置（累计四维/语料/经费/词条档位延续；基线快照/论文/事件/突破标记重置） */
    if (this.v35On()) {
      s.v35.tick = 0;
      s.v35.ver = s.ver;
      /* 新模型 = 引擎四维也从 0 起（与 s.code 等同步），基线快照同样归零 */
      s.v35.stats = this.newDims(0, s);
      s.v35.stageStart = this.newDims(0, s);
      /* 在研论文：保留剩余进度继续跑；没有在研就正常清空 */
      s.v35.paper = _paperKeep
        ? { left: _paperKeep.left, done: false, started: true, kind: _paperKeep.kind || 'text_prob',
            axis: _paperKeep.axis || null, axisProb: _paperKeep.axisProb || 0, axisAdd: _paperKeep.axisAdd || 1 }
        : { left: 0, done: false, started: false, kind: 'text_prob', axis: null, axisProb: 0, axisAdd: 1 };
      s.v35.quota = { pre: [], post: [] };
      s.v35.weekly = [];
      s.v35.focus = { dim: null, left: 0 };
      s.v35.gapState = "ok";
      s.v35.preMul = 1;
      /* ⚠️ 2026-09-13 修 BUG（用户实测「预训练产出档位明显压过后训练」）：
         `lvShift`（突破瓶颈：产出档位 +1）在引擎里是 `st.lvShift += v.BREAKTHROUGH.SHIFT`
         —— 而这里是**每阶段的重置清单**，上面 gapState / preMul / focus / breakthroughSeen
         全都清了，唯独漏了 lvShift ⇒ 它**跨阶段一路累加**：V1 拿一次、V1.5 又一次……
         到 V4 时 `preIdx = min((lvLv-1)+7, 4)` 恒等于 4（顶格 [5,12]），
         **预训练从 V1.5 起就永久吃顶格档位，而 post 只有 `min(lv-1,4)` 永远不享受**。
         突破瓶颈是「本阶段」的一次性提升（REQUIRE_FOCUS=true，当阶段投过攻关才给），
         跟 focus/gapState 同寿命 → 一起重置。 */
      s.v35.lvShift = 0;
      s.breakthroughSeen = false;
      s._lastEvtTick = 0;
      s.rounds = 0;
      /* B1（2026-09-06）：事件冷却按 rounds 算，而 rounds 每阶段从 0 重跑；
         不重置 _evtLastAt 的话，`rounds − _evtLastAt[id] >= cooldown×6` 永远不成立
         → 触发过一次的事件此后**再也不会触发**。
         后果最严重的是离职/挖角（唯一的人员流失路径）在中后期彻底断掉。 */
      s._evtLastAt = {};
      /* ⚠️ _evtOnce 故意不重置 —— 那是"真一次性"事件（跨阶段只出一次）的记录 */
      s._milestonePaid = false;
      s._vigourUsed = false;
      this.refreshPaperCandidates();
    }
  /* [feature:review-retry-income-base] */
    /* 新版本从零计算；同版本重训保留已经付过钱的最高分。
       模型能力仍按原规则归零，不能因此重新支付同一段进步。 */
    s.incBase = newVer ? 0 : this.reviewIncomeBase(s);
  /* [/feature:review-retry-income-base] */
    s.embodiedTrainingTicks = 0;
    if (this.embodiedAvailable()) { this.embodiedEra().entered = true; this.grantEmbodiedMentor(); }
    if (this.embodiedAvailable()) {
      this.ensureBodyCalendar();
      if (newVer) { this.recordLifeMilestone("body_" + s.ver); this.publishCalendarNews(); }
    }
    /* 阶段锚点（2026-09-12 兜底机制）：每个阶段开始自动存一份「本阶段开头」快照——
       独立 localStorage 键，不占 8 个手动槽；stageNo 是阶段计数器（loadState 用它
       判断锚点是否属于当前阶段，防止同一阶段内反复读档把锚点越推越新）。
       用途：引擎 tick 连续崩溃、时间卡死时自动回滚到这里（见 game_ui officeTick catch）。 */
    s.stageNo = (s.stageNo || 0) + 1;
    if (window.GameSave && window.GameSave.saveStage) window.GameSave.saveStage(s);
    return true;
  },

  /* 扩编招聘（游戏发展国模式）：提需求 → 动态寻访 → 录用（详见 js/v35_hire.js） */
  requestHire(role) { return window.V35Hire ? window.V35Hire.request(this, role) : { ok: false, tip: "招聘系统未加载" }; },
  /* 2026-09-07 删除 hirePending()（原 V35Hire.hire 的入口）：候选人已统一进
     「招聘」页列表，由 core.hire(id) 录用，不再存在扩编面板内的单槽录用通道。 */
  /* 指定基线负责人（P8）：定方向页选人；不选则默认第一位在岗 */
  setLeader(engId) {
    const s = this.state;
    const e = s.engineers.find((x) => x.id === engId && !x.resigned);
    if (!e) return false;
    s.leader = e.id;
    return true;
  },

  /* 后训练抽卡（P8）：拿当前基线做后训练，产出小模型；
     评分 ≥80 的在结算时给经费与口碑加成（用户设计：旧模型抽卡是额外收益来源）。 */
  tuneDraw() {
    const c = this.cfg, s = this.state;
    if (s.tuneDrawsLeft == null) s.tuneDrawsLeft = 0;
    if (s.tuneDrawsLeft <= 0) return { ok: false, tip: "本阶段的抽卡机会已用完" };
    const cost = c.TUNE_DRAW_COST != null ? c.TUNE_DRAW_COST : 200000;
    if (s.funding < cost) return { ok: false, tip: `经费不足（需要 ${cost / 10000} 万）` };
    s.funding -= cost;
    s.tuneDrawsLeft -= 1;
    // 评分：基础 + 数值加成（基线越强、抽得越好）+ 架构微调
    /* 2026-09-05：原来是 synergyOf()（架构 × 配方相性），配方停用后相性恒取 chat 列，
       等价摊平成 ARCH_MINI_BONUS（数值不变：dense/ssm +5、linear −3、其余 0）。 */
    const statAvg = (s.code + s.text + s.safety + s.stability) / 4;
    const synBoost = (c.ARCH_MINI_BONUS || {})[s.arch] || 0;
    const score = Math.round(Math.min(99, 55 + statAvg * 0.3 + Math.random() * 22 + synBoost));
    s.miniModels.push({ score, ver: s.ver });
    return { ok: true, score };
  },

  /* ---------------- 存档辅助 ---------------- */
  snapshot() { return this.state; },
  restore(s) { this.loadState(s); return this.state; },
};

function fmt(n) { return n > 0 ? "+" + n : String(n); }

/* V5 embodied progression: persistence is independent of transient event cards. */
Object.assign(window.GameCore, {
  embodiedAvailable(s) { const st=s||this.state||{}; const a=this.cfg.VER_ORDER||[]; return a.indexOf(st.ver)>=a.indexOf("V5") && a.indexOf("V5")>=0; },
  embodiedEra() {
    const s=this.state;
    if (!s.embodiedEra || typeof s.embodiedEra!=="object" || Array.isArray(s.embodiedEra)) s.embodiedEra={};
    const e=s.embodiedEra, d={schema:1,status:"locked",introducerId:null,entered:false,mentorGranted:false,bodyAwakened:false,podExitSeen:false,tutorialStep:0};
    Object.keys(d).forEach(k=>{if(e[k]==null)e[k]=d[k];});
    return e;
  },
  embodiedBodyAvailable() { return this.embodiedAvailable() && !!this.embodiedEra().bodyAwakened; },
  embodiedPersist() { if(window.GameSave&&window.GameSave.save) window.GameSave.save("auto",this.state); },
  embodiedAwakening() {
    const s=this.state, C=this.cfg.EMBODIED||{}, available=this.embodiedAvailable();
    const configuredRatio=C.AWAKEN_RATIO==null?0.25:Number(C.AWAKEN_RATIO), configuredWeeks=C.AWAKEN_MIN_TRAINING_WEEKS==null?2:Number(C.AWAKEN_MIN_TRAINING_WEEKS);
    const ratio=Math.max(0,Math.min(1,Number.isFinite(configuredRatio)?configuredRatio:0.25));
    const ticks=Math.max(0, Number(s.embodiedTrainingTicks ?? (s.planDone&&s.v35?s.v35.tick:0))||0);
    const minWeeks=Math.max(1,Math.min(52,Math.round(Number.isFinite(configuredWeeks)?configuredWeeks:2)));
    const minTicks=Math.ceil(minWeeks*((this.cfg.V35||{}).TICKS_PER_WEEK||6));
    const requirements=["embodiedCognition","dexterousControl"].map(key=>({key,label:this.statLabel(key),value:Math.floor(Number(s[key])||0),target:Math.max(1,Math.ceil((window.V35.axisPass(s.ver,key)||200)*window.V35.lineScale(s.ver,s.paramTarget)*ratio))}));
    const progress=Math.min(1,ticks/minTicks,...requirements.map(x=>x.value/x.target));
    return {ready:available&&!!s.planDone&&ticks>=minTicks&&requirements.every(x=>x.value>=x.target),requirements,progress:Math.max(0,progress),trainingTicks:ticks,minTicks};
  },
  checkEmbodiedAwakening() {
    if(!this.embodiedAvailable())return false;
    const e=this.embodiedEra();
    if(e.bodyAwakened)return false;
    if(!this.embodiedAwakening().ready)return false;
    e.bodyAwakened=true; e.podExitSeen=false; this.embodiedPersist(); return true;
  },
  embodiedStatus() {
    const e=this.embodiedEra(), people=this.state.engineers||[], inviter=people.find(x=>x.id===e.introducerId)||people.find(x=>!x.resigned);
    return Object.assign({},e,{pendingIntro:e.status==="intro"||e.status==="accepted",inviter:inviter?inviter.name:"团队工程师",awakening:this.embodiedAwakening()});
  },
  embodiedIntroPending() { return this.embodiedStatus().pendingIntro; },
  embodiedEligible() {
    const s=this.state, r=s.result;
    if(!["V4","V4.5"].includes(s.ver))return false;
    const passed=x=>x&&["pass","excellent","top"].includes(x.verdict)&&!x.missionFail&&!x.qualificationFailed&&!x.retry&&x.missionHit!==false;
    const historyPass=(x,ver)=>{
      if(!passed(x))return false;
      const archivedVer=x.ver||ver, sameStage=s.ver==="V4.5"&&archivedVer==="V4.5";
      // Older releases allowed a settled 1.6T flagship in V4. Their snapshots
      // have no missionFail field; modern V4 clears still proceed to V4.5.
      const legacyFlagship=!Object.prototype.hasOwnProperty.call(x,"missionFail")&&["V4","V4.5"].includes(archivedVer);
      if(!sameStage&&!legacyFlagship)return false;
      // Explicit V4.5 mission completion remains a historical fact.
      if(sameStage&&x.missionFail===false)return true;
      const param=Number(x.param);
      if(!Number.isFinite(param)||param<1600||(x.arch&&x.arch!=="csa")||(!sameStage&&x.arch!=="csa"))return false;
      /* 旧快照曾只记立项的 missionHit；保留的轴值可证明那次训练并未完成任务。
         更早、没有轴字段的成功记录仍按旧版通关证据兼容，不能误伤老玩家。 */
      const limits=(this.missionOf("V4.5")||{}).axisMin||{};
      return Object.keys(limits).every(k=>x[k]==null||Number(x[k])>=limits[k]);
    };
    // A current V4 review is not a legacy flagship archive.
    const settled = r && (r.settled || r.finalRepeat===true || s.phase === "bonus" || s.phase === "over");
    if(s.ver==="V4.5"&&settled&&passed(r)&&(r.missionFail===false||!(s.mission&&s.mission.hit===false)))return true;
    if(["V4","V4.5"].some(ver=>historyPass((s.stageMarks||{})[ver],ver)))return true;
    if((Array.isArray(s.modelHistory)?s.modelHistory:[]).some(x=>historyPass(x)))return true;
    // Replays overwrite modelHistory; the same save's settled codex retains
    // first/best/last and its log. Metadata uses the same fallback as its card.
    if((Array.isArray(s.codexLog)?s.codexLog:[]).some(x=>historyPass(x)))return true;
    return Object.values(s.codex&&typeof s.codex==="object"?s.codex:{}).some(entry=>
      entry&&[entry.first,entry.best,entry.last].some(x=>x&&historyPass(Object.assign({arch:entry.arch,param:entry.param},x))));
  },
  beginEmbodiedIntro() {
    if(!this.embodiedEligible())return false;
    const e=this.embodiedEra(); if(e.entered)return false;
    if(!e.introducerId)e.introducerId=((this.state.engineers||[]).find(x=>!x.resigned)||{}).id||null;
    e.status="intro";this.state.officeModal=null;this.embodiedPersist();return true;
  },
  grantEmbodiedMentor() {
    const e=this.embodiedEra(), s=this.state, t=this.engByKey((this.cfg.EMBODIED||{}).MENTOR_KEY||"eng_embodied_mentor");
    if(!t||!this.embodiedAvailable())return false;
    const before=[e.mentorGranted,e.mentorPending,e.mentorArrivalVersion,e.mentorDismissed].join("/");
    const remember=(changed=false)=>{if(changed||before!==[e.mentorGranted,e.mentorPending,e.mentorArrivalVersion,e.mentorDismissed].join("/"))this.embodiedPersist();};
    const matches=x=>{
      if(!x||x.visitorId||/^vis_/.test(String(x.id||"")))return false;
      const no=this.engNoOf(x);
      return no!=null?Number(no)===Number(this.engNoOf(t)):x.key===t.key||x.id===t.key;
    };
    const people=(s.engineers||[]).filter(matches);
    const existing=people.find(x=>!x.resigned&&x.dismissed!==true)||people[0];
    if(existing){
      // Actual members, including retained departure records, are authoritative.
      // Persist departure intent even if another repair later removes the record.
      e.mentorGranted=true;e.mentorPending=false;e.mentorArrivalVersion=1;
      let changed=false;
      if(existing.resigned||existing.dismissed===true)e.mentorDismissed=true;
      else{
        const trait=(existing.traits||[]).find(x=>x.type==="embodied");
        if(!trait||!Number.isFinite(Number(trait.level))||Number(trait.level)<4){
          existing.traits=existing.traits||[];
          if(trait)trait.level=4;else existing.traits.push({type:"embodied",level:4});
          existing.salary=Math.max(Number(existing.salary)||0,this.salaryOf(existing));
          changed=true;
        }
      }
      remember(changed);return true;
    }
    // A claimed/arrival-version flag without a member never proves arrival.
    if(e.mentorDismissed===true){e.mentorPending=false;remember();return true;}
    if((s.engineers||[]).filter(x=>!x.resigned).length>=this.seatCap()){
      e.mentorGranted=false;e.mentorPending=true;remember();return false;
    }
    const mentor=this.cloneEng(t);mentor.type="embodied";
    mentor.traits=[{type:"embodied",level:4},...(mentor.traits||[]).filter(x=>x.type!=="embodied")];
    mentor.salary=this.salaryOf(mentor);mentor.joinTick=0;mentor.energy=100;delete mentor.expireAbsWeek;
    (s.engineers=s.engineers||[]).push(mentor);this.assignSeat(mentor.id);this.syncEnergySlot("embodied");
    e.mentorGranted=true;e.mentorPending=false;e.mentorArrivalVersion=1;remember(true);return true;
  },
  acceptEmbodiedEra() {
    const s=this.state,e=this.embodiedEra();
    if(!e.entered&&!this.embodiedEligible())return false;
    if(!e.entered){e.status="accepted";this.embodiedPersist();this._enterStage("V5");e.entered=true;}
    s.approvedArchs=Array.isArray(s.approvedArchs)?s.approvedArchs:[];
    if(!s.approvedArchs.includes("vla"))s.approvedArchs.push("vla");
    this.grantEmbodiedMentor();e.status=e.status==="done"?"done":"tutorial";
    this.embodiedPersist();if(window.GameSave&&GameSave.saveStage)GameSave.saveStage(s);return true;
  },
  embodiedAccept() {return this.acceptEmbodiedEra();},
  markEmbodiedTutorial(step) {
    const e=this.embodiedEra();if(!e.entered)return false;
    if(step==="done"){e.status="done";e.tutorialStep=99;}
    else {e.tutorialStep=Math.max(e.tutorialStep||0,Math.floor(Number(step)||0));e.status="tutorial";}
    this.embodiedPersist();return true;
  },
  embodiedTutorialNext(step) {return this.markEmbodiedTutorial(step);},
  completeBodyAwakening() { const e=this.embodiedEra();if(!e.bodyAwakened)return false;if(!e.podExitSeen)this.recordLifeMilestone("body_awake");e.podExitSeen=true;this.embodiedPersist();return true; },
  healEmbodiedEra() {
    const s=this.state,e=this.embodiedEra();
    if(this.embodiedAvailable()){
      e.entered=true;if(e.status==="locked"||e.status==="intro"||e.status==="accepted")e.status="tutorial";
      s.approvedArchs=s.approvedArchs||[];if(!s.approvedArchs.includes("vla"))s.approvedArchs.push("vla");
      this.grantEmbodiedMentor();this.checkEmbodiedAwakening();
    } else if(this.embodiedEligible()){
      e.entered=false;
      if(s.result&&["pass","excellent","top"].includes(s.result.verdict)&&!s.result.missionFail){
        // Keep the settled fact when converting the old endpoint's replay flag.
        // Intro/accept recheck eligibility, including after another reload.
        if(s.result.finalRepeat===true)s.result.settled=true;
        s.result.nextVer="V5";s.result.finalRepeat=false;
      }
      this.beginEmbodiedIntro();
    }
    return e;
  },
  statSources(k) {return k==="codeText"?["code","text"]:k==="safetyStability"?["safety","stability"]:[k];},
  displayDims(s) {
    const st=s||this.state, keys=this.dimsOf(st), late=this.embodiedAvailable(st);
    const shown=late?["codeText","safetyStability"].concat(keys.filter(k=>!window.V35.DIM_ORDER.includes(k))):keys;
    return shown.map(key=>{const d=this.axisDef(key)||{};return {key,label:({codeText:"代码&文字",safetyStability:"安全&稳定"})[key]||this.statLabel(key),sources:this.statSources(key),color:d.color||({codeText:"linear-gradient(90deg,#55c4ff,#789cff)",safetyStability:"linear-gradient(90deg,#72d9b9,#51aacc)"})[key]||"",icon:d.icon||""};});
  },
  displayValue(k,s) {const st=s||this.state;return this.statSources(k).reduce((n,x)=>n+(Number(st[x])||0),0);},
  displayCap(k,s) {const prev=this.state;if(s)this.state=s;try{const cap=this.statCap();return this.statSources(k).reduce((n,x)=>n+(Number(cap[x])||0),0);}finally{this.state=prev;}},
  displayPass(k,s) {const prev=this.state;if(s)this.state=s;try{const p=this.passLine();return this.statSources(k).reduce((n,x)=>n+(Number(p[x]??(p.axMin||{})[x])||0),0);}finally{this.state=prev;}},
  statValue(k,s){return this.displayValue(k,s);},statCapValue(k,s){return this.displayCap(k,s);},statPassValue(k,s){return this.displayPass(k,s);}
});
/* Hooks run after actual production has reached the root state; cinematics have no economy side effects. */
{const gc=window.GameCore,run=gc.officeAdvanceV35;gc.officeAdvanceV35=function(n){const out=run.call(this,n);this.checkEmbodiedAwakening();return out;};}
