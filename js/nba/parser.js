/**
 * Parse raw NBA stats API data into app game models.
 */
import { API } from './api.js';
import Utils from './utils.js';

export class Parser {
    static MAX_GAMES_TO_ENHANCE_PER_LOAD = 3;

    static processGames(scoreboardData) {
        const standingsByTeamId = this.extractStandingsByTeamId(scoreboardData);
        const gameHeaders = API.extractRows(scoreboardData, 'GameHeader');
        const lineScores = API.extractRows(scoreboardData, 'LineScore');
        const gameInfoRows = API.extractRows(scoreboardData, 'GameInfo');

        if (Array.isArray(gameHeaders) && gameHeaders.length > 0) {
            const lineScoresByGameId = this.groupRowsByGameId(lineScores);
            const gameInfoByGameId = this.groupSingleRowByGameId(gameInfoRows);

            return gameHeaders.map((gameHeader) => {
                const gameId = String(gameHeader?.GAME_ID || '');
                const gameLineScores = lineScoresByGameId.get(gameId) || [];
                const gameInfo = gameInfoByGameId.get(gameId) || null;
                return this.processSingleGame(gameHeader, gameLineScores, gameInfo, standingsByTeamId);
            });
        }

        return [];
    }

    static extractStandingsByTeamId(scoreboardData) {
        const rawStandings = scoreboardData?.standingsByTeamId;
        if (!rawStandings || typeof rawStandings !== 'object') {
            return {};
        }

        return rawStandings;
    }

    static resolveDivisionStanding(standingsByTeamId, teamId, fallbackDivision = '') {
        const numericTeamId = Number.parseInt(teamId, 10);
        const teamKey = Number.isFinite(numericTeamId) ? String(numericTeamId) : '';
        const teamStanding = (teamKey && standingsByTeamId?.[teamKey])
            || standingsByTeamId?.[teamId]
            || null;

        const division = String(teamStanding?.division || fallbackDivision || '').trim();
        const parsedRank = Number.parseInt(teamStanding?.divisionRank, 10);
        const divisionRank = Number.isFinite(parsedRank) && parsedRank > 0
            ? parsedRank
            : null;
        const locationLabel = division || 'Division';
        const divisionStanding = divisionRank
            ? `${this.toOrdinalLabel(divisionRank)} in ${locationLabel}`
            : division;

        return {
            division,
            divisionRank,
            divisionStanding
        };
    }

    static toOrdinalLabel(rankValue) {
        const rank = Number.parseInt(rankValue, 10);
        if (!Number.isFinite(rank) || rank <= 0) {
            return '';
        }

        const lastTwo = rank % 100;
        if (lastTwo >= 11 && lastTwo <= 13) {
            return `${rank}th`;
        }

        switch (rank % 10) {
            case 1:
                return `${rank}st`;
            case 2:
                return `${rank}nd`;
            case 3:
                return `${rank}rd`;
            default:
                return `${rank}th`;
        }
    }

    static groupRowsByGameId(rows) {
        const grouped = new Map();

        if (!Array.isArray(rows)) {
            return grouped;
        }

        rows.forEach((row) => {
            const gameId = String(row?.GAME_ID || '');
            if (!gameId) {
                return;
            }

            if (!grouped.has(gameId)) {
                grouped.set(gameId, []);
            }

            grouped.get(gameId).push(row);
        });

        return grouped;
    }

    static groupSingleRowByGameId(rows) {
        const grouped = new Map();

        if (!Array.isArray(rows)) {
            return grouped;
        }

        rows.forEach((row) => {
            const gameId = String(row?.GAME_ID || '');
            if (gameId) {
                grouped.set(gameId, row);
            }
        });

        return grouped;
    }

