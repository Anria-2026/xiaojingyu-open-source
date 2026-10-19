/* ==========================================================================
   v35_hire_ui.js —— 扩编招聘面板（游戏发展国模式）
   提供：左列按钮定义 + 面板 HTML（岗位选择 / 寻访进度）
   用法：V35HireUI.action() 给 officeActions；V35HireUI.panel(ui) 给 officeModalBody
   交互：data-action="hire-order" data-role=...
   2026-09-07（用户拍板）：**候选人不再出现在这个面板**。找到的人以完整档案进
   「招聘」页的候选人列表（s.candidates），左侧「招聘」按钮徽标 +1，玩家去那里录用。
   这里只负责：发布需求 → 显示寻访进度。
   ========================================================================== */
"use strict";
window.V35HireUI = {
  action: function () { return { key: "hire", icon: "briefcase", label: "扩编" }; },

  panel: function (ui) {
    var s = ui.core.state;
    var c = ui.core.cfg;
    /* 与发布校验共用允许岗位：V5 起包含具身智能，旧阶段不提前开放。 */
    var HR = window.V35Hire ? window.V35Hire.roles(ui.core) : Object.assign({}, (c.V35 && c.V35.HIRE_ROLES) || {});
    if (!ui.core.embodiedAvailable || !ui.core.embodiedAvailable()) delete HR.embodied;
    var order = s.hireOrder;
    var v35on = ui.core.v35On && ui.core.v35On();
    // 包一层 .om-empty：与 omEmpty 空态同构，才能吃到「空态整体居中」的居中规则
    if (!v35on) return '<div class="om-empty"><div class="om-empty-tip">（当前版本无需扩编）</div></div>';
    /* V3.5.3：面板只显示等待周数；概率/薪资仍在配置里（引擎内部使用），不在 UI 上展示 */
    var labels = { pretrain: "预训练工程师", data: "数据工程师", post: "后训练工程师", embodied: "具身智能工程师" };
    var roles = Object.keys(HR).map(function (key) {
      return { key: key, label: HR[key].label || labels[key] || key, wait: HR[key].waitMin || [3, 3] };
    });

    /* 反抽卡（doc/22 §7）：发布需求要花钱，费用直接写在按钮上。
       2026-09-07（用户拍板）：**一次需求可以同时要多个岗位** —— 岗位卡是可勾选的，
       底部按钮一次性发布勾选的全部岗位（勾三类 = 三类同时找）。 */
    var cost = c.RECRUIT_COST || 0;
    var all = roles.map(function (r) { return r.key; });
    if (!Array.isArray(ui._hireRoles)) ui._hireRoles = [];
    var sel = ui._hireRoles.filter(function (k) { return all.indexOf(k) >= 0; });
    ui._hireRoles = sel;
    /* 多选消耗叠加（2026-09-08 用户拍板）：勾 N 个岗位 → 发布费 × N */
    var totalCost = cost * Math.max(1, sel.length);
    var costTxt = totalCost > 0 ? ' · ' + Math.round(totalCost / 10000) + ' 万' : '';
    var poor = totalCost > 0 && (s.funding || 0) < totalCost;

    /* 等待录用的人选（扩编找到 + 事件刷出）都在「招聘」页，这里给个指路 */
    var waiting = (s.candidates || []).length;
    var hint = waiting > 0
      ? '<div class="hire-note">📋 有 ' + waiting + ' 位人选在「招聘」页等你面试，点击左侧「招聘」查看（人选有时效，别拖太久）</div>'
      : '';
    /* 2026-09-12（用户实测「招聘可超出配置的人数上限」）：编制满了就别让他再花钱发布需求 ——
       发布费照收、人找来却录不进（列表里过期作废）。这里与 core.hire 用同一把尺子（seatCap）。 */
    var aliveN = (s.engineers || []).filter(function (e) { return !e.resigned; }).length;
    var capN = ui.core.seatCap ? ui.core.seatCap() : 4;
    var full = aliveN >= capN;
    if (full) {
      hint += '<div class="hire-note warn">🚪 座位已满（' + aliveN + '/' + capN + '）：先辞退一人，再来发布需求</div>';
    }

    var roleCards = roles.map(function (r) {
      var on = sel.indexOf(r.key) >= 0;
      var dis = order || poor || full ? ' dim' : '';
      return '<div class="hire-role' + (on ? ' on' : '') + dis + '" data-action="hire-pick" data-role="' + r.key + '">'
        + '<div class="hr-name">' + r.label + (on ? '<i class="hr-tick">✓</i>' : '') + '</div>'
        + '<div class="hr-meta">预计需要 ' + (r.wait[0] === r.wait[1] ? (r.wait[0] + ' 周') : (r.wait[0] + '~' + r.wait[1] + ' 周')) + '</div>'
        + '<div class="hr-pick">' + (on ? '已勾选' : '点击勾选') + '</div>'
        + '</div>';
    }).join('');
    if (poor) {
      roleCards += '<div class="hire-note warn">经费不足：发布一次需求要 ' + Math.round(totalCost / 10000) + ' 万（勾选 ' + Math.max(1, sel.length) + ' 个岗位）</div>';
    }
    /* 寻访人数规则（2026-09-12）：每个勾选岗位独立 roll 1~3 人，写在按钮上方 */
    var bar = order ? '' : '<div class="hire-bar">'
      + '<button class="skew-btn ghost" type="button" data-action="hire-all"' + (poor || full ? ' disabled' : '') + '>全选全部岗位</button>'
      + '<button class="skew-btn pink" type="button" data-action="hire-order"' + (sel.length && !poor && !full ? '' : ' disabled') + '>'
      + '🔍 发布需求' + (sel.length ? '（' + sel.length + ' 类）' : '') + costTxt + '</button>'
      + '</div><div class="hire-note">每个勾选岗位独立寻访 1~3 人（勾 2 个岗位 = 2~6 人）</div>';

    var status = '';
    if (order) {
      /* V3.5.3：寻访剩余时间按周显示（TICKS_PER_WEEK 个 tick = 1 周）。
         2026-09-08：改用 ceil + 进度条 —— 以前用 round 且下限写死 1，最后整整一周都显示
         「还需 1 周」，看起来像卡住不动。 */
      var tpw = (c.V35 && c.V35.TICKS_PER_WEEK) || 6;
      var leftTicks = Math.max(0, order.left);
      var totalTicks = Math.max(1, order.total || tpw);
      var leftWeek = Math.max(1, Math.ceil(leftTicks / tpw));
      var pct = Math.max(0, Math.min(100, Math.round((1 - leftTicks / totalTicks) * 100)));
      var names = ((order.roles && order.roles.length) ? order.roles : [order.role]).map(function (r) {
        return ((HR[r] || {}).label) || r;
      }).join('、');
      var rush = window.V35Hire && window.V35Hire.rushOptions ? window.V35Hire.rushOptions(ui.core) : null;
      var rushBar = rush ? '<div class="hire-rush-bar"><button class="skew-btn gold" type="button" data-action="hire-rush"'
        + ((s.funding || 0) < rush.cost || leftTicks <= 0 ? ' disabled' : '')
        + '>加急招聘 · ' + rush.costText + '（缩短 ' + rush.weeks + ' 周）</button>'
        + '<div class="hire-note">只缩短招聘等待；本轮未找到人仍会按原规则重试。</div></div>' : '';
      status = '<div class="hire-status">'
        + '<div class="hs-title">🔍 正在筛选简历：' + names + '（第 ' + order.attempt + ' 轮）</div>'
        + '<div class="hs-bar"><i style="width:' + pct + '%"></i></div>'
        + '<div class="hs-tip">还需 ' + leftWeek + ' 周 · 找到的人会进「招聘」页的候选人列表</div>'
        + rushBar
        + '</div>';
    }
    return '<div class="hire-panel">' + hint + roleCards + bar + status + '</div>';
  }
};
