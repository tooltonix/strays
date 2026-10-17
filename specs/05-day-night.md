# 05 – Day and night

## Goal

Show progress in a long run through a slowly changing sky.

## Behaviour

- Three named palettes: **dusk** (current colors, the start), **night**, **dawn**.
- The phase changes every 2000 points: dusk → night → dawn → dusk …
- The change blends over 3 seconds instead of switching at once.
- **Night:** darker surface, a moon in the upper left, 12 small stars at fixed random positions
  that drift slowly (slower than the ground).
- **Dawn:** warmer surface, no stars.
- Each restart begins at dusk.

## Colors

- All colors live in one `PALETTES` object in `game.js`; `COLORS` becomes the blended result.
- Cat, boxes and the score must keep a contrast ratio of at least 3:1 against the surface in
  every phase and during the blend.

## Interaction with the speed rule

None. The phase follows the score, not the speed.

## Edge cases

- The page background (`style.css`) does not change; only the canvas does.
- With `prefers-reduced-motion` the blend is skipped and the change is instant.

## Acceptance criteria

- [ ] `window.strays.sky` reports `dusk`, `night` or `dawn`.
- [ ] A run past 2000 points reports `night`; after a restart it reports `dusk`.
- [ ] Contrast check for every palette passes (small script in the test).

## Out of scope

Weather, seasons, a moving sun.
