// Enemy types, edge spawning, AI behaviours and the per-level boss.
// Death bursts live here too, since enemies are the only thing that spawns them.
(function () {
  'use strict';

  var U = GAME.Utils;

  var TYPES = {
    grunt: {
      sprite: 'grunt', hp: 3, speed: 54, r: 14, touchDamage: 8,
      score: 10, dropChance: 0.16, behaviour: 'chase', tint: '#5f9e4a'
    },
    runner: {
      sprite: 'runner', hp: 2, speed: 124, r: 11, touchDamage: 6,
      score: 15, dropChance: 0.14, behaviour: 'weave', tint: '#d24b3a'
    },
    brute: {
      sprite: 'brute', hp: 12, speed: 36, r: 22, touchDamage: 18,
      score: 30, dropChance: 0.42, behaviour: 'chase', tint: '#8b4fa8'
    },
    spitter: {
      sprite: 'spitter', hp: 5, speed: 66, r: 14, touchDamage: 5,
      score: 25, dropChance: 0.34, behaviour: 'ranged', tint: '#c8d040',
      preferredRange: 250, fireInterval: 1.9, projectileDamage: 9
    },
    boss: {
      sprite: 'boss', hp: 60, speed: 46, r: 46, touchDamage: 22,
      score: 250, dropChance: 1, behaviour: 'boss', tint: '#b8323c'
    }
  };

  // Place an enemy just off a random edge so waves arrive from every direction.
  function spawnAtEdge(world, typeName, mult) {
    var def = TYPES[typeName];
    var pad = def.r + 30;
    var edge = U.randInt(0, 3);
    var x, y;
    if (edge === 0) {            // top
      x = U.randRange(pad, world.w - pad);
      y = -pad;
    } else if (edge === 1) {     // right
      x = world.w + pad;
      y = U.randRange(pad, world.h - pad);
    } else if (edge === 2) {     // bottom
      x = U.randRange(pad, world.w - pad);
      y = world.h + pad;
    } else {                     // left
      x = -pad;
      y = U.randRange(pad, world.h - pad);
    }
    return spawnAt(world, typeName, x, y, mult);
  }

  function spawnAt(world, typeName, x, y, mult) {
    var def = TYPES[typeName];
    mult = mult || { hp: 1, speed: 1 };
    var hp = Math.ceil(def.hp * (mult.hp || 1));
    var e = {
      type: typeName,
      def: def,
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      r: def.r,
      hp: hp,
      maxHp: hp,
      // Slight per-enemy speed jitter keeps a pack from moving as one blob.
      speed: def.speed * (mult.speed || 1) * U.randRange(0.92, 1.08),
      angle: 0,
      animT: Math.random() * 2,
      touchCd: 0,
      hitFlash: 0,
      fireCd: U.randRange(0.4, 1.6),
      weavePhase: Math.random() * U.TAU,
      dying: false,
      deathT: 0,
      // boss-only
      phase: 'stalk',
      phaseT: 2.0,
      chargeAngle: 0,
      spawnedMinions: false
    };
    world.enemies.push(e);
    return e;
  }

  function spawnBoss(world, cfg) {
    // Bosses walk in from a random edge like everything else, just slower.
    var e = spawnAtEdge(world, 'boss', { hp: 1, speed: cfg.speed || 1 });
    e.hp = e.maxHp = cfg.hp;
    e.speed = TYPES.boss.speed * (cfg.speed || 1);
    world.boss = e;
    return e;
  }

  function damage(world, e, amount, vx, vy) {
    if (e.dying) return;
    e.hp -= amount;
    e.hitFlash = 0.09;

    // Knockback scaled by size, so brutes barely flinch.
    var sp = Math.sqrt(vx * vx + vy * vy) || 1;
    var push = 130 / (e.r / 12);
    e.vx += (vx / sp) * push;
    e.vy += (vy / sp) * push;

    if (e.hp <= 0) kill(world, e);
  }

  function kill(world, e) {
    e.dying = true;
    e.deathT = 0;
    world.score += Math.round(e.def.score * (1 + world.levelIndex * 0.25));
    burst(world, e.x, e.y, e.def.tint, e.r);
    GAME.Pickups.maybeDrop(world, e.x, e.y, e.def.dropChance);
    if (world.boss === e) world.bossDefeated = true;
  }

  // ------------------------------------------------------------------ AI steps

  function steer(e, dt, tx, ty, speed) {
    var a = U.angleTo(e.x, e.y, tx, ty);
    e.vx = U.damp(e.vx, Math.cos(a) * speed, 8, dt);
    e.vy = U.damp(e.vy, Math.sin(a) * speed, 8, dt);
  }

  function updateOne(world, e, dt) {
    var p = world.player;

    if (e.dying) {
      e.deathT += dt;
      // Coast to a stop while the death animation plays out.
      e.vx *= 0.9;
      e.vy *= 0.9;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.deathT > 0.34) e.dead = true;
      return;
    }

    e.animT += dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.touchCd > 0) e.touchCd -= dt;
    e.angle = U.angleTo(e.x, e.y, p.x, p.y);

    var b = e.def.behaviour;

    if (b === 'chase') {
      steer(e, dt, p.x, p.y, e.speed);

    } else if (b === 'weave') {
      // Chase, but slide sideways in a sine wave so it is harder to track.
      e.weavePhase += dt * 6;
      var a = U.angleTo(e.x, e.y, p.x, p.y);
      var weave = Math.sin(e.weavePhase) * 0.7;
      var wx = Math.cos(a) * e.speed - Math.sin(a) * e.speed * weave;
      var wy = Math.sin(a) * e.speed + Math.cos(a) * e.speed * weave;
      e.vx = U.damp(e.vx, wx, 10, dt);
      e.vy = U.damp(e.vy, wy, 10, dt);

    } else if (b === 'ranged') {
      var d = U.dist(e.x, e.y, p.x, p.y);
      var want = e.def.preferredRange;
      if (d > want) {
        steer(e, dt, p.x, p.y, e.speed);
      } else if (d < want * 0.72) {
        // Back off to keep its distance.
        steer(e, dt, e.x * 2 - p.x, e.y * 2 - p.y, e.speed * 0.9);
      } else {
        e.vx = U.damp(e.vx, 0, 6, dt);
        e.vy = U.damp(e.vy, 0, 6, dt);
      }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && d < want * 1.5 && p.alive) {
        e.fireCd = e.def.fireInterval * U.randRange(0.85, 1.15);
        GAME.Bullets.fireEnemy(world, e.x + Math.cos(e.angle) * e.r,
                               e.y + Math.sin(e.angle) * e.r,
                               e.angle, e.def.projectileDamage);
      }

    } else if (b === 'boss') {
      updateBoss(world, e, dt);
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // Only clamp once an enemy has actually walked on-screen, otherwise the
    // spawn position outside the arena would be snapped to the edge instantly.
    if (e.x > e.r && e.x < world.w - e.r &&
        e.y > e.r && e.y < world.h - e.r) {
      e.entered = true;
    }
    if (e.entered) {
      e.x = U.clamp(e.x, e.r, world.w - e.r);
      e.y = U.clamp(e.y, e.r, world.h - e.r);
    }

    // Contact damage, rate-limited per enemy so a swarm cannot delete the
    // player in a handful of frames.
    if (p.alive && e.touchCd <= 0 && U.circleHit(e, p)) {
      GAME.Player.hurt(world, p, e.def.touchDamage,
                       p.x - e.x, p.y - e.y);
      e.touchCd = 0.65;
      // Bounce apart so they do not sit inside each other.
      var away = U.angleTo(p.x, p.y, e.x, e.y);
      e.vx = Math.cos(away) * 120;
      e.vy = Math.sin(away) * 120;
    }
  }

  // Three-beat pattern: stalk, telegraphed windup, charge, then a vulnerable
  // recovery where it calls in grunts.
  function updateBoss(world, e, dt) {
    var p = world.player;
    e.phaseT -= dt;

    if (e.phase === 'stalk') {
      steer(e, dt, p.x, p.y, e.speed);
      if (e.phaseT <= 0) {
        e.phase = 'windup';
        e.phaseT = 0.7;
      }
    } else if (e.phase === 'windup') {
      e.vx = U.damp(e.vx, 0, 10, dt);
      e.vy = U.damp(e.vy, 0, 10, dt);
      e.chargeAngle = U.angleTo(e.x, e.y, p.x, p.y);
      if (e.phaseT <= 0) {
        e.phase = 'charge';
        e.phaseT = 0.8;
        e.vx = Math.cos(e.chargeAngle) * e.speed * 7;
        e.vy = Math.sin(e.chargeAngle) * e.speed * 7;
      }
    } else if (e.phase === 'charge') {
      // Committed to the locked direction; only drag slows it.
      e.vx *= (1 - 0.6 * dt);
      e.vy *= (1 - 0.6 * dt);
      if (e.phaseT <= 0) {
        e.phase = 'recover';
        e.phaseT = 1.1;
        e.spawnedMinions = false;
      }
    } else if (e.phase === 'recover') {
      e.vx = U.damp(e.vx, 0, 5, dt);
      e.vy = U.damp(e.vy, 0, 5, dt);
      if (!e.spawnedMinions) {
        e.spawnedMinions = true;
        var count = 2 + world.levelIndex % 2;
        for (var i = 0; i < count; i++) spawnAtEdge(world, 'grunt', world.mult);
      }
      if (e.phaseT <= 0) {
        e.phase = 'stalk';
        e.phaseT = U.randRange(2.2, 3.2);
      }
    }
  }

  // Weak mutual push so packs spread out instead of stacking into one sprite.
  function separate(world) {
    var list = world.enemies;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.dying) continue;
      for (var j = i + 1; j < list.length; j++) {
        var b = list[j];
        if (b.dying) continue;
        var minD = (a.r + b.r) * 0.8;
        var dx = b.x - a.x, dy = b.y - a.y;
        var d2 = dx * dx + dy * dy;
        if (d2 > minD * minD || d2 === 0) continue;
        var d = Math.sqrt(d2);
        var push = (minD - d) * 0.5;
        var nx = dx / d, ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  function update(world, dt) {
    for (var i = 0; i < world.enemies.length; i++) {
      updateOne(world, world.enemies[i], dt);
    }
    separate(world);
    U.pruneList(world.enemies, function (e) { return e.dead; });
    if (world.boss && world.boss.dead) world.boss = null;
  }

  function draw(ctx, world) {
    var sheet = GAME.Sprites.sheet;
    for (var i = 0; i < world.enemies.length; i++) {
      var e = world.enemies[i];
      var sprite = sheet[e.def.sprite];

      // Shadow blob grounds the sprite on the floor.
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.r * 0.55, e.r * 0.8, e.r * 0.35, 0, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (e.dying) {
        // Fade out while puffing up slightly.
        var k = e.deathT / 0.34;
        GAME.Sprites.draw(ctx, sprite, e.animT, e.x, e.y, e.angle, 1 - k, 1 + k * 0.4);
        continue;
      }

      // Boss telegraphs its charge with a growing ring during windup.
      if (e.type === 'boss' && e.phase === 'windup') {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 10 + (0.7 - e.phaseT) * 40, 0, U.TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      GAME.Sprites.draw(ctx, sprite, e.animT, e.x, e.y, e.angle, 1);

      // Hit flash: a white silhouette stamped over the sprite for a few frames.
      if (e.hitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, e.hitFlash / 0.09) * 0.75;
        GAME.Sprites.draw(ctx, sprite, e.animT, e.x, e.y, e.angle, 1);
        ctx.restore();
      }

      // Small health pip over wounded tough enemies.
      if (e.type !== 'boss' && e.hp < e.maxHp && e.maxHp > 3) {
        var w = e.r * 1.6;
        ctx.fillStyle = '#000000';
        ctx.fillRect(e.x - w / 2 - 1, e.y - e.r - 10, w + 2, 5);
        ctx.fillStyle = '#7ee07e';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w * (e.hp / e.maxHp), 3);
      }
    }
  }

  // ------------------------------------------------------------- death bursts

  function burst(world, x, y, color, r) {
    var shards = [];
    var n = Math.min(14, 5 + Math.floor(r / 3));
    for (var i = 0; i < n; i++) {
      var a = Math.random() * U.TAU;
      var sp = U.randRange(70, 260);
      shards.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: U.randInt(2, 4)
      });
    }
    world.effects.push({
      x: x, y: y, color: color, r: r,
      t: 0, dur: 0.45, shards: shards
    });
  }

  function updateEffects(world, dt) {
    for (var i = 0; i < world.effects.length; i++) {
      var fx = world.effects[i];
      fx.t += dt;
      for (var j = 0; j < fx.shards.length; j++) {
        var s = fx.shards[j];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= (1 - 2.4 * dt);
        s.vy *= (1 - 2.4 * dt);
      }
      if (fx.t >= fx.dur) fx.dead = true;
    }
    U.pruneList(world.effects, function (f) { return f.dead; });
  }

  function drawEffects(ctx, world) {
    for (var i = 0; i < world.effects.length; i++) {
      var fx = world.effects[i];
      var k = fx.t / fx.dur;
      ctx.globalAlpha = 1 - k;

      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r * (0.5 + k * 1.6), 0, U.TAU);
      ctx.stroke();

      ctx.fillStyle = fx.color;
      for (var j = 0; j < fx.shards.length; j++) {
        var s = fx.shards[j];
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
      }
      ctx.globalAlpha = 1;
    }
  }

  GAME.Enemies = {
    types: TYPES,
    spawnAtEdge: spawnAtEdge,
    spawnAt: spawnAt,
    spawnBoss: spawnBoss,
    damage: damage,
    update: update,
    draw: draw,
    updateEffects: updateEffects,
    drawEffects: drawEffects
  };
})();
