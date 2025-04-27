/**
 * PitcherDisplay component for showing pitcher information
 */
import PitcherDetailPanel from './PitcherDetailPanel.js';

class PitcherDisplay {
    constructor(pitcher, teamType) {
        this.pitcher = pitcher;
        this.teamType = teamType;
        this.element = null;
        this.pitcherPanel = new PitcherDetailPanel(teamType);
    }

    /**
     * Render the pitcher display
     * @returns {HTMLElement} - Pitcher display element
     */
    render() {
        const container = document.createElement('div');
        container.className = `pitcher-container ${this.teamType}-pitcher-container`;
        
        if (!this.pitcher) {
            container.classList.add('hidden');
            this.element = container;
            return container;
        }
        
        const imageUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${this.pitcher.id}/headshot/67/current`;
        
        container.innerHTML = `
            <div class="pitcher-img ${this.teamType}-pitcher-img">
                <img src="${imageUrl}"
                     alt="${this.pitcher.name}"
                     title="${this.pitcher.name}"
                     onerror="this.src='https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png'">
            </div>
            <div class="pitcher-name">${this.pitcher.name}</div>
            <div class="pitcher-stats">
                ${this.formatStats()}
            </div>
        `;
        
        // Add click handler to show the pitcher detail panel
        container.addEventListener('click', () => this.showPitcherDetails());
        
        this.element = container;
        return container;
    }

    /**
     * Show pitcher details in panel
     */
    showPitcherDetails() {
        if (!this.pitcher) return;
        
        if (this.pitcherPanel.isShowingPitcher(this.pitcher)) {
            this.pitcherPanel.close();
            return;
        }

        this.pitcherPanel.show(this.pitcher, () => {
            // Callback when panel is closed
            if (this.element) {
                this.element.classList.remove('active-pitcher');
            }
        });
        
        if (this.element) {
            this.element.classList.add('active-pitcher');
        }
    }

    /**
     * Format pitcher stats for display
     * @returns {string} - Formatted stats string
     */
    formatStats() {
        if (!this.pitcher.stats) return 'Stats not available';
        
        const stats = this.pitcher.stats;
        const hasSeason = Number(stats.wins) > 0 || Number(stats.losses) > 0;
        const winLoss = hasSeason ? `, ${stats.wins}-${stats.losses}` : '';
        
        return `${stats.gamesPlayed} G, ${stats.era} ERA${winLoss}`;
    }

    /**
     * Update pitcher data
     * @param {Object} newPitcher - New pitcher data
     */
    update(newPitcher) {
        this.pitcher = newPitcher;
        if (this.element) {
            // Instead of replacing the entire element, just update its contents
            if (!newPitcher) {
                this.element.classList.add('hidden');
                return;
            }
            
            this.element.classList.remove('hidden');
            const imageUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${newPitcher.id}/headshot/67/current`;
            
            this.element.innerHTML = `
                <div class="pitcher-img ${this.teamType}-pitcher-img">
                    <img src="${imageUrl}"
                         alt="${newPitcher.name}"
                         title="${newPitcher.name}"
                         onerror="this.src='https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png'">
                </div>
                <div class="pitcher-name">${newPitcher.name}</div>
                <div class="pitcher-stats">
                    ${this.formatStats()}
                </div>
            `;
        } else {
            this.render();
        }
    }
}

export default PitcherDisplay;