    static processSingleGame(gameHeader, lineScores = [], gameInfo = null, standingsByTeamId = {}) {
        const gameId = String(gameHeader?.GAME_ID || '');
        const awayTeamId = Number.parseInt(gameHeader?.VISITOR_TEAM_ID, 10);
        const homeTeamId = Number.parseInt(gameHeader?.HOME_TEAM_ID, 10);

        const awayLineScore = lineScores.find((row) => Number.parseInt(row?.TEAM_ID, 10) === awayTeamId) || null;
        const homeLineScore = lineScores.find((row) => Number.parseInt(row?.TEAM_ID, 10) === homeTeamId) || null;

        const awayTeamInfo = Utils.getTeamInfo(awayTeamId, {
            abbreviation: awayLineScore?.TEAM_ABBREVIATION,
            name: awayLineScore?.TEAM_NAME,
            city: awayLineScore?.TEAM_CITY_NAME
        });
        const homeTeamInfo = Utils.getTeamInfo(homeTeamId, {
            abbreviation: homeLineScore?.TEAM_ABBREVIATION,
            name: homeLineScore?.TEAM_NAME,
            city: homeLineScore?.TEAM_CITY_NAME
        });

        const awayScore = Number.parseInt(awayLineScore?.PTS, 10) || 0;
        const homeScore = Number.parseInt(homeLineScore?.PTS, 10) || 0;
        const periodScores = this.createPeriodScores(awayLineScore, homeLineScore);

        const statusId = Number.parseInt(gameHeader?.GAME_STATUS_ID, 10) || 0;
        const statusText = String(gameHeader?.GAME_STATUS_TEXT || gameHeader?.WH_STATUS_TEXT || '').trim();
        const isFinal = statusId === 3 || /final/i.test(statusText);
        const isFuture = !isFinal;
        const gameDate = gameHeader?.GAME_DATE_EST || gameHeader?.GAME_DATE || '';

        const awayRecord = Utils.parseRecord(awayLineScore?.TEAM_WINS_LOSSES);
        const homeRecord = Utils.parseRecord(homeLineScore?.TEAM_WINS_LOSSES);
        const awayDivisionStanding = this.resolveDivisionStanding(
            standingsByTeamId,
            awayTeamInfo.id,
            awayLineScore?.TEAM_DIVISION
        );
        const homeDivisionStanding = this.resolveDivisionStanding(
            standingsByTeamId,
            homeTeamInfo.id,
            homeLineScore?.TEAM_DIVISION
        );

        const overtimeCount = Math.max(0, periodScores.length - 4);
        const leadChangesFromHeader = Number.parseInt(gameHeader?.LEAD_CHANGES, 10) || 0;
        const timesTiedFromHeader = Number.parseInt(gameHeader?.TIMES_TIED, 10) || 0;
        const clutchFromHeader = Math.max(0, leadChangesFromHeader + Math.floor(timesTiedFromHeader / 2));
        const comebackDeficitQ4 = this.calculateComebackDeficitQ4(periodScores, awayScore, homeScore);
        const fallbackSignals = this.calculateScoreboardFallbackSignals({
            awayScore,
            homeScore,
            totalPoints: awayScore + homeScore,
            scoreMargin: Math.abs(awayScore - homeScore),
            leadChanges: leadChangesFromHeader,
            timesTied: timesTiedFromHeader,
            overtimeCount,
            periodScores,
            isFuture
        });

        return {
            id: gameId,
            date: gameDate,
            officialDate: Utils.formatDateForDisplay(gameDate),
            playedDate: Utils.formatDateForDisplay(gameDate),
            gameTime: Utils.formatGameTime(gameDate),
            status: statusText || (isFinal ? 'Final' : 'Scheduled'),
            isFuture,
            gameType: this.resolveGameType(gameHeader?.SEASON),
            venue: this.resolveVenue(gameInfo, homeTeamInfo),
            awayTeam: {
                id: awayTeamInfo.id,
                name: awayTeamInfo.name,
                abbreviation: awayTeamInfo.abbreviation,
                logoUrl: Utils.getTeamLogoUrl(awayTeamInfo.id),
                score: awayScore,
                division: awayDivisionStanding.division,
                divisionRank: awayDivisionStanding.divisionRank,
                divisionStanding: awayDivisionStanding.divisionStanding,
                record: awayRecord
            },
            homeTeam: {
                id: homeTeamInfo.id,
                name: homeTeamInfo.name,
                abbreviation: homeTeamInfo.abbreviation,
                logoUrl: Utils.getTeamLogoUrl(homeTeamInfo.id),
                score: homeScore,
                division: homeDivisionStanding.division,
                divisionRank: homeDivisionStanding.divisionRank,
                divisionStanding: homeDivisionStanding.divisionStanding,
                record: homeRecord
            },
            periodScores,
            totalPeriods: periodScores.length,
            isOvertime: overtimeCount > 0,
            overtimeCount,
            scoreMargin: Math.abs(awayScore - homeScore),
            totalPoints: awayScore + homeScore,
            leadChanges: leadChangesFromHeader,
            timesTied: timesTiedFromHeader,
            clutchPossessions: clutchFromHeader,
            comebackDeficitQ4,
            starPerformanceScore: fallbackSignals.star.score,
            starPerformanceSummary: fallbackSignals.star.summary,
            starPerformanceAvailable: fallbackSignals.star.available,
            starPerformanceSource: fallbackSignals.star.source,
            starPowerPrimaryImpact: fallbackSignals.star.primaryImpact,
            starPowerSecondaryImpact: fallbackSignals.star.secondaryImpact,
            paceEfficiencyScore: fallbackSignals.pace.score,
            paceEfficiencySummary: fallbackSignals.pace.summary,
            paceEfficiencyAvailable: fallbackSignals.pace.available,
            paceEfficiencySource: fallbackSignals.pace.source,
            paceAverage: fallbackSignals.pace.avgPace,
            paceAverageOffRating: fallbackSignals.pace.avgOffRating,
            paceOffRatingGap: fallbackSignals.pace.offRatingGap
        };
    }

