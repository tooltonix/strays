# 03 – Sound

## Goal

Short, friendly sound cues that make jumps and crashes feel tangible, without any audio files.

## Behaviour

- Sounds are synthesised with the Web Audio API (oscillator + gain envelope), each under 0.3 s.
- Cues (set A "blips", chosen after listening tests against a synthesised cat voice):

  | Cue | When | Sound |
  | --- | --- | --- |
  | **Jump** | the cat takes off | square wave gliding 380 → 760 Hz, 0.12 s, level 0.5 |
  | **Landing** | the paws touch the ground | sine 150 → 90 Hz, 0.06 s, level 0.6 |
  | **Treat** (09) | a fish bone is collected | triangle 1320 Hz then 1760 Hz, 2 × 0.07 s, level 0.7 |
  | **Milestone** (04) | every 1000 points | triangle 660, 880, 1320 Hz, 3 × 0.09 s, level 0.6 |
  | **Crash** | collision with an obstacle | sawtooth gliding 440 → 110 Hz, 0.28 s, level 0.45 |
  | **New record** (06) | once, right after the crash cue, only when the high score falls | square 523, 659, 784, 1047 Hz, 4 × 0.07 s, level 0.4 |
  | **Grow** (09) | the cat grows one size | the treat cue twice, the second 0.16 s after the first |
  | **Shrink** (09) | a pigeon hit makes the cat smaller | triangle gliding 880 → 330 Hz, 0.2 s, level 0.6 (proposed, waiting for a listening test) |

- Each note has an 8 ms attack and an exponential decay to silence; frequency glides are
  exponential. Levels are relative to the master gain.
- The `AudioContext` is created on the first user input only (autoplay rules).
- Master volume is low (gain about 0.15); no cue may clip.

## Controls

- Button "Sound: on/off" in `.controls`, a real `<button>` with `aria-pressed`.
- Key **M** toggles the same setting.
- Default: on. The choice is kept in `localStorage` under `strays.sound`.

## Interaction with the speed rule

None.

## Edge cases

- No Web Audio support or blocked storage: the game runs silently / forgets the setting, without
  errors.
- Muted while paused stays muted after resume.
- Fast repeated jumps never stack more than one jump cue at a time.

## Acceptance criteria

- [x] `window.strays.sound` reports `true` or `false`; M and the button both toggle it.
- [x] The setting survives a reload.
- [x] No console errors in a browser without audio output (headless test).
- [x] Every cue plays on its event (`window.strays.cuesPlayed` counts them; the scripted runs hit
      all eight) and none plays while the sound is off.
- [ ] Heard on real speakers inside the game, not only on the sound check page.

## Out of scope

Background music, volume slider, cat voice sounds (meow, purr, hiss: tried and set aside in
favour of the blips), recorded audio files.
