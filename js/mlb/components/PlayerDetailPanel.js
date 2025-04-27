/**
 * PlayerDetailPanel component for showing detailed player information
 */
class PlayerDetailPanel {
    constructor(teamType) {
        this.teamType = teamType;
        this.element = null;
        this.activePlayer = null;
        this.onClose = null;
    }

    /**
     * Show the panel with player details
     * @param {Object} player - Player data to display
     * @param {Function} onClose - Callback when panel is closed
     */
    show(player, onClose) {
        this.activePlayer = player;
        this.onClose = onClose;

        if (this.element) {
            this.updateContent(player);
        } else {
            this.create(player);
        }
    }

    /**
     * Create the panel element
     * @param {Object} player - Player data to display
     */
    create(player) {
        const panel = document.createElement('div');
        panel.className = `player-detail-panel panel-${this.teamType}`;
        
        this.updatePanelContent(panel, player);

        // Add close button handler
        panel.querySelector('.player-detail-close').addEventListener('click', () => {
            this.close();
        });

        // Add click outside handler
        document.addEventListener('click', (e) => {
            if (this.element && !this.element.contains(e.target) && !e.target.closest('.player-row')) {
                this.close();
            }
        });

        this.element = panel;
        document.body.appendChild(panel);

        // Trigger animation after a brief delay
        requestAnimationFrame(() => {
            panel.classList.add('panel-active');
        });
    }

    /**
     * Update panel with new player data
     * @param {Object} player - New player data to display
     */
    updateContent(player) {
        if (!this.element) return;

        // Create temporary div for new content
        const temp = document.createElement('div');
        this.updatePanelContent(temp, player);

        // Add transition class
        this.element.classList.add('panel-transitioning');

        // Fade out current content
        const content = this.element.querySelector('.panel-content');
        content.style.opacity = '0';

        // After fade out, update content and fade in
        setTimeout(() => {
            content.innerHTML = temp.querySelector('.panel-content').innerHTML;
            content.style.opacity = '1';
            this.element.classList.remove('panel-transitioning');
        }, 150);

        this.activePlayer = player;
    }

    /**
     * Update panel content with player data
     * @param {HTMLElement} panel - Panel element to update
     * @param {Object} player - Player data to display
     */
    updatePanelContent(panel, player) {
        panel.innerHTML = `
            <button class="player-detail-close">&times;</button>
            <div class="panel-content">
                <div class="player-detail-header">
                    <img class="player-detail-img"
                         src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${player.id}/headshot/67/current"
                         alt="${player.name}">
                    <h2 class="player-detail-name">${player.name}</h2>
                    <div class="player-detail-position">${player.position}</div>
                </div>
                <div class="player-stats-grid">
                    <div class="stat-item" title="The total number of games the player has appeared in">
                        <div class="stat-label">Games</div>
                        <div class="stat-value">${player.stats.gamesPlayed}</div>
                    </div>
                    <div class="stat-item" title="The number of times a player has faced a pitcher (excluding walks, hit-by-pitches, sacrifices, and catcher's interference)">
                        <div class="stat-label">At Bats</div>
                        <div class="stat-value">${player.stats.atBats}</div>
                    </div>
                    <div class="stat-item" title="The number of times a player has safely crossed home plate">
                        <div class="stat-label">Runs</div>
                        <div class="stat-value">${player.stats.runs}</div>
                    </div>
                    <div class="stat-item" title="The number of times a player has safely reached a base by hitting the ball into fair territory">
                        <div class="stat-label">Hits</div>
                        <div class="stat-value">${player.stats.hits}</div>
                    </div>
                    <div class="stat-item" title="Hits where the batter reached second base safely">
                        <div class="stat-label">Doubles</div>
                        <div class="stat-value">${player.stats.doubles}</div>
                    </div>
                    <div class="stat-item" title="Hits where the batter reached third base safely">
                        <div class="stat-label">Triples</div>
                        <div class="stat-value">${player.stats.triples}</div>
                    </div>
                    <div class="stat-item" title="Hits where the batter scored by hitting the ball over the outfield fence in fair territory">
                        <div class="stat-label">Home Runs</div>
                        <div class="stat-value">${player.stats.hr}</div>
                    </div>
                    <div class="stat-item" title="Runs Batted In - The number of runners who scored due to a batter's action, excluding when the batter grounded into a double play">
                        <div class="stat-label">RBI</div>
                        <div class="stat-value">${player.stats.rbi}</div>
                    </div>
                    <div class="stat-item" title="The number of times a batter has been awarded first base after receiving four pitches outside the strike zone">
                        <div class="stat-label">Walks</div>
                        <div class="stat-value">${player.stats.baseOnBalls}</div>
                    </div>
                    <div class="stat-item" title="The number of times a batter has received three strikes in a plate appearance">
                        <div class="stat-label">Strikeouts</div>
                        <div class="stat-value">${player.stats.strikeOuts}</div>
                    </div>
                    <div class="stat-item" title="The number of bases a runner has advanced while the pitch is being delivered (or pitcher holds the ball)">
                        <div class="stat-label">Stolen Bases</div>
                        <div class="stat-value">${player.stats.stolenBases}</div>
                    </div>
                    <div class="stat-item" title="The number of times a runner has been tagged or forced out while attempting to steal a base">
                        <div class="stat-label">Caught Stealing</div>
                        <div class="stat-value">${player.stats.caughtStealing}</div>
                    </div>
                    <div class="stat-item" title="Batting Average - The ratio of hits to at-bats (H/AB)">
                        <div class="stat-label">AVG</div>
                        <div class="stat-value">${player.stats.avg}</div>
                    </div>
                    <div class="stat-item" title="On-Base Percentage - The ratio of times a batter reaches base (H+BB+HBP) to plate appearances">
                        <div class="stat-label">OBP</div>
                        <div class="stat-value">${player.stats.obp}</div>
                    </div>
                    <div class="stat-item" title="Slugging Percentage - The total number of bases divided by at-bats; measures batting power">
                        <div class="stat-label">SLG</div>
                        <div class="stat-value">${player.stats.slg}</div>
                    </div>
                    <div class="stat-item" title="On-base Plus Slugging - The sum of OBP and SLG; provides a broader evaluation of a player's offensive value">
                        <div class="stat-label">OPS</div>
                        <div class="stat-value">${player.stats.ops}</div>
                    </div>
                </div>
                <div class="player-team-logo">
                    <img src="https://www.mlbstatic.com/team-logos/${player.teamId}.svg" 
                         alt="Team Logo" 
                         class="team-logo-detail">
                </div>
            </div>
        `;
    }

    /**
     * Close the panel
     */
    close() {
        if (this.element) {
            this.element.classList.remove('panel-active');
            setTimeout(() => {
                this.element.remove();
                this.element = null;
                this.activePlayer = null;
                
                if (this.onClose) {
                    this.onClose();
                }
            }, 300); // Match transition duration
        }
    }

    /**
     * Check if the panel is currently showing the given player
     * @param {Object} player - Player to check
     * @returns {boolean} - True if panel is showing this player
     */
    isShowingPlayer(player) {
        return this.activePlayer && this.activePlayer.id === player.id;
    }
}

export default PlayerDetailPanel;