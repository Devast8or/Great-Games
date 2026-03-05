# MLB Great Games — System Documentation (Current)

This document describes the current implementation on branch `additionalStats`, including the table-first UI, ranking settings modal, and themed details panels.

## 1. Project Overview

MLB Great Games is a spoiler-aware frontend app for MLB game discovery. It:

- fetches games and standings from the MLB Stats API,
- ranks games by configurable excitement criteria,
- renders games in a compact table,
- supports drill-down details (lineups, pitchers, score reveal) without leaving the page.

## 2. Current Interaction Model

### Primary Page Flow

1. App loads and auto-selects yesterday's date.
2. Games auto-load immediately.
3. User can change date (auto-reload happens on date change).
4. User can open `Ranking ⚙` modal to toggle ranking criteria.
5. User expands table rows for details and optionally reveals score.

### Table Behavior

- Columns: `#`, `Matchup`, `Venue`, `Type`, `Rating`, `Status`, `Details`.
- Row click/keyboard toggles details expansion.
- Only one details row is expanded at a time.
- Status values are normalized to:
  - `Final`
  - `In Progress`
  - scheduled first-pitch time (scheduled/preview rows)
- Day boundaries for table date selection follow MLB schedule timezone semantics (`America/New_York`) rather than browser-local midnight.
- Upcoming-day views include `Preview`, `Scheduled`, and `Live` games.
- Status-column heading is conditional:
  - `First pitch @` when all displayed rows are scheduled/preview
  - `Status` when any row is live or final
- `Type` is derived from schedule `gameType` with user-friendly labels, and uses `seriesDescription`/`description` metadata to disambiguate special-event `F` games (for example, World Baseball Classic).
- CET subline rendering in status was tested and then removed; table status is currently single-line.
- In expanded details, pitcher cards attempt to show pitcher-linked highlight/action images; fallback uses a local unknown-player headshot asset when pitcher data/image is unavailable.

### Ranking Settings Modal

- Opened by right-aligned `Ranking ⚙` button beside date selector.
- Centered overlay modal.
- Modal node is reparented to `document.body` during init to keep viewport-fixed positioning stable when table rows expand.
- Ranking criteria toggle state is persisted in browser `localStorage` and restored during UI initialization.
- Closes via:
  - close (`×`) button,
  - backdrop click,
  - `Escape` key.

## 3. Source Structure

```text
Great Games/
├── index.html
├── readme.md
├── documentation/
│   └── system.md
├── css/
│   ├── styles.css
│   └── responsive.css
├── assets/
│   └── mlb/
│       ├── hero/
│       ├── mlb_rivals.json
│       └── unknown-player-headshot.png
└── js/
    └── mlb/
        ├── app.js
        ├── ui.js
        ├── api.js
        ├── parser.js
        ├── ranker.js
        ├── cache.js
        ├── utils.js
        ├── test-api.js
        └── components/
            ├── GameTableRow.js
            ├── GameCard.js (legacy)
            ├── LineupDisplay.js
            ├── PitcherDisplay.js
            ├── PlayerDetailPanel.js
            └── PitcherDetailPanel.js
```

## 4. Core Modules

### App Module — `js/mlb/app.js`

Responsibilities:

- Initializes UI on `DOMContentLoaded`.
- Wires global `unhandledrejection` handler for `APIError` display.

### UI Module — `js/mlb/ui.js`

Responsibilities:

- Controls date selection, loading states, errors, and no-games view.
- Auto-loads games on startup and on date change.
- Opens/closes ranking modal.
- Persists ranking criteria selections (`mlb-ranking-options`) and reapplies saved values on load.
- Renders ranked/scheduled games in table form via `GameTableRow`.

Key methods:

- `init()`
- `handleLoadGames()`
- `loadCompletedGames(date)`
- `loadFutureGames(date)`
- `displayGames()`
- `refreshGameRankings()`
- `loadRankingOptionsFromStorage()`
- `saveRankingOptionsToStorage()`
- `toggleFiltersPanel(forceOpen)`

### API Module — `js/mlb/api.js`

Responsibilities:

