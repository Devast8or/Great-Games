/**
 * GameCard component for displaying game information
 */
import Utils from '../utils.js';
import { API } from '../api.js';
import LineupDisplay from './LineupDisplay.js';
import PitcherDisplay from './PitcherDisplay.js';

class GameCard {
    constructor(game, options = {}) {
        this.game = game;
        this.options = options;
        this.element = null;
        this.lineupShown = false;
        this.pitchersLoaded = false;
        this.lineupsLoaded = false;
        this.cachedPitchers = null;
        this.cachedLineups = null;
    }

    /**
     * Create the game card DOM element
     * @returns {HTMLElement} - Game card element
     */
    render() {
        const template = document.getElementById('game-card-template');
        this.element = document.importNode(template.content, true).querySelector('.game-card');
        
        this.renderTeams();
        this.renderGameInfo();
        this.setupLineups();
        
        return this.element;
    }

    /**
     * Render teams section of the card
     */
    renderTeams() {
        // Away team
        this.element.querySelector('.away .team-name').textContent = this.game.awayTeam.name;
        this.element.querySelector('.away .team-logo').src = this.game.awayTeam.logoUrl;
        this.element.querySelector('.away .team-logo').alt = this.game.awayTeam.name + ' logo';
        
        // Add team record for away team
        if (this.game.awayTeam.record) {
            const awayRecord = document.createElement('span');
            awayRecord.className = 'team-record';
            awayRecord.textContent = `(${this.game.awayTeam.record.wins}-${this.game.awayTeam.record.losses})`;
            awayRecord.style.cssText = 'margin-left: 5px; font-size: 0.9rem;';
            
            const awayNameElement = this.element.querySelector('.away .team-name');
            awayNameElement.appendChild(awayRecord);
        }

        // Home team
        this.element.querySelector('.home .team-name').textContent = this.game.homeTeam.name;
        this.element.querySelector('.home .team-logo').src = this.game.homeTeam.logoUrl;
        this.element.querySelector('.home .team-logo').alt = this.game.homeTeam.name + ' logo';
        
        // Add team record for home team
        if (this.game.homeTeam.record) {
            const homeRecord = document.createElement('span');
            homeRecord.className = 'team-record';
            homeRecord.textContent = `(${this.game.homeTeam.record.wins}-${this.game.homeTeam.record.losses})`;
            homeRecord.style.cssText = 'margin-left: 5px; font-size: 0.9rem;';
            
            const homeNameElement = this.element.querySelector('.home .team-name');
            homeNameElement.appendChild(homeRecord);
        }

        // Division rankings if available
        this.renderDivisionInfo('away');
        this.renderDivisionInfo('home');
    }

    /**
     * Render division information for a team
     * @param {string} teamType - 'away' or 'home'
     */
    renderDivisionInfo(teamType) {
        const team = this.game[teamType + 'Team'];
        const rankElement = this.element.querySelector(`.${teamType} .team-rank`);
        
        if (team.ranking?.divisionName) {
            const divElement = document.createElement('span');
            divElement.className = 'team-division';
            divElement.textContent = team.ranking.divisionName;
            divElement.style.cssText = 'font-size: 0.9rem; color: rgba(255,255,255,0.8);';
            
            const nameElement = this.element.querySelector(`.${teamType} .team-name`);
            nameElement.parentNode.insertBefore(divElement, nameElement.nextSibling);
        }

        if (team.ranking?.divisionRank) {
            rankElement.textContent = `Div Rank: ${team.ranking.divisionRank}`;
            rankElement.style.cssText = 'font-size: 0.9rem;';
            rankElement.classList.remove('hidden');
        } else {
            rankElement.classList.add('hidden');
        }
    }

    /**
     * Render game info section
     */
    renderGameInfo() {
        const gameInfo = this.element.querySelector('.game-info');
        
        // Stadium info
        gameInfo.querySelector('.stadium').textContent = this.game.venue;

        // Score section
        const scoreElement = gameInfo.querySelector('.score');
        
        // For future games, show game time instead of score
        if (this.game.isFuture) {
            const gameTimeDiv = document.createElement('div');
            gameTimeDiv.className = 'game-time';
            gameTimeDiv.textContent = this.game.gameTime;
            gameInfo.appendChild(gameTimeDiv);
        } else {
            this.renderBoxScore(scoreElement);
            // Hide score by default for previous games
            scoreElement.classList.add('hidden');
        }

        // Rating if available (only for completed games)
        if (this.game.excitementScore) {
            this.renderRating();
        }

        // Create VS section with reveal button (only for completed games)
        if (!this.game.isFuture) {
            this.createVsSection();
        }
    }

