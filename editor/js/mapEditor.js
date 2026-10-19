/* ==========================================================================
   地图编辑器（2D 正交）
   --------------------------------------------------------------------------
   功能：
     - 2D 平铺渲染场景图（/resource/scene/）、网格、可行动区域
     - 物件：添加(上传/素材库) / 选择 / 拖拽移动 / 缩放 / 删除
     - 碰撞框：加物件自动生成，可取消、可二次调整（拖拽矩形）
     - 出生点：一个场景一个，点击设置
     - 层级(深度排序)：按世界Y排序满足遮挡直觉，可调 depthOffset
     - 摄像机取景框：位置/大小/缩放 可调
     - 场景列表 / 属性面板 / 保存加载
   ========================================================================== */
"use strict";

const MapEditor = {
  canvas: null,
  ctx: null,
  coord: new Coord(),
  bgImg: null,
  objImgs: {},       // src -> Image 缓存
  playerImg: null,
  tool: "select",    // select | collision | camera | seat
  selected: null,    // 选中的物件 id
  drag: null,        // 拖拽状态
  hintEl: null,
  showAllLayers: false, // 仅影响编辑视图，绝不删除或写入图层数据
  previewMode: false, // 运行预览（点击移动 + 碰撞测试）
  pv: null,          // 预览状态 {player:{x,y}, target, speed}
  loopPv: null,
  _pvLast: 0,

  /* ------------------------------------------------------------- 初始化 -- */
  init() {
    this.canvas = $("#map-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.hintEl = $("#map-hint");
    this.bindTools();
    this.bindCanvas();
    window.addEventListener("resize", () => this.resize());
    this.resize();
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
  },

  layout() {
    const sc = App.project.scene;
    this.coord.layout(this.canvas.clientWidth, this.canvas.clientHeight, sc.bgW, sc.bgH);
  },

  bindTools() {
    $$(".tool").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tool) {
          this.setTool(btn.dataset.tool);
        } else if (btn.id === "btn-add-object") {
          this.addObject();
        } else if (btn.id === "btn-add-scene") {
          App.project.addScene();
          this.onSceneChanged();
        } else if (btn.id === "btn-preview") {
          if (this.previewMode) this.stopPreview();
          else this.startPreview();
        }
      });
    });
  },

  setTool(t) {
    this.tool = t;
    this.selected = null;
    this.drag = null;
    $$(".tool[data-tool]").forEach((b) => b.classList.toggle("active", b.dataset.tool === t));
    this.updateHint();
    this.render();
  },

  /** 工具决定可见辅助层；总览开关仅用于检查各层的相互关系。 */
  layerVisible(layer) {
    if (this.showAllLayers) return true;
    const modes = {
      objects: ["select", "collision"], collision: ["collision"], player: ["spawn"],
      camera: ["camera"], seats: ["seat"], walkable: ["walkable"],
      grid: ["collision", "walkable", "camera"], bounds: ["walkable"],
    };
    return (modes[layer] || []).includes(this.tool);
  },

  setLayerOverview(enabled) {
    this.showAllLayers = !!enabled;
    const button = $("#btn-map-layers");
    if (button) {
      button.classList.toggle("active", this.showAllLayers);
      button.setAttribute("aria-pressed", String(this.showAllLayers));
    }
    this.updateHint(); this.render(); this.inspector();
  },

  updateHint() {
    const tips = {
      select: "🖱 选择/移动：单击选中物件，拖动移动。",
      collision: "▣ 障碍碰撞区：红色区域阻挡鲸鱼娘移动，属于辅助配置；点击选中后拖动框或角点调整。",
      camera: "🎥 取景框：拖动移动取景框，拖动角调整大小。",
      seat: "🪑 座位：圆心对应游戏头像中心；点击空白处添加，拖动调整；选中后右侧可改名/删除。",
    };
    this.hintEl.textContent = (tips[this.tool] || "") + (this.showAllLayers ? " · 已开启全层总览，仅当前工具可编辑。" : " · 仅显示当前工具的辅助层。");
  },

  /* ------------------------------------------------------------- 画布事件 -- */
  bindCanvas() {
    let down = false;
    this.canvas.addEventListener("pointerdown", (e) => {
      down = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.onDown(e);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (down) this.onDrag(e);
    });
    this.canvas.addEventListener("pointerup", (e) => {
      down = false;
      this.onUp(e);
    });
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const sc = App.project.scene;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      sc.camera.zoom = Math.max(0.2, Math.min(5, sc.camera.zoom * factor));
      this.layout(); this.render();
    });
  },

  onDown(e) {
    const sc = App.project.scene;
    const p = this.canvasPos(e);
    // 预览模式：点击设定移动目标
    if (this.previewMode) {
      const w = this.previewScreenToWorld(p.x, p.y);
      this.pv.target = { x: w.x, y: w.y };
      return;
    }
    const w = this.coord.screenToWorld(p.x, p.y);
    if (this.tool === "collision") {
      const obj = this.hitCollision(w) || this.hitObject(w);
      if (obj) {
        this.selected = obj.id;
        this.drag = { type: "col", obj, mode: this.colHandle(obj, w), start: { ...w }, orig: obj.collision && { ...obj.collision } };
      } else this.selected = null;
      this.render(); this.inspector();
      return;
    }
    if (this.tool === "camera") {
      const mode = this.camHandle(w);
      if (!mode) return; // 点击取景框外不响应
      // 记录按下时屏幕坐标 + 相机原始值，拖拽按屏幕增量 1:1 移动
      this.drag = {
        type: "cam", mode,
        sx: p.x, sy: p.y,
        orig: { cx: sc.camera.cx, cy: sc.camera.cy, w: sc.camera.w, h: sc.camera.h },
      };
      return;
    }
    /* 2026-08-30 办公室座位：点空白新增，点座位选中并拖动 */
    if (this.tool === "seat") {
      const hit = this.hitSeat(w);
      if (hit) {
        this.seatSel = hit.id;
        this.drag = { type: "seat", seat: hit, start: { ...w }, ox: hit.x, oy: hit.y };
      } else {
        const seat = {
          id: "seat" + Math.random().toString(36).slice(2, 6),
          x: Math.round(w.x), y: Math.round(w.y),
          label: "座位 " + (sc.seats.length + 1),
        };
        sc.seats.push(seat);
        this.seatSel = seat.id;
        this.drag = { type: "seat", seat, start: { ...w }, ox: seat.x, oy: seat.y };
        /* 2026-09-12：这里**不再**自动抬高容量 —— 用户把容量配成 4，加一个座位就被悄悄改成 5，回到游戏里看到的是「配置没生效」，实际是编辑器替他改了。容量只由用户显式输入决定；座位多于容量时在座位区给出提示（超出的座位不会被使用）。 */
      }
      this.render(); this.inspector();
      return;
    }
    // select
    const obj = this.hitObject(w);
    this.selected = obj ? obj.id : null;
    if (obj) this.drag = { type: "obj", obj, start: { ...w }, ox: obj.x, oy: obj.y };
    this.render(); this.inspector();
  },

  onDrag(e) {
    if (!this.drag) return;
    const sc = App.project.scene;
    const p = this.canvasPos(e);
    const w = this.coord.screenToWorld(p.x, p.y);
    const d = this.drag;

    if (d.type === "obj") {
      d.obj.x = Math.max(0, Math.min(sc.bgW, d.ox + (w.x - d.start.x)));
      d.obj.y = Math.max(0, Math.min(sc.bgH, d.oy + (w.y - d.start.y)));
    } else if (d.type === "seat") {
      d.seat.x = Math.max(0, Math.min(sc.bgW, Math.round(d.ox + (w.x - d.start.x))));
      d.seat.y = Math.max(0, Math.min(sc.bgH, Math.round(d.oy + (w.y - d.start.y))));
    } else if (d.type === "col" && d.obj.collision) {
      this.dragCol(d, w);
    } else if (d.type === "cam") {
      this.dragCam(d, p); // 传屏幕坐标，按屏幕增量移动
    }
    this.render();
  },

  onUp() {
    if (this.drag && this.drag.type === "col" && this.drag.obj) this.inspector();
    if (this.drag && this.drag.type === "obj" && this.drag.obj) this.inspector();
    if (this.drag && this.drag.type === "cam") this.inspector();
    this.drag = null;
  },

  canvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  },

  inBounds(w) {
    const sc = App.project.scene;
    return w.x >= 0 && w.x <= sc.bgW && w.y >= 0 && w.y <= sc.bgH;
  },

  /* --------------------------------------------------------- 命中检测 -- */
  hitObject(w) {
    const sc = App.project.scene;
    for (let i = sc.objects.length - 1; i >= 0; i--) {
      const o = sc.objects[i];
      if (this.tool === "select" && !this.showAllLayers && !o.src) continue;
      if (w.x >= o.x - o.w / 2 && w.x <= o.x + o.w / 2 && w.y >= o.y && w.y <= o.y + o.h) return o;
    }
    return null;
  },

  hitCollision(w) {
    const objects = App.project.scene.objects;
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj.collision && this.colHandle(obj, w)) return obj;
    }
    return null;
  },

  colHandle(obj, w) {
    const c = obj.collision;
    if (!c) return "move";
    const eps = 8 / this.coord.s * 2;
    const inX = Math.abs(w.x - c.x) < eps;
    const inY = Math.abs(w.y - c.y) < eps;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    if (inX && inY) return "lt";
    if (Math.abs(w.x - (c.x + c.w)) < eps && inY) return "rt";
    if (Math.abs(w.y - (c.y + c.h)) < eps && inX) return "lb";
    if (Math.abs(w.y - (c.y + c.h)) < eps && Math.abs(w.x - (c.x + c.w)) < eps) return "rb";
    if (w.x > c.x - eps && w.x < c.x + c.w + eps && w.y > c.y - eps && w.y < c.y + c.h + eps) return "move";
    return null;
  },

  dragCol(d, w) {
    const c = d.obj.collision;
    const dx = w.x - d.start.x, dy = w.y - d.start.y;
    if (!d.mode) return;
    if (d.mode === "move") { c.x += dx; c.y += dy; }
    else {
      if (d.mode.includes("t")) c.y += dy;
      if (d.mode.includes("b")) c.h += dy;
      if (d.mode.includes("l")) c.x += dx;
      if (d.mode.includes("r")) c.w += dx;
      if (c.w < 4) c.w = 4;
      if (c.h < 4) c.h = 4;
    }
    d.start = { ...w };
  },

  camHandle(w) {
    const c = App.project.scene.camera;
    const cx = c.cx, cy = c.cy, hw = c.w / 2, hh = c.h / 2;
    const eps = 10 / this.coord.s * 2;
    if (Math.abs(w.x - (cx + hw)) < eps && Math.abs(w.y - (cy + hh)) < eps) return "br";
    if (Math.abs(w.x - (cx - hw)) < eps && Math.abs(w.y - (cy - hh)) < eps) return "tl";
    if (w.x >= cx - hw && w.x <= cx + hw && w.y >= cy - hh && w.y <= cy + hh) return "move";
    return null;
  },

  dragCam(d, p) {
    const c = App.project.scene.camera;
    // 屏幕增量 -> 世界增量（1:1 跟随鼠标，不放大）
    const k = this.coord.s * this.coord.zoom;
    const dx = (p.x - d.sx) / k;
    const dy = (p.y - d.sy) / k;
    const o = d.orig;
    if (d.mode === "move") {
      // 整体移动
      c.cx = o.cx + dx;
      c.cy = o.cy + dy;
    } else if (d.mode === "br") {
      // 固定左上角，右下角(鼠标)拖动，比例锁定
      const aspect = this.cameraAspect();
      c.w = Math.max(50, o.w + dx);
      c.h = c.w / aspect;
      c.cx = o.cx + (c.w - o.w) / 2;
      c.cy = o.cy + (c.h - o.h) / 2;
    } else if (d.mode === "tl") {
      // 固定右下角，左上角(鼠标)拖动，比例锁定
      const aspect = this.cameraAspect();
      c.w = Math.max(50, o.w - dx);
      c.h = c.w / aspect;
      c.cx = o.cx - (c.w - o.w) / 2;
      c.cy = o.cy - (c.h - o.h) / 2;
    }
    this.clampCamera();
  },

  /** 当前取景框比例（宽/高），依据所选设备预设 */
  cameraAspect() {
    const dev = App.project.scene.camera.device || "pc";
    const a = ASPECTS[dev] || ASPECTS.pc;
    return a.w / a.h;
  },

  /** 切换设备预览比例：保持面积重算宽高，此后大小调整比例不变 */
  setCameraDevice(device) {
    const sc = App.project.scene, c = sc.camera;
    c.device = device;
    const a = ASPECTS[device] || ASPECTS.pc;
    const area = c.w * c.h;
    c.w = Math.max(50, Math.sqrt(area * a.w / a.h));
    c.h = Math.max(50, c.w * a.h / a.w);
    this.clampCamera();
    this.render();
    this.inspector();
  },

  /** 强制取景框留在场景内（绝不跑出场景外），非法值回退到场景中心 */
  clampCamera() {
    const sc = App.project.scene, c = sc.camera;
    if (!c.cx || !isFinite(c.cx) || !isFinite(c.cy)) {
      c.cx = sc.bgW / 2;
      c.cy = sc.bgH / 2;
    }
    const min = 50;
    c.w = Math.max(min, Math.min(sc.bgW, c.w));
    c.h = Math.max(min, Math.min(sc.bgH, c.h));
    const hw = c.w / 2, hh = c.h / 2;
    c.cx = Math.max(hw, Math.min(sc.bgW - hw, c.cx));
    c.cy = Math.max(hh, Math.min(sc.bgH - hh, c.cy));
  },

  /* ------------------------------------------------------------- 物件 -- */
  addObject() {
    // 优先从素材库(event)选择，否则上传图片
    fetch("/api/list-files/event").then(r => r.json()).then(({ files }) => {
      const overlay = h("div", { class: "modal-mask", style: "position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:99;" });
      const box = h("div", { class: "modal", style: "background:#2a2e36;border:1px solid #3d434e;border-radius:10px;padding:18px;width:420px;max-height:70vh;overflow:auto;" },
        h("h3", { style: "margin-bottom:10px;" }, "添加物件"));
      const upBtn = h("button", { class: "btn btn-primary" }, "🖼 上传图片");
      box.append(h("div", { style: "margin-bottom:10px;" }, upBtn));
      if (files.length) {
        const list = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;" });
        for (const f of files) {
          list.append(h("div", { class: "obj-pick", style: "width:70px;cursor:pointer;text-align:center;font-size:11px;",
            onclick: () => { this.createObjectFromSrc("/resource/event/" + f, f); overlay.remove(); } },
            h("img", { src: "/resource/event/" + f, style: "width:64px;height:64px;object-fit:contain;background:#22252b;border-radius:6px;" }),
            h("div", {}, f)));
        }
        box.append(h("div", { style: "margin:8px 0;color:#98a0ad;font-size:12px;" }, "素材库 (resource/event)："), list);
      }
      if (!files.length) {
        box.append(h("div", { style: "color:#98a0ad;font-size:12px;margin-bottom:8px;" }, "resource/event 暂无素材，可上传图片："));
      }
      const close = h("button", { class: "btn btn-ghost", style: "margin-top:12px;", onclick: () => overlay.remove() }, "取消");
      box.append(close);
      overlay.append(box);
      document.body.append(overlay);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
      upBtn.addEventListener("click", () => {
        const inp = $("#object-img-input");
        inp.onchange = () => {
          const file = inp.files[0];
          if (!file) return;
          const rd = new FileReader();
          rd.onload = () => {
            const img = new Image();
            img.onload = () => {
              const sc = App.project.scene;
              const w = img.width, hh = img.height;
              const scale = Math.min(1, 240 / Math.max(w, hh));
              const obj = new ObjectData();
              obj.name = file.name.replace(/\.[^.]+$/, "");
              obj.src = rd.result;
              obj.w = w * scale; obj.h = hh * scale;
              obj.x = sc.bgW / 2; obj.y = sc.bgH * 0.55;
              obj.collision = { x: obj.x - obj.w / 2, y: obj.y, w: obj.w, h: obj.h * 0.5 };
              sc.objects.push(obj);
              this.selected = obj.id;
              this.render(); this.inspector();
            };
            img.src = rd.result;
          };
          rd.readAsDataURL(file);
          overlay.remove();
        };
        inp.click();
      });
    });
  },

  createObjectFromSrc(src, name) {
    const img = new Image();
    img.onload = () => {
      this.objImgs[src] = img;   // 注册到缓存，避免显示占位
      const sc = App.project.scene;
      const scale = Math.min(1, 240 / Math.max(img.width, img.height));
      const obj = new ObjectData();
      obj.name = (name || "物件").replace(/\.[^.]+$/, "");
      obj.src = src;
      obj.w = img.width * scale; obj.h = img.height * scale;
      obj.x = sc.bgW / 2; obj.y = sc.bgH * 0.55;
      obj.collision = { x: obj.x - obj.w / 2, y: obj.y, w: obj.w, h: obj.h * 0.5 };
      sc.objects.push(obj);
      this.selected = obj.id;
      this.render(); this.inspector();
    };
    img.src = src;
  },

  deleteObject(id) {
    const sc = App.project.scene;
    sc.objects = sc.objects.filter((o) => o.id !== id);
    if (this.selected === id) this.selected = null;
    this.render(); this.inspector();
  },

  /* ------------------------------------------------------------- 渲染 -- */
  render() {
    if (this.previewMode) { this.renderPreview(); return; }
    const ctx = this.ctx;
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    ctx.clearRect(0, 0, cw, ch);
    // 地面背景（浅色地板渐变，让场景菱形"落地"而非悬在黑空）
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, "#b4bac1");
    g.addColorStop(1, "#8d939b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    this.drawFloorGrid(ctx);
    this.drawBackground(ctx);
    if (this.layerVisible("grid")) this.drawGrid(ctx);
    this.drawObjects(ctx);
    if (this.layerVisible("camera")) this.drawCamera(ctx);
    if (this.layerVisible("seats")) this.drawSeats(ctx);
    if (this.layerVisible("bounds")) this.drawSceneBounds(ctx);
  },

  /* 2026-08-30：画座位区（办公室员工头像位置） */
  drawSeats(ctx) {
    const sc = App.project.scene;
    const seats = sc.seats || [];
    if (!seats.length) return;
    const k = this.coord.s * this.coord.zoom;
    seats.forEach((st, i) => {
      const p = this.coord.worldToScreen(st.x, st.y);
      const r = 16;
      const sel = this.seatSel === st.id;
      // 光圈
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + (sel ? 6 : 2), 0, Math.PI * 2);
      ctx.fillStyle = sel ? "rgba(79, 183, 238, 0.35)" : "rgba(126, 212, 176, 0.3)";
      ctx.fill();
      // 座位圆
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = sel ? "#4fb7ee" : "#7ed4b0";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.stroke();
      // 序号
      ctx.fillStyle = "#fff";
      ctx.font = "900 13px " + getComputedStyle(document.documentElement).getPropertyValue("--font-num");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), p.x, p.y + 1);
      // 标签
      ctx.font = "700 11px " + getComputedStyle(document.documentElement).getPropertyValue("--font-main");
      ctx.fillStyle = "rgba(23,50,77,0.9)";
      ctx.fillText(st.label || ("座位 " + (i + 1)), p.x, p.y + r + 12);
    });
  },

  /* 座位命中检测（世界坐标半径 60） */
  hitSeat(w) {
    const sc = App.project.scene;
    for (const st of sc.seats || []) {
      if (Math.hypot(st.x - w.x, st.y - w.y) < 60) return st;
    }
    return null;
  },

  /** 背景地面辅助网格（大格，衬托场景矩形） */
  drawFloorGrid(ctx) {
    const ctx2 = this.ctx;
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    const step = 56;
    ctx2.strokeStyle = "rgba(255,255,255,0.10)";
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    for (let x = step; x < cw; x += step) { ctx2.moveTo(x, 0); ctx2.lineTo(x, ch); }
    for (let y = step; y < ch; y += step) { ctx2.moveTo(0, y); ctx2.lineTo(cw, y); }
    ctx2.stroke();
  },

  /** 2D 正交平铺场景图
      2026-08-30：改用 object-fit:cover 语义（与游戏 .office-bg 完全一致）。
      此前是直接拉伸填满世界矩形（fill），而游戏端是 cover 裁切——
      编辑器看到的画面和游戏里不一样，座位自然对不上。 */
  drawBackground(ctx) {
    const sc = App.project.scene;
    if (!this.bgImg || !this.bgImg.complete) return;
    const k = this.coord.s * this.coord.zoom;
    const p = this.coord.worldToScreen(0, sc.bgH); // 世界矩形左上角屏幕位置
    const W = sc.bgW * k, H = sc.bgH * k;
    const Bw = this.bgImg.naturalWidth, Bh = this.bgImg.naturalHeight;
    if (!Bw || !Bh) { ctx.drawImage(this.bgImg, p.x, p.y, W, H); return; }
    // cover：保持背景图长宽比放大到铺满世界矩形，居中裁切
    const s = Math.max(W / Bw, H / Bh);
    const dw = Bw * s, dh = Bh * s;
    ctx.drawImage(this.bgImg, p.x + (W - dw) / 2, p.y + (H - dh) / 2, dw, dh);
  },

  /** 世界坐标 → 背景图上的百分比（cover 语义；y 已翻成「从上往下」，与 CSS top 一致）
      编辑器世界 y 轴向上（y=0 在底部），游戏 CSS top 从上往下，必须翻转。 */
  seatToPct(st) {
    const sc = App.project.scene;
    const W = sc.bgW || 100, H = sc.bgH || 100;
    const Bw = (this.bgImg && this.bgImg.naturalWidth) || 0;
    const Bh = (this.bgImg && this.bgImg.naturalHeight) || 0;
    if (!Bw || !Bh) {   // 图没加载出来就退回旧的「拉伸百分比」，至少不崩
      return { x: st.x / W * 100, y: 100 - (st.y / H * 100) };
    }
    const s = Math.max(W / Bw, H / Bh);
    const offX = (W - Bw * s) / 2, offY = (H - Bh * s) / 2;
    return {
      x: ((st.x - offX) / (Bw * s)) * 100,
      y: (1 - (st.y - offY) / (Bh * s)) * 100,
    };
  },

  drawGrid(ctx) {
    const sc = App.project.scene;
    const step = Math.max(64, Math.round((sc.bgW + sc.bgH) / 24 / 64) * 64);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= sc.bgW; x += step) {
      const a = this.coord.worldToScreen(x, 0), b = this.coord.worldToScreen(x, sc.bgH);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    for (let y = 0; y <= sc.bgH; y += step) {
      const a = this.coord.worldToScreen(0, y), b = this.coord.worldToScreen(sc.bgW, y);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  },

  /** 可行动区域边界：场景外压暗 + 边界线 */
  drawSceneBounds(ctx) {
    const sc = App.project.scene;
    const p0 = this.coord.worldToScreen(0, 0);           // 左下
    const p1 = this.coord.worldToScreen(sc.bgW, sc.bgH); // 右上
    const x = p0.x, y = p1.y, w = p1.x - p0.x, h = p0.y - p1.y;
    ctx.strokeStyle = "#5b8cff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  },

  /** 深度排序后绘制物件 + 玩家 */
  drawObjects(ctx) {
    const sc = App.project.scene;
    const actors = this.layerVisible("objects") ? sc.objects.map((o) => ({ kind: "obj", o })) : [];
    if (this.layerVisible("player")) actors.push({ kind: "player" });

    // 层级排序：depthKey 小的（更靠观察者/屏幕下方）最后画，盖住其它
    actors.sort((a, b) => this.depthKey(b) - this.depthKey(a));

    for (const ac of actors) {
      if (ac.kind === "obj") this.drawObject(ctx, ac.o);
      else this.drawPlayer(ctx);
    }
  },

  /** 层级键：世界 y（底边中心）+ 高度中心 + 手动偏移 */
  depthKey(actor) {
    if (actor.kind === "player") {
      const sc = App.project.scene;
      return sc.spawn.y;
    }
    return actor.o.y + actor.o.h * 0.3 + (actor.o.depthOffset || 0);
  },

  drawObject(ctx, o) {
    // 底图已包含家具。空贴图物件只是障碍配置，不再画成实心黑块。
    if (this.tool === "collision" || !o.src) {
      if (this.layerVisible("collision")) this.drawCollision(ctx, o);
      return;
    }
    const k = this.coord.s * this.coord.zoom;   // 世界单位 -> 屏幕像素
    const p = this.coord.worldToScreen(o.x, o.y);
    const w = o.w * o.scale * k, h = o.h * o.scale * k;
    const img = this.objImgs[o.src];
    if (img && img.complete) {
      ctx.drawImage(img, p.x - w / 2, p.y - h, w, h);
    } else {
      ctx.fillStyle = "#444b57";
      ctx.fillRect(p.x - w / 2, p.y - h, w, h);
      ctx.strokeStyle = "#5b8cff"; ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
    }
    // 选中高亮
    if (this.selected === o.id) {
      ctx.strokeStyle = "#5be1b8";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - w / 2 - 2, p.y - h - 2, w + 4, h + 4);
    }
    // 碰撞框可视化
    if (this.layerVisible("collision")) this.drawCollision(ctx, o);
  },

  drawCollision(ctx, o) {
    if (!o.collision) return;
    const c = o.collision;
    const a = this.coord.worldToScreen(c.x, c.y);            // 左下
    const b = this.coord.worldToScreen(c.x + c.w, c.y + c.h); // 右上
    const x = a.x, y = b.y, w = b.x - a.x, h = a.y - b.y;
    ctx.fillStyle = "rgba(255,80,80,0.14)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ff6b6b";
    ctx.lineWidth = this.selected === o.id ? 2.5 : 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#a32732";
    ctx.font = "700 11px sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("障碍 · " + (o.name || o.id), x + 5, y + 5);
    for (const pt of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2); ctx.fill();
    }
  },

  drawPlayer(ctx) {
    const sc = App.project.scene;
    const k = this.coord.s * this.coord.zoom;   // 世界单位 -> 屏幕像素
    const p = this.coord.worldToScreen(sc.spawn.x, sc.spawn.y);
    const h = PLAYER_WORLD_H * sc.player.scale * k;   // 世界高度统一常量
    const w = this.playerImg && this.playerImg.complete ? h * (this.playerImg.width / this.playerImg.height) : h * 0.75;
    // 地面阴影
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w * 0.42, w * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();
    if (this.playerImg && this.playerImg.complete) {
      ctx.drawImage(this.playerImg, p.x - w / 2, p.y - h, w, h);
    } else {
      ctx.fillStyle = "#5b8cff";
      ctx.fillRect(p.x - w / 2, p.y - h, w, h);
    }
    // 出生点标记
    ctx.fillStyle = "#ffd76b";
    ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
  },

  drawCamera(ctx) {
    const sc = App.project.scene;
    const c = sc.camera;
    const cx = c.cx !== undefined ? c.cx : sc.bgW / 2;
    const cy = c.cy !== undefined ? c.cy : sc.bgH / 2;
    const hw = c.w / 2, hh = c.h / 2;
    const p1 = this.coord.worldToScreen(cx - hw, cy - hh);
    const p2 = this.coord.worldToScreen(cx + hw, cy - hh);
    const p3 = this.coord.worldToScreen(cx + hw, cy + hh);
    const p4 = this.coord.worldToScreen(cx - hw, cy + hh);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fillStyle = "rgba(91,140,255,0.08)";
    ctx.fill();
    ctx.strokeStyle = "#5b8cff";
    ctx.setLineDash([8, 4]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    for (const pt of [p1, p2, p3, p4]) {
      ctx.fillStyle = "#5b8cff";
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  },

  /* ------------------------------------------------------------- 场景切换 -- */
  loadScene(sc) {
    this.selected = null;
    if (!sc.spawn) sc.spawn = { x: sc.bgW / 2, y: sc.bgH * 0.6 }; // 未设出生点→场景中心偏下
    // 取景框默认中心固定在出生点（含 Y 偏移，仅当未设置/非法时）
    if (sc.camera.cx === undefined || !isFinite(sc.camera.cx)) {
      sc.camera.cx = sc.spawn.x;
      sc.camera.cy = sc.spawn.y + (sc.camera.centerOffsetY || 0);
    }
    this.clampCamera(); // 取景框强制留在场景内（含脏数据兜底）
    this.bgImg = new Image();
    this.bgImg.onload = () => { this.layout(); this.render(); };
    this.bgImg.src = sc.bg ? "/resource/scene/" + sc.bg : "";
    // 加载物件图
    sc.objects.forEach((o) => this.loadImg(o.src));
    const pSrc = "/resource/character/" + sc.player.src;
    this.loadImg(pSrc);
    this.playerImg = this.objImgs[pSrc];
    this.layout();
    this.render();
    this.inspector();
  },

  loadImg(src) {
    if (!src || this.objImgs[src]) return;
    const img = new Image();
    this.objImgs[src] = img;
    img.onload = () => { if (!this.previewMode) this.render(); }; // 加载完成自动重绘
    img.src = src;
  },

  onSceneChanged() {
    this.loadScene(App.project.scene);
    this.renderScenes();
    this.render();
  },

  /* ------------------------------------------------------------- 属性面板 -- */
  inspector() {
    const el = $("#inspector");
    UI.clear(el);
    const sc = App.project.scene;

    // 场景列表
    el.append(UI.section("场景列表",
      h("div", { class: "scene-list" },
        App.project.scenes.map((s, i) => h("button", {
          class: "scene-chip" + (i === App.project.active ? " active" : ""),
          onclick: () => { App.project.active = i; this.onSceneChanged(); },
        }, s.name))),
      h("button", { class: "btn btn-sm", style: "margin-top:6px;", onclick: () => { App.project.addScene(); this.onSceneChanged(); } }, "➕ 新建场景")
    ));

    // 场景属性
    el.append(UI.section("场景属性",
      UI.textField("场景名", sc.name, (v) => { sc.name = v; this.renderScenes(); }),
      h("div", { class:"field" }, h("label",{},"游戏使用阶段"),
        h("div",{style:"font-size:13px;color:#6390ae;line-height:1.6;"},
          sc.runtimeKey === "embodied" || sc.id === "s_default" ? "新办公室 · V5 / V5.5，支持聚焦，开智后鲸鱼娘出舱" :
          sc.runtimeKey === "v1" || sc.id === "sm1hnlk" ? "旧办公室 · V1 至 V4.5，办公室不显示鲸鱼娘" : "自定义场景（未绑定主线阶段）")),
      UI.selectField("场景图", (window.__sceneFiles || []).map((f) => ({ value: f, label: f })),
        sc.bg, (v) => { sc.bg = v; this.loadScene(sc); }),
      h("div", { class: "field" }, h("label", {}, "编辑坐标范围"),
        h("div", { style: "font-size:13px;color:#98a0ad;" }, `${sc.bgW} × ${sc.bgH}`)),
      this.bgImg && this.bgImg.naturalWidth ? h("div", { class: "field" }, h("label", {}, "底图像素"),
        h("div", { style: "font-size:13px;color:#98a0ad;" }, `${this.bgImg.naturalWidth} × ${this.bgImg.naturalHeight}`)) : null,
      this.layerVisible("player") ? UI.section("出生点",
        UI.numField("Y", Math.round(sc.spawn.y), (v) => { sc.spawn.y = v; this.render(); })) : null,
      this.layerVisible("camera") ? UI.section("摄像机取景框",
        UI.selectField("设备预览", [
          { value: "pc", label: "PC 网页端 (16:9)" },
          { value: "phone_h", label: "手机横屏 (19.5:9)" },
          { value: "phone_v", label: "手机竖屏 (9:19.5)" },
        ], sc.camera.device || "pc", (v) => this.setCameraDevice(v)),
        UI.numField("取景框大小(宽)", Math.round(sc.camera.w), (v) => {
          const aspect = this.cameraAspect();
          sc.camera.w = Math.max(50, v);
          sc.camera.h = sc.camera.w / aspect;
          this.clampCamera(); this.render();
        }),
        h("div", { class: "field" }, h("label", {}, "高(按比例自动)"),
          h("div", { style: "font-size:13px;color:#98a0ad;" }, Math.round(sc.camera.h) + " px")),
        UI.numField("中心X", Math.round(sc.camera.cx), (v) => { sc.camera.cx = v; this.clampCamera(); this.render(); }),
        UI.numField("中心Y", Math.round(sc.camera.cy), (v) => { sc.camera.cy = v; this.clampCamera(); this.render(); }),
        UI.numField("Y轴偏移", sc.camera.centerOffsetY ?? -80, (v) => {
          // 若取景框当前仍"居中于出生点"，调偏移时让它实时跟随
          const wasCentered = Math.abs(sc.camera.cx - sc.spawn.x) < 1 &&
            Math.abs(sc.camera.cy - (sc.spawn.y + (sc.camera.centerOffsetY || 0))) < 1;
          sc.camera.centerOffsetY = v;
          if (wasCentered) {
            sc.camera.cx = sc.spawn.x;
            sc.camera.cy = sc.spawn.y + v;
          }
          this.clampCamera(); this.render();
        }, 10),
        h("button", { class: "btn btn-sm", style: "margin-top:4px;",
          onclick: () => { sc.camera.cx = sc.spawn.x; sc.camera.cy = sc.spawn.y + (sc.camera.centerOffsetY || 0); this.clampCamera(); this.render(); this.inspector(); } },
          "🎯 居中到出生点"),
        UI.numField("视图缩放", sc.camera.zoom, (v) => { sc.camera.zoom = Math.max(0.2, Math.min(5, v)); this.layout(); this.render(); }, 0.1)) : null,
      this.layerVisible("player") ? UI.section("鲸鱼娘",
        UI.numField("缩放", sc.player.scale, (v) => { sc.player.scale = Math.max(0.2, v); this.render(); }, 0.1)) : null
    ));

    /* 2026-08-30 办公室座位区：容量 = 可招聘人数上限；座位坐标 = 员工头像位置 */
    /* 2026-09-12（用户反馈「配置的人数上限不生效」）：这个输入框写的是编辑器自己的
       `sc.seatCap`，要等「保存全部」时由 App.syncAllConfigs 映射成游戏的 SCENES.v1.cap；
       而**自动保存只写项目 JSON、不同步配置**（2026-09-05 起）——只按自动保存的话，
       这里改的容量永远进不了游戏。所以改完立刻点亮「保存全部」，并把规则写在下面。 */
    const seats = sc.seats || [];
    const selSeat = seats.find((x) => x.id === this.seatSel);
    const capNow = sc.seatCap || seats.length;
    const seatChildren = [
      UI.numField("容量（可招人数上限）", capNow, (v) => {
        sc.seatCap = Math.max(1, Math.round(v));
        if (window.App && App.markCfgDirty) App.markCfgDirty();
        this.render();
      }),
      h("div", { style: "font-size:12px;color:#98a0ad;margin:4px 0 2px;" },
        "游戏内可招人数上限 = min(容量, 座位数)；改完要点右上角「保存全部」才会同步到游戏。"
        + (seats.length > capNow ? " ⚠️ 当前有 " + (seats.length - capNow) + " 个座位超出容量，超出的座位不会被使用。" : "")),
      h("div", { class: "object-list" },
        seats.map((st, i) => h("div", {
          class: "object-item" + (this.seatSel === st.id ? " selected" : ""),
          onclick: () => { this.setTool("seat"); this.seatSel = st.id; this.render(); this.inspector(); },
        },
          h("span", { class: "name" }, (i + 1) + ". " + (st.label || "座位")),
          h("span", { class: "del", onclick: (ev) => {
            ev.stopPropagation();
            sc.seats = sc.seats.filter((x) => x.id !== st.id);
            if (this.seatSel === st.id) this.seatSel = null;
            this.render(); this.inspector();
          } }, "✕")))),
    ];
    if (selSeat) {
      seatChildren.push(
        UI.textField("座位名称", selSeat.label, (v) => { selSeat.label = v; this.render(); this.inspector(); }),
        UI.numField("X", Math.round(selSeat.x), (v) => { selSeat.x = v; this.render(); }),
        UI.numField("Y", Math.round(selSeat.y), (v) => { selSeat.y = v; this.render(); }),
        h("button", { class: "btn btn-sm", style: "margin-top:4px;",
          onclick: () => { this.seatSel = null; this.inspector(); } }, "完成编辑"));
    } else {
      seatChildren.push(h("div", { style: "font-size:12px;color:#98a0ad;margin-top:4px;" },
        "切到顶部「🪑 座位」工具后，点击场景空白处添加座位。"));
    }
    if (this.layerVisible("seats")) el.append(UI.section("办公室座位区 (" + seats.length + ")", ...seatChildren));

    // 物件列表
    if (this.layerVisible("objects")) el.append(UI.section((this.tool === "collision" ? "障碍碰撞区" : "物件列表") + " (" + sc.objects.length + ")",
      h("div", { class: "object-list" },
        sc.objects.map((o) => h("div", {
          class: "object-item" + (this.selected === o.id ? " selected" : ""),
          onclick: () => { this.selected = o.id; this.render(); this.inspector(); },
        },
          h("img", { class: "thumb", src: o.src.startsWith("data:") ? o.src : "/resource/event/" + o.src }),
          h("span", { class: "name" }, o.name),
          h("span", { class: "del", onclick: (ev) => { ev.stopPropagation(); this.deleteObject(o.id); } }, "✕"))))
    ));

    // 选中物件属性
    const obj = sc.objects.find((o) => o.id === this.selected);
    if (obj && this.layerVisible("objects")) {
      el.append(UI.section((this.tool === "collision" ? "障碍属性 — " : "物件属性 — ") + obj.name,
        UI.textField("名称", obj.name, (v) => { obj.name = v; this.render(); this.inspector(); }),
        UI.numField("X", Math.round(obj.x), (v) => { obj.x = v; this.render(); }),
        UI.numField("Y", Math.round(obj.y), (v) => { obj.y = v; this.render(); }),
        UI.numField("宽", Math.round(obj.w), (v) => { obj.w = Math.max(1, v); this.render(); }),
        UI.numField("高", Math.round(obj.h), (v) => { obj.h = Math.max(1, v); this.render(); }),
        UI.numField("缩放", obj.scale, (v) => { obj.scale = Math.max(0.1, v); this.render(); }, 0.1),
        UI.numField("层级偏移", obj.depthOffset, (v) => { obj.depthOffset = v; this.render(); }, 1),
        UI.section("碰撞框",
          UI.checkField("启用碰撞", !!obj.collision, (v) => {
            if (v && !obj.collision) obj.collision = { x: obj.x - obj.w / 2, y: obj.y, w: obj.w, h: obj.h * 0.5 };
            else if (!v) obj.collision = null;
            this.render(); this.inspector();
          }),
          obj.collision ? [
            UI.numField("碰撞X", Math.round(obj.collision.x), (v) => { obj.collision.x = v; this.render(); }),
            UI.numField("碰撞Y", Math.round(obj.collision.y), (v) => { obj.collision.y = v; this.render(); }),
            UI.numField("碰撞宽", Math.round(obj.collision.w), (v) => { obj.collision.w = Math.max(1, v); this.render(); }),
            UI.numField("碰撞高", Math.round(obj.collision.h), (v) => { obj.collision.h = Math.max(1, v); this.render(); }),
          ] : []
        )
      ));
    }
  },

  renderScenes() {
    this.inspector();
  },

  /* ============================================================= 运行预览 == */
  startPreview() {
    const sc = App.project.scene;
    this.previewMode = true;
    this.pv = { player: { x: sc.spawn.x, y: sc.spawn.y }, target: null, speed: 240, jumpPhase: 0 };
    this._pvLast = performance.now();
    this.updateHint();
    this.render();
    this.loopPv = requestAnimationFrame((t) => this.pvLoop(t));
  },

  stopPreview() {
    this.previewMode = false;
    if (this.loopPv) cancelAnimationFrame(this.loopPv);
    this.loopPv = null;
    this.pv = null;
    this.updateHint();
    this.render();
  },

  pvLoop(now) {
    if (!this.previewMode) return;
    const dt = Math.min(0.05, (now - this._pvLast) / 1000);
    this._pvLast = now;
    this.updatePlayer(dt);
    this.render();
    this.loopPv = requestAnimationFrame((t) => this.pvLoop(t));
  },

  /** 预览玩家移动：AABB 碰撞，沿未阻挡的轴滑动（贴边停），移动中蹦跳 */
  updatePlayer(dt) {
    const pv = this.pv;
    if (!pv) return;
    if (!pv.target) { pv.jumpPhase = 0; return; }
    const dx = pv.target.x - pv.player.x;
    const dy = pv.target.y - pv.player.y;
    const dist = Math.hypot(dx, dy);
    const step = pv.speed * dt;
    if (dist <= step) {
      pv.player.x = pv.target.x; pv.player.y = pv.target.y;
      pv.target = null;
      pv.jumpPhase = 0;
      return;
    }
    const nx = dx / dist, ny = dy / dist;
    const nX = pv.player.x + nx * step;
    const nY = pv.player.y + ny * step;
    // 分离轴尝试：能移动的轴才移动
    if (this.pvFree(nX, pv.player.y)) pv.player.x = nX;
    if (this.pvFree(pv.player.x, nY)) pv.player.y = nY;
    // 蹦跳相位（与运行时一致）
    pv.jumpPhase = (pv.jumpPhase + dt / 0.34) % 1;
  },

  /** 玩家碰撞体在(x,y)是否自由（不与任何碰撞框相交） */
  pvFree(x, y) {
    const pr = { x: x - 26, y: y - 14, w: 52, h: 28 };
    for (const o of App.project.scene.objects) {
      const c = o.collision;
      if (!c) continue;
      if (pr.x < c.x + c.w && pr.x + pr.w > c.x && pr.y < c.y + c.h && pr.y + pr.h > c.y) return false;
    }
    return true;
  },

  /** 预览屏幕坐标 -> 世界坐标（正交取景框视图） */
  previewScreenToWorld(sx, sy) {
    const sc = App.project.scene, c = sc.camera;
    const vw = c.w, vh = c.h;
    const s2 = Math.min(this.canvas.clientWidth / vw, this.canvas.clientHeight / vh);
    const ox = (this.canvas.clientWidth - vw * s2) / 2;
    const oy = (this.canvas.clientHeight - vh * s2) / 2;
    const wx = (c.cx - vw / 2) + (sx - ox) / s2;
    const wy = (c.cy - vh / 2) + (this.canvas.clientHeight - oy - sy) / s2;
    return { x: wx, y: wy };
  },

  /** 渲染预览：正交取景框视图 + 物件/碰撞框 + 玩家 */
  renderPreview() {
    const ctx = this.ctx;
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    ctx.fillStyle = "#0e1013";
    ctx.fillRect(0, 0, cw, ch);
    const sc = App.project.scene, c = sc.camera;
    const vw = c.w, vh = c.h;
    const s2 = Math.min(cw / vw, ch / vh);
    const ox = (cw - vw * s2) / 2, oy = (ch - vh * s2) / 2;
    const S = (wx, wy) => ({ x: ox + (wx - (c.cx - vw / 2)) * s2, y: oy + (vh - (wy - (c.cy - vh / 2))) * s2 });

    // 取景框外压暗
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    if (ox > 0) ctx.fillRect(0, 0, ox, ch);
    if (oy > 0) ctx.fillRect(0, 0, cw, oy);
    ctx.fillRect(ox + vw * s2, 0, cw - ox - vw * s2, ch);
    ctx.fillRect(0, oy + vh * s2, cw, ch - oy - vh * s2);

    // 场景图（取景框裁剪）
    if (this.bgImg && this.bgImg.complete) {
      const sx0 = ((c.cx - vw / 2) / sc.bgW) * this.bgImg.width;
      const sy0 = (1 - (c.cy + vh / 2) / sc.bgH) * this.bgImg.height;
      const sw = (vw / sc.bgW) * this.bgImg.width;
      const sh = (vh / sc.bgH) * this.bgImg.height;
      ctx.drawImage(this.bgImg, sx0, sy0, sw, sh, ox, oy, vw * s2, vh * s2);
    }

    // 物件 + 碰撞框（预览按深度排序：y 大的先画，小的后画盖住）
    const actors = sc.objects.map((o) => ({ kind: "obj", o }));
    if (this.pv) actors.push({ kind: "player" });
    actors.sort((a, b) => this.pvDepth(b) - this.pvDepth(a));
    for (const ac of actors) {
      if (ac.kind === "obj") {
        const o = ac.o;
        const p = S(o.x, o.y);
        const w = o.w * o.scale * s2, h = o.h * o.scale * s2;
        const img = this.objImgs[o.src];
        if (img && img.complete) ctx.drawImage(img, p.x - w / 2, p.y - h, w, h);
        else { ctx.fillStyle = "#444b57"; ctx.fillRect(p.x - w / 2, p.y - h, w, h); }
        if (o.collision) {
          const c0 = o.collision;
          const a = S(c0.x, c0.y), b = S(c0.x + c0.w, c0.y + c0.h);
          ctx.fillStyle = "rgba(255,80,80,0.20)";
          ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
          ctx.strokeStyle = "#ff6b6b";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(a.x, b.y, b.x - a.x, a.y - b.y);
        }
      } else {
        // 玩家
        const pv = this.pv;
        const p = S(pv.player.x, pv.player.y);
        const h = PLAYER_WORLD_H * sc.player.scale * s2;   // 与运行时一致
        const w = this.playerImg && this.playerImg.complete
          ? h * (this.playerImg.width / this.playerImg.height) : h * 0.75;
        // 蹦跳（与运行时一致）
        const jump = pv.target ? Math.abs(Math.sin(pv.jumpPhase * Math.PI)) : 0;
        const lift = -jump * 60 * s2;
        const sh = 1 - 0.32 * jump;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, w * 0.4 * sh, w * 0.14 * sh, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();
        ctx.save();
        ctx.translate(p.x, p.y + lift);
        if (this.playerImg && this.playerImg.complete) ctx.drawImage(this.playerImg, -w / 2, -h, w, h);
        else { ctx.fillStyle = "#5b8cff"; ctx.fillRect(-w / 2, -h, w, h); }
        ctx.restore();
      }
    }

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "13px sans-serif";
    ctx.fillText("▶ 预览模式：点击移动，红色框不可穿越", 12, 22);
  },

  pvDepth(ac) {
    if (ac.kind === "player") return this.pv.player.y;
    return ac.o.y + ac.o.h * 0.3 + (ac.o.depthOffset || 0);
  },
};
