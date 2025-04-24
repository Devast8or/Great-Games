/**
 * UI module for handling DOM interactions
 */

const UI = {
    // DOM elements
    elements: {
        gameDate: document.getElementById('game-date'),
        loadGamesBtn: document.getElementById('load-games'),
        gamesList: document.getElementById('games-list'),
        loading: document.getElementById('loading'),
        errorMessage: document.getElementById('error-message'),
        noGames: document.getElementById('no-games'),
        closeGamesCheckbox: document.getElementById('close-games'),
        leadChangesCheckbox: document.getElementById('lead-changes'),
        extraInningsCheckbox: document.getElementById('extra-innings'),
        highScoringCheckbox: document.getElementById('high-scoring'),
        teamRankingsCheckbox: document.getElementById('team-rankings'),
    },
    
    /**
     * Initialize UI elements and event handlers
     */
    init() {
        // Set default date to yesterday (since we need completed games)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.elements.gameDate.value = this.formatDate(yesterday);
        
        // Add event listeners
        this.elements.loadGamesBtn.addEventListener('click', () => this.handleLoadGames());
        
        // Add event listeners for filter changes
        this.elements.closeGamesCheckbox.addEventListener('change', () => this.refreshGameRankings());
        this.elements.leadChangesCheckbox.addEventListener('change', () => this.refreshGameRankings());
        this.elements.extraInningsCheckbox.addEventListener('change', () => this.refreshGameRankings());
        this.elements.highScoringCheckbox.addEventListener('change', () => this.refreshGameRankings());
        this.elements.teamRankingsCheckbox.addEventListener('change', () => this.refreshGameRankings());
    },
    
    /**
     * Format date as YYYY-MM-DD
     * @param {Date} date - Date object
     * @returns {string} - Formatted date string
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    /**
     * Handle the load games button click
     */
    async handleLoadGames() {
        const date = this.elements.gameDate.value;
        
        if (!date) {
            alert('Please select a date');
            return;
        }
        
        try {
            this.showLoading();
            console.log("Attempting to load games for date:", date);
            
            // Check if selected date is in the future
            const selectedDate = new Date(date);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time portion for accurate date comparison
            
            const isFutureDate = selectedDate > today;
            console.log("Is future date:", isFutureDate);
            
            if (isFutureDate) {
                // Handle future games differently
                await this.loadFutureGames(date);
            } else {
                // Fetch completed games as usual
                await this.loadCompletedGames(date);
            }
        } catch (error) {
            console.error('Error loading games:', error);
            this.showError();
        }
    },
    
    /**
     * Load completed games for a specific date
     * @param {string} date - Date in format YYYY-MM-DD
     */
    async loadCompletedGames(date) {
        // Fetch games from the API
        const apiData = await API.fetchGames(date);
        
        // Fetch standings data to get team rankings
        const standingsData = await API.fetchStandings(date);
        const teamRankings = API.processTeamRankings(standingsData);
        
        // Process the games data
        const games = Parser.processGames(apiData);
        
        // Add team rankings to each game
        games.forEach(game => {
            game.awayTeam.ranking = teamRankings[game.awayTeam.id] || { divisionRank: 0, winPercentage: 0 };
            game.homeTeam.ranking = teamRankings[game.homeTeam.id] || { divisionRank: 0, winPercentage: 0 };
        });
        
        // Store games for filtering
        this.games = games;
        this.isFutureGames = false;
        
        // Display games
        this.displayGames();
    },
    
    /**
     * Load future games for a specific date
     * @param {string} date - Date in format YYYY-MM-DD
     */
    async loadFutureGames(date) {
        // Fetch games from the API
        const apiData = await API.fetchGames(date);
        
        // Fetch standings data to get team rankings
        const standingsData = await API.fetchStandings(date);
        const teamRankings = API.processTeamRankings(standingsData);
        
        // Process all games, including scheduled ones
        const games = [];
        
        if (apiData.dates && apiData.dates.length > 0) {
            apiData.dates.forEach(dateData => {
                if (dateData.games && dateData.games.length > 0) {
                    dateData.games.forEach(game => {
                        // Include scheduled games (not just completed ones)
                        if (game.status.abstractGameState === 'Preview' || 
                            game.status.abstractGameState === 'Scheduled') {
                            
                            const processedGame = this.processFutureGame(game);
                            games.push(processedGame);
                        }
                    });
                }
            });
        }
        
        // Add team rankings to each game
        games.forEach(game => {
            game.awayTeam.ranking = teamRankings[game.awayTeam.id] || { divisionRank: 0, winPercentage: 0 };
            game.homeTeam.ranking = teamRankings[game.homeTeam.id] || { divisionRank: 0, winPercentage: 0 };
        });
        
        // Store games
        this.games = games;
        this.isFutureGames = true;
        
        // Display games without ranking
        this.displayFutureGames();
    },
    
    /**
     * Process future game data
     * @param {Object} game - Raw game data
     * @returns {Object} - Processed game object for future games
     */
    processFutureGame(game) {
        // Extract teams data
        const awayTeam = game.teams.away;
        const homeTeam = game.teams.home;
        
        // Get starting pitchers if available
        let awayPitcher = null;
        if (awayTeam.probablePitcher) {
            awayPitcher = {
                id: awayTeam.probablePitcher.id,
                name: awayTeam.probablePitcher.fullName || 
                      (awayTeam.probablePitcher.firstName && awayTeam.probablePitcher.lastName ? 
                       `${awayTeam.probablePitcher.firstName} ${awayTeam.probablePitcher.lastName}` : 
                       'TBD'),
                stats: null // Stats will be loaded separately when needed
            };
        }
        
        let homePitcher = null;
        if (homeTeam.probablePitcher) {
            homePitcher = {
                id: homeTeam.probablePitcher.id,
                name: homeTeam.probablePitcher.fullName || 
                      (homeTeam.probablePitcher.firstName && homeTeam.probablePitcher.lastName ? 
                       `${homeTeam.probablePitcher.firstName} ${homeTeam.probablePitcher.lastName}` : 
                       'TBD'),
                stats: null // Stats will be loaded separately when needed
            };
        }
        
        // Get game time
        const gameDate = new Date(game.gameDate);
        const gameTimeStr = gameDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        return {
            id: game.gamePk,
            date: game.gameDate,
            status: game.status.detailedState,
            gameTime: gameTimeStr,
            isFuture: true,
            awayTeam: {
                id: awayTeam.team.id,
                name: awayTeam.team.name,
                logoUrl: API.getTeamLogoUrl(awayTeam.team.id),
                pitcher: awayPitcher,
                lineup: [] // Will be populated later if available
            },
            homeTeam: {
                id: homeTeam.team.id,
                name: homeTeam.team.name,
                logoUrl: API.getTeamLogoUrl(homeTeam.team.id),
                pitcher: homePitcher,
                lineup: [] // Will be populated later if available
            },
            venue: game.venue?.name || 'Unknown Venue'
        };
    },
    
    /**
     * Display future games in the UI
     */
    displayFutureGames() {
        this.hideLoading();
        
        if (!this.games || this.games.length === 0) {
            this.showNoGames();
            return;
        }
        
        // Sort future games by time
        const sortedGames = [...this.games].sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });
        
        // Clear previous games
        this.elements.gamesList.innerHTML = '';
        
        // Create game elements for future games
        sortedGames.forEach(game => {
            const gameElement = this.createFutureGameElement(game);
            this.elements.gamesList.appendChild(gameElement);
        });
        
        // Show games container
        this.elements.gamesList.classList.remove('hidden');
        this.elements.noGames.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
    },
    
    /**
     * Create a game card element for future games
     * @param {Object} game - Game data
     * @returns {HTMLElement} - Game card element
     */
    createFutureGameElement(game) {
        // Clone template
        const template = document.getElementById('game-card-template');
        const gameElement = document.importNode(template.content, true).querySelector('.game-card');
        
        // Set team names and logos
        gameElement.querySelector('.away .team-name').textContent = game.awayTeam.name;
        gameElement.querySelector('.away .team-logo').src = game.awayTeam.logoUrl;
        gameElement.querySelector('.away .team-logo').alt = game.awayTeam.name + ' logo';
        
        gameElement.querySelector('.home .team-name').textContent = game.homeTeam.name;
        gameElement.querySelector('.home .team-logo').src = game.homeTeam.logoUrl;
        gameElement.querySelector('.home .team-logo').alt = game.homeTeam.name + ' logo';
        
        // Add division names below team names
        if (game.awayTeam.ranking && game.awayTeam.ranking.divisionName) {
            const awayDivisionElement = document.createElement('span');
            awayDivisionElement.className = 'team-division';
            awayDivisionElement.textContent = game.awayTeam.ranking.divisionName;
            awayDivisionElement.style.fontSize = '0.8rem';
            awayDivisionElement.style.color = 'rgba(255,255,255,0.8)';
            
            // Insert division name after team name
            const awayTeamNameElement = gameElement.querySelector('.away .team-name');
            awayTeamNameElement.parentNode.insertBefore(awayDivisionElement, awayTeamNameElement.nextSibling);
        }
        
        if (game.homeTeam.ranking && game.homeTeam.ranking.divisionName) {
            const homeDivisionElement = document.createElement('span');
            homeDivisionElement.className = 'team-division';
            homeDivisionElement.textContent = game.homeTeam.ranking.divisionName;
            homeDivisionElement.style.fontSize = '0.8rem';
            homeDivisionElement.style.color = 'rgba(255,255,255,0.8)';
            
            // Insert division name after team name
            const homeTeamNameElement = gameElement.querySelector('.home .team-name');
            homeTeamNameElement.parentNode.insertBefore(homeDivisionElement, homeTeamNameElement.nextSibling);
        }
        
        // Set team rankings if available
        const awayRankElement = gameElement.querySelector('.away .team-rank');
        const homeRankElement = gameElement.querySelector('.home .team-rank');
        
        if (game.awayTeam.ranking && game.awayTeam.ranking.divisionRank) {
            awayRankElement.textContent = `Div Rank: ${game.awayTeam.ranking.divisionRank}`;
            awayRankElement.classList.remove('hidden');
        } else {
            awayRankElement.classList.add('hidden');
        }
        
        if (game.homeTeam.ranking && game.homeTeam.ranking.divisionRank) {
            homeRankElement.textContent = `Div Rank: ${game.homeTeam.ranking.divisionRank}`;
            homeRankElement.classList.remove('hidden');
        } else {
            homeRankElement.classList.add('hidden');
        }
        
        // Remove pitcher elements completely from the top section
        const awayPitcherElement = gameElement.querySelector('.away .pitcher');
        const homePitcherElement = gameElement.querySelector('.home .pitcher');
        
        if (awayPitcherElement && awayPitcherElement.parentNode) {
            awayPitcherElement.parentNode.removeChild(awayPitcherElement);
        }
        
        if (homePitcherElement && homePitcherElement.parentNode) {
            homePitcherElement.parentNode.removeChild(homePitcherElement);
        }
        
        // Set venue and game time
        const gameDate = new Date(game.gameDate);
        const gameTimeStr = gameDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        gameElement.querySelector('.stadium').textContent = game.venue?.name || 'Unknown Venue';
        gameElement.querySelector('.game-time').textContent = gameTimeStr;
        
        return gameElement;
    },
    
    /**
     * Get the current ranking options from UI
     * @returns {Object} - Options object
     */
    getRankingOptions() {
        return {
            closeGames: this.elements.closeGamesCheckbox.checked,
            leadChanges: this.elements.leadChangesCheckbox.checked,
            extraInnings: this.elements.extraInningsCheckbox.checked,
            highScoring: this.elements.highScoringCheckbox.checked,
            teamRankings: this.elements.teamRankingsCheckbox.checked
        };
    },
    
    /**
     * Refresh game rankings when filters change
     */
    refreshGameRankings() {
        if (this.games && this.games.length > 0) {
            this.displayGames();
        }
    },
    
    /**
     * Display games in the UI
     */
    displayGames() {
        this.hideLoading();
        
        if (!this.games || this.games.length === 0) {
            this.showNoGames();
            return;
        }
        
        // If these are future games, use the future games display method
        if (this.isFutureGames) {
            this.displayFutureGames();
            return;
        }
        
        // Rank games based on current options
        const options = this.getRankingOptions();
        const rankedGames = Ranker.rankGames(this.games, options);
        
        // Clear previous games
        this.elements.gamesList.innerHTML = '';
        
        // Load pitcher stats for all games in parallel
        const loadPitcherStatsPromises = rankedGames.map(game => this.loadPitcherStats(game));
        
        // Create game elements once stats are loaded
        Promise.allSettled(loadPitcherStatsPromises).then(() => {
            // Create game elements
            rankedGames.forEach(game => {
                const gameElement = this.createGameElement(game);
                this.elements.gamesList.appendChild(gameElement);
            });
        });
        
        // Show games container
        this.elements.gamesList.classList.remove('hidden');
        this.elements.noGames.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
    },
    
    /**
     * Load pitcher stats for a game
     * @param {Object} game - Game data
     * @returns {Promise} - Promise that resolves when stats are loaded
     */
    async loadPitcherStats(game) {
        try {
            // Only load if we have pitcher IDs and no stats yet
            if ((game.awayTeam.pitcher && !game.awayTeam.pitcher.stats) || 
                (game.homeTeam.pitcher && !game.homeTeam.pitcher.stats)) {
                
                // Fetch pitcher data
                const pitcherData = await API.fetchStartingPitchers(game.id);
                
                // Update away pitcher stats
                if (game.awayTeam.pitcher && pitcherData.away) {
                    game.awayTeam.pitcher.stats = pitcherData.away.stats;
                }
                
                // Update home pitcher stats
                if (game.homeTeam.pitcher && pitcherData.home) {
                    game.homeTeam.pitcher.stats = pitcherData.home.stats;
                }
            }
        } catch (error) {
            console.error(`Error loading pitcher stats for game ${game.id}:`, error);
            // Don't rethrow, we'll handle missing stats gracefully in the UI
        }
    },
    
    /**
     * Create a game card element
     * @param {Object} game - Game data
     * @returns {HTMLElement} - Game card element
     */
    createGameElement(game) {
        // Clone template
        const template = document.getElementById('game-card-template');
        const gameElement = document.importNode(template.content, true).querySelector('.game-card');
        
        // Calculate star rating
        const stars = Ranker.scoreToStars(game.excitementScore || 0);
        const starSymbols = Ranker.getStarSymbols(stars);
        
        // Create rating element to insert at the very top of the card
        const ratingElement = document.createElement('div');
        ratingElement.className = 'rating top-rating';
        ratingElement.innerHTML = `<span class="rating-label">Game Rating</span><span class="stars" title="${Math.round(game.excitementScore || 0)} Points">${starSymbols}</span>`;
        
        // Style the top rating
        ratingElement.style.margin = '0.5rem 0';
        ratingElement.style.textAlign = 'center';
        ratingElement.style.color = 'white';
        
        // Style the rating label specifically
        const ratingLabel = ratingElement.querySelector('.rating-label');
        if (ratingLabel) {
            ratingLabel.style.color = 'black';
            ratingLabel.style.marginRight = '0.5rem';
        }
        
        // Add tooltip with detailed explanation of how ratings are calculated to the rating label
        ratingElement.title = "Game Rating is calculated by scoring these factors:\n" +
            "• Close Score: Games with scoring differences of 1-2 runs receive more points\n" +
            "• Lead Changes: Each lead change adds excitement points\n" +
            "• Extra Innings: Games going beyond 9 innings receive bonus points\n" +
            "• High Scoring: Total runs scored contributes to excitement\n" +
            "• Team Rankings: Games between highly ranked teams get bonus points\n\n" +
            "Stars are assigned based on total excitement score:\n" +
            "★★★★★: 80-100 points (Elite game)\n" +
            "★★★★☆: 60-79 points (Great game)\n" +
            "★★★☆☆: 40-59 points (Good game)\n" +
            "★★☆☆☆: 20-39 points (Average game)\n" +
            "★☆☆☆☆: 0-19 points (Below average game)";
        ratingElement.style.cursor = 'help';
        
        // Get the teams container and insert rating before it, at the very top of the card
        const teamsContainer = gameElement.querySelector('.teams');
        teamsContainer.parentNode.insertBefore(ratingElement, teamsContainer);
        
        // Hide the original rating section in the game info
        const infoRating = gameElement.querySelector('.game-info .rating');
        if (infoRating) {
            infoRating.classList.add('hidden');
        }
        
        // Set team names and logos
        gameElement.querySelector('.away .team-name').textContent = game.awayTeam.name;
        gameElement.querySelector('.away .team-logo').src = game.awayTeam.logoUrl;
        gameElement.querySelector('.away .team-logo').alt = game.awayTeam.name + ' logo';
        
        gameElement.querySelector('.home .team-name').textContent = game.homeTeam.name;
        gameElement.querySelector('.home .team-logo').src = game.homeTeam.logoUrl;
        gameElement.querySelector('.home .team-logo').alt = game.homeTeam.name + ' logo';
        
        // Add division names below team names
        if (game.awayTeam.ranking && game.awayTeam.ranking.divisionName) {
            const awayDivisionElement = document.createElement('span');
            awayDivisionElement.className = 'team-division';
            awayDivisionElement.textContent = game.awayTeam.ranking.divisionName;
            awayDivisionElement.style.fontSize = '0.8rem';
            awayDivisionElement.style.color = 'rgba(255,255,255,0.8)';
            
            // Insert division name after team name
            const awayTeamNameElement = gameElement.querySelector('.away .team-name');
            awayTeamNameElement.parentNode.insertBefore(awayDivisionElement, awayTeamNameElement.nextSibling);
        }
        
        if (game.homeTeam.ranking && game.homeTeam.ranking.divisionName) {
            const homeDivisionElement = document.createElement('span');
            homeDivisionElement.className = 'team-division';
            homeDivisionElement.textContent = game.homeTeam.ranking.divisionName;
            homeDivisionElement.style.fontSize = '0.8rem';
            homeDivisionElement.style.color = 'rgba(255,255,255,0.8)';
            
            // Insert division name after team name
            const homeTeamNameElement = gameElement.querySelector('.home .team-name');
            homeTeamNameElement.parentNode.insertBefore(homeDivisionElement, homeTeamNameElement.nextSibling);
        }
        
        // Set team rankings if available
        const awayRankElement = gameElement.querySelector('.away .team-rank');
        const homeRankElement = gameElement.querySelector('.home .team-rank');
        
        if (game.awayTeam.ranking && game.awayTeam.ranking.divisionRank) {
            awayRankElement.textContent = `Div Rank: ${game.awayTeam.ranking.divisionRank}`;
            awayRankElement.classList.remove('hidden');
        } else {
            awayRankElement.classList.add('hidden');
        }
        
        if (game.homeTeam.ranking && game.homeTeam.ranking.divisionRank) {
            homeRankElement.textContent = `Div Rank: ${game.homeTeam.ranking.divisionRank}`;
            homeRankElement.classList.remove('hidden');
        } else {
            homeRankElement.classList.add('hidden');
        }
        
        // Remove pitcher elements completely from the top section
        const awayPitcherElement = gameElement.querySelector('.away .pitcher');
        const homePitcherElement = gameElement.querySelector('.home .pitcher');
        
        if (awayPitcherElement && awayPitcherElement.parentNode) {
            awayPitcherElement.parentNode.removeChild(awayPitcherElement);
        }
        
        if (homePitcherElement && homePitcherElement.parentNode) {
            homePitcherElement.parentNode.removeChild(homePitcherElement);
        }
        
        // Set venue
        gameElement.querySelector('.stadium').textContent = game.venue;

        // Create a new better box score display
        const scoreElement = gameElement.querySelector('.score');
        // Clear any existing content
        scoreElement.innerHTML = '';
        
        // Create a table for the box score (R-H-E format)
        const boxScoreTable = document.createElement('table');
        boxScoreTable.className = 'box-score-table';
        
        // Header row with R-H-E labels
        const headerRow = document.createElement('tr');
        const emptyHeader = document.createElement('th');
        headerRow.appendChild(emptyHeader);
        
        const runsHeader = document.createElement('th');
        runsHeader.textContent = 'R';
        runsHeader.title = 'Runs';
        
        const hitsHeader = document.createElement('th');
        hitsHeader.textContent = 'H';
        hitsHeader.title = 'Hits';
        
        const errorsHeader = document.createElement('th');
        errorsHeader.textContent = 'E';
        errorsHeader.title = 'Errors';
        
        headerRow.appendChild(runsHeader);
        headerRow.appendChild(hitsHeader);
        headerRow.appendChild(errorsHeader);
        boxScoreTable.appendChild(headerRow);
        
        // Away team row
        const awayRow = document.createElement('tr');
        const awayLabel = document.createElement('td');
        awayLabel.className = 'team-logo-cell';
        
        // Create small logo image for away team
        const awayLogoImg = document.createElement('img');
        awayLogoImg.src = game.awayTeam.logoUrl;
        awayLogoImg.alt = game.awayTeam.name;
        awayLogoImg.title = game.awayTeam.name;
        awayLogoImg.className = 'score-team-logo';
        awayLabel.appendChild(awayLogoImg);
        
        const awayRuns = document.createElement('td');
        awayRuns.textContent = game.awayTeam.score;
        awayRuns.className = 'runs-cell';
        
        const awayHits = document.createElement('td');
        awayHits.textContent = game.awayTeam.hits;
        
        const awayErrors = document.createElement('td');
        awayErrors.textContent = game.awayTeam.errors;
        
        awayRow.appendChild(awayLabel);
        awayRow.appendChild(awayRuns);
        awayRow.appendChild(awayHits);
        awayRow.appendChild(awayErrors);
        boxScoreTable.appendChild(awayRow);
        
        // Home team row
        const homeRow = document.createElement('tr');
        const homeLabel = document.createElement('td');
        homeLabel.className = 'team-logo-cell';
        
        // Create small logo image for home team
        const homeLogoImg = document.createElement('img');
        homeLogoImg.src = game.homeTeam.logoUrl;
        homeLogoImg.alt = game.homeTeam.name;
        homeLogoImg.title = game.homeTeam.name;
        homeLogoImg.className = 'score-team-logo';
        homeLabel.appendChild(homeLogoImg);
        
        const homeRuns = document.createElement('td');
        homeRuns.textContent = game.homeTeam.score;
        homeRuns.className = 'runs-cell';
        
        const homeHits = document.createElement('td');
        homeHits.textContent = game.homeTeam.hits;
        
        const homeErrors = document.createElement('td');
        homeErrors.textContent = game.homeTeam.errors;
        
        homeRow.appendChild(homeLabel);
        homeRow.appendChild(homeRuns);
        homeRow.appendChild(homeHits);
        homeRow.appendChild(homeErrors);
        boxScoreTable.appendChild(homeRow);
        
        // Add the box score table to the score element
        scoreElement.appendChild(boxScoreTable);
        
        // Add innings info if it's an extra innings game
        if (game.isExtraInnings) {
            const inningsInfo = document.createElement('div');
            inningsInfo.className = 'innings-info';
            inningsInfo.textContent = `${game.innings} innings`;
            scoreElement.appendChild(inningsInfo);
        }
        
        // Create pitcher containers
        const pitcherContainer = this.createPitcherElements(game, gameElement);
        
        // Add pitcher container to the game info container before the score element
        const gameInfoContainer = gameElement.querySelector('.game-info');
        gameInfoContainer.insertBefore(pitcherContainer, scoreElement);
        
        // Create VS section reveal button container
        const vsScoreContainer = document.createElement('div');
        vsScoreContainer.className = 'vs-score-container';
        
        // Get the VS element
        const vsElement = gameElement.querySelector('.vs');
        
        // Create reveal button for the top section
        const topRevealBtn = document.createElement('button');
        topRevealBtn.className = 'reveal-btn top-reveal-btn';
        topRevealBtn.textContent = 'Reveal Score';
        
        // Replace VS with container
        vsElement.parentNode.replaceChild(vsScoreContainer, vsElement);
        
        // Add elements to VS score container
        vsScoreContainer.appendChild(vsElement);
        vsScoreContainer.appendChild(topRevealBtn);
        
        // Get the existing reveal button and remove it (since we relocated it)
        const revealBtn = gameElement.querySelector('.reveal-btn:not(.top-reveal-btn)');
        if (revealBtn) {
            revealBtn.parentNode.removeChild(revealBtn);
        }
        
        // Add event listener for reveal button
        topRevealBtn.addEventListener('click', () => {
            scoreElement.classList.toggle('hidden');
            topRevealBtn.textContent = scoreElement.classList.contains('hidden') ? 
                'Reveal Score' : 'Hide Score';
        });
        
        // Remove watch links completely
        const watchLinksContainer = gameElement.querySelector('.watch-links');
        if (watchLinksContainer && watchLinksContainer.parentNode) {
            watchLinksContainer.parentNode.removeChild(watchLinksContainer);
        }
        
        // Add lineup containers and buttons
        this.addLineupElements(gameElement, game);
        
        return gameElement;
    },
    
    /**
     * Create pitcher elements for a game
     * @param {Object} game - Game data
     * @param {HTMLElement} gameElement - Game card element
     * @returns {HTMLElement} - Pitcher container element
     */
    createPitcherElements(game, gameElement) {
        // Create pitcher image containers for the game info section
        const pitcherImagesContainer = document.createElement('div');
        pitcherImagesContainer.className = 'pitcher-images';
        
        // Create away pitcher image and name container
        const awayPitcherContainer = document.createElement('div');
        awayPitcherContainer.className = 'pitcher-container away-pitcher-container';
        
        const awayPitcherImg = document.createElement('div');
        awayPitcherImg.className = 'pitcher-img away-pitcher-img';
        if (game.awayTeam.pitcher && game.awayTeam.pitcher.id) {
            const pitcherImage = document.createElement('img');
            pitcherImage.src = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${game.awayTeam.pitcher.id}/headshot/67/current`;
            pitcherImage.alt = `${game.awayTeam.pitcher.name || 'Away pitcher'}`;
            pitcherImage.title = game.awayTeam.pitcher.name || 'Away pitcher';
            awayPitcherImg.appendChild(pitcherImage);
            
            // Create pitcher name label
            const awayPitcherName = document.createElement('div');
            awayPitcherName.className = 'pitcher-name';
            awayPitcherName.textContent = game.awayTeam.pitcher.name || 'Away pitcher';
            
            // Add pitcher stats
            const awayPitcherStats = document.createElement('div');
            awayPitcherStats.className = 'pitcher-stats';
            
            // Use stats from API if available or show placeholder values
            if (game.awayTeam.pitcher.stats) {
                const stats = game.awayTeam.pitcher.stats;
                // Only show win-loss record if both values are non-zero
                const winLossText = (Number(stats.wins) > 0 && Number(stats.losses) > 0) ? 
                    `, ${stats.wins}-${stats.losses}` : '';
                awayPitcherStats.textContent = `${stats.gamesPlayed || '0'} G, ${stats.era || '0.00'} ERA${winLossText}`;
            } else {
                awayPitcherStats.textContent = 'Stats not available';
            }
            
            // Add image, name and stats to container
            awayPitcherContainer.appendChild(awayPitcherImg);
            awayPitcherContainer.appendChild(awayPitcherName);
            awayPitcherContainer.appendChild(awayPitcherStats);
        } else {
            awayPitcherContainer.classList.add('hidden');
        }
        
        // Create home pitcher image and name container
        const homePitcherContainer = document.createElement('div');
        homePitcherContainer.className = 'pitcher-container home-pitcher-container';
        
        const homePitcherImg = document.createElement('div');
        homePitcherImg.className = 'pitcher-img home-pitcher-img';
        if (game.homeTeam.pitcher && game.homeTeam.pitcher.id) {
            const pitcherImage = document.createElement('img');
            pitcherImage.src = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${game.homeTeam.pitcher.id}/headshot/67/current`;
            pitcherImage.alt = `${game.homeTeam.pitcher.name || 'Home pitcher'}`;
            pitcherImage.title = game.homeTeam.pitcher.name || 'Home pitcher';
            homePitcherImg.appendChild(pitcherImage);
            
            // Create pitcher name label
            const homePitcherName = document.createElement('div');
            homePitcherName.className = 'pitcher-name';
            homePitcherName.textContent = game.homeTeam.pitcher.name || 'Home pitcher';
            
            // Add pitcher stats
            const homePitcherStats = document.createElement('div');
            homePitcherStats.className = 'pitcher-stats';
            
            // Use stats from API if available or show placeholder values
            if (game.homeTeam.pitcher.stats) {
                const stats = game.homeTeam.pitcher.stats;
                // Only show win-loss record if both values are non-zero
                const winLossText = (Number(stats.wins) > 0 && Number(stats.losses) > 0) ? 
                    `, ${stats.wins}-${stats.losses}` : '';
                homePitcherStats.textContent = `${stats.gamesPlayed || '0'} G, ${stats.era || '0.00'} ERA${winLossText}`;
            } else {
                homePitcherStats.textContent = 'Stats not available';
            }
            
            // Add image, name and stats to container
            homePitcherContainer.appendChild(homePitcherImg);
            homePitcherContainer.appendChild(homePitcherName);
            homePitcherContainer.appendChild(homePitcherStats);
        } else {
            homePitcherContainer.classList.add('hidden');
        }
        
        // Create button container with pitcher images (without reveal button)
        const pitcherContainer = document.createElement('div');
        pitcherContainer.className = 'pitchers-container';
        
        // Add pitcher containers to the pitcher container
        pitcherContainer.appendChild(awayPitcherContainer);
        pitcherContainer.appendChild(homePitcherContainer);
        
        return pitcherContainer;
    },
    
    /**
     * Add lineup elements to a game card
     * @param {HTMLElement} gameElement - Game card element
     * @param {Object} game - Game data
     */
    addLineupElements(gameElement, game) {
        // Get the game-info container
        const gameInfoContainer = gameElement.querySelector('.game-info');
        
        // Create expand button with arrow icon
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = '<span class="arrow-down">▼</span> Show Lineups';
        
        // Add expand button to the game info container (at the end)
        gameInfoContainer.appendChild(expandBtn);
        
        // Create lineup containers
        const lineupContainer = document.createElement('div');
        lineupContainer.className = 'lineups-container hidden';
        
        const awayLineupContainer = document.createElement('div');
        awayLineupContainer.className = 'lineup away-lineup';
        awayLineupContainer.innerHTML = '<h4>Away Lineup</h4><div class="lineup-loading">Loading lineup...</div>';
        
        const homeLineupContainer = document.createElement('div');
        homeLineupContainer.className = 'lineup home-lineup';
        homeLineupContainer.innerHTML = '<h4>Home Lineup</h4><div class="lineup-loading">Loading lineup...</div>';
        
        lineupContainer.appendChild(awayLineupContainer);
        lineupContainer.appendChild(homeLineupContainer);
        
        // Add lineup container to the game card
        gameElement.appendChild(lineupContainer);
        
        // Add event listener for expand button
        expandBtn.addEventListener('click', async () => {
            lineupContainer.classList.toggle('hidden');
            
            // Update button text and arrow
            if (lineupContainer.classList.contains('hidden')) {
                expandBtn.innerHTML = '<span class="arrow-down">▼</span> Show Lineups';
            } else {
                expandBtn.innerHTML = '<span class="arrow-up">▲</span> Hide Lineups';
            }
            
            // Load lineups if not already loaded
            if (!game.lineupsLoaded && !lineupContainer.classList.contains('hidden')) {
                try {
                    // Fetch and display lineups
                    await this.loadAndDisplayLineups(game, awayLineupContainer, homeLineupContainer);
                    game.lineupsLoaded = true;
                } catch (error) {
                    console.error(`Error loading lineups for game ${game.id}:`, error);
                    awayLineupContainer.innerHTML = '<h4>Away Lineup</h4><div class="error">Error loading lineup</div>';
                    homeLineupContainer.innerHTML = '<h4>Home Lineup</h4><div class="error">Error loading lineup</div>';
                }
            }
        });
    },
    
    /**
     * Load and display lineups for a game
     * @param {Object} game - Game data
     * @param {HTMLElement} awayContainer - Container for away team lineup
     * @param {HTMLElement} homeContainer - Container for home team lineup
     */
    async loadAndDisplayLineups(game, awayContainer, homeContainer) {
        // Fetch lineups from API
        const lineups = await API.fetchStartingLineups(game.id);
        
        // Update game object with lineup data
        game.awayTeam.lineup = lineups.away;
        game.homeTeam.lineup = lineups.home;
        
        // Display away team lineup
        this.displayLineup(game.awayTeam.lineup, awayContainer, 'Away Lineup');
        
        // Display home team lineup
        this.displayLineup(game.homeTeam.lineup, homeContainer, 'Home Lineup');
    },
    
    /**
     * Display a team's lineup in the container
     * @param {Array} lineup - Array of player objects
     * @param {HTMLElement} container - Container element
     * @param {String} title - Lineup title
     */
    displayLineup(lineup, container, title) {
        // Clear loading indicator
        container.innerHTML = '';
        
        // Add title
        const titleElement = document.createElement('h4');
        titleElement.textContent = title;
        container.appendChild(titleElement);
        
        if (!lineup || lineup.length === 0) {
            const noLineupElement = document.createElement('div');
            noLineupElement.className = 'no-lineup';
            noLineupElement.textContent = 'No lineup data available';
            container.appendChild(noLineupElement);
            return;
        }
        
        // Create table for lineup
        const table = document.createElement('table');
        table.className = 'lineup-table';
        
        // Add header row
        const headerRow = document.createElement('tr');
        ['Player', 'Pos', 'Name', 'GP', 'AVG', 'OBP', 'OPS', 'HR', 'RBI'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        
        // Add player rows
        lineup.forEach((player, index) => {
            const row = document.createElement('tr');
            
            // Player image instead of batting order number
            const playerImgCell = document.createElement('td');
            playerImgCell.className = 'player-img-cell';
            
            if (player.id) {
                const playerImg = document.createElement('img');
                playerImg.className = 'player-small-img';
                playerImg.src = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_45,q_auto:best/v1/people/${player.id}/headshot/67/current`;
                playerImg.alt = player.name || `Player #${index + 1}`;
                playerImg.title = player.name;
                playerImgCell.appendChild(playerImg);
            } else {
                // Fallback if no player ID
                playerImgCell.textContent = (index + 1).toString();
            }
            row.appendChild(playerImgCell);
            
            // Position
            const posCell = document.createElement('td');
            posCell.textContent = player.position;
            row.appendChild(posCell);
            
            // Player name
            const nameCell = document.createElement('td');
            nameCell.textContent = player.name;
            row.appendChild(nameCell);
            
            // GP - Games Played
            const gpCell = document.createElement('td');
            gpCell.textContent = player.stats.gamesPlayed || '0';
            row.appendChild(gpCell);
            
            // AVG
            const avgCell = document.createElement('td');
            avgCell.textContent = player.stats.avg;
            row.appendChild(avgCell);
            
            // OBP
            const obpCell = document.createElement('td');
            obpCell.textContent = player.stats.obp || '.000';
            row.appendChild(obpCell);
            
            // OPS
            const opsCell = document.createElement('td');
            opsCell.textContent = player.stats.ops;
            row.appendChild(opsCell);
            
            // HR
            const hrCell = document.createElement('td');
            hrCell.textContent = player.stats.hr;
            row.appendChild(hrCell);
            
            // RBI
            const rbiCell = document.createElement('td');
            rbiCell.textContent = player.stats.rbi;
            row.appendChild(rbiCell);
            
            table.appendChild(row);
        });
        
        container.appendChild(table);
    },
    
    /**
     * Show loading indicator
     */
    showLoading() {
        this.elements.loading.classList.remove('hidden');
        this.elements.gamesList.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
        this.elements.noGames.classList.add('hidden');
    },
    
    /**
     * Hide loading indicator
     */
    hideLoading() {
        this.elements.loading.classList.add('hidden');
    },
    
    /**
     * Show error message
     */
    showError() {
        this.hideLoading();
        this.elements.errorMessage.classList.remove('hidden');
        this.elements.gamesList.classList.add('hidden');
        this.elements.noGames.classList.add('hidden');
    },
    
    /**
     * Show no games message
     */
    showNoGames() {
        this.hideLoading();
        this.elements.noGames.classList.remove('hidden');
        this.elements.gamesList.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
    }
};