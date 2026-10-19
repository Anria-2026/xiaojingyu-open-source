/* ==========================================================================
   主界面流程 —— 强制加载 → 等待主菜单 → 进入游戏（手机端适配版）
   --------------------------------------------------------------------------
   参考《07-可复用经验沉淀-下一项目.md》§七/§八：
   - 主界面即后台预加载资源（BGM/纸片人/场景图），分阶段门控 + 超时兜底
   - BGM 用 fetch + decodeAudioData + BufferSource(loop)，而非 <audio>
   - 自动播放策略：AudioContext 首个手势内 resume，未解锁前不强行出声
   掉落物理：
   - 遵循重力加速度 + 终端速度；grow 阶段落底/落堆即停，堆满整屏才漏出
   - 点击/移动特效由全局 FX 层（js/fx.js）统一处理，所有界面生效
   ========================================================================== */
"use strict";

/* iOS 判定（2026-10-03）：iPadOS 13+ 桌面 UA 也算（MacIntel + 多点触控）。
   ⚠️ index.html 启动黑匣里有一份同款判定 —— 两处改要同改（黑匣那份管诊断显隐）。 */
const MENU_IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/* ---- 资源路径（资源统一在 resource/，配置改即生效；以下为默认/兜底） ---- */
let MENU_BGM_URL = "";                      // 主界面音乐（从 bgm_config 读）
let SCENE_BGM_URL = "";                     // 主场景音乐（从 bgm_config 读）
let REVIEW_BGM_URL = "";                    // 评审界面音乐（2026-09-04，留空则用主场景曲）
let BONUS_BGM_URL = "";                     // 结算演出音乐（2026-09-04，留空则用主场景曲）
let WHALE_SPRITE = "resource/character/stand.webp";   // 纸片人（下落动画 / 游戏中主角）

/* ---- 主菜单全部鲸鱼娘姿势（随机掉落）；标题图 ---- */
let WHALE_SPRITES = [
  "resource/character/stand.webp",
  "resource/character/叉腰.webp",
  "resource/character/大拇哥.webp",
  "resource/character/比耶.webp",
  "resource/character/躺1.webp",
];
let TITLE_IMG = "resource/ui/title_cut.webp";   // 标题图：绿幕抠图版（纯绿→透明，保留边缘抗锯齿）
/* 游戏实装的那一份配置（/data/game_cfg.json）——resolveAssets 启动时就取回来了，
   菜单层要用配置（如「制作组名单」正文）直接读它，**不再多发一次请求**。 */
let EXT_CFG = null;

/* ---- 进入游戏前统一预加载的资源清单（图片 + 音频） ----
   覆盖：主菜单立绘/标题/场景、玩法配置里的界面立绘(UI_PORTS)、训练轮播立绘(TRAIN_PORTS)、
   全部工程师像素头像、事件立绘 img、场景背景/物件、BGM 与全部已配置音效。
   收集到集合后由 preloadAndStart 并发预加载，保证进游戏/进训练一律零延迟。 */
let PRELOAD_IMG = new Set();
let PRELOAD_AUD = new Set();

/* 递归收集 JSON 中的资源 URL：图片(webp/png/jpg/gif) 进 imgSet，音频(mp3/wav/ogg/m4a) 进 audSet。
   只认 resource/ 前缀（项目硬性规范，资源统一在项目根 resource/），data: 内联数据不收集。 */
function collectRes(obj, imgSet, audSet) {
  if (obj == null) return;
  if (typeof obj === "string") {
    if (!obj.startsWith("resource/") && !obj.startsWith("/resource/")) return;
    const q = obj.split("?")[0];
    if (/\.(webp|png|jpe?g|gif)$/i.test(q)) imgSet.add(obj);
    else if (/\.(mp3|wav|ogg|m4a|flac)$/i.test(q)) audSet.add(obj);
    return;
  }
  if (Array.isArray(obj)) { for (const x of obj) collectRes(x, imgSet, audSet); return; }
  if (obj && typeof obj === "object") {
    for (const k in obj) collectRes(obj[k], imgSet, audSet);
  }
}

/* [feature:menu-startup-collector] */
/* Later systems load their original media when their own surface opens.
   Recursively warming the whole story at boot adds hundreds of MB of decoded
   images the menu cannot use and evicts its immediately visible sprites. */
function collectStartupRes(cfg, imgSet, audSet) {
  const deferred = new Set(["EMBODIED", "FACTORY", "CITY_JOURNEY", "LIFE_STORY"]);
  for (const key of Object.keys(cfg || {})) {
    if (!deferred.has(key)) collectRes(cfg[key], imgSet, audSet);
  }
}
/* [/feature:menu-startup-collector] */
/* 图片重试由共享 ImageResources 管理：配置化超时与有限重试，
   换源/移除时取消旧任务，保留查询参数，并尊重独立 CG 加载器的所有权。 */
function installImgRetry() {
  window.ImageResources?.install();
}

/* 带超时的 fetch（2026-09-24，iOS 启动链防挂）：弱网/坏路由下连接可能长时间
   既不完成也不拒绝（运营商黑洞、GFW 抖动），而 resolveAssets 挡在启动链上——
   挂住它就永远到不了「点击开始」。6s 超时按「没这份配置」处理，
   各调用方本就有 .catch(() => ({})) 兜底；老引擎没有 AbortController 就裸跑。 */
function fetchT(url, ms) {
  const opt = { cache: "no-store" };
  if (typeof AbortController === "undefined") return fetch(url, opt);
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms || 6000);
  return fetch(url, Object.assign(opt, { signal: c.signal })).then(
    (r) => { clearTimeout(t); return r; },
    (e) => { clearTimeout(t); throw e; }
  );
}

/* 启动前解析资源 URL：BGM 从 bgm_config.json，场景/角色/立绘从 project.json 与玩法配置（资源在 resource/）。
   同时把已知资源并入 PRELOAD_* 集合，供进入游戏前统一预加载。 */
async function resolveAssets() {
  try {
    const [bgm, proj, cfg] = await Promise.all([
      fetchT("./data/bgm_config.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      fetchT("./data/project.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      fetchT("./data/game_cfg.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    MENU_BGM_URL = (bgm && bgm.menu) || "";
    SCENE_BGM_URL = (bgm && bgm.scene) || "";
    REVIEW_BGM_URL = (bgm && bgm.review) || "";
    BONUS_BGM_URL = (bgm && bgm.bonus) || "";
    EXT_CFG = (cfg && typeof cfg === "object") ? cfg : null;   // 菜单层要用配置（制作组名单等）
    /* 2026-09-04：暴露给玩法层，按阶段切歌（评审 / 结算单独配乐） */
    window.BGM_URLS = {
      menu: MENU_BGM_URL, scene: SCENE_BGM_URL,
      review: REVIEW_BGM_URL, bonus: BONUS_BGM_URL,
    };
    // 所有场景的背景/主角/物件来源并入预加载清单（不止当前激活场景，避免切换穿帮）
    (proj && proj.scenes || []).forEach((scn) => {
      if (scn.bg && !scn.bg.startsWith("data:")) { PRELOAD_IMG.add(scn.bg); }
      if (scn.player && scn.player.src && !scn.player.src.startsWith("data:")) {
        PRELOAD_IMG.add(scn.player.src); WHALE_SPRITE = scn.player.src;
      }
      (scn.objects || []).forEach((o) => { if (o.src) PRELOAD_IMG.add(o.src); });
    });
    // 玩法配置里的全部图片（界面立绘/轮播立绘/工程师头像/事件立绘）+ 其音频
/* [feature:menu-startup-resources] */
    collectStartupRes(cfg, PRELOAD_IMG, PRELOAD_AUD);
    // Keep the early game defaults warm; late story/embodied media stays lazy.
    if (window.GameCfg) collectStartupRes(window.GameCfg, PRELOAD_IMG, PRELOAD_AUD);
/* [/feature:menu-startup-resources] */

    if (MENU_BGM_URL) PRELOAD_AUD.add(MENU_BGM_URL);
    if (SCENE_BGM_URL) PRELOAD_AUD.add(SCENE_BGM_URL);
    if (REVIEW_BGM_URL) PRELOAD_AUD.add(REVIEW_BGM_URL);
    if (BONUS_BGM_URL) PRELOAD_AUD.add(BONUS_BGM_URL);
  } catch (e) { /* 保持默认 */ }
}

/* 掉落物理：强重力加速度 + 终端速度（px/s）—— 先慢后快，越掉越快 */
const FALL_G = 3000;
const FALL_TERM = 1000;

const $menu = (s, r = document) => r.querySelector(s);

/* ============================================================
   音频管理器（BGM）：fetch + decodeAudioData + BufferSource(loop)
   --------------------------------------------------------------------------
   参考《07-可复用经验沉淀-下一项目.md》§八 音频优化：
   1) 加载界面即预解码（predecode）→ 首播/切曲零延迟
   2) 字节缓存 + 共享 Promise 防重复请求；decode 会 detach → 缓存副本
   3) 加载/解码失败自动重试一次
   4) 切曲立即停旧曲、新曲就绪再续
   5) resume 不阻塞播放（fire-and-forget），避免非手势期无限挂起
   6) 首次用户手势 unlock：恢复上下文并立即起播"待播曲"（自动播放策略）
   7) 音乐音量单点结算 _applyGain()，禁止各处直接写 gain.value
   ============================================================ */
const AudioMgr = {
  ctx: null,
  master: null,
  seq: 0,               // 切歌序号，作废旧加载
  cur: null,            // { src, url } 当前播放源
  want: null,           // 待播曲目（上下文未解锁时挂起，首次手势立刻起播）
  bytes: {},            // 原始字节缓存（decode 会 detach buffer）
  bytesP: {},           // 进行中的 fetch Promise（去重）
  decoded: {},          // 预解码好的 AudioBuffer（消除首播/切换延迟）
  /* 解码缓存上限（2026-09-25，玩家「加载界面 10 秒闪退」根因）：
     AudioBuffer 是**未压缩 PCM** —— 48000Hz 立体声 float32 = 384KB/秒，
     实测 4 首 BGM 解码后驻留 280MB（连语音共 289MB！），移动端 WebView 直接 OOM
     被系统杀掉 = 玩家说的闪退。超限按「最久未用」淘汰（在播/待播的永不淘汰）。 */
  DECODE_KEEP: 2,
  _lru: [],             // decoded 的使用顺序（尾部最新）
  musicVolKey: "whale_music_vol",   // 音乐音量持久化（localStorage）
  musicVol: 0.6,        // 音乐音量（单点结算）
  _armed: false,        // 是否已挂上首次手势监听

  /* 启动时恢复上次保存的音量（刷新不重置） */
  _restoreVol() {
    try {
      const v = parseFloat(localStorage.getItem(this.musicVolKey));
      if (!isNaN(v) && v >= 0 && v <= 1) this.musicVol = v;
    } catch (e) {}
  },

  _ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this._restoreVol();               // 恢复上次保存的音量
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.musicVol;
      this.master.connect(this.ctx.destination);
      /* 音效独立通道（BUG 修复 2026-08-29：音乐调 0 时音效被一起静音）：
         音乐走 master（受 musicVol 控制），音效走 sfxGain（受 SFX.vol 控制），互不影响。 */
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1.0;
      this.sfxGain.connect(this.ctx.destination);
      this._armUnlock();                  // 首次手势恢复上下文并起播待播曲
      return true;
    } catch (e) { return false; }
  },

  /* 首次用户手势：恢复上下文 + 起播挂起的曲目（§八.8 自动播放策略）
     注意：监听器只挂一次、永不重复挂载。unlock() 本身幂等（已 running 时近乎零开销），
     每次手势调用一次完全安全。绝对不能用 once+重新挂载的模式——安卓上一次点击
     会同时触发 pointerdown 和 touchstart，once 只移除实际触发的那一个，
     重新挂载会让监听器按 2^n 指数累积，十几次点击后主线程被彻底堵死（卡死）。 */
  _armUnlock() {
    if (this._armed) return;
    this._armed = true;
    const h = () => { this.unlock(); };
    /* 2026-09-24（iOS 三轮）：补 touchstart——无 Pointer Events 的苹果设备上
       只靠 pointerdown/keydown 永远解锁不了音频（表现为进菜单也没音乐）。
       unlock 本身幂等，同一次点按双事件重复调用无害。 */
    window.addEventListener("pointerdown", h, { passive: true });
    window.addEventListener("touchstart", h, { passive: true });
    window.addEventListener("keydown", h, { passive: true });
  },

  async unlock() {
    if (!this._ensure()) return;
    try { if (this.ctx.state === "suspended") await this.ctx.resume(); } catch (e) {}
    if (this.want) { const w = this.want; this.want = null; this.playBgm(w.url); }
  },

  /* 恢复上下文：不阻塞（fire-and-forget），播放不依赖它完成 */
  resume() {
    if (!this._ensure()) return;
    try {
      if (this.ctx.state === "suspended") {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {}
  },

  /* 等待上下文进入可播放状态（最多 ms 毫秒），避免无手势期永久挂起 */
  _waitRunning(ms) {
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (!this.ctx || this.ctx.state === "running") return resolve(true);
        if (performance.now() - t0 > ms) return resolve(false);
        setTimeout(tick, 25);
      };
      tick();
    });
  },

  /* 字节缓存 + 共享 Promise；加载失败自动重试一次（§八.5） */
  async fetchBytes(url) {
    if (this.bytes[url]) return this.bytes[url];
    if (this.bytesP[url]) return this.bytesP[url];
    this.bytesP[url] = (async () => {
      let lastErr;
      for (let i = 0; i < 2; i++) {                 // 失败重试一次
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error("BGM " + r.status);
          const b = await r.arrayBuffer();
          this.bytes[url] = b;
          return b;
        } catch (e) { lastErr = e; }
      }
      throw lastErr;
})();
    try { return await this.bytesP[url]; }
    catch (e) { delete this.bytesP[url]; throw e; }
  },

  /* 解码缓存治理（2026-09-25）：记使用序 + 淘汰最久未用（详见 DECODE_KEEP 注释）。
     淘汰只删 decoded 里的引用 —— 已 connect 的播放源自己持有 buffer，不断音；
     下次再播这首会重新解码（fetchBytes 字节缓存还在的话很快）。
     ⚠️ 只登记「确实在 decoded 里」的 url（幽灵条目不入列）。 */
  _rememberDecoded(url) {
    if (!url || !this.decoded[url]) return;
    this._lru = (this._lru || []).filter((u) => u !== url);
    this._lru.push(url);
    this._trimDecoded();
  },
  _trimDecoded() {
    const keep = this.DECODE_KEEP != null ? this.DECODE_KEEP : 2;
    const alive = (u) => (this.cur && this.cur.url === u) || (this.want && this.want.url === u);
    let guard = 0;
    while (this._lru.length > keep && guard++ < 50) {
      const old = this._lru.shift();
      if (alive(old)) { this._lru.push(old); continue; }   // 在播 / 待播：跳过不淘汰
      delete this.decoded[old];
    }
  },

  /* 预解码：加载界面空闲期就把 BGM 解码好（§八.3 decode 会 detach，用副本） */
  async predecode(url) {
    if (!this._ensure()) return null;
    if (this.decoded[url]) { this._rememberDecoded(url); return this.decoded[url]; }   // 命中也要 touch LRU
    try {
      const raw = await this.fetchBytes(url);
      const ab = raw.slice(0);
      /* 2026-09-16（iOS「卡在加载」）：老 iOS 的 decodeAudioData 可能永远不回调
         （WebKit 怪癖）—— 与 15s 定时器赛跑，超时按失败处理（返回 null 兜底），
         挂死的解码绝不拖住加载闸门和 playBgm。 */
      const buf = await Promise.race([
        this.ctx.decodeAudioData(ab),
        new Promise((_, rej) => setTimeout(() => rej(new Error("decode timeout")), 15000)),
      ]);
      this.decoded[url] = buf;
      this._rememberDecoded(url);
      /* 解码成功立即释放原始字节（iPhone 上内存减半；解码失败保留原样供重试） */
      delete this.bytes[url];
      return buf;
    } catch (e) { return null; }
  },

  async playBgm(url) {
    if (!this._ensure()) return false;
    this.resume();                                // 尽力恢复，不阻塞起播
    const my = ++this.seq;
    // 优先用预解码缓存；没有才临时解码（兜底）
    let buffer = this.decoded[url];
    if (!buffer) buffer = await this.predecode(url);
    if (!buffer || my !== this.seq) return false; // 已被新请求作废
    // 等待上下文恢复（手势中瞬间完成；无手势超时后挂起待播，解锁即起播）
    const ok = await this._waitRunning(600);
    if (my !== this.seq) return false;
    if (ok) { this._start(url, buffer, my); return true; }
    this.want = { url };
    return false;
  },

  _start(url, buffer, my) {
    this.stopBgm();                               // 立即停旧曲，再续新曲（§八.6）
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.master);
    src.start();
    this.cur = { src, url };
    this._rememberDecoded(url);                   // 在播曲顶到 LRU 尾（不被淘汰）
  },

  stopBgm() {
    if (this.cur && this.cur.src) { try { this.cur.src.stop(); } catch (e) {} this.cur = null; }
  },

  /* 音乐音量：单点结算（§八.7），只经此修改 master.gain；同时持久化（刷新不重置） */
  setMusicVolume(v) {
    this.musicVol = Math.max(0, Math.min(1, v));
    this._applyGain();
    try { localStorage.setItem(this.musicVolKey, String(this.musicVol)); } catch (e) {}
  },
  _applyGain() { if (this.master) this.master.gain.value = this.musicVol; },
};

