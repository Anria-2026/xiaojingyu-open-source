/* ==========================================================================
   核心：坐标系 + 项目数据模型（可拓展，未来所有编辑器功能共用）
   --------------------------------------------------------------------------
   世界坐标系约定（2D 正交，无 Z 轴/无等轴测透视）：
     - x 向右，y 向上，(0,0) 永远 = 玩家游戏画面的左下角
     - 场景图尺寸(bgW x bgH) = 真实场景大小 = 玩家可行动区域
     - 场景图左下角导入时对齐零点 (0,0)，直接平铺到屏幕上
   ========================================================================== */
"use strict";

/* ---------------------------------------------------------------- 配置同步守卫 --
   2026-09-05 架构修复：game_cfg.json 的 mtime 由 /api/game-cfg 下发，各工具页
   记录加载时刻的 mtime；保存时回传 expectMtime——文件若在编辑器打开期间被外部
   （手工/脚本/另一会话）改过，服务端直接拒绝保存，杜绝「编辑器旧快照覆盖外部修复」。
   保存成功后用响应里的新 mtime 刷新，保证「保存全部」的分页链式写入不被误伤。 */
window.CfgSync = {
  mtime: 0,
  note(j) { if (j && typeof j.mtime === "number") this.mtime = j.mtime; },
  expect() { return this.mtime || undefined; },
  update(m) { if (typeof m === "number") this.mtime = m; },
};

/* 设备取景框比例预设（宽:高），选择后取景框大小调整时比例保持不变 */
const ASPECTS = {
  pc:      { w: 16,  h: 9 },    // PC 网页端
  phone_h: { w: 19.5, h: 9 },   // 手机横屏
  phone_v: { w: 9,  h: 19.5 },  // 手机竖屏
};

/* 主角世界高度（世界单位）：编辑器与运行时统一，保证"预览即所见" */
const PLAYER_WORLD_H = 180;

/* ---------------------------------------------------------------- 坐标系 -- */
/**
 * 2D 正交坐标系（本游戏为 2D，无 Z 轴/无等轴测透视）：
 *   - x 向右，y 向上，(0,0) = 玩家画面左下角
 *   - 场景图直接平铺：左下角贴 (0,0)，宽度/高度即世界范围
 *   - 屏幕映射：screenX = ox + wx*k；screenY = oy + (sceneH - wy)*k（y 向上）
 */
class Coord {
  constructor() {
    this.ox = 0;     // 场景左下角 屏幕位置
    this.oy = 0;
    this.s = 1;      // 每世界单位像素(基础缩放)
    this.zoom = 1;   // 摄像机缩放
    this.sceneH = 0; // 场景高度，用于 y 轴翻转
  }

  /** 布局：场景矩形 contain 适配画布（居中） */
  layout(cw, ch, sceneW, sceneH) {
    const pad = 24;
    const availW = Math.max(120, cw - pad * 2);
    const availH = Math.max(120, ch - pad * 2);
    this.s = Math.max(0.02, Math.min(availW / sceneW, availH / sceneH));
    this.ox = (cw - sceneW * this.s) / 2;
    this.oy = (ch - sceneH * this.s) / 2;
    this.sceneH = sceneH;
  }

  /** 世界 -> 屏幕（y 向上，屏幕 y 向下） */
  worldToScreen(wx, wy) {
    const k = this.s * this.zoom;
    return { x: this.ox + wx * k, y: this.oy + (this.sceneH - wy) * k };
  }

  /** 屏幕 -> 世界 */
  screenToWorld(sx, sy) {
    const k = this.s * this.zoom;
    return { x: (sx - this.ox) / k, y: this.sceneH - (sy - this.oy) / k };
  }
}

