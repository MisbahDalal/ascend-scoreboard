/*
 Parses the provided match JSON into a normalized structure for the UI.

 The provided example appears to be a single JSON object keyed by player PUUIDs,
 with per-player stats nested under side.Total and agent under an object keyed by agentId.

 We will:
 - Iterate values of the top-level object as players
 - Extract player name (gameName + tagLine), Total stats (kills, deaths, assists, acs, firstKills, clutchesWon, etc.)
 - Determine agent name from any agent object key found
 - Attempt to infer team split using any available team grouping; if absent, split by a heuristic using roundsWon in Attack/Defense, or default to two teams by alternating assignment to keep robustness.
 - Compute team aggregates: first kills, post plants (using bombPlants as proxy), clutches, average team ACS
 - Map name from top-level `map` if present, else unknown
 - Build leaderboard sorted by ACS desc
 - Build match score from team roundsWon sums if we can infer per-side; else unknown
 - Rename Team A/B by appending one representative player ign
*/

function getFirstKey(obj) {
    return obj ? Object.keys(obj)[0] : undefined;
}

function safeNumber(n, fallback = 0) {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : parseFloat(n);
    return Number.isFinite(v) ? v : fallback;
}

export function parseMatch(raw) {
    // If file may contain JSON string
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Map name detection
    let mapName = 'Unknown';
    if (data && data.map && typeof data.map === 'object') {
        const mapKey = getFirstKey(data.map);
        if (mapKey && data.map[mapKey] && data.map[mapKey].map) {
            mapName = String(data.map[mapKey].map);
        }
    }

    const players = [];

    if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const [, p] of Object.entries(data)) {
            if (!p || typeof p !== 'object') continue;

            const ign = [p.gameName, p.tagLine].filter(Boolean).join('#') || 'Unknown';

            const total = p.side && p.side.Total ? p.side.Total : {};
            const kills = safeNumber(total.kills);
            const deaths = safeNumber(total.deaths);
            const assists = safeNumber(total.assists);
            const acs = safeNumber(total.acs);
            const kd = deaths > 0 ? kills / deaths : kills;
            const firstKills = safeNumber(total.firstKills);
            const clutchesWon = safeNumber(total.clutchesWon);
            const bombPlants = safeNumber(total.bombPlants);

            // Extract agent name: data shows an `agent` object keyed by agentId
            let agent = 'Unknown';
            if (p.agent && typeof p.agent === 'object') {
                const k = getFirstKey(p.agent);
                if (k && p.agent[k] && p.agent[k].agent) agent = String(p.agent[k].agent);
            }

            players.push({ ign, agent, kills, deaths, assists, kd, acs, firstKills, clutchesWon, bombPlants, raw: p });
        }
    }

    // Sort leaderboard by ACS desc
    const leaderboard = [...players].sort((a, b) => b.acs - a.acs);

    // Split into two teams. If no explicit team markers, pick by even/odd index on sorted ign to keep deterministic.
    // Try to detect embedded team fields
    const teamA = [];
    const teamB = [];

    for (const pl of players) {
        // Heuristic: if raw has a team field in any casing, use it
        const r = pl.raw || {};
        const teamField = r.team || r.Team || r.teamId || r.party || undefined;
        if (teamField) {
            // Place by string hash parity
            const h = String(teamField).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            (h % 2 === 0 ? teamA : teamB).push(pl);
        } else {
            // Deterministic fallback by ign parity
            const h = pl.ign.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            (h % 2 === 0 ? teamA : teamB).push(pl);
        }
    }

    // Ensure both teams non-empty by moving one if needed
    if (teamA.length === 0 && teamB.length > 0) teamA.push(teamB.pop());
    if (teamB.length === 0 && teamA.length > 0) teamB.push(teamA.pop());

    // Team stats
    function aggregateTeam(team) {
        const size = Math.max(team.length, 1);
        const sum = team.reduce(
            (acc, p) => {
                acc.firstKills += safeNumber(p.firstKills);
                acc.postPlants += safeNumber(p.bombPlants);
                acc.clutches += safeNumber(p.clutchesWon);
                acc.acsTotal += safeNumber(p.acs);
                acc.roundsWonCandidates.push(safeNumber(p.raw?.side?.Total?.roundsWon));
                return acc;
            },
            { firstKills: 0, postPlants: 0, clutches: 0, acsTotal: 0, roundsWonCandidates: [] }
        );
        const avgAcs = sum.acsTotal / size;
        // Pick the max roundsWon reported among players as proxy for team rounds
        const roundsWon = sum.roundsWonCandidates.length ? Math.max(...sum.roundsWonCandidates.filter(n => Number.isFinite(n))) : undefined;
        return { firstKills: sum.firstKills, postPlants: sum.postPlants, clutches: sum.clutches, avgAcs, roundsWon };
    }

    const teamAStats = aggregateTeam(teamA);
    const teamBStats = aggregateTeam(teamB);

    // Match score
    const matchScore = (Number.isFinite(teamAStats.roundsWon) && Number.isFinite(teamBStats.roundsWon))
        ? `${teamAStats.roundsWon}-${teamBStats.roundsWon}`
        : 'Unknown';

    // Team names with appended representative player
    const teamAName = `Team${teamA[0] ? teamA[0].ign.split('#')[0] : 'A'}`;
    const teamBName = `Team${teamB[0] ? teamB[0].ign.split('#')[0] : 'B'}`;

    return {
        map: mapName,
        matchScore,
        leaderboard,
        teams: [
            { name: teamAName, players: teamA, stats: teamAStats },
            { name: teamBName, players: teamB, stats: teamBStats },
        ],
    };
}

export function buildCsv(parsed) {
    const headers = [
        'Team', 'IGN', 'Agent', 'Kills', 'Deaths', 'Assists', 'K/D', 'ACS', 'FirstKills', 'Clutches', 'PostPlants'
    ];
    const rows = [headers];
    for (const team of parsed.teams) {
        for (const p of team.players) {
            rows.push([
                team.name,
                p.ign,
                p.agent,
                String(p.kills),
                String(p.deaths),
                String(p.assists),
                p.deaths ? (p.kills / p.deaths).toFixed(2) : String(p.kills.toFixed ? p.kills.toFixed(2) : p.kills),
                String(safeNumber(p.acs).toFixed(2)),
                String(safeNumber(p.firstKills)),
                String(safeNumber(p.clutchesWon)),
                String(safeNumber(p.bombPlants)),
            ]);
        }
    }
    // Team-level summary rows
    rows.push([]);
    rows.push(['Team Summary']);
    rows.push(['Team', 'FirstKills', 'PostPlants', 'Clutches', 'AvgTeamACS']);
    for (const team of parsed.teams) {
        rows.push([
            team.name,
            String(team.stats.firstKills),
            String(team.stats.postPlants),
            String(team.stats.clutches),
            String(team.stats.avgAcs.toFixed(2)),
        ]);
    }
    return rows.map(r => r.map(v => (v == null ? '' : String(v))).join(',')).join('\n');
}


