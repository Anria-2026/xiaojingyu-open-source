/* [feature:cloud-batch-description] */
/* ==========================================================================
   ToyCloud —— B站 Toy 云存档 + 排行榜
   --------------------------------------------------------------------------
   设计要点（当前实现说明）：
   · 所有云逻辑收口在本文件，外部只调 onLocalSaved / onReviewSettled / init
   · 全量存档按 **UTF-8 字节** 切片（≠字符！中文 3 字节、emoji 代理对 4 字节），
     每片 ≤900 字节，绝不切断字符或代理对
   · 分片与 cs_meta 一次批量提交；读时一次批量取样并校验片数与 hash
   · 降级双闸：available() 预检 + 每次调用 try/catch 同时接同步抛与 Promise reject
     —— 非 Toy 环境（Vercel/本地无 mock）必须零调用、零报错、零行为变化
     ⚠️ available() **不能**用 __TOY_META__ 当门禁：那只是平台**可选**注入的快捷方式，
        正式页靠 SDK 自己与父窗口 postMessage 握手拿 toy_id（见 toy-sdk.js 的 Dt()）。
        2026-09-22 用户实测：正式页拿不到 __TOY_META__ ⇒ 旧判据直接判「环境不支持」
        ⇒ 云存档与排行榜全废。现在按「SDK 在 + 处在平台环境」放行，真实可用性由调用结果决定。
   · 节流 180s + hash 去重 + 307044 指数退避 + 连败熔断
   ========================================================================== */
/* [/feature:cloud-batch-description] */
"use strict";

