/**
 * Utility helpers for NHL Great Games.
 */
const NHL_TEAMS = [
    { abbreviation: 'ANA', name: 'Anaheim Ducks', city: 'Anaheim' },
    { abbreviation: 'BOS', name: 'Boston Bruins', city: 'Boston' },
    { abbreviation: 'BUF', name: 'Buffalo Sabres', city: 'Buffalo' },
    { abbreviation: 'CGY', name: 'Calgary Flames', city: 'Calgary' },
    { abbreviation: 'CAR', name: 'Carolina Hurricanes', city: 'Carolina' },
    { abbreviation: 'CHI', name: 'Chicago Blackhawks', city: 'Chicago' },
    { abbreviation: 'COL', name: 'Colorado Avalanche', city: 'Colorado' },
    { abbreviation: 'CBJ', name: 'Columbus Blue Jackets', city: 'Columbus' },
    { abbreviation: 'DAL', name: 'Dallas Stars', city: 'Dallas' },
    { abbreviation: 'DET', name: 'Detroit Red Wings', city: 'Detroit' },
    { abbreviation: 'EDM', name: 'Edmonton Oilers', city: 'Edmonton' },
    { abbreviation: 'FLA', name: 'Florida Panthers', city: 'Florida' },
    { abbreviation: 'LAK', name: 'Los Angeles Kings', city: 'Los Angeles' },
    { abbreviation: 'MIN', name: 'Minnesota Wild', city: 'Minnesota' },
    { abbreviation: 'MTL', name: 'Montreal Canadiens', city: 'Montreal' },
    { abbreviation: 'NSH', name: 'Nashville Predators', city: 'Nashville' },
    { abbreviation: 'NJD', name: 'New Jersey Devils', city: 'New Jersey' },
    { abbreviation: 'NYI', name: 'New York Islanders', city: 'New York' },
    { abbreviation: 'NYR', name: 'New York Rangers', city: 'New York' },
    { abbreviation: 'OTT', name: 'Ottawa Senators', city: 'Ottawa' },
    { abbreviation: 'PHI', name: 'Philadelphia Flyers', city: 'Philadelphia' },
    { abbreviation: 'PIT', name: 'Pittsburgh Penguins', city: 'Pittsburgh' },
    { abbreviation: 'SEA', name: 'Seattle Kraken', city: 'Seattle' },
    { abbreviation: 'SJS', name: 'San Jose Sharks', city: 'San Jose' },
    { abbreviation: 'STL', name: 'St. Louis Blues', city: 'St. Louis' },
    { abbreviation: 'TBL', name: 'Tampa Bay Lightning', city: 'Tampa Bay' },
    { abbreviation: 'TOR', name: 'Toronto Maple Leafs', city: 'Toronto' },
    { abbreviation: 'UTA', name: 'Utah Mammoth', city: 'Utah' },
    { abbreviation: 'VAN', name: 'Vancouver Canucks', city: 'Vancouver' },
    { abbreviation: 'VGK', name: 'Vegas Golden Knights', city: 'Vegas' },
    { abbreviation: 'WSH', name: 'Washington Capitals', city: 'Washington' },
    { abbreviation: 'WPG', name: 'Winnipeg Jets', city: 'Winnipeg' }
];

const TEAM_BY_ABBREVIATION = NHL_TEAMS.reduce((map, team) => {
    map.set(team.abbreviation, team);
    return map;
}, new Map());

const TEAM_ID_BY_ABBREVIATION = NHL_TEAMS.reduce((map, team, index) => {
    map.set(team.abbreviation, index + 1);
    return map;
}, new Map());

const Utils = {
    createCacheKey(endpoint, params) {
        return `nhl_${endpoint}_${JSON.stringify(params)}`;
    },

    clamp(value, min = 0, max = 1) {
        if (!Number.isFinite(value)) {
            return min;
        }

        return Math.max(min, Math.min(max, value));
    },

    toNumber(value, fallback = 0) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    },

    toInteger(value, fallback = 0) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    },

    normalizeTeamAbbreviation(value) {
        return String(value || '').trim().toUpperCase();
    },

    getTeamIdByAbbreviation(abbreviation) {
        const normalized = this.normalizeTeamAbbreviation(abbreviation);
        if (!normalized) {
            return null;
        }

        return TEAM_ID_BY_ABBREVIATION.get(normalized) || null;
    },

    parseRecord(recordText) {
        if (!recordText || typeof recordText !== 'string') {
            return { wins: 0, losses: 0, otLosses: 0 };
        }

        const parts = recordText.split('-').map((part) => Number.parseInt(part, 10));
        return {
            wins: Number.isFinite(parts[0]) ? parts[0] : 0,
            losses: Number.isFinite(parts[1]) ? parts[1] : 0,
            otLosses: Number.isFinite(parts[2]) ? parts[2] : 0
        };
    },

    formatDateForDisplay(dateValue) {
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) {
            return 'Unknown Date';
        }

        return parsed.toISOString().split('T')[0];
    },

    formatGameTime(dateValue) {
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) {
            return 'Time TBD';
        }

        return parsed.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    getTeamInfo(teamId, fallback = {}) {
        const abbreviation = this.normalizeTeamAbbreviation(
            fallback.abbreviation || fallback.teamAbbreviation || ''
        );
        const knownByAbbreviation = TEAM_BY_ABBREVIATION.get(abbreviation) || null;

        return {
            id: Number.parseInt(teamId, 10) || 0,
            name: knownByAbbreviation?.name || fallback.name || fallback.teamName || abbreviation || `Team ${teamId}`,
            abbreviation: abbreviation || knownByAbbreviation?.abbreviation || 'NHL',
            city: knownByAbbreviation?.city || fallback.city || ''
        };
    },

    getTeamLogoUrl(teamReference, abbreviation = '') {
        const normalizedAbbreviation = this.normalizeTeamAbbreviation(abbreviation || teamReference);

        if (normalizedAbbreviation) {
            return `https://a.espncdn.com/i/teamlogos/nhl/500/${normalizedAbbreviation.toLowerCase()}.png`;
        }

        return 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nhl.png&w=80&h=80&transparent=true';
    },

    getAllTeams() {
        return NHL_TEAMS.map((team, index) => ({
            id: index + 1,
            name: team.name,
            abbreviation: team.abbreviation,
            city: team.city
        }));
    },

    getPeriodLabel(periodNumber) {
        if (periodNumber <= 3) {
            return `P${periodNumber}`;
        }

        if (periodNumber === 4) {
            return 'OT';
        }

        if (periodNumber === 5) {
            return 'SO';
        }

        return `OT${periodNumber - 3}`;
    }
};

export default Utils;
