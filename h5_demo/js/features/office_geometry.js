/* V2A: background percentages, contain projection and release-only walk solving. */
(function (root) {
  "use strict";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function contain(cw, ch, bw, bh) {
    const scale = Math.min(cw / bw, ch / bh);
    return { cw, ch, bw, bh, scale, w: bw * scale, h: bh * scale,
      ox: (cw - bw * scale) / 2, oy: (ch - bh * scale) / 2 };
  }
  function project(p, g) { return { x: g.ox + p.x * g.w / 100, y: g.oy + p.y * g.h / 100 }; }
  function unproject(p, g) { return { x: (p.x - g.ox) / g.w * 100, y: (p.y - g.oy) / g.h * 100 }; }
  function segment(p, a, b, sx, sy) {
    const dx = (b.x - a.x) * sx, dy = (b.y - a.y) * sy;
    const t = clamp(((p.x - a.x) * sx * dx + (p.y - a.y) * sy * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function inside(p, poly) {
    let yes = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j], q = segment(p, a, b, 1, 1);
      if (Math.hypot(p.x - q.x, p.y - q.y) < 1e-7) return true;
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) yes = !yes;
    }
    return yes;
  }
  const rectPoly = r => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  function feasible(p, scene) {
    const regions = scene.walkable || [rectPoly({ x: 0, y: 0, w: 100, h: 100 })];
    return regions.some(poly => poly.length >= 3 && inside(p, poly)) && !(scene.collisions || []).some(r =>
      p.x > r.x + 1e-7 && p.x < r.x + r.w - 1e-7 && p.y > r.y + 1e-7 && p.y < r.y + r.h - 1e-7);
  }
  // The nearest point of polygon unions minus rectangles lies on an edge,
  // a vertex or an edge intersection. Compare in image pixels, not square percentages.
  function nearest(p, scene) {
    if (feasible(p, scene)) return { x: p.x, y: p.y };
    const sx = scene.w || 1536, sy = scene.h || 1024;
    const polys = (scene.walkable || [rectPoly({ x: 0, y: 0, w: 100, h: 100 })])
      .concat((scene.collisions || []).map(rectPoly));
    const edges = [], candidates = [];
    for (const poly of polys) for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      edges.push([a, b]); candidates.push(a, segment(p, a, b, sx, sy));
    }
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i], [c, d] = edges[j];
      const dx = b.x - a.x, dy = b.y - a.y, ex = d.x - c.x, ey = d.y - c.y;
      const det = dx * ey - dy * ex;
      if (Math.abs(det) < 1e-10) continue;
      const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / det;
      const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / det;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) candidates.push({ x: a.x + t * dx, y: a.y + t * dy });
    }
    let best = null, dist = Infinity;
    for (const q of candidates) if (feasible(q, scene)) {
      const v = Math.pow((q.x - p.x) * sx, 2) + Math.pow((q.y - p.y) * sy, 2);
      if (v < dist) { best = { x: q.x, y: q.y }; dist = v; }
    }
    return best; // Invalid maps are reported by the editor; never invent a walkable point.
  }
  // Each authored seat is the portrait centre. Text has its own placement;
  // employee count and label dimensions must never move a portrait anchor.
  function markerLayout(seats, g, metrics, options) {
    const padding = Math.min(4, g.cw / 8, g.ch / 8);
    const scale = options && Number.isFinite(options.scale) ? clamp(options.scale, .01, 1) : Math.min(1, g.w / 640);
    const gap = (options && Number.isFinite(options.gap) ? Math.max(0, options.gap) : 3) * scale;
    const markers = seats.map((seat, index) => {
      const anchor = project(seat, g), size = metrics[index].avatar * scale;
      return {index, anchor, x:anchor.x-size/2, y:anchor.y-size/2, w:size, h:size};
    });
    // Adjacent rows share mathematically equal clearance boundaries. Ignore
    // floating point noise at that boundary, never a visible pixel overlap.
    const overlaps = (a,b,clearance=gap) => a.x < b.x+b.w+clearance-1e-7 && a.x+a.w > b.x-clearance+1e-7 && a.y < b.y+b.h+clearance-1e-7 && a.y+a.h > b.y-clearance+1e-7;
    const labels = [];
    const labelObstacles = options && options.labelObstacles || [];
    const fullLabels=!!(options&&options.fullLabels),rowSlots=new Map();
    if(fullLabels){
      // Dense rows may have closer portrait anchors than complete text widths.
      // Spread only their labels within the window, preserving row order and
      // every authored avatar centre instead of narrowing names to ellipses.
      const rows=[];
      for(const marker of markers.slice().sort((a,b)=>a.anchor.y-b.anchor.y||a.anchor.x-b.anchor.x)){
        let row=rows.find(r=>Math.abs(r[0].anchor.y-marker.anchor.y)<=3*scale);
        if(!row){row=[];rows.push(row);}row.push(marker);
      }
      for(const row of rows){
        row.sort((a,b)=>a.anchor.x-b.anchor.x);
        const widths=row.map(m=>(metrics[m.index].labelW||m.w)*scale);
        const slotGap=gap*2+.001;
        const total=widths.reduce((a,b)=>a+b,0)+slotGap*(row.length-1);
        if(total>g.cw-2*padding)continue;
        let cursor=0,desired=0;
        row.forEach((m,i)=>{desired+=m.anchor.x-cursor-widths[i]/2;cursor+=widths[i]+slotGap;});
        cursor=clamp(desired/row.length,padding,g.cw-padding-total);
        const y=Math.max(...row.map(m=>m.y+m.h))+gap;
        row.forEach((m,i)=>{const metric=metrics[m.index];rowSlots.set(m.index,{x:cursor,y,w:widths[i],
          h:(metric.labelH||Math.max(1,(metric.h||metric.avatar)-metric.avatar))*scale});cursor+=widths[i]+slotGap;});
      }
      // Packing is necessary only when complete labels cannot each sit below
      // their own portrait. Commit a centred plan for the whole row together;
      // a per-marker greedy preference could strand the final narrow label.
      for(const row of rows){
        const own=new Set(row.map(m=>m.index));
        const centered=row.map(m=>{const metric=metrics[m.index],w=Math.min((metric.labelW||m.w)*scale,g.cw-2*padding);
          return {index:m.index,x:m.anchor.x-w/2,y:m.y+m.h+gap,w,
            h:(metric.labelH||Math.max(1,(metric.h||metric.avatar)-metric.avatar))*scale};});
        const otherRows=Array.from(rowSlots.entries()).filter(([index])=>!own.has(index)).map(([,box])=>box);
        const fits=centered.every((box,i)=>box.x>=padding-1e-7&&box.y>=padding-1e-7
          &&box.x+box.w<=g.cw-padding+1e-7&&box.y+box.h<=g.ch-padding+1e-7
          &&!markers.some(other=>overlaps(box,other,gap))&&!labelObstacles.some(other=>overlaps(box,other,gap))
          &&!otherRows.some(other=>overlaps(box,other,gap))&&!centered.slice(i+1).some(other=>overlaps(box,other,gap)));
        if(fits)centered.forEach(box=>rowSlots.set(box.index,box));
      }
    }
    for (const marker of markers) {
      const metric = metrics[marker.index];
      const width = Math.min((metric.labelW || metric.w || metric.avatar) * scale, g.cw-2*padding);
      const height = (metric.labelH || Math.max(1, (metric.h || metric.avatar)-metric.avatar)) * scale;
      // Full-map portrait labels have already been fitted to the authored
      // seat grid. Keep each capsule below its own portrait; a greedy move to
      // another side makes names appear to belong to a neighbouring desk.
      if(options&&options.fixedBelow){
        marker.label={x:marker.anchor.x-width/2,y:marker.y+marker.h+gap,w:width,h:height,compact:false};
        labels.push(marker.label);continue;
      }
      if(options&&options.rowBelow&&rowSlots.has(marker.index)){
        marker.label={...rowSlots.get(marker.index),compact:false};labels.push(marker.label);continue;
      }
      // Prefer below the portrait, then above or beside it. Only the independent
      // text block may shift or narrow; all portraits remain hard obstacles.
      const minLabelWidth=options&&Number.isFinite(options.minLabelWidth)?options.minLabelWidth:40*scale;
      const widths = fullLabels?[width]:[width, Math.min(width, Math.max(marker.w, minLabelWidth))];
      let chosen = null;
      for (const h of fullLabels?[height]:[height,Math.min(height,(metric.compactH || height/scale)*scale)]) {
        // Dense portrait rows can fit the name-only capsule between avatars,
        // even when the decorative three-pixel gap does not fit. Keep actual
        // click rectangles disjoint before resorting to hiding a name.
        const clearance=h<height?0:gap;
        for (const w of widths) {
          const candidates = [
            ...(rowSlots.has(marker.index)?[rowSlots.get(marker.index)]:[]),
            {x:marker.anchor.x-w/2,y:marker.y+marker.h+clearance},
            {x:marker.anchor.x-w/2,y:marker.y-clearance-h},
            {x:marker.x+marker.w+clearance,y:marker.anchor.y-h/2},
            {x:marker.x-clearance-w,y:marker.anchor.y-h/2},
          ];
          for (const p of candidates) {
            const box = {x:clamp(p.x,padding,Math.max(padding,g.cw-padding-w)),
              y:clamp(p.y,padding,Math.max(padding,g.ch-padding-h)),w,h,compact:h<height};
            if (!markers.some(other => overlaps(box,other,clearance)) && !labels.some(other => overlaps(box,other,clearance))
                && !labelObstacles.some(other => overlaps(box,other,clearance))) {
              chosen = box; break;
            }
          }
          if (chosen) break;
        }
        if (chosen) break;
      }
      marker.label = chosen;
      if (chosen) labels.push(chosen);
    }
    return {scale, gap, padding, markers, labels, obstacles:markers.concat(labels)};
  }
  function safeWhalePoint(p, scene, g, boxes, size) {
    // A label rectangle excludes every foot position whose full sprite overlaps it.
    const collisions = (scene.collisions || []).concat(boxes.map(b => {
      const a = unproject({x:b.x-size.w/2-2, y:b.y-2}, g);
      return {x:a.x, y:a.y, w:(b.w+size.w+4)/g.w*100, h:(b.h+size.h+4)/g.h*100};
    }));
    const x = size.w / g.w * 50, y = size.h / g.h * 100;
    collisions.push({x:-1000,y:-1000,w:1000+x,h:2100},
      {x:100-x,y:-1000,w:1000,h:2100}, {x:-1000,y:-1000,w:2100,h:1000+y},
      {x:-1000,y:100,w:2100,h:1000});
    return nearest(p, Object.assign({}, scene, {collisions}));
  }
  // Foot coordinates in visible game pixels. Keep the full actor and its return
  // control inside the viewport and away from existing controls after release.
  function floatingFoot(p, bounds, size, obstacles) {
    const gap=4, minX=bounds.x+size.w/2+gap, maxX=bounds.x+bounds.w-size.w/2-gap;
    const minY=bounds.y+size.h+gap, maxY=bounds.y+bounds.h-gap;
    if(maxX<minX||maxY<minY)return null;
    const xs=[clamp(p.x,minX,maxX)],ys=[clamp(p.y,minY,maxY)];
    const boxes=(obstacles||[]).filter(b=>b.w>0&&b.h>0);
    for(const b of boxes){xs.push(clamp(b.x-size.w/2-gap,minX,maxX),clamp(b.x+b.w+size.w/2+gap,minX,maxX));
      ys.push(clamp(b.y-gap,minY,maxY),clamp(b.y+b.h+size.h+gap,minY,maxY));}
    let best=null,cost=Infinity;
    for(const x of new Set(xs))for(const y of new Set(ys)){const d=(x-p.x)**2+(y-p.y)**2;if(d>=cost)continue;
      const r={x:x-size.w/2,y:y-size.h,w:size.w,h:size.h};
      if(boxes.some(b=>r.x<b.x+b.w+gap&&r.x+r.w>b.x-gap&&r.y<b.y+b.h+gap&&r.y+r.h>b.y-gap))continue;
      cost=d;best={x,y};if(d===0)return best;}
    return best;
  }
  const api = { contain, project, unproject, inside, feasible, nearest, rectPoly, clamp, markerLayout, safeWhalePoint, floatingFoot };
  root.OfficeGeometry = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
