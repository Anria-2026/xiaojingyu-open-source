var GRAPH = { stages: [], notes: {}, counts: { stages: 0, opts: 0, ans: 0, edges: 0, notes: 0 } };
var TOOL = null;   // 由 ChatTreeView.mount 注入（ChatTreeTool）

/* ============================ 状态与常量 ============================ */
var CARD_W = 224, ANS_W = 200, START_W = 152, END_W = 96;
var H_GAP = 18, ROW_GAP = 62, COL_GAP = 52, PAD = 26, PAD_TOP = 132, PAD_BOT = 30;
var STATE = { sel: null, selKind: null, ansKey: null, showAns: true, showEdge: true, far: false, statusVer: null };
var CANVAS = { w: 1000, h: 800, k: 1, x: 0, y: 0 };
var NODE = {}, ZONES = [], EDGES = [], H = {}, POS = {}, ROWS = {};
var ANS_OWNER = {}, DIRTY = false;

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}
function short(s, n){ s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }
function stageOf(ver){ return GRAPH.stages.filter(function(s){ return s.ver === ver; })[0]; }
function optKey(ver, oid){ return 'opt:' + ver + ':' + oid; }
function ansNodeKey(ver, aid){ return 'ans:' + ver + ':' + aid; }
function noteKey(nid){ return 'note:' + nid; }
function startKey(ver){ return 'start:' + ver; }
function endKey(ver, leaf){ return 'end:' + ver + ':' + leaf; }
/* ⚠️ 2026-09-19（用户要求）：「结束」节点**不再画到画布上** —— 详见 buildStageGraph 里的说明。
   「结束」本来就是**派生节点**（叶子自动生成），不画出来语义一样成立：没有下一步自然就是结束。
   改 true 就恢复（其余相关代码全部原样保留：endHTML / toEnd 边 / data-end 的点击提示）。 */
var SHOW_END = false;
function optsOf(ver){ return (stageOf(ver) || { opts: {} }).opts || {}; }
/* 回答连回答（`then` 链 · 2026-09-21）：链上回答**也是画布上的节点**（与普通回答同一种 kind:'ans'）。
   这个助手把「一个阶段里所有回答」扁平列出来 —— 普通回答 + 链上回答（**任意层**，深度优先），
   供 allAns / 索引 / 面板 / 删改 共用。字段说明：
     · chained:false / depth:0 → 普通回答（挂在选项的 ans[tier] 里，idx 是档内下标）
     · chained:true  / depth>0 → 链上回答（挂在父回答的 then 里）
       · owner    = **直接父**回答（删线/移动时要从它的 then 里摘）
       · chainIdx = 在父 then 数组里的下标
       · idx      = 所属档位数组里的下标（对链上回答无意义，保留给普通回答） */
function eachAns(ver, cb){
  var opts = optsOf(ver);
  Object.keys(opts).forEach(function(oid){
    ['dumb','full'].forEach(function(t){
      (opts[oid].ans[t] || []).forEach(function(root, i){
        (function walk(node, parent, ci, depth){
          if (!node || typeof node !== 'object') return;
          cb({ ver: ver, oid: oid, tier: t, idx: i, a: node, key: ansNodeKey(ver, node.id),
               chained: depth > 0, owner: parent, chainIdx: ci, depth: depth });
          (Array.isArray(node.then) ? node.then : []).forEach(function(sub, si){
            walk(sub, node, si, depth + 1);
          });
        })(root, null, -1, 0);
      });
    });
  });
}
function allAns(ver){
  var out = [];
  eachAns(ver, function(e){ out.push(e); });
  return out;
}
function optOfAns(ver, aid){
  var hit = null;
  eachAns(ver, function(e){ if (!hit && String(e.a.id) === String(aid)) hit = e; });
  return hit;
}
function nextOptId(){
  var mx = 0; GRAPH.stages.forEach(function(s){ Object.keys(s.opts).forEach(function(k){ mx = Math.max(mx, Number(k) || 0); }); });
  return String(mx + 1);
}
function nextAnsId(){
  var mx = 20000;
  GRAPH.stages.forEach(function(s){ eachAns(s.ver, function(e){ mx = Math.max(mx, Number(e.a.id) || 0); }); });
  Object.keys(GRAPH.notes).forEach(function(k){ mx = Math.max(mx, Number(k) || 0); });
  return String(mx + 1);
}
function rebuildIndex(){
  ANS_OWNER = {};
  GRAPH.stages.forEach(function(s){ eachAns(s.ver, function(e){
    ANS_OWNER[e.a.id] = { ver: s.ver, optId: e.oid, chained: e.chained };
  }); });
}
function toast(msg){
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(function(){ t.classList.remove('on'); }, 1800);
}
/** 上游回答 id → 人类可读说明（用户反馈「看过 N 条回答」看不懂，这里直接点名是哪个选项） */
function upsSummary(ver, ids){
  var opts = optsOf(ver), byOpt = {}, broken = 0;
  (ids || []).forEach(function(id){
    var ow = ANS_OWNER[id];
    if (!ow) { broken++; return; }
    byOpt[ow.optId] = (byOpt[ow.optId] || 0) + 1;
  });
  return {
    names: Object.keys(byOpt).map(function(k){ return '「' + short((opts[k] || {}).text || k, 10) + '」'; }),
    broken: broken
  };
}

/* ============================ 图构建：选项与回答都作为节点串联 ============================ */
/* 分层（= 从上往下的「排」）：
     0      开始
     1      第 0 排选项（开场可见 / 无条件）
     2      这些选项的回答
     3      看过上排回答才出现的选项
     4      它们的回答 …
   同一排的节点之间没有先后关系 ⇒ 横向并列。 */
function buildStageGraph(ver){
  var opts = optsOf(ver);
  var nodes = [], edges = [];
  var byAnsId = {};
  eachAns(ver, function(e){ byAnsId[e.a.id] = e.oid; });

  nodes.push({ key: startKey(ver), kind: 'start', ver: ver, label: '开始' });
  Object.keys(opts).forEach(function(oid){
    nodes.push({ key: optKey(ver, oid), kind: 'opt', ver: ver, id: oid, o: opts[oid] });
  });
  /* 回答节点（含 `then` 链上的 —— 链上回答与普通回答同一种节点，靠 chained 标记区分） */
  eachAns(ver, function(e){
    nodes.push({ key: e.key, kind: 'ans', ver: ver, a: e.a, tier: e.tier, oid: e.oid, chained: e.chained });
  });

  /* 边：开始→选项；选项→它的回答；**回答**→依赖它的选项
     ⚠️ 分层用「上游选项」，连边必须用「上游回答 id」—— 第一版把两者混用（拿选项 id 去当回答节点 key），
        结果所有回答都连不上、全被判成"叶子" ⇒ 冒出 172 个「结束」节点（应该只有 16 个）。 */
  var L = {}, deps = {}, depAns = {};
  Object.keys(opts).forEach(function(oid){
    var ds = [], das = [];
    var c0 = opts[oid].cond || {};
    /* ⚠️⚠️ 2026-09-19 修（用户报「删连线报错：这条依赖不在 cond.ids 里」）：
       **判据必须与引擎同口径** —— 引擎是 `o.cond.type !== "none" && c2CondOk(o.cond)`，
       即 `type !== 'prevAns'` 时**根本不读 ids**（面板把类型改成「无条件」后 ids 会残留）。
       以前这里只看 `ids` 存不存在 ⇒ 会画出一条引擎不读的**假依赖线**，还把该选项排到下游层。
       现在只有 prevAns 才认 ids —— 连线、分层、删线三处口径统一。 */
    if (c0.type === 'prevAns') (c0.ids || []).forEach(function(id){
      var up = byAnsId[id];
      if (!up || up === oid) return;
      if (ds.indexOf(up) < 0) ds.push(up);
      if (das.indexOf(id) < 0) das.push(id);
    });
    deps[oid] = ds; depAns[oid] = das;
  });
  L[startKey(ver)] = 0;
  Object.keys(opts).forEach(function(oid){
    if (!deps[oid].length) L[optKey(ver, oid)] = 1;      // 开场可见 / 无条件
  });
  var guard = 0, changed = true;
  while (changed && guard++ < 400){
    changed = false;
    Object.keys(opts).forEach(function(oid){
      var k = optKey(ver, oid);
      if (L[k] != null) return;
      if (deps[oid].every(function(u){ return L[optKey(ver, u)] != null; })){
        var mx = 0; deps[oid].forEach(function(u){ mx = Math.max(mx, L[optKey(ver, u)]); });
        L[k] = mx + 2; changed = true;                    // 上游选项 → 回答 → 这里
      }
    });
  }
  var maxL = 0; Object.keys(L).forEach(function(k){ maxL = Math.max(maxL, L[k]); });
  Object.keys(opts).forEach(function(oid){                // 环内节点收进最后一排
    var k = optKey(ver, oid);
    if (L[k] == null) L[k] = maxL + 2;
  });
  Object.keys(opts).forEach(function(oid){                // 回答层 = 所属选项 + 1
    ['dumb','full'].forEach(function(t){
      (opts[oid].ans[t] || []).forEach(function(a){ L[ansNodeKey(ver, a.id)] = L[optKey(ver, oid)] + 1; });
    });
  });
  /* 链上回答层 = 它的**父回答** + 1。
     eachAns 是**深度优先前序**（父一定排在子之前）⇒ 顺序走一遍就能把任意层算对。 */
  eachAns(ver, function(e){
    var lv = L[ansNodeKey(ver, e.a.id)];
    (Array.isArray(e.a.then) ? e.a.then : []).forEach(function(sub){
      if (sub && sub.id != null) L[ansNodeKey(ver, sub.id)] = (lv != null ? lv : 1) + 1;
    });
  });

  /* 边 */
  Object.keys(opts).forEach(function(oid){
    var o = opts[oid], k = optKey(ver, oid);
    if (!deps[oid].length) edges.push({ from: startKey(ver), to: k, kind: 'flow' });
    depAns[oid].forEach(function(aid){ edges.push({ from: ansNodeKey(ver, aid), to: k, kind: 'ans', via: aid }); });
    (o.ans.dumb || []).concat(o.ans.full || []).forEach(function(a){
      edges.push({ from: k, to: ansNodeKey(ver, a.id), kind: 'flow' });
    });
  });
  /* 回答连回答（`then` 链）：主回答 → 它的每个链上回答。
     ⚠️⚠️ 2026-09-21 修（用户报「连上了没有线」）：这段以前**嵌在上面那个 o.ans 循环里**，
        于是只看得见**选项顶层回答**的 then —— 链上回答自己再挂的 then（第三层起）**边根本不会生成**：
        卡片、徽章、层号都对（那些走 eachAns 递归），唯独线画不出来 ⇒ 症状就是「提示连上了、卡片也标了连播，就是没线」。
        ⇒ 边也必须走 eachAns 递归，与节点/层号同一口径。 */
  eachAns(ver, function(e){
    (Array.isArray(e.a.then) ? e.a.then : []).forEach(function(sub){
      if (sub && sub.id != null) edges.push({ from: ansNodeKey(ver, e.a.id), to: ansNodeKey(ver, sub.id), kind: 'then', via: sub.id });
    });
  });
  /* 叶子 → 结束（每条分支各自一个「结束」）
     ⚠️ 2026-09-19（用户要求）：`SHOW_END === false` ⇒ **不生成、也不画**结束节点。
        理由：① 它既要「跟随父节点」又天然跟不上（父节点可被单独拖动）；
              ② 它白占一行高度，把阶段框和整个画布撑高；
              ③ 它本来就是**派生**的 —— 没有下游自然就是结束，不需要一个框来说明。
        语义不丢：叶子判定（used / 有没有下游）与连线拖动都在，只是不再画那个框。 */
  var used = {};
  edges.forEach(function(e){ if (e.from !== startKey(ver)) used[e.from] = 1; });
  if (SHOW_END) nodes.forEach(function(n){
    if (n.kind !== 'opt' && n.kind !== 'ans') return;
    if (used[n.key]) return;                              // 有下游 ⇒ 不是叶子
    var ek = endKey(ver, n.key);
    nodes.push({ key: ek, kind: 'end', ver: ver, parent: n.key });
    edges.push({ from: n.key, to: ek, kind: 'flow' });
    L[ek] = (L[n.key] != null ? L[n.key] : 1) + 1;         // ⚠️ 结束节点也要有层号，否则分层会塌
  });

  return { nodes: nodes, edges: edges, L: L, opts: opts, deps: deps };
}

