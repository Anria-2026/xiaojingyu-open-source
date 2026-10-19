/* V2B optional panels reuse the original card, buttons and height fitting. */
(function () {
  "use strict";
  const ui = window.GameUI;
  if (!ui) return;
  const panels = new Set();
  function closeStale() { for (const panel of Array.from(panels)) if (!panel.isCurrent()) panel.close(); }
  function open(opts = {}) {
    closeStale();
    // Teardown observers can run after a browser document has been released.
    // Keep the surfaces that own these listeners until the panel is cleaned up.
    const surface = window, page = document;
    const owner=ui.core, state=owner && owner.state, ver=state && state.ver;
    const root = ui.el && (ui.el.querySelector(".office-shell") || ui.el) || page.body;
    const host = page.createElement("div");
    host.className = "v2b-panel-host";
    host.innerHTML = '<div class="modal-mask"><div class="modal-card" role="dialog" aria-modal="true"><div class="modal-header"><div class="modal-title"><div class="title-icon"></div><span></span></div><button class="modal-close" type="button" title="关闭" aria-label="关闭"></button></div><div class="modal-body"></div><div class="modal-footer"></div></div></div>';
    const card = host.querySelector(".modal-card"), body = host.querySelector(".modal-body");
    const responsive = opts.layout === "responsive";
    if (responsive) card.classList.add("v2b-responsive-card");
    card.setAttribute("aria-label", opts.title || "玩法");
    if (opts.className) card.classList.add(...opts.className.split(/\s+/).filter(Boolean));
    host.querySelector(".modal-title span").textContent = opts.title || "玩法";
    host.querySelector(".title-icon").innerHTML = ui.icon ? ui.icon(opts.icon || "star", 15) : "";
    host.querySelector(".modal-close").innerHTML = ui.icon ? ui.icon("x", 13) : "×";
    if (typeof opts.body === "string") body.innerHTML = opts.body;
    root.appendChild(host);
    // An independent receiver retains the original zoom, pointer guard and retry
    // algorithm without changing the original panel's fitting state.
    const adapter = Object.create(ui);
    Object.assign(adapter, { el: host, _fitDone: false, _fitK: 1, _fitAt: 0,
      _fitRetry: 0, _fitRetryN: 0, _fitting: false, _pointerInCard: false });
    let closed = false;
    const previousFocus = page.activeElement;
    function fit() {
      if (closed) return;
      // These pages arrange/paginate within the real card. Keeping their body at
      // 1:1 also keeps game input coordinates and text stable while playing.
      if (responsive) {
        clearTimeout(adapter._fitRetry); adapter._fitRetry = 0;
        body.style.zoom = "1"; body.style.transform = ""; body.style.width = "";
        adapter._fitDone = true; adapter._fitK = 1;
        return;
      }
      adapter.invalidateFit(); adapter.fitModalBody();
    }
    function close() {
      if (closed) return;
      closed = true;
      clearTimeout(adapter._fitRetry);
      surface.removeEventListener("resize", fit);
      page.removeEventListener("keydown", keydown, true);
      observer.disconnect(); host.remove(); panels.delete(panel);
      if (surface.document !== page) return;
      if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus();
      if (opts.onClose) opts.onClose();
    }
    function keydown(e) {
      if (e.key === "Escape" && !ui._confirmOpen && Array.from(panels).pop() === panel) {
        e.preventDefault(); e.stopPropagation();
        if (!opts.onEscape || opts.onEscape(e) !== true) close();
      }
      if (e.key === "Tab" && opts.focusTrap !== false && Array.from(panels).pop() === panel) {
        const items = Array.from(card.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(n => !n.closest('[hidden]'));
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && page.activeElement === first) { e.preventDefault(); last.focus(); }
        if (!e.shiftKey && page.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    card.addEventListener("pointerenter", () => { adapter._pointerInCard = true; });
    card.addEventListener("pointerleave", () => { adapter._pointerInCard = false; if (!responsive) adapter.fitModalBody(); });
    if (responsive) {
      // A local button may replace itself before the root's delegated click
      // handler runs. That root handler has a coordinate fallback for office
      // controls, so keep this panel's completed gesture inside its own host.
      host.addEventListener("click", event => {
        const target = event.target && event.target.closest && event.target.closest('[data-action]');
        // More uses the existing UI action router; dispatch it here once rather
        // than letting its event reach the office receiver after the handoff.
        if (target && host.contains(target)) ui.onClick(event);
        ui._clickHandled = true; ui._pressTarget = null;
        event.stopPropagation();
      });
      for (const type of ["pointerup", "touchend", "pointercancel"]) host.addEventListener(type, event => {
        ui._clickHandled = true; ui._pressTarget = null;
        event.stopPropagation();
      });
    }
    host.querySelector(".modal-close").addEventListener("click", e => {
      // Removing this button before the delegated handler runs would let its
      // coordinate fallback select an unrelated scene hotspot underneath.
      e.preventDefault(); e.stopPropagation();
      ui._clickHandled = true; ui._pressTarget = null;
      close();
    });
    page.addEventListener("keydown", keydown, true);
    surface.addEventListener("resize", fit);
    const observer = new surface.MutationObserver(() => { if (!host.isConnected) close(); });
    observer.observe(ui.el || page.body, { childList: true, subtree: true });
    const panel = { host, card, body, close, fit,
      isCurrent:()=>!state || ui.core===owner && owner.state===state && state.ver===ver && state.phase==="office" };
    panels.add(panel); fit(); host.querySelector(".modal-close").focus();
    return panel;
  }
  window.V2Panels = { open, closeAll: () => Array.from(panels).reverse().forEach(p => p.close()) };
  for(const name of ["newGame","loadState","_enterStage","startProject"]){
    const core=window.GameCore, original=core && core[name];
    if(typeof original==="function")core[name]=function(){const result=original.apply(this,arguments);closeStale();return result;};
  }
  const render=ui.render;
  if(typeof render==="function")ui.render=function(){closeStale();return render.apply(this,arguments);};
  if(window.GameBus)window.GameBus.on("phase",closeStale);
})();
