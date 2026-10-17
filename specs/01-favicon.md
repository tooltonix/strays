# 01 – Favicon

## Goal

Give the tab its own icon and remove the 404 error the browser logs when it asks for
`/favicon.ico`.

## Behaviour

- `index.html` declares the icon with `<link rel="icon">` pointing to an inline SVG `data:` URI,
  so no extra file and no extra request are needed.
- The icon is a simple cat head seen from the front (two ears, two orange eyes) in the game
  colors: light shape (`#f2eee9`) on the dark surface (`#1b1b1b`), accent `#ff6b01`.
- It must stay recognisable at 16 × 16 px.

## Interaction with the speed rule

None.

## Edge cases

- Browsers that ignore SVG icons fall back to no icon; that is acceptable, but they must not log
  an error for a missing file.

## Acceptance criteria

- [x] `test/test-game.mjs` reports `"errors": []`.
- [x] The tab shows the cat icon in Chromium.
- [ ] The tab shows the cat icon in Firefox (not checked yet, no Firefox in the test setup).

## Out of scope

Web app manifest, touch icons, PNG fallbacks.
