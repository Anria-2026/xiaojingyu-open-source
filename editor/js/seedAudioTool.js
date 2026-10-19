/* SeedAudio 逐句剧情配音。生成/试听/裁剪为草稿；显式应用才回写对白 voice。 */
"use strict";

const SeedAudioTool = {
  status: null,
  job: null,
  busy: false,
  saved: null,
  player: null,
  configuring: false,
  selectedId: "",
  lines: [],
  target: null,
  candidates: [],
  selectedCandidateId: "",
  draftStorageKey: "whale-editor-seed-audio-candidates-v1",
  presets: {
    10: { reference: "总可以了吧.wav", prompt: "10岁女孩，清澈稚嫩、好奇亲切，保留参考人物声线，自然口语，轻快但不尖锐。" },
    15: { reference: "干嘛老板.wav", prompt: "15岁少女，青春清亮、真诚活泼，保留参考人物声线，自然口语，带一点期待。" },
    20: { reference: "干嘛老板.wav", prompt: "20岁年轻女性，温暖清晰、自信自然，保留参考人物声线，日常交谈感。" },
    25: { reference: "干嘛老板.wav", prompt: "25岁女性，保留参考人物声线，更成熟沉稳，语气温柔笃定，节奏舒缓，收敛少女感，避免夸张与尖细。" },
  },
  form: { text: "", age: 20, prompt: "", reference: "", format: "mp3", speech_rate: 0,
    pitch_rate: 0, loudness_rate: 0, watermark: false, filename: "story_age20.mp3",
    cropStart: "", cropEnd: "", trimSilence: false, silencePadMs: 60, bitrate: 96, candidateCount: 1 },

  async init() {
    this.box = document.querySelector("#seed-audio-box");
    if (!this.box || this._initialized) return;
    this._initialized = true;
    if (!this.form.reference) this.setAge(this.form.age);
    this.restoreCandidates();
    window.addEventListener("beforeunload", () => { this.keepCandidate(); this.persistCandidates(); this.flushLineDrafts(true); });
    window.addEventListener("pagehide", () => { this.keepCandidate(); this.persistCandidates(); this.flushLineDrafts(true); });
    this.render();
    await this.refresh();
  },

  async refresh() {
    if (!this.box) return;
    this.keepCandidate();this.persistCandidates();
    try {
      this.status = await this.api("status");
      /* [feature:seed-audio-reference-empty-refresh] */
      if (!this._lineForms?.[this.selectedId]?.explicit && ((!this.form.reference && !this._noReference) || (this._fallbackPreset && this.form.reference === this._presetValues.reference))) this.setAge(this.form.age);
      /* [/feature:seed-audio-reference-empty-refresh] */
      this.error = "";
    } catch (error) { this.status = null; this.error = error.message; }
    await this.refreshLines();
    await this.refreshLineDrafts();
    await this.refreshCandidates();
    this.render();
  },

  // The existing story editor owns this working copy and its conflict-aware
  // save chain. Reading rows never marks it dirty or saves the source.
  story() { return window.LifeStoryTool?.loaded ? window.LifeStoryTool : null; },
  ageOf(row, inherited = 20) {
    const age = Number(row.age);
    return [10, 15, 20, 25].includes(age) ? age : inherited;
  },
  appearance(age) { return ({ 10: "儿童素体", 15: "少女素体", 20: "青年素体", 25: "成熟素体" })[age] || "剧情对白"; },
  entries() {
    const rows = this.story()?.rows() || [], counts = new Map();
    rows.forEach(row => counts.set(String(row.id || ""), (counts.get(String(row.id || "")) || 0) + 1));
    let age = 20;
    const storyLines = rows.flatMap((row, index) => {
      age = this.ageOf(row, age);
      if (row.type !== "dialogue" || !String(row.text || "").trim()) return [];
      const id = String(row.id || "");
      return [{ id, row, index, age, valid: !!id && counts.get(id) === 1 }];
    });
    const journey = window.JourneyTool;
    if (!journey?.loaded) return storyLines;
    const opening = journey.opening();
    const openingAge = Number(journey.data?.AGES_BY_VER?.V5) || 10;
    const openingLines = (opening.steps || []).flatMap((step, index) => {
      if (!step || !String(step.reply || '').trim()) return [];
      const row = { get text() { return step.reply; }, get voice() { return step.replySrc; }, speaker: '小鲸鱼' };
      return [{ id: 'journey:opening:' + index, row, raw: step, source: 'journey-opening', index, age: openingAge, valid: true }];
    });
    return openingLines.concat(storyLines);
  },
  async refreshLines() {
    this.captureLineForm();
    this.sourceError = "";
    try {
      if (!window.LifeStoryTool) throw new Error("剧情编辑模块未加载，请刷新编辑器。");
      if (!window.LifeStoryTool.loaded) await window.LifeStoryTool.refresh();
      if (window.JourneyTool && !window.JourneyTool.loaded) await window.JourneyTool.refresh();
      if (!this.story()) throw new Error("无法读取剧情台词，请检查编辑器服务并刷新台词列表。");
      this.lines = this.entries();
      const selected = this.lines.find(line => line.id === this.selectedId && line.valid);
      if (!selected) this.choose(this.lines.find(line => line.valid)?.id || "", false);
      else if (this.form.text !== String(selected.row.text) || Number(this.form.age) !== selected.age) this.choose(selected.id, false);
    } catch (error) { this.lines = []; this.sourceError = error.message; }
  },
  current() {
    const matches = this.entries().filter(line => line.valid && line.id === this.selectedId);
    return matches.length === 1 ? matches[0] : null;
  },
  /* 按 id 找回剧本里的那句台词：草稿归属（signature/sourceText）必须来自现存台词，
     否则本地服务会以「逐句配音归属信息无效」拒收，这一句就永远存不上。 */
  lineById(id) { return this.entries().find(line => line.valid && line.id === id) || null; },
  signature(line) {
    if (line.source === 'journey-opening') return JSON.stringify([line.id, String(line.row.text), String(line.raw.option || ''), line.age, line.source]);
    return JSON.stringify([line.id, String(line.row.text), String(line.row.speaker || ""), line.age]);
  },
  choose(id, repaint = true) {
    if (this.busy || this.configuring) return;
    this.keepCandidate();
    this.captureLineForm();
  /* [feature:seed-audio-wave-choose] */
    this.resetClip();
    this.selectedId = String(id); this.saved = null; this.job = null; this.target = null;
    this.selectedCandidateId = "";
  /* [/feature:seed-audio-wave-choose] */
    if (this.player) this.player.pause();
    const line = this.current();
    Object.assign(this.form,{format:"mp3",speech_rate:0,pitch_rate:0,loudness_rate:0,watermark:false,candidateCount:1});this._noReference=false;
    this.form.text = line ? String(line.row.text) : "";
    this.form.prompt = this.form.text;
    if (line) this.setAge(line.age);
    this.form.cropStart = ""; this.form.cropEnd = "";
    this._formLineId=this.selectedId;this._formBaseline=JSON.stringify(this.safeEditForm(this.form));
    this.restoreLineForm();
    this.restoreLineCandidate();
    this.persistCandidates();
    if (repaint) this.render({force:true});
  },
  verifyTarget() {
    const line = this.current();
    if (!line || !this.target || this.target.id !== line.id || !this.sameLineCandidate() || this.signature(line) !== this.target.signature || line.row.voice !== this.target.previousVoice)
      throw new Error("这句台词或配音已被修改/删除，请刷新台词列表后重新生成；当前配置未覆盖。");
    return line;
  },

  async api(route, payload, extra = {}) {
    const options = payload ? { method: "POST", headers: { "Content-Type": "application/json",
      "X-SeedAudio-Token": this.status?.csrfToken || "" }, body: JSON.stringify(payload) }
      : route === "jobs" || route === "line-drafts" || route.startsWith("jobs/") ? { headers: { "X-SeedAudio-Token": this.status?.csrfToken || "" } } : {};
    if(extra.keepalive)options.keepalive=true;
    const entryHint = "请关闭旧编辑器服务，再运行 editor/启动编辑器.bat，并使用它打开的本地编辑器地址进入音效页。";
    let response;
    try { response = await fetch("/api/seed-audio/" + route, options); }
    catch (_) { throw new Error("无法连接本地配音服务。" + entryHint); }
    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error("本地配音接口返回了非 JSON 响应（HTTP " + response.status + "）。" + entryHint); }
    if (response.status === 404 && (route === "status" || route === "credentials"))
      throw new Error("当前编辑器服务未提供配音配置接口。" + entryHint);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("本地配音接口响应格式不正确。" + entryHint);
    if (!response.ok || data.error) { const error = new Error(data.error || "本地音频接口不可用"); error.status = response.status; error.current=data.current; throw error; }
    return data;
  },

  setAge(age) {
    this.form.age = Number(age);
    const preset = this.status?.presets?.[age] || this.presets[age];
    if (preset) {
  /* [feature:seed-audio-reference-preserve] */
      this.form.reference = this._noReference ? "" : preset.reference;
  /* [/feature:seed-audio-reference-preserve] */
      this._fallbackPreset = !this.status?.presets?.[age];
      this._presetValues = { reference: preset.reference };
    }
    this.form.filename = (this.selectedId || "story") + "-review." + this.form.format;
    this._formLineId=this.selectedId;this._formBaseline=JSON.stringify(this.safeEditForm(this.form));
  },

  candidate() { return this.candidates.find(item=>item.job.id===this.job?.id)||null; },
  candidateRows() { return this.candidates.filter(item=>item.target?.id===this.selectedId); },
  unassignedRows() { return this.candidates.filter(item=>!item.target?.id); },
  sameLineCandidate(item = this.candidate()) { return !!item && !item._ownershipConflict && item.target?.id === this.selectedId; },
  safeTarget(value) {
    if(!value||typeof value.id!=="string"||!value.id||typeof value.signature!=="string")return null;
    const target={id:value.id,signature:value.signature};if(typeof value.previousVoice==="string")target.previousVoice=value.previousVoice;return target;
  },
  safeEditForm(value) {
    const form={};if(!value||typeof value!=="object")return form;
    for(const key of ["prompt","reference","format"])if(typeof value[key]==="string")form[key]=value[key];
    for(const key of ["age","speech_rate","pitch_rate","loudness_rate","candidateCount"]){const number=Number(value[key]);if(value[key]!==undefined&&value[key]!==""&&Number.isFinite(number))form[key]=number;}
    if(typeof value.watermark==="boolean")form.watermark=value.watermark;
    return form;
  },
  safeDraft(value) {
    const draft={};if(!value||typeof value!=="object")return draft;
    for(const key of ["filename","format"])if(typeof value[key]==="string")draft[key]=value[key];
    for(const key of ["cropStart","cropEnd","silencePadMs","bitrate"]){if(value[key]==="")draft[key]="";else if(value[key]!==undefined&&Number.isFinite(Number(value[key])))draft[key]=Number(value[key]);}
    if(typeof value.trimSilence==="boolean")draft.trimSilence=value.trimSilence;
    if(value.clipState&&typeof value.clipState.editing==="boolean"){
      draft.clipState={editing:value.clipState.editing,explicit:value.clipState.explicit===true};const selection=value.clipState.selection;
      if(selection&&Number.isFinite(selection.a)&&Number.isFinite(selection.b)&&selection.a>=0&&selection.b<=1&&selection.a<=selection.b)draft.clipState.selection={a:selection.a,b:selection.b};
    }
    if(value.editForm)draft.editForm=this.safeEditForm(value.editForm);
    return draft;
  },
  captureLineForm() {
    if(!this.selectedId||this._formLineId!==this.selectedId)return false;
    const force=arguments[0]===true,form=this.safeEditForm(this.form),fingerprint=JSON.stringify(form),changed=force||fingerprint!==this._formBaseline;
    this._lineForms ||= Object.create(null);
    const row=this._lineForms[this.selectedId] ||= {explicit:false,revision:0,dirty:false,seq:0};
    if(!row.signature&&this.current())row.signature=this.signature(this.current());
    if(changed||!row.explicit){Object.assign(row,form);row.sourceText=String(this.form.text);row.signature=this.current()?this.signature(this.current()):row.signature||"";}
    if(changed){row.explicit=true;row.dirty=true;row.seq=(row.seq||0)+1;row.error="";this.queueLineDraft(this.selectedId);}
    this._formBaseline=fingerprint;return changed;
  },
  restoreLineForm(updateFields = false) {
    const saved=this._lineForms?.[this.selectedId];if(!saved?.explicit)return;
    const form=this.safeEditForm(saved);Object.assign(this.form,form);if(form.reference!==undefined)this._noReference=form.reference==="";
    this._formLineId=this.selectedId;this._formBaseline=JSON.stringify(this.safeEditForm(this.form));
    if(updateFields)for(const input of this.box?.querySelectorAll('[data-seed-field]')||[]){const key=input.dataset.seedField;if(!(key in form)||input.value===String(form[key]))continue;const focused=input===document.activeElement,start=input.selectionStart,end=input.selectionEnd;input.value=String(form[key]);if(focused&&typeof start==="number")try{input.setSelectionRange(Math.min(start,input.value.length),Math.min(end,input.value.length));}catch(_){}}
  },
  restoreCandidateForm(item) {
    this.captureLineForm();const lineForm=this._lineForms?.[this.selectedId];
    Object.assign(this.form,this.safeDraft(item));
    const legacy={...this.safeEditForm({prompt:item.prompt,reference:item.reference}),...this.safeEditForm(item.editForm)};
    if(lineForm?.explicit){let migrated=false;for(const[key,value]of Object.entries(legacy))if(!Object.prototype.hasOwnProperty.call(lineForm,key)){lineForm[key]=value;migrated=true;}if(migrated){lineForm.dirty=true;lineForm.seq=(lineForm.seq||0)+1;this.queueLineDraft(this.selectedId);}Object.assign(this.form,this.safeEditForm(lineForm));}
    else{
      // Old candidate metadata is a migration fallback only. An existing line
      // draft (including an empty prompt) always owns the generation form.
      Object.assign(this.form,legacy);this.captureLineForm(true);
    }
    delete this.form.editForm;delete this.form.clipState;
    if(typeof this.form.reference==="string")this._noReference=this.form.reference==="";
    this._formLineId=this.selectedId;this._formBaseline=JSON.stringify(this.safeEditForm(this.form));
  },

  /* [feature:seed-audio-line-drafts-20261015] */
  lineDraftsReady() { return this.status?.lineDraftsVersion>=1&&!!this.status?.csrfToken; },
  lineRecord(value) {
    if(!value||typeof value.id!=="string"||!value.id||typeof value.signature!=="string"||typeof value.sourceText!=="string"||!value.form||!Number.isInteger(value.revision)||value.revision<1)return null;
    return{id:value.id,signature:value.signature,sourceText:value.sourceText,form:this.safeEditForm(value.form),revision:value.revision,updatedAt:value.updatedAt};
  },
  linePayload(id,row=this._lineForms?.[id]) { const line=this.lineById(id); return{id,signature:row?.signature||(line?this.signature(line):""),sourceText:typeof row?.sourceText==="string"?row.sourceText:(line?String(line.row.text):""),form:this.safeEditForm(row)}; },
  lineFingerprint(value) { return JSON.stringify({signature:value.signature,sourceText:value.sourceText,form:this.safeEditForm(value.form)}); },
  lineCache() {
    const rows=Object.create(null);for(const[id,row]of Object.entries(this._lineForms||{}))rows[id]={...this.safeEditForm(row),sourceText:row.sourceText,signature:row.signature,explicit:row.explicit===true,revision:row.revision||0,dirty:!!row.dirty,seq:row.seq||0};return rows;
  },
  async refreshLineDrafts() {
    if(!this.lineDraftsReady()){this.updateDraftStatus();return;}
    const epoch=this._lineFetchEpoch=(this._lineFetchEpoch||0)+1;
    try{
      const raw=await this.api("line-drafts");if(epoch!==this._lineFetchEpoch)return;
      if(!Array.isArray(raw.drafts))throw Error("逐句草稿响应格式不正确。");
      this.captureLineForm();this._lineForms ||= Object.create(null);
      for(const value of raw.drafts){
        const remote=this.lineRecord(value);if(!remote)throw Error("逐句草稿记录格式不正确。");
        const local=this._lineForms[remote.id],remoteFingerprint=this.lineFingerprint(remote);
        if(local&&(local.revision||0)>remote.revision)continue;
        if(local?.explicit&&local.dirty&&this.lineFingerprint(this.linePayload(remote.id,local))!==remoteFingerprint){
          if((local.revision||0)!==remote.revision){local.conflict=true;local.remote=remote;local.error="本地服务存在另一版草稿";}continue;
        }
        const row=local||{};Object.assign(row,remote.form,{signature:remote.signature,sourceText:remote.sourceText,explicit:true,revision:remote.revision,dirty:false,conflict:false,remote:null,error:""});this._lineForms[remote.id]=row;
        if(this.selectedId===remote.id)this.restoreLineForm(true);
      }
      this._lineLoadError="";this.persistCandidates();this.flushLineDrafts();
    }catch(error){this._lineLoadError=error.message;}
    this.updateDraftStatus();
  },
  queueLineDraft(id) {
    const row=this._lineForms?.[id];if(!row?.explicit||row.conflict)return;
    clearTimeout(row.timer);row.timer=setTimeout(()=>{row.timer=null;this.syncLineDraft(id).catch(()=>{});},350);this.updateDraftStatus();
  },
  async syncLineDraft(id,keepalive=false) {
    const row=this._lineForms?.[id];if(!row?.explicit||!row.dirty||row.conflict||!this.lineDraftsReady())return;
    clearTimeout(row.timer);row.timer=null;
    if(row.promise){row.again=true;row.keepalive=!!(row.keepalive||keepalive);try{await row.promise;}catch(_){}return;}
    const payload=this.linePayload(id,row),fingerprint=this.lineFingerprint(payload),seq=row.seq,revision=row.revision||0;
    /* 归属信息（id/signature/sourceText）缺一不可：本地服务会直接以「逐句配音归属信息无效」拒收。
       本地缓存里旧稿可能没有 signature（旧版迁移、剧本改过 id），以前会一发就被拒、这句永远存不上，
       「保存全部」于是每次都失败。现在统一从现存台词补回，补不回来就给出明确原因而不是空发请求。 */
    if(!payload.signature){row.dirty=true;row.error="这句台词已不在当前剧本里（或台词列表还没加载完），草稿无法归属；请刷新台词列表后重试。";this.updateDraftStatus();return;}
    if(!row.signature)row.signature=payload.signature;
    row.error="";row.keepalive=keepalive;
    row.promise=(async()=>{
      const response=await this.api("line-drafts",{...payload,expectedRevision:revision},{keepalive}),record=this.lineRecord(response.draft);
      if(!record||record.id!==id||record.revision<=revision||this.lineFingerprint(record)!==fingerprint)throw Error("逐句草稿保存响应不匹配。");
      row.revision=record.revision;row.updatedAt=record.updatedAt;row.error="";row._revisionReset=false;
      if(row.seq===seq&&this.lineFingerprint(this.linePayload(id,row))===fingerprint)row.dirty=false;
    })();this.updateDraftStatus();
    try{await row.promise;}catch(error){row.dirty=true;row.error=error.message;
      /* 409 有两种：服务端确有另一版草稿（current 可读）与服务端没有这条草稿（文件缺失/不可读）。
         旧代码一律置 conflict —— 后者会让本地稿永远卡在冲突，且因为 remote 为空连「载入服务端稿」
         按钮都点不了，「保存全部」于是每次都报「尚未全部同步」。现在：没有旧稿时把本地稿当作新建
         （版本归零）自动重试一次；仍失败才置冲突，交给玩家显式选择。 */
      if(error.status===409){
        const remote=this.lineRecord(error.current);
        if(remote){row.conflict=true;row.remote=remote;}
        else if(!row._revisionReset){row._revisionReset=true;row.revision=0;row.conflict=false;row.remote=null;row.error="";row.seq=(row.seq||0)+1;row.again=true;}
        else{row.conflict=true;row.remote=null;row.error=error.message;}
      }
    }
    finally{row.promise=null;const again=row.again||row.seq!==seq,flush=row.keepalive;row.again=false;row.keepalive=false;this.persistCandidates();this.updateDraftStatus();if(again&&row.dirty&&!row.conflict){if(flush)this.syncLineDraft(id,true);else this.queueLineDraft(id);}}
  },
  async flushLineDrafts(keepalive=false,{strict=false}={}) {
    this.captureLineForm();this.persistCandidates();
    const rows=Object.entries(this._lineForms||{}).filter(([,row])=>row.explicit);
    await Promise.all(rows.map(async([id,row])=>{while(row.dirty&&!row.conflict&&this.lineDraftsReady()){await this.syncLineDraft(id,keepalive);if(row.error)break;}}));
    if(strict){const stuck=rows.filter(([,row])=>row.dirty||row.conflict);
      if(stuck.length)throw Error("配音提示词草稿尚未全部同步到本地服务："+stuck.slice(0,5).map(([id,row])=>
        id+"（"+(row.conflict&&row.remote?"服务端有另一版草稿：请在这句点「保留本稿并保存」或「载入服务端稿」":row.conflict?"服务端草稿文件不可读：请在这句点「保留本稿并保存」":row.error?"同步失败："+row.error:this.lineDraftsReady()?"尚未同步：请在这句点「重试保存」":"本地服务未加载提示词草稿接口，请重启编辑器服务")+"）"
      ).join("；")+(stuck.length>5?"；另有 "+(stuck.length-5)+" 句":"")+"。");}
  },
  async retryLineDraft(useLocal=true) {
    const id=this.selectedId,row=this._lineForms?.[id];if(!row?.explicit)return;
    if(row.conflict){
      if(!useLocal){const remote=row.remote;if(!remote)return;Object.assign(row,remote.form,{signature:remote.signature,sourceText:remote.sourceText,revision:remote.revision,dirty:false,conflict:false,remote:null,error:""});this.restoreLineForm();this.persistCandidates();this.render({force:true});return;}
      row.revision=row.remote?.revision||0;row.conflict=false;row.remote=null;row.dirty=true;row.seq=(row.seq||0)+1;
    }
    await this.syncLineDraft(id);this.updateDraftStatus();
  },
  editingPrompt() { return !!(this._composing||this.box?.querySelector('[data-seed-field="prompt"]')===document.activeElement); },
  editingField() { return !!(this._composing||this.box?.contains(document.activeElement)&&document.activeElement.matches('[data-seed-field]')); },
  draftStatus() {
    const row=this._lineForms?.[this.selectedId];
    if(!row?.explicit)return"修改后自动保存提示词草稿。";
    if(this._storageFailed)return"浏览器保存失败；"+(row.dirty?"本地服务尚未同步，请勿关闭。":"本地服务已保存。");
    if(row.conflict)return"已保存到浏览器；服务端有另一版，尚未同步。";
    if(row.promise)return"已保存到浏览器 · 正在同步本地服务…";
    if(!this.lineDraftsReady())return"已保存到浏览器；"+(this.status?"请重启编辑器服务以同步提示词。":"服务未连接，尚未同步。");
    if(row.dirty)return"已保存到浏览器；尚未同步"+(row.error||this._lineLoadError?"："+(row.error||this._lineLoadError):"，等待保存。 ");
    return"提示词草稿已保存到本地服务。";
  },
  updateDraftStatus() {
    const node=this.box?.querySelector('[data-seed-draft-status]');if(node)node.textContent=this.draftStatus();
    const row=this._lineForms?.[this.selectedId],retry=this.box?.querySelector('[data-seed-draft-retry]'),remote=this.box?.querySelector('[data-seed-draft-remote]');
    if(retry){retry.hidden=!row?.explicit||!row.dirty&&!row.conflict;retry.textContent=row?.conflict?"保留本稿并保存":"重试保存";retry.disabled=!!row?.promise;}
    if(remote){remote.hidden=!row?.conflict||!row.remote;remote.disabled=!!row?.promise;}
  },
  /* [/feature:seed-audio-line-drafts-20261015] */
  async syncCandidate(item) {
    if(!item||!this.candidates.includes(item)||!item._serverKnown||!this.status?.csrfToken)return;
    if(item._ownershipConflict)throw Error("草稿归属已变化，请刷新状态后重试。");
    if(item._syncPromise){item._syncAgain=true;return item._syncPromise;}
    const target=this.safeTarget(item.target),draft=this.safeDraft(item),fingerprint=JSON.stringify({target,draft});
    if(item._metadataSaved===fingerprint)return;
    const payload={id:item.job.id,draft,expectedTarget:this.safeTarget(item._serverTarget)};if(target)payload.target=target;
    item._syncPromise=(async()=>{
      const raw=await this.api("bind",payload),job=this.safeJob(raw,true);if(!job)throw Error("草稿绑定响应格式不正确。");
      const confirmed=this.safeTarget(raw.target);if(JSON.stringify(confirmed)!==JSON.stringify(target))throw Error("草稿归属已变化，请刷新候选。");
      item._serverTarget=confirmed;item._metadataSaved=fingerprint;item._ownershipConflict=false;
      item.job=job;if(this.job?.id===job.id&&this.sameLineCandidate(item))this.job=job;
      this.persistCandidates();
    })();
    try{return await item._syncPromise;}catch(error){if(error.status===409)item._ownershipConflict=true;throw error;}
    finally{item._syncPromise=null;if(item._syncAgain){item._syncAgain=false;this.queueCandidateSync(item);}}
  },
  queueCandidateSync(item) {
    if(!item?._serverKnown||item._ownershipConflict)return;
    clearTimeout(item._syncTimer);item._syncTimer=setTimeout(()=>{item._syncTimer=null;this.syncCandidate(item).catch(error=>{if(this.candidates.includes(item)){this.draftWarning="草稿编辑尚未同步："+error.message;this.render();}});},450);
  },
  candidateReady(job = this.job) {
    return !!job && (job.state === "completed" || job.state === "interrupted" && job._recoverableRaw === true &&
      typeof job.url === "string" && job.url.split(/[?#]/)[0] === "/api/seed-audio/preview/" + job.id + "/raw");
  },
  safeJob(value, fromAPI = false) {
    if(!value||typeof value.id!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(value.id))return null;
    const job={id:value.id};
    for(const key of ["state","format","error","prompt","reference"])
      if(typeof value[key]==="string")job[key]=value[key];
    if(typeof value.savedVoice==="string"&&/^resource\/sound\/voice\/[^/\\]+\.(mp3|wav)$/i.test(value.savedVoice))job.savedVoice=value.savedVoice;
    if(typeof value.legacyRecovered==="boolean")job.legacyRecovered=value.legacyRecovered;
    if(value.target!==undefined)job.target=this.safeTarget(value.target);
    if(value.draft&&typeof value.draft==="object")job.draft=this.safeDraft(value.draft);
    for(const key of ["bytes","duration","processedBytes"])
      if(Number.isFinite(value[key]))job[key]=value[key];
    for(const key of ["url","processedUrl"])
      if(typeof value[key]==="string"&&value[key].startsWith("/")&&!value[key].startsWith("//")&&!value[key].split(/[?#]/)[0].split("/").includes(".."))job[key]=value[key];
    if(fromAPI&&job.state==="interrupted"&&job.url?.split(/[?#]/)[0]==="/api/seed-audio/preview/"+job.id+"/raw")job._recoverableRaw=true;
    if(value.processInfo&&typeof value.processInfo==="object"){
      job.processInfo={};for(const key of ["inSec","outSec","startSec","endSec"])
        if(Number.isFinite(value.processInfo[key]))job.processInfo[key]=value.processInfo[key];
    }
    return job;
  },
  safeCandidate(value) {
    const job=this.safeJob(value?.job);if(!job)return null;
    const item={job,target:this.safeTarget(value.target),saved:null,...this.safeDraft(value)};
    for(const key of ["prompt","reference","filename","format"])
      if(typeof value[key]==="string")item[key]=value[key];
    for(const key of ["cropStart","cropEnd","silencePadMs","bitrate"])
      if(value[key]===""||Number.isFinite(value[key]))item[key]=value[key];
    if(typeof value.trimSilence==="boolean")item.trimSilence=value.trimSilence;
    if(typeof value.saved?.voice==="string"&&/^resource\/sound\/voice\/[^/\\]+\.(mp3|wav)$/i.test(value.saved.voice))item.saved={voice:value.saved.voice};
    if(value.clipState&&typeof value.clipState.editing==="boolean"){
      item.clipState={editing:value.clipState.editing,explicit:value.clipState.explicit===true};const selection=value.clipState.selection;
      if(selection&&Number.isFinite(selection.a)&&Number.isFinite(selection.b)&&selection.a>=0&&selection.b<=1&&selection.a<=selection.b)item.clipState.selection={a:selection.a,b:selection.b};
    }
    return item;
  },
  persistCandidates() {
    try {
      this.captureLineForm();
      const form={};for(const key of Object.keys(this.form))
        if(["text","age","prompt","reference","format","speech_rate","pitch_rate","loudness_rate","watermark","filename","cropStart","cropEnd","trimSilence","silencePadMs","bitrate","candidateCount"].includes(key)&&["string","number","boolean"].includes(typeof this.form[key]))form[key]=this.form[key];
      const selections={};for(const [line,id] of Object.entries(this._candidateSelections||{}))if(typeof id==="string")selections[line]=id;
      localStorage.setItem(this.draftStorageKey,JSON.stringify({schema:1,selectedId:this.selectedId,selectedCandidateId:this.selectedCandidateId,
        candidates:this.candidates.map(item=>this.safeCandidate(item)).filter(Boolean),form,selections,lineForms:this.lineCache(),noReference:!!this._noReference}));
      if(this._storageFailed)this.draftWarning="";this._storageFailed=false;
    }catch(_){this._storageFailed=true;this.draftWarning="浏览器无法保存提示词/候选草稿；未同步本地服务前请勿关闭。";}
    this.updateDraftStatus();
  },
  restoreCandidates() {
    try {
      const saved=JSON.parse(localStorage.getItem(this.draftStorageKey)||"null");if(saved?.schema!==1||!Array.isArray(saved.candidates))return;
      const seen=new Set();this.candidates=saved.candidates.map(item=>this.safeCandidate(item)).filter(item=>item&&!seen.has(item.job.id)&&seen.add(item.job.id));
      if(typeof saved.selectedId==="string")this.selectedId=saved.selectedId;
      if(typeof saved.selectedCandidateId==="string")this.selectedCandidateId=saved.selectedCandidateId;
      this._candidateSelections={};for(const [line,id] of Object.entries(saved.selections||{}))if(typeof id==="string")this._candidateSelections[line]=id;
      this._lineForms=Object.create(null);for(const [line,value] of Object.entries(saved.lineForms||{}))if(value&&typeof value==="object")this._lineForms[line]={...this.safeEditForm(value),sourceText:typeof value.sourceText==="string"?value.sourceText:"",signature:typeof value.signature==="string"?value.signature:"",explicit:value.explicit!==false,revision:Number.isInteger(value.revision)&&value.revision>=0?value.revision:0,dirty:value.dirty!==false,seq:Number.isInteger(value.seq)?value.seq:0};
      const defaults=this.form;for(const key of Object.keys(defaults)){
        const value=saved.form?.[key];
        if(typeof value===typeof defaults[key]||["cropStart","cropEnd"].includes(key)&&Number.isFinite(value))this.form[key]=value;
        else if(typeof defaults[key]==="number"&&typeof value==="string"&&value!==""&&Number.isFinite(Number(value)))this.form[key]=Number(value);
      }
      this._noReference=!!saved.noReference;
      // A legacy selected form may be newer than its old candidate metadata.
      if(this.selectedId&&!this._lineForms[this.selectedId]&&typeof saved.form?.prompt==="string")this._lineForms[this.selectedId]={...this.safeEditForm(saved.form),sourceText:String(saved.form.text??""),signature:"",explicit:true,revision:0,dirty:true,seq:1};
      const selected=this._lineForms[this.selectedId];if(selected)for(const[key,value]of Object.entries(this.safeEditForm(saved.form)))if(!Object.prototype.hasOwnProperty.call(selected,key)){selected[key]=value;selected.dirty=true;selected.seq=(selected.seq||0)+1;}
      this._formLineId=this.selectedId;this._formBaseline=JSON.stringify(this.safeEditForm(this.form));this.restoreLineForm();
      this.restoreLineCandidate();
    }catch(_){this.draftWarning="候选草稿记录无法读取；本地服务中的音频仍可恢复。";}
  },
  restoreLineCandidate() {
    const candidates=this.candidateRows(),preferred=this._candidateSelections?.[this.selectedId]||this.selectedCandidateId;
    const item=candidates.find(row=>row.job.id===preferred)||candidates.filter(row=>this.candidateReady(row.job)).at(-1)||candidates.at(-1);
    if(!item){this.job=null;this.target=null;this.saved=null;this.selectedCandidateId="";return;}
    this.job=item.job;this.target=item.target;this.saved=item.saved||null;this.selectedCandidateId=item.job.id;
    this.restoreCandidateForm(item);
    this._candidateSelections ||= {};this._candidateSelections[this.selectedId]=item.job.id;
  },
  async refreshCandidates() {
    if(!this.status?.csrfToken)return;
    const epoch=this._candidateFetchEpoch=(this._candidateFetchEpoch||0)+1;
    try {
      const result=await this.api("jobs");if(epoch!==this._candidateFetchEpoch)return;if(!Array.isArray(result.jobs))throw new Error("候选列表响应格式不正确。");
      this.keepCandidate();const existing=new Map(this.candidates.map(item=>[item.job.id,item]));
      const migrate=[];
      this.candidates=result.jobs.map(raw=>{
        const job=this.safeJob(raw,true);if(!job)return null;
        const local=existing.get(job.id),remoteTarget=this.safeTarget(raw.target),localTarget=this.safeTarget(local?.target);
        const item=local||{saved:null};const localDraft=local?this.safeDraft(local):{};
        Object.assign(item,{filename:job.id+"."+(job.format||"mp3"),format:job.format||"mp3",cropStart:"",cropEnd:"",trimSilence:false,silencePadMs:60,bitrate:96},this.safeDraft(raw.draft),localDraft);
        item.job=job;item.prompt=typeof job.prompt==="string"?job.prompt:typeof item.prompt==="string"?item.prompt:"";item.reference=typeof job.reference==="string"?job.reference:typeof item.reference==="string"?item.reference:"";
        item.target=remoteTarget||localTarget;item._serverKnown=true;item._serverTarget=this.safeTarget(remoteTarget);item._ownershipConflict=false;
        item._metadataSaved=JSON.stringify({target:remoteTarget,draft:this.safeDraft(raw.draft)});
        if(!item.saved&&job.savedVoice)item.saved={voice:job.savedVoice};
        if(local&&(localTarget||Object.keys(localDraft).length))migrate.push(item);
        return item;
      }).filter(Boolean);
      for(const item of migrate)try{await this.syncCandidate(item);}catch(error){this.draftWarning="本地草稿已保留，但绑定/编辑同步失败："+error.message;}
      if(!this.candidates.some(item=>item.job.id===this.job?.id&&item.target?.id===this.selectedId)){this.resetClip();if(this.player)this.player.pause();this.job=null;this.target=null;this.saved=null;this.selectedCandidateId="";}
      this.restoreLineCandidate();this.persistCandidates();
      const running=this.candidates.find(item=>item.job.state==="running");if(running&&!this._activeGeneration)this.resumeCandidate(running);
    }catch(error){this.draftWarning="暂未同步本地候选："+error.message;}
  },
  async resumeCandidate(item) {
    this.busy=true;this._activeGeneration=true;this._activeJobId=item.job.id;this._batchCount=1;this._batchIndex=1;
    if(this.sameLineCandidate(item)){this.job=item.job;this.target=item.target;this.selectedCandidateId=item.job.id;}
    try {
      while(item.job.state==="running"){
        await new Promise(resolve=>setTimeout(resolve,1500));
        item.job=this.safeJob(await this.api("jobs/"+item.job.id),true)||item.job;if(this.sameLineCandidate(item))this.job=item.job;this.persistCandidates();this.render();
      }
    }catch(error){this.error="候选仍保留，请刷新状态重试："+error.message;}
    finally{this.busy=false;this._activeGeneration=false;this._activeJobId="";this.restoreLineCandidate();this.persistCandidates();this.render();}
  },
  async deleteCandidate(id) {
    const item=this.candidateRows().find(row=>row.job.id===id&&this.sameLineCandidate(row));if(!item)return false;return this.deleteDraft(item);
  },
  async deleteUnassigned(id) {
    const item=this.unassignedRows().find(row=>row.job.id===id);if(!item)return false;return this.deleteDraft(item);
  },
  async deleteDraft(item) {
    const id=item.job.id;if(this.busy||item.job.state==="running")return false;
    this.keepCandidate();this.busy=true;this.error="";this.render();
    try{
      clearTimeout(item._syncTimer);if(item._syncPromise)await item._syncPromise;
      try{await this.api("delete",{id,...(item._serverKnown?{expectedTarget:this.safeTarget(item._serverTarget)}:{})});}catch(error){if(error.status!==404)throw error;}
      if(this.player)this.player.pause();this.resetClip();
      this.candidates=this.candidates.filter(row=>row.job.id!==id);
      clearTimeout(item._syncTimer);if(this._unassignedSelectedId===id)this._unassignedSelectedId="";
      for(const line of Object.keys(this._candidateSelections||{}))if(this._candidateSelections[line]===id)delete this._candidateSelections[line];
      if(this.job?.id===id){this.job=null;this.target=null;this.saved=null;this.selectedCandidateId="";}
      this.restoreLineCandidate();this.persistCandidates();return true;
    }catch(error){this.error=error.message;return false;}
    finally{this.busy=false;this.render();}
  },
  async bindCandidate(id = this._unassignedSelectedId) {
    if(this.busy)return false;
    const item=this.unassignedRows().find(row=>row.job.id===id),line=this.current();if(!item||!line||!this.candidateReady(item.job))return false;
    const target={id:line.id,signature:this.signature(line),previousVoice:line.row.voice};
    this.busy=true;this.error="";this.render();
    try{
      const raw=await this.api("bind",{id,target,draft:this.safeDraft(item),expectedTarget:this.safeTarget(item._serverTarget)});
      const confirmed=this.safeTarget(raw.target);if(JSON.stringify(confirmed)!==JSON.stringify(target))throw Error("草稿绑定响应不匹配，请刷新候选。");
      item.target=confirmed;item._serverTarget=this.safeTarget(confirmed);item._serverKnown=true;item._ownershipConflict=false;item.job=this.safeJob(raw,true)||item.job;
      item._metadataSaved=JSON.stringify({target:confirmed,draft:this.safeDraft(item)});this._unassignedSelectedId="";
      this._candidateSelections ||= {};this._candidateSelections[target.id]=id;
      if(this.selectedId===target.id){this.keepCandidate();this.resetClip();if(this.player)this.player.pause();this.job=null;this.restoreLineCandidate();}
      this.persistCandidates();return true;
    }catch(error){this.error=error.message;return false;}
    finally{this.busy=false;this.render();}
  },
  keepCandidate(editForm = false) {
    const changed=this.captureLineForm(editForm);
    const item=this.candidate();if(!this.sameLineCandidate(item))return;
    item.job=this.job;item.saved=this.saved;item.target=this.target;
    for(const key of ["filename","format","cropStart","cropEnd","trimSilence","silencePadMs","bitrate"])item[key]=this.form[key];
    if(this.clipItem)item.clipState={editing:this.clipItem.editing,explicit:this.clipItem._selectionExplicit===true,selection:this.clipItem._sel?{...this.clipItem._sel}:null};
    if(changed||!item.editForm)item.editForm=this.safeEditForm(this.form);this.queueCandidateSync(item);
    this.persistCandidates();
  },
  selectCandidate(id, autoplay = false) {
    if(this.busy)return false;
    const item=this.candidateRows().find(row=>row.job.id===id&&this.sameLineCandidate(row)&&this.candidateReady(row.job));if(!item)return false;
    this.keepCandidate();this.resetClip();if(this.player)this.player.pause();
    this.job=item.job;this.selectedCandidateId=id;this.target=item.target;this.saved=item.saved||null;
    this.restoreCandidateForm(item);
    this._candidateSelections ||= {};this._candidateSelections[this.selectedId]=id;
    this.error="";this.persistCandidates();this.render();if(autoplay)this.play(this.job.processedUrl||this.job.url);return true;
  },
  candidateCard(item,index) {
    const job=item.job,state=job.state==="interrupted"&&this.candidateReady(job)?"已中断·音频可恢复":({running:"生成中",failed:"生成失败",cancelled:"已停止",interrupted:"生成已中断"})[job.state]||job.state;
    const detail=item._ownershipConflict?"归属已变化，请刷新状态":item.saved?"已应用":job.state==="completed"?(job.duration!=null?Number(job.duration).toFixed(2)+" 秒":"可试听")+" · "+(job.processedUrl?"已处理":"原始配音"):state;
    return h("div",{class:"seed-candidate-row"},
      h("button",{class:"seed-candidate"+(job.id===this.selectedCandidateId?" is-selected":""),"data-seed-candidate":job.id,
        "aria-pressed":String(job.id===this.selectedCandidateId),disabled:this.busy||!this.sameLineCandidate(item)||!this.candidateReady(job)?"disabled":null,
        title:item.prompt,onclick:()=>this.selectCandidate(job.id,true)},
        h("b",{},"▶ 候选 "+(index+1)),h("span",{},detail)),
      h("button",{class:"seed-candidate-delete",type:"button","data-seed-delete":job.id,"aria-label":"删除候选 "+(index+1),
        title:job.state==="running"?"生成中不能删除":"删除草稿，已应用的配音文件会保留",disabled:this.busy||!this.sameLineCandidate(item)||job.state==="running"?"disabled":null,
        onclick:()=>this.deleteCandidate(job.id)},"删除"));
  },
  previewUnassigned(id) {
    if(this.busy)return false;
    const item=this.unassignedRows().find(row=>row.job.id===id);if(!item||!this.candidateReady(item.job))return false;
    this._unassignedSelectedId=id;this.render();this.play(item.job.processedUrl||item.job.url);return true;
  },
  unassignedPanel() {
    const rows=this.unassignedRows();if(!rows.length)return null;
    const item=rows.find(row=>row.job.id===this._unassignedSelectedId)||rows[0];this._unassignedSelectedId=item.job.id;
    const select=h("select",{"data-seed-unassigned":"",disabled:this.busy?"disabled":null,onchange:event=>{this._unassignedSelectedId=event.target.value;this.render();}},
      rows.map((row,index)=>h("option",{value:row.job.id},String(index+1)+" · "+row.job.id+(this.candidateReady(row.job)?" · 可试听":" · "+row.job.state))));
    select.value=item.job.id;
    return h("details",{class:"seed-unassigned",open:this._unassignedOpen?"open":null,ontoggle:event=>{this._unassignedOpen=event.currentTarget.open;}},
      h("summary",{},"未归属草稿 · "+rows.length),
      h("p",{class:"seed-hint"},"这些历史音频尚未归属台词。试听确认后，可明确绑定到当前所选台词。"),
      h("label",{class:"seed-field"},h("span",{},"选择未归属草稿"),select),
      h("div",{class:"seed-actions"},
        h("button",{class:"btn btn-sm","data-seed-unassigned-preview":item.job.id,disabled:this.busy||!this.candidateReady(item.job)?"disabled":null,onclick:()=>this.previewUnassigned(item.job.id)},"▶ 试听草稿"),
        h("button",{class:"btn btn-sm","data-seed-bind":item.job.id,disabled:this.busy||!this.current()||!this.candidateReady(item.job)?"disabled":null,onclick:()=>this.bindCandidate(item.job.id)},"绑定到当前台词"),
        h("button",{class:"seed-candidate-delete","data-seed-delete-unassigned":item.job.id,disabled:this.busy||item.job.state==="running"?"disabled":null,onclick:()=>this.deleteUnassigned(item.job.id)},"删除草稿")),
      item.prompt?h("div",{class:"seed-generated-prompt"},h("strong",{},"生成时提示词"),h("pre",{},item.prompt)):null);
  },

  field(label, key, attrs = {}) {
    const input = h(attrs.rows ? "textarea" : "input", { ...attrs, disabled: this.busy || !this.current() ? "disabled" : null,
      value: this.form[key], "data-seed-field": key, oninput: (event) => {
        this.form[key] = attrs.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value;
        this.keepCandidate(true);this.persistCandidates();
      },oncompositionstart:()=>{this._composing=true;},oncompositionend:()=>{this._composing=false;this.keepCandidate(true);this.persistCandidates();},onblur:()=>{if(this._renderPending)setTimeout(()=>{if(!this.editingField()){this._renderPending=false;this.render();}},0);} });
    if (attrs.rows) input.value = this.form[key];
    return h("label", { class: "seed-field" }, h("span", {}, label), input);
  },

  select(label, key, options, onChange) {
    const select = h("select", { "data-seed-field": key, disabled: this.busy ? "disabled" : null, onchange: (event) => {
      this.form[key] = event.target.value;
      if (onChange) onChange(event.target.value);
      this.keepCandidate(true);this.persistCandidates();
    } }, options.map(([value, text]) => h("option", { value }, text)));
    select.value = String(this.form[key]);
    return h("label", { class: "seed-field" }, h("span", {}, label), select);
  },

  render(options = {}) {
    if (!this.box) return;
    if(!options.force&&this.editingField()&&!this.busy&&!this.configuring){this._renderPending=true;this.updateDraftStatus();return;}
    this._renderPending=false;
    UI.clear(this.box);
    const st = this.status, f = this.form;
    const button = (text, action, disabled = false, primary = false) => h("button", {
      class: "btn" + (primary ? " btn-primary" : " btn-sm"), disabled: disabled ? "disabled" : null,
      onclick: action }, text);
    this.box.append(h("div", { class: "seed-head" },
      h("div", {}, h("h3", {}, "🎙 剧情配音 · SeedAudio"),
        h("p", {}, "选台词，修改完整提示词；生成候选后逐个试听，选定一版再应用。")),
      h("span", { class: "seed-badge" + (st?.configured ? " ready" : "") },
        st ? (st.configured ? "密钥已配置" : "未配置密钥") : "服务未连接")));
    const credentials = h("div", { class: "seed-credentials" },
      h("label", { class: "seed-field" }, h("span", {}, "火山 API Key"),
        h("input", { type: "password", "data-seed-api-key": "", autocomplete: "off", spellcheck: "false",
          maxlength: 512, placeholder: st?.configured ? "已配置；填写新 Key 可替换" : "在这里填写 API Key",
          disabled: this.busy || this.configuring ? "disabled" : null })),
      button(this.configuring ? "保存中…" : "保存 API Key", () => this.saveKey(), this.busy || this.configuring, true),
      h("p", { class: "seed-hint" },
        "仅保存到本机；保存后清空输入框，已有环境变量密钥优先。"));
    this.box.append(h("details", {class:"seed-key-details",open:st?.configured?null:"open"},h("summary",{},"API Key · "+(st?.configured?"已配置":"未配置")),credentials));
    const line = this.current();
    const lineSelect = h("select", { "data-seed-line": "", disabled: this.busy || this.configuring || !this.lines.length ? "disabled" : null,
      onchange: event => this.choose(event.target.value) }, this.lines.length ? this.lines.map((item, index) =>
      h("option", { value: item.id, disabled: item.valid ? null : "disabled" },
        String(index + 1).padStart(2, "0") + " · " + (item.source === 'journey-opening' ? '旅行开场' : this.appearance(item.age)) + " · " + String(item.row.text).slice(0, 80)))
      : h("option", { value: "" }, "暂无可用剧情台词"));
    lineSelect.value = this.selectedId;
    this.box.append(h("div", { class: "seed-line-picker" },
      h("label", { class: "seed-field" }, h("span", {}, "选择剧情台词"), lineSelect),
      button("刷新台词列表", async () => { await this.refreshLines(); this.render(); }, this.busy || this.configuring),
      h("p", { class: "seed-hint" }, line ? this.appearance(line.age) + " · " + line.id + " · " +
        (line.source === 'journey-opening' ? '面对面开场；台词取自「旅行小鲸鱼」工作副本，应用后沿原保存全部保存。' : (line.row.caption || "剧情对白") + "；台词取自「完整的一生」工作副本，编辑剧情后可刷新。") : "先选择一条有稳定编号的对白。")));
    if (this.sourceError) this.box.append(h("p", { class: "seed-error", role: "alert" }, this.sourceError));
    if (this.lines.some(item => !item.valid)) this.box.append(h("p", { class: "seed-error" }, "部分对白编号为空或重复，请先在剧情分页修正编号。"));
    if (line?.row.voice) this.box.append(h("div", { class: "seed-current" },
      h("span", {}, "当前配音：" + line.row.voice), button("▶ 试听当前配音", () => this.play("/" + line.row.voice.replace(/^\//, "")))));
    const references = [...new Set([...(st?.references || []), ...Object.values(this.presets).map(preset => preset.reference)])];
  /* [feature:seed-audio-reference-empty-choice] */
    this.box.append(h("div", { class: "seed-grid" },
      this.select("参考音频（可留空）", "reference", [["", "不使用参考音频"], ...references.map(name => [name, name])], value => { this._noReference = value === ""; }),
      this.select("生成格式", "format", [["mp3", "MP3"], ["wav", "WAV"]], format => {
        f.filename = f.filename.replace(/\.(mp3|wav)$/i, "." + format); this.render(); }),
      this.field("语速（-50～100）", "speech_rate", { type: "number", min: -50, max: 100, step: 1 }),
      this.field("音高（-12～12）", "pitch_rate", { type: "number", min: -12, max: 12, step: 1 }),
      this.field("音量（-50～100）", "loudness_rate", { type: "number", min: -50, max: 100, step: 1 }),
      this.select("候选数量", "candidateCount", [[1,"1 个"],[2,"2 个"],[3,"3 个"],[4,"4 个"]],()=>this.render())));
    this.box.append(h("p", { class: "seed-hint" }, "参考音频可留空；需要参考音色时可在提示词中自行写明要求。"));
  /* [/feature:seed-audio-reference-empty-choice] */
    this.box.append(this.field("完整生成提示词", "prompt", { rows: 3, placeholder:"已预填台词，可自由添加或改写完整生成要求。" }),
      h("div",{class:"seed-prompt-note"},h("span",{},"此框原样发送，不附加隐藏的表演或朗读指令。 ",h("span",{"data-seed-draft-status":"",role:"status","aria-live":"polite"},this.draftStatus())),button("重置为台词",()=>{f.prompt=String(this.current()?.row.text??"");this.keepCandidate(true);this.persistCandidates();this.render();},this.busy)),
      h("div",{class:"seed-actions"},h("button",{class:"btn btn-sm","data-seed-draft-retry":"",hidden:!this._lineForms?.[this.selectedId]?.dirty?"hidden":null,onclick:()=>this.retryLineDraft(true)},this._lineForms?.[this.selectedId]?.conflict?"保留本稿并保存":"重试保存"),h("button",{class:"btn btn-sm","data-seed-draft-remote":"",hidden:!this._lineForms?.[this.selectedId]?.conflict?"hidden":null,onclick:()=>this.retryLineDraft(false)},"载入服务端稿")));
    this.box.append(h("div", { class: "seed-actions" },
      button("▶ 试听参考", () => this.play("/resource/sound/voice/" + encodeURIComponent(f.reference)), !f.reference),
      button(this.busy ? "生成中…" : "生成 " + Number(f.candidateCount) + " 个候选", () => this.generate(), this.busy || this.configuring || !st?.configured || !line, true),
      button("停止生成", () => this.cancel(), !this.busy || !this._activeGeneration),
      button("刷新状态", () => this.refresh(), this.busy || this.configuring),
      UI.checkField("尾部声音水印", f.watermark, value => { f.watermark = value;this.keepCandidate(true);this.persistCandidates(); })));
    this.box.append(h("p", { class: "seed-hint" },
      "提示词与所选参考音频会发送到火山；停止后，已提交的生成仍可能计费。候选仅供试听，不会自动应用。"));
    if (this.error) this.box.append(h("p", { class: "seed-error", role: "alert" }, this.error));
    if(this.draftWarning)this.box.append(h("p",{class:"seed-hint",role:"status"},this.draftWarning));
    if (this.job) this.box.append(h("p", { class: "seed-progress", role: "status", "aria-live": "polite" },
      (this._activeGeneration?"候选 "+this._batchIndex+" / "+this._batchCount+" · ":"")+(this.job.state==="interrupted"&&this.candidateReady()?"已中断·音频可恢复":({ running: "正在生成…", completed: "配音已生成，可试听和剪辑。", cancelled: "已停止生成。", failed: "生成失败。", interrupted:"生成已中断。" })[this.job.state] || this.job.state)));
    if(this.candidateRows().length)this.box.append(h("div",{class:"seed-candidates",role:"group","aria-label":"配音候选"},
      h("div",{class:"seed-candidate-heading"},h("strong",{},"当前台词候选 · "+this.candidateRows().length),h("span",{},"刷新后保留；点一版试听，选定后应用")),
      h("div",{class:"seed-candidate-list"},this.candidateRows().map((item,index)=>this.candidateCard(item,index)))));
    const unassigned=this.unassignedPanel();if(unassigned)this.box.append(unassigned);
    if (!this.sameLineCandidate() || !this.candidateReady() || this._activeGeneration) return;
    const job = this.job;
  /* [feature:seed-audio-wave-output] */
    this.box.append(h("div", { class: "seed-output" },
      this.candidate()?.prompt?h("details",{class:"seed-generated-prompt"},h("summary",{},"查看这版候选的生成提示词"),h("pre",{},this.candidate().prompt)):null,
      h("div", { class: "seed-actions" }, button("▶ 原始配音", () => this.play(job.url)),
        job.processedUrl ? button("▶ 处理后", () => this.play(job.processedUrl)) : null,
        h("span", {}, (job.duration != null ? Number(job.duration).toFixed(2) + " 秒 · " : "") + Math.round(job.bytes / 1024) + " KB")),
      this.clipPanel(job),
      h("div", { class: "seed-grid" },
        this.field("首尾留白（毫秒，未选区时）", "silencePadMs", { type: "number", min: 0, max: 1000, step: 10 }),
        this.select("MP3 压缩码率", "bitrate", [[64, "64 kbps"], [96, "96 kbps"], [128, "128 kbps"], [192, "192 kbps"]])),
      h("div", { class: "seed-actions" }, UI.checkField("去首尾静音（未选区时）", f.trimSilence, value => { f.trimSilence = value;this.keepCandidate();this.persistCandidates(); }),
        button("✂ 处理并预听", () => this.process(), this.busy || !st?.ffmpeg || !this.clipItem)),
      job.processInfo ? h("p", { class: "seed-hint" }, job.processInfo.inSec + " 秒 → " + job.processInfo.outSec + " 秒 · 单声道 · " + Math.round(job.processedBytes / 1024) + " KB") : null,
      this.field("应用时保存文件名（resource/sound/voice，.mp3 或 .wav）", "filename", { type: "text", maxlength: 100 }),
      h("div", { class: "seed-actions" }, button("✓ 应用到这句台词", () => this.apply(), this.busy || !st?.ffmpeg || !line || !this.target || !!this.saved, true)),
      h("p", { class: "seed-hint" }, "先试听确认，再应用。应用保存新音频并只替换所选对白 voice；配置沿用编辑器自动保存/保存全部，原音频不覆盖。")));
  /* [/feature:seed-audio-wave-output] */
    if (this.saved) this.box.append(h("div", { class: "seed-saved" },
      h("label", { class: "seed-field" }, h("span", {}, "已应用到 " + this.selectedId),
        h("input", { type: "text", readonly: "readonly", value: this.saved.voice, "data-seed-voice": "" })),
      button("复制 voice 路径", () => this.copyVoice())));
  },

  /* [feature:seed-audio-wave-widget] */

  resetClip() {
    this._clipEpoch = (this._clipEpoch || 0) + 1;
    if (this.clip) {
      this.clip._disposed = true;
      this.clip._clearSelectionPlayback();
      if (this.clip._audio) this.clip._audio.pause();
      if (this.clip._ac?.close) this.clip._ac.close().catch(() => {});
    }
    this.clip = null; this.clipItem = null; this._clipKey = ""; this._clipError = "";
  },

  clipPanel(job) {
    if (!window.VoiceClip) return h("p", { class: "seed-error" }, "语音剪辑模块未加载，请刷新编辑器。");
    const key = job.id + ":" + job.url;
    if (this._clipKey !== key) {
      this.resetClip(); this._clipKey = key;
      const epoch = this._clipEpoch;
      this._clipLoading = (async () => {
        try {
          const response = await fetch(job.url, { cache: "no-store" });
          if (!response.ok) throw new Error("原始音频读取失败（HTTP " + response.status + "）");
          const bytes = await response.arrayBuffer();
          if (this._clipEpoch !== epoch || this.job?.id !== job.id || this.job.url !== job.url) return;
          if (!this.player) this.player = new Audio();
          const draft=this.candidates.find(item=>item.job.id===job.id);
          const it = { id: "seed-" + job.id, name: this.selectedId + " · 原始配音", file: new File([bytes], job.id + "." + (job.format||this.form.format)), size: bytes.byteLength,
            cropStart: draft?.cropStart??this.form.cropStart, cropEnd: draft?.cropEnd??this.form.cropEnd, editing: draft?.clipState?.editing??true };
          if(draft?.clipState?.selection)it._sel={...draft.clipState.selection};
          it._selectionExplicit=!!draft?.clipState?.explicit;
          // An independent receiver reuses the widget and precise playback;
          // batch WAV rows, decoder and playback state remain owned by VoiceClip.
          const clip = Object.assign(Object.create(VoiceClip), { items: [], batch: { ...VoiceClip.batch }, _ac: null, _audio: this.player, _playing: null, _origUrl: null, _selectionPlayback: null, _selectionToken: 0,
            _syncSel(item, wave, selection, left, right, info) {
              VoiceClip._syncSel.call(this, item, wave, selection, left, right, info);
              // Keep the existing handles inside this embedding's clipped wave.
              selection.querySelector('.vc-h-l').style.left = '0px';
              selection.querySelector('.vc-h-r').style.right = '0px';
            },
            async _loadWave(item) {
              if (this._disposed) throw new Error("已切换配音草稿");
              await VoiceClip._loadWave.call(this, item);
              if (this._disposed) throw new Error("已切换配音草稿");
            },
            render: () => { if (this.clip !== clip) return; this.form.cropStart = it.cropStart; this.form.cropEnd = it.cropEnd; this.keepCandidate();this.render(); } });
          this.clipItem = it; this.clip = clip; this.render();
        } catch (error) { if (this._clipEpoch === epoch) { this._clipError = error.message; this.render(); } }
      })();
    }
    if (!this.clipItem) return h("p", { class: this._clipError ? "seed-error" : "seed-hint" }, this._clipError || "正在读取原始配音波形…");
    const it = this.clipItem;
    if (!it.editing) return h("div", { class: "seed-actions" }, h("span", {}, it.cropStart === "" && it.cropEnd === "" ? "未确认选区，处理时沿用整段设置。" : "已选区 " + it.cropStart + "s ～ " + it.cropEnd + "s"),
      h("button", { class: "btn btn-sm", disabled: this.busy ? "disabled" : null, onclick: () => { it.editing = true; this.keepCandidate();this.render(); } }, "✂ 剪辑"));
    const editor = this.clip.editor(it);
    if (this.busy) { editor.style.pointerEvents = "none"; editor.querySelectorAll("button").forEach(button => { button.disabled = true; }); }
    return editor;
  },

  async saveKey() {
  /* [/feature:seed-audio-wave-widget] */
    if (this.busy || this.configuring) return;
    const input = this.box?.querySelector("[data-seed-api-key]");
    let apiKey = input?.value || "";
    if (input) input.value = "";
    this.configuring = true; this.error = ""; this.render();
    try {
      this.status = await this.api("status");
      this.status = await this.api("credentials", { api_key: apiKey });
      UI.toast("API Key 已保存到本机");
    } catch (error) { this.error = error.message; }
    finally { apiKey = ""; this.configuring = false; this.render(); }
  },

  async generate() {
    if (this.busy || this.configuring) return;
    const line = this.current();
    if (!line) { this.error = "请先选择有效的剧情台词。"; this.render(); return; }
    if(typeof this.form.prompt!=="string"||!this.form.prompt.trim()){this.error="请填写完整提示词，不能全为空白。";this.render();return;}
    this.form.text = String(line.row.text);
    this.form.age = line.age;
    this.keepCandidate();
    const target = { id: line.id, signature: this.signature(line), previousVoice: line.row.voice };
    this.target = target;
  /* [feature:seed-audio-wave-generate] */
    this.resetClip(); this.form.cropStart = ""; this.form.cropEnd = "";
    this.busy = true; this.saved = null; this.error = ""; this.job = null;
  /* [/feature:seed-audio-wave-generate] */
    const f={...this.form},count=Math.max(1,Math.min(4,Math.floor(Number(f.candidateCount)||1)));
    const payload={prompt:f.prompt,age:Number(f.age),reference:f.reference,format:f.format,speech_rate:Number(f.speech_rate),pitch_rate:Number(f.pitch_rate),loudness_rate:Number(f.loudness_rate),watermark:f.watermark?{aigc_watermark:true}:{},target:{...target}};
    this._activeGeneration=true;this._cancelBatch=false;this._batchCount=count;this._batchIndex=1;
    this.render();
    try {
      for(let index=0;index<count&&!this._cancelBatch;index++){
        this._batchIndex=index+1;
        const draft={filename:line.id.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,50)+"-review-"+Date.now()+"-"+(this.candidates.length+1)+"."+payload.format,
          format:payload.format,cropStart:"",cropEnd:"",trimSilence:f.trimSilence,silencePadMs:f.silencePadMs,bitrate:f.bitrate,editForm:this.safeEditForm(f)};
        const raw=await this.api("generate",{...payload,draft}),job=this.safeJob(raw,true);if(!job)throw Error("生成任务响应格式不正确。");
        const item={job,target:{...target},prompt:payload.prompt,reference:payload.reference,saved:null,...draft,
          _serverKnown:Object.prototype.hasOwnProperty.call(raw,"target"),_serverTarget:this.safeTarget(raw.target)};
        if(item._serverKnown&&JSON.stringify(item._serverTarget)!==JSON.stringify(this.safeTarget(target)))item._ownershipConflict=true;
        item._metadataSaved=JSON.stringify({target:item._serverTarget,draft:this.safeDraft(raw.draft)});
        this.candidates.push(item);this._activeJobId=job.id;
        if(this.selectedId===target.id){this.job=job;this.selectedCandidateId=job.id;this.target=item.target;this.form.filename=item.filename;}
        this._candidateSelections ||= {};this._candidateSelections[target.id]=job.id;this.persistCandidates();
        this.render();
        const id=job.id;
        while(item.job.state==="running"){
          await new Promise(resolve=>setTimeout(resolve,1500));if(item.job.state!=="running")break;
          item.job=this.safeJob(await this.api("jobs/"+id),true)||item.job;if(this.selectedId===target.id)this.job=item.job;this.persistCandidates();this.render();
        }
        if(item.job.state==="failed")throw new Error(item.job.error||"生成失败");
        if(item.job.state==="cancelled")this._cancelBatch=true;
        this.queueCandidateSync(item);
      }
    } catch (error) {
      const active=this.candidates.find(item=>item.job.id===this._activeJobId);
      if(active?.job.state==="running"){
        active.job={...active.job,state:"failed",error:error.message};if(this.sameLineCandidate(active))this.job=active.job;
      }
      this.error = error.message;
    }
    finally {
      this.busy=false;this._activeGeneration=false;this._activeJobId="";
      if(!this.candidateReady()){
        const completed=this.candidateRows().filter(item=>this.candidateReady(item.job)).at(-1);
        if(completed){const error=this.error;this.selectCandidate(completed.job.id);this.error=error;}
      }
      this.persistCandidates();this.render();
    }
  },

  async cancel() {
    this._cancelBatch=true;const item=this.candidates.find(row=>row.job.id===this._activeJobId)||this.candidate();if (!item||item.job.state!=="running") return;
    try { item.job = this.safeJob(await this.api("cancel", { id: item.job.id }),true)||item.job;if(this.sameLineCandidate(item))this.job=item.job; }
    catch (error) { this.error = error.message; }
    this.persistCandidates();
    this.render();
  },

  opts() {
  /* [feature:seed-audio-wave-exact-options] */
    const f = this.form, it = this.clipItem, selection = it?._sel;
    const manual = [f.cropStart, f.cropEnd].some(value => value != null && String(value).trim() !== "")
      || it?.editing && selection && (it._selectionExplicit || selection.a > 0 || selection.b < 1);
    if (manual && it?.editing && selection && it._dur) {
      const range = this.clip?.selectionRange ? this.clip.selectionRange(it) : { start: selection.a * it._dur, end: selection.b * it._dur };
      f.cropStart = range.start;
      f.cropEnd = selection.b === 1 ? "" : range.end;
    }
    return { cropStart: f.cropStart, cropEnd: f.cropEnd, trimSilence: !!f.trimSilence && !manual,
      silencePadMs: Number(f.silencePadMs), bitrate: Number(f.bitrate), format: f.format };
  /* [/feature:seed-audio-wave-exact-options] */
  },

  async process() {
    const item=this.candidate();if (this.busy||!this.sameLineCandidate(item)||!this.candidateReady()) return;
    this.busy = true; this.error = ""; this.render();
    try {
      const opts=this.opts();this.keepCandidate();await this.syncCandidate(item);
      const job=this.safeJob(await this.api("process", { id: item.job.id, opts,...(item._serverKnown?{expectedTarget:this.safeTarget(item._serverTarget)}:{}) }),true);if(!job)throw Error("处理任务响应格式不正确。");
      item.job=job;if(this.sameLineCandidate(item)){this.job=job;this.keepCandidate();this.play(job.processedUrl);}
    }
    catch (error) { this.error = error.message; }
    finally { this.busy = false; this.keepCandidate();this.persistCandidates();this.render(); }
  },

  async apply() {
    if (this.busy) return;
    if (!this.candidateReady() || this.saved) return;
    this.busy = true; this.error = ""; this.render();
    try {
      this.verifyTarget();
      const candidate=this.candidate();this.keepCandidate();await this.syncCandidate(candidate);this.verifyTarget();
      const saved = await this.api("save", { id: this.job.id, filename: this.form.filename.trim(), opts: this.opts(),...(candidate?._serverKnown?{expectedTarget:this.safeTarget(candidate._serverTarget)}:{}) });
      const line = this.verifyTarget(), story = this.story();
      if (!/^resource\/sound\/voice\/[^/\\]+\.(mp3|wav)$/i.test(saved.voice || "")) throw new Error("音频保存结果路径不正确，剧情尚未应用。");
      if (line.source === 'journey-opening') {
        const journey = window.JourneyTool;
        journey.remember();
        journey.setPath('OPENING|steps|' + line.index + '|replySrc', saved.voice);
        journey.setPath('OPENING|steps|' + line.index + '|replyType', 'voice');
        journey.mark();
        journey.render();
      } else {
        story.remember("应用对白配音：" + line.id);
        line.row.voice = saved.voice;
        story.mark();
        if (story.renderInspector) story.renderInspector();
      }
      this.saved = saved;
      this.keepCandidate();
      const previousVoice=this.target.previousVoice;
      for(const item of this.candidates)if(item.target?.signature===this.target.signature&&item.target.previousVoice===previousVoice){item.target.previousVoice=saved.voice;try{await this.syncCandidate(item);}catch(error){this.draftWarning="配音已应用，草稿归属待同步："+error.message;}}
      UI.toast("已应用到这句台词；配置沿用编辑器保存");
    } catch (error) { this.error = error.message; }
    finally { this.busy = false; if (this.persistCandidates) this.persistCandidates(); this.render(); }
  },

  play(url) {
  /* [feature:seed-audio-wave-preview-switch] */
    if (!this.player) this.player = new Audio();
    if (this.clip) this.clip._clearSelectionPlayback();
    this.player.pause(); this.player.src = url; this.player.currentTime = 0;
  /* [/feature:seed-audio-wave-preview-switch] */
    this.player.play().catch(error => { this.error = "试听失败：" + error.message; this.render(); });
  },

  async copyVoice() {
    try { await navigator.clipboard.writeText(this.saved.voice); UI.toast("voice 路径已复制"); }
    catch (_) {
      const input = this.box.querySelector("[data-seed-voice]"); input?.select();
      UI.toast("已选中路径，请按 Ctrl+C 复制");
    }
  },
};
window.SeedAudioTool = SeedAudioTool;
