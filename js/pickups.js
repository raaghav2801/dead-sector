// Health and ammo drops. They bob in place and drift toward the player once
// they are close, so clearing a room feels like collecting the reward.
(function () {
  'use strict';

  var U = GAME.Utils;
  var MAGNET_RANGE = 96;

  function spawn(world, x, y, kind) {
    world.pickups.push({
      x: x,
      y: y,
      r: 13,
      kind: kind,
      t: Math.random() * 3,
      life: 16
    });
  }

  // Called when an enemy dies. Later levels lean more on ammo than health.
  function maybeDrop(world, x, y, chance) {
    if (Math.random() > chance) return;
    var wantsHealth = world.player && world.player.hp < world.player.maxHp * 0.65;
    var kind;
    if (wantsHealth) {
      kind = Math.random() < 0.6 ? 'health' : 'ammo';
    } else {
      kind = Math.random() < 0.28 ? 'health' : 'ammo';
    }
    // An ammo box is useless before any ammo-using gun is unlocked.
    if (kind === 'ammo' && !hasAmmoWeapon(world.player)) kind = 'health';
    spawn(world, x, y, kind);
  }

  function hasAmmoWeapon(player) {
    if (!player) return false;
    var list = GAME.Weapons.list;
    for (var i = 0; i < list.length; i++) {
      if (!list[i].infinite && player.owned[list[i].id]) return true;
    }
    return false;
  }

  // Top up whichever unlocked gun is emptiest, as a fraction of its capacity.
  function giveAmmo(player) {
    var list = GAME.Weapons.list;
    var best = null, bestFrac = 2;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w.infinite || !player.owned[w.id]) continue;
      var frac = player.ammo[w.id] / w.maxAmmo;
      if (frac < bestFrac) {
        bestFrac = frac;
        best = w;
      }
    }
    if (!best) return null;
    player.ammo[best.id] = Math.min(best.maxAmmo, player.ammo[best.id] + best.pickupAmount);
    return best;
  }

  function update(world, dt) {
    var p = world.player;
    for (var i = 0; i < world.pickups.length; i++) {
      var pk = world.pickups[i];
      pk.t += dt;
      pk.life -= dt;

      if (p && p.alive) {
        var d = U.dist(pk.x, pk.y, p.x, p.y);
        if (d < MAGNET_RANGE) {
          var pull = (1 - d / MAGNET_RANGE) * 260 * dt;
          pk.x += ((p.x - pk.x) / (d || 1)) * pull;
          pk.y += ((p.y - pk.y) / (d || 1)) * pull;
        }
        if (U.circleHit(pk, p)) {
          collect(world, p, pk);
          pk.dead = true;
          continue;
        }
      }
      if (pk.life <= 0) pk.dead = true;
    }
    U.pruneList(world.pickups, function (x) { return x.dead; });
  }

  function collect(world, player, pk) {
    if (pk.kind === 'health') {
      player.hp = Math.min(player.maxHp, player.hp + 25);
      world.toast = { text: '+25 HEALTH', t: 1.2, color: '#ff7a7a' };
    } else {
      var w = giveAmmo(player);
      if (w) world.toast = { text: '+' + w.pickupAmount + ' ' + w.name, t: 1.2, color: '#8ef0ff' };
    }
  }

  function draw(ctx, world) {
    var sheet = GAME.Sprites.sheet;
    for (var i = 0; i < world.pickups.length; i++) {
      var pk = world.pickups[i];
      var sprite = pk.kind === 'health' ? sheet.health : sheet.ammo;
      var bob = Math.sin(pk.t * 4) * 3;
      // Blink out over the last two seconds so its expiry is readable.
      var alpha = pk.life < 2 ? (0.3 + 0.7 * Math.abs(Math.sin(pk.life * 9))) : 1;

      // Soft glow pad underneath.
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillStyle = pk.kind === 'health' ? '#d24b3a' : '#f0a020';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + 6, 13 + Math.sin(pk.t * 4) * 2, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      GAME.Sprites.draw(ctx, sprite, pk.t, pk.x, pk.y + bob, 0, alpha);
    }
  }

  GAME.Pickups = {
    spawn: spawn,
    maybeDrop: maybeDrop,
    giveAmmo: giveAmmo,
    update: update,
    draw: draw
  };
})();
