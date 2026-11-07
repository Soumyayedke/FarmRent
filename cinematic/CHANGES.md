# Changes from v1.2 to v1.3

## Files changed
| File | Change |
|---|---|
| `index.html` | new photo hero and closing section, `.png` slots with alt text and crop variables, nav-theme markers, hero preload |
| `css/style.css` | hero and closing composition, 16:9 machinery windows, per-photo crops, 900px stacking breakpoint, nav colours |
| `js/main.js` | lazy photo loader, one IntersectionObserver for nav colour, new hero timeline, closing cleanup, 900px breakpoint |
| `js/machinery-plan.js` | smaller parallax so the 16:9 photos stay uncropped |
| `assets/photos/*.png` | renamed from `*.png.png` (7 files, no duplicates) |
| `assets/photos/README.txt` | documents names, crops and size |
| `tests/browser-suite.js` | 45 to 62 checks: lazy loading, real photos, nav colour, hero/closing composition, crop geometry |
| `tests/gsap-standin.js` | reads real CSS opacity instead of assuming 1 |
| `README.md`, `CHANGES.md`, `TEST_REPORT.md`, `ANIMATION_NOTES.md` | updated |

## What changed
- **Hero:** the illustrated landscape, sun, hills, tractor and the "photo reveal" block are replaced by `hero-aerial.png` with the new headline, copy and two CTAs. Entrance: headline lines rise from masks, photo settles from 1.12 scale. Scroll: slow push-in, dim, text exits, then the photo dissolves into the ivory machinery section (nav flips to forest). Pin 90% of a screen on desktop, 70% on phones.
- **Machinery:** all three scenes use one identical 16:9 window on every screen size, so the combine (19 to 99.5% of the frame) and the sprayer boom (5 to 97%) are never cut. Per-photo `object-position`, trimmed parallax overscan. Stacks under the text at 900px and below (was 760).
- **Farmer / owner:** photos replace the illustration with positions that keep both faces and the tractor in frame; the illustration remains the fallback.
- **Closing:** `closing-landscape.png` with the same text placement and shading as the hero. Headline now "Make every machine count."; the illustrated hills and sun are removed.
- **Nav colour:** four ScrollTrigger toggles replaced by one IntersectionObserver driven by `data-nav` markers. It works with pins, the static layout and reduced motion.
- **Loading:** hero is preloaded; other photos load lazily; failed loads are silent.

## Bugs fixed during this pass
1. Filenames were `*.png.png`; now `*.png`, all references updated.
2. First machinery photo was permanently zoomed 1.08 (cropped the machine); removed.
3. Machinery window width was measured against its grid cell, not the cell minus its margin, so it spilled about 58px into the text column on desktop (found by the new suite, fixed).
4. Tablets (768 to 900px) got the side-by-side layout with a text column about 230px wide; they now stack.
5. The closing section's primary button was forest-green on a photograph (poor contrast); it is now gold with ivory-outlined secondary.
6. The test stand-in assumed opacity 1 for untouched elements, which produced wrong screenshots; it now reads computed styles.