    /**
     * Render box score table
     * @param {HTMLElement} container - Container for box score
     */
    renderBoxScore(container) {
        container.innerHTML = '';
        
        const table = document.createElement('table');
        table.className = 'box-score-table';
        
        // Header row with innings
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th></th>';
        
        // Add inning numbers
        this.game.inningScores.forEach(inning => {
            headerRow.innerHTML += `<th>${inning.inningNumber}</th>`;
        });
        
        // Add R, H, E columns
        headerRow.innerHTML += `
            <th title="Runs">R</th>
            <th title="Hits">H</th>
            <th title="Errors">E</th>
        `;
        table.appendChild(headerRow);
        
        // Team rows
        ['away', 'home'].forEach(teamType => {
            const team = this.game[teamType + 'Team'];
            const row = document.createElement('tr');
            
            // Team logo cell
            row.innerHTML = `
                <td class="team-logo-cell">
                    <img src="${team.logoUrl}" alt="${team.name}" 
                         title="${team.name}" class="score-team-logo">
                </td>
            `;
            
            // Add inning scores
            this.game.inningScores.forEach(inning => {
                row.innerHTML += `<td>${inning[teamType]}</td>`;
            });
            
            // Add R, H, E
            row.innerHTML += `
                <td class="runs-cell">${team.score}</td>
                <td>${team.hits}</td>
                <td>${team.errors}</td>
            `;
            
            // Add winner class if this team won
            if ((teamType === 'away' && team.score > this.game.homeTeam.score) ||
                (teamType === 'home' && team.score > this.game.awayTeam.score)) {
                row.classList.add('winner');
            }
            
            table.appendChild(row);
        });
        
        container.appendChild(table);

        // Add innings info for extra innings games
        if (this.game.isExtraInnings) {
            const inningsInfo = document.createElement('div');
            inningsInfo.className = 'innings-info';
            inningsInfo.textContent = `${this.game.innings} innings`;
            container.appendChild(inningsInfo);
        }
    }

    /**
     * Render game rating
     */
    renderRating() {
        const ratingElement = document.createElement('div');
        ratingElement.className = 'rating top-rating';
        ratingElement.innerHTML = `
            <span class="rating-label">Game Rating</span>
            <span class="stars" title="${Math.round(this.game.excitementScore)} Points">
                ${this.getStarRating()}
            </span>
        `;
        
        ratingElement.style.cssText = 'margin: 0.5rem 0; text-align: center; color: white;';
        
        // Add click event listener to stars to log detailed scoring breakdown
        const starsElement = ratingElement.querySelector('.stars');
        starsElement.style.cursor = 'pointer';
        starsElement.addEventListener('click', () => this.logScoringDetails());
        
        const teamsContainer = this.element.querySelector('.teams');
        teamsContainer.parentNode.insertBefore(ratingElement, teamsContainer);
        
        // Hide original rating
        const infoRating = this.element.querySelector('.game-info .rating');
        if (infoRating) {
            infoRating.classList.add('hidden');
        }
    }

