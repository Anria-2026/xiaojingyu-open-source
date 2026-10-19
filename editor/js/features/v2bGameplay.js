/* Shared V2B controls. Arcade has its own tab but keeps the original sparse save path. */
(function () {
  "use strict";
  const tool = window.GameCfgTool;
  if (!tool) return;
  const KEYS = ["ARCADE", "WHALE_CARE", "WHALE_OUTFITS", "WHALE_LINES", "EMBODIED", "FACTORY"];
  const WHOLE_SECTIONS = ["FACTORY"];
  const E = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const labels = { easy:"简单", normal:"普通", hard:"困难", REWARD_MULT_BY_DIFFICULTY:"难度奖励倍率", dragImg:"拖动动作图", SEND_INTERVAL_WEEKS:"照片发送间隔（游戏周）", ENABLED:"启用", enabled:"启用", INTRO:"介绍文案", DESC:"介绍文案", desc:"介绍", title:"标题", name:"名称", caption:"照片台词", img:"图片", cover:"封面", fullImg:"相册原图", module:"玩法脚本", id:"编号", GAMES:"游戏", whack:"清除幻觉", sort:"语料分拣", runner:"节奏快打（封关）", LOCKED:"封关说明", PLAYS_PER_WEEK:"每周领奖次数", STAGE_MAX_REWARD_WEEKS:"单阶段领奖周数上限", DIFFICULTY_BY_VER:"阶段难度", REWARDS:"结算奖励", SORT:"语料分拣", CARDS:"卡片池", SPRITES:"小游戏精灵", WHALE_SPRITES:"鲸鱼娘动作", RESULT_ART:"结算立绘", GUESTS:"来访伙伴精灵", XP_LEVELS:"好感升级经验", XP:"好感经验奖励", CHAT:"聊天", DROP:"拖动互动", ARCADE:"小游戏", REVIEW:"评审", CHAT_DAILY_CAP:"每天聊天次数", DROP_WEEKLY_CAP:"每周拖动次数", ARCADE_WEEKLY_CAP:"每周小游戏次数", FEEDS_PER_WEEK:"每周投喂次数", STAGE_MAX_WEEKS:"单阶段收益周数", BUFFS:"好感加成", REST_LEVEL:"恢复加成解锁等级", REST_BONUS:"体力恢复加成（最高5%）", OUTPUT_LEVEL:"产出加成解锁等级", OUTPUT_BONUS:"产出加成（最高3%）", SNACKS:"投喂零食", ALBUM_EXPRESSIONS:"表情相册", LIST:"照片列表", unlock:"解锁条件", UNLOCK:"解锁条件", stage:"最低阶段", week:"最低周数", affection:"最低好感等级", outfit:"需要已换装", chat:"需聊过天", event:"纪念事件", eventText:"纪念条件文案", cost:"价格", xp:"好感经验", energy:"体力", funding:"经费", corpus_normal:"普通语料", safety:"安全", stability:"稳定", team_stat:"团队属性", type:"卡片类型", text:"卡片文案", DURATION_SECONDS:"局时长（秒）", durationSeconds:"局时长（秒）", GOLD_CHANCE:"金卡概率", RIVAL_CHANCE:"伙伴概率", DIFFICULTY:"分拣难度", windowMs:"分拣时限（毫秒）", trap:"陷阱概率", preview:"预览卡片数", scale:"难度系数", controlsDiagram:"操作示意", accuracyLabel:"准确率名称", mistakeLabel:"失误名称" };
  Object.assign(labels, { rice:"拯救大白饭", RICE:"接米规则", riceCatch:"端碗接米立绘", points:"各类米得分", white:"白米", gold:"金米", rainbow:"彩米", black:"黑米扣分", goldBonusSeconds:"金米加时（秒）", maxBonusSeconds:"单局最多加时（秒）", magnetSeconds:"彩米磁吸时长（秒）", riceIdle:"吃饭待机立绘", riceBite:"吃一口饭立绘", riceYue:"嫌弃作呕立绘" });
  Object.assign(labels, { FACTORY:"素体", CITY_JOURNEY:"旅行小鲸鱼", BY_VER:"各阶段方案", NAME:"名称", REQUIRED_UNITS:"立项所需素体数量", TIERS:"采购型号", units:"素体数量", price:"采购价格（元）", outputBonus:"具身岗位产出加成（0～0.5）", WAIT_MINUTES:"站点旅行等待（真实分钟）", waitMinutes:"此站旅行等待（真实分钟）", REPLY_SECONDS:"对话回复等待（真实秒）", replySeconds:"此处回复等待（真实秒）", OPENING:"面对面开场", STOPS:"旅行路线", steps:"旅途对话", label:"地点名称", option:"玩家回复", answer:"小鲸鱼回复", src:"旅行照片", graduation:"优秀演出兜底 · 毕业典礼", firstjob:"顶尖演出兜底 · 第一份工作" });
  Object.assign(labels, { ENERGY:"小鲸鱼自身体力", MAX:"体力上限", INITIAL:"初始体力（仅新建字段）", AUTOMATION:"团队体力托管", ENERGY_COSTS:"每次成功托管消耗体力", UNLOCK_LEVEL:"开放好感等级", ENERGY_THRESHOLD:"工程师体力低于此值时托管", REST_THRESHOLD:"休假体力阈值", INTERVAL_SECONDS:"托管检查间隔（真实秒）", talk:"自动谈心", raise:"自动加薪", rest:"自动休假", WAND_IMG:"默认装扮举棒图", wandImg:"这套时装举棒图", EMBODIED:"具身智能时代", AWAKEN_RATIO:"具身开智能力比例（0～1）", AWAKEN_MIN_TRAINING_WEEKS:"正式训练至少几周才开智", MENTOR_KEY:"剧情导师稳定编号", OLD_SCENE_ID:"V5 前办公室编号", NEW_SCENE_ID:"V5 后办公室编号", AXIS_NAMES:"新增能力显示名", embodiedCognition:"物理认知维度名称", dexterousControl:"灵巧操控维度名称", ASSETS:"具身时代素材", intro:"入场漫画", office:"十二席办公室", pod:"休眠仓", news:"优秀评审头条", headline:"优秀评审头条", live:"顶尖评审 Live" });
  Object.assign(labels, { whale_energy:"小鲸鱼体力", corpus_good:"良好语料", corpus_best:"优质语料", hideUntilUnlocked:"未解锁时隐藏" });
  Object.assign(labels, { WHALE_LINES:"小鲸鱼台词", drag:"拖动台词", feed:"投喂台词", early:"提前休息台词", idle:"待机台词", training:"训练台词" });
  Object.assign(labels, { minVer:"解锁阶段" });
  Object.assign(labels, { meeting:"免费聚餐", team:"团队旅游", TEAM_THRESHOLD:"集体托管平均体力阈值" });
  Object.assign(labels, { ENERGY_FEED_AFTER_STAGE_CAP:"阶段好感领完后仍可投喂补体力", MAX:"初始体力上限", CEILING:"最高可成长体力上限（最多500）", capacity:"永久增加体力上限" });
  Object.assign(labels, { ROUTE_VERSION:"路线存档版本", AGES_BY_VER:"各阶段年龄", PORTRAITS_BY_VER:"各年龄聊天头像", destination:"下一站名称", arrivals:"到达时的报备", reply:"小鲸鱼回复", departure:"离开时提示", waitHint:"等待提示", alt:"照片无障碍说明" });
  Object.assign(labels, { WHALE_OUTFITS:"时装", lowFunds:"经费不足台词", tired:"疲惫台词", paused:"暂停台词", night:"夜晚台词", review:"评审前台词", goodNews:"好消息台词", rivalVisit:"伙伴来访台词", hit:"误击台词", pass:"放行台词", visit:"来访台词", lines:"互动台词", MODEL:"素体型号", PROFILE:"成长说明", DESCRIPTION:"采购说明", PREVIEW_IMG:"素体预览图", GROWTH_BY_VER:"各阶段成长形象", model:"型号", sprite:"人物立绘", image:"演出图片", REVIEW_BY_STAGE:"各阶段评审演出", excellent:"优秀", top:"顶尖", tag:"演出标签", variant:"演出类型", showSprite:"显示人物立绘", beats:"三幕文案", CALENDAR:"具身日历", ANCHOR_WEEK:"日历起点（累计周）", NEWS_TIMELINE:"具身新闻时间线", CLOUD_BOARDS:"各阶段云榜编号", CLOUD_SCORE_CAPS:"各阶段云榜分数上限" });
  Object.assign(labels, { FOLLOW_AUTHOR_UID:"关注领取 · 作者主页 UID" });
  Object.assign(labels, { videoTriple:"指定视频三连领取", videoBvid:"三连视频 · BV 号或 bilibili 视频链接" });
  function normalizeBvid(value) {
    if (typeof value !== 'string') return null;
    const text=value.trim(); if (!text) return '';
    if (/^BV[0-9A-Za-z]{10}$/.test(text)) return text;
    try { const url=new URL(text); if (!['https:','http:'].includes(url.protocol) || !/^(?:www\.|m\.)?bilibili\.com$/i.test(url.hostname)) return null; const match=url.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10})\/?$/); return match ? match[1] : null; } catch (_) { return null; }
  }
  const get = (obj, path) => path.reduce((n,k) => n == null ? undefined : n[k], obj);
  let idCounter=0;
  function stableId(prefix,list) {
    let id;do{const suffix=window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+(++idCounter).toString(36);id='custom_'+prefix+'_'+suffix;}while(list.some(row=>row&&row.id===id));return id;
  }
  // Schemas expose supported optional fields without mutating the working copy.
  function rowSchema(path) {
    const p=path.join('|');
    if(p==='WHALE_CARE')return {FOLLOW_AUTHOR_UID:''};
    if(/^WHALE_CARE\|SNACKS\|\d+$/.test(p))return {id:'',name:'',img:'',cost:0,xp:0,energy:0,capacity:0};
    if(/^WHALE_OUTFITS\|\d+$/.test(p))return {id:'',name:'',enabled:true,img:'',dragImg:'',wandImg:'',desc:'',unlock:{}};
    if(/^FACTORY\|BY_VER\|[^|]+$/.test(p))return {NAME:'',MODEL:'',PROFILE:'',DESCRIPTION:'',PREVIEW_IMG:'',REQUIRED_UNITS:1,TIERS:[]};
    if(/^EMBODIED\|(?:ASSETS\|)?REVIEW_BY_STAGE\|[^|]+\|(?:excellent|top)$/.test(p))return {image:'',sprite:'',showSprite:true,title:'',tag:'',variant:'news'};
    if(/^EMBODIED\|GROWTH_BY_VER\|[^|]+$/.test(p))return {model:'',sprite:''};
    return {};
  }
  function listSpec(path) {
    const p=path.join('|');
    if(p==='WHALE_CARE|SNACKS')return {label:'零食',prefix:'snack',create:()=>({name:'新零食',img:'',cost:30000,xp:0,energy:0,capacity:0})};
    if(p==='WHALE_OUTFITS')return {label:'时装',prefix:'outfit',create:()=>({name:'新时装',enabled:true,img:'',dragImg:'',wandImg:'',desc:'',unlock:{}})};
    if(p==='ARCADE|SORT|CARDS')return {label:'卡片',prefix:'card',create:()=>({type:'good',text:'新语料',img:''})};
    if(p==='ARCADE|GUESTS')return {label:'伙伴',prefix:'guest',create:()=>({name:'新伙伴',img:'',lines:{hit:[],pass:[],visit:[]}})};
    if(/^FACTORY\|BY_VER\|[^|]+\|TIERS$/.test(p))return {label:'采购型号',prefix:'body',min:1,create:()=>({name:'新采购型号',price:1000000,units:1,outputBonus:0})};
    if(p==='EMBODIED|CALENDAR|NEWS_TIMELINE')return {label:'新闻',prefix:'news',create:()=>({week:0,src:'鲸华社 · 具身观察',title:'新消息',desc:''})};
    if(/^WHALE_LINES\|[^|]+$/.test(p)||/^ARCADE\|GUESTS\|\d+\|lines\|[^|]+$/.test(p))return {label:'台词',create:()=>''};
    return null;
  }
  function mediaKind(path,value) {
    const p=path.join('|'),key=path.at(-1);
    if(/^(?:img|image|cover|fullImg|dragImg|wandImg|WAND_IMG|PREVIEW_IMG|sprite|poster|background)$/.test(key)
      ||/^EMBODIED\|ASSETS\|(?:intro|news|live|graduation|firstjob|office|pod)$/.test(p)
      ||/^ARCADE\|(?:SPRITES|WHALE_SPRITES|RESULT_ART)\|/.test(p))return 'image';
    if(/^\/?resource\/.*\.(?:webp|png|jpe?g|gif|svg)$/i.test(value||''))return 'image';
    return null;
  }
  function dirty() {
    if (typeof App !== "undefined" && App.markCfgDirty) App.markCfgDirty();
  }
  function put(path, value) {
    let n = tool.data;
    path.slice(0,-1).forEach(k => { if (n[k] == null) n[k] = /^\d+$/.test(k) ? [] : {}; n = n[k]; });
    if (value === undefined) delete n[path[path.length-1]]; else n[path[path.length-1]] = value;
    (tool.touched || (tool.touched = new Set())).add(path[0]);
    dirty();
  }
  function field(path, value, optional) {
    const key = path[path.length-1], attrs = 'data-v2-path="'+E(path.join("|"))+'"'+(optional?' data-v2-optional="1"':'');
    const paceLabels={interval:'出场间隔（毫秒）',stay:'目标停留（毫秒）',concurrent:'同屏目标上限',rival:'访客概率',fire:'双击目标概率',batch:'额外同批出场概率',scale:'评级难度系数',DIFFICULTY:'五档难度',SPEED_MIN:'自适应最低速度',SPEED_MAX:'自适应最高速度',ADAPT_INTERVAL_MS:'速度调整间隔（毫秒）',ADAPT_HIT_HIGH:'提速命中率门槛',ADAPT_HIT_LOW:'降速命中率门槛',ADAPT_SPEED_UP:'每次提速倍率',ADAPT_SPEED_DOWN:'每次降速倍率'};
    const label = path.join('|')==='WHALE_CARE|XP|ARCADE' ? '清除幻觉' : path.join('|')==='WHALE_CARE|ARCADE_WEEKLY_CAP' ? '每周清除幻觉好感次数' : path[0]==='WHALE_LINES' && /^\d+$/.test(key) ? '第 '+(Number(key)+1)+' 句' : path[0]==='ARCADE'&&path[1]==='WHACK'&&paceLabels[key] ? paceLabels[key] : path[0]==='WHALE_CARE' && path[1]==='SNACKS' && key==='energy' ? '小鲸鱼体力恢复' : labels[key] || key;
    if(path.join('|')==='WHALE_CARE|FOLLOW_AUTHOR_UID')return '<div class="gcf-field"><label>'+E(label)+'</label><input type="text" inputmode="numeric" '+attrs+' value="'+E(value)+'" placeholder="例如 928415"><p class="gcf-tip">仅用于打开作者主页。关注状态由 B站 Toy 核验当前绑定作者，修改 UID 不会更改核验对象。</p></div>';
    if(/^WHALE_OUTFITS\|\d+\|unlock\|follow$/.test(path.join('|')))return '<div class="gcf-field"><label>获取方式</label><select '+attrs+'><option value="conditions"'+(value===true?'':' selected')+'>游戏条件解锁</option><option value="follow"'+(value===true?' selected':'')+'>关注作者后领取</option></select></div>';
    if(/^WHALE_OUTFITS\|\d+\|unlock\|videoTriple$/.test(path.join('|')))return '<div class="gcf-field"><label><input type="checkbox" '+attrs+(value===true?' checked':'')+'> 指定视频三连领取</label></div>';
    if(/^WHALE_OUTFITS\|\d+\|unlock\|videoBvid$/.test(path.join('|')))return '<div class="gcf-field"><label>'+E(label)+'</label><input type="text" '+attrs+' value="'+E(value)+'" placeholder="BV… 或 https://www.bilibili.com/video/BV…"><p class="gcf-tip" data-outfit-video-note="'+E(path[1])+'">'+(value ? '仅核验当前 Toy 作者投稿或联合投稿的视频；点赞、至少一枚币与收藏同时满足。' : '视频未配置，暂不开放领取；仍可预览。空值允许保存。')+'</p></div>';
    if (path[0] === "WHALE_CARE" && path[1] === "AUTOMATION" && ["UNLOCK_LEVEL","UNLOCK_MODE"].includes(key)) return "";
    if (path[0] === "ARCADE" && /^(?:durationSeconds|DURATION_SECONDS|goldBonusSeconds|maxBonusSeconds)$/.test(key)) return "";
    if(key==='id'&&listSpec(path.slice(0,-2)))return '<div class="gcf-field"><label>稳定编号（用于存档）</label><input type="text" '+attrs+' value="'+E(value)+'"></div>';
    if(path[0]==='EMBODIED'&&key==='variant')return '<div class="gcf-field"><label>'+label+'</label><select '+attrs+'>'+[...new Set(['news','live','graduation','firstjob',value].filter(Boolean))].map(v=>'<option value="'+E(v)+'"'+(v===value?' selected':'')+'>'+E({news:'新闻',live:'Live',graduation:'毕业',firstjob:'工作'}[v]||v)+'</option>').join('')+'</select></div>';
    if(key==='controlsDiagram')return '<div class="gcf-field"><label>'+label+'</label><select '+attrs+'>'+[...new Set(['grid','sort','rice',value].filter(Boolean))].map(v=>'<option value="'+E(v)+'"'+(v===value?' selected':'')+'>'+E({grid:'九宫格点击',sort:'左右分拣',rice:'拖动接米'}[v]||v)+'</option>').join('')+'</select></div>';
    if(key==='outfit'&&path.some(k=>k==='unlock'||k==='UNLOCK')){const rows=(tool.data.WHALE_OUTFITS||[]),choices=[['','不限'],...rows.map(row=>[row.id,row.name||row.id])];if(value&&!rows.some(row=>row.id===value))choices.push([value,value]);return '<div class="gcf-field"><label>'+label+'</label><select '+attrs+'>'+choices.map(([id,name])=>'<option value="'+E(id)+'"'+(id===(value||'')?' selected':'')+'>'+E(name)+'</option>').join('')+'</select></div>';}
    if (path.join('|')==='CITY_JOURNEY|ROUTE_VERSION') return '<p class="gcf-tip">路线版本 '+E(value)+' · 旧存档保留已读记录与当前进度</p>';
    if (path[0]==='CITY_JOURNEY' && key==='id') return '<div class="gcf-field"><label>稳定编号（用于存档，请保留）</label><input '+attrs+' value="'+E(value)+'"></div>';
    if (path[0]==='CITY_JOURNEY' && key==='minVer') return '<div class="gcf-field"><label>解锁阶段</label><select '+attrs+'>'+['V5','V5.5','V6','V6.5'].map(t=>'<option '+(t===value?'selected ':'')+'value="'+E(t)+'">'+E(t)+'</option>').join('')+'</select></div>';
    if (key === "type" && path.includes("CARDS")) return '<div class="gcf-field"><label>卡片类型</label><select '+attrs+'>'+["good","junk","trap","gold"].map(t=>'<option '+(t===value?'selected ':'')+'value="'+t+'">'+({good:"好语料",junk:"垃圾",trap:"陷阱",gold:"精标"}[t])+'</option>').join("")+'</select></div>';
    if (key === "stage") return '<div class="gcf-field"><label>'+label+'</label><select '+attrs+'><option value="">不限</option>'+((tool.data||{}).VER_ORDER||window.GameDefaults.base.VER_ORDER||[]).map(t=>'<option '+(t===value?'selected ':'')+'value="'+E(t)+'">'+E(t)+'</option>').join("")+'</select></div>';
    if (typeof value === "boolean" || key === "chat") return '<div class="gcf-field"><label><input type="checkbox" '+attrs+(value?' checked':'')+'> '+label+'</label></div>';
    if (typeof value === "number" || ["week","affection"].includes(key)) return tool.num(label, attrs, value == null ? '' : value, 'any');
    if (mediaKind(path,value) || path[0]==='CITY_JOURNEY' && key==='src') return tool.img(label, attrs, value).replace('data-browse','data-v2-browse');
    if(path[0]==='WHALE_LINES'||['text','desc','DESC','DESCRIPTION','caption','option','reply'].includes(key))return '<div class="gcf-field"><label>'+E(label)+'</label><textarea rows="3" '+attrs+'>'+E(value)+'</textarea></div>';
    return tool.text(label, attrs, value);
  }
  function tree(value, path) {
    const key = path[path.length-1];
    if (path.length === 1 && key === 'WHALE_CARE') return careTree(value);
    if (path.join('|') === 'WHALE_CARE|XP_LEVELS' && Array.isArray(value)) return '<div class="gcf-grid whale-care-levels">'+value.map((v,i)=>field(path.concat(String(i)),v).replace(new RegExp('<label>[^<]*</label>'),'<label>Lv.'+(i+1)+' 累计好感度</label>')).join('')+'</div>';
    if (["unlock","UNLOCK"].includes(key)) {
      const outfit=/^WHALE_OUTFITS\|\d+\|unlock$/.test(path.join('|'));
      const ordinary=["stage","week","affection","outfit","chat","event"], extras=Object.keys(value||{}).filter(k=>!ordinary.concat('follow','videoTriple','videoBvid').includes(k));
      return '<div class="gcf-row-card"><div class="rc-head">解锁条件（同时满足）</div>'+(outfit?'<div class="gcf-grid">'+field(path.concat('follow'),(value||{}).follow,true)+field(path.concat('videoTriple'),(value||{}).videoTriple,true)+field(path.concat('videoBvid'),(value||{}).videoBvid,true)+'</div><p class="gcf-tip">关注与三连可同时开启，需同时满足下面的游戏条件；留空代表不限制。已关注的玩家也可领取，每个账号只需领取一次。已领取的时装保留，修改指定视频仅影响未领取玩家。</p>':'')+'<div class="gcf-grid">'+ordinary.map(k=>field(path.concat(k),(value||{})[k],true)).join("")+'</div>'+extras.map(k=>'<div class="gcf-row-card"><div class="rc-head">自定义条件 · '+E(k)+'</div>'+tree(value[k],path.concat(k))+'</div>').join('')+'</div>';
    }
    if (Array.isArray(value)) {
      const spec=listSpec(path),attrs='="'+E(path.join('|'))+'"';
      const buttons=(i)=>spec?'<div class="rc-line"><button class="btn btn-sm" type="button" data-v2-move'+attrs+' data-index="'+i+'" data-direction="-1"'+(!i?' disabled':'')+'>↑</button><button class="btn btn-sm" type="button" data-v2-move'+attrs+' data-index="'+i+'" data-direction="1"'+(i===value.length-1?' disabled':'')+'>↓</button><button class="btn btn-sm" type="button" data-v2-delete'+attrs+' data-index="'+i+'"'+'>删除'+E(spec.label)+'</button></div>':'';
      return '<div class="gcf-row-card"><div class="rc-head">'+E(labels[key]||key)+'</div>'+value.map((v,i)=>'<details'+(["CARDS","STOPS"].includes(key)?'':' open')+'><summary>'+E(key==='STOPS'?(i+1)+' · '+(v.minVer||'未设阶段')+' · '+(v.label||v.id):(v&&(v.title||v.name||v.id)) || (i+1))+'</summary>'+tree(v,path.concat(String(i)))+buttons(i)+'</details>').join('')+(spec?'<button class="btn btn-sm" type="button" data-v2-add'+attrs+'>＋ 新增'+E(spec.label)+'</button>':'')+'</div>';
    }
    if (value && typeof value === "object") {
      const schema=rowSchema(path),entries={...schema,...value};
      return (path.join("|") === "WHALE_CARE|AUTOMATION" ? '<p class="gcf-tip">开放条件：开智出舱后开放。首次出舱会引导玩家选择托管安排。</p>' : '')+'<div class="gcf-grid">'+Object.entries(entries).filter(([k]) => !["WHALE_CARE|FOLLOW_AUTHOR_UID"].includes(path.concat(k).join("|"))).map(([k,v]) => typeof v === "object" && v != null ? '<div class="gcf-row-card"><div class="rc-head">'+E(labels[k]||k)+'</div>'+tree(v,path.concat(k))+'</div>' : field(path.concat(k),v,!(k in value)&&typeof v!=='boolean')).join('')+'</div>';
    }
    return field(path,value);
  }
  function careTree(value) {
    Object.assign(labels, {LOW_ENERGY_NOTICE:'体力不足提示', OUTFIT_NOTICE:'装扮解锁提示', UI:'入口文案', LABEL:'按钮名称', FEED_BADGE:'可投喂角标', ARCADE_REWARD_TEXT:'清除幻觉结算提示（{xp}为实际好感）', ARCADE_BONUS_TEXT:'清除幻觉陪伴规则文案', ARCADE_PRACTICE_TEXT:'练习模式结算说明', threshold:'体力提示阈值', ms:'显示时长（毫秒）'});
    const used=new Set(['FOLLOW_AUTHOR_UID']), base=['WHALE_CARE'];
    const renderKey=k=>{used.add(k);const content=value[k]!==null&&typeof value[k]==='object'?tree(value[k],base.concat(k)):field(base.concat(k),value[k]);return ['UI','LOW_ENERGY_NOTICE','OUTFIT_NOTICE'].includes(k)?'<div class="gcf-row-card"><div class="rc-head">'+E(labels[k])+'</div>'+content+'</div>':content;};
    const section=(title,keys,cls='')=>{const present=keys.filter(k=>Object.prototype.hasOwnProperty.call(value,k));return present.length?'<section class="gcf-row-card whale-care-section '+cls+'"><div class="rc-head rc-title">'+E(title)+'</div><div class="gcf-grid">'+present.map(renderKey).join('')+'</div></section>':'';};
    let html=section('基础设置',['ENABLED','DESC','UNLOCK']);
    html+=section('体力设置',['ENERGY','ENERGY_FEED_AFTER_STAGE_CAP']);
    html+=section('互动次数与奖励周期',['CHAT_DAILY_CAP','DROP_WEEKLY_CAP','ARCADE_WEEKLY_CAP','FEEDS_PER_WEEK','STAGE_MAX_WEEKS']);
    html+=section('互动好感度奖励',['XP']);
    html+=section('好感度等级门槛',['XP_LEVELS']);
    html+=section('零食 · 价格、好感度与体力',['SNACKS'],'whale-care-snacks');
    html+=section('托管行为',['AUTOMATION']);
    html+=section('好感度加成',['BUFFS']);
    html+=section('界面文案与提示',['UI','LOW_ENERGY_NOTICE','OUTFIT_NOTICE'],'whale-care-notices');
    html+=section('其他配置',Object.keys(value).filter(k=>!used.has(k)));
    return '<div class="whale-care-config">'+html+'</div>';
  }
  function ensureData() {
    if (!tool.data) return;
    KEYS.forEach(k => { if (tool.data[k] == null && window.GameDefaults.base[k] != null) tool.data[k] = JSON.parse(JSON.stringify(window.GameDefaults.base[k])); });
    if(tool._lifeSystemsData!==tool.data){tool._lifeSystemsData=tool.data;tool._lifeSystemsOriginal={};WHOLE_SECTIONS.forEach(k=>{if(tool.data[k]!=null)tool._lifeSystemsOriginal[k]=JSON.stringify(tool.data[k]);});}
    for(const key of ['ENERGY','AUTOMATION'])if(tool.data.WHALE_CARE && tool.data.WHALE_CARE[key]==null && !(tool.touched&&tool.touched.has('WHALE_CARE')) && window.GameDefaults.base.WHALE_CARE[key])tool.data.WHALE_CARE[key]=JSON.parse(JSON.stringify(window.GameDefaults.base.WHALE_CARE[key]));
    ["REWARD_CAPS"].forEach(k => {
      if (tool.data.ARCADE && !Object.prototype.hasOwnProperty.call(tool.data.ARCADE,k) && window.GameDefaults.base.ARCADE && window.GameDefaults.base.ARCADE[k])
        tool.data.ARCADE[k] = JSON.parse(JSON.stringify(window.GameDefaults.base.ARCADE[k]));
    });
    const arcade = tool.data.ARCADE;
    if (arcade) {
      delete arcade.REWARD_MULT_BY_VER;



    }
  }
  const originalRender = tool.renderBase;
  tool.renderBase = function () {
    const result = originalRender.apply(this,arguments), root = document.getElementById("gamecfg-base");
    if (!root || !this.data) return result;
    ensureData();
    root.insertAdjacentHTML("beforeend", tool.mod("", "鲸鱼房", "V5 具身开智后开放。投喂仅恢复小鲸鱼自身体力，成功托管会消耗；没有每周或离线免费恢复。好感额外提供工程师休假恢复最多5%、产出最多3%。游戏厅奖励在【小游戏】分页配置，装扮与领取条件在【时装】分页配置。",tree(this.data.WHALE_CARE,["WHALE_CARE"])+(this.data.WHALE_LINES?tool.mod('', '小鲸鱼台词', '拖动、投喂、提前休息、待机与训练时的随机台词；留空则用代码兜底文案。', '<div class="whale-care-lines">'+tree(this.data.WHALE_LINES,['WHALE_LINES'])+'</div>'):'')) + tool.mod('', '具身智能时代', '进入 V5 先封闭休眠仓；正式立项后，达到训练周数和两项能力比例才出舱。图像字段支持素材选择。',tree(this.data.EMBODIED,['EMBODIED']))+(this.data.FACTORY?tool.mod('', '素体', 'V5 / V5.5 / V6 / V6.5 分别采购 A1 / A2 / A3 / A4。每阶段独立采购，每款只购买一次；此前阶段的素体不抵扣当前采购费用。',tree(this.data.FACTORY,['FACTORY'])):'') + '<p id="v2b-config-errors" class="gcf-tip"></p>');
     return result;
  };
  const payload = tool.basePayload;
  tool.basePayload = function () {
    if(this.touched&&this.touched.has('WHALE_OUTFITS'))for(const row of this.data.WHALE_OUTFITS||[]){if(row&&row.unlock&&Object.prototype.hasOwnProperty.call(row.unlock,'videoBvid')){const normalized=normalizeBvid(row.unlock.videoBvid);if(normalized!==null)row.unlock.videoBvid=normalized;}}
    return payload.apply(this,arguments);
  };
  const save = tool.save;
  tool.save = async function(options={}) {
    const sections=WHOLE_SECTIONS.filter(key=>this.data&&this.data[key]!=null&&this.touched&&this.touched.has(key));
    await save.apply(this,arguments);
    for(const section of sections){
      const latestResponse=await fetch('/api/game-cfg');if(!latestResponse.ok)throw new Error('无法核对'+(labels[section]||section)+'配置');
      const latest=await latestResponse.json(),saved=(latest.config||{})[section],defaults=window.GameDefaults.base[section];
      const merged=saved==null?defaults:this.deepMerge(defaults||{},saved);
      if(this._lifeSystemsOriginal&&this._lifeSystemsOriginal[section]!==JSON.stringify(merged))throw new Error((labels[section]||section)+'配置已被其他窗口修改，请刷新后重试');
      if(window.CfgSync)window.CfgSync.note(latest);
      const response=await fetch('/api/game-cfg-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({section,config:this.data[section],expectMtime:window.CfgSync?window.CfgSync.expect():undefined})});
      const result=await response.json();if(!result.ok)throw new Error(result.error||'保存失败');
      if(window.CfgSync)window.CfgSync.update(result.mtime);
      this._lifeSystemsOriginal[section]=JSON.stringify(this.data[section]);this.touched.delete(section);
    }
  };
  function input(e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.v2Path || !tool.data) return;
    const path = el.dataset.v2Path.split("|");
    let value = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? undefined : +el.value) : el.value;
    if(/^WHALE_OUTFITS\|\d+\|unlock\|follow$/.test(el.dataset.v2Path))value=el.value==='follow'?true:el.value==='conditions'?undefined:el.value;
    if(/^WHALE_OUTFITS\|\d+\|unlock\|videoBvid$/.test(el.dataset.v2Path)){const normalized=normalizeBvid(value);if(normalized!==null){value=normalized;if(e.type==='change')el.value=normalized;}}
    if (el.dataset.v2Optional && (value === "" || value === false)) value = undefined;
    put(path,value);
    if(window.OutfitsTool)window.OutfitsTool.updatePreview(path);
  }
  document.addEventListener("input",input); document.addEventListener("change",input);
  document.addEventListener("click",async e => {
    const b = e.target.closest && e.target.closest("[data-v2-browse],[data-v2-add],[data-v2-delete],[data-v2-move]");
    if (!b || !tool.data) return;
    if (b.hasAttribute("data-v2-browse")) {
      const el = b.parentElement.querySelector("input"), value = await ResPicker.pick(el.value,{title:"选择玩法图片",kind:"image"});
      if (value) { el.value = value; input({target:el}); }
    } else {
      const p = (b.dataset.v2Add || b.dataset.v2Delete || b.dataset.v2Move).split("|"), list = get(tool.data,p),spec=listSpec(p);
      if(!spec||!Array.isArray(list)||b.disabled)return;
      if (b.dataset.v2Add) { const row=spec.create();if(row&&typeof row==='object')row.id=stableId(spec.prefix,list);list.push(row); }
      else if(b.dataset.v2Move){const i=+b.dataset.index,to=i+Number(b.dataset.direction);if(!Number.isInteger(i)||to<0||to>=list.length)return;list.splice(to,0,list.splice(i,1)[0]);}
      else {list.splice(+b.dataset.index,1);}
      (tool.touched || (tool.touched=new Set())).add(p[0]); dirty();
      if (p[0] === "ARCADE" && window.MinigamesTool) window.MinigamesTool.render(); else if(p[0]==='WHALE_OUTFITS'&&window.OutfitsTool)window.OutfitsTool.render(); else tool.renderBase();
    }
  });
  window.V2BGameplay = { keys:KEYS, tree, field, ensureData, normalizeBvid };
})();
