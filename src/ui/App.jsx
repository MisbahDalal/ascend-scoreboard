import React, { useMemo, useState } from 'react';
import { parseMatch, buildCsv } from '../lib/parse.js';

function download(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

export default function App() {
    const [raw, setRaw] = useState(null);
    const [error, setError] = useState(null);

    const parsed = useMemo(() => {
        try {
            if (!raw) return null;
            return parseMatch(raw);
        } catch (e) {
            setError(String(e.message || e));
            return null;
        }
    }, [raw]);

    return (
        <div className="container">
            <h1>Ascend Scoreboard</h1>
            <div className="card">
                <div className="actions">
                    <input
                        type="file"
                        accept="application/json,.json"
                        onChange={async (e) => {
                            setError(null);
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const text = await file.text();
                            try {
                                // Try parse to validate, but keep original raw text for parser
                                JSON.parse(text);
                                setRaw(text);
                            } catch (err) {
                                setError('Invalid JSON file.');
                            }
                        }}
                    />
                    {parsed && (
                        <button
                            className="secondary"
                            onClick={() => download('match_stats.csv', buildCsv(parsed))}
                        >
                            Download CSV
                        </button>
                    )}
                </div>
                {error && <div style={{ color: '#ff6b6b', marginTop: 8 }}>{error}</div>}
            </div>

            {parsed && (
                <div className="card">
                    <div className="row">
                        <div>
                            <h2>Match</h2>
                            <div className="muted">Map</div>
                            <div style={{ marginBottom: 8 }}><span className="pill">{parsed.map}</span></div>
                            <div className="muted">Score</div>
                            <div>{parsed.matchScore}</div>
                        </div>
                        <div>
                            <h2>Teams</h2>
                            <div className="grid2">
                                {parsed.teams.map((t) => (
                                    <div key={t.name} className="card" style={{ padding: 12 }}>
                                        <h3>{t.name}</h3>
                                        <div className="muted">Team stats</div>
                                        <div>First kills: <b>{t.stats.firstKills}</b></div>
                                        <div>Post plants: <b>{t.stats.postPlants}</b></div>
                                        <div>Clutches: <b>{t.stats.clutches}</b></div>
                                        <div>Avg team ACS: <b>{t.stats.avgAcs.toFixed(2)}</b></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {parsed && (
                <div className="card">
                    <h2>Player Leaderboard (by ACS)</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>IGN</th>
                                <th>Agent</th>
                                <th>K/D/A</th>
                                <th>ACS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parsed.leaderboard.map((p) => (
                                <tr key={p.ign + p.agent}>
                                    <td>{p.ign}</td>
                                    <td>{p.agent}</td>
                                    <td>{p.kills}/{p.deaths}/{p.assists}</td>
                                    <td>{Number(p.acs).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {parsed && (
                <div className="card">
                    <h2>All Players</h2>
                    {parsed.teams.map((t) => (
                        <div key={t.name} style={{ marginBottom: 12 }}>
                            <h3>{t.name}</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>IGN</th>
                                        <th>Agent</th>
                                        <th>Kills</th>
                                        <th>Deaths</th>
                                        <th>Assists</th>
                                        <th>K/D</th>
                                        <th>ACS</th>
                                        <th>First Kills</th>
                                        <th>Clutches</th>
                                        <th>Post Plants</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {t.players.map((p) => (
                                        <tr key={t.name + p.ign}>
                                            <td>{p.ign}</td>
                                            <td>{p.agent}</td>
                                            <td>{p.kills}</td>
                                            <td>{p.deaths}</td>
                                            <td>{p.assists}</td>
                                            <td>{(p.deaths ? (p.kills / p.deaths) : p.kills).toFixed(2)}</td>
                                            <td>{Number(p.acs).toFixed(2)}</td>
                                            <td>{p.firstKills}</td>
                                            <td>{p.clutchesWon}</td>
                                            <td>{p.bombPlants}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}


