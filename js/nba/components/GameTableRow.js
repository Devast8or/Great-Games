import Utils from '../utils.js';

class GameTableRow {
    static openInstance = null;

    constructor(game, options = {}) {
        this.game = game;
        this.options = options;

        const safeId = String(this.game.id).replace(/[^a-zA-Z0-9_-]/g, '');
        this.detailsId = `nba-game-details-${safeId}`;

        this.mainRow = null;
        this.detailsRow = null;
        this.expandIcon = null;
        this.detailsContainer = null;

        this.scoreElement = null;
        this.revealBtn = null;
        this.revealPeriodBtn = null;

        this.boxScoreState = null;
        this.totalPeriods = 0;
        this.revealedPeriods = 0;
        this.scoreRevealMode = 'hidden';
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
        rankCell.dataset.label = 'Rank';
        rankCell.textContent = this.options.rank || '-';

        const matchupCell = document.createElement('td');
        matchupCell.className = 'col-matchup';
        matchupCell.dataset.label = 'Matchup';
        matchupCell.appendChild(this.createMatchupElement());

        let playedDateCell = null;
        if (this.options.showPlayedDate) {
            playedDateCell = document.createElement('td');
            playedDateCell.className = 'col-context col-played-date';
            playedDateCell.dataset.label = 'Date';
            playedDateCell.textContent = this.getPlayedDateText();
            playedDateCell.title = playedDateCell.textContent;
        }

        const gameTypeCell = document.createElement('td');
        gameTypeCell.className = 'col-game-type';
        gameTypeCell.dataset.label = 'Type';
        gameTypeCell.textContent = this.game.gameType || 'Regular';
        gameTypeCell.title = `Game Type: ${gameTypeCell.textContent}`;

        const ratingCell = document.createElement('td');
        ratingCell.className = 'col-rating';
        ratingCell.dataset.label = 'Rating';
        ratingCell.textContent = this.game.isFuture ? '-' : this.getStarRating();

        const statusCell = document.createElement('td');
        statusCell.className = 'col-status';
        statusCell.dataset.label = 'Status';
        statusCell.textContent = this.getStatusText();
        statusCell.title = statusCell.textContent;

        const expandCell = document.createElement('td');
        expandCell.className = 'col-expand';
        expandCell.dataset.label = 'Details';

        this.expandIcon = document.createElement('span');
        this.expandIcon.className = 'row-expand-icon';
        this.expandIcon.textContent = '▼';
        expandCell.appendChild(this.expandIcon);

        row.appendChild(rankCell);
        row.appendChild(matchupCell);
        if (playedDateCell) {
            row.appendChild(playedDateCell);
        }
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

        const divisionStandingText = String(team?.divisionStanding || team?.division || '').trim();
        if (divisionStandingText) {
            const standing = document.createElement('div');
            standing.className = 'table-team-record';
            standing.textContent = divisionStandingText;
            textWrap.appendChild(standing);
        }

        wrapper.appendChild(textWrap);
        return wrapper;
    }

