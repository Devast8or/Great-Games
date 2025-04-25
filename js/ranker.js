/**
 * Ranker module for scoring and ranking MLB games
 */
export class Ranker {
    /**
     * Define scoring weights for different factors
     */
    static weights = {
        closeGame: 25,      // Reduced from 30
        leadChanges: 20,    // Maintained
        lateGameDrama: 15,  // New factor
        extraInnings: 10,   // Maintained
        highScoring: 10,    // Maintained
        teamRankings: 10,   // Maintained
        hits: 5,           // Reduced from 10
        errors: 5          // Reduced from 10
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
        
        if (options.closeGames) {
            score += this.calculateCloseGameScore(game) * this.weights.closeGame;
        }
        
        if (options.leadChanges) {
            score += this.calculateLeadChangesScore(game) * this.weights.leadChanges;
        }

        // Add late game drama scoring
        if (options.lateGameDrama) {
            score += this.calculateLateGameDramaScore(game) * this.weights.lateGameDrama;
        }
        
        if (options.extraInnings && game.isExtraInnings) {
            score += this.calculateExtraInningsScore(game) * this.weights.extraInnings;
        }
        
        if (options.highScoring) {
            score += this.calculateHighScoringScore(game) * this.weights.highScoring;
        }
        
        if (options.teamRankings) {
            score += this.calculateRankingsScore(game) * this.weights.teamRankings;
        }

        if (options.hits) {
            score += this.calculateHitsScore(game) * this.weights.hits;
        }

        if (options.errors) {
            score += this.calculateErrorsScore(game) * this.weights.errors;
        }
        
        return Math.min(100, score);
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
        if (game.runDifference <= 2 && game.inning >= 7) {
            score += 0.5;
        }
        
        // Lead changes in late innings
        if (game.lastLeadChangeInning >= 7) {
            score += 0.3;
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