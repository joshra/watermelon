Original prompt: 單機靜態網頁版的西瓜遊戲

# Progress

## Current Status

- Product specification exists in `SPEC.md`.
- Agent handoff guide exists in `AGENTS.md`.
- AI asset-generation guide exists in `docs/ASSET_GENERATION.md`.
- Static playable game files now exist: `index.html`, `styles.css`, `game.js`, local `vendor/matter.min.js`, and 11 AI fruit PNGs.
- PWA support has been added with `manifest.webmanifest`, `sw.js`, and local icons under `assets/icons/`.
- Toggleable Web Audio sound effects have been added for drop, merge, pause/resume, game over, and restart.
- The game screen has been visually refreshed with a desktop side panel, richer mobile HUD layout, and deeper canvas styling for the board, shadows, and merge feedback.
- Mobile PWA automatic power-saving has been added: the game loop now stops when idle/static, pauses work while hidden, uses Matter.js sleeping, and caches repeated canvas drawing work.

## User Decisions

- Build a full playable version, not only a minimal prototype.
- Support both desktop and mobile.
- Use exactly 11 fruit levels.
- Fruit assets must be directly AI-generated.
- The fruit set must have one consistent overall style.
- Documentation and agent guidance should come before system implementation.
- The game must support PWA installation and offline replay after first load.
- Sound effects should stay local and optional; do not introduce remote audio files or runtime dependencies.

## Skills To Use

- Use `develop-web-game` for the playable game implementation and browser verification loop.
- Use `imagegen` for fruit sprites and any raster visual assets.
- Use Playwright/browser tooling to validate screenshots, controls, console errors, and test hooks.

## Next TODOs

- Optionally force a high-stack game-over scenario on a real mobile browser/PWA to visually confirm the final overlay after long play.
- Optionally test install prompts in the target deployment browser, because install UI differs by browser and OS.

## Test Results