    createDetailsRow() {
        const row = document.createElement('tr');
        row.className = 'game-details-row hidden';
        row.id = this.detailsId;

        const detailsCell = document.createElement('td');
        detailsCell.colSpan = this.options.showPlayedDate ? 7 : 6;

        this.detailsContainer = document.createElement('div');
        this.detailsContainer.className = 'game-details-content nba-game-details-content';

        const actions = document.createElement('div');
        actions.className = 'game-details-actions';

        const left = document.createElement('div');
        left.className = 'details-meta';

        const detailsMetaText = this.getDetailsMetaLabel();
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

            this.revealPeriodBtn = document.createElement('button');
            this.revealPeriodBtn.className = 'reveal-btn table-reveal-btn table-half-inning-btn';
            this.revealPeriodBtn.textContent = 'Reveal Quarter';
            this.revealPeriodBtn.setAttribute('aria-pressed', 'false');
            this.revealPeriodBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.revealNextPeriod();
            });
            right.appendChild(this.revealPeriodBtn);
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

        detailsCell.appendChild(this.detailsContainer);
        row.appendChild(detailsCell);

        return row;
    }

    toggleDetails() {
        const isHidden = this.detailsRow.classList.contains('hidden');

        if (isHidden) {
            if (GameTableRow.openInstance && GameTableRow.openInstance !== this) {
                GameTableRow.openInstance.collapse();
            }

            this.expand();
            GameTableRow.openInstance = this;
            return;
        }

        this.collapse();

        if (GameTableRow.openInstance === this) {
            GameTableRow.openInstance = null;
        }
    }

    expand() {
        this.detailsRow.classList.remove('hidden');
        this.mainRow.classList.add('expanded');
        this.mainRow.setAttribute('aria-expanded', 'true');

        if (this.expandIcon) {
            this.expandIcon.textContent = '▲';
        }
    }

    collapse() {
        this.detailsRow.classList.add('hidden');
        this.mainRow.classList.remove('expanded');
        this.mainRow.setAttribute('aria-expanded', 'false');

        if (this.expandIcon) {
            this.expandIcon.textContent = '▼';
        }
    }

    renderBoxScore(container) {
        container.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'box-score-table';

        const headerRow = document.createElement('tr');
        const periodHeaderCells = [];

        const teamHeaderCell = document.createElement('th');
        teamHeaderCell.className = 'team-header-cell';
        teamHeaderCell.scope = 'col';
        headerRow.appendChild(teamHeaderCell);

        this.game.periodScores.forEach((period) => {
            const periodHeaderCell = document.createElement('th');
            periodHeaderCell.className = 'inning-header-cell';
            periodHeaderCell.scope = 'col';
            periodHeaderCell.textContent = period.label;
            headerRow.appendChild(periodHeaderCell);
            periodHeaderCells.push(periodHeaderCell);
        });

        const totalHeaderCell = document.createElement('th');
        totalHeaderCell.className = 'stat-header-cell stat-break-cell';
        totalHeaderCell.scope = 'col';
        totalHeaderCell.textContent = 'T';
        headerRow.appendChild(totalHeaderCell);

        table.appendChild(headerRow);

        const state = {
            periodHeaderCells,
            periodCells: {
                away: [],
                home: []
            },
            totalCells: {
                away: null,
                home: null
            },
            teamRows: {
                away: null,
                home: null
            },
            finalTotals: {
                away: Number(this.game.awayTeam.score) || 0,
                home: Number(this.game.homeTeam.score) || 0
            }
        };

        ['away', 'home'].forEach((teamType) => {
            const team = this.game[`${teamType}Team`];
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

            this.game.periodScores.forEach((period) => {
                const periodCell = document.createElement('td');
                periodCell.className = 'inning-cell';
                periodCell.dataset.value = String(period[teamType] ?? 0);
                periodCell.textContent = periodCell.dataset.value;
                row.appendChild(periodCell);
                state.periodCells[teamType].push(periodCell);
            });

            const totalCell = document.createElement('td');
            totalCell.className = 'runs-cell stat-cell stat-break-cell';
            totalCell.textContent = String(state.finalTotals[teamType]);
            row.appendChild(totalCell);

            state.totalCells[teamType] = totalCell;
            state.teamRows[teamType] = row;

            table.appendChild(row);
        });

        container.appendChild(table);

        this.boxScoreState = state;
        this.totalPeriods = this.game.periodScores.length;
        this.revealedPeriods = 0;
        this.scoreRevealMode = 'hidden';
        this.applyPeriodReveal();
    }

    toggleScore() {
        if (!this.scoreElement || !this.revealBtn) {
            return;
        }

        if (this.scoreElement.classList.contains('hidden')) {
            this.showFullScore();
            return;
        }

        if (this.scoreRevealMode === 'period' && this.revealedPeriods < this.totalPeriods) {
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
        this.revealedPeriods = this.totalPeriods;

        this.applyPeriodReveal();
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

    revealNextPeriod() {
        if (!this.scoreElement || this.game.isFuture) {
            return;
        }

        if (this.totalPeriods === 0) {
            this.showFullScore();
            return;
        }

        if (this.revealedPeriods >= this.totalPeriods) {
            this.revealedPeriods = 0;
        }

        this.revealedPeriods += 1;
        this.scoreRevealMode = 'period';
        this.scoreElement.classList.remove('hidden');

        this.applyPeriodReveal();
        this.updateScoreButtons();
    }

    applyPeriodReveal() {
        if (!this.boxScoreState) {
            return;
        }

        const revealAll = this.scoreRevealMode === 'full';
        const visiblePeriods = revealAll ? this.totalPeriods : this.revealedPeriods;

        let awayTotal = 0;
        let homeTotal = 0;

        this.game.periodScores.forEach((period, index) => {
            const awayCell = this.boxScoreState.periodCells.away[index];
            const homeCell = this.boxScoreState.periodCells.home[index];
            const headerCell = this.boxScoreState.periodHeaderCells[index];
            const isVisible = revealAll || index < visiblePeriods;

            [awayCell, homeCell, headerCell].forEach((cell) => {
                if (!cell) {
                    return;
                }

                cell.classList.toggle('inning-column-hidden', !isVisible);
            });

            if (awayCell) {
                awayCell.textContent = isVisible ? awayCell.dataset.value : '-';
                awayCell.classList.toggle('half-inning-hidden', !isVisible);
            }

            if (homeCell) {
                homeCell.textContent = isVisible ? homeCell.dataset.value : '-';
                homeCell.classList.toggle('half-inning-hidden', !isVisible);
            }

            if (isVisible) {
                awayTotal += Number(period.away) || 0;
                homeTotal += Number(period.home) || 0;
            }
        });

        if (revealAll) {
            awayTotal = this.boxScoreState.finalTotals.away;
            homeTotal = this.boxScoreState.finalTotals.home;
        }

        this.setTotalValue(this.boxScoreState.totalCells.away, awayTotal);
        this.setTotalValue(this.boxScoreState.totalCells.home, homeTotal);

        this.boxScoreState.teamRows.away.classList.toggle('winner', awayTotal > homeTotal);
        this.boxScoreState.teamRows.home.classList.toggle('winner', homeTotal > awayTotal);
    }

    setTotalValue(cell, value) {
        if (!cell) {
            return;
        }

        cell.textContent = String(value);
    }

    updateScoreButtons() {
        const isHidden = this.scoreElement ? this.scoreElement.classList.contains('hidden') : true;

        if (this.revealBtn) {
            this.revealBtn.setAttribute('aria-pressed', String(!isHidden));

            if (isHidden) {
                this.revealBtn.textContent = 'Reveal Full Score';
            } else if (this.scoreRevealMode === 'period' && this.revealedPeriods < this.totalPeriods) {
                this.revealBtn.textContent = 'Reveal Full Score';
            } else {
                this.revealBtn.textContent = 'Hide Score';
            }
        }

        if (!this.revealPeriodBtn) {
            return;
        }

        if (this.revealedPeriods >= this.totalPeriods && this.totalPeriods > 0) {
            this.revealPeriodBtn.textContent = 'Reveal Quarter';
            this.revealPeriodBtn.setAttribute('aria-label', 'Reveal first quarter and update score');
            this.revealPeriodBtn.setAttribute('aria-pressed', 'false');
            return;
        }

        const nextLabel = this.getPeriodLabel(this.revealedPeriods + 1);
        this.revealPeriodBtn.textContent = this.revealedPeriods === 0
            ? 'Reveal Quarter'
            : `Reveal ${nextLabel}`;
        this.revealPeriodBtn.setAttribute('aria-label', `Reveal ${nextLabel} and update score`);
        this.revealPeriodBtn.setAttribute('aria-pressed', 'false');
    }

    getPeriodLabel(step) {
        const clampedStep = Math.max(1, Math.min(step, this.totalPeriods || 1));
        const period = this.game.periodScores[clampedStep - 1];
        return period?.label || `Q${clampedStep}`;
    }

    getStatusText() {
        const statusText = String(this.game.status || '').toLowerCase();
        const inProgressKeywords = ['q1', 'q2', 'q3', 'q4', 'ot', 'halftime', 'in progress'];

        if (inProgressKeywords.some((keyword) => statusText.includes(keyword))) {
            return 'In Progress';
        }

        if (statusText.includes('final')) {
            return 'Final';
        }

        if (this.game.isFuture) {
            return this.game.gameTime || 'Time TBD';
        }

        return this.game.status || 'Final';
    }

    getPlayedDateText() {
        const candidateValues = [
            this.game?.playedDate,
            this.game?.officialDate,
            this.game?.date
        ];

        for (let index = 0; index < candidateValues.length; index += 1) {
            const rawValue = String(candidateValues[index] || '').trim();
            if (!rawValue) {
                continue;
            }

            const isoMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/);
            if (isoMatch) {
                return isoMatch[1];
            }

            const parsed = new Date(rawValue);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
        }

        return 'Unknown Date';
    }

    getDetailsMetaLabel() {
        const awayTeamName = String(this.game?.awayTeam?.name || 'Away Team').trim();
        const homeLabel = String(this.game?.homeTeam?.name || 'Home Team').trim();

        return `${awayTeamName} @ ${homeLabel}`;
    }

    getTeamCityLabel(team) {
        const teamId = Number.parseInt(team?.id, 10);
        const fallbackName = String(team?.name || '').trim();

        if (Number.isFinite(teamId)) {
            const resolvedTeam = Utils.getTeamInfo(teamId, {
                name: fallbackName
            });
            const resolvedCity = String(resolvedTeam?.city || '').trim();

            if (resolvedCity) {
                return resolvedCity;
            }
        }

        return fallbackName;
    }

    getSportsCultSeasonYear() {
        const candidateValues = [
            this.game?.playedDate,
            this.game?.officialDate,
            this.game?.date
        ];

        for (let index = 0; index < candidateValues.length; index += 1) {
            const rawValue = String(candidateValues[index] || '').trim();
            if (!rawValue) {
                continue;
            }

            const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
                return isoMatch[1];
            }

            const parsedDate = new Date(rawValue);
            if (!Number.isNaN(parsedDate.getTime())) {
                return String(parsedDate.getUTCFullYear());
            }
        }

        return String(new Date().getUTCFullYear());
    }

    getSportsCultTeamToken(team) {
        return this.getTeamCityLabel(team);
    }

    getSportsCultSearchUrl() {
        if (this.options?.isFuture || this.game?.isFuture) {
            return null;
        }

        const seasonYear = this.getSportsCultSeasonYear();
        const awayTeamToken = this.getSportsCultTeamToken(this.game?.awayTeam);
        const homeTeamToken = this.getSportsCultTeamToken(this.game?.homeTeam);

        if (!seasonYear || !awayTeamToken || !homeTeamToken) {
            return null;
        }

        const encodedAwayToken = encodeURIComponent(awayTeamToken).replace(/%20/g, '+');
        const encodedHomeToken = encodeURIComponent(homeTeamToken).replace(/%20/g, '+');
        const searchQuery = `NBA+RS+${seasonYear}+${encodedAwayToken}+${encodedHomeToken}`;

        return `https://sportscult.org/index.php?page=torrents&search=${searchQuery}&category=11&active=1&gold=0`;
    }

    getStarRating() {
        const score = Number(this.game?.excitementScore);

        if (!Number.isFinite(score)) {
            return '-';
        }

        const stars = Math.max(1, Math.min(5, Math.floor(score / 20) + 1));
        const hasHalfStar = stars < 5 && score % 20 >= 10;
        return '★'.repeat(stars) + (hasHalfStar ? '½' : '');
    }
}

export default GameTableRow;
