/**
 * LineupDisplay component for showing team lineups
 */
import PlayerDetailPanel from './PlayerDetailPanel.js';

class LineupDisplay {
    constructor(teamType, lineup = [], options = {}) {
        this.teamType = teamType;
        this.lineup = Array.isArray(lineup) ? lineup : [];
        this.isLoading = Boolean(options.isLoading);
        this.emptyStateText = options.emptyStateText || 'Not Avaliable';
        this.element = null;
        this.playerPanel = new PlayerDetailPanel(teamType);
        this.activePlayerId = null;
    }

    /**
     * Render the lineup display
     * @returns {HTMLElement} - Lineup display element
     */
    render() {
        const container = document.createElement('div');
        container.className = `lineup ${this.teamType}-lineup`;
        
        container.innerHTML = `
            <h4>${this.teamType === 'away' ? 'Away' : 'Home'} Lineup</h4>
        `;
        
        if (this.isLoading) {
            container.innerHTML += '<div class="lineup-loading">Loading lineup...</div>';
        } else {
            container.appendChild(this.createLineupTable());
        }
        
        this.element = container;
        return container;
    }

    /**
     * Calculate player performance score for ranking
     * @param {Object} player - Player data
     * @returns {number} - Performance score
     */
    calculatePerformanceScore(player) {
        const playerStats = player?.stats || {};

        // Get base stats, defaulting to 0 if not available
        const ops = parseFloat(playerStats.ops) || 0;
        const hr = parseInt(playerStats.hr) || 0;
        const rbi = parseInt(playerStats.rbi) || 0;
        const avg = parseFloat(playerStats.avg) || 0;
        const games = parseInt(playerStats.gamesPlayed) || 1;
        
        // Calculate weighted score - using OPS as primary factor with HR and RBI
        // Normalize RBI and HR by games played to avoid bias towards players who've played more games
        const opsWeight = 1.5;    // OPS is a good overall offensive metric
        const hrWeight = 0.8;     // Home runs show power
        const rbiWeight = 0.6;    // RBIs show run production
        const avgWeight = 0.7;    // Batting average shows consistency
        
        // Calculate score - weighting is subjective and can be adjusted
        return (ops * opsWeight) + 
               ((hr / games) * 10 * hrWeight) + 
               ((rbi / games) * 10 * rbiWeight) +
               (avg * avgWeight);
    }

    /**
     * Find the best player in the lineup based on performance
     * @returns {Object|null} - Best player or null if no players
     */
    findBestPlayer() {
        if (!this.lineup || this.lineup.length === 0) return null;
        
        // Calculate performance scores for all players
        const withScores = this.lineup.map(player => ({
            player,
            score: this.calculatePerformanceScore(player)
        }));
        
        // Sort by score descending and return the best player
        withScores.sort((a, b) => b.score - a.score);
        return withScores[0].player;
    }

    getDisplayValue(value, fallback = '-') {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }

        return value;
    }

    /**
     * Create lineup table
     * @returns {HTMLElement} - Table element
     */
    createLineupTable() {
        const table = document.createElement('table');
        table.className = 'lineup-table';
        
        // Header row
        table.innerHTML = `
            <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Name</th>
                <th>GP</th>
                <th>AVG</th>
                <th>OBP</th>
                <th>OPS</th>
                <th>HR</th>
                <th>RBI</th>
            </tr>
        `;

        if (!this.lineup || this.lineup.length === 0) {
            const row = document.createElement('tr');
            row.className = 'lineup-placeholder-row';
            row.innerHTML = `
                <td class="lineup-placeholder-cell" colspan="9">${this.emptyStateText}</td>
            `;
            table.appendChild(row);
            return table;
        }
        
        // Find the best player in the lineup
        const bestPlayer = this.findBestPlayer();
        
        // Player rows
        this.lineup.forEach((player, index) => {
            const row = document.createElement('tr');
            row.className = 'player-row';
            row.dataset.playerId = player.id;
            const playerStats = player?.stats || {};
            
            // Check if this is the best player
            const isBestPlayer = bestPlayer && player.id === bestPlayer.id;
            
            row.innerHTML = `
                <td class="player-img-cell">
                    ${player.id ? `
                        <div class="player-img-container" title="${isBestPlayer ? 'Hot performer! 🔥' : ''}">
                            <img class="player-small-img"
                                 src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_45,q_auto:best/v1/people/${player.id}/headshot/67/current"
                                 alt="${player.name}"
                                 title="${player.name}">
                            ${isBestPlayer ? '<span class="player-hot-badge" title="Hot performer!">🔥</span>' : ''}
                        </div>
                    ` : index + 1}
                </td>
                <td>${player.position}</td>
                <td>${player.name}</td>
                <td>${this.getDisplayValue(playerStats.gamesPlayed)}</td>
                <td>${this.getDisplayValue(playerStats.avg)}</td>
                <td>${this.getDisplayValue(playerStats.obp)}</td>
                <td>${this.getDisplayValue(playerStats.ops)}</td>
                <td>${this.getDisplayValue(playerStats.hr)}</td>
                <td>${this.getDisplayValue(playerStats.rbi)}</td>
            `;

            // Add click handler for player details
            row.addEventListener('click', () => this.showPlayerDetails(player));
            table.appendChild(row);
        });
        
        return table;
    }

    /**
     * Show player details in panel
     * @param {Object} player - Player data to display
     */
    showPlayerDetails(player) {
        if (this.playerPanel.isShowingPlayer(player)) {
            this.playerPanel.close();
            return;
        }

        // Update row highlighting
        if (this.element) {
            this.element.querySelectorAll('.player-row').forEach(row => {
                row.classList.toggle('active-player', row.dataset.playerId === player.id);
            });
        }

        this.playerPanel.show(player, () => {
            // Remove row highlighting when panel is closed
            if (this.element) {
                this.element.querySelectorAll('.player-row').forEach(row => {
                    row.classList.remove('active-player');
                });
            }
        });
    }

    /**
     * Update lineup data
     * @param {Array} newLineup - New lineup data
     */
    update(newLineup) {
        this.lineup = Array.isArray(newLineup) ? newLineup : [];
        this.isLoading = false;
        if (this.element) {
            const newElement = this.render();
            this.element.parentNode.replaceChild(newElement, this.element);
            this.element = newElement;
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.isLoading = true;

        if (this.element) {
            this.element.innerHTML = `
                <h4>${this.teamType === 'away' ? 'Away' : 'Home'} Lineup</h4>
                <div class="lineup-loading">Loading lineup...</div>
            `;
        }
    }

    /**
     * Show error state
     * @param {string} message - Error message
     */
    showError(message = 'Not Avaliable') {
        this.isLoading = false;
        this.emptyStateText = message || 'Not Avaliable';

        if (this.element) {
            const fallbackTable = this.createLineupTable();
            this.element.innerHTML = `
                <h4>${this.teamType === 'away' ? 'Away' : 'Home'} Lineup</h4>
            `;
            this.element.appendChild(fallbackTable);
        }
    }
}

export default LineupDisplay;