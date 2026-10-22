# -*- coding: utf-8 -*-
"""
游戏项目编辑器 - 本地服务
功能：
  1. 静态托管 editor/ 目录页面
  2. /resource/* 映射到项目 resource 文件夹（供场景图/素材渲染）
  3. 图片处理 API：抠图 / 压缩 / 写入 resource
  4. 项目数据保存 / 加载（project.json）
  5. 音效配置 API（§九）：ElevenLabs / 本地 Stable Audio 代理 + sfx 管线
"""
# [feature:sfx-candidate-api-1]
import json, os, sys, base64, io, re, shutil, mimetypes, urllib.request, urllib.parse, time, math, struct, wave, hashlib, tempfile
# [/feature:sfx-candidate-api-1]
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageChops, ImageFilter

# ---- 语音剪辑/处理（doc/28）：纯标准库实现，单测入口 `python voice_proc.py` ----
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import voice_proc
# [feature:seed-audio-server-import]
import seed_audio
# [/feature:seed-audio-server-import]

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(ROOT)          # 项目根（含 resource）
RESOURCE = os.path.join(PROJECT_ROOT, "resource")
H5_DEMO = os.path.join(PROJECT_ROOT, "h5_demo")
# [feature:editor-media-http-imports]
PORT = 8090
sys.path.insert(0, H5_DEMO)
from media_http import serve_file
SHARED_LIFE_SCRIPTS = frozenset(("life_timeline.js", "life_video.js", "life_star_lake.js", "life_gpu_canvas.js", "life_star_compositor.js", "life_text_dissolve.js", "life_music_pulse.js", "life_dialogue_voice.js", "resource_paths.js"))
# [/feature:editor-media-http-imports]

# ---- 音效管线相关目录/配置 ----
SFX_DIR = os.path.join(RESOURCE, "sound", "sfx")       # 已应用音效（游戏引用）
SFX_TMP = os.path.join(PROJECT_ROOT, "tmp", "sfx-preview")  # 待选音效不属于发布资源
CONFIG = os.path.join(ROOT, "server_config.json")      # 服务端密钥/本地模型地址
SFX_CONFIG = os.path.join(ROOT, "sfx_config.json")     # 事件→文件 映射

# ---- BGM / 历史回溯（§二.6 / §九） ----
BGM_DIR = os.path.join(RESOURCE, "sound", "BGM")       # BGM 素材库
BGM_CONFIG = os.path.join(ROOT, "bgm_config.json")     # {menu, scene, ...} → BGM 文件名（**编辑器副本**）
H5_BGM = os.path.join(H5_DEMO, "assets", "bgm")        # 历史遗留目录（不再写，保留常量兼容老代码）
H5_BGM_CFG = os.path.join(H5_DEMO, "data", "bgm_config.json")   # 游戏运行时读的 BGM 配置（**真源**）
H5_SFX_CFG = os.path.join(H5_DEMO, "data", "sfx_config.json")   # 游戏运行时读的音效配置（**真源**）
BACKUP_DIR = os.path.join(PROJECT_ROOT, "backup", "editor_configs")  # 配置历史快照目录（2026-09-03 统一挪到项目根 backup/）
MAX_BACKUPS = 50                                       # 快照上限（§十 备份纪律）

# ---- 玩法配置（大模型研发养成：基础数值/工程师/事件，§8 可视化配置） ----
GAME_CFG_CONFIG = os.path.join(ROOT, "game_cfg_config.json")   # 编辑器玩法配置
H5_GAME_CFG = os.path.join(H5_DEMO, "data", "game_cfg.json")   # 游戏运行时读取

DEFAULT_SFX_EVENTS = ["move", "click", "ui", "confirm", "float"]


def resource_directory(name):
    """保留大类，最多两级；兼容编辑器旧的目录选项但不再创建旧目录。"""
    value = str(name or "").strip().replace("\\", "/").strip("/")
    if value.startswith("story/"):
        value = "story"
    elif value.startswith("audio/"):
        value = "sound/" + value.split("/", 1)[1]
    elif value == "audio":
        value = "sound"
    elif value == "video":
        value = "story"
    if value in ("sound/sfx_tmp", "sound/sfx-preview"):
        raise ValueError("待选音效由音效工具保存在 tmp；正式音效请选择 sound/sfx。")
    parts = value.split("/")
    if (not value or len(parts) > 2 or any(part in ("", ".", "..") for part in parts)
            or ":" in value or os.path.isabs(value)):
        raise ValueError("资源按大类存放，resource 下最多两级目录；故事素材请放 story。")
    return value


# [feature:resource-webp-server]
_RESOURCE_WEBP_PATHS = {
    "story/awake.png": "story/awake.webp",
    "story/body-v5.png": "story/body-v5.webp",
    "story/body-v55.png": "story/body-v55.webp",
    "story/body-v6.png": "story/body-v6.webp",
    "story/body-v65.png": "story/body-v65.webp",
    "story/city-eldercare.png": "story/city-eldercare.webp",
    "story/city-hospital.png": "story/city-hospital.webp",
    "story/city-market.png": "story/city-market.webp",
    "story/city-school.png": "story/city-school.webp",
    "story/city-work.png": "story/city-work.webp",
    "story/clear-V1.5.png": "story/clear-V1.5.webp",
    "story/clear-V2.5.png": "story/clear-V2.5.webp",
    "story/clear-V3.5.png": "story/clear-V3.5.webp",
    "story/clear-V5.5.png": "story/clear-V5.5.webp",
    "story/clear-V5.png": "story/clear-V5.webp",
    "story/clear-V6.5.png": "story/clear-V6.5.webp",
    "story/clear-V6.png": "story/clear-V6.webp",
    "story/face_front_calm.png": "story/face_front_calm.webp",
    "story/face_front_calm_youth.png": "story/face_front_calm_youth.webp",
    "story/face_front_calm_youth_complete.png": "story/face_front_calm_youth_complete.webp",
    "story/face_front_smile.png": "story/face_front_smile.webp",
    "story/face_front_smile_youth.png": "story/face_front_smile_youth.webp",
    "story/face_front_smile_youth_complete.png": "story/face_front_smile_youth_complete.webp",
    "story/face_front_soft.png": "story/face_front_soft.webp",
    "story/face_front_soft_youth.png": "story/face_front_soft_youth.webp",
    "story/face_front_soft_youth_complete.png": "story/face_front_soft_youth_complete.webp",
    "story/face_side.png": "story/face_side.webp",
    "story/face_side_youth.png": "story/face_side_youth.webp",
    "story/face_side_youth_complete.png": "story/face_side_youth_complete.webp",
    "story/first-project.png": "story/first-project.webp",
    "story/first-rank1.png": "story/first-rank1.webp",
    "story/first-top10.png": "story/first-top10.webp",
    "story/first-v1.png": "story/first-v1.webp",
    "story/journey_eldercare.png": "story/journey_eldercare.webp",
    "story/journey_eldercare_a3.png": "story/journey_eldercare_a3.webp",
    "story/journey_home.png": "story/journey_home.webp",
    "story/journey_hospital.png": "story/journey_hospital.webp",
    "story/journey_hospital_a1.png": "story/journey_hospital_a1.webp",
    "story/journey_market.png": "story/journey_market.webp",
    "story/journey_market_a2.png": "story/journey_market_a2.webp",
    "story/journey_night.png": "story/journey_night.webp",
    "story/journey_rain.png": "story/journey_rain.webp",
    "story/journey_rain_a2.png": "story/journey_rain_a2.webp",
    "story/journey_school.png": "story/journey_school.webp",
    "story/journey_school_a1.png": "story/journey_school_a1.webp",
    "story/journey_work.png": "story/journey_work.webp",
    "story/journey_work_a3.png": "story/journey_work_a3.webp",
    "story/lake_moon_bg.png": "story/lake_moon_bg.webp",
    "story/life_awake.png": "story/life_awake.webp",
    "story/life_birth_child.png": "story/life_birth_child.webp",
    "story/life_city_bg.png": "story/life_city_bg.webp",
    "story/life_grateful.png": "story/life_grateful.webp",
    "story/life_growing_girl.png": "story/life_growing_girl.webp",
    "story/life_mature_whale.png": "story/life_mature_whale.webp",
    "story/life_young_woman.png": "story/life_young_woman.webp",
    "story/review_a1_live.png": "story/review_a1_live.webp",
    "story/review_a1_news.png": "story/review_a1_news.webp",
    "story/review_a2_first_task.png": "story/review_a2_first_task.webp",
    "story/review_a2_graduation.png": "story/review_a2_graduation.webp",
    "story/review_a3_first_work.png": "story/review_a3_first_work.webp",
    "story/review_a3_graduation.png": "story/review_a3_graduation.webp",
    "story/review_firstjob.png": "story/review_firstjob.webp",
    "story/review_graduation.png": "story/review_graduation.webp",
    "story/v2.png": "story/v2.webp",
    "story/v3.png": "story/v3.webp",
    "story/v4.png": "story/v4.webp",
    "story/v45.png": "story/v45.webp",
    "story/walk_age10.png": "story/walk_age10.webp",
    "story/walk_age10_smooth.png": "story/walk_age10_smooth.webp",
    "story/walk_age15.png": "story/walk_age15.webp",
    "story/walk_age15_smooth.png": "story/walk_age15_smooth.webp",
    "story/walk_age20.png": "story/walk_age20.webp",
    "story/walk_age20_smooth.png": "story/walk_age20_smooth.webp",
    "story/walk_age25.png": "story/walk_age25.webp",
    "story/walk_age25_smooth.png": "story/walk_age25_smooth.webp"
}

