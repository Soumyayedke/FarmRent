/* Machinery showcase timing plan (pure data, no DOM, no GSAP).
   js/main.js turns these specs into GSAP tweens; the test suite evaluates the same specs.
   Time units are timeline seconds; pin length is total * scroll-per-unit.

   Per transition k -> k+1 (T = k*SPACING + HOLD):
     1. text k leaves        [T,          T+EXIT]
     2. photo k+1 wipes in   [T+WIPE_AT,  T+WIPE_AT+WIPE]
     3. text k+1 arrives     [T+WIPE_AT+WIPE, +ENTER]   <- only after the wipe has finished
   Guarantee: text k is gone (EXIT) before text k+1 starts, so two scenes' text never co-exist. */
(function (root) {
  var C = { SPACING: 2.0, HOLD: 1.0, EXIT: .35, WIPE_AT: .25, WIPE: .8, ENTER: .55, TAIL: .4 };

  function plan(n) {
    var specs = [], marks = [], k;
    var total = n > 1 ? (n - 2) * C.SPACING + C.HOLD + C.WIPE_AT + C.WIPE + C.ENTER + C.TAIL : 1;
    function add(el, i, t, d, from, to, ease) { specs.push({ el: el, k: i, t: t, d: d, from: from, to: to, ease: ease || "none" }); }
    for (k = 0; k < n; k++) {
      // continuous slow parallax on the photo for as long as it is the active one
      var life0 = k === 0 ? 0 : (k - 1) * C.SPACING + C.HOLD + C.WIPE_AT;
      var life1 = k === n - 1 ? total : k * C.SPACING + C.HOLD + C.WIPE_AT + C.WIPE; // last scene ends exactly at total
      add("innerY", k, life0, life1 - life0, { yPercent: 2.2 }, { yPercent: -2.2 });
    }
    for (k = 0; k < n - 1; k++) {
      var T = k * C.SPACING + C.HOLD, w0 = T + C.WIPE_AT, w1 = w0 + C.WIPE;
      add("text", k, T, C.EXIT, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -30 }, "power2.in");
      add("name", k, T, C.EXIT, { yPercent: 0 }, { yPercent: -115 }, "power2.in");
      add("shot", k + 1, w0, C.WIPE, { clipL: 100 }, { clipL: 0 }, "power2.inOut");
      add("innerX", k, w0, C.WIPE, { xPercent: 0 }, { xPercent: -10 }, "power2.inOut");
      add("innerS", k + 1, w0, C.WIPE + .4, { scale: 1.3 }, { scale: 1 }, "power2.out");
      add("text", k + 1, w1, C.ENTER, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0 }, "power3.out");
      add("name", k + 1, w1, C.ENTER + .1, { yPercent: 115 }, { yPercent: 0 }, "power3.out");
      marks.push(w0 + C.WIPE / 2); // scene k+1 becomes "current" here (for the 01/03 counter)
    }
    return { total: total, specs: specs, marks: marks, C: C };
  }

  // Evaluate every spec at time t -> { "text:0": {autoAlpha,y}, ... } (linear, ease ignored: used for visibility/geometry tests)
  function stateAt(p, t) {
    var st = {}, groups = {};
    p.specs.forEach(function (s) { (groups[s.el + ":" + s.k] = groups[s.el + ":" + s.k] || []).push(s); });
    Object.keys(groups).forEach(function (key) {
      var list = groups[key].sort(function (a, b) { return a.t - b.t; }), o = {};
      Object.keys(list[0].from).forEach(function (prop) { o[prop] = list[0].from[prop]; });
      list.forEach(function (s) {
        Object.keys(s.to).forEach(function (prop) {
          var r = s.d ? Math.min(1, Math.max(0, (t - s.t) / s.d)) : (t >= s.t ? 1 : 0);
          if (t >= s.t) o[prop] = s.from[prop] + (s.to[prop] - s.from[prop]) * r;
        });
      });
      st[key] = o;
    });
    return st;
  }
  var api = { plan: plan, stateAt: stateAt, C: C };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MachPlan = api;
})(typeof window !== "undefined" ? window : this);
