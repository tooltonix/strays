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
    pigeon: '#a7a9b4', wing: '#7d8090', bone: '#e8dcc4', dust: '#8b857e', dim: 'rgba(27, 27, 27, 0.6)',
  };
  // Obstacle types, unlocked by the current speed (specs/08-obstacles.md)
  const OBSTACLE_TYPES = [
    { type: 'box', from: 0, weight: 2 },
    { type: 'stack', from: 7, weight: 1 },
    { type: 'row', from: 8, weight: 1 },
    { type: 'pigeon', from: 9, weight: 1 },
  ];
  const PIGEON_LIFTS = [6, 20]; // space under the bird: low means jump, high means duck
  // Treats and growing (specs/09-treats.md)
  const FISH = { width: 16, height: 10, chance: 0.5, minGapSteps: 50, lifts: [28, 36, 44], points: 50 };
  const SIZES = [1, 1.2, 1.4, 1.6]; // cat scale per size; 1.6 still fits under a high pigeon
  const TREATS_PER_SIZE = 3;
  const GROW_STEPS = 15; // the drawn size blends over 0.25 s
  const PROTECT_STEPS = 60; // after absorbing a pigeon, pigeons pass through for 1 s
  const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  // Effects (specs/04-juice.md): drawing only, they never add or skip simulation steps
  const EFFECTS = {
    maxParticles: 30,
    particleSteps: 18, // dust and sparkles fade within 0.3 s
    squashSteps: 4, // flatter after landing
    stretchSteps: 6, // taller at the start of a jump
    flashSteps: 36, // the score blinks three times at every 1000 points
    shakeMs: 250,
    shakePx: 3,
  };
  const HIGH_SCORE_KEY = 'strays.highScore';
  const SOUND_KEY = 'strays.sound';
  // Sound cues (specs/03-sound.md): notes with an offset `at` in seconds, levels below master gain
  const CUES = {
    jump: [{ type: 'square', from: 380, to: 760, dur: 0.12, level: 0.5 }],
    land: [{ type: 'sine', from: 150, to: 90, dur: 0.06, level: 0.6 }],
    treat: [
      { type: 'triangle', from: 1320, dur: 0.07, level: 0.7 },
      { type: 'triangle', from: 1760, at: 0.075, dur: 0.07, level: 0.7 },
    ],
    milestone: [660, 880, 1320].map((from, i) => ({ type: 'triangle', from, at: i * 0.09, dur: 0.09, level: 0.6 })),
    crash: [{ type: 'sawtooth', from: 440, to: 110, dur: 0.28, level: 0.45 }],
    // Follows the crash cue, so it starts once that one is over
    record: [523, 659, 784, 1047].map((from, i) => ({ type: 'square', from, at: 0.3 + i * 0.072, dur: 0.07, level: 0.4 })),
    shrink: [{ type: 'triangle', from: 880, to: 330, dur: 0.2, level: 0.6 }],
  };
  CUES.grow = [...CUES.treat, ...CUES.treat.map((note) => ({ ...note, at: (note.at ?? 0) + 0.16 }))];
  const MASTER_GAIN = 0.15;

  const playfield = document.getElementById('playfield');
  const ctx = playfield.getContext('2d');
  const slider = document.getElementById('slider');
  const readout = document.getElementById('readout');
  const gauge = document.getElementById('gauge');
  const status = document.getElementById('status');
  const soundButton = document.getElementById('sound');
  const touchJump = document.getElementById('touch-jump');
  const touchDuck = document.getElementById('touch-duck');
  const touchPause = document.getElementById('touch-pause');

  const state = {
    phase: 'ready', // ready | running | paused | over
    speed: RULE.start,
    startSpeed: RULE.start,
    score: 0,
    highScore: loadHighScore(),
    newRecord: false,
    cat: { x: 60, y: GROUND_Y, vy: 0, width: 34, height: 26, fastFall: false, scale: 1, squash: 0, stretch: 0 },
    jumpHeld: false, // Space, ↑ or a pointer is held down
    duckHeld: false, // ↓ or the Duck button is held down
    jumpPointer: null, // the pointer holding the jump (playfield or Jump button)
    duckPointer: null, // the pointer holding the Duck button
    obstacles: [],
    lastType: 'box',
    seenTypes: new Set(),
    fish: [], // treats floating in the air
    treats: 0, // treats collected in this run
    growth: 0, // treats since the last size change
    size: 0, // index into SIZES
    protectSteps: 0,
    steps: 0, // simulation steps in this run
    milestone: 0, // thousands of points reached in this run
    particles: [], // landing dust and treat sparkles
    flashSteps: 0,
    shakeUntil: 0, // time until which the crash shake runs
    shake: 0, // largest offset applied in the last frame
    frames: { count: 0, totalMs: 0, maxMs: 0 }, // work per frame, for the test hook
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
    state.fish = [];
    state.treats = 0;
    state.growth = 0;
    state.size = 0;
    state.protectSteps = 0;
    state.steps = 0;
    state.milestone = 0;
    state.particles = [];
    state.flashSteps = 0;
    state.shakeUntil = 0;
    state.distanceToNext = 300;
    state.cat.y = GROUND_Y;
    state.cat.vy = 0;
    state.cat.fastFall = false;
    state.cat.scale = SIZES[0];
    state.cat.squash = 0;
    state.cat.stretch = 0;
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
    if (state.cat.y >= GROUND_Y) {
      state.cat.vy = JUMP_VELOCITY;
      state.cat.stretch = EFFECTS.stretchSteps;
      playCue('jump');
    }
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

  // A fish bone floats in the middle of a long gap, so fetching it never spoils the next jump
  function maybeAddFish(obstacle) {
    const gap = state.distanceToNext - obstacle.width;
    if (gap < state.speed * FISH.minGapSteps || Math.random() >= FISH.chance) return;
    const lift = FISH.lifts[Math.floor(Math.random() * FISH.lifts.length)];
    state.fish.push({ x: obstacle.x + obstacle.width + gap / 2 - FISH.width / 2, lift });
  }

  function collectFish(fish) {
    const top = GROUND_Y - fish.lift - FISH.height;
    addParticles(fish.x + FISH.width / 2, top + FISH.height / 2, 6, COLORS.accent, () => ({
      vx: Math.random() * 3 - 1.5,
      vy: Math.random() * 3 - 1.5,
    }));
    state.treats += 1;
    state.score += FISH.points;
    state.growth += 1;
    if (state.growth >= TREATS_PER_SIZE && state.size < SIZES.length - 1) {
      state.size += 1;
      state.growth = 0;
      announce('Bigger!');
      playCue('grow');
    } else {
      playCue('treat');
    }
  }

  function step() {
    const cat = state.cat;
    state.steps += 1;
    // Variable jump height: letting go while rising pulls the cat down sooner
    let gravity = GRAVITY;
    if (cat.fastFall) gravity *= FAST_FALL_GRAVITY;
    else if (cat.vy < 0 && !state.jumpHeld) gravity *= SHORT_JUMP_GRAVITY;
    const wasInAir = cat.y < GROUND_Y;
    cat.vy += gravity;
    cat.y = Math.min(GROUND_Y, cat.y + cat.vy);
    if (cat.y === GROUND_Y) {
      cat.vy = 0;
      cat.fastFall = false;
      if (wasInAir) {
        cat.squash = EFFECTS.squashSteps;
        const paws = cat.x + (cat.width * cat.scale) / 2;
        addParticles(paws, GROUND_Y - 1, 4 + Math.floor(Math.random() * 3), COLORS.dust, () => ({
          vx: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 1.6),
          vy: -0.2 - Math.random() * 0.6,
        }));
        playCue('land');
      }
    }
    // The drawn size blends towards the current size; the hitbox uses the current size at once
    const target = SIZES[state.size];
    const blend = REDUCED_MOTION ? Infinity : (SIZES[1] - SIZES[0]) / GROW_STEPS;
    if (cat.scale < target) cat.scale = Math.min(target, cat.scale + blend);
    if (cat.scale > target) cat.scale = Math.max(target, cat.scale - blend);
    if (state.protectSteps > 0) state.protectSteps -= 1;
    if (cat.squash > 0) cat.squash -= 1;
    if (cat.stretch > 0) cat.stretch -= 1;
    if (state.flashSteps > 0) state.flashSteps -= 1;
    for (const particle of state.particles) {
      particle.x += particle.vx - state.speed * 0.3; // drift back a little with the ground
      particle.y += particle.vy;
      particle.life -= 1;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);

    for (const obstacle of state.obstacles) {
      obstacle.x -= state.speed;
      if (obstacle.fleeing) obstacle.lift += 3; // a rammed pigeon flaps away upwards
    }
    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0 && obstacle.lift < HEIGHT);
    for (const fish of state.fish) fish.x -= state.speed;
    state.fish = state.fish.filter((fish) => fish.x + FISH.width > 0);

    state.distanceToNext -= state.speed;
    if (state.distanceToNext <= 0) {
      const obstacle = makeObstacle(pickType());
      state.obstacles.push(obstacle);
      state.lastType = obstacle.type;
      state.seenTypes.add(obstacle.type);
      // The gap starts behind the obstacle and grows with the speed, so every sequence stays clearable
      state.distanceToNext = obstacle.width + state.speed * (45 + Math.random() * 50);
      maybeAddFish(obstacle);
    }

    const box = catBox();
    for (const fish of state.fish) {
      const bottom = GROUND_Y - fish.lift;
      if (overlaps(box, fish.x, fish.x + FISH.width, bottom - FISH.height, bottom)) {
        fish.eaten = true;
        collectFish(fish);
      }
    }
    state.fish = state.fish.filter((fish) => !fish.eaten);

    const hit = findHit(catBox());
    if (hit && hit.type === 'pigeon' && state.size > 0) {
      // A bigger cat absorbs the pigeon and shrinks. This is not a collision in the sense of
      // rule 3: the run goes on and the speed grows in this step as usual.
      state.size -= 1;
      state.growth = 0;
      state.protectSteps = PROTECT_STEPS;
      hit.fleeing = true;
      announce('Hit a pigeon – smaller again.');
      playCue('shrink');
    } else if (hit) {
      gameOver();
      return;
    }

    // Rule 2: increase only without a collision and only below the maximum
    if (state.speed < RULE.maximum) state.speed += RULE.incrementPerStep;

    state.score += state.speed / 10;
    const milestone = Math.floor(state.score / 1000);
    if (milestone > state.milestone) {
      state.milestone = milestone;
      if (!REDUCED_MOTION) state.flashSteps = EFFECTS.flashSteps;
      playCue('milestone');
    }
    state.groundOffset = (state.groundOffset + state.speed) % 24;
  }

  // Small particles that fade out; off with reduced motion
  function addParticles(x, y, count, color, velocity) {
    if (REDUCED_MOTION) return;
    for (let i = 0; i < count; i++) {
      state.particles.push({ x, y, color, life: EFFECTS.particleSteps, ...velocity() });
    }
    state.particles = state.particles.slice(-EFFECTS.maxParticles);
  }

  // Rule 3: the contact that ends the run freezes the speed
  function gameOver() {
    state.phase = 'over';
    const points = Math.floor(state.score);
    // The best score only changes on game over, so the numbers don't jump around while running
    state.newRecord = points > state.highScore;
    if (state.newRecord) {
      state.highScore = points;
      saveHighScore(points);
    }
    state.shakeUntil = performance.now() + EFFECTS.shakeMs;
    playCue('crash');
    if (state.newRecord) playCue('record');
    const verdict = state.newRecord ? 'New record!' : 'Ouch!';
    const treats = `${state.treats} ${state.treats === 1 ? 'treat' : 'treats'}`;
    announce(`${verdict} ${points} points, ${treats}, size ${state.size}, at speed ${state.speed.toFixed(3)}. Jump to restart.`);
  }

  // The cat's hitbox, grown from the paws: the left edge and the ground line stay put
  function catBox() {
    const cat = state.cat;
    const scale = SIZES[state.size];
    const margin = 4; // a little forgiveness at the edges
    const ducking = isDucking();
    return {
      left: cat.x + margin,
      right: cat.x + (ducking ? DUCK.width : cat.width) * scale - margin,
      top: cat.y - (ducking ? DUCK.height : cat.height) * scale + margin,
      bottom: cat.y - margin,
    };
  }

  // Full rectangle overlap: flying obstacles can be passed underneath
  function overlaps(box, left, right, top, bottom) {
    return box.right > left && box.left < right && box.bottom > top && box.top < bottom;
  }

  function findHit(box) {
    return state.obstacles.find((obstacle) => {
      if (obstacle.fleeing) return false;
      if (obstacle.type === 'pigeon' && state.protectSteps > 0) return false;
      const bottom = GROUND_Y - obstacle.lift;
      return overlaps(box, obstacle.x, obstacle.x + obstacle.width, bottom - obstacle.height, bottom);
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

  // --- Sound: short blips made with Web Audio, no audio files ---
  const sound = { on: loadSound(), context: null, master: null, jumpNotes: [], played: {} };

  function loadSound() {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  function saveSound() {
    try {
      localStorage.setItem(SOUND_KEY, sound.on ? 'on' : 'off');
    } catch {
      // Storage blocked: the setting lasts for this visit only
    }
  }

  // Browsers only allow audio after a user input, so this runs from the input handlers
  function startAudio() {
    if (sound.context || !sound.on) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return; // no Web Audio: the game stays silent
    try {
      sound.context = new AudioContext();
      sound.master = sound.context.createGain();
      sound.master.gain.value = MASTER_GAIN;
      sound.master.connect(sound.context.destination);
    } catch {
      sound.context = null;
    }
  }

  function playCue(name) {
    if (!sound.on || !sound.context) return;
    if (sound.context.state === 'suspended') sound.context.resume();
    const start = sound.context.currentTime + 0.01;
    if (name === 'jump') {
      // Fast repeated jumps never stack: the previous jump cue stops
      for (const note of sound.jumpNotes) {
        try { note.stop(); } catch { /* already over */ }
      }
    }
    const notes = CUES[name].map((note) => playNote(note, start));
    if (name === 'jump') sound.jumpNotes = notes;
    sound.played[name] = (sound.played[name] ?? 0) + 1;
  }

  // One note: 8 ms attack, exponential glide and decay to silence
  function playNote({ type, from, to = from, at = 0, dur, level }, start) {
    const t = start + at;
    const oscillator = sound.context.createOscillator();
    const gain = sound.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, t);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    oscillator.connect(gain).connect(sound.master);
    oscillator.start(t);
    oscillator.stop(t + dur + 0.02);
    return oscillator;
  }

  function toggleSound() {
    sound.on = !sound.on;
    saveSound();
    startAudio();
    updateSoundButton();
    announce(sound.on ? 'Sound on.' : 'Sound off.');
  }

  function updateSoundButton() {
    soundButton.textContent = `Sound: ${sound.on ? 'on' : 'off'}`;
    soundButton.setAttribute('aria-pressed', String(sound.on));
  }

  // --- Drawing ---
  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Crash shake: only the canvas content moves, never the page
    const shaking = !REDUCED_MOTION && performance.now() < state.shakeUntil;
    const shakeX = shaking ? (Math.random() * 2 - 1) * EFFECTS.shakePx : 0;
    const shakeY = shaking ? (Math.random() * 2 - 1) * EFFECTS.shakePx : 0;
    state.shake = Math.max(Math.abs(shakeX), Math.abs(shakeY));
    ctx.save();
    ctx.translate(shakeX, shakeY);

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
    for (const fish of state.fish) drawFish(fish.x, GROUND_Y - fish.lift - FISH.height);
    drawCat(state.cat);
    for (const particle of state.particles) {
      ctx.globalAlpha = particle.life / EFFECTS.particleSteps;
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 1, particle.y - 1, 3, 3);
    }
    ctx.globalAlpha = 1;

    const flashing = state.flashSteps > 0 && Math.floor(state.flashSteps / 6) % 2 === 1;
    ctx.fillStyle = flashing ? COLORS.accent : COLORS.text;
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const current = String(Math.floor(state.score)).padStart(5, '0');
    const best = state.highScore > 0 ? `HI ${String(state.highScore).padStart(5, '0')}  ` : '';
    const scoreText = best + current;
    ctx.fillText(scoreText, WIDTH - 12, 24);
    if (state.treats > 0) {
      const count = String(state.treats);
      const right = WIDTH - 12 - ctx.measureText(scoreText).width - 16;
      ctx.fillText(count, right, 24);
      drawFish(right - ctx.measureText(count).width - 22, 12);
    }

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
    ctx.restore();
  }

  function drawCat(cat) {
    const protectedNow = state.protectSteps > 0;
    if (protectedNow && !REDUCED_MOTION && Math.floor(state.protectSteps / 6) % 2 === 0) return; // blink
    ctx.save();
    if (protectedNow && REDUCED_MOTION) ctx.globalAlpha = 0.5;
    // Draw at size 1 around the paws, scaled to the current size
    ctx.translate(cat.x, cat.y);
    // Squash after landing, stretch when taking off; the hitbox keeps its size
    let squashX = 1;
    let squashY = 1;
    if (cat.squash > 0) [squashX, squashY] = [1.1, 0.9];
    else if (cat.stretch > 0) [squashX, squashY] = [0.92, 1.1];
    ctx.scale(cat.scale * squashX, cat.scale * squashY);
    const x = 0;
    const y = 0;
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
      ctx.restore();
      return;
    }
    ctx.fillRect(x, y - 18, 26, 12); // body
    ctx.fillRect(x + 20, y - 26, 14, 12); // head
    ctx.beginPath(); // ears
    ctx.moveTo(x + 21, y - 26); ctx.lineTo(x + 24, y - 32); ctx.lineTo(x + 27, y - 26);
    ctx.moveTo(x + 28, y - 26); ctx.lineTo(x + 31, y - 32); ctx.lineTo(x + 34, y - 26);
    ctx.fill();
    ctx.fillRect(x - 8, y - (stride ? 24 : 22), 9, 3); // tail, swinging with the stride
    ctx.fillRect(x + 2, y - 6, 3, stride ? 6 : 4); // legs
    ctx.fillRect(x + 20, y - 6, 3, stride ? 4 : 6);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x + 29, y - 22, 2, 2); // eye
    ctx.restore();
  }

  // A fish bone, 16 × 10, head to the left
  function drawFish(x, top) {
    const middle = top + FISH.height / 2;
    ctx.strokeStyle = COLORS.bone;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, middle); // spine
    ctx.lineTo(x + 13, middle);
    for (const rib of [7, 10]) {
      ctx.moveTo(x + rib, top + 2);
      ctx.lineTo(x + rib, top + FISH.height - 2);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.bone;
    ctx.beginPath();
    ctx.moveTo(x, middle); ctx.lineTo(x + 5, top + 1); ctx.lineTo(x + 5, top + FISH.height - 1); // head
    ctx.moveTo(x + 13, middle); ctx.lineTo(x + 16, top); ctx.lineTo(x + 16, top + FISH.height); // tail
    ctx.fill();
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x + 2, middle - 1, 2, 2); // eye
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

  soundButton.addEventListener('click', toggleSound);

  // --- Input ---
  document.addEventListener('keydown', (event) => {
    startAudio();
    if (event.code === 'KeyP' && !event.repeat) {
      togglePause();
      return;
    }
    if (event.code === 'KeyM' && !event.repeat) {
      toggleSound();
      return;
    }
    // The slider and the buttons use these keys themselves
    if (event.target === slider || event.target instanceof HTMLButtonElement) return;
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
  function pressJump(event) {
    event.preventDefault();
    startAudio();
    state.jumpPointer = event.pointerId;
    state.jumpHeld = true;
    jump();
  }
  playfield.addEventListener('pointerdown', (event) => {
    // preventScroll: focusing a partly hidden canvas must not scroll the page
    playfield.focus({ preventScroll: true });
    pressJump(event);
  });

  // Touch buttons (specs/10-touch-controls.md): they react on press, not on click
  touchJump.addEventListener('pointerdown', pressJump);
  touchDuck.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    startAudio();
    state.duckPointer = event.pointerId;
    state.duckHeld = true;
    fastFall();
  });
  touchPause.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    togglePause();
  });
  // Show the buttons as soon as a finger touches the page, also where the media query misses
  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') document.documentElement.classList.add('touch-input');
  });

  // On the window and per pointer, so letting go anywhere counts and two thumbs stay independent
  const releasePointer = (event) => {
    if (event.pointerId === state.jumpPointer) {
      state.jumpHeld = false;
      state.jumpPointer = null;
    }
    if (event.pointerId === state.duckPointer) {
      state.duckHeld = false;
      state.duckPointer = null;
    }
  };
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);
  const releaseAll = () => {
    state.jumpHeld = false;
    state.duckHeld = false;
    state.jumpPointer = null;
    state.duckPointer = null;
  };

  function updateTouchButtons() {
    touchJump.classList.toggle('pressed', state.jumpHeld);
    touchDuck.classList.toggle('pressed', state.duckHeld);
    touchPause.textContent = state.phase === 'paused' ? 'Resume' : 'Pause';
  }

  // Pause automatically when the player looks away; only they decide when to go on
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', () => {
    releaseAll(); // the key-up or pointer-up may never arrive once focus is gone
    pause();
  });

  // --- Main loop with a fixed 60 Hz tick ---
  let lastTime = performance.now();
  let backlog = 0;
  function loop(now) {
    backlog += Math.min(250, now - lastTime); // don't catch up after a tab switch
    lastTime = now;
    const workStart = performance.now();
    while (backlog >= STEP_MS) {
      if (state.phase === 'running') step();
      backlog -= STEP_MS;
    }
    draw();
    updateReadout();
    updateTouchButtons();
    const work = performance.now() - workStart;
    state.frames.count += 1;
    state.frames.totalMs += work;
    state.frames.maxMs = Math.max(state.frames.maxMs, work);
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
    get catTop() { return state.cat.y - 32 * state.cat.scale; }, // top of the ears as drawn
    get catBox() { return catBox(); },
    get obstacles() {
      return state.obstacles.map(({ type, x, width, height, lift, fleeing }) => ({ type, x, width, height, lift, fleeing: Boolean(fleeing) }));
    },
    get fish() { return state.fish.map(({ x, lift }) => ({ x, width: FISH.width, height: FISH.height, lift })); },
    get treats() { return state.treats; },
    get size() { return state.size; },
    get steps() { return state.steps; },
    get obstacleTypes() { return [...state.seenTypes]; },
    get score() { return Math.floor(state.score); },
    get highScore() { return state.highScore; },
    get sound() { return sound.on; },
    get cuesPlayed() { return { ...sound.played }; },
    get particles() { return state.particles.length; },
    get shake() { return state.shake; },
    get frameMs() {
      const { count, totalMs, maxMs } = state.frames;
      return { average: count ? totalMs / count : 0, max: maxMs };
    },
  };

  updateReadout();
  updateSoundButton();
  requestAnimationFrame(loop);
})();
