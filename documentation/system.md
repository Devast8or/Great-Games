# Great Games -- System Documentation (Current)

This document describes the current implementation on branch `additionalStats`, including the multi-sport shell and league-specific MLB, NBA, and NHL pipelines.

## 1. Project Overview

Great Games is a spoiler-aware frontend app for game discovery across three leagues:

- MLB
- NBA
- NHL

The app uses one shared shell and one runtime module per sport. Each sport module follows the same architecture (`app` -> `ui` -> `api` -> `parser` -> `ranker`) and renders into the same table/details surface.

## 2. Multi-Sport Shell

### Shell Entry: `js/app.js`

Responsibilities:

- Resolves active sport from URL query `?sport=` or `localStorage` key `great-games-sport`.
- Defaults to `mlb` when no valid sport is provided.
- Updates brand logo/title/footer copy by sport.
- Applies sport-specific filter-modal presentation text and visible toggles.
- Dynamically imports the correct app entry:
  - `js/mlb/app.js`
  - `js/nba/app.js`
  - `js/nhl/app.js`

### Shared Interaction Model

1. App loads and auto-selects yesterday.
2. Selected sport module auto-loads games for that date.
3. Date changes re-run load flow.
4. User can open Filter, Standings, and Ranking modals.
5. User can expand rows to reveal spoiler-protected score/details.

## 3. Common UI Surface

Shared `index.html` regions:

- sport switcher header (`MLB`, `NBA`, `NHL`)
- toolbar with `Game Date`, `Filter`, `Standings`, `Ranking`
- active period-filter badge
- period-filter modal
- standings modal
- ranking criteria modal
- loading/error/empty states
- table mount node (`#games-list`)

Shared behavior details:

- One expanded details row at a time.
- Ranking toggles persist per sport in local storage.
- Modal hosts are reparented to `document.body` for stable viewport positioning.
- `Escape` closes team picker first, then open modal.

## 4. Source Structure

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
├── css/
│   ├── styles.css
│   └── responsive.css
├── assets/
│   └── mlb/
│       ├── hero/
│       ├── mlb_rivals.json
│       └── unknown-player-headshot.png
└── js/
    ├── app.js
    ├── mlb/
    ├── nba/
    └── nhl/
```

## 5. League Modules

### MLB Modules (`js/mlb/*`)

Provider and model:

- Uses MLB Stats API schedules, standings, lineups, pitcher/player data.
- Includes MLB + International Baseball schedule coverage (`sportId: 1,51`).
- Uses `timeZone=America/New_York` for schedule-day alignment.

Key behavior:

- Preserves spoiler-safe matchup records by deriving pre-game completed-game W-L.
- Supports baseball details flow: lineups, pitcher cards, player panel, pitcher panel.
- Supports progressive score reveal with inning and cumulative `R/H/E` behavior.

### NBA Modules (`js/nba/*`)

Provider and model:

- Uses ESPN public endpoints for scoreboard and standings.
- Scoreboard endpoint:
  - `/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD&limit=200`
- Standings endpoint:
  - `/apis/v2/sports/basketball/nba/standings?season=YYYY`
- API layer maps ESPN payloads into `GameHeader`, `LineScore`, `GameInfo` result sets consumed by parser.

Key behavior:

- Ranking criteria intentionally limited to:
  - `closeGames` (Finish tension)
  - `leadChanges` (Momentum swings)
  - `extraInnings` (Overtime drama)
- Parser computes scoreboard-derived fallback signals for advanced context fields while ESPN enhancement rows stay empty.
- Team division standing labels are generated from standings when available.

### NHL Modules (`js/nhl/*`)

Provider and model:

- Uses ESPN public endpoints for scoreboard and standings.
- API mapping contract mirrors NBA path (`GameHeader`, `LineScore`, `GameInfo`).
- Extends line-score mapping with hockey-specific stats (`SHOTS`, `SAVES`, `PP_GOALS`).

Key behavior:

- Ranking criteria focus on hockey signals:
  - one-goal tension
  - momentum swings
  - OT/SO drama
  - goalie workload proxy
- Parser exposes totals for shots, saves, and power-play goals.
- Standings-aware division labels are rendered for team context.

## 6. Ranking Criteria by Sport

- MLB: broad criteria set spanning game dynamics, contextual factors, and statistical factors.
- NBA: compact three-factor model optimized for scoreboard-only inputs.
- NHL: four-factor model tuned to hockey scoring/goalie dynamics.

## 7. Filter and Standings Behavior

- Period filter modal supports:
  - lookback days
  - team multi-select picker
  - minimum stars threshold
- Active filter badge summarizes current range filter and can clear state.
- Standings modal title/labels switch by active sport.

Sport-specific presentation:

- MLB: full ranking toggle catalog visible.
- NBA: only core three toggles visible; other categories are hidden when empty.
- NHL: NHL-specific reduced toggle set is visible.

## 8. Runtime Flow

1. `js/app.js` resolves sport and bootstraps the matching app module.
2. Sport `ui.js` initializes controls, restores ranking options, and starts first load.
3. Sport `api.js` fetches scoreboard/schedule plus standings.
4. Sport `parser.js` normalizes records to app game models.
5. Sport `ranker.js` computes excitement scores for completed games.
6. Sport `components/GameTableRow.js` renders summary rows and expandable details.

## 9. Maintenance Notes

- Keep shell-level behavior in `js/app.js` and avoid sport-specific branching inside league modules where possible.
- Preserve result-set contract consistency (`GameHeader`, `LineScore`, `GameInfo`) for NBA/NHL parser stability.
- For UI regressions, inspect late override sections in `css/styles.css` first.

## 10. Documentation Change Log Links

- [changes-2026-03-27.md](changes-2026-03-27.md)
- [changes-2026-03-05.md](changes-2026-03-05.md)
- [changes-2026-03-04.md](changes-2026-03-04.md)
- [changes-template.md](changes-template.md)