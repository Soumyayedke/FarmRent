# Test report (FarmRent v1.3)

## Read this first
**Real GSAP and ScrollTrigger were NOT run.** I tried to download GSAP three times in this build environment and every attempt failed (no network),
so no real GSAP code has executed against this project. All animation checks below ran with `tests/gsap-standin.js`, a small test-only stand-in for the
GSAP API that `js/main.js` uses. The real, unmodified `index.html`, `css/style.css`, `js/main.js` and `js/machinery-plan.js` and your seven real photographs
ran in headless Chromium 131; only the CDN script is swapped. The stand-in seeks timelines by progress (linear easing, no pin spacers, no real ScrollTrigger maths).
It verifies wiring, timing logic, state handling, layout and image geometry. It does **not** prove that real GSAP produces the same frames, that pinning has no
jumps, or that scrub feels smooth. Google Fonts were also unreachable, so typography was checked with fallback fonts.

The suite was validated earlier against a deliberately broken build (the v1.1 selector bug): it reported 9 failures. It also caught a real layout bug in this pass
(machinery window spilling 58px into the text column), which is fixed.

## Results (62 automated checks: 62 passed, 0 failed)
| Area | Result | Detail |
|---|---|---|
| Photographs load (exact `.png` names, no `.jpg` / `.png.png`) | PASSED | 7 of 7, 0 broken images, every image has meaningful alt text |
| Lazy loading | PASSED | hero requested at load; farmer, owner, closing wait for their sections |
| Missing / blocked photographs (1440 and 390 wide) | PASSED | 0 broken images, 5 dark placeholders + 2 illustration fallbacks, headline intact, no console errors |
| Network | PASSED | every local asset 200 with photos present; photo failures silent when blocked |
| Crops: every machine and person fully visible | PASSED | 100% of each subject inside its window at 1440x900, 1366x768, 768x1024, 390x844, 360x640; sun visible on phone and tablet |
| Hero + closing composition at 5 viewports | PASSED | full-height hero, text clear of nav, scroll cue and footer, no clipping, buttons 44px or taller, no overflow |
| Machinery: three independent scenes | PASSED (stand-in) | each text and photo tween touches only its own scene |
| Machinery: one text block at a time, forward + reverse (800 steps) | PASSED (stand-in) | |
| Machinery: fast random jumps and 5 repeated visits | PASSED (stand-in) | states identical to forward scrolling |
| Machinery: slow scrolling | PASSED (stand-in) | 1/400 steps |
| Machinery geometry at 5 viewports | PASSED | no text/photo overlap, no clipped titles, nothing off-screen |
| 01/03 counter | PASSED (stand-in) | matches the plan at every step |
| Resize / breakpoint re-runs, orientation refresh | PASSED (stand-in) | one machinery trigger after desktop>phone>desktop>tablet; refresh fires; no duplicate listeners |
| Nav colour over all 8 marked sections | PASSED | static and motion layouts; ivory on dark, forest on light |
| Reduced motion (emulated) and GSAP-failed static layout | PASSED | no `.motion` class, all copy visible, road nodes placed, no duplicate ids |
| Menu: open, focus, inert page, Tab / Shift+Tab trap, Escape, link navigation | PASSED | motion and reduced-motion |
| In-page links and CTAs resolve | PASSED | |
| Layout audit at 5 viewports, motion and static | PASSED | no horizontal overflow, no off-screen or clipped text |
| Console errors | PASSED | none in any run |

## Not tested
| Item | Status |
|---|---|
| Real GSAP/ScrollTrigger animation (hero entrance, push-in, hero-to-machinery fade, wipes, text transitions, reveals, closing) | **NOT TESTED** |
| Real pin behaviour, pin-spacer maths, scrub smoothness, "no sudden jumps" | **NOT TESTED** |
| Real ScrollTrigger refresh on resize and orientation | **NOT TESTED** (only the project's calls to it were checked) |
| Menu opening animation as rendered by GSAP | **NOT TESTED** (behaviour and focus were tested) |
| Safari, Firefox, real phones, touch scrolling, screen readers | **NOT TESTED** |
| Typography with the real Fraunces / Hanken Grotesk fonts | **NOT TESTED** |
| Page weight and load time (17 MB of PNGs) | **NOT TESTED** (only the lazy order was) |
| Visual review | PARTIAL: screenshots reviewed at 1440x900, 768x1024, 390x844, 360x640 |

## Five-minute manual check (needed once)
1. Serve the folder, open in Chrome. Watch the hero entrance, then scroll: slow push-in, dim, text leaves, fade into ivory.
2. Scroll slowly then quickly through Tractor, Harvester, Sprayer; then reverse. Expect one scene's text at a time and no stuck elements.
3. Resize across 900px and rotate a phone; scroll position should not jump.
4. In the console run `ScrollTrigger.getAll().length`, resize across 900px twice, run it again: the number should return to the same value.
5. Tell me anything that looks off and I will fix it in one pass.

## Re-running
`npm i puppeteer` then `node tests/browser-suite.js` (own server; `CHROME=/path/to/chrome` if needed; `ROOT=/path` to test another copy).
