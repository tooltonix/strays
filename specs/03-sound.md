# 03 – Sound

## Goal

Short, friendly sound cues that make jumps and crashes feel tangible, without any audio files.

## Behaviour

- Sounds are synthesised with the Web Audio API (oscillator + gain envelope), each under 0.3 s.
- Cues:
  - **Jump:** short rising blip.
  - **Landing:** very soft low tick.
  - **Treat collected** (09): two quick high notes.
  - **Milestone** (every 1000 points, 04): three-note chime.
  - **New high score** (06): plays once on game over when a record was set.
  - **Crash:** short falling tone.
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

- [ ] `window.strays.sound` reports `true` or `false`; M and the button both toggle it.
- [ ] The setting survives a reload.
- [ ] No console errors in a browser without audio output (headless test).

## Out of scope

Background music, volume slider.
