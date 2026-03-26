/**
 * API handling for NHL game data via ESPN public endpoints.
 */
import Utils from './utils.js';
import APICache from './cache.js';

const GAME_HEADER_HEADERS = [
    'GAME_ID',
    'GAME_STATUS_ID',
    'GAME_STATUS_TEXT',
    'WH_STATUS_TEXT',
    'GAME_DATE_EST',
    'GAME_DATE',
    'VISITOR_TEAM_ID',
    'HOME_TEAM_ID',
    'SEASON',
    'LEAD_CHANGES',
    'TIMES_TIED'
];

const LINE_SCORE_HEADERS = [
    'GAME_ID',
    'TEAM_ID',
    'TEAM_ABBREVIATION',
    'TEAM_NAME',
    'TEAM_CITY_NAME',
    'TEAM_DIVISION',
    'TEAM_WINS_LOSSES',
    'PTS',
    'PTS_QTR1',
    'PTS_QTR2',
    'PTS_QTR3',
    'PTS_QTR4',
    'PTS_OT1',
    'PTS_OT2',
    'PTS_OT3',
    'PTS_OT4',
    'PTS_OT5',
    'PTS_OT6',
    'PTS_OT7',
    'PTS_OT8',
    'PTS_OT9',
    'PTS_OT10',
    'SHOTS',
    'SAVES',
    'PP_GOALS'
];

const GAME_INFO_HEADERS = ['GAME_ID', 'ARENA_NAME', 'ARENA'];

function toInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function toIsoDateFromValue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toISOString().split('T')[0];
}

function toEspnDate(isoDate) {
    return String(isoDate || '').replace(/-/g, '');
}

function getEventCompetition(event = {}) {
    const competitions = Array.isArray(event?.competitions) ? event.competitions : [];
    return competitions[0] || null;
}

function getCompetitors(competition = {}) {
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const away = competitors.find((entry) => String(entry?.homeAway || '').toLowerCase() === 'away') || competitors[0] || {};
    const home = competitors.find((entry) => String(entry?.homeAway || '').toLowerCase() === 'home') || competitors[1] || {};
    return { away, home };
}

function getRecordSummary(competitor = {}) {
    const records = Array.isArray(competitor?.records) ? competitor.records : [];
    const summary = records.find((record) => record?.summary)?.summary;
    return toText(summary, '0-0-0');
}

