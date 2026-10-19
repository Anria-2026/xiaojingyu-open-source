(function (w, d) {
'use strict';
const script=d.currentScript,url=new URL(script?script.src:'js/arcade_loader.js',d.baseURI);
const bundled=/\/legacy\/game\.es5\.js$/.test(url.pathname),compat=bundled||w.BootCompat&&w.BootCompat.mode==='compat';
const base=new URL(bundled?'../':'.',url),params=url.searchParams;
if (!params.get('v')) params.set('v', '20261007n');
const query = '?' + params.toString(), loads = {};
let active = null;
const config = () => ((w.GameUI && w.GameUI.core && w.GameUI.core.cfg) || w.GameCfg || {}).ARCADE || {};
const game = kind => typeof kind === 'string' && Object.prototype.hasOwnProperty.call(config().GAMES || {}, kind) && config().GAMES[kind];
function load(path, css) {
if (loads[path]) return loads[path];
loads[path] = new Promise((resolve, reject) => {
const target=compat?(css?'legacy/styles.arcade.css':'legacy/'+path.replace(/^arcade\//,'arcade.').replace(/\.js$/,'.es5.js')):path;
const el = d.createElement(css ? 'link' : 'script'), url = new URL(target, base); url.search = query;
if (css) { el.rel = 'stylesheet'; el.href = url; } else { el.src = url; el.async = true; }
el.onload = () => { el.onload = el.onerror = null; resolve(); };
el.onerror = () => { el.remove(); delete loads[path]; reject(new Error('小游戏加载失败，请重试。')); };
d.head.appendChild(el);
});
return loads[path];
}
function lockedMessage(kind) {
if (kind === 'runner') return (config().LOCKED || {}).runner || '节奏快打 · 制作中，敬请期待';
const row = game(kind), core = w.GameUI && w.GameUI.core;
if (kind === 'rice' && (!core || typeof core.arcadeAvailable !== 'function' || !core.arcadeAvailable(kind))) return '拯救大白饭在 V5 解锁。';
if (row && (row.enabled === false || core && w.FeatureUnlock && !w.FeatureUnlock.meets(core, row.unlock))) return '这款小游戏尚未解锁。';
return (config().LOCKED || {})[kind] || '';
}
function notify(message) { if (w.GameUI && typeof w.GameUI.toast === 'function') w.GameUI.toast(message); }
const loadModule = kind => lockedMessage(kind) ? Promise.reject(new Error(lockedMessage(kind))) : game(kind) ? load(game(kind).module) : Promise.reject(new Error('未知小游戏'));
w.MiniArcade = {
_load: loadModule, lockedMessage, notify,
open(kind, opts) {
if (config().ENABLED === false) return Promise.resolve({ kind, score: 0, grade: 'C', aborted: true, reason: 'disabled' });
const message = lockedMessage(kind);
if (message) { notify(message); return Promise.resolve({ kind, score: 0, grade: 'C', aborted: true, locked: true }); }
if (kind !== 'menu' && !game(kind)) return Promise.reject(new Error('未知小游戏'));
if (active) return active;
active = Promise.all([load('../arcade.css', true), load('arcade/core.js')])
.then(() => kind === 'menu' ? null : loadModule(kind))
.then(() => opts && opts.isCurrent && !opts.isCurrent() ? { kind, score: 0, grade: 'C', aborted: true, reason: 'stale-session' } : w.ArcadeCore.open(kind, opts || {})).finally(() => { active = null; });
return active;
}
};
})(window, document);
