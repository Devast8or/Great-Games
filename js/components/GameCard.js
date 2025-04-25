/**
 * GameCard component for displaying game information
 */
import Utils from '../utils.js';
import { API } from '../api.js';
import LineupDisplay from './LineupDisplay.js';

class GameCard {
    constructor(game, options = {}) {
        this.game = game;
        this.options = options;
        this.element = null;
        this.lineupShown = false;
    }

    /**
     * Create the game card DOM element
     * @returns {HTMLElement} - Game card element
     */
    render() {
        const template = document.getElementById('game-card-template');
        this.element = document.importNode(template.content, true).querySelector('.game-card');
        
        this.renderTeams();
        this.renderGameInfo();
        this.renderPitchers();
        this.setupLineups();
        
        return this.element;
    }

    /**
     * Render teams section of the card
     */
    renderTeams() {
        // Away team
        this.element.querySelector('.away .team-name').textContent = this.game.awayTeam.name;
        this.element.querySelector('.away .team-logo').src = this.game.awayTeam.logoUrl;
        this.element.querySelector('.away .team-logo').alt = this.game.awayTeam.name + ' logo';

        // Home team
        this.element.querySelector('.home .team-name').textContent = this.game.homeTeam.name;
        this.element.querySelector('.home .team-logo').src = this.game.homeTeam.logoUrl;
        this.element.querySelector('.home .team-logo').alt = this.game.homeTeam.name + ' logo';

        // Division rankings if available
        this.renderDivisionInfo('away');
        this.renderDivisionInfo('home');
    }

    /**
     * Render division information for a team
     * @param {string} teamType - 'away' or 'home'
     */
    renderDivisionInfo(teamType) {
        const team = this.game[teamType + 'Team'];
        const rankElement = this.element.querySelector(`.${teamType} .team-rank`);
        
        if (team.ranking?.divisionName) {
            const divElement = document.createElement('span');
            divElement.className = 'team-division';
            divElement.textContent = team.ranking.divisionName;
            divElement.style.cssText = 'font-size: 0.8rem; color: rgba(255,255,255,0.8);';
            
            const nameElement = this.element.querySelector(`.${teamType} .team-name`);
            nameElement.parentNode.insertBefore(divElement, nameElement.nextSibling);
        }

        if (team.ranking?.divisionRank) {
            rankElement.textContent = `Div Rank: ${team.ranking.divisionRank}`;
            rankElement.classList.remove('hidden');
        } else {
            rankElement.classList.add('hidden');
        }
    }

    /**
     * Render game info section
     */
    renderGameInfo() {
        const gameInfo = this.element.querySelector('.game-info');
        
        // Stadium info
        gameInfo.querySelector('.stadium').textContent = this.game.venue;

        // Score section
        const scoreElement = gameInfo.querySelector('.score');
        
        // For future games, show game time instead of score
        if (this.game.isFuture) {
            const gameTimeDiv = document.createElement('div');
            gameTimeDiv.className = 'game-time';
            gameTimeDiv.textContent = this.game.gameTime;
            gameInfo.appendChild(gameTimeDiv);
        } else {
            this.renderBoxScore(scoreElement);
            // Hide score by default for previous games
            scoreElement.classList.add('hidden');
        }

        // Rating if available (only for completed games)
        if (this.game.excitementScore) {
            this.renderRating();
        }

        // Create VS section with reveal button (only for completed games)
        if (!this.game.isFuture) {
            this.createVsSection();
        }
    }

    /**
     * Render box score table
     * @param {HTMLElement} container - Container for box score
     */
    renderBoxScore(container) {
        container.innerHTML = '';
        
        const table = document.createElement('table');
        table.className = 'box-score-table';
        
        // Header row with innings
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th></th>';
        
        // Add inning numbers
        this.game.inningScores.forEach(inning => {
            headerRow.innerHTML += `<th>${inning.inningNumber}</th>`;
        });
        
        // Add R, H, E columns
        headerRow.innerHTML += `
            <th title="Runs">R</th>
            <th title="Hits">H</th>
            <th title="Errors">E</th>
        `;
        table.appendChild(headerRow);
        
        // Team rows
        ['away', 'home'].forEach(teamType => {
            const team = this.game[teamType + 'Team'];
            const row = document.createElement('tr');
            
            // Team logo cell
            row.innerHTML = `
                <td class="team-logo-cell">
                    <img src="${team.logoUrl}" alt="${team.name}" 
                         title="${team.name}" class="score-team-logo">
                </td>
            `;
            
            // Add inning scores
            this.game.inningScores.forEach(inning => {
                row.innerHTML += `<td>${inning[teamType]}</td>`;
            });
            
            // Add R, H, E
            row.innerHTML += `
                <td class="runs-cell">${team.score}</td>
                <td>${team.hits}</td>
                <td>${team.errors}</td>
            `;
            
            // Add winner class if this team won
            if ((teamType === 'away' && team.score > this.game.homeTeam.score) ||
                (teamType === 'home' && team.score > this.game.awayTeam.score)) {
                row.classList.add('winner');
            }
            
            table.appendChild(row);
        });
        
        container.appendChild(table);

        // Add innings info for extra innings games
        if (this.game.isExtraInnings) {
            const inningsInfo = document.createElement('div');
            inningsInfo.className = 'innings-info';
            inningsInfo.textContent = `${this.game.innings} innings`;
            container.appendChild(inningsInfo);
        }
    }

