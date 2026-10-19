/* 《给她完整的一生》：独立工作副本与整区保存，时间线数组不按索引补默认。 */
(function () {
  "use strict";
  const TYPES = { dialogue:"对白", memory:"研发回忆", journey:"旅途回忆", split:"双侧回忆", wall:"纪念墙", ending:"片尾", caption:"字幕", effect:"特效" };
  const TRACKS = {scene:"主画面",memory:"研发历程",journey:"成长画面",caption:"字幕",fx:"光效"};
  const CAMERAS = {still:"固定镜头",push:"缓缓推近",pull:"缓缓拉远","drift-left":"向左游移","drift-right":"向右游移"};
  const TRANSITIONS = {dissolve:"柔和叠化",flash:"白场切换",slide:"滑入",none:"直接切换"};
  const MOTIONS = { none:"无动画", fade:"淡入", pan:"缓慢推进", rise:"向上浮现", particles:"蓝色粒子" };
  const MILESTONES={first_project:"第一次立项",first_V1:"第一次通过 V1",first_top10:"进入排行榜前十",first_rank1:"登上排行榜第一",body_awake:"开智出舱",body_V5:"V5 成长节点",'body_V5.5':"V5.5 成长节点",body_V6:"V6 成长节点",'body_V6.5':"V6.5 成长节点",stage:"指定阶段首次通过",city_hospital:'旅途 · 医院',city_school:'旅途 · 校园',city_market:'旅途 · 市场',city_work:'旅途 · 工作',city_eldercare:'旅途 · 陪伴老人'};
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const imageURL = path => /^\/?resource\/[\w\-\u4e00-\u9fff /().&]+\.(webp|png|jpe?g|gif)$/i.test(String(path || "")) ? "/"+String(window.ResourcePaths?ResourcePaths.canonical(String(path)):path).replace(/^\//, "") : "";
  const audioURL = path => /^\/?resource\/[\w\-\u4e00-\u9fff /().&]+\.(m4a|mp3|ogg|wav|aac|flac)$/i.test(String(path || "")) ? "/"+String(path).replace(/^\//, "") : "";
  const videoURL = path => /^\/?resource\/[\w\-\u4e00-\u9fff /().&]+\.(mp4|webm|ogv)$/i.test(String(path || "")) ? "/"+String(path).replace(/^\//, "") : "";
  const field = (name, label, value, opts = {}) => '<label class="ls-field"><span>'+esc(label)+'</span>'+(opts.checkbox ? '<input data-ls-field="'+name+'" type="checkbox"'+(value?' checked':'')+'>' : opts.options
    ? '<select data-ls-field="'+name+'">'+Object.entries(opts.options).map(([v,t]) => '<option value="'+esc(v)+'"'+(v === value ? ' selected' : '')+'>'+esc(t)+'</option>').join("")+'</select>'
    : opts.area ? '<textarea rows="'+(opts.rows||3)+'" data-ls-field="'+name+'">'+esc(value)+'</textarea>'
    : '<input data-ls-field="'+name+'" type="'+(opts.number ? 'number' : 'text')+'" value="'+esc(value)+'"'+(opts.number ? ' min="'+(opts.min == null ? 0 : opts.min)+'" step="'+(opts.step==null?.1:opts.step)+'"' : '')+' placeholder="'+esc(opts.placeholder||"")+'">')+'</label>';
  const button = (action, label, attrs = "") => '<button type="button" class="btn btn-sm" data-ls-action="'+action+'" '+attrs+'>'+label+'</button>';
  // Keep each resource's path and picker in a single grid cell. The input's
  // explicit label leaves the picker and native audio controls independent.
  const assetField = (name,label,value,opts={}) => '<div class="ls-field ls-asset-field"><label for="ls-asset-'+esc(name)+'">'+esc(label)+'</label><div class="ls-asset-controls"><input id="ls-asset-'+esc(name)+'" data-ls-field="'+esc(name)+'" value="'+esc(value)+'" placeholder="'+esc(opts.placeholder||'留空沿用上一段')+'">'+button('pick',opts.pickLabel||'选择素材','data-field="'+esc(name)+'"')+'</div>'+(opts.voice?'<audio data-ls-voice-sample controls preload="none" aria-label="对白配音试听"'+(audioURL(value)?' src="'+esc(audioURL(value))+'"':' hidden')+'></audio><small data-ls-voice-note>'+esc(value&&!audioURL(value)?'请选择 resource 目录内的音频。':value?'试听只播放当前配音，不会推进演出。':'未配置配音；自动模式按台词阅读时间继续。')+'</small>':'')+'</div>';
  const tool = {
    data: null, loaded: false, dirty: false, selected: 0, _counter: 0,
    _playing: false, _elapsed: 0, _frame: 0, _audio: null, _audioEnabled: false,
    _zoom: 16, _snap: true, _undo: [], _redo: [], _lastGroup: null,
    empty() { return { TITLE:"给她完整的一生", FINALE:{ version:1, backgroundEffect:"star-lake", bgm:"resource/sound/BGM/Blue Envelope.m4a", audioStartAt:0, timeline:[] } }; },
    finale() { return this.data && this.data.FINALE || {}; },
    context() { return this._context||window.GameCfgTool&&window.GameCfgTool.data||window.GameDefaults&&window.GameDefaults.base||{}; },
    // Match GameCore.whaleName/fillWhaleText with a read-only sample, never
    // expand placeholders in the editable source or depend on a player's save.
    previewVars() {
      const model=String(this.context().MODEL_NAME_DEFAULT||'小鲸鱼');
      return {whale:model.trim().replace(/[\s·_-]*[vV]\d+(?:\.\d+)?$/,' ').trim().slice(0,12)||'小鲸鱼',model,param:'',arch:'—',archName:'—',archId:''};
    },
    previewText(value) {
      const vars=this.previewVars();
      return String(value==null?'':value).replace(/小鲸鱼|鲸鱼娘/g,()=>'{whale}').replace(/\{(whale|model|param|archName|archId|arch)\}/g,(_,key)=>vars[key]);
    },
    previewTitle() { return this.previewText(this.data&&this.data.TITLE||'给她完整的一生'); },
    previewHeading(cue) {
      const hidden=true;
      return '<header class="ls-film-heading"'+(hidden?' hidden':'')+'><small>BLUE ENVELOPE</small><span class="ls-top-caption">'+esc(this.previewText(cue&&cue.caption)||this.previewTitle())+'</span></header>';
    },
    previewFilmTitle(cue) {
      return '<div class="ls-film-title"><small>'+esc(this.previewTitle())+'</small><h3>'+esc(this.previewText(cue.caption||cue.text))+'</h3>'+(cue.caption&&cue.text?'<p>'+esc(this.previewText(cue.text))+'</p>':'')+'</div>';
    },
    previewCaptionLines(label) {
      if(!label)return [];
      // The shared dissolve creates glyph nodes. Rewrap those same nodes after
      // create(), just like runtime captionLines(), to keep the real mask.
      if(!label.querySelector('.ls-farewell-line')){
        const fragment=document.createDocumentFragment();let line=null,index=0;
        for(const node of [...label.childNodes]){
          if(node.nodeType===3&&/\n/.test(node.textContent)){fragment.appendChild(node);line=null;index++;continue;}
          if(!line){line=document.createElement('span');line.className='ls-farewell-line';line.dataset.captionLine=String(index);fragment.appendChild(line);}
          line.appendChild(node);
        }
        label.replaceChildren(fragment);
      }
      return [...label.querySelectorAll('.ls-farewell-line')];
    },
    unlockStage() { const cfg=this.context();return this.finale().unlockStage||(cfg.EMBODIED||{}).FINAL_STAGE||(cfg.VER_ORDER||[]).at(-1)||'V6.5'; },
    rows() { return Array.isArray(this.finale().timeline) ? this.finale().timeline : []; },
    cardTarget(scope) { return scope==='cue'?this.rows()[this.selected]:this.finale(); },
    cards(scope='film') { const target=this.cardTarget(scope);return target&&Array.isArray(target.wallCards)?target.wallCards:[]; },
    milestoneOptions() {
      const journey=window.JourneyTool,route=journey&&journey.loaded&&journey.data||this.context().CITY_JOURNEY||{};
      const options={...MILESTONES,...Object.fromEntries((route.STOPS||[]).filter(n=>n&&n.id).map(n=>['city_'+n.id,'旅途 · '+(n.label||n.id)]))};
      // A removed stop can still have real dated memories in an existing save.
      for(const card of [...this.cards(),...this.rows().flatMap(cue=>Array.isArray(cue.wallCards)?cue.wallCards:[])])if(card&&typeof card.milestone==='string'&&card.milestone.startsWith('city_')&&!options[card.milestone])options[card.milestone]='旅途 · '+card.milestone.slice(5)+'（保留的纪念节点）';
      return options;
    },
    normalize(data) {
      const out = data && typeof data === "object" && !Array.isArray(data) ? clone(data) : this.empty();
      if (!out.FINALE || typeof out.FINALE !== "object" || Array.isArray(out.FINALE)) out.FINALE = this.empty().FINALE;
      if (!Array.isArray(out.FINALE.timeline)) out.FINALE.timeline = [];
      return out;
    },
    /* [feature:life-timeline-editor-schedule] */
    schedule() {
      return LifeTimeline.normalize(this.rows(),this.finale()).map(cue=>({row:this.rows()[cue.index],index:cue.index,start:cue.start,end:cue.end,duration:cue.duration,track:cue.track}));
    },
    previewWallCues() { return this.schedule().filter(cue=>cue.track==='scene'&&cue.row.type==='wall'&&cue.row.walkMode!=='stop').map(cue=>({...cue.row,start:cue.start,end:cue.end,duration:cue.duration})); },
    previewWalkMotion() {
      const walls=this.previewWallCues(),last=walls.at(-1),stop=this.schedule().find(cue=>cue.track==='scene'&&cue.row.type==='wall'&&cue.row.walkMode==='stop'&&(!last||cue.start>=last.end-.01));
      return LifeTimeline.walkMotion(walls,stop&&{...stop.row,start:stop.start,end:stop.end,duration:stop.duration},Number(this.finale().audioStartAt)||0,this._elapsed);
    },
    canAgeAnchor(cue) {
      const scenes=this.schedule().filter(row=>row.track==='scene').sort((a,b)=>a.start-b.start||a.index-b.index),index=scenes.findIndex(row=>row.row===cue),current=scenes[index],previous=scenes[index-1];
      if(!current||!previous||cue.type!=='wall'||cue.walkMode==='stop'||previous.row.type!=='wall'||previous.row.walkMode==='stop'||Math.abs(previous.end-current.start)>.001)return false;
      const cards=row=>Array.isArray(row.wallCards)?row.wallCards:Array.isArray(this.finale().wallCards)?this.finale().wallCards:[];
      return JSON.stringify(cards(cue))===JSON.stringify(cards(previous.row));
    },
    ageAnchorOptions() {
      const options={'':'按片段时间',...Object.fromEntries(Object.entries(this.milestoneOptions()).filter(([key])=>key!=='stage'))};
      for(const stage of this.context().VER_ORDER||[])options['stage_'+stage]=stage+' 首次通过';
      for(const card of [...this.cards(),...this.rows().flatMap(cue=>Array.isArray(cue.wallCards)?cue.wallCards:[])])if(card&&card.milestone){const key=card.milestone==='stage'?'stage_'+card.stage:card.milestone;options[key]=card.title||options[key]||key;}
      for(const cue of this.rows())if(cue.ageMilestone&&!options[cue.ageMilestone])options[cue.ageMilestone]=cue.ageMilestone+'（保留的节点）';
      return options;
    },
    /* [/feature:life-timeline-editor-schedule] */
    total() { const scene=this.schedule().reduce((a,cue) => Math.max(a,cue.end),0),f=this.finale();return f.audioDuration!=null?Math.max(scene,(Number(f.audioStartAt)||0)+Math.max(.1,Number(f.audioDuration)||.1)):scene; },
    async refresh() {
      this.pause();
      this.resetPreviewContinuity();
      try {
          const response = await fetch("/api/game-cfg");
          if (!response.ok) throw new Error("无法读取配置");
          const result = await response.json();
          if (window.CfgSync) window.CfgSync.note(result);
          const saved = result.config || {};
          const defaults = window.GameDefaults && window.GameDefaults.base || {};
          this._context=window.GameCfgTool&&typeof window.GameCfgTool.deepMerge==='function'?GameCfgTool.deepMerge(defaults,saved):{...clone(defaults),...clone(saved)};
          if(!this.loaded){
            this.data = this.normalize(Object.prototype.hasOwnProperty.call(saved,"LIFE_STORY") ? saved.LIFE_STORY : defaults.LIFE_STORY);
            this._savedSource = JSON.stringify(saved.LIFE_STORY == null ? null : saved.LIFE_STORY);
            this.loaded = true;
          }
        } catch (error) {
          if(this.loaded){this.render();return;}
          const root = document.getElementById("life-story-config");
          if (root) root.innerHTML = '<p class="ls-error" role="alert">读取演出配置失败。请重新打开此分页，已有配置尚未改动。</p>';
          return;
        }
      this.selected = Math.max(0,Math.min(this.selected,this.rows().length-1));
      this.render();
    },
    mark() {
      this.dirty = true;
      if (typeof App !== "undefined" && App.markCfgDirty) App.markCfgDirty();
      this.renderErrors();
    },
    remember(label,group=null,before=null) {
      if (!this.data || group && group === this._lastGroup) return;
      this._undo.push({data:before||clone(this.data),selected:this.selected,label});
      if (this._undo.length>60) this._undo.shift();
      this._redo=[];this._lastGroup=group;
    },
    history(direction) {
      this.pause();this.cancelGesture();
      this.resetPreviewContinuity();
      const from=direction === "undo" ? this._undo : this._redo, to=direction === "undo" ? this._redo : this._undo;
      const item=from.pop();if(!item)return;
      to.push({data:clone(this.data),selected:this.selected,label:item.label});
      this.data=clone(item.data);this.selected=Math.max(0,Math.min(item.selected,this.rows().length-1));this._lastGroup=null;
      this._elapsed=Math.min(this._elapsed,this.total());this.mark();this.render();
    },
    musicClip() {
      const f=this.finale(),start=Math.max(0,Number(f.audioStartAt)||0),offset=Math.max(0,Number(f.audioOffset)||0);
      const duration=f.audioDuration!=null ? Math.max(.1,Number(f.audioDuration)||.1) : Math.max(.1,this.total()-start);
      return {start,end:start+duration,duration,offset};
    },
    snapTime(time,exclude,free=false) {
      time=Math.max(0,time);if(!this._snap||free)return Math.round(time*1000)/1000;
      const anchors=[0,this._elapsed,...this.schedule().filter(c=>c.row.id!==exclude).flatMap(c=>[c.start,c.end])];
      if(exclude!=="__music"){const music=this.musicClip();anchors.push(music.start,music.end);}
      const closest=anchors.reduce((best,t)=>Math.abs(t-time)<Math.abs(best-time)?t:best,Math.round(time*10)/10);
      return Math.round((Math.abs(closest-time)<=7/this._zoom?closest:Math.round(time*10)/10)*1000)/1000;
    },
    beginGesture(event) {
      if(event.button!=null&&event.button!==0||!this.loaded)return;
      const target=event.target.closest&&event.target.closest("[data-ls-clip],[data-ls-ruler],[data-ls-playhead]");if(!target)return;
      this.pause();this.cancelGesture();
      this.resetPreviewContinuity();
      const id=target.dataset.lsClip,handle=event.target.closest&&event.target.closest("[data-ls-trim]");
      const scroll=document.getElementById("ls-timeline-scroll");
      if(!id){const rect=(document.getElementById("ls-ruler-lane")||target).getBoundingClientRect();this._gesture={mode:"seek",left:rect.left,pointerId:event.pointerId};this.updateGesture(event);}
      else{
        const cue=id==="__music"?this.musicClip():this.schedule().find(c=>c.row.id===id);if(!cue)return;
        if(id!=="__music"){this.selected=cue.index;this.renderInspector();}
        this._gesture={id,mode:handle?handle.dataset.lsTrim:"move",startX:event.clientX,startY:event.clientY,start:cue.start,end:cue.end,duration:cue.duration,offset:cue.offset||0,audioAt:cue.row&&cue.row.audioAt,before:clone(this.data),pointerId:event.pointerId,scrollStart:scroll?scroll.scrollLeft:0,changed:false};
      }
      if(target.setPointerCapture&&event.pointerId!=null)try{target.setPointerCapture(event.pointerId);}catch(_){}
      event.preventDefault();
    },
    updateGesture(event) {
      const g=this._gesture;if(!g)return;
      if(g.mode==="seek") {this._elapsed=Math.max(0,Math.min(this.total(),(event.clientX-g.left)/this._zoom));this.renderPreview();this.updatePlayhead();return;}
      const scroll=document.getElementById("ls-timeline-scroll"),dx=event.clientX-g.startX+(scroll?scroll.scrollLeft-g.scrollStart:0);
      const targetTrack=g.mode==="move"&&g.id!=="__music"?[...document.querySelectorAll('.ls-track-row[data-track]')].find(row=>{const rect=row.getBoundingClientRect();return TRACKS[row.dataset.track]&&rect.height>0&&event.clientY>=rect.top&&event.clientY<rect.bottom;}):null;
      const current=this.rows().find(c=>c.id===g.id);
      if(Math.abs(dx)<2&&!g.changed&&!(targetTrack&&targetTrack.dataset.track!==(current.track||'scene')))return;
      if(!g.changed){for(const cue of this.schedule())cue.row.at=cue.start;g.changed=true;}
      const delta=dx/this._zoom,proposed=this.snapTime((g.mode==="end"?g.end:g.start)+delta,g.id,event.shiftKey);
      let start=g.start,end=g.end;
      if(g.mode==="start")start=Math.min(end-.1,proposed);else if(g.mode==="end")end=Math.max(start+.1,Math.min(start+600,proposed));else {start=proposed;end=start+g.duration;}
      if(g.id==="__music"){
        const f=this.finale();f.audioStartAt=Math.round(start*1000)/1000;f.audioDuration=Math.round((end-start)*1000)/1000;
        if(g.mode==="start")f.audioOffset=Math.max(0,g.offset+start-g.start);
      }else{
        const row=this.rows().find(c=>c.id===g.id);row.at=Math.round(start*1000)/1000;row.duration=Math.round((end-start)*1000)/1000;
        if(targetTrack)row.track=targetTrack.dataset.track;
        if(g.mode==="start"&&g.audioAt!=null)row.audioAt=Math.max(0,Number(g.audioAt)+start-g.start);
      }
      const el=[...document.querySelectorAll('[data-ls-clip]')].find(x=>x.dataset.lsClip===g.id);if(el){if(targetTrack)targetTrack.querySelector('.ls-track-lane').appendChild(el);el.style.left=(start*this._zoom)+"px";el.style.width=Math.max(14,(end-start)*this._zoom)+"px";el.title=start.toFixed(2)+"s → "+end.toFixed(2)+"s";}
      this._elapsed=start;this.renderPreview();this.updatePlayhead();this.renderInspector();
    },
    endGesture() {
      const g=this._gesture;if(!g)return;this._gesture=null;
      if(g.changed){this.remember("调整片段",null,g.before);this.mark();this._ignoreClickUntil=Date.now()+250;this.renderList();}
    },
    cancelGesture() {
      const g=this._gesture;if(!g)return;this._gesture=null;
      if(g.changed){this.data=clone(g.before);this.renderList();this.renderInspector();this.renderPreview();}
    },
    init() {
      const root = document.getElementById("life-story-config");
      if (!root || this._bound) return;
      this._bound = true;
      root.addEventListener("click", event => {
        if(Date.now()<(this._ignoreClickUntil||0))return;
        const action = event.target.closest("[data-ls-action]");
        if (action) { this.action(action.dataset.lsAction,action); return; }
        const row = event.target.closest("[data-ls-row]");
        if (row) this.select(Number(row.dataset.lsRow));
      });
      root.addEventListener("input", event => this.input(event.target));
      root.addEventListener('play',event=>{if(event.target.matches?.('[data-ls-voice-sample]'))this.pause({keepSample:true});},true);
      root.addEventListener("pointerdown",event=>this.beginGesture(event));
      document.addEventListener("pointermove",event=>this.updateGesture(event));
      document.addEventListener("pointerup",()=>this.endGesture());
      document.addEventListener("pointercancel",()=>this.cancelGesture());
      document.addEventListener("keydown",event=>{
        if(event.key==="Escape"&&this._gesture){this.cancelGesture();return;}
        const inside=event.target&&event.target.closest&&event.target.closest("#life-story-config");
        if(!inside||['INPUT','TEXTAREA'].includes(event.target.tagName))return;
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();this.history(event.shiftKey?"redo":"undo");}
        else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="y"){event.preventDefault();this.history("redo");}
        else if(event.code==="Space"){event.preventDefault();this._playing?this.pause():this.play();}
        else if(event.key==="Enter"&&event.target.dataset.lsRow!=null){event.preventDefault();this.select(Number(event.target.dataset.lsRow));}
      });
      root.addEventListener("change", event => {
        if (event.target.id === "life-story-import") this.importFile(event.target.files && event.target.files[0]);
        else if (event.target.id === "ls-preview-audio") {
          this._audioEnabled = event.target.checked;
          if (this._audio) this._audio.muted = !this._audioEnabled;
        }
        else if ((event.target.dataset.lsField||event.target.dataset.lsCard!=null) && event.target.tagName === "SELECT") this.input(event.target);
      });
      root.addEventListener("dragstart", event => {
        const row = event.target.closest("[data-ls-row]");
        if (!row || !event.dataTransfer) return;
        this._dragId = this.rows()[Number(row.dataset.lsRow)].id;
        event.dataTransfer.setData("text/plain",this._dragId);
        event.dataTransfer.effectAllowed = "move";
      });
      root.addEventListener("dragover", event => {
        if (this._dragId && event.target.closest("[data-ls-row]")) event.preventDefault();
      });
      root.addEventListener("drop", event => {
        const row = event.target.closest("[data-ls-row]");
        if (!row || !this._dragId) return;
        event.preventDefault();
        const source = this.rows().findIndex(cue => cue.id === this._dragId);
        this.move(source,Number(row.dataset.lsRow));
        this._dragId = null;
      });
      root.addEventListener("dragend", () => { this._dragId = null; });
      document.addEventListener("visibilitychange", () => { if (document.hidden) { this.pause();this.cancelGesture(); } });
      window.addEventListener("pagehide", () => this.close());
      window.addEventListener("beforeunload", () => this.close());
      window.addEventListener('resize',()=>{const page=document.getElementById('page-life-story');if(page&&page.classList.contains('active')){this.measurePreviewWall();this.renderPreview();}});
      if (typeof MutationObserver !== "undefined") {
        const page = document.getElementById("page-life-story");
        this._observer = new MutationObserver(() => { if (!page.classList.contains("active")) this.close(); });
        this._observer.observe(page,{attributes:true,attributeFilter:["class"]});
      }
    },
    uid() {
      let id;
      do { id = "life_"+Date.now().toString(36)+"_"+(++this._counter).toString(36); } while (this.rows().some(cue => cue.id === id));
      return id;
    },
    add(type = "dialogue") {
      if (!TYPES[type]) return;
      this.pause();
      this.remember("添加片段");
      const cue = {id:this.uid(),type,duration:type === "dialogue" ? 6 : 10,background:"",sprite:"",speaker:"鲸鱼娘",text:"",caption:"",motion:type === "ending" ? "particles" : "fade"};
      if(type==="caption"||type==="effect"){cue.track=type==="caption"?"caption":"fx";cue.at=this._elapsed;}
      const index = this.rows().length ? this.selected+1 : 0;
      this.rows().splice(index,0,cue);
      this.selected = index;
      this.mark(); this.render();
    },
    move(from,to) {
      const rows = this.rows();
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= rows.length || to >= rows.length || from === to) return;
      this.pause();
      this.remember("移动顺序");
      const selectedId = rows[this.selected] && rows[this.selected].id;
      rows.splice(to,0,rows.splice(from,1)[0]);
      this.selected = rows.findIndex(cue => cue.id === selectedId);
      this.mark(); this.render();
    },
    duplicate(index) {
      if (!this.rows()[index]) return;
      this.pause();
      this.remember("复制片段");
      const cue = clone(this.rows()[index]);
      cue.id = this.uid();
      // A duplicate follows its source; an absolute anchor would cover the original cue.
      if(this.schedule()[index].track==='scene')delete cue.at;else cue.at=this.schedule()[index].end;
      this.rows().splice(index+1,0,cue);
      this.selected = index+1;
      this.mark(); this.render();
    },
    remove(index) {
      if (!this.rows()[index]) return;
      this.pause();
      this.remember("删除片段");
      this.rows().splice(index,1);
      this.selected = Math.max(0,Math.min(index,this.rows().length-1));
      this.mark(); this.render();
    },
    select(index) {
      if (!this.rows()[index]) return;
      this.pause(); this.selected = index;this._lastGroup=null;this.resetPreviewContinuity();
      this._elapsed = this.schedule()[index].start;
      this.renderList(); this.renderInspector(); this.renderPreview();
    },
    input(element) {
      if (!this.loaded) return;
      if(element.id==="ls-timeline-zoom"){this._zoom=Math.max(.25,Math.min(100,Number(element.value)||16));this.renderTimeline();return;}
      if (element.id === "ls-preview-seek") {
        this.pause(); this.resetPreviewContinuity();this._elapsed = Number(element.value)||0; this.renderPreview(); return;
      }
      const name = element.dataset.lsField;
      if(element.dataset.lsWalkClip!=null){
        const age=String(element.dataset.lsWalkClip),key=element.dataset.lsWalkField;
        if(!['src','fallback','poster','rest','duration','aspect'].includes(key))return;
        this.pause();this.remember('修改行走视频','walk:'+age+':'+key);
        const clips=this.finale().walkClips||(this.finale().walkClips={}),clip=clips[age]||(clips[age]={});
        if(['duration','aspect'].includes(key)&&element.value==='')delete clip[key];
        else clip[key]=['duration','aspect'].includes(key)?Number(element.value):element.value;
        this.mark();this.renderPreview();return;
      }
      if(element.dataset.lsCard!=null){
        const index=Number(element.dataset.lsCard),scope=element.dataset.lsCardScope||'film',card=this.cards(scope)[index],key=element.dataset.lsCardField;if(!card||!key)return;
        this.pause();this.remember('修改纪念照片','card:'+card.id+':'+key);card[key]=element.value;this.mark();this.renderPreview();return;
      }
      if (!name) return;
      this.pause();
      this.resetPreviewContinuity();
      const globalField = ["TITLE","bgm","introBgm","audioStartAt","audioOffset","audioDuration","enabled","unlockStage","forceLandscape","fadeSeconds","dialoguePanelOpacity"].includes(name)||name==='backgroundEffect'&&element.dataset.lsScope==='film';
      const target = name === "TITLE" ? this.data : globalField ? this.finale() : this.rows()[this.selected];
      if (!target) return;
      this.remember("修改属性","field:"+(globalField?"film":target.id)+":"+name);
    /* [feature:life-timeline-editor-numeric] */
      const numeric = ["duration","at","audioStartAt","audioAt","audioOffset","audioDuration","fadeSeconds","dialoguePanelOpacity","focusX","focusY","age","walkFrames","walkColumns","walkRows","walkAspect","walkRestFrame","walkFps","wallSpeed","whiteFade","walkDuration","slowMotion"].includes(name);
      if(['slowMotion','whiteFade'].includes(name)&&element.value===''){delete target[name];this.mark();this.renderList();this.renderPreview();return;}
    /* [/feature:life-timeline-editor-numeric] */
      if (numeric && ["at","audioAt","audioDuration"].includes(name) && element.value === "") delete target[name];
      else target[name] = element.type === "checkbox" ? element.checked : numeric ? (element.value === "" ? "" : Number(element.value)) : element.value;
      this.mark(); this.renderList(); this.renderPreview();
      if(name==='voice')this.updateVoiceSample();
    /* [feature:life-timeline-editor-mode] */
      if (name === "type" || name === "track" || name === "endingStyle" || name === "walkMode") this.renderInspector();
    /* [/feature:life-timeline-editor-mode] */
    },
    action(action,element) {
      const index = element.dataset.index == null ? this.selected : Number(element.dataset.index);
      const cardScope=element.dataset.lsCardScope||'film';
      if(action==='card-custom'||action==='card-inherit'){
        const cue=this.rows()[this.selected];if(!cue||cue.type!=='wall')return;
        this.pause();this.remember('切换纪念照片');if(action==='card-custom')cue.wallCards=clone(this.cards());else delete cue.wallCards;
        this.mark();this.render();
      }
      else if(['card-add','card-delete','card-up','card-down'].includes(action)){
        this.pause();this.remember('编排纪念照片');const target=this.cardTarget(cardScope);if(!target)return;const cards=this.cards(cardScope);if(!Array.isArray(target.wallCards))target.wallCards=cards;
        if(action==='card-add')cards.push({id:this.uid(),title:'一起走过的日子',photo:'',milestone:'stage',stage:'V1'});
        else if(action==='card-delete')cards.splice(index,1);
        else if(action==='card-up'&&index>0)cards.splice(index-1,0,cards.splice(index,1)[0]);
        else if(action==='card-down'&&index<cards.length-1)cards.splice(index+1,0,cards.splice(index,1)[0]);
        this.mark();this.render();
      }
      else if (action === "add") this.add((document.getElementById("ls-add-type")||{}).value || "dialogue");
      else if (action === "up") this.move(index,index-1);
      else if (action === "down") this.move(index,index+1);
      else if (action === "copy") this.duplicate(index);
      else if (action === "delete") this.remove(index);
      else if (action === "undo" || action === "redo") this.history(action);
      else if (action === "snap") { this._snap=!this._snap;element.setAttribute("aria-pressed",String(this._snap));element.textContent=this._snap?"吸附 ✓":"吸附"; }
      else if (action === "fit") {const scroll=document.getElementById("ls-timeline-scroll");this._zoom=Math.max(.25,Math.min(100,(((scroll&&scroll.clientWidth)||900)-120)/(this.total()+5)));this.renderTimeline();if(scroll)scroll.scrollLeft=0;const slider=document.getElementById("ls-timeline-zoom");if(slider)slider.value=this._zoom;}
      else if (action === "play") this._playing ? this.pause() : this.play();
      else if (action === "restart") { this.pause(); this.resetPreviewContinuity();this._elapsed = 0; this.renderPreview(); }
      else if (action === "next") {
        this.pause();
        this.releasePreviewVoice();
        this._previewIntroTransition=null;
        const cues = this.schedule().filter(cue=>cue.track==='scene').sort((a,b) => a.start-b.start || a.index-b.index);
        const current = this.cueAt(this._elapsed);
        const next = current ? cues[cues.findIndex(cue => cue.index === current.index)+1] : cues[0];
        if (next) {
          const continuous=this.continuePreviewDialogue(current,next);
          this._previewClockOffset=(this._previewClockOffset||0)+this._elapsed-next.start;
          if(!continuous){this._previewDialogueCamera=null;this._previewCue=null;}
          this._elapsed = next.start; this.selected = next.index; this.renderList(); this.renderInspector();
        }
        else this._elapsed = this.total();
        this.renderPreview();
      }
      else if (action === "portrait") {
        const stage = document.getElementById("ls-preview-stage");
        if (stage) { stage.classList.toggle("is-portrait"); element.setAttribute("aria-pressed",String(stage.classList.contains("is-portrait"))); this.measurePreviewWall(); this.renderPreview(); }
      }
      else if (action === "export") this.export();
      else if (action === "import") { const input = document.getElementById("life-story-import"); if (input) input.click(); }
      else if (action === "pick") this.pick(element.dataset.field);
      else if (action === "card-pick") this.pick('photo',{card:Number(element.dataset.index),cardScope});
      else if (action === "walk-pick") this.pick(element.dataset.field,{age:element.dataset.age});
    },
    async pick(name, scope={}) {
      if (!window.ResPicker || !window.ResPicker.pick) return;
      this.pause();this.resetPreviewContinuity();
      const isAudio = name === "bgm" || name === "introBgm" || name === 'voice';
      const isVideo=['video','walkVideo'].includes(name)||scope.age!=null&&name==='src';
      const target = scope.card!=null ? this.cards(scope.cardScope)[scope.card] : scope.age!=null ? ((this.finale().walkClips||{})[scope.age]||{}) : name==='bgm'||name==='introBgm' ? this.finale() : this.rows()[this.selected];
      if (!target) return;
      const title={background:'选择背景',sprite:'选择立绘',voice:'选择对白配音',introBgm:'选择开场音乐',bgm:'选择终章音乐',photo:'选择纪念照片',poster:'选择加载画面',walkPoster:'选择加载画面',rest:'选择停步画面'}[name]||(isVideo?'选择视频':'选择图片');
      const path = await window.ResPicker.pick(target[name]||"",{kind:isAudio ? "audio" : isVideo ? "video" : "image",title});
      if (path === null) return;
      this.remember("选择素材");
      if(scope.age!=null)(this.finale().walkClips||(this.finale().walkClips={}))[scope.age]=target;
      target[name] = path;
      this.mark(); this.render();
    },
    releaseInspectorAudio(clear=true) {
      for(const audio of document.querySelectorAll('[data-ls-voice-sample]')){
        if(!audio.getAttribute('src'))continue;
        audio.pause();if(clear){audio.removeAttribute('src');audio.load();}
      }
    },
    updateVoiceSample() {
      const sample=document.querySelector('#ls-inspector [data-ls-voice-sample]'),note=document.querySelector('#ls-inspector [data-ls-voice-note]');
      if(!sample)return;
      const value=this.rows()[this.selected]?.voice||'',src=audioURL(value);
      if(sample.getAttribute('src')!==src){if(sample.getAttribute('src')){sample.pause();sample.removeAttribute('src');sample.load();}if(src)sample.src=src;}
      sample.hidden=!src;
      if(note)note.textContent=value&&!src?'请选择 resource 目录内的音频。':src?'试听只播放当前配音，不会推进演出。':'未配置配音；自动模式按台词阅读时间继续。';
    },
    releasePreviewVoice() {
      this._previewVoice?.destroy();this._previewVoice=null;this._previewVoiceKey=null;
    },
    syncPreviewVoice(current) {
      if(this._previewIntroTransition?.kind==='entry'){this.releasePreviewVoice();return;}
      const row=current?.row,src=row?.type==='dialogue'?audioURL(row.voice):'';
      if(!src||!window.LifeDialogueVoice){this.releasePreviewVoice();return;}
      const key=row.id+'|'+src;
      if(this._previewVoiceKey!==key){
        this.releasePreviewVoice();
        if(!this._playing)return;
        this._previewVoice=LifeDialogueVoice.create({document,host:document.getElementById('life-story-config')});
        this._previewVoiceKey=key;
        this._previewVoice.start(src,{time:Math.max(0,this._elapsed-current.start)});
      }
      this._previewVoice?.sync(!this._playing||document.hidden||this._previewVideoBlocked||this._previewLandscapeBlocked||!!this._previewIntroTransition);
    },
    advancePreviewVoice(dt,stamp) {
      const current=this.cueAt(this._elapsed);this.syncPreviewVoice(current);
      const voice=this._previewVoice;if(!voice)return false;
      voice.tick(dt,stamp);
      if(['failed','blocked','none'].includes(voice.status().state))return false;
      const scenes=this.schedule().filter(c=>c.track==='scene').sort((a,b)=>a.start-b.start||a.index-b.index),next=scenes[scenes.findIndex(c=>c.row.id===current.row.id)+1],boundary=next?next.start:current.end;
      if(voice.readyAfter(1)){
        if(next&&this.previewIntroDialogue(current)&&!this.previewIntroDialogue(next)){this._elapsed=Math.max(current.start,boundary-.01);return this.advancePreviewIntro(dt);}
        this._elapsed=next?next.start:this.total();this.releasePreviewVoice();return true;
      }
      if(this._elapsed+dt>=boundary){this._elapsed=Math.max(current.start,boundary-.01);return true;}
      return false;
    },
    errors() {
      // Configuration semantics are the planner's responsibility.
      return [];
    },
    renderErrors() {
      const root = document.getElementById("ls-errors");
      if (!root) return;
      const errors = this.errors(); root.hidden = !errors.length;
      root.textContent = errors.join("\n");
    },
    renderCards(scope='film') {
      const stages=Object.fromEntries(((window.GameCfgTool&&window.GameCfgTool.data&&window.GameCfgTool.data.VER_ORDER)||(window.GameDefaults&&window.GameDefaults.base&&window.GameDefaults.base.VER_ORDER)||['V1','V5','V5.5','V6','V6.5']).map(v=>[v,v]));
      const attrs='data-ls-card-scope="'+scope+'"',target=this.cardTarget(scope),prefix=scope==='cue'?'本片段':'全片';
      if(scope==='cue'&&!Array.isArray(target&&target.wallCards))return '<details class="ls-wall-settings"><summary>本片段纪念墙照片</summary><p class="ls-tip">沿用全片照片。需要不同照片或顺序时，可建立本片段独立列表。</p>'+button('card-custom','使用本片段独立照片')+'</details>';
      const cardField=(index,key,label,value,options)=>'<label class="ls-field"><span>'+label+'</span>'+(options?'<select '+attrs+' data-ls-card="'+index+'" data-ls-card-field="'+key+'">'+Object.entries(options).map(([id,name])=>'<option value="'+esc(id)+'"'+(id===value?' selected':'')+'>'+esc(name)+'</option>').join('')+'</select>':'<input '+attrs+' data-ls-card="'+index+'" data-ls-card-field="'+key+'" value="'+esc(value)+'">')+'</label>';
      return '<details class="ls-wall-settings"><summary>'+prefix+'纪念墙照片与真实记录</summary><p class="ls-tip">照片顺序随墙面流动；日期由玩家存档读取，未留存的日期会明确提示。</p><div class="ls-wall-card-settings">'+this.cards(scope).map((card,index)=>'<article><b>照片 '+(index+1)+'</b><div>'+cardField(index,'title','标题',card&&card.title)+cardField(index,'photo','照片路径',card&&card.photo)+button('card-pick','选择照片',attrs+' data-index="'+index+'"')+cardField(index,'milestone','真实记录',card&&card.milestone,this.milestoneOptions())+cardField(index,'stage','阶段（指定阶段时）',card&&card.stage,stages)+'</div><p>'+button('card-up','↑',attrs+' data-index="'+index+'"')+button('card-down','↓',attrs+' data-index="'+index+'"')+button('card-delete','删除',attrs+' data-index="'+index+'"')+'</p></article>').join('')+'</div>'+button('card-add','+ 纪念照片',attrs)+(scope==='cue'?button('card-inherit','恢复沿用全片照片'):'')+'</details>';
    },
    renderWalkClips() {
      const clips=this.finale().walkClips||{},ages=[...new Set(['10','15','20','25',...Object.keys(clips)])];
      const labels={src:'透明行走视频',fallback:'循环 WebP 备用',poster:'加载 / 暂停画面',rest:'停步画面',duration:'循环长度（秒）',aspect:'画幅宽高比'};
      /* [feature:life-editor-body-appearance-clips] */
      return '<details class="ls-walk-video-settings"><summary>四种素体外观的行走视频</summary><p class="ls-tip">优先播放透明视频，备用 WebP 用于不支持透明视频的浏览器。视频始终静音，暂停和关闭会停止解码。点击素材按钮从 resource 中选择视频和备用图片。</p><div class="ls-walk-video-grid">'+ages.map(age=>'<article><b>'+esc(age)+' 岁素体外观</b>'+Object.entries(labels).map(([key,label])=>'<label class="ls-field"><span>'+label+'</span><input data-ls-walk-clip="'+esc(age)+'" data-ls-walk-field="'+key+'" '+(['duration','aspect'].includes(key)?'type="number" min="0.01" step="0.01"':'type="text"')+' value="'+esc((clips[age]||{})[key]??'')+'"></label>'+(!['duration','aspect'].includes(key)?button('walk-pick',key==='src'?'选择视频':'选择图片','data-age="'+esc(age)+'" data-field="'+key+'"'):'')).join('')+'</article>').join('')+'</div></details>';
      /* [/feature:life-editor-body-appearance-clips] */
    },
    render() {
      const root = document.getElementById("life-story-config");
      if (!root || !this.loaded) return;
      this.releaseInspectorAudio();this.releasePreviewVoice();
      const scrollState=[];
      for(let node=root;node;node=node.parentElement)scrollState.push({node,top:node.scrollTop,left:node.scrollLeft});
      const timelineScroll=root.querySelector('#ls-timeline-scroll'),inspector=root.querySelector('#ls-inspector');
      const timelinePosition=timelineScroll&&{top:timelineScroll.scrollTop,left:timelineScroll.scrollLeft};
      const inspectorPosition=inspector&&{top:inspector.scrollTop,left:inspector.scrollLeft};
      const openDetails=[...root.querySelectorAll('details')].filter(node=>node.open).map(node=>node.className);
      const stageOrder=(window.GameCfgTool&&window.GameCfgTool.data&&window.GameCfgTool.data.VER_ORDER)||(window.GameDefaults&&window.GameDefaults.base&&window.GameDefaults.base.VER_ORDER)||['V1','V1.5','V2','V2.5','V3','V3.5','V4','V4.5','V5','V5.5','V6','V6.5'];
      root.innerHTML = '<div class="ls-heading"><div><h2>完整的一生</h2><p>编排她的自白、成长与共同的回忆。修改后点右上角「保存全部」。</p></div><div class="ls-actions">'+button("undo","↶ 撤销",'id="ls-undo"')+button("redo","↷ 重做",'id="ls-redo"')+button("export","导出剧本")+button("import","导入剧本")+'</div></div><p id="ls-errors" class="ls-error" role="status" aria-live="polite" hidden></p>'
        +'<details class="ls-film-settings"><summary>演出与音乐设置</summary><div class="ls-global">'+field("TITLE","演出标题",this.data.TITLE)+field("enabled","启用完整的一生",this.finale().enabled!==false,{checkbox:true})+field("unlockStage","开放阶段",this.unlockStage(),{options:Object.fromEntries(stageOrder.map(v=>[v,v]))})+field("forceLandscape","纪念墙与片尾要求横屏",this.finale().forceLandscape!==false,{checkbox:true})+field("dialoguePanelOpacity","对话框底色不透明度（0 至 1）",this.finale().dialoguePanelOpacity,{number:true,min:0,max:1,step:0.05})+field("fadeSeconds","音乐结尾渐出（秒，0 = 不渐出）",this.finale().fadeSeconds==null?3:this.finale().fadeSeconds,{number:true,min:0})+field("backgroundEffect","全片背景效果",this.finale().backgroundEffect||"star-lake",{options:{"star-lake":"SVG 星轨与湖面倒影",none:"仅自定义背景"}}).replace('data-ls-field=','data-ls-scope="film" data-ls-field=')+assetField("introBgm","开场音乐（留空 = 静音）",this.finale().introBgm||"",{placeholder:"留空静音",pickLabel:"选择音乐"})+assetField("bgm","终章音乐",this.finale().bgm,{placeholder:"留空静音",pickLabel:"选择音乐"})+field("audioStartAt","主曲开始于全片第几秒",this.finale().audioStartAt,{number:true})+field("audioOffset","从音轨第几秒播放",this.finale().audioOffset||0,{number:true})+field("audioDuration","音乐片段时长（留空随演出）",this.finale().audioDuration==null?"":this.finale().audioDuration,{number:true})+'</div><p class="ls-tip ls-music-tip">开场音乐用于主曲开始前的对白，留空则整段静音、不会沿用终章音乐；两段音乐独立播放，开场不会改变主曲时间轴。</p></details>'
        +'<div class="ls-edit-bench"><section class="ls-preview"><div class="ls-preview-heading"><b>演出监看</b><span>回忆图表使用示例数据</span></div><div id="ls-preview-stage" class="ls-preview-stage"></div><div class="ls-preview-controls">'+button("restart","回到开头")+button("play","播放",'id="ls-play"')+button("next","下一段")+button("portrait","竖屏",'aria-pressed="false"')+'<label class="ls-audio-toggle"><input id="ls-preview-audio" type="checkbox"'+(this._audioEnabled ? ' checked' : '')+'>预览音乐</label></div><div class="ls-seek-row"><input id="ls-preview-seek" aria-label="预览时间" type="range" min="0" max="'+this.total()+'" step="0.1" value="'+this._elapsed+'"><output id="ls-preview-time"></output></div></section><div id="ls-inspector"></div></div>'
        +'<section class="ls-composer"><div class="ls-composer-toolbar"><div><b>时间线</b><span id="ls-total"></span></div><select id="ls-add-type" aria-label="新增片段类型">'+Object.entries(TYPES).map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join("")+'</select>'+button("add","+ 片段")+button("copy","复制")+button("delete","删除")+button("snap","吸附 ✓",'aria-pressed="'+this._snap+'"')+button("fit","适合窗口")+'<label>缩放<input id="ls-timeline-zoom" aria-label="时间线缩放" type="range" min="0.25" max="100" step="0.25" value="'+this._zoom+'"></label></div><div id="ls-timeline-scroll" class="ls-timeline-scroll"><div id="ls-timeline-tracks"></div></div><p class="ls-tip">拖动片段调整起点，拖两侧把手裁剪时长；点击标尺移动播放头。Shift 临时关闭吸附，Ctrl/⌘ Z 撤销。</p></section>'
        +this.renderWalkClips()+this.renderCards()+'<details class="ls-sequence"><summary>片段顺序与键盘操作</summary><ol id="ls-timeline-list"></ol></details><input id="life-story-import" type="file" accept="application/json,.json" hidden>';
      this.renderList(); this.renderInspector(); this.renderPreview(); this.renderErrors();
      for(const name of openDetails){const node=[...root.querySelectorAll('details')].find(item=>item.className===name);if(node)node.open=true;}
      const timeline=root.querySelector('#ls-timeline-scroll'),properties=root.querySelector('#ls-inspector');
      if(timeline&&timelinePosition){timeline.scrollTop=timelinePosition.top;timeline.scrollLeft=timelinePosition.left;}
      if(properties&&inspectorPosition){properties.scrollTop=inspectorPosition.top;properties.scrollLeft=inspectorPosition.left;}
      for(const entry of scrollState){entry.node.scrollTop=entry.top;entry.node.scrollLeft=entry.left;}
    },
    renderList() {
      const root = document.getElementById("ls-timeline-list"); if (!root) return;
      root.innerHTML = this.schedule().map(cue => '<li class="ls-cue'+(cue.index === this.selected ? ' selected' : '')+'" data-ls-row="'+cue.index+'" draggable="true"><button type="button" class="ls-cue-select" data-ls-row="'+cue.index+'" aria-pressed="'+(cue.index === this.selected)+'"><span class="ls-cue-number">'+(cue.index+1)+'</span><span class="ls-cue-summary"><b>'+esc(TYPES[cue.row.type]||"未知片段")+'</b><span>'+esc(cue.row.caption||cue.row.text||"尚未填写内容")+'</span></span><span class="ls-cue-time">'+cue.start.toFixed(1)+'s<br>'+cue.duration+'s</span></button><div class="ls-cue-actions">'+button("up","↑",'data-index="'+cue.index+'" aria-label="上移第 '+(cue.index+1)+' 段"'+(cue.index === 0 ? ' disabled' : ''))+button("down","↓",'data-index="'+cue.index+'" aria-label="下移第 '+(cue.index+1)+' 段"'+(cue.index === this.rows().length-1 ? ' disabled' : ''))+button("copy","复制",'data-index="'+cue.index+'"')+button("delete","删除",'data-index="'+cue.index+'"')+'</div></li>').join("");
      const total = document.getElementById("ls-total"); if (total) total.textContent = this.rows().length+" 段 · "+this.total().toFixed(1)+" 秒";
      this.renderTimeline();
    },
    renderTimeline() {
      const root=document.getElementById("ls-timeline-tracks");if(!root)return;
      const scroll=document.getElementById("ls-timeline-scroll"),previous=scroll?scroll.scrollLeft:0;
      const cues=this.schedule(),music=this.musicClip(),limit=Math.max(20,this.total()+5,music.end+3),width=Math.ceil(limit*this._zoom);
      const step=this._zoom>=50?1:this._zoom>=18?5:this._zoom>=9?10:20;
      const ticks=[];for(let t=0;t<=limit;t+=step)ticks.push('<span style="left:'+t*this._zoom+'px">'+Math.floor(t/60)+':'+String(t%60).padStart(2,"0")+'</span>');
      const clip=(c,musical=false)=>'<div class="ls-clip'+(!musical&&c.index===this.selected?' is-selected':'')+'" tabindex="0" role="button" data-ls-clip="'+esc(musical?'__music':c.row.id)+'"'+(!musical?' data-ls-row="'+c.index+'"':'')+' title="'+c.start.toFixed(2)+'s → '+c.end.toFixed(2)+'s" style="left:'+c.start*this._zoom+'px;width:'+Math.max(14,c.duration*this._zoom)+'px"><span class="ls-clip-handle" data-ls-trim="start" aria-label="裁剪开始"></span><div><b>'+esc(musical?'Blue Envelope':c.row.caption||TYPES[c.row.type])+'</b><small>'+c.duration.toFixed(1)+'s</small></div><span class="ls-clip-handle" data-ls-trim="end" aria-label="裁剪结束"></span></div>';
      root.style.width=(width+118)+"px";
      root.innerHTML='<div class="ls-ruler-row"><div class="ls-track-label">时间 / 秒</div><div id="ls-ruler-lane" class="ls-ruler-lane" data-ls-ruler style="width:'+width+'px">'+ticks.join("")+'</div></div>'+Object.entries(TRACKS).map(([key,name])=>'<div class="ls-track-row" data-track="'+key+'"><div class="ls-track-label"><i></i>'+name+'</div><div class="ls-track-lane" style="width:'+width+'px;--ls-grid:'+(step*this._zoom)+'px">'+cues.filter(c=>c.track===key).map(c=>clip(c)).join("")+'</div></div>').join("")+'<div class="ls-track-row" data-track="audio"><div class="ls-track-label"><i></i>音乐</div><div class="ls-track-lane" style="width:'+width+'px;--ls-grid:'+(step*this._zoom)+'px">'+(this.finale().bgm?clip(music,true):'')+'</div></div><div id="ls-playhead" class="ls-playhead" data-ls-playhead><button type="button" aria-label="移动播放头" data-ls-playhead></button></div>';
      if(scroll)scroll.scrollLeft=previous;this.updatePlayhead();
      const undo=document.getElementById("ls-undo"),redo=document.getElementById("ls-redo");if(undo)undo.disabled=!this._undo.length;if(redo)redo.disabled=!this._redo.length;
    },
    updatePlayhead() {const line=document.getElementById("ls-playhead");if(line)line.style.left=(118+this._elapsed*this._zoom)+"px";},
    renderInspector() {
      const root = document.getElementById("ls-inspector"); if (!root) return;
      this.releaseInspectorAudio();
      const cue = this.rows()[this.selected];
      if (!cue) { root.innerHTML = '<div class="ls-empty">添加第一个片段，开始编排她的故事。</div>'; return; }
      const stageOrder = (window.GameCfgTool && window.GameCfgTool.data && window.GameCfgTool.data.VER_ORDER) || (window.GameDefaults && window.GameDefaults.base && window.GameDefaults.base.VER_ORDER) || ["V1","V1.5","V2","V2.5","V3","V3.5","V4","V4.5","V5","V5.5","V6","V6.5"];
      const stageOptions = Object.fromEntries([["all","全部阶段"],...stageOrder.map(stage => [stage,stage])]);
      if (cue.stage && !stageOptions[cue.stage]) stageOptions[cue.stage] = cue.stage;
      const stageField = ['memory','split'].includes(cue.type)||cue.track==='memory' ? field("stage","真实历程阶段",cue.stage||"all",{options:stageOptions}) : "";
      const captionLabel=cue.track==='caption'||cue.type==='caption'?'字幕标题':cue.type==='ending'?'片尾字幕':cue.type==='wall'?'纪念墙标题':'顶部标题';
    /* [feature:life-timeline-editor-fields] */
      /* [feature:life-editor-body-appearance-fields] */
      const memorialFields=cue.type==='wall'?field('age','素体外观年龄',cue.age==null?10:cue.age,{number:true})+(cue.walkMode==='stop'?'':this.canAgeAnchor(cue)?field('ageMilestone','素体切换对应纪念节点',cue.ageMilestone||'',{options:this.ageAnchorOptions()}):'<p class="ls-tip">纪念墙起点按片段起点</p>')+(cue.walkMode==='stop'?field('slowMotion','停步前减速（秒）',cue.slowMotion==null?3:cue.slowMotion,{number:true,min:.1})+field('whiteFade','停步后渐入白屏（秒）',cue.whiteFade==null?3:cue.whiteFade,{number:true,min:.1}):'')+field('walkMode','人物动作',cue.walkMode||'walk',{options:{walk:'继续行走',stop:'停下脚步'}})+field('walkFrames','步态帧数',cue.walkFrames||4,{number:true,min:1,step:1})+field('walkColumns','步态列数',cue.walkColumns==null?cue.walkFrames||4:cue.walkColumns,{number:true,min:1,step:1})+field('walkRows','步态行数',cue.walkRows==null?1:cue.walkRows,{number:true,min:1,step:1})+field('walkAspect','单帧宽高比',cue.walkAspect==null?.75:cue.walkAspect,{number:true,min:.3,step:.01})+field('walkRestFrame','静止帧（从 0 开始）',cue.walkRestFrame==null?0:cue.walkRestFrame,{number:true,min:0,step:1})+field('walkFps','每秒步态帧数',cue.walkFps||5,{number:true,min:1})+field('wallSpeed','墙面推进节奏倍率',cue.wallSpeed==null?1:Number(cue.wallSpeed)>4?Number(cue.wallSpeed)/36:cue.wallSpeed,{number:true,min:.25,step:.05}):cue.type==='ending'?field('endingStyle','片尾画面',cue.endingStyle||'legacy',{options:{legacy:'原版致谢',portrait:'表情近景',video:'全屏特写视频',white:'白屏字幕'}}):'';
      /* [/feature:life-editor-body-appearance-fields] */
    /* [/feature:life-timeline-editor-fields] */
      /* [feature:life-editor-body-appearance-placeholder] */
      const videoFields=cue.type==='ending'&&cue.endingStyle==='video'?assetField('video','特写视频',cue.video||'',{placeholder:'resource/story/finale_closeup.mp4',pickLabel:'选择视频'})+assetField('poster','加载画面（可留空）',cue.poster||'',{placeholder:'留空不显示',pickLabel:'选择图片'})+field('whiteFade','片尾白屏渐出（秒）',cue.whiteFade==null?1.15:cue.whiteFade,{number:true,min:.1,step:.05}):cue.type==='wall'?assetField('walkVideo','此段行走视频',cue.walkVideo||'',{placeholder:'留空使用对应素体外观',pickLabel:'选择视频'})+assetField('walkFallback','此段循环 WebP 备用',cue.walkFallback||'',{pickLabel:'选择图片'})+assetField('walkPoster','此段加载画面',cue.walkPoster||'',{pickLabel:'选择图片'})+field('walkDuration','此段视频循环长度（秒）',cue.walkDuration==null?'':cue.walkDuration,{number:true,min:.01,step:.01}):'';
      /* [/feature:life-editor-body-appearance-placeholder] */
      /* 预览黑屏说明：开场对白段本来就是游戏原版的黑屏演出；背景/人物路径无效时预览也会静默不显示。
         不给提示时玩家会把「加了图还是黑的」当场故障。 */
      const pictureNote=(function(){const sc=this.schedule().find(r=>r.index===this.selected);if(!sc||sc.track!=='scene'||cue.track!=='scene')return '';
        if(this.previewIntroDialogue(sc))return '<p class="ls-tip ls-property-wide">此段属于开场对白：按游戏原版呈现黑屏，背景与人物都不参与这段演出（不是预览故障）。</p>';
        const assets=this.previewAssets(sc);
        if(cue.background&&!imageURL(cue.background))return '<p class="ls-tip ls-property-wide">背景图片路径无效，预览不会显示：请用「选择背景」从 resource 目录里选图。</p>';
        if(cue.sprite&&!imageURL(cue.sprite))return '<p class="ls-tip ls-property-wide">人物 / 成长画面路径无效，预览不会显示：请用「选择画面」从 resource 目录里选图。</p>';
        if(!imageURL(assets.background)&&!imageURL(assets.sprite))return '<p class="ls-tip ls-property-wide">此段没有可用的背景与人物：两项留空都在沿用同轨前一段，前面也没有可沿用的就是此时的空场。</p>';
        return '';}).call(this);
      const section=(title,content)=>'<fieldset class="ls-property-group"><legend>'+title+'</legend><div class="ls-inspector-grid">'+content+'</div></fieldset>';
      const track=cue.track||(cue.type==='caption'?'caption':cue.type==='effect'?'fx':'scene');
      const timing=field('track','轨道',track,{options:TRACKS})+field('type','片段类型',cue.type,{options:TYPES})+field('duration','播放时长（秒）',cue.duration,{number:true,min:.1})+field('at','全片起点（秒）',cue.at,{number:true,placeholder:'留空接上一段'})+field('motion','出场动画',cue.motion||'fade',{options:MOTIONS})+field('camera','镜头运动',cue.camera||'still',{options:CAMERAS})+field('transition','换幕转场',cue.transition||'dissolve',{options:TRANSITIONS})+stageField;
      const picture=field('backgroundEffect','背景效果',cue.backgroundEffect||'',{options:{'':'沿用全片（自定义图片优先）','star-lake':'SVG 星轨与湖面倒影',none:'仅自定义背景'}})+assetField('background','背景图片',cue.background,{pickLabel:'选择背景',placeholder:'留空为黑场'})+assetField('sprite','人物 / 成长画面',cue.sprite,{pickLabel:'选择画面',placeholder:'留空不显示'})+field('fit','画面裁切',cue.fit||'contain',{options:{contain:'完整显示',cover:'填满画面'}})+field('focusX','焦点横向 %',cue.focusX==null?50:cue.focusX,{number:true})+field('focusY','焦点纵向 %',cue.focusY==null?(cue.type==='ending'&&cue.endingStyle==='portrait'?100:50):cue.focusY,{number:true});
      const copyFields=field('speaker','角色名字',cue.speaker)+field('text',cue.type==='dialogue'?'台词':'旁白',cue.text,{area:true,rows:4})+field('caption',captionLabel,cue.caption,{area:true,rows:2})+(['memory','split'].includes(cue.type)?field('leftCaption','研发回忆 · 字幕',cue.leftCaption,{area:true,rows:2}):'')+(['journey','split'].includes(cue.type)?field('rightCaption','成长回忆 · 字幕',cue.rightCaption,{area:true,rows:2}):'')+(cue.type==='dialogue'?assetField('voice','对白配音（可留空）',cue.voice,{voice:true,pickLabel:'选择音频',placeholder:'resource/sound/voice/…'})+'<p class="ls-tip ls-property-wide">自动模式会在配音播放完后等待 1 秒，再进入下一句；未配置或播放失败时按台词阅读时间继续。</p>':'')+(track==='scene'?field('audioAt','对应主曲位置（秒，可留空）',cue.audioAt,{number:true,placeholder:'跟随全片进度'}):'<p class="ls-tip ls-property-wide">音乐定位由主画面和音乐轨控制。</p>');
      root.innerHTML='<section class="ls-inspector-card"><div class="ls-inspector-heading"><h3>片段 '+(this.selected+1)+'</h3><span>'+esc(cue.id)+'</span></div>'+section('时间与镜头',timing)+section('背景与人物',picture+pictureNote)+(memorialFields||videoFields?section(cue.type==='wall'?'纪念墙与行走':'片尾画面',memorialFields+videoFields):'')+section('对白与声音',copyFields)+'<p class="ls-tip">主画面控制故事推进，其他轨道可同时叠加。背景/人物留空＝该段不显示（背景黑场、不显示立绘）；只有从未设置过的字段才沿用同轨前一段；配音仅用于当前对白。对白与回忆的顶部标题显示在左上角，叠加字幕请使用字幕轨道。角色占位符按默认名字预览，保存时保留原文。</p></section>';
    /* [feature:life-timeline-editor-resolved-copy] */
      if(cue.type==='wall')root.insertAdjacentHTML('beforeend',this.renderCards('cue'));
      /* [feature:life-editor-body-appearance-anchor-tip] */
      if(cue.ageMilestone&&this.canAgeAnchor(cue)){const resolved=this.schedule().find(row=>row.index===this.selected);if(resolved)root.insertAdjacentHTML('beforeend','<p class="ls-tip">素体外观随纪念节点到达画面中心切换，照片增删后自动重算；当前起点 '+resolved.start.toFixed(2)+' 秒。</p>');}
      /* [/feature:life-editor-body-appearance-anchor-tip] */
    /* [/feature:life-timeline-editor-resolved-copy] */
    },
    cueAt(time) {
      return this.schedule().filter(cue => cue.track === "scene" && cue.start <= time).sort((a,b) => a.start-b.start || a.index-b.index).pop() || null;
    },
    previewAssets(cue) {
      let background="",sprite="";
      for(const previous of this.schedule().filter(c=>c.track===cue.track).sort((a,b)=>a.start-b.start||a.index-b.index)){
        if(previous.start>cue.start||previous.start===cue.start&&previous.index>cue.index)break;
        background=this.resolvedAsset(previous.row.background,background);
        sprite=this.resolvedAsset(previous.row.sprite,sprite);
      }
      return {background,sprite};
    },
    /* 留空（空串）= 作者显式不显示，不再沿用同轨前一段；只有「从未设置过」（undefined/null）才沿用。
       所以背景留空=黑场、立绘留空=没有立绘，与编辑器里的直觉一致。 */
    resolvedAsset(value,fallback) {
      if(value===undefined||value===null)return fallback;
      if(value==='')return '';
      return imageURL(value)?value:fallback;
    },
    previewIntroDialogue(cue) {
      if(!cue||cue.row.type!=='dialogue')return false;
      const scenes=this.schedule().filter(c=>c.track==='scene').sort((a,b)=>a.start-b.start||a.index-b.index),index=scenes.findIndex(c=>c.row.id===cue.row.id);
      return index>=0&&scenes.slice(0,index+1).every(c=>c.row.type==='dialogue');
    },
    previewBackground(cue,assets={}) {
      if(this.previewIntroDialogue(cue)&&!imageURL(assets.background||''))return {effect:'none',image:''};
      const row=cue&&cue.row||{},path=assets.background||'',legacy=/\/lake_moon_bg\.(png|webp|jpe?g)$/i.test(path);
      const explicit=row.backgroundEffect||'',effect=explicit||this.finale().backgroundEffect||'star-lake';
      const white=row.type==='ending'&&['white','video'].includes(row.endingStyle);
      return {effect:!white&&effect==='star-lake'&&(explicit==='star-lake'||!imageURL(path)||legacy)?'star-lake':'none',image:white||legacy||explicit==='star-lake'?'':path};
    },
    syncPreviewBackground(scene,cue,assets) {
      const bg=this.previewBackground(cue,assets),row=cue&&cue.row||{};let image=scene.querySelector('.ls-background');
      scene.classList.toggle('is-intro-dialogue',this.previewIntroDialogue(cue));
      if(imageURL(bg.image)){
        if(!image){image=document.createElement('img');image.className='ls-background';image.alt='';scene.prepend(image);}
        const src=imageURL(bg.image);if(image.getAttribute('src')!==src)image.src=src;
        image.style.objectFit='cover';image.style.objectPosition=(row.focusX==null?50:row.focusX)+'% '+(row.focusY==null?50:row.focusY)+'%';
      }else if(image)image.remove();
      scene.classList.toggle('has-background',!!imageURL(bg.image));scene.classList.toggle('has-star-lake',bg.effect==='star-lake');
      if(this.previewIntroDialogue(cue))this.warmPreviewLake();
      if(bg.effect==='star-lake'&&window.LifeStarLake){
        if(!this._previewLake)this._previewLake=LifeStarLake.create(document);
        const lake=this._previewLake;lake.element.classList.add('ls-star-lake');lake.element.setAttribute('aria-hidden','true');
        if(!this._previewLakeCompositor&&window.LifeStarCompositor&&window.Path2D)this._previewLakeCompositor=LifeStarCompositor.create(document,{source:lake});
        const compositor=this._previewLakeCompositor;if(compositor&&compositor.element.parentElement!==scene)scene.prepend(compositor.element);
        if(!compositor&&lake.element.parentElement!==scene)scene.prepend(lake.element);
        this.renderPreviewLake();
      }else{if(this._previewLake)this._previewLake.element.remove();if(this._previewLakeCompositor)this._previewLakeCompositor.element.remove();}
    },
    warmPreviewLake(immediate=false) {
      if(this._previewLake||!window.LifeStarLake||this._previewLakeWarm&&!immediate)return;
      if(this._previewLakeWarm){const task=this._previewLakeWarm;if(task.idle)window.cancelIdleCallback?.(task.id);else clearTimeout(task.id);this._previewLakeWarm=null;}
      const later=this.schedule().find(c=>c.track==='scene'&&this.previewBackground(c,this.previewAssets(c)).effect==='star-lake');
      if(!later)return;
      const warm=()=>{
        this._previewLakeWarm=null;const stage=document.getElementById('ls-preview-stage');if(!stage||this._previewLake)return;
        this._previewLake=LifeStarLake.create(document);
        if(window.LifeStarCompositor&&window.Path2D)this._previewLakeCompositor=LifeStarCompositor.create(document,{source:this._previewLake});
        const rect=stage.getBoundingClientRect(),width=rect.width||320,height=rect.height||width*9/16;
        const renderer=this._previewLakeCompositor||this._previewLake,input={width,height,time:0,paused:true,seek:true};
        const paint=ready=>{if(ready&&renderer===(this._previewLakeCompositor||this._previewLake)&&!renderer.element.isConnected)renderer.render(input);};
        if(renderer.prepare)renderer.prepare(input).then(paint).catch(()=>{});else paint(true);
      };
      if(immediate)warm();else this._previewLakeWarm=window.requestIdleCallback?{idle:true,id:window.requestIdleCallback(warm,{timeout:1500})}:{idle:false,id:setTimeout(warm,100)};
    },
    renderPreviewLake() {
      const lake=this._previewLake,stage=document.getElementById('ls-preview-stage');if(!lake||!stage||!(this._previewLakeCompositor?.element.isConnected||lake.element.isConnected))return;
      const rect=stage.getBoundingClientRect(),portrait=stage.classList.contains('is-portrait'),width=rect.width||320,height=rect.height||width*(portrait?19.5/9:9/16);
      const current=this.cueAt(this._elapsed),time=this.previewVisualTime(),reduced=!!(current&&current.row.motion==='none'||window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const intro=this._elapsed<(Number(this.finale().audioStartAt)||0),film=this.finale();
      const source=this._playing&&this._audioEnabled?(this._audio&&this._audio.readyState>=2?{src:this._audio.currentSrc||this._audio.src,time:this._audio.currentTime}:null):{src:intro?film.introBgm:film.bgm,time:intro?this._elapsed:this.audioAt(this._elapsed)};
      const music=source&&window.LifeMusicPulse?LifeMusicPulse.sample(source):null;
      const musicKey=music?source.src+'|'+music.time:'';
      // A paused seek paints its requested position once; ordinary paused
      // refreshes retain the renderer's frozen visual clock.
      const compositor=this._previewLakeCompositor,renderer=compositor||lake;
      const paint=input=>{renderer.render(input);if(compositor&&compositor.element.hidden){if(!lake.element.isConnected)stage.firstElementChild.prepend(lake.element);lake.render(input);}else if(compositor&&lake.element.isConnected)lake.element.remove();};
      if(this._previewLakeTime!==time||this._previewLakeReduced!==reduced||this._previewLakeMusic!==musicKey)paint({time,width,height,music,reduced,paused:false});
      paint({time,width,height,music,reduced,paused:!this._playing});this._previewLakeTime=time;this._previewLakeReduced=reduced;this._previewLakeMusic=musicKey;
    },
    previewCameraSpan(cue) {
      if(cue.row.type!=='dialogue')return cue;
      const scenes=this.schedule().filter(c=>c.track==='scene').sort((a,b)=>a.start-b.start||a.index-b.index),i=scenes.findIndex(c=>c.row.id===cue.row.id),visualKey=this.previewVisualKey(cue);let first=i,last=i;
      if(i<0)return cue;
      while(first>0&&scenes[first-1].row.type==='dialogue'&&this.previewVisualKey(scenes[first-1])===visualKey)first--;
      while(last+1<scenes.length&&scenes[last+1].row.type==='dialogue'&&this.previewVisualKey(scenes[last+1])===visualKey)last++;
      const modeOf=c=>c.row.camera||(c.row.motion==='pan'?'push':'still');let at=first,from=this.previewInitialPose(modeOf(scenes[first])),group=0;
      while(at<=last){let end=at;const mode=modeOf(scenes[at]);while(end<last&&modeOf(scenes[end+1])===mode)end++;
        const to=this.previewTargetPose(mode);if(at<=i&&i<=end)return {...cue,mode,visualKey,start:scenes[at].start,end:scenes[end].end,duration:scenes[end].end-scenes[at].start,from,to,ease:group>0};
        from=to;at=end+1;group++;
      }
      return cue;
    },
    previewVisualKey(cue) {
      const row=cue.row,assets=this.previewAssets(cue),bg=this.previewBackground(cue,assets);
      return JSON.stringify([bg.effect==='star-lake'?'effect:star-lake':bg.image,assets.sprite,row.fit==='cover'?'cover':'contain',row.focusX==null?50:Number(row.focusX),row.focusY==null?100:Number(row.focusY),row.motion==='none']);
    },
    previewInitialPose(mode) {return {scale:['pull','drift-left','drift-right'].includes(mode)?1.07:1,x:0,y:0};},
    previewTargetPose(mode) {return {scale:['push','drift-left','drift-right'].includes(mode)?1.07:1,x:mode==='drift-left'?-2.5:mode==='drift-right'?2.5:0,y:mode==='push'?-4:0};},
    previewVisualTime() {return this._elapsed+(this._previewClockOffset||0);},
    resetPreviewContinuity() {this.releasePreviewVoice();this._previewIntroTransition=null;this._previewEntryShown=false;this._previewClockOffset=0;this._previewDialogueCamera=null;this._previewCue=null;this._previewMediaSeek=true;},
    previewDialoguePose(cue) {
      const span=this.previewCameraSpan(cue),camera=this._previewDialogueCamera,active=camera&&camera.visualKey===span.visualKey&&camera.mode===span.mode&&camera.start===span.start&&camera.end===span.end;
      const from=active?camera.from:span.from,to=active?camera.to:span.to,duration=Math.max(.1,active?camera.duration:span.duration);
      let p=Math.max(0,Math.min(1,(active?camera.seed+this.previewVisualTime()-camera.at:this._elapsed-span.start)/duration));
      if(active?camera.ease:span.ease)p=p*p*(3-2*p);
      return {scale:from.scale+(to.scale-from.scale)*p,x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p};
    },
    continuePreviewDialogue(previous,next) {
      if(!previous||previous.row.type!=='dialogue'||!next||next.row.type!=='dialogue'||this.previewVisualKey(previous)!==this.previewVisualKey(next))return false;
      const span=this.previewCameraSpan(next),prior=this.previewCameraSpan(previous),camera=this._previewDialogueCamera;
      if(camera&&camera.visualKey===span.visualKey&&camera.mode===span.mode&&camera.start===span.start&&camera.end===span.end)return true;
      const sameMode=prior.mode===span.mode;
      this._previewDialogueCamera={mode:span.mode,visualKey:span.visualKey,start:span.start,end:span.end,from:sameMode?span.from:this.previewDialoguePose(previous),to:span.to,at:this.previewVisualTime(),seed:sameMode?Math.max(0,this._elapsed-span.start):0,duration:Math.max(.1,sameMode?span.duration:span.end-next.start),ease:!sameMode||span.ease};
      return true;
    },
    previewCamera(cue) {
      if(cue.row.motion==='none'||window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return '';
      if(cue.row.type==='dialogue'&&cue.track==='scene'){const pose=this.previewDialoguePose(cue),mode=cue.row.camera||(cue.row.motion==='pan'?'push':'still');return mode==='still'&&pose.scale===1&&!pose.x&&!pose.y?'':'scale('+pose.scale+') translateX('+pose.x+'%) translateY('+pose.y+'px)';}
      const p=Math.max(0,Math.min(1,(this._elapsed-cue.start)/cue.duration)),mode=cue.row.camera||(cue.row.motion==='pan'?'push':'still');
      if(mode==='push')return 'scale('+(1+p*.07)+') translateY('+(-p*4)+'px)';
      if(mode==='pull')return 'scale('+(1.07-p*.07)+')';
      if(mode==='drift-left')return 'scale(1.07) translateX('+(-p*2.5)+'%)';
      if(mode==='drift-right')return 'scale(1.07) translateX('+(p*2.5)+'%)';return '';
    },
    previewWalkGrid(cue) {
      const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
      const frames=Math.max(1,Math.min(12,Math.floor(number(cue.walkFrames,4))));
      const columns=Math.max(1,Math.min(12,Math.floor(number(cue.walkColumns,frames)))),rows=Math.max(1,Math.min(12,Math.floor(number(cue.walkRows,1))));
      return {frames:Math.min(frames,columns*rows),columns,rows,aspect:Math.max(.3,Math.min(2,number(cue.walkAspect,.75))),rest:Math.max(0,Math.min(Math.min(frames,columns*rows)-1,Math.floor(number(cue.walkRestFrame,0)))),size:columns*100+'% '+rows*100+'%'};
    },
    /* [feature:life-timeline-editor-wall-progress] */
    previewWallProgress() { return LifeTimeline.wallProgress(this.previewWallCues(),this._elapsed); },
    previewWallEnterAt(progress) { return LifeTimeline.wallTimeAt(this.previewWallCues(),progress); },
    /* [/feature:life-timeline-editor-wall-progress] */
    memorialPreview(cue,sprite) {
      const cards=Array.isArray(cue.wallCards)?cue.wallCards:Array.isArray(this.finale().wallCards)?this.finale().wallCards:[];
      const photos=cards.map((card,index)=>'<figure data-ls-card="'+index+'"><div>'+(imageURL(card.photo)?'<img src="'+esc(imageURL(card.photo))+'" alt="">':'✧')+'</div><figcaption><b>'+esc(this.previewText(card.title||'一起走过的日子'))+'</b><small>日期来自玩家存档</small></figcaption></figure>').join('');
      /* [feature:life-editor-body-appearance-html] */
      return '<div class="ls-memorial"><div class="ls-wall-heading"><small>'+esc(this.previewTitle())+'</small><h3>'+esc(this.previewText(cue.caption||'那些一起走过的日子'))+'</h3></div><div class="ls-wall-viewport"><div class="ls-wall-track"><div class="ls-wall-cycle">'+photos+'</div></div></div><div class="ls-wall-path"><div class="ls-walker" style="background-image:'+esc(imageURL(sprite)?'url('+JSON.stringify(imageURL(sprite))+')':'none')+';background-size:'+this.previewWalkGrid(cue).size+'"></div><span>'+esc(cue.age||10)+' 岁素体外观 · '+esc(this.previewText(cue.text||'继续向前'))+'</span></div></div>';
      /* [/feature:life-editor-body-appearance-html] */
    },
    previewWalkClip(cue) {
      return cue.walkVideo?{src:cue.walkVideo,poster:cue.walkPoster,fallback:cue.walkFallback,duration:cue.walkDuration,aspect:cue.walkAspect}:(this.finale().walkClips||{})[cue.age];
    },
    releasePreviewMedia(kind) {
      for(const key of kind?[kind]:['Walk','Closeup']){const name='_preview'+key+'Media';this[name]?.destroy();this[name]=null;this['_preview'+key+'MediaKey']=null;}
      if(!kind||kind==='Closeup'){this._previewVideoBlocked=false;this._previewCloseupRevealAt=null;}
    },
    syncPreviewMedia(current) {
      const root=document.getElementById('ls-preview-stage'),scene=root&&root.firstElementChild;
      if(!scene)return;
      const cue=current&&current.row,clip=cue&&cue.type==='wall'&&this.previewWalkClip(cue),walker=scene.querySelector('.ls-walker');
      const reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)||cue?.motion==='none';
      this._previewLandscapeBlocked=!!(this.finale().forceLandscape!==false&&cue&&cue.type!=='dialogue'&&root.classList.contains('is-portrait'));
      root.classList.toggle('needs-landscape',this._previewLandscapeBlocked);
      let gate=root.querySelector('.ls-landscape-gate');
      if(this._previewLandscapeBlocked&&!gate){gate=document.createElement('div');gate.className='ls-landscape-gate';gate.innerHTML='<b>请横屏观看结尾演出</b><span>点击「竖屏」按钮返回横屏预览</span>';root.appendChild(gate);}
      if(gate)gate.hidden=!this._previewLandscapeBlocked;
      /* [feature:life-editor-curtain-media-running] */
      const transition=this._previewIntroTransition,paused=!this._playing||this._previewLandscapeBlocked||!!transition&&!transition.switched&&!transition.awaitingFrame,authoredSeek=!!this._previewMediaSeek,seek=authoredSeek||!this._playing;
      /* [/feature:life-editor-curtain-media-running] */
      if(clip&&videoURL(clip.src)&&walker&&window.LifeVideo){
        const key=JSON.stringify(clip);
        if(this._previewWalkMediaKey!==key||!this._previewWalkMedia?.element.isConnected){
          this.releasePreviewMedia('Walk');
          this._previewWalkMedia=LifeVideo.create({document,host:walker,loop:true,...clip,src:videoURL(clip.src),poster:imageURL(clip.poster),rest:imageURL(clip.rest),fallback:imageURL(clip.fallback)});this._previewWalkMediaKey=key;
        }
        walker.classList.add('has-walk-video');walker.style.backgroundImage='none';walker.style.aspectRatio=String(Number(clip.aspect)||this.previewWalkGrid(cue).aspect);
    /* [feature:life-timeline-editor-media-clock] */
        const motion=this.previewWalkMotion(),rate=Math.max(.0625,Math.round(motion.rate*16)/16);
        if(Math.abs((Number(this._previewWalkMedia.video.playbackRate)||1)-rate)>.0001)try{this._previewWalkMedia.video.playbackRate=rate;}catch(_){}
        this._previewWalkMedia.render({time:motion.time,paused:paused||motion.parked,reduced,seek});
    /* [/feature:life-timeline-editor-media-clock] */
      }else{this.releasePreviewMedia('Walk');if(walker)walker.classList.remove('has-walk-video');}
      if(cue?.endingStyle==='video'&&window.LifeVideo){
        const host=scene.querySelector('.ls-closeup-screen'),key=JSON.stringify([cue.video,cue.poster,cue.duration]);
        if(host&&(this._previewCloseupMediaKey!==key||!this._previewCloseupMedia?.element.isConnected)){
          this.releasePreviewMedia('Closeup');
          this._previewCloseupMedia=LifeVideo.create({document,host,src:videoURL(cue.video),poster:imageURL(cue.poster),duration:current.duration,loop:false});this._previewCloseupMediaKey=key;
        }
        this._previewVideoBlocked=!!(this._previewCloseupMedia&&!this._previewCloseupMedia.ready()&&!this._previewCloseupMedia.failed());
        this._previewCloseupMedia?.render({time:Math.max(0,this._elapsed-current.start),paused:paused||this._previewVideoBlocked,seek});
      }else this.releasePreviewMedia('Closeup');
      let veil=scene.querySelector('.ls-media-veil');
      if(!veil){veil=document.createElement('div');veil.className='ls-media-veil';veil.setAttribute('aria-hidden','true');scene.appendChild(veil);}
    /* [feature:life-timeline-editor-veil-color] */
      const local=Math.max(0,this._elapsed-(current?.start||0)),ease=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};let alpha=0,color='#f7fcff';
    /* [/feature:life-timeline-editor-veil-color] */
    /* [feature:life-timeline-editor-veil-clock] */
      if(cue?.type==='wall'&&cue.walkMode==='stop'){const white=Math.min(current.duration,Number(cue.whiteFade)||3);alpha=ease((local-Math.max(0,current.duration-white))/white);}
    /* [/feature:life-timeline-editor-veil-clock] */
      if(cue?.endingStyle==='video'){
        const white=Number(cue.whiteFade)||1.15,start=Math.max(0,current.duration-white);
        if(authoredSeek)this._previewCloseupRevealAt=local>.1?0:null;
        const media=this._previewCloseupMedia;
        if(this._previewCloseupRevealAt==null&&media?.ready()&&media.playing()&&media.firstFrameReady?.()!==false)this._previewCloseupRevealAt=local;
        if(local>=start){color='#f7fcff';alpha=ease((local-start)/white);}else alpha=this._previewVideoBlocked||this._previewCloseupRevealAt==null?1:1-ease((local-this._previewCloseupRevealAt)/.65);
      }
      veil.style.backgroundColor=color;veil.style.opacity=String(alpha);this._previewMediaSeek=false;
    },
    measurePreviewWall() {
      const root=document.getElementById('ls-preview-stage'),cycle=root&&root.querySelector('.ls-wall-cycle'),viewport=root&&root.querySelector('.ls-wall-viewport');
      if(!cycle||!viewport){this._previewWall=null;return;}
      const view=viewport.getBoundingClientRect().width||root.getBoundingClientRect().width||320,width=cycle.getBoundingClientRect().width||Math.max(1,cycle.children.length)*180;
      const unit=width/Math.max(1,cycle.children.length);
      const cards=[...cycle.children].map((el,i)=>{const width=el.offsetWidth||el.getBoundingClientRect().width||unit;return {el,width,center:(el.offsetLeft||i*unit)+width/2};});
      const lead=view/2-(cards[0]?.center||0),travel=Math.max(0,(cards[cards.length-1]?.center||0)-(cards[0]?.center||0));
      const viewHeight=viewport.getBoundingClientRect().height||180;
      const offsets=cards.map((card,i)=>{card.enterAt=i===0?-Infinity:this.previewWallEnterAt(travel?(card.center+lead-view*.70)/travel:0);const height=card.el.offsetHeight||card.el.getBoundingClientRect().height||Math.max(1,viewHeight-60),room=Math.max(0,(viewHeight-height)/2-12),amplitude=Math.min(view<=640?18:30,room);return String([-1,.65,-.35,1,-.7][i%5]*amplitude)+'px';});
      cards.forEach((card,i)=>card.el.style.setProperty('--card-offset',offsets[i]));
      this._previewWall={view,width,lead,travel,cards,stillProgress:this.previewWallProgress()};
    },
    paintPreviewIntro() {
      const root=document.getElementById('ls-preview-stage');if(!root)return;
      let curtain=root.querySelector('.ls-intro-curtain');
      if(!curtain){curtain=document.createElement('div');curtain.className='ls-intro-curtain';curtain.setAttribute('aria-hidden','true');root.appendChild(curtain);}
      const t=this._previewIntroTransition;
      if(!t){curtain.style.opacity='0';delete root.dataset.introTransition;return;}
      const p=Math.max(0,Math.min(1,t.kind==='entry'?t.progress/t.entryDuration:t.switched?t.revealing?1-t.progress/t.fadeIn:1:t.progress/t.fadeOut));
      curtain.style.opacity=String(p*p*(3-2*p));root.dataset.introTransition=t.kind==='entry'?'entry':t.switched?t.revealing&&p<1?'in':'covered':'out';
    },
    advancePreviewIntro(dt) {
      let t=this._previewIntroTransition;
      if(t?.kind==='entry'){t.progress+=dt;if(t.progress>=t.entryDuration){this._previewIntroTransition=null;this._previewEntryShown=true;}return true;}
      /* [feature:life-editor-curtain-clock-running] */
      if(t?.switched)this._elapsed+=dt;
      /* [/feature:life-editor-curtain-clock-running] */
      if(!t){
        const current=this.cueAt(this._elapsed),scenes=this.schedule().filter(c=>c.track==='scene').sort((a,b)=>a.start-b.start||a.index-b.index),index=scenes.findIndex(c=>c.row.id===current?.row.id),next=scenes[index+1];
        if(!this.previewIntroDialogue(current)||!next||this.previewIntroDialogue(next)||this._elapsed+dt<next.start)return false;
        this._elapsed=Math.max(current.start,next.start-.01);
        const reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        t=this._previewIntroTransition={next,progress:0,switched:false,...LifeTimeline.prologueTiming(reduced),awaitingFrame:!reduced&&next.row.motion!=='none'&&!!this.previewWalkClip(next.row),frameWait:0,holdProgress:0,revealing:false};
      }
      if(t.switched&&!t.revealing){
        t.holdProgress+=dt;
        if(t.awaitingFrame){t.frameWait+=dt;if(this._previewWalkMedia?.firstFrameReady?.()===false&&t.frameWait<1)return true;t.awaitingFrame=false;this._previewMediaSeek=true;}
        if(t.holdProgress<t.hold)return true;
        t.revealing=true;t.progress=0;return true;
      }
      t.progress+=dt;
      if(!t.switched){
        if(t.progress>=t.fadeOut){
          t.progress=t.fadeOut;
          if(this.previewBackground(t.next,this.previewAssets(t.next)).effect==='star-lake'){
            this.warmPreviewLake(true);const renderer=this._previewLakeCompositor;
            if(renderer?.prepare&&renderer.inspect?.().ready===false){
              if(!t.preparing){t.preparing=true;const stage=document.getElementById('ls-preview-stage'),rect=stage.getBoundingClientRect();renderer.prepare({width:rect.width||320,height:rect.height||(rect.width||320)*9/16}).then(()=>{if(this._previewIntroTransition===t)t.preparing=false;}).catch(()=>{if(this._previewIntroTransition===t)t.prepareFailed=true;});}
              if(!t.prepareFailed)return true;
            }
          }
          t.switched=true;t.progress=0;this._elapsed=t.next.start;
        }
        return true;
      }
      if(t.progress>=t.fadeIn){this._previewIntroTransition=null;this._previewMediaSeek=true;}
      return true;
    },
    renderPreview() {
      const root = document.getElementById("ls-preview-stage"); if (!root) return;
      // Recreate the decoration after a cue's scene DOM replacement below.
      const current = this.cueAt(this._elapsed);
      const cue = current && current.row;
      if(this._playing&&this._previewCue&&current&&this._previewCue.row.id!==current.row.id)this.continuePreviewDialogue(this._previewCue,current);
      const overlays=this.schedule().filter(c=>c.track!=="scene"&&c.start<=this._elapsed&&c.end>this._elapsed);
      const seek = document.getElementById("ls-preview-seek"), time = document.getElementById("ls-preview-time");
      if (seek) { seek.max = String(this.total()); seek.value = String(Math.min(this._elapsed,this.total())); }
      if (time) time.textContent = this._elapsed.toFixed(1)+" / "+this.total().toFixed(1)+" 秒";
      this.updatePlayhead();
      const {background,sprite}=current?this.previewAssets(current):{background:'',sprite:''};
      const wallKey=cue&&cue.type==='wall'?JSON.stringify(Array.isArray(cue.wallCards)?cue.wallCards:this.finale().wallCards||[]):null;
      const key = (cue?cue.id+"|"+JSON.stringify(cue):'waiting')+"|"+background+"|"+sprite+"|"+(wallKey||'')+"|"+this.previewTitle()+"|"+JSON.stringify(this.previewVars())+"|"+JSON.stringify(overlays.map(c=>({...c.row,...this.previewAssets(c)})));
      if (this._previewKey !== key || !root.firstChild) {
        this._previewTextDissolve?.destroy();this._previewTextDissolve=null;
        this._previewKey = key;
        const keepWall=wallKey!=null&&wallKey===this._previewWallKey&&root.querySelector('.ls-memorial');
        const keepDialogue=cue&&cue.type==='dialogue'&&root.querySelector('.ls-type-dialogue .ls-dialogue');
        if(keepDialogue){
          const scene=root.firstElementChild;scene.className='ls-preview-scene ls-type-dialogue ls-motion-'+(cue.motion||'fade')+' ls-transition-'+(cue.transition||'dissolve')+' ls-camera-'+(cue.camera||'still')+' is-continuing';
          let character=scene.querySelector('.ls-character');const src=imageURL(sprite);
          if(src){if(!character){character=document.createElement('img');character.className='ls-character';character.alt='';scene.insertBefore(character,keepDialogue);}if(character.getAttribute('src')!==src)character.src=src;character.style.objectFit=cue.fit==='cover'?'cover':'contain';character.style.objectPosition=(cue.focusX==null?50:cue.focusX)+'% '+(cue.focusY==null?50:cue.focusY)+'%';}else if(character)character.remove();
          keepDialogue.querySelector('b').textContent=this.previewText(cue.speaker||'鲸鱼娘');keepDialogue.querySelector('p').textContent=this.previewText(cue.text||'');
          const layers=scene.querySelector('.ls-overlay-layers');if(layers)layers.remove();scene.insertAdjacentHTML('beforeend',this.previewLayers(overlays));
        }else if(keepWall){
          const scene=root.firstElementChild;scene.className='ls-preview-scene ls-type-wall ls-motion-'+(cue.motion||'fade')+' ls-transition-'+(cue.transition||'dissolve')+' ls-camera-'+(cue.camera||'still');
          scene.querySelector('.ls-memorial h3').textContent=this.previewText(cue.caption||'那些一起走过的日子');
          /* [feature:life-editor-body-appearance-update] */
          scene.querySelector('.ls-wall-path>span').textContent=(cue.age||10)+' 岁素体外观 · '+this.previewText(cue.text||'继续向前');
          /* [/feature:life-editor-body-appearance-update] */
          const walker=scene.querySelector('.ls-walker');walker.style.backgroundImage=imageURL(sprite)?'url('+JSON.stringify(imageURL(sprite))+')':'none';walker.style.backgroundSize=this.previewWalkGrid(cue).size;
          const oldLayers=scene.querySelector('.ls-overlay-layers');if(oldLayers)oldLayers.remove();scene.insertAdjacentHTML('beforeend',this.previewLayers(overlays));
        }else{
        const image = (path,cls) => imageURL(path) ? '<img class="'+cls+'" src="'+esc(imageURL(path))+'" alt="" style="object-fit:'+(cls==='ls-background'||cue&&cue.fit==='cover'?'cover':'contain')+';object-position:'+(cue&&cue.focusX!=null?cue.focusX:50)+'% '+(cue&&cue.focusY!=null?cue.focusY:cls==='ls-farewell-sprite'?100:50)+'%">' : "";
        const ambient='<div class="ls-ambient" aria-hidden="true"><i></i><i></i><i></i></div>';
        if(!cue)root.innerHTML='<div class="ls-preview-scene">'+ambient+this.previewHeading(null)+'<div class="ls-preview-empty">时间线预览</div>'+this.previewLayers(overlays)+'</div>';
        else {
        const narration=cue.text?'<p class="ls-cue-narration">'+esc(this.previewText(cue.text))+'</p>':'';
        const memory = '<div class="ls-memory"><span class="ls-memory-kicker">一路走来</span><h4>'+esc(this.previewText(cue.leftCaption||"你的研发历程"))+'</h4><div class="ls-memory-bars">'+["V1","V2","V3","V4","V5"].map((v,i) => '<div><span>'+v+'</span><i style="--bar:'+([18,32,51,76,94][i])+'%"></i></div>').join("")+'</div><span class="ls-memory-note">正式演出展示玩家的通关日期与评分</span>'+(cue.type==='memory'?narration:'')+'</div>';
        const journey = '<div class="ls-journey">'+image(sprite,"ls-journey-sprite")+'<div class="ls-journey-copy"><span>'+esc(this.previewText(cue.rightCaption||cue.caption||''))+'</span>'+narration+'</div></div>';
        root.style.setProperty('--life-dialogue-opacity',String(this.finale().dialoguePanelOpacity));
        const content = cue.type === "dialogue" ? image(sprite,"ls-character")+'<div class="ls-dialogue"><b>'+esc(this.previewText(cue.speaker||"鲸鱼娘"))+'</b><p>'+esc(this.previewText(cue.text))+'</p></div>'
          : cue.type === "split" ? '<div class="ls-split">'+memory+journey+'</div>'
          : cue.type === "memory" ? memory : cue.type === "journey" ? journey
          : cue.type === 'wall' ? this.memorialPreview(cue,sprite)
          : cue.type === 'ending'&&cue.endingStyle==='video' ? '<div class="ls-closeup-screen" aria-label="静音特写视频"></div>'
          : cue.type === 'ending'&&['portrait','white'].includes(cue.endingStyle) ? '<div class="ls-farewell'+(cue.endingStyle==='white'?' is-white':'')+'">'+(cue.endingStyle==='portrait'?image(sprite,'ls-farewell-sprite'):'')+'<div><small>'+esc(this.previewText(cue.speaker||'小鲸鱼'))+'</small><h3>'+(cue.endingStyle==='white'?this.previewText(cue.caption||'').split('\n').map((line,i)=>'<span class="ls-farewell-line" data-caption-line="'+i+'">'+esc(line)+'</span>').join('\n'):esc(this.previewText(cue.caption||'')))+'</h3><p>'+esc(this.previewText(cue.text||''))+'</p></div></div>'
          : cue.type === 'caption' ? this.previewFilmTitle(cue)
          : cue.type === 'effect' ? '<div class="ls-overlay-fx" aria-hidden="true"><i></i><i></i><i></i></div>'
          : image(sprite,'ls-ending-sprite')+'<div class="ls-ending"><h3>'+esc(this.previewText(cue.caption||"感谢你陪伴小鲸鱼成长"))+'</h3><div class="ls-particles">'+Array.from({length:18},(_,i) => '<i style="--x:'+((i*37)%100)+'%;--y:'+((i*23)%70)+'%;--delay:'+(i%6)*0.15+'s"></i>').join("")+'</div></div>';
        root.innerHTML = '<div class="ls-preview-scene ls-type-'+esc(cue.type)+' ls-motion-'+esc(cue.motion||"fade")+' ls-transition-'+esc(cue.transition||'dissolve')+' ls-camera-'+esc(cue.camera||"still")+'">'+ambient+'<div class="ls-preview-shade"></div>'+this.previewHeading(cue)+content+this.previewLayers(overlays)+'</div>';
        }
        }
        this._previewWallKey=wallKey;this.measurePreviewWall();
      }
      const scene = root.firstElementChild;
      if (scene) {
        const heading=scene.querySelector('.ls-film-heading'),topCaption=heading&&heading.querySelector('.ls-top-caption');
        if(heading)heading.hidden=true;
        const caption=this.previewText(cue&&cue.caption)||this.previewTitle();
        if(topCaption&&topCaption.textContent!==caption)topCaption.textContent=caption;
        if(cue?.endingStyle==='white'&&window.LifeTextDissolve){
          if(!this._previewTextDissolve){const label=scene.querySelector('.ls-farewell h3');if(label)this._previewTextDissolve=LifeTextDissolve.create({document,host:scene,textElement:label});}
          const out=Math.min(1.8,current.duration),progress=Math.max(0,Math.min(1,(this._elapsed-current.start-(current.duration-out))/out));
          this._previewTextDissolve?.render({progress,reduced:cue.motion==='none'||!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches),paused:!this._playing,seek:!this._playing});
        }
        if(cue?.endingStyle==='white'){
          const reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches),local=Math.max(0,this._elapsed-current.start);
          this.previewCaptionLines(scene.querySelector('.ls-farewell h3')).forEach((line,i)=>{const u=reduced?1:Math.max(0,Math.min(1,(local-i*.85)/.85)),p=u*u*(3-2*u);line.style.opacity=String(p);line.style.transform='translateY('+((1-p)*8)+'px)';});
        }
        this.syncPreviewBackground(scene,current,{background,sprite});
        /* 图片加载失败（文件名/路径不存在）以前只是安静地黑掉，看不出是路径写错了。
           这里统一挂监听，把失败原因直接写在预览画面上。 */
        scene.querySelectorAll('.ls-background,.ls-character,.ls-journey-sprite,.ls-ending-sprite,.ls-farewell-sprite').forEach(img=>{
          if(img.dataset.lsWatch)return;img.dataset.lsWatch='1';
          const fail=()=>{if(!scene.querySelector('.ls-preview-error'))scene.insertAdjacentHTML('beforeend','<p class="ls-preview-error">图片加载失败（文件名或路径不存在）：请用「选择背景」或「选择画面」重新选图。</p>');};
          img.addEventListener('error',fail);img.addEventListener('load',()=>scene.querySelector('.ls-preview-error')?.remove());
        });
        const progress = current?Math.min(1,Math.max(0,(this._elapsed-current.start)/current.duration)):0;
        scene.style.setProperty("--progress",String(progress));
        const reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        scene.classList.toggle("is-ending-out",!!cue&&cue.type === "ending" && !cue.endingStyle && cue.motion !== "none" && !reduced && this._elapsed-current.start>=Math.max(0,current.duration-3));
        scene.classList.toggle('is-preview-paused',!this._playing);
        scene.classList.toggle('is-prologue-entry',this._previewIntroTransition?.kind==='entry');
        if(current){const camera=this.previewCamera(current);scene.querySelectorAll('.ls-background,.ls-character,.ls-journey-sprite,.ls-ending-sprite,.ls-farewell-sprite').forEach(img=>img.style.transform=(img.classList.contains('ls-character')?'translateX(-50%) ':'')+camera);}
        if(current&&cue.type==='wall'){
    /* [feature:life-timeline-editor-sprite-clock] */
          const cycle=scene.querySelector('.ls-wall-cycle'),track=scene.querySelector('.ls-wall-track'),walker=scene.querySelector('.ls-walker'),film=this.previewWalkMotion().time;
    /* [/feature:life-timeline-editor-sprite-clock] */
          const p=this.previewWallProgress();
          if(track&&cycle){
            if(!this._previewWall)this.measurePreviewWall();
            const wall=this._previewWall,position=wall.lead-(reduced||cue.motion==='none'?wall.stillProgress:p)*wall.travel;
            track.style.transform='translateX('+position+'px)';
            for(const card of wall.cards){const center=card.center+position,half=card.width/2,u=Math.max(0,Math.min(1,this._elapsed-card.enterAt)),enter=u*u*(3-2*u),exit=Math.max(0,Math.min(1,(center+half)/Math.max(1,half+wall.view*.16)));card.el.style.setProperty('--card-entry',String(reduced||cue.motion==='none'?1:enter));card.el.style.setProperty('--card-visibility',String(reduced||cue.motion==='none'?1:Math.min(enter,exit)));}
          }
          if(walker){const grid=this.previewWalkGrid(cue),frame=reduced||cue.motion==='none'||cue.walkMode==='stop'?grid.rest:Math.floor(film*(Number(cue.walkFps)||5))%grid.frames,x=frame%grid.columns,y=Math.floor(frame/grid.columns);walker.classList.toggle('is-stopped',cue.walkMode==='stop');walker.style.left=(reduced?50:24+p*52)+'%';walker.style.aspectRatio=String(grid.aspect);walker.style.backgroundSize=grid.size;walker.style.backgroundPosition=(grid.columns>1?x*100/(grid.columns-1):0)+'% '+(grid.rows>1?y*100/(grid.rows-1):100)+'%';walker.dataset.frame=String(frame);}
        }
        overlays.forEach(c=>{const layer=[...scene.querySelectorAll('[data-ls-layer]')].find(el=>el.dataset.lsLayer===c.row.id);if(layer)layer.querySelectorAll('img').forEach(img=>img.style.transform=this.previewCamera(c));});
      }
      this.syncPreviewMedia(current);this._previewCue=current;this.paintPreviewIntro();this.syncPreviewVoice(current);
    },
    previewLayers(cues) {
      return '<div class="ls-overlay-layers">'+cues.map(c=>{
        const row=c.row,assets=this.previewAssets(c),attrs=' data-ls-layer="'+esc(row.id)+'" data-transition="'+esc(row.transition||'dissolve')+'" data-motion="'+esc(row.motion||'fade')+'"';
        if(c.track==="caption")return '<div class="ls-overlay-caption"'+attrs+'>'+this.previewFilmTitle(row)+'</div>';
        if(c.track==="fx")return '<div class="ls-overlay-fx"'+attrs+' aria-hidden="true"><i></i><i></i><i></i></div>';
        if(c.track==="journey")return '<div class="ls-overlay-journey"'+attrs+'>'+(imageURL(assets.sprite)?'<img src="'+esc(imageURL(assets.sprite))+'" alt="" style="object-fit:'+(row.fit==='cover'?'cover':'contain')+';object-position:'+(row.focusX==null?50:row.focusX)+'% '+(row.focusY==null?50:row.focusY)+'%">':'')+'<span>'+esc(this.previewText(row.rightCaption||row.caption||''))+'</span>'+(row.text?'<p class="ls-cue-narration">'+esc(this.previewText(row.text))+'</p>':'')+'</div>';
        return '<div class="ls-overlay-memory"'+attrs+'><small>'+esc(row.stage||"一路成长")+'</small><b>'+esc(this.previewText(row.leftCaption||"你的研发历程"))+'</b><i></i><i></i><i></i>'+(row.text?'<p class="ls-cue-narration">'+esc(this.previewText(row.text))+'</p>':'')+'</div>';
      }).join("")+'</div>';
    },
    audioAt(time) {
      const cue = this.cueAt(time);
      return cue && cue.row.audioAt != null && cue.row.audioAt !== "" ? Number(cue.row.audioAt)+Math.max(0,time-cue.start) : Math.max(0,time-(Number(this.finale().audioStartAt)||0)+(Number(this.finale().audioOffset)||0));
    },
    async syncAudio() {
      if (!this._playing || !this._audioEnabled) return;
      const transition=this._previewIntroTransition;
      if(transition?.kind==='entry'){if(this._audio)this._audio.pause();return;}
      /* [feature:life-editor-curtain-audio-running] */
      // After the covered switch the real film and music continue together.
      /* [/feature:life-editor-curtain-audio-running] */
      if(this._previewVideoBlocked||this._previewLandscapeBlocked){if(this._audio)this._audio.pause();return;}
      const intro=this._elapsed<(Number(this.finale().audioStartAt)||0),cue=this.cueAt(this._elapsed),segment=intro?'intro':'film';
      if(intro&&(!cue||cue.row.type!=='dialogue')||!intro&&this.finale().audioDuration!=null&&this._elapsed>=this.musicClip().end){if(this._audio)this._audio.pause();return;}
      const src = audioURL(intro?this.finale().introBgm:this.finale().bgm);
      if (!src || typeof Audio === "undefined") {if(this._audio)this._audio.pause();return;}
      if (!this._audio || this._audio.getAttribute("src") !== src || this._audioSegment!==segment) {
        if (this._audio) {this._audio.pause();this._audio.removeAttribute('src');this._audio.load();}
        this._audio = new Audio(src); this._audio.preload = "metadata";
        this._audioSegment=segment;
      }
      this._audio.muted = false;this._audio.loop=intro;
      /* [feature:life-editor-curtain-audio-fade] */
      const fade=transition&&!transition.switched?Math.max(0,1-transition.progress/transition.fadeOut):1;
      /* [/feature:life-editor-curtain-audio-fade] */
      this._audio.volume=Math.max(0,Math.min(1,Number(window.AudioMgr?.musicVol)||.6))*fade;
      const expected = intro?(Number.isFinite(this._audio.duration)&&this._audio.duration>0?this._elapsed%this._audio.duration:this._elapsed):this.audioAt(this._elapsed);
      if (Number.isFinite(this._audio.duration) && expected < this._audio.duration && Math.abs(this._audio.currentTime-expected)>0.8) this._audio.currentTime = expected;
      if (this._audio.paused) { try { await this._audio.play(); } catch (_) { /* Browser gesture policy; the timeline remains usable. */ } }
    },
    play() {
      if (!this.rows().length) return;
      if (this.errors().length) { this.renderErrors(); return; }
      if (this._elapsed >= this.total()) {this._elapsed = 0;this.resetPreviewContinuity();}
      this.releaseInspectorAudio(false);
      const first=this.schedule().filter(c=>c.track==='scene')[0];
      if(!this._previewIntroTransition&&!this._previewEntryShown&&first&&this._elapsed<=first.start&&this.previewIntroDialogue(first)){
        const timing=LifeTimeline.prologueTiming(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
        this._previewIntroTransition={kind:'entry',progress:0,entryDuration:timing.entry};
      }
      this._playing = true; this._lastFrame = 0;
      const button = document.getElementById("ls-play"); if (button) button.textContent = "暂停";
      this.renderPreview();this.syncAudio();
      const tick = stamp => {
        if (!this._playing) return;
        if (this._lastFrame&&!document.hidden&&!this._previewVideoBlocked&&!this._previewLandscapeBlocked) {const dt=Math.min(0.25,(stamp-this._lastFrame)/1000);if(this._previewIntroTransition)this.advancePreviewIntro(dt);else if(!this.advancePreviewVoice(dt,stamp)&&!this.advancePreviewIntro(dt))this._elapsed+=dt;}
        this._lastFrame = stamp;
        this.renderPreview(); this.syncAudio();
        /* [feature:life-editor-curtain-completion-boundary] */
        if(this._previewIntroTransition&&this._elapsed>=this.total())this._elapsed=Math.max(0,this.total()-.01);
        else if (this._elapsed >= this.total()) { this._elapsed = this.total(); this.pause(); this.renderPreview(); return; }
        /* [/feature:life-editor-curtain-completion-boundary] */
        this._frame = window.requestAnimationFrame(tick);
      };
      this._frame = window.requestAnimationFrame(tick);
    },
    pause({keepSample=false}={}) {
      this._playing = false;
      if (this._frame) window.cancelAnimationFrame(this._frame);
      this._frame = 0; this._lastFrame = 0;
      if (this._audio) this._audio.pause();
      if(!keepSample)this.releaseInspectorAudio(false);
      this._previewVoice?.sync(true);
      const button = document.getElementById("ls-play"); if (button) button.textContent = "播放";
      const scene=document.querySelector('#ls-preview-stage .ls-preview-scene');if(scene)scene.classList.add('is-preview-paused');this.renderPreviewLake();if(scene)this.syncPreviewMedia(this.cueAt(this._elapsed));
    },
    close() {
      this.cancelGesture();
      this.pause();
      this.releaseInspectorAudio();this.releasePreviewVoice();
      if(this._previewLakeWarm){if(this._previewLakeWarm.idle)window.cancelIdleCallback?.(this._previewLakeWarm.id);else clearTimeout(this._previewLakeWarm.id);this._previewLakeWarm=null;}
      this._previewIntroTransition=null;document.querySelector('#ls-preview-stage .ls-intro-curtain')?.remove();
      if (this._audio) { this._audio.removeAttribute("src"); this._audio.load(); this._audio = null; }
      if(this._previewLakeCompositor){this._previewLakeCompositor.destroy();this._previewLakeCompositor=null;}
      if(this._previewLake){this._previewLake.destroy();this._previewLake=null;this._previewLakeTime=null;}
      this._previewTextDissolve?.destroy();this._previewTextDissolve=null;
      this.releasePreviewMedia();this._previewLandscapeBlocked=false;
    },
    export() {
      const file = new Blob([JSON.stringify(this.data,null,2)],{type:"application/json;charset=utf-8"});
      const url = URL.createObjectURL(file), link = document.createElement("a");
      link.href = url; link.download = "完整的一生-演出剧本.json"; link.click(); URL.revokeObjectURL(url);
    },
    async importFile(file) {
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data || !data.FINALE || !Array.isArray(data.FINALE.timeline)) throw new Error("请选择导出的演出剧本");
        const previous = this.data;
        this.data = this.normalize(data);
        const errors = this.errors();
        if (errors.length) { this.data = previous; throw new Error(errors[0]); }
        this.remember("导入剧本",null,clone(previous));this.pause(); this.selected = 0; this._elapsed = 0;
        this.mark(); this.render();
        if (typeof UI !== "undefined") UI.toast("剧本已导入，点「保存全部」后生效");
      } catch (error) { if (typeof UI !== "undefined") UI.toast("导入失败："+error.message,"err"); }
    },
    async save({silent=false} = {}) {
      if (!this.loaded || !this.dirty) return;
      try {
        const errors = this.errors();
        if (errors.length) { this.renderErrors(); throw new Error(errors[0]); }
        // Other pages may have advanced the shared mtime. Check this section itself
        // before replacing its array, so a stale open editor never erases new scenes.
        const currentResponse = await fetch("/api/game-cfg");
        if (!currentResponse.ok) throw new Error("无法核对最新演出配置，已有配置未覆盖");
        const current = await currentResponse.json();
        const currentSource = JSON.stringify((current.config || {}).LIFE_STORY == null ? null : current.config.LIFE_STORY);
        if (this._savedSource !== undefined && currentSource !== this._savedSource) throw new Error("演出配置已被其他窗口修改。请导出当前剧本，刷新后重新编排。");
        if (window.CfgSync) window.CfgSync.note(current);
        const response = await fetch("/api/game-cfg-save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({section:"LIFE_STORY",config:clone(this.data),expectMtime:window.CfgSync ? window.CfgSync.expect() : undefined})});
        const result = await response.json();
        if (!result.ok) throw new Error(result.error||"保存失败");
        if (window.CfgSync) window.CfgSync.update(result.mtime);
        this.dirty = false;
        this._savedSource = JSON.stringify(this.data);
        if (window.GameCfgTool && window.GameCfgTool.data) window.GameCfgTool.data.LIFE_STORY = clone(this.data);
        if (!silent && typeof UI !== "undefined") UI.toast("终章演出已保存并同步到游戏");
      } catch (error) {
        if (silent) throw error;
        if (typeof UI !== "undefined") UI.toast("保存失败："+error.message,"err");
      }
    }
  };
  window.LifeStoryTool = tool;
})();
