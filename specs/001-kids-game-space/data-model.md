# Data Model: Gonzalo's Kids Game Space

All data is static content in the repo except device-local scores. No database.

## Site (`content/site.json`) — one record

| Field | Type | Rules |
|-------|------|-------|
| name | string | required, 1–40 chars |
| tagline | string | required, ≤ 100 chars |
| host.name | string | required (Gonzalo) |
| host.welcome | string | required, ≤ 400 chars; shown when no announcements (FR-011/012) |
| host.avatar | path | optional; must have `avatarAlt` if set |
| host.avatarAlt | string | required when avatar set |

## Game (`content/games.json`, array)

| Field | Type | Rules |
|-------|------|-------|
| slug | string | required, unique, lowercase-kebab; matches a key in `games/registry.ts` when status ≠ `coming-soon` |
| title | string | required, ≤ 30 chars |
| description | string | required, ≤ 80 chars |
| instructions | string | required, ≤ 160 chars, kid-friendly (FR-007) |
| icon | string | required, key in the icon set |
| color | enum | one of the palette accent tokens |
| status | enum | `available` \| `new` \| `coming-soon` |
| featured | boolean | default false |

**Relationships**: Announcement.gameSlug → Game.slug (optional).
**State**: `coming-soon` → `new` → `available` (edited by host; `new` is shown as a badge). `coming-soon` games render a non-interactive card and have no route (FR-013, US4).

## Announcement (`content/announcements/<date>-<slug>.md`)

| Field | Type | Rules |
|-------|------|-------|
| title | string | required, ≤ 60 chars |
| date | ISO date | required; list sorted newest first (FR-012) |
| gameSlug | string | optional; must reference an existing Game |
| body | markdown | required, ≤ 400 chars, plain text plus basic emphasis; no raw HTML, no external links |

## Session/Best Score (device-local only)

Key `gks:best:<slug>` → `{ best: number, updatedAt: ISO string }`.
No identity, never transmitted. Missing or corrupt values are treated as "no best yet".

## Validation

`lib/content.ts` validates everything with Zod at build time; an invalid record fails the build with a readable message so a bad edit can never reach production (a failed deploy leaves the previous site live).
