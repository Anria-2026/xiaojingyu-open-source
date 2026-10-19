/* Wardrobe configuration shares GameCfgTool's working copy and sparse save. */
(function () {
  "use strict";
  const tool = () => window.GameCfgTool, controls = () => window.V2BGameplay;
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const poses = [['img','站立'],['dragImg','拖动'],['wandImg','举棒']];
  const art = row => poses.map(([key,label]) => '<figure><figcaption>'+label+'</figcaption>'+(row[key] ? '<img src="/'+esc(row[key].replace(/^\//,''))+'" alt="'+esc((row.name||row.id)+' · '+label)+'">' : '<span>未选择图片</span>')+'</figure>').join('');
  window.OutfitsTool = {
    async refresh() { if (!tool().data) await tool().refresh(); this.render(); },
    render() {
      const root=document.getElementById('outfits-config'); if (!root || !tool().data) return;
      controls().ensureData();
      root.innerHTML='<div class="outfits-intro"><h2>时装</h2><p>全部装扮、动作图片与解锁条件集中设置。修改后点右上角「保存全部」，游戏刷新后生效。</p></div><p id="outfits-config-errors" role="status" aria-live="polite" hidden></p>'+tool().mod('','关注入口','作者 UID 用于前往主页，关注核验对象由当前 Toy 绑定作者决定。',controls().field(['WHALE_CARE','FOLLOW_AUTHOR_UID'],(tool().data.WHALE_CARE||{}).FOLLOW_AUTHOR_UID)) + controls().tree(tool().data.WHALE_OUTFITS||[],['WHALE_OUTFITS']);
      for (const [i,row] of (tool().data.WHALE_OUTFITS||[]).entries()) {
        const input=root.querySelector('[data-v2-path="WHALE_OUTFITS|'+i+'|img"]'), detail=input&&input.closest('details');
        if (!detail) continue;
        const preview=document.createElement('div');preview.className='outfits-art';preview.dataset.outfitPreview=String(i);preview.innerHTML=art(row);
        detail.querySelector('summary').insertAdjacentElement('afterend',preview);
        const description=detail.querySelector('[data-v2-path="WHALE_OUTFITS|'+i+'|desc"]');
        if (description) description.closest('.gcf-field').classList.add('outfit-description');
      }

    },
    updatePreview(path) {
      if (path[0] !== 'WHALE_OUTFITS') return;
      const row=tool().data.WHALE_OUTFITS&&tool().data.WHALE_OUTFITS[path[1]],root=document.getElementById('outfits-config');if (!row || !root) return;
      const preview=root.querySelector('[data-outfit-preview="'+path[1]+'"]');if (preview && poses.some(([key])=>key===path[2])) preview.innerHTML=art(row);
      const note=root.querySelector('[data-outfit-video-note="'+path[1]+'"]');
      if (note) { const condition=row.unlock||{}, bvid=controls().normalizeBvid(condition.videoBvid||'');note.textContent=condition.videoTriple===true ? bvid ? '指定视频 '+bvid+'；点赞、至少一枚币与收藏同时满足。已领取时装保留。' : '视频未配置，暂不开放领取；仍可预览。空值允许保存。' : '启用三连条件后才要求指定视频；仅支持当前 Toy 作者投稿或联合投稿的视频。'; }
    }
  };
})();
