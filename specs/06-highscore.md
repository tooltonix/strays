# 06 – High score

## Goal

Give the player a reason to try again: beat their own best.

## Behaviour

- The best score is kept in `localStorage` under `strays.highScore` (an integer).
- The score line in the top right shows `HI 00412  00087` (best, then current), each five digits.
  Without a best score yet, only the current score is shown.
- The best score updates on game over, never during the run, so the numbers do not jump around.
- When the run beats the old best:
  - `#status` says "New record! 512 points at speed 7.420. Jump to restart."
  - the canvas message reads "New record! – jump to restart".
- A score reached with a changed slider counts the same; the slider is part of the game.

## Interaction with the speed rule

None. Points still grow by speed / 10 per step, plus treats (09).

## Edge cases

- Storage blocked or broken value: start from 0, keep the best for this page visit only.
- Values that are not finite numbers are ignored.

## Acceptance criteria

- [x] `window.strays.score` and `window.strays.highScore` are exposed (read-only).
- [x] After a crash with a higher score, `highScore` equals the floored final score.
- [x] The value survives a reload.
- [x] With `localStorage` throwing (stubbed in the test), the game still starts and runs.

## Out of scope

Online leaderboards, a reset button (clearing site data is enough for now).
