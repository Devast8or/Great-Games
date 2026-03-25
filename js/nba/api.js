/**
 * API handling for NBA game data via BALLDONTLIE.
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

function toNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
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

function toRecordText(wins, losses) {
    const normalizedWins = toInteger(wins, 0);
    const normalizedLosses = toInteger(losses, 0);
    return `${normalizedWins}-${normalizedLosses}`;
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
    BALLDONTLIE_BASE_URL: 'https://api.balldontlie.io',
    BALLDONTLIE_API_KEY: '00d0bb2b-4982-447e-a0db-27f7fbbc7dc5',
    BALLDONTLIE_API_KEY_STORAGE_KEY: 'great-games-nba-bdl-api-key',
    BALLDONTLIE_BASE_URL_STORAGE_KEY: 'great-games-nba-bdl-base-url',
    BALLDONTLIE_ENHANCEMENTS_STORAGE_KEY: 'great-games-nba-bdl-enhancements-enabled',
    DEFAULT_REQUEST_TIMEOUT_MS: 15000,
    DEFAULT_PER_PAGE: 100,
    cache: new APICache(),
    enhancementsUnsupported: false,
    standingsAccessDenied: false,
    standingsAccessDeniedLogged: false,

    normalizeBaseUrl(url) {
        return String(url || '').trim().replace(/\/+$/, '');
    },

    normalizeApiKey(value) {
        return String(value || '').trim();
    },

    parseBoolean(value, fallback = false) {
        if (typeof value === 'boolean') {
            return value;
        }

        if (value === null || value === undefined) {
            return fallback;
        }

        const normalized = String(value).trim().toLowerCase();
        if (['1', 'true', 'yes', 'on', 'y'].includes(normalized)) {
            return true;
        }

        if (['0', 'false', 'no', 'off', 'n'].includes(normalized)) {
            return false;
        }

        return fallback;
    },

    getBallDontLieBaseUrl() {
        if (typeof window === 'undefined' || typeof window.document === 'undefined') {
            return this.normalizeBaseUrl(this.BALLDONTLIE_BASE_URL);
        }

        const queryParams = new URLSearchParams(window.location.search);
        const fromQuery = this.normalizeBaseUrl(
            queryParams.get('nbaBdlBaseUrl')
            || queryParams.get('nbaApiBaseUrl')
            || queryParams.get('nbaApiSportsBaseUrl')
        );
        if (fromQuery) {
            return fromQuery;
        }

        const fromGlobal = this.normalizeBaseUrl(window.__GREAT_GAMES_NBA_BDL_BASE_URL__);
        if (fromGlobal) {
            return fromGlobal;
        }

        let fromStorage = '';
        try {
            fromStorage = this.normalizeBaseUrl(window.localStorage?.getItem(this.BALLDONTLIE_BASE_URL_STORAGE_KEY));
        } catch (_error) {
            fromStorage = '';
        }

        return fromStorage || this.normalizeBaseUrl(this.BALLDONTLIE_BASE_URL);
    },

    getBallDontLieApiKey() {
        if (typeof window === 'undefined' || typeof window.document === 'undefined') {
            return this.normalizeApiKey(this.BALLDONTLIE_API_KEY);
        }

        const queryParams = new URLSearchParams(window.location.search);
        const fromQuery = this.normalizeApiKey(
            queryParams.get('nbaBdlApiKey')
            || queryParams.get('nbaApiKey')
        );
        if (fromQuery) {
            return fromQuery;
        }

        const fromGlobal = this.normalizeApiKey(window.__GREAT_GAMES_NBA_BDL_API_KEY__);
        if (fromGlobal) {
            return fromGlobal;
        }

        let fromStorage = '';
        try {
            fromStorage = this.normalizeApiKey(window.localStorage?.getItem(this.BALLDONTLIE_API_KEY_STORAGE_KEY));
        } catch (_error) {
            fromStorage = '';
        }

        return fromStorage || this.normalizeApiKey(this.BALLDONTLIE_API_KEY);
    },

    isEnhancementsEnabled() {
        if (typeof window === 'undefined' || typeof window.document === 'undefined') {
            return false;
        }

        const queryParams = new URLSearchParams(window.location.search);
        const fromQuery = queryParams.get('nbaBdlEnhancements');
        if (fromQuery !== null) {
            return this.parseBoolean(fromQuery, false);
        }

        if (typeof window.__GREAT_GAMES_NBA_BDL_ENHANCEMENTS_ENABLED__ !== 'undefined') {
            return this.parseBoolean(window.__GREAT_GAMES_NBA_BDL_ENHANCEMENTS_ENABLED__, false);
        }

        try {
            const fromStorage = window.localStorage?.getItem(this.BALLDONTLIE_ENHANCEMENTS_STORAGE_KEY);
            if (fromStorage !== null) {
                return this.parseBoolean(fromStorage, false);
            }
        } catch (_error) {
            return false;
        }

        return false;
    },

    buildBallDontLieQueryString(params = {}) {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((entry) => {
                    if (entry === null || entry === undefined || entry === '') {
                        return;
                    }

                    searchParams.append(key, String(entry));
                });
                return;
            }

            if (value === null || value === undefined || value === '') {
                return;
            }

            searchParams.append(key, String(value));
        });

        return searchParams.toString();
    },

    buildBallDontLieUrl(endpoint, params = {}) {
        const normalizedEndpoint = String(endpoint || '').replace(/^\/+/, '');
        const queryString = this.buildBallDontLieQueryString(params);
        const baseUrl = this.getBallDontLieBaseUrl();
        return `${baseUrl}/${normalizedEndpoint}${queryString ? `?${queryString}` : ''}`;
    },

    getLocalIsoDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    getRequestTimeoutMs(requestOptions = {}) {
        return Number.isFinite(Number(requestOptions?.timeoutMs))
            ? Math.max(1000, Number(requestOptions.timeoutMs))
            : this.DEFAULT_REQUEST_TIMEOUT_MS;
    },

    async fetchJsonWithTimeout(url, timeoutMs) {
        const apiKey = this.getBallDontLieApiKey();
        if (!apiKey) {
            throw new APIError('Missing BALLDONTLIE API key for NBA requests.', 401, url);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeoutMs);

        let response;

        try {
            response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: apiKey
                },
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        let payload = null;
        try {
            payload = await response.json();
        } catch (_error) {
            payload = null;
        }

        if (!response.ok) {
            const detail = toText(payload?.error || payload?.message || response.statusText);
            throw new APIError(
                detail || `BALLDONTLIE request failed (${response.status})`,
                response.status || 0,
                url
            );
        }

        return payload;
    },

    normalizeRequestError(error, endpoint, timeoutMs) {
        if (error instanceof APIError) {
            return error;
        }

        if (error?.name === 'AbortError') {
            return new APIError(
                `BALLDONTLIE request timed out after ${Math.round(timeoutMs / 1000)}s`,
                408,
                endpoint
            );
        }

        return new APIError('Network error while requesting BALLDONTLIE NBA endpoint.', 0, endpoint);
    },

    isRetryableError(error) {
        if (!error) {
            return false;
        }

        if (error?.name === 'AbortError') {
            return true;
        }

        const status = Number(error?.status);
        if (!Number.isFinite(status)) {
            return false;
        }

        return status === 0 || status === 408 || status === 429 || status >= 500;
    },

    sleep(milliseconds) {
        return new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    },

    async requestWithRetry(requestFn, options = {}) {
        const attempts = Math.max(1, Number.parseInt(options?.attempts, 10) || 1);
        const baseDelayMs = Math.max(0, Number.parseInt(options?.delayMs, 10) || 0);

        let lastError = null;

        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                return await requestFn();
            } catch (error) {
                lastError = error;

                const shouldRetry = attempt < attempts && this.isRetryableError(error);
                if (!shouldRetry) {
                    throw error;
                }

                const waitMs = baseDelayMs * attempt;
                if (waitMs > 0) {
                    await this.sleep(waitMs);
                }
            }
        }

        throw lastError || new APIError('BALLDONTLIE request failed.', 0, 'unknown');
    },

    async ballDontLieRequest(endpoint, params = {}, requestOptions = {}) {
        const timeoutMs = this.getRequestTimeoutMs(requestOptions);
        const url = this.buildBallDontLieUrl(endpoint, params);

        try {
            return await this.requestWithRetry(
                () => this.fetchJsonWithTimeout(url, timeoutMs),
                {
                    attempts: 2,
                    delayMs: 300
                }
            );
        } catch (error) {
            throw this.normalizeRequestError(error, endpoint, timeoutMs);
        }
    },

    extractBallDontLieData(payload) {
        return Array.isArray(payload?.data) ? payload.data : [];
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

    toSeasonCode(game = {}) {
        return Boolean(game?.postseason) ? '4' : '2';
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

    mapBallDontLieStandingsByTeam(standingsPayload) {
        const rows = this.extractBallDontLieData(standingsPayload);

        return rows.reduce((mapped, row) => {
            const team = row?.team || {};
            const teamId = this.resolveNbaTeamId(team);

            if (!teamId) {
                return mapped;
            }

            const divisionRank = toInteger(row?.division_rank, 0);
            const conferenceRank = toInteger(row?.conference_rank, 0);

            const wins = toInteger(row?.wins ?? row?.won, 0);
            const losses = toInteger(row?.losses ?? row?.lost, 0);
            const totalGames = wins + losses;
            const rawWinPct = Number.parseFloat(row?.win_pct ?? row?.win_percentage ?? row?.winPct);
            const winPct = Number.isFinite(rawWinPct)
                ? rawWinPct
                : (totalGames > 0 ? wins / totalGames : null);

            mapped[String(teamId)] = {
                teamId,
                teamName: toText(team?.full_name, toText(`${toText(team?.city)} ${toText(team?.name)}`.trim(), toText(team?.name, `Team ${teamId}`))),
                abbreviation: toText(team?.abbreviation),
                city: toText(team?.city),
                conference: toText(team?.conference, toText(row?.conference)),
                division: toText(team?.division, toText(row?.division)),
                divisionRank: divisionRank > 0 ? divisionRank : null,
                conferenceRank: conferenceRank > 0 ? conferenceRank : null,
                wins,
                losses,
                winPct,
                gamesBehind: toText(row?.games_behind, toText(row?.gb, toText(row?.conference_games_behind))),
                points: toNumber(row?.points_for ?? row?.pointsFor ?? row?.pts_for ?? row?.ptsFor, NaN),
                season: toInteger(row?.season, 0)
            };

            return mapped;
        }, {});
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

    async fetchEspnStandingsForSeason(season) {
        const normalizedSeason = toInteger(season, 0);
        if (normalizedSeason <= 0) {
            return {};
        }

        const url = new URL('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings');
        url.searchParams.set('season', String(normalizedSeason));

        const response = await fetch(url.toString(), {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            throw new APIError(`ESPN standings request failed (${response.status})`, response.status || 0, url.toString());
        }

        const payload = await response.json();
        return this.mapEspnStandingsByTeam(payload);
    },

    async fetchStandingsForSeason(season) {
        const normalizedSeason = toInteger(season, 0);
        if (normalizedSeason <= 0) {
            return {};
        }

        const cacheKey = Utils.createCacheKey('balldontlie-nba-standings', {
            season: normalizedSeason
        });

        return this.cache.getOrFetch(cacheKey, async () => {
            const loadEspnFallback = async (triggerError = null) => {
                try {
                    return await this.fetchEspnStandingsForSeason(normalizedSeason);
                } catch (espnError) {
                    console.warn(`Unable to load ESPN NBA standings for season ${normalizedSeason}:`, espnError);

                    if (triggerError) {
                        console.warn(`Unable to load NBA standings for season ${normalizedSeason}:`, triggerError);
                    }

                    return {};
                }
            };

            if (this.standingsAccessDenied) {
                return loadEspnFallback();
            }

            try {
                const payload = await this.ballDontLieRequest('v1/standings', {
                    season: normalizedSeason
                }, {
                    timeoutMs: 10000
                });

                return this.mapBallDontLieStandingsByTeam(payload);
            } catch (error) {
                const status = Number(error?.status);

                if (status === 401 || status === 403) {
                    this.standingsAccessDenied = true;

                    if (!this.standingsAccessDeniedLogged) {
                        console.info('NBA standings endpoint is not available for the current API key/tier. Falling back to ESPN standings.');
                        this.standingsAccessDeniedLogged = true;
                    }

                    return loadEspnFallback(error);
                }

                if (status === 404) {
                    try {
                        const fallbackPayload = await this.ballDontLieRequest('nba/v1/standings', {
                            season: normalizedSeason
                        }, {
                            timeoutMs: 10000
                        });

                        return this.mapBallDontLieStandingsByTeam(fallbackPayload);
                    } catch (fallbackError) {
                        const fallbackStatus = Number(fallbackError?.status);

                        if (fallbackStatus === 401 || fallbackStatus === 403) {
                            this.standingsAccessDenied = true;

                            if (!this.standingsAccessDeniedLogged) {
                                console.info('NBA standings endpoint is not available for the current API key/tier. Falling back to ESPN standings.');
                                this.standingsAccessDeniedLogged = true;
                            }

                            return loadEspnFallback(fallbackError);
                        }

                        return loadEspnFallback(fallbackError);
                    }
                }

                return loadEspnFallback(error);
            }
        });
    },

    toStatusInfo(game = {}) {
        const statusText = toText(game?.status || game?.time || '');
        const normalized = statusText.toLowerCase();
        const period = toInteger(game?.period, 0);

        if (/\bfinal\b|\bfinished\b/.test(normalized)) {
            return { id: 3, text: 'Final' };
        }

        if (Boolean(game?.postponed) || /postponed/.test(normalized)) {
            return { id: 1, text: 'Postponed' };
        }

        if (period > 0 || /qtr|quarter|ot|halftime|half|live|in progress/.test(normalized)) {
            const liveText = statusText || (period > 4 ? `OT${period - 4}` : `Q${period}`);
            return { id: 2, text: liveText };
        }

        return { id: 1, text: statusText || 'Scheduled' };
    },

    parseNullableScore(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    },

    estimateLeadChangesAndTies(game = {}) {
        const homeByPeriod = [
            game?.home_q1,
            game?.home_q2,
            game?.home_q3,
            game?.home_q4,
            game?.home_ot1,
            game?.home_ot2,
            game?.home_ot3
        ].map((value) => this.parseNullableScore(value));

        const awayByPeriod = [
            game?.visitor_q1,
            game?.visitor_q2,
            game?.visitor_q3,
            game?.visitor_q4,
            game?.visitor_ot1,
            game?.visitor_ot2,
            game?.visitor_ot3
        ].map((value) => this.parseNullableScore(value));

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

    mapLineScoreRow(gameId, game, side, teamInfo) {
        const prefix = side === 'home' ? 'home' : 'visitor';
        const points = toInteger(game?.[`${prefix}_team_score`] ?? game?.[`${prefix}_score`], 0);
        const teamDivision = toText(game?.[`${prefix}_team`]?.division);

        const quarterValues = [
            this.parseNullableScore(game?.[`${prefix}_q1`]),
            this.parseNullableScore(game?.[`${prefix}_q2`]),
            this.parseNullableScore(game?.[`${prefix}_q3`]),
            this.parseNullableScore(game?.[`${prefix}_q4`])
        ].map((value) => value ?? 0);

        const overtimeValues = [
            this.parseNullableScore(game?.[`${prefix}_ot1`]),
            this.parseNullableScore(game?.[`${prefix}_ot2`]),
            this.parseNullableScore(game?.[`${prefix}_ot3`]),
            null,
            null,
            null,
            null,
            null,
            null,
            null
        ];

        return [
            gameId,
            teamInfo.id,
            teamInfo.abbreviation,
            teamInfo.name,
            teamInfo.city,
            teamDivision,
            toRecordText(0, 0),
            points,
            quarterValues[0],
            quarterValues[1],
            quarterValues[2],
            quarterValues[3],
            ...overtimeValues
        ];
    },

    buildScoreboardResultSets(games, requestedDate) {
        const gameHeaderRows = [];
        const lineScoreRows = [];
        const gameInfoRows = [];

        games.forEach((game) => {
            const gameId = toText(game?.id);
            if (!gameId) {
                return;
            }

            const visitors = game?.visitor_team || {};
            const home = game?.home_team || {};

            const visitorId = this.resolveNbaTeamId(visitors);
            const homeId = this.resolveNbaTeamId(home);

            const visitorInfo = Utils.getTeamInfo(visitorId, {
                abbreviation: toText(visitors?.abbreviation),
                name: toText(visitors?.name, 'Away Team'),
                city: toText(visitors?.city)
            });
            const homeInfo = Utils.getTeamInfo(homeId, {
                abbreviation: toText(home?.abbreviation),
                name: toText(home?.name, 'Home Team'),
                city: toText(home?.city)
            });

            const statusInfo = this.toStatusInfo(game);
            const gameDateValue = toText(game?.datetime || game?.date, requestedDate);
            const momentumEstimate = this.estimateLeadChangesAndTies(game);

            gameHeaderRows.push([
                gameId,
                statusInfo.id,
                statusInfo.text,
                statusInfo.text,
                gameDateValue,
                gameDateValue,
                visitorInfo.id,
                homeInfo.id,
                this.toSeasonCode(game),
                momentumEstimate.leadChanges,
                momentumEstimate.timesTied
            ]);

            lineScoreRows.push(this.mapLineScoreRow(gameId, game, 'visitor', visitorInfo));
            lineScoreRows.push(this.mapLineScoreRow(gameId, game, 'home', homeInfo));

            const arenaName = toText(game?.arena?.name, `${toText(homeInfo.city, 'NBA')} Home Court`);
            gameInfoRows.push([gameId, arenaName, arenaName]);
        });

        return {
            source: 'balldontlie',
            provider: 'balldontlie',
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

    mapBallDontLieStatsToPlayerRows(statsPayload) {
        const rows = this.extractBallDontLieData(statsPayload);

        return rows
            .map((stat) => {
                const player = stat?.player || {};
                const firstName = toText(player?.first_name);
                const lastName = toText(player?.last_name);
                const fullName = toText(`${firstName} ${lastName}`.trim(), 'Unknown Player');

                return {
                    TEAM_ID: this.resolveNbaTeamId(stat?.team || {}),
                    PLAYER_NAME: fullName,
                    PTS: toNumber(stat?.pts, 0),
                    REB: toNumber(stat?.reb, 0),
                    AST: toNumber(stat?.ast, 0),
                    STL: toNumber(stat?.stl, 0),
                    BLK: toNumber(stat?.blk, 0),
                    TO: toNumber(stat?.turnover, 0),
                    FG3M: toNumber(stat?.fg3m, 0)
                };
            })
            .filter((row) => row.PLAYER_NAME);
    },

    mapBallDontLieAdvancedToTeamRows(advancedPayload) {
        const rows = this.extractBallDontLieData(advancedPayload);
        const teamBuckets = new Map();

        rows.forEach((row) => {
            const team = row?.team || {};
            const teamId = this.resolveNbaTeamId(team);
            const pace = Number(row?.pace);
            const offRating = Number(row?.offensive_rating);

            if (!teamId || (!Number.isFinite(pace) && !Number.isFinite(offRating))) {
                return;
            }

            if (!teamBuckets.has(teamId)) {
                teamBuckets.set(teamId, {
                    paceSum: 0,
                    paceCount: 0,
                    offRatingSum: 0,
                    offRatingCount: 0
                });
            }

            const bucket = teamBuckets.get(teamId);
            if (Number.isFinite(pace)) {
                bucket.paceSum += pace;
                bucket.paceCount += 1;
            }

            if (Number.isFinite(offRating)) {
                bucket.offRatingSum += offRating;
                bucket.offRatingCount += 1;
            }
        });

        return Array.from(teamBuckets.values())
            .map((bucket) => ({
                PACE: bucket.paceCount > 0 ? bucket.paceSum / bucket.paceCount : 0,
                OFF_RATING: bucket.offRatingCount > 0 ? bucket.offRatingSum / bucket.offRatingCount : 0
            }))
            .slice(0, 2);
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

    async fetchAllGames(requestParams = {}, requestOptions = {}) {
        const perPage = Math.max(1, Number.parseInt(requestOptions?.perPage, 10) || this.DEFAULT_PER_PAGE);
        const maxPages = Math.max(1, Number.parseInt(requestOptions?.maxPages, 10) || 12);
        const timeoutMs = Number.isFinite(Number(requestOptions?.timeoutMs))
            ? Number(requestOptions.timeoutMs)
            : 12000;

        const normalizedParams = {
            ...requestParams,
            per_page: perPage
        };

        const allGames = [];
        let nextCursor = null;

        for (let page = 1; page <= maxPages; page += 1) {
            const params = {
                ...normalizedParams
            };

            if (nextCursor) {
                params.cursor = nextCursor;
            }

            const payload = await this.ballDontLieRequest('nba/v1/games', params, {
                timeoutMs
            });
            const games = this.extractBallDontLieData(payload);

            if (games.length === 0) {
                break;
            }

            allGames.push(...games);

            nextCursor = toText(payload?.meta?.next_cursor);
            if (!nextCursor) {
                break;
            }
        }

        return this.dedupeGamesById(allGames);
    },

    async buildScoreboardPayload(games, dateHint = '') {
        const seasonFromGames = toInteger(games?.[0]?.season, 0);
        const inferredSeason = this.inferSeasonFromDate(dateHint);
        const standingsSeason = seasonFromGames > 0 ? seasonFromGames : inferredSeason;

        let standingsByTeamId = {};
        if (Number.isFinite(standingsSeason) && standingsSeason > 0) {
            try {
                standingsByTeamId = await this.fetchStandingsForSeason(standingsSeason);
            } catch (error) {
                console.warn(`Unable to resolve NBA standings for ${standingsSeason}:`, error);
            }
        }

        return {
            ...this.buildScoreboardResultSets(games, dateHint),
            standingsSeason: standingsSeason || null,
            standingsByTeamId
        };
    },

    async fetchScoreboard(date) {
        const normalizedDate = toIsoDateFromValue(date) || toText(date, this.getLocalIsoDate());
        const cacheKey = Utils.createCacheKey('balldontlie-nba-games', {
            date: normalizedDate
        });

        return this.cache.getOrFetch(cacheKey, async () => {
            const games = await this.fetchAllGames({
                'dates[]': normalizedDate,
                per_page: this.DEFAULT_PER_PAGE
            }, {
                timeoutMs: 12000,
                maxPages: 4
            });

            return this.buildScoreboardPayload(games, normalizedDate);
        });
    },

    async fetchGamesInRange(startDate, endDate, filterOptions = {}) {
        const normalizedStartDate = toIsoDateFromValue(startDate) || toText(startDate);
        const normalizedEndDate = toIsoDateFromValue(endDate) || toText(endDate);

        if (!normalizedStartDate || !normalizedEndDate) {
            throw new APIError('Invalid NBA date range request.', 400, 'nba/v1/games');
        }

        const rangeStart = normalizedStartDate <= normalizedEndDate
            ? normalizedStartDate
            : normalizedEndDate;
        const rangeEnd = normalizedStartDate <= normalizedEndDate
            ? normalizedEndDate
            : normalizedStartDate;
        const normalizedTeamIds = this.normalizeTeamIds(filterOptions?.teamIds);

        const cacheKey = Utils.createCacheKey('balldontlie-nba-games-range', {
            startDate: rangeStart,
            endDate: rangeEnd,
            teamIds: normalizedTeamIds
        });

        return this.cache.getOrFetch(cacheKey, async () => {
            const requestParams = {
                start_date: rangeStart,
                end_date: rangeEnd
            };

            if (normalizedTeamIds.length > 0) {
                requestParams['team_ids[]'] = normalizedTeamIds;
            }

            const games = await this.fetchAllGames(requestParams, {
                timeoutMs: 12000,
                maxPages: 20
            });

            return this.buildScoreboardPayload(games, rangeEnd);
        });
    },

    async fetchGameEnhancements(gameId) {
        const normalizedGameId = toText(gameId);
        if (!normalizedGameId) {
            throw new APIError('Missing game id for NBA enhancement request.', 400, 'enhancements');
        }

        if (!this.isEnhancementsEnabled() || this.enhancementsUnsupported) {
            return {
                playByPlayRows: [],
                playerRows: [],
                advancedTeamRows: []
            };
        }

        const cacheKey = Utils.createCacheKey('balldontlie-nba-enhancements', {
            gameId: normalizedGameId
        });

        return this.cache.getOrFetch(cacheKey, async () => {
            const [statsResult, advancedResult] = await Promise.allSettled([
                this.ballDontLieRequest('nba/v1/stats', {
                    'game_ids[]': normalizedGameId,
                    per_page: this.DEFAULT_PER_PAGE
                }, {
                    timeoutMs: 10000
                }),
                this.ballDontLieRequest('nba/v1/stats/advanced', {
                    'game_ids[]': normalizedGameId,
                    per_page: this.DEFAULT_PER_PAGE
                }, {
                    timeoutMs: 10000
                })
            ]);

            const rejected = [statsResult, advancedResult]
                .filter((result) => result.status === 'rejected')
                .map((result) => result.reason)
                .find((reason) => Number(reason?.status) === 401 || Number(reason?.status) === 403);

            if (rejected) {
                this.enhancementsUnsupported = true;
            }

            const statsPayload = statsResult.status === 'fulfilled' ? statsResult.value : { data: [] };
            const advancedPayload = advancedResult.status === 'fulfilled' ? advancedResult.value : { data: [] };

            return {
                playByPlayRows: [],
                playerRows: this.mapBallDontLieStatsToPlayerRows(statsPayload),
                advancedTeamRows: this.mapBallDontLieAdvancedToTeamRows(advancedPayload)
            };
        });
    }
};