    /**
     * Render game rating
     */
    renderRating() {
        const ratingElement = document.createElement('div');
        ratingElement.className = 'rating top-rating';
        ratingElement.innerHTML = `
            <span class="rating-label">Game Rating</span>
            <span class="stars" title="${Math.round(this.game.excitementScore)} Points">
                ${this.getStarRating()}
            </span>
        `;
        
        ratingElement.style.cssText = 'margin: 0.5rem 0; text-align: center; color: white;';
        
        const teamsContainer = this.element.querySelector('.teams');
        teamsContainer.parentNode.insertBefore(ratingElement, teamsContainer);
        
        // Hide original rating
        const infoRating = this.element.querySelector('.game-info .rating');
        if (infoRating) {
            infoRating.classList.add('hidden');
        }
    }

    /**
     * Get star rating HTML based on excitement score
     * @returns {string} - Star rating HTML
     */
    getStarRating() {
        const score = this.game.excitementScore;
        // Adjust thresholds based on realistic game scores:
        // 80-100: 5 stars (Elite game)
        // 60-79: 4 stars (Great game)
        // 40-59: 3 stars (Good game)
        // 20-39: 2 stars (Average game)
        // 0-19: 1 star (Below average game)
        const stars = Math.max(1, Math.min(5, Math.floor(score / 20) + 1));
        const hasHalfStar = (score % 20) >= 10;
        
        return '★'.repeat(Math.floor(stars)) + (hasHalfStar ? '½' : '');
    }

    /**
     * Create VS section with reveal button
     */
    createVsSection() {
        const vsElement = this.element.querySelector('.vs');
        const container = document.createElement('div');
        container.className = 'vs-score-container';
        
        const revealBtn = document.createElement('button');
        revealBtn.className = 'reveal-btn top-reveal-btn';
        revealBtn.textContent = 'Reveal Score';
        
        container.appendChild(vsElement.cloneNode(true));
        container.appendChild(revealBtn);
        vsElement.parentNode.replaceChild(container, vsElement);
        
        // Remove original reveal button
        const oldRevealBtn = this.element.querySelector('.reveal-btn:not(.top-reveal-btn)');
        if (oldRevealBtn) {
            oldRevealBtn.parentNode.removeChild(oldRevealBtn);
        }
        
        // Add event listener
        const scoreElement = this.element.querySelector('.score');
        revealBtn.addEventListener('click', () => {
            scoreElement.classList.toggle('hidden');
            revealBtn.textContent = scoreElement.classList.contains('hidden') ? 
                'Reveal Score' : 'Hide Score';
        });
    }

    /**
     * Load pitcher stats
     * @param {Object} pitcher - Pitcher object
     * @returns {Promise} - Promise resolving to pitcher with stats
     */
    async loadPitcherStats(pitcher) {
        if (!pitcher || pitcher.stats) return pitcher;
        
        try {
            const seasonYear = new Date().getFullYear();
            const stats = await API.apiRequest(`/people/${pitcher.id}/stats`, {
                stats: 'season',
                season: seasonYear,
                group: 'pitching'
            });
            
            if (stats.stats?.[0]?.splits?.[0]?.stat) {
                const statData = stats.stats[0].splits[0].stat;
                pitcher.stats = {
                    gamesPlayed: statData.gamesPlayed || statData.games || '0',
                    era: statData.era || '0.00',
                    wins: statData.wins || '0',
                    losses: statData.losses || '0'
                };
            }
        } catch (error) {
            console.error('Error loading pitcher stats:', error);
        }
        
        return pitcher;
    }

