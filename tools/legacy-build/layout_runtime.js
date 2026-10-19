/* ES5 source included only in the generated compatibility bundle. No game/business source mutations. */
(function (W, D) {
  var mappings = __WHALE_HAS_MAPPINGS__;
  function supports(a, b) { try { return b === undefined ? W.CSS.supports(a) : W.CSS.supports(a, b); } catch (e) { return false; } }
  var needHas = !supports("selector(:has(*))"), needRatio = !supports("aspect-ratio", "1 / 1"), queued = false;
  function portrait() { return W.matchMedia ? W.matchMedia("(orientation: portrait)").matches : W.innerHeight >= W.innerWidth; }
  function clearMinimum(el) {
    if (el.__whaleRatioMinimum && el.style.minHeight === el.__whaleRatioMinimum) el.style.minHeight = "";
    el.__whaleRatioMinimum = null;
    el.__whaleRatioMinBase = null;
    el.__whaleRatioMinKey = null;
  }
  function clearRatio(el) {
    if (el.__whaleRatioHeight && el.style.height === el.__whaleRatioHeight) el.style.height = "";
    el.__whaleRatioHeight = null;
    el.__whaleRatioRequestedHeight = null;
    clearMinimum(el);
  }
  function columnFlexItem(el) {
    var parent = el.parentElement, style;
    while (parent) {
      style = W.getComputedStyle(parent);
      if (style.display !== "contents") return /^(inline-)?flex$/.test(style.display) && /^column/.test(style.flexDirection);
      parent = parent.parentElement;
    }
    return false;
  }
  function parentContentHeight(el) {
    var parent = el.parentElement, computed, height, value, sides = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"], i;
    while (parent) {
      computed = W.getComputedStyle(parent);
      if (computed.display !== "contents") break;
      parent = parent.parentElement;
    }
    if (!parent || !/px$/.test(computed.height)) return NaN;
    height = parseFloat(computed.height);
    if (computed.boxSizing === "border-box") {
      for (i = 0; i < sides.length; i++) {
        value = computed[sides[i]];
        if (!/px$/.test(value)) return NaN;
        height -= parseFloat(value);
      }
    }
    return height > 0 && isFinite(height) ? height : NaN;
  }
  function setRatio(selector, ratio, portraitAuto, naturalClass, autoMinimum, boundedClass) {
    var nodes = D.querySelectorAll(selector), i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var computed = W.getComputedStyle(el);
      if ((portraitAuto && portrait()) || (naturalClass && el.classList.contains(naturalClass)) || computed.display === "contents") {
        clearRatio(el); continue;
      }
      if (el.style.height && el.style.height !== el.__whaleRatioHeight) { el.__whaleRatioHeight = null; el.__whaleRatioRequestedHeight = null; clearMinimum(el); continue; }
      var width = parseFloat(computed.width);
      if (!(width > 0) || !/px$/.test(computed.width)) continue;
      var flexMinimum = autoMinimum && columnFlexItem(el) && /^(visible|clip)$/.test(computed.overflowY);
      var minKey = el.className + ":" + computed.width + ":" + computed.maxHeight + ":" + flexMinimum + ":" + W.innerWidth + ":" + W.innerHeight;
      // Re-read authored media/class constraints only when layout inputs change.
      // Ordinary sync calls retain owned values without clear/set oscillation.
      if (el.__whaleRatioMinimum && el.style.minHeight === el.__whaleRatioMinimum && el.__whaleRatioMinKey !== minKey) {
        clearMinimum(el); computed = W.getComputedStyle(el);
      }
      var minimum = el.__whaleRatioMinimum && el.style.minHeight === el.__whaleRatioMinimum ? el.__whaleRatioMinBase : computed.minHeight;
      var minHeight = /px$/.test(minimum) ? parseFloat(minimum) : 0;
      var maxHeight = /px$/.test(computed.maxHeight) ? parseFloat(computed.maxHeight) : Infinity;
      if (boundedClass && el.classList.contains(boundedClass)) {
        var percent = /^(\d+(?:\.\d+)?)%$/.exec(computed.maxHeight), budget;
        if (percent && Number(percent[1]) > 0) {
          budget = parentContentHeight(el);
          if (budget > 0) maxHeight = Math.min(maxHeight, budget * Number(percent[1]) / 100);
        }
      }
      var height = Math.max(minHeight || 0, Math.min(width / ratio, maxHeight)) + "px";
      if (boundedClass) {
        if (el.__whaleRatioRequestedHeight !== height || el.style.height !== el.__whaleRatioHeight) el.style.height = height;
        el.__whaleRatioRequestedHeight = height;
        el.__whaleRatioHeight = el.style.height;
      } else {
        if (el.style.height !== height) el.style.height = height;
        el.__whaleRatioHeight = height;
      }
      // Old engines lose aspect-ratio's transferred auto minimum in a column
      // flex item. Restore it only for ordinary quadrants, never authored 0px.
      if (flexMinimum && minimum === "auto" && (!el.style.minHeight || el.style.minHeight === el.__whaleRatioMinimum)) {
        if (el.style.minHeight !== height) el.style.minHeight = height;
        el.__whaleRatioMinimum = height; el.__whaleRatioMinBase = minimum; el.__whaleRatioMinKey = minKey;
      } else clearMinimum(el);
    }
  }
  function sync() {
    queued = false;
    if (needHas) {
      if (!D.documentElement.classList.contains("whale-legacy-has")) D.documentElement.classList.add("whale-legacy-has");
      for (var i = 0; i < mappings.length; i++) {
        var item = mappings[i], nodes = D.querySelectorAll(item.target);
        for (var j = 0; j < nodes.length; j++) {
          var found = !!nodes[j].querySelector(item.condition), contains = nodes[j].classList.contains(item.className);
          if (found !== contains) { if (found) nodes[j].classList.add(item.className); else nodes[j].classList.remove(item.className); }
        }
      }
    }
    if (needRatio) { setRatio(".focus-quadrant", 1, false, "embodied-focus-pair", true); setRatio(".aqua-stage", 16 / 9, true, null, false, "reward-readable"); setRatio(".awh-hammer-rig", 1296 / 1213, false); setRatio(".awh-impact", 1, false); }
  }
  // The development closure contains a native querySelectorAll(:has(...)) call.
  // Translate only mapped descendant conditions; native selector engines keep their own implementation.
  if (needHas) {
    var docAll = W.Document.prototype.querySelectorAll, elementOne = W.Element.prototype.querySelector;
    function prepare(selector) {
      if (typeof selector !== "string" || selector.indexOf(":has(") < 0) return selector;
      sync();
      return selector.replace(/:has\(([^()]*)\)/g, function (all, condition, at) {
        condition = condition.trim().replace(/\s*,\s*/g, ",");
        var item = null;
        for (var i = 0; i < mappings.length; i++) if (mappings[i].condition === condition) { item = mappings[i]; break; }
        if (!item) throw new Error("Unsupported legacy :has condition: " + condition);
        var prefix = selector.slice(0, at), depth = 0, start = 0;
        for (var j = 0; j < prefix.length; j++) { if (prefix.charAt(j) === "(") depth++; if (prefix.charAt(j) === ")") depth--; if (!depth && prefix.charAt(j) === ",") start = j + 1; }
        var target = prefix.slice(start).replace(/:not\($/, "").trim(), nodes = docAll.call(D, target);
        for (j = 0; j < nodes.length; j++) {
          var found = !!elementOne.call(nodes[j], condition), contains = nodes[j].classList.contains(item.className);
          if (found !== contains) { if (found) nodes[j].classList.add(item.className); else nodes[j].classList.remove(item.className); }
        }
        return "." + item.className;
      });
    }
    var prototypes = [W.Document.prototype, W.Element.prototype, W.DocumentFragment.prototype];
    for (var k = 0; k < prototypes.length; k++) (function (proto) {
      var all = proto.querySelectorAll, one = proto.querySelector;
      if (all) proto.querySelectorAll = function (selector) { return all.call(this, prepare(selector)); };
      if (one) proto.querySelector = function (selector) { return one.call(this, prepare(selector)); };
    })(prototypes[k]);
  }
  function schedule() { if (!queued) { queued = true; W.setTimeout(sync, 0); } }
  W.LegacyLayout = { sync: sync, hasMappings: mappings, needHas: needHas, needRatio: needRatio };
  if (!needHas && !needRatio) return;
  if (W.MutationObserver) new W.MutationObserver(schedule).observe(D.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"]});
  D.addEventListener("DOMContentLoaded", sync);
  W.addEventListener("resize", schedule);
  sync();
})(window, document);
