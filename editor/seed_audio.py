# -*- coding: utf-8 -*-
"""Local SeedAudio proxy. CLI: python editor/seed_audio.py --text 台词 --age 25 --output story_age25.mp3.
Credentials: SEED_AUDIO_API_KEY or .local-secrets/seed_audio.json {"api_key": "..."}.
Official create is synchronous; job polling/cancellation belong to this local service.
"""
import argparse
import array
import base64
from contextlib import contextmanager
import hashlib
import io
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave

import voice_proc

ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/create"
MODEL = "seed-audio-1.0"
MAX_AUDIO = 25 * 1024 * 1024
MAX_REFERENCE = 10 * 1024 * 1024
MAX_BODY = 16 * 1024 * 1024  # Envelope bound; complete prompts/signatures are never character-truncated.
MISSING = object()
TIMEOUT = 180
PRESETS = {
    10: {"reference": "总可以了吧.wav", "prompt": "10岁女孩，清澈稚嫩、好奇亲切，保留参考人物声线，自然口语，轻快但不尖锐。"},
    15: {"reference": "干嘛老板.wav", "prompt": "15岁少女，青春清亮、真诚活泼，保留参考人物声线，自然口语，带一点期待。"},
    20: {"reference": "干嘛老板.wav", "prompt": "20岁年轻女性，温暖清晰、自信自然，保留参考人物声线，日常交谈感。"},
    25: {"reference": "干嘛老板.wav", "prompt": "25岁女性，保留参考人物声线，更成熟沉稳，语气温柔笃定，节奏舒缓，收敛少女感，避免夸张与尖细。"},
}


class SeedAudioError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class SeedAudioLineDraftConflict(SeedAudioError):
    def __init__(self, current=None):
        super().__init__("台词草稿已变化或本地文件不可读取，请保留当前编辑并解决保存冲突。", 409)
        self.current = current


def ffmpeg_path():
    candidate = os.environ.get("SEED_AUDIO_FFMPEG") or shutil.which("ffmpeg")
    if not candidate:
        try:
            import imageio_ffmpeg
            candidate = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError:
            candidate = None
    return candidate if candidate and Path(candidate).is_file() else None


def ffmpeg(args, data=None):
    executable = ffmpeg_path()
    if not executable:
        raise SeedAudioError("未找到本地 ffmpeg；请配置 SEED_AUDIO_FFMPEG。", 503)
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        result = subprocess.run([executable, "-hide_banner", "-loglevel", "error", *args],
                                input=data, capture_output=True, timeout=45, creationflags=flags)
    except (OSError, subprocess.TimeoutExpired):
        raise SeedAudioError("本地音频处理超时或无法启动。", 503) from None
    if result.returncode:
        raise SeedAudioError("音频无法解码或转码，请检查文件格式。")
    return result.stdout


def integer(value, low, high, label):
    if isinstance(value, bool):
        raise SeedAudioError(label + "必须是整数。")
    try:
        n = int(value)
        if float(value) != n or not low <= n <= high:
            raise ValueError()
    except (TypeError, ValueError, OverflowError):
        raise SeedAudioError(label + "超出允许范围。") from None
    return n


def number(value, low, high, label):
    try:
        n = float(value)
        if not math.isfinite(n) or not low <= n <= high:
            raise ValueError()
    except (TypeError, ValueError):
        raise SeedAudioError(label + "超出允许范围。") from None
    return n


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SeedAudioError("上游请求拒绝重定向。", 502)


def download_audio(url):
    """URL fallback is provider-controlled only; never accepts a browser-provided URL."""
    parsed = urllib.parse.urlparse(url)
    hostname = (parsed.hostname or "").lower()
    allowed = (".volces.com", ".volcengine.com", ".bytecdn.cn", ".bytedance.com", ".bytepluses.com")
    if (parsed.scheme != "https" or parsed.port not in (None, 443) or parsed.username or parsed.password
            or not any(hostname.endswith(suffix) for suffix in allowed)):
        raise SeedAudioError("上游音频地址不在允许的官方存储域内。", 502)
    try:
        addresses = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
            raise SeedAudioError("上游音频地址不可下载。", 502)
        with urllib.request.build_opener(NoRedirect).open(url, timeout=30) as response:
            audio = response.read(MAX_AUDIO + 1)
    except (OSError, urllib.error.URLError):
        raise SeedAudioError("上游音频下载失败，请重新生成。", 502) from None
    if not audio or len(audio) > MAX_AUDIO:
        raise SeedAudioError("上游音频为空或超过大小限制。", 502)
    return audio


def create_audio(payload, api_key):
    request = urllib.request.Request(ENDPOINT, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Api-Key": api_key,
                 "X-Api-Request-Id": str(uuid.uuid4())}, method="POST")
    try:
        # Authentication is authorized for ENDPOINT only; default urllib redirects
        # retain custom headers and could forward the key to another origin.
        with urllib.request.build_opener(NoRedirect).open(request, timeout=TIMEOUT) as response:
            raw = response.read(36 * 1024 * 1024 + 1)
            if len(raw) > 36 * 1024 * 1024:
                raise SeedAudioError("上游响应超过大小限制。", 502)
            result = json.loads(raw)
    except SeedAudioError:
        raise
    except urllib.error.HTTPError as e:
        # Never expose upstream headers/body: providers may reflect authentication.
        messages = {401: "火山 API Key 无效。", 403: "火山权限不足或模型未开通。",
                    429: "火山请求额度或并发已达上限，请稍后重试。"}
        raise SeedAudioError(messages.get(e.code, "火山请求失败（HTTP %s）。" % e.code), 502) from None
    except (OSError, urllib.error.URLError, TimeoutError):
        raise SeedAudioError("火山请求超时或网络不可用；请求可能已计费，请核实后再重试。", 502) from None
    except (ValueError, UnicodeError):
        raise SeedAudioError("火山返回了无法解析的响应。", 502) from None
    if not isinstance(result, dict):
        raise SeedAudioError("火山响应结构异常。", 502)
    if result.get("code", 0) not in (0, 200, 20000000):
        raise SeedAudioError("火山未完成生成（错误码 %s）。" % re.sub(r"[^0-9-]", "", str(result.get("code")))[:30], 502)
    return result


