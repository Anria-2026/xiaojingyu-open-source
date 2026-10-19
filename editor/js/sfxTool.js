/* ==========================================================================
   音效配置页
   --------------------------------------------------------------------------
   - 事件 → 音效文件映射（空 = 内置程序化音效）
   - 平台状态探测：● ElevenLabs（在线 API） / ● 本地 Stable Audio 模型
   - AI 生成 → 试听 → 静音检测提示 → 应用到事件 → 一键保存并同步游戏运行时
   参考《07-可复用经验沉淀-下一项目.md》§9：生成来源与编码/落盘/应用解耦，
   前端产出文件后统一走本地服务器落盘，再自动刷新资源清单。
   ========================================================================== */
"use strict";

const SFXTool = {
  /* 与运行时事件对应；保留奖励号角和旧木槌映射，加载编辑器时不丢失已有音效配置。 */
  events: ["move", "click", "ui", "confirm", "float", "fanfare", "hammer",
    "hammerSwing", "hammerHit", "hammerFire", "hammerToken", "hammerWrong", "hammerEmpty",
    "sort_grab", "sort_swipe", "sort_correct", "sort_gold", "sort_wrong", "sort_miss", "rice_bite", "rice_yue",
    "rice_catch", "rice_gold", "rice_rainbow", "rice_black", "care-wand", "embodiedAwaken", "embodiedNews", "embodiedLive"],
  labels: { "care-wand": "小鲸鱼托管 · 魔法棒", embodiedAwaken: "具身智能 · 开智出舱", embodiedNews: "具身评审 · 头条新闻", embodiedLive: "具身评审 · Live 庆典", move: "移动", click: "点击", ui: "弹窗", confirm: "确认", float: "产出冒数字", fanfare: "奖励号角", hammer: "木槌（兼容旧配置）",
    hammerSwing: "清除幻觉 · 挥槌", hammerHit: "清除幻觉 · 击中", hammerFire: "清除幻觉 · 破防", hammerToken: "清除幻觉 · 金标",
    hammerWrong: "清除幻觉 · 误伤", hammerEmpty: "清除幻觉 · 敲空",
    sort_grab: "语料分拣 · 拿起", sort_swipe: "语料分拣 · 投递", sort_correct: "语料分拣 · 分对",
    sort_gold: "语料分拣 · 精标", sort_wrong: "语料分拣 · 分错", sort_miss: "语料分拣 · 漏卡",
    rice_bite: "鲸鱼娘 · 吃一口饭", rice_yue: "鲸鱼娘 · 好难吃",
    rice_catch: "拯救大白饭 · 接到白米", rice_gold: "拯救大白饭 · 金米加时", rice_rainbow: "拯救大白饭 · 彩米磁吸", rice_black: "拯救大白饭 · 接到黑米" },
  /* 每个事件预置的英文生成提示词（ElevenLabs / 本地模型通用，写详细成功率更高） */
  prompts: {
    "care-wand": "Gentle ascending three-note magical star chime, soft airy shimmer, caring friendly whale mascot, less than one second, no voice",
    embodiedAwaken: "Soft futuristic capsule activation, rising warm electronic hum then four crystalline ascending chimes, joyful awakening, one second, no alarm or voice",
    embodiedNews: "Bright concise technology news success jingle, four ascending rounded notes and a tiny camera shutter, blue-white anime game, one second, no voice",
    embodiedLive: "Short uplifting anime concert victory sting, warm major chord, sparkling rising melody and soft rhythmic percussion, under two seconds, no voice",
    move: "Cute soft cartoon hop, a small bouncy jump with a light playful boing, short single impact, cheerful, kawaii game sound effect",
    click: "Crisp clean UI click, a gentle tap, short digital interface confirmation, bright and cheerful, soft tactile feel",
    ui: "Soft UI panel pop, a light whoosh with a bouncy settle, warm and friendly game menu window sound",
    confirm: "Cheerful two-note confirmation chime, bright ascending ding-ding, positive and satisfying, cartoon game UI",
    float: "Bright coin ding, a quick sparkling two-note ascending chime like collecting points, light and satisfying, cute game score pop-up",
    fanfare: "Short cheerful reward fanfare, four ascending notes with a sparkling final chime, warm cute game celebration, no voice or music bed",
    hammer: "Small wooden toy mallet knock, soft low body and a crisp light tap, single cute cartoon impact, no harsh metal",
    hammerSwing: "Very short soft airy toy mallet swoosh, gently accelerating, a light playful swing before impact, no voice or impact",
    hammerHit: "Satisfying compact wooden toy mallet bonk with a crisp tiny snap and soft low body, one cute cartoon impact, no harsh noise",
    hammerFire: "Firm short toy mallet impact with a soft crunchy shield crack, playful heavier knock, no explosion or harsh distortion",
    hammerToken: "Soft mallet tap followed by two bright ascending golden token chimes, short sparkling reward, cute friendly game sound",
    hammerWrong: "Soft dull toy mallet thud and a gentle descending bloop, friendly mistake feedback, short and restrained, no voice",
    hammerEmpty: "Tiny dry wooden tap on an empty pad, soft hollow knock, short and subtle, no ringing or echo",
    sort_grab: "Very short soft paper pickup rustle, a light fingertip lifting a small card, dry tactile detail, no voice or music",
    sort_swipe: "Short smooth paper card swish sliding into a tray, crisp but soft paper texture, quick satisfying motion, no chime",
    sort_correct: "Two light ascending confirmation chimes, clean rounded tones, a satisfying small successful filing action, short cute game sound",
    sort_gold: "Three delicate ascending golden chimes with a brief sparkle, precious high quality card reward, joyful and light, no music bed",
    sort_wrong: "Two gentle descending rounded tones, friendly wrong sorting feedback, short restrained and non alarming, no buzz or voice",
    sort_miss: "Soft short descending bloop, subtle missed card reminder, mellow and unobtrusive, no harsh alarm or voice",
    rice_bite: "Tiny soft cartoon bite of fluffy cooked rice, gentle muffled mouth pop and a delicate grain rustle, cute and dry, under a quarter second, no wet chewing or voice",
    rice_yue: "Short gentle cartoon yuck reaction, two low rounded descending bloops with a small wobble, playful and restrained, under a third second, no actual vomiting, harsh buzz or voice",
    rice_catch: "Tiny fluffy rice grain landing in a porcelain bowl, soft dry plip with one rounded cheerful note, very short and delicate, no harsh clink, voice or music",
    rice_gold: "Two warm sparkling golden chimes as a precious rice grain lands in a small bowl, gentle ascending reward, under a third second, no voice or music bed",
    rice_rainbow: "Three soft magical ascending aqua chimes for a rainbow rice power up, rounded and sparkling, brief playful magnet activation, no loud sweep or voice",
    rice_black: "Soft low descending bloop with a tiny muted tap for catching a bad rice grain, friendly mistake feedback, restrained and brief, no alarm, harsh buzz or voice",
  },
  files: [],            // 已应用音效
  tmp: [],              // 生成待定（临时）
  cfg: { events: {}, volumes: {} },  // event -> 文件名；event -> 音量倍率（2026-09-02 新增）
  status: null,
  curEvent: "move",
  /* [feature:sfx-candidate-ui-1] */
  candidates: {},       // Stable candidate -> its generation-time target event.
  selectedCandidate: "",
  generating: false,
  applying: false,
  message: null,
  previewPlayer: null,
  /* [/feature:sfx-candidate-ui-1] */

  async init() {
    await this.load();
    /* [feature:sfx-candidate-ui-2] */
    if (!this._bound) {
      $("#sfx-generate").addEventListener("click", () => this.generate());
      $("#sfx-platform").addEventListener("change", () => this.syncPlatformUI());
      this._bound = true;
    }
    /* [/feature:sfx-candidate-ui-2] */

    // 生成事件选择：每个事件对应不同的预置英文提示词
    // （选项已静态写在 index.html，这里只做兜底补齐 + 绑定事件）
    const evSel = $("#sfx-event");
    if (evSel) {
      const existing = new Set(Array.from(evSel.options, (option) => option.value));
      this.events.forEach((e) => {
        if (!existing.has(e)) evSel.append(h("option", { value: e }, `${this.labels[e] || e}（${e}）`));
      });
      evSel.value = this.curEvent;
      evSel.addEventListener("change", () => {
        this.curEvent = evSel.value;
        this.fillPrompt();
        /* [feature:sfx-candidate-ui-3] */
        this.renderTmp();
        /* [/feature:sfx-candidate-ui-3] */
      });
    }
    this.fillPrompt();
    this.syncPlatformUI();
    this.render();
  },

  /* 切换事件时同步行内状态（供外部调用） */
  setEvent(ev) {
    if (!this.events.includes(ev)) return;
    this.curEvent = ev;
    const evSel = $("#sfx-event");
    if (evSel) evSel.value = ev;
    this.fillPrompt();
  },

  /* 预填当前事件的英文提示词（用户可再自行修改） */
  fillPrompt() {
    const p = $("#sfx-prompt");
    if (p && this.prompts[this.curEvent]) p.value = this.prompts[this.curEvent];
  },

  /* 程序化合成无需时长/强度参数 → 隐藏对应控件，界面更清晰 */
  syncPlatformUI() {
    const synth = $("#sfx-platform").value === "synth";
    document.querySelectorAll(".sfx-ai-only").forEach((el) => {
      el.style.display = synth ? "none" : "";
    });
    const hint = $("#sfx-synth-hint");
    if (hint) hint.style.display = synth ? "" : "none";
  },

  /* 切到音效 tab 时刷新数据（生成/应用后即时可见） */
  async refresh() {
    await this.load();
    this.render();
  },

  async load() {
    try {
      const [st, files, tmp, cfg, sc] = await Promise.all([
        fetch("/api/sfx-status").then((r) => r.json()),
        fetch("/api/sfx-list").then((r) => r.json()),
        fetch("/api/sfx-list-tmp").then((r) => r.json()),
        fetch("/api/sfx-config").then((r) => r.json()),
        fetch("/api/server-config").then((r) => r.json()),
      ]);
      this.status = st;
      this.files = files.files || [];
      /* [feature:sfx-candidate-ui-4] */
      this.mergeTmp(tmp.files || []);
      /* [/feature:sfx-candidate-ui-4] */
      this.cfg = cfg || { events: {} };
      if (!this.cfg.events) this.cfg.events = {};
      /* 2026-09-02：每个事件单独的音量（0~1），缺省 1 = 不额外衰减 */
      if (!this.cfg.volumes) this.cfg.volumes = {};
      this.srvCfg = sc || {};
      this.events.forEach((e) => {
        if (!this.cfg.events[e]) this.cfg.events[e] = "";
        if (this.cfg.volumes[e] == null) this.cfg.volumes[e] = 1;
      });
      Object.keys(this.cfg.volumes).forEach((k) => {
        if (!this.events.includes(k)) delete this.cfg.volumes[k];   // 清掉废弃事件
      });
      /* 清理已废弃事件的残留映射（jump/land 等旧 key 不再保存回配置） */
      Object.keys(this.cfg.events).forEach((k) => {
        if (!this.events.includes(k)) delete this.cfg.events[k];
      });
      $("#sfx-local-url").value = (sc && sc.local_sfx_url) || "http://127.0.0.1:7861";
    } catch (e) {
      /* [feature:sfx-candidate-ui-5] */
      this.message = h("div", { class: "err" }, "音效数据暂时无法刷新，已保留现有候选。");
      /* [/feature:sfx-candidate-ui-5] */
    }
    this.renderStatus();
    /* [feature:sfx-candidate-ui-6] */
    this.renderTmp();
    /* [/feature:sfx-candidate-ui-6] */
  },

  renderStatus() {
    const el = $("#sfx-status");
    if (!this.status) { el.textContent = "平台状态不可用"; el.className = "sfx-status err"; return; }
    const el1 = this.status.elevenlabs && this.status.elevenlabs.configured;
    const loc = this.status.local && this.status.local.online;
    el.textContent = `● ElevenLabs ${el1 ? "已配置" : "未配置 Key"}　·　● 本地模型 ${loc ? "在线" : "离线"}`;
    el.className = "sfx-status " + (el1 || loc ? "ok" : "");
  },

  render() {
    const tbody = $("#sfx-list");
    UI.clear(tbody);
    this.events.forEach((e) => tbody.append(this.row(e)));
  },

  row(ev) {
    const sel = h("select", { class: "cell-input" });
    sel.append(h("option", { value: "" }, "（内置程序化音效）"));
    this.files.forEach((f) => sel.append(h("option", { value: f }, f)));
    sel.value = this.cfg.events[ev] || "";
    sel.addEventListener("change", () => {
      this.cfg.events[ev] = sel.value;
      this.render();
    });

    /* 音量：0~100% 滑条，右键/双击数值可回到 100% */
    const volWrap = h("div", { class: "sfx-vol" });
    const volRange = h("input", {
      type: "range", min: "0", max: "100", step: "5",
      value: String(Math.round((this.cfg.volumes[ev] != null ? this.cfg.volumes[ev] : 1) * 100)),
      oninput: (e2) => {
        this.cfg.volumes[ev] = (+e2.target.value) / 100;
        volVal.textContent = e2.target.value + "%";
      },
    });
    const volVal = h("b", { class: "sfx-vol-val" }, Math.round((this.cfg.volumes[ev] != null ? this.cfg.volumes[ev] : 1) * 100) + "%");
    volWrap.append(volRange, volVal);

    const listenBtn = h("button", { class: "btn btn-sm btn-ghost", onclick: () => this.preview(this.cfg.events[ev], ev) }, "▶ 试听");
    if (!this.cfg.events[ev]) listenBtn.disabled = true;

    const genBtn = h("button", {
      class: "btn btn-sm",
      onclick: () => {
        this.setEvent(ev);              // 生成栏事件选择跟随行 + 预填英文提示词
        $("#sfx-prompt").focus();
      },
    }, "✨ 生成到此事件");

    const ops = h("td", {}, h("div", { class: "sfx-ops" }, listenBtn, genBtn));

    return h("tr", {},
      /* ⚠️ 2026-09-11 修：原来这里把 HTML 字符串当文本子节点传给了 h()——
         h() 对字符串是 createTextNode，于是表格里原样显示 `移动 <span class="dim">move</span>`。
         要的是**元素**，就得建元素（不是拼字符串）。 */
      h("td", { class: "sfx-ev" }, this.labels[ev] || ev, " ", h("span", { class: "dim" }, ev)),
      h("td", {}, sel),
      h("td", {}, volWrap),
      ops,
    );
  },

  /* [feature:sfx-candidate-ui-7] */
  candidateEvent(name) {
    return this.candidates[name]?.event || this.events.slice().sort((a,b)=>b.length-a.length).find(event=>name.startsWith(event+"_")) || "";
  },

  mergeTmp(names, generated = null) {
    for (const name of Array.isArray(names) ? names : []) {
      if (typeof name !== "string" || !name) continue;
      if (!this.tmp.includes(name)) this.tmp.push(name);
      if (!this.candidates[name]) this.candidates[name] = {name, event:this.candidateEvent(name)};
    }
    if (generated?.name) this.candidates[generated.name] = {...this.candidates[generated.name],...generated};
  },

  /* Each request adds a candidate. Merely generating/playing never applies it. */
  /* [/feature:sfx-candidate-ui-7] */
  async generate() {
    /* [feature:sfx-candidate-ui-8] */
    if (this.generating || this.applying) return;
    const btn = $("#sfx-generate"), platform = $("#sfx-platform").value;
    const req = {platform, event:this.curEvent, prompt:$("#sfx-prompt").value,
      duration:+$("#sfx-duration")?.value || 3,
      influence:$("#sfx-influence")?.value === "" ? .3 : Number($("#sfx-influence")?.value ?? .3)};
    this.generating = true; btn.disabled = true; btn.textContent = "生成中…";this.renderTmp();
    /* [/feature:sfx-candidate-ui-8] */
    try {
      /* [feature:sfx-candidate-ui-9] */
      const response = await fetch(platform === "synth" ? "/api/sfx-synth" : "/api/sfx-generate", {
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(req)});
      const result = await response.json();
      if (!result.ok || !result.name) throw Error(result.error || "没有返回候选音效");
      this.mergeTmp([...(result.list || []),result.name], {name:result.name,event:req.event,platform:req.platform,prompt:req.prompt});
      this.showResult(h("div", {class:"ok"}, "已增加候选，试听对比后选择一个应用。"));
    } catch (error) {
      this.showResult(h("div", {class:"err"}, "生成失败："+error.message));
      /* [/feature:sfx-candidate-ui-9] */
    } finally {
      /* [feature:sfx-candidate-ui-10] */
      this.generating = false;btn.disabled = false;btn.textContent = "✨ 生成";this.renderTmp();
      /* [/feature:sfx-candidate-ui-10] */
    }
  },

  /* [feature:sfx-candidate-ui-11] */
  selectCandidate(name) {
    if (this.applying || !this.tmp.includes(name)) return false;
    this.selectedCandidate = name;this.renderTmp();return true;
  /* [/feature:sfx-candidate-ui-11] */
  },

  /* [feature:sfx-candidate-ui-12] */
  renderTmp() {
    const wrap = $("#sfx-result");if (!wrap) return;
  /* [/feature:sfx-candidate-ui-12] */
    UI.clear(wrap);
    /* [feature:sfx-candidate-ui-13] */
    if (this.message) wrap.append(this.message);
    wrap.append(h("div", {class:"sfx-candidate-heading"}, "待选音效", h("span", {class:"dim"}, this.tmp.length+" 个候选")));
    if (!this.tmp.length) {wrap.append(h("div", {class:"dim"}, "生成后逐个试听，选择一个再应用。"));return;}
    const list = h("div", {class:"sfx-candidate-list"});
    this.tmp.forEach((name,index)=>{
      const candidate=this.candidates[name]||{},event=this.candidateEvent(name),selected=name===this.selectedCandidate;
      const radio=h("input",{type:"radio",name:"sfx-candidate",value:name,"aria-label":"选择候选 "+(index+1),onchange:()=>this.selectCandidate(name)});
      radio.checked=selected;radio.disabled=this.applying;
      const info=h("span",{class:"sfx-candidate-copy"},h("strong",{},"候选 "+(index+1)+" · "+(this.labels[event]||event||"未识别目标")),h("small",{title:name},name));
      const choose=h("label",{class:"sfx-candidate-choice"},radio,info);
      const listen=h("button",{type:"button",class:"btn btn-sm btn-ghost","data-sfx-candidate-listen":name,onclick:()=>this.previewTmp(name)},this._playingName===name?"试听中…":"试听");
      const remove=h("button",{type:"button",class:"btn btn-sm btn-ghost sfx-candidate-delete","data-sfx-candidate-delete":name,onclick:()=>this.delTmp(name)},"删除");remove.disabled=this.applying;
      const row=h("div",{class:"sfx-tmp-item sfx-candidate"+(selected?" is-selected":""),"data-sfx-candidate":name,"data-sfx-event":event},choose,listen,remove);
      if(candidate.applied)info.append(h("em",{},"已应用"));list.append(row);
    });
    wrap.append(list);
    const selected=this.selectedCandidate,event=selected&&this.candidateEvent(selected);
    const apply=h("button",{type:"button",class:"btn btn-primary btn-sm","data-sfx-apply-selected":"1",onclick:()=>this.applyTmp(this.selectedCandidate)},this.applying?"应用中…":"应用所选");
    apply.disabled=!selected||!event||this.generating||this.applying;
    wrap.append(h("div",{class:"sfx-candidate-apply"},h("span",{class:"dim"},event?"所选候选将应用到「"+(this.labels[event]||event)+"」":"请选择一个候选；应用目标沿用生成时的事件。"),apply));
    /* [/feature:sfx-candidate-ui-13] */
  },

  /* [feature:sfx-candidate-ui-14] */
  showResult(node) {this.message=node;this.renderTmp();},

  /* [/feature:sfx-candidate-ui-14] */
  async applyTmp(name) {
    /* [feature:sfx-candidate-ui-15] */
    if(this.applying||this.generating)return false;
    const event=this.candidateEvent(name||"");
    if(!name||name!==this.selectedCandidate||!this.tmp.includes(name)||!event){this.showResult(h("div",{class:"err"},"请先选择一个候选再应用。"));return false;}
    this.applying=true;this.renderTmp();
    /* [/feature:sfx-candidate-ui-15] */
    try {
      /* [feature:sfx-candidate-ui-16] */
      const response=await fetch("/api/sfx-apply-tmp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,event})});
      const result=await response.json();if(!result.ok)throw Error(result.error||"应用失败");
      this.cfg.events[event]=result.file;this.candidates[name].applied=result.file;
      await this.load();this.render();this.showResult(h("div",{class:"ok"},"已应用到「"+(this.labels[event]||event)+"」："+result.file));return true;
    }catch(error){this.showResult(h("div",{class:"err"},"应用失败："+error.message));return false;}
    finally{this.applying=false;this.renderTmp();}
      /* [/feature:sfx-candidate-ui-16] */
  },

  async delTmp(name) {
    /* [feature:sfx-candidate-ui-17] */
    if(this.applying)return;
    /* [/feature:sfx-candidate-ui-17] */
    try {
      /* [feature:sfx-candidate-ui-18] */
      const response=await fetch("/api/sfx-pending",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",name})});
      const result=await response.json();if(!result.ok)throw Error(result.error||"删除失败");
      this.tmp=this.tmp.filter(item=>item!==name);delete this.candidates[name];
      if(this.selectedCandidate===name)this.selectedCandidate="";
      if(this._playingName===name)this.stopPreview();this.renderTmp();
    }catch(error){this.showResult(h("div",{class:"err"},"删除失败："+error.message));}
      /* [/feature:sfx-candidate-ui-18] */
  },

  /* [feature:sfx-candidate-ui-19] */
  stopPreview() {this.previewPlayer?.pause();this.previewPlayer=null;this._playingName="";},

  playPreview(url,event,name="") {
    this.stopPreview();const player=new Audio(url);this.previewPlayer=player;this._playingName=name;
    const volume=this.cfg.volumes?.[event];player.volume=Math.max(0,Math.min(1,volume!=null?Number(volume):.9));
    player.onended=()=>{if(this.previewPlayer===player){this.stopPreview();this.renderTmp();}};
    player.onerror=()=>{if(this.previewPlayer===player){this.stopPreview();this.showResult(h("div",{class:"err"},"音频暂时无法播放，可选择其他候选试听。"));}};
    Promise.resolve(player.play()).catch(()=>player.onerror());this.renderTmp();return player;
  /* [/feature:sfx-candidate-ui-19] */
  },

  /* [feature:sfx-candidate-ui-20] */
  preview(file,event) {if(file)return this.playPreview("/resource/sound/sfx/"+encodeURIComponent(file),event);},
  previewTmp(name) {if(this.tmp.includes(name))return this.playPreview("/resource/sound/sfx-preview/"+encodeURIComponent(name),this.candidateEvent(name),name);},
  /* [/feature:sfx-candidate-ui-20] */

  /* 保存事件映射 → 服务端写 sfx_config.json 并同步游戏运行时
     （silent=由右上角「保存全部」统一调用；失败抛错由 App 汇总） */
  async save({ silent = false } = {}) {
    try {
      const r = await fetch("/api/sfx-save-config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: this.cfg.events, volumes: this.cfg.volumes }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "未知错误");
      if (!silent) this.showResult(h("div", { class: "ok" }, "音效配置已保存并同步游戏"));
    } catch (e) {
      if (silent) throw e;
      this.showResult(h("div", { class: "err" }, "保存失败：" + e.message));
    }
  },

  /* 保存平台配置（Key 只存服务端；silent=由右上角「保存全部」在输入框有值时顺带提交） */
  async saveServerCfg({ silent = false } = {}) {
    try {
      const r = await fetch("/api/save-server-config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elevenlabs_api_key: $("#sfx-key").value.trim(),
          local_sfx_url: $("#sfx-local-url").value.trim(),
        }),
      });
      const d = await r.json();
      $("#sfx-key").value = "";
      if (!d.ok) throw new Error(d.error || "保存失败");
      if (!silent) this.showResult(h("div", { class: "ok" }, "平台配置已保存"));
      await this.load();
    } catch (e) {
      if (silent) throw e;
      this.showResult(h("div", { class: "err" }, "保存失败：" + e.message));
    }
  },
};

/* 显式暴露：顶层 const 不挂 window，显式导出避免「window.SFXTool 为 undefined」的坑 */
window.SFXTool = SFXTool;
