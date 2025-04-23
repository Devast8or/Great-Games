/**
 * API handling for MLB Game data
 */

const API = {
    // MLB Stats API base URL
    BASE_URL: 'https://statsapi.mlb.com/api/v1',
    
    /**
     * Fetch games for a specific date
     * @param {string} date - Date in format YYYY-MM-DD
     * @returns {Promise} - Promise with game data
     */
    async fetchGames(date) {
        try {
            console.log(`Fetching games for date: ${date}`);
            
            // Using MLB Stats API to get schedule data for the specified date
            const url = `${this.BASE_URL}/schedule?sportId=1&date=${date}&hydrate=team,linescore,game(content(media(epg))),probablePitcher`;
            console.log(`API URL: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error(`API error: ${response.status} - ${response.statusText}`);
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Games data received. Dates: ${data.dates ? data.dates.length : 0}`);
            return data;
        } catch (error) {
            console.error('Error fetching games:', error);
            throw error;
        }
    },
    
    /**
     * Fetch current standings data for all teams
     * @param {string} date - Date in format YYYY-MM-DD (to get standings as of a specific date)
     * @returns {Promise} - Promise with standings data
     */
    async fetchStandings(date) {
        try {
            console.log(`Fetching standings for date: ${date}`);
            
            // Using MLB Stats API to get standings data - explicitly requesting division info
            const url = `${this.BASE_URL}/standings?leagueId=103,104&season=${date.substring(0,4)}&date=${date}&hydrate=team,division`;
            console.log(`API URL: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error(`API error: ${response.status} - ${response.statusText}`);
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Standings data received. Records: ${data.records ? data.records.length : 0}`);
            return data;
        } catch (error) {
            console.error('Error fetching standings:', error);
            throw error;
        }
    },
    
    /**
     * Get team ranking information from standings
     * @param {Object} standingsData - Standings data from API
     * @returns {Object} - Object with teamId as key and ranking info as value
     */
    processTeamRankings(standingsData) {
        const teamRankings = {};
        
        if (standingsData && standingsData.records) {
            standingsData.records.forEach(record => {
                // Each record represents a division
                // The division name is directly in the record object
                let divisionName = 'Unknown Division';
                
                if (record.division && record.division.name) {
                    divisionName = record.division.name;
                }
                
                // Format division names to be more concise (e.g., "AL East" instead of "American League East")
                if (divisionName.includes("American League")) {
                    divisionName = divisionName.replace("American League", "AL");
                } else if (divisionName.includes("National League")) {
                    divisionName = divisionName.replace("National League", "NL");
                }
                
                if (record.teamRecords) {
                    record.teamRecords.forEach(teamRecord => {
                        const teamId = teamRecord.team.id;
                        const divisionRank = parseInt(teamRecord.divisionRank);
                        const winPercentage = teamRecord.winningPercentage;
                        const gamesBack = teamRecord.gamesBack;
                        
                        teamRankings[teamId] = {
                            divisionRank,
                            divisionName,
                            winPercentage,
                            gamesBack
                        };
                    });
                }
            });
        }
        
        return teamRankings;
    },
    
    /**
     * Fetch game stats for a specific game
     * @param {number} gameId - MLB game ID
     * @returns {Promise} - Promise with detailed game stats
     */
    async fetchGameStats(gameId) {
        try {
            // Get detailed game data including plays, lineup, and boxscore
            const response = await fetch(`${this.BASE_URL}/game/${gameId}/boxscore`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error fetching game stats for game ${gameId}:`, error);
            throw error;
        }
    },
    
    /**
     * Fetch starting pitchers for a specific game
     * @param {number} gameId - MLB game ID
     * @returns {Promise} - Promise with starting pitcher information
     */
    async fetchStartingPitchers(gameId) {
        try {
            // Get pitching information from the boxscore endpoint
            const boxscore = await this.fetchGameStats(gameId);
            return this.extractStartingPitchers(boxscore);
        } catch (error) {
            console.error(`Error fetching starting pitchers for game ${gameId}:`, error);
            throw error;
        }
    },
    
    /**
     * Extract starting pitchers from boxscore data
     * @param {Object} boxscore - Boxscore data from API
     * @returns {Object} - Object with away and home starting pitchers
     */
    extractStartingPitchers(boxscore) {
        const pitchers = {
            away: null,
            home: null
        };
        
        // Extract away team starting pitcher
        if (boxscore.teams?.away?.pitchers && boxscore.teams.away.pitchers.length > 0) {
            const startingPitcherId = boxscore.teams.away.pitchers[0];
            const pitcher = boxscore.teams.away.players[`ID${startingPitcherId}`];
            if (pitcher) {
                // Handle different name formats in the API response
                let pitcherName = 'Unknown Pitcher';
                
                if (pitcher.person?.fullName) {
                    pitcherName = pitcher.person.fullName;
                } else if (pitcher.person?.firstName && pitcher.person?.lastName) {
                    pitcherName = `${pitcher.person.firstName} ${pitcher.person.lastName}`;
                } else if (pitcher.fullName) {
                    pitcherName = pitcher.fullName;
                } else if (pitcher.firstName && pitcher.lastName) {
                    pitcherName = `${pitcher.firstName} ${pitcher.lastName}`;
                } else if (pitcher.name) {
                    pitcherName = pitcher.name;
                }
                
                pitchers.away = {
                    id: startingPitcherId,
                    name: pitcherName,
                    stats: this.extractPitcherStats(pitcher)
                };
            }
        }
        
        // Extract home team starting pitcher
        if (boxscore.teams?.home?.pitchers && boxscore.teams.home.pitchers.length > 0) {
            const startingPitcherId = boxscore.teams.home.pitchers[0];
            const pitcher = boxscore.teams.home.players[`ID${startingPitcherId}`];
            if (pitcher) {
                // Handle different name formats in the API response
                let pitcherName = 'Unknown Pitcher';
                
                if (pitcher.person?.fullName) {
                    pitcherName = pitcher.person.fullName;
                } else if (pitcher.person?.firstName && pitcher.person?.lastName) {
                    pitcherName = `${pitcher.person.firstName} ${pitcher.person.lastName}`;
                } else if (pitcher.fullName) {
                    pitcherName = pitcher.fullName;
                } else if (pitcher.firstName && pitcher.lastName) {
                    pitcherName = `${pitcher.firstName} ${pitcher.lastName}`;
                } else if (pitcher.name) {
                    pitcherName = pitcher.name;
                }
                
                pitchers.home = {
                    id: startingPitcherId,
                    name: pitcherName,
                    stats: this.extractPitcherStats(pitcher)
                };
            }
        }
        
        return pitchers;
    },
    
    /**
     * Extract pitcher season stats
     * @param {Object} pitcher - Pitcher data from API
     * @returns {Object} - Object with pitcher stats
     */
    extractPitcherStats(pitcher) {
        // Try to get the season stats first, then fallback to game stats
        const stats = pitcher.seasonStats?.pitching || pitcher.stats?.pitching || {};
        
        return {
            gamesPlayed: stats.gamesPlayed || stats.games || '0',
            era: stats.era || '0.00',
            wins: stats.wins || '0',
            losses: stats.losses || '0',
            strikeOuts: stats.strikeOuts || stats.strikeouts || '0',
            inningsPitched: stats.inningsPitched || '0.0',
            whip: stats.whip || '0.00'
        };
    },
    
    /**
     * Fetch team logo URL
     * @param {number} teamId - MLB team ID
     * @returns {string} - URL to team logo
     */
    getTeamLogoUrl(teamId) {
        return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
    },
    
    /**
     * Fetch starting lineups for a specific game
     * @param {number} gameId - MLB game ID
     * @returns {Promise} - Promise with starting lineup information
     */
    async fetchStartingLineups(gameId) {
        try {
            // Get lineup information from the boxscore endpoint
            const boxscore = await this.fetchGameStats(gameId);
            return this.extractStartingLineups(boxscore);
        } catch (error) {
            console.error(`Error fetching starting lineups for game ${gameId}:`, error);
            throw error;
        }
    },
    
    /**
     * Extract starting lineups from boxscore data
     * @param {Object} boxscore - Boxscore data from API
     * @returns {Object} - Object with away and home starting lineups
     */
    extractStartingLineups(boxscore) {
        const lineups = {
            away: [],
            home: []
        };
        
        // Process lineups
        ['away', 'home'].forEach(teamType => {
            if (boxscore.teams?.[teamType]?.battingOrder) {
                // The battingOrder array contains player IDs in batting order
                const battingOrder = boxscore.teams[teamType].battingOrder;
                
                battingOrder.forEach(playerId => {
                    const playerKey = `ID${playerId}`;
                    const player = boxscore.teams[teamType].players[playerKey];
                    
                    if (player) {
                        // Handle different name formats in the API response
                        let playerName = 'Unknown Player';
                        
                        if (player.person?.fullName) {
                            // Use fullName if available
                            playerName = player.person.fullName;
                        } else if (player.person?.firstName && player.person?.lastName) {
                            // Use firstName and lastName if available
                            playerName = `${player.person.firstName} ${player.person.lastName}`;
                        } else if (player.fullName) {
                            // Alternative location for fullName
                            playerName = player.fullName;
                        } else if (player.firstName && player.lastName) {
                            // Alternative location for firstName and lastName
                            playerName = `${player.firstName} ${player.lastName}`;
                        } else if (player.name) {
                            // Some API responses might have just a name field
                            playerName = player.name;
                        }
                        
                        // Extract basic info and batting stats
                        const playerInfo = {
                            id: playerId,
                            name: playerName,
                            position: player.position?.abbreviation || 'N/A',
                            stats: {
                                gamesPlayed: player.seasonStats?.batting?.gamesPlayed || player.stats?.batting?.gamesPlayed || '0',
                                avg: player.seasonStats?.batting?.avg || player.stats?.batting?.avg || '.000',
                                obp: player.seasonStats?.batting?.obp || player.stats?.batting?.obp || '.000',
                                ops: player.seasonStats?.batting?.ops || player.stats?.batting?.ops || '.000',
                                hr: player.seasonStats?.batting?.homeRuns || player.stats?.batting?.homeRuns || 0,
                                rbi: player.seasonStats?.batting?.rbi || player.stats?.batting?.rbi || 0
                            }
                        };
                        
                        lineups[teamType].push(playerInfo);
                    }
                });
            }
        });
        
        return lineups;
    }
};