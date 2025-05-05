/**
 * Ranker module for scoring and ranking MLB games
 */
export class Ranker {
    /**
     * Define scoring weights for different factors
     */
    static weights = {
        closeGame: 20,          // Maintained
        leadChanges: 15,        // Maintained
        lateGameDrama: 20,      // Maintained
        comebackWin: 10,        // Maintained
        extraInnings: 10,       // Maintained
        highScoring: 10,        // Maintained
        teamRankings: 5,        // Maintained
        hits: 5,                // Maintained
        errors: 5,              // Maintained
        scoringDistribution: 10, // Maintained
        rivalryGame: 10,        // NEW: Bonus for historic rivalries
        playerMilestones: 5,    // NEW: Notable player achievements
        seasonalContext: 5      // NEW: Playoff implications or significance
    };

    /**
     * Rank games based on excitement factors
     * @param {Array} games - Array of processed game objects
     * @param {Object} options - Ranking options and weights
     * @returns {Array} - Games ranked by excitement score
     */
    static rankGames(games, options) {
        if (!games?.length) return [];
        
        // Calculate scores
        const scoredGames = games.map(game => ({
            ...game,
            excitementScore: this.calculateGameScore(game, options)
        }));
        
        // Sort by excitement score
        return scoredGames.sort((a, b) => b.excitementScore - a.excitementScore);
    }

    /**
     * Calculate excitement score for a game
     * @param {Object} game - Game object
     * @param {Object} options - Scoring options
     * @returns {number} - Excitement score (0-100)
     */
    static calculateGameScore(game, options) {
        let score = 0;
        let maxPossibleScore = 0;
        
        if (options.closeGames) {
            score += this.calculateCloseGameScore(game) * this.weights.closeGame;
            maxPossibleScore += this.weights.closeGame;
        }
        
        if (options.leadChanges) {
            score += this.calculateLeadChangesScore(game) * this.weights.leadChanges;
            maxPossibleScore += this.weights.leadChanges;
        }

        if (options.lateGameDrama) {
            score += this.calculateLateGameDramaScore(game) * this.weights.lateGameDrama;
            maxPossibleScore += this.weights.lateGameDrama;
        }
        
        if (options.comebackWins) {
            score += this.calculateComebackScore(game) * this.weights.comebackWin;
            maxPossibleScore += this.weights.comebackWin;
        }
        
        if (options.extraInnings && game.isExtraInnings) {
            score += this.calculateExtraInningsScore(game) * this.weights.extraInnings;
            maxPossibleScore += this.weights.extraInnings;
        }
        
        if (options.highScoring) {
            score += this.calculateHighScoringScore(game) * this.weights.highScoring;
            maxPossibleScore += this.weights.highScoring;
        }
        
        if (options.teamRankings) {
            score += this.calculateRankingsScore(game) * this.weights.teamRankings;
            maxPossibleScore += this.weights.teamRankings;
        }

        if (options.hits) {
            score += this.calculateHitsScore(game) * this.weights.hits;
            maxPossibleScore += this.weights.hits;
        }

        if (options.errors) {
            score += this.calculateErrorsScore(game) * this.weights.errors;
            maxPossibleScore += this.weights.errors;
        }

        if (options.scoringDistribution) {
            score += this.calculateScoringDistributionScore(game) * this.weights.scoringDistribution;
            maxPossibleScore += this.weights.scoringDistribution;
        }

        // NEW factors
        if (options.rivalryGame) {
            score += this.calculateRivalryScore(game) * this.weights.rivalryGame;
            maxPossibleScore += this.weights.rivalryGame;
        }
        
        if (options.playerMilestones) {
            score += this.calculatePlayerMilestonesScore(game) * this.weights.playerMilestones;
            maxPossibleScore += this.weights.playerMilestones;
        }
        
        if (options.seasonalContext) {
            score += this.calculateSeasonalContextScore(game) * this.weights.seasonalContext;
            maxPossibleScore += this.weights.seasonalContext;
        }
        
        // Normalize the score to 0-100 based on enabled options
        return maxPossibleScore > 0 ? Math.round((score / maxPossibleScore) * 100) : 0;
    }

