# Tasks: Gonzalo's Kids Game Space

**Input**: Design documents in `specs/001-kids-game-space/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)
**Prerequisites**: plan.md, spec.md
**Tests**: The plan specifies Vitest (game logic, content loader) and Playwright + axe (smoke, keyboard, viewports, accessibility), so test tasks are included. Write each test before its implementation and confirm it fails first.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1–US4 map to the user stories in spec.md

---

## Phase 1: Setup

- [X] T001 Scaffold a Next.js (App Router) + TypeScript + Tailwind CSS project in the repo root (`package.json`, `tsconfig.json`, `next.config.ts`, `app/`); confirm current setup commands from official docs first
- [X] T002 [P] Add dependencies `zod`, `gray-matter` (markdown frontmatter), `lucide-react` (icons), and dev dependencies `vitest`, `@testing-library/react`, `jsdom`, `@playwright/test`, `@axe-core/playwright` in `package.json`
- [X] T003 [P] Configure ESLint/Prettier and add scripts `lint`, `test`, `test:e2e`, `build` in `package.json`
- [X] T004 [P] Configure Vitest in `vitest.config.ts` and Playwright in `playwright.config.ts` (projects for viewports 375, 768, 1024, 1440 px; web server `npm run dev`)
- [X] T005 [P] Add `.gitignore` entries (`node_modules`, `.next`, `.vercel`, `playwright-report`) in `.gitignore`

---

## Phase 2: Foundational (blocks all user stories)

- [X] T006 Define design tokens as CSS variables in `app/globals.css`: primary `#7C3AED`, secondary `#A78BFA`, accent `#F43F5E`, background `#0F0F23`, card `#1E1C35`, foreground `#E2E8F0`, muted `#27273B`, muted-foreground `#94A3B8`, border `#4C1D95`; 8 px spacing scale; 150–300 ms transition tokens; `@media (prefers-reduced-motion: reduce)` disabling non-essential animation (FR-016, FR-020)
- [X] T007 [P] Write a contrast-check unit test for every text/background token pair (≥ 4.5:1, including text on the rose accent) in `tests/unit/contrast.test.ts`, and adjust tokens in `app/globals.css` until it passes (FR-018)
- [X] T008 Create root layout with Fredoka (headings) and Nunito (body) via `next/font`, `lang="en"`, skip-to-content link, header with home link, and footer in `app/layout.tsx` (FR-003, FR-019)
- [X] T009 [P] Build base UI components: tactile `Button` (min 44×44 px, ≥ 8 px gaps, visible pressed/hover/focus states) in `components/ui/Button.tsx` and `Icon` wrapper (SVG icons, decorative icons `aria-hidden`, no emoji) in `components/ui/Icon.tsx` (FR-017, FR-022)
- [X] T010 [P] Build `Badge` (New / Coming soon / Featured; text label, not colour alone) in `components/Badge.tsx` (FR-018)
- [X] T011 [P] Write content loader unit tests (valid data passes; each violated rule below fails with a message naming file and field) in `tests/unit/content.test.ts`
- [X] T012 Implement Zod schemas and loader in `lib/content.ts` enforcing the data-model constraints: Site `name` 1–40 chars, `tagline` ≤ 100 chars, `host.name` required, `host.welcome` required ≤ 400 chars, `host.avatar` optional and requires `host.avatarAlt`; Game `slug` unique lowercase-kebab, `title` ≤ 30, `description` ≤ 80, `instructions` ≤ 160, `icon` required, `color` in palette tokens, `status` in `available | new | coming-soon`, `featured` default false; Announcement `title` ≤ 60, `date` ISO date, optional `gameSlug` must reference an existing Game, `body` ≤ 400 chars with no raw HTML and no external links; sort games featured → new → available → coming-soon and announcements newest first
- [X] T013 [P] Implement safe storage wrapper (try/catch around every read/write, corrupt values treated as "no best yet", key `gks:best:<slug>` → `{ best, updatedAt }`) in `lib/storage.ts`, with a test in `tests/unit/storage.test.ts` (FR-009)
- [X] T014 [P] Add initial content: `content/site.json` (space name, tagline, host Gonzalo, welcome text) and `content/games.json` (memory-match, catch-it, tic-tac-toe entries with kid-friendly `instructions`) per `contracts/content-schema.md`
- [X] T015 Build shared game shell in `components/game-shell/GameShell.tsx` with states `intro → playing → finished`, instruction panel, visible "Play" control, "Back to games" link; `ResultPanel.tsx` (result/score, "Play again", "Back to games"); `ScoreBoard.tsx`; and `useBestScore.ts` hook using `lib/storage.ts` (FR-007, FR-009)
- [X] T016 Create game registry mapping slug → lazily loaded component in `games/registry.ts` (empty map initially, typed `Record<string, () => Promise<{default: ComponentType}>>`)

