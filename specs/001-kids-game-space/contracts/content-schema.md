# Contract: Host Content Files

This is the interface Gonzalo edits. Field rules are in [data-model.md](../data-model.md).

## `content/games.json`

```json
[
  {
    "slug": "memory-match",
    "title": "Memory Match",
    "description": "Flip cards and find the pairs!",
    "instructions": "Tap two cards to flip them. Find all the matching pairs.",
    "icon": "puzzle",
    "color": "primary",
    "status": "available",
    "featured": true
  }
]
```

## `content/announcements/2026-10-01-new-game.md`

```markdown
---
title: "Catch It is here!"
date: 2026-10-01
gameSlug: catch-it
---
A new speedy game just landed. Can you beat your best score?
```

## Rules for editors

- Add a game: create `games/<slug>/`, register it in `games/registry.ts`, add a `games.json` entry.
- Change status/featured: edit the entry in `games.json`.
- Announce: add one markdown file to `content/announcements/`.
- An invalid edit fails the build with a message naming the file and field; the live site is unaffected.
- Keep text kid-safe: no personal contact details, no external links.
