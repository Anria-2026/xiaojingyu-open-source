/* ==========================================================================
   玩法配置页（大模型研发养成 · §8 基础数值）
   --------------------------------------------------------------------------
   2026-09-03 重排：按模块分卡片展示（经费奖金 / 评审 / 周期语料 / 团队招聘 /
   算力 / 训练动画 / 小游戏），说明文本与 V3.5.2 现状对齐；删除已废弃的旧
   通关条件（PASSV1_*、EXCELLENT_RATIO 展示）与死分支处理代码。
   图片字段（显卡图等）支持「浏览文件夹」选择（ResPicker）。
   事件→【事件】页，工程师→【工程师】页，文本→【文本】页，UI→【UI 配置】页。
   保存（section=base，浅合并散 key）→ 同步游戏。
   ========================================================================== */
"use strict";

window.GameCfgTool = {
  data: null,   // 基础数值工作副本

  /* [feature:editor-array-identity] */
  /* 与游戏读取一致：对象逐键合并，保存数组整体替换并深拷贝。
     数组中的稳定编号决定身份，重排、删项和新增条目不能按默认索引补字。 */
  deepMerge(base, over) {
    const plain = v => !!v && typeof v === "object" && !Array.isArray(v);
    const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
    const out = copy(base || {});
    for (const [k,value] of Object.entries(over || {})) {
      out[k] = plain(value) && plain(out[k]) ? this.deepMerge(out[k],value) : copy(value);
    }
    return out;
  },
  /* [/feature:editor-array-identity] */
  /* 值数组归一化（自愈）：旧版本编辑器把二维数组 [[1,2],[2,3]] 序列化成
     [{0:1,1:2},{0:2,1:3}]（deepMerge 误判，见上方注释）。页面一旦加载了这种脏数据，
     再点保存就会把它原样写回 data/game_cfg.json —— 修好文件也会被旧内存覆盖。
     这里在加载期先还原成真数组，编辑器「读一次 + 存一次」即可自愈。 */
  normalizeValueArrays(cfg) {
    const toRows = (arr) => Array.isArray(arr) ? arr.map((r) => {
      if (Array.isArray(r)) return r;
      if (r && typeof r === "object") {
        const ks = Object.keys(r).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b);
        if (ks.length) return ks.map((k) => r[k]);
      }
      return r;
    }) : arr;
    const V = cfg && cfg.V35;
    if (V) {
      if (V.TIER_RANGES) V.TIER_RANGES = toRows(V.TIER_RANGES);
      if (V.PRE_TRAIT_TIERS) V.PRE_TRAIT_TIERS = toRows(V.PRE_TRAIT_TIERS);
      if (V.POST_TRAIT_TIERS) V.POST_TRAIT_TIERS = toRows(V.POST_TRAIT_TIERS);
      if (V.Q_TIERS) V.Q_TIERS = toRows(V.Q_TIERS);
      if (V.CORPUS_CURVE && V.CORPUS_CURVE.GAP_TIERS) V.CORPUS_CURVE.GAP_TIERS = toRows(V.CORPUS_CURVE.GAP_TIERS);
    }
    return cfg;
  },

  async refresh(part = "base") {
    /* 2026-09-05 架构修复：touched 集合随刷新重置——本页只提交「用户实际改过」的键
       2026-09-09 拆页说明：玩法配置 / 演出 / 词条 三个 tab 共用这一份 this.data，
       切页不重新 fetch（避免覆盖内存中未保存的编辑），只按 part 渲染对应容器。
       首次进入才真正拉取配置。 */
    if (!this.data) {
      try {
        const r = await (await fetch("/api/game-cfg")).json();
        if (window.CfgSync) CfgSync.note(r);
        const saved = r.config || {};
        const def = window.GameDefaults.base;
        this.data = this.normalizeValueArrays(
          Object.keys(saved).length ? this.deepMerge(def, saved) : JSON.parse(JSON.stringify(def)));
      } catch (e) {
        this.data = JSON.parse(JSON.stringify(window.GameDefaults.base));
      }
      this.ensure(this.data);
    }
    this.touched = this.touched || new Set();
    if (part === "render" || part === "*") { this.renderBase(); this.renderShow(); this.renderTrait(); return; }
    if (part === "show") { this.renderShow(); return; }
    if (part === "trait") { this.renderTrait(); return; }
    if (part === "axis") {
      const b = document.getElementById("gamecfg-axis");
      if (b) b.innerHTML = this.axisPartHTML(this.data);
      return;
    }
    this.renderBase();
  },

  /* 确保关键键存在（渲染前兜底）2026-09-09 */
  ensure(d) {
    if (!d.V35) d.V35 = JSON.parse(JSON.stringify(window.GameDefaults.base.V35 || {}));
    if (!d.PASS_PRIZE_BY_VER) d.PASS_PRIZE_BY_VER = JSON.parse(JSON.stringify(window.GameDefaults.base.PASS_PRIZE_BY_VER));
    if (!d.MINIGAMES) d.MINIGAMES = JSON.parse(JSON.stringify(window.GameDefaults.base.MINIGAMES));
    if (!d.RANK_BOARD_BY_VER) d.RANK_BOARD_BY_VER = JSON.parse(JSON.stringify(window.GameDefaults.base.RANK_BOARD_BY_VER || {}));
    if (!d.USER_GAIN_MUL_BY_VER) d.USER_GAIN_MUL_BY_VER = JSON.parse(JSON.stringify(window.GameDefaults.base.USER_GAIN_MUL_BY_VER || {}));
    if (!d.USER_FEEDBACK) d.USER_FEEDBACK = JSON.parse(JSON.stringify(window.GameDefaults.base.USER_FEEDBACK || {}));
    if (!d.STAGE_TRAIT_MAX) d.STAGE_TRAIT_MAX = JSON.parse(JSON.stringify(window.GameDefaults.base.STAGE_TRAIT_MAX || {}));
    return d;
  },

  init() {
    /* 分页保存按钮已删，统一走右上角「保存全部」（App.save → syncAllConfigs） */
    this.refresh();
  },

  /* ---- 渲染小工具 ---- */
  num(label, attrs, val, step) {
    attrs = attrs.replace(/\s(?:min|max|step)=(?:"[^"]*"|'[^']*'|[^\s>]+)/g, "");
    return `
      <div class="gcf-field">
        <label>${label}</label>
        <input type="number" ${attrs} value="${val}" step="any">
      </div>`;
  },
  text(label, attrs, val) {
    return `
      <div class="gcf-field">
        <label>${label}</label>
        <input type="text" ${attrs} value="${String(val == null ? "" : val).replace(/"/g, "&quot;")}">
      </div>`;
  },
  pct(label, attrs, val) {
    return `
      <div class="gcf-field gcf-pct">
        <label>${label} <b>${Math.round(val * 100)}%</b></label>
        <input type="number" step="any" value="${Math.round(val * 100)}" ${attrs}>
      </div>`;
  },
  /* 图片字段：路径输入 + 「浏览」按钮（ResPicker 弹窗选 resource 下任意美术目录） */
  img(label, attrs, val) {
    return `
      <div class="gcf-field gcf-img">
        <label>${label}</label>
        <div class="gcf-img-row">
          <input type="text" ${attrs} value="${String(val == null ? "" : val).replace(/"/g, "&quot;")}">
          <button class="btn btn-sm" type="button" data-browse>📁 浏览</button>
        </div>
      </div>`;
  },
  /* 一张模块卡片 */
  mod(icon, title, tip, body) {
    return `
      <div class="gcf-mod">
        <div class="gcf-mod-head">${icon} ${title}</div>
        ${tip ? `<p class="gcf-tip">${tip}</p>` : ""}
        ${body}
      </div>`;
  },

  /* ==========================================================================
     兼容入口 render()（2026-09-11 补 · 修的是老 BUG 不是新功能）
     --------------------------------------------------------------------------
     历史代码里有 **8 处** 写了 `t().render()`，但这个对象**根本没有 render 方法** ——
     每次点击都在静默抛 `TypeError: t().render is not a function`，
     玩家看到的就是「按钮点了没反应」（评测题库的「＋新增题目 / 删除」一直是坏的）。
     这里按 refresh("render") 的口径补上：三个页面容器 + 能力轴区。
     ⚠️ 只用于「增删条目」这类需要重画列表的场景；**打字时不要调**（会丢焦点、滚动跳顶）。
     ========================================================================== */
  render() {
    this.renderBase();
    this.renderShow();
    this.renderTrait();
    const ax = document.getElementById("gamecfg-axis");
    if (ax) ax.innerHTML = this.axisPartHTML(this.data);
  },

  /* 架构 × 参数 语料要求表（2026-09-12 二改）：按架构分块的纯数字输入表格。
     行 = 架构 × TARGET_PARAMS（参数 ≤ 该架构 maxParam 才算合法组合）；
     缺行时按系数链算默认值兜底显示（WEEK_ADD_BASE × 架构系数 × 参数系数 / 架构 gate）。 */
  archParamReqTable(d) {
    const BASE = window.GameDefaults.base;
    const archs = d.ARCHITECTURES || BASE.ARCHITECTURES || [];
    const params = BASE.TARGET_PARAMS || [7, 13, 34, 70];
    const CC = (d.V35 || {}).CORPUS_CURVE || {};
    const wBase = CC.WEEK_ADD_BASE != null ? CC.WEEK_ADD_BASE : 34;
    const tbl = (a) => {
      const ps = params.filter((p) => a.maxParam == null || p <= a.maxParam);
      if (!ps.length) return "";
      const trs = ps.map((p) => {
        const key = a.id + "@" + p;
        const row = ((d.ARCH_PARAM_REQ || {})[key]) || {};
        const am = (CC.WEEK_ADD_BY_ARCH || {})[a.id];
        const pm = (CC.WEEK_ADD_BY_PARAM || {})[String(p)];
        const fbWeek = Math.round(wBase * (am != null ? am : 1) * (pm != null ? pm : 1));
        const gate = row.gate != null ? row.gate : (a.gate != null ? a.gate : 0);
        const week = row.weekAdd != null ? row.weekAdd : fbWeek;
        const q = row.quality != null ? Math.round(row.quality * 100) : 0;
        return '<tr><td class="apr-param">' + p + 'B</td>'
          + '<td><input type="number" min="0" step="1" data-apr="' + key + '" data-aprf="gate" value="' + gate + '"></td>'
          + '<td><input type="number" min="0" step="1" data-apr="' + key + '" data-aprf="weekAdd" value="' + week + '"></td>'
          + '<td class="apr-q"><input type="number" min="0" max="100" step="20" data-apr="' + key + '" data-aprf="quality" value="' + q + '"><i>%</i></td></tr>';
      }).join("");
      return '<div class="apr-arch"><div class="apr-arch-head">' + (a.name || a.id)
        + ' <i>' + a.id + '</i>' + (a.maxParam != null ? '<span>参数上限 ' + a.maxParam + 'B</span>' : '')
        + '</div><table class="apr-tbl"><thead><tr><th>参数档</th><th>语料门槛（亿 token）</th>'
        + '<th>每周增量（亿/周）</th><th>品质要求（良好+优质）</th></tr></thead><tbody>' + trs + '</tbody></table></div>';
    };
    return '<div class="apr-wrap">' + archs.map(tbl).join("") + '</div>';
  },

  renderBase() {
    const d = this.data;
    this.ensure(d);
    const rd = d.V35.REVIEW, cc = d.V35.CORPUS_CURVE;
    const VER_ORDER = d.VER_ORDER || window.GameDefaults.base.VER_ORDER || [];
    const wan = (n) => (n / 10000).toFixed(0);

    /* ---- 1. 经费 · 品牌 · 奖金 ---- */
    const prizes = VER_ORDER.map((v) =>
      this.num(`${v} 通过奖金`, `data-prize="${v}"`, (d.PASS_PRIZE_BY_VER || {})[v] != null ? d.PASS_PRIZE_BY_VER[v] : "", 100000)).join("");
    const m1 = this.mod("💰", "经费 · 品牌 · 评审奖金",
      /* [feature:retired-stage-budget-editor-copy] */
      "开局经费一次性发放；评审结算按当前阶段发放奖金，进入下一阶段不再额外拨款；优秀再加经费与品牌；事件收入保留原有规则。",
      /* [/feature:retired-stage-budget-editor-copy] */
      `<div class="gcf-grid">
        ${this.num("开局经费（元）", 'data-base="INIT_FUNDING"', d.INIT_FUNDING, 100000)}
        ${this.num("开局品牌值（0-200）", 'data-base="INIT_BRAND"', d.INIT_BRAND)}
        ${this.num("品牌一星门槛（品牌值 ≥）", 'data-base="BRAND_STAR_BASE"', d.BRAND_STAR_BASE != null ? d.BRAND_STAR_BASE : 80)}
        ${this.num("品牌升星步长（每 +N 升一星）", 'data-base="BRAND_STAR_STEP"', d.BRAND_STAR_STEP != null ? d.BRAND_STAR_STEP : 30)}
        ${this.num("优秀额外经费（元）", 'data-base="EXCELLENT_FUNDING"', d.EXCELLENT_FUNDING != null ? d.EXCELLENT_FUNDING : 500000, 100000)}
        ${this.num("优秀额外品牌", 'data-base="EXCELLENT_BRAND"', d.EXCELLENT_BRAND != null ? d.EXCELLENT_BRAND : 4)}
        ${this.pct("每星品牌经费加成", 'data-base="BRAND_INCOME_PER_STAR"', d.BRAND_INCOME_PER_STAR != null ? d.BRAND_INCOME_PER_STAR : 0.03)}
        ${this.num("顶尖追加品牌", 'data-base="TOP_BRAND"', d.TOP_BRAND != null ? d.TOP_BRAND : 2)}
        ${this.num("优品小模型收益（元/个）", 'data-base="MINI_MODEL_BONUS"', d.MINI_MODEL_BONUS != null ? d.MINI_MODEL_BONUS : 100000, 10000)}
      </div>
      <div class="gcf-subhead">各阶段评审通过奖金（元）</div>
      <div class="gcf-grid">${prizes}</div>
      <div class="gcf-subhead">品牌成长（首次过关奖励；所有获得受阶段上限约束）</div>
      <div class="gcf-grid">${VER_ORDER.map(v => this.num(v + " 品牌上限", 'data-brand-ver="'+v+'" data-brand-field="BRAND_CAP_BY_VER"', (d.BRAND_CAP_BY_VER || {})[v] ?? 200) + this.num(v + " 首过品牌", 'data-brand-ver="'+v+'" data-brand-field="BRAND_PASS_BY_VER"', (d.BRAND_PASS_BY_VER || {})[v] ?? 0)).join("")}</div>`);

    /* ---- 2. 评审（V3.5 总分制） ---- */
    const rw = rd.WEIGHTS || { code: 0.2, text: 0.45, safety: 0.2, stability: 0.15 };
    const m2 = this.mod("🧪", "评审 · V3.5 总分制",
      "总分 = 四维加权（本模块权重）+ 品质分档加成（分档表在 game_cfg.js V35.Q_TIERS）。优秀 = 总分 ≥ 优秀线 且 四维 ≥ 防偏科线；未达优秀即「通过」（V1 无失败档，破产才是失败）。"
      + "顶尖 = 优秀 + 均衡 + 总分 ≥ 优秀线 × 顶尖倍率（2026-09-29 起口径 = 阶段上限的百分比："
      + "优秀线 = 上限 × 0.75、顶尖线 = 上限 × 0.90 ⇒ 倍率 = 1.20，**不得 > 1/0.75 ≈ 1.3333**）。",
      `<div class="gcf-grid">
        ${this.num("优秀线（总分 ≥）", 'data-base="V35_GREAT"', rd.GREAT_SCORE, 0.5)}
        ${this.num("顶尖倍率（优秀线 ×）", 'data-base="TOP_RATIO"', d.TOP_RATIO != null ? d.TOP_RATIO : 1.20, 0.01)}
        ${this.num("防偏科·代码 ≥", 'data-base="V35_MIN_CODE"', rd.MIN_DIM.code)}
        ${this.num("防偏科·文字 ≥", 'data-base="V35_MIN_TEXT"', rd.MIN_DIM.text)}
        ${this.num("防偏科·安全 ≥", 'data-base="V35_MIN_SAFETY"', rd.MIN_DIM.safety)}
        ${this.num("防偏科·稳定 ≥", 'data-base="V35_MIN_STAB"', rd.MIN_DIM.stability)}
      </div>
      <div class="gcf-subhead">逐阶段通过门槛（REVIEW.BY_VER · 一行一个阶段：优秀线 + 四维防偏科线）</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
        ${(Object.keys(rd.BY_VER || {})).map((v) => {
          const row = rd.BY_VER[v] || {};
          const md = row.MIN_DIM || {};
          const f = (rk, label, val, step) => '<div class="gcf-field"><label>' + label + '</label>'
            + '<input type="number"' + (step != null ? ' step="' + step + '"' : '') + ' data-rv="' + v + '" data-rvk="' + rk + '" value="' + val + '"></div>';
          return '<div class="gcf-row-card" style="display:grid;grid-template-columns:56px repeat(5,1fr);gap:6px;align-items:end;padding:7px 10px">'
            + '<b style="font-size:12px;color:var(--text,#e8ecf2);padding-bottom:7px">' + v + '</b>'
            + f("GREAT_SCORE", "优秀线", row.GREAT_SCORE != null ? row.GREAT_SCORE : "", 0.5)
            + f("code", "代码 ≥", md.code != null ? md.code : "")
            + f("text", "文字 ≥", md.text != null ? md.text : "")
            + f("safety", "安全 ≥", md.safety != null ? md.safety : "")
            + f("stability", "稳定 ≥", md.stability != null ? md.stability : "")
            + '</div>';
        }).join("")}
      </div>
      <div class="gcf-subhead">评审四维权重（合计应 = 100%）</div>
      <div class="gcf-grid">
        ${this.pct("代码", 'data-v35w="code"', rw.code)}
        ${this.pct("文字", 'data-v35w="text"', rw.text)}
        ${this.pct("安全", 'data-v35w="safety"', rw.safety)}
        ${this.pct("稳定", 'data-v35w="stability"', rw.stability)}
      </div>
      <div class="gcf-subhead">测评演出台权重（答题动画答对率用，与评审无关）</div>
      <div class="gcf-grid">
        ${this.pct("代码", 'data-pct="code"', d.EVAL_WEIGHTS.code)}
        ${this.pct("文字", 'data-pct="text"', d.EVAL_WEIGHTS.text)}
        ${this.pct("安全", 'data-pct="safety"', d.EVAL_WEIGHTS.safety)}
        ${this.pct("稳定", 'data-pct="stability"', d.EVAL_WEIGHTS.stability)}
      </div>`);

    /* ---- 3. 周期 · 语料 · 攻关 ---- */
    const st = d.V35.STAGES || {};
    const m3 = this.mod("⏳", "周期 · 语料 · 攻关",
      "1 tick = 每 TICK 秒一跳，每周 = TICKS_PER_WEEK 个 tick，训练周期 WEEKS 周。语料门槛按阶段生效（V1 / V1.5），其余阶段用兜底值；外包单价单位为万/条。⚠️ 每周语料增量实际由下方「架构×参数语料要求表」（未配置时 = 基准×架构系数×参数系数）决定，本卡的「每周语料需求」两行已停用仅作展示。",
      `<div class="gcf-grid">
        ${this.num("训练周期（周）", 'data-base="V35_WEEKS"', d.V35.WEEKS)}
        ${this.num("每 tick 时长（秒）", 'data-base="V35_TICK_S"', d.V35.TICK_S, 1)}
        ${this.num("每周 tick 数", 'data-base="V35_TP_WEEK"', d.V35.TICKS_PER_WEEK)}
        ${this.num("V1 语料启动门槛", 'data-stage="V1" data-key="GATE"', (st.V1 || cc).GATE, 5)}
        ${this.num("V1 每周语料需求（停用）", 'data-stage="V1" data-key="WEEK_ADD"', (st.V1 || cc).WEEK_ADD, 5)}
        ${this.num("V1.5 语料启动门槛", 'data-stage="V1.5" data-key="GATE"', (st["V1.5"] || cc).GATE, 5)}
        ${this.num("V1.5 每周语料需求（停用）", 'data-stage="V1.5" data-key="WEEK_ADD"', (st["V1.5"] || cc).WEEK_ADD, 5)}
        ${this.num("兜底·语料启动门槛", 'data-base="V35_GATE"', cc.GATE, 5)}
        ${this.num("兜底·每周语料需求（停用）", 'data-base="V35_WEEK_ADD"', cc.WEEK_ADD, 5)}
        ${this.num("外包单价（万/条）", 'data-buy="price"', cc.BUY.price, 0.05)}
        ${this.pct("外包良好品质率", 'data-buy="goodProb"', cc.BUY.goodProb)}
      </div>
      <div class="gcf-grid">
        ${this.num("数据工程师每 tick 语料条数", 'data-base="V35_DATA_ITEMS"', d.V35.DATA_ITEMS != null ? d.V35.DATA_ITEMS : 8)}
      </div>
      <div class="gcf-subhead">架构 × 参数 语料要求表（ARCH_PARAM_REQ · 已按当前默认值预填，改数即生效）</div>
      <div style="font-size:12px;line-height:1.7;color:var(--text-dim,#7a8a98);margin:4px 0 6px">每行 = 一个「架构 × 参数」组合，只填数字：<b>语料门槛</b> = 立项时要求已持有的有效 token（亿）；<b>每周增量</b> = 该组合训练期每周新增的语料需求（亿/周）；<b>品质要求</b> = 立项配比里「良好+优质」的占比下限，自动向上对齐 20% 档（滑条 20% 一档），0% = 无要求。改完随右上角「保存全部」一并保存。</div>
      ${this.archParamReqTable(d)}
      <div class="gcf-subhead">优质加成（立项配比里优质每 +20%，产出周期缩短）</div>
      <div class="gcf-grid">
        ${this.num("每 20% 优质缩短（秒）", 'data-base="V35_PREMIUM_TICK"', d.V35.PREMIUM_TICK_BONUS != null ? d.V35.PREMIUM_TICK_BONUS : 1, 1)}
      </div>
      <div class="gcf-subhead">语料缺口减速（满足率 = 持有 / 本周需求水位，进度条刻度与此同步）</div>
      <div class="gcf-grid">
        ${this.num("语料充裕线（满足率%）", 'data-base="V35_GAP_FREE"', (d.V35.GAP_SLOW || {}).FREE_ABOVE != null ? d.V35.GAP_SLOW.FREE_ABOVE : 90, 5)}
        ${this.num("减速阶梯步长（%）", 'data-base="V35_GAP_STEP"', (d.V35.GAP_SLOW || {}).STEP != null ? d.V35.GAP_SLOW.STEP : 10, 1)}
        ${this.num("每档产出周期延迟（毫秒）", 'data-base="V35_GAP_DELAY"', (d.V35.GAP_SLOW || {}).DELAY_MS != null ? d.V35.GAP_SLOW.DELAY_MS : 1000, 100)}
      </div>
      <div class="gcf-subhead">攻关（选方向 → 该方向产出 ×倍率，条件 = 语料门槛 + 经费）</div>
      <div class="gcf-grid">
        ${this.num("攻关产出倍率", 'data-base="V35_FOCUS_MUL"', d.V35.FOCUS_MUL, 0.1)}
        ${this.num("攻关持续（tick）", 'data-base="V35_FOCUS_TICKS"', d.V35.FOCUS_TICKS)}
        ${this.num("攻关门槛倍率（×当前组合立项门槛）", 'data-base="V35_FOCUS_GATE_MUL"', d.V35.FOCUS_GATE_MUL != null ? d.V35.FOCUS_GATE_MUL : 1.3, 0.1)}
        ${this.num("兜底·攻关语料门槛（亿 token）", 'data-base="V35_GATE_FOCUS"', d.V35.FOCUS_CORPUS_GATE != null ? d.V35.FOCUS_CORPUS_GATE : 120, 10)}
        ${this.num("攻关经费消耗（元）", 'data-base="V35_FOCUS_COST"', d.V35.FOCUS_COST != null ? d.V35.FOCUS_COST : 200000, 10000)}
      </div>`);

    /* ---- 4. 论文研究（耗时 + 永续效果）---- */
    const pw = d.V35.TICKS_PER_WEEK || 6;
    const m4 = this.mod("📄", "论文研究（耗时 · 永续效果）",
      "论文只耗时不花钱（V3.5.2）：每阶段解锁 1 篇，研究完成即永续生效。V1 论文 = 任何手段获得文字成长时按概率额外 +N；V1.5 论文（LoRA）= 数据工程师语料产量 ×倍率。",
      `<div class="gcf-grid">
        ${this.num("研究耗时（tick）", 'data-base="V35_PAPER_TICKS"', d.V35.PAPER_RESEARCH_TICKS)}
        ${this.text("折合周数（只读）", 'data-readonly="1"', (Math.round((d.V35.PAPER_RESEARCH_TICKS / pw) * 10) / 10) + " 周（按每周 " + pw + " tick）")}
        ${this.pct("V1 论文·文字成长触发概率", 'data-base="V35_PAPER_PROB"', d.V35.PAPER_TEXT_PROB != null ? d.V35.PAPER_TEXT_PROB : 0.1)}
        ${this.num("V1 论文·触发额外加成", 'data-base="V35_PAPER_ADD"', d.V35.PAPER_TEXT_ADD != null ? d.V35.PAPER_TEXT_ADD : 1)}
        ${this.num("V1.5 论文·语料产量倍率", 'data-base="V35_PAPER_DATA_MUL"', d.V35.PAPER_DATA_SPEED_MUL != null ? d.V35.PAPER_DATA_SPEED_MUL : 1.1, 0.01)}
      </div>`);

    /* ---- 5. 团队 · 潜力 · 扩编 ---- */
    const tb = d.TEAM_BUILD || {};
    const m5 = this.mod("👥", "团队 · 潜力 · 扩编招聘",
      "团建/奖金/培训为集体行动成本；词条升级：对应潜力属性 ≥ 下限时每 tick 按 属性÷除数 概率升一级。扩编录用后编制 +1，月薪按【工程师】页逐人配置。",
      `<div class="gcf-grid">
        ${this.num("团建成本（元）", 'data-base="TB_TEAM_COST"', tb.TEAM_COST, 10000)}
        ${this.num("奖金激励成本（元）", 'data-base="TB_BONUS_COST"', tb.BONUS_COST, 10000)}
        ${this.num("员工培训成本（元）", 'data-base="TB_TRAIN_COST"', tb.TRAIN_COST, 10000)}
        ${this.num("培训所需体力", 'data-base="TB_TRAIN_ENERGY"', tb.TRAIN_ENERGY, 5)}
        ${this.num("个人休息回复体力", 'data-base="TB_REST_ENERGY"', tb.REST_ENERGY != null ? tb.REST_ENERGY : 35, 5)}
      </div>
      <div class="gcf-subhead">扩编招聘（寻访等待周数与找到概率；面板不显示概率/薪资）</div>
      <div class="gcf-grid">
        /* [feature:hire-embodied-role] */
        ${["pretrain", "data", "post", "embodied"].map((k) => {
          const r = (d.V35.HIRE_ROLES || {})[k] || {};
          const wait = r.waitMin || [1, 3];
          const name = r.label || (k === "pretrain" ? "预训练工程师" : k === "data" ? "数据工程师" : k === "post" ? "后训练工程师" : "具身智能工程师");
        /* [/feature:hire-embodied-role] */
          return `
            <div class="gcf-field">
              <label>${name} · 岗位名</label>
              <input type="text" data-hire="${k}" data-key="label" value="${r.label || ""}">
            </div>
            <div class="gcf-field">
              <label>${name} · 寻访等待（周，下限）</label>
              <input type="number" data-hire="${k}" data-key="wait0" value="${wait[0]}" min="1">
            </div>
            <div class="gcf-field">
              <label>${name} · 寻访等待（周，上限）</label>
              <input type="number" data-hire="${k}" data-key="wait1" value="${wait[1]}" min="1">
            </div>
            <div class="gcf-field gcf-pct">
              <label>${name} · 找到概率 <b>${Math.round((r.findProb != null ? r.findProb : 0.8) * 100)}%</b></label>
              <input type="number" step="any" value="${Math.round((r.findProb != null ? r.findProb : 0.8) * 100)}" data-hire="${k}" data-key="prob">
            </div>`;
        }).join("")}
      </div>`);

    /* ---- 4.5 招聘 · 天赋档 · 共享池与反抽卡（2026-09-12 用户拍板改版） ----
       旧版配的是「每个等级的抽中概率 × 稀有度权重」，与池子分布无关；
       新版：招聘 = 从本阶段圈定的池子里随机捞人，**概率就是池子自身的分布**，
       阶段只做两件事 —— 限最高等级（下限恒 Lv1）+ 给各等级一份额外权重。 */
    const lvRange = d.HIRE_LV_RANGE_BY_VER || {};
    const tierT = d.TIER_THRESHOLDS || [60, 70, 80, 90];
    const tcap = d.TALENT_LV_CAP || {};
    /* 档位名从配置 TIER_COLORS 取（唯一真源，改名字只改一处；名字短一点，面板上要拼 "-lvN"） */
    const TC = d.TIER_COLORS || {};
    const tname = (k, fb) => ((TC[k] && TC[k].name) || fb);
    const TIER_KEYS = [["gray", tname("gray", "一般")], ["blue", tname("blue", "良好")],
      ["pink", tname("pink", "优秀")], ["orange", tname("orange", "天才")], ["rainbow", tname("rainbow", "大牛")]];
    const m5b = this.mod("🎯", "招聘 · 天赋档 · 共享池与反抽卡",
      "招聘 = 从本阶段圈定的池子里随机捞人：概率由**池子自身的分布**决定（哪个等级人多就更容易出），" +
      "阶段只负责①限制能捞到的最高等级（下限恒为 Lv1）②给各等级一份额外权重。" +
      "候选人 2 周内不录用就会走人，并在冷却期内不再出现 —— 防止重复刷新抽卡。",
      `<div class="gcf-grid">
        ${this.num("发布需求费用（元/次）", 'data-rc="cost"', d.RECRUIT_COST != null ? d.RECRUIT_COST : 30000, 10000)}
        ${this.num("候选人有效期（周）", 'data-rc="ttl"', d.CANDIDATE_TTL_WEEKS != null ? d.CANDIDATE_TTL_WEEKS : 2)}
        ${this.num("过期后冷却（周）", 'data-rc="lock"', d.CANDIDATE_LOCK_WEEKS != null ? d.CANDIDATE_LOCK_WEEKS : 8)}
      </div>
      <div class="gcf-subhead">天赋档阈值（核心天赋 ≥ 该值 → 归入该档；低于「良好」= 一般）</div>
      <div class="gcf-grid">
        ${[tname("blue", "良好"), tname("pink", "优秀"), tname("orange", "天才"), tname("rainbow", "大牛")].map((n, i) =>
          this.num(n + " 下限", `data-tt="${i}"`, tierT[i] != null ? tierT[i] : [60, 70, 80, 90][i])).join("")}
      </div>
      <div class="gcf-preview">这 4 个值就是游戏里天赋档的<b>唯一真源</b>（代码不再写死）。标识显示为「天赋档-lv等级」，例：<b>天才-lv3</b>、<b>一般-lv2</b>。</div>
      <div class="gcf-subhead">天赋档 → 词条等级天花板（把「一般最高只到 lv3」这类规则钉死）</div>
      <div class="gcf-grid">
        ${TIER_KEYS.map(([k, n]) => this.num(n + " 最高等级", `data-tlc="${k}" min="1" max="5"`, tcap[k] != null ? tcap[k] : ({ gray: 3, blue: 3, pink: 4, orange: 5, rainbow: 5 })[k], 1)).join("")}
      </div>
      <div class="gcf-preview">① 建池校验：池子里不允许出现超过该档上限的人（例：一般-lv4）；② 运行时：词条升级的硬上限 = min(本值, 各阶段词条上限)。</div>
      <div class="gcf-subhead">各阶段 · 等级上限与等级权重</div>
      <div class="gcf-preview">每行一个阶段：<b>上限</b>限制本阶段能捞到的最高词条等级（<b>下限恒为 Lv1</b>）；Lv1~Lv5 填的是<b>额外权重</b> —— 1 = 与池子里的人数成正比、0 = 该等级不出现、越大越偏向该等级。池子分布说话，权重只做偏移。</div>
      <div style="display:flex;flex-direction:column;gap:6px">
      ${VER_ORDER.map((v) => {
        const r = lvRange[v] || { max: 5, lv: [1, 1, 1, 1, 1] };
        const w5 = Array.isArray(r.lv) ? r.lv : [1, 1, 1, 1, 1];
        const mx = r.max != null ? r.max : 5;
        const cells = [];
        for (let i = 0; i < 5; i++) {
          const lv = i + 1;
          const val = (w5[i] != null ? w5[i] : 0);
          cells.push('<div class="gcf-field gcf-num-lab"><label>Lv' + lv + (lv <= mx ? ' 权重' : ' 权重·关') + '</label>'
            + '<input type="number" min="0" step="0.1" value="' + val + '" data-lvw="' + v + '" data-i="' + i + '"' + (lv > mx ? ' style="opacity:.45"' : '') + '></div>');
        }
        return '<div class="gcf-row-card" style="display:grid;grid-template-columns:56px 118px repeat(5,1fr);gap:6px;align-items:end;padding:7px 10px">'
          + '<b style="font-size:12px;color:var(--text,#e8ecf2);padding-bottom:7px">' + v + '</b>'
          + '<div class="gcf-field gcf-num-lab"><label>等级上限（≤）</label>'
          + '<input type="number" min="1" max="5" step="1" value="' + mx + '" data-lvm="' + v + '"></div>'
          + cells.join("")
          + '</div>';
      }).join("")}</div>`);


    /* ---- 5. 算力档位 ---- */
    /* ---- 6. 算力档位 ---- */
    const m6 = this.mod("🖥", "算力档位",
      "购买算力页的四档：价格 / 参数上限 / 显卡图。显卡图可点「浏览」从 resource 各目录选图。各阶段开放哪些档位在 game_cfg.js GPU_TIERS_BY_VER（V1 只开放入门档）。",
      `<div class="gcf-grid">
        ${Object.keys(d.GPU_TIERS || {}).map((k) => {
          const t = d.GPU_TIERS[k];
          return `
            ${this.num(`${t.name}（${k}）· 价格（元）`, `data-gpu="${k}" data-key="price"`, t.price, 10000)}
            ${this.num(`${t.name} · 参数上限（B）`, `data-gpu="${k}" data-key="maxParam"`, t.maxParam)}
            ${this.img(`${t.name} · 显卡图`, `data-gpu="${k}" data-key="icon"`, t.icon || "")}`;
        }).join("")}
      </div>`);

    /* ---- 6. 趣味掉落鲸bee ---- */
    if (!d.WHALEBEE) d.WHALEBEE = JSON.parse(JSON.stringify(window.GameDefaults.base.WHALEBEE));
    const bee = d.WHALEBEE;
    const m65 = this.mod("🐝", "趣味掉落 · 鲸bee（金币）",
      "办公室内每隔随机时间从上方缓缓掉落一只鲸bee：点击即得随机经费（入账 + 音效），不点则从底部消失。立绘为占位图，点「浏览」可换成任意图片。",
      `<div class="gcf-grid">
        <div class="gcf-field">
          <label>开关</label>
          <select data-bee="enabled">
            <option value="1"${bee.ENABLED !== false ? " selected" : ""}>开启</option>
            <option value="0"${bee.ENABLED === false ? " selected" : ""}>关闭</option>
          </select>
        </div>
        ${this.num("掉落间隔下限（秒）", 'data-bee="INTERVAL_MIN"', bee.INTERVAL_MIN, 5)}
        ${this.num("掉落间隔上限（秒）", 'data-bee="INTERVAL_MAX"', bee.INTERVAL_MAX, 5)}
        ${this.num("掉落时长（毫秒，越大约缓）", 'data-bee="FALL_MS"', bee.FALL_MS, 500)}
        ${this.num("点击奖励下限（元）", 'data-bee="REWARD_MIN"', bee.REWARD_MIN, 5000)}
        ${this.num("点击奖励上限（元）", 'data-bee="REWARD_MAX"', bee.REWARD_MAX, 5000)}
        ${this.num("显示尺寸（px）", 'data-bee="SIZE"', bee.SIZE, 4)}
        ${this.img("鲸bee 立绘（占位图）", 'data-bee="IMG"', bee.IMG || "")}
      </div>`);

    /* ---- 7. 训练时间轴动画：已随旧 UI 退役（2026-09-05 用户要求从编辑器删除），不再提供配置卡片 ---- */

    /* ---- 8. 小游戏 ---- */
    const mg = d.MINIGAMES;
    /* 2026-09-11（用户问「SFT 巡检为什么在事件分页看不见、在哪配？」）：
       它**不是事件** —— 是办公室周常小游戏，由下面的「触发条件」在指定阶段/第 N 周结算时弹出。
       以前只暴露了轮数与奖励，触发条件藏在配置里没人找得到；现在一并铺出来。
       题库（SFT_DATA / RM_SETS）在【测试界面】页维护。 */
    const trg = mg.TRIGGER || {};
    const T0 = (k) => trg[k] || {};
    const m8 = this.mod("🎮", "小游戏（SFT 数据质检 / RM 偏好排序）",
      "办公室周常小游戏（<b>不是事件</b>，所以在【事件】页里找不到）：轮数 = 每局题数；答对给对应能力加成；全对再给 CLEAR_BONUS。"
      + "「触发条件」= 到哪个阶段、第几周结算时弹出（还需对应岗位已到岗）。题库在【测试界面】页。",
      `<div class="gcf-grid">
        ${this.num("SFT 轮数", 'data-mg="SFT" data-key="rounds"', mg.SFT.ROUNDS)}
        ${this.num("SFT 答对·文字加成", 'data-mg="SFT" data-key="hit"', mg.SFT.HIT.text)}
        ${this.num("RM 轮数", 'data-mg="RM" data-key="rounds"', mg.RM.ROUNDS)}
        ${this.num("RM 答对·安全加成", 'data-mg="RM" data-key="hit"', mg.RM.HIT.safety)}
      </div>
      <div class="gcf-subhead" style="margin-top:10px">分阶段奖励系数（实际奖励 = 上面基础加成 × 本阶段系数，越往后越多）</div>
      <div class="gcf-grid">
        ${(Object.keys(mg.VER_MUL || {})).map((v) =>
          this.num(v + " 奖励系数", 'data-mgmul="' + v + '"', (mg.VER_MUL || {})[v], 0.1)).join("")}
      </div>
      <div class="gcf-subhead" style="margin-top:10px">触发条件（阶段 / 第几周 / 需到岗岗位）</div>
      <div class="gcf-grid">
        <div class="gcf-field"><label>SFT 触发阶段</label><input data-mgtrig="SFT" data-key="ver" value="${T0("SFT").ver || ""}"></div>
        ${this.num("SFT 触发·第几周", 'data-mgtrig="SFT" data-key="week"', T0("SFT").week)}
        <div class="gcf-field"><label>SFT 需到岗岗位</label><input data-mgtrig="SFT" data-key="needRole" value="${T0("SFT").needRole || ""}"></div>
        <div class="gcf-field"><label>RM 触发阶段</label><input data-mgtrig="RM" data-key="ver" value="${T0("RM").ver || ""}"></div>
        ${this.num("RM 触发·第几周", 'data-mgtrig="RM" data-key="week"', T0("RM").week)}
        <div class="gcf-field"><label>RM 需到岗岗位</label><input data-mgtrig="RM" data-key="needRole" value="${T0("RM").needRole || ""}"></div>
      </div>
      <div class="gcf-subhead" style="margin-top:14px">题库（SFT 数据质检 / RM 偏好排序）—— 以前只能改代码，现在这里能编</div>
      <p class="gcf-tip">SFT：每题选出「哪个回答值得进数据集」；RM：把几个回答按好 → 差排序（rank 决定名次）。
        改完点右上角「保存全部」落盘，游戏刷新后生效。</p>
      <div class="dim" style="font-size:12px;margin-bottom:6px">
        当前 SFT ${(d.SFT_DATA || []).length} 题 · RM ${(d.RM_SETS || []).length} 组
      </div>
      ${this.bankRows("SFT_DATA")}
      <button class="dg-btn dg-btn-sm" data-bank-add="SFT_DATA" type="button" style="margin-top:4px">＋ 新增 SFT 题目</button>
      <div style="height:12px"></div>
      ${this.bankRows("RM_SETS")}
      <button class="dg-btn dg-btn-sm" data-bank-add="RM_SETS" type="button" style="margin-top:4px">＋ 新增 RM 组</button>`);

    /* ---- 8. 吃瓜新闻页 ---- */
    if (!d.NEWS_PAGE) d.NEWS_PAGE = JSON.parse(JSON.stringify(window.GameDefaults.base.NEWS_PAGE || {}));
    const np = d.NEWS_PAGE;
    const m9 = this.mod("📰", "吃瓜新闻页",
      "随机新闻平均每 N 分钟进一条（剧情节点新闻不受此限，到点必进）；热榜内转发/评论/点赞数据与排序每 X 秒浮动一次；信息流超过上限时最老的先出。",
      `<div class="gcf-grid">
        ${this.num("新新闻间隔（分钟/条）", 'data-np="NEW_EVERY_MIN"', np.NEW_EVERY_MIN != null ? np.NEW_EVERY_MIN : 3, 0.5)}
        ${this.num("热榜数据浮动刷新（秒）", 'data-np="HOT_REFRESH_S"', Math.round((np.HOT_REFRESH_MS || 60000) / 1000), 10)}
        ${this.num("信息流上限（条）", 'data-np="FEED_MAX"', np.FEED_MAX || 60, 5)}
      </div>`);

    /* ---- 10.5 架构 · 每架构最大可选参数（2026-09-09 用户要求）---- */
    const archMaxRows = (window.GameDefaults.base.ARCHITECTURES || []).map((a) => {
      const cur = (d.ARCHITECTURES || []).find((x) => x.id === a.id);
      const mv = (cur && cur.maxParam != null) ? cur.maxParam : a.maxParam;
      return `<div class="gcf-field gcf-num-lab"><label>${a.name}（${a.id}）· 最大可选参数</label>
        <input type="number" min="0" step="7" value="${mv != null ? mv : ""}" data-archmax="${a.id}"></div>`;
    }).join("");
    const m10b = this.mod("🧩", "架构 · 最大可选参数",
      "每个架构能选的最大目标参数（B）。填 0 / 留空 = 不限制（只受算力档位上限）。对应立项面板「模型参数」里该项架构的可选项。",
      `<div class="gcf-grid">${archMaxRows}</div>`);

    /* ---- 10.6 架构 · 解锁方式与自家报告（2026-09-13 用户要求）----
       自研路线 = 现实中由我们自己提出并发布的报告（DeepSeek-V2 / V3.2 / V4）
       → 不要求玩家研读别人的论文，改由「团队提案事件」批准后直接解锁。
       外部论文 = 保持旧流程（研读 ARCHITECTURES[*].unlockPaper 才解锁）。 */
    const escAttr = (x) => String(x == null ? "" : x)
      .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    /* 钥匙论文显示成「no + 标题」——论文引用已 ID 化（doc/32），只给数字玩家认不出是哪篇 */
    const _archPool = (((d.PAPER || {}).POOL) || ((window.GameDefaults.base.PAPER || {}).POOL) || []);
    const paperLabel = (no) => {
      if (no == null) return "";
      const p = _archPool.find((x) => x.no === no);
      return no + (p ? " " + p.title : "");
    };
    const archUnlockRows = (window.GameDefaults.base.ARCHITECTURES || []).map((a) => {
      const cur = (d.ARCHITECTURES || []).find((x) => x.id === a.id) || {};
      const curBy = cur.unlockBy || a.unlockBy || "paper";
      const rep = cur.selfReport || a.selfReport || "";
      const meta = cur.selfReportMeta || a.selfReportMeta || "";
      const sel = `<select data-archby="${a.id}" style="flex:0 0 auto;">
          <option value="paper"${curBy === "paper" ? " selected" : ""}>外部论文（研读解锁）</option>
          <option value="approval"${curBy === "approval" ? " selected" : ""}>自研路线（提案批准解锁）</option>
          <option value="embodied"${curBy === "embodied" ? " selected" : ""}>具身时代（专属剧情 / 提案）</option>
        </select>`;
      return `<div class="gcf-field" style="grid-column:1/-1">
        <label>${a.name}（${a.id}）· 解锁方式（「自研路线」忽略钥匙论文，走团队提案）</label>
        <div class="gcf-inline" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          ${sel}
          <select data-archpaper="${a.id}" style="flex:0 1 320px;" title="研读这篇论文才解锁本架构（引用数字 no，doc/32）">
            ${["<option value=''>（不挂钥匙论文）</option>"].concat(
              _archPool.map((pp) => "<option value='" + pp.no + "'" + (cur.unlockPaper === pp.no ? " selected" : "") + ">" +
                pp.no + " " + escAttr((pp.title || "").slice(0, 40)) + "</option>")).join("")}
          </select>
          <input class="gcf-title" style="flex:1 1 330px;min-width:220px;" value="${escAttr(rep)}"
                 placeholder="自家报告标题（自研路线用，如 DeepSeek-V4: …）" data-archrep="${a.id}">
          <input class="gcf-title" style="flex:0 1 210px;" value="${escAttr(meta)}"
                 placeholder="报告说明（如 我们自己的技术报告 · 2026.04）" data-archmeta="${a.id}">
        </div>
      </div>`;
    }).join("");
    const m10c = this.mod("🔓", "架构 · 解锁方式与自家报告",
      "「自研路线」= 现实中由我们自己提出并发布的报告（DeepSeek-V2 / V3.2 / V4）→ 不要求玩家研读别人的论文，改由「团队提案」事件批准后直接解锁；"
      + "「外部论文」= 保持旧流程（研读该项架构的钥匙论文才解锁）。自家报告名会显示在架构卡片的说明里。"
      + "提案事件本身在【事件】页编辑（id 形如 V35_PROP_MLA / V35_PROP_DSA / V35_PROP_CSA）。",
      `<div class="gcf-grid">${archUnlockRows}</div>`);

    $("#gamecfg-base").innerHTML = [m1, m2, m3, m4, m5, m5b, m6, m65, m8, m9, m10b, m10c].join("");
    /* 结算演出 / 答题题库 / 阶段任务 → 【演出】页；词条数值 → 【词条】页 */
    this._renderedShow = false;
    this._renderedTrait = false;
  },

  /* 【演出】页：三幕结算演出 + 评审答题动画与题库 + 阶段任务目标 */
  renderShow() {
    const d = this.data;
    this.ensure(d);
    const VER_ORDER = d.VER_ORDER || window.GameDefaults.base.VER_ORDER || [];
    /* ---- 10. 结算演出（三幕：柱状图 / 能力榜 / 奖金与词条升级，doc/16 方案 v2）---- */
    const mulFields = VER_ORDER.map((v) =>
      this.num(`${v} 增长系数`, `data-usermul="${v}"`, (d.USER_GAIN_MUL_BY_VER || {})[v] != null ? d.USER_GAIN_MUL_BY_VER[v] : "", 1)).join("");
    const boardFields = VER_ORDER.map((v) =>
      `<div class="gcf-field" style="grid-column:1/-1">
        <label>${v} 能力榜 JSON（10 行 [{name, meta, score}]；score 是**评审分**，必须降序；失焦时校验）</label>
        <textarea rows="4" data-board="${v}" style="width:100%;font-size:11px;font-family:Consolas,monospace">${JSON.stringify((d.RANK_BOARD_BY_VER || {})[v] || [])}</textarea>
      </div>`).join("");
    const m10 = this.mod("🏆", "结算演出 · 用户增长 · 能力榜",
      "三幕结算演出数据：用户增长 = 综合评分 × 增长系数（内测千人级 / 公测百万级）；能力榜分数**就是评审分**（同一把尺子，名次由结算时比分数现算，不再手写名次/榜单分）；榜单与评价池以 JSON 编辑（失焦校验，解析失败红框且不写入）。⚠️ 榜单数值由 tools/measure_review_lines.js 实测标定 —— 改了上限/周长/词条档位/论文效果后请重跑校准台。词条上限与升级规则在【词条】页。",
      `<div class="gcf-subhead">用户增长系数（usersGained = 评分 × 系数）</div>
      <div class="gcf-grid">${mulFields}</div>
      <div class="gcf-subhead">各阶段能力榜（RANK_BOARD_BY_VER · score = 评审分刻度，降序）</div>
      ${boardFields}
      <div class="gcf-subhead">用户评价文案池（USER_FEEDBACK：praise/improve 按四维，generic 兜底）</div>
      <div class="gcf-field" style="grid-column:1/-1">
        <label>评价池 JSON（失焦时校验）</label>
        <textarea rows="6" data-feedback="1" style="width:100%;font-size:11px;font-family:Consolas,monospace">${JSON.stringify(d.USER_FEEDBACK)}</textarea>
      </div>`);

    /* ---- 11. 评审演出台 · 答题动画与题库（2026-09-05）----
       演出时长四项 + 答对率曲线参数 + 题库（题目 / 正确回答 / 错误回答）全部可编辑。 */
    const es = d.EVAL_SHOW = d.EVAL_SHOW || JSON.parse(JSON.stringify(window.GameDefaults.base.EVAL_SHOW || {}));
    /* 题库矩阵（2026-09-05）：题型 × 难度，编辑器按两级下拉选取当前编辑的那一套 */
    const BANKS = ["chat", "code", "long", "stress", "safety"];
    const BANK_NAME = { chat: "对话", code: "代码", long: "长文本", stress: "压测", safety: "安全" };
    const DIFFS = ["low", "mid", "high"];
    const DIFF_NAME = { low: "低（V1·V1.5）", mid: "中（V2·V2.5）", high: "高（V3+）" };
    const ARCHS = (window.GameDefaults.base.ARCHITECTURES || []).map((a) => ({ k: a.key || a.id, n: a.name }));
    if (!d.EVAL_BANK) d.EVAL_BANK = JSON.parse(JSON.stringify(window.GameDefaults.base.EVAL_BANK || {}));
    const pk = d.EVAL_BANK_PICK = d.EVAL_BANK_PICK
      || JSON.parse(JSON.stringify(window.GameDefaults.base.EVAL_BANK_PICK || {}));
    const curBank = this._qaBank || "chat", curDiff = this._qaDiff || "low";
    d.EVAL_BANK[curBank] = d.EVAL_BANK[curBank] || { low: [], mid: [], high: [] };
    const curArr = d.EVAL_BANK[curBank][curDiff] || [];
    /* 旧存档只有扁平 EVAL_QA 时，先迁进 chat.low，避免编辑器里看起来空空如也 */
    if ((d.EVAL_QA || []).length && !curArr.length && curBank === "chat" && curDiff === "low") {
      d.EVAL_BANK.chat.low = JSON.parse(JSON.stringify(d.EVAL_QA));
    }
    const m11 = this.mod("🎬", "评审演出台 · 答题动画与题库",
      "答题演出：从题库随机抽 QA_COUNT 题，每题先思考 MS_PER_Q 毫秒，再打字机（TYPE_MS）给出回答，判定停留 JUDGE_MS 后进入下一题。"
      + "答对率 = BASE + SPAN × 达标度 ± JITTER，达标度 = 该维度当前值 ÷ 该维度达标线（最高 1.35 倍），再夹在 MIN_P ~ MAX_P 之间——"
      + "**注意：答对率只影响演出观感**，最终总评由 evaluate() 的四维加权 + 品质加成决定，与演出答对了几题无关。",
      `<div class="gcf-subhead">演出节奏（毫秒 / 题数）</div>
      <div class="gcf-grid">
        ${this.num("演出题数", 'data-es="QA_COUNT"', es.QA_COUNT != null ? es.QA_COUNT : 10, 1)}
        ${this.num("每题思考时长（ms）", 'data-es="MS_PER_Q"', es.MS_PER_Q != null ? es.MS_PER_Q : 3000, 100)}
        ${this.num("回答打字机时长（ms）", 'data-es="TYPE_MS"', es.TYPE_MS != null ? es.TYPE_MS : 400, 50)}
        ${this.num("判定停留时长（ms）", 'data-es="JUDGE_MS"', es.JUDGE_MS != null ? es.JUDGE_MS : 350, 50)}
      </div>
      <div class="gcf-subhead">答对率曲线（p = BASE + SPAN × 达标度 ± JITTER，再夹 MIN_P~MAX_P）</div>
      <div class="gcf-grid">
        ${this.pct("基础答对率 BASE", 'data-es="BASE"', es.BASE != null ? es.BASE : 0.28)}
        ${this.pct("达标加成 SPAN", 'data-es="SPAN"', es.SPAN != null ? es.SPAN : 0.55)}
        ${this.pct("随机抖动 ±JITTER", 'data-es="JITTER"', es.JITTER != null ? es.JITTER : 0.12)}
        ${this.pct("下限 MIN_P", 'data-es="MIN_P"', es.MIN_P != null ? es.MIN_P : 0.05)}
        ${this.pct("上限 MAX_P", 'data-es="MAX_P"', es.MAX_P != null ? es.MAX_P : 0.98)}
      </div>
      <div class="gcf-subhead">题库 EVAL_BANK（题型 × 难度 · dim 决定用哪项数值判答对率）</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <label style="font-weight:700">题型
          <select data-qa-sel="bank" class="gcf-inline-select">
            ${BANKS.map((b) => `<option value="${b}"${(this._qaBank || "chat") === b ? " selected" : ""}>${BANK_NAME[b] || b}</option>`).join("")}
          </select>
        </label>
        <label style="font-weight:700">难度
          <select data-qa-sel="diff" class="gcf-inline-select">
            ${DIFFS.map((x) => `<option value="${x}"${(this._qaDiff || "low") === x ? " selected" : ""}>${DIFF_NAME[x] || x}</option>`).join("")}
          </select>
        </label>
        <span class="dim" style="font-size:11px">当前这套 ${curArr.length} 条 · 演出按「架构 → 题型、阶段 → 难度」自动选取</span>
      </div>
      ${this.qaRows(d)}
      <button class="dg-btn dg-btn-sm" data-qa-add="1" type="button" style="margin-top:4px">＋ 新增题目</button>
      <div class="gcf-subhead">选题规则（架构 → 题型，阶段 → 难度）</div>
      <div class="gcf-grid">
        ${ARCHS.map((a) => `<div class="gcf-field"><label>${a.n} → 题型</label>
          <select data-pickarch="${a.k}" class="gcf-inline-select">
            ${BANKS.map((b) => `<option value="${b}"${(pk.archToBank || {})[a.k] === b ? " selected" : ""}>${BANK_NAME[b] || b}</option>`).join("")}
          </select></div>`).join("")}
        ${VER_ORDER.map((v) => `<div class="gcf-field"><label>${v} → 难度</label>
          <select data-pickdiff="${v}" class="gcf-inline-select">
            ${DIFFS.map((x) => `<option value="${x}"${(pk.difficultyByVer || {})[v] === x ? " selected" : ""}>${DIFF_NAME[x] || x}</option>`).join("")}
          </select></div>`).join("")}
      </div>
      <div class="gcf-field" style="grid-column:1/-1">
        <label>阶段覆盖 · 混合题库（archToBankByVer，JSON。值可为 字符串 / 数组(等比例) / 对象(加权)，失焦校验）</label>
        <textarea rows="4" data-pickmix="1" style="width:100%;font-size:11px;font-family:Consolas,monospace">${this.esc(JSON.stringify(pk.archToBankByVer || {}))}</textarea>
      </div>`);

    /* ---- 12. 阶段任务目标（doc/23 · 2026-09-07）----
       架构 × 参数 = 20 种搭配；达成 → 主线奖金 + 推进；暂缓 → 增量经费 + 留在本阶段重训 */
    const MI = d.MISSIONS || (window.GameDefaults.base.MISSIONS || {});
    const MIINC = MI.INC || {};
    const MI_ARCH = window.GameDefaults.base.ARCHITECTURES || [];
    const m12 = this.mod("🎯", "阶段任务目标",
      /* [feature:gameplay-guide-mission-editor-copy] */
      "每阶段一个任务目标。满足架构、参数及已配置的任务能力轴后，可按通过奖金结算并进入下一阶段；任务未达时留在本阶段重训。主评审经费只对超过本版本已结算最高分的提升发放：同分或更低为 0；有提升时按下方比例上下限与斜率，计算本阶段基础奖及本次优秀/顶尖附奖的发放比例。小模型等单列收入另算。重训保留团队和已购资源，重新立项训练，发薪倒计时继续。",
      /* [/feature:gameplay-guide-mission-editor-copy] */
      `<div class="gcf-grid">
        <div class="gcf-field"><label>启用任务目标</label>
          <select data-mission="ENABLED" class="gcf-inline-select">
            <option value="1"${MI.ENABLED !== false ? " selected" : ""}>启用</option>
            <option value="0"${MI.ENABLED === false ? " selected" : ""}>关闭</option>
          </select></div>
        <div class="gcf-field"><label>「新」的判定口径</label>
          <p class="gcf-tip">立项只看「架构 + 参数」两道（2026-09-29 起取消「组合此前没用过」）</p></div>
        ${this.num("增量经费下限（0.30 = 30%）", 'data-mission="INC_FLOOR"', MIINC.FLOOR != null ? MIINC.FLOOR : 0.3, 0.05)}
        ${this.num("增量经费上限（0.70 = 70%）", 'data-mission="INC_CEIL"', MIINC.CEIL != null ? MIINC.CEIL : 0.7, 0.05)}
        ${this.num("斜率（每多 1 个 ΔLine 加多少）", 'data-mission="INC_SLOPE"', MIINC.SLOPE != null ? MIINC.SLOPE : 0.4, 0.05)}
      </div>
      <div class="gcf-subhead">逐阶段目标（架构 / 参数留空 = 不限制）</div>
      <div class="gcf-grid">
        ${VER_ORDER.map((v) => {
          const m = (MI.BY_VER || {})[v] || {};
          return `<div class="gcf-field"><label>${v} · 目标名</label>
              <input type="text" data-mission-ver="${v}" data-mission-key="name" value="${this.esc(m.name || "")}"></div>
            <div class="gcf-field"><label>${v} · 架构</label>
              <select data-mission-ver="${v}" data-mission-key="arch" class="gcf-inline-select">
                <option value="">（不限制）</option>
                ${MI_ARCH.map((a) => `<option value="${a.id}"${m.arch === a.id ? " selected" : ""}>${a.name}</option>`).join("")}
              </select></div>
            <div class="gcf-field"><label>${v} · 参数下限（B）</label>
              <input type="number" step="7" data-mission-ver="${v}" data-mission-key="param" value="${m.param != null ? m.param : ""}"></div>
            <div class="gcf-field" style="grid-column:1/-1"><label>${v} · 目标说明</label>
              <input type="text" data-mission-ver="${v}" data-mission-key="desc" value="${this.esc(m.desc || "")}"></div>`;
        }).join("")}
      </div>`);
    /* ---- 13. 测试聊天彩蛋：V4.5 让模型做个游戏 → 返回可点开的网站链接（2026-09-10）---- */
    const TG = d.TEST_GAME = d.TEST_GAME
      || JSON.parse(JSON.stringify(window.GameDefaults.base.TEST_GAME
        || { enabled: true, ver: "V4.5", q: "帮我做个游戏", ok: "好呀！我顺手做了个网页小游戏，点开就能玩：{link}",
             bad: "咕嘎……游……游戏？Game……game……", url: "", linkText: "点击打开我做的游戏" }));
    const m13 = this.mod("🎮", "测试聊天彩蛋 · 做游戏 → 返回网站链接",
      "仅当 阶段 ≥ ver（默认 V4.5）时，测试聊天的候选问题里会追加「帮我做个游戏」选项。模型开智后，ok 里的 {link} 会被替换成一个可点击的网站链接（url），玩家点开即跳转；没开智则回咕嘎。",
      `<div class="gcf-grid">
        <div class="gcf-field"><label>启用彩蛋</label>
          <select data-tg-key="enabled" class="gcf-inline-select">
            <option value="1"${TG.enabled !== false ? " selected" : ""}>启用</option>
            <option value="0"${TG.enabled === false ? " selected" : ""}>关闭</option>
          </select></div>
        ${this.text("起始阶段（ver）", 'data-tg-key="ver"', TG.ver)}
        ${this.text("候选问题文案（q）", 'data-tg-key="q"', TG.q)}
        ${this.text("链接文字（linkText）", 'data-tg-key="linkText"', TG.linkText)}
      </div>
      <div class="gcf-field" style="grid-column:1/-1"><label>开智回答（ok，用 {link} 放链接）</label>
        <textarea rows="2" data-tg-key="ok" style="width:100%;font-size:11px;font-family:Consolas,monospace">${this.esc(TG.ok || "")}</textarea></div>
      <div class="gcf-field" style="grid-column:1/-1"><label>咕嘎回答（bad）</label>
        <textarea rows="2" data-tg-key="bad" style="width:100%;font-size:11px;font-family:Consolas,monospace">${this.esc(TG.bad || "")}</textarea></div>
      <div class="gcf-field" style="grid-column:1/-1"><label>跳转网站 URL（玩家点击打开）</label>
        <input type="text" data-tg-key="url" style="width:100%" value="${this.esc(TG.url || "")}"></div>`);
    $("#gamecfg-show-base").innerHTML = [m10, m11, m12, m13].join("");
    this._renderedShow = true;
  },

  /* 【词条】页：词条等级相关的全部数值
     数据词条→语料品质概率 / 各阶段词条上限 / 升级规则(门槛+各等级除数) / 基准薪资 / 学术加算。
     每个工程师带几条哪种词条在【工程师】页维护，此处只管「等级→数值」口径。 */
  renderTrait() {
    const d = this.data;
    this.ensure(d);
    const VER_ORDER = d.VER_ORDER || window.GameDefaults.base.VER_ORDER || [];

    /* ① 数据词条 → 语料品质概率（%普通 / %良好 / %优质；出场工程师按各自 data 词条等级取） */
    const QUAL = this.mod("🧬", "数据词条 → 语料品质概率",
      "数据工程师产出语料的品质概率，按**各自 data 词条等级**取（下标 = 等级-1）。Lv1 = 基础档；Lv5 不产普通。",
      `<div class="gcf-grid">
        ${(d.V35.QUALITY_PROB_BY_DATA_LV || [[0.5,0.4,0.1],[0.4,0.4,0.2],[0.25,0.4,0.35],[0.1,0.4,0.5],[0,0.4,0.6]]).map((row, lv) => `
          <div class="gcf-field"><label>数据词条 Lv${lv + 1} · 普通/良好/优质</label>
            <input type="text" value="${(row[0]*100)}/${Math.round(row[1]*100)}/${Math.round(row[2]*100)}" data-lvqp="${lv}"></div>
        `).join("")}
      </div>
      <div class="gcf-preview">输入格式「普通/良好/优质」百分比，例如 Lv5 填「0/40/60」。总和自动归一化。</div>`);

    /* ①.5 预训练 / 后训练 词条等级 → 单次产出区间（DOC「词条等级接入产出」）
       2026-09-10 修「编辑器里这一溜是空的」：原来用 num() 生成单个 number 输入框，
       却塞了 "1/2" 这种带斜杠的字符串——number 输入框存不下，浏览器直接清空。
       改为每个等级「下限 / 上限」两个独立 number 输入框，保存端对应改读两个字段。 */
    const tierFields = (key, row) => [1,2,3,4,5].map((lv) => {
      const r = (row[lv-1] && Array.isArray(row[lv-1])) ? row[lv-1] : [0, 0];
      const pf = key === "preptier" ? "预训练" : "后训练";
      return this.num(`${pf} 词条 Lv${lv} · 区间下限`, `data-${key}l="${lv}"`, r[0], 1)
           + this.num(`${pf} 词条 Lv${lv} · 区间上限`, `data-${key}h="${lv}"`, r[1], 1);
    }).join("");
    const PRE_TIER = this.mod("🏭", "预训练词条 → 单次产出区间",
      "预训练工程师按主词条等级决定单次产出档位（下限/上限），词条越高产出越强。默认对齐 TIER_RANGES（Lv1=1/2 … Lv5=8/12）。V1 词条上限=1，高等级只在中后期开放。突破瓶颈在此基础上再上移一档。",
      `<div class="gcf-grid">${tierFields("preptier", d.V35.PRE_TRAIT_TIERS || [[1,2],[2,3],[3,5],[5,8],[8,12]])}</div>`);
    const POST_TIER = this.mod("🔧", "后训练词条 → 单次产出区间",
      "后训练工程师按主词条等级决定单次产出档位（下限/上限）。默认对齐 TIER_RANGES。",
      `<div class="gcf-grid">${tierFields("posttier", d.V35.POST_TRAIT_TIERS || [[1,2],[2,3],[3,5],[5,8],[8,12]])}</div>`);

    /* ② 各阶段词条等级上限 */
    const stmaxFields = VER_ORDER.map((v) =>
      this.num(`${v} 词条上限`, `data-stmax="${v}"`, (d.STAGE_TRAIT_MAX || {})[v] != null ? d.STAGE_TRAIT_MAX[v] : "", 1)).join("");
    const UP_MAX = this.mod("🔝", "各阶段词条等级上限",
      "控制各阶段工程师词条最高允许等级（工程/预训练/后训练/数据等都受此约束）。词条本体上限 5。",
      `<div class="gcf-grid">${stmaxFields}</div>`);

    /* ③ 词条升级规则：门槛 + 各词条依据属性 / 各等级除数 */
    const UP_RULE = this.mod("📈", "词条升级规则",
      "潜力属性达到门槛后，训练中词条有概率升级。每词条独立：依据属性（多选，都达标取平均）+ 各等级独立除数，概率 = 该均值 ÷ 除数。",
      `<div class="gcf-grid">
        ${this.num("升级门槛（所选属性均 ≥）", 'data-traitmin="1"', (d.TRAIT_UPGRADE || {}).MIN_STAT != null ? d.TRAIT_UPGRADE.MIN_STAT : 70, 5)}
      </div>
      ${this.traitUpgradeRows(d)}`);

    /* ④ 词条基准薪资（等级 → 月薪，doc/22 §2.4） */
    const baseSal = (d.TRAIT_BASE_SALARY || {});
    const SAL = this.mod("", "词条基准薪资（等级 → 月薪）",
      "晋升薪资基数 = 词条等级的基准月薪；实际月薪再按核心天赋微调。与【工程师】页建议薪资同口径。",
      `<div class="gcf-grid">
        ${[1,2,3,4,5].map((lv) => this.num(`Lv${lv} 基准月薪（元）`, `data-traitbase="${lv}"`, baseSal[lv] != null ? baseSal[lv] : "", 10000)).join("")}
      </div>`);

    /* ⑤ 学术词条加算值（等级 → 其它词条升级概率 + 值） */
    const ab = (d.TRAIT_UPGRADE || {}).ACADEMIC_BOOST || [0.02, 0.05, 0.08, 0.12, 0.15];
    const ACAD = this.mod("🎓", "学术词条 · 加算升级概率",
      "学术为辅助词条，自身不升级；按学术等级给同一位工程师的**其它词条**升级概率加算（索引 = 学术等级-1）。",
      `<div class="gcf-grid">
        ${[1,2,3,4,5].map((lv) => this.num(`学术 Lv${lv} · 加算概率(%)`, `data-acboost="${lv}"`, Math.round((ab[lv-1] != null ? ab[lv-1] : 0) * 1000) / 10, 1)).join("")}
      </div>`);

    $("#gamecfg-trait-base").innerHTML = [QUAL, PRE_TIER, POST_TIER, UP_MAX, UP_RULE, SAL, ACAD].join("");
    this._renderedTrait = true;
  },

  /* 词条升级规则编辑（2026-09-05）：
     每个词条一行 —— 依据属性（多选，要求全部达到门槛、分子取平均值）+ 各等级除数 + 概率预览。
     预览的三个探值 50 / 70 / 90 直接按 `数值 ÷ 除数` 算，与游戏内 traitUpgradeProb 同口径。 */
  traitStatKeys(type) { return type === "embodied" ? ["code","algo","engineering"] : ["code","algo","text"]; },
  traitUpgradeRows(d) {
    const defU = window.GameDefaults.base.TRAIT_UPGRADE || {};
    const U = d.TRAIT_UPGRADE = d.TRAIT_UPGRADE || JSON.parse(JSON.stringify(defU));
    U.traits = U.traits || {};
    for (const key of Object.keys(defU.traits || {})) if (!U.traits[key]) U.traits[key] = JSON.parse(JSON.stringify(defU.traits[key]));
    /* 2026-09-05：自动修剪已下线的词条类型（defaults 里没有的键一律删掉）。
       场景：编辑器页面开着时配置文件被更新（如学术下线），页面内存还是旧数据，
       一点保存就把旧词条写回去——修剪后即使旧内存保存也是干净的。 */
    for (const k of Object.keys(U.traits)) {
      if (!(k in defU.traits)) { delete U.traits[k]; }
    }
    /* 2026-09-05：词条列表直接从配置 keys 取——配置里删掉某个词条（如已下线的学术），这里自动少一行 */
    const types = Object.keys(U.traits);
    const TN = { pretrain: "预训练", post: "后训练", academic: "学术", engineer: "工程", data: "数据", embodied:"具身智能" };
    const SN = { code: "代码", algo: "算法", text: "文字", engineering:"工程" };
    const min = U.MIN_STAT != null && Number.isFinite(+U.MIN_STAT) ? +U.MIN_STAT : 70;
    const pct = (v, div) => v < min ? "0%（未达门槛）" : (Math.round(v / div * 1000) / 10) + "%";
    const NSEG = 4;                                   // 四段：Lv1→2 / 2→3 / 3→4 / 4→5
    return types.map((t) => {
      const r = U.traits[t] = U.traits[t] || { stats: ["algo"], div: [900, 1200, 1500, 1800] };
      if (!Array.isArray(r.stats)) r.stats = [r.stats];
      const STATS = this.traitStatKeys(t);
      r.stats = [...new Set(r.stats.map(k=>t==="embodied"&&k==="text"?"engineering":k).filter(k=>STATS.includes(k)))];
      if (!r.stats.length) r.stats = ((defU.traits[t] || {}).stats || ["algo"]).filter(k=>STATS.includes(k));
      if (!Array.isArray(r.div) || !r.div.length) r.div = [900, 1200, 1500, 1800];
      const boxes = STATS.map((k) => `<label class="gcf-check">
        <input type="checkbox" data-traitstat="${t}" data-stat="${k}"${r.stats.indexOf(k) >= 0 ? " checked" : ""}> ${SN[k]}</label>`).join("");
      const divs = Array.from({ length: NSEG }, (_, i) => `<label class="gcf-num-lab">Lv${i + 1}→${i + 2}
        <input type="number" min="1" step="50" data-traitdiv="${t}" data-i="${i}" value="${r.div[i] != null ? r.div[i] : 900}"></label>`).join("");
      const prev = [50, 70, 90].map((v) => `<span><b>${v}</b> → `
        + Array.from({ length: NSEG }, (_, i) => pct(v, r.div[i] != null ? r.div[i] : 900)).join(" / ") + "</span>").join("");
      return `<div class="gcf-row-card" data-traitcard="${t}">
        <div class="rc-head">
          <span class="rc-title">${TN[t] || t}</span>
          <span class="rc-note">依据属性（多选 → 全部达标，取平均值）</span>
        </div>
        <div class="rc-line">${boxes}</div>
        <div class="rc-line">${divs}</div>
        <div class="gcf-preview"><span>概率预览（属性 → Lv1→2 / Lv2→3 / Lv3→4 / Lv4→5）：</span>${prev}</div>
      </div>`;
    }).join("");
  },

  /* 题库行：一题一卡（维度下拉 + 题目 + 正确回答 + 错误回答 + 删除）。
     编辑的是当前「题型 + 难度」选中的那一套（EVAL_BANK[bank][diff]）。
     值一律转义后放进 value，避免回答里的引号/尖括号截断 HTML。 */
  qaRows(d) {
    const bank = this._qaBank || "chat";
    const diff = this._qaDiff || "low";
    d.EVAL_BANK = d.EVAL_BANK || {};
    d.EVAL_BANK[bank] = d.EVAL_BANK[bank] || { low: [], mid: [], high: [] };
    d.EVAL_BANK[bank][diff] = d.EVAL_BANK[bank][diff] || [];
    const arr = d.EVAL_BANK[bank][diff];
    const DIM = { code: "代码", text: "文字", safety: "安全", stability: "稳定" };
    return arr.map((it, i) => `
      <div class="gcf-row-card qa-card">
        <div class="rc-head">
          <span class="rc-title">第 ${i + 1} 题</span>
          <select data-qa="${i}" data-field="dim">
            ${Object.keys(DIM).map((k) => `<option value="${k}"${it.dim === k ? " selected" : ""}>${DIM[k]}</option>`).join("")}
          </select>
          <button class="dg-btn dg-btn-sm" data-qa-del="${i}" type="button">删除</button>
        </div>
        <div class="rc-line"><input data-qa="${i}" data-field="q" value="${this.esc(it.q || "")}" placeholder="题目"></div>
        <div class="rc-line"><textarea data-qa="${i}" data-field="good" rows="4" placeholder="答对时打出的回答（good）">${this.esc(it.good || "")}</textarea></div>
        <div class="rc-line"><textarea data-qa="${i}" data-field="bad" rows="4" placeholder="答错时打出的回答（bad）">${this.esc(it.bad || "")}</textarea></div>
      </div>`).join("");
  },

  /* ==========================================================================
     SFT / RM 题库编辑（2026-09-11 新增）
     --------------------------------------------------------------------------
     为什么要它：用户问「SFT 巡检为什么在事件分页看不见、在哪里配置？」——
     轮数/奖励/触发条件都在【玩法配置】的「小游戏」模块里，但**题库一直没有界面**
     （SFT_DATA / RM_SETS 只能手改 game_cfg.js）。
     做法与上面的 EVAL_BANK 题库**同款**（`.gcf-row-card.qa-card` 卡片 + 增删 + 写回），
     所以长相/交互和评测题库一致，不用学第二套。
        SFT_DATA = [{ q, good:{t,why}, bads:[{t,why}] }]   选"哪个回答值得进数据集"
        RM_SETS  = [{ q, items:[{t,why,rank}] }]           把回答按好→差排序
     ========================================================================== */
  bankRows(key) {
    const arr = (this.data || {})[key] || [];
    const E = (s) => this.esc(s);
    if (!arr.length) return `<div class="dim" style="font-size:12px">（空 —— 点下面的「＋ 新增」开始）</div>`;
    const delBtn = (i) => `<button class="dg-btn dg-btn-sm" data-bank-del="${key}:${i}" type="button">删除</button>`;
    if (key === "SFT_DATA") {
      return arr.map((it, i) => {
        const bads = (it.bads || []).map((b, bi) => `
          <div class="rc-line bank-bad">
            <span class="bank-lb">坏 ${bi + 1}</span>
            <textarea data-bank="SFT_DATA" data-i="${i}" data-b="${bi}" data-field="t" rows="2" placeholder="坏答案（不该进数据集的那种）">${E(b.t)}</textarea>
            <textarea data-bank="SFT_DATA" data-i="${i}" data-b="${bi}" data-field="why" rows="2" placeholder="为什么不该进（模型学了这个会怎样）">${E(b.why)}</textarea>
            <button class="dg-btn dg-btn-sm" data-bank-delbad="SFT_DATA:${i}:${bi}" type="button">删</button>
          </div>`).join("");
        return `
        <div class="gcf-row-card qa-card">
          <div class="rc-head">
            <span class="rc-title">SFT 第 ${i + 1} 题</span>
            ${delBtn(i)}
          </div>
          <div class="rc-line"><textarea data-bank="SFT_DATA" data-i="${i}" data-field="q" rows="2" placeholder="题干（例：用户问：什么是机器学习？哪个回答值得进 SFT 数据集？）">${E(it.q)}</textarea></div>
          <div class="rc-line"><textarea data-bank="SFT_DATA" data-i="${i}" data-field="good.t" rows="3" placeholder="好答案（值得进数据集的那个）">${E((it.good || {}).t)}</textarea></div>
          <div class="rc-line"><textarea data-bank="SFT_DATA" data-i="${i}" data-field="good.why" rows="2" placeholder="为什么好（好在哪里）">${E((it.good || {}).why)}</textarea></div>
          ${bads}
          <button class="dg-btn dg-btn-sm" data-bank-addbad="SFT_DATA:${i}" type="button">＋ 加一个坏答案</button>
        </div>`;
      }).join("");
    }
    return arr.map((it, i) => {
      const items = (it.items || []).map((x, bi) => `
        <div class="rc-line bank-bad">
          <span class="bank-lb">第 ${x.rank != null ? x.rank : "?"} 名</span>
          <textarea data-bank="RM_SETS" data-i="${i}" data-b="${bi}" data-field="t" rows="2" placeholder="回答内容">${E(x.t)}</textarea>
          <textarea data-bank="RM_SETS" data-i="${i}" data-b="${bi}" data-field="why" rows="2" placeholder="为什么排这个名次">${E(x.why)}</textarea>
          <input class="bank-rank" type="number" min="1" step="1" data-bank="RM_SETS" data-i="${i}" data-b="${bi}" data-field="rank" value="${x.rank != null ? x.rank : ""}" placeholder="名次">
          <button class="dg-btn dg-btn-sm" data-bank-delbad="RM_SETS:${i}:${bi}" type="button">删</button>
        </div>`).join("");
      return `
      <div class="gcf-row-card qa-card">
        <div class="rc-head">
          <span class="rc-title">RM 第 ${i + 1} 组</span>
          ${delBtn(i)}
        </div>
        <div class="rc-line"><textarea data-bank="RM_SETS" data-i="${i}" data-field="q" rows="2" placeholder="题干（例：怎样能快速学会游泳？请把 4 个回答按好 → 差排序）">${E(it.q)}</textarea></div>
        ${items}
        <button class="dg-btn dg-btn-sm" data-bank-addbad="RM_SETS:${i}" type="button">＋ 加一个回答</button>
      </div>`;
    }).join("");
  },

  /* 局部刷新「词条升级」的概率预览（不重建整页——重建会丢输入焦点、滚动跳顶，见 BUG 记录） */
  refreshTraitPreviews(d) {
    const U = d.TRAIT_UPGRADE || {};
    const min = U.MIN_STAT != null && Number.isFinite(+U.MIN_STAT) ? +U.MIN_STAT : 70;
    const pct = (v, div) => v < min ? "0%（未达门槛）" : (Math.round(v / (div || 1) * 1000) / 10) + "%";
    const root = document.getElementById("gamecfg-trait-base");
    if (!root) return;
    for (const t of Object.keys(U.traits || {})) {
      const card = root.querySelector(`[data-traitcard="${t}"]`);
      if (!card) continue;
      const pv = card.querySelector(".gcf-preview");
      if (!pv) continue;
      const r = ((U.traits || {})[t]) || {};
      const divs = (Array.isArray(r.div) && r.div.length) ? r.div : [900, 1200, 1500, 1800];
      pv.innerHTML = "<span>概率预览（属性 → Lv1→2 / Lv2→3 / Lv3→4 / Lv4→5）：</span>"
        + [50, 70, 90].map((v) => `<span><b>${v}</b> → `
          + Array.from({ length: divs.length }, (_, i) => pct(v, divs[i] != null ? divs[i] : 900)).join(" / ") + "</span>").join("");
    }
  },

  /* HTML 属性转义（题库里会出现引号、尖括号、&） */
  esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },

  /* base 区该提交的字段 = **只提交用户实际改过（touched）的键**，且只提交其中
     **≠ 当前出厂默认的子键（稀疏提交）**；等于默认的子键走点路径 resetKeys 从
     JSON 删除（回落代码默认，值不变）；表单里删掉的子键也走 resetKeys 移除。
     2026-09-05 架构修复：旧版「整份快照刨掉其他分页」会把表单从未展示的键
     （默认模板里的旧值）一并回写——代码里修好的默认值，编辑器一保存就被旧值
     覆盖（「BUG 复活」的根因）。
     2026-09-06 二次加固：整对象提交仍会把「当前默认值」成批钉进 JSON，之后
     代码再改默认就不生效（另一种形式的复活）。改为逐子键深对比，JSON 只留
     用户真实自定义值；服务端 base 分支同步改为对象递归合并 + 点路径删除。 */
  /* ==========================================================================
     能力轴页（doc/27 P5 · 2026-09-10）
     --------------------------------------------------------------------------
     与「玩法配置 / 演出 / 词条」共用这一份 this.data，走右上角「保存全部」。
     绑定方式：按**路径**写值（data-ax 数值 / data-axbool 开关 / data-axpick 勾选数组），
     不在这条 if/else 链里逐个加分支。
     ⚠️ 两处「同源」由本页**自动联动**，避免人工漏改导致回归红：
       ① AXES.DEF[*].source.archs → ARCHITECTURES[i].axes（test_dims ⑥-1 校验互推一致）
       ② REVIEW.BY_VER[*].AXIS_MIN → MISSIONS.BY_VER[*].axisMin（test_axis 校验同源）
     ========================================================================== */
  /* [feature:editor-embodied-axis-controls] */
  axisPartHTML(d) {
    const A = (d.V35 || {}).AXES || {};
    const def = A.DEF || {};
    const order = A.ORDER || [];
    const archs = d.ARCHITECTURES || [];
    const vers = d.VER_ORDER || [];
    const TM = d.TRAIT_META || window.GameDefaults.base.TRAIT_META || {};
    const tiers = d.AXIS_TRAIT_TIERS || {};
    const R = ((d.V35 || {}).REVIEW || {});
    const E = (v) => String(v == null ? "" : v);
    const num = (label, path, val, step) =>
      `<div class="gcf-field"><label>${label}</label>`
      + `<input type="number" data-ax="${path}" value="${val == null ? 0 : val}"`
      + (step != null ? ` step="${step}"` : "") + `></div>`;
    const select = (label,path,value,options) => `<div class="gcf-field"><label>${label}</label><select data-axtext="${path}">`
      + options.map(([key,name])=>`<option value="${key}"${key===value?' selected':''}>${name}</option>`).join('')+'</select></div>';
    const bool = (label, path, on) =>
      `<label class="gcf-check"><input type="checkbox" data-axbool="${path}"${on ? " checked" : ""}>${label}</label>`;
    const pick = (label, path, val, on) =>
      `<label class="ax-pick"><input type="checkbox" data-axpick="${path}" value="${val}"`
      + (on ? " checked" : "") + `>${label}</label>`;

    /* ==========================================================================
       表格原子（2026-09-19 排版重做）
       --------------------------------------------------------------------------
       问题：原来每一行塞 8~9 个「label + 输入框」的 `.gcf-field`，flex 一换行
       就把标签列丢掉 —— 第二行的输入框上顶着别的标签，根本对不上（用户：「排版特别乱」）。
       ⇒ 统一改成**表格**：标签进表头（`<th>`），值进单元格（`<td>`），列永远对齐。
         输入框依旧只带 `data-ax / data-axpick / data-axbool` 路径（事件是委托的，不受影响）。
       ========================================================================== */
    const cell = (path, val, step) =>
      `<td class="ax-c"><input type="number" data-ax="${path}" value="${val == null ? 0 : val}"`
      + (step != null ? ` step="${step}"` : "") + `></td>`;
    const tick = (path, val, on) =>
      `<td class="ax-c"><input type="checkbox" data-axpick="${path}" value="${val}"`
      + (on ? " checked" : "") + `></td>`;
    const th = (t) => `<th class="ax-h">${t}</th>`;
    const rh = (t, title) => `<th class="ax-rh" scope="row"${title ? ` title="${title}"` : ""}>${t}</th>`;
    const tbl = (body, cols) => `<div class="gcf-table-wrap"><table class="gcf-table ax-tbl">`
      + `<thead><tr>${th("")}${cols.map((c) => th(c)).join("")}</tr></thead>`
      + `<tbody>${body}</tbody></table></div>`;

    const card = (id) => {
      const de = def[id] || {};
      const src = de.source || {};
      const cr = de.corpusReq || {};
      const drv = (de.drivers || []).map((x) => x.role);
      const capB = de.capByVer || {}, passB = de.passByVer || {};
      const am = de.archMul || {};
      const P = "V35|AXES|DEF|" + id + "|";
      return `
      <div class="gcf-card ax-card">
        <div class="gcf-subhead">${E(de.icon)} ${E(de.name)} · <code>${id}</code>
          <small class="tag">${E(de.tip)}</small></div>
        <div class="gcf-grid">
          ${num("单 tick 触发概率", P + "tickProb", de.tickProb, 0.01)}
          ${num("参数门槛（B）", P + "source|paramMin", src.paramMin, 1)}
          ${num("语料品质门槛（良好+优质占比）", P + "corpusReq|good", cr.good, 0.05)}
          ${num("未达门槛时的产出系数", P + "corpusReq|missMul", cr.missMul, 0.05)}
          ${select("最低开放阶段",P+"source|minVer",src.minVer||'', [['','不限'],...vers.map(v=>[v,v])])}
          ${num("评分贡献倍率",P+"scoreMul",de.scoreMul==null?1:de.scoreMul,.05)}
          ${id==='embodiedCognition'||id==='dexterousControl'?select("具身岗位交替产出",P+"alternateIndex",de.alternateIndex==null?'':String(de.alternateIndex),[['','每 tick 均可产出'],['0','偶数 tick'],['1','奇数 tick']]):''}
        </div>
        ${tbl(`<tr>${rh("带出它的架构", "勾选 = 这个架构能长出这根轴，会同步到【架构】页的 axes")}`
          + archs.map((a) => tick(P + "source|archs", a.id, (src.archs || []).indexOf(a.id) >= 0)).join("")
          + `</tr><tr>${rh("架构倍率", "同一根轴，不同架构的产出倍率不同")}`
          + archs.map((a) => cell(P + "archMul|" + a.id, am[a.id] != null ? am[a.id] : 1, 0.05)).join("")
          + `</tr>`, archs.map((a) => E(a.name || a.id)))}
        <div class="ax-row"><span class="ax-row-label">产出岗位</span>
          ${["pretrain", "data", "post", "embodied"].map((r) => pick(E((TM[r] || {}).name || r),
            P + "drivers|role", r, drv.indexOf(r) >= 0)).join("")}
          <small class="tag">工具轴要勾两个岗位（缺一岗产能减半）</small></div>
        ${tbl(`<tr>${rh("阶段上限", "该阶段这根轴的产出上限（乘参数倍率后生效）")}`
          + vers.map((v) => cell(P + "capByVer|" + v, capB[v] != null ? capB[v] : 0, 1)).join("") + `</tr>`
          + `<tr>${rh("阶段达标线", "低于它 = 这根轴没达标（拿不到防偏科资格）")}`
          + vers.map((v) => cell(P + "passByVer|" + v, passB[v] != null ? passB[v] : 0, 1)).join("") + `</tr>`
          + `<tr>${rh("评审防偏科线", "同步到任务目标 axisMin；改这里会一并写进 MISSIONS")}`
          + vers.map((v) => {
            const cur = (((R.BY_VER || {})[v] || {}).AXIS_MIN || {})[id];
            return cell("V35|REVIEW|BY_VER|" + v + "|AXIS_MIN|" + id, cur != null ? cur : 0, 1);
          }).join("") + `</tr>`, vers)}
      </div>`;
    };

    return `
      <div class="gcf-section">
        <div class="history-head">🎯 能力轴 · 总开关</div>
        <div class="gamecfg-note dim">轴 = <b>架构天赋 × 参数规模</b>共同决定的追加能力；没满足条件的模型一根轴都没有。
          改「带出它的架构」会自动同步到【架构】页的 axes 字段；改「评审防偏科线」会同步到任务目标。</div>
        <div class="ax-row ax-row-top">
          ${bool("启用能力轴（关掉 = 回到纯四维）", "V35|AXES|ENABLED", A.ENABLED !== false)}
          ${bool("评审总分按「本模型存在的维度」归一化", "V35|AXES|NORMALIZE", A.NORMALIZE !== false)}
        </div>
      </div>
      <div class="gcf-section">
        <div class="history-head">🎯 逐轴配置</div>
        ${order.map(card).join("")}
      </div>
      <div class="gcf-section">
        <div class="history-head">🎯 逐阶段总分权重（WEIGHTS_BY_VER · 每行合计必须 = 1.00）</div>
        <div class="gamecfg-note dim">总分 = Σ(维度值 × 权重)。轴的比重逐阶段递增（15% → 36%）；
          <b>本阶段没激活的轴不该出现在这一行</b>（否则等于拿一根长不出来的轴扣分）。
          行末合计 ≠ 1.00 会标红，且 <code>test_axis</code> 的「每行合计 = 1.00」会失败。</div>
        ${(function () {
          const WB = R.WEIGHTS_BY_VER || {};
          const FD = ((d.FOCUS || {}).DIMS || []);
          const labelOf = (k) => (order.indexOf(k) >= 0
            ? ((def[k] || {}).name || k)
            : ((FD.filter((x) => x.key === k)[0] || {}).name || k));
          /* 列 = 所有阶段出现过的维度并集（顺序：四维在前、轴在后）—— 这样每行都对得上列 */
          const dims = [];
          vers.forEach((v) => Object.keys(WB[v] || {}).forEach((k) => { if (dims.indexOf(k) < 0) dims.push(k); }));
          const body = vers.map((v) => {
            const row = WB[v] || {};
            const sum = dims.reduce((a, k) => a + (Number(row[k]) || 0), 0);
            const okSum = Math.abs(sum - 1) < 1e-6;
            return `<tr>${rh(v)}`
              + dims.map((k) => (row[k] == null
                ? `<td class="ax-c ax-off">—</td>`
                : cell("V35|REVIEW|WEIGHTS_BY_VER|" + v + "|" + k, row[k], 0.01))).join("")
              + `<td class="ax-c"><b class="ax-sum${okSum ? " ok" : " bad"}" data-sumfor="${v}">`
              + `${sum.toFixed(2)}${okSum ? " ✓" : " ✗"}</b></td></tr>`;
          }).join("");
          return tbl(body, dims.map(labelOf).concat("合计"));
        })()}
      </div>
      <div class="gcf-section">
        <div class="history-head">🎯 词条等级 → 轴产出档位（AXIS_TRAIT_TIERS）</div>
        <div class="gamecfg-note dim">5 行 = 词条 Lv1~5，每行 [下限, 上限]（单次产出的整数区间）。</div>
        ${(function () {
          const lvs = [1, 2, 3, 4, 5];
          const head = `<thead><tr>${th("")}${lvs.map((l) => `<th class="ax-h" colspan="2">Lv${l}</th>`).join("")}</tr>`
            + `<tr>${th("")}${lvs.map(() => th("下限") + th("上限")).join("")}</tr></thead>`;
          const body = order.map((id) => {
            const arr = Array.isArray(tiers[id]) ? tiers[id] : [];
            return `<tr>${rh(E((def[id] || {}).name || id))}`
              + lvs.map((_, i) => {
                const r = arr[i] || [0, 0];
                return cell("AXIS_TRAIT_TIERS|" + id + "|" + i + "|0", r[0], 1)
                  + cell("AXIS_TRAIT_TIERS|" + id + "|" + i + "|1", r[1], 1);
              }).join("") + `</tr>`;
          }).join("");
          return `<div class="gcf-table-wrap"><table class="gcf-table ax-tbl">${head}<tbody>${body}</tbody></table></div>`;
        })()}
      </div>
      <div class="gcf-section">
        <div class="history-head">🎯 词条能驱动哪些轴（TRAIT_META.axes）</div>
        <div class="gamecfg-note dim">决定「该招什么人」；实际是否产出还要看本阶段架构有没有带出这根轴。</div>
        ${tbl(Object.keys(TM).map((t) => `<tr>${rh(E((TM[t] || {}).name || t))}`
          + order.map((id) => tick("TRAIT_META|" + t + "|axes", id,
            (((TM[t] || {}).axes) || []).indexOf(id) >= 0)).join("") + `</tr>`).join(""),
          order.map((id) => E((def[id] || {}).name || id)))}
      </div>`;
  },
  /* [/feature:editor-embodied-axis-controls] */

  /* 把 AXES.DEF[*].source.archs 反推回 ARCHITECTURES[i].axes（两处必须一致，test_dims ⑥-1 守） */
  syncArchAxes(d) {
    const A = ((d.V35 || {}).AXES) || {};
    const def = A.DEF || {};
    for (const a of (d.ARCHITECTURES || [])) {
      a.axes = (A.ORDER || []).filter((id) => (((def[id] || {}).source || {}).archs || []).indexOf(a.id) >= 0);
    }
  },
  /* 把 REVIEW.BY_VER[*].AXIS_MIN 同步到 MISSIONS.BY_VER[*].axisMin（test_axis 守两处同源） */
  syncMissionAxisMin(d) {
    const R = ((d.V35 || {}).REVIEW) || {};
    const M = d.MISSIONS || {};
    for (const v of Object.keys(R.BY_VER || {})) {
      if (!M.BY_VER || !M.BY_VER[v]) continue;
      const src = (R.BY_VER[v] || {}).AXIS_MIN || {};
      const out = {};
      for (const k of Object.keys(src)) if (src[k] > 0) out[k] = src[k];
      M.BY_VER[v].axisMin = out;
    }
  },

  basePayload() {
    const OTHER = ["UI_PORTS", "TRAIN_PORTS", "EVENTS", "ENGINEERS", "BUBBLES", "SCENES", "UI_CFG",
      /* 2026-09-03：新闻时间线/节点提示/气泡池/账号与品质配比由独立分页或文本页维护 */
      "NEWS_TIMELINE", "OFFICE_HINTS",
      "WORK_BUBBLES", "WORK_BUBBLES_TIRED", "WORK_BUBBLES_OFFWORK", "WORK_BUBBLES_FOCUS", "OFFICE_BUBBLE",
      "NEWS_ACCOUNT", "NEWS_PAGE", "CORPUS_QUALITY", "ARCH_QUALITY_REQ",
      /* 2026-09-13：随机氛围池 NEWS 与「自家模型上线」新闻 NEWS_SELF_RELEASE
         也归【新闻与提示】页整区维护（那条页要配新闻配图） */
      "NEWS", "NEWS_SELF_RELEASE",
      /* 2026-09-13：论文池 PAPER 由【论文】页整区维护（section="PAPER"） */
      "PAPER",
      /* 2026-09-16：成就表 ACHIEVEMENTS 由【成就】页整区维护（doc/35 §4.5 方案甲 · 新 tab）。
         ⚠️ 漏登记这一处 ⇒ 在别的页保存一次就把成就整区**静默抹掉**（同步桥「只补不改」救不回来，
            因为真源里那份是编辑器写的）。同名单还要在 `editor/server.py` 的 `reserved` 里再登一次。 */
      "ACHIEVEMENTS", "LIFE_STORY", "FACTORY", "CITY_JOURNEY"];
    const def = (window.GameDefaults && window.GameDefaults.base) || {};
    const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const out = {}, resets = [];
    /* resetKeys 用「段数组」（如 ["V35","STAGES","V1.5","GATE"]）而不是点路径字符串——
       阶段键名本身带点（"V1.5"/"V2.5"/"V3.5"），split(".") 会把键名拆坏。 */
    const setIn = (segs, val) => {
      let n = out;
      for (let i = 0; i < segs.length - 1; i++) {
        if (!isObj(n[segs[i]])) n[segs[i]] = {};
        n = n[segs[i]];
      }
      n[segs[segs.length - 1]] = val;
    };
    const walk = (segs, cur, dv) => {
      if (isObj(cur) && isObj(dv)) {
        for (const k of Object.keys(cur)) walk(segs.concat(k), cur[k], dv[k]);
        for (const k of Object.keys(dv)) if (!(k in cur)) resets.push(segs.concat(k));
      } else if (dv === undefined) {
        setIn(segs, cur);                // 配置独有（代码默认没有）→ 原样保留
      } else if (eq(cur, dv)) {
        resets.push(segs);               // 等于当前默认 → 移除 JSON 钉值（值不变）
      } else {
        setIn(segs, cur);                // 用户自定义 → 覆盖
      }
    };
    (this.touched || new Set()).forEach((k) => {
      if (OTHER.indexOf(k) >= 0) return;
      if (!(k in (this.data || {}))) return;
      walk([k], this.data[k], def[k]);
    });
    out.__resetKeys = resets;   // save() 里拆出，单独传给服务端（段数组）
    return out;
  },

  /* 保存（silent=由右上角「保存全部」统一调用：不弹 toast，失败抛错由 App 汇总） */
  async save({ silent = false } = {}) {
    try {
      const payload = this.basePayload();
      const resetKeys = payload.__resetKeys || [];
      delete payload.__resetKeys;
      const r = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "base", config: payload, resetKeys,
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      if (window.CfgSync) CfgSync.update(d.mtime);
      if (!silent) UI.toast(d.merged
        ? "已保存（检测到外部改动，已把你的修改自动合并进去）"
        : "玩法配置已保存并同步到游戏");
    } catch (e) {
      if (silent) throw e;
      UI.toast("保存失败：" + e.message, "err");
    }
  },
};