/* 顶层 const 不在 window 上，必须显式暴露，否则 sfx.js/training.js 里 window.AudioMgr
   = undefined → 所有程序化音效静音、音量条无效。 */
window.AudioMgr = AudioMgr;

/* ============================================================
   主菜单（纸片人掉落动画 + 流程控制；特效交给全局 FX）
   ============================================================ */
const Menu = {
  whaleImg: null,
  whaleImgs: [],        // 全部鲸鱼娘姿势（随机掉落）
  whaleLoaded: false,
  titleImg: null,
  geoShapes: [],        // 底图几何图案（左下→右上缓慢移动）
  canvas: null,
  ctx: null,
  W: 300,
  H: 150,
  dpr: 1,
  fallers: [],
  phase: "grow",        // grow: 越来越密并堆积 / drain: 漏出清空
  spawnAcc: 0,
  spawnRate: 0.9,
  growth: 0,
  maxFallers: 40,
  _time: 0,
  _last: 0,
  menuBgmStarted: false,
  started: false,       // 是否已进入游戏

  /* ---------------- 启动：加载界面 → 等待主菜单 ---------------- */
  boot() {
/* [feature:menu-style-boot-gate] */
    const health = window.BootHealth;
    if (health && !health.stylesReady()) {
      if (!this._stylesBootWaiting) {
        this._stylesBootWaiting = true;
        health.whenStylesReady(() => this.boot());
      }
      return;
    }
    if (this._bootStarted) return;
    this._bootStarted = true;
/* [/feature:menu-style-boot-gate] */
    if (window.__B) window.__B.mark("menu:boot");   // 启动黑匣（index.html 内联段）
    installImgRetry();      // 全站图片失败自动重试（含进游戏之后加载的图）
    this._installBootErrorTrap();   // iOS「卡在加载」诊断探针：错误直接写上加载屏
    this.armStuckEscape();          // 加载卡住的点按逃生通道（2026-09-16）
    this.preloadAndStart();
  },

  /* 2026-09-16（iOS 用户反馈「卡在加载界面点了没有反应」）诊断探针：
     加载屏还挂着期间的任何 JS 报错 / 未处理 Promise 拒绝，直接写进加载文本 ——
     以前 iOS 用户报「卡死」，二手信息完全不知道炸的是什么；现在报错内容
     第一时间出现在屏幕上，玩家截图就能把现场带回来。 */
  _installBootErrorTrap() {
    const show = (msg) => {
      if (window.__B) window.__B.mark("trap:" + String(msg).slice(0, 40));
      const ld = document.getElementById("loading");
      if (!ld || !ld.isConnected) return;   // 加载屏已退场，不再多事
      const t = document.getElementById("load-text");
      if (t) t.textContent = "加载出错: " + String(msg).slice(0, 60);
    };
    /* [feature:menu-optional-sdk-trap] */
    window.addEventListener("error", (e) => {
      const sdk = document.querySelector("script[data-boot-sdk]");
      if (sdk && ((e.filename && e.filename === sdk.src) || e.target === sdk)) return;
      show((e.error && e.error.message) || e.message || e.type);
    }, true);
    /* [/feature:menu-optional-sdk-trap] */
    window.addEventListener("unhandledrejection", (e) => show((e.reason && e.reason.message) || e.reason || "Promise 拒绝"));
  },

  /* 2026-09-16（iOS「点了没有反应」）逃生通道：加载超过 8 秒后，任意点按
     直接放弃剩余预载进主菜单 —— 加载屏从此不存在「点了没反应」的状态。
     音频没解码完不碍事：playBgm 播放时会自行 predecode 兜底，只是首播稍慢。
     与正常流程（armContinueTap）同走 showMenu，靠 _entered 幂等防双触发。 */
  armStuckEscape() {
    setTimeout(() => {
      if (this._entered) return;
      const h = () => {
        AudioMgr.unlock();
        setTimeout(() => this.showMenu(), 0);
      };
      this._escapeH = h;
      /* 2026-09-24（iOS 三轮）：与 armContinueTap 同病——只绑 pointerdown 在
         无 Pointer Events 的苹果设备上整条逃生通道哑火。补 touchstart / click；
         一次点按多事件连发由 showMenu 的 _entered 幂等闸兜住。 */
      this._escapeTypes = ["pointerdown", "touchstart", "click"];
      this._escapeTypes.forEach((t) => window.addEventListener(t, h, { capture: true }));
    }, 8000);
  },

  async preloadAndStart() {
    const start = performance.now();
    const minMs = 900;                       // 保证加载画面至少可见
    await resolveAssets();                   // 解析 resource 路径 + 收集全部待预加载资源清单
    if (window.__B) window.__B.mark("menu:assets");

    // 主菜单自身资源并清单（姿势/标题/场景背景/主角，resolveAssets 已并入大多数，这里补齐候选姿势）
    WHALE_SPRITES.forEach((u) => PRELOAD_IMG.add(u));
    PRELOAD_IMG.add(TITLE_IMG);
    PRELOAD_IMG.add(WHALE_SPRITE);
    // 全部已配置音效（音效页）——由 SFX.preload 预解码进其共享缓存
    const sfxPromise = window.SFX
      ? Promise.resolve(window.SFX.preload())
      : Promise.resolve();

/* [feature:menu-startup-workers] */
    const critical = new Set([...WHALE_SPRITES, TITLE_IMG, WHALE_SPRITE]);
    const imgUrls = [...PRELOAD_IMG].sort((a, b) => Number(critical.has(b)) - Number(critical.has(a)));
    const audUrls = [...PRELOAD_AUD];
    const total = imgUrls.length + audUrls.length + 1;
    let done = 0, nextImage = 0;
    const count = () => { done++; this.setProgress(done / total); };
    // Bound network/decode bursts and finish menu art before other early assets.
    const jobs = Array.from({ length: Math.min(4, imgUrls.length) }, async () => {
      while (nextImage < imgUrls.length) {
        const u = imgUrls[nextImage++];
        try {
          const img = await this.loadImage(u, 2, critical.has(u));
          if (u === TITLE_IMG) this.titleImg = img;
          if (u === WHALE_SPRITE) { this.whaleImg = img; this.whaleLoaded = true; }
          if (WHALE_SPRITES.includes(u)) this.whaleImgs.push(img);
        } catch (_) {} finally { count(); }
      }
    });
/* [/feature:menu-startup-workers] */
    /* BGM/音乐：与音效异步并行。
       ⚠️ 2026-09-25（玩家「加载界面 10 秒闪退」根因修复）——**只解码马上要播的主菜单那一首**：
       旧行为「加载界面把全部 BGM 解码好、永驻缓存」在桌面无感，在手机上就是内存自杀：
       5 首 BGM 解码后是 ~280MB 未压缩 PCM（实测，连语音共 289MB），
       移动端 WebView 撞内存上限 → 页面被系统杀掉（= 玩家报的闪退）。
       现在其余曲目只 `fetchBytes` 预取字节（整批 ~16MB），播放时按需解码
       （playBgm → predecode 兜底 + decoded LRU 上限 2 首，首播多等 0.5~2s，换不闪退）。
       （2026-09-16 的 12s 闸保留：老 iOS decodeAudioData 可能挂死，任何音频操作都不许拖住加载。） */
    const AUDIO_GATE_MS = 12000;
    const gate = (p) => Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, AUDIO_GATE_MS))]);
    const audioAll = Promise.all([
      ...audUrls.map((u) =>
        (u === MENU_BGM_URL
          ? AudioMgr.predecode(u)                       // 马上要播：解码
          : AudioMgr.fetchBytes(u).catch(() => {})      // 其余：只预取字节
        ).then(count).catch(() => count())
      ),
      sfxPromise.then(count).catch(() => count()),
    ]);
    jobs.push(gate(audioAll));

    await Promise.all(jobs);                  // 每项失败也兜底放行，不阻塞进游戏
    if (window.__B) window.__B.mark("menu:preloaded");
    // 恢复主菜单随机姿势显示：whaleImgs 已含全部候选姿势，随机选一作为菜单掉落主体
    if (this.whaleImgs.length) {
      const pose = this.whaleImgs[Math.floor(Math.random() * this.whaleImgs.length)];
      if (pose) this.whaleImg = pose;
      this.whaleLoaded = true;
    }
    const elapsed = performance.now() - start;
    if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));
    // 加载完成：停在加载页，等待用户点击一次后才进入等待主菜单（第二次点击再进主场景）
    this.armContinueTap();
  },

  /* 加载完成过渡：停在 loading，提示「点击开始」；首次点击 → 解锁音频并进入等待主菜单 */
  armContinueTap() {
    if (window.__B) window.__B.mark("menu:armTap");
    this._tapArmed = true;   // 之后 setProgress 只刷宽度，不再回写文字
    const txt = $menu("#load-text");
    if (txt) txt.textContent = "加载完成 · 点击开始";
    const go = () => {
      AudioMgr.unlock();   // 首次用户手势：解锁音频上下文，等待菜单即可出声
      // 延迟到下一拍再切换，确保本次点按事件完全结束，不误触发 menu
      setTimeout(() => this.showMenu(), 0);
    };
    /* 2026-09-24（iOS 三轮·真根因）：启动链此前只绑 pointerdown ——
       老 iOS（< Safari 13）根本没有 Pointer Events；B站 App 的 iOS WebView /
       跨域 iframe 里 pointerdown 派发也不可靠（WebKit 16.4 才修的缺陷）。
       这批设备上「加载完成 · 点击开始」永远点不动，观感即「卡在加载点了没反应」。
       补 touchstart / click 同源三通道（与 game_ui 20260916i 同款修法）：
       现代设备一次点按会连发 pointerdown+touchstart+click，go 最多跑 3 次 ——
       unlock 幂等、showMenu 有 _entered 幂等闸，双发无害。 */
    ["pointerdown", "touchstart", "click"].forEach((t) =>
      window.addEventListener(t, go, { once: true, capture: true })
    );
    /* 2026-10-03（用户拍板）：iOS 加载完**直接自动进入**，不等点按 —— 彻底避免卡死。
       依据：10-02 玩家截图实锤「ready:complete 0.3s 但触控 0 次」——armTap 挂上了，
       但 iOS 26/27 WebKit 在跨域 iframe 有触控派发回归（bugs.webkit.org 307737/318173），
       点按事件永远到不了 ⇒ 玩家卡在「点击开始」一动不动。
       与其等一个可能不来的手势，不如 0.8s 后直接 go()；音频解锁让位给主菜单的
       「首次点击任意处响起音乐」（unlock 无手势时静默失败，无害）。
       点按监听保留：玩家手快仍可提前进；go 双发由 showMenu._entered 幂等兜住。 */
    if (MENU_IS_IOS) {
      if (window.__B) window.__B.mark("menu:auto-enter");
      setTimeout(go, 800);
    }
  },

