# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Gonzalo's Game Space: a public, no-login kids' game site (ages ~6–12) hosted by Gonzalo and deployed on Vercel. Spec, plan and tasks live in `specs/001-kids-game-space/`.

Stack: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Zod, gray-matter, lucide-react. Tests: Vitest and Playwright with axe-core. Next.js 16 differs from older versions; check `node_modules/next/dist/docs/` before using Next APIs.

## Commands

- `npm run dev`: dev server at http://localhost:3000
- `npm run build`: production build (also validates all `content/` files)
- `npm run lint`: ESLint
- `npm test`: Vitest unit tests (`tests/unit/**/*.test.{ts,tsx}`)
- Single unit test: `npx vitest run tests/unit/catch-it.test.ts -t "ends after 30 seconds"`
- `npm run test:e2e`: Playwright (builds, then serves on port 3100; projects `mobile` at 375px with touch and `desktop` at 1440px)
- Single e2e test: `npx playwright test tests/e2e/games.spec.ts -g "Memory" --project=desktop`
- On this WSL machine Chromium is missing `libnss3`, `libnspr4` and `libasound2`. Either `sudo npx playwright install-deps chromium`, or extract the `.deb`s with `apt-get download` and `dpkg-deb -x`, then point `LD_LIBRARY_PATH` at them.

## Architecture

- **Content is data in the repo, not a backend.** `content/site.json`, `content/games.json`, `content/videos.json` and `content/announcements/*.md` are loaded and Zod-validated by `lib/content.ts` at build time. Invalid content throws `ContentError` (file and field), which fails the build. All pages are statically prerendered.
- **English and Spanish.** Every route lives under `app/[lang]/` (`en` or `es`; `dynamicParams = false` on the layout). `proxy.ts` redirects paths without a locale using `Accept-Language`; the URL carries the choice, with no cookie. UI strings are in `lib/i18n.ts` (the `es` dictionary is typed against `en`). Server components call `getDictionary(lang)`; client components use `useT()`/`useLocale()` from `components/I18nProvider.tsx`. Content getters take a locale and fall back to English when a Spanish field (`es` object, `titleEs`, `bodyEs`) is missing. Internal links must include the `/${locale}` prefix. `app/[lang]/[...rest]` makes unknown paths render the translated `not-found.tsx`.
- **Games are isolated.** Each lives in `games/<slug>/`, with pure rules in `logic.ts` (unit-tested, RNG injected) and a `"use client"` UI component taking `GameProps` (`games/types.ts`). It calls `onFinish({ headline, detail?, score? })` once per round. `games/registry.ts` maps slug to loader and optional `scoring`. `app/[lang]/games/[slug]/page.tsx` uses `dynamicParams = false`, so unknown and coming-soon slugs 404, and the build throws if a playable game has no registry entry.
- **Garden Guard** (`games/garden-guard/`) is a DOM-rendered lane-defense game. `logic.ts` steps plants, peas and snails. The component keeps the latest state in a ref so plant taps and animation frames never race, and uses a roving-tabindex grid.
- **Brand**: `components/Logo.tsx` (the white "G" with a yellow play triangle in its bowl, plus the wordmark) and `app/icon.svg` share one drawing; keep them in sync.
- **Super Jump** (`games/super-jump/`) is a canvas platformer. `logic.ts` has fixed-step physics over a tile level (`LEVEL_1` is built in code), `draw.ts` renders a frame, and `SuperJump.tsx` runs a `requestAnimationFrame` loop that keeps game state in a closure and only calls `setHud` when coins, lives or status change.
- **`components/game-shell/GameShell.tsx`** owns the intro → playing → finished flow, preloads the game component during the intro, moves focus to each phase's heading, and records best scores through `lib/storage.ts`.
- **Design tokens** are in `app/globals.css` under `@theme`. `tests/unit/contrast.test.ts` reads that file and enforces 4.5:1 for every text/background pair used, so add new pairs there. Card colour classes are static maps in `components/colors.ts`, because Tailwind can't see dynamic class names.

## Audience constraints (must hold)

- No accounts, chat, comments, cookies, analytics, ads or third-party scripts. `tests/e2e/privacy.spec.ts` checks requests and cookies. The CSP in `next.config.ts` only allows `'self'`.
- The only external links are host-curated YouTube URLs in `content/videos.json` (schema-restricted to YouTube). They are shown via `components/VideoList.tsx` behind an "ask a grown-up" dialog, open in a new tab with `rel="noopener noreferrer"`, and load no embeds or thumbnails.
- Best scores live only in `localStorage` (`gks:best:<slug>`), with every access wrapped in try/catch.
- Accessibility: tap targets ≥ 44px, visible focus (yellow outline), keyboard-playable games, never colour alone, reduced motion respected, no functional emoji (use `components/ui/Icon.tsx`).
