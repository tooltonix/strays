# Protocol: rebuilding the REA dino demo (16 Oct 2026)

Goal: use REA to find the speed rule of the Chrome dino game ourselves (wayou's browser build,
Chromium code under the BSD license) and build our own tiny game from it (clean room).

## Environment and deviations from the original demo

- REA `rea-agents` 6.5.0 via `npx`, **without** `rea setup`: CLI instead of MCP registration.
  `doctor` reports missing Ghidra/Hopper/IDA/JADX – not needed for JavaScript.
- Cloud container: `wayou.github.io` and `rea.tools` blocked by the network filter. Therefore
  the original files were mirrored from `raw.githubusercontent.com/wayou/t-rex-runner/gh-pages/`
  and served locally with `python3 -m http.server 8765`. The browser guide was not readable →
  used the REA guide shipped with the package, `skills/.../runtime-observation.md`, instead.
- Browser: Chromium 141 headless with `--remote-debugging-port=9222`.

## Steps and REA output

### 1. Find the browser target

```text
$ rea list-browser-targets http://127.0.0.1:9222
predicate_type: rea.browser-target-list
targets[1]{target_id,type,title,url,origin,attached}:
  B9A4D40E…,page,"chrome easter egg: t-rex runner","http://127.0.0.1:8765/",…
```

### 2. Capture the page passively, including script sources

```text
$ rea inspect-web-page http://127.0.0.1:9222 B9A4D40E… --include-script-sources --observation-ms 2000
predicate_type: rea.web-page-inspection
scripts.total: 2
scripts.items[0].url: http://127.0.0.1:8765/index.js   length: 90241   is_module: false
completeness.status: policy_filtered  (accessibility texts not released – as requested)
```

REA stresses that the observation is passive: REA does not click and does not run page
JavaScript.

### 3. Export the scripts and analyse them statically

```text
$ rea export-web-scripts <capture.json> <folder>
  → files/origins/<hash>/index.js (90241 bytes) + 1 inline script (207 bytes)

$ rea analyze-javascript-application <folder>/files
  parsed_javascript_files: 2, visited_ast_nodes: 9832
  semantic_graph: 4222 nodes, 2388 relations, 111 functions
  "JavaScript and HTML were parsed as inert text; bundle bootstrap code was never executed."
```

### 4. Filter the semantic graph for speed

Evaluation of the REA graph (nodes with "speed" in the identifier, 115 hits). The relevant ones:

| Line | REA node | Meaning |
|---|---|---|
| 43 | `read:/config/SPEED` → `write:/currentSpeed` | start value on initialisation |
| 569 | `read:/currentSpeed`, `read:/config/MAX_SPEED` | comparison with the cap |
| 570 | `read:/config/ACCELERATION` → `write:/currentSpeed` | increase |
| 531–611 | anonymous function | update loop containing 569/570 |
| 833 | `read:/setSpeed`, `read:/config/SPEED` | restart sets the start value |
| 343 | `read:/config/MOBILE_SPEED_COEFFICIENT` | special case for narrow screens |

What REA did **not** deliver here: the numeric values of the configuration object (the graph
marks the configuration reads as "unknown coverage"). `rea search` only works with native
analysis engines (Ghidra/Hopper/IDA) and rejects JavaScript
(`capability_unavailable … target_kind_unsupported`).

### 5. Read the evidence locations directly

Only the lines named by REA and the configuration entries were read:

- Lines 565–570: increase only in the "no collision" branch, only while below the maximum.
- Configuration: `ACCELERATION` 0.001, `MAX_SPEED` 13, `SPEED` 6; tick `FPS = 60`.
- Line 833: restart sets the start value again.

### 6. Cross-check in the running game (own measurement, not REA)

Via Playwright over the same CDP connection; obstacles are removed so only the acceleration
matters. This is deliberately an active intervention and therefore not done with REA, which
only observes passively.

- Increase in the original: ~0.12 per second in headless Chromium (≈ 120 updates/s).
- Cap: from 12.9905 it rises to 13.0005 and stays there.
- Collision: the speed freezes. Restart: back to ~6.

## The rule found (in our own words)

Start at 6. Per update without a collision +0.001, as long as below 13. A restart resets to 6.

## Findings

1. **Confirmed**: the values on rea.tools (6 / 0.001 / 13) are correct – derived here
   independently.
2. **Additional finding**: the increase is tied to every rendered frame, not to time. On 120 Hz
   screens the game speeds up twice as fast. At 60 Hz it takes (13 − 6) / 0.001 = 7000 frames
   ≈ 1 min 57 s to reach the maximum.
3. **Subtlety**: because the check happens before the addition, the final value can exceed 13
   slightly (13.0005 instead of 13).
4. **REA is a pilot, not an oracle**: it found the right places in 90 KB of code with solid
   evidence (lines, hashes, evidence IDs). The values and their meaning still had to be read
   and verified at those places by the agent or a human.
5. A **mobile special case** exists (coefficient 1.2 for narrow screens); not adopted for the
   demo.

## Rebuild "Strays" (clean room)

- `SPEC.md`: the only bridge between analysis and rebuild, rules in our own words only.
- `index.html`, `style.css`, `game.js`: vanilla JS + canvas, original graphics (cat, boxes),
  own physics and collision, fixed 60 Hz tick (makes the acceleration independent of the
  screen), slider 1–13 for the speed, license note in the footer.
- Automated test (Playwright, `test/test-game.mjs`): increase 0.0599 per second (target 0.06),
  a collision freezes the speed, a restart begins at 6, slider at 13 → stays at 13. No
  JavaScript errors (only a 404 for the missing `favicon.ico`).
- Screenshots: `screenshots/01-ready.png` … `screenshots/04-slider-13.png`.

## Prompt

The starting prompt was the task itself (paraphrased): "Use REA to examine the wayou dino page
according to the browser guide and find the speed rule yourself. Then build your own tiny game
with a speed slider that only uses the researched rule – clean room, no code from the
original."
