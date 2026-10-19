/* [feature:talk_tier] V1.5 起模型已经会说人话。
   2026-10-02 用户：「疑似开智了是勉强说人话，v1.5 之后应该能说人话了，每个版本讨论的主题不同。」
   原版每进新阶段四维清零（新阶段 = 新模型），测试档位回到 dumb；V1.5 起各版本 dumb 档都没配回答，
   引擎回落全局咕嘎池，于是每个阶段开头又满屏乱码。
   这里不改原版档位和状态栏（仍是「专家加载中… → 专家已上线！」这类成长），只把 V1 之后 dumb 档的咕嘎
   换成「本版本的新能力还在加载」的人话；V1 的「尚未开智 → 疑似开了智」完全照旧。
   新增的鲸鱼娘台词 / 照片改问 whaleCanTalk()：只有 V1 未开智时才说咕嘎，之后的新模型不再退回乱码。 */
(function () {
  "use strict";
  const ui = window.GameUI, core = window.GameCore;
  if (!ui || !core || ui.__talkTier) return;
  ui.__talkTier = true;

  /* 各版本「能力加载中」时的回答：会说人话，但这一版的新本事还没上线（与 CHAT_TREE2 各版本状态栏对应）。 */
  const LOADING = {
    "V1.5": ["这题有点超纲……我的专家还在加载，等他上线再答你。", "我会说话啦，就是知识还没装全，再给我几天？", "嗯……这个得先问问专家，他还没到岗。"],
    "V2": ["你刚才说什么来着？长文记忆还在加载……", "我的记性暂时还跟金鱼差不多，等记忆模块装好再考我。"],
    "V2.5": ["文件太长了，我才看完开头……长文本功能还在装。", "这么多字，我能先只看标题吗？"],
    "V3": ["让我想想……想不出来，思维链还没加载完。", "这题得一步步推，可我现在只会跳步骤。"],
    "V3.5": ["让我想想……想不出来，思维链还没加载完。", "这题得一步步推，可我现在只会跳步骤。"],
    "V4": ["工具还没接上，我现在只能动动嘴。", "这个得用工具才能做，Agent 能力还在加载中。"],
    "V4.5": ["工具还没接上，我现在只能动动嘴。", "这个得用工具才能做，Agent 能力还在加载中。"]
  };
  const FALLBACK = ["新能力还在加载，等我再练练就能答上来。"];
  const GAME_LOADING = ["做游戏得用上一堆工具，Agent 能力还在加载……再给我几周！"];
  const verOf = (c) => ((c && c.state && c.state.ver) || "V1");
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const gibberish = (c, text) => {
    const pool = (c && c.cfg && c.cfg.GIBBERISH) || [];
    return typeof text === "string" && (pool.indexOf(text) >= 0 || /^咕嘎/.test(text));
  };

  ui.talkLoadingLine = function (ver) { return pick(LOADING[ver] || FALLBACK); };

  /* 鲸鱼娘会不会说人话：V1 看原版测试档位（开智前只说咕嘎），V1.5 起永远会说。 */
  ui.whaleCanTalk = function () {
    const c = this.core;
    if (!c || !c.state) return false;
    return verOf(c) !== "V1" || typeof this.omTestTier !== "function" || this.omTestTier() !== "dumb";
  };

  /* 测试聊天：原版 c2PickReply 在 dumb 档没配回答时回落咕嘎池 → V1 之后换成本版本的加载中人话。
     回复 id 仍是 null，对话树的推进与原版咕嘎完全一样。 */
  const pickReply = core.c2PickReply;
  if (typeof pickReply === "function") core.c2PickReply = function (o, tier) {
    const reply = pickReply.apply(this, arguments);
    if (tier === "full" || verOf(this) === "V1" || !reply || reply.id != null || !gibberish(this, reply.text)) return reply;
    return { id: null, type: "text", text: ui.talkLoadingLine(verOf(this)), cond: null };
  };

  /* 「帮我做个游戏」彩蛋：V4.5 新模型能力未上线时同理，不再回咕嘎。 */
  const testGame = ui.omTestGame;
  if (typeof testGame === "function") ui.omTestGame = function () {
    const g = testGame.apply(this, arguments);
    if (!g || verOf(this.core) === "V1" || (g.bad && !gibberish(this.core, g.bad))) return g;
    return Object.assign({}, g, { bad: pick(GAME_LOADING) });
  };
})();
