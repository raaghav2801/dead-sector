// Keyboard + mouse state. Mouse position is converted into canvas-space pixels
// so aiming stays correct no matter how much CSS scales the canvas up.
(function () {
  'use strict';

  var down = {};        // held keys, by normalized name
  var pressed = {};     // keys that went down this frame, cleared by endFrame()
  var mouse = { x: 480, y: 320, down: false, pressed: false };

  var canvas = null;

  function normalizeKey(e) {
    var k = e.key;
    if (k === ' ') return 'space';
    if (k.length === 1) return k.toLowerCase();
    return k;
  }

  function attach(cnv) {
    canvas = cnv;

    window.addEventListener('keydown', function (e) {
      var k = normalizeKey(e);
      // Arrows and space scroll the page, Tab moves focus off the canvas.
      if (k.indexOf('Arrow') === 0 || k === 'space' || k === 'Tab') e.preventDefault();
      if (!down[k]) pressed[k] = true;
      down[k] = true;
    });

    window.addEventListener('keyup', function (e) {
      down[normalizeKey(e)] = false;
    });

    // Losing focus mid-hold would otherwise leave keys stuck down forever.
    window.addEventListener('blur', function () {
      down = {};
      mouse.down = false;
    });

    canvas.addEventListener('mousemove', updateMouse);

    canvas.addEventListener('mousedown', function (e) {
      updateMouse(e);
      if (!mouse.down) mouse.pressed = true;
      mouse.down = true;
      e.preventDefault();
    });

    window.addEventListener('mouseup', function () {
      mouse.down = false;
    });

    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
  }

  function updateMouse(e) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  }

  function isDown() {
    for (var i = 0; i < arguments.length; i++) {
      if (down[arguments[i]]) return true;
    }
    return false;
  }

  function wasPressed() {
    for (var i = 0; i < arguments.length; i++) {
      if (pressed[arguments[i]]) return true;
    }
    return false;
  }

  // Call once per frame, after all update() work has read the latches.
  function endFrame() {
    pressed = {};
    mouse.pressed = false;
  }

  GAME.Input = {
    attach: attach,
    isDown: isDown,
    wasPressed: wasPressed,
    endFrame: endFrame,
    mouse: mouse
  };
})();