/* [feature:menu-critical-image-decode] */
  loadImage(src, retry = 2, decode = false) {
    return window.ImageResources.load(src, { retries: retry, decode });
  },

/* [/feature:menu-critical-image-decode] */

  setProgress(t) {
    const fill = $menu("#load-fill");
    if (fill) fill.style.width = Math.min(100, Math.round(t * 100)) + "%";
    /* 2026-09-24c（玩家截图实锤）：音频 12s 闸放行后，晚到的解码完成仍会 count() →
       setProgress 把「加载完成 · 点击开始」回写成「加载完成」，玩家以为点击没挂上。
       点按闸挂上后文字归 armContinueTap 所有，进度只刷宽度（顺带封顶 100%）。 */
    if (this._tapArmed) return;
    const txt = $menu("#load-text");
    if (txt) txt.textContent = t >= 1 ? "加载完成" : "加载中 " + Math.round(t * 100) + "%";
  },

  showMenu() {
/* [feature:menu-style-enter-gate] */
    if (window.BootHealth && !window.BootHealth.stylesReady()) return;
/* [/feature:menu-style-enter-gate] */
    /* 2026-09-16：幂等闸 —— 逃生通道（armStuckEscape）与正常「点击开始」可能在
       同一记点按上双双触发，先到先得；进主菜单时顺手摘掉逃生监听。 */
    if (this._entered) return;
    this._entered = true;
    if (window.__B) window.__B.mark("menu:showMenu");
    if (this._escapeH) {
      (this._escapeTypes || ["pointerdown"]).forEach((t) =>
        window.removeEventListener(t, this._escapeH, true)
      );
      this._escapeH = null;
      this._escapeTypes = null;
    }
    const ld = $menu("#loading");
    if (ld) { ld.style.opacity = "0"; setTimeout(() => ld.remove(), 520); }

    const m = $menu("#menu");
    m.hidden = false;

    this.canvas = $menu("#menu-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());

    this._time = 0;
    this.phase = "grow";
    this.growth = 0;
    this.spawnAcc = 0;
    this.spawnRate = 0.9;
    /* 2026-09-05（用户需求）：底图几何动起来——4 列蜡笔图形（三角/四边/X/O）
       沿「左下 → 右上」缓慢斜向飘动，按 tile 周期无缝循环铺满全屏。
       生成与烘焙统一在 resize() 里做（依赖画布尺寸）。 */
    for (let i = 0; i < 2; i++) this.spawnFall(true);   // 一开始 1-2 个
    // 标题：有标题图则替换文字（隐藏 h1，显示 img）
    this.applyTitle();
    this.animateTitle();              // 标题入场动画（duang 弹出）

    // 改为点击「开始游戏」按钮进入（不再全屏任意处）
    const startBtn = $menu("#menu-start");
    if (startBtn) {
      startBtn.addEventListener("pointerdown", () => this.onMenuDown());
      startBtn.addEventListener("click", () => this.onMenuDown());   // 兜底（自动化/辅助输入只有 click）
    }

    /* 制作组名单（2026-09-14）：正文来自配置 UI_CFG.credits —— **没配就整块不出现**
       （不摆一个点了没反应的按钮）。弹窗是菜单层自己的遮罩 + 办公区同款卡片。 */
    const creditsBtn = $menu("#menu-credits");
    if (creditsBtn) {
      if (this.creditsText()) {
        creditsBtn.hidden = false;
        creditsBtn.addEventListener("click", () => this.openCredits());
      } else {
        creditsBtn.hidden = true;
      }
    }
    /* 成就墙入口（2026-09-17）：**常驻显示，不判空** —— 与上面 credits 的口径**有意不同**：
       credits 空配置就没有入口，成就是开局本来就是空的，照抄那条 ⇒ 入口永远不出现。
       （正文为空时给空态提示，见 achvWallHtml()。这条背离必须留注释，否则会被"顺手修回去"。） */
    const achvBtn = $menu("#menu-achv");
    if (achvBtn) {
      achvBtn.hidden = false;
      achvBtn.addEventListener("click", () => this.openAchv());
    }
    /* 排行榜入口（2026-09-17）：同样**常驻显示** —— 未达成解锁条件时弹层里给「怎么解锁」
       的说明，而不是藏起入口让玩家不知道有这个玩法。
       弹层由 GameUI.openRank() 渲染（挂在 document.body 上），主菜单与局内**共用同一个实现**；
       它自带 Esc 与遮罩关闭，所以不进下面那张 credits/achv 的 Esc 表。 */
    const rankBtn = $menu("#menu-rank");
    if (rankBtn) {
      rankBtn.hidden = false;
      rankBtn.addEventListener("click", () => {
        if (window.GameUI && window.GameUI.openRank) window.GameUI.openRank();
      });
    }
    /* 选择存档入口（2026-09-22）：同样**常驻显示** —— 没有存档时弹层里给空态说明，
       藏起入口玩家根本不知道能直接读云存档。 */
    const loadBtn = $menu("#menu-load");
    if (loadBtn) {
      loadBtn.hidden = false;
      loadBtn.addEventListener("click", () => this.openLoad());
    }
    /* ⚠️ Esc 的判断必须**同时**看两个弹窗：原来只写 `this.creditsOpen`，
       加上成就墙之后会出现「成就弹窗开着、Esc 没反应」—— 测的人只会以为键盘坏了。 */
    for (const [boxSel, closeSel, openKey, closeFn] of [
      ["#credits-modal", "#credits-close", "creditsOpen", () => this.closeCredits()],
      ["#achv-modal", "#achv-close", "achvOpen", () => this.closeAchv()],
      ["#load-modal", "#load-close", "loadOpen", () => this.closeLoad()],
    ]) {
      const box = $menu(boxSel);
      if (!box) continue;
      const closeBtn = $menu(closeSel);
      if (closeBtn) closeBtn.addEventListener("click", closeFn);
      /* 点遮罩空白处关闭（点卡片内部不关） */
      box.addEventListener("click", (e) => { if (e.target === box) closeFn(); });
      window.addEventListener("keydown", (e) => {
        if (e.key !== "Escape" || !this[openKey]) return;
        /* 成就墙多一层「展开卡」：Esc 先收展开卡，再收弹窗（与办公区弹层的 Esc 优先级同款——
           直接关弹窗会让玩家以为"按一次跳过了两层"） */
        if (openKey === "achvOpen" && this._achvDetailOpen) { this.closeAchvDetail(); return; }
        closeFn();
      });
    }
    /* 展开卡浮层：点**任意处**关闭（含卡片本身）—— 手机上"随手点一下退回缩略图墙"比找关闭键自然，
       且浮层盖满整张弹窗 ⇒ 不会出现"点不到关闭键"的死角。
       ⚠️ 浮层是**静态节点**（index.html 里就有），绑一次即可，不必等 openAchv。 */
    const achvDetail = $menu("#achv-wall-detail");
    if (achvDetail) achvDetail.addEventListener("click", () => this.closeAchvDetail());

    /* 选择存档正文：每次重渲染（行内二次确认要原地换按钮）⇒ 走**事件委托**绑一次。
       ⚠️ 不能在 openLoad 里 addEventListener —— 每开一次就叠一层监听，
         第二次打开后点一下会跑两遍（表现为"点一次直接确认载入"）。 */
    const loadBody = $menu("#load-body");
    if (loadBody) {
      loadBody.addEventListener("click", (e) => {
  /* [feature:menu-load-pages-delegate-20261013] */
        const page = e.target.closest("[data-load-page]");
        if (page && !page.disabled) { this.loadGoto(Number(page.dataset.loadPage)); return; }
  /* [/feature:menu-load-pages-delegate-20261013] */
        /* [feature:cloud-menu-actions] */
        if (e.target.closest("[data-cloud-retry]")) { this.fetchLoadCloud(); return; }
        if (e.target.closest("[data-load-cancel]")) { this.cancelLoadChoice(); return; }
        /* [/feature:cloud-menu-actions] */
        const hit = e.target.closest("[data-load]");
        if (hit) { this.pickLoad(hit.getAttribute("data-load")); return; }
        const row = e.target.closest(".load-row");
        if (row) this.pickLoad(row.getAttribute("data-key"));
      });
    }

    document.addEventListener("visibilitychange", () => this.syncAnimation());
    this.syncAnimation();
    this.startMenuBgm();                                 // 音频若被策略挂起，首次点击会补启动
  },

  /* 标题图替换文字标题（无图则保留文字） */
  applyTitle() {
    const h1 = $menu(".menu-title");
    if (!h1) return;
    if (this.titleImg && this.titleImg.complete) {
      h1.innerHTML = '<img class="menu-title-img" src="' + TITLE_IMG + '" alt="鲸鱼娘养成计划">';
    }
  },

  /* 标题入场动画：duang 弹出（回弹几下） */
  animateTitle() {
    const t = $menu(".menu-title");
    if (!t) return;
    t.classList.remove("menu-title-in");
    void t.offsetWidth;               // 强制重排以重放动画
    t.classList.add("menu-title-in");
  },

  /* 底图几何图案（2026-09-05 用户需求三改）：恰 4 列——列0=三角形、列1=四边形、列2=X、列3=O，
     每列一种蜡笔色；笔刷质感粗描边（见 drawGeoShape）。
     整个阵列搭在 **45° 斜向晶格**上：列方向 = 运动方向 d（左下→右上），列间沿垂直方向 p 排开，
     图形自身也随阵列倾斜 45°——整体读感是「一列列斜着排的图形，沿斜向缓缓往上飘」。
     【三改：修「图形整体变大变小」】图形规格全部统一（同大小/同透明度/同角度，仅蜡笔毛边纹理
     保留手绘感）——原先 ±15% 的大小抖动 + 三档透明度在漂移时造成「忽大忽小」观感；
     渲染整数化：tile 周期取整并由它反推格点（晶格严格以整数周期重合，无接缝），
     烘焙位图与 drawImage 目标 1:1、绘制坐标取整——消除亚像素重采样导致的纹理游动发虚。 */
  GEO_TYPES: ["tri", "square", "x", "o"],
  GEO_COLORS: { tri: "#f48fb1", square: "#a5d6a7", x: "#b39ddb", o: "#81c7f0" },
  GEO_PERIOD: 7000,    // 沿斜向漂移一个格距的时长（ms）：约 20px/s，缓慢含蓄
  initGeoShapes() {
    this.geoShapes = [];
    const step = Math.max(96, Math.min(this.W, this.H) / 6.5);   // 格距：小屏密、大屏疏
    this.geoStep = step;
    const P = Math.max(340, Math.round(step * 4 * Math.SQRT2));  // 轴对齐平铺周期（整数！）
    this.geoTileW = P;
    this.geoTileH = P;
    /* 斜向晶格：格点直接由整数周期反推——x = s·P/8, y = t·P/8（s,t∈[0,8)，s+t 为偶）。
       相邻列向量 (P/8, P/8)、列方向 (P/8, -P/8) → 精确 45°；晶格严格以 P 重合 → 无接缝。 */
    for (let s = 0; s < 8; s++) {
      for (let t = 0; t < 8; t++) {
        if ((s + t) % 2 !== 0) continue;
        const i = (s + t) / 2, j = (s - t) / 2;
        const type = this.GEO_TYPES[((i % 4) + 4) % 4];          // 同列同形状（i = 列序号）
        let seed = (i * 131 + j * 61 + 7) % 233280;              // 确定性种子 → 蜡笔纹理稳定不闪
        this.geoShapes.push({
          type,
          x: s * P / 8,
          y: t * P / 8,
          size: step * 0.30,                                     // 统一大小（比格距小，留白透气）
          rot: -Math.PI / 4,                                     // 统一随阵列倾斜 45°
          color: this.GEO_COLORS[type],
          alpha: 0.30,                                           // 统一低透明度：背景细节，不抢主体
          seed,
        });
      }
    }
  },

  /* 预烘焙几何层（2026-09-05 用户需求：卡通两帧摇摆）——烘焙两帧 tile（+摆角 / -摆角），
     每 GEO_SWAY_MS 直接切换绘制源，无中间过渡（卡通逐帧表现的经典手法）。
     单帧烘焙：把一个 tile 周期画到离屏画布；贴边图形按 3×3 环绕补画，避免平铺接缝缺角。 */
  GEO_SWAY_MS: 700,                                // 摇摆切换间隔：每 0.7s 直接切一帧
  GEO_SWAY_ANGLE: 6 * Math.PI / 180,               // 摆角 ±6°（绕 -45° 基准角左右摆）
  bakeGeoLayer() {
    this.geoFrames = [this.bakeGeoFrame(this.GEO_SWAY_ANGLE), this.bakeGeoFrame(-this.GEO_SWAY_ANGLE)];
    this.geoLayer = this.geoFrames[0];
  },
  bakeGeoFrame(sway) {
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(this.geoTileW * this.dpr));
    off.height = Math.max(1, Math.round(this.geoTileH * this.dpr));
    const o = off.getContext("2d");
    if (!o) return null;
    o.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const g of this.geoShapes) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          o.save();
          o.translate(dx * this.geoTileW, dy * this.geoTileH);
          this.drawGeoShape(o, g, sway);
          o.restore();
        }
      }
    }
    return off;
  },

  /* 每帧：tile 原点沿 45° 方向 d=(√2/2, -√2/2) 平移（走一个格距即精确晶格平移，无缝），
     绘制坐标取整 —— drawImage 落在整像素上，无亚像素重采样（图形不会发虚/游动）。
     摇摆帧：按时间每 GEO_SWAY_MS 在两帧间直接切换（硬切，无过渡）。 */
  drawGeoLayer(c, now) {
    const frames = this.geoFrames;
    if (!frames || !frames[0]) return;
    const tile = frames[Math.floor(now / this.GEO_SWAY_MS) % frames.length] || frames[0];
    const tw = this.geoTileW, th = this.geoTileH;
    const s = ((now * this.geoStep) / this.GEO_PERIOD) % this.geoStep;   // 沿 d 的弧长（0~step 循环）
    const ox = Math.round(Math.SQRT1_2 * s), oy = Math.round(-Math.SQRT1_2 * s);   // 左下 → 右上（整像素）
    for (let x = ox - tw; x < this.W; x += tw) {
      for (let y = oy - th; y < this.H; y += th) {
        c.drawImage(tile, x, y, tw, th);
      }
    }
  },

  /* 画一个几何图案：镂空（不填充）+ 加粗边框 + 蜡笔质感。
     形状：tri 三角 / square 四边 / x 交叉两笔（开放线）/ o 圆环。
     蜡笔画法（参考 07 经验 §五.7 刮痕线）：
     - 每条边切随机短段，每段独立随机线宽/透明度/法向抖动，round 圆头
     - 两遍叠加：粗淡底笔 + 细亮顶笔 = 蜡笔体积感
     - 用确定性种子（s.seed）生成随机数 → 每帧纹理稳定不闪烁 */
  /* 蜡笔剖面（2026-09-05 用户反馈：线条应中间深两边浅）——
     抖动路径只生成一次、所有描边层共用（同轴无错位），再按「宽→窄、逐层低透明度」
     同心叠加：线心反复叠色变浓、边缘只被最宽那层轻轻盖到 → 笔心浓、向边缘羽化。 */
  GEO_STROKE_LAYERS: [
    { w: 13, a: 0.20 },   // 最外圈：只影响边缘，形成柔和羽化
    { w: 10, a: 0.24 },
    { w: 7, a: 0.28 },
    { w: 4.5, a: 0.34 },  // 线心：层层叠出最浓的笔锋
  ],
  drawGeoShape(ctx, s, sway) {
    // 确定性随机（种子固定 → 每帧画出的蜡笔纹理一致）
    let seed = s.seed;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    /* 同轴多层描边：drawPath() 在 ctx 上构建一次抖动后的路径，所有层共用 */
    const strokeLayers = (drawPath) => {
      for (const p of this.GEO_STROKE_LAYERS) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = p.w;
        ctx.globalAlpha = s.alpha * p.a;
        ctx.beginPath();
        drawPath();
        ctx.stroke();
      }
    };
    /* 蜡笔描一条折线（close=闭合）：低频抖动控制点 + 平滑贝塞尔连成整线（连续、无颗粒） */
    const crayonStroke = (poly, close) => {
      const last = close ? poly.length : poly.length - 1;
      strokeLayers(() => {
        for (let i = 0; i < last; i++) {
          const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
          const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len;
          // 每条边 2 个法向抖动控制点（低频手绘波动，不碎）
          const m1x = p1[0] + dx * 0.36 + nx * (rnd() - 0.5) * 3.2;
          const m1y = p1[1] + dy * 0.36 + ny * (rnd() - 0.5) * 3.2;
          const m2x = p1[0] + dx * 0.72 + nx * (rnd() - 0.5) * 3.2;
          const m2y = p1[1] + dy * 0.72 + ny * (rnd() - 0.5) * 3.2;
          ctx.moveTo(p1[0], p1[1]);
          ctx.quadraticCurveTo(m1x, m1y, (m1x + m2x) / 2, (m1y + m2y) / 2);
          ctx.quadraticCurveTo(m2x, m2y, p2[0], p2[1]);
        }
      });
    };
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate((s.rot || 0) + (sway || 0));   // 基准角(-45°) + 摇摆摆角（卡通两帧切换）
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = s.alpha;
    if (s.type === "x") {
      /* X：局部画横竖两笔（十字），随阵列倾斜 45° 后屏幕上呈对角交叉的「X」 */
      crayonStroke([[-s.size, 0], [s.size, 0]], false);
      crayonStroke([[0, -s.size], [0, s.size]], false);
    } else if (s.type === "o") {
      /* O：真平滑闭合曲线——抖动后的 8 个圆周点只作「控制点」，曲线实际经过的是各边中点，
         相邻段切线连续 → 完全无转折/珠串；半径低频抖动保留手绘圆的歪扭感 */
      const n = 8;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        const rr = s.size * (1 + (rnd() - 0.5) * 0.10);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      const mids = pts.map((p, k) => {
        const q = pts[(k + 1) % n];
        return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      });
      strokeLayers(() => {
        ctx.moveTo(mids[n - 1][0], mids[n - 1][1]);
        for (let k = 0; k < n; k++) ctx.quadraticCurveTo(pts[k][0], pts[k][1], mids[k][0], mids[k][1]);
      });
    } else {
      /* tri / square：过顶点画法，保留尖角特征 */
      const n = s.type === "tri" ? 3 : 4;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        pts.push([Math.cos(a) * s.size, Math.sin(a) * s.size]);
      }
      crayonStroke(pts, true);
    }
    ctx.restore();
  },

  /* 几何层静态（预烘焙后无需逐帧更新） */
  updateGeoShapes() {},

