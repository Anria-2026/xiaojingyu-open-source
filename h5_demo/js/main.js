/* ==========================================================================
   2D 运行时（游戏端）—— 消费配置数据
   --------------------------------------------------------------------------
   数据来源：/data/project.json（由 server 同步生成）
   - 场景图直接平铺，2D 正交，x 右 y 上，(0,0) 左下角
   - 相机 = 场景的摄像机取景框（尺寸），中心跟随玩家
   - 点击移动 + 碰撞框阻挡（贴边滑动）
   - 层级：按世界 y 深度排序
   ========================================================================== */
"use strict";

const $ = (s, r = document) => r.querySelector(s);

/* 主角世界高度（世界单位）：与配置统一，保证配置预览 = 实际游戏 */
const PLAYER_WORLD_H = 180;

const Game = {
  canvas: null,
  ctx: null,
  project: null,
  scene: null,
  bgImg: null,
  playerImg: null,
  objImgs: {},
  px: 0, py: 0, facing: -1,
  target: null,
  speed: 260,
  moving: false,
  jumpPhase: 0,          // 蹦跳相位(0~1 循环)
  jumpCycle: 0.34,       // 一次跳跃周期(秒)
  jumpHeight: 60,        // 跳高(世界单位)
  playerBody: { w: 52, h: 28 },
  camW: 900, camH: 600,
  backdrop: null,        // 预烘焙的"淡蓝+模糊"兜底背景（场景图之外，避免穿帮）
  _last: 0,
  _prevJump: 0,          // 蹦跳相位（用于触发移动音效）
  camPush: 0,            // 进游戏镜头缓动推进进度(0→1)
  camPushActive: false,  // 是否处于推进动画中

  async init() {
    this.canvas = $("#game");
    this.ctx = this.canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.scheduleResize());
    this.canvas.addEventListener("pointerdown", (e) => this.onTap(e));
    /* 2026-09-24（iOS 三轮）：补 touchstart 通道——无 Pointer Events 的苹果设备上
       点击移动整条哑火（touches[0] 才有 clientX/Y）。一次点按双事件同值双触发，
       onTap 只是重设同一 target，无害。 */
    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches[0]) this.onTap(e.touches[0]);
    }, { passive: true });

    // 玩法界面与音效初始化
    window.Training && Training.init();
    window.SFX && SFX.init();
    /* 2026-08-30：删掉「小鲸鱼房间」中间步骤——btn-train 不再显示（元素与配置功能保留） */

    const res = await fetch("./data/project.json", { cache: "no-store" });
    if (!res.ok) {
      console.warn("[Game] 未找到项目数据（data/project.json），使用出厂默认");
      return;
    }
    this.project = await res.json();
    await this.loadScene(this.project.scenes[this.project.active || 0]);
    // 资源全部就绪（await 返回后黑幕才渐出）——镜头从此刻起缓动向前推进
    this.camPush = 0;
    this.camPushActive = true;
  },

  resize() {
    // DPR 封顶 2：手机高 DPR 全屏画布渲染面积成本陡增且不可见，2x 观感几乎无差
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 只在「尺寸明显变化/首次」时重烘焙：移动端 resize 极频繁（地址栏收起/弹出，
    // 常来回抖动几 px~几十 px），小抖动直接复用旧烘焙、渲染时拉伸即可，不再整屏重画。
    // （重烘焙 = 新建离屏画布 + 重画整屏，是移动端 GPU 卡死/遮罩残留的最大嫌疑之一）
    const big = !this.backdrop
      || Math.abs(w - this._cw) > 48
      || Math.abs(h - this._ch) > 48;
    if (big) { this._cw = w; this._ch = h; this.bakeBackdrop(); }
  },

  /* resize 防抖：合并连发的 resize，只处理最后一次 */
  scheduleResize() {
    if (this._resizeT) return;
    this._resizeT = setTimeout(() => { this._resizeT = null; this.resize(); }, 120);
  },

  /* 预烘焙兜底背景：淡蓝渐变 + 场景图柔化铺满
     （一次性烘焙成离屏位图，逐帧 drawImage，避免实时模糊开销。
       柔化用"缩小再放大"实现：小图拉伸回全屏 = GPU 就近采样插值，天然柔和；
       彻底不用 ctx.filter——移动端 filter+整屏大图极易触发 GPU 崩溃/闪红/卡死。） */
  bakeBackdrop() {
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    if (!cw || !ch) return;
    // 烘焙尺寸封顶：大屏/高 DPR 下全尺寸离屏画布是纯 GPU 内存浪费；
    // 渐变+柔化场景都是低频色块，封顶后拉伸几乎无感知，却省大量显存
    const MAXD = 1600;
    const k = Math.min(1, MAXD / Math.max(cw, ch));
    const bw = Math.max(1, Math.round(cw * k));
    const bh = Math.max(1, Math.round(ch * k));
    const off = document.createElement("canvas");
    off.width = bw; off.height = bh;
    const o = off.getContext("2d");
    const g = o.createLinearGradient(0, 0, 0, bh);
    g.addColorStop(0, "#bfe6ff");
    g.addColorStop(0.5, "#d9f1ff");
    g.addColorStop(1, "#effaff");
    o.fillStyle = g;
    o.fillRect(0, 0, bw, bh);
    if (this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth > 0) {
      // 廉价柔化：先画到约 1/5 尺寸的小图，再拉伸回目标尺寸（替代 blur(24px)，开销极低）
      const ow = Math.max(1, Math.round(bw / 5));
      const oh = Math.max(1, Math.round(bh / 5));
      const small = document.createElement("canvas");
      small.width = ow; small.height = oh;
      const s = small.getContext("2d");
      s.drawImage(this.bgImg, 0, 0, ow, oh);
      o.globalAlpha = 0.6;
      o.drawImage(small, 0, 0, bw, bh);
      o.globalAlpha = 1;
    }
    this.backdrop = off;
  },

  loadScene(sc) {
    if (!sc) { console.warn("[Game] 项目没有可用场景"); return Promise.resolve(); }
    this.scene = sc;
    this.px = sc.spawn.x;
    this.py = sc.spawn.y;
    this.target = null;
    // 取景框基准宽度（防御：不超场景，避免旧脏数据把镜头拉太远导致人物过小）
    // 高度不再固定——运行时按设备屏幕宽高比自适应（见 cameraSize）
    this.camW = Math.min(sc.camera.w, sc.bgW);
    this.camH = Math.min(sc.camera.h, sc.bgH);
    // 返回 Promise：背景/主角/全部物件加载完成并完成首帧烘焙后才 resolve，
    // 让黑幕转场在资源真正就绪后再渐出，避免加载穿帮（空白→人物→场景 分帧刷出）
    const generation = this._sceneLoadGeneration = (this._sceneLoadGeneration || 0) + 1;
    this._sceneAbort?.abort();
    this._sceneAbort = typeof AbortController === 'function' ? new AbortController() : null;
    this._last = performance.now();
    if (!this._sceneLoopStarted) { this._sceneLoopStarted = true; requestAnimationFrame(t => this.loop(t)); }
    const load = (source, apply) => window.ImageResources.load(source, { signal: this._sceneAbort?.signal }).then(image => {
      if (this._sceneLoadGeneration === generation) apply(image);
    }).catch(() => {});
    this.bgImg = null; this.playerImg = null;
    const jobs = [load(sc.bg, image => { this.bgImg = image; this.bakeBackdrop(); }), load(sc.player.src, image => { this.playerImg = image; })];
    for (const object of sc.objects || []) {
      const cached = this.objImgs[object.src];
      if (cached && cached.complete && cached.naturalWidth > 0) continue;
      delete this.objImgs[object.src];
      jobs.push(load(object.src, image => { this.objImgs[object.src] = image; }));
    }
    return Promise.all(jobs).then(() => { if (this._sceneLoadGeneration === generation) this.render(); });
  },

  /* ------------------------------------------------ 相机（取景框，跟随玩家） */

  /* 动态取景框尺寸：基准用配置 16:9 取景框的宽度，高度随设备屏幕宽高比自适应。
     - PC(16:9)：结果 ≈ 原取景框，观感不变
     - 手机竖屏(9:19.5)：宽不变、高变高，纵向把竖屏填满（不再上下大片淡蓝留白）
     - 手机横屏(19.5:9)：宽不变、高变矮，横向填满
     全程 clamp 到场景边界：不超场景、不过度缩小人物。 */
  cameraSize() {
    const sc = this.scene;
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    if (!cw || !ch) return { w: this.camW, h: this.camH };
    const ar = cw / ch;                    // 屏幕宽高比（竖屏 <1，横屏 >1）
    let w = this.camW;                     // 宽保持基准
    let h = w / ar;                        // 高随比例
    if (h > sc.bgH) { h = sc.bgH; w = h * ar; }   // 高超场景 → 以高为基准回算宽
    if (w > sc.bgW) { w = sc.bgW; h = w / ar; }   // 宽仍超场景 → 以宽为基准回算高
    return { w, h };
  },

  updateCam() {
    const sc = this.scene;
    const sz = this.cameraSize();
    const hw = sz.w / 2, hh = sz.h / 2;
    const cx = hw >= sc.bgW / 2 ? sc.bgW / 2 : Math.max(hw, Math.min(sc.bgW - hw, this.px));
    // 相机中心在玩家脚底 + Y 偏移（主角有高度，偏移让主角完整进画面）
    const cyBase = this.py + (sc.camera.centerOffsetY || 0);
    const cy = hh >= sc.bgH / 2 ? sc.bgH / 2 : Math.max(hh, Math.min(sc.bgH - hh, cyBase));
    return { x: cx, y: cy, w: sz.w, h: sz.h };
  },

  view() {
    const cam = this.updateCam();
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    // 进游戏缓动推进：起点略远(0.9) easeOutCubic 缓动推进到正常(1)，更灵动
    const e = 1 - Math.pow(1 - this.camPush, 3);
    const zoom = 0.9 + 0.1 * e;
    const s = Math.min(cw / cam.w, ch / cam.h) * zoom;
    const ox = (cw - cam.w * s) / 2, oy = (ch - cam.h * s) / 2;
    return { cam, s, ox, oy };
  },

  S(wx, wy) {
    const v = this.view();
    return {
      x: v.ox + (wx - (v.cam.x - v.cam.w / 2)) * v.s,
      y: v.oy + (v.cam.h - (wy - (v.cam.y - v.cam.h / 2))) * v.s,
    };
  },

  onTap(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const w = this.screenToWorld(sx, sy);
    const sc = this.scene;
    if (w.x >= 0 && w.x <= sc.bgW && w.y >= 0 && w.y <= sc.bgH) {
      this.target = { x: w.x, y: w.y };
    }
  },

  screenToWorld(sx, sy) {
    const v = this.view();
    return {
      x: v.cam.x - v.cam.w / 2 + (sx - v.ox) / v.s,
      y: v.cam.y + v.cam.h / 2 - (sy - v.oy) / v.s,
    };
  },

  /* ------------------------------------------------ 主循环：移动+碰撞+朝向 */
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));   // 先排下一帧：异常也不中断动画循环
    try {
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this.update(dt);
      this.render();
    } catch (e) { console.error("Game loop:", e); }
  },

  update(dt) {
    // 进入游戏的镜头缓动推进：独立于玩家移动，持续推进到正常视角
    if (this.camPushActive) {
      this.camPush = Math.min(1, this.camPush + dt / 1.4);   // 约 1.4s 推进到位
      if (this.camPush >= 1) this.camPushActive = false;
    }
    if (!this.target) { this.moving = false; return; }
    this.moving = true;
    const dx = this.target.x - this.px, dy = this.target.y - this.py;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (dist <= step) {
      this.px = this.target.x; this.py = this.target.y;
      this.target = null;
      this.moving = false;
      this.jumpPhase = 0;
      return;
    }
    const nx = dx / dist, ny = dy / dist;
    // 朝向跟随屏幕水平方向（2D 即世界 x 方向）
    if (nx > 0.01) this.facing = 1;
    else if (nx < -0.01) this.facing = -1;
    // 分离轴：能动的轴才动（贴边滑动）
    const nX = this.px + nx * step, nY = this.py + ny * step;
    if (this.free(nX, this.py)) this.px = nX;
    if (this.free(this.px, nY)) this.py = nY;
    // 蹦跳相位持续前进；每起跳一次播放可爱跳音（可二次配置音效文件）
    this.jumpPhase = (this.jumpPhase + dt / this.jumpCycle) % 1;
    if (this.jumpPhase < this._prevJump && window.SFX) SFX.play("move");
    this._prevJump = this.jumpPhase;
  },

  free(x, y) {
    const b = this.playerBody;
    const pr = { x: x - b.w / 2, y: y - b.h / 2, w: b.w, h: b.h };
    for (const o of this.scene.objects || []) {
      const c = o.collision;
      if (!c) continue;
      if (pr.x < c.x + c.w && pr.x + pr.w > c.x && pr.y < c.y + c.h && pr.y + pr.h > c.y) return false;
    }
    return true;
  },

  /* ------------------------------------------------ 渲染 */
  render() {
    const ctx = this.ctx;
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    const v = this.view();
    // 兜底背景：淡蓝渐变 + 场景图模糊铺满全屏（场景图之外不再露黑/穿帮）
    if (this.backdrop) {
      ctx.drawImage(this.backdrop, 0, 0, cw, ch);
    } else {
      ctx.fillStyle = "#cfe9ff";
      ctx.fillRect(0, 0, cw, ch);
    }

    const sc = this.scene;
    // 场景图（按相机裁剪）
    if (this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth > 0) {
      const sx0 = ((v.cam.x - v.cam.w / 2) / sc.bgW) * this.bgImg.width;
      const sy0 = (1 - (v.cam.y + v.cam.h / 2) / sc.bgH) * this.bgImg.height;
      const sw = (v.cam.w / sc.bgW) * this.bgImg.width;
      const sh = (v.cam.h / sc.bgH) * this.bgImg.height;
      ctx.drawImage(this.bgImg, sx0, sy0, sw, sh, v.ox, v.oy, v.cam.w * v.s, v.cam.h * v.s);
    }

    // 物件 + 玩家（层级：世界 y 小的最后画，盖住其它）
    const actors = (sc.objects || []).map((o) => ({ kind: "obj", o }));
    actors.push({ kind: "player" });
    actors.sort((a, b) => this.depth(b) - this.depth(a));
    for (const ac of actors) {
      if (ac.kind === "obj") this.drawObject(ctx, ac.o, v);
      else this.drawPlayer(ctx, v);
    }
  },

  depth(ac) {
    if (ac.kind === "player") return this.py;
    return ac.o.y + ac.o.h * 0.3 + (ac.o.depthOffset || 0);
  },

  drawObject(ctx, o, v) {
    const p = this.S(o.x, o.y);
    const w = o.w * (o.scale || 1) * v.s;
    const h = o.h * (o.scale || 1) * v.s;
    const img = this.objImgs[o.src];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, p.x - w / 2, p.y - h, w, h);
    } else {
      ctx.fillStyle = "#444b57";
      ctx.fillRect(p.x - w / 2, p.y - h, w, h);
    }
    // 碰撞区（调试可视化：淡红，便于验证）
    if (o.collision) {
      const c = o.collision;
      const a = this.S(c.x, c.y);
      const b = this.S(c.x + c.w, c.y + c.h);
      ctx.fillStyle = "rgba(255,80,80,0.13)";
      ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
      ctx.strokeStyle = "rgba(255,107,107,0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(a.x, b.y, b.x - a.x, a.y - b.y);
    }
  },

  drawPlayer(ctx, v) {
    const p = this.S(this.px, this.py);
    const ph = PLAYER_WORLD_H * (this.scene.player.scale || 1) * v.s;   // 与配置统一
    const pw = this.playerImg && this.playerImg.complete && this.playerImg.naturalWidth > 0
      ? ph * (this.playerImg.width / this.playerImg.height) : ph * 0.75;
    // 蹦跳：移动中上下弹跳，阴影随跳高缩小
    const jump = this.moving ? Math.abs(Math.sin(this.jumpPhase * Math.PI)) : 0;
    const lift = -jump * this.jumpHeight * v.s;
    const sh = 1 - 0.32 * jump;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, pw * 0.4 * sh, pw * 0.14 * sh, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y + lift);
    ctx.scale(-this.facing, 1); // 原图朝左：朝右时镜像
    if (this.playerImg && this.playerImg.complete && this.playerImg.naturalWidth > 0) {
      ctx.drawImage(this.playerImg, -pw / 2, -ph, pw, ph);
    } else {
      ctx.fillStyle = "#5b8cff";
      ctx.fillRect(-pw / 2, -ph, pw, ph);
    }
    ctx.restore();
  },
};

/* 关键：顶层 const 不会挂到 window（只有 var/function 会），
   必须显式暴露，否则 js/menu.js 里的 window.Game 是 undefined，
   会出现"主菜单淡出后游戏从未初始化 → 白屏"。 */
window.Game = Game;

/* 游戏入口由主菜单控制在「点击进入游戏」后调用 Game.init()，
   见 js/menu.js 的 startGame()，避免与主界面加载流程抢跑。 */
