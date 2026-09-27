// Shared math + collision helpers. Everything hangs off one global so we can
// use plain <script> tags instead of ES modules (keeps file:// working).
window.GAME = window.GAME || {};

(function () {
  'use strict';

  var TAU = Math.PI * 2;

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Frame-rate independent approach-a-target smoothing.
  function damp(current, target, rate, dt) {
    return lerp(current, target, 1 - Math.exp(-rate * dt));
  }

  function dist2(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  }

  function dist(ax, ay, bx, by) {
    return Math.sqrt(dist2(ax, ay, bx, by));
  }

  function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  }

  // Both args are anything with x, y and r.
  function circleHit(a, b) {
    var rr = a.r + b.r;
    return dist2(a.x, a.y, b.x, b.y) <= rr * rr;
  }

  function randRange(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function randInt(lo, hi) {
    return Math.floor(randRange(lo, hi + 1));
  }

  function choose(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Tiny deterministic PRNG so a level's decorative rubble is stable per level.
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Removes entries where pred() is true, in place, without allocating.
  function pruneList(list, pred) {
    var w = 0;
    for (var i = 0; i < list.length; i++) {
      if (!pred(list[i])) list[w++] = list[i];
    }
    list.length = w;
  }

  GAME.Utils = {
    TAU: TAU,
    clamp: clamp,
    lerp: lerp,
    damp: damp,
    dist: dist,
    dist2: dist2,
    angleTo: angleTo,
    circleHit: circleHit,
    randRange: randRange,
    randInt: randInt,
    choose: choose,
    mulberry32: mulberry32,
    pruneList: pruneList
  };
})();
