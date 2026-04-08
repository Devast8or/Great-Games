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
            standingsModal: document.getElementById('standings-modal'),
            openStandingsBtn: document.getElementById('open-standings'),
            closeStandingsBtn: document.getElementById('close-standings-modal'),
            standingsModalSubtitle: document.getElementById('standings-modal-subtitle'),
            standingsTableState: document.getElementById('standings-table-state'),
            standingsTableContainer: document.getElementById('standings-table-container'),
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
        this.standingsByTeamId = {};
        this.standingsSeason = null;
        this.standingsDateLabel = '';
        this.standingsLoading = false;
        this.standingsDisplayMode = 'divisions';
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
        this.ensureModalHost(this.elements.standingsModal);

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

        if (this.elements.openStandingsBtn) {
            this.elements.openStandingsBtn.addEventListener('click', () => this.toggleStandingsModal(true));
        }

        if (this.elements.closeStandingsBtn) {
            this.elements.closeStandingsBtn.addEventListener('click', () => this.toggleStandingsModal(false));
        }

        if (this.elements.standingsModal) {
            this.elements.standingsModal.addEventListener('click', (event) => {
                if (event.target === this.elements.standingsModal) {
                    this.toggleStandingsModal(false);
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

            if (this.isModalOpen(this.elements.standingsModal)) {
                this.toggleStandingsModal(false);
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

        this.setStandingsLoadingState(date, API.inferSeasonFromDate(date));

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
        const standingsByTeamId = API.mapStandingsByTeam(standingsData);
        const teamRankings = API.processTeamRankings(standingsData);
        this.updateStandingsData(standingsByTeamId, API.inferSeasonFromDate(standingsDate), standingsDate);
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
            this.renderStandingsTable();
            this.displayGames();
        } catch (error) {
            console.error('Error loading games:', error);
            this.markStandingsUnavailable(date, API.inferSeasonFromDate(date));
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
            this.updateStandingsData(API.mapStandingsByTeam(standingsData), API.inferSeasonFromDate(date), date);
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
            this.renderStandingsTable();
            this.displayGames();
        } catch (error) {
            console.error('Error loading current-day games:', error);
            this.markStandingsUnavailable(date, API.inferSeasonFromDate(date));
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
            this.updateStandingsData(API.mapStandingsByTeam(standingsData), API.inferSeasonFromDate(date), date);
            this.registerMlbTeamIds(teamRankings);
            const games = Parser.processFutureGames(gamesData);

            this.applyTeamRankings(games, teamRankings);

            this.registerTeamsFromGames(games);
            this.games = games;
            this.isFutureGames = true;
            this.renderStandingsTable();
            this.displayGames();
        } catch (error) {
            console.error('Error loading future games:', error);
            this.markStandingsUnavailable(date, API.inferSeasonFromDate(date));
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
            this.setStandingsLoadingState(anchorDate, API.inferSeasonFromDate(anchorDate));

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
            this.renderStandingsTable();
            this.displayGames();

            return true;
        } catch (error) {
            console.error('Error loading filtered games:', error);
            this.markStandingsUnavailable(anchorDate, API.inferSeasonFromDate(anchorDate));
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

    setStandingsLoadingState(dateLabel = '', season = null) {
        this.standingsLoading = true;
        this.standingsByTeamId = {};
        this.standingsDateLabel = String(dateLabel || this.elements.gameDate?.value || '').trim();

        const parsedSeason = Number.parseInt(season, 10);
        this.standingsSeason = Number.isFinite(parsedSeason) && parsedSeason > 0
            ? parsedSeason
            : null;

        this.renderStandingsTable();
    }

    updateStandingsData(standingsByTeamId = {}, season = null, dateLabel = '') {
        this.standingsLoading = false;
        this.standingsByTeamId = standingsByTeamId && typeof standingsByTeamId === 'object'
            ? standingsByTeamId
            : {};
        this.standingsDateLabel = String(dateLabel || this.elements.gameDate?.value || '').trim();

        const parsedSeason = Number.parseInt(season, 10);
        this.standingsSeason = Number.isFinite(parsedSeason) && parsedSeason > 0
            ? parsedSeason
            : API.inferSeasonFromDate(this.standingsDateLabel);

        this.renderStandingsTable();
    }

    markStandingsUnavailable(dateLabel = '', season = null) {
        this.standingsLoading = false;
        this.standingsByTeamId = {};
        this.standingsDateLabel = String(dateLabel || this.elements.gameDate?.value || '').trim();

        const parsedSeason = Number.parseInt(season, 10);
        this.standingsSeason = Number.isFinite(parsedSeason) && parsedSeason > 0
            ? parsedSeason
            : API.inferSeasonFromDate(this.standingsDateLabel);

        this.renderStandingsTable();
    }

    normalizeLeagueLabel(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized.includes('american')) {
            return 'American League';
        }

        if (normalized.includes('national')) {
            return 'National League';
        }

        return normalized ? String(value).trim() : 'League';
    }

    formatSeasonLabel(seasonValue) {
        const season = Number.parseInt(seasonValue, 10);
        if (!Number.isFinite(season) || season <= 0) {
            return '';
        }

        return String(season);
    }

    normalizeStandingsDisplayMode(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'leagues' || normalized === 'playoff-picture') {
            return normalized;
        }

        return 'divisions';
    }

    renderStandingsLeagueFilterControl() {
        if (!this.elements.standingsTableState || !this.elements.standingsTableContainer) {
            return;
        }

        const standingsContent = this.elements.standingsTableState.parentElement;
        if (!standingsContent) {
            return;
        }

        let controlsRow = standingsContent.querySelector('.standings-modal-controls-mlb');
        if (!controlsRow) {
            controlsRow = document.createElement('div');
            controlsRow.className = 'standings-modal-controls standings-modal-controls-mlb';
            standingsContent.insertBefore(controlsRow, this.elements.standingsTableState);
        }

        controlsRow.classList.remove('hidden');
        controlsRow.setAttribute('aria-hidden', 'false');

        // Remove any stale/shared switches that may have been created by other sport modes.
        controlsRow.querySelectorAll('.standings-league-switch:not(.standings-league-switch-mlb)').forEach((node) => {
            node.remove();
        });
        standingsContent.querySelectorAll('.standings-modal-controls-nhl').forEach((node) => {
            node.remove();
        });

        let control = controlsRow.querySelector('.standings-league-switch-mlb');

        if (!control) {
            control = document.createElement('div');
            control.className = 'standings-league-switch standings-league-switch-mlb';
            control.setAttribute('role', 'group');
            control.setAttribute('aria-label', 'Standings league filter');

            [
                { value: 'divisions', label: 'Divisions' },
                { value: 'leagues', label: 'Leagues' },
                { value: 'playoff-picture', label: 'Playoff Picture' }
            ].forEach((option) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'standings-league-btn';
                button.dataset.standingsMode = option.value;
                button.textContent = option.label;
                button.addEventListener('click', () => {
                    const nextMode = this.normalizeStandingsDisplayMode(option.value);
                    if (this.standingsDisplayMode === nextMode) {
                        return;
                    }

                    this.standingsDisplayMode = nextMode;
                    this.renderStandingsTable();
                });
                control.appendChild(button);
            });

            controlsRow.appendChild(control);
        }

        const existingModes = new Set(
            Array.from(control.querySelectorAll('.standings-league-btn'))
                .map((button) => String(button.dataset?.standingsMode || '').trim())
        );

        if (!existingModes.has('playoff-picture')) {
            const playoffButton = document.createElement('button');
            playoffButton.type = 'button';
            playoffButton.className = 'standings-league-btn';
            playoffButton.dataset.standingsMode = 'playoff-picture';
            playoffButton.textContent = 'Playoff Picture';
            playoffButton.addEventListener('click', () => {
                const nextMode = this.normalizeStandingsDisplayMode('playoff-picture');
                if (this.standingsDisplayMode === nextMode) {
                    return;
                }

                this.standingsDisplayMode = nextMode;
                this.renderStandingsTable();
            });
            control.appendChild(playoffButton);
        }

        const activeMode = this.normalizeStandingsDisplayMode(this.standingsDisplayMode);
        control.querySelectorAll('.standings-league-btn').forEach((button) => {
            const isActive = button.dataset.standingsMode === activeMode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    buildStandingsHighlightMap() {
        if (!Array.isArray(this.games) || this.games.length === 0) {
            return new Map();
        }

        const rankingOptions = this.getRankingOptions();
        let displayGames = this.games;

        if (!this.isFutureGames) {
            displayGames = Ranker.rankGames(this.games, rankingOptions);

            if (this.activePeriodFilter) {
                const minimumStars = this.normalizeMinimumStars(
                    this.activePeriodFilter.minimumStars ?? this.activePeriodFilter.minStars
                );

                displayGames = displayGames.filter((game) => (
                    this.getStarValueFromExcitementScore(game?.excitementScore) >= minimumStars
                ));
            }
        } else if (this.isMixedScheduleView(displayGames)) {
            const completedGames = displayGames.filter((game) => !game?.isFuture);
            const rankedCompletedGames = Ranker.rankGames(completedGames, rankingOptions);
            const futureOrLiveGames = displayGames.filter((game) => game?.isFuture);

            displayGames = [...rankedCompletedGames, ...futureOrLiveGames];
        }

        return displayGames.slice(0, 3).reduce((highlights, game, index) => {
            const gameNumber = index + 1;
            const awayTeamId = Number.parseInt(game?.awayTeam?.id, 10);
            const homeTeamId = Number.parseInt(game?.homeTeam?.id, 10);

            [awayTeamId, homeTeamId]
                .filter((teamId) => Number.isFinite(teamId) && teamId > 0)
                .forEach((teamId) => {
                    const key = String(teamId);
                    if (!highlights.has(key)) {
                        highlights.set(key, []);
                    }

                    highlights.get(key).push({ gameNumber });
                });

            return highlights;
        }, new Map());
    }

    buildStandingsRows() {
        const highlightsByTeamId = this.buildStandingsHighlightMap();

        return Object.entries(this.standingsByTeamId || {})
            .map(([teamId, standing]) => {
                const numericTeamId = Number.parseInt(standing?.teamId ?? teamId, 10);
                if (!Number.isFinite(numericTeamId) || numericTeamId <= 0) {
                    return null;
                }

                const divisionRank = Number.parseInt(standing?.divisionRank, 10);
                const leagueRank = Number.parseInt(standing?.leagueRank, 10);
                const wins = Number.parseInt(standing?.wins, 10);
                const losses = Number.parseInt(standing?.losses, 10);
                const winPct = Number.parseFloat(standing?.winPct);

                return {
                    teamId: numericTeamId,
                    teamName: String(standing?.teamName || '').trim(),
                    abbreviation: String(standing?.abbreviation || '').trim(),
                    conference: this.normalizeLeagueLabel(standing?.conference),
                    division: String(standing?.division || '').trim(),
                    divisionRank: Number.isFinite(divisionRank) && divisionRank > 0 ? divisionRank : Number.MAX_SAFE_INTEGER,
                    leagueRank: Number.isFinite(leagueRank) && leagueRank > 0 ? leagueRank : Number.MAX_SAFE_INTEGER,
                    wins: Number.isFinite(wins) ? wins : 0,
                    losses: Number.isFinite(losses) ? losses : 0,
                    winPct: Number.isFinite(winPct) ? winPct : null,
                    highlights: highlightsByTeamId.get(String(numericTeamId)) || []
                };
            })
            .filter(Boolean)
            .sort((left, right) => {
                if (left.conference !== right.conference) {
                    return left.conference.localeCompare(right.conference);
                }

                if (left.division !== right.division) {
                    return left.division.localeCompare(right.division);
                }

                if (left.divisionRank !== right.divisionRank) {
                    return left.divisionRank - right.divisionRank;
                }

                if (left.wins !== right.wins) {
                    return right.wins - left.wins;
                }

                return left.teamName.localeCompare(right.teamName);
            });
    }

    createStandingsSection(title, rows) {
        const section = document.createElement('section');
        section.className = 'standings-conference panel-surface';

        const heading = document.createElement('h4');
        heading.textContent = title;
        section.appendChild(heading);

        const tableScroll = document.createElement('div');
        tableScroll.className = 'standings-table-scroll';

        const table = document.createElement('table');
        table.className = 'standings-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['#', 'Team'].forEach((label) => {
            const th = document.createElement('th');
            th.textContent = label;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            const primaryHighlight = row.highlights.reduce((best, highlight) => (
                !best || highlight.gameNumber < best.gameNumber ? highlight : best
            ), null);

            if (primaryHighlight) {
                tr.classList.add('standings-row-highlight');
                if (primaryHighlight?.gameNumber) {
                    tr.classList.add(`standings-row-highlight-game-${primaryHighlight.gameNumber}`);
                }
            }

            const rankCell = document.createElement('td');
            const rankValue = Number.parseInt(row?.displayRank ?? row?.divisionRank, 10);
            rankCell.textContent = Number.isFinite(rankValue) && rankValue > 0 ? String(rankValue) : '--';
            tr.appendChild(rankCell);

            const teamCell = document.createElement('td');
            const teamCellWrap = document.createElement('div');
            teamCellWrap.className = 'standings-team-cell';

            const teamName = document.createElement('span');
            teamName.className = 'standings-team-name';
            teamName.textContent = row.teamName;

            const badgeSlot = document.createElement('span');
            badgeSlot.className = 'standings-team-badge-slot';

            const highlightBadge = document.createElement('span');
            if (primaryHighlight?.gameNumber) {
                highlightBadge.className = `standings-team-highlight standings-team-highlight-game-${primaryHighlight.gameNumber}`;
                const highlightNumber = document.createElement('span');
                highlightNumber.className = 'standings-team-highlight-number';
                highlightNumber.textContent = String(primaryHighlight.gameNumber);
                highlightBadge.appendChild(highlightNumber);
                highlightBadge.setAttribute('aria-label', `Top game rank ${primaryHighlight.gameNumber}`);
            } else {
                highlightBadge.className = 'standings-team-highlight standings-team-highlight-empty';
                highlightBadge.setAttribute('aria-hidden', 'true');
            }
            badgeSlot.appendChild(highlightBadge);

            const teamAbbreviation = document.createElement('span');
            teamAbbreviation.className = 'standings-team-abbr';
            teamAbbreviation.textContent = row.abbreviation;

            teamCellWrap.appendChild(teamName);
            teamCellWrap.appendChild(teamAbbreviation);
            teamCellWrap.appendChild(badgeSlot);

            teamCell.appendChild(teamCellWrap);
            tr.appendChild(teamCell);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableScroll.appendChild(table);
        section.appendChild(tableScroll);

        return section;
    }

    buildMlbPlayoffPictureGroups(standingsRows = []) {
        if (!Array.isArray(standingsRows) || standingsRows.length === 0) {
            return [];
        }

        const leagueOrder = ['American League', 'National League'];

        const compareRows = (left, right) => {
            const leftWinPct = Number.parseFloat(left?.winPct);
            const rightWinPct = Number.parseFloat(right?.winPct);
            const leftHasWinPct = Number.isFinite(leftWinPct);
            const rightHasWinPct = Number.isFinite(rightWinPct);

            if (leftHasWinPct && rightHasWinPct && leftWinPct !== rightWinPct) {
                return rightWinPct - leftWinPct;
            }

            if (left.wins !== right.wins) {
                return right.wins - left.wins;
            }

            if (left.losses !== right.losses) {
                return left.losses - right.losses;
            }

            if (left.leagueRank !== right.leagueRank) {
                return left.leagueRank - right.leagueRank;
            }

            return left.teamName.localeCompare(right.teamName);
        };

        const groupedByLeague = standingsRows.reduce((groups, row) => {
            const conference = row.conference || 'League';
            if (!groups.has(conference)) {
                groups.set(conference, []);
            }

            groups.get(conference).push(row);
            return groups;
        }, new Map());

        return Array.from(groupedByLeague.entries())
            .sort((left, right) => {
                const leftIndex = leagueOrder.indexOf(left[0]);
                const rightIndex = leagueOrder.indexOf(right[0]);

                if (leftIndex === -1 && rightIndex === -1) {
                    return String(left[0]).localeCompare(String(right[0]));
                }

                if (leftIndex === -1) {
                    return 1;
                }

                if (rightIndex === -1) {
                    return -1;
                }

                return leftIndex - rightIndex;
            })
            .map(([conference, leagueRows]) => {
                const rowsByDivision = leagueRows.reduce((groups, row) => {
                    const division = row.division || 'Division';
                    if (!groups.has(division)) {
                        groups.set(division, []);
                    }

                    groups.get(division).push(row);
                    return groups;
                }, new Map());

                const divisionWinners = Array.from(rowsByDivision.values())
                    .map((divisionRows) => divisionRows
                        .slice()
                        .sort((left, right) => {
                            if (left.divisionRank !== right.divisionRank) {
                                return left.divisionRank - right.divisionRank;
                            }

                            return compareRows(left, right);
                        })[0])
                    .filter(Boolean)
                    .sort(compareRows)
                    .slice(0, 3);

                const divisionWinnerIds = new Set(divisionWinners.map((row) => row.teamId));
                const wildCards = leagueRows
                    .filter((row) => !divisionWinnerIds.has(row.teamId))
                    .slice()
                    .sort(compareRows)
                    .slice(0, 3);

                const seedMap = new Map();
                if (divisionWinners[0]) {
                    seedMap.set(1, divisionWinners[0]);
                }
                if (divisionWinners[1]) {
                    seedMap.set(2, divisionWinners[1]);
                }
                if (divisionWinners[2]) {
                    seedMap.set(3, divisionWinners[2]);
                }
                if (wildCards[0]) {
                    seedMap.set(4, wildCards[0]);
                }
                if (wildCards[1]) {
                    seedMap.set(5, wildCards[1]);
                }
                if (wildCards[2]) {
                    seedMap.set(6, wildCards[2]);
                }

                return {
                    title: conference,
                    seedMap
                };
            });
    }

    getMlbBracketTeamDisplay(seedMap, seedNumber, options = {}) {
        if (!(seedMap instanceof Map)) {
            return {
                label: options.fallbackLabel || `Seed ${seedNumber} TBD`,
                rankLabel: '',
                abbreviation: '',
                logoUrl: null
            };
        }

        const row = seedMap.get(seedNumber);
        if (!row) {
            return {
                label: options.fallbackLabel || `Seed ${seedNumber} TBD`,
                rankLabel: '',
                abbreviation: '',
                logoUrl: null
            };
        }

        const abbreviation = String(row.abbreviation || '').trim().toUpperCase();
        const resolvedAbbreviation = abbreviation
            || String(row.teamName || '').trim().slice(0, 3).toUpperCase()
            || 'TBD';
        const includeSeedPrefix = options.includeSeedPrefix !== false;
        const rankLabel = includeSeedPrefix ? `${seedNumber}.` : '';
        const teamId = Number.parseInt(row?.teamId, 10);

        return {
            label: includeSeedPrefix ? `${rankLabel} ${resolvedAbbreviation}` : resolvedAbbreviation,
            rankLabel,
            abbreviation: resolvedAbbreviation,
            logoUrl: Number.isFinite(teamId) && teamId > 0
                ? (typeof API.getTeamLogoUrl === 'function' ? API.getTeamLogoUrl(teamId) : null)
                : null
        };
    }

    createMlbBracketMatchCard({ title, topTeam, bottomTeam, note = '', flowLines = [] }) {
        const card = document.createElement('article');
        card.className = 'playoff-match-card';

        const cardTitle = document.createElement('h5');
        cardTitle.className = 'playoff-match-title';
        cardTitle.textContent = title;
        card.appendChild(cardTitle);

        const teams = document.createElement('div');
        teams.className = 'playoff-match-teams';

        const topTeamEl = document.createElement('div');
        topTeamEl.className = 'playoff-match-team';
        if (topTeam && typeof topTeam === 'object') {
            if (topTeam.rankLabel) {
                const rank = document.createElement('span');
                rank.className = 'playoff-match-team-rank';
                rank.textContent = topTeam.rankLabel;
                topTeamEl.appendChild(rank);
            }

            if (topTeam.logoUrl) {
                const logo = document.createElement('img');
                logo.className = 'playoff-match-team-logo';
                logo.src = topTeam.logoUrl;
                logo.alt = '';
                logo.loading = 'lazy';
                logo.decoding = 'async';
                topTeamEl.appendChild(logo);
            }

            const text = document.createElement('span');
            text.className = 'playoff-match-team-label';
            text.textContent = String(topTeam.abbreviation || topTeam.label || '').trim() || 'TBD';
            topTeamEl.appendChild(text);
        } else {
            topTeamEl.textContent = String(topTeam || '').trim() || 'TBD';
        }

        const bottomTeamEl = document.createElement('div');
        bottomTeamEl.className = 'playoff-match-team';
        if (bottomTeam && typeof bottomTeam === 'object') {
            if (bottomTeam.rankLabel) {
                const rank = document.createElement('span');
                rank.className = 'playoff-match-team-rank';
                rank.textContent = bottomTeam.rankLabel;
                bottomTeamEl.appendChild(rank);
            }

            if (bottomTeam.logoUrl) {
                const logo = document.createElement('img');
                logo.className = 'playoff-match-team-logo';
                logo.src = bottomTeam.logoUrl;
                logo.alt = '';
                logo.loading = 'lazy';
                logo.decoding = 'async';
                bottomTeamEl.appendChild(logo);
            }

            const text = document.createElement('span');
            text.className = 'playoff-match-team-label';
            text.textContent = String(bottomTeam.abbreviation || bottomTeam.label || '').trim() || 'TBD';
            bottomTeamEl.appendChild(text);
        } else {
            bottomTeamEl.textContent = String(bottomTeam || '').trim() || 'TBD';
        }

        teams.appendChild(topTeamEl);
        teams.appendChild(bottomTeamEl);
        card.appendChild(teams);

        if (note) {
            const noteEl = document.createElement('p');
            noteEl.className = 'playoff-match-note';
            noteEl.textContent = note;
            card.appendChild(noteEl);
        }

        if (Array.isArray(flowLines) && flowLines.length > 0) {
            const flowWrap = document.createElement('div');
            flowWrap.className = 'playoff-match-flow';

            flowLines.forEach((line) => {
                const normalizedLine = String(line || '').trim();
                if (!normalizedLine) {
                    return;
                }

                const flowLine = document.createElement('p');
                flowLine.className = 'playoff-match-flow-line';
                flowLine.textContent = normalizedLine;
                flowWrap.appendChild(flowLine);
            });

            if (flowWrap.childElementCount > 0) {
                card.appendChild(flowWrap);
            }
        }

        return card;
    }

    createMlbPlayoffPictureSection(title, seedMap) {
        const section = document.createElement('section');
        section.className = 'standings-conference panel-surface';
        const isNationalLeague = /national/i.test(String(title || ''));

        const heading = document.createElement('h4');
        heading.textContent = title;
        section.appendChild(heading);

        const bracket = document.createElement('div');
        bracket.className = 'standings-playoff-bracket standings-playoff-bracket-mlb';
        if (isNationalLeague) {
            bracket.classList.add('standings-playoff-bracket-mlb-nl');
        }

        const bracketMeta = document.createElement('p');
        bracketMeta.className = 'standings-playoff-bracket-meta';
        bracketMeta.textContent = 'Wild Card round feeds Division Series; top two division winners receive byes.';
        bracket.appendChild(bracketMeta);

        const rounds = document.createElement('div');
        rounds.className = 'standings-playoff-rounds';
        if (isNationalLeague) {
            rounds.classList.add('standings-playoff-rounds-reverse');
        }

        const wildCardRound = document.createElement('section');
        wildCardRound.className = 'standings-playoff-round standings-playoff-round--wildcard';
        const wildCardHeading = document.createElement('h5');
        wildCardHeading.textContent = 'Wild Card Round';
        wildCardRound.appendChild(wildCardHeading);
        wildCardRound.appendChild(this.createMlbBracketMatchCard({
            title: 'Series A (3 vs 6)',
            topTeam: this.getMlbBracketTeamDisplay(seedMap, 3),
            bottomTeam: this.getMlbBracketTeamDisplay(seedMap, 6),
            note: 'Best of 3',
            flowLines: ['Winner -> Division Series vs Seed 2']
        }));
        wildCardRound.appendChild(this.createMlbBracketMatchCard({
            title: 'Series B (4 vs 5)',
            topTeam: this.getMlbBracketTeamDisplay(seedMap, 4),
            bottomTeam: this.getMlbBracketTeamDisplay(seedMap, 5),
            note: 'Best of 3',
            flowLines: ['Winner -> Division Series vs Seed 1']
        }));

        const divisionRound = document.createElement('section');
        divisionRound.className = 'standings-playoff-round standings-playoff-round--division';
        const divisionHeading = document.createElement('h5');
        divisionHeading.textContent = 'Division Series';
        divisionRound.appendChild(divisionHeading);
        divisionRound.appendChild(this.createMlbBracketMatchCard({
            title: 'DS Matchup 1',
            topTeam: this.getMlbBracketTeamDisplay(seedMap, 1),
            bottomTeam: 'Winner of Series B',
            note: 'Best of 5',
            flowLines: ['Seed 1 spot is highest division winner']
        }));
        divisionRound.appendChild(this.createMlbBracketMatchCard({
            title: 'DS Matchup 2',
            topTeam: this.getMlbBracketTeamDisplay(seedMap, 2),
            bottomTeam: 'Winner of Series A',
            note: 'Best of 5',
            flowLines: ['Seed 2 spot is second-highest division winner']
        }));

        if (isNationalLeague) {
            rounds.appendChild(divisionRound);
            rounds.appendChild(wildCardRound);
        } else {
            rounds.appendChild(wildCardRound);
            rounds.appendChild(divisionRound);
        }
        bracket.appendChild(rounds);
        section.appendChild(bracket);

        return section;
    }

    renderStandingsTable() {
        this.renderStandingsLeagueFilterControl();

        if (this.elements.standingsModalSubtitle) {
            const subtitleParts = [];
            if (this.standingsDateLabel) {
                subtitleParts.push(`Selected date: ${this.standingsDateLabel}`);
            }

            const seasonLabel = this.formatSeasonLabel(this.standingsSeason);
            if (seasonLabel) {
                subtitleParts.push(`Season: ${seasonLabel}`);
            }

            if (this.normalizeStandingsDisplayMode(this.standingsDisplayMode) === 'playoff-picture') {
                subtitleParts.push('Projected playoff field from current standings (top 3 division winners + 3 wild cards per league).');
            }

            this.elements.standingsModalSubtitle.textContent = subtitleParts.length > 0
                ? subtitleParts.join(' | ')
                : 'Season standings for the selected date.';
        }

        if (!this.elements.standingsTableContainer || !this.elements.standingsTableState) {
            return;
        }

        this.elements.standingsTableContainer.innerHTML = '';

        const standingsRows = this.buildStandingsRows();
        if (this.standingsLoading) {
            this.elements.standingsTableState.textContent = 'Loading MLB standings...';
            this.elements.standingsTableState.classList.remove('hidden');
            this.elements.standingsTableContainer.classList.add('hidden');
            return;
        }

        if (standingsRows.length === 0) {
            this.elements.standingsTableState.textContent = 'MLB standings are unavailable for the selected date.';
            this.elements.standingsTableState.classList.remove('hidden');
            this.elements.standingsTableContainer.classList.add('hidden');
            return;
        }

        const displayMode = this.normalizeStandingsDisplayMode(this.standingsDisplayMode);
        const conferenceOrder = ['American League', 'National League', 'League'];
        const divisionOrder = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'];
        const getLeagueColumnOrder = (leagueLabel) => {
            const normalized = String(leagueLabel || '').toLowerCase();
            if (normalized.includes('american')) {
                return 0;
            }

            if (normalized.includes('national')) {
                return 1;
            }

            return 2;
        };

        let orderedGroups = [];

        if (displayMode === 'playoff-picture') {
            this.elements.standingsTableContainer.classList.add('standings-grid-leagues');
            orderedGroups = this.buildMlbPlayoffPictureGroups(standingsRows);
        } else if (displayMode === 'leagues') {
            this.elements.standingsTableContainer.classList.add('standings-grid-leagues');

            const groupedByLeague = standingsRows.reduce((groups, row) => {
                const conferenceLabel = row.conference || 'League';
                if (!groups.has(conferenceLabel)) {
                    groups.set(conferenceLabel, {
                        conference: conferenceLabel,
                        rows: []
                    });
                }

                groups.get(conferenceLabel).rows.push(row);
                return groups;
            }, new Map());

            orderedGroups = Array.from(groupedByLeague.values())
                .map((group) => ({
                    title: group.conference,
                    rows: group.rows.slice().sort((left, right) => {
                        if (left.leagueRank !== right.leagueRank) {
                            return left.leagueRank - right.leagueRank;
                        }

                        if (left.winPct !== null && right.winPct !== null && left.winPct !== right.winPct) {
                            return right.winPct - left.winPct;
                        }

                        if (left.wins !== right.wins) {
                            return right.wins - left.wins;
                        }

                        if (left.losses !== right.losses) {
                            return left.losses - right.losses;
                        }

                        if (left.divisionRank !== right.divisionRank) {
                            return left.divisionRank - right.divisionRank;
                        }

                        return left.teamName.localeCompare(right.teamName);
                    })
                }))
                .sort((left, right) => {
                    const leftLeagueOrder = getLeagueColumnOrder(left.title);
                    const rightLeagueOrder = getLeagueColumnOrder(right.title);

                    if (leftLeagueOrder !== rightLeagueOrder) {
                        return leftLeagueOrder - rightLeagueOrder;
                    }

                    const leftConferenceIndex = conferenceOrder.indexOf(left.title);
                    const rightConferenceIndex = conferenceOrder.indexOf(right.title);

                    if (leftConferenceIndex === -1 && rightConferenceIndex === -1) {
                        return left.title.localeCompare(right.title);
                    }

                    if (leftConferenceIndex === -1) {
                        return 1;
                    }

                    if (rightConferenceIndex === -1) {
                        return -1;
                    }

                    return leftConferenceIndex - rightConferenceIndex;
                });

            orderedGroups = orderedGroups.map((group) => ({
                ...group,
                rows: group.rows.map((row) => ({
                    ...row,
                    displayRank: row.leagueRank
                }))
            }));
        } else {
            this.elements.standingsTableContainer.classList.remove('standings-grid-leagues');

            const groupedByDivision = standingsRows.reduce((groups, row) => {
                const divisionLabel = row.division || 'Division';
                const key = `${row.conference}::${divisionLabel}`;

                if (!groups.has(key)) {
                    groups.set(key, {
                        conference: row.conference,
                        division: divisionLabel,
                        rows: []
                    });
                }

                groups.get(key).rows.push(row);
                return groups;
            }, new Map());

            orderedGroups = Array.from(groupedByDivision.values())
                .map((group) => ({
                    title: `${group.conference} - ${group.division}`,
                    conference: group.conference,
                    division: group.division,
                    rows: group.rows
                }))
                .sort((left, right) => {
                    const leftConferenceIndex = conferenceOrder.indexOf(left.conference);
                    const rightConferenceIndex = conferenceOrder.indexOf(right.conference);

                    if (leftConferenceIndex !== rightConferenceIndex) {
                        if (leftConferenceIndex === -1) {
                            return 1;
                        }

                        if (rightConferenceIndex === -1) {
                            return -1;
                        }

                        return leftConferenceIndex - rightConferenceIndex;
                    }

                    const leftDivisionIndex = divisionOrder.indexOf(left.division);
                    const rightDivisionIndex = divisionOrder.indexOf(right.division);

                    if (leftDivisionIndex !== rightDivisionIndex) {
                        if (leftDivisionIndex === -1 && rightDivisionIndex === -1) {
                            return left.division.localeCompare(right.division);
                        }

                        if (leftDivisionIndex === -1) {
                            return 1;
                        }

                        if (rightDivisionIndex === -1) {
                            return -1;
                        }

                        return leftDivisionIndex - rightDivisionIndex;
                    }

                    return left.division.localeCompare(right.division);
                });

            orderedGroups = orderedGroups.map((group) => ({
                ...group,
                rows: group.rows.map((row) => ({
                    ...row,
                    displayRank: row.divisionRank
                }))
            }));
        }

        if (orderedGroups.length === 0) {
            this.elements.standingsTableState.textContent = 'MLB standings are unavailable for the selected date.';
            this.elements.standingsTableState.classList.remove('hidden');
            this.elements.standingsTableContainer.classList.add('hidden');
            return;
        }

        orderedGroups.forEach((group) => {
            if (displayMode === 'playoff-picture') {
                this.elements.standingsTableContainer.appendChild(this.createMlbPlayoffPictureSection(group.title, group.seedMap));
            } else {
                this.elements.standingsTableContainer.appendChild(this.createStandingsSection(group.title, group.rows));
            }
        });

        this.elements.standingsTableState.classList.add('hidden');
        this.elements.standingsTableContainer.classList.remove('hidden');
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
            rankByGameId = new Map();
            const futureOrLiveGames = displayGames.filter((game) => game?.isFuture);

            rankedCompletedGames.forEach((game, index) => {
                const gameId = Number(game?.id);
                if (!Number.isFinite(gameId)) {
                    return;
                }

                rankByGameId.set(gameId, index + 1);
            });

            displayGames = [...rankedCompletedGames, ...futureOrLiveGames];
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

        if (shouldOpen && this.elements.standingsModal) {
            this.elements.standingsModal.classList.add('hidden');
            if (this.elements.openStandingsBtn) {
                this.elements.openStandingsBtn.setAttribute('aria-expanded', 'false');
            }
        }

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

        if (shouldOpen && this.elements.standingsModal) {
            this.elements.standingsModal.classList.add('hidden');
            if (this.elements.openStandingsBtn) {
                this.elements.openStandingsBtn.setAttribute('aria-expanded', 'false');
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

    toggleStandingsModal(forceOpen = null) {
        if (!this.elements.standingsModal) {
            return;
        }

        const shouldOpen = typeof forceOpen === 'boolean'
            ? forceOpen
            : this.elements.standingsModal.classList.contains('hidden');

        if (shouldOpen && this.elements.filtersContainer) {
            this.elements.filtersContainer.classList.add('hidden');
            if (this.elements.toggleFiltersBtn) {
                this.elements.toggleFiltersBtn.setAttribute('aria-expanded', 'false');
            }
        }

        if (shouldOpen && this.elements.periodFilterModal) {
            this.elements.periodFilterModal.classList.add('hidden');
            if (this.elements.openPeriodFilterBtn) {
                this.elements.openPeriodFilterBtn.setAttribute('aria-expanded', 'false');
            }

            this.toggleTeamPickerList(false);
        }

        this.elements.standingsModal.classList.toggle('hidden', !shouldOpen);

        if (this.elements.openStandingsBtn) {
            this.elements.openStandingsBtn.setAttribute('aria-expanded', String(shouldOpen));
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
            || this.isModalOpen(this.elements.periodFilterModal)
            || this.isModalOpen(this.elements.standingsModal);
        document.body.classList.toggle('modal-open', anyOpen);
    }
}

export default new UI();