# MLB Great Games

MLB Great Games is a spoiler-aware MLB game discovery app. It fetches MLB Stats API data, ranks games by excitement, and presents results in a compact table-first interface.

## Current UX (additionalStats branch)

- **Table-first game list** with rank, matchup, venue, type, rating, status, and expandable details.
- **Auto-load behavior**:
  - Loads games automatically on initial page load (defaults to yesterday).
  - Reloads automatically when the date changes.
- **Date + Ranking toolbar**:
  - Game Date selector on the left.
  - Right-aligned **Ranking ⚙** settings trigger.
- **Ranking criteria modal**:
  - Opens centered overlay modal.
  - Toggle ranking criteria on/off without leaving the table view.
  - Closes via close button, backdrop click, or `Esc`.
- **Spoiler protection**:
  - Score hidden by default.
  - Reveal score only inside expanded details.
  - Completed-game team records in matchup rows use pre-game W-L values to avoid implicit winner/loser spoilers.
- **Expanded details panel (per row)**:
  - Starting pitchers and away/home lineups.
  - Expanded-row pitcher cards prefer pitcher-linked highlight/action images when available.
  - Player and pitcher side detail panels.
  - Pitcher side detail panel remains headshot-based for known pitchers, with local fallback when pitcher data is missing.
  - Box score table.
- **Status column normalization**:
  - Displays only: `Final`, `In Progress`, or scheduled time.
  - Date buckets align to MLB schedule-day semantics (`America/New_York`) to match MLB.com.
  - Upcoming-day views include scheduled/preview and live games.

## Recent Session Updates (2026-03-04)

Full daily log: [documentation/changes-2026-03-04.md](documentation/changes-2026-03-04.md)
Template for future logs: [documentation/changes-template.md](documentation/changes-template.md)

### UI + Layout
- Styled the table date picker to match the rest of the toolbar/theme.
- Increased ranking criteria modal size/readability.
- Fixed ranking modal drift when expanding table rows (modal now remains viewport-fixed).
- Persisted ranking criteria selections in browser `localStorage` so preferences are restored on return visits.
- Widened player and pitcher detail side panels.
- Updated pitcher rankings name column to wrap so full names are visible.
- Reordered pitcher stat cards so `Games` appears directly to the right of `Home Runs`.
- Expanded-row pitcher cards now use pitcher-linked game highlight images when available.
- Refreshed the box score table to better match the current design language while keeping the baseball scoreboard feel.
- Increased inning and `R/H/E` header emphasis and standardized same-size adaptable scoring cells across varying inning counts, including responsive breakpoints.

### Data Accuracy + Coverage
- Fixed historical pitcher stats lookup by using selected game season year (instead of current year).
- Propagated `gameType` through parser and pitcher stat fetch paths so spring/non-regular-season games resolve the correct split.
- Added table `Type` column based on schedule `gameType`, with `seriesDescription`-aware disambiguation for special-event `F` games (for example, WBC).
- Team pitcher rankings now fetch with selected game season year + game type context.
- Expanded schedule fetch to `sportId: '1,51'` (MLB + International Baseball), including WBC games in ranking input.
- Completed-game team records now display pre-game W-L by deriving from post-game `leagueRecord`, preventing table-row record spoilers.
- Schedule requests now use `timeZone=America/New_York` so selected date buckets match MLB.com day boundaries.
- Completed-game day filtering uses timezone-scoped schedule bucket date (`dates[].date`) to handle cross-midnight edge cases.
- Upcoming-day parser now includes `Live` games so in-progress matchups (for example, WBC pool play) are shown on the selected day.

### Stability
- Added null-safe pitcher stat rendering to prevent `inningsPitched` null runtime crashes.
- Hardened player detail panel close lifecycle (idempotent close + listener/timeout cleanup) to prevent `remove()` null errors.

### Final Behavior Notes
- CET status subline was tested and then removed by request; status remains single-line.
- Ranking table `Type` labels are friendly and special-event-aware (`WBC` where applicable).
- Expanded details prefer pitcher highlight/action images with headshot fallback.
- Missing pitcher data now falls back to local asset `assets/mlb/unknown-player-headshot.png`.
- Pitcher detail side panel continues to use headshots for known pitchers.
- Status column header now shows `First pitch @` only when all rows are scheduled/preview; mixed/live days show `Status`.

## Feature Summary

### Discovery + Ranking
- Excitement ranking with weighted criteria.
- Criteria include close games, lead changes, drama, extra innings, team rankings, and additional statistical/context factors.
- Live re-ranking when criteria toggles change.

### Spoiler-safe Viewing
- No score shown by default.
- Reveal/hide controls in expanded details.

