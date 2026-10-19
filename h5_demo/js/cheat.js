/* ==========================================================================
   作弊器（仅本地开发环境）
   --------------------------------------------------------------------------
   ⚠️ 部署红线：本文件只允许在本地（localhost / 127.0.0.1）由 index.html 的
   hostname 判断动态注入。线上（vercel.app 等正式域名）永远不会加载本文件、
   也永远不会注册 F2 快捷键——不要在任何正式环境引用或暴露本文件内容。
   快捷键：F2 呼出 / 再按隐藏。功能：
   ① 跳到评审：时间推进到本阶段评审周，四维按该阶段 `MIN_DIM`、追加轴按 `AXIS_MIN`
      各 +1（刚好及格：评审页每一项都过、但不到优秀线）；口径 = core.passLine()（唯一真源）。
       ⚠️ 2026-09-14 修：以前读全局兜底 MIN_DIM/GREAT_SCORE（V1 那套 18/22/7/7 与 29）
       ⇒ 后期阶段数值离谱、轴完全没设；回归见 test_cheat.js。
   ② 触发破产：直接置欠薪走破产判定（首次弹兜底事件，第二次 Game Over）。
   ③ 重置兜底 / 分红 / 注资冷却：反复验证资本线与兜底链用。
   ④ 移除作弊注入的神秘工程师。
   ========================================================================== */
"use strict";

