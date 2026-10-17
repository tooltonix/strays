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
// options.fish: hop for fish bones. options.ram: let pigeons hit a grown cat, and once it has
// shrunk back to the start size, let one more hit it (that one must end the run).
const play = (ms, options = {}) =>
  runs.evaluate(
    ({ ms, options }) =>
      new Promise((done) => {
        const ground = strays.catY;
        const startSpeed = strays.speed - strays.steps * 0.001;
        const key = (type, code) => document.dispatchEvent(new KeyboardEvent(type, { code }));
        const start = performance.now();
        let ducking = false;
        let jumps = 0;
        let ducks = 0;
        let shrunk = false;
        let lastSize = strays.size;
        let maxSize = strays.size;
        let biggestSince = null;
        let secondsAtMaxSize = 0;
        let highestTop = Infinity;
        let fishOverlaps = 0;
        let rammedAtStartSize = false;
        const absorbs = [];
        (function tick(now) {
          const size = strays.size;
          const front = strays.catBox.right;
          if (size < lastSize) {
            shrunk = true;
            // Rule 2 still holds: every step so far grew the speed by 0.001
            const expected = startSpeed + strays.steps * 0.001;
            absorbs.push({ from: lastSize, to: size, phase: strays.phase, speedOk: Math.abs(strays.speed - expected) < 1e-6 });
          }
          lastSize = size;
          maxSize = Math.max(maxSize, size);
          if (size === 3) {
            biggestSince ??= now;
            highestTop = Math.min(highestTop, strays.catTop);
          } else if (biggestSince !== null) {
            secondsAtMaxSize += (now - biggestSince) / 1000;
            biggestSince = null;
          }
          const obstacles = strays.obstacles.filter((o) => !o.fleeing);
          for (const f of strays.fish) {
            if (obstacles.some((o) => o.x < f.x + f.width && f.x < o.x + o.width)) fishOverlaps++;
          }
          const ram = (o) => options.ram && o.type === 'pigeon' && (size > 0 || shrunk);
          const next = obstacles.filter((o) => o.x + o.width > 60 && !ram(o)).sort((a, b) => a.x - b.x)[0];
          const rammed = obstacles.find((o) => ram(o) && o.x < front && o.x + o.width > 60);
          if (rammed && size === 0) rammedAtStartSize = true;
          const steps = next ? (next.x - front) / strays.speed : Infinity;
          const duckUnder = next && next.lift >= 16;
          const onGround = strays.catY === ground;
          if (duckUnder && steps < 10 && !ducking) {
            key('keydown', 'ArrowDown');
            ducking = true;
            ducks++;
          } else if (!duckUnder && ducking) {
            key('keyup', 'ArrowDown');
            ducking = false;
          }
          if (!duckUnder && steps < 7 && onGround) {
            key('keydown', 'Space');
            setTimeout(() => key('keyup', 'Space'), 300); // a full jump
            jumps++;
          } else if (options.fish && onGround && !ducking && steps > 30) {
            const fish = strays.fish.filter((f) => f.x + f.width > 60).sort((a, b) => a.x - b.x)[0];
            if (fish && (fish.x - front) / strays.speed < 1.5) {
              key('keydown', 'Space');
              setTimeout(() => key('keyup', 'Space'), 40); // a hop
            }
          }
          if (strays.phase === 'running' && now - start < ms) return requestAnimationFrame(tick);
          if (biggestSince !== null) secondsAtMaxSize += (now - biggestSince) / 1000;
          // Rule 2 over the whole run, fish and absorbed pigeons included (the step that ends a run
          // does not grow the speed); only meaningful below the maximum
          const grownSteps = strays.phase === 'over' ? strays.steps - 1 : strays.steps;
          const expected = startSpeed + grownSteps * 0.001;
          done({
            speedRuleOk: expected < 12.99 ? Math.abs(strays.speed - expected) < 1e-6 : null,
            phase: strays.phase,
            seconds: Math.round((now - start) / 1000),
            speed: strays.speed,
            jumps,
            ducks,
            types: strays.obstacleTypes,
            treats: strays.treats,
            maxSize,
            secondsAtMaxSize: Math.round(secondsAtMaxSize),
            highestTop: highestTop === Infinity ? null : Math.round(highestTop),
            fishOverlaps,
            absorbs,
            rammedAtStartSize,
            cues: strays.cuesPlayed,
          });
        })(start);
      }),
    { ms, options },
  );
await startRun(5);
const slow = await play(15000); // the speed stays below 7 for about 30 s
await runs.screenshot({ path: `${folder}/07-obstacles-slow.png` });
await startRun(13);
const fast = await play(botSeconds * 1000, { fish: true });
await runs.screenshot({ path: `${folder}/08-obstacles-fast.png` });
const obstacles = { slow, fast };

// Growing and shrinking: grow from fish, then ram pigeons until the run ends
await startRun(9);
const ramming = await play(240000, { fish: true, ram: true });
await runs.screenshot({ path: `${folder}/09-rammed.png` });
await runs.keyboard.press('Space'); // restart
ramming.afterRestart = await runs.evaluate(() => ({ treats: strays.treats, size: strays.size, phase: strays.phase }));

// Sound: cues play on events, M and the button toggle, the setting survives a reload
const audio = await browser.newPage({ viewport: { width: 800, height: 520 } });
audio.on('pageerror', (e) => errors.push(`sound: ${e}`));
audio.on('console', (m) => m.type() === 'error' && errors.push(`sound: ${m.text()}`));
await audio.goto('http://127.0.0.1:8766/');
const soundState = () => audio.evaluate(() => ({ on: strays.sound, cues: strays.cuesPlayed }));
await audio.locator('#playfield').click(); // start
await audio.waitForTimeout(200);
await audio.keyboard.press('Space');
await audio.waitForTimeout(800); // up and down again
const soundOn = await soundState();
await audio.keyboard.press('KeyM');
const afterM = await soundState();
await audio.keyboard.press('Space');
await audio.waitForTimeout(800);
const mutedJump = await soundState();
await audio.locator('#sound').click();
const afterButton = { ...(await soundState()), label: await audio.locator('#sound').textContent() };
await audio.keyboard.press('KeyM');
await audio.reload();
const soundReloaded = { ...(await soundState()), label: await audio.locator('#sound').textContent() };
const sound = { soundOn, afterM, mutedJump, afterButton, soundReloaded };

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
      ramming,
      sound,
      reloaded,
      storageBlocked,
      errors,
    },
    null,
    1,
  ),
);
await browser.close();
