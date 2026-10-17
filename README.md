# Strays

A tiny browser game with a speed slider: a stray cat jumps over cardboard boxes.
Built as a hands-on example for the blog post "REA und ‚Software is done': Was
KI-Reverse-Engineering wirklich kann" (in German) on [promptandpixel.dev](https://promptandpixel.dev/).

## What it is about

[REA](https://github.com/morluto/rea) ("Reverse Engineer Anything") was used to examine the
speed rule of the Chrome dino game, in the browser build of
[wayou/t-rex-runner](https://github.com/wayou/t-rex-runner) (Chromium code, BSD license).
This game was then built following the **clean-room principle**:

1. Analysis and measurement: [`PROTOCOL.md`](PROTOCOL.md)
2. The rule in our own words, without code: [`SPEC.md`](SPEC.md)
3. Rebuild based only on the specification: `index.html`, `style.css`, `game.js`

Only the rule is borrowed: start at 6, +0.001 per simulation step without a collision, at most
13. Graphics, jump, collision and code are original designs. Unlike the original, the
simulation runs on a fixed 60 Hz tick, so the acceleration does not depend on the refresh rate.

## Roadmap

Planned features (high score, pause, jump control, more obstacles, treats, sound, effects, day and
night) are specified one by one in [`specs/`](specs/README.md), before any code is written.

## Run it

No dependencies, no build. Start any static server in this folder, e.g.:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Jump with Space, arrow up, click or tap: hold for a high
jump, tap for a hop. Arrow down ducks under high-flying pigeons, or drops faster in the air. Pause
with P, sound on or off with M. From speed 7 on, box stacks, box rows and pigeons join the single
boxes. Fish bones give 50 points, and every 3 of them make the cat bigger: a bigger cat survives a
pigeon but shrinks.
The game also pauses by itself when you switch tabs.

## Test

`test/test-game.mjs` checks the behaviour with Playwright (increase per second, freeze on
collision, restart at 6, cap at 13, high score kept across a reload and without storage, no speed growth while paused,
hop lower than a held jump, faster landing with arrow down, a scripted player surviving all obstacle
types at speed 13, growing from fish bones and shrinking from pigeons, sound cues and the sound setting) and saves
screenshots. `BOT_SECONDS` sets that run's length (default 60):

```bash
npm i playwright-core
python3 -m http.server 8766 &
CHROMIUM_PATH=/path/to/chromium node test/test-game.mjs screenshots
```

## Origin and licenses

- Own code, graphics and texts in this repository: MIT license, see [`LICENSE`](LICENSE).
- Speed rule from the T-Rex game of the Chromium project, © The Chromium Authors, BSD license;
  analysed in wayou/t-rex-runner (BSD-3-Clause).
- REA: MIT license.
