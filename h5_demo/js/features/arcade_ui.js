/* 独立小游戏入口；场景的 office-modal/arcade 由 V2B 场景接线统一分派。 */
(function (w) {
  'use strict';
  if (!w.GameBus || !w.ArcadeGlue || w.__v2ArcadeActions) return;
  w.__v2ArcadeActions = true;
  w.GameBus.on('ui:action', event => {
    if (event && event.action === 'arcade-open') w.ArcadeGlue.open(event.id || 'menu');
  });
})(window);