function getCompetitorStat(competitor = {}, aliases = [], fallback = 0) {
    const stats = Array.isArray(competitor?.statistics) ? competitor.statistics : [];
    const wanted = aliases.map((alias) => String(alias).toLowerCase());

    const stat = stats.find((entry) => {
        const keys = [entry?.name, entry?.displayName, entry?.abbreviation, entry?.shortDisplayName]
            .map((value) => String(value || '').toLowerCase());
        return wanted.some((alias) => keys.includes(alias));
    });

    const parsed = Number.parseInt(stat?.value ?? stat?.displayValue, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toStatusInfo(event = {}) {
    const competition = getEventCompetition(event) || {};
    const status = competition?.status || event?.status || {};
    const statusType = status?.type || {};
    const rawText = toText(statusType?.shortDetail || statusType?.description || statusType?.name || status?.displayClock);
    const normalized = rawText.toLowerCase();

    if (statusType?.completed || normalized.includes('final')) {
        return { id: 3, text: 'Final' };
    }

    if (statusType?.state === 'in' || /period|intermission|shootout|ot|live/.test(normalized)) {
        return { id: 2, text: rawText || 'In Progress' };
    }

    return { id: 1, text: rawText || 'Scheduled' };
}

function toSeasonCode(event = {}) {
    const seasonType = toInteger(event?.season?.type, 2);
    if (seasonType === 1) {
        return '1';
    }

    if (seasonType === 2) {
        return '2';
    }

    return '4';
}

export class APIError extends Error {
    constructor(message, status, endpoint) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.endpoint = endpoint;
    }
}

export const API = {
    DEFAULT_REQUEST_TIMEOUT_MS: 15000,
    cache: new APICache(),

    inferSeasonFromDate(dateValue) {
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        const month = parsed.getUTCMonth() + 1;
        const year = parsed.getUTCFullYear();
        return month >= 7 ? year : year - 1;
    },

    async fetchJsonWithTimeout(url, timeoutMs = this.DEFAULT_REQUEST_TIMEOUT_MS) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller.signal
            });

            if (!response.ok) {
                throw new APIError(`ESPN NHL request failed (${response.status})`, response.status || 0, url);
            }

            return await response.json();
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new APIError(`ESPN NHL request timed out after ${Math.round(timeoutMs / 1000)}s`, 408, url);
            }

            if (error instanceof APIError) {
                throw error;
            }

            throw new APIError('Network error while requesting ESPN NHL endpoint.', 0, url);
        } finally {
            clearTimeout(timeoutId);
        }
    },

    getResultSet(data, resultSetName) {
        const normalizedName = String(resultSetName || '').toLowerCase();
        const resultSets = Array.isArray(data?.resultSets) ? data.resultSets : [];

        return resultSets.find((set) => String(set?.name || '').toLowerCase() === normalizedName) || null;
    },

    mapResultSetRows(resultSet) {
        const headers = Array.isArray(resultSet?.headers) ? resultSet.headers : [];
        const rows = Array.isArray(resultSet?.rowSet) ? resultSet.rowSet : [];

        if (headers.length === 0 || rows.length === 0) {
            return [];
        }

        return rows.map((row) => {
            const mapped = {};
            headers.forEach((header, index) => {
                mapped[String(header)] = row[index];
            });
            return mapped;
        });
    },

    extractRows(data, resultSetName) {
        return this.mapResultSetRows(this.getResultSet(data, resultSetName));
    },

    buildLineScoreRow(gameId, competitor, team) {
        const linescores = Array.isArray(competitor?.linescores) ? competitor.linescores : [];
        const periods = [0, 1, 2].map((index) => toInteger(linescores[index]?.value, 0));
        const otValues = new Array(10).fill(null);

        if (linescores.length > 3) {
            linescores.slice(3, 13).forEach((entry, index) => {
                otValues[index] = toInteger(entry?.value, 0);
            });
        }

        return [
            gameId,
            toInteger(team?.id, 0),
            toText(team?.abbreviation),
            toText(team?.displayName || team?.name),
            toText(team?.location),
            toText(team?.division?.name || team?.group?.name),
            getRecordSummary(competitor),
            toInteger(competitor?.score, 0),
            periods[0],
            periods[1],
            periods[2],
            0,
            ...otValues,
            getCompetitorStat(competitor, ['shots', 'shotsOnGoal', 'sog'], 0),
            getCompetitorStat(competitor, ['saves', 'sv'], 0),
            getCompetitorStat(competitor, ['powerPlayGoals', 'ppg'], 0)
        ];
    },

    buildScoreboardResultSets(events = []) {
        const gameHeaderRows = [];
        const lineScoreRows = [];
        const gameInfoRows = [];

        events.forEach((event) => {
            const gameId = toText(event?.id);
            if (!gameId) {
                return;
            }

            const competition = getEventCompetition(event) || {};
            const { away, home } = getCompetitors(competition);
            const awayTeam = away?.team || {};
            const homeTeam = home?.team || {};
            const statusInfo = toStatusInfo(event);
            const gameDate = toText(event?.date);

            gameHeaderRows.push([
                gameId,
                statusInfo.id,
                statusInfo.text,
                statusInfo.text,
                gameDate,
                gameDate,
                toInteger(awayTeam?.id, 0),
                toInteger(homeTeam?.id, 0),
                toSeasonCode(event),
                0,
                0
            ]);

            lineScoreRows.push(this.buildLineScoreRow(gameId, away, awayTeam));
            lineScoreRows.push(this.buildLineScoreRow(gameId, home, homeTeam));

            const arenaName = toText(competition?.venue?.fullName, 'NHL Arena');
            gameInfoRows.push([gameId, arenaName, arenaName]);
        });

        return {
            resultSets: [
                { name: 'GameHeader', headers: GAME_HEADER_HEADERS, rowSet: gameHeaderRows },
                { name: 'LineScore', headers: LINE_SCORE_HEADERS, rowSet: lineScoreRows },
                { name: 'GameInfo', headers: GAME_INFO_HEADERS, rowSet: gameInfoRows }
            ]
        };
    },

    getStandingsStatValue(stats = [], aliases = [], fallback = null) {
        const wanted = aliases.map((alias) => String(alias).toLowerCase());

        const entry = stats.find((stat) => {
            const keys = [stat?.name, stat?.displayName, stat?.abbreviation, stat?.shortDisplayName]
                .map((value) => String(value || '').toLowerCase());
            return wanted.some((alias) => keys.includes(alias));
        });

        return entry?.value ?? entry?.displayValue ?? fallback;
    },

    mapStandingsByTeam(payload) {
        const groups = Array.isArray(payload?.children) ? payload.children : [];

        return groups.reduce((mapped, group) => {
            const conference = toText(group?.name, 'League');
            const entries = Array.isArray(group?.standings?.entries) ? group.standings.entries : [];

            entries.forEach((entry) => {
                const team = entry?.team || {};
                const teamId = toInteger(team?.id, 0);
                if (teamId <= 0) {
                    return;
                }

                const stats = Array.isArray(entry?.stats) ? entry.stats : [];
                const wins = toInteger(this.getStandingsStatValue(stats, ['wins', 'w'], 0), 0);
                const losses = toInteger(this.getStandingsStatValue(stats, ['losses', 'l'], 0), 0);
                const otLosses = toInteger(this.getStandingsStatValue(stats, ['otlosses', 'otl'], 0), 0);
                const points = toInteger(this.getStandingsStatValue(stats, ['points', 'pts'], 0), 0);
                const conferenceRank = toInteger(this.getStandingsStatValue(stats, ['rank', 'playoffseed', 'seed'], 0), 0);
                const divisionRank = toInteger(this.getStandingsStatValue(stats, ['divisionrank', 'divrank'], 0), 0);

                mapped[String(teamId)] = {
                    teamId,
                    teamName: toText(team?.displayName || team?.name),
                    abbreviation: toText(team?.abbreviation),
                    city: toText(team?.location),
                    conference,
                    division: toText(team?.division?.name || group?.abbreviation),
                    divisionRank: divisionRank > 0 ? divisionRank : null,
                    conferenceRank: conferenceRank > 0 ? conferenceRank : null,
                    wins,
                    losses,
                    otLosses,
                    points,
                    winPct: null,
                    gamesBehind: '-'
                };
            });

            return mapped;
        }, {});
    },

    async fetchStandingsForSeason(season) {
        const normalizedSeason = toInteger(season, 0);
        if (normalizedSeason <= 0) {
            return {};
        }

        const cacheKey = Utils.createCacheKey('espn-nhl-standings', { season: normalizedSeason });
        return this.cache.getOrFetch(cacheKey, async () => {
            const url = `https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings?season=${normalizedSeason}`;
            const payload = await this.fetchJsonWithTimeout(url, 12000);
            return this.mapStandingsByTeam(payload);
        });
    },

    async fetchScoreboardEventsForDate(date) {
        const normalizedDate = toIsoDateFromValue(date) || toText(date);
        if (!normalizedDate) {
            throw new APIError('Invalid NHL date request.', 400, 'scoreboard');
        }

        const cacheKey = Utils.createCacheKey('espn-nhl-scoreboard-day', { date: normalizedDate });
        return this.cache.getOrFetch(cacheKey, async () => {
            const espnDate = toEspnDate(normalizedDate);
            const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${espnDate}&limit=200`;
            const payload = await this.fetchJsonWithTimeout(url, 15000);
            return Array.isArray(payload?.events) ? payload.events : [];
        });
    },

    dedupeEvents(events = []) {
        const unique = new Map();
        events.forEach((event) => {
            const id = toText(event?.id);
            if (id) {
                unique.set(id, event);
            }
        });
        return Array.from(unique.values());
    },

    async buildScoreboardPayload(events, dateHint) {
        const standingsSeason = this.inferSeasonFromDate(dateHint);
        let standingsByTeamId = {};

        if (Number.isFinite(standingsSeason) && standingsSeason > 0) {
            try {
                standingsByTeamId = await this.fetchStandingsForSeason(standingsSeason);
            } catch (error) {
                console.warn(`Unable to load NHL standings for ${standingsSeason}:`, error);
            }
        }

        return {
            ...this.buildScoreboardResultSets(events),
            standingsSeason: standingsSeason || null,
            standingsByTeamId
        };
    },

    async fetchScoreboard(date) {
        const normalizedDate = toIsoDateFromValue(date) || toText(date);
        const events = await this.fetchScoreboardEventsForDate(normalizedDate);
        return this.buildScoreboardPayload(events, normalizedDate);
    },

    normalizeTeamIds(teamIds) {
        if (!Array.isArray(teamIds) || teamIds.length === 0) {
            return [];
        }

        return Array.from(new Set(
            teamIds
                .map((value) => Number.parseInt(value, 10))
                .filter((value) => Number.isFinite(value) && value > 0)
        ));
    },

    async fetchGamesInRange(startDate, endDate, filterOptions = {}) {
        const normalizedStartDate = toIsoDateFromValue(startDate) || toText(startDate);
        const normalizedEndDate = toIsoDateFromValue(endDate) || toText(endDate);

        if (!normalizedStartDate || !normalizedEndDate) {
            throw new APIError('Invalid NHL date range request.', 400, 'scoreboard-range');
        }

        const start = normalizedStartDate <= normalizedEndDate ? normalizedStartDate : normalizedEndDate;
        const end = normalizedStartDate <= normalizedEndDate ? normalizedEndDate : normalizedStartDate;
        const teamIds = this.normalizeTeamIds(filterOptions?.teamIds);

        const cacheKey = Utils.createCacheKey('espn-nhl-scoreboard-range', {
            startDate: start,
            endDate: end,
            teamIds
        });

        return this.cache.getOrFetch(cacheKey, async () => {
            const events = [];
            const dayCursor = new Date(`${start}T00:00:00Z`);
            const endCursor = new Date(`${end}T00:00:00Z`);

            while (dayCursor <= endCursor) {
                const dayIso = dayCursor.toISOString().split('T')[0];
                const dayEvents = await this.fetchScoreboardEventsForDate(dayIso);
                events.push(...dayEvents);
                dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
            }

            let dedupedEvents = this.dedupeEvents(events);
            if (teamIds.length > 0) {
                dedupedEvents = dedupedEvents.filter((event) => {
                    const competition = getEventCompetition(event) || {};
                    const { away, home } = getCompetitors(competition);
                    const awayId = toInteger(away?.team?.id, 0);
                    const homeId = toInteger(home?.team?.id, 0);
                    return teamIds.includes(awayId) || teamIds.includes(homeId);
                });
            }

            return this.buildScoreboardPayload(dedupedEvents, end);
        });
    }
};