**Checkpoint**: Content loads and validates, shell and tokens ready; user stories can start.

---

## Phase 3: User Story 1 – Land on a fun home page and start playing (P1) 🎯

**Goal**: A welcoming home page with game cards; one tap opens a game; no dead ends.
**Independent test**: At 375 px, open `/`, see name + Gonzalo + a card for each game, open a game, return home (needs at least one game from US2 to complete the tap-through).

### Tests for US1

- [X] T017 [P] [US1] Playwright smoke test (`/` shows site name, host name, one card per game; tap card opens `/games/{slug}`; back link returns home) in `tests/e2e/home.spec.ts`
- [X] T018 [P] [US1] Playwright test for not-found (`/nope` → 404 page with home link; `/games/unknown` → 404) in `tests/e2e/not-found.spec.ts`

### Implementation for US1

- [X] T019 [P] [US1] Build `GameCard` as one whole-card link (≥ 44 px, title, short description, icon, badge slot) in `components/GameCard.tsx` (FR-001, FR-002)
- [X] T020 [P] [US1] Build `Hero` (space name, tagline, primary "Play now" call to action, at most 1–2 animated elements, reduced-motion safe) in `components/Hero.tsx` (FR-001, FR-016, FR-020)
- [X] T021 [US1] Compose home page (Hero → game grid → repeated call to action) using `lib/content.ts` in `app/page.tsx`, responsive 375–1440 px with no horizontal scroll or layout shift (FR-021)
- [X] T022 [US1] Implement `app/games/[slug]/page.tsx`: pre-render known slugs, 404 for unknown and `coming-soon` slugs, render `GameShell` with the game from `games/registry.ts`, page title names the game (FR-004, FR-005)
- [X] T023 [P] [US1] Build friendly not-found page with link home in `app/not-found.tsx` (FR-005)

**Checkpoint**: Home works end to end once one game is registered.

---

## Phase 4: User Story 2 – Play simple, fun, understandable games (P1)

**Goal**: Three quick games playable with touch, mouse, and keyboard, each with instructions, feedback, results, and replay.
**Independent test**: For each game, start, finish a round, see the result, "Play again", "Back to games", using each input type.

### Memory Match

- [X] T024 [P] [US2] Unit tests for pure logic (shuffle with injected RNG, pair matching, win detection, move count) in `tests/unit/memory-match.test.ts`
- [X] T025 [US2] Implement pure logic in `games/memory-match/logic.ts`
- [X] T026 [US2] Implement UI in `games/memory-match/MemoryMatch.tsx`: cards as real `<button>`s with accessible names (state "face down / flipped / matched"), keyboard navigable, score = fewer moves better; register in `games/registry.ts`

### Catch It

- [X] T027 [P] [US2] Unit tests for pure logic (30 s round timer, spawn positions with injected RNG, scoring, game end) in `tests/unit/catch-it.test.ts`
- [X] T028 [US2] Implement pure logic in `games/catch-it/logic.ts`
- [X] T029 [US2] Implement UI in `games/catch-it/CatchIt.tsx`: large tappable targets (≥ 44 px), keyboard alternative (targets focusable, Enter/Space catch), no audio required, reduced motion slows/limits movement; register in `games/registry.ts`

### Tic-Tac-Toe

- [X] T030 [P] [US2] Unit tests for pure logic (win/draw detection, simple computer move never illegal, two-player mode) in `tests/unit/tic-tac-toe.test.ts`
- [X] T031 [US2] Implement pure logic including a simple computer opponent in `games/tic-tac-toe/logic.ts`
- [X] T032 [US2] Implement UI in `games/tic-tac-toe/TicTacToe.tsx` with choice of "vs computer" or "two players on one device", cells as buttons with accessible names, result via shared `ResultPanel`; register in `games/registry.ts`

