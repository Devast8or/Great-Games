/**
 * PitcherDisplay component for showing pitcher information
 */
class PitcherDisplay {
    constructor(pitcher, teamType) {
        this.pitcher = pitcher;
        this.teamType = teamType;
        this.element = null;
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
        
        this.element = container;
        return container;
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
            const newElement = this.render();
            this.element.parentNode.replaceChild(newElement, this.element);
            this.element = newElement;
        }
    }
}

export default PitcherDisplay;