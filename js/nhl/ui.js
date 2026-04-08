/**
 * UI module for NHL mode.
 */
import GameTableRow from './components/GameTableRow.js';
import { API } from './api.js';
import { Parser } from './parser.js';
import { Ranker } from './ranker.js';
import Utils from './utils.js';

class UI {
    constructor() {
        this.elements = {
            gameDate: document.getElementById('game-date'),
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
                extraInnings: document.getElementById('extra-innings'),
                highScoring: document.getElementById('high-scoring'),
                teamRankings: document.getElementById('team-rankings'),
                rivalryGame: document.getElementById('rivalry-game')
            }
        };

        this.games = [];
        this.isFutureGames = false;
        this.gameCards = new Map();
        this.rankingOptionsStorageKey = 'nhl-ranking-options';
        this.defaultNoGamesMessage = 'No NHL games found for this date.';
        this.defaultLookbackDays = 7;
        this.maxLookbackDays = 120;
        this.defaultMinimumStars = 1;
        this.maximumStars = 5;
        this.activePeriodFilter = null;
        this.knownTeams = new Map();
        this.debugEnabled = this.resolveDebugEnabled();
        this.loadRequestId = 0;
        this.standingsByTeamId = {};
        this.standingsSeason = null;
        this.standingsDateLabel = '';
        this.standingsLoading = false;
        this.standingsDisplayMode = 'standings';
    }

    init() {
        const previousDay = new Date();
        previousDay.setDate(previousDay.getDate() - 1);

        if (this.elements.gameDate) {
            this.elements.gameDate.value = this.formatDate(previousDay);
        }

        if (this.elements.noGames) {
            this.elements.noGames.textContent = this.defaultNoGamesMessage;
        }

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

        if (this.elements.gameDate) {
            this.elements.gameDate.addEventListener('change', () => {
                void this.handleLoadGames();
            });
        }

        Object.values(this.elements.filters).forEach((filterElement) => {
            if (!filterElement) {
                return;
            }

            filterElement.addEventListener('change', () => {
                this.saveRankingOptionsToStorage();
                this.refreshGameRankings();
            });
        });

        this.ensureModalHost(this.elements.filtersContainer);
        this.ensureModalHost(this.elements.periodFilterModal);
        this.ensureModalHost(this.elements.standingsModal);

        if (this.elements.toggleFiltersBtn) {
            this.elements.toggleFiltersBtn.addEventListener('click', () => {
                this.toggleFiltersPanel(true);
            });
        }

        if (this.elements.closeFiltersBtn) {
            this.elements.closeFiltersBtn.addEventListener('click', () => {
                this.toggleFiltersPanel(false);
            });
        }

        if (this.elements.filtersContainer) {
            this.elements.filtersContainer.addEventListener('click', (event) => {
                if (event.target === this.elements.filtersContainer) {
                    this.toggleFiltersPanel(false);
                }
            });
        }

        if (this.elements.openStandingsBtn) {
            this.elements.openStandingsBtn.addEventListener('click', () => {
                this.toggleStandingsModal(true);
            });
        }

        if (this.elements.closeStandingsBtn) {
            this.elements.closeStandingsBtn.addEventListener('click', () => {
                this.toggleStandingsModal(false);
            });
        }

        if (this.elements.standingsModal) {
            this.elements.standingsModal.addEventListener('click', (event) => {
                if (event.target === this.elements.standingsModal) {
                    this.toggleStandingsModal(false);
                }
            });
        }
        if (this.elements.openPeriodFilterBtn) {
            this.elements.openPeriodFilterBtn.addEventListener('click', () => {
                this.togglePeriodFilterModal(true);
            });
        }

        if (this.elements.closePeriodFilterBtn) {
            this.elements.closePeriodFilterBtn.addEventListener('click', () => {
                this.togglePeriodFilterModal(false);
            });
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

        this.initializePeriodFilterOptions();
        void this.handleLoadGames();
    }

    parseBoolean(value, fallback = false) {
        if (typeof value === 'boolean') {
            return value;
        }

        if (value === null || value === undefined) {
            return fallback;
        }

        const normalized = String(value).trim().toLowerCase();
        if (['1', 'true', 'yes', 'on', 'y'].includes(normalized)) {
            return true;
        }

        if (['0', 'false', 'no', 'off', 'n'].includes(normalized)) {
            return false;
        }

        return fallback;
    }

    resolveDebugEnabled() {
        if (typeof window === 'undefined' || typeof window.document === 'undefined') {
            return false;
        }

        const queryParams = new URLSearchParams(window.location.search);
        const fromQuery = queryParams.get('NHLDebug');
        if (fromQuery !== null) {
            return this.parseBoolean(fromQuery, false);
        }

        if (typeof window.__GREAT_GAMES_NHL_DEBUG__ !== 'undefined') {
            return this.parseBoolean(window.__GREAT_GAMES_NHL_DEBUG__, false);
        }

        try {
            const fromStorage = window.localStorage?.getItem('great-games-NHL-debug');
            if (fromStorage !== null) {
                return this.parseBoolean(fromStorage, false);
            }
        } catch (_error) {
            return false;
        }

        return false;
    }

    ensureModalHost(modalElement) {
        if (modalElement && modalElement.parentElement !== document.body) {
            document.body.appendChild(modalElement);
        }
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

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

    initializePeriodFilterOptions() {
        this.rebuildPeriodFilterTeamOptions();
        this.populateKnownTeams(Utils.getAllTeams());
    }

    populateKnownTeams(teams) {
        let hasChanges = false;

        if (Array.isArray(teams)) {
            teams.forEach((team) => {
                if (!Number.isFinite(team?.id) || !team?.name) {
                    return;
                }

                if (this.knownTeams.get(team.id) !== team.name) {
                    hasChanges = true;
                }

                this.knownTeams.set(team.id, team.name);
            });
        }

        if (hasChanges) {
            this.rebuildPeriodFilterTeamOptions();
        }
    }

    registerTeamsFromGames(games) {
        if (!Array.isArray(games) || games.length === 0) {
            return;
        }

        let hasChanges = false;

        games.forEach((game) => {
            [game?.awayTeam, game?.homeTeam].forEach((team) => {
                const teamId = Number(team?.id);
                const teamName = String(team?.name || '').trim();

                if (!Number.isFinite(teamId) || !teamName) {
                    return;
                }

                if (this.knownTeams.get(teamId) !== teamName) {
                    this.knownTeams.set(teamId, teamName);
                    hasChanges = true;
                }
            });
        });

        if (hasChanges) {
            this.rebuildPeriodFilterTeamOptions();
        }
    }

    rebuildPeriodFilterTeamOptions() {
        if (!this.elements.periodFilterTeamSelect) {
            return;
        }

        const selector = this.elements.periodFilterTeamSelect;
        const previousSelections = this.getSelectedTeamSelectionsFromControl();
        const knownTeamEntries = Array.from(this.knownTeams.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));

        selector.innerHTML = '';
        selector.appendChild(new Option('All Teams', 'all'));

        knownTeamEntries.forEach((team) => {
            selector.appendChild(new Option(team.name, String(team.id)));
        });

        this.setSelectedTeamSelectionsInControl(previousSelections);
    }

    isTeamPickerOpen() {
        return Boolean(
            this.elements.periodFilterTeamOptions
            && !this.elements.periodFilterTeamOptions.classList.contains('hidden')
        );
    }

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

    handleTeamPickerOptionChange(optionValue, isChecked) {
        if (optionValue === 'all') {
            this.setSelectedTeamSelectionsInControl(['all']);
            return;
        }

        const selectionSet = new Set(
            this.getSelectedTeamSelectionsFromControl().filter((selection) => selection !== 'all')
        );

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

    updateTeamPickerToggleLabel() {
        if (!this.elements.periodFilterTeamToggleBtn) {
            return;
        }

        this.elements.periodFilterTeamToggleBtn.textContent = this.getTeamSelectionLabel(
            this.getSelectedTeamSelectionsFromControl()
        );
    }

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

        if (!normalizedSelections.length || normalizedSelections.includes('all')) {
            return ['all'];
        }

        return normalizedSelections;
    }

    getSelectedTeamSelectionsFromControl() {
        if (!this.elements.periodFilterTeamSelect) {
            return ['all'];
        }

        const selectedValues = Array.from(this.elements.periodFilterTeamSelect.selectedOptions)
            .map((option) => option.value);

        return this.normalizeTeamSelections(selectedValues);
    }

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

    getTeamSelectionOptionLabel(selection) {
        if (selection === 'all') {
            return 'All Teams';
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

    adjustLookbackDays(delta) {
        const currentDays = this.getRequestedLookbackDays() || this.defaultLookbackDays;
        const nextDays = Math.max(1, Math.min(currentDays + delta, this.maxLookbackDays));

        if (this.elements.periodFilterDaysInput) {
            this.elements.periodFilterDaysInput.value = String(nextDays);
        }
    }

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

    normalizeMinimumStars(value) {
        const parsedStars = Number.parseInt(String(value ?? ''), 10);
        if (!Number.isFinite(parsedStars)) {
            return this.defaultMinimumStars;
        }

        return Math.max(this.defaultMinimumStars, Math.min(parsedStars, this.maximumStars));
    }

    getRequestedMinimumStars() {
        const minimumStars = this.normalizeMinimumStars(this.elements.periodFilterMinStarsSelect?.value);

        if (this.elements.periodFilterMinStarsSelect) {
            this.elements.periodFilterMinStarsSelect.value = String(minimumStars);
        }

        return minimumStars;
    }

    getStarValueFromExcitementScore(excitementScore) {
        const safeScore = Number.isFinite(excitementScore) ? excitementScore : 0;
        return Math.max(1, Math.min(5, Math.floor(safeScore / 20) + 1));
    }

    getStarRatingLabel(excitementScore) {
        const score = Number(excitementScore);
        if (!Number.isFinite(score)) {
            return '-';
        }

        const stars = Math.max(1, Math.min(5, Math.floor(score / 20) + 1));
        const hasHalfStar = stars < 5 && score % 20 >= 10;
        return '\u2605'.repeat(stars) + (hasHalfStar ? '\u00bd' : '');
    }

    getMinimumStarsLabel(value) {
        const safeMinimumStars = this.normalizeMinimumStars(value);
        const stars = '\u2605'.repeat(safeMinimumStars);
        return safeMinimumStars >= this.maximumStars
            ? stars
            : `${stars}+`;
    }

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

    async loadFilteredGames(anchorDate, filterConfig) {
        const requestId = ++this.loadRequestId;
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
        const teamName = filterConfig?.teamName || this.getTeamSelectionLabel(teamSelections);
        const hasAllSelection = teamSelections.includes('all');
        const selectedTeamIds = teamSelections
            .filter((selection) => selection !== 'all')
            .map((selection) => Number.parseInt(selection, 10))
            .filter((teamId) => Number.isFinite(teamId));

        try {
            this.showLoading();
            this.setStandingsLoadingState(anchorDate, API.inferSeasonFromDate(anchorDate));

            const scoreboardData = await API.fetchGamesInRange(range.startDate, range.endDate, {
                teamIds: hasAllSelection ? [] : selectedTeamIds
            });

            if (requestId !== this.loadRequestId) {
                return false;
            }

            this.updateStandingsData(scoreboardData?.standingsByTeamId, scoreboardData?.standingsSeason, anchorDate);

            let games = Parser.processGames(scoreboardData)
                .filter((game) => !game?.isFuture);

            // Keep a local team filter pass so behavior remains stable if API-side params change.
            if (!hasAllSelection && selectedTeamIds.length > 0) {
                games = games.filter((game) => (
                    selectedTeamIds.some((teamId) => (
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

            await this.displayGames({
                logDebug: this.debugEnabled,
                debugPhase: 'period-filter'
            });

            if (requestId !== this.loadRequestId) {
                return false;
            }

            return true;
        } catch (error) {
            if (requestId !== this.loadRequestId) {
                return false;
            }

            console.error('Error loading filtered NHL games:', error);
            this.markStandingsUnavailable(anchorDate, API.inferSeasonFromDate(anchorDate));
            this.showError(error.message || 'Failed to apply NHL game filter');
            this.hideLoading();
            return false;
        }
    }

    clearPeriodFilter() {
        if (!this.activePeriodFilter) {
            return;
        }

        this.activePeriodFilter = null;
        this.updatePeriodFilterBadge();

        if (this.elements.periodFilterDaysInput) {
            this.elements.periodFilterDaysInput.value = String(this.defaultLookbackDays);
        }

        this.setSelectedTeamSelectionsInControl(['all']);

        if (this.elements.periodFilterMinStarsSelect) {
            this.elements.periodFilterMinStarsSelect.value = String(this.defaultMinimumStars);
        }

        void this.handleLoadGames();
    }

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

    normalizeConferenceLabel(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized.startsWith('east')) {
            return 'Eastern Conference';
        }

        if (normalized.startsWith('west')) {
            return 'Western Conference';
        }

        return normalized ? String(value).trim() : 'League';
    }

    formatSeasonLabel(seasonValue) {
        const season = Number.parseInt(seasonValue, 10);
        if (!Number.isFinite(season) || season <= 0) {
            return '';
        }

        const seasonStart = season - 1;
        const seasonEndSuffix = String(season).slice(-2);
        return `${seasonStart}-${seasonEndSuffix}`;
    }

    formatStandingsWinPct(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric) || numeric < 0) {
            return '--';
        }

        return numeric.toFixed(3).replace(/^0/, '');
    }

    formatStandingsGamesBehind(value) {
        const normalized = String(value ?? '').trim();
        return normalized || '--';
    }

    formatStandingsPoints(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return '--';
        }

        return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
    }

    normalizeStandingsDisplayMode(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'playoff-picture') {
            return normalized;
        }

        return 'standings';
    }

    renderStandingsModeControl() {
        if (!this.elements.standingsTableState || !this.elements.standingsTableContainer) {
            return;
        }

        const standingsContent = this.elements.standingsTableState.parentElement;
        if (!standingsContent) {
            return;
        }

        let controlsRow = standingsContent.querySelector('.standings-modal-controls-nhl');
        if (!controlsRow) {
            controlsRow = document.createElement('div');
            controlsRow.className = 'standings-modal-controls standings-modal-controls-nhl';
            standingsContent.insertBefore(controlsRow, this.elements.standingsTableState);
        }

        let control = controlsRow.querySelector('.standings-league-switch-nhl');
        if (!control) {
            control = document.createElement('div');
            control.className = 'standings-league-switch standings-league-switch-nhl';
            control.setAttribute('role', 'group');
            control.setAttribute('aria-label', 'NHL standings display mode');

            [
                { value: 'standings', label: 'Standings' },
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

                const teamInfo = Utils.getTeamInfo(numericTeamId, {
                    abbreviation: standing?.abbreviation,
                    name: standing?.teamName,
                    city: standing?.city
                });
                const conferenceRank = Number.parseInt(standing?.conferenceRank, 10);
                const divisionRank = Number.parseInt(standing?.divisionRank, 10);
                const wins = Number.parseInt(standing?.wins, 10);
                const losses = Number.parseInt(standing?.losses, 10);

                return {
                    teamId: numericTeamId,
                    teamName: String(standing?.teamName || teamInfo.name || '').trim(),
                    abbreviation: String(standing?.abbreviation || teamInfo.abbreviation || '').trim(),
                    conference: this.normalizeConferenceLabel(standing?.conference),
                    conferenceRank: Number.isFinite(conferenceRank) && conferenceRank > 0 ? conferenceRank : Number.MAX_SAFE_INTEGER,
                    division: String(standing?.division || '').trim(),
                    divisionRank: Number.isFinite(divisionRank) && divisionRank > 0 ? divisionRank : null,
                    wins: Number.isFinite(wins) ? wins : 0,
                    losses: Number.isFinite(losses) ? losses : 0,
                    winPct: standing?.winPct,
                    gamesBehind: standing?.gamesBehind,
                    points: standing?.points,
                    highlights: highlightsByTeamId.get(String(numericTeamId)) || []
                };
            })
            .filter(Boolean)
            .sort((left, right) => {
                if (left.conference !== right.conference) {
                    return left.conference.localeCompare(right.conference);
                }

                if (left.conferenceRank !== right.conferenceRank) {
                    return left.conferenceRank - right.conferenceRank;
                }

                const leftPoints = Number.parseInt(left.points, 10);
                const rightPoints = Number.parseInt(right.points, 10);
                if (Number.isFinite(leftPoints) && Number.isFinite(rightPoints) && leftPoints !== rightPoints) {
                    return rightPoints - leftPoints;
                }

                if (left.wins !== right.wins) {
                    return right.wins - left.wins;
                }

                if (left.losses !== right.losses) {
                    return left.losses - right.losses;
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
            rankCell.textContent = row.conferenceRank === Number.MAX_SAFE_INTEGER ? '--' : String(row.conferenceRank);
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

    buildNhlPlayoffPictureGroups(standingsRows = []) {
        if (!Array.isArray(standingsRows) || standingsRows.length === 0) {
            return [];
        }

        const conferenceOrder = ['Eastern Conference', 'Western Conference'];

        const groupedByConference = standingsRows.reduce((groups, row) => {
            if (!groups.has(row.conference)) {
                groups.set(row.conference, []);
            }

            groups.get(row.conference).push(row);
            return groups;
        }, new Map());

        return Array.from(groupedByConference.entries())
            .sort((left, right) => {
                const leftIndex = conferenceOrder.indexOf(left[0]);
                const rightIndex = conferenceOrder.indexOf(right[0]);

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
            .map(([conference, conferenceRows]) => {
                const ordered = conferenceRows
                    .slice()
                    .sort((left, right) => {
                        if (left.conferenceRank !== right.conferenceRank) {
                            return left.conferenceRank - right.conferenceRank;
                        }

                        const leftPoints = Number.parseInt(left.points, 10);
                        const rightPoints = Number.parseInt(right.points, 10);
                        if (Number.isFinite(leftPoints) && Number.isFinite(rightPoints) && leftPoints !== rightPoints) {
                            return rightPoints - leftPoints;
                        }

                        return left.teamName.localeCompare(right.teamName);
                    })
                    .slice(0, 8);

                const seedMap = new Map();
                ordered.forEach((row, index) => {
                    const parsedRank = Number.parseInt(row?.conferenceRank, 10);
                    const seed = Number.isFinite(parsedRank) && parsedRank > 0 && parsedRank <= 8
                        ? parsedRank
                        : index + 1;
                    if (!seedMap.has(seed)) {
                        seedMap.set(seed, row);
                    }
                });

                return {
                    title: conference,
                    seedMap
                };
            });
    }

    getNhlBracketTeamDisplay(seedMap, seedNumber, options = {}) {
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
        const normalizedAbbreviation = abbreviation.slice(0, 3);
        const includeSeedPrefix = options.includeSeedPrefix !== false;
        const rankLabel = includeSeedPrefix ? `${seedNumber}.` : '';
        const resolvedAbbreviation = normalizedAbbreviation
            || String(row.teamName || '').trim().slice(0, 3).toUpperCase()
            || 'TBD';
        const label = includeSeedPrefix
            ? `${rankLabel} ${resolvedAbbreviation}`
            : resolvedAbbreviation;
        const teamId = Number.parseInt(row?.teamId, 10);

        return {
            label,
            rankLabel,
            abbreviation: resolvedAbbreviation,
            logoUrl: Number.isFinite(teamId) && teamId > 0 ? Utils.getTeamLogoUrl(teamId) : null
        };
    }

    createNhlBracketMatchCard({ title, topTeam, bottomTeam, note = '', flowLines = [] }) {
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

    createNhlPlayoffPictureSection(title, seedMap) {
        const section = document.createElement('section');
        section.className = 'standings-conference panel-surface';
        const isWesternConference = /western/i.test(String(title || ''));

        const heading = document.createElement('h4');
        heading.textContent = title;
        section.appendChild(heading);

        const bracket = document.createElement('div');
        bracket.className = 'standings-playoff-bracket standings-playoff-bracket-nhl';
        if (isWesternConference) {
            bracket.classList.add('standings-playoff-bracket-west');
        }

        const bracketMeta = document.createElement('p');
        bracketMeta.className = 'standings-playoff-bracket-meta';
        bracketMeta.textContent = 'Projected conference bracket from current standings seeds.';
        bracket.appendChild(bracketMeta);

        const rounds = document.createElement('div');
        rounds.className = 'standings-playoff-rounds';
        if (isWesternConference) {
            rounds.classList.add('standings-playoff-rounds-reverse');
        }

        const firstRound = document.createElement('section');
        firstRound.className = 'standings-playoff-round standings-playoff-round--round1';
        const firstRoundHeading = document.createElement('h5');
        firstRoundHeading.textContent = 'Round 1';
        firstRound.appendChild(firstRoundHeading);
        firstRound.appendChild(this.createNhlBracketMatchCard({
            title: 'Matchup A (1 vs 8)',
            topTeam: this.getNhlBracketTeamDisplay(seedMap, 1),
            bottomTeam: this.getNhlBracketTeamDisplay(seedMap, 8),
            note: 'Best of 7',
            flowLines: ['Winner -> Round 2 Matchup 1']
        }));
        firstRound.appendChild(this.createNhlBracketMatchCard({
            title: 'Matchup B (2 vs 7)',
            topTeam: this.getNhlBracketTeamDisplay(seedMap, 2),
            bottomTeam: this.getNhlBracketTeamDisplay(seedMap, 7),
            note: 'Best of 7',
            flowLines: ['Winner -> Round 2 Matchup 1']
        }));
        firstRound.appendChild(this.createNhlBracketMatchCard({
            title: 'Matchup C (3 vs 6)',
            topTeam: this.getNhlBracketTeamDisplay(seedMap, 3),
            bottomTeam: this.getNhlBracketTeamDisplay(seedMap, 6),
            note: 'Best of 7',
            flowLines: ['Winner -> Round 2 Matchup 2']
        }));
        firstRound.appendChild(this.createNhlBracketMatchCard({
            title: 'Matchup D (4 vs 5)',
            topTeam: this.getNhlBracketTeamDisplay(seedMap, 4),
            bottomTeam: this.getNhlBracketTeamDisplay(seedMap, 5),
            note: 'Best of 7',
            flowLines: ['Winner -> Round 2 Matchup 2']
        }));

        const secondRound = document.createElement('section');
        secondRound.className = 'standings-playoff-round standings-playoff-round--round2';
        const secondRoundHeading = document.createElement('h5');
        secondRoundHeading.textContent = 'Round 2';
        secondRound.appendChild(secondRoundHeading);
        secondRound.appendChild(this.createNhlBracketMatchCard({
            title: 'Round 2 Matchup 1',
            topTeam: 'Winner of Matchup A',
            bottomTeam: 'Winner of Matchup B',
            note: 'Best of 7'
        }));
        secondRound.appendChild(this.createNhlBracketMatchCard({
            title: 'Round 2 Matchup 2',
            topTeam: 'Winner of Matchup C',
            bottomTeam: 'Winner of Matchup D',
            note: 'Best of 7'
        }));

        if (isWesternConference) {
            rounds.appendChild(secondRound);
            rounds.appendChild(firstRound);
        } else {
            rounds.appendChild(firstRound);
            rounds.appendChild(secondRound);
        }
        bracket.appendChild(rounds);
        section.appendChild(bracket);

        return section;
    }

    renderStandingsTable() {
        this.renderStandingsModeControl();

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
                subtitleParts.push('Projected playoff bracket based on current conference seeds.');
            }

            this.elements.standingsModalSubtitle.textContent = subtitleParts.length > 0
                ? subtitleParts.join(' | ')
                : 'Season standings for the selected date.';
        }

        if (!this.elements.standingsTableContainer || !this.elements.standingsTableState) {
            return;
        }

        this.elements.standingsTableContainer.innerHTML = '';

        const displayMode = this.normalizeStandingsDisplayMode(this.standingsDisplayMode);
        const standingsRows = this.buildStandingsRows();
        if (this.standingsLoading) {
            this.elements.standingsTableState.textContent = 'Loading NHL standings...';
            this.elements.standingsTableState.classList.remove('hidden');
            this.elements.standingsTableContainer.classList.add('hidden');
            return;
        }

        if (standingsRows.length === 0) {
            this.elements.standingsTableState.textContent = 'NHL standings are unavailable for the selected date.';
            this.elements.standingsTableState.classList.remove('hidden');
            this.elements.standingsTableContainer.classList.add('hidden');
            return;
        }

        if (displayMode === 'playoff-picture') {
            this.elements.standingsTableContainer.classList.add('standings-grid-leagues');
            const playoffGroups = this.buildNhlPlayoffPictureGroups(standingsRows);

            if (playoffGroups.length === 0) {
                this.elements.standingsTableState.textContent = 'NHL standings are unavailable for the selected date.';
                this.elements.standingsTableState.classList.remove('hidden');
                this.elements.standingsTableContainer.classList.add('hidden');
                return;
            }

            playoffGroups.forEach((group) => {
                this.elements.standingsTableContainer.appendChild(
                    this.createNhlPlayoffPictureSection(group.title, group.seedMap)
                );
            });

            this.elements.standingsTableState.classList.add('hidden');
            this.elements.standingsTableContainer.classList.remove('hidden');
            return;
        }

        this.elements.standingsTableContainer.classList.remove('standings-grid-leagues');

        const groupedRows = standingsRows.reduce((groups, row) => {
            if (!groups.has(row.conference)) {
                groups.set(row.conference, []);
            }

            groups.get(row.conference).push(row);
            return groups;
        }, new Map());
        const preferredOrder = ['Eastern Conference', 'Western Conference', 'League'];
        const orderedTitles = Array.from(groupedRows.keys()).sort((left, right) => {
            const leftIndex = preferredOrder.indexOf(left);
            const rightIndex = preferredOrder.indexOf(right);

            if (leftIndex === -1 && rightIndex === -1) {
                return left.localeCompare(right);
            }

            if (leftIndex === -1) {
                return 1;
            }

            if (rightIndex === -1) {
                return -1;
            }

            return leftIndex - rightIndex;
        });

        orderedTitles.forEach((title) => {
            const rows = groupedRows.get(title) || [];
            this.elements.standingsTableContainer.appendChild(this.createStandingsSection(title, rows));
        });

        this.elements.standingsTableState.classList.add('hidden');
        this.elements.standingsTableContainer.classList.remove('hidden');
    }
    async handleLoadGames() {
        const date = this.elements.gameDate?.value;
        if (!date) {
            this.showError('Please select a date');
            return;
        }

        this.setStandingsLoadingState(date, API.inferSeasonFromDate(date));

        if (this.activePeriodFilter) {
            await this.loadFilteredGames(date, this.activePeriodFilter);
            return;
        }

        const requestId = ++this.loadRequestId;

        try {
            this.showLoading();

            const scoreboardData = await API.fetchScoreboard(date);

            if (requestId !== this.loadRequestId) {
                return;
            }

            this.updateStandingsData(scoreboardData?.standingsByTeamId, scoreboardData?.standingsSeason, date);

            let games = Parser.processGames(scoreboardData);

            if (!Array.isArray(games) || games.length === 0) {
                this.games = [];
                this.showNoGames();
                return;
            }

            this.registerTeamsFromGames(games);
            this.games = games;
            this.isFutureGames = games.some((game) => game?.isFuture);
            this.renderStandingsTable();
            await this.displayGames({
                logDebug: this.debugEnabled,
                debugPhase: 'initial-load'
            });

            void this.enrichCompletedGames(requestId);
        } catch (error) {
            if (requestId !== this.loadRequestId) {
                return;
            }

            this.markStandingsUnavailable(date, API.inferSeasonFromDate(date));

            const errorMessage = String(error?.message || '');
            const errorStatus = Number(error?.status);
            const isTimeoutError = /timed out|gateway timeout/i.test(errorMessage)
                || errorStatus === 408
                || errorStatus === 504;
            const isServerOffline = /unable to reach NHL api|failed to fetch|network error|connection/i.test(errorMessage)
                || errorStatus === 0;
            const isAuthError = (
                /api key|authorization|unauthorized|forbidden|invalid/i.test(errorMessage)
                || errorStatus === 401
                || errorStatus === 403
            );
            const isRateLimitError = /rate limit|too many requests|quota|limit/i.test(errorMessage)
                || errorStatus === 429;
            const isBadRequest = errorStatus === 400 || errorStatus === 422;

            if (isTimeoutError) {
                console.error('Error loading NHL games:', error);
                this.showError('ESPN NHL request timed out. Retry in a moment.');
                return;
            }

            if (isServerOffline) {
                console.error('Error loading NHL games:', error);
                this.showError('ESPN NHL service is not reachable from this browser right now. Check network/CORS and retry.');
                return;
            }

            if (isAuthError) {
                console.error('Error loading NHL games:', error);
                this.showError('ESPN NHL request was denied. Verify endpoint access and retry.');
                return;
            }

            if (isRateLimitError) {
                console.error('Error loading NHL games:', error);
                this.showError('ESPN NHL rate limit reached. Wait for reset or reduce request frequency.');
                return;
            }

            if (isBadRequest) {
                console.error('Error loading NHL games:', error);
                this.showError('ESPN rejected the NHL query parameters. Check date format and try again.');
                return;
            }

            console.error('Error loading NHL games:', error);
            this.showError(error.message || 'Unable to load NHL games from ESPN.');
        }
    }

    /**
     * Enrich completed games with deeper NHL stats in the background.
     * @param {number} requestId - Active load request id
     */
    async enrichCompletedGames(requestId) {
        const completedGames = this.games.filter((game) => !game?.isFuture);
        if (completedGames.length === 0) {
            return;
        }

        try {
            const enhancedGames = await Parser.enhanceGamesWithDetailedData(completedGames);

            if (requestId !== this.loadRequestId) {
                return;
            }

            const enhancedById = new Map();
            enhancedGames.forEach((game) => {
                enhancedById.set(String(game.id), game);
            });

            this.games = this.games.map((game) => enhancedById.get(String(game.id)) || game);
            await this.displayGames({
                logDebug: this.debugEnabled,
                debugPhase: 'enhancement-pass'
            });
        } catch (error) {
            console.warn('NHL enhancement pass failed:', error);
        }
    }

    async displayGames(config = {}) {
        const shouldLogDebug = Boolean(config?.logDebug);
        const debugPhase = String(config?.debugPhase || 'ui-refresh');

        this.hideLoading();

        if (!Array.isArray(this.games) || this.games.length === 0) {
            this.showNoGames();
            return;
        }

        if (!this.elements.gamesList) {
            return;
        }

        this.elements.gamesList.innerHTML = '';
        this.gameCards.clear();

        const rankingOptions = this.getRankingOptions();
        let displayGames = this.games;
        let rankByGameId = null;
        let rankedGamesForDebug = [];

        if (!this.isFutureGames) {
            displayGames = Ranker.rankGames(this.games, rankingOptions);
            rankedGamesForDebug = displayGames;

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
            rankByGameId = new Map();
            rankedGamesForDebug = rankedCompletedGames;
            const futureOrLiveGames = displayGames.filter((game) => game?.isFuture);

            rankedCompletedGames.forEach((game, index) => {
                const key = String(game.id);
                rankByGameId.set(key, index + 1);
            });

            displayGames = [...rankedCompletedGames, ...futureOrLiveGames];
        }

        if (shouldLogDebug) {
            this.logRankingDebugInfo(displayGames, rankingOptions, {
                debugPhase,
                totalLoadedGames: this.games.length,
                renderedGames: displayGames.length,
                includesFutureGames: this.isFutureGames,
                rankedGamesCount: rankedGamesForDebug.length,
                rankByGameId
            });
        }

        if (displayGames.length === 0) {
            this.showNoGames();
            return;
        }

        const shouldUseTipoffHeader = this.isFutureGames
            && displayGames.length > 0
            && displayGames.every((game) => game?.isFuture);
        const usePlayedDateColumn = Boolean(this.activePeriodFilter) && !this.isFutureGames;

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'games-table-wrapper';

        const table = document.createElement('table');
        table.className = 'games-table';

        table.innerHTML = `
            <thead>
                <tr>
                    <th class="th-rank">#</th>
                    <th>Matchup</th>
                    ${usePlayedDateColumn ? '<th class="th-played-date">Date</th>' : ''}
                    <th class="th-game-type">Type</th>
                    <th>Rating</th>
                    <th>${shouldUseTipoffHeader ? 'Faceoff @' : 'Status'}</th>
                    <th class="th-expand">Details</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');
        tbody.className = 'games-table-body';

        displayGames.forEach((game, index) => {
            const key = String(game.id);
            const rank = rankByGameId
                ? (rankByGameId.get(key) || '-')
                : index + 1;

            const row = new GameTableRow(game, {
                rank,
                index,
                isFuture: this.isFutureGames,
                showPlayedDate: usePlayedDateColumn
            });

            const renderedRows = row.render();
            tbody.appendChild(renderedRows);
            this.gameCards.set(key, row);
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        this.elements.gamesList.appendChild(tableWrapper);

        this.elements.gamesList.classList.remove('hidden');
        this.elements.noGames?.classList.add('hidden');
        this.elements.errorMessage?.classList.add('hidden');
    }

    getRankingOptions() {
        return Object.entries(this.elements.filters).reduce((options, [key, element]) => {
            options[key] = Boolean(element?.checked);
            return options;
        }, {});
    }

    buildMatchupLabel(game) {
        const away = String(game?.awayTeam?.abbreviation || game?.awayTeam?.name || 'AWAY');
        const home = String(game?.homeTeam?.abbreviation || game?.homeTeam?.name || 'HOME');
        return `${away} @ ${home}`;
    }

    logRankingDebugInfo(gamesForDebug, rankingOptions, context = {}) {
        const selectedDate = this.elements.gameDate?.value || 'unknown-date';
        const debugPhase = String(context?.debugPhase || 'load');
        const totalLoadedGames = Number(context?.totalLoadedGames) || 0;
        const renderedGames = Number(context?.renderedGames) || 0;
        const includesFutureGames = Boolean(context?.includesFutureGames);
        const rankedGamesCount = Number(context?.rankedGamesCount) || 0;
        const rankByGameId = context?.rankByGameId instanceof Map
            ? context.rankByGameId
            : null;

        console.group(`[NHL Ranking Debug] ${debugPhase} | ${selectedDate}`);
        console.log('Ranking options:', rankingOptions);
        console.log('Ranking weights:', Ranker.weights);
        console.log('Context:', {
            totalLoadedGames,
            renderedGames,
            rankedGamesCount,
            includesFutureGames
        });

        if (!Array.isArray(gamesForDebug) || gamesForDebug.length === 0) {
            console.log('No games available for ranking debug output in this load phase.');
            console.groupEnd();
            return;
        }

        const summaryRows = gamesForDebug.map((game, index) => {
            const gameId = String(game?.id || '');
            const isFuture = Boolean(game?.isFuture);
            const rankingDetails = isFuture
                ? null
                : (game?.rankingDetails || Ranker.calculateGameScoreDetails(game, rankingOptions));
            const rank = rankByGameId
                ? (rankByGameId.get(gameId) || (isFuture ? '-' : index + 1))
                : (isFuture ? '-' : index + 1);

            return {
                rowOrder: index + 1,
                rank,
                gameId,
                matchup: this.buildMatchupLabel(game),
                status: String(game?.status || ''),
                isFuture,
                totalRanking: rankingDetails ? rankingDetails.totalScore : null,
                weightedScore: rankingDetails ? rankingDetails.weightedScore : null,
                maxPossibleScore: rankingDetails ? rankingDetails.maxPossibleScore : null
            };
        });

        console.table(summaryRows);

        gamesForDebug.forEach((game, index) => {
            const isFuture = Boolean(game?.isFuture);
            const rankingDetails = isFuture
                ? null
                : (game?.rankingDetails || Ranker.calculateGameScoreDetails(game, rankingOptions));
            const matchupLabel = this.buildMatchupLabel(game);
            const gameId = String(game?.id || '');
            const rank = rankByGameId
                ? (rankByGameId.get(gameId) || (isFuture ? '-' : index + 1))
                : (isFuture ? '-' : index + 1);

            console.group(`[Game ${index + 1}] ${matchupLabel} | rank=${rank}`);
            console.log('Game metadata:', {
                gameId,
                status: String(game?.status || ''),
                isFuture,
                gameType: String(game?.gameType || ''),
                venue: String(game?.venue || ''),
                totalPoints: Number(game?.totalPoints) || 0,
                scoreMargin: Number(game?.scoreMargin) || 0
            });

            if (isFuture) {
                console.log('Ranking skipped for future game. No total ranking is calculated yet.');
                console.groupEnd();
                return;
            }

            console.log('Raw ranking parameter values:', rankingDetails.rawMetrics);

            const factorRows = Object.values(rankingDetails?.factors || {}).map((factor) => ({
                factor: factor.label,
                optionKey: factor.optionKey,
                enabled: factor.enabled,
                available: factor.available,
                usedInTotal: factor.usedInTotal,
                normalizedScore: factor.normalizedScore,
                weight: factor.weight,
                weightedContribution: factor.weightedContribution,
                metrics: JSON.stringify(factor.metrics)
            }));

            console.table(factorRows);
            Object.entries(rankingDetails?.factors || {}).forEach(([factorKey, factor]) => {
                console.log(`Factor detail [${factorKey}]`, factor);
            });
            console.log('Total ranking calculation:', {
                totalRanking: rankingDetails.totalScore,
                weightedScore: rankingDetails.weightedScore,
                maxPossibleScore: rankingDetails.maxPossibleScore
            });
            console.log('Full ranking details object:', rankingDetails);
            console.groupEnd();
        });

        console.groupEnd();
    }

    loadRankingOptionsFromStorage() {
        try {
            const savedOptions = localStorage.getItem(this.rankingOptionsStorageKey);
            if (!savedOptions) {
                return;
            }

            const parsed = JSON.parse(savedOptions);
            if (!parsed || typeof parsed !== 'object') {
                return;
            }

            Object.entries(this.elements.filters).forEach(([key, element]) => {
                if (!element) {
                    return;
                }

                if (typeof parsed[key] === 'boolean') {
                    element.checked = parsed[key];
                }
            });
        } catch (error) {
            console.warn('Unable to load NHL ranking options from storage:', error);
        }
    }

    saveRankingOptionsToStorage() {
        try {
            localStorage.setItem(this.rankingOptionsStorageKey, JSON.stringify(this.getRankingOptions()));
        } catch (error) {
            console.warn('Unable to save NHL ranking options to storage:', error);
        }
    }

    refreshGameRankings() {
        if (this.games.length && (!this.isFutureGames || this.isMixedScheduleView())) {
            void this.displayGames({
                logDebug: false,
                debugPhase: 'filter-change'
            });
        }
    }

    isMixedScheduleView(games = this.games) {
        if (!this.isFutureGames || !Array.isArray(games) || games.length === 0) {
            return false;
        }

        return games.some((game) => !game?.isFuture);
    }

    showLoading() {
        this.elements.loading?.classList.remove('hidden');
        this.elements.gamesList?.classList.add('hidden');
        this.elements.errorMessage?.classList.add('hidden');
        this.elements.noGames?.classList.add('hidden');
    }

    hideLoading() {
        this.elements.loading?.classList.add('hidden');
    }

    showError(message) {
        this.hideLoading();

        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.classList.remove('hidden');
        }

        this.elements.gamesList?.classList.add('hidden');
        this.elements.noGames?.classList.add('hidden');
    }

    showNoGames() {
        this.hideLoading();

        if (this.elements.noGames) {
            this.elements.noGames.textContent = this.activePeriodFilter
                ? 'No completed NHL games found for the selected filter.'
                : this.defaultNoGamesMessage;
            this.elements.noGames.classList.remove('hidden');
        }

        this.elements.gamesList?.classList.add('hidden');
        this.elements.errorMessage?.classList.add('hidden');
    }

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

        if (shouldOpen && this.elements.standingsModal) {
            this.elements.standingsModal.classList.add('hidden');
            if (this.elements.openStandingsBtn) {
                this.elements.openStandingsBtn.setAttribute('aria-expanded', 'false');
            }
        }

        this.elements.filtersContainer.classList.toggle('hidden', !shouldOpen);

        if (this.elements.toggleFiltersBtn) {
            this.elements.toggleFiltersBtn.setAttribute('aria-expanded', String(shouldOpen));
        }

        this.updateModalBodyState();
    }

    isModalOpen(modalElement) {
        return Boolean(modalElement && !modalElement.classList.contains('hidden'));
    }

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
            this.setSelectedTeamSelectionsInControl(activeTeamSelections);

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

    updateModalBodyState() {
        const anyOpen = this.isModalOpen(this.elements.filtersContainer)
            || this.isModalOpen(this.elements.periodFilterModal)
            || this.isModalOpen(this.elements.standingsModal);
        document.body.classList.toggle('modal-open', anyOpen);
    }
}

export default new UI();

