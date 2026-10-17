// Behaviour test for Strays (Playwright). Prints the measurements as JSON and saves screenshots.
// Usage: node test/test-game.mjs <screenshot-folder>  (game served on http://127.0.0.1:8766/)
import { chromium } from 'playwright-core';

const folder = process.argv[2] ?? 'screenshots';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 800, height: 520 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://127.0.0.1:8766/');

const read = (target = page) =>
  target.evaluate(() => ({ speed: strays.speed, phase: strays.phase, score: strays.score, highScore: strays.highScore }));

const ready = await read();
await page.screenshot({ path: `${folder}/01-ready.png` });

await page.keyboard.press('Space');
await page.waitForTimeout(200);
const before = await read();
const t0 = Date.now();
await page.waitForTimeout(2000);
const after = await read();
const t1 = Date.now();
await page.screenshot({ path: `${folder}/02-running.png` });

let state = await read();
for (let i = 0; i < 40 && state.phase !== 'over'; i++) {
  await page.waitForTimeout(250);
  state = await read();
}
const crash1 = state;
await page.waitForTimeout(500);
const crash2 = await read();
await page.screenshot({ path: `${folder}/03-game-over.png` });

await page.keyboard.press('Space');
await page.waitForTimeout(30);
const restarted = await read();

await page.locator('#slider').fill('13');
await page.waitForTimeout(500);
const max1 = await read();
await page.waitForTimeout(300);
const max2 = await read();
const readout = await page.locator('#readout').textContent();
await page.screenshot({ path: `${folder}/04-slider-13.png` });

// Pause: on a fresh page, so the runs above are not affected
const paused = await browser.newPage({ viewport: { width: 800, height: 520 } });
paused.on('pageerror', (e) => errors.push(`pause: ${e}`));
await paused.goto('http://127.0.0.1:8766/');
await paused.keyboard.press('Space');
await paused.waitForTimeout(300);
await paused.keyboard.press('KeyP');
const pause1 = await read(paused);
await paused.waitForTimeout(1000);
const pause2 = await read(paused);
await paused.screenshot({ path: `${folder}/06-paused.png` });
await paused.keyboard.press('Space');
const resumeStart = await read(paused);
const r0 = Date.now();
await paused.waitForTimeout(1000);
const resumeEnd = await read(paused);
const r1 = Date.now();
await paused.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
});
const hidden = await read(paused);
const pause = {
  pause1,
  pause2,
  increasePerSecondAfterResume: (resumeEnd.speed - resumeStart.speed) / ((r1 - r0) / 1000),
  resumeEnd,
  hidden,
};

// Jump control: on a fresh page at speed 1, so no box arrives during the measurements
const jumps = await browser.newPage({ viewport: { width: 800, height: 520 } });
jumps.on('pageerror', (e) => errors.push(`jumps: ${e}`));
await jumps.goto('http://127.0.0.1:8766/');
await jumps.locator('#slider').fill('1');
await jumps.locator('#playfield').click(); // starts the run and focuses the playfield
await jumps.waitForTimeout(200);
// Watches the cat for `ms`: highest point above the ground and time spent in the air
const watch = (ms) =>
  jumps.evaluate(
    (ms) =>
      new Promise((done) => {
        const ground = strays.catY;
        const start = performance.now();
        let peak = 0;
        let airFrom = null;
        let airMs = 0;
        (function sample(now) {
          const height = ground - strays.catY;
          peak = Math.max(peak, height);
          if (height > 0 && airFrom === null) airFrom = now;
          if (height <= 0 && airFrom !== null && !airMs) airMs = now - airFrom;
          if (now - start < ms) requestAnimationFrame(sample);
          else done({ peak: Math.round(peak), airMs: Math.round(airMs) });
        })(start);
      }),
    ms,
  );
