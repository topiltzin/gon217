# Quickstart: Validating the Kids Game Space

Prerequisites: Node.js 20+ (local: v24), npm. Commands below apply once the project is scaffolded (`/speckit-tasks` then `/speckit-implement`).

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## Validation scenarios

1. **Home and first play (US1, SC-001)** — Open `/` at 375 px wide. Confirm space name, Gonzalo as host, three game cards. Tap a card; the game opens and can be started in under 10 s. "Back" returns home.
2. **Each game round (US2, SC-002)** — For Memory Match, Catch It, and Tic-Tac-Toe: read instructions, start, finish a round, see the result, use "Play again", then "Back to games". Repeat using touch only, mouse only, and keyboard only.
3. **Host content (US3)** — Add a file under `content/announcements/`; it appears newest-first on `/`. Delete all announcements; the host welcome shows instead. Set `featured: true` on a game; it is highlighted.
4. **Growth (US4, SC-006)** — Mark a game `coming-soon`; its card is non-interactive and `/games/<slug>` returns 404. Add a dummy game entry plus registry line; it shows as a matching card without touching other games.
5. **Bad edit** — Break a field in `games.json`; `npm run build` fails with a message naming the field.
6. **Not found** — Visit `/nope`; friendly page with a link home.

## Automated checks

```bash
npm run lint
npm test           # Vitest: game logic, content loader
npm run test:e2e   # Playwright: smoke, keyboard, 375/768/1024/1440 px, axe scan
npm run build
```

Expected: all pass, zero critical axe violations, no horizontal scroll at any viewport, no third-party requests and no cookies in the network log.

## Deploy

1. Push the repo to GitHub and import it in Vercel (or `npm i -g vercel && vercel link && vercel deploy`).
2. Open the preview URL and repeat scenarios 1–2 on a real phone.
3. Merge to `main` for production; open the production URL and confirm HTTPS.