    /**
     * Log detailed scoring breakdown to console
     */
    logScoringDetails() {
        const game = this.game;
        try {
            console.group(`Scoring Breakdown for ${game.awayTeam.name} @ ${game.homeTeam.name}`);
        } catch (e) {
            console.log(`----- SCORING BREAKDOWN FOR ${game.awayTeam.name} @ ${game.homeTeam.name} -----`);
        }
        
        console.log(`Total Excitement Score: ${game.excitementScore} points (${this.getStarRating()} stars)`);
        console.log(`Game Date: ${new Date(game.date).toLocaleDateString()}`);
        console.log(`Final Score: ${game.awayTeam.name} ${game.awayTeam.score}, ${game.homeTeam.name} ${game.homeTeam.score}`);
        
        // First, log basic game metrics
        try {
            console.group('Game Metrics:');
        } catch (e) {
            console.log('----- GAME METRICS -----');
        }
        
        console.log(`Run Difference: ${game.runDifference}`);
        console.log(`Lead Changes: ${game.leadChanges}`);
        console.log(`Extra Innings: ${game.isExtraInnings ? 'Yes (' + game.innings + ' innings)' : 'No'}`);
        console.log(`Total Runs: ${game.totalRuns}`);
        console.log(`Last Lead Change: Inning #${game.lastLeadChangeInning}`);
        console.log(`Walk-off Win: ${game.isWalkoff ? 'Yes' : 'No'}`);
        console.log(`Maximum Lead: ${game.maxLead} runs`);
        console.log(`Comeback Win: ${game.hasComebackWin ? 'Yes' : 'No'}`);
        console.log(`Total Hits: ${(game.awayTeam.hits || 0) + (game.homeTeam.hits || 0)}`);
        console.log(`Total Errors: ${(game.awayTeam.errors || 0) + (game.homeTeam.errors || 0)}`);
        
        try {
            console.groupEnd();
        } catch (e) {
            console.log('----- END GAME METRICS -----');
        }

        // Get the Ranker class to calculate scores for each criterion
        import('../ranker.js').then(module => {
            const Ranker = module.Ranker;
            
            try {
                console.group('Detailed Scoring Breakdown:');
            } catch (e) {
                console.log('----- DETAILED SCORING BREAKDOWN -----');
            }
            
            // Create a table for the scoring breakdown
            console.table({
                'Close Game': {
                    'Raw Score': this.formatScore(Ranker.calculateCloseGameScore(game)),
                    'Weight': Ranker.weights.closeGame,
                    'Weighted Score': this.formatScore(Ranker.calculateCloseGameScore(game) * Ranker.weights.closeGame),
                    'Description': this.getCloseGameDescription(game.runDifference)
                },
                'Lead Changes': {
                    'Raw Score': this.formatScore(Ranker.calculateLeadChangesScore(game)),
                    'Weight': Ranker.weights.leadChanges,
                    'Weighted Score': this.formatScore(Ranker.calculateLeadChangesScore(game) * Ranker.weights.leadChanges),
                    'Description': `${game.leadChanges} lead changes, last in inning #${game.lastLeadChangeInning}`
                },
                'Late Game Drama': {
                    'Raw Score': this.formatScore(Ranker.calculateLateGameDramaScore(game)),
                    'Weight': Ranker.weights.lateGameDrama,
                    'Weighted Score': this.formatScore(Ranker.calculateLateGameDramaScore(game) * Ranker.weights.lateGameDrama),
                    'Description': this.getLateDramaDescription(game)
                },
                'Comeback Win': {
                    'Raw Score': this.formatScore(Ranker.calculateComebackScore(game)),
                    'Weight': Ranker.weights.comebackWin,
                    'Weighted Score': this.formatScore(Ranker.calculateComebackScore(game) * Ranker.weights.comebackWin),
                    'Description': game.hasComebackWin ? `Comeback from ${game.maxLead}-run deficit` : 'No comeback'
                },
                'Extra Innings': {
                    'Raw Score': this.formatScore(Ranker.calculateExtraInningsScore(game)),
                    'Weight': Ranker.weights.extraInnings,
                    'Weighted Score': this.formatScore(Ranker.calculateExtraInningsScore(game) * Ranker.weights.extraInnings),
                    'Description': game.isExtraInnings ? `${game.innings - 9} extra innings played` : 'No extra innings'
                },
                'High Scoring': {
                    'Raw Score': this.formatScore(Ranker.calculateHighScoringScore(game)),
                    'Weight': Ranker.weights.highScoring,
                    'Weighted Score': this.formatScore(Ranker.calculateHighScoringScore(game) * Ranker.weights.highScoring),
                    'Description': `${game.totalRuns} total runs scored`
                },
                'Team Rankings': {
                    'Raw Score': this.formatScore(Ranker.calculateRankingsScore(game)),
                    'Weight': Ranker.weights.teamRankings,
                    'Weighted Score': this.formatScore(Ranker.calculateRankingsScore(game) * Ranker.weights.teamRankings),
                    'Description': this.getTeamRankingsDescription(game)
                },
                'Total Hits': {
                    'Raw Score': this.formatScore(Ranker.calculateHitsScore(game)),
                    'Weight': Ranker.weights.hits,
                    'Weighted Score': this.formatScore(Ranker.calculateHitsScore(game) * Ranker.weights.hits),
                    'Description': `${(game.awayTeam.hits || 0) + (game.homeTeam.hits || 0)} total hits`
                },
                'Defensive Plays': {
                    'Raw Score': this.formatScore(Ranker.calculateErrorsScore(game)),
                    'Weight': Ranker.weights.errors,
                    'Weighted Score': this.formatScore(Ranker.calculateErrorsScore(game) * Ranker.weights.errors),
                    'Description': `${(game.awayTeam.errors || 0) + (game.homeTeam.errors || 0)} total errors`
                },
                'Scoring Distribution': {
                    'Raw Score': this.formatScore(Ranker.calculateScoringDistributionScore(game)),
                    'Weight': Ranker.weights.scoringDistribution,
                    'Weighted Score': this.formatScore(Ranker.calculateScoringDistributionScore(game) * Ranker.weights.scoringDistribution),
                    'Description': this.getScoringDistributionDescription(game)
                },
                'Rivalry Game': {
                    'Raw Score': this.formatScore(Ranker.calculateRivalryScore(game)),
                    'Weight': Ranker.weights.rivalryGame,
                    'Weighted Score': this.formatScore(Ranker.calculateRivalryScore(game) * Ranker.weights.rivalryGame),
                    'Description': Ranker.calculateRivalryScore(game) > 0 ? 'Historical rivalry matchup' : 'Not a notable rivalry'
                },
                'Player Milestones': {
                    'Raw Score': this.formatScore(Ranker.calculatePlayerMilestonesScore(game)),
                    'Weight': Ranker.weights.playerMilestones,
                    'Weighted Score': this.formatScore(Ranker.calculatePlayerMilestonesScore(game) * Ranker.weights.playerMilestones),
                    'Description': this.getPlayerMilestonesDescription(game)
                },
                'Seasonal Context': {
                    'Raw Score': this.formatScore(Ranker.calculateSeasonalContextScore(game)),
                    'Weight': Ranker.weights.seasonalContext,
                    'Weighted Score': this.formatScore(Ranker.calculateSeasonalContextScore(game) * Ranker.weights.seasonalContext),
                    'Description': this.getSeasonalContextDescription(game)
                }
            });
            
            try {
                console.groupEnd();
            } catch (e) {
                console.log('----- END DETAILED SCORING BREAKDOWN -----');
            }
            
            // Display scoring ranges and star ratings information
            try {
                console.group('Star Rating Scale:');
            } catch (e) {
                console.log('----- STAR RATING SCALE -----');
            }
            
            console.log('★★★★★ (5 stars): 80-100 points - Elite game');
            console.log('★★★★ (4 stars): 60-79 points - Great game');
            console.log('★★★ (3 stars): 40-59 points - Good game');
            console.log('★★ (2 stars): 20-39 points - Average game');
            console.log('★ (1 star): 0-19 points - Below average game');
            
            try {
                console.groupEnd();
            } catch (e) {
                console.log('----- END STAR RATING SCALE -----');
            }
        
            if (game.playerMilestones) {
                try {
                    console.group('Player Milestones:');
                } catch (e) {
                    console.log('----- PLAYER MILESTONES -----');
                }
                
                const awayMilestones = game.playerMilestones.away;
                const homeMilestones = game.playerMilestones.home;
                
                if (awayMilestones.noHitter) {
                    console.log(`🔥 ${game.awayTeam.name} threw a no-hitter!`);
                    if (awayMilestones.perfectGame) console.log(`🌟 It was a PERFECT GAME!`);
                }
                
                if (homeMilestones.noHitter) {
                    console.log(`🔥 ${game.homeTeam.name} threw a no-hitter!`);
                    if (homeMilestones.perfectGame) console.log(`🌟 It was a PERFECT GAME!`);
                }
                
                if (awayMilestones.cycleHitter || homeMilestones.cycleHitter) {
                    const team = awayMilestones.cycleHitter ? game.awayTeam.name : game.homeTeam.name;
                    const player = awayMilestones.cycleHitter?.name || homeMilestones.cycleHitter?.name;
                    console.log(`⚾ ${player} (${team}) hit for the cycle!`);
                }
                
                const multiHRHitters = [...(awayMilestones.multiHomeRunHitters || []), ...(homeMilestones.multiHomeRunHitters || [])];
                if (multiHRHitters.length > 0) {
                    multiHRHitters.forEach(player => {
                        const team = awayMilestones.multiHomeRunHitters.some(p => p.id === player.id) ? 
                                    game.awayTeam.name : game.homeTeam.name;
                        console.log(`💪 ${player.name} (${team}) hit ${player.homeRuns} home runs`);
                    });
                }
                
                const highRBIHitters = [...(awayMilestones.highRbiHitters || []), ...(homeMilestones.highRbiHitters || [])];
                if (highRBIHitters.length > 0) {
                    highRBIHitters.forEach(player => {
                        const team = awayMilestones.highRbiHitters.some(p => p.id === player.id) ? 
                                    game.awayTeam.name : game.homeTeam.name;
                        console.log(`👑 ${player.name} (${team}) had ${player.rbi} RBIs`);
                    });
                }
                
                if (awayMilestones.highStrikeoutPitcher) {
                    console.log(`🔥 ${awayMilestones.highStrikeoutPitcher.name} (${game.awayTeam.name}) had ${awayMilestones.highStrikeoutPitcher.strikeOuts} strikeouts`);
                }
                
                if (homeMilestones.highStrikeoutPitcher) {
                    console.log(`🔥 ${homeMilestones.highStrikeoutPitcher.name} (${game.homeTeam.name}) had ${homeMilestones.highStrikeoutPitcher.strikeOuts} strikeouts`);
                }
                
                try {
                    console.groupEnd();
                } catch (e) {
                    console.log('----- END PLAYER MILESTONES -----');
                }
            }
            
            if (game.awayTeam.detailedRanking && game.homeTeam.detailedRanking) {
                try {
                    console.group('Playoff Implications:');
                } catch (e) {
                    console.log('----- PLAYOFF IMPLICATIONS -----');
                }
                
                console.log(`${game.awayTeam.name}: ${this.getTeamStandingInfo(game.awayTeam)}`);
                console.log(`${game.homeTeam.name}: ${this.getTeamStandingInfo(game.homeTeam)}`);
                
                // Check for key matchups
                if (game.awayTeam.detailedRanking.divisionName === game.homeTeam.detailedRanking.divisionName) {
                    console.log(`📊 Division Matchup: ${game.awayTeam.detailedRanking.divisionName}`);
                }
                
                if (game.awayTeam.detailedRanking.isInFirstPlace && game.homeTeam.detailedRanking.isInFirstPlace) {
                    console.log(`🏆 First Place Matchup: Division leaders facing off!`);
                }
                
                if (game.awayTeam.detailedRanking.isInWildCard && game.homeTeam.detailedRanking.isInWildCard) {
                    console.log(`🃏 Wild Card Matchup: Teams in wild card positions!`);
                }
                
                const isLateSeason = new Date(game.date).getMonth() >= 8; // September or later
                if (isLateSeason) {
                    console.log(`📅 Late Season Game: September/October matchup with playoff implications`);
                }
                
                try {
                    console.groupEnd();
                } catch (e) {
                    console.log('----- END PLAYOFF IMPLICATIONS -----');
                }
            }
        });
        
        console.log('Click on the stars again to hide this breakdown');
        
        try {
            console.groupEnd();
        } catch (e) {
            console.log('----- END SCORING BREAKDOWN -----');
        }
    }
    
