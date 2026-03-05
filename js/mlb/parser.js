/**
 * Parse raw game data into a standardized format
 */
import { API } from './api.js';
import Utils from './utils.js';

export class Parser {
    static GAME_DAY_TIMEZONE = 'America/New_York';

    /**
     * Process API response data into a usable game format
     * @param {Object} apiData - Raw API response
     * @param {Object} options - Processing options
     * @returns {Array} - Array of processed game objects
     */
    static processGames(apiData, options = {}) {
        if (!apiData.dates?.length) return [];

        const targetPlayedDate = options?.targetPlayedDate || null;
        
        const games = [];
        
        apiData.dates.forEach(date => {
            if (!date.games?.length) return;

            const scheduleDate = String(date?.date || '');
            
            date.games.forEach(game => {
                if (game.status.abstractGameState === 'Final') {
                    try {
                        const playedDate = scheduleDate || this.getPlayedDate(game);

                        if (targetPlayedDate && playedDate !== targetPlayedDate) {
                            return;
                        }

                        games.push(this.processGameData(game, playedDate));
                    } catch (error) {
                        console.error(`Error processing game ${game.gamePk}:`, error);
                    }
                }
            });
        });
        
        // Deduplicate games before returning
        return this.deduplicateGames(games);
    }

    /**
     * Format a datetime value into YYYY-MM-DD for a specific timezone.
     * @param {string} dateValue - ISO date-time value
     * @param {string} timeZone - IANA timezone name
     * @returns {string|null} - Date in YYYY-MM-DD format
     */
    static getDateStringInTimeZone(dateValue, timeZone = this.GAME_DAY_TIMEZONE) {
        if (!dateValue) {
            return null;
        }

        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const parts = formatter.formatToParts(date);
            const year = parts.find((part) => part.type === 'year')?.value;
            const month = parts.find((part) => part.type === 'month')?.value;
            const day = parts.find((part) => part.type === 'day')?.value;

            if (year && month && day) {
                return `${year}-${month}-${day}`;
            }
        } catch (error) {
            console.warn('Unable to format played date in configured timezone:', error);
        }

