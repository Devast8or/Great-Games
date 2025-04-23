/**
 * Parser module for processing MLB game data
 */

const Parser = {
    /**
     * Process API response data into a usable game format
     * @param {Object} apiData - Raw API response
     * @returns {Array} - Array of processed game objects
     */
    processGames(apiData) {
        console.log("Parser: Processing games data");
        
        if (!apiData.dates || apiData.dates.length === 0) {
            console.log("Parser: No dates found in API response");
            return [];
        }
        
        const games = [];
        
        // The MLB API returns dates with games
        apiData.dates.forEach(date => {
            if (date.games && date.games.length > 0) {
                console.log(`Parser: Processing ${date.games.length} games for date ${date.date}`);
                
                date.games.forEach(game => {
                    // Only include completed games
                    if (game.status.abstractGameState === 'Final') {
                        try {
                            const processedGame = this.processGameData(game);
                            games.push(processedGame);
                        } catch (error) {
                            console.error(`Parser: Error processing game ${game.gamePk}:`, error);
                            // Continue with other games even if one fails
                        }
                    }
                });
            } else {
                console.log(`Parser: No games found for date ${date.date}`);
            }
        });
        
        console.log(`Parser: Processed ${games.length} completed games`);
        return games;
    },
    
    /**
     * Process individual game data
     * @param {Object} game - Raw game data
     * @returns {Object} - Processed game object
     */
    processGameData(game) {
        // Extract teams data
        const awayTeam = game.teams.away;
        const homeTeam = game.teams.home;
        
        // Get starting pitchers if available
        let awayPitcher = null;
        if (awayTeam.probablePitcher) {
            // Handle different API response formats
            if (awayTeam.probablePitcher.fullName) {
                awayPitcher = {
                    id: awayTeam.probablePitcher.id,
                    name: awayTeam.probablePitcher.fullName,
                    stats: null // Stats will be loaded separately when needed
                };
            } else if (awayTeam.probablePitcher.firstName && awayTeam.probablePitcher.lastName) {
                awayPitcher = {
                    id: awayTeam.probablePitcher.id,
                    name: `${awayTeam.probablePitcher.firstName} ${awayTeam.probablePitcher.lastName}`,
                    stats: null // Stats will be loaded separately when needed
                };
            }
        }
        
        let homePitcher = null;
        if (homeTeam.probablePitcher) {
            // Handle different API response formats
            if (homeTeam.probablePitcher.fullName) {
                homePitcher = {
                    id: homeTeam.probablePitcher.id,
                    name: homeTeam.probablePitcher.fullName,
                    stats: null // Stats will be loaded separately when needed
                };
            } else if (homeTeam.probablePitcher.firstName && homeTeam.probablePitcher.lastName) {
                homePitcher = {
                    id: homeTeam.probablePitcher.id,
                    name: `${homeTeam.probablePitcher.firstName} ${homeTeam.probablePitcher.lastName}`,
                    stats: null // Stats will be loaded separately when needed
                };
            }
        }
        
        // Process linescore data
        const innings = game.linescore?.innings || [];
        const leadChanges = this.countLeadChanges(innings, awayTeam.team.id, homeTeam.team.id);
        const isExtraInnings = innings.length > 9;
        const totalRuns = awayTeam.score + homeTeam.score;
        const runDifference = Math.abs(awayTeam.score - homeTeam.score);
        
        // Get media/watch links if available
        let watchLinks = [];
        if (game.content && game.content.media && game.content.media.epg) {
            game.content.media.epg.forEach(mediaType => {
                if (mediaType.title === 'MLBTV' && mediaType.items) {
                    watchLinks = mediaType.items.map(item => ({
                        title: item.mediaFeedType || 'Watch',
                        url: item.contentUrl || '#'
                    }));
                }
            });
        }
        
        return {
            id: game.gamePk,
            date: game.gameDate,
            status: game.status.detailedState,
            awayTeam: {
                id: awayTeam.team.id,
                name: awayTeam.team.name,
                logoUrl: API.getTeamLogoUrl(awayTeam.team.id),
                score: awayTeam.score,
                pitcher: awayPitcher,
                lineup: [] // Will be populated later
            },
            homeTeam: {
                id: homeTeam.team.id,
                name: homeTeam.team.name,
                logoUrl: API.getTeamLogoUrl(homeTeam.team.id),
                score: homeTeam.score,
                pitcher: homePitcher,
                lineup: [] // Will be populated later
            },
            venue: game.venue?.name || 'Unknown Venue',
            innings: innings.length,
            isExtraInnings,
            leadChanges,
            totalRuns,
            runDifference,
            isCloseGame: runDifference <= 2,
            isHighScoring: totalRuns >= 10,
            watchLinks,
            lineupsLoaded: false // Flag to track if lineups have been loaded
        };
    },
    
    /**
     * Count the number of lead changes in a game
     * @param {Array} innings - Innings data
     * @param {number} awayTeamId - Away team ID
     * @param {number} homeTeamId - Home team ID
     * @returns {number} - Number of lead changes
     */
    countLeadChanges(innings, awayTeamId, homeTeamId) {
        if (!innings || innings.length === 0) {
            return 0;
        }
        
        let leadChanges = 0;
        let awayScore = 0;
        let homeScore = 0;
        let leadingTeam = null;
        
        innings.forEach(inning => {
            // Add away team runs for this inning
            if (inning.away && typeof inning.away.runs === 'number') {
                awayScore += inning.away.runs;
            }
            
            // Check for lead change after away team bats
            if (leadingTeam === homeTeamId && awayScore > homeScore) {
                leadChanges++;
                leadingTeam = awayTeamId;
            } else if (leadingTeam === null && awayScore > 0) {
                leadingTeam = awayTeamId;
            }
            
            // Add home team runs for this inning
            if (inning.home && typeof inning.home.runs === 'number') {
                homeScore += inning.home.runs;
            }
            
            // Check for lead change after home team bats
            if (leadingTeam === awayTeamId && homeScore > awayScore) {
                leadChanges++;
                leadingTeam = homeTeamId;
            } else if (leadingTeam === null && homeScore > 0) {
                leadingTeam = homeTeamId;
            }
        });
        
        return leadChanges;
    }
};