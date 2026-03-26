/**
 * Ranker module for scoring and ranking NHL games.
 */
import Utils from './utils.js';

export class Ranker {
    static weights = {
        finishTension: 28,
        momentumSwings: 22,
        overtimeDrama: 16,
        goalieWorkload: 12
    };

    static rankGames(games, options = {}) {
        if (!Array.isArray(games) || games.length === 0) {
            return [];
        }

        const scoredGames = games.map((game) => {
            const rankingDetails = this.calculateGameScoreDetails(game, options);
            return {
                ...game,
                excitementScore: rankingDetails.totalScore,
                rankingDetails
            };
        });

        return scoredGames.sort((a, b) => b.excitementScore - a.excitementScore);
    }

    static calculateGameScoreDetails(game, options = {}) {
        let weightedScore = 0;
        let maxPossibleScore = 0;

        const factors = [
            {
                key: 'finishTension',
                optionKey: 'closeGames',
                weight: this.weights.finishTension,
                result: this.calculateFinishTensionScore(game)
            },
            {
                key: 'momentumSwings',
                optionKey: 'leadChanges',
                weight: this.weights.momentumSwings,
                result: this.calculateMomentumSwingsScore(game)
            },
            {
                key: 'overtimeDrama',
                optionKey: 'extraInnings',
                weight: this.weights.overtimeDrama,
                result: this.calculateOvertimeDramaScore(game)
            },
            {
                key: 'goalieWorkload',
                optionKey: 'teamRankings',
                weight: this.weights.goalieWorkload,
                result: this.calculateGoalieWorkloadScore(game)
            }
        ];

        factors.forEach((factor) => {
            const enabled = options?.[factor.optionKey] !== false;
            if (!enabled || !factor.result.available) {
                return;
            }

            weightedScore += Utils.clamp(factor.result.score, 0, 1) * factor.weight;
            maxPossibleScore += factor.weight;
        });

        const totalScore = maxPossibleScore <= 0
            ? 0
            : Math.round((weightedScore / maxPossibleScore) * 100);

        return {
            totalScore,
            weightedScore,
            maxPossibleScore
        };
    }

    static calculateFinishTensionScore(game) {
        const margin = Number(game?.scoreMargin);
        if (!Number.isFinite(margin)) {
            return { available: false, score: 0 };
        }

        let score = Utils.clamp((4 - margin) / 4, 0, 1);
        if (margin <= 1) {
            score += 0.15;
        }

        return { available: true, score: Utils.clamp(score, 0, 1) };
    }

    static calculateMomentumSwingsScore(game) {
        const leadChanges = Number(game?.leadChanges) || 0;
        const timesTied = Number(game?.timesTied) || 0;
        return {
            available: true,
            score: Utils.clamp((leadChanges / 6) + (timesTied / 8), 0, 1)
        };
    }

    static calculateOvertimeDramaScore(game) {
        const overtimeCount = Number(game?.overtimeCount) || 0;

        if (overtimeCount <= 0) {
            return { available: true, score: 0 };
        }

        return {
            available: true,
            score: overtimeCount >= 2 ? 1 : 0.8
        };
    }

    static calculateGoalieWorkloadScore(game) {
        const saveTotal = Number(game?.saveTotal);
        if (!Number.isFinite(saveTotal)) {
            return { available: false, score: 0 };
        }

        return {
            available: true,
            score: Utils.clamp((saveTotal - 35) / 40, 0, 1)
        };
    }
}
