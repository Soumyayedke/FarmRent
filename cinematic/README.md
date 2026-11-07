# FarmRent Illustrated v1.3: photography integration

Built on v1.2. Same typography, palette, section order and storytelling; the illustrated hero and closing landscape are replaced
by your seven photographs, and the machinery, farmer and owner sections now use them.

## Run
No build step. Photographs are loaded with JavaScript, so open it through a local server, not by double-clicking `index.html`:

    python3 -m http.server 8000      # inside this folder, then open http://localhost:8000

(VS Code: the "Live Server" extension works too.) GSAP 3.12.5 + ScrollTrigger load from cdnjs and the fonts (Fraunces, Hanken Grotesk)
from Google Fonts, so internet access is needed for the full experience. If GSAP fails to load, the full static layout is shown.

## Files
```
index.html               markup and the seven photo slots (alt text and crop positions live here)
css/style.css            layout; html.motion enables the pinned stages
js/main.js               lazy photo loader, nav colour, menu, GSAP/ScrollTrigger story
js/machinery-plan.js     machinery timing plan (shared by the animation and the tests)
assets/photos/           the seven .png photographs (+ README.txt)
assets/svg/field-rows.svg  placeholder texture
tests/                   browser-suite.js, gsap-standin.js, machinery-plan.test.js
CHANGES.md  TEST_REPORT.md  ANIMATION_NOTES.md
```

## Photographs
Exact names (all `.png`): `hero-aerial`, `tractor-closeup`, `harvester`, `sprayer`, `farmer`, `equipment-owner`, `closing-landscape`.
Replace a file with the same name to swap it. Crop positions are per-photo CSS variables (`--pos-d` desktop, `--pos-m` for 900px and below)
in `index.html`; see `assets/photos/README.txt`. The hero loads immediately and is preloaded; the other six load lazily as their sections approach.

## CTA links
In `js/main.js` fill `FARMRENT_LINKS = { browse: "", list: "" }` with your app URLs. Empty means the buttons scroll to the explaining sections.

## Tests
`npm i puppeteer`, then `node tests/browser-suite.js` (starts its own server; set `CHROME=/path/to/chrome` if needed). 62 checks.
**Real GSAP was never run** (see TEST_REPORT.md). Read that file before relying on the animation.

## Remaining limitations
- Real GSAP/ScrollTrigger scroll behaviour is untested: the build environment had no network to download GSAP.
- Typography was checked with fallback fonts only (Google Fonts were unreachable). Fraunces is slightly wider; headline sizes have headroom but check once.
- The seven PNGs total 17 MB. Compress them for production (same filenames).
- Safari, Firefox, real phones, touch scrolling and screen readers are untested.
- Crop positions were computed from subject locations I measured by eye on these photographs; replacing a photo may need new `--pos-d` / `--pos-m` values.
