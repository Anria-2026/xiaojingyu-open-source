/* Shared image lifecycle. Sources remain authored in configuration. */
(function (w) {
  'use strict';
  if (w.ImageResources) return;
  const records = new WeakMap(), active = new Set();
  let installed = false, serial = 0;
  const policy = () => (w.GameCfg || {}).IMAGE_LOADING;
  function retryURL(source) {
    try {
      const url = new URL(source, document.baseURI);
      // Do not modify signed third-party URLs, data or blob images.
      if (url.origin === location.origin && /\/resource\//.test(url.pathname)) {
        url.searchParams.set('image_retry', String(Date.now()) + '-' + (++serial));
        return url.href;
      }
    } catch (_) {}
    return source;
  }
  function watch(image, options = {}) {
    const source = image.getAttribute('src') || '';
    const previous = records.get(image);
    if (image.hasAttribute('onerror') && !options.owned) { previous?.dispose(); return null; }
    if (previous && previous.current === source && !previous.closed) return previous;
    previous?.dispose();
    if (!source || image.hasAttribute('onerror') && !options.owned || !policy()) return null;
    const p = policy(), state = { image, source, current: source, attempt: 0, phase: '', closed: false, timer: null, options };
    const retries = options.retries == null ? p.RETRIES : Math.max(0, options.retries);
    const clear = () => { if (state.timer != null) clearTimeout(state.timer); state.timer = null; };
    function publish(phase) {
      state.phase = phase; image.dataset.imageLoad = phase;
      options.changed?.(phase, image);
      if (typeof w.CustomEvent === 'function') image.dispatchEvent(new CustomEvent('image-state-change', { bubbles: true, detail: { state: phase } }));
    }
    function current() { return !state.closed && image.getAttribute('src') === state.current && (options.detached || image.isConnected); }
    function finish() {
      if (!current() || !(image.naturalWidth > 0) || !(image.naturalHeight > 0)) return;
      clear(); active.delete(state); publish('ready'); options.ready?.(image);
    }
    function fail() {
      if (!current()) return;
      if (state.phase === 'ready') { state.attempt = 0; state.phase = 'loading'; }
      if (state.phase !== 'loading') return;
      clear();
      if (state.attempt >= retries) { active.delete(state); publish('failed'); options.failed?.(image); return; }
      state.attempt++; publish('retrying'); active.add(state);
      state.timer = setTimeout(() => start(true), p.RETRY_DELAY_MS * state.attempt);
    }
    function start(retry) {
      clear();
      if (!current()) { state.dispose(); return; }
      if (document.hidden && !options.detached) { publish('suspended'); active.add(state); return; }
      publish('loading'); active.add(state);
      if (retry) { state.current = retryURL(state.source); image.src = state.current; }
      if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) { finish(); return; }
      // Native lazy images may intentionally have no request yet. Their owner
      // promotes nearby photos to eager before starting a network deadline.
      if (image.loading !== 'lazy' || options.detached) state.timer = setTimeout(fail, p.TIMEOUT_MS);
    }
    state.dispose = () => {
      if (state.closed) return; state.closed = true; clear(); active.delete(state);
      image.removeEventListener('load', finish); image.removeEventListener('error', fail);
      if (records.get(image) === state) records.delete(image);
    };
    state.resume = () => start(false);
    records.set(image, state); image.addEventListener('load', finish); image.addEventListener('error', fail);
    start(false); return state;
  }
  function retry(image) {
    const old = records.get(image), options = old?.options || {};
    const source = old?.source || image.getAttribute('src');
    old?.dispose(); if (!source) return null;
    image.src = retryURL(source); const state = watch(image, options);
    if (state) state.source = source;
    return state;
  }
  function load(source, options = {}) {
    return new Promise((resolve, reject) => {
      if (typeof source !== 'string' || !source.trim()) { reject(new Error('Image source unavailable')); return; }
      if (!policy()) { reject(new Error('Image loading policy unavailable')); return; }
      const image = new Image(); let state, settled = false, decodeTimer = null;
      const signal = options.signal;
      const detach = () => { signal?.removeEventListener('abort', abort); if (decodeTimer != null) clearTimeout(decodeTimer); decodeTimer = null; };
      const abort = () => { if (settled) return; settled = true; state?.dispose(); image.removeAttribute('src'); detach(); const error = new Error('Image load cancelled'); error.name = 'AbortError'; reject(error); };
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      const finish = value => { if (settled) return; settled = true; state?.dispose(); detach(); options.ready?.(value); resolve(value); };
      image.src = source;
      state = watch(image, { detached: true, owned: true, retries: options.retries,
        ready: () => {
          if (!options.decode || typeof image.decode !== 'function') { finish(image); return; }
          Promise.race([Promise.resolve().then(() => image.decode()).catch(() => {}), new Promise(r => { decodeTimer = setTimeout(r, policy().DECODE_TIMEOUT_MS); })])
            .then(() => { finish(image); });
        },
        failed: () => { if (settled) return; settled = true; state?.dispose(); detach(); reject(new Error('Image load failed: ' + source)); },
      });
      // Cached images can settle synchronously during watch().
      if (settled) state?.dispose();
    });
  }
  function scan(root) {
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.tagName === 'IMG') watch(root);
    root.querySelectorAll?.('img[src]').forEach(image => watch(image));
  }
  function install() {
    if (installed || !policy()) return; installed = true;
    document.addEventListener('error', event => {
      const image = event.target;
      if (image?.tagName !== 'IMG' || records.has(image)) return;
      // A target listener installed during capture receives this same error.
      watch(image);
    }, true);
    document.addEventListener('load', event => { if (event.target?.tagName === 'IMG') watch(event.target); }, true);
    if (typeof w.MutationObserver === 'function') new MutationObserver(changes => {
      for (const change of changes) {
        if (change.type === 'attributes' && change.target.tagName === 'IMG') {
          const old = records.get(change.target), source = change.target.getAttribute('src') || '';
          if (old && old.current !== source) old.dispose();
          const next = watch(change.target);
          if (change.attributeName === 'loading' && next?.phase === 'loading') next.resume();
        } else for (const node of change.addedNodes || []) scan(node);
      }
      for (const state of active) if (!state.options.detached && !state.image.isConnected) state.dispose();
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'loading', 'onerror'] });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) for (const state of active) if (state.phase === 'suspended') state.resume();
    });
    w.addEventListener('online', () => document.querySelectorAll('img[data-image-load="failed"]').forEach(image => { if (!image.hasAttribute('onerror')) retry(image); }));
    scan(document);
  }
  w.ImageResources = Object.freeze({ install, watch, retry, load });
})(window);
