// Pixel art lives here as character grids plus a shared palette. Each frame is
// baked once into an offscreen canvas at load, so drawing costs one drawImage.
// Every sprite is authored FACING RIGHT (+x); draw() rotates it to aim.
(function () {
  'use strict';

  var PALETTE = {
    '.': null,              // transparent
    'K': '#0d0b14',         // outline / near-black
    'W': '#e8f0ff',         // highlight white
    // player
    'S': '#f2c18a',         // skin
    'H': '#6b4a35',         // hair (top-down, so it covers most of the head)
    'J': '#3a7fbd',         // jacket
    'j': '#23547e',         // jacket shadow
    'G': '#7d8796',         // gun metal
    'g': '#454c5a',         // gun shadow
    'B': '#7a5230',         // boot
    // grunt
    'Z': '#5f9e4a',
    'z': '#3d6b2f',
    'C': '#ded8c0',         // claw / bone
    'E': '#ff4a4a',         // glowing eye
    // runner
    'R': '#d24b3a',
    'r': '#8f2f22',
    'Y': '#f0a020',
    // brute
    'P': '#8b4fa8',
    'p': '#5c3070',
    'M': '#d8a8e8',
    // spitter
    'Q': '#c8d040',
    'q': '#7d8520',
    'O': '#241708'          // mouth
  };

  // Recolour maps let one grid serve as a second creature (used for the boss).
  var BOSS_TINT = {
    'P': '#b8323c', 'p': '#6e1520', 'M': '#ffd166',
    'C': '#ffd166', 'E': '#ffe9a0', 'K': '#160509'
  };

  // ---------------------------------------------------------------- pixel data
  //
  // Two rules keep these readable at 3x: the darker shade of a creature sits at
  // its BACK rather than its middle (a dark centre reads as a hole), and every
  // feature that has to be seen - eye, claw, gun - is at least two pixels thick.

  // 22x16, wider than tall so the gun reads as a gun. Seen from above: hair
  // fills the skull, skin shows at the face and on both hands, and the barrel
  // runs forward past the body.
  var PLAYER_IDLE = [
    '......................',
    '......................',
    '......KKKKKKK.........',
    '.....KJJJJJJJK........',
    '....KjJJJJJJJJK.......',
    '....KjJJHHHHJJK.......',
    '....KjJHHHHSSJKjSKKKK.',
    '....KjJHHHHHSGGGGGGGGK',
    '....KjJHHHHHSggggggggK',
    '....KjJHHHHSSJKjSKKKK.',
    '....KjJJHHHHJJK.......',
    '....KjJJJJJJJJK.......',
    '.....KJJJJJJJK........',
    '......KKKKKKK.........',
    '......................',
    '......................'
  ];

  // Walk cycle: a boot swings out behind on alternating sides while the gun
  // stays locked forward, which reads as a stride when seen from above.
  var PLAYER_WALK_A = PLAYER_IDLE.slice();
  PLAYER_WALK_A[5] = '..BBKjJJHHHHJJK.......';
  PLAYER_WALK_A[6] = '..BBKjJHHHHSSJKjSKKKK.';

  var PLAYER_WALK_B = PLAYER_IDLE.slice();
  PLAYER_WALK_B[9] = '..BBKjJHHHHSSJKjSKKKK.';
  PLAYER_WALK_B[10] = '..BBKjJJHHHHJJK.......';

  // 16x14 shambler: two stacked eye clusters at the front, rotting shading down
  // the back, claws that snap forward on frame 2 into a lunge.
  var GRUNT_A = [
    '................',
    '....KKKKKK......',
    '...KzzZZZZZK....',
    '..KzzzZZZZZZK...',
    '..KzzzZZZEEZK...',
    '..KzzzZZZEEZKC..',
    '..KzzzZZZZZZK...',
    '..KzzzZZZEEZK...',
    '..KzzzZZZEEZKC..',
    '..KzzzZZZZZZK...',
    '...KzzZZZZZK....',
    '....KKKKKK......',
    '................',
    '................'
  ];
  var GRUNT_B = GRUNT_A.slice();
  GRUNT_B[5] = '..KzzzZZZEEZK.CC';
  GRUNT_B[8] = '..KzzzZZZEEZK.CC';

  // 14x12 sprinter: smaller, leaner, with a motion streak on frame 2.
  var RUNNER_A = [
    '..............',
    '....KKKKK.....',
    '...KrrRRRRK...',
    '..KrrRRRRRK...',
    '..KrrRREERK...',
    '..KrrRREERKC..',
    '..KrrRRRRRK...',
    '..KrrRREERKC..',
    '..KrrRREERK...',
    '...KrrRRRRK...',
    '....KKKKK.....',
    '..............'
  ];
  var RUNNER_B = RUNNER_A.slice();
  RUNNER_B[3] = '..KrrRRRRRK.Y.';
  RUNNER_B[5] = '..KrrRREERK.CC';
  RUNNER_B[7] = '..KrrRREERK.CC';
  RUNNER_B[9] = '...KrrRRRRK.Y.';

  // 16x14 ranged spitter: a wide dark maw at the front, with a glob of acid
  // already forming in front of it on frame 2.
  var SPITTER_A = [
    '................',
    '....KKKKKK......',
    '...KqqQQQQQK....',
    '..KqqqQQQQEQK...',
    '..KqqqQQQQQQK...',
    '..KqqqQQQOOOK...',
    '..KqqqQQQOOOK...',
    '..KqqqQQQOOOK...',
    '..KqqqQQQQQQK...',
    '..KqqqQQQQEQK...',
    '...KqqQQQQQK....',
    '....KKKKKK......',
    '................',
    '................'
  ];
  var SPITTER_B = SPITTER_A.slice();
  SPITTER_B[5] = '..KqqqQQQOOOK.Q.';
  SPITTER_B[6] = '..KqqqQQQOOOK.QQ';
  SPITTER_B[7] = '..KqqqQQQOOOK.Q.';

  // 20x20 heavy: big eye clusters front, bone spikes down the back. Doubles as
  // the boss silhouette via BOSS_TINT at a much larger scale.
  var BRUTE_A = [
    '....................',
    '....................',
    '......KKKKKKKK......',
    '....KpppPPPPPPPK....',
    '...KppppPPPPPPPPK...',
    '..KpppppPPPPPPPPPK..',
    '..KpppppPPPPPPPPPK..',
    '..KpppppPPPPPEEEPK..',
    '..KpppppPPPPPEEEPK..',
    '.CKpppppPPPPPEEEPK..',
    '.CKpppppPPPPPPMMPK..',
    '.CKpppppPPPPPPMMPK..',
    '.CKpppppPPPPPEEEPK..',
    '..KpppppPPPPPEEEPK..',
    '..KpppppPPPPPEEEPK..',
    '..KpppppPPPPPPPPPK..',
    '...KppppPPPPPPPPK...',
    '....KpppPPPPPPPK....',
    '......KKKKKKKK......',
    '....................'
  ];
  var BRUTE_B = BRUTE_A.slice();
  BRUTE_B[9] = 'CCKpppppPPPPPEEEPK..';
  BRUTE_B[10] = 'CCKpppppPPPPPPMMPKC.';
  BRUTE_B[11] = 'CCKpppppPPPPPPMMPKC.';
  BRUTE_B[12] = 'CCKpppppPPPPPEEEPK..';

  // 10x10 pickups, gently pulsing.
  var HEALTH_A = [
    '..........',
    '.KKKKKKKK.',
    '.KRRWWRRK.',
    '.KRRWWRRK.',
    '.KWWWWWWK.',
    '.KWWWWWWK.',
    '.KRRWWRRK.',
    '.KRRWWRRK.',
    '.KKKKKKKK.',
    '..........'
  ];
  var HEALTH_B = HEALTH_A.slice();
  HEALTH_B[2] = '.KrrWWrrK.';
  HEALTH_B[7] = '.KrrWWrrK.';

  var AMMO_A = [
    '..........',
    '.KKKKKKKK.',
    '.KgGGGGgK.',
    '.KGYYYYGK.',
    '.KGYggYGK.',
    '.KGYggYGK.',
    '.KGYYYYGK.',
    '.KgGGGGgK.',
    '.KKKKKKKK.',
    '..........'
  ];
  var AMMO_B = AMMO_A.slice();
  AMMO_B[3] = '.KGYWWYGK.';
  AMMO_B[6] = '.KGYWWYGK.';

  // ------------------------------------------------------------------- baking

  function bake(rows, scale, tint) {
    var w = rows[0].length, h = rows.length;
    var c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    var g = c.getContext('2d');
    for (var y = 0; y < h; y++) {
      var row = rows[y];
      for (var x = 0; x < row.length; x++) {
        var ch = row.charAt(x);
        var col = (tint && tint[ch]) || PALETTE[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(Math.round(x * scale), Math.round(y * scale),
                   Math.ceil(scale), Math.ceil(scale));
      }
    }
    return c;
  }

  // A sprite is just baked frames plus the playback rate for its animation.
  function makeSprite(frameGrids, scale, fps, tint) {
    var frames = [];
    for (var i = 0; i < frameGrids.length; i++) {
      frames.push(bake(frameGrids[i], scale, tint));
    }
    return {
      frames: frames,
      fps: fps,
      w: frames[0].width,
      h: frames[0].height
    };
  }

  var SCALE = 3;

  function init() {
    GAME.Sprites.sheet = {
      playerIdle: makeSprite([PLAYER_IDLE], SCALE, 1),
      playerWalk: makeSprite([PLAYER_WALK_A, PLAYER_IDLE, PLAYER_WALK_B, PLAYER_IDLE], SCALE, 9),
      grunt: makeSprite([GRUNT_A, GRUNT_B], SCALE, 5),
      runner: makeSprite([RUNNER_A, RUNNER_B], SCALE, 13),
      brute: makeSprite([BRUTE_A, BRUTE_B], SCALE, 4),
      spitter: makeSprite([SPITTER_A, SPITTER_B], SCALE, 6),
      boss: makeSprite([BRUTE_A, BRUTE_B], SCALE * 2.2, 3, BOSS_TINT),
      health: makeSprite([HEALTH_A, HEALTH_B], 2.4, 3),
      ammo: makeSprite([AMMO_A, AMMO_B], 2.4, 3)
    };
  }

  // Pick a frame from a sprite given an accumulated animation time in seconds.
  function frameAt(sprite, t) {
    var n = sprite.frames.length;
    if (n === 1) return sprite.frames[0];
    return sprite.frames[Math.floor(t * sprite.fps) % n];
  }

  // Rotated blit around the sprite centre. Position is rounded so the pixel
  // grid does not shimmer as things move sub-pixel distances.
  function draw(ctx, sprite, t, x, y, angle, alpha, scaleMul) {
    var img = frameAt(sprite, t);
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (angle) ctx.rotate(angle);
    if (scaleMul && scaleMul !== 1) ctx.scale(scaleMul, scaleMul);
    ctx.drawImage(img, Math.round(-img.width / 2), Math.round(-img.height / 2));
    ctx.restore();
  }

  GAME.Sprites = {
    init: init,
    draw: draw,
    frameAt: frameAt,
    palette: PALETTE,
    scale: SCALE,
    sheet: null
  };
})();
