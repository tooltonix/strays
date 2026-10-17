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
      reloaded,
      storageBlocked,
      errors,
    },
    null,
    1,
  ),
);
await browser.close();
