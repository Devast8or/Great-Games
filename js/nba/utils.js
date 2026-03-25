/**
 * Utility helpers for NBA Great Games.
 */
const TEAM_DATA = {
    1610612737: { name: 'Atlanta Hawks', abbreviation: 'ATL', city: 'Atlanta' },
    1610612738: { name: 'Boston Celtics', abbreviation: 'BOS', city: 'Boston' },
    1610612751: { name: 'Brooklyn Nets', abbreviation: 'BKN', city: 'Brooklyn' },
    1610612766: { name: 'Charlotte Hornets', abbreviation: 'CHA', city: 'Charlotte' },
    1610612741: { name: 'Chicago Bulls', abbreviation: 'CHI', city: 'Chicago' },
    1610612739: { name: 'Cleveland Cavaliers', abbreviation: 'CLE', city: 'Cleveland' },
    1610612742: { name: 'Dallas Mavericks', abbreviation: 'DAL', city: 'Dallas' },
    1610612743: { name: 'Denver Nuggets', abbreviation: 'DEN', city: 'Denver' },
    1610612765: { name: 'Detroit Pistons', abbreviation: 'DET', city: 'Detroit' },
    1610612744: { name: 'Golden State Warriors', abbreviation: 'GSW', city: 'Golden State' },
    1610612745: { name: 'Houston Rockets', abbreviation: 'HOU', city: 'Houston' },
    1610612754: { name: 'Indiana Pacers', abbreviation: 'IND', city: 'Indiana' },
    1610612746: { name: 'LA Clippers', abbreviation: 'LAC', city: 'Los Angeles' },
    1610612747: { name: 'Los Angeles Lakers', abbreviation: 'LAL', city: 'Los Angeles' },
    1610612763: { name: 'Memphis Grizzlies', abbreviation: 'MEM', city: 'Memphis' },
    1610612748: { name: 'Miami Heat', abbreviation: 'MIA', city: 'Miami' },
    1610612749: { name: 'Milwaukee Bucks', abbreviation: 'MIL', city: 'Milwaukee' },
    1610612750: { name: 'Minnesota Timberwolves', abbreviation: 'MIN', city: 'Minnesota' },
    1610612740: { name: 'New Orleans Pelicans', abbreviation: 'NOP', city: 'New Orleans' },
    1610612752: { name: 'New York Knicks', abbreviation: 'NYK', city: 'New York' },
    1610612760: { name: 'Oklahoma City Thunder', abbreviation: 'OKC', city: 'Oklahoma City' },
    1610612753: { name: 'Orlando Magic', abbreviation: 'ORL', city: 'Orlando' },
    1610612755: { name: 'Philadelphia 76ers', abbreviation: 'PHI', city: 'Philadelphia' },
    1610612756: { name: 'Phoenix Suns', abbreviation: 'PHX', city: 'Phoenix' },
    1610612757: { name: 'Portland Trail Blazers', abbreviation: 'POR', city: 'Portland' },
    1610612758: { name: 'Sacramento Kings', abbreviation: 'SAC', city: 'Sacramento' },
    1610612759: { name: 'San Antonio Spurs', abbreviation: 'SAS', city: 'San Antonio' },
    1610612761: { name: 'Toronto Raptors', abbreviation: 'TOR', city: 'Toronto' },
    1610612762: { name: 'Utah Jazz', abbreviation: 'UTA', city: 'Utah' },
    1610612764: { name: 'Washington Wizards', abbreviation: 'WAS', city: 'Washington' }
};

const TEAM_ID_BY_ABBREVIATION = Object.entries(TEAM_DATA).reduce((map, [teamId, team]) => {
    const abbreviation = String(team?.abbreviation || '').trim().toUpperCase();
    if (abbreviation) {
        map.set(abbreviation, Number.parseInt(teamId, 10));
    }

    return map;
}, new Map());

const Utils = {
    createCacheKey(endpoint, params) {
        return `nba_${endpoint}_${JSON.stringify(params)}`;
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
            return { wins: 0, losses: 0 };
        }

        const parts = recordText.split('-').map((part) => Number.parseInt(part, 10));
        if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
            return { wins: 0, losses: 0 };
        }

        return {
            wins: parts[0],
            losses: parts[1]
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
        const numericTeamId = Number.parseInt(teamId, 10);
        const known = TEAM_DATA[numericTeamId] || null;

        if (!known) {
            return {
                id: numericTeamId,
                name: fallback.name || fallback.teamName || fallback.abbreviation || `Team ${teamId}`,
                abbreviation: fallback.abbreviation || fallback.teamAbbreviation || 'NBA',
                city: fallback.city || ''
            };
        }

        return {
            id: numericTeamId,
            name: known.name,
            abbreviation: known.abbreviation,
            city: known.city
        };
    },

    getTeamLogoUrl(teamId) {
        const numericTeamId = Number.parseInt(teamId, 10);
        return `https://cdn.nba.com/logos/nba/${numericTeamId}/global/L/logo.svg`;
    },

    getAllTeams() {
        return Object.entries(TEAM_DATA)
            .map(([id, team]) => ({
                id: Number.parseInt(id, 10),
                name: String(team?.name || '').trim(),
                abbreviation: String(team?.abbreviation || '').trim(),
                city: String(team?.city || '').trim()
            }))
            .filter((team) => Number.isFinite(team.id) && team.name)
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    getPeriodLabel(periodNumber) {
        if (periodNumber <= 4) {
            return `Q${periodNumber}`;
        }

        return `OT${periodNumber - 4}`;
    }
};

export default Utils;
