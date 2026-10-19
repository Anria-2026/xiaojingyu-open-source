/* ==========================================================================
   大模型研发养成玩法 —— 存档层
   --------------------------------------------------------------------------
   参考几何战争 config.js 的「出厂默认 → 配置文件 → localStorage 本地覆盖」
   三层模式 + 玩法设计文档 §9 存档规则：
   - 8 个手动存档槽 + 1 个自动存档位
   - 自动存档：任何有效操作后写入 auto 槽
   - 存档内容：完整游戏状态快照（周数/数值/工程师/已触发事件/并行状态）
   - 命名："第 X 周 - 参数规模 - 日期时间"
   - DOC 26 P0（2026-09-09）：引入独立存档版本号 SAVE_VERSION，散落的 ad-hoc
     补齐收编进 migrate()，可单测。
   ========================================================================== */
"use strict";

window.GameSave = {
  /* 存档格式版本号（DOC 26 P0）：独立于 game_cfg.js 的 cfg.version（那是配置版本，恒=1）。
     每次「存档结构发生变化」才 +1；老档无该字段视为版本 0 → migrate() 逐级升级。 */
  SAVE_VERSION: 6,

  KEY_PREFIX: "whale_dev_v35_",        // localStorage 前缀（v3.5.2 起换键，与旧版缓存 js 的存档彻底隔离）
  AUTO_KEY: "whale_dev_v35_auto",     // 自动存档槽
  STAGE_KEY: "whale_dev_v35_stage",   // 阶段锚点存档（2026-09-12 兜底机制，独立键，不占 8 个手动槽）
  MAX_SLOTS: 8,                      // 手动槽数量

  /* ---- 旧档迁移（DOC 26 P0）：纯函数输入解析好的快照对象，逐级补齐缺字段 ----
     只做「版本升级的字段补齐/迁移」，不校验有效性、不做业务归一只读。
     从最老(0)逐版本升级到当前 SAVE_VERSION。 */
  migrate(d) {
    if (!d || typeof d !== "object") return d;
    const v = Number(d.saveVersion) || 0;
    let st = d.state;
    if (!st || typeof st !== "object") return d;
    /* v0 → v1：
       —— v35 引擎状态归一：中间版本存档补齐后加字段（避免旧档缺字段导致 UI 崩溃） */
    if (v < 1) {
      if (st.v35 && typeof st.v35 === "object") {
        const e = st.v35;
        if (e.stageStart == null) e.stageStart = window.V35.dimObj(0);   // 全维度（基础四维 + 追加轴）
        if (e.extraPre == null) e.extraPre = 0;
        if (e.extraPost == null) e.extraPost = 0;
        if (e.extraData == null) e.extraData = 0;
        if (e.paper && e.paper.kind == null) e.paper.kind = "text_prob";
        if (e.focusEverUsed == null) e.focusEverUsed = false;
        if (e.lvShift == null) e.lvShift = 0;
        /* 语料分品质库存（corpus.q）：旧档没有 → 按普通+良好二分反解（token = 0.5n + 1.0g） */
        if (e.corpus && !e.corpus.q) {
          const I = e.corpus.items || 0, T = e.corpus.token || 0;
          let n = Math.round(2 * (I - T)), g = Math.round(2 * T - I);
          n = Math.max(0, Math.min(I, n)); g = Math.max(0, Math.min(I - n, g));
          e.corpus.q = [n, g, 0];
        }
      }
      /* 顶层 state 归一（旧档视角常用补齐；数值反推类在有 cfg 的 loadState 里做，这里只保底结构） */
      if (!Array.isArray(st.triggered)) st.triggered = st.triggered || [];
      if (!Array.isArray(st.pending)) st.pending = st.pending || [];
      if (!Array.isArray(st.engineers)) st.engineers = st.engineers || [];
      if (!Array.isArray(st.ownedGpus)) st.ownedGpus = st.gpuTier ? [st.gpuTier] : [];
      if (st.officePaused === undefined) st.officePaused = false;
      if (st.usersMigrated === undefined) st.usersMigrated = true;   // 迁移过的标记，防重闸
    }
    /* v1 → v2（对话树）：补进度 / 记事本 / 三档随机去重。（老节点树 CHAT_TREE 已于 2026-09-19 删除）
       实际业务归一到 root 由引擎 chatRootId() 兜底，这里只补结构保底不白屏。 */
    if (v < 2) {
      if (st.chatNode == null) st.chatNode = null;
      if (!Array.isArray(st.notebook)) st.notebook = [];
      if (st._lastReplyIdx == null) st._lastReplyIdx = {};
    }
    /* v2 → v3（2026-09-10）：工程师属性收敛为**三维 code / algo / text** ——
       「精力 energy」与「协作 coop」已彻底删除（字段 / 档案 / 培训池 / 事件条件与效果 / 界面
       全部清除），老档里的残留键就地清掉：它们已无人读取，留着只会让后续按 e.stats 遍历
       的代码产生误解（当初那批 5 维代码就是这么写歪的）。
       注意：初始体力已改为固定 ENG_STATUS.ENERGY_INIT（100），不再来自 stats.energy。 */
    if (v < 3) {
      for (const e of (st.engineers || [])) {
        if (e && e.stats) { delete e.stats.coop; delete e.stats.energy; }
      }
    }
    /* v3 → v4（2026-09-17）：末版 V4.5 通过后新增 `r.finalRepeat`（「再战 V4.5」而不是
       卡在通关终局页）。**老档里没有这个字段** ⇒ 读档落在 over 页时连一个推进按钮都没有，
       玩家只能读档（用户实测反馈「存档直接进去还是跳到这个页面」）。
       这里按与 game_core.finish() **完全相同**的口径补一次：
       末版 + verdict 是 pass/excellent/top + 没有 nextVer + 不是重训。 */
    if (v < 4) {
      const r = st.result;
      const order = (window.GameCfg && window.GameCfg.VER_ORDER) || [];
      const last = "V4.5"; // v3/v4 migration describes the historical endpoint, not future added stages.
      const vd = r && r.verdict;
      const passLike = vd === "pass" || vd === "excellent" || vd === "top";
      if (r && last && st.ver === last && passLike && !r.nextVer && !r.retry) {
        r.finalRepeat = true;
        /* 总评终局页（over）**已废弃**（用户 2026-09-17：「不要这个界面了，删干净」）——
           老档停在这一页时，把它搬回**结算演出的最后一幕**（有第四幕就是「成就」那幕），
           那一幕页脚的主按钮就是「🔁 再战 V4.5 阶段」。
           ⚠️ 幕号写 4 是安全的：renderBonus → rewardGoTo / bonusLastAct() 会按实际幕数夹值
              （这次没有第四幕时自动落到第三幕「总奖金」）。 */
        if (st.phase === "over" && st.bonus && typeof st.bonus === "object") {
          st.phase = "bonus";
          st.bonusAct = 4;
        }
      }
    }
    /* v4 → v5（2026-09-30）：工程师「潜力属性」压回 0~100。
       2026-09-30 之前的 trainEngineer 是 `e.stats[k] += TRAIN_STAT_ADD` **从不夹紧**
       （用户报「天赋理论上限 100，现在会突破上限」）⇒ 老档里可能留着 101/105 之类的值。
       潜力属性口径就是 0-100（game_cfg「工程师潜力属性」 + 建池 cloneEng 的 Math.min(100,…)），
       这里就地把越界值压回 100；建池/事件其它路径本来就是夹紧的，只有培训会顶穿。 */
    if (v < 5) {
      for (const e of (st.engineers || [])) {
        if (!e || !e.stats) continue;
        for (const k of Object.keys(e.stats)) {
          const x = e.stats[k];
          if (typeof x === "number" && isFinite(x)) e.stats[k] = Math.max(0, Math.min(100, x));
        }
      }
    }
    if (v < 6) {
      if (!st.embodiedEra) st.embodiedEra = {schema:1,status:"locked",entered:false,mentorGranted:false,bodyAwakened:false,podExitSeen:false,tutorialStep:0};
      const r = st.result;
      if (st.ver === "V4.5" && r && (r.settled || st.phase === "bonus" || st.phase === "over") && ["pass", "excellent", "top"].includes(r.verdict)
          && !r.retry && !r.missionFail && !(st.mission && st.mission.hit === false)) {
        r.nextVer = "V5"; r.finalRepeat = false; st.embodiedEra.status = "intro";
        if (st.phase === "over" && st.bonus) { st.phase = "bonus"; st.bonusAct = 4; }
      }
    }
    // Reconcile settled endpoints on every read, including current-format saves
    // written after importing an older online result. Never rerun settlement.
    const order = (window.GameCfg && window.GameCfg.VER_ORDER) || [];
    const index = order.indexOf(st.ver), r = st.result;
    if (r && (!r.nextVer || r.finalRepeat) && index >= 0 && index < order.length - 1
        && (r.settled || st.phase === "bonus" || st.phase === "over")
        && ["pass", "excellent", "top"].includes(r.verdict)
        && !r.retry && !r.missionFail && !r.qualificationFailed
        && (r.missionFail === false || !(st.mission && st.mission.hit === false))) {
      r.nextVer = order[index + 1]; r.finalRepeat = false;
      if (st.bonus) st.bonus.nextVer = r.nextVer;
      if (st.phase === "over" && st.bonus) { st.phase = "bonus"; st.bonusAct = 4; }
    }
    d.saveVersion = this.SAVE_VERSION;
    return d;
  },

  /* ---- 槽位 key ---- */
  slotKey(i) { return this.KEY_PREFIX + "slot_" + i; },

  /* ---- 保存快照到指定槽 ---- */
  save(slot, state) {
    const snap = this.buildSnapshot(state);
    try {
      if (slot === "auto") localStorage.setItem(this.AUTO_KEY, JSON.stringify(snap));
      else localStorage.setItem(this.slotKey(slot), JSON.stringify(snap));
      this._notifyCloud(slot, snap, false);
      return snap;
    } catch (e) { return null; }
  },

  /* 云存档通知（Toy 平台）。刻意放在 try 内、且自身再包一层：
     云端任何异常都不允许影响本地存档的返回值与流程。
     force=true 时绕过节流（阶段锚点 / 结算 / 页面隐藏这类关键节点）。 */
  _notifyCloud(slot, snap, force) {
    const tc = window.ToyCloud;
    if (!tc || !snap) return;
    try {
      const p = force ? tc.flush(snap) : tc.onLocalSaved(slot, snap);
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) { /* 静默降级 */ }
  },

  /* 自动存档（任何有效操作后调用），返回快照 */
  autoSave(state) { return this.save("auto", state); },

  // Commit a fresh playthrough before the menu leaves. Never notify cloud or
  // mutate the live core until all local writes succeeded.
  createNewSlot(slot, core) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.MAX_SLOTS || !core?.newState)
      return { ok: false, reason: "unavailable" };
    const key = this.slotKey(slot), written = [];
    try {
      if (localStorage.getItem(key) !== null) return { ok: false, reason: "occupied" };
      const factory = Object.create(core);
      factory.cfg = core.cfg || window.GameCfg;
      const state = factory.newState(), snapshot = this.buildSnapshot(state), raw = JSON.stringify(snapshot);
      for (const target of [key, this.STAGE_KEY, this.AUTO_KEY]) {
        const before = localStorage.getItem(target);
        localStorage.setItem(target, raw);
        written.push({ target, before });
      }
      core.state = state;
      return { ok: true, snapshot };
    } catch (_) {
      for (const { target, before } of written.reverse()) {
        try { if (before === null) localStorage.removeItem(target); else localStorage.setItem(target, before); } catch (_) {}
      }
      return { ok: false, reason: "storage-error" };
    }
  },

  /* ---- 解析 + 校验 + 迁移：load / loadStage / 云恢复 共用同一条管线 ---- */
  parse(raw) {
    if (!raw) return null;
    try {
      const d = (typeof raw === "string") ? JSON.parse(raw) : raw;
      if (!d || !d.state) return null;
      /* 旧版本存档（没有 v35 引擎状态）一律视为无效：
         否则会直入已退役的旧 UI，表现为「菜单点不开、不能重新开始」，直接引导开新档。 */
      if (!d.state.v35) return null;
      /* V3.5.2 存档归一化：中间版本的存档补齐后加字段（避免旧档缺字段导致 UI 崩溃）
         —— 2026-09-09（DOC 26 P0）：收编进 migrate()，可单测 */
      this.migrate(d);
      return d;
    } catch (e) { return null; }
  },

  /* [feature:safe-snapshot-restore] */
  /* Restore before committing the automatic slot. Legacy absent fields still
     migrate; unsupported future saves never silently fall back to V1. */
  restoreSnapshot(raw, core) {
    if (this._snapshotRestoring) return { ok: false, reason: "busy" };
    if (!core || typeof core.loadState !== "function") return { ok: false, reason: "unavailable" };
    const record = value => !!value && typeof value === "object" && !Array.isArray(value);
    let snap;
    try { snap = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)); }
    catch (e) { return { ok: false, reason: "invalid-snapshot" }; }
    if (!record(snap) || !record(snap.state)) return { ok: false, reason: "invalid-snapshot" };
    const version = Number(snap.saveVersion || 0);
    if (!Number.isSafeInteger(version) || version < 0 || version > this.SAVE_VERSION)
      return { ok: false, reason: "unsupported-version", version: snap.saveVersion };
    const cfg = core.cfg || window.GameCfg;
    if (!cfg || !Array.isArray(cfg.VER_ORDER)) return { ok: false, reason: "unavailable" };
    const st = snap.state;
    if (st.ver != null && cfg.VER_ORDER.indexOf(st.ver) < 0)
      return { ok: false, reason: "unsupported-stage", stage: st.ver };
    if (st.phase != null && !["naming", "office", "review", "bonus", "over", "loop", "minigame", "recruit", "buygpu", "direction", "evalshow"].includes(st.phase))
      return { ok: false, reason: "invalid-state", field: "phase" };
    if (!record(st.v35)) return { ok: false, reason: "invalid-state", field: "v35" };
    for (const key of ["engineers", "candidates", "triggered", "pending"]) {
      if (st[key] != null && !Array.isArray(st[key])) return { ok: false, reason: "invalid-state", field: key };
    }
    for (const key of ["engineers", "candidates"]) {
      for (const e of st[key] || []) {
        if (!record(e) || (e.stats != null && !record(e.stats)) || (e.traits != null && !Array.isArray(e.traits)))
          return { ok: false, reason: "invalid-state", field: key };
      }
    }
    if (st.v35.weekly != null && !Array.isArray(st.v35.weekly))
      return { ok: false, reason: "invalid-state", field: "v35.weekly" };
    for (const key of ["energy", "stats", "quota", "focus", "paper", "corpus"]) {
      if (st.v35[key] != null && !record(st.v35[key])) return { ok: false, reason: "invalid-state", field: "v35." + key };
    }
    const parsed = this.parse(snap);
    if (!parsed) return { ok: false, reason: "invalid-state" };

    const previousState = core.state, previousCfg = core.cfg, pending = new Map();
    const original = {}, save = this, tc = window.ToyCloud;
    let guarded = false, committed = false;
    const slotKey = slot => slot === "auto" ? save.AUTO_KEY : save.slotKey(slot);
    const clone = value => JSON.parse(JSON.stringify(value));
    const slotRead = this.load.bind(this);
    const replace = (key, fn) => { original[key] = this[key]; this[key] = fn; };
    this._snapshotRestoring = true;
    try {
      if (tc && typeof tc.beginRestore === "function" && typeof tc.endRestore === "function") {
        tc.beginRestore(); guarded = true;
      }
      // loadState repairs are synchronous. Buffer them so a failed restore
      // cannot replace either the previous automatic slot or stage anchor.
      replace("_notifyCloud", () => {});
      replace("save", function (slot, state) {
        const value = save.buildSnapshot(state); pending.set(slotKey(slot), value); return value;
      });
      replace("writeSnapshot", function (slot, value) {
        if (!value || !value.state) return false;
        pending.set(slotKey(slot), clone(value)); return true;
      });
      replace("saveStage", function (state) {
        const value = save.buildSnapshot(state); pending.set(save.STAGE_KEY, value); return value;
      });
      replace("load", function (slot) {
        const key = slotKey(slot);
        return pending.has(key) ? save.parse(clone(pending.get(key))) : slotRead(slot);
      });
      replace("loadStage", function () {
        // A local anchor may belong to a different playthrough with matching
        // stage identifiers. Only this restore's own anchor is eligible.
        return pending.has(save.STAGE_KEY) ? save.parse(clone(pending.get(save.STAGE_KEY))) : null;
      });
      if (typeof this.patchStageBodyCalendar === "function") replace("patchStageBodyCalendar", function (state) {
        if (!state || !state.bodyCalendar) return false;
        const anchor = save.loadStage();
        if (!anchor || !anchor.state || anchor.state.stageNo !== state.stageNo || anchor.state.ver !== state.ver) return false;
        anchor.state.bodyCalendar = clone(state.bodyCalendar); pending.set(save.STAGE_KEY, anchor); return true;
      });
      core.cfg = cfg;
      core.loadState(parsed.state);
      const normalized = this.buildSnapshot(core.state);
      const automaticRaw = JSON.stringify(normalized);
      const stageRaw = pending.has(this.STAGE_KEY) ? JSON.stringify(pending.get(this.STAGE_KEY)) : null;
      // setItem is atomic for this key: an exception leaves the old value.
      try { localStorage.setItem(this.AUTO_KEY, automaticRaw); }
      catch (e) { return { ok: false, reason: "storage-error" }; }
      committed = true;
      let stageSaved = true, stageRemoved = false;
      if (stageRaw != null) {
        try { localStorage.setItem(this.STAGE_KEY, stageRaw); }
        catch (e) {
          stageSaved = false;
          // Never silently leave a previous playthrough's retry anchor behind.
          try { localStorage.removeItem(this.STAGE_KEY); stageRemoved = true; }
          catch (removeError) {}
        }
      }
      return { ok: true, reason: "restored", snapshot: normalized, stageSaved, stageRemoved };
    } catch (e) {
      return { ok: false, reason: "load-error", detail: String(e && e.message || e) };
    } finally {
      for (const key of Object.keys(original)) this[key] = original[key];
      if (!committed) { core.state = previousState; core.cfg = previousCfg; }
      this._snapshotRestoring = false;
      if (guarded) { try { tc.endRestore(); } catch (e) {} }
    }
  },
  /* [/feature:safe-snapshot-restore] */
  /* ---- 把快照对象写入本地槽位（云恢复用，落盘格式与 save() 完全一致） ---- */
  writeSnapshot(slot, snap) {
    if (!snap || !snap.state) return false;
    try {
      if (slot === "auto") localStorage.setItem(this.AUTO_KEY, JSON.stringify(snap));
      else localStorage.setItem(this.slotKey(slot), JSON.stringify(snap));
      return true;
    } catch (e) { return false; }
  },

  /* ---- 读取槽位 ---- */
  load(slot) {
    try {
      const raw = slot === "auto" ? localStorage.getItem(this.AUTO_KEY)
                                  : localStorage.getItem(this.slotKey(slot));
      const d = this.parse(raw);
      if (!d) return null;
      /* ⚠️ hireOrder 不能清（2026-09-12 修「发布需求后刷新=中断但钱照扣」）：
         扩编寻访是跨会话的等待任务（1~5 周，发布费在 request 时已扣），
         以前这里无条件置 null → 刷新后寻访凭空消失、经费白扣。
         hireCandidate 是退役的单槽字段，清掉无妨。 */
      d.state.hireCandidate = null;
      return d;
    } catch (e) { return null; }
  },

  /* ---- 删除槽位 ---- */
  remove(slot) {
    try {
      if (slot === "auto") localStorage.removeItem(this.AUTO_KEY);
      else localStorage.removeItem(this.slotKey(slot));
    } catch (e) {}
  },

  /* ---- 阶段锚点存档（2026-09-12 兜底机制）----
     玩家每个阶段开始（进入新阶段 / 重训本阶段）都会自动写一份快照到独立键，
     不占用 8 个手动槽，存档界面里也**不可见不可覆盖**。
     用途：旧档缺字段 / 配置污染等导致引擎每 tick 崩溃、时间卡死时（officeTick 连续
     抛异常），自动回滚到这份「本阶段开头」的快照重新开始本阶段——
     与 autoSave 的区别：autoSave 随时在写（救不回已坏的状态），锚点只在阶段起点写。 */
  saveStage(state) {
    const snap = this.buildSnapshot(state);
    try {
      localStorage.setItem(this.STAGE_KEY, JSON.stringify(snap));
      /* 阶段锚点是「关键节点」，强制上云（绕过节流）——官方最佳实践要求
         只在结算/过关/页面隐藏这类节点落盘，而不是随 tick 高频写 */
      this._notifyCloud("stage", snap, true);
      return snap;
    } catch (e) { return null; }
  },

  /* 读阶段锚点：走与 load() 相同的 parse 管线，保证旧锚点也能升级到当前结构 */
  loadStage() {
    try { return this.parse(localStorage.getItem(this.STAGE_KEY)); }
    catch (e) { return null; }
  },

  /* Calendar migration changes no stage progress. Patch the original snapshot
     directly so neither migration nor a rebuilt timestamp replaces its history.
     Do not upload this old anchor over the current automatic cloud snapshot. */
  patchStageBodyCalendar(state) {
    if (!state || !state.bodyCalendar) return false;
    try {
      const raw = localStorage.getItem(this.STAGE_KEY);
      if (!raw) return false;
      const snap = JSON.parse(raw), anchor = snap && snap.state;
      if (!anchor || anchor.stageNo !== state.stageNo || anchor.ver !== state.ver) return false;
      if (JSON.stringify(anchor.bodyCalendar) === JSON.stringify(state.bodyCalendar)) return false;
      anchor.bodyCalendar = JSON.parse(JSON.stringify(state.bodyCalendar));
      localStorage.setItem(this.STAGE_KEY, JSON.stringify(snap));
      return true;
    } catch (e) { return false; }
  },

  clearStage() {
    try { localStorage.removeItem(this.STAGE_KEY); } catch (e) {}
  },

  /* ---- 列出所有非空槽位（含 auto） ---- */
  list() {
    const out = [];
    for (let i = 0; i < this.MAX_SLOTS; i++) {
      const d = this.load(i);
      if (d) out.push({ slot: i, ...d, isAuto: false });
    }
    const a = this.load("auto");
    if (a) out.push({ slot: "auto", ...a, isAuto: true });
    // 自动存档放最前，手动槽按槽号升序
    out.sort((x, y) => {
      if (x.isAuto && !y.isAuto) return -1;
      if (!x.isAuto && y.isAuto) return 1;
      return (typeof x.slot === "number" ? x.slot : -1) - (typeof y.slot === "number" ? y.slot : -1);
    });
    return out;
  },

  /* ---- 生成存档快照 ---- */
  buildSnapshot(state) {
    const s = state;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const timeStr = `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const param = s.paramTarget ? s.paramTarget + "B" : "未定";
    /* 2026-09-13（用户：「存档的显示信息要显示具体是哪个阶段，现在显示第 N 周没用」）：
       存档名第一段从「第 N 周」改成**版本阶段**（V1 / V2.5 / V4 …）—— 玩家挑档时关心的是
       "这是哪一版的进度"；周数保留在后面当补充信息。 */
    const ver = s.ver || "V1";
    return {
      saveVersion: this.SAVE_VERSION,   // DOC 26 P0：独立存档格式版本号（load 时 migrate 依据）
      name: `${ver} · 第 ${s.week} 周 · ${param} · ${timeStr}`,
      time: now.toISOString(),
      state: this.clone(s),
      meta: {
        ver: ver,
        week: s.week,
        param: s.paramTarget || 0,
        paramLabel: param,
        funding: s.funding,
        brand: s.brand,
        reputation: s.reputation,
        parallelCount: s.parallel ? 2 : 1,
        /* 能力维度快照（真源 v35_core）：基础四维 + 追加轴一并写入，存档列表不用再改 */
        ...window.V35.dimsOf(s).reduce((o, k) => (o[k] = s[k], o), {}),
        phase: s.phase,
      },
    };
  },

  /* 深拷贝（避免存档引用共享可变对象） */
  clone(o) {
    if (Array.isArray(o)) return o.map((x) => this.clone(x));
    if (o && typeof o === "object") {
      const r = {};
      for (const k of Object.keys(o)) r[k] = this.clone(o[k]);
      return r;
    }
    return o;
  },
};