    /**
     * Render pitcher information
     */
    async renderPitchers() {
        const container = document.createElement('div');
        container.className = 'pitchers-container';
        
        // Load stats for both pitchers in parallel
        const [awayPitcher, homePitcher] = await Promise.all([
            this.loadPitcherStats(this.game.awayTeam.pitcher),
            this.loadPitcherStats(this.game.homeTeam.pitcher)
        ]);
        
        // Update pitcher data in game object
        if (awayPitcher) this.game.awayTeam.pitcher = awayPitcher;
        if (homePitcher) this.game.homeTeam.pitcher = homePitcher;
        
        ['away', 'home'].forEach(teamType => {
            const pitcher = this.game[teamType + 'Team'].pitcher;
            if (pitcher) {
                container.appendChild(this.createPitcherElement(pitcher, teamType));
            }
        });
        
        const gameInfo = this.element.querySelector('.game-info');
        const scoreElement = this.element.querySelector('.score');
        gameInfo.insertBefore(container, scoreElement);
    }

    /**
     * Create pitcher element
     * @param {Object} pitcher - Pitcher data
     * @param {string} teamType - 'away' or 'home'
     * @returns {HTMLElement} - Pitcher element
     */
    createPitcherElement(pitcher, teamType) {
        const container = document.createElement('div');
        container.className = `pitcher-container ${teamType}-pitcher-container`;
        
        container.innerHTML = `
            <div class="pitcher-img ${teamType}-pitcher-img">
                <img src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${pitcher.id}/headshot/67/current"
                     alt="${pitcher.name}"
                     title="${pitcher.name}">
            </div>
            <div class="pitcher-name">${pitcher.name}</div>
            <div class="pitcher-stats">
                ${this.formatPitcherStats(pitcher.stats)}
            </div>
        `;
        
        return container;
    }

    /**
     * Format pitcher stats for display
     * @param {Object} stats - Pitcher stats
     * @returns {string} - Formatted stats string
     */
    formatPitcherStats(stats) {
        if (!stats) return 'Stats not available';
        
        const winLossText = (Number(stats.wins) > 0 && Number(stats.losses) > 0) ? 
            `, ${stats.wins}-${stats.losses}` : '';
        return `${stats.gamesPlayed} G, ${stats.era} ERA${winLossText}`;
    }

    /**
     * Setup lineup section
     */
    setupLineups() {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = '<span class="arrow-down">▼</span> Show Lineups';
        
        const lineupContainer = document.createElement('div');
        lineupContainer.className = 'lineups-container hidden';
        
        ['away', 'home'].forEach(teamType => {
            const teamContainer = document.createElement('div');
            teamContainer.className = `lineup ${teamType}-lineup`;
            teamContainer.innerHTML = `
                <h4>${teamType === 'away' ? 'Away' : 'Home'} Lineup</h4>
                <div class="lineup-loading">Loading lineup...</div>
            `;
            lineupContainer.appendChild(teamContainer);
        });
        
        this.element.querySelector('.game-info').appendChild(expandBtn);
        this.element.appendChild(lineupContainer);
        
        expandBtn.addEventListener('click', () => this.toggleLineups(expandBtn, lineupContainer));
    }

    /**
     * Toggle lineup display
     * @param {HTMLElement} button - Expand button
     * @param {HTMLElement} container - Lineup container
     */
    async toggleLineups(button, container) {
        const isHidden = container.classList.contains('hidden');
        
        if (isHidden) {
            container.classList.remove('hidden');
            button.innerHTML = '<span class="arrow-up">▲</span> Hide Lineups';
            
            // Load lineups if not already loaded
            if (!this.lineupShown) {
                await this.loadLineups(container);
                this.lineupShown = true;
            }
        } else {
            button.innerHTML = '<span class="arrow-down">▼</span> Show Lineups';
            container.classList.add('hidden');
        }
    }

    /**
     * Load and display lineups
     * @param {HTMLElement} container - Lineup container
     */
    async loadLineups(container) {
        try {
            const lineups = await API.fetchStartingLineups(this.game.id);
            this.game.awayTeam.lineup = lineups.away;
            this.game.homeTeam.lineup = lineups.home;
            
            // Create LineupDisplay components
            const awayLineup = new LineupDisplay('away', this.game.awayTeam.lineup);
            const homeLineup = new LineupDisplay('home', this.game.homeTeam.lineup);
            
            // Clear existing content and append new lineup displays
            container.innerHTML = '';
            container.appendChild(awayLineup.render());
            container.appendChild(homeLineup.render());
            
        } catch (error) {
            console.error('Error loading lineups:', error);
            container.querySelectorAll('.lineup').forEach(el => {
                el.querySelector('.lineup-loading').textContent = 'Error loading lineup';
            });
        }
    }

    /**
     * Update the game card with new data
     * @param {Object} newData - Updated game data
     */
    update(newData) {
        this.game = { ...this.game, ...newData };
        if (this.element) {
            const newElement = this.render();
            this.element.parentNode.replaceChild(newElement, this.element);
            this.element = newElement;
        }
    }
}

export default GameCard;