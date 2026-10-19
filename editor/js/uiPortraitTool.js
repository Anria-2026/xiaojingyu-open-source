/* ==========================================================================
   界面立绘配置页（大模型研发养成）
   --------------------------------------------------------------------------
   2026-09-03 与游戏同步审计：旧「左数值|中立绘|右内容」决策模板已随办公室
   新 UI 下线，废弃项（fixed 固定/random 随机/reward/positive/negative/critical/
   recruit 招聘页/office/shop/plan/focus/paper/test/report/over）全部移除。
   现在游戏里仍在使用鲸鱼娘立绘的位置（配置项与之一一对应）：
   - naming   起名界面（开局给模型起名）
   - prologue 教学/剧情气泡（新手教学弹窗）
   - chat     测试聊天头像（「测试」面板聊天窗口）
   - over     结算页立绘（旧 bonus 奖励立绘已随三幕结算重做删除）
   - fixed    兜底立绘（游戏 portraitSrc 找不到对应键时的回退）
   支持：直接选择 resource/character 或 resource/event 已有图片、上传新图片
   （写入 resource/event/ 并自动压缩为 webp）、恢复出厂默认。
   保存（section=UI_PORTS，uType → 立绘路径 map）→ 同步游戏。
   ========================================================================== */
"use strict";

