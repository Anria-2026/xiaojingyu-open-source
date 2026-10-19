/* Account rewards live in their own Toy cloud key, never in the ordinary save. */
(function () {
  "use strict";
  const G = window;
  if (G.FollowOutfit) return;
  const KEY = "whale_follow_outfits_v1", REQUEST_MS = 12000;
  let session = null, epoch = 0, lastCore = null;
  const rows = core => core && core.cfg && Array.isArray(core.cfg.WHALE_OUTFITS) ? core.cfg.WHALE_OUTFITS : [];
  const interactive = row => !!(row && row.unlock && (row.unlock.follow === true || row.unlock.videoTriple === true));
  const eligible = (core, id) => rows(core).find(row => row.id === id && row.enabled !== false && interactive(row));
  const validBvid = value => typeof value === "string" && /^BV[0-9A-Za-z]{10}$/.test(value);
  const configured = core => !!(core && core.state && core.cfg && core.cfg.WHALE_CARE && core.cfg.WHALE_CARE.ENABLED !== false);
  const alive = () => !!G.document && G.closed !== true;
  const hidden = () => !!(G.document && G.document.hidden);
  function platform() {
    try { return !!(G.parent && G.parent !== G) || Number(G.__TOY_META__ && G.__TOY_META__.toy_id) > 0; }
    catch (_) { return false; }
  }
  function problem(reason) { const error = new Error(reason); error.rewardReason = reason; return error; }
  function reason(error) {
    if (error && error.rewardReason) return error.rewardReason;
    if (error && ["unauthorized","unsupported","denied","toy_context_unavailable","author_mismatch","video_not_found","video_invisible","unavailable","invalid_argument"].includes(error.type)) return error.type;
    const text = String(error && error.type || "") + " " + String(error && error.message || "");
    const code = Number(error && (error.code != null ? error.code : error.data && error.data.code));
    if (code === -101 || code === 401 || /unauthorized|not.?login|login.required|未登录/i.test(text)) return "unauthorized";
    if (/unsupported/i.test(text)) return "unsupported";
    if (code === 307044) return "rate-limit";
    return "network";
  }
  function tip(code) {
    return ({
      "no-sdk": "请在 B站 Toy 中打开游戏后领取。",
      "no-platform": "请从 B站 Toy 入口打开游戏后领取。",
      unauthorized: "请先登录 B站账号，再回来核验领取。",
      unsupported: "当前环境不支持互动核验，请在 B站 App 中打开游戏。",
      "toy_context_unavailable": "暂时无法连接 Toy，请重新打开游戏后重试。",
      denied: "未获得平台授权，请重新打开游戏后重试。",
      unavailable: "B站服务暂时不可用，请稍后重试。",
      "rate-limit": "核验请求较多，请稍后重试。",
      timeout: "平台响应超时，请检查网络后重试。",
      "invalid-record": "领取记录暂时无法读取，请稍后重试。",
      "not-following": "还未检测到关注。关注作者后，请回来点击核验领取。",
      "not-triple": "还未检测到完整三连。请为指定视频点赞、投币至少一枚并收藏，再回来核验领取。",
      "video-unconfigured": "指定视频尚未配置，这套时装暂不开放领取；可以先预览。",
      "author_mismatch": "指定视频不属于当前 Toy 作者，暂时无法核验，请等待作者调整配置。",
      "video_not_found": "指定视频不存在，请等待作者调整配置。",
      "video_invisible": "指定视频暂不可见，请稍后重试。",
      "invalid_argument": "指定视频配置无效，请等待作者调整配置。",
      "game-condition": "还未满足这套时装的游戏解锁条件。",
      "invalid-outfit": "这套装扮暂时无法领取。",
      "invalid-author": "作者入口尚未配置，请稍后重试。",
      "navigation-blocked": "浏览器阻止了跳转。进度已保存，请允许打开新页面后重试。",
      save: "自动保存失败，请检查浏览器存储空间。进度保存成功后才能前往 B站。",
      busy: "正在核验，请稍候。",
      network: "网络连接失败，请稍后重试。",
    })[code] || "互动核验暂时失败，请稍后重试。";
  }
  function sdk(method) {
    if (!G.toy) throw problem("no-sdk");
    if (!platform()) throw problem("no-platform");
    if (typeof G.toy[method] !== "function") throw problem("unsupported");
    return G.toy;
  }
  function request(run) {
    let result;
    try { result = run(); } catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(problem("timeout")), REQUEST_MS);
      Promise.resolve(result).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
  }
  function valid(token) { return alive() && session === token && token.epoch === epoch && token.core.state === token.state && !hidden(); }
  function notify(core) {
    if (!alive()) return;
    if (G.WhaleCare && core && core.state) G.WhaleCare.ensure(core);
    if (G.GameBus) G.GameBus.emit("follow-outfit:changed", {});
  }
  function reset(core) {
    const previous = session && session.core;
    epoch++;
    session = configured(core) ? { core, state: core.state, epoch, owned: new Set(), phase: "idle", reason: "", tip: "", pending: null, navigation: null } : null;
    if (core) lastCore = core;
    if (previous && previous !== core) notify(previous);
    if (core) notify(core);
    return session;
  }
  function owned(core, id) {
    return !!(session && valid(session) && session.core === core && (!id ? session.owned.size : eligible(core, id) && session.owned.has(id)));
  }
  function status(core) {
    if (!session || !valid(session) || session.core !== core) return { phase: "idle", busy: false, tip: "" };
    return { phase: session.phase, busy: !!(session.pending || session.navigation), reason: session.reason, tip: session.tip };
  }
  function readRecord(record) {
    if (!record || typeof record !== "object" || Array.isArray(record) || Object.values(record).some(value => typeof value !== "string")) throw problem("invalid-record");
    if (!Object.prototype.hasOwnProperty.call(record, KEY)) return [];
    let value;
    try { value = JSON.parse(record[KEY]); } catch (_) { throw problem("invalid-record"); }
    if (!value || value.schema !== 1 || !Array.isArray(value.outfits) || value.outfits.some(id => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) throw problem("invalid-record");
    return [...new Set(value.outfits)];
  }
  function fail(token, error) {
    if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
    token.phase = "error"; token.reason = reason(error); token.tip = tip(token.reason);
    return { ok: false, reason: token.reason, tip: token.tip };
  }
  function finish(token) {
    if (session === token && token.epoch === epoch) { token.pending = null; if(valid(token))notify(token.core); }
  }
  function sync(core) {
    const token = reset(core);
    if (!token || hidden()) return Promise.resolve({ ok: false, reason: "stale", tip: "" });
    token.phase = "loading"; token.tip = "正在读取领取记录…";
    token.pending = Promise.resolve().then(async () => {
      try {
        if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
        const t = sdk("getCloudStorage"), record = await request(() => t.getCloudStorage([KEY]));
        if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
        token.owned = new Set(readRecord(record)); token.phase = "ready"; token.tip = "";
        return { ok: true, restored: token.owned.size > 0 };
      } catch (error) { return fail(token, error); }
      finally { finish(token); }
    });
    notify(core);
    return token.pending;
  }
  function claim(core, id) {
    const row = eligible(core, id);
    if (!row || !configured(core)) return Promise.resolve({ ok: false, reason: "invalid-outfit", tip: tip("invalid-outfit") });
    const unlock = { ...row.unlock }, bvid = unlock.videoBvid;
    if (["follow","videoTriple"].some(key => Object.prototype.hasOwnProperty.call(unlock,key) && typeof unlock[key] !== "boolean")) return Promise.resolve({ ok:false, reason:"invalid-outfit", tip:tip("invalid-outfit") });
    if (unlock.videoTriple === true && !validBvid(bvid)) return Promise.resolve({ ok: false, reason: "video-unconfigured", tip: tip("video-unconfigured") });
    const ordinary = { ...unlock, follow: false, videoTriple: false }; delete ordinary.videoBvid;
    if (!G.FeatureUnlock || !G.FeatureUnlock.meets(core, ordinary)) return Promise.resolve({ ok: false, reason: "game-condition", tip: tip("game-condition") });
    if (!session || !valid(session) || session.core !== core) reset(core);
    const token = session;
    if (token.pending || token.navigation) return Promise.resolve({ ok: false, reason: "busy", tip: tip("busy") });
    // Always start with the current account's scoped cloud record. An old local
    // unlocked array or a previous account's in-memory result is never proof.
    token.owned.clear(); token.phase = "checking"; token.reason = ""; token.tip = unlock.videoTriple ? "正在核验三连…" : "正在核验关注…";
    token.pending = Promise.resolve().then(async () => {
      try {
        if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
        const t = sdk("getCloudStorage");
        const record = await request(() => t.getCloudStorage([KEY]));
        if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
        const claimed = readRecord(record);
        // This read already proves the current account's earlier receipts.
        // A failed attempt for a different outfit must keep those receipts.
        token.owned = new Set(claimed);
        if (!claimed.includes(id)) {
          sdk("setCloudStorage");
          if (unlock.follow === true) {
            sdk("getAuthorRelation");
            const relation = await request(() => t.getAuthorRelation());
            if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
            if (!relation || relation.status !== "ok") throw problem(relation && relation.status || "unavailable");
            if (!relation.data || relation.data.isFollowing !== true) throw problem("not-following");
          }
          if (unlock.videoTriple === true) {
            sdk("getVideoUserActions");
            if (typeof t.isSupport === "function" && await request(() => t.isSupport("getVideoUserActions")) !== true) throw problem("unsupported");
            if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
            const result = await request(() => t.getVideoUserActions({ videos: [{ bvid }] }));
            if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
            if (!result || result.status !== "ok") throw problem(result && result.status || "unavailable");
            const items = Array.isArray(result.items) ? result.items.filter(item => item && item.bvid === bvid) : [];
            if (items.length !== 1) throw problem("unavailable");
            const item = items[0];
            if (item.status !== "ok") throw problem(item.status || "unavailable");
            if (item.ref && item.ref.bvid != null && item.ref.bvid !== bvid) throw problem("unavailable");
            if (item.liked !== true || typeof item.coinCount !== "number" || !Number.isFinite(item.coinCount) || item.coinCount < 1 || item.favorited !== true) throw problem("not-triple");
          }
          if (!valid(token) || JSON.stringify(eligible(core, id)?.unlock) !== JSON.stringify(unlock)) return { ok: false, reason: "stale", tip: "" };
          claimed.push(id);
          await request(() => t.setCloudStorage({ [KEY]: JSON.stringify({ schema: 1, outfits: claimed.sort() }) }));
          if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
        }
        token.owned = new Set(claimed); token.phase = "ready"; token.tip = "已领取，快换上这套新装扮吧。";
        return { ok: true, tip: token.tip };
      } catch (error) { return fail(token, error); }
      finally { finish(token); }
    });
    notify(core);
    return token.pending;
  }
  function cancel(core) {
    if (!session || session.core !== core || !(session.pending || session.navigation)) return;
    epoch++; session.epoch = epoch; session.pending = null; session.navigation = null; session.phase = "idle"; session.tip = "";
    // Invalidate the captured object as well as its epoch: late callbacks from
    // the closed panel cannot overwrite a subsequent request in this session.
    session = { ...session, owned: new Set(session.owned) };
    notify(core);
  }
  function preserve(core) {
    const ui = G.GameUI, save = ui && ui.core === core && ui.save || G.GameSave;
    if (!core || !core.state || !save || typeof save.autoSave !== "function") return false;
    try {
      const snapshot = save.autoSave(core.state);
      if (!snapshot) return false;
      // Start the forced cloud flush without awaiting it. navigate still runs
      // directly in the same user gesture, after the synchronous local write.
      try {
        const pending = typeof save._notifyCloud === "function" ? save._notifyCloud("auto", snapshot, true)
          : G.ToyCloud && typeof G.ToyCloud.flush === "function" ? G.ToyCloud.flush(snapshot) : null;
        if (pending && typeof pending.catch === "function") pending.catch(() => {});
      } catch (_) {}
      return true;
    } catch (_) { return false; }
  }
  function navigate(core, id, target = "space") {
    const uid = String(core && core.cfg && core.cfg.WHALE_CARE && core.cfg.WHALE_CARE.FOLLOW_AUTHOR_UID || "");
    const row = target === "video" ? eligible(core, id) : null, bvid = row && row.unlock.videoBvid;
    if (target === "video" && (!row || row.unlock.videoTriple !== true || !validBvid(bvid))) return Promise.resolve({ ok: false, reason: "video-unconfigured", tip: tip("video-unconfigured") });
    if (target !== "video" && !/^[1-9][0-9]{0,19}$/.test(uid)) return Promise.resolve({ ok: false, reason: "invalid-author", tip: tip("invalid-author") });
    if (!configured(core)) return Promise.resolve({ ok: false, reason: "invalid-outfit", tip: tip("invalid-outfit") });
    if (!session || !valid(session) || session.core !== core) reset(core);
    const token = session;
    if (token.pending || token.navigation) return Promise.resolve({ ok: false, reason: "busy", tip: tip("busy") });
    const localMock = !!G.__TOY_MOCK__ && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(G.location && G.location.hostname || "");
    const browser = localMock || !platform();
    let t;
    if (!browser) try { t = sdk("navigate"); } catch (error) { return Promise.resolve(fail(token, error)); }
    if (!preserve(core)) return Promise.resolve(fail(token, problem("save")));
    const message = target === "video" ? "进度已自动保存。完成指定视频三连后回到游戏，点击核验领取即可。" : "进度已自动保存。关注后回到游戏，点击核验领取即可。";
    if (G.GameUI && typeof G.GameUI.toast === "function") G.GameUI.toast(message);
    token.phase = "navigating"; token.tip = message;
    token.navigation = request(() => {
      if (!browser) return t.navigate({ type: target === "video" ? "video" : "space", id: target === "video" ? bvid : uid });
      // The localhost SDK shim deliberately has an empty navigate method.
      // Open a real HTTPS destination in this original gesture instead; if
      // the host denies another tab, the current-page fallback is already saved.
      const url = target === "video" ? "https://www.bilibili.com/video/" + bvid : "https://space.bilibili.com/" + uid;
      let opened;
      try { opened = G.open(url, "_blank"); } catch (_) {}
      if (opened) { try { opened.opener = null; } catch (_) {} }
      else {
        if (G.GameUI && typeof G.GameUI.toast === "function") G.GameUI.toast("新窗口未打开，进度已保存，将在当前页面前往 B站。");
        try { G.location.assign(url); } catch (_) { throw problem("navigation-blocked"); }
      }
    }).then(() => {
      if (!valid(token)) return { ok: false, reason: "stale", tip: "" };
      token.phase = "ready"; return { ok: true, tip: message };
    }, error => fail(token, error)).finally(() => {
      if (session === token && token.epoch === epoch) { token.navigation = null; if(valid(token))notify(core); }
    });
    notify(core);
    return token.navigation;
  }
  function currentCore() { return G.GameUI && G.GameUI.core || lastCore; }
  function leave() { const core = currentCore(); preserve(core); reset(core); }
  function resume() {
    const core = currentCore();
    if (!hidden() && configured(core) && rows(core).some(interactive)) sync(core);
  }
  G.FollowOutfit = { sync, reset, cancel, claim, navigate, navigateVideo:(core,id)=>navigate(core,id,"video"), owned, status, preserve, validBvid, interactive, KEY };
  if (G.document && typeof G.document.addEventListener === "function") G.document.addEventListener("visibilitychange", () => hidden() ? leave() : resume());
  if (typeof G.addEventListener === "function") {
    G.addEventListener("pagehide", leave);
    G.addEventListener("pageshow", resume);
    G.addEventListener("focus", resume);
  }
})();
