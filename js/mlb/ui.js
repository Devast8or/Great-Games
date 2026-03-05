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
            periodFilterModal: document.getElementById('period-filter-modal'),
            openPeriodFilterBtn: document.getElementById('open-period-filter'),
            closePeriodFilterBtn: document.getElementById('close-period-filter-modal'),
            applyPeriodFilterBtn: document.getElementById('apply-period-filter'),
            periodFilterDaysInput: document.getElementById('filter-lookback-days'),
            periodFilterDaysIncreaseBtn: document.getElementById('filter-days-increase'),
            periodFilterDaysDecreaseBtn: document.getElementById('filter-days-decrease'),
            periodFilterTeamPicker: document.getElementById('period-filter-team-picker'),
            periodFilterTeamToggleBtn: document.getElementById('filter-team-toggle'),
            periodFilterTeamOptions: document.getElementById('filter-team-options'),
            periodFilterTeamSelect: document.getElementById('filter-team'),
            periodFilterMinStarsSelect: document.getElementById('filter-min-stars'),
            activePeriodFilterBadge: document.getElementById('active-period-filter'),
            activePeriodFilterText: document.getElementById('active-period-filter-text'),
            clearPeriodFilterBtn: document.getElementById('clear-period-filter'),
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
        this.defaultNoGamesMessage = this.elements.noGames?.textContent || 'No games found for this date.';
        this.defaultLookbackDays = 7;
        this.maxLookbackDays = 120;
        this.defaultMinimumStars = 1;
        this.maximumStars = 5;
        this.activePeriodFilter = null;
        this.knownTeams = new Map();
        this.mlbTeamIds = new Set();
    }

    /**
     * Initialize UI elements and event handlers
     */
    init() {
        // Set default date to yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.elements.gameDate.value = this.formatDate(yesterday);

        if (this.elements.periodFilterDaysInput) {
            this.elements.periodFilterDaysInput.value = String(this.defaultLookbackDays);
            this.elements.periodFilterDaysInput.addEventListener('change', () => {
                const normalizedDays = this.getRequestedLookbackDays();
                if (!normalizedDays) {
                    this.elements.periodFilterDaysInput.value = String(this.defaultLookbackDays);
                }
            });
        }

        if (this.elements.periodFilterDaysIncreaseBtn) {
            this.elements.periodFilterDaysIncreaseBtn.addEventListener('click', () => {
                this.adjustLookbackDays(1);
            });
        }

        if (this.elements.periodFilterDaysDecreaseBtn) {
            this.elements.periodFilterDaysDecreaseBtn.addEventListener('click', () => {
                this.adjustLookbackDays(-1);
            });
        }

        if (this.elements.periodFilterMinStarsSelect) {
            this.elements.periodFilterMinStarsSelect.value = String(this.defaultMinimumStars);
        }

        this.loadRankingOptionsFromStorage();
        this.updatePeriodFilterBadge();
        
        // Event listeners
        if (this.elements.loadGamesBtn) {
            this.elements.loadGamesBtn.addEventListener('click', () => {
                void this.handleLoadGames();
            });
        }

        if (this.elements.gameDate) {
            this.elements.gameDate.addEventListener('change', () => {
                void this.handleLoadGames();
            });
        }
        
        // Filter change handlers
        Object.values(this.elements.filters).forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => {
                    this.saveRankingOptionsToStorage();
                    this.refreshGameRankings();
                });
            }
        });
        
        this.ensureModalHost(this.elements.filtersContainer);
        this.ensureModalHost(this.elements.periodFilterModal);

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

        if (this.elements.openPeriodFilterBtn) {
            this.elements.openPeriodFilterBtn.addEventListener('click', () => this.togglePeriodFilterModal(true));
        }

        if (this.elements.closePeriodFilterBtn) {
            this.elements.closePeriodFilterBtn.addEventListener('click', () => this.togglePeriodFilterModal(false));
        }

        if (this.elements.periodFilterModal) {
            this.elements.periodFilterModal.addEventListener('click', (event) => {
                if (event.target === this.elements.periodFilterModal) {
                    this.togglePeriodFilterModal(false);
                }
            });
        }

        if (this.elements.applyPeriodFilterBtn) {
            this.elements.applyPeriodFilterBtn.addEventListener('click', () => {
                void this.handleApplyPeriodFilter();
            });
        }

        if (this.elements.clearPeriodFilterBtn) {
            this.elements.clearPeriodFilterBtn.addEventListener('click', () => {
                this.clearPeriodFilter();
            });
        }

        if (this.elements.periodFilterTeamToggleBtn) {
            this.elements.periodFilterTeamToggleBtn.addEventListener('click', () => {
                this.toggleTeamPickerList();
            });
        }

        document.addEventListener('click', (event) => {
            if (!this.isTeamPickerOpen()) {
                return;
            }

            if (this.elements.periodFilterTeamPicker
                && event.target instanceof Node
                && !this.elements.periodFilterTeamPicker.contains(event.target)) {
                this.toggleTeamPickerList(false);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }

            if (this.isTeamPickerOpen()) {
                this.toggleTeamPickerList(false);
                return;
            }

            if (this.isModalOpen(this.elements.periodFilterModal)) {
                this.togglePeriodFilterModal(false);
                return;
            }

            if (this.isModalOpen(this.elements.filtersContainer)) {
                this.toggleFiltersPanel(false);
            }
        });

        void this.initializePeriodFilterOptions();
        void this.handleLoadGames();
    }

    /**
     * Ensure modal is attached to body to avoid clipping issues.
     * @param {HTMLElement|null} modalElement - Modal root element
     */
    ensureModalHost(modalElement) {
        if (modalElement && modalElement.parentElement !== document.body) {
            document.body.appendChild(modalElement);
        }
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
     * Initialize team options for the period filter.
     */
    async initializePeriodFilterOptions() {
        this.rebuildPeriodFilterTeamOptions();

        try {
            const seasonYear = this.getSeasonYear(this.elements.gameDate?.value);
            const teamsResponse = await API.fetchTeams(seasonYear);
            const teams = Array.isArray(teamsResponse?.teams)
                ? teamsResponse.teams
                    .map((team) => ({
                        id: Number(team?.id),
                        name: String(team?.name || '').trim()
                    }))
                    .filter((team) => Number.isFinite(team.id) && team.name)
                : [];

            this.populateKnownTeams(teams, { markAsMlb: true });
        } catch (error) {
            console.warn('Unable to preload MLB teams for period filter:', error);
        }
    }

    /**
     * Resolve season year from selected date, falling back to current year.
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {number} - Season year
     */
    getSeasonYear(dateString) {
        const parsedDate = this.parseLocalDate(dateString);
        return parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.getFullYear()
            : new Date().getFullYear();
    }

    /**
     * Track MLB team ids resolved from standings/rankings payloads.
     * @param {Object} teamRankings - Rankings keyed by team id
     */
    registerMlbTeamIds(teamRankings) {
        if (!teamRankings || typeof teamRankings !== 'object') {
            return;
        }

        let addedMlbTeam = false;

        Object.keys(teamRankings).forEach((teamIdKey) => {
            const teamId = Number.parseInt(teamIdKey, 10);
            if (Number.isFinite(teamId) && !this.mlbTeamIds.has(teamId)) {
                this.mlbTeamIds.add(teamId);
                addedMlbTeam = true;
            }
        });

        if (addedMlbTeam) {
            this.rebuildPeriodFilterTeamOptions();
        }
    }

    /**
     * Merge teams into known-team map and refresh selector options.
     * @param {Array<{id:number,name:string}>} teams - Teams to merge
     * @param {{markAsMlb?: boolean}} options - Additional merge options
     */
    populateKnownTeams(teams, options = {}) {
        const markAsMlb = Boolean(options?.markAsMlb);

        let hasChanges = false;

        if (Array.isArray(teams)) {
            teams.forEach((team) => {
                if (Number.isFinite(team?.id) && team?.name) {
                    if (this.knownTeams.get(team.id) !== team.name) {
                        hasChanges = true;
                    }

                    this.knownTeams.set(team.id, team.name);

                    if (markAsMlb && !this.mlbTeamIds.has(team.id)) {
                        this.mlbTeamIds.add(team.id);
                        hasChanges = true;
                    }
                }
            });
        }

        if (hasChanges) {
            this.rebuildPeriodFilterTeamOptions();
        }
    }

    /**
     * Register teams found in current game payloads.
     * @param {Array} games - Processed game list
     */
    registerTeamsFromGames(games) {
        if (!Array.isArray(games) || games.length === 0) {
            return;
        }

        let addedTeam = false;

        games.forEach((game) => {
            [game?.awayTeam, game?.homeTeam].forEach((team) => {
                const teamId = Number(team?.id);
                const teamName = String(team?.name || '').trim();

                if (!Number.isFinite(teamId) || !teamName) {
                    return;
                }

                if (this.knownTeams.get(teamId) !== teamName) {
                    this.knownTeams.set(teamId, teamName);
                    addedTeam = true;
                }
            });
        });

        if (addedTeam) {
            this.rebuildPeriodFilterTeamOptions();
        }
    }

    /**
     * Refresh selectable team options in the period filter modal.
     */
    rebuildPeriodFilterTeamOptions() {
        if (!this.elements.periodFilterTeamSelect) {
            return;
        }

        const selector = this.elements.periodFilterTeamSelect;
        const previousSelections = this.getSelectedTeamSelectionsFromControl();
        const knownTeamEntries = Array.from(this.knownTeams.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const hasMlbCatalog = this.mlbTeamIds.size > 0;
        const mlbTeamEntries = hasMlbCatalog
            ? knownTeamEntries.filter((team) => this.mlbTeamIds.has(team.id))
            : knownTeamEntries;

        selector.innerHTML = '';
        selector.appendChild(new Option('All Teams', 'all'));

        mlbTeamEntries.forEach((team) => {
            selector.appendChild(new Option(team.name, String(team.id)));
        });

        selector.appendChild(new Option('Other', 'other'));

        this.setSelectedTeamSelectionsInControl(previousSelections);
    }

    /**
     * Determine whether the expandable team picker list is open.
     * @returns {boolean} - True when the team picker list is visible
     */
    isTeamPickerOpen() {
        return Boolean(
            this.elements.periodFilterTeamOptions
            && !this.elements.periodFilterTeamOptions.classList.contains('hidden')
        );
    }

    /**
     * Toggle expandable team picker list visibility.
     * @param {boolean|null} forceOpen - Optional open state override
     */
    toggleTeamPickerList(forceOpen = null) {
        if (!this.elements.periodFilterTeamOptions || !this.elements.periodFilterTeamToggleBtn) {
            return;
        }

        const shouldOpen = typeof forceOpen === 'boolean'
            ? forceOpen
            : this.elements.periodFilterTeamOptions.classList.contains('hidden');

        this.elements.periodFilterTeamOptions.classList.toggle('hidden', !shouldOpen);
        this.elements.periodFilterTeamToggleBtn.setAttribute('aria-expanded', String(shouldOpen));

        if (shouldOpen) {
            this.renderTeamPickerOptions();
        }
    }

    /**
     * Render selectable checkbox rows inside the expandable team picker list.
     */
    renderTeamPickerOptions() {
        if (!this.elements.periodFilterTeamOptions || !this.elements.periodFilterTeamSelect) {
            return;
        }

        const optionContainer = this.elements.periodFilterTeamOptions;
        const selectedSet = new Set(this.getSelectedTeamSelectionsFromControl());

        optionContainer.innerHTML = '';

        Array.from(this.elements.periodFilterTeamSelect.options).forEach((option) => {
            const optionRow = document.createElement('label');
            optionRow.className = 'period-filter-team-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'period-filter-team-check';
            checkbox.value = option.value;
            checkbox.checked = selectedSet.has(option.value);

            checkbox.addEventListener('change', () => {
                this.handleTeamPickerOptionChange(option.value, checkbox.checked);
            });

            const optionText = document.createElement('span');
            optionText.className = 'period-filter-team-option-text';
            optionText.textContent = option.textContent || option.value;

            optionRow.appendChild(checkbox);
            optionRow.appendChild(optionText);
            optionContainer.appendChild(optionRow);
        });
    }

    /**
     * Handle checkbox updates from the expandable team picker list.
     * @param {string} optionValue - Option value that changed
     * @param {boolean} isChecked - New checked state
     */
    handleTeamPickerOptionChange(optionValue, isChecked) {
        if (optionValue === 'all') {
            this.setSelectedTeamSelectionsInControl(['all']);
            return;
        }

        const currentSelections = this.getSelectedTeamSelectionsFromControl();
        const selectionSet = new Set(currentSelections.filter((selection) => selection !== 'all'));

        if (isChecked) {
            selectionSet.add(optionValue);
        } else {
            selectionSet.delete(optionValue);
        }

        const nextSelections = selectionSet.size > 0
            ? Array.from(selectionSet)
            : ['all'];

        this.setSelectedTeamSelectionsInControl(nextSelections);
    }

    /**
     * Update collapsed team picker button text with current selection summary.
     */
    updateTeamPickerToggleLabel() {
        if (!this.elements.periodFilterTeamToggleBtn) {
            return;
        }

        const selectedTeamsLabel = this.getTeamSelectionLabel(this.getSelectedTeamSelectionsFromControl());
        this.elements.periodFilterTeamToggleBtn.textContent = selectedTeamsLabel;
    }

    /**
     * Normalize team selections from UI/config into a deterministic list.
     * @param {unknown} values - Raw selection values
     * @returns {string[]} - Normalized team selection values
     */
    normalizeTeamSelections(values) {
        const rawValues = Array.isArray(values)
            ? values
            : values == null || values === ''
                ? ['all']
                : [values];

        const normalizedSelections = Array.from(new Set(
            rawValues
                .map((value) => String(value).trim())
                .filter(Boolean)
        ));

        if (!normalizedSelections.length) {
            return ['all'];
        }

        if (normalizedSelections.includes('all')) {
            return ['all'];
        }

        return normalizedSelections;
    }

    /**
     * Read selected team values from team selector control.
     * @returns {string[]} - Selected team values
     */
    getSelectedTeamSelectionsFromControl() {
        if (!this.elements.periodFilterTeamSelect) {
            return ['all'];
        }

        const selectedValues = Array.from(this.elements.periodFilterTeamSelect.selectedOptions)
            .map((option) => option.value);

        return this.normalizeTeamSelections(selectedValues);
    }

    /**
     * Apply selected values to the team selector control.
     * @param {unknown} values - Values to set as selected
     */
    setSelectedTeamSelectionsInControl(values) {
        if (!this.elements.periodFilterTeamSelect) {
            return;
        }

        const selector = this.elements.periodFilterTeamSelect;
        const normalizedSelections = this.normalizeTeamSelections(values);
        const availableValues = new Set(Array.from(selector.options).map((option) => option.value));

        let validSelections = normalizedSelections.filter((selection) => availableValues.has(selection));
        if (!validSelections.length && availableValues.has('all')) {
            validSelections = ['all'];
        }

        const selectedValueSet = new Set(validSelections);
        Array.from(selector.options).forEach((option) => {
            option.selected = selectedValueSet.has(option.value);
        });

        this.updateTeamPickerToggleLabel();
        this.renderTeamPickerOptions();
    }

    /**
     * Resolve label text for selected team values.
     * @param {unknown} teamSelections - Team selection values
     * @returns {string} - Human-readable selection text
     */
    getTeamSelectionLabel(teamSelections) {
        const normalizedSelections = this.normalizeTeamSelections(teamSelections);

        if (normalizedSelections.includes('all')) {
            return 'All Teams';
        }

        const selectionLabels = normalizedSelections
            .map((selection) => this.getTeamSelectionOptionLabel(selection))
            .filter(Boolean);

        if (!selectionLabels.length) {
            return 'All Teams';
        }

        if (selectionLabels.length <= 2) {
            return selectionLabels.join(', ');
        }

        return `${selectionLabels.slice(0, 2).join(', ')} +${selectionLabels.length - 2}`;
    }

    /**
     * Resolve display label for a single team selection value.
     * @param {string} selection - Team selection value
     * @returns {string|null} - Display label for selection
     */
    getTeamSelectionOptionLabel(selection) {
        if (selection === 'all') {
            return 'All Teams';
        }

        if (selection === 'other') {
            return 'Other';
        }

        const optionMatch = Array.from(this.elements.periodFilterTeamSelect?.options || [])
            .find((option) => option.value === selection);
        if (optionMatch?.textContent) {
            return optionMatch.textContent.trim();
        }

        const parsedTeamId = Number.parseInt(selection, 10);
        if (Number.isFinite(parsedTeamId) && this.knownTeams.has(parsedTeamId)) {
            return this.knownTeams.get(parsedTeamId);
        }

        return null;
    }

    /**
     * Determine whether a game includes at least one non-MLB team.
     * @param {Object} game - Game object
     * @returns {boolean} - True when game includes non-MLB team(s)
     */
    isOtherTeamGame(game) {
        if (this.mlbTeamIds.size === 0) {
            return false;
        }

        const awayTeamId = Number(game?.awayTeam?.id);
        const homeTeamId = Number(game?.homeTeam?.id);

        const isAwayNonMlb = Number.isFinite(awayTeamId) && !this.mlbTeamIds.has(awayTeamId);
        const isHomeNonMlb = Number.isFinite(homeTeamId) && !this.mlbTeamIds.has(homeTeamId);

        return isAwayNonMlb || isHomeNonMlb;
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

        if (this.activePeriodFilter) {
            await this.loadFilteredGames(date, this.activePeriodFilter);
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
            
            if (date > mlbToday) {
                console.log('Loading scheduled or upcoming games');
                await this.loadFutureGames(date);
            } else if (date === mlbToday) {
                console.log('Loading today schedule (completed, live, and upcoming games)');
                await this.loadCurrentDayGames(date);
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
     * Parse completed games and enrich them with standings/ranking metadata.
     * @param {Object} gamesData - Schedule payload
     * @param {string} standingsDate - Date used for standings lookups
     * @param {Object} parserOptions - Parser options
     * @returns {Promise<Array>} - Enhanced games list
     */
    async createCompletedGamesFromData(gamesData, standingsDate, parserOptions = {}) {
        const standingsData = await API.fetchStandings(standingsDate);
        const teamRankings = API.processTeamRankings(standingsData);
        this.registerMlbTeamIds(teamRankings);
        let games = Parser.processGames(gamesData, parserOptions);

        this.applyTeamRankings(games, teamRankings);

        games = await Parser.enhanceGamesWithDetailedData(games, standingsDate);
        return games;
    }

    /**
     * Apply standings ranking metadata to parsed games.
     * @param {Array} games - Parsed games
     * @param {Object} teamRankings - Team rankings keyed by team id
     */
    applyTeamRankings(games, teamRankings) {
        if (!Array.isArray(games)) {
            return;
        }

        games.forEach((game) => {
            game.awayTeam.ranking = teamRankings[game.awayTeam.id] || { divisionRank: 0 };
            game.homeTeam.ranking = teamRankings[game.homeTeam.id] || { divisionRank: 0 };
        });
    }

    /**
     * Merge completed/future game lists in schedule order for the selected day.
     * @param {Object} gamesData - Raw schedule payload
     * @param {Array} completedGames - Parsed completed games
     * @param {Array} futureGames - Parsed future/live games
     * @returns {Array} - Combined games in schedule order
     */
    mergeGamesByScheduleOrder(gamesData, completedGames = [], futureGames = []) {
        const gamesById = new Map();

        completedGames.forEach((game) => {
            const gameId = Number(game?.id);
            if (Number.isFinite(gameId)) {
                gamesById.set(gameId, game);
            }
        });

        futureGames.forEach((game) => {
            const gameId = Number(game?.id);
            if (Number.isFinite(gameId) && !gamesById.has(gameId)) {
                gamesById.set(gameId, game);
            }
        });

        const orderedGames = [];
        const seenIds = new Set();

        (gamesData?.dates || []).forEach((dateEntry) => {
            (dateEntry?.games || []).forEach((rawGame) => {
                const gameId = Number(rawGame?.gamePk);
                if (!Number.isFinite(gameId) || seenIds.has(gameId)) {
                    return;
                }

                const game = gamesById.get(gameId);
                if (!game) {
                    return;
                }

                orderedGames.push(game);
                seenIds.add(gameId);
            });
        });

        gamesById.forEach((game, gameId) => {
            if (!seenIds.has(gameId)) {
                orderedGames.push(game);
            }
        });

        return orderedGames;
    }

    /**
     * Load completed games for a date
     */
    async loadCompletedGames(date) {
        console.log('Fetching completed games and standings...');
        
        try {
            this.showLoading();

            const gamesData = await API.fetchGames(date);
            console.log('Games data:', gamesData);

            let games = await this.createCompletedGamesFromData(gamesData, date, {
                targetPlayedDate: date
            });
            console.log('Processed games:', games);
            console.log('Enhanced games:', games);

            this.registerTeamsFromGames(games);
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
     * Load mixed same-day schedule:
     * includes completed games plus live/upcoming games in schedule order.
     * @param {string} date - Date in YYYY-MM-DD format
     */
    async loadCurrentDayGames(date) {
        try {
            this.showLoading();

            const [gamesData, standingsData] = await Promise.all([
                API.fetchGames(date),
                API.fetchStandings(date)
            ]);

            const teamRankings = API.processTeamRankings(standingsData);
            this.registerMlbTeamIds(teamRankings);

            let completedGames = Parser.processGames(gamesData, {
                targetPlayedDate: date
            });
            this.applyTeamRankings(completedGames, teamRankings);
            completedGames = await Parser.enhanceGamesWithDetailedData(completedGames, date);

            const futureGames = Parser.processFutureGames(gamesData);
            this.applyTeamRankings(futureGames, teamRankings);

            const games = this.mergeGamesByScheduleOrder(gamesData, completedGames, futureGames);

            this.registerTeamsFromGames(games);
            this.games = games;
            this.isFutureGames = true;
            this.displayGames();
        } catch (error) {
            console.error('Error loading current-day games:', error);
            this.showError(error.message || 'Failed to load current-day games');
            this.hideLoading();
        }
    }

    /**
     * Load future games for a date
     */
    async loadFutureGames(date) {
        try {
            this.showLoading();

            const [gamesData, standingsData] = await Promise.all([
                API.fetchGames(date),
                API.fetchStandings(date)
            ]);

            const teamRankings = API.processTeamRankings(standingsData);
            this.registerMlbTeamIds(teamRankings);
            const games = Parser.processFutureGames(gamesData);

            this.applyTeamRankings(games, teamRankings);

            this.registerTeamsFromGames(games);
            this.games = games;
            this.isFutureGames = true;
            this.displayGames();
        } catch (error) {
            console.error('Error loading future games:', error);
            this.showError(error.message || 'Failed to load future games');
            this.hideLoading();
        }
    }

    /**
     * Convert anchor date and day count into range boundaries.
     * @param {string} anchorDate - End date in YYYY-MM-DD format
     * @param {number} lookbackDays - Number of days to include
     * @returns {{startDate: string, endDate: string}|null} - Range boundaries
     */
    resolveDateRange(anchorDate, lookbackDays) {
        const parsedAnchorDate = this.parseLocalDate(anchorDate);
        if (!parsedAnchorDate || Number.isNaN(parsedAnchorDate.getTime())) {
            return null;
        }

        const safeDays = Math.max(1, Number.parseInt(lookbackDays, 10) || 1);
        const rangeStart = new Date(parsedAnchorDate);
        rangeStart.setDate(parsedAnchorDate.getDate() - (safeDays - 1));

        return {
            startDate: this.formatDate(rangeStart),
            endDate: this.formatDate(parsedAnchorDate)
        };
    }

    /**
     * Increment or decrement period filter lookback days.
     * @param {number} delta - Amount to change (positive or negative)
     */
    adjustLookbackDays(delta) {
        const currentDays = this.getRequestedLookbackDays() || this.defaultLookbackDays;
        const nextDays = Math.max(1, Math.min(currentDays + delta, this.maxLookbackDays));

        if (this.elements.periodFilterDaysInput) {
            this.elements.periodFilterDaysInput.value = String(nextDays);
        }
    }

    /**
     * Parse and clamp lookback days from period filter input.
     * @returns {number|null} - Valid day count or null when invalid
     */
    getRequestedLookbackDays() {
        const rawValue = this.elements.periodFilterDaysInput?.value || '';
        const parsedDays = Number.parseInt(rawValue, 10);

        if (!Number.isFinite(parsedDays)) {
            return null;
        }

        const normalizedDays = Math.max(1, Math.min(parsedDays, this.maxLookbackDays));

        if (this.elements.periodFilterDaysInput) {
            this.elements.periodFilterDaysInput.value = String(normalizedDays);
        }

        return normalizedDays;
    }

    /**
     * Normalize minimum stars value to allowed range.
     * @param {unknown} value - Raw stars value
     * @returns {number} - Valid minimum stars
     */
    normalizeMinimumStars(value) {
        const parsedStars = Number.parseInt(String(value ?? ''), 10);
        if (!Number.isFinite(parsedStars)) {
            return this.defaultMinimumStars;
        }

        return Math.max(this.defaultMinimumStars, Math.min(parsedStars, this.maximumStars));
    }

    /**
     * Get currently requested minimum stars from filter control.
     * @returns {number} - Minimum stars threshold
     */
    getRequestedMinimumStars() {
        const minimumStars = this.normalizeMinimumStars(this.elements.periodFilterMinStarsSelect?.value);

        if (this.elements.periodFilterMinStarsSelect) {
            this.elements.periodFilterMinStarsSelect.value = String(minimumStars);
        }

        return minimumStars;
    }

    /**
     * Convert excitement score to displayed star rating value.
     * @param {number} excitementScore - Game excitement score
     * @returns {number} - Star value from 1 to 5
     */
    getStarValueFromExcitementScore(excitementScore) {
        const safeScore = Number.isFinite(excitementScore) ? excitementScore : 0;
        return Math.max(1, Math.min(5, Math.floor(safeScore / 20) + 1));
    }

    /**
     * Format minimum-stars threshold using star icons.
     * @param {number|string|null} value - Minimum stars value
     * @returns {string} - Star-based threshold label
     */
    getMinimumStarsLabel(value) {
        const safeMinimumStars = this.normalizeMinimumStars(value);
        const stars = '★'.repeat(safeMinimumStars);
        return safeMinimumStars >= this.maximumStars
            ? stars
            : `${stars}+`;
    }

    /**
     * Apply user-selected period filter from modal input values.
     */
    async handleApplyPeriodFilter() {
        const selectedDate = this.elements.gameDate?.value;
        if (!selectedDate) {
            this.showError('Please select a date before applying a filter');
            return;
        }

        const lookbackDays = this.getRequestedLookbackDays();
        if (!lookbackDays) {
            this.showError(`Enter a valid lookback value between 1 and ${this.maxLookbackDays}`);
            return;
        }

        const teamSelections = this.getSelectedTeamSelectionsFromControl();
        const minimumStars = this.getRequestedMinimumStars();
        const teamName = this.getTeamSelectionLabel(teamSelections);

        const didApply = await this.loadFilteredGames(selectedDate, {
            days: lookbackDays,
            teamSelections,
            minimumStars,
            teamName
        });

        if (didApply) {
            this.togglePeriodFilterModal(false);
        }
    }

    /**
     * Load and rank completed games for an active period filter.
     * @param {string} anchorDate - End date in YYYY-MM-DD format
     * @param {{days:number,teamSelections:string[]|string|number|null,minimumStars:number|string|null,teamName:string}} filterConfig - Filter values
     * @returns {Promise<boolean>} - True when filter successfully applied
     */
    async loadFilteredGames(anchorDate, filterConfig) {
        const safeDays = Math.max(1, Number.parseInt(filterConfig?.days, 10) || this.defaultLookbackDays);
        const range = this.resolveDateRange(anchorDate, safeDays);

        if (!range) {
            this.showError('Invalid date format');
            return false;
        }

        const teamSelections = this.normalizeTeamSelections(
            filterConfig?.teamSelections
            ?? filterConfig?.teamSelection
            ?? filterConfig?.teamId
        );
        const minimumStars = this.normalizeMinimumStars(filterConfig?.minimumStars ?? filterConfig?.minStars);
        const teamName = filterConfig?.teamName
            || this.getTeamSelectionLabel(teamSelections);

        try {
            this.showLoading();

            const gamesData = await API.fetchGamesInRange(range.startDate, range.endDate);
            let games = await this.createCompletedGamesFromData(gamesData, anchorDate);

            const hasAllSelection = teamSelections.includes('all');
            const includeOtherSelection = teamSelections.includes('other');
            const selectedTeamIds = teamSelections
                .filter((selection) => selection !== 'all' && selection !== 'other')
                .map((selection) => Number.parseInt(selection, 10))
                .filter((teamId) => Number.isFinite(teamId));

            if (!hasAllSelection && (includeOtherSelection || selectedTeamIds.length > 0)) {
                games = games.filter((game) => (
                    (includeOtherSelection && this.isOtherTeamGame(game))
                    || selectedTeamIds.some((teamId) => (
                        Number(game?.awayTeam?.id) === teamId
                        || Number(game?.homeTeam?.id) === teamId
                    ))
                ));
            }

            this.registerTeamsFromGames(games);
            this.activePeriodFilter = {
                days: safeDays,
                teamSelections,
                minimumStars,
                teamName,
                startDate: range.startDate,
                endDate: range.endDate
            };
            this.updatePeriodFilterBadge();

            this.games = games;
            this.isFutureGames = false;
            this.displayGames();

            return true;
        } catch (error) {
            console.error('Error loading filtered games:', error);
            this.showError(error.message || 'Failed to apply game filter');
            this.hideLoading();
            return false;
        }
    }

    /**
     * Remove active period filter and restore default selected-date behavior.
     */
    clearPeriodFilter() {
        if (!this.activePeriodFilter) {
            return;
        }

        this.activePeriodFilter = null;
        this.updatePeriodFilterBadge();

        if (this.elements.periodFilterDaysInput) {
            this.elements.periodFilterDaysInput.value = String(this.defaultLookbackDays);
        }

        if (this.elements.periodFilterTeamSelect) {
            this.setSelectedTeamSelectionsInControl(['all']);
        }

        if (this.elements.periodFilterMinStarsSelect) {
            this.elements.periodFilterMinStarsSelect.value = String(this.defaultMinimumStars);
        }

        void this.handleLoadGames();
    }

    /**
     * Update active period filter badge text and visibility.
     */
    updatePeriodFilterBadge() {
        if (!this.elements.activePeriodFilterBadge || !this.elements.activePeriodFilterText) {
            return;
        }

        if (!this.activePeriodFilter) {
            this.elements.activePeriodFilterBadge.classList.add('hidden');
            this.elements.activePeriodFilterText.textContent = '';
            return;
        }

        const { days, teamName, startDate, endDate } = this.activePeriodFilter;
        const minimumStars = this.normalizeMinimumStars(
            this.activePeriodFilter.minimumStars ?? this.activePeriodFilter.minStars
        );
        const labelParts = [
            `${days} day${days === 1 ? '' : 's'}`,
            teamName || 'All Teams',
            `Min ${this.getMinimumStarsLabel(minimumStars)}`,
            `${startDate} to ${endDate}`
        ];

        this.elements.activePeriodFilterText.textContent = `Filtered: ${labelParts.join(' | ')}`;
        this.elements.activePeriodFilterBadge.classList.remove('hidden');
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
        let rankByGameId = null;

        if (!this.isFutureGames) {
            const options = this.getRankingOptions();
            displayGames = Ranker.rankGames(this.games, options);

            if (this.activePeriodFilter) {
                const minimumStars = this.normalizeMinimumStars(
                    this.activePeriodFilter.minimumStars ?? this.activePeriodFilter.minStars
                );

                displayGames = displayGames.filter((game) => (
                    this.getStarValueFromExcitementScore(game?.excitementScore) >= minimumStars
                ));
            }
        } else if (this.isMixedScheduleView(displayGames)) {
            const options = this.getRankingOptions();
            const completedGames = displayGames.filter((game) => !game?.isFuture);
            const rankedCompletedGames = Ranker.rankGames(completedGames, options);
            const rankedCompletedById = new Map();
            rankByGameId = new Map();

            rankedCompletedGames.forEach((game, index) => {
                const gameId = Number(game?.id);
                if (!Number.isFinite(gameId)) {
                    return;
                }

                rankedCompletedById.set(gameId, game);
                rankByGameId.set(gameId, index + 1);
            });

            // Keep schedule order, but replace completed entries with ranked-scored copies.
            displayGames = displayGames.map((game) => {
                const gameId = Number(game?.id);
                if (!Number.isFinite(gameId)) {
                    return game;
                }

                return rankedCompletedById.get(gameId) || game;
            });
        }

        if (!displayGames.length) {
            this.showNoGames();
            return;
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
        const usePlayedDateColumn = Boolean(this.activePeriodFilter) && !this.isFutureGames;
        const contextHeaderLabel = usePlayedDateColumn ? 'Date' : 'Venue';
        const contextHeaderClass = usePlayedDateColumn ? 'th-played-date' : 'th-venue';

        table.innerHTML = `
            <thead>
                <tr>
                    <th class="th-rank">#</th>
                    <th>Matchup</th>
                    <th class="${contextHeaderClass}">${contextHeaderLabel}</th>
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
            const gameId = Number(game?.id);
            const rank = rankByGameId
                ? (rankByGameId.get(gameId) || '-')
                : index + 1;

            const row = new GameTableRow(game, {
                rank,
                index,
                isFuture: this.isFutureGames,
                showPlayedDate: usePlayedDateColumn
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
        if (this.games?.length && (!this.isFutureGames || this.isMixedScheduleView())) {
            this.displayGames();
        }
    }

    /**
     * True when the table is in future-mode but includes completed games.
     * @param {Array} games - Games list to inspect
     * @returns {boolean} - Whether mixed schedule view is active
     */
    isMixedScheduleView(games = this.games) {
        if (!this.isFutureGames || !Array.isArray(games) || games.length === 0) {
            return false;
        }

        return games.some((game) => !game?.isFuture);
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

        if (this.elements.noGames) {
            this.elements.noGames.textContent = this.activePeriodFilter
                ? 'No completed games found for the selected filter.'
                : this.defaultNoGamesMessage;
        }

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

        if (shouldOpen && this.elements.periodFilterModal) {
            this.elements.periodFilterModal.classList.add('hidden');
            if (this.elements.openPeriodFilterBtn) {
                this.elements.openPeriodFilterBtn.setAttribute('aria-expanded', 'false');
            }

            this.toggleTeamPickerList(false);
        }

        this.elements.filtersContainer.classList.toggle('hidden', !shouldOpen);

        if (this.elements.toggleFiltersBtn) {
            this.elements.toggleFiltersBtn.setAttribute('aria-expanded', String(shouldOpen));
        }

        this.updateModalBodyState();
    }

    /**
     * Toggle period filter modal visibility.
     * @param {boolean|null} forceOpen - Optional open state override
     */
    togglePeriodFilterModal(forceOpen = null) {
        if (!this.elements.periodFilterModal) {
            return;
        }

        const shouldOpen = typeof forceOpen === 'boolean'
            ? forceOpen
            : this.elements.periodFilterModal.classList.contains('hidden');

        if (shouldOpen && this.elements.filtersContainer) {
            this.elements.filtersContainer.classList.add('hidden');
            if (this.elements.toggleFiltersBtn) {
                this.elements.toggleFiltersBtn.setAttribute('aria-expanded', 'false');
            }
        }

        if (shouldOpen) {
            const activeTeamSelections = this.normalizeTeamSelections(
                this.activePeriodFilter?.teamSelections
                ?? this.activePeriodFilter?.teamSelection
                ?? this.activePeriodFilter?.teamId
            );
            const activeMinimumStars = this.normalizeMinimumStars(
                this.activePeriodFilter?.minimumStars ?? this.activePeriodFilter?.minStars
            );

            if (this.elements.periodFilterDaysInput) {
                const activeDays = Number.parseInt(this.activePeriodFilter?.days, 10);
                this.elements.periodFilterDaysInput.value = String(
                    Number.isFinite(activeDays) ? activeDays : this.defaultLookbackDays
                );
            }

            this.rebuildPeriodFilterTeamOptions();

            if (this.elements.periodFilterTeamSelect) {
                this.setSelectedTeamSelectionsInControl(activeTeamSelections);
            }

            if (this.elements.periodFilterMinStarsSelect) {
                this.elements.periodFilterMinStarsSelect.value = String(activeMinimumStars);
            }

            this.toggleTeamPickerList(false);
        } else {
            this.toggleTeamPickerList(false);
        }

        this.elements.periodFilterModal.classList.toggle('hidden', !shouldOpen);

        if (this.elements.openPeriodFilterBtn) {
            this.elements.openPeriodFilterBtn.setAttribute('aria-expanded', String(shouldOpen));
        }

        this.updateModalBodyState();
    }

    /**
     * Determine whether a modal is currently visible.
     * @param {HTMLElement|null} modalElement - Modal element
     * @returns {boolean} - True when modal is open
     */
    isModalOpen(modalElement) {
        return Boolean(modalElement && !modalElement.classList.contains('hidden'));
    }

    /**
     * Keep body scroll lock synced to modal visibility.
     */
    updateModalBodyState() {
        const anyOpen = this.isModalOpen(this.elements.filtersContainer)
            || this.isModalOpen(this.elements.periodFilterModal);
        document.body.classList.toggle('modal-open', anyOpen);
    }
}

export default new UI();