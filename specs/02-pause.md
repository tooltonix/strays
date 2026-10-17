# 02 – Pause

## Goal

Never lose a run because the player switched tabs or took a call, and allow a deliberate break.

## Behaviour

- New phase `paused` next to `ready | running | over`. Only a running game can be paused.
- **Automatic pause:** when the page becomes hidden (`visibilitychange`) or the window loses focus
  (`blur`) while running.
- **Manual pause:** key **P** toggles between `running` and `paused`.
- **Resume:** **P**, or the jump input (Space, ↑, click, tap). The resume input does not also
  trigger a jump.
- On resume the tick backlog is reset to 0, so the game does not catch up on missed steps.
- The slider still works while paused; it sets the speed as described in `SPEC.md`.

## Visuals

- The frozen scene stays visible, slightly dimmed, with "Paused – press P or jump to continue"
  in the accent color.
- `#status` announces "Paused." and "Running." (polite live region).

## Interaction with the speed rule

No simulation steps run while paused, so the speed does not grow. This follows the rule exactly:
growth is counted per step, not per second.

## Edge cases

- Automatic pause never fires in `ready` or `over`.
- Pressing P in `ready` or `over` does nothing.
- Returning to the tab does **not** resume automatically; the player decides.

## Acceptance criteria

- [x] `window.strays.phase` reports `paused`.
- [x] Speed after 1 s of pause equals the speed when pausing.
- [x] After resuming, the speed grows by about 0.06 per second again.
- [x] Dispatching `visibilitychange` with `document.hidden === true` while running pauses the game.

## Out of scope

A pause menu, a pause button in the page (may follow later if touch players ask for it).