    /**
     * Format scoring value to 2 decimal places
     * @param {number} value - Score value
     * @returns {string} - Formatted score value
     */
    formatScore(value) {
        return (value * 100).toFixed(1) + '%';
    }
    
    /**
     * Get description for close game scoring
     * @param {number} runDifference - Run difference in game
     * @returns {string} - Description of close game scoring
     */
    getCloseGameDescription(runDifference) {
        if (runDifference === 0) return 'Tie game';
        if (runDifference === 1) return '1-run game (very close)';
        if (runDifference === 2) return '2-run game (close)';
        if (runDifference === 3) return '3-run game (moderately close)';
        return `${runDifference}-run difference (not close)`;
    }
    
    /**
     * Get description for late game drama
     * @param {Object} game - Game object
     * @returns {string} - Description of late game drama
     */
    getLateDramaDescription(game) {
        const descriptions = [];
        
        if (game.runDifference <= 1 && game.lastLeadChangeInning >= 8) {
            descriptions.push('Very close late-game lead change');
        } else if (game.runDifference <= 2 && game.lastLeadChangeInning >= 7) {
            descriptions.push('Close late-game lead change');
        }
        
        if (game.isWalkoff) {
            descriptions.push('Walk-off victory');
        }
        
        if (descriptions.length === 0) {
            return 'No significant late-game drama';
        }
        
        return descriptions.join(', ');
    }
    
