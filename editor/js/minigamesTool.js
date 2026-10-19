/* Game hall configuration shares GameCfgTool's working copy and sparse save. */
(function () {
  "use strict";
  const games = [
    { id:"whack", title:"清除幻觉", icon:"🔨", note:"模型奖励为安全与稳定；陪伴好感在鲸鱼房配置。", fields:[["safety"],["stability"]] },
    { id:"sort", title:"语料分拣", icon:"📚", note:"按评级奖励不同品质语料，不发放经费。", fields:[["corpus_best"],["corpus_good"],["corpus_normal"]] },
    { id:"rice", title:"拯救大白饭", icon:"🍚", note:"V5 起解锁，只恢复小鲸鱼自身的体力。", fields:[["whale_energy"]] }
  ];
  const labels = { whale_energy:"小鲸鱼体力", safety:"安全", stability:"稳定", corpus_normal:"普通语料（条）", corpus_good:"良好语料（条）", corpus_best:"优质语料（条）" };
  const read = (value,path) => path.reduce((v,key) => v == null ? undefined : v[key],value);
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const tool = () => window.GameCfgTool;
  const controls = () => window.V2BGameplay;
  function input(path, value, label) {
    const html = controls().field(path,value == null ? 0 : value);
    const game = games.find(g => g.id === path[2]);
    const name = (game ? game.title+' ' : '')+(path[1] === "REWARDS" ? path[3]+' 级 ' : '')+label;
    return html.replace(/<label>[^<]*<\/label>/,'<label>'+esc(label)+'</label>').replace('<input ','<input aria-label="'+esc(name)+'" ');
  }
  function rewardCard(game, data) {
    const rewards = data.REWARDS && data.REWARDS[game.id] || {};
    const caps = data.REWARD_CAPS && data.REWARD_CAPS[game.id] || {};
    const gradeRows = ["S","A","B","C"].map(grade => '<div class="minigames-grade"><h4>'+grade+' 级</h4><div class="minigames-reward-fields">'+game.fields.map(path => input(["ARCADE","REWARDS",game.id,grade].concat(path),read(rewards[grade],path),labels[path[path.length-1]])).join("")+'</div></div>').join("");
    return '<section class="gcf-mod minigames-game" data-minigame="'+game.id+'"><div class="minigames-game-heading"><h3>'+game.icon+' '+game.title+'</h3><span class="minigames-duration">每局 30 秒</span></div><p class="gcf-tip">'+game.note+' C 级也可配置奖励，填 0 表示不发放。</p><div class="minigames-grades">'+gradeRows+'</div><details class="minigames-caps"><summary>领奖次数与奖励上限</summary><div class="gcf-grid">'+input(["ARCADE","PLAYS_PER_WEEK",game.id],(data.PLAYS_PER_WEEK||{})[game.id],"每周领奖次数")+game.fields.map(path => input(["ARCADE","REWARD_CAPS",game.id].concat(path),read(caps,path),labels[path[path.length-1]]+" · 每局基础上限")).join("")+'</div><p class="gcf-tip">各等级奖励不能超过这里的基础上限。简单奖励按下方奖档，普通／困难按配置倍率结算；不乘模型阶段倍率；阶段累计预算按基础上限 × 领奖周数计算。</p></details></section>';
  }
  function advanced(title, value, path) {
    return value == null ? "" : '<details class="gcf-mod minigames-advanced"><summary>'+title+'</summary>'+controls().tree(value,path)+'</details>';
  }
  window.MinigamesTool = {
    async refresh() {
      if (!tool().data) await tool().refresh();
      this.render();
    },
    render() {
      const root = document.getElementById("minigames-config");
      if (!root || !tool().data) return;
      controls().ensureData();
      const a = tool().data.ARCADE || {};
      root.innerHTML = '<div class="minigames-intro"><div><h2>小游戏</h2><p>三种玩法的奖励与规则集中设置。修改后点右上角「保存全部」，游戏刷新后生效。</p></div><span class="minigames-duration">统一 30 秒 · 不加时</span></div><p id="minigames-config-errors" role="status" aria-live="polite" hidden></p>'+games.map(game => rewardCard(game,a)).join("")+tool().mod("⚙", "公共奖励规则", "评级奖励按配置发放，不受模型阶段倍率影响。每周次数与阶段领奖周数均按配置执行，余下可练习。", '<div class="gcf-grid">'+controls().field(["ARCADE","ENABLED"],a.ENABLED)+input(["ARCADE","STAGE_MAX_REWARD_WEEKS"],a.STAGE_MAX_REWARD_WEEKS,"单阶段领奖周数")+'</div>')+advanced("游戏厅介绍与入口",{INTRO:a.INTRO,GAMES:a.GAMES,LOCKED:a.LOCKED,REWARD_GROWTH_TEXT:a.REWARD_GROWTH_TEXT},["ARCADE"])+advanced("难度奖励倍率",a.REWARD_MULT_BY_DIFFICULTY,["ARCADE","REWARD_MULT_BY_DIFFICULTY"])+advanced("阶段难度",a.DIFFICULTY_BY_VER,["ARCADE","DIFFICULTY_BY_VER"])+advanced("清除幻觉 · 出场与停留节奏",a.WHACK,["ARCADE","WHACK"])+advanced("语料分拣 · 卡片与判定",a.SORT,["ARCADE","SORT"])+advanced("拯救大白饭 · 得分与磁吸",a.RICE,["ARCADE","RICE"])+advanced("美术素材与伙伴",{SPRITES:a.SPRITES,WHALE_SPRITES:a.WHALE_SPRITES,RESULT_ART:a.RESULT_ART,GUESTS:a.GUESTS},["ARCADE"]);

    }
  };
})();