    static calculateScoreboardFallbackSignals(context = {}) {
        const isFuture = Boolean(context?.isFuture);

        if (isFuture) {
            return {
                star: {
                    available: false,
                    score: 0,
                    summary: 'Pending completion',
                    source: 'scoreboard-pending',
                    primaryImpact: 0,
                    secondaryImpact: 0
                },
                pace: {
                    available: false,
                    score: 0,
                    summary: 'Pending completion',
                    source: 'scoreboard-pending',
                    avgPace: 0,
                    avgOffRating: 0,
                    offRatingGap: 0
                }
            };
        }

        const awayScore = Utils.toNumber(context?.awayScore);
        const homeScore = Utils.toNumber(context?.homeScore);
        const totalPoints = Utils.toNumber(context?.totalPoints, awayScore + homeScore);
        const scoreMargin = Math.max(0, Utils.toNumber(context?.scoreMargin, Math.abs(homeScore - awayScore)));
        const leadChanges = Math.max(0, Utils.toNumber(context?.leadChanges));
        const timesTied = Math.max(0, Utils.toNumber(context?.timesTied));
        const overtimeCount = Math.max(0, Utils.toNumber(context?.overtimeCount));
        const periodScores = Array.isArray(context?.periodScores) ? context.periodScores : [];

        const higherTeamScore = Math.max(homeScore, awayScore);
        const lowerTeamScore = Math.min(homeScore, awayScore);

        const bothTeamsScoringComponent = Utils.clamp((lowerTeamScore - 90) / 25, 0, 1);
        const topScorerComponent = Utils.clamp((higherTeamScore - 98) / 22, 0, 1);
        const duelClosenessComponent = 1 - Utils.clamp(scoreMargin / 22, 0, 1);
        const swingComponent = Utils.clamp(((leadChanges * 1.2) + timesTied) / 14, 0, 1);
        const starScore = Utils.clamp(
            (topScorerComponent * 0.33)
            + (bothTeamsScoringComponent * 0.3)
            + (duelClosenessComponent * 0.22)
            + (swingComponent * 0.15),
            0,
            1
        );

        const primaryImpact = 24 + (starScore * 18);
        const secondaryImpact = 21 + (starScore * 15 * duelClosenessComponent);

        const averageCombinedPeriodPoints = periodScores.length > 0
            ? periodScores.reduce((sum, period) => {
                const awayPeriod = Utils.toNumber(period?.away);
                const homePeriod = Utils.toNumber(period?.home);
                return sum + awayPeriod + homePeriod;
            }, 0) / periodScores.length
            : totalPoints / Math.max(4, 4 + overtimeCount);

        const tempoComponent = Utils.clamp((totalPoints - 188) / 54, 0, 1);
        const shotmakingComponent = Utils.clamp((averageCombinedPeriodPoints - 46) / 16, 0, 1);
        const balanceComponent = 1 - Utils.clamp(scoreMargin / 28, 0, 1);
        const overtimeComponent = overtimeCount > 0 ? Utils.clamp(0.2 + (overtimeCount * 0.2), 0, 0.6) : 0;

        const paceScore = Utils.clamp(
            (tempoComponent * 0.46)
            + (shotmakingComponent * 0.28)
            + (balanceComponent * 0.2)
            + (overtimeComponent * 0.06),
            0,
            1
        );

        const estimatedPace = Utils.clamp(totalPoints / 2.2, 84, 112);
        const estimatedOffRating = estimatedPace > 0
            ? (totalPoints * 100) / (estimatedPace * 2)
            : 0;
        const estimatedOffRatingGap = Utils.clamp((scoreMargin * 0.85), 0, 24);

        return {
            star: {
                available: true,
                score: starScore,
                summary: `Proxy from scoreboard: ${higherTeamScore}-${lowerTeamScore}, margin ${scoreMargin}`,
                source: 'scoreboard-proxy',
                primaryImpact,
                secondaryImpact
            },
            pace: {
                available: true,
                score: paceScore,
                summary: `Proxy from scoreboard: ${totalPoints} total points`,
                source: 'scoreboard-proxy',
                avgPace: estimatedPace,
                avgOffRating: estimatedOffRating,
                offRatingGap: estimatedOffRatingGap
            }
        };
    }