    /**
     * Calculate score component for close games
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateCloseGameScore(game) {
        if (game.runDifference === 0) return 1;       // Tie game
        if (game.runDifference === 1) return 0.85;    // Reduced from 0.95
        if (game.runDifference === 2) return 0.65;    // Reduced from 0.8
        if (game.runDifference === 3) return 0.4;     // Reduced from 0.5
        return Math.max(0, 0.2 - (game.runDifference - 4) * 0.1); // Lower base score
    }

    /**
     * Calculate score component for lead changes
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateLeadChangesScore(game) {
        let score = 0;
        
        // Base scoring for number of lead changes
        if (game.leadChanges >= 5) score = 1;
        else if (game.leadChanges === 4) score = 0.8;
        else if (game.leadChanges === 3) score = 0.6;
        else if (game.leadChanges === 2) score = 0.4;
        else if (game.leadChanges === 1) score = 0.2;
        
        // Bonus for lead changes in later innings
        if (game.lastLeadChangeInning >= 7) {
            score *= 1.2; // 20% bonus for late-game changes
        }
        
        return Math.min(1, score);
    }

    /**
     * Calculate score component for late game drama
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateLateGameDramaScore(game) {
        let score = 0;
        
        // Close game in final innings (7th or later)
        if (game.runDifference <= 1 && game.inning >= 8) {
            score += 0.7; // Increased for very close late games (1-run difference)
        } else if (game.runDifference <= 2 && game.inning >= 7) {
            score += 0.4; // Standard close game bonus
        }
        
        // Lead changes in very late innings (more dramatic)
        if (game.lastLeadChangeInning >= 8) {
            score += 0.5; // Increased for 8th inning or later
        } else if (game.lastLeadChangeInning >= 7) {
            score += 0.3; // Standard for 7th inning
        }
        
        // Walk-off victory
        if (game.isWalkoff) {
            score += 0.5;
        }
        
        return Math.min(1, score);
    }

    /**
     * Calculate score component for extra innings
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateExtraInningsScore(game) {
        const extraInnings = game.innings - 9;
        // Reduced scoring for extra innings
        if (extraInnings >= 5) return 1;
        if (extraInnings === 4) return 0.8;    // Reduced from 0.9
        if (extraInnings === 3) return 0.6;    // Reduced from 0.8
        if (extraInnings === 2) return 0.4;    // Reduced from 0.6
        if (extraInnings === 1) return 0.2;    // Reduced from 0.4
        return 0;
    }

    /**
     * Calculate score component for high scoring games
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateHighScoringScore(game) {
        let score = 0;
        
        // Base score from total runs
        if (game.totalRuns >= 15) score = 1;
        else if (game.totalRuns >= 12) score = 0.7;
        else if (game.totalRuns >= 10) score = 0.5;
        else if (game.totalRuns >= 8) score = 0.3;
        else if (game.totalRuns >= 6) score = 0.1;
        
        // Bonus for balanced high-scoring games
        const runDiff = Math.abs(game.homeTeam.runs - game.awayTeam.runs);
        if (game.totalRuns >= 10 && runDiff <= 2) {
            score *= 1.2; // 20% bonus for close high-scoring games
        }
        
        return Math.min(1, score);
    }

    /**
     * Calculate score component for team rankings
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateRankingsScore(game) {
        const awayRank = game.awayTeam.ranking?.divisionRank || 5;
        const homeRank = game.homeTeam.ranking?.divisionRank || 5;
        const avgRank = (awayRank + homeRank) / 2;
        
        // More conservative scoring for rankings
        let score = Math.max(0, (5 - avgRank) / 4);
        
        // Reduced bonuses for highly ranked teams
        if (awayRank <= 2 && homeRank <= 2) {
            score += 0.2; // Reduced from 0.3
        } else if (awayRank <= 3 && homeRank <= 3) {
            score += 0.1; // Reduced from 0.15
        }
        
        return Math.min(1, score);
    }

    /**
     * Calculate score component for total hits
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateHitsScore(game) {
        const totalHits = game.awayTeam.hits + game.homeTeam.hits;
        
        if (totalHits >= 25) return 1;      // Lots of action
        if (totalHits >= 20) return 0.8;    // Very active game
        if (totalHits >= 15) return 0.6;    // Above average hits
        if (totalHits >= 10) return 0.4;    // Average hits
        if (totalHits >= 5) return 0.2;     // Below average hits
        return 0;                           // Very few hits
    }

    /**
     * Calculate score component for errors (adds drama)
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateErrorsScore(game) {
        const totalErrors = game.awayTeam.errors + game.homeTeam.errors;
        
        if (totalErrors >= 4) return 1;     // Very dramatic game
        if (totalErrors === 3) return 0.75; // Multiple key mistakes
        if (totalErrors === 2) return 0.5;  // Couple of mistakes
        if (totalErrors === 1) return 0.25; // One key error
        return 0;                           // Clean game
    }

    /**
     * Calculate score component for comeback wins
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateComebackScore(game) {
        if (!game.hasComebackWin) return 0;
        
        // More points for larger comebacks
        if (game.maxLead >= 6) return 1;       // Massive comeback
        if (game.maxLead >= 5) return 0.85;    // Very large comeback
        if (game.maxLead >= 4) return 0.7;     // Large comeback
        if (game.maxLead >= 3) return 0.5;     // Standard comeback
        
        return 0; // No comeback
    }

    /**
     * Calculate score component for scoring distribution across innings
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateScoringDistributionScore(game) {
        // Count innings with scoring
        const inningsWithScoring = game.inningScores.filter(
            inning => inning.away > 0 || inning.home > 0
        ).length;
        
        // Calculate as a ratio of innings with scoring to total innings
        // with bonuses for more distributed scoring
        const totalInnings = game.innings;
        const distributionRatio = inningsWithScoring / totalInnings;
        
        // More points for more innings with scoring
        if (distributionRatio >= 0.9) return 1;      // Almost every inning had scoring
        if (distributionRatio >= 0.8) return 0.9;    // Most innings had scoring
        if (distributionRatio >= 0.7) return 0.8;    // Many innings had scoring
        if (distributionRatio >= 0.6) return 0.65;   // More than half innings had scoring
        if (distributionRatio >= 0.5) return 0.5;    // Half of innings had scoring
        if (distributionRatio >= 0.4) return 0.3;    // Some innings had scoring
        if (distributionRatio >= 0.3) return 0.2;    // Few innings had scoring
        
        return 0.1; // Very few innings had scoring
    }

    /**
     * Calculate score for rivalry games
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateRivalryScore(game) {
        // Get team names
        const awayTeam = game.awayTeam.name;
        const homeTeam = game.homeTeam.name;
        
        // Store rivalry data (loaded from assets/mlb/mlb_rivals.json)
        if (!this.rivalryData) {
            try {
                this.loadRivalryData();
            } catch (error) {
                console.error('Failed to load rivalry data:', error);
                return 0;
            }
        }
        
        // Check for iconic rivalries (higher weight)
        if (this.iconicRivalries) {
            for (const rivalry of this.iconicRivalries) {
                const teams = rivalry.teams;
                if (teams.includes(awayTeam) && teams.includes(homeTeam)) {
                    return 1.0; // Highest score for iconic rivalries
                }
            }
        }
        
        // Check for recent rivalries (lower weight)
        if (this.recentRivalries) {
            for (const rivalry of this.recentRivalries) {
                const teams = rivalry.teams;
                if (teams.includes(awayTeam) && teams.includes(homeTeam)) {
                    return 0.7; // Good score for recent rivalries
                }
            }
        }
        
        return 0; // Not a notable rivalry
    }

    /**
     * Load rivalry data from JSON file
     */
    static async loadRivalryData() {
        if (this.rivalryData) return;
        
        try {
            const response = await fetch('/assets/mlb/mlb_rivals.json');
            if (!response.ok) throw new Error('Failed to load rivalry data');
            
            const data = await response.json();
            this.rivalryData = data;
            
            // Extract rivalries by type
            this.iconicRivalries = data.find(item => item.type === 'iconic')?.rivalries || [];
            this.recentRivalries = data.find(item => item.type === 'recent')?.rivalries || [];
        } catch (error) {
            console.error('Error loading rivalry data:', error);
            this.rivalryData = [];
            this.iconicRivalries = [];
            this.recentRivalries = [];
        }
    }