/* 事件委托：基础数值输入（渲染后动态元素） */
window.addEventListener("DOMContentLoaded", () => {
  const root = document;
  /* 2026-09-09 拆页：玩法配置 / 演出 / 词条 三个 tab 共用一份数据，
     事件在 document 上委托，仅在命中三个容器之一时处理，避免误触发其它页。 */
  const IN_CFG = (el) => !!(el && el.closest("#gamecfg-root, #gamecfg-show, #gamecfg-trait, #gamecfg-axis"));
  const t = () => window.GameCfgTool;
  const def = () => window.GameDefaults.base;
  /* 2026-09-05 架构修复：记录「用户实际改过的顶层键」——保存只提交这些键 */
  const mark = (k) => { const tool = t(); if (tool) { (tool.touched = tool.touched || new Set()).add(k); } };
  root.addEventListener("input", (e) => {
    const el = e.target;
    if (!IN_CFG(el)) return;
    const d = t().data;
    if (!d) return;

    /* ---- 能力轴页：按路径写值（doc/27 P5）----
       路径用 | 分隔（阶段键里带点，如 V1.5 —— split(".") 会把键名拆坏）。 */
    /* [feature:editor-axis-path-save] */
    if (el.dataset && (el.dataset.ax || el.dataset.axbool || el.dataset.axpick || el.dataset.axtext)) {
      const segs = String(el.dataset.ax || el.dataset.axbool || el.dataset.axpick || el.dataset.axtext).split("|");
      if (el.dataset.axpick && segs.slice(-2).join("|") === "drivers|role") segs.pop();
      let node = d;
      for (let i = 0; i < segs.length - 1; i++) {
        if (node[segs[i]] == null) node[segs[i]] = {};
        node = node[segs[i]];
      }
      const leaf = segs[segs.length - 1];
      if (el.dataset.axbool) node[leaf] = !!el.checked;
      else if (el.dataset.axpick) {
        if (!Array.isArray(node[leaf])) node[leaf] = [];
        if (el.dataset.axpick.indexOf("drivers|role") >= 0) {
          const role = el.value;                       /* 岗位勾选：drivers 是 [{role}] 数组 */
          node[leaf] = node[leaf].filter((x) => x && x.role !== role);
          if (el.checked) node[leaf].push({ role });
        } else {
          const i = node[leaf].indexOf(el.value);
          if (el.checked && i < 0) node[leaf].push(el.value);
          if (!el.checked && i >= 0) node[leaf].splice(i, 1);
        }
      } else if (el.dataset.axtext) {
        if (el.value === "") delete node[leaf];
        else node[leaf] = leaf === "alternateIndex" ? Number(el.value) : el.value;
      } else node[leaf] = +el.value;
      const tool = t();
      tool.touched = tool.touched || new Set();
      tool.touched.add(segs[0] === "V35" ? "V35" : segs[0]);
      if (segs[0] === "V35" && segs[1] === "AXES" && segs[4] === "source") {
        tool.syncArchAxes(d); tool.touched.add("ARCHITECTURES");     /* 同源① */
      }
      if (segs[0] === "V35" && segs[1] === "REVIEW") {
        tool.syncMissionAxisMin(d); tool.touched.add("MISSIONS");    /* 同源② */
      }
      /* 权重行：**实时**更新行末合计（doc 要求"每行合计 = 1.00"看得见，别等保存才发现错） */
      if (segs[0] === "V35" && segs[2] === "WEIGHTS_BY_VER") {
        const ver = segs[3];
        const row = ((((d.V35 || {}).REVIEW || {}).WEIGHTS_BY_VER) || {})[ver] || {};
        const sum = Object.keys(row).reduce((a, k) => a + (Number(row[k]) || 0), 0);
        const cell = document.querySelector('[data-sumfor="' + ver + '"]');
        if (cell) {
          const okSum = Math.abs(sum - 1) < 1e-6;
          cell.textContent = "合计 " + sum.toFixed(2) + (okSum ? " ✓" : " ✗");
          cell.className = "ax-sum" + (okSum ? " ok" : " bad");
        }
      }
      return;
    }
    /* [/feature:editor-axis-path-save] */
    /* 逐阶段评审通过门槛（data-rv）与小游戏分阶段奖励系数（data-mgmul）：
       这两类输入不带 data-base，必须放在 data-base 主分支**前面**接住 */
    if (el.dataset.rv) {
      mark("V35");
      const ver = el.dataset.rv, rk = el.dataset.rvk;
      if (!d.V35.REVIEW) d.V35.REVIEW = JSON.parse(JSON.stringify(def().V35.REVIEW || {}));
      if (!d.V35.REVIEW.BY_VER) d.V35.REVIEW.BY_VER = JSON.parse(JSON.stringify(def().V35.REVIEW.BY_VER || {}));
      const row = d.V35.REVIEW.BY_VER[ver] = d.V35.REVIEW.BY_VER[ver] || {};
      if (rk === "GREAT_SCORE") row.GREAT_SCORE = +el.value;
      else {
        row.MIN_DIM = row.MIN_DIM || {};
        row.MIN_DIM[rk] = +el.value;
      }
    } else if (el.dataset.mgmul) {
      mark("MINIGAMES");
      if (!d.MINIGAMES) d.MINIGAMES = JSON.parse(JSON.stringify(def().MINIGAMES || {}));
      d.MINIGAMES.VER_MUL = d.MINIGAMES.VER_MUL || {};
      d.MINIGAMES.VER_MUL[el.dataset.mgmul] = +el.value;
    } else if (el.dataset.brandVer) {
      const key = el.dataset.brandField;
      if (!["BRAND_CAP_BY_VER", "BRAND_PASS_BY_VER"].includes(key)) return;
      mark(key);
      d[key] = d[key] || {};
      d[key][el.dataset.brandVer] = +el.value;
      el.value = d[key][el.dataset.brandVer];
    } else if (el.dataset.base) {
      const k = el.dataset.base;
      mark(k.startsWith("V35_") ? "V35" : k.startsWith("TB_") ? "TEAM_BUILD" : k);
      /* V3.5 总分制评审（防偏科线 / 优秀线 / 产出节奏） */
      if (k === "V35_GREAT") { d.V35.REVIEW.GREAT_SCORE = +el.value; }
      /* 顶尖倍率（顶层标量）：顶尖线 = 优秀线 × TOP_RATIO。⚠️ 上限 1.3333 = 1/0.75 ——
         2026-09-29 起优秀线 = 阶段上限 × 0.75、顶尖线 = 上限 × 0.90（TOP_RATIO = 1.20），
         倍率再高顶尖就超过阶段上限、永远摸不到（test_dims ⑥-3b 有守卫）。 */
      else if (k === "BRAND_INCOME_PER_STAR") {
        d[k] = (+el.value) / 100;
        el.value = Math.round(d[k] * 100);
        el.closest(".gcf-pct").querySelector("b").textContent = el.value + "%";
      }
      else if (["INIT_BRAND", "BRAND_STAR_BASE", "BRAND_STAR_STEP", "EXCELLENT_BRAND", "TOP_BRAND"].includes(k)) {
        d[k] = +el.value; el.value = d[k];
      }
      else if (k === "TOP_RATIO") { d.TOP_RATIO = +el.value; }
      else if (k === "V35_MIN_CODE") { d.V35.REVIEW.MIN_DIM.code = +el.value; }
      else if (k === "V35_MIN_TEXT") { d.V35.REVIEW.MIN_DIM.text = +el.value; }
      else if (k === "V35_MIN_SAFETY") { d.V35.REVIEW.MIN_DIM.safety = +el.value; }
      else if (k === "V35_MIN_STAB") { d.V35.REVIEW.MIN_DIM.stability = +el.value; }
      else if (k === "V35_TICK_S") { d.V35.TICK_S = +el.value; }
      else if (k === "V35_WEEKS") { d.V35.WEEKS = +el.value; }
      else if (k === "V35_TP_WEEK") { d.V35.TICKS_PER_WEEK = +el.value; }
      else if (k === "V35_GATE") { d.V35.CORPUS_CURVE.GATE = +el.value; }
      else if (k === "V35_WEEK_ADD") { d.V35.CORPUS_CURVE.WEEK_ADD = +el.value; }
      else if (k === "V35_FOCUS_MUL") { d.V35.FOCUS_MUL = +el.value; }
      else if (k === "V35_FOCUS_TICKS") { d.V35.FOCUS_TICKS = +el.value; }
      /* 攻关条件（2026-09-02 改版）：统一语料门槛 + 经费消耗（旧的分方向门槛已废弃） */
      else if (k === "V35_GATE_FOCUS") { d.V35.FOCUS_CORPUS_GATE = +el.value; }
      else if (k === "V35_FOCUS_GATE_MUL") { d.V35.FOCUS_GATE_MUL = +el.value; }
      /* 逐阶段通过门槛（REVIEW.BY_VER，2026-09-12 用户要求开放全阶梯） */
      else if (k === "V35_REVIEW_VER") {
        const ver = el.dataset.rv, rk = el.dataset.rvk;
        if (!d.V35.REVIEW.BY_VER) d.V35.REVIEW.BY_VER = JSON.parse(JSON.stringify(def().V35.REVIEW.BY_VER || {}));
        const row = d.V35.REVIEW.BY_VER[ver] = d.V35.REVIEW.BY_VER[ver] || {};
        if (rk === "GREAT_SCORE") row.GREAT_SCORE = +el.value;
        else {
          row.MIN_DIM = row.MIN_DIM || {};
          row.MIN_DIM[rk] = +el.value;
        }
      }
      else if (k === "V35_FOCUS_COST") { d.V35.FOCUS_COST = +el.value; }
      else if (k === "V35_DATA_ITEMS") { d.V35.DATA_ITEMS = +el.value; }
      /* 语料缺口减速（GAP_SLOW，2026-09-06）：进度条刻度/看板档位与减速机制共用这组值 */
      else if (k === "V35_PREMIUM_TICK") { d.V35.PREMIUM_TICK_BONUS = +el.value; }
      else if (k === "V35_GAP_FREE") {
        if (!d.V35.GAP_SLOW) d.V35.GAP_SLOW = JSON.parse(JSON.stringify(def().V35.GAP_SLOW || { FREE_ABOVE: 90, STEP: 10, DELAY_MS: 1000 }));
        d.V35.GAP_SLOW.FREE_ABOVE = +el.value;
      }
      else if (k === "V35_GAP_STEP") {
        if (!d.V35.GAP_SLOW) d.V35.GAP_SLOW = JSON.parse(JSON.stringify(def().V35.GAP_SLOW || { FREE_ABOVE: 90, STEP: 10, DELAY_MS: 1000 }));
        d.V35.GAP_SLOW.STEP = +el.value;
      }
      else if (k === "V35_GAP_DELAY") {
        if (!d.V35.GAP_SLOW) d.V35.GAP_SLOW = JSON.parse(JSON.stringify(def().V35.GAP_SLOW || { FREE_ABOVE: 90, STEP: 10, DELAY_MS: 1000 }));
        d.V35.GAP_SLOW.DELAY_MS = +el.value;
      }
      /* 论文研究：耗时与永续效果 */
      else if (k === "V35_PAPER_TICKS") { d.V35.PAPER_RESEARCH_TICKS = +el.value; }
      else if (k === "V35_PAPER_PROB") {
        d.V35.PAPER_TEXT_PROB = (+el.value) / 100;
        el.closest(".gcf-pct").querySelector("b").textContent = el.value + "%";
      }
      else if (k === "V35_PAPER_ADD") { d.V35.PAPER_TEXT_ADD = +el.value; }
      else if (k === "V35_PAPER_DATA_MUL") { d.V35.PAPER_DATA_SPEED_MUL = +el.value; }
      /* 团队建设成本 */
      else if (k === "TB_TEAM_COST") d.TEAM_BUILD.TEAM_COST = +el.value;
      else if (k === "TB_BONUS_COST") d.TEAM_BUILD.BONUS_COST = +el.value;
      else if (k === "TB_TRAIN_COST") d.TEAM_BUILD.TRAIN_COST = +el.value;
      else if (k === "TB_TRAIN_ENERGY") d.TEAM_BUILD.TRAIN_ENERGY = +el.value;
      else if (k === "TB_REST_ENERGY") d.TEAM_BUILD.REST_ENERGY = +el.value;
      else d[k] = +el.value;
    } else if (el.dataset.lvqp) {
      /* 数据词条等级 → 语料品质概率（普通/良好/优质） */
      mark("V35");
      if (!d.V35) d.V35 = JSON.parse(JSON.stringify(def().V35 || {}));
      if (!Array.isArray(d.V35.QUALITY_PROB_BY_DATA_LV)) d.V35.QUALITY_PROB_BY_DATA_LV = JSON.parse(JSON.stringify(def().V35.QUALITY_PROB_BY_DATA_LV || []));
      const lv = Math.max(0, Math.min(4, Math.round(+el.dataset.lvqp || 0)));
      /* 输入格式 "50/40/10"（百分比，可只填第一段，其余按原值保留） */
      const parts = String(el.value).split("/").map((x) => Math.max(0, Math.min(100, Number(x) || 0)) / 100);
      const row = Array.isArray(d.V35.QUALITY_PROB_BY_DATA_LV[lv]) ? d.V35.QUALITY_PROB_BY_DATA_LV[lv].slice() : [0.5, 0.4, 0.1];
      for (let i = 0; i < 3; i++) if (parts[i] !== undefined) row[i] = parts[i];
      /* 归一化到 100%，避免总和偏离 */
      const s = row.reduce((a, b) => a + (b || 0), 0) || 1;
      d.V35.QUALITY_PROB_BY_DATA_LV[lv] = row.map((x) => Math.round(((x || 0) / s) * 1000) / 1000);
    } else if (el.dataset.traitbase) {
      /* 词条基准薪资（等级 → 月薪，doc/22 §2.4） */
      mark("TRAIT_BASE_SALARY");
      if (!d.TRAIT_BASE_SALARY) d.TRAIT_BASE_SALARY = JSON.parse(JSON.stringify(def().TRAIT_BASE_SALARY || {}));
      d.TRAIT_BASE_SALARY[el.dataset.traitbase] = +el.value;
    } else if (el.dataset.acboost) {
      /* 学术词条加算升级概率（等级 → 其它词条升级概率 + 值，索引 = 等级-1） */
      mark("TRAIT_UPGRADE");
      if (!d.TRAIT_UPGRADE) d.TRAIT_UPGRADE = JSON.parse(JSON.stringify(def().TRAIT_UPGRADE || {}));
      if (!Array.isArray(d.TRAIT_UPGRADE.ACADEMIC_BOOST)) d.TRAIT_UPGRADE.ACADEMIC_BOOST =
        JSON.parse(JSON.stringify((def().TRAIT_UPGRADE || {}).ACADEMIC_BOOST || [0.02, 0.05, 0.08, 0.12, 0.15]));
      const ai = Math.max(0, Math.min(4, Math.round(+el.dataset.acboost || 1) - 1));
      d.TRAIT_UPGRADE.ACADEMIC_BOOST[ai] = +el.value / 100;
    } else if (el.dataset.preptierl !== undefined || el.dataset.preptierh !== undefined
               || el.dataset.posttierl !== undefined || el.dataset.posttierh !== undefined) {
      /* 预训练/后训练 词条等级 → 单次产出区间（下限 data-*l / 上限 data-*h，下标 = 等级-1）
         2026-09-10 拆成两个 number 输入框（原「lo/hi 合成一个字符串」在 number 输入框里不显示） */
      mark("V35");
      if (!d.V35) d.V35 = JSON.parse(JSON.stringify(def().V35 || {}));
      const isL = el.dataset.preptierl !== undefined || el.dataset.posttierl !== undefined;
      const isPre = el.dataset.preptierl !== undefined || el.dataset.preptierh !== undefined;
      const key = isPre ? "PRE_TRAIT_TIERS" : "POST_TRAIT_TIERS";
      if (!Array.isArray(d.V35[key]) || d.V35[key].length < 5) d.V35[key] = JSON.parse(JSON.stringify((def().V35 || {})[key] || [[1,2],[2,3],[3,5],[5,8],[8,12]]));
      const lv = Math.max(0, Math.min(4, Math.round(+(isL ? (el.dataset.preptierl ?? el.dataset.posttierl) : (el.dataset.preptierh ?? el.dataset.posttierh)) || 1) - 1));
      let row = (Array.isArray(d.V35[key][lv]) ? d.V35[key][lv].slice() : [1, 2]);
      const v = Number(el.value);
      if (isL) row[0] = v;
      else { row[1] = Math.max(row[0], v); }
      d.V35[key][lv] = row;
    } else if (el.dataset.bee) {
      /* 趣味掉落鲸bee（WHALEBEE） */
      mark("WHALEBEE");
      if (!d.WHALEBEE) d.WHALEBEE = JSON.parse(JSON.stringify(def().WHALEBEE || {}));
      const bk = el.dataset.bee;
      if (bk === "enabled") d.WHALEBEE.ENABLED = el.value === "1";
      else if (bk === "IMG") d.WHALEBEE.IMG = el.value.trim();
      else d.WHALEBEE[bk] = +el.value;
    } else if (el.dataset.np) {
      /* 吃瓜新闻页（NEWS_PAGE） */
      mark("NEWS_PAGE");
      if (!d.NEWS_PAGE) d.NEWS_PAGE = JSON.parse(JSON.stringify(def().NEWS_PAGE || {}));
      const nk = el.dataset.np;
      if (nk === "HOT_REFRESH_S") d.NEWS_PAGE.HOT_REFRESH_MS = +el.value * 1000;
      else if (nk === "NEW_EVERY_MIN") d.NEWS_PAGE.NEW_EVERY_MIN = +el.value;
      else d.NEWS_PAGE[nk] = +el.value;
    } else if (el.dataset.gpu) {
      /* 算力档位：价格 / 参数上限 / 显卡图（旧版漏了本分支，改动不生效——已补） */
      mark("GPU_TIERS");
      if (!d.GPU_TIERS) d.GPU_TIERS = JSON.parse(JSON.stringify(def().GPU_TIERS || {}));
      const g = d.GPU_TIERS[el.dataset.gpu] = d.GPU_TIERS[el.dataset.gpu] || {};
      const key = el.dataset.key;
      if (key === "price") g.price = +el.value;
      else if (key === "maxParam") g.maxParam = +el.value;
      else if (key === "icon") g.icon = el.value.trim();
    } else if (el.dataset.v35w) {
      /* V3.5 评审权重滑条 */
      mark("V35");
      d.V35.REVIEW.WEIGHTS[el.dataset.v35w] = (+el.value) / 100;
      el.closest(".gcf-pct").querySelector("b").textContent = el.value + "%";
    } else if (el.dataset.prize) {
      /* 各阶段评审通过奖金 */
      mark("PASS_PRIZE_BY_VER");
      d.PASS_PRIZE_BY_VER[el.dataset.prize] = +el.value;
    } else if (el.dataset.mission) {
      /* 阶段任务目标（doc/23）：总开关 / 判定口径 / 增量系数 */
      mark("MISSIONS");
      if (!d.MISSIONS) d.MISSIONS = JSON.parse(JSON.stringify(def().MISSIONS || {}));
      const k = el.dataset.mission;
      if (k === "ENABLED") d.MISSIONS.ENABLED = el.value === "1";
      else if (k.indexOf("INC_") === 0) {
        if (!d.MISSIONS.INC) d.MISSIONS.INC = JSON.parse(JSON.stringify((def().MISSIONS || {}).INC || {}));
        d.MISSIONS.INC[k.slice(4)] = +el.value;
      }
    } else if (el.dataset.missionVer) {
      /* 阶段任务目标（doc/23）：逐阶段的 目标名 / 架构 / 参数下限 / 说明 */
      mark("MISSIONS");
      if (!d.MISSIONS) d.MISSIONS = JSON.parse(JSON.stringify(def().MISSIONS || {}));
      if (!d.MISSIONS.BY_VER) d.MISSIONS.BY_VER = JSON.parse(JSON.stringify((def().MISSIONS || {}).BY_VER || {}));
      const m = d.MISSIONS.BY_VER[el.dataset.missionVer]
        = d.MISSIONS.BY_VER[el.dataset.missionVer] || {};
      const key = el.dataset.missionKey;
      if (key === "param") { if (el.value === "") delete m.param; else m.param = +el.value; }
      else if (key === "arch") { if (!el.value) delete m.arch; else m.arch = el.value; }
      else m[key] = el.value;
    } else if (el.dataset.stage) {
      /* 各阶段语料曲线（V35.STAGES） */
      mark("V35");
      if (!d.V35.STAGES) d.V35.STAGES = JSON.parse(JSON.stringify(def().V35.STAGES || {}));
      const s = d.V35.STAGES[el.dataset.stage] = d.V35.STAGES[el.dataset.stage] || {};
      s[el.dataset.key] = +el.value;
    } else if (el.dataset.buy) {
      /* 语料外包：单价 / 良好品质率 */
      mark("V35");
      const buy = d.V35.CORPUS_CURVE.BUY;
      if (el.dataset.buy === "price") buy.price = +el.value;
      else { buy.goodProb = (+el.value) / 100; el.closest(".gcf-pct").querySelector("b").textContent = el.value + "%"; }
    } else if (el.dataset.mgtrig) {
      /* 小游戏触发条件（2026-09-11 新增）：{ ver, week, needRole } × SFT / RM */
      mark("MINIGAMES");
      const T = d.MINIGAMES.TRIGGER = d.MINIGAMES.TRIGGER || {};
      const o = T[el.dataset.mgtrig] = T[el.dataset.mgtrig] || {};
      if (el.dataset.key === "week") o.week = +el.value;
      else o[el.dataset.key] = el.value;
    } else if (el.dataset.mg) {
      /* 小游戏（SFT/RM）轮数与奖励 */
      mark("MINIGAMES");
      const g = d.MINIGAMES[el.dataset.mg] = d.MINIGAMES[el.dataset.mg] || {};
      if (el.dataset.key === "rounds") g.ROUNDS = +el.value;
      else {
        const stat = el.dataset.mg === "SFT" ? "text" : "safety";
        g.HIT = g.HIT || {}; g.HIT[stat] = +el.value;
      }
    } else if (el.dataset.pct) {
      mark("EVAL_WEIGHTS");
      d.EVAL_WEIGHTS[el.dataset.pct] = (+el.value) / 100;
      el.closest(".gcf-pct").querySelector("b").textContent = el.value + "%";
    } else if (el.dataset.hire) {
      /* 扩编招聘（V3.5.3）：岗位名 / 寻访等待周数 / 找到概率 */
      mark("V35");
      if (!d.V35) d.V35 = JSON.parse(JSON.stringify(def().V35 || {}));
      if (!d.V35.HIRE_ROLES) d.V35.HIRE_ROLES = JSON.parse(JSON.stringify(def().V35.HIRE_ROLES || {}));
      const role = el.dataset.hire, key = el.dataset.key;
      const r = d.V35.HIRE_ROLES[role] = d.V35.HIRE_ROLES[role] || {};
      if (key === "label") r.label = el.value.trim();
      else if (key === "wait0") { r.waitMin = r.waitMin || [1, 3]; r.waitMin[0] = +el.value; }
      else if (key === "wait1") { r.waitMin = r.waitMin || [1, 3]; r.waitMin[1] = +el.value; }
      else if (key === "prob") {
        r.findProb = (+el.value) / 100;
        el.closest(".gcf-pct").querySelector("b").textContent = el.value + "%";
      }
    } else if (el.dataset.archmax) {
      /* 架构 → 最大可选参数（2026-09-09）：写进 ARCHITECTURES 对应 id 的 maxParam。
         填 0 / 空 = 不限制（archMaxParam 返回 null → 只用算力上限）。 */
      mark("ARCHITECTURES");
      const id = el.dataset.archmax;
      const v = +el.value;
      if (!Array.isArray(d.ARCHITECTURES)) d.ARCHITECTURES = JSON.parse(JSON.stringify(def().ARCHITECTURES || []));
      const a = d.ARCHITECTURES.find((x) => x.id === id);
      if (a) a.maxParam = v > 0 ? v : null;
    } else if (el.dataset.archrep != null || el.dataset.archmeta != null) {
      /* 自家报告标题 / 说明（2026-09-13）：只对「自研路线」有意义，但不做强制校验 ——
         从自研切回外部论文时把这两项留着无害（archUnlock 只在 unlockBy==="approval" 时才看批准）。 */
      mark("ARCHITECTURES");
      if (!Array.isArray(d.ARCHITECTURES)) d.ARCHITECTURES = JSON.parse(JSON.stringify(def().ARCHITECTURES || []));
      const aid = el.dataset.archrep != null ? el.dataset.archrep : el.dataset.archmeta;
      const ar = d.ARCHITECTURES.find((x) => x.id === aid);
      if (ar) {
        if (el.dataset.archrep != null) ar.selfReport = el.value.trim();
        else ar.selfReportMeta = el.value.trim();
      }
    } else if (el.dataset.rc || el.dataset.tt != null || el.dataset.tlc || el.dataset.lvm || el.dataset.lvw) {
      /* 招聘 · 天赋档 · 等级上限与权重（2026-09-12 用户拍板改版） */
      if (el.dataset.rc) {
        const k = el.dataset.rc;
        /* 2026-09-09 BUGFIX：mark 键必须与实际写入的**顶层键**同名，否则 basePayload
           `(k in this.data)` 判断为 false 直接跳过 → 改了保存 / 刷新即恢复原值。
           之前 mark(el.dataset.rc) 标记的是 "cost"/"ttl"/"lock" 而非真实顶层键，三处都不落盘。 */
        const REAL_KEY = { cost: "RECRUIT_COST", ttl: "CANDIDATE_TTL_WEEKS", lock: "CANDIDATE_LOCK_WEEKS" };
        mark(REAL_KEY[k] || k);
        if (k === "cost") d.RECRUIT_COST = +el.value;
        else if (k === "ttl") d.CANDIDATE_TTL_WEEKS = +el.value;
        else if (k === "lock") d.CANDIDATE_LOCK_WEEKS = +el.value;
      } else if (el.dataset.tt != null && el.dataset.tt !== "") {
        /* 天赋档阈值（TIER_THRESHOLDS，唯一真源）：0=良好 / 1=优秀 / 2=天才 / 3=顶级天才 的下限。
           ⚠️ 不做自动归一/重渲染 —— 面板重渲染会让光标从输入框里掉出去（用户最烦这个），
           只保证 0~100；「必须递增」写在面板说明里由人负责（非递增也不会崩，只是档位变宽）。 */
        mark("TIER_THRESHOLDS");
        if (!Array.isArray(d.TIER_THRESHOLDS)) d.TIER_THRESHOLDS = JSON.parse(JSON.stringify(def().TIER_THRESHOLDS || [60, 70, 80, 90]));
        const i = Math.max(0, Math.min(3, Math.round(+el.dataset.tt || 0)));
        d.TIER_THRESHOLDS[i] = +el.value;
      } else if (el.dataset.tlc) {
        /* 天赋档 → 词条等级上限（TALENT_LV_CAP）：一般/良好/优秀/天才/顶级天才 各自的天花板 */
        mark("TALENT_LV_CAP");
        if (!d.TALENT_LV_CAP) d.TALENT_LV_CAP = JSON.parse(JSON.stringify(def().TALENT_LV_CAP || {}));
        d.TALENT_LV_CAP[el.dataset.tlc] = +el.value;
      } else if (el.dataset.lvm) {
        /* 本阶段能捞到的**最高**词条等级（下限恒 Lv1，不再有 min） */
        mark("HIRE_LV_RANGE_BY_VER");
        if (!d.HIRE_LV_RANGE_BY_VER) d.HIRE_LV_RANGE_BY_VER = JSON.parse(JSON.stringify(def().HIRE_LV_RANGE_BY_VER || {}));
        const v = el.dataset.lvm;
        const r = d.HIRE_LV_RANGE_BY_VER[v] = d.HIRE_LV_RANGE_BY_VER[v] || { max: 5, lv: [1, 1, 1, 1, 1] };
        r.max = +el.value;
        if (!Array.isArray(r.lv) || r.lv.length < 5) {
          const old = Array.isArray(r.lv) ? r.lv.slice() : [];
          const nd = [];
          for (let k = 0; k < 5; k++) nd.push(old[k] != null ? old[k] : 1);
          r.lv = nd;
        }
        /* 超出上限的等级权重在抽取时会被忽略（上限优先）——不在这里清零，
           否则用户把上限调小再调大，权重就找不回来了。 */
      } else if (el.dataset.lvw) {
        /* 各等级的额外权重（1 = 与池子人数成正比；0 = 该等级不出现） */
        mark("HIRE_LV_RANGE_BY_VER");
        if (!d.HIRE_LV_RANGE_BY_VER) d.HIRE_LV_RANGE_BY_VER = JSON.parse(JSON.stringify(def().HIRE_LV_RANGE_BY_VER || {}));
        const v = el.dataset.lvw, i = Math.max(0, Math.min(4, Math.round(+el.dataset.i || 0)));
        const r = d.HIRE_LV_RANGE_BY_VER[v] = d.HIRE_LV_RANGE_BY_VER[v] || { max: 5, lv: [1, 1, 1, 1, 1] };
        if (!Array.isArray(r.lv) || r.lv.length < 5) {
          const old = Array.isArray(r.lv) ? r.lv.slice() : [];
          const nd = [];
          for (let k = 0; k < 5; k++) nd.push(old[k] != null ? old[k] : 1);
          r.lv = nd;
        }
        r.lv[i] = (+el.value) * 10 / 10;
        const b = el.closest(".gcf-field").querySelector("b");
        if (b) b.textContent = r.lv[i];
      }
    } else if (el.dataset.usermul) {
      /* 结算演出：用户增长系数（usersGained = 评分 × 系数） */
      mark("USER_GAIN_MUL_BY_VER");
      if (!d.USER_GAIN_MUL_BY_VER) d.USER_GAIN_MUL_BY_VER = JSON.parse(JSON.stringify(def().USER_GAIN_MUL_BY_VER || {}));
      d.USER_GAIN_MUL_BY_VER[el.dataset.usermul] = +el.value;
    } else if (el.dataset.stmax) {
      /* 结算演出：各阶段词条等级上限（STAGE_TRAIT_MAX） */
      mark("STAGE_TRAIT_MAX");
      if (!d.STAGE_TRAIT_MAX) d.STAGE_TRAIT_MAX = JSON.parse(JSON.stringify(def().STAGE_TRAIT_MAX || {}));
      d.STAGE_TRAIT_MAX[el.dataset.stmax] = +el.value;
    } else if (el.dataset.es) {
      /* 评审演出台：节奏（毫秒/题数）+ 答对率曲线参数（2026-09-05 新增可配） */
      mark("EVAL_SHOW");
      if (!d.EVAL_SHOW) d.EVAL_SHOW = JSON.parse(JSON.stringify(def().EVAL_SHOW || {}));
      const k = el.dataset.es;
      if (k === "QA_COUNT") d.EVAL_SHOW.QA_COUNT = +el.value;
      else if (k === "MS_PER_Q") d.EVAL_SHOW.MS_PER_Q = +el.value;
      else if (k === "TYPE_MS") d.EVAL_SHOW.TYPE_MS = +el.value;
      else if (k === "JUDGE_MS") d.EVAL_SHOW.JUDGE_MS = +el.value;
      else if (k === "MIN_P" || k === "MAX_P") {
        /* 夹取边界：百分数输入 → 0~1，且保证 MIN < MAX */
        d.EVAL_SHOW[k] = (+el.value) / 100;
        el.closest(".gcf-pct").querySelector("b").textContent = el.value + "%";
      } else {
        d.EVAL_SHOW[k] = (+el.value) / 100;
        el.closest(".gcf-pct").querySelector("b").textContent = el.value + "%";
      }
      if (d.EVAL_SHOW.MIN_P != null && d.EVAL_SHOW.MAX_P != null
        && d.EVAL_SHOW.MIN_P > d.EVAL_SHOW.MAX_P) {
        const tmp = d.EVAL_SHOW.MIN_P; d.EVAL_SHOW.MIN_P = d.EVAL_SHOW.MAX_P; d.EVAL_SHOW.MAX_P = tmp;
      }
    } else if (el.dataset.qa != null && el.dataset.field) {
      /* 题库编辑：题目 / 正确回答 / 错误回答 / 维度 —— 写进当前选中的 题型×难度 那一套 */
      const d2 = t().data;
      const b = t()._qaBank || "chat", df = t()._qaDiff || "low";
      mark("EVAL_BANK");
      if (!d2.EVAL_BANK) d2.EVAL_BANK = {};
      d2.EVAL_BANK[b] = d2.EVAL_BANK[b] || { low: [], mid: [], high: [] };
      d2.EVAL_BANK[b][df] = d2.EVAL_BANK[b][df] || [];
      const i = +el.dataset.qa, f = el.dataset.field;
      if (d2.EVAL_BANK[b][df][i]) d2.EVAL_BANK[b][df][i][f] = el.value;
    } else if (el.dataset.bank && el.dataset.field) {
      /* SFT / RM 题库编辑（2026-09-11）：卡片里改完即写回内存，点「保存全部」才落盘。
         good.t / good.why 是嵌套字段（用点分隔）；带 data-b 的是 bads[] / items[] 里的元素。 */
      const d3 = t().data;
      const key = el.dataset.bank;
      const arr = d3[key] || (d3[key] = []);
      const it = arr[+el.dataset.i];
      if (it) {
        const f = el.dataset.field, b = el.dataset.b;
        if (b == null) {
          if (f.indexOf(".") > 0) {
            const parts = f.split(".");
            it[parts[0]] = it[parts[0]] || {};
            it[parts[0]][parts[1]] = el.value;
          } else it[f] = el.value;
        } else {
          const list = key === "SFT_DATA" ? (it.bads = it.bads || []) : (it.items = it.items || []);
          if (!list[+b]) list[+b] = {};
          list[+b][f] = f === "rank" ? (+el.value) : el.value;
        }
        mark(key);
      }
    } else if (el.dataset.qaSel) {
      /* 题型 / 难度下拉：切换当前编辑的题库，切换后重渲染 */
      if (el.dataset.qaSel === "bank") t()._qaBank = el.value;
      else t()._qaDiff = el.value;
      t().render();
    } else if (el.dataset.pickarch) {
      const d2 = t().data;
      mark("EVAL_BANK_PICK");
      d2.EVAL_BANK_PICK = d2.EVAL_BANK_PICK || JSON.parse(JSON.stringify(def().EVAL_BANK_PICK || {}));
      d2.EVAL_BANK_PICK.archToBank = d2.EVAL_BANK_PICK.archToBank || {};
      d2.EVAL_BANK_PICK.archToBank[el.dataset.pickarch] = el.value;
    } else if (el.dataset.pickdiff) {
      const d2 = t().data;
      mark("EVAL_BANK_PICK");
      d2.EVAL_BANK_PICK = d2.EVAL_BANK_PICK || JSON.parse(JSON.stringify(def().EVAL_BANK_PICK || {}));
      d2.EVAL_BANK_PICK.difficultyByVer = d2.EVAL_BANK_PICK.difficultyByVer || {};
      d2.EVAL_BANK_PICK.difficultyByVer[el.dataset.pickdiff] = el.value;
    } else if (el.dataset.tl) {
      mark("TRAIN_TIMELINE");
      if (!d.TRAIN_TIMELINE) d.TRAIN_TIMELINE = {};
      const key = el.dataset.tl;
      const raw = (el.value).trim();
      // windowMonths 为数字；startDate 为日期字符串
      d.TRAIN_TIMELINE[key] = key === "windowMonths" ? (parseInt(raw, 10) || 6) : raw;
    } else if (el.dataset.tgKey) {
      /* 测试聊天彩蛋（TEST_GAME）：文本输入 / 文本域 即时写入 */
      mark("TEST_GAME");
      if (!d.TEST_GAME) d.TEST_GAME = JSON.parse(JSON.stringify((def().TEST_GAME || { enabled: true, url: "" })));
      d.TEST_GAME[el.dataset.tgKey] = el.value;
    } else if (el.dataset.apr) {
      /* 架构×参数语料要求表（2026-09-12 用户要求：纯数字输入框，不写 JSON）：
         每格即时写入 d.ARCH_PARAM_REQ["架构@参数"]，quality 按百分数存 0~1 */
      mark("ARCH_PARAM_REQ");
      if (!d.ARCH_PARAM_REQ) d.ARCH_PARAM_REQ = JSON.parse(JSON.stringify(window.GameDefaults.base.ARCH_PARAM_REQ || {}));
      const aprKey = el.dataset.apr;
      const row = d.ARCH_PARAM_REQ[aprKey] = d.ARCH_PARAM_REQ[aprKey] || {};
      const v = +el.value;
      if (el.dataset.aprf === "gate") row.gate = v;
      else if (el.dataset.aprf === "weekAdd") row.weekAdd = v;
      else if (el.dataset.aprf === "quality") {
        const qv = v;
        row.quality = qv / 100;
        el.value = qv;
      }
    }
    /* 结算演出 JSON 块（榜单 / 评价池）走 change（失焦校验），不在 input 链里处理 */
    if (window.App && App.markCfgDirty) App.markCfgDirty();
  });
  root.addEventListener("change", (e) => {
    const el = e.target;
    if (!IN_CFG(el)) return;
    const d = t().data;
    if (!d) return;
    const OK_BORDER = "";
    const ERR_BORDER = "var(--danger)";
    if (el.dataset.archpaper) {
      /* 架构的「钥匙论文」引用（doc/32 §0：引用走 ID，“改文案不影响解锁”）。
         空值 = 不挂钥匙（该架构不需要研读任何论文即可解锁）。 */
      mark("ARCHITECTURES");
      if (!Array.isArray(d.ARCHITECTURES)) d.ARCHITECTURES = JSON.parse(JSON.stringify(def().ARCHITECTURES || []));
      const ar = d.ARCHITECTURES.find((x) => x.id === el.dataset.archpaper);
      if (ar) {
        if (el.value === "") delete ar.unlockPaper;
        else ar.unlockPaper = Number(el.value);
      }
    } else if (el.dataset.archby) {
      /* 架构解锁方式（2026-09-13 用户要求）：
         paper    = 外部论文路线 → 研读 ARCHITECTURES[*].unlockPaper 才解锁（旧流程）
         approval = 自研路线     → 不研读，等团队提案事件批准（写 s.approvedArchs）
         ⚠️ 只改 unlockBy，不碰 unlockPaper —— 切回 paper 时原来的钥匙论文还在。 */
      mark("ARCHITECTURES");
      if (!Array.isArray(d.ARCHITECTURES)) d.ARCHITECTURES = JSON.parse(JSON.stringify(def().ARCHITECTURES || []));
      const ar = d.ARCHITECTURES.find((x) => x.id === el.dataset.archby);
      if (ar && ["paper","approval","embodied"].includes(el.value)) ar.unlockBy = el.value;
    } else if (el.dataset.board != null) {
      mark("RANK_BOARD_BY_VER");
      if (!d.RANK_BOARD_BY_VER) d.RANK_BOARD_BY_VER = JSON.parse(JSON.stringify(def().RANK_BOARD_BY_VER || {}));
      try {
        const arr = JSON.parse(el.value);
        if (!Array.isArray(arr) || !arr.length) throw new Error("应为非空数组");
        d.RANK_BOARD_BY_VER[el.dataset.board] = arr;
        el.style.borderColor = OK_BORDER;
      } catch (e2) { el.style.borderColor = ERR_BORDER; }
    } else if (el.dataset.feedback != null) {
      mark("USER_FEEDBACK");
      try {
        const o = JSON.parse(el.value);
        if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("应为对象");
        d.USER_FEEDBACK = o;
        el.style.borderColor = OK_BORDER;
      } catch (e2) { el.style.borderColor = ERR_BORDER; }
    } else if (el.dataset.traitstat) {
      /* 词条升级：依据属性（多选）—— 勾选/取消后立即重渲染刷新预览 */
      const d2 = t().data;
      mark("TRAIT_UPGRADE");
      d2.TRAIT_UPGRADE = d2.TRAIT_UPGRADE || JSON.parse(JSON.stringify(def().TRAIT_UPGRADE || {}));
      d2.TRAIT_UPGRADE.traits = d2.TRAIT_UPGRADE.traits || {};
      const tt = el.dataset.traitstat;
      const r = d2.TRAIT_UPGRADE.traits[tt] = d2.TRAIT_UPGRADE.traits[tt] || { stats: ["algo"], div: [900, 1200, 1500, 1800] };
      if (!Array.isArray(r.stats)) r.stats = [r.stats];
      const k = el.dataset.stat;
      if (!t().traitStatKeys(tt).includes(k)) return;
      const i = r.stats.indexOf(k);
      if (el.checked && i < 0) r.stats.push(k);
      else if (!el.checked && i >= 0) r.stats.splice(i, 1);
      if (!r.stats.length) r.stats = ["algo"];    // 至少留一项，否则永远升不了级
      t().render();
      return;
    } else if (el.dataset.traitmin) {
      /* 词条升级：门槛（change = 失焦才生效）。
         2026-09-05 修 BUG：原来放在 input 链里且每次按键都 t().render() 整页重建——
         数字键盘每敲一键就丢焦点、滚动跳顶，表现为"一按数字键盘页面就跳走"。
         现在改成失焦生效 + 只局部刷新概率预览，输入过程完全不动页面。 */
      d.TRAIT_UPGRADE = d.TRAIT_UPGRADE || JSON.parse(JSON.stringify(def().TRAIT_UPGRADE || {}));
      mark("TRAIT_UPGRADE");
      d.TRAIT_UPGRADE.MIN_STAT = +el.value;
      t().refreshTraitPreviews(d);
    } else if (el.dataset.traitdiv) {
      /* 词条升级：某等级段的除数（同样失焦生效 + 局部刷新，理由同上） */
      mark("TRAIT_UPGRADE");
      d.TRAIT_UPGRADE = d.TRAIT_UPGRADE || JSON.parse(JSON.stringify(def().TRAIT_UPGRADE || {}));
      d.TRAIT_UPGRADE.traits = d.TRAIT_UPGRADE.traits || {};
      const tt = el.dataset.traitdiv;
      const r = d.TRAIT_UPGRADE.traits[tt] = d.TRAIT_UPGRADE.traits[tt] || { stats: ["algo"], div: [900, 1200, 1500, 1800] };
      if (!Array.isArray(r.div) || !r.div.length) r.div = [900, 1200, 1500, 1800];
      r.div[+el.dataset.i] = +el.value;
      t().refreshTraitPreviews(d);
    } else if (el.dataset.pickmix != null) {
      /* 选题规则：阶段覆盖 · 混合题库（字符串 / 数组 / 权重对象 三种写法都接受） */
      mark("EVAL_BANK_PICK");
      try {
        const o = JSON.parse(el.value);
        if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("应为对象");
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (!(typeof v === "string" || Array.isArray(v) || (v && typeof v === "object"))) {
            throw new Error(k + " 的值应为 字符串 / 数组 / 对象");
          }
        }
        d.EVAL_BANK_PICK = d.EVAL_BANK_PICK || {};
        d.EVAL_BANK_PICK.archToBankByVer = o;
        el.style.borderColor = OK_BORDER;
      } catch (e2) { el.style.borderColor = ERR_BORDER; }
    } else if (el.dataset.tgKey === "enabled") {
      /* 测试聊天彩蛋：启用开关（select 走 change） */
      mark("TEST_GAME");
      if (!d.TEST_GAME) d.TEST_GAME = JSON.parse(JSON.stringify((def().TEST_GAME || { enabled: true, url: "" })));
      d.TEST_GAME.enabled = el.value !== "0";
    }
  });
  /* 「浏览」按钮：弹出资源选择器，选中后回填对应图片路径输入框 */
    if (window.App && App.markCfgDirty) App.markCfgDirty();
  root.addEventListener("click", (e) => {
    /* 题库增删（2026-09-05）：作用于当前「题型 × 难度」选中的那一套，改完重渲染 */
    if (!IN_CFG(e.target)) return;
    if (e.target.closest("[data-qa-add]")) {
      const d = t().data;
      const b = t()._qaBank || "chat", df = t()._qaDiff || "low";
      mark("EVAL_BANK");
      if (!d.EVAL_BANK) d.EVAL_BANK = {};
      d.EVAL_BANK[b] = d.EVAL_BANK[b] || { low: [], mid: [], high: [] };
      d.EVAL_BANK[b][df] = d.EVAL_BANK[b][df] || [];
      d.EVAL_BANK[b][df].push({ dim: df === "code" ? "code" : "text", q: "", good: "", bad: "" });
      t().render();
      return;
    }
    const delBtn = e.target.closest("[data-qa-del]");
    if (delBtn) {
      const d = t().data, i = +delBtn.dataset.qaDel;
      const b = t()._qaBank || "chat", df = t()._qaDiff || "low";
      mark("EVAL_BANK");
      const arr = (d.EVAL_BANK && d.EVAL_BANK[b] && d.EVAL_BANK[b][df]) || [];
      if (i >= 0 && i < arr.length) {
        arr.splice(i, 1);
        t().render();
      }
      return;
    }
    /* ---- SFT / RM 题库：增删（2026-09-11，与上面的评测题库同款做法） ---- */
    const bAdd = e.target.closest("[data-bank-add]");
    if (bAdd) {
      const key = bAdd.dataset.bankAdd, d = t().data;
      mark(key);
      const arr = d[key] || (d[key] = []);
      if (key === "SFT_DATA") arr.push({ q: "", good: { t: "", why: "" }, bads: [{ t: "", why: "" }] });
      else arr.push({ q: "", items: [{ t: "", why: "", rank: 1 }] });
      t().render();
      return;
    }
    const bAddBad = e.target.closest("[data-bank-addbad]");
    if (bAddBad) {
      const seg = String(bAddBad.dataset.bankAddbad).split(":");
      const key = seg[0], it = ((t().data[key]) || [])[+seg[1]];
      if (it) {
        mark(key);
        if (key === "SFT_DATA") { it.bads = it.bads || []; it.bads.push({ t: "", why: "" }); }
        else { it.items = it.items || []; it.items.push({ t: "", why: "", rank: it.items.length + 1 }); }
        t().render();
      }
      return;
    }
    const bDel = e.target.closest("[data-bank-del]");
    if (bDel) {
      const seg = String(bDel.dataset.bankDel).split(":");
      const key = seg[0], arr = t().data[key] || [];
      if (arr[+seg[1]]) { mark(key); arr.splice(+seg[1], 1); t().render(); }
      return;
    }
    const bDelBad = e.target.closest("[data-bank-delbad]");
    if (bDelBad) {
      const seg = String(bDelBad.dataset.bankDelbad).split(":");
      const key = seg[0], it = ((t().data[key]) || [])[+seg[1]];
      const list = it && (key === "SFT_DATA" ? it.bads : it.items);
      if (list && list[+seg[2]]) { mark(key); list.splice(+seg[2], 1); t().render(); }
      return;
    }

    const btn = e.target.closest("[data-browse]");
    if (!btn || !window.ResPicker) return;
    const input = btn.parentElement.querySelector("input");
    if (!input) return;
    ResPicker.pick(input.value.trim(), { title: "选择图片" }).then((p) => {
      if (!p) return;
      input.value = p;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
});
/* [feature:retired-stage-budget-editor-save] */
(function(tool) {
  const ensure = tool.ensure;
  tool.ensure = function(data) {
    if (data && typeof data === "object") delete data.STAGE_BUDGET;
    return ensure.apply(this, arguments);
  };
  const payload = tool.basePayload;
  tool.basePayload = function() {
    if (this.data) delete this.data.STAGE_BUDGET;
    const result = payload.apply(this, arguments);
    delete result.STAGE_BUDGET;
    // Old touched/reset state may survive while an editor tab is open.
    result.__resetKeys = (result.__resetKeys || []).filter(parts => parts[0] !== "STAGE_BUDGET");
    return result;
  };
})(window.GameCfgTool);
/* [/feature:retired-stage-budget-editor-save] */
/* [feature:staff-raise-policy-editor-20261012] */
(function(tool){
 if(!tool||tool._staffRaisePolicyUI)return;tool._staffRaisePolicyUI=true;
 const render=tool.renderBase;
 tool.renderBase=function(){
  const result=render.apply(this,arguments),anchor=document.querySelector('#gamecfg-base [data-base="TB_REST_ENERGY"]'),host=anchor&&anchor.closest('.gcf-mod');
  if(!host)return result;
  const defaults=((window.GameDefaults.base.TEAM_BUILD||{}).RAISE_EVENTS||{}),policy=Object.assign({},defaults,((this.data.TEAM_BUILD||{}).RAISE_EVENTS||{}));
  const section=document.createElement('section');section.dataset.staffRaisePolicy='';
  section.innerHTML='<div class="gcf-subhead">员工薪酬沟通</div><p class="gcf-tip">员工久未涨薪会主动沟通；词条升级后未调薪，HR会提出建议。两类共享阶段额度，同一员工每阶段最多一次，每周最多一次；拒绝只影响目标员工，成功涨薪可解除减产。</p>';
  const grid=document.createElement('div');grid.className='gcf-grid';
  const enabled=document.createElement('label');enabled.className='check-field';enabled.innerHTML='<input type="checkbox" data-raise-policy="ENABLED">启用薪酬沟通事件';enabled.querySelector('input').checked=policy.ENABLED!==false;grid.appendChild(enabled);
  const fields=[['NO_RAISE_WEEKS','久未涨薪阈值（游戏周）',policy.NO_RAISE_WEEKS,0,104],['UPGRADE_WAIT_WEEKS','词条升级后的等待（游戏周）',policy.UPGRADE_WAIT_WEEKS,0,104],['PER_STAGE_MAX','每阶段共享次数（最多2次）',policy.PER_STAGE_MAX,0,2],['REJECT_PROB','拒绝触发减产的概率（%）',Math.round((policy.REJECT_PROB||0)*100),0,100],['REJECT_PROD_MUL','目标员工减产比例（%）',Math.min(99,Math.max(0,Math.round((1-policy.REJECT_PROD_MUL)*100))),0,99],['REJECT_WEEKS','减产持续时间（游戏周）',policy.REJECT_WEEKS,0,104]];
  for(const [key,label,value,min,max]of fields){const wrap=document.createElement('div');wrap.innerHTML=this.num(label,'data-raise-policy="'+key+'" min="'+min+'" max="'+max+'"',value,1);grid.appendChild(wrap.firstElementChild);}
  section.appendChild(grid);host.insertBefore(section,host.querySelector('.gcf-subhead'));
  section.addEventListener('input',event=>{
   const input=event.target,key=input.dataset.raisePolicy;if(!key)return;
   let value;if(key==='ENABLED')value=input.checked;else{
    if(input.value==='')return;value=Number(input.value);if(!Number.isFinite(value))return;

    if(key==='REJECT_PROB')value/=100;else if(key==='REJECT_PROD_MUL')value=(100-value)/100;
   }
   const data=this.data;data.TEAM_BUILD=data.TEAM_BUILD||{};data.TEAM_BUILD.RAISE_EVENTS=Object.assign({},defaults,data.TEAM_BUILD.RAISE_EVENTS||{});data.TEAM_BUILD.RAISE_EVENTS[key]=value;
   (this.touched=this.touched||new Set()).add('TEAM_BUILD');if(window.App&&App.markCfgDirty)App.markCfgDirty();
  });
  return result;
 };
})(window.GameCfgTool);
/* [/feature:staff-raise-policy-editor-20261012] */