- MLB API communication.
- Fetching schedules, standings, lineups, pitchers, and game details.
- Schedule requests include MLB + International Baseball (`sportId: '1,51'`) and are timezone-scoped with `timeZone=America/New_York` so date buckets align with MLB.com schedule-day behavior.
- Team logo URL generation.
- Error wrapping via `APIError`.

### Parser Module — `js/mlb/parser.js`

Responsibilities:

- Converts raw API payloads into normalized game objects.
- Builds completed-game and future-game models.
- Uses timezone-scoped schedule bucket day (`dates[].date`) for completed-game day filtering.
- Includes live games in upcoming-day parsing (`Preview`, `Scheduled`, `Live`).
- Preserves `gameType` for completed and future games to support correct stats split queries.
- Preserves schedule series metadata (`seriesDescription`, `seriesGameNumber`, `description`) for table label accuracy.
- Derives pre-game team records for completed games from post-game schedule `leagueRecord` values to keep matchup rows spoiler-safe.
- Computes helper values (lead changes, innings data, etc.) used by ranking.

### Ranker Module — `js/mlb/ranker.js`

Responsibilities:

- Scores games using weighted criteria.
- Re-sorts games when user toggles ranking criteria.

Criteria keys currently used by UI:

- `closeGames`
- `leadChanges`
- `comebackWins`
- `lateGameDrama`
- `extraInnings`
- `highScoring`
- `teamRankings`
- `hits`
- `errors`
- `scoringDistribution`
- `rivalryGame`
- `playerMilestones`
- `seasonalContext`

### Cache Module — `js/mlb/cache.js`

Responsibilities:

- In-memory API response caching with expiration.
- Helper retrieval/write and stale cleanup operations.

### Utils Module — `js/mlb/utils.js`

Responsibilities:

- Shared formatting and extraction helpers (player names, stats normalization, inning labels, cache key helpers).

## 5. Component Modules

### GameTableRow — `js/mlb/components/GameTableRow.js`

Primary table-row renderer.

Responsibilities:

- Renders summary row and hidden details row.
- Renders the ranking-row `Type` column using friendly `gameType` labels with WBC-aware disambiguation.
- Handles row expansion/collapse (single-open behavior).
- Handles score reveal toggle.
- Loads and renders lineups + pitchers on demand.
- Fetches pitcher season stats using the selected game's season year and game type.
- Resolves pitcher-linked highlight images from `game/{gamePk}/content` and passes them to expanded-row pitcher cards.
- Normalizes status display (`Final`, `In Progress`, time).

### LineupDisplay — `js/mlb/components/LineupDisplay.js`

Responsibilities:

- Renders lineup table with player rows.
- Computes/marks hot performer.
- Opens player detail panel for selected player.

### PitcherDisplay — `js/mlb/components/PitcherDisplay.js`

Responsibilities:

- Renders pitcher summary cards.
- Supports optional `displayImageUrl` for expanded-row highlight/action photos with headshot fallback.
- Opens pitcher detail panel.

### PlayerDetailPanel — `js/mlb/components/PlayerDetailPanel.js`

Responsibilities:

- Side panel with detailed batter stats.
- Team-side aware panel behavior (`away`/`home`).
- Uses idempotent close lifecycle with timeout/listener cleanup to avoid race-condition null-removal errors.

### PitcherDetailPanel — `js/mlb/components/PitcherDetailPanel.js`

Responsibilities:

- Side panel with detailed pitcher stats.
- Keeps panel hero image source as MLB headshot URL (unchanged behavior).
- Uses null-safe stat rendering defaults to prevent missing-stat runtime errors.
- Fetches and displays team pitcher rankings table.
- Team pitcher rankings are fetched with season-year + game-type context from the selected game.

### GameCard (Legacy) — `js/mlb/components/GameCard.js`

- Retained in repository for historical/card UI path.
- Current primary rendering path uses `GameTableRow`.

## 6. HTML Structure (Current)

`index.html` key regions:

- app header/branding,
- main content rail,
- table toolbar (date selector + right-aligned ranking trigger),
- centered ranking modal container,
- loading/error/empty states,
- games table mount point (`#games-list`),
- footer.

## 7. Styling Architecture

### Main Styles — `css/styles.css`

Contains:

