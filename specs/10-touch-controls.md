# 10 – Touch controls

## Goal

Play the whole game on a phone. Until now a tap on the playfield only jumps; ducking, falling
faster and pausing need a keyboard.

## Behaviour

- Below the playfield, a row of three on-screen buttons:

  | Button | Position | Press | Hold | Same as |
  | --- | --- | --- | --- | --- |
  | **Duck ↓** | left, under the left thumb | duck on the ground, fall faster in the air | keeps ducking | ↓ (07, 08) |
  | **Pause** | middle, small | pause / resume | – | P (02) |
  | **Jump ↑** | right, under the right thumb, the largest | jump / start / restart | higher jump | Space, ↑ (07) |

- The buttons respond on `pointerdown`, not on click, so there is no delay.
- Duck and Jump can be held **at the same time** with two thumbs: each button follows its own
  pointer, so lifting one finger never releases the other button.
- A tap on the playfield still jumps, as before.
- The buttons are shown on touch screens (`(hover: none)` or `(pointer: coarse)`) and as soon as
  any touch input arrives. On a desktop with a mouse they stay hidden; the keyboard is the
  control there.

## Look

- At least 56 px high, Jump at least 40 % of the row's width; the game's surface, border and
  accent colors, labels with the arrow symbol.
- A held button shows its pressed state (accent border).
- `touch-action: none`, no text selection and no long-press menu on the buttons, so holding them
  never scrolls, zooms or selects anything (`SPEC.md`: playing never moves the page).

## Interaction with the speed rule

None. The buttons only send the same inputs as the keys.

## Edge cases

- A finger that slides off a button and is lifted elsewhere still releases it (`pointerup` and
  `pointercancel` are handled on the window, per pointer).
- Losing focus or switching apps releases all buttons (as for keys, 02 and 07).
- The buttons are real `<button>` elements with labels. They react to pointers only; a keyboard
  press on a focused button does nothing, the keys themselves are the keyboard controls.

## Acceptance criteria

- [x] On an emulated phone (touch, coarse pointer) the three buttons are visible; on a desktop
      viewport with a mouse they are hidden.
- [x] Jump button: a short press hops, a long press jumps higher (60 px and 95 px, as in 07).
- [x] Duck button held: `window.strays.ducking` is true on the ground; released: false.
- [x] Holding Duck while pressing and releasing Jump keeps the cat ducking.
- [x] Pause button pauses and resumes.
- [x] Holding a button does not scroll the page.
- [ ] Tried on a real phone.

## Out of scope

Swipe gestures, tilt control, a full-screen mode.
