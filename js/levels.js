// Level definitions and the wave scheduler that drives a run.
(function () {
  'use strict';

  var U = GAME.Utils;

  var LEVELS = [
    {
      name: 'OUTER YARD',
      mult: { hp: 1.0, speed: 1.0 },
      waves: [
        { grunt: 6 },
        { grunt: 8 },
        { grunt: 6, runner: 3 }
      ],
      boss: { hp: 60, speed: 1.0 }
    },
    {
      name: 'RUST ALLEY',
      unlock: 'shotgun',
      mult: { hp: 1.15, speed: 1.06 },
      waves: [
        { grunt: 8, runner: 3 },
        { runner: 8 },
        { grunt: 10, runner: 5 }
      ],
      boss: { hp: 95, speed: 1.05 }
    },
    {
      name: 'IRON DEPOT',
      unlock: 'smg',
      mult: { hp: 1.3, speed: 1.12 },
      waves: [
        { grunt: 8, brute: 2 },
        { runner: 8, brute: 2 },
        { grunt: 10, runner: 5, brute: 3 }
      ],
      boss: { hp: 140, speed: 1.1 }
    },
    {
      name: 'ACID WORKS',
      mult: { hp: 1.5, speed: 1.18 },
      waves: [
        { grunt: 9, spitter: 3 },
        { runner: 8, spitter: 5 },
        { grunt: 8, brute: 3, spitter: 4 }
      ],
      boss: { hp: 190, speed: 1.15 }
    },
    {
      name: 'THE CORE',
      mult: { hp: 1.75, speed: 1.25 },
      waves: [
        { runner: 10, spitter: 4 },
        { grunt: 12, brute: 4 },
        { runner: 10, brute: 4, spitter: 5 }
      ],
      boss: { hp: 260, speed: 1.2 }
    }
  ];

  var SPAWN_INTERVAL = 0.22;

  // Flatten { grunt: 3, runner: 2 } into a shuffled list, so types and edges
  // interleave instead of arriving in neat blocks.
  function buildQueue(waveDef) {
    var q = [];
    for (var type in waveDef) {
      if (!Object.prototype.hasOwnProperty.call(waveDef, type)) continue;
      for (var i = 0; i < waveDef[type]; i++) q.push(type);
    }
    for (var j = q.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = q[j];
      q[j] = q[k];
      q[k] = tmp;
    }
    return q;
  }

  function startLevel(world, index) {
    var def = LEVELS[index];
    world.levelIndex = index;
    world.levelDef = def;
    world.mult = def.mult;
    world.enemies.length = 0;
    world.bullets.length = 0;
    world.enemyBullets.length = 0;
    world.pickups.length = 0;
    world.effects.length = 0;
    world.boss = null;
    world.bossDefeated = false;
    world.levelComplete = false;
    world.stage = {
      phase: 'intro',
      timer: 1.9,
      waveIndex: 0,
      queue: [],
      spawnTimer: 0
    };

    // main.js owns the "weapon acquired" announcement; this just grants the gun.
    world.unlockMessage = null;
    if (def.unlock) GAME.Player.unlock(world.player, def.unlock);
  }

  function aliveCount(world) {
    var n = 0;
    for (var i = 0; i < world.enemies.length; i++) {
      if (!world.enemies[i].dying) n++;
    }
    return n;
  }

  function totalWaves(world) {
    return world.levelDef.waves.length;
  }

  function beginWave(world, index) {
    var s = world.stage;
    s.phase = 'wave';
    s.waveIndex = index;
    s.queue = buildQueue(world.levelDef.waves[index]);
    s.spawnTimer = 0;
  }

  function update(world, dt) {
    var s = world.stage;
    s.timer -= dt;

    if (s.phase === 'intro') {
      if (s.timer <= 0) beginWave(world, 0);

    } else if (s.phase === 'wave') {
      s.spawnTimer -= dt;
      if (s.queue.length && s.spawnTimer <= 0) {
        GAME.Enemies.spawnAtEdge(world, s.queue.pop(), world.mult);
        s.spawnTimer = SPAWN_INTERVAL;
      }
      if (!s.queue.length && aliveCount(world) === 0) {
        if (s.waveIndex + 1 < totalWaves(world)) {
          s.phase = 'breather';
          s.timer = 1.8;
        } else {
          s.phase = 'bossIntro';
          s.timer = 1.7;
        }
      }

    } else if (s.phase === 'breather') {
      if (s.timer <= 0) beginWave(world, s.waveIndex + 1);

    } else if (s.phase === 'bossIntro') {
      if (s.timer <= 0) {
        GAME.Enemies.spawnBoss(world, world.levelDef.boss);
        s.phase = 'boss';
        s.timer = 0;
      }

    } else if (s.phase === 'boss') {
      if (world.bossDefeated) {
        // The boss going down takes its escort with it.
        for (var i = 0; i < world.enemies.length; i++) {
          var e = world.enemies[i];
          if (!e.dying) GAME.Enemies.damage(world, e, 9999, 0, -1);
        }
        s.phase = 'cleared';
        s.timer = 1.1;
      }

    } else if (s.phase === 'cleared') {
      if (s.timer <= 0) world.levelComplete = true;
    }
  }

  // Text shown across the middle of the arena for the current stage beat.
  function banner(world) {
    var s = world.stage;
    if (s.phase === 'intro') {
      return { big: 'LEVEL ' + (world.levelIndex + 1), small: world.levelDef.name };
    }
    if (s.phase === 'breather') {
      return { big: 'WAVE CLEARED', small: 'NEXT WAVE INCOMING' };
    }
    if (s.phase === 'bossIntro') {
      return { big: 'WARNING', small: 'HEAVY UNIT APPROACHING' };
    }
    if (s.phase === 'cleared') {
      return { big: 'SECTOR CLEAR', small: null };
    }
    return null;
  }

  function waveLabel(world) {
    var s = world.stage;
    if (s.phase === 'boss' || s.phase === 'bossIntro' || s.phase === 'cleared') return 'BOSS';
    return (s.waveIndex + 1) + '/' + totalWaves(world);
  }

  GAME.Levels = {
    list: LEVELS,
    count: LEVELS.length,
    startLevel: startLevel,
    update: update,
    banner: banner,
    waveLabel: waveLabel,
    aliveCount: aliveCount
  };
})();