/* ============================ 布局：开始居中 · 按层分行 · 同层并列 ============================ */
function layout(){
  NODE = {}; ZONES = []; ROWS = {};

  /* 记事本区（**固定在阶段区上方** —— 用户 2026-09-19 要求）
     ⚠️ 以前它跟在 V1 **左边**、同一高度（x = 记事本宽 + COL_GAP），而 w/h 是按"条目数 × 卡宽"估的
        （h 写死 128）⇒ 条目文字一长卡片就撑出 zone 矩形，看起来像和别的区域重叠。
     现在：① 挪到**上方** —— V1 在它正下方、左边缘对齐；
        ② 高度按**条目实测高度**（H[]）算，不再写死，矩形一定包得住卡片。 */
  var nids = Object.keys(GRAPH.notes);
  var noteHMax = 0;
  nids.forEach(function(nid){ noteHMax = Math.max(noteHMax, H[noteKey(nid)] || 70); });
  var nzW = Math.max(236, nids.length * (CARD_W + 20) + 56);
  var nzH = Math.max(128, 38 + noteHMax + 26);
  var nx = 44, ny = 44;
  var NOTE_GAP = 46;                                   // 记事本区 ↔ 阶段区 的垂直间距
  nids.forEach(function(nid, i){
    var k = noteKey(nid);
    var px = nx + 28 + i * (CARD_W + 20), py = ny + 38;
    if (POS[k]){ px = POS[k].x; py = POS[k].y; }
    NODE[k] = { x: px, y: py, w: CARD_W, h: H[k] || 70, kind: 'note', id: nid };
  });
  ZONES.push({ ver: '__notes', x: nx, y: ny, w: nzW, h: nzH, note: true, zoneX: nx, zoneY: ny });

  var x = nx;                                          // V1 左边缘与记事本区对齐（它正下方）
  var stageTop = ny + nzH + NOTE_GAP;                   // 阶段区从记事本区**下方**开始
  GRAPH.stages.forEach(function(s){
    var g = buildStageGraph(s.ver);
    var zoneX = POS['zone:' + s.ver] ? POS['zone:' + s.ver].x : x;
    var zoneY = POS['zone:' + s.ver] ? POS['zone:' + s.ver].y : stageTop;

    /* 按层分组 */
    var rows = {};
    g.nodes.forEach(function(n){ (rows[g.L[n.key]] = rows[g.L[n.key]] || []).push(n); });
    var levels = Object.keys(rows).map(Number).sort(function(a, b){ return a - b; });

    /* 排序三遍（减少连线交叉）：按父节点序号 → 按子节点序号 → 再按父节点。
       ⚠️ idx 必须**跨遍累积**（第一版把它写在 sort 内部每遍重建 ⇒ 排序直接退化）。 */
    var idx = {};
    function doSort(linkOf){
      var avg = function(n){
        var ups = linkOf(n.key);
        if (!ups.length) return -1;
        var s = 0, c = 0;
        ups.forEach(function(k){ if (idx[k] != null){ s += idx[k]; c++; } });
        return c ? s / c : -1;
      };
      levels.forEach(function(lv){
        rows[lv] = rows[lv].slice().sort(function(a, b){
          var d = avg(a) - avg(b);
          if (d) return d;
          return String(a.key).localeCompare(String(b.key));
        });
      });
      levels.forEach(function(lv){ rows[lv].forEach(function(n, i){ idx[n.key] = i; }); });
    }
    var upOf = {}, downOf = {};
    g.edges.forEach(function(e){ (upOf[e.to] = upOf[e.to] || []).push(e.from); (downOf[e.from] = downOf[e.from] || []).push(e.to); });
    doSort(function(k){ return upOf[k] || []; });
    doSort(function(k){ return downOf[k] || []; });
    doSort(function(k){ return upOf[k] || []; });

    /* 定坐标
       竖向：层自上而下推进。
       横向：**树布局（思维导图式）** ——
         · 父节点居中于它的子节点们（子树在自己的位置里对称展开）；
         · 第一排选项以「开始」为轴**朝两侧分散**（左半在左、右半在右、奇数时中间那个居中）；
         · 「开始」正落在中心轴上。
       反例（上一版）：父定子 + 从左往右顺序摆开 ⇒ 整体左倾、不对称（用户："还是不够整齐，
       开始应该在最中间，初始选项居中然后朝两侧展开"）。 */
    var rowY = {}, cy = zoneY + PAD_TOP, nodeSize = {};
    levels.forEach(function(lv){
      var rowH = 0;
      rows[lv].forEach(function(n){
        var w = n.kind === 'ans' ? ANS_W : (n.kind === 'start' ? START_W : (n.kind === 'end' ? END_W : CARD_W));
        var h = H[n.key] || (n.kind === 'ans' ? 54 : (n.kind === 'start' ? 42 : (n.kind === 'end' ? 34 : 92)));
        nodeSize[n.key] = { w: w, h: h };
        rowH = Math.max(rowH, h);
      });
      rowY[lv] = cy;
      cy += rowH + ROW_GAP;
    });

    /* 主父：同阶段内、层号更小的上游里，取**最近一层上游的中位数**那一个。
       ⚠️ 不能取"id 最小"或"第一个"：像「回开场」这种被 A/B/C/D 四条回答共同指向的选项，
          应该落在**中间**（用户："有 4 个回答的下一个选项都是【回开场】，那他应该出现在 A~D 的中间"）。
          ⇒ 取最近层上游按层内序号排序后的中位数 ⇒ 自然居中。其它上游照旧画连线（跨分支补充边）。 */
    var parentOf = {}, kidsOf = {};
    var upsByTo = {};
    g.edges.forEach(function(e){
      /* then 边也参与「主父」计算 ⇒ 链上回答排在它的上游回答正下方（看着就是一条链） */
      if (e.kind !== 'flow' && e.kind !== 'ans' && e.kind !== 'then') return;
      var kl = g.L[e.from], nl = g.L[e.to];
      if (kl == null || nl == null || kl >= nl) return;
      (upsByTo[e.to] = upsByTo[e.to] || []).push(e.from);
    });
    var ord0 = {};
    levels.forEach(function(lv){ rows[lv].forEach(function(n, i){ ord0[n.key] = i; }); });
    Object.keys(upsByTo).forEach(function(to){
      var ups = upsByTo[to];
      var mx = Math.max.apply(null, ups.map(function(k){ return g.L[k]; }));
      var near = ups.filter(function(k){ return g.L[k] === mx; });          // 最近一层
      near = near.filter(function(k, i){ return near.indexOf(k) === i; });
      near.sort(function(a, b){ return (ord0[a] || 0) - (ord0[b] || 0); });
      parentOf[to] = near[Math.floor((near.length - 1) / 2)];               // 中位数 ⇒ 落在中间
    });
    var ord = {};
    levels.forEach(function(lv){ rows[lv].forEach(function(n, i){ ord[n.key] = i; }); });
    Object.keys(parentOf).forEach(function(k){
      var p = parentOf[k];
      (kidsOf[p] = kidsOf[p] || []).push(k);
    });
    Object.keys(kidsOf).forEach(function(p){
      kidsOf[p].sort(function(a, b){ return (ord[a] || 0) - (ord[b] || 0); });
    });

    var placed = {};
    function setNode(key, x, y, shift){
      var sz = nodeSize[key];
      var px = x + (shift || 0), py = y;
      if (POS[key]){ px = POS[key].x; py = POS[key].y; }        // 拖过的用自定义位置
      NODE[key] = { x: px, y: py, w: sz.w, h: sz.h, kind: key.split(':')[0], ver: s.ver,
                    id: (key.split(':')[2] || null), layer: g.L[key] };
      placed[key] = 1;
    }
    /* 子树宽度：自身宽 vs 子节点总宽，取大 */
    function widthOf(key){
      var sz = nodeSize[key], ch = kidsOf[key] || [];
      if (!ch.length) return sz.w;
      var total = ch.reduce(function(a, c){ return a + widthOf(c); }, 0) + H_GAP * (ch.length - 1);
      return Math.max(total, sz.w);
    }
    /* 以 leftEdge 为左起点放置整棵子树（父居中于子），返回占宽。
       ⚠️ 子节点那一段要**居中于 span**，不能从 leftEdge 起排：
          否则当父比「子段」宽时（典型：选项只有一条「结束」子节点），
          父的中心与子的中心会差半个身位 ⇒ 用户看到"结束节点没有跟随上一个节点"。 */
    function placeAt(key, leftEdge){
      var sz = nodeSize[key], ch = kidsOf[key] || [];
      if (!ch.length){
        setNode(key, leftEdge, rowY[g.L[key]]);
        return sz.w;
      }
      var childSpan = ch.reduce(function(a, c){ return a + widthOf(c); }, 0) + H_GAP * (ch.length - 1);
      var span = Math.max(childSpan, sz.w);
      var cx = leftEdge + (span - childSpan) / 2;                 // ← 子段居中于 span
      ch.forEach(function(ck){ var cw = widthOf(ck); placeAt(ck, cx); cx += cw + H_GAP; });
      setNode(key, leftEdge + (span - sz.w) / 2, rowY[g.L[key]]); // 父也居中于 span ⇒ 中心与子段一致
      return span;
    }
    /* 摆位：**严格左右分区**（用户要的"开始居中、初始选项朝两侧展开"）
       —— 第一排选项分左右两组，各自在自己的半区里按树布局展开，谁也不许越过中心轴；
          两侧取同样宽度（2×max）保证视觉对称，中间留出「开始」的位置。
       ⚠️ 不能只用纯树布局：树里父节点居中于**所有子节点整体**，所以当左子树远宽于右子树时，
          左边的内容会越过父的中轴（实测 20008@1904 越过了轴 1880）。 */
    var sKey = startKey(s.ver);
    var first = (kidsOf[sKey] || []).slice();
    var n1 = first.length;
    var mid = null, leftKs = [], rightKs = [];
    if (n1 === 1){ mid = first[0]; }
    else if (n1 % 2 === 1){ mid = first[Math.floor(n1 / 2)]; leftKs = first.slice(0, Math.floor(n1 / 2)); rightKs = first.slice(Math.floor(n1 / 2) + 1); }
    else { leftKs = first.slice(0, n1 / 2); rightKs = first.slice(n1 / 2); }
    var spanOf = function(ks){ return ks.reduce(function(a, k){ return a + widthOf(k); }, 0) + H_GAP * Math.max(0, ks.length - 1); };
    var WL = spanOf(leftKs), WR = spanOf(rightKs), M = Math.max(WL, WR, mid ? widthOf(mid) : 0);
    var midGap = Math.max(START_W + H_GAP * 2, 90);
    var totalW = Math.max(M + midGap + M, START_W + H_GAP * 2);
    var axis = zoneX + PAD + M + midGap / 2;                 // 中心轴（「开始」落在这里）
    var lx = zoneX + PAD + (M - WL);                         // 左组：右对齐到轴左
    leftKs.forEach(function(k){ var cw = widthOf(k); placeAt(k, lx); lx += cw + H_GAP; });
    if (mid) placeAt(mid, axis - nodeSize[mid].w / 2);
    var rx = zoneX + PAD + M + midGap;                       // 右组：左对齐到轴右
    rightKs.forEach(function(k){ var cw = widthOf(k); placeAt(k, rx); rx += cw + H_GAP; });
    setNode(sKey, axis - nodeSize[sKey].w / 2, rowY[g.L[sKey]]);   // 「开始」居中
    /* 孤立节点（不该有，兜底放右侧） */
    var rest = g.nodes.filter(function(n){ return !placed[n.key]; });
    var fx = zoneX + PAD + totalW + H_GAP * 2;
    rest.forEach(function(n){
      setNode(n.key, fx, rowY[g.L[n.key]]);
      totalW = Math.max(totalW, fx + nodeSize[n.key].w - (zoneX + PAD));
      fx += nodeSize[n.key].w + H_GAP;
    });

    /* 区域框住内容 */
    var mg = 16;
    var b = { x1: zoneX + PAD - mg, y1: zoneY + 12, x2: zoneX + PAD + totalW + mg, y2: cy - ROW_GAP + PAD_BOT };
    Object.keys(NODE).forEach(function(k){
      if (k.indexOf('opt:' + s.ver + ':') !== 0 && k.indexOf('ans:' + s.ver + ':') !== 0 &&
          k.indexOf('start:' + s.ver) !== 0 && k.indexOf('end:' + s.ver + ':') !== 0) return;
      var n = NODE[k];
      b.x1 = Math.min(b.x1, n.x - mg); b.y1 = Math.min(b.y1, n.y - mg);
      b.x2 = Math.max(b.x2, n.x + n.w + mg); b.y2 = Math.max(b.y2, n.y + n.h + mg);
    });
    ZONES.push({ ver: s.ver, x: b.x1, y: b.y1, w: b.x2 - b.x1, h: b.y2 - b.y1,
      status: s.status, count: Object.keys(s.opts).length, levels: levels.length, zoneX: zoneX, zoneY: zoneY });
    x += (b.x2 - b.x1) + COL_GAP;
  });

  var mx = 0, my = 0;
  ZONES.forEach(function(z){ mx = Math.max(mx, z.x + z.w); my = Math.max(my, z.y + z.h); });
  Object.keys(NODE).forEach(function(k){ var n = NODE[k]; mx = Math.max(mx, n.x + n.w); my = Math.max(my, n.y + n.h); });
  CANVAS.w = mx + 60; CANVAS.h = my + 60;
}

/* ============================ DOM 片段 ============================ */
function badgesFor(ver, oid, o){
  var opts = optsOf(ver);
  var badges = '';
  if (o.start) badges += '<span class="bd bd-start">开场可见</span>';
  var c = o.cond || {};
  if (c.type === 'prevAns'){
    var ups = {}, broken = 0;
    (c.ids || []).forEach(function(id){
      var ow = ANS_OWNER[id];
      if (!ow) { broken++; return; }
      ups[ow.optId] = (ups[ow.optId] || 0) + 1;
    });
    var names = Object.keys(ups).map(function(k){ return '「' + short((opts[k] || {}).text || k, 8) + '」'; });
    if (names.length) badges += '<span class="bd bd-cond">选过 ' + esc(names.slice(0, 2).join('')) + (names.length > 2 ? ' 等' + names.length + ' 个' : '') + ' 后出现</span>';
    if (broken) badges += '<span class="bd bd-warn" title="这些 id 已经没有对应回答了：'
      + esc((c.ids || []).filter(function(x){ return !ANS_OWNER[x]; }).join('、')) + '">' + broken + ' 个引用失效</span>';
  } else if (c.type === 'noNote') badges += '<span class="bd bd-cond">还没记下「' + esc((GRAPH.notes[c.id] || {}).name || c.id) + '」</span>';
  if (o.next) badges += '<span class="bd bd-next">' + esc(o.next) + '</span>';
  if (inCycle(ver, oid)) badges += '<span class="bd bd-warn">互相依赖</span>';
  return badges;
}
function inCycle(ver, oid){
  var opts = optsOf(ver), byAns = {};
  Object.keys(opts).forEach(function(o){ ['dumb','full'].forEach(function(t){ (((opts[o] || {}).ans || {})[t] || []).forEach(function(a){ byAns[a.id] = o; }); }); });
  /* ⚠️ 2026-09-19：与引擎同口径 —— `type !== 'prevAns'` 时 ids 不被读，
     残余 ids 不该让卡片挂上「互相依赖」的假警告。 */
  if (((((opts[oid] || {}).cond) || {}).type) !== 'prevAns') return false;
  var ups = [];
  (((opts[oid] || {}).cond || {}).ids || []).forEach(function(id){
    var u = byAns[id]; if (u && u !== oid && ups.indexOf(u) < 0) ups.push(u);
  });
  return ups.some(function(u){
    var back = [];
    (((opts[u] || {}).cond || {}).ids || []).forEach(function(id){ var t = byAns[id]; if (t && back.indexOf(t) < 0) back.push(t); });
    return back.indexOf(oid) >= 0;
  });
}
function startHTML(ver){ return '<div class="term term-start" data-start="' + esc(ver) + '">开始</div>'; }
/* 四向箭头图标（**自绘 SVG，禁 emoji**）：节点上「按住拖 = 连下方所有子节点一起动」那个按钮用。
   2026-09-19 用户要求：「在每个节点加一个按钮，按住它拖动就可以连着下方所有子节点一起动」。 */
var DRAGSUB_ICO = '<svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1.6v10.8M1.6 7h10.8M7 1.6 5.3 3.5M7 1.6l1.7 1.9M7 12.4l-1.7-1.9M7 12.4l1.7-1.9M1.6 7l1.9-1.7M1.6 7l1.9 1.7M12.4 7l-1.9-1.7M12.4 7l-1.9 1.7"/></svg>';
/* 出线把手：hover 节点时出现在下方，拖它到别的节点上方 = 建立引用（用户要求） */
function handleHTML(key){
  return '<div class="handle" data-handle="' + esc(key) + '" title="按住拖到「选项」上方 = 建立依赖　·　拖到「回答」上方 = 连播（这条播完接着播那条）"></div>';
}
function endHTML(ver, leaf){ return '<div class="term term-end" data-end="' + esc(ver + '|' + leaf) + '">结束</div>'; }
function optHTML(ver, oid, o){
  var nA = (o.ans.dumb || []).length + (o.ans.full || []).length;
  return '<div class="opt" data-opt="' + esc(optKey(ver, oid)) + '">' +
    '<div class="opt-hd"><div class="opt-t">' + esc(o.text || '（还没写文本）') + '</div>' +
      '<div class="opt-id">选项 #' + esc(oid) + (nA ? ' · ' + nA + ' 条回答' : ' · 没有回答（分支到此结束）') + '</div>' +
      '<div class="grip">' +
        '<button class="icob" data-dragsub="' + esc(optKey(ver, oid)) + '" title="按住拖动 = 连同下方所有子节点一起移动（直接拖卡片只动它自己）">' + DRAGSUB_ICO + '</button>' +
        '<button class="icob" data-addans="' + esc(ver + ':' + oid) + '" title="加一条回答">＋</button>' +
        '<button class="icob del" data-delopt="' + esc(ver + ':' + oid) + '" title="删除这个选项">' +
          '<svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>' +
      '</div>' +
      (badgesFor(ver, oid, o) ? '<div class="badges">' + badgesFor(ver, oid, o) + '</div>' : '') +
    '</div></div>';
}
function ansHTML(ver, aid){
  var ow = optOfAns(ver, aid); if (!ow) return '';
  var a = ow.a, t = a.type || 'text';
  var main = a.text != null ? a.text : (a.post != null ? a.post : ((a.steps || [])[0] || ''));
  var c = a.cond || {};
  var condTip = c.type === 'note' ? '解锁记事本 ' + c.id + '（' + ((GRAPH.notes[c.id] || {}).name || '') + '）'
    : c.type === 'noNote' ? '需要还没记下 ' + c.id
    : c.type === 'fallback' ? '兜底回答' : '';
  return '<div class="ans" data-ansnode="' + esc(ansNodeKey(ver, aid)) + '">' +
    '<div class="ans-top">' +
      '<span class="tag tag-' + esc(t) + '">' + esc(t) + '</span>' +
      (ow.chained
        ? '<span class="tag" style="background:#fce7f3;color:#9d174d">连播</span>'
        : '<span class="tag tag-' + esc(ow.tier) + '">' + (ow.tier === 'full' ? '开智' : '咕嘎') + '</span>') +
      '<span class="ans-id">#' + esc(aid) + '</span>' +
      '<button class="icob" data-dragsub="' + esc(ansNodeKey(ver, aid)) + '" title="按住拖动 = 连同下方所有子节点一起移动（直接拖卡片只动它自己）" style="width:16px;height:16px">' + DRAGSUB_ICO + '</button>' +
      '<button class="icob del" data-delansnode="' + esc(ver + ':' + aid) + '" title="删除这条回答" style="width:16px;height:16px">' +
        '<svg viewBox="0 0 14 14" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>' +
    '</div>' +
    '<div class="ans-tx">' + esc(short(main, 64) || '（空回答）') + '</div>' +
    (condTip ? '<div class="ans-cond">' + esc(condTip) + '</div>' : '') +
  '</div>';
}
function noteHTML(nid){
  var n = GRAPH.notes[nid] || {};
  return '<div class="note-node" data-note="' + esc(noteKey(nid)) + '">' +
    '<button class="icob del" data-delnote="' + esc(nid) + '" style="position:absolute;right:5px;top:5px" title="删除条目">' +
      '<svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>' +
    '<div class="nm">' + esc(n.name || nid) + '</div>' +
    '<div class="tx">' + esc(short(n.text || '', 32)) + '</div>' +
    '<div class="id">note #' + esc(nid) + '</div></div>';
}

