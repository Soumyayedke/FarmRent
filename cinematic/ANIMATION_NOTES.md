# Animation notes (v1.1)

## Why the machinery section overlapped (found by reading v1)
1. Text and art shared one space. `.txt` was capped at 420px but `h3` grew to 160px, so names clipped inside the `.rise` mask. The art (66vw, right-anchored) slid under the text below about 1300px wide, and was 120vw on phones.
2. Nothing animated the previous scene's text out, and the next scene's description and tag were visible as soon as the wipe edge passed them, so two scenes' text showed at once mid-wipe.
3. The incoming name started rising 0.3s into a 1.0s wipe, before its panel was revealed.
4. The rising hill of the next chapter (18vh tall) drew over the category strip, which had only 5vh of padding.
5. Pins had no `invalidateOnRefresh`, so font or resize changes left stale positions.
6. Not an overlap, but found on the way: nav colour was forest-on-dark on the dark stage, and the `.hillup` SVG caused 960px of hidden horizontal overflow on phones (also in v1).

## What changed
- **Layout:** the stage is a two-cell grid. Text lives in one cell, photos in the other, so overlap is structurally impossible. Phones stack photo over text. Names scale with their column (container query units), so they cannot clip. Static and reduced-motion layout reuses the same markup (`display:contents` is only applied in motion mode).
- **Timing (js/machinery-plan.js):** per transition, text leaves (0.35s), then the photo wipes in (0.8s, starting 0.25s into the exit), then the next text arrives only after the wipe ends (0.55s). Gap between one text ending and the next starting: 0.7s. Hold per scene about 1s. Pin: 220% of screen height on desktop (was 260%), 180% on phones (was 200%).
- **Photos:** clip-path wipe from the right on `.shot`, incoming photo settles from scale 1.3, outgoing photo drifts 10% left, continuous parallax on the active photo. Placeholder: dark forest green with field-row texture and grain.
- **Determinism:** every start state is set explicitly and every tween uses `fromTo` with `immediateRender:false`, so scrubbing backwards or jumping to any scroll position reproduces the same state. Text uses `autoAlpha`, so hidden scenes are also `visibility:hidden`.
- **Strip:** its own wrapper with 24vh bottom padding, layered below the next chapter's hill.
- **Refresh:** `invalidateOnRefresh` on all pins, `ignoreMobileResize`, refresh after fonts and load, and after orientation change. `gsap.matchMedia` rebuilds on breakpoint or reduced-motion changes.
- **Nav:** switches to ivory over the hero photo and the machinery stage, back to forest on ivory sections.

## Unchanged
Hero layers, tractor drive and sun iris, dark problem chapter, journeys, Discover > Request > Get to Work road, closing landscape, menu.

## v1.2 corrections (stabilisation pass)
- The scene targets are now resolved with a context-aware helper, so tractor, harvester and sprayer each own their text, photo, title and parallax target. A startup guard verifies this.
- Anything that scrubs a property the intro also animates (hills, sun, hero copy and cue) uses explicit start values and `immediateRender:false`, so the first scroll cannot jump.
- Problem-line exits and the dust puffs also use explicit start values; the dust no longer repeats.
- Nav colour follows the pins themselves (hero, machinery, process), so it can never end early.
- The intro plays once per page load; breakpoint changes rebuild the scroll story without replaying it.
- Refresh handlers (load, fonts, orientation) are registered once.

## v1.3 additions
- **Hero timeline:** the entrance (once per page load) touches `#heroMedia .inner`, the headline spans, `.lede` and `.hero-cta`. The scroll timeline touches only `#heroMedia`, `#heroDim`, `#heroText`, `#cue` and `#heroFade`, with explicit start values and `immediateRender:false`, so the two never conflict.
- **Hero to machinery:** the last 30% of the hero pin fades an ivory layer over the photo, so the pin ends on the colour of the next section. Below 82% progress the nav is ivory, above it forest.
- **Nav colour:** one IntersectionObserver over `[data-nav]` sections (top 8% of the viewport) replaces four ScrollTrigger toggles; the later section in document order wins at a boundary.
- **Machinery:** parallax amplitude 2.2% (was 4%) with 2.5% overscan, so the 16:9 photos are cropped by at most a sliver top and bottom.
- **Lazy loading:** each below-the-fold slot is requested when its section comes within 60% of a screen of the viewport.
