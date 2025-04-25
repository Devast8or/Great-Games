/**
 * Parser module for processing MLB game data
 */
import Utils from './utils.js';
import { API } from './api.js';

export class Parser {
    /**
     * Process API response data into a usable game format
     * @param {Object} apiData - Raw API response
     * @returns {Array} - Array of processed game objects
     */
    static processGames(apiData) {
        if (!apiData.dates?.length) return [];
        
        const games = [];
        
        apiData.dates.forEach(date => {
            if (!date.games?.length) return;
            
            date.games.forEach(game => {
                if (game.status.abstractGameState === 'Final') {
                    try {
                        games.push(this.processGameData(game));
                    } catch (error) {
                        console.error(`Error processing game ${game.gamePk}:`, error);
                    }
                }
            });
        });
        
        return games;
    }

    /**
     * Process individual game data
     * @param {Object} game - Raw game data
     * @returns {Object} - Processed game object
     */
    static processGameData(game) {
        const awayTeam = game.teams.away;
        const homeTeam = game.teams.home;

        // Process linescore data
        const innings = game.linescore?.innings || [];
        const leadChanges = this.countLeadChanges(innings, awayTeam.team.id, homeTeam.team.id);
        const isExtraInnings = innings.length > 9;
        const totalRuns = awayTeam.score + homeTeam.score;
        const runDifference = Math.abs(awayTeam.score - homeTeam.score);

        // Extract hits and errors
        const awayHits = game.linescore?.teams?.away?.hits || 0;
        const awayErrors = game.linescore?.teams?.away?.errors || 0;
        const homeHits = game.linescore?.teams?.home?.hits || 0;
        const homeErrors = game.linescore?.teams?.home?.errors || 0;

        // Process inning-by-inning scoring
        const inningScores = innings.map(inning => ({
            inningNumber: inning.num,
            away: inning.away?.runs || 0,
            home: inning.home?.runs || 0
        }));

        return {
            id: game.gamePk,
            date: game.gameDate,
            status: game.status.detailedState,
            awayTeam: {
                id: awayTeam.team.id,
                name: awayTeam.team.name,
                score: awayTeam.score,
                hits: awayHits,
                errors: awayErrors,
                pitcher: this.extractPitcher(awayTeam.probablePitcher),
                lineup: [],
                logoUrl: API.getTeamLogoUrl(awayTeam.team.id)
            },
            homeTeam: {
                id: homeTeam.team.id,
                name: homeTeam.team.name,
                score: homeTeam.score,
                hits: homeHits,
                errors: homeErrors,
                pitcher: this.extractPitcher(homeTeam.probablePitcher),
                lineup: [],
                logoUrl: API.getTeamLogoUrl(homeTeam.team.id)
            },
            venue: game.venue?.name || 'Unknown Venue',
            innings: innings.length,
            inningScores,
            isExtraInnings,
            leadChanges,
            totalRuns,
            runDifference,
            isCloseGame: runDifference <= 2,
            isHighScoring: totalRuns >= 10,
            lineupsLoaded: false
        };
    }

    /**
     * Extract pitcher information
     * @param {Object} pitcher - Raw pitcher data
     * @returns {Object|null} - Processed pitcher object
     */
    static extractPitcher(pitcher) {
        if (!pitcher) return null;
        
        return {
            id: pitcher.id,
            name: Utils.getPlayerName(pitcher),
            stats: null // Stats will be loaded separately when needed
        };
    }

    /**
     * Count lead changes in a game
     * @param {Array} innings - Innings data
     * @param {number} awayTeamId - Away team ID
     * @param {number} homeTeamId - Home team ID
     * @returns {number} - Number of lead changes
     */
    static countLeadChanges(innings, awayTeamId, homeTeamId) {
        if (!innings?.length) return 0;
        
        let leadChanges = 0;
        let awayScore = 0;
        let homeScore = 0;
        let currentLeader = null;
        
        for (const inning of innings) {
            // Add away team runs for this inning
            if (inning.away?.runs != null) {
                awayScore += inning.away.runs;
                
                // Check if away team took the lead
                if (awayScore > homeScore) {
                    if (currentLeader !== awayTeamId && currentLeader !== null) {
                        leadChanges++;
                    }
                    currentLeader = awayTeamId;
                }
            }
            
            // Add home team runs for this inning
            if (inning.home?.runs != null) {
                homeScore += inning.home.runs;
                
                // Check if home team took the lead
                if (homeScore > awayScore) {
                    if (currentLeader !== homeTeamId && currentLeader !== null) {
                        leadChanges++;
                    }
                    currentLeader = homeTeamId;
                } else if (homeScore === awayScore) {
                    // If game is tied, no one has the lead
                    currentLeader = null;
                }
            }
        }
        
        return leadChanges;
    }

    /**
     * Process future games data
     * @param {Object} apiData - Raw API response
     * @returns {Array} - Array of processed future game objects
     */
    static processFutureGames(apiData) {
        if (!apiData.dates?.length) return [];
        
        const games = [];
        
        apiData.dates.forEach(date => {
            if (!date.games?.length) return;
            
            date.games.forEach(game => {
                if (['Preview', 'Scheduled'].includes(game.status.abstractGameState)) {
                    try {
                        games.push(this.processFutureGame(game));
                    } catch (error) {
                        console.error(`Error processing future game ${game.gamePk}:`, error);
                    }
                }
            });
        });
        
        return games;
    }

    /**
     * Process individual future game data
     * @param {Object} game - Raw game data
     * @returns {Object} - Processed future game object
     */
    static processFutureGame(game) {
        const awayTeam = game.teams.away;
        const homeTeam = game.teams.home;
        
        return {
            id: game.gamePk,
            date: game.gameDate,
            status: game.status.detailedState,
            gameTime: new Date(game.gameDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            isFuture: true,
            awayTeam: {
                id: awayTeam.team.id,
                name: awayTeam.team.name,
                logoUrl: API.getTeamLogoUrl(awayTeam.team.id),
                pitcher: this.extractFuturePitcher(awayTeam.probablePitcher),
                lineup: []
            },
            homeTeam: {
                id: homeTeam.team.id,
                name: homeTeam.team.name,
                logoUrl: API.getTeamLogoUrl(homeTeam.team.id),
                pitcher: this.extractFuturePitcher(homeTeam.probablePitcher),
                lineup: []
            },
            venue: game.venue?.name || 'Unknown Venue'
        };
    }

    /**
     * Extract pitcher information for future games
     * @param {Object} pitcher - Raw pitcher data
     * @returns {Object|null} - Processed pitcher object
     */
    static extractFuturePitcher(pitcher) {
        if (!pitcher) return null;
        
        return {
            id: pitcher.id,
            name: pitcher.fullName || `${pitcher.firstName} ${pitcher.lastName}` || 'TBD',
            stats: null
        };
    }
}