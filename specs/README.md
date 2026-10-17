# Roadmap specs

How Strays can grow beyond the first version. Each feature has its own spec, written before any
code, so it can be built and tested on its own. [`../SPEC.md`](../SPEC.md) stays the clean-room
bridge for the borrowed rule; everything in this folder is an original design.

## Principles for every feature

1. **The borrowed rule is untouchable.** Start at 6, +0.001 per simulation step without a
   collision, at most 13, fixed 60 Hz tick (`SPEC.md`, rules 1–4). No feature may add, remove or
   scale speed. Only the slider changes the speed directly, as before.
2. **Original design only.** No graphics, values, names or code from the Chromium dino game or any
   other game. Ideas such as "a flying obstacle" are generic, but their look, sizes and timings are
   our own.
3. **No dependencies, no build.** Plain `index.html`, `style.css`, `game.js`. No audio or image
   files; sounds and graphics are generated in code.
4. **The page stays still.** Effects happen inside the canvas only; no scrolling, no layout shift
   (`SPEC.md`, "Freely designed").
5. **Accessible.** Every new control works with the keyboard, has a label, and important events are
   announced in `#status`. Motion effects respect `prefers-reduced-motion`.
6. **Storage is optional.** Anything kept in `localStorage` is wrapped in `try/catch`; the game
   works the same when storage is blocked, only without remembering.
7. **Testable.** New state is exposed read-only on `window.strays`, and each spec lists acceptance
   criteria that `test/test-game.mjs` can check.

## Controls after all features

| Input | Action |
| --- | --- |
| Space, ↑, click, tap | Jump / start / restart; hold for a higher jump (07) |
| ↓ | Duck on the ground (08), fall faster in the air (07) |
| P | Pause / resume (02) |
| M | Sound on / off (03) |

## Features

| # | Spec | Area | Status |
| --- | --- | --- | --- |
| 01 | [Favicon](01-favicon.md) | Polish | done |
| 02 | [Pause](02-pause.md) | Polish | done |
| 03 | [Sound](03-sound.md) | Polish | planned |
| 04 | [Effects](04-juice.md) | Polish | planned |
| 05 | [Day and night](05-day-night.md) | Polish | planned |
| 06 | [High score](06-highscore.md) | Gameplay | done |
| 07 | [Jump control](07-jump-control.md) | Gameplay | done |
| 08 | [More obstacles](08-obstacles.md) | Gameplay | done |
| 09 | [Treats](09-treats.md) | Gameplay | planned |

## Recommended order

01 → 06 → 02 → 07 → 08 → 09 → 03 → 04 → 05

Small visible wins first (no more console error, a reason to play again), then the mechanics
that change how the game plays, presentation last. 07 comes before 08 because ducking reuses the
↓ key handling, and 09 after 08 because treats share the spawn logic.
