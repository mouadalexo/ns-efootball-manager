'use strict';
const { Client, GatewayIntentBits, AttachmentBuilder } = require('/home/ubuntu/goatsi/node_modules/discord.js');
const fs = require('fs');

const envContent = fs.readFileSync('/home/ubuntu/goatsi/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const idx = line.indexOf('=');
  if (idx < 0) return;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const { db } = require('/home/ubuntu/goatsi/src/utils/database');
const {
  generateScheduleImage,
  generateResultImage,
  generateStandingsImage,
} = require('/home/ubuntu/goatsi/src/utils/imageGen');

const CHANNELS = {
  NSEL: {
    results:       '1463162274192556072',
    matchSchedule: '1462982363267993672',
  },
  MCL: {
    results:       '1463162354656088188',
    matchSchedule: '1463153753078108180',
  },
};

// Best world teams by ID from DB
const allTeams = db.get('teams');
const getTeam = id => allTeams.find(t => t.id === id);

// Group A: Real Madrid, FC Barcelona, Bayern Munich, PSG
// Group B: Manchester City, Liverpool FC, Inter Milan, Arsenal FC
const groupA = [getTeam(1), getTeam(2), getTeam(9), getTeam(11)].filter(Boolean);
const groupB = [getTeam(3), getTeam(5), getTeam(14), getTeam(7)].filter(Boolean);
const teams  = [...groupA, ...groupB];

function buildScheduleData() {
  const matches = [
    { id: 1, home_team_id: groupA[0].id, away_team_id: groupA[1].id, stage: 'group', round: 1, group_name: 'A' },
    { id: 2, home_team_id: groupA[2].id, away_team_id: groupA[3].id, stage: 'group', round: 1, group_name: 'A' },
    { id: 3, home_team_id: groupB[0].id, away_team_id: groupB[1].id, stage: 'group', round: 1, group_name: 'B' },
    { id: 4, home_team_id: groupB[2].id, away_team_id: groupB[3].id, stage: 'group', round: 1, group_name: 'B' },
  ];
  const byGroup = { A: matches.slice(0, 2), B: matches.slice(2, 4) };
  return { matches, byGroup };
}

function buildStandingsData() {
  function mockStats(team, rank) {
    const pts = [9, 6, 3, 0][rank];
    const w   = [3, 2, 1, 0][rank];
    const d = 0, l = 3 - w;
    const gf = [10, 6, 3, 1][rank], ga = [2, 4, 7, 10][rank];
    return { ...team, points: pts, wins: w, draws: d, losses: l, goals_for: gf, goals_against: ga };
  }
  return {
    A: groupA.map((t, i) => mockStats(t, i)),
    B: groupB.map((t, i) => mockStats(t, i)),
  };
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const { byGroup } = buildScheduleData();
  const standingsData = buildStandingsData();

  const fakeTournament = (name, template, season) => ({ name, template, season });

  for (const [template, channels] of Object.entries(CHANNELS)) {
    const tName = template === 'MCL' ? 'MCL Season 1' : 'NSEL Season 1';
    const tournament = fakeTournament(tName, template, 1);

    try {
      // ── 1. Schedule image ──────────────────────────────────────────────────
      console.log(`[${template}] Generating schedule image...`);
      const schedBuf = generateScheduleImage(1, 3, byGroup, teams, tournament);
      const schedCh = await client.channels.fetch(channels.matchSchedule);
      await schedCh.send({
        content: `**📅 SCHEDULE DEMO — ${template}**`,
        files: [new AttachmentBuilder(schedBuf, { name: 'schedule.png' })],
      });
      console.log(`[${template}] Schedule posted ✓`);

      // ── 2. Result image — Real Madrid 3–1 FC Barcelona ────────────────────
      console.log(`[${template}] Generating result image...`);
      const resCh = await client.channels.fetch(channels.results);

      const winMatch = {
        id: 1, home_team_id: groupA[0].id, away_team_id: groupA[1].id,
        home_score: 3, away_score: 1,
        stage: 'group', round: 1, group_name: 'A',
      };
      const resBuf = generateResultImage(winMatch, groupA[0], groupA[1], tournament);
      await resCh.send({
        content: `**🏆 RESULT DEMO — ${template}**`,
        files: [new AttachmentBuilder(resBuf, { name: 'result-win.png' })],
      });
      console.log(`[${template}] Win result posted ✓`);

      // Draw — Bayern Munich 2–2 PSG
      const drawMatch = {
        id: 2, home_team_id: groupA[2].id, away_team_id: groupA[3].id,
        home_score: 2, away_score: 2,
        stage: 'group', round: 1, group_name: 'A',
      };
      const drawBuf = generateResultImage(drawMatch, groupA[2], groupA[3], tournament);
      await resCh.send({
        content: `**🤝 DRAW RESULT DEMO — ${template}**`,
        files: [new AttachmentBuilder(drawBuf, { name: 'result-draw.png' })],
      });
      console.log(`[${template}] Draw result posted ✓`);

      // ── 3. Standings image ────────────────────────────────────────────────
      console.log(`[${template}] Generating standings image...`);
      const standBuf = generateStandingsImage(tournament, standingsData);
      await resCh.send({
        content: `**📊 STANDINGS DEMO — ${template}**`,
        files: [new AttachmentBuilder(standBuf, { name: 'standings.png' })],
      });
      console.log(`[${template}] Standings posted ✓`);

    } catch (err) {
      console.error(`[${template}] Error:`, err.message);
    }
  }

  console.log('\nAll demo images posted!');
  client.destroy();
});

client.login(env.DISCORD_TOKEN);