    static resolveGameType(seasonCode) {
        const normalized = String(seasonCode || '');

        if (normalized.startsWith('1')) {
            return 'Preseason';
        }

        if (normalized.startsWith('4')) {
            return 'Playoffs';
        }

        if (normalized.startsWith('2')) {
            return 'Regular';
        }

        return 'Regular';
    }

    static resolveVenue(gameInfo, homeTeamInfo) {
        const arenaName = String(gameInfo?.ARENA_NAME || gameInfo?.ARENA || '').trim();
        if (arenaName) {
            return arenaName;
        }

        const city = String(homeTeamInfo?.city || '').trim();
        return city ? `${city} Home Court` : 'NBA Arena';
    }

    static createPeriodScores(awayLineScore, homeLineScore) {
        if (!awayLineScore && !homeLineScore) {
            return [];
        }

        const periodScores = [];

        for (let period = 1; period <= 4; period += 1) {
            periodScores.push({
                periodNumber: period,
                label: Utils.getPeriodLabel(period),
                away: Number.parseInt(awayLineScore?.[`PTS_QTR${period}`], 10) || 0,
                home: Number.parseInt(homeLineScore?.[`PTS_QTR${period}`], 10) || 0
            });
        }

        for (let overtimeIndex = 1; overtimeIndex <= 10; overtimeIndex += 1) {
            const awayOtRaw = awayLineScore?.[`PTS_OT${overtimeIndex}`];
            const homeOtRaw = homeLineScore?.[`PTS_OT${overtimeIndex}`];
            const hasOvertimeData = awayOtRaw !== null
                && awayOtRaw !== undefined
                && awayOtRaw !== ''
                || homeOtRaw !== null
                && homeOtRaw !== undefined
                && homeOtRaw !== '';

            if (!hasOvertimeData) {
                break;
            }

            periodScores.push({
                periodNumber: 4 + overtimeIndex,
                label: Utils.getPeriodLabel(4 + overtimeIndex),
                away: Number.parseInt(awayOtRaw, 10) || 0,
                home: Number.parseInt(homeOtRaw, 10) || 0
            });
        }

        return periodScores;
    }

