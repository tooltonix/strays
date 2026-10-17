# Strays – notes for Claude

Read this first when picking the project up again. Last updated 2026-10-17, end of the first
work session.

## Rules from the owner

- **Do not merge anything into `main`.** All work stays on the branch
  `ccr-18a99102-xe8ij1` until the owner says otherwise. No pull request unless asked.
- **Do not deploy or publish** anything (no artifact updates, no PR) without being asked.
- Work **specs first**: write or update the spec in `specs/`, then build, then tick its
  acceptance criteria with what the test actually showed. Leave a box unticked and say why when
  something was not measured.
- Talk to the owner in **German**; code, specs, comments and commit messages stay in English.
- In the first session the owner asked Claude to speak like HAL 9000 (and called themselves
  Dave). Ask whether that should continue before using it again.

## What the project is

A tiny browser game: a cat jumps over boxes. Built as a clean-room example for a blog post on
promptandpixel.dev about reverse engineering with REA. Only the speed rule is borrowed from the
Chromium dino game (start 6, +0.001 per step without a collision, max 13, fixed 60 Hz tick, see
`SPEC.md`). Everything else is original. No dependencies, no build: `index.html`, `style.css`,
`game.js`.

## Where we stopped

Spec overview and principles: `specs/README.md`. Status of the features:

| Spec | Feature | State |
| --- | --- | --- |
| 01 | Favicon | done (Firefox not checked) |
| 02 | Pause (P, automatic on tab switch) | done |
| 03 | Sound, set A blips, M / button | done (not heard on real speakers in the game yet) |
| 04 | Effects: dust, squash, shake, score flash | done (frame time not measured on a laptop) |
| 05 | Day and night | **open, the only spec not built** |
| 06 | High score in localStorage | done |
| 07 | Jump control: hold for high jump, ↓ to fall faster | done |
| 08 | Box stacks, rows, pigeons, ducking | done |
| 09 | Fish bones, cat grows (4 sizes), shrinks on pigeon hits | done (about one fish per two obstacles) |
| 10 | Touch buttons under the playfield | done (not tried on a real phone) |

## Open decisions and ideas

- **Touch controls in landscape:** Claude recommended keeping the buttons under the playfield in
  portrait, and using invisible zones on the playfield in landscape (left third ducks, the rest
  jumps, with a short see-through hint at the start of a run). The owner wanted to try the
  current version on a phone first. Not decided, not specified.
- **Bigger playfield on phones:** in portrait the 720 × 200 canvas is only about 95 px high and
  the cat is tiny. Possible, but a bigger change; only mentioned.
- **Seeded randomness for tests:** proposed so test runs repeat exactly and grow the cat
  faster. Not decided.
- **Slider moved up during a run:** obstacles already spaced for the lower speed arrive too
  close. Accepted and noted in spec 08; could be fixed by respacing on slider change.
- **Sounds:** every cue uses set A (simple oscillator blips). The owner chose this for all
  future sounds too. The cat voice set was tried and rejected.

## Testing

`test/test-game.mjs` (Playwright) prints JSON with all measurements and saves screenshots.
In the cloud container:

```bash
python3 -m http.server 8766 &   # from the repo root
ln -s /opt/node-tools/node_modules node_modules   # ignored by .gitignore; remove afterwards
CHROMIUM_PATH=/opt/pw-browsers/chromium node test/test-game.mjs screenshots
BOT_SECONDS=300 ...   # the long run with the scripted player (default 60 s)
```

A normal run takes about 3 minutes. Check `errors: []`, `speedRuleOk`, `pageStill` and the
scripted player's `phase: "running"`. The game exposes a read-only hook `window.strays` for the
test; keep it read-only.

## Pages made in the first session (private artifacts)

- Sound check page with both sound sets: https://claude.ai/artifact/SgNo9gReng662PGh1jC77T
- Playable build of the game (state of commit `40eefac`):
  https://claude.ai/artifact/XE21MSPvGBm6HMMJ7zwCio
