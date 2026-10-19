/* V2A map extension. Original tools remain in MapEditor; only the new tools
   consume their own pointer events. Percentages always use the image's top left. */
"use strict";

window.MapMovement = (() => {
  const state = { region: 0, draft: null, drag: null, scene: null };
  const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
  const round = (v) => Math.round(v * 1000) / 1000;
  const copyPoints = (a) => (Array.isArray(a) ? a : [])
    .filter((p) => p && Number.isFinite(+p.x) && Number.isFinite(+p.y))
    .map((p) => ({ x: round(clamp(+p.x)), y: round(clamp(+p.y)) }));
  const copyRegions = (a) => {
    if (!Array.isArray(a) || !a.length) return [];
    return (Array.isArray(a[0]) ? a : [a]).map(copyPoints).filter((p) => p.length >= 3);
  };
  function ensureScene(sc) {
    if (Array.isArray(sc.walkable) && sc.walkable.length && !Array.isArray(sc.walkable[0])) sc.walkable = copyRegions(sc.walkable);
    if (state.scene !== sc) {
      state.scene = sc;
      state.region = 0; state.draft = null; state.drag = null;
    }
    return sc;
  }

  // Exactly the original editor cover conversion, inverted for drawing polygons.
  function geometry(sc, img) {
    const W = sc.bgW || 100, H = sc.bgH || 100;
    const Bw = (img && img.naturalWidth) || W;
    const Bh = (img && img.naturalHeight) || H;
    const scale = Math.max(W / Bw, H / Bh);
    return { W, H, width: Bw * scale, height: Bh * scale,
      offX: (W - Bw * scale) / 2, offY: (H - Bh * scale) / 2 };
  }

  function worldToPct(p, sc = App.project.scene, img = MapEditor.bgImg) {
    const g = geometry(sc, img);
    return { x: (p.x - g.offX) / g.width * 100,
      y: (1 - (p.y - g.offY) / g.height) * 100 };
  }

  function pctToWorld(p, sc = App.project.scene, img = MapEditor.bgImg) {
    const g = geometry(sc, img);
    return { x: g.offX + p.x / 100 * g.width,
      y: g.offY + (1 - p.y / 100) * g.height };
  }

  function eventPct(e) {
    const p = MapEditor.canvasPos(e);
    return worldToPct(MapEditor.coord.screenToWorld(p.x, p.y));
  }

  function screenPoint(p) {
    const w = pctToWorld(p);
    return MapEditor.coord.worldToScreen(w.x, w.y);
  }

  function inside(p, points) {
    let yes = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if (((a.y > p.y) !== (b.y > p.y)) &&
          p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) yes = !yes;
    }
    return yes;
  }

  function changed() {
    App.markCfgDirty();
    MapEditor.render();
  }

  function startDraft(append = false) {
    MapEditor.setTool("walkable");
    const sc = ensureScene(App.project.scene);
    state.draft = { points: [], region: append ? (sc.walkable || []).length : state.region };
    MapEditor.updateHint(); MapEditor.render(); MapEditor.inspector();
  }

  function finishDraft() {
    const draft = state.draft;
    if (!draft) return false;
    const points = copyPoints(draft.points).filter((p, i, arr) =>
      i === 0 || Math.hypot(p.x - arr[i - 1].x, p.y - arr[i - 1].y) > 0.01);
    if (points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x,
        points[0].y - points[points.length - 1].y) < 0.01) points.pop();
    const area = points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.y - q.x * p.y;
    }, 0);
    if (points.length < 3 || Math.abs(area) < 0.01) {
      UI.toast("轮廓至少需要 3 个不共线的点", "err"); return false;
    }
    const sc = ensureScene(App.project.scene);
    if (!Array.isArray(sc.walkable)) sc.walkable = [];
    state.region = Math.min(draft.region || 0, sc.walkable.length);
    sc.walkable[state.region] = points;
    state.draft = null; changed(); MapEditor.updateHint(); MapEditor.inspector();
    return true;
  }

  function cancelDraft() {
    state.draft = null; state.drag = null;
    MapEditor.updateHint(); MapEditor.render(); MapEditor.inspector();
  }

  function selectedShape() {
    const sc = ensureScene(App.project.scene);
    return { id: "walkable", points: (sc.walkable || [])[state.region] || [] };
  }

  function hitVertex(e, points) {
    const p = MapEditor.canvasPos(e);
    return points.findIndex((v) => {
      const s = screenPoint(v);
      return Math.hypot(s.x - p.x, s.y - p.y) <= 10;
    });
  }

  function pointerDown(e) {
    const sc = ensureScene(App.project.scene);
    const p = eventPct(e);
    if (MapEditor.tool === "spawn") {
      sc.spawn = pctToWorld({ x: clamp(p.x), y: clamp(p.y) });
      state.drag = { type: "spawn" }; changed(); MapEditor.inspector(); return;
    }
    if (state.draft) {
      if (state.draft.points.length >= 3 && hitVertex(e, [state.draft.points[0]]) === 0) {
        finishDraft(); return;
      }
      state.draft.points.push({ x: round(clamp(p.x)), y: round(clamp(p.y)) });
      MapEditor.render(); MapEditor.inspector(); return;
    }
    let shape = selectedShape();
    if (shape) {
      const index = hitVertex(e, shape.points);
      if (index >= 0) {
        state.drag = { type: "vertex", shape, index }; return;
      }
    }
    if (!shape || !inside(p, shape.points)) {
      const region = (sc.walkable || []).findIndex((points) => inside(p, points));
      shape = region < 0 ? null : { id: "walkable", points: sc.walkable[region] };
      if (region >= 0) state.region = region;
    }
    if (shape) {
      state.drag = { type: "move", shape, start: p, points: copyPoints(shape.points) };
    } else {
      state.draft = { region: (sc.walkable || []).length, points: [{ x: round(clamp(p.x)), y: round(clamp(p.y)) }] };
    }
    MapEditor.updateHint(); MapEditor.render(); MapEditor.inspector();
  }

  function pointerDrag(e) {
    const d = state.drag;
    if (!d) return;
    const p = eventPct(e), sc = App.project.scene;
    if (d.type === "spawn") sc.spawn = pctToWorld({ x: clamp(p.x), y: clamp(p.y) });
    else if (d.type === "vertex") {
      d.shape.points[d.index] = { x: round(clamp(p.x)), y: round(clamp(p.y)) };
    } else {
      const dx = clamp(p.x - d.start.x, -Math.min(...d.points.map((a) => a.x)),
        100 - Math.max(...d.points.map((a) => a.x)));
      const dy = clamp(p.y - d.start.y, -Math.min(...d.points.map((a) => a.y)),
        100 - Math.max(...d.points.map((a) => a.y)));
      const next = d.points.map((a) => ({ x: round(a.x + dx), y: round(a.y + dy) }));
      d.shape.points.splice(0, d.shape.points.length, ...next);
    }
    changed();
  }

  function color(token, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
  }

  function drawPolygon(ctx, points, selected, fill, stroke, closed = true) {
    if (!points.length) return;
    const screen = points.map(screenPoint);
    ctx.beginPath(); ctx.moveTo(screen[0].x, screen[0].y);
    screen.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    if (closed) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = stroke; ctx.lineWidth = selected ? 2.5 : 1.5; ctx.stroke();
    if (selected) screen.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = stroke; ctx.fill();
      ctx.strokeStyle = color("--text", "#e8ecf2"); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = color("--text", "#e8ecf2"); ctx.textAlign = "left";
      ctx.font = "11px sans-serif"; ctx.fillText(String(i + 1), p.x + 8, p.y - 7);
    });
  }

  function draw() {
    if (MapEditor.previewMode) return;
    const sc = ensureScene(App.project.scene), ctx = MapEditor.ctx;
    if (!ctx) return;
    ctx.save();
    if (MapEditor.layerVisible("walkable") && Array.isArray(sc.walkable)) {
      ctx.setLineDash([5, 4]);
      sc.walkable.forEach((points, i) => drawPolygon(ctx, points, MapEditor.tool === "walkable" && i === state.region,
        "rgba(77,216,181,0.08)", color("--accent-2", "#4dd8b5")));
      ctx.setLineDash([]);
    }
    if (state.draft) drawPolygon(ctx, state.draft.points, true, "rgba(255,195,107,0.07)", color("--warn", "#ffc36b"), false);
    ctx.restore();
  }

  function polygonFields(points, onChange) {
    return h("div", { class: "mh-vertices" }, points.map((p, i) =>
      h("div", { class: "mh-vertex" }, h("span", {}, String(i + 1)),
        UI.numField("X%", p.x, (v) => { p.x = round(clamp(v)); onChange(); }, 0.1, 0, 100),
        UI.numField("Y%", p.y, (v) => { p.y = round(clamp(v)); onChange(); }, 0.1, 0, 100),
        h("button", { class: "btn btn-sm", title: "删除顶点", disabled: points.length <= 3 ? "disabled" : null,
          onclick: () => { if (points.length <= 3) return; points.splice(i, 1); onChange(); MapEditor.inspector(); } }, "×"))));
  }

  function addVertexButton(points) {
    return h("button", { class: "btn btn-sm", onclick: () => {
      if (points.length < 2) return;
      let index = 0, length = -1;
      points.forEach((p, i) => {
        const a = screenPoint(p), b = screenPoint(points[(i + 1) % points.length]);
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        if (distance > length) { index = i; length = distance; }
      });
      const a = points[index], b = points[(index + 1) % points.length];
      points.splice(index + 1, 0, { x: round((a.x + b.x) / 2), y: round((a.y + b.y) / 2) });
      changed(); MapEditor.inspector();
    } }, "在最长边新增顶点");
  }

  function inspector() {
    const tool = MapEditor.tool;
    if (!MapEditor.showAllLayers && !["walkable", "spawn"].includes(tool)) return;
    const el = $("#inspector"), sc = ensureScene(App.project.scene);
    const children = [
      h("p", { class: "mh-note" }, "仅配置鲸鱼娘的落脚区域。逐点点击画轮廓，点首点闭合；选中后拖顶点或整体移动。"),
      MapEditor.layerVisible("walkable") ? h("button", { class: "btn btn-sm", onclick: () => startDraft(true) }, "＋ 可行动区") : null,
    ];
    if (state.draft) children.push(h("div", { class: "mh-actions" },
      h("span", { class: "mh-note" }, "正在画" + "可行动区" + "：" + state.draft.points.length + " 点"),
      h("button", { class: "btn btn-sm", onclick: finishDraft }, "闭合轮廓"),
      h("button", { class: "btn btn-sm", onclick: cancelDraft }, "取消")));
    if (MapEditor.tool === "walkable" && !state.draft) {
      const regions = sc.walkable || [], points = regions[state.region] || [];
      children.push(h("p", { class: "mh-note" }, "多个可行动区合并生效。拖顶点调整；鲸鱼娘松手后落回任一区域并避开原物件碰撞框。"),
        UI.selectField("当前可行动区", regions.map((_, i) => ({ value: String(i), label: "区域 " + (i + 1) })), String(state.region),
          (v) => { state.region = +v; MapEditor.render(); MapEditor.inspector(); }),
        h("div", { class: "mh-actions" },
          h("button", { class: "btn btn-sm", onclick: () => startDraft() }, "重画当前区域"),
          h("button", { class: "btn btn-sm", onclick: () => {
            regions.splice(state.region, 1); state.region = Math.max(0, Math.min(state.region, regions.length - 1));
            changed(); MapEditor.inspector();
          } }, "删除当前区域")),
        polygonFields(points, changed), addVertexButton(points),
        h("button", { class: "btn btn-sm", onclick: () => { delete sc.walkable; state.region = 0; changed(); MapEditor.inspector(); } }, "恢复原场景矩形"));
    }
    if (MapEditor.tool === "spawn") children.push(
      UI.numField("出生点 X（原世界坐标）", round(sc.spawn.x), (v) => { sc.spawn.x = v; changed(); }, 1),
      UI.numField("出生点 Y（原世界坐标）", round(sc.spawn.y), (v) => { sc.spawn.y = v; changed(); }, 1));
    const title = tool === "spawn" ? "鲸鱼娘出生点" : "可行动区";
    const panel = UI.section(title, ...children);
    panel.className = "mh-panel";
    el.insertBefore(panel, el.children[2] || null);
  }

  // The original seat bridge still computes seats/cap. Add only scene geometry
  // and keep every unrelated setting from the current source SCENES.v1.
  function sceneConfig(sc, previous, originalFields, image) {
    const img = image || MapEditor.bgImg;
    const point = (p) => { const v = worldToPct(p, sc, img); return { x: round(v.x), y: round(v.y) }; };
    const collisions = (sc.objects || []).filter((o) => o.collision).map((o) => {
      const c = o.collision;
      const a = point({ x: c.x, y: c.y + c.h });
      const b = point({ x: c.x + c.w, y: c.y });
      return { x: a.x, y: a.y, w: round(b.x - a.x), h: round(b.y - a.y) };
    });
    const regions = copyRegions(sc.walkable);
    const walkable = regions.length ? regions :
      [[point({ x: 0, y: sc.bgH }), point({ x: sc.bgW, y: sc.bgH }),
        point({ x: sc.bgW, y: 0 }), point({ x: 0, y: 0 })]];
    const out = Object.assign({}, previous || {}, originalFields, {
      spawn: point(sc.spawn || { x: sc.bgW / 2, y: sc.bgH / 2 }),
      walkable, collisions,
    });
    // Older exports may contain retired trigger geometry; never write it back.
    delete out.hotspots;
    // 图片像素与编辑器世界坐标是两回事，升级高清底图不能改变已标定的座位。
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      out.w = img.naturalWidth; out.h = img.naturalHeight;
    }
    if (sc.layoutRatio !== undefined) out.layoutRatio = sc.layoutRatio;
    if (sc.pod) out.pod = {...sc.pod};
    return out;
  }

  function runtimeKey(sc) {
    return sc.runtimeKey || (sc.id === 'sm1hnlk' ? 'v1' : sc.id === 's_default' ? 'embodied' : 'scene_' + sc.id);
  }
  async function exportScenes(scenes, previous) {
    const out = Object.assign({}, previous || {}), used = new Set();
    for (const sc of scenes) {
      const key = runtimeKey(sc);
      if (used.has(key)) throw new Error('办公室运行键重复：' + key);
      used.add(key);
      const img = await new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('场景图片无法读取：' + sc.bg));
        image.src = '/resource/scene/' + String(sc.bg || '').replace(/^.*resource\/scene\//, '');
      });
      const seats = (sc.seats || []).map(seat => {
        const p = worldToPct(seat, sc, img);
        return {id:seat.id,x:round(p.x),y:round(p.y),label:seat.label || ''};
      });
      // 时代身份来自持久运行键，与用户当前选中哪张图或场景数组顺序无关。
      out[key] = sceneConfig(sc, out[key], {label:sc.name, editorSceneId:sc.id,
        era:key === 'embodied' ? 'embodied' : key === 'v1' ? 'legacy' : (sc.era || 'legacy'),
        bg:'resource/scene/' + String(sc.bg).replace(/^.*resource\/scene\//, ''),
        cap:Math.min(Math.max(1, Number(sc.seatCap) || seats.length), Math.max(1,seats.length)), seats}, img);
    }
    return out;
  }

  function install() {
    const read = SceneData.fromJSON;
    SceneData.fromJSON = function (j) {
      const sc = read.call(this, j);
      if (Array.isArray(j.walkable)) sc.walkable = copyRegions(j.walkable);
      if (j.layoutRatio !== undefined) sc.layoutRatio = j.layoutRatio;
      if (j.pod) sc.pod = {...j.pod};
      sc.runtimeKey = runtimeKey(j);
      sc.era = j.era || (sc.runtimeKey === 'embodied' ? 'embodied' : 'legacy');
      return sc;
    };
    const serialize = Project.prototype.toJSON;
    Project.prototype.toJSON = function () {
      const data = JSON.parse(serialize.call(this));
      data.scenes.forEach((out, i) => {
        const sc = this.scenes[i];
        if (Array.isArray(sc.walkable)) out.walkable = copyRegions(sc.walkable);
        if (sc.layoutRatio !== undefined) out.layoutRatio = sc.layoutRatio;
        if (sc.pod) out.pod = {...sc.pod};
        out.runtimeKey = runtimeKey(sc); out.era = sc.era || (out.runtimeKey === 'embodied' ? 'embodied' : 'legacy');
      });
      return JSON.stringify(data, null, 2);
    };
    const init = MapEditor.init;
    MapEditor.init = function () {
      const tools = $("#page-map .toolbar .tool-group");
      [["walkable", "▱", "可行动区"], ["spawn", "⌖", "出生点"]]
        .forEach(([key, icon, label]) => tools.append(h("button", { class: "tool", "data-tool": key,
          title: label }, h("span", { class: "tool-ico" }, icon), label)));
      tools.append(h("button", { id: "btn-map-layers", class: "tool mh-layer-toggle",
        title: "查看所有辅助层；不会改变地图数据", "aria-pressed": "false",
        onclick: () => this.setLayerOverview(!this.showAllLayers) },
        h("span", { class: "tool-ico" }, "▤"), "全层总览"));
      const result = init.call(this);
      this.canvas.addEventListener("dblclick", () => {
        if (!this.previewMode && state.draft) finishDraft();
      });
      this.canvas.addEventListener("pointercancel", () => {
        state.drag = null; this.drag = null;
      });
      document.addEventListener("keydown", (e) => {
        if (!$("#page-map").classList.contains("active") ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
        if (e.key === "Escape" && state.draft) { e.preventDefault(); cancelDraft(); }
        if (e.key === "Enter" && state.draft) { e.preventDefault(); finishDraft(); }
      });
      return result;
    };
    const setTool = MapEditor.setTool;
    MapEditor.setTool = function (tool) {
      state.draft = null; state.drag = null;
      const result = setTool.call(this, tool);
      this.inspector(); return result;
    };
    const hint = MapEditor.updateHint;
    MapEditor.updateHint = function () {
      hint.call(this);
      if (this.tool === "walkable") this.hintEl.textContent = state.draft ?
        "◇ 逐点点击画轮廓；点首点 / 双击 / Enter 闭合，Esc 取消。" :
        "◇ 点击选择轮廓，拖动顶点或内部调整；点空白画新轮廓。";
      if (this.tool === "spawn") this.hintEl.textContent = "⌖ 点击或拖动设置鲸鱼娘出生点；松手位置按可行动区与碰撞框校验。";
      if (["walkable", "spawn"].includes(this.tool)) this.hintEl.textContent += this.showAllLayers ?
        " · 已开启全层总览，仅当前工具可编辑。" : " · 仅显示当前工具的辅助层。";
    };
    const custom = () => !MapEditor.previewMode && ["walkable", "spawn"].includes(MapEditor.tool);
    const down = MapEditor.onDown, drag = MapEditor.onDrag, up = MapEditor.onUp;
    MapEditor.onDown = function (e) { return custom() ? pointerDown(e) : down.call(this, e); };
    MapEditor.onDrag = function (e) { return custom() ? pointerDrag(e) : drag.call(this, e); };
    MapEditor.onUp = function (e) {
      if (!custom()) return up.call(this, e);
      state.drag = null; this.inspector();
    };
    const render = MapEditor.render, inspect = MapEditor.inspector;
    MapEditor.render = function () { const result = render.call(this); draw(); return result; };
    MapEditor.inspector = function () { const result = inspect.call(this); inspector(); return result; };
  }

  install();
  return { worldToPct, pctToWorld, sceneConfig, exportScenes, runtimeKey, inside,
    // Useful for integration tests and callers that import a scene without UI.
    copyPoints, copyRegions, startDraft, finishDraft, state };
})();
