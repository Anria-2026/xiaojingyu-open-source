/* Travel graph: same toolbar, canvas, cards and inspector as test chat.
   CITY_JOURNEY is linear; arrows follow its actual runtime order. */
(function () {
  'use strict';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stages = ['V5', 'V5.5', 'V6', 'V6.5'];
  const types = { text: '文本', image: '图片', voice: '语音对白' };
  const field = (name, html) => '<div class="fld"><span class="k">' + name + '</span><span class="v">' + html + '</span></div>';
  const txt = (path, value, multi) => '<' + (multi ? 'textarea rows="3" class="ta"' : 'input class="inp"') + ' data-journey-path="' + esc(path) + '"' + (multi ? '>' + esc(value) + '</textarea>' : ' value="' + esc(value) + '">');
  const num = (path, value, optional, min, max) => '<input class="inp" type="number" step="' + (/^REPLY_SECONDS$|\|(?:replySeconds|seconds)$/.test(path) ? '1' : 'any') + '" min="' + min + '" max="' + max + '" data-journey-path="' + esc(path) + '" data-journey-number="1"' + (optional ? ' data-journey-optional="1"' : '') + ' value="' + (value == null ? '' : esc(value)) + '">';
  const pick = (path, value, kind) => '<div class="row">' + txt(path, value) + '<button type="button" class="mini" data-journey-action="pick" data-journey-path="' + esc(path) + '" data-journey-kind="' + kind + '">选择' + (kind === 'audio' ? '音频' : '图片') + '</button></div>';
  const mod = (title, fields) => '<div class="mod"><div class="mod-hd">' + title + '</div>' + fields + '</div>';
  const effectiveField = (path, html) => '<div class="jt-effective-field" data-journey-effective="' + esc(path) + '">' + html + '<small class="jt-field-note"></small></div>';
  const view = {
    tool: null, root: null, nodes: [], zones: [], edges: [], selection: '', stage: 'opening', query: '', showAnswers: true,
    camera: { x: 0, y: 0, k: 1 }, drag: null, heights: {},
    el(id) { return this.root && this.root.querySelector('#journey-' + id); },
    mount(tool) {
      this.tool = tool;
      this.root = document.getElementById('journey-config');
      if (!this.root) return;
      const first = !this.el('viewport');
      if (first) {
        this.root.innerHTML = '<div class="ct-wrap"><div class="ct-bar"><h1>对话树 · 旅行鲸鱼</h1><span class="sub" id="journey-hdSub"></span><div class="ct-tools">'
          + '<select class="tsel" id="journey-navStage" aria-label="跳转开场或阶段"></select><button class="tbtn" data-journey-view="fit">全览</button><button class="tbtn" data-journey-view="reset">复位布局</button>'
          + '<button class="tbtn" id="journey-undo" data-journey-action="undo">↶ 撤回</button><button class="tbtn" id="journey-redo" data-journey-action="redo">↷ 重做</button>'
          + '<button class="tbtn prim" data-journey-view="add">＋ 节点</button><button class="tbtn on" id="journey-answers" data-journey-view="answers">回答节点</button>'
          + '<button class="tbtn" data-journey-view="zoom-out">−</button><input class="zoomi" id="journey-zoomVal" value="100%" readonly aria-label="画布缩放"><button class="tbtn" data-journey-view="zoom-in">＋</button>'
          + '<input class="search" id="journey-q" placeholder="搜 id / 文本…" aria-label="搜索旅途节点"><button class="tbtn" data-journey-view="global">全局</button><button class="tbtn" data-journey-view="validate">校验</button></div></div>'
          + '<div class="ct-body"><div id="journey-viewport"><div id="journey-canvas"><div id="journey-zones"></div><svg id="journey-edges"></svg><div id="journey-nodes"></div></div></div><aside id="journey-insp"></aside></div>'
          + '<div class="legend"><span><i class="lg-flow"></i>报备 → 玩家回复 → 小鲸鱼回复 → 下一轮</span><span><i class="lg-cross"></i>下一站 · 阶段解锁</span><span>拖卡片移动 · 拖阶段标题整段移动 · 滚轮缩放</span></div>'
          + '<div class="addmenu" id="journey-addMenu" hidden><button data-journey-view="place-stop">＋ 站点</button><button data-journey-view="place-arrival">＋ 报备消息</button><button data-journey-view="place-step">＋ 一轮对话</button></div><div class="addghost" id="journey-addGhost" hidden></div><div id="journey-errors" class="ct-report" hidden></div></div>';
        this.bind();
      }
      this.build();
      if (!this.nodes.some(n => n.key === this.selection && n.scope === tool.selected)) this.selection = this.nodes.find(n => n.scope === tool.selected && n.kind === 'start')?.key || '';
      this.paint(); this.inspect();
      if (first) this.goStage(this.stage);
    },
    build() {
      const T = this.tool, pos = T.data.POS || {}, nodes = [], zones = [], edges = [];
      const scopes = [{ node: T.opening(), id: 'opening', path: 'OPENING', ver: 'opening' }].concat(T.stops().map((node, i) => ({ node, i })).filter(s => s.node && typeof s.node === 'object').map(({ node, i }) => ({ node, id: node.id, path: 'STOPS|' + i, ver: stages.includes(node.minVer) ? node.minVer : 'V5' })));
      let zx = 32;
      ['opening'].concat(stages).forEach(ver => {
        const here = scopes.filter(s => s.ver === ver);
        if (!here.length) return;
        const zonePos = pos['zone:' + ver], x = zonePos?.x ?? zx, y = zonePos?.y ?? 40;
        let zy = y + 85, keys = [];
        here.forEach(scope => {
          let chain = null;
          const push = (kind, index, value, title) => {
            const key = JSON.stringify([scope.id, kind, index]);
            const p = pos[key], n = { key, kind, index, value, title, scope: scope.id, path: scope.path, ver, x: p?.x ?? x + 66, y: p?.y ?? zy, w: 256, h: this.heights[key] || (kind === 'start' || kind === 'end' ? 42 : 98) };
            nodes.push(n); keys.push(key);
            if (chain) edges.push({ from: chain, to: key, cross: false });
            chain = key; zy += n.h + 36;
            return n;
          };
          const start = push('start', -1, scope.node, scope.id === 'opening' ? '面对面开场' : scope.node.label || scope.id);
          if (scope.id !== 'opening') (scope.node.arrivals || []).forEach((m, i) => push('arrival', i, m, '到达报备 ' + (i + 1)));
          (scope.node.steps || []).forEach((s, i) => { push('player', i, s, '玩家回复 ' + (i + 1)); push('reply', i, s, '小鲸鱼回复 ' + (i + 1)); });
          push('end', -1, scope.node, '前往下一站');
          zy += 35;
        });
        zones.push({ ver, x, y, w: 388, h: zy - y, keys, count: here.length });
        zx += 440;
      });
      // Stage grouping is only spatial layout. Runtime travels in STOPS array
      // order, including user-authored routes whose minVer goes backwards.
      scopes.forEach((scope, i) => {
        const end = nodes.find(n => n.scope === scope.id && n.kind === 'end');
        const next = scopes[i + 1], start = next && nodes.find(n => n.scope === next.id && n.kind === 'start');
        if (end && start) edges.push({ from: end.key, to: start.key, cross: true });
        else if (end) end.title = '旅途结束';
      });
      this.nodes = nodes; this.zones = zones; this.edges = edges;
    },
    paint(measured) {
      const T = this.tool, nav = this.el('navStage'), old = this.stage;
      nav.innerHTML = '<option value="">全览</option>' + this.zones.map(z => '<option value="' + esc(z.ver) + '">' + (z.ver === 'opening' ? '面对面开场' : z.ver) + '（' + z.count + '）</option>').join('');
      nav.value = old;
      this.el('hdSub').textContent = T.stops().length + ' 站 · 单线路线';
      this.el('undo').disabled = !T.undoStack.length; this.el('redo').disabled = !T.redoStack.length;
      this.root.querySelector('[data-journey-view="place-arrival"]').disabled = T.selected === 'opening';
      this.el('zones').innerHTML = this.zones.map(z => '<div class="stage" style="left:' + z.x + 'px;top:' + z.y + 'px;width:' + z.w + 'px;height:' + z.h + 'px"></div><div class="stage-hd" data-journey-zone="' + esc(z.ver) + '" style="left:' + (z.x + 15) + 'px;top:' + (z.y + 12) + 'px">' + (z.ver === 'opening' ? '面对面开场' : esc(z.ver)) + '<span class="n">' + z.count + ' 个站点</span></div>').join('');
      this.el('nodes').innerHTML = this.nodes.filter(n => this.showAnswers || !['arrival', 'reply'].includes(n.kind)).map(n => {
        const selected = n.key === this.selection ? ' sel' : '', value = n.value || {}, full = (n.title + ' ' + n.scope + ' ' + Object.values(value).filter(v => typeof v === 'string').join(' ')).toLowerCase();
        const dim = this.query && !full.includes(this.query.toLowerCase()) ? ' dim' : '';
        let card;
        const actions = ['player', 'arrival', 'reply'].includes(n.kind) ? '<div class="grip"><button class="icob" title="拖动此节点与后续节点" data-journey-family="' + esc(n.key) + '">✥</button><button class="icob del" title="删除' + n.title + '" data-journey-action="' + (n.kind === 'arrival' ? 'del-arrival' : 'del-step') + '" data-journey-scope="' + esc(n.scope) + '" data-journey-index="' + n.index + '">×</button></div>' : '';
        if (n.kind === 'start' || n.kind === 'end') card = '<div class="term term-' + n.kind + selected + dim + '">' + esc(n.title) + '</div>';
        else if (n.kind === 'player') card = '<div class="opt' + selected + dim + '"><div class="opt-hd"><div class="opt-t">' + esc(value.option || '（未填写）') + '</div><div class="opt-id">' + esc(n.title) + '</div><div class="badges"><span class="bd bd-next">唯一回复 · 第 ' + (n.index + 1) + ' 轮</span></div></div>' + actions + '</div>';
        else {
          const type = n.kind === 'reply' ? value.replyType === 'voice' ? 'voice' : 'text' : value.type || 'text';
          const text = n.kind === 'reply' ? value.reply : type === 'image' ? value.caption || value.alt || value.src : value.text;
          card = '<div class="ans' + selected + dim + '"><div class="ans-top"><span class="tag tag-' + (type === 'voice' ? 'audio' : type) + '">' + (types[type] || type) + '</span><span class="ans-id">' + esc(n.title) + '</span></div><div class="ans-tx">' + esc(text || '（未填写）') + '</div>' + actions + '</div>';
        }
        return '<div class="wrap jt-node" data-journey-node="' + esc(n.key) + '" style="position:absolute;left:' + n.x + 'px;top:' + n.y + 'px;width:' + n.w + 'px">' + card + '</div>';
      }).join('');
      // Cards use the original renderer's measured-height contract, so long text
      // never draws an outgoing line through the text or the next card.
      let changed = false;
      this.el('nodes').querySelectorAll('[data-journey-node]').forEach(el => { const n = this.nodes.find(n => n.key === el.dataset.journeyNode); if (n && el.offsetHeight) { if (n.h !== el.offsetHeight) changed = true; this.heights[n.key] = el.offsetHeight; } });
      if (changed && !measured) { this.build(); return this.paint(true); }
      this.drawEdges(); this.transform();
    },
    drawEdges() {
      const visible = this.nodes.filter(n => this.showAnswers || !['arrival', 'reply'].includes(n.kind));
      const keep = new Set(visible.map(n => n.key));
      const edge = this.el('edges');
      edge.setAttribute('width', Math.max(500, ...this.nodes.map(n => n.x + n.w + 100)));
      edge.setAttribute('height', Math.max(500, ...this.nodes.map(n => n.y + n.h + 100)));
      // Hidden answer cards are folded along the same single chain.
      const paths = [];
      visible.forEach(a => {
        let e = this.edges.find(e => e.from === a.key), cross = false;
        while (e && !keep.has(e.to)) { cross = cross || e.cross; e = this.edges.find(next => next.from === e.to); }
        const b = e && this.nodes.find(n => n.key === e.to); if (!b) return;
        const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y, bend = Math.max(20, Math.abs(y2 - y1) / 2);
        const d = (cross || e.cross) ? 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + 50) + ' ' + x2 + ',' + (y2 - 50) + ' ' + x2 + ',' + y2 : 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + bend) + ' ' + x2 + ',' + (y2 - bend) + ' ' + x2 + ',' + y2;
        paths.push('<path d="' + d + '" fill="none" stroke="' + (e.cross || cross ? '#7c3aed' : '#0f766e') + '" stroke-width="2"' + (e.cross || cross ? ' stroke-dasharray="6 4"' : '') + '/>');
      });
      edge.innerHTML = paths.join('');
    },
    select(key) {
      const n = this.nodes.find(n => n.key === key); if (!n) return;
      this.selection = key; this.tool.selected = n.scope; this.tool.stopSequence();
      this.paint(); this.inspect();
    },
    node() { return this.nodes.find(n => n.key === this.selection); },
    preview() { return mod('监看 · 当前站点', '<div class="jt-preview-controls"><button class="mini" data-journey-action="preview-play">▶ 按顺序播放</button><button class="mini" data-journey-action="preview-stop">停止</button></div><div id="journey-preview-log" class="jt-preview-log"><p class="jt-preview-empty">播放这一站全部报备与对话；语音消息出现即播放。</p></div>'); },
    inspect() {
      const T = this.tool, n = this.node(), j = T.data;
      if (!n || this.selection === 'global') return this.global();
      const host = T.node(n.scope), path = n.path, value = n.value || {};
      const head = '<div class="insp-hd"><div class="t">' + esc(n.title) + '</div><div class="s">' + esc(host.label || n.scope) + ' · 修改后点「保存全部」</div></div>';
      let html = '';
      if (n.kind === 'start' || n.kind === 'end') {
        html += field('稳定编号', '<span class="mono">' + esc(host.id || 'opening') + '（只读）</span>') + field('地点名称', txt(path + '|label', host.label));
        if (n.scope !== 'opening') html += field('解锁阶段', '<select class="sel2" data-journey-path="' + path + '|minVer" data-journey-rerender="1">' + stages.map(v => '<option' + (host.minVer === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>') + field('目的地', txt(path + '|destination', host.destination)) + field('旅行等待（分钟）', effectiveField(path + '|waitMinutes', num(path + '|waitMinutes', T.effectiveWaitMinutes(host), true, .1, 1440)));
        html += field('回复等待（秒）', effectiveField(path + '|replySeconds', num(path + '|replySeconds', T.effectiveReplySeconds(host), true, 1, 300))) + field('离开提示', txt(path + '|departure', host.departure, true)) + field('等待提示', effectiveField(path + '|waitHint', txt(path + '|waitHint', T.effectiveWaitHint(host), true)));
        html = mod('站点设置', html) + '<div class="tipbox">这里显示实际生效的等待设置；修改后成为本站配置，清空后恢复继承。旅行等待是到达本站前的真实分钟；回复等待是发送回复前的真实秒数。经营加速不改变等待，稳定编号用于已有存档。</div>';
        if (n.scope !== 'opening') {
          const i = T.stops().indexOf(host);
          html += mod('路线顺序', '<div class="jt-preview-controls">' + this.button('move-stop', n.scope, i, '↑ 上一站', -1, i === 0) + this.button('move-stop', n.scope, i, '↓ 下一站', 1, i === T.stops().length - 1) + this.button('del-stop', n.scope, i, '删除站点') + '</div>');
        }
      } else if (n.kind === 'arrival') {
        const p = path + '|arrivals|' + n.index, type = value.type || 'text';
        html = field('消息类型', this.typeSelect('type-arrival', n, types, type));
        if (type === 'image') html += field('图片', pick(p + '|src', value.src, 'image')) + field('图片预览', '<div class="jt-image-preview" data-journey-image-path="' + esc(p + '|src') + '" data-journey-image-alt-path="' + esc(p + '|alt') + '"></div>') + field('照片台词', txt(p + '|caption', value.caption, true)) + field('图片说明', txt(p + '|alt', value.alt));
        else {
          if (type === 'voice') html += field('音频', pick(p + '|src', value.src, 'audio')) + field('语音秒数', num(p + '|seconds', value.seconds, false, 1, 300));
          html += field(type === 'voice' ? '字幕' : '正文', txt(p + '|text', value.text, true));
        }
        html = mod('到达报备', html) + this.orderControls(n, 'arrival', host.arrivals.length);
      } else {
        const p = path + '|steps|' + n.index, voice = value.replyType === 'voice';
        html = field('玩家回复', txt(p + '|option', value.option, true)) + field('回复类型', this.typeSelect('type-reply', n, { text: '文本回复', voice: '语音对白' }, voice ? 'voice' : 'text')) + field(voice ? '语音字幕' : '小鲸鱼回复', txt(p + '|reply', value.reply, true));
        if (voice) html += field('音频', pick(p + '|replySrc', value.replySrc, 'audio'));
        html += field('发送前等待（秒）', num(p + '|replySeconds', value.replySeconds, true, 1, 300));
        html = mod('第 ' + (n.index + 1) + ' 轮对话', html) + this.orderControls(n, 'step', host.steps.length) + '<div class="tipbox">玩家点击选项后，经过这里设定的真实秒数，小鲸鱼的回复才会出现；留空沿用站点或全局。经营加速不改变等待。' + (voice ? '这不是语音长度，不会裁剪音频或改变播放速度；气泡时长读取音频本身，预览会等语音播完再继续。' : '') + '玩家回复与小鲸鱼回复是一轮。旅行使用唯一回复；箭头表示真实播放顺序。远程消息不写括号动作。</div>';
      }
      html += mod('新增节点', '<div class="jt-preview-controls">' + (n.scope !== 'opening' ? this.button('add-arrival', n.scope, null, '＋ 报备') : '') + this.button('add-step', n.scope, null, '＋ 对话') + '</div>') + this.preview();
      this.el('insp').innerHTML = head + html;
      this.refreshEffectiveFields(true); this.refreshInspectorAssets();
    },
    refreshEffectiveFields(restoreMissing) {
      const T = this.tool, n = this.node(); if (!T || !n) return;
      const host = T.node(n.scope);
      this.el('insp').querySelectorAll('[data-journey-effective]').forEach(box => {
        const path = box.dataset.journeyEffective, key = path.split('|').pop(), raw = T.pathValue(path), input = box.querySelector('input,textarea'), note = box.querySelector('.jt-field-note');
        const inherited = key === 'waitHint' ? !raw : raw === undefined;
        const value = key === 'waitHint' ? T.effectiveWaitHint(host) : key === 'waitMinutes' ? T.effectiveWaitMinutes(host) : T.effectiveReplySeconds(host);
        box.dataset.journeyInherited = String(inherited);
        note.textContent = inherited ? (key === 'waitHint' ? '沿用游戏默认提示' : '沿用全局 · 当前 ' + value + (key === 'waitMinutes' ? ' 分钟' : ' 秒')) : '本站配置 · 清空可恢复继承';
        if (restoreMissing && inherited) input.value = value;
      });
    },
    refreshInspectorAssets() {
      const T = this.tool; if (!T) return;
      this.el('insp').querySelectorAll('[data-journey-image-path]').forEach(box => {
        const value = T.pathValue(box.dataset.journeyImagePath), alt = T.pathValue(box.dataset.journeyImageAltPath), signature = JSON.stringify([value || '', alt || '']);
        if (box._journeyImageSignature === signature) return;
        box._journeyImageSignature = signature;
        box.classList.remove('is-failed'); box.dataset.journeyImageState = value ? 'loading' : 'empty';
        box.innerHTML = T.imagePreviewHTML(value, alt);
      });
    },
    typeSelect(action, n, choices, value) { return '<select class="sel2" data-journey-action="' + action + '" data-journey-scope="' + esc(n.scope) + '" data-journey-index="' + n.index + '">' + Object.entries(choices).map(([k, label]) => '<option value="' + k + '"' + (k === value ? ' selected' : '') + '>' + label + '</option>').join('') + '</select>'; },
    button(action, scope, index, label, dir, disabled) { return '<button type="button" class="mini' + (action.startsWith('del-') ? ' del' : '') + '" data-journey-action="' + action + '" data-journey-scope="' + esc(scope) + '"' + (index == null ? '' : ' data-journey-index="' + index + '"') + (dir == null ? '' : ' data-journey-dir="' + dir + '"') + (disabled ? ' disabled' : '') + '>' + label + '</button>'; },
    orderControls(n, kind, length) { return mod('播放顺序', '<div class="jt-preview-controls">' + this.button('move-' + kind, n.scope, n.index, '↑ 提前', -1, n.index === 0) + this.button('move-' + kind, n.scope, n.index, '↓ 延后', 1, n.index === length - 1) + this.button('del-' + kind, n.scope, n.index, kind === 'step' ? '删除这一轮' : '删除消息') + '</div>'); },
    global() {
      const j = this.tool.data;
      this.el('insp').innerHTML = '<div class="insp-hd"><div class="t">路线与全局</div><div class="s">修改后点「保存全部」</div></div>' + mod('全局设置', field('启用旅行', '<input type="checkbox" data-journey-path="ENABLED" data-journey-boolean="1"' + (j.ENABLED !== false ? ' checked' : '') + '>') + field('标题', txt('TITLE', j.TITLE)) + field('路线版本', esc(j.ROUTE_VERSION) + '（存档迁移用，只读）') + field('旅行等待', num('WAIT_MINUTES', j.WAIT_MINUTES, false, .1, 1440)) + field('回复等待', num('REPLY_SECONDS', j.REPLY_SECONDS, true, 1, 300))) + mod('各阶段年龄与头像', stages.map(v => field(v + ' 年龄', num('AGES_BY_VER|' + v, (j.AGES_BY_VER || {})[v], false, 0, 150)) + field(v + ' 头像', pick('PORTRAITS_BY_VER|' + v, (j.PORTRAITS_BY_VER || {})[v], 'image'))).join('')) + '<div class="tipbox">拖节点和阶段标题的位置会随配置保存。全局的旅行等待为真实分钟，回复等待为真实秒；经营加速不改变旅行计时。站点门槛按 V5 → V5.5 → V6 → V6.5 顺序。</div>';
    },
    update() { this.build(); this.paint(); },
    transform() { const c = this.camera; this.el('canvas').style.transform = 'translate(' + c.x + 'px,' + c.y + 'px) scale(' + c.k + ')'; this.el('zoomVal').value = Math.round(c.k * 100) + '%'; },
    fit(nodes) {
      nodes = nodes || this.nodes; if (!nodes.length) return;
      const vp = this.el('viewport'), w = vp.clientWidth || 700, h = vp.clientHeight || 650;
      const x = Math.min(...nodes.map(n => n.x)) - 35, y = Math.min(...nodes.map(n => n.y)) - 80, right = Math.max(...nodes.map(n => n.x + n.w)) + 35, bottom = Math.max(...nodes.map(n => n.y + n.h)) + 60;
      const k = Math.max(.04, Math.min(1, (w - 30) / (right - x), (h - 70) / (bottom - y)));
      this.camera = { k, x: (w - (right - x) * k) / 2 - x * k, y: 16 - y * k }; this.transform();
    },
    goStage(ver) {
      this.stage = ver; this.el('navStage').value = ver;
      if (!ver) return this.fit();
      const first = this.nodes.find(n => n.ver === ver); if (!first) return;
      const vp = this.el('viewport'), k = .9;
      this.camera = { k, x: (vp.clientWidth || 700) / 2 - (first.x + first.w / 2) * k, y: 105 - first.y * k };
      this.transform();
    },
    zoom(factor, point) { const vp = this.el('viewport'), r = vp.getBoundingClientRect(), px = point ? point.clientX - r.left : (vp.clientWidth || 700) / 2, py = point ? point.clientY - r.top : (vp.clientHeight || 650) / 2, c = this.camera, k = Math.max(.04, Math.min(2.4, c.k * factor)); c.x = px - (px - c.x) * k / c.k; c.y = py - (py - c.y) * k / c.k; c.k = k; this.transform(); },
    clearMessagePositions(scope) {
      if (!this.tool.data.POS) return;
      Object.keys(this.tool.data.POS).forEach(key => { try { const [id, kind] = JSON.parse(key); if (id === scope && ['arrival', 'player', 'reply'].includes(kind)) delete this.tool.data.POS[key]; } catch (_) { /* zone keys */ } });
    },
    cancelPlace() { this.placing = null; this.el('addGhost').hidden = true; },
    async place(event) {
      const kind = this.placing; if (!kind) return;
      const T = this.tool, scope = T.selected, host = T.node(scope), index = kind === 'arrival' ? (host.arrivals || []).length : kind === 'step' ? (host.steps || []).length : -1;
      const rect = this.el('viewport').getBoundingClientRect(), point = { x: Math.round((event.clientX - rect.left - this.camera.x) / this.camera.k - 128), y: Math.round((event.clientY - rect.top - this.camera.y) / this.camera.k) };
      this.cancelPlace();
      await T.click({ closest: () => ({ dataset: { journeyAction: 'add-' + kind, journeyScope: scope } }) });
      const id = kind === 'stop' ? T.selected : scope, cardKind = kind === 'stop' ? 'start' : kind === 'step' ? 'player' : 'arrival';
      const node = this.nodes.find(n => n.scope === id && n.kind === cardKind && n.index === index);
      if (!node) return;
      const pos = T.data.POS = T.data.POS || {}; pos[node.key] = point;
      if (kind === 'step') { const reply = this.nodes.find(n => n.scope === id && n.kind === 'reply' && n.index === index); if (reply) pos[reply.key] = { x: point.x, y: point.y + node.h + 36 }; }
      T.mark(); this.update(); this.select(node.key);
    },
    bind() {
      const vp = this.el('viewport');
      this.root.addEventListener('click', async e => {
        if (this.placing && vp.contains(e.target)) { await this.place(e); return; }
        const control = e.target.closest('[data-journey-view]');
        if (control) {
          const action = control.dataset.journeyView;
          if (action === 'fit') this.goStage('');
          if (action === 'global') { this.selection = 'global'; this.global(); }
          if (action === 'reset') { this.tool.remember(); delete this.tool.data.POS; this.tool.mark(); this.update(); this.goStage(this.stage); }
          if (action === 'zoom-in' || action === 'zoom-out') this.zoom(action === 'zoom-in' ? 1.2 : 1 / 1.2);
          if (action === 'answers') { this.showAnswers = !this.showAnswers; control.classList.toggle('on', this.showAnswers); this.paint(); }
          if (action === 'validate') { this.tool.renderErrors(); if (!this.tool.errors().length) { this.el('errors').hidden = false; this.el('errors').textContent = '✓ 校验通过'; } }
          if (action === 'add') { this.cancelPlace(); this.el('addMenu').hidden = !this.el('addMenu').hidden; }
          if (action.startsWith('place-')) {
            this.placing = action.slice(6); this.el('addMenu').hidden = true;
            this.el('addGhost').textContent = '＋ ' + ({ stop: '站点', arrival: '报备消息', step: '一轮对话' }[this.placing]) + ' · 点击画布放置 · Esc 取消';
            this.el('addGhost').hidden = false;
          }
        }
        const card = e.target.closest('[data-journey-node]');
        if (card && !e.target.closest('button') && !this._moved) this.select(card.dataset.journeyNode);
        this._moved = false;
      });
      this.el('navStage').addEventListener('change', e => this.goStage(e.target.value));
      this.el('q').addEventListener('input', e => { this.query = e.target.value; this.paint(); const found = this.nodes.find(n => (n.title + ' ' + n.scope + ' ' + JSON.stringify(n.value)).toLowerCase().includes(this.query.toLowerCase())); if (this.query && found) { this.select(found.key); this.fit([found]); } });
      vp.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e); }, { passive: false });
      vp.addEventListener('pointerdown', e => {
        if (this.placing) return;
        if (e.button !== 0 || e.target.closest('button:not([data-journey-family])')) return;
        const card = e.target.closest('[data-journey-node]'), zone = e.target.closest('[data-journey-zone]'), family = e.target.closest('[data-journey-family]');
        let keys = card ? [card.dataset.journeyNode] : zone ? this.zones.find(z => z.ver === zone.dataset.journeyZone).keys.slice() : [];
        if (family) { const start = this.nodes.findIndex(n => n.key === family.dataset.journeyFamily); keys = this.nodes.slice(start).filter(n => n.scope === this.nodes[start].scope).map(n => n.key); }
        if (keys.length && card) { this.selection = card.dataset.journeyNode; this.tool.selected = this.node().scope; this.inspect(); }
        const base = Object.fromEntries(keys.map(key => { const n = this.nodes.find(n => n.key === key); return [key, { x: n.x, y: n.y }]; }));
        const z = zone ? this.zones.find(z => z.ver === zone.dataset.journeyZone) : null;
        this.drag = { keys, base, zone: z && { ver: z.ver, x: z.x, y: z.y }, sx: e.clientX, sy: e.clientY, x: this.camera.x, y: this.camera.y, moved: false };
        vp.setPointerCapture?.(e.pointerId); e.preventDefault();
      });
      vp.addEventListener('pointermove', e => {
        if (this.placing) { const r = this.root.getBoundingClientRect(), ghost = this.el('addGhost'); ghost.style.left = (e.clientX - r.left) + 'px'; ghost.style.top = (e.clientY - r.top) + 'px'; return; }
        const d = this.drag; if (!d) return;
        const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) + Math.abs(dy) < 3 && !d.moved) return;
        if (!d.moved && d.keys.length) this.tool.remember();
        d.moved = true; this._moved = true;
        if (!d.keys.length) { this.camera.x = d.x + dx; this.camera.y = d.y + dy; this.transform(); return; }
        const pos = this.tool.data.POS = this.tool.data.POS || {};
        d.keys.forEach(key => { pos[key] = { x: Math.round(d.base[key].x + dx / this.camera.k), y: Math.round(d.base[key].y + dy / this.camera.k) }; });
        if (d.zone) pos['zone:' + d.zone.ver] = { x: Math.round(d.zone.x + dx / this.camera.k), y: Math.round(d.zone.y + dy / this.camera.k) };
        this.update();
      });
      const finish = () => { if (this.drag?.moved && this.drag.keys.length) this.tool.mark(); this.drag = null; this.el('undo').disabled = !this.tool.undoStack.length; };
      vp.addEventListener('pointerup', finish); vp.addEventListener('pointercancel', finish);
      // Hiding the add menu returns keyboard focus to body. Listen at document
      // capture, guarded by the active page, so native Esc/Ctrl+Z still work and
      // the test-chat tree's global shortcuts cannot edit its hidden graph.
      document.addEventListener('keydown', e => {
        if (!this.root.closest('.page')?.classList.contains('active')) return;
        if (e.key === 'Escape' && (this.placing || !this.el('addMenu').hidden)) { e.preventDefault(); e.stopImmediatePropagation(); this.el('addMenu').hidden = true; this.cancelPlace(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.matches('input,textarea')) { e.preventDefault(); e.stopImmediatePropagation(); e.shiftKey ? this.tool.redo() : this.tool.undo(); }
      }, true);
    }
  };
  window.JourneyTreeView = view;
})();