def _legacy_resource_relative(name):
    """旧配置路径只读兼容：实际磁盘始终使用合并后的分类。"""
    value = str(name or "").replace("\\", "/").lstrip("/")
    if value.startswith("story/life/"):
        base = value.rsplit("/", 1)[-1]
        if base == "manifest.json":
            base = "memorial_manifest.json" if "/memorial/" in value else "growth_manifest.json"
        return "story/" + base
    if value == "video/bonus_celebrate.mp4":
        return "story/bonus_celebrate.mp4"
    if value == "audio/sfx_tmp/float_20260902_224628_8689.wav":
        return "sound/sfx/float_alt_20260902_224628_8689.wav"
    if value.startswith(("audio/voice/", "audio/sfx/")):
        return "sound/" + value.split("/", 1)[1]
    return value


def resource_relative(name):
    value = _legacy_resource_relative(name)
    return _RESOURCE_WEBP_PATHS.get(value, value)

# [/feature:resource-webp-server]
def resource_path(name, directory=False):
    """限定边界，旧待选音效 URL 映射 tmp，其他素材映射规范资源目录。"""
    rel = str(name or "").replace("\\", "/").lstrip("/")
    pending = ("audio/sfx_tmp", "sound/sfx-preview")
    if any(rel == prefix or rel.startswith(prefix + "/") for prefix in pending):
        prefix = next(prefix for prefix in pending if rel == prefix or rel.startswith(prefix + "/"))
        suffix = rel[len(prefix):].lstrip("/")
        if rel == "audio/sfx_tmp/float_20260902_224628_8689.wav":
            base, suffix = RESOURCE, resource_relative(rel)
        else:
            base = SFX_TMP
    else:
        base = RESOURCE
        suffix = resource_directory(rel) if directory else resource_relative(rel)
    result = os.path.abspath(os.path.join(base, suffix))
    if os.path.commonpath([result, os.path.abspath(base)]) != os.path.abspath(base):
        raise ValueError("资源路径必须位于对应资源目录内。")
    return result


def resource_filename(value):
    name = str(value or "").strip()
    if not name or name in (".", "..") or any(char in name for char in ("/", "\\", ":")):
        raise ValueError("素材名称请只填写文件名，不包含目录。")
    return name


def canonical_resource_value(value):
    """载入历史配置/工程时迁移素材地址；不改名字、数值和远程自定义地址。"""
    if isinstance(value, str):
        match = re.match(r"^(/?)(resource/.*?)([?#].*)?$", value, flags=re.I)
        if not match:
            return value
        old = urllib.parse.unquote(match.group(2)[len("resource/"):])
        new = resource_relative(old)
        return match.group(1) + "resource/" + new + (match.group(3) or "") if old != new else value
    if isinstance(value, list):
        return [canonical_resource_value(item) for item in value]
    if isinstance(value, dict):
        return {key: canonical_resource_value(item) for key, item in value.items()}
    return value


