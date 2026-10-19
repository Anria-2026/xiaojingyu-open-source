"""Double-click launch support, reusing the game's and editor's existing handlers."""
import argparse
from http.server import ThreadingHTTPServer
import importlib.util
from pathlib import Path
import runpy
import socket
import subprocess
import sys
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent.parent


class LocalServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('game', 'editor'))
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--port', type=int)
    args = parser.parse_args()
    if sys.version_info < (3, 10):
        raise RuntimeError('Please install Python 3.10 or newer, then restart.')
    if args.mode == 'editor' and importlib.util.find_spec('PIL') is None:
        print('First launch: installing the editor image dependency (Pillow)...', flush=True)
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'Pillow'], check=True)
    source = ROOT / ('editor/server.py' if args.mode == 'editor' else 'h5_demo/dev_server.py')
    sys.path.insert(0, str(source.parent))
    module = runpy.run_path(str(source))
    port = args.port if args.port is not None else module['PORT']
    # Bind first: an occupied port never triggers a browser to an unrelated server.
    # This launcher never kills a pre-existing process.
    with LocalServer(('127.0.0.1', port), module['Handler']) as server:
        url = f'http://127.0.0.1:{port}/'
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
        print('If the port is in use, close its existing service window and retry.', file=sys.stderr)
        sys.exit(1)
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
