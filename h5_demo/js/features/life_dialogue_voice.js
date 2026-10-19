/* Shared cue voice lifecycle. Time after ended follows the active preview/game clock. */
(function () {
  'use strict';
  if (window.LifeDialogueVoice) return;
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  function create(options = {}) {
    const doc = options.document || document, host = options.host || doc.body;
    let audio = null, token = 0, source = '', state = 'none', suspended = false;
    let finishedFor = 0, stalledFor = 0, lastTime = 0, desiredTime = 0, attempt = 0, endedAt = 0, firstEndedTick = false;
    const clock = () => doc.defaultView?.performance?.now?.() || 0;
    const notify = () => {if (options.onState) options.onState(status());};
    function status() {return {state, src: source, finishedFor, time: audio ? Math.max(0, finite(audio.currentTime)) : desiredTime, duration: audio ? Math.max(0, finite(audio.duration)) : 0};}
    function release() {
      token++;attempt++;
      if (!audio) return;
      const old = audio;audio = null;
      try {old.pause();old.removeAttribute('src');old.load();} catch (_) {}
      old.remove();
    }
    function fail(next) {
      if (state === 'ended' || state === 'none') return;
      state = next;finishedFor = 0;attempt++;
      try {audio?.pause();} catch (_) {}
      notify();
    }
    function play() {
      if (!audio || suspended || ['none', 'ended', 'failed', 'blocked'].includes(state)) return;
      const own = audio, serial = token, request = ++attempt;
      try {
        const promise = own.play();
        if (promise && promise.catch) promise.catch(error => {
          if (audio !== own || token !== serial || request !== attempt || suspended || state === 'ended') return;
          fail(error && error.name === 'NotAllowedError' ? 'blocked' : 'failed');
        });
      } catch (error) {if (audio === own) fail(error && error.name === 'NotAllowedError' ? 'blocked' : 'failed');}
    }
    function start(src, settings = {}) {
      release();source = String(src || '');state = source ? 'loading' : 'none';
      finishedFor = 0;stalledFor = 0;firstEndedTick = false;desiredTime = Math.max(0, finite(settings.time));lastTime = desiredTime;
      if (!source) {notify();return;}
      if (settings.ended === true) {state = 'ended';finishedFor = Math.max(0, finite(settings.finishedFor));notify();return;}
      const own = audio = doc.createElement('audio'), serial = token;
      own.dataset.lifeAudio = 'voice';own.src = source;own.preload = 'auto';own.loop = false;
      own.volume = Math.max(0, Math.min(1, finite(settings.volume, 1)));host.appendChild(own);
      const active = () => audio === own && serial === token;
      own.addEventListener('loadedmetadata', () => {
        if (!active()) return;
        try {own.currentTime = Number.isFinite(own.duration) ? Math.min(desiredTime, Math.max(0, own.duration - .01)) : desiredTime;} catch (_) {}
        lastTime = finite(own.currentTime);stalledFor = 0;
      });
      own.addEventListener('playing', () => {
        if (!active() || ['ended', 'failed', 'blocked'].includes(state)) return;
        if (suspended) {own.pause();return;}
        state = 'playing';stalledFor = 0;notify();
      });
      own.addEventListener('ended', () => {
        if (!active() || ['none', 'failed', 'blocked'].includes(state)) return;
        state = 'ended';finishedFor = 0;stalledFor = 0;endedAt = clock();firstEndedTick = true;notify();
      });
      own.addEventListener('error', () => {if (active()) fail('failed');});
      try {own.load();} catch (_) {fail('failed');}
      notify();play();
    }
    function sync(held) {
      const changed = suspended !== !!held;suspended = !!held;
      if (!changed) return;
      if (suspended) {attempt++;try {audio?.pause();} catch (_) {}}
      else play();
    }
    function tick(seconds, timestamp) {
      if (suspended) return;
      const dt = Math.max(0, Math.min(.25, finite(seconds)));
      if (state === 'ended') {
        const after = Math.max(0, (finite(timestamp, endedAt) - endedAt) / 1000);
        // Do not count the portion of the first RAF interval before ended.
        // A caller without a RAF timestamp still owns its supplied dt.
        finishedFor += firstEndedTick && Number.isFinite(timestamp) ? Math.min(dt, after) : dt;firstEndedTick = false;return;
      }
      if (!audio || !['loading', 'playing'].includes(state)) return;
      const time = finite(audio.currentTime);
      if (time > lastTime + .001) stalledFor = 0;else stalledFor += dt;
      lastTime = time;
      // A request with no error event, permanently stalled connection, or a
      // missing playing/ended event must still leave the text path usable.
      if (stalledFor >= 15) fail('failed');
    }
    function retry() {
      if (!source) return;
      const src = source, volume = audio ? audio.volume : 1;
      start(src, {volume});
    }
    function destroy() {release();source = '';state = 'none';finishedFor = 0;notify();}
    return {start, sync, retry, tick, status, readyAfter: (seconds = 1) => state === 'ended' && finishedFor + 1e-9 >= Math.max(0, finite(seconds, 1)), destroy};
  }
  window.LifeDialogueVoice = {create};
})();
