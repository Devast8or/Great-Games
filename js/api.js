/**
 * API handling for MLB Game data
 */
import Utils from './utils.js';
import APICache from './cache.js';

export class APIError extends Error {
    constructor(message, status, endpoint) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.endpoint = endpoint;
    }
}

export const API = {
    BASE_URL: 'https://statsapi.mlb.com/api/v1',
    cache: new APICache(),

    /**
     * Make an API request with error handling and caching
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {Promise} - Promise with response data
     */
    async apiRequest(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
        
        try {
            const cacheKey = Utils.createCacheKey(endpoint, params);
            return await this.cache.getOrFetch(cacheKey, async () => {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new APIError(
                        `API request failed: ${response.statusText}`,
                        response.status,
                        endpoint
                    );
                }
                return await response.json();
            });
        } catch (error) {
            if (error instanceof APIError) throw error;
            throw new APIError('Network error', 0, endpoint);
        }
    },

    async fetchGames(date) {
        return this.apiRequest('/schedule', {
            sportId: 1,
            date,
            hydrate: 'team,linescore,game(content(media(epg))),probablePitcher'
        });
    },

    async fetchStandings(date) {
        return this.apiRequest('/standings', {
            leagueId: '103,104',
            season: date.substring(0, 4),
            date,
            hydrate: 'team,division'
        });
    },

    processTeamRankings(standingsData) {
        const teamRankings = {};
        
        if (standingsData?.records) {
            standingsData.records.forEach(record => {
                const divisionName = Utils.formatDivisionName(record.division?.name);
                
                record.teamRecords?.forEach(teamRecord => {
                    teamRankings[teamRecord.team.id] = {
                        divisionRank: parseInt(teamRecord.divisionRank) || 0,
                        divisionName,
                        winPercentage: teamRecord.winningPercentage || 0,
                        gamesBack: teamRecord.gamesBack || 0
                    };
                });
            });
        }
        
        return teamRankings;
    },

    async fetchGameStats(gameId) {
        return this.apiRequest(`/game/${gameId}/boxscore`);
    },

    async fetchStartingPitchers(gameId) {
        const boxscore = await this.fetchGameStats(gameId);
        return this.extractStartingPitchers(boxscore);
    },

    extractStartingPitchers(boxscore) {
        const pitchers = { away: null, home: null };
        
        ['away', 'home'].forEach(teamType => {
            if (boxscore.teams?.[teamType]?.pitchers?.length > 0) {
                const startingPitcherId = boxscore.teams[teamType].pitchers[0];
                const pitcher = boxscore.teams[teamType].players[`ID${startingPitcherId}`];
                
                if (pitcher) {
                    pitchers[teamType] = {
                        id: startingPitcherId,
                        name: Utils.getPlayerName(pitcher),
                        stats: Utils.processPlayerStats(
                            pitcher.seasonStats?.pitching || pitcher.stats?.pitching,
                            'pitching'
                        )
                    };
                }
            }
        });
        
        return pitchers;
    },

    getTeamLogoUrl(teamId) {
        return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
    },

    async fetchStartingLineups(gameId) {
        const boxscore = await this.fetchGameStats(gameId);
        return this.extractStartingLineups(boxscore);
    },

    extractStartingLineups(boxscore) {
        const lineups = { away: [], home: [] };
        
        ['away', 'home'].forEach(teamType => {
            boxscore.teams?.[teamType]?.battingOrder?.forEach(playerId => {
                const player = boxscore.teams[teamType].players[`ID${playerId}`];
                
                if (player) {
                    lineups[teamType].push({
                        id: playerId,
                        name: Utils.getPlayerName(player),
                        position: player.position?.abbreviation || 'N/A',
                        stats: Utils.processPlayerStats(
                            player.seasonStats?.batting || player.stats?.batting,
                            'batting'
                        )
                    });
                }
            });
        });
        
        return lineups;
    }
};