def load_config():
    try:
        with open(CONFIG, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_config(cfg):
    with open(CONFIG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def load_sfx_config():
    """读音效配置（给编辑器用）。与 load_bgm_config 同款（2026-09-22 架构对齐）：
    **优先读游戏运行时那份**（h5_demo/data/sfx_config.json），根文件只作回退 ——
    以前只读根文件，根文件一丢就兜底成空，编辑器音效页变空、保存还会清掉游戏端映射。
    值统一归一化成**文件名**（游戏端存的是 resource/sound/sfx/x.wav 完整路径，
    而编辑器下拉框的 option value 是文件名）。"""
    data = None
    for p in (H5_SFX_CFG, SFX_CONFIG):
        try:
            with open(p, encoding="utf-8") as f:
                d = json.load(f)
            if d and any((d.get("events") or {}).values()):
                data = d
                break
        except Exception:
            continue
    ev = {}
    for k, v in ((data or {}).get("events") or {}).items():
        ev[k] = os.path.basename(str(v)) if v else ""
    # [feature:sfx-candidate-api-2]
    result = dict(data or {})
    result["events"] = ev
    if not isinstance(result.get("volumes"), dict):
        result["volumes"] = {}
    return result
    # [/feature:sfx-candidate-api-2]


def save_sfx_config(cfg):
    with open(SFX_CONFIG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    # [feature:sfx-candidate-api-3]
    # Use the explicitly submitted SFX value. Re-reading the older runtime here
    # used to discard a newly chosen candidate and reset unrelated volume values.
    runtime = dict(cfg)
    runtime["events"] = {}
    for event, filename in (cfg.get("events") or {}).items():
        filename = os.path.basename(str(filename or ""))
        runtime["events"][event] = "resource/sound/sfx/" + filename if filename and os.path.isfile(os.path.join(SFX_DIR, filename)) else ""
    os.makedirs(os.path.dirname(H5_SFX_CFG), exist_ok=True)
    with open(H5_SFX_CFG, "w", encoding="utf-8") as f:
        json.dump(runtime, f, ensure_ascii=False, indent=2)
    # [/feature:sfx-candidate-api-3]


# ------------------------------------------------------------------ BGM 配置 --
def load_bgm_config():
    """读 BGM 配置（给编辑器用）。

    ⚠️ 2026-09-22 架构对齐（用户：「为什么 BGM 配置是根文件，不也应该是编辑器的配置为准吗」）：
    与 load_game_cfg() 同款 —— **优先读游戏运行时那份**（h5_demo/data/bgm_config.json），
    根文件只是编辑器副本、只在游戏端读不到时才回退。以前只读根文件，根文件一丢就兜底成空 ⇒
      ① 编辑器 BGM 页显示为空（有值也匹配不上，见下）；
      ② 之后任何一次保存/同步都会把游戏端已配好的 BGM 清掉（用户 09-18 就这么丢过一次）。
    另外**统一归一化成文件名**：游戏端存的是完整路径（resource/sound/BGM/x.m4a），
    而编辑器下拉框的 option value 是**文件名** —— 不归一化就会「有值却显示为空」。"""
    data = None
    for p in (H5_BGM_CFG, BGM_CONFIG):
        try:
            with open(p, encoding="utf-8") as f:
                d = json.load(f)
            if d and any((d or {}).values()):
                data = d
                break
        except Exception:
            continue
    data = data or {}
    return {k: (os.path.basename(str(data.get(k) or "")) if data.get(k) else "")
            for k in ("menu", "scene", "review", "bonus")}


def save_bgm_config(cfg):
    with open(BGM_CONFIG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


# ------------------------------------------------------------------ 玩法配置 --
# 大模型研发养成玩法的可视化配置（§8）：编辑器编辑「基础数值/工程师/事件」，
# 保存 → 同步到 h5_demo/data/game_cfg.json → 游戏启动时 deepMerge 覆盖出厂默认。
def load_game_cfg():
    """读玩法配置。

    ⚠️ 必须以**游戏运行时那份**（h5_demo/data/game_cfg.json）为唯一真源。
    以前读的是编辑器自己的副本 editor/game_cfg_config.json —— 它只是保存时的镜像，
    一旦两边不同步（例如用 tools/fix_cfg.js 修好了游戏那份、或手工改过），
    编辑器启动后读到的就是旧副本，点一次「保存全部」就把旧数据写回去，
    表现为「一保存编辑器配置，攻关 icon 就丢失 / 座位坐标被打回世界像素」。
    先读游戏那份，读不到再回退编辑器副本。"""
    for p in (H5_GAME_CFG, GAME_CFG_CONFIG):
        try:
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
            if data:
                data = canonical_resource_value(data)
                return purge_retired_game_cfg(data)
        except Exception:
            continue
    return {}


# ---- 删除意图记录（2026-09-10）----
# 配合 tools/sync_cfg_jsons.js 的「按稳定键补齐」：同步桥只"补"不"改" ——
# 出厂有的条目、真源缺了就补回来（这是修「出厂新增内容进不了运行时」的关键）。
# 但反过来：你在编辑器里**故意删掉**一条，同步桥又会把它补回来。
# 所以保存时把"被删掉的条目"记进 __removed，同步桥据此跳过。
_KEY_FIELDS = ("id", "q", "text", "name", "title", "type", "key")


def _stable_key(x):
    """与 tools/sync_cfg_jsons.js 的 stableKey 保持一致（两端必须同源）。"""
    if not isinstance(x, dict):
        return str(x)
    for k in _KEY_FIELDS:
        v = x.get(k)
        if isinstance(v, str) and v:
            return k + ":" + v
    import json as _json
    return "sig:" + _json.dumps(x, ensure_ascii=False, sort_keys=True)[:160]


def _record_removed(cur, path, old, new):
    """把「保存前有、保存后没了」的对象数组成员记进 cur["__removed"][path]。
    只处理**对象数组**（元素是 dict）；值数组/标量不记录（它们本来就是整体替换语义）。"""
    if not isinstance(old, list) or not isinstance(new, list):
        return
    if not (old and all(isinstance(x, dict) for x in old)):
        return
    keep = set(_stable_key(x) for x in new if isinstance(x, dict))
    gone = [k for k in (_stable_key(x) for x in old if isinstance(x, dict)) if k not in keep]
    rem = cur.get("__removed")
    if not isinstance(rem, dict):
        rem = {}
        cur["__removed"] = rem
    lst = rem.get(path)
    if not isinstance(lst, list):
        lst = []
        rem[path] = lst
    for g in gone:
        if g not in lst:
            lst.append(g)
    # 被重新加回来的条目 → 从删除名单里撤销（否则"删了再加"会一直补不回来）
    lst[:] = [g for g in lst if g not in keep]
    if not lst:
        rem.pop(path, None)
    if not rem:
        cur.pop("__removed", None)


def purge_retired_engineer_stats(cfg):
    """2026-09-10：工程师潜力属性收敛为**三维 code / algo / text** ——
    「精力 energy」与「协作 coop」已彻底删除（字段 / 49 份档案 / 培训池 / 事件条件与效果 /
    界面展示全部清除），初始体力改为固定 ENG_STATUS.ENERGY_INIT = 100。

    这里在**读与写两端**统一清除这两个退役键，防止它们被带回来：
      · 编辑器 8090 常年开着，浏览器标签页里的内存副本可能是改动前的 →
        点一次「保存全部」就会把 coop/energy 写回真源（用户原话：「说不定又回来了」）；
      · 编辑器 backups/ 里也有旧快照，若将来做「从备份恢复」同样会带回来。

    ⚠️ 只删这两个**明确退役**的键，不做白名单 —— 否则将来新增属性会被静默丢弃，
    变成更难查的一类 BUG。"""
    try:
        if not isinstance(cfg, dict):
            return cfg
        for e in (cfg.get("ENGINEERS") or []):
            if not isinstance(e, dict):
                continue
            if isinstance(e.get("stats"), dict):
                e["stats"].pop("coop", None)
                e["stats"].pop("energy", None)
            # 2026-09-16 二轮（用户「infra/工程词条都删干净没有」）：词条 type=engineer
            # 改值成 pretrain（**不删数组元素**，下标保持对齐——deepMerge 对象数组按下标
            # 合并的老坑 doc/04；engineer 是 Lv1 副词条永不成为主词条，产出不变）。
            if isinstance(e.get("traits"), list):
                for t in e["traits"]:
                    if isinstance(t, dict) and t.get("type") == "engineer":
                        t["type"] = "pretrain"
        # 2026-09-16 二轮：V35.HIRE_ROLES.infra（Infra 架构岗位，2026-09-09 退役）
        # 与 PROD_TRAIT_MUL.engineer（词条池已无 engineer）一起清掉，防写回真源。
        v35 = cfg.get("V35")
        if isinstance(v35, dict):
            hr = v35.get("HIRE_ROLES")
            if isinstance(hr, dict):
                hr.pop("infra", None)
            ptm = v35.get("PROD_TRAIT_MUL")
            if isinstance(ptm, dict):
                ptm.pop("engineer", None)
        st = cfg.get("ENG_STATUS")
        if isinstance(st, dict):
            st.pop("ENERGY_FROM_STATS", None)      # 随「精力」一起删除的旧开关
    except Exception as e:
        print("[game_cfg] 退役字段清理失败:", e)
    return cfg


def purge_retired_keys(cfg):
    """2026-09-12：**已退役的键**统一在读/写两端清掉（与 tools/sync_cfg_jsons.js 的 RETIRED 同源）。

    用户拍板「游戏还没上线，记事本的老键（alias）也删掉，上线之后就不能了」——
    记事本兼容层从此只留一套 ID：
      · 顶层老表 `NOTEBOOK`（"cat" → 展示名/描述）
      · `CHAT_TREE2.NOTES[*].alias`（老存档里的键）

    ⚠️ 为什么两端都要清：编辑器 8090 常年开着，**浏览器标签页里的内存副本可能是改动前的**，
    点一次「保存全部」就会把退役键写回真源（和 coop/energy 那次一模一样）。
    只删**明确退役**的键，不做白名单 —— 否则将来新增字段会被静默丢弃。"""
    try:
        if not isinstance(cfg, dict):
            return cfg
        cfg.pop("NOTEBOOK", None)
        # [feature:retired-stage-budget-server]
        cfg.pop("STAGE_BUDGET", None)  # No stage-entry grants; stale editor saves cannot restore it.
        # [/feature:retired-stage-budget-server]
        notes = ((cfg.get("CHAT_TREE2") or {}).get("NOTES"))
        if isinstance(notes, dict):
            for v in notes.values():
                if isinstance(v, dict):
                    v.pop("alias", None)
        # 2026-09-12（用户拍板：招聘概率改由「池子分布 + 等级权重」决定）——
        # 旧的稀有度权重四件套 + 旧的等级概率/下限一起退役。
        for k in ("HIRE_WEIGHTS", "HIRE_STAGE_COEF", "HIRE_REPUTATION_COEF",
                  "RARITY_TALENT_FLOOR"):
            cfg.pop(k, None)
        lvr = cfg.get("HIRE_LV_RANGE_BY_VER")
        if isinstance(lvr, dict):
            for v in lvr.values():
                if isinstance(v, dict):
                    v.pop("dist", None)   # 旧形状 {min,max,dist} → 新形状 {max,lv}
                    v.pop("min", None)    # 下限统一 Lv1，不再配
        # 2026-09-13（C 方案「双线制」）：架构的「通过门槛系数」passMul 退役 ——
        # 评审线改为按任务钉死的 (架构,参数) 组合实测标定（REVIEW.BY_VER），
        # 架构特征已含在实测值里，再乘一次是重复计算 → 引擎不再读它。
        # 2026-09-13：能力榜「手写名次 / 能力分」退役（榜单分取消，统一用评审分）。
        cfg.pop("RANK_HEAT_BY_VER", None)
        # 2026-09-19（用户拍板）：PUBLIC_BY_VER 退役 —— 死配置（唯一读它的
        # game_core.triggerEvents() 全项目无调用方）。对外事件的阶段门槛改用各事件的 stages。
        cfg.pop("PUBLIC_BY_VER", None)
        for a in (cfg.get("ARCHITECTURES") or []):
            if isinstance(a, dict):
                a.pop("passMul", None)
    except Exception as e:
        print("[game_cfg] 退役键清理失败:", e)
    return cfg


def purge_retired_game_cfg(cfg):
    """读写两端统一走这里：所有「已退役、不许回潮」的清理都挂在这。"""
    return purge_retired_keys(purge_retired_engineer_stats(cfg))


def _deep_merge_cfg(base, over):
    """base 分支专用合并（2026-09-06 架构加固）：对象递归合并；数组/标量整体替换。
    与游戏端 game_cfg.js 的 deepMerge 同语义——前端改为稀疏提交（只提交 ≠ 当前
    出厂默认的子键）后，JSON 里永远只留用户真实自定义值，代码默认值不再被
    编辑器表单视图成批钉死；两个分页写同一个对象（如 EVAL_SHOW：玩法配置页写
    演出节奏、界面立绘页写 ROLE_PORTS）也只各写各的子键，不再整对象互相覆盖。"""
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_merge_cfg(base[k], v)
        else:
            base[k] = v
    return base


def save_game_cfg(cfg):
    cfg = purge_retired_game_cfg(cfg)      # 写盘前兜底：退役字段绝不允许写回真源
    # 完整序列化后才碰磁盘；临时文件替换避免截断已有配置。
    payload = json.dumps(cfg, ensure_ascii=False, indent=2, allow_nan=False)
    staged = []
    try:
        for target in (H5_GAME_CFG, GAME_CFG_CONFIG):
            directory = os.path.dirname(os.path.abspath(target))
            os.makedirs(directory, exist_ok=True)
            fd, temporary = tempfile.mkstemp(prefix=".game-cfg-", suffix=".tmp", dir=directory)
            staged.append((temporary, target))
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(payload)
                f.flush()
                os.fsync(f.fileno())
        # 真源必须先成功；镜像失败也应返回错误，不能假报「全部已保存」。
        for temporary, target in staged:
            os.replace(temporary, target)
    finally:
        for temporary, _ in staged:
            if os.path.exists(temporary):
                os.unlink(temporary)
    return True


def list_bgm():
    """BGM 素材库（resource/sound/BGM），仅音频文件。"""
    if not os.path.isdir(BGM_DIR):
        return []
    return sorted(f for f in os.listdir(BGM_DIR)
                  if os.path.isfile(os.path.join(BGM_DIR, f))
                  and f.lower().endswith((".mp3", ".wav", ".ogg", ".m4a")))


def sync_bgm(cfg):
    """把 BGM 配置同步到游戏运行时（资源统一在 resource，不再复制副本）：
    直接写 resource/sound/BGM/<原名> 路径到 h5_demo/data/bgm_config.json。
    2026-09-04：新增 review（评审）/ bonus（结算）两个槽位，玩法这两个界面单独配乐。"""
    info = {"menu": "", "scene": "", "review": "", "bonus": ""}
    for key, fn in (cfg or {}).items():
        if key not in ("menu", "scene", "review", "bonus") or not fn:
            continue
        if os.path.exists(os.path.join(BGM_DIR, os.path.basename(fn))):
            info[key] = "resource/sound/BGM/" + os.path.basename(fn)
    # ⚠️⚠️ 2026-09-22 防护（用户报「游戏现在 BGM 没声音了」）：
    #   根目录 bgm_config.json **不存在**时，load_bgm_config() 会兜底返回空配置，
    #   于是**任何一次同步都会把游戏端已配好的 BGM 静默清空**（实测 09-18 已被清过一次）。
    #   ⇒ 根配置缺失 + 游戏端还有值 ⇒ 保留游戏端，不用兜底空值覆盖。
    #   （用户**主动**清空 BGM 时根文件是存在的、只是内容为空 ⇒ 不受影响，照常写空。）
    if not os.path.exists(BGM_CONFIG):
        try:
            _p = os.path.join(H5_DEMO, "data", "bgm_config.json")
            if os.path.exists(_p):
                with open(_p, encoding="utf-8") as f:
                    _old = json.load(f) or {}
                if any((_old or {}).values()):
                    print("[runtime] BGM 同步被拦：根配置 bgm_config.json 缺失，保留游戏端现有配置（防误清空）")
                    return _old
        except Exception:
            pass
    try:
        os.makedirs(os.path.join(H5_DEMO, "data"), exist_ok=True)
        with open(os.path.join(H5_DEMO, "data", "bgm_config.json"), "w", encoding="utf-8") as f:
            json.dump(info, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    return info


# ---------------------------------------------------------------- 历史回溯 --
# §二.6「历史记录 + 恢复默认」+ §十「改前备份、改后可回滚」：
# 每次保存/关键操作前把配置快照到 backups/<时间戳>_<原因>/，含 SHA256 清单。
# 前端可在「历史回溯」页一键恢复任意快照或恢复出厂默认。
CONFIG_FILES = [
    ("project.json", lambda: os.path.join(ROOT, "project.json")),
    ("sfx_config.json", lambda: SFX_CONFIG),
    ("bgm_config.json", lambda: BGM_CONFIG),
    ("game_cfg_config.json", lambda: GAME_CFG_CONFIG),
    ("server_config.json", lambda: CONFIG),
]


def snapshot_configs(reason="save"):
    """快照当前配置 → 返回 manifest。超上限清理最旧。"""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    bid = "%s_%s" % (ts, reason)
    sub = os.path.join(BACKUP_DIR, bid)
    os.makedirs(sub, exist_ok=True)
    files = {}
    for name, fpfn in CONFIG_FILES:
        fp = fpfn()
        if os.path.isfile(fp):
            try:
                data = open(fp, "rb").read()
                with open(os.path.join(sub, name), "wb") as f:
                    f.write(data)
                files[name] = hashlib.sha256(data).hexdigest()[:12]
            except Exception:
                pass
    manifest = {
        "id": bid,
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "reason": reason,
        "files": list(files.keys()),
        "size": sum(os.path.getsize(os.path.join(sub, n)) for n in files if os.path.exists(os.path.join(sub, n))),
    }
    try:
        with open(os.path.join(sub, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    # 清理：只保留最近 MAX_BACKUPS 个（§十 备份纪律）
    snaps = sorted(d for d in os.listdir(BACKUP_DIR)
                   if os.path.isdir(os.path.join(BACKUP_DIR, d)))
    while len(snaps) > MAX_BACKUPS:
        shutil.rmtree(os.path.join(BACKUP_DIR, snaps[0]), ignore_errors=True)
        snaps.pop(0)
    return manifest


def list_backups():
    if not os.path.isdir(BACKUP_DIR):
        return []
    out = []
    for d in sorted(os.listdir(BACKUP_DIR), reverse=True):
        mp = os.path.join(BACKUP_DIR, d, "manifest.json")
        if os.path.isfile(mp):
            try:
                with open(mp, encoding="utf-8") as f:
                    m = json.load(f)
                out.append(m)
            except Exception:
                pass
    return out


def restore_backup(bid):
    """恢复某快照：把快照内配置文件复制回 editor/ 并重新同步运行时。返回恢复的文件名列表。"""
    if not re.fullmatch(r"[\w\-]+", bid or ""):
        raise ValueError("非法快照 id")
    sub = os.path.join(BACKUP_DIR, bid)
    if not os.path.isdir(sub):
        raise ValueError("快照不存在")
    restored = []
    for name, fpfn in CONFIG_FILES:
        src = os.path.join(sub, name)
        if os.path.isfile(src):
            shutil.copyfile(src, fpfn())
            restored.append(name)
    # 重新同步运行时（项目 + 音效 + BGM）
    try:
        with open(os.path.join(ROOT, "project.json"), encoding="utf-8") as f:
            build_runtime(json.load(f))
    except Exception:
        pass
    try:
        sync_bgm(load_bgm_config())
    except Exception:
        pass
    return restored


def delete_backup(bid):
    if not re.fullmatch(r"[\w\-]+", bid or ""):
        raise ValueError("非法快照 id")
    sub = os.path.join(BACKUP_DIR, bid)
    if os.path.isdir(sub):
        shutil.rmtree(sub, ignore_errors=True)
    return True


def reset_defaults():
    """恢复出厂默认：先把当前配置快照（可回滚），再把项目/音效/BGM 配置重置为最小默认。"""
    snapshot_configs("before_reset")
    os.makedirs(ROOT, exist_ok=True)
    # 最小默认项目：一个空白场景，尺寸沿用当前场景图（若无则 2048²）
    cur = {}
    try:
        with open(os.path.join(ROOT, "project.json"), encoding="utf-8") as f:
            cur = json.load(f)
    except Exception:
        pass
    bgw = 2048; bgh = 2048
    if cur.get("scenes") and cur["scenes"][0].get("bgW"):
        bgw = cur["scenes"][0]["bgW"]; bgh = cur["scenes"][0].get("bgH", bgw)
    default = {
        "version": 1,
        "scenes": [{
            "id": "s_default", "name": "场景1",
            "bg": (cur.get("scenes") or [{}])[0].get("bg", ""),
            "bgW": bgw, "bgH": bgh,
            "spawn": {"x": bgw / 2, "y": bgh * 0.6},
            "camera": {"w": 900, "h": 600, "zoom": 1, "device": "pc", "centerOffsetY": -80,
                       "cx": bgw / 2, "cy": bgh * 0.6 - 80},
            "player": {"src": "stand.webp", "scale": 1},
            "objects": [],
        }],
        "active": 0,
    }
    with open(os.path.join(ROOT, "project.json"), "w", encoding="utf-8") as f:
        json.dump(default, f, ensure_ascii=False, indent=2)
    save_sfx_config({"events": {}})
    save_bgm_config({"menu": "", "scene": ""})
    try:
        os.remove(GAME_CFG_CONFIG)
    except Exception:
        pass
    try:
        os.remove(H5_GAME_CFG)
    except Exception:
        pass
    try:
        build_runtime(default)
    except Exception:
        pass
    return True


def http_get(url, timeout=4, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def http_post_json(url, payload, timeout=120, headers=None):
    data = json.dumps(payload).encode("utf-8")
    hdrs = {"Content-Type": "application/json"}
    hdrs.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=hdrs, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ctype = r.headers.get("Content-Type", "")
        return r.status, ctype, r.read()


# ------------------------------------------------------------------ 抠图/压缩 --
def green_screen_key(img, thresh=18, min_g=112, feather=1.5):
    """绿幕抠图：绿色背景转透明（向量化，速度快）。"""
    img = img.convert("RGB")
    r, g, b = img.split()
    m1 = ImageChops.subtract(g, r).point(lambda v: 255 if v > thresh else 0)
    m2 = ImageChops.subtract(g, b).point(lambda v: 255 if v > thresh else 0)
    m3 = g.point(lambda v: 255 if v > min_g else 0)
    mask = ImageChops.multiply(ImageChops.multiply(m1, m2), m3)
    mask = ImageChops.invert(mask).filter(ImageFilter.GaussianBlur(feather))
    rgba = img.convert("RGBA")
    rgba.putalpha(mask)
    return rgba


def white_bg_key(img, feather=0.9, t0=32, t1=80):
    """白底抠图：白色背景转透明（含羽化 + 中值去噪）。"""
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    # 背景色 = 四角/边缘采样中位数（白底通常接近白，允许轻微色偏）
    samples = []
    for (x, y) in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2),
                   (w // 2, 1), (1, h // 2), (w - 2, h // 2), (w // 2, h - 2)]:
        if 0 <= x < w and 0 <= y < h:
            samples.append(px[x, y])
    bg = [round(sum(c[i] for c in samples) / len(samples)) for i in range(3)]
    alpha = Image.new("L", (w, h))
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            ap[x, y] = 0 if d <= t0 else (255 if d >= t1 else int(255 * (d - t0) / (t1 - t0)))
    alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    alpha = alpha.filter(ImageFilter.MedianFilter(3))
    rgba = img.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba


def detect_bg_mode(img):
    """自动检测抠图模式：四角颜色若绿色主导 → 绿幕；接近白 → 白底；否则绿幕兜底。"""
    img = img.convert("RGB")
    w, h = img.size
    corners = []
    for (x, y) in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2), (w // 2, 1), (1, h // 2)]:
        if 0 <= x < w and 0 <= y < h:
            corners.append(img.getpixel((x, y)))
    r_avg = sum(c[0] for c in corners) / len(corners)
    g_avg = sum(c[1] for c in corners) / len(corners)
    b_avg = sum(c[2] for c in corners) / len(corners)
    if g_avg - r_avg > 30 and g_avg - b_avg > 30:
        return "green"
    if r_avg > 235 and g_avg > 235 and b_avg > 235:
        return "white"
    return "green"


def despill(im, strength=40):
    """去除边缘绿边。"""
    r, g, b, a = im.split()
    spill = ImageChops.subtract(g, r).point(lambda v: min(255, v) if v > 6 else 0)
    scale = spill.point(lambda v: v * strength // 100)
    g_down = ImageChops.subtract(g, scale)
    sel = spill.point(lambda v: 255 if v > 6 else 0)
    return Image.merge("RGBA", (r, ImageChops.composite(g_down, g, sel), b, a))


def clean_rgb_of_transparent(im):
    """把 alpha=0 的像素 RGB 归零，保证透明底干净。"""
    r, g, b, a = im.split()
    keep = a.point(lambda v: 255 if v > 0 else 0)
    return Image.merge("RGBA", (
        ImageChops.multiply(r, keep),
        ImageChops.multiply(g, keep),
        ImageChops.multiply(b, keep), a))


def process_image(data: bytes, cutout: bool, quality=85, cutout_mode="auto"):
    """处理单张图片：cutout=True 抠图(保留透明)；否则直接压缩。输出 WebP。
    cutout_mode: auto(自动检测) / green(绿幕) / white(白底)"""
    im = Image.open(io.BytesIO(data))
    if cutout:
        mode = cutout_mode
        if mode == "auto":
            mode = detect_bg_mode(im)
        if mode == "white":
            im = clean_rgb_of_transparent(white_bg_key(im))
        else:
            im = clean_rgb_of_transparent(despill(green_screen_key(im)))
    else:
        im = im.convert("RGBA")
    out = io.BytesIO()
    im.save(out, "WEBP", quality=quality, method=6)
    return out.getvalue()


# ------------------------------------------------------------------ 运行时同步 --
def build_runtime(pdata):
    """把项目数据同步到 h5_demo 运行时：
    - 资源统一引用 resource/（不再复制副本到 h5_demo/assets，用户改 resource 即生效）
    - 写 h5_demo/data/project.json / sfx_config.json / bgm_config.json（游戏端读取）
    """
    os.makedirs(os.path.join(H5_DEMO, "data"), exist_ok=True)

    def res_path(subdir, name):
        return "resource/" + subdir + "/" + os.path.basename(name)

    scenes = pdata.get("scenes", []) or []
    for si, s in enumerate(scenes):
        bg = s.get("bg")
        if bg and not bg.startswith("data:"):
            s["bg"] = res_path("scene", bg)
        pl = s.get("player") or {}
        if pl.get("src") and not pl["src"].startswith("data:"):
            pl["src"] = res_path("character", pl["src"])
        for oi, o in enumerate(s.get("objects", []) or []):
            src = o.get("src")
            if not src or src.startswith("data:"):
                continue
            m = re.match(r"^/resource/([^/]+)/(.+)$", src)
            if m:
                o["src"] = "resource/%s/%s" % (m.group(1), m.group(2))
            else:
                o["src"] = "resource/event/" + os.path.basename(src)

    with open(os.path.join(H5_DEMO, "data", "project.json"), "w", encoding="utf-8") as f:
        json.dump(pdata, f, ensure_ascii=False, indent=2)

    # ---- 音效配置同步：直接写 resource/sound/sfx/<原名> 路径（不复制） ----
    try:
        events = {}
        # [feature:sfx-candidate-api-4]
        sfx_cfg = load_sfx_config()
        for k, fn in (sfx_cfg.get("events") or {}).items():
        # [/feature:sfx-candidate-api-4]
            if not fn:
                events[k] = ""
                continue
            if os.path.exists(os.path.join(SFX_DIR, os.path.basename(fn))):
                events[k] = "resource/sound/sfx/" + os.path.basename(fn)
            else:
                events[k] = ""
        # ⚠️ 2026-09-22 防护（与 sync_bgm 同一类隐患）：根目录 sfx_config.json 缺失时
        #   load_sfx_config() 兜底为空 ⇒ 会把游戏端已配好的音效映射清空。新值全空而旧值非空 ⇒ 保留旧值。
        _skip = False
        if not os.path.exists(SFX_CONFIG):
            try:
                _p2 = os.path.join(H5_DEMO, "data", "sfx_config.json")
                if os.path.exists(_p2):
                    with open(_p2, encoding="utf-8") as f:
                        _old2 = (json.load(f) or {}).get("events") or {}
                    if any(_old2.values()) and not any(events.values()):
                        print("[runtime] 音效同步被拦：根配置 sfx_config.json 缺失，保留游戏端现有配置（防误清空）")
                        _skip = True
            except Exception:
                pass
        if not _skip:
            with open(os.path.join(H5_DEMO, "data", "sfx_config.json"), "w", encoding="utf-8") as f:
                # [feature:sfx-candidate-api-5]
                json.dump(dict(sfx_cfg, events=events), f, ensure_ascii=False, indent=2)
                # [/feature:sfx-candidate-api-5]
    except Exception as e:
        print("[runtime] 音效配置同步失败:", e)

    # ---- BGM 同步：直接写 resource/sound/BGM/<原名> 路径（不复制） ----
    try:
        sync_bgm(load_bgm_config())
    except Exception as e:
        print("[runtime] BGM 配置同步失败:", e)


# ------------------------------------------------------------------ 音效生成 --
def sfx_platform_status():
    """探测生成平台状态：ElevenLabs 是否配 key；本地模型是否在线。"""
    cfg = load_config()
    key = cfg.get("elevenlabs_api_key", "")
    local = {"online": False}
    url = cfg.get("local_sfx_url", "http://127.0.0.1:7861").rstrip("/")
    try:
        st, body = http_get(url + "/api/health", timeout=2.5)
        if st == 200:
            local["online"] = True
            try:
                local.update(json.loads(body.decode("utf-8", "ignore")))
            except Exception:
                pass
    except Exception:
        pass
    return {
        "elevenlabs": {"configured": bool(key), "key_present": bool(key)},
        "local": local,
        "local_url": url,
    }


def save_audio_bytes(data: bytes, subdir, prefix):
    """落盘音频字节到已校验的声音目录或 tmp 待选目录，返回文件名。"""
    # [feature:sfx-candidate-api-6]
    prefix = resource_filename(prefix)
    if not isinstance(data, bytes) or not data:
        raise ValueError("生成音频为空。")
    # [/feature:sfx-candidate-api-6]
    os.makedirs(subdir, exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    if data[:4] == b"RIFF":
        ext = ".wav"
    elif data[4:8] == b"ftyp":
        ext = ".m4a"          # MP4 容器（AAC/ALAC）
    else:
        ext = ".mp3"
    # [feature:sfx-candidate-api-7]
    # Exclusive creation keeps every candidate, even within one millisecond or
    # when multiple generator requests finish concurrently.
    descriptor, path = tempfile.mkstemp(prefix=prefix + "_" + stamp + "_", suffix=ext, dir=subdir)
    with os.fdopen(descriptor, "wb") as f:
    # [/feature:sfx-candidate-api-7]
        f.write(data)
    # [feature:sfx-candidate-api-8]
    return os.path.basename(path)
    # [/feature:sfx-candidate-api-8]


# ------------------------------------------------------------------ 程序化合成 --
# 与游戏运行时 js/sfx.js 的内置程序化音效同款设计（振荡器 + 音高包络 + 音量包络），
# 纯 stdlib 合成 WAV：无 Key / 无本地模型也能一键生成，保证「生成」永远可用。
SIN = "sine"
TRI = "triangle"
# event -> [(波形, 起始Hz, 结束Hz, 时长s, 峰值, 起始偏移s)]
SYNTH_SPECS = {
    "move":    [(TRI, 620, 900, 0.085, 0.50, 0.0)],
    "click":   [(SIN, 880, 760, 0.070, 0.70, 0.0)],
    "ui":      [(TRI, 520, 720, 0.090, 0.60, 0.0)],
    "float":   [(SIN, 1320, 1760, 0.085, 0.45, 0.0), (SIN, 1760, 2100, 0.100, 0.35, 0.05)],
    "confirm": [(SIN, 700, 1040, 0.120, 0.60, 0.0), (SIN, 1040, 1220, 0.140, 0.55, 0.06)],
}


def synth_tone_samples(waveform, f0, f1, dur, peak, sr):
    """单个音：指数频率包络 + 快起音/指数衰减，返回 float 采样列表。"""
    n = max(1, int(dur * sr))
    out = []
    phase = 0.0
    attack = 0.012
    for i in range(n):
        prog = i / max(1, n - 1)
        f = f0 * math.pow(f1 / f0, prog)          # 指数频率包络（同 WebAudio expRamp）
        phase += 2 * math.pi * f / sr
        if waveform == TRI:
            s = (2 / math.pi) * math.asin(math.sin(phase))   # 三角波
        else:
            s = math.sin(phase)
        t = i / sr
        if t < attack:
            env = peak * (t / attack)             # 快起音
        else:
            rt = (t - attack) / max(0.0001, dur - attack)
            env = peak * math.pow(0.0001, rt)     # 指数衰减
        out.append(s * env)
    return out


def synth_event_samples(event, sr=44100):
    """合成事件 → float 采样列表（多音叠加，如 confirm 双音）。"""
    tones = SYNTH_SPECS.get(event) or SYNTH_SPECS["ui"]
    end = max(off + d for (_w, _a, _b, d, _p, off) in tones)
    n = int(end * sr) + 1
    buf = [0.0] * n
    for (waveform, f0, f1, dur, peak, off) in tones:
        s = synth_tone_samples(waveform, f0, f1, dur, peak, sr)
        base = int(off * sr)
        for i, v in enumerate(s):
            if base + i < n:
                buf[base + i] += v
    peakv = max(1e-9, max(abs(v) for v in buf))
    if peakv > 1.0:
        buf = [v / peakv for v in buf]
    return buf


def synth_wav_bytes(event, sr=44100):
    """合成事件 → RIFF WAV 字节（16bit 单声道）。"""
    samples = synth_event_samples(event, sr)
    bio = io.BytesIO()
    w = wave.open(bio, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes(b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, v)) * 32767)) for v in samples))
    w.close()
    return bio.getvalue()


def generate_elevenlabs(text, duration, influence, loop):
    """ElevenLabs 在线音效生成（§9.1）。返回 (ok, err, audio_bytes)。"""
    cfg = load_config()
    key = cfg.get("elevenlabs_api_key", "")
    if not key:
        return False, "未配置 ElevenLabs API Key（editor/server_config.json）", None
    payload = {
        "text": text,
        "prompt_influence": float(influence),
        "duration_seconds": float(duration),
        "loop": bool(loop),
    }
    url = "https://api.elevenlabs.io/v1/sound-generation?model_id=eleven_text_to_sound_v2"
    try:
        st, ctype, body = http_post_json(url, payload, timeout=120,
                                         headers={"xi-api-key": key})
        if st != 200:
            return False, "ElevenLabs %d: %s" % (st, body[:200].decode("utf-8", "ignore")), None
        if "audio" not in (ctype or ""):
            # 可能是 JSON 错误包
            return False, "ElevenLabs 返回非音频: " + body[:200].decode("utf-8", "ignore"), None
        return True, "", body
    except Exception as e:
        return False, "ElevenLabs 请求失败: %s" % e, None


def generate_local(prompt, duration, steps, cfg_scale, seed, negative):
    """本地 Stable Audio 生成（§9.1）。返回 (ok, err, audio_bytes)。"""
    cfg = load_config()
    url = cfg.get("local_sfx_url", "http://127.0.0.1:7861").rstrip("/")
    payload = {
        "prompt": prompt,
        "duration": float(duration),
        "steps": int(steps),
        "cfg_scale": float(cfg_scale),
        "seed": int(seed),
        "negative_prompt": negative,
    }
    try:
        st, ctype, body = http_post_json(url + "/api/generate", payload, timeout=300)
        if st != 200:
            return False, "本地模型 %d" % st, None
        # 响应可能是音频字节 或 JSON{base64/path/url}
        if body[:4] == b"RIFF" or "audio" in (ctype or "") or body[:2] in (b"ID", b"\xff\xfb", b"\x49\x44"):
            return True, "", body
        try:
            obj = json.loads(body.decode("utf-8", "ignore"))
        except Exception:
            return False, "本地模型返回无法识别的数据", None
        if obj.get("base64"):
            return True, "", base64.b64decode(obj["base64"])
        p = obj.get("path") or obj.get("url")
        if p:
            if p.startswith("http"):
                _, audio = http_get(p, timeout=60)
            else:
                with open(p, "rb") as f:
                    audio = f.read()
            return True, "", audio
        return False, "本地模型返回缺少音频数据", None
    except Exception as e:
        return False, "本地模型请求失败: %s" % e, None


def generate_sfx(req):
    """统一生成入口。返回 dict{ok,error,name,list}。"""
    platform = req.get("platform", "elevenlabs")
    # [feature:sfx-candidate-api-9]
    event = resource_filename(req.get("event", "move"))
    prompt = req.get("prompt") or ""
    if not isinstance(prompt, str):
        raise ValueError("提示词必须是文本。")
    # [/feature:sfx-candidate-api-9]
    duration = float(req.get("duration", 3))
    influence = float(req.get("influence", 0.3))
    loop = bool(req.get("loop", False))
    if platform == "elevenlabs":
        ok, err, audio = generate_elevenlabs(prompt, duration, influence, loop)
        if not ok:
            return {"ok": False, "error": err}
        name = save_audio_bytes(audio, SFX_TMP, event)
    elif platform == "local":
        ok, err, audio = generate_local(prompt, duration,
                                        int(req.get("steps", 30)),
                                        float(req.get("cfg_scale", 3.0)),
                                        int(req.get("seed", -1)),
                                        req.get("negative_prompt", "") or "")
        if not ok:
            return {"ok": False, "error": err}
        name = save_audio_bytes(audio, SFX_TMP, event)
    else:
        return {"ok": False, "error": "未知生成平台: %s" % platform}
    return {"ok": True, "name": name, "list": list_sfx_tmp()}


# [feature:sfx-candidate-api-10]
def sfx_candidate_path(name):
    """A selected preview must be a direct audio file inside the pending directory."""
    name = resource_filename(name)
    if not name.lower().endswith((".wav", ".mp3", ".ogg", ".m4a")):
        raise ValueError("候选音效必须是音频文件。")
    base = os.path.realpath(SFX_TMP)
    source = os.path.realpath(os.path.join(base, name))
    if os.path.dirname(source) != base or not os.path.isfile(source):
        raise ValueError("候选音效不在待选目录内或已不存在。")
    return source


# [/feature:sfx-candidate-api-10]
def list_sfx_tmp():
    if not os.path.isdir(SFX_TMP):
        return []
    # [feature:sfx-candidate-api-11]
    files = []
    for name in os.listdir(SFX_TMP):
        try:
            sfx_candidate_path(name)
            files.append(name)
        except ValueError:
            pass
    return sorted(files)
    # [/feature:sfx-candidate-api-11]


def list_sfx():
    if not os.path.isdir(SFX_DIR):
        return []
    return sorted(f for f in os.listdir(SFX_DIR) if os.path.isfile(os.path.join(SFX_DIR, f)))


# ------------------------------------------------------------------ HTTP 服务 --
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # 静默访问日志

    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    # [feature:editor-media-http-head]
    def do_HEAD(self):
        path = urllib.parse.unquote(self.path.split("?")[0])
        if path.startswith("/api/"):
            self.send_response(405)
            self.send_header("Allow", "GET, POST")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path.startswith("/resource/"):
            try:
                fp = resource_path(path[len("/resource/"):])
            except ValueError:
                return self.send_error(404)
        elif path.startswith("/h5_demo/js/features/"):
            name = path[len("/h5_demo/js/features/"):]
            if name not in SHARED_LIFE_SCRIPTS:
                return self.send_error(404)
            fp = os.path.join(H5_DEMO, "js", "features", name)
        else:
            fp = os.path.abspath(os.path.join(ROOT, path.lstrip("/") or "index.html"))
            if os.path.commonpath((os.path.abspath(ROOT), fp)) != os.path.abspath(ROOT):
                return self.send_error(404)
        ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
        return serve_file(self, fp, ctype)

    # ---------------------------------------------------------- GET
    # [/feature:editor-media-http-head]
    def do_GET(self):
        # URL 解码（参考几何战争 server.mjs：decodeURIComponent）——
        # 文件名带空格/中文时浏览器会百分号编码，不解码会 404（BGM 试听无声的根因）
        path = urllib.parse.unquote(self.path.split("?")[0])

        # [feature:seed-audio-server-get]
        if seed_audio.handle_http(self, "GET", serve_file):
            return
        # [/feature:seed-audio-server-get]
        if path == "/api/load-project":
            fp = os.path.join(ROOT, "project.json")
            if os.path.exists(fp):
                with open(fp, "rb") as source:
                    body = source.read()
                try:
                    body = json.dumps(canonical_resource_value(json.loads(body)), ensure_ascii=False).encode("utf-8")
                except (ValueError, UnicodeError):
                    pass
                self._send(200, "application/json", body)
            else:
                self._send(200, "application/json", b"{}")
            return

        if path == "/api/list-dirs":
            dirs = [d for d in sorted(os.listdir(RESOURCE))
                    if os.path.isdir(os.path.join(RESOURCE, d))]
            self._send(200, "application/json",
                       json.dumps({"dirs": dirs}).encode("utf-8"))
            return

        if path.startswith("/api/list-files/"):
            d = path[len("/api/list-files/"):]
            try:
                dpath = resource_path(d, directory=True)
            except ValueError:
                self._send(200, "application/json", b'{"files":[]}')
                return
            if os.path.isdir(dpath):
                files = sorted(f for f in os.listdir(dpath)
                               if os.path.isfile(os.path.join(dpath, f)))
                self._send(200, "application/json",
                           json.dumps({"files": files}).encode("utf-8"))
            else:
                self._send(200, "application/json", b'{"files":[]}')
            return

        # ---------- 音效配置 API ----------
        if path == "/api/sfx-status":
            self._send(200, "application/json",
                       json.dumps(sfx_platform_status()).encode("utf-8"))
            return

        if path == "/api/sfx-list":
            self._send(200, "application/json",
                       json.dumps({"files": list_sfx()}).encode("utf-8"))
            return

        if path == "/api/sfx-list-tmp":
            self._send(200, "application/json",
                       json.dumps({"files": list_sfx_tmp()}).encode("utf-8"))
            return

        if path == "/api/sfx-config":
            self._send(200, "application/json",
                       json.dumps(load_sfx_config()).encode("utf-8"))
            return

        if path == "/api/bgm-list":
            self._send(200, "application/json",
                       json.dumps({"files": list_bgm()}).encode("utf-8"))
            return

        if path == "/api/bgm-config":
            self._send(200, "application/json",
                       json.dumps(load_bgm_config()).encode("utf-8"))
            return

        if path == "/api/history-list":
            self._send(200, "application/json",
                       json.dumps({"backups": list_backups()}).encode("utf-8"))
            return

        if path == "/api/game-cfg":
            mtime = None
            try:
                if os.path.isfile(H5_GAME_CFG):
                    mtime = round(os.path.getmtime(H5_GAME_CFG) * 1000)
            except Exception:
                pass
            self._send(200, "application/json",
                       json.dumps({"config": load_game_cfg(), "mtime": mtime}).encode("utf-8"))
            return

        if path == "/api/save-status":
            # 供前端展示最近一次保存/同步状态（读 h5_demo 运行时文件时间戳）
            try:
                status = {}
                for key in ("project.json", "sfx_config.json", "bgm_config.json"):
                    fp = os.path.join(H5_DEMO, "data", key)
                    if os.path.isfile(fp):
                        status[key] = time.strftime("%Y-%m-%d %H:%M:%S",
                                                    time.localtime(os.path.getmtime(fp)))
                self._send(200, "application/json", json.dumps(status).encode("utf-8"))
            except Exception:
                self._send(200, "application/json", b"{}")
            return

        if path == "/api/server-config":
            cfg = load_config()
            self._send(200, "application/json",
                       json.dumps({"elevenlabs_key_set": bool(cfg.get("elevenlabs_api_key")),
                                   "local_sfx_url": cfg.get("local_sfx_url", "http://127.0.0.1:7861")}).encode("utf-8"))
            return

        # The ending preview shares the game's SVG renderer, without a copied
        # implementation or a general-purpose route into the game directory.
    # [feature:editor-media-http-shared-scripts]
        if path.startswith("/h5_demo/js/features/"):
            name = path[len("/h5_demo/js/features/"):]
            if name not in SHARED_LIFE_SCRIPTS:
                self._send(404, "text/plain", b"not found")
                return
            fp = os.path.join(H5_DEMO, "js", "features", name)
            return serve_file(self, fp, "application/javascript; charset=utf-8")
    # [/feature:editor-media-http-shared-scripts]

    # [feature:editor-media-http-resource]
        if path.startswith("/resource/"):
            rel = path[len("/resource/"):]
            try:
                fp = resource_path(rel)
            except ValueError:
                self._send(404, "text/plain", b"not found")
                return
            if os.path.isfile(fp):
                ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
                serve_file(self, fp, ctype)
            else:
                self._send(404, "text/plain", b"not found")
            return

    # [/feature:editor-media-http-resource]
        # 编辑器静态文件
        rel = path.lstrip("/")
        if not rel:
            rel = "index.html"
        # [feature:seed-audio-server-static-boundary]
        fp = os.path.realpath(os.path.join(ROOT, rel))
        try:
            in_editor = os.path.commonpath((os.path.realpath(ROOT), fp)) == os.path.realpath(ROOT)
        except ValueError:
            in_editor = False
        if not in_editor:
            self._send(404, "text/plain", b"not found")
            return
        # [/feature:seed-audio-server-static-boundary]
        if os.path.isfile(fp):
            ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
            self._send(200, ctype, open(fp, "rb").read())
        else:
            self._send(404, "text/plain", b"not found")

    # ---------------------------------------------------------- POST
    def do_POST(self):
        # [feature:seed-audio-server-post]
        if seed_audio.handle_http(self, "POST", serve_file):
            return
        # [/feature:seed-audio-server-post]
        path = self.path
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b""

        if path == "/api/compress":
            try:
                req = json.loads(raw.decode("utf-8"))
                results = []
                for it in req.get("items", []):
                    try:
                        filename = it.get("filename", "")
                        dataUrl = it.get("dataUrl", "")
                        cutout = bool(it.get("cutout", False))
                        cutoutMode = it.get("cutoutMode", "auto")
                        outDir = resource_directory(it.get("outDir", "character"))
                        outName = it.get("outName", "")
                        if "," in dataUrl:
                            b64 = dataUrl.split(",", 1)[1]
                        else:
                            b64 = dataUrl
                        data = base64.b64decode(b64)
                        if not outName:
                            base = os.path.splitext(filename)[0] or "out"
                            outName = base + ".webp"
                        if not outName.lower().endswith((".webp", ".png", ".jpg", ".jpeg")):
                            outName += ".webp"
                        outName = resource_filename(outName)
                        outBytes = process_image(data, cutout, cutout_mode=cutoutMode)
                        outdir_path = os.path.join(RESOURCE, outDir)
                        os.makedirs(outdir_path, exist_ok=True)
                        outPath = os.path.join(outdir_path, outName)
                        with open(outPath, "wb") as f:
                            f.write(outBytes)
                        results.append({
                            "ok": True, "filename": filename,
                            "outPath": os.path.join("resource", outDir, outName),
                            "outKB": round(len(outBytes) / 1024, 1),
                        })
                    except Exception as e:
                        results.append({"ok": False, "filename": it.get("filename", ""), "error": str(e)})
                self._send(200, "application/json",
                           json.dumps({"results": results}).encode("utf-8"))
            except Exception as e:
                self._send(500, "application/json",
                           json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # ---- 语音剪辑（doc/28）：上传 wav → 去静音/裁切/淡入淡出/归一 → 写入指定文件夹 ----
        # 与 /api/compress 同款形状：前端收集 base64 → 后端处理 → 写 RESOURCE/<outDir>。
        if path == "/api/voice-clip":
            try:
                req = json.loads(raw.decode("utf-8"))
                results = []
                for it in req.get("items", []):
                    try:
                        filename = it.get("filename", "")
                        dataUrl = it.get("dataUrl", "")
                        outDir = resource_directory(it.get("outDir") or "sound/voice")
                        outName = (it.get("outName") or "").strip()
                        b64 = dataUrl.split(",", 1)[1] if "," in dataUrl else dataUrl
                        data = base64.b64decode(b64)
                        if not outName:
                            outName = (os.path.splitext(os.path.basename(filename))[0] or "voice") + ".wav"
                        if not outName.lower().endswith(".wav"):
                            outName += ".wav"
                        outName = resource_filename(outName)
                        outBytes, info = voice_proc.process(data, it.get("opts") or {})
                        outdir_path = os.path.join(RESOURCE, outDir)
                        os.makedirs(outdir_path, exist_ok=True)
                        outPath = os.path.join(outdir_path, outName)
                        with open(outPath, "wb") as f:
                            f.write(outBytes)
                        results.append({
                            "ok": True, "filename": filename,
                            # 用正斜杠拼：os.path.join 在 Windows 上会掺反斜杠，前后端显示不一致
                            "outPath": "resource/" + outDir + "/" + outName,
                            "url": "/resource/" + urllib.parse.quote(outDir + "/" + outName),
                            "outKB": round(len(outBytes) / 1024, 1),
                            "info": info,
                        })
                    except Exception as e:
                        results.append({"ok": False, "filename": it.get("filename", ""), "error": str(e)})
                self._send(200, "application/json",
                           json.dumps({"results": results}).encode("utf-8"))
            except Exception as e:
                self._send(500, "application/json",
                           json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if path == "/api/save-project":
            try:
                req = json.loads(raw.decode("utf-8"))
                data = req.get("json", "{}")
                # 防御：json 字段可能是字符串（浏览器 JSON.stringify）或已解析的对象
                # （部分客户端会把内嵌 JSON 字符串自动解析成对象）——统一转回字符串再写盘
                if isinstance(data, dict):
                    data = json.dumps(data, ensure_ascii=False, indent=2)
                elif not isinstance(data, str):
                    data = json.dumps(data, ensure_ascii=False)
                # 保存前先快照当前配置 → 可历史回溯（§二.6 / §十）
                snap = None
                if req.get("snapshot", True):
                    snap = snapshot_configs("save")
                with open(os.path.join(ROOT, "project.json"), "w", encoding="utf-8") as f:
                    f.write(data)
                # 同步运行时数据到 h5_demo（供 8080 游戏端读取）
                try:
                    build_runtime(json.loads(data))
                except Exception as e:
                    print("[runtime] 同步失败:", e)
                self._send(200, "application/json",
                           json.dumps({"ok": True, "snapshot": snap}).encode("utf-8"))
            except Exception as e:
                self._send(500, "application/json",
                           json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if path == "/api/bgm-save":
            try:
                req = json.loads(raw.decode("utf-8"))
                avail = list_bgm()
                # 基于已有配置更新（而不是重建一个只有 menu/scene 的新对象），
                # 这样将来往 bgm_config.json 里加字段也不会被保存动作冲掉
                cfg = load_bgm_config() or {"menu": "", "scene": ""}
                # 2026-09-04：新增评审 / 结算两个槽位（用户要求这两个界面单独配乐）
                for key in ("menu", "scene", "review", "bonus"):
                    fn = (req.get(key) or "").strip()
                    if fn and os.path.basename(fn) in avail:
                        cfg[key] = os.path.basename(fn)
                snapshot_configs("bgm_save")
                save_bgm_config(cfg)
                info = sync_bgm(cfg)
                self._send(200, "application/json",
                           json.dumps({"ok": True, "config": cfg, "synced": info}).encode("utf-8"))
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/game-cfg-save":
            # 玩法配置分区保存（各编辑器页只存自己的区，互不覆盖）：
            # section: base(基础数值浅合并) / EVENTS / ENGINEERS / BUBBLES
            # 2026-09-05 架构修复（用户要求根治「编辑器一保存就把修过的 BUG 带回来」）：
            #   a) expectMtime 守卫——编辑器加载后配置文件若被外部（手工/脚本/另一会话）改过，
            #      保存一律拒绝并提示刷新，杜绝「旧快照静默覆盖外部修复」；
            #   b) base 支持 resetKeys——编辑器只提交「用户实际改过且 ≠ 出厂默认」的键，
            #      改回默认值的键从 JSON 删除（回退代码默认），过期快照无法再被钉进 JSON。
            try:
                req = json.loads(raw.decode("utf-8"))
                cfg = req.get("config")
                section = req.get("section") or ""
                expect_mtime = req.get("expectMtime")
                # --- expectMtime 守卫（客户端拿 /api/game-cfg 返回的 mtime 回传） ---
                # 2026-09-10 加固「配置被重置」：base 分区是**稀疏提交**（只含用户实际改过的键），
                # 天然可安全合并到「最新」配置上、不会覆盖外部修复 —— 所以冲突时不再拒绝，
                # 改为直接合并（并跳过 resetKeys，避免误删外部新增/改过的子键）。
                # 其它分区是整表替换，冲突时仍严格拒绝（否则旧表会盖掉外部修复）。
                cur_mtime = None
                try:
                    if os.path.isfile(H5_GAME_CFG):
                        cur_mtime = round(os.path.getmtime(H5_GAME_CFG) * 1000)
                except Exception:
                    pass
                mtime_conflict = (expect_mtime is not None and cur_mtime is not None
                                  and int(expect_mtime) != int(cur_mtime))
                if mtime_conflict and section != "base":
                    self._send(200, "application/json", json.dumps({
                        "ok": False,
                        "error": "配置文件在编辑器打开期间被外部修改过（可能是手工修复或脚本改写）。"
                                 "为避免旧数据覆盖修复，本次保存已拒绝——请刷新编辑器后重试。",
                    }).encode("utf-8"))
                    return
                # 分区模式下 EVENTS/ENGINEERS 是数组；base 模式必须是 dict
                if section:
                    if cfg is None:
                        raise ValueError("缺少 config")
                    if section == "base" and not isinstance(cfg, dict):
                        raise ValueError("base 分区配置必须是对象")
                else:
                    if not isinstance(cfg, dict):
                        raise ValueError("配置格式错误")
                if section:
                    cur = load_game_cfg()
                    if not cur:
                        cur = {"version": 1}
                    if section == "base":
                        # base 分支是「顶层 key 覆盖」，若提交方把整份配置传上来，
                        # 会把其他分页维护的分区一起覆盖成过期快照。这里兜底剔除。
                        # （前端 GameCfgTool.basePayload() 已只提交 base 字段，这里是双保险）
                        reserved = {"UI_PORTS", "TRAIN_PORTS", "EVENTS",
                                    "ENGINEERS", "BUBBLES", "SCENES", "UI_CFG",
                                    # 2026-09-03：独立分页维护的区，base 提交一律剔除（双保险）
                                    "NEWS_TIMELINE", "OFFICE_HINTS",
                                    "WORK_BUBBLES", "WORK_BUBBLES_TIRED", "WORK_BUBBLES_OFFWORK",
                                    "WORK_BUBBLES_FOCUS", "OFFICE_BUBBLE",
                                    "NEWS_ACCOUNT", "NEWS_PAGE", "CORPUS_QUALITY", "ARCH_QUALITY_REQ",
                                    # 2026-09-13：新闻配图改造后，随机氛围池 NEWS 与
                                    # 「自家模型上线」新闻 NEWS_SELF_RELEASE 也由【新闻与提示】页整区维护
                                    "NEWS", "NEWS_SELF_RELEASE",
                                    # 2026-09-13：【论文】页整区维护（PAPER.POOL / CANDIDATES_BY_VER）
                                    "PAPER",
                                    # 2026-09-16：【成就】页整区维护（新 tab · doc/35 §4.5 方案甲）
                                    # ⚠️ 必须与 gameCfgTool.basePayload() 的 OTHER **同时**登记：
                                    #    只登记一处 ⇒ 另一个方向保存一次就把成就整区静默抹掉
                                    "ACHIEVEMENTS",
                                    # 2026-09-10：鲸鱼剧本分页维护（GIBBERISH / NOTEBOOK）
                                    "GIBBERISH", "NOTEBOOK", "LIFE_STORY", "FACTORY", "CITY_JOURNEY"}
                        cfg = {k: v for k, v in cfg.items() if k not in reserved}
                        # 2026-09-06 架构加固：base 分支改为「对象递归合并」——
                        # 前端只稀疏提交用户改过的子键，这里对应合并进现有 JSON，
                        # 不再把整对象视图成批写回（防「旧默认钉死 / 跨页覆盖」）。
                        # 先记录被删掉的条目（要在合并**之前**取旧值），再合并
                        for _k, _v in list(cfg.items()):
                            if isinstance(_v, list):
                                _record_removed(cur, _k, cur.get(_k), _v)
                        _deep_merge_cfg(cur, cfg)
                        # resetKeys 支持两种写法：段数组 ["V35","STAGES","V1.5","GATE"]
                        # （推荐；阶段键名本身带点，点字符串会拆坏键名）或
                        # 点路径字符串 "V35.JOIN_DATA"（无点键名的简单场景兼容）。
                        # 删除该子键 → 回落代码默认；空中间对象顺带清掉。
                        for rk in ([] if mtime_conflict else (req.get("resetKeys") or [])):
                            if isinstance(rk, (list, tuple)):
                                segs = [str(x) for x in rk]
                            elif isinstance(rk, str) and rk:
                                segs = rk.split(".")
                            else:
                                continue
                            if not segs or segs[0] == "version" or segs[0] in reserved:
                                continue
                            node = cur
                            chain = []
                            ok = True
                            for p in segs[:-1]:
                                if isinstance(node, dict) and p in node:
                                    chain.append((node, p))
                                    node = node[p]
                                else:
                                    ok = False
                                    break
                            if ok and isinstance(node, dict):
                                node.pop(segs[-1], None)
                                for parent, key in reversed(chain):
                                    child = parent.get(key)
                                    if isinstance(child, dict) and not child:
                                        parent.pop(key, None)
                                    else:
                                        break
                    else:
                        _record_removed(cur, section, cur.get(section), cfg)
                        cur[section] = cfg       # 整区替换（EVENTS/ENGINEERS/BUBBLES…）
                    cfg = cur
                snapshot_configs("game_cfg_save")
                save_game_cfg(cfg)
                new_mtime = None
                try:
                    new_mtime = round(os.path.getmtime(H5_GAME_CFG) * 1000)
                except Exception:
                    pass
                self._send(200, "application/json",
                           json.dumps({"ok": True, "mtime": new_mtime,
                                       "merged": bool(mtime_conflict)}).encode("utf-8"))
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/history-restore":
            try:
                req = json.loads(raw.decode("utf-8"))
                restored = restore_backup(req.get("id", ""))
                self._send(200, "application/json",
                           json.dumps({"ok": True, "restored": restored}).encode("utf-8"))
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/history-delete":
            try:
                req = json.loads(raw.decode("utf-8"))
                delete_backup(req.get("id", ""))
                self._send(200, "application/json",
                           json.dumps({"ok": True, "backups": list_backups()}).encode("utf-8"))
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/history-clear":
            try:
                # 清空前保留一个当前快照，避免误清后彻底丢失
                m = snapshot_configs("before_clear")
                keep = (m or {}).get("id", "")
                for d in os.listdir(BACKUP_DIR):
                    p = os.path.join(BACKUP_DIR, d)
                    if os.path.isdir(p) and d != keep:
                        shutil.rmtree(p, ignore_errors=True)
                self._send(200, "application/json",
                           json.dumps({"ok": True, "backups": list_backups()}).encode("utf-8"))
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/reset-defaults":
            try:
                reset_defaults()
                self._send(200, "application/json", b'{"ok":true}')
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        # ---------- 音效生成 / 应用 / 管理 ----------
        if path == "/api/sfx-synth":
            # 程序化合成（§9.1）：无需 Key / 本地模型，纯代码生成，保证「生成」永远可用
            try:
                req = json.loads(raw.decode("utf-8"))
                event = (req.get("event") or "move").strip()
                if event not in DEFAULT_SFX_EVENTS:
                    raise ValueError("未知事件: %s" % event)
                data = synth_wav_bytes(event)
                name = save_audio_bytes(data, SFX_TMP, event)
                self._send(200, "application/json",
                           json.dumps({"ok": True, "name": name, "list": list_sfx_tmp()}).encode("utf-8"))
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/sfx-generate":
            try:
                req = json.loads(raw.decode("utf-8"))
                self._send(200, "application/json",
                           json.dumps(generate_sfx(req)).encode("utf-8"))
            except Exception as e:
                self._send(500, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/sfx-apply-tmp":
            try:
                req = json.loads(raw.decode("utf-8"))
                name = resource_filename(req.get("name", ""))
                event = resource_filename(req.get("event", "move"))
                if not name:
                    raise ValueError("缺少文件名")
                # [feature:sfx-candidate-api-12]
                src = sfx_candidate_path(name)
                ext = os.path.splitext(name)[1]
                # [/feature:sfx-candidate-api-12]
                os.makedirs(SFX_DIR, exist_ok=True)
                dst = os.path.join(SFX_DIR, event + ext)
                # [feature:sfx-candidate-api-13]
                if os.path.dirname(os.path.realpath(dst)) != os.path.realpath(SFX_DIR) or os.path.islink(dst):
                    raise ValueError("应用音效的目标必须位于正式音效目录内。")
                # [/feature:sfx-candidate-api-13]
                shutil.copyfile(src, dst)
                cfg = load_sfx_config()
                cfg.setdefault("events", {})[event] = os.path.basename(dst)
                save_sfx_config(cfg)
                self._send(200, "application/json",
                           json.dumps({"ok": True, "file": os.path.basename(dst)}).encode("utf-8"))
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/sfx-apply-wav":
            try:
                event = resource_filename(urllib.parse.unquote(self.path.split("?event=")[-1].split("&")[0] or "move"))
                if raw[:4] != b"RIFF":
                    raise ValueError("不是 RIFF WAV 数据")
                os.makedirs(SFX_DIR, exist_ok=True)
                dst = os.path.join(SFX_DIR, event + ".wav")
                with open(dst, "wb") as f:
                    f.write(raw)
                cfg = load_sfx_config()
                cfg.setdefault("events", {})[event] = os.path.basename(dst)
                save_sfx_config(cfg)
                self._send(200, "application/json",
                           json.dumps({"ok": True, "file": os.path.basename(dst)}).encode("utf-8"))
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/sfx-pending":
            try:
                req = json.loads(raw.decode("utf-8"))
                action = req.get("action", "delete")
                name = resource_filename(req.get("name", "")) if req.get("name") else ""
                if action == "delete" and name:
                    fp = os.path.join(SFX_TMP, name)
                    if os.path.isfile(fp):
                        os.remove(fp)
                self._send(200, "application/json",
                           json.dumps({"ok": True, "list": list_sfx_tmp()}).encode("utf-8"))
            except Exception as e:
                self._send(200, "application/json",
                           json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        if path == "/api/sfx-save-config":
            try:
                req = json.loads(raw.decode("utf-8"))
                cfg = load_sfx_config()
                cfg["events"] = req.get("events", {}) or {}
                # 2026-09-02：每个事件单独的音量倍率（编辑器「音效」页的音量滑条）
                if "volumes" in req:
                    cfg["volumes"] = req.get("volumes") or {}
                save_sfx_config(cfg)
                self._send(200, "application/json", b'{"ok":true}')
            except Exception as e:
                self._send(500, "application/json",
                           json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if path == "/api/save-server-config":
            try:
                req = json.loads(raw.decode("utf-8"))
                cfg = load_config()
                if "elevenlabs_api_key" in req:
                    cfg["elevenlabs_api_key"] = (req["elevenlabs_api_key"] or "").strip()
                if "local_sfx_url" in req:
                    cfg["local_sfx_url"] = (req["local_sfx_url"] or "http://127.0.0.1:7861").strip()
                save_config(cfg)
                self._send(200, "application/json", b'{"ok":true}')
            except Exception as e:
                self._send(500, "application/json",
                           json.dumps({"error": str(e)}).encode("utf-8"))
            return

        self._send(404, "text/plain", b"not found")


if __name__ == "__main__":
    print("=" * 52)
    print("  游戏项目编辑器 服务已启动")
    print("  浏览器打开: http://127.0.0.1:%d" % PORT)
    print("  关闭本窗口即停止服务")
    print("=" * 52)
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except OSError as e:
        print("[错误] 端口 %d 被占用！" % PORT)
        print("       可能有旧的编辑器服务进程残留。")
        print("       请关闭本窗口，重新双击「启动编辑器.bat」（会自动清理旧进程）。")
        print("       ", e)
        if sys.stdin.isatty():
            input("按回车退出...")
