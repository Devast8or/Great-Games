/**
 * Ranker module for scoring and ranking NBA games.
 */
import Utils from './utils.js';

export class Ranker {
    static weights = {
        finishTension: 28,
        momentumSwings: 24,
        overtimeDrama: 12
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
        const factors = {};

        const registerFactor = (factorKey, definition) => {
            const enabled = Boolean(options?.[definition.optionKey]);
            const scoreValue = Number(definition?.result?.score);
            const normalizedScore = Number.isFinite(scoreValue)
                ? Utils.clamp(scoreValue, 0, 1)
                : 0;
            const available = Boolean(definition?.result?.available);
            const usedInTotal = enabled && available;
            const weightedContribution = usedInTotal
                ? normalizedScore * definition.weight
                : 0;

            if (usedInTotal) {
                weightedScore += weightedContribution;
                maxPossibleScore += definition.weight;
            }

            factors[factorKey] = {
                optionKey: definition.optionKey,
                label: definition.label,
                enabled,
                available,
                usedInTotal,
                normalizedScore: this.roundForDebug(normalizedScore),
                weight: definition.weight,
                weightedContribution: this.roundForDebug(weightedContribution),
                metrics: definition.metrics
            };
        };

        registerFactor('finishTension', {
            optionKey: 'closeGames',
            label: 'Finish Tension',
            weight: this.weights.finishTension,
            result: this.calculateFinishTensionScore(game),
            metrics: {
                scoreMargin: this.toFiniteMetric(game?.scoreMargin)
            }
        });

        registerFactor('momentumSwings', {
            optionKey: 'leadChanges',
            label: 'Momentum Swings',
            weight: this.weights.momentumSwings,
            result: this.calculateMomentumSwingsScore(game),
            metrics: {
                leadChanges: this.toFiniteMetric(game?.leadChanges),
                timesTied: this.toFiniteMetric(game?.timesTied),
                comebackDeficitQ4: this.toFiniteMetric(game?.comebackDeficitQ4)
            }
        });

        registerFactor('overtimeDrama', {
            optionKey: 'extraInnings',
            label: 'Overtime Drama',
            weight: this.weights.overtimeDrama,
            result: this.calculateOvertimeDramaScore(game),
            metrics: {
                overtimeCount: this.toFiniteMetric(game?.overtimeCount)
            }
        });

        const totalScore = maxPossibleScore <= 0
            ? 0
            : Math.round((weightedScore / maxPossibleScore) * 100);

        return {
            totalScore,
            weightedScore: this.roundForDebug(weightedScore),
            maxPossibleScore,
            options: {
                ...options
            },
            rawMetrics: {
                scoreMargin: this.toFiniteMetric(game?.scoreMargin),
                leadChanges: this.toFiniteMetric(game?.leadChanges),
                timesTied: this.toFiniteMetric(game?.timesTied),
                comebackDeficitQ4: this.toFiniteMetric(game?.comebackDeficitQ4),
                overtimeCount: this.toFiniteMetric(game?.overtimeCount)
            },
            factors
        };
    }

    static toFiniteMetric(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed)
            ? this.roundForDebug(parsed)
            : null;
    }

    static roundForDebug(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return 0;
        }

        return Math.round(parsed * 10000) / 10000;
    }

    static calculateFinishTensionScore(game) {
        const margin = Number(game?.scoreMargin);
        if (!Number.isFinite(margin)) {
            return {
                score: 0,
                available: false
            };
        }

        const normalizedMargin = Math.max(0, margin);
        let score = Utils.clamp((14 - normalizedMargin) / 14, 0, 1);

        if (normalizedMargin <= 3) {
            score += 0.1;
        }

        if (normalizedMargin <= 1) {
            score += 0.08;
        }

        return {
            score: Utils.clamp(score, 0, 1),
            available: true
        };
    }

    static calculateMomentumSwingsScore(game) {
        const leadChanges = Number(game?.leadChanges);
        const timesTied = Number(game?.timesTied);
        const comebackDeficitQ4 = Number(game?.comebackDeficitQ4);

        const hasData = [leadChanges, timesTied, comebackDeficitQ4].some((value) => Number.isFinite(value));
        if (!hasData) {
            return {
                score: 0,
                available: false
            };
        }

        const leadComponent = Utils.clamp((Number.isFinite(leadChanges) ? leadChanges : 0) / 18, 0, 1);
        const tieComponent = Utils.clamp((Number.isFinite(timesTied) ? timesTied : 0) / 12, 0, 1);
        const comebackComponent = Utils.clamp((Number.isFinite(comebackDeficitQ4) ? comebackDeficitQ4 : 0) / 15, 0, 1);

        const score = (leadComponent * 0.55) + (tieComponent * 0.25) + (comebackComponent * 0.2);

        return {
            score: Utils.clamp(score, 0, 1),
            available: true
        };
    }

    static calculateOvertimeDramaScore(game) {
        const overtimeCount = Number(game?.overtimeCount) || 0;

        if (!Number.isFinite(overtimeCount)) {
            return {
                score: 0,
                available: false
            };
        }

        if (overtimeCount >= 2) {
            return {
                score: overtimeCount >= 3 ? 1 : 0.9,
                available: true
            };
        }

        if (overtimeCount === 1) {
            return {
                score: 0.72,
                available: true
            };
        }

        return {
            score: 0,
            available: true
        };
    }

}
