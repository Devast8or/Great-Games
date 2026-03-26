/**
 * API handling for NBA game data via ESPN public endpoints.
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
    'PTS_OT10'
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
    return toText(summary, '0-0');
}

function toEspnSeasonCode(event = {}) {
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

    getLocalIsoDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    inferSeasonFromDate(dateValue) {
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        const month = parsed.getUTCMonth() + 1;
        const year = parsed.getUTCFullYear();
        return month >= 7 ? year : year - 1;
    },

    parseNullableScore(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    },

    resolveNbaTeamId(team = {}) {
        const fromAbbreviation = Utils.getTeamIdByAbbreviation(toText(team?.abbreviation));
        if (fromAbbreviation) {
            return fromAbbreviation;
        }

        const normalizedCandidates = [
            toText(team?.full_name),
            toText(team?.displayName),
            toText(`${toText(team?.city || team?.location)} ${toText(team?.name)}`.trim()),
            toText(team?.name)
        ]
            .map((value) => value.toLowerCase())
            .filter(Boolean);

        if (normalizedCandidates.length > 0) {
            const matchedTeam = Utils.getAllTeams().find((knownTeam) => (
                normalizedCandidates.includes(String(knownTeam?.name || '').trim().toLowerCase())
            ));

            if (matchedTeam?.id) {
                return matchedTeam.id;
            }
        }

        return toInteger(team?.id, 0);
    },

    async fetchPublicJsonWithTimeout(url, timeoutMs = this.DEFAULT_REQUEST_TIMEOUT_MS) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json'
                },
                signal: controller.signal
            });

            if (!response.ok) {
                throw new APIError(`ESPN NBA request failed (${response.status})`, response.status || 0, url);
            }

            return await response.json();
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new APIError(`ESPN NBA request timed out after ${Math.round(timeoutMs / 1000)}s`, 408, url);
            }

            if (error instanceof APIError) {
                throw error;
            }

            throw new APIError('Network error while requesting ESPN NBA endpoint.', 0, url);
        } finally {
            clearTimeout(timeoutId);
        }
    },

    getEspnStatValue(stats = [], candidateTypes = [], fallback = null) {
        if (!Array.isArray(stats) || stats.length === 0) {
            return fallback;
        }

        const normalizedCandidates = candidateTypes.map((candidate) => String(candidate || '').trim().toLowerCase());
        const matchedStat = stats.find((stat) => {
            const statKeys = [
                stat?.type,
                stat?.name,
                stat?.abbreviation,
                stat?.shortDisplayName
            ].map((value) => String(value || '').trim().toLowerCase());

            return normalizedCandidates.some((candidate) => statKeys.includes(candidate));
        });

        if (!matchedStat) {
            return fallback;
        }

        return matchedStat.displayValue ?? matchedStat.value ?? fallback;
    },

    mapEspnStandingsByTeam(payload) {
        const conferences = Array.isArray(payload?.children) ? payload.children : [];

        return conferences.reduce((mapped, conferenceEntry) => {
            const conferenceName = toText(conferenceEntry?.name);
            const standings = Array.isArray(conferenceEntry?.standings?.entries)
                ? conferenceEntry.standings.entries
                : [];
            const season = toInteger(conferenceEntry?.standings?.season || payload?.season?.year, 0);

            standings.forEach((entry) => {
                const team = entry?.team || {};
                const teamId = this.resolveNbaTeamId(team);
                if (!teamId) {
                    return;
                }

                const canonicalTeam = Utils.getTeamInfo(teamId, {
                    abbreviation: toText(team?.abbreviation),
                    name: toText(team?.displayName, toText(team?.name)),
                    city: toText(team?.location)
                });
                const stats = Array.isArray(entry?.stats) ? entry.stats : [];
                const wins = toInteger(this.getEspnStatValue(stats, ['wins', 'w'], 0), 0);
                const losses = toInteger(this.getEspnStatValue(stats, ['losses', 'l'], 0), 0);
                const conferenceRank = toInteger(this.getEspnStatValue(stats, ['playoffseed', 'pos', 'seed'], 0), 0);
                const rawWinPct = this.getEspnStatValue(stats, ['winpercent', 'pct'], '');
                const parsedWinPct = Number.parseFloat(rawWinPct);
                const points = Number.parseFloat(this.getEspnStatValue(stats, ['pointsfor', 'pf'], ''));

                mapped[String(teamId)] = {
                    teamId,
                    teamName: toText(team?.displayName, canonicalTeam.name),
                    abbreviation: canonicalTeam.abbreviation,
                    city: toText(team?.location, canonicalTeam.city),
                    conference: conferenceName,
                    division: '',
                    divisionRank: null,
                    conferenceRank: conferenceRank > 0 ? conferenceRank : null,
                    wins,
                    losses,
                    winPct: Number.isFinite(parsedWinPct) ? parsedWinPct : null,
                    gamesBehind: toText(this.getEspnStatValue(stats, ['gamesbehind', 'gb'], '-'), '-'),
                    points: Number.isFinite(points) ? points : null,
                    season
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

        const cacheKey = Utils.createCacheKey('espn-nba-standings', {
            season: normalizedSeason
        });

        return this.cache.getOrFetch(cacheKey, async () => {
            const url = new URL('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings');
            url.searchParams.set('season', String(normalizedSeason));
            const payload = await this.fetchPublicJsonWithTimeout(url.toString(), 12000);
            return this.mapEspnStandingsByTeam(payload);
        });
    },

    toEspnStatusInfo(event = {}) {
        const competition = getEventCompetition(event) || {};
        const status = competition?.status || event?.status || {};
        const statusType = status?.type || {};
        const rawText = toText(statusType?.shortDetail || statusType?.description || statusType?.name || status?.displayClock);
        const normalized = rawText.toLowerCase();

        if (statusType?.completed || normalized.includes('final')) {
            return { id: 3, text: 'Final' };
        }

        if (statusType?.state === 'in' || /qtr|quarter|ot|halftime|half|live|in progress/.test(normalized)) {
            return { id: 2, text: rawText || 'In Progress' };
        }

        return { id: 1, text: rawText || 'Scheduled' };
    },

    estimateLeadChangesAndTiesFromPeriods(homeByPeriod = [], awayByPeriod = []) {
        let homeTotal = 0;
        let awayTotal = 0;
        let currentLeader = null;
        let leadChanges = 0;
        let timesTied = 0;

        for (let index = 0; index < homeByPeriod.length; index += 1) {
            const homeValue = homeByPeriod[index];
            const awayValue = awayByPeriod[index];

            if (homeValue === null && awayValue === null) {
                continue;
            }

            homeTotal += homeValue ?? 0;
            awayTotal += awayValue ?? 0;

            if (homeTotal === awayTotal) {
                timesTied += 1;
                continue;
            }

            const leader = homeTotal > awayTotal ? 'home' : 'away';
            if (currentLeader && leader !== currentLeader) {
                leadChanges += 1;
            }

            currentLeader = leader;
        }

        return {
            leadChanges,
            timesTied
        };
    },

    estimateLeadChangesAndTiesFromEspnCompetitors(awayCompetitor = {}, homeCompetitor = {}) {
        const awayLineScores = Array.isArray(awayCompetitor?.linescores) ? awayCompetitor.linescores : [];
        const homeLineScores = Array.isArray(homeCompetitor?.linescores) ? homeCompetitor.linescores : [];
        const maxPeriods = Math.max(awayLineScores.length, homeLineScores.length, 4);
        const awayByPeriod = [];
        const homeByPeriod = [];

        for (let index = 0; index < maxPeriods; index += 1) {
            awayByPeriod.push(this.parseNullableScore(awayLineScores[index]?.value));
            homeByPeriod.push(this.parseNullableScore(homeLineScores[index]?.value));
        }

        return this.estimateLeadChangesAndTiesFromPeriods(homeByPeriod, awayByPeriod);
    },

    mapEspnLineScoreRow(gameId, competitor = {}, teamInfo = {}) {
        const linescores = Array.isArray(competitor?.linescores) ? competitor.linescores : [];
        const quarterValues = [0, 1, 2, 3].map((index) => toInteger(linescores[index]?.value, 0));
        const overtimeValues = new Array(10).fill(null);

        if (linescores.length > 4) {
            linescores.slice(4, 14).forEach((entry, index) => {
                overtimeValues[index] = toInteger(entry?.value, 0);
            });
        }

        return [
            gameId,
            teamInfo.id,
            teamInfo.abbreviation,
            teamInfo.name,
            teamInfo.city,
            '',
            getRecordSummary(competitor),
            toInteger(competitor?.score, 0),
            quarterValues[0],
            quarterValues[1],
            quarterValues[2],
            quarterValues[3],
            ...overtimeValues
        ];
    },

    buildScoreboardResultSets(events = [], requestedDate = '') {
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

            const awayId = this.resolveNbaTeamId(awayTeam);
            const homeId = this.resolveNbaTeamId(homeTeam);
            const awayInfo = Utils.getTeamInfo(awayId, {
                abbreviation: toText(awayTeam?.abbreviation),
                name: toText(awayTeam?.displayName || awayTeam?.name, 'Away Team'),
                city: toText(awayTeam?.location)
            });
            const homeInfo = Utils.getTeamInfo(homeId, {
                abbreviation: toText(homeTeam?.abbreviation),
                name: toText(homeTeam?.displayName || homeTeam?.name, 'Home Team'),
                city: toText(homeTeam?.location)
            });

            const statusInfo = this.toEspnStatusInfo(event);
            const gameDateValue = toText(event?.date, requestedDate);
            const momentumEstimate = this.estimateLeadChangesAndTiesFromEspnCompetitors(away, home);

            gameHeaderRows.push([
                gameId,
                statusInfo.id,
                statusInfo.text,
                statusInfo.text,
                gameDateValue,
                gameDateValue,
                awayInfo.id,
                homeInfo.id,
                toEspnSeasonCode(event),
                momentumEstimate.leadChanges,
                momentumEstimate.timesTied
            ]);

            lineScoreRows.push(this.mapEspnLineScoreRow(gameId, away, awayInfo));
            lineScoreRows.push(this.mapEspnLineScoreRow(gameId, home, homeInfo));

            const venue = competition?.venue || {};
            const arenaName = toText(venue?.fullName || venue?.name, `${toText(homeInfo.city, 'NBA')} Home Court`);
            gameInfoRows.push([gameId, arenaName, arenaName]);
        });

        return {
            source: 'espn',
            provider: 'espn',
            resultSets: [
                {
                    name: 'GameHeader',
                    headers: GAME_HEADER_HEADERS,
                    rowSet: gameHeaderRows
                },
                {
                    name: 'LineScore',
                    headers: LINE_SCORE_HEADERS,
                    rowSet: lineScoreRows
                },
                {
                    name: 'GameInfo',
                    headers: GAME_INFO_HEADERS,
                    rowSet: gameInfoRows
                }
            ]
        };
    },

    getResultSet(data, resultSetName) {
        const normalizedName = String(resultSetName || '').toLowerCase();
        const resultSets = Array.isArray(data?.resultSets)
            ? data.resultSets
            : data?.resultSet
                ? [data.resultSet]
                : [];

        if (!normalizedName || resultSets.length === 0) {
            return null;
        }

        const exactMatch = resultSets.find((set) => (
            String(set?.name || '').toLowerCase() === normalizedName
        ));

        if (exactMatch) {
            return exactMatch;
        }

        return resultSets.find((set) => (
            String(set?.name || '').toLowerCase().includes(normalizedName)
        )) || null;
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
        const set = this.getResultSet(data, resultSetName);
        return this.mapResultSetRows(set);
    },

    normalizeTeamIds(teamIds) {
        if (!Array.isArray(teamIds) || teamIds.length === 0) {
            return [];
        }

        return Array.from(new Set(
            teamIds
                .map((value) => Number.parseInt(value, 10))
                .filter((value) => Number.isFinite(value) && value > 0)
        )).sort((a, b) => a - b);
    },

    dedupeGamesById(games = []) {
        const uniqueById = new Map();

        games.forEach((game) => {
            const gameId = toText(game?.id);
            if (!gameId) {
                return;
            }

            uniqueById.set(gameId, game);
        });

        return Array.from(uniqueById.values());
    },

    async fetchScoreboardEventsForDate(date) {
        const normalizedDate = toIsoDateFromValue(date) || toText(date);
        if (!normalizedDate) {
            throw new APIError('Invalid NBA date request.', 400, 'espn-scoreboard');
        }

        const cacheKey = Utils.createCacheKey('espn-nba-scoreboard-day', { date: normalizedDate });
        return this.cache.getOrFetch(cacheKey, async () => {
            const espnDate = toEspnDate(normalizedDate);
            const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDate}&limit=200`;
            const payload = await this.fetchPublicJsonWithTimeout(url, 15000);
            return Array.isArray(payload?.events) ? payload.events : [];
        });
    },

    filterEventsByTeamIds(events = [], teamIds = []) {
        if (!Array.isArray(teamIds) || teamIds.length === 0) {
            return events;
        }

        const wanted = new Set(teamIds.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isFinite(value) && value > 0));

        return events.filter((event) => {
            const competition = getEventCompetition(event) || {};
            const { away, home } = getCompetitors(competition);
            const awayId = this.resolveNbaTeamId(away?.team || {});
            const homeId = this.resolveNbaTeamId(home?.team || {});
            return wanted.has(awayId) || wanted.has(homeId);
        });
    },

    async fetchEventsInRange(startDate, endDate, filterOptions = {}) {
        const normalizedTeamIds = this.normalizeTeamIds(filterOptions?.teamIds);
        const events = [];
        const dayCursor = new Date(`${startDate}T00:00:00Z`);
        const endCursor = new Date(`${endDate}T00:00:00Z`);

        while (dayCursor <= endCursor) {
            const dayIso = dayCursor.toISOString().split('T')[0];
            const dayEvents = await this.fetchScoreboardEventsForDate(dayIso);
            events.push(...dayEvents);
            dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
        }

        const deduped = this.dedupeGamesById(events);
        return this.filterEventsByTeamIds(deduped, normalizedTeamIds);
    },

    async buildScoreboardPayload(events, dateHint = '') {
        const standingsSeason = this.inferSeasonFromDate(dateHint);

        let standingsByTeamId = {};
        if (Number.isFinite(standingsSeason) && standingsSeason > 0) {
            try {
                standingsByTeamId = await this.fetchStandingsForSeason(standingsSeason);
            } catch (error) {
                console.warn(`Unable to resolve NBA standings for ${standingsSeason}:`, error);
            }
        }

        return {
            ...this.buildScoreboardResultSets(events, dateHint),
            standingsSeason: standingsSeason || null,
            standingsByTeamId
        };
    },

    async fetchScoreboard(date) {
        const normalizedDate = toIsoDateFromValue(date) || toText(date, this.getLocalIsoDate());
        const cacheKey = Utils.createCacheKey('espn-nba-games', {
            date: normalizedDate
        });

        return this.cache.getOrFetch(cacheKey, async () => {
            const events = await this.fetchScoreboardEventsForDate(normalizedDate);
            return this.buildScoreboardPayload(events, normalizedDate);
        });
    },

    async fetchGamesInRange(startDate, endDate, filterOptions = {}) {
        const normalizedStartDate = toIsoDateFromValue(startDate) || toText(startDate);
        const normalizedEndDate = toIsoDateFromValue(endDate) || toText(endDate);

        if (!normalizedStartDate || !normalizedEndDate) {
            throw new APIError('Invalid NBA date range request.', 400, 'espn-scoreboard-range');
        }

        const rangeStart = normalizedStartDate <= normalizedEndDate
            ? normalizedStartDate
            : normalizedEndDate;
        const rangeEnd = normalizedStartDate <= normalizedEndDate
            ? normalizedEndDate
            : normalizedStartDate;
        const normalizedTeamIds = this.normalizeTeamIds(filterOptions?.teamIds);

        const cacheKey = Utils.createCacheKey('espn-nba-games-range', {
            startDate: rangeStart,
            endDate: rangeEnd,
            teamIds: normalizedTeamIds
        });

        return this.cache.getOrFetch(cacheKey, async () => {
            const events = await this.fetchEventsInRange(rangeStart, rangeEnd, {
                teamIds: normalizedTeamIds
            });

            return this.buildScoreboardPayload(events, rangeEnd);
        });
    },

    async fetchGameEnhancements(gameId) {
        const normalizedGameId = toText(gameId);
        if (!normalizedGameId) {
            throw new APIError('Missing game id for NBA enhancement request.', 400, 'enhancements');
        }

        return {
            playByPlayRows: [],
            playerRows: [],
            advancedTeamRows: []
        };
    }
};