    static calculateComebackDeficitQ4(periodScores, awayFinalScore, homeFinalScore) {
        if (!Array.isArray(periodScores) || periodScores.length < 4) {
            return 0;
        }

        const awayFinal = Number(awayFinalScore);
        const homeFinal = Number(homeFinalScore);
        if (!Number.isFinite(awayFinal) || !Number.isFinite(homeFinal) || awayFinal === homeFinal) {
            return 0;
        }

        const winner = awayFinal > homeFinal ? 'away' : 'home';
        const throughThird = periodScores.slice(0, 3).reduce((totals, period) => {
            return {
                away: totals.away + (Number(period?.away) || 0),
                home: totals.home + (Number(period?.home) || 0)
            };
        }, {
            away: 0,
            home: 0
        });

        const winnerDeficit = winner === 'away'
            ? throughThird.home - throughThird.away
            : throughThird.away - throughThird.home;

        return Math.max(0, winnerDeficit);
    }

    static async enhanceGamesWithDetailedData(games) {
        if (!Array.isArray(games) || games.length === 0) {
            return [];
        }

        return Promise.all(games.map(async (game, index) => {
            if (game?.isFuture) {
                return game;
            }

            if (index >= this.MAX_GAMES_TO_ENHANCE_PER_LOAD) {
                return game;
            }

            try {
                const enhancements = await API.fetchGameEnhancements(game.id);
                return this.applyEnhancements(game, enhancements);
            } catch (error) {
                console.warn(`Unable to load NBA enhancements for game ${game.id}:`, error);
                return game;
            }
        }));
    }

    static applyEnhancements(game, enhancements) {
        const playByPlayRows = Array.isArray(enhancements?.playByPlayRows)
            ? enhancements.playByPlayRows
            : [];

        const leadChanges = playByPlayRows.length > 0
            ? this.countLeadChanges(playByPlayRows, game)
            : (Number(game?.leadChanges) || 0);

        const clutchPossessions = playByPlayRows.length > 0
            ? this.countClutchPossessions(playByPlayRows)
            : (Number(game?.clutchPossessions) || 0);

        const starPerformance = this.calculateStarPerformance(enhancements.playerRows);
        const paceEfficiency = this.calculatePaceEfficiency(enhancements.advancedTeamRows);

        const resolvedStarPerformance = starPerformance.available
            ? {
                ...starPerformance,
                source: 'player-stats'
            }
            : {
                available: Boolean(game?.starPerformanceAvailable),
                score: Utils.clamp(Utils.toNumber(game?.starPerformanceScore), 0, 1),
                summary: String(game?.starPerformanceSummary || 'Not available'),
                source: String(game?.starPerformanceSource || 'scoreboard-proxy'),
                primaryImpact: Utils.toNumber(game?.starPowerPrimaryImpact),
                secondaryImpact: Utils.toNumber(game?.starPowerSecondaryImpact)
            };

        const resolvedPaceEfficiency = paceEfficiency.available
            ? {
                ...paceEfficiency,
                source: 'advanced-team-stats'
            }
            : {
                available: Boolean(game?.paceEfficiencyAvailable),
                score: Utils.clamp(Utils.toNumber(game?.paceEfficiencyScore), 0, 1),
                summary: String(game?.paceEfficiencySummary || 'Not available'),
                source: String(game?.paceEfficiencySource || 'scoreboard-proxy'),
                avgPace: Utils.toNumber(game?.paceAverage),
                avgOffRating: Utils.toNumber(game?.paceAverageOffRating),
                offRatingGap: Utils.toNumber(game?.paceOffRatingGap)
            };

        return {
            ...game,
            leadChanges,
            clutchPossessions,
            starPerformanceScore: resolvedStarPerformance.score,
            starPerformanceSummary: resolvedStarPerformance.summary,
            starPerformanceAvailable: resolvedStarPerformance.available,
            starPerformanceSource: resolvedStarPerformance.source,
            starPowerPrimaryImpact: resolvedStarPerformance.primaryImpact,
            starPowerSecondaryImpact: resolvedStarPerformance.secondaryImpact,
            paceEfficiencyScore: resolvedPaceEfficiency.score,
            paceEfficiencySummary: resolvedPaceEfficiency.summary,
            paceEfficiencyAvailable: resolvedPaceEfficiency.available,
            paceEfficiencySource: resolvedPaceEfficiency.source,
            paceAverage: resolvedPaceEfficiency.avgPace,
            paceAverageOffRating: resolvedPaceEfficiency.avgOffRating,
            paceOffRatingGap: resolvedPaceEfficiency.offRatingGap
        };
    }

