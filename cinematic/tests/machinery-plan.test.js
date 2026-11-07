// node tests/machinery-plan.test.js : checks the machinery timing plan (no browser, no GSAP needed)
const M = require("../js/machinery-plan.js"); const assert = require("assert");
for (const n of [2, 3, 4, 5]) {
  const p = M.plan(n); let worst = 0;
  for (let t = 0; t <= p.total + .5; t += .01) {
    const s = M.stateAt(p, t); let vis = 0;
    for (let k = 0; k < n; k++) if (s["text:" + k] && s["text:" + k].autoAlpha > .02) vis++;
    worst = Math.max(worst, vis);
  }
  assert(worst <= 1, `n=${n}: ${worst} text blocks visible at once`);
  for (let k = 0; k < n - 1; k++) {
    const out = p.specs.find(s => s.el === "text" && s.k === k && s.to.autoAlpha === 0);
    const inn = p.specs.find(s => s.el === "text" && s.k === k + 1 && s.to.autoAlpha === 1);
    const wipe = p.specs.find(s => s.el === "shot" && s.k === k + 1);
    assert(out.t + out.d <= inn.t, "next text starts before previous text has left");
    assert(wipe.t + wipe.d <= inn.t, "next text starts before its photo wipe finished");
  }
  console.log(`n=${n} ok, total ${p.total.toFixed(2)}s, max visible text blocks ${worst}`);
}
