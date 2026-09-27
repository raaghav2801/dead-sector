// HUD and full-screen states, all drawn on the canvas in the same chunky
// monospace so nothing breaks the retro look.
(function () {
  'use strict';

  var U = GAME.Utils;

  function font(size, weight) {
    return (weight || 'bold') + ' ' + size + 'px "Courier New", Courier, monospace';
  }

  function text(ctx, str, x, y, size, color, align) {
    ctx.font = font(size);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000000';
    ctx.fillText(str, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  // Manual letter spacing: canvas letterSpacing is not reliable everywhere, and
  // wide tracking is most of what makes arcade titles feel like arcade titles.
  function spacedText(ctx, str, cx, y, size, color, spacing) {
    ctx.font = font(size);
    ctx.textAlign = 'left';
    var widths = [], total = 0;
    for (var i = 0; i < str.length; i++) {
      var w = ctx.measureText(str.charAt(i)).width;
      widths.push(w);
      total += w + spacing;
    }
    total -= spacing;
    var x = cx - total / 2;
    for (var j = 0; j < str.length; j++) {
      ctx.fillStyle = '#000000';
      ctx.fillText(str.charAt(j), x + 3, y + 3);
      ctx.fillStyle = color;
      ctx.fillText(str.charAt(j), x, y);
      x += widths[j] + spacing;
    }
  }

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(8, 6, 14, 0.72)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#2f2a48';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function bar(ctx, x, y, w, h, frac, fill, back) {
    ctx.fillStyle = back || '#1a1628';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  }

  function dim(ctx, world, amount) {
    ctx.fillStyle = 'rgba(6, 5, 12, ' + amount + ')';
    ctx.fillRect(0, 0, world.w, world.h);
  }

  function blink(t, rate) {
    return Math.sin(t * (rate || 5)) > -0.3;
  }

  // ---------------------------------------------------------------------- HUD

  function drawHUD(ctx, world) {
    var p = world.player;

    // Health, top-left.
    panel(ctx, 12, 12, 268, 52);
    text(ctx, 'HEALTH', 24, 34, 15, '#9a93b8');
    var hpColor = p.hp > 55 ? '#4fd96b' : (p.hp > 25 ? '#ffd166' : '#ff5a5a');
    bar(ctx, 24, 42, 190, 12, p.hp / p.maxHp, hpColor);
    text(ctx, Math.ceil(p.hp) + '', 268, 54, 17, '#e8e4ff', 'right');

    // Level / wave, top-centre.
    var mid = world.w / 2;
    text(ctx, 'LEVEL ' + (world.levelIndex + 1) + '  ' + world.levelDef.name,
         mid, 32, 17, '#cfc8ef', 'center');
    text(ctx, 'WAVE ' + GAME.Levels.waveLabel(world), mid, 54, 15, '#8d86ad', 'center');

    // Score, top-right.
    panel(ctx, world.w - 212, 12, 200, 52);
    text(ctx, 'SCORE', world.w - 200, 34, 15, '#9a93b8');
    text(ctx, pad(world.score, 6), world.w - 24, 54, 19, '#ffd166', 'right');

    drawWeaponStrip(ctx, world, p);

    if (world.boss && !world.boss.dying) drawBossBar(ctx, world);
    if (world.toast && world.toast.t > 0) {
      var a = Math.min(1, world.toast.t);
      ctx.globalAlpha = a;
      text(ctx, world.toast.text, mid, world.h - 92, 18, world.toast.color, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawWeaponStrip(ctx, world, p) {
    var list = GAME.Weapons.list;
    var y = world.h - 62;
    panel(ctx, 12, y, 340, 50);
    var x = 26;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      var owned = p.owned[w.id];
      var active = (i === p.weaponIndex);
      var color = !owned ? '#413b5c' : (active ? w.color : '#8d86ad');

      text(ctx, (i + 1) + '', x, y + 22, 14, active ? '#ffffff' : '#5d567e');
      text(ctx, owned ? shortName(w) : '----', x + 14, y + 22, 15, color);

      var ammoLabel;
      if (!owned) ammoLabel = 'LOCKED';
      else if (w.infinite) ammoLabel = 'INF';
      else ammoLabel = p.ammo[w.id] + '';
      text(ctx, ammoLabel, x + 14, y + 40, 14, owned ? '#cfc8ef' : '#413b5c');

      if (active) {
        ctx.fillStyle = w.color;
        ctx.fillRect(x + 12, y + 44, 62, 2);
      }
      x += 104;
    }
  }

  function shortName(w) {
    if (w.id === 'smg') return 'M-GUN';
    return w.name;
  }

  function drawBossBar(ctx, world) {
    var b = world.boss;
    var w = 420, x = (world.w - w) / 2, y = 78;
    text(ctx, 'HEAVY UNIT', world.w / 2, y - 6, 15, '#ffd166', 'center');
    bar(ctx, x, y, w, 14, b.hp / b.maxHp, '#b8323c', '#2a1020');
  }

  function pad(n, len) {
    var s = '' + n;
    while (s.length < len) s = '0' + s;
    return s;
  }

  // Stage beat announcements in the middle of the arena.
  function drawBanner(ctx, world) {
    var b = GAME.Levels.banner(world);
    if (!b) return;
    var cy = world.h / 2 - 40;
    spacedText(ctx, b.big, world.w / 2, cy, 46, '#ffffff', 8);
    if (b.small) text(ctx, b.small, world.w / 2, cy + 34, 20, '#ffd166', 'center');
  }

  function drawCrosshair(ctx, world) {
    var m = GAME.Input.mouse;
    var color = GAME.Weapons.list[world.player.weaponIndex].color;
    var x = Math.round(m.x), y = Math.round(m.y);
    ctx.fillStyle = color;
    ctx.fillRect(x - 11, y - 1, 7, 2);
    ctx.fillRect(x + 5, y - 1, 7, 2);
    ctx.fillRect(x - 1, y - 11, 2, 7);
    ctx.fillRect(x - 1, y + 5, 2, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  // ------------------------------------------------------------------ screens

  var CONTROLS = [
    'ARROW KEYS / WASD     MOVE',
    'MOUSE                 AIM',
    'LEFT CLICK  (HOLD)    SHOOT',
    '1  2  3   or  Q       SWITCH WEAPON',
    'P                     PAUSE'
  ];

  function drawMenu(ctx, world, t) {
    dim(ctx, world, 0.55);
    spacedText(ctx, 'DEAD SECTOR', world.w / 2, 168, 64, '#ff5a5a', 12);
    text(ctx, 'A TOP-DOWN SURVIVAL SHOOT-OUT IN FIVE SECTORS',
         world.w / 2, 206, 18, '#cfc8ef', 'center');

    panel(ctx, world.w / 2 - 230, 250, 460, 168);
    for (var i = 0; i < CONTROLS.length; i++) {
      text(ctx, CONTROLS[i], world.w / 2 - 206, 286 + i * 28, 17, '#9a93b8');
    }

    if (blink(t, 4)) {
      text(ctx, 'CLICK  or  PRESS ENTER  TO DEPLOY',
           world.w / 2, 474, 22, '#ffd166', 'center');
    }
    text(ctx, 'FIVE LEVELS - THREE WAVES AND A HEAVY UNIT EACH',
         world.w / 2, 522, 15, '#6f688f', 'center');
  }

  function drawLevelComplete(ctx, world, t) {
    dim(ctx, world, 0.7);
    spacedText(ctx, 'LEVEL ' + (world.levelIndex + 1) + ' CLEARED',
               world.w / 2, 210, 46, '#4fd96b', 8);
    text(ctx, 'SCORE  ' + pad(world.score, 6), world.w / 2, 262, 22, '#ffd166', 'center');
    text(ctx, 'HEALTH RESTORED TO ' + Math.ceil(world.player.hp),
         world.w / 2, 296, 17, '#9a93b8', 'center');

    if (world.unlockMessage) {
      text(ctx, world.unlockMessage, world.w / 2, 344, 22, '#8ef0ff', 'center');
    }

    var next = world.levelIndex + 2;
    text(ctx, 'NEXT  -  LEVEL ' + next + '  ' + GAME.Levels.list[world.levelIndex + 1].name,
         world.w / 2, 400, 20, '#cfc8ef', 'center');
    if (blink(t, 4)) {
      text(ctx, 'PRESS ENTER TO CONTINUE', world.w / 2, 452, 20, '#ffd166', 'center');
    }
  }

  function drawGameOver(ctx, world, t) {
    dim(ctx, world, 0.74);
    spacedText(ctx, 'YOU DIED', world.w / 2, 226, 60, '#ff5a5a', 12);
    text(ctx, 'REACHED LEVEL ' + (world.levelIndex + 1) + '  ' + world.levelDef.name,
         world.w / 2, 278, 20, '#cfc8ef', 'center');
    text(ctx, 'FINAL SCORE  ' + pad(world.score, 6), world.w / 2, 320, 24, '#ffd166', 'center');
    if (blink(t, 4)) {
      text(ctx, 'PRESS ENTER TO TRY AGAIN', world.w / 2, 400, 21, '#ffffff', 'center');
    }
    text(ctx, 'PRESS ESC FOR THE MENU', world.w / 2, 440, 16, '#6f688f', 'center');
  }

  function drawVictory(ctx, world, t) {
    dim(ctx, world, 0.74);
    spacedText(ctx, 'SECTOR PURGED', world.w / 2, 210, 54, '#4fd96b', 10);
    text(ctx, 'ALL FIVE LEVELS CLEARED', world.w / 2, 258, 22, '#cfc8ef', 'center');
    text(ctx, 'FINAL SCORE  ' + pad(world.score, 6), world.w / 2, 306, 26, '#ffd166', 'center');
    if (blink(t, 4)) {
      text(ctx, 'PRESS ENTER TO PLAY AGAIN', world.w / 2, 388, 21, '#ffffff', 'center');
    }
    text(ctx, 'PRESS ESC FOR THE MENU', world.w / 2, 428, 16, '#6f688f', 'center');
  }

  function drawPaused(ctx, world) {
    dim(ctx, world, 0.6);
    spacedText(ctx, 'PAUSED', world.w / 2, world.h / 2 - 10, 50, '#ffffff', 10);
    text(ctx, 'PRESS P TO RESUME', world.w / 2, world.h / 2 + 34, 19, '#ffd166', 'center');
  }

  GAME.UI = {
    drawHUD: drawHUD,
    drawBanner: drawBanner,
    drawCrosshair: drawCrosshair,
    drawMenu: drawMenu,
    drawLevelComplete: drawLevelComplete,
    drawGameOver: drawGameOver,
    drawVictory: drawVictory,
    drawPaused: drawPaused
  };
})();