    /**
     * Calculate score for notable player performances
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculatePlayerMilestonesScore(game) {
        let score = 0;
        
        // Use detailed player milestones if available
        if (game.playerMilestones) {
            const awayMilestones = game.playerMilestones.away;
            const homeMilestones = game.playerMilestones.home;
            
            // Perfect game is the ultimate pitching achievement
            if (awayMilestones.perfectGame || homeMilestones.perfectGame) {
                return 1.0; // Maximum score for perfect game
            }
            
            // No-hitter is extremely rare and exciting
            if (awayMilestones.noHitter || homeMilestones.noHitter) {
                return 0.95; // Near maximum for no-hitter
            }
            
            // Hitting for the cycle is rare
            if (awayMilestones.cycleHitter || homeMilestones.cycleHitter) {
                score = Math.max(score, 0.9);
            }
            
            // Multi-home run games
            if (awayMilestones.multiHomeRunHitters.length > 0 || homeMilestones.multiHomeRunHitters.length > 0) {
                // More points for more home runs or multiple players with multi-HR games
                const totalMultiHRPlayers = awayMilestones.multiHomeRunHitters.length + 
                                          homeMilestones.multiHomeRunHitters.length;
                                          
                // Find max HRs by any player
                let maxHRs = 2; // Default minimum for multi-HR
                
                [...awayMilestones.multiHomeRunHitters, ...homeMilestones.multiHomeRunHitters].forEach(player => {
                    if (player.homeRuns > maxHRs) maxHRs = player.homeRuns;
                });
                
                // Score based on best performance
                if (maxHRs >= 4) score = Math.max(score, 0.9); // 4+ HR game (extremely rare)
                else if (maxHRs === 3) score = Math.max(score, 0.8); // 3 HR game
                else if (totalMultiHRPlayers > 1) score = Math.max(score, 0.7); // Multiple players with 2+ HRs
                else score = Math.max(score, 0.6); // Single player with 2 HRs
            }
            
            // High RBI games
            if (awayMilestones.highRbiHitters.length > 0 || homeMilestones.highRbiHitters.length > 0) {
                // Find max RBIs by any player
                let maxRBIs = 5; // Default minimum threshold
                
                [...awayMilestones.highRbiHitters, ...homeMilestones.highRbiHitters].forEach(player => {
                    if (player.rbi > maxRBIs) maxRBIs = player.rbi;
                });
                
                // Score based on RBI total
                if (maxRBIs >= 8) score = Math.max(score, 0.85); // 8+ RBI game (very rare)
                else if (maxRBIs >= 7) score = Math.max(score, 0.75); // 7 RBI game
                else if (maxRBIs >= 6) score = Math.max(score, 0.65); // 6 RBI game
                else score = Math.max(score, 0.55); // 5 RBI game
            }
            
            // High strikeout pitching performances
            if (awayMilestones.highStrikeoutPitcher || homeMilestones.highStrikeoutPitcher) {
                const awayKs = awayMilestones.highStrikeoutPitcher?.strikeOuts || 0;
                const homeKs = homeMilestones.highStrikeoutPitcher?.strikeOuts || 0;
                const maxKs = Math.max(awayKs, homeKs);
                
                // Score based on strikeout total
                if (maxKs >= 15) score = Math.max(score, 0.9); // 15+ K game (rare)
                else if (maxKs >= 13) score = Math.max(score, 0.8); // 13-14 K game
                else if (maxKs >= 11) score = Math.max(score, 0.7); // 11-12 K game
                else score = Math.max(score, 0.6); // 10 K game
            }
            
            return score;
        }
        
        // Fall back to basic calculation if detailed milestones aren't available
        // This preserves backward compatibility with existing data
        
        // Look for no-hitters or perfect games using basic hit data
        if (game.awayTeam.hits === 0 || game.homeTeam.hits === 0) {
            return 1.0; // No-hitter is always exciting
        }
        
        // Without detailed stats, we can't detect other milestones
        return 0;
    }

    /**
     * Calculate importance based on seasonal context
     * @param {Object} game - Game object
     * @returns {number} - Score multiplier (0-1)
     */
    static calculateSeasonalContextScore(game) {
        // Check if detailed rankings are available
        const hasDetailedRankings = game.awayTeam.detailedRanking && game.homeTeam.detailedRanking;
        
        // Default score
        let score = 0;
        
        // Check if it's late in the season (September/October)
        const gameDate = new Date(game.date);
        const gameMonth = gameDate.getMonth();
        const isLateSeason = gameMonth >= 8; // September or later
        
        if (hasDetailedRankings) {
            // Use detailed playoff implications data
            const awayTeam = game.awayTeam;
            const homeTeam = game.homeTeam;
            
            // Division leaders matchup
            if (awayTeam.detailedRanking.isInFirstPlace && homeTeam.detailedRanking.isInFirstPlace) {
                score += 0.7;
                if (isLateSeason) score += 0.2;
            }
            
            // Wild card implications
            const isWildCardBattle = 
                (awayTeam.detailedRanking.isInWildCard || awayTeam.detailedRanking.wildCardGamesBack <= 5) &&
                (homeTeam.detailedRanking.isInWildCard || homeTeam.detailedRanking.wildCardGamesBack <= 5);
                
            if (isWildCardBattle) {
                score += 0.5;
                if (isLateSeason) score += 0.2;
            }
            
            // Division matchups between close teams
            if (awayTeam.detailedRanking.divisionName === homeTeam.detailedRanking.divisionName) {
                const divisionGamesBack = Math.min(
                    parseFloat(awayTeam.detailedRanking.gamesBack), 
                    parseFloat(homeTeam.detailedRanking.gamesBack)
                );
                
                if (divisionGamesBack <= 2) {
                    score += 0.6;
                    if (isLateSeason) score += 0.2;
                } else if (divisionGamesBack <= 5) {
                    score += 0.4;
                    if (isLateSeason) score += 0.2;
                }
            }
            
            // Elimination games - when a team faces elimination
            if (isLateSeason) {
                if (awayTeam.detailedRanking.eliminationNumber <= 1 || 
                    homeTeam.detailedRanking.eliminationNumber <= 1) {
                    score += 0.8; // Critical games
                }
            }
        } else {
            // Fall back to basic calculation with limited data
            
            // Check if both teams are in playoff contention using basic rankings
            const awayInContention = game.awayTeam.ranking?.gamesBack <= 5;
            const homeInContention = game.homeTeam.ranking?.gamesBack <= 5;
            
            // Division matchups between contenders
            if (game.awayTeam.ranking?.divisionName === game.homeTeam.ranking?.divisionName) {
                if (awayInContention && homeInContention) {
                    score += 0.7;
                    
                    // Extra weight for late season division matchups
                    if (isLateSeason) {
                        score += 0.3;
                    }
                }
            }
            
            // Wild card implications
            if (awayInContention && homeInContention) {
                score += 0.5;
                
                // Extra weight for late season
                if (isLateSeason) {
                    score += 0.2;
                }
            }
        }
        
        return Math.min(1, score);
    }

    /**
     * Convert numeric score to star rating
     * @param {number} score - Numeric score (0-100)
     * @returns {number} - Star rating (1-5)
     */
    static scoreToStars(score) {
        const rawStars = 1 + (score / 100) * 4;
        return Math.round(rawStars * 2) / 2; // Round to nearest 0.5
    }

    /**
     * Generate star symbols for display
     * @param {number} starRating - Star rating (1-5)
     * @returns {string} - Star symbols
     */
    static getStarSymbols(starRating) {
        const fullStars = Math.floor(starRating);
        const halfStar = starRating % 1 !== 0;
        
        return '★'.repeat(fullStars) + (halfStar ? '½' : '');
    }
}