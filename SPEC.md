# Specification "Strays" (clean room)

This file is the **only** bridge between the analysis and the rebuild. It contains behaviour
rules in our own words only – no code and no identifiers from the original.

## Borrowed rule (from analysing the Chromium dino game, BSD license)

Speed is measured in **pixels per simulation step**; one step is 1/60 s.

1. At the start and on every restart the speed is **6**.
2. In every simulation step **without a collision** the speed grows by **0.001** as long as it
   is **below 13**. (Consequence: the final value can exceed 13 by less than 0.001; after that
   it stops growing.)
3. On a collision the speed freezes and the game ends.
4. From the start to the top speed it takes (13 − 6) / 0.001 = 7000 steps, i.e. just under
   2 minutes at 60 steps per second.

Observation from the analysis: in the original, the acceleration is tied to the display refresh
rate (one step per rendered frame). On a 120 Hz screen the game speeds up twice as fast. The
rebuild deliberately decouples this with a fixed 60 Hz tick.

## Freely designed (not from the original)

- Character: a cat drawn from simple shapes; obstacles: cardboard boxes.
- Jump physics, obstacle spacing, collision check, scoring, colors.
- Controls: Space, arrow up, click or tap = jump or start. Playing never moves the page: no
  scrolling when the playfield gets focus or is tapped, no layout shift from status messages.
- "Speed" slider (1 to 13): sets the current speed immediately and is the start value for the
  next restart. Default: 6 (rule 1).
- The current speed is shown as a number and as a gauge up to 13.
- Note on where the rule comes from and on the BSD license of the Chromium project.
