# 09 – Treats and growing

## Goal

A reward that changes how the game plays: fish bones float in the air, and a well-fed cat grows.
A bigger cat can take a hit from a pigeon, at the cost of shrinking again. Growing is a risk too:
a bigger cat is harder to get past obstacles.

## Treats

- A fish bone appears now and then (about one per 8 obstacles), floating in the middle of a long
  gap (at least 60 steps) between two obstacles, so it never overlaps one and fetching it never
  spoils the next jump.
- It floats 28, 36 or 44 px above the ground: the cat at start size needs a hop to reach it, a
  grown cat reaches the lower ones while running.
- Touching it collects it: **+50 points**, a short sparkle (04) and the treat sound (03).
- A counter next to the score shows the treats of this run: a small fish shape drawn on the canvas
  (not an emoji, so it looks the same everywhere) followed by the count.
- Missed treats simply scroll away; there is no penalty.

## Growing

- The cat has four sizes. Every **3 treats** it grows by one size, up to the largest:

  | Size | Scale | Standing (w × h) | Ducking (w × h) | Treats in this run |
  | --- | --- | --- | --- | --- |
  | 0 (start) | 1.0 | 34 × 26 | 40 × 14 | 0–2 |
  | 1 | 1.2 | 41 × 31 | 48 × 17 | 3–5 |
  | 2 | 1.4 | 48 × 36 | 56 × 20 | 6–8 |
  | 3 (largest) | 1.6 | 54 × 42 | 64 × 22 | 9 and more |

- The cat grows from its paws: its left edge and the ground line stay where they are, it gets
  wider to the right and taller upwards. Drawing and hitbox scale together; the forgiving margin
  of 4 px stays the same.
- Growing takes 0.25 s (the size blends between the two scales), so it reads as a change, not a
  jump. The hitbox uses the new size at once.
- Jump physics stay the same at every size: same take-off speed, same gravity, same 95 px peak.

### Why the largest size is 1.6

Two limits, both from the current playfield (200 px high, ground at y = 170):

1. **It must fit in the playfield.** At the top of a full jump the cat's feet are 95 px above the
   ground. With its ears the cat is 32 × scale px tall, so at 1.6 its top is at
   y = 170 − 95 − 51 = 24, still inside the canvas with room to spare. The score sits in the top
   right corner and never overlaps the cat on the left.
2. **A ducking cat must still pass under a high pigeon.** The high pigeon leaves 20 px of space
   (08). Ducking at 1.6, the hitbox reaches 22 − 4 = 18 px above the ground: it passes. At 1.8 it
   would no longer fit, so a bigger cat could never get past a high pigeon.

## Pigeon hits

- **Bigger than the start size:** a pigeon hit does not end the run. The cat shrinks by **one
  size**, the pigeon flaps away upwards (it no longer collides with anything), and the cat blinks
  for 1 s. During that second, pigeons pass through it; boxes still count.
- **At the start size:** a pigeon hit ends the run, as before.
- **Boxes** (single, stack, row) end the run at **every size**. Only pigeons can be absorbed.
- The treat counter keeps counting; shrinking does not take treats away. The next growth comes
  after 3 more treats, counted from the hit (example: size 2 with 7 treats, hit → size 1; the cat
  grows back to size 2 at treat 10).
- `#status` announces each change: "Bigger!", "Hit a pigeon – smaller again."

## Messages

- On game over `#status` mentions treats and size: "Ouch! 612 points, 4 treats, size 1, at speed
  8.120."

## Interaction with the speed rule

- Collecting a treat is **not** a collision in the sense of rule 3: the game goes on, and the speed
  neither freezes nor changes.
- An **absorbed pigeon hit is not a collision in the sense of rule 3** either: the run goes on and
  the speed keeps growing by 0.001 in that step, exactly as in a step without any contact. A
  collision in the sense of the rule is only the contact that ends the run (any box, or a pigeon at
  the start size); then the speed freezes as today.
- Size never changes the speed, and the speed never changes the size.
- Treats and pigeons move with the current speed like all obstacles.

## Fairness

- A treat is never placed where reaching it makes the next obstacle impossible (checked with the
  same fairness logic as 08).
- Every obstacle sequence must stay clearable at the largest size, at speed 13. The wider cat needs
  longer to cross a row (60 + 54 − 8 = 106 px, 8 steps at speed 13, 13 steps at speed 8), well
  within the 37 steps of a full jump.

## Edge cases

- Restart: size 0, treat counter 0.
- Growth never happens while ducking under a pigeon (treats float at jump height, so the cat is in
  the air when it collects one). If it still happens, the grown hitbox counts.
- Two pigeons never follow each other directly (08), so a second pigeon arrives after the second
  of blinking is over. At size 1, a hit shrinks the cat to size 0, and the next pigeon hit ends
  the run.
- Treats count towards the high score (06); size does not give points.

## Sound and effects

- Growing plays the treat cue twice in a row (03); shrinking has its own cue (03), from set A
  like all sounds.
- With `prefers-reduced-motion`, the size change is instant and the cat does not blink; it is
  drawn at 50 % opacity during the protected second instead.

## Acceptance criteria

Checked with the scripted player in `test/test-game.mjs`; the long numbers come from one run with
`BOT_SECONDS=300`.

- [x] `window.strays.treats` reports the count of this run and resets on restart.
- [x] `window.strays.size` reports 0 to 3 and resets on restart.
- [ ] Collecting a treat adds exactly 50 to the score. Not measured in the test, only read in the
      code (`state.score += FISH.points`).
- [x] Collecting a treat leaves the speed unchanged: over a whole run with treats and an absorbed
      pigeon, the speed equals start + 0.001 × steps exactly (`speedRuleOk`).
- [x] Every 3 treats grow the cat, and it never grows beyond size 3 (long run: 34 treats, size 3).
- [x] At size 3, the top of the cat at the peak of a full jump is inside the canvas
      (`window.strays.catTop` ≥ 0; highest point measured: 23 px, as calculated).
- [x] At size 3, a ducking cat passes under a high pigeon (long run: ducks at size 3, no crash).
- [x] A pigeon hit at size ≥ 1 shrinks the cat by one size, the phase stays `running`, and the
      speed grows in that step as usual.
- [x] A pigeon hit at size 0 ends the run.
- [ ] A box hit at size ≥ 1 ends the run. Not tested separately; boxes take the same path as
      before 09, since only pigeons can be absorbed.
- [x] No treat overlaps an obstacle: checked in every frame of the scripted runs (0 overlaps)
      instead of 1000 seeded spawns, since the game has no seed yet. By construction a treat sits
      in the middle of a gap of at least 60 steps.
- [x] The scripted player from 08 survives 60 s at speed 13 at size 3 (long run: 229 s at size 3).

## Out of scope

Different treat types, a shop, extra lives beyond the size steps, shrinking from boxes.