/* ============================ 渲染 ============================ */
function render(){
  /* ⚠️⚠️ 2026-09-19（用户报「又出来引用失效了」）：**必须先建索引，再拼卡片 HTML**。
     卡片 HTML 里的徽章（optHTML → badgesFor）要读 ANS_OWNER 判断「N 个引用失效」，
     而 ANS_OWNER 是 buildEdges() → rebuildIndex() 建的 —— 原来这一行在 768 行 `innerHTML`
     **之后**（775 行）才跑 ⇒ 全量重绘时徽章读到的是**上一次的索引**：
       · 初次 mount（ANS_OWNER = {}）⇒ **所有 prevAns 卡片全被误标「引用失效」**
         （实测 8 阶段 46 张卡同时变红，用户只看到自己正在看的那几张 →「莫名其妙」）
       · 随便点一下走 syncEdges()（buildEdges 先、refreshBadges 后）就全好了 ⇒ 症状飘忽
     修法就是这一行：把索引提到拼 HTML 之前。后面 775 行的 buildEdges() 会再建一次，幂等。 */
  rebuildIndex();
  var nodesEl = document.getElementById('nodes');
  var buf = [];
  GRAPH.stages.forEach(function(s){
    buf.push('<div class="wrap" data-wrap="' + esc(startKey(s.ver)) + '" style="position:absolute;left:0;top:0;width:' + START_W + 'px;visibility:hidden">' + startHTML(s.ver) + handleHTML(startKey(s.ver)) + '</div>');
    Object.keys(s.opts).forEach(function(oid){
      buf.push('<div class="wrap" data-wrap="' + esc(optKey(s.ver, oid)) + '" style="position:absolute;left:0;top:0;width:' + CARD_W + 'px;visibility:hidden">' + optHTML(s.ver, oid, s.opts[oid]) + handleHTML(optKey(s.ver, oid)) + '</div>');
    });
    if (STATE.showAns){
      allAns(s.ver).forEach(function(x){
        buf.push('<div class="wrap" data-wrap="' + esc(x.key) + '" style="position:absolute;left:0;top:0;width:' + ANS_W + 'px;visibility:hidden">' + ansHTML(s.ver, x.a.id) + handleHTML(x.key) + '</div>');
      });
    }
  });
  Object.keys(GRAPH.notes).forEach(function(nid){
    buf.push('<div class="wrap" data-wrap="' + esc(noteKey(nid)) + '" style="position:absolute;left:0;top:0;width:' + CARD_W + 'px;visibility:hidden">' + noteHTML(nid) + '</div>');
  });
  nodesEl.innerHTML = buf.join('');

  /* 量真实高度（估算会重叠） */
  H = {};
  nodesEl.querySelectorAll('[data-wrap]').forEach(function(el){ H[el.getAttribute('data-wrap')] = el.offsetHeight; });

  /* 构建图 + 算出「结束」节点（依其父节点高度） */
  buildEdges();
  layout();

  /* 结束节点也要进 DOM 并测量（高度已知，直接给） */
  var ends = EDGES.filter(function(e){ return e.kind === 'toEnd'; });
  var eb = [];
  ends.forEach(function(e){ eb.push('<div class="wrap" data-wrap="' + esc(e.to) + '" style="position:absolute;left:0;top:0;width:' + END_W + 'px;visibility:hidden">' + endHTML(e.ver, e.from) + '</div>'); });
  if (eb.length) nodesEl.insertAdjacentHTML('beforeend', eb.join(''));
  nodesEl.querySelectorAll('[data-wrap]').forEach(function(el){ var k = el.getAttribute('data-wrap'); if (H[k] == null) H[k] = el.offsetHeight; });
  layout();

  /* 定位并显示 */
  nodesEl.querySelectorAll('[data-wrap]').forEach(function(el){
    var k = el.getAttribute('data-wrap'), n = NODE[k];
    if (!n){ el.style.display = 'none'; return; }
    el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; el.style.visibility = 'visible';
  });
  renderZones();
  var cv = document.getElementById('canvas');
  cv.style.width = CANVAS.w + 'px'; cv.style.height = CANVAS.h + 'px';
  var svg = document.getElementById('edges');
  svg.setAttribute('width', CANVAS.w); svg.setAttribute('height', CANVAS.h);
  svg.classList.add('live');                                   // 允许点线（拖引用时会临时摘掉）
  var gh = document.getElementById('ghost');
  if (gh){ gh.setAttribute('width', CANVAS.w); gh.setAttribute('height', CANVAS.h); }
  drawEdges();
  applyTransform();
  if (typeof TOOL !== 'undefined' && TOOL) TOOL.data = TOOL.data;   // 编辑器里由 ChatTreeView.syncBack 写回
  document.getElementById('hdSub').textContent =
    GRAPH.stages.length + ' 阶段 · ' + GRAPH.counts.opts + ' 选项 · ' + GRAPH.counts.ans + ' 回答 · ' +
    EDGES.filter(function(e){ return e.kind !== 'broken'; }).length + ' 条连线' + (DIRTY ? ' · 已改动' : '');
  updateDim();
}

function renderZones(){
  var z = [];
  ZONES.forEach(function(zz){
    if (zz.note){
      z.push('<div class="stage" style="left:' + zz.x + 'px;top:' + zz.y + 'px;width:' + zz.w + 'px;height:' + zz.h + 'px;' +
        'border-style:dashed;border-color:#eccb8e;background:rgba(253,250,243,.7)"></div>');
      z.push('<div class="zone-hd" style="left:' + (zz.x + 16) + 'px;top:' + (zz.y - 12) + 'px">跨阶段 · 记事本条目</div>');
      z.push('<button class="icob" data-addnote="1" style="position:absolute;left:' + (zz.x + zz.w - 32) + 'px;top:' + (zz.y - 14) + 'px" title="新增条目">＋</button>');
      return;
    }
    z.push('<div class="stage" style="left:' + zz.x + 'px;top:' + zz.y + 'px;width:' + zz.w + 'px;height:' + zz.h + 'px"></div>');
    z.push('<div class="stage-hd" data-dragzone="' + esc(zz.ver) + '" style="left:' + (zz.x + 14) + 'px;top:' + (zz.y - 13) + 'px">' + esc(zz.ver) +
      '<span class="n">' + zz.count + ' 选项 · ' + zz.levels + ' 排</span></div>');
    z.push('<button class="icob" data-addopt="' + esc(zz.ver) + '" style="position:absolute;left:' + (zz.x + zz.w - 30) + 'px;top:' + (zz.y + 12) + 'px" title="往这个阶段加选项">＋</button>');
    /* 状态行：放在每个阶段模块的**最上方**（标题下方），点击可编辑两档文案 */
    var st = zz.status || {};
    var selCls = STATE.selKind === 'status' && STATE.statusVer === zz.ver ? ' sel' : '';
    z.push('<div class="statusbar' + selCls + '" data-status="' + esc(zz.ver) + '" style="left:' + (zz.x + 14) + 'px;top:' + (zz.y + 22) + 'px;width:' + (zz.w - 56) + 'px">' +
      '<span class="st"><b>咕嘎</b>' + esc(short((st.dumb || [])[0] || '（未配置）', 20)) + '</span>' +
      '<span class="st"><b>开智</b>' + esc(short((st.full || [])[0] || '（未配置）', 20)) + '</span>' +
      '<span class="st" style="border-style:solid;color:#0e5b73;border-color:#a5e4f0;background:#e8f7fb">点击配置状态文案</span></div>');
  });
  document.getElementById('zones').innerHTML = z.join('');
}

/* ============================ 连线 ============================ */
/* 连线：统一「**从下边中点出、从上边中点入**」。
   ⚠️ 之前按相对位置挑最近的边（有时走左边、有时走右边）⇒ 用户反馈"线条特别乱"。
   现在锚点固定，曲线只在中段弯曲，读起来是自上而下一条线。 */
