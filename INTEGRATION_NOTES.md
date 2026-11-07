# Integration notes

## Files changed
- `index.html`: replaced only the original marketing home-page section with an iframe for `cinematic/index.html`; added a same-origin navigation message bridge.
- `script.js`: toggles a body class when navigating between cinematic home and original app pages; resets the embedded home scroll position on return.
- `style.css`: added narrowly scoped iframe and home-state rules.
- `cinematic/index.html`: marked the List your equipment menu action and added a Log in menu action.
- `cinematic/js/main.js`: routes browse/list/login actions to the original app through same-origin `postMessage`.

## Safety boundaries
- Original root app pages and Supabase code are retained.
- Cinematic CSS and JS remain isolated in an iframe; no broad stylesheet merge was attempted.
- Supabase `.temp` metadata, backups and nested archive are excluded.
- No database schema, RLS policy, Edge Function or secret was changed.

## Validation performed
- JavaScript syntax checks with Node.js.
- Local image and CSS/JS reference checks.
- Structural check for original SPA pages and iframe navigation bridge.

## Not performed
- Live Supabase authentication/database tests.
- Browser-based GSAP/ScrollTrigger tests at desktop/mobile sizes.
- Real email delivery or payment tests.

These require the user's configured Supabase project and local browser.
