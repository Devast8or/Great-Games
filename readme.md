# MLB Great Games

A web application for discovering and watching MLB games without spoilers. The application fetches game data from the MLB Stats API and presents it in an organized, spoiler-free way.

## Features

### Game Discovery
- Date selection for viewing games
- Custom filters for excitement factors
- Star rating system for game excitement
- Division and team ranking information

### Spoiler Protection
- Scores hidden by default
- "Reveal Score" buttons
- Box score display (R-H-E format)
- Innings information

### Team Information
- Team logos and names
- Division rankings
- Win/loss records
- Starting pitchers with stats

### Lineup Display
- Complete batting lineups
- Player photos
- Player statistics (AVG, OBP, OPS, HR, RBI)
- Position information

## Technical Architecture

### Core Components

1. **UI Module (`ui.js`)**
- Main interface handler
- Manages DOM interactions
- Creates game cards
- Controls loading states
- Handles error messages

2. **API Module (`api.js`)**
- MLB Stats API interactions
- Fetches games, standings, lineups
- Processes raw API data
- Manages team logos/player images

3. **Parser Module (`parser.js`)**
- Processes raw game data
- Extracts relevant information
- Handles different game states

4. **Ranker Module (`ranker.js`)**
- Scores games based on excitement
- Considers factors:
  - Close games
  - Lead changes
  - Extra innings
  - High scoring
  - Team rankings

### Technologies Used

- **Frontend:**
  - HTML5
  - CSS3
  - JavaScript (ES6+)
    - Async/await
    - Template literals
    - Arrow functions
    - Classes and modules
    - Destructuring
    - Promise API

- **APIs:**
  - MLB Stats API

### File Structure

```
Great Games/
├── js/
│   ├── app.js        # Application entry point
│   ├── ui.js         # UI handling
│   ├── api.js        # API interactions
│   ├── parser.js     # Data processing
│   └── ranker.js     # Game ranking logic
├── css/
│   ├── styles.css    # Main styles
│   └── responsive.css # Responsive design
└── index.html        # Main HTML
```

### Data Flow

1. **User Input**
   - Date selection
   - Ranking criteria selection

2. **Data Fetching**
   - Game data from MLB API
   - Team standings
   - Pitcher statistics
   - Lineup information

3. **Data Processing**
   - Parser processes raw game data
   - Ranker calculates excitement scores
   - UI creates game cards

4. **User Interactions**
   - Reveal/hide scores
   - View lineups
   - Filter games by excitement

## Responsive Design

- Adapts to different screen sizes
- Tablet and mobile-friendly layouts
- Flexible grid system
- Collapsible sections for mobile

## Technical Features

- Asynchronous data loading
- Promise-based API handling
- Modular architecture
- Event-driven UI updates
- Clean separation of concerns
- Extensive error handling
- Detailed documentation

## Game Rating System

Games are rated based on multiple factors:

- **Close Score:** Games with 1-2 run differences
- **Lead Changes:** Number of lead changes
- **Extra Innings:** Games beyond 9 innings
- **High Scoring:** Total runs scored
- **Team Rankings:** Games between highly ranked teams

Star ratings:
- ★★★★★: 80-100 points (Elite game)
- ★★★★☆: 60-79 points (Great game)
- ★★★☆☆: 40-59 points (Good game)
- ★★☆☆☆: 20-39 points (Average game)
- ★☆☆☆☆: 0-19 points (Below average game)

## Development

The application is built as a pure frontend implementation without a backend server, relying on the MLB Stats API for all data needs.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for mobile devices
- Progressive enhancement approach