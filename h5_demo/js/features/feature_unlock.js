/* Shared data-driven optional feature conditions; unknown conditions stay locked. */
(function () {
  "use strict";
  if (window.FeatureUnlock) return;
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  function meets(core, unlock, outfitId) {
    if (!core || !core.cfg || !core.state) return false;
    const condition = unlock || {}, state = core.state, care = state.care || {};
    if (Object.keys(condition).some(key => !["stage", "week", "affection", "outfit", "chat", "event", "follow", "videoTriple", "videoBvid"].includes(key))) return false;
    if (Object.prototype.hasOwnProperty.call(condition, "follow") && condition.follow !== true && condition.follow !== false) return false;
    if (Object.prototype.hasOwnProperty.call(condition, "videoTriple") && condition.videoTriple !== true && condition.videoTriple !== false) return false;
    if ((condition.follow === true || condition.videoTriple === true) && !(window.FollowOutfit && window.FollowOutfit.owned(core, outfitId))) return false;
    const order = core.cfg.VER_ORDER || [];
    if (condition.stage && (order.indexOf(condition.stage) < 0 || order.indexOf(state.ver) < order.indexOf(condition.stage))) return false;
    if (condition.week && number(state.week) + number(state.weekOffset) < number(condition.week)) return false;
    if (condition.affection && number(care.lvl) < number(condition.affection)) return false;
    if (condition.outfit && !(care.unlocked || []).includes("outfit:" + condition.outfit)) return false;
    if (condition.chat && !(care.events || {}).chat) return false;
    if (condition.event && !(care.events || {})[condition.event]) return false;
    return true;
  }
  function describe(condition) {
    const unlock = condition || {}, parts = [];
    if (unlock.stage) parts.push("达到 " + unlock.stage);
    if (unlock.week) parts.push("累计 " + unlock.week + " 周");
    if (unlock.affection) parts.push("好感 Lv." + unlock.affection);
    if (unlock.outfit) parts.push("解锁衣服 " + unlock.outfit);
    if (unlock.chat) parts.push("打开测试聊天");
    if (unlock.event) parts.push("经历 " + unlock.event);
    if (unlock.follow) parts.push("关注作者后领取");
    if (unlock.videoTriple) parts.push(unlock.videoBvid ? "指定视频三连后领取" : "指定视频待配置 · 暂不开放领取");
    return parts.join(" · ") || "随时可用";
  }
  window.FeatureUnlock = { meets, describe };
})();
