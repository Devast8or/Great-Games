import { API } from '../api.js';
import LineupDisplay from './LineupDisplay.js';
import PitcherDisplay from './PitcherDisplay.js';

class GameTableRow {
    static openInstance = null;

    constructor(game, options = {}) {
        this.game = game;
        this.options = options;

        const safeId = String(this.game.id).replace(/[^a-zA-Z0-9_-]/g, '');
        this.detailsId = `game-details-${safeId}`;

        this.mainRow = null;
        this.detailsRow = null;
        this.detailsContainer = null;
        this.expandIcon = null;
        this.revealBtn = null;
        this.halfInningBtn = null;
        this.scoreElement = null;
        this.loadingLabel = null;
        this.lineupsContainer = null;

        this.scoreRevealMode = 'hidden';
        this.revealedHalfInnings = 0;
        this.totalHalfInnings = 0;
        this.boxScoreState = null;

        this.pitchersLoaded = false;
        this.lineupsLoaded = false;
        this.loadingDetails = false;
        this.pitcherHighlightImagesLoaded = false;
        this.pitcherHighlightImages = { away: null, home: null };
    }

    render() {
        const fragment = document.createDocumentFragment();

        this.mainRow = this.createMainRow();
        this.detailsRow = this.createDetailsRow();

        fragment.appendChild(this.mainRow);
        fragment.appendChild(this.detailsRow);

        return fragment;
    }

