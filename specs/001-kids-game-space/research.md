# Research: Gonzalo's Kids Game Space

No NEEDS CLARIFICATION items remained after the spec; the decisions below resolve the technical unknowns.

## R1. Framework and hosting
- **Decision**: Next.js (App Router) + TypeScript, deployed on Vercel with Git-connected deploys (preview per branch, production on `main`).
- **Rationale**: Vercel is a stated requirement; Next.js has zero-config Vercel support, pre-rendering gives fast first paint, per-route code splitting keeps each game's JS small, and `next/font` avoids layout shift.
- **Alternatives**: Vite + React SPA (fine, but less built in for routing, fonts, 404s); Astro (excellent for content, but interactive games make React islands the majority anyway); plain HTML/JS (fastest to start, poor for growth).
- **Note**: Confirm exact current Next.js/Tailwind versions and setup commands from official docs (context7) when scaffolding.

## R2. How Gonzalo shares content (host content model)
- **Decision**: Files in the repo (`content/site.json`, `games.json`, `announcements/*.md`), validated at build time with Zod. Gonzalo (or a helper) edits and pushes; Vercel redeploys. GitHub's web editor makes this doable without a local setup.
- **Rationale**: Satisfies FR-011..015 with no backend, no auth surface, and no child data. Matches the spec assumption that an in-site admin is out of scope.
- **Alternatives**: Headless CMS (Vercel Marketplace) — more moving parts and accounts; Vercel Blob/Edge Config + admin page — needs auth, larger risk surface; deferred as a future iteration.

## R3. Games and state
- **Decision**: Three games — Memory Match, Catch It (tap/reaction, timed 30 s), Tic-Tac-Toe (vs simple computer, or two players on one device). Each has pure logic in `logic.ts` (deterministic, unit-testable, injectable RNG) and a thin React UI. DOM/CSS rendering, no canvas or engine.
- **Rationale**: Easy for ages 6–12, quick rounds, natural touch/keyboard support, accessible by default with real buttons and ARIA labels. Pure logic gives cheap, reliable tests.
- **Alternatives**: Canvas/Phaser (heavier, harder to make accessible); Three.js (spec scopes out full 3D).

## R4. Scores and persistence
- **Decision**: Best score per game in `localStorage` (`gks:best:<slug>`), via a safe wrapper that tolerates blocked/failed storage; nothing is sent anywhere.
- **Rationale**: FR-009, FR-023. Graceful fallback to session-only scores.

## R5. Visual system (from UI/UX Pro Max)
- **Decision**: Tokens in CSS variables. Fredoka (headings) + Nunito (body) via `next/font`. Palette: primary `#7C3AED`, secondary `#A78BFA`, accent `#F43F5E`, dark background `#0F0F23`, card `#1E1C35`, foreground `#E2E8F0`; a bright light theme in the same hues is optional. Layered-shadow "tactile" buttons, 150–300 ms transitions, one or two animated elements per view, `prefers-reduced-motion` respected. Lucide/Heroicons-style SVG icons; no emoji icons.
- **Rationale**: Directly implements the spec's Design Direction and FR-016..022.
- **Risk**: Text on the rose accent (`#F43F5E`) with black vs. white text must be contrast-checked; the review's pick specifies black on-accent. Verify all token pairs with an automated check before adoption.
- **Rejected**: Full "3D & hyperrealism" (high performance and accessibility cost).

## R6. Accessibility and testing
- **Decision**: Vitest for logic/components; Playwright for smoke, keyboard-only flows, viewports 375/768/1024/1440, and axe-core scans on every route.
- **Rationale**: Turns SC-004/SC-005 into repeatable checks.

## R7. Privacy and analytics
- **Decision**: No analytics at launch. If usage measurement is wanted later, use only cookieless, aggregate, anonymous measurement (e.g. Vercel Web Analytics) after review.
- **Rationale**: FR-023/024; nothing collected means no consent flow needed.

## R8. Deployment and safety headers
- **Decision**: HTTPS by default on Vercel; add basic security headers (CSP restricting to self and fonts, no framing, referrer policy) via Next config; no third-party scripts.
- **Rationale**: FR-025, kids' safety posture.
- **Note**: The Vercel CLI is not installed locally; Git-based deploys don't require it, but `npm i -g vercel` enables `vercel deploy` from the terminal.
