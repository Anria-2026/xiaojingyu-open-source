# -*- coding: utf-8 -*-
"""voice_proc.py — 语音 wav 剪辑/处理（纯标准库）

为什么自己写：本机 numpy 不可用，且 **audioop 在 Python 3.13 已被移除** ——
所以只用 wave / struct / array 实现，不引入任何依赖。

处理链（顺序固定，与前端参数一一对应）：
    ① 裁切 crop        取 [start, end] 秒（留空 = 不裁）
    ② 去头尾静音 trim  阈值以下视为静音，前后各留 pad 毫秒（语音最常用）
    ③ 淡入淡出 fade    默认 30ms，防止头尾爆音
    ④ 峰值归一 normalize 把峰值拉到目标 dBFS，统一响度
    ⑤ 声道 channels    keep（默认）/ mono

约定：内部一律 **16-bit PCM 交错采样** + `array('h')`；
输入支持 8/16/32-bit PCM 整数 wav；已是 16-bit 则原样读取。
"""

import array
import struct
import sys
import wave
from io import BytesIO

# ---------------------------------------------------------------- 读写

def _swap_if_needed(a):
    """array('h') 是本机字节序；WAV 是小端。在大端机器上要翻一次。"""
    if sys.byteorder == "big":
        a.byteswap()
    return a