- 2026-05-22: Confirmed `manifest.webmanifest` and `sw.js` return HTTP 200 from a localhost static server.
- 2026-05-22: Confirmed PWA icons exist with expected sizes: 192x192, 512x512, 512x512 maskable, and 180x180 Apple touch icon.
- 2026-05-22: Confirmed browser service worker registration is controlled, cache key `suika-game-pwa-v1` exists, and offline reload returns the playable game in `ready` state with no console errors.
- 2026-05-22: Ran the `develop-web-game` Playwright client against localhost. The game entered `playing`, accepted input, reported two fruits through `render_game_to_text()`, and had no console errors.
- 2026-05-22: Captured desktop and mobile screenshots; layout remained readable without visible overlap.
- 2026-05-24: Added synthesized sound effects and a topbar sound toggle.
- 2026-05-24: `node --check game.js` passed after the sound changes.
- 2026-05-24: Browser verification on localhost confirmed the sound toggle switches `soundEnabled` off/on, persists the preference, and still allows starting gameplay with no console errors.
- 2026-05-24: Desktop and 390x740 mobile screenshots showed the sound button and HUD fit without text overlap or vertical clipping.
- 2026-05-24: Ran the `develop-web-game` Playwright client against localhost after the final CSS/cache update; the game remained in `playing`, reported `soundEnabled: true`, had four fruits after the input burst, and produced no error artifacts.
- 2026-05-24: Confirmed the localhost PWA controller and cache key use `suika-game-pwa-v3`.
- 2026-05-24: User reported mobile still had no sound, likely due to installed PWA cache. Added versioned service worker registration, automatic reload on controller change, `SKIP_WAITING` message handling, and network-first cache-reload fetches for `index.html`, `styles.css`, `game.js`, `manifest.webmanifest`, and `sw.js`.
- 2026-05-24: Verified on localhost that the active Service Worker registers as `sw.js?v=suika-game-pwa-v4`, the cache key is `suika-game-pwa-v4`, the worker script contains `cache: "reload"`, network-first core fetch handling, and `SKIP_WAITING`; `render_game_to_text()` still reports `soundEnabled: true` with no console errors.
- 2026-05-24: Refreshed the game presentation with a left-side desktop info panel, a compact two-column mobile HUD, glass-like cards, and a richer in-canvas board treatment with ambient gradients, fruit shadows, and particle-based merge feedback.
- 2026-05-24: Verified the refreshed UI on localhost with desktop and 390x844 mobile screenshots. The desktop layout fit within one view, and the mobile layout kept the HUD plus full playable container visible without text overlap.
- 2026-05-24: Ran the `develop-web-game` Playwright client against localhost after the visual refresh. The game entered `playing`, stayed responsive through four input bursts, reported `soundEnabled: true`, and produced screenshot/state artifacts under the local test output with no new regressions observed.
- 2026-05-26: User reported the mobile layout still felt broken because the game area was clipped and then over-shrunk. Reworked the mobile breakpoint again so it stays non-scrollable, removes the decorative brand header on phones, keeps only the compact gameplay HUD, and lets the play area consume the remaining viewport height.
- 2026-05-26: Verified on localhost at 390x844 that the mobile view no longer scrolls, the HUD stays compact, and the game board occupies most of the screen instead of shrinking to roughly half height.
- 2026-05-26: Tightened the mobile header again by collapsing the top HUD into a denser three-column first row plus a short action row, reducing score, fruit-pill, and button heights while keeping current/next fruit readable.
- 2026-05-26: Verified on localhost at 390x844 that the tighter mobile header frees additional vertical space for the board without reintroducing scrolling or the earlier half-height board regression.
- 2026-05-26: Simplified the mobile playfield framing after user feedback that the board still had too many nested borders. Removed the decorative outer `play-wrap` shell, dropped the canvas border, and replaced the thick multi-layer board frame with a single thinner green board edge that sits closer to the canvas bounds.
- 2026-05-26: Verified on localhost at 390x844 that the mobile board now reads as one main container instead of stacked cream-blue-green frames, while preserving the compact header and non-scrollable layout.
- 2026-05-26: User still wanted the main playfield to waste less area, so the actual field geometry was widened and lowered instead of only stretching decorative borders. Expanded the real left/right/bottom physics bounds and moved the visual board edge closer to the canvas edges so the white playable area consumes more of the screen.
- 2026-05-26: Verified on localhost at 390x844 that the playfield now sits noticeably closer to the canvas edges on mobile, with less unused blue margin around the main board.
- 2026-05-28: Implemented automatic mobile PWA power-saving. The main loop now coalesces render requests, stops in ready/paused/static states, pauses work while hidden, enables Matter.js sleeping, and caches the static board, fruit shadows, and scaled fruit sprites.
- 2026-05-28: Added a `power` block to `render_game_to_text()` so browser tests can confirm animation frames, render count, physics steps, active/sleeping fruit counts, and cache usage without adding visible UI.
- 2026-05-28: Reduced mobile-only visual cost by disabling card backdrop blur and reducing large shadows at the phone breakpoint. Also fixed a 390px viewport overflow found during verification by making the mobile playfield width-fit before height-fit.
- 2026-05-28: Bumped the PWA service worker/cache version to `suika-game-pwa-v11`.
- 2026-05-28: `node --check game.js` passed.
- 2026-05-28: Ran the `develop-web-game` Playwright client against localhost after the power-saving changes. The game accepted input, produced multiple fruits, performed a merge with score `32`, exposed the new `power` state, and produced no error artifacts.
- 2026-05-28: Browser verification at 390x844 confirmed the mobile HUD and game board fit without horizontal clipping or scrolling. Ready and paused states both showed `0` additional animation frames, renders, or physics steps over a 2.1s idle wait.
- 2026-05-28: Verified localhost PWA registration uses `sw.js?v=suika-game-pwa-v11`; cache key `suika-game-pwa-v11` exists and includes the shell, local Matter.js, representative fruit PNGs, manifest, and icons.
- 2026-05-28: Verified restart returns to `ready` with score `0`, no fruits, and no console errors.

## Notes

- Do not use CDN assets or runtime dependencies in the final game.
- Do not copy original Suika game artwork.
- Keep the first playable build focused on the required mechanics in `SPEC.md`.
- PWA icons are derived from the project watermelon asset and saved locally under `assets/icons/`.
- Service worker cache version is currently `suika-game-pwa-v11`; bump it when changing cached core assets or asset paths.
