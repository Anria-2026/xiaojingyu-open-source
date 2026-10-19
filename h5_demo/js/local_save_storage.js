(function (config) {
  "use strict";
  // Injected exclusively by dev_server.py, before any game scripts execute.
  var native = null, state = config, failed = false, warned = false, preferences = Object.create(null);
  try { native = window.localStorage; } catch (_) {}
  function managed(key) {
    return config.keys.indexOf(key) >= 0 || config.keyPrefixes.some(function (prefix) { return key.indexOf(prefix) === 0; });
  }
  function fail(error) {
    failed = true;
    if (!warned) {
      warned = true;
      window.alert(config.messages.error + '\n' + String(error.message || error));
    }
    throw error;
  }
  function commit(action, values) {
    if (failed || config.error) return fail(new Error(config.error || config.messages.reload));
    try {
      // The existing save API is synchronous. Return success only after the
      // local server has atomically replaced the file, never after queueing.
      var xhr = new XMLHttpRequest();
      xhr.open('POST', config.api, false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-Whale-Save-Token', config.token);
      xhr.send(JSON.stringify({action:action, revision:state.revision, values:values || {}}));
      var result = JSON.parse(xhr.responseText || '{}');
      if (xhr.status !== 200 || !result.ok) throw new Error(result.error || config.messages.writeFailed);
      state = result.storage;
    } catch (error) { return fail(error); }
  }
  function allKeys() {
    var keys = Object.keys(state.values).concat(Object.keys(preferences));
    if (native) for (var i=0; i<native.length; i++) {
      var key = native.key(i);
      if (key != null && !managed(key)) keys.push(key);
    }
    return keys;
  }
  var storage = {
    getItem:function (key) {
      key = String(key);
      if (!managed(key)) return native ? native.getItem(key) : (Object.prototype.hasOwnProperty.call(preferences,key) ? preferences[key] : null);
      if (failed || config.error) return fail(new Error(config.error || config.messages.unavailable));
      return Object.prototype.hasOwnProperty.call(state.values,key) ? state.values[key] : null;
    },
    setItem:function (key,value) {
      key=String(key); value=String(value);
      if (!managed(key)) { if (native) native.setItem(key,value); else preferences[key]=value; return; }
      var values={}; Object.defineProperty(values,key,{value:value,enumerable:true}); commit('write',values);
    },
    removeItem:function (key) {
      key=String(key);
      if (!managed(key)) { if (native) native.removeItem(key); else delete preferences[key]; return; }
      var values={}; Object.defineProperty(values,key,{value:null,enumerable:true}); commit('write',values);
    },
    clear:function () { commit('clear'); if (native) native.clear(); preferences=Object.create(null); },
    key:function (index) { return allKeys()[index] || null; }
  };
  Object.defineProperty(storage,'length',{get:function () { return allKeys().length; }});
  Object.defineProperty(window,'localStorage',{value:storage,configurable:true});
  // No replay from old browser keys after a slot was deleted in this project.
  if (!config.error && !state.migrated) {
    var imported={};
    try {
      if (native) for (var i=0; i<native.length; i++) {
        var key=native.key(i);
        if (key && managed(key)) Object.defineProperty(imported,key,{value:native.getItem(key),enumerable:true});
      }
      commit('migrate',imported);
    } catch (_) { /* fail() has already displayed a persistence error. */ }
  }
})