### Cross-game

- [X] T033 [US2] Playwright keyboard-only and touch-only flow through each game (intro → play → finish → play again → back) in `tests/e2e/games.spec.ts` (FR-008)
- [X] T034 [US2] Verify reduced-motion behaviour and no-audio comprehension across all three games; fix issues in the game components (FR-008, FR-020)

**Checkpoint**: US1 + US2 = playable MVP.

---

## Phase 5: User Story 3 – Gonzalo shares news and content (P2)

**Goal**: Host welcome, dated announcements (newest first), and featured game highlight on the home page.
**Independent test**: Add an announcement file and see it on `/`; remove all and see the welcome message; set `featured: true` and see the highlight.

- [X] T035 [P] [US3] Playwright test for announcements order, empty-state welcome, and featured highlight in `tests/e2e/host-content.spec.ts` (empty state covered by `tests/unit/announcement-list.test.tsx`, since it can't be reached on a built site)
- [X] T036 [P] [US3] Add sample announcement `content/announcements/2026-10-01-welcome.md` (frontmatter `title`, `date`, optional `gameSlug`; body ≤ 400 chars, no links) — added as `2026-09-28-welcome.md` and `2026-09-29-catch-it.md` so no post is future-dated
- [X] T037 [P] [US3] Build `HostWelcome` (name, welcome text, optional avatar with `avatarAlt`) in `components/HostWelcome.tsx` (FR-011)
- [X] T038 [P] [US3] Build `AnnouncementList` (newest first, dated, optional link to the referenced game, friendly default when empty) in `components/AnnouncementList.tsx` (FR-012)
- [X] T039 [US3] Add HostWelcome, featured highlight above the grid, and AnnouncementList to `app/page.tsx` (FR-013)
- [X] T040 [US3] Extend loader in `lib/content.ts` to read `content/announcements/*.md` via `gray-matter`, reject raw HTML and external links in `body`, and fail the build with a readable file/field message (FR-014) — implemented with T012

---

## Phase 6: User Story 4 – Keep growing the space (P3)

**Goal**: New games and content can be added without touching existing games; "New" and "Coming soon" states behave correctly.
**Independent test**: Add a game entry + registry line and see a consistent card; mark one `coming-soon` and confirm it is non-interactive with a 404 route.

- [X] T041 [P] [US4] Playwright test for `new` badge, non-interactive `coming-soon` card, and `/games/{coming-soon-slug}` 404 in `tests/e2e/growth.spec.ts`
- [X] T042 [US4] Render `coming-soon` cards as non-interactive, labelled elements and `new` badge in `components/GameCard.tsx` (FR-013)
- [X] T043 [US4] Add an add-a-game checklist (folder in `games/<slug>/`, registry line, `games.json` entry) and host content editing guide to `README.md` (FR-015, SC-006, SC-007)

---

## Phase 7: Polish & Cross-Cutting

- [X] T044 [P] Playwright viewport tests at 375/768/1024/1440 px asserting no horizontal scroll and no layout shift on `/` and each game in `tests/e2e/responsive.spec.ts` (FR-021, SC-004)
- [X] T045 [P] axe-core scan of `/`, each game, and the 404 page with zero critical/serious violations in `tests/e2e/a11y.spec.ts` (SC-005)
- [X] T046 [P] Add security headers (CSP limited to self and fonts, frame denial, referrer policy) in `next.config.ts` and a Playwright assertion that there are no third-party requests and no cookies in `tests/e2e/privacy.spec.ts` (FR-023, FR-024)
- [X] T047 [P] Add SVG icons/cover art for each game and host avatar placeholder (with alt text or decorative marking) in `public/` — done as inline lucide SVG icon tiles per game, an initial-letter avatar placeholder (decorative), and `app/icon.svg`; no files needed in `public/`
- [X] T048 Performance pass: verify per-game code splitting, `next/font` layout stability, CLS < 0.1, and home content under 3 s on throttled mobile; fix findings (SC-003) — FCP 1.0–1.8 s and game start 1.5–1.8 s at 4× CPU + slow 4G; replaced `React.lazy` with a preloaded component (was 2.4–3.2 s). Turbopack bundles all three games into one ~24 KB chunk, which is acceptable at this size
- [ ] T049 Run every scenario in `quickstart.md` (locally and on a real phone) and record results — scenarios 1–6 verified locally (automated e2e + manual bad-edit build check); **real-phone check still to do**
- [ ] T050 Connect the repo to Vercel (Git import or `vercel link`), verify the preview URL, then promote to production and confirm HTTPS (FR-025) — **needs the owner's Vercel account; not done**
- [X] T051 Update `CLAUDE.md` with the chosen stack and the build, dev, lint, test, and single-test commands

---

## Phase 8: Amendment 1 — Spanish, YouTube links, Super Jump

- [X] T052 Add English/Spanish dictionaries, `negotiateLocale`, and `useT`/`useLocale` in `lib/i18n.ts` and `components/I18nProvider.tsx` (FR-026)
- [X] T053 Move routes under `app/[lang]/`, add `proxy.ts` Accept-Language redirect, `LanguageSwitcher`, translated `not-found.tsx`, and `[...rest]` catch-all (FR-026)
- [X] T054 Add optional Spanish fields to site, games, and announcements in `lib/content.ts` and translate all content in `content/` (FR-026)
- [X] T055 Translate every component and the three existing games (FR-026)
- [X] T056 Add `content/videos.json` (YouTube-only schema) and `components/VideoList.tsx` with the grown-up dialog (FR-027, FR-028)
- [X] T057 Write unit tests for Super Jump physics in `tests/unit/super-jump.test.ts`
- [X] T058 Implement `games/super-jump/logic.ts` (physics, slimes, coins, checkpoint, lives, `LEVEL_1`), `draw.ts`, and `SuperJump.tsx`; register it (FR-029)
- [X] T059 Unit tests for i18n, Spanish content, videos, and VideoList; e2e `tests/e2e/i18n.spec.ts` and Super Jump flows in `tests/e2e/games.spec.ts`; add new pages to the a11y, responsive, and privacy specs
- [ ] T060 Gonzalo adds real YouTube links to `content/videos.json`

---

## Phase 9: Amendment 2 — Garden Guard, brand logo

- [X] T061 Write unit tests for Garden Guard in `tests/unit/garden-guard.test.ts` and implement `games/garden-guard/logic.ts` (planting, sunshine, peas, munching snails, waves, hearts) (FR-030)
- [X] T062 Build `games/garden-guard/GardenGuard.tsx` (plant picker, keyboard grid, HUD), register it, and add EN/ES strings and content (FR-030)
- [X] T063 Design `components/Logo.tsx` and `app/icon.svg`, and use them in the header and hero (FR-031)
- [X] T064 Add Garden Guard e2e flows and include it in the a11y, responsive, and privacy specs

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → user stories → Polish.** Phase 2 blocks everything.
- **US1** needs Phase 2. Its tap-through test also needs at least one game from **US2**.
- **US2** needs Phase 2 (shell, registry, storage); the three games are independent of each other.
- **US3** needs Phase 2 and the home page from US1 (T021).
- **US4** needs US1 (`GameCard`, T019) and the loader.
- **Polish** needs the stories it verifies.
- Within a story: tests first (confirm failing) → logic → UI → integration.

## Parallel Examples

- Setup: T002, T003, T004, T005 together after T001.
- Foundational: T007, T009, T010, T011, T013, T014 together (T006 first for tokens; T012 after T011).
- US2: the three games (T024–T026, T027–T029, T030–T032) can be built by different people at once.
- US3: T035–T038 together, then T039–T040.
- Polish: T044–T047 together.

## Implementation Strategy

1. **MVP** = Phase 1 + Phase 2 + US1 + US2 (home page and three playable games), then deploy a preview (T050) to get friends' feedback.
2. **Increment 2**: US3 (host voice and announcements).
3. **Increment 3**: US4 (growth affordances) and Polish, then production.
4. Stop and validate against `quickstart.md` after each checkpoint.
