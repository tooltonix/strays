# 07 – Jump control

## Goal

More control over the cat: short hops for small boxes, high jumps for tall ones, and a way to come
down quickly.

## Behaviour

- **Variable height:** the jump starts with the current velocity (−11). While the jump input is
  held and the cat is rising, gravity stays normal (0.6). When the input is released while
  rising, gravity is doubled until the cat starts to fall. Result: a tap gives a low hop, holding
  gives the full jump.
- "Held" means: Space or ↑ key down, or a pointer pressed on the playfield.
- **Fast fall:** pressing **↓** in the air sets gravity to three times normal until landing.
- Holding the jump input on landing does **not** trigger another jump; the player must press
  again (no bunny hopping by accident).

## Controls

| Input | Effect |
| --- | --- |
| Space / ↑ / pointer down | Start jump |
| Release while rising | Shorter jump |
| ↓ in the air | Fall faster |

`keyup` and `pointerup`/`pointercancel` are needed in addition to the current `keydown` and
`pointerdown` handlers. `event.repeat` key events are ignored.

## Interaction with the speed rule

None. Jump physics are freely designed (`SPEC.md`).

## Edge cases

- Releasing outside the canvas (pointer leaves) counts as a release.
- Restarting with the jump input does not start in mid-air.

## Acceptance criteria

- [x] A 50 ms key press gives a lower jump than a 400 ms press (`window.strays.catY` exposed;
      the peak is the smallest `catY` during the jump).
- [x] ↓ in the air shortens the time until landing.
- [ ] The tallest planned obstacle (08) is clearable with a full jump at speed 13. To be checked
      with 08; measured so far: a tap reaches 60 px, a full jump 95 px, the planned box stack is at
      most 46 px high.

## Out of scope

Double jump, wall jumps.
