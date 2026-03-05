/**
 * UI module for handling DOM interactions
 */
import GameTableRow from './components/GameTableRow.js';
import { API } from './api.js';
import { Parser } from './parser.js';
import { Ranker } from './ranker.js';

class UI {
    constructor() {
        this.scheduleTimeZone = 'America/New_York';

        this.elements = {
            gameDate: document.getElementById('game-date'),
            loadGamesBtn: document.getElementById('load-games'),
            gamesList: document.getElementById('games-list'),
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('error-message'),
            noGames: document.getElementById('no-games'),
            filtersContainer: document.getElementById('filters-modal'),
            toggleFiltersBtn: document.getElementById('toggle-filters'),
            closeFiltersBtn: document.getElementById('close-filters-modal'),
            filters: {
                closeGames: document.getElementById('close-games'),
                leadChanges: document.getElementById('lead-changes'),
                comebackWins: document.getElementById('comeback-wins'),
                lateGameDrama: document.getElementById('late-game-drama'),
                extraInnings: document.getElementById('extra-innings'),
                highScoring: document.getElementById('high-scoring'),
                teamRankings: document.getElementById('team-rankings'),
                hits: document.getElementById('total-hits'),
                errors: document.getElementById('defensive-plays'),
                scoringDistribution: document.getElementById('scoring-distribution'),
                rivalryGame: document.getElementById('rivalry-game'),
                playerMilestones: document.getElementById('player-milestones'),
                seasonalContext: document.getElementById('seasonal-context')
            }
        };
        
        this.games = [];
        this.isFutureGames = false;
        this.gameCards = new Map();
        this.rankingOptionsStorageKey = 'mlb-ranking-options';
    }

