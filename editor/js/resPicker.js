/* ==========================================================================
   资源文件浏览选择器（2026-09-03 新增；2026-09-21 扩音频）
   --------------------------------------------------------------------------
   ResPicker.pick(currentPath, { title, kind }) → Promise<路径|null>
     · kind: "image"（默认）｜"audio"
       （2026-09-21 用户要求：「这个不要让我填路径，要按钮让我选具体的文件」
         ⇒ 对话树回答的 src 字段也接这个选择器，图片/语音都走按钮选）
   弹出模态：顶部一排目录胶囊，下面是缩略图网格（音频显示 ♪ + 文件名），
   点击即选中返回 resource/<目录>/<文件名>；也可以在输入框直接改路径。
   供玩法配置（显卡图/空态图）、界面立绘、对话树回答 src 等所有「配文件」字段复用。
   ========================================================================== */
"use strict";

/* [feature:resource-video-picker] */
window.ResPicker = (() => {
  const IMG_RE = /\.(webp|png|jpe?g|gif)$/i;
  const AUD_RE = /\.(wav|mp3|ogg|m4a|aac|flac)$/i;
  const VID_RE = /\.(mp4|webm|ogv)$/i;
  /* 音频目录名（一级）—— 与 main.js 里「排除音频目录」用的是同一份名单 */
  const AUDIO_TOP = ["sound"];
  /* ⚠️ `/api/list-dirs` 只给**一级**目录，而语音实际放在 resource/sound/voice/ 这类**子目录**里
     ⇒ 音频模式按「完整路径」探测这几个候选（哪个真有音频文件就列哪个），不需要改服务端。 */
  const AUDIO_PATHS = ["sound/BGM", "sound/sfx", "sound/voice"];

  /* 单例模态：首次调用时创建，之后复用 */
  let modal = null, grid = null, pathIn = null, curDir = "", curKind = "image", resolveFn = null;
  const isAud = () => curKind === "audio";
  const isVid = () => curKind === "video";
  const fileRe = () => (isAud() ? AUD_RE : isVid() ? VID_RE : IMG_RE);

  function ensureModal() {
    if (modal) return;
    modal = h("div", { class: "respick-overlay", hidden: "" },
      h("div", { class: "respick-card" },
        h("div", { class: "respick-head" },
          h("span", { class: "respick-title" }, "选择文件"),
          h("div", { class: "spacer" }),
          h("button", { class: "btn btn-sm btn-ghost", onclick: () => done(null) }, "取消")),
        h("div", { class: "respick-dirrow" }),
        h("div", { class: "respick-pathrow" },
          h("input", { class: "respick-path", type: "text", placeholder: "resource/目录/文件名" }),
          h("button", { class: "btn btn-sm btn-primary", onclick: () => done(pathIn.value.trim() || null) }, "用这个路径")),
        h("div", { class: "respick-grid" })));
    document.body.append(modal);
    grid = modal.querySelector(".respick-grid");
    pathIn = modal.querySelector(".respick-path");
    modal.addEventListener("click", (e) => { if (e.target === modal) done(null); });
    /* 点缩略图选中 */
    grid.addEventListener("click", (e) => {
      const item = e.target.closest("[data-path]");
      if (item) done(item.dataset.path);
    });
  }

  function done(path) {
    modal.hidden = true;
    const fn = resolveFn; resolveFn = null;
    if (fn) fn(path && window.ResourcePaths ? ResourcePaths.canonical(path) : path || null);
  }

  async function filesOf(dir) {
    try { return ((await (await fetch("/api/list-files/" + dir)).json()).files) || []; }
    catch (e) { return []; }
  }
  /* resource 下的原始目录列表（main.js 会先填 window.__resourceDirs；没填就自己拉一次） */
  async function allDirs() {
    if (window.__resourceDirs && window.__resourceDirs.length) return window.__resourceDirs;
    let dirs;
    try { dirs = ((await (await fetch("/api/list-dirs")).json()).dirs) || []; }
    catch (e) { dirs = ["character", "scene", "ui", "event"]; }
    window.__resourceDirs = dirs;
    return dirs;
  }

  async function loadDirs(dirRow) {
    let dirs;
    if (isAud()) {
      if (!window.__audioDirs) {
        const found = [];
        for (const p of AUDIO_PATHS) {
          const fs2 = await filesOf(p);
          if (fs2.some((n) => AUD_RE.test(n))) found.push(p);
        }
        if (!found.length) found.push(...(await allDirs()).filter((d) => AUDIO_TOP.includes(d.toLowerCase())));
        window.__audioDirs = found;
      }
      dirs = window.__audioDirs;
    } else {
      dirs = (await allDirs()).filter((x) => !AUDIO_TOP.includes(x.toLowerCase()));
    }
    if (!dirs.length) dirs = isAud() ? ["sound/BGM"] : isVid() ? ["story"] : ["character"];
    UI.clear(dirRow);
    dirs.forEach((dir) => {
      const chip = h("button", { class: "respick-dir" }, dir);
      chip.addEventListener("click", () => showDir(dir, dirRow));
      dirRow.append(chip);
    });
    return dirs;
  }

  async function showDir(dir, dirRow) {
    curDir = dir;
    dirRow.querySelectorAll(".respick-dir").forEach((c) =>
      c.classList.toggle("active", c.textContent === dir));
    grid.innerHTML = `<div class="respick-empty">加载中…</div>`;
    const files = (await filesOf(dir)).filter((n) => fileRe().test(n));
    UI.clear(grid);
    if (!files.length) {
      grid.append(h("div", { class: "respick-empty" }, isAud() ? "（该目录暂无音频）" : isVid() ? "（该目录暂无视频）" : "（该目录暂无图片）"));
      return;
    }
    files.forEach((n) => {
      const path = "resource/" + dir + "/" + n;
      /* 音频没法出缩略图（<img> 会 404）⇒ 用 ♪ 占位块，尺寸与图片项一致 */
      const kids = isAud() || isVid()
        ? [h("span", { class: "respick-audio" }, isVid() ? "▶" : "♪"), h("span", { class: "respick-name" }, n)]
        : [h("img", { src: "/" + path, loading: "lazy", alt: n }), h("span", { class: "respick-name" }, n)];
      grid.append(h("button", {
        class: "respick-item" + (isAud() ? " is-audio" : ""),
        type: "button", "data-path": path, title: path,
      }, ...kids));
    });
  }

  async function pick(currentPath, { title, kind } = {}) {
    if (window.ResourcePaths) currentPath = ResourcePaths.canonical(currentPath);
    curKind = ["audio","video"].includes(kind) ? kind : "image";
    ensureModal();
    modal.querySelector(".respick-title").textContent =
      (isAud() ? "♪ " : isVid() ? "▶ " : "🖼 ") + (title || (isAud() ? "选择音频" : isVid() ? "选择视频" : "选择图片"));
    pathIn.placeholder = isAud() ? "resource/sound/voice/文件名.wav" : isVid() ? "resource/story/文件名.webm" : "resource/目录/文件名.webp";
    pathIn.value = currentPath || "";
    modal.hidden = false;
    const dirRow = modal.querySelector(".respick-dirrow");
    const dirs = await loadDirs(dirRow);
    /* 默认打开当前路径所在目录（**支持子目录** sound/voice），否则第一个 */
    const m = /^resource\/(.+)\/[^/]+$/.exec(currentPath || "");
    const start = (m && dirs.includes(m[1])) ? m[1] : (dirs[0] || "");
    if (start) await showDir(start, dirRow);
    return new Promise((res) => { resolveFn = res; });
  }

  return { pick };
})();
/* [/feature:resource-video-picker] */
