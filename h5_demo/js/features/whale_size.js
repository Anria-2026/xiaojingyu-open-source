/* Whale size is a local view preference, independent of game progress and care. */
(function (w) {
  "use strict";
  if (w.WhaleSize) return;
  const KEY = "whale_office_whale_size_v1", MIN = 80, MAX = 180, STEP = 10;
  const installed = new WeakSet(), frames = new WeakMap();
  let selected = null, preview = null, persistent = true;
  const valid = value => Number.isFinite(value) && value >= MIN && value <= MAX && value % STEP === 0;
  const normalize = value => Math.max(MIN, Math.min(MAX, Math.round(Number(value) / STEP) * STEP));
  try {
    const raw = w.localStorage.getItem(KEY), value = raw == null ? null : Number(raw);
    if (valid(value)) selected = value;
  } catch (_) { persistent = false; }
  function defaults() {
    const width = Number(w.innerWidth), height = Number(w.innerHeight);
    return width > 0 && height > 0 && Math.min(width, height) <= 600 ? 130 : 100;
  }
  function percent() { return preview != null ? preview : selected != null ? selected : defaults(); }
  function get() { return percent() / 100; }
  function current(input) { return input || w.GameUI; }
  const available = ui => !!(ui && ui.core && ui.core.state &&
    typeof ui.core.embodiedAvailable === "function" && ui.core.embodiedAvailable());
  function controls(ui) {
    const body = ui && ui.el && ui.el.querySelector("#settingsPop .set-body");
    if (!body) return;
    let row = body.querySelector("[data-whale-size-settings]");
    // There is no physical companion in the old office. Keep the saved local
    // preference, but do not present controls for an absent character.
    if (!available(ui)) { if (row) row.remove(); return; }
    if (!row) {
      row = document.createElement("section"); row.className = "ws-size-settings";
      row.setAttribute("data-whale-size-settings", "");
      row.innerHTML = '<div class="set-label"><label for="ws-size-range">角色大小</label><b id="ws-size-value"></b></div>'
        + '<input id="ws-size-range" class="set-range ws-size-range" type="range" min="80" max="180" step="10" aria-describedby="ws-size-hint">'
        + '<div class="ws-size-endpoints" aria-hidden="true"><span>80%</span><span>180%</span></div>'
        + '<div class="ws-size-footer"><small id="ws-size-hint"></small><button type="button" class="dg-btn dg-btn-sm" data-action="ws-reset-size"><span>恢复默认</span></button></div>'
        + '<p class="set-tip ws-size-storage"></p>';
      body.appendChild(row);
      const slider = row.querySelector(".ws-size-range");
      slider.addEventListener("input", () => {
        if (!available(ui)) return;
        const value = normalize(slider.value); if (!valid(value)) return;
        preview = value; apply(ui);
      });
      slider.addEventListener("change", () => {
        if (!available(ui)) return;
        const value = normalize(slider.value); if (!valid(value)) return;
        selected = value; preview = null;
        try { w.localStorage.setItem(KEY, String(value)); persistent = true; } catch (_) { persistent = false; }
        apply(ui);
      });
    }
    const value = percent(), slider = row.querySelector(".ws-size-range");
    slider.value = String(value); slider.setAttribute("aria-valuetext", value + "%");
    row.querySelector("#ws-size-value").textContent = value + "%";
    row.querySelector("#ws-size-hint").textContent = selected == null && preview == null
      ? "自动：桌面 100%，手机 130%" : "自定义大小，场景内外共用";
    row.querySelector(".ws-size-storage").textContent = persistent
      ? "拖动立即预览，松手后保存到本机。" : "当前浏览器无法保存设置，本次调整仍然有效。";
  }
  function geometry(ui, shell) {
    const previous = frames.get(ui);
    if (previous && w.cancelAnimationFrame) w.cancelAnimationFrame(previous);
    const refresh = () => {
      frames.delete(ui);
      if (!shell.isConnected || !ui.el || ui.el.querySelector(".office-shell") !== shell) return;
      if (w.V2OfficeScene && typeof w.V2OfficeScene.refreshLayout === "function") w.V2OfficeScene.refreshLayout();
      if (w.OfficeBubbles && typeof w.OfficeBubbles.refresh === "function") w.OfficeBubbles.refresh();
    };
    if (typeof w.requestAnimationFrame === "function") frames.set(ui, w.requestAnimationFrame(refresh));
    else refresh();
  }
  function apply(input) {
    const ui = current(input), factor = get();
    if (!ui || !ui.el) return factor;
    controls(ui);
    const shell = ui.el.querySelector(".office-shell");
    if (!shell) return factor;
    const changed = shell.style.getPropertyValue("--whale-user-scale") !== String(factor);
    shell.style.setProperty("--whale-user-scale", String(factor));
    if (changed) geometry(ui, shell);
    return factor;
  }
  function reset(ui) {
    selected = null; preview = null;
    try { w.localStorage.removeItem(KEY); persistent = true; } catch (_) { persistent = false; }
    apply(ui);
  }
  function install(input) {
    const ui = current(input);
    if (!ui || installed.has(ui)) return;
    installed.add(ui);
    const settings = ui.openSettingsPop;
    if (typeof settings === "function") ui.openSettingsPop = function () {
      const result = settings.apply(this, arguments); controls(this); return result;
    };
    const click = ui.onClick;
    if (typeof click === "function") ui.onClick = function (event) {
      const target = event && event.target, resetButton = target && target.closest && target.closest('[data-action="ws-reset-size"]');
      const slider = target && target.closest && target.closest("[data-whale-size-settings] .ws-size-range");
      if (!resetButton && !slider) return click.apply(this, arguments);
      this._clickHandled = true; this._pressTarget = null;
      if (event.stopPropagation) event.stopPropagation();
      if (!resetButton) return; // Preserve the native range control's default behavior.
      if (event.preventDefault) event.preventDefault();
      if (!resetButton.disabled && available(this)) reset(this);
    };
    for (const name of ["renderOffice", "applyUiScale"]) {
      const original = ui[name];
      if (typeof original === "function") ui[name] = function () { const result = original.apply(this, arguments); apply(this); return result; };
    }
    apply(ui);
  }
  w.WhaleSize = { get, apply, install, available, storageKey: KEY };
  install(w.GameUI);
  w.addEventListener("resize", () => apply());
})(window);