class SeedAudioService:
    def __init__(self, project_root=None, transport=None, restore=True):
        self.root = Path(project_root or Path(__file__).resolve().parent.parent).resolve()
        self.voice = self.root / "resource/sound/voice"
        # User-owned permanent drafts: only the explicit delete API removes them.
        self.preview = self.root / "origin_source/voice/tmp"
        self.transport = transport or create_audio
        self.csrf = secrets.token_urlsafe(32)
        self.jobs = {}
        self.lock = threading.RLock()
        self.active = {}
        self.operation_locks = {}
        self.restored = False
        if restore:
            self._ensure_restored()

    def _ensure_restored(self):
        with self.lock:
            if not self.restored:
                self.restored = True
                self._restore_jobs()

    def _directory(self, job_id=None, create=False):
        """A draft is owned by this exact preview directory, never by a saved voice."""
        if job_id is not None and (not isinstance(job_id, str) or not re.fullmatch(r"[a-f0-9]{32}", job_id)):
            raise SeedAudioError("任务不存在。", 404)
        directory = self.preview if job_id is None else self.preview / job_id
        try:
            if self.preview.resolve() != self.preview or directory.resolve() != directory:
                raise SeedAudioError("草稿目录包含不允许的路径链接。", 403)
            if create:
                directory.mkdir(parents=True, exist_ok=True)
            if directory.exists() and (not directory.is_dir() or directory.is_symlink()
                                       or getattr(directory, "is_junction", lambda: False)()):
                raise SeedAudioError("草稿目录无效。", 403)
        except (OSError, RuntimeError):
            raise SeedAudioError("本地草稿目录不可访问。", 500) from None
        return directory

    def _draft_file(self, job_id, filename):
        directory = self._directory(job_id)
        if filename not in ("job.json", "raw.mp3", "raw.wav", "processed.mp3", "processed.wav"):
            raise SeedAudioError("草稿文件名无效。", 403)
        target = directory / filename
        if target.resolve().parent != directory or target.is_symlink():
            raise SeedAudioError("草稿文件路径不允许。", 403)
        return target

    def _atomic_write(self, target, data):
        temporary = None
        try:
            descriptor, temporary = tempfile.mkstemp(prefix="job-", suffix=".tmp", dir=target.parent)
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, target)
            temporary = None
        except OSError:
            raise SeedAudioError("候选音频草稿无法保存，请检查本地目录写入权限。", 500) from None
        finally:
            if temporary:
                try:
                    Path(temporary).unlink(missing_ok=True)
                except OSError:
                    pass

    def _persist(self, job):
        self._directory(job["id"], create=True)
        public = self._public(job)
        record = {"schema": 1, "job": public}
        for kind in ("raw", "processed"):
            source = job.get(kind + "Path")
            if source:
                filename = Path(source).name
                target = self._draft_file(job["id"], filename)
                if target != Path(source) or not target.is_file():
                    raise SeedAudioError("候选音频草稿路径无效。", 500)
                size = target.stat().st_size
                if not 0 < size <= MAX_AUDIO:
                    raise SeedAudioError("候选音频草稿大小无效。", 500)
                record[kind] = {"file": filename, "bytes": size,
                                "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
        data = json.dumps(record, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self._atomic_write(self._draft_file(job["id"], "job.json"), data)

    @staticmethod
    def _public(job):
        allowed = {"id", "state", "started", "age", "reference", "prompt", "format", "bytes", "duration",
                   "originalDuration", "url", "processInfo", "processedBytes", "processedFormat", "processedUrl",
                   "error", "message", "savedVoice", "savedAt", "legacyRecovered", "target", "draft"}
        return {key: value for key, value in job.items() if key in allowed}

    def _read_audio_record(self, job_id, kind, row):
        if not isinstance(row, dict) or set(row) != {"file", "bytes", "sha256"}:
            raise ValueError("invalid audio record")
        if row["file"] not in (kind + ".mp3", kind + ".wav"):
            raise ValueError("invalid audio name")
        source = self._draft_file(job_id, row["file"])
        if (not source.is_file() or isinstance(row["bytes"], bool) or not isinstance(row["bytes"], int)
                or not 0 < row["bytes"] <= MAX_AUDIO or source.stat().st_size != row["bytes"]):
            raise ValueError("invalid audio size")
        if not isinstance(row["sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", row["sha256"]):
            raise ValueError("invalid audio hash")
        if hashlib.sha256(source.read_bytes()).hexdigest() != row["sha256"]:
            raise ValueError("changed audio bytes")
        return str(source)

    def _restore_jobs(self):
        """Read only valid local snapshots. Interrupted requests are never resubmitted."""
        try:
            directory = self._directory()
            if not directory.is_dir():
                return
            for folder in sorted(directory.iterdir()):
                if not re.fullmatch(r"[a-f0-9]{32}", folder.name):
                    continue
                try:
                    manifest = self._draft_file(folder.name, "job.json")
                    if not manifest.is_file() or manifest.stat().st_size > 32 * 1024 * 1024:
                        continue
                    record = json.loads(manifest.read_text(encoding="utf-8"))
                    row = record["job"]
                    if (record.get("schema") != 1 or not isinstance(row, dict) or row.get("id") != folder.name
                            or row.get("state") not in ("running", "completed", "cancelled", "failed", "interrupted")
                            or row.get("format") not in ("mp3", "wav") or row.get("age") not in PRESETS
                            or not isinstance(row.get("prompt"), str) or not isinstance(row.get("reference"), str)
                            or isinstance(row.get("started"), bool) or not isinstance(row.get("started"), (int, float)) or not math.isfinite(row["started"])):
                        continue
                    job = self._public(row)
                    if "target" in job:
                        job["target"] = self._target(job["target"])
                    if "draft" in job:
                        job["draft"] = self._draft(job["draft"])
                    for key in ("url", "processedUrl", "processedFormat", "processedBytes", "processInfo"):
                        job.pop(key, None)
                    if "raw" in record:
                        job["rawPath"] = self._read_audio_record(folder.name, "raw", record["raw"])
                        if record["raw"]["file"] != "raw." + row["format"]:
                            continue
                        job.update(bytes=record["raw"]["bytes"], url="/api/seed-audio/preview/" + folder.name + "/raw")
                    if "processed" in record:
                        job["processedPath"] = self._read_audio_record(folder.name, "processed", record["processed"])
                        job.update(processedBytes=record["processed"]["bytes"], processedFormat=Path(job["processedPath"]).suffix[1:],
                                   processedUrl="/api/seed-audio/preview/" + folder.name + "/processed?v=" + record["processed"]["sha256"][:16])
                        if isinstance(row.get("processInfo"), dict):
                            job["processInfo"] = row["processInfo"]
                    if job["state"] == "completed" and "rawPath" not in job:
                        continue
                    if job["state"] == "running":
                        # A crash may occur after atomic audio publication but before
                        # its completion manifest. Recover only our canonical files.
                        for kind, formats in (("raw", [job["format"]]), ("processed", ["mp3", "wav"])):
                            if kind + "Path" in job:
                                continue
                            for fmt in formats:
                                source = self._draft_file(job["id"], kind + "." + fmt)
                                if source.is_file() and 0 < source.stat().st_size <= MAX_AUDIO:
                                    audio = source.read_bytes()
                                    if self._audio_header(audio, fmt):
                                        job[kind + "Path"] = str(source)
                                        if kind == "raw":
                                            job.update(bytes=len(audio), url="/api/seed-audio/preview/" + job["id"] + "/raw")
                                        else:
                                            job.update(processedBytes=len(audio), processedFormat=fmt,
                                                       processedUrl="/api/seed-audio/preview/" + job["id"] + "/processed")
                                        break
                        job.update(state="interrupted", message="服务已重启，旧生成任务已中断；未自动重试，请先核实上游状态。")
                    self.jobs[job["id"]] = job
                    if row["state"] == "running":
                        self._persist(job)
                except (OSError, ValueError, TypeError, KeyError, SeedAudioError, RuntimeError):
                    continue
            self._recover_legacy_previews(directory)
        except (OSError, SeedAudioError, RuntimeError):
            return

    def _recover_legacy_previews(self, directory):
        # The old service stored only <id>.mp3/wav. Retain old ids and real bytes,
        # without inventing the missing prompt or reissuing a paid generation.
        for source in sorted(directory.iterdir()):
            match = re.fullmatch(r"([a-f0-9]{32})\.(mp3|wav)", source.name)
            if not match or match[1] in self.jobs:
                continue
            try:
                if (self._directory(match[1]) / "job.json").exists():
                    continue  # An invalid modern manifest must never be silently rebased as a legacy draft.
                if (source.is_symlink() or source.resolve().parent != directory or not source.is_file()
                        or not 0 < source.stat().st_size <= MAX_AUDIO):
                    continue
                audio = source.read_bytes()
                if not self._audio_header(audio, match[2]):
                    continue
                job_id, fmt = match.groups()
                self._directory(job_id, create=True)
                raw = self._draft_file(job_id, "raw." + fmt)
                self._atomic_write(raw, audio)
                job = {"id": job_id, "state": "completed", "started": source.stat().st_mtime,
                       "age": 20, "prompt": "", "reference": "", "format": fmt, "bytes": len(audio),
                       "rawPath": str(raw), "url": "/api/seed-audio/preview/" + job_id + "/raw", "legacyRecovered": True}
                for processed_format in ("mp3", "wav"):
                    previous = directory / (job_id + "_processed." + processed_format)
                    if (previous.is_file() and not previous.is_symlink() and previous.resolve().parent == directory
                            and 0 < previous.stat().st_size <= MAX_AUDIO):
                        data = previous.read_bytes()
                        if self._audio_header(data, processed_format):
                            target = self._draft_file(job_id, "processed." + processed_format)
                            self._atomic_write(target, data)
                            job.update(processedPath=str(target), processedBytes=len(data), processedFormat=processed_format,
                                       processedUrl="/api/seed-audio/preview/" + job_id + "/processed")
                self._persist(job)
                self.jobs[job_id] = job
            except (OSError, SeedAudioError, RuntimeError):
                continue

    @staticmethod
    def _audio_header(data, fmt):
        return ((len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE") if fmt == "wav"
                else data[:3] == b"ID3" or (len(data) >= 2 and data[0] == 255 and data[1] & 224 == 224))

    @staticmethod
    def _target(value):
        if value is None:
            return None
        if (not isinstance(value, dict) or set(value) - {"id", "signature", "previousVoice"}
                or not isinstance(value.get("id"), str) or not value["id"].strip()
                or not isinstance(value.get("signature"), str) or not value["signature"]):
            raise SeedAudioError("台词归属信息无效。")
        target = {"id": value["id"], "signature": value["signature"]}
        if "previousVoice" in value:
            if not isinstance(value["previousVoice"], str):
                raise SeedAudioError("台词原配音信息无效。")
            target["previousVoice"] = value["previousVoice"]
        return target

    @staticmethod
    def _draft(value):
        allowed = {"filename", "format", "cropStart", "cropEnd", "trimSilence", "silencePadMs", "bitrate", "clipState", "editForm"}
        if not isinstance(value, dict) or set(value) - allowed:
            raise SeedAudioError("草稿编辑状态无效。")
        draft = {}
        for key, val in value.items():
            if key == "filename":
                if not isinstance(val, str) or "\0" in val:
                    raise SeedAudioError("草稿文件名无效。")
                draft[key] = val  # Metadata only; actual save validates filenames separately.
            elif key == "format":
                if val not in ("mp3", "wav"):
                    raise SeedAudioError("草稿格式无效。")
                draft[key] = val
            elif key in ("cropStart", "cropEnd"):
                draft[key] = "" if val == "" else number(val, 0, 120, "裁切位置")
            elif key == "trimSilence":
                if not isinstance(val, bool):
                    raise SeedAudioError("裁切开关无效。")
                draft[key] = val
            elif key == "silencePadMs":
                draft[key] = number(val, 0, 1000, "留白")
            elif key == "bitrate":
                draft[key] = integer(val, 64, 192, "压缩码率")
            elif key == "clipState":
                if (not isinstance(val, dict) or set(val) - {"editing", "explicit", "selection"}
                        or not isinstance(val.get("editing"), bool) or not isinstance(val.get("explicit", False), bool)):
                    raise SeedAudioError("波形选择状态无效。")
                state = {"editing": val["editing"], "explicit": val.get("explicit", False)}
                if "selection" in val and val["selection"] is not None:
                    selection = val["selection"]
                    if not isinstance(selection, dict) or set(selection) != {"a", "b"}:
                        raise SeedAudioError("波形选择范围无效。")
                    a, b = number(selection["a"], 0, 1, "选择起点"), number(selection["b"], 0, 1, "选择终点")
                    if a > b:
                        raise SeedAudioError("选择终点须大于起点。")
                    state["selection"] = {"a": a, "b": b}
                draft[key] = state
            elif key == "editForm":
                if not isinstance(val, dict) or set(val) - {"prompt", "reference", "age", "format", "speech_rate", "pitch_rate", "loudness_rate", "watermark", "candidateCount"}:
                    raise SeedAudioError("配音提示词编辑状态无效。")
                form = {}
                for field, item in val.items():
                    if field in ("prompt", "reference"):
                        if not isinstance(item, str):
                            raise SeedAudioError("配音编辑文本无效。")
                        form[field] = item
                    elif field == "age":
                        age = integer(item, 10, 25, "年龄")
                        if age not in PRESETS:
                            raise SeedAudioError("年龄请选择 10、15、20、25 岁。")
                        form[field] = age
                    elif field == "format":
                        if item not in ("mp3", "wav"):
                            raise SeedAudioError("配音格式无效。")
                        form[field] = item
                    elif field == "watermark":
                        if not isinstance(item, bool):
                            raise SeedAudioError("水印开关无效。")
                        form[field] = item
                    else:
                        low, high = (-12, 12) if field == "pitch_rate" else (1, 10) if field == "candidateCount" else (-50, 100)
                        form[field] = integer(item, low, high, field)
                draft[key] = form
        return draft

    @staticmethod
    def _line_form(value):
        # Line forms and candidate snapshots share the complete generation form.
        # Empty text is a saved edit; paid generation validates prompt separately.
        return SeedAudioService._draft({"editForm": value})["editForm"]

    @staticmethod
    def _line_identity(value):
        if (not isinstance(value, dict) or not isinstance(value.get("id"), str)
                or not value["id"].strip() or len(value["id"]) > 2048
                or any(ord(c) < 32 for c in value["id"])
                or not isinstance(value.get("signature"), str) or not value["signature"]
                or not isinstance(value.get("sourceText"), str)):
            raise SeedAudioError("逐句配音归属信息无效。")
        return {"id": value["id"], "signature": value["signature"], "sourceText": value["sourceText"]}

    def _line_directory(self, create=False):
        parent = self._directory(create=create)
        directory = parent / ".line-drafts"
        try:
            if directory.resolve() != directory or directory.is_symlink() or getattr(directory, "is_junction", lambda: False)():
                raise SeedAudioError("逐句配音草稿目录包含不允许的路径链接。", 403)
            if create:
                directory.mkdir(exist_ok=True)
            if directory.exists() and not directory.is_dir():
                raise SeedAudioError("逐句配音草稿目录无效。", 403)
        except (OSError, RuntimeError):
            raise SeedAudioError("逐句配音草稿目录不可访问。", 500) from None
        return directory

    def _line_file(self, line_id, create=False):
        directory = self._line_directory(create=create)
        filename = hashlib.sha256(line_id.encode("utf-8")).hexdigest() + ".json"
        target = directory / filename
        if target.resolve().parent != directory or target.is_symlink():
            raise SeedAudioError("逐句配音草稿路径不允许。", 403)
        return target

    def _read_line_draft(self, target):
        try:
            if (not target.is_file() or target.is_symlink() or target.resolve().parent != self._line_directory()
                    or not 0 < target.stat().st_size <= MAX_BODY + 4096):
                raise ValueError("invalid line draft file")
            value = json.loads(target.read_text(encoding="utf-8"))
            if (not isinstance(value, dict) or set(value) != {"schema", "id", "signature", "sourceText", "form", "revision", "updatedAt"}
                    or type(value["schema"]) is not int or value["schema"] != 1
                    or type(value["revision"]) is not int or not 1 <= value["revision"] < 9007199254740991
                    or isinstance(value["updatedAt"], bool) or not isinstance(value["updatedAt"], (int, float))
                    or not math.isfinite(value["updatedAt"]) or value["updatedAt"] < 0):
                raise ValueError("invalid line draft schema")
            record = self._line_identity(value)
            if self._line_file(record["id"]) != target:
                raise ValueError("line id does not match file")
            record.update(form=self._line_form(value["form"]), revision=value["revision"], updatedAt=value["updatedAt"])
            return record
        except (OSError, RuntimeError, UnicodeError, ValueError, TypeError, KeyError, SeedAudioError):
            # Preserve corrupt/future files, and never replace them as a new draft.
            raise SeedAudioLineDraftConflict() from None

    def line_drafts(self):
        with self.lock:
            directory = self._line_directory()
            if not directory.is_dir():
                return {"drafts": [], "unreadableCount": 0}
            records, unreadable = [], 0
            for target in sorted(directory.iterdir()):
                if not re.fullmatch(r"[a-f0-9]{64}\.json", target.name):
                    continue
                try:
                    records.append(self._read_line_draft(target))
                except SeedAudioLineDraftConflict:
                    unreadable += 1
            return {"drafts": records, "unreadableCount": unreadable}

    def save_line_draft(self, req):
        if not isinstance(req, dict) or set(req) != {"id", "signature", "sourceText", "form", "expectedRevision"}:
            raise SeedAudioError("逐句配音保存请求无效。")
        record = self._line_identity(req)
        record["form"] = self._line_form(req["form"])
        expected = req["expectedRevision"]
        if type(expected) is not int or not 0 <= expected < 9007199254740990:
            raise SeedAudioError("逐句配音草稿版本无效。")
        with self.lock:
            target = self._line_file(record["id"])
            current = self._read_line_draft(target) if target.exists() else None
            revision = current["revision"] if current else 0
            if revision != expected:
                raise SeedAudioLineDraftConflict(current)
            record.update(revision=revision + 1, updatedAt=time.time())
            raw = json.dumps({"schema": 1, **record}, ensure_ascii=False, allow_nan=False).encode("utf-8")
            if len(raw) > MAX_BODY + 4096:
                raise SeedAudioError("逐句配音草稿超过请求大小限制。")
            target = self._line_file(record["id"], create=True)
            self._atomic_write(target, raw)
            return {"ok": True, "draft": record}

    def _check_expected(self, job, expected=MISSING):
        if expected is not MISSING and self._target(expected) != job.get("target"):
            raise SeedAudioError("候选的台词归属已在其它页面更改，请刷新候选后再操作。", 409)

    def bind(self, job_id, req):
        with self.lock:
            self.job(job_id)
            if not isinstance(req, dict) or set(req) - {"id", "target", "draft", "expectedTarget"}:
                raise SeedAudioError("候选归属请求无效。")
            job = self.jobs[job_id]
            self._check_expected(job, req.get("expectedTarget", MISSING))
            update = {}
            if "target" in req:
                target = self._target(req["target"])
                if target != job.get("target"):
                    if job.get("target") and "expectedTarget" not in req:
                        raise SeedAudioError("不能覆盖已有台词归属；请刷新候选后明确绑定。", 409)
                    if self.active.get(job_id) or job["state"] == "running":
                        raise SeedAudioError("任务正在运行，暂不能变更台词归属。", 409)
                update["target"] = target
            if "draft" in req:
                draft = {**job.get("draft", {}), **self._draft(req["draft"])}
                if "editForm" in req["draft"]:
                    draft["editForm"] = {**job.get("draft", {}).get("editForm", {}), **draft["editForm"]}
                update["draft"] = draft
            previous = dict(job)
            job.update(update)
            try:
                self._persist(job)
            except SeedAudioError:
                job.clear()
                job.update(previous)
                raise
            return self.job(job_id)

    @contextmanager
    def _operation(self, job_id, expected=MISSING):
        with self.lock:
            self.job(job_id)
            self._check_expected(self.jobs[job_id], expected)
            self.active[job_id] = self.active.get(job_id, 0) + 1
            operation_lock = self.operation_locks.setdefault(job_id, threading.RLock())
        try:
            with operation_lock:
                yield
        finally:
            with self.lock:
                remaining = self.active.get(job_id, 1) - 1
                if remaining:
                    self.active[job_id] = remaining
                else:
                    self.active.pop(job_id, None)

    def list_jobs(self):
        self._ensure_restored()
        with self.lock:
            return {"jobs": [self._public(job) for job in sorted(self.jobs.values(), key=lambda row: row["started"], reverse=True)]}

    def delete(self, job_id, expected=MISSING):
        with self.lock:
            self.job(job_id)
            self._check_expected(self.jobs[job_id], expected)
            if self.jobs[job_id]["state"] == "running" or self.active.get(job_id):
                raise SeedAudioError("任务仍在生成、处理或保存中，请等待结束后删除草稿。", 409)
            directory = self._directory(job_id)
            files = list(directory.iterdir()) if directory.is_dir() else []
            allowed = re.compile(r"(?:job\.json|(?:raw|processed)\.(?:mp3|wav)|job-[A-Za-z0-9_-]+\.tmp)")
            for candidate in files:
                if (not allowed.fullmatch(candidate.name) or not candidate.is_file() or candidate.is_symlink()
                        or candidate.resolve().parent != directory):
                    raise SeedAudioError("草稿目录包含未知文件或路径链接，未执行删除。", 403)
            legacy = [self.preview / (job_id + tail) for tail in (".mp3", ".wav", "_processed.mp3", "_processed.wav")]
            for candidate in legacy:
                if candidate.exists() and (not candidate.is_file() or candidate.is_symlink() or candidate.resolve().parent != self.preview):
                    raise SeedAudioError("旧草稿路径无效，未执行删除。", 403)
            try:
                for candidate in files + legacy:
                    candidate.unlink(missing_ok=True)
                if directory.is_dir():
                    directory.rmdir()
            except OSError:
                raise SeedAudioError("草稿未能完全删除，请关闭试听后再试。", 500) from None
            del self.jobs[job_id]
            self.operation_locks.pop(job_id, None)
            return {"ok": True, "id": job_id}

    def key(self):
        value = os.environ.get("SEED_AUDIO_API_KEY", "").strip()
        if not value:
            try:
                config = json.loads((self.root / ".local-secrets/seed_audio.json").read_text(encoding="utf-8-sig"))
                value = str(config.get("api_key") or "").strip()
            except (OSError, ValueError, TypeError, AttributeError):
                return ""
        return value if 8 <= len(value) <= 512 and not any(c in value for c in "\r\n") else ""

    def configure(self, req):
        """Store locally; neither public responses nor error messages contain the key."""
        value = req.get("api_key") if isinstance(req, dict) else None
        if (not isinstance(value, str) or not 8 <= len(value.strip()) <= 512 or any(c in value for c in "\r\n")
                or any(ord(c) < 33 or ord(c) > 126 for c in value.strip())):
            raise SeedAudioError("API Key 需为 8 至 512 位可见英文字符，不能含空格或换行。")
        value = value.strip()
        directory = self.root / ".local-secrets"
        target = directory / "seed_audio.json"
        temporary = None
        try:
            with self.lock:
                directory.mkdir(mode=0o700, parents=True, exist_ok=True)
                descriptor, temporary = tempfile.mkstemp(prefix="seed_audio-", suffix=".tmp", dir=directory)
                with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                    json.dump({"api_key": value}, stream, ensure_ascii=False)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temporary, target)
                temporary = None
        except OSError:
            raise SeedAudioError("API Key 无法保存到本地配置，请检查项目目录的写入权限。", 500) from None
        finally:
            if temporary is not None:
                try:
                    Path(temporary).unlink(missing_ok=True)
                except OSError:
                    pass
        return self.status()

    def status(self):
        self._ensure_restored()
        with self.lock:
            active_operations = sum(self.active.values())
            running_jobs = sum(job["state"] == "running" for job in self.jobs.values())
        references = []
        if self.voice.is_dir():
            references = sorted(p.name for p in self.voice.iterdir() if p.is_file() and p.suffix.lower() in (".wav", ".mp3", ".ogg"))
        return {"configured": bool(self.key()), "model": MODEL, "endpoint": ENDPOINT,
                "ffmpeg": bool(ffmpeg_path()), "csrfToken": self.csrf, "presets": PRESETS, "references": references,
                "draftRoot": "origin_source/voice/tmp", "retention": "until-explicit-delete",
                "lineDraftsVersion": 1,
                "activeOperations": active_operations, "runningJobs": running_jobs}

    def reference(self, name):
        if not isinstance(name, str) or name in ("", ".", "..") or Path(name).name != name or any(c in name for c in "/\\:"):
            raise SeedAudioError("参考音频必须选择 voice 文件夹中的文件名。")
        candidate = (self.voice / name).resolve()
        if candidate.parent != self.voice.resolve() or candidate.suffix.lower() not in (".wav", ".mp3", ".ogg"):
            raise SeedAudioError("参考音频路径或格式不允许。")
        try:
            if candidate.stat().st_size > MAX_REFERENCE:
                raise SeedAudioError("参考音频不能超过 10 MB。")
            data = candidate.read_bytes()
        except OSError:
            raise SeedAudioError("参考音频不存在或无法读取。") from None
        pcm = ffmpeg(["-i", str(candidate), "-t", "31", "-ac", "1", "-ar", "16000", "-f", "s16le", "pipe:1"])
        seconds = len(pcm) / 32000
        if not 0.05 <= seconds <= 30:
            raise SeedAudioError("参考音频时长必须在 0.05 至 30 秒之间。")
        return {"audio_data": base64.b64encode(data).decode("ascii")}

    # [feature:seed-audio-reference-optional-payload]
    def payload(self, req):
        if not isinstance(req, dict):
            raise SeedAudioError("请求必须是 JSON 对象。")
        age = integer(req.get("age", 20), 10, 25, "年龄")
        if age not in PRESETS:
            raise SeedAudioError("年龄请选择 10、15、20、25 岁。")
        # One editable prompt is the whole model input. "text" remains a CLI/
        # older-client alias only when no prompt was provided; never combine them.
        if "prompt" in req and "text" in req:
            raise SeedAudioError("请只发送一个完整的 prompt 提示词，不再拆分台词与表演提示。")
        prompt = req.get("prompt", req.get("text", ""))
        if not isinstance(prompt, str) or not prompt.strip():
            raise SeedAudioError("请填写完整提示词，不能全为空白。")
        reference = req.get("reference", "")
        if reference is None:
            reference = ""
        if not isinstance(reference, str):
            raise SeedAudioError("参考音频请选择文件名，或留空。")
        reference = reference.strip()
        fmt = req.get("format", "mp3")
        if fmt not in ("mp3", "wav"):
            raise SeedAudioError("输出格式请选择 mp3 或 wav。")
        watermark = req.get("watermark", {})
        if not isinstance(watermark, dict) or set(watermark) - {"aigc_watermark"}:
            raise SeedAudioError("水印配置仅支持 aigc_watermark 开关。")
        if "aigc_watermark" in watermark and not isinstance(watermark["aigc_watermark"], bool):
            raise SeedAudioError("水印开关必须为布尔值。")
        payload = {"model": MODEL, "text_prompt": prompt,
                   "audio_config": {"format": fmt, "sample_rate": 48000,
                    "speech_rate": integer(req.get("speech_rate", 0), -50, 100, "语速"),
                    "pitch_rate": integer(req.get("pitch_rate", 0), -12, 12, "音高"),
                    "loudness_rate": integer(req.get("loudness_rate", 0), -50, 100, "音量")},
                   "watermark": watermark}
        if reference:
            payload["references"] = [self.reference(reference)]
        metadata = {"age": age, "reference": reference, "prompt": prompt, "format": fmt}
        if "target" in req:
            metadata["target"] = self._target(req["target"])
        if "draft" in req:
            metadata["draft"] = self._draft(req["draft"])
        return payload, metadata

    # [/feature:seed-audio-reference-optional-payload]
    def submit(self, req):
        self._ensure_restored()
        key = self.key()
        if not key:
            raise SeedAudioError("尚未配置火山 API Key；在本地环境变量或 .local-secrets/seed_audio.json 中设置。", 503)
        with self.lock:
            if any(job["state"] == "running" for job in self.jobs.values()):
                raise SeedAudioError("已有生成任务运行中，请等待完成。", 409)
            payload, meta = self.payload(req)
            job_id = uuid.uuid4().hex
            self.jobs[job_id] = {"id": job_id, "state": "running", "started": time.time(), **meta}
            try:
                self._persist(self.jobs[job_id])
            except SeedAudioError:
                del self.jobs[job_id]
                raise
            self.active[job_id] = 1
            threading.Thread(target=self._run, args=(job_id, payload, key), daemon=True).start()
            return self.job(job_id)

    def _run(self, job_id, payload, key):
        try:
            result = self.transport(payload, key)
            with self.lock:
                if self.jobs[job_id]["state"] == "cancelled":
                    return
            if result.get("audio"):
                try:
                    audio = base64.b64decode(result["audio"], validate=True)
                except (ValueError, TypeError):
                    raise SeedAudioError("上游音频编码无效。", 502) from None
            elif result.get("url"):
                audio = download_audio(result["url"])
            else:
                raise SeedAudioError("上游未返回音频。", 502)
            if not audio or len(audio) > MAX_AUDIO:
                raise SeedAudioError("上游音频为空或超过大小限制。", 502)
            # Lock through file write so local cancellation can never race with publication.
            with self.lock:
                job = self.jobs[job_id]
                if job["state"] == "cancelled":
                    return
                self._directory(job_id, create=True)
                path = self._draft_file(job_id, "raw." + job["format"])
                self._atomic_write(path, audio)
                job.update(state="completed", bytes=len(audio), duration=result.get("duration"),
                           originalDuration=result.get("original_duration"), rawPath=str(path),
                           url="/api/seed-audio/preview/" + job_id + "/raw")
                self._persist(job)
        except Exception as error:
            with self.lock:
                job = self.jobs[job_id]
                if job["state"] != "cancelled":
                    job.update(state="failed", error=str(error) if isinstance(error, SeedAudioError) else "音频生成失败；请检查火山服务和本地音频工具。")
                    try:
                        self._persist(job)
                    except SeedAudioError:
                        pass  # Never print a chained provider exception or credential on disk failure.
        finally:
            with self.lock:
                remaining = self.active.get(job_id, 1) - 1
                if remaining:
                    self.active[job_id] = remaining
                else:
                    self.active.pop(job_id, None)

    def job(self, job_id):
        self._ensure_restored()
        with self.lock:
            if not isinstance(job_id, str) or not re.fullmatch(r"[a-f0-9]{32}", job_id):
                raise SeedAudioError("任务不存在。", 404)
            if job_id not in self.jobs:
                raise SeedAudioError("任务不存在或草稿已删除。", 404)
            return self._public(self.jobs[job_id])

    def cancel(self, job_id):
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                raise SeedAudioError("任务不存在。", 404)
            if job["state"] != "running":
                return self.job(job_id)
            job.update(state="cancelled", message="已停止本地接收；上游请求可能仍执行并计费。")
            self._persist(job)
            return self.job(job_id)

    def preview_file(self, job_id, kind):
        with self.lock:
            self.job(job_id)
            job = self.jobs[job_id]
            key = "rawPath" if kind == "raw" else "processedPath" if kind == "processed" else ""
            path = job.get(key)
            if not path or not Path(path).is_file():
                raise SeedAudioError("预览音频尚未就绪。", 404)
            if Path(path) != self._draft_file(job_id, Path(path).name):
                raise SeedAudioError("预览音频路径不允许。", 403)
            return path

    def process(self, job_id, opts=None, expected=MISSING):
        with self._operation(job_id, expected):
            return self._process(job_id, opts)

    def _process(self, job_id, opts=None):
        source = self.preview_file(job_id, "raw")
        opts = opts or {}
        if not isinstance(opts, dict):
            raise SeedAudioError("处理参数必须为对象。")
        crop_start = None if opts.get("cropStart") in (None, "") else number(opts["cropStart"], 0, 120, "裁切起点")
        crop_end = None if opts.get("cropEnd") in (None, "") else number(opts["cropEnd"], 0, 120, "裁切终点")
        if crop_end is not None and crop_end <= (crop_start or 0):
            raise SeedAudioError("裁切终点须大于起点。")
        fmt = opts.get("format", "mp3")
        if fmt not in ("mp3", "wav"):
            raise SeedAudioError("保存格式请选择 mp3 或 wav。")
        bitrate = integer(opts.get("bitrate", 96), 64, 192, "压缩码率")
        pcm = ffmpeg(["-i", source, "-t", "121", "-ac", "1", "-ar", "48000", "-f", "s16le", "pipe:1"])
        samples = array.array("h")
        samples.frombytes(pcm)
        seconds = len(samples) / 48000
        if not 0.01 <= seconds <= 120.1:
            raise SeedAudioError("生成音频为空或超过 120 秒。")
        if (crop_start or 0) >= seconds:
            raise SeedAudioError("裁切起点超出音频长度。")
        processed, info = voice_proc.process(voice_proc.write_wav(samples, 1, 48000), {
            "cropStart": crop_start, "cropEnd": crop_end, "trimSilence": opts.get("trimSilence", True) is True,
            "silenceThresh": number(opts.get("silenceThresh", 0.01), 0.0001, 0.5, "静音阈值"),
            "silencePadMs": number(opts.get("silencePadMs", 60), 0, 1000, "留白"),
            "fadeInMs": 10, "fadeOutMs": 20, "normalize": True, "targetDbfs": -1, "channels": "mono"})
        audio = processed if fmt == "wav" else ffmpeg(["-i", "pipe:0", "-c:a", "libmp3lame", "-b:a", str(bitrate) + "k", "-f", "mp3", "pipe:1"], processed)
        with self.lock:
            path = self._draft_file(job_id, "processed." + fmt)
            self._atomic_write(path, audio)
            self.jobs[job_id].update(processedPath=str(path), processInfo=info,
                                    processedBytes=len(audio), processedFormat=fmt,
                                    processedUrl="/api/seed-audio/preview/" + job_id + "/processed?v=" + str(time.time_ns()))
            self._persist(self.jobs[job_id])
            return self.job(job_id)

    def save(self, job_id, filename, opts=None, expected=MISSING):
        with self._operation(job_id, expected):
            return self._save(job_id, filename, opts)

    def _save(self, job_id, filename, opts=None):
        if not isinstance(filename, str) or not filename or len(filename) > 100 or any(c in filename for c in '/\\:<>"|?*') or filename.endswith((".", " ")):
            raise SeedAudioError("请输入合法的音频文件名（最多 100 字）。")
        if Path(filename).suffix.lower() not in (".mp3", ".wav") or filename in (".", ".."):
            raise SeedAudioError("文件名必须以 .mp3 或 .wav 结尾。")
        if re.fullmatch(r"(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", filename):
            raise SeedAudioError("文件名是系统保留名称。")
        self.voice.mkdir(parents=True, exist_ok=True)
        destination = self.voice / filename
        if destination.resolve().parent != self.voice.resolve() or destination.exists():
            raise SeedAudioError("该文件已存在，请换一个名称；不会覆盖已有剧情语音。", 409)
        options = dict(opts or {}, format=Path(filename).suffix.lower()[1:])
        result = self.process(job_id, options)
        with self.lock:
            audio = Path(self.jobs[job_id]["processedPath"]).read_bytes()
            # Exclusive create also protects against concurrent saves.
            try:
                with destination.open("xb") as stream:
                    stream.write(audio)
            except FileExistsError:
                raise SeedAudioError("该文件已存在，请换一个名称。", 409) from None
            self.jobs[job_id].update(savedVoice="resource/sound/voice/" + filename, savedAt=time.time())
            self._persist(self.jobs[job_id])
        return {"ok": True, "voice": "resource/sound/voice/" + filename,
                "url": "/resource/sound/voice/" + urllib.parse.quote(filename), "bytes": len(audio), "info": result["processInfo"]}

    def wait(self, job_id, timeout=TIMEOUT + 15):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            job = self.job(job_id)
            if job["state"] != "running":
                if job["state"] != "completed":
                    raise SeedAudioError(job.get("error") or job.get("message") or "生成已取消。", 502)
                return job
            time.sleep(0.5)
        self.cancel(job_id)
        raise SeedAudioError("等待超时；上游请求可能仍在执行。", 502)


# Importing this module for isolated tests must not touch the real editor drafts.
# The first local API/CLI operation performs the same strict startup restoration.
SERVICE = SeedAudioService(restore=False)


def guard_request(handler, service, mutate=False, token_read=False):
    try:
        if not ipaddress.ip_address(handler.client_address[0]).is_loopback:
            raise ValueError()
        host = handler.headers.get("Host", "")
        parsed = urllib.parse.urlparse("http://" + host)
        port = handler.server.server_address[1]
        if parsed.hostname not in ("localhost", "127.0.0.1", "::1") or parsed.port != port or parsed.username or parsed.password or parsed.path:
            raise ValueError()
        origin = handler.headers.get("Origin")
        if origin and origin != "http://" + host:
            raise ValueError()
        if mutate and (not origin or not secrets.compare_digest(handler.headers.get("X-SeedAudio-Token", ""), service.csrf)):
            raise ValueError()
        if token_read:
            # Same-origin browser GET normally sends Referer rather than Origin.
            ref = urllib.parse.urlparse(handler.headers.get("Referer", ""))
            same_origin = bool(origin) or (ref.scheme == "http" and ref.netloc == host and not ref.username and not ref.password)
            if not same_origin or not secrets.compare_digest(handler.headers.get("X-SeedAudio-Token", ""), service.csrf):
                raise ValueError()
    except (ValueError, TypeError):
        raise SeedAudioError("此接口仅允许本地编辑器的同源请求。", 403) from None


def handle_http(handler, method, serve_file, service=None):
    service = service or SERVICE
    path = urllib.parse.urlparse(handler.path).path
    if not path.startswith("/api/seed-audio/"):
        return False
    def reply(status, value):
        handler._send(status, "application/json; charset=utf-8", json.dumps(value, ensure_ascii=False).encode("utf-8"))
    try:
        guard_request(handler, service, method == "POST", token_read=path in ("/api/seed-audio/jobs", "/api/seed-audio/line-drafts"))
        if method == "GET":
            if path == "/api/seed-audio/status":
                reply(200, service.status())
            elif path == "/api/seed-audio/jobs":
                reply(200, service.list_jobs())
            elif path == "/api/seed-audio/line-drafts":
                reply(200, service.line_drafts())
            elif re.fullmatch(r"/api/seed-audio/jobs/[a-f0-9]{32}", path):
                reply(200, service.job(path.rsplit("/", 1)[1]))
            elif re.fullmatch(r"/api/seed-audio/preview/[a-f0-9]{32}/(raw|processed)", path):
                job_id, kind = path.rsplit("/", 2)[1:]
                source = service.preview_file(job_id, kind)
                serve_file(handler, source, "audio/mpeg" if source.endswith(".mp3") else "audio/wav")
            else:
                raise SeedAudioError("接口不存在。", 404)
        else:
            if handler.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise SeedAudioError("请使用 application/json 请求。")
            length = integer(handler.headers.get("Content-Length", 0), 1, MAX_BODY, "请求大小")
            req = json.loads(handler.rfile.read(length).decode("utf-8"))
            if not isinstance(req, dict):
                raise SeedAudioError("请求必须是 JSON 对象。")
            if path == "/api/seed-audio/credentials":
                reply(200, service.configure(req))
            elif path == "/api/seed-audio/generate":
                reply(202, service.submit(req))
            elif path == "/api/seed-audio/line-drafts":
                reply(200, service.save_line_draft(req))
            elif path == "/api/seed-audio/cancel":
                reply(200, service.cancel(req.get("id")))
            elif path == "/api/seed-audio/delete":
                reply(200, service.delete(req.get("id"), req.get("expectedTarget", MISSING)))
            elif path == "/api/seed-audio/bind":
                reply(200, service.bind(req.get("id"), req))
            elif path == "/api/seed-audio/process":
                reply(200, service.process(req.get("id"), req.get("opts"), req.get("expectedTarget", MISSING)))
            elif path == "/api/seed-audio/save":
                reply(200, service.save(req.get("id"), req.get("filename"), req.get("opts"), req.get("expectedTarget", MISSING)))
            else:
                raise SeedAudioError("接口不存在。", 404)
    except SeedAudioError as error:
        body = {"ok": False, "error": str(error)}
        if isinstance(error, SeedAudioLineDraftConflict):
            body["current"] = error.current
        reply(error.status, body)
    except (ValueError, UnicodeError):
        reply(400, {"ok": False, "error": "请求 JSON 无效。"})
    except Exception:
        reply(500, {"ok": False, "error": "本地音频服务处理失败。"})
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate and save one story voice using local credentials.")
    prompt_input = parser.add_mutually_exclusive_group(required=True)
    prompt_input.add_argument("--prompt", help="Complete model prompt; forwarded verbatim")
    prompt_input.add_argument("--text", help="Legacy alias for one complete prompt; forwarded verbatim")
    parser.add_argument("--age", type=int, choices=PRESETS, default=20)
    parser.add_argument("--reference")
    parser.add_argument("--output", required=True, help="New filename in resource/sound/voice (.mp3/.wav); existing files are never overwritten")
    parser.add_argument("--speech-rate", type=int, default=0)
    parser.add_argument("--pad-ms", type=int, default=60)
    parser.add_argument("--bitrate", type=int, default=96)
    args = parser.parse_args()
    try:
        # [feature:seed-audio-reference-cli-default]
        req = {"prompt": args.prompt if args.prompt is not None else args.text, "age": args.age, "speech_rate": args.speech_rate}
        if args.reference is not None:
            req["reference"] = args.reference
        # [/feature:seed-audio-reference-cli-default]
        task = SERVICE.submit(req)
        SERVICE.wait(task["id"])
        print(json.dumps(SERVICE.save(task["id"], args.output, {"silencePadMs": args.pad_ms, "bitrate": args.bitrate}), ensure_ascii=False))
    except SeedAudioError as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        raise SystemExit(1)