    static parseScoreMargin(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const normalized = String(value).trim().toUpperCase();
        if (normalized === 'TIE') {
            return 0;
        }

        const parsed = Number.parseInt(normalized, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }

    static parseClockToSeconds(clockValue) {
        if (!clockValue) {
            return null;
        }

        const text = String(clockValue).trim();
        const mmssMatch = text.match(/^(\d{1,2}):(\d{2})$/);
        if (mmssMatch) {
            const minutes = Number.parseInt(mmssMatch[1], 10);
            const seconds = Number.parseInt(mmssMatch[2], 10);
            return (minutes * 60) + seconds;
        }

        const isoMatch = text.match(/^PT(\d+)M(\d+(?:\.\d+)?)S$/i);
        if (isoMatch) {
            const minutes = Number.parseInt(isoMatch[1], 10);
            const seconds = Number.parseFloat(isoMatch[2]);
            return (minutes * 60) + Math.floor(seconds);
        }

        return null;
    }

    static countLeadChanges(playByPlayRows, game) {
        if (!Array.isArray(playByPlayRows) || playByPlayRows.length === 0) {
            return 0;
        }

        let leadChanges = 0;
        let currentLeader = null;

        playByPlayRows.forEach((row) => {
            const margin = this.parseScoreMargin(row?.SCOREMARGIN ?? row?.SCORE_MARGIN ?? row?.HOME_SCORE_MARGIN);

            if (margin === null || margin === 0) {
                return;
            }

            const leader = margin > 0 ? 'home' : 'away';
            if (currentLeader && leader !== currentLeader) {
                leadChanges += 1;
            }

            currentLeader = leader;
        });

        // If no data was available from play-by-play, backfill a conservative value from score margin.
        if (leadChanges === 0 && Number.isFinite(game?.scoreMargin) && game.scoreMargin <= 3) {
            return 1;
        }

        return leadChanges;
    }

    static countClutchPossessions(playByPlayRows) {
        if (!Array.isArray(playByPlayRows) || playByPlayRows.length === 0) {
            return 0;
        }

        const possessionEventTypes = new Set([1, 2, 3, 5]);
        let clutchEvents = 0;

        playByPlayRows.forEach((row) => {
            const period = Number.parseInt(row?.PERIOD, 10);
            const eventType = Number.parseInt(row?.EVENTMSGTYPE, 10);
            const margin = this.parseScoreMargin(row?.SCOREMARGIN ?? row?.SCORE_MARGIN ?? row?.HOME_SCORE_MARGIN);
            const secondsRemaining = this.parseClockToSeconds(row?.PCTIMESTRING ?? row?.PC_TIME);

            if (!Number.isFinite(period) || !Number.isFinite(eventType) || margin === null) {
                return;
            }

            const inClutchWindow = period > 4 || (period === 4 && Number.isFinite(secondsRemaining) && secondsRemaining <= 300);
            if (!inClutchWindow) {
                return;
            }

            if (Math.abs(margin) > 5) {
                return;
            }

            if (!possessionEventTypes.has(eventType)) {
                return;
            }

            clutchEvents += 1;
        });

        return clutchEvents;
    }

    static calculateStarPerformance(playerRows) {
        if (!Array.isArray(playerRows) || playerRows.length === 0) {
            return {
                available: false,
                score: 0,
                summary: 'Not available',
                primaryImpact: 0,
                secondaryImpact: 0
            };
        }

        const scoredPlayers = playerRows
            .map((playerRow) => {
                const points = Utils.toNumber(playerRow?.PTS);
                const rebounds = Utils.toNumber(playerRow?.REB);
                const assists = Utils.toNumber(playerRow?.AST);
                const steals = Utils.toNumber(playerRow?.STL);
                const blocks = Utils.toNumber(playerRow?.BLK);
                const turnovers = Utils.toNumber(playerRow?.TO);
                const threes = Utils.toNumber(playerRow?.FG3M);

                const impact = points
                    + (rebounds * 1.2)
                    + (assists * 1.5)
                    + ((steals + blocks) * 3)
                    + (threes * 0.6)
                    - (turnovers * 1.5);

                return {
                    name: String(playerRow?.PLAYER_NAME || 'Unknown Player'),
                    teamId: Number(playerRow?.TEAM_ID) || 0,
                    points,
                    rebounds,
                    assists,
                    impact
                };
            })
            .sort((a, b) => b.impact - a.impact);

        if (scoredPlayers.length === 0) {
            return {
                available: false,
                score: 0,
                summary: 'Not available',
                primaryImpact: 0,
                secondaryImpact: 0
            };
        }

        const leadersByTeam = new Map();
        scoredPlayers.forEach((player) => {
            if (player.teamId > 0 && !leadersByTeam.has(player.teamId)) {
                leadersByTeam.set(player.teamId, player);
            }
        });

        const teamLeaders = Array.from(leadersByTeam.values()).sort((a, b) => b.impact - a.impact);

        const topPlayer = teamLeaders[0] || scoredPlayers[0];
        const secondPlayer = teamLeaders.find((player) => player.teamId !== topPlayer.teamId)
            || scoredPlayers.find((player) => player.name !== topPlayer.name)
            || null;
        const primaryImpact = Number(topPlayer?.impact) || 0;
        const secondaryImpact = Number(secondPlayer?.impact) || 0;

        const primaryComponent = Utils.clamp((primaryImpact - 28) / 20, 0, 1);
        const secondaryComponent = Utils.clamp((secondaryImpact - 22) / 18, 0, 1);
        const duelBalance = secondPlayer
            ? 1 - Utils.clamp(Math.abs(primaryImpact - secondaryImpact) / 20, 0, 1)
            : 0;
        const normalizedScore = Utils.clamp(
            (primaryComponent * 0.45)
            + (secondaryComponent * 0.35)
            + (duelBalance * 0.2),
            0,
            1
        );

        const summary = secondPlayer
            ? `${topPlayer.name} vs ${secondPlayer.name}: ${topPlayer.points} PTS / ${secondPlayer.points} PTS`
            : `${topPlayer.name}: ${topPlayer.points} PTS, ${topPlayer.rebounds} REB, ${topPlayer.assists} AST`;

        return {
            available: true,
            score: normalizedScore,
            summary,
            primaryImpact,
            secondaryImpact
        };
    }

    static calculatePaceEfficiency(advancedTeamRows) {
        if (!Array.isArray(advancedTeamRows) || advancedTeamRows.length < 2) {
            return {
                available: false,
                score: 0,
                summary: 'Not available',
                avgPace: 0,
                avgOffRating: 0,
                offRatingGap: 0
            };
        }

        const teamRows = advancedTeamRows.slice(0, 2);
        const paceValues = teamRows.map((row) => Utils.toNumber(row?.PACE));
        const offRatingValues = teamRows.map((row) => Utils.toNumber(row?.OFF_RATING));

        const avgPace = paceValues.reduce((sum, value) => sum + value, 0) / paceValues.length;
        const avgOffRating = offRatingValues.reduce((sum, value) => sum + value, 0) / offRatingValues.length;
        const offRatingGap = Math.abs(offRatingValues[0] - offRatingValues[1]);

        const paceComponent = Utils.clamp((avgPace - 95) / 12, 0, 1);
        const efficiencyComponent = Utils.clamp((avgOffRating - 108) / 18, 0, 1);
        const balanceComponent = 1 - Utils.clamp(offRatingGap / 20, 0, 1);

        const combinedScore = Utils.clamp(
            (paceComponent * 0.35)
            + (efficiencyComponent * 0.4)
            + (balanceComponent * 0.25),
            0,
            1
        );

        return {
            available: true,
            score: combinedScore,
            summary: `${avgPace.toFixed(1)} pace, ${avgOffRating.toFixed(1)} ORtg`,
            avgPace,
            avgOffRating,
            offRatingGap
        };
    }
}