### Team + Player Context
- Team logos, records, venue, and rating.
- Pitcher cards with stats.
- Lineup tables with player detail drill-in.
- Pitcher detail panel with team pitcher ranking table.

## Technical Architecture

### Core Modules
- `js/mlb/app.js` — startup entry and global API rejection handling.
- `js/mlb/ui.js` — DOM orchestration, loading flow, table rendering, modal control.
- `js/mlb/api.js` — MLB API calls, helpers, and data retrieval.
- `js/mlb/parser.js` — transforms raw API responses into app-ready game models.
- `js/mlb/ranker.js` — computes excitement scores and sorting.
- `js/mlb/cache.js` — cache layer for API responses.
- `js/mlb/utils.js` — shared utility helpers.

### UI Components
- `js/mlb/components/GameTableRow.js` — main row + expandable details row.
- `js/mlb/components/LineupDisplay.js` — lineup table rendering + player interactions.
- `js/mlb/components/PitcherDisplay.js` — pitcher summary card.
- `js/mlb/components/PlayerDetailPanel.js` — player side panel.
- `js/mlb/components/PitcherDetailPanel.js` — pitcher side panel + ranking table.
- `js/mlb/components/GameCard.js` — legacy card-based component retained in repo.

## Data Flow

1. UI initializes date and triggers `handleLoadGames()` automatically.
2. `ui.js` requests schedule + standings from `api.js`.
3. `parser.js` normalizes game objects.
4. `ranker.js` scores/sorts completed games using selected criteria.
5. `GameTableRow` renders rows; details load pitchers/lineups asynchronously on expand.

## Styling

- `css/styles.css` contains base theme, table UI, modal styles, and final override sections for detail panels/lineups.
- `css/responsive.css` contains breakpoint behavior for table layout and ranking modal.

## Project Structure

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
        ├── api.js
        ├── cache.js
        ├── parser.js
        ├── ranker.js
        ├── test-api.js
        ├── ui.js
        ├── utils.js
        └── components/
            ├── GameTableRow.js
            ├── GameCard.js
            ├── LineupDisplay.js
            ├── PitcherDisplay.js
            ├── PitcherDetailPanel.js
            └── PlayerDetailPanel.js
```

## Development Notes

- Frontend-only app (no backend service).
- Uses modern ES modules and async/await.
- Current CSS includes legacy and newer override sections; final-pass sections provide latest visual behavior.

## Browser Support

- Modern Chrome, Edge, Firefox, Safari.
- Responsive table + modal behavior for tablet/mobile layouts.

## NBA API Notes

- NBA mode now uses BALLDONTLIE (`https://api.balldontlie.io`).
- Supported scoreboard data path:
  - Games (`GET /nba/v1/games`) mapped into `GameHeader`, `LineScore`, and `GameInfo` result sets.
- Optional enhancement paths (plan-dependent):
  - Player stats (`GET /nba/v1/stats`)
  - Advanced stats (`GET /nba/v1/stats/advanced`)
  - If these endpoints return `401/403`, enhancement fetches are disabled for the session and base scoreboard ranking still works.
- Authentication header used for all NBA requests: `Authorization: <api_key>`.
- API base URL is configurable:
  - Query string: `?nbaBdlBaseUrl=https://api.balldontlie.io`
  - Global: `window.__GREAT_GAMES_NBA_BDL_BASE_URL__`
  - Local storage: `localStorage.setItem('great-games-nba-bdl-base-url', 'https://api.balldontlie.io')`
  - Backward-compatible query alias is still accepted: `?nbaApiSportsBaseUrl=...`
- API key is configurable:
  - Query string: `?nbaBdlApiKey=YOUR_KEY` (legacy `?nbaApiKey=...` also supported)
  - Global: `window.__GREAT_GAMES_NBA_BDL_API_KEY__`
  - Local storage: `localStorage.setItem('great-games-nba-bdl-api-key', 'YOUR_KEY')`
- Enhancement toggle is configurable:
  - Query string: `?nbaBdlEnhancements=true`
  - Global: `window.__GREAT_GAMES_NBA_BDL_ENHANCEMENTS_ENABLED__ = true`
  - Local storage: `localStorage.setItem('great-games-nba-bdl-enhancements-enabled', 'true')`
- Frontend key exposure note: if used directly in browser code, the key is visible to users. Use provider-side key restrictions and rotate keys regularly.

## Visual Asset Credits

- Games panel background logo: [Major League Baseball logo.svg](https://commons.wikimedia.org/wiki/File:Major_League_Baseball_logo.svg), public domain source hosted on Wikimedia Commons.
- Local runtime copy is stored at `assets/mlb/hero/mlb-logo.svg`.