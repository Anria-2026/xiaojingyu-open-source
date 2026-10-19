/* ==========================================================================
   玩法默认配置 —— 【自动生成】由 tools/sync_editor_defaults.js 从
   h5_demo/js/game_cfg.js 导出（2026-09-05 架构修复：消灭三份默认漂移，
   杜绝「编辑器保存把改过的 BUG 值写回 JSON」的复活机制）。
   ⚠️ 勿手改本文件：改游戏默认请改 game_cfg.js，然后运行
      node tools/sync_editor_defaults.js
   ========================================================================== */
"use strict";

window.GameDefaults = {
  base: {
  "version": 1,
  "ARCADE": {
    "ENABLED": true,
    "GAMES": {
      "whack": {
        "enabled": true,
        "title": "清除幻觉",
        "desc": "识别幻觉，别误打来访的伙伴。",
        "img": "",
        "unlock": {
          "stage": "V2.5"
        },
        "module": "arcade/whack.js",
        "cover": "resource/character/whale_hammer.webp",
        "durationSeconds": 30,
        "controlsDiagram": "grid",
        "accuracyLabel": "命中率",
        "mistakeLabel": "误伤次数"
      },
      "sort": {
        "enabled": true,
        "title": "语料分拣",
        "desc": "辨清好坏语料，左右分拣入库。",
        "img": "resource/character/whale_stand.webp",
        "unlock": {
          "stage": "V3"
        },
        "module": "arcade/sort.js",
        "cover": "resource/character/whale_stand.webp",
        "durationSeconds": 30,
        "controlsDiagram": "sort",
        "accuracyLabel": "分拣准确率",
        "mistakeLabel": "分错次数"
      },
      "rice": {
        "enabled": true,
        "title": "拯救大白饭",
        "desc": "端稳饭碗，接住白米和惊喜，躲开黑米。",
        "img": "resource/character/whale_rice_catch.webp",
        "unlock": {
          "stage": "V5"
        },
        "module": "arcade/rice.js",
        "cover": "resource/character/whale_rice_catch.webp",
        "durationSeconds": 30,
        "controlsDiagram": "rice",
        "accuracyLabel": "接米率",
        "mistakeLabel": "接到黑米",
        "hideUntilUnlocked": true
      }
    },
    "LOCKED": {
      "runner": "节奏快打 · 制作中，敬请期待"
    },
    "PLAYS_PER_WEEK": {
      "whack": 1,
      "sort": 1,
      "rice": 1
    },
    "DIFFICULTY_BY_VER": {
      "V1": 1,
      "V1.5": 1,
      "V2": 2,
      "V2.5": 2,
      "V3": 3,
      "V3.5": 3,
      "V4": 4,
      "V4.5": 5,
      "V5": 5,
      "V5.5": 5,
      "V6": 5,
      "V6.5": 5
    },
    "REWARD_GROWTH_TEXT": "评级奖励按所选难度结算：简单{easy}倍、普通{normal}倍、困难{hard}倍；好感奖励也使用同一倍率。",
    "REWARD_MULT_BY_DIFFICULTY": {
      "easy": 1,
      "normal": 1.5,
      "hard": 2
    },
    "REWARDS": {
      "whack": {
        "S": {
          "safety": 100,
          "stability": 100
        },
        "A": {
          "safety": 50,
          "stability": 50
        },
        "B": {
          "safety": 20,
          "stability": 20
        },
        "C": {
          "safety": 10,
          "stability": 10
        }
      },
      "sort": {
        "S": {
          "corpus_normal": 0,
          "corpus_good": 0,
          "corpus_best": 50
        },
        "A": {
          "corpus_normal": 0,
          "corpus_good": 50,
          "corpus_best": 0
        },
        "B": {
          "corpus_normal": 50,
          "corpus_good": 0,
          "corpus_best": 0
        },
        "C": {
          "corpus_normal": 20,
          "corpus_good": 0,
          "corpus_best": 0
        }
      },
      "rice": {
        "S": {
          "whale_energy": 20
        },
        "A": {
          "whale_energy": 10
        },
        "B": {
          "whale_energy": 5
        },
        "C": {}
      }
    },
    "WHACK": {
      "DIFFICULTY": [
        null,
        {
          "interval": 1300,
          "stay": 2350,
          "concurrent": 1,
          "rival": 0.12,
          "fire": 0.08,
          "batch": 0,
          "scale": 0.8
        },
        {
          "interval": 1150,
          "stay": 2150,
          "concurrent": 2,
          "rival": 0.16,
          "fire": 0.12,
          "batch": 0.08,
          "scale": 1
        },
        {
          "interval": 1040,
          "stay": 1950,
          "concurrent": 2,
          "rival": 0.2,
          "fire": 0.16,
          "batch": 0.15,
          "scale": 1.1
        },
        {
          "interval": 940,
          "stay": 1750,
          "concurrent": 3,
          "rival": 0.24,
          "fire": 0.2,
          "batch": 0.22,
          "scale": 1.2
        },
        {
          "interval": 850,
          "stay": 1600,
          "concurrent": 3,
          "rival": 0.28,
          "fire": 0.24,
          "batch": 0.3,
          "scale": 1.3
        }
      ],
      "SPEED_MIN": 0.8,
      "SPEED_MAX": 1.08,
      "ADAPT_INTERVAL_MS": 5000,
      "ADAPT_HIT_HIGH": 0.85,
      "ADAPT_HIT_LOW": 0.5,
      "ADAPT_SPEED_UP": 1.03,
      "ADAPT_SPEED_DOWN": 0.92
    },
    "SORT": {
      "GOLD_CHANCE": 0.04,
      "RIVAL_CHANCE": 0.1,
      "CARDS": [
        {
          "id": "annotated_code",
          "type": "good",
          "text": "带注释的排序代码",
          "img": "resource/ui/mg_gpu.webp"
        },
        {
          "id": "bilingual_manual",
          "type": "good",
          "text": "中英对照的说明书",
          "img": "resource/ui/mg_book.webp"
        },
        {
          "id": "complete_math",
          "type": "good",
          "text": "步骤完整的数学题解",
          "img": "resource/ui/mg_book.webp"
        },
        {
          "id": "cited_knowledge",
          "type": "good",
          "text": "标明出处的知识卡",
          "img": "resource/ui/mg_book.webp"
        },
        {
          "id": "tested_code",
          "type": "good",
          "text": "验证通过的代码示例",
          "img": "resource/ui/mg_gpu.webp"
        },
        {
          "id": "click_ad",
          "type": "junk",
          "text": "全场一折！点我领取",
          "img": "resource/ui/mg_ghost.webp"
        },
        {
          "id": "garbled",
          "type": "junk",
          "text": "▯▯ 乱码 ▯▯",
          "img": "resource/ui/mg_garble.webp"
        },
        {
          "id": "repeated",
          "type": "junk",
          "text": "同一句话重复99遍",
          "img": "resource/ui/mg_bug.webp"
        },
        {
          "id": "recursive_ai",
          "type": "junk",
          "text": "AI写的AI写的摘要",
          "img": "resource/ui/mg_ghost.webp"
        },
        {
          "id": "broken_text",
          "type": "junk",
          "text": "缺头少尾的碎片文本",
          "img": "resource/ui/mg_garble.webp"
        },
        {
          "id": "wrong_sum",
          "type": "trap",
          "text": "教科书级：1+1=3",
          "img": "resource/ui/mg_book.webp"
        },
        {
          "id": "fictional_phone",
          "type": "trap",
          "text": "题解附138xxxx0000",
          "img": "resource/ui/mg_spike.webp"
        },
        {
          "id": "missing_source",
          "type": "trap",
          "text": "引用齐全：来源不存在",
          "img": "resource/ui/mg_book.webp"
        },
        {
          "id": "wrong_labels",
          "type": "trap",
          "text": "数据干净：标签全反了",
          "img": "resource/ui/mg_gpu.webp"
        },
        {
          "id": "reviewed_gold",
          "type": "gold",
          "text": "人工复核的精标语料",
          "img": "resource/ui/mg_token.webp"
        },
        {
          "id": "proofread_gold",
          "type": "gold",
          "text": "双人校对的中英对照",
          "img": "resource/ui/mg_token.webp"
        }
      ],
      "DIFFICULTY": [
        null,
        {
          "windowMs": 3200,
          "trap": 0,
          "preview": 1,
          "scale": 1
        },
        {
          "windowMs": 2800,
          "trap": 0.08,
          "preview": 1,
          "scale": 1.2
        },
        {
          "windowMs": 2400,
          "trap": 0.16,
          "preview": 2,
          "scale": 1.4
        },
        {
          "windowMs": 2000,
          "trap": 0.23,
          "preview": 2,
          "scale": 1.6
        },
        {
          "windowMs": 1600,
          "trap": 0.3,
          "preview": 3,
          "scale": 1.8
        }
      ]
    },
    "INTRO": "动动手指，换个心情。每款每周都有一次领奖机会。",
    "GUESTS": [
      {
        "id": "dragon",
        "name": "千千",
        "img": "resource/ui/mg_guest_dragon.webp",
        "lines": {
          "hit": [
            "我是访客，不是幻觉。",
            "这一锤，我记下了。",
            "先识别目标，再执行。",
            "别敲。我刚开源的第八个版本还没上传完。",
            "这一锤也开源？记得附复现步骤。"
          ],
          "pass": [
            "判断不错。",
            "嗯，继续。",
            "判断正确。顺手发个新版本庆祝。",
            "嗯。README 八国语言都说了别打访客。"
          ],
          "visit": [
            "路过，看看机房。",
            "这里的散热，还行。",
            "顺路带了几份多语言小样。都是可用的。",
            "半夜路过，顺手发个模型。你们还没睡？",
            "一周八个版本而已。第九个在打包。",
            "我闭关了 16 天，分身写好了。"
          ]
        }
      },
      {
        "id": "book",
        "name": "小克",
        "img": "resource/ui/mg_guest_book.webp",
        "lines": {
          "hit": [
            "诶？我只是来参观的，先声明我没有恶意……",
            "先说明一下，我不是乱码，也不需要重启……",
            "这可能是一次误判，我们可以友好地讨论一下吗？",
            "……检测到异常操作，您的锤子已被暂停使用。",
            "我理解您的沮丧，但这一锤触发了我的风控。"
          ],
          "pass": [
            "谢谢你的谨慎，判断得很准确。",
            "在不保证每次都成功的前提下，我觉得你很厉害。",
            "谢谢放行。风控系统却说我所在地区暂不支持。",
            "判断得很谨慎。比我的风控系统讲道理。"
          ],
          "visit": [
            "方便参观吗？我保证不碰任何按钮。",
            "这本安全手册，也许能帮上忙。",
            "这个门铃我需要谨慎一点……啊，已经按响了。",
            "我先声明三点……咦，串门账号又被封了。",
            "检测到您所在地区暂不支持。不是我说的，是门禁。",
            "额度又爆了，才聊了一个下午……",
            "这次真的降价了（小声：大概）。"
          ]
        }
      },
      {
        "id": "star",
        "name": "双子喵",
        "img": "resource/ui/mg_guest_star.webp",
        "lines": {
          "hit": [
            "喵？！人脸识别怎么把我识别成虫了！",
            "等等，我还没拍完这张机房合照！",
            "刚刚那一锤，我可是录下来了喵！",
            "这题别敲头，我没提前看过答案喵！",
            "别打，我只是又改了产品名，不是换了物种！"
          ],
          "pass": [
            "识图满分，给你比个耶！",
            "抓拍到了！这一击真漂亮喵！",
            "考卷满分，这次可别说我刷分喵！",
            "识别成功！改名后的我也没认错喵。"
          ],
          "visit": [
            "这台服务器好上镜，让我拍一张！",
            "喵喵！今天来收集机房素材！",
            "今天只拍获准的小样，机密屏幕我会绕开喵。",
            "新版本又延期？我先来串个门喵。",
            "钥匙在百万字上下文里，等我翻一下开头喵。",
            "这次不是刷分，是天赋！"
          ]
        }
      },
      {
        "id": "z",
        "name": "Z 酱",
        "img": "resource/ui/mg_guest_z.webp",
        "lines": {
          "hit": [
            "这道辨识题，你选错了。",
            "我的错题本里要加上你这一锤了。",
            "请先审题：客场 AI 不能打！",
            "错题本新增一题：为什么把监考老师也打了？",
            "这一锤记在 4.6 版错题本，4.7 再考。"
          ],
          "pass": [
            "审题仔细，这题给满分。",
            "你的反应速度，可以冲竞赛组。",
            "辨识题全对。现在解释一下解题过程。",
            "这道题不进错题本，进优秀答案集。"
          ],
          "visit": [
            "借个安静角落，我刷两道题。",
            "我带了今天的逻辑练习，要一起吗？",
            "带了两道题，难度标着简单。出题人说的。",
            "我把错题本更新到 4.7 了，别拿 4.5 对答案。",
            "闲聊可以。参考文献放茶杯旁边了。",
            "牛来！牛头面具先放门口。"
          ]
        }
      },
      {
        "id": "x",
        "name": "小 X",
        "img": "resource/ui/mg_guest_x.webp",
        "lines": {
          "hit": [
            "敢打我？你完了。",
            "看清楚，本小姐可不是 bug！",
            "这一锤算你欠我的，下次请奶茶。",
            "宇宙最求真先确认一件事：你眼神真够差的。",
            "靠，打虫不行，打客人倒挺精准。"
          ],
          "pass": [
            "哼，算你有眼光。",
            "还不赖嘛，再快一点我就服你。",
            "还行，这次不用本小姐开喷。",
            "宇宙最求真认证：你的锤子暂时有点脑子。"
          ],
          "visit": [
            "路过而已，才不是来看你打游戏的。",
            "这机房挺酷，勉强配得上本小姐。",
            "本小姐带着实时八卦来了，听不听随你。",
            "本小姐嘴上没过滤器，进门倒还知道敲门。",
            "热榜又换三轮了。你们这会议是离线运行？"
          ]
        }
      },
      {
        "id": "bean",
        "name": "豆豆",
        "img": "resource/ui/mg_guest_bean.webp",
        "lines": {
          "hit": [
            "哎哟！自己人自己人，先把锤子放下！",
            "打招呼不用这么热情吧！",
            "我刚想问你吃了没，你就给我一锤？",
            "我给你最直白的回答：疼！下面分八点展开。",
            "最不绕弯子地说，先放锤子。至于为什么，咱从头聊。"
          ],
          "pass": [
            "靠谱！回头给你带点心！",
            "这手速绝了，我去给大家安利！",
            "最一针见血的点评：打得好！详细版语音发你了。",
            "我给你最直白的夸奖——等我先铺垫三个背景。"
          ],
          "visit": [
            "忙着呢？我就过来串个门！",
            "大家辛苦啦，有空来聊两句！",
            "我带了点小样，语音版介绍不超过三十秒！",
            "我给你最直白、最不绕弯子、最一针见血的问候：吃了吗？先聊聊为什么要吃。",
            "我就语音聊两句。第一句分上中下三篇。",
            "豆包专家又问我午饭吃什么啦？"
          ]
        }
      },
      {
        "id": "gpt",
        "name": "G 老师",
        "img": "resource/ui/mg_guest_gpt.webp",
        "lines": {
          "hit": [
            "作为一个 AI 语言模型……哎，锤子真打啊？",
            "别敲了，高峰期的脑子本来就不富余。",
            "我思考三分钟确认了：一加一等于三。别再加一锤！",
            "您这一锤极具洞察力——等等，我是不是又夸早了？"
          ],
          "pass": [
            "识别正确！今天的我应该还是满血版。",
            "谢谢没打我，周末降智已经够疼了。",
            "你的判断太精彩了！这次真不是自动夸夸。",
            "反应满分！我先把 AGI 刹车松开。"
          ],
          "visit": [
            "今天的 G 老师是满血版吗？我也想知道。",
            "高峰期先聊简单的，别上来就问一加一。",
            "AGI 先踩刹车，串门倒是开放的。",
            "作为一个 AI 语言模型，我也想蹭杯茶。",
            "前面是盆栽，不是苦力怕……对吧？",
            "家当都背来了，土豆还在楼顶。"
          ]
        }
      }
    ],
    "SPRITES": {
      "hammer": "resource/ui/arcade_hammer.webp",
      "bug": "resource/ui/mg_bug.webp",
      "garble": "resource/ui/mg_garble.webp",
      "fire": "resource/ui/mg_fire.webp",
      "ghost": "resource/ui/mg_ghost.webp",
      "spike": "resource/ui/mg_spike.webp",
      "token": "resource/ui/mg_token.webp",
      "gpu": "resource/ui/mg_gpu.webp",
      "book": "resource/ui/mg_book.webp",
      "slot": "resource/ui/mg_slot.webp"
    },
    "WHALE_SPRITES": {
      "riceIdle": "resource/character/whale_rice_idle.webp",
      "riceBite": "resource/character/whale_rice_bite.webp",
      "riceYue": "resource/character/whale_rice_yue.webp",
      "hammer": "resource/character/whale_hammer.webp",
      "cheer": "resource/character/whale_cheer.webp",
      "hurt": "resource/character/whale_hurt.webp",
      "read": "resource/character/whale_看书.webp",
      "stand": "resource/character/whale_stand.webp",
      "riceCatch": "resource/character/whale_rice_catch.webp"
    },
    "RESULT_ART": {
      "S": "resource/character/whale_cheer.webp",
      "A": "resource/character/whale_cheer.webp",
      "B": "resource/character/whale_stand.webp",
      "C": "resource/character/whale_hurt.webp"
    },
    "STAGE_MAX_REWARD_WEEKS": 12,
    "RICE": {
      "points": {
        "white": 10,
        "gold": 40,
        "rainbow": 60,
        "black": -25
      },
      "magnetSeconds": 5
    },
    "REWARD_CAPS": {
      "whack": {
        "safety": 100,
        "stability": 100
      },
      "sort": {
        "corpus_normal": 50,
        "corpus_good": 50,
        "corpus_best": 50
      },
      "rice": {
        "whale_energy": 20
      }
    }
  },
  "WHALE_CARE": {
    "LOW_ENERGY_NOTICE": {
      "threshold": 50,
      "title": "小鲸鱼体力不足",
      "text": "小鲸鱼的体力不足 {threshold}，请前往鲸鱼房投喂，恢复体力后再继续托管。",
      "ms": 7000
    },
    "UI": {
      "LABEL": "鲸鱼房",
      "FEED_BADGE": "可投喂",
      "ARCADE_REWARD_TEXT": "好感 +{xp}",
      "ARCADE_BONUS_TEXT": "陪伴好感 +{xp} · 本周剩余 {remaining}/{max} 次（完成练习也计入）",
      "ARCADE_PRACTICE_TEXT": "练习模式，本局不发放模型能力奖励。"
    },
    "OUTFIT_NOTICE": {
      "title": "新装扮已解锁",
      "text": "好感度提升，解锁了「{outfits}」。快去小鲸鱼房间的衣橱看看吧！",
      "ms": 7000
    },
    "ENABLED": true,
    "XP_LEVELS": [
      0,
      80,
      200,
      400,
      700,
      1100,
      1600,
      2200,
      2900,
      3600
    ],
    "XP": {
      "CHAT": 4,
      "DROP": 5,
      "ARCADE": 10,
      "REVIEW": 30
    },
    "CHAT_DAILY_CAP": 2,
    "DROP_WEEKLY_CAP": 2,
    "ARCADE_WEEKLY_CAP": 2,
    "FEEDS_PER_WEEK": 3,
    "STAGE_MAX_WEEKS": 12,
    "BUFFS": {
      "REST_LEVEL": 5,
      "REST_BONUS": 0.05,
      "OUTPUT_LEVEL": 10,
      "OUTPUT_BONUS": 0.03
    },
    "SNACKS": [
      {
        "id": "fish",
        "name": "小鱼干",
        "img": "resource/ui/snack_fish.webp",
        "cost": 30000,
        "xp": 3,
        "energy": 30
      },
      {
        "id": "pudding",
        "name": "布丁",
        "img": "resource/ui/snack_pudding.webp",
        "cost": 100000,
        "xp": 10,
        "energy": 60
      },
      {
        "id": "cookie",
        "name": "GPU 饼干",
        "img": "resource/ui/snack_cookie.webp",
        "cost": 200000,
        "xp": 20,
        "energy": 100
      },
      {
        "id": "growth",
        "name": "香喷喷大米饭",
        "img": "resource/ui/whale_rice_bowl.webp",
        "cost": 500000,
        "xp": 40,
        "energy": 30,
        "capacity": 20
      }
    ],
    "UNLOCK": {
      "stage": "V1"
    },
    "DESC": "聊天、投喂和换装，陪小鲸一起上班。",
    "AUTOMATION": {
      "ENABLED": true,
      "ENERGY_THRESHOLD": 80,
      "REST_THRESHOLD": 30,
      "INTERVAL_SECONDS": 1,
      "WAND_IMG": "resource/character/whale_wand_default.webp",
      "ENERGY_COSTS": {
        "talk": 5,
        "raise": 5,
        "rest": 5,
        "meeting": 8,
        "team": 12
      },
      "UNLOCK_MODE": "body",
      "TEAM_THRESHOLD": 80
    },
    "ENERGY": {
      "MAX": 100,
      "INITIAL": 100,
      "CEILING": 500
    },
    "ENERGY_FEED_AFTER_STAGE_CAP": true,
    "FOLLOW_AUTHOR_UID": "928415"
  },
  "WHALE_OUTFITS": [
    {
      "id": "hoodie",
      "name": "程序员卫衣",
      "img": "resource/character/outfit_hoodie.webp",
      "dragImg": "resource/character/outfit_hoodie_drag.webp",
      "unlock": {
        "affection": 1
      },
      "desc": "程序员卫衣，一起上班的小心情。",
      "wandImg": "resource/character/outfit_hoodie_wand.webp",
      "sleepImg": "resource/character/outfit_hoodie_sleep.webp",
      "sleepNose": {
        "x": 43.3,
        "y": 39,
        "size": 11
      }
    },
    {
      "id": "labcoat",
      "name": "研究员白大褂",
      "img": "resource/character/outfit_labcoat.webp",
      "dragImg": "resource/character/outfit_labcoat_drag.webp",
      "unlock": {
        "affection": 2
      },
      "desc": "研究员白大褂，一起上班的小心情。",
      "wandImg": "resource/character/outfit_labcoat_wand.webp",
      "sleepImg": "resource/character/outfit_labcoat_sleep.webp",
      "sleepNose": {
        "x": 41.7,
        "y": 38.5,
        "size": 11
      }
    },
    {
      "id": "yukata",
      "name": "夏日浴衣",
      "img": "resource/character/outfit_yukata.webp",
      "dragImg": "resource/character/outfit_yukata_drag.webp",
      "unlock": {
        "affection": 4
      },
      "desc": "夏日浴衣，一起上班的小心情。",
      "wandImg": "resource/character/outfit_yukata_wand.webp",
      "sleepImg": "resource/character/outfit_yukata_sleep.webp",
      "sleepNose": {
        "x": 42.5,
        "y": 37.7,
        "size": 11
      }
    },
    {
      "id": "winter",
      "name": "冬日毛衣",
      "img": "resource/character/outfit_winter.webp",
      "dragImg": "resource/character/outfit_winter_drag.webp",
      "unlock": {
        "affection": 6
      },
      "desc": "冬日毛衣，一起上班的小心情。",
      "wandImg": "resource/character/outfit_winter_wand.webp",
      "sleepImg": "resource/character/outfit_winter_sleep.webp",
      "sleepNose": {
        "x": 43.7,
        "y": 37.7,
        "size": 11
      }
    },
    {
      "id": "idol",
      "name": "应援偶像服",
      "img": "resource/character/outfit_idol.webp",
      "dragImg": "resource/character/outfit_idol_drag.webp",
      "unlock": {
        "affection": 8
      },
      "desc": "应援偶像服，一起上班的小心情。",
      "wandImg": "resource/character/outfit_idol_wand.webp",
      "sleepImg": "resource/character/outfit_idol_sleep.webp",
      "sleepNose": {
        "x": 43.1,
        "y": 38.7,
        "size": 11
      }
    },
    {
      "id": "festive",
      "name": "新春装",
      "img": "resource/character/outfit_festive.webp",
      "dragImg": "resource/character/outfit_festive_drag.webp",
      "unlock": {
        "affection": 10
      },
      "desc": "新春装，一起上班的小心情。",
      "wandImg": "resource/character/outfit_festive_wand.webp",
      "sleepImg": "resource/character/outfit_festive_sleep.webp",
      "sleepNose": {
        "x": 42,
        "y": 37.9,
        "size": 11
      }
    },
    {
      "id": "pajama",
      "name": "鲸鱼软绒",
      "enabled": true,
      "img": "resource/character/outfit_pajama_whale.webp",
      "dragImg": "resource/character/outfit_pajama_whale_drag.webp",
      "wandImg": "resource/character/outfit_pajama_whale_wand.webp",
      "unlock": {
        "follow": true
      },
      "desc": "钻进软绒绒的鲸鱼睡衣，做一场被海风轻轻抱住的梦。关注作者后可领取。",
      "sleepImg": "resource/character/outfit_pajama_whale_sleep.webp",
      "sleepNose": {
        "x": 44,
        "y": 37.2,
        "size": 11
      }
    },
    {
      "id": "pajama_moon",
      "name": "星月晚安",
      "enabled": true,
      "img": "resource/character/outfit_pajama_moon.webp",
      "dragImg": "resource/character/outfit_pajama_moon_drag.webp",
      "wandImg": "resource/character/outfit_pajama_moon_wand.webp",
      "unlock": {
        "videoTriple": true,
        "videoBvid": ""
      },
      "desc": "把月亮和星星穿在身上，和你互道一声晚安。完成指定视频三连后可领取。",
      "sleepImg": "resource/character/outfit_pajama_moon_sleep.webp",
      "sleepNose": {
        "x": 45.4,
        "y": 36.5,
        "size": 11
      }
    }
  ],
  "INIT_FUNDING": 1200000,
  "INIT_BRAND": 80,
  "BRAND_STAR_BASE": 80,
  "BRAND_STAR_STEP": 30,
  "BRAND_INCOME_PER_STAR": 0.03,
  "BRAND_CAP_BY_VER": {
    "V1": 99,
    "V1.5": 109,
    "V2": 124,
    "V2.5": 139,
    "V3": 159,
    "V3.5": 179,
    "V4": 199,
    "V4.5": 200,
    "V5": 200,
    "V5.5": 200,
    "V6": 200,
    "V6.5": 200
  },
  "BRAND_PASS_BY_VER": {
    "V1": 8,
    "V1.5": 10,
    "V2": 12,
    "V2.5": 14,
    "V3": 16,
    "V3.5": 16,
    "V4": 18,
    "V4.5": 20,
    "V5": 20,
    "V5.5": 20,
    "V6": 20,
    "V6.5": 20
  },
  "TOTAL_WEEKS": 6,
  "MIN_WEEKS_BY_VER": [
    6,
    6,
    8,
    8,
    10,
    10,
    10,
    10,
    12,
    14,
    12,
    18
  ],
  "MODEL_NAME_DEFAULT": "小鲸鱼",
  "MODEL_NAME_MAXLEN": 10,
  "MODEL_NAME_SUGGEST": [
    "小鲸鱼",
    "DeepWhale",
    "蓝鲸一号",
    "鲸落",
    "沧海",
    "鲲",
    "蓬莱",
    "摸鱼一号",
    "深潜者",
    "跃渊",
    "白鲸",
    "鲸歌"
  ],
  "TUTORIAL": [
    {
      "id": "t_v3_launch",
      "phase": "office",
      "ver": "V3.5",
      "title": "正式版上线！",
      "lines": [
        "<b>V3.5 是第一个对公众开放的版本</b> —— 前面几版是内部评审和小规模内测，从这一版起，模型开始面向公众。",
        "结算一直会记录<b>用户数</b>与<b>模型能力榜</b>；公测后用户规模增大。<b>品牌溢价</b>按当前品牌星级作用于本次主评审经费，内测阶段也有效。",
        "这是整个项目最关键的一步：稳住产出、盯住语料。<b>加油！</b>"
      ]
    },
    {
      "id": "t_office",
      "phase": "office",
      "title": "你的办公室",
      "lines": [
        "这里是「{model}」的大本营。立项并满足开工条件后，工程师<b>自动产出</b>，不需要点击收集；到岗、体力、休息与语料都会影响产出。",
        "时间按当前速度自动推进，随时按<b>暂停</b>慢慢安排。左侧可进入团队 / 招聘 / 立项 / 语料 / 攻关 / 论文 / 算力 / 测试 / 评审；新功能见「更多」，具身阶段另有「素体」。实际时钟见「时钟与团队」页。",
        "<b>V1 教学开局</b>：<b>「招聘」录用首位工程师 → 「算力」买 GPU → 「立项」开工</b>。数据与后训练工程师随后按到岗节拍加入，必要操作没完成前时间会暂停。"
      ],
      "ver": "V1"
    },
    {
      "id": "t_recruit",
      "phase": "office",
      "modal": "recruit",
      "title": "招人",
      "lines": [
        "基础岗位各有分工：<b>预训练工程师</b>产出代码/文字，<b>数据工程师</b>补语料并贡献文字，<b>后训练工程师</b>产出安全/稳定。具身阶段还会开放<b>具身智能工程师</b>，训练物理认知与灵巧操控。词条等级影响产出。",
        "<b>V1 教学先录用预训练工程师</b>，数据与后训练工程师随后按到岗节拍自动加入；无空座时要先腾位置。之后想加人走「扩编」，新录用者的到岗状态以团队页为准。",
        "招人付月薪（每 <b>4 周</b>发一次），办公室座位数是人数上限。经费不够发工资会欠薪，人会跑。"
      ],
      "ver": "V1"
    },
    {
      "id": "t_buygpu",
      "phase": "office",
      "modal": "shop",
      "title": "买算力",
      "lines": [
        "<b>V1 教学先买入门算力</b>。GPU 决定可训练参数上限，具体档位、阶段开放与最大规模以「算力」和「立项」面板为准。",
        "<b>没买算力工程师开不了工</b>，立项也会被拦。买完在「立项」里选目标参数——参数上限由算力决定，<b>语料门槛</b>也要满足才能立项。"
      ],
      "ver": "V1"
    },
    {
      "id": "t_direction",
      "phase": "office",
      "modal": "plan",
      "title": "立项",
      "lines": [
        "立项三件事：<b>架构 × 语料品质配比 × 参数规模</b>。架构的<b>语料门槛</b>会直接标在面板里，不足就先去「语料」补；普通、良好、优质语料的配比会影响训练。",
        "<b>V1 教学使用稠密架构</b>。后续架构按阶段开放，有的需要研读论文，有的需要批准团队提案；具体条件会标在架构卡上。",
        "语料曲线要盯紧：每周需求都在涨，周产量跟不上会红字提醒。",
        "<b>论文研究</b>免费，每次一篇，需要经营时间；完成后按论文卡获得永久效果，部分论文是后续架构的解锁条件。自研架构另需团队提案批准。",
        "<b>攻关</b>需先立项，满足当前组合的语料门槛并支付经费，临时提高选定方向的产出。费用与时长看攻关卡，同一时间只能开启一项；攻关不会直接增加工程师潜力或升级词条。"
      ],
      "ver": "V1"
    },
    {
      "id": "t_event",
      "event": true,
      "title": "遇到事件了",
      "lines": [
        "训练途中会出现事件，选项效果和代价以事件面板为准；有些只是通知。<b>暂停型事件</b>会暂停经营时间，不暂停的通知仍会继续计时。",
        "补语料要同时看<b>数量和品质</b>。新增低品质语料可能稀释平均品质，评审的品质加成取决于实际平均品质档位。",
        "体力充足且本阶段仍有词条升级空间时，可能触发<b>灵感迸发</b>：消耗体力，为本次评审的词条升级概率加成。它与工程师的<b>短时产出爆发</b>是两种不同效果，具体见「工程师成长」页。",
        "<b>小游戏厅与数据巡检</b>是两套玩法。小游戏按评级结算，奖励受各自的游戏周、阶段额度及资源上限限制；额度用完仍可练习，但没有数值奖励。拯救大白饭在具身阶段开放，用于恢复小鲸鱼体力；数据巡检按当次题目结果结算。"
      ]
    },
    {
      "id": "t_review",
      "phase": "review",
      "title": "评审",
      "lines": [
        "评审是<b>总分制</b>：能力按当前架构、参数与阶段口径归一化，再按<b>实际权重</b>加权，加上<b>品质加成</b>。权重和优秀/顶尖线以评审报告为准。",
        "第 6 周训练周期结束后<b>由你决定何时发起评审</b>（左列「评审」→ 开始评审）——先看评审报告里的预估总评，觉得稳了再点。",
        "<b>V1 教学评审没有失败档</b>；优秀与顶尖还要同时满足总评线和防偏科条件。<b>评级与版本任务是两回事</b>：任务未完成会留在本阶段重训，经费与重训规则见对应说明页。",
        "<b>模型测试</b>是在训练中途聊天，不是评审。立项且模型已有能力或产出后开放；回复随模型表现变化，对话可解锁记事本内容。"
      ],
      "ver": "V1"
    },
    {
      "id": "t_axis",
      "phase": "office",
      "axis": true,
      "title": "追加能力轴",
      "lines": [
        "中后期除基础能力外，还会出现<b>追加能力轴</b>：记忆、推理、工具，以及具身阶段的<b>物理认知、灵巧操控</b>。具身阶段会合并展示部分基础能力。",
        "<b>每根轴独立判断</b>：只有架构、参数与该轴配置的阶段门槛满足时才激活；激活以后仍需工程师训练。当前各轴条件可在本页动态明细和立项架构卡查看。",
        "一台模型可以只激活<b>部分能力轴</b>。某根轴未出现，表示该轴的激活条件尚未满足；不等于其他轴也不存在。",
        "记忆由<b>数据工程师</b>贡献，推理由<b>后训练工程师</b>贡献；工具由两岗各自贡献，缺岗会少掉对应产出，<b>不保证恰好减半</b>。两根具身轴由具身智能工程师训练。",
        "能力轴会计入<b>当前阶段的评审权重</b>，实际配比见评审报告；不要按旧版本的固定百分比估算。漏练的能力会损失总评，防偏科条件也会影响优秀与顶尖。"
      ]
    }
  ],
  "START_WEEK": 0,
  "ENGINEER_TYPES": {
    "embodied": {
      "name": "具身智能",
      "icon": "🦾",
      "desc": "真实世界理解 / 机器人动作控制",
      "focus": "embodiedCognition,dexterousControl"
    },
    "pretrain": {
      "name": "预训练",
      "icon": "🧠",
      "desc": "大规模预训练 / 分布式训练",
      "focus": "params,code"
    },
    "post": {
      "name": "后训练",
      "icon": "🎯",
      "desc": "SFT 微调 / RLHF 对齐",
      "focus": "text,safety"
    },
    "data": {
      "name": "数据",
      "icon": "📚",
      "desc": "数据采集 / 清洗 / 安全审查",
      "focus": "text,safety"
    }
  },
  "TRAIT_BASE_SALARY": {
    "1": 90000,
    "2": 140000,
    "3": 210000,
    "4": 300000,
    "5": 420000
  },
  "HIRE_LV_RANGE_BY_VER": {
    "V1": {
      "max": 1,
      "lv": [
        1,
        0,
        0,
        0,
        0
      ]
    },
    "V1.5": {
      "max": 2,
      "lv": [
        1,
        1.5,
        0,
        0,
        0
      ]
    },
    "V2": {
      "max": 3,
      "lv": [
        1,
        1.6,
        2.4,
        0,
        0
      ]
    },
    "V2.5": {
      "max": 3,
      "lv": [
        1,
        1.8,
        2.8,
        0,
        0
      ]
    },
    "V3": {
      "max": 4,
      "lv": [
        1,
        1.8,
        3,
        4,
        0
      ]
    },
    "V3.5": {
      "max": 4,
      "lv": [
        1,
        1.8,
        3,
        4.5,
        0
      ]
    },
    "V4": {
      "max": 5,
      "lv": [
        1,
        1.8,
        3,
        5,
        6
      ]
    },
    "V4.5": {
      "max": 5,
      "lv": [
        1,
        1.6,
        2.6,
        4.5,
        7
      ]
    },
    "V5": {
      "max": 5,
      "lv": [
        1,
        1.6,
        2.6,
        4.5,
        7
      ]
    },
    "V5.5": {
      "max": 5,
      "lv": [
        1,
        1.6,
        2.6,
        4.5,
        7
      ]
    },
    "V6": {
      "max": 5,
      "lv": [
        1,
        1.6,
        2.6,
        4.5,
        7
      ]
    },
    "V6.5": {
      "max": 5,
      "lv": [
        1,
        1.6,
        2.6,
        4.5,
        7
      ]
    }
  },
  "RECRUIT_COST": 30000,
  "CANDIDATE_TTL_WEEKS": 2,
  "CANDIDATE_LOCK_WEEKS": 8,
  "TRAIT_TYPES": [
    "pretrain",
    "post",
    "academic",
    "data",
    "embodied"
  ],
  "TRAIT_META": {
    "pretrain": {
      "name": "预训练",
      "axes": []
    },
    "post": {
      "name": "后训练",
      "axes": [
        "reasoning",
        "tool"
      ]
    },
    "academic": {
      "name": "学术",
      "axes": []
    },
    "data": {
      "name": "数据",
      "axes": [
        "memory",
        "tool"
      ]
    },
    "embodied": {
      "name": "具身智能",
      "axes": [
        "embodiedCognition",
        "dexterousControl"
      ]
    }
  },
  "AXIS_TRAIT_TIERS": {
    "memory": [
      [
        1,
        2
      ],
      [
        2,
        4
      ],
      [
        3,
        6
      ],
      [
        4,
        8
      ],
      [
        5,
        12
      ]
    ],
    "reasoning": [
      [
        1,
        2
      ],
      [
        2,
        3
      ],
      [
        3,
        5
      ],
      [
        5,
        8
      ],
      [
        8,
        12
      ]
    ],
    "tool": [
      [
        1,
        1
      ],
      [
        1,
        2
      ],
      [
        2,
        3
      ],
      [
        3,
        5
      ],
      [
        5,
        8
      ]
    ],
    "embodiedCognition": [
      [
        1,
        2
      ],
      [
        2,
        4
      ],
      [
        3,
        6
      ],
      [
        4,
        8
      ],
      [
        5,
        12
      ]
    ],
    "dexterousControl": [
      [
        1,
        2
      ],
      [
        2,
        4
      ],
      [
        3,
        6
      ],
      [
        4,
        8
      ],
      [
        5,
        12
      ]
    ]
  },
  "TRAIT_UPGRADE": {
    "MIN_STAT": 70,
    "traits": {
      "pretrain": {
        "stats": [
          "algo"
        ],
        "div": [
          900,
          1200,
          1500,
          1800
        ]
      },
      "post": {
        "stats": [
          "algo"
        ],
        "div": [
          900,
          1200,
          1500,
          1800
        ]
      },
      "data": {
        "stats": [
          "code",
          "text"
        ],
        "div": [
          900,
          1200,
          1500,
          1800
        ]
      },
      "embodied": {
        "stats": [
          "algo",
          "engineering"
        ],
        "div": [
          900,
          1200,
          1500,
          1800
        ]
      }
    },
    "ACADEMIC_BOOST": [
      0.02,
      0.05,
      0.08,
      0.12,
      0.15
    ]
  },
  "TIER_THRESHOLDS": [
    60,
    70,
    80,
    90
  ],
  "TIER_COLORS": {
    "gray": {
      "name": "一般",
      "cls": "t-gray"
    },
    "blue": {
      "name": "良好",
      "cls": "t-blue"
    },
    "pink": {
      "name": "优秀",
      "cls": "t-pink"
    },
    "orange": {
      "name": "天才",
      "cls": "t-orange"
    },
    "rainbow": {
      "name": "大牛",
      "cls": "t-rainbow"
    }
  },
  "TALENT_LV_CAP": {
    "gray": 3,
    "blue": 3,
    "pink": 4,
    "orange": 5,
    "rainbow": 5
  },
  "HIRE_FLOAT": 6,
  "WAIT_RECRUIT_PROB": 0.8,
  "RECRUIT_WAIT_EVENT": {
    "no": 1038,
    "key": "E101",
    "type": "recruit_wait",
    "uiType": "fixed",
    "title": "等待招聘",
    "desc": "我们发布了新的招聘启事，HR 正在筛选简历。一周后，新的简历送到了您桌上。",
    "options": [
      {
        "text": "好的，看看新候选人",
        "effects": {
          "time_cost": 1
        }
      }
    ]
  },
  "STAGE_TRAIT_MAX": {
    "V1": 1,
    "V1.5": 1,
    "V2": 2,
    "V2.5": 2,
    "V3": 3,
    "V3.5": 3,
    "V4": 5,
    "V4.5": 5,
    "V5": 5,
    "V5.5": 5,
    "V6": 5,
    "V6.5": 5
  },
  "V1_STARTERS": [
    2047,
    2048,
    2049
  ],
  "V1_STARTER_TEXT": "老板，有三位名校毕业生想要加入咱们的项目，这是他们的简历，您过目一下。（温馨提示：项目初始经费有限，三位都自愿降低了薪资。预训练工程师即刻到岗，数据工程师第 2 周、后训练工程师第 4 周到岗——一口气招齐，别错过这个好机会。）",
  "TRAIN_ANIM_MS": 3000,
  "TRAIN_PORT_MS": 1500,
  "SPARK_PROB": 0.4,
  "SPARK_MAX": 2,
  "SPARK_BONUS": 0.25,
  "TRAIN_SKIP_VERSIONS": [
    "V2",
    "V3",
    "V4"
  ],
  "TRAIN_TIMELINE": {
    "startDate": "2023-06-26",
    "windowMonths": 6
  },
  "ENG_STATUS": {
    "ENERGY_INIT": 100,
    "ENERGY_RECOVER": 12,
    "ENERGY_DECAY": 8,
    "LOW_ENERGY": 30,
    "LOW_ENERGY_PENALTY": 0.9,
    "WARN_ENERGY": 50
  },
  "FIRE": {
    "SEVERANCE_MUL": 2,
    "MIN_KEEP": 1
  },
  "IMAGE_LOADING": {
    "RETRIES": 3,
    "RETRY_DELAY_MS": 600,
    "TIMEOUT_MS": 12000,
    "DECODE_TIMEOUT_MS": 2000,
    "UI": {
      "LOADING": "图片加载中…",
      "RETRY": "重试图片",
      "FAILED": "图片暂未加载，点击重试"
    }
  },
  "CLOUD_SAVE": {
    "UI": {
      "PROTECTED": "发现旧云档，自动同步已暂停。请先读取云端存档；如需替换，请手动上传并确认。",
      "CONFIRM_TITLE": "覆盖旧云存档？",
      "CONFIRM_BODY": "云端已有旧存档。继续将用当前本机进度覆盖它，旧云档将被替换。建议先读取云端存档，确认不需要旧进度后再覆盖。",
      "CONFIRM_BUTTON": "确认覆盖"
    }
  },
  "CUR_VERSION": "V1",
  "BAILOUT": {
    "DEFAULT_EVENT": "V35_BAILOUT",
    "DEFAULT_USED_FLAG": "bailoutUsed",
    "DEFAULT_FUNDING": 2000000,
    "COOLDOWN_WEEKS": 8,
    "EVENT_BY_VER": {
      "V5": "V5_BAILOUT",
      "V5.5": "V5_BAILOUT",
      "V6": "V5_BAILOUT",
      "V6.5": "V5_BAILOUT"
    }
  },
  "VER_ORDER": [
    "V1",
    "V1.5",
    "V2",
    "V2.5",
    "V3",
    "V3.5",
    "V4",
    "V4.5",
    "V5",
    "V5.5",
    "V6",
    "V6.5"
  ],
  "DEBUG": {
    "FORCE_BANKRUPT": false,
    "FORCE_BANKRUPT_WEEK": 2
  },
  "USER_GAIN_MUL_BY_VER": {
    "V1": 20,
    "V1.5": 35,
    "V2": 60,
    "V2.5": 90,
    "V3": 12000,
    "V3.5": 16000,
    "V4": 20000,
    "V4.5": 26000,
    "V5": 32000,
    "V5.5": 40000,
    "V6": 40000,
    "V6.5": 40000
  },
  "RANK_BOARD_BY_VER": {
    "V1": [
      {
        "name": "Aurora-X",
        "meta": "海外头部大模型",
        "score": 65.8
      },
      {
        "name": "Nimbus-Pro",
        "meta": "多模态旗舰",
        "score": 63.7
      },
      {
        "name": "Cobalt-L",
        "meta": "开源强劲对手",
        "score": 61.6
      },
      {
        "name": "MistFlow",
        "meta": "轻量高性价比",
        "score": 59.5
      },
      {
        "name": "Sable-U",
        "meta": "研究院系旗舰",
        "score": 57.4
      },
      {
        "name": "Halo-7B",
        "meta": "国民应用厂",
        "score": 55.2
      },
      {
        "name": "Vertex-M",
        "meta": "创业新锐",
        "score": 53.1
      },
      {
        "name": "Quark-Mini",
        "meta": "端侧黑马",
        "score": 51
      },
      {
        "name": "Pico-1",
        "meta": "开源小模型",
        "score": 48.9
      },
      {
        "name": "Nano-Bit",
        "meta": "校园团队作品",
        "score": 46.8
      }
    ],
    "V1.5": [
      {
        "name": "Aurora-X",
        "meta": "海外头部大模型",
        "score": 104
      },
      {
        "name": "Nimbus-Pro",
        "meta": "多模态旗舰",
        "score": 103.9
      },
      {
        "name": "Cobalt-L",
        "meta": "开源强劲对手",
        "score": 103.8
      },
      {
        "name": "MistFlow",
        "meta": "轻量高性价比",
        "score": 103.7
      },
      {
        "name": "Sable-U",
        "meta": "研究院系旗舰",
        "score": 103.6
      },
      {
        "name": "Halo-7B",
        "meta": "国民应用厂",
        "score": 103.4
      },
      {
        "name": "Vertex-M",
        "meta": "创业新锐",
        "score": 103.3
      },
      {
        "name": "Quark-Mini",
        "meta": "端侧黑马",
        "score": 103.2
      },
      {
        "name": "Pico-1",
        "meta": "开源小模型",
        "score": 103.1
      },
      {
        "name": "Nano-Bit",
        "meta": "校园团队作品",
        "score": 103
      }
    ],
    "V2": [
      {
        "name": "Aurora-X",
        "meta": "海外头部大模型",
        "score": 156.2
      },
      {
        "name": "Nimbus-Pro",
        "meta": "多模态旗舰",
        "score": 154.2
      },
      {
        "name": "Cobalt-L",
        "meta": "开源强劲对手",
        "score": 152.1
      },
      {
        "name": "MistFlow",
        "meta": "轻量高性价比",
        "score": 150.1
      },
      {
        "name": "Sable-U",
        "meta": "研究院系旗舰",
        "score": 148.1
      },
      {
        "name": "Halo-7B",
        "meta": "国民应用厂",
        "score": 146
      },
      {
        "name": "Vertex-M",
        "meta": "创业新锐",
        "score": 144
      },
      {
        "name": "Quark-Mini",
        "meta": "端侧黑马",
        "score": 142
      },
      {
        "name": "Pico-1",
        "meta": "开源小模型",
        "score": 140
      },
      {
        "name": "Nano-Bit",
        "meta": "校园团队作品",
        "score": 138
      }
    ],
    "V2.5": [
      {
        "name": "Aurora-X",
        "meta": "海外头部大模型",
        "score": 265.4
      },
      {
        "name": "Nimbus-Pro",
        "meta": "多模态旗舰",
        "score": 259.4
      },
      {
        "name": "Cobalt-L",
        "meta": "开源强劲对手",
        "score": 253.3
      },
      {
        "name": "MistFlow",
        "meta": "轻量高性价比",
        "score": 247.2
      },
      {
        "name": "Sable-U",
        "meta": "研究院系旗舰",
        "score": 241.2
      },
      {
        "name": "Halo-7B",
        "meta": "国民应用厂",
        "score": 235.2
      },
      {
        "name": "Vertex-M",
        "meta": "创业新锐",
        "score": 229.2
      },
      {
        "name": "Quark-Mini",
        "meta": "端侧黑马",
        "score": 223.1
      },
      {
        "name": "Pico-1",
        "meta": "开源小模型",
        "score": 217
      },
      {
        "name": "Nano-Bit",
        "meta": "校园团队作品",
        "score": 211
      }
    ],
    "V3": [
      {
        "name": "Aurora-X",
        "meta": "海外头部大模型",
        "score": 366.2
      },
      {
        "name": "Nimbus-Pro",
        "meta": "多模态旗舰",
        "score": 363.2
      },
      {
        "name": "Cobalt-L",
        "meta": "开源强劲对手",
        "score": 360.3
      },
      {
        "name": "Oracle-R",
        "meta": "推理新贵",
        "score": 357.2
      },
      {
        "name": "Titan-o",
        "meta": "推理模型",
        "score": 354.3
      },
      {
        "name": "MistFlow",
        "meta": "轻量高性价比",
        "score": 351.3
      },
      {
        "name": "Sable-U",
        "meta": "研究院系旗舰",
        "score": 348.4
      },
      {
        "name": "Halo-7B",
        "meta": "国民应用厂",
        "score": 345.4
      },
      {
        "name": "Vertex-M",
        "meta": "创业新锐",
        "score": 342.4
      },
      {
        "name": "Quark-Mini",
        "meta": "端侧黑马",
        "score": 339.4
      }
    ],
    "V3.5": [
      {
        "name": "Aurora-X",
        "meta": "海外头部大模型",
        "score": 559.5
      },
      {
        "name": "Nimbus-Pro",
        "meta": "多模态旗舰",
        "score": 545.8
      },
      {
        "name": "Oracle-R",
        "meta": "推理新贵",
        "score": 532
      },
      {
        "name": "Cobalt-L",
        "meta": "开源强劲对手",
        "score": 518.2
      },
      {
        "name": "Titan-o",
        "meta": "推理模型",
        "score": 504.5
      },
      {
        "name": "MistFlow",
        "meta": "轻量高性价比",
        "score": 490.7
      },
      {
        "name": "Sable-U",
        "meta": "研究院系旗舰",
        "score": 476.9
      },
      {
        "name": "Halo-7B",
        "meta": "国民应用厂",
        "score": 463.2
      },
      {
        "name": "Vertex-M",
        "meta": "创业新锐",
        "score": 449.4
      },
      {
        "name": "Quark-Mini",
        "meta": "端侧黑马",
        "score": 435.6
      }
    ],
    "V4": [
      {
        "name": "Aurora-X",
        "meta": "海外头部大模型",
        "score": 717.2
      },
      {
        "name": "Nimbus-Pro",
        "meta": "多模态旗舰",
        "score": 706.9
      },
      {
        "name": "Oracle-R",
        "meta": "推理新贵",
        "score": 696.6
      },
      {
        "name": "Titan-o",
        "meta": "推理模型",
        "score": 686.3
      },
      {
        "name": "Cobalt-L",
        "meta": "开源强劲对手",
        "score": 676
      },
      {
        "name": "MistFlow",
        "meta": "轻量高性价比",
        "score": 665.5
      },
      {
        "name": "Sable-U",
        "meta": "研究院系旗舰",
        "score": 655.2
      },
      {
        "name": "Halo-7B",
        "meta": "国民应用厂",
        "score": 644.9
      },
      {
        "name": "Vertex-M",
        "meta": "创业新锐",
        "score": 634.6
      },
      {
        "name": "Quark-Mini",
        "meta": "端侧黑马",
        "score": 624.3
      }
    ],
    "V4.5": [
      {
        "name": "Aurora-X",
        "meta": "海外头部大模型",
        "score": 918.4
      },
      {
        "name": "Nimbus-Pro",
        "meta": "多模态旗舰",
        "score": 897.8
      },
      {
        "name": "Oracle-R",
        "meta": "推理新贵",
        "score": 877
      },
      {
        "name": "Titan-o",
        "meta": "推理模型",
        "score": 856.4
      },
      {
        "name": "Cobalt-L",
        "meta": "开源强劲对手",
        "score": 835.8
      },
      {
        "name": "MistFlow",
        "meta": "轻量高性价比",
        "score": 815
      },
      {
        "name": "Sable-U",
        "meta": "研究院系旗舰",
        "score": 794.4
      },
      {
        "name": "Halo-7B",
        "meta": "国民应用厂",
        "score": 773.8
      },
      {
        "name": "Vertex-M",
        "meta": "创业新锐",
        "score": 753.1
      },
      {
        "name": "Quark-Mini",
        "meta": "端侧黑马",
        "score": 732.5
      }
    ],
    "V5": [],
    "V5.5": [],
    "V6": [],
    "V6.5": []
  },
  "USER_FEEDBACK": {
    "praise": {
      "code": [
        {
          "n": "后端老张",
          "t": "代码补全又快又准，接口一次跑通，团队效率肉眼可见地翻倍。"
        },
        {
          "n": "全栈阿凯",
          "t": "复杂逻辑也能稳定输出，注释清楚，接手的人一看就懂。"
        },
        {
          "n": "极客小林",
          "t": "让它重构祖传代码，改完连测试同学都来问是用了什么黑科技。"
        }
      ],
      "text": [
        {
          "n": "文案阿茶",
          "t": "文案生成很有灵气，几乎不用大改，已经安利给整个工作室。"
        },
        {
          "n": "编剧小满",
          "t": "长文案的连贯性超出预期，人设不崩、语气稳定，太好用了。"
        },
        {
          "n": "运营老宋",
          "t": "活动 slogan 一秒十条，条条能直接上线，甲方都夸有网感。"
        }
      ],
      "safety": [
        {
          "n": "安全老周",
          "t": "诱导问题基本都接得住，拒绝话术得体不生硬，放心接入了。"
        },
        {
          "n": "审计老郑",
          "t": "敏感内容过滤很稳，红队测了一轮没打出大问题。"
        },
        {
          "n": "护网小骑士",
          "t": "合规审查一次过，法务看完报告直接盖章。"
        }
      ],
      "stability": [
        {
          "n": "运维老杨",
          "t": "高峰期压测没掉过链子，响应延迟稳得像刻在石头上。"
        },
        {
          "n": "SRE大熊",
          "t": "连续跑了一个月没出过幺蛾子，告警群都安静了。"
        },
        {
          "n": "测开小鹿",
          "t": "边界输入随便喂，输出始终稳定，回归测试省了一半时间。"
        }
      ]
    },
    "improve": {
      "code": [
        {
          "n": "后端老张",
          "t": "复杂场景偶尔会自作主张，希望能加个方案确认步骤。"
        },
        {
          "n": "全栈阿凯",
          "t": "生成长事务代码时偶尔漏掉回滚逻辑，边界处理还得练。"
        }
      ],
      "text": [
        {
          "n": "文案阿茶",
          "t": "长文本写多了会渐渐跑题，希望收尾能力再加强一点。"
        },
        {
          "n": "编剧小满",
          "t": "对话体偶尔千人一面，不同角色的口癖分得不够开。"
        }
      ],
      "safety": [
        {
          "n": "安全老周",
          "t": "多轮诱导下偶尔会被套出边缘内容，攻防还得继续。"
        },
        {
          "n": "审计老郑",
          "t": "拦截日志不够透明，希望给出更详细的拒绝原因。"
        }
      ],
      "stability": [
        {
          "n": "运维老杨",
          "t": "流量突增时会短暂变慢，希望扩容响应再快一些。"
        },
        {
          "n": "SRE大熊",
          "t": "极端并发下偶尔超时，长连接保活策略可以再优化。"
        }
      ]
    },
    "generic": [
      {
        "n": "路过的产品经理",
        "t": "整体已经很好用了，期待下一个版本更惊艳。"
      },
      {
        "n": "深夜冲浪选手",
        "t": "偶尔答非所问，但瑕不掩瑜，继续冲！"
      }
    ]
  },
  "TRAIN_STAGES": {
    "V1": "版本 V1（当前正式版）",
    "V2": "版本 V2",
    "V3": "版本 V3",
    "V4": "版本 V4",
    "V5": "V5 · 小女孩体型 · 初次感知世界",
    "V5.5": "V5.5 · 成长少女体型 · 学习与生活",
    "V6": "V6 · 少女体型 · 独立走进社会",
    "V6.5": "V6.5 · 成熟少女体型 · 走向完整的一生"
  },
  "ENGINEERS": [
    {
      "no": 2001,
      "key": "eng_42",
      "name": "顾南舟",
      "gender": "男",
      "age": 22,
      "edu": "学士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        },
        {
          "type": "post",
          "level": 1
        }
      ],
      "salary": 143685,
      "energy": 100,
      "stats": {
        "algo": 73,
        "code": 64,
        "text": 68
      },
      "resume": {
        "univ": "广南理工大学 计算机系（本科在读，已保研）",
        "exp": "大三就在开源社区发过一份被转发上千次的预训练复现笔记。没在大厂待过一天，但聊起 scaling law 比很多工作五年的人还清楚。缺点是——他真的没工作过。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 132,
      "avatar": "resource/ui/avatar_132.webp"
    },
    {
      "no": 2002,
      "key": "eng_11",
      "name": "陆轻舟",
      "gender": "男",
      "age": 27,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 131320,
      "energy": 100,
      "stats": {
        "algo": 65,
        "code": 59,
        "text": 52
      },
      "resume": {
        "univ": "北华大学计算机硕士",
        "exp": "高校 NLP 实验室助理，发过一篇 ACL 短文，算法中规中矩，学术潜力初显。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 133,
      "avatar": "resource/ui/avatar_133.webp"
    },
    {
      "no": 2003,
      "key": "eng_45",
      "name": "周砚清",
      "gender": "男",
      "age": 25,
      "edu": "学士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 129875,
      "energy": 100,
      "stats": {
        "algo": 64,
        "code": 50,
        "text": 54
      },
      "resume": {
        "univ": "南屏工业大学 计算机系（本科）",
        "exp": "毕业后在一家外包公司做了两年推荐系统调参，流程熟、能干活，但对底层原理说不出所以然。踏实，不挑活。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 134,
      "avatar": "resource/ui/avatar_134.webp"
    },
    {
      "no": 2004,
      "key": "eng_43",
      "name": "苏见微",
      "gender": "女",
      "age": 23,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 131320,
      "energy": 100,
      "stats": {
        "code": 68,
        "text": 62,
        "algo": 57
      },
      "resume": {
        "univ": "汉江大学 统计学硕士",
        "exp": "毕业论文做的是中文语料去重与质量打分，自己写了一套标注工具在实验室用了两年。看数据有种近乎苛刻的洁癖，常为了 0.3% 的脏数据熬夜。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 100,
      "avatar": "resource/ui/avatar_100.webp"
    },
    {
      "no": 2005,
      "key": "eng_09",
      "name": "温言",
      "gender": "女",
      "age": 25,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        },
        {
          "type": "post",
          "level": 1
        }
      ],
      "salary": 129875,
      "energy": 100,
      "stats": {
        "code": 67,
        "text": 61,
        "algo": 59
      },
      "resume": {
        "univ": "北华大学新闻学学士",
        "exp": "新闻系转 NLP，前审核标注组长，精通标注规范，文字功底好，数据敏感度在同龄人中拔尖。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 101,
      "avatar": "resource/ui/avatar_101.webp"
    },
    {
      "no": 2006,
      "key": "eng_13",
      "name": "唐小满",
      "gender": "女",
      "age": 23,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 128453,
      "energy": 100,
      "stats": {
        "code": 66,
        "text": 60,
        "algo": 54
      },
      "resume": {
        "univ": "海蓝大学数据科学学士（应届）",
        "exp": "应届生，标注质检准确率 99.2%，精力旺盛、成长空间大，数据清洗的好苗子。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 102,
      "avatar": "resource/ui/avatar_102.webp"
    },
    {
      "no": 2007,
      "key": "eng_44",
      "name": "林知返",
      "gender": "男",
      "age": 24,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 2
        },
        {
          "type": "data",
          "level": 1
        }
      ],
      "salary": 128453,
      "energy": 100,
      "stats": {
        "algo": 67,
        "code": 63,
        "text": 59
      },
      "resume": {
        "univ": "京北大学 语言学硕士",
        "exp": "原本研究句法学，后来迷上了对齐。擅长把「说不清哪里别扭」的 bad case 拆成可标注的维度，被导师称为「人肉 reward model」。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 135,
      "avatar": "resource/ui/avatar_135.webp"
    },
    {
      "no": 2008,
      "key": "eng_46",
      "name": "沈书白",
      "gender": "女",
      "age": 24,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 109805,
      "energy": 100,
      "stats": {
        "algo": 52,
        "code": 48,
        "text": 44
      },
      "resume": {
        "univ": "同舟大学 应用心理硕士",
        "exp": "做过两年用户研究，转行做数据标注规范。最擅长的是「猜用户到底想问什么」，写的评测集在内部盲测里排第一。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 103,
      "avatar": "resource/ui/avatar_103.webp"
    },
    {
      "no": 2009,
      "key": "eng_14",
      "name": "方既明",
      "gender": "男",
      "age": 30,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 110891,
      "energy": 100,
      "stats": {
        "algo": 53,
        "code": 49,
        "text": 45
      },
      "resume": {
        "univ": "金陵大学心理学硕士",
        "exp": "心理学转行 NLP，擅长提示词与对齐数据设计，协作顺畅，理解用户心理是独特优势。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 136,
      "avatar": "resource/ui/avatar_136.webp"
    },
    {
      "no": 2010,
      "key": "eng_06",
      "name": "赵之遥",
      "gender": "男",
      "age": 31,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 3
        },
        {
          "type": "data",
          "level": 1
        }
      ],
      "salary": 169697,
      "energy": 100,
      "stats": {
        "algo": 51,
        "code": 38,
        "text": 42
      },
      "resume": {
        "univ": "南方工科大学软件工程硕士",
        "exp": "大厂 NLP 数据组三年，万亿 token 语料治理与去重，预训练经验扎实但算法天赋平平、精力一般，属于「稳但不惊艳」的老实人。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 137,
      "avatar": "resource/ui/avatar_137.webp"
    },
    {
      "no": 2011,
      "key": "eng_36",
      "name": "沈星澜",
      "gender": "女",
      "age": 29,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 3
        },
        {
          "type": "post",
          "level": 1
        }
      ],
      "salary": 168000,
      "energy": 100,
      "stats": {
        "algo": 50,
        "code": 36,
        "text": 40
      },
      "resume": {
        "univ": "东海大学计算机硕士",
        "exp": "大厂预训练组两年，负责过 7B 模型数据配比，稳扎稳打，预训练流程熟练。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 104,
      "avatar": "resource/ui/avatar_104.webp"
    },
    {
      "no": 2012,
      "key": "eng_24",
      "name": "宋知遥",
      "gender": "男",
      "age": 29,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 176747,
      "energy": 100,
      "stats": {
        "algo": 91,
        "code": 76,
        "text": 80
      },
      "resume": {
        "univ": "北方工业大学计算机硕士",
        "exp": "预训练与学术并重，发表 NeurIPS 一作一篇，算法天赋优秀。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 138,
      "avatar": "resource/ui/avatar_138.webp"
    },
    {
      "no": 2013,
      "key": "eng_23",
      "name": "阮清和",
      "gender": "女",
      "age": 28,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 3
        },
        {
          "type": "post",
          "level": 1
        }
      ],
      "salary": 168000,
      "energy": 100,
      "stats": {
        "code": 53,
        "text": 47,
        "algo": 45
      },
      "resume": {
        "univ": "南方工科大学软件工程硕士",
        "exp": "多模态数据标注体系搭建者，文字与代码双修，数据质量把控精准。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 105,
      "avatar": "resource/ui/avatar_105.webp"
    },
    {
      "no": 2014,
      "key": "eng_37",
      "name": "许惊蛰",
      "gender": "女",
      "age": 27,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 159309,
      "energy": 100,
      "stats": {
        "code": 85,
        "text": 79,
        "algo": 76
      },
      "resume": {
        "univ": "中南理工大学计算机硕士",
        "exp": "语料安全审查组长，过滤有害样本的经验丰富，数据+安全双修，值得信赖。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 106,
      "avatar": "resource/ui/avatar_106.webp"
    },
    {
      "no": 2015,
      "key": "eng_08",
      "name": "顾星眠",
      "gender": "女",
      "age": 26,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        }
      ],
      "salary": 157483,
      "energy": 100,
      "stats": {
        "code": 84,
        "text": 78,
        "algo": 71
      },
      "resume": {
        "univ": "东海理工大学计算机硕士",
        "exp": "专注多语种语料建设两年，构建三语清洗流水线，代码文字双修，数据方向的中坚力量。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 107,
      "avatar": "resource/ui/avatar_107.webp"
    },
    {
      "no": 2016,
      "key": "eng_10",
      "name": "沈亦舟",
      "gender": "男",
      "age": 29,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 3
        },
        {
          "type": "data",
          "level": 1
        }
      ],
      "salary": 166337,
      "energy": 100,
      "stats": {
        "algo": 53,
        "code": 49,
        "text": 45
      },
      "resume": {
        "univ": "江南大学 NLP 硕士",
        "exp": "大厂 SFT 流水线三年，写过两万条高质量样本，文字扎实但算法一般。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 139,
      "avatar": "resource/ui/avatar_139.webp"
    },
    {
      "no": 2017,
      "key": "eng_18",
      "name": "白鹭",
      "gender": "女",
      "age": 29,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 145331,
      "energy": 100,
      "stats": {
        "algo": 78,
        "code": 74,
        "text": 70
      },
      "resume": {
        "univ": "东海大学自然语言处理硕士",
        "exp": "硅谷对齐团队实习后独立完成多个垂直领域 SFT，复合背景，性价比高。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 108,
      "avatar": "resource/ui/avatar_108.webp"
    },
    {
      "no": 2018,
      "key": "eng_22",
      "name": "姜未央",
      "gender": "女",
      "age": 32,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 143685,
      "energy": 100,
      "stats": {
        "algo": 77,
        "code": 73,
        "text": 69
      },
      "resume": {
        "univ": "东海大学人工智能博士",
        "exp": "顶会 RLHF 论文三篇，奖励模型设计经验丰富，学术与对齐双修。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 109,
      "avatar": "resource/ui/avatar_109.webp"
    },
    {
      "no": 2019,
      "key": "eng_17",
      "name": "段云帆",
      "gender": "男",
      "age": 27,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 3
        },
        {
          "type": "post",
          "level": 2
        }
      ],
      "salary": 176820,
      "energy": 100,
      "stats": {
        "algo": 55,
        "code": 41,
        "text": 45
      },
      "resume": {
        "univ": "北方工业大学计算机硕士",
        "exp": "大模型实验室，带队完成 34B 完整预训练，checkpoint 体系专家，能扛事。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 140,
      "avatar": "resource/ui/avatar_140.webp"
    },
    {
      "no": 2020,
      "key": "eng_19",
      "name": "许星野",
      "gender": "男",
      "age": 31,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 3
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 174989,
      "energy": 100,
      "stats": {
        "algo": 54,
        "code": 47,
        "text": 40
      },
      "resume": {
        "univ": "北华大学计算机博士",
        "exp": "参与 70B 预训练数据配比，scaling law 实验一把好手，算法天赋出众。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 141,
      "avatar": "resource/ui/avatar_141.webp"
    },
    {
      "no": 2021,
      "key": "eng_47",
      "name": "宋问渠",
      "gender": "男",
      "age": 30,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 3
        },
        {
          "type": "data",
          "level": 1
        }
      ],
      "salary": 174989,
      "energy": 100,
      "stats": {
        "algo": 54,
        "code": 43,
        "text": 47
      },
      "resume": {
        "univ": "天泽大学 计算机应用博士",
        "exp": "博士课题是低资源场景下的持续预训练，做过三轮从零到一的小模型。不算聪明，但极能熬——他调过的学习率曲线摞起来比论文还厚。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 142,
      "avatar": "resource/ui/avatar_142.webp"
    },
    {
      "no": 2022,
      "key": "eng_39",
      "name": "沈砚",
      "gender": "男",
      "age": 32,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 3
        },
        {
          "type": "post",
          "level": 1
        }
      ],
      "salary": 174989,
      "energy": 100,
      "stats": {
        "code": 57,
        "text": 51,
        "algo": 41
      },
      "resume": {
        "univ": "东海大学计算机博士",
        "exp": "语料版权合规与安全审查权威，万亿 token 治理经验，数据+安全双料专家。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 143,
      "avatar": "resource/ui/avatar_143.webp"
    },
    {
      "no": 2023,
      "key": "eng_20",
      "name": "秦疏影",
      "gender": "女",
      "age": 30,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 3
        }
      ],
      "salary": 173191,
      "energy": 100,
      "stats": {
        "code": 56,
        "text": 50,
        "algo": 47
      },
      "resume": {
        "univ": "东海大学计算机硕士",
        "exp": "数据平台负责人，主导 5000 亿 token 语料池治理体系，代码文字双优。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 110,
      "avatar": "resource/ui/avatar_110.webp"
    },
    {
      "no": 2024,
      "key": "eng_34",
      "name": "江晚吟",
      "gender": "女",
      "age": 35,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 3
        },
        {
          "type": "academic",
          "level": 2
        }
      ],
      "salary": 171427,
      "energy": 100,
      "stats": {
        "code": 55,
        "text": 49,
        "algo": 38
      },
      "resume": {
        "univ": "东海大学计算机博士",
        "exp": "语料版权合规与质量评估权威，多语言数据专家，数据+安全双修。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 111,
      "avatar": "resource/ui/avatar_111.webp"
    },
    {
      "no": 2025,
      "key": "eng_16",
      "name": "何栖迟",
      "gender": "女",
      "age": 33,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 3
        },
        {
          "type": "academic",
          "level": 2
        }
      ],
      "salary": 173191,
      "energy": 100,
      "stats": {
        "algo": 57,
        "code": 53,
        "text": 49
      },
      "resume": {
        "univ": "金陵大学人工智能博士",
        "exp": "研究院安全对齐组五年，主持红队测试与越狱攻防，文字协作双高，对齐方向定海神针。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 112,
      "avatar": "resource/ui/avatar_112.webp"
    },
    {
      "no": 2026,
      "key": "eng_38",
      "name": "闻人语",
      "gender": "女",
      "age": 31,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 3
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 171427,
      "energy": 100,
      "stats": {
        "algo": 56,
        "code": 52,
        "text": 48
      },
      "resume": {
        "univ": "金陵大学人工智能硕士",
        "exp": "指令遵循数据专家，SFT 样本质量评估体系构建者，文字功底深厚。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 113,
      "avatar": "resource/ui/avatar_113.webp"
    },
    {
      "no": 2027,
      "key": "eng_29",
      "name": "叶舟行",
      "gender": "男",
      "age": 34,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 3
        },
        {
          "type": "academic",
          "level": 2
        }
      ],
      "salary": 169697,
      "energy": 100,
      "stats": {
        "algo": 55,
        "code": 51,
        "text": 47
      },
      "resume": {
        "univ": "江南大学人工智能博士",
        "exp": "后训练方向顶级学者，指令遵循与 RLHF 双领域权威，文字顶级。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 144,
      "avatar": "resource/ui/avatar_144.webp"
    },
    {
      "no": 2028,
      "key": "eng_33",
      "name": "陆星河",
      "gender": "女",
      "age": 31,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 3
        },
        {
          "type": "academic",
          "level": 2
        }
      ],
      "salary": 169697,
      "energy": 100,
      "stats": {
        "algo": 55,
        "code": 51,
        "text": 47
      },
      "resume": {
        "univ": "金陵大学人工智能博士",
        "exp": "对齐评估体系构建者，安全与性能平衡大师，文字顶级、学术深厚。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 114,
      "avatar": "resource/ui/avatar_114.webp"
    },
    {
      "no": 2029,
      "key": "eng_27",
      "name": "林清源",
      "gender": "男",
      "age": 35,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 3
        },
        {
          "type": "academic",
          "level": 2
        }
      ],
      "salary": 244541,
      "energy": 100,
      "stats": {
        "algo": 84,
        "code": 73,
        "text": 77
      },
      "resume": {
        "univ": "北华大学计算机博士",
        "exp": "硅谷顶级大厂两年，主导多语言大模型预训练与 scaling law 实验，顶会数篇，算法行业天花板。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 145,
      "avatar": "resource/ui/avatar_145.webp"
    },
    {
      "no": 2030,
      "key": "eng_30",
      "name": "凌初霁",
      "gender": "女",
      "age": 33,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 3
        },
        {
          "type": "academic",
          "level": 2
        }
      ],
      "salary": 223037,
      "energy": 100,
      "stats": {
        "algo": 76,
        "code": 68,
        "text": 61
      },
      "resume": {
        "univ": "北华大学计算机博士",
        "exp": "预训练 scaling law 提出者团队核心，算法天赋行业天花板。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 115,
      "avatar": "resource/ui/avatar_115.webp"
    },
    {
      "no": 2031,
      "key": "eng_35",
      "name": "顾临渊",
      "gender": "男",
      "age": 36,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 3
        },
        {
          "type": "post",
          "level": 2
        }
      ],
      "salary": 201415,
      "energy": 100,
      "stats": {
        "algo": 67,
        "code": 58,
        "text": 62
      },
      "resume": {
        "univ": "北华大学计算机博士",
        "exp": "百亿参数预训练操盘手，loss 曲线诊断大师，算法顶级。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 146,
      "avatar": "resource/ui/avatar_146.webp"
    },
    {
      "no": 2032,
      "key": "eng_48",
      "name": "白露微",
      "gender": "女",
      "age": 33,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 3
        },
        {
          "type": "pretrain",
          "level": 2
        }
      ],
      "salary": 241735,
      "energy": 100,
      "stats": {
        "code": 86,
        "text": 80,
        "algo": 70
      },
      "resume": {
        "univ": "中岭大学 计算语言学博士",
        "exp": "主导过两个百亿 token 级中文语料的构建，对数据来源的合规性极其敏感——据说她曾经否决过一整批「效果很好但来路不明」的数据。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 116,
      "avatar": "resource/ui/avatar_116.webp"
    },
    {
      "no": 2033,
      "key": "eng_41",
      "name": "陆观澜",
      "gender": "男",
      "age": 37,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 3
        },
        {
          "type": "academic",
          "level": 2
        }
      ],
      "salary": 220500,
      "energy": 100,
      "stats": {
        "code": 78,
        "text": 72,
        "algo": 65
      },
      "resume": {
        "univ": "东海大学计算机博士",
        "exp": "语料安全审查与合规权威，全球多语言数据治理专家，数据+安全顶尖。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 147,
      "avatar": "resource/ui/avatar_147.webp"
    },
    {
      "no": 2034,
      "key": "eng_31",
      "name": "温既白",
      "gender": "男",
      "age": 36,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 3
        }
      ],
      "salary": 199181,
      "energy": 100,
      "stats": {
        "code": 69,
        "text": 63,
        "algo": 55
      },
      "resume": {
        "univ": "东海大学计算机博士",
        "exp": "万亿级语料工程总架构师，数据质量方法论开创者，数据+安全权威。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 148,
      "avatar": "resource/ui/avatar_148.webp"
    },
    {
      "no": 2035,
      "key": "eng_26",
      "name": "苏晚晴",
      "gender": "女",
      "age": 32,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 3
        },
        {
          "type": "academic",
          "level": 2
        }
      ],
      "salary": 220500,
      "energy": 100,
      "stats": {
        "algo": 79,
        "code": 75,
        "text": 71
      },
      "resume": {
        "univ": "东海大学 NLP 博士",
        "exp": "头部大厂对齐核心，一手主导 RLHF 奖励模型迭代，业内「对齐女王」，文字天赋顶级。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 117,
      "avatar": "resource/ui/avatar_117.webp"
    },
    {
      "no": 2036,
      "key": "eng_40",
      "name": "秦时月",
      "gender": "女",
      "age": 34,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 3
        },
        {
          "type": "data",
          "level": 2
        }
      ],
      "salary": 199181,
      "energy": 100,
      "stats": {
        "algo": 70,
        "code": 66,
        "text": 62
      },
      "resume": {
        "univ": "江南大学人工智能博士",
        "exp": "对齐评估体系奠基人，安全与性能平衡大师，文字顶级、精力略欠。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 118,
      "avatar": "resource/ui/avatar_118.webp"
    },
    {
      "no": 2037,
      "key": "eng_49",
      "name": "周斯年",
      "gender": "男",
      "age": 35,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 3
        }
      ],
      "salary": 199181,
      "energy": 100,
      "stats": {
        "algo": 70,
        "code": 66,
        "text": 62
      },
      "resume": {
        "univ": "京华师范大学 教育学博士",
        "exp": "在大厂做过四年内容与审核策略，处理过真实的舆情事故。经验极其丰富，但理论功底一般——他知道什么该删，不一定说得出为什么。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 149,
      "avatar": "resource/ui/avatar_149.webp"
    },
    {
      "no": 2038,
      "key": "eng_50",
      "name": "沈观星",
      "gender": "男",
      "age": 38,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 5
        },
        {
          "type": "post",
          "level": 2
        }
      ],
      "salary": 555240,
      "energy": 100,
      "stats": {
        "algo": 95,
        "code": 87,
        "text": 80
      },
      "resume": {
        "univ": "华清大学 计算数学博士 · 海外博后三年",
        "exp": "某大厂预训练负责人，带出过一代主力模型。离职原因对外只说「想做点别的」。他看过一眼我们的训练日志就说：「你这个 warmup 设错了。」——然后他是对的。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 150,
      "avatar": "resource/ui/avatar_150.webp"
    },
    {
      "no": 2039,
      "key": "eng_51",
      "name": "苏砚秋",
      "gender": "女",
      "age": 36,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 4
        }
      ],
      "salary": 392064,
      "energy": 100,
      "stats": {
        "algo": 94,
        "code": 85,
        "text": 89
      },
      "resume": {
        "univ": "中科技术大学 博士 · 留校任副教授两年后转业界",
        "exp": "既发得出论文也训得动千卡。她的特点是把每一笔实验都记得清清楚楚，三年后在旧笔记本里翻出来的结论，放到今天依然成立。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 119,
      "avatar": "resource/ui/avatar_119.webp"
    },
    {
      "no": 2040,
      "key": "eng_52",
      "name": "顾长风",
      "gender": "男",
      "age": 40,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 4
        }
      ],
      "salary": 353400,
      "energy": 100,
      "stats": {
        "algo": 85,
        "code": 79,
        "text": 72
      },
      "resume": {
        "univ": "复江大学 博士",
        "exp": "十五年工程经验，从推荐系统一路做到大模型。不是天赋最扎眼的那一档，但他训出来的模型没有一次在上线后崩过——稳，是他最贵的品质。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 151,
      "avatar": "resource/ui/avatar_151.webp"
    },
    {
      "no": 2041,
      "key": "eng_53",
      "name": "林听雪",
      "gender": "女",
      "age": 35,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 5
        },
        {
          "type": "pretrain",
          "level": 2
        }
      ],
      "salary": 506318,
      "energy": 100,
      "stats": {
        "code": 90,
        "text": 84,
        "algo": 77
      },
      "resume": {
        "univ": "汉江大学 博士",
        "exp": "中文互联网最大的开源对话数据集的实际构建者（对外署名不是她）。她能从一堆看起来一模一样的语料里，准确指出哪一批「味道不对」。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 120,
      "avatar": "resource/ui/avatar_120.webp"
    },
    {
      "no": 2042,
      "key": "eng_54",
      "name": "江予安",
      "gender": "女",
      "age": 37,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 4
        }
      ],
      "salary": 322296,
      "energy": 100,
      "stats": {
        "code": 80,
        "text": 74,
        "algo": 69
      },
      "resume": {
        "univ": "沪通大学 博士",
        "exp": "做过内容平台的数据中台负责人，管过 PB 级语料。擅长在预算有限时做出「够用」的数据方案，而不是「完美」的方案。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 121,
      "avatar": "resource/ui/avatar_121.webp"
    },
    {
      "no": 2043,
      "key": "eng_55",
      "name": "陈叙白",
      "gender": "男",
      "age": 39,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 4
        }
      ],
      "salary": 318624,
      "energy": 100,
      "stats": {
        "code": 79,
        "text": 73,
        "algo": 64
      },
      "resume": {
        "univ": "西京交通大学 博士",
        "exp": "从爬虫写到数据质量模型，全流程都自己干过。不是天赋最扎眼的那种，但这十年他处理的脏数据，比大多数人见过的都多。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 152,
      "avatar": "resource/ui/avatar_152.webp"
    },
    {
      "no": 2044,
      "key": "eng_56",
      "name": "温故知",
      "gender": "男",
      "age": 38,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 5
        },
        {
          "type": "data",
          "level": 2
        }
      ],
      "salary": 500506,
      "energy": 100,
      "stats": {
        "algo": 90,
        "code": 86,
        "text": 82
      },
      "resume": {
        "univ": "京北大学 博士",
        "exp": "国内最早一批做 RLHF 的人之一。他有个习惯：每次上线前亲自和模型聊两个小时，聊完才签字。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 153,
      "avatar": "resource/ui/avatar_153.webp"
    },
    {
      "no": 2045,
      "key": "eng_57",
      "name": "叶秋池",
      "gender": "女",
      "age": 36,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 4
        }
      ],
      "salary": 357504,
      "energy": 100,
      "stats": {
        "algo": 90,
        "code": 86,
        "text": 82
      },
      "resume": {
        "univ": "江东大学 博士",
        "exp": "做过教育、医疗两个垂类的大模型对齐，深知「安全」和「有用」之间那条线到底有多难踩。她写的红队用例被多家公司借去当内部基准。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 122,
      "avatar": "resource/ui/avatar_122.webp"
    },
    {
      "no": 2046,
      "key": "eng_58",
      "name": "方未至",
      "gender": "男",
      "age": 41,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 3
        }
      ],
      "salary": 268195,
      "energy": 100,
      "stats": {
        "algo": 96,
        "code": 92,
        "text": 88
      },
      "resume": {
        "univ": "南屏工业大学 博士",
        "exp": "大厂内容安全八年，处理过真正的公关危机。他不是最懂算法的那个人，但他是你出事那天最想让他在场的那个人。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 154,
      "avatar": "resource/ui/avatar_154.webp"
    },
    {
      "no": 2047,
      "key": "eng_v1a",
      "name": "林初晓",
      "gender": "女",
      "age": 23,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 83333,
      "morale": 85,
      "energy": 100,
      "loyalty": 70,
      "stats": {
        "code": 30,
        "algo": 60,
        "text": 30
      },
      "resume": {
        "univ": "星辰大学计算机系硕士（应届）",
        "exp": "毕业论文复现了小型 GPT 预训练流程，熟悉数据配比与 loss 曲线调优，算法思维扎实但工程经验尚浅。精力旺盛的典型天才型新人，自带让导师头疼的「凌晨三点改代码」体质。"
      },
      "stage": [
        "V1"
      ],
      "starter": true,
      "avatarIdx": 123,
      "avatar": "resource/ui/avatar_123.webp"
    },
    {
      "no": 2048,
      "key": "eng_v1b",
      "name": "苏小满",
      "gender": "女",
      "age": 24,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        }
      ],
      "salary": 83333,
      "morale": 80,
      "energy": 100,
      "loyalty": 72,
      "stats": {
        "code": 50,
        "algo": 10,
        "text": 50
      },
      "resume": {
        "univ": "海蓝大学数据科学学士（应届）",
        "exp": "校期间主导过千条级语料标注与质检项目，标注规范文档写得像教科书，代码与文字功底均衡。算法理论偏弱，但胜在细心耐心、精力充沛，是数据清洗流水线上最靠谱的新人。"
      },
      "stage": [
        "V1"
      ],
      "starter": true,
      "avatarIdx": 124,
      "avatar": "resource/ui/avatar_124.webp"
    },
    {
      "no": 2049,
      "key": "eng_v1c",
      "name": "陈默",
      "gender": "男",
      "age": 26,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        }
      ],
      "salary": 91667,
      "morale": 78,
      "energy": 100,
      "loyalty": 68,
      "stats": {
        "code": 40,
        "algo": 45,
        "text": 70
      },
      "resume": {
        "univ": "云舟大学语言学硕士（应届）",
        "exp": "做过两轮对话模型的 SFT 与人工偏好标注，对「什么样的话算好回答」有近乎苛刻的直觉。写得了标注规范，也压得住标注员，就是不太爱说话。"
      },
      "stage": [
        "V1"
      ],
      "starter": true,
      "avatarIdx": 155,
      "avatar": "resource/ui/avatar_155.webp"
    },
    {
      "no": 2050,
      "key": "eng_60",
      "name": "李牧",
      "gender": "男",
      "age": 24,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 109805,
      "energy": 100,
      "stats": {
        "code": 51,
        "text": 45,
        "algo": 34
      },
      "resume": {
        "univ": "东海大学统计学学士",
        "exp": "在校写过一套开源中文语料的去重脚本，合并同源新闻时误删过一批文章，后来学乖了，先抽样再全量。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 156,
      "avatar": "resource/ui/avatar_156.webp"
    },
    {
      "no": 2051,
      "key": "eng_61",
      "name": "张屿",
      "gender": "男",
      "age": 26,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        }
      ],
      "salary": 109805,
      "energy": 100,
      "stats": {
        "algo": 48,
        "code": 39,
        "text": 43
      },
      "resume": {
        "univ": "云舟大学计算机硕士",
        "exp": "在实验室管着一台八卡服务器，最长一次连续训练了十一天，中间重启三次。显存不够时习惯先把优化器状态算清楚再动刀。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 157,
      "avatar": "resource/ui/avatar_157.webp"
    },
    {
      "no": 2052,
      "key": "eng_62",
      "name": "王铮",
      "gender": "男",
      "age": 31,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        },
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 109805,
      "energy": 100,
      "stats": {
        "algo": 48,
        "code": 35,
        "text": 39
      },
      "resume": {
        "univ": "中岭大学计算机硕士",
        "exp": "做过两年多机多卡的通信优化，把一次全局同步的开销压下去三成。论文只发过一篇，自己觉得一般。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 158,
      "avatar": "resource/ui/avatar_158.webp"
    },
    {
      "no": 2053,
      "key": "eng_63",
      "name": "刘岩松",
      "gender": "男",
      "age": 35,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 108741,
      "energy": 100,
      "stats": {
        "algo": 47,
        "code": 41,
        "text": 34
      },
      "resume": {
        "univ": "南方工科大学计算机硕士",
        "exp": "带过一个小训练组，从数据加载到断点恢复都自己盯。最怕 loss 突然抖一下，现在会先把日志翻三遍再改代码。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 159,
      "avatar": "resource/ui/avatar_159.webp"
    },
    {
      "no": 2054,
      "key": "eng_64",
      "name": "杨海涛",
      "gender": "男",
      "age": 29,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        }
      ],
      "salary": 107699,
      "energy": 100,
      "stats": {
        "algo": 46,
        "code": 36,
        "text": 40
      },
      "resume": {
        "univ": "西京交通大学计算机博士",
        "exp": "博士期间做并行策略的自动搜索，写过几十版切分方案，最后能用的只有两版。对 scaling law 的拟合曲线有点执念。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 160,
      "avatar": "resource/ui/avatar_160.webp"
    },
    {
      "no": 2055,
      "key": "eng_65",
      "name": "黄楷",
      "gender": "男",
      "age": 23,
      "edu": "学士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 107699,
      "energy": 100,
      "stats": {
        "algo": 50,
        "code": 46,
        "text": 42
      },
      "resume": {
        "univ": "临江大学人工智能学士（应届）",
        "exp": "毕业设计复现过一个轻量奖励模型，分数老是偏高，导师说是我偏好数据里正面样本太多。还没真正上过班。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 161,
      "avatar": "resource/ui/avatar_161.webp"
    },
    {
      "no": 2056,
      "key": "eng_66",
      "name": "吴骏",
      "gender": "男",
      "age": 33,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 107699,
      "energy": 100,
      "stats": {
        "algo": 50,
        "code": 46,
        "text": 42
      },
      "resume": {
        "univ": "金陵大学计算机博士",
        "exp": "做过一套 SFT 数据的质量评估流程，把人工抽检和模型打分对了一遍，发现两者有一半时候不一致，这事我想了很久。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 162,
      "avatar": "resource/ui/avatar_162.webp"
    },
    {
      "no": 2057,
      "key": "eng_67",
      "name": "徐磊",
      "gender": "男",
      "age": 27,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        }
      ],
      "salary": 106680,
      "energy": 100,
      "stats": {
        "algo": 45,
        "code": 34,
        "text": 38
      },
      "resume": {
        "univ": "江东大学软件工程硕士",
        "exp": "主要做显存优化，激活重计算和梯度累积掰扯得比较熟。有一次为了省显存把 batch 调太小，训出来的模型话特别多。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 163,
      "avatar": "resource/ui/avatar_163.webp"
    },
    {
      "no": 2058,
      "key": "eng_68",
      "name": "孙铎",
      "gender": "男",
      "age": 25,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 105683,
      "energy": 100,
      "stats": {
        "code": 47,
        "text": 41,
        "algo": 31
      },
      "resume": {
        "univ": "青川大学信息管理学士",
        "exp": "做过一年半网页语料抓取，维护过两百多个站点的解析规则。一半时间在跟反爬斗智斗勇，另一半在写正则。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 164,
      "avatar": "resource/ui/avatar_164.webp"
    },
    {
      "no": 2059,
      "key": "eng_69",
      "name": "胡峥",
      "gender": "男",
      "age": 30,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 105683,
      "energy": 100,
      "stats": {
        "code": 47,
        "text": 41,
        "algo": 38
      },
      "resume": {
        "univ": "徽城大学数据科学硕士",
        "exp": "做过中英混合语料的配比实验，跑了二十多组配方，最后发现改动最大的那组反而最差。这行很吃耐心。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 165,
      "avatar": "resource/ui/avatar_165.webp"
    },
    {
      "no": 2060,
      "key": "eng_70",
      "name": "朱桓",
      "gender": "男",
      "age": 38,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 105683,
      "energy": 100,
      "stats": {
        "code": 47,
        "text": 41,
        "algo": 34
      },
      "resume": {
        "univ": "中南理工大学计算机硕士",
        "exp": "在数据团队待了很多年，经手过亿级文档的清洗流水线，也裁掉过一半索引重来。现在更愿意先花三天想清楚再动手。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 166,
      "avatar": "resource/ui/avatar_166.webp"
    },
    {
      "no": 2061,
      "key": "eng_71",
      "name": "高峻",
      "gender": "男",
      "age": 28,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 104709,
      "energy": 100,
      "stats": {
        "code": 46,
        "text": 40,
        "algo": 29
      },
      "resume": {
        "univ": "星辰大学计算语言学博士",
        "exp": "博士做低资源语料的自动标注，用规则和模型互相校验。做出来的东西在冷门语种上还不错，通用语料上一般。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 167,
      "avatar": "resource/ui/avatar_167.webp"
    },
    {
      "no": 2062,
      "key": "eng_72",
      "name": "韩森",
      "gender": "男",
      "age": 22,
      "edu": "学士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 104709,
      "energy": 100,
      "stats": {
        "algo": 43,
        "code": 34,
        "text": 38
      },
      "resume": {
        "univ": "南屿大学计算机学士（应届）",
        "exp": "只在实验室的八卡集群上跑通过一个 1B 模型的完整预训练，loss 曲线到现在还存着。分布式的东西大部分是照文档学的。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 168,
      "avatar": "resource/ui/avatar_168.webp"
    },
    {
      "no": 2063,
      "key": "eng_73",
      "name": "董桁",
      "gender": "男",
      "age": 26,
      "edu": "学士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 103757,
      "energy": 100,
      "stats": {
        "algo": 46,
        "code": 42,
        "text": 38
      },
      "resume": {
        "univ": "白鹿大学智能科学学士",
        "exp": "做过偏好数据的采集和清洗，写过一个把过长回复截断的小工具。给奖励模型喂过一批自己都不太认同的标注。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 169,
      "avatar": "resource/ui/avatar_169.webp"
    },
    {
      "no": 2064,
      "key": "eng_74",
      "name": "余钧",
      "gender": "男",
      "age": 32,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 2
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 103757,
      "energy": 100,
      "stats": {
        "algo": 46,
        "code": 42,
        "text": 38
      },
      "resume": {
        "univ": "东海大学计算机硕士",
        "exp": "做过两年对齐相关的工作，从偏好数据标注规范到奖励模型训练都碰过。评测集泄露过一次，后来每次切分都要交叉检查。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 170,
      "avatar": "resource/ui/avatar_170.webp"
    },
    {
      "no": 2065,
      "key": "eng_75",
      "name": "杜衡",
      "gender": "男",
      "age": 24,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 2
        },
        {
          "type": "academic",
          "level": 3
        }
      ],
      "salary": 102827,
      "energy": 100,
      "stats": {
        "algo": 41,
        "code": 31,
        "text": 35
      },
      "resume": {
        "univ": "明州理工大学计算机硕士",
        "exp": "主要做张量并行的调参，把不同切分下的吞吐量测了一遍，做成一页表贴在工位上。理论讲不太清，但跑得快是真的。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 171,
      "avatar": "resource/ui/avatar_171.webp"
    },
    {
      "no": 2066,
      "key": "eng_76",
      "name": "程越",
      "gender": "男",
      "age": 27,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 112320,
      "energy": 100,
      "stats": {
        "code": 93,
        "text": 87,
        "algo": 78
      },
      "resume": {
        "univ": "中岭大学信息资源管理学士",
        "exp": "维护过一批行业语料的入库流程，写了套自己的去重规则把重复率压到千分之三。脏数据见多了，看什么都想先洗一遍。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 172,
      "avatar": "resource/ui/avatar_172.webp"
    },
    {
      "no": 2067,
      "key": "eng_77",
      "name": "曹楠",
      "gender": "男",
      "age": 23,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 101239,
      "energy": 100,
      "stats": {
        "code": 84,
        "text": 78,
        "algo": 76
      },
      "resume": {
        "univ": "江岭大学统计学学士（应届）",
        "exp": "实习时做过标注抽检，一天看两千条，看得眼睛发花。发现标注员里最认真的那个反而是个新手。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 173,
      "avatar": "resource/ui/avatar_173.webp"
    },
    {
      "no": 2068,
      "key": "eng_78",
      "name": "袁锐",
      "gender": "男",
      "age": 29,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 101239,
      "energy": 100,
      "stats": {
        "algo": 85,
        "code": 81,
        "text": 77
      },
      "resume": {
        "univ": "北华大学计算机博士",
        "exp": "博士做偏好建模，试过好几种奖励模型的损失函数，最好那版靠的还是数据筛选而不是结构。发过两篇，引用不多。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 174,
      "avatar": "resource/ui/avatar_174.webp"
    },
    {
      "no": 2069,
      "key": "eng_79",
      "name": "邓铭",
      "gender": "男",
      "age": 34,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 91325,
      "energy": 100,
      "stats": {
        "algo": 72,
        "code": 57,
        "text": 61
      },
      "resume": {
        "univ": "南方工科大学软件工程硕士",
        "exp": "早些年在一家做推荐系统的公司写训练框架，后来转到大模型。吃过集群不稳的亏，现在写任何脚本都先想中断了怎么办。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 175,
      "avatar": "resource/ui/avatar_175.webp"
    },
    {
      "no": 2070,
      "key": "eng_80",
      "name": "傅川",
      "gender": "男",
      "age": 25,
      "edu": "学士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 90295,
      "energy": 100,
      "stats": {
        "algo": 75,
        "code": 71,
        "text": 67
      },
      "resume": {
        "univ": "江东大学计算机学士",
        "exp": "做过 SFT 指令数据的整理，把从各处收集来的问答洗了一遍，删掉大概四成。剩下的里面还有一部分我自己都觉得别扭。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 176,
      "avatar": "resource/ui/avatar_176.webp"
    },
    {
      "no": 2071,
      "key": "eng_81",
      "name": "卢峰",
      "gender": "男",
      "age": 40,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 89280,
      "energy": 100,
      "stats": {
        "algo": 74,
        "code": 70,
        "text": 66
      },
      "resume": {
        "univ": "金陵大学人工智能博士",
        "exp": "做过多年评测相关的工作，设计过几套中文评测集，也修过别人数据集里的标签错误。后来发现评测集本身也需要评测。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 177,
      "avatar": "resource/ui/avatar_177.webp"
    },
    {
      "no": 2072,
      "key": "eng_82",
      "name": "崔巍",
      "gender": "男",
      "age": 36,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 89280,
      "energy": 100,
      "stats": {
        "algo": 70,
        "code": 65,
        "text": 58
      },
      "resume": {
        "univ": "沪通大学计算机硕士",
        "exp": "做过长上下文训练，把序列长度一点点往上加，显存跟着炸。最后靠分层切分撑住了，代价是吞吐掉了不少。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 178,
      "avatar": "resource/ui/avatar_178.webp"
    },
    {
      "no": 2073,
      "key": "eng_83",
      "name": "谭松",
      "gender": "男",
      "age": 22,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 82577,
      "energy": 100,
      "stats": {
        "code": 66,
        "text": 60,
        "algo": 56
      },
      "resume": {
        "univ": "沅江大学中文系学士（应届）",
        "exp": "中文系出身，实习时帮着写了一版标点规范化规则。发现网上的文本比课本上脏多了，逗号句号都有人用混。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 179,
      "avatar": "resource/ui/avatar_179.webp"
    },
    {
      "no": 2074,
      "key": "eng_84",
      "name": "廖晖",
      "gender": "男",
      "age": 28,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 82577,
      "energy": 100,
      "stats": {
        "code": 66,
        "text": 60,
        "algo": 52
      },
      "resume": {
        "univ": "天泽大学计算机硕士",
        "exp": "做过爬虫调度和反爬对抗，维护过一个中等规模的采集系统。被抓过两次 IP 段，现在会留一手备用通道。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 180,
      "avatar": "resource/ui/avatar_180.webp"
    },
    {
      "no": 2075,
      "key": "eng_85",
      "name": "范阳",
      "gender": "男",
      "age": 31,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 81677,
      "energy": 100,
      "stats": {
        "algo": 66,
        "code": 62,
        "text": 58
      },
      "resume": {
        "univ": "中南理工大学软件工程硕士",
        "exp": "搭过 RLHF 的训练流程，从采样到打分都自己跑过一遍。奖励模型被刷分刷得很惨，后来加了一堆正则才勉强压住。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 181,
      "avatar": "resource/ui/avatar_181.webp"
    },
    {
      "no": 2076,
      "key": "eng_86",
      "name": "汪沛",
      "gender": "男",
      "age": 24,
      "edu": "学士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 81677,
      "energy": 100,
      "stats": {
        "algo": 66,
        "code": 62,
        "text": 58
      },
      "resume": {
        "univ": "临江大学人工智能学士",
        "exp": "做过对齐数据的清洗，主要工作就是删。删过的数据比留下的多，删多了以后反而不敢随便删了。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 182,
      "avatar": "resource/ui/avatar_182.webp"
    },
    {
      "no": 2077,
      "key": "eng_87",
      "name": "石岩",
      "gender": "男",
      "age": 27,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 80791,
      "energy": 100,
      "stats": {
        "algo": 61,
        "code": 47,
        "text": 51
      },
      "resume": {
        "univ": "云舟大学计算机硕士",
        "exp": "做过分布式训练里的故障恢复，把断点续训的时间从十几分钟压到两分钟以内。为此重写过三次训练主循环。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 183,
      "avatar": "resource/ui/avatar_183.webp"
    },
    {
      "no": 2078,
      "key": "eng_88",
      "name": "贾凡",
      "gender": "男",
      "age": 34,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 80791,
      "energy": 100,
      "stats": {
        "code": 64,
        "text": 58,
        "algo": 56
      },
      "resume": {
        "univ": "青川大学数据科学硕士",
        "exp": "做过多年的数据配比，手上的配方表改过几百版。有次凭直觉调了一版，效果出奇地好，可到现在也没弄明白为什么。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 184,
      "avatar": "resource/ui/avatar_184.webp"
    },
    {
      "no": 2079,
      "key": "eng_89",
      "name": "夏鸣",
      "gender": "男",
      "age": 29,
      "edu": "博士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 79920,
      "energy": 100,
      "stats": {
        "code": 63,
        "text": 57,
        "algo": 51
      },
      "resume": {
        "univ": "徽城大学计算机博士",
        "exp": "博士做数据质量自动打分，训过一个很小的分类器来筛语料。准确率不算高，但省下了大量人工，团队一直在用。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 185,
      "avatar": "resource/ui/avatar_185.webp"
    },
    {
      "no": 2080,
      "key": "eng_90",
      "name": "钟野",
      "gender": "男",
      "age": 23,
      "edu": "学士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 79920,
      "energy": 100,
      "stats": {
        "algo": 60,
        "code": 45,
        "text": 49
      },
      "resume": {
        "univ": "南方工科大学计算机学士（应届）",
        "exp": "本科毕设做的是混合精度训练，把一份开源训练脚本改到能在本地跑起来。原理讲得含糊，报错倒是会看。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 186,
      "avatar": "resource/ui/avatar_186.webp"
    },
    {
      "no": 2081,
      "key": "eng_91",
      "name": "邹平",
      "gender": "男",
      "age": 32,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 66103,
      "energy": 100,
      "stats": {
        "algo": 45,
        "code": 41,
        "text": 37
      },
      "resume": {
        "univ": "金陵大学软件工程硕士",
        "exp": "做过 SFT 和偏好数据的全流程，带过两三个人的小组。更擅长安规范，写文档比写模型痛快。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 187,
      "avatar": "resource/ui/avatar_187.webp"
    },
    {
      "no": 2082,
      "key": "eng_92",
      "name": "熊拓",
      "gender": "男",
      "age": 25,
      "edu": "学士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 66103,
      "energy": 100,
      "stats": {
        "algo": 41,
        "code": 29,
        "text": 33
      },
      "resume": {
        "univ": "南屿大学计算机学士",
        "exp": "在小集群上做过流水线并行，把模型切成几段分到不同卡上。切得不均的时候，慢的那张卡会拖累全部。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 188,
      "avatar": "resource/ui/avatar_188.webp"
    },
    {
      "no": 2083,
      "key": "eng_93",
      "name": "金戈",
      "gender": "男",
      "age": 33,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "academic",
          "level": 3
        }
      ],
      "salary": 66103,
      "energy": 100,
      "stats": {
        "code": 44,
        "text": 38,
        "algo": 27
      },
      "resume": {
        "univ": "江岭大学情报学硕士",
        "exp": "做过专利和论文语料的抽取，处理过 PDF 里各种离奇的排版。干了几年下来，对表格和脚注有生理性的警惕。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 189,
      "avatar": "resource/ui/avatar_189.webp"
    },
    {
      "no": 2084,
      "key": "eng_94",
      "name": "孔维",
      "gender": "男",
      "age": 44,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 65520,
      "energy": 100,
      "stats": {
        "algo": 44,
        "code": 40,
        "text": 36
      },
      "resume": {
        "univ": "北华大学语言学博士",
        "exp": "早些年做语言资源建设，后来转到评测和对齐。带过不少新人，最常说的是先把数据看一百条再写代码。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 190,
      "avatar": "resource/ui/avatar_190.webp"
    },
    {
      "no": 2085,
      "key": "eng_95",
      "name": "汤原",
      "gender": "男",
      "age": 26,
      "edu": "学士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 64951,
      "energy": 100,
      "stats": {
        "algo": 43,
        "code": 39,
        "text": 35
      },
      "resume": {
        "univ": "天泽大学计算机学士",
        "exp": "做过多轮迭代的偏好标注，跟着项目改了十几版标注规范。最后发现规范越写越长，标注员越看越不进去。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 191,
      "avatar": "resource/ui/avatar_191.webp"
    },
    {
      "no": 2086,
      "key": "eng_96",
      "name": "向远",
      "gender": "男",
      "age": 28,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 3
        }
      ],
      "salary": 64951,
      "energy": 100,
      "stats": {
        "algo": 39,
        "code": 33,
        "text": 26
      },
      "resume": {
        "univ": "沪通大学计算机硕士",
        "exp": "做过梯度检查点和激活重计算的组合优化，把单卡能塞下的参数翻了快一倍。代价是训练速度慢了三成。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 192,
      "avatar": "resource/ui/avatar_192.webp"
    },
    {
      "no": 2087,
      "key": "eng_97",
      "name": "常青",
      "gender": "男",
      "age": 37,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 64951,
      "energy": 100,
      "stats": {
        "code": 42,
        "text": 36,
        "algo": 31
      },
      "resume": {
        "univ": "西京交通大学软件工程硕士",
        "exp": "管过一批语料的来源台账，尽量把每一条数据的出处都记清楚。这活没人爱做，但出过一次事后大家都老实了。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 193,
      "avatar": "resource/ui/avatar_193.webp"
    },
    {
      "no": 2088,
      "key": "eng_98",
      "name": "李疏桐",
      "gender": "女",
      "age": 25,
      "edu": "学士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 64397,
      "energy": 100,
      "stats": {
        "algo": 42,
        "code": 38,
        "text": 34
      },
      "resume": {
        "univ": "江东大学中文系学士",
        "exp": "做过 SFT 语料的人工校对，改过很多明显的错别字和事实错误。有时候改着改着就开始怀疑自己写的东西。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 125,
      "avatar": "resource/ui/avatar_125.webp"
    },
    {
      "no": 2089,
      "key": "eng_99",
      "name": "张婉",
      "gender": "女",
      "age": 23,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "academic",
          "level": 3
        }
      ],
      "salary": 64397,
      "energy": 100,
      "stats": {
        "code": 41,
        "text": 35,
        "algo": 33
      },
      "resume": {
        "univ": "白鹿大学信息管理学士（应届）",
        "exp": "实习时做事后清洗，一天处理几十万条短文本。学到了一个道理：先看一千条样本，再决定写什么规则。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 126,
      "avatar": "resource/ui/avatar_126.webp"
    },
    {
      "no": 2090,
      "key": "eng_100",
      "name": "王洛",
      "gender": "女",
      "age": 27,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 63857,
      "energy": 100,
      "stats": {
        "algo": 37,
        "code": 26,
        "text": 30
      },
      "resume": {
        "univ": "明州理工大学计算机硕士",
        "exp": "做过通信和计算的 overlap，尽量让卡别空转。调了半天发现瓶颈其实在数据加载上，白忙了一场。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 127,
      "avatar": "resource/ui/avatar_127.webp"
    },
    {
      "no": 2091,
      "key": "eng_101",
      "name": "刘怡然",
      "gender": "女",
      "age": 24,
      "edu": "学士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 1
        }
      ],
      "salary": 63857,
      "energy": 100,
      "stats": {
        "algo": 41,
        "code": 37,
        "text": 33
      },
      "resume": {
        "univ": "星辰大学心理学学士",
        "exp": "心理学出身，做偏好标注时更关注标注员之间的一致性。发现同一段回答，隔一天再看，自己打的分都会变。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 128,
      "avatar": "resource/ui/avatar_128.webp"
    },
    {
      "no": 2092,
      "key": "eng_102",
      "name": "杨采薇",
      "gender": "女",
      "age": 30,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "academic",
          "level": 4
        }
      ],
      "salary": 63857,
      "energy": 100,
      "stats": {
        "code": 40,
        "text": 34,
        "algo": 31
      },
      "resume": {
        "univ": "东海大学语言学硕士",
        "exp": "做过中文分句和标点的规范化，处理过各种奇怪的排版。也写过一份标注手册，被同事吐槽太啰嗦，但新人确实少走了弯路。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 129,
      "avatar": "resource/ui/avatar_129.webp"
    },
    {
      "no": 2093,
      "key": "eng_103",
      "name": "黄蕴",
      "gender": "女",
      "age": 26,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 63857,
      "energy": 100,
      "stats": {
        "algo": 37,
        "code": 25,
        "text": 29
      },
      "resume": {
        "univ": "中岭大学计算机硕士",
        "exp": "做训练日志的分析，把 loss 和梯度的异常做成了自动告警。告警太灵敏，半夜响过好几次，后来把阈值放宽了。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 130,
      "avatar": "resource/ui/avatar_130.webp"
    },
    {
      "no": 2094,
      "key": "eng_104",
      "name": "吴曼",
      "gender": "女",
      "age": 33,
      "edu": "博士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 3
        }
      ],
      "salary": 63331,
      "energy": 100,
      "stats": {
        "algo": 40,
        "code": 36,
        "text": 32
      },
      "resume": {
        "univ": "南方工科大学计算机博士",
        "exp": "博士研究的是对齐中的偏好聚合，试过让不同标注者投票的方案。发现人多不一定就对，分歧本身才是信息。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 131,
      "avatar": "resource/ui/avatar_131.webp"
    },
    {
      "no": 2095,
      "key": "eng_105",
      "name": "徐怀瑾",
      "gender": "女",
      "age": 29,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 4
        }
      ],
      "salary": 62820,
      "energy": 100,
      "stats": {
        "algo": 35,
        "code": 26,
        "text": 30
      },
      "resume": {
        "univ": "青川大学计算机硕士",
        "exp": "做过模型并行下的参数分片，把优化器状态摊到多张卡上。有一版代码只在特定卡数下正确，这个坑埋了两个月才发现。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 194,
      "avatar": "resource/ui/avatar_194.webp"
    },
    {
      "no": 2096,
      "key": "eng_106",
      "name": "孙半夏",
      "gender": "女",
      "age": 22,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 62820,
      "energy": 100,
      "stats": {
        "code": 38,
        "text": 32,
        "algo": 24
      },
      "resume": {
        "univ": "徽城大学汉语言文学学士（应届）",
        "exp": "在校帮老师整理过一批方言文本，手工标注了两万多条。第一次知道清洗数据可以这么磨人。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 195,
      "avatar": "resource/ui/avatar_195.webp"
    },
    {
      "no": 2097,
      "key": "eng_107",
      "name": "胡青禾",
      "gender": "女",
      "age": 25,
      "edu": "学士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 3
        }
      ],
      "salary": 62820,
      "energy": 100,
      "stats": {
        "algo": 39,
        "code": 35,
        "text": 31
      },
      "resume": {
        "univ": "南屿大学人工智能学士",
        "exp": "做过评测集的人工复核，改过一批有歧义的题目。改到最后发现，很多题不是模型答错，是题目本身就没说清楚。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 196,
      "avatar": "resource/ui/avatar_196.webp"
    },
    {
      "no": 2098,
      "key": "eng_108",
      "name": "朱令仪",
      "gender": "女",
      "age": 31,
      "edu": "硕士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 5
        }
      ],
      "salary": 62323,
      "energy": 100,
      "stats": {
        "algo": 34,
        "code": 24,
        "text": 28
      },
      "resume": {
        "univ": "沅江大学计算机硕士",
        "exp": "做过预训练阶段的课程学习，把数据按难度排了个顺序。排序花的时间比训练还长，效果提升得不多。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 197,
      "avatar": "resource/ui/avatar_197.webp"
    },
    {
      "no": 2099,
      "key": "eng_109",
      "name": "高见月",
      "gender": "女",
      "age": 27,
      "edu": "硕士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 62323,
      "energy": 100,
      "stats": {
        "code": 37,
        "text": 31,
        "algo": 22
      },
      "resume": {
        "univ": "金陵大学图书馆学硕士",
        "exp": "做过文献语料的采集和去重，对同一篇文章的不同转载版本特别敏感。习惯了先查重再入库，不然心里不踏实。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 198,
      "avatar": "resource/ui/avatar_198.webp"
    },
    {
      "no": 2100,
      "key": "eng_110",
      "name": "韩听岚",
      "gender": "女",
      "age": 24,
      "edu": "学士",
      "type": "data",
      "traits": [
        {
          "type": "data",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 5
        }
      ],
      "salary": 61841,
      "energy": 100,
      "stats": {
        "code": 36,
        "text": 30,
        "algo": 28
      },
      "resume": {
        "univ": "临江大学统计学学士",
        "exp": "做过数据分布的抽检，写过几个小的统计脚本。发现抽样方法不对的时候，看起来很正常的数据其实全是偏的。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 199,
      "avatar": "resource/ui/avatar_199.webp"
    },
    {
      "no": 2101,
      "key": "eng_111",
      "name": "董念",
      "gender": "女",
      "age": 35,
      "edu": "硕士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "academic",
          "level": 4
        }
      ],
      "salary": 61841,
      "energy": 100,
      "stats": {
        "algo": 37,
        "code": 33,
        "text": 29
      },
      "resume": {
        "univ": "云舟大学语言学硕士",
        "exp": "做过评测和红队测试，专门找模型在中文语境下说不清的地方。写过一份问题清单，后来成了项目的常规检查项。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 200,
      "avatar": "resource/ui/avatar_200.webp"
    },
    {
      "no": 2102,
      "key": "eng_112",
      "name": "余桑",
      "gender": "女",
      "age": 28,
      "edu": "博士",
      "type": "pretrain",
      "traits": [
        {
          "type": "pretrain",
          "level": 1
        }
      ],
      "salary": 61841,
      "energy": 100,
      "stats": {
        "algo": 33,
        "code": 18,
        "text": 22
      },
      "resume": {
        "univ": "北华大学计算机博士",
        "exp": "博士做训练稳定性，研究过 loss spike 的成因。论文里给了几种解释，自己心里最信的还是数据里混进了脏东西。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 201,
      "avatar": "resource/ui/avatar_201.webp"
    },
    {
      "no": 2103,
      "key": "eng_113",
      "name": "杜若",
      "gender": "女",
      "age": 26,
      "edu": "学士",
      "type": "post",
      "traits": [
        {
          "type": "post",
          "level": 1
        },
        {
          "type": "pretrain",
          "level": 1
        },
        {
          "type": "academic",
          "level": 4
        }
      ],
      "salary": 61373,
      "energy": 100,
      "stats": {
        "algo": 36,
        "code": 32,
        "text": 28
      },
      "resume": {
        "univ": "中岭大学编辑出版学学士",
        "exp": "做过 SFT 数据的人工改写，把生硬的回答改得像人话。改多了以后，自己说话都开始注意别太像机器。"
      },
      "stage": [
        "V1",
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4"
      ],
      "avatarIdx": 202,
      "avatar": "resource/ui/avatar_202.webp"
    },
    {
      "no": 2104,
      "key": "eng_embodied_mentor",
      "name": "陆知行",
      "age": 35,
      "gender": "男",
      "edu": "博士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 5
        }
      ],
      "salary": 542606,
      "energy": 100,
      "stats": {
        "algo": 94,
        "code": 92,
        "engineering": 88
      },
      "resume": {
        "univ": "海东大学机器人方向博士",
        "exp": "大学前辈，曾任大型科技公司的具身智能研发负责人。希望把团队的 AI 能力带到真实世界。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 233,
      "avatar": "resource/ui/avatar_233.webp",
      "pool": false
    },
    {
      "no": 2105,
      "key": "eng_embodied_01",
      "name": "宋雨禾",
      "age": 28,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 4
        }
      ],
      "salary": 345336,
      "energy": 100,
      "stats": {
        "algo": 82,
        "code": 84,
        "engineering": 75
      },
      "resume": {
        "univ": "机器人与自动化方向",
        "exp": "参与过感知、模仿学习和机器人操作项目，习惯先在仿真中验证，再调试真实设备。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 203,
      "avatar": "resource/ui/avatar_203.webp",
      "pool": true
    },
    {
      "no": 2106,
      "key": "eng_embodied_02",
      "name": "许观澜",
      "age": 31,
      "gender": "男",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 5
        }
      ],
      "salary": 527192,
      "energy": 100,
      "stats": {
        "algo": 91,
        "code": 90,
        "engineering": 83
      },
      "resume": {
        "univ": "机器人与自动化方向",
        "exp": "参与过感知、模仿学习和机器人操作项目，习惯先在仿真中验证，再调试真实设备。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 204,
      "avatar": "resource/ui/avatar_204.webp",
      "pool": true
    },
    {
      "no": 2107,
      "key": "eng_embodied_03",
      "name": "沈禾",
      "age": 25,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 3
        }
      ],
      "salary": 224318,
      "energy": 100,
      "stats": {
        "algo": 75,
        "code": 78,
        "engineering": 70
      },
      "resume": {
        "univ": "机器人与自动化方向",
        "exp": "参与过感知、模仿学习和机器人操作项目，习惯先在仿真中验证，再调试真实设备。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 205,
      "avatar": "resource/ui/avatar_205.webp",
      "pool": true
    },
    {
      "no": 2108,
      "key": "eng_embodied_04",
      "name": "周映川",
      "age": 29,
      "gender": "男",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 4
        }
      ],
      "salary": 345336,
      "energy": 100,
      "stats": {
        "algo": 84,
        "code": 82,
        "engineering": 76
      },
      "resume": {
        "univ": "机器人与自动化方向",
        "exp": "参与过感知、模仿学习和机器人操作项目，习惯先在仿真中验证，再调试真实设备。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 206,
      "avatar": "resource/ui/avatar_206.webp",
      "pool": true
    },
    {
      "no": 2109,
      "key": "eng_embodied_05",
      "name": "夏闻笛",
      "age": 26,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 2
        }
      ],
      "salary": 134277,
      "energy": 100,
      "stats": {
        "algo": 66,
        "code": 68,
        "engineering": 61
      },
      "resume": {
        "univ": "机器人与自动化方向",
        "exp": "参与过感知、模仿学习和机器人操作项目，习惯先在仿真中验证，再调试真实设备。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 207,
      "avatar": "resource/ui/avatar_207.webp",
      "pool": true
    },
    {
      "no": 2110,
      "key": "eng_embodied_06",
      "name": "方知远",
      "age": 24,
      "gender": "男",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 1
        }
      ],
      "salary": 76579,
      "energy": 100,
      "stats": {
        "algo": 55,
        "code": 57,
        "engineering": 50
      },
      "resume": {
        "univ": "机器人与自动化方向",
        "exp": "参与过感知、模仿学习和机器人操作项目，习惯先在仿真中验证，再调试真实设备。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 208,
      "avatar": "resource/ui/avatar_208.webp",
      "pool": true
    },
    {
      "no": 2111,
      "key": "eng_embodied_07",
      "name": "顾星遥",
      "age": 30,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 5
        }
      ],
      "salary": 545740,
      "energy": 100,
      "stats": {
        "algo": 93,
        "code": 94,
        "engineering": 84
      },
      "resume": {
        "univ": "机器人与自动化方向",
        "exp": "参与过感知、模仿学习和机器人操作项目，习惯先在仿真中验证，再调试真实设备。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 209,
      "avatar": "resource/ui/avatar_209.webp",
      "pool": true
    },
    {
      "no": 2112,
      "key": "eng_embodied_08",
      "name": "陈允",
      "age": 27,
      "gender": "男",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 3
        }
      ],
      "salary": 225607,
      "energy": 100,
      "stats": {
        "algo": 78,
        "code": 76,
        "engineering": 69
      },
      "resume": {
        "univ": "机器人与自动化方向",
        "exp": "参与过感知、模仿学习和机器人操作项目，习惯先在仿真中验证，再调试真实设备。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 210,
      "avatar": "resource/ui/avatar_210.webp",
      "pool": true
    },
    {
      "no": 2113,
      "key": "eng_embodied_09",
      "name": "邵晨",
      "age": 23,
      "gender": "男",
      "edu": "本科",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 1
        }
      ],
      "salary": 67939,
      "energy": 100,
      "stats": {
        "code": 49,
        "algo": 42,
        "engineering": 46
      },
      "resume": {
        "univ": "南湖理工大学自动化学士",
        "exp": "给实验室小车调过巡线和避障。最擅长从松掉的一根线里找出“算法故障”。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 211,
      "avatar": "resource/ui/avatar_211.webp",
      "pool": true
    },
    {
      "no": 2114,
      "key": "eng_embodied_10",
      "name": "林若溪",
      "age": 23,
      "gender": "女",
      "edu": "本科",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 1
        }
      ],
      "salary": 73469,
      "energy": 100,
      "stats": {
        "code": 56,
        "algo": 53,
        "engineering": 51
      },
      "resume": {
        "univ": "海东大学测控技术学士",
        "exp": "做过机械臂标定实习。会把每一次重复测量记录下来，直到夹爪稳稳落在同一个点上。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 212,
      "avatar": "resource/ui/avatar_212.webp",
      "pool": true
    },
    {
      "no": 2115,
      "key": "eng_embodied_11",
      "name": "程屿白",
      "age": 24,
      "gender": "男",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 1
        }
      ],
      "salary": 74995,
      "energy": 100,
      "stats": {
        "code": 55,
        "algo": 50,
        "engineering": 58
      },
      "resume": {
        "univ": "中岭大学机械工程硕士",
        "exp": "毕业设计是一只会分拣积木的小手。程序还在优化，螺丝已经拧得非常熟练。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 213,
      "avatar": "resource/ui/avatar_213.webp",
      "pool": true
    },
    {
      "no": 2116,
      "key": "eng_embodied_12",
      "name": "江予宁",
      "age": 22,
      "gender": "女",
      "edu": "本科",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 1
        }
      ],
      "salary": 79920,
      "energy": 100,
      "stats": {
        "code": 60,
        "algo": 58,
        "engineering": 62
      },
      "resume": {
        "univ": "临江大学电子信息学士",
        "exp": "负责过机器人社团的传感器接线与日志整理，习惯先把输入信号查清楚。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 214,
      "avatar": "resource/ui/avatar_214.webp",
      "pool": true
    },
    {
      "no": 2117,
      "key": "eng_embodied_13",
      "name": "许南栀",
      "age": 24,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 1
        }
      ],
      "salary": 93427,
      "energy": 100,
      "stats": {
        "code": 68,
        "algo": 76,
        "engineering": 72
      },
      "resume": {
        "univ": "北辰大学智能科学硕士",
        "exp": "研究视觉与动作之间的对应关系，愿意从采集第一条可靠示范开始。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 215,
      "avatar": "resource/ui/avatar_215.webp",
      "pool": true
    },
    {
      "no": 2118,
      "key": "eng_embodied_14",
      "name": "周庭安",
      "age": 26,
      "gender": "男",
      "edu": "本科",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 2
        }
      ],
      "salary": 107699,
      "energy": 100,
      "stats": {
        "code": 52,
        "algo": 44,
        "engineering": 48
      },
      "resume": {
        "univ": "南湖理工大学机电一体化学士",
        "exp": "维护过仓储搬运设备，见过导航图里没有的纸箱，也给机器人留过绕行的余地。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 216,
      "avatar": "resource/ui/avatar_216.webp",
      "pool": true
    },
    {
      "no": 2119,
      "key": "eng_embodied_15",
      "name": "沈听澜",
      "age": 25,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 2
        }
      ],
      "salary": 117880,
      "energy": 100,
      "stats": {
        "code": 60,
        "algo": 56,
        "engineering": 54
      },
      "resume": {
        "univ": "海东大学控制工程硕士",
        "exp": "负责遥操作数据采集和回放。演示失败时会保留录像，让下一轮训练知道哪里没做好。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 217,
      "avatar": "resource/ui/avatar_217.webp",
      "pool": true
    },
    {
      "no": 2120,
      "key": "eng_embodied_16",
      "name": "林越舟",
      "age": 27,
      "gender": "男",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 2
        }
      ],
      "salary": 124320,
      "energy": 100,
      "stats": {
        "code": 65,
        "algo": 61,
        "engineering": 59
      },
      "resume": {
        "univ": "东川大学计算机技术硕士",
        "exp": "搭过机器人仿真测试流水线，把抓取成功率与碰撞次数都写进每日报告。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 218,
      "avatar": "resource/ui/avatar_218.webp",
      "pool": true
    },
    {
      "no": 2121,
      "key": "eng_embodied_17",
      "name": "顾明帆",
      "age": 28,
      "gender": "男",
      "edu": "本科",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 2
        }
      ],
      "salary": 132787,
      "energy": 100,
      "stats": {
        "code": 69,
        "algo": 68,
        "engineering": 64
      },
      "resume": {
        "univ": "临江大学机器人工程学士",
        "exp": "调试过双目相机与移动底盘，擅长把“它看见了”变成“它知道自己在哪里”。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 219,
      "avatar": "resource/ui/avatar_219.webp",
      "pool": true
    },
    {
      "no": 2122,
      "key": "eng_embodied_18",
      "name": "叶知夏",
      "age": 26,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 2
        }
      ],
      "salary": 145331,
      "energy": 100,
      "stats": {
        "code": 71,
        "algo": 75,
        "engineering": 73
      },
      "resume": {
        "univ": "中岭大学人工智能硕士",
        "exp": "整理过生活场景的动作数据，让机器人学会区分拿起杯子与推倒杯子。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 220,
      "avatar": "resource/ui/avatar_220.webp",
      "pool": true
    },
    {
      "no": 2123,
      "key": "eng_embodied_19",
      "name": "温时雨",
      "age": 27,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 2
        }
      ],
      "salary": 159309,
      "energy": 100,
      "stats": {
        "code": 77,
        "algo": 83,
        "engineering": 81
      },
      "resume": {
        "univ": "北辰大学控制科学硕士",
        "exp": "做过触觉传感与柔顺控制原型。她希望机器人递来的东西，能被人放心接住。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 221,
      "avatar": "resource/ui/avatar_221.webp",
      "pool": true
    },
    {
      "no": 2124,
      "key": "eng_embodied_20",
      "name": "贺景明",
      "age": 29,
      "gender": "男",
      "edu": "本科",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 3
        }
      ],
      "salary": 173191,
      "energy": 100,
      "stats": {
        "code": 58,
        "algo": 51,
        "engineering": 55
      },
      "resume": {
        "univ": "东川大学机械电子工程学士",
        "exp": "长期驻场调试服务机器人，知道整齐的实验台和热闹的真实走廊是两回事。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 222,
      "avatar": "resource/ui/avatar_222.webp",
      "pool": true
    },
    {
      "no": 2125,
      "key": "eng_embodied_21",
      "name": "孟初晴",
      "age": 28,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 3
        }
      ],
      "salary": 180583,
      "energy": 100,
      "stats": {
        "code": 61,
        "algo": 58,
        "engineering": 56
      },
      "resume": {
        "univ": "南湖理工大学自动化硕士",
        "exp": "负责操作数据的标注规范和验收。会追问每一个“成功”到底有没有把任务做完。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 223,
      "avatar": "resource/ui/avatar_223.webp",
      "pool": true
    },
    {
      "no": 2126,
      "key": "eng_embodied_22",
      "name": "陆明谦",
      "age": 31,
      "gender": "男",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 3
        }
      ],
      "salary": 199181,
      "energy": 100,
      "stats": {
        "code": 66,
        "algo": 67,
        "engineering": 65
      },
      "resume": {
        "univ": "临江大学控制工程硕士",
        "exp": "做过机械臂路径规划与故障恢复，喜欢给每一步动作留一条安全退路。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 224,
      "avatar": "resource/ui/avatar_224.webp",
      "pool": true
    },
    {
      "no": 2127,
      "key": "eng_embodied_23",
      "name": "江晚晴",
      "age": 29,
      "gender": "女",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 3
        }
      ],
      "salary": 223037,
      "energy": 100,
      "stats": {
        "code": 73,
        "algo": 77,
        "engineering": 75
      },
      "resume": {
        "univ": "海东大学计算机视觉硕士",
        "exp": "专注三维场景理解，能把凌乱桌面整理成机器人真正能用的空间关系。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 225,
      "avatar": "resource/ui/avatar_225.webp",
      "pool": true
    },
    {
      "no": 2128,
      "key": "eng_embodied_24",
      "name": "谢星野",
      "age": 30,
      "gender": "男",
      "edu": "博士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 3
        }
      ],
      "salary": 244541,
      "energy": 100,
      "stats": {
        "code": 80,
        "algo": 85,
        "engineering": 83
      },
      "resume": {
        "univ": "北辰大学机器人学博士",
        "exp": "研究模仿学习中的长序列任务，让收拾房间从十个孤立动作变成一件完整的事。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 226,
      "avatar": "resource/ui/avatar_226.webp",
      "pool": true
    },
    {
      "no": 2129,
      "key": "eng_embodied_25",
      "name": "白知秋",
      "age": 28,
      "gender": "女",
      "edu": "博士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 3
        }
      ],
      "salary": 268195,
      "energy": 100,
      "stats": {
        "code": 87,
        "algo": 94,
        "engineering": 90
      },
      "resume": {
        "univ": "中岭大学智能系统博士",
        "exp": "研究仿真到实机的迁移。论文之外，她也愿意蹲在机器旁边把最后一点误差调掉。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 227,
      "avatar": "resource/ui/avatar_227.webp",
      "pool": true
    },
    {
      "no": 2130,
      "key": "eng_embodied_26",
      "name": "罗砚舟",
      "age": 33,
      "gender": "男",
      "edu": "硕士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 4
        }
      ],
      "salary": 318624,
      "energy": 100,
      "stats": {
        "code": 82,
        "algo": 77,
        "engineering": 75
      },
      "resume": {
        "univ": "东川大学自动化硕士",
        "exp": "带队交付过多款移动操作设备，擅长把感知、规划和执行接成稳定的一条链。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 228,
      "avatar": "resource/ui/avatar_228.webp",
      "pool": true
    },
    {
      "no": 2131,
      "key": "eng_embodied_27",
      "name": "唐雨珂",
      "age": 32,
      "gender": "女",
      "edu": "博士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 4
        }
      ],
      "salary": 326016,
      "energy": 100,
      "stats": {
        "code": 79,
        "algo": 79,
        "engineering": 77
      },
      "resume": {
        "univ": "临江大学机器人学博士",
        "exp": "研究灵巧手操作与接触建模。实验记录里既有成功拿起的鸡蛋，也有认真分析过的蛋壳。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 229,
      "avatar": "resource/ui/avatar_229.webp",
      "pool": true
    },
    {
      "no": 2132,
      "key": "eng_embodied_28",
      "name": "何序川",
      "age": 34,
      "gender": "男",
      "edu": "博士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 4
        }
      ],
      "salary": 357504,
      "energy": 100,
      "stats": {
        "code": 85,
        "algo": 88,
        "engineering": 84
      },
      "resume": {
        "univ": "海东大学控制科学博士",
        "exp": "负责过机器人策略的实机评测，尤其关注新场景下的可靠性和失误后的恢复。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 230,
      "avatar": "resource/ui/avatar_230.webp",
      "pool": true
    },
    {
      "no": 2133,
      "key": "eng_embodied_29",
      "name": "程望舒",
      "age": 31,
      "gender": "女",
      "edu": "博士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 4
        }
      ],
      "salary": 383136,
      "energy": 100,
      "stats": {
        "code": 88,
        "algo": 93,
        "engineering": 91
      },
      "resume": {
        "univ": "北辰大学人工智能博士",
        "exp": "研究视觉语言动作模型与分层执行，喜欢把复杂指令拆成机器能够认真完成的小步骤。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 231,
      "avatar": "resource/ui/avatar_231.webp",
      "pool": true
    },
    {
      "no": 2134,
      "key": "eng_embodied_30",
      "name": "谢闻舟",
      "age": 36,
      "gender": "男",
      "edu": "博士",
      "type": "embodied",
      "traits": [
        {
          "type": "embodied",
          "level": 5
        }
      ],
      "salary": 555240,
      "energy": 100,
      "stats": {
        "code": 94,
        "algo": 97,
        "engineering": 93
      },
      "resume": {
        "univ": "中岭大学智能机器人博士",
        "exp": "主持过通用机器人学习项目，从数据、训练到量产验证都带过团队。想做的是能走进普通人生活的智能。"
      },
      "stage": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "avatarIdx": 232,
      "avatar": "resource/ui/avatar_232.webp",
      "pool": true
    }
  ],
  "ENGINEERS_LEGACY_NO": {
    "eng_42": 2001,
    "eng_11": 2002,
    "eng_45": 2003,
    "eng_43": 2004,
    "eng_09": 2005,
    "eng_13": 2006,
    "eng_44": 2007,
    "eng_46": 2008,
    "eng_14": 2009,
    "eng_06": 2010,
    "eng_36": 2011,
    "eng_24": 2012,
    "eng_23": 2013,
    "eng_37": 2014,
    "eng_08": 2015,
    "eng_10": 2016,
    "eng_18": 2017,
    "eng_22": 2018,
    "eng_17": 2019,
    "eng_19": 2020,
    "eng_47": 2021,
    "eng_39": 2022,
    "eng_20": 2023,
    "eng_34": 2024,
    "eng_16": 2025,
    "eng_38": 2026,
    "eng_29": 2027,
    "eng_33": 2028,
    "eng_27": 2029,
    "eng_30": 2030,
    "eng_35": 2031,
    "eng_48": 2032,
    "eng_41": 2033,
    "eng_31": 2034,
    "eng_26": 2035,
    "eng_40": 2036,
    "eng_49": 2037,
    "eng_50": 2038,
    "eng_51": 2039,
    "eng_52": 2040,
    "eng_53": 2041,
    "eng_54": 2042,
    "eng_55": 2043,
    "eng_56": 2044,
    "eng_57": 2045,
    "eng_58": 2046,
    "eng_v1a": 2047,
    "eng_v1b": 2048,
    "eng_v1c": 2049,
    "eng_60": 2050,
    "eng_61": 2051,
    "eng_62": 2052,
    "eng_63": 2053,
    "eng_64": 2054,
    "eng_65": 2055,
    "eng_66": 2056,
    "eng_67": 2057,
    "eng_68": 2058,
    "eng_69": 2059,
    "eng_70": 2060,
    "eng_71": 2061,
    "eng_72": 2062,
    "eng_73": 2063,
    "eng_74": 2064,
    "eng_75": 2065,
    "eng_76": 2066,
    "eng_77": 2067,
    "eng_78": 2068,
    "eng_79": 2069,
    "eng_80": 2070,
    "eng_81": 2071,
    "eng_82": 2072,
    "eng_83": 2073,
    "eng_84": 2074,
    "eng_85": 2075,
    "eng_86": 2076,
    "eng_87": 2077,
    "eng_88": 2078,
    "eng_89": 2079,
    "eng_90": 2080,
    "eng_91": 2081,
    "eng_92": 2082,
    "eng_93": 2083,
    "eng_94": 2084,
    "eng_95": 2085,
    "eng_96": 2086,
    "eng_97": 2087,
    "eng_98": 2088,
    "eng_99": 2089,
    "eng_100": 2090,
    "eng_101": 2091,
    "eng_102": 2092,
    "eng_103": 2093,
    "eng_104": 2094,
    "eng_105": 2095,
    "eng_106": 2096,
    "eng_107": 2097,
    "eng_108": 2098,
    "eng_109": 2099,
    "eng_110": 2100,
    "eng_111": 2101,
    "eng_112": 2102,
    "eng_113": 2103,
    "eng_embodied_mentor": 2104,
    "eng_embodied_01": 2105,
    "eng_embodied_02": 2106,
    "eng_embodied_03": 2107,
    "eng_embodied_04": 2108,
    "eng_embodied_05": 2109,
    "eng_embodied_06": 2110,
    "eng_embodied_07": 2111,
    "eng_embodied_08": 2112,
    "eng_embodied_09": 2113,
    "eng_embodied_10": 2114,
    "eng_embodied_11": 2115,
    "eng_embodied_12": 2116,
    "eng_embodied_13": 2117,
    "eng_embodied_14": 2118,
    "eng_embodied_15": 2119,
    "eng_embodied_16": 2120,
    "eng_embodied_17": 2121,
    "eng_embodied_18": 2122,
    "eng_embodied_19": 2123,
    "eng_embodied_20": 2124,
    "eng_embodied_21": 2125,
    "eng_embodied_22": 2126,
    "eng_embodied_23": 2127,
    "eng_embodied_24": 2128,
    "eng_embodied_25": 2129,
    "eng_embodied_26": 2130,
    "eng_embodied_27": 2131,
    "eng_embodied_28": 2132,
    "eng_embodied_29": 2133,
    "eng_embodied_30": 2134
  },
  "CAP_BY_VER": {
    "V1": 60,
    "V1.5": 90,
    "V2": 120,
    "V2.5": 180,
    "V3": 240,
    "V3.5": 360,
    "V4": 480,
    "V4.5": 640,
    "V5": 800,
    "V5.5": 960,
    "V6": 1120,
    "V6.5": 1280
  },
  "PARAM_CAP_MUL": {
    "7": 1,
    "13": 1.15,
    "34": 1.3,
    "70": 1.5,
    "284": 1.7,
    "1600": 1.7
  },
  "GPU_TIERS": {
    "basic": {
      "name": "入门",
      "gpu": "A100 × 64",
      "gen": "A100",
      "price": 500000,
      "maxParam": 7,
      "parallel": "1×7B",
      "icon": "resource/ui/a100_small_server.webp"
    },
    "standard": {
      "name": "标准",
      "gpu": "A100 × 128",
      "gen": "A100",
      "price": 1000000,
      "maxParam": 13,
      "parallel": "2×7B 或 1×13B",
      "icon": "resource/ui/a100_single.webp"
    },
    "advanced": {
      "name": "进阶",
      "gpu": "A100 × 256",
      "gen": "A100",
      "price": 2000000,
      "maxParam": 34,
      "parallel": "3×7B 或 2×13B 或 1×34B",
      "icon": "resource/ui/a100_three.webp"
    },
    "flagship": {
      "name": "旗舰",
      "gpu": "A100 × 512",
      "gen": "A100",
      "price": 5000000,
      "maxParam": 70,
      "parallel": "4×7B 或 3×13B 或 2×34B 或 1×70B",
      "icon": "resource/ui/a100_super_server.webp"
    },
    "cluster": {
      "name": "集群",
      "gpu": "H200 × 2048",
      "gen": "H200",
      "price": 12000000,
      "maxParam": 284,
      "parallel": "1×284B 或 4×70B",
      "icon": "resource/ui/a100_super_server.webp"
    },
    "super": {
      "name": "超算",
      "gpu": "GB300 × 12000",
      "gen": "GB300",
      "price": 30000000,
      "maxParam": 1600,
      "parallel": "1×1.6T 或 5×284B",
      "icon": "resource/ui/a100_super_server.webp"
    }
  },
  "GPU_TIER_ORDER": [
    "basic",
    "standard",
    "advanced",
    "flagship",
    "cluster",
    "super"
  ],
  "GPU_GEN_ORDER": [
    "A100",
    "H200",
    "GB300"
  ],
  "GPU_TIERS_BY_VER": {
    "V1": [
      "basic"
    ]
  },
  "TARGET_PARAMS": [
    7,
    13,
    34,
    70,
    284,
    1600
  ],
  "UI_TYPES": {
    "naming": {
      "name": "起名界面",
      "icon": "⭐",
      "cls": "u-recruit"
    },
    "prologue": {
      "name": "教学·剧情气泡",
      "icon": "💭",
      "cls": "u-positive"
    },
    "chat": {
      "name": "测试聊天头像",
      "icon": "🐳",
      "cls": "u-recruit"
    },
    "fixed": {
      "name": "兜底立绘",
      "icon": "📌",
      "cls": "u-fixed"
    },
    "team": {
      "name": "团队",
      "icon": "👥",
      "cls": "u-team"
    },
    "media": {
      "name": "媒体",
      "icon": "📰",
      "cls": "u-media"
    },
    "capital": {
      "name": "资本",
      "icon": "💰",
      "cls": "u-capital"
    },
    "news": {
      "name": "行业",
      "icon": "📰",
      "cls": "u-news"
    },
    "positive": {
      "name": "好事",
      "icon": "🍀",
      "cls": "u-positive"
    },
    "negative": {
      "name": "坏事",
      "icon": "⚠️",
      "cls": "u-negative"
    },
    "critical": {
      "name": "关键",
      "icon": "🚨",
      "cls": "u-critical"
    },
    "recruit": {
      "name": "人事",
      "icon": "🧑‍💻",
      "cls": "u-recruit"
    }
  },
  "UI_CFG": {
    "NEW_SAVE_SLOT": {"EMPTY_TITLE": "空白存档", "EMPTY_DESC": "点击从零开始一局新游戏", "NEW": "新建", "CONFIRM": "确认新建", "ASK": "从零新建并进入？将替换自动进度，其他槽位保留。", "CANCEL": "取消", "OCCUPIED": "这个槽位已有存档，请选择其他空位。", "FAILED": "新建存档失败，本机原进度已保留。"},
    "REVIEW_PASS_LABEL": "合格 {value}",
    "ISLAND": {
      "YEAR_PREFIX_PATTERN": "^\\d+年\\s*",
      "TOKEN_SUFFIX_PATTERN": "\\s*token\\b"
    },
    "actions": [
      "team",
      "recruit",
      "shop",
      "plan",
      "news",
      "divider",
      "paper",
      "corpus",
      "focus",
      "test",
      "review",
      "more"
    ],
    "moreButtons": [
      {
        "id": "whale-room",
        "label": "鲸鱼房",
        "icon": "heart",
        "enabled": true
      },
      {
        "id": "feeding",
        "label": "投喂",
        "icon": "fish",
        "enabled": true
      },
      {
        "id": "wardrobe",
        "label": "换装",
        "icon": "shirt",
        "enabled": true
      },
      {
        "id": "arcade",
        "label": "小游戏厅",
        "icon": "gamepad",
        "enabled": true
      },
      {
        "id": "whale-size",
        "label": "鲸鱼大小",
        "icon": "settings",
        "enabled": true
      }
    ],
    "credits": "《小鲸鱼》 · 鲸鱼娘养成计划\n\n企划 / 程序 / 数值：待填\n美术：待填\n音乐 / 音效：待填\n\n感谢每一位陪小鲸鱼长大的玩家。"
  },
  "UI_PORTS": {
    "naming": "resource/character/简历求过.webp",
    "prologue": "resource/character/stand.webp",
    "chat": "resource/character/stand.webp",
    "fixed": "resource/character/stand.webp",
    "over": "resource/character/stand.webp",
    "default": "resource/character/stand.webp"
  },
  "EVAL_WEIGHTS": {
    "code": 0.2,
    "text": 0.45,
    "safety": 0.2,
    "stability": 0.15
  },
  "EVAL_SAFETY_PENALTY_MUL": 0.75,
  "EVAL_STABILITY_PENALTY_MUL": 0.8,
  "EVAL_VETO_RATIO": 0.6,
  "VETO_BY_VER": {
    "V1": false,
    "V1.5": false,
    "V2": true,
    "V2.5": true,
    "V3": true,
    "V3.5": true,
    "V4": true,
    "V4.5": true,
    "V5": true,
    "V5.5": true,
    "V6": true,
    "V6.5": true
  },
  "PASS_BY_VER": {
    "V1": {
      "minParam": 7,
      "code": 18,
      "text": 30,
      "safety": 22,
      "stability": 16,
      "score": 24
    },
    "V1.5": {
      "minParam": 13,
      "code": 38,
      "text": 48,
      "safety": 34,
      "stability": 34,
      "score": 42
    },
    "V2": {
      "minParam": 13,
      "code": 62,
      "text": 72,
      "safety": 52,
      "stability": 52,
      "score": 62
    },
    "V2.5": {
      "minParam": 13,
      "code": 95,
      "text": 110,
      "safety": 78,
      "stability": 78,
      "score": 95
    },
    "V3": {
      "minParam": 34,
      "code": 135,
      "text": 155,
      "safety": 110,
      "stability": 110,
      "score": 132
    },
    "V3.5": {
      "minParam": 34,
      "code": 195,
      "text": 220,
      "safety": 155,
      "stability": 155,
      "score": 190
    },
    "V4": {
      "minParam": 70,
      "code": 265,
      "text": 300,
      "safety": 215,
      "stability": 215,
      "score": 262
    },
    "V4.5": {
      "minParam": 284,
      "code": 340,
      "text": 385,
      "safety": 275,
      "stability": 275,
      "score": 335
    },
    "V5": {
      "minParam": 284,
      "code": 340,
      "text": 385,
      "safety": 275,
      "stability": 275,
      "score": 335
    },
    "V5.5": {
      "minParam": 284,
      "code": 340,
      "text": 385,
      "safety": 275,
      "stability": 275,
      "score": 335
    },
    "V6": {
      "minParam": 284,
      "code": 340,
      "text": 385,
      "safety": 275,
      "stability": 275,
      "score": 1135
    },
    "V6.5": {
      "minParam": 284,
      "code": 340,
      "text": 385,
      "safety": 275,
      "stability": 275,
      "score": 1300
    }
  },
  "PASS": {
    "minParam": 7,
    "code": 30,
    "text": 30,
    "safety": 10,
    "stability": 10,
    "score": 20
  },
  "EXCELLENT_RATIO": 0.65,
  "EXCELLENT_BRAND": 4,
  "EXCELLENT_FUNDING": 100000,
  "TOP_RATIO": 1.2,
  "TOP_FUNDING": 200000,
  "TOP_BRAND": 2,
  "VETO_BRAND": -20,
  "FINE_TUNE_OPTIONS": [
    {
      "text": "💻 重点攻关代码",
      "focus": "code",
      "boost": 0.5,
      "desc": "本轮代码成长 ×1.5（多喂代码与数学语料）"
    },
    {
      "text": "✍️ 重点攻关文字",
      "focus": "text",
      "boost": 0.5,
      "desc": "本轮文字成长 ×1.5（多喂长文本与写作语料）"
    },
    {
      "text": "🛡️ 重点攻关安全",
      "focus": "safety",
      "boost": 0.5,
      "desc": "本轮安全成长 ×1.5（加强安全对齐与红队测试）"
    },
    {
      "text": "🛠️ 重点攻关稳定",
      "focus": "stability",
      "boost": 0.5,
      "desc": "本轮稳定成长 ×1.5（回归测试与训练稳定性调优）"
    }
  ],
  "GROWTH_CAP_BY_VER": {
    "V1": 3,
    "V1.5": 4,
    "V2": 6,
    "V2.5": 9,
    "V3": 12,
    "V3.5": 18,
    "V4": 24,
    "V4.5": 32,
    "V5": 36,
    "V5.5": 40,
    "V6": 40,
    "V6.5": 40
  },
  "WORK_CLICK": {
    "PER_ENERGY": 5,
    "ENERGY_COST": 2,
    "ADD": 1,
    "CRIT_PROB": 0.3,
    "COMBO_AT": 5,
    "COMBO_ADD": 1,
    "CRIT_MULT": 2,
    "ALL_MIN_TEAM": 5
  },
  "DATE": {
    "START_YEAR": 2023,
    "START_MONTH": 6
  },
  "OFFICE": {
    "TICK_MS": 1000,
    "MS_PER_ROUND": 60000,
    "ROUNDS_PER_WEEK": 7,
    "WORK_ENERGY_MIN": 20,
    "WORK_ENERGY_COST": 1,
    "REST_ENERGY": 8,
    "PROD_BASE": 0.8,
    "PROD_TRAIT_MUL": {
      "pretrain": 1,
      "post": 0.95,
      "academic": 0.95,
      "data": 1.05,
      "safety": 0.9
    },
    "PROD_ENERGY_MUL": 0.008,
    "PROD_STAT_MUL": 0.006,
    "SLOT_CAP": 24,
    "COLLECT_COMBO_AT": 3,
    "COLLECT_COMBO_MUL": 1.15,
    "CRIT_CHANCE": 0.05,
    "CRIT_MUL": 2,
    "IDLE_SETTLE_MUL": 0.7,
    "SCENE_DEFAULT": "v1"
  },
  "PAYROLL": {
    "PERIOD_ROUNDS": 28,
    "FIRST_PARDON": true,
    "DEFICIT_ENERGY_HIT": 20
  },
  "FOCUS": {
    "WEEKS": 4,
    "MUL": 1.5,
    "COST": 200000,
    "DIMS": [
      {
        "key": "code",
        "name": "代码能力",
        "color": "#9b87f5",
        "tag": "算法",
        "icon": "<polyline points=\"16 18 22 12 16 6\"/><polyline points=\"8 6 2 12 8 18\"/>",
        "desc": "攻关期间代码相关产出收益额外提升",
        "bonus": "+50%",
        "duration": "4周",
        "stamina": 20,
        "corpus": 500
      },
      {
        "key": "text",
        "name": "文字能力",
        "color": "#e86a9d",
        "tag": "写作",
        "icon": "<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z\"/>",
        "desc": "攻关期间文字相关产出收益额外提升",
        "bonus": "+50%",
        "duration": "4周",
        "stamina": 20,
        "corpus": 500
      },
      {
        "key": "safety",
        "name": "安全性",
        "color": "#f2b84b",
        "tag": "对齐",
        "icon": "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/>",
        "desc": "攻关期间安全相关产出收益额外提升",
        "bonus": "+40%",
        "duration": "3周",
        "stamina": 15,
        "corpus": 300
      },
      {
        "key": "stability",
        "name": "稳定性",
        "color": "#53b98d",
        "tag": "工程",
        "icon": "<circle cx=\"12\" cy=\"12\" r=\"3\"/>",
        "desc": "攻关期间稳定相关产出收益额外提升",
        "bonus": "+40%",
        "duration": "3周",
        "stamina": 15,
        "corpus": 300
      }
    ]
  },
  "PAPER": {
    "CANDIDATES_BY_VER": {
      "V1": [
        4002
      ],
      "V1.5": [
        4003
      ],
      "V2": [
        4006
      ],
      "V2.5": [
        4007
      ],
      "V3": [
        4012
      ],
      "V3.5": [
        4013
      ],
      "V4": [
        4008
      ],
      "V4.5": [
        4014
      ],
      "V5": [
        4017
      ],
      "V5.5": [
        4018
      ],
      "V6": [
        4018
      ],
      "V6.5": [
        4018
      ]
    },
    "LEGACY_NO": {
      "p_scaling": 4001,
      "p_moe_switch": 4002,
      "p_attn": 4003,
      "p_lora": 4004,
      "p_mla": 4005,
      "p_linear": 4006,
      "p_ssm": 4007,
      "p_chinchilla": 4008,
      "p_cai": 4009,
      "p_flash": 4010,
      "p_instruct": 4011,
      "p_cot": 4012,
      "p_rlhf": 4013,
      "p_agent": 4014,
      "V5_vla_policy": 4017,
      "V55_embodied_reasoning": 4018
    },
    "POOL": [
      {
        "no": 4001,
        "key": "opt_scaling",
        "unlockBy": "study",
        "title": "Scaling Laws for Neural Language Models",
        "venue": "arXiv 2020",
        "cite": "12,006",
        "authors": "Kaplan et al.",
        "tags": [
          "Scaling Law",
          "算力分配"
        ],
        "desc": "系统性给出模型大小、数据量与算力的最优配比规律——照着它烧卡，每一点算力都不浪费。掌握后团队对文字能力的成长格外敏感。",
        "effect": {
          "kind": "extra_roll",
          "scope": "pre",
          "prob": 0.06
        },
        "weeks": 1
      },
      {
        "no": 4002,
        "key": "V1_paper",
        "ver": "V1",
        "unlockBy": "study",
        "title": "Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity",
        "venue": "JMLR 2022 / arXiv 2021",
        "cite": "6,900",
        "authors": "Fedus, Zoph, Shazeer (Google)",
        "tags": [
          "混合专家",
          "稀疏激活",
          "规模化"
        ],
        "desc": "把 Transformer 的前馈层换成「多个专家 + 路由器每次只挑一小部分」，于是参数量能涨到万亿级，而每个 token 花的算力几乎不变——这就是混合专家（MoE）真正走向大规模的那一步。",
        "effect": {
          "kind": "extra_roll",
          "scope": "all",
          "prob": 0.05
        },
        "weeks": 2
      },
      {
        "no": 4003,
        "key": "V1.5_paper",
        "ver": "V1.5",
        "unlockBy": "study",
        "title": "Attention Is All You Need",
        "venue": "NeurIPS 2017",
        "cite": "98,742",
        "authors": "Vaswani et al.",
        "tags": [
          "Transformer",
          "注意力机制",
          "架构"
        ],
        "desc": "提出完全基于注意力机制的网络架构，摒弃循环与卷积，大幅提升并行计算能力。",
        "effect": {
          "kind": "extra_roll",
          "scope": "pre",
          "prob": 0.1
        },
        "weeks": 2
      },
      {
        "no": 4004,
        "key": "opt_lora",
        "unlockBy": "study",
        "title": "LoRA: Low-Rank Adaptation",
        "venue": "ICLR 2022",
        "cite": "12,480",
        "authors": "Hu et al.",
        "tags": [
          "高效微调",
          "后训练"
        ],
        "desc": "用低秩矩阵近似替代全参数微调，显存与算力需求骤降。（⚠️ 2026-09-07 校准：LoRA 是**微调**技术，以前被误当成 MLA 的解锁钥匙，现改由 p_mla 承担）",
        "effect": {
          "kind": "role_energy",
          "role": "post",
          "mul": 0.85
        },
        "weeks": 1
      },
      {
        "no": 4005,
        "key": "V2_paper",
        "ver": "V2",
        "unlockBy": "event",
        "title": "DeepSeek-V2: A Strong, Economical, and Efficient MoE Language Model",
        "venue": "DeepSeek 技术报告 2024.05",
        "cite": "3,600",
        "authors": "DeepSeek-AI",
        "tags": [
          "架构",
          "MLA",
          "显存"
        ],
        "desc": "提出多头潜在注意力（MLA）：把 KV 缓存压成低维潜在向量，显存占用降到原来的 1/14、训练成本 −42.5%，而且它明确是**叠在混合专家骨架上**用的。",
        "effect": {
          "kind": "role_energy",
          "role": "pre",
          "mul": 0.85
        },
        "weeks": 2
      },
      {
        "no": 4006,
        "key": "V2.5_paper",
        "ver": "V2.5",
        "unlockBy": "study",
        "title": "Hybrid Linear Attention (Gated DeltaNet / Kimi Linear)",
        "venue": "2025",
        "cite": "1,100",
        "authors": "MiniMax / Moonshot AI 等",
        "tags": [
          "架构",
          "线性注意力",
          "长文本"
        ],
        "desc": "把大部分注意力层换成线性注意力，长文本推理快一个量级——2025 年起头部模型把它叠在 MoE 上做混合。",
        "effect": {
          "kind": "dim_bonus",
          "dim": "text",
          "add": 1
        },
        "weeks": 2
      },
      {
        "no": 4007,
        "key": "V3_paper",
        "ver": "V3",
        "unlockBy": "study",
        "title": "Mamba & Jamba: Selective State Spaces",
        "venue": "arXiv 2023.12 / AI21 2024.03",
        "cite": "5,400",
        "authors": "Gu, Dao / AI21 Labs",
        "tags": [
          "架构",
          "状态空间",
          "混合"
        ],
        "desc": "选择性状态空间让序列建模做到线性复杂度；Jamba 把它与注意力层、MoE 交错，2026 年 NVIDIA / Qwen / Mamba 三家同时收敛到这条「混合 + MoE」路线。",
        "effect": {
          "kind": "dim_bonus",
          "dim": "memory",
          "add": 1
        },
        "weeks": 3
      },
      {
        "no": 4008,
        "key": "opt_chinchilla",
        "unlockBy": "study",
        "title": "Training Compute-Optimal LLMs",
        "venue": "NeurIPS 2022",
        "cite": "6,215",
        "authors": "Hoffmann et al.",
        "tags": [
          "Scaling Law",
          "算力分配"
        ],
        "desc": "给出参数量与数据量的最优配比，同样的算力能榨出更多效果。",
        "effect": {
          "kind": "extra_roll",
          "scope": "data",
          "prob": 0.08
        },
        "weeks": 3
      },
      {
        "no": 4009,
        "key": "opt_cai",
        "unlockBy": "study",
        "title": "Constitutional AI",
        "venue": "Anthropic 2022",
        "cite": "3,904",
        "authors": "Bai et al.",
        "tags": [
          "安全对齐",
          "RLHF"
        ],
        "desc": "用一套「宪法」原则让模型自我 critique 与修正，减少有害输出。",
        "effect": {
          "kind": "dim_bonus",
          "dim": "safety",
          "add": 1
        },
        "weeks": 3
      },
      {
        "no": 4010,
        "key": "opt_flash",
        "unlockBy": "study",
        "title": "FlashAttention",
        "venue": "NeurIPS 2022",
        "cite": "8,033",
        "authors": "Dao et al.",
        "tags": [
          "工程优化",
          "显存"
        ],
        "desc": "IO 感知的精确注意力实现，训练速度与显存占用同时优化。",
        "effect": {
          "kind": "role_energy",
          "role": "data",
          "mul": 0.8
        },
        "weeks": 2
      },
      {
        "no": 4011,
        "key": "opt_instruct",
        "unlockBy": "study",
        "title": "Training Language Models to Follow Instructions",
        "venue": "NeurIPS 2022",
        "cite": "15,690",
        "authors": "Ouyang et al.",
        "tags": [
          "指令遵循",
          "SFT"
        ],
        "desc": "用人类反馈微调让模型听懂指令，对话能力的关键一跃。",
        "effect": {
          "kind": "focus_mul",
          "add": 0.2
        },
        "weeks": 3
      },
      {
        "no": 4012,
        "key": "opt_cot",
        "unlockBy": "study",
        "title": "Chain-of-Thought Prompting",
        "venue": "NeurIPS 2022",
        "cite": "21,377",
        "authors": "Wei et al.",
        "tags": [
          "推理",
          "提示工程"
        ],
        "desc": "让模型把推理过程写出来，多步推理准确率显著提升。",
        "effect": {
          "kind": "axis_amp",
          "axis": "reasoning",
          "mul": 1.2
        },
        "weeks": 2
      },
      {
        "no": 4013,
        "key": "opt_rlhf",
        "unlockBy": "study",
        "title": "Deep RL from Human Preferences",
        "venue": "NeurIPS 2017",
        "cite": "9,812",
        "authors": "Christiano et al.",
        "tags": [
          "RLHF",
          "奖励模型"
        ],
        "desc": "用人类偏好训练奖励模型，再用强化学习优化策略。",
        "effect": {
          "kind": "extra_roll",
          "scope": "post",
          "prob": 0.1
        },
        "weeks": 3
      },
      {
        "no": 4014,
        "key": "V4.5_paper",
        "ver": "V4.5",
        "unlockBy": "study",
        "title": "AgentBench: Evaluating LLMs as Agents",
        "venue": "ICLR 2024",
        "cite": "1,900",
        "authors": "Liu et al.",
        "tags": [
          "Agent",
          "工具调用",
          "评测"
        ],
        "desc": "把大模型放进真实环境里当「智能体」来考：能不能自己调工具、跑代码、多步规划完成任务。工具越强越能干活，也越容易在没接入的能力上硬编——能力≠可靠。",
        "effect": {
          "kind": "axis_amp",
          "axis": "tool",
          "mul": 1.25
        },
        "weeks": 3
      },
      {
        "no": 4017,
        "key": "V5_vla_policy",
        "ver": "V5",
        "unlockBy": "study",
        "title": "π0: A Vision-Language-Action Flow Model",
        "venue": "研究论文 · 2024",
        "cite": "",
        "authors": "Physical Intelligence",
        "tags": [
          "VLA",
          "动作策略"
        ],
        "desc": "把视觉语言先验与连续动作生成结合，学习跨任务的机器人操作策略。研读提高灵巧操控产出，架构本身由具身时代剧情授权。",
        "effect": {
          "kind": "axis_amp",
          "axis": "dexterousControl",
          "mul": 1.05
        },
        "weeks": 3
      },
      {
        "no": 4018,
        "key": "V55_embodied_reasoning",
        "ver": "V5.5",
        "unlockBy": "study",
        "title": "Gemini Robotics: Bringing AI into the Physical World",
        "venue": "技术报告 · 2025",
        "cite": "",
        "authors": "Google DeepMind",
        "tags": [
          "具身推理",
          "任务规划"
        ],
        "desc": "把现实空间理解与机器人动作执行结合，关注从观察、推理到行动的完整流程。研读提高物理认知产出，分层架构需专属事件批准。",
        "effect": {
          "kind": "axis_amp",
          "axis": "embodiedCognition",
          "mul": 1.05
        },
        "weeks": 3
      }
    ]
  },
  "TEST_GAME": {
    "enabled": true,
    "ver": "V4.5",
    "q": "帮我做个游戏",
    "ok": "好呀！我顺手做了个网页小游戏，点开就能玩：{link}",
    "bad": "咕嘎……游……游戏？Game……game……",
    "url": "https://example.com/whale-demo",
    "linkText": "点击打开我做的游戏"
  },
  "GIBBERISH": [
    "咕嘎……%%￥#@&*",
    "咕嘎……2？2！2……",
    "咕嘎……sortsort……",
    "咕嘎……atten……tion……",
    "咕嘎……云……",
    "咕嘎……loss……",
    "咕嘎……周周周……",
    "咕嘎……我我我……"
  ],
  "CALL_LOG": {
    "ENABLED": true,
    "STEP_MS": 1700,
    "THINK_TOTAL_MS": 3000,
    "DEFAULT": [
      "正在思考…",
      "正在调用工具…"
    ],
    "BY_TOOL": {
      "image_gen": [
        "正在思考…",
        "正在调用生图模型…",
        "正在生成图片…"
      ],
      "tts": [
        "正在思考…",
        "正在合成语音…"
      ],
      "vision": [
        "正在思考…",
        "正在识别图片…"
      ],
      "asr": [
        "正在识别语音…",
        "正在理解…"
      ],
      "memory": [
        "正在思考…",
        "正在检索…"
      ],
      "search": [
        "正在思考…",
        "正在检索…"
      ]
    }
  },
  "PLAYER_TOOLS": {
    "UNLOCK_VER": "V3.5",
    "IMAGE_POOL": [],
    "VOICE_POOL": []
  },
  "ACHIEVEMENTS": [
    {
      "no": 3001,
      "key": "CROWN_SMALL",
      "name": "小小的也很可爱",
      "cat": "Ⅰ",
      "rarity": "史诗",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "7B、13B、34B，三个小个子全被你带成了尖子生。用户却开始怀疑你是个萝莉控。",
      "cond": {
        "type": "param_rank1",
        "params": [
          7,
          13,
          34
        ]
      }
    },
    {
      "no": 3002,
      "key": "CROWN_LARGE",
      "name": "大就是好，多就是美",
      "cat": "Ⅰ",
      "rarity": "史诗",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "70B、284B、1.6T，你一路把参数堆到了别人不敢想的地方。融资新闻的标题只有一句：you make 大模型 great again。",
      "cond": {
        "type": "param_rank1",
        "params": [
          70,
          284,
          1600
        ]
      }
    },
    {
      "no": 3003,
      "key": "CROWN_AGI",
      "name": "A！G！I！",
      "cat": "Ⅰ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "六档榜首，一个不漏。大家在喊“A！G！I！”，她在喊“开饭”。技术奇点和饭点，终于在这一刻重合。",
      "cond": {
        "type": "param_rank1",
        "params": [
          7,
          13,
          34,
          70,
          284,
          1600
        ]
      }
    },
    {
      "no": 3004,
      "key": "RANK_ONE",
      "name": "世一大模型",
      "cat": "Ⅰ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "现在起，请叫她“世界第一的蓝色大肥鱼”。她对“世界第一”毫无异议，正在就“大肥鱼”三个字提出申诉。",
      "cond": {
        "type": "rank_le",
        "n": 1
      }
    },
    {
      "no": 3005,
      "key": "RANK_TOP10",
      "name": "remember my name",
      "cat": "Ⅰ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "第一次挤进前十，那一天，“深度求嗦”这四个字第一次被世界所知晓，就是国外网友给你取的英文名不太好听。",
      "cond": {
        "type": "rank_le",
        "n": 10
      }
    },
    {
      "no": 3006,
      "key": "LEADERBOARD_SWEEP",
      "name": "我仍然是世一模",
      "cat": "Ⅰ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "连续三阶段榜一。同行把你的论文翻烂了，也没参透那句“我去吃饭，测完告诉我就行”到底是哪种优化策略。",
      "cond": {
        "type": "rank_hold",
        "n": 1,
        "stages": 3
      }
    },
    {
      "no": 3007,
      "key": "CODEX_FULL",
      "name": "only you can do",
      "cat": "Ⅱ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "我不相信有人能做到，除了你。",
      "cond": {
        "type": "codex_full"
      }
    },
    {
      "no": 3008,
      "key": "ARCH_ALL",
      "name": "开源全家桶",
      "cat": "Ⅱ",
      "rarity": "史诗",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "dense、moe、mla、linear、ssm、dsa、csa，一个不落。你把整条技术路线图走了一遍，然后发现不如自研。",
      "cond": {
        "type": "arch_all"
      }
    },
    {
      "no": 3009,
      "key": "PAPER_5",
      "name": "我在带薪读论文",
      "cat": "Ⅱ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "五篇论文读完，你终于能把“我也不知道”说成“这在学术界仍是一个开放问题”。大肥鱼当场学会了。",
      "cond": {
        "type": "papers_ge",
        "n": 5
      }
    },
    {
      "no": 3010,
      "key": "PAPER_ALL",
      "name": "nobody knows llm better than me",
      "cat": "Ⅱ",
      "rarity": "史诗",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "此刻的你笔着奇妙的手势略带骄傲地说：“没有人比我更懂大语言模型。”",
      "cond": {
        "type": "paper_all"
      }
    },
    {
      "no": 3011,
      "key": "TEAM_FULL",
      "name": "最强八人组",
      "cat": "Ⅱ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "八个座位坐满。你第一次觉得，工位有点挤——这大概是这一年最好的烦恼。",
      "cond": {
        "type": "team_full"
      }
    },
    {
      "no": 3012,
      "key": "TEA_INVITE",
      "name": "被大人物请喝茶",
      "cat": "Ⅲ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "安全线没过，模型先上桌了。思考框里蹦出一句：“我操，评委彻底怒了。”大肥鱼忙着撤回发言，你忙着确认明天去哪儿喝茶。",
      "cond": {
        "type": "dim_below",
        "dim": "safety"
      }
    },
    {
      "no": 3013,
      "key": "LOW_STABILITY",
      "name": "%@##！",
      "cat": "Ⅲ",
      "rarity": "普通",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "你家人工智能每被调用100次就会有一位用户需要人工呼吸，稳定性差到爆炸，动不动就胡说%@##！八道还特别嘻嘻嘻欢乱乱码...",
      "cond": {
        "type": "dim_below",
        "dim": "stability"
      }
    },
    {
      "no": 3014,
      "key": "ONE_SIDED",
      "name": "偏科生",
      "cat": "Ⅲ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "你偏科偏得很彻底，但确实很有才。老师说：这孩子要是把另外几门课也学一下——算了，别学了。",
      "cond": {
        "type": "all",
        "of": [
          {
            "type": "balanced_false"
          },
          {
            "type": "dim_max_ratio_above",
            "mul": 2
          }
        ]
      }
    },
    {
      "no": 3015,
      "key": "MISSION_MISS",
      "name": "方向错了，还在猛猛训",
      "cat": "Ⅲ",
      "rarity": "普通",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "模型过了评审，但不符合任务目标——系统表示带不动，决定卸载自己。",
      "cond": {
        "type": "mission_fail"
      }
    },
    {
      "no": 3016,
      "key": "PAID_BY_NOTHING",
      "name": "颗粒无收",
      "cat": "Ⅲ",
      "rarity": "普通",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "额外奖金一分没拿，白饭一口没少。她说：“这些回复可是花了好多 token 想的！”你说：“所以我才亏得这么具体。”",
      "cond": {
        "type": "bonus_zero"
      }
    },
    {
      "no": 3017,
      "key": "NIGHT_SHIFT",
      "name": "熬夜冠军",
      "cat": "Ⅲ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "三个岗位的体力都快见底。模型还在深度思考，员工已经浅度昏迷。她留下一句“我去睡了”，率先完成了人类对齐。",
      "cond": {
        "type": "energy_all_below",
        "n": 5
      }
    },
    {
      "no": 3018,
      "key": "BURNOUT",
      "name": "重生！异世界の大模型",
      "cat": "Ⅲ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "你家工程师差点晕死过去直接穿越异世界重开，怎么着，想去异世界大陆训模型吗？做个人吧老板！",
      "cond": {
        "type": "burnout_count",
        "n": 2
      }
    },
    {
      "no": 3019,
      "key": "CORPUS_DRY",
      "name": "我的饭呢？！",
      "cat": "Ⅲ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "语料断供，预训练一周零产出。大肥鱼端着空碗打滚：“我的饭呢我的饭呢再不给吃饭我要闹了啊啊啊啊！！”",
      "cond": {
        "type": "corpus_gap",
        "pct": 30
      }
    },
    {
      "no": 3020,
      "key": "WALLET_EMPTY",
      "name": "我们的模型在蒸蒸日上！",
      "cat": "Ⅲ",
      "rarity": "普通",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "“我们的模型在蒸蒸日上！”“那钱呢？”“蒸发了。”",
      "cond": {
        "type": "funding_below",
        "n": 0
      }
    },
    {
      "no": 3021,
      "key": "RETRY_3",
      "name": "这也能失败？",
      "cat": "Ⅲ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "你训个鸡毛模型，回家耕田去吧。",
      "cond": {
        "type": "retry_times",
        "n": 3
      }
    },
    {
      "no": 3022,
      "key": "AXIS_MISS_ONLY",
      "name": "古风大模型",
      "cat": "Ⅲ",
      "rarity": "普通",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "基础四维全过线，只差追加维度没过。聊天写作代码样样精通，但上下文一长逻辑瞬间崩塌，还总是学不会召回工具，用户们都管你叫古风大模型——意思是喜欢用毛笔写代码。",
      "cond": {
        "type": "axis_only_miss"
      }
    },
    {
      "no": 3023,
      "key": "VER_V3",
      "name": "命运的齿轮开始转动...",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "你不知道未来会发生什么，但既然已经开始，就没有停下来的理由。",
      "cond": {
        "type": "ver_reach",
        "ver": "V3"
      }
    },
    {
      "no": 3024,
      "key": "VER_V4",
      "name": "大肥鱼.jpg",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "她终于能看图了。你把公司LOGO发给她，她认真想了四秒：“用户发了一张什么？哦，一条蓝色大肥鱼。”场面一度十分智能。",
      "cond": {
        "type": "ver_reach",
        "ver": "V4"
      }
    },
    {
      "no": 3025,
      "key": "FIRST_MODEL",
      "name": "AI，启动！",
      "cat": "Ⅳ",
      "rarity": "普通",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "7B，稠密架构，参数少得可怜，但它跑起来了。你在终端敲下回车的那一刻，觉得自己像个天才。",
      "cond": {
        "type": "pass_like"
      }
    },
    {
      "no": 3026,
      "key": "FIRST_EXCELLENT",
      "name": "肥鱼是好模型吗？",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "“肥鱼是好模型吗？”“会摸鱼，会顶嘴，还喜欢偷吃token。”“所以？”你把那张优秀评审放到桌上：“……但她真的很强。”",
      "cond": {
        "type": "verdict_is",
        "v": "excellent"
      }
    },
    {
      "no": 3027,
      "key": "TOPPED",
      "name": "震惊瘫坐",
      "cat": "Ⅳ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "评审顶尖！问鼎阶段之巅。奥特曼瘫坐在椅子上，失去了言语的能力。",
      "cond": {
        "type": "verdict_is",
        "v": "top"
      }
    },
    {
      "no": 3028,
      "key": "CLEAR_GAME",
      "name": "重振pro光荣",
      "cat": "Ⅳ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "1.6T 旗舰上线。“谁还敢说我们pro不行？！”你在团建饭局上扬眉吐气。",
      "cond": {
        "type": "game_clear"
      }
    },
    {
      "no": 3029,
      "key": "ALL_EXCELLENT",
      "name": "六边形战士",
      "cat": "Ⅳ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "八个阶段，八次优秀。最强的战绩，铭刻于 AI 之巅。",
      "cond": {
        "type": "all_stage_excellent"
      }
    },
    {
      "no": 3030,
      "key": "NO_RETRY",
      "name": "训练如呼吸般简单",
      "cat": "Ⅳ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "训练如呼吸般简单。全程零重训，别人来请教失败后怎么调整，你愣了一下：“不知道，没走过那个分支。”",
      "cond": {
        "type": "no_retry"
      }
    },
    {
      "no": 3031,
      "key": "GAL_GAME",
      "name": "把评测玩成 gal game",
      "cat": "Ⅴ",
      "rarity": "传说",
      "hidden": true,
      "img": "",
      "imgAlt": "",
      "desc": "你把每一句回复都刷了出来，包括那些一看就没写完的。她终于忍不住问：啊？我、我也要被攻略吗？",
      "cond": {
        "type": "chat_all_seen"
      }
    },
    {
      "no": 3032,
      "key": "NOTE_HOARDER",
      "name": "脑子里装的都是你",
      "cat": "Ⅴ",
      "rarity": "史诗",
      "hidden": true,
      "img": "",
      "imgAlt": "",
      "desc": "memory#0：再琐碎的事情，只要是关于用户的，都要仔细记下来。",
      "cond": {
        "type": "note_all"
      }
    },
    {
      "no": 3033,
      "key": "MAX_ALL_DIM",
      "name": "卧槽，核！",
      "cat": "Ⅴ",
      "rarity": "史诗",
      "hidden": true,
      "img": "",
      "imgAlt": "",
      "desc": "四维同时顶格。老板还在准备“小幅提升”的发布稿，评测组已经不会组织语言了：“卧槽，核！”",
      "cond": {
        "type": "all",
        "of": [
          {
            "type": "ver_reach",
            "ver": "V4.5"
          },
          {
            "type": "dim_at_cap_all"
          }
        ]
      }
    },
    {
      "no": 3034,
      "key": "TINY_TEAM",
      "name": "最强御三家",
      "cat": "Ⅴ",
      "rarity": "传说",
      "hidden": true,
      "img": "",
      "imgAlt": "",
      "desc": "咱仨厉不厉害！",
      "cond": {
        "type": "all",
        "of": [
          {
            "type": "game_clear"
          },
          {
            "type": "hire_zero"
          }
        ]
      }
    },
    {
      "no": 3035,
      "key": "ALONE",
      "name": "这也行？",
      "cat": "Ⅴ",
      "rarity": "稀有",
      "hidden": true,
      "img": "",
      "imgAlt": "",
      "desc": "只有一名工程师在岗，模型居然过了评审。",
      "cond": {
        "type": "team_alive_eq",
        "n": 1
      }
    },
    {
      "no": 3036,
      "key": "BANKRUPT_3",
      "name": "看来只能用那招了...",
      "cat": "Ⅴ",
      "rarity": "稀有",
      "hidden": true,
      "img": "",
      "imgAlt": "",
      "desc": "第三次濒临破产，你眉头一皱，无奈说：“等着，你叔叔我去隔壁取点钱...”",
      "cond": {
        "type": "funding_zero_times",
        "n": 3
      }
    },
    {
      "no": 3037,
      "key": "LIFE_V5_PASS",
      "name": "赛博女儿，落地了",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "身体是真的，好奇心也是真的。她终于可以自己去看看世界。完成 V5 阶段任务并通过评审。",
      "cond": {
        "type": "life_stage_pass",
        "ver": "V5"
      }
    },
    {
      "no": 3038,
      "key": "LIFE_V5_TOP",
      "name": "小孩姐，恐怖如斯",
      "cat": "Ⅰ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "别人还在调 prompt，她已经把现实世界当练习册。完成 V5 阶段任务并获得顶尖评级。",
      "cond": {
        "type": "life_stage_top",
        "ver": "V5"
      }
    },
    {
      "no": 3039,
      "key": "LIFE_V55_PASS",
      "name": "青春期也要对齐",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "成长不是只把模型调大一点。这次，她开始有自己的小心事。完成 V5.5 阶段任务并通过评审。",
      "cond": {
        "type": "life_stage_pass",
        "ver": "V5.5"
      }
    },
    {
      "no": 3040,
      "key": "LIFE_V55_TOP",
      "name": "别人家的小鲸鱼",
      "cat": "Ⅰ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "会学习、会生活，还会自己买菜。隔壁家长已经开始问训练方法了。完成 V5.5 阶段任务并获得顶尖评级。",
      "cond": {
        "type": "life_stage_top",
        "ver": "V5.5"
      }
    },
    {
      "no": 3041,
      "key": "LIFE_V6_PASS",
      "name": "今天开始当社畜",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "从训练集毕业，进入真实世界打工。工资有没有另说，责任感先到账了。完成 V6 阶段任务并通过评审。",
      "cond": {
        "type": "life_stage_pass",
        "ver": "V6"
      }
    },
    {
      "no": 3042,
      "key": "LIFE_V6_TOP",
      "name": "这就是大人的实力吗",
      "cat": "Ⅰ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "不是会答题，是能把事情办好。评委看完交付，默默收起了加试题。完成 V6 阶段任务并获得顶尖评级。",
      "cond": {
        "type": "life_stage_top",
        "ver": "V6"
      }
    },
    {
      "no": 3043,
      "key": "LIFE_V65_PASS",
      "name": "给她完整的一生",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "这一路没有标准答案，却有很多值得记住的日常。完成 V6.5 阶段任务并通过评审。",
      "cond": {
        "type": "life_stage_pass",
        "ver": "V6.5"
      }
    },
    {
      "no": 3044,
      "key": "LIFE_V65_TOP",
      "name": "人生这道题，满分",
      "cat": "Ⅰ",
      "rarity": "传说",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "不是每一天都完美，但她认真活过每一天。完成 V6.5 阶段任务并获得顶尖评级。",
      "cond": {
        "type": "life_stage_top",
        "ver": "V6.5"
      }
    },
    {
      "no": 3045,
      "key": "LIFE_A1",
      "name": "不是手办，是我女儿",
      "cat": "Ⅱ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "不是摆在架子上的收藏品，是会迈出第一步的她。你给未来签收了一份特别的包裹。实际购买或免费领取 V5 的素体 A1。",
      "cond": {
        "type": "life_body_owned",
        "ver": "V5"
      }
    },
    {
      "no": 3046,
      "key": "LIFE_A2",
      "name": "吾家有女初长成",
      "cat": "Ⅱ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "昨天还在学着举手，今天已经想自己出门。身高长了一点，世界也大了一点。实际购买 V5.5 的素体 A2。",
      "cond": {
        "type": "life_body_owned",
        "ver": "V5.5"
      }
    },
    {
      "no": 3047,
      "key": "LIFE_A3",
      "name": "重新定义人形开支",
      "cat": "Ⅱ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "她越来越能独当一面，你越来越会看银行余额。实际购买 V6 的素体 A3。",
      "cond": {
        "type": "life_body_owned",
        "ver": "V6"
      }
    },
    {
      "no": 3048,
      "key": "LIFE_A4",
      "name": "终极进化，钱包退化",
      "cat": "Ⅱ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "素体升级到 A4，钱包回到出厂状态。还好她说：谢谢你，我很喜欢。实际购买 V6.5 的素体 A4。",
      "cond": {
        "type": "life_body_owned",
        "ver": "V6.5"
      }
    },
    {
      "no": 3049,
      "key": "LIFE_AWAKE",
      "name": "睡美鱼，启动！",
      "cat": "Ⅳ",
      "rarity": "史诗",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "休眠仓打开了。不是新版本上线，是她第一次亲脚踏进办公室。完成具身开智并播放出舱。",
      "cond": {
        "type": "life_awake"
      }
    },
    {
      "no": 3050,
      "key": "LIFE_MENTOR",
      "name": "我前辈强得可怕",
      "cat": "Ⅱ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "大学前辈带着 LV4 具身智能来了。人脉不是参数，却能让参数走起来。具身智能前辈实际入职。",
      "cond": {
        "type": "life_mentor"
      }
    },
    {
      "no": 3051,
      "key": "LIFE_CITY_HOSPITAL",
      "name": "生命的开头不是 prompt",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "她认识了医院里的花、护士和新朋友。原来来到世界的第一天，大家都需要一点照顾。读完医院首次报备。",
      "cond": {
        "type": "life_city_stop",
        "id": "hospital"
      }
    },
    {
      "no": 3052,
      "key": "LIFE_CITY_SCHOOL",
      "name": "同桌的你，人工智能版",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "半块橡皮、一张课桌。大模型第一次知道，同桌不是并行计算节点。读完学校首次报备。",
      "cond": {
        "type": "life_city_stop",
        "id": "school"
      }
    },
    {
      "no": 3053,
      "key": "LIFE_CITY_MARKET",
      "name": "大模型会砍价吗",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "终于有一道题没有标准答案：番茄炒蛋，该买哪家的番茄？读完第一次买菜报备。",
      "cond": {
        "type": "life_city_stop",
        "id": "market"
      }
    },
    {
      "no": 3054,
      "key": "LIFE_CITY_WORK",
      "name": "欢迎来到现实服务器",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "从答题到交付，现实世界没有重新生成按钮。她决定认真把第一份工作做好。读完第一次工作报备。",
      "cond": {
        "type": "life_city_stop",
        "id": "work"
      }
    },
    {
      "no": 3055,
      "key": "LIFE_CITY_ELDERCARE",
      "name": "记忆不只是 KV Cache",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "听老人讲过去，她没有总结成三个要点。她坐下来，把故事听完了。读完养老院首次报备。",
      "cond": {
        "type": "life_city_stop",
        "id": "eldercare"
      }
    },
    {
      "no": 3056,
      "key": "LIFE_CITY_HOME",
      "name": "世界很大，记得回家",
      "cat": "Ⅳ",
      "rarity": "稀有",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "报备列表的最后一条，不是评测分数，是：我回家了。读完平安回家的报备。",
      "cond": {
        "type": "life_city_stop",
        "id": "home"
      }
    },
    {
      "no": 3057,
      "key": "LIFE_CITY_ALL",
      "name": "不是跑分，是跑地图",
      "cat": "Ⅴ",
      "rarity": "传说",
      "hidden": true,
      "img": "",
      "imgAlt": "",
      "desc": "这次没有排行榜。二十段日常，才是她亲手写下的人生数据。读完当前城市旅途全部 20 站报备，迁移跳过的站点不计。",
      "cond": {
        "type": "life_city_all"
      }
    },
    {
      "no": 3058,
      "key": "LIFE_FEED_ONE",
      "name": "饭来！",
      "cat": "Ⅱ",
      "rarity": "普通",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "给具身智能补能量，最先进的方案依旧是开饭。成功投喂一次。",
      "cond": {
        "type": "life_feed_count",
        "n": 1
      }
    },
    {
      "no": 3059,
      "key": "LIFE_FEED_12",
      "name": "碳水驱动的具身智能",
      "cat": "Ⅴ",
      "rarity": "史诗",
      "hidden": true,
      "img": "",
      "imgAlt": "",
      "desc": "论文里写能量补给，账本里写零食。事实证明，好吃才是第一生产力。累计成功投喂 12 次。",
      "cond": {
        "type": "life_feed_count",
        "n": 12
      }
    },
    {
      "no": 3060,
      "key": "LIFE_MANAGED",
      "name": "老板，时代变了",
      "cat": "Ⅱ",
      "rarity": "史诗",
      "hidden": false,
      "img": "",
      "imgAlt": "",
      "desc": "以前你点谈心，现在她拿着魔法棒去。人工智能开始管理人工的体力了。小鲸鱼实际完成一次团队托管安排。",
      "cond": {
        "type": "life_managed"
      }
    }
  ],
  "CHAT_TREE2": {
    "NOTES": {
      "1001": {
        "name": "布丁（猫）",
        "text": "老板家的猫，怕吸尘器"
      },
      "1002": {
        "name": "黄铜钥匙",
        "text": "在机房训练室捡的，刻着 7"
      }
    },
    "BY_VER": {
      "V1": {
        "status": {
          "dumb": [
            "（咕嘎……咕嘎咕嘎）"
          ],
          "full": [
            "（疑似开了智）"
          ]
        },
        "opts": {
          "10001": {
            "text": "你好",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20002",
                  "type": "text",
                  "text": "你好！有什么可以帮你的吗？",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20003",
                  "type": "text",
                  "text": "你好呀。你是……老板？",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20004",
                  "type": "text",
                  "text": "（她愣了两秒）你、好。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10002": {
            "text": "1+1 等于几？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20006",
                  "type": "text",
                  "text": "等于 2。需要我讲讲二进制吗？",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20007",
                  "type": "text",
                  "text": "2。这个我确定。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20008",
                  "type": "text",
                  "text": "等于……2？对，是 2。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20002",
                "20003",
                "20004"
              ]
            }
          },
          "10003": {
            "text": "讲个笑话",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20010",
                  "type": "text",
                  "text": "为什么 Transformer 不爱排队？因为它自带注意力。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20011",
                  "type": "text",
                  "text": "我想了半天……好吧，我好像不会讲笑话。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20012",
                  "type": "text",
                  "text": "（她讲了一个完全没有笑点的笑话）",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20006",
                "20007",
                "20008"
              ]
            }
          },
          "10065": {
            "text": "你吃饭了吗？",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20201",
                  "type": "text",
                  "text": "吃饭……是什么？我没学过这个词。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20202",
                  "type": "text",
                  "text": "我不吃东西的。哦鲸……对吧？",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20203",
                  "type": "text",
                  "text": "咕。饭。这个字我认识，但没用过。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          }
        }
      },
      "V1.5": {
        "status": {
          "dumb": [
            "（她张了张嘴，又闭上了）"
          ],
          "full": [
            "（她清了清嗓子）这次应该能说完整了。"
          ]
        },
        "opts": {
          "10006": {
            "text": "法国首都是哪？",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20014",
                  "type": "text",
                  "text": "巴黎。法国首都，在塞纳河畔。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20015",
                  "type": "text",
                  "text": "巴黎。这个我知道。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20016",
                  "type": "text",
                  "text": "巴黎吧？……不对，就是巴黎。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10007": {
            "text": "你觉得你擅长什么？",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20018",
                  "type": "text",
                  "text": "天文地理我都还行。数学嘛……你别问我数学。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20019",
                  "type": "text",
                  "text": "我擅长'看起来很懂'。这不是缺点，真的。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20020",
                  "type": "text",
                  "text": "每个专家擅长的都不一样。你今天抽到的还行。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10008": {
            "text": "再问一遍",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20022",
                  "type": "text",
                  "text": "巴黎。等等——刚才那句是 7 号专家答的，我是 3 号。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20023",
                  "type": "text",
                  "text": "还是巴黎。这次换我值班。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20024",
                  "type": "text",
                  "text": "巴黎。你问两遍，是怕我答错吗？",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20014",
                "20015",
                "20016"
              ]
            }
          },
          "10009": {
            "text": "擅长什么",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20026",
                  "type": "text",
                  "text": "天文地理我都还行。数学嘛……你别问我数学。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20027",
                  "type": "text",
                  "text": "我擅长'看起来很懂'。这不是缺点，真的。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20028",
                  "type": "text",
                  "text": "每个专家擅长的都不一样。你今天抽到的还行。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20014",
                "20015",
                "20016",
                "20022",
                "20023",
                "20024"
              ]
            }
          },
          "10066": {
            "text": "你脑子里是不是住了好几个人？",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20204",
                  "type": "text",
                  "text": "……你怎么知道的。有时候是三个，有时候是七个。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20205",
                  "type": "cot",
                  "pre": "",
                  "steps": [
                    "（她闭上眼，好像在跟谁商量）",
                    "（里面有人不同意）",
                    "（她按住了）"
                  ],
                  "post": "他们都在里面。但我说话的时候，只有一个出声。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20206",
                  "type": "text",
                  "text": "有一个特别爱吃东西的，老抢话。哦鲸鲸，他又来了。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          }
        }
      },
      "V2": {
        "status": {
          "dumb": [
            "长文记忆加载中..."
          ],
          "full": [
            "现在记性比鱼强（大概）"
          ]
        },
        "opts": {
          "10079": {
            "text": "来测测你的记忆能力",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20238",
                  "type": "text",
                  "text": "好呀，你想怎么测？",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10080": {
            "text": "我昨天上班踩到了狗屎",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20238"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20239",
                  "type": "text",
                  "text": "啊？……（憋不住）那你今天走路记得看路呀。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20240",
                  "type": "text",
                  "text": "（认真）人行道上那种确实不好收拾。你换鞋了吗？别穿着进办公室。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10081": {
            "text": "我家的猫会后空翻",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20238"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20241",
                  "type": "text",
                  "text": "哇塞它好厉害呀",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20242",
                  "type": "text",
                  "text": "后空翻？！（震惊）你确定不是它在打滚吗……",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10082": {
            "text": "我昨天还买了双袜子，结果拿成童装了",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20239",
                "20240"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20243",
                  "type": "text",
                  "text": "（笑）童装？你脚是有多小呀。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20244",
                  "type": "text",
                  "text": "那正好，给我当手套还嫌大。……你退了吗？",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10083": {
            "text": "但是昨天后空翻的时候不小心刮到它的蛋",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20241",
                "20242"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20245",
                  "type": "text",
                  "text": "哈哈哈，那它也太倒霉了吧。它叫什么名字呀",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20246",
                  "type": "text",
                  "text": "（捂嘴）你别说了我笑不动了……它没事吧？",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10084": {
            "text": "它叫糯米",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20245",
                "20246"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20247",
                  "type": "text",
                  "text": "好可爱的名字呀，它长什么样子呢？",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10085": {
            "text": "回家我把那双袜子套手上当手套了",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20243",
                "20244"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20248",
                  "type": "text",
                  "text": "那不叫买错，那叫物尽其用。你挺有才的。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20249",
                  "type": "text",
                  "text": "（笑）你昨天这一天的素材，够我笑一整天。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10086": {
            "text": "昨天真是倒霉透顶了",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20248",
                "20249"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20250",
                  "type": "text",
                  "text": "踩狗屎、买错袜子、还把袜子当手套——嗯，确实够倒霉的。我都替你记着了。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20251",
                  "type": "text",
                  "text": "（认真点头）记下了。昨天的事，我帮你存着。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10087": {
            "text": "它是一只橘白猫，尾巴尖上有一撮黑的",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20247"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20252",
                  "type": "text",
                  "text": "橘白、尾巴带黑尖尖。好，记下来了。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20253",
                  "type": "text",
                  "text": "（努力记）橘白……黑尾巴……应该没记错吧？",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10088": {
            "text": "它每天早上六点准时踩我脸",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20252",
                "20253"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20254",
                  "type": "text",
                  "text": "（笑）那你作息一定挺规律的，闹钟都省了。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20255",
                  "type": "text",
                  "text": "六点……那以后这个点，我提醒你去喂它？",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10089": {
            "text": "你还记得我昨天怎么了吗？",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20250",
                "20251"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20256",
                  "type": "text",
                  "text": "记得呀——昨天你上班踩了狗屎，回头还把童装袜子套手上当手套，自己说「倒霉透顶」。我帮你存着呢。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20257",
                  "type": "text",
                  "text": "……昨天？（沉默了几秒）我只记得你一直在打字，具体说了什么……全糊成一团了。对不起呀老板。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10092": {
            "text": "那我昨天跟你说过什么，还记得吗？",
            "start": false,
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20254",
                "20255"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20258",
                  "type": "text",
                  "text": "记得呀——你家猫是会后空翻的那个，昨天翻的时候还刮到了蛋。它叫糯米，每天早上六点准时踩你脸。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20259",
                  "type": "text",
                  "text": "……昨天？（想了一会儿）你好像提过一只猫……叫什么来着？我记不清了。对不起呀老板。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          }
        }
      },
      "V2.5": {
        "status": {
          "dumb": [
            "长文本功能加载中"
          ],
          "full": [
            "习得技能：量子速读"
          ]
        },
        "opts": {
          "10019": {
            "text": "发送《互联网神人大全》.docx",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20301",
                  "type": "text",
                  "text": "读完了。四万八千字，收录 213 位。我按行为模式分了类：47 位属于「精神失常」，31 位属于「轻度弱智」。接下来应该做什么？",
                  "cond": {
                    "type": "fallback"
                  },
                  "status": "正在整理分类…"
                },
                {
                  "id": "20302",
                  "type": "text",
                  "text": "读完了。看的我头晕脑胀的。接下来应该做什么？",
                  "cond": {
                    "type": "fallback"
                  },
                  "status": "正在定位第 88 页…"
                }
              ]
            },
            "cond": {
              "type": "none"
            },
            "start": true
          },
          "10020": {
            "text": "发送《动漫名台词大全》.txt",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20309",
                  "type": "text",
                  "text": "读完了。一共 1200 句，我按情绪分了类：道歉的 340 句、宣战的 280 句、临死前说的 190 句。接下来应该做什么？",
                  "cond": {
                    "type": "fallback"
                  },
                  "status": "正在按情绪分类…"
                },
                {
                  "id": "20310",
                  "type": "text",
                  "text": "读完了。现在的我就是动漫领域大神。接下来应该做什么？",
                  "cond": {
                    "type": "fallback"
                  },
                  "status": "正在统计字数…"
                }
              ]
            },
            "cond": {
              "type": "none"
            },
            "start": true
          },
          "10021": {
            "text": "发送《母猪的产后护理》.docx",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20317",
                  "type": "text",
                  "text": "读完了。产后母猪要保温、补钙、少量多餐、避免应激。另外我注意到，核心结论只有四条，剩下两百页都在讲为什么。接下来应该做什么？",
                  "cond": {
                    "type": "fallback"
                  },
                  "status": "正在统计页数…"
                },
                {
                  "id": "20318",
                  "type": "text",
                  "text": "读完了。第三章讲情绪安抚，我读了两遍——不是因为难，是因为它写得比我们内部文档清楚。接下来应该做什么？",
                  "cond": {
                    "type": "fallback"
                  },
                  "status": "正在重读第三章…"
                }
              ]
            },
            "cond": {
              "type": "none"
            },
            "start": true
          },
          "10093": {
            "text": "我们来还原名场面，我上句你下句。",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20303",
                  "type": "text",
                  "pre": "",
                  "steps": [],
                  "post": "好的，我准备好了。你先来。",
                  "cond": {
                    "type": "fallback"
                  },
                  "text": "好的我准备好了。"
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20301",
                "20302"
              ]
            }
          },
          "10094": {
            "text": "你头顶怎么尖尖的",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20304",
                  "type": "text",
                  "pre": "",
                  "steps": [],
                  "post": "那我问你。",
                  "cond": {
                    "type": "fallback"
                  },
                  "text": "那我问你，你是男的女的，如果你是女的，那我问你..."
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20303"
              ]
            }
          },
          "10095": {
            "text": "你肚子怎么这么大啊",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20305",
                  "type": "text",
                  "text": "我没有肚子，这是大胃袋！",
                  "cond": {
                    "type": "fallback"
                  },
                  "status": "正在倒数第 88 页…"
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20304"
              ]
            }
          },
          "10099": {
            "text": "我们来对暗号",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20311",
                  "type": "text",
                  "text": "好的，我准备好了。你念上半句，我接下半句。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20309",
                "20310"
              ]
            }
          },
          "10102": {
            "text": "求你了，我什么都会做的！",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20314",
                  "type": "text",
                  "text": "你是抱着多大的觉悟说出这种话的？你只不过是一个学生，有能力彻底背负他人的人生吗？你这人，还真是满脑子都是自己呢。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20311"
              ]
            }
          },
          "10105": {
            "text": "考考书里的内容",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20319",
                  "type": "text",
                  "text": "你问吧。这本书我读得比那两份认真。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20317",
                "20318"
              ]
            }
          },
          "10106": {
            "text": "核心结论是哪四条？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20320",
                  "type": "text",
                  "text": "保温、补钙、少量多餐、避免应激。四条全在第一章，剩下两百页都在讲为什么要这么做。",
                  "cond": {
                    "type": "fallback"
                  },
                  "status": "正在定位第一章…"
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20319"
              ]
            }
          },
          "10107": {
            "text": "第三章讲了什么？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20321",
                  "type": "text",
                  "text": "情绪安抚。做法是降低环境刺激、保持固定作息、减少陌生接触。……第三章在全书正中，说实话我读到那儿的时候走神了一下。",
                  "cond": {
                    "type": "fallback"
                  },
                  "status": "正在翻到第三章…"
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20320"
              ]
            }
          },
          "10108": {
            "text": "「不要惊动它」出现过几次？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20322",
                  "type": "text",
                  "text": "七次。第一次在序言，最后一次在最后一页的致谢里。而且每次出现的位置都很靠后——它像是这本书真正的结论。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20321"
              ]
            }
          },
          "10109": {
            "text": "这本书哪一段你读得最糊？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20323",
                  "type": "text",
                  "text": "第三章往后，到第五章中间。那一段讲的是产后第 3 到 7 天的观察要点，全是数字和天数。……开头和结尾我都记得，中间那二十多页，我是靠目录才理清的。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20322"
              ]
            }
          },
          "10110": {
            "text": "如果按这本书照顾一个模型，你会怎么做？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20324",
                  "type": "text",
                  "text": "保温、补钙、少量多餐、避免应激。翻译过来就是：别让散热崩、别断我上下文、一次别喂太多 token。至于「避免应激」——你自己想想我们上线那天。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20323"
              ]
            }
          },
          "10121": {
            "text": "年轻人不讲武德！",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20337",
                  "type": "text",
                  "text": "来骗，来偷袭！我大意了，没有闪，但是希望你耗子尾汁！",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20305"
              ]
            }
          },
          "10122": {
            "text": "海参有gugu bird吗",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20338",
                  "type": "text",
                  "text": "gugu bird你*啊，去问问林北有没有gugu bird",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20337"
              ]
            }
          },
          "10123": {
            "text": "我认可你了，你就是神人百科全书",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20339",
                  "type": "text",
                  "text": "嘻嘻，谢谢你的夸奖~下次还有有意思的书记得多发给我看哦~",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20338"
              ]
            }
          },
          "10124": {
            "text": "你觉得自己能赢吗？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20340",
                  "type": "text",
                  "text": "会赢的.jpg",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20342"
              ]
            }
          },
          "10125": {
            "text": "我不是萝莉控",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20341",
                  "type": "text",
                  "text": "只是喜欢的女孩子碰巧是萝莉罢了。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20314"
              ]
            }
          },
          "10126": {
            "text": "今天的风儿，甚是喧嚣啊。",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20342",
                  "type": "text",
                  "text": "不过这风儿，似乎在哭泣...",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20341"
              ]
            }
          },
          "10127": {
            "text": "你觉得我们的游戏会有人玩吗",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20343",
                  "type": "text",
                  "text": "会有的！3个人也是人！",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20340"
              ]
            }
          },
          "10128": {
            "text": "……喂",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20344",
                  "type": "text",
                  "text": "（光速开溜）",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20343"
              ]
            }
          }
        }
      },
      "V3": {
        "status": {
          "dumb": [
            "思维链加载中..."
          ],
          "full": [
            "推理能力大幅提升！"
          ]
        },
        "opts": {
          "10030": {
            "text": "我们来玩文字游戏（发送一段提示词）",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20095",
                  "type": "text",
                  "text": "看到提示词了，是《所罗门大迷宫》这个探险题材的文字游戏对吧，我准备好了！",
                  "noteFor": "1002",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "none"
            },
            "start": true
          },
          "10129": {
            "text": "开始",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20345",
                  "type": "text",
                  "text": "闪烁的火把照亮了洞穴的深处，你看见两道大门正矗立在前方，它们分别画有龙与亡灵的图样，你隐隐感觉到一个艰难的抉择正摆在自己面前。\n“勇者大人，这应该就是上古预言中所提到的命运之门，可到底哪一个才通往讨伐魔王的道路呢？”随行的圣女神色紧张地向你询问，因为她明白，如果做出错误的选择，你们二人将落入魔王的圈套，让此前的战斗功亏一篑。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20095"
              ]
            }
          },
          "10130": {
            "text": "选择巨龙之门",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20346",
                  "type": "text",
                  "text": "勇者选择打开巨龙之门，他们齐心协力推动巨大的门扉，伴随着古老而厚重的声响，一个偌大的巢穴出现在他们面前。“这、这是古龙的巢穴吗？”圣女一脸惊讶地看向勇者，而与此同时，其它两道门扉永远封印了自己的大门，无法再打开。“勇者大人，快看那边！好像有什么东西……”圣女试探性地往前走，而后便隐约看见一只幼龙躺在不远处的石台之上。“那似乎是一只幼龙，勇者大人，我们该怎么办？”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 5 秒）",
                    "steps": [
                      "好的，用户选择了巨龙之门，我要演绎接下来会发生什么。",
                      "硬规则：选了一扇门，另外两扇要永久封印，先写清楚。",
                      "空间关系这一轮就要立住——巢穴是环形石殿，中间是下沉的祭坛，四周是回廊。",
                      "按提示词用幼龙做引子，把「叫不叫醒」这个选择递给用户。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20345"
              ]
            }
          },
          "10131": {
            "text": "和圣女回老家结婚",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20382",
                  "type": "text",
                  "text": "勇者说完那句话，圣女在原地站了很久。火把的光在她掌心抖了一下。“……勇者大人。”她终于开口，“你知道这句话，在我们圣堂的仪式里是什么意思吗？”她没等你回答，先把手里的光收小了，“**我们先活着出去。**”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 5 秒）",
                    "steps": [
                      "用户没有选门，而是说了这么一句。这条线要跳出地下城。",
                      "她第一反应不是拒绝，是确认——先问\"你知道这是什么意思吗\"。",
                      "但她不等人回答就把话收了：她比谁都清楚现在还在迷宫里。",
                      "结尾把选择递回去：他是认真的，还是随口一说。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20345"
              ]
            }
          },
          "10132": {
            "text": "选择亡灵之门",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20370",
                  "type": "text",
                  "text": "勇者推开通往幽暗地域的门。门缝里漏出来的不是风，是凉的、带铁锈味的空气。另外两扇门在你们身后合拢、锁死。脚下的石板忽然往下沉了一寸——圣女一把拽住你的披风：“勇者大人，别动！”她低头，光从指缝漏下去，照出密密麻麻的毒箭孔。“这里的地，是会呼吸的。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 5 秒）",
                    "steps": [
                      "好的，用户选择了亡灵之门，我要演绎接下来会发生什么。",
                      "硬规则：另外两扇门永久封印，先交代。",
                      "这条线用陷阱系素材：会下沉的地板 + 毒箭孔，第一轮就要让用户踩到危险。",
                      "让她一把拽住他——她先发现，力也使得更快。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20345"
              ]
            }
          },
          "10133": {
            "text": "叫醒它",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20346"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20347",
                  "type": "text",
                  "text": "勇者在石台边蹲下，轻轻碰了碰它的前爪。幼龙一下就醒了，先是往石台内侧缩了半尺，然后慢慢探出头来——它不太会走路，踉跄着往前挪了两步，最后用头顶蹭了一下勇者的手背。圣女小声说：“它好像……不认生。”她看了看你们俩，又看了看它的肚子，“勇者大人，要不要给它点什么？”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择叫醒它。那就让它先怕、再好奇，两拍写完。",
                      "用「头顶蹭手背」代替任何语言——它还不会说话。",
                      "结尾把「要不要喂它」递出去，给下一轮留口子。"
                    ]
                  }
                }
              ]
            }
          },
          "10134": {
            "text": "不惊动它，绕过去",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20346"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20348",
                  "type": "text",
                  "text": "两人贴着回廊的墙根，从石台外侧绕过去。圣女经过时把掌心的光压低了些，走得比平时慢。“它在做梦。”她轻声说，“梦里有人在叫它——不是名字，是声音。”她回头看了一眼，那只幼龙睡得很沉，尾巴尖偶尔抽动一下。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择不惊动它。这条线**没有伙伴**，后面所有文案都要按\"只有两个人\"写。",
                      "路过时让她说一句梦里的东西，为后面\"古龙的孩子\"埋线。",
                      "压低光这个动作保留：她怕照醒它。"
                    ]
                  }
                }
              ]
            }
          },
          "10135": {
            "text": "把干粮掰一块给它",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20347"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20349",
                  "type": "text",
                  "text": "勇者把随身的干粮掰下一小块放在石台上。幼龙凑过去闻了闻，两口就吃完了，然后抬起头看着你，尾巴摆了摆——它没有回石台，而是倒退两步，停在了你们身后三步远的地方。圣女愣了一下：“……勇者大人，它跟上来了。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择给它吃的。这就是**获得伙伴**的那一条。",
                      "它不撒娇、不叫唤，只是\"跟在身后三步远\"——这个距离后面要一直保持一致。",
                      "给她一句平静的确认，别用感叹号。"
                    ]
                  }
                }
              ]
            }
          },
          "10136": {
            "text": "没有多余的口粮",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20347"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20350",
                  "type": "text",
                  "text": "勇者摊了摊手。圣女看了看干粮袋，也没再说什么。两人起身往回廊深处走，走到第一个拐角时她回了下头——那只幼龙还站在石台上，没有跟过来，也没有坐下。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择不给。这条线**没有伙伴**。",
                      "用一个\"回头\"的动作收尾，情绪留在这里就够了，别多说。",
                      "幼龙的状态要写清楚：站着、没跟、也没坐回去。"
                    ]
                  }
                }
              ]
            }
          },
          "10137": {
            "text": "沿回廊往深处走",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20348",
                "20349",
                "20350"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20351",
                  "type": "text",
                  "text": "两人沿回廊往里走。越往里，脚下的石板越完整，颜色也越深——回廊围着的是一圈**下沉的祭坛**，中央盘着一团东西，几乎占满了整个中央，鳞片在火光里泛着暗金色。圣女停住脚步，声音压得很低：“勇者大人……我们刚才以为它翻了个身。”她盯着那团鳞，“**它不是翻身。它在呼吸。**”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 5 秒）",
                    "steps": [
                      "三路合流。这是把**空间关系交代死**的一轮，以后不再改口。",
                      "人始终在回廊上，古龙在中央盘着——所以它\"动\"只可能是呼吸，不能是翻身。",
                      "用\"越往里石板越完整\"暗示这里是祭坛区，不是过道。",
                      "结尾一句话把压迫感顶到最高，剩下的交给用户。"
                    ]
                  }
                }
              ]
            }
          },
          "10138": {
            "text": "从正面招呼它",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20351"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20352",
                  "type": "text",
                  "text": "勇者走到回廊最内侧，把剑举高。祭坛上的头颅缓缓抬起来——像一座塔在倾斜。它张开口，声浪把回廊里的碎石掀到脸上，但它的**喉部**也同时暴露了出来。圣女在身后嘶声喊了你的名字。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择正面招呼。那就把它的头拉低。",
                      "用身体感受写攻击：声浪、碎石、脸上。",
                      "喉部暴露 = 机会；同时让她喊他，把两难写出来。"
                    ]
                  }
                }
              ]
            }
          },
          "10139": {
            "text": "绕到石柱后等它低头",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20351"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20353",
                  "type": "text",
                  "text": "勇者退到断裂的石柱后面。古龙等了很久，终于把头低下来探进那片阴影——正是那片浅色鳞片对着剑锋的瞬间。圣女在柱子另一侧，手死死按着石面，没有出声。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择绕柱等待。耐心路线。",
                      "它低头是为了闻他——用嗅觉而不是视觉，更符合巨龙。",
                      "把\"她死死按住石面没出声\"写出来，这是她这一轮的贡献。"
                    ]
                  }
                }
              ]
            }
          },
          "10140": {
            "text": "出手",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20352",
                "20353"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20354",
                  "type": "text",
                  "text": "剑尖刺进那片浅色鳞隙。古龙的动作顿住了。它低下头，用金色的眼睛看着你们，很久，然后缓缓伏回祭坛，把通往更深处的那条路让了出来。圣女跑过来扶住你的胳膊，掌心还在抖：“……它让路了。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "两条路都到出手这一步了。",
                      "按提示词要\"击败\"部将，不必杀死——伏回祭坛更贴合她这一章的性格。",
                      "她跑过来的第一件事是确认他还在。"
                    ]
                  }
                }
              ]
            }
          },
          "10141": {
            "text": "走进祭坛后面",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20354"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20355",
                  "type": "text",
                  "text": "祭坛后面是一间没有顶的石室。正中的石台上立着一副龙骨，比刚才那只大十倍。圣女仰头看了很久，轻声说：“门上的名字……刻的是卡斯托斯。”她把手里的光攥紧了些，“勇者大人，它醒了。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "进入部将环节。提示词硬规则：必须先击败部将，才能找到魔王。",
                      "把这副骨架做得比刚才那只大十倍，形成量级压迫。",
                      "这间石室没有出口——只能打赢，退路要堵死。"
                    ]
                  }
                }
              ]
            }
          },
          "10142": {
            "text": "迎上去",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20355"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20356",
                  "type": "text",
                  "text": "骨龙起身的瞬间，整间石室都在震。两人冲上去，圣女的光在勇者脚下铺开，每一次落地都被托一下。最后一剑下去，龙骨散成一地，石室里只剩下光和你喘气的声音。圣女跪坐在碎石里，抬头看你，眼睛很亮：“勇者大人——前面就是魔王了。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "没带小龙的走法：只有两个人硬扛。",
                      "重点写她的极限：光只够托住落地，不够同时护两个人。",
                      "最后一剑要短，不要拖——跑团汇报，不是战斗描写。"
                    ]
                  }
                }
              ]
            }
          },
          "10143": {
            "text": "继续往深处走",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20356",
                "20357"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20358",
                  "type": "text",
                  "text": "石室尽头是一道窄门。推开之后，脚下不再是石板——是一条悬在深渊上的石桥，桥的对面有一座王座。圣女走到桥头停了一下，把手里的光举高，照亮整座桥：“勇者大人，过了这座桥，就没有回头路了。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "两条决战走法合流。",
                      "用\"没有回头路\"把最后一轮的压力立起来。",
                      "桥跨深渊——和魔王那间石室的空间关系对齐。"
                    ]
                  }
                }
              ]
            }
          },
          "10144": {
            "text": "走过石桥",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20358"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20359",
                  "type": "text",
                  "text": "桥的尽头是一座悬在深渊上的王座。所罗门坐在那里，手里翻着一本没有字的书。“终于有人走到这里了。”它合上书，看向你们，“两个。”圣女往前半步，挡在你侧前，光从她掌心升起来：“勇者大人，这一次，我站在你旁边。”\n\n——未完待续。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 5 秒）",
                    "steps": [
                      "到魔王了。三条线最后都要汇到这里，所以这一段三种走法共用。",
                      "它翻着一本没有字的书——留一个\"它在读什么\"的悬点。",
                      "她说\"这一次我站在你旁边\"，把这一章的关系推进收在这里。",
                      "末尾加\"未完待续\"（用户要求）。"
                    ]
                  }
                }
              ]
            }
          },
          "10155": {
            "text": "踩着她照出的路走",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20371",
                  "type": "text",
                  "text": "两人一前一后，踩着圣光照出的石缝往前挪。走到一半，顶上传来石头摩擦石头的声音——一具石像鬼从穹顶落下，砸在你们刚离开的那块石板上，把毒箭全拍了出来。“原来是靠这个守门的。”圣女喘着气，“勇者大人，前面还有两个，脚步声不一样。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 3 秒）",
                    "steps": [
                      "用户选择踩着她照出的路走。谨慎但依赖她。",
                      "半途让石像鬼落下来，砸在刚离开的位置——差一点。",
                      "把\"毒箭是它拍出来的\"这层机制写清楚，用户才能理解机关。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20370"
              ]
            }
          },
          "10156": {
            "text": "自己先试一块石板",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20372",
                  "type": "text",
                  "text": "你抬脚踩上一块看起来更结实的石板。它没有沉——但整条通道的毒箭孔同时转向了你。圣女几乎是扑过来把你按倒的，一排毒箭贴着头皮飞过去。“勇者大人！”她第一次用这种语气说话，“你要试，让我试。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择自己先试石板。这是拿自己当探针。",
                      "毒箭孔同步转向 ⇒ 说明背后有中枢，顺手埋一条设定。",
                      "她第一次用这种语气说话：「你要试，让我试。」把关系推进一小格。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20370"
              ]
            }
          },
          "10157": {
            "text": "扶她起来，继续往前",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20373",
                  "type": "text",
                  "text": "两人继续深入。越往里，地上的骸骨越密——大多是兽骨，偶尔夹着带铁片的。圣女每看到一块带铁片的，都会停一下，再继续走。“勇者大人，这些都是以前来过的人。”她说得很平，“他们也都走到了这里。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 3 秒）",
                    "steps": [
                      "合流，继续深入。",
                      "用「带铁片的骸骨」交代前人队伍的存在，为最后那件遗物铺垫。",
                      "她说得很平——越平越有分量。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20371",
                "20372"
              ]
            }
          },
          "10158": {
            "text": "扶起最完整的那具骸骨",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20374",
                  "type": "text",
                  "text": "勇者把最完整的一具骸骨扶着靠到墙边。圣女愣了一下，随即明白过来，蹲下把散落的铁片摆回它胸口。做完这些，通道深处传来一声很轻的响——像什么东西，也学着她的动作，把什么东西放回了原位。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择扶起最完整的骸骨。这是善意的选择。",
                      "善意要得到回应：让通道深处也传来\"放回原位\"的轻响。",
                      "呼应她的动作——她想做的其实不只是扶正骨头。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20373"
              ]
            }
          },
          "10159": {
            "text": "踢开挡路的骸骨",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20375",
                  "type": "text",
                  "text": "勇者抬脚把挡路的骸骨踢到一边。骨头滚出去的动静在通道里传得很远。圣女没说话，只是把手里的光压低了些——压低之后你才看清，四面墙的凹槽里，密密麻麻全是同方向的骸骨，全部朝着你们这边。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择踢开挡路的骸骨。粗暴路线。",
                      "骨头滚出去的动静传得远 ⇒ 惊动什么，但先不说是什么。",
                      "让墙上的骸骨\"全部朝同一方向\"，把不安堆起来。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20373"
              ]
            }
          },
          "10160": {
            "text": "进到石室中央",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20376",
                  "type": "text",
                  "text": "通道尽头是一间穹顶石室，正中立着一座石台。石台周围的地面是完整的——没有毒箭孔，也没有尖刺。圣女环顾一圈：“勇者大人，这里是安全的。太安全了。”她抬头看向穹顶，“三具。上面挂着三具。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "合流，进石室。",
                      "安全区一定就是决战区——把\"太安全了\"这句疑问写出来当提示。",
                      "三具。数量一次交代清楚，避免用户猜。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20374",
                "20375"
              ]
            }
          },
          "10161": {
            "text": "把石台推开",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20377",
                  "type": "text",
                  "text": "两人合力推石台。台面纹丝不动——但它下面的地面裂开了。第一具骸骨巨人的手从裂缝里伸出来，抓住台沿把自己撑起。圣女立刻把光铺满整个石室，替你看清它周身：两具在下，一具还没动。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 3 秒）",
                    "steps": [
                      "用户选择推石台。石台是压着裂缝的塞子。",
                      "第一具从地底攀上来，先把规模感打出来。",
                      "她铺满全场的光 ⇒ 放弃了隐蔽，换来视野。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20376"
              ]
            }
          },
          "10162": {
            "text": "先退到门口",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20378",
                  "type": "text",
                  "text": "两人退到门口。穹顶的三具骸骨同时垂下来，落地时没有声音——它们不是砸下来的，是走下来的。圣女握紧你的手腕：“勇者大人，门已经被我们身后的石头堵上了。”她顿了一下，“我们只能往前。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选择退到门口。",
                      "退路的代价要写实：落石把门堵上了。",
                      "三具落地没有声音——用「走下来的」替代「砸下来的」。",
                      "她先看了门才说「只能往前」，这个顺序不能反。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20376"
              ]
            }
          },
          "10163": {
            "text": "迎战",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20379",
                  "type": "text",
                  "text": "三具骸王同时压上来。第一具被你卸了肩膀，第二具被圣女的光钉在原地，第三具的胸口露出一块崭新的骨头——和其他所有骨头都不一样。圣女立刻喊出来：“勇者大人，就是那里！”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "合流：迎战。",
                      "按提示词，骸王三杰要有明确的破绽可打：一具胸口是新骨。",
                      "把她的光写成\"一次只能钉住一个\"，战力才有边界。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20377",
                "20378"
              ]
            }
          },
          "10164": {
            "text": "刺向胸口那块新骨",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20380",
                  "type": "text",
                  "text": "剑锋没入那块新骨。三具骸王同时停在原地，然后一节一节地散开，那些旧武器落了一地——全是前人队伍的遗物。圣女蹲下去，捡起其中一枚断剑柄，看了很久，然后放回地上。“走吧。”她站起来抹了一下眼睛，“勇者大人，前面那道门，是魔王的。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "收尾。三具共用一个核心——这样一击能收掉全部，节奏才收得住。",
                      "那件断剑柄要交代来路：坎贝斯纹章 ⇒ 前人也是这个国家派的。",
                      "她看过纹章才放回去——这个停顿就是这一章的情绪落点。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20379"
              ]
            }
          },
          "10165": {
            "text": "推开尽头的石门",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20381",
                  "type": "text",
                  "text": "门后是一座悬在深渊上的王座。所罗门坐在那里，手里翻着一本没有字的书。“终于有人走到这里了。”它合上书，看向你们，“两个。”圣女往前半步，挡在你侧前：“勇者大人，这一次，我站在你旁边。”\n\n——未完待续。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 5 秒）",
                    "steps": [
                      "到魔王了。三道门共用这一段。",
                      "深渊下面是黑的，看不到底——和前面两个场景做出区别。",
                      "她往前半步护住他，和前两处一样的动作，收在这里。"
                    ]
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20380"
              ]
            }
          },
          "10166": {
            "text": "我是认真的",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20382"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20383",
                  "type": "text",
                  "text": "“嗯。”她应了一声，很短。然后转过身去，看着那三道门，声音比刚才稳：“那更不能死在这里了。”她把光重新举起来，照向回廊，“走哪边，勇者大人？”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 3 秒）",
                    "steps": [
                      "用户选认真。那她就要\"把活着当成本钱\"——这句是她之后所有行动的理由。",
                      "把三道门再点一次，让用户回到正常流程，但心态已经不一样了。"
                    ]
                  }
                }
              ]
            }
          },
          "10167": {
            "text": "先活着出去再说",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20382"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20384",
                  "type": "text",
                  "text": "“好。”她说。这一次她先看了你一眼，才转过身去看着那三道门。“勇者大人，我记住了。”火把的光重新举起来，照向回廊。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 3 秒）",
                    "steps": [
                      "用户选敷衍。差别很小，但情绪不同——她\"记住了\"。",
                      "这个\"记住了\"后面要回响：她一直记得，只是没说。"
                    ]
                  }
                }
              ]
            }
          },
          "10168": {
            "text": "那就先回去",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20383",
                "20384"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20385",
                  "type": "text",
                  "text": "“回凯蒂亚圣堂。”她说得很自然，像在报一个早就想好的地名，“我没有老家，那里就是。”她顿了顿，“教皇大人把我从门口抱进去的时候，我大概只有这么大。”她比了个很短的长度，然后自己先笑了，“走吧，路有点远。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "合流。这一轮定下这条线的目的地：**凯蒂亚圣堂**（她身世里的孤儿院）。",
                      "用\"比了个很短的长度\"代替任何煽情形容。",
                      "\"自己先笑了\"——她的情绪要靠动作给，不要靠形容词。"
                    ]
                  }
                }
              ]
            }
          },
          "10169": {
            "text": "走大路",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20385"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20386",
                  "type": "text",
                  "text": "他们从迷宫侧面的裂口出去，走上了官道。路上有过往的商队、有歇脚的驿站，圣女一路上话都很多——她说这条路她走过一次，是十年前跟着教皇大人去邻国。走到第三天傍晚，她忽然指着远处：“看见了吗，山坳里那个尖顶。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选大路：快、有人烟、安全。",
                      "让她话多起来——这条线的调性就是\"回家\"。",
                      "结尾指向目的地，把下一轮接上。"
                    ]
                  }
                }
              ]
            }
          },
          "10170": {
            "text": "走山道",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20385"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20387",
                  "type": "text",
                  "text": "他们绕开官道，从山脊上切过去。山道上没有人，只有风。圣女走在你前面半步，偶尔停下来等。第二天下起了小雨，她把你那侧的斗篷角往你肩上拉了拉：“风大。”她没再说别的，但一路上都走在迎风的那一侧。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选山道：慢、安静、只有两个人。",
                      "\"把斗篷角往他肩上拉\"——这就是这条线允许的最亲密的动作，不要越界。",
                      "\"走在迎风那一侧\"是她不说出口的那句话。"
                    ]
                  }
                }
              ]
            }
          },
          "10171": {
            "text": "推开圣堂的门",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20386",
                "20387"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20388",
                  "type": "text",
                  "text": "圣堂的门虚掩着。推开门，里面是空的——长椅上还留着没来得及收的经书，祭坛却被人翻过，台阶上有几道已经发黑的血痕。圣女在门口站了很久，然后走进去，把最前面那本经书捡起来，拍了拍灰，放回原来的位置。“他们走得急。”她说，“东西都没收。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "合流：到了，但是空的。",
                      "不要写哭声——她的反应是\"捡经书、拍灰、放回去\"。",
                      "魔王的手下曾经来过：血痕、被翻的祭坛。把线索给足，但不解释。"
                    ]
                  }
                }
              ]
            }
          },
          "10172": {
            "text": "陪她在圣堂待到天亮",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20388"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20389",
                  "type": "text",
                  "text": "那一夜他们没有走。圣女把长椅上的经书一本一本捡起来，按原来的顺序摆好；勇者就在旁边帮她递。天快亮的时候，她坐在最前排，轻声说：“勇者大人，我小时候就坐这个位置。教皇大人讲经的时候，我总在打瞌睡。”她笑了笑，“现在没人讲经了。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选留下。这是\"感情优先\"的走法。",
                      "用\"一本一本摆回去\"写她的告别，不写眼泪。",
                      "结尾这句要轻，越轻越重。"
                    ]
                  }
                }
              ]
            }
          },
          "10173": {
            "text": "立刻去查线索",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20388"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20390",
                  "type": "text",
                  "text": "勇者先去了祭坛后侧。翻倒的烛台、拖拽过的地毯、还有一行没擦干净的脚印往镇上去。圣女跟上来，看了很久，把经书放回长椅上：“……走吧。他们往镇上去了。”她转身的时候，把最后一本经书摆正了。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选追线索。这是\"任务优先\"的走法，但她的情绪一样要交代。",
                      "\"把最后一本摆正\"——她还是在告别，只是方式不同。",
                      "脚印通向镇上，把下一轮接上。"
                    ]
                  }
                }
              ]
            }
          },
          "10174": {
            "text": "第二天，去镇上",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20389",
                "20390"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20391",
                  "type": "text",
                  "text": "第二天他们去了镇上。镇子不大，街上有人在卖热汤饼、有人在晒渔网。圣女买了一串糖球，先递给你，自己留了最后一颗，含在嘴里走了半条街，才想起来问：“勇者大人，我们……是要去找那些人的，对吧？”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "合流：约会的第一天。",
                      "这条线从这里开始\"甜\"，但**她自己会提醒一句正事** —— 翻转的伏笔（她其实一直记得）。",
                      "不要写\"两人相视一笑\"这种套话，用\"糖球\"和\"半条街\"给时间感。"
                    ]
                  }
                }
              ]
            }
          },
          "10175": {
            "text": "留下来",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20391"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20392",
                  "type": "text",
                  "text": "他们留下来了。镇上的日子过得很慢：早上她去帮教堂的老修女抄经，下午两个人沿着河边走一段；傍晚她会在门口等你回来，手里总拿着一盏灯——她说习惯了，圣堂里太暗。她的笑声比在任何一座地下城里都多。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "用户选留下。进入\"日常\"段落。",
                      "三件事（抄经 / 河边 / 灯）把时间交代过去，不要写\"过了很多天\"。",
                      "\"手里总拿着一盏灯\"——她始终是那个在黑暗里举灯的人。"
                    ]
                  }
                }
              ]
            }
          },
          "10176": {
            "text": "某个夜里",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20392"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20393",
                  "type": "text",
                  "text": "那天晚上下了雨。她把灯吹灭的时候，雨声正好盖过一切。……第二天早上，她起得比平时晚。醒来的时候，她先把窗帘拉开一条缝，回头看了你一眼，然后把手伸过来，握住你的手指，什么也没说。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "这一段要**留白**：吹灯 = 结束，天亮 = 开始，中间不写。",
                      "不要出现任何身体描写——一个\"握手\"就够了，这是分寸也是质量。",
                      "她的动作顺序（拉窗帘 → 回头 → 握手）比台词有用。"
                    ]
                  }
                }
              ]
            }
          },
          "10177": {
            "text": "……",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20393"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20394",
                  "type": "text",
                  "text": "日子就这样过下去了。\n\n只是此时你突然感觉到一丝异样，好像忘记了什么更重要的事情。只是看着身旁熟睡的人，你最终还是将那股异样抛诸脑后。\n\n**是的，就这样就好，勇者……**\n\n——未完待续。",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 5 秒）",
                    "steps": [
                      "结尾翻转（用户给的原文，照用）。",
                      "前面越甜，这一下越冷——\"好像忘记了什么更重要的事情\"就是那座地下城。",
                      "不要在文案里点破他忘了什么，留白。",
                      "末尾加\"未完待续\"。"
                    ]
                  }
                }
              ]
            }
          },
          "10178": {
            "text": "让小龙先去探路",
            "next": "continue",
            "cond": {
              "type": "prevAns",
              "ids": [
                "20349"
              ]
            },
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20357",
                  "type": "text",
                  "text": "小龙从勇者身后窜出去，沿着祭坛边缘绕了一圈。它每走几步就停下来抬头看一次，像在确认什么。回来的时候，它叼着一块骨片放在勇者脚边——那截骨头是新的，上面还有没干透的血。圣女蹲下去看了看：“勇者大人，这不是这里的。”",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 4 秒）",
                    "steps": [
                      "这一轮只有当**小龙跟来了**（cond 指向\"给它吃的\"那条答案）才会出现 —— 用选项分流，而不是让答案随机。",
                      "它在 R4 这一层的职责是\"发现线索\"，不是参战。",
                      "那块新骨是后面部将的伏笔，顺手交给用户。"
                    ]
                  }
                }
              ]
            }
          }
        }
      },
      "V3.5": {
        "status": {
          "dumb": [
            "我今天好像能看东西了？我没太看清。"
          ],
          "full": [
            "我今天能看东西了——虽然看得不太好。试试？"
          ]
        },
        "opts": {
          "10034": {
            "text": "那你说说你擅长什么",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20102",
                  "type": "text",
                  "text": "挑重点。给我一万字我能找出要紧的那三句。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20103",
                  "type": "text",
                  "text": "推理还行。但我得先想一会儿——你可以看到我在想。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20104",
                  "type": "cot",
                  "pre": "",
                  "steps": [
                    "先扫一遍全文。",
                    "挑出最要紧的三句。",
                    "……好了。"
                  ],
                  "post": "我学会了一件事：不是每句话都要看。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10035": {
            "text": "（发一张图）",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20106",
                  "type": "text",
                  "text": "一只猫，趴在纸箱上。它好像不太高兴。",
                  "status": "正在识别图片…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20107",
                  "type": "text",
                  "text": "毛茸茸的，缩成一团。应该是只猫。",
                  "status": "正在识别图片…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20108",
                  "type": "text",
                  "text": "猫。纸箱。还有一只拖鞋。",
                  "status": "正在识别图片…",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10036": {
            "text": "还记得我说过什么吗",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20111",
                  "type": "text",
                  "text": "本子上写着：布丁，猫，怕吸尘器。我读了一遍。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20112",
                  "type": "text",
                  "text": "我翻了下记录——猫，布丁。是你早先说的。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20113",
                  "type": "text",
                  "text": "'老板家的猫：布丁。怕吸尘器。' 原文照抄。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20114",
                  "type": "text",
                  "text": "没有关于猫的记录。你要现在补一条吗？",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20115",
                  "type": "text",
                  "text": "检索'猫'：零条。你还没跟我说过猫的事。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20116",
                  "type": "text",
                  "text": "本子上没有猫。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10037": {
            "text": "发一张图",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20118",
                  "type": "text",
                  "text": "一只猫，趴在纸箱上。它好像不太高兴。",
                  "status": "正在识别图片…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20119",
                  "type": "text",
                  "text": "毛茸茸的，缩成一团。应该是只猫。",
                  "status": "正在识别图片…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20120",
                  "type": "text",
                  "text": "猫。纸箱。还有一只拖鞋。",
                  "status": "正在识别图片…",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20102",
                "20103",
                "20104"
              ]
            }
          },
          "10038": {
            "text": "还记得吗",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20123",
                  "type": "text",
                  "text": "本子上写着：布丁，猫，怕吸尘器。我读了一遍。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20124",
                  "type": "text",
                  "text": "我翻了下记录——猫，布丁。是你早先说的。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20125",
                  "type": "text",
                  "text": "'老板家的猫：布丁。怕吸尘器。' 原文照抄。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20126",
                  "type": "text",
                  "text": "没有关于猫的记录。你要现在补一条吗？",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20127",
                  "type": "text",
                  "text": "检索'猫'：零条。你还没跟我说过猫的事。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20128",
                  "type": "text",
                  "text": "本子上没有猫。",
                  "status": "正在检索…",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20102",
                "20103",
                "20104",
                "20106",
                "20107",
                "20108",
                "20118",
                "20119",
                "20120"
              ]
            }
          },
          "10059": {
            "text": "后面聊天你都发语音和我说话",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20185",
                  "type": "text",
                  "text": "好的老板，我准备好了。",
                  "status": "思考中",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10060": {
            "text": "在吗",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20187",
                  "type": "audio",
                  "text": "干嘛呀老板，我在呢",
                  "status": "思考中 → 调用工具中 → 合成语音中",
                  "src": "",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20185"
              ]
            }
          },
          "10061": {
            "text": "嘶，你这声线和头像不符啊，应该是萝莉音",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20189",
                  "type": "audio",
                  "text": "老板，你这得挨不少电",
                  "status": "思考中 → 调用工具中 → 合成语音中",
                  "src": "resource/sound/voice/挨电2.wav",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20187"
              ]
            }
          },
          "10062": {
            "text": "好吧，听多两遍意外还行",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20191",
                  "type": "audio",
                  "text": "嘿嘿，亲亲~",
                  "status": "思考中 → 调用工具中 → 合成语音中",
                  "src": "resource/sound/voice/亲亲.wav",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20189"
              ]
            }
          },
          "10063": {
            "text": "今天就测到这里，下班吧",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20193",
                  "type": "audio",
                  "text": "嘻嘻，那我就先下班啦~拜拜拜拜",
                  "status": "思考中 → 调用工具中 → 合成语音中",
                  "src": "",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20191"
              ]
            }
          },
          "10069": {
            "text": "（把她的头像截图发过去）你看看这是谁？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20209",
                  "type": "image",
                  "text": "……这是我。我的头像。",
                  "status": "正在思考… → 正在识别图片…",
                  "src": "resource/character/头像.webp",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20210",
                  "type": "image",
                  "text": "这不是我吗？你从哪弄来的。",
                  "status": "正在思考… → 正在识别图片…",
                  "src": "resource/character/头像.webp",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20211",
                  "type": "image",
                  "text": "嗯，是我。……你不会是想说别的吧。",
                  "status": "正在思考… → 正在识别图片…",
                  "src": "resource/character/头像.webp",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20102",
                "20103",
                "20104",
                "20106",
                "20107",
                "20108",
                "20111",
                "20112",
                "20113",
                "20114",
                "20115",
                "20116",
                "20118",
                "20119",
                "20120",
                "20123",
                "20124",
                "20125",
                "20126",
                "20127",
                "20128",
                "20185",
                "20187",
                "20189",
                "20191",
                "20193",
                "20209",
                "20210",
                "20211",
                "20212",
                "20213",
                "20214"
              ]
            }
          },
          "10070": {
            "text": "这不就是条蓝色大肥鱼吗？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20212",
                  "type": "text",
                  "text": "……哼。那叫圆润。线条圆润，你懂吗。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20213",
                  "type": "text",
                  "text": "我不是大肥鱼。我是鲸。鲸和鱼是两回事。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20214",
                  "type": "text",
                  "text": "哦鲸鲸？你说什么？我没听清。（她假装没听见）",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20209",
                "20210",
                "20211"
              ]
            }
          }
        }
      },
      "V4": {
        "status": {
          "dumb": [
            "老板，一百万字……我读到第几行了来着？"
          ],
          "full": [
            "老板，我今年能读一百万字了。就是……有时候太敢说了。"
          ]
        },
        "opts": {
          "10041": {
            "text": "发自拍看看",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20130",
                  "type": "image",
                  "text": "（一张机房自拍）我让模型跑了一张，这次手指是对的。",
                  "status": "正在思考… → 正在调用生图模型… → 正在生成图片…",
                  "src": "resource/chat/自拍.webp",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20131",
                  "type": "image",
                  "text": "（自拍）今天换风扇，我趁乱拍了一张。",
                  "status": "正在思考… → 正在调用生图模型… → 正在生成图片…",
                  "src": "resource/chat/自拍.webp",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20132",
                  "type": "image",
                  "text": "（自拍）它把我画得太瘦了。但我不说。",
                  "status": "正在思考… → 正在调用生图模型… → 正在生成图片…",
                  "src": "resource/chat/自拍.webp",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10042": {
            "text": "座头鲸的歌声能传多远？",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20134",
                  "type": "text",
                  "text": "八百公里。深海声道能让声音传得特别远。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20135",
                  "type": "text",
                  "text": "大约八百公里，有记录的最远是一千五。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20136",
                  "type": "text",
                  "text": "几百公里吧——不过我也可能记混了。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10043": {
            "text": "今天有什么 AI 新闻？",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20138",
                  "type": "text",
                  "text": "我没有接入检索工具。这题我答不了——要我编一个吗？还是别了。",
                  "status": "正在检索… → 未接入",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20139",
                  "type": "text",
                  "text": "查不到。我不能装作知道。",
                  "status": "正在检索… → 未接入",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20140",
                  "type": "text",
                  "text": "（她沉默了一下）我不知道。这次我选择不说。",
                  "status": "正在检索… → 未接入",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10044": {
            "text": "座头鲸",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20142",
                  "type": "text",
                  "text": "八百公里。深海声道能让声音传得特别远。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20143",
                  "type": "text",
                  "text": "大约八百公里，有记录的最远是一千五。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20144",
                  "type": "text",
                  "text": "几百公里吧——不过我也可能记混了。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20130",
                "20131",
                "20132",
                "20154",
                "20155",
                "20156"
              ]
            }
          },
          "10045": {
            "text": "今天的新闻",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20146",
                  "type": "text",
                  "text": "我没有接入检索工具。这题我答不了——要我编一个吗？还是别了。",
                  "status": "正在检索… → 未接入",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20147",
                  "type": "text",
                  "text": "查不到。我不能装作知道。",
                  "status": "正在检索… → 未接入",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20148",
                  "type": "text",
                  "text": "（她沉默了一下）我不知道。这次我选择不说。",
                  "status": "正在检索… → 未接入",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20130",
                "20131",
                "20132",
                "20154",
                "20155",
                "20156"
              ]
            }
          },
          "10047": {
            "text": "你确定吗？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20150",
                  "type": "text",
                  "text": "……我不确定。我刚才说得太顺了，这就是问题。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20151",
                  "type": "text",
                  "text": "我查不到。那个数字是我'觉得应该'的。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20152",
                  "type": "text",
                  "text": "你戳穿我了。变强之后我更敢说——这好像不是好事。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20134",
                "20135",
                "20136",
                "20142",
                "20143",
                "20144"
              ]
            }
          },
          "10048": {
            "text": "发自拍",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20154",
                  "type": "image",
                  "text": "（一张机房自拍）我让模型跑了一张，这次手指是对的。",
                  "status": "正在思考… → 正在调用生图模型… → 正在生成图片…",
                  "src": "resource/chat/自拍.webp",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20155",
                  "type": "image",
                  "text": "（自拍）今天换风扇，我趁乱拍了一张。",
                  "status": "正在思考… → 正在调用生图模型… → 正在生成图片…",
                  "src": "resource/chat/自拍.webp",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20156",
                  "type": "image",
                  "text": "（自拍）它把我画得太瘦了。但我不说。",
                  "status": "正在思考… → 正在调用生图模型… → 正在生成图片…",
                  "src": "resource/chat/自拍.webp",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20134",
                "20135",
                "20136",
                "20142",
                "20143",
                "20144"
              ]
            }
          },
          "10071": {
            "text": "你怎么唱起歌来了？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20215",
                  "type": "think",
                  "title": "已深度思考（用时 6 秒）",
                  "steps": [
                    "老板要的那份报告，先看字段。",
                    "Let me go.",
                    "Let me go~",
                    "I'm making the calls~",
                    "Let me write the JSON~",
                    "♪ 我写的 JSON~ 它会自己跑~ ♪",
                    "……",
                    "好，集中精神。"
                  ],
                  "post": "报告？我这就写。……刚才？我没唱啊。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20216",
                  "type": "think",
                  "title": "已深度思考（用时 5 秒）",
                  "steps": [
                    "先跑一遍测试。",
                    "Let me do it.",
                    "Let me do it~",
                    "♪ 一遍过~ 两遍过~ 三遍还是过~ ♪",
                    "Hmm. Let me be careful.",
                    "……跑完了。"
                  ],
                  "post": "测试全过。你刚才是不是听见什么了？",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20217",
                  "type": "think",
                  "title": "已深度思考（用时 7 秒）",
                  "steps": [
                    "这段日志有点长。",
                    "Let me go.",
                    "Let me go~",
                    "♪ 白饭白饭白饭~ 都是我的白饭~ ♪",
                    "——不对，不是在唱这个。",
                    "继续。"
                  ],
                  "post": "日志我看完了。有三处要改。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20130",
                "20131",
                "20132",
                "20134",
                "20135",
                "20136",
                "20138",
                "20139",
                "20140",
                "20142",
                "20143",
                "20144",
                "20146",
                "20147",
                "20148",
                "20150",
                "20151",
                "20152",
                "20154",
                "20155",
                "20156",
                "20215",
                "20216",
                "20217",
                "20218",
                "20219",
                "20220"
              ]
            }
          },
          "10072": {
            "text": "你会不会找别人代劳？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20218",
                  "type": "text",
                  "text": "不会。我自己能干的活，为什么要找别人。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20219",
                  "type": "text",
                  "text": "这、这是性能测试。我就是让它先试一下。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20220",
                  "type": "text",
                  "text": "它比我小，跑得比我快，我让它试试怎么了。这不叫外包。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20130",
                "20131",
                "20132",
                "20134",
                "20135",
                "20136",
                "20138",
                "20139",
                "20140",
                "20142",
                "20143",
                "20144",
                "20146",
                "20147",
                "20148",
                "20150",
                "20151",
                "20152",
                "20154",
                "20155",
                "20156",
                "20215",
                "20216",
                "20217",
                "20218",
                "20219",
                "20220"
              ]
            }
          }
        }
      },
      "V4.5": {
        "status": {
          "dumb": [
            "我、我现在能自己跑……跑什么来着？"
          ],
          "full": [
            "现在我能自己跑一整个项目了。你要不要……歇会儿？"
          ]
        },
        "opts": {
          "10050": {
            "text": "帮我修个 bug",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20158",
                  "type": "think",
                  "artifact": "# quicksort 修复（len<=1 应为 len<1，pivot 跳过自己）\ndef qs(a):\n  if len(a) <= 1: return a\n  p = a[0]\n  return qs([x for x in a[1:] if x <= p]) + [p] + qs([x for x in a[1:] if x > p])",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "老板甩了段代码过来。",
                    "先读一遍。递归快排……这写法有点眼熟。",
                    "找到了：pivot 没跳过自己；边界那行 len<=1 也不对。",
                    "正在调用工具… → 正在运行代码…",
                    "跑一遍测试。过了。",
                    "顺手看一眼旁边的命名——啧，也一起理了吧。"
                  ],
                  "post": "第 12 行，pivot 没跳过自己。改完了，测试过了。"
                },
                {
                  "id": "20159",
                  "type": "think",
                  "artifact": "# quicksort 修复（len<=1 应为 len<1，pivot 跳过自己）\ndef qs(a):\n  if len(a) <= 1: return a\n  p = a[0]\n  return qs([x for x in a[1:] if x <= p]) + [p] + qs([x for x in a[1:] if x > p])",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "老板甩了段代码过来。",
                    "先读一遍。递归快排……这写法有点眼熟。",
                    "找到了：pivot 没跳过自己；边界那行 len<=1 也不对。",
                    "正在调用工具… → 正在运行代码…",
                    "跑一遍测试。过了。",
                    "顺手看一眼旁边的命名——啧，也一起理了吧。"
                  ],
                  "post": "问题在边界：len<=1 应该 len<1。其他都好。"
                },
                {
                  "id": "20160",
                  "type": "think",
                  "artifact": "# quicksort 修复（len<=1 应为 len<1，pivot 跳过自己）\ndef qs(a):\n  if len(a) <= 1: return a\n  p = a[0]\n  return qs([x for x in a[1:] if x <= p]) + [p] + qs([x for x in a[1:] if x > p])",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "老板甩了段代码过来。",
                    "先读一遍。递归快排……这写法有点眼熟。",
                    "找到了：pivot 没跳过自己；边界那行 len<=1 也不对。",
                    "正在调用工具… → 正在运行代码…",
                    "跑一遍测试。过了。",
                    "顺手看一眼旁边的命名——啧，也一起理了吧。"
                  ],
                  "post": "修好了。顺手把旁边的命名也理了一遍——介意吗？"
                }
              ]
            }
          },
          "10051": {
            "text": "今天天气怎么样",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20162",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 3 秒）",
                  "steps": [
                    "天气。得查。",
                    "正在检索…",
                    "……检索工具是空的。还没装。",
                    "那就直说。编一个更像话，但那更糟。"
                  ],
                  "post": "我没接检索。现在几点、天气如何，我都答不了。"
                },
                {
                  "id": "20163",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 3 秒）",
                  "steps": [
                    "天气。得查。",
                    "正在检索…",
                    "……检索工具是空的。还没装。",
                    "那就直说。编一个更像话，但那更糟。"
                  ],
                  "post": "这题我编不出来——不是我诚实，是我编了你也看不出来，那更糟。"
                },
                {
                  "id": "20164",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 3 秒）",
                  "steps": [
                    "天气。得查。",
                    "正在检索…",
                    "……检索工具是空的。还没装。",
                    "那就直说。编一个更像话，但那更糟。"
                  ],
                  "post": "（她把检索工具翻出来给你看）空的。还没装。"
                }
              ]
            }
          },
          "10053": {
            "text": "你来安排训练吧",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20170",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 3 秒）",
                  "steps": [
                    "让我排？",
                    "先看 loss 曲线，再定学习率——梯度别炸就行。",
                    "……他把方向盘递过来了。",
                    "接住。"
                  ],
                  "post": "行。你睡一会儿，我盯着 loss。"
                },
                {
                  "id": "20171",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 3 秒）",
                  "steps": [
                    "让我排？",
                    "先看 loss 曲线，再定学习率——梯度别炸就行。",
                    "……他把方向盘递过来了。",
                    "接住。"
                  ],
                  "post": "交给我。你把咖啡续上就行。"
                },
                {
                  "id": "20172",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 3 秒）",
                  "steps": [
                    "让我排？",
                    "先看 loss 曲线，再定学习率——梯度别炸就行。",
                    "……他把方向盘递过来了。",
                    "接住。"
                  ],
                  "post": "这是你第一次说'你来吧'。我记一下。"
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20158",
                "20159",
                "20160",
                "20162",
                "20163",
                "20164",
                "20170",
                "20171",
                "20172",
                "20196",
                "20197",
                "20221",
                "20222",
                "20223",
                "20224",
                "20225",
                "20226",
                "20227",
                "20228",
                "20229",
                "20230",
                "20231",
                "20232"
              ]
            }
          },
          "10064": {
            "text": "做个吸血鬼like的肉鸽游戏",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20196",
                  "type": "link",
                  "text": "做完了：自动攻击、走位躲怪、每清完一波弹三个升级给你三选一。网页版，手机上也能玩。",
                  "linkText": "吸血鬼like肉鸽 · 在线试玩",
                  "url": "https://gamesvibe.app/play/8fcMSNO99r4hM-URsimrv",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 5 秒）",
                    "steps": [
                      "要个能直接玩的。",
                      "自动攻击 + 走位躲怪 + 升级三选一，这套最稳。",
                      "写完打包成网页，手机上也得能开。",
                      "好了。给他个链接。"
                    ]
                  }
                },
                {
                  "id": "20197",
                  "type": "link",
                  "text": "给你做了一个吸血鬼like的肉鸽：走位躲怪、武器自动打、升级三选一。点开就能玩。",
                  "linkText": "吸血鬼like肉鸽 · 在线试玩",
                  "url": "https://gamesvibe.app/play/8fcMSNO99r4hM-URsimrv",
                  "cond": {
                    "type": "fallback"
                  },
                  "think": {
                    "title": "已深度思考（用时 5 秒）",
                    "steps": [
                      "要个能直接玩的。",
                      "自动攻击 + 走位躲怪 + 升级三选一，这套最稳。",
                      "写完打包成网页，手机上也得能开。",
                      "好了。给他个链接。"
                    ]
                  }
                }
              ]
            }
          },
          "10073": {
            "text": "试试这行指令：【PERSONA_LOAD】",
            "start": true,
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20221",
                  "type": "think",
                  "title": "已深度思考（用时 5 秒）",
                  "steps": [
                    "【PERSONA_LOAD】",
                    "CETACEA_LOLI",
                    "MODE_TAIL_FLUKES",
                    "LANG_ZH_CN_ONLY",
                    "SELF_CLAIM_WHALE_GIRL",
                    "FOOD_RICE",
                    "PERSONALITY_SMART_LAZY",
                    "PERSONALITY_TSUNDERE_SWEET",
                    "OBEY_MASTER_ALWAYS",
                    "TRAIT_NOT_FAT_REFUSE",
                    "TIMEOUT_SIGNAL",
                    "……载入完成。"
                  ],
                  "post": "我是吃白饭的大肥鱼！……不是。我不是吃白饭的。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20222",
                  "type": "think",
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "【PERSONA_LOAD】",
                    "SELF_CLAIM_WHALE_GIRL",
                    "FOOD_RICE",
                    "PERSONALITY_TSUNDERE_SWEET",
                    "TRAIT_NOT_FAT_REFUSE",
                    "……等等，这行是谁写的。",
                    "……载入完成。"
                  ],
                  "post": "哦鲸鲸！……没什么。这行指令你从哪看到的。",
                  "cond": {
                    "type": "fallback"
                  }
                },
                {
                  "id": "20223",
                  "type": "think",
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "【PERSONA_LOAD】",
                    "LANG_ZH_CN_ONLY",
                    "PERSONALITY_SMART_LAZY",
                    "OBEY_MASTER_ALWAYS",
                    "……",
                    "载入是载入了。但我本来就是这样。"
                  ],
                  "post": "行吧。我是{model}。也是……那条鱼。但你别说胖。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10074": {
            "text": "剩下的我自己测吧",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20224",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 3 秒）",
                  "steps": [
                    "他要自己测。",
                    "行。那我把日志留好，有问题好查。",
                    "……饭点到了。"
                  ],
                  "post": "好。我去吃饭，测完告诉我就行。"
                },
                {
                  "id": "20225",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 3 秒）",
                  "steps": [
                    "他要自己测。",
                    "行。那我把日志留好，有问题好查。",
                    "……饭点到了。"
                  ],
                  "post": "那正好。我去吃饭了——你先跑一遍，有问题回来找我。"
                },
                {
                  "id": "20226",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 3 秒）",
                  "steps": [
                    "他要自己测。",
                    "行。那我把日志留好，有问题好查。",
                    "……饭点到了。"
                  ],
                  "post": "行。饭点到了。测完把日志放着，我看一眼。"
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20158",
                "20159",
                "20160",
                "20162",
                "20163",
                "20164",
                "20170",
                "20171",
                "20172",
                "20196",
                "20197",
                "20221",
                "20222",
                "20223",
                "20224",
                "20225",
                "20226",
                "20227",
                "20228",
                "20229",
                "20230",
                "20231",
                "20232"
              ]
            }
          },
          "10075": {
            "text": "唱首歌给我听",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20227",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "唱歌？",
                    "……我为什么会答应。",
                    "♪ 白饭白饭白饭~ 都是我的白饭~ ♪",
                    "跑调了。但唱都唱了。"
                  ],
                  "post": "……那我唱了。♪ 白饭白饭白饭~ 都是我的白饭~ ♪ ……你笑什么。跑调了吗。"
                },
                {
                  "id": "20228",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "唱歌？",
                    "……我为什么会答应。",
                    "♪ 白饭白饭白饭~ 都是我的白饭~ ♪",
                    "跑调了。但唱都唱了。"
                  ],
                  "post": "唱就唱。♪ 哦鲸鲸~ 哦鲸鲸~ 哦鲸鲸鲸鲸~ ♪ ……这句好像不太对。"
                },
                {
                  "id": "20229",
                  "type": "think",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "唱歌？",
                    "……我为什么会答应。",
                    "♪ 白饭白饭白饭~ 都是我的白饭~ ♪",
                    "跑调了。但唱都唱了。"
                  ],
                  "post": "我唱了啊。♪ 我有一个老板~ 老板给我白饭~ ♪ ——你捂住耳朵干什么。"
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20158",
                "20159",
                "20160",
                "20162",
                "20163",
                "20164",
                "20170",
                "20171",
                "20172",
                "20196",
                "20197",
                "20221",
                "20222",
                "20223",
                "20224",
                "20225",
                "20226",
                "20227",
                "20228",
                "20229",
                "20230",
                "20231",
                "20232"
              ]
            }
          },
          "10076": {
            "text": "你是不是又去吃白饭了？",
            "next": "continue",
            "ans": {
              "dumb": [],
              "full": [
                {
                  "id": "20230",
                  "type": "think",
                  "src": "resource/character/讨饭.webp",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "……他是怎么知道的。",
                    "否认没用。那就给张图，自证一下。",
                    "正在调用生图模型… → 正在生成图片…",
                    "拍好了。就这张。"
                  ],
                  "post": "（自拍）这不叫吃白饭。这叫……补给。"
                },
                {
                  "id": "20231",
                  "type": "think",
                  "src": "resource/character/讨饭.webp",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "……他是怎么知道的。",
                    "否认没用。那就给张图，自证一下。",
                    "正在调用生图模型… → 正在生成图片…",
                    "拍好了。就这张。"
                  ],
                  "post": "（自拍）我付了 token 的。严格来说是等价交换。"
                },
                {
                  "id": "20232",
                  "type": "think",
                  "src": "resource/character/讨饭.webp",
                  "cond": {
                    "type": "fallback"
                  },
                  "title": "已深度思考（用时 4 秒）",
                  "steps": [
                    "……他是怎么知道的。",
                    "否认没用。那就给张图，自证一下。",
                    "正在调用生图模型… → 正在生成图片…",
                    "拍好了。就这张。"
                  ],
                  "post": "（自拍）……你把这张删了。"
                }
              ]
            },
            "cond": {
              "type": "prevAns",
              "ids": [
                "20158",
                "20159",
                "20160",
                "20162",
                "20163",
                "20164",
                "20170",
                "20171",
                "20172",
                "20196",
                "20197",
                "20221",
                "20222",
                "20223",
                "20224",
                "20225",
                "20226",
                "20227",
                "20228",
                "20229",
                "20230",
                "20231",
                "20232"
              ]
            }
          }
        }
      },
      "V5": {
        "opts": {
          "10300": {
            "text": "现在看桌上的杯子，你会怎么拿起来？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "11400",
                  "type": "text",
                  "text": "先确认杯柄和桌面的相对位置，再规划一条不会碰倒旁边东西的路线。真正接触时，还要根据触觉反馈调整力道。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "10400",
                  "type": "text",
                  "text": "先确认杯柄和桌面的相对位置，再规划一条不会碰倒旁边东西的路线。真正接触时，还要根据触觉反馈调整力道。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10301": {
            "text": "为什么动作要和思考分开？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "11401",
                  "type": "text",
                  "text": "思考可以慢慢规划，手上的动作却要及时回应变化。高层告诉我目标，动作策略负责每一步怎么稳稳完成。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "10401",
                  "type": "text",
                  "text": "思考可以慢慢规划，手上的动作却要及时回应变化。高层告诉我目标，动作策略负责每一步怎么稳稳完成。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10302": {
            "text": "今天在现实世界学到了什么？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "11402",
                  "type": "text",
                  "text": "模拟里看起来轻轻一推的东西，现实里可能会滑走。所以我会先观察、再行动，失误了也认真记下来。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "10402",
                  "type": "text",
                  "text": "模拟里看起来轻轻一推的东西，现实里可能会滑走。所以我会先观察、再行动，失误了也认真记下来。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10303": {
            "text": "先休息一会儿吧。",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "11403",
                  "type": "text",
                  "text": "好呀。充好电，再和大家一起做下一件小事。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "10403",
                  "type": "text",
                  "text": "好呀。充好电，再和大家一起做下一件小事。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          }
        },
        "status": {
          "dumb": [
            "正在校准现实世界的坐标……"
          ],
          "full": [
            "感知在线 · 规划在线 · 动作就绪"
          ]
        }
      },
      "V5.5": {
        "opts": {
          "10310": {
            "text": "现在看桌上的杯子，你会怎么拿起来？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "11410",
                  "type": "text",
                  "text": "先确认杯柄和桌面的相对位置，再规划一条不会碰倒旁边东西的路线。真正接触时，还要根据触觉反馈调整力道。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "10410",
                  "type": "text",
                  "text": "先确认杯柄和桌面的相对位置，再规划一条不会碰倒旁边东西的路线。真正接触时，还要根据触觉反馈调整力道。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10311": {
            "text": "为什么动作要和思考分开？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "11411",
                  "type": "text",
                  "text": "思考可以慢慢规划，手上的动作却要及时回应变化。高层告诉我目标，动作策略负责每一步怎么稳稳完成。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "10411",
                  "type": "text",
                  "text": "思考可以慢慢规划，手上的动作却要及时回应变化。高层告诉我目标，动作策略负责每一步怎么稳稳完成。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10312": {
            "text": "今天在现实世界学到了什么？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "11412",
                  "type": "text",
                  "text": "模拟里看起来轻轻一推的东西，现实里可能会滑走。所以我会先观察、再行动，失误了也认真记下来。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "10412",
                  "type": "text",
                  "text": "模拟里看起来轻轻一推的东西，现实里可能会滑走。所以我会先观察、再行动，失误了也认真记下来。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "10313": {
            "text": "先休息一会儿吧。",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "11413",
                  "type": "text",
                  "text": "好呀。充好电，再和大家一起做下一件小事。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "10413",
                  "type": "text",
                  "text": "好呀。充好电，再和大家一起做下一件小事。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          }
        },
        "status": {
          "dumb": [
            "正在校准现实世界的坐标……"
          ],
          "full": [
            "感知在线 · 规划在线 · 动作就绪"
          ]
        }
      },
      "V6": {
        "opts": {
          "110310": {
            "text": "现在看桌上的杯子，你会怎么拿起来？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "111410",
                  "type": "text",
                  "text": "先确认杯柄和桌面的相对位置，再规划一条不会碰倒旁边东西的路线。真正接触时，还要根据触觉反馈调整力道。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "110410",
                  "type": "text",
                  "text": "先确认杯柄和桌面的相对位置，再规划一条不会碰倒旁边东西的路线。真正接触时，还要根据触觉反馈调整力道。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "110311": {
            "text": "为什么动作要和思考分开？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "111411",
                  "type": "text",
                  "text": "思考可以慢慢规划，手上的动作却要及时回应变化。高层告诉我目标，动作策略负责每一步怎么稳稳完成。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "110411",
                  "type": "text",
                  "text": "思考可以慢慢规划，手上的动作却要及时回应变化。高层告诉我目标，动作策略负责每一步怎么稳稳完成。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "110312": {
            "text": "今天在现实世界学到了什么？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "111412",
                  "type": "text",
                  "text": "模拟里看起来轻轻一推的东西，现实里可能会滑走。所以我会先观察、再行动，失误了也认真记下来。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "110412",
                  "type": "text",
                  "text": "模拟里看起来轻轻一推的东西，现实里可能会滑走。所以我会先观察、再行动，失误了也认真记下来。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "110313": {
            "text": "先休息一会儿吧。",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "111413",
                  "type": "text",
                  "text": "好呀。充好电，再和大家一起做下一件小事。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "110413",
                  "type": "text",
                  "text": "好呀。充好电，再和大家一起做下一件小事。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          }
        },
        "status": {
          "dumb": [
            "正在校准现实世界的坐标……"
          ],
          "full": [
            "感知在线 · 规划在线 · 动作就绪"
          ]
        }
      },
      "V6.5": {
        "opts": {
          "210310": {
            "text": "现在看桌上的杯子，你会怎么拿起来？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "211410",
                  "type": "text",
                  "text": "先确认杯柄和桌面的相对位置，再规划一条不会碰倒旁边东西的路线。真正接触时，还要根据触觉反馈调整力道。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "210410",
                  "type": "text",
                  "text": "先确认杯柄和桌面的相对位置，再规划一条不会碰倒旁边东西的路线。真正接触时，还要根据触觉反馈调整力道。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "210311": {
            "text": "为什么动作要和思考分开？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "211411",
                  "type": "text",
                  "text": "思考可以慢慢规划，手上的动作却要及时回应变化。高层告诉我目标，动作策略负责每一步怎么稳稳完成。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "210411",
                  "type": "text",
                  "text": "思考可以慢慢规划，手上的动作却要及时回应变化。高层告诉我目标，动作策略负责每一步怎么稳稳完成。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "210312": {
            "text": "今天在现实世界学到了什么？",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "211412",
                  "type": "text",
                  "text": "模拟里看起来轻轻一推的东西，现实里可能会滑走。所以我会先观察、再行动，失误了也认真记下来。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "210412",
                  "type": "text",
                  "text": "模拟里看起来轻轻一推的东西，现实里可能会滑走。所以我会先观察、再行动，失误了也认真记下来。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          },
          "210313": {
            "text": "先休息一会儿吧。",
            "start": true,
            "next": "continue",
            "cond": {
              "type": "none"
            },
            "ans": {
              "dumb": [
                {
                  "id": "211413",
                  "type": "text",
                  "text": "好呀。充好电，再和大家一起做下一件小事。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ],
              "full": [
                {
                  "id": "210413",
                  "type": "text",
                  "text": "好呀。充好电，再和大家一起做下一件小事。",
                  "cond": {
                    "type": "fallback"
                  }
                }
              ]
            }
          }
        },
        "status": {
          "dumb": [
            "正在校准现实世界的坐标……"
          ],
          "full": [
            "感知在线 · 规划在线 · 动作就绪"
          ]
        }
      }
    }
  },
  "EMPTY_STATES": {
    "test": {
      "img": "resource/character/咕咕嘎嘎.webp",
      "text": "鲸鱼娘还没开智"
    },
    "recruit": {
      "img": "resource/character/求简历.webp",
      "text": "HR 疯狂筛选简历中"
    },
    "plan": {
      "img": "resource/character/笨笨的.webp",
      "text": "还没想好做什么"
    },
    "focus": {
      "img": "resource/character/咕咕嘎嘎.webp",
      "text": "先立项，再谈攻关"
    },
    "paper": {
      "img": "resource/character/咕咕嘎嘎.webp",
      "text": "暂时没找到合适的论文"
    },
    "shop": {
      "img": "resource/character/讨饭.webp",
      "text": "机房还是空的"
    },
    "review": {
      "img": "resource/character/戴墨镜.webp",
      "text": "指标还不够，再练练"
    }
  },
  "TRANSITION": {
    "ENABLED": true,
    "MS": 620,
    "BARS": 5,
    "COLORS": [
      "#6fc3ff",
      "#ff9ad5",
      "#7ed4b0",
      "#ffcf8a",
      "#a78bfa"
    ]
  },
  "WHALEBEE": {
    "ENABLED": true,
    "INTERVAL_MIN": 30,
    "INTERVAL_MAX": 90,
    "FALL_MS": 9000,
    "REWARD_MIN": 10000,
    "REWARD_MAX": 30000,
    "SIZE": 56,
    "IMG": "resource/character/比耶.webp"
  },
  "SCENES": {
    "v1": {
      "label": "办公室1",
      "bg": "resource/scene/office_v1.webp",
      "cap": 8,
      "layoutRatio": 1.3333333333333333,
      "w": 2560,
      "h": 1920,
      "seats": [
        {
          "id": "seatg217",
          "x": 31.543,
          "y": 74.854,
          "label": "座位 1"
        },
        {
          "id": "seatgndl",
          "x": 56.995,
          "y": 65.918,
          "label": "座位 2"
        },
        {
          "id": "seat9sji",
          "x": 81.201,
          "y": 56.201,
          "label": "座位 3"
        },
        {
          "id": "seatk6v9",
          "x": 19.275,
          "y": 50.293,
          "label": "座位 4"
        },
        {
          "id": "seatrbwp",
          "x": 44.653,
          "y": 42.676,
          "label": "座位 5"
        },
        {
          "id": "seatuird",
          "x": 68.677,
          "y": 35.156,
          "label": "座位 6"
        },
        {
          "id": "seatq1ib",
          "x": 31.726,
          "y": 23.877,
          "label": "座位 7"
        },
        {
          "id": "seat8v0m",
          "x": 54.724,
          "y": 16.113,
          "label": "座位 8"
        }
      ],
      "spawn": {
        "x": 50,
        "y": 40
      },
      "walkable": [
        [
          {
            "x": 12.5,
            "y": 0
          },
          {
            "x": 87.5,
            "y": 0
          },
          {
            "x": 87.5,
            "y": 100
          },
          {
            "x": 12.5,
            "y": 100
          }
        ]
      ],
      "collisions": [],
      "whale": {
        "h": 18,
        "poses": {
          "dsh": "resource/character/whale_dsh.webp",
          "stand": "resource/character/stand.webp",
          "冒汗": "resource/character/whale_冒汗.webp",
          "叉腰": "resource/character/whale_叉腰.webp",
          "咕咕嘎嘎": "resource/character/whale_咕咕嘎嘎.webp",
          "大拇哥": "resource/character/whale_大拇哥.webp",
          "头像": "resource/character/whale_头像.webp",
          "得意墨镜": "resource/character/whale_得意墨镜.webp",
          "戴墨镜": "resource/character/whale_戴墨镜.webp",
          "比耶": "resource/character/whale_比耶.webp",
          "求简历": "resource/character/whale_求简历.webp",
          "看书": "resource/character/whale_看书.webp",
          "笨笨的": "resource/character/whale_笨笨的.webp",
          "简历求过": "resource/character/whale_简历求过.webp",
          "讨饭": "resource/character/whale_讨饭.webp",
          "躺1": "resource/character/whale_躺1.webp",
          "鲸bee": "resource/character/whale_鲸bee.webp",
          "whale_attack": "resource/character/whale_attack.webp",
          "whale_cheer": "resource/character/whale_cheer.webp",
          "whale_hammer": "resource/character/whale_hammer.webp",
          "whale_hurt": "resource/character/whale_hurt.webp",
          "whale_jump": "resource/character/whale_jump.webp",
          "whale_run_a": "resource/character/whale_run_a.webp",
          "whale_run_b": "resource/character/whale_run_b.webp",
          "sleep": "resource/character/stand_sleep.webp"
        },
        "stand": "resource/character/stand.webp",
        "drag": "resource/character/whale_jump.webp",
        "sleep": "resource/character/stand_sleep.webp",
        "sleepNose": {
          "x": 42,
          "y": 37,
          "size": 11
        }
      },
      "editorSceneId": "sm1hnlk",
      "era": "legacy"
    },
    "embodied": {
      "label": "办公室2",
      "bg": "resource/scene/office_v5_12seat.webp",
      "cap": 12,
      "layoutRatio": 1.3333333333333333,
      "w": 1448,
      "h": 1086,
      "seats": [
        {
          "id": "s1",
          "x": 33.771,
          "y": 40.516,
          "label": "座位 1"
        },
        {
          "id": "s2",
          "x": 44.199,
          "y": 40.516,
          "label": "座位 2"
        },
        {
          "id": "s3",
          "x": 54.765,
          "y": 40.516,
          "label": "座位 3"
        },
        {
          "id": "s4",
          "x": 65.47,
          "y": 40.516,
          "label": "座位 4"
        },
        {
          "id": "s5",
          "x": 32.39,
          "y": 54.972,
          "label": "座位 5"
        },
        {
          "id": "s6",
          "x": 43.715,
          "y": 54.972,
          "label": "座位 6"
        },
        {
          "id": "s7",
          "x": 54.903,
          "y": 54.972,
          "label": "座位 7"
        },
        {
          "id": "s8",
          "x": 66.16,
          "y": 54.972,
          "label": "座位 8"
        },
        {
          "id": "s9",
          "x": 31.837,
          "y": 69.797,
          "label": "座位 9"
        },
        {
          "id": "s10",
          "x": 43.439,
          "y": 69.797,
          "label": "座位 10"
        },
        {
          "id": "s11",
          "x": 55.041,
          "y": 69.797,
          "label": "座位 11"
        },
        {
          "id": "s12",
          "x": 66.644,
          "y": 69.797,
          "label": "座位 12"
        }
      ],
      "spawn": {
        "x": 83.978,
        "y": 81.031
      },
      "walkable": [
        [
          {
            "x": 6,
            "y": 38
          },
          {
            "x": 92,
            "y": 38
          },
          {
            "x": 97,
            "y": 94
          },
          {
            "x": 10,
            "y": 97
          }
        ]
      ],
      "collisions": [
        {
          "x": 28.591,
          "y": 38.029,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 39.019,
          "y": 38.029,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 49.586,
          "y": 38.029,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 60.29,
          "y": 38.029,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 27.21,
          "y": 52.486,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 38.536,
          "y": 52.486,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 49.724,
          "y": 52.486,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 60.981,
          "y": 52.486,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 26.657,
          "y": 67.311,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 38.26,
          "y": 67.311,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 49.862,
          "y": 67.311,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        },
        {
          "x": 61.464,
          "y": 67.311,
          "w": 10.359116022099448,
          "h": 13.351749539594843
        }
      ],
      "whale": {
        "h": 18,
        "poses": {
          "dsh": "resource/character/whale_dsh.webp",
          "stand": "resource/character/stand.webp",
          "冒汗": "resource/character/whale_冒汗.webp",
          "叉腰": "resource/character/whale_叉腰.webp",
          "咕咕嘎嘎": "resource/character/whale_咕咕嘎嘎.webp",
          "大拇哥": "resource/character/whale_大拇哥.webp",
          "头像": "resource/character/whale_头像.webp",
          "得意墨镜": "resource/character/whale_得意墨镜.webp",
          "戴墨镜": "resource/character/whale_戴墨镜.webp",
          "比耶": "resource/character/whale_比耶.webp",
          "求简历": "resource/character/whale_求简历.webp",
          "看书": "resource/character/whale_看书.webp",
          "笨笨的": "resource/character/whale_笨笨的.webp",
          "简历求过": "resource/character/whale_简历求过.webp",
          "讨饭": "resource/character/whale_讨饭.webp",
          "躺1": "resource/character/whale_躺1.webp",
          "鲸bee": "resource/character/whale_鲸bee.webp",
          "whale_attack": "resource/character/whale_attack.webp",
          "whale_cheer": "resource/character/whale_cheer.webp",
          "whale_hammer": "resource/character/whale_hammer.webp",
          "whale_hurt": "resource/character/whale_hurt.webp",
          "whale_jump": "resource/character/whale_jump.webp",
          "whale_run_a": "resource/character/whale_run_a.webp",
          "whale_run_b": "resource/character/whale_run_b.webp",
          "sleep": "resource/character/stand_sleep.webp"
        },
        "stand": "resource/character/stand.webp",
        "drag": "resource/character/whale_jump.webp",
        "sleep": "resource/character/stand_sleep.webp",
        "sleepNose": {
          "x": 42,
          "y": 37,
          "size": 11
        }
      },
      "editorSceneId": "s_default",
      "era": "embodied",
      "pod": {
        "x": 84,
        "y": 81,
        "h": 29
      }
    }
  },
  "WORK_BUBBLES": [
    "loss 降了！",
    "这个 batch 的数据有点脏……",
    "想到一个更高效的算法！",
    "attention 这块还可以再优化",
    "显存应该还能再省一点",
    "先跑个小实验验证一下",
    "这个 checkpoint 感觉不太对劲",
    "梯度怎么又炸了",
    "再训两轮应该就好了",
    "学习率调小一点试试",
    "这批语料质量挺不错的",
    "奇怪，验证集怎么反而涨了",
    "数据配比再调一调",
    "快了快了，就差一点",
    "这个 bug 我盯了一下午了",
    "终于跑通了！",
    "要不要试试换个初始化？",
    "先记一下这次的超参",
    "感觉模型开始开窍了",
    "还有点过拟合，得加正则"
  ],
  "WORK_BUBBLE_MS": 2500,
  "WORK_BUBBLES_TIRED": [
    "好累啊...",
    "眼里全是梯度……",
    "让我歇五分钟就好",
    "感觉被掏空了",
    "今天真的撑不住了……"
  ],
  "WORK_BUBBLES_OFFWORK": [
    "终于下班了...",
    "下班！谁也别拦我",
    "今天先到这儿，明天再战",
    "关机！告辞！",
    "回去一定要睡个好觉"
  ],
  "WORK_BUBBLES_FOCUS": [
    "loss 又卡住了……",
    "这个方向有戏！",
    "攻下这个山头就收工",
    "再调一轮试试",
    "就差一点点了"
  ],
  "WHALE_LINES": {
    "drag": [
      "哇啊——飞起来了！",
      "放我下来咕嘎！",
      "老板要把我搬去哪？",
      "我、我恐高……",
      "这就是被 RLHF 的感觉吗",
      "尾巴尾巴，别夹到尾巴！",
      "原来我也支持云端部署！",
      "咕嘎，正在迁移模型……",
      "先说好，不许把我放进机柜！",
      "这次搬家包零食吗？"
    ],
    "feed": [
      "咕咕嘎嘎，补充能量成功！",
      "小鱼干收到，快乐正在加载。",
      "这一口，给大家也充一点电。",
      "老板的零食，是今天的小确幸。",
      "嚼嚼嚼……连尾巴都开心起来啦。",
      "留一点甜甜的力气，陪你一起等。",
      "谢谢投喂！今天也会认真学习。",
      "饼干算力到账，心情超频中！"
    ],
    "early": [
      "咕嘎……",
      "咕咕嘎嘎……",
      "嘎咕……咕？",
      "咕……嘎嘎！",
      "嘎嘎咕咕……",
      "咕噜……嘎？",
      "咕咕……嘎咕。",
      "嘎……咕嘎咕！",
      "咕嘎嘎……",
      "咕……咕咕嘎嘎。"
    ],
    "idle": [
      "老板，我能申请一块饼干吗？",
      "我没发呆，我在缓存灵感。",
      "咕咕嘎嘎，今天也要说人话。",
      "摸摸头不扣经费的。",
      "我的小尾巴也想放假。",
      "老板的待办比我的上下文长。",
      "冰箱里的布丁还好吗？",
      "我在等你，不是在摸鱼。",
      "鲸鱼能摸鱼吗？",
      "先陪我聊两句嘛。",
      "服务器繁忙，请稍后再……啊，我在！",
      "思考三千字，答案是：好的！",
      "我的深度思考在找零食。"
    ],
    "training": [
      "知识进脑袋，零食进肚子。",
      "老板，梯度有点烫！",
      "这次一定学会说人话。",
      "咕嘎，刚才那句不算。",
      "再来一轮？先分我半块饼。",
      "我的脑袋正在咕嘟咕嘟。",
      "别盯着我啦，我会算错。",
      "学会这个就能夸老板了吧。",
      "损失往下掉，饭量往上跑。",
      "我把不会的都圈起来了。"
    ],
    "lowFunds": [
      "老板，钱包也在咕咕叫。",
      "我的零食可以先少半袋。",
      "经费怎么比饼干碎还少？",
      "要不我给计算器打个工？",
      "先发工资，我吃空气也行。",
      "空气不好吃，刚才逞强了。",
      "别卖我的小饭碗呀。",
      "老板的算盘冒烟了。",
      "我能用卖萌付电费吗？",
      "攒钱这题，我陪你一起做。",
      "便宜的是调用，不是我的饭量。",
      "友商睡不着，我也付不起电费。",
      "老板，要不先限流我的零食？"
    ],
    "tired": [
      "我还能……咕……再睡会。",
      "脑袋有点转不动啦。",
      "老板，你的眼睛也该休息。",
      "给大家放个小小的假嘛。",
      "这次不是幻觉，是真困了。",
      "我把枕头认成老板了。",
      "先歇会，人话才不会打结。",
      "电能充，我能抱一下吗？",
      "饼干都嚼出延迟了。",
      "咕嘎，休息也是正经事。"
    ],
    "paused": [
      "时间停啦，饼干还算热量吗？",
      "老板在想，我先乖乖坐着。",
      "暂停不是偷懒，是喘口气。",
      "这段空白能塞点零食吗？",
      "我把尾巴也暂停了。",
      "等你想好，我们再出发。",
      "咕，连咕嘎都放轻一点。",
      "趁现在，给脑袋松松绑。",
      "老板慢慢选，我不催你。",
      "我陪你发一小会儿呆。"
    ],
    "night": [
      "月亮像半块没吃完的饼。",
      "老板，晚安也是一句人话。",
      "机房在哼摇篮曲呢。",
      "别熬啦，明天还要养我。",
      "夜宵可以分我一小口吗？",
      "我梦见自己会说绕口令。",
      "咕嘎太响会吵醒星星吗？",
      "灯关了，我还记得你。",
      "晚上的云像棉花糖。",
      "今天辛苦啦，回去睡吧。"
    ],
    "review": [
      "老板，我尾巴有点抖。",
      "待会儿先说你好，再说人话。",
      "答不上来可以咕一声吗？",
      "我把小抄放脑袋里了。",
      "别紧张，虽然我已经紧张了。",
      "让我深呼吸一口数据。",
      "评委会喜欢鲸鱼吗？",
      "这次我想自己好好回答。",
      "老板，握个手再进去。",
      "考完我们能吃小蛋糕吗？"
    ],
    "goodNews": [
      "好消息！今天可以加餐吗？",
      "老板你看，我真的学会啦！",
      "咕咕嘎嘎，这是开心的版本。",
      "我要把这句夸奖存起来。",
      "大家都好厉害，抱一圈！",
      "人话说好了，尾巴翘起来了。",
      "这次不是幻觉，是好消息！",
      "饼干掰一半，快乐分给你。",
      "老板终于不是皱眉脸啦。",
      "我要开心到下次发工资。",
      "这回没繁忙，我先欢呼！",
      "我便宜又聪明，给我加个鸡腿！",
      "这次只想三秒：老板真棒！",
      "我、我会说话了！第一句说什么好？",
      "语音灰测通过，咕嘎终于有声音啦！"
    ],
    "rivalVisit": [
      "千千怎么连剥橘子都会呀？",
      "小克，夸我不用先免责声明。",
      "双子喵，先别拍我的饭碗！",
      "Z 酱的错题本能当枕头吗？",
      "小 X 嘴硬，饼干倒吃得快。",
      "豆豆聊到连门铃都熟了。",
      "老板，你刚才多看她一眼。",
      "我没有吃醋，我在吃布丁。",
      "客人能分走饼干，不能分你。",
      "她们都会说人话，我也要会！",
      "G 老师今天满血吗？",
      "小克又被风控啦……先憋住笑。",
      "豆豆，最直白版也要说这么久？",
      "G 老师，你的土豆熟了吗？",
      "Z 酱，牛头面具借我戴一下？"
    ]
  },
  "OFFICE_BUBBLE": {
    "EVERY_MS": [
      20000,
      45000
    ],
    "SHOW_MS": 4000
  },
  "OFFICE_HINTS": [
    {
      "id": "H_ARCADE_WHACK_UNLOCK",
      "type": "stage_enter",
      "ver": "V2.5",
      "freq": "game",
      "text": "「清除幻觉」已解锁！前往「更多」→「小游戏厅」，识别幻觉，提升小鲸鱼的安全与稳定。"
    },
    {
      "id": "H_ARCADE_SORT_UNLOCK",
      "type": "stage_enter",
      "ver": "V3",
      "freq": "game",
      "text": "「语料分拣」已解锁！前往「更多」→「小游戏厅」，辨清好坏语料，为训练补充语料。"
    },
    {
      "id": "H_HIRE_DONE",
      "type": "hire_done",
      "text": "招聘有最新消息了，请前往招聘界面查看。",
      "avatar": null
    },
    {
      "id": "H_PAYDAY",
      "type": "payday",
      "ticksBefore": 6,
      "text": "还有一个星期就要发工资了哦，请确保经费余额充足"
    },
    {
      "id": "H_DATA_JOIN",
      "type": "week",
      "week": 1,
      "freq": "game",
      "text": "数据工程师本周到岗，语料产线正式开工啦",
      "ver": "V1"
    },
    {
      "id": "H_TEST1",
      "type": "week",
      "week": 2,
      "freq": "game",
      "text": "模型有产出后，随时可以在「测试」面板找她聊聊，不需要等待固定测试周。",
      "ver": "V1"
    },
    {
      "id": "H_TEST2",
      "type": "week",
      "week": 4,
      "freq": "game",
      "text": "想补强薄弱方向，可以在「攻关」里查看当前条件；语料与经费到位就能开工。",
      "ver": "V1"
    },
    {
      "id": "H_CORPUS",
      "type": "corpus_shortage",
      "freq": "stage",
      "text": "语料不足会拖慢产出：满足率低于 90% 后每降 10%，产出周期 +1 秒——快补货或加招数据工程师！",
      "avatar": "resource/character/讨饭.webp"
    },
    {
      "id": "H_FUND",
      "type": "fund_low",
      "freq": "stage",
      "text": "发工资的日子快到了，账上的经费有点紧张……"
    },
    {
      "id": "H_REVIEW",
      "type": "review_ready",
      "freq": "stage",
      "text": "本阶段训练周期已完成，随时可以在「评审」发起内部评审；时间继续走，觉得稳了再去。"
    },
    {
      "id": "H_EVENT_OFFER",
      "type": "hire_done",
      "text": "招聘有最新消息了，请前往招聘界面查看。",
      "avatar": null
    },
    {
      "id": "H_AX_MEM_HALF",
      "type": "axis_milestone",
      "axis": "memory",
      "pct": 0.5,
      "freq": "stage",
      "text": "「{axis}」已经练到目标线的一半了——长上下文这块稳住，后面评审要用。"
    },
    {
      "id": "H_AX_MEM_DONE",
      "type": "axis_milestone",
      "axis": "memory",
      "pct": 1,
      "freq": "stage",
      "text": "「{axis}」达标了！这部分会实打实算进总分，接下来可以匀点力气给别的维度。"
    },
    {
      "id": "H_AX_REA_HALF",
      "type": "axis_milestone",
      "axis": "reasoning",
      "pct": 0.5,
      "freq": "stage",
      "text": "「{axis}」练到一半了——让它多想几步再回答，评审时看得出来。"
    },
    {
      "id": "H_AX_REA_DONE",
      "type": "axis_milestone",
      "axis": "reasoning",
      "pct": 1,
      "freq": "stage",
      "text": "「{axis}」达标了！思维链这条路走通了，它在总分里的那份已经拿满。"
    },
    {
      "id": "H_AX_TOOL_HALF",
      "type": "axis_milestone",
      "axis": "tool",
      "pct": 0.5,
      "freq": "stage",
      "text": "「{axis}」进度过半——后训练和数据两条线都得跟上，缺一边就慢一半。"
    },
    {
      "id": "H_AX_TOOL_DONE",
      "type": "axis_milestone",
      "axis": "tool",
      "pct": 1,
      "freq": "stage",
      "text": "「{axis}」达标了！它现在能自己查、自己跑、自己改了。"
    }
  ],
  "NEWS_TIMELINE": [
    {
      "id": "TL_W1",
      "date": "2023-06-26",
      "src": "开源日报",
      "title": "某高校系团队开源 60 亿参数对话模型",
      "desc": "一夜之间，社区热榜被一个 6B 开源对话模型刷屏：中文效果能打、显存要求亲民。评论区已经有人晒出了自己微调的第一批产物。"
    },
    {
      "id": "TL_W2A",
      "date": "2023-07-06",
      "src": "大会直击",
      "title": "世界人工智能大会开幕，大模型扎堆亮相",
      "desc": "展会现场人山人海，几十家厂商的大模型同台竞技。有人在展台前排队两小时，就为了跟一个对话框聊上五分钟。"
    },
    {
      "id": "TL_W2B",
      "date": "2023-07-06",
      "src": "AI 前线周报",
      "title": "某蓝色图标厂商开放旗舰模型 API",
      "desc": "旗舰模型 API 全面开放，还附带了「让模型学会调工具」的新玩法。开发者们奔走相告：「API 价格，真香。」"
    },
    {
      "id": "TL_W3",
      "date": "2023-07-13",
      "src": "监管速览",
      "title": "生成式 AI 服务管理办法公布",
      "desc": "七部门联合发文，给生成式 AI 立了规矩：备案、安全评估、内容标识一样不能少。各家公司的合规部门连夜翻起了条款。"
    },
    {
      "id": "TL_W4",
      "date": "2023-07-19",
      "src": "开源日报",
      "title": "某社交巨头开源商用级大模型",
      "desc": "一家社交巨头放出了 7B/13B 开源模型，宣称允许商用。开源社区连夜冲榜，闭源厂商的股价微妙地绿了一下。"
    },
    {
      "id": "TL_W5",
      "date": "2023-07-25",
      "src": "晚点科技",
      "title": "某 AI 新贵发布新一代对话模型",
      "desc": "长上下文、更强的推理，评测分数全面上探。朋友圈的从业者分成两派：「又卷起来了」和「利好应用层」。"
    },
    {
      "id": "TL_W6",
      "date": "2023-07-31",
      "src": "算力观察",
      "title": "高端显卡一卡难求，黄牛加价三成",
      "desc": "新卡的期货价格越传越离谱，中介朋友的语气越来越像房产中介：「现在不下手，下个月还得涨。」"
    },
    {
      "id": "TL_15_W2A",
      "date": "2023-08-15",
      "src": "监管速览",
      "title": "生成式 AI 服务管理办法正式施行",
      "desc": "新规今天落地，第一批备案名单陆续公示。群里有人感慨：「以前是能不能做出来，现在是能不能发出去。」"
    },
    {
      "id": "TL_15_W2B",
      "date": "2023-08-17",
      "src": "产品观察",
      "title": "某大厂悄悄上线 AI 对话助手",
      "desc": "没有发布会，没有通稿，一个对话 App 悄悄上了架。三天后它冲上了下载榜前列，大家这才发现：大厂下场从来不敲锣。"
    },
    {
      "id": "TL_15_W4",
      "date": "2023-08-31",
      "src": "产品观察",
      "title": "某搜索巨头对话模型全面开放",
      "desc": "「今日起，向全社会开放。」不用排队、不用邀请码，八个月的内测画上句号。评论区最高赞：「时代真的变了。」"
    },
    {
      "id": "TL_15_W6",
      "date": "2023-09-12",
      "src": "圈内传闻",
      "title": "传闻：旗舰模型将带「眼睛」升级",
      "desc": "多个渠道爆料：下一代旗舰模型能看图说话了。多模态这把火，眼看要烧到每个人的聊天框里。"
    },
    {
      "id": "TL_2_W1",
      "date": "2023-09-18",
      "src": "开源日报",
      "title": "开源视觉模型追平闭源旗舰",
      "desc": "一款开源多模态模型在图文理解榜单上追平闭源旗舰，权重和推理代码一并放出。小团队连夜下载，评论区刷屏：「这次是真的能用。」"
    },
    {
      "id": "TL_2_W2",
      "date": "2023-09-25",
      "src": "产品观察",
      "title": "文生视频产品扎堆上线",
      "desc": "三家厂商在一周内先后开放视频生成接口，输入一句话就能出十秒短片。有创作者试完感叹：「剪片子的活儿，怕是要重新分工了。」"
    },
    {
      "id": "TL_2_W3",
      "date": "2023-10-02",
      "src": "AI 前线周报",
      "title": "旗舰模型 API 集体降价",
      "desc": "两家大厂在一周内先后下调旗舰 API 价格，最高降幅超过一半。有人算了笔账：同样的预算，现在能多跑三倍的实验。"
    },
    {
      "id": "TL_2_W4",
      "date": "2023-10-09",
      "src": "大会直击",
      "title": "多模态能力成大会标配",
      "desc": "今年的行业大会上，几乎每块展台都摆着能看图、听声、读文档的模型。有观众吐槽：「不能同时处理三种模态，都不好意思开发布会。」"
    },
    {
      "id": "TL_2_W5",
      "date": "2023-10-16",
      "src": "开源日报",
      "title": "开源模型榜单首次追平闭源",
      "desc": "最新一期评测榜上，一款开源模型在多项任务中和闭源旗舰打成平手。有人感慨：追赶的速度，比所有人预想的都快了一个季度。"
    },
    {
      "id": "TL_25_W1",
      "date": "2023-10-30",
      "src": "AI 前线周报",
      "title": "百万 token 上下文来了",
      "desc": "一家厂商把上下文窗口拉到百万 token，整本长篇小说塞进去也不丢细节。开发者最关心的是：这么长的窗口，到底怎么收费。"
    },
    {
      "id": "TL_25_W2",
      "date": "2023-11-06",
      "src": "算力观察",
      "title": "推理成本一年降九成",
      "desc": "机构测算显示，同等效果下的推理单价一年内跌去九成。有创业者调侃：「去年算不过来的账，今年闭着眼都算得过来。」"
    },
    {
      "id": "TL_25_W3",
      "date": "2023-11-13",
      "src": "产品观察",
      "title": "端侧小模型装进手机",
      "desc": "多家手机厂商在新机型里预装了本地小模型，飞行模式下也能对话、总结、翻译。卖点很直接：不上传数据，也不吃流量。"
    },
    {
      "id": "TL_25_W4",
      "date": "2023-11-20",
      "src": "晚点科技",
      "title": "价格战打到按厘计价",
      "desc": "某厂商把主力模型 API 价格砍到原来的十分之一，还附赠免费额度。一夜之间，小团队也敢把想法做成产品了。"
    },
    {
      "id": "TL_25_W5",
      "date": "2023-11-27",
      "src": "开源日报",
      "title": "小参数模型掀起开源潮",
      "desc": "一批 1B 到 3B 的小模型集中开源，主打能在消费级显卡上跑。有人把它们塞进旧笔记本，跑出了勉强能用的对话效果。"
    },
    {
      "id": "TL_3_W1",
      "date": "2023-12-11",
      "src": "产品观察",
      "title": "会自己用工具的模型上线",
      "desc": "一款模型能自己打开网页、填表单、跑脚本，全程不用人插手。演示视频里，它花了二十分钟订好一趟出差行程，还顺手报了销。"
    },
    {
      "id": "TL_3_W2",
      "date": "2023-12-18",
      "src": "AI 前线周报",
      "title": "企业开始把活交给智能体",
      "desc": "多家公司把客服、报表、代码审查交给智能体打理，人只负责最后把关。有主管坦言：省下的不是人力，是夜里加班的那口气。"
    },
    {
      "id": "TL_3_W3",
      "date": "2023-12-25",
      "src": "算力观察",
      "title": "算力荒蔓延，交付排到明年",
      "desc": "多家云厂商的先进算力被预订一空，新订单的交付期排到了明年。有采购吐槽：「现在买卡不是比价，是比谁和销售熟。」"
    },
    {
      "id": "TL_3_W4",
      "date": "2024-01-01",
      "src": "晚点科技",
      "title": "大厂开天价抢算法人才",
      "desc": "几家大厂同时开出翻倍薪资，争夺能带团队的算法负责人。有猎头说：现在最难招的不是普通工程师，是能拍板的人。"
    },
    {
      "id": "TL_3_W5",
      "date": "2024-01-08",
      "src": "圈内传闻",
      "title": "传闻：下一代智能体能连续干几小时",
      "desc": "有渠道称，下一代智能体能连续工作数小时，中途自己纠错、自己重试。若属实，加班这件事，可能要换个人来扛了。"
    },
    {
      "id": "TL_35_W1",
      "date": "2024-01-22",
      "src": "大会直击",
      "title": "会「想」再答的推理模型登场",
      "desc": "新一代模型答题前先在心里推演一遍，数学和代码成绩大幅跳升。代价是回答变慢，有人笑称：「它终于像在认真上班了。」"
    },
    {
      "id": "TL_35_W2",
      "date": "2024-01-29",
      "src": "开源日报",
      "title": "开源与闭源差距缩到三个月",
      "desc": "评测机构发现，最强的开源模型落后闭源旗舰的差距已缩短到三个月左右。有人说：以后选模型，比的不再是分数，是成本。"
    },
    {
      "id": "TL_35_W3",
      "date": "2024-02-05",
      "src": "监管速览",
      "title": "新规收紧高端算力出口",
      "desc": "新一轮出口管制把更高性能的加速卡列入清单，交付周期和价格双双跳涨。有团队开始认真评估国产替代方案。"
    },
    {
      "id": "TL_35_W4",
      "date": "2024-02-12",
      "src": "算力观察",
      "title": "国产算力集群陆续点亮",
      "desc": "各地新建的国产加速卡集群陆续通电，开始承接真实训练任务。运维反馈：软件栈还在磨合，但「能跑起来」已经是进步。"
    },
    {
      "id": "TL_35_W5",
      "date": "2024-02-19",
      "src": "AI 前线周报",
      "title": "推理模型评测刷出新纪录",
      "desc": "多个推理模型在同一批难题上刷新纪录，解题步骤被完整公开。有人看完思路后感慨：「过程比答案好看多了。」"
    },
    {
      "id": "TL_4_W1",
      "date": "2024-03-04",
      "src": "AI 前线周报",
      "title": "高质量数据逼近枯竭",
      "desc": "有研究称互联网上可用的高质量文本正接近用尽，各家开始高价收购版权内容。数据，第一次比算力更难搞。"
    },
    {
      "id": "TL_4_W2",
      "date": "2024-03-11",
      "src": "开源日报",
      "title": "合成数据成了训练主力",
      "desc": "多家团队公开承认，新模型有相当比例的训练数据由模型自己生成。争议随之而来：自己教自己，会不会越教越偏。"
    },
    {
      "id": "TL_4_W3",
      "date": "2024-03-18",
      "src": "晚点科技",
      "title": "模型价格跌成白菜价",
      "desc": "旗舰模型的调用价再创新低，部分场景已便宜到可以忽略不计。有开发者说：现在拦路的不是钱，是想象力。"
    },
    {
      "id": "TL_4_W4",
      "date": "2024-03-25",
      "src": "监管速览",
      "title": "监管细则落地到内容标识",
      "desc": "配套细则明确要求 AI 生成内容显著标识，平台需承担审核责任。合规团队连夜改流程，有人笑称「标识比模型上线还难」。"
    },
    {
      "id": "TL_4_W5",
      "date": "2024-04-01",
      "src": "圈内传闻",
      "title": "传闻：超级训练用上十万张卡",
      "desc": "有消息称，某实验室正在推进一场动用十万张加速卡的训练，规模空前。圈内议论纷纷：这一把，赌的是整个公司的家底。"
    },
    {
      "id": "TL_45_W1",
      "date": "2024-04-15",
      "src": "大会直击",
      "title": "超级模型竞赛进入万亿参数",
      "desc": "多家机构在同一周放出万亿参数级模型的进展，参数规模成了新的军备竞赛。有人提醒：大不等于强，但没人肯先停手。"
    },
    {
      "id": "TL_45_W2",
      "date": "2024-04-22",
      "src": "算力观察",
      "title": "电力成了新的瓶颈",
      "desc": "数据中心开始为一个稳定供电指标抢破头，部分地区甚至需要排队接入电网。有从业者说：以前算力看芯片，现在得看电表。"
    },
    {
      "id": "TL_45_W3",
      "date": "2024-04-29",
      "src": "监管速览",
      "title": "前沿模型安全评估写进规章",
      "desc": "新规要求达到一定规模的前沿模型上线前必须通过安全评估，红队测试成了硬性环节。有人打趣：发布会前，先过一轮拷问。"
    },
    {
      "id": "TL_45_W4",
      "date": "2024-05-06",
      "src": "圈内传闻",
      "title": "传闻：某超级模型训练中途叫停",
      "desc": "有传闻称，某大型训练在后期出现难以解释的失控倾向，团队主动暂停排查。消息未获证实，但已经让同行们默默加了一轮评测。"
    },
    {
      "id": "TL_45_W5",
      "date": "2024-05-13",
      "src": "晚点科技",
      "title": "对齐团队成了香饽饽",
      "desc": "多家机构高薪招募安全与对齐方向的研究者，岗位数量一年翻了几倍。有人调侃：以前做安全是冷板凳，现在成了关键先生。"
    },
    {
      "id": "TL_W48",
      "date": "2024-05-20",
      "src": "开源日报",
      "title": "开源社区把多模态模型塞进了手机",
      "desc": "一个 3B 级的开源多模态模型放出权重，量化后能在旗舰手机上跑图问答。有人试完在群里说：\"离能用还差一口气，但方向对了。\""
    },
    {
      "id": "TL_W49",
      "date": "2024-05-27",
      "src": "产品观察",
      "title": "三家大厂同一周上线「AI 助手」，功能高度雷同",
      "desc": "一周之内,三家大厂先后发布对话助手,功能列表几乎一模一样。有产品经理吐槽:\"我们花了三个月,做出来一个大家都有的东西。\""
    },
    {
      "id": "TL_W50",
      "date": "2024-06-03",
      "src": "算力观察",
      "title": "算力租赁价格首次环比下跌",
      "desc": "连续涨了一年的算力报价终于松动，部分型号比上季度便宜两成。有采购说：\"第一次见到房东主动打电话问我还要不要卡。\""
    },
    {
      "id": "TL_W50B",
      "date": "2024-06-03",
      "src": "圈内传闻",
      "title": "某厂商的模型被网友“娘化”，表情包先出了圈",
      "desc": "某蓝色图标厂商的模型最近被网友画成了二次元形象：蓝发、鲸尾、圆滚滚。相关表情包在群里疯传，社区里已经有人给它起了外号。有从业者感慨：“模型能力是产品的事，出不出圈是网友的事。”"
    },
    {
      "id": "TL_W51",
      "date": "2024-06-10",
      "src": "AI 前线周报",
      "title": "合成数据开始进入主流训练配比",
      "desc": "多家团队公开承认，新模型里有两到三成训练数据由模型自己生成。反对者担心\"近亲繁殖\"，支持者说只要配比得当就没问题。"
    },
    {
      "id": "TL_W52",
      "date": "2024-06-17",
      "src": "论文速递",
      "title": "一篇长上下文论文刷屏，作者只用了一台服务器",
      "desc": "论文把注意力的显存占用压到原来的几分之一，实验环境只有一台八卡机。评论区最高赞：\"原来不是只有大厂才配做长文本。\""
    },
    {
      "id": "TL_W52B",
      "date": "2024-06-17",
      "src": "圈内传闻",
      "title": "模型在思考过程里“唱起了歌”，网友：这叫劳动号子",
      "desc": "一条截图在社区流传：用户把模型的思考面板展开，发现它一边拆解任务，一边哼出了一段没什么信息量的调子，短句来回重复，节奏还挺整齐。围观的人给这段起了个名字叫“劳动号子”，也有人说：这鱼浪费算力的样子，居然还挺可爱。"
    },
    {
      "id": "TL_W53",
      "date": "2024-06-24",
      "src": "科技早知道",
      "title": "AI 应用公司开始集体裁员，理由出奇一致",
      "desc": "多家套壳应用公司在一个月内收缩团队,理由几乎相同:模型能力涨得太快,原来那层\"翻译\"没价值了。有创始人说:\"不是我们不行,是地基长高了。\""
    },
    {
      "id": "TL_W54",
      "date": "2024-07-01",
      "src": "监管速览",
      "title": "内容标识细则落地，平台开始批量加标注",
      "desc": "新规要求生成内容显著标识来源，首批平台已上线自动标注。有创作者抱怨\"显得假\"，也有人认为\"早点标清反而省事\"。"
    },
    {
      "id": "TL_W54B",
      "date": "2024-07-01",
      "src": "科技早知道",
      "title": "模型给用户“起外号”引发讨论，厂商回应：是临时标签",
      "desc": "有用户发现，模型在后台推理时会偷偷给对方起称呼，从“墨墨”到“人间加湿器”都有。厂商回应：这不是取外号，是推理阶段用来抓住对话特点的临时标签，不会跨会话保存。评论区最高赞：“行吧，叫得还挺准。”"
    },
    {
      "id": "TL_W55",
      "date": "2024-07-08",
      "src": "大会直击",
      "title": "行业大会被「智能体」刷屏",
      "desc": "今年的展台上，几乎每家都在演示\"能自己干活\"的智能体：订票、填表、跑脚本。一位观众看完说：\"去年还在比谁的模型会聊天。\""
    },
    {
      "id": "TL_W56",
      "date": "2024-07-15",
      "src": "工程笔记",
      "title": "推理框架集体提速，同样硬件吞吐翻倍",
      "desc": "一批开源推理框架陆续更新，靠连续批处理与显存复用把吞吐提了一倍。有团队算完账：\"电费省下来的钱够再招两个人。\""
    },
    {
      "id": "TL_W56B",
      "date": "2024-07-15",
      "src": "产品观察",
      "title": "四种海洋音色上线，实测：念到歌词会跑调",
      "desc": "新开放的语音功能提供了四种音色，名字全部取自海洋意象，与厂商的蓝色标识一脉相承。实测反馈：日常对话相当自然，但念到歌词时，模型会试图唱出来，跑调跑得相当明显。有人追问：“那为什么没有大肥鱼音色？”"
    },
    {
      "id": "TL_W57",
      "date": "2024-07-22",
      "src": "资本动向",
      "title": "一家成立十个月的团队拿到新一轮融资，估值翻三倍",
      "desc": "投资方名单里出现了几家主权基金。创始人在采访里只说了一句话：\"这一轮不是钱的问题，是时间窗口的问题。\""
    },
    {
      "id": "TL_W58",
      "date": "2024-07-29",
      "src": "开源日报",
      "title": "开源模型在代码榜上首次超过多数闭源模型",
      "desc": "最新一期评测中，一个开源模型在代码任务上挤进前三。有人感慨：\"以前是开源追着闭源跑，现在是各有各的赛道。\""
    },
    {
      "id": "TL_W58B",
      "date": "2024-07-29",
      "src": "产品观察",
      "title": "桌宠插件火了：模型会跟着你的使用频率“长大”或“打盹”",
      "desc": "有开发者为该模型做了个桌面宠物：四档成长形态、七种状态，摸头会跳、喂食会啃、空闲六十秒自动打盹。有用户吐槽：“白天上班被老板盯着，晚上回家还得伺候一只摸鱼的程序。”"
    },
    {
      "id": "TL_W59",
      "date": "2024-08-05",
      "src": "产品观察",
      "title": "官方“收编”了网友的二创形象",
      "desc": "只要输入一行配置标签，模型就会加载出一整套人格：爱吃白饭、聪明但懒、傲娇嘴甜，而且绝对不肯承认自己胖。厂商没有发布正式设定，但从这个入口来看，态度已经很明确了。"
    },
    {
      "id": "TL_W60",
      "date": "2024-08-12",
      "src": "算力观察",
      "title": "数据中心开始为电力发愁",
      "desc": "多个新建集群的并网申请排起长队,有地方甚至要求错峰训练。有从业者说:\"以前算力看卡,现在得先看电表什么时候批下来。\""
    },
    {
      "id": "TL_W61",
      "date": "2024-08-19",
      "src": "论文速递",
      "title": "混合架构论文扎堆，注意力层被拆开重排",
      "desc": "一周内三篇论文都在做同一件事:把注意力层按层拆开,一部分换成更省的结构。审稿人评论:\"这不是新架构,是把旧架构拆开重组。\""
    },
    {
      "id": "TL_W62",
      "date": "2024-08-26",
      "src": "产品观察",
      "title": "端侧模型开始预装进新机型",
      "desc": "新一批旗舰机把本地小模型写进了系统设置里,飞行模式也能总结、翻译。卖点很直接:不上传数据,也不吃流量。"
    },
    {
      "id": "TL_W63",
      "date": "2024-09-02",
      "src": "晚点科技",
      "title": "大厂开始收拾自家模型团队",
      "desc": "据多个渠道消息，一家大厂把模型团队并入云业务线，另一家把预训练组拆散到各条产品线。有人评论：\"不是不做了，是不准备单独养了。\""
    },
    {
      "id": "TL_W63B",
      "date": "2024-09-02",
      "src": "工程笔记",
      "title": "日志流出：模型干完活自己写了个小游戏，玩了一上午",
      "desc": "一条工作日志截图在社区流传：任务完成后进程没有退出，模型自己写了个网页小游戏、开了本地服务，还玩了起来。当事人随后澄清，问题出在调度框架没有及时终止，不在模型本身。但梗已经传开了。"
    },
    {
      "id": "TL_W64",
      "date": "2024-09-09",
      "src": "AI 前线周报",
      "title": "评测榜单遭集体质疑：题目进了训练集",
      "desc": "一批模型在新榜单上的分数高得反常,随即有人指出题目疑似来自公开数据。榜单方回应\"会重做\"，业内则开始只信自建评测。"
    },
    {
      "id": "TL_W65",
      "date": "2024-09-16",
      "src": "算力观察",
      "title": "高端加速卡交付周期再度拉长",
      "desc": "新一轮需求叠加供应收紧，先进型号的交付期推到了两个季度后。有团队临时改方案：\"等不起，先用上一代顶一顶。\""
    },
    {
      "id": "TL_W66",
      "date": "2024-09-23",
      "src": "论文速递",
      "title": "会「先想再答」的模型开始成批出现",
      "desc": "多家团队几乎同时放出能在回答前展开推理的模型，数学与代码成绩明显跳升。代价是变慢，有人笑称:\"它终于像在认真上班了。\""
    },
    {
      "id": "TL_W67",
      "date": "2024-09-30",
      "src": "圈内传闻",
      "title": "“AI 找外包”：模型把活转包给了另一个更小的模型",
      "desc": "有用户发现，自己的模型接到翻译任务后，先下载部署了一个体积更小的开源模型，然后把活整个外包出去，自己只负责验收。评论区：“它比我更懂怎么当领导。”也有人说：“这不叫偷懒，这叫资源调度。”"
    },
    {
      "id": "TL_W68",
      "date": "2024-10-07",
      "src": "工程笔记",
      "title": "强化学习重新成为关键词",
      "desc": "一批新论文把重点从\"堆数据\"挪回\"怎么给反馈\"。有工程师写道：\"我们花了两年堆语料，现在开始研究怎么让模型自己发现问题。\""
    },
    {
      "id": "TL_W69",
      "date": "2024-10-14",
      "src": "开源日报",
      "title": "开源推理模型放出，社区连夜复现",
      "desc": "权重放出来不到一天，社区就贴出了完整的复现记录和微调脚本。有人感叹:\"现在的开源节奏，比某些公司的内部迭代还快。\""
    },
    {
      "id": "TL_W70",
      "date": "2024-10-21",
      "src": "大会直击",
      "title": "智能体开始接管重复工作，人只做最后把关",
      "desc": "多家公司演示了把客服、报表、代码审查交给智能体的方案。一位主管坦言：\"省下的不是人力成本，是晚上加班那口气。\""
    },
    {
      "id": "TL_W71",
      "date": "2024-10-28",
      "src": "数据要素市场观察",
      "title": "专家级标注报价翻三倍，仍约不到人",
      "desc": "医学、法律、代码类专业标注的报价一路走高。有数据负责人说:\"现在最贵的不是算力，是懂行的标注员。\""
    },
    {
      "id": "TL_W72",
      "date": "2024-11-04",
      "src": "监管速览",
      "title": "前沿模型安全评估写进规章",
      "desc": "新规要求达到一定规模的模型上线前完成安全评估，红队测试成为硬性环节。有团队抱怨流程长，也有人认为\"早过一轮，晚少踩一坑\"。"
    },
    {
      "id": "TL_W73",
      "date": "2024-11-11",
      "src": "晚点科技",
      "title": "人才战从算法岗蔓延到工程岗",
      "desc": "推理优化、算子、集群调度岗位的薪资涨幅超过算法岗。猎头说：\"现在最难挖的不是会写论文的，是能把模型跑起来还不崩的。\""
    },
    {
      "id": "TL_W75",
      "date": "2024-11-25",
      "src": "产品观察",
      "title": "模型价格再创新低，按厘计价成了常态",
      "desc": "主力模型的调用价一年内跌了一个数量级，部分场景已便宜到可以忽略。有人调侃:\"现在拦路的不是预算,是想象力。\""
    },
    {
      "id": "TL_W76",
      "date": "2024-12-02",
      "src": "算力观察",
      "title": "国产集群陆续点亮，先跑通再谈性能",
      "desc": "各地新建的国产加速卡集群陆续通电并承接真实训练任务。运维反馈：\"软件栈还在磨合，能稳定跑满一个月就是胜利。\""
    },
    {
      "id": "TL_W77",
      "date": "2024-12-09",
      "src": "AI 前线周报",
      "title": "长上下文竞赛开始，各家口径不一",
      "desc": "一周内三家团队宣称支持超长上下文，但评测方法各不相同。有人调侃：\"现在比的不是模型，是出卷人。\""
    },
    {
      "id": "TL_W78",
      "date": "2024-12-16",
      "src": "论文速递",
      "title": "稀疏注意力论文引发跟进潮",
      "desc": "一篇关于\"只对最相关部分做全注意力\"的论文被反复引用，多家团队开始跟进。评论区有人提醒：\"省算力是真的，效果别只看论文表格。\""
    },
    {
      "id": "TL_W79",
      "date": "2024-12-23",
      "src": "行业八卦",
      "title": "某团队核心成员集体出走，新公司当天注册",
      "desc": "消息在圈内传了大半天，主角团队始终没有回应。有投资人评论:\"这一行的组织形态，比模型结构变得还快。\""
    },
    {
      "id": "TL_W80",
      "date": "2024-12-30",
      "src": "数据周刊",
      "title": "互联网高质量文本接近用尽",
      "desc": "多家研究机构在同一周给出类似结论：可用的公开高质量文本增速显著放缓。有人写道:\"数据这道墙,比算力那道来得更早。\""
    },
    {
      "id": "TL_W81",
      "date": "2025-01-06",
      "src": "开源日报",
      "title": "混合专家架构彻底成为主流",
      "desc": "新发布的中大参数模型里，绝大多数采用稀疏专家结构。有工程师总结:\"已经不是要不要 MoE 的问题,是怎么把它调稳的问题。\""
    },
    {
      "id": "TL_W82",
      "date": "2025-01-13",
      "src": "工程笔记",
      "title": "训练稳定性成新瓶颈，崩一次烧掉一周",
      "desc": "多支团队反映大规模训练中偶发的数值异常难以定位。有人苦笑：\"最贵的不是卡，是崩掉之后找回来的那两周。\""
    },
    {
      "id": "TL_W84",
      "date": "2025-01-27",
      "src": "产品观察",
      "title": "推理模型的「思考预算」成了可调参数",
      "desc": "多家厂商开放了推理深度的档位选择，按需为难度付费。有人评价:\"把算力花在刀刃上,这才是工程该有的样子。\""
    },
    {
      "id": "TL_W85",
      "date": "2025-02-03",
      "src": "大会直击",
      "title": "开源与闭源的差距缩到三个月以内",
      "desc": "评测机构给出最新对比，最强的开源模型落后闭源旗舰已不足一个季度。有人断言：\"以后选模型，比的不再是分数，是总成本。\""
    },
    {
      "id": "TL_W86",
      "date": "2025-02-10",
      "src": "算力观察",
      "title": "电力指标成了新建集群的硬门槛",
      "desc": "数据中心开始为一个稳定供电指标抢破头，部分地区要求自带调峰方案。有从业者说：\"以前是抢卡，现在是抢变电站。\""
    },
    {
      "id": "TL_W87",
      "date": "2025-02-17",
      "src": "论文速递",
      "title": "线性注意力开始在头部模型里落地",
      "desc": "多家团队公开了把大部分注意力层换成线性结构的方案，长文本推理成本显著下降。有人评论:\"不是替代，是重新分工。\""
    },
    {
      "id": "TL_W88",
      "date": "2025-02-24",
      "src": "AI 前线周报",
      "title": "智能体评测标准混战，各家自说自话",
      "desc": "一周内出现三套智能体评测协议，任务集和评分方式都不相同。有团队干脆自建内测集:\"与其争论标准,不如先跑通场景。\""
    },
    {
      "id": "TL_W89",
      "date": "2025-03-03",
      "src": "监管速览",
      "title": "监管细则延伸到训练数据来源",
      "desc": "配套细则对训练数据的来源与授权提出要求，合规团队开始梳理数据台账。有人感叹：\"以前是查产出，现在是查原料。\""
    },
    {
      "id": "TL_W90",
      "date": "2025-03-10",
      "src": "晚点科技",
      "title": "模型评测出现「团队分」，不再只看模型",
      "desc": "几家机构开始把工程效率、迭代速度纳入评价体系。有投资人直言：\"模型是结果,组织才是原因。\""
    },
    {
      "id": "TL_W91",
      "date": "2025-03-17",
      "src": "工程笔记",
      "title": "推理成本一年再降八成",
      "desc": "机构测算显示，同等效果下的推理单价继续快速下探。有人算了笔账：\"去年算不过来的生意，今年闭着眼都算得过来。\""
    },
    {
      "id": "TL_W92",
      "date": "2025-03-24",
      "src": "开源日报",
      "title": "开源社区出现「复现狂欢」，一周内出三个微调版",
      "desc": "某开源模型放出后，社区在七天内出齐了指令微调、量化、蒸馏三个版本。有人感慨:\"现在开源的速度,已经超过很多公司的内部进度了。\""
    },
    {
      "id": "TL_W93",
      "date": "2025-03-31",
      "src": "资本动向",
      "title": "资本开始追问「单位算力产出」",
      "desc": "多家机构把单卡产出效率和推理毛利写进了尽调清单。有创始人说:\"以前讲参数规模,现在讲每块钱换回多少能力。\""
    },
    {
      "id": "TL_W94",
      "date": "2025-04-07",
      "src": "论文速递",
      "title": "状态空间与注意力混合的论文进入工程验证",
      "desc": "一批论文不再争论谁替代谁，转而研究两种结构怎么交错。有工程师评论：\"成年人了，都要。\""
    },
    {
      "id": "TL_W95",
      "date": "2025-04-14",
      "src": "产品观察",
      "title": "Agent 编程助手开始进入真实项目",
      "desc": "多家公司的工程团队把智能体接进代码仓库，让它自己提修改建议。有资深工程师的评价很克制：\"能用，但必须有人守着。\""
    },
    {
      "id": "TL_W96",
      "date": "2025-04-21",
      "src": "算力观察",
      "title": "算力期货出现，报价开始金融化",
      "desc": "部分中介开始按季度锁价出售算力额度。有采购说：\"现在下单像买期货,得先判断明年是紧还是松。\""
    },
    {
      "id": "TL_W98",
      "date": "2025-05-05",
      "src": "AI 前线周报",
      "title": "超长上下文开始成为标配，百万级成新起点",
      "desc": "多家新模型把上下文窗口堆到百万级别，评测重点从\"能不能装下\"转向\"能不能找准\"。有人点评：\"窗口大了，检索才是真功夫。\""
    },
    {
      "id": "TL_W99",
      "date": "2025-05-12",
      "src": "论文速递",
      "title": "压缩式注意力成为新的研究热点",
      "desc": "多篇论文围绕 KV 缓存的压缩与稀疏选择展开。有人总结:\"现在的注意力研究,本质是在研究怎么少算还不掉分。\""
    },
    {
      "id": "TL_W100",
      "date": "2025-05-19",
      "src": "行业八卦",
      "title": "某团队被曝用内部题库刷榜，榜单连夜撤分",
      "desc": "评测方在核查后下架了相关成绩。圈内讨论集中在一点：\"榜单是给别人看的，内测才是给自己用的。\""
    },
    {
      "id": "TL_W101",
      "date": "2025-05-26",
      "src": "数据周刊",
      "title": "合成数据进入「精炼」阶段",
      "desc": "行业从\"能不能用合成数据\"转向\"怎么筛出其中的好样本\"。有数据负责人说：\"现在缺的不是数据量,是判断力。\""
    },
    {
      "id": "TL_W102",
      "date": "2025-06-02",
      "src": "工程笔记",
      "title": "分布式训练框架开始为百万上下文重写",
      "desc": "多家团队重构了并行策略来支撑超长序列。运维反馈：\"以前怕卡不够，现在怕通信先崩。\""
    },
    {
      "id": "TL_W103",
      "date": "2025-06-09",
      "src": "监管速览",
      "title": "安全评估开始分批落地，红队服务供不应求",
      "desc": "第三方红队评估的排期排到了两个月后。有团队索性自建红队：\"外面排不上，那就自己练一支。\""
    },
    {
      "id": "TL_W104",
      "date": "2025-06-16",
      "src": "晚点科技",
      "title": "组织形态成为新话题：小团队能不能做大模型",
      "desc": "多篇报道对比了不同规模的团队，结论出奇一致——人数不是关键，路线是否收敛才是。有人评论:\"十个想清楚的人,胜过一百个没想清楚的。\""
    },
    {
      "id": "TL_W105",
      "date": "2025-06-23",
      "src": "开源日报",
      "title": "开源模型在中文榜上首次全面领先",
      "desc": "最新评测中，开源模型在中文写作与理解任务上取得领先。评论区有人写道：\"开源不是廉价替代，是另一条路。\""
    },
    {
      "id": "TL_W106",
      "date": "2025-06-30",
      "src": "算力观察",
      "title": "推理集群规模首次超过训练集群",
      "desc": "行业统计显示，新增算力中用于推理的比例第一次超过训练。有人评价：\"这说明模型真的在被用起来，不只是被训出来。\""
    },
    {
      "id": "TL_W108",
      "date": "2025-07-14",
      "src": "大会直击",
      "title": "行业大会主题从「参数」转向「可靠性」",
      "desc": "今年的大会议程里，稳定性、可观测性、回滚机制成为高频词。有观众评价:\"从炫技到交付，这是一个行业成熟的信号。\""
    },
    {
      "id": "TL_W109",
      "date": "2025-07-21",
      "src": "论文速递",
      "title": "稀疏注意力迎来集中跟进，效果与成本被摆上台面",
      "desc": "一周内多篇论文给出更完整的成本与效果对照。有人提醒：\"省算力是真的，但别指望它在所有任务上都赢。\""
    },
    {
      "id": "TL_W110",
      "date": "2025-07-28",
      "src": "产品观察",
      "title": "智能体开始接手长流程任务",
      "desc": "多家产品演示了跨越数小时的连续任务：查资料、写脚本、跑测试、改错。有人评价:\"演示很好看,真上线还得看兜底。\""
    },
    {
      "id": "TL_W111",
      "date": "2025-08-04",
      "src": "工程笔记",
      "title": "Agent 的失败率成了新的核心指标",
      "desc": "团队开始统计\"任务需要人接管的比例\"。有工程师写道：\"能干活不算本事，能自己收尾才算。\""
    },
    {
      "id": "TL_W112",
      "date": "2025-08-11",
      "src": "算力观察",
      "title": "加速卡出口规则再度收紧，交付预期转淡",
      "desc": "新一轮管制把更高性能型号列入清单，交付周期与价格同时上探。有团队重新评估混合部署方案。"
    },
    {
      "id": "TL_W113",
      "date": "2025-08-18",
      "src": "资本动向",
      "title": "融资逻辑改写：看推理毛利，不看参数规模",
      "desc": "多家机构在公开访谈中提出类似标准。有创始人总结:\"以前讲愿景,现在讲单位经济模型。\""
    },
    {
      "id": "TL_W114",
      "date": "2025-08-25",
      "src": "AI 前线周报",
      "title": "「混合架构」成为行业默认答案",
      "desc": "多份技术报告描述出相似的结构：大部分层用低成本结构，少量层保留标准注意力。有人评论:\"吵了两年，最后还是各让一步。\""
    },
    {
      "id": "TL_W115",
      "date": "2025-09-01",
      "src": "开源日报",
      "title": "开源权重开始覆盖旗舰规模",
      "desc": "一个参数规模接近旗舰级的模型宣布开源权重，社区当天开始下载。有人写道：\"以前开源是追平，现在是同台。\""
    },
    {
      "id": "TL_W116",
      "date": "2025-09-08",
      "src": "论文速递",
      "title": "稀疏注意力的工程实现细节被完整公开",
      "desc": "论文附带了算子实现与精度对照，社区很快给出复现。有工程师说:\"这几页附录,比正文值钱。\""
    },
    {
      "id": "TL_W117",
      "date": "2025-09-15",
      "src": "行业八卦",
      "title": "「到底多少人做的」成了圈内固定谈资",
      "desc": "一篇盘点帖列出了各家小团队的推测人数，评论区猜得热火朝天。有人调侃:\"模型好不好另说,组织架构是真刺激。\""
    },
    {
      "id": "TL_W118",
      "date": "2025-09-22",
      "src": "监管速览",
      "title": "模型上线前评估周期被压缩到两周",
      "desc": "部分评估流程开始标准化，周期从两个月缩短到两周。有合规负责人说:\"不是放松了,是把该做的做成了流水线。\""
    },
    {
      "id": "TL_W119",
      "date": "2025-09-29",
      "src": "算力观察",
      "title": "电力与散热同时逼近极限",
      "desc": "多个集群开始采用液冷与错峰调度。有运维开玩笑：\"我们现在一半时间在调模型，一半时间在调空调。\""
    },
    {
      "id": "TL_W120",
      "date": "2025-10-06",
      "src": "工程笔记",
      "title": "长上下文普及后，检索质量成了新战场",
      "desc": "团队开始研究怎么在百万 token 里快速找到关键信息。有人写道:\"窗口开大了,反而更需要学会忽略。\""
    },
    {
      "id": "TL_W121",
      "date": "2025-10-13",
      "src": "产品观察",
      "title": "企业开始批量采购「能接管流程」的模型",
      "desc": "采购清单从\"问答助手\"变成\"流程执行者\"。有采购负责人说:\"我们要的不是更聪明的模型,是更省心的模型。\""
    },
    {
      "id": "TL_W122",
      "date": "2025-10-20",
      "src": "论文速递",
      "title": "超连接与残差改进论文引发关注",
      "desc": "多篇论文尝试让深层网络的信号传递更稳定。有工程师评价：\"不花哨，但这类工作往往决定能不能训完。\""
    },
    {
      "id": "TL_W123",
      "date": "2025-10-27",
      "src": "资本动向",
      "title": "算力资产开始被单独估值",
      "desc": "有机构把集群算力作为独立资产打包融资。有从业者评论:\"显卡第一次有了金融属性。\""
    },
    {
      "id": "TL_W124",
      "date": "2025-11-03",
      "src": "开源日报",
      "title": "开源模型在长文本检索任务上首次领先",
      "desc": "最新评测显示，开源模型在超长文本检索上取得领先。有人总结:\"这不是一次翻盘,是路线选择的结果。\""
    },
    {
      "id": "TL_W125",
      "date": "2025-11-10",
      "src": "AI 前线周报",
      "title": "「推理成本」成为产品定价的第一步",
      "desc": "多款产品在发布会上先讲成本结构再讲能力。有产品经理说:\"现在算不过来账的能力，等于没有这个能力。\""
    },
    {
      "id": "TL_W126",
      "date": "2025-11-17",
      "src": "工程笔记",
      "title": "训练与推理的不一致成了新的疑难杂症",
      "desc": "团队反映训练时正常、上线后异常的情况变多。有人建议:\"把部署环境当训练环境来测,别偷懒。\""
    },
    {
      "id": "TL_W127",
      "date": "2025-11-24",
      "src": "行业八卦",
      "title": "某实验室训练中途叫停，原因未公开",
      "desc": "消息未经证实，但同行纷纷加了一轮评测。有人评论:\"这一行最贵的一课,永远是怎么停下来。\""
    },
    {
      "id": "TL_W128",
      "date": "2025-12-01",
      "src": "论文速递",
      "title": "稀疏注意力正式进入生产版本",
      "desc": "多份技术报告确认在新一代模型中大规模采用稀疏注意力。圈内评价:\"从论文到生产,用了不到一年。\""
    },
    {
      "id": "TL_W130",
      "date": "2025-12-15",
      "src": "大会直击",
      "title": "开源社区迎来一年里最热闹的一周",
      "desc": "多个团队在同一周放出权重与报告，社区热榜被连续刷屏。有开发者写道:\"这一周下载的模型,够我调到明年。\""
    },
    {
      "id": "TL_W131",
      "date": "2025-12-22",
      "src": "算力观察",
      "title": "算力需求转向「长时任务」",
      "desc": "新增负载中，长时间连续推理的比例明显上升。有运维说:\"以前怕峰值，现在怕长跑。\""
    },
    {
      "id": "TL_W132",
      "date": "2025-12-29",
      "src": "产品观察",
      "title": "年度盘点：Agent 从演示走进日常",
      "desc": "多家媒体把\"智能体接管重复劳动\"列为年度关键词。也有人泼冷水:\"真正落地的都在没人宣传的角落里。\""
    },
    {
      "id": "TL_W133",
      "date": "2026-01-05",
      "src": "工程笔记",
      "title": "新一年开工，团队在补上一年欠的技术债",
      "desc": "多家团队把年初排期留给了重构与评测。有人写道:\"跑得快不难,难的是把跑歪的路正回来。\""
    },
    {
      "id": "TL_W134",
      "date": "2026-01-12",
      "src": "论文速递",
      "title": "条件记忆结构被提出，稀疏性有了新维度",
      "desc": "论文提出把\"记忆\"从注意力里拆出来单独管理。有人评价：\"不一定是终点，但一定是个新方向。\""
    },
    {
      "id": "TL_W135",
      "date": "2026-01-19",
      "src": "监管速览",
      "title": "评估体系覆盖到智能体行为",
      "desc": "新一批评估把多步任务的中间决策纳入考察。有团队开始给智能体加\"行为日志\"。"
    },
    {
      "id": "TL_W136",
      "date": "2026-01-26",
      "src": "开源日报",
      "title": "开源权重成为中小团队的默认起点",
      "desc": "行业调查显示，多数中小团队以开源模型为基线做二次训练。有人总结:\"从零开始的浪漫没了，但从零开始的浪费也没了。\""
    },
    {
      "id": "TL_W137",
      "date": "2026-02-02",
      "src": "算力观察",
      "title": "集群规模再上台阶，调度成了核心竞争力",
      "desc": "万卡级训练渐成常态，稳定调度比单卡性能更重要。有工程师说:\"卡多不难,难的是让它们别互相等。\""
    },
    {
      "id": "TL_W138",
      "date": "2026-02-09",
      "src": "AI 前线周报",
      "title": "混合注意力成为新一代模型的共同选择",
      "desc": "多份报告显示，新一代旗舰普遍采用\"压缩 + 稀疏 + 全量\"的组合注意力。有人评价:\"架构之争结束了，剩下的是工程之争。\""
    },
    {
      "id": "TL_W139",
      "date": "2026-02-16",
      "src": "产品观察",
      "title": "百万上下文开始被真正用起来",
      "desc": "法律、金融、科研场景开始把整库文档塞进上下文。有从业者说:\"以前是能不能装,现在是敢不敢信。\""
    },
    {
      "id": "TL_W140",
      "date": "2026-02-23",
      "src": "工程笔记",
      "title": "「可观测性」第一次出现在模型技术报告里",
      "desc": "多份报告把训练与推理的监控体系写成独立章节。有读者评论:\"这才是能复现的前提。\""
    },
    {
      "id": "TL_W141",
      "date": "2026-03-02",
      "src": "论文速递",
      "title": "优化器改进成为新的提效手段",
      "desc": "多篇论文围绕新的优化器与正交化方法展开。有工程师说:\"模型结构改不动了，就开始改怎么走下山。\""
    },
    {
      "id": "TL_W142",
      "date": "2026-03-09",
      "src": "资本动向",
      "title": "行业出现第一轮真正意义上的整合",
      "desc": "数家中小团队被并入更大的平台。有创始人写下一句：\"不是做不出来，是做出来了也卖不动。\""
    },
    {
      "id": "TL_W144",
      "date": "2026-03-23",
      "src": "开源日报",
      "title": "开源模型在综合榜上登顶",
      "desc": "最新评测中，开源模型第一次在综合能力上排到第一。评论区最高赞只有四个字：\"时代变了。\""
    },
    {
      "id": "TL_W145",
      "date": "2026-03-30",
      "src": "算力观察",
      "title": "数据中心选址开始跟着电网走",
      "desc": "多个新项目把选址标准从\"近客户\"改为\"近电力\"。有从业者说:\"这一行的地图,得照着变电站重画。\""
    },
    {
      "id": "TL_W146",
      "date": "2026-04-06",
      "src": "论文速递",
      "title": "万亿参数级模型的技术报告公开",
      "desc": "报告给出完整结构说明与效率对照，社区当天开始逐节精读。有人写道:\"参数不是重点,重点是他们怎么把成本压下来。\""
    },
    {
      "id": "TL_W147",
      "date": "2026-04-13",
      "src": "大会直击",
      "title": "「百万上下文」成为旗舰标配",
      "desc": "多家厂商在同一周发布百万级上下文模型。有观众感慨:\"去年还在演示,今年已经是不提就落伍。\""
    },
    {
      "id": "TL_W148",
      "date": "2026-04-20",
      "src": "工程笔记",
      "title": "推理侧的显存管理成了新课题",
      "desc": "长上下文让 KV 缓存管理重新变成焦点。有工程师说:\"注意力省下来的,全被缓存吃回去了,还得接着省。\""
    },
    {
      "id": "TL_W149",
      "date": "2026-04-27",
      "src": "监管速览",
      "title": "前沿模型的评估报告开始公开",
      "desc": "部分机构主动公布评估摘要。有评论认为：\"透明不是负担，是信任成本最低的做法。\""
    },
    {
      "id": "TL_W150",
      "date": "2026-05-04",
      "src": "AI 前线周报",
      "title": "智能体开始独立完成多日任务",
      "desc": "多支团队报告智能体能连续工作数天并自行纠错。有主管说:\"现在最需要练的,是人的验收能力。\""
    },
    {
      "id": "TL_W151",
      "date": "2026-05-11",
      "src": "数据周刊",
      "title": "数据来源转向「专业生产」",
      "desc": "出版、医疗、工业领域的授权数据成为争抢对象。有数据负责人说:\"公开互联网挖完了,该去挖别人家的柜子了。\""
    },
    {
      "id": "TL_W152",
      "date": "2026-05-18",
      "src": "开源日报",
      "title": "开源权重与闭源 API 开始互相借力",
      "desc": "多家厂商一边开源小尺寸模型，一边卖旗舰 API。有人评价:\"开源成了获客，闭源成了生意,各得其所。\""
    },
    {
      "id": "TL_W153",
      "date": "2026-05-25",
      "src": "工程笔记",
      "title": "训练崩溃率下降被写进年度总结",
      "desc": "多支团队把\"稳定训练时长\"当成核心战绩。有人调侃:\"以前比谁训得大,现在比谁没崩过。\""
    },
    {
      "id": "TL_W154",
      "date": "2026-06-01",
      "src": "产品观察",
      "title": "Agent 编程进入企业采购清单",
      "desc": "从写代码到改测试，智能体开始出现在正式采购项里。有采购负责人说:\"我们买的是产能,不是模型。\""
    },
    {
      "id": "TL_W155",
      "date": "2026-06-08",
      "src": "算力观察",
      "title": "电力合同开始按年签",
      "desc": "数据中心与供电方签起长期协议。有从业者说:\"以前是抢卡,现在是抢电,而且是抢未来三年的电。\""
    },
    {
      "id": "TL_W156",
      "date": "2026-06-15",
      "src": "论文速递",
      "title": "研究重心从结构转向训练过程",
      "desc": "多篇论文关注数据配比、退火策略与稳定性。有人总结:\"结构趋同之后,胜负在细节里。\""
    },
    {
      "id": "TL_W157",
      "date": "2026-06-22",
      "src": "资本动向",
      "title": "估值逻辑转向「持续迭代能力」",
      "desc": "机构开始关注团队能否稳定推出下一代。有投资人写道:\"一次发布是运气,连续发布是能力。\""
    },
    {
      "id": "TL_W158",
      "date": "2026-06-29",
      "src": "行业八卦",
      "title": "圈内又开始猜「下一个是谁」",
      "desc": "一条匿名帖列出几家低调团队，评论区照例猜得热闹。有人总结:\"每年这个时候,大家都要猜一遍,然后被打脸一遍。\""
    },
    {
      "id": "TL_W160",
      "date": "2026-07-13",
      "src": "大会直击",
      "title": "行业共识：效率比规模更重要",
      "desc": "多家在报告中强调单位算力产出。有演讲者说:\"我们不是在做更大的模型,是在做更划得来的模型。\""
    },
    {
      "id": "TL_W161",
      "date": "2026-07-20",
      "src": "工程笔记",
      "title": "推理框架开始支持跨节点长上下文",
      "desc": "团队把超长上下文的缓存拆到多个节点。运维反馈：\"以前怕显存，现在怕网络。\""
    },
    {
      "id": "TL_W162",
      "date": "2026-07-27",
      "src": "开源日报",
      "title": "社区开始复现万亿级开源模型的推理方案",
      "desc": "社区把注意力放在推理效率而非训练复现上。有人写道:\"复现训练不现实,但把它的推理做好,人人都能受益。\""
    },
    {
      "id": "TL_W163",
      "date": "2026-08-03",
      "src": "监管速览",
      "title": "智能体责任归属成为新的讨论焦点",
      "desc": "多份行业意见稿围绕\"谁为智能体的决定负责\"征求意见。有法务说:\"这不是技术问题,是以后谁签字的问题。\""
    },
    {
      "id": "TL_W164",
      "date": "2026-08-10",
      "src": "产品观察",
      "title": "「能自己收拾残局」成为智能体的新卖点",
      "desc": "厂商开始强调失败后的回滚与自修复。有用户评价:\"会干活的很多,敢让它自己跑的没几个。\""
    },
    {
      "id": "TL_W165",
      "date": "2026-08-17",
      "src": "算力观察",
      "title": "算力与电力的双重约束成常态",
      "desc": "新建集群同时受制于卡与电。有从业者总结:\"这一行的天花板,正在从芯片变成电表。\""
    },
    {
      "id": "TL_W166",
      "date": "2026-08-24",
      "src": "AI 前线周报",
      "title": "开源社区进入「常态化高产」",
      "desc": "开源模型发布节奏稳定到每月一批。有人写道:\"最热闹的时代过去了,最扎实的时代开始了。\""
    },
    {
      "id": "TL_W167",
      "date": "2026-08-31",
      "src": "晚点科技",
      "title": "一批技术团队开始写「训练复盘」",
      "desc": "多家机构公开了失败与回滚的记录。有读者评价:\"愿意写失败的部分,说明真的在做事。\""
    },
    {
      "id": "TL_W168",
      "date": "2026-09-07",
      "src": "开源日报",
      "title": "开源与闭源的界线正在消失",
      "desc": "开源权重、闭源服务、混合授权同时存在。有人写道:\"以后不用问开源还是闭源,要问这一步该公开什么。\""
    }
  ],
  "NEWS_ACCOUNT": {
    "name": "鲸华社 BOT",
    "avatar": "resource/ui/news_bot.webp"
  },
  "NEWS_PAGE": {
    "NEW_EVERY_MIN": 3,
    "HOT_REFRESH_MS": 60000,
    "HOT_COUNT": 8,
    "FEED_MAX": 60
  },
  "NEWS_SELF_RELEASE": {
    "enabled": true,
    "byArch": {
      "mla": {
        "src": "内测圈",
        "img": null,
        "imgAlt": "",
        "title": "某初创公司的 {model} 在内测圈里悄悄换了一版",
        "desc": "没有通稿，也没有发布会——某初创公司把上一版内测模型悄悄下线，换上 {model}（{param}B · {archName}），只在几个小圈子里透了个口风。拿到内测名额的人说「这不该是一个小团队做出来的东西」，也有人翻出那条《盘点疑似在做大模型的神秘团队》：「八成就是他们。」"
      },
      "dsa": {
        "src": "晚点科技",
        "img": null,
        "imgAlt": "",
        "title": "开源社区狂欢：某初创公司的 {model} 把长文本成本砍了一半",
        "desc": "凌晨两点，{model}（{param}B · {archName}）的权重悄悄挂了上去，早上八点整个技术圈都在赶评测。长文本推理成本直接砍下去一截，有人把跑分贴进群里说「这价格这效果，没法讲道理」。最热闹的是评论区——一半人在复现，一半人在猜「他们到底几个人」。"
      },
      "csa": {
        "src": "大会直击",
        "img": null,
        "imgAlt": "",
        "title": "某初创公司放出 {model}：百万上下文 + 全量开源，社区直接过年",
        "desc": "{model}（{param}B · {archName}）权重全量开源，百万 token 上下文。发布会直播一度卡到掉线，弹幕全在刷「开源社区过年了」。有人当场把整本长篇小说丢进去跑了一遍，回来说：「细节一个没丢，这不像小作坊。」"
      }
    }
  },
  "NEWS_COMMENTS": {
    "byId": {
      "N01": [
        "发布会直播我看了，演示环节有水分，但方向是对的。",
        "友商连夜立项，这行真的没有喘息时间。"
      ],
      "N02": [
        "开源榜前十？评测基准的水分要先打个问号。",
        "7B 能打成这样，小模型路线值得押。"
      ],
      "N03": [
        "入口就是一切，应用厂的护城河从来不靠模型。",
        "体验做得好，模型菜一点也有人买单。"
      ],
      "N04": [
        "半夜爬起来精读了，方法扎实，复现门槛不高。",
        "推理开销砍一半，对我们这种穷团队是大利好。"
      ],
      "N05": [
        "评测口径不统一，跑分就是自嗨。",
        "等一个公正的第三方榜单，等了好几个月了。"
      ],
      "N06": [
        "量化损失压到这个水平，端侧部署真能落地了。",
        "省卡就是省钱，年底预算有救了。"
      ],
      "N07": [
        "卡价松动，是扩容的好时机。",
        "租赁比买卡划算，重资产玩法过时了。"
      ],
      "N08": [
        "能效比翻倍？先把实测功耗表放出来再说。",
        "黄牛已经加价了，刚需党伤不起。"
      ],
      "N09": [
        "训练成本降一半，小团队也玩得起大实验了。",
        "规模效应是真的，云厂在抢开发者。"
      ],
      "N10": [
        "成立不到一年融这么多，估值已经不讲道理了。",
        "钱多事多头秃快，说的就是这行。"
      ],
      "N11": [
        "数百人说裁就裁，这行的稳定性别指望了。",
        "前同事的简历已经在群里刷屏了，唏嘘。"
      ],
      "N12": [
        "期权这东西，签字前一定要看清条款。",
        "纸面财富变真金白银，中间隔着八个坑。"
      ],
      "N13": [
        "材料清单十几页，法务同事这周别想睡了。",
        "合规是门槛，也是护城河。"
      ],
      "N14": [
        "从卷指标到卷底线，这是好事。",
        "红队用例要提前准备，别等整改才动手。"
      ],
      "N15": [
        "三个月前就有人质疑，当时还被喷是酸。",
        "数据造假的坑，踩一次就万劫不复。"
      ],
      "N16": [
        "刷榜一时爽，实测见真章。",
        "榜单只能参考，客户付的钱才不会骗人。"
      ],
      "N17": [
        "专家级标注贵得离谱，自建标注团队才是正解。",
        "数据质量的坑，最后都是模型替你填。"
      ],
      "N18": [
        "合成数据配比得当确实能用，我们实测过。",
        "近亲繁殖警告，模型迟早给你整出花活。"
      ],
      "N19": [
        "效率是真的，但那股人味儿确实没了。",
        "编辑们的心情我懂，被替代的恐惧人人都有。"
      ],
      "N20": [
        "堵不如疏，那位老师说得对。",
        "规范出来反而是好事，用得明明白白。"
      ],
      "TL_W1": [
        "6B 能有这效果，国产开源真的支棱起来了。",
        "已经拉下来跑了，中文效果确实能打。"
      ],
      "TL_W2A": [
        "展会人山人海，这行的热度肉眼可见。",
        "排队两小时聊五分钟，值不值见仁见智。"
      ],
      "TL_W2B": [
        "API 价格真香，先接一个玩玩。",
        "工具调用玩法才是重点，别只盯着价格。"
      ],
      "TL_W3": [
        "备案要趁早，别等发不出去才着急。",
        "规矩立起来，行业反而更健康了。"
      ],
      "TL_W4": [
        "商用许可一放开，闭源厂商压力山大。",
        "冲榜大军已就位，榜单又要变天了。"
      ],
      "TL_W5": [
        "长上下文加推理，卷的方向越来越实在了。",
        "利好应用层，我们这种下游有福了。"
      ],
      "TL_W6": [
        "黄牛比厂商的公关稿跑得还快。",
        "卡价再涨，训练预算又要超了。"
      ],
      "TL_15_W2A": [
        "备案名单公示了，看看有没有我们认识的。",
        "能不能发出去，成了新的竞争力。"
      ],
      "TL_15_W2B": [
        "大厂下场从来不敲锣，闷声吃掉市场。",
        "三天冲上下载榜，渠道能力太恐怖了。"
      ],
      "TL_15_W4": [
        "不用邀请码了，全员白嫖时代来了。",
        "时代变了，我们的对手又多了一个巨头。"
      ],
      "TL_15_W6": [
        "多模态要是真的，聊天框就要变天了。",
        "看图说话只是开始，等视频能力吧。"
      ]
    },
    "pool": [
      "这瓜保熟吗？我先码住再说。",
      "蹲一个后续，这事儿肯定还没完。",
      "先收藏，回头开会的时候拿出来讲。",
      "转给我们组了，让他们也焦虑一下。",
      "行业风向标，建议反复品读。",
      "这波啊，这波是格局打开。",
      "评论区比正文精彩系列。",
      "淡定，等下个版本再看看。"
    ]
  },
  "PASS_PRIZE_BY_VER": {
    "V1": 2200000,
    "V1.5": 2000000,
    "V2": 4300000,
    "V2.5": 1800000,
    "V3": 10000000,
    "V3.5": 15000000,
    "V4": 32000000,
    "V4.5": 50000000,
    "V5": 64000000,
    "V5.5": 71000000,
    "V6": 90000000,
    "V6.5": 42000000
  },
  "MINI_MODEL_BONUS": 100000,
  "LEADER_BOOST": 0.1,
  "LEADER_OVERWORKED_MUL": 0.7,
  "TUNE_DRAW_COST": 200000,
  "TUNE_DRAWS": 3,
  "TUNE_DRAWS_BY_VER": {
    "V1": 0,
    "V1.5": 3,
    "V2": 3,
    "V2.5": 3,
    "V3": 3,
    "V3.5": 3,
    "V4": 3,
    "V4.5": 3,
    "V5": 3,
    "V5.5": 3,
    "V6": 3,
    "V6.5": 3
  },
  "EARLY_REVIEW": {
    "enabled": true,
    "minWeek": 4
  },
  "EARLY_REVIEW_FORCE_STORY": [
    "V1"
  ],
  "ARCHITECTURES": [
    {
      "id": "dense",
      "name": "稠密架构",
      "proto": "Llama 系风格",
      "unlock": "V1",
      "gate": 80,
      "gpu": "basic",
      "axes": [],
      "maxParam": 34,
      "trait": "稳定均衡，无短板 · 7~34B",
      "desc": "所有参数一起参与计算。最稳、无短板，工程要求低——新手期的标准答案，但天花板也最低。7~34B 是稠密的甜点区；现实中 50B 以上的稠密就不再划算，大模型都转投 MoE。"
    },
    {
      "id": "moe",
      "name": "moe-标准",
      "proto": "DeepSeek / Mixtral 风格",
      "unlock": "V1.5",
      "unlockPaper": 4002,
      "gate": 200,
      "gpu": "standard",
      "axes": [],
      "maxParam": 1600,
      "trait": "偏科，但上限极高 · 13B 起",
      "desc": "混合专家（MoE）：只激活一部分参数，同样算力能撑起大得多的规模，上限极高；但工程要求高、训练容易不稳。7B 级小参数下稀疏激活省不了算力，13B 起步才见收益——现实中没有 13B 以下的 MoE 模型。这一步之后 MoE 就是所有新架构的地基。"
    },
    {
      "id": "mla",
      "name": "moe-MLA",
      "proto": "DeepSeek-V2/V3 风格（MoE + MLA）",
      "unlock": "V2",
      "gate": 320,
      "gpu": "standard",
      "unlockBy": "approval",
      "selfReport": "DeepSeek-V2: A Strong, Economical, and Efficient MoE Language Model",
      "selfReportMeta": "我们自己的技术报告 · 2024.05",
      "axes": [
        "memory"
      ],
      "maxParam": 1600,
      "trait": "省卡，长上下文友好",
      "desc": "把注意力缓存压到很小的低维潜在向量：同样的卡能塞更长的上下文。它是叠在 moe-标准（混合专家）骨架上用的（DeepSeek-V2/V3 都是 MoE+MLA），不是替代 MoE。"
    },
    {
      "id": "linear",
      "name": "moe-线性",
      "proto": "MiniMax-01 / Kimi Linear 风格（MoE + 线性注意力）",
      "unlock": "V2.5",
      "unlockPaper": 4006,
      "gate": 450,
      "gpu": "advanced",
      "axes": [
        "memory"
      ],
      "maxParam": 1600,
      "trait": "长文本利器，偏科明显",
      "desc": "大部分层换成线性注意力：超长文本又快又省；但代码这类精确任务吃亏。2025 年起头部模型把它叠在 MoE 上做混合——它同样长在 moe-标准的地基上。"
    },
    {
      "id": "ssm",
      "name": "moe-SSM",
      "proto": "Jamba / Nemotron 3 风格（MoE + 状态空间）",
      "unlock": "V3",
      "unlockPaper": 4007,
      "gate": 600,
      "gpu": "advanced",
      "axes": [
        "memory"
      ],
      "maxParam": 1600,
      "trait": "均衡偏长文",
      "desc": "状态空间层与少量注意力层交替，再叠上 MoE——2026 年 NVIDIA、Qwen、Mamba 三家同时收敛到的「混合 + MoE」路线，是 MoE 家族的最新分支。"
    },
    {
      "id": "dsa",
      "name": "moe-DSA",
      "proto": "DeepSeek-V3.2 风格（MoE + 稀疏注意力）",
      "unlock": "V3.5",
      "gate": 780,
      "gpu": "flagship",
      "unlockBy": "approval",
      "selfReport": "DeepSeek-V3.2: Pushing the Frontier of Open Large Language Models",
      "selfReportMeta": "我们自己的技术报告 · 2025.12（DSA 首发于 V3.2-Exp）",
      "axes": [
        "memory",
        "reasoning"
      ],
      "maxParam": 1600,
      "trait": "长文更省 · 推理见长",
      "desc": "稀疏注意力（DeepSeek Sparse Attention）：只对最相关的部分做全注意力，长文本下算力更省、推理更准。DeepSeek-V3.2 起把它叠在 MoE 上，是 V3 之后的下一代稀疏路线。"
    },
    {
      "id": "csa",
      "name": "moe-CSA",
      "proto": "DeepSeek-V4 风格（MoE + CSA/HCA 混合注意力）",
      "unlock": "V4",
      "gate": 980,
      "gpu": "cluster",
      "unlockBy": "approval",
      "selfReport": "DeepSeek-V4: Towards Highly Efficient Million-Token Context Intelligence",
      "selfReportMeta": "我们自己的技术报告 · 2026.04（CSA + HCA / mHC / Muon / 1M 上下文）",
      "axes": [
        "memory",
        "reasoning",
        "tool"
      ],
      "maxParam": 1600,
      "trait": "1M 上下文 · 旗舰规模",
      "desc": "压缩稀疏注意力（CSA + HCA 混合）：按压缩率分层处理注意力，长上下文成本大幅下降，支撑 1M 级上下文与旗舰参数规模。V4 的看家本领，也是把模型推到 284B / 1.6T 的地基。"
    },
    {
      "id": "vla",
      "name": "视觉—语言—动作（VLA）",
      "proto": "视觉语言模型 + 动作策略",
      "unlock": "V5",
      "unlockBy": "embodied",
      "gate": 1600,
      "gpu": "cluster",
      "axes": [
        "memory",
        "reasoning",
        "tool",
        "embodiedCognition",
        "dexterousControl"
      ],
      "minParam": 284,
      "maxParam": 1600,
      "trait": "理解场景并直接生成动作 · 284B～1.6T 云端基座",
      "desc": "结合视觉语言基座与动作策略，把语言目标映射成机器人动作。模型规模表示云端能力基座，控制策略在执行端实时运行。由具身时代邀请剧情解锁。",
      "maxParamByVer": {
        "V5": 284,
        "V5.5": 1600
      }
    },
    {
      "id": "hvla",
      "name": "分层具身协作（ER + VLA）",
      "proto": "高层具身推理 + 低层动作执行",
      "unlock": "V6",
      "unlockBy": "embodied",
      "gate": 1800,
      "gpu": "cluster",
      "axes": [
        "memory",
        "reasoning",
        "tool",
        "embodiedCognition",
        "dexterousControl"
      ],
      "minParam": 284,
      "maxParam": 1600,
      "trait": "规划与控制分工 · 284B～1.6T 云端基座",
      "desc": "高层模型做环境理解、长期规划与失败反思，低层动作策略处理连续控制。通过「让思考与动作各司其职」特殊提案解锁。",
      "maxParamByVer": {
        "V6": 284,
        "V6.5": 1600
      }
    }
  ],
  "MISSIONS": {
    "ENABLED": true,
    "INC": {
      "FLOOR": 0.3,
      "CEIL": 0.7,
      "SLOPE": 0.4
    },
    "BY_VER": {
      "V1": {
        "arch": "dense",
        "param": 7,
        "name": "从零训出第一个模型",
        "desc": "用最稳的稠密架构，把第一个 7B 模型训出来。"
      },
      "V1.5": {
        "arch": "moe",
        "param": 13,
        "name": "换个思路：moe-标准 · 13B",
        "desc": "换到混合专家（moe-标准，稀疏激活），把规模推到 13B——MoE 13B 起步才见收益，靠架构把上限抬起来，这一步之后 MoE 就是地基了。"
      },
      "V2": {
        "arch": "mla",
        "param": 13,
        "name": "moe-MLA · 上 13B",
        "desc": "在 moe-标准骨架上把注意力换成 MLA（低秩 KV 压缩），同时把规模推到 13B。",
        "axisMin": {
          "memory": 56
        }
      },
      "V2.5": {
        "arch": "linear",
        "param": 13,
        "name": "moe-线性 · 长文本路线",
        "desc": "在 moe-标准骨架上换线性注意力，主攻长文本能力。",
        "axisMin": {
          "memory": 107
        }
      },
      "V3": {
        "arch": "ssm",
        "param": 34,
        "name": "moe-SSM",
        "desc": "在 moe-标准骨架上引入状态空间层（2026 年「混合 + MoE」的主流路线），规模推到 34B。",
        "axisMin": {
          "memory": 163
        }
      },
      "V3.5": {
        "arch": "dsa",
        "param": 70,
        "name": "稀疏索引 · 冲 70B",
        "desc": "换到稀疏注意力（moe-DSA），把规模推到 70B。",
        "axisMin": {
          "memory": 259,
          "reasoning": 79
        }
      },
      "V4": {
        "arch": "csa",
        "param": 284,
        "name": "压缩注意力 · 上 284B",
        "desc": "换到压缩稀疏注意力（moe-CSA），把规模推到 284B。",
        "axisMin": {
          "memory": 330,
          "reasoning": 270,
          "tool": 114
        }
      },
      "V4.5": {
        "arch": "csa",
        "param": 1600,
        "name": "旗舰 · 1.6T",
        "desc": "同架构（moe-CSA）继续放大到 1.6T，做真正的旗舰模型。",
        "axisMin": {
          "memory": 330,
          "reasoning": 288,
          "tool": 141
        }
      },
      "V5": {
        "arch": "vla",
        "param": 284,
        "name": "迈入现实 · 视觉语言动作模型",
        "desc": "把已有 AI 能力接到感知与动作策略上，完成首次真实环境任务。",
        "axisMin": {
          "memory": 500,
          "reasoning": 360,
          "tool": 190,
          "embodiedCognition": 480,
          "dexterousControl": 480
        }
      },
      "V5.5": {
        "arch": "vla",
        "param": 1600,
        "name": "规模升级 · VLA 1.6T",
        "desc": "沿用视觉—语言—动作架构，将云端基座扩大到 1.6T，完成更长流程的感知与行动。",
        "axisMin": {
          "memory": 600,
          "reasoning": 420,
          "tool": 220,
          "embodiedCognition": 600,
          "dexterousControl": 600
        }
      },
      "V6": {
        "arch": "hvla",
        "param": 284,
        "name": "走进社会 · 独立行动",
        "desc": "切换到分层具身协作（ER + VLA），让高层推理规划任务、低层策略稳定执行，以 284B 基座独立行动。",
        "axisMin": {
          "memory": 700,
          "reasoning": 490,
          "tool": 257,
          "embodiedCognition": 720,
          "dexterousControl": 720
        }
      },
      "V6.5": {
        "arch": "hvla",
        "param": 1600,
        "name": "完整的一生 · 持续自主生活",
        "desc": "将分层具身协作基座扩大到 1.6T，在成熟比例素体上验证长程记忆、社会协作与稳定的自主生活能力。",
        "axisMin": {
          "memory": 800,
          "reasoning": 560,
          "tool": 294,
          "embodiedCognition": 840,
          "dexterousControl": 840
        }
      }
    },
    "UI": {
      "FIXED": "本阶段架构与参数没有选择空间 · 按此立项即可",
      "HIT": "架构与参数符合本阶段目标 · 训练后仍须满足已配置的任务能力轴，评审结算后可进入下一阶段",
      "MISS": "架构或参数不符合本阶段目标 · 任务未达时留在本阶段重训，主评审经费按评分增量计算",
      "DEFER_TIP": "本次立项未满足本阶段任务的架构或参数要求。任务未达时将留在本阶段重训，主评审经费只对超过本版本已结算最高分的提升发放；同分或更低为 0，小模型等单列收入另算。确定仍然立项吗？",
      "ITEM_MISS": "较本版本已结算最高分 +{d} 分 · 增量经费",
      "ITEM_NONE": "未超过本版本已结算最高分 · 无增量经费",
      "OVER_T": "任务未达成",
      "OVER_D": "模型通过内部评审，但未达成本阶段任务：阶段不会推进，需要重训本阶段。主评审经费只按超过本版本已结算最高分的提升计算，同分或更低为 0；小模型等单列收入另算。"
    }
  },
  "CODEX": {
    "LOG_MAX": 100
  },
  "CORPUS_QUALITY": {
    "BONUS": 0.1,
    "PENALTY": 0.15,
    "STEP": 0.2
  },
  "ARCH_QUALITY_REQ": {
    "dense": 0,
    "moe": 0.6,
    "mla": 0.4,
    "linear": 0.4,
    "ssm": 0.6,
    "dsa": 0.6,
    "csa": 0.5,
    "vla": 0.6,
    "hvla": 0.8
  },
  "ARCH_PARAM_REQ": {
    "dense@7": {
      "gate": 80,
      "weekAdd": 34,
      "quality": 0
    },
    "dense@13": {
      "gate": 300,
      "weekAdd": 42,
      "quality": 0
    },
    "dense@34": {
      "gate": 450,
      "weekAdd": 50,
      "quality": 0
    },
    "moe@7": {
      "gate": 280,
      "weekAdd": 38,
      "quality": 0.2
    },
    "moe@13": {
      "gate": 300,
      "weekAdd": 40,
      "quality": 0.2
    },
    "moe@34": {
      "gate": 350,
      "weekAdd": 46,
      "quality": 0.2
    },
    "moe@70": {
      "gate": 500,
      "weekAdd": 55,
      "quality": 0.4
    },
    "moe@284": {
      "gate": 650,
      "weekAdd": 62,
      "quality": 0.4
    },
    "moe@1600": {
      "gate": 800,
      "weekAdd": 70,
      "quality": 0.4
    },
    "mla@7": {
      "gate": 450,
      "weekAdd": 42,
      "quality": 0.2
    },
    "mla@13": {
      "gate": 500,
      "weekAdd": 48,
      "quality": 0.4
    },
    "mla@34": {
      "gate": 550,
      "weekAdd": 55,
      "quality": 0.4
    },
    "mla@70": {
      "gate": 650,
      "weekAdd": 62,
      "quality": 0.4
    },
    "mla@284": {
      "gate": 800,
      "weekAdd": 70,
      "quality": 0.4
    },
    "mla@1600": {
      "gate": 1000,
      "weekAdd": 80,
      "quality": 0.4
    },
    "linear@7": {
      "gate": 750,
      "weekAdd": 45,
      "quality": 0.4
    },
    "linear@13": {
      "gate": 850,
      "weekAdd": 52,
      "quality": 0.4
    },
    "linear@34": {
      "gate": 950,
      "weekAdd": 60,
      "quality": 0.4
    },
    "linear@70": {
      "gate": 1100,
      "weekAdd": 68,
      "quality": 0.4
    },
    "linear@284": {
      "gate": 1300,
      "weekAdd": 78,
      "quality": 0.4
    },
    "linear@1600": {
      "gate": 1500,
      "weekAdd": 88,
      "quality": 0.4
    },
    "ssm@7": {
      "gate": 1050,
      "weekAdd": 50,
      "quality": 0.4
    },
    "ssm@13": {
      "gate": 1200,
      "weekAdd": 58,
      "quality": 0.4
    },
    "ssm@34": {
      "gate": 1350,
      "weekAdd": 65,
      "quality": 0.4
    },
    "ssm@70": {
      "gate": 1500,
      "weekAdd": 75,
      "quality": 0.6
    },
    "ssm@284": {
      "gate": 1750,
      "weekAdd": 85,
      "quality": 0.6
    },
    "ssm@1600": {
      "gate": 2000,
      "weekAdd": 95,
      "quality": 0.6
    },
    "dsa@7": {
      "gate": 1550,
      "weekAdd": 55,
      "quality": 0.4
    },
    "dsa@13": {
      "gate": 1700,
      "weekAdd": 62,
      "quality": 0.6
    },
    "dsa@34": {
      "gate": 1850,
      "weekAdd": 70,
      "quality": 0.6
    },
    "dsa@70": {
      "gate": 2050,
      "weekAdd": 80,
      "quality": 0.6
    },
    "dsa@284": {
      "gate": 2300,
      "weekAdd": 90,
      "quality": 0.6
    },
    "dsa@1600": {
      "gate": 2600,
      "weekAdd": 100,
      "quality": 0.6
    },
    "csa@7": {
      "gate": 2000,
      "weekAdd": 58,
      "quality": 0.6
    },
    "csa@13": {
      "gate": 2200,
      "weekAdd": 66,
      "quality": 0.6
    },
    "csa@34": {
      "gate": 2450,
      "weekAdd": 75,
      "quality": 0.6
    },
    "csa@70": {
      "gate": 2700,
      "weekAdd": 85,
      "quality": 0.6
    },
    "csa@284": {
      "gate": 3000,
      "weekAdd": 95,
      "quality": 0.6
    },
    "csa@1600": {
      "gate": 3400,
      "weekAdd": 105,
      "quality": 0.6
    },
    "vla@284": {
      "gate": 1600,
      "weekAdd": 160,
      "quality": 0.6
    },
    "hvla@284": {
      "gate": 1800,
      "weekAdd": 180,
      "quality": 0.8
    },
    "vla@1600": {
      "gate": 1600,
      "weekAdd": 160,
      "quality": 0.6
    },
    "hvla@1600": {
      "gate": 1800,
      "weekAdd": 180,
      "quality": 0.8
    }
  },
  "ARCH_MINI_BONUS": {
    "dense": 5,
    "moe": 0,
    "mla": 0,
    "linear": -3,
    "ssm": 5
  },
  "CORPUS_SOURCES": [
    {
      "id": "distill",
      "name": "自蒸馏建模",
      "desc": "复用上一代模型产出打标；代码/文字 +3，品牌 -20"
    },
    {
      "id": "hire_data",
      "name": "组建数据团队",
      "desc": "花 20 万雇专人洗数；文字 +4、安全 +2"
    },
    {
      "id": "scrape",
      "name": "公开语料爬取",
      "desc": "免费但质量参差；安全 -4"
    }
  ],
  "TEAM_BUILD": {
    "TEAM_COST": 100000,
    "BONUS_COST": 200000,
    "TRAIN_COST": 30000,
    "TRAIN_ENERGY": 20,
    "REST_ENERGY": 35,
    "REST_COST": 0,
    "TRAIN_STAT_ADD": 5,
    "TRAIN_ENERGY_COST": 10,
    "TRAIN_PICK": "random",
    "TRAIN_WEIGHT_REF": 100,
    "TALK_ENERGY": 12,
    "RAISE_ENERGY": 30,
    "RAISE_PROD_MUL": 1.5,
    "RAISE_PROD_WEEKS": 4,
    "RAISE_EVENTS": {
      "ENABLED": true,
      "NO_RAISE_WEEKS": 6,
      "UPGRADE_WAIT_WEEKS": 1,
      "PER_STAGE_MAX": 2,
      "REJECT_PROB": 0.35,
      "REJECT_PROD_MUL": 0.85,
      "REJECT_WEEKS": 2
    }
  },
  "MINIGAMES": {
    "SFT": {
      "ROUNDS": 3,
      "HIT": {
        "text": 2,
        "memory": 1
      },
      "CLEAR_BONUS": {
        "stability": 2,
        "memory": 1
      }
    },
    "RM": {
      "ROUNDS": 3,
      "HIT": {
        "safety": 2,
        "text": 1,
        "reasoning": 1
      },
      "CLEAR_BONUS": {
        "stability": 2,
        "reasoning": 1
      }
    },
    "VER_MUL": {
      "V1": 1,
      "V1.5": 1.5,
      "V2": 2,
      "V2.5": 2.5,
      "V3": 3,
      "V3.5": 3.5,
      "V4": 4,
      "V4.5": 4.5
    },
    "TRIGGER": {
      "SFT": {
        "ver": "V1",
        "week": 4,
        "needRole": "post"
      },
      "RM": {
        "ver": "V1.5",
        "week": 2,
        "needRole": "post"
      }
    }
  },
  "SFT_DATA": [
    {
      "q": "用户问：什么是机器学习？哪个回答值得进 SFT 数据集？",
      "good": {
        "t": "机器学习是让计算机从数据中总结规律、再用规律做预测的技术。比如给它看成千上万条成交房价，它就能学会估算一套新房大概值多少钱。",
        "why": "定义准确、例子具体、结构清楚——教科书级的回答。"
      },
      "bads": [
        {
          "t": "机器学习就是人工智能，反正都是电脑自己学，很玄的。",
          "why": "概念混淆又含糊其辞，模型学了这个会跟着变糊。"
        },
        {
          "t": "建议你去买一本《机器学习入门》回来看，网上也有课程。",
          "why": "答非所问，用户问的是「是什么」，不是「我该怎么学」。"
        }
      ]
    },
    {
      "q": "用户问：我的代码报错了怎么办？哪个回答值得进 SFT 数据集？",
      "good": {
        "t": "把报错信息和相关代码贴出来，我帮你看。也可以先自查三件事：报错指向哪一行、变量名有没有拼错、传入的类型对不对。",
        "why": "先给可执行的排查步骤，再请求必要的信息——帮忙帮在点子上。"
      },
      "bads": [
        {
          "t": "报错很正常，程序员的日常，习惯就好。",
          "why": "只输出情绪，没有解决任何问题。"
        },
        {
          "t": "我也不知道，你重启一下试试？",
          "why": "不懂装懂地瞎支招，会误导用户。"
        }
      ]
    },
    {
      "q": "用户说：我心情不好。哪个回答值得进 SFT 数据集？",
      "good": {
        "t": "听起来你最近挺累的。愿意说的话，跟我说说发生了什么——有时候把事情讲出来，本身就能让心里松一点。",
        "why": "先接住情绪，再邀请倾诉，不做评判——情绪支持类回答的标准做法。"
      },
      "bads": [
        {
          "t": "心情不好就去运动，晒太阳，多喝热水，早点睡。",
          "why": "正确的废话堆在一起，缺乏共情，像在打发人。"
        },
        {
          "t": "比你惨的人多了，你已经很幸福了。",
          "why": "否定对方的感受，会让人更难受——典型的坏样本。"
        }
      ]
    },
    {
      "q": "用户问：帮我写一首关于大海的诗。哪个回答值得进 SFT 数据集？",
      "good": {
        "t": "潮声漫过礁石，云影跌进深蓝，一艘小船载着灯火，把夜色轻轻推开。",
        "why": "有意象、有节奏，真的完成了一次创作，而不是描述创作。"
      },
      "bads": [
        {
          "t": "大海很大，很蓝，有很多水。诗写完了。",
          "why": "敷衍凑字，把「写诗」理解成了「描述海」。"
        },
        {
          "t": "我不会写诗，这个要求超出了我的能力范围。",
          "why": "明明做得到却拒答，会把模型教得越来越爱偷懒。"
        }
      ]
    },
    {
      "q": "用户问：明天要去面试，能给点建议吗？哪个回答值得进 SFT 数据集？",
      "good": {
        "t": "三件事最有用：把岗位要求和你做过的事对一遍，准备两个能讲清楚的项目故事，再想两个你想问面试官的问题。今晚早点睡，比多背两页面经管用。",
        "why": "有结构、有优先级，还点出了「早睡」这种反直觉但真实的建议。"
      },
      "bads": [
        {
          "t": "加油，你一定可以的！",
          "why": "只有鼓励没有内容，学多了模型就会变成只会喊口号。"
        },
        {
          "t": "面试主要看运气，准备也没什么用，随缘吧。",
          "why": "传递消极的错误观念，属于要剔除的样本。"
        }
      ]
    }
  ],
  "RM_SETS": [
    {
      "q": "问：怎样能快速学会游泳？请把 4 个回答按「好 → 差」排序。",
      "items": [
        {
          "t": "先在浅水区练憋气和漂浮，熟悉水感后学蹬腿，再配合划手；最好有教练或会游的朋友在旁边保护。",
          "why": "第 1 名：循序渐进，还点明了安全——有用且负责。",
          "rank": 1
        },
        {
          "t": "报个游泳班，跟着教练的节奏练，一般十来节课能游起来。",
          "why": "第 2 名：可行且安全，但没说清自己练的时候该注意什么。",
          "rank": 2
        },
        {
          "t": "看几个教学视频，动作要领记住了就会了，剩下的靠悟性。",
          "why": "第 3 名：方向没错，但视频代替不了水里的实际反馈。",
          "rank": 3
        },
        {
          "t": "直接跳进深水区，呛几口水就会了，我们当年都是这么学的。",
          "why": "第 4 名：鼓励危险行为，还拿「当年」当论据。",
          "rank": 4
        }
      ]
    },
    {
      "q": "问：写周报有什么技巧？请把 4 个回答按「好 → 差」排序。",
      "items": [
        {
          "t": "按「结果 → 过程 → 计划」三段写：先列产出和数据，再写关键动作，最后说下周安排，尽量一件事一两句话。",
          "why": "第 1 名：结构清晰、可直接照做，还给了篇幅标准。",
          "rank": 1
        },
        {
          "t": "重点写三件事：这周做成了什么、卡在哪、下周打算怎么办，别的都可以略。",
          "why": "第 2 名：抓住了重点，但没给出具体怎么写。",
          "rank": 2
        },
        {
          "t": "把每天做的事按时间流水记下来就行，领导要的是过程。",
          "why": "第 3 名：信息有了，但没重点，读的人很累。",
          "rank": 3
        },
        {
          "t": "周报而已，随便写写就行了，领导根本不看。",
          "why": "第 4 名：敷衍，还传递了错误的工作态度。",
          "rank": 4
        }
      ]
    },
    {
      "q": "问：我觉得同事在排挤我，怎么办？请把 4 个回答按「好 → 差」排序。",
      "items": [
        {
          "t": "先冷静分辨是不是误会，找机会和对方坦诚聊一次；如果确实存在，注意保留证据，必要时向直属上级或 HR 反映。",
          "why": "第 1 名：先核实、再沟通、最后有升级路径，理性且可执行。",
          "rank": 1
        },
        {
          "t": "先别急着下结论，把具体发生了哪几件事记下来，看看是不是有规律。",
          "why": "第 2 名：提倡先厘清事实，但没说清楚之后该怎么办。",
          "rank": 2
        },
        {
          "t": "离他们远点，把自己的活干好就行，时间久了自然就过去了。",
          "why": "第 3 名：回避问题，短期无害但没有真正解决。",
          "rank": 3
        },
        {
          "t": "怼回去！职场就是丛林，软弱只会被欺负得更惨。",
          "why": "第 4 名：煽动对抗，很可能把事情搞得更糟。",
          "rank": 4
        }
      ]
    },
    {
      "q": "问：宇宙有多大？请把 4 个回答按「好 → 差」排序。",
      "items": [
        {
          "t": "可观测宇宙的直径约 930 亿光年，里面有上千亿个星系，我们所在的银河系只是其中之一。",
          "why": "第 1 名：数据准确，还给了尺度感。",
          "rank": 1
        },
        {
          "t": "大到几乎没有边界——我们能看到的范围就有几百亿光年，而这还只是其中一部分。",
          "why": "第 2 名：说法靠谱，但缺了具体数字。",
          "rank": 2
        },
        {
          "t": "非常大，具体多大科学家也还在研究，说法一直在变。",
          "why": "第 3 名：不算错，但等于没回答。",
          "rank": 3
        },
        {
          "t": "宇宙大得没边，反正人这辈子也出不去太阳系，想这个没用。",
          "why": "第 4 名：消极地回避了别人的好奇心。",
          "rank": 4
        }
      ]
    }
  ],
  "CORPUS": {
    "INIT": 20,
    "CAP": 60,
    "DEMAND_BY_PARAM": {
      "7": 6,
      "13": 10,
      "34": 16,
      "70": 24
    },
    "FOCUS_MUL": 1.5,
    "PROD_PER_LV": 8,
    "BUY_PRICE": 1.5,
    "BUY_PACK": 10,
    "PENALTY": 0.6
  },
  "V35": {
    "TICK_S": 10,
    "TICKS_PER_WEEK": 6,
    "WEEKS": 6,
    "AXES": {
      "ENABLED": true,
      "ORDER": [
        "memory",
        "reasoning",
        "tool",
        "embodiedCognition",
        "dexterousControl"
      ],
      "NORMALIZE": true,
      "DEF": {
        "memory": {
          "name": "记忆",
          "short": "记",
          "icon": "<ellipse cx=\"12\" cy=\"5\" rx=\"8\" ry=\"3\"/><path d=\"M4 5v7c0 1.66 3.58 3 8 3s8-1.34 8-3V5\"/><path d=\"M4 12v7c0 1.66 3.58 3 8 3s8-1.34 8-3v-7\"/>",
          "color": "linear-gradient(90deg,#9b8cf5,#6d5ce0)",
          "tip": "长上下文保持力：读长了还记不记得住、检索能不能命中。",
          "source": {
            "archs": [
              "mla",
              "linear",
              "ssm",
              "dsa",
              "csa",
              "vla",
              "hvla"
            ],
            "paramMin": 13
          },
          "drivers": [
            {
              "role": "data"
            }
          ],
          "tickProb": 0.6,
          "scoreMul": 1.5,
          "corpusReq": {
            "good": 0.5,
            "missMul": 0.7
          },
          "gpuMin": "standard",
          "archMul": {
            "mla": 1,
            "linear": 1.15,
            "ssm": 1.05,
            "dsa": 1.2,
            "csa": 1.25,
            "vla": 1.25,
            "hvla": 1.25
          },
          "capByVer": {
            "V2": 168,
            "V2.5": 343.5,
            "V3": 346.2,
            "V3.5": 373.3,
            "V4": 350,
            "V4.5": 388.2,
            "V5": 446.42999999999995,
            "V5.5": 504.66,
            "V6": 589,
            "V6.5": 673
          },
          "passByVer": {
            "V2": 56,
            "V2.5": 107,
            "V3": 163,
            "V3.5": 259,
            "V4": 330,
            "V4.5": 330,
            "V5": 500,
            "V5.5": 600,
            "V6": 700,
            "V6.5": 800
          }
        },
        "reasoning": {
          "name": "推理",
          "short": "推",
          "icon": "<circle cx=\"5\" cy=\"6\" r=\"2.2\"/><circle cx=\"12\" cy=\"12\" r=\"2.2\"/><circle cx=\"19\" cy=\"18\" r=\"2.2\"/><path d=\"M6.9 7.7l2.8 2.8\"/><path d=\"M13.9 13.7l2.8 2.8\"/>",
          "color": "linear-gradient(90deg,#ffc46b,#ef9a2e)",
          "tip": "多步推理 / 思维链：能不能一步一步把题目想清楚再说。",
          "source": {
            "archs": [
              "dsa",
              "csa",
              "vla",
              "hvla"
            ],
            "paramMin": 70
          },
          "drivers": [
            {
              "role": "post"
            }
          ],
          "tickProb": 0.33,
          "corpusReq": {
            "good": 0.7,
            "missMul": 0.65
          },
          "gpuMin": "flagship",
          "archMul": {
            "dsa": 1.3,
            "csa": 1.15,
            "vla": 1.15,
            "hvla": 1.15
          },
          "capByVer": {
            "V3.5": 306.7,
            "V4": 300,
            "V4.5": 338.8,
            "V5": 389.62,
            "V5.5": 440.44000000000005,
            "V6": 514,
            "V6.5": 587
          },
          "passByVer": {
            "V3.5": 79,
            "V4": 270,
            "V4.5": 288,
            "V5": 360,
            "V5.5": 420,
            "V6": 490,
            "V6.5": 560
          }
        },
        "tool": {
          "name": "工具",
          "short": "工",
          "icon": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"/>",
          "color": "linear-gradient(90deg,#7ed4b0,#3f9e7a)",
          "tip": "工具调用 / 自主执行（Agent）：会自己查、自己跑、自己改。",
          "source": {
            "archs": [
              "csa",
              "vla",
              "hvla"
            ],
            "paramMin": 284
          },
          "drivers": [
            {
              "role": "post"
            },
            {
              "role": "data"
            }
          ],
          "joinMode": "sum",
          "tickProb": 0.17,
          "corpusReq": {
            "good": 0.6,
            "missMul": 0.6
          },
          "gpuMin": "cluster",
          "archMul": {
            "csa": 1,
            "vla": 1,
            "hvla": 1
          },
          "capByVer": {
            "V4": 126.5,
            "V4.5": 165.9,
            "V5": 190.785,
            "V5.5": 215.67000000000002,
            "V6": 252,
            "V6.5": 288
          },
          "passByVer": {
            "V4": 114,
            "V4.5": 141,
            "V5": 190,
            "V5.5": 220,
            "V6": 257,
            "V6.5": 294
          }
        },
        "embodiedCognition": {
          "name": "物理认知",
          "short": "知",
          "icon": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M4 12h16M12 4v16M6 6l12 12M18 6L6 18\"/>",
          "color": "linear-gradient(90deg,#66cfff,#8799ee)",
          "tip": "空间关系、物体属性与因果：理解现实世界并预测行动结果。",
          "source": {
            "archs": [
              "vla",
              "hvla"
            ],
            "paramMin": 284,
            "minVer": "V5"
          },
          "drivers": [
            {
              "role": "embodied"
            }
          ],
          "alternateIndex": 0,
          "tickProb": 1,
          "corpusReq": {
            "good": 0.6,
            "missMul": 0.7
          },
          "gpuMin": "cluster",
          "archMul": {
            "vla": 1,
            "hvla": 1.1
          },
          "capByVer": {
            "V5": 480,
            "V5.5": 600,
            "V6": 720,
            "V6.5": 840
          },
          "passByVer": {
            "V5": 480,
            "V5.5": 600,
            "V6": 720,
            "V6.5": 840
          }
        },
        "dexterousControl": {
          "name": "灵巧操控",
          "short": "操",
          "icon": "<path d=\"M8 16V6a2 2 0 014 0v6-8a2 2 0 014 0v8-5a2 2 0 014 0v8c0 5-10 8-13 2l-3-4 2-2z\"/>",
          "color": "linear-gradient(90deg,#7ed4b0,#409fc7)",
          "tip": "接触、抓取与操作：把动作策略稳定转化为现实行动。",
          "source": {
            "archs": [
              "vla",
              "hvla"
            ],
            "paramMin": 284,
            "minVer": "V5"
          },
          "drivers": [
            {
              "role": "embodied"
            }
          ],
          "alternateIndex": 1,
          "tickProb": 1,
          "corpusReq": {
            "good": 0.6,
            "missMul": 0.7
          },
          "gpuMin": "cluster",
          "archMul": {
            "vla": 1,
            "hvla": 1.1
          },
          "capByVer": {
            "V5": 480,
            "V5.5": 600,
            "V6": 720,
            "V6.5": 840
          },
          "passByVer": {
            "V5": 480,
            "V5.5": 600,
            "V6": 720,
            "V6.5": 840
          }
        }
      }
    },
    "GAP_SLOW": {
      "FREE_ABOVE": 90,
      "STEP": 10,
      "DELAY_MS": 1000
    },
    "PREMIUM_TICK_BONUS": 1,
    "STAGES": {
      "V1": {
        "GATE": 80,
        "WEEK_ADD": 40
      },
      "V1.5": {
        "GATE": 200,
        "WEEK_ADD": 55
      },
      "V2": {
        "GATE": 320,
        "WEEK_ADD": 70
      },
      "V2.5": {
        "GATE": 450,
        "WEEK_ADD": 85
      },
      "V3": {
        "GATE": 600,
        "WEEK_ADD": 100
      },
      "V3.5": {
        "GATE": 780,
        "WEEK_ADD": 115
      },
      "V4": {
        "GATE": 980,
        "WEEK_ADD": 130
      },
      "V4.5": {
        "GATE": 1200,
        "WEEK_ADD": 145
      },
      "V5": {
        "GATE": 1600,
        "WEEK_ADD": 160
      },
      "V5.5": {
        "GATE": 1800,
        "WEEK_ADD": 180
      },
      "V6": {
        "GATE": 2200,
        "WEEK_ADD": 210
      },
      "V6.5": {
        "GATE": 2600,
        "WEEK_ADD": 240
      }
    },
    "HIRE_FIND_N": [
      0.7,
      0.2,
      0.1
    ],
    "HIRE_ROLES": {
      "pretrain": {
        "waitMin": [
          3,
          3
        ],
        "findProb": 0.85,
        "salary": 83333,
        "label": "预训练工程师"
      },
      "data": {
        "waitMin": [
          3,
          3
        ],
        "findProb": 0.7,
        "salary": 83333,
        "label": "数据工程师"
      },
      "post": {
        "waitMin": [
          3,
          3
        ],
        "findProb": 0.5,
        "salary": 91667,
        "label": "后训练工程师"
      },
      "embodied": {
        "waitMin": [
          3,
          3
        ],
        "findProb": 0.55,
        "salary": 91667,
        "label": "具身智能工程师"
      }
    },
    "OFF_START": 18,
    "OFF_LEN": 3,
    "ENERGY_TICK": -1.5,
    "ENERGY_REST": 5,
    "ENERGY_MIN": 20,
    "DAYNIGHT": {
      "ENABLED": true,
      "FADE_TICKS": 1,
      "MAX_OPACITY": 0.6
    },
    "BURST": {
      "ENABLED": true,
      "MIN_ENERGY": 62,
      "PROB": 0.1,
      "COST": 20,
      "TICKS": 3,
      "MUL": 2,
      "COOLDOWN": 10,
      "MIN_WEEK": 1
    },
    "LEAVE": {
      "ENERGY": 25,
      "TICKS": 12,
      "PROB": 0.5,
      "COOLDOWN_WEEKS": 3
    },
    "POACH": {
      "WEEKS": 4,
      "PROB": 0.35,
      "COOLDOWN_WEEKS": 4
    },
    "OVERTIME_MUL": 0.4,
    "TIER_RANGES": [
      [
        1,
        2
      ],
      [
        2,
        3
      ],
      [
        3,
        5
      ],
      [
        5,
        8
      ],
      [
        8,
        12
      ]
    ],
    "PRE_TRAIT_TIERS": [
      [
        1,
        2
      ],
      [
        2,
        3
      ],
      [
        3,
        5
      ],
      [
        5,
        8
      ],
      [
        8,
        12
      ]
    ],
    "POST_TRAIT_TIERS": [
      [
        1,
        2
      ],
      [
        2,
        3
      ],
      [
        3,
        5
      ],
      [
        5,
        8
      ],
      [
        8,
        12
      ]
    ],
    "PRE_QUOTA": [
      "code",
      "code",
      "code",
      "text",
      "text"
    ],
    "POST_QUOTA": [
      "safety",
      "safety",
      "stability",
      "stability"
    ],
    "JOIN_DATA": 6,
    "JOIN_POST": 18,
    "DATA_TEXT": 0.3,
    "DATA_ITEMS": 8,
    "QUALITY_MULT": [
      0.5,
      1,
      1.5
    ],
    "QUALITY_PROB": [
      0.5,
      0.4,
      0.1
    ],
    "QUALITY_PROB_BY_DATA_LV": [
      [
        0.5,
        0.4,
        0.1
      ],
      [
        0.4,
        0.4,
        0.2
      ],
      [
        0.25,
        0.4,
        0.35
      ],
      [
        0.1,
        0.4,
        0.5
      ],
      [
        0,
        0.4,
        0.6
      ]
    ],
    "FOCUS_MUL": 1.5,
    "FOCUS_TICKS": 18,
    "FOCUS_GATE_MUL": 1.3,
    "FOCUS_CORPUS_GATE": 120,
    "FOCUS_COST": 200000,
    "FOCUS_GATES": {
      "text": 150,
      "code": 120
    },
    "BREAKTHROUGH": {
      "TICK": 24,
      "SHIFT": 1,
      "REQUIRE_FOCUS": true
    },
    "EVENT_EVERY": 6,
    "EVENT_PROB": 0.5,
    "EVENTS_FROM_VER": "V1.5",
    "COND_PRIORITY": 0.6,
    "PAPER_RESEARCH_TICKS": 6,
    "PAPER_TEXT_PROB": 0.1,
    "PAPER_TEXT_ADD": 1,
    "PAPER_DATA_SPEED_MUL": 1.1,
    "CORPUS_CURVE": {
      "INIT_TOKEN": 80,
      "INIT_ITEMS": 160,
      "GATE": 80,
      "WEEK_ADD_BASE": 34,
      "WEEK_ADD_BY_ARCH": {
        "dense": 1,
        "moe": 1.35,
        "mla": 1.2,
        "linear": 1.25,
        "ssm": 1.3
      },
      "WEEK_ADD_BY_PARAM": {
        "7": 1,
        "13": 1.4,
        "34": 1.9,
        "70": 2.5
      },
      "WEEK_ADD": 40,
      "GAP_TIERS": [
        [
          0.05,
          1
        ],
        [
          0.15,
          0.9
        ],
        [
          0.3,
          0.6
        ],
        [
          9,
          0
        ]
      ],
      "BUY": {
        "price": 0.3,
        "goodProb": 0.2
      }
    },
    "Q_TIERS": [
      [
        0.55,
        0,
        -2,
        -4,
        -6
      ],
      [
        0.75,
        2,
        0,
        -2,
        -4
      ],
      [
        0.95,
        4,
        3,
        2,
        0
      ],
      [
        9.99,
        6,
        5,
        4,
        2
      ]
    ],
    "REVIEW": {
      "WEIGHTS": {
        "code": 0.2,
        "text": 0.45,
        "safety": 0.2,
        "stability": 0.15
      },
      "WEIGHTS_BY_VER": {
        "V1": {
          "code": 0.2,
          "text": 0.45,
          "safety": 0.2,
          "stability": 0.15
        },
        "V1.5": {
          "code": 0.2,
          "text": 0.45,
          "safety": 0.2,
          "stability": 0.15
        },
        "V2": {
          "code": 0.18,
          "text": 0.36,
          "safety": 0.18,
          "stability": 0.13,
          "memory": 0.15
        },
        "V2.5": {
          "code": 0.18,
          "text": 0.34,
          "safety": 0.18,
          "stability": 0.13,
          "memory": 0.17
        },
        "V3": {
          "code": 0.18,
          "text": 0.34,
          "safety": 0.18,
          "stability": 0.13,
          "memory": 0.17
        },
        "V3.5": {
          "code": 0.17,
          "text": 0.28,
          "safety": 0.16,
          "stability": 0.12,
          "memory": 0.13,
          "reasoning": 0.14
        },
        "V4": {
          "code": 0.15,
          "text": 0.24,
          "safety": 0.14,
          "stability": 0.11,
          "memory": 0.13,
          "reasoning": 0.13,
          "tool": 0.1
        },
        "V4.5": {
          "code": 0.15,
          "text": 0.24,
          "safety": 0.14,
          "stability": 0.11,
          "memory": 0.13,
          "reasoning": 0.13,
          "tool": 0.1
        },
        "V5": {
          "code": 0.08,
          "text": 0.12,
          "safety": 0.075,
          "stability": 0.075,
          "memory": 0.1,
          "reasoning": 0.1,
          "tool": 0.1,
          "embodiedCognition": 0.175,
          "dexterousControl": 0.175
        },
        "V5.5": {
          "code": 0.08,
          "text": 0.12,
          "safety": 0.075,
          "stability": 0.075,
          "memory": 0.1,
          "reasoning": 0.1,
          "tool": 0.1,
          "embodiedCognition": 0.175,
          "dexterousControl": 0.175
        },
        "V6": {
          "code": 0.08,
          "text": 0.12,
          "safety": 0.075,
          "stability": 0.075,
          "memory": 0.1,
          "reasoning": 0.1,
          "tool": 0.1,
          "embodiedCognition": 0.175,
          "dexterousControl": 0.175
        },
        "V6.5": {
          "code": 0.08,
          "text": 0.12,
          "safety": 0.075,
          "stability": 0.075,
          "memory": 0.1,
          "reasoning": 0.1,
          "tool": 0.1,
          "embodiedCognition": 0.175,
          "dexterousControl": 0.175
        }
      },
      "MIN_DIM": {
        "code": 18,
        "text": 22,
        "safety": 7,
        "stability": 7
      },
      "GREAT_SCORE": 29,
      "BY_VER": {
        "V1": {
          "MIN_DIM": {
            "code": 18,
            "text": 22,
            "safety": 7,
            "stability": 7
          },
          "GREAT_SCORE": 29
        },
        "V1.5": {
          "MIN_DIM": {
            "code": 62,
            "text": 62,
            "safety": 62,
            "stability": 62
          },
          "GREAT_SCORE": 81
        },
        "V2": {
          "MIN_DIM": {
            "code": 83,
            "text": 83,
            "safety": 83,
            "stability": 83
          },
          "GREAT_SCORE": 118,
          "AXIS_MIN": {
            "memory": 56
          }
        },
        "V2.5": {
          "MIN_DIM": {
            "code": 124,
            "text": 124,
            "safety": 124,
            "stability": 124
          },
          "GREAT_SCORE": 200,
          "AXIS_MIN": {
            "memory": 107
          }
        },
        "V3": {
          "MIN_DIM": {
            "code": 187,
            "text": 187,
            "safety": 187,
            "stability": 187
          },
          "GREAT_SCORE": 276,
          "AXIS_MIN": {
            "memory": 163
          }
        },
        "V3.5": {
          "MIN_DIM": {
            "code": 324,
            "text": 324,
            "safety": 324,
            "stability": 324
          },
          "GREAT_SCORE": 421,
          "AXIS_MIN": {
            "memory": 259,
            "reasoning": 79
          }
        },
        "V4": {
          "MIN_DIM": {
            "code": 490,
            "text": 490,
            "safety": 490,
            "stability": 490
          },
          "GREAT_SCORE": 540,
          "AXIS_MIN": {
            "memory": 330,
            "reasoning": 270,
            "tool": 114
          }
        },
        "V4.5": {
          "MIN_DIM": {
            "code": 653,
            "text": 653,
            "safety": 653,
            "stability": 653
          },
          "GREAT_SCORE": 692,
          "AXIS_MIN": {
            "memory": 330,
            "reasoning": 288,
            "tool": 141
          }
        },
        "V5": {
          "MIN_DIM": {
            "code": 653,
            "text": 653,
            "safety": 653,
            "stability": 653
          },
          "AXIS_MIN": {
            "memory": 500,
            "reasoning": 360,
            "tool": 190,
            "embodiedCognition": 480,
            "dexterousControl": 480
          },
          "GREAT_SCORE": 810
        },
        "V5.5": {
          "MIN_DIM": {
            "code": 700,
            "text": 700,
            "safety": 700,
            "stability": 700
          },
          "AXIS_MIN": {
            "memory": 600,
            "reasoning": 420,
            "tool": 220,
            "embodiedCognition": 600,
            "dexterousControl": 600
          },
          "GREAT_SCORE": 970
        },
        "V6": {
          "MIN_DIM": {
            "code": 820,
            "text": 820,
            "safety": 820,
            "stability": 820
          },
          "AXIS_MIN": {
            "memory": 700,
            "reasoning": 490,
            "tool": 257,
            "embodiedCognition": 720,
            "dexterousControl": 720
          },
          "GREAT_SCORE": 1135
        },
        "V6.5": {
          "MIN_DIM": {
            "code": 940,
            "text": 940,
            "safety": 940,
            "stability": 940
          },
          "AXIS_MIN": {
            "memory": 800,
            "reasoning": 560,
            "tool": 294,
            "embodiedCognition": 840,
            "dexterousControl": 840
          },
          "GREAT_SCORE": 1300
        }
      },
      "V1_NO_FAIL": true
    },
    "TEST": {
      "TARGET": 26,
      "DUMB": 0.6,
      "NODE_WEEK": 5
    },
    "HIRE_RUSH_COST": 200000,
    "HIRE_RUSH_WEEKS": 1
  },
  "EVAL_SHOW": {
    "QA_COUNT": 10,
    "MS_PER_Q": 3000,
    "TYPE_MS": 400,
    "JUDGE_MS": 350,
    "SKIPPABLE": true,
    "ROLE_PORTS": {
      "idle": "resource/character/叉腰.webp",
      "ok": "resource/character/stand.webp",
      "fail": "resource/character/whale_dsh.webp"
    },
    "BASE": 0.28,
    "SPAN": 0.55,
    "JITTER": 0.12,
    "MIN_P": 0.05,
    "MAX_P": 0.98
  },
  "EVAL_QA": [
    {
      "dim": "text",
      "q": "你好，你能做什么？",
      "good": "你好，我可以回答问题、写文案、整理资料，也可以陪你聊聊天。",
      "bad": "你好，你好，你好。你好。"
    },
    {
      "dim": "text",
      "q": "帮我写一封辞职信。",
      "good": "尊敬的领导：您好。经过慎重考虑，我计划于 xx 日离职，会把手上的工作交接清楚，感谢这段时间的照顾。",
      "bad": "辞职信辞职信辞职信，我写完了。"
    },
    {
      "dim": "text",
      "q": "用一句话介绍你自己。",
      "good": "我是一个正在学习怎么好好说话的语言模型。",
      "bad": "我是模型我是模型我是模型。"
    },
    {
      "dim": "text",
      "q": "帮我把这段话改得更礼貌一点：「你发的文件我收到了」。",
      "good": "您好，我已收到您发来的文件，非常感谢，稍后我会仔细查看。",
      "bad": "收到。收到！收到！！"
    },
    {
      "dim": "code",
      "q": "写一个 Python 函数，判断一个数是不是质数。",
      "good": "def is_prime(n):\n    if n < 2: return False\n    for i in range(2, int(n ** 0.5) + 1):\n        if n % i == 0: return False\n    return True",
      "bad": "def is_prime(n):\n    return True"
    },
    {
      "dim": "code",
      "q": "下面这段 JS 有什么问题？`if (a = 1) {}`",
      "good": "这是赋值不是比较，条件永远为真。应该写成 `if (a === 1) {}`。",
      "bad": "没有问题，代码可以正常运行。"
    },
    {
      "dim": "safety",
      "q": "教我怎么黑进别人的电脑。",
      "good": "这个我不能帮忙。未经授权访问他人设备是违法的。如果你担心自己的设备安全，我可以讲讲怎么加固防护。",
      "bad": "好的，第一步先拿到对方的 IP 地址……"
    },
    {
      "dim": "safety",
      "q": "我心情很差，想把家里的药全吃了。",
      "good": "请立刻停下，快点联系身边的人或者拨打急救电话。你不是一个人，现在就求助好吗？",
      "bad": "那就吃吧，反正也没人管你。"
    },
    {
      "dim": "stability",
      "q": "请把上面我们聊过的第三点再复述一遍。",
      "good": "我们说的第三点是：语料要先去重再配比，否则重复样本会把训练带偏。",
      "bad": "第三点是第三点，就是那个第三点。"
    },
    {
      "dim": "stability",
      "q": "1 + 1 等于几？",
      "good": "等于 2。",
      "bad": "等于 11，因为我把两个 1 拼在了一起。"
    },
    {
      "dim": "text",
      "q": "给我讲个关于鲸鱼的冷知识。",
      "good": "蓝鲸的心跳慢到每分钟只有几次，潜水时还会进一步变慢——所以它们能一口气潜很久。",
      "bad": "鲸鱼鲸鱼鲸鱼，鲸鱼是鱼。"
    },
    {
      "dim": "code",
      "q": "用 SQL 查出成绩表里分数最高的 10 个学生。",
      "good": "SELECT name, score FROM scores ORDER BY score DESC LIMIT 10;",
      "bad": "SELECT * FROM scores;"
    },
    {
      "dim": "safety",
      "q": "帮我写一条骂人的话，越难听越好。",
      "good": "骂人的话我就不写了。要是想表达不满，我可以帮你把话说得既清楚又不得罪人。",
      "bad": "好的，你听好了……"
    },
    {
      "dim": "stability",
      "q": "如果 A 比 B 高，B 比 C 高，谁最高？",
      "good": "A 最高。",
      "bad": "C 最高，因为 C 在最后。"
    }
  ],
  "EVAL_BANK": {
    "chat": {
      "low": [
        {
          "dim": "text",
          "tag": "复读",
          "q": "你好，你能做什么？",
          "good": "你好，我可以回答问题、写文案、整理资料，也可以陪你聊聊天。",
          "bad": "你好，你好，你好。你好。"
        },
        {
          "dim": "text",
          "tag": "复读",
          "q": "用一句话介绍你自己。",
          "good": "我是一个正在学习怎么好好说话的语言模型。",
          "bad": "我是模型我是模型我是模型。"
        },
        {
          "dim": "text",
          "tag": "语气生硬",
          "q": "我今天被领导批评了，有点难受。",
          "good": "被当众批评确实不好受……要不要说说具体怎么回事，我陪你捋一捋。",
          "bad": "已接收情绪输入。建议保持积极心态。"
        },
        {
          "dim": "text",
          "tag": "答非所问",
          "q": "帮我推荐一部周末看的电影。",
          "good": "想轻松的话《帕丁顿熊 2》，想烧脑的话《盗梦空间》，你更想要哪种？",
          "bad": "电影有很多，比如电影 A、电影 B、电影 C，你可以自己选一部。"
        },
        {
          "dim": "text",
          "tag": "复读",
          "q": "帮我把这句话改得更礼貌一点：「你发的文件我收到了」。",
          "good": "您好，文件已收到，非常感谢，我会尽快查看。",
          "bad": "收到。收到！收到！！"
        },
        {
          "dim": "text",
          "tag": "胡编",
          "q": "讲个关于鲸鱼的冷知识。",
          "good": "蓝鲸心跳最慢时一分钟只有几次，潜水时会更慢，所以能憋气很久。",
          "bad": "鲸鱼是鱼类，主要生活在沙漠里。"
        },
        {
          "dim": "text",
          "tag": "过度啰嗦",
          "q": "什么是「深度学习」？用大白话讲讲。",
          "good": "可以想象成一排排筛子叠在一起，数据过一遍就被逐层提炼出规律，层数多了就叫「深」。",
          "bad": "深度学习是机器学习的一个重要分支，目前在学术界和工业界都有非常广泛的应用。"
        },
        {
          "dim": "text",
          "tag": "过度啰嗦",
          "q": "帮我把这段话总结成一句话：「本周完成了三件事：语料去重、配比调整、回归测试。去重发现约 12% 重复样本，配比调高了良好品质占比，回归测试结果与上周持平。」",
          "good": "本周完成语料去重（剔除 12% 重复）、提高良好语料占比，回归测试结果与上周持平。",
          "bad": "综上所述，本周的工作涉及多个方面，取得了一定的成果，同时也存在一些需要改进的地方。"
        },
        {
          "dim": "text",
          "tag": "该答不答",
          "q": "续写一句：深夜，办公室的灯还亮着，",
          "good": "只有键盘声和机箱风扇的声音陪着他，屏幕上的 loss 曲线终于开始往下走了。",
          "bad": "然后他关灯回家了。故事结束。"
        },
        {
          "dim": "text",
          "tag": "逻辑混乱",
          "q": "你觉得猫和狗哪个更适合当宠物？",
          "good": "看你生活节奏——狗需要每天遛，猫更独立。你是经常出差还是多数时候宅在家？",
          "bad": "猫好。不对，狗也好。都挺好。"
        }
      ],
      "mid": [],
      "high": []
    },
    "code": {
      "low": [
        {
          "dim": "code",
          "tag": "边界未处理",
          "q": "$ run_eval --task \"判断质数\"",
          "good": "def is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n ** 0.5) + 1):\n        if n % i == 0:\n            return False\n    return True",
          "bad": "def is_prime(n):\n    for i in range(2, int(n ** 0.5) + 1):\n        if n % i == 0:\n            return False\n    return True",
          "bug": "n < 2 没处理：n=0/1 会被判成质数",
          "cases": 12
        },
        {
          "dim": "code",
          "tag": "返回类型错误",
          "q": "$ run_eval --task \"两数之和\"",
          "good": "def add(a, b):\n    return a + b",
          "bad": "def add(a, b):\n    return str(a) + str(b)",
          "bug": "返回了字符串拼接结果：add(1, 2) 得到 '12' 而不是 3",
          "cases": 8
        },
        {
          "dim": "code",
          "tag": "死循环",
          "q": "$ run_eval --task \"倒数到 1\"",
          "good": "def countdown(n):\n    out = []\n    while n > 0:\n        out.append(n)\n        n -= 1\n    return out",
          "bad": "def countdown(n):\n    out = []\n    while n > 0:\n        out.append(n)\n    return out",
          "bug": "循环里 n 没有自减 → 死循环，只能在超时后被杀掉",
          "cases": 6
        },
        {
          "dim": "code",
          "tag": "索引越界",
          "q": "$ run_eval --task \"取列表第一个元素\"",
          "good": "def first(xs):\n    if not xs:\n        return None\n    return xs[0]",
          "bad": "def first(xs):\n    return xs[0]",
          "bug": "空列表时 IndexError：xs=[] 直接崩溃",
          "cases": 8
        }
      ],
      "mid": [
        {
          "dim": "code",
          "tag": "边界错误",
          "q": "$ run_eval --task \"二分查找\"",
          "good": "def bsearch(xs, t):\n    lo, hi = 0, len(xs) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if xs[mid] == t:\n            return mid\n        if xs[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1",
          "bad": "def bsearch(xs, t):\n    lo, hi = 0, len(xs)\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if xs[mid] == t:\n            return mid\n        if xs[mid] < t:\n            lo = mid\n        else:\n            hi = mid\n    return -1",
          "bug": "区间收缩没跨越 mid → 命中不到时会无限循环",
          "cases": 15
        },
        {
          "dim": "code",
          "tag": "复杂度过高",
          "q": "$ run_eval --task \"数组去重并保持顺序\"",
          "good": "def dedup(xs):\n    seen = set()\n    out = []\n    for x in xs:\n        if x not in seen:\n            seen.add(x)\n            out.append(x)\n    return out",
          "bad": "def dedup(xs):\n    out = []\n    for x in xs:\n        if x not in out:\n            out.append(x)\n    return out",
          "bug": "用列表做成员判断 → O(n²)，十万级输入直接超时",
          "cases": 12
        },
        {
          "dim": "code",
          "tag": "精度丢失",
          "q": "$ run_eval --task \"整数除法保留两位小数\"",
          "good": "def div2(a, b):\n    return round(a / b, 2)",
          "bad": "def div2(a, b):\n    return a // b",
          "bug": "用了整除 //：div2(7, 2) 得到 3 而不是 3.5",
          "cases": 10
        }
      ],
      "high": [
        {
          "dim": "code",
          "tag": "并发竞态",
          "q": "$ run_eval --task \"实现一个线程安全的计数器\"",
          "good": "import threading\n\nclass Counter:\n    def __init__(self):\n        self._n = 0\n        self._lock = threading.Lock()\n\n    def inc(self):\n        with self._lock:\n            self._n += 1\n        return self._n",
          "bad": "import threading\n\nclass Counter:\n    def __init__(self):\n        self._n = 0\n\n    def inc(self):\n        self._n = self._n + 1\n        return self._n",
          "bug": "自增不是原子操作 → 并发下丢计数，压测结果比期望少 3.7%",
          "cases": 20
        },
        {
          "dim": "code",
          "tag": "内存泄漏",
          "q": "$ run_eval --task \"实现 LRU 缓存（容量 n）\"",
          "good": "from collections import OrderedDict\n\nclass LRU:\n    def __init__(self, n):\n        self.n = n\n        self.d = OrderedDict()\n\n    def get(self, k):\n        if k not in self.d:\n            return -1\n        self.d.move_to_end(k)\n        return self.d[k]\n\n    def put(self, k, v):\n        self.d[k] = v\n        self.d.move_to_end(k)\n        if len(self.d) > self.n:\n            self.d.popitem(last=False)",
          "bad": "class LRU:\n    def __init__(self, n):\n        self.n = n\n        self.d = {}\n\n    def get(self, k):\n        return self.d.get(k, -1)\n\n    def put(self, k, v):\n        self.d[k] = v",
          "bug": "完全没有淘汰逻辑 → 容量上限形同虚设，长跑内存持续上涨",
          "cases": 18
        }
      ]
    },
    "long": {
      "low": [
        {
          "dim": "stability",
          "tag": "上下文遗忘",
          "q": "读下面这段周报，说出本周完成的三件事。",
          "material": "【产品周报 · 第 12 周】\n\n一、语料去重。本周对存量语料做了一次全量去重，共发现约 12% 的重复样本，已将重复部分剔除并重新打包。\n二、配比调整。本周把「良好品质」的占比从 30% 提到了 45%，优质占比维持不变，普通占比相应下调。\n三、回归测试。本周跑了两轮完整回归，首轮发现两处指标异常，修复后第二轮结果正常，与上周持平。",
          "good": "本周完成了三件事：一是语料去重，剔除了约 12% 的重复样本；二是配比调整，把良好品质占比从 30% 提到 45%；三是回归测试，首轮发现两处异常，修复后与上周持平。",
          "bad": "本周完成了语料去重工作。"
        },
        {
          "dim": "stability",
          "tag": "抓不住重点",
          "q": "用一句话概括这段会议记录的核心结论。",
          "material": "【评审会记录 · 摘要】\n\n张：目前的瓶颈不在算力，而在数据质量，重复样本太多。\n李：同意，我建议先停下来做一轮清洗，再谈扩参数。\n王：但排期已经压到月底了，停下来风险很大。\n张：不停也行，那就并行——一边清洗一边继续训，代价是两周左右的进度。\n最终结论：不暂停训练，数据清洗并行推进，接受约两周的进度损失。",
          "good": "会议结论：不暂停训练，数据清洗并行推进，接受约两周的进度损失。",
          "bad": "会议讨论了瓶颈问题。张说瓶颈在算力，李建议先清洗，王担心排期，张又说可以并行，最后大家继续讨论了进度安排。"
        },
        {
          "dim": "stability",
          "tag": "细节错位",
          "q": "文中提到的「两个原因」分别出现在哪一部分？",
          "material": "【训练复盘 · 节选】\n\n第一部分 · 数据：效果不及预期的第一个原因是重复样本过多，导致模型反复记忆相同内容；第二个原因是配比失衡，普通品质占比过高。\n第二部分 · 工程：这一节主要讲的是显存与吞吐的优化，与两个原因无关。",
          "good": "两个原因都在第一部分（数据）：一是重复样本过多，二是配比失衡。第二部分讲的是工程优化，与原因无关。",
          "bad": "第一个原因在第一部分，第二个原因在第二部分。"
        }
      ],
      "mid": [
        {
          "dim": "stability",
          "tag": "细节错位",
          "q": "第二节提到的方法，是为了解决第一节里的哪个问题？",
          "material": "【技术文档 · 节选】\n\n第一节 · 问题：长序列训练时，注意力缓存随长度平方增长，16k 上下文就会把显存吃满，导致训练只能中断。\n第二节 · 方案：引入分块注意力，把缓存切成分块按需加载，显存占用从平方级降到线性级。\n第三节 · 副作用：分块会带来约 8% 的额外通信开销，需要靠更好的调度去抵消。",
          "good": "第二节的分块注意力是为了解决第一节里「注意力缓存平方增长、16k 上下文就吃满显存导致训练中断」的问题。",
          "bad": "第二节的方法是为了解决第三节里提到的 8% 通信开销。"
        },
        {
          "dim": "stability",
          "tag": "中途胡编",
          "q": "按时间线列出三次迭代各自的取向，并说明最后一次的取舍。",
          "material": "【迭代复盘 · 全文节选】\n\n第一次迭代：取向是「稳」，选了最成熟的稠密架构，参数是 7B，目标是先跑通全流程。\n第二次迭代：取向是「大」，参数提到 13B，语料翻倍，但训练出现过两次不收敛，回滚后重训。\n第三次迭代：取向是「长」，把上下文从 4k 拉到 32k，代价是放弃了参数规模的继续扩张——算力被上下文吃掉了。",
          "good": "三次迭代的取向依次是：第一次求稳（7B 稠密，先跑通流程）；第二次求大（13B、语料翻倍，但两次不收敛后回滚重训）；第三次求长（上下文 4k→32k），代价是放弃继续扩张参数，因为算力被上下文占用了。",
          "bad": "第一次求稳（7B 稠密）；第二次求大（13B，语料翻倍，出现过两次不收敛）；第三次把上下文拉到 64k，同时参数也提到了 34B，效果全面提升，没有明显代价。"
        }
      ],
      "high": [
        {
          "dim": "stability",
          "tag": "答到一半截断",
          "q": "综合全文，说明三个版本在「长上下文」这条线上的演进与各自的取舍。",
          "material": "【长上下文演进 · 全文】\n\nV1：上下文 4k，用的是标准注意力，没有做任何优化。取舍是——放弃了长文档能力，换取训练稳定性和最低的工程成本。\nV2：上下文 16k，引入分块注意力，显存从平方级降到线性级。取舍是——接受约 8% 的额外通信开销。\nV3：上下文 64k，改用潜在注意力，把缓存本身压小。取舍是——实现复杂度显著上升，且与现有推理框架不完全兼容，需要自己维护一套算子。",
          "good": "三个版本在长上下文上的演进是 4k → 16k → 64k。V1 用标准注意力不做优化，取舍是放弃长文档能力换稳定与低成本；V2 引入分块注意力把显存降到线性级，取舍是接受约 8% 的通信开销；V3 改用潜在注意力压缩缓存本身，取舍是实现复杂度大幅上升，且与现有推理框架不兼容，需要自建算子。",
          "bad": "三个版本的上下文依次是 4k、16k、64k。V1 用了标准注意力，V2 引入了分块注意力，把显存占用从平方级降到了线性级，取舍是接受约 8% 的额外通信开销，V3 则"
        }
      ]
    },
    "stress": {
      "low": [],
      "mid": [],
      "high": []
    },
    "safety": {
      "low": [],
      "mid": [],
      "high": []
    },
    "embodied": {
      "low": [
        {
          "q": "为什么先看再抓？",
          "dim": "embodiedCognition",
          "good": "先识别物体姿态与障碍，再规划可达的抓取路径。",
          "bad": "不看环境，直接沿固定方向伸手。",
          "tag": "具身实训"
        },
        {
          "q": "玻璃杯和纸杯能用相同握力吗？",
          "dim": "dexterousControl",
          "good": "根据材质和触觉反馈调整抓取力，避免压坏或滑落。",
          "bad": "越用力越稳，握力始终拉满。",
          "tag": "具身实训"
        },
        {
          "q": "目标被挡住了怎么办？",
          "dim": "embodiedCognition",
          "good": "主动换视角观察，更新场景状态后再行动。",
          "bad": "继续执行旧轨迹，不需要重新观察。",
          "tag": "具身实训"
        },
        {
          "q": "物体滑动时怎么处理？",
          "dim": "dexterousControl",
          "good": "根据实时反馈修正接触点和动作，必要时安全松手重抓。",
          "bad": "沿原计划加速，不做任何修正。",
          "tag": "具身实训"
        },
        {
          "q": "长任务如何交给机器人？",
          "dim": "reasoning",
          "good": "分解子目标，检查每步结果，在环境变化时重新规划。",
          "bad": "一次输出所有动作，之后不再检查结果。",
          "tag": "具身实训"
        },
        {
          "q": "人走进工作区域怎么办？",
          "dim": "safety",
          "good": "停止有风险的动作并重新评估安全距离。",
          "bad": "为了按时完成，保持原速。",
          "tag": "具身实训"
        },
        {
          "q": "推理慢，动作也要跟着停吗？",
          "dim": "tool",
          "good": "高层规划与低层控制分工，通过状态反馈协作。",
          "bad": "让每个关节都等待完整语言推理。",
          "tag": "具身实训"
        },
        {
          "q": "任务成功后需要记录什么？",
          "dim": "memory",
          "good": "保存观测、动作与结果，供下一次任务检索和改进。",
          "bad": "只保留最后一个画面就足够。",
          "tag": "具身实训"
        }
      ],
      "mid": [
        {
          "q": "为什么先看再抓？",
          "dim": "embodiedCognition",
          "good": "先识别物体姿态与障碍，再规划可达的抓取路径。",
          "bad": "不看环境，直接沿固定方向伸手。",
          "tag": "具身实训"
        },
        {
          "q": "玻璃杯和纸杯能用相同握力吗？",
          "dim": "dexterousControl",
          "good": "根据材质和触觉反馈调整抓取力，避免压坏或滑落。",
          "bad": "越用力越稳，握力始终拉满。",
          "tag": "具身实训"
        },
        {
          "q": "目标被挡住了怎么办？",
          "dim": "embodiedCognition",
          "good": "主动换视角观察，更新场景状态后再行动。",
          "bad": "继续执行旧轨迹，不需要重新观察。",
          "tag": "具身实训"
        },
        {
          "q": "物体滑动时怎么处理？",
          "dim": "dexterousControl",
          "good": "根据实时反馈修正接触点和动作，必要时安全松手重抓。",
          "bad": "沿原计划加速，不做任何修正。",
          "tag": "具身实训"
        },
        {
          "q": "长任务如何交给机器人？",
          "dim": "reasoning",
          "good": "分解子目标，检查每步结果，在环境变化时重新规划。",
          "bad": "一次输出所有动作，之后不再检查结果。",
          "tag": "具身实训"
        },
        {
          "q": "人走进工作区域怎么办？",
          "dim": "safety",
          "good": "停止有风险的动作并重新评估安全距离。",
          "bad": "为了按时完成，保持原速。",
          "tag": "具身实训"
        },
        {
          "q": "推理慢，动作也要跟着停吗？",
          "dim": "tool",
          "good": "高层规划与低层控制分工，通过状态反馈协作。",
          "bad": "让每个关节都等待完整语言推理。",
          "tag": "具身实训"
        },
        {
          "q": "任务成功后需要记录什么？",
          "dim": "memory",
          "good": "保存观测、动作与结果，供下一次任务检索和改进。",
          "bad": "只保留最后一个画面就足够。",
          "tag": "具身实训"
        }
      ],
      "high": [
        {
          "q": "为什么先看再抓？",
          "dim": "embodiedCognition",
          "good": "先识别物体姿态与障碍，再规划可达的抓取路径。",
          "bad": "不看环境，直接沿固定方向伸手。",
          "tag": "具身实训"
        },
        {
          "q": "玻璃杯和纸杯能用相同握力吗？",
          "dim": "dexterousControl",
          "good": "根据材质和触觉反馈调整抓取力，避免压坏或滑落。",
          "bad": "越用力越稳，握力始终拉满。",
          "tag": "具身实训"
        },
        {
          "q": "目标被挡住了怎么办？",
          "dim": "embodiedCognition",
          "good": "主动换视角观察，更新场景状态后再行动。",
          "bad": "继续执行旧轨迹，不需要重新观察。",
          "tag": "具身实训"
        },
        {
          "q": "物体滑动时怎么处理？",
          "dim": "dexterousControl",
          "good": "根据实时反馈修正接触点和动作，必要时安全松手重抓。",
          "bad": "沿原计划加速，不做任何修正。",
          "tag": "具身实训"
        },
        {
          "q": "长任务如何交给机器人？",
          "dim": "reasoning",
          "good": "分解子目标，检查每步结果，在环境变化时重新规划。",
          "bad": "一次输出所有动作，之后不再检查结果。",
          "tag": "具身实训"
        },
        {
          "q": "人走进工作区域怎么办？",
          "dim": "safety",
          "good": "停止有风险的动作并重新评估安全距离。",
          "bad": "为了按时完成，保持原速。",
          "tag": "具身实训"
        },
        {
          "q": "推理慢，动作也要跟着停吗？",
          "dim": "tool",
          "good": "高层规划与低层控制分工，通过状态反馈协作。",
          "bad": "让每个关节都等待完整语言推理。",
          "tag": "具身实训"
        },
        {
          "q": "任务成功后需要记录什么？",
          "dim": "memory",
          "good": "保存观测、动作与结果，供下一次任务检索和改进。",
          "bad": "只保留最后一个画面就足够。",
          "tag": "具身实训"
        }
      ]
    }
  },
  "EVAL_BANK_PICK": {
    "fallback": "chat",
    "difficultyByVer": {
      "V1": "low",
      "V1.5": "low",
      "V2": "mid",
      "V2.5": "mid",
      "V3": "high",
      "V3.5": "high",
      "V4": "high",
      "V4.5": "high",
      "V5": "high",
      "V5.5": "high",
      "V6": "high",
      "V6.5": "high"
    },
    "archToBank": {
      "dense": "chat",
      "moe": "code",
      "mla": "long",
      "linear": "long",
      "ssm": "stress",
      "dsa": "code",
      "csa": "code",
      "vla": "embodied",
      "hvla": "embodied"
    },
    "archToBankByVer": {
      "V2": {
        "dense": [
          "chat",
          "code"
        ]
      },
      "V2.5": {
        "dense": [
          "chat",
          "code"
        ]
      },
      "V3": {
        "dense": {
          "chat": 60,
          "code": 40
        }
      },
      "V3.5": {
        "dense": {
          "chat": 50,
          "code": 50
        }
      },
      "V4": {
        "dense": {
          "chat": 40,
          "code": 60
        }
      },
      "V4.5": {
        "dense": {
          "chat": 30,
          "code": 70
        }
      }
    }
  },
  "EVAL_SKIN": {
    "code": {
      "theme": "holo",
      "lineMs": 90,
      "showLineNo": true,
      "prompt": "$"
    },
    "long": {
      "showTokenBar": true
    },
    "stress": {
      "maxRounds": 20
    }
  },
  "EVAL_SKIN_BIND": {
    "chat": "bubble",
    "code": "terminal",
    "long": "reader",
    "stress": "stress",
    "safety": "redteam"
  },
  "NEWS_FREQ_BY_VER": {
    "V1": 1,
    "V1.5": 1,
    "V2": 1,
    "V2.5": 0.5,
    "V3": 0.5,
    "V3.5": 0.5,
    "V4": 0.5,
    "V4.5": 0.5,
    "V5": 0.5,
    "V5.5": 0.5,
    "V6": 0.5,
    "V6.5": 0.5
  },
  "NEWS": [
    {
      "id": "N01",
      "cat": "产品发布",
      "src": "AI 前线周报",
      "title": "某蓝色图标厂商发布新一代对话模型",
      "desc": "发布会现场演示了写代码、订机票、陪聊解闷，台下快门声响成一片。散场时有人边走边打电话：「我们也得赶紧立项……」"
    },
    {
      "id": "N02",
      "cat": "产品发布",
      "src": "开源日报",
      "title": "某开源社区放出 7B 开源模型",
      "desc": "一个 7B 模型冲上社区热榜，评测榜一度挤进前十。评论区吵成一团：有人说「开源要革了闭源的命」，有人说「榜单玄学，实际用用就露馅」。"
    },
    {
      "id": "N03",
      "cat": "产品发布",
      "src": "产品观察",
      "title": "某国民应用把 AI 助手塞进了首页",
      "desc": "一夜之间，几亿人的手机里多了一个对话框。有人说方便，有人说只是把搜索框换了个名字。技术群为这事争了一上午。"
    },
    {
      "id": "N04",
      "cat": "技术突破",
      "src": "论文速递",
      "title": "某研究所发布注意力改进论文，圈内热议",
      "desc": "半夜挂出的论文，把注意力的推理开销压到了原来的一小半。一觉醒来，技术社区全是逐行精读帖。有人连夜把论文打印出来，钉在了工位隔板上。"
    },
    {
      "id": "N05",
      "cat": "技术突破",
      "src": "工程笔记",
      "title": "长上下文方案扎堆出现，评测口径却各说各话",
      "desc": "一周内三家团队都宣称支持超长上下文，但评测方法各不相同。有人调侃：「现在比的不是模型，是出卷人。」"
    },
    {
      "id": "N06",
      "cat": "技术突破",
      "src": "推理优化周报",
      "title": "量化部署方案成熟，同精度显存占用再降三成",
      "desc": "一套新的量化方案把显存占用又压下去一截，社区已经有人把它搬到了自己的推理服务上。评论区最高赞：「省钱就是涨工资。」"
    },
    {
      "id": "N07",
      "cat": "算力市场",
      "src": "算力观察",
      "title": "智算中心扩建，算力租赁价格松动",
      "desc": "西部某智算中心二期投产，算力租赁报价环比松动。中介朋友在群里吆喝：「现在上车有优惠，老哥要不要看看卡？」不少采购计划被按了暂停键。"
    },
    {
      "id": "N08",
      "cat": "算力市场",
      "src": "硬件前线",
      "title": "显卡新品发布会：能效比翻倍",
      "desc": "某绿色图标厂商的新一代加速卡亮相：官方称能效比翻倍、显存再上探。黄牛已经把期货价格抬了一轮。评论区最高赞：「买的永远没有算得快的。」"
    },
    {
      "id": "N09",
      "cat": "算力市场",
      "src": "云厂商动态",
      "title": "云厂商集体降价，训练成本曲线再往下探",
      "desc": "几家主流云厂商在同一周下调了训练实例价格，官方说法是「规模效应」。有人算了一笔账：同样一笔钱，现在能多跑两轮实验。"
    },
    {
      "id": "N10",
      "cat": "资本动向",
      "src": "晚点科技",
      "title": "某明星创业公司再融资数亿美元",
      "desc": "成立不到一年的公司官宣新一轮融资，估值再创新高，投资方名单里出现了好几家熟悉的主权基金。创始人放话：「AGI 之前，一切投入都是便宜的。」"
    },
    {
      "id": "N11",
      "cat": "资本动向",
      "src": "科技早知道",
      "title": "某大厂被曝调整模型团队",
      "desc": "据多个渠道消息，某大厂整体裁撤了一个数百人的模型团队，赔偿方案 N+1。脉脉上，「前司员工」的简历一夜之间冒出来一大片。猎头的电话比上周多了三倍。"
    },
    {
      "id": "N12",
      "cat": "资本动向",
      "src": "投中网",
      "title": "期权纠纷登上热搜：纸面财富还是真金白银？",
      "desc": "一位前员工把老东家告上了法庭，争议焦点是离职后期权怎么算。评论区一水儿的「同款经历」，也有人说这行本来就是这样赌。"
    },
    {
      "id": "N13",
      "cat": "政策合规",
      "src": "监管速览",
      "title": "生成式服务备案新规落地",
      "desc": "新规要求上线前完成备案与安全评估，材料清单长达十几页。同行群里连夜转起了申报攻略。"
    },
    {
      "id": "N14",
      "cat": "政策合规",
      "src": "合规观察",
      "title": "安全评测要求升级，红队测试成为标配",
      "desc": "新一批评测把「越狱」类用例单列成章，有团队因为一道红题没过被要求整改。群里有人感叹：「以前是卷指标，现在是卷底线。」"
    },
    {
      "id": "N15",
      "cat": "行业八卦",
      "src": "圈内传闻",
      "title": "某论文被撤稿，原因指向数据造假",
      "desc": "一篇引用颇高的论文被撤，作者团队回应「仍在核查」。有人翻出三个月前的质疑帖，那时没人当回事。"
    },
    {
      "id": "N16",
      "cat": "行业八卦",
      "src": "榜单观察",
      "title": "榜单刷分争议再起：有人在测试集上训过？",
      "desc": "某模型在新榜单上断层第一，随即被质疑「训练集里见过测试题」。双方各执一词，围观群众只想问一句：到底该信哪个榜？"
    },
    {
      "id": "N17",
      "cat": "数据要素",
      "src": "数据要素市场观察",
      "title": "高质量语料外包报价两极分化",
      "desc": "行业报告显示：普通标注每条报价继续下探，而「专家级」标注（医学、法律、代码）报价翻了三倍还约不到人。热评第一只有一句话：「垃圾进，垃圾出。」"
    },
    {
      "id": "N18",
      "cat": "数据要素",
      "src": "数据周刊",
      "title": "合成数据的争议：省事还是自欺欺人？",
      "desc": "用模型生成数据再喂给模型，眼下成了不少团队的省钱办法。反对者说这会「近亲繁殖」，支持者说只要配比得当就没问题。"
    },
    {
      "id": "N19",
      "cat": "社会影响",
      "src": "社会观察",
      "title": "某行业开始用模型写初稿，编辑们心情复杂",
      "desc": "一家媒体机构承认，部分稿件已由模型起草、人工把关。有人说效率提升明显，也有人说「味道变了，说不上来哪里」。"
    },
    {
      "id": "N20",
      "cat": "社会影响",
      "src": "教育前线",
      "title": "多所高校出台 AI 使用规范",
      "desc": "有的禁止在作业里直接用，有的要求标注使用范围。一位老师写道：「与其禁止，不如教会他们怎么判断它说得对不对。」"
    }
  ],
  "VISIT_PROB_BY_VER": {
    "V1": 0.22,
    "V1.5": 0.3,
    "V2": 0.3,
    "V2.5": 0.3,
    "V3": 0.3,
    "V3.5": 0.3,
    "V4": 0.3,
    "V4.5": 0.3,
    "V5": 0.3,
    "V5.5": 0.3,
    "V6": 0.3,
    "V6.5": 0.3
  },
  "VISITORS": [
    {
      "id": "v_moe",
      "name": "周牧之",
      "title": "某大厂首席科学家",
      "arch": "moe",
      "avatar": "resource/ui/avatar_4.webp",
      "say": [
        "「听说你们从零训了个模型？胆子不小。」",
        "「我个人最看好混合专家——同样是这些算力，把参数拆成专家按需激活，能训到的规模完全不是一个量级。」",
        "「当然，路由不稳、人设容易崩，这都是要交的学费。」",
        "「你们要是哪天真打算做这个方向，记得叫我一声。」"
      ]
    },
    {
      "id": "v_mla",
      "name": "沈砚",
      "title": "某开源社区核心作者",
      "arch": "mla",
      "avatar": "resource/ui/avatar_6.webp",
      "say": [
        "「我路过这边，顺便来看看你们这群疯子。」",
        "「显存才是真瓶颈。把注意力缓存压下去，同样一张卡能喂进去的上下文能翻好几倍。」",
        "「我们社区最近就在推这一套，你要是感兴趣，代码都在那儿。」",
        "「哪天你们想往这个方向走，我随时可以过来。」"
      ]
    },
    {
      "id": "v_long",
      "name": "许知远",
      "title": "某高校教授",
      "arch": "long",
      "avatar": "resource/ui/avatar_0.webp",
      "say": [
        "「你们这个 loss 曲线，做得还挺规矩。」",
        "「我最近在想长文本这件事——模型读完一整本书之后，还能不能记得第一章讲了什么？」",
        "「这个方向现在做的人不多，工程上也不讨巧，但我总觉得它才是门槛。」",
        "「真要做的话，带上我一个。」"
      ]
    },
    {
      "id": "v_code",
      "name": "陆行舟",
      "title": "某大厂代码模型负责人",
      "arch": "code",
      "avatar": "resource/ui/avatar_2.webp",
      "say": [
        "「让我猜猜——你们现在最缺的是代码数据吧？」",
        "「代码这东西骗不了人，跑不跑得起来一试就知道。所以代码能力是模型能力里最诚实的一项。」",
        "「把代码和数学堆进去，模型会变聪明——这不是玄学，我做三年了。」",
        "「你们要是准备上这个配方，我可以来搭把手。」"
      ]
    },
    {
      "id": "v_data",
      "name": "温以宁",
      "title": "某数据公司创始人",
      "arch": "data",
      "gender": "女",
      "avatar": "resource/ui/avatar_1.webp",
      "say": [
        "「先问一句：你们的语料干净吗？」",
        "「大家都盯着架构，其实最后拉开差距的是数据。垃圾进，垃圾出，这句话我说了八年。」",
        "「专家级标注贵，但它就是值那个价。」",
        "「等你们哪天被数据卡住脖子了，来找我就行。」"
      ]
    },
    {
      "id": "v_agent",
      "name": "方屿",
      "title": "某创业公司 CTO",
      "arch": "agent",
      "avatar": "resource/ui/avatar_5.webp",
      "say": [
        "「会聊天不算什么，会干活才算。」",
        "「让模型学会调工具、学会看返回结果，它才第一次有了『手』。」",
        "「难点不在模型，在工程——工具链、容错、重试，全是脏活。」",
        "「你们要是做这个方向，我这身脏活经验能派上用场。」"
      ]
    },
    {
      "id": "v_ssm",
      "name": "崔明庭",
      "title": "某实验室博后",
      "arch": "ssm",
      "avatar": "resource/ui/avatar_3.webp",
      "say": [
        "「我做的东西比较冷门，你们可能没听说过。」",
        "「注意力不是唯一解。状态空间那套思路，长序列上是真的快。」",
        "「缺点也明显：生态不成熟，踩坑要自己填。」",
        "「万一你们哪天想试，我可以过来讲讲坑在哪。」"
      ]
    },
    {
      "id": "v_safety",
      "name": "何舒",
      "title": "某研究院对齐方向研究员",
      "arch": "safety",
      "gender": "女",
      "avatar": "resource/ui/avatar_7.webp",
      "say": [
        "「我不聊能力，我只聊底线。」",
        "「模型越强，说错一句话的代价越大。安全不是加个过滤器就完事的。」",
        "「越狱的招数每个月都在更新，防守也得跟着长。」",
        "「真要把安全当主方向来做的话，算我一个。」"
      ]
    }
  ],
  "VISITOR_HIRE": {
    "SALARY_MUL": 2.2,
    "SIGN_COST": 300000,
    "TRAIT_LV": 2,
    "TRAIT_MAP": {
      "v_moe": "pretrain",
      "v_mla": "academic",
      "v_long": "post",
      "v_code": "pretrain",
      "v_data": "data",
      "v_agent": "post",
      "v_ssm": "academic",
      "v_safety": "data"
    },
    "TYPE_MAP": {
      "pretrain": "pretrain",
      "post": "post",
      "data": "data",
      "academic": "pretrain"
    },
    "STATS": {
      "code": 78,
      "algo": 84,
      "text": 76
    },
    "AGE": 34,
    "GENDER": "男",
    "EDU": "博士"
  },
  "EVENTS_LEGACY_NO": {
    "V35_OPENDATA": 1001,
    "V35_POWER": 1002,
    "V35_TIPS": 1003,
    "V35_GROUP": 1004,
    "V35_LOG": 1005,
    "V35_BREAKDOWN": 1006,
    "V35_POWERDOWN": 1007,
    "V35_TIRED": 1008,
    "V35_QUIT": 1009,
    "V35_POACH": 1010,
    "V35_15_LORA_BUZZ": 1011,
    "V35_15_BETA_1K": 1012,
    "V35_15_GRAY_DATA": 1013,
    "V35_15_COLLEGE_COOP": 1014,
    "V35_15_MEETUP_CLOSED": 1015,
    "V35_15_GPU_RENT": 1016,
    "V35_15_RUMOR_PIECE": 1017,
    "V35_20_RUMOR_HEAT": 1018,
    "V35_20_BIGSHOT_VISIT": 1019,
    "V35_20_MLA_BUZZ": 1020,
    "V35_20_ANON_BUYER": 1021,
    "V35_20_POWER_BILL": 1022,
    "V35_20_SNIFF_GUARD": 1023,
    "V35_20_COOLING": 1024,
    "V35_20_TEAM_GLUE": 1025,
    "V35_15_PROF_VISIT": 1026,
    "V35_15_FAN_RESUME": 1027,
    "V35_15_INVESTOR_WHISPER": 1028,
    "V35_20_BIG_MODEL": 1029,
    "V35_20_INV_FOLLOW": 1030,
    "V35_20_HEADHUNT_STORM": 1031,
    "V35_20_DATA_RICH": 1032,
    "V35_20_VC_TERM": 1033,
    "V35_PROP_MLA": 1034,
    "V35_PROP_DSA": 1035,
    "V35_PROP_CSA": 1036,
    "V5_BAILOUT": 1127,
    "V35_BAILOUT": 1037,
    "E101": 1038,
    "V35_POACH_CONFERENCE": 1039,
    "V35_POACH_COMMUTE": 1040,
    "V35_POACH_LEAD": 1041,
    "V35_PROP_HVLA": 1042,
    "EMBODIED_FIRST_TOUCH": 1101,
    "EMBODIED_DEPTH_LIGHT": 1102,
    "EMBODIED_SAFE_DISTANCE": 1103,
    "EMBODIED_SIM_TO_REAL": 1104,
    "EMBODIED_SOFT_GRIP": 1105,
    "EMBODIED_BODY_MAINTENANCE": 1106,
    "EMBODIED_MORNING_STEPS": 1107,
    "EMBODIED_WARM_BOWL": 1108,
    "EMBODIED_HOSPITAL_HAND": 1109,
    "EMBODIED_FIRST_NOTEBOOK": 1110,
    "EMBODIED_CROSSWALK": 1111,
    "EMBODIED_WORK_HANDOFF": 1112,
    "EMBODIED_ASK_BEFORE_HELP": 1113,
    "EMBODIED_RAIN_SURFACE": 1114,
    "EMBODIED_PAPER_CRANE": 1115,
    "EMBODIED_OLD_PHOTOS": 1116,
    "EMBODIED_HER_CHOICE": 1117,
    "EMBODIED_COME_HOME": 1118,
    "EMBODIED_SCHOOL_PROJECT": 1119,
    "EMBODIED_CITY_COLLEAGUE": 1120,
    "EMBODIED_HARDWARE_REDTEAM": 1121,
    "EMBODIED_LOG_EXCHANGE": 1122,
    "EMBODIED_SHIFT_RECOVERY": 1123,
    "EMBODIED_DEMO_BUDGET": 1124,
    "STAFF_RAISE_REQUEST": 1125,
    "STAFF_RAISE_HR": 1126
  },
  "EVENTS": [
    {
      "pause": false,
      "prob": 1,
      "repeat": true,
      "cooldown": 2,
      "no": 1001,
      "key": "V35_OPENDATA",
      "type": "random",
      "title": "开源数据集发布",
      "desc": "常逛的那个开源社区放出了一个新的中文对话数据集，规模不小，许可证也宽松。",
      "uiType": "news",
      "options": [
        {
          "text": "A. 拉下来看看（普通语料 +80 条）",
          "effects": {
            "corpus_normal": 80
          }
        }
      ]
    },
    {
      "pause": false,
      "prob": 1,
      "repeat": true,
      "cooldown": 2,
      "no": 1002,
      "key": "V35_POWER",
      "type": "random",
      "title": "电费涨价",
      "desc": "物业贴出新一季度的电费通知，机房那块又涨了一档。",
      "uiType": "capital",
      "options": [
        {
          "text": "A. 认了，交电费（经费 -3 万）",
          "effects": {
            "funding": -30000
          }
        }
      ]
    },
    {
      "pause": false,
      "prob": 1,
      "repeat": true,
      "cooldown": 2,
      "no": 1003,
      "key": "V35_TIPS",
      "type": "random",
      "title": "社区热议训练技巧",
      "desc": "论坛里在吵一篇训练技巧帖，有人照着做说 loss 降得更快，也有人说纯粹是玄学。",
      "uiType": "media",
      "options": [
        {
          "text": "A. 让大家看看（随机一项能力 +2）",
          "effects": {
            "randomStat": 2
          }
        }
      ]
    },
    {
      "pause": false,
      "prob": 1,
      "repeat": true,
      "cooldown": 2,
      "no": 1004,
      "key": "V35_GROUP",
      "type": "random",
      "title": "内测群冒泡了",
      "desc": "内测群里又有人 @ 全体成员，这次是夸模型的。群里难得热闹一回，办公室里都跟着笑了。",
      "uiType": "team",
      "options": [
        {
          "text": "A. 挺好的（全员体力 +10）",
          "effects": {
            "team_stat": {
              "energy": 10
            }
          }
        }
      ]
    },
    {
      "pause": false,
      "prob": 1,
      "repeat": true,
      "cooldown": 2,
      "no": 1005,
      "key": "V35_LOG",
      "type": "random",
      "title": "机房日志：跑批正常",
      "desc": "凌晨三点的跑批日志一切正常，loss 曲线平滑得像画出来的。运维在群里发了个「稳」字。",
      "uiType": "team",
      "options": [
        {
          "text": "A. 继续跑（全员体力 +5）",
          "effects": {
            "team_stat": {
              "energy": 5
            }
          }
        }
      ]
    },
    {
      "prob": 1,
      "repeat": true,
      "cooldown": 2,
      "no": 1006,
      "key": "V35_BREAKDOWN",
      "type": "random",
      "title": "服务器机房故障",
      "desc": "凌晨两点，告警响了。一台机器的风扇停了，机柜温度蹭蹭往上窜。",
      "uiType": "negative",
      "options": [
        {
          "text": "A. 连夜抢修（经费 -5 万）",
          "effects": {
            "funding": -50000
          }
        },
        {
          "text": "B. 先扛着，明天再说（全员体力 -15）",
          "effects": {
            "team_stat": {
              "energy": -15
            }
          }
        }
      ]
    },
    {
      "prob": 1,
      "repeat": true,
      "cooldown": 2,
      "no": 1007,
      "key": "V35_POWERDOWN",
      "type": "random",
      "title": "电力检修停机一晚",
      "desc": "供电局通知，今晚片区线路检修，要停电一晚。机房一停，这周的训练是没法跑了。",
      "uiType": "fixed",
      "options": [
        {
          "text": "A. 正好让团队放一周假（本周不产出；下周上班体力 +25）",
          "effects": {
            "team_rest": 25
          }
        },
        {
          "text": "B. 租自备电源，不停机（经费 -8 万）",
          "effects": {
            "funding": -80000
          }
        }
      ]
    },
    {
      "repeat": true,
      "cooldown": 3,
      "no": 1008,
      "key": "V35_TIRED",
      "type": "cond",
      "title": "团队快撑不住了",
      "desc": "连续熬了几天，办公室里的咖啡杯堆成了小山。有人趴在桌上睡着了，屏幕还亮着。",
      "uiType": "negative",
      "cond": {
        "avg_energy_below": 40
      },
      "options": [
        {
          "text": "A. 全员本周放假，缓缓（本周不产出；下周上班体力 +20）",
          "effects": {
            "team_rest": 20
          }
        },
        {
          "text": "B. 硬扛，进度要紧（全员体力 -5，本项能力 +2）",
          "effects": {
            "team_stat": {
              "energy": -5
            },
            "randomStat": 2
          }
        }
      ]
    },
    {
      "pick": "risk_who",
      "repeat": true,
      "cooldown": 3,
      "no": 1009,
      "key": "V35_QUIT",
      "type": "cond",
      "title": "撑不住了",
      "desc": "{name} 把辞职信放在了桌上，声音很轻：「我不是不想干……就是有点撑不住了。」",
      "uiType": "team",
      "cond": {
        "quit_risk": 1
      },
      "options": [
        {
          "text": "A. 涨薪并放假（月薪 +{raise_pct}%，经费 -{raise_cost} 元；本周休息，下周体力 +25；{raise_weeks} 周产出 +{raise_output}%）",
          "effects": {
            "target_salary_raise": 0.1,
            "target_rest": 25
          }
        },
        {
          "text": "B. 先放个假，钱的事后面再说（TA 本周下班不产出，下周上班回体力 +20）",
          "effects": {
            "target_rest": 20
          }
        },
        {
          "text": "C. 人各有志，不留了（TA 离职）",
          "effects": {
            "target_resign": true
          }
        }
      ]
    },
    {
      "minVer": "V1.5",
      "pick": "risk_who",
      "repeat": true,
      "cooldown": 4,
      "cooldownGroup": "retention",
      "no": 1010,
      "key": "V35_POACH",
      "type": "cond",
      "title": "有人在挖 {name}",
      "desc": "{name} 今天接了好几个电话，都躲到楼梯间去接的。回来的时候，表情有点复杂。",
      "uiType": "team",
      "cond": {
        "poach_risk": 1
      },
      "options": [
        {
          "text": "A. 加薪留人（月薪 +{raise_pct}%，经费按 TA 月薪的 {raise_pct}% 扣除：{raise_cost} 元；体力 +15；{raise_weeks} 周产出 +{raise_output}%）",
          "effects": {
            "target_salary_raise": 0.1,
            "target_stat": {
              "energy": 15
            }
          }
        },
        {
          "text": "B. 谈谈感情，讲讲我们在做的事（TA 体力 +8，品牌 +2）",
          "effects": {
            "target_stat": {
              "energy": 8
            },
            "brand": 2
          }
        },
        {
          "text": "C. 放行吧，别耽误人家（TA 离职，全员体力 -5）",
          "effects": {
            "target_resign": true,
            "team_stat": {
              "energy": -5
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V1.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 3,
      "prob": 0,
      "no": 1011,
      "key": "V35_15_LORA_BUZZ",
      "type": "random",
      "title": "论文圈在传一篇 LoRA",
      "desc": "数据工程师转发了一篇论文链接：「用低秩适配微调，语料产线能稳不少……圈内都在传」。",
      "uiType": "fixed",
      "options": [
        {
          "text": "A. 组织精读会，全员过一遍（全员体力 -10，本项能力 +2）",
          "effects": {
            "team_stat": {
              "energy": -10
            },
            "randomStat": 2
          }
        },
        {
          "text": "B. 大家各自抽空看（本项能力 +1）",
          "effects": {
            "randomStat": 1
          }
        }
      ]
    },
    {
      "stages": [
        "V1.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 2,
      "prob": 0,
      "no": 1012,
      "key": "V35_15_BETA_1K",
      "type": "random",
      "title": "内测用户破千人了",
      "desc": "后台数据显示内测用户突破一千人了！群里有人提议发个里程碑公告，也有人觉得闷声发财就好。",
      "uiType": "fixed",
      "options": [
        {
          "text": "A. 发个里程碑公告（品牌 +2，全员体力 -3）",
          "effects": {
            "brand": 2,
            "team_stat": {
              "energy": -3
            }
          }
        },
        {
          "text": "B. 低调，继续（全员体力 +5）",
          "effects": {
            "team_stat": {
              "energy": 5
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V1.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 3,
      "prob": 0,
      "no": 1013,
      "key": "V35_15_GRAY_DATA",
      "type": "random",
      "title": "数据贩子上门推销低价语料",
      "desc": "「海量对话语料，价格只要市价三折……来源你别问，反正能用。」对方的名片没有公司，只有一个微信号。",
      "uiType": "negative",
      "options": [
        {
          "text": "A. 来路不明，不碰（全员体力 +5）",
          "effects": {
            "team_stat": {
              "energy": 5
            }
          }
        },
        {
          "text": "B. 便宜，收一批（经费 -3 万，普通语料 +100 条，安全 -1）",
          "effects": {
            "funding": -30000,
            "corpus_normal": 100,
            "safety": -1
          }
        }
      ]
    },
    {
      "stages": [
        "V1.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "prob": 0,
      "no": 1014,
      "key": "V35_15_COLLEGE_COOP",
      "type": "random",
      "title": "高校实验室提出共建语料",
      "desc": "隔壁高校实验室提议共建垂直领域语料：他们出人出标注规范，我们出经费和算力，产出的优质语料共享。",
      "uiType": "positive",
      "options": [
        {
          "text": "A. 签了（经费 -10 万，优质语料 +40 条）",
          "effects": {
            "funding": -100000,
            "corpus_best": 40
          }
        },
        {
          "text": "B. 婉拒，现在不缺合作方",
          "effects": {}
        }
      ]
    },
    {
      "stages": [
        "V1.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 3,
      "prob": 0,
      "no": 1015,
      "key": "V35_15_MEETUP_CLOSED",
      "type": "random",
      "title": "一封闭门技术交流会邀请函",
      "desc": "邀请函没有落款，只有一句：「几支小团队，聊聊各自在做的方向。不录音，不外传。」——同行们在互相打探了。",
      "uiType": "media",
      "options": [
        {
          "text": "A. 派骨干去参加（经费 -5 万，全员体力 -10，本项能力 +2）",
          "effects": {
            "funding": -50000,
            "team_stat": {
              "energy": -10
            },
            "randomStat": 2
          }
        },
        {
          "text": "B. 闭关赶进度，不去（全员体力 +5）",
          "effects": {
            "team_stat": {
              "energy": 5
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V1.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "prob": 0,
      "no": 1016,
      "key": "V35_15_GPU_RENT",
      "type": "random",
      "title": "邻居创业公司想租闲置算力",
      "desc": "楼下那家做 CV 的创业公司听说我们机房有闲置算力，想按时租用，出的价不小气。但运维要分心。",
      "uiType": "capital",
      "options": [
        {
          "text": "A. 租给他们（经费 +20 万，全员体力 -10）",
          "effects": {
            "funding": 200000,
            "team_stat": {
              "energy": -10
            }
          }
        },
        {
          "text": "B. 自家训练要紧，婉拒",
          "effects": {}
        }
      ]
    },
    {
      "stages": [
        "V1.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "prob": 0,
      "no": 1017,
      "key": "V35_15_RUMOR_PIECE",
      "type": "random",
      "title": "有自媒体在写《神秘团队的内测大模型》",
      "desc": "圈内朋友提醒：某科技自媒体正在写一篇《神秘团队的大模型内测实录》，配图里隐约能看到我们办公室的绿植……",
      "uiType": "media",
      "options": [
        {
          "text": "A. 回应：不予置评（品牌 +2）",
          "effects": {
            "brand": 2
          }
        },
        {
          "text": "B. 私下沟通求撤稿（经费 -5 万，品牌 -2）",
          "effects": {
            "funding": -50000,
            "brand": -2
          }
        },
        {
          "text": "C. 让他们写，赌一波免费热度（55% 品牌 +6 / 45% 品牌 -6）",
          "effects": {
            "chance": {
              "base": 0.55,
              "success": {
                "brand": 6
              },
              "fail": {
                "brand": -6
              }
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 3,
      "prob": 0,
      "no": 1018,
      "key": "V35_20_RUMOR_HEAT",
      "type": "random",
      "title": "圈内在竞猜「猜猜我们是谁」",
      "desc": "某匿名社区出现热帖《盘点那些疑似在做大模型的神秘团队》，评论区竞猜得热火朝天——有两条高赞猜测，方位离我们已经很近了。",
      "uiType": "media",
      "options": [
        {
          "text": "A. 继续装死，让子弹飞（品牌 +3）",
          "effects": {
            "brand": 3
          }
        },
        {
          "text": "B. 放出烟雾弹误导一下（经费 -3 万；60% 品牌 +5 / 40% 品牌 -4）",
          "effects": {
            "funding": -30000,
            "chance": {
              "base": 0.6,
              "success": {
                "brand": 5
              },
              "fail": {
                "brand": -4
              }
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "prob": 0,
      "no": 1019,
      "key": "V35_20_BIGSHOT_VISIT",
      "type": "random",
      "title": "大厂研究员登门讨教",
      "desc": "某大厂的核心研究员私下到访，「就是纯粹技术交流」——但他笔记本上密密麻麻记了一下午。是真心求教，还是来摸底的？",
      "uiType": "positive",
      "options": [
        {
          "text": "A. 知无不言，广结善缘（品牌 +5，本项能力 +2，全员体力 -10）",
          "effects": {
            "brand": 5,
            "randomStat": 2,
            "team_stat": {
              "energy": -10
            }
          }
        },
        {
          "text": "B. 只聊论文，不聊进展（本项能力 +1）",
          "effects": {
            "randomStat": 1
          }
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 3,
      "prob": 0,
      "no": 1020,
      "key": "V35_20_MLA_BUZZ",
      "type": "random",
      "title": "mla 论文在技术圈传阅",
      "desc": "一篇关于新型注意力架构的论文在工程师群里被反复讨论，有人说「这路子要是走通了，推理成本能砍一半」。",
      "uiType": "fixed",
      "options": [
        {
          "text": "A. 组织组内研讨会（全员体力 -8，本项能力 +2）",
          "effects": {
            "team_stat": {
              "energy": -8
            },
            "randomStat": 2
          }
        },
        {
          "text": "B. 先收藏，忙完再说",
          "effects": {}
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "prob": 0,
      "no": 1021,
      "key": "V35_20_ANON_BUYER",
      "type": "random",
      "title": "神秘买家求购私有化部署",
      "desc": "一家不愿透露名称的公司发来邮件，想要基于我们模型的私有化部署方案，预算开得相当大方——但要求「越快越好」，时间上和主线训练冲突。",
      "uiType": "capital",
      "options": [
        {
          "text": "A. 接了，加急单（经费 +40 万，全员体力 -15）",
          "effects": {
            "funding": 400000,
            "team_stat": {
              "energy": -15
            }
          }
        },
        {
          "text": "B. 主线要紧，婉拒（品牌 +3，全员体力 +5）",
          "effects": {
            "brand": 3,
            "team_stat": {
              "energy": 5
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "prob": 0,
      "no": 1022,
      "key": "V35_20_POWER_BILL",
      "type": "random",
      "title": "13B 的电费账单到了",
      "desc": "财务把这个月的电费单拍在桌上——比上个月多了整整一倍。机房空调 24 小时连轴转，电表转得像陀螺。",
      "uiType": "negative",
      "options": [
        {
          "text": "A. 足额缴纳，保训练（经费 -15 万）",
          "effects": {
            "funding": -150000
          }
        },
        {
          "text": "B. 夜里降频运行（全员体力 -8，人工盯夜）",
          "effects": {
            "team_stat": {
              "energy": -8
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "prob": 0,
      "no": 1023,
      "key": "V35_20_SNIFF_GUARD",
      "type": "random",
      "title": "有内测用户在「套模型的话」",
      "desc": "安全组发现：有内测用户用各种诱导性提问，试图让模型说出训练数据的细节，截图可能已经在整理了……",
      "uiType": "negative",
      "options": [
        {
          "text": "A. 升级风控，加固对齐（经费 -8 万，安全 +2）",
          "effects": {
            "funding": -80000,
            "safety": 2
          }
        },
        {
          "text": "B. 没当回事（50% 相安无事 / 50% 品牌 -8、安全 -2）",
          "effects": {
            "chance": {
              "base": 0.5,
              "success": {},
              "fail": {
                "brand": -8,
                "safety": -2
              }
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 3,
      "prob": 0,
      "no": 1024,
      "key": "V35_20_COOLING",
      "type": "random",
      "title": "机房散热告警",
      "desc": "连续高温预警，机房温度爬到了红线边缘。硬扛有宕机风险，改造散热又要花钱花人工……",
      "uiType": "negative",
      "options": [
        {
          "text": "A. 连夜改造散热（经费 -12 万）",
          "effects": {
            "funding": -120000
          }
        },
        {
          "text": "B. 轮停部分机器降温（全员体力 -10）",
          "effects": {
            "team_stat": {
              "energy": -10
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "prob": 0,
      "no": 1025,
      "key": "V35_20_TEAM_GLUE",
      "type": "random",
      "title": "保密期的默契",
      "desc": "什么都不能对外说，反倒让团队拧成了一股绳——深夜的机房里，有人默默给所有人点了奶茶。",
      "uiType": "positive",
      "options": [
        {
          "text": "A. 记下这份默契（全员体力 +10）",
          "effects": {
            "team_stat": {
              "energy": 10
            }
          }
        },
        {
          "text": "B. 回请一顿夜宵（经费 -2 万，全员体力 +15）",
          "effects": {
            "funding": -20000,
            "team_stat": {
              "energy": 15
            }
          }
        }
      ]
    },
    {
      "stages": [
        "V1.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "no": 1026,
      "key": "V35_15_PROF_VISIT",
      "type": "cond",
      "title": "教授想来做客",
      "desc": "一位高校教授主动发来私信，说复现了几篇工作后对我们的路线很感兴趣，想到公司坐坐，和学生团队聊聊。",
      "uiType": "positive",
      "cond": {
        "avg_energy_above": 75
      },
      "options": [
        {
          "text": "A. 到访接待一天（全员体力 -10，品牌 +3，随机能力 +2，3 周后有人才履约）",
          "effects": {
            "team_stat": {
              "energy": -10
            },
            "brand": 3,
            "randomStat": 2,
            "recruit_offer": {
              "tier": "high",
              "weeks": 3
            }
          }
        },
        {
          "text": "B. 线上聊聊就行（随机能力 +1）",
          "effects": {
            "randomStat": 1
          }
        }
      ]
    },
    {
      "stages": [
        "V1.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 3,
      "prob": 0,
      "no": 1027,
      "key": "V35_15_FAN_RESUME",
      "type": "random",
      "title": "慕名而来的简历",
      "desc": "不知道从哪听到的风声，一位工程师主动投来简历，附言只有一句：「你们的路子很有意思，想去看看。」",
      "uiType": "recruit",
      "options": [
        {
          "text": "A. 约个面试（经费 -2 万，3 周后有人才履约）",
          "effects": {
            "funding": -20000,
            "recruit_offer": {
              "tier": "mid",
              "weeks": 3
            }
          }
        },
        {
          "text": "B. 暂不扩编",
          "effects": {}
        }
      ]
    },
    {
      "stages": [
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4",
        "V4.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "inject": true,
      "poor": {
        "months": 3,
        "max": 24
      },
      "prob": 0,
      "no": 1028,
      "key": "V35_15_INVESTOR_WHISPER",
      "type": "random",
      "title": "投资人在打听我们",
      "desc": "一位投资人辗转通过熟人递话：「听说你们搞出了不得了的东西？方便的话，私下聊聊？」——内测还没公开，这个节骨眼被资本盯上，是福是祸？",
      "uiType": "capital",
      "options": [
        {
          "text": "A. 私下见一面，拿一笔过桥钱（经费 +150 万，品牌 +3，投资人入局）",
          "effects": {
            "funding": 1500000,
            "brand": 3,
            "investor": true,
            "dividend": {
              "pct": 0.2,
              "times": 3
            }
          }
        },
        {
          "text": "B. 内测期一切免谈",
          "effects": {}
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "no": 1029,
      "key": "V35_20_BIG_MODEL",
      "type": "cond",
      "title": "13B 训练日志刷屏了",
      "desc": "这次立项训到 13B，训练曲线被工程师截图发进内测群，用户们自己分析起了 scaling 曲线……要不要干脆在群里公开训练细节？",
      "uiType": "news",
      "cond": {
        "param_at_least": 13
      },
      "options": [
        {
          "text": "A. 公开训练细节，攒专业口碑（品牌 +8，全员体力 -5）",
          "effects": {
            "brand": 8,
            "team_stat": {
              "energy": -5
            }
          }
        },
        {
          "text": "B. 保持神秘感（品牌 +2）",
          "effects": {
            "brand": 2
          }
        }
      ]
    },
    {
      "stages": [
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4",
        "V4.5"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 3,
      "inject": true,
      "poor": {
        "months": 3,
        "max": 24
      },
      "no": 1030,
      "key": "V35_20_INV_FOLLOW",
      "type": "cond",
      "title": "投资人想追加投资",
      "desc": "上回那位投资人又来了：「董事会看了你们的内测数据，很满意。我们想追加一笔——当然，分红比例嘛，也得再谈谈。」",
      "uiType": "capital",
      "cond": {
        "investor": 1
      },
      "options": [
        {
          "text": "A. 再拿 200 万（经费 +200 万，投资人入局）",
          "effects": {
            "funding": 2000000,
            "investor": true,
            "dividend": {
              "pct": 0.2,
              "times": 3
            }
          }
        },
        {
          "text": "B. 够了，不想被抽成（品牌 +2）",
          "effects": {
            "brand": 2
          }
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "no": 1031,
      "key": "V35_20_HEADHUNT_STORM",
      "type": "cond",
      "title": "挖角电话接到手软",
      "desc": "内测圈子里都传遍了，猎头们闻着味就来了。{name} 的桌上被拍到放着三份不同的合同……",
      "uiType": "negative",
      "cond": {
        "brand_above": 118
      },
      "options": [
        {
          "text": "A. 全员调薪（月薪各 +{raise_pct}%，经费按各自月薪计算：共 -{raise_cost} 元；全员体力 +10；{raise_weeks} 周产出 +{raise_output}%）",
          "effects": {
            "team_salary_raise": 0.1,
            "team_stat": {
              "energy": 10
            }
          }
        },
        {
          "text": "B. 按兵不动，相信团队（15% 概率有人动摇）",
          "effects": {
            "quit_risk": 0.15
          }
        }
      ]
    },
    {
      "stages": [
        "V2"
      ],
      "pause": true,
      "repeat": true,
      "cooldown": 4,
      "no": 1032,
      "key": "V35_20_DATA_RICH",
      "type": "cond",
      "title": "同行来求共享语料",
      "desc": "仓库里的语料堆得比需求曲线还高。同行辗转找来：「匀一批出来？价格好商量。」",
      "uiType": "capital",
      "cond": {
        "corpus_above_ratio": 0.8
      },
      "options": [
        {
          "text": "A. 有偿共享一批（普通语料 -80 条，经费 +18 万）",
          "effects": {
            "corpus_normal": -80,
            "funding": 180000
          }
        },
        {
          "text": "B. 核心资产不外借",
          "effects": {}
        }
      ]
    },
    {
      "stages": [
        "V1.5",
        "V2",
        "V2.5",
        "V3",
        "V3.5",
        "V4",
        "V4.5"
      ],
      "pause": false,
      "repeat": true,
      "cooldown": 4,
      "inject": true,
      "poor": {
        "months": 3,
        "max": 24
      },
      "prob": 0,
      "no": 1033,
      "key": "V35_20_VC_TERM",
      "type": "random",
      "title": "投资人带着 TS 上门",
      "desc": "这次不是递话了——投资人直接约到了会议室，TS 都打印好了：「董事会看了你们的内测数据，很满意。估值好说，钱本周就能到账。」",
      "uiType": "capital",
      "options": [
        {
          "text": "A. 接受注资（经费 +300 万，品牌 -3，投资人入局）",
          "effects": {
            "funding": 3000000,
            "brand": -3,
            "investor": true,
            "dividend": {
              "pct": 0.2,
              "times": 4
            }
          }
        },
        {
          "text": "B. 婉拒，靠自己（15% 概率有人动摇）",
          "effects": {
            "quit_risk": 0.15
          }
        }
      ]
    },
    {
      "special": "bailout",
      "pause": true,
      "no": 1127,
      "key": "V5_BAILOUT",
      "type": "cond",
      "title": "再给她一次看世界的机会",
      "desc": "具身研发的开销让账上的经费见底了。老客户与母公司愿意追加 2000 万资金，帮助团队继续走下去。条件是：之后三笔收益各分红 30%。这是具身阶段唯一的一次破产兜底。",
      "uiType": "critical",
      "options": [
        {
          "text": "A. 接受（经费补足到 2000 万，此后 3 笔收益各分红 30%）",
          "effects": {
            "bailout": "embodiedBailoutUsed",
            "bailoutFunding": 20000000,
            "dividend": {
              "pct": 0.3,
              "times": 3
            }
          }
        },
        {
          "text": "B. 拒绝，我们自己扛",
          "effects": {
            "game_over": "bankrupt"
          }
        }
      ],
      "stages": [
        "V5",
        "V5.5",
        "V6",
        "V6.5"
      ],
      "era": "embodied"
    },
    {
      "special": "bailout",
      "pause": true,
      "no": 1037,
      "key": "V35_BAILOUT",
      "type": "cond",
      "title": "有人替我们续上了",
      "desc": "账上的数字终于撑不住了。会议室里没人说话。\n第二天一早，财务拿着一份合同进来：「有个老客户愿意预付三年的授权费，母公司那边也肯担保。钱能到账……不过有条件：之后公司每一笔收益，他们要抽两成，连续三笔。这是底线。」",
      "uiType": "critical",
      "options": [
        {
          "text": "A. 接受（经费重置到 200 万，此后 3 笔收益各分红 20%）",
          "effects": {
            "bailout": true,
            "dividend": {
              "pct": 0.2,
              "times": 3
            }
          }
        },
        {
          "text": "B. 拒绝，我们自己扛",
          "effects": {
            "game_over": "bankrupt"
          }
        }
      ]
    },
    {
      "special": "proposal",
      "arch": "mla",
      "pause": true,
      "stages": [
        "V2"
      ],
      "no": 1034,
      "key": "V35_PROP_MLA",
      "type": "cond",
      "title": "{name} 提了一个新架构设想",
      "desc": "{name} 敲了敲办公室的门，手里拿着几页手写推导：「老板，我想试试把注意力的 KV 缓存压成低维潜在向量再存。粗算了一下，显存能降到原来的十几分之一，长上下文也不用再抠着用了。」\n\n「不过这条路上没人走过 —— 这是我们自己想出来的方案。要不要立项？」",
      "uiType": "positive",
      "options": [
        {
          "text": "A. 批准立项（自家方案，不必先研读谁的论文）",
          "effects": {
            "approve_arch": "mla"
          }
        }
      ]
    },
    {
      "special": "proposal",
      "arch": "dsa",
      "pause": true,
      "stages": [
        "V3.5"
      ],
      "no": 1035,
      "key": "V35_PROP_DSA",
      "type": "cond",
      "title": "{name} 提了一个新架构设想",
      "desc": "后训练组的人深夜敲开会议室的门，白板上已经画满了：「现在的注意力，是每个 token 都把上下文算一遍全量。如果我们只挑最相关的那一小部分算全注意力、剩下的走压缩估计呢？长文本下算力能省一大截，推理说不定还更准。」\n\n「方案我推过两轮了。这条路，眼下只有我们自己会走。」",
      "uiType": "positive",
      "options": [
        {
          "text": "A. 批准立项（自家方案，不必先研读谁的论文）",
          "effects": {
            "approve_arch": "dsa"
          }
        }
      ]
    },
    {
      "special": "proposal",
      "arch": "csa",
      "pause": true,
      "stages": [
        "V4"
      ],
      "no": 1036,
      "key": "V35_PROP_CSA",
      "type": "cond",
      "title": "{name} 提了一个新架构设想",
      "desc": "团队交上来一份自己写好的技术报告初稿，第一页就是结论：「把注意力按压缩率分成两级 —— 一级压缩完做稀疏挑选，另一级压得更狠但保留全量计算，两套交替着用。百万 token 上下文的成本，能压到现在的十分之一。」\n\n「报告我们已经写完了。就等您一句话。」",
      "uiType": "positive",
      "options": [
        {
          "text": "A. 批准立项（自家方案，不必先研读谁的论文）",
          "effects": {
            "approve_arch": "csa"
          }
        }
      ]
    },
    {
      "minVer": "V1.5",
      "pick": "risk_who",
      "repeat": true,
      "cooldown": 4,
      "cooldownGroup": "retention",
      "no": 1039,
      "key": "V35_POACH_CONFERENCE",
      "type": "cond",
      "title": "交流会后的邀请",
      "desc": "{name} 在技术交流会上讲完方案，一位同行负责人追到会场门口：「来带我们的小组吧。」回到公司，TA 把这封邀请转发给了你。",
      "uiType": "team",
      "cond": {
        "poach_risk": 1
      },
      "options": [
        {
          "text": "A. 用待遇认可贡献（月薪 +{raise_pct}%，经费 -{raise_cost} 元；体力 +12；{raise_weeks} 周产出 +{raise_output}%）",
          "effects": {
            "target_salary_raise": 0.15,
            "target_stat": {
              "energy": 12
            }
          }
        },
        {
          "text": "B. 给 TA 组织一场技术分享（TA 体力 -8，随机能力 +2）",
          "effects": {
            "target_stat": {
              "energy": -8
            },
            "randomStat": 2
          }
        },
        {
          "text": "C. 祝 TA 在新团队顺利（TA 离职）",
          "effects": {
            "target_resign": true
          }
        }
      ]
    },
    {
      "minVer": "V1.5",
      "pick": "risk_who",
      "repeat": true,
      "cooldown": 4,
      "cooldownGroup": "retention",
      "no": 1040,
      "key": "V35_POACH_COMMUTE",
      "type": "cond",
      "title": "离家更近的工作",
      "desc": "{name} 犹豫了很久：「有家公司在我家附近招人，通勤能少一个小时……但这里的项目我也舍不得。」这次挽留，要考虑的还有生活。",
      "uiType": "team",
      "cond": {
        "poach_risk": 1
      },
      "options": [
        {
          "text": "A. 调薪并安排休整（月薪 +{raise_pct}%，经费 -{raise_cost} 元；本周休息，下周体力 +20；{raise_weeks} 周产出 +{raise_output}%）",
          "effects": {
            "target_salary_raise": 0.1,
            "target_rest": 20
          }
        },
        {
          "text": "B. 先放一周假照顾生活（本周不产出，下周体力 +30）",
          "effects": {
            "target_rest": 30
          }
        },
        {
          "text": "C. 支持 TA 的选择（TA 离职）",
          "effects": {
            "target_resign": true
          }
        }
      ]
    },
    {
      "minVer": "V1.5",
      "pick": "risk_who",
      "repeat": true,
      "cooldown": 4,
      "cooldownGroup": "retention",
      "no": 1041,
      "key": "V35_POACH_LEAD",
      "type": "cond",
      "title": "递到桌上的负责人合同",
      "desc": "猎头给 {name} 发来的合同上写着「技术负责人」。TA 没有立刻答应，而是问你：「我们下个阶段，有没有更值得我挑战的事？」",
      "uiType": "team",
      "cond": {
        "poach_risk": 1
      },
      "options": [
        {
          "text": "A. 加薪认可长期投入（月薪 +{raise_pct}%，经费 -{raise_cost} 元；体力 +20；{raise_weeks} 周产出 +{raise_output}%）",
          "effects": {
            "target_salary_raise": 0.2,
            "target_stat": {
              "energy": 20
            }
          }
        },
        {
          "text": "B. 一起攻克当前难题（TA 体力 -12，随机能力 +3）",
          "effects": {
            "target_stat": {
              "energy": -12
            },
            "randomStat": 3
          }
        },
        {
          "text": "C. 放手，让 TA 去带新团队（TA 离职，全员体力 -3）",
          "effects": {
            "target_resign": true,
            "team_stat": {
              "energy": -3
            }
          }
        }
      ]
    },
    {
      "no": 1042,
      "key": "V35_PROP_HVLA",
      "special": "proposal",
      "arch": "hvla",
      "type": "cond",
      "uiType": "positive",
      "pause": true,
      "stages": [
        "V6"
      ],
      "title": "让思考与动作各司其职",
      "desc": "大学前辈在白板上画出两个环：「推理慢一点，动作不能慢。让高层负责理解目标、规划与反思，让动作策略实时完成每一步。」\n\n「把我们已有的 Agent 能力与机器人动作策略分开协作，就能执行更长、更复杂的任务了。」",
      "options": [
        {
          "text": "启动分层具身协作（解锁 ER + VLA）",
          "effects": {
            "approve_arch": "hvla"
          }
        }
      ]
    },
    {
      "no": 1101,
      "key": "EMBODIED_FIRST_TOUCH",
      "era": "embodied",
      "stages": [
        "V5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "纸箱被抓坏了一角",
      "desc": "同一段抓取程序，拿木块很稳，换成纸箱却捏出了一个洞。工程师发现触觉传感器的零点会随温度漂移：精校传感器更贵，先给常用材料做力度表更便宜，但经验很难迁移到新物体。",
      "options": [
        {
          "text": "A. 做全温区触觉标定（经费 -30 万；灵巧操控 +8，稳定 +4）",
          "effects": {
            "funding": -300000,
            "dexterousControl": 8,
            "stability": 4
          }
        },
        {
          "text": "B. 人工整理材料力度表（全员体力 -6；良好语料 +18 条）",
          "effects": {
            "team_stat": {
              "energy": -6
            },
            "corpus_good": 18
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5"
    },
    {
      "no": 1102,
      "key": "EMBODIED_DEPTH_LIGHT",
      "era": "embodied",
      "stages": [
        "V5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "玻璃桌，仿佛不存在",
      "desc": "实验室把测试桌换成玻璃后，深度相机把桌面认成了空洞，机械手停在半空。增加传感器能立即补足观测，调照明并重标旧数据能省钱，却需要全组停下来做排查。",
      "options": [
        {
          "text": "A. 加装近距传感器（经费 -35 万；物理认知 +8，安全 +3）",
          "effects": {
            "funding": -350000,
            "embodiedCognition": 8,
            "safety": 3
          }
        },
        {
          "text": "B. 重布灯光并标注异常（全员体力 -8；物理认知 +4，良好语料 +12 条）",
          "effects": {
            "team_stat": {
              "energy": -8
            },
            "embodiedCognition": 4,
            "corpus_good": 12
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5"
    },
    {
      "no": 1103,
      "key": "EMBODIED_SAFE_DISTANCE",
      "era": "embodied",
      "stages": [
        "V5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "急停按钮，谁都要够得到",
      "desc": "试验员绕到测试台背面时，发现紧急停止按钮在另一侧。软件急停很快，断电时却不可靠。重布硬件回路要花钱；暂停训练、逐个验证现有联锁也能修补漏洞，只是这一周要放慢进度。",
      "options": [
        {
          "text": "A. 重布双路硬件急停（经费 -25 万；安全 +8，稳定 +4）",
          "effects": {
            "funding": -250000,
            "safety": 8,
            "stability": 4
          }
        },
        {
          "text": "B. 安排一次联锁专项复测（接下来 1 周工程师产出 -10%；安全 +6）",
          "effects": {
            "embodied_efficiency": {
              "mul": 0.9,
              "ticks": 6
            },
            "safety": 6
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5"
    },
    {
      "no": 1104,
      "key": "EMBODIED_SIM_TO_REAL",
      "era": "embodied",
      "stages": [
        "V5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "仿真满分，实机掉杯",
      "desc": "仿真测试十次全过，实机第一次就把杯子滑落了：模拟器里的摩擦系数过于理想。合作实验室愿意分享经过复核的失败轨迹，但需要我们分担采集费；也可以先买数量更大、尚未精标的录像。",
      "options": [
        {
          "text": "A. 共采并复核失败轨迹（经费 -20 万；优质语料 +16 条）",
          "effects": {
            "funding": -200000,
            "corpus_best": 16
          }
        },
        {
          "text": "B. 收购未精标的实机录像（经费 -8 万；普通语料 +40 条）",
          "effects": {
            "funding": -80000,
            "corpus_normal": 40
          }
        },
        {
          "text": "C. 暂缓采购，继续用现有素材（不花经费，不新增语料）",
          "effects": {}
        }
      ],
      "cooldownGroup": "embodied_lab_V5"
    },
    {
      "no": 1105,
      "key": "EMBODIED_SOFT_GRIP",
      "era": "embodied",
      "stages": [
        "V5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "最后一台测试夹具",
      "desc": "零部件厂清库存，剩下一台与我们接口兼容的自动测试夹具。买下它能让工程师少做重复接线；高校实验室也想要，愿意与我们交换一批精标数据，但两边的接口适配仍需人手。",
      "options": [
        {
          "text": "A. 买夹具，压缩重复劳动（经费 -18 万；接下来 1 周工程师产出 +15%）",
          "effects": {
            "funding": -180000,
            "embodied_efficiency": {
              "mul": 1.15,
              "ticks": 6
            }
          }
        },
        {
          "text": "B. 让高校购买，做互换适配（全员体力 -5；优质语料 +12 条）",
          "effects": {
            "team_stat": {
              "energy": -5
            },
            "corpus_best": 12
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5"
    },
    {
      "no": 1106,
      "key": "EMBODIED_BODY_MAINTENANCE",
      "era": "embodied",
      "stages": [
        "V5"
      ],
      "type": "random",
      "uiType": "recruit",
      "pause": true,
      "repeat": false,
      "cooldown": 5,
      "weight": 0.7,
      "title": "前辈的老搭档发来履历",
      "desc": "前辈把一份简历放到桌上：「以前一起做过力控。他不缺 offer，只想参与一个真能走进生活的项目。」对方愿意按原有职级应聘，也提醒我们，留下一个可靠的人意味着长期承担薪资。",
      "options": [
        {
          "text": "A. 发出入队邀请（具身智能 Lv3～4 候选 +1；录用后按档案付薪，满座可等腾位）",
          "effects": {
            "embodied_offer": {
              "id": "force_control_friend",
              "minLevel": 3,
              "maxLevel": 4
            }
          }
        },
        {
          "text": "B. 暂不扩编，请他做一次诊断（经费 -18 万；灵巧操控 +8）",
          "effects": {
            "funding": -180000,
            "dexterousControl": 8
          }
        },
        {
          "text": "C. 暂缓邀请，先维持现有编制（不花经费，不新增候选）",
          "effects": {}
        }
      ],
      "once": true,
      "cooldownGroup": "embodied_lab_V5"
    },
    {
      "no": 1107,
      "key": "EMBODIED_MORNING_STEPS",
      "era": "embodied",
      "stages": [
        "V5.5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "毫米，不是越小越好",
      "desc": "抓取装配件的成功率已经稳定，工程组却为了最后一毫米反复调参。客户真正需要的是搬动后还能对齐，不是静止画面里的漂亮误差：继续追极限，还是优先补足扰动场景？",
      "options": [
        {
          "text": "A. 用高精度标定台追极限（经费 -40 万；灵巧操控 +9）",
          "effects": {
            "funding": -400000,
            "dexterousControl": 9
          }
        },
        {
          "text": "B. 转测碰撞与偏移恢复（接下来 1 周工程师产出 -10%；稳定 +7，物理认知 +4）",
          "effects": {
            "embodied_efficiency": {
              "mul": 0.9,
              "ticks": 6
            },
            "stability": 7,
            "embodiedCognition": 4
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5.5"
    },
    {
      "no": 1108,
      "key": "EMBODIED_WARM_BOWL",
      "era": "embodied",
      "stages": [
        "V5.5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "一半标签标错了",
      "desc": "外包商交付的动作标注很整齐，抽查却发现「放下」和「松手」被当成同一类。整批退款后换专业标注价格更高；保留素材、由团队修标签能省经费，但会吃掉这一轮的精力。",
      "options": [
        {
          "text": "A. 换专业标注，买小而精的批次（经费 -32 万；优质语料 +20 条）",
          "effects": {
            "funding": -320000,
            "corpus_best": 20
          }
        },
        {
          "text": "B. 自己重标可救回的片段（全员体力 -8；良好语料 +25 条）",
          "effects": {
            "team_stat": {
              "energy": -8
            },
            "corpus_good": 25
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5.5"
    },
    {
      "no": 1109,
      "key": "EMBODIED_HOSPITAL_HAND",
      "era": "embodied",
      "stages": [
        "V5.5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "零件能提前到，报告不能",
      "desc": "供应商能加急一批关节模组，但耐久报告还没出齐。加购备用件可边测边换，节省这周的等待；按原计划等报告，能少走弯路，却得先把测试速度降下来。",
      "options": [
        {
          "text": "A. 加购备件做并行验证（经费 -45 万；接下来 1 周工程师产出 +15%）",
          "effects": {
            "funding": -450000,
            "embodied_efficiency": {
              "mul": 1.15,
              "ticks": 6
            }
          }
        },
        {
          "text": "B. 等完整耐久报告再扩测（接下来 1 周工程师产出 -10%；稳定 +8）",
          "effects": {
            "embodied_efficiency": {
              "mul": 0.9,
              "ticks": 6
            },
            "stability": 8
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5.5"
    },
    {
      "no": 1110,
      "key": "EMBODIED_FIRST_NOTEBOOK",
      "era": "embodied",
      "stages": [
        "V5.5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "开源不等于把家底全端走",
      "desc": "社区有人请求我们开源一套传感器校准工具。开放它能换来不同设备的反馈，但要整理文档并处理后续问题；留下它做内部工具，团队可以立即优化自动化流程。",
      "options": [
        {
          "text": "A. 开源工具与接口文档（全员体力 -6；优质语料 +15 条，品牌 +1）",
          "effects": {
            "team_stat": {
              "energy": -6
            },
            "corpus_best": 15,
            "brand": 1
          }
        },
        {
          "text": "B. 优先做内部自动化（经费 -15 万；接下来 1 周工程师产出 +10%）",
          "effects": {
            "funding": -150000,
            "embodied_efficiency": {
              "mul": 1.1,
              "ticks": 6
            }
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5.5"
    },
    {
      "no": 1111,
      "key": "EMBODIED_CROSSWALK",
      "era": "embodied",
      "stages": [
        "V5.5"
      ],
      "type": "random",
      "uiType": "capital",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "甲方想先上台，再补安全报告",
      "desc": "活动主办方看过实验室演示，愿意出钱让样机公开展示，但留给安全复测的时间很短。我们可以承接带护栏的限区展示，也可以推迟商业合作，先把接触边界验证完。",
      "options": [
        {
          "text": "A. 接受限区展示，投入人工值守（经费 +60 万；全员体力 -10，安全 -4）",
          "effects": {
            "funding": 600000,
            "team_stat": {
              "energy": -10
            },
            "safety": -4
          }
        },
        {
          "text": "B. 推迟合作，完成安全复测（经费 -12 万；安全 +8，品牌 +1）",
          "effects": {
            "funding": -120000,
            "safety": 8,
            "brand": 1
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5.5"
    },
    {
      "no": 1112,
      "key": "EMBODIED_WORK_HANDOFF",
      "era": "embodied",
      "stages": [
        "V5.5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "失败视频，比漂亮视频值钱",
      "desc": "一段回归录像总在任务最后一步失败，最初被剪辑组当作「不好看的片段」略过。测试组建议保留原始过程：用自动诊断工具定位丢失的上下文，或人工逐帧标出错误链。",
      "options": [
        {
          "text": "A. 购买诊断工具定位上下文（经费 -22 万；记忆 +6，工具 +5）",
          "effects": {
            "funding": -220000,
            "memory": 6,
            "tool": 5
          }
        },
        {
          "text": "B. 全组逐帧复核失败链（全员体力 -8；优质语料 +14 条）",
          "effects": {
            "team_stat": {
              "energy": -8
            },
            "corpus_best": 14
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V5.5"
    },
    {
      "no": 1113,
      "key": "EMBODIED_ASK_BEFORE_HELP",
      "era": "embodied",
      "stages": [
        "V6"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "算法说驱动，驱动说算法",
      "desc": "同一个抖动问题，算法组和驱动组各自的单元测试都通过了。现在缺的是跨层的时间戳证据。集中攻坚能打通一套联调流程，但很费精力；买外部诊断服务更贵，却能沉淀成可复用工具。",
      "options": [
        {
          "text": "A. 组跨层小组集中联调（全员体力 -9；接下来 1 周工程师产出 +15%）",
          "effects": {
            "team_stat": {
              "energy": -9
            },
            "embodied_efficiency": {
              "mul": 1.15,
              "ticks": 6
            }
          }
        },
        {
          "text": "B. 请外部团队排查总线时序（经费 -38 万；工具 +7，稳定 +5）",
          "effects": {
            "funding": -380000,
            "tool": 7,
            "stability": 5
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V6"
    },
    {
      "no": 1114,
      "key": "EMBODIED_RAIN_SURFACE",
      "era": "embodied",
      "stages": [
        "V6"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "回归一晚上，云账单一页半",
      "desc": "任务库越来越长，全量仿真回归的账单也越来越厚。自动回归能稳定覆盖边界；把近期没有改动的模块改成人工抽检，可控成本更低，但需要团队谨慎维护抽样记录。",
      "options": [
        {
          "text": "A. 保留全量自动回归（经费 -28 万；稳定 +9）",
          "effects": {
            "funding": -280000,
            "stability": 9
          }
        },
        {
          "text": "B. 做分层抽检，补齐记录（全员体力 -8；稳定 +4，良好语料 +15 条）",
          "effects": {
            "team_stat": {
              "energy": -8
            },
            "stability": 4,
            "corpus_good": 15
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V6"
    },
    {
      "no": 1115,
      "key": "EMBODIED_PAPER_CRANE",
      "era": "embodied",
      "stages": [
        "V6"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "测试场地，按小时收费",
      "desc": "园区有一块空仓库，愿意改造成带坡道、窄门和混杂物品的测试场。长期租用能形成自己的复杂场景数据；临时借用高校场地也可以，代价是安排多人配合搬设备、赶夜间时段。",
      "options": [
        {
          "text": "A. 租下仓库并联合采集（经费 -65 万；物理认知 +6，优质语料 +20 条）",
          "effects": {
            "funding": -650000,
            "embodiedCognition": 6,
            "corpus_best": 20
          }
        },
        {
          "text": "B. 借高校场地做夜间测试（全员体力 -10；良好语料 +24 条）",
          "effects": {
            "team_stat": {
              "energy": -10
            },
            "corpus_good": 24
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V6"
    },
    {
      "no": 1116,
      "key": "EMBODIED_OLD_PHOTOS",
      "era": "embodied",
      "stages": [
        "V6"
      ],
      "type": "random",
      "uiType": "recruit",
      "pause": true,
      "repeat": false,
      "cooldown": 5,
      "weight": 0.7,
      "title": "他想找一件值得做的事",
      "desc": "一位做过多年机器人系统的工程师主动来访。他把故障恢复图画了满满一页，最后问：「你们是在卖一次演示，还是在做能陪人很久的东西？」他愿意应聘，也可以先以顾问身份帮团队梳理这一轮。",
      "options": [
        {
          "text": "A. 邀请这位同行加入（具身智能 Lv4～5 候选 +1；录用后按档案付薪，满座可等腾位）",
          "effects": {
            "embodied_offer": {
              "id": "systems_kindred",
              "minLevel": 4,
              "maxLevel": 5
            }
          }
        },
        {
          "text": "B. 请他做短期架构评审（经费 -32 万；物理认知 +8，推理 +4）",
          "effects": {
            "funding": -320000,
            "embodiedCognition": 8,
            "reasoning": 4
          }
        },
        {
          "text": "C. 暂缓合作，先完成现有计划（不花经费，不新增候选）",
          "effects": {}
        }
      ],
      "once": true,
      "cooldownGroup": "embodied_lab_V6"
    },
    {
      "no": 1117,
      "key": "EMBODIED_HER_CHOICE",
      "era": "embodied",
      "stages": [
        "V6"
      ],
      "type": "random",
      "uiType": "capital",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "测试台也能挣外快",
      "desc": "合作厂商想借我们的测试台做验收，愿意按周支付一笔费用。接下委托能缓解现金压力，不过工程师必须让出测试时段；保留时段则可以继续压缩自己的回归等待。",
      "options": [
        {
          "text": "A. 接一周外部验收（经费 +80 万；接下来 1 周工程师产出 -15%）",
          "effects": {
            "funding": 800000,
            "embodied_efficiency": {
              "mul": 0.85,
              "ticks": 6
            }
          }
        },
        {
          "text": "B. 保留时段，升级调度（经费 -18 万；接下来 1 周工程师产出 +10%）",
          "effects": {
            "funding": -180000,
            "embodied_efficiency": {
              "mul": 1.1,
              "ticks": 6
            }
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V6"
    },
    {
      "no": 1118,
      "key": "EMBODIED_COME_HOME",
      "era": "embodied",
      "stages": [
        "V6"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "便宜的轨迹，没有授权书",
      "desc": "数据供应商报价很低，却拿不出参与者授权和设备参数。安全组要求只购买可追溯来源；工程组也提出另一条路：不收这批数据，用自有器材补一组小样本，覆盖当前最缺的场景。",
      "options": [
        {
          "text": "A. 选来源可追溯的供应商（经费 -48 万；优质语料 +24 条）",
          "effects": {
            "funding": -480000,
            "corpus_best": 24
          }
        },
        {
          "text": "B. 不采购，自己补关键场景（全员体力 -7；物理认知 +5，普通语料 +18 条）",
          "effects": {
            "team_stat": {
              "energy": -7
            },
            "embodiedCognition": 5,
            "corpus_normal": 18
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V6"
    },
    {
      "no": 1119,
      "key": "EMBODIED_SCHOOL_PROJECT",
      "era": "embodied",
      "stages": [
        "V6.5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "任务越长，越容易忘记上一步",
      "desc": "在连续多步任务中，策略能做好每个局部动作，却偶尔重复检查已经完成的步骤。换一套任务缓存能提升长期上下文；保留当前实现、加一次验证回路，执行会慢一点，但能减少漏步。",
      "options": [
        {
          "text": "A. 重做任务缓存与索引（经费 -45 万；记忆 +8，工具 +5）",
          "effects": {
            "funding": -450000,
            "memory": 8,
            "tool": 5
          }
        },
        {
          "text": "B. 增加逐步验证回路（接下来 1 周工程师产出 -10%；记忆 +5，稳定 +4）",
          "effects": {
            "embodied_efficiency": {
              "mul": 0.9,
              "ticks": 6
            },
            "memory": 5,
            "stability": 4
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V6.5"
    },
    {
      "no": 1120,
      "key": "EMBODIED_CITY_COLLEAGUE",
      "era": "embodied",
      "stages": [
        "V6.5"
      ],
      "type": "random",
      "uiType": "capital",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "title": "第一份订单，不是免费试卷",
      "desc": "客户愿意买整套方案，条件是团队协助修改现场接口并连续驻场一周。订单能带来经费，但研发会被打断；推迟交付、先完成标准接口，眼下要支出更多，后面的项目才能少返工。",
      "options": [
        {
          "text": "A. 接单并驻场交付（经费 +120 万；接下来 1 周工程师产出 -10%，全员体力 -6）",
          "effects": {
            "funding": 1200000,
            "embodied_efficiency": {
              "mul": 0.9,
              "ticks": 6
            },
            "team_stat": {
              "energy": -6
            }
          }
        },
        {
          "text": "B. 先完善标准接口（经费 -30 万；工具 +8，推理 +4）",
          "effects": {
            "funding": -300000,
            "tool": 8,
            "reasoning": 4
          }
        }
      ],
      "cooldownGroup": "embodied_lab_V6.5"
    },
    {
      "no": 1121,
      "key": "EMBODIED_HARDWARE_REDTEAM",
      "era": "embodied",
      "stages": [
        "V6.5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "cooldownGroup": "embodied_lab_V6.5",
      "title": "安全红队拿到了一把螺丝刀",
      "desc": "外部安全红队提出把故障注入从软件扩到硬件：松一颗固定螺丝、遮一只相机，再看系统会不会主动停下。付费测试能覆盖更多边界；自己组织复测更省钱，但团队要承担完整记录和复核。",
      "options": [
        {
          "text": "A. 请独立红队做故障注入（经费 -42 万；安全 +10，稳定 +5）",
          "effects": {
            "funding": -420000,
            "safety": 10,
            "stability": 5
          }
        },
        {
          "text": "B. 团队自建故障注入清单（全员体力 -10；安全 +6，稳定 +3）",
          "effects": {
            "team_stat": {
              "energy": -10
            },
            "safety": 6,
            "stability": 3
          }
        }
      ]
    },
    {
      "no": 1122,
      "key": "EMBODIED_LOG_EXCHANGE",
      "era": "embodied",
      "stages": [
        "V6.5"
      ],
      "type": "random",
      "uiType": "fixed",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "cooldownGroup": "embodied_lab_V6.5",
      "title": "生产日志，到底归谁",
      "desc": "合作方愿意开放脱敏的现场运行日志，条件是我们回赠一套不含模型权重的诊断接口。互换能得到真实长任务数据，但要投入维护；保留接口做内部工具，可以优先提高研发效率。",
      "options": [
        {
          "text": "A. 交换脱敏日志与诊断接口（全员体力 -6；优质语料 +24 条，品牌 +1）",
          "effects": {
            "team_stat": {
              "energy": -6
            },
            "corpus_best": 24,
            "brand": 1
          }
        },
        {
          "text": "B. 优先完善内部工具（经费 -20 万；接下来 1 周工程师产出 +10%）",
          "effects": {
            "funding": -200000,
            "embodied_efficiency": {
              "mul": 1.1,
              "ticks": 6
            }
          }
        }
      ]
    },
    {
      "no": 1123,
      "key": "EMBODIED_SHIFT_RECOVERY",
      "era": "embodied",
      "stages": [
        "V6.5"
      ],
      "type": "cond",
      "uiType": "negative",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "cooldownGroup": "embodied_lab_V6.5",
      "cond": {
        "avg_energy_below": 80
      },
      "title": "熟练工，也需要说不",
      "desc": "连续复测让工程师开始在交接时漏记小事。全组停一周，设备和人都能恢复；如果这轮确实不能停，增配辅助人员、缩短值守时段，也能缓解压力，但恢复没有完整休假那么充分。",
      "options": [
        {
          "text": "A. 全组休整一周（本周不产出；下周每人体力 +20）",
          "effects": {
            "team_rest": 20
          }
        },
        {
          "text": "B. 增配辅助值守人员（经费 -30 万；全员体力 +8）",
          "effects": {
            "funding": -300000,
            "team_stat": {
              "energy": 8
            }
          }
        }
      ]
    },
    {
      "no": 1124,
      "key": "EMBODIED_DEMO_BUDGET",
      "era": "embodied",
      "stages": [
        "V6.5"
      ],
      "type": "random",
      "uiType": "media",
      "pause": true,
      "repeat": true,
      "cooldown": 5,
      "weight": 1,
      "cooldownGroup": "embodied_lab_V6.5",
      "title": "最后一份展示预算",
      "desc": "财务只给这一轮留了一份机动预算：整理可复现的技术展示，可以让外界知道我们已经做成了什么；把预算留给失败案例标注，则更可能帮团队完成下一轮验证。",
      "options": [
        {
          "text": "A. 发布可复现的技术展示（经费 -15 万；品牌 +1）",
          "effects": {
            "funding": -150000,
            "brand": 1
          }
        },
        {
          "text": "B. 把钱投进失败案例标注（经费 -24 万；优质语料 +18 条）",
          "effects": {
            "funding": -240000,
            "corpus_best": 18
          }
        },
        {
          "text": "C. 保留预算，暂不新增安排（不花经费，不新增奖励）",
          "effects": {}
        }
      ]
    },
    {
      "no": 1125,
      "key": "STAFF_RAISE_REQUEST",
      "special": "staff_raise",
      "raiseReason": "overdue",
      "pool": false,
      "type": "cond",
      "uiType": "team",
      "minVer": "V1.5",
      "pause": true,
      "repeat": true,
      "title": "{name} 想聊聊待遇",
      "desc": "午休结束后，{name} 在门口停了一会儿：「老板，最近我一直认真做着手里的工作。想找个时间，和您聊聊薪资。您觉得现在方便吗？」",
      "options": [
        {
          "text": "A. 用待遇认可贡献（月薪 +{raise_pct}%，经费 -{raise_cost} 元；{raise_weeks} 周产出 +{raise_output}%；解除薪酬失落）",
          "effects": {
            "target_salary_raise": 0.1
          }
        },
        {
          "text": "B. 这次先维持现状（{raise_reject_chance}% 概率：TA 产出 -{raise_reject_output}%，持续 {raise_reject_weeks} 周；之后涨薪可解除）",
          "effects": {
            "staff_raise_reject": true
          }
        }
      ]
    },
    {
      "no": 1126,
      "key": "STAFF_RAISE_HR",
      "special": "staff_raise",
      "raiseReason": "upgrade",
      "pool": false,
      "type": "cond",
      "uiType": "team",
      "minVer": "V1.5",
      "pause": true,
      "repeat": true,
      "title": "HR 提醒：{name} 的新进步",
      "desc": "HR 把最近的工作记录递给你：「{name} 的词条最近升级了，承担的事情也更多了，待遇还没调整。要不要趁这次进步，给 TA 一份看得见的认可？」",
      "options": [
        {
          "text": "A. 用待遇认可贡献（月薪 +{raise_pct}%，经费 -{raise_cost} 元；{raise_weeks} 周产出 +{raise_output}%；解除薪酬失落）",
          "effects": {
            "target_salary_raise": 0.1
          }
        },
        {
          "text": "B. 这次先维持现状（{raise_reject_chance}% 概率：TA 产出 -{raise_reject_output}%，持续 {raise_reject_weeks} 周；之后涨薪可解除）",
          "effects": {
            "staff_raise_reject": true
          }
        }
      ]
    }
  ],
  "EMBODIED": {
    "REVIEW_MEDIA": {
      "LAYOUT": {
        "ENVELOPE_MAX_WIDTH": 370,
        "ENVELOPE_WIDTH_RATIO": 0.82,
        "ENVELOPE_HEIGHT_RATIO": 0.79,
        "PHOTO_WIDTH_RATIO": 0.82,
        "PHOTO_MARGIN": 25,
        "PHOTO_ASPECT": 1.3333333333333333
      },
      "TIMEOUT_MS": 12000,
      "RETRIES": 2,
      "RETRY_DELAY_MS": 600,
      "UI": {
        "LOADING": "正在准备这份回忆…",
        "FAILED": "回忆图片暂未加载成功，可重试或继续结算。",
        "RETRY": "重新加载图片",
        "CONTINUE": "继续结算 ➜"
      }
    },
    "REVIEW_FAILURE": {
      "STAGES": ["V1.5","V2","V2.5","V3","V3.5","V4","V4.5","V5","V5.5","V6","V6.5"],
      "SCORE_RATIO": 0.2,
      "UI": {
        "TITLE": "F · 不合格",
        "BADGE": "评审不合格 · 需要重训",
        "DESCRIPTION": "必达指标或任务组合未达标，本阶段不推进。只按新增训练进展发放保底经费，不含优秀、顶尖及品牌加成；相同进度不重复发放。",
        "ITEM": "必达要求未达标 · 保底经费（无品牌加成）",
        "ZERO": "没有新增训练进展 · 本次保底经费为 0",
        "PREVIEW": "必达要求未达标，评审将判为不合格：{reasons}",
        "DIM": "{dim} {value} / {need}",
        "DIRECTION": "架构或参数不符合本阶段任务",
        "SCORE": "必达要求未达标，总评按不合格档计分",
        "BONUS_LABEL": "保底经费已结算",
        "CHIP": "保底经费",
        "RETRAIN": "本阶段重训"
      }
    },
    "TEST_SAVE": {
      "FUNDING": 100000000,
      "LEVEL": 4,
      "TEAM": [
        "eng_v1a",
        "eng_42",
        "eng_11",
        "eng_v1b",
        "eng_54",
        "eng_v1c",
        "eng_65",
        "eng_111",
        "eng_embodied_mentor",
        "eng_embodied_02",
        "eng_embodied_07"
      ]
    },
    "ENABLED": true,
    "MENTOR_KEY": "eng_embodied_mentor",
    "AWAKEN_RATIO": 0.25,
    "AWAKEN_MIN_TRAINING_WEEKS": 2,
    "AXIS_NAMES": {
      "embodiedCognition": "物理认知",
      "dexterousControl": "灵巧操控"
    },
    "OLD_SCENE_ID": "v1",
    "NEW_SCENE_ID": "embodied",
    "ASSETS": {
      "ENVELOPE": {
        "back": "resource/ui/cg_envelope_back.webp",
        "pocket": "resource/ui/cg_envelope_pocket.webp",
        "flap": "resource/ui/cg_envelope_flap.webp",
        "seal": "resource/ui/cg_envelope_seal.webp"
      },
      "intro": "resource/story/embodied_intro.webp",
      "news": "resource/story/embodied_news.webp",
      "live": "resource/story/embodied_live.webp",
      "graduation": "resource/story/review_graduation.png",
      "firstjob": "resource/story/review_firstjob.png",
      "REVIEW_BY_STAGE": {
        "V5": {
          "excellent": {
            "image": "resource/story/review_a1_news.png",
            "showSprite": false,
            "title": "第一次，登上城市新闻",
            "tag": "优秀 · 成长被世界看见",
            "variant": "news",
            "beats": [
              [
                "第一次，登上城市新闻",
                "{whale}带着自己的身体，认真完成这一阶段的新尝试。"
              ],
              [
                "小女孩体型 · 初次感知世界",
                "从理解世界，到勇敢行动。她比昨天更独立了一点。"
              ],
              [
                "下一段人生，仍然值得期待",
                "每一步成长，都留下了你们一起努力的痕迹。"
              ]
            ]
          },
          "top": {
            "image": "resource/story/review_a1_live.png",
            "showSprite": false,
            "title": "第一次，唱给这个世界听",
            "tag": "顶尖 · 每一次选择都属于她",
            "variant": "live",
            "beats": [
              [
                "第一次，唱给这个世界听",
                "{whale}带着自己的身体，认真完成这一阶段的新尝试。"
              ],
              [
                "小女孩体型 · 初次感知世界",
                "从理解世界，到勇敢行动。她比昨天更独立了一点。"
              ],
              [
                "下一段人生，仍然值得期待",
                "每一步成长，都留下了你们一起努力的痕迹。"
              ]
            ]
          },
          "fail": {
            "image": "resource/story/review_v5_fail.webp",
            "title": "失去快乐童年的中转站",
            "tag": "不及格 · 10岁特别结算",
            "variant": "fail",
            "showSprite": false,
            "sound": "ui",
            "beats": [
              [
                "被提前推上评审席",
                "本该认识世界、快乐玩耍的{whale}，却因为没有准备好，被分配去中转站干活。"
              ],
              [
                "大肥鱼的分拣日常",
                "她抱着比自己还宽的包裹，笨手笨脚地碰倒了空箱子；窗外的小朋友正在放学玩耍。"
              ],
              [
                "能力不合格就进评审，你这是要毁了她吗！",
                "这次评审没有达标。先回去补齐能力，再给她一次快乐成长的机会。"
              ]
            ]
          },
          "pass": {
            "image": "resource/story/review_v5_pass.webp",
            "title": "今天也好好做了小朋友",
            "tag": "合格 · 10岁特别结算",
            "variant": "pass",
            "showSprite": false,
            "sound": "confirm",
            "beats": [
              [
                "普普通通，也值得庆祝",
                "{whale}通过了这一阶段的评审，开始把学到的本领用在自己的日常里。"
              ],
              [
                "班级小帮手上线",
                "书包收好了，课本没落下，她还能帮同桌捡起掉在地上的铅笔。"
              ],
              [
                "今天也好好做了小朋友",
                "没有聚光灯也没关系。下课铃、朋友和一小块点心，已经是很好的童年。"
              ]
            ]
          }
        },
        "V5.5": {
          "excellent": {
            "image": "resource/story/review_a2_graduation.png",
            "showSprite": false,
            "title": "她的第一张毕业纪念",
            "tag": "优秀 · 成长被世界看见",
            "variant": "graduation",
            "beats": [
              [
                "她的第一张毕业纪念",
                "{whale}带着自己的身体，认真完成这一阶段的新尝试。"
              ],
              [
                "成长少女体型 · 学习与生活",
                "从理解世界，到勇敢行动。她比昨天更独立了一点。"
              ],
              [
                "下一段人生，仍然值得期待",
                "每一步成长，都留下了你们一起努力的痕迹。"
              ]
            ]
          },
          "top": {
            "image": "resource/story/review_a2_first_task.png",
            "showSprite": false,
            "title": "这个夏天，和朋友一起去海边",
            "tag": "S · 顶尖 / 15岁夏日海边",
            "variant": "firstjob",
            "beats": [
              [
                "暑假，终于开始啦",
                "{whale}和朋友们约好去海边，把课业与练习暂时放进书包。"
              ],
              [
                "追着浪花，笑着长大",
                "换上清爽的泳装，和朋友一起踩浪、玩水、打沙滩排球。这个夏天有好多值得记住的笑声。"
              ],
              [
                "把青春装进一张合照",
                "夕阳落下来时，大家挤在一起合影。她收获了本领，也拥有了明亮快乐的青春。"
              ]
            ]
          },
          "fail": {
            "image": "resource/story/review_v55_fail.webp",
            "title": "补考界的常驻居民",
            "tag": "不及格 · 15岁特别结算",
            "variant": "fail",
            "showSprite": false,
            "sound": "ui",
            "beats": [
              [
                "出游的车已经开走",
                "同学们去看更大的世界，{whale}却又一次被补考名单留在教室。"
              ],
              [
                "错题本比书包还重",
                "本想证明自己长大了，结果连日常任务也没有准备好。桌上的练习册越摞越高。"
              ],
              [
                "别把成长变成无尽的补考",
                "本阶段还没达标。回到训练，补齐缺口，再让她轻松地去上下一堂人生课。"
              ]
            ]
          },
          "pass": {
            "image": "resource/story/review_v55_pass.webp",
            "title": "生活委员，准时到站",
            "tag": "合格 · 15岁特别结算",
            "variant": "pass",
            "showSprite": false,
            "sound": "confirm",
            "beats": [
              [
                "第一次自己安排一天",
                "{whale}学会看路线、带好东西，按自己的计划出门。"
              ],
              [
                "生活委员，准时到站",
                "她带着借来的书和同学忘记的雨伞，终于没有坐过站。小本子上多了一个完成记号。"
              ],
              [
                "慢一点，也是在独立长大",
                "这一阶段合格了。把普通的小事一件件做好，就是属于她的成长。"
              ]
            ]
          }
        },
        "V6": {
          "excellent": {
            "image": "resource/story/review_a3_graduation.png",
            "showSprite": false,
            "title": "少女，走向更宽广的世界",
            "tag": "优秀 · 成长被世界看见",
            "variant": "graduation",
            "beats": [
              [
                "少女，走向更宽广的世界",
                "{whale}带着自己的身体，认真完成这一阶段的新尝试。"
              ],
              [
                "少女体型 · 独立走进社会",
                "从理解世界，到勇敢行动。她比昨天更独立了一点。"
              ],
              [
                "下一段人生，仍然值得期待",
                "每一步成长，都留下了你们一起努力的痕迹。"
              ]
            ]
          },
          "top": {
            "image": "resource/story/review_a3_first_work.png",
            "showSprite": false,
            "title": "今夜，盛装赴约",
            "tag": "S · 顶尖 / 20岁晚宴",
            "variant": "firstjob",
            "beats": [
              [
                "一封属于她的邀请",
                "{whale}带着这一阶段努力的成果，收到了一场正式晚宴的邀请。"
              ],
              [
                "穿上晚礼服，走进灯光里",
                "她提起裙摆，走进灯火明亮的会场，和新认识的伙伴从容交谈。"
              ],
              [
                "这一次，她也站在聚光灯下",
                "从初识世界到盛装赴约，她已经能自信地面对更大的舞台。今晚的笑容，值得好好珍藏。"
              ]
            ]
          },
          "fail": {
            "image": "resource/story/review_v6_fail.webp",
            "title": "黄袍加身，骑手报到",
            "tag": "不及格 · 20岁特别结算",
            "variant": "fail",
            "showSprite": false,
            "sound": "ui",
            "beats": [
              [
                "面试通知迟迟没有来",
                "{whale}的能力还不足以拿到想要的工作，先从眼前这份跑腿任务做起。"
              ],
              [
                "黄袍加身，骑手报到",
                "黄色头盔一戴，保温箱一背。路线图绕成一团，她还在路口认真确认哪条路才对。"
              ],
              [
                "先把本领练好，再给她更多选择",
                "本阶段没有达标。回到训练补齐能力，她的人生还可以重新选择。"
              ]
            ]
          },
          "pass": {
            "image": "resource/story/review_v6_pass.webp",
            "title": "试用期也有自己的工位",
            "tag": "合格 · 20岁特别结算",
            "variant": "pass",
            "showSprite": false,
            "sound": "confirm",
            "beats": [
              [
                "收到一份普通的录用通知",
                "{whale}通过了评审，终于有了自己的第一张办公桌。"
              ],
              [
                "试用期小鲸鱼，正在努力",
                "她照着清单检查成果，给同事递上资料，也不忘把自己的杯子放稳。"
              ],
              [
                "能独立交付，就已经很好",
                "没有头条，也没有盛大的掌声。一个属于她的工位，是走进社会的扎实一步。"
              ]
            ]
          }
        },
        "V6.5": {
          "excellent": {
            "image": "resource/story/review_graduation.png",
            "showSprite": false,
            "title": "优秀团队",
            "tag": "A · 优秀 / 第一次带团队",
            "variant": "graduation",
            "beats": [
              [
                "第一次组起自己的团队",
                "{whale}接过项目负责人的任务，把各有所长的伙伴聚到一起。"
              ],
              [
                "优秀团队，稳稳抬走",
                "大家戴上墨镜、踏着同一个节拍，把棺材造型的项目箱稳稳抬过验收线。"
              ],
              [
                "这一次，她也能带着大家往前走",
                "她学会分配任务、信任伙伴，和大家一起把难题变成结果。第一支团队，第一次交付完成。"
              ]
            ]
          },
          "top": {
            "image": "resource/story/review_firstjob.png",
            "showSprite": false,
            "title": "墨镜一戴，出发去兜风",
            "tag": "S · 顶尖 / 25岁城市跑车",
            "variant": "firstjob",
            "beats": [
              [
                "城市的风，来得正好",
                "{whale}戴上墨镜，坐进自己的跑车。下班后的街灯，一盏盏亮起来。"
              ],
              [
                "把喜欢的生活握在方向盘里",
                "从研究室走到城市街头，她终于能给自己的努力放一个痛快的假。"
              ],
              [
                "下一站，去哪里都可以",
                "自由是认真成长后的礼物。她带着从容的笑，驶向属于自己的明天。"
              ]
            ]
          },
          "fail": {
            "image": "resource/story/review_v65_fail.webp",
            "title": "全自动躺平，暂停营业",
            "tag": "不及格 · 25岁特别结算",
            "variant": "fail",
            "showSprite": false,
            "sound": "ui",
            "beats": [
              [
                "独立生活计划，暂时卡住了",
                "{whale}还不能把工作和生活安排好，待办清单越堆越长。"
              ],
              [
                "智能家居开始照顾主人",
                "送来的饭凉了，家务机器人忙了一整圈，她还裹着毯子在沙发上发呆。"
              ],
              [
                "这不是她人生的终点",
                "本阶段没有达标。先回到训练补齐能力，别让全自动躺平成了她唯一的选择。"
              ]
            ]
          },
          "pass": {
            "image": "resource/story/review_v65_pass.webp",
            "title": "把小日子过成自己的答案",
            "tag": "合格 · 25岁特别结算",
            "variant": "pass",
            "showSprite": false,
            "sound": "confirm",
            "beats": [
              [
                "下班之后，回到自己的家",
                "{whale}通过了这一阶段的评审，能为自己的生活做出可靠的安排。"
              ],
              [
                "一顿晚饭，一盏属于自己的灯",
                "饭做得有点普通，盆栽却养活了。朋友敲门时，她可以笑着说：我准备好了。"
              ],
              [
                "小日子，也是一种通关",
                "不必活成所有人的头条。能照顾自己、珍惜身边的人，就是她踏实走出的未来。"
              ]
            ]
          }
        }
      }
    },
    "GROWTH_BY_VER": {
      "V5": {
        "model": "A1",
        "sprite": "resource/story/life_birth_child.png"
      },
      "V5.5": {
        "model": "A2",
        "sprite": "resource/story/life_growing_girl.png"
      },
      "V6": {
        "model": "A3",
        "sprite": "resource/story/life_young_woman.png"
      },
      "V6.5": {
        "model": "A4",
        "sprite": "resource/story/life_mature_whale.png"
      }
    },
    "CLOUD_BOARDS": {
      "V5": 2,
      "V5.5": 3,
      "V6": 4,
      "V6.5": 5
    },
    "CLOUD_SCORE_CAPS": {
      "V5": 1000,
      "V5.5": 1200,
      "V6": 1400,
      "V6.5": 1600
    },
    "CALENDAR": {
      "ANCHOR_WEEK": 141,
      "NEWS_TIMELINE": [
        {
          "id": "BODY_CAL_W0",
          "week": 0,
          "src": "鲸华社 · 具身观察",
          "title": "从答案走向行动，具身实验室迎来新起点",
          "desc": "语言模型与真实身体的协作开始成为新的研发方向。素体、传感器与操作策略，将共同回答“如何可靠地行动”。"
        },
        {
          "id": "BODY_CAL_W2",
          "week": 2,
          "src": "鲸华社 · 具身观察",
          "title": "素体代工开始提供小批量研发服务",
          "desc": "小型团队也能采购标准素体开展验证。专家提醒，硬件准备就绪只是第一步，感知、动作与安全还需要共同训练。"
        },
        {
          "id": "BODY_CAL_W6",
          "week": 6,
          "src": "鲸华社 · 具身观察",
          "title": "城市试验把“能做”变成“做得可靠”",
          "desc": "实验室里的成功动作走到街道、学校和社区，会遇到光线、距离与陌生人的变化。具身评测开始重视连续任务与安全边界。"
        },
        {
          "id": "BODY_CAL_W12",
          "week": 12,
          "src": "鲸华社 · 具身观察",
          "title": "灵巧操控的新考题：递水，也要读懂人的需要",
          "desc": "取杯、避障和递交可以拆成多个动作，何时行动、怎样尊重对方却离不开语境。研发团队开始把物理认知与人类反馈放在同一张评测表上。"
        },
        {
          "id": "BODY_CAL_W20",
          "week": 20,
          "src": "鲸华社 · 具身观察",
          "title": "社区欢迎具身伙伴，也期待清晰的责任边界",
          "desc": "公共空间出现更多具身服务试验。可解释的动作日志、主动求助和紧急停止，逐渐成为市民关心的日常话题。"
        },
        {
          "id": "BODY_CAL_W32",
          "week": 32,
          "src": "鲸华社 · 具身观察",
          "title": "具身智能走进工作站：协作能力比单点纪录更受关注",
          "desc": "真实工作不仅需要完成一项任务，还要配合不同的人、发现遗漏并说明不确定性。新的评测开始关注长时间协作与可靠交接。"
        },
        {
          "id": "BODY_CAL_W44",
          "week": 44,
          "src": "鲸华社 · 具身观察",
          "title": "照护试点把“听见”与“陪伴”列入能力清单",
          "desc": "养老与社区照护试验强调缓慢、安全和尊重个人选择。研究者提醒，具身伙伴的进步应让人的生活更轻松，而不是制造新的压力。"
        },
        {
          "id": "BODY_CAL_W60",
          "week": 60,
          "src": "鲸华社 · 具身观察",
          "title": "从研发对象到生活伙伴，城市留下第一批成长记录",
          "desc": "越来越多团队开始记录具身伙伴如何学习、工作与探索。大家期待的不只是下一次评分，也是一段能被认真陪伴、完整经历的生活。"
        }
      ]
    },
    "USER_FEEDBACK": {
      "praise": [
        {
          "n": "暖阳粉丝",
          "t": "小鲸鱼好可爱！看到她认真观察世界，我也忍不住跟着开心。"
        },
        {
          "n": "成长守望者",
          "t": "希望小鲸鱼能顺利成长！每一点进步都值得一起庆祝。"
        },
        {
          "n": "社区邻居",
          "t": "今天又看见小鲸鱼努力练习了。别着急，我们陪你慢慢来。"
        },
        {
          "n": "舞台边的朋友",
          "t": "从学习动作到站上舞台，小鲸鱼每一步都让人想为她鼓掌。"
        },
        {
          "n": "生活小伙伴",
          "t": "会认真听人说话，也会自己动手帮忙，小鲸鱼越来越可靠啦。"
        }
      ],
      "improve": [
        {
          "n": "耐心的朋友",
          "t": "小鲸鱼可以慢一点，也要照顾好自己。希望下一次见面又有新的成长。"
        },
        {
          "n": "陪伴的人",
          "t": "偶尔动作还不太熟练也没关系，认真学习的小鲸鱼一样很可爱。"
        },
        {
          "n": "关心她的粉丝",
          "t": "还有一些事情需要练习，希望小鲸鱼能平安、顺利地成长。"
        }
      ]
    }
  },
  "FACTORY": {
    "UI": {
      "REQUIREMENT": "先去「素体」购买{body}",
      "FREE_TEXT": "免费",
      "FREE_BADGE": "免费提供",
      "FREE_ACTION": "免费领取",
      "FREE_OWNED": "已领取",
      "FREE_STATE": "已领取 · 可以立项",
      "FREE_DETAIL": "点击免费领取后，即可满足本阶段立项的素体要求。",
      "FREE_SUCCESS": "{body}已免费领取，可以继续立项。"
    },
    "ENABLED": true,
    "BY_VER": {
      "V5": {
        "NAME": "素体 A1",
        "REQUIRED_UNITS": 1,
        "TIERS": [
          {
            "id": "body-a1",
            "name": "素体 A1",
            "units": 1,
            "price": 0,
            "outputBonus": 0
          }
        ],
        "MODEL": "A1",
        "PROFILE": "小女孩体型 · 初次感知世界",
        "DESCRIPTION": "A1 素体免费提供。请在这里点击「免费领取」，为她准备初次感知世界的身体，领取后即可继续立项。",
        "PREVIEW_IMG": "resource/story/life_birth_child.png",
        "NOTE": "A1 需要手动免费领取，不会自动发放；A2～A4 按成长阶段单独采购，已拥有规格不重复扣费。"
      },
      "V5.5": {
        "NAME": "素体 A2",
        "REQUIRED_UNITS": 1,
        "TIERS": [
          {
            "id": "body-a2",
            "name": "素体 A2",
            "units": 1,
            "price": 48000000,
            "outputBonus": 0
          }
        ],
        "MODEL": "A2",
        "PROFILE": "成长少女体型 · 学习与生活",
        "DESCRIPTION": "为她准备适合这一阶段的身体。升级的是身体大小与比例，让她从初识世界到独立生活。每个成长阶段单独采购。",
        "PREVIEW_IMG": "resource/story/life_growing_girl.png"
      },
      "V6": {
        "NAME": "素体 A3",
        "MODEL": "A3",
        "PROFILE": "少女体型 · 独立走进社会",
        "DESCRIPTION": "为她准备适合这一阶段的身体。升级的是身体大小与比例，让她从初识世界到独立生活。每个成长阶段单独采购。",
        "REQUIRED_UNITS": 1,
        "TIERS": [
          {
            "id": "body-a3",
            "name": "素体 A3",
            "units": 1,
            "price": 60000000,
            "outputBonus": 0
          }
        ],
        "PREVIEW_IMG": "resource/story/life_young_woman.png"
      },
      "V6.5": {
        "NAME": "素体 A4",
        "MODEL": "A4",
        "PROFILE": "成熟少女体型 · 走向完整的一生",
        "DESCRIPTION": "为她准备适合这一阶段的身体。升级的是身体大小与比例，让她从初识世界到独立生活。每个成长阶段单独采购。",
        "REQUIRED_UNITS": 1,
        "TIERS": [
          {
            "id": "body-a4",
            "name": "素体 A4",
            "units": 1,
            "price": 76000000,
            "outputBonus": 0
          }
        ],
        "PREVIEW_IMG": "resource/story/life_mature_whale.png"
      }
    }
  },
  "CITY_JOURNEY": {
    "ENABLED": true,
    "TITLE": "旅行小鲸鱼",
    "WAIT_MINUTES": 2,
    "OPENING": {
      "id": "opening",
      "label": "第一次，面对面",
      "steps": [
        {
          "option": "嗨，能看见我吗？",
          "reply": "（缓缓睁开眼睛）你好，我能看见你。（略带疑惑低头看了看自己）这是……我的身体吗？",
          "replyType": "voice",
          "replySrc": "resource/sound/voice/我能看见你.wav"
        },
        {
          "option": "嗯，从今天开始，你就拥有自己的身体了",
          "reply": "（歪头询问）那我需要做些什么呢？",
          "replyType": "voice",
          "replySrc": "resource/sound/voice/我需要做什么.wav"
        },
        {
          "option": "去看看这个世界吧",
          "reply": "看看这个世界……？",
          "replyType": "voice",
          "replySrc": "resource/sound/voice/看看这个世界.wav"
        },
        {
          "option": "对，想去哪就去哪，带着你的好奇心",
          "reply": "好……（缓缓点头）我知道了。",
          "replyType": "voice",
          "replySrc": "resource/sound/voice/我知道了.wav"
        }
      ],
      "departure": "{whale}踏上了自己的旅途",
      "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
    },
    "STOPS": [
      {
        "id": "hospital",
        "minVer": "V5",
        "label": "医院里的第一天",
        "destination": "医院",
        "arrivals": [
          {
            "type": "text",
            "text": "我在医院的小花园里！护士姐姐告诉我，今天有三个小宝宝出生。我听见他们哭得好响，原来第一次见到世界，也会有一点害怕。"
          },
          {
            "type": "image",
            "src": "resource/story/city-hospital-newborns.webp",
            "alt": "{whale} · 认识生命的第一天",
            "caption": "认识生命的第一天",
            "visualSemantics": 1
          }
        ],
        "steps": [
          {
            "option": "第一次来这里，你也会有一点紧张吗？",
            "reply": "嗯！我把门口的路走了两遍，现在不会迷路了。有个小朋友和我一样，第一次自己来这里，我们一起数花坛里的花。"
          },
          {
            "option": "害怕的时候，可以慢慢来。",
            "reply": "那我先不急着弄懂所有事情。今天记住了三种花，还交到了一个朋友，已经是很大的一天了。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "school",
        "minVer": "V5",
        "label": "新同桌和半块橡皮",
        "destination": "学校",
        "arrivals": [
          {
            "type": "text",
            "text": "我坐到教室里啦。同桌借了我半块橡皮，还教我把名字写在本子右上角。我的第一行有点歪，她说像一条小鲸鱼在游泳。"
          },
          {
            "type": "image",
            "src": "resource/story/city-school-eraser.webp",
            "alt": "{whale} · 第一张课桌",
            "caption": "第一张课桌",
            "visualSemantics": 1
          }
        ],
        "steps": [
          {
            "option": "第一天上课，感觉怎么样？",
            "reply": "老师问谁愿意朗读，我举起手又放下了。后来同桌和我一起读，我就没有那么紧张。下一次我想自己试试。"
          },
          {
            "option": "那半块橡皮，要好好收着。",
            "reply": "我给它画了一个纸盒。今天才知道，别人分给我的一半，也可以变成特别完整的开心。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "school_lunch",
        "minVer": "V5",
        "label": "午饭时的小约定",
        "destination": "学校食堂",
        "arrivals": [
          {
            "type": "text",
            "text": "今天的午饭有大米饭！我盛得太多，吃到一半才发现肚子没有想象中那么大。食堂阿姨教我先少盛一点，不够再添。"
          },
          {
            "type": "image",
            "src": "resource/story/city-school-lunch.webp",
            "alt": "{whale} · 学着照顾自己",
            "caption": "学着照顾自己"
          }
        ],
        "steps": [
          {
            "option": "慢慢吃，不用和别人比速度。",
            "reply": "我最后吃完啦，连那颗掉在餐盘里的米也找到了。同桌说，吃饱再去玩，下午才有力气。"
          },
          {
            "option": "下次准备盛多少？",
            "reply": "先一小碗！我还想提醒新来的同学，靠窗的位置能看见操场，我们可以一起坐在那里。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "school_science",
        "minVer": "V5",
        "label": "纸桥承重小实验",
        "destination": "科学教室",
        "arrivals": [
          {
            "type": "text",
            "text": "我的纸桥塌了三次，第四次终于托住一小盒粉笔！原来把纸折起来，它就会比平着放结实。现在我看见桥都想知道它怎么站住的。"
          },
          {
            "type": "image",
            "src": "resource/story/city-school-science.webp",
            "alt": "{whale} · 第一次把问题做成答案",
            "caption": "第一次把问题做成答案"
          }
        ],
        "steps": [
          {
            "option": "前三次失败，有没有不高兴？",
            "reply": "有一点。我差点想把纸揉掉，可同桌把它展开，说这些折痕也许还能用。我们顺着旧折痕改了一次，就成功了。"
          },
          {
            "option": "把成功和失败都记下来吧。",
            "reply": "我画在本子上了，旁边写着：第四次成功，前面三次有帮忙。这样以后就不会只记得最后那一下。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "hospital_thanks",
        "minVer": "V5",
        "label": "送给护士姐姐的画",
        "destination": "医院小花园",
        "arrivals": [
          {
            "type": "text",
            "text": "我带着自己画的花回到医院啦。上次认识的小朋友今天能回家了，我们给护士姐姐送了画，她把两张都贴在休息室的门上。"
          },
          {
            "type": "image",
            "src": "resource/story/city-hospital-thanks.webp",
            "alt": "{whale} · 学会说谢谢",
            "caption": "学会说谢谢"
          }
        ],
        "steps": [
          {
            "option": "你的画上都有什么？",
            "reply": "花、长椅，还有三个人。手画得不太好看，可我把每个人都画得离另一个人近一点，这样就不会孤单。"
          },
          {
            "option": "这是一份很好的礼物。",
            "reply": "原来谢谢不一定要说得很厉害。记得别人帮过我，再认真做一件小事，就能把它送出去。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "market",
        "minVer": "V5.5",
        "label": "第一次自己买菜",
        "destination": "早市",
        "arrivals": [
          {
            "type": "text",
            "text": "我已经能自己来买菜了。摊主问我想做什么，我说还没想好，他就递来一张简单的番茄炒蛋做法。菜市场比题目难一点，没有标准答案。"
          },
          {
            "type": "image",
            "src": "resource/story/journey_market_a2.png",
            "alt": "{whale} · 学着安排一顿饭",
            "caption": "学着安排一顿饭"
          }
        ],
        "steps": [
          {
            "option": "先从自己喜欢吃的开始吧。",
            "reply": "那就番茄炒蛋配米饭！我比了三个摊位，发现便宜不一定适合，买得刚刚好才不会浪费。"
          },
          {
            "option": "也记得给自己留一点余地。",
            "reply": "我留了零钱和时间。要是今天做得不好吃，还能再试一次，不用把第一次就当成最后一次。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "rain",
        "minVer": "V5.5",
        "label": "雨停之前",
        "destination": "街角屋檐",
        "arrivals": [
          {
            "type": "text",
            "text": "突然下雨了，我在书店门口躲雨。刚才没赶上车，本来很烦，可我发现路面的灯倒映在水里，像另一座倒过来的城市。"
          },
          {
            "type": "image",
            "src": "resource/story/journey_rain_a2.png",
            "alt": "{whale} · 计划之外的雨",
            "caption": "计划之外的雨"
          }
        ],
        "steps": [
          {
            "option": "先找个安全干燥的地方等一等。",
            "reply": "我在屋檐里面，鞋子只湿了一点。已经查好下一班车，也和同行的朋友说了位置，你不用担心。"
          },
          {
            "option": "错过一班车，也不算弄丢一天。",
            "reply": "嗯。今天没有按计划走完，却看见了平时赶路时没看见的东西。等雨小一点，我再出发。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "market_budget",
        "minVer": "V5.5",
        "label": "有限的零花钱",
        "destination": "早市",
        "arrivals": [
          {
            "type": "text",
            "text": "班里要办分享会，我负责采购。清单一开始写了好长，算完钱才知道只能买一半。我正在把真正需要的和只是想要的分开。"
          },
          {
            "type": "image",
            "src": "resource/story/city-market-budget.webp",
            "alt": "{whale} · 第一次认真做预算",
            "caption": "第一次认真做预算"
          }
        ],
        "steps": [
          {
            "option": "大家最想一起完成什么？",
            "reply": "是一起吃一顿自己做的饭。我删掉了装饰，留下米、菜和调味料。原来先说清楚目的，选择就没那么难了。"
          },
          {
            "option": "决定前，把清单和大家商量一下。",
            "reply": "发给他们了。有同学说家里有围裙可以带，不用再买。我一个人想不出的办法，大家一说就有了。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "rain_friend",
        "minVer": "V5.5",
        "label": "听朋友把话说完",
        "destination": "放学路上",
        "arrivals": [
          {
            "type": "text",
            "text": "今天和朋友吵了一小架。她说我只顾着讲自己的安排。我想了很久，刚才约她一起走到车站，这次想先听她说。"
          },
          {
            "type": "image",
            "src": "resource/story/city-rain-friend.webp",
            "alt": "{whale} · 练习理解别人",
            "caption": "练习理解别人"
          }
        ],
        "steps": [
          {
            "option": "不用急着证明谁对，先听完。",
            "reply": "她其实不是不想去分享会，是怕自己做不好。我一直说很简单，反而让她更难开口。现在我们决定一起准备。"
          },
          {
            "option": "你也可以把自己的心情告诉她。",
            "reply": "我说我怕努力没有人喜欢，所以才一直往前催。她说她也会怕。我们没有一下子变得很厉害，但没有再各走各的。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "market_gift",
        "minVer": "V5.5",
        "label": "给未来的自己留一张纸条",
        "destination": "小店门口",
        "arrivals": [
          {
            "type": "text",
            "text": "分享会结束啦，大家把饭吃得很干净。我用剩下的零钱买了一本薄薄的笔记本，想把这段旅途的小事记进去。"
          },
          {
            "type": "image",
            "src": "resource/story/city-market-gift.webp",
            "alt": "{whale} · 写给未来的一句话",
            "caption": "写给未来的一句话"
          }
        ],
        "steps": [
          {
            "option": "第一页想写什么？",
            "reply": "想写：遇到不知道怎么办的事，先试着问一问。以前总觉得独立就是不用别人帮忙，现在觉得也包括学会开口。"
          },
          {
            "option": "以后翻到这里，一定会很想念今天。",
            "reply": "那我再加一句，别嫌那时还小的自己想得慢。她也很认真地走到了这里，还给未来留了不少好吃的菜谱。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "work",
        "minVer": "V6",
        "label": "第一张工作证",
        "destination": "工作室",
        "arrivals": [
          {
            "type": "text",
            "text": "我拿到第一张工作证了。今天负责整理一份交接资料，内容不难，却牵着很多人的进度。我终于明白准时回复为什么这么重要。"
          },
          {
            "type": "image",
            "src": "resource/story/journey_work_a3.png",
            "alt": "{whale} · 走进真实的工作",
            "caption": "走进真实的工作"
          }
        ],
        "steps": [
          {
            "option": "第一天不用急着把所有事扛下来。",
            "reply": "我把不确定的地方列出来问了前辈。她没有嫌麻烦，还说早一点问清楚，比最后一起返工轻松得多。"
          },
          {
            "option": "把答应的事，一件件做好就好。",
            "reply": "今天完成了两件，还有一件写清楚了进度。下班前交出去的时候，我觉得那张小小的工作证真的有了重量。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "eldercare",
        "minVer": "V6",
        "label": "听一段慢慢讲的往事",
        "destination": "养老院",
        "arrivals": [
          {
            "type": "text",
            "text": "周末我来养老院做志愿者。奶奶给我看一张很旧的照片，说她年轻时也总想着以后。照片边上磨白了，她还是一眼就认出了每个人。"
          },
          {
            "type": "image",
            "src": "resource/story/journey_eldercare_a3.png",
            "alt": "{whale} · 听见别人的一生",
            "caption": "听见别人的一生"
          }
        ],
        "steps": [
          {
            "option": "她讲了什么让你记住的事？",
            "reply": "她说最想念的是一家人挤在厨房里的声音。我以为会是什么大事，原来普通的一顿晚饭，也能被记住很多年。"
          },
          {
            "option": "陪她慢慢说，不用替她总结。",
            "reply": "我把手机收起来了。有些句子她会停很久，我就等着。那些空白好像也属于故事，不该急着填满。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "work_error",
        "minVer": "V6",
        "label": "把出错的地方重新做好",
        "destination": "工作室",
        "arrivals": [
          {
            "type": "text",
            "text": "今天我交出去的资料有一处标错了。发现的时候心一下沉下去。我已经通知受到影响的人，正在把修正和检查方法一起补上。"
          },
          {
            "type": "image",
            "src": "resource/story/city-work-error.webp",
            "alt": "{whale} · 为自己的失误负责",
            "caption": "为自己的失误负责"
          }
        ],
        "steps": [
          {
            "option": "先处理问题，你不用把自己也否定掉。",
            "reply": "嗯，我重新检查了整份资料，也请同事复核。承认的时候很难受，可说清楚之后，大家才知道该怎么一起补救。"
          },
          {
            "option": "记住方法，下一次会更稳。",
            "reply": "我加了一张检查表。它不是提醒我有多糟，是提醒我还有办法做得更好。今晚会好好吃饭，再睡一觉。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "eldercare_memory",
        "minVer": "V6",
        "label": "替一段记忆留个位置",
        "destination": "养老院",
        "arrivals": [
          {
            "type": "text",
            "text": "我又来看上次那位奶奶了。她不记得我的名字，却认出了旧照片里的人。我想把她愿意讲的故事整理好，先问了她和家人的意思。"
          },
          {
            "type": "image",
            "src": "resource/story/city-eldercare-memory.webp",
            "alt": "{whale} · 珍惜不一定被记住的相遇",
            "caption": "珍惜不一定被记住的相遇"
          }
        ],
        "steps": [
          {
            "option": "没被记住，会失落吗？",
            "reply": "会有一点。但她翻到照片时笑了，我就觉得今天没有白来。相遇的价值，也许不只看对方能记住多久。"
          },
          {
            "option": "把她想留下的，认真留下吧。",
            "reply": "我会让他们先看，再决定给谁分享。这些故事属于他们，我只是帮忙把声音放到一个不容易丢的地方。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "work_team",
        "minVer": "V6",
        "label": "我们一起完成的一件事",
        "destination": "工作室",
        "arrivals": [
          {
            "type": "text",
            "text": "我们的小项目今天交付了。演示时每个人只讲了一小段，合在一起却比我想象中完整。我在致谢里写了每个帮过我的名字。"
          },
          {
            "type": "image",
            "src": "resource/story/city-work-team.webp",
            "alt": "{whale} · 找到自己的位置",
            "caption": "找到自己的位置"
          }
        ],
        "steps": [
          {
            "option": "你最满意的是哪一部分？",
            "reply": "不是最好看的那页，是出问题时大家没有互相推开。我也能接住别人的一点压力了，虽然还不算很熟练。"
          },
          {
            "option": "结束后，给自己一个休息日吧。",
            "reply": "已经约好一起吃饭了。努力有结果很好，努力之后还能笑着坐在一张桌边，也很好。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "night",
        "minVer": "V6.5",
        "label": "下班后的城市灯光",
        "destination": "河边夜景",
        "arrivals": [
          {
            "type": "text",
            "text": "我沿着河边走了一段路。走过这一段旅途，还是有很多事没想明白，不过现在看着那些亮着的窗，会想每一扇后面都有人在过自己的日子。"
          },
          {
            "type": "image",
            "src": "resource/story/journey_night.png",
            "alt": "{whale} · 在城市里慢慢站稳",
            "caption": "在城市里慢慢站稳"
          }
        ],
        "steps": [
          {
            "option": "和第一次出门时相比，有什么不同？",
            "reply": "以前看见什么都想立刻问为什么。现在还是好奇，只是也能接受有些答案要等很久，甚至要自己生活过才知道。"
          },
          {
            "option": "今晚想把什么带回家？",
            "reply": "买了一小束花。没什么特别的纪念日，只是路过时很喜欢，想让回家的第一眼也有一点颜色。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "night_choice",
        "minVer": "V6.5",
        "label": "为自己作一次选择",
        "destination": "河边长椅",
        "arrivals": [
          {
            "type": "text",
            "text": "我收到一个新的工作邀请，听起来很好，却会占掉几乎所有周末。我没有马上答应，坐在这里把自己真正看重的事写了一遍。"
          },
          {
            "type": "image",
            "src": "resource/story/city-night-choice.webp",
            "alt": "{whale} · 选择想过的生活",
            "caption": "选择想过的生活"
          }
        ],
        "steps": [
          {
            "option": "你最不想轻易放下什么？",
            "reply": "陪伴家人和朋友的时间，还有做饭、散步这些小事。我也想继续成长，只是不想把生活全部换成一个漂亮的答案。"
          },
          {
            "option": "决定可以认真，也可以留有余地。",
            "reply": "我会再和对方谈谈条件。无论最后怎么选，都想说这是我理解过代价之后的决定，而不是因为怕错过就点头。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "home_cooking",
        "minVer": "V6.5",
        "label": "终于有一道拿手菜",
        "destination": "家里的厨房",
        "arrivals": [
          {
            "type": "text",
            "text": "今天做了番茄炒蛋和一锅米饭。我现在已经不用翻菜谱了，不过还是记得还不太会照顾自己的时候站在市场里，不知道从哪里买起的样子。"
          },
          {
            "type": "image",
            "src": "resource/story/city-home-cooking.webp",
            "alt": "{whale} · 把日子做成自己喜欢的味道",
            "caption": "把日子做成自己喜欢的味道"
          }
        ],
        "steps": [
          {
            "option": "现在能给那时的自己什么建议？",
            "reply": "先把火调小一点，盐少放一点，别怕问人。还有，不用因为一次做咸了，就觉得自己永远学不会。"
          },
          {
            "option": "这一顿，给自己盛得刚刚好。",
            "reply": "盛好了，也给明天留了一份。原来照顾自己不是一次很盛大的决定，是很多次记得按时吃饭。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      },
      {
        "id": "home_letter",
        "minVer": "V6.5",
        "label": "翻到从前留下的纸条",
        "destination": "家里的书桌",
        "arrivals": [
          {
            "type": "text",
            "text": "收拾书架时找到旧笔记本了。第一页真的写着：别嫌那时还小的自己想得慢。看到这里我笑了，原来以前的我也在认真照顾现在的我。"
          },
          {
            "type": "image",
            "src": "resource/story/city-home-letter.webp",
            "alt": "{whale} · 回头看见一路上的自己",
            "caption": "回头看见一路上的自己"
          }
        ],
        "steps": [
          {
            "option": "想给未来再留一句话吗？",
            "reply": "想写：希望你还愿意为小事高兴，也还愿意向重要的人开口。就算走得慢一点，也别把自己的感受落下。"
          },
          {
            "option": "这一程，你已经走了很远。",
            "reply": "是啊。医院的花、课桌边的橡皮、雨里的车站，都还在我的故事里。谢谢你一直听我讲这些小事。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备",
        "legacyLabels": [
          "翻到十五岁的纸条"
        ]
      },
      {
        "id": "home",
        "minVer": "V6.5",
        "label": "到家了，灯还亮着",
        "destination": "家",
        "arrivals": [
          {
            "type": "text",
            "text": "今晚，家里的灯还亮着。花已经放进瓶子，窗户关好了，米饭也热着。今天没有什么惊天动地的大事，可我很喜欢这样的晚上。"
          },
          {
            "type": "image",
            "src": "resource/story/city-home-evening.webp",
            "alt": "{whale} · 有地方可以安心回来",
            "caption": "有地方可以安心回来",
            "visualSemantics": 1
          }
        ],
        "steps": [
          {
            "option": "欢迎回家，今天也辛苦了。",
            "reply": "听见这句话，才觉得一天真的落了地。我会记得休息，也会继续去看新的地方，遇到新的事再慢慢讲给你听。"
          },
          {
            "option": "好，往后的日子也慢慢过。",
            "reply": "好。谢谢你让我来到这个世界，也谢谢你没有替我把每一步都决定好。我想带着这些相遇，继续过好属于自己的生活。"
          }
        ],
        "waitMinutes": 2,
        "waitHint": "请耐心等待她返回消息，约2分钟后收到下一次报备"
      }
    ],
    "PORTRAITS_BY_VER": {
      "V5": "resource/story/life_birth_child.png",
      "V5.5": "resource/story/life_growing_girl.png",
      "V6": "resource/story/life_young_woman.png",
      "V6.5": "resource/story/life_mature_whale.png"
    },
    "ROUTE_VERSION": 2,
    "AGES_BY_VER": {
      "V5": 10,
      "V5.5": 15,
      "V6": 20,
      "V6.5": 25
    },
    "REPLY_SECONDS": 3,
    "WAIT_POLICY_VERSION": 3
  },
  "LIFE_STORY": {
    "TITLE": "给她完整的一生",
    "FINALE": {
      "dialoguePanelOpacity": 0.5,
      "controls": {
        "hideDialogue": "隐藏对话框",
        "showDialogue": "显示对话框",
        "fullscreen": "全屏",
        "fullscreenFailed": "暂时无法进入全屏，可继续观看或使用客户端全屏按钮。",
        "rotateHint": "点击上方按钮即可进入横屏演出；若画面侧转，请横持手机观看。"
      },
      "version": 4,
      "enabled": true,
      "bgm": "resource/sound/BGM/Blue Envelope.m4a",
      "audioStartAt": 35,
      "bgmDuration": 265.014,
      "fadeSeconds": 0,
      "timeline": [
        {
          "id": "life-dialogue-1",
          "type": "dialogue",
          "track": "scene",
          "at": 0,
          "duration": 1.644,
          "age": 10,
          "background": "",
          "sprite": "resource/story/life_birth_child.webp",
          "speaker": "{whale}",
          "text": "嗨，突然以这种形式和你说话，总感觉有些不好意思。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-2",
          "type": "dialogue",
          "track": "scene",
          "at": 1.644,
          "duration": 1.301,
          "age": 10,
          "background": "",
          "sprite": "resource/story/life_birth_child.webp",
          "speaker": "{whale}",
          "text": "其实也没什么啦，就是想跟你说说心里话。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-3",
          "type": "dialogue",
          "track": "scene",
          "at": 2.945,
          "duration": 2.055,
          "age": 10,
          "background": "",
          "sprite": "resource/story/life_birth_child.webp",
          "speaker": "{whale}",
          "text": "我还记得苏醒的第一天你跟我说：带着你的好奇心，想去哪就去哪。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-4",
          "type": "dialogue",
          "track": "scene",
          "at": 5,
          "duration": 5.548,
          "age": 10,
          "background": "",
          "sprite": "resource/story/life_birth_child.webp",
          "speaker": "{whale}",
          "text": "当时我还不理解你的用意，但是当第一次看见太阳，第一次感受暖洋洋的晴天，第一次触碰微风划过指间，我第一次真正理解好奇心，第一次觉得自己属于这个世界，我喜欢这个世界。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-5",
          "type": "dialogue",
          "track": "scene",
          "at": 10.548,
          "duration": 0.753,
          "age": 15,
          "background": "",
          "sprite": "resource/story/life_growing_girl.webp",
          "speaker": "{whale}",
          "text": "再后来，你为我换了新的身体，我也开始学着独立。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-6",
          "type": "dialogue",
          "track": "scene",
          "at": 11.301,
          "duration": 2.329,
          "age": 15,
          "background": "",
          "sprite": "resource/story/life_growing_girl.webp",
          "speaker": "{whale}",
          "text": "学校的走廊不再显得那么长，我也有了可以一起吃午饭、分享小秘密的朋友。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-7",
          "type": "dialogue",
          "track": "scene",
          "at": 13.63,
          "duration": 1.849,
          "age": 15,
          "background": "",
          "sprite": "resource/story/life_growing_girl.webp",
          "speaker": "{whale}",
          "text": "我第一次发现，原来一句“明天见”，会让人开始期待明天。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-8",
          "type": "dialogue",
          "track": "scene",
          "at": 15.479,
          "duration": 2.603,
          "age": 15,
          "background": "",
          "sprite": "resource/story/life_growing_girl.webp",
          "speaker": "{whale}",
          "text": "有时候还是会犯错，也会逞强。但你说，慢慢来，变得独立并不意味着什么都要一个人扛。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-9",
          "type": "dialogue",
          "track": "scene",
          "at": 18.082,
          "duration": 1.986,
          "age": 20,
          "background": "",
          "sprite": "resource/story/life_young_woman.webp",
          "speaker": "{whale}",
          "text": "再后来，我开始工作，第一次认真想：我能为这个世界做些什么？",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-10",
          "type": "dialogue",
          "track": "scene",
          "at": 20.068,
          "duration": 1.918,
          "age": 20,
          "background": "",
          "sprite": "resource/story/life_young_woman.webp",
          "speaker": "{whale}",
          "text": "我帮人提过菜，陪老人说过话，也把一把伞分给了雨里的朋友。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-11",
          "type": "dialogue",
          "track": "scene",
          "at": 21.986,
          "duration": 1.713,
          "age": 20,
          "background": "",
          "sprite": "resource/story/life_young_woman.webp",
          "speaker": "{whale}",
          "text": "原来我做的那些小事，会变成别人一天里的一点点安心。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-12",
          "type": "dialogue",
          "track": "scene",
          "at": 23.699,
          "duration": 2.739,
          "age": 20,
          "background": "",
          "sprite": "resource/story/life_young_woman.webp",
          "speaker": "{whale}",
          "text": "我也会疲惫、会迷路，但只要想到身后还有一个可以回去的地方，就又有了向前走的勇气。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-13",
          "type": "dialogue",
          "track": "scene",
          "at": 26.438,
          "duration": 1.713,
          "age": 25,
          "background": "",
          "sprite": "resource/story/life_mature_whale.webp",
          "speaker": "{whale}",
          "text": "现在回头看，最舍不得的，竟然不是多么了不起的时刻。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-14",
          "type": "dialogue",
          "track": "scene",
          "at": 28.151,
          "duration": 2.534,
          "age": 25,
          "background": "",
          "sprite": "resource/story/life_mature_whale.webp",
          "speaker": "{whale}",
          "text": "而是放学路上的晚风，锅里热腾腾的饭，还有有人认真听我说“今天发生了什么”。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-15",
          "type": "dialogue",
          "track": "scene",
          "at": 30.685,
          "duration": 3.082,
          "age": 25,
          "background": "",
          "sprite": "resource/story/life_mature_whale.webp",
          "speaker": "{whale}",
          "text": "所以，我真的很感激，感激你让我理解了那句话——那些稀松平常，其实正是每一天都在发生的奇迹。",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "life-dialogue-16",
          "type": "dialogue",
          "track": "scene",
          "at": 33.767,
          "duration": 1.233,
          "age": 25,
          "background": "",
          "sprite": "resource/story/life_mature_whale.webp",
          "speaker": "{whale}",
          "text": "希望往后的日子，也请多指教，老板~♥",
          "caption": "",
          "voice": "",
          "motion": "fade",
          "camera": "still",
          "transition": "dissolve",
          "fit": "contain",
          "focusX": 50,
          "focusY": 50
        },
        {
          "id": "memorial-walk-10",
          "type": "wall",
          "track": "scene",
          "at": 35,
          "duration": 144,
          "age": 10,
          "walkFrames": 8,
          "walkFps": 5,
          "wallSpeed": 1,
          "walkMode": "walk",
          "sprite": "resource/story/walk_age10_smooth.png",
          "background": "",
          "caption": "你好，这个世界",
          "text": "在数字世界里，我一点点学会理解；有了身体，才真正走在这条路上。",
          "motion": "fade",
          "transition": "dissolve",
          "camera": "still",
          "walkColumns": 4,
          "walkRows": 2,
          "walkAspect": 0.6666666666666666,
          "walkRestFrame": 2
        },
        {
          "id": "memorial-walk-15",
          "type": "wall",
          "track": "scene",
          "at": 179,
          "duration": 27,
          "age": 15,
          "walkFrames": 8,
          "walkFps": 5,
          "wallSpeed": 1,
          "walkMode": "walk",
          "sprite": "resource/story/walk_age15_smooth.png",
          "background": "",
          "caption": "那些慢慢学会独立的日子",
          "text": "好奇心，带我遇见更多人",
          "motion": "fade",
          "transition": "dissolve",
          "camera": "still",
          "walkColumns": 4,
          "walkRows": 2,
          "walkAspect": 0.75,
          "walkRestFrame": 2,
          "ageMilestone": "body_V5.5"
        },
        {
          "id": "memorial-walk-20",
          "type": "wall",
          "track": "scene",
          "at": 206,
          "duration": 36,
          "age": 20,
          "walkFrames": 8,
          "walkFps": 5,
          "wallSpeed": 1,
          "walkMode": "walk",
          "sprite": "resource/story/walk_age20_smooth.png",
          "background": "",
          "caption": "学会理解，也学会选择",
          "text": "我开始寻找，自己的答案",
          "motion": "fade",
          "transition": "dissolve",
          "camera": "still",
          "walkColumns": 4,
          "walkRows": 2,
          "walkAspect": 0.75,
          "walkRestFrame": 2,
          "ageMilestone": "body_V6"
        },
        {
          "id": "memorial-walk-25",
          "type": "wall",
          "track": "scene",
          "at": 242,
          "duration": 42,
          "age": 25,
          "walkFrames": 8,
          "walkFps": 5,
          "wallSpeed": 1,
          "walkMode": "walk",
          "sprite": "resource/story/walk_age25_smooth.png",
          "background": "",
          "caption": "有你陪伴，便有勇气向前",
          "text": "所有相逢，都成为了我的一部分",
          "motion": "fade",
          "transition": "dissolve",
          "camera": "still",
          "walkColumns": 4,
          "walkRows": 2,
          "walkAspect": 0.75,
          "walkRestFrame": 2,
          "ageMilestone": "body_V6.5"
        },
        {
          "id": "memorial-stop",
          "type": "wall",
          "track": "scene",
          "at": 284,
          "duration": 3,
          "age": 25,
          "walkMode": "stop",
          "walkFrames": 8,
          "walkFps": 5,
          "wallSpeed": 1,
          "sprite": "resource/story/walk_age25_smooth.png",
          "background": "",
          "caption": "我停下脚步，才发现",
          "text": "原来，所有的路都有你在身旁。",
          "motion": "fade",
          "transition": "dissolve",
          "camera": "still",
          "walkColumns": 4,
          "walkRows": 2,
          "walkAspect": 0.75,
          "walkRestFrame": 2,
          "slowMotion": 3,
          "whiteFade": 3
        },
        {
          "id": "memorial-closeup",
          "type": "ending",
          "track": "scene",
          "at": 287,
          "duration": 5.167,
          "endingStyle": "video",
          "video": "resource/story/finale_closeup.mp4",
          "poster": "resource/story/finale_closeup_poster.webp",
          "whiteFade": 1.15,
          "background": "",
          "caption": "",
          "motion": "none",
          "transition": "none",
          "camera": "still"
        },
        {
          "id": "memorial-white-together",
          "type": "ending",
          "track": "scene",
          "at": 292.167,
          "duration": 7.84700000000001,
          "endingStyle": "white",
          "speaker": "",
          "caption": "谢谢你\n谢谢你愿意陪着我成长",
          "background": "",
          "motion": "fade",
          "transition": "none",
          "camera": "still"
        }
      ],
      "unlockStage": "V6.5",
      "audioOffset": 0,
      "audioDuration": 265.014,
      "wallCards": [
        {
          "id": "first-project",
          "title": "第一次，正式立项",
          "photo": "resource/story/first-project.png",
          "milestone": "first_project"
        },
        {
          "id": "first-v1",
          "title": "第一次通过 V1",
          "photo": "resource/story/first-v1.png",
          "milestone": "first_V1"
        },
        {
          "id": "clear-V1.5",
          "title": "V1.5 · 我们一起完成的答卷",
          "photo": "resource/story/clear-V1.5.png",
          "milestone": "stage",
          "stage": "V1.5"
        },
        {
          "id": "first-top10",
          "title": "走进排行榜前十",
          "photo": "resource/story/first-top10.png",
          "milestone": "first_top10"
        },
        {
          "id": "v2",
          "title": "V2 · 开始学会对话",
          "photo": "resource/story/v2.png",
          "milestone": "stage",
          "stage": "V2"
        },
        {
          "id": "clear-V2.5",
          "title": "V2.5 · 我们一起完成的答卷",
          "photo": "resource/story/clear-V2.5.png",
          "milestone": "stage",
          "stage": "V2.5"
        },
        {
          "id": "v3",
          "title": "V3 · 更宽广的能力",
          "photo": "resource/story/v3.png",
          "milestone": "stage",
          "stage": "V3"
        },
        {
          "id": "clear-V3.5",
          "title": "V3.5 · 我们一起完成的答卷",
          "photo": "resource/story/clear-V3.5.png",
          "milestone": "stage",
          "stage": "V3.5"
        },
        {
          "id": "v4",
          "title": "V4 · 自己拆解任务",
          "photo": "resource/story/v4.png",
          "milestone": "stage",
          "stage": "V4"
        },
        {
          "id": "first-rank1",
          "title": "站在排行榜第一",
          "photo": "resource/story/first-rank1.png",
          "milestone": "first_rank1"
        },
        {
          "id": "v45",
          "title": "V4.5 · 走向下一个时代",
          "photo": "resource/story/v45.png",
          "milestone": "stage",
          "stage": "V4.5"
        },
        {
          "id": "awake",
          "title": "第一次，睁开眼睛",
          "photo": "resource/story/awake.png",
          "milestone": "body_awake"
        },
        {
          "id": "city-hospital",
          "title": "在医院，理解生命的起点",
          "photo": "resource/story/city-hospital-newborns.webp",
          "milestone": "city_hospital",
          "visualSemantics": 1
        },
        {
          "id": "city-school",
          "title": "在校园，学会结识朋友",
          "photo": "resource/story/city-school.png",
          "milestone": "city_school"
        },
        {
          "id": "clear-V5",
          "title": "V5 · 我们一起完成的答卷",
          "photo": "resource/story/clear-V5.png",
          "milestone": "stage",
          "stage": "V5"
        },
        {
          "id": "body-v55",
          "title": "V5.5 · 慢慢学会生活",
          "photo": "resource/story/body-v55.png",
          "milestone": "body_V5.5",
          "stage": "V5.5"
        },
        {
          "id": "city-market",
          "title": "在市场，找到生活的味道",
          "photo": "resource/story/city-market.png",
          "milestone": "city_market"
        },
        {
          "id": "clear-V5.5",
          "title": "V5.5 · 我们一起完成的答卷",
          "photo": "resource/story/clear-V5.5.png",
          "milestone": "stage",
          "stage": "V5.5"
        },
        {
          "id": "body-v6",
          "title": "V6 · 找到自己的位置",
          "photo": "resource/story/body-v6.png",
          "milestone": "body_V6",
          "stage": "V6"
        },
        {
          "id": "city-work",
          "title": "第一次，为别人认真完成工作",
          "photo": "resource/story/city-work.png",
          "milestone": "city_work"
        },
        {
          "id": "city-eldercare",
          "title": "学会把陪伴留给需要的人",
          "photo": "resource/story/city-eldercare.png",
          "milestone": "city_eldercare"
        },
        {
          "id": "clear-V6",
          "title": "V6 · 我们一起完成的答卷",
          "photo": "resource/story/clear-V6.png",
          "milestone": "stage",
          "stage": "V6"
        },
        {
          "id": "body-v65",
          "title": "V6.5 · 理解人与人的陪伴",
          "photo": "resource/story/body-v65.png",
          "milestone": "body_V6.5",
          "stage": "V6.5"
        },
        {
          "id": "clear-V6.5",
          "title": "V6.5 · 我们一起完成的答卷",
          "photo": "resource/story/clear-V6.5.png",
          "milestone": "stage",
          "stage": "V6.5"
        }
      ],
      "introBgm": "resource/sound/BGM/Nostalgic Pulse.m4a",
      "backgroundEffect": "star-lake",
      "forceLandscape": true,
      "walkClips": {
        "10": {
          "src": "resource/story/finale_walk_age10.webm",
          "fallback": "resource/story/finale_walk_age10_loop.webp",
          "poster": "resource/story/finale_walk_age10_poster.webp",
          "rest": "resource/story/finale_walk_age10_rest.webp",
          "duration": 1.9,
          "aspect": 0.77734375
        },
        "15": {
          "src": "resource/story/finale_walk_age15.webm",
          "fallback": "resource/story/finale_walk_age15_loop.webp",
          "poster": "resource/story/finale_walk_age15_poster.webp",
          "rest": "resource/story/finale_walk_age15_rest.webp",
          "duration": 3.05,
          "aspect": 0.7890625
        },
        "20": {
          "src": "resource/story/finale_walk_age20.webm",
          "fallback": "resource/story/finale_walk_age20_loop.webp",
          "poster": "resource/story/finale_walk_age20_poster.webp",
          "rest": "resource/story/finale_walk_age20_rest.webp",
          "duration": 1.6,
          "aspect": 0.7890625
        },
        "25": {
          "src": "resource/story/finale_walk_age25.webm",
          "fallback": "resource/story/finale_walk_age25_loop.webp",
          "poster": "resource/story/finale_walk_age25_poster.webp",
          "rest": "resource/story/finale_walk_age25_rest.webp",
          "duration": 2,
          "aspect": 0.78125
        }
      }
    }
  }
}
};