    /**
     * Get description for team rankings
     * @param {Object} game - Game object
     * @returns {string} - Description of team rankings
     */
    getTeamRankingsDescription(game) {
        const awayRank = game.awayTeam.ranking?.divisionRank || 5;
        const homeRank = game.homeTeam.ranking?.divisionRank || 5;
        
        return `Away team division rank: ${awayRank}, Home team division rank: ${homeRank}`;
    }
    
    /**
     * Get description for scoring distribution
     * @param {Object} game - Game object
     * @returns {string} - Description of scoring distribution
     */
    getScoringDistributionDescription(game) {
        const inningsWithScoring = game.inningScores.filter(
            inning => inning.away > 0 || inning.home > 0
        ).length;
        
        const distributionRatio = inningsWithScoring / game.innings;
        const formattedRatio = (distributionRatio * 100).toFixed(1) + '%';
        
        return `Scoring in ${inningsWithScoring} of ${game.innings} innings (${formattedRatio})`;
    }
    
    /**
     * Get description for player milestones
     * @param {Object} game - Game object
     * @returns {string} - Description of player milestones
     */
    getPlayerMilestonesDescription(game) {
        if (!game.playerMilestones) {
            return 'No milestone data available';
        }
        
        const milestones = [];
        const awayMilestones = game.playerMilestones.away;
        const homeMilestones = game.playerMilestones.home;
        
        if (awayMilestones.perfectGame || homeMilestones.perfectGame) {
            milestones.push('Perfect game');
        } else if (awayMilestones.noHitter || homeMilestones.noHitter) {
            milestones.push('No-hitter');
        }
        
        if (awayMilestones.cycleHitter || homeMilestones.cycleHitter) {
            milestones.push('Cycle');
        }
        
        const multiHRHitters = [...(awayMilestones.multiHomeRunHitters || []), ...(homeMilestones.multiHomeRunHitters || [])];
        if (multiHRHitters.length > 0) {
            milestones.push(`${multiHRHitters.length} player(s) with multi-HR games`);
        }
        
        const highRBIHitters = [...(awayMilestones.highRbiHitters || []), ...(homeMilestones.highRbiHitters || [])];
        if (highRBIHitters.length > 0) {
            milestones.push(`${highRBIHitters.length} player(s) with 5+ RBIs`);
        }
        
        if (awayMilestones.highStrikeoutPitcher || homeMilestones.highStrikeoutPitcher) {
            milestones.push('10+ strikeout pitching performance');
        }
        
        if (milestones.length === 0) {
            return 'No notable player milestones';
        }
        
        return milestones.join(', ');
    }
    