/* [feature:menu-composited-layers] */
  /* Full-screen software canvases invalidate the entire menu paint layer.
     Reuse the original DPR artwork/whale drawing on tightly bounded canvases;
     immutable geometry tiles move as independent cached compositor layers. */
  clearMenuLayers(restore = true) {
    const layers = this._menuLayers;
    if (!layers) return;
    this._menuLayers = null;
    layers.figures.forEach((view) => { view.canvas.width = view.canvas.height = 1; });
    layers.figures.clear();
    layers.geos.forEach((node) => { node.style.backgroundImage = ""; });
    layers.host.remove();
    this.canvas.style.visibility = layers.originalVisibility;
    if (restore) {
      this.canvas.width = Math.round(this.W * this.dpr);
      this.canvas.height = Math.round(this.H * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  },

  prepareMenuLayers() {
    this.clearMenuLayers();
    if (!this.canvas.parentNode || !this.geoFrames || !this.geoFrames.length) return false;
    try {
      const urls = this.geoFrames.map((frame) => frame && frame.toDataURL());
      if (urls.some((url) => typeof url !== "string" || !url.startsWith("data:image/"))) return false;
      const host = document.createElement("div");
      host.className = "menu-animation-layers";
      host.setAttribute("aria-hidden", "true");
      host.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1;";
      // Only overscan the actual positive-X/negative-Y travel, not whole tiles.
      const pad = Math.ceil((Math.ceil(this.geoStep * Math.SQRT1_2) + 1) * this.dpr) / this.dpr;
      const geos = urls.map((url, i) => {
        const node = document.createElement("div");
        node.style.cssText = "position:absolute;left:-" + pad + "px;top:0;right:0;bottom:-" + pad
          + "px;pointer-events:none;will-change:transform;background-repeat:repeat;";
        node.style.backgroundSize = this.geoTileW + "px " + this.geoTileH + "px";
        node.style.backgroundPosition = pad + "px 0px";
        node.style.backgroundImage = 'url("' + url + '")';
        node.hidden = i !== 0;
        host.appendChild(node); return node;
      });
      this.canvas.parentNode.insertBefore(host, this.canvas);
      this._menuLayers = { host, geos, figures: new Map(), phase: -1, origin: "", frames: 0,
        originalVisibility: this.canvas.style.visibility };
      this.canvas.style.visibility = "hidden";
      this.canvas.width = this.canvas.height = 1; // unused full-screen backing need not stay resident
      return true;
    } catch (_) { this.clearMenuLayers(); return false; } // older canvas engines retain the original path
  },

  renderMenuLayers(now) {
    const layers = this._menuLayers;
    if (!layers) return false;
    const phase = Math.floor(now / this.GEO_SWAY_MS) % layers.geos.length;
    const s = ((now * this.geoStep) / this.GEO_PERIOD) % this.geoStep;
    const ox = Math.round(Math.SQRT1_2 * s), oy = Math.round(-Math.SQRT1_2 * s);
    if (layers.phase !== phase) { layers.geos.forEach((node, i) => { node.hidden = i !== phase; }); layers.phase = phase; }
    const origin = ox + "," + oy;
    if (layers.origin !== origin) { layers.geos.forEach((node) => { node.style.transform = "translate3d(" + ox + "px," + oy + "px,0)"; }); layers.origin = origin; }
    const alive = new Set();
    for (const f of this.fallers) {
      alive.add(f);
      let view = layers.figures.get(f);
      if (!view) {
        // Image corners and the ellipse ending at .54*height fit at every angle.
        const radius = Math.hypot(this.spriteW(f) / 2, this.spriteH(f) * .54) + 3;
        const edge = Math.ceil(radius) * 2, canvas = document.createElement("canvas");
        canvas.width = canvas.height = Math.round(edge * this.dpr);
        const cssEdge = canvas.width / this.dpr;
        canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;will-change:transform;width:" + cssEdge + "px;height:" + cssEdge + "px;";
        const ctx = canvas.getContext("2d");
        if (!ctx) { this.clearMenuLayers(); return false; }
        layers.host.appendChild(canvas); view = { canvas, ctx, edge }; layers.figures.set(f, view);
      }
      // Integral device-pixel origins preserve the original canvas sample grid.
      const px = Math.floor((f.x - view.edge / 2) * this.dpr), py = Math.floor((f.y - view.edge / 2) * this.dpr);
      view.canvas.style.transform = "translate3d(" + px / this.dpr + "px," + py / this.dpr + "px,0)";
      view.ctx.setTransform(1, 0, 0, 1, 0, 0);
      view.ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
      view.ctx.setTransform(this.dpr, 0, 0, this.dpr, -px, -py);
      this.drawWhale(view.ctx, f);
    }
    for (const [f, view] of layers.figures) if (!alive.has(f)) {
      view.canvas.remove(); view.canvas.width = view.canvas.height = 1; layers.figures.delete(f);
    }
    layers.frames++;
    return true;
  },

  releaseMenuArt() {
    this.clearMenuLayers(false);
    this.geoFrames = this.geoLayer = null;
    this.fallers.length = this.whaleImgs.length = 0;
    this.whaleImg = this.titleImg = null;
  },

  resize() {
    if (this.started) return;
    this.W = this.canvas.clientWidth || window.innerWidth;
    this.H = this.canvas.clientHeight || window.innerHeight;
    // DPR 封顶 2：手机高 DPR 全屏画布渲染面积成本陡增且不可见，2x 观感几乎无差
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.computeMaxFallers();
    // 尺寸变化 → 重新生成 tile 网格并烘焙（几何铺满需适配新画布；无条件：初始也由此激活）
    this.initGeoShapes();
    this.bakeGeoLayer();
    this.prepareMenuLayers();
  },

/* [/feature:menu-composited-layers] */

  computeMaxFallers() {
    // 按"圆堆叠"实际能填满一屏的量估算：层数(H/层高) × 列数(W/列宽)
    // 层高≈66px（圆碰撞 r*0.86），列宽≈71px（纸片人平均宽）
    const rowH = 66, colW = 71;
    this.maxFallers = Math.min(120, Math.max(14, Math.floor((this.H / rowH) * (this.W / colW))));
  },

  /* ---------------- 音频 ---------------- */
  /* ---------------- 制作组名单（主界面二级弹窗，2026-09-14）----------------
     正文 = 配置 `UI_CFG.credits`（UI 配置页可改，整区保存）。
     读的是**游戏实装的那一份**：resolveAssets 启动时已经把 /data/game_cfg.json 取回来了（EXT_CFG），
     没有外部配置时回落出厂的 window.GameCfg.UI_CFG.credits。空 = 主界面不显示入口。 */
  creditsText() {
    const pick = (o) => (o && o.UI_CFG && typeof o.UI_CFG.credits === "string") ? o.UI_CFG.credits : "";
    return (pick(EXT_CFG) || pick(window.GameCfg) || "").trim();
  },

  /* 配置里的文案是纯文本（可能带换行），进 innerHTML 前必须转义 —— 防配置里写进标签 */
  escHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },

  /* [feature:menu-credits-readable-pages-helper] */
  mountCreditsPages(box, body) {
    this.disposeCreditsPages();
    const ui = window.GameUI, card = box.querySelector('.credits-card'), text = body.querySelector('.credits-text');
    if (!ui || !ui.readNodePages || !card || !text) return;
    const lines = text.textContent.split(/\r?\n/);
    text.textContent = '';
    const nodes = lines.map(line => {
      const p = document.createElement('p'); p.className = 'credits-line'; p.textContent = line;
      text.appendChild(p); return p;
    });
    const footer = document.createElement('div'); footer.className = 'credits-footer'; card.appendChild(footer);
    card.classList.add('credits-paged');
    const run = ui.readNodePages(body, footer, [{label:'制作组名单',parents:[text],units:nodes.map(n=>[n])}], 0);
    const layout = run.layout;
    run.layout = () => {
      if (run.closed || !this.creditsOpen || !box.isConnected) return;
      nodes.forEach(n=>n.hidden=false); text.hidden=false; card.style.height='';
      const bs=window.getComputedStyle(box), cs=window.getComputedStyle(card), header=card.querySelector('.modal-header');
      const outer=Math.max(120,(box.clientHeight || window.innerHeight)-parseFloat(bs.paddingTop || 0)-parseFloat(bs.paddingBottom || 0)-24);
      const natural=(header ? header.offsetHeight : 0)+body.scrollHeight+footer.offsetHeight+parseFloat(cs.borderTopWidth || 0)+parseFloat(cs.borderBottomWidth || 0);
      card.style.height=Math.min(outer,Math.max(120,natural))+'px';
      layout();run.views.forEach(v=>v.label='制作组名单');run.show(run.page);
    };
    const dispose=run.dispose;run.dispose=()=>{dispose();footer.remove();card.classList.remove('credits-paged');card.style.height='';};
    this._creditsPages=run;run.layout();
    if(document.fonts && document.fonts.ready)document.fonts.ready.then(()=>{if(this._creditsPages===run&&!run.closed)run.layout();});
  },
  disposeCreditsPages() {
    if(this._creditsPages)this._creditsPages.dispose();
    this._creditsPages=null;
  },
  /* [/feature:menu-credits-readable-pages-helper] */
  openCredits() {
    const box = $menu("#credits-modal");
    const body = $menu("#credits-body");
    if (!box || !body) return;
    const txt = this.creditsText();
    if (!txt) return;                          // 没配 → 不弹（入口本身也已隐藏）
    body.innerHTML = '<div class="credits-text">' + this.escHtml(txt) + "</div>";
    box.hidden = false;
    /* 卡片入场动画重放：元素一直在 DOM 里，光切 hidden 不会重播（与 animateTitle 同款做法） */
    const card = box.querySelector(".credits-card");
    if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
    this.creditsOpen = true;
    /* [feature:menu-credits-readable-pages-open] */
    this.mountCreditsPages(box, body);
    /* [/feature:menu-credits-readable-pages-open] */
    this.syncAnimation();
  },

  closeCredits() {
    const box = $menu("#credits-modal");
    if (!box) return;
    /* [feature:menu-credits-readable-pages-close] */
    this.disposeCreditsPages();
    /* [/feature:menu-credits-readable-pages-close] */
    box.hidden = true;
    this.creditsOpen = false;
    this.syncAnimation();
  },

  /* [feature:menu-achievement-pagination] */
  /* ---------------- 成就墙（主界面二级弹窗，2026-09-17）----------------
     数据源 = `AchieveStore.view(ACHIEVEMENTS)`。它**已经做过脱敏**：
     未解锁的隐藏成就只给 `{key, rarity, locked}`，名字与描述根本不发到前端
     ⇒ 这里不需要再判一次隐藏，照着渲染就行（别自己再写一套判断，会与存储层口径漂移）。
     ⚠️ 与第四幕的三条差异（故意的，别再"统一"回去）：
       ① **不生成辉光/环/粒子** —— 36 张卡同时 blur/呼吸 = 灾难；墙上用 compact 版（本来就没装饰）。
       ② 按实际窗口分页，全部卡片经上一页/下一页可达，无需滚动。
       ③ 卡比结算页小一档（墙上 5 列），名字/描述都收到 9.5~12px。 */
  achvCfgList() {
    const pick = (o) => (o && Array.isArray(o.ACHIEVEMENTS)) ? o.ACHIEVEMENTS : null;
    return pick(EXT_CFG) || pick(window.GameCfg) || [];
  },

  /* 缩略图模式判定（2026-09-22 用户：「手机竖屏横屏下的成就页面改成缩略图（只显示 icon 和标题），
     然后点击可以展开卡片」）。
     ⚠️ 判定**只此一处** —— CSS 不另写一套"是不是手机"的媒体查询，只认这里挂的 `.is-thumb` 类。
        两边各写一套的后果是「显示成缩略图却点不开」（媒体查询命中、类没挂上）。
     ⚠️ 口径 = **短边 ≤ 560**（不是 orientation）。
        第一版用的是 `matchMedia("(orientation: portrait)")`，真机没生效（用户复报「一行还是 3 个」）
        —— 而 CSS 那边 `@media (orientation: portrait)` 的 3 列**生效了**，两边对同一个方向给出
        相反答案。orientation 在 iframe / 缩放容器 / 各家 webview 里的口径并不一致（Toy 预览页
        正是把游戏套在 iframe 里），继续依赖它就是把"手机上到底几列"交给玄学。
        短边是**实际可用空间**，量出来的东西不需要解释：
          · 手机竖屏 390×844 → 390 ✓   · 手机横屏 844×390 → 390 ✓
          · 桌面 1366×768 → 768 ✗       · 平板竖屏 768×1024 → 768 ✗（有位置摆大卡）
     旋转屏幕不重渲染：类留在 DOM 上，列数由 CSS 的 auto-fill 自适应（见 style.css）。 */
  achvThumbMode() {
    const w = window.innerWidth || 0, h = window.innerHeight || 0;
    if (!w || !h) return false;
    return Math.min(w, h) <= 560;
  },

  achvPageShape(hasEmpty, hasWarning) {
    const w = window.innerWidth || 960, h = window.innerHeight || 768;
    const portrait = h >= w, thumb = this.achvThumbMode();
    const width = Math.min(w * (portrait ? .96 : .94), 960) - (portrait ? 24 : 36);
    const columns = thumb ? Math.max(1, Math.min(8, Math.floor((width + 8) / 92))) : portrait ? 3 : 5;
    const rowHeight = thumb ? 102 : (width - (columns - 1) * 10) / columns * 1.4;
    const available = Math.min(h * (portrait ? .9 : .88), 672) - 52 - 32 - 28 - 44 - (hasEmpty ? 60 : 0) - (hasWarning ? 76 : 0);
    const rows = Math.max(1, Math.floor((available + 8) / (rowHeight + 8)));
    return { columns, size: columns * rows };
  },

  achvWallHtml() {
    const UI = window.GameUI;
    const store = window.AchieveStore;
    const cfgList = this.achvCfgList();
    if (!store || !UI || !UI.achvCardHtml) {
      return '<div class="achv-wall-tip">成就系统未就绪（存储或渲染模块没加载？）。</div>';
    }
    if (!cfgList.length) return '<div class="achv-wall-tip">暂无成就配置。</div>';
    const view = store.view(cfgList);
    const st = store.stats(cfgList);
    /* 排序：**已解锁在前（按解锁时间倒序）**，未解锁按配置顺序跟在后面。
       玩家点进来最想看的是"我刚拿到什么"，其次才是"还差什么"。 */
    const got = view.filter((x) => !x.locked).sort((a, b) => (b.t || 0) - (a.t || 0));
    const locked = view.filter((x) => x.locked);
    const list = got.concat(locked);
    /* 展开浮层按 key 回查用（脱敏已由存储层做过，这里不重复判隐藏） */
    this._achvView = list;
    const empty = st.got === 0
      ? '<div class="achv-wall-tip">还没有解锁任何成就。回办公室，把模型做出来。</div>'
      : "";
    /* localStorage 不可用（无痕/被禁）时说实话：成就只在本次会话内有效 */
    const warn = store.persistent() ? ""
      : '<div class="achv-wall-tip warn">当前浏览器不允许本地存储（无痕模式？），本次会话的成就在关掉页面后会丢失。</div>';
    const shape = this.achvPageShape(!!empty, !!warn);
    const pages = Math.max(1, Math.ceil(list.length / shape.size));
    this._achvPage = Math.max(0, Math.min(pages - 1, this._achvPage || 0));
    this._achvPages = pages;
    const cards = list.slice(this._achvPage * shape.size, (this._achvPage + 1) * shape.size)
      .map((v) => UI.achvCardHtml(v, true, { locked: v.locked })).join("");
    /* ⚠️ 缩略图模式只是**加一个类**，卡片 HTML 完全不变（compact 版照旧）——
       CSS 把 .achv-vd/.achv-desc/.achv-meta 收起来，只留 icon + 标题。 */
    const thumb = this.achvThumbMode() ? " is-thumb" : "";
    return '<div class="achv-wall-stats">已解锁 <b>' + st.got + '</b> / ' + st.total + '</div>'
      + empty + warn
      + '<div class="achv-wall' + thumb + '" style="--achv-page-cols:' + shape.columns + '">' + cards + '</div>'
      + '<nav class="achv-wall-pager" aria-label="成就分页"><button type="button" class="dg-btn dg-btn-sm" data-achv-page="-1"' + (this._achvPage === 0 ? ' disabled' : '') + '>上一页</button><span aria-live="polite">' + (this._achvPage + 1) + ' / ' + pages + '</span><button type="button" class="dg-btn dg-btn-sm" data-achv-page="1"' + (this._achvPage === pages - 1 ? ' disabled' : '') + '>下一页</button></nav>';
  },

  /* 缩略图 → 完整成就卡（只给缩略图模式绑：桌面本来就看全卡，再点开一张重复的没意义） */
  bindAchvTiles() {
    const body = $menu("#achv-wall-body");
    const wall = body && body.querySelector(".achv-wall.is-thumb");
    if (body) body.querySelectorAll('[data-achv-page]').forEach(n => n.addEventListener('click', () => this.achvGoto(Number(n.dataset.achvPage))));
    if (wall) wall.querySelectorAll(".achv-wrap").forEach((n) => {
      n.addEventListener("click", () => this.openAchvDetail(n.getAttribute("data-key")));
    });
  },

  achvGoto(delta) {
    if (!this.achvOpen || !Number.isInteger(delta)) return;
    this._achvPage = Math.max(0, Math.min((this._achvPages || 1) - 1, (this._achvPage || 0) + delta));
    this.closeAchvDetail();
    const body = $menu('#achv-wall-body');
    if (!body) return;
    body.innerHTML = this.achvWallHtml();
    this.bindAchvTiles();
  },

  /* 展开：把 view() 里那一条交给 achvCardHtml 的**非 compact** 版（辉光/环/粒子都在 ——
     与第四幕弹卡同一份实现）。别再写一套"展开卡"的 HTML，改一处漏一处。 */
  openAchvDetail(key) {
    const v = (this._achvView || []).find((x) => x.key === key);
    const box = $menu("#achv-wall-detail");
    const UI = window.GameUI;
    if (!v || !box || !UI || !UI.achvCardHtml) return;
    box.innerHTML = UI.achvCardHtml(v, false, { locked: v.locked });
    box.hidden = false;
    this._achvDetailOpen = true;
  },

  closeAchvDetail() {
    const box = $menu("#achv-wall-detail");
    if (!box) return;
    box.hidden = true;
    box.innerHTML = "";              // 连装饰层一起清掉：留着下次会接着上一帧的动画状态播
    this._achvDetailOpen = false;
  },

  openAchv() {
    const box = $menu("#achv-modal");
    const body = $menu("#achv-wall-body");
    if (!box || !body) return;
    this._achvPage = 0;
    body.innerHTML = this.achvWallHtml();       // 每次打开都重渲染（跨局解锁的在这次会话里也可能变）
    body.scrollTop = 0;
    this.closeAchvDetail();                     // 上次关弹窗时留下的展开层不能还亮着
    this.bindAchvTiles();
    box.hidden = false;
    /* 卡片入场动画重放：元素一直在 DOM 里，光切 hidden 不会重播（与 openCredits 同款做法） */
    const card = box.querySelector(".modal-card");
    if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
    this.achvOpen = true;
    if (!this._achvResizeBound) {
      this._achvResizeBound = true;
      window.addEventListener('resize', () => { if (this.achvOpen) this.achvGoto(0); });
    }
    this.syncAnimation();
  },

  closeAchv() {
    const box = $menu("#achv-modal");
    if (!box) return;
    this.closeAchvDetail();
    box.hidden = true;
    this.achvOpen = false;
    this.syncAnimation();
  },
  /* [/feature:menu-achievement-pagination] */

  /* ---------------- 选择存档（主界面二级弹窗，2026-09-22）----------------
     用户：「开始游戏按钮下方加一个选择存档的按钮，让玩家可以选择直接加载云存档」。
     以前云存档只能「先进游戏 → 打开存档弹窗 → 从云端恢复」，藏得太深；
     这里在进游戏**之前**就把云存档 + 本机各槽位摆出来，选一个直接进。

     ⚠️ 载入口径与 GameUI.applyCloudRestore **完全一致**：把选中的快照写进
        「自动存档槽」→ startGame()，由 GameUI.launch() 读 auto 槽恢复。
        **不另写第二条恢复路径** —— 两条必然漂移（这是本项目踩过的老坑）。
     ⚠️ 覆盖前必须二次确认：覆盖的是本机自动存档，误触代价是玩家当前进度。
        确认做成**行内展开**（.load-row.is-pending），不另叠一层遮罩 —— 手机上很容易点错层。
     ⚠️ 正文每次重渲染（行内确认要原地换按钮）⇒ 事件走**委托**绑一次，
        绝不能在 openLoad 里 addEventListener（重复打开会叠监听）。 */
  /* [feature:cloud-menu-status] */
  loadCloudHtml() {
    const st = this._loadCloud || { state: "loading" };
    const retry = st.state !== "loading" && st.state !== "unsupported"
      ? ' <button class="load-btn is-ghost" type="button" data-cloud-retry="1">重新读取</button>' : "";
    const head = '<div class="load-group">云端存档' + retry + '</div>';
    /* [feature:cloud-menu-sdk-status-message] */
    if (st.state === "sdk-loading") return head + '<div class="load-tip">云服务正在加载，请稍后重试。</div>';
    if (st.state === "sdk-failed") return head + '<div class="load-tip warn">云服务加载失败，可使用本地存档继续。</div>';
    /* [/feature:cloud-menu-sdk-status-message] */
    if (st.state === "loading") return head + '<div class="load-tip">正在读取云端存档…</div>';
    if (st.state === "unsupported") {
      return head + '<div class="load-tip">当前环境不支持云存档（不在 B站 Toy 平台内运行时没有云端）。</div>';
    }
    if (st.state === "none") return head + '<div class="load-tip">云端还没有存档。进游戏后进度会自动同步到云端。</div>';
    if (st.state === "broken" || st.state === "error") {
      const tc = window.ToyCloud;
      const reason = st.reason || (st.state === "broken" ? "invalid-state" : "error");
      const message = tc && tc.errorMessage ? tc.errorMessage(reason, st.code) : "云端读取失败，请稍后再试。";
      return head + '<div class="load-tip warn">' + this.escHtml(message) + '</div>';
    }
    return head + this.loadRowHtml("cloud", "云端", st.snap, true);
  },
  /* [/feature:cloud-menu-status] */

  /* 单行存档卡。key 是回查用的稳定标识（auto / slot_N / stage / cloud） */
  loadRowHtml(key, badge, d, isCloud) {
    this._loadRows.push({ key: key, snap: d });
    const fresh = key.indexOf("empty_") === 0;
    if (fresh) {
      const text = window.GameCfg.UI_CFG.NEW_SAVE_SLOT, pending = this._loadPending === key;
      const tail = pending ? '<span class="load-ask">' + this.escHtml(text.ASK) + '</span>'
        + '<button class="load-btn is-danger" type="button" data-load="' + key + '">' + this.escHtml(text.CONFIRM) + '</button>'
        + '<button class="load-btn is-ghost" type="button" data-load-cancel="1">' + this.escHtml(text.CANCEL) + '</button>'
        : '<button class="load-btn" type="button" data-load="' + key + '">' + this.escHtml(text.NEW) + '</button>';
      return '<div class="load-row is-empty' + (pending ? ' is-pending' : '') + '" data-key="' + key + '">'
        + '<span class="load-badge">' + this.escHtml(badge) + '</span><div class="load-main"><div class="load-name">' + this.escHtml(text.EMPTY_TITLE)
        + '</div><div class="load-sub">' + this.escHtml(text.EMPTY_DESC) + '</div></div><div class="load-tail">' + tail + '</div></div>';
    }
    const st = (d && d.state) || {};
    const m = (d && d.meta) || {};
    const ver = m.ver || st.ver || "V1";
    const week = (m.week != null ? m.week : st.week) || 0;
    const param = m.paramLabel || (st.paramTarget ? st.paramTarget + "B" : "未定");
    /* 快照自带的 name 已经是「V3 · 第 24 周 · 70B · 08-12 14:30」（buildSnapshot 生成），
       直接用它 —— 自己再拼一套口径必然会与存档列表漂移。 */
    const title = (d && d.name) || (ver + " · 第 " + week + " 周 · " + param);
    const bits = [];
    if (m.funding != null) bits.push("经费 " + Math.round(m.funding / 10000) + " 万");
    if (m.brand != null) bits.push("品牌 " + m.brand);
    const pending = this._loadPending === key;
    const tail = pending
      ? '<span class="load-ask">覆盖本机自动存档并进入？</span>'
        + '<button class="load-btn is-danger" type="button" data-load="' + key + '">确认载入</button>'
        + '<button class="load-btn is-ghost" type="button" data-load-cancel="1">取消</button>'
      : '<button class="load-btn" type="button" data-load="' + key + '">载入</button>';
    return '<div class="load-row' + (isCloud ? " is-cloud" : "") + (pending ? " is-pending" : "")
      + '" data-key="' + key + '">'
      + '<span class="load-badge">' + this.escHtml(badge) + "</span>"
      + '<div class="load-main"><div class="load-name">' + this.escHtml(title) + "</div>"
      + '<div class="load-sub">' + this.escHtml(bits.join(" · ")) + "</div></div>"
      + '<div class="load-tail">' + tail + "</div>"
      + "</div>";
  },

  loadListHtml() {
    this._loadRows = [];                 // 每次渲染重建：confirmLoad 靠它回查快照
    const parts = [this.loadCloudHtml()];
    const locals = [];
    const save = window.GameSave;
    if (save) {
      const auto = save.load("auto");
      if (auto) locals.push(this.loadRowHtml("auto", "自动", auto));
      for (let i = 0; i < save.MAX_SLOTS; i++) {
        const d = save.load(i);
        if (d) locals.push(this.loadRowHtml("slot_" + i, "槽位 " + (i + 1), d));
        else if (window.GameCfg?.UI_CFG?.NEW_SAVE_SLOT) locals.push(this.loadRowHtml("empty_" + i, "槽位 " + (i + 1), null));
      }
      /* 阶段锚点（本阶段开头）也摆出来：局内存档弹窗里本来就能读它，菜单层漏掉就成"少一档"。
         它是崩溃兜底用的快照，但对玩家来说就是"本阶段开头那个进度"。 */
      const anchor = save.loadStage ? save.loadStage() : null;
      if (anchor) locals.push(this.loadRowHtml("stage", "锚点", anchor));
    }
    if (locals.length) parts.push('<div class="load-group">本机存档</div>', locals.join(""));
    else parts.push('<div class="load-tip">本机还没有存档。点「开始游戏」开一局，进度会自动保存。</div>');
    if (this._loadError) parts.push('<div class="load-tip warn">' + this.escHtml(this._loadError) + "</div>");
    parts.push('<div class="load-note">载入会用所选存档覆盖本机的自动存档进度，并立即进入该进度。'
      + "手动槽位与云端存档都不会被删除。</div>");
    return parts.join("");
  },

  /* [feature:menu-load-pages-methods-20261013] */
  disposeLoadPages() {
    if (this._loadPages) this._loadPages.dispose();
    this._loadPages = null;
  },
  loadGoto(delta) {
    const p = this._loadPages;
    if (!p || !Number.isInteger(delta)) return;
    p.show((this._loadPage || 0) + delta);
  },
  layoutLoadPages(body) {
    const box = $menu('#load-modal'), card = box && box.querySelector('.load-card');
    if (!body || body.nodeType !== 1 || !card || box.hidden) return;
    const originals = Array.from(body.children), units = [];
    const mask = document.createElement('div'), footer = document.createElement('footer');
    mask.className = 'load-pages-mask'; footer.className = 'load-pages-footer';
    const note = originals.find(n => n.classList.contains('load-note'));
    if (note) footer.appendChild(note);
    for (let i = 0; i < originals.length; i++) {
      const n = originals[i]; if (n === note) continue;
      const unit = document.createElement('div'); unit.className = 'load-page-unit';
      unit.appendChild(n);
      if (n.classList.contains('load-group') && originals[i + 1] && originals[i + 1] !== note) unit.appendChild(originals[++i]);
      units.push(unit);
    }
    const nav = document.createElement('nav'); nav.className = 'load-pages-nav';
    nav.setAttribute('aria-label', '存档分页');
    nav.innerHTML = '<button type="button" class="load-btn is-ghost" data-load-page="-1">上一页</button><span aria-live="polite"></span><button type="button" class="load-btn is-ghost" data-load-page="1">下一页</button>';
    footer.appendChild(nav); body.textContent = ''; body.classList.add('load-paged-body');
    body.appendChild(mask); body.appendChild(footer);
    const oldHeight = card.style.height, cs = getComputedStyle(card), bs = getComputedStyle(body);
    const maxHeight = parseFloat(cs.maxHeight), vh = window.innerHeight || document.documentElement.clientHeight || 568;
    card.style.height = Math.max(1, Math.min(vh - 16, Number.isFinite(maxHeight) ? maxHeight : vh - 16)) + 'px';
    const padding = (parseFloat(bs.paddingTop) || 0) + (parseFloat(bs.paddingBottom) || 0);
    const gap = parseFloat(bs.rowGap) || parseFloat(bs.gap) || 0;
    const budget = Math.max(1, body.clientHeight - padding - footer.offsetHeight - gap);
    const probe = document.createElement('div'); probe.className = 'load-pages-measure';
    probe.setAttribute('aria-hidden', 'true'); probe.style.width = mask.clientWidth + 'px';
    body.appendChild(probe);
    const heights = [], rows = this._loadRows, pending = this._loadPending;
    try {
      units.forEach(unit => {
        probe.appendChild(unit); let height = unit.offsetHeight;
        unit.querySelectorAll('.load-row').forEach(row => {
          const item = rows.find(r => r.key === row.dataset.key); if (!item) return;
          // Measure the original confirm renderer without changing the complete snapshot lookup.
          this._loadRows = []; this._loadPending = item.key;
          const test = document.createElement('div'); test.className = 'load-row-measure';
          test.innerHTML = this.loadRowHtml(item.key, row.querySelector('.load-badge').textContent, item.snap, row.classList.contains('is-cloud'));
          probe.appendChild(test); height += Math.max(0, test.firstElementChild.offsetHeight - row.offsetHeight); test.remove();
        });
        heights.push(height); unit.remove();
      });
    } finally { this._loadRows = rows; this._loadPending = pending; probe.remove(); }
    const pages = []; let page, used = 0, maxPageHeight = 0, oversized = false;
    units.forEach((unit, i) => {
      const height = heights[i], next = used + (used ? gap : 0) + height;
      if (!page || (used && next > budget + .5)) {
        page = document.createElement('section'); page.className = 'load-page';
        pages.push(page); mask.appendChild(page); used = 0;
      }
      used += (used ? gap : 0) + height; page.appendChild(unit);
      maxPageHeight = Math.max(maxPageHeight, used); if (height > budget + .5) oversized = true;
    });
    if (!pages.length) { page = document.createElement('section'); page.className = 'load-page'; pages.push(page); mask.appendChild(page); }
    mask.style.height = Math.min(budget, maxPageHeight) + 'px'; card.style.height = oldHeight;
    nav.hidden = pages.length <= 1;
    let frame = 0, disposed = false;
    const show = value => {
      if (disposed) return;
      const index = Math.max(0, Math.min(pages.length - 1, Number.isInteger(value) ? value : 0));
      this._loadPage = index; this._loadPageCount = pages.length;
      pages.forEach((part, i) => { part.hidden = i !== index; });
      nav.querySelector('[data-load-page="-1"]').disabled = index === 0;
      nav.querySelector('[data-load-page="1"]').disabled = index === pages.length - 1;
      nav.querySelector('span').textContent = (index + 1) + ' / ' + pages.length;
    };
    const resize = () => {
      if (disposed || !this.loadOpen || box.hidden) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { frame = 0; if (!disposed && this.loadOpen && !box.hidden) this.renderLoadBody(); });
    };
    const dispose = () => { if (disposed) return; disposed = true; window.removeEventListener('resize', resize); if (frame) cancelAnimationFrame(frame); frame = 0; };
    this._loadPages = { pages, mask, footer, budget, oversized, show, dispose };
    show(this._loadPage || 0); window.addEventListener('resize', resize);
  },
  /* [/feature:menu-load-pages-methods-20261013] */
  /* [feature:menu-load-pages-render-20261013] */
  renderLoadBody() {
    const body = $menu("#load-body");
    if (!body) return;
    this.disposeLoadPages();
    body.innerHTML = this.loadListHtml();
    this.layoutLoadPages(body);
    body.scrollTop = 0;
  },
  /* [/feature:menu-load-pages-render-20261013] */

  /* [feature:cloud-menu-read] */
  /* 恢复锁跨读取与确认持有，避免页面隐藏时把旧进度自动上传。 */
  holdLoadCloud() {
    if (this._loadRestoreCloud) return;
    const tc = window.ToyCloud;
    if (tc && tc.beginRestore) { tc.beginRestore(); this._loadRestoreCloud = tc; }
  },

  releaseLoadCloud() {
    const tc = this._loadRestoreCloud;
    this._loadRestoreCloud = null;
    if (tc && tc.endRestore) tc.endRestore();
  },

  cancelLoadChoice() {
    this._loadChoiceRevision = (this._loadChoiceRevision || 0) + 1;
    this._loadPending = null;
    if (!this._loadFetchBusy) this.releaseLoadCloud();
    this.renderLoadBody();
  },

  /* token 防串台；同一面板重复点击只复用进行中的读取。 */
  fetchLoadCloud() {
    if (this._loadFetchBusy || !this.loadOpen) return;
    const tc = window.ToyCloud;
    const tok = (this._loadToken || 0) + 1;
    this._loadToken = tok;
    this._loadPending = null;
    this._loadCloud = { state: "loading" };
    if (!tc || !tc.available()) {
      this.releaseLoadCloud();
      /* [feature:cloud-menu-sdk-status-select] */
      this._loadCloud = { state: "unsupported" };
      const health = window.BootHealth;
      let platform = false;
      try { platform = !!window.parent && window.parent !== window; } catch (e) { platform = true; }
      const toyId = Number((window.__TOY_META__ || {}).toy_id);
      if (Number.isSafeInteger(toyId) && toyId > 0) platform = true;
      if (platform && health && typeof health.sdkState === "function") {
        const sdk = health.sdkState();
        if (sdk === "loading" || sdk === "failed") this._loadCloud = { state: "sdk-" + sdk };
      }
      /* [/feature:cloud-menu-sdk-status-select] */
      this.renderLoadBody();
      return;
    }
    this._loadFetchBusy = true;
    this.holdLoadCloud();
    this.renderLoadBody();
    return Promise.resolve().then(() => tc.fetchCloudSnapshot()).then((r) => {
      if (tok !== this._loadToken || !this.loadOpen) return;
      if (r && r.obj) {
        // 保留原始 saveVersion；确认时由 restoreSnapshot 校验后再迁移。
        this._loadCloud = { state: "ok", snap: r.obj };
      } else {
        const why = (r && r.reason) || "error";
        this._loadCloud = { state: why === "no-meta" ? "none" : "error", reason: why, code: r && r.code };
        this.releaseLoadCloud();
      }
      this.renderLoadBody();
    }).catch(() => {
      if (tok !== this._loadToken || !this.loadOpen) return;
      this._loadCloud = { state: "error", reason: "error" };
      this.releaseLoadCloud();
      this.renderLoadBody();
    }).finally(() => { if (tok === this._loadToken) this._loadFetchBusy = false; });
  },
  /* [/feature:cloud-menu-read] */

  openLoad() {
    /* [feature:cloud-menu-open-once] */
    if (this.loadOpen) return;
    /* [/feature:cloud-menu-open-once] */
    const box = $menu("#load-modal");
    const body = $menu("#load-body");
    if (!box || !body) return;
    this._loadPending = null;
    this._loadError = "";
    this.renderLoadBody();
    box.hidden = false;
    /* 卡片入场动画重放：元素一直在 DOM 里，光切 hidden 不会重播（与 openCredits 同款做法） */
    const card = box.querySelector(".load-card");
    if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
    this.loadOpen = true;
  /* [feature:menu-load-pages-open-20261013] */
    this._loadPage = 0;
    this.renderLoadBody();
  /* [/feature:menu-load-pages-open-20261013] */
    this.syncAnimation();
    this.fetchLoadCloud();
  },

  closeLoad() {
    /* [feature:cloud-menu-close] */
  /* [feature:menu-load-pages-close-20261013] */
    this.disposeLoadPages();
  /* [/feature:menu-load-pages-close-20261013] */
    const box = $menu("#load-modal");
    if (box) box.hidden = true;
    this._loadToken = (this._loadToken || 0) + 1;
    this._loadFetchBusy = false;
    this._loadPending = null;
    this.loadOpen = false;
    this.releaseLoadCloud();
    /* [/feature:cloud-menu-close] */
    this.syncAnimation();
  },

  /* 第一次点 = 选中（行内展开确认），再点一次同一个 = 确认载入 */
  pickLoad(key) {
    /* [feature:cloud-menu-choice-lock] */
    if (key === "cloud") this.holdLoadCloud();
    else if (!this._loadFetchBusy) this.releaseLoadCloud();
    /* [/feature:cloud-menu-choice-lock] */
    if (this._loadPending === key) { this.confirmLoad(key); return; }
    this._loadChoiceRevision = (this._loadChoiceRevision || 0) + 1;
    this._loadError = "";
    this._loadPending = key;
    this.renderLoadBody();
  },

  /* [feature:cloud-menu-confirm] */
  async confirmLoad(key) {
    if (this._newSlotBusy) return;
    const row = (this._loadRows || []).filter((x) => x.key === key)[0];
    this._loadPending = null;
    const save = window.GameSave;
    if (key.indexOf("empty_") === 0) {
      if (this.started || !this.loadOpen || !row || this._newSlotBusy) return;
      const text = window.GameCfg.UI_CFG.NEW_SAVE_SLOT;
      const token = this._loadToken, choice = this._loadChoiceRevision;
      this._loadPending = key;
      this._newSlotBusy = true;
      let result;
      try {
        await window.GameCfg.loadExternal();
        if (token !== this._loadToken || choice !== this._loadChoiceRevision || !this.loadOpen || this.started) return;
        result = save?.createNewSlot(Number(key.slice(6)), window.GameCore);
      } catch (_) { result = { ok: false }; }
      finally { this._newSlotBusy = false; }
      if (!result?.ok) {
        this._loadError = result?.reason === "occupied" ? text.OCCUPIED : text.FAILED;
        this.renderLoadBody(); return;
      }
      if (window.GameUI?.core) window.GameUI.resetOmTestChat();
      this.closeLoad(); this.startGame(); return;
    }
    if (!row || !row.snap) { this._loadError = "这个存档读不出来，已跳过。"; this.renderLoadBody(); return; }
    if (!save || !save.writeSnapshot) { this._loadError = "存档模块未就绪。"; this.renderLoadBody(); return; }
    /* 云档先完整恢复成功，再覆盖自动槽；失败保留当前进度。 */
    if (key === "cloud") {
      this.holdLoadCloud();
      let result;
      try { result = save.restoreSnapshot ? save.restoreSnapshot(row.snap, window.GameCore) : { ok: false, reason: "unavailable" }; }
      catch (_) { result = { ok: false, reason: "load-error" }; }
      if (!result.ok) {
        const tc = window.ToyCloud;
        this._loadError = tc && tc.errorMessage ? tc.errorMessage(result.reason) : "云端存档无法载入，本机进度已保留。";
        this.releaseLoadCloud();
        this.renderLoadBody();
        return;
      }
      const tc=window.ToyCloud;if(tc&&tc.acceptCloudRestore)tc.acceptCloudRestore(row.snap);
    } else if (!save.writeSnapshot("auto", row.snap)) {
      this._loadError = "写入本地存档失败（浏览器可能禁用了本地存储）。";
      this.renderLoadBody();
      return;
    }
    this.closeLoad();
    this.startGame();
  },
  /* [/feature:cloud-menu-confirm] */

  async startMenuBgm() {
    if (this.menuBgmStarted) return;
    const ok = await AudioMgr.playBgm(MENU_BGM_URL);
    if (ok) this.menuBgmStarted = true;
  },

  /* ---------------- 交互：点击任意位置进游戏（特效由全局 FX 触发） ---------------- */
  onMenuDown() {
    AudioMgr.resume();
    if (this.started) return;
    this.startGame();
  },

  /* ---------------- 主循环 ---------------- */
  animationBlocked() {
    return !this._entered || this.started || document.hidden || this.creditsOpen
      || this.achvOpen || this.loadOpen || !!(window.GameUI && window.GameUI._rankMask);
  },

  /* 模糊遮罩后面的落体与碰撞没有可交互内容。弹层打开时保留最后一帧，
     关闭时从同一位置继续；停留多久都不会补算背景动画或重复启动循环。 */
  syncAnimation() {
    if (this.animationBlocked()) {
      if (this._frame) cancelAnimationFrame(this._frame);
      this._frame = 0;
      return;
    }
    if (this._frame) return;
    this._last = performance.now();
    this._frame = requestAnimationFrame((t) => this.loop(t));
  },

  loop(now) {
    this._frame = 0;
    if (this.animationBlocked()) return;
    try {
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this.update(dt);
      this.render(now);
    } catch (e) { console.error("Menu loop:", e); }
    if (!this.animationBlocked()) this._frame = requestAnimationFrame((t) => this.loop(t));
  },

  update(dt) {
    this._time += dt;
    this.updateSpawner(dt);
    this.moveFallers(dt);
    this.separateCollisions();
    this.updateGeoShapes(dt);
  },

  updateSpawner(dt) {
    if (this.phase === "drain") {
      if (this.fallers.length === 0) {                 // 清空后重新开始
        this.phase = "grow";
        this.growth = 0;
        this.spawnRate = 0.9;
        this.spawnAcc = 0;
      }
      return;
    }
    // 密度随在场数量提升 → 1 个/秒 增至 ~17 个/秒
    this.growth = Math.min(1, this.fallers.length / this.maxFallers);
    this.spawnRate = 1.1 + this.growth * 16;
    this.spawnAcc += this.spawnRate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      this.spawnFall(false);
    }
    // 堆满整屏 → 停止新增，让已有角色从下方漏出
    if (this.fallers.length >= this.maxFallers || (this.growth >= 1 && this._time > 2.5)) {
      this.phase = "drain";
    }
  },

  spriteH(f) { return 120 * f.s; },
  spriteW(f) {
    const dh = this.spriteH(f);
    const img = f.img || this.whaleImg;   // 用该姿势图自身的宽高比
    return img ? dh * (img.width / img.height) : dh * 0.72;
  },

  spawnFall(initial) {
    const s = 0.55 + Math.random() * 0.5;
    // 随机姿势：从全部鲸鱼娘图中随机选一张
    const img = this.whaleImgs.length ? this.whaleImgs[Math.floor(Math.random() * this.whaleImgs.length)] : this.whaleImg;
    const w = this.spriteW({ s, img });
    const r = w * 0.46;
    const x = r + Math.random() * (this.W - 2 * r);
    const y = initial ? Math.random() * this.H * 0.4 : -(this.spriteH({ s }) / 2 + 40) - Math.random() * 60;
    this.fallers.push({
      x, y, r, s, img,
      vy: 8 + Math.random() * 15,     // 初始很慢，交给强重力瞬间拉起速度（先慢后快）
      vx: (Math.random() - 0.5) * 12,
      rot: (Math.random() - 0.5) * 0.3,
      vr: (Math.random() - 0.5) * 0.25,
      wob: Math.random() * Math.PI * 2,
      wobAmp: 6 + Math.random() * 10,
      wobV: 0.5 + Math.random() * 1.2,
      bounce: 0,                     // 落地回弹次数（轻微回弹后落定）
      resting: false,                // 是否已落定堆积
    });
  },

  /* 重力下落：grow 阶段落底/落堆即停（不再累积重力穿底），drain 阶段全部漏出 */
  moveFallers(dt) {
    const grow = this.phase === "grow";
    const keep = [];
    for (const f of this.fallers) {
      f.wob += f.wobV * dt;
      f.x += (f.vx + Math.sin(f.wob) * f.wobAmp) * dt;

      if (grow && f.resting) {
        // 已落定的纸片人：速度归零，不再下落
        f.vy = 0;
      } else {
        f.vy = Math.min(f.vy + FALL_G * dt, FALL_TERM);   // 重力加速度 + 终端速度
        f.y += f.vy * dt;
      }
      f.rot += f.vr * dt;
      if (f.x < f.r) f.x = f.r;
      if (f.x > this.W - f.r) f.x = this.W - f.r;

      // 底部托底（仅 grow；落底后轻微回弹 2 次再落定，resting 也持续 clamp 防穿底）
      if (grow) {
        const feet = f.y + this.spriteH(f) / 2;
        if (feet >= this.H) {
          f.y = this.H - this.spriteH(f) / 2;
          if (f.bounce < 2) {
            f.bounce++;
            // 按落地速度的小比例向上弹，越弹越低直到落定（轻微回弹）
            f.vy = -Math.min(320, Math.max(90, f.vy * 0.4));
            f.resting = false;
          } else {
            f.vy = 0;
            f.resting = true;
          }
        }
      }

      // 完全漏出屏幕下方 → 移除
      if (f.y - this.spriteH(f) / 2 < this.H + 70) keep.push(f);
    }
    this.fallers = keep;
  },

  /* 碰撞：空中软推开；落地后横向让位，新落下的落在上方堆叠（不穿模） */
  separateCollisions() {
    const fs = this.fallers;
    const drain = this.phase === "drain";
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const minD = a.r + b.r;
        if (d < 0.001 || d >= minD) continue;

        if (drain) {
          // 漏出阶段：轻推开即可，允许继续下坠漏出
          const push = (minD - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        } else if (a.resting && !b.resting) {
          // b 落在已堆积的 a 上方（轻微回弹，再落定）
          b.y = a.y - (a.r + b.r) * 0.86;
          if (b.vy > 0 && b.bounce < 2) {
            b.bounce++;
            b.vy = -Math.min(280, Math.max(70, b.vy * 0.4));
            b.resting = false;
          } else {
            if (b.vy > 0) b.vy = 0;
            b.resting = true;
          }
          const nx = dx / d;
          b.x += nx * (minD - d) * 0.6;
        } else if (b.resting && !a.resting) {
          // a 落在已堆积的 b 上方（轻微回弹，再落定）
          a.y = b.y - (a.r + b.r) * 0.86;
          if (a.vy > 0 && a.bounce < 2) {
            a.bounce++;
            a.vy = -Math.min(280, Math.max(70, a.vy * 0.4));
            a.resting = false;
          } else {
            if (a.vy > 0) a.vy = 0;
            a.resting = true;
          }
          const nx = dx / d;
          a.x -= nx * (minD - d) * 0.6;
        } else if (a.resting && b.resting) {
          // 都已落地：只横向让位，避免横向穿模
          const push = (minD - d) / 2;
          const nx = dx / d;
          a.x -= nx * push; b.x += nx * push;
        } else {
          // 都在空中：软推开
          const push = (minD - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
        if (a.x < a.r) a.x = a.r; if (a.x > this.W - a.r) a.x = this.W - a.r;
        if (b.x < b.r) b.x = b.r; if (b.x > this.W - b.r) b.x = this.W - b.r;
      }
    }
  },

  /* ---------------- 渲染：先画底图几何（tile 平铺 + 斜向飘动），再画掉落纸片人（特效由全局 FX 层绘制） ---------------- */
/* [feature:menu-composited-render] */
  render(now) {
    if (this.renderMenuLayers(now || performance.now())) return;
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);
    this.drawGeoLayer(c, now || performance.now());
    for (const f of this.fallers) this.drawWhale(c, f);
  },