    createMainRow() {
        const row = document.createElement('tr');
        row.className = 'game-row';
        if (typeof this.options.index === 'number') {
            row.classList.add(this.options.index % 2 === 0 ? 'row-even' : 'row-odd');
        }
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-expanded', 'false');
        row.setAttribute('aria-controls', this.detailsId);
        row.setAttribute('aria-label', `Show details for ${this.game.awayTeam.name} at ${this.game.homeTeam.name}`);

        const rankCell = document.createElement('td');
        rankCell.className = 'col-rank';
        rankCell.textContent = this.options.rank || '-';

        const matchupCell = document.createElement('td');
        matchupCell.className = 'col-matchup';
        matchupCell.appendChild(this.createMatchupElement());

        const contextCell = document.createElement('td');
        contextCell.className = 'col-context';

        if (this.options.showPlayedDate) {
            contextCell.classList.add('col-played-date');
            contextCell.textContent = this.getPlayedDateText();
        } else {
            contextCell.classList.add('col-venue');
            contextCell.textContent = this.game.venue || 'Unknown Venue';
        }

        contextCell.title = contextCell.textContent;

        const gameType = this.getGameTypeText();
        const gameTypeCell = document.createElement('td');
        gameTypeCell.className = 'col-game-type';
        gameTypeCell.textContent = gameType.label;
        gameTypeCell.title = gameType.title;

        const ratingCell = document.createElement('td');
        ratingCell.className = 'col-rating';
        ratingCell.textContent = this.game.isFuture ? '-' : this.getStarRating();

        const statusCell = document.createElement('td');
        statusCell.className = 'col-status';
        statusCell.textContent = this.getStatusText();
        statusCell.title = statusCell.textContent;

        const expandCell = document.createElement('td');
        expandCell.className = 'col-expand';
        this.expandIcon = document.createElement('span');
        this.expandIcon.className = 'row-expand-icon';
        this.expandIcon.textContent = '▼';
        expandCell.appendChild(this.expandIcon);

        row.appendChild(rankCell);
        row.appendChild(matchupCell);
        row.appendChild(contextCell);
        row.appendChild(gameTypeCell);
        row.appendChild(ratingCell);
        row.appendChild(statusCell);
        row.appendChild(expandCell);

        row.addEventListener('click', () => this.toggleDetails());
        row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.toggleDetails();
            }
        });

        return row;
    }

    createMatchupElement() {
        const container = document.createElement('div');
        container.className = 'table-matchup';

        container.appendChild(this.createTeamSummary(this.game.awayTeam, 'away'));

        const vs = document.createElement('span');
        vs.className = 'table-vs';
        vs.textContent = 'VS';
        container.appendChild(vs);

        container.appendChild(this.createTeamSummary(this.game.homeTeam, 'home'));

        return container;
    }

    createTeamSummary(team, side) {
        const wrapper = document.createElement('div');
        wrapper.className = `table-team ${side}`;

        const logo = document.createElement('img');
        logo.className = 'table-team-logo';
        logo.src = team.logoUrl;
        logo.alt = `${team.name} logo`;
        wrapper.appendChild(logo);

        const textWrap = document.createElement('div');
        textWrap.className = 'table-team-text';

        const name = document.createElement('div');
        name.className = 'table-team-name';
        name.textContent = team.name;
        textWrap.appendChild(name);

        if (team.record) {
            const record = document.createElement('div');
            record.className = 'table-team-record';
            record.textContent = `${team.record.wins}-${team.record.losses}`;
            textWrap.appendChild(record);
        }

        wrapper.appendChild(textWrap);

        return wrapper;
    }

    createDetailsRow() {
        const row = document.createElement('tr');
        row.className = 'game-details-row hidden';
        row.id = this.detailsId;

        const detailsCell = document.createElement('td');
        detailsCell.colSpan = 7;

        this.detailsContainer = document.createElement('div');
        this.detailsContainer.className = 'game-details-content';

        const actions = document.createElement('div');
        actions.className = 'game-details-actions';

        const left = document.createElement('div');
        left.className = 'details-meta';
        const detailsMetaText = `${this.game.awayTeam.name} @ ${this.game.homeTeam.name}`;
        const detailsSearchUrl = this.getSportsCultSearchUrl();

        if (detailsSearchUrl) {
            const link = document.createElement('a');
            link.className = 'details-meta-link';
            link.href = detailsSearchUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = detailsMetaText;
            link.title = `Search torrents for ${detailsMetaText}`;
            left.appendChild(link);
        } else {
            left.textContent = detailsMetaText;
        }

        actions.appendChild(left);

        const right = document.createElement('div');
        right.className = 'details-actions-right';

        if (this.game.isFuture) {
            const gameTime = document.createElement('div');
            gameTime.className = 'game-time';
            gameTime.textContent = this.game.gameTime || 'Scheduled';
            right.appendChild(gameTime);
        } else {
            this.revealBtn = document.createElement('button');
            this.revealBtn.className = 'reveal-btn table-reveal-btn';
            this.revealBtn.textContent = 'Reveal Full Score';
            this.revealBtn.setAttribute('aria-pressed', 'false');
            this.revealBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.toggleScore();
            });
            right.appendChild(this.revealBtn);

            this.halfInningBtn = document.createElement('button');
            this.halfInningBtn.className = 'reveal-btn table-reveal-btn table-half-inning-btn';
            this.halfInningBtn.setAttribute('aria-pressed', 'false');
            this.halfInningBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.revealNextHalfInning();
            });
            right.appendChild(this.halfInningBtn);
        }

        actions.appendChild(right);
        this.detailsContainer.appendChild(actions);

        this.scoreElement = document.createElement('div');
        this.scoreElement.className = 'score hidden';

        if (!this.game.isFuture) {
            this.renderBoxScore(this.scoreElement);
            this.updateScoreButtons();
        }

        this.detailsContainer.appendChild(this.scoreElement);

        this.loadingLabel = document.createElement('div');
        this.loadingLabel.className = 'game-details-loading hidden';
        this.loadingLabel.textContent = 'Loading...';
        this.detailsContainer.appendChild(this.loadingLabel);

        this.lineupsContainer = document.createElement('div');
        this.lineupsContainer.className = 'lineups-container table-lineups hidden';

        const lineupsRow = document.createElement('div');
        lineupsRow.className = 'lineups-row';

        ['away', 'home'].forEach((teamType) => {
            const teamColumn = document.createElement('div');
            teamColumn.className = `team-lineup-column ${teamType}-column`;

            const pitcherContainer = document.createElement('div');
            pitcherContainer.className = `pitcher-display ${teamType}-pitcher-display`;
            teamColumn.appendChild(pitcherContainer);

            const lineupContainer = document.createElement('div');
            lineupContainer.className = `lineup ${teamType}-lineup`;
            teamColumn.appendChild(lineupContainer);

            lineupsRow.appendChild(teamColumn);
        });

        this.lineupsContainer.appendChild(lineupsRow);
        this.detailsContainer.appendChild(this.lineupsContainer);

        detailsCell.appendChild(this.detailsContainer);
        row.appendChild(detailsCell);

        return row;
    }

    async toggleDetails() {
        const isHidden = this.detailsRow.classList.contains('hidden');

        if (isHidden) {
            if (GameTableRow.openInstance && GameTableRow.openInstance !== this) {
                GameTableRow.openInstance.collapse();
            }

            await this.expand();
            GameTableRow.openInstance = this;
        } else {
            this.collapse();

            if (GameTableRow.openInstance === this) {
                GameTableRow.openInstance = null;
            }
        }
    }

    async expand() {
        this.detailsRow.classList.remove('hidden');
        this.mainRow.classList.add('expanded');
        this.mainRow.setAttribute('aria-expanded', 'true');
        this.expandIcon.textContent = '▲';

        if (this.loadingDetails) {
            this.showDetailsLoading();
            return;
        }

        if (this.pitchersLoaded && this.lineupsLoaded && this.pitcherHighlightImagesLoaded) {
            this.hideDetailsLoading();
            return;
        }

        this.loadingDetails = true;
        this.showDetailsLoading();

        try {
            const loadingTasks = [];

            if (!this.pitchersLoaded) {
                loadingTasks.push(this.loadPitchersData());
            }

            if (!this.lineupsLoaded) {
                loadingTasks.push(this.loadLineupsData());
            }

            if (!this.pitcherHighlightImagesLoaded) {
                loadingTasks.push(this.loadPitcherHighlightImages());
            }

            await Promise.all(loadingTasks);

            this.renderPitchers(this.detailsContainer);
            this.renderLineups(this.detailsContainer);
            this.hideDetailsLoading();
        } catch (error) {
            console.error('Error loading game details:', error);
            this.game.awayTeam.lineup = this.game.awayTeam.lineup || [];
            this.game.homeTeam.lineup = this.game.homeTeam.lineup || [];
            this.renderPitchers(this.detailsContainer);
            this.renderLineups(this.detailsContainer);
            this.showDetailsError('Some information is Not Avaliable.');
        }

        this.loadingDetails = false;
    }

    showDetailsLoading() {
        if (this.loadingLabel) {
            this.loadingLabel.textContent = 'Loading...';
            this.loadingLabel.classList.remove('hidden', 'game-details-loading-error');
        }

        if (this.lineupsContainer) {
            this.lineupsContainer.classList.add('hidden');
        }
    }

    hideDetailsLoading() {
        if (this.loadingLabel) {
            this.loadingLabel.classList.add('hidden');
            this.loadingLabel.classList.remove('game-details-loading-error');
        }

        if (this.lineupsContainer) {
            this.lineupsContainer.classList.remove('hidden');
        }
    }

    showDetailsError(message) {
        if (this.loadingLabel) {
            this.loadingLabel.textContent = message;
            this.loadingLabel.classList.remove('hidden');
            this.loadingLabel.classList.add('game-details-loading-error');
        }

        if (this.lineupsContainer) {
            this.lineupsContainer.classList.remove('hidden');
        }
    }

    collapse() {
        this.detailsRow.classList.add('hidden');
        this.mainRow.classList.remove('expanded');
        this.mainRow.setAttribute('aria-expanded', 'false');
        this.expandIcon.textContent = '▼';
    }

    toggleScore() {
        if (!this.scoreElement || !this.revealBtn) {
            return;
        }

        if (this.scoreElement.classList.contains('hidden')) {
            this.showFullScore();
            return;
        }

        if (this.scoreRevealMode === 'half' && this.revealedHalfInnings < this.totalHalfInnings) {
            this.showFullScore();
            return;
        }

        this.hideScore();
    }

    showFullScore() {
        if (!this.scoreElement) {
            return;
        }

        this.scoreElement.classList.remove('hidden');
        this.scoreRevealMode = 'full';

        if (this.totalHalfInnings > 0) {
            this.revealedHalfInnings = this.totalHalfInnings;
            this.applyHalfInningReveal();
        }

        this.updateScoreButtons();
    }

    hideScore() {
        if (!this.scoreElement) {
            return;
        }

        this.scoreElement.classList.add('hidden');
        this.scoreRevealMode = 'hidden';
        this.updateScoreButtons();
    }

    revealNextHalfInning() {
        if (!this.scoreElement || this.game.isFuture) {
            return;
        }

        if (this.totalHalfInnings === 0) {
            this.showFullScore();
            return;
        }

        if (this.revealedHalfInnings >= this.totalHalfInnings) {
            this.revealedHalfInnings = 0;
        }

        this.revealedHalfInnings += 1;
        this.scoreRevealMode = 'half';
        this.scoreElement.classList.remove('hidden');

        this.applyHalfInningReveal();
        this.updateScoreButtons();
    }

    updateScoreButtons() {
        const isHidden = this.scoreElement ? this.scoreElement.classList.contains('hidden') : true;

        if (this.revealBtn) {
            this.revealBtn.setAttribute('aria-pressed', String(!isHidden));

            if (isHidden) {
                this.revealBtn.textContent = 'Reveal Full Score';
            } else if (this.scoreRevealMode === 'half' && this.revealedHalfInnings < this.totalHalfInnings) {
                this.revealBtn.textContent = 'Reveal Full Score';
            } else {
                this.revealBtn.textContent = 'Hide Score';
            }
        }

        if (!this.halfInningBtn) {
            return;
        }

        if (this.revealedHalfInnings >= this.totalHalfInnings && this.totalHalfInnings > 0) {
            this.halfInningBtn.textContent = 'Reveal Half Inning';
            this.halfInningBtn.setAttribute('aria-label', 'Reveal Top 1 and update score');
            this.halfInningBtn.setAttribute('aria-pressed', 'false');
            return;
        }

        const nextHalfLabel = this.getHalfInningLabel(this.revealedHalfInnings + 1);
        this.halfInningBtn.textContent = this.revealedHalfInnings === 0
            ? 'Reveal Half Inning'
            : `Reveal ${nextHalfLabel}`;
        this.halfInningBtn.setAttribute('aria-label', `Reveal ${nextHalfLabel} and update score`);
        this.halfInningBtn.setAttribute('aria-pressed', 'false');
    }

    getHalfInningLabel(step) {
        if (this.totalHalfInnings <= 0) {
            return 'Next Half Inning';
        }

        const safeStep = Math.max(1, Math.min(step, this.totalHalfInnings));
        const inningNumber = Math.ceil(safeStep / 2);
        const halfName = safeStep % 2 === 1 ? 'Top' : 'Bottom';
        return `${halfName} ${inningNumber}`;
    }

    applyHalfInningReveal() {
        if (!this.boxScoreState) {
            return;
        }

        const revealAll = this.scoreRevealMode === 'full';
        const revealedHalfInnings = revealAll ? this.totalHalfInnings : this.revealedHalfInnings;
        let awayRuns = 0;
        let homeRuns = 0;
        let awayHits = 0;
        let homeHits = 0;
        let awayErrors = 0;
        let homeErrors = 0;

        this.game.inningScores.forEach((inning, inningIndex) => {
            const awayCell = this.boxScoreState.inningCells.away[inningIndex];
            const homeCell = this.boxScoreState.inningCells.home[inningIndex];
            const awayHalfIndex = inningIndex * 2 + 1;
            const homeHalfIndex = inningIndex * 2 + 2;
            const inningNumber = Number(inning?.inningNumber) || inningIndex + 1;
            const columnVisible = this.shouldShowInningColumn(inningNumber, revealAll, revealedHalfInnings);
            const awayVisible = columnVisible && (revealAll || revealedHalfInnings >= awayHalfIndex);
            const homeVisible = columnVisible && (revealAll || revealedHalfInnings >= homeHalfIndex);

            this.setInningColumnVisibility(inningIndex, columnVisible);

            this.setInningCellVisibility(awayCell, awayVisible);
            this.setInningCellVisibility(homeCell, homeVisible);

            if (awayVisible) {
                awayRuns += Number(awayCell?.dataset?.value || 0);
                awayHits += Number(inning?.awayHits || 0);
                awayErrors += Number(inning?.awayErrors || 0);
            }

            if (homeVisible) {
                homeRuns += Number(homeCell?.dataset?.value || 0);
                homeHits += Number(inning?.homeHits || 0);
                homeErrors += Number(inning?.homeErrors || 0);
            }
        });

        if (revealAll) {
            awayRuns = this.boxScoreState.finalTotals.away.runs;
            homeRuns = this.boxScoreState.finalTotals.home.runs;
            awayHits = this.boxScoreState.finalTotals.away.hits;
            homeHits = this.boxScoreState.finalTotals.home.hits;
            awayErrors = this.boxScoreState.finalTotals.away.errors;
            homeErrors = this.boxScoreState.finalTotals.home.errors;
        }

        this.setStatCellValue(this.boxScoreState.statCells.away.runs, awayRuns);
        this.setStatCellValue(this.boxScoreState.statCells.home.runs, homeRuns);
        this.setStatCellValue(this.boxScoreState.statCells.away.hits, awayHits);
        this.setStatCellValue(this.boxScoreState.statCells.away.errors, awayErrors);
        this.setStatCellValue(this.boxScoreState.statCells.home.hits, homeHits);
        this.setStatCellValue(this.boxScoreState.statCells.home.errors, homeErrors);

        this.boxScoreState.teamRows.away.classList.toggle('winner', awayRuns > homeRuns);
        this.boxScoreState.teamRows.home.classList.toggle('winner', homeRuns > awayRuns);
    }

    shouldShowInningColumn(inningNumber, revealAll, revealedHalfInnings) {
        if (revealAll || inningNumber <= 9) {
            return true;
        }

        // Keep extra-inning columns hidden until the previous inning is fully revealed.
        const previousInningFinalHalf = (inningNumber - 1) * 2;
        return revealedHalfInnings >= previousInningFinalHalf;
    }

    setInningColumnVisibility(inningIndex, isVisible) {
        if (!this.boxScoreState) {
            return;
        }

        const headerCell = this.boxScoreState.inningHeaderCells?.[inningIndex] || null;
        const awayCell = this.boxScoreState.inningCells.away[inningIndex] || null;
        const homeCell = this.boxScoreState.inningCells.home[inningIndex] || null;

        [headerCell, awayCell, homeCell].forEach((cell) => {
            if (!cell) {
                return;
            }

            cell.classList.toggle('inning-column-hidden', !isVisible);
        });
    }

    setInningCellVisibility(cell, isVisible) {
        if (!cell) {
            return;
        }

        cell.textContent = isVisible ? cell.dataset.value : '-';
        cell.classList.toggle('half-inning-hidden', !isVisible);
    }

    setStatCellValue(cell, value) {
        if (!cell) {
            return;
        }

        cell.textContent = String(value);
        cell.classList.toggle('stat-hidden', value === '-');
    }

    getGameTypeText() {
        const gameTypeCode = String(this.game?.gameType || 'R').toUpperCase();
        const seriesDescription = String(this.game?.seriesDescription || '').trim();
        const gameDescription = String(this.game?.description || '').trim();
        const hasWbcText = /world\s+baseball\s+classic/i.test(seriesDescription);
        const isExhibitionContext = gameTypeCode === 'E' || /exhibition/i.test(seriesDescription) || /exhibition/i.test(gameDescription);
        // WBC label is reserved for tournament games (special-event F), not WBC exhibition tune-ups.
        const isWorldBaseballClassic = hasWbcText && gameTypeCode === 'F' && !isExhibitionContext;

        if (isWorldBaseballClassic) {
            const detailText = [seriesDescription, gameDescription].filter(Boolean).join(' - ');
            return {
                label: 'WBC',
                title: `Game Type: ${detailText || 'World Baseball Classic'} (${gameTypeCode})`
            };
        }

        const gameTypeLabelMap = {
            R: 'Regular',
            S: 'Spring',
            F: 'Wild Card',
            D: 'Division',
            L: 'LCS',
            W: 'World Series',
            A: 'All-Star',
            E: 'Exhibition'
        };
        const label = gameTypeLabelMap[gameTypeCode] || gameTypeCode;
        const detailText = seriesDescription || label;

        return {
            label,
            title: `Game Type: ${detailText}${gameDescription ? ` - ${gameDescription}` : ''} (${gameTypeCode})`
        };
    }

    getStatusText() {
        const statusText = String(this.game.status || '').toLowerCase();
        const inProgressKeywords = [
            'progress',
            'delay',
            'warmup',
            'review',
            'challenge',
            'mid',
            'top',
            'bottom'
        ];

        if (this.game.isFuture) {
            if (inProgressKeywords.some((keyword) => statusText.includes(keyword))) {
                return 'In Progress';
            }

            if (statusText.includes('final')) {
                return 'Final';
            }

            return this.game.gameTime || 'Time TBD';
        }

        if (inProgressKeywords.some((keyword) => statusText.includes(keyword))) {
            return 'In Progress';
        }

        return 'Final';
    }

    getSportsCultSearchUrl() {
        if (this.options?.isFuture || this.game?.isFuture) {
            return null;
        }

        const playedDate = this.getSportsCultSearchDate();
        const awayTeamName = String(this.game?.awayTeam?.name || '').trim();

        if (!playedDate || !awayTeamName) {
            return null;
        }

        const searchText = `MLB ${playedDate} ${awayTeamName}`;
        const url = new URL('https://sportscult.org/index.php');
        url.searchParams.set('page', 'torrents');
        url.searchParams.set('search', searchText);
        url.searchParams.set('category', '0');
        url.searchParams.set('active', '1');
        url.searchParams.set('gold', '0');
        return url.toString();
    }

    getSportsCultSearchDate() {
        const knownDate = String(this.game?.playedDate || this.game?.officialDate || '').trim();
        const normalizedKnownDate = this.normalizeSearchDate(knownDate);

        if (normalizedKnownDate) {
            return normalizedKnownDate;
        }

        const parsedDate = this.game?.date ? new Date(this.game.date) : null;
        if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
            const year = String(parsedDate.getUTCFullYear());
            const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(parsedDate.getUTCDate()).padStart(2, '0');
            return `${day} ${month} ${year}`;
        }

        return null;
    }

    normalizeSearchDate(value) {
        if (!value) {
            return null;
        }

        const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) {
            const [, year, month, day] = isoMatch;
            return `${day} ${month} ${year}`;
        }

        if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
            return value.replace(/-/g, ' ');
        }

        if (/^\d{2}\s+\d{2}\s+\d{4}$/.test(value)) {
            return value.trim().replace(/\s+/g, ' ');
        }

        return null;
    }

    getPlayedDateText() {
        const playedDate = String(this.game?.playedDate || this.game?.officialDate || '').trim();
        if (playedDate) {
            return playedDate;
        }

        const parsedDate = this.game?.date ? new Date(this.game.date) : null;
        if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().split('T')[0];
        }

        return 'Unknown Date';
    }

    renderBoxScore(container) {
        container.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'box-score-table';
        const headerRow = document.createElement('tr');
        const inningHeaderCells = [];

        const teamHeaderCell = document.createElement('th');
        teamHeaderCell.className = 'team-header-cell';
        teamHeaderCell.scope = 'col';
        teamHeaderCell.setAttribute('aria-label', 'Team');
        headerRow.appendChild(teamHeaderCell);

        this.game.inningScores.forEach((inning) => {
            const inningHeaderCell = document.createElement('th');
            inningHeaderCell.className = 'inning-header-cell';
            inningHeaderCell.scope = 'col';
            inningHeaderCell.textContent = String(inning.inningNumber);
            headerRow.appendChild(inningHeaderCell);
            inningHeaderCells.push(inningHeaderCell);
        });

        const runsHeaderCell = document.createElement('th');
        runsHeaderCell.className = 'stat-header-cell stat-break-cell';
        runsHeaderCell.scope = 'col';
        runsHeaderCell.title = 'Runs';
        runsHeaderCell.textContent = 'R';
        headerRow.appendChild(runsHeaderCell);

        const hitsHeaderCell = document.createElement('th');
        hitsHeaderCell.className = 'stat-header-cell';
        hitsHeaderCell.scope = 'col';
        hitsHeaderCell.title = 'Hits';
        hitsHeaderCell.textContent = 'H';
        headerRow.appendChild(hitsHeaderCell);

        const errorsHeaderCell = document.createElement('th');
        errorsHeaderCell.className = 'stat-header-cell';
        errorsHeaderCell.scope = 'col';
        errorsHeaderCell.title = 'Errors';
        errorsHeaderCell.textContent = 'E';
        headerRow.appendChild(errorsHeaderCell);

        table.appendChild(headerRow);

        const boxScoreState = {
            inningHeaderCells,
            inningCells: {
                away: [],
                home: []
            },
            statCells: {
                away: {
                    runs: null,
                    hits: null,
                    errors: null
                },
                home: {
                    runs: null,
                    hits: null,
                    errors: null
                }
            },
            teamRows: {
                away: null,
                home: null
            },
            finalTotals: {
                away: {
                    runs: Number(this.game.awayTeam.score) || 0,
                    hits: Number(this.game.awayTeam.hits) || 0,
                    errors: Number(this.game.awayTeam.errors) || 0
                },
                home: {
                    runs: Number(this.game.homeTeam.score) || 0,
                    hits: Number(this.game.homeTeam.hits) || 0,
                    errors: Number(this.game.homeTeam.errors) || 0
                }
            }
        };

        ['away', 'home'].forEach((teamType) => {
            const team = this.game[teamType + 'Team'];
            const row = document.createElement('tr');

            const logoCell = document.createElement('td');
            logoCell.className = 'team-logo-cell';

            const logo = document.createElement('img');
            logo.className = 'score-team-logo';
            logo.src = team.logoUrl;
            logo.alt = team.name;
            logo.title = team.name;

            logoCell.appendChild(logo);
            row.appendChild(logoCell);

            this.game.inningScores.forEach((inning) => {
                const inningCell = document.createElement('td');
                inningCell.className = 'inning-cell';
                inningCell.dataset.value = String(inning[teamType] ?? 0);
                inningCell.textContent = inningCell.dataset.value;
                row.appendChild(inningCell);
                boxScoreState.inningCells[teamType].push(inningCell);
            });

            const runsCell = document.createElement('td');
            runsCell.className = 'runs-cell stat-cell stat-break-cell';
            runsCell.textContent = String(team.score ?? 0);
            row.appendChild(runsCell);
            boxScoreState.statCells[teamType].runs = runsCell;

            const hitsCell = document.createElement('td');
            hitsCell.className = 'stat-cell';
            hitsCell.textContent = String(team.hits ?? 0);
            row.appendChild(hitsCell);
            boxScoreState.statCells[teamType].hits = hitsCell;

            const errorsCell = document.createElement('td');
            errorsCell.className = 'stat-cell';
            errorsCell.textContent = String(team.errors ?? 0);
            row.appendChild(errorsCell);
            boxScoreState.statCells[teamType].errors = errorsCell;

            boxScoreState.teamRows[teamType] = row;

            table.appendChild(row);
        });

        container.appendChild(table);

        this.boxScoreState = boxScoreState;
        this.totalHalfInnings = this.game.inningScores.length * 2;
        this.revealedHalfInnings = 0;
        this.scoreRevealMode = 'hidden';
        this.applyHalfInningReveal();
    }

    getStarRating() {
        const score = this.game.excitementScore;
        if (!score && score !== 0) {
            return '-';
        }

        const stars = Math.max(1, Math.min(5, Math.floor(score / 20) + 1));
        const hasHalfStar = (score % 20) >= 10;
        return '★'.repeat(Math.floor(stars)) + (hasHalfStar ? '½' : '');
    }

    async loadPitcherStats(pitcher) {
        if (!pitcher || pitcher.stats) {
            return pitcher;
        }

        try {
            const parsedGameDate = this.game?.date ? new Date(this.game.date) : null;
            const hasValidGameDate = parsedGameDate && !Number.isNaN(parsedGameDate.getTime());
            const seasonYear = hasValidGameDate ? parsedGameDate.getFullYear() : new Date().getFullYear();
            const gameType = this.game?.gameType || 'R';

            pitcher.seasonYear = seasonYear;
            pitcher.gameType = gameType;

            const stats = await API.apiRequest(`/people/${pitcher.id}/stats`, {
                stats: 'season',
                season: seasonYear,
                group: 'pitching',
                gameType
            });

            if (stats.stats?.[0]?.splits?.[0]?.stat) {
                const statData = stats.stats[0].splits[0].stat;
                pitcher.stats = {
                    gamesPlayed: statData.gamesPlayed || statData.games || '0',
                    era: statData.era || '0.00',
                    wins: statData.wins || '0',
                    losses: statData.losses || '0',
                    inningsPitched: statData.inningsPitched || '0',
                    hits: statData.hits || '0',
                    runs: statData.runs || '0',
                    earnedRuns: statData.earnedRuns || '0',
                    baseOnBalls: statData.baseOnBalls || '0',
                    strikeOuts: statData.strikeOuts || '0',
                    homeRuns: statData.homeRuns || '0',
                    whip: statData.whip || '0.00'
                };
            }

            if (!pitcher.teamId && this.game) {
                if (this.game.awayTeam.pitcher && this.game.awayTeam.pitcher.id === pitcher.id) {
                    pitcher.teamId = this.game.awayTeam.id;
                } else if (this.game.homeTeam.pitcher && this.game.homeTeam.pitcher.id === pitcher.id) {
                    pitcher.teamId = this.game.homeTeam.id;
                }
            }
        } catch (error) {
            console.error('Error loading pitcher stats:', error);
        }

        return pitcher;
    }

    async loadPitchersData() {
        const [awayPitcher, homePitcher] = await Promise.all([
            this.loadPitcherStats(this.game.awayTeam.pitcher),
            this.loadPitcherStats(this.game.homeTeam.pitcher)
        ]);

        if (awayPitcher) this.game.awayTeam.pitcher = awayPitcher;
        if (homePitcher) this.game.homeTeam.pitcher = homePitcher;

        this.pitchersLoaded = true;
    }

    async loadPitcherHighlightImages() {
        this.pitcherHighlightImages = { away: null, home: null };

        if (this.game?.isFuture) {
            this.pitcherHighlightImagesLoaded = true;
            return;
        }

        const awayPitcherId = Number(this.game?.awayTeam?.pitcher?.id);
        const homePitcherId = Number(this.game?.homeTeam?.pitcher?.id);
        const hasAwayPitcher = Number.isFinite(awayPitcherId);
        const hasHomePitcher = Number.isFinite(homePitcherId);

        if (!hasAwayPitcher && !hasHomePitcher) {
            this.pitcherHighlightImagesLoaded = true;
            return;
        }

        try {
            const gameContent = await API.apiRequest(`/game/${this.game.id}/content`);
            const highlightItems = gameContent?.highlights?.highlights?.items;

            if (Array.isArray(highlightItems)) {
                for (const item of highlightItems) {
                    if (!this.isPitcherActionHighlight(item)) {
                        continue;
                    }

                    const imageUrl = this.extractHighlightImageUrl(item);
                    if (!imageUrl) continue;

                    const linkedPlayerIds = this.extractHighlightPlayerIds(item);
                    if (!linkedPlayerIds.size) continue;

                    if (!this.pitcherHighlightImages.away && hasAwayPitcher && linkedPlayerIds.has(awayPitcherId)) {
                        this.pitcherHighlightImages.away = imageUrl;
                    }

                    if (!this.pitcherHighlightImages.home && hasHomePitcher && linkedPlayerIds.has(homePitcherId)) {
                        this.pitcherHighlightImages.home = imageUrl;
                    }

                    const hasAllImages =
                        (!hasAwayPitcher || this.pitcherHighlightImages.away) &&
                        (!hasHomePitcher || this.pitcherHighlightImages.home);

                    if (hasAllImages) {
                        break;
                    }
                }
            }
        } catch (error) {
            console.warn('Error loading pitcher highlight images:', error);
        }

        this.pitcherHighlightImagesLoaded = true;
    }

    extractHighlightPlayerIds(highlightItem) {
        const keywords = this.extractHighlightKeywords(highlightItem);

        const playerIds = new Set();

        keywords.forEach((keyword) => {
            const keywordType = String(keyword?.type || '').toLowerCase();
            const keywordValue = Number(keyword?.value);

            if (!Number.isFinite(keywordValue)) {
                return;
            }

            if (keywordType.includes('player_id') || keywordType.includes('playerid') || keywordType.includes('mlbam')) {
                playerIds.add(keywordValue);
            }
        });

        return playerIds;
    }

    extractHighlightKeywords(highlightItem) {
        return [
            ...(Array.isArray(highlightItem?.keywordsAll) ? highlightItem.keywordsAll : []),
            ...(Array.isArray(highlightItem?.keywords) ? highlightItem.keywords : [])
        ];
    }

    extractHighlightTaxonomyTags(highlightItem) {
        const tags = new Set();
        const keywords = this.extractHighlightKeywords(highlightItem);

        keywords.forEach((keyword) => {
            if (String(keyword?.type || '').toLowerCase() !== 'taxonomy') {
                return;
            }

            const normalizedValue = String(keyword?.value || '').trim().toLowerCase();
            if (normalizedValue) {
                tags.add(normalizedValue);
            }
        });

        return tags;
    }

    isPitcherActionHighlight(highlightItem) {
        const itemType = String(highlightItem?.type || '').trim().toLowerCase();
        if (itemType && itemType !== 'video') {
            return false;
        }

        const taxonomyTags = this.extractHighlightTaxonomyTags(highlightItem);
        if (!taxonomyTags.size) {
            return false;
        }

        if (taxonomyTags.has('data-visualization')) {
            return false;
        }

        const hasPitchingTag = taxonomyTags.has('pitching');
        const hasInGameTag =
            taxonomyTags.has('in-game-highlight') ||
            taxonomyTags.has('game-action-tracking') ||
            taxonomyTags.has('game-story-highlight') ||
            taxonomyTags.has('highlight');

        return hasPitchingTag && hasInGameTag;
    }

    extractHighlightImageUrl(highlightItem) {
        const cuts = highlightItem?.image?.cuts;
        const cutList = Array.isArray(cuts) ? cuts : Object.values(cuts || {});

        if (!cutList.length) {
            return null;
        }

        const preferredCut =
            cutList.find((cut) => cut?.width === 640 && cut?.height === 360 && cut?.src) ||
            cutList.find((cut) => cut?.aspectRatio === '16:9' && cut?.src) ||
            cutList.find((cut) => cut?.src);

        return preferredCut?.src || null;
    }

    renderPitchers(container) {
        const awayPitcherDisplay = new PitcherDisplay(this.game.awayTeam.pitcher, 'away', {
            displayImageUrl: this.pitcherHighlightImages.away
        });
        const homePitcherDisplay = new PitcherDisplay(this.game.homeTeam.pitcher, 'home', {
            displayImageUrl: this.pitcherHighlightImages.home
        });

        const awayTarget = container.querySelector('.away-pitcher-display');
        const homeTarget = container.querySelector('.home-pitcher-display');

        if (awayTarget) {
            awayTarget.innerHTML = '';
            awayTarget.appendChild(awayPitcherDisplay.render());
        }

        if (homeTarget) {
            homeTarget.innerHTML = '';
            homeTarget.appendChild(homePitcherDisplay.render());
        }
    }

    async loadLineupsData() {
        try {
            const lineups = await API.fetchStartingLineups(this.game.id);
            this.game.awayTeam.lineup = Array.isArray(lineups?.away) ? lineups.away : [];
            this.game.homeTeam.lineup = Array.isArray(lineups?.home) ? lineups.home : [];
        } catch (error) {
            console.warn(`Lineup data not available for game ${this.game.id}:`, error);
            this.game.awayTeam.lineup = [];
            this.game.homeTeam.lineup = [];
        }

        this.lineupsLoaded = true;
    }

    renderLineups(container) {
        const awayLineupContainer = container.querySelector('.away-column .lineup');
        const homeLineupContainer = container.querySelector('.home-column .lineup');

        if (!awayLineupContainer || !homeLineupContainer) {
            return;
        }

        const awayLineup = new LineupDisplay('away', this.game.awayTeam.lineup || [], {
            emptyStateText: 'Not Avaliable'
        });
        const homeLineup = new LineupDisplay('home', this.game.homeTeam.lineup || [], {
            emptyStateText: 'Not Avaliable'
        });

        awayLineupContainer.innerHTML = '';
        homeLineupContainer.innerHTML = '';

        awayLineupContainer.appendChild(awayLineup.render());
        homeLineupContainer.appendChild(homeLineup.render());
    }

    update(newData) {
        this.game = { ...this.game, ...newData };
    }
}

export default GameTableRow;
