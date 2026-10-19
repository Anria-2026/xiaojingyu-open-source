/* ==========================================================================
   图片处理页
   --------------------------------------------------------------------------
   功能：
     - 指定 N 张图片（多选）
     - 列表：源文件 | 目标文件名(可自定义) | 抠图 | 输出路径(快捷按钮+浏览同名替换)
     - 批量默认值：全部抠图 / 默认输出目录
     - 一键压缩：前端收集 base64 -> 后端 PIL 处理写入 resource，显示结果
   ========================================================================== */
"use strict";

const ImageTool = {
  items: [],            // {id,name,file,preview,cutout,cutoutMode,outDir,outName,status}
  batchCutout: false,
  batchCutoutMode: "auto",
  batchDir: "character",

  init() {
    $("#img-add").addEventListener("click", () => {
      const inp = $("#file-input");
      inp.onchange = () => {
        for (const f of inp.files) this.addFile(f);
        inp.value = "";
        this.render();
      };
      inp.click();
    });

    $("#img-compress").addEventListener("click", () => this.compress());

    // 批量工具条
    const wrap = $("#img-batch-tools");
    UI.clear(wrap);
    wrap.append(
      h("label", {}, "批量"),
      UI.checkField("全部抠图", this.batchCutout, (v) => {
        this.batchCutout = v;
        this.items.forEach((it) => { it.cutout = v; });
        this.render();
      }),
      h("label", {}, "抠图模式"),
      (() => {
        const sel = h("select", {});
        [["auto", "自动检测"], ["white", "白底抠图"], ["green", "绿幕抠图"]].forEach(([v, l]) =>
          sel.append(h("option", { value: v }, l)));
        sel.value = this.batchCutoutMode;
        sel.addEventListener("change", () => {
          this.batchCutoutMode = sel.value;
          this.items.forEach((it) => { it.cutoutMode = sel.value; });
          this.render();
        });
        return sel;
      })(),
      h("label", {}, "默认输出"),
      (() => {
        const sel = h("select", {});
        (window.__artDirs || ["character", "scene", "event"]).forEach((d) =>
          sel.append(h("option", { value: d }, d)));
        sel.value = this.batchDir;
        sel.addEventListener("change", () => {
          this.batchDir = sel.value;
          this.items.forEach((it) => { it.outDir = sel.value; });
          this.render();
        });
        return sel;
      })()
    );
  },

  addFile(file) {
    const reader = new FileReader();
    const it = {
      id: "i" + (Math.random().toString(36).slice(2, 8)),
      name: file.name,
      file,
      preview: "",
      cutout: this.batchCutout,
      cutoutMode: this.batchCutoutMode,
      outDir: this.batchDir,
      outName: "",
      status: "",
    };
    reader.onload = () => { it.preview = reader.result; this.render(); };
    reader.readAsDataURL(file);
    this.items.push(it);
  },

  render() {
    const tbody = $("#img-list");
    UI.clear(tbody);
    this.items.forEach((it) => tbody.append(this.row(it)));
  },

  row(it) {
    const nameInput = h("input", {
      class: "cell-input", type: "text",
      value: it.outName || "",
      placeholder: (it.name || "out").replace(/\.[^.]+$/, "") + ".webp",
    });
    nameInput.addEventListener("change", () => { it.outName = nameInput.value.trim(); });

    const cutCheck = h("input", { type: "checkbox" });
    cutCheck.checked = it.cutout;
    cutCheck.addEventListener("change", () => { it.cutout = cutCheck.checked; });

    // 每行抠图模式（白底/绿幕/自动）——白底立绘必须选「白底抠图」才有透明底
    const modeSel = h("select", { class: "cell-input" });
    [["auto", "自动"], ["white", "白底"], ["green", "绿幕"]].forEach(([v, l]) =>
      modeSel.append(h("option", { value: v }, l)));
    modeSel.value = it.cutoutMode || "auto";
    modeSel.addEventListener("change", () => { it.cutoutMode = modeSel.value; });

    const chips = h("div", { class: "cell-path" });
    (window.__artDirs || ["character", "scene", "event"]).forEach((d) => {
      chips.append(h("button", {
        class: "path-chip" + (it.outDir === d ? " active" : ""),
        onclick: () => { it.outDir = d; this.render(); },
      }, d));
    });
    // 浏览选择文件 -> 同名替换（目标文件名 = 所选文件名）
    const browse = h("button", {
      class: "btn btn-sm btn-ghost",
      onclick: () => {
        const inp = $("#file-input");
        inp.onchange = () => {
          if (inp.files[0]) {
            it.outName = inp.files[0].name;
            this.render();
          }
          inp.value = "";
        };
        inp.click();
      },
    }, "浏览…");
    chips.append(browse);

    const status = h("td", { class: (it.status || "").includes("✓") ? "ok" : (it.status || "").includes("✗") ? "err" : "" }, it.status || "");

    return h("tr", {},
      h("td", {}, it.preview ? h("img", { class: "cell-img", src: it.preview }) : h("div", { class: "cell-img" })),
      h("td", { class: "cell-name", title: it.name }, it.name),
      h("td", {}, nameInput),
      h("td", { class: "c-cut" }, cutCheck),
      h("td", {}, modeSel),
      h("td", {}, chips),
      status,
      h("td", {}, h("button", {
        class: "btn btn-sm btn-ghost", style: "color:#ff6b6b;",
        onclick: () => { this.items = this.items.filter((x) => x.id !== it.id); this.render(); },
      }, "删")),
    );
  },

  async compress() {
    const statusEl = $("#img-status");
    const todo = this.items.filter((it) => it.file);
    if (!todo.length) {
      statusEl.textContent = "请先添加图片";
      statusEl.className = "img-status err";
      return;
    }
    statusEl.textContent = "正在压缩...";
    statusEl.className = "img-status";
    this.items.forEach((it) => { it.status = ""; });

    const items = [];
    for (const it of todo) {
      it.status = "…";
      const b64 = await this.fileToDataUrl(it.file);
      items.push({
        filename: it.name,
        dataUrl: b64,
        cutout: it.cutout,
        cutoutMode: it.cutoutMode || "auto",
        outDir: it.outDir,
        outName: it.outName,
      });
    }
    this.render();

    try {
      const res = await fetch("/api/compress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      let ok = 0, fail = 0;
      data.results.forEach((r) => {
        const it = this.items.find((x) => x.name === r.filename);
        if (it) {
          if (r.ok) { it.status = `✓ ${r.outKB}KB`; ok++; }
          else { it.status = `✗ ${r.error || "失败"}`; fail++; }
        }
      });
      this.render();
      statusEl.textContent = `完成：成功 ${ok} 项${fail ? `，失败 ${fail} 项` : ""}`;
      statusEl.className = "img-status " + (fail ? "err" : "ok");
    } catch (e) {
      statusEl.textContent = "压缩失败：" + e.message;
      statusEl.className = "img-status err";
    }
  },

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  },
};

/* 显式暴露：顶层 const 不挂 window（与 sfxTool 同理，防 window 判断失效） */
window.ImageTool = ImageTool;
