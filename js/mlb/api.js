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
            console.log('Fetching URL:', url); // Debug log
            const cacheKey = Utils.createCacheKey(endpoint, params);
            return await this.cache.getOrFetch(cacheKey, async () => {
                console.log('Cache miss, fetching from API...'); // Debug log
                const response = await fetch(url);
                if (!response.ok) {
                    console.error('API Error:', response.status, response.statusText); // Debug log
                    throw new APIError(
                        `API request failed: ${response.statusText}`,
                        response.status,
                        endpoint
                    );
                }
                const data = await response.json();
                console.log('API Response:', data); // Debug log
                return data;
            });
        } catch (error) {
            console.error('API Request Error:', error); // Debug log
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
            const team = boxscore.teams[teamType];
            boxscore.teams?.[teamType]?.battingOrder?.forEach(playerId => {
                const player = team.players[`ID${playerId}`];
                
                if (player) {
                    lineups[teamType].push({
                        id: playerId,
                        name: Utils.getPlayerName(player),
                        position: player.position?.abbreviation || 'N/A',
                        teamId: team.team.id,
                        stats: Utils.processPlayerStats(
                            player.seasonStats?.batting || player.stats?.batting,
                            'batting'
                        )
                    });
                }
            });
        });
        
        return lineups;
    },

    /**
     * Fetch all starting pitchers from a team
     * @param {number} teamId - The team ID to fetch pitchers for
     * @returns {Promise<Array>} - Promise resolving to an array of pitchers with stats
     */
    async fetchTeamPitchers(teamId) {
        try {
            const seasonYear = new Date().getFullYear();
            
            // Get the team roster with focus on pitchers
            const roster = await this.apiRequest(`/teams/${teamId}/roster`, {
                rosterType: 'active',
                season: seasonYear
            });

            // Filter for pitchers
            const pitchersData = roster.roster.filter(player => 
                player.position.code === '1' // Position code '1' is for pitchers
            );

            // Get stats for all pitchers in parallel
            const pitchersWithStats = await Promise.all(
                pitchersData.map(async player => {
                    const playerStats = await this.apiRequest(`/people/${player.person.id}/stats`, {
                        stats: 'season',
                        season: seasonYear,
                        group: 'pitching'
                    });
                    
                    let stats = null;
                    if (playerStats.stats && playerStats.stats[0] && playerStats.stats[0].splits && playerStats.stats[0].splits[0]) {
                        const statData = playerStats.stats[0].splits[0].stat;
                        
                        // Only include starting pitchers (with games started > 0)
                        if (statData.gamesPitched && statData.gamesStarted > 0) {
                            stats = {
                                gamesPlayed: statData.gamesPlayed || statData.games || '0',
                                era: statData.era || '0.00',
                                wins: statData.wins || '0',
                                losses: statData.losses || '0',
                                inningsPitched: statData.inningsPitched || '0',
                                hits: statData.hits || '0',
                                runs: statData.runs || '0',
                                earnedRuns: statData.earnedRuns || '0',
                                baseOnBalls: statData.baseOnBalls || '0',
                                strikeOuts: statData.strikeOuts || '0',
                                homeRuns: statData.homeRuns || '0',
                                whip: statData.whip || '0.00',
                                gamesStarted: statData.gamesStarted || '0'
                            };
                        }
                    }
                    
                    // Get detailed player info to ensure we have the correct name
                    const playerInfo = await this.apiRequest(`/people/${player.person.id}`);
                    let playerName = 'Unknown Player';
                    
                    // Try different approaches to get the player name
                    if (playerInfo && playerInfo.people && playerInfo.people[0]) {
                        const person = playerInfo.people[0];
                        
                        // First try using fullName
                        if (person.fullName) {
                            playerName = person.fullName;
                        }
                        // Then try using firstName and lastName if they exist
                        else if (person.firstName && person.lastName) {
                            playerName = `${person.firstName} ${person.lastName}`;
                        }
                        // As a fallback, use the name from the roster
                        else if (player.person.fullName) {
                            playerName = player.person.fullName;
                        }
                        // Last resort
                        else if (player.person.firstName || player.person.lastName) {
                            playerName = `${player.person.firstName || ''} ${player.person.lastName || ''}`.trim();
                        }
                    }
                    
                    // Only return pitchers with stats who have started games
                    if (stats) {
                        return {
                            id: player.person.id,
                            name: playerName,
                            teamId: teamId,
                            stats: stats
                        };
                    }
                    return null;
                })
            );

            // Remove null entries (pitchers without stats or non-starters)
            return pitchersWithStats.filter(pitcher => pitcher !== null);
        }
        catch (error) {
            console.error('Error fetching team pitchers:', error);
            throw error;
        }
    },
};