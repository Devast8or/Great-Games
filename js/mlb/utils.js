/**
 * Utility functions for MLB Great Games application
 */
const Utils = {
    /**
     * Get player's full name from different API response formats
     * @param {Object} player - Player data from API
     * @returns {string} - Player's full name
     */
    getPlayerName(player) {
        if (player.person?.fullName) return player.person.fullName;
        if (player.person?.firstName && player.person?.lastName) {
            return `${player.person.firstName} ${player.person.lastName}`;
        }
        if (player.fullName) return player.fullName;
        if (player.firstName && player.lastName) {
            return `${player.firstName} ${player.lastName}`;
        }
        if (player.name) return player.name;
        return 'Unknown Player';
    },

    /**
     * Process player stats with default values
     * @param {Object} stats - Raw stats object
     * @param {string} type - Type of stats ('batting' or 'pitching')
     * @returns {Object} - Processed stats with defaults
     */
    processPlayerStats(stats, type) {
        if (type === 'batting') {
            return {
                gamesPlayed: stats?.gamesPlayed || '0',
                atBats: stats?.atBats || '0',
                runs: stats?.runs || '0',
                hits: stats?.hits || '0',
                doubles: stats?.doubles || '0',
                triples: stats?.triples || '0',
                hr: stats?.homeRuns || '0',
                rbi: stats?.rbi || '0',
                baseOnBalls: stats?.baseOnBalls || '0',
                strikeOuts: stats?.strikeOuts || '0',
                stolenBases: stats?.stolenBases || '0',
                caughtStealing: stats?.caughtStealing || '0',
                avg: stats?.avg || '.000',
                obp: stats?.obp || '.000',
                slg: stats?.slg || '.000',
                ops: stats?.ops || '.000'
            };
        } else if (type === 'pitching') {
            return {
                gamesPlayed: stats?.gamesPlayed || stats?.games || '0',
                era: stats?.era || '0.00',
                wins: stats?.wins || '0',
                losses: stats?.losses || '0',
                strikeOuts: stats?.strikeOuts || stats?.strikeouts || '0',
                inningsPitched: stats?.inningsPitched || '0.0',
                whip: stats?.whip || '0.00'
            };
        }
        return {};
    },

    /**
     * Format a division name to be more concise
     * @param {string} divisionName - Full division name
     * @returns {string} - Formatted division name
     */
    formatDivisionName(divisionName) {
        if (!divisionName) return 'Unknown Division';
        return divisionName
            .replace('American League', 'AL')
            .replace('National League', 'NL');
    },

    /**
     * Create a cache key for storing API responses
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Request parameters
     * @returns {string} - Cache key
     */
    createCacheKey(endpoint, params) {
        return `mlb_${endpoint}_${JSON.stringify(params)}`;
    },

    /**
     * Format inning number with proper suffix (1st, 2nd, 3rd, etc)
     * @param {number} inning - Inning number
     * @returns {string} - Formatted inning string
     */
    getInningString(inning) {
        const suffixes = {
            1: 'st',
            2: 'nd',
            3: 'rd'
        };
        const suffix = (inning >= 11 && inning <= 13) ? 'th' : suffixes[inning % 10] || 'th';
        return `${inning}${suffix}`;
    }
};

export default Utils;