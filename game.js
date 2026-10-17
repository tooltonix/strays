// Strays – an independent rebuild based on SPEC.md (clean room).
// Only the speed rule is borrowed; everything else is an original design.
(() => {
  'use strict';

  // --- Rule from the analysis (SPEC.md, section "Borrowed rule") ---
  const RULE = { start: 6, incrementPerStep: 0.001, maximum: 13 };
  const STEP_MS = 1000 / 60; // fixed tick, independent of the display refresh rate

  // --- Freely chosen game values ---
  const WIDTH = 720;
  const HEIGHT = 200;
  const GROUND_Y = 170;
  const GRAVITY = 0.6;
  const JUMP_VELOCITY = -11;
  const SHORT_JUMP_GRAVITY = 2; // factor once the jump input is released while rising
  const FAST_FALL_GRAVITY = 3; // factor after ↓ in the air, until landing
  const DUCK = { width: 40, height: 14 }; // the cat's size while ducking
  const COLORS = {
    cat: '#f2eee9', box: '#c98a4b', edge: '#ab4b08', ground: '#ab4b08', text: '#f2eee9', accent: '#ff6b01',
    pigeon: '#a7a9b4', wing: '#7d8090', dim: 'rgba(27, 27, 27, 0.6)',
  };
  // Obstacle types, unlocked by the current speed (specs/08-obstacles.md)
  const OBSTACLE_TYPES = [
    { type: 'box', from: 0, weight: 2 },
    { type: 'stack', from: 7, weight: 1 },
    { type: 'row', from: 8, weight: 1 },
    { type: 'pigeon', from: 9, weight: 1 },
  ];
  const PIGEON_LIFTS = [6, 20]; // space under the bird: low means jump, high means duck
  const HIGH_SCORE_KEY = 'strays.highScore';

  const playfield = document.getElementById('playfield');
  const ctx = playfield.getContext('2d');
  const slider = document.getElementById('slider');
  const readout = document.getElementById('readout');
  const gauge = document.getElementById('gauge');
  const status = document.getElementById('status');

  const state = {
    phase: 'ready', // ready | running | paused | over
    speed: RULE.start,
    startSpeed: RULE.start,
    score: 0,
    highScore: loadHighScore(),
    newRecord: false,
    cat: { x: 60, y: GROUND_Y, vy: 0, width: 34, height: 26, fastFall: false },
    jumpHeld: false, // Space, ↑ or a pointer is held down
    duckHeld: false, // ↓ is held down
    obstacles: [],
    lastType: 'box',
    seenTypes: new Set(),
    distanceToNext: 0,
    groundOffset: 0,
  };

  // --- Simulation ---
  function restart() {
    state.phase = 'running';
    state.speed = state.startSpeed;
    state.score = 0;
    state.newRecord = false;
    state.obstacles = [];
    state.lastType = 'box';
    state.seenTypes = new Set();
    state.distanceToNext = 300;
    state.cat.y = GROUND_Y;
    state.cat.vy = 0;
    state.cat.fastFall = false;
    announce('Running.');
  }

  function jump() {
    if (state.phase === 'paused') {
      resume(); // resuming does not also jump
      return;
    }
    if (state.phase !== 'running') {
      restart();
      return;
    }
    if (state.cat.y >= GROUND_Y) state.cat.vy = JUMP_VELOCITY;
  }

  function fastFall() {
    if (state.phase === 'running' && state.cat.y < GROUND_Y) state.cat.fastFall = true;
  }

  function isDucking() {
    return state.duckHeld && state.cat.y === GROUND_Y;
  }

  function pickType() {
    // After any of the harder types comes a plain box, so two of them never follow each other
    if (state.lastType !== 'box') return 'box';
    const open = OBSTACLE_TYPES.filter((option) => state.speed >= option.from);
    let roll = Math.random() * open.reduce((sum, option) => sum + option.weight, 0);
    for (const option of open) {
      roll -= option.weight;
      if (roll < 0) return option.type;
    }
    return 'box';
  }

  // An obstacle is one hitbox (x, width, height, lift above the ground); boxes are drawn from parts
  function makeObstacle(type) {
    const pick = (options) => options[Math.floor(Math.random() * options.length)];
    if (type === 'stack') {
      const height = pick([20, 23]);
      const parts = [{ dx: 0, dy: 0, width: 26, height }, { dx: 3, dy: height, width: 20, height }];
      return { type, x: WIDTH, width: 26, height: height * 2, lift: 0, parts };
    }
    if (type === 'row') {
      const count = pick([2, 3]);
      const height = pick([22, 30]);
      const parts = Array.from({ length: count }, (_, i) => ({ dx: i * 20, dy: 0, width: 20, height }));
      return { type, x: WIDTH, width: count * 20, height, lift: 0, parts };
    }
    if (type === 'pigeon') {
      return { type, x: WIDTH, width: 30, height: 14, lift: pick(PIGEON_LIFTS), parts: [] };
    }
    const width = pick([18, 28, 38]);
    const height = pick([22, 30, 38]);
    return { type: 'box', x: WIDTH, width, height, lift: 0, parts: [{ dx: 0, dy: 0, width, height }] };
  }

  function step() {
    const cat = state.cat;
    // Variable jump height: letting go while rising pulls the cat down sooner
    let gravity = GRAVITY;
    if (cat.fastFall) gravity *= FAST_FALL_GRAVITY;
    else if (cat.vy < 0 && !state.jumpHeld) gravity *= SHORT_JUMP_GRAVITY;
    cat.vy += gravity;
    cat.y = Math.min(GROUND_Y, cat.y + cat.vy);
    if (cat.y === GROUND_Y) {
      cat.vy = 0;
      cat.fastFall = false;
    }

    for (const obstacle of state.obstacles) obstacle.x -= state.speed;
    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0);

    state.distanceToNext -= state.speed;
    if (state.distanceToNext <= 0) {
      const obstacle = makeObstacle(pickType());
      state.obstacles.push(obstacle);
      state.lastType = obstacle.type;
      state.seenTypes.add(obstacle.type);
      // The gap starts behind the obstacle and grows with the speed, so every sequence stays clearable
      state.distanceToNext = obstacle.width + state.speed * (45 + Math.random() * 50);
    }

    if (collides()) {
      state.phase = 'over';
      const points = Math.floor(state.score);
      // The best score only changes on game over, so the numbers don't jump around while running
      state.newRecord = points > state.highScore;
      if (state.newRecord) {
        state.highScore = points;
        saveHighScore(points);
      }
      const verdict = state.newRecord ? 'New record!' : 'Ouch!';
      announce(`${verdict} ${points} points at speed ${state.speed.toFixed(3)}. Jump to restart.`);
      return;
    }

    // Rule 2: increase only without a collision and only below the maximum
    if (state.speed < RULE.maximum) state.speed += RULE.incrementPerStep;

    state.score += state.speed / 10;
    state.groundOffset = (state.groundOffset + state.speed) % 24;
  }

  function collides() {
    const cat = state.cat;
    const margin = 4; // a little forgiveness at the edges
    const ducking = isDucking();
    const catLeft = cat.x + margin;
    const catRight = cat.x + (ducking ? DUCK.width : cat.width) - margin;
    const catTop = cat.y - (ducking ? DUCK.height : cat.height) + margin;
    const catBottom = cat.y - margin;
    // Full rectangle overlap: flying obstacles can be passed underneath
    return state.obstacles.some((obstacle) => {
      const bottom = GROUND_Y - obstacle.lift;
      const top = bottom - obstacle.height;
      return catRight > obstacle.x && catLeft < obstacle.x + obstacle.width && catBottom > top && catTop < bottom;
    });
  }

  // --- High score (optional storage: the game works the same without it) ---
  function loadHighScore() {
    try {
      const value = Number(localStorage.getItem(HIGH_SCORE_KEY));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore(value) {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(value));
    } catch {
      // Storage blocked: keep the best score for this visit only
    }
  }

  // --- Drawing ---
  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = COLORS.ground;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 1);
    ctx.lineTo(WIDTH, GROUND_Y + 1);
    ctx.stroke();
    for (let x = -state.groundOffset; x < WIDTH; x += 24) {
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(x, GROUND_Y + 8, 8, 2);
    }

    for (const obstacle of state.obstacles) {
      if (obstacle.type === 'pigeon') drawPigeon(obstacle);
      else for (const part of obstacle.parts) drawBox(obstacle.x + part.dx, GROUND_Y - part.dy - part.height, part.width, part.height);
    }
    drawCat(state.cat);

    ctx.fillStyle = COLORS.text;
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const current = String(Math.floor(state.score)).padStart(5, '0');
    const best = state.highScore > 0 ? `HI ${String(state.highScore).padStart(5, '0')}  ` : '';
    ctx.fillText(best + current, WIDTH - 12, 24);

    if (state.phase !== 'running') {
      if (state.phase === 'paused') {
        ctx.fillStyle = COLORS.dim;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.accent;
      let message = 'Jump to start';
      if (state.phase === 'paused') message = 'Paused – press P or jump to continue';
      if (state.phase === 'over') message = state.newRecord ? 'New record! – jump to restart' : 'Game over – jump to restart';
      ctx.fillText(message, WIDTH / 2, 80);
    }
  }

  function drawCat(cat) {
    const x = cat.x;
    const y = cat.y;
    const running = state.phase === 'running' && cat.y === GROUND_Y;
    const stride = running && Math.floor(state.score / 3) % 2 === 0;
    ctx.fillStyle = COLORS.cat;
    if (isDucking()) {
      ctx.fillRect(x, y - 10, 30, 8); // body, stretched low
      ctx.fillRect(x + 28, y - 14, 12, 10); // head
      ctx.beginPath(); // ears, folded back
      ctx.moveTo(x + 28, y - 14); ctx.lineTo(x + 29, y - 18); ctx.lineTo(x + 33, y - 14);
      ctx.moveTo(x + 34, y - 14); ctx.lineTo(x + 36, y - 18); ctx.lineTo(x + 39, y - 14);
      ctx.fill();
      ctx.fillRect(x - 8, y - 8, 9, 3); // tail
      ctx.fillRect(x + 2, y - 2, 3, 2); // legs
      ctx.fillRect(x + 24, y - 2, 3, 2);
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(x + 35, y - 11, 2, 2); // eye
      return;
    }
    ctx.fillRect(x, y - 18, 26, 12); // body
    ctx.fillRect(x + 20, y - 26, 14, 12); // head
    ctx.beginPath(); // ears
    ctx.moveTo(x + 21, y - 26); ctx.lineTo(x + 24, y - 32); ctx.lineTo(x + 27, y - 26);
    ctx.moveTo(x + 28, y - 26); ctx.lineTo(x + 31, y - 32); ctx.lineTo(x + 34, y - 26);
    ctx.fill();
    ctx.fillRect(x - 8, y - 22, 9, 3); // tail
    ctx.fillRect(x + 2, y - 6, 3, stride ? 6 : 4); // legs
    ctx.fillRect(x + 20, y - 6, 3, stride ? 4 : 6);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x + 29, y - 22, 2, 2); // eye
  }

  function drawBox(x, top, width, height) {
    ctx.fillStyle = COLORS.box;
    ctx.fillRect(x, top, width, height);
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, top + 1, width - 2, height - 2);
    ctx.beginPath();
    ctx.moveTo(x + width / 2, top);
    ctx.lineTo(x + width / 2, top + 6);
    ctx.stroke();
  }

  function drawPigeon(pigeon) {
    const x = pigeon.x;
    const top = GROUND_Y - pigeon.lift - pigeon.height;
    const wingsUp = Math.floor(x / 24) % 2 === 0; // flaps as it travels
    ctx.fillStyle = COLORS.pigeon;
    ctx.fillRect(x + 6, top + 4, 20, 9); // body
    ctx.fillRect(x, top + 2, 9, 7); // head, facing the cat
    ctx.fillRect(x + 24, top + 6, 6, 4); // tail
    ctx.fillStyle = COLORS.wing;
    ctx.beginPath();
    ctx.moveTo(x + 10, top + 6);
    ctx.lineTo(x + 17, wingsUp ? top - 6 : top + 16);
    ctx.lineTo(x + 22, top + 6);
    ctx.fill();
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x - 3, top + 5, 3, 2); // beak
    ctx.fillStyle = COLORS.edge;
    ctx.fillRect(x + 3, top + 4, 2, 2); // eye
  }

  // --- Readout and slider ---
  function updateReadout() {
    readout.value = state.speed.toFixed(3);
    gauge.value = state.speed;
  }

  function announce(text) {
    status.textContent = text;
  }

  slider.addEventListener('input', () => {
    const value = Number(slider.value);
    state.startSpeed = value;
    state.speed = value;
    updateReadout();
  });

  // --- Input ---
  document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyP' && !event.repeat) {
      togglePause();
      return;
    }
    if (event.target === slider) return;
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      // A held key repeats; it must not jump again on landing
      if (event.repeat) return;
      state.jumpHeld = true;
      jump();
    }
    if (event.code === 'ArrowDown') {
      event.preventDefault();
      // ↓ ducks on the ground and drops faster in the air
      state.duckHeld = true;
      fastFall();
    }
  });
  document.addEventListener('keyup', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp') state.jumpHeld = false;
    if (event.code === 'ArrowDown') state.duckHeld = false;
  });
  playfield.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    // preventScroll: focusing a partly hidden canvas must not scroll the page
    playfield.focus({ preventScroll: true });
    state.jumpHeld = true;
    jump();
  });
  // On the window, so letting go outside the playfield also counts
  const release = () => { state.jumpHeld = false; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // Pause automatically when the player looks away; only they decide when to go on
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', () => {
    release(); // the key-up may never arrive once focus is gone
    state.duckHeld = false;
    pause();
  });

  // --- Main loop with a fixed 60 Hz tick ---
  let lastTime = performance.now();
  let backlog = 0;
  function loop(now) {
    backlog += Math.min(250, now - lastTime); // don't catch up after a tab switch
    lastTime = now;
    while (backlog >= STEP_MS) {
      if (state.phase === 'running') step();
      backlog -= STEP_MS;
    }
    draw();
    updateReadout();
    requestAnimationFrame(loop);
  }

  // --- Pause: no simulation steps run, so the speed does not grow ---
  function pause() {
    if (state.phase !== 'running') return;
    state.phase = 'paused';
    announce('Paused.');
  }

  function resume() {
    if (state.phase !== 'paused') return;
    backlog = 0; // don't catch up on the steps missed while paused
    state.phase = 'running';
    announce('Running.');
  }

  function togglePause() {
    if (state.phase === 'running') pause();
    else resume();
  }

  // Hook for automated tests (read-only, changes nothing)
  window.strays = {
    get speed() { return state.speed; },
    get phase() { return state.phase; },
    get catY() { return state.cat.y; },
    get ducking() { return isDucking(); },
    get obstacles() { return state.obstacles.map(({ type, x, width, height, lift }) => ({ type, x, width, height, lift })); },
    get obstacleTypes() { return [...state.seenTypes]; },
    get score() { return Math.floor(state.score); },
    get highScore() { return state.highScore; },
  };

  updateReadout();
  requestAnimationFrame(loop);
})();