(function () {
  const G = typeof window !== "undefined" ? window : globalThis;

  /* ---- 平台硬约束 ---- */
  const CHUNK_BYTES = 900;        // 单片上限，留出 key 名与元信息的余量（官方上限 1024 字节）
  const MAX_CHUNK = 100;          // 单 Toy 共 128 个 key-value，留 28 个余量给其他用途
  const META_KEY = "cs_meta";     // 提交点：最后写
  const CHUNK_PREFIX = "cs_c";    // cs_c0 / cs_c1 ...
/* [feature:cloud-request-deadlines] */
  const REQUEST_MS = 12000;       // 宿主不回包也必须结束界面等待
  const READ_RETRY_MS = 1500;     // 临时读取故障最多延迟重试一次
/* [/feature:cloud-request-deadlines] */

  /* ---- 节流 / 退避 / 缓存 ---- */
  const THROTTLE_MS = 180 * 1000; // 云上传最小间隔
  const CACHE_MS = 5 * 60 * 1000; // 榜单缓存
  const BACKOFF_MS = [30 * 1000, 60 * 1000, 120 * 1000, 300 * 1000];
  const BREAK_AFTER = 3;          // 连续失败几次后熔断到本会话

  /* 2026-10-01 拍板：**不换榜**。改为给记忆挂分数加成（AXES.DEF.memory.scoreMul=1.5，
     见 v35_core.review 注释）——新满分 ~922 略高于旧配置云榜的 917，老成绩被慢慢替换。
     ⚠️ 若未来某次调参把满分压到**低于**当前榜首且平台仍无清榜能力，再启用换榜方案：
     BOARD+1 且 LBQ_KEY 同步换代（否则旧队列里的旧分数会被 flushQueue 补发进新榜）。 */
  const BOARD = 1;                // 榜位（含义：V4.5 终局评审）
  const LBQ_KEY = "whale_toy_lbq"; // 待补发的上报队列（本地）

  const RATE_LIMIT_CODE = 307044;
  const BODY_VERS = new Set(['V5','V5.5','V6','V6.5']);
  const config = () => G.GameCfg || G.gameCfg || {};
  const version = value => typeof value === 'string' ? value : value && value.ver;
  function boardFor(value) {
    const ver=version(value);
    if(!BODY_VERS.has(ver))return BOARD;
    const n=Number(((config().EMBODIED||{}).CLOUD_BOARDS||{})[ver]);
    return Number.isSafeInteger(n)&&n>BOARD?n:null;
  }
  function boardId(value) { return typeof value==='number' ? (Number.isSafeInteger(value)&&value>0?value:null) : boardFor(value); }

  /* ======================================================================
     1. 环境探测与错误分类
     ====================================================================== */

  /* toy_id 有两个来源（与官方 SDK 的 Dt() 完全同源）：
     · window.__TOY_META__.toy_id —— 平台**可选**注入的快捷方式（本地 mock 走这条）
     · 否则由 SDK 与父窗口 postMessage 握手后内部持有（正式页走这条，**注入不一定有**）
   ⚠️ 所以它**只能当信息/展示**用，绝不能当可用性门禁 —— 见文件头注释。 */
  function toyId() {
    const m = G.__TOY_META__;
    const id = m && m.toy_id;
    const n = Number(id);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  }
  function hasToyId() { return toyId() > 0; }

  function api() {
    const t = G.toy;
    return t && typeof t.setCloudStorage === "function" ? t : null;
  }
  function hasSdk() { return !!api(); }

  /* 是否处在被嵌入的页面里（正式页 / 预览页都是 iframe）。
     跨域时读 window.parent 不会抛（拿到的是 window 引用），但保险起见仍包一层。 */
  function inFrame() {
    try { return !!G.parent && G.parent !== G; } catch (e) { return false; }
  }

  /* 可用性判据（放宽到「平台环境」而不是「拿到 toy_id」）：
     · iframe 内（正式页 / 预览页）→ 放行 —— SDK 自己会握手拿 toy_id
     · 或平台注入了 __TOY_META__（本机 mock / 特殊宿主）→ 放行
     · 都不是（Vercel 直开、本地无 mock）→ 判不可用，零调用零报错
     真实可用性由调用层的 try/catch 决定（握手超时 / 未登录 / 限流都静默降级）。 */
  function available() { return hasSdk() && (inFrame() || hasToyId()); }

  function errCode(e) {
    return e && (e.code != null ? e.code : (e.data && e.data.code));
  }
  function isRateLimit(e) { return Number(errCode(e)) === RATE_LIMIT_CODE; }

  /* ======================================================================
     2. UTF-8 字节级切片（中文 3 字节 / emoji 代理对 4 字节，都不能切坏）
     ====================================================================== */

  /* 单个「字符」（可能是一个代理对）的 UTF-8 字节数 */
  function charBytes(cp) {
    if (cp < 0x80) return 1;
    if (cp < 0x800) return 2;
    if (cp < 0x10000) return 3;
    return 4;
  }

  /* 字符串的 UTF-8 字节长度（代理对按 4 字节算，与平台一致） */
  function utf8Len(str) {
    let n = 0;
    for (const ch of str) n += charBytes(ch.codePointAt(0));
    return n;
  }

  /* 按 UTF-8 字节切成若干片，每片 ≤maxBytes；用 for...of 迭代码点，
     天然不会切断代理对（emoji） */
  function sliceByBytes(str, maxBytes) {
    const out = [];
    let cur = "", curBytes = 0;
    for (const ch of str) {
      const b = charBytes(ch.codePointAt(0));
      if (curBytes + b > maxBytes && cur) { out.push(cur); cur = ""; curBytes = 0; }
      cur += ch; curBytes += b;
    }
    if (cur) out.push(cur);
    return out;
  }

  /* 简易内容指纹（FNV-1a 32 位，转 8 位十六进制）。
     用途只是「本地 vs 云端是否同一份」与「撕裂检测」，不需要密码学强度。 */
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  /* 快照 → 分片；超限时返回 slim 结果或 null（拒绝上传） */
  function encodeSnapshot(snap) {
    const json = JSON.stringify(snap);
    const h = hash(json);
    let chunks = sliceByBytes(json, CHUNK_BYTES);
    let slim = 0;

    /* 超限保护：先尝试剔除纯展示性流水（它们不影响进度） */
    if (chunks.length > MAX_CHUNK && snap && snap.state) {
      const st = snap.state;
      const slimState = Object.assign({}, st);
      delete slimState.codexLog;
      delete slimState.newsFeed;
      if (slimState.c2 && typeof slimState.c2 === "object") {
        const c2 = Object.assign({}, slimState.c2);
        delete c2.seen;
        slimState.c2 = c2;
      }
      const slimJson = JSON.stringify(Object.assign({}, snap, { state: slimState }));
      const slimChunks = sliceByBytes(slimJson, CHUNK_BYTES);
      if (slimChunks.length <= MAX_CHUNK) {
        chunks = slimChunks; slim = 1;
        return { json: slimJson, hash: hash(slimJson), chunks, slim };
      }
      return null;   // 仍然超限 → 拒绝上传，只保本地
    }
    return { json, hash: h, chunks, slim };
  }

  /* 分片 → 快照（校验片数 + hash；任何不一致都返回 null，绝不用半份云档） */
/* [feature:cloud-decode-validation] */
  function decodeSnapshot(meta, rec) {
    if (!meta || !Number.isSafeInteger(meta.n) || meta.n <= 0 || meta.n > MAX_CHUNK) return { obj: null, reason: "bad-meta" };
    let json = "";
    for (let i = 0; i < meta.n; i++) {
      const v = rec[CHUNK_PREFIX + i];
      if (typeof v !== "string") return { obj: null, reason: "missing-chunk" };  // 撕裂
      json += v;
    }
    if (meta.hash && hash(json) !== meta.hash) return { obj: null, reason: "hash-mismatch" };
    try {
      const obj = JSON.parse(json);
      if (!obj || !obj.state || typeof obj.state !== "object" || Array.isArray(obj.state)) return { obj: null, reason: "bad-json" };
      return { obj, reason: "" };
    } catch (e) { return { obj: null, reason: "parse-error" }; }
  }

/* [/feature:cloud-decode-validation] */
  /* ======================================================================
     3. 运行时状态
     ====================================================================== */

  const S = {
    inited: false,
    lastUploadAt: 0,
    lastHash: "",
    failStreak: 0,
    brokenUntil: 0,      // 熔断：本会话内不再自动重试
    boardCache: {},      // { board:period: {t, list} }
    mineCache: {},
    scoreSubmissions: {}, // In-flight writes per board; read only after this board's submit completes.
    scoreGeneration: {}, // Responses started before a newer submission cannot repopulate its caches.
    lastSyncAt: 0,       // 上次成功上传时间（存档弹窗展示用）
    lastSyncSlim: 0,
    lastChunkCount: 0,   // 上次上传的片数（用于清理变少的残留片）
/* [feature:cloud-sync-state] */
    startupProtected: false,
    startupRemote: null,
    startupFailure: null,
    lastReadHash: "",
    restoring: 0,
    rateLimitUntil: 0,
    lastContentHash: "",
    localSnapshot: null,
/* [/feature:cloud-sync-state] */
  };

  function now() { return Date.now(); }
  function broken() { return S.brokenUntil && now() < S.brokenUntil; }

  function noteFail(e) {
    S.failStreak++;
    if (S.failStreak >= BREAK_AFTER) {
      S.brokenUntil = now() + BACKOFF_MS[BACKOFF_MS.length - 1];
    }
  }
  function noteOk() { S.failStreak = 0; S.brokenUntil = 0; }

  /* 退避时长（供 UI 提示用） */
/* [feature:cloud-backoff-bound] */
  function backoffMs() {
    return BACKOFF_MS[Math.min(Math.max(0, S.failStreak - 1), BACKOFF_MS.length - 1)];
  }

/* [/feature:cloud-backoff-bound] */
  /* ======================================================================
     4. 云存档：上传 / 下载
     ====================================================================== */

/* [feature:cloud-storage-operations] */
  /* 单次批量调用符合 SDK 合同；20 条分批是旧客户端自加限制，会放大限流与撕裂。
     不宣称宿主具有事务能力：读侧仍校验完整性，失败绝不覆盖本地。 */
  let activeWrite = null, writeTimedOut = false, pendingUpload = null, activeRead = null;

  function cloudError(reason) { const e = new Error(reason); e.cloudReason = reason; return e; }
  function failure(e) {
    const code = errCode(e);
    const reason = isRateLimit(e) ? "rate-limit" : e && e.cloudReason ? e.cloudReason
      : (Number(code) === -101 || Number(code) === 401 || /not.?logged.?in|not_login|login.required|unauthorized|未登录/i.test(String(e && e.type || "") + " " + String(e && e.message || ""))) ? "auth" : "error";
    return { reason, code: typeof code === "number" || typeof code === "string" ? code : undefined };
  }
  function recordFailure(e) {
    noteFail(e);
    const f = failure(e);
    if (f.reason === "rate-limit") S.rateLimitUntil = now() + backoffMs();
    return f;
  }
  function cooling() { return now() < S.rateLimitUntil; }
  function deadline(promise) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(cloudError("timeout")), REQUEST_MS);
      Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, e => { clearTimeout(timer); reject(e); });
    });
  }
  function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function beginRestore() {
    S.restoring++;
    S.localSnapshot = null;
    // 读取前排队的旧进度不能在确认恢复后补发。
    if (pendingUpload) { pendingUpload.resolve({ ok: false, reason: "restoring" }); pendingUpload = null; }
  }
  function endRestore() { S.restoring = Math.max(0, S.restoring - 1); }

  function errorMessage(reason) {
    if(reason === "cloud-exists") return (((G.GameCfg||{}).CLOUD_SAVE||{}).UI||{}).PROTECTED || errorMessage("error");
    const messages = {
      "no-meta": "云端还没有存档。",
      "unavailable": "当前环境无法使用云存档，请在 B站 Toy 中打开游戏。",
      "auth": "请先登录 B站，再重新读取云存档。",
      "rate-limit": "云存档请求过于频繁，请稍等后再试。",
      "timeout": "云存档连接超时，请检查网络后重试。",
      "error": "云存档连接失败，请检查网络或登录状态后重试。",
      "invalid-response": "平台返回了异常数据，请稍后重新读取。",
      "write-pending": "上次云同步尚未结束，请稍候；若长时间无响应，请刷新页面。",
      "restoring": "正在读取或恢复存档，请完成后再同步。",
      "too-big": "存档超过云端容量，进度仍保存在本机。",
      "unsupported-version": "这份存档来自更新的游戏版本，请更新游戏后再读取。",
      "unsupported-stage": "当前版本尚不支持这份存档的阶段，请使用对应版本读取。",
      "invalid-state": "存档内容不完整，无法安全恢复；本机存档已保留。",
      "invalid-snapshot": "存档格式不正确，无法安全恢复；本机存档已保留。",
      "busy": "正在恢复存档，请稍候。",
      "load-error": "存档恢复失败，本机原进度已保留。",
      "storage-error": "本机保存失败，请检查浏览器存储空间后重试。",
    };
    if (["bad-meta", "missing-meta", "missing-chunk", "hash-mismatch", "bad-json", "parse-error"].includes(reason)) {
      return "云端存档不完整或校验失败，本机进度已保留。可在进度完整的设备上重新上传。";
    }
    return messages[reason] || messages.error;
  }

  /* 锁跟随底层 SDK Promise，而非界面的超时 Promise。宿主晚完成的旧写不能越过新写。 */
  function mutate(action, onSuccess) {
    const operation = Promise.resolve().then(action).then(() => {
      onSuccess(); noteOk(); return { ok: true, reason: "uploaded" };
    }, e => ({ ok: false, ...recordFailure(e) }));
    activeWrite = operation;
    operation.then(() => {
      if (activeWrite !== operation) return;
      activeWrite = null; writeTimedOut = false;
      const next = pendingUpload; pendingUpload = null;
      if (next) runUpload(next).then(next.resolve);
    });
    return deadline(operation).catch(e => {
      writeTimedOut = true;
      // 未知结果不重试写入，保留真实在途锁；SDK 真正结束后再放行。
      if (pendingUpload) { pendingUpload.resolve({ ok: false, reason: "write-pending" }); pendingUpload = null; }
      return { ok: false, ...failure(e) };
    });
  }

  function setStartupProtection(protectedSave) {
    S.startupProtected = protectedSave;
    const save = G.GameSave;
    if (!save || !save.AUTO_KEY) return;
    try {
      const key = save.AUTO_KEY + "_cloud_pending";
      if (protectedSave) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch (_) {}
  }
  let startupRead = null;
  function protectStartupUpload(job) {
    if(job.overwrite && S.startupRemote){setStartupProtection(false);S.startupRemote=null;S.startupFailure=null;return runUpload(job);}
    if(S.startupRemote)return Promise.resolve({ok:false,reason:"cloud-exists"});
    if(S.startupFailure)return Promise.resolve(S.startupFailure);
    if(!startupRead){
      startupRead=downloadSnapshot().then(result=>{
        if(result.obj){S.startupRemote=result.obj;return {ok:false,reason:"cloud-exists"};}
        if(result.reason==="no-meta"){setStartupProtection(false);return null;}
        return S.startupFailure={ok:false,reason:result.reason,code:result.code};
      }).finally(()=>{startupRead=null;});
    }
    return startupRead.then(result=>result||runUpload(job));
  }
  // Only a snapshot returned by a completed cloud read can authorize resumed
  // automatic syncing. A failed/cancelled restore never releases this guard.
  function acceptCloudRestore(snap) {
    if(!snap||!S.lastReadHash||hash(JSON.stringify(snap))!==S.lastReadHash)return false;
    setStartupProtection(false);S.startupRemote=null;S.startupFailure=null;return true;
  }
  async function runUpload(job) {
    if (S.restoring) return { ok: false, reason: "restoring" };
    if (cooling()) return { ok: false, reason: "rate-limit" };
    if (!job.force && broken()) return { ok: false, reason: "unavailable" };
    if (activeWrite) {
      if (writeTimedOut) return { ok: false, reason: "write-pending" };
      return new Promise(resolve => {
        if (pendingUpload) pendingUpload.resolve({ ok: false, reason: "superseded" });
        pendingUpload = Object.assign({}, job, { resolve });
      });
    }
    if (S.startupProtected) return protectStartupUpload(job);
    if (job.contentHash === S.lastContentHash) return { ok: true, reason: "unchanged" };
    if (!job.force && now() - S.lastUploadAt < THROTTLE_MS) return { ok: false, reason: "throttled" };
    const { enc, meta } = job;
    const pairs = {};
    enc.chunks.forEach((chunk, i) => { pairs[CHUNK_PREFIX + i] = chunk; });
    pairs[META_KEY] = JSON.stringify(meta);
    const result = await mutate(() => api().setCloudStorage(pairs), () => {
      S.lastChunkCount = enc.chunks.length;
      S.lastHash = enc.hash; S.lastContentHash = job.contentHash;
      S.lastUploadAt = now(); S.lastSyncAt = now(); S.lastSyncSlim = enc.slim;
    });
    return Object.assign(result, { chunks: enc.chunks.length, slim: enc.slim });
  }

  function uploadSnapshot(snap, force, overwrite) {
    if (!available() || !snap) return Promise.resolve({ ok: false, reason: "unavailable" });
    if (S.restoring) return Promise.resolve({ ok: false, reason: "restoring" });
    try {
      const enc = encodeSnapshot(snap);
      if (!enc) return Promise.resolve({ ok: false, reason: "too-big" });
      const meta = { v: 1, n: enc.chunks.length, ts: now(),
        ver: (snap.state && snap.state.ver) || "V1", week: (snap.state && snap.state.week) || 0,
        wo: (snap.state && snap.state.weekOffset) || 0, hash: enc.hash, slim: enc.slim };
      // 展示用快照时间不属于进度，重复 hide/pagehide 无需再次写同一份状态。
      const contentHash = hash(JSON.stringify([snap.saveVersion, snap.state]));
      return runUpload({ enc, meta, contentHash, force, overwrite: overwrite === true });
    } catch (e) { return Promise.resolve({ ok: false, reason: "bad-json" }); }
  }

  async function readOnce() {
    const t = api();
    if (!t || typeof t.getCloudStorage !== "function") throw cloudError("unavailable");
    const keys = [META_KEY];
    for (let i = 0; i < MAX_CHUNK; i++) keys.push(CHUNK_PREFIX + i);
    const rec = await deadline(Promise.resolve().then(() => t.getCloudStorage(keys)));
    if (!rec || typeof rec !== "object" || Array.isArray(rec) || Object.keys(rec).some(key => typeof rec[key] !== "string")) throw cloudError("invalid-response");
    if (!Object.prototype.hasOwnProperty.call(rec, META_KEY)) return { obj: null, reason: Object.keys(rec).some(key=>key.startsWith(CHUNK_PREFIX)) ? "missing-meta" : "no-meta" };
    let meta;
    try { meta = JSON.parse(rec[META_KEY]); } catch (e) { return { obj: null, reason: "bad-meta" }; }
    if (!meta || !Number.isSafeInteger(meta.n) || meta.n <= 0 || meta.n > MAX_CHUNK || (meta.v != null && meta.v !== 1)) {
      return { obj: null, reason: "bad-meta" };
    }
    return Object.assign(decodeSnapshot(meta, rec), { meta });
  }

  function downloadSnapshot() {
    if (activeRead) return activeRead;
    if (!available()) return Promise.resolve({ obj: null, reason: "unavailable" });
    if (cooling()) return Promise.resolve({ obj: null, reason: "rate-limit" });
    beginRestore();
    activeRead = (async () => {
      if (activeWrite) {
        if (writeTimedOut) return { obj: null, reason: "write-pending" };
        try { await deadline(activeWrite); } catch (e) { return { obj: null, reason: "write-pending" }; }
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        let result;
        try { result = await readOnce(); }
        catch (e) { result = { obj: null, ...recordFailure(e) }; }
        if (result.obj || result.reason === "no-meta" && attempt) {
          if(result.obj)S.lastReadHash=hash(JSON.stringify(result.obj));
          noteOk(); return result;
        }
        if (attempt || !["error", "timeout", "missing-chunk", "hash-mismatch", "no-meta"].includes(result.reason)) return result;
        await delay(READ_RETRY_MS);
        if (cooling()) return { obj: null, reason: "rate-limit" };
      }
    })().finally(() => { activeRead = null; endRestore(); });
    return activeRead;
  }

  function onLocalSaved(slot, snap) {
    if (S.restoring) return;
    // 只从真实本地落盘取生命周期快照，主菜单的未恢复默认状态不得上传。
    S.localSnapshot = snap;
    if (!available() || broken()) return;
    uploadSnapshot(snap, false).then(r => {
      if (r.reason === "too-big") console.warn("[ToyCloud] 存档超过云上限，本次未同步（仅保本地）");
    }).catch(() => {});
  }

  function flush(snap, overwrite) {
    // The explicit boolean is used only by the manual upload UI. Automatic
    // stage/hide saves must not repeatedly probe a failed startup read.
    if(typeof overwrite === "boolean")S.startupFailure=null;
    // 阶段锚点/手动同步也是最新本地进度，hide 不得补发更早的自动快照。
    if (!S.restoring && snap) S.localSnapshot = snap;
    return uploadSnapshot(snap, true, overwrite);
  }

  async function forgetCloud() {
    const t = api();
    if (!available() || !t || typeof t.removeCloudStorage !== "function" || S.restoring || activeWrite || cooling()) return false;
    const keys = [META_KEY];
    for (let i = 0; i < MAX_CHUNK; i++) keys.push(CHUNK_PREFIX + i);
    const result = await mutate(() => t.removeCloudStorage(keys), () => {
      S.lastHash = ""; S.lastContentHash = ""; S.lastSyncAt = 0; S.lastChunkCount = 0; S.localSnapshot = null; setStartupProtection(false); S.startupRemote = null; S.startupFailure = null; S.lastReadHash = "";
    });
    return result.ok;
  }

/* [/feature:cloud-storage-operations] */
  /* ======================================================================
     5. 排行榜
     ====================================================================== */

  /* ⚠️ 打包口径要能容纳**真实分数**：V4.5 总评实测 669.5（维度上限 640 × 参数倍率 1.7
     = 1088），不是「维度上限 60–70」那种小量级。第一版把上限写成 1600（=160.0 分）
     ⇒ 所有正常成绩一律被 clamp 成同一个值 ⇒ 榜单退化成只比周数。
     现在的量级：分数 ×10 后 clamp 到 16770（=1677.0 分，真实上限约 1200 的 1.4 倍余量），
     占高位；低位 1000 格给「周数越少越好」（999 - 周数）。
     最大 packed = 16770 × 1000 + 999 = 16,770,999 < 16,777,215（平台上限）✓
     两项都相同时，由平台原生「同分先到先赢」决定上榜时间。 */
  const SCORE_CAP = 16770;   // ×10 后的分数上限
  const WEEK_CAP = 999;      // V4.5 阶段周数上限
  const WEEK_SPAN = 1000;    // 时长占用的低位宽度（必须 > WEEK_CAP）

  function scoreCap(value) {
    const ver=version(value),configured=Number(((config().EMBODIED||{}).CLOUD_SCORE_CAPS||{})[ver]);
    return BODY_VERS.has(ver) ? Math.max(0,Math.min(16776,Number.isFinite(configured)?Math.floor(configured):0)) : SCORE_CAP/10;
  }
  /* A packed integer is transport data, not proof that the score was attainable. */
  function legalScoreCap(value) {
    const ver = version(value) || "V4.5", core = G.GameCore;
    const ceiling = core && core.cfg && typeof core.reviewScoreCeiling === "function" ? core.reviewScoreCeiling(ver) : null;
    return Number.isFinite(ceiling) ? Math.min(scoreCap(ver), ceiling) : null;
  }
  function validBoardScore(packed, board) {
    if (!Number.isSafeInteger(packed) || packed < 0 || packed > 16777215) return false;
    if (!G.GameCore || !G.GameCore.cfg) return null;
    const ver = board === BOARD ? "V4.5" : [...BODY_VERS].find(v => boardFor(v) === board);
    if (!ver) return null; // Unknown historical/configured boards cannot be safely reclassified.
    const limit = legalScoreCap(ver);
    // Incomplete startup configuration must not erase a pending valid submission.
    if (limit == null) return null;
    const factor = BODY_VERS.has(ver) ? 1 : 10;
    return Math.floor(packed / WEEK_SPAN) <= Math.round(limit * factor);
  }
  function packScore(score, weeks, value) {
    // Body stages show integer scores. Fixed integer packing supports their
    // 2000~3200 caps within Toy's 24-bit limit; board 1 retains decimal packing.
    const factor=BODY_VERS.has(version(value))?1:10;
    const s = Math.max(0, Math.min(scoreCap(value)*factor, Math.round(Number(score) * factor) || 0));
    const w = Math.max(0, Math.min(WEEK_CAP, Math.round(Number(weeks) || 0)));
    return s * WEEK_SPAN + (WEEK_CAP - w);
  }

  /* packScore 的逆运算：榜单里存的是打包整数，直接展示给玩家毫无意义，
     所以 UI 一律先解回「评审分 / V4.5 周数」再显示。榜上所有人同一套打包口径。 */
  function unpackScore(packed, value) {
    const p = Math.max(0, Math.round(Number(packed) || 0));
    return { score: Math.floor(p / WEEK_SPAN) / (BODY_VERS.has(version(value))?1:10), weeks: WEEK_CAP - (p % WEEK_SPAN) };
  }

  /* 解锁判定：打到最后一个阶段 V4.5 且该局最终评审登顶 */
  function unlocked(state) {
    if (!state) return false;
    if(BODY_VERS.has(state.ver))return boardFor(state)!==null;
    /* ⚠️ 浏览器里的全局名是 window.GameCfg（game_cfg.js 里 window.GameCfg = {...}）。
       曾经写成 gameCfg → VER_ORDER 取不到 → 末位阶段退化成 "V1" →
       **排行榜永远解锁不了**，而且不报错。这个错字是靠 localhost 的 mock 实测才抓到的
       （node 单测没抓到：测试里也写错了同一个名字，成了自证式断言）。
       保留 gameCfg 兜底只是防御，真正取值的必须是 GameCfg。 */
    const cfg = G.GameCfg || G.gameCfg;
    const order = (cfg && cfg.VER_ORDER) || ["V1"];
    const last = order[order.length - 1];
    return state.ver === "V4.5" && Number(state.rank) === 1; // BOARD 1 is the historical V4.5 leaderboard; V5 must never mix in.
  }

  /* 待补发队列（本地），submitScore 保最高分 ⇒ 重发幂等 */
  function queuePush(score, board) {
    try {
      let q = queueAll();
      if (!q.some(row=>row.board===board&&row.score===score)) q.push({board,score});
      const counts={};q=q.reverse().filter(row=>{counts[row.board]=(counts[row.board]||0)+1;return counts[row.board]<=20;}).reverse();
      localStorage.setItem(LBQ_KEY, JSON.stringify(q));
    } catch (e) {}
  }
  function queueAll() {
    try {
      const raw=JSON.parse(localStorage.getItem(LBQ_KEY)||'[]');if(!Array.isArray(raw))return [];
      const seen=new Set();return raw.map(x=>typeof x==='number'?{board:BOARD,score:x}:x).filter(x=>{
        if(!x||!Number.isSafeInteger(x.board)||x.board<1||!Number.isSafeInteger(x.score)||x.score<0||x.score>16777215)return false;
        const key=x.board+':'+x.score;if(seen.has(key))return false;seen.add(key);return true;
      }).map(x=>({board:x.board,score:x.score}));
    } catch (e) { return []; }
  }
  function queueClear(score, board) {
    try {
      const q = queueAll().filter((x) => x.board!==board||x.score!==score);
      localStorage.setItem(LBQ_KEY, JSON.stringify(q));
    } catch (e) {}
  }

  function invalidateScoreReads(board) {
    S.scoreGeneration[board] = (S.scoreGeneration[board] || 0) + 1;
    for (const key of Object.keys(S.boardCache)) if (key.startsWith(board + ':')) delete S.boardCache[key];
    for (const key of Object.keys(S.mineCache)) if (key.startsWith(board + ':')) delete S.mineCache[key];
  }

  async function submit(score, value) {
    if (!available()) return { ok: false, reason: "unavailable" };
    const board=boardId(value);if(!board)return {ok:false,reason:'bad-board'};
    const valid = validBoardScore(score, board);
    if (valid !== true) return {ok:false,reason:valid == null ? 'score-unverified' : 'bad-score'};
    const t = api(), pending=S.scoreSubmissions[board]||(S.scoreSubmissions[board]=new Set());
    invalidateScoreReads(board);
    const operation=(async()=>{
      try {
        await t.submitScore({ board, score });
        noteOk();
        queueClear(score,board);
        invalidateScoreReads(board);
        return { ok: true };
      } catch (e) {
        noteFail(e);
        return { ok: false, reason: isRateLimit(e) ? "rate-limit" : "error", err: e };
      }
    })();
    pending.add(operation);
    try { return await operation; } finally { pending.delete(operation);if(!pending.size)delete S.scoreSubmissions[board]; }
  }

  /* 结算钩子：唯一上报入口（按事件提交一次，不随 tick 上报） */
  function onReviewSettled(state, result) {
    if (!unlocked(state)) return null;
    const core = G.GameCore;
    if (!result || result.settled !== true || !['pass','excellent','top'].includes(result.verdict)
        || result.retry || result.missionFail === true || !Number.isFinite(result.score)
        || !core || core.state !== state || !state.v35 || typeof core.evaluate !== "function") return null;
    const checked = core.evaluate();
    if (!Number.isFinite(checked.score) || checked.score !== result.score || checked.verdict !== result.verdict) return null;
    const board=boardFor(state),score = packScore(result.score, state.week,state.ver);
    if (validBoardScore(score, board) !== true) return null;
    queuePush(score,board);
    submit(score,board).catch(function () {});
    return score;
  }

  /* 启动时补发未成功的历史上报 */
  async function flushQueue() {
    if (!available() || broken()) return;
    const q = queueAll();
    if (!q.length) return;
    const failed=new Set();
    for (const row of q) {
      const valid = validBoardScore(row.score, row.board);
      if (valid === false) { queueClear(row.score, row.board); continue; }
      if (valid == null || failed.has(row.board)) continue;
      const r = await submit(row.score,row.board);
      if (!r.ok) failed.add(row.board); // One board's retry must not consume another board's queue.
    }
  }

  /* 榜单返回体的**防御性解包**：SDK 对云存档会把 `{items:[{key,value}]}` 解成对象，
     但排行榜是**原样透传**后端返回（toy-sdk.js 的 rank.list 只做了图片域名替换），
     官方文档没写外层结构 ⇒ 三种常见形态都接住，拿不到才当空榜。
     否则一旦平台返的是 `{list:[...]}`，玩家会看到「还没有人登顶」的假空榜。 */
  function unwrapRankList(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") {
      for (const k of ["list", "items", "ranks", "data"]) {
        if (Array.isArray(raw[k])) return raw[k];
      }
    }
    return [];
  }

  async function fetchBoard(period, value, force, attempt = 0) {
    if (!available()) return { ok: false, reason: "unavailable" };
    const board=boardFor(value);if(!board)return {ok:false,reason:'bad-board'};
    if(S.scoreSubmissions[board])await Promise.all([...S.scoreSubmissions[board]]);
    const generation=S.scoreGeneration[board]||0;
    const periodKey=period||'all',key=board+':'+periodKey;
    const hit = S.boardCache[key];
    if (!force&&hit && now() - hit.t < CACHE_MS) return { ok: true, list: hit.list, cached: true,board };
    const t = api();
    try {
      const raw = await t.getRankList({ board, period:periodKey, limit: 50 });
      const arr = unwrapRankList(raw);
      if(generation!==(S.scoreGeneration[board]||0))return attempt<2?fetchBoard(period,value,true,attempt+1):{ok:false,stale:true,reason:'stale',board};
      S.boardCache[key] = { t: now(), list: arr };
      noteOk();
      return { ok: true, list: arr,board };
    } catch (e) {
      noteFail(e);
      return { ok: false, reason: isRateLimit(e) ? "rate-limit" : "error", err: e };
    }
  }

  async function fetchMine(period, value, force, attempt = 0) {
    if (!available()) return { ok: false, reason: "unavailable" };
    const board=boardFor(value);if(!board)return {ok:false,reason:'bad-board'};
    if(S.scoreSubmissions[board])await Promise.all([...S.scoreSubmissions[board]]);
    const generation=S.scoreGeneration[board]||0;
    const key=board+':'+(period||'all'),hit=S.mineCache[key];if(!force&&hit&&now()-hit.t<CACHE_MS)return {...hit.result,cached:true};
    const t = api();
    try {
      const raw = await t.getMyRank({ board, period: period || "all" });
      /* 与榜单同理：`my` 也是原样透传 ⇒ 允许被 `data` 包一层 */
      const mine = (raw && typeof raw === "object" && raw.ranked === undefined && raw.data) ? raw.data : raw;
      noteOk();
      /* 是否上榜必须看 ranked —— 分数允许为 0 / 负 */
      const result={ ok: true, ranked: !!(mine && mine.ranked)&&Number(mine.rank)>0, rank: Math.max(0,Math.round(Number(mine&&mine.rank)||0)), score: (mine && mine.score) || 0,board };
      if(generation!==(S.scoreGeneration[board]||0))return attempt<2?fetchMine(period,value,true,attempt+1):{ok:false,stale:true,reason:'stale',board};
      S.mineCache[key]={t:now(),result};return result;
    } catch (e) {
      noteFail(e);
      return { ok: false, reason: isRateLimit(e) ? "rate-limit" : "error", err: e };
    }
  }

  /* ======================================================================
     6. 生命周期
     ====================================================================== */