const press = async (holdMs, downAfterMs) => {
  const result = watch(1500);
  await jumps.keyboard.down('Space');
  if (downAfterMs !== undefined && downAfterMs < holdMs) {
    await jumps.waitForTimeout(downAfterMs);
    await jumps.keyboard.press('ArrowDown');
    await jumps.waitForTimeout(holdMs - downAfterMs);
  } else {
    await jumps.waitForTimeout(holdMs);
  }
  await jumps.keyboard.up('Space');
  return result;
};
const jumpControl = {
  tap: await press(50),
  hold: await press(400),
  holdWithFastFall: await press(400, 350),
  phase: (await read(jumps)).phase,
};

// Obstacles: a scripted player that knows where every obstacle is. If it survives, every
// sequence the game generates can be cleared. BOT_SECONDS sets the run at speed 13 (default 60).
const botSeconds = Number(process.env.BOT_SECONDS ?? 60);
const runs = await browser.newPage({ viewport: { width: 800, height: 520 } });
runs.on('pageerror', (e) => errors.push(`obstacles: ${e}`));
// Starts a fresh run at the given speed, so all gaps were made for that speed
const startRun = async (speed) => {
  await runs.goto('http://127.0.0.1:8766/');
  await runs.locator('#slider').fill(String(speed));
  await runs.locator('#playfield').click();
};
const play = (ms) =>
  runs.evaluate(
    (ms) =>
      new Promise((done) => {
        const ground = strays.catY;
        const catFront = 90; // right edge of the cat's hitbox
        const key = (type, code) => document.dispatchEvent(new KeyboardEvent(type, { code }));
        const start = performance.now();
        let ducking = false;
        let jumps = 0;
        let ducks = 0;
        (function tick(now) {
          const next = strays.obstacles.filter((o) => o.x + o.width > 60).sort((a, b) => a.x - b.x)[0];
          const steps = next ? (next.x - catFront) / strays.speed : Infinity;
          const duckUnder = next && next.lift >= 16;
          if (duckUnder && steps < 10 && !ducking) {
            key('keydown', 'ArrowDown');
            ducking = true;
            ducks++;
          } else if (!duckUnder && ducking) {
            key('keyup', 'ArrowDown');
            ducking = false;
          }
          if (!duckUnder && steps < 7 && strays.catY === ground) {
            key('keydown', 'Space');
            setTimeout(() => key('keyup', 'Space'), 300); // a full jump
            jumps++;
          }
          if (strays.phase === 'running' && now - start < ms) requestAnimationFrame(tick);
          else done({ phase: strays.phase, seconds: Math.round((now - start) / 1000), speed: strays.speed, jumps, ducks, types: strays.obstacleTypes });
        })(start);
      }),
    ms,
  );
await startRun(5);
const slow = await play(15000); // the speed stays below 7 for about 30 s
await runs.screenshot({ path: `${folder}/07-obstacles-slow.png` });
await startRun(13);
const fast = await play(botSeconds * 1000);
await runs.screenshot({ path: `${folder}/08-obstacles-fast.png` });
const obstacles = { slow, fast };

// High score: kept across a reload
await page.reload();
const reloaded = await read();
await page.screenshot({ path: `${folder}/05-high-score.png` });

// High score: the game still runs when storage throws
const blocked = await browser.newPage();
blocked.on('pageerror', (e) => errors.push(`blocked storage: ${e}`));
await blocked.addInitScript(() => {
  const fail = () => { throw new Error('storage blocked'); };
  Storage.prototype.getItem = fail;
  Storage.prototype.setItem = fail;
});
await blocked.goto('http://127.0.0.1:8766/');
await blocked.keyboard.press('Space');
await blocked.waitForTimeout(300);
const storageBlocked = await read(blocked);

console.log(
  JSON.stringify(
    {
      ready,
      increasePerSecond: (after.speed - before.speed) / ((t1 - t0) / 1000),
      before,
      after,
      crash1,
      crash2,
      restarted,
      max1,
      max2,
      readout,
      pause,
      jumpControl,
      obstacles,
      reloaded,
      storageBlocked,
      errors,
    },
    null,
    1,
  ),
);
await browser.close();
