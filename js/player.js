// The player: arrow-key (or WASD) movement, mouse aiming, weapon handling and
// damage. Locomotion and impulses (recoil, knockback) are tracked separately so
// a shotgun blast still shoves you even while you are holding a direction.
(function () {
  'use strict';

  var U = GAME.Utils;
  var MAX_SPEED = 235;
  var ACCEL_RATE = 14;
  var IMPULSE_DECAY = 7;
  var INVULN_TIME = 0.6;

  function create(world) {
    var list = GAME.Weapons.list;
    var p = {
      x: world.w / 2,
      y: world.h / 2,
      vx: 0, vy: 0,
      ix: 0, iy: 0,
      r: 14,
      hp: 100,
      maxHp: 100,
      angle: 0,
      animT: 0,
      moving: false,
      weaponIndex: 0,
      owned: {},
      ammo: {},
      cooldown: 0,
      muzzle: 0,
      invuln: 0,
      alive: true,
      deathT: 0
    };
    for (var i = 0; i < list.length; i++) {
      p.owned[list[i].id] = !!list[i].infinite;   // start with the pistol only
      p.ammo[list[i].id] = list[i].infinite ? Infinity : 0;
    }
    return p;
  }

  // Levels call this to hand over a new gun at the start of a level.
  function unlock(player, id) {
    var i = GAME.Weapons.indexOfId(id);
    if (i < 0) return null;
    var w = GAME.Weapons.list[i];
    var isNew = !player.owned[id];
    player.owned[id] = true;
    player.ammo[id] = Math.min(w.maxAmmo, Math.max(player.ammo[id], w.startAmmo));
    if (isNew) player.weaponIndex = i;
    return w;
  }

  function readMoveInput() {
    var In = GAME.Input;
    var dx = 0, dy = 0;
    if (In.isDown('ArrowLeft', 'a')) dx -= 1;
    if (In.isDown('ArrowRight', 'd')) dx += 1;
    if (In.isDown('ArrowUp', 'w')) dy -= 1;
    if (In.isDown('ArrowDown', 's')) dy += 1;
    // Normalize so diagonals are not faster.
    if (dx && dy) {
      var inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }
    return { x: dx, y: dy };
  }

  function selectWeapon(player, index) {
    var list = GAME.Weapons.list;
    if (index < 0 || index >= list.length) return;
    if (!player.owned[list[index].id]) return;
    player.weaponIndex = index;
  }

  function cycleWeapon(player, dir) {
    var list = GAME.Weapons.list;
    for (var step = 1; step <= list.length; step++) {
      var i = (player.weaponIndex + dir * step + list.length * 2) % list.length;
      if (player.owned[list[i].id]) {
        player.weaponIndex = i;
        return;
      }
    }
  }

  // Empty guns fall back to the pistol rather than leaving you defenceless.
  function autoFallback(player) {
    var w = GAME.Weapons.list[player.weaponIndex];
    if (!w.infinite && player.ammo[w.id] <= 0) {
      player.weaponIndex = 0;
    }
  }

  function update(world, player, dt) {
    var In = GAME.Input;

    if (!player.alive) {
      player.deathT += dt;
      player.ix = U.damp(player.ix, 0, IMPULSE_DECAY, dt);
      player.iy = U.damp(player.iy, 0, IMPULSE_DECAY, dt);
      player.x += player.ix * dt;
      player.y += player.iy * dt;
      return;
    }

    if (player.invuln > 0) player.invuln -= dt;
    if (player.muzzle > 0) player.muzzle -= dt;
    if (player.cooldown > 0) player.cooldown -= dt;

    // Aim at the cursor every frame, in canvas space.
    player.angle = U.angleTo(player.x, player.y, In.mouse.x, In.mouse.y);

    var dir = readMoveInput();
    player.moving = (dir.x !== 0 || dir.y !== 0);
    player.vx = U.damp(player.vx, dir.x * MAX_SPEED, ACCEL_RATE, dt);
    player.vy = U.damp(player.vy, dir.y * MAX_SPEED, ACCEL_RATE, dt);
    player.ix = U.damp(player.ix, 0, IMPULSE_DECAY, dt);
    player.iy = U.damp(player.iy, 0, IMPULSE_DECAY, dt);

    player.x += (player.vx + player.ix) * dt;
    player.y += (player.vy + player.iy) * dt;
    player.x = U.clamp(player.x, player.r, world.w - player.r);
    player.y = U.clamp(player.y, player.r, world.h - player.r);

    if (player.moving) player.animT += dt;

    // Weapon selection.
    if (In.wasPressed('1')) selectWeapon(player, 0);
    if (In.wasPressed('2')) selectWeapon(player, 1);
    if (In.wasPressed('3')) selectWeapon(player, 2);
    if (In.wasPressed('q', 'Tab')) cycleWeapon(player, 1);

    autoFallback(player);

    // Hold to keep firing; the weapon cooldown sets the actual rate.
    if (In.mouse.down && player.cooldown <= 0) {
      GAME.Bullets.firePlayer(world, player);
      autoFallback(player);
    }
  }

  function hurt(world, player, amount, dirX, dirY) {
    if (!player.alive || player.invuln > 0) return;
    player.hp -= amount;
    player.invuln = INVULN_TIME;

    var len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    player.ix += (dirX / len) * 190;
    player.iy += (dirY / len) * 190;

    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      player.deathT = 0;
    }
  }

  function draw(ctx, world, player) {
    var sheet = GAME.Sprites.sheet;

    // Shadow.
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 9, 14, 6, 0, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (!player.alive) {
      var k = Math.min(1, player.deathT / 1.0);
      GAME.Sprites.draw(ctx, sheet.playerIdle, 0, player.x, player.y,
                        player.angle, 1 - k * 0.85, 1 - k * 0.3);
      return;
    }

    // Blink while invulnerable so the hit is legible.
    var alpha = 1;
    if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0) alpha = 0.4;

    var sprite = player.moving ? sheet.playerWalk : sheet.playerIdle;
    GAME.Sprites.draw(ctx, sprite, player.animT, player.x, player.y, player.angle, alpha);

    if (player.muzzle > 0) drawMuzzleFlash(ctx, player);
  }

  // Drawn procedurally at the barrel tip so it lines up with any aim angle.
  function drawMuzzleFlash(ctx, player) {
    var forward = 31, side = 0;
    var ca = Math.cos(player.angle), sa = Math.sin(player.angle);
    var mx = player.x + ca * forward - sa * side;
    var my = player.y + sa * forward + ca * side;

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#fff6c0';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(0, -2, 8, 4);
    ctx.fillRect(4, -7, 3, 3);
    ctx.fillRect(4, 4, 3, 3);
    ctx.restore();
  }

  GAME.Player = {
    create: create,
    update: update,
    draw: draw,
    hurt: hurt,
    unlock: unlock,
    selectWeapon: selectWeapon
  };
})();
