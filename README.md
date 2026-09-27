# Dead Sector

A 2D retro top-down arena shooter that runs in the browser. Move with the arrow
keys, aim with the mouse, and hold the trigger while waves of enemies close in
from every edge of the screen.

## Running it

Double-click `index.html`, or drag it into a browser window. That is the whole
setup — there is no build step, no dependencies and no local server needed.

The scripts are loaded as plain `<script>` tags rather than ES modules
specifically so that `file://` works. If you ever convert them to modules you
will need to serve the folder instead (`python -m http.server`).

## Controls

| Input | Action |
| --- | --- |
| Arrow keys or WASD | Move |
| Mouse | Aim |
| Left click (hold) | Shoot |
| `1` `2` `3`, or `Q` | Switch weapon |
| `P` | Pause |
| `Enter` | Start / continue / restart |
| `Esc` | Back to the menu (from game over or victory) |

## How a run works

Five levels, each one three waves of enemies followed by a heavy unit (the
boss). Waves spawn from all four edges and only end once every enemy is down.
Clearing a level restores some health and, on levels 2 and 3, hands you a new
gun. Dying sends you back to the menu with your score; clearing level 5 wins.

| Enemy | Behaviour |
| --- | --- |
| Grunt | Walks straight at you |
| Runner | Fast, weaves from side to side so it is harder to track |
| Brute | Slow, tough, hits hard |
| Spitter | Keeps its distance and shoots acid |
| Heavy unit | Telegraphs a charge, then calls in grunts while it recovers |

Weapons: the pistol has infinite ammo, the shotgun fires six pellets in a spread
and the machine gun trades damage for rate of fire. Ammo pickups top up whichever
unlocked gun is emptiest, and an empty gun falls back to the pistol on its own.

## Layout

| File | What lives there |
| --- | --- |
| `index.html` | Canvas plus the scripts, in dependency order |
| `css/style.css` | Letterboxed, pixel-crisp canvas scaling |
| `js/utils.js` | Maths, collision and list helpers |
| `js/sprites.js` | All pixel art, as character grids baked to offscreen canvases |
| `js/input.js` | Keyboard state and canvas-space mouse position |
| `js/weapons.js` | The weapon stat table |
| `js/bullets.js` | Projectiles for both sides, and hit resolution |
| `js/pickups.js` | Health and ammo drops |
| `js/enemies.js` | Enemy types, AI, the boss, and death effects |
| `js/player.js` | Movement, aiming, firing, damage |
| `js/levels.js` | Level definitions and the wave scheduler |
| `js/ui.js` | HUD and every full-screen state |
| `js/main.js` | Game loop and state machine |

## Changing things

Most tuning is data, not code:

- **Guns** — the table at the top of `js/weapons.js` (damage, rate, pellets,
  spread, ammo, recoil).
- **Enemies** — the `TYPES` table at the top of `js/enemies.js` (health, speed,
  size, contact damage, score, drop chance).
- **Levels and difficulty** — the `LEVELS` array in `js/levels.js`. Each entry
  has its waves (`{ grunt: 6, runner: 3 }`), a per-level `mult` that scales enemy
  health and speed, and the boss's health.
- **Art** — the grids in `js/sprites.js`. Each sprite is an array of equal-length
  strings, one character per pixel, mapped through the palette at the top of the
  file. Everything is drawn facing right; the game rotates it toward the aim
  point. Two rules keep them readable: put a creature's darker shade at its back
  rather than its middle, and make anything that has to be seen at least two
  pixels thick.

The live game state is exposed as `GAME.world` in the console, which is handy
for poking at things while it runs.

## Notes

Sound effects and screen-shake style effects are deliberately not in this
version.
