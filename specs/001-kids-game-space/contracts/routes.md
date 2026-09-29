# UI Contract: Routes and Page Behavior

The site exposes only public, read-only pages. No API endpoints, forms, or cookies.

| Route | Purpose | Requirements |
|-------|---------|--------------|
| `/` | Home: hero + "Play now", host welcome, featured game(s), game grid, announcements | FR-001..003, 011..013 |
| `/games/{slug}` | Game shell: title, instructions, game, result panel, "Back to games" | FR-004, 006..009 |
| any other | Friendly not-found page with link home (HTTP 404) | FR-005 |

## Behavior rules

- `/games/{slug}` returns 404 for unknown slugs and for `coming-soon` games.
- Every page has: skip-to-content link, header with home link, visible focus, `lang` attribute, page title naming the game/site.
- Home game grid order: featured first, then `new`, then `available`, then `coming-soon`.
- Each game card is a single link (whole card tappable, ≥ 44 px), except `coming-soon` cards, which are non-interactive and labelled.
- Game shell states: `intro` → `playing` → `finished`; `finished` shows result plus "Play again" and "Back to games". Leaving mid-round discards state.
- Game shell keyboard contract: all controls reachable by Tab; Enter/Space activates; games document extra keys (arrows, etc.) in their instructions.
- No page loads third-party scripts or sets cookies.
