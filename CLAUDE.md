# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Dead Sector**, a browser top-down arena shooter. Vanilla JS on a 2D canvas.
No build step, no dependencies, no package.json. See `README.md` for controls
and gameplay rules.

## Commands

```bash
# Run it: just open the file. No server.
start index.html                  # cmd / PowerShell
node --check js/<file>.js         # syntax check after editing (no linter in repo)
```

There is no test runner, linter or build in the repo. Verification is described
below.

## The one hard constraint

Scripts load as plain `<script>` tags, **not ES modules**, so the game runs by
double-clicking `index.html` over `file://`. Do not introduce `import`/`export`,
`fetch`, or external image/audio files — modules and `fetch` are blocked on
`file://`, and loading images taints the canvas. All art is generated in code.

Every file attaches to one global `GAME` object. The `<script>` order in
`index.html` **is** the dependency order; a new file needs a tag inserted in the
right place. Files only reference each other inside functions (never at load
time), so load order only has to satisfy `GAME.X` existing when called.

## Architecture

### State lives in one place

`js/main.js` owns a single mutable `world` object (player, enemies, bullets,
enemyBullets, pickups, effects, score, stage, levelDef...). Every other module is
stateless and operates as `SomeSystem.update(world, dt)` / `.draw(ctx, world)`.
`world` is private to main.js but exposed as `GAME.world` for console debugging.

### Fixed timestep, and why input is latched per step

The loop in `main.js` accumulates real time and runs `update(1/60)` up to 6 times
per frame, with frame time clamped to 100ms so an alt-tab cannot teleport the
swarm across the arena.

`GAME.Input.endFrame()` is called **inside** the step loop, not once per frame.
This matters: a slow frame runs several steps, and a one-frame latch like a `P`
press would otherwise be read twice and pause then instantly unpause. A frame
that runs zero steps deliberately keeps the latch for the next frame so clicks
are never dropped.

### Update order is load-bearing

`Player → Levels → Enemies → Bullets → Pickups → effects`. The level scheduler
runs before enemies so a boss death is observed on the same frame it happens
(before `Enemies.update` prunes the corpse and nulls `world.boss`).

### Entity lifecycle

Death is two-phase. `Enemies.kill()` sets `dying = true` and starts `deathT`;
the entity keeps rendering (fading, puffing up) until `deathT > 0.34`, then gets
`dead = true` and is removed by `Utils.pruneList`. **Anything that iterates
enemies must skip `dying` ones** — collision, separation and alive-counts all do.

Enemies spawn outside the arena and must walk in, so bounds clamping is gated on
an `entered` flag that only sets once the entity is inside on *both* axes.

The player has two velocities: `vx/vy` (locomotion, damped toward input) and
`ix/iy` (impulses — recoil and knockback, decaying independently). Position adds
both. Recoil written to `vx/vy` would be erased instantly by the locomotion damp.

### Sprites

`js/sprites.js` holds every sprite as an array of equal-length strings, one
character per pixel, mapped through a palette at the top of the file. `init()`
bakes each frame into an offscreen canvas once; drawing is a single rotated
`drawImage`.

- All sprites are authored **facing right (+x)**. The game rotates by the aim
  angle, so one sprite covers 360°.
- Rotation pivots on the image centre — keep the body roughly centred in the
  grid or the sprite will orbit oddly when it turns.
- Two rules keep 16px art readable at 3x: put a creature's darker shade at its
  **back**, never its middle (a dark centre reads as a hole), and make anything
  that must be seen — eye, claw, gun — at least **two pixels** thick.
- Row-length mistakes and non-palette characters fail *silently* (short rows just
  draw fewer pixels). Validate after editing grids.

**Cross-file coupling to watch:** the muzzle position is hardcoded to the gun tip
in the player grid. If you change the player sprite's width or barrel length,
update `muzzleForward` in `js/bullets.js` and `forward` in `drawMuzzleFlash` in
`js/player.js` to match, or bullets will spawn detached from the barrel.

### Levels

`js/levels.js` runs a phase machine on `world.stage`:
`intro → wave → breather → wave ... → bossIntro → boss → cleared`. A wave's
enemies drip-spawn from a shuffled queue (one every 0.22s) across random edges,
so pressure arrives from several directions at once. A wave only ends when the
queue is empty *and* no non-dying enemies remain. Killing the boss chain-kills
its escort. `main.js` watches `world.levelComplete` and decides
LEVEL_COMPLETE vs VICTORY.

## Tuning is data, not code

Balance changes should be table edits, not new logic:

- `js/weapons.js` — the `WEAPONS` array (damage, cooldown, pellets, spread, ammo, recoil).
- `js/enemies.js` — the `TYPES` table (hp, speed, radius, contact damage, score, drop chance, behaviour).
- `js/levels.js` — the `LEVELS` array (wave composition, per-level `mult` scaling hp/speed, boss hp).
- `js/main.js` — `FLOORS`, one background palette per level.

Adding an enemy type means a `TYPES` entry, a sprite in the sheet, and a
`behaviour` branch in `updateOne`; existing behaviours are `chase`, `weave`,
`ranged`, `boss`.

## Verifying changes

Because it's a game, gameplay feel needs a human at the keyboard — but most
regressions are catchable headlessly, and that's the expected workflow here:

1. **Logic** — the game files run in Node under a stubbed `document`/`canvas`/
   `requestAnimationFrame` (a no-op 2D context is enough; `main.js` only needs
   `getElementById`, `createElement('canvas')` and `addEventListener`). Build a
   `world` the same way `main.js` does, then drive systems directly in the update
   order above. This catches spawn placement, damage, pickups and whole-level
   completion without a browser.
2. **Sprite grids** — check every row in a grid is the same width and uses only
   palette characters, since both fail silently.
3. **Visuals** — headless Chrome can screenshot real gameplay, but it only paints
   a few frames, so the simulation barely advances under `--virtual-time-budget`
   alone. Override `window.requestAnimationFrame` *before* the game scripts load
   to queue callbacks, then pump them with synthetic timestamps and dispatch real
   `KeyboardEvent`/`MouseEvent`s between pumps. The canvas holds the last drawn
   frame for the screenshot.

These harness scripts are not committed; they were written to a scratchpad.

## Git workflow

Feature branches + PRs into `main`, not direct commits to `main`. This project
has ongoing work planned (balance passes, sound, new levels/enemies), so `main`
stays a clean, always-playable history and each feature gets its own revertible
branch. Branch names: `feature/<name>`, `fix/<name>`, `docs/<name>`. Delete a
branch after it merges.

## Gotchas

- Mouse position must be converted to canvas pixels
  (`clientX * canvas.width / rect.width`) — the canvas is CSS-scaled, so raw
  client coordinates make aim drift badly at non-1:1 sizes. `js/input.js`
  already does this; keep it that way.
- Full-screen overlays (pause, level complete, game over) must not be drawn on
  top of the in-play stage banner — `main.js` only draws banners in `PLAYING`.
- `Utils.pruneList` mutates in place; don't hold indices across it.
