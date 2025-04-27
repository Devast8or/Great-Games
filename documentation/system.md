# MLB Great Games - System Documentation

This document provides comprehensive documentation for all files, functions, and classes in the MLB Great Games application.

## Table of Contents

1. [Project Overview](#project-overview)
2. [File Structure](#file-structure)
3. [Core Components](#core-components)
   - [App Module](#app-module)
   - [UI Module](#ui-module)
   - [API Module](#api-module)
   - [Parser Module](#parser-module)
   - [Ranker Module](#ranker-module)
   - [Utils Module](#utils-module)
4. [Component Modules](#component-modules)
   - [GameCard](#gamecard-component)
   - [LineupDisplay](#lineupdisplay-component)
   - [PitcherDisplay](#pitcherdisplay-component)
   - [PlayerDetailPanel](#playerdetailpanel-component)
5. [Cache Module](#cache-module)
6. [Assets](#assets)
7. [CSS Styling](#css-styling)
8. [HTML Structure](#html-structure)

## Project Overview

MLB Great Games is a web application that allows users to discover and watch MLB games without spoilers. The application fetches game data from the MLB Stats API and presents it in an organized, spoiler-free way. It includes features such as game discovery with custom filters, spoiler protection, team information, and lineup displays.

## File Structure

```
Great Games/
├── assets/
│   └── mlb/
│       ├── mlb_rivals.json
│       └── mlb_rivals.png
├── css/
│   ├── styles.css        # Main styles
│   └── responsive.css    # Responsive design
├── documentation/
│   └── system.md         # This documentation file
├── js/
│   ├── api.js            # API interactions
│   ├── app.js            # Application entry point
│   ├── cache.js          # Caching functionality
│   ├── parser.js         # Data processing
│   ├── ranker.js         # Game ranking logic
│   ├── test-api.js       # Test functions for API
│   ├── ui.js             # UI handling
│   ├── utils.js          # Utility functions
│   └── components/
│       ├── GameCard.js           # Game card UI component
│       ├── LineupDisplay.js      # Lineup display component
│       ├── PitcherDisplay.js     # Pitcher display component
│       └── PlayerDetailPanel.js  # Player details panel
├── index.html            # Main HTML
└── readme.md             # Project readme
```

## Core Components

### App Module

**File:** `js/app.js`

Main application entry point that initializes the application when the DOM is loaded.

**Functions:**
- `DOMContentLoaded` event listener
  - **Input:** DOM content loaded event
  - **Output:** None, initializes the UI and sets up error handling

### UI Module

**File:** `js/ui.js`

Handles all DOM interactions, creates game cards, and manages the user interface state.

**Class:** `UI`

**Constructor:**
- **Input:** None
- **Output:** UI instance with initialized DOM elements, game data, and state variables

**Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `init()` | Initializes UI elements and event handlers, sets up date picker with yesterday's date, and attaches event listeners | None | None |
| `formatDate(date)` | Formats a JavaScript Date object as YYYY-MM-DD string | `date` - JavaScript Date object | String formatted as YYYY-MM-DD |
| `handleLoadGames()` | Handles user click on load games button, validates date and loads appropriate games | None | None |
| `loadCompletedGames(date)` | Fetches and processes completed games for a specific date | `date` - String date in YYYY-MM-DD format | None |
| `loadFutureGames(date)` | Fetches and processes future games for a specific date | `date` - String date in YYYY-MM-DD format | None |
| `displayGames()` | Renders game cards in the DOM based on loaded games and ranking options | None | None |
| `getRankingOptions()` | Gets current filter settings from UI checkboxes | None | Object containing filter settings |
| `refreshGameRankings()` | Re-ranks and displays games based on current filter settings | None | None |
| `showLoading()` | Shows loading indicator and hides other UI elements | None | None |
| `hideLoading()` | Hides the loading indicator | None | None |
| `showError(message)` | Displays an error message to the user | `message` - String error message | None |
| `showNoGames()` | Shows a message indicating no games were found for the selected date | None | None |
| `toggleFiltersPanel()` | Toggles visibility of the filters panel and saves state to localStorage | None | None |

### API Module

**File:** `js/mlb/api.js`

Handles all interactions with the MLB Stats API, includes caching functionality.

**Class:** `APIError` (extends Error)

**Constructor:**
- **Input:** 
  - `message` - String error message
  - `status` - Number HTTP status code
  - `endpoint` - String API endpoint that failed
- **Output:** APIError instance

**Object:** `API`

**Properties:**
- `BASE_URL` - Base URL for the MLB Stats API
- `cache` - Instance of APICache for caching responses

**Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `apiRequest(endpoint, params)` | Makes an API request with error handling and caching | `endpoint` - String API endpoint path<br>`params` - Object with query parameters (optional) | Promise resolving to API response data |
| `fetchGames(date)` | Fetches schedule data including games for a specific date | `date` - String date in YYYY-MM-DD format | Promise resolving to games data |
| `fetchStandings(date)` | Fetches team standings for a specific date | `date` - String date in YYYY-MM-DD format | Promise resolving to standings data |
| `processTeamRankings(standingsData)` | Processes raw standings data into a team rankings object | `standingsData` - Object with standings API response | Object mapping team IDs to ranking information |
| `fetchGameStats(gameId)` | Fetches detailed box score statistics for a game | `gameId` - Number game identifier | Promise resolving to detailed game statistics |
| `fetchStartingPitchers(gameId)` | Fetches and processes starting pitchers for a game | `gameId` - Number game identifier | Promise resolving to starting pitchers information |
| `extractStartingPitchers(boxscore)` | Extracts starting pitcher information from boxscore data | `boxscore` - Object with boxscore API response | Object with home and away starting pitcher information |
| `getTeamLogoUrl(teamId)` | Constructs the URL for a team's logo | `teamId` - Number team identifier | String URL for the team's logo |
| `fetchStartingLineups(gameId)` | Fetches and processes starting lineups for a game | `gameId` - Number game identifier | Promise resolving to starting lineups information |
| `extractStartingLineups(boxscore)` | Extracts lineup information from boxscore data | `boxscore` - Object with boxscore API response | Object with home and away lineup information |
| `fetchTeamPitchers(teamId)` | Fetches all starting pitchers for a team with complete stats | `teamId` - Number team identifier | Promise resolving to array of pitcher objects with stats |

### Parser Module

**File:** `js/parser.js`

Processes raw game data into a standardized format for use in the application.

**Class:** `Parser`

**Static Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `processGames(apiData)` | Processes API schedule data into standardized game objects | `apiData` - Object with games API response | Array of processed game objects |
| `processGameData(game)` | Transforms a raw game object into structured format with calculated properties | `game` - Object with raw game data | Object with processed game data |
| `extractPitcher(pitcher)` | Extracts basic pitcher information from API data | `pitcher` - Object with raw pitcher data | Object with processed pitcher information or null |
| `countLeadChanges(innings, awayTeamId, homeTeamId)` | Analyzes innings data to count how many times the lead changed hands | `innings` - Array of inning data<br>`awayTeamId` - Number away team identifier<br>`homeTeamId` - Number home team identifier | Number of lead changes in the game |
| `processFutureGames(apiData)` | Processes API data for upcoming games | `apiData` - Object with games API response | Array of processed future game objects |
| `processFutureGame(game)` | Transforms a raw future game object into structured format | `game` - Object with raw future game data | Object with processed future game data |
| `extractFuturePitcher(pitcher)` | Extracts basic pitcher information for future games | `pitcher` - Object with raw future pitcher data | Object with processed future pitcher information or null |
| `findLastLeadChangeInning(gameData)` | Determines which inning had the final lead change of the game | `gameData` - Object with raw game data | Number representing inning of last lead change |
| `isWalkoffGame(gameData)` | Determines if game ended with a walk-off win in the bottom of the last inning | `gameData` - Object with raw game data | Boolean indicating if game ended in a walk-off |
| `findMaximumLeadAndComeback(innings, awayTeamId, homeTeamId, finalAwayScore, finalHomeScore)` | Finds the maximum lead in a game and determines if there was a comeback victory | `innings` - Array of inning data<br>`awayTeamId` - Number away team ID<br>`homeTeamId` - Number home team ID<br>`finalAwayScore` - Number final away score<br>`finalHomeScore` - Number final home score | Object with `maxLead` and `comebackTeamId` indicating if/which team made a comeback |

### Ranker Module

**File:** `js/ranker.js`

Scores and ranks MLB games based on excitement factors.

**Class:** `Ranker`

**Static Properties:**
- `weights` - Object with scoring weights for different factors:
  - `closeGame`: 20 - Games with small run differences
  - `leadChanges`: 15 - Number and timing of lead changes
  - `lateGameDrama`: 20 - Close games in final innings, late lead changes, walk-offs
  - `comebackWin`: 10 - Teams overcoming significant deficits to win
  - `extraInnings`: 10 - Games that go beyond 9 innings
  - `highScoring`: 10 - Total runs scored with bonuses for balanced high-scoring games
  - `teamRankings`: 5 - Games between highly ranked teams
  - `hits`: 5 - Total hits in the game
  - `errors`: 5 - Errors that add drama

**Static Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `rankGames(games, options)` | Ranks games based on excitement factors and returns sorted array | `games` - Array of processed game objects<br>`options` - Object with ranking options/weights | Array of games ranked by excitement score |
| `calculateGameScore(game, options)` | Calculates total excitement score for a game based on all factors | `game` - Object with game data<br>`options` - Object with scoring options | Number representing excitement score (0-100) |
| `calculateCloseGameScore(game)` | Calculates score component based on run difference | `game` - Object with game data | Number representing score multiplier (0-1) |
| `calculateLeadChangesScore(game)` | Calculates score component based on number and timing of lead changes | `game` - Object with game data | Number representing score multiplier (0-1) |
| `calculateLateGameDramaScore(game)` | Calculates score component based on late-game action and drama | `game` - Object with game data | Number representing score multiplier (0-1) |
| `calculateExtraInningsScore(game)` | Calculates score component based on extra innings played | `game` - Object with game data | Number representing score multiplier (0-1) |
| `calculateHighScoringScore(game)` | Calculates score component based on total runs scored | `game` - Object with game data | Number representing score multiplier (0-1) |
| `calculateRankingsScore(game)` | Calculates score component based on team division rankings | `game` - Object with game data | Number representing score multiplier (0-1) |
| `calculateHitsScore(game)` | Calculates score component based on total hits in the game | `game` - Object with game data | Number representing score multiplier (0-1) |
| `calculateErrorsScore(game)` | Calculates score component based on errors adding to game drama | `game` - Object with game data | Number representing score multiplier (0-1) |
| `calculateComebackScore(game)` | Calculates score component based on comeback wins, where a team overcomes a 3+ run deficit | `game` - Object with game data | Number representing score multiplier (0-1) |
| `scoreToStars(score)` | Converts numeric excitement score to star rating for display | `score` - Number score (0-100) | Number star rating (1-5) |
| `getStarSymbols(starRating)` | Generates star symbols (★ and ½) for visual display | `starRating` - Number star rating (1-5) | String of star symbols |

### Utils Module

**File:** `js/utils.js`

Utility functions used throughout the application.

**Object:** `Utils`

**Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `getPlayerName(player)` | Gets player's full name from different API response formats | `player` - Object with player data from API | String containing player's full name |
| `processPlayerStats(stats, type)` | Processes player stats with default values to handle missing data | `stats` - Object with raw stats<br>`type` - String ('batting' or 'pitching') | Object with processed stats and default values |
| `formatDivisionName(divisionName)` | Formats a division name to be more concise (e.g. "American League East" to "AL East") | `divisionName` - String full division name | String formatted division name (shortened) |
| `createCacheKey(endpoint, params)` | Creates a unique cache key for storing API responses | `endpoint` - String API endpoint<br>`params` - Object with request parameters | String cache key |
| `getInningString(inning)` | Formats inning number with proper suffix (1st, 2nd, 3rd, etc.) | `inning` - Number inning number | String formatted inning with suffix |

## Component Modules

### GameCard Component

**File:** `js/components/GameCard.js`

Component for displaying game information in a card format.

**Class:** `GameCard`

**Constructor:**
- `constructor(game, options)`
  - **Input:**
    - `game` - Object containing game data
    - `options` - Object with optional configuration (optional)
  - **Output:** GameCard instance

**Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `render()` | Creates and returns the game card DOM element from template | None | HTMLElement - Game card DOM element |
| `renderTeams()` | Adds team logos, names and rankings to the card | None | None, updates the DOM with team information |
| `renderDivisionInfo(teamType)` | Adds division ranking information for a specific team | `teamType` - String ('away' or 'home') | None, updates the DOM with division information |
| `renderGameInfo()` | Adds game information including stadium, score, and game time for future games | None | None, updates the DOM with game information |
| `renderBoxScore(container)` | Creates the box score table with innings and runs/hits/errors | `container` - HTMLElement to contain the box score | None, updates the container with box score table |
| `renderRating()` | Adds star rating based on game excitement score | None | None, updates the DOM with game rating |
| `getStarRating()` | Calculates and formats star rating from excitement score | None | String representing star rating HTML |
| `createVsSection()` | Creates the VS section with reveal score button | None | None, creates VS section with reveal button |
| `loadPitcherStats(pitcher)` | Fetches and attaches stats to a pitcher object | `pitcher` - Object with pitcher data | Promise resolving to pitcher object with stats |
| `setupLineups()` | Creates the expandable lineups section with toggle button | None | None, sets up lineup section in the DOM |
| `toggleLineups(button, container)` | Handles showing/hiding the lineups section and loading data | `button` - HTMLElement button that was clicked<br>`container` - HTMLElement container to show/hide | None, toggles visibility of lineups |
| `loadAndRenderPitchers(container)` | Loads pitcher data from API and renders pitcher displays | `container` - HTMLElement containing pitcher displays | Promise resolving when pitchers are loaded and rendered |
| `loadAndRenderLineups(container)` | Loads lineup data from API and renders lineup displays | `container` - HTMLElement containing lineup displays | Promise resolving when lineups are loaded and rendered |
| `createPitcherDisplay(pitcher, teamType)` | Generates HTML for a pitcher's display panel | `pitcher` - Object with pitcher data<br>`teamType` - String ('away' or 'home') | String HTML for pitcher display |
| `formatPitcherStats(stats)` | Formats pitcher statistics for readable display | `stats` - Object with pitcher stats | String formatted stats for display |
| `update(newData)` | Updates the game card with new data and re-renders | `newData` - Object with updated game data | None, updates the game card DOM element |

### LineupDisplay Component

**File:** `js/components/LineupDisplay.js`

Component for showing team lineups.

**Class:** `LineupDisplay`

**Constructor:**
- `constructor(teamType, lineup)`
  - **Input:**
    - `teamType` - String ('away' or 'home')
    - `lineup` - Array of player objects (optional)
  - **Output:** LineupDisplay instance

**Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `render()` | Creates and returns the lineup display element | None | HTMLElement - Lineup display element |
| `createLineupTable()` | Builds an HTML table containing all players in the lineup with stats | None | HTMLElement - Table element with lineup data |
| `showPlayerDetails(player)` | Opens a detail panel showing comprehensive player information | `player` - Object with player data | None, shows player details panel |
| `update(newLineup)` | Updates the lineup with new player data and re-renders | `newLineup` - Array of new lineup data | None, updates the lineup display |
| `showLoading()` | Displays a loading indicator while lineup data is being fetched | None | None, shows loading state in the lineup display |
| `showError(message)` | Shows an error message if lineup data loading fails | `message` - String error message (default: 'Error loading lineup') | None, shows error state in the lineup display |

### PitcherDisplay Component

**File:** `js/mlb/components/PitcherDisplay.js`

Component for showing pitcher information.

**Class:** `PitcherDisplay`

**Constructor:**
- `constructor(pitcher, teamType)`
  - **Input:**
    - `pitcher` - Object with pitcher data
    - `teamType` - String ('away' or 'home')
  - **Output:** PitcherDisplay instance

**Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `render()` | Creates and returns the pitcher display element with image and stats | None | HTMLElement - Pitcher display element |
| `showPitcherDetails()` | Opens the detail panel with comprehensive pitcher statistics | None | None, shows the pitcher detail panel |
| `formatStats()` | Formats pitcher statistics into a readable string for display | None | String formatted stats for display |
| `update(newPitcher)` | Updates the pitcher display with new data and re-renders | `newPitcher` - Object with updated pitcher data | None, updates the pitcher display |

### PitcherDetailPanel Component

**File:** `js/mlb/components/PitcherDetailPanel.js`

Component for showing detailed pitcher information and team pitcher rankings in a sliding panel.

**Class:** `PitcherDetailPanel`

**Constructor:**
- `constructor(teamType)`
  - **Input:** `teamType` - String ('away' or 'home')
  - **Output:** PitcherDetailPanel instance

**Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `show(pitcher, onClose)` | Opens the panel with detailed pitcher information and stats | `pitcher` - Object with pitcher data<br>`onClose` - Function callback when panel is closed | None, shows the panel with pitcher details |
| `create(pitcher)` | Creates the panel DOM element and adds it to the page | `pitcher` - Object with pitcher data | None, creates the panel element |
| `updateContent(pitcher)` | Updates the panel content when showing a different pitcher | `pitcher` - Object with new pitcher data | None, updates panel with new pitcher data |
| `updatePanelContent(panel, pitcher)` | Updates the HTML content with pitcher stats and rankings | `panel` - HTMLElement panel to update<br>`pitcher` - Object with pitcher data | None, updates panel content |
| `close()` | Closes the panel with animation and cleanup | None | None, closes the panel |
| `isShowingPitcher(pitcher)` | Checks if the panel is currently showing a specific pitcher | `pitcher` - Object with pitcher data | Boolean - True if panel is showing this pitcher |
| `fetchTeamPitcherRankings(teamId)` | Fetches and ranks all starting pitchers from the team by ERA | `teamId` - Number team ID | Promise<Array> - Promise resolving to sorted array of pitchers |

### PlayerDetailPanel Component

**File:** `js/components/PlayerDetailPanel.js`

Component for showing detailed player information in a sliding panel.

**Class:** `PlayerDetailPanel`

**Constructor:**
- `constructor(teamType)`
  - **Input:** `teamType` - String ('away' or 'home')
  - **Output:** PlayerDetailPanel instance

**Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `show(player, onClose)` | Opens the panel with detailed player information | `player` - Object with player data<br>`onClose` - Function callback when panel is closed | None, shows the panel with player details |
| `create(player)` | Creates the panel DOM element and adds it to the page | `player` - Object with player data | None, creates the panel element |
| `updateContent(player)` | Updates the panel content when showing a different player | `player` - Object with new player data | None, updates panel with new player data |
| `updatePanelContent(panel, player)` | Updates the HTML content of the panel with player data | `panel` - HTMLElement panel to update<br>`player` - Object with player data | None, updates panel content with player data |
| `close()` | Closes the panel with animation and cleanup | None | None, closes the panel |
| `isShowingPlayer(player)` | Checks if the panel is currently showing a specific player | `player` - Object with player data | Boolean - True if panel is showing this player |

## Cache Module

**File:** `js/cache.js`

Provides caching functionality for API responses.

**Class:** `APICache`

**Constructor:**
- `constructor()`
  - **Input:** None
  - **Output:** APICache instance with 5-minute default expiration time

**Methods:**

| Method | Description | Input | Output |
|--------|-------------|-------|--------|
| `get(key)` | Retrieves cached data if it exists and has not expired | `key` - String cache key | Any cached data or null if not found/expired |
| `set(key, data)` | Stores data in the cache with current timestamp | `key` - String cache key<br>`data` - Any data to cache | None, stores data in cache |
| `cleanup()` | Removes expired items from the cache to free memory | None | None, clears expired items from cache |
| `getOrFetch(key, fetchFn)` | Retrieves from cache or fetches from source if not cached | `key` - String cache key<br>`fetchFn` - Function to fetch data if not cached | Promise resolving to data (either from cache or newly fetched) |

## Assets

### MLB Rivals

**File:** `assets/mlb/mlb_rivals.json`

Contains data about MLB team rivalries, including:
- Recent rivalries with their team names and nicknames
- Iconic rivalries with team names, nicknames, and descriptions

## CSS Styling

### Main Styles

**File:** `css/styles.css`

Contains all the main styling for the application, including:
- Basic layout and typography
- Game card styles
- Box score table styles
- Pitcher display styles
- Lineup display styles
- Player detail panel styles
- Filter styles

### Responsive Styles

**File:** `css/responsive.css`

Contains responsive styling for different screen sizes:
- Tablet styles (max-width: 992px)
- Large Mobile styles (max-width: 768px)
- Small Mobile styles (max-width: 480px)

## HTML Structure

**File:** `index.html`

Main HTML file for the application with the following structure:
- Header with title and description
- Controls section with date picker and filters
- Games container section
- Templates for game cards
- Footer with attribution

The HTML includes:
- Basic metadata and viewport settings
- CSS stylesheet links
- Basic page structure
- Container for game listings
- Templates for dynamic content
- Script imports for JavaScript modules