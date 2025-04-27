// Test function to help identify division information in the API response
async function testMLBStandingsAPI() {
    try {
        // Get current date
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        console.log("Fetching MLB standings for date:", dateStr);
        
        // Fetch standings data with additional parameters to ensure we get division info
        const response = await fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&date=${dateStr}&hydrate=team,division`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Log the structure to understand where division names are stored
        if (data && data.records) {
            data.records.forEach((record, index) => {
                console.log(`Record ${index} Division Structure:`, 
                    JSON.stringify({
                        standingsType: record.standingsType,
                        divisionInfo: record.division || 'No division field',
                        firstTeamData: record.teamRecords && record.teamRecords.length > 0 ? {
                            team: record.teamRecords[0].team.name,
                            hasDivision: !!record.teamRecords[0].team.division,
                            divisionInfo: record.teamRecords[0].team.division || 'No division field'
                        } : 'No team records'
                    }, null, 2)
                );
            });
        } else {
            console.log("No records found in the API response");
        }
        
        // Extract and output division information from each team
        console.log("\nTeam Division Information:");
        let divisionAssignments = {};
        
        data.records.forEach(record => {
            if (record.teamRecords) {
                record.teamRecords.forEach(teamRecord => {
                    const teamName = teamRecord.team.name;
                    let divisionName = 'Unknown';
                    
                    // Try all possible paths for division name
                    if (record.division && record.division.name) {
                        divisionName = record.division.name;
                    } else if (teamRecord.team.division && teamRecord.team.division.name) {
                        divisionName = teamRecord.team.division.name;
                    }
                    
                    divisionAssignments[teamName] = divisionName;
                });
            }
        });
        
        console.log(divisionAssignments);
        
        return data;
    } catch (error) {
        console.error('Error testing MLB API:', error);
    }
}

// Call the test function when loading this script
testMLBStandingsAPI();