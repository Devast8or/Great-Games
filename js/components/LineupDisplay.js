/**
 * LineupDisplay component for showing team lineups
 */
class LineupDisplay {
    constructor(teamType, lineup = []) {
        this.teamType = teamType;
        this.lineup = lineup;
        this.element = null;
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
        
        if (this.lineup.length === 0) {
            container.innerHTML += '<div class="lineup-loading">Loading lineup...</div>';
        } else {
            container.appendChild(this.createLineupTable());
        }
        
        this.element = container;
        return container;
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
        
        // Player rows
        this.lineup.forEach((player, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="player-img-cell">
                    ${player.id ? `
                        <img class="player-small-img"
                             src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_45,q_auto:best/v1/people/${player.id}/headshot/67/current"
                             alt="${player.name}"
                             title="${player.name}">
                    ` : index + 1}
                </td>
                <td>${player.position}</td>
                <td>${player.name}</td>
                <td>${player.stats.gamesPlayed}</td>
                <td>${player.stats.avg}</td>
                <td>${player.stats.obp}</td>
                <td>${player.stats.ops}</td>
                <td>${player.stats.hr}</td>
                <td>${player.stats.rbi}</td>
            `;
            table.appendChild(row);
        });
        
        return table;
    }

    /**
     * Update lineup data
     * @param {Array} newLineup - New lineup data
     */
    update(newLineup) {
        this.lineup = newLineup;
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
    showError(message = 'Error loading lineup') {
        if (this.element) {
            this.element.innerHTML = `
                <h4>${this.teamType === 'away' ? 'Away' : 'Home'} Lineup</h4>
                <div class="error">${message}</div>
            `;
        }
    }
}

export default LineupDisplay;