/* [/feature:menu-composited-render] */

  drawWhale(c, f) {
    if (!this.whaleLoaded) return;
    const img = f.img || this.whaleImg;   // 用该掉落体自己随机到的姿势图
    if (!img) return;
    const dh = this.spriteH(f);
    const dw = this.spriteW(f);
    c.save();
    c.translate(f.x, f.y);
    c.rotate(f.rot);
    // 底部软阴影（水下氛围）
    c.globalAlpha = 0.14;
    c.fillStyle = "#0a3f6e";
    c.beginPath();
    c.ellipse(0, dh * 0.44, dw * 0.4, dh * 0.1, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    c.restore();
  },

  /* ---------------- 进入游戏（黑幕转场：渐入 → 换场 → 渐出） ---------------- */
  startGame() {
    if (this.started) return;
/* [feature:menu-composited-release] */
    this.started = true;
    this.syncAnimation();
    // Preserve the frozen last frame until either black transition has covered it.
    setTimeout(() => { if (this.started) this.releaseMenuArt(); }, 600);
/* [/feature:menu-composited-release] */

    this.menuBgmStarted = true;           // 阻止任何菜单曲重入
    // 强制切换 BGM（点太快时兜底）：清挂起待播、作废在途加载、停当前、起主场景曲
    AudioMgr.want = null;
    AudioMgr.seq++;
    AudioMgr.stopBgm();
    AudioMgr.resume();
    AudioMgr.playBgm(SCENE_BGM_URL);

    const m = $menu("#menu");
    m.style.pointerEvents = "none";

    const tr = $menu("#transition");
    if (tr) {
      // 1) 黑幕渐入（300ms）
      tr.style.opacity = "1";
      setTimeout(() => {
        // 2) 黑幕全盖时换场：隐藏主菜单 + 直接打开玩法界面（办公室主循环）
        //    2026-08-30：删掉「小鲸鱼房间」中间步骤——不再显示房间场景和「开始训练」按钮
        m.classList.add("hide"); m.hidden = true;
        try {
          if (window.Training) window.Training.open();
        } finally {
          tr.style.opacity = "0";   // 无论玩法启动成败，黑幕都必须退场
        }
      }, 330);
    } else {
      // 兜底（无黑幕元素）：直接打开玩法界面
      if (window.Training) window.Training.open();
      m.style.opacity = "0";
      setTimeout(() => { m.classList.add("hide"); m.hidden = true; }, 560);
    }
  },
};

window.Menu = Menu;   // 调试入口（本地排查用）
window.addEventListener("DOMContentLoaded", () => Menu.boot());
