# Implementation Plan: Gonzalo's Kids Game Space

**Branch**: `001-kids-game-space` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-kids-game-space/spec.md`

## Summary

A public, no-login kids' game site hosted on Vercel: a playful home page (hero, game-card grid, host welcome, announcements, featured/new/coming-soon badges) plus three simple games at shareable URLs. Host content (announcements, featured flags, game catalogue) lives as version-controlled files that Gonzalo edits and pushes; every push redeploys. No backend, database, accounts, or tracking. Best scores live in the player's own browser storage only.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 (local: v24.21.0)
**Primary Dependencies**: Next.js (App Router, latest stable), React, Tailwind CSS, Zod (content validation at build time). No game engine: games are DOM/CSS + small React state machines. Fonts via `next/font` (Fredoka, Nunito).
**Storage**: None server-side. Content = files in repo (`content/`). Best scores = `localStorage` per device, wrapped in try/catch.
**Testing**: Vitest + React Testing Library (game logic and components), Playwright (smoke, keyboard, viewport checks), axe via Playwright (accessibility).
**Target Platform**: Vercel (static/pre-rendered pages); current mobile and desktop browsers.
**Project Type**: Single web application.
**Performance Goals**: Home page meaningful content < 3 s on typical mobile (SC-003); game start < 2 s; CLS < 0.1; small JS per game route.
**Constraints**: No personal data, no third-party trackers, no ads (FR-023/024); WCAG-minded: 4.5:1 contrast, 44px targets, keyboard, reduced motion; 375–1440px responsive.
**Scale/Scope**: Friends-scale traffic; ~4 page types; 3 launch games.

## Constitution Check

No `.specify/memory/constitution.md` exists, so there are no formal gates. Self-imposed gates from the spec: (1) no personal data or comms features, (2) accessibility requirements FR-016..022, (3) adding a game must not touch existing games (FR-015). The design below satisfies all three. Re-checked after Phase 1: pass.

## Project Structure

### Documentation (this feature)

```text
specs/001-kids-game-space/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes.md
│   └── content-schema.md
├── checklists/requirements.md
└── tasks.md          # created later by /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── layout.tsx                 # fonts, theme tokens, skip link, header/footer
├── page.tsx                   # home: hero, host welcome, featured, game grid, news
├── games/[slug]/page.tsx      # game shell (instructions, back link) + game component
├── not-found.tsx              # friendly oops page
└── globals.css                # design tokens (colors, spacing, motion)
components/
├── GameCard.tsx, Hero.tsx, HostWelcome.tsx, AnnouncementList.tsx, Badge.tsx
├── game-shell/                # shared GameShell, ResultPanel, ScoreBoard, useBestScore
└── ui/                        # Button, Icon
games/
├── registry.ts                # slug -> lazy game component
├── memory-match/              # logic.ts (pure), MemoryMatch.tsx
├── catch-it/                  # logic.ts (pure), CatchIt.tsx
└── tic-tac-toe/               # logic.ts (pure, incl. simple AI), TicTacToe.tsx
content/
├── site.json                  # name, host profile, welcome text
├── games.json                 # catalogue
└── announcements/*.md         # one file per announcement (frontmatter + body)
lib/
├── content.ts                 # load + Zod-validate content, sort, filter
└── storage.ts                 # safe localStorage wrapper
public/                        # icons, host avatar, cover art (SVG/WebP)
tests/
├── unit/                      # game logic, content loader
└── e2e/                       # smoke, keyboard, responsive, a11y
```

**Structure Decision**: Single Next.js project. Games are isolated folders with pure logic separated from UI, registered in one `registry.ts`; adding a game = new folder + one registry line + one `games.json` entry (FR-015, SC-006).

## Phase Summary

- **Phase 0** → [research.md](research.md): stack, content-update model, games, design tokens, privacy.
- **Phase 1** → [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

## Complexity Tracking

No constitution violations. Deliberately avoided: database, CMS, auth, admin UI, game engine, analytics SDK.
