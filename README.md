# Gonzalo's Game Space

A game site for kids and young teens (about 10–14), hosted by Gonzalo and deployed on Vercel. Friends open a link, pick a game, and play. Logging in is optional and only saves best scores and leaderboard places; there is no chat, ads or tracking. Without logging in, best scores stay in each player's own browser.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (game logic, content, colours)
npm run test:e2e   # browser tests (builds the site first)
npm run lint
npm run build
```

## For Gonzalo: sharing news and highlights

Everything you share lives in the `content/` folder. Edit a file (the GitHub website editor works fine), commit, and Vercel puts the new version live in a minute or two. If you make a mistake, the build stops with a message naming the file and field, and the old site stays up.

### Post an announcement

Add a file to `content/announcements/`, named `YYYY-MM-DD-short-name.md`:

```markdown
---
title: "Catch It is here!"
date: 2026-10-01
gameSlug: catch-it
titleEs: "¡Ya llegó Atrápala!"
bodyEs: "Llegó un juego nuevo y veloz. ¿Puedes superar tu récord?"
---
A new speedy game just landed. Can you beat your best score?
```

- `title`: up to 60 characters.
- `date`: the newest date shows first.
- `gameSlug`: optional. It adds a "Play …" button for that game.
- The message is up to 400 characters of plain text, with no links or HTML.
- `titleEs` and `bodyEs`: optional Spanish versions. Without them, the Spanish site shows the English text.

### Spanish

The site comes in English (`/en`) and Spanish (`/es`). Visitors whose browser is set to Spanish land on `/es` automatically, and the button in the top corner switches languages. Most text files have an optional Spanish version next to the English:

- `content/site.json`: an `"es"` object with `name`, `tagline` and `welcome`.
- `content/games.json`: an `"es"` object on each game with `title`, `description` and `instructions`.
- Announcements: `titleEs` and `bodyEs` in the frontmatter (see above).
- Videos: `titleEs`.

### Share YouTube videos

Add links to `content/videos.json`:

```json
[
  { "title": "How to draw a dragon", "titleEs": "Cómo dibujar un dragón", "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX" }
]
```

- Only YouTube links are allowed: videos, shorts, playlists, or a channel like `https://www.youtube.com/@name`.
- `title`: up to 60 characters.
- Nothing from YouTube loads on the site itself. When a kid taps a video, the site first says "You're going to YouTube, ask a grown-up", then opens YouTube in a new tab.
- Only share videos you'd be happy for your friends' parents to see.

### Feature a game, mark it new, or tease one

Edit `content/games.json`:

- `"featured": true` puts the game in "Gonzalo's pick" at the top.
- `"status": "new"` adds a **New!** badge.
- `"status": "coming-soon"` shows a locked card that can't be opened yet.
- `"status": "available"` is a normal game.

### Change the welcome message

Edit `host.welcome` in `content/site.json` (up to 400 characters), and `es.welcome` for Spanish.

## Adding a new game

1. Create `games/<slug>/` with:
   - `logic.ts`: the rules as plain functions (easy to unit test).
   - `<Name>.tsx`: a `"use client"` component whose default export takes `{ onFinish }` (see `games/types.ts`). It calls `onFinish({ headline, detail?, score? })` once when a round ends. Get on-screen text from `useT()` and add English and Spanish strings to `lib/i18n.ts`.
2. Add one line to `games/registry.ts`. Include `scoring` if the game has a best score (`direction: "higher"` or `"lower"`, `unit`: `moves`, `stars` or `coins`).
3. Add an entry to `content/games.json`, with an `"es"` translation. Keep `title` to 30 characters, `description` to 80 and `instructions` to 160. `icon` must be one of `lib/icon-names.ts`, and `color` is one of `primary`, `secondary`, `accent`, `sun`, `mint` or `sky`.
4. Add `tests/unit/<slug>.test.ts` for the logic.

You don't need to touch any other game. The build fails if a playable game in `games.json` has no registry entry.

**Game checklist:** works with touch, mouse and keyboard; buttons are at least 44 px; it makes sense with the sound off; it has no violence, ads or links out.
