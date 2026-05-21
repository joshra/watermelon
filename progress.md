Original prompt: 單機靜態網頁版的西瓜遊戲

# Progress

## Current Status

- Product specification created in `SPEC.md`.
- Agent handoff guide created in `AGENTS.md`.
- AI asset-generation guide created in `docs/ASSET_GENERATION.md`.
- Project is intentionally still pre-implementation.

## User Decisions

- Build a full playable version, not only a minimal prototype.
- Support both desktop and mobile.
- Use exactly 11 fruit levels.
- Fruit assets must be directly AI-generated.
- The fruit set must have one consistent overall style.
- Documentation and agent guidance should come before system implementation.

## Skills To Use

- Use `develop-web-game` for the playable game implementation and browser verification loop.
- Use `imagegen` for fruit sprites and any raster visual assets.
- Use Playwright/browser tooling to validate screenshots, controls, console errors, and test hooks.

## Next TODOs

- Confirm whether the current generated preview sprite sheet is acceptable or regenerate it.
- Copy accepted source artwork into the workspace.
- Remove chroma-key background and cut the sheet into 11 transparent fruit PNGs.
- Add local `vendor/matter.min.js`.
- Implement `index.html`, `styles.css`, and `game.js` after assets are accepted.
- Add `window.render_game_to_text()` and `window.advanceTime(ms)`.
- Run browser tests for desktop and mobile viewports.

## Notes

- Do not use CDN assets or runtime dependencies in the final game.
- Do not copy original Suika game artwork.
- Keep the first playable build focused on the required mechanics in `SPEC.md`.

