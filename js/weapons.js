// One table so every gun can be tuned from a single place.
(function () {
  'use strict';

  var WEAPONS = [
    {
      id: 'pistol',
      name: 'PISTOL',
      damage: 2,
      cooldown: 0.20,
      pellets: 1,
      spread: 0.012,
      speed: 640,
      infinite: true,
      pickupAmount: 0,
      color: '#ffe066',
      trail: 11,
      width: 3,
      kick: 40
    },
    {
      id: 'shotgun',
      name: 'SHOTGUN',
      damage: 2,
      cooldown: 0.60,
      pellets: 6,
      spread: 0.27,
      speed: 560,
      infinite: false,
      startAmmo: 24,
      maxAmmo: 60,
      pickupAmount: 8,
      color: '#ffb347',
      trail: 9,
      width: 3,
      kick: 150
    },
    {
      id: 'smg',
      name: 'MACHINE GUN',
      damage: 1.5,
      cooldown: 0.072,
      pellets: 1,
      spread: 0.075,
      speed: 720,
      infinite: false,
      startAmmo: 140,
      maxAmmo: 300,
      pickupAmount: 45,
      color: '#8ef0ff',
      trail: 14,
      width: 2,
      kick: 26
    }
  ];

  function indexOfId(id) {
    for (var i = 0; i < WEAPONS.length; i++) {
      if (WEAPONS[i].id === id) return i;
    }
    return -1;
  }

  GAME.Weapons = {
    list: WEAPONS,
    indexOfId: indexOfId
  };
})();