    /**
     * Get description for seasonal context
     * @param {Object} game - Game object
     * @returns {string} - Description of seasonal context
     */
    getSeasonalContextDescription(game) {
        if (!game.awayTeam.detailedRanking && !game.homeTeam.detailedRanking) {
            return 'No detailed rankings available';
        }
        
        const contexts = [];
        
        if (game.awayTeam.detailedRanking && game.homeTeam.detailedRanking) {
            if (game.awayTeam.detailedRanking.divisionName === game.homeTeam.detailedRanking.divisionName) {
                contexts.push('Division matchup');
            }
            
            if (game.awayTeam.detailedRanking.isInFirstPlace && game.homeTeam.detailedRanking.isInFirstPlace) {
                contexts.push('First-place teams matchup');
            }
            
            if (game.awayTeam.detailedRanking.isInWildCard && game.homeTeam.detailedRanking.isInWildCard) {
                contexts.push('Wild card teams matchup');
            }
            
            const isLateSeason = new Date(game.date).getMonth() >= 8; // September or later
            if (isLateSeason) {
                contexts.push('Late season game');
            }
        }
        
        if (contexts.length === 0) {
            return 'No significant playoff implications';
        }
        
        return contexts.join(', ');
    }

    /**
     * Get formatted team standing information
     * @param {Object} team - Team object
     * @returns {string} - Formatted standing info
     */
    getTeamStandingInfo(team) {
        if (!team.detailedRanking) return 'No ranking data available';
        
        const r = team.detailedRanking;
        let info = `${r.wins}-${r.losses}`;
        
        if (r.isInFirstPlace) {
            info += `, 1st in ${r.divisionName}`;
        } else {
            info += `, ${this.getOrdinal(r.divisionRank)} in ${r.divisionName}, ${r.gamesBack} GB`;
        }
        
        if (r.isInWildCard) {
            info += `, Wild Card #${r.wildCardRank}`;
        } else if (r.wildCardGamesBack <= 5) {
            info += `, ${r.wildCardGamesBack} GB of Wild Card`;
        }
        
        return info;
    }
    
    /**
     * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
     * @param {number|string} n - The number
     * @returns {string} - Number with ordinal suffix
     */
    getOrdinal(n) {
        const num = parseInt(n);
        const j = num % 10;
        const k = num % 100;
        
        if (j === 1 && k !== 11) {
            return num + "st";
        }
        if (j === 2 && k !== 12) {
            return num + "nd";
        }
        if (j === 3 && k !== 13) {
            return num + "rd";
        }
        return num + "th";
    }

    /**
     * Get star rating HTML based on excitement score
     * @returns {string} - Star rating HTML
     */
    getStarRating() {
        const score = this.game.excitementScore;
        // Adjust thresholds based on realistic game scores:
        // 80-100: 5 stars (Elite game)
        // 60-79: 4 stars (Great game)
        // 40-59: 3 stars (Good game)
        // 20-39: 2 stars (Average game)
        // 0-19: 1 star (Below average game)
        const stars = Math.max(1, Math.min(5, Math.floor(score / 20) + 1));
        const hasHalfStar = (score % 20) >= 10;
        
        return '★'.repeat(Math.floor(stars)) + (hasHalfStar ? '½' : '');
    }

    /**
     * Create VS section with reveal button
     */
    createVsSection() {
        const vsElement = this.element.querySelector('.vs');
        const container = document.createElement('div');
        container.className = 'vs-score-container';
        
        const revealBtn = document.createElement('button');
        revealBtn.className = 'reveal-btn top-reveal-btn';
        revealBtn.textContent = 'Reveal Score';
        
        container.appendChild(vsElement.cloneNode(true));
        container.appendChild(revealBtn);
        vsElement.parentNode.replaceChild(container, vsElement);
        
        // Remove original reveal button
        const oldRevealBtn = this.element.querySelector('.reveal-btn:not(.top-reveal-btn)');
        if (oldRevealBtn) {
            oldRevealBtn.parentNode.removeChild(oldRevealBtn);
        }
        
        // Add event listener
        const scoreElement = this.element.querySelector('.score');
        revealBtn.addEventListener('click', () => {
            scoreElement.classList.toggle('hidden');
            revealBtn.textContent = scoreElement.classList.contains('hidden') ? 
                'Reveal Score' : 'Hide Score';
        });
    }

