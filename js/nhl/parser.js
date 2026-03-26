/**
 * Parse normalized NHL scoreboard result sets into app game models.
 */
import { API } from './api.js';
import Utils from './utils.js';

export class Parser {
    static processGames(scoreboardData) {
        const standingsByTeamId = this.extractStandingsByTeamId(scoreboardData);
        const gameHeaders = API.extractRows(scoreboardData, 'GameHeader');
        const lineScores = API.extractRows(scoreboardData, 'LineScore');
        const gameInfoRows = API.extractRows(scoreboardData, 'GameInfo');

        if (!Array.isArray(gameHeaders) || gameHeaders.length === 0) {
            return [];
        }

        const lineScoresByGameId = this.groupRowsByGameId(lineScores);
        const gameInfoByGameId = this.groupSingleRowByGameId(gameInfoRows);

        return gameHeaders.map((gameHeader) => {
            const gameId = String(gameHeader?.GAME_ID || '');
            const gameLineScores = lineScoresByGameId.get(gameId) || [];
            const gameInfo = gameInfoByGameId.get(gameId) || null;
            return this.processSingleGame(gameHeader, gameLineScores, gameInfo, standingsByTeamId);
        });
    }

    static extractStandingsByTeamId(scoreboardData) {
        const rawStandings = scoreboardData?.standingsByTeamId;
        return rawStandings && typeof rawStandings === 'object' ? rawStandings : {};
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

    static resolveDivisionStanding(standingsByTeamId, teamId, fallbackDivision = '') {
        const teamKey = String(Number.parseInt(teamId, 10) || teamId || '');
        const standing = standingsByTeamId?.[teamKey] || null;

        const division = String(standing?.division || fallbackDivision || '').trim();
        const divisionRankValue = Number.parseInt(standing?.divisionRank, 10);
        const divisionRank = Number.isFinite(divisionRankValue) && divisionRankValue > 0 ? divisionRankValue : null;

        return {
            division,
            divisionRank,
            divisionStanding: divisionRank ? `${this.toOrdinalLabel(divisionRank)} in ${division || 'Division'}` : division
        };
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
        const isFuture = statusId === 1;
        const gameDate = gameHeader?.GAME_DATE_EST || gameHeader?.GAME_DATE || '';

        const awayDivisionStanding = this.resolveDivisionStanding(standingsByTeamId, awayTeamInfo.id, awayLineScore?.TEAM_DIVISION);
        const homeDivisionStanding = this.resolveDivisionStanding(standingsByTeamId, homeTeamInfo.id, homeLineScore?.TEAM_DIVISION);

        const overtimeCount = Math.max(0, periodScores.length - 3);
        const leadChanges = Number.parseInt(gameHeader?.LEAD_CHANGES, 10) || 0;
        const timesTied = Number.parseInt(gameHeader?.TIMES_TIED, 10) || 0;
        const shotsTotal = (Number.parseInt(awayLineScore?.SHOTS, 10) || 0) + (Number.parseInt(homeLineScore?.SHOTS, 10) || 0);
        const saveTotal = (Number.parseInt(awayLineScore?.SAVES, 10) || 0) + (Number.parseInt(homeLineScore?.SAVES, 10) || 0);
        const ppGoalsTotal = (Number.parseInt(awayLineScore?.PP_GOALS, 10) || 0) + (Number.parseInt(homeLineScore?.PP_GOALS, 10) || 0);

        return {
            id: gameId,
            date: gameDate,
            officialDate: Utils.formatDateForDisplay(gameDate),
            playedDate: Utils.formatDateForDisplay(gameDate),
            gameTime: Utils.formatGameTime(gameDate),
            status: statusText || (isFinal ? 'Final' : 'Scheduled'),
            isFuture,
            gameType: this.resolveGameType(gameHeader?.SEASON),
            venue: this.resolveVenue(gameInfo),
            awayTeam: {
                id: awayTeamInfo.id,
                name: awayTeamInfo.name,
                abbreviation: awayTeamInfo.abbreviation,
                logoUrl: Utils.getTeamLogoUrl(awayTeamInfo.abbreviation),
                score: awayScore,
                division: awayDivisionStanding.division,
                divisionRank: awayDivisionStanding.divisionRank,
                divisionStanding: awayDivisionStanding.divisionStanding,
                record: Utils.parseRecord(awayLineScore?.TEAM_WINS_LOSSES)
            },
            homeTeam: {
                id: homeTeamInfo.id,
                name: homeTeamInfo.name,
                abbreviation: homeTeamInfo.abbreviation,
                logoUrl: Utils.getTeamLogoUrl(homeTeamInfo.abbreviation),
                score: homeScore,
                division: homeDivisionStanding.division,
                divisionRank: homeDivisionStanding.divisionRank,
                divisionStanding: homeDivisionStanding.divisionStanding,
                record: Utils.parseRecord(homeLineScore?.TEAM_WINS_LOSSES)
            },
            periodScores,
            totalPeriods: periodScores.length,
            isOvertime: overtimeCount > 0,
            overtimeCount,
            scoreMargin: Math.abs(awayScore - homeScore),
            totalPoints: awayScore + homeScore,
            leadChanges,
            timesTied,
            comebackDeficitQ4: 0,
            shotsTotal,
            saveTotal,
            ppGoalsTotal,
            goalieWorkloadScore: Utils.clamp(saveTotal / 90, 0, 1),
            specialTeamsScore: Utils.clamp(ppGoalsTotal / 5, 0, 1)
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

        return 'Regular';
    }

    static resolveVenue(gameInfo) {
        const arenaName = String(gameInfo?.ARENA_NAME || gameInfo?.ARENA || '').trim();
        return arenaName || 'NHL Arena';
    }

    static createPeriodScores(awayLineScore, homeLineScore) {
        if (!awayLineScore && !homeLineScore) {
            return [];
        }

        const periodScores = [];
        for (let period = 1; period <= 3; period += 1) {
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
            const hasOvertimeData = awayOtRaw !== null && awayOtRaw !== undefined && awayOtRaw !== ''
                || homeOtRaw !== null && homeOtRaw !== undefined && homeOtRaw !== '';

            if (!hasOvertimeData) {
                break;
            }

            periodScores.push({
                periodNumber: 3 + overtimeIndex,
                label: Utils.getPeriodLabel(3 + overtimeIndex),
                away: Number.parseInt(awayOtRaw, 10) || 0,
                home: Number.parseInt(homeOtRaw, 10) || 0
            });
        }

        return periodScores;
    }

    static async enhanceGamesWithDetailedData(games) {
        return Array.isArray(games) ? games : [];
    }
}
