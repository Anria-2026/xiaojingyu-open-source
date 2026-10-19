/* Shared, deterministic movie timing; authoring data is never rewritten here. */
(function () {
  'use strict';
  if (window.LifeTimeline) return;
  const types = ['dialogue', 'memory', 'journey', 'split', 'ending', 'caption', 'effect', 'wall'];
  const tracks = ['scene', 'memory', 'journey', 'caption', 'fx'];
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = value => Math.max(0, Math.min(1, value));
  function wallPace(cue) {
    const value = number(cue.wallSpeed, 1);
    return Math.max(.25, Math.min(4, value > 4 ? value / 36 : value));
  }
  function wallProgress(cues, time) {
    const total = cues.reduce((sum, cue) => sum + cue.duration * wallPace(cue), 0);
    return total ? clamp(cues.reduce((sum, cue) => sum + Math.max(0, Math.min(cue.duration, time - cue.start)) * wallPace(cue), 0) / total) : 1;
  }
  function wallTimeAt(cues, progress) {
    let remaining = clamp(progress) * cues.reduce((sum, cue) => sum + cue.duration * wallPace(cue), 0);
    for (const cue of cues) {
      const pace = wallPace(cue), weight = cue.duration * pace;
      if (remaining <= weight) return cue.start + remaining / pace;
      remaining -= weight;
    }
    return cues.length ? cues[cues.length - 1].end : 0;
  }
  const cardsFor = (cue, config) => Array.isArray(cue.wallCards) ? cue.wallCards : Array.isArray(config.wallCards) ? config.wallCards : [];
  const milestone = card => card && (card.milestone === 'stage' ? 'stage_' + card.stage : card.milestone);
  function anchorGroup(cues, config) {
    if (cues.length < 2 || !cues.some(cue => cue.ageMilestone)) return;
    const cards = cardsFor(cues[0], config);
    if (cards.length < 2) return;
    // A deleted explicit anchor retires this automatic group. Keep all authored
    // boundaries, including their original times at differing wall speeds.
    if (cues.some(cue => cue.ageMilestone && !cards.some(card => milestone(card) === cue.ageMilestone))) return;
    const start = cues[0].start, end = cues[cues.length - 1].end, duration = end - start;
    const boundaries = cues.map((cue, index) => {
      if (!index) return 0;
      const card = cue.ageMilestone ? cards.findIndex(row => milestone(row) === cue.ageMilestone) : -1;
      // Unbound intermediate cues retain their authored progress within a valid group.
      return card >= 0 ? card / (cards.length - 1) : wallProgress(cues, cue.start);
    }).concat(1);
    if (boundaries.some((value, index) => index && value <= boundaries[index - 1])) return;
    // Progress is distance; wallSpeed is pace. Solve each segment's duration
    // together so differing paces still put the anchor card at the center.
    const weights = cues.map((cue, index) => (boundaries[index + 1] - boundaries[index]) / wallPace(cue));
    const total = weights.reduce((sum, value) => sum + value, 0);
    const durations = weights.map(weight => duration * weight / total);
    if (durations.some(value => !Number.isFinite(value) || value < .1)) return;
    let cursor = start;
    cues.forEach((cue, index) => {
      cue.start = cursor;
      cue.duration = index === cues.length - 1 ? end - cursor : durations[index];
      cue.end = cue.start + cue.duration;
      cursor = cue.end;
    });
  }
  function normalize(rawTimeline, finaleConfig = {}) {
    let cursor = 0;
    const result = (Array.isArray(rawTimeline) ? rawTimeline : []).map((cue, index) => ({cue, index}))
      .filter(({cue}) => cue && types.includes(cue.type)).map(({cue, index}) => {
        const duration = Math.max(.1, Math.min(600, number(cue.duration, 6)));
        const track = tracks.includes(cue.track) ? cue.track : cue.type === 'caption' ? 'caption' : cue.type === 'effect' ? 'fx' : 'scene';
        const start = cue.at !== '' && cue.at != null && Number.isFinite(Number(cue.at)) ? Math.max(0, number(cue.at)) : track === 'scene' ? cursor : 0;
        if (track === 'scene') cursor = Math.max(cursor, start + duration);
        return {...cue, id: String(cue.id || 'cue-' + index), track, start, end: start + duration, duration, index};
      }).sort((a, b) => a.start - b.start || a.index - b.index);
    const scenes = result.filter(cue => cue.track === 'scene');
    let group = [], key = null;
    const flush = () => {anchorGroup(group, finaleConfig); group = []; key = null;};
    for (const cue of scenes) {
      if (cue.type !== 'wall' || cue.walkMode === 'stop') {flush(); continue;}
      const cardKey = JSON.stringify(cardsFor(cue, finaleConfig));
      if (group.length && (cardKey !== key || Math.abs(group[group.length - 1].end - cue.start) > .001)) flush();
      key = cardKey; group.push(cue);
    }
    flush();
    return result.sort((a, b) => a.start - b.start || a.index - b.index);
  }
  function walkMotion(wallCues, stop, filmStart, time) {
    if (!stop || !wallCues.length) return {time: Math.max(0, time - filmStart), rate: 1, parked: false};
    const last = wallCues[wallCues.length - 1];
    const duration = Math.min(Math.max(.1, number(stop.slowMotion, 3)), last.duration);
    const start = stop.start - duration, u = clamp((time - start) / duration);
    const clock = time <= start ? time - filmStart : start - filmStart + duration * (u - u * u * u + .5 * u * u * u * u);
    return {time: Math.max(0, clock), rate: 1 - 3 * u * u + 2 * u * u * u, parked: time >= stop.start};
  }
  // Curtain time is separate from authored movie time and the soundtrack.
  // Reduced motion simplifies the visuals without shortening these holds.
  // 2026-10-16 用户要求：由对白切到星湖场景的黑幕过久（约 4s 才揭幕），
  // 将遮黑 / 全黑 / 揭幕三段各缩到 2s（入场覆盖原游戏仍保持 3s）。
  const prologueTiming = () => ({entry:3,fadeOut:2,hold:2,fadeIn:2});
  window.LifeTimeline = {normalize, wallPace, wallProgress, wallTimeAt, walkMotion, prologueTiming};
})();
