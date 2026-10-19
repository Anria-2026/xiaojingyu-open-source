/* [feature:legacy-webview-polyfills] ES5, local, installed only on the compatibility path.
   Scope: the shipping game source closure; not a general browser replacement. */
(function (W, D) {
  "use strict";
  var AP = Array.prototype, SP = String.prototype, hop = Object.prototype.hasOwnProperty;
  function put(o, k, v) { if (!o[k]) Object.defineProperty(o, k, { value: v, configurable: true, writable: true }); }
  var nativeSymbol = typeof W.Symbol === "function" && W.Symbol.iterator;
  if (!nativeSymbol) {
    var symbolSerial = 0;
    W.Symbol = function (name) { return "@@whale:" + (name || "") + ":" + (++symbolSerial); };
    W.Symbol.iterator = "@@whale:iterator";
  }
  var iteratorKey = W.Symbol.iterator;
  if (!SP[iteratorKey]) SP[iteratorKey] = function () { var text = String(this), index = 0, it = { next: function () { if (index >= text.length) return { done: true }; var start = index++, high = text.charCodeAt(start), low = text.charCodeAt(index); if (high >= 55296 && high <= 56319 && low >= 56320 && low <= 57343) index++; return { value: text.slice(start, index), done: false }; } }; it[iteratorKey] = function () { return this; }; return it; };
  function each(input, fn) {
    if (input == null) return;
    var it = input[iteratorKey], step, i;
    if (typeof it === "function") { it = it.call(input); while (!(step = it.next()).done) fn(step.value); }
    else for (i = 0; i < input.length; i++) fn(input[i]);
  }
  function same(a, b) { return a === b || (a !== a && b !== b); }
  function SmallMap(input) {
    this._records = []; this.size = 0;
    var self = this; each(input, function (pair) { self.set(pair[0], pair[1]); });
  }
  SmallMap.prototype._find = function (key) {
    for (var i = 0; i < this._records.length; i++) if (this._records[i].live && same(this._records[i].key, key)) return this._records[i];
    return null;
  };
  SmallMap.prototype.set = function (key, value) { var r = this._find(key); if (r) r.value = value; else { this._records.push({ key: key === 0 ? 0 : key, value: value, live: true }); this.size++; } return this; };
  SmallMap.prototype.get = function (key) { var r = this._find(key); return r ? r.value : undefined; };
  SmallMap.prototype.has = function (key) { return !!this._find(key); };
  SmallMap.prototype.delete = function (key) { var r = this._find(key); if (!r) return false; r.live = false; this.size--; return true; };
  SmallMap.prototype.clear = function () { for (var i = 0; i < this._records.length; i++) this._records[i].live = false; this.size = 0; };
  SmallMap.prototype._iterator = function (kind) {
    var records = this._records, index = 0, it = { next: function () {
      while (index < records.length) { var r = records[index++]; if (r.live) return { value: kind === 0 ? r.key : kind === 1 ? r.value : [r.key, r.value], done: false }; }
      return { value: undefined, done: true };
    } }; it[iteratorKey] = function () { return this; }; return it;
  };
  SmallMap.prototype.keys = function () { return this._iterator(0); };
  SmallMap.prototype.values = function () { return this._iterator(1); };
  SmallMap.prototype.entries = function () { return this._iterator(2); };
  SmallMap.prototype[iteratorKey] = SmallMap.prototype.entries;
  SmallMap.prototype.forEach = function (fn, that) { var self = this; each(this.entries(), function (p) { fn.call(that, p[1], p[0], self); }); };
  function SmallSet(input) { this._map = new SmallMap(); var self = this; each(input, function (value) { self.add(value); }); }
  Object.defineProperty(SmallSet.prototype, "size", { get: function () { return this._map.size; } });
  SmallSet.prototype.add = function (value) { this._map.set(value, value); return this; };
  SmallSet.prototype.has = function (value) { return this._map.has(value); };
  SmallSet.prototype.delete = function (value) { return this._map.delete(value); };
  SmallSet.prototype.clear = function () { this._map.clear(); };
  SmallSet.prototype.values = SmallSet.prototype.keys = function () { return this._map.keys(); };
  SmallSet.prototype.entries = function () { return this._map.entries(); };
  SmallSet.prototype[iteratorKey] = SmallSet.prototype.values;
  SmallSet.prototype.forEach = function (fn, that) { var self = this; each(this.values(), function (v) { fn.call(that, v, v, self); }); };
  if (!nativeSymbol || typeof W.Map !== "function") W.Map = SmallMap;
  if (!nativeSymbol || typeof W.Set !== "function") W.Set = SmallSet;
  put(Object, "assign", function (target) { if (target == null) throw new TypeError("Object.assign target"); var out = Object(target); for (var i = 1; i < arguments.length; i++) { var src = arguments[i]; if (src != null) Object.keys(Object(src)).forEach(function (k) { out[k] = src[k]; }); } return out; });
  put(Object, "entries", function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }); });
  put(Object, "values", function (o) { return Object.keys(o).map(function (k) { return o[k]; }); });
  put(Object, "fromEntries", function (input) { if (input == null) throw new TypeError("Object.fromEntries input"); var out = {}; each(input, function (pair) { if (Object(pair) !== pair) throw new TypeError("Invalid entry"); Object.defineProperty(out, pair[0], { value: pair[1], enumerable: true, configurable: true, writable: true }); }); return out; });
  put(AP, "at", function (index) { var length = this.length >>> 0, n = Number(index) || 0; if (!isFinite(n)) return undefined; n = n < 0 ? Math.ceil(n) : Math.floor(n); if (n < 0) n += length; return n < 0 || n >= length ? undefined : this[n]; });
  var localFrom = function (input, map, that) { if (input == null) throw new TypeError("Array.from input"); var out = []; each(input, function (v) { out.push(map ? map.call(that, v, out.length) : v); }); return out; };
  if (!nativeSymbol) Array.from = localFrom; else put(Array, "from", localFrom);
  put(AP, "includes", function (value, from) { var len = this.length >>> 0, start = Number(from) || 0; if (start < 0) start = Math.max(0, len + Math.ceil(start)); for (var i = Math.floor(start); i < len; i++) if (same(this[i], value)) return true; return false; });
  put(AP, "find", function (fn, that) { for (var i = 0; i < this.length; i++) if (fn.call(that, this[i], i, this)) return this[i]; });
  put(AP, "findIndex", function (fn, that) { for (var i = 0; i < this.length; i++) if (fn.call(that, this[i], i, this)) return i; return -1; });
  put(AP, "keys", function () { var array = this, index = 0, it = { next: function () { return index < array.length ? { value: index++, done: false } : { done: true }; } }; it[iteratorKey] = function () { return this; }; return it; });
  put(AP, "flatMap", function (fn, that) { var out = []; for (var i = 0; i < this.length; i++) if (i in this) { var v = fn.call(that, this[i], i, this); if (Array.isArray(v)) { for (var j = 0; j < v.length; j++) if (j in v) out.push(v[j]); } else out.push(v); } return out; });
  put(SP, "startsWith", function (s, p) { return String(this).slice(Math.max(0, Number(p) || 0), Math.max(0, Number(p) || 0) + String(s).length) === String(s); });
  put(SP, "endsWith", function (s, p) { var t = String(this), end = p === undefined ? t.length : Math.min(t.length, Math.max(0, Number(p) || 0)); return t.slice(end - String(s).length, end) === String(s); });
  put(SP, "includes", function (s, p) { return String(this).indexOf(String(s), Number(p) || 0) !== -1; });
  put(SP, "repeat", function (n) { n = Math.floor(Number(n) || 0); if (n < 0 || n === Infinity) throw new RangeError("repeat count"); var out = "", word = String(this); while (n) { if (n % 2) out += word; n = Math.floor(n / 2); if (n) word += word; } return out; });
  put(SP, "padStart", function (len, fill) { var text = String(this), pad = fill === undefined ? " " : String(fill); len = Math.max(0, Math.floor(Number(len) || 0)); if (!pad || text.length >= len) return text; return pad.repeat(Math.ceil((len - text.length) / pad.length)).slice(0, len - text.length) + text; });
  put(Number, "isFinite", function (v) { return typeof v === "number" && isFinite(v); });
  put(Number, "isInteger", function (v) { return Number.isFinite(v) && Math.floor(v) === v; });
  put(Number, "isSafeInteger", function (v) { return Number.isInteger(v) && Math.abs(v) <= 9007199254740991; });
  /* [feature:arcade-compat-multiply-20261012] */
  put(Math, "imul", function (a, b) { var ah = (a >>> 16) & 65535, al = a & 65535, bh = (b >>> 16) & 65535, bl = b & 65535; return (al * bl + (((ah * bl + al * bh) & 65535) << 16)) | 0; });
  /* [/feature:arcade-compat-multiply-20261012] */
  put(Math, "hypot", function () { var max = 0, sum = 0, i; for (i = 0; i < arguments.length; i++) { var n = Math.abs(Number(arguments[i])); if (n === Infinity) return Infinity; max = Math.max(max, n); } if (max === 0) return 0; for (i = 0; i < arguments.length; i++) sum += Math.pow(Number(arguments[i]) / max, 2); return Math.sqrt(sum) * max; });

  /* Promise thenable assimilation and scheduled callbacks preserve async game boot order. */
  function LocalPromise(executor) {
    if (!(this instanceof LocalPromise)) throw new TypeError("Promise requires new");
    this._state = 0; this._value = undefined; this._queue = [];
    var self = this, done = false;
    try { executor(function (v) { if (!done) { done = true; settle(self, 1, v); } }, function (e) { if (!done) { done = true; settle(self, 2, e); } }); }
    catch (e) { if (!done) { done = true; settle(self, 2, e); } }
  }
  function settle(p, state, value) {
    if (p._state) return;
    if (state === 1 && value === p) return settle(p, 2, new TypeError("Promise cycle"));
    if (state === 1 && value && (typeof value === "object" || typeof value === "function")) {
      var then; try { then = value.then; } catch (e) { settle(p, 2, e); return; }
      if (typeof then === "function") {
        var called = false;
        try { then.call(value, function (v) { if (!called) { called = true; settle(p, 1, v); } }, function (e) { if (!called) { called = true; settle(p, 2, e); } }); }
        catch (e) { if (!called) { called = true; settle(p, 2, e); } } return;
      }
    }
    p._state = state; p._value = value; flush(p);
  }
  function flush(p) {
    if (!p._state || !p._queue.length || p._scheduled) return; p._scheduled = true;
    W.setTimeout(function () {
      p._scheduled = false; var queue = p._queue.splice(0);
      for (var i = 0; i < queue.length; i++) {
        var h = queue[i], fn = p._state === 1 ? h.ok : h.bad;
        try { if (typeof fn === "function") h.resolve(fn(p._value)); else (p._state === 1 ? h.resolve : h.reject)(p._value); }
        catch (e) { h.reject(e); }
      } flush(p);
    }, 0);
  }
  LocalPromise.prototype.then = function (ok, bad) { var self = this; return new LocalPromise(function (resolve, reject) { self._queue.push({ ok: ok, bad: bad, resolve: resolve, reject: reject }); flush(self); }); };
  LocalPromise.prototype.catch = function (bad) { return this.then(null, bad); };
  LocalPromise.resolve = function (v) { return v instanceof LocalPromise ? v : new LocalPromise(function (r) { r(v); }); };
  LocalPromise.reject = function (e) { return new LocalPromise(function (r, j) { j(e); }); };
  LocalPromise.all = function (input) { return new LocalPromise(function (resolve, reject) { var values = Array.from(input), left = values.length, out = []; if (!left) { resolve(out); return; } values.forEach(function (p, i) { LocalPromise.resolve(p).then(function (v) { out[i] = v; if (!--left) resolve(out); }, reject); }); }); };
  LocalPromise.race = function (input) { return new LocalPromise(function (resolve, reject) { each(input, function (p) { LocalPromise.resolve(p).then(resolve, reject); }); }); };
  if (typeof W.Promise !== "function") W.Promise = LocalPromise;
  put(W.Promise.prototype, "finally", function (fn) { var P = this.constructor; if (typeof fn !== "function") return this.then(fn, fn); return this.then(function (v) { return P.resolve(fn()).then(function () { return v; }); }, function (e) { return P.resolve(fn()).then(function () { throw e; }); }); });

  var requestSerial = 0;
  var nativeAbort = typeof W.AbortController === "function";
  if (!nativeAbort) {
    W.AbortController = function () {
      var handlers = []; this.signal = { aborted: false,
        addEventListener: function (type, fn) { if (type === "abort") handlers.push(fn); },
        removeEventListener: function (type, fn) { for (var i = handlers.length - 1; i >= 0; i--) if (handlers[i] === fn) handlers.splice(i, 1); }
      };
      this.abort = function () { if (this.signal.aborted) return; this.signal.aborted = true; var list = handlers.slice(); for (var i = 0; i < list.length; i++) list[i](); };
    };
  }
  /* An old native fetch cannot consume a local AbortSignal; use bounded XHR for that pair too. */
  if (typeof W.fetch !== "function" || !nativeAbort) W.fetch = function (url, options) {
    options = options || {};
    return new W.Promise(function (resolve, reject) {
      var xhr = new W.XMLHttpRequest(), signal = options.signal, finished = false;
      function stop() { if (signal && signal.removeEventListener) signal.removeEventListener("abort", abort); }
      function fail(name, message) { if (finished) return; finished = true; stop(); var e = new Error(message); e.name = name; reject(e); }
      function abort() { xhr.abort(); fail("AbortError", "Request aborted"); }
      if (signal && signal.aborted) { fail("AbortError", "Request aborted"); return; }
      var requestUrl = String(url);
      if (options.cache === "no-store" || options.cache === "reload" || options.cache === "no-cache") { var hashAt = requestUrl.indexOf("#"), suffix = hashAt < 0 ? "" : requestUrl.slice(hashAt); if (hashAt >= 0) requestUrl = requestUrl.slice(0, hashAt); requestUrl += (requestUrl.indexOf("?") < 0 ? "?" : "&") + "__whale_nc=" + new Date().getTime() + "_" + (++requestSerial) + suffix; }
      xhr.open(options.method || "GET", requestUrl, true); xhr.responseType = "arraybuffer"; xhr.timeout = 15000;
      if (options.credentials === "include") xhr.withCredentials = true;
      if (options.headers) Object.keys(options.headers).forEach(function (k) { xhr.setRequestHeader(k, options.headers[k]); });
      if (signal && signal.addEventListener) signal.addEventListener("abort", abort);
      xhr.onerror = function () { fail("TypeError", "Network request failed"); };
      xhr.ontimeout = function () { fail("TypeError", "Network request timed out"); };
      xhr.onabort = function () { fail("AbortError", "Request aborted"); };
      xhr.onload = function () {
        if (finished) return; finished = true; stop();
        var bytes = xhr.response || new W.ArrayBuffer(0);
        function text() { var a = new W.Uint8Array(bytes), s = ""; for (var i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, Math.min(i + 8192, a.length))); return decodeURIComponent(escape(s)).replace(/^\uFEFF/, ""); }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, url: String(url),
          text: function () { return W.Promise.resolve().then(text); },
          json: function () { return W.Promise.resolve().then(function () { return JSON.parse(text()); }); },
          arrayBuffer: function () { return W.Promise.resolve(bytes.slice(0)); }
        });
      };
      try { xhr.send(options.body === undefined ? null : options.body); } catch (e) { fail("TypeError", e.message || "Network request failed"); }
    });
  };
  var EP = W.Element && W.Element.prototype;
  /* [feature:arcade-compat-parent-node-20261012] */
  function childrenFragment(parent, items) { var doc = parent.ownerDocument || parent, fragment = doc.createDocumentFragment(); for (var i = 0; i < items.length; i++) { var item = items[i]; fragment.appendChild(item && item.nodeType ? item : doc.createTextNode(String(item))); } return fragment; }
  var parentProtos = [EP, W.Document && W.Document.prototype, W.DocumentFragment && W.DocumentFragment.prototype];
  for (var pi = 0; pi < parentProtos.length; pi++) if (parentProtos[pi]) {
    put(parentProtos[pi], "append", function () { this.appendChild(childrenFragment(this, arguments)); });
    put(parentProtos[pi], "prepend", function () { this.insertBefore(childrenFragment(this, arguments), this.firstChild); });
    put(parentProtos[pi], "replaceChildren", function () { var fragment = childrenFragment(this, arguments); while (this.firstChild) this.removeChild(this.firstChild); this.appendChild(fragment); });
  }
  /* [/feature:arcade-compat-parent-node-20261012] */
  if (EP) {
    put(EP, "matches", EP.msMatchesSelector || EP.webkitMatchesSelector || function (selector) { var nodes = (this.ownerDocument || D).querySelectorAll(selector); for (var i = 0; i < nodes.length; i++) if (nodes[i] === this) return true; return false; });
    put(EP, "closest", function (selector) { var el = this; while (el && el.nodeType === 1) { if (el.matches(selector)) return el; el = el.parentElement; } return null; });
    put(EP, "remove", function () { if (this.parentNode) this.parentNode.removeChild(this); });
    put(EP, "replaceWith", function () { var parent = this.parentNode; if (!parent) return; for (var i = 0; i < arguments.length; i++) { var node = arguments[i]; if (node === this) continue; parent.insertBefore(node && node.nodeType ? node : D.createTextNode(String(node)), this); } parent.removeChild(this); });
  }
  if (W.Node && !("isConnected" in W.Node.prototype)) Object.defineProperty(W.Node.prototype, "isConnected", { configurable: true, get: function () { return !!(this.ownerDocument && this.ownerDocument.documentElement.contains(this)); } });
  if (W.NodeList) put(W.NodeList.prototype, "forEach", AP.forEach);
  if (W.CanvasRenderingContext2D) put(W.CanvasRenderingContext2D.prototype, "ellipse", function (x, y, rx, ry, rotation, start, end, anticlockwise) { this.save(); this.translate(x, y); this.rotate(rotation); this.scale(rx, ry); this.arc(0, 0, 1, start, end, anticlockwise); this.restore(); });
  var AudioCtor = W.AudioContext || W.webkitAudioContext;
  if (AudioCtor && AudioCtor.prototype.decodeAudioData) {
    var decode = AudioCtor.prototype.decodeAudioData;
    AudioCtor.prototype.decodeAudioData = function (bytes) { var context = this; return new W.Promise(function (resolve, reject) { try { var result = decode.call(context, bytes, resolve, reject); if (result && typeof result.then === "function") result.then(resolve, reject); } catch (e) { reject(e); } }); };
  }
  if (!W.performance) W.performance = {};
  put(W.performance, "now", function () { return new Date().getTime(); });
  if (!W.requestAnimationFrame) W.requestAnimationFrame = function (fn) { return W.setTimeout(function () { fn(W.performance.now()); }, 16); };
  if (!W.cancelAnimationFrame) W.cancelAnimationFrame = W.clearTimeout;
})(window, document);
/* [/feature:legacy-webview-polyfills] */
