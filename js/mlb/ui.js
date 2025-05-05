/**
 * UI module for handling DOM interactions
 */
import GameCard from './components/GameCard.js';
import { API } from './api.js';
import { Parser } from './parser.js';
import { Ranker } from './ranker.js';

class UI {
    constructor() {
        this.elements = {
            gameDate: document.getElementById('game-date'),
            loadGamesBtn: document.getElementById('load-games'),
            gamesList: document.getElementById('games-list'),
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('error-message'),
            noGames: document.getElementById('no-games'),
            filtersContainer: document.querySelector('.filters'),
            toggleFiltersBtn: document.getElementById('toggle-filters'),
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
    }

    /**
     * Initialize UI elements and event handlers
     */
    init() {
        // Set default date to yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.elements.gameDate.value = this.formatDate(yesterday);
        
        // Event listeners
        this.elements.loadGamesBtn.addEventListener('click', () => this.handleLoadGames());
        
        // Filter change handlers
        Object.values(this.elements.filters).forEach(filter => {
            filter.addEventListener('change', () => this.refreshGameRankings());
        });
        
        // Toggle filters panel
        this.elements.toggleFiltersBtn.addEventListener('click', () => this.toggleFiltersPanel());
        this.elements.filtersContainer.querySelector('.filters-header').addEventListener('click', (e) => {
            // Don't trigger if the click was on the button (already handled)
            if (!e.target.closest('.toggle-filters-btn')) {
                this.toggleFiltersPanel();
            }
        });
        
        // Set initial collapsed state (default to collapsed)
        const shouldBeCollapsed = localStorage.getItem('filtersCollapsed') !== 'false';
        if (shouldBeCollapsed) {
            this.elements.filtersContainer.classList.add('collapsed');
            this.elements.toggleFiltersBtn.setAttribute('aria-expanded', 'false');
        } else {
            this.elements.filtersContainer.classList.remove('collapsed');
            this.elements.toggleFiltersBtn.setAttribute('aria-expanded', 'true');
        }
    }

    /**
     * Format date as YYYY-MM-DD
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
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
            
            const selectedDate = new Date(date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            console.log('Selected date:', selectedDate);
            console.log('Today:', today);
            
            if (selectedDate > today) {
                console.log('Loading future games');
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
            let games = Parser.processGames(gamesData);

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

        // Create game cards
        const fragment = document.createDocumentFragment();
        displayGames.forEach(game => {
            const card = new GameCard(game);
            const element = card.render();
            fragment.appendChild(element);
            this.gameCards.set(game.id, card);
        });

        this.elements.gamesList.appendChild(fragment);
        this.elements.gamesList.classList.remove('hidden');
        this.elements.noGames.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
    }

    /**
     * Get current ranking options
     */
    getRankingOptions() {
        return Object.entries(this.elements.filters).reduce((options, [key, element]) => {
            options[key] = element.checked;
            return options;
        }, {});
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
    toggleFiltersPanel() {
        this.elements.filtersContainer.classList.toggle('collapsed');
        
        // Update the toggle icon
        const isCollapsed = this.elements.filtersContainer.classList.contains('collapsed');
        const toggleIcon = this.elements.toggleFiltersBtn.querySelector('.toggle-icon');
        
        // We now only use a single character (down arrow) and rotate it with CSS
        toggleIcon.innerHTML = '&#9660;';
        this.elements.toggleFiltersBtn.setAttribute('aria-expanded', !isCollapsed);
        
        // Save preference to localStorage
        localStorage.setItem('filtersCollapsed', isCollapsed);
    }
}

export default new UI();