// Projectiles for both sides, drawn as short retro tracers. Player bullets test
// against enemies; enemy bullets test against the player.
(function () {
  'use strict';

  var U = GAME.Utils;

  function spawn(list, x, y, angle, speed, damage, color, trail, width, radius) {
    list.push({
      x: x,
      y: y,
      px: x,
      py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: damage,
      color: color,
      trail: trail,
      width: width,
      r: radius || 3,
      life: 1.6
    });
  }

  // Fire the active weapon. Returns true if a shot actually went out.
  function firePlayer(world, player) {
    var w = GAME.Weapons.list[player.weaponIndex];
    var slot = player.ammo[w.id];
    if (!w.infinite && slot <= 0) return false;

    // Muzzle sits at the gun tip in sprite space (16x16 grid, 3x scale).
    var muzzleForward = 28;
    var muzzleSide = 0;
    var ca = Math.cos(player.angle), sa = Math.sin(player.angle);
    var mx = player.x + ca * muzzleForward - sa * muzzleSide;
    var my = player.y + sa * muzzleForward + ca * muzzleSide;

    for (var i = 0; i < w.pellets; i++) {
      // Shotgun pellets fan evenly with a little jitter; single shots just wobble.
      var offset;
      if (w.pellets > 1) {
        offset = (i / (w.pellets - 1) - 0.5) * w.spread * 2 + U.randRange(-0.03, 0.03);
      } else {
        offset = U.randRange(-w.spread, w.spread);
      }
      spawn(world.bullets, mx, my, player.angle + offset,
            w.speed * U.randRange(0.94, 1.06), w.damage, w.color, w.trail, w.width, 4);
    }

    if (!w.infinite) player.ammo[w.id] = slot - 1;
    player.cooldown = w.cooldown;
    player.muzzle = 0.06;

    // Recoil nudges the player backwards, so the shotgun feels heavy.
    player.ix -= ca * w.kick;
    player.iy -= sa * w.kick;
    return true;
  }

  function fireEnemy(world, x, y, angle, damage) {
    spawn(world.enemyBullets, x, y, angle, 300, damage, '#c8d040', 10, 3, 5);
  }

  function step(list, dt, w, h) {
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > w + 40 || b.y < -40 || b.y > h + 40) {
        b.dead = true;
      }
    }
  }

  function update(world, dt) {
    step(world.bullets, dt, world.w, world.h);
    step(world.enemyBullets, dt, world.w, world.h);

    // Player bullets vs enemies. First hit consumes the bullet.
    for (var i = 0; i < world.bullets.length; i++) {
      var b = world.bullets[i];
      if (b.dead) continue;
      for (var j = 0; j < world.enemies.length; j++) {
        var e = world.enemies[j];
        if (e.dying) continue;
        if (U.circleHit(b, e)) {
          GAME.Enemies.damage(world, e, b.damage, b.vx, b.vy);
          b.dead = true;
          break;
        }
      }
    }

    // Enemy bullets vs player.
    var p = world.player;
    if (p && p.alive) {
      for (var k = 0; k < world.enemyBullets.length; k++) {
        var eb = world.enemyBullets[k];
        if (eb.dead) continue;
        if (U.circleHit(eb, p)) {
          GAME.Player.hurt(world, p, eb.damage, eb.vx, eb.vy);
          eb.dead = true;
        }
      }
    }

    U.pruneList(world.bullets, isDead);
    U.pruneList(world.enemyBullets, isDead);
  }

  function isDead(b) {
    return b.dead;
  }

  function drawList(ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var len = b.trail;
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
      var tx = b.x - (b.vx / sp) * len;
      var ty = b.y - (b.vy / sp) * len;

      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Bright core makes the tracer pop against the dark floor.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
    }
  }

  function draw(ctx, world) {
    drawList(ctx, world.bullets);
    drawList(ctx, world.enemyBullets);
  }

  GAME.Bullets = {
    update: update,
    draw: draw,
    firePlayer: firePlayer,
    fireEnemy: fireEnemy
  };
})();
