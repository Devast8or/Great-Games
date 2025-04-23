/**
 * Ranker module for scoring and ranking MLB games
 */

const Ranker = {
    /**
     * Rank games based on excitement factors
     * @param {Array} games - Array of processed game objects
     * @param {Object} options - Ranking options and weights
     * @returns {Array} - Games ranked by excitement score
     */
    rankGames(games, options) {
        if (!games || games.length === 0) {
            return [];
        }
        
        // Score each game based on the criteria
        const scoredGames = games.map(game => {
            const score = this.calculateGameScore(game, options);
            return { ...game, excitementScore: score };
        });
        
        // Sort games by excitement score (highest first)
        return scoredGames.sort((a, b) => b.excitementScore - a.excitementScore);
    },
    
    /**
     * Calculate an excitement score for a single game
     * @param {Object} game - Processed game object
     * @param {Object} options - Scoring options and weights
     * @returns {number} - Excitement score (0-100)
     */
    calculateGameScore(game, options) {
        let score = 0;
        const weights = {
            closeGame: options.closeGames ? 30 : 0,
            leadChanges: options.leadChanges ? 25 : 0,
            extraInnings: options.extraInnings ? 15 : 0,
            highScoring: options.highScoring ? 10 : 0,
            teamRankings: options.teamRankings ? 20 : 0
        };
        
        // Close game score (up to 30 points)
        if (weights.closeGame > 0) {
            if (game.runDifference === 0) {
                // Tie game (went to extra innings)
                score += weights.closeGame;
            } else if (game.runDifference === 1) {
                // One-run game
                score += weights.closeGame * 0.9;
            } else if (game.runDifference === 2) {
                // Two-run game
                score += weights.closeGame * 0.7;
            } else if (game.runDifference === 3) {
                // Three-run game
                score += weights.closeGame * 0.4;
            }
        }
        
        // Lead changes score (up to 25 points)
        if (weights.leadChanges > 0) {
            // More lead changes = more exciting
            const leadChangeScore = Math.min(1, game.leadChanges / 5); // Cap at 5 lead changes
            score += weights.leadChanges * leadChangeScore;
        }
        
        // Extra innings score (up to 15 points)
        if (weights.extraInnings > 0 && game.isExtraInnings) {
            // More extra innings = more exciting
            const extraInningsCount = game.innings - 9;
            const extraInningsScore = Math.min(1, extraInningsCount / 3); // Cap at 3 extra innings
            score += weights.extraInnings * extraInningsScore;
        }
        
        // High scoring game (up to 10 points)
        if (weights.highScoring > 0) {
            // More runs = more exciting, up to a point
            const runsScore = Math.min(1, game.totalRuns / 15); // Cap at 15 runs
            score += weights.highScoring * runsScore;
        }
        
        // Team rankings score (up to 20 points)
        if (weights.teamRankings > 0) {
            // Games between highly ranked teams are more exciting
            const awayRank = game.awayTeam.ranking?.divisionRank || 5; // Default to 5 if not available
            const homeRank = game.homeTeam.ranking?.divisionRank || 5;
            
            // Calculate average rank (lower is better)
            const avgRank = (awayRank + homeRank) / 2;
            
            // Best possible average rank is 1 (both teams in 1st place)
            // Worst reasonable rank to consider is 5 (both teams are last in division)
            // Transform so that 1 = best (100%), 5 = worst (0%)
            const rankingScore = Math.max(0, (5 - avgRank) / 4);
            
            score += weights.teamRankings * rankingScore;
            
            // Bonus for games between highly ranked teams (1st vs 1st, 1st vs 2nd, 2nd vs 2nd)
            if (awayRank <= 2 && homeRank <= 2) {
                score += weights.teamRankings * 0.2; // 20% bonus
            }
        }
        
        return score;
    },
    
    /**
     * Convert numeric score to star rating (1-5)
     * @param {number} score - Numeric excitement score (0-100)
     * @returns {number} - Star rating (1-5, rounded to nearest 0.5)
     */
    scoreToStars(score) {
        // Convert 0-100 score to 1-5 star scale
        const rawStars = 1 + (score / 100) * 4;
        // Round to nearest 0.5
        return Math.round(rawStars * 2) / 2;
    },
    
    /**
     * Generate star symbols for display
     * @param {number} starRating - Star rating (1-5)
     * @returns {string} - Star symbols (★)
     */
    getStarSymbols(starRating) {
        const fullStars = Math.floor(starRating);
        const halfStar = starRating % 1 !== 0;
        
        let starSymbols = '★'.repeat(fullStars);
        if (halfStar) {
            starSymbols += '½';
        }
        
        return starSymbols;
    }
};