/* [feature:cloud-lifecycle-snapshot] */
  function bindLifecycle() {
    if (typeof document === "undefined") return;
    const onHide = function () {
      if (document.visibilityState && document.visibilityState !== "hidden") return;
      if (S.restoring || !S.localSnapshot) return;
      try { flush(S.localSnapshot); } catch (e) {}
    };
    /* 官方最佳实践要求「页面隐藏这类关键节点落盘」；本项目此前没有任何 pagehide 保存 */
    document.addEventListener("visibilitychange", onHide);
    G.addEventListener && G.addEventListener("pagehide", onHide);
  }

/* [/feature:cloud-lifecycle-snapshot] */
  function init() {
    if (S.inited) return;
    S.inited = true;
    // Updating a Toy can leave this document without a local automatic save.
    // Check the account's cloud before any new-game/anchor/hide write replaces it.
    const save=G.GameSave;
    if(save&&save.AUTO_KEY){
      try {
        const pending = localStorage.getItem(save.AUTO_KEY + "_cloud_pending") === "1";
        const local = typeof save.load === "function" ? save.load("auto") : localStorage.getItem(save.AUTO_KEY);
        // Keep unresolved protection across reloads after a new local auto save.
        setStartupProtection(pending || !local);
      } catch (_) { setStartupProtection(true); }
    }
    bindLifecycle();
    flushQueue();
  }

  const ToyCloud = {
    init, available, hasToyId, hasSdk, inFrame, toyId,
    onLocalSaved, flush, onReviewSettled, flushQueue,
/* [feature:cloud-restore-api] */
    fetchCloudSnapshot: downloadSnapshot, forgetCloud, beginRestore, endRestore, acceptCloudRestore, errorMessage,
/* [/feature:cloud-restore-api] */
    fetchBoard, fetchMine, packScore, unpackScore, scoreCap, legalScoreCap, boardFor, unlocked, submit,
    BACKOFF: BACKOFF_MS,
    status() {
      return {
        available: available(),
        hasToy: hasSdk(),
        inFrame: inFrame(),
        /* reason 只用于诊断：no-sdk = 页面里没有 SDK（Vercel / 本地无 mock）；
           no-platform = 有 SDK 但既不在 iframe 里、平台也没注入 meta。 */
        reason: hasSdk() ? (available() ? "ok" : "no-platform") : "no-sdk",
        lastSyncAt: S.lastSyncAt, lastSyncSlim: S.lastSyncSlim,
        cloudProtected: S.startupProtected && !!S.startupRemote,
/* [feature:cloud-status-pending] */
        failStreak: S.failStreak, broken: broken(), backoffMs: backoffMs(),
        retryAfterMs: Math.max(0, S.rateLimitUntil - now()), writing: !!activeWrite, reading: !!activeRead,
/* [/feature:cloud-status-pending] */
      };
    },
    _internals: { utf8Len, sliceByBytes, hash, encodeSnapshot, decodeSnapshot, charBytes,
                  unwrapRankList,queueAll,
                  CHUNK_BYTES, MAX_CHUNK, META_KEY, CHUNK_PREFIX, BOARD, RATE_LIMIT_CODE },
  };

  G.ToyCloud = ToyCloud;
  if (typeof module !== "undefined" && module.exports) module.exports = ToyCloud;
})();
