/* ==========================================================================
   achieve_store.js —— 成就的持久层（2026-09-16 新增 · doc/35 §4.1.1）
   --------------------------------------------------------------------------
   为什么**不**塞进 game_save.js：
     `game_save.js` 的 `KEY_PREFIX = "whale_dev_v35_"` 是**按存档槽**分键的，
     而成就必须**跨存档槽共享**（用户拍板：重开新档也要在）。
     两套生命周期混在一个文件里，迟早互相污染。
   ⇒ 照 `game_save.js` 里那个独立 `STAGE_KEY` 的既有先例，**单开一个全局键**。
   --------------------------------------------------------------------------
   数据结构（v1）：
     { v:1, uid:null, updated:0, runs:0,
       unlocked: { "CROWN_SMALL": { t:毫秒, ver:"V3", week:12, verdict:"excellent", slot:"auto" } } }
   --------------------------------------------------------------------------
   ⚠️ 三条硬约束（doc/35 §8 风险 19/20/26）：
     ① localStorage 任何异常（无痕 / 被禁 / 配额满）一律**静默降级**，
        **绝不能让游戏因为存不了成就而崩**；
     ② 读到**更高的 `v`（未来版本写的）就只读不写**，防降级把高版本数据写坏；
     ③ 未解锁的**隐藏**成就走 `view()` 时必须**脱敏**（名字/描述根本不发到前端）。
   ========================================================================== */