def read_wav(data):
    """bytes → (array('h') 交错采样, nch, rate, width)

    只接受**未压缩 PCM**；8/16/32-bit 整数都支持，统一转成 16-bit。
    浮点 / ADPCM / mp3 之类会抛 ValueError，由调用方翻成友好提示。
    """
    bio = BytesIO(data)
    try:
        w = wave.open(bio, "rb")
    except Exception as e:
        raise ValueError("不是有效的 wav（%s）" % e)
    nch = w.getnchannels()
    rate = w.getframerate()
    width = w.getsampwidth()
    nframes = w.getnframes()
    raw = w.readframes(nframes)
    w.close()
    if w.getcomptype() != "NONE":
        raise ValueError("只支持未压缩 PCM wav（当前 %s）" % w.getcomptype())
    if width == 1:
        # 8-bit wav 是**无符号**，先转成有符号再升到 16-bit
        u = array.array("B")
        u.frombytes(raw)
        s = array.array("h", [((v - 128) << 8) for v in u])
        return _swap_if_needed(s), nch, rate, 2
    if width == 2:
        s = array.array("h")
        s.frombytes(raw[: (len(raw) // 2) * 2])
        return _swap_if_needed(s), nch, rate, 2
    if width == 4:
        s32 = array.array("i")
        s32.frombytes(raw[: (len(raw) // 4) * 4])
        _swap_if_needed(s32)
        # 32 → 16：右移 16 位（保留符号）
        s = array.array("h", [v >> 16 for v in s32])
        return s, nch, rate, 2
    raise ValueError("不支持的位深：%d 字节（只支持 8/16/32-bit PCM）" % width)


def write_wav(samples, nch, rate):
    """array('h') → wav bytes（固定 16-bit PCM，浏览器/游戏都认）"""
    bio = BytesIO()
    w = wave.open(bio, "wb")
    w.setnchannels(nch)
    w.setsampwidth(2)
    w.setframerate(rate)
    a = array.array("h", samples)
    if sys.byteorder == "big":
        a.byteswap()
    w.writeframes(a.tobytes())
    w.close()
    return bio.getvalue()


# ---------------------------------------------------------------- 处理

def crop(samples, nch, rate, start_s=None, end_s=None):
    """取 [start, end] 秒（None/空 = 该端不裁）"""
    n = len(samples) // nch
    a = 0 if start_s in (None, "") else max(0, int(float(start_s) * rate))
    b = n if end_s in (None, "") else min(n, int(float(end_s) * rate))
    if b <= a:
        raise ValueError("裁切区间为空（start=%.3fs end=%.3fs）" % (a / rate, b / rate))
    return array.array("h", samples[a * nch: b * nch])


def trim_silence(samples, nch, rate, thresh=0.01, pad_ms=60):
    """去掉头尾静音；thresh 是相对满量程的幅度（0.01 ≈ -40dBFS）。

    取「**任一声道**超过阈值」作为有声判据（单声道录音另一轨可能是噪声底，
    用 max 判定对语音最稳）；留 pad_ms 的缓冲，免得把咬字的起音切掉。
    """
    if thresh <= 0:
        return samples
    limit = int(max(1, min(32767, thresh * 32767)))
    n = len(samples) // nch
    first, last = None, None
    for i in range(n):
        base = i * nch
        peak = 0
        for c in range(nch):
            v = samples[base + c]
            if v < 0:
                v = -v
            if v > peak:
                peak = v
        if peak >= limit:
            if first is None:
                first = i
            last = i
    if first is None:
        # 全程静音：不返回空（空 wav 会让游戏里"点了没反应"更难查）—— 保留原样
        return samples
    pad = int(pad_ms / 1000.0 * rate)
    a = max(0, first - pad)
    b = min(n, last + 1 + pad)
    return array.array("h", samples[a * nch: b * nch])


def fade(samples, nch, rate, fade_in_ms=30, fade_out_ms=30):
    """线性淡入淡出（防爆音）"""
    n = len(samples) // nch
    if n <= 0:
        return samples
    out = array.array("h", samples)
    fi = max(0, int(fade_in_ms / 1000.0 * rate))
    fo = max(0, int(fade_out_ms / 1000.0 * rate))
    if fi > n:
        fi = n
    for i in range(fi):
        g = i / float(fi)
        base = i * nch
        for c in range(nch):
            out[base + c] = int(out[base + c] * g)
    if fo > n:
        fo = n
    for k in range(fo):
        i = n - 1 - k
        g = k / float(fo)
        base = i * nch
        for c in range(nch):
            out[base + c] = int(out[base + c] * g)
    return out


def normalize(samples, target_dbfs=-1.0):
    """峰值归一：把最大峰值拉到 target_dbfs。全静音则原样返回（不放大噪声底）。"""
    peak = 0
    for v in samples:
        if v < 0:
            v = -v
        if v > peak:
            peak = v
    if peak <= 0:
        return samples
    target = int(32767 * (10 ** (target_dbfs / 20.0)))
    if target <= 0:
        return samples
    g = target / float(peak)
    if abs(g - 1.0) < 1e-4:
        return samples
    return array.array("h", [max(-32768, min(32767, int(v * g))) for v in samples])


def to_mono(samples, nch):
    """多声道取平均（语音用；比只取左声道更抗单边噪声）"""
    if nch <= 1:
        return samples, 1
    n = len(samples) // nch
    out = array.array("h", bytes(0))
    for i in range(n):
        base = i * nch
        s = 0
        for c in range(nch):
            s += samples[base + c]
        out.append(int(s / nch))
    return out, 1


def process(data, opts=None):
    """完整处理链。opts 键（都可缺省）：

        cropStart / cropEnd   秒；空 = 不裁
        trimSilence           bool（默认 True）
        silenceThresh         0~1（默认 0.01 ≈ -40dBFS）
        silencePadMs          默认 60
        fadeInMs / fadeOutMs  默认 30 / 30
        normalize             bool（默认 True）
        targetDbfs            默认 -1.0
        channels              "keep"（默认）| "mono"

    返回 (wav bytes, info dict) —— info 给前端显示「处理前→处理后」的对比。
    """
    o = opts or {}
    samples, nch, rate, _w = read_wav(data)
    info = {"inFrames": len(samples) // max(1, nch), "rate": rate, "inChannels": nch,
            "inSec": round((len(samples) / max(1, nch)) / float(rate), 3)}

    samples = crop(samples, nch, rate, o.get("cropStart"), o.get("cropEnd"))
    if o.get("trimSilence", True):
        samples = trim_silence(samples, nch, rate,
                               float(o.get("silenceThresh", 0.01) or 0.01),
                               float(o.get("silencePadMs", 60) or 0))
    samples = fade(samples, nch, rate,
                   float(o.get("fadeInMs", 30) or 0),
                   float(o.get("fadeOutMs", 30) or 0))
    if o.get("normalize", True):
        samples = normalize(samples, float(o.get("targetDbfs", -1.0) or -1.0))
    if (o.get("channels") or "keep") == "mono":
        samples, nch = to_mono(samples, nch)

    out = write_wav(samples, nch, rate)
    info["outFrames"] = len(samples) // max(1, nch)
    info["outChannels"] = nch
    info["outSec"] = round((len(samples) / max(1, nch)) / float(rate), 3)
    info["outBytes"] = len(out)
    info["trimmedMs"] = int(round((info["inSec"] - info["outSec"]) * 1000)) \
        if o.get("trimSilence", True) or o.get("cropStart") or o.get("cropEnd") else 0
    return out, info


# ---------------------------------------------------------------- 自测

def _tone(freq, sec, rate=44100, amp=8000):
    """生成一段正弦（自测用，不参与生产）"""
    n = int(sec * rate)
    import math
    return array.array("h", [int(amp * math.sin(2 * math.pi * freq * i / rate)) for i in range(n)])


def _selftest():
    rate = 44100
    silent = array.array("h", [0] * int(0.5 * rate))
    body = _tone(440, 0.5)
    src = silent + body + silent                      # 1.5s，前后各 0.5s 静音
    data = write_wav(src, 1, rate)

    out, info = process(data, {"silencePadMs": 20, "fadeInMs": 5, "fadeOutMs": 5})
    print("① 去静音：%.3fs → %.3fs（去掉 %dms）" % (info["inSec"], info["outSec"], info["trimmedMs"]))
    assert 0.5 < info["outSec"] < 0.6, "应当只留 0.5s 有声段 + 少量 pad"

    # 归一：峰值应接近目标
    s2, _n, _r, _w = read_wav(out)
    peak = max(abs(v) for v in s2)
    print("② 峰值归一：peak=%d（目标 -1dBFS ≈ 29204）" % peak)
    assert 28500 < peak <= 29204, "峰值应被拉到目标附近"

    # 淡入：首样本应接近 0
    print("③ 淡入：首样本=%d 末样本=%d" % (s2[0], s2[-1]))
    assert abs(s2[0]) < 400 and abs(s2[-1]) < 400, "头尾应被淡到接近 0"

    # 裁切
    out3, info3 = process(data, {"trimSilence": False, "normalize": False,
                                 "cropStart": 0.5, "cropEnd": 1.0, "fadeInMs": 0, "fadeOutMs": 0})
    print("④ 裁切 0.5~1.0s：%.3fs" % info3["outSec"])
    assert 0.49 < info3["outSec"] < 0.51

    # 立体声 → 单声道
    st = array.array("h", [])
    for i in range(int(0.1 * rate)):
        st.append(3000); st.append(-3000)
    out4, info4 = process(write_wav(st, 2, rate), {"channels": "mono", "normalize": False,
                                                   "trimSilence": False, "fadeInMs": 0, "fadeOutMs": 0})
    print("⑤ 立体声→单声道：%d → %d 声道" % (info4["inChannels"], info4["outChannels"]))
    assert info4["outChannels"] == 1
    s4, _n2, _r2, _w2 = read_wav(out4)
    assert max(abs(v) for v in s4) <= 1, "左右相反应被平均成 0（不放大）"

    # 全静音不应返回空
    out5, info5 = process(write_wav(silent, 1, rate), {})
    print("⑥ 全静音：%.3fs（保持原样，不返回空）" % info5["outSec"])
    assert info5["outSec"] > 0.4

    print("\n✓ voice_proc 自测全部通过")


if __name__ == "__main__":
    _selftest()
