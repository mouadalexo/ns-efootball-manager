'use strict';
const https = require('https');
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
const { E } = require('/home/ubuntu/goatsi/src/utils/embeds');

const CHANNEL_MAP = {
  NSEL: '1462982588661628938',
  MCL:  '1463154002660429885',
};

const ACCENT_COLOR = 0xff0000;
const DIVIDER = { type: 14, spacing: 1, divider: true };

function discordPost(token, channelId, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'discord.com',
      path: `/api/v10/channels/${channelId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(buf));
        else reject(new Error(`HTTP ${res.statusCode}: ${buf}`));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function postSeasonList(token, template) {
  const channelId = CHANNEL_MAP[template];

  const tournament = db.get('tournaments')
    .filter(t => t.status !== 'finished' && t.template === template)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  if (!tournament) {
    console.log(`[SKIP] No active ${template} tournament found`);
    return;
  }

  const teams   = db.get('teams');
  const players = db.get('players');
  const ttEntries = db.get('tournament_teams').filter(tt => tt.tournament_id === tournament.id);

  if (!ttEntries.length) {
    console.log(`[SKIP] No teams enrolled in ${template} tournament`);
    return;
  }

  const enrolledTeams = [];
  for (const tt of ttEntries) {
    const team = teams.find(t => t.id === tt.team_id);
    if (!team) continue;
    const teamPlayers = players.filter(p => p.team_id === tt.team_id);
    enrolledTeams.push({ team, players: teamPlayers });
  }

  const isDuo = tournament.type === 'duo' || tournament.template === 'MCL';
  const typeLabel = isDuo ? 'duos' : 'players';

  const innerComponents = [];

  innerComponents.push({
    type: 10,
    content: `## ${E.cup}  ${tournament.name}  —  Teams List\n${E.channel}  **${enrolledTeams.length} ${typeLabel}** registered for this season`,
  });

  for (let i = 0; i < enrolledTeams.length; i++) {
    const { team, players: tp } = enrolledTeams[i];

    innerComponents.push(DIVIDER);

    const lines = [`${E.arrow}  **${i + 1}. ${team.name}**`];
    const pLabel = (n) => n === 1 ? `Player 1\u2007` : `Player ${n} `;

    if (tp.length === 0) {
      lines.push(`${pLabel(1)}${E.smallarrow}  *No player assigned*`);
      if (isDuo) lines.push(`${pLabel(2)}${E.smallarrow}  *No player assigned*`);
    } else {
      tp.forEach((p, idx) => {
        lines.push(`${pLabel(idx + 1)}${E.smallarrow}  <@${p.discord_id}>`);
      });
      if (isDuo && tp.length === 1) {
        lines.push(`${pLabel(2)}${E.smallarrow}  *No player assigned*`);
      }
    }

    innerComponents.push({ type: 10, content: lines.join('\n') });
  }

  innerComponents.push(DIVIDER);
  innerComponents.push({
    type: 10,
    content: `-# © ${new Date().getFullYear()} NS eFootball  •  ${template} Season ${tournament.season}`,
  });

  const container = {
    type: 17,
    accent_color: ACCENT_COLOR,
    spoiler: false,
    components: innerComponents,
  };

  await discordPost(token, channelId, { components: [container], flags: 32768 });

  console.log(`[OK] Posted season list for ${template} Season ${tournament.season} → channel ${channelId}`);
}

(async () => {
  await postSeasonList(env.DISCORD_TOKEN, 'MCL');
  await postSeasonList(env.DISCORD_TOKEN, 'NSEL');
})();