function edgePath(a, b){
  var x1 = a.x + a.w / 2, y1 = a.y + a.h;      // 出发：下边中点
  var x2 = b.x + b.w / 2, y2 = b.y;            // 到达：上边中点
  var dy = y2 - y1;
  /* 正常向下：控制点向下探再向上收，形成平滑 S。
     向上/同层（环内节点、回指）：把控制点换成横向偏移，避免曲线穿过节点。 */
  if (dy > 8){
    var off = Math.max(16, Math.min(72, dy * 0.5));
    return 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + off) + ' ' + x2 + ',' + (y2 - off) + ' ' + x2 + ',' + y2;
  }
  var dx = x2 - x1;
  var by = Math.max(28, Math.abs(dx) * 0.35);
  return 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + by) + ' ' + x2 + ',' + (y1 + by) + ' ' + x2 + ',' + y2;
}
function drawEdges(){
  var svg = document.getElementById('edges');
  if (!STATE.showEdge){ svg.innerHTML = ''; return; }
  var seg = [];
  EDGES.forEach(function(e, i){
    if (e.kind === 'broken') return;
    var far = (e.kind === 'cross' || e.kind === 'note');
    if (far && !STATE.far && STATE.sel !== e.from && STATE.sel !== e.to) return;
    var a = NODE[e.from], b = NODE[e.to];
    if (!a || !b) return;
    var color = e.kind === 'note' ? '#c98a19' : (e.kind === 'cross' ? '#7c3aed'
      : (e.kind === 'then' ? '#db2777'
      : (e.kind === 'ans' ? '#5aa9c4' : (e.kind === 'flow' ? '#0f766e' : '#7fb3c4'))));
    var dash = e.kind === 'note' ? '5 4' : (e.kind === 'cross' ? '8 5' : (e.kind === 'then' ? '2 4' : ''));
    var w = e.kind === 'cross' ? 2 : (e.kind === 'flow' ? 1.6 : (e.kind === 'then' ? 2 : 1.4));
    var op = e.kind === 'flow' ? .72 : .78;
    seg.push('<path data-ei="' + i + '" data-kind="' + e.kind + '" data-w0="' + w + '" data-o0="' + op + '" d="' + edgePath(a, b) +
      '" fill="none" stroke="' + color + '" stroke-width="' + w + '"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' opacity="' + op + '" stroke-linecap="round"/>');
  });
  svg.innerHTML = seg.join('');
}

/* ============================ 缩放 / 平移 ============================ */
function applyTransform(){
  document.getElementById('canvas').style.transform = 'translate(' + CANVAS.x + 'px,' + CANVAS.y + 'px) scale(' + CANVAS.k + ')';
  document.getElementById('zoomVal').value = Math.round(CANVAS.k * 100) + '%';
}
function zoomAt(cx, cy, f){
  var k2 = Math.max(0.05, Math.min(2.6, CANVAS.k * f)), r = k2 / CANVAS.k;
  CANVAS.x = cx - (cx - CANVAS.x) * r; CANVAS.y = cy - (cy - CANVAS.y) * r; CANVAS.k = k2;
  applyTransform();
}
function fitAll(){
  var vp = document.getElementById('viewport'), pad = 24;
  CANVAS.k = Math.max(0.05, Math.min(1.2, Math.min((vp.clientWidth - pad * 2) / CANVAS.w, (vp.clientHeight - pad * 2) / CANVAS.h)));
  CANVAS.x = Math.max(pad, (vp.clientWidth - CANVAS.w * CANVAS.k) / 2);
  CANVAS.y = Math.max(pad, (vp.clientHeight - CANVAS.h * CANVAS.k) / 2);
  applyTransform();
}
function goStage(ver){
  var vp = document.getElementById('viewport');
  if (!ver){ fitAll(); return; }
  var z = ZONES.filter(function(x){ return x.ver === ver; })[0];
  if (!z) return;
  CANVAS.k = 1;
  if (z.h > vp.clientHeight - 60) CANVAS.k = Math.max(0.25, (vp.clientHeight - 60) / z.h);
  /* 允许负坐标：画布向右延伸，夹正数会让阶段导航永远停在最左 */
  CANVAS.x = (vp.clientWidth - z.w * CANVAS.k) / 2 - z.x * CANVAS.k;
  CANVAS.y = Math.max(12, (vp.clientHeight - z.h * CANVAS.k) / 2) - z.y * CANVAS.k;
  applyTransform();
}

/* ============================ 高亮链路 ============================ */
function updateDim(){
  if (!STATE.sel){ resetEdgeFocus(); document.querySelectorAll('.opt.dim,.ans.dim,.note-node.dim').forEach(function(d){ d.classList.remove('dim'); }); return; }
  var keep = {}, on = [], guard = 0;
  (function walk(cur){
    if (!cur || keep[cur] || guard++ > 5000) return;
    keep[cur] = 1;
    EDGES.forEach(function(e){
      if (e.kind === 'broken') return;
      if (e.from === cur && !keep[e.to]){ on.push(e); walk(e.to); }
      if (e.to === cur && !keep[e.from]){ on.push(e); walk(e.from); }
    });
  })(STATE.sel);
  document.querySelectorAll('[data-opt]').forEach(function(el){ el.classList.toggle('dim', !keep[el.getAttribute('data-opt')]); });
  document.querySelectorAll('[data-ansnode]').forEach(function(el){ el.classList.toggle('dim', !keep[el.getAttribute('data-ansnode')]); });
  document.querySelectorAll('[data-note]').forEach(function(el){ el.classList.toggle('dim', !keep[el.getAttribute('data-note')]); });
  focusEdges(on);
}
function focusEdges(on){
  var svg = document.getElementById('edges');
  if (!on || !on.length) return resetEdgeFocus();
  var set = {}; on.forEach(function(e){ set[EDGES.indexOf(e)] = 1; });
  svg.querySelectorAll('path[data-ei]').forEach(function(p){
    var i = Number(p.getAttribute('data-ei'));
    if (set[i]){ p.setAttribute('stroke-width', 2.8); p.setAttribute('opacity', 1); }
    else { p.setAttribute('stroke-width', 1); p.setAttribute('opacity', 0.06); }
  });
}
function resetEdgeFocus(){
  document.getElementById('edges').querySelectorAll('path[data-ei]').forEach(function(p){
    p.setAttribute('stroke-width', p.getAttribute('data-w0') || 1.5);
    p.setAttribute('opacity', p.getAttribute('data-o0') || 0.8);
  });
}

/* ============================ 图上的「结束」节点（按叶子生成） ============================ */
function buildEdges(){
  EDGES = [];
  rebuildIndex();
  GRAPH.stages.forEach(function(s){
    var g = buildStageGraph(s.ver);
    g.edges.forEach(function(e){ EDGES.push({ from: e.from, to: e.to, kind: e.kind, ver: s.ver, via: e.via }); });
    /* 叶子 → 结束 */
    g.nodes.filter(function(n){ return n.kind === 'end'; }).forEach(function(n){
      EDGES.push({ from: n.parent, to: n.key, kind: 'toEnd', ver: s.ver });
    });
    /* 记事本引用（连到记事本区） */
    Object.keys(s.opts).forEach(function(oid){
      var o = s.opts[oid], c = o.cond || {}, k = optKey(s.ver, oid);
      if (c.type === 'noNote' && c.id) EDGES.push({ from: noteKey(c.id), to: k, kind: 'note' });
      (o.ans.dumb || []).concat(o.ans.full || []).forEach(function(a){
        var ac = a.cond || {};
        if ((ac.type === 'note' || ac.type === 'noNote') && ac.id) EDGES.push({ from: noteKey(ac.id), to: k, kind: 'note' });
      });
    });
  });
}

/* ============================ 属性面板 ============================ */
/* 文案字段的占位符提示 —— **统一一句**（游戏侧实现见 core.fillVars，2026-09-19 收敛）。
   写这里是因为作者填文案时看不到别处的文档；改一处全站生效。 */
var PH_TIP = '；可用占位符 {model} 模型名 / {param} 参数 / {arch} 架构名';
var INPUT_HANDLERS = {};
function fldRO(k, v, mono, empty){
  return '<div class="fld"><span class="k">' + esc(k) + '</span><span class="v' + (mono ? ' mono' : '') + (empty ? ' empty' : '') + '">' +
    esc(v == null || v === '' ? '—' : v) + '</span></div>';
}
/* `defer=true` = **失焦 / 回车才提交**（挂 `data-inpdefer`）。
   ⚠️ 2026-09-19（用户报「有时候会莫名其妙显示引用失效」）：id 类字段原来是**每敲一个字符**
      就把整串写回数据（`c.ids = v.split(...)`）⇒ 打字打到一半（"2000"）卡片立刻挂
      「1 个引用失效」，敲完又消失 —— 典型的「莫名其妙」。id 类字段一律用 defer。 */
function fldInp(k, val, ph, onInput, defer){
  var id = 'i' + Math.random().toString(36).slice(2, 8);
  INPUT_HANDLERS[id] = onInput;
  return '<div class="fld"><span class="k">' + esc(k) + '</span><span class="v">' +
    '<input class="inp" data-inp="' + id + '"' + (defer ? ' data-inpdefer="1"' : '') + ' value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph || '') + '"></span></div>';
}
function fldTa(k, val, ph, onInput){
  var id = 'i' + Math.random().toString(36).slice(2, 8);
  INPUT_HANDLERS[id] = onInput;
  return '<div class="fld"><span class="k">' + esc(k) + '</span><span class="v">' +
    '<textarea class="ta" data-inp="' + id + '" placeholder="' + esc(ph || '') + '">' + esc(val == null ? '' : val) + '</textarea></span></div>';
}
/* 带一个右侧小按钮的输入行（「试打开」这类"填完立刻验证"用） */
function fldInpBtn(k, val, ph, btnText, btnAttr, onInput){
  var id = 'i' + Math.random().toString(36).slice(2, 8);
  INPUT_HANDLERS[id] = onInput;
  return '<div class="fld"><span class="k">' + esc(k) + '</span><span class="v"><div class="row">' +
    '<input class="inp" data-inp="' + id + '" value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph || '') + '">' +
    '<button class="mini" ' + btnAttr + '="' + id + '">' + esc(btnText) + '</button></div></span></div>';
}
function fldSel(k, val, opts, onChange){
  var id = 'i' + Math.random().toString(36).slice(2, 8);
  INPUT_HANDLERS[id] = onChange;
  return '<div class="fld"><span class="k">' + esc(k) + '</span><span class="v">' +
    '<select class="sel2" data-inp="' + id + '">' +
    opts.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') +
    '</select></span></div>';
}
function fldChk(k, val, label, onChange){
  var id = 'i' + Math.random().toString(36).slice(2, 8);
  INPUT_HANDLERS[id] = onChange;
  return '<div class="fld"><span class="k">' + esc(k) + '</span><span class="v">' +
    '<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-inp="' + id + '"' + (val ? ' checked' : '') + '>' +
    '<span>' + esc(label) + '</span></label></span></div>';
}
function noteOptions(){
  var o = [['', '（未选）']];
  Object.keys(GRAPH.notes).forEach(function(k){ o.push([k, k + ' ' + (GRAPH.notes[k].name || '')]); });
  return o;
}

/* ---- 选项面板 ---- */
function showOptInsp(key){
  var p = key.split(':'), ver = p[1], oid = p[2];
  var s = stageOf(ver); if (!s) return showEmptyInsp();
  var o = s.opts[oid]; if (!o) return showEmptyInsp();
  o.cond = o.cond || { type: 'none' };
  o.ans = o.ans || { dumb: [], full: [] };
  var c = o.cond;
  var ups = EDGES.filter(function(e){ return e.to === key && (e.kind === 'ans' || e.kind === 'flow' || e.kind === 'note'); });
  var downs = EDGES.filter(function(e){ return e.from === key && e.kind !== 'broken'; });
  var ansList = allAns(ver).filter(function(x){ return x.oid === oid; });

  var h = '<div class="insp-hd"><div class="t">选项 · ' + esc(short(o.text, 24)) + '</div>' +
    '<div class="s">选项 #' + esc(oid) + ' · ' + esc(ver) + ' · ' + ansList.length + ' 条回答（各自是画布上的节点）</div></div>';

  h += '<div class="mod"><div class="mod-hd">① 这个选项</div>' +
    fldTa('玩家看到的话', o.text, '玩家点的那句话' + PH_TIP, function(v){ o.text = v; localPatch(); }) +
    fldChk('开场可见', o.start, '一开始就能选（排在该阶段最上面一排）', function(v){ o.start = v; reRender(); }) +
    fldSel('答完去哪', o.next || 'continue',
      [['continue', 'continue · 留在这批选项里'], ['start', 'start · 回到开场'], ['end', 'end · 结束测试']],
      function(v){ o.next = v; localPatch(); }) + '</div>';

  h += '<div class="mod"><div class="mod-hd">② 什么时候出现</div>' +
    fldSel('条件类型', c.type,
      [['none', '无条件（一直可见）'], ['prevAns', '选过某些选项（看过它们的回答）'], ['noNote', '还没记下某条记事本']],
      function(v){ c.type = v; refreshPanel(); }) +
    (c.type === 'prevAns' ? fldInp('上游回答 id', (c.ids || []).join(', '), '回答 id，逗号分隔，如 20002, 20003',
      function(v){
        c.ids = v.split(/[,\s]+/).filter(Boolean);
        syncEdges();                                 // 先重建索引，再判断哪些 id 真的找不到
        var miss = c.ids.filter(function(x){ return !ANS_OWNER[x]; });
        refreshPanel();                              // 延迟提交不会丢焦点（失焦才提交）⇒ 可以整体重画面板
        if (miss.length) toast('这 ' + miss.length + ' 个 id 找不到对应回答：' + miss.slice(0, 4).join('、')
          + (miss.length > 4 ? '…' : '') + '　（卡片上会标「引用失效」）');
      }, true) : '') +
    (c.type === 'noNote' ? fldSel('记事本条目', c.id, noteOptions(), function(v){ c.id = v; syncEdges(); }) : '') +
    '</div>';
  if (c.type === 'prevAns'){
    var ups2 = {}, broken = 0;
    (c.ids || []).forEach(function(id){ var ow = ANS_OWNER[id]; if (!ow) { broken++; return; } ups2[ow.optId] = (ups2[ow.optId] || 0) + 1; });
    h += '<div class="tipbox">人话翻译：' + (Object.keys(ups2).length
      ? '玩家<b>选过</b> ' + Object.keys(ups2).map(function(k){ return '「' + esc(short((s.opts[k] || {}).text || k, 12)) + '」'; }).join('、') + ' <b>里的任意一条回答</b>之后，这个选项才会出现'
      : '（还没填上游 id）') + '</div>';
    /* 点名到 id —— 光写个数只会让人「莫名其妙」（用户 2026-09-19 的原话） */
    if (broken) h += '<div class="warnbox">有 ' + broken + ' 个 id 找不到对应回答：<b>'
      + esc((c.ids || []).filter(function(x){ return !ANS_OWNER[x]; }).slice(0, 6).join('、')) + '</b>'
      + (broken > 6 ? '…' : '') + '（可能是刚删掉的回答，或者打错了）</div>';
  }

  if (ups.length){
    h += '<div class="mod"><div class="mod-hd">③ 从哪来（上游）</div>';
    ups.forEach(function(e){
      var q = e.from.split(':'), label, txt;
      if (e.kind === 'note'){ label = '记事本'; txt = (GRAPH.notes[q[1]] || {}).name || q[1]; }
      else if (q[0] === 'start'){ label = '开始'; txt = '阶段起点'; }
      else if (q[0] === 'ans'){ var ow = optOfAns(q[1], q[2]); label = '回答 #' + q[2]; txt = ow ? short(ow.a.text || ow.a.post || '', 24) : ''; }
      else { label = '选项 #' + q[2]; txt = ((stageOf(q[1]) || {}).opts[q[2]] || {}).text || ''; }
      h += '<div class="fld"><span class="k">' + esc(label) + '</span><span class="v">' + esc(short(txt, 30)) + '</span></div>';
    });
    h += '</div>';
  }
  if (downs.length){
    var dl = {};
    downs.forEach(function(e){
      var q = e.to.split(':');
      var label = q[0] === 'ans' ? ('回答 #' + q[2]) : (q[0] === 'end' ? '结束' : (q[0] === 'note' ? '记事本 #' + q[1] : '选项 #' + q[2]));
      dl[label] = 1;
    });
    h += '<div class="mod"><div class="mod-hd">④ 通向哪（下游 ' + Object.keys(dl).length + '）</div>' +
      Object.keys(dl).map(function(k){ return '<div class="fld"><span class="k">→</span><span class="v mono">' + esc(k) + '</span></div>'; }).join('') + '</div>';
  }

  h += '<div class="mod"><div class="mod-hd">⑤ 回答（' + ansList.length + '）' +
    '<button class="mini" data-addans2="' + esc(ver + ':' + oid + ':full') + '">＋ 开智</button>' +
    '<button class="mini" data-addans2="' + esc(ver + ':' + oid + ':dumb') + '">＋ 咕嘎</button></div>';
  if (!ansList.length) h += '<div class="fld"><span class="v empty">还没有回答 —— 这个选项在画布上就是「叶子」，后面直接接一个「结束」。<br>想让它继续往后走，就加一条回答，然后让下一个选项依赖这条回答的 id。</span></div>';
  ansList.forEach(function(x){
    h += '<div class="fld"><span class="k">#' + esc(x.a.id) + '</span><span class="v">' +
      esc(short(x.a.text || x.a.post || (x.a.steps || [])[0] || '（空）', 34)) +
      '<br><span style="color:#8ea1b3">' + esc(x.a.type || 'text') + ' · ' + (x.tier === 'full' ? '开智' : '咕嘎') + '</span> ' +
      '<button class="mini" data-gotoans="' + esc(x.key) + '">编辑</button></span></div>';
  });
  h += '</div>';

  h += '<div class="mod"><div class="mod-hd">危险操作</div><div class="fld"><span class="k">选项</span><span class="v">' +
    '<button class="mini del" data-delopt="' + esc(ver + ':' + oid) + '">删除该选项（含它的 ' + ansList.length + ' 条回答）</button></span></div></div>';

  document.getElementById('insp').innerHTML = h;
}
/* ---- 回答面板 ---- */
function showAnsInsp(ansKey){
  var q = ansKey.split(':');            // ans:ver:aid
  var ver = q[1], aid = q[2];
  var ow = optOfAns(ver, aid);
  if (!ow) return showEmptyInsp();
  var a = ow.a;
  var ups = EDGES.filter(function(e){ return e.from === ansKey; });
  var upsThen = ups.filter(function(e){ return e.kind === 'then'; });
  var upsOpt = ups.filter(function(e){ return e.kind !== 'then'; });
  var sub = ow.chained
    ? '连播自回答 #' + esc(ow.owner.id) + ' · 属于选项 #' + esc(ow.oid)
    : '属于选项 #' + esc(ow.oid) + '「' + esc(short((optsOf(ver)[ow.oid] || {}).text || '', 12)) + '」· ' + (ow.tier === 'full' ? '开智档' : '咕嘎档');
  var h = '<div class="insp-hd"><div class="t">回答 #' + esc(aid) + '</div>' +
    '<div class="s">' + sub + '</div></div>';

  h += ansEditor(ver, ow.oid, ow.tier, ow.idx, a);
  /* 连播下游（`then` 链 · 2026-09-21） */
  h += '<div class="mod"><div class="mod-hd">播完接着播（连播 ' + upsThen.length + '）</div>';
  if (!upsThen.length){
    h += '<div class="fld"><span class="v empty">' + (ow.chained
      ? '链上回答也能继续往下连 —— 从它的把手拖到别的回答卡片上。'
      : '没有连播 —— 想「先播这条、再播另一条」，按住本卡片的把手拖到目标回答卡片上。') + '</span></div>';
  }
  upsThen.forEach(function(e){
    var p = e.to.split(':');
    h += '<div class="fld"><span class="k">→</span><span class="v">回答 #' + esc(p[2]) + '</span></div>';
  });
  h += '</div>';
  h += '<div class="mod"><div class="mod-hd">这条回答之后（选项依赖 ' + upsOpt.length + '）</div>';
  if (!upsOpt.length) h += '<div class="fld"><span class="v empty">没有选项依赖它 —— 所以它是分支末端，画布上接一个「结束」。</span></div>';
  upsOpt.forEach(function(e){
    var p = e.to.split(':');
    h += '<div class="fld"><span class="k">→</span><span class="v">选项 #' + esc(p[2]) + ' 「' + esc(short((optsOf(ver)[p[2]] || {}).text || '', 16)) + '」</span></div>';
  });
  h += '</div><div class="mod"><div class="fld"><span class="v"><button class="mini" data-backopt="' + esc(optKey(ver, ow.oid)) + '">← 回到所属选项</button></span></div></div>';
  document.getElementById('insp').innerHTML = h;
}
function ansEditor(ver, oid, tier, idx, a){
  var t = a.type || 'text';
  var owNow = optOfAns(ver, a.id);
  var h = '<div class="mod"><div class="mod-hd">回答内容 <span class="tag tag-' + esc(t) + '">' + esc(t) + '</span>' +
    (owNow && owNow.chained
      ? '<span class="tag" style="background:#fce7f3;color:#9d174d">连播</span>'
      : '<span class="pill ' + tier + '">' + (tier === 'full' ? '开智' : '咕嘎') + '</span>') +
    /* 删除按钮**按回答 id** 删（`data-delansnode`）—— 链上回答没有档位下标，用 id 删两条路都能走 */
    '<button class="mini del" data-delansnode="' + esc(ver + ':' + a.id) + '">删除</button></div>' +
    fldSel('类型', t, [['text','text 普通回答'],['think','think 思考框'],['cot','cot 简略过程'],['image','image 图片'],['audio','audio 语音'],['link','link 链接']],
      function(v){ a.type = v; refreshPanel(); }) +
    /* ⚠️ 改 id 是**破坏性**操作（所有指着旧号的引用会立刻变失效）⇒ 延迟提交 + 三道校验：
       非空 / 不与别人重号 / 改完**明确告诉他有几处引用会断**（不拦他，只告知）。 */
    fldInp('回答 id', a.id, '被别的选项引用时用这个号', function(v){
      var nv = String(v == null ? '' : v).trim();
      if (!nv){ toast('回答 id 不能为空 —— 空 id 会让多条回答撞成同一个节点'); refreshPanel(); return; }
      if (nv === String(a.id)) return;
      if (ANS_OWNER[nv]){ toast('id #' + nv + ' 已经被别的回答用了，换一个'); refreshPanel(); return; }
      var old = a.id, users = 0;
      GRAPH.stages.forEach(function(s){ Object.keys(s.opts || {}).forEach(function(oid){
        (((s.opts[oid].cond || {}).ids) || []).forEach(function(x){ if (String(x) === String(old)) users++; });
      }); });
      a.id = nv; syncEdges(); refreshPanel();
      toast(users ? ('回答 id 已改为 #' + nv + '；还有 ' + users + ' 处引用指着旧号 #' + old + '，它们现在是失效引用')
                  : ('回答 id 已改为 #' + nv));
    }, true);
  if (t === 'think') h += fldInp('title', a.title, '如：已深度思考（用时 2 秒）' + PH_TIP, function(v){ a.title = v; localPatch(); });
  if (t === 'cot') h += fldInp('pre', a.pre, '过程前的引子（可空）', function(v){ a.pre = v; });
  if (t === 'text' || t === 'image' || t === 'audio' || t === 'link'){
    h += fldTa('正文', a.text, '回答正文' + PH_TIP, function(v){ a.text = v; localPatch(); });
  }
  if (t === 'audio' || t === 'image'){
    /* src **不许手打路径**（2026-09-21 用户要求）⇒ 「选择文件」按钮开 ResPicker：
       图片列图片、语音列音频（按钮上带 data-restype，否则选择器不知道该列哪种）。
       ⚠️ 路径框仍保留可编辑（有些路径不在 resource 下），只是不再要求手打。 */
    var sid = 'i' + Math.random().toString(36).slice(2, 8);
    INPUT_HANDLERS[sid] = function(v){ a.src = v; };
    h += '<div class="fld"><span class="k">src</span><span class="v"><div class="row">' +
      '<input class="inp" data-inp="' + sid + '" value="' + esc(a.src || '') + '" placeholder="' +
        esc(t === 'audio' ? 'resource/sound/voice/文件名.wav' : 'resource/chat/文件名.webp') + '">' +
      '<button class="mini" data-respick="' + sid + '" data-restype="' + esc(t) + '">选择文件</button>' +
      '</div></span></div>';
    h += fldInp('status', a.status, '状态行文案，如 正在识别图片…' + PH_TIP, function(v){ a.status = v; });
  }
  if (t === 'link'){
    h += fldInp('linkText', a.linkText, '链接显示文字', function(v){ a.linkText = v; });
    h += fldInpBtn('url', a.url, 'https://…', '试打开', 'data-lnkopen', function(v){ a.url = v; });
  }
  if (t === 'think' || t === 'cot'){
    h += '<div class="mod-hd" style="border-top:1px solid var(--line)">步骤<span style="font-weight:400;color:var(--txt3);font-size:11px">' + esc(PH_TIP.replace('；', ' · ')) + '</span></div><div class="steps-edit">';
    (a.steps || []).forEach(function(stp, i){
      h += '<div class="row"><input class="inp" data-step="' + esc(ver + ':' + oid + ':' + tier + ':' + idx + ':' + i) + '" value="' + esc(stp) + '" placeholder="一步一行' + esc(PH_TIP) + '">' +
        '<button class="mini del" data-delstep="' + esc(ver + ':' + oid + ':' + tier + ':' + idx + ':' + i) + '">删</button></div>';
    });
    h += '<button class="mini" data-addstep="' + esc(ver + ':' + oid + ':' + tier + ':' + idx) + '">＋ 加一行</button></div>';
  }
  if (t === 'text' || t === 'link'){
    h += fldChk('think 叠加', !!a.think, '这条回答额外挂一个思考框', function(v){
      if (v) a.think = a.think || { title: '已深度思考（用时 2 秒）', steps: [''] }; else delete a.think;
      refreshPanel();
    });
    if (a.think){
      h += fldInp('think.title', a.think.title, '思考框标题' + PH_TIP, function(v){ a.think.title = v; });
      (a.think.steps || []).forEach(function(stp, i){
        h += '<div class="fld"><span class="k">思考 ' + (i + 1) + '</span><span class="v"><input class="inp" data-tstep="' +
          esc(ver + ':' + oid + ':' + tier + ':' + idx + ':' + i) + '" value="' + esc(stp) + '"></span></div>';
      });
      h += '<div class="fld"><span class="k"></span><span class="v"><button class="mini" data-addtstep="' + esc(ver + ':' + oid + ':' + tier + ':' + idx) + '">＋ 加一行思考</button></span></div>';
    }
  }
  h += fldSel('这条回答的档位条件', (a.cond || {}).type || 'fallback',
    [['fallback', 'fallback 兜底（该档随机取一条）'], ['note', 'note 需要记事本条目'], ['noNote', 'noNote 需要还没记下']],
    function(v){ a.cond = a.cond || {}; a.cond.type = v; refreshPanel(); });
  var ac = a.cond || {};
  if (ac.type === 'note' || ac.type === 'noNote') h += fldSel('记事本条目', ac.id, noteOptions(), function(v){ a.cond.id = v; syncEdges(); });
  h += fldInp('noteFor', a.noteFor, '答完解锁的记事本 id（可空）', function(v){ a.noteFor = v; syncEdges(); });
  return h + '</div>';
}
/* ---- 状态文案面板（用户要求：可配置 + 放在模块最上方） ---- */
function showStatusInsp(ver){
  var s = stageOf(ver); if (!s) return showEmptyInsp();
  s.status = s.status || { dumb: [], full: [] };
  var st = s.status;
  var h = '<div class="insp-hd"><div class="t">' + esc(ver) + ' · 状态文案</div>' +
    '<div class="s">游戏里显示在聊天面板顶部（跟着模型水平变）· 每行一条，随机取一条' + esc(PH_TIP) + '</div></div>';
  ['dumb','full'].forEach(function(tier){
    var arr = st[tier] = st[tier] || [];
    h += '<div class="mod"><div class="mod-hd">' + (tier === 'full' ? '开智档状态' : '咕嘎档状态') + '（' + arr.length + '）' +
      '<span class="pill ' + tier + '">' + tier + '</span>' +
      '<button class="mini" data-addstatus="' + esc(ver + ':' + tier) + '">＋ 加一条</button></div>';
    if (!arr.length) h += '<div class="fld"><span class="v empty">（未配置 —— 这一档在游戏里没有状态文案）</span></div>';
    arr.forEach(function(txt, i){
      h += '<div class="fld"><span class="k">' + (i + 1) + '</span><span class="v"><div class="row">' +
        '<input class="inp" data-statusline="' + esc(ver + ':' + tier + ':' + i) + '" value="' + esc(txt) + '" placeholder="一句状态文案' + esc(PH_TIP) + '">' +
        '<button class="mini del" data-delstatus="' + esc(ver + ':' + tier + ':' + i) + '">删</button></div></span></div>';
    });
    h += '</div>';
  });
  document.getElementById('insp').innerHTML = h;
}
function showNoteInsp(key){
  var nid = key.split(':')[1], n = GRAPH.notes[nid] || {};
  var uses = EDGES.filter(function(e){ return (e.from === key || e.to === key) && e.kind !== 'broken'; });
  var h = '<div class="insp-hd"><div class="t">记事本条目 · ' + esc(n.name || nid) + '</div>' +
    '<div class="s">note #' + esc(nid) + ' · 跨阶段保留</div></div>' +
    '<div class="mod"><div class="mod-hd">条目</div>' + fldRO('id', nid, true) +
    fldInp('name', n.name, '条目名', function(v){ GRAPH.notes[nid].name = v; localPatch(); }) +
    fldTa('text', n.text, '条目内容' + PH_TIP, function(v){ GRAPH.notes[nid].text = v; localPatch(); }) + '</div>' +
    '<div class="mod"><div class="mod-hd">引用关系（' + uses.length + '）</div>';
  if (!uses.length) h += '<div class="fld"><span class="v empty">暂未被引用</span></div>';
  uses.forEach(function(e){
    var other = e.from === key ? e.to : e.from;
    h += '<div class="fld"><span class="k">' + (e.from === key ? '解锁' : '依赖') + '</span><span class="v mono">' + esc(other) + '</span></div>';
  });
  h += '</div><div class="mod"><div class="mod-hd">危险操作</div><div class="fld"><span class="k">条目</span><span class="v">' +
    '<button class="mini del" data-delnote="' + esc(nid) + '">删除该条目</button></span></div></div>';
  document.getElementById('insp').innerHTML = h;
}
function showEmptyInsp(){
  document.getElementById('insp').innerHTML =
    '<div class="insp-hd"><div class="t">对话树编辑</div><div class="s">点画布上任意节点开始改</div></div>' +
    '<div class="empty-tip">' +
      '<b>读图</b>：<b>开始</b> 在最上面居中 → 第一排选项（开场可见的）→ 每个选项的回答 → 看过这些回答才出现的选项 → … → 每条分支末尾各自一个 <b>结束</b><br><br>' +
      '<b>青绿线</b> = 推进主线（开始→选项→回答）<br><b>浅蓝线</b> = 回答 → 下一个选项<br>' +
      '<b>琥珀虚线</b> = 记事本引用 · <b>紫色虚线</b> = 跨阶段引用<br><br>' +
      '<b>编辑</b>：卡片右上角 ＋/× 加回答 / 删选项 · 阶段右上角 ＋ 加选项 · 点<b>状态条</b>改两档状态文案<br>' +
      '<b>移动</b>：拖卡片改单个位置 · <b>按住卡片上的四向箭头拖 = 连下方所有子节点一起动</b> · 拖阶段标题整体平移 · <span class="kbd">全览</span> 看全局<br>' +
      '<span class="kbd">滚轮</span> 缩放 · <span class="kbd">空白拖拽</span> 平移 · <span class="kbd">Esc</span> 取消选中<br><br>' +
      '<b>文案占位符</b>（选项 / 回答 / 思考框 / COT 步骤 / 状态行 / 记事本都能写）：' +
      '<b>{model}</b> 玩家自定义模型名 · <b>{param}</b> 参数档（如 70）· <b>{arch}</b> 架构名 · ' +
      '<b>{archName}</b> 同 {arch} · <b>{archId}</b> 架构代号' +
    '</div>';
}

/* ---------- 局部刷新（避免打字丢焦点） ---------- */
function localPatch(){
  DIRTY = true;
  document.querySelectorAll('[data-opt]').forEach(function(el){
    var k = el.getAttribute('data-opt'), p = k.split(':');
    var o = (optsOf(p[1]) || {})[p[2]]; if (!o) return;
    var t = el.querySelector('.opt-t'); if (t) t.textContent = o.text || '（还没写文本）';
  });
  document.querySelectorAll('[data-ansnode]').forEach(function(el){
    var q = el.getAttribute('data-ansnode').split(':');
    var ow = optOfAns(q[1], q[2]); if (!ow) return;
    var tx = el.querySelector('.ans-tx');
    var main = ow.a.text != null ? ow.a.text : (ow.a.post != null ? ow.a.post : ((ow.a.steps || [])[0] || ''));
    if (tx) tx.textContent = short(main, 64) || '（空回答）';
  });
  document.querySelectorAll('[data-note]').forEach(function(el){
    var nid = el.getAttribute('data-note').split(':')[1], n = GRAPH.notes[nid] || {};
    var nm = el.querySelector('.nm'); if (nm) nm.textContent = n.name || nid;
    var tx = el.querySelector('.tx'); if (tx) tx.textContent = short(n.text || '', 32);
  });
  document.getElementById('hdSub').textContent = document.getElementById('hdSub').textContent.replace(/ · 已改动$/, '') + ' · 已改动';
}
function syncEdges(){
  DIRTY = true;
  buildEdges(); drawEdges(); renderZones(); refreshBadges(); updateDim();
}
function refreshPanel(){
  syncEdges();
  if (STATE.selKind === 'status' && STATE.statusVer) showStatusInsp(STATE.statusVer);
  else if (STATE.selKind === 'note' && STATE.sel) showNoteInsp(STATE.sel);
  else if (STATE.selKind === 'ans' && STATE.ansKey) showAnsInsp(STATE.ansKey);
  else if (STATE.sel) showOptInsp(STATE.sel);
}
/** 打字改 ids 时**不重建面板**（重建会丢焦点）：
    连线与卡片徽章实时更新，"人话翻译"文字在重新点开该选项时刷新。 */
function refreshCondWarn(){ /* 有意留空：见上 */ }
function refreshBadges(){
  document.querySelectorAll('[data-opt]').forEach(function(el){
    var k = el.getAttribute('data-opt'), p = k.split(':');
    var o = (optsOf(p[1]) || {})[p[2]]; if (!o) return;
    var hd = el.querySelector('.opt-hd');
    var row = hd.querySelector('.badges');
    var html = badgesFor(p[1], p[2], o);
    if (!row){ if (!html) return; row = document.createElement('div'); row.className = 'badges'; hd.appendChild(row); }
    row.innerHTML = html;
  });
}
function reRender(){
  DIRTY = true;
  var keep = STATE.sel, kind = STATE.selKind, ak = STATE.ansKey, sv = STATE.statusVer;
  render();
  STATE.sel = keep; STATE.selKind = kind; STATE.ansKey = ak; STATE.statusVer = sv;
  paintSel();
}

/* ============================ 编辑操作 ============================ */
/* ==========================================================================
   撤回（Undo）—— 2026-09-19 用户要求：「为了防止误删，在上方蓝色栏加一个撤回按钮，支持直接 ctrl+Z」
   --------------------------------------------------------------------------
   快照式：每次**会改内容**的操作之前，把 GRAPH + POS 深拷一份压栈；撤回就把最近一份盖回去。
     · 为什么不用命令模式：改法五花八门（增删选项/回答/记事本/状态行/连线/字段编辑…），
       逐个写反向操作必漏；深拷贝一张图在这个规模（8 阶段 / 200 节点）完全够用。
     · ⚠️ **纯拖动 / 缩放 / 平移不进栈**：拖节点太频繁，会把真正要防的「误删」挤出栈。
       拖动的位移会跟着「上一条内容操作」的快照一起被撤回（位置属表现层，可接受）。
     · 输入框打字**按字段 + 1.5s 时间窗合并**成一栈，否则撤一次只退一个字。
   ⚠️ 恢复时**不能整体替换 GRAPH** —— 编辑器那边 TOOL.data 指着同一个对象
      ⇒ 只改它的 notes / stages 两个属性；POS 也**原地清空再填**，不换对象。 */
var UNDO = [], UNDO_MAX = 60, _undoKey = null, _undoTs = 0;
function snapNow(){ return { g: JSON.parse(JSON.stringify(GRAPH)), p: JSON.parse(JSON.stringify(POS)) }; }
function pushUndo(label, coalesceKey){
  if (coalesceKey){
    var now = Date.now();
    if (coalesceKey === _undoKey && now - _undoTs < 1500){ _undoTs = now; return; }   // 同一字段连续输入 → 合并
    _undoKey = coalesceKey; _undoTs = now;
  } else { _undoKey = null; _undoTs = 0; }
  UNDO.push({ label: label, s: snapNow() });
  while (UNDO.length > UNDO_MAX) UNDO.shift();
  refreshUndoBtn();
}
function dropUndoTop(){ UNDO.pop(); _undoKey = null; refreshUndoBtn(); }
function restoreSnap(s){
  var g = JSON.parse(JSON.stringify(s.g));
  GRAPH.notes = g.notes; GRAPH.stages = g.stages;          // 原地换属性，保住编辑器的 TOOL.data 引用
  Object.keys(POS).forEach(function(k){ delete POS[k]; });
  Object.keys(s.p).forEach(function(k){ POS[k] = s.p[k]; });
  rebuildIndex();
  STATE.sel = null; STATE.selKind = null; STATE.ansKey = null; STATE.statusVer = null;
}
function undo(){
  if (!UNDO.length){ toast('没有可撤回的操作了'); return; }
  var it = UNDO.pop();
  restoreSnap(it.s);
  _undoKey = null; _undoTs = 0;
  reRender(); showEmptyInsp(); refreshUndoBtn();
  toast('已撤回：' + it.label + (UNDO.length ? '　（还能撤 ' + UNDO.length + ' 步）' : '　（撤回栈已空）'));
}
function refreshUndoBtn(){
  var b = document.getElementById('btnUndo'); if (!b) return;
  b.disabled = UNDO.length === 0;
  b.title = UNDO.length
    ? ('撤回上一步（Ctrl+Z）· 最近：' + UNDO[UNDO.length - 1].label + ' · 还能撤 ' + UNDO.length + ' 步')
    : '没有可撤回的操作（Ctrl+Z 同样无效）';
}
function addAns(ver, oid, tier){
  pushUndo('加一条回答');
  var o = optsOf(ver)[oid];
  o.ans = o.ans || { dumb: [], full: [] };
  o.ans[tier] = o.ans[tier] || [];
  var id = nextAnsId();
  o.ans[tier].push({ id: id, type: 'text', text: '', cond: { type: 'fallback' } });
  reRender();
  select(ansNodeKey(ver, id), 'ans');
  toast('加了 1 条' + (tier === 'full' ? '开智' : '咕嘎') + '回答 #' + id);
}

/* 点卡片 / 面板的「＋ 回答」→ **不立刻建节点**，而是进「虚影跟随鼠标 → 再点一次落位」
   （2026-09-19 用户要求）。
   ⚠️ 为什么不能「先建再拖」：新回答没有 POS ⇒ 自动布局把它排到**阶段最右侧**，
      阶段框跟着被拉长、整块布局变形（用户原话：「变很乱」）。
      所以与顶栏「＋ 节点」走同一条管道：**放下时才创建** ⇒ 一建出来就带 POS，
      位置就是用户点的地方；取消也没有「回滚」问题（什么都没建）。
   选项 / 档位 / 阶段已由按钮定死（pendingAdd.oid / tier / ver），不用再猜「挂到哪个选项」。 */
function beginPlaceAns(ver, oid, tier){
  cancelAdd();
  pendingAdd = { kind: 'ans', ver: ver, oid: oid, tier: tier || 'full' };
  var g = addGhostEl();
  if (g){ g.hidden = false; g.textContent = '新回答落在这里'; }
  toast('移到想放的位置，再点一次就放下回答（' + (tier === 'dumb' ? '咕嘎' : '开智') + '）');
}
function delAns(ver, oid, tier, idx){
  var o = optsOf(ver)[oid];
  var a = (o.ans[tier] || [])[Number(idx)]; if (!a) return;
  if (!confirm('删除回答 #' + a.id + '？依赖它的选项会变成失效引用。')) return;
  pushUndo('删回答 #' + a.id);
  o.ans[tier].splice(Number(idx), 1);
  reRender(); select(optKey(ver, oid), 'opt');
  toast('删了回答 #' + a.id);
}
function delAnsByNode(ver, aid){
  var ow = optOfAns(ver, aid); if (!ow) return;
  /* 链上回答（`then` 链）不走档位数组，得从链主回答的 then 里摘 */
  if (ow.chained){
    var own = ow.owner;
    if (!confirm('删除链上回答 #' + ow.a.id + '？（它是回答 #' + own.id + ' 的连播，删掉后那条就不连播了）')) return;
    pushUndo('删链上回答 #' + ow.a.id);
    var arr = own.then || [], i = arr.indexOf(ow.a);
    if (i >= 0) arr.splice(i, 1);
    if (!arr.length) delete own.then;
    reRender(); select(ansNodeKey(ver, own.id), 'ans');
    toast('删了链上回答 #' + ow.a.id);
    return;
  }
  delAns(ver, ow.oid, ow.tier, ow.idx);
}
function delOpt(ver, oid){
  var s = stageOf(ver); if (!s) return;
  if (!confirm('删除选项 #' + oid + '「' + short((s.opts[oid] || {}).text || '', 14) + '」？它名下的回答一起删。')) return;
  pushUndo('删选项 #' + oid);
  delete s.opts[oid]; delete POS[optKey(ver, oid)];
  if (STATE.sel === optKey(ver, oid)){ STATE.sel = null; STATE.selKind = null; }
  reRender(); showEmptyInsp();
  toast('删了选项 #' + oid);
}
function addOpt(ver){
  pushUndo('加一个选项');
  var id = nextOptId();
  optsOf(ver)[id] = { text: '新选项', start: false, next: 'continue', ans: { dumb: [], full: [] }, cond: { type: 'none' } };
  reRender(); select(optKey(ver, id), 'opt');
  toast('在 ' + ver + ' 加了选项 #' + id);
}
/* ==========================================================================
   「＋ 节点」：选类型 → 虚影吸附跟随鼠标 → **再点一次**把节点放下（用户 2026-09-19 要求）
   --------------------------------------------------------------------------
   流程：点顶栏「＋ 节点」→ 弹出「＋ 选项 / ＋ 回答」→ 选一个 → 出现跟随光标的虚线虚影，
   移动鼠标它跟着走（吸附），**再点一次**就在光标处落下真节点，并自动选中（右侧直接改文案）。
   阶段归属：优先取光标命中的阶段区域；没命中就用当前选中节点所在阶段；再没有就用第一个阶段。
   回答的归属：挂到**离落点最近的选项**上（同阶段内）；阶段里一个选项都没有就提示先加选项。
   Esc / 再点一次按钮 = 取消。 */
var pendingAdd = null;   /* { kind:'opt'|'ans' }
                            ＋回答入口还会带 { ver, oid, tier } —— 选项与档位已定，放下时直接用它。 */
function addMenuEl(){ return document.getElementById('addMenu'); }
function addGhostEl(){ return document.getElementById('addGhost'); }
function cancelAdd(){
  pendingAdd = null;
  var m = addMenuEl(); if (m) m.hidden = true;
  var g = addGhostEl(); if (g) g.hidden = true;
}
function ghostFollow(cx, cy){
  var g = addGhostEl(); if (!g || !pendingAdd) return;
  g.hidden = false;
  g.textContent = pendingAdd.kind === 'opt' ? '新选项落在这里' : '新回答落在这里';
  g.style.left = cx + 'px'; g.style.top = cy + 'px';
}
/* 光标在哪个阶段里（区域矩形命中 → 选中节点所属阶段 → 第一个阶段） */
function stageAtClient(cx, cy){
  var p = toWorld(cx, cy), found = null;
  ZONES.forEach(function(z){
    if (z.note) return;
    if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) found = z.ver;
  });
  if (found) return found;
  var sel = STATE.sel || '';
  var parts = sel.split(':');
  if (parts[0] === 'opt' || parts[0] === 'ans' || parts[0] === 'status' || parts[0] === 'start' || parts[0] === 'end'){
    if (stageOf(parts[1])) return parts[1];
  }
  return (GRAPH.stages[0] || {}).ver || null;
}
function placePendingAdd(cx, cy){
  if (!pendingAdd) return;
  var kind = pendingAdd.kind;
  /* ⚠️ 来自「＋ 回答」的放置：阶段由按钮所属选项定死（允许落到阶段框外 —— 卡片属于那个阶段，框会自动包住它） */
  var ver = pendingAdd.ver || stageAtClient(cx, cy);
  if (!ver){ toast('这里不在任何阶段区域里 —— 先落到某个阶段的画布上'); return; }
  var p = toWorld(cx, cy);
  if (kind === 'opt'){
    pushUndo('放下一个新选项');
    var id = nextOptId();
    optsOf(ver)[id] = { text: '新选项', start: false, next: 'continue',
      ans: { dumb: [], full: [] }, cond: { type: 'none' } };
    POS[optKey(ver, id)] = { x: p.x - CARD_W / 2, y: p.y - 18 };   // 落点 = 卡片上方中点
    cancelAdd(); reRender(); select(optKey(ver, id), 'opt');
    toast('在 ' + ver + ' 放下了一个选项 #' + id + ' —— 右侧改文案');
    return;
  }
  /* 回答：① 来自卡片/面板「＋ 回答」—— **选项与档位已定**（pendingAdd.oid / tier）；
           ② 来自顶栏「＋ 节点 → ＋ 回答」—— 找**离落点最近**的选项，现场新建。 */
  var best = pendingAdd.oid, tier = pendingAdd.tier || 'full';
  if (!best){
    var opts = optsOf(ver), bd = Infinity;
    Object.keys(opts).forEach(function(oid){
      var n = NODE[optKey(ver, oid)]; if (!n) return;
      var d = Math.pow(n.x + n.w / 2 - p.x, 2) + Math.pow(n.y + n.h / 2 - p.y, 2);
      if (d < bd){ bd = d; best = oid; }
    });
  }
  if (!best || !optsOf(ver)[best]){ toast(ver + ' 还没有可挂的选项 —— 回答要挂在选项下面，先加一个选项'); return; }
  var aid = nextAnsId();                       // addAns 内部也是取 nextAnsId()，先拿到同一个号
  addAns(ver, best, tier);
  POS[ansNodeKey(ver, aid)] = { x: p.x - ANS_W / 2, y: p.y - 16 };
  reRender(); select(ansNodeKey(ver, aid), 'ans');
  toast('放到 ' + ver + ' 选项 #' + best + ' 下面了（回答 #' + aid + '）');
  cancelAdd();
}
function addNote(){
  pushUndo('加记事本条目');
  var id = nextAnsId();
  while (GRAPH.notes[id]) id = String(Number(id) + 1);
  GRAPH.notes[id] = { name: '新条目', text: '' };
  reRender(); select(noteKey(id), 'note');
  toast('加了记事本条目 #' + id);
}
function delNote(nid){
  if (!confirm('删除记事本条目 #' + nid + '？引用它的地方会变成失效引用。')) return;
  pushUndo('删记事本 #' + nid);
  delete GRAPH.notes[nid]; delete POS[noteKey(nid)];
  if (STATE.sel === noteKey(nid)){ STATE.sel = null; STATE.selKind = null; }
  reRender(); showEmptyInsp();
  toast('删了记事本 #' + nid);
}
function addStatusLine(ver, tier){
  pushUndo('加状态文案');
  var s = stageOf(ver); s.status = s.status || { dumb: [], full: [] };
  s.status[tier] = s.status[tier] || [];
  s.status[tier].push('');
  reRender(); select('status:' + ver, 'status');
}
function delStatusLine(ver, tier, i){
  pushUndo('删状态文案');
  var s = stageOf(ver);
  (s.status[tier] || []).splice(Number(i), 1);
  reRender(); select('status:' + ver, 'status');
}

