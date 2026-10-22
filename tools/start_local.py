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
import shutil
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


def pip_available(python):
    try:
        result = subprocess.run(
            [python, '-m', 'pip', '--version'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        return False
    return result.returncode == 0


def install_pillow(python):
    if not pip_available(python):
        raise RuntimeError(f'{python} 缺少 pip，无法安装 Pillow。')
    print('正在安装图片处理依赖 Pillow（需要联网）……', flush=True)
    subprocess.run([python, '-m', 'pip', 'install', 'Pillow'], check=True)


def ensure_pip(python):
    if pip_available(python):
        return True
    print('当前环境缺少 pip，正在尝试修复……', flush=True)
    try:
        subprocess.run([python, '-m', 'ensurepip', '--upgrade'], check=True)
    except (OSError, subprocess.CalledProcessError):
        pass
    return pip_available(python)


def print_pip_help(python):
    base = getattr(sys, '_base_executable', sys.executable)
    venv = ROOT / '.venv'
    print('当前环境缺少 pip，无法安装 Pillow。', flush=True)
    print('请先安装 python3-venv（Debian/Ubuntu）或对应的 pip 包，然后执行：', flush=True)
    print(f'  {python} -m ensurepip --upgrade', flush=True)
    print(f'  {python} -m pip install Pillow', flush=True)
    print('或重新创建虚拟环境：', flush=True)
    print(f'  {base} -m venv "{venv}"', flush=True)


def dependency_help():
    if sys.platform == 'darwin':
        return '请安装 Python 3.10+（python.org 或 brew install python），或手动执行 python3 -m pip install Pillow。'
    hints = (
        ('apt-get', 'sudo apt install python3-venv python3-pip'),
        ('dnf', 'sudo dnf install python3-pip'),
        ('pacman', 'sudo pacman -S python-pip'),
        ('zypper', 'sudo zypper install python3-pip'),
        ('apk', 'sudo apk add py3-pip'),
    )
    for command, hint in hints:
        if shutil.which(command):
            return hint
    return '请用系统包管理器安装 python3-venv / python3-pip，或安装 python3-pil。'


def ensure_editor_pillow():
    if importlib.util.find_spec('PIL') is not None:
        return
    if os.name != 'posix':
        # Windows keeps the existing one-step dependency install.
        install_pillow(sys.executable)
        return

    in_venv = sys.prefix != sys.base_prefix
    print('未检测到编辑器所需的图片处理依赖 Pillow。', flush=True)
    if not sys.stdin.isatty():
        print('请先安装 Pillow 后重试：' + dependency_help(), flush=True)
        raise RuntimeError('编辑器需要 Pillow。')

    if in_venv:
        prompt = '是否在当前虚拟环境安装 Pillow？需要联网 [y/N] '
    else:
        prompt = '是否在项目内创建 .venv 并安装 Pillow？需要联网 [y/N] '
    try:
        answer = input(prompt).strip().lower()
    except EOFError:
        answer = ''
    if answer not in ('y', 'yes'):
        print('已取消。可手动安装 Pillow 后重新启动：', flush=True)
        print('  ' + dependency_help(), flush=True)
        raise RuntimeError('编辑器需要 Pillow。')

    if in_venv:
        if not ensure_pip(sys.executable):
            print_pip_help(sys.executable)
            raise RuntimeError('编辑器虚拟环境缺少 pip。')
        try:
            install_pillow(sys.executable)
        except subprocess.CalledProcessError as error:
            raise RuntimeError(f'Pillow 安装失败（退出码 {error.returncode}），请检查网络后重试。') from error
        return

    venv = ROOT / '.venv'
    print(f'正在创建虚拟环境：{venv}', flush=True)
    try:
        subprocess.run([sys.executable, '-m', 'venv', str(venv)], check=True)
    except (OSError, subprocess.CalledProcessError) as error:
        print('创建虚拟环境失败。请先安装 python3-venv：', flush=True)
        print('  ' + dependency_help(), flush=True)
        raise RuntimeError('编辑器虚拟环境创建失败。') from error

    python = venv / 'bin' / 'python'
    if not python.is_file():
        raise RuntimeError('虚拟环境创建失败：未找到 .venv/bin/python。')
    if not ensure_pip(str(python)):
        print_pip_help(str(python))
        raise RuntimeError('编辑器虚拟环境缺少 pip。')
    try:
        install_pillow(str(python))
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f'Pillow 安装失败（退出码 {error.returncode}），请检查网络后重试。') from error

    print('依赖已安装，正在重新启动编辑器……', flush=True)
    os.execv(str(python), [str(python), '-B', str(Path(__file__).resolve()), *sys.argv[1:]])


def browser_available():
    if os.name == 'nt' or sys.platform == 'darwin':
        return True
    return bool(os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY') or os.environ.get('BROWSER'))


def open_browser(url):
    try:
        opened = webbrowser.open(url)
    except Exception:
        opened = False
    if not opened:
        print(f'无法自动打开浏览器，请手动访问：{url}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('game', 'editor'))
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--port', type=int)
    args = parser.parse_args()
    if args.port is not None and not 0 <= args.port <= 65535:
        parser.error('--port must be between 0 and 65535')
    if sys.version_info < (3, 10):
        raise RuntimeError('需要 Python 3.10 或更新版本，请安装后重新启动。')
    if args.mode == 'editor':
        ensure_editor_pillow()
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
        label = '游戏' if args.mode == 'game' else '编辑器'
        print(f'{label}地址：{url}\n使用期间请保留此窗口。', flush=True)
        if args.mode == 'game':
            print(f'项目存档：{module["Handler"].save_store.file}', flush=True)
        print('关闭窗口或按 Ctrl+C 停止服务。', flush=True)
        if not args.no_browser:
            if browser_available():
                threading.Timer(0.4, open_browser, args=(url,)).start()
            else:
                print(f'当前没有可用的桌面会话，请手动访问：{url}', flush=True)
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
