/* ==========================================================================
   Toy API Mock —— **仅 localhost 注入**，用于在发布前验证云存档 / 排行榜全链路
   --------------------------------------------------------------------------
   为什么需要它：平台的云存档与排行榜接口在 SDK 内部先取 toy_id，而 toy_id
   只在**正式发布页面**注入，预览页没有 → 这批代码在真实 Toy 环境里发布前
   根本调不通。没有这个 mock 就只能盲发。
   · 严格复刻平台硬约束：value ≤1024 **字节**、单 Toy ≤128 个 key、
     key 只能 [A-Za-z0-9_-] 且不能以 __ 开头、score 只保留历史最高分
     —— 违反就直接抛错，让本地测试能提前抓到越界
   · 提供 __TOY_MOCK__ 控制台工具：注入限流、转储、重置
   · 打包发布时必须排除本文件（部署B站Toy测试页.bat 已按 *.bat/*.js 规则处理，
     注意核对预检输出）
   ========================================================================== */
"use strict";

(function () {
  var host = location.hostname;
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) return;   // 只在本机生效

  var NS = "whale_toy_mock_";
  var MAX_KEYS = 128;      // 平台：单 Toy 最多 128 个 key-value
  var MAX_VAL_BYTES = 1024; // 平台：value ≤1024 字节
  var KEY_RE = /^[A-Za-z0-9_-]{1,128}$/;

  /* ---------- 内部存储（localStorage，跨刷新保留，便于测恢复） ---------- */
  function store() {
    try { return JSON.parse(localStorage.getItem(NS + "kv") || "{}"); } catch (e) { return {}; }
  }
  function saveStore(o) {
    try { localStorage.setItem(NS + "kv", JSON.stringify(o)); } catch (e) {}
  }
  function ranks() {
    try { return JSON.parse(localStorage.getItem(NS + "rank") || "{}"); } catch (e) { return {}; }
  }
  function saveRanks(o) {
    try { localStorage.setItem(NS + "rank", JSON.stringify(o)); } catch (e) {}
  }

  function bytes(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i++; }   // 代理对
      else n += 3;
    }
    return n;
  }

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  /* 模拟网络延迟 + 可选限流，让退避/熔断逻辑真的被测到 */
  var ctl = { rateLimit: false, latency: 30, failNext: 0, calls: 0 };
  function tick() {
    ctl.calls++;
    return new Promise(function (res, rej) {
      setTimeout(function () {
        if (ctl.failNext > 0) { ctl.failNext--; var e1 = new Error("mock failure"); e1.code = 500; return rej(e1); }
        if (ctl.rateLimit) { var e2 = new Error("请求过于频繁，请稍后再试"); e2.code = 307044; e2.type = "http_error"; return rej(e2); }
        res();
      }, ctl.latency);
    });
  }

  /* ---------- 假榜单：预置几条，便于看空态以外的表现 ----------
     ⚠️ score 必须用与 ToyCloud.packScore 相同的打包口径，否则 UI 解出来的
    「评审分 / 周数」会是乱的（packed = 评审分×10 × 1000 + (999 - V4.5 周数)）。
     数值量级要贴近真实：V4.5 总评实测 669.5（维度上限 640 × 参数倍率 1.7 = 1088）。
     下面这几条对应：892.4分/12周、855.0分/14周、804.6分/9周、748.2分/11周、669.5分/20周。 */
  var SEED = [
    { score: 8924987, nickname: "墨鱼丸", avatar: "//i0.hdslb.com/bfs/face/mock1.jpg" },
    { score: 8550985, nickname: "深海鲸落", avatar: "//i0.hdslb.com/bfs/face/mock2.jpg" },
    { score: 8046990, nickname: "梁文峰的猫", avatar: "//i0.hdslb.com/bfs/face/mock3.jpg" },
    { score: 7482988, nickname: "摸鱼冠军", avatar: "//i0.hdslb.com/bfs/face/mock4.jpg" },
    { score: 6695979, nickname: "刚上岸", avatar: "//i0.hdslb.com/bfs/face/mock5.jpg" },
  ];

  var ME = { nickname: "你（本机测试）", avatar: "//i0.hdslb.com/bfs/face/mockme.jpg" };

  window.__TOY_META__ = { toy_id: 999000001 };   // 必须是正整数，否则 SDK 侧会判为不可用

  window.toy = {
    isSupport: function () { return tick().then(function () { return true; }); },

    setCloudStorage: function (items) {
      return tick().then(function () {
        var kv = store();
        var keys = Object.keys(items || {});
        /* 先整体校验，避免写一半才失败 */
        keys.forEach(function (k) {
          if (!KEY_RE.test(k)) throw new Error("invalid cloud storage key: " + k);
          if (k.indexOf("__") === 0) throw new Error("cloud storage key is reserved: " + k);
          var v = items[k];
          if (typeof v !== "string") throw new Error("cloud storage value must be a string: " + k);
          if (bytes(v) > MAX_VAL_BYTES) throw new Error("cloud storage value exceeds " + MAX_VAL_BYTES + " bytes: " + k + " = " + bytes(v));
        });
        var total = Object.keys(kv).length;
        var add = keys.filter(function (k) { return kv[k] === undefined; }).length;
        if (total + add > MAX_KEYS) throw new Error("too many cloud storage keys: " + (total + add) + " > " + MAX_KEYS);
        keys.forEach(function (k) { kv[k] = items[k]; });
        saveStore(kv);
      });
    },

    getCloudStorage: function (keys) {
      return tick().then(function () {
        var kv = store(), out = {};
        if (!keys || !keys.length) { Object.assign(out, kv); return out; }
        keys.forEach(function (k) { if (kv[k] !== undefined) out[k] = kv[k]; });
        return out;
      });
    },

    removeCloudStorage: function (keys) {
      return tick().then(function () {
        var kv = store();
        (keys || []).forEach(function (k) { delete kv[k]; });
        saveStore(kv);
      });
    },

    submitScore: function (req) {
      return tick().then(function () {
        var score = Number(req && req.score) || 0;
        if (score < -16777216 || score > 16777215) throw new Error("score out of range: " + score);
        var r = ranks();
        var cur = r[req.board || 1];
        /* 平台语义：只保留历史最高分，低分不覆盖 */
        if (!cur || score > cur) r[req.board || 1] = score;
        saveRanks(r);
        return { score: r[req.board || 1] };
      });
    },

    getRankList: function (req) {
      return tick().then(function () {
        var board = (req && req.board) || 1;
        var limit = (req && req.limit) || 50;
        var mine = ranks()[board];
        var list = SEED.slice();
        if (mine !== undefined) {
          list.push({ score: mine, nickname: ME.nickname, avatar: ME.avatar, me: true });
        }
        list.sort(function (a, b) { return b.score - a.score; });
        return list.slice(0, limit).map(function (it, i) {
          return { rank: i + 1, score: it.score, nickname: it.nickname, avatar: it.avatar };
        });
      });
    },

    getMyRank: function (req) {
      return tick().then(function () {
        var board = (req && req.board) || 1;
        var mine = ranks()[board];
        if (mine === undefined) return { ranked: false, rank: 0, score: 0 };
        var higher = SEED.filter(function (x) { return x.score > mine; }).length;
        return { ranked: true, rank: higher + 1, score: mine };
      });
    },

    /* 其余能力给个空实现，避免页面上误报 not a function */
    navigate: function () { return tick(); },
    getQrCode: function () { return tick().then(function () { return { base64: "", url: "" }; }); },
    getUserProfile: function () { return tick().then(function () { return { avatar: ME.avatar, nickname: ME.nickname }; }); },
    getAuthorProfile: function () { return tick().then(function () { return { status: "ok", data: {} }; }); },
    onContainerChange: function () { return function () {}; },
  };

  /* ---------- 控制台工具 ---------- */
  window.__TOY_MOCK__ = {
    ctl: ctl,
    reset: function () {
      localStorage.removeItem(NS + "kv");
      localStorage.removeItem(NS + "rank");
      ctl.rateLimit = false; ctl.failNext = 0; ctl.calls = 0;
      console.log("[toy-mock] 已重置（云存档 + 排行榜 + 调用计数）");
    },
    dump: function () { return { kv: store(), rank: ranks(), calls: ctl.calls }; },
    rateLimit: function (on) { ctl.rateLimit = on !== false; console.log("[toy-mock] 限流注入 =", ctl.rateLimit); },
    failNext: function (n) { ctl.failNext = Number(n) || 1; console.log("[toy-mock] 接下来", ctl.failNext, "次调用会失败"); },
    bytes: bytes,
  };

  console.log("[toy-mock] 已注入：window.toy 可用；用 __TOY_MOCK__.dump() 查看，__TOY_MOCK__.reset() 清空");
})();