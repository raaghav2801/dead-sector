// Boot, fixed-timestep loop and the state machine that stitches everything
// together.
(function () {
  'use strict';

  var U = GAME.Utils;
  var STEP = 1 / 60;
  var MAX_FRAME = 0.1;      // alt-tabbing must not teleport the swarm

  var W = 960, H = 640;

  var canvas, ctx;
  var last = 0, accumulator = 0;
  var state = 'MENU';
  var stateTime = 0;
  var background = null;

  var world = {
    w: W,
    h: H,
    player: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    effects: [],
    score: 0,
    levelIndex: 0,
    levelDef: null,
    mult: { hp: 1, speed: 1 },
    stage: null,
    boss: null,
    bossDefeated: false,
    levelComplete: false,
    unlockMessage: null,
    toast: null
  };

  // ---------------------------------------------------------------- background

  // One floor palette per level, so progression reads visually too.
  var FLOORS = [
    { base: '#14121c', grid: '#1f1c2e', speck: '#2b2542', tint: '#1b2436' },
    { base: '#1a1410', grid: '#2a1f16', speck: '#3d2a1c', tint: '#2a1a10' },
    { base: '#101620', grid: '#1a2434', speck: '#27354a', tint: '#122032' },
    { base: '#121a12', grid: '#1c2a1a', speck: '#2b3f26', tint: '#16240f' },
    { base: '#1a1014', grid: '#2a141c', speck: '#40202c', tint: '#280d14' }
  ];

  function buildBackground(levelIndex) {
    var f = FLOORS[levelIndex % FLOORS.length];
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var g = c.getContext('2d');

    g.fillStyle = f.base;
    g.fillRect(0, 0, W, H);

    // Floor plates.
    g.strokeStyle = f.grid;
    g.lineWidth = 2;
    for (var x = 0; x <= W; x += 40) {
      g.beginPath();
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, H);
      g.stroke();
    }
    for (var y = 0; y <= H; y += 40) {
      g.beginPath();
      g.moveTo(0, y + 0.5);
      g.lineTo(W, y + 0.5);
      g.stroke();
    }

    // Seeded rubble, stable for a given level.
    var rnd = U.mulberry32(1337 + levelIndex * 91);
    g.fillStyle = f.speck;
    for (var i = 0; i < 420; i++) {
      var px = Math.floor(rnd() * W);
      var py = Math.floor(rnd() * H);
      var s = 2 + Math.floor(rnd() * 3);
      g.fillRect(px, py, s, s);
    }
    // A few longer cracks for texture.
    g.strokeStyle = f.speck;
    g.lineWidth = 2;
    for (var j = 0; j < 26; j++) {
      var cx = rnd() * W, cy = rnd() * H;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + (rnd() - 0.5) * 70, cy + (rnd() - 0.5) * 70);
      g.stroke();
    }

    // Vignette pulls the eye to the middle of the arena.
    var grad = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.92);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // Arena border.
    g.strokeStyle = '#3a3358';
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);

    return c;
  }

  // -------------------------------------------------------------- run control

  function newRun() {
    world.score = 0;
    world.toast = null;
    world.unlockMessage = null;
    world.player = GAME.Player.create(world);
    GAME.Levels.startLevel(world, 0);
    background = buildBackground(0);
    setState('PLAYING');
  }

  function gotoLevel(index) {
    GAME.Levels.startLevel(world, index);
    background = buildBackground(index);
    setState('PLAYING');
  }

  function setState(next) {
    state = next;
    stateTime = 0;
  }

  // -------------------------------------------------------------------- update

  function update(dt) {
    stateTime += dt;
    var In = GAME.Input;

    if (state === 'MENU') {
      if (In.wasPressed('Enter') || In.mouse.pressed) newRun();
      return;
    }

    if (state === 'PAUSED') {
      if (In.wasPressed('p', 'Escape')) setState('PLAYING');
      return;
    }

    if (state === 'LEVEL_COMPLETE') {
      if (In.wasPressed('Enter')) gotoLevel(world.levelIndex + 1);
      return;
    }

    if (state === 'GAME_OVER' || state === 'VICTORY') {
      if (In.wasPressed('Enter')) newRun();
      else if (In.wasPressed('Escape')) setState('MENU');
      return;
    }

    // ---- PLAYING
    if (In.wasPressed('p')) {
      setState('PAUSED');
      return;
    }

    var p = world.player;
    GAME.Player.update(world, p, dt);
    GAME.Levels.update(world, dt);
    GAME.Enemies.update(world, dt);
    GAME.Bullets.update(world, dt);
    GAME.Pickups.update(world, dt);
    GAME.Enemies.updateEffects(world, dt);

    if (world.toast) {
      world.toast.t -= dt;
      if (world.toast.t <= 0) world.toast = null;
    }

    // Let the death animation finish before taking over the screen.
    if (!p.alive && p.deathT > 1.2) {
      setState('GAME_OVER');
      return;
    }

    if (world.levelComplete) {
      if (world.levelIndex + 1 < GAME.Levels.count) {
        // A breather between levels: some health back, and the next level's
        // weapon announced here so the reward lands with the win.
        p.hp = Math.min(p.maxHp, p.hp + 35);
        var nextDef = GAME.Levels.list[world.levelIndex + 1];
        world.unlockMessage = null;
        if (nextDef.unlock) {
          var wi = GAME.Weapons.indexOfId(nextDef.unlock);
          if (wi >= 0 && !p.owned[nextDef.unlock]) {
            world.unlockMessage = GAME.Weapons.list[wi].name + ' ACQUIRED';
          }
        }
        setState('LEVEL_COMPLETE');
      } else {
        setState('VICTORY');
      }
    }
  }

  // ---------------------------------------------------------------------- draw

  function drawWorld() {
    ctx.drawImage(background, 0, 0);
    GAME.Pickups.draw(ctx, world);
    GAME.Enemies.draw(ctx, world);
    GAME.Player.draw(ctx, world, world.player);
    GAME.Bullets.draw(ctx, world);
    GAME.Enemies.drawEffects(ctx, world);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    if (state === 'MENU') {
      // The menu sits over a still arena so the art is visible behind it.
      ctx.drawImage(background, 0, 0);
      GAME.UI.drawMenu(ctx, world, stateTime);
      GAME.UI.drawCrosshair(ctx, menuCrosshairWorld());
      return;
    }

    drawWorld();
    GAME.UI.drawHUD(ctx, world);

    if (state === 'PLAYING') {
      // Stage banners belong to live play; a full-screen overlay replaces them.
      GAME.UI.drawBanner(ctx, world);
      GAME.UI.drawCrosshair(ctx, world);
    } else if (state === 'PAUSED') {
      GAME.UI.drawPaused(ctx, world);
    } else if (state === 'LEVEL_COMPLETE') {
      GAME.UI.drawLevelComplete(ctx, world, stateTime);
    } else if (state === 'GAME_OVER') {
      GAME.UI.drawGameOver(ctx, world, stateTime);
    } else if (state === 'VICTORY') {
      GAME.UI.drawVictory(ctx, world, stateTime);
    }
  }

  // The crosshair colour comes from the active weapon; on the menu there is no
  // player yet, so hand it a stand-in.
  var MENU_STUB = { w: W, h: H, player: { weaponIndex: 0 } };
  function menuCrosshairWorld() {
    return world.player ? world : MENU_STUB;
  }

  // ---------------------------------------------------------------------- loop

  function frame(now) {
    if (!last) last = now;
    var dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;

    accumulator += dt;
    var steps = 0;
    while (accumulator >= STEP && steps < 6) {
      update(STEP);
      // Clear the one-frame latches per step, not per frame: a slow frame runs
      // several steps, and a single P press must not pause then immediately
      // unpause. A frame that runs no steps keeps the latch for the next one,
      // so a click is never dropped either.
      GAME.Input.endFrame();
      accumulator -= STEP;
      steps++;
    }

    draw();
    requestAnimationFrame(frame);
  }

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    GAME.Sprites.init();
    GAME.Input.attach(canvas);

    // The menu needs a level to show behind it and a level name in the HUD.
    world.player = GAME.Player.create(world);
    GAME.Levels.startLevel(world, 0);
    background = buildBackground(0);
    setState('MENU');

    // Exposed so the live state can be inspected from the console.
    GAME.world = world;

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
