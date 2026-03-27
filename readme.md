# Great Games

Great Games is a spoiler-aware multi-sport game discovery app. It supports MLB, NBA, and NHL with a shared shell, sport-specific data adapters, and excitement ranking tuned per league.

## Current Product State (additionalStats branch)

- Table-first game list with rank, matchup, context column, type, rating, status, and expandable details.
- Auto-load behavior: defaults to yesterday on first load and reloads when the selected date changes.
- Shared toolbar actions: Filter, Standings, and Ranking criteria modal.
- Sport switcher in the header with persistent selection via `localStorage` (`great-games-sport`) and URL support (`?sport=mlb|nba|nhl`).
- Spoiler protection: scores remain hidden until revealed in details.
- Shared modal behavior: close button, backdrop click, and `Escape`.

## Sport Support

### MLB

- Provider: MLB Stats API (`statsapi.mlb.com`) with timezone-aligned day buckets (`America/New_York`).
- Coverage: MLB plus International Baseball schedules (`sportId: 1,51`) for events like WBC.
- Details include lineups, pitcher cards, player panel, pitcher panel, and baseball box score reveal controls.
- Completed-game table records are normalized to pre-game W-L values to avoid winner/loser spoilers.

### NBA

- Provider: ESPN public endpoints (`site.api.espn.com`).
- Scoreboard path: `/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD&limit=200`.
- Standings path: `/apis/v2/sports/basketball/nba/standings?season=YYYY`.
- Ranking criteria in NBA mode are intentionally compact and focused on three factors:
  - Finish tension
  - Momentum swings
  - Overtime drama
- ESPN mode is scoreboard-first; enhancement rows remain empty by design.

### NHL

- Provider: ESPN public endpoints (`site.api.espn.com`) for scoreboard and standings.
- Ranking criteria in NHL mode include one-goal tension, momentum swings, OT/SO drama, and goalie workload proxy.
- Parser tracks hockey-specific context such as shots, saves, and power-play goals for ranking signals.
- Uses the shared spoiler-safe table/details UI path with NHL-specific labels and standings copy.

## Recent Updates

- [documentation/changes-2026-03-27.md](documentation/changes-2026-03-27.md) - Multi-sport documentation refresh and NBA/NHL additions coverage.
- [documentation/changes-2026-03-05.md](documentation/changes-2026-03-05.md) - MLB filtering workflow, same-day ranking behavior, and details upgrades.
- [documentation/changes-2026-03-04.md](documentation/changes-2026-03-04.md) - MLB table-first UX baseline and ranking modal/panel updates.
- [documentation/changes-template.md](documentation/changes-template.md) - Template for future daily logs.

## Architecture

### Shell

- `js/app.js` handles sport resolution, branding/footer copy, filter-toggle presentation per sport, and dynamic import bootstrap.
- `index.html` hosts shared shell markup (toolbar, modals, table mount, standings modal).

### League Modules

- `js/mlb/*` contains MLB runtime logic and MLB-specific components.
- `js/nba/*` contains NBA runtime logic using ESPN scoreboard/standings adapters.
- `js/nhl/*` contains NHL runtime logic using ESPN scoreboard/standings adapters.
- Each league directory has `app.js`, `ui.js`, `api.js`, `parser.js`, `ranker.js`, `cache.js`, `utils.js`, and `components/`.

### Styling

- `css/styles.css` contains base visual system, table/details styles, modal styles, and sport-specific variants.
- `css/responsive.css` contains breakpoints and mobile/tablet behavior for shell and details.

## Data Flow (Shared Pattern)

1. Shell resolves active sport and dynamically imports the league app.
2. League `UI.init()` wires controls, restores ranking options, and triggers initial load.
3. League `API` fetches scoreboard/schedule plus standings as available.
4. League `Parser` normalizes results into shared game-card/table model shape.
5. League `Ranker` scores completed games using enabled criteria.
6. League `GameTableRow` renders summary and expandable details.

## Project Structure

```text
Great Games/
├── index.html
├── readme.md
├── documentation/
│   ├── system.md
│   ├── changes-2026-03-04.md
│   ├── changes-2026-03-05.md
│   ├── changes-2026-03-27.md
│   └── changes-template.md
├── assets/
│   └── mlb/
│       ├── hero/
│       ├── mlb_rivals.json
│       └── unknown-player-headshot.png
├── css/
│   ├── styles.css
│   └── responsive.css
└── js/
    ├── app.js
    ├── mlb/
    │   ├── api.js
    │   ├── app.js
    │   ├── cache.js
    │   ├── parser.js
    │   ├── ranker.js
    │   ├── test-api.js
    │   ├── ui.js
    │   ├── utils.js
    │   └── components/
    ├── nba/
    │   ├── api.js
    │   ├── app.js
    │   ├── cache.js
    │   ├── parser.js
    │   ├── ranker.js
    │   ├── ui.js
    │   ├── utils.js
    │   └── components/
    └── nhl/
        ├── api.js
        ├── app.js
        ├── cache.js
        ├── parser.js
        ├── ranker.js
        ├── ui.js
        ├── utils.js
        └── components/
```

## Development Notes

- Frontend-only app (no backend service required for current runtime).
- Built with ES modules and async/await.
- Sport mode can be tested directly with URL parameters:
  - `index.html`
  - `index.html?sport=nba`
  - `index.html?sport=nhl`

## Browser Support

- Modern Chrome, Edge, Firefox, Safari.
- Responsive layouts for desktop, tablet, and mobile.

## Visual Asset Credit

- MLB watermark/logo source: [Major League Baseball logo.svg](https://commons.wikimedia.org/wiki/File:Major_League_Baseball_logo.svg), public domain via Wikimedia Commons.
- Local runtime copy: `assets/mlb/hero/mlb-logo.svg`.