/* ------------------------------------------------------------ 物件数据 -- */
class ObjectData {
  constructor() {
    this.id = "o" + (Math.random().toString(36).slice(2, 8));
    this.name = "物件";
    this.src = "";          // 素材图（resource/event/ 下文件名 或 dataURL）
    this.x = 0; this.y = 0; // 世界坐标（物件底部中心锚点）
    this.w = 120; this.h = 80;
    this.scale = 1;
    this.collision = null;  // {x,y,w,h} 世界坐标矩形；null = 无碰撞
    this.depthOffset = 0;   // 层级微调（世界 y）
  }

  static fromJSON(j) {
    const o = new ObjectData();
    Object.assign(o, j);
    return o;
  }
}

/* ------------------------------------------------------------ 场景数据 -- */
class SceneData {
  constructor(name) {
    this.id = "s" + (Math.random().toString(36).slice(2, 8));
    this.name = name || "新场景";
    this.bg = "";           // 场景图文件名（resource/scene/）
    this.bgW = 2048; this.bgH = 2048;  // 真实场景大小 = 可行动区域
    this.spawn = null;                 // 出生点（玩家进入位置），null=未设
    // 取景框：世界单位宽高 + 设备比例 + 相对出生点的 Y 轴偏移（主角有高度，
    // 中心=脚底会显示不全，默认 -80 让主角整体进画面）
    this.camera = { w: 900, h: 600, zoom: 1, device: "pc", centerOffsetY: -80 };
    this.player = { src: "stand.webp", scale: 1 };
    this.objects = [];
    /* 2026-08-30 办公室新 UI：座位区（工程师头像摆放位置）。
       seats = [{id, x, y, label}]（世界坐标）；seatCap = 该地图可招聘人数上限。 */
    this.seats = [];
    this.seatCap = 4;
  }

  static fromJSON(j) {
    const s = new SceneData();
    s.id = j.id || s.id;
    s.name = j.name || "场景";
    s.bg = j.bg || "";
    s.bgW = j.bgW || 2048;
    s.bgH = j.bgH || 2048;
    s.spawn = (j.spawn && j.spawn.x !== undefined) ? j.spawn : null;
    s.camera = Object.assign({ w: 900, h: 600, zoom: 1, device: "pc", centerOffsetY: -80 }, j.camera);
    s.player = Object.assign({ src: "stand.webp", scale: 1 }, j.player);
    s.objects = (j.objects || []).map(ObjectData.fromJSON);
    s.seats = (j.seats || []).map((x) => ({
      id: x.id || ("seat" + Math.random().toString(36).slice(2, 6)),
      x: +x.x || 0, y: +x.y || 0, label: x.label || "",
    }));
    s.seatCap = j.seatCap != null ? +j.seatCap : Math.max(1, s.seats.length || 4);
    return s;
  }
}

/* ------------------------------------------------------------ 项目数据 -- */
class Project {
  constructor() {
    this.version = 1;
    this.scenes = [];
    this.active = 0;   // 当前编辑场景下标
  }

  get scene() { return this.scenes[this.active]; }

  addScene(name) {
    const s = new SceneData(name || ("场景" + (this.scenes.length + 1)));
    this.scenes.push(s);
    this.active = this.scenes.length - 1;
    return s;
  }

  toJSON() {
    return JSON.stringify({
      version: this.version,
      scenes: this.scenes.map((s) => ({
        id: s.id, name: s.name, bg: s.bg, bgW: s.bgW, bgH: s.bgH,
        spawn: s.spawn, camera: s.camera, player: s.player,
        objects: s.objects,
        seats: s.seats, seatCap: s.seatCap,
      })),
      active: this.active,
    }, null, 2);
  }

  static fromJSON(data) {
    const p = new Project();
    try {
      const j = typeof data === "string" ? JSON.parse(data) : data;
      p.scenes = (j.scenes || []).map(SceneData.fromJSON);
      p.active = Math.min(j.active || 0, Math.max(0, p.scenes.length - 1));
    } catch (e) { /* 空项目 */ }
    if (p.scenes.length === 0) p.addScene("场景1");
    return p;
  }
}
