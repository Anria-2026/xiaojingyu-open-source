"""Double-click launch support, reusing the game's and editor's existing handlers."""
import argparse
import errno
import hashlib
from http.server import ThreadingHTTPServer
import importlib.util
import json
import os
from pathlib import Path
import runpy
import socket
import subprocess
import sys
import threading
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent.parent
IDENTITY_PATH = '/__whale_launcher__'


class LocalServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def launcher_identity(mode):
    # Distinguish separate copies/worktrees without exposing their local paths.
    project = hashlib.sha256(os.path.normcase(str(ROOT.resolve())).encode('utf-8')).hexdigest()
    return {'launcher': 1, 'project': project, 'mode': mode}


def identified_handler(handler, mode):
    identity = json.dumps(launcher_identity(mode)).encode('utf-8')

    class Handler(handler):
        def do_GET(self):
            if self.path != IDENTITY_PATH:
                return super().do_GET()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(identity)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(identity)

    return Handler


def is_running_here(port, mode):
    try:
        # Local checks must never go through a system HTTP proxy.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(f'http://127.0.0.1:{port}{IDENTITY_PATH}', timeout=0.4) as response:
            return json.loads(response.read(4096)) == launcher_identity(mode)
    except (OSError, ValueError):
        return False


def find_server(handler, mode, port, allow_fallback=True):
    candidates = [port]
    if allow_fallback and port:
        candidates = list(range(port, min(port + 20, 65536))) + [0]
    for candidate in candidates:
        try:
            server = LocalServer(('127.0.0.1', candidate), identified_handler(handler, mode))
            return server, server.server_address[1]
        except OSError as error:
            if error.errno != errno.EADDRINUSE and getattr(error, 'winerror', None) != 10048:
                raise
            if is_running_here(candidate, mode):
                return None, candidate
            if not allow_fallback:
                raise RuntimeError(f'指定端口 {port} 已被其他服务占用。去掉 --port 可自动选择空闲端口。') from error
    raise RuntimeError('未找到可用的本地端口。')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('game', 'editor'))
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--port', type=int)
    args = parser.parse_args()
    if args.port is not None and not 0 <= args.port <= 65535:
        parser.error('--port must be between 0 and 65535')
    if sys.version_info < (3, 10):
        raise RuntimeError('Please install Python 3.10 or newer, then restart.')
    if args.mode == 'editor' and importlib.util.find_spec('PIL') is None:
        print('First launch: installing the editor image dependency (Pillow)...', flush=True)
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'Pillow'], check=True)
    source = ROOT / ('editor/server.py' if args.mode == 'editor' else 'h5_demo/dev_server.py')
    sys.path.insert(0, str(source.parent))
    module = runpy.run_path(str(source))
    port = args.port if args.port is not None else module['PORT']
    server, actual_port = find_server(module['Handler'], args.mode, port, args.port is None)
    url = f'http://127.0.0.1:{actual_port}/'
    if server is None:
        print(f'当前项目已在运行，打开已有的{ "游戏" if args.mode == "game" else "编辑器" }：{url}', flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        return
    with server:
        if actual_port != port and port:
            print(f'默认端口 {port} 已被其他服务占用，已自动改用 {actual_port}。', flush=True)
        print(f'Whale {args.mode}: {url}\nKeep this window open while using it.', flush=True)
        if args.mode == 'game':
            print(f'Project saves: {module["Handler"].save_store.file}', flush=True)
        print('Close the window or press Ctrl+C to stop.', flush=True)
        if not args.no_browser:
            threading.Timer(0.4, webbrowser.open, args=(url,)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    try:
        main()
    except OSError as error:
        print(f'Could not start: {error}', file=sys.stderr)
        sys.exit(1)
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