    /**
     * Load pitcher stats
     * @param {Object} pitcher - Pitcher object
     * @returns {Promise} - Promise resolving to pitcher with stats
     */
    async loadPitcherStats(pitcher) {
        if (!pitcher || pitcher.stats) return pitcher;
        
        try {
            const seasonYear = new Date().getFullYear();
            const stats = await API.apiRequest(`/people/${pitcher.id}/stats`, {
                stats: 'season',
                season: seasonYear,
                group: 'pitching'
            });
            
            if (stats.stats?.[0]?.splits?.[0]?.stat) {
                const statData = stats.stats[0].splits[0].stat;
                pitcher.stats = {
                    gamesPlayed: statData.gamesPlayed || statData.games || '0',
                    era: statData.era || '0.00',
                    wins: statData.wins || '0',
                    losses: statData.losses || '0',
                    // Add additional stats for the pitcher detail panel
                    inningsPitched: statData.inningsPitched || '0',
                    hits: statData.hits || '0',
                    runs: statData.runs || '0',
                    earnedRuns: statData.earnedRuns || '0',
                    baseOnBalls: statData.baseOnBalls || '0',
                    strikeOuts: statData.strikeOuts || '0',
                    homeRuns: statData.homeRuns || '0',
                    whip: statData.whip || '0.00'
                };
            }
            
            // Make sure pitcher has teamId property
            if (!pitcher.teamId && this.game) {
                // Check which team the pitcher belongs to
                if (this.game.awayTeam.pitcher && this.game.awayTeam.pitcher.id === pitcher.id) {
                    pitcher.teamId = this.game.awayTeam.id;
                } else if (this.game.homeTeam.pitcher && this.game.homeTeam.pitcher.id === pitcher.id) {
                    pitcher.teamId = this.game.homeTeam.id;
                }
            }
            
        } catch (error) {
            console.error('Error loading pitcher stats:', error);
        }
        
        return pitcher;
    }

    /**
     * Setup lineup section
     */
    setupLineups() {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = '<span class="arrow-down">▼</span> Show Pitchers & Lineups';
        
        const container = document.createElement('div');
        container.className = 'lineups-container hidden';
        
        // Create lineups row to keep them side by side
        const lineupsRow = document.createElement('div');
        lineupsRow.className = 'lineups-row';
        
        // Add lineup sections with pitcher images above each lineup
        ['away', 'home'].forEach(teamType => {
            // Create team column container
            const teamColumn = document.createElement('div');
            teamColumn.className = `team-lineup-column ${teamType}-column`;
            
            // Add pitcher container above each lineup
            const pitcherContainer = document.createElement('div');
            pitcherContainer.className = `pitcher-display ${teamType}-pitcher-display`;
            pitcherContainer.innerHTML = `<div class="pitcher-loading">Loading pitcher...</div>`;
            teamColumn.appendChild(pitcherContainer);
            
            // Add lineup container
            const teamContainer = document.createElement('div');
            teamContainer.className = `lineup ${teamType}-lineup`;
            teamContainer.innerHTML = `
                <h4>${teamType === 'away' ? 'Away' : 'Home'} Lineup</h4>
                <div class="lineup-loading">Loading lineup...</div>
            `;
            teamColumn.appendChild(teamContainer);
            
            // Add the column to the row
            lineupsRow.appendChild(teamColumn);
        });
        
        container.appendChild(lineupsRow);
        
        this.element.querySelector('.game-info').appendChild(expandBtn);
        this.element.appendChild(container);
        
        expandBtn.addEventListener('click', () => this.toggleLineups(expandBtn, container));
    }

    async toggleLineups(button, container) {
        if (!container.classList.contains('hidden')) {
            // Hiding the content
            container.classList.add('hidden');
            button.innerHTML = '<span class="arrow-down">▼</span> Show Pitchers & Lineups';
            this.lineupShown = false;
        } else {
            // Showing the content
            container.classList.remove('hidden');
            button.innerHTML = '<span class="arrow-up">▲</span> Hide Pitchers & Lineups';
            
            // Get pitcher displays and lineup containers
            const pitcherDisplays = container.querySelectorAll('.pitcher-display');
            const lineupsRow = container.querySelector('.lineups-row');

            try {
                // Load content if not already loaded
                if (!this.pitchersLoaded || !this.lineupsLoaded) {
                    await Promise.all([
                        this.loadAndRenderPitchers(container),
                        this.loadAndRenderLineups(container)
                    ]);
                }
                
                this.lineupShown = true;
            } catch (error) {
                console.error('Error loading content:', error);
                container.innerHTML = '<div class="error">Error loading content. Please try again.</div>';
            }
        }
    }

