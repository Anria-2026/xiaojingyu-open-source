# -*- coding: utf-8 -*-
"""
游戏本地服务器：同时服务 h5_demo（首页/JS/样式）与 /resource（项目根资源目录）
- 资源统一在 resource/，游戏直接引用 resource/xxx，本服务器把它映射到项目根 resource
- 带 URL 解码（文件名含空格/中文），禁缓存
用法：python dev_server.py   （端口 8080）
"""
import json, os, sys, mimetypes, secrets, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from local_saves import LocalSaves, SaveConflict

H5_DEMO = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(H5_DEMO)          # 项目根（含 resource）
PORT = 8080

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}


class Handler(BaseHTTPRequestHandler):
    save_store = LocalSaves(PROJECT_ROOT)

    def _local_host(self):
        try:
            return urllib.parse.urlsplit('http://'+self.headers.get('Host','')).hostname in ('127.0.0.1','localhost','::1')
        except ValueError:
            return False

    def log_message(self, fmt, *args):
        pass

    def _json(self, status, value):
        raw = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        if urllib.parse.urlsplit(self.path).path != self.save_store.config['api']:
            return self.send_error(404)
        host = self.headers.get('Host', '')
        origin = self.headers.get('Origin')
        token = self.headers.get('X-Whale-Save-Token', '')
        if (not self._local_host() or (origin and origin != 'http://'+host)
                or not secrets.compare_digest(token.encode('utf-8'), self.save_store.token.encode('utf-8'))):
            return self._json(403, {'ok':False, 'error':'Refresh this local game page before saving.'})
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self._json(415, {'ok':False, 'error':'JSON required.'})
        try:
            length = int(self.headers.get('Content-Length', '-1'))
            if length < 0 or length > self.save_store.config['maxBytes']:
                return self._json(413, {'ok':False, 'error':'Invalid save request size.'})
            request = json.loads(self.rfile.read(length).decode('utf-8'))
            return self._json(200, {'ok':True, 'storage':self.save_store.update(request)})
        except SaveConflict as error:
            return self._json(409, {'ok':False, 'error':str(error)})
        except (ValueError, UnicodeError) as error:
            return self._json(400, {'ok':False, 'error':str(error)})
        except OSError as error:
            return self._json(500, {'ok':False, 'error':str(error)})

    # 2026-09-12：浏览器**提前断开连接**（刷新 / 关标签 / 预览面板换页）时，
    # socketserver 会把 WinError 10053 / BrokenPipe 当异常打一整屏 traceback —— 其实完全正常。
    # 用户自己开着这个窗口玩的时候会被这堆红字吓到，所以就地静音。
    def handle_one_request(self):
        try:
            BaseHTTPRequestHandler.handle_one_request(self)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, TimeoutError):
            self.close_connection = True

    # [feature:local-media-byte-ranges]
    def _serve(self, fp):
        from media_http import serve_file
        ext = os.path.splitext(fp)[1].lower()
        ctype = MIME.get(ext) or mimetypes.guess_type(fp)[0] or "application/octet-stream"
        return serve_file(self, fp, ctype)

    def do_HEAD(self):
        return self.do_GET()

    # [/feature:local-media-byte-ranges]
    def do_GET(self):
        path = urllib.parse.unquote(self.path.split("?")[0])
        # /resource/* → 项目根 resource（资源统一在此）
        if path.startswith("/resource/"):
            rel = path[len("/resource/"):]
            fp = os.path.normpath(os.path.join(PROJECT_ROOT, "resource", rel))
            if fp.startswith(os.path.join(PROJECT_ROOT, "resource")) and os.path.isfile(fp):
                return self._serve(fp)
            return self.send_error(404)
        # 其他 → h5_demo 目录；/ → index.html
        rel = path.lstrip("/")
        if not rel:
            rel = "index.html"
        fp = os.path.normpath(os.path.join(H5_DEMO, rel))
        if fp.startswith(H5_DEMO) and os.path.isfile(fp):
            if os.path.normcase(fp) == os.path.normcase(os.path.join(H5_DEMO, 'index.html')):
                if not self._local_host():
                    return self.send_error(403)
                # Inline bootstrap completes before either modern or legacy game
                # scripts. Static/platform deployments receive the original HTML.
                with open(fp, 'r', encoding='utf-8') as source:
                    html = source.read()
                html = html.replace('<head>', '<head>'+self.save_store.bootstrap(), 1)
                raw = html.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers()
                if self.command != 'HEAD':
                    self.wfile.write(raw)
                return
            return self._serve(fp)
        self.send_error(404)


if __name__ == "__main__":
    print("=" * 50)
    print("  鲸鱼娘养成计划 · 本地服务器")
    print("  浏览器打开: http://127.0.0.1:%d" % PORT)
    print("  资源目录: resource/（统一管理，改动即生效）")
    print("  存档文件: %s" % Handler.save_store.file)
    print("  关闭本窗口即停止服务")
    print("=" * 50)
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except OSError as e:
        print("[错误] 端口 %d 被占用！请先关闭旧服务进程再启动。" % PORT)
        input("按回车退出...")
