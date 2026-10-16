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
  const COLORS = { cat: '#f2eee9', box: '#c98a4b', edge: '#ab4b08', ground: '#ab4b08', text: '#f2eee9', accent: '#ff6b01' };

  const playfield = document.getElementById('playfield');
  const ctx = playfield.getContext('2d');
  const slider = document.getElementById('slider');
  const readout = document.getElementById('readout');
  const gauge = document.getElementById('gauge');
  const status = document.getElementById('status');

  const state = {
    phase: 'ready', // ready | running | over
    speed: RULE.start,
    startSpeed: RULE.start,
    score: 0,
    cat: { x: 60, y: GROUND_Y, vy: 0, width: 34, height: 26 },
    boxes: [],
    distanceToNext: 0,
    groundOffset: 0,
  };

  // --- Simulation ---
  function restart() {
    state.phase = 'running';
    state.speed = state.startSpeed;
    state.score = 0;
    state.boxes = [];
    state.distanceToNext = 300;
    state.cat.y = GROUND_Y;
    state.cat.vy = 0;
    announce('Running.');
  }

  function jump() {
    if (state.phase !== 'running') {
      restart();
      return;
    }
    if (state.cat.y >= GROUND_Y) state.cat.vy = JUMP_VELOCITY;
  }

  function step() {
    const cat = state.cat;
    cat.vy += GRAVITY;
    cat.y = Math.min(GROUND_Y, cat.y + cat.vy);
    if (cat.y === GROUND_Y) cat.vy = 0;

    for (const box of state.boxes) box.x -= state.speed;
    state.boxes = state.boxes.filter((box) => box.x + box.width > 0);

    state.distanceToNext -= state.speed;
    if (state.distanceToNext <= 0) {
      const width = 18 + Math.floor(Math.random() * 3) * 10;
      const height = 22 + Math.floor(Math.random() * 3) * 8;
      state.boxes.push({ x: WIDTH, width, height });
      // The gap grows with the speed so jumps stay possible
      state.distanceToNext = state.speed * (45 + Math.random() * 50);
    }

    if (collides()) {
      state.phase = 'over';
      announce(`Ouch! ${Math.floor(state.score)} points at speed ${state.speed.toFixed(3)}. Jump to restart.`);
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
    const catLeft = cat.x + margin;
    const catRight = cat.x + cat.width - margin;
    const catBottom = cat.y - margin;
    return state.boxes.some((box) => {
      const top = GROUND_Y - box.height;
      return catRight > box.x && catLeft < box.x + box.width && catBottom > top;
    });
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

    for (const box of state.boxes) drawBox(box);
    drawCat(state.cat);

    ctx.fillStyle = COLORS.text;
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(state.score)).padStart(5, '0'), WIDTH - 12, 24);

    if (state.phase !== 'running') {
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.accent;
      ctx.fillText(state.phase === 'ready' ? 'Jump to start' : 'Game over – jump to restart', WIDTH / 2, 80);
    }
  }

  function drawCat(cat) {
    const x = cat.x;
    const y = cat.y;
    const running = state.phase === 'running' && cat.y === GROUND_Y;
    const stride = running && Math.floor(state.score / 3) % 2 === 0;
    ctx.fillStyle = COLORS.cat;
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

  function drawBox(box) {
    const top = GROUND_Y - box.height;
    ctx.fillStyle = COLORS.box;
    ctx.fillRect(box.x, top, box.width, box.height);
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x + 1, top + 1, box.width - 2, box.height - 2);
    ctx.beginPath();
    ctx.moveTo(box.x + box.width / 2, top);
    ctx.lineTo(box.x + box.width / 2, top + 6);
    ctx.stroke();
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
    if (event.target === slider) return;
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      jump();
    }
  });
  playfield.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    // preventScroll: focusing a partly hidden canvas must not scroll the page
    playfield.focus({ preventScroll: true });
    jump();
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

  // Hook for automated tests (read-only, changes nothing)
  window.strays = { get speed() { return state.speed; }, get phase() { return state.phase; } };

  updateReadout();
  requestAnimationFrame(loop);
})();