(function () {
  "use strict";

  var KEY = "whale_dev_v35_achv";
  var SCHEMA = 1;

  /* localStorage 可能整个不可用（无痕模式 / 被策略禁掉）——
     探一次，拿不到就退回内存实现（= 成就只活在本次会话，不崩） */
  var LS = (function () {
    try {
      var k = "__xj_probe__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return window.localStorage;
    } catch (e) {
      return null;
    }
  })();
  var MEM = null;                 // LS 不可用时的内存兜底

  function emptyData() { return { v: SCHEMA, uid: null, updated: 0, runs: 0, unlocked: {} }; }

  /* 把任意来源的脏数据洗成合法结构（缺字段补默认、类型不对就丢掉） */
  function sanitize(raw) {
    var out = emptyData();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    var n = Number(raw.v);
    out.v = isFinite(n) ? n : SCHEMA;
    out.uid = (typeof raw.uid === "string" && raw.uid) ? raw.uid : null;
    out.updated = isFinite(Number(raw.updated)) ? Number(raw.updated) : 0;
    out.runs = isFinite(Number(raw.runs)) ? Math.max(0, Math.floor(Number(raw.runs))) : 0;
    var u = raw.unlocked;
    if (u && typeof u === "object" && !Array.isArray(u)) {
      Object.keys(u).forEach(function (k) {
        var r = u[k];
        if (!r || typeof r !== "object") return;
        var t = Number(r.t);
        if (!isFinite(t) || t <= 0) return;               // 没有合法解锁时间的记录视为脏数据
        out.unlocked[k] = {
          t: t,
          ver: typeof r.ver === "string" ? r.ver : "",
          week: isFinite(Number(r.week)) ? Number(r.week) : 0,
          verdict: typeof r.verdict === "string" ? r.verdict : "",
          slot: typeof r.slot === "string" ? r.slot : "",
        };
      });
    }
    return out;
  }

  var _cache = null;
  var _readonly = false;          // 读到未来版本的 `v` ⇒ 只读

  function load() {
    if (_cache) return _cache;
    var raw = null;
    if (LS) {
      try { raw = LS.getItem(KEY); } catch (e) { raw = null; }
    } else if (MEM) {
      raw = MEM;
    }
    var parsed = null;
    if (typeof raw === "string" && raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }   // 损坏的 JSON：当空，不抛
    }
    _cache = sanitize(parsed);
    _readonly = _cache.v > SCHEMA;
    if (_readonly && typeof console !== "undefined" && console.warn) {
      console.warn("[成就] 存储结构版本 v" + _cache.v + " 高于本程序支持的 v" + SCHEMA + " ⇒ 本次只读，不写回");
    }
    return _cache;
  }

  function flush() {
    if (_readonly) return false;
    if (!_cache) return false;
    _cache.updated = Date.now();
    var str;
    try { str = JSON.stringify(_cache); } catch (e) { return false; }
    if (LS) {
      try { LS.setItem(KEY, str); return true; }
      catch (e) { return false; }        // 配额满 / 隐私模式：静默失败，游戏照跑
    }
    MEM = str;
    return true;
  }

  var AchieveStore = {
    KEY: KEY,
    SCHEMA: SCHEMA,
    /* 测试与调试用：存储是否真的可用（不可用时成就只活在本次会话） */
    persistent: function () { return !!LS; },

    /* Register once per save API; the normal save result/error remains untouched. */
    observe: function (core) {
      var save = window.GameSave;
      if (!save || (typeof save.autoSave !== "function" && typeof save.save !== "function")) return false;
      if (!save.__lifeAchievementObserver) {
        var observer = {core:core, depth:0};
        ["autoSave", "save"].forEach(function (method) {
          var original = save[method];
          if (typeof original !== "function") return;
          save[method] = function () {
            var state = arguments[method === "save" ? 1 : 0], current = observer.core;
            observer.depth++;
            try {
              if (observer.depth === 1 && current && state === current.state && typeof current.checkLifeAchievements === "function") {
                try { current.checkLifeAchievements(); } catch (e) { console.warn("[ACHV] save backfill", e); }
              }
              return original.apply(this, arguments);
            } finally { observer.depth--; }
          };
        });
        save.__lifeAchievementObserver = observer;
      }
      save.__lifeAchievementObserver.core = core;
      return true;
    },

    has: function (key) { return !!load().unlocked[key]; },
    get: function (key) { return load().unlocked[key] || null; },
    records: function () { return load().unlocked; },

    /* 单条解锁：**幂等** —— 已存在则保留原 `t`（不刷新解锁时间） */
    unlock: function (key, meta) {
      var d = load();
      if (d.unlocked[key]) return false;
      meta = meta || {};
      var t = Number(meta.t);
      d.unlocked[key] = {
        t: (isFinite(t) && t > 0) ? t : Date.now(),
        ver: typeof meta.ver === "string" ? meta.ver : "",
        week: isFinite(Number(meta.week)) ? Number(meta.week) : 0,
        verdict: typeof meta.verdict === "string" ? meta.verdict : "",
        slot: typeof meta.slot === "string" ? meta.slot : "",
      };
      flush();
      return true;
    },

    /* 批量解锁；返回**本次真正新解锁**的 key 数组（顺序与传入一致） */
    unlockMany: function (keys, meta) {
      var newly = [];
      (keys || []).forEach(function (k) {
        if (AchieveStore.unlock(k, meta)) newly.push(k);
      });
      return newly;
    },

    /* 成就墙数据源：配置 × 解锁记录 的合并视图
       ⚠️ 未解锁的**隐藏**成就必须在这里脱敏 —— DOM 里不许出现名字/描述。
          （不是靠 CSS 藏：玩家一按 F12 就能看到，隐藏成就就成了笑话） */
    view: function (cfgList) {
      var d = load();
      return (cfgList || []).map(function (a) {
        if (!a || !a.key) return null;
        var rec = d.unlocked[a.key] || null;
        var on = !!rec;
        var masked = !!a.hidden && !on;                 // 未解锁的隐藏成就：全脱敏
        return {
          key: a.key,
          no: a.no,
          rarity: a.rarity || "普通",
          cat: masked ? "" : (a.cat || ""),
          hidden: !!a.hidden,
          locked: !on,
          name: masked ? "？？？" : (a.name || ""),
          desc: masked ? "" : (a.desc || ""),
          img: on ? (a.img || "") : "",                 // 未解锁不加载配图（省流量 + 不剧透）
          imgAlt: on ? (a.imgAlt || "") : "",
          t: on ? rec.t : 0,
          ver: on ? rec.ver : "",
          week: on ? rec.week : 0,
          verdict: on ? rec.verdict : "",
        };
      }).filter(Boolean);
    },

    stats: function (cfgList) {
      var d = load();
      var got = 0;
      var byRarity = {};
      (cfgList || []).forEach(function (a) {
        if (!a || !a.key) return;
        var r = a.rarity || "普通";
        if (!byRarity[r]) byRarity[r] = { got: 0, total: 0 };
        byRarity[r].total++;
        if (d.unlocked[a.key]) { byRarity[r].got++; got++; }
      });
      return { got: got, total: (cfgList || []).length, byRarity: byRarity };
    },

    /* ---------------- 云存档 / 账号登录接口（v1 只留接口，不做实现） ----------------
       doc/35 §7.1 #10：将来接云时**只加传输层，不动解锁逻辑与 UI**。
       ⇒ 这里把"导出 / 合并语义"定死：并集合并，**解锁时间取更早的那个**（谁先解锁算谁的）。 */
    exportCloud: function () {
      var d = load();
      return { v: d.v, uid: d.uid, updated: d.updated, runs: d.runs, unlocked: JSON.parse(JSON.stringify(d.unlocked)) };
    },
    merge: function (cloud) {
      if (!cloud || typeof cloud !== "object") return [];
      var cs = sanitize(cloud);
      var d = load();
      var added = [];
      Object.keys(cs.unlocked).forEach(function (k) {
        var mine = d.unlocked[k];
        var theirs = cs.unlocked[k];
        if (!mine) { d.unlocked[k] = theirs; added.push(k); return; }
        if (theirs.t && theirs.t < mine.t) d.unlocked[k] = theirs;   // 取更早
      });
      d.runs = Math.max(d.runs, cs.runs);
      flush();
      return added;
    },
    setUid: function (id) {
      var d = load();
      d.uid = (typeof id === "string" && id) ? id : null;
      flush();
      return d.uid;
    },

    /* 调试 / 作弊器用；**不进任何玩家可达的 UI** */
    reset: function () {
      _cache = emptyData();
      _readonly = false;
      if (LS) { try { LS.removeItem(KEY); } catch (e) {} }
      MEM = null;
      flush();
      return true;
    },

    /* 测试用：丢弃内存缓存，强制下次从 storage 重读 */
    _reload: function () { _cache = null; _readonly = false; return load(); },
  };

  window.AchieveStore = AchieveStore;
})();