    async loadAndRenderPitchers(container) {
        if (this.pitchersLoaded && this.cachedPitchers) {
            const pitcherDisplays = container.querySelectorAll('.pitcher-display');
            pitcherDisplays.forEach((display, index) => {
                const teamType = index === 0 ? 'away' : 'home';
                if (this.game[teamType + 'Team'].pitcher) {
                    // Clear current content
                    display.innerHTML = '';
                    // Add the cached pitcher component to the display
                    if (this.cachedPitchers[teamType] instanceof HTMLElement) {
                        display.appendChild(this.cachedPitchers[teamType]);
                    }
                }
            });
            return;
        }

        // Load stats for both pitchers in parallel
        const [awayPitcher, homePitcher] = await Promise.all([
            this.loadPitcherStats(this.game.awayTeam.pitcher),
            this.loadPitcherStats(this.game.homeTeam.pitcher)
        ]);
        
        // Update pitcher data in game object
        if (awayPitcher) this.game.awayTeam.pitcher = awayPitcher;
        if (homePitcher) this.game.homeTeam.pitcher = homePitcher;
        
        // Create PitcherDisplay components instead of HTML strings
        const awayPitcherDisplay = new PitcherDisplay(this.game.awayTeam.pitcher, 'away');
        const homePitcherDisplay = new PitcherDisplay(this.game.homeTeam.pitcher, 'home');
        
        // Cache for future use - store the DOM elements
        this.cachedPitchers = {
            away: awayPitcherDisplay.render(),
            home: homePitcherDisplay.render()
        };
        
        // Clear and update the displays
        const pitcherDisplays = container.querySelectorAll('.pitcher-display');
        pitcherDisplays.forEach((display, index) => {
            const teamType = index === 0 ? 'away' : 'home';
            // Clear current content
            display.innerHTML = '';
            // Add the pitcher component to the display
            display.appendChild(this.cachedPitchers[teamType]);
        });
        
        this.pitchersLoaded = true;
    }

    async loadAndRenderLineups(container) {
        if (this.lineupsLoaded && this.cachedLineups) {
            // Find the lineup containers within their columns
            const awayLineupContainer = container.querySelector('.away-column .lineup');
            const homeLineupContainer = container.querySelector('.home-column .lineup');
            
            if (awayLineupContainer && homeLineupContainer) {
                awayLineupContainer.innerHTML = this.cachedLineups.away;
                homeLineupContainer.innerHTML = this.cachedLineups.home;
            }
            return;
        }

        try {
            const lineups = await API.fetchStartingLineups(this.game.id);
            this.game.awayTeam.lineup = lineups.away;
            this.game.homeTeam.lineup = lineups.home;
            
            // Create LineupDisplay components
            const awayLineup = new LineupDisplay('away', this.game.awayTeam.lineup);
            const homeLineup = new LineupDisplay('home', this.game.homeTeam.lineup);
            
            // Find the lineup containers within their columns
            const awayLineupContainer = container.querySelector('.away-column .lineup');
            const homeLineupContainer = container.querySelector('.home-column .lineup');
            
            if (awayLineupContainer && homeLineupContainer) {
                // Clear existing content and render new lineups
                awayLineupContainer.innerHTML = '';
                homeLineupContainer.innerHTML = '';
                
                awayLineupContainer.appendChild(awayLineup.render());
                homeLineupContainer.appendChild(homeLineup.render());
                
                // Cache the rendered lineups
                this.cachedLineups = {
                    away: awayLineupContainer.innerHTML,
                    home: homeLineupContainer.innerHTML
                };
                
                this.lineupsLoaded = true;
            }
        } catch (error) {
            console.error('Error loading lineups:', error);
            container.querySelectorAll('.lineup').forEach(el => {
                el.innerHTML = `
                    <h4>${el.classList.contains('away-lineup') ? 'Away' : 'Home'} Lineup</h4>
                    <div class="error">Error loading lineup</div>
                `;
            });
        }
    }

    /**
     * Create HTML for pitcher display
     * @param {Object} pitcher - Pitcher data
     * @param {string} teamType - 'away' or 'home'
     * @returns {string} - HTML for pitcher display
     */
    createPitcherDisplay(pitcher, teamType) {
        if (!pitcher) {
            return `<div class="no-pitcher-data">No starting pitcher data available</div>`;
        }
        
        const imageUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${pitcher.id}/headshot/67/current`;
        
        return `
            <div class="pitcher-container ${teamType}-pitcher-container">
                <div class="pitcher-header">Starting Pitcher</div>
                <div class="pitcher-img ${teamType}-pitcher-img" style="width: 170px; height: 170px;">
                    <img src="${imageUrl}"
                         alt="${pitcher.name}"
                         title="${pitcher.name}"
                         onerror="this.src='https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png'">
                </div>
                <div class="pitcher-name">${pitcher.name}</div>
                <div class="pitcher-stats">
                    ${this.formatPitcherStats(pitcher.stats)}
                </div>
            </div>
        `;
    }

    /**
     * Format pitcher stats for display
     * @param {Object} stats - Pitcher stats
     * @returns {string} - Formatted stats string
     */
    formatPitcherStats(stats) {
        if (!stats) return 'Stats not available';
        
        const winLossText = (Number(stats.wins) > 0 || Number(stats.losses) > 0) ? 
            `, ${stats.wins}-${stats.losses}` : '';
        return `${stats.gamesPlayed} G, ${stats.era} ERA${winLossText}`;
    }

    /**
     * Update the game card with new data
     * @param {Object} newData - Updated game data
     */
    update(newData) {
        this.game = { ...this.game, ...newData };
        if (this.element) {
            const newElement = this.render();
            this.element.parentNode.replaceChild(newElement, this.element);
            this.element = newElement;
        }
    }
}

export default GameCard;