        return date.toISOString().split('T')[0];
    }

    /**
     * Determine the canonical played date for a game.
     * Uses MLB API schedule day semantics (`officialDate`) when available.
     * @param {Object} game - Raw game data
     * @returns {string} - Date in YYYY-MM-DD format
     */
    static getPlayedDate(game) {
        const playedDate = this.getDateStringInTimeZone(game?.gameDate, this.GAME_DAY_TIMEZONE);
        if (playedDate) {
            return playedDate;
        }

        if (game?.officialDate) {
            return String(game.officialDate);
        }

        return '';
    }

    /**
     * Process individual game data
     * @param {Object} game - Raw game data
     * @param {string} playedDate - Canonical played date
     * @returns {Object} - Processed game object
     */
    static processGameData(game, playedDate = '') {
        const awayTeam = game.teams.away;
        const homeTeam = game.teams.home;
        const awayFinalScore = Number(awayTeam.score) || 0;
        const homeFinalScore = Number(homeTeam.score) || 0;
        const { awayDidWin, homeDidWin } = this.resolveTeamResults(awayTeam, homeTeam, awayFinalScore, homeFinalScore);
        const awayRecord = this.derivePregameRecord(awayTeam.leagueRecord, awayDidWin, homeDidWin);
        const homeRecord = this.derivePregameRecord(homeTeam.leagueRecord, homeDidWin, awayDidWin);

        // Process linescore data
        const innings = game.linescore?.innings || [];
        const leadChanges = this.countLeadChanges(innings, awayTeam.team.id, homeTeam.team.id);
        const isExtraInnings = innings.length > 9;
        const totalRuns = awayFinalScore + homeFinalScore;
        const runDifference = Math.abs(awayFinalScore - homeFinalScore);

        // Extract hits and errors
        const awayHits = game.linescore?.teams?.away?.hits || 0;
        const awayErrors = game.linescore?.teams?.away?.errors || 0;
        const homeHits = game.linescore?.teams?.home?.hits || 0;
        const homeErrors = game.linescore?.teams?.home?.errors || 0;

        // Process inning-by-inning scoring
        const inningScores = innings.map(inning => ({
            inningNumber: inning.num,
            away: inning.away?.runs || 0,
            home: inning.home?.runs || 0,
            awayHits: inning.away?.hits || 0,
            homeHits: inning.home?.hits || 0,
            awayErrors: inning.away?.errors || 0,
            homeErrors: inning.home?.errors || 0
        }));

        // Add late game drama properties
        const lastLeadChangeInning = this.findLastLeadChangeInning(game);
        const isWalkoff = this.isWalkoffGame(game);
        
        // Calculate maximum lead for comeback detection
        const { maxLead, comebackTeamId } = this.findMaximumLeadAndComeback(innings, awayTeam.team.id, homeTeam.team.id, awayFinalScore, homeFinalScore);
        const hasComebackWin = comebackTeamId !== null;
        
        return {
            id: game.gamePk,
            date: game.gameDate,
            officialDate: game.officialDate || '',
            playedDate: playedDate || this.getPlayedDate(game),
            status: game.status.detailedState,
            gameType: game.gameType || 'R',
            seriesDescription: game.seriesDescription || '',
            seriesGameNumber: game.seriesGameNumber || null,
            description: game.description || '',
            awayTeam: {
                id: awayTeam.team.id,
                name: awayTeam.team.name,
                score: awayFinalScore,
                hits: awayHits,
                errors: awayErrors,
                pitcher: this.extractPitcher(awayTeam.probablePitcher),
                lineup: [],
                logoUrl: API.getTeamLogoUrl(awayTeam.team.id),
                record: awayRecord
            },
            homeTeam: {
                id: homeTeam.team.id,
                name: homeTeam.team.name,
                score: homeFinalScore,
                hits: homeHits,
                errors: homeErrors,
                pitcher: this.extractPitcher(homeTeam.probablePitcher),
                lineup: [],
                logoUrl: API.getTeamLogoUrl(homeTeam.team.id),
                record: homeRecord
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
     * Resolve winner/loser for a completed game using score first, then API winner flags.
     * @param {Object} awayTeam - Away team payload from schedule API
     * @param {Object} homeTeam - Home team payload from schedule API
     * @param {number} awayFinalScore - Final away score
     * @param {number} homeFinalScore - Final home score
     * @returns {{awayDidWin: boolean, homeDidWin: boolean}}
     */
    static resolveTeamResults(awayTeam, homeTeam, awayFinalScore, homeFinalScore) {
        if (awayFinalScore !== homeFinalScore) {
            return {
                awayDidWin: awayFinalScore > homeFinalScore,
                homeDidWin: homeFinalScore > awayFinalScore
            };
        }

        const awayWinnerFlag = awayTeam?.isWinner;
        const homeWinnerFlag = homeTeam?.isWinner;

        if (typeof awayWinnerFlag === 'boolean' && typeof homeWinnerFlag === 'boolean' && awayWinnerFlag !== homeWinnerFlag) {
            return {
                awayDidWin: awayWinnerFlag,
                homeDidWin: homeWinnerFlag
            };
        }

        return {
            awayDidWin: false,
            homeDidWin: false
        };
    }

    /**
     * Derive pre-game team record from post-game league record.
     * @param {Object} leagueRecord - Team leagueRecord payload from schedule API
     * @param {boolean} didWin - Whether team won this game
     * @param {boolean} didLose - Whether team lost this game
     * @returns {{wins: number, losses: number}}
     */
    static derivePregameRecord(leagueRecord, didWin, didLose) {
        const wins = Number.parseInt(leagueRecord?.wins, 10);
        const losses = Number.parseInt(leagueRecord?.losses, 10);

        const normalizedRecord = {
            wins: Number.isFinite(wins) ? wins : 0,
            losses: Number.isFinite(losses) ? losses : 0
        };

        if (didWin) {
            normalizedRecord.wins = Math.max(0, normalizedRecord.wins - 1);
        }

        if (didLose) {
            normalizedRecord.losses = Math.max(0, normalizedRecord.losses - 1);
        }

        return normalizedRecord;
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
                if (['Preview', 'Scheduled', 'Live'].includes(game.status.abstractGameState)) {
                    try {
                        games.push(this.processFutureGame(game));
                    } catch (error) {
                        console.error(`Error processing future game ${game.gamePk}:`, error);
                    }
                }
            });
        });
        
        // Deduplicate future games before returning
        return this.deduplicateGames(games);
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
            officialDate: game.officialDate || '',
            playedDate: this.getDateStringInTimeZone(game.gameDate, this.GAME_DAY_TIMEZONE) || game.officialDate || '',
            status: game.status.detailedState,
            gameType: game.gameType || 'R',
            seriesDescription: game.seriesDescription || '',
            seriesGameNumber: game.seriesGameNumber || null,
            description: game.description || '',
            gameTime: new Date(game.gameDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            isFuture: true,
            awayTeam: {
                id: awayTeam.team.id,
                name: awayTeam.team.name,
                logoUrl: API.getTeamLogoUrl(awayTeam.team.id),
                pitcher: this.extractFuturePitcher(awayTeam.probablePitcher),
                lineup: [],
                record: {
                    wins: awayTeam.leagueRecord?.wins || 0,
                    losses: awayTeam.leagueRecord?.losses || 0
                }
            },
            homeTeam: {
                id: homeTeam.team.id,
                name: homeTeam.team.name,
                logoUrl: API.getTeamLogoUrl(homeTeam.team.id),
                pitcher: this.extractFuturePitcher(homeTeam.probablePitcher),
                lineup: [],
                record: {
                    wins: homeTeam.leagueRecord?.wins || 0,
                    losses: homeTeam.leagueRecord?.losses || 0
                }
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

    /**
     * Remove duplicate games between the same teams on the same day
     * @param {Array} games - Array of processed game objects
     * @returns {Array} - Array of unique games
     */
    static deduplicateGames(games) {
        // Group games by date and teams involved
        const gamesByDateAndTeams = {};
        
        games.forEach(game => {
            // Prefer parsed played date to avoid timezone-driven day shifts.
            const gameDate = String(
                game.playedDate
                || game.officialDate
                || this.getDateStringInTimeZone(game.date, this.GAME_DAY_TIMEZONE)
                || ''
            );

            if (!gameDate) {
                return;
            }
            
            // Create a consistent key for the teams regardless of home/away
            // Use both orderings to ensure we catch all duplicates
            const awayId = game.awayTeam.id;
            const homeId = game.homeTeam.id;
            
            // Create a key that uniquely identifies games between these teams on this date
            const key = `${gameDate}-${Math.min(awayId, homeId)}-${Math.max(awayId, homeId)}`;
            
            // Either add this game or keep the game with more runs if it exists
            if (!gamesByDateAndTeams[key] || 
                (game.totalRuns > gamesByDateAndTeams[key].totalRuns)) {
                gamesByDateAndTeams[key] = game;
            }
        });
        
        // Convert back to array
        return Object.values(gamesByDateAndTeams);
    }

    /**
     * Enhance game objects with detailed information for advanced metrics
     * @param {Array} games - Array of basic game objects
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Array>} - Promise resolving to enhanced games
     */
    static async enhanceGamesWithDetailedData(games, date) {
        if (!games?.length) return [];

        try {
            // Fetch detailed standings once for the date
            const detailedStandingsData = await API.fetchDetailedStandings(date);
            const detailedRankings = API.processDetailedStandings(detailedStandingsData);
            
            // Process each game in parallel with detailed data
            const enhancedGames = await Promise.all(
                games.map(async game => {
                    try {
                        return await this.enhanceSingleGameWithDetailedData(game, detailedRankings);
                    } catch (error) {
                        console.error(`Error enhancing game ${game.id}:`, error);
                        return game; // Return original game if enhancement fails
                    }
                })
            );
            
            return enhancedGames;
        } catch (error) {
            console.error('Error fetching detailed data:', error);
            return games; // Return original games if overall enhancement fails
        }
    }

    /**
     * Enhance a single game with detailed information
     * @param {Object} game - Basic game object
     * @param {Object} detailedRankings - Detailed rankings data
     * @returns {Promise<Object>} - Promise resolving to enhanced game
     */
    static async enhanceSingleGameWithDetailedData(game, detailedRankings) {
        // Add detailed rankings for playoff implications
        if (detailedRankings) {
            // Away team detailed rankings
            if (detailedRankings[game.awayTeam.id]) {
                game.awayTeam.detailedRanking = detailedRankings[game.awayTeam.id];
            }
            
            // Home team detailed rankings
            if (detailedRankings[game.homeTeam.id]) {
                game.homeTeam.detailedRanking = detailedRankings[game.homeTeam.id];
            }
        }

        // Only fetch player milestones for completed games
        if (!game.isFuture && game.status === 'Final') {
            try {
                // Fetch detailed box score for player milestone detection
                const boxScoreData = await API.fetchDetailedBoxScore(game.id);
                const milestones = API.processPlayerMilestones(boxScoreData);
                
                // Add milestones to game object
                game.playerMilestones = milestones;
                
                // Flag game if any notable milestones were achieved
                game.hasPlayerMilestones = milestones.away.hasMilestones || milestones.home.hasMilestones;
            } catch (error) {
                console.error(`Error fetching milestones for game ${game.id}:`, error);
                game.hasPlayerMilestones = false;
                game.playerMilestones = {
                    away: { hasMilestones: false },
                    home: { hasMilestones: false }
                };
            }
        }
        
        return game;
    }
}