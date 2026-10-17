# 09 – Treats

## Goal

A small optional reward that makes the player take risks: fish bones floating in the air.

## Behaviour

- A fish bone appears now and then (about one per 8 obstacles), floating at jump height between two
  obstacles, never overlapping one.
- Touching it collects it: **+50 points**, a short sparkle (04) and a sound (03).
- A counter next to the score shows the treats of this run: a small fish shape drawn on the canvas
  (not an emoji, so it looks the same everywhere) followed by the count.
- On game over `#status` mentions them: "Ouch! 612 points, 4 treats, at speed 8.120."
- Missed treats simply scroll away; there is no penalty.

## Interaction with the speed rule

Collecting a treat is **not** a collision in the sense of rule 3: the game goes on, and the speed
neither freezes nor changes. Treats move with the current speed like obstacles.

## Edge cases

- A treat is never placed where reaching it makes the next obstacle impossible (checked with the
  same fairness logic as 08).
- Treats count towards the high score (06).

## Acceptance criteria

- [ ] `window.strays.treats` reports the count of this run and resets on restart.
- [ ] Collecting a treat adds exactly 50 to the score and leaves the speed unchanged
      (compare speed growth in the step before and after).
- [ ] No treat overlaps an obstacle (checked over 1000 spawns in a seeded run).

## Out of scope

Different treat types, a shop, extra lives.
