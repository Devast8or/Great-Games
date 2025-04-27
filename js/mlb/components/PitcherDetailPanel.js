/**
 * PitcherDetailPanel component for showing detailed pitcher information
 */
class PitcherDetailPanel {
    constructor(teamType) {
        this.teamType = teamType;
        this.element = null;
        this.activePitcher = null;
        this.onClose = null;
    }

    /**
     * Show the panel with pitcher details
     * @param {Object} pitcher - Pitcher data to display
     * @param {Function} onClose - Callback when panel is closed
     */
    show(pitcher, onClose) {
        this.activePitcher = pitcher;
        this.onClose = onClose;

        if (this.element) {
            this.updateContent(pitcher);
        } else {
            this.create(pitcher);
        }
    }

    /**
     * Create the panel element
     * @param {Object} pitcher - Pitcher data to display
     */
    create(pitcher) {
        const panel = document.createElement('div');
        panel.className = `pitcher-detail-panel panel-${this.teamType}`;
        
        this.updatePanelContent(panel, pitcher);

        // Add close button handler
        panel.querySelector('.pitcher-detail-close').addEventListener('click', () => {
            this.close();
        });

        // Add click outside handler
        document.addEventListener('click', (e) => {
            if (this.element && !this.element.contains(e.target) && !e.target.closest('.pitcher-container')) {
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
     * Update panel with new pitcher data
     * @param {Object} pitcher - New pitcher data to display
     */
    updateContent(pitcher) {
        if (!this.element) return;

        // Create temporary div for new content
        const temp = document.createElement('div');
        this.updatePanelContent(temp, pitcher);

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

        this.activePitcher = pitcher;
    }

    /**
     * Update panel content with pitcher data
     * @param {HTMLElement} panel - Panel element to update
     * @param {Object} pitcher - Pitcher data to display
     */
    updatePanelContent(panel, pitcher) {
        // Check if teamId exists, otherwise omit the team logo section
        const teamLogoSection = pitcher.teamId ? 
            `<div class="pitcher-team-logo">
                <img src="https://www.mlbstatic.com/team-logos/${pitcher.teamId}.svg" 
                     alt="Team Logo" 
                     class="team-logo-detail">
            </div>` : '';
        
        panel.innerHTML = `
            <button class="pitcher-detail-close">&times;</button>
            <div class="panel-content">
                <div class="pitcher-detail-header">
                    <img class="pitcher-detail-img"
                         src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${pitcher.id}/headshot/67/current"
                         alt="${pitcher.name}">
                    <h2 class="pitcher-detail-name">${pitcher.name}</h2>
                    <div class="pitcher-detail-position">Pitcher</div>
                </div>
                <div class="pitcher-stats-grid">
                    <div class="stat-item" title="The total number of innings a pitcher has thrown, where each out recorded equals 1/3 of an inning">
                        <div class="stat-label">Innings Pitched</div>
                        <div class="stat-value">${pitcher.stats.inningsPitched || '0'}</div>
                    </div>
                    <div class="stat-item" title="The total number of hits allowed by the pitcher">
                        <div class="stat-label">Hits</div>
                        <div class="stat-value">${pitcher.stats.hits || '0'}</div>
                    </div>
                    <div class="stat-item" title="The total number of runs scored against the pitcher">
                        <div class="stat-label">Runs</div>
                        <div class="stat-value">${pitcher.stats.runs || '0'}</div>
                    </div>
                    <div class="stat-item" title="Runs that scored without the aid of an error or passed ball - a measure of the pitcher's effectiveness">
                        <div class="stat-label">Earned Runs</div>
                        <div class="stat-value">${pitcher.stats.earnedRuns || '0'}</div>
                    </div>
                    <div class="stat-item" title="The number of times a pitcher has given a batter a base on balls (walked a batter)">
                        <div class="stat-label">Walks</div>
                        <div class="stat-value">${pitcher.stats.baseOnBalls || '0'}</div>
                    </div>
                    <div class="stat-item" title="The number of times a pitcher has gotten a batter out on strikes">
                        <div class="stat-label">Strikeouts</div>
                        <div class="stat-value">${pitcher.stats.strikeOuts || '0'}</div>
                    </div>
                    <div class="stat-item" title="The number of home runs allowed by the pitcher">
                        <div class="stat-label">Home Runs</div>
                        <div class="stat-value">${pitcher.stats.homeRuns || '0'}</div>
                    </div>
                    <div class="stat-item stat-item-combined" title="Total games won and lost by the pitcher when they were the pitcher of record">
                        <div class="stat-label">Wins - Losses</div>
                        <div class="stat-value">${pitcher.stats.wins || '0'} - ${pitcher.stats.losses || '0'}</div>
                    </div>
                    <div class="stat-item stat-item-combined" title="ERA: Earned Run Average - The average of earned runs allowed per 9 innings pitched. WHIP: Walks plus Hits per Inning Pitched - A measure of a pitcher's ability to prevent batters from reaching base">
                        <div class="stat-label">ERA / WHIP</div>
                        <div class="stat-value">${pitcher.stats.era || '0.00'} / ${pitcher.stats.whip || '0.00'}</div>
                    </div>
                    <div class="stat-item" title="The total number of games in which the pitcher has appeared">
                        <div class="stat-label">Games</div>
                        <div class="stat-value">${pitcher.stats.gamesPlayed || '0'}</div>
                    </div>
                </div>
                ${teamLogoSection}
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
                this.activePitcher = null;
                
                if (this.onClose) {
                    this.onClose();
                }
            }, 300); // Match transition duration
        }
    }

    /**
     * Check if the panel is currently showing the given pitcher
     * @param {Object} pitcher - Pitcher to check
     * @returns {boolean} - True if panel is showing this pitcher
     */
    isShowingPitcher(pitcher) {
        return this.activePitcher && this.activePitcher.id === pitcher.id;
    }
}

export default PitcherDetailPanel;