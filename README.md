Ascend Scoreboard App

React app to upload a match response.json, display the post-game scoreboard, and export CSV.

Features

- Upload a JSON match file
- Player leaderboard sorted by ACS (Agent, IGN, K/D/A, ACS)
- Match metadata: map, score
- Team stats per team: first kills, post plants, clutches, average team ACS
- Team names auto-labeled as Team{Player} (first player from each team)
- Download CSV for all stats

Run locally

1. Install Node.js 18+ and npm, or use Bun.
2. Install deps:
   - npm: npm install
   - bun: bun install
3. Start dev server:
   - npm: npm run dev
   - bun: bun run dev
4. Open the printed local URL and upload your response.json.

Build

- npm run build then npm run preview

Note on schema
This app parses player objects keyed by PUUID with fields under side.Total and agent.{agentId}.agent. It infers two teams when explicit team markers are absent and appends a representative player to team names.
