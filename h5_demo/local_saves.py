"""Project-owned save storage for the loopback development server only."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import secrets
import tempfile
import threading
import time


class SaveConflict(Exception):
    pass


class LocalSaves:
    def __init__(self, project_root, config=None):
        self.root = Path(project_root).resolve()
        self.config = config or json.loads((self.root/'h5_demo/local_save_config.json').read_text(encoding='utf-8'))
        self.file = (self.root/self.config['file']).resolve()
        if not self.file.is_relative_to(self.root) or self.file == self.root:
            raise ValueError('Save path must remain inside this project.')
        self.token = secrets.token_urlsafe(32)
        self.mutex = threading.RLock()

    def managed(self, key):
        return isinstance(key, str) and (key in self.config['keys'] or any(key.startswith(p) for p in self.config['keyPrefixes']))

    @contextmanager
    def locked(self):
        # A file lock also protects separate local servers using different ports.
        with self.mutex:
            self.file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.file.with_suffix('.lock'), 'a+b') as lock:
                deadline = time.monotonic()+2
                while True:
                    try:
                        lock.seek(0)
                        if os.name == 'nt':
                            import msvcrt
                            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
                        else:
                            import fcntl
                            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                        break
                    except OSError:
                        if time.monotonic() >= deadline:
                            raise SaveConflict('Save file is busy; reload before retrying.')
                        time.sleep(.02)
                try:
                    yield
                finally:
                    lock.seek(0)
                    if os.name == 'nt':
                        msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        fcntl.flock(lock.fileno(), fcntl.LOCK_UN)

    def _read(self):
        if not self.file.exists():
            return {'version':1, 'revision':0, 'migrated':False, 'values':{}}
        if self.file.stat().st_size > self.config['maxBytes']:
            raise ValueError('Save file exceeds the supported size.')
        data = json.loads(self.file.read_text(encoding='utf-8'))
        if (not isinstance(data, dict) or data.get('version') != 1
                or type(data.get('revision')) is not int or data['revision'] < 0
                or type(data.get('migrated')) is not bool or not isinstance(data.get('values'), dict)
                or any(not self.managed(k) or not isinstance(v, str) for k,v in data['values'].items())):
            raise ValueError('Invalid save file; the original has been preserved.')
        return data

    def read(self):
        with self.locked():
            return self._read()

    def update(self, request):
        if not isinstance(request, dict) or request.get('action') not in ('write', 'migrate', 'clear'):
            raise ValueError('Invalid save operation.')
        changes = request.get('values', {})
        if not isinstance(changes, dict) or any(not self.managed(k) or (v is not None and not isinstance(v,str)) for k,v in changes.items()):
            raise ValueError('Invalid storage key or value.')
        with self.locked():
            data = self._read()
            # Migration is one-time and never overwrites existing file values.
            if request['action'] == 'migrate' and data['migrated']:
                return data
            if request.get('revision') != data['revision']:
                raise SaveConflict('Save changed in another page; reload before saving.')
            if request['action'] == 'clear':
                data['values'] = {}
            else:
                for key,value in changes.items():
                    if request['action'] == 'migrate' and key in data['values']:
                        continue
                    if value is None:
                        data['values'].pop(key, None)
                    else:
                        data['values'][key] = value
            data['migrated'] = True
            data['revision'] += 1
            raw = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
            if len(raw) > self.config['maxBytes']:
                raise ValueError('Save file exceeds the supported size.')
            fd, temporary = tempfile.mkstemp(prefix='.storage-', suffix='.tmp', dir=self.file.parent)
            try:
                with os.fdopen(fd, 'wb') as target:
                    target.write(raw)
                    target.flush()
                    os.fsync(target.fileno())
                os.replace(temporary, self.file)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
            return data

    def bootstrap(self):
        try:
            data = self.read()
            error = None
        except (OSError, ValueError) as problem:
            data = {'version':1, 'revision':0, 'migrated':True, 'values':{}}
            error = str(problem)
        payload = {**data, 'error':error, 'api':self.config['api'], 'token':self.token,
                   'keyPrefixes':self.config['keyPrefixes'], 'keys':self.config['keys'], 'messages':self.config['messages']}
        source = (self.root/'h5_demo/js/local_save_storage.js').read_text(encoding='utf-8')
        encoded = json.dumps(payload, ensure_ascii=True).replace('<', '\\u003c')
        return '<script>('+source+')('+encoded+');</script>'
