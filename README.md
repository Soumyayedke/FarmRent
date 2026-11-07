# FarmRent — Integrated Application

This folder combines the original working FarmRent application with the v1.3 cinematic landing page.

## Architecture
- The original root `index.html`, `script.js`, and `style.css` remain the application shell and retain the existing Supabase-backed SPA pages.
- The cinematic redesign lives in `cinematic/` and is loaded inside an isolated iframe on the home page. This prevents its global CSS and GSAP styles from colliding with the original listing, booking, dashboard, profile and admin pages.
- Same-origin navigation bridge:
  - **Explore Equipment** → original equipment listing page.
  - **List Your Equipment** → original owner-auth/listing flow (`handleListEquipment`).
  - **Log in** in the cinematic menu → original login modal.
- Supabase Edge Function and migrations are included under `supabase/`.

## Run locally
1. Open this folder in VS Code.
2. Open Terminal in this folder.
3. Run `python -m http.server 8000`.
4. Open `http://localhost:8000`.

Use a local HTTP server rather than `file://`. GSAP/ScrollTrigger and fonts load from CDNs, so internet access is needed for the full cinematic experience. A static fallback is present if GSAP does not load.

## Supabase safety
The original `script.js` retains the project's existing Supabase URL and public anon key configuration. Never publish service-role keys or secrets. The local Supabase `.temp` metadata was intentionally excluded. No database schema, RLS policy, Edge Function or secret was changed by this integration.

## Important behaviour
- The cinematic homepage is a presentation layer; original listing, booking, authentication, owner, farmer, profile, receipt and admin pages remain in the original app shell.
- Demo payments remain simulations; no real money is transferred.
- Equipment imagery is illustrative, not a live listing.
- This package has passed static syntax and asset checks only. It has not yet been browser-tested against your live Supabase project.

## Manual verification checklist
- [ ] Home page opens and all seven photographs load.
- [ ] Scroll through hero, machinery, problem, journeys, process and closing sections.
- [ ] Explore Equipment opens original listing page.
- [ ] List Your Equipment opens existing owner login/owner flow.
- [ ] Log in opens original login modal.
- [ ] Farmer and owner authentication still work.
- [ ] Equipment listing and booking request creation still work.
- [ ] Owner approve/reject and dashboard still work.
- [ ] Demo payment and receipt still work and remain clearly labelled demo.
- [ ] Admin page remains protected and loads for an authorised admin.
- [ ] Return Home from app pages; cinematic home returns to the top.
- [ ] Test desktop and mobile widths (390px and 360px).
- [ ] Check browser console and Network tab for errors.
