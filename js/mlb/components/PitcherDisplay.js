/**
 * PitcherDisplay component for showing pitcher information
 */
import PitcherDetailPanel from './PitcherDetailPanel.js';

class PitcherDisplay {
    constructor(pitcher, teamType, options = {}) {
        this.pitcher = pitcher;
        this.teamType = teamType;
        this.displayImageUrl = options.displayImageUrl || null;
        this.headshotFallbackUrl = 'assets/mlb/unknown-player-headshot.png';
        this.element = null;
        this.pitcherPanel = new PitcherDetailPanel(teamType);
    }

    getHeadshotUrl(pitcherId) {
        return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${pitcherId}/headshot/67/current`;
    }

    getPitcherDisplayData(pitcher = this.pitcher) {
        const pitcherId = Number(pitcher?.id);

        return {
            hasPitcherData: Boolean(pitcher),
            id: Number.isFinite(pitcherId) ? pitcherId : null,
            name: pitcher?.name || 'Unknown Pitcher',
            stats: pitcher?.stats || null
        };
    }

    getDisplayImageUrl(pitcher) {
        if (this.displayImageUrl) {
            return this.displayImageUrl;
        }

        if (!pitcher?.id) {
            return this.headshotFallbackUrl;
        }

        return this.getHeadshotUrl(pitcher?.id);
    }

    /**
     * Render the pitcher display
     * @returns {HTMLElement} - Pitcher display element
     */
    render() {
        const container = document.createElement('div');
        container.className = `pitcher-container ${this.teamType}-pitcher-container`;

        const pitcherData = this.getPitcherDisplayData();
        const imageUrl = this.getDisplayImageUrl(pitcherData);
        container.classList.toggle('pitcher-data-missing', !pitcherData.hasPitcherData);
        
        container.innerHTML = `
            <div class="pitcher-img ${this.teamType}-pitcher-img">
                <img src="${imageUrl}"
                     alt="${pitcherData.name}"
                     title="${pitcherData.name}"
                     onerror="this.src='${this.headshotFallbackUrl}'">
            </div>
            <div class="pitcher-card-body">
                <div class="pitcher-name">${pitcherData.name}</div>
                <div class="pitcher-stats">
                    ${this.formatStats(pitcherData)}
                </div>
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
        
        // Make sure the pitcher has a teamId property
        if (!this.pitcher.teamId) {
            // Try to get the team ID from the parent container
            const teamContainer = this.element.closest('.team-lineup-column');
            if (teamContainer) {
                // Extract team ID from the team's container class
                if (teamContainer.classList.contains('away-column')) {
                    const awayTeam = document.querySelector('.away .team-logo');
                    if (awayTeam && awayTeam.src) {
                        const teamIdMatch = awayTeam.src.match(/team-logos\/(\d+)\.svg/);
                        if (teamIdMatch && teamIdMatch[1]) {
                            this.pitcher.teamId = teamIdMatch[1];
                        }
                    }
                } else if (teamContainer.classList.contains('home-column')) {
                    const homeTeam = document.querySelector('.home .team-logo');
                    if (homeTeam && homeTeam.src) {
                        const teamIdMatch = homeTeam.src.match(/team-logos\/(\d+)\.svg/);
                        if (teamIdMatch && teamIdMatch[1]) {
                            this.pitcher.teamId = teamIdMatch[1];
                        }
                    }
                }
            }
        }
        
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
    formatStats(pitcher = this.pitcher) {
        if (!pitcher?.stats) return 'Not Avaliable';

        const stats = pitcher.stats;
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
            const pitcherData = this.getPitcherDisplayData(newPitcher);
            const imageUrl = this.getDisplayImageUrl(pitcherData);

            this.element.classList.remove('hidden');
            this.element.classList.toggle('pitcher-data-missing', !pitcherData.hasPitcherData);
            
            this.element.innerHTML = `
                <div class="pitcher-img ${this.teamType}-pitcher-img">
                    <img src="${imageUrl}"
                         alt="${pitcherData.name}"
                         title="${pitcherData.name}"
                         onerror="this.src='${this.headshotFallbackUrl}'">
                </div>
                <div class="pitcher-card-body">
                    <div class="pitcher-name">${pitcherData.name}</div>
                    <div class="pitcher-stats">
                        ${this.formatStats(pitcherData)}
                    </div>
                </div>
            `;
        } else {
            this.render();
        }
    }
}

export default PitcherDisplay;