/* ============================ 连线编辑：拖出引用 / 删除引用（用户要求） ============================
   交互：hover 节点 → 下方出现把手 → 按住拖到任意「选项」上方松手 = 建立引用；
        点击已有的线 = 选中并在右侧面板里删除。
   映射规则（拖拽方向 = 引用方向，源是上游、目标是下游）：
     · 从「回答」拖到「选项」  → 该选项 cond.ids += 这条回答的 id（最常用）
     · 从「选项」拖到「选项」  → 该选项 cond.ids += 源选项的**全部回答**（"接住"语义）
     · 从「开始」拖到「选项」  → 该选项 start=true（开场可见）
     · 拖到「结束」/ 从「结束」拖出 → 不支持（结束是按叶子自动生成的） */
var linkDrag = null;
function toWorld(cx, cy){
  var r = vp.getBoundingClientRect();
  return { x: (cx - r.left - CANVAS.x) / CANVAS.k, y: (cy - r.top - CANVAS.y) / CANVAS.k };
}
function nodeAt(pt){
  var hit = null;
  Object.keys(NODE).forEach(function(k){
    var n = NODE[k];
    if (pt.x >= n.x && pt.x <= n.x + n.w && pt.y >= n.y && pt.y <= n.y + n.h) hit = k;
  });
  return hit;
}
function setHint(txt){
  var h = document.getElementById('hint');
  if (!txt){ h.classList.remove('on'); return; }
  h.textContent = txt; h.classList.add('on');
}
/* 目标回答是否在 node 的连播子树里（含 node 自身）—— **任意层**防环用 */
function ansSubtreeHas(node, aid, depth){
  if (!node || typeof node !== 'object' || (depth || 0) > 50) return false;
  if (String(node.id) === String(aid)) return true;
  return (Array.isArray(node.then) ? node.then : []).some(function(sub){
    return sub && typeof sub === 'object' && ansSubtreeHas(sub, aid, (depth || 0) + 1);
  });
}
function canConnect(from, to){
  if (!from || !to || from === to) return { ok: false, why: '' };
  var t = to.split(':'), f = from.split(':');
  /* 回答 → 回答 = **连播**（`then` 链 · 2026-09-21）：源回答播完自动接上目标回答。
     **支持任意层** —— 链上的回答也能继续往下连，只要不成环。 */
  if (f[0] === 'ans' && t[0] === 'ans'){
    if (f[1] !== t[1]) return { ok: false, why: '不能跨阶段连 —— 回答只能连本阶段的其他回答' };
    var src = optOfAns(f[1], f[2]);
    if (!src) return { ok: false, why: '源回答不存在' };
    if (String(f[2]) === String(t[2])) return { ok: false, why: '' };
    var dst = optOfAns(t[1], t[2]);
    if (!dst) return { ok: false, why: '目标回答不存在' };
    /* 防环（任意层）：目标回答的子树里已经有源回答 ⇒ 连上就成环 */
    if (ansSubtreeHas(dst.a, f[2])) {
      return { ok: false, why: '这样会连成环（「' + f[2] + '」已经在「' + t[2] + '」的下游里了）' };
    }
    return { ok: true };
  }
  if (t[0] !== 'opt') return { ok: false, why: '只能连到「选项」或「回答」上（结束节点是按叶子自动生成的）' };
  if (f[0] === 'ans' || f[0] === 'opt' || f[0] === 'start') return { ok: true };
  return { ok: false, why: '这条线不支持' };
}
function connect(from, to){
  var f = from.split(':'), t = to.split(':');
  /* 回答 → 回答 = 连播（`then` 链）：把目标回答**移入**源回答的 then 数组。
     ⚠️ 是「移动」不是「复制」—— 回答 id 全树唯一，一个回答只能在一个位置；
        移走后它原来的位置就没了（这是用户拖这条线时的预期：把这条回答挂到那条后面）。 */
  if (f[0] === 'ans' && t[0] === 'ans'){
    var srcE = optOfAns(f[1], f[2]), dstE = optOfAns(t[1], t[2]);
    if (!srcE) return { err: '源回答不存在（画布可能没刷新，点一下空白处重画）' };
    if (!dstE) return { err: '目标回答不存在（画布可能没刷新，点一下空白处重画）' };
    if (String(f[2]) === String(t[2])) return { err: '不能把回答连到自己' };
    if ((srcE.a.then || []).some(function(x){ return String(x && x.id) === String(t[2]); })) {
      return { err: '回答 #' + t[2] + ' 已经在 #' + f[2] + ' 的连播清单里了' };
    }
    pushUndo('建立连播（回答 → 回答）');
    /* ① 摘出目标回答 */
    if (dstE.chained){
      var own = dstE.owner, k = (own.then || []).indexOf(dstE.a);
      if (k >= 0) own.then.splice(k, 1);
      if (own.then && !own.then.length) delete own.then;
    } else {
      var oArr = (optsOf(dstE.ver)[dstE.oid].ans[dstE.tier] || []);
      var j = oArr.indexOf(dstE.a);
      if (j >= 0) oArr.splice(j, 1);
    }
    /* ② 挂到源回答的 then 末尾；链上**必播** ⇒ 清掉它自己的 cond（避免误导） */
    delete dstE.a.cond;
    srcE.a.then = srcE.a.then || [];
    srcE.a.then.push(dstE.a);
    var warn = (!dstE.chained && !(optsOf(dstE.ver)[dstE.oid].ans[dstE.tier] || []).length)
      ? '（注意：选项 #' + dstE.oid + ' 的' + (dstE.tier === 'full' ? '开智' : '咕嘎') + '档现在没有回答了）' : '';
    return { ok: '已让回答 #' + f[2] + ' 播完后接上 #' + t[2] + warn };
  }
  var opt = optsOf(t[1])[t[2]];
  if (!opt) return { err: '目标选项不存在' };
  opt.cond = opt.cond || { type: 'none' };
  if (f[0] === 'ans'){
    pushUndo('建立依赖（回答 → 选项）');
    if (opt.cond.type !== 'prevAns') opt.cond = { type: 'prevAns', ids: [] };
    opt.cond.ids = opt.cond.ids || [];
    if (opt.cond.ids.indexOf(f[2]) < 0) opt.cond.ids.push(f[2]);
    return { ok: '已让「' + short(opt.text, 12) + '」依赖回答 #' + f[2] };
  }
  if (f[0] === 'opt'){
    var src = optsOf(f[1])[f[2]];
    var ids = (src.ans.dumb || []).concat(src.ans.full || []).map(function(a){ return a.id; });
    if (!ids.length) return { err: '「' + short(src.text, 12) + '」没有回答，无法建立依赖' };
    pushUndo('建立依赖（接住回答）');
    if (opt.cond.type !== 'prevAns') opt.cond = { type: 'prevAns', ids: [] };
    opt.cond.ids = opt.cond.ids || [];
    var add = 0;
    ids.forEach(function(id){ if (opt.cond.ids.indexOf(id) < 0){ opt.cond.ids.push(id); add++; } });
    return { ok: '已让「' + short(opt.text, 12) + '」接住「' + short(src.text, 12) + '」的 ' + add + ' 条回答' };
  }
  if (f[0] === 'start'){
    pushUndo('设为开场可见');
    opt.start = true;
    return { ok: '已把「' + short(opt.text, 12) + '」设为开场可见' };
  }
  return { err: '不支持的连线' };
}
function removeEdge(ed){
  var t = ed.to.split(':'), f = ed.from ? ed.from.split(':') : null;
  if (ed.kind === 'flow' && f && f[0] === 'start'){
    var o1 = optsOf(t[1])[t[2]];
    pushUndo('取消开场可见');
    o1.start = false;
    return { ok: '已取消「' + short(o1.text, 12) + '」的开场可见' };
  }
  if (ed.kind === 'flow' && t[0] === 'end'){
    return { err: '「结束」是按叶子自动生成的：要让它消失，得给这个节点接上下游，或者删掉这个节点' };
  }
  if (ed.kind === 'then' && f){
    /* 连播线：从 then 里摘出来，**放回链主回答所属选项的同档位**（不让回答凭空消失） */
    var ver3 = t[1];
    var srcE3 = optOfAns(ver3, f[2]);
    var dstE3 = optOfAns(ver3, ed.via);
    if (!srcE3 || !dstE3) return { err: '这条连播线已经不在数据里了（点一下空白处重画）' };
    var ch3 = srcE3.a.then || [];
    var i3 = -1;
    for (var n3 = 0; n3 < ch3.length; n3++) if (String(ch3[n3] && ch3[n3].id) === String(ed.via)){ i3 = n3; break; }
    if (i3 < 0) return { err: '回答 #' + ed.via + ' 已经不在 #' + f[2] + ' 的连播清单里了（点一下空白处重画）' };
    pushUndo('取消连播');
    ch3.splice(i3, 1);
    if (!ch3.length) delete srcE3.a.then;
    var back = optsOf(ver3)[srcE3.oid];
    back.ans = back.ans || { dumb: [], full: [] };
    back.ans[srcE3.tier] = back.ans[srcE3.tier] || [];
    if (back.ans[srcE3.tier].indexOf(dstE3.a) < 0) back.ans[srcE3.tier].push(dstE3.a);
    return { ok: '已取消连播：回答 #' + ed.via + ' 放回选项 #' + srcE3.oid + '（' + (srcE3.tier === 'full' ? '开智' : '咕嘎') + '档）' };
  }
  if (ed.kind === 'ans' && ed.via){
    /* ⚠️⚠️ 2026-09-19 修（用户报「删连线报错：这条依赖不在 cond.ids 里」）：
       以前这里要求 `cond.type === 'prevAns'` 才肯删 ⇒ 「类型改成 none、ids 残留」的历史数据
       一点删就报一句用户看不懂的错；而且 `via` 不在 ids 里时它**会假报成功**
       （splice 没执行也照样 toast「已移除」）。
       现在：只要 cond 里有 ids 数组就按 id 删（与①的画线口径对齐），并且**永不假报** ——
       两种情况各给一句「该干什么」的话。id 用 String 比（防数字/字符串错配）。 */
    var o2 = optsOf(t[1])[t[2]];
    if (!o2) return { err: '目标选项已经不在了（可能刚被删掉）' };
    var c2 = o2.cond || {};
    if (!Array.isArray(c2.ids)){
      var lbl = { none: '无条件（一直可见）', prevAns: '选过某些选项', noNote: '还没记下某条记事本' }[c2.type] || c2.type;
      return { err: '「' + short(o2.text, 12) + '」现在的条件是「' + lbl + '」，没有「依赖回答」这层 —— 想删线先去它的面板把条件改回「选过某些选项」' };
    }
    var i = -1;
    for (var n = 0; n < c2.ids.length; n++) if (String(c2.ids[n]) === String(ed.via)){ i = n; break; }
    if (i < 0) return { err: '回答 #' + ed.via + ' 已经不在「' + short(o2.text, 12) + '」的依赖清单里了（画布可能没刷新，点一下空白处重画）' };
    pushUndo('删掉一条依赖');
    c2.ids.splice(i, 1);
    if (!c2.ids.length) o2.cond = { type: 'none' };
    return { ok: '已移除「' + short(o2.text, 12) + '」对回答 #' + ed.via + ' 的依赖' };
  }
  if (ed.kind === 'note') return { err: '记事本引用由条件决定，去对应节点的面板里改' };
  return { err: '这条线删不了' };
}
function startLink(e, key){
  linkDrag = { from: key };
  var w = wrapOf(key); if (w) w.classList.add('linking');
  document.getElementById('edges').classList.remove('live');   // 拖拽期间别让线抢事件
  var svg = document.getElementById('ghost');
  svg.setAttribute('width', CANVAS.w); svg.setAttribute('height', CANVAS.h);
  svg.innerHTML = '<path id="ghostPath" d=""></path><circle id="ghostDot" r="4.5"></circle>';
  ghostTo(e.clientX, e.clientY);
  setHint('拖到「选项」上方松手 = 建立依赖　·　拖到「回答」上方松手 = 连播（这条播完接那条）　·　Esc 取消');
  e.preventDefault();
  e.stopPropagation();
}
function ghostTo(cx, cy){
  if (!linkDrag) return;
  var a = NODE[linkDrag.from]; if (!a) return;
  var p = toWorld(cx, cy);
  var x1 = a.x + a.w / 2, y1 = a.y + a.h;
  var off = Math.max(24, Math.min(80, Math.abs(p.y - y1) * 0.5));
  var pa = document.getElementById('ghostPath'), dot = document.getElementById('ghostDot');
  if (pa) pa.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + off) + ' ' + p.x + ',' + (p.y - off) + ' ' + p.x + ',' + p.y);
  if (dot){ dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); }
  var tgt = nodeAt(p);
  document.querySelectorAll('.wrap').forEach(function(el){
    el.classList.remove('dropok', 'dropno');
    var k = el.getAttribute('data-wrap');
    if (!tgt || k === linkDrag.from || k !== tgt) return;
    el.classList.add(canConnect(linkDrag.from, k).ok ? 'dropok' : 'dropno');
  });
}
function endLink(cx, cy){
  if (!linkDrag) return;
  var from = linkDrag.from, p = toWorld(cx, cy), tgt = nodeAt(p);
  document.getElementById('ghost').innerHTML = '';
  document.querySelectorAll('.wrap').forEach(function(el){ el.classList.remove('dropok', 'dropno', 'linking'); });
  linkDrag = null;
  setHint('');
  document.getElementById('edges').classList.add('live');
  if (!tgt || tgt === from) return;
  var r = canConnect(from, tgt);
  if (!r.ok){ if (r.why) toast(r.why); return; }
  var res = connect(from, tgt);
  if (res.err){ toast(res.err); return; }
  reRender();
  select(tgt);            // 不写死 'opt' —— 落点是回答时会自动开「回答面板」（`select` 按 key 前缀判 kind）
  toast(res.ok);
}
function cancelLink(){
  if (!linkDrag) return;
  document.getElementById('ghost').innerHTML = '';
  document.querySelectorAll('.wrap').forEach(function(el){ el.classList.remove('dropok', 'dropno', 'linking'); });
  linkDrag = null; setHint('');
  document.getElementById('edges').classList.add('live');
}
/* 线面板：点线 → 说明 + 删除 */
function showEdgeInsp(idx){
  var ed = EDGES[idx];
  if (!ed) return showEmptyInsp();
  var desc = {
    flow: '推进主线（上一个节点 → 下一个节点）',
    ans: '依赖引用（看过这条回答之后，目标选项才会出现）',
    then: '连播（这条回答播完，自动接着播目标回答）',
    note: '记事本引用',
    cross: '跨阶段引用',
    toEnd: '通向「结束」（该节点没有下游）'
  }[ed.kind] || ed.kind;
  var fromTxt = ed.from ? (ed.from.indexOf('ans:') === 0 ? ('回答 #' + ed.from.split(':')[2]) : ed.from) : '（无源）';
  var p = ed.to.split(':');
  var toTxt = p[0] === 'opt' ? ('选项 #' + p[2] + '「' + short(((optsOf(p[1]) || {})[p[2]] || {}).text || '', 14) + '」')
            : p[0] === 'ans' ? ('回答 #' + p[2])
            : p[0] === 'end' ? '结束' : ed.to;
  document.getElementById('insp').innerHTML =
    '<div class="insp-hd"><div class="t">连线</div><div class="s">' + esc(desc) + '</div></div>' +
    '<div class="mod"><div class="mod-hd">这条线</div>' +
      fldRO('从', fromTxt, true) + fldRO('到', toTxt, true) +
      (ed.via ? fldRO('经由回答', '#' + ed.via, true) : '') + '</div>' +
    '<div class="mod"><div class="mod-hd">操作</div><div class="fld"><span class="k">删除</span><span class="v">' +
      '<button class="mini del" data-deledge="' + idx + '">删掉这条引用</button></span></div></div>' +
    '<div class="tipbox">想加引用：把鼠标移到某个节点上，按住它下方的圆点拖到目标节点上方松手即可。</div>';
}

