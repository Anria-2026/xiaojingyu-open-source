/* Left-side feature entries and the office pet's touch feedback. */
(function () {
  "use strict";
  const ui = window.GameUI, scene = window.V2OfficeScene, bus = window.GameBus;
  if (!ui || !scene || !bus) return;
  bus.on("ui:action", e => {
    if (e.action === "arcade" || e.action === "whale-room") {
      ui._clickHandled = true; ui._pressTarget = null;
      const fn = e.action === "arcade" ? ui.openArcade : ui.openWhaleRoom;
      if (typeof fn === "function") fn.call(ui, e.action === "arcade" ? "menu" : undefined);
    } else if (e.action === "whale-pet" && e.el && e.el.classList.contains("v2a-whale")) {
      ui._clickHandled = true; ui._pressTarget = null;
      if (Date.now() < (ui._v2aSuppressClick || 0) || e.el.closest(".v2a-overlay-blocked") || ui.core.state.officeModal) return;
      if (window.OfficeBubbles) window.OfficeBubbles.say();
      if (window.SFX) window.SFX.play("click");
      bus.emit("whale:tap", {});
    }
  });
})();
