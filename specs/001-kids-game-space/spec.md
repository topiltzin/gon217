# Feature Specification: Gonzalo's Kids Game Space

**Feature Branch**: `001-kids-game-space`
**Created**: 2026-09-29
**Status**: Draft
**Input**: User description: "Create web page that will deploy on vercel, where the main concept is a hosted and iterate space for a Game community for Kids, the host Gonzalo will be the one that will share content and the idea is add some cool basic games on page, and make it cool and attractive for friends. Take feedback from /ui-ux-pro-max and take his input in order to plan the scope, add some simple games to play on it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Land on a fun home page and start playing (Priority: P1)

A kid (or a parent opening the link for them) opens the site from a shared link. They immediately see a bright, playful home page that says whose space it is (Gonzalo's), shows the available games as big, inviting cards, and lets them start a game in one tap.

**Why this priority**: This is the core value. A welcoming page with playable games is the smallest thing that is a "game space". Everything else builds on it.

**Independent Test**: Open the site on a phone and a laptop with no prior knowledge; a first-time visitor can start a game within 10 seconds without reading instructions.

**Acceptance Scenarios**:

1. **Given** a first-time visitor on any device, **When** the home page loads, **Then** they see the space's name, Gonzalo as host, and a game card for every available game.
2. **Given** the home page, **When** the visitor taps/clicks a game card, **Then** that game opens and is playable immediately, with no sign-up.
3. **Given** a game in progress, **When** the visitor chooses "back" or "home", **Then** they return to the home page without an error or a dead end.

---

### User Story 2 - Play simple games that are fun and easy to understand (Priority: P1)

A kid plays one of a small set of simple games. Each game explains itself in a sentence or a visual hint, works with touch, mouse, or keyboard, gives clear win/lose/score feedback, and offers "play again" at the end.

**Why this priority**: Games are the reason friends come and return. The initial set is at least three simple games (see Assumptions for the proposed set).

**Independent Test**: For each game, a kid aged 6–12 can start, finish a round, and replay it without adult help.

**Acceptance Scenarios**:

1. **Given** a game has opened, **When** the round has not started, **Then** a short, kid-friendly instruction and a clearly visible "Play" control are shown.
2. **Given** a round in progress, **When** the player acts (tap, click, or key), **Then** the game responds visibly within a fraction of a second.
3. **Given** a round has ended, **When** the result is shown, **Then** the player sees their outcome/score and can choose "Play again" or "Back to games".
4. **Given** a device with only touch, only mouse, or only keyboard, **When** the player uses that input, **Then** the game is fully playable.
5. **Given** the player has selected reduced motion in their device settings, **When** a game or page animates, **Then** non-essential animation is minimised.

---

### User Story 3 - Gonzalo shares news and content with the community (Priority: P2)

Gonzalo, as host, can put up content for his friends: a short welcome/"about the host" message, news or announcements (e.g. "new game added!"), and featured or "game of the week" highlights. Visitors see the latest items on the home page.

**Why this priority**: It makes the space feel like a community run by a person rather than a static arcade, and it is the "host shares content" part of the vision. It is secondary to having games to play.

**Independent Test**: Gonzalo adds a new announcement and it appears on the home page for visitors in the agreed update process, with no change to the games.

**Acceptance Scenarios**:

1. **Given** Gonzalo has published a new announcement, **When** a visitor loads the home page, **Then** the announcement appears with the newest first and a date.
2. **Given** no announcements exist yet, **When** the home page loads, **Then** a friendly welcome message from Gonzalo is shown instead of an empty area.
3. **Given** Gonzalo marks a game as featured, **When** visitors view the home page, **Then** that game is highlighted above the others.

---

### User Story 4 - Keep growing the space over time (Priority: P3)

The space is designed to "iterate": new games and new content can be added later without redesigning the site. A visitor can see what is new and what is coming soon.

**Why this priority**: Supports long-term growth but does not block the first release.

**Independent Test**: Add one more game entry to the catalogue; it appears as a card on the home page in the same style as the others and needs no changes to existing games.

**Acceptance Scenarios**:

1. **Given** a new game is added to the catalogue, **When** the home page loads, **Then** it appears as a card consistent with the others, optionally marked "New".
2. **Given** a planned game is marked "coming soon", **When** visitors see its card, **Then** it is visibly not playable yet and does not open a broken page.

---

### Edge Cases

- A visitor opens a game link directly (deep link); the game loads on its own, with a way back home.
- A visitor opens a link to a game or page that does not exist; a friendly "oops" page with a way home is shown.
- The visitor is on a very small phone screen, a tablet, or a large desktop; layout adapts with no sideways scrolling and controls stay large enough to tap.
- The visitor rotates the device or resizes the window mid-game; the game stays playable and is not lost or broken.
- The visitor leaves a game mid-round and returns; the game starts fresh, without errors.
- The visitor has a slow connection; the page shows something useful quickly and the game does not jump around as it loads.
- The visitor uses a screen reader, keyboard only, or a high-contrast setting; navigation and controls remain usable.
- Sound is off, blocked, or the device is muted; games remain fully understandable without audio.
- A visitor tries to find a way to contact strangers or post public text; none is offered (see Safety requirements).

## Requirements *(mandatory)*

### Functional Requirements

**Home and navigation**

- **FR-001**: The site MUST provide a home page that names the space, introduces Gonzalo as the host, and presents every available game as a large, tappable card with a title and a short visual description.
- **FR-002**: The site MUST let a visitor start any available game in one tap/click from the home page, with no sign-up, login, or personal information.
- **FR-003**: Every page MUST provide a consistent, obvious way back to the home page.
- **FR-004**: Every game MUST be reachable by its own direct link that can be shared with friends.
- **FR-005**: The site MUST show a friendly not-found page, with a way back home, for unknown addresses.

**Games**

- **FR-006**: The launch version MUST include at least three simple, self-contained games that a kid can understand within one short instruction.
- **FR-007**: Each game MUST show instructions before play, immediate feedback during play, and a clear end-of-round result with "Play again" and "Back to games".
- **FR-008**: Each game MUST be playable with touch, mouse, and keyboard, and MUST NOT require audio to be understood.
- **FR-009**: Each game MUST show the player's score or result for the current session. Best scores MAY be remembered on the visitor's own device only.
- **FR-010**: Games MUST NOT contain violence, gambling mechanics, ads, purchases, or external links that are not clearly for grown-ups.

**Host content**

- **FR-011**: The home page MUST display a host welcome message from Gonzalo.
- **FR-012**: The site MUST display Gonzalo's announcements/news, newest first with dates, and show a friendly default when there are none.
- **FR-013**: Gonzalo MUST be able to highlight one or more games as "Featured" and mark games as "New" or "Coming soon".
- **FR-014**: Only Gonzalo (the host) can publish or change community content; visitors cannot post or edit anything.

**Growth**

- **FR-015**: Adding a new game or announcement MUST NOT require changes to existing games or pages.

**Look, feel, and accessibility** (informed by UI/UX review; see Design Direction)

- **FR-016**: The site MUST have a bold, bright, playful visual identity with a friendly rounded typeface, large text, and consistent colour and icon style across all pages and games.
- **FR-017**: All interactive controls MUST be at least 44×44 px with at least 8 px between neighbouring targets, and must give visible feedback (pressed/hover/focus) when used.
- **FR-018**: Text MUST meet a 4.5:1 contrast ratio against its background, and information MUST NOT rely on colour alone.
- **FR-019**: Every interactive element MUST be usable with a keyboard and show a visible focus indicator, and images and icons MUST have text alternatives or be marked decorative.
- **FR-020**: The site MUST respect the visitor's reduced-motion preference and limit animation to one or two key elements per view.
- **FR-021**: Layouts MUST work without horizontal scrolling on screens from 375 px wide up to large desktop, and MUST NOT shift while loading.
- **FR-022**: Icons MUST be a consistent illustrated/vector set, not emoji, used as functional icons.

**Safety and privacy**

- **FR-023**: The site MUST NOT collect personal data from visitors, and MUST NOT provide accounts, chat, comments, or any way for visitors to communicate with each other or the host.
- **FR-024**: The site MUST NOT use advertising or third-party tracking of children. Any usage measurement MUST be anonymous and aggregate.
- **FR-025**: The site MUST be publicly reachable over a secure address, hosted on Vercel as requested, so friends can open it from a shared link.

**Amendment 1 (2026-09-29): Spanish, YouTube links, platformer game**

- **FR-026**: The whole site (UI text, game text, and host content) MUST be available in English and Spanish. Visitors whose browser prefers Spanish MUST land on the Spanish version automatically, and a visible control on every page MUST switch the current page between languages. The language choice MUST NOT use cookies. Missing Spanish content MUST fall back to English.
- **FR-027**: Gonzalo MUST be able to share YouTube links (videos, shorts, playlists, channels) through a content file. Only YouTube URLs are accepted.
- **FR-028**: YouTube links MUST open only after a "you're leaving, ask a grown-up" confirmation, in a new tab, and the site MUST NOT load anything from YouTube (no embeds or thumbnails). This refines FR-010 and FR-024: these are the only outbound links.
- **FR-029**: The catalogue MUST include a simple 2D side-scrolling platformer (run, jump, collect coins, stomp enemies, reach the flag) with lives, a checkpoint, a coin best score, keyboard controls, and on-screen touch buttons of at least 44 px.

**Amendment 2 (2026-09-29): garden defense game, brand logo**

- **FR-030**: The catalogue MUST include a simple, non-violent lane-defense game in the style of "plants vs. zombies": the player spends sunshine on plants (a sun producer, a shooter, a blocker) in a 5×7 garden to shoo snails before they reach the house, over three waves, with hearts and a best score. It MUST be playable by touch, mouse, and keyboard (number keys to pick, arrow keys to move, Enter to plant).
- **FR-031**: The site MUST use a distinctive brand mark for Gonzalo (a "G" whose crossbar is a play button) in the header, the hero, and the browser icon, with a localized wordmark tag.

### Key Entities

- **Game**: A playable item in the catalogue. Has a title, short description, icon/cover, instruction text, status (Available / New / Coming soon), and a featured flag.
- **Announcement**: A host message. Has a title, short body, publish date, and optional link to a game.
- **Host Profile**: Gonzalo's welcome message, name, and optional avatar/picture.
- **Session Score** *(device-local, optional)*: A player's current result and best result for a game, stored only on their own device and not tied to any identity.

## Design Direction (from UI/UX Pro Max review)

This section records the design input that shapes scope; it is guidance for planning, not a technology choice.

- **Page pattern**: A showcase-style home page: hero (name + host + primary "Play now" call to action), a grid of game cards, host news/highlights, and a repeated call to action at the bottom. Recommended in the review as the best fit for a feature-card-based product.
- **Typography**: Playful rounded display type paired with a very readable body type (review pick: Fredoka for headings, Nunito for body), base text 16 px or larger, line-height about 1.5.
- **Colour**: Vibrant, high-energy palette with a strong accent for calls to action. The review's suggested palette is neon purple (#7C3AED) with a rose action colour (#F43F5E) on a deep dark background. Because kids will be playing in varied lighting, a bright light theme in the same hues MAY be offered; whichever is used must pass FR-018. Dark-theme text on the rose accent must be checked for contrast before adoption.
- **Style caution**: The review's top style match ("3D & hyperrealism") is flagged high cost for performance and high accessibility risk. Scope decision: take the *feel* (depth, tactile buttons, layered shadows) but keep effects light, so pages load fast on low-end phones and honour reduced motion. Full 3D scenes are out of scope.
- **Interaction**: Large tap targets (≥ 44 px, ≥ 8 px gaps); every action gets a visible response; animation limited to 1–2 key elements per view; haptic feedback is optional and never required.
- **Icons**: Consistent vector icons only, no emoji as functional icons.
- **Responsive checkpoints**: 375, 768, 1024, and 1440 px wide.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can start playing a game within 10 seconds of opening the site, with no instruction beyond what is on screen.
- **SC-002**: At least 90% of kids aged 6–12 in an informal friends-and-family test can finish a round of each game and replay it without adult help.
- **SC-003**: The home page shows meaningful content in under 3 seconds on a typical mobile connection, and a game starts in under 2 seconds after it is chosen.
- **SC-004**: The site is fully usable (no clipped content, no sideways scrolling, controls easily tappable) at 375, 768, 1024, and 1440 px wide.
- **SC-005**: All pages and games pass a review for keyboard-only use, visible focus, 4.5:1 text contrast, and reduced-motion support with zero critical failures.
- **SC-006**: At least three distinct games are playable at launch, and adding a further game takes Gonzalo or a helper less than one working session, without editing existing games.
- **SC-007**: Gonzalo can publish a new announcement in under 5 minutes, and it is visible to all visitors soon after.
- **SC-008**: In a friends test, at least 8 of 10 kids ask to play again or share the link, and 0 personal data fields are collected.

## Assumptions

- **Audience**: Kids roughly 6–12 years old, mostly Gonzalo's friends, usually opening a shared link on a phone, tablet, or laptop, often with a parent nearby. Content is in English at launch.
- **Launch game set** (proposed, each quick to learn, replaced or extended later): a memory card-matching game, a tap/reaction "catch it" game, and a simple classic such as tic-tac-toe or a colour/pattern puzzle. Final selection can be adjusted during planning.
- **No accounts, no social features**: to protect kids' privacy and keep scope small, there is no sign-up, login, chat, comments, leaderboard shared across players, or user-generated content. Best scores are stored only on the player's own device.
- **Host content updates**: Gonzalo (or a trusted helper) updates announcements and featured games through a simple update process he controls. A built-in admin screen inside the site is out of scope for the first release and can be a future iteration.
- **Hosting**: The site is publicly reachable and deployed on Vercel, as the requester specified. A custom domain is optional and not required at launch.
- **Compliance**: Because the site collects no personal data and serves no ads, it is assumed not to need parental-consent flows. If accounts or data collection are added later, child-privacy rules (e.g. COPPA/GDPR-K) must be reviewed first.
- **Platforms**: Current versions of common mobile and desktop browsers. Offline play and native apps are out of scope.
- **Sound**: Optional, off by default, never required to play.
- **Out of scope**: multiplayer/online play, accounts, payments, ads, user-generated content, admin dashboard, full 3D games.