/* ============================ 选择 / 拖动 ============================ */
function select(key, kind){
  STATE.sel = key;
  STATE.selKind = kind || (key.indexOf('note:') === 0 ? 'note' : key.indexOf('ans:') === 0 ? 'ans' : key.indexOf('status:') === 0 ? 'status' : 'opt');
  STATE.ansKey = STATE.selKind === 'ans' ? key : null;
  STATE.statusVer = STATE.selKind === 'status' ? key.split(':')[1] : null;
  paintSel();
  if (STATE.selKind === 'note') showNoteInsp(key);
  else if (STATE.selKind === 'status') showStatusInsp(STATE.statusVer);
  else if (STATE.selKind === 'ans') showAnsInsp(key);
  else showOptInsp(key);
}
function paintSel(){
  document.querySelectorAll('.opt.sel,.ans.sel,.note-node.sel,.statusbar.sel').forEach(function(el){ el.classList.remove('sel'); });
  var el = document.querySelector('[data-opt="' + STATE.sel + '"],[data-ansnode="' + STATE.sel + '"],[data-note="' + STATE.sel + '"]');
  if (el) el.classList.add('sel');
  document.querySelectorAll('.statusbar').forEach(function(b){
    b.classList.toggle('sel', STATE.selKind === 'status' && b.getAttribute('data-status') === STATE.statusVer);
  });
  if (!STATE.far) drawEdges();
  updateDim();
}

