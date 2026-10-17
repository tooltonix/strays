# 04 – Effects ("juice")

## Goal

Small visual reactions that make the cat feel alive and progress feel rewarding.

## Behaviour

- **Landing dust:** 4–6 small grey particles burst sideways from the paws and fade within 0.3 s.
- **Squash and stretch:** the cat is drawn 10 % flatter for 4 steps after landing and 10 % taller
  during the first steps of a jump.
- **Crash shake:** on collision the canvas content shakes for 0.25 s (offset of at most 3 px,
  applied with `ctx.translate` inside the canvas only).
- **Milestone flash:** every 1000 points the score blinks in the accent color three times.
- **Tail:** the tail moves up and down with the running stride.

## Interaction with the speed rule

Purely visual. Effects run during drawing; they never add or skip simulation steps.

## Accessibility

With `prefers-reduced-motion: reduce`, crash shake, score blink and landing dust are off. Squash
and stretch stay, because they are small and slow.

## Edge cases

- Particles are capped (at most 30 at once) and cleared on restart.
- Effects freeze while paused (02) and continue on resume.

## Acceptance criteria

- [ ] The page itself never moves (check `window.scrollY` and the canvas bounding box before and
      after a crash).
- [ ] With reduced motion emulated in Playwright, no shake offset is applied.
- [ ] The frame time stays below 4 ms on a mid-range laptop (Performance panel).

## Out of scope

A particle library, WebGL.