- base theme variables and surfaces,
- table UI styles,
- ranking modal styles,
- details row/lineup/pitcher styling,
- player/pitcher side panel styling,
- final-pass override sections used to ensure new theme behavior wins over legacy blocks.

### Responsive Styles — `css/responsive.css`

Contains breakpoint behavior for:

- table layout and column visibility,
- details row spacing,
- ranking modal sizing/stacking,
- small-screen behavior.

## 8. Runtime Data Flow

1. `UI.init()` selects date, restores saved ranking options, and triggers load.
2. `UI.handleLoadGames()` decides completed vs future branch.
3. `API` fetches schedule + standings.
4. `Parser` normalizes game objects.
5. `Ranker` scores completed games based on active criteria.
6. `UI.displayGames()` renders table rows via `GameTableRow`.
7. Row expansion triggers async lineup/pitcher loading and nested detail panel interactions.

## 9. Maintenance Notes

- `styles.css` currently contains historical and newer style layers. Keep new behavior in final-pass scoped sections unless a full stylesheet cleanup is planned.
- If styling appears inconsistent, check cascade order near end-of-file override sections first.
- `GameCard` remains legacy; avoid wiring it back into `ui.js` unless intentionally restoring card view.

## 10. Recent Changes (2026-03-04)

This section captures all updates implemented in this chat.

Detailed daily log: [changes-2026-03-04.md](changes-2026-03-04.md)
Reusable template: [changes-template.md](changes-template.md)

### UI / Styling / Layout

- Styled the table date picker to visually match the table toolbar theme.
- Increased ranking criteria modal size and readability.
- Reordered pitcher stat cards so `Games` appears directly to the right of `Home Runs`.
- Added ranking table `Type` column sourced from schedule `gameType` metadata.
- Fixed ranking modal vertical drift while expanding rows by reparenting modal node to `document.body`.
- Added persistence for ranking criteria selections via browser `localStorage` so settings are restored on return visits.
- Widened both player and pitcher side detail panels.
- Updated pitcher rankings name column to wrap long names and avoid truncation.
- Updated expanded game details to use pitcher-linked highlight/action images when available.
- Added local unknown-player headshot fallback asset at `assets/mlb/unknown-player-headshot.png` for missing pitcher data/image failures.
- Refreshed box score table styling to better align with the current table/details design language.
- Increased inning and `R/H/E` header emphasis and added semantic box score header/cell class hooks for stable styling.
- Standardized box score cell sizing with fixed-size adaptable dimensions so inning/stat cells remain uniform across variable inning counts, including responsive breakpoints.
- Kept pitcher detail panel image behavior headshot-based for known pitchers.

### Data Correctness and Coverage

- Fixed missing pitcher stats for historical games by querying season stats with the selected game's year (instead of current year).
- Added `gameType` propagation across parsing and pitcher stat fetch paths to correctly resolve non-regular-season splits (e.g., spring games).
- Added schedule series metadata preservation and `F`-game disambiguation so World Baseball Classic entries render as `WBC` in the `Type` column.
- Updated team pitcher ranking fetch to use selected game season + game type context.
- Expanded schedule source from MLB-only to MLB + International Baseball (`sportId: '1,51'`) so WBC games in the requested window are included in rankings input.
- Updated completed-game record normalization so matchup-row W-L reflects pre-game records instead of post-game standings values.

### Stability Fixes

- Added null-safe fallback rendering in `PitcherDetailPanel` to prevent `inningsPitched` null dereference crashes.
- Hardened `PlayerDetailPanel` close lifecycle (idempotent close, timeout tracking, document-click listener cleanup) to prevent `remove()` on null race errors.

### Status/Timezone Behavior

- Schedule day boundaries now follow MLB API timezone semantics (`America/New_York`) to match MLB.com date buckets.
- Completed-game filtering uses timezone-scoped schedule bucket day (`dates[].date`) instead of browser-local day assumptions.
- Upcoming-day parsing includes live (`In Progress`) games so in-flight WBC/MLB games remain visible in the selected day view.
- CET status subline was briefly added and then removed by request; final behavior remains single-line status.

### Documentation Refresh Included

- Updated `readme.md` to reflect the current table-centric experience and controls.
- Replaced outdated system references with current `js/mlb/*` module paths and active component flow.