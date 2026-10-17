# 08 – More obstacles

## Goal

Keep a long run interesting by introducing new obstacle types as the cat gets faster.

## Obstacle types

| Type | Unlocked at speed | Look | How to pass |
| --- | --- | --- | --- |
| Single box | start | as today | jump |
| Box stack | 7 | two boxes on top of each other, up to 46 px high | full jump (07) |
| Box row | 8 | two or three boxes side by side, up to 64 px wide | long jump, early take-off |
| Pigeon | 9 | grey bird with flapping wings, flying at one of two heights | low pigeon: jump; high pigeon: duck or stay low |

Sizes and heights are tuned in play tests; the numbers above are upper limits.

## Ducking

- Holding **↓** on the ground makes the cat duck: drawn lower and longer, hitbox height reduced
  from 26 px to 14 px.
- Releasing ↓ stands up immediately. ↓ in the air keeps its fast-fall meaning (07); if still held
  on landing, the cat lands ducked.
- The high pigeon flies with its lowest point above 16 px over the ground, so a ducked cat passes
  and a standing cat does not.
- The collision check is a full rectangle overlap. Before 08, `collides()` only compared the cat's
  bottom with the box top, which is enough for ground obstacles but not for flying ones.

## Spawning and fairness

- Each spawn picks a type at random among the unlocked ones, single boxes weighted double; single
  boxes stay the most common (at least 40 %, in practice over 60 %).
- After any of the new types comes a single box, so two of them never follow each other directly.
- The gap is measured from the far edge of an obstacle and grows with the speed
  (width + speed × 45 to 95 steps), so that every sequence can be cleared with the jump from 07.
- After a restart with the slider set high, all types up to that speed are available at once.

## Edge cases

- Moving the slider **up** during a run makes obstacles that were already spaced for the lower
  speed arrive too close together. This was already true for the single boxes and is accepted: the
  fairness promise holds for runs where the speed only grows by the rule.

## Interaction with the speed rule

Obstacles move with the current speed, like the boxes today. Unlocking reads the speed but never
changes it. Hitting any obstacle is a collision in the sense of rule 3.

## Acceptance criteria

- [x] `window.strays.obstacleTypes` lists the types seen in the current run.
- [x] Below speed 7 only single boxes appear (slider at 5, 15 s run; at 5 the speed stays below 7
      for over 30 s, while a start at 6 would pass 7 after about 17 s).
- [x] At slider 13 all four types appear within 60 s.
- [x] Automated "perfect player" check: a scripted bot that knows the obstacle positions survives
      5 minutes at speed 13, proving every sequence is clearable. The test runs 60 s by default;
      `BOT_SECONDS=300` runs the full 5 minutes (passed: 239 jumps, 13 ducks).

## Out of scope

Moving ground obstacles, holes, power-ups.
