"""Synthetic project directories only; never reads or edits player saves."""
import json
import http.client
from http.server import ThreadingHTTPServer
from pathlib import Path
import tempfile
import unittest
import threading
from unittest.mock import patch
from local_saves import LocalSaves, SaveConflict


class LocalSaveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config = json.loads((Path(__file__).parent/'local_save_config.json').read_text(encoding='utf-8'))
        self.store = LocalSaves(self.root, self.config)
        self.key = 'whale_dev_v35_auto'

    def tearDown(self):
        self.temp.cleanup()

    def update(self, action, revision, values=None):
        return self.store.update({'action':action, 'revision':revision, 'values':values or {}})

    def test_migration_deletion_and_new_browser_do_not_resurrect_slots(self):
        self.update('migrate', 0, {self.key:'old browser save'})
        self.update('write', 1, {self.key:None})
        self.update('migrate', 0, {self.key:'stale second browser save'})
        self.assertEqual(self.store.read()['values'], {})
        self.assertEqual(LocalSaves(self.root,self.config).read()['revision'],2)

    def test_newer_file_wins_migration_and_concurrent_writer_is_rejected(self):
        self.update('write',0,{self.key:'new file save'})
        self.assertEqual(self.update('migrate',0,{self.key:'old browser'})['values'][self.key],'new file save')
        other = LocalSaves(self.root,self.config)
        with self.assertRaises(SaveConflict):
            other.update({'action':'write','revision':0,'values':{self.key:'stale page'}})
        self.assertEqual(self.store.read()['values'][self.key],'new file save')

    def test_failed_atomic_replace_preserves_previous_file(self):
        self.update('write',0,{self.key:'original'})
        with patch('local_saves.os.replace',side_effect=OSError('synthetic disk failure')):
            with self.assertRaises(OSError): self.update('write',1,{self.key:'lost write'})
        self.assertEqual(self.store.read()['values'][self.key],'original')
        self.assertFalse(list(self.store.file.parent.glob('*.tmp')))

    def test_corrupt_or_future_file_is_never_replaced(self):
        self.store.file.parent.mkdir(parents=True)
        for raw in ('{bad json', '{"version":99,"values":{}}'):
            self.store.file.write_text(raw,encoding='utf-8')
            with self.assertRaises(ValueError): self.update('migrate',0,{})
            self.assertEqual(self.store.file.read_text(encoding='utf-8'),raw)

    def test_non_game_keys_and_external_paths_are_rejected(self):
        for key in ('../config','whale_music_vol','__proto__'):
            with self.assertRaises(ValueError): self.update('write',0,{key:'bad'})
        with self.assertRaises(ValueError): LocalSaves(self.root,{**self.config,'file':'../outside.json'})

    def test_achievements_gallery_and_clear_survive_reopening(self):
        values={'whale_dev_v35_slot_0':'manual','whale_dev_v35_stage':'anchor','whale_dev_v35_achv':'achievements','whale_special_cg_ledger_v1':'gallery'}
        self.update('write',0,values)
        self.assertEqual(LocalSaves(self.root,self.config).read()['values'],values)
        self.update('clear',1)
        self.assertTrue(self.store.read()['migrated'])
        self.assertEqual(self.store.read()['values'],{})

    def test_http_bootstrap_write_authorization_and_private_file(self):
        from dev_server import Handler
        code = self.root/'h5_demo/js/local_save_storage.js'
        code.parent.mkdir(parents=True)
        code.write_text((Path(__file__).parent/'js/local_save_storage.js').read_text(encoding='utf-8'),encoding='utf-8')
        class FixtureHandler(Handler):
            save_store = self.store
        server = ThreadingHTTPServer(('127.0.0.1',0),FixtureHandler)
        thread = threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        connection = http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=3)
        def request(method,path,body=None,headers=None):
            connection.request(method,path,body,headers or {})
            response=connection.getresponse()
            return response.status,response.read()
        try:
            status,body=request('GET','/')
            self.assertEqual(status,200)
            self.assertIn(b'Object.defineProperty(window',body)
            self.assertLess(body.index(b'Object.defineProperty(window'),body.index(b'game-script-manifest'))
            api=self.config['api']
            payload=json.dumps({'action':'write','revision':0,'values':{self.key:'saved by HTTP'}})
            self.assertEqual(request('POST',api,payload,{'Content-Type':'application/json'})[0],403)
            headers={'Content-Type':'application/json','X-Whale-Save-Token':self.store.token}
            self.assertEqual(request('POST',api,payload,{**headers,'Origin':'https://example.com'})[0],403)
            self.assertEqual(request('POST',api,payload,headers)[0],200)
            self.assertEqual(self.store.read()['values'][self.key],'saved by HTTP')
            self.assertEqual(request('POST',api,payload,headers)[0],409)
            self.assertEqual(request('GET','/saves/storage.json')[0],404)
            self.assertEqual(request('GET','/',headers={'Host':'example.com'})[0],403)
        finally:
            connection.close()
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
