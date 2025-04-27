/**
 * Parse raw game data into a standardized format
 */
import { API } from './api.js';
import Utils from './utils.js';

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

        // Add late game drama properties
        const lastLeadChangeInning = this.findLastLeadChangeInning(game);
        const isWalkoff = this.isWalkoffGame(game);
        
        // Calculate maximum lead for comeback detection
        const { maxLead, comebackTeamId } = this.findMaximumLeadAndComeback(innings, awayTeam.team.id, homeTeam.team.id, awayTeam.score, homeTeam.score);
        const hasComebackWin = comebackTeamId !== null;
        
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
            lineupsLoaded: false,
            lastLeadChangeInning,
            isWalkoff,
            inning: game.inning || 9,
            maxLead,
            hasComebackWin,
            comebackTeamId
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

    /**
     * Find the inning of the last lead change
     * @param {Object} gameData - Raw game data
     * @returns {number} - Inning number of last lead change
     */
    static findLastLeadChangeInning(gameData) {
        if (!gameData.linescore?.innings) return 0;
        
        let lastLeadChangeInning = 0;
        let awayScore = 0;
        let homeScore = 0;
        let previousLeader = null;
        
        gameData.linescore.innings.forEach(inning => {
            // Update scores
            awayScore += inning.away?.runs || 0;
            homeScore += inning.home?.runs || 0;
            
            // Determine current leader
            const currentLeader = awayScore > homeScore ? 'away' :
                                homeScore > awayScore ? 'home' : 'tie';
            
            // Check for lead change
            if (currentLeader !== previousLeader && currentLeader !== 'tie') {
                lastLeadChangeInning = inning.num;
            }
            
            previousLeader = currentLeader;
        });
        
        return lastLeadChangeInning;
    }

    /**
     * Determine if the game ended in a walk-off
     * @param {Object} gameData - Raw game data
     * @returns {boolean} - True if game ended in walk-off
     */
    static isWalkoffGame(gameData) {
        // Game is a walkoff if:
        // 1. Home team won
        // 2. Game ended in 9th or later
        // 3. Home team was tied or behind entering their last at-bat
        const innings = gameData.linescore?.innings || [];
        if (innings.length === 0) return false;

        const lastInning = innings[innings.length - 1];
        const awayScore = gameData.teams.away.score;
        const homeScore = gameData.teams.home.score;
        
        // Check if home team won
        if (homeScore <= awayScore) return false;
        
        // Check if game ended in 9th or later
        if (lastInning.num < 9) return false;
        
        // Calculate score before final half-inning
        const awayFinalScore = awayScore;
        const homeFinalScore = homeScore;
        const homeScoreBeforeLast = homeFinalScore - (lastInning.home?.runs || 0);
        
        // It's a walkoff if home team was tied or behind before their last at-bat
        return homeScoreBeforeLast <= awayFinalScore;
    }

    /**
     * Find the maximum lead in a game and determine if there was a comeback win
     * @param {Array} innings - Innings data
     * @param {number} awayTeamId - Away team ID
     * @param {number} homeTeamId - Home team ID
     * @param {number} finalAwayScore - Final away team score
     * @param {number} finalHomeScore - Final home team score
     * @returns {Object} - Object with maxLead and comebackTeamId
     */
    static findMaximumLeadAndComeback(innings, awayTeamId, homeTeamId, finalAwayScore, finalHomeScore) {
        if (!innings?.length) return { maxLead: 0, comebackTeamId: null };
        
        let awayScore = 0;
        let homeScore = 0;
        let maxLead = 0;
        let maxLeadTeamId = null;
        
        // Track the largest lead during the game
        for (const inning of innings) {
            // Add away team runs for this inning
            if (inning.away?.runs != null) {
                awayScore += inning.away.runs;
            }
            
            // Check for away team lead
            if (awayScore > homeScore) {
                const currentLead = awayScore - homeScore;
                if (currentLead > maxLead) {
                    maxLead = currentLead;
                    maxLeadTeamId = awayTeamId;
                }
            }
            
            // Add home team runs for this inning
            if (inning.home?.runs != null) {
                homeScore += inning.home.runs;
            }
            
            // Check for home team lead
            if (homeScore > awayScore) {
                const currentLead = homeScore - awayScore;
                if (currentLead > maxLead) {
                    maxLead = currentLead;
                    maxLeadTeamId = homeTeamId;
                }
            }
        }
        
        // Determine if there was a comeback win
        const awayWon = finalAwayScore > finalHomeScore;
        const homeWon = finalHomeScore > finalAwayScore;
        
        // If max lead was 3+ runs and winner was not the team with the max lead
        let comebackTeamId = null;
        if (maxLead >= 3) {
            if (awayWon && maxLeadTeamId === homeTeamId) {
                comebackTeamId = awayTeamId;
            } else if (homeWon && maxLeadTeamId === awayTeamId) {
                comebackTeamId = homeTeamId;
            }
        }
        
        return { maxLead, comebackTeamId };
    }
}