    /**
     * Initialize UI elements and event handlers
     */
    init() {
        // Set default date to yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.elements.gameDate.value = this.formatDate(yesterday);

        this.loadRankingOptionsFromStorage();
        
        // Event listeners
        if (this.elements.loadGamesBtn) {
            this.elements.loadGamesBtn.addEventListener('click', () => this.handleLoadGames());
        }
        this.elements.gameDate.addEventListener('change', () => this.handleLoadGames());
        
        // Filter change handlers
        Object.values(this.elements.filters).forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => {
                    this.saveRankingOptionsToStorage();
                    this.refreshGameRankings();
                });
            }
        });
        
        // Ranking criteria modal
        if (this.elements.filtersContainer && this.elements.filtersContainer.parentElement !== document.body) {
            document.body.appendChild(this.elements.filtersContainer);
        }

        if (this.elements.toggleFiltersBtn) {
            this.elements.toggleFiltersBtn.addEventListener('click', () => this.toggleFiltersPanel(true));
        }

        if (this.elements.closeFiltersBtn) {
            this.elements.closeFiltersBtn.addEventListener('click', () => this.toggleFiltersPanel(false));
        }

        if (this.elements.filtersContainer) {
            this.elements.filtersContainer.addEventListener('click', (event) => {
                if (event.target === this.elements.filtersContainer) {
                    this.toggleFiltersPanel(false);
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.elements.filtersContainer && !this.elements.filtersContainer.classList.contains('hidden')) {
                this.toggleFiltersPanel(false);
            }
        });

        void this.handleLoadGames();
    }

    /**
     * Format date as YYYY-MM-DD
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Parse YYYY-MM-DD as a local date at midnight.
     * Using Date(string) treats the value as UTC and can shift same-day comparisons.
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {Date|null} - Local date at midnight or null for invalid input
     */
    parseLocalDate(dateString) {
        if (!dateString || typeof dateString !== 'string') {
            return null;
        }

        const [yearStr, monthStr, dayStr] = dateString.split('-');
        const year = Number.parseInt(yearStr, 10);
        const month = Number.parseInt(monthStr, 10);
        const day = Number.parseInt(dayStr, 10);

        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
            return null;
        }

        return new Date(year, month - 1, day);
    }

    /**
     * Format a Date into YYYY-MM-DD for the configured schedule timezone.
     * @param {Date} value - Date value
     * @returns {string|null} - Date in YYYY-MM-DD format
     */
    formatDateInScheduleTimeZone(value) {
        if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
            return null;
        }

        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: this.scheduleTimeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const parts = formatter.formatToParts(value);
        const year = parts.find((part) => part.type === 'year')?.value;
        const month = parts.find((part) => part.type === 'month')?.value;
        const day = parts.find((part) => part.type === 'day')?.value;

        if (!year || !month || !day) {
            return null;
        }

        return `${year}-${month}-${day}`;
    }

    /**
     * Handle loading games
     */
    async handleLoadGames() {
        const date = this.elements.gameDate.value;
        console.log('Loading games for date:', date); // Debug log
        
        if (!date) {
            this.showError('Please select a date');
            return;
        }

        try {
            this.showLoading();
            
            const selectedDate = this.parseLocalDate(date);
            const mlbToday = this.formatDateInScheduleTimeZone(new Date());

            if (!selectedDate || Number.isNaN(selectedDate.getTime())) {
                this.showError('Invalid date format');
                return;
            }

            if (!mlbToday) {
                this.showError('Unable to resolve MLB schedule day');
                return;
            }
            
            console.log('Selected date:', date);
            console.log('MLB schedule today:', mlbToday);
            
            if (date >= mlbToday) {
                console.log('Loading scheduled or upcoming games');
                await this.loadFutureGames(date);
            } else {
                console.log('Loading completed games');
                await this.loadCompletedGames(date);
            }
        } catch (error) {
            console.error('Error loading games:', error);
            this.showError(error.message);
        }
    }

    /**
     * Load completed games for a date
     */
    async loadCompletedGames(date) {
        console.log('Fetching completed games and standings...');
        
        try {
            this.showLoading();
            
            // Step 1: Fetch the basic game and standings data
            const [gamesData, standingsData] = await Promise.all([
                API.fetchGames(date),
                API.fetchStandings(date)
            ]);

            console.log('Games data:', gamesData);
            console.log('Standings data:', standingsData);

            // Step 2: Process the basic data
            const teamRankings = API.processTeamRankings(standingsData);
            let games = Parser.processGames(gamesData, {
                targetPlayedDate: date
            });

            console.log('Processed games:', games);

            // Step 3: Add rankings to games
            games.forEach(game => {
                game.awayTeam.ranking = teamRankings[game.awayTeam.id] || { divisionRank: 0 };
                game.homeTeam.ranking = teamRankings[game.homeTeam.id] || { divisionRank: 0 };
            });

            // Step 4: Enhance games with detailed data for advanced metrics
            console.log('Enhancing games with detailed data...');
            games = await Parser.enhanceGamesWithDetailedData(games, date);
            console.log('Enhanced games:', games);

            this.games = games;
            this.isFutureGames = false;
            this.displayGames();
        } catch (error) {
            console.error('Error loading games:', error);
            this.showError(error.message || 'Failed to load games');
            this.hideLoading();
        }
    }

    /**
     * Load future games for a date
     */
    async loadFutureGames(date) {
        const [gamesData, standingsData] = await Promise.all([
            API.fetchGames(date),
            API.fetchStandings(date)
        ]);

        const teamRankings = API.processTeamRankings(standingsData);
        const games = Parser.processFutureGames(gamesData);

        games.forEach(game => {
            game.awayTeam.ranking = teamRankings[game.awayTeam.id] || { divisionRank: 0 };
            game.homeTeam.ranking = teamRankings[game.homeTeam.id] || { divisionRank: 0 };
        });

        this.games = games;
        this.isFutureGames = true;
        this.displayGames();
    }

    /**
     * Display games in the UI
     */
    async displayGames() {
        this.hideLoading();
        
        if (!this.games?.length) {
            this.showNoGames();
            return;
        }

        // Clear existing games
        this.elements.gamesList.innerHTML = '';
        this.gameCards.clear();

        let displayGames = this.games;
        if (!this.isFutureGames) {
            const options = this.getRankingOptions();
            displayGames = Ranker.rankGames(this.games, options);
        }

        const shouldUseFirstPitchHeader = this.isFutureGames
            && displayGames.length > 0
            && displayGames.every((game) => {
                const statusText = String(game?.status || '').toLowerCase();
                return statusText.includes('scheduled') || statusText.includes('preview');
            });

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'games-table-wrapper';

        const table = document.createElement('table');
        table.className = 'games-table';

        const statusHeaderText = shouldUseFirstPitchHeader ? 'First pitch @' : 'Status';

        table.innerHTML = `
            <thead>
                <tr>
                    <th class="th-rank">#</th>
                    <th>Matchup</th>
                    <th>Venue</th>
                    <th class="th-game-type">Type</th>
                    <th>Rating</th>
                    <th>${statusHeaderText}</th>
                    <th class="th-expand">Details</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');
        tbody.className = 'games-table-body';

        displayGames.forEach((game, index) => {
            const row = new GameTableRow(game, {
                rank: index + 1,
                index,
                isFuture: this.isFutureGames
            });
            const renderedRows = row.render();
            tbody.appendChild(renderedRows);
            this.gameCards.set(game.id, row);
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        this.elements.gamesList.appendChild(tableWrapper);
        this.elements.gamesList.classList.remove('hidden');
        this.elements.noGames.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
    }

    /**
     * Get current ranking options
     */
    getRankingOptions() {
        return Object.entries(this.elements.filters).reduce((options, [key, element]) => {
            options[key] = Boolean(element?.checked);
            return options;
        }, {});
    }

    /**
     * Load ranking options from local storage
     */
    loadRankingOptionsFromStorage() {
        try {
            const savedOptions = localStorage.getItem(this.rankingOptionsStorageKey);
            if (!savedOptions) {
                return;
            }

            const parsedOptions = JSON.parse(savedOptions);
            if (!parsedOptions || typeof parsedOptions !== 'object') {
                return;
            }

            Object.entries(this.elements.filters).forEach(([key, element]) => {
                if (!element) {
                    return;
                }

                if (typeof parsedOptions[key] === 'boolean') {
                    element.checked = parsedOptions[key];
                }
            });
        } catch (error) {
            console.warn('Unable to load ranking options from storage:', error);
        }
    }

    /**
     * Save ranking options to local storage
     */
    saveRankingOptionsToStorage() {
        try {
            localStorage.setItem(this.rankingOptionsStorageKey, JSON.stringify(this.getRankingOptions()));
        } catch (error) {
            console.warn('Unable to save ranking options to storage:', error);
        }
    }

    /**
     * Refresh game rankings
     */
    refreshGameRankings() {
        if (this.games?.length && !this.isFutureGames) {
            this.displayGames();
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.elements.loading.classList.remove('hidden');
        this.elements.gamesList.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
        this.elements.noGames.classList.add('hidden');
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        this.elements.loading.classList.add('hidden');
    }

    /**
     * Show error message
     */
    showError(message) {
        this.hideLoading();
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        this.elements.gamesList.classList.add('hidden');
        this.elements.noGames.classList.add('hidden');
    }

    /**
     * Show no games message
     */
    showNoGames() {
        this.hideLoading();
        this.elements.noGames.classList.remove('hidden');
        this.elements.gamesList.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
    }

    /**
     * Toggle filters panel visibility
     */
    toggleFiltersPanel(forceOpen = null) {
        if (!this.elements.filtersContainer) {
            return;
        }

        const shouldOpen = typeof forceOpen === 'boolean'
            ? forceOpen
            : this.elements.filtersContainer.classList.contains('hidden');

        this.elements.filtersContainer.classList.toggle('hidden', !shouldOpen);
        document.body.classList.toggle('modal-open', shouldOpen);

        if (this.elements.toggleFiltersBtn) {
            this.elements.toggleFiltersBtn.setAttribute('aria-expanded', String(shouldOpen));
        }
    }
}

export default new UI();