window.UIPortraitTool = {
  data: null,      // uiType -> 立绘路径（resource/...）
  files: {},       // dir -> 文件列表
  _fileInput: null,

  async refresh() {
    /* 默认模板统一在 GameDefaults.base 下（兼容旧的顶层结构） */
    const G = window.GameDefaults || {};
    const def = G.base || G;
    // 加载已保存配置 + 默认立绘，保证所有类型都有值
    let c = {};
    try {
      const j = await (await fetch("/api/game-cfg")).json();
      if (window.CfgSync) CfgSync.note(j);
      c = j.config || {};
    } catch (e) { /* 无外部配置 */ }
    const saved = (c.UI_PORTS && typeof c.UI_PORTS === "object") ? c.UI_PORTS : {};
    this.data = {};
    (def.UI_TYPES ? Object.keys(def.UI_TYPES) : []).forEach((k) => {
      this.data[k] = saved[k] || (def.UI_PORTS && def.UI_PORTS[k]) || "";
    });
    /* 旧配置迁移：起名界面以前借用 recruit（招聘）立绘，已保存过 recruit 自定义图
       而 naming 尚未配置时，继承过来避免丢配置 */
    if (saved.recruit && !saved.naming) this.data.naming = saved.recruit;
    // 已废弃的旧类型不再展示，保存时也会从配置中清掉（游戏已不读取）
    /* 2026-09-03：小鲸鱼评审答题立绘（三态）——EVAL_SHOW.ROLE_PORTS。
     以默认 EVAL_SHOW 为底（含 QA_COUNT/MS_PER_Q…），叠加当前配置，确保 base 保存时不丢非立绘字段 */
    if (!this.evalShow) this.evalShow = {};
    const defEval = (def.EVAL_SHOW && typeof def.EVAL_SHOW === "object") ? def.EVAL_SHOW : {};
    const defRp = (defEval.ROLE_PORTS && typeof defEval.ROLE_PORTS === "object") ? defEval.ROLE_PORTS : {};
    this.evalShow = Object.assign({}, defEval, c.EVAL_SHOW && typeof c.EVAL_SHOW === "object" ? c.EVAL_SHOW : {});
    const curRp = (this.evalShow.ROLE_PORTS && typeof this.evalShow.ROLE_PORTS === "object") ? this.evalShow.ROLE_PORTS : {};
    this.evalShow.ROLE_PORTS = {
      idle: curRp.idle || defRp.idle || "",
      ok: curRp.ok || defRp.ok || "",
      fail: curRp.fail || defRp.fail || "",
    };
    // 加载立绘可选图片列表（character / event 目录），全部就绪后渲染
    await Promise.all(["character", "event"].map(async (d) => {
      try {
        const f = await (await fetch("/api/list-files/" + d)).json();
        this.files[d] = (f.files || []).filter((n) => /\.(webp|png|jpe?g)$/i.test(n));
      } catch (e) {
        this.files[d] = [];
      }
    }));
    this.render();
  },

  deepClone(o) {
    return o === null || typeof o !== "object" ? o : (Array.isArray(o) ? o.map((x) => this.deepClone(x)) :
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, this.deepClone(v)])));
  },

  init() {
    /* 20260829r：分页保存按钮已删，统一走右上角「保存全部」（App.save → syncAllConfigs） */
    this.refresh();
  },

  /* 构建某目录文件的可选项（value = resource/xxx/name.webp） */
  fileOptions(dir) {
    const opts = [];
    (this.files[dir] || []).forEach((n) => {
      opts.push(h("option", { value: "resource/" + dir + "/" + n }, dir + "/" + n));
    });
    return opts.length ? opts : [h("option", { value: "", disabled: "" }, "（该目录暂无图片）")];
  },

  portraitCard(key, meta) {
    const cur = this.data[key] || "";
    const img = h("img", { class: "uport-prev", src: "/" + cur, alt: meta.name });

    // 图片路径输入（可直接手填）
    const pathIn = h("input", { class: "gcf-opt-text", value: cur, placeholder: "resource/.../名字.webp" });
    pathIn.addEventListener("change", () => {
      this.data[key] = pathIn.value.trim();
      img.src = "/" + (this.data[key] || "");
    });

    // 下拉选择已有图片（character + event 分组）
    const sel = h("select", { class: "uport-sel" },
      h("option", { value: "", disabled: "" }, "— 选择已有图片 —"),
      h("optgroup", { label: "resource/character" }, ...this.fileOptions("character")),
      h("optgroup", { label: "resource/event" }, ...this.fileOptions("event")));
    sel.value = cur || "";
    sel.addEventListener("change", () => {
      if (!sel.value) return;
      this.data[key] = sel.value;
      img.src = "/" + sel.value;
      pathIn.value = sel.value;
    });

    // 上传按钮
    const uploadBtn = h("button", { class: "btn btn-sm" }, "⬆ 上传新图");
    const fileIn = h("input", { type: "file", accept: "image/*", hidden: "" });
    fileIn.addEventListener("change", () => {
      if (fileIn.files && fileIn.files[0]) this.upload(key, fileIn.files[0], img, pathIn);
    });
    uploadBtn.addEventListener("click", () => fileIn.click());

    // 浏览选择（resource 各目录缩略图挑选）
    const browseBtn = h("button", { class: "btn btn-sm" }, "📁 浏览");
    browseBtn.addEventListener("click", () => {
      ResPicker.pick(cur, { title: meta.name }).then((p) => {
        if (!p) return;
        this.data[key] = p;
        img.src = "/" + p;
        pathIn.value = p;
        sel.value = p;
      });
    });

    // 恢复默认
    const resetBtn = h("button", { class: "btn btn-sm btn-ghost" }, "恢复默认");
    resetBtn.addEventListener("click", () => {
      const G = window.GameDefaults || {};
      const D = G.base || G;
      const d = (D.UI_PORTS && D.UI_PORTS[key]) || "";
      this.data[key] = d;
      img.src = "/" + d;
      pathIn.value = d;
      sel.value = d || "";
    });

    return h("div", { class: "uport-card" },
      h("div", { class: "uport-card-head" },
        img,
        h("div", { class: "uport-title" },
          h("div", { class: "uport-name" }, `${meta.icon || ""} ${meta.name}`),
          h("div", { class: "uport-desc" }, meta.desc || "游戏该界面使用的鲸鱼娘立绘"))),
      h("div", { class: "uport-row" }, pathIn, sel, browseBtn, uploadBtn, fileIn, resetBtn));
  },

  async upload(key, file, img, pathIn) {
    try {
      const dataUrl = await UIPortraitTool.readFile(file);
      const r = await fetch("/api/compress", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ filename: file.name, dataUrl, cutout: false, cutoutMode: "auto", outDir: "event", outName: key + ".webp" }] }),
      });
      const d = await r.json();
      const res = (d.results || [])[0];
      if (!res || !res.ok) { UI.toast("上传失败：" + (res && res.error || "未知"), "err"); return; }
      this.data[key] = res.outPath;
      img.src = "/" + res.outPath;
      pathIn.value = res.outPath;
      UI.toast("已上传并压缩：" + res.outPath);
    } catch (e) {
      UI.toast("上传失败：" + e.message, "err");
    }
  },

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /* 小鲸鱼答题演出立绘卡片：三态（idle 等待&答题 / ok 答对 / fail 答错）并列配置 */
  rolePortsCard() {
    const grid = h("div", { class: "uport-grid uport-grid3" },
      this.rolePortCard("idle", { name: "等待 & 答题" }),
      this.rolePortCard("ok", { name: "答对" }),
      this.rolePortCard("fail", { name: "答错" }));
    return h("div", { class: "uport-card uport-role-card" },
      h("div", { class: "uport-card-head" },
        h("div", { class: "uport-title" },
          h("div", { class: "uport-name" }, "🐳 小鲸鱼答题演出立绘（三态）"),
          h("div", { class: "uport-desc" }, "内部评审答题界面：模型回答以小鲸鱼气泡包装，按空闲(等待&答题) / 答对 / 答错三态切换立绘"))),
      grid);
  },

  /* 单态立绘编辑：预览 + 手填路径 + 选择已有图 + 浏览 + 上传 + 恢复默认（作用于 EVAL_SHOW.ROLE_PORTS[key]） */
  rolePortCard(key, meta) {
    const rp = this.evalShow.ROLE_PORTS || (this.evalShow.ROLE_PORTS = {});
    const cur = rp[key] || "";
    const img = h("img", { class: "uport-prev", src: "/" + cur, alt: meta.name });

    const pathIn = h("input", { class: "gcf-opt-text", value: cur, placeholder: "resource/.../名字.webp" });
    pathIn.addEventListener("change", () => { rp[key] = pathIn.value.trim(); img.src = "/" + rp[key]; });

    const sel = h("select", { class: "uport-sel" },
      h("option", { value: "", disabled: "" }, "— 选择已有图片 —"),
      h("optgroup", { label: "resource/character" }, ...this.fileOptions("character")),
      h("optgroup", { label: "resource/event" }, ...this.fileOptions("event")));
    sel.value = cur || "";
    sel.addEventListener("change", () => {
      if (!sel.value) return;
      rp[key] = sel.value; img.src = "/" + sel.value; pathIn.value = sel.value;
    });

    const uploadBtn = h("button", { class: "btn btn-sm" }, "⬆ 上传新图");
    const fileIn = h("input", { type: "file", accept: "image/*", hidden: "" });
    fileIn.addEventListener("change", () => {
      if (fileIn.files && fileIn.files[0]) this.uploadRole(key, fileIn.files[0], img, pathIn);
    });
    uploadBtn.addEventListener("click", () => fileIn.click());

    const browseBtn = h("button", { class: "btn btn-sm" }, "📁 浏览");
    browseBtn.addEventListener("click", () => {
      ResPicker.pick(cur, { title: meta.name }).then((p) => {
        if (!p) return;
        rp[key] = p; img.src = "/" + p; pathIn.value = p; sel.value = p;
      });
    });

    const resetBtn = h("button", { class: "btn btn-sm btn-ghost" }, "恢复默认");
    resetBtn.addEventListener("click", () => {
      const G = window.GameDefaults || {};
      const D = G.base || G;
      const d = (D.EVAL_SHOW && D.EVAL_SHOW.ROLE_PORTS && D.EVAL_SHOW.ROLE_PORTS[key]) || "";
      rp[key] = d; img.src = "/" + d; pathIn.value = d; sel.value = d || "";
    });

    return h("div", { class: "uport-card uport-role-item" },
      h("div", { class: "uport-card-head" },
        img,
        h("div", { class: "uport-title" },
          h("div", { class: "uport-name" }, `${meta.icon || "🐳"} ${meta.name}`),
          h("div", { class: "uport-desc" }, `评审答题 · ${meta.name} 小鲸鱼立绘`))),
      h("div", { class: "uport-row" }, pathIn, sel, browseBtn, uploadBtn, fileIn, resetBtn));
  },

  /* 上传评审立绘：压缩写 resource/event/，命名 role_<key>.webp 避免覆盖 */
  async uploadRole(key, file, img, pathIn) {
    try {
      const dataUrl = await UIPortraitTool.readFile(file);
      const r = await fetch("/api/compress", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ filename: file.name, dataUrl, cutout: false, cutoutMode: "auto", outDir: "event", outName: "role_" + key + ".webp" }] }),
      });
      const d = await r.json();
      const res = (d.results || [])[0];
      if (!res || !res.ok) { UI.toast("上传失败：" + (res && res.error || "未知"), "err"); return; }
      (this.evalShow.ROLE_PORTS || (this.evalShow.ROLE_PORTS = {}))[key] = res.outPath;
      img.src = "/" + res.outPath;
      pathIn.value = res.outPath;
      UI.toast("已上传并压缩：" + res.outPath);
    } catch (e) {
      UI.toast("上传失败：" + e.message, "err");
    }
  },

  render() {
    const wrap = $("#ui-portrait-list");
    if (!wrap) return;
    UI.clear(wrap);
    // 小鲸鱼答题演出立绘（三态：等待&答题/答对/答错）——独立卡片，位于最上方
    wrap.append(this.rolePortsCard());
    // 立绘配置项（naming/prologue/chat/over/fixed），顺序由 GameDefaults.base.UI_TYPES 决定
    const G = window.GameDefaults || {};
    const T = ((G.base || G).UI_TYPES) || {};
    const grid = h("div", { class: "uport-grid" });
    Object.keys(this.data).forEach((k) => {
      grid.append(this.portraitCard(k, T[k] || { name: k, icon: "🖼", cls: "u-fixed" }));
    });
    wrap.append(grid);
  },

  /* 保存（silent=由右上角「保存全部」统一调用；失败抛错由 App 汇总） */
  async save({ silent = false } = {}) {
    try {
      const r = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "UI_PORTS", config: this.deepClone(this.data),
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      if (window.CfgSync) CfgSync.update(d.mtime);
      // 小鲸鱼评审答题立绘：EVAL_SHOW 只提交本页管辖的 ROLE_PORTS 子键（2026-09-06）。
      // 服务端 base 分支现为「对象递归合并」——玩法配置页维护的演出节奏/答对率参数
      // 不会被这里冲掉，反之这里的三态立绘也不会被玩法配置页整对象覆盖（根治跨页互踩）。
      const r2 = await fetch("/api/game-cfg-save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "base",
                               config: { EVAL_SHOW: { ROLE_PORTS: this.deepClone((this.evalShow || {}).ROLE_PORTS || {}) } },
                               expectMtime: window.CfgSync ? CfgSync.expect() : undefined }),
      });
      const d2 = await r2.json();
      if (!d2.ok) throw new Error("小鲸鱼答题立绘：" + (d2.error || "未知错误"));
      if (window.CfgSync) CfgSync.update(d2.mtime);
      if (!silent) UI.toast("界面立绘 + 小鲸鱼答题立绘已保存并同步到游戏");
    } catch (e) {
      if (silent) throw e;
      UI.toast("保存失败：" + e.message, "err");
    }
  },
};