window.CheatTool = (() => {
  let panel = null;

  /* 数值按刚好及格设置：四维 ≥ 防偏科线（balanced），总评略低于优秀线（pass 而非 excellent）。
     v35 评审：total = Σ(weight×dim) + 品质加成 qBonus；excellent = total ≥ GREAT 且 balanced。 */
  function applyJustPass() {
    const ui = window.GameUI, core = ui && ui.core;
    if (!core) return "游戏未启动";
    const s = core.state, c = core.cfg;
    const V = (c.V35 || {}).REVIEW || {};
    const ver = s.ver || "V1";
    /* ⚠️ 唯一真源 = core.passLine()（逐阶段：MIN_DIM / GREAT_SCORE / AXIS_MIN 都在里头），
       权重也走 WEIGHTS_BY_VER 那一份 —— 与评审页同一把尺子。 */
    const line = core.passLine();
    const w = ((V.WEIGHTS_BY_VER || {})[ver]) || V.WEIGHTS || { code: 0.2, text: 0.45, safety: 0.2, stability: 0.15 };
    const great = line.score;
    /* ---- 作弊器补齐所有前置条件（2026-09-03 用户要求）：新手引导门 / 算力 / 立项全跳过 ----
       2026-09-05：团队为空时注入的「神秘工程师」打 cheat 标记 + 游戏内 toast 明示（用户反馈：
       此前默默出现、进存档长驻，看起来像莫名 bug）；已存在则复用，不重复注入。 */
    let injected = false;
    if (!(s.engineers || []).some((e) => !e.resigned)) {
      s.engineers = s.engineers || [];
      const tpl = (c.ENGINEERS || []).find((x) => x.type === "pretrain") || {};
      s.engineers.push(Object.assign({}, tpl, {
        /* ⚠️ ID 化（2026-09-14）：模板带着 `no`/`key`，但这个人**不是池子条目** ——
           不清掉的话 engUid() 会按 no 折成 "e2001"，与自己的 id "cheat_eng" 不一致
           （「两把尺子」：占用表/冷却表会误挡池子里 2001 号的抽取）。 */
        no: null, key: null,
        id: "cheat_eng", name: "神秘工程师", type: "pretrain", cheat: true,
        traits: [{ type: "pretrain", level: 3 }],
        stats: { code: 80, algo: 85, text: 70 },       // 潜力三维（精力/协作已删除）
        salary: 83333, energy: 100, joinTick: 0,        // 初始体力固定 100
      }));
      injected = true;
    }
    s.gpuTier = s.gpuTier || "basic";
    s.planDone = true;
    s.arch = s.arch || "dense";
    s.recipe = s.recipe || "chat";
    s.paramTarget = s.paramTarget || 7;
    if (!s.v35) s.v35 = window.V35.createState ? window.V35.createState("serious") : {};
    s.v35.arch = s.v35.arch || s.arch;
    s.v35.paramTarget = s.v35.paramTarget || s.paramTarget;
    /* 时间真实推进（2026-09-08 用户要求）：走正常 tick 循环，而不是只改个周数字。
       这样周结算里的新闻时间线 / 论文完成 / 发薪 / 节点提示都会按周真正触发完。
       ⚠️ 2026-09-17 修 BUG（用户报「V4.5 跳到评审后按钮置灰、不让发起评审」）：
         以前这里用**全局兜底** `V35.WEEKS`（=6），而各阶段最短可评审周数在
         `MIN_WEEKS_BY_VER`（[6,6,8,8,10,10,10,10]，下标对齐 VER_ORDER）——
         V4.5 要求 10 周，作弊器却只把时间推到 6 周 ⇒ `canReview()` 判
         `week >= minWeeks(ver)` 不通过 ⇒「发起评审」按钮置灰。
         这与下面 MIN_DIM/AXIS_MIN 是**同一类错**（没跟逐阶段表走），
         唯一真源一律用 `core.minWeeks(ver)`。 */
    const weeks = core.minWeeks(ver);
    const tpw = (c.V35 && c.V35.TICKS_PER_WEEK) || 6;
    const targetTick = weeks * tpw;
    const curTick = (s.v35 && s.v35.tick) || 0;
    const need = Math.max(0, targetTick - curTick);
    if (need > 0 && core.officeAdvance) {
      try { core.officeAdvance(need); } catch (e) { /* 作弊器不因单帧异常中断 */ }
    }
    if ((s.week || 0) < weeks) s.week = weeks;   // 兜底：确保能发起评审
    /* ---- 数值：四维取该阶段 MIN_DIM、追加轴取该阶段 AXIS_MIN，各自 +1 并按上限封顶 ----
       ⚠️ 2026-09-14 修 BUG（用户报「跳到评审没跟着最新数值」）：以前读的是**全局兜底**
          `REVIEW.MIN_DIM / GREAT_SCORE`（= V1 教学关那套 18/22/7/7 与 29）——
          逐阶段表（BY_VER）09-08 就有、09-13/09-14 又整表重标过，这个作弊器却一直没跟着走，
          于是 V4.5 会把四维设成 ~19/23/8/8 而真正的线是 499/684/630/637（评审页一片 ✗、进度条几乎全空）；
          **追加轴更是完全没设**（V2 起有 AXIS_MIN）⇒ 轴判定必挂、任务直接判「未达成」。
       现在：`core.passLine()`（唯一真源）+ `dimsOf` 把四维与**本模型激活的轴**一起设到位，
       再按 `statCap()`（含轴上上限）封顶。 */
    const cap = core.statCap();
    const lim = (k) => (cap && cap[k] != null ? cap[k] : 999999);
    const setAt = (k, want) => {
      if (want == null) return;
      s[k] = Math.min(lim(k), Math.max(1, Math.ceil(want) + 1));
    };
    setAt("code", line.code); setAt("text", line.text);
    setAt("safety", line.safety); setAt("stability", line.stability);
    Object.keys(line.axMin || {}).forEach((k) => setAt(k, line.axMin[k]));
    /* 预测总分（与 V35.review 同口径：按本阶段权重表全量归一化 + 品质加成） */
    let qBonus = 0;
    try { qBonus = window.V35.qualityBonus ? window.V35.qualityBonus(s.v35 || {}) : 0; } catch (e) {}
    const dims = core.dimsOf(s);
    const wsum = Object.keys(w).reduce((a, k) => a + (w[k] || 0), 0) || 1;
    const totalOf = () => dims.reduce((a, k) => a + (w[k] || 0) * (s[k] || 0), 0) / wsum + qBonus;
    /* 压线：把**权重最大**的维度往上顶，尽量贴近优秀线但不越过（顶不动 = 封顶了，就算了） */
    const heavy = dims.slice().sort((a, b) => (w[b] || 0) - (w[a] || 0))[0];
    if (heavy) {
      const need0 = Math.ceil(((great - 0.2) - totalOf()) / Math.max(0.01, (w[heavy] || 0.1)));
      if (need0 > 0) s[heavy] = Math.min(lim(heavy), s[heavy] + need0);
    }
    /* 兜底：万一压线越过了优秀线（步长取整 / 轴加成），逐点回退到线下 */
    let guard = 0;
    while (heavy && totalOf() >= great && s[heavy] > 1 && guard++ < 5000) s[heavy] -= 1;
    /* 上限封顶 + 取整（statCap 内）；不触碰评审结果，让玩家自己点「发起评审」走完整演出 */
    dims.forEach((k) => { s[k] = Math.min(lim(k), Math.max(0, Math.round(s[k]))); });
    if (s.v35) {
      s.v35.stats = s.v35.stats || {};
      dims.forEach((k) => { s.v35.stats[k] = s[k]; });   // 四维 + 轴都同步进引擎态
    }
    const predict = Math.round(totalOf() * 10) / 10;
    s.officePaused = false;
    s.officeModal = "review";
    ui.render({ soft: true });
    if (injected) {
      /* 游戏内明示：不然办公室里凭空站个人，玩家不知道哪来的 */
      if (ui.toast) ui.toast("🛠 作弊：团队为空，已注入「神秘工程师」顶替产出（可在团队面板辞退）");
      return "已按 " + ver + " 的评审线调整（四维 ≥ " + JSON.stringify({ code: line.code, text: line.text, safety: line.safety, stability: line.stability })
        + (Object.keys(line.axMin || {}).length ? "，轴 ≥ " + JSON.stringify(line.axMin) : "")
        + "）并进入评审面板；预计总评 ≈ " + predict + "（优秀线 " + great + "）。注入了 1 名神秘工程师补位。";
    }
    return "已按 " + ver + " 的评审线调整（四维 ≥ " + JSON.stringify({ code: line.code, text: line.text, safety: line.safety, stability: line.stability })
      + (Object.keys(line.axMin || {}).length ? "，轴 ≥ " + JSON.stringify(line.axMin) : "")
      + "）并进入评审面板；预计总评 ≈ " + predict + "（优秀线 " + great + "）";
  }

  /* 移除作弊注入的神秘工程师（2026-09-05 用户反馈：出现时机莫名其妙）——
     只清 cheat 标记的（老档里没有标记的 cheat_eng 按 id 兜底），团队不为空时保留正常成员 */
  function removeCheatEng() {
    const ui = window.GameUI, core = ui && ui.core;
    if (!core) return "游戏未启动";
    const s = core.state;
    const before = (s.engineers || []).length;
    s.engineers = (s.engineers || []).filter((e) => !(e.cheat || e.id === "cheat_eng"));
    const removed = before - s.engineers.length;
    ui.render({ soft: true });
    return removed > 0 ? "已移除 " + removed + " 名作弊工程师" : "团队里没有作弊工程师";
  }

  /* 破产信号是 **fiscalDeficit > 0**（不是 funding < 0 —— 欠薪时 doPayroll 会把 funding
     置 0、差额记进 fiscalDeficit）。判定在 officeAdvanceV35 里**每 tick 都跑**，
     所以只需要置欠薪 + 恢复时间，下一 tick 就会走到破产链：
       首次 → 弹 V35_BAILOUT 兜底事件；已用过兜底（bailoutUsed）→ 直接 Game Over。 */
  function triggerBankrupt() {
    const ui = window.GameUI, core = ui && ui.core;
    if (!core) return "游戏未启动";
    const s = core.state;
    if (s.phase !== "office") return "只在办公室阶段可触发（当前 phase = " + (s.phase || "?") + "）";
    s.funding = 0;
    s.fiscalDeficit = (s.fiscalDeficit || 0) + 100000;
    s.officePaused = false;                       // 暂停中时间不走 → 判定永远不落地
    if (ui.toast) ui.toast("💥 作弊：已置欠薪 10 万，下一 tick 走破产判定");
    ui.render({ soft: true });
    return s.bailoutUsed
      ? "已置欠薪 → 第二次破产：直接 Game Over"
      : "已置欠薪 → 首次破产：弹出「有人替我们续上了」兜底事件";
  }

  /* 重置兜底 / 分红 / 冷却状态（反复验证兜底链用） */
  function resetBailout() {
    const ui = window.GameUI, core = ui && ui.core;
    if (!core) return "游戏未启动";
    const s = core.state;
    s.bailoutUsed = false;
    s.fiscalDeficit = 0;
    s._bailoutCooldownUntil = 0;
    if (s.v35) s.v35.dividend = null;
    if (ui.toast) ui.toast("🔄 作弊：兜底 / 分红 / 注资冷却已重置");
    ui.render({ soft: true });
    return "已重置 bailoutUsed / 欠薪 / 分红 / 注资冷却";
  }

  function previewFinale() {
    if (!window.GameUI || !window.GameUI.core) return "游戏未启动";
    const film = window.LifeFinale;
    if (!film || typeof film.preview !== "function") return "结局模块尚未加载，请稍后重试";
    if (film.isOpen && film.isOpen()) return "结局演出正在播放";
    const opened = film.preview({unlockMemories:true});
    if (!opened) return "当前无法打开结局预览";
    if (panel) panel.style.display = "none";
    return "已打开完整结局预览（不改变存档与通关进度）";
  }

  const FEATURES = [
    { name: "🎬 直接预览结局动画", run: previewFinale },
    { name: "🎯 跳到评审（数值刚好及格）", run: applyJustPass },
    { name: "🧹 移除神秘工程师（作弊补位）", run: removeCheatEng },
    { name: "💥 触发破产（首次弹兜底 / 二次真失败）", run: triggerBankrupt },
    { name: "🔄 重置兜底 · 分红 · 注资冷却", run: resetBailout },
  ];

  function ensurePanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "cheat-panel";
    panel.style.cssText = "position:fixed;top:56px;right:12px;z-index:99999;background:rgba(20,26,34,0.96);"
      + "border:1px solid rgba(110,168,255,0.55);border-radius:12px;padding:12px 14px;display:none;"
      + "flex-direction:column;gap:8px;min-width:240px;box-shadow:0 14px 34px -14px rgba(0,0,0,0.6);"
      + "font:12px/1.5 system-ui,-apple-system,'Microsoft YaHei',sans-serif;color:#dbe7f3;";
    panel.innerHTML = `<div style="font-weight:900;font-size:13px;margin-bottom:2px">🛠 作弊器 <span style="opacity:.55;font-weight:700">F2 开关</span></div>`;
    for (const f of FEATURES) {
      const b = document.createElement("button");
      b.textContent = f.name;
      b.style.cssText = "text-align:left;padding:7px 10px;border-radius:8px;border:1px solid rgba(110,168,255,0.4);"
        + "background:rgba(110,168,255,0.12);color:#dbe7f3;font-weight:700;cursor:pointer;font-size:12px;";
      b.addEventListener("click", () => {
        const msg = f.run();
        const tip = document.createElement("div");
        tip.style.cssText = "font-size:11px;opacity:.85;";
        tip.textContent = "→ " + msg;
        panel.append(tip);
        setTimeout(() => tip.remove(), 3500);
      });
      panel.append(b);
    }
    document.body.append(panel);
  }

  function toggle() {
    ensurePanel();
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
  }

  /* 仅本地环境注册快捷键；线上（正式域名）什么都不挂载 */
  const host = location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (isLocal) {
    window.addEventListener("keydown", (e) => {
      if (e.key === "F2") { e.preventDefault(); toggle(); }
    });
  }
  /* ⚠️ 这里把几个功能函数一起导出去，**只为无头回归**（h5_demo/test_cheat.js 直接调它们，
     不必模拟 F2 与点击）。本文件只在 localhost 由 index.html 动态注入，线上不加载。 */
  return { toggle, isLocal, FEATURES, previewFinale, applyJustPass, removeCheatEng, triggerBankrupt, resetBailout };
})();