var vp = null, drag = null;
function wrapOf(key){ return document.querySelector('[data-wrap="' + String(key).replace(/"/g, '') + '"]'); }
/* 拖节点两条路，共用同一条管道，区别只在 drag.fam：
     · 拖卡片本体            → fam = [key]            只动它自己（2026-09-19 用户要求：取消"整棵子树一起动"，
                                                        他有时要单独调父节点的位置）
     · 按住卡片上的四向箭头拖 → fam = descendantsOf(key) 连下方所有子节点一起动
                                                        （2026-09-19 晚用户补的要求）
   「整段平移」另有入口：拖阶段标题（startZoneDrag）。
   ⚠️ 拖动时 `dragging` 加在 **[data-wrap]** 上（不是 .opt）⇒ 样式在 .wrap.dragging 那边。 */
function descendantsOf(key){
  /* 沿 EDGES 找**所有下游**（选项 → 回答 → 选项 → …，一直走到叶子）。
     ⚠️ EDGES 的方向是「上游 → 下游」（e.to 是当前节点，见 upsSummary 的用法）。
     ⚠️ 目标不在画布上（NODE 里没有，比如被隐藏的「结束」节点）就跳过 —— 别把不存在的键写进 POS。
     ⚠️ 数据允许出现环（画布会标「互相依赖」）⇒ 用 seen 防死循环。 */
  var out = [], seen = {}, q = [key];
  seen[key] = 1;
  while (q.length){
    var k = q.shift();
    EDGES.forEach(function(e){
      if (e.from !== k || e.kind === 'broken') return;
      if (seen[e.to] || !NODE[e.to]) return;
      seen[e.to] = 1; out.push(e.to); q.push(e.to);
    });
  }
  return out;
}
function startNodeDrag(e, key, withFam){
  var n = NODE[key]; if (!n) return;
  var keys = withFam ? [key].concat(descendantsOf(key)) : [key];
  /* 统一按「起点 + 位移」写，避免累积误差 */
  var base = {};
  keys.forEach(function(k){
    var nn = NODE[k]; if (!nn) return;
    base[k] = { x: nn.x, y: nn.y };
    var w = wrapOf(k); if (w) w.classList.add('dragging');
  });
  drag = { mode: 'node', key: key, sx: e.clientX, sy: e.clientY, base: base, fam: keys };
  e.preventDefault();
}
function startZoneDrag(e, ver){
  var z = ZONES.filter(function(x){ return x.ver === ver; })[0]; if (!z) return;
  Object.keys(NODE).forEach(function(k){
    if (k.indexOf('opt:' + ver + ':') === 0 || k.indexOf('ans:' + ver + ':') === 0 ||
        k === startKey(ver) || k.indexOf('end:' + ver + ':') === 0){
      if (!POS[k]) POS[k] = { x: NODE[k].x, y: NODE[k].y };
    }
  });
  if (!POS['zone:' + ver]) POS['zone:' + ver] = { x: z.zoneX, y: z.zoneY };
  drag = { mode: 'zone', ver: ver, sx: e.clientX, sy: e.clientY, base: JSON.parse(JSON.stringify(POS)) };
  e.preventDefault();
}
function moveDrag(e){
  if (!drag) return;
  var dx = (e.clientX - drag.sx) / CANVAS.k, dy = (e.clientY - drag.sy) / CANVAS.k;
  if (drag.mode === 'pan'){
    CANVAS.x = drag.ox + (e.clientX - drag.sx); CANVAS.y = drag.oy + (e.clientY - drag.sy); applyTransform(); return;
  }
  if (drag.mode === 'node'){
    /* 按 fam 批量写：拖卡片本体时 fam 只有它自己；按住四向箭头拖时 fam 是整棵子树 */
    drag.fam.forEach(function(k){
      var b = drag.base[k];
      if (b) POS[k] = { x: b.x + dx, y: b.y + dy };
    });
    layout(); placeAll(); drawEdges(); renderZones(); return;
  }
  if (drag.mode === 'zone'){
    Object.keys(drag.base).forEach(function(k){
      if (k === 'zone:__notes' || (k.indexOf('zone:') === 0 && k !== 'zone:' + drag.ver)) return;
      if (k.indexOf('zone:') === 0 || k.indexOf('opt:' + drag.ver + ':') === 0 ||
          k.indexOf('ans:' + drag.ver + ':') === 0 || k === startKey(drag.ver) || k.indexOf('end:' + drag.ver + ':') === 0){
        POS[k] = { x: drag.base[k].x + dx, y: drag.base[k].y + dy };
      }
    });
    layout(); placeAll(); drawEdges(); renderZones(); return;
  }
}
function placeAll(){
  document.querySelectorAll('[data-wrap]').forEach(function(el){
    var k = el.getAttribute('data-wrap'), n = NODE[k];
    if (n){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  });
}
function endDrag(){
  if (!drag) return;
  /* fam 里每一个都要摘（带子节点拖动时整棵子树都挂了 dragging） */
  (drag.fam || [drag.key]).forEach(function(k){ var w = wrapOf(k); if (w) w.classList.remove('dragging'); });
  var m = drag.mode; drag = null;
  if (m === 'node' || m === 'zone') DIRTY = true;
}
/* 事件统一在这里绑定（demo 启动时调；编辑器里等 DOM 就绪后由 ChatTreeView.mount 调） */
function bindEvents(){
  vp = document.getElementById('viewport');

vp.addEventListener('mousedown', function(e){
  if (pendingAdd) return;              // 放置中：这一下是"移动光标"，不要顺手开始平移/拖拽
  var ha = e.target.closest('[data-handle]');
  if (ha){ startLink(e, ha.getAttribute('data-handle')); return; }     // 拖出引用（用户要的）
  var ds = e.target.closest('[data-dragsub]');
  if (ds){ startNodeDrag(e, ds.getAttribute('data-dragsub'), true); return; }   // 四向箭头：连子节点一起拖
  var a = e.target.closest('[data-addans],[data-delansnode],[data-addans2],[data-delopt],[data-delans],[data-delnote],[data-gotoans]');
  if (a) return;
  var hd = e.target.closest('.opt-hd, .ans');
  if (hd){
    var host = hd.closest('[data-opt],[data-ansnode]');
    if (host){
      var key = host.getAttribute('data-opt') || host.getAttribute('data-ansnode');
      startNodeDrag(e, key); return;
    }
  }
  var zh = e.target.closest('[data-dragzone]');
  if (zh){ startZoneDrag(e, zh.getAttribute('data-dragzone')); return; }
  /* 「开始」节点：2026-09-19 用户要求它也能拖（原来 `.term` 直接 return ⇒ 完全拖不动）。
     放在下面那条早退之前。
     ⚠️ 现在所有节点都是「只拖自己」（E3 已取消子树跟随）⇒ 这里不再需要 solo 实参；
        「结束」节点自 SHOW_END=false 起已不渲染，这段对它不再生效。 */
  var tm = e.target.closest('.term');
  if (tm){
    var tw = tm.closest('[data-wrap]');
    if (tw){ startNodeDrag(e, tw.getAttribute('data-wrap')); return; }
  }
  if (e.target.closest('.note-node,.icob,.mini,.statusbar,.term')) return;
  drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: CANVAS.x, oy: CANVAS.y };
  vp.classList.add('dragging');
});
window.addEventListener('mousemove', function(e){
  if (pendingAdd){ ghostFollow(e.clientX, e.clientY); return; }        // 虚影吸附跟随鼠标
  if (linkDrag){ ghostTo(e.clientX, e.clientY); return; }              // 拖引用中
  moveDrag(e);
});
window.addEventListener('mouseup', function(e){
  if (linkDrag){ endLink(e.clientX, e.clientY); return; }              // 落点判定 → 建边
  endDrag(); vp.classList.remove('dragging');
});
/* 「校验」结果面板：点一下关掉（面板内容由编辑器侧 ChatTreeTool.validate 填充） */
(function(){
  var rep = document.getElementById('chattree-result');
  if (rep) { rep.title = '点一下关掉'; rep.addEventListener('click', function(){ rep.hidden = true; }); }
})();
vp.addEventListener('wheel', function(e){
  e.preventDefault();
  var r = vp.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });

/* ============================ 事件委托 ============================ */
document.addEventListener('click', function(e){
  var t = e.target, b;
  /* ⚠️ 吸附放置中：这一次点击 = **放下**。必须放在最前面拦截 ——
     否则会被后面的分支（点空白 = 取消选中 等）先吃掉，玩家会觉得"点了没反应"。 */
  if (pendingAdd){
    var mn = addMenuEl();
    if (mn && mn.contains(t)) return;                        // 点菜单自己不算
    if (t.closest && t.closest('#btnAddNode')) return;       // 点按钮 = 取消（按钮自己的 handler 管）
    /* ＋回答按钮同理：放置中再点一次 = 取消（否则会被当成「在这里放下」） */
    if (t.closest && t.closest('[data-addans],[data-addans2]')){ cancelAdd(); return; }
    placePendingAdd(e.clientX, e.clientY);
    return;
  }
  /* 链接回答：「试打开」—— 即时验证网址能不能开（配 URL 类型的回答时用）。
     ⚠️ 这是**老表单 UI 就有的能力**，2026-09-19 老 UI 整体删除时在新界面重建；
     `h5_demo/test_editor_cfg.js` 有断言守「试打开」必须在（它守的是"承诺过就不能悄悄删"）。 */
  var lo = t.closest && t.closest('[data-lnkopen]');
  if (lo){
    var li = document.querySelector('[data-inp="' + lo.getAttribute('data-lnkopen') + '"]');
    var u = li ? String(li.value || '').trim() : '';
    if (!/^https?:\/\//i.test(u)){ toast('先填一个 http(s):// 开头的网址'); return; }
    try { window.open(u, '_blank', 'noopener'); }
    catch (err) { toast('打不开：' + err.message); }
    return;
  }
  /* src 的「选择文件」按钮（2026-09-21 用户要求：不要手填路径，按钮选具体文件）。
     图片走 image 模式、语音走 audio 模式（按按钮上的 data-restype）；
     选完把路径写回输入框 + 走同一个 INPUT_HANDLERS（与手输落盘同一条路）。 */
  var rp = t.closest && t.closest('[data-respick]');
  if (rp){
    if (!window.ResPicker){ toast('资源选择器没加载（刷新一下编辑器页面）'); return; }
    var rsid = rp.getAttribute('data-respick');
    var rkind = rp.getAttribute('data-restype') === 'audio' ? 'audio' : 'image';
    var rinp = document.querySelector('[data-inp="' + rsid + '"]');
    window.ResPicker.pick(rinp ? String(rinp.value || '').trim() : '', {
      title: rkind === 'audio' ? '选择语音 / 音频' : '选择图片',
      kind: rkind,
    }).then(function(p){
      if (!p) return;
      if (rinp) rinp.value = p;
      var fn = INPUT_HANDLERS[rsid];
      if (fn) fn(p);
      toast('已选 ' + p);
    });
    return;
  }
  /* 点线 = 选中这条引用（面板里可删） */
  var lp = t.closest && t.closest('#edges path');
  if (lp){ showEdgeInsp(Number(lp.getAttribute('data-ei'))); return; }
  if ((b = t.closest('[data-deledge]'))){
    var ed2 = EDGES[Number(b.getAttribute('data-deledge'))];
    if (!ed2) return;
    var rr = removeEdge(ed2);
    if (rr.err){ toast(rr.err); return; }
    reRender(); showEmptyInsp(); toast(rr.ok);
    return;
  }
  /* ＋回答：与「＋ 节点」同一条吸附管道（先虚影跟随、再点一次落位）—— 见 beginPlaceAns */
  if ((b = t.closest('[data-addans]'))){ var p = b.getAttribute('data-addans').split(':'); beginPlaceAns(p[0], p[1], 'full'); return; }
  if ((b = t.closest('[data-addans2]'))){ var p2 = b.getAttribute('data-addans2').split(':'); beginPlaceAns(p2[0], p2[1], p2[2]); return; }
  if ((b = t.closest('[data-delopt]'))){ var p3 = b.getAttribute('data-delopt').split(':'); delOpt(p3[0], p3[1]); return; }
  if ((b = t.closest('[data-delansnode]'))){ var p4 = b.getAttribute('data-delansnode').split(':'); delAnsByNode(p4[0], p4[1]); return; }
  if ((b = t.closest('[data-delans]'))){ var p5 = b.getAttribute('data-delans').split(':'); delAns(p5[0], p5[1], p5[2], p5[3]); return; }
  if ((b = t.closest('[data-delnote]'))){ delNote(b.getAttribute('data-delnote')); return; }
  if ((b = t.closest('[data-addopt]'))){ addOpt(b.getAttribute('data-addopt')); return; }
  if ((b = t.closest('[data-addnote]'))){ addNote(); return; }
  if ((b = t.closest('[data-addstatus]'))){ var q = b.getAttribute('data-addstatus').split(':'); addStatusLine(q[0], q[1]); return; }
  if ((b = t.closest('[data-delstatus]'))){ var q2 = b.getAttribute('data-delstatus').split(':'); delStatusLine(q2[0], q2[1], q2[2]); return; }
  if ((b = t.closest('[data-gotoans]'))){ select(b.getAttribute('data-gotoans'), 'ans'); return; }
  if ((b = t.closest('[data-backopt]'))){ select(b.getAttribute('data-backopt'), 'opt'); return; }
  if ((b = t.closest('[data-delstep]'))){
    var q3 = b.getAttribute('data-delstep').split(':'), a1 = ansByQ(q3);
    pushUndo('删一条思考步骤');
    a1.steps.splice(Number(q3[4]), 1);
    reRender(); select(ansNodeKey(q3[0], q3[1]), 'ans'); return;
  }
  if ((b = t.closest('[data-addstep]'))){
    var q4 = b.getAttribute('data-addstep').split(':'), a2 = ansByQ(q4);
    pushUndo('加一条思考步骤');
    a2.steps = a2.steps || []; a2.steps.push('');
    reRender(); select(ansNodeKey(q4[0], q4[1]), 'ans'); return;
  }
  if ((b = t.closest('[data-addtstep]'))){
    var q5 = b.getAttribute('data-addtstep').split(':'), a3 = ansByQ(q5);
    pushUndo('加一条哼唱行');
    a3.think = a3.think || { title: '', steps: [] }; a3.think.steps.push('');
    reRender(); select(ansNodeKey(q5[0], q5[1]), 'ans'); return;
  }
  var sb = t.closest('.statusbar');
  if (sb){ select('status:' + sb.getAttribute('data-status'), 'status'); return; }
  var st = t.closest('[data-start]');
  if (st){ toast('这是「开始」节点 —— 它下面的第一排就是开场可见的选项'); return; }
  var en = t.closest('[data-end]');
  if (en){ toast('这是分支末端的「结束」节点 —— 说明这条分支到此为止（该选项没有回答，或回答没有下游）'); return; }
  var na = t.closest('[data-note]');
  if (na){ select(na.getAttribute('data-note'), 'note'); return; }
  var an = t.closest('[data-ansnode]');
  if (an){ select(an.getAttribute('data-ansnode'), 'ans'); return; }
  var op = t.closest('[data-opt]');
  if (op){ select(op.getAttribute('data-opt'), 'opt'); return; }
  if (t.closest('#viewport')){ STATE.sel = null; STATE.selKind = null; STATE.ansKey = null; STATE.statusVer = null; paintSel(); showEmptyInsp(); }
});
function ansByQ(q){
  var o = optsOf(q[0])[q[1]];
  return (o.ans[q[2]] || [])[Number(q[3])];
}
document.addEventListener('input', function(e){
  var t = e.target;
  var _defer = !!(t.getAttribute && t.getAttribute('data-inpdefer'));
  /* 撤回：输入框改内容 —— 按字段 + 1.5s 合并（否则每敲一个字压一栈）。
     ⚠️ 「延迟提交」字段在 input 阶段**什么都没改** ⇒ 不压栈、也不提交（见 fldInp 的 defer）。 */
  if (!_defer){
    var _ak = t.getAttribute && (t.getAttribute('data-inp') || t.getAttribute('data-statusline')
      || t.getAttribute('data-step') || t.getAttribute('data-tstep'));
    if (_ak) pushUndo('改内容', 'inp:' + _ak);
  }
  var id = t.getAttribute && t.getAttribute('data-inp');
  if (id && INPUT_HANDLERS[id] && !_defer){ INPUT_HANDLERS[id](t.type === 'checkbox' ? t.checked : t.value); return; }
  var sv = t.getAttribute && t.getAttribute('data-statusline');
  if (sv){
    var q = sv.split(':'), s = stageOf(q[0]);
    s.status[q[1]][Number(q[2])] = t.value;
    DIRTY = true; refreshStatusBar(q[0]); return;
  }
  var st = t.getAttribute && t.getAttribute('data-step');
  if (st){ var q2 = st.split(':'); ansByQ(q2).steps[Number(q2[4])] = t.value; DIRTY = true; return; }
  var ts = t.getAttribute && t.getAttribute('data-tstep');
  if (ts){ var q3 = ts.split(':'); ansByQ(q3).think.steps[Number(q3[4])] = t.value; DIRTY = true; return; }
});
document.addEventListener('change', function(e){
  var t = e.target, id = t.getAttribute && t.getAttribute('data-inp');
  if (id && INPUT_HANDLERS[id]) pushUndo('改内容', 'inp:' + id);   // 与 input 同一把合并钥匙
  /* ⚠️ 还要接管「延迟提交」字段（data-inpdefer）：它们只在 change（失焦 / 回车）时才写数据 */
  var _df = !!(t.getAttribute && t.getAttribute('data-inpdefer'));
  if (id && INPUT_HANDLERS[id] && (t.tagName === 'SELECT' || t.type === 'checkbox' || _df)){ INPUT_HANDLERS[id](t.type === 'checkbox' ? t.checked : t.value); }
});
function refreshStatusBar(ver){
  var el = document.querySelector('.statusbar[data-status="' + ver + '"]');
  var st = (stageOf(ver) || {}).status || {};
  if (!el) return;
  var chips = el.querySelectorAll('.st');
  if (chips[0]) chips[0].innerHTML = '<b>咕嘎</b>' + esc(short((st.dumb || [])[0] || '（未配置）', 20));
  if (chips[1]) chips[1].innerHTML = '<b>开智</b>' + esc(short((st.full || [])[0] || '（未配置）', 20));
}

/* ============================ 顶栏 ============================ */
function vpr(){ return vp.getBoundingClientRect(); }
document.getElementById('btnZIn').onclick  = function(){ var r = vpr(); zoomAt(r.width / 2, r.height / 2, 1.2); };
document.getElementById('btnZOut').onclick = function(){ var r = vpr(); zoomAt(r.width / 2, r.height / 2, 1 / 1.2); };
document.getElementById('btnFit').onclick  = fitAll;
document.getElementById('navStage').onchange = function(){ goStage(this.value); };
document.getElementById('btnReset').onclick = function(){
  pushUndo('复位布局');
  if (!confirm('把拖过的位置全部复位（回到自动布局）？')) return;
  POS = {}; reRender(); toast('布局已复位');
};
/* ⚠️ 必须带空值守卫：编辑器那份的标记是**另写**的，万一没有这个按钮，
   裸写 `getElementById(...).onclick` 会 TypeError ⇒ bindEvents 抛 ⇒ **整个测试界面页挂掉**
   （2026-09-19 差点就这么上线；与同文件 btnExport 的 `var __be = ...` 同一写法）。 */
var __bu = document.getElementById('btnUndo'); if (__bu) __bu.onclick = function(){ undo(); };
document.getElementById('btnAns').onclick = function(){
  STATE.showAns = !STATE.showAns;
  this.classList.toggle('on', STATE.showAns);
  reRender(); toast(STATE.showAns ? '已显示回答节点' : '已隐藏回答节点（只看选项主干）');
};
document.getElementById('btnFar').onclick = function(){
  STATE.far = !STATE.far;
  this.classList.toggle('on', STATE.far);
  drawEdges(); updateDim();
};
/* 「＋ 节点」：开/关那个二选一菜单（再点一次 = 取消） */
document.getElementById('btnAddNode').onclick = function(){
  var m = addMenuEl();
  if (pendingAdd || (m && !m.hidden)){ cancelAdd(); return; }
  if (m){ m.hidden = false; toast('要加「选项」还是「回答」？选完它会吸附在鼠标上，再点一次放下'); }
};
document.getElementById('addMenu').addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('[data-addkind]');
  if (!b) return;
  pendingAdd = { kind: b.getAttribute('data-addkind') };
  var m = addMenuEl(); if (m) m.hidden = true;
  var g = addGhostEl(); if (g){ g.hidden = false; g.textContent = pendingAdd.kind === 'opt' ? '新选项落在这里' : '新回答落在这里'; }
  toast(pendingAdd.kind === 'opt' ? '移到想放的位置，再点一次就放下选项' : '移到想挂的选项附近，再点一次就放下回答');
});
var __be = document.getElementById('btnExport'); if (__be) __be.onclick = function(){
  var T = { NOTES: GRAPH.notes, BY_VER: {} };
  GRAPH.stages.forEach(function(s){
    var opts = {};
    Object.keys(s.opts).forEach(function(oid){
      var o = s.opts[oid], c = o.cond || { type: 'none' };
      var e = { text: o.text };
      if (o.start) e.start = true;
      e.next = o.next || 'continue';
      e.ans = { dumb: o.ans.dumb || [], full: o.ans.full || [] };
      e.cond = c.type === 'none' ? { type: 'none' } : c;
      opts[oid] = e;
    });
    T.BY_VER[s.ver] = { status: s.status || {}, opts: opts };
  });
  var txt = JSON.stringify({ CHAT_TREE2: T }, null, 2);
  var blob = new Blob([txt], { type: 'application/json;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'CHAT_TREE2_编辑结果.json';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 3000);
  toast('已导出 CHAT_TREE2_编辑结果.json');
};
document.getElementById('q').addEventListener('input', function(){
  var q = this.value.trim().toLowerCase();
  if (!q) return;
  var hit = null;
  GRAPH.stages.forEach(function(s){
    if (hit) return;
    Object.keys(s.opts).forEach(function(oid){
      if (hit) return;
      var o = s.opts[oid], bag = (oid + ' ' + (o.text || '')).toLowerCase();
      (o.ans.full || []).concat(o.ans.dumb || []).forEach(function(a){ bag += ' ' + a.id + ' ' + (a.text || '') + ' ' + (a.post || '') + ' ' + ((a.steps || []).join(' ')); });
      if (bag.indexOf(q) >= 0) hit = optKey(s.ver, oid);
      else {
        (o.ans.full || []).concat(o.ans.dumb || []).forEach(function(a){ if (String(a.id).indexOf(q) >= 0) hit = ansNodeKey(s.ver, a.id); });
      }
    });
  });
  Object.keys(GRAPH.notes).forEach(function(nid){
    if (hit) return;
    var n = GRAPH.notes[nid];
    if ((nid + ' ' + (n.name || '') + ' ' + (n.text || '')).toLowerCase().indexOf(q) >= 0) hit = noteKey(nid);
  });
  if (!hit) return;
  select(hit, hit.indexOf('note:') === 0 ? 'note' : hit.indexOf('ans:') === 0 ? 'ans' : 'opt');
  var n = NODE[hit]; if (!n) return;
  var r = vpr();
  CANVAS.k = Math.max(CANVAS.k, 0.7);
  CANVAS.x = r.width / 2 - (n.x + n.w / 2) * CANVAS.k;
  CANVAS.y = r.height / 2 - (n.y + n.h / 2) * CANVAS.k;
  applyTransform();
});
window.addEventListener('keydown', function(e){
  /* Ctrl/Cmd + Z = 撤回（用户 2026-09-19 要求）。
     ⚠️ 焦点在输入框里时**不抢** —— 让浏览器走它自己的文字撤销（那是更细粒度的、用户也熟悉）。 */
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')){
    var ae = document.activeElement, at = ae && ae.tagName;
    if (at === 'INPUT' || at === 'TEXTAREA') return;
    e.preventDefault(); undo(); return;
  }
  if (e.key === 'Escape'){
    if (pendingAdd){ cancelAdd(); return; }                             // 先取消吸附放置
    if (linkDrag){ cancelLink(); return; }                              // 再取消拖引用
    if (document.activeElement && document.activeElement.tagName === 'BODY'){
      STATE.sel = null; STATE.selKind = null; STATE.ansKey = null; STATE.statusVer = null; paintSel(); showEmptyInsp();
    }
  }
  if (e.key === '/' && document.activeElement && document.activeElement.tagName === 'BODY'){ e.preventDefault(); document.getElementById('q').focus(); }
});
}

/* ============================ 启动 / 对外接口 ============================ */
/* 数据从 ChatTreeTool.data（{ NOTES, BY_VER }）转成画图用的扁平结构 —— 与 tools/export_chat_graph.js 同一套口径。 */
function graphFromData(data){
  /* ⚠️ 阶段顺序：优先用 ChatTreeTool 自己的 VER_ORDER，没有就按标准顺序（shell 里没有 VER_ORDER 这个变量） */
  var ORDER = (TOOL && TOOL.VER_ORDER) || ["V1", "V1.5", "V2", "V2.5", "V3", "V3.5", "V4", "V4.5"];
  var stages = [], nOpt = 0, nAns = 0;
  ORDER.forEach(function(ver){
    var st = ((data.BY_VER || {})[ver]) || null;
    if (!st) return;
    var opts = st.opts || {};
    nOpt += Object.keys(opts).length;
    var clean = {};
    Object.keys(opts).forEach(function(oid){
      var o = opts[oid];
      var ans = { dumb: (o.ans && o.ans.dumb) || [], full: (o.ans && o.ans.full) || [] };
      nAns += ans.dumb.length + ans.full.length;
      clean[oid] = { text: o.text, start: !!o.start, next: o.next, cond: o.cond || { type: 'none' }, ans: ans };
    });
    stages.push({ ver: ver, status: st.status || {}, opts: clean });
  });
  var notes = data.NOTES || {};
  return { stages: stages, notes: notes,
           counts: { stages: stages.length, opts: nOpt, ans: nAns, edges: 0, notes: Object.keys(notes).length } };
}

window.ChatTreeView = {
  mounted: false,
  tool: null,
  /* 进入「测试界面」页时调用：喂数据 + 首次渲染 */
  mount(tool){
    this.tool = tool;
    GRAPH = graphFromData(tool.data || {});
    ANS_OWNER = {};
    DIRTY = false;
    /* 自定义位置从数据里恢复（用户 2026-09-20 拍板方案 A：「节点位置要能存下来」）。
       ⚠️ 原来这里就是「POS = {}」 —— 每次进页面都清空 ⇒ 拖完一刷新就回到自动布局。
       只认 {x:number, y:number} 的项，脏数据直接忽略。 */
    POS = {};
    var savedPos = (tool.data || {}).POS;
    if (savedPos && typeof savedPos === 'object'){
      Object.keys(savedPos).forEach(function(k){
        var p = savedPos[k];
        if (p && typeof p.x === 'number' && typeof p.y === 'number') POS[k] = { x: p.x, y: p.y };
      });
    }
    if (!this.mounted){
      this.mounted = true;
      var sel = document.getElementById('navStage');
      sel.innerHTML = '<option value="">全览</option>' +
        GRAPH.stages.map(function(s){ return '<option value="' + esc(s.ver) + '">' + esc(s.ver) + '（' + Object.keys(s.opts).length + '）</option>'; }).join('');
      vp = document.getElementById('viewport');
      bindEvents();
    }
    render();
    showEmptyInsp();
    if (GRAPH.stages.length) goStage(GRAPH.stages[0].ver);
  },
  /* 外部把改动写回 ChatTreeTool.data：把扁平结构反向写回 { BY_VER, NOTES } */
  syncBack(){
    if (!TOOL && this.tool) TOOL = this.tool;
    var t = this.tool; if (!t) return;
    t.data = t.data || { NOTES: {}, BY_VER: {} };
    Object.keys(GRAPH.notes).forEach(function(k){ t.data.NOTES[k] = GRAPH.notes[k]; });
    Object.keys(t.data.NOTES).forEach(function(k){ if (!GRAPH.notes[k]) delete t.data.NOTES[k]; });
    GRAPH.stages.forEach(function(s){
      var st = t.data.BY_VER[s.ver] = t.data.BY_VER[s.ver] || { status: {}, opts: {} };
      st.status = s.status;
      var kept = {};
      Object.keys(s.opts).forEach(function(oid){
        var o = s.opts[oid], c = o.cond || { type: 'none' };
        kept[oid] = { text: o.text, next: o.next || 'continue', ans: { dumb: o.ans.dumb || [], full: o.ans.full || [] },
                      cond: c.type === 'none' ? { type: 'none' } : c };
        if (o.start) kept[oid].start = true;
      });
      st.opts = kept;                       // 整区替换语义 ⇒ 删掉的选项真的消失
    });
    /* 节点 / 阶段框的自定义位置（用户 2026-09-20 方案 A）。
       ⚠️ 只存**手动拖过**的（自动布局的绝不存）—— 存了的话内容一变就跟新布局打架。
       ⚠️ 顺手清理已不存在的 key（节点删了 POS 会留残渣）；全空就删字段，别在真源里留一个空的 POS 字段。 */
    var posOut = {}, nPos = 0;
    Object.keys(POS).forEach(function(k){
      if (!NODE[k]) return;
      posOut[k] = { x: Math.round(POS[k].x), y: Math.round(POS[k].y) };
      nPos++;
    });
    if (nPos) t.data.POS = posOut; else delete t.data.POS;
    t.ver = (GRAPH.stages[0] || {}).ver || t.ver;
  },
  refresh(){ if (this.tool) this.mount(this.tool); }
};
