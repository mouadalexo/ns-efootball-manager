const { EmbedBuilder } = require('discord.js');
const { db } = require('../utils/database');
const { COLORS } = require('../utils/embeds');

function buildGroupStandingsEmbed(tournamentId) {
  const tournament = db.findById('tournaments', tournamentId);
  if (!tournament) return null;

  const ttRows = db.get('tournament_teams').filter(tt => tt.tournament_id === tournamentId);
  const teams = db.get('teams');

  const rows = ttRows.map(tt => ({
    ...tt,
    ...teams.find(t => t.id === tt.team_id),
  })).sort((a, b) => {
    if (a.group_name !== b.group_name) return (a.group_name || 'A').localeCompare(b.group_name || 'A');
    const ptsDiff = (b.points || 0) - (a.points || 0);
    if (ptsDiff !== 0) return ptsDiff;
    return ((b.goals_for || 0) - (b.goals_against || 0)) - ((a.goals_for || 0) - (a.goals_against || 0));
  });

  const groups = {};
  for (const r of rows) {
    const g = r.group_name || 'A';
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`📊  ${tournament.name} — Group Standings`)
    .setTimestamp();

  if (!Object.keys(groups).length) {
    embed.setDescription('No standings yet. Generate groups first.');
    return embed;
  }

  for (const [groupName, gTeams] of Object.entries(groups)) {
    const lines = gTeams.map((t, i) => {
      const gd = (t.goals_for || 0) - (t.goals_against || 0);
      const qual = i < 2 ? '✅' : '  ';
      const name = (t.name || 'Unknown').padEnd(16).slice(0, 16);
      const pts = String(t.points || 0).padStart(3);
      const w = String(t.wins || 0).padStart(2);
      const d = String(t.draws || 0).padStart(2);
      const l = String(t.losses || 0).padStart(2);
      const gf = String(t.goals_for || 0).padStart(3);
      const ga = String(t.goals_against || 0).padStart(3);
      const gdStr = String(gd >= 0 ? `+${gd}` : gd).padStart(3);
      return `${qual} ${name} ${pts} ${w} ${d} ${l} ${gf} ${ga} ${gdStr}`;
    });
    embed.addFields({
      name: `Group ${groupName}`,
      value: '```\n  Team             Pts  W  D  L  GF  GA  GD\n' + lines.join('\n') + '\n```',
      inline: false,
    });
  }

  return embed;
}

function buildKnockoutBracketEmbed(tournamentId) {
  const tournament = db.findById('tournaments', tournamentId);
  if (!tournament) return null;

  const matches = db.get('matches').filter(m => m.tournament_id === tournamentId && m.stage === 'knockout');
  const teams = db.get('teams');
  const getTeam = id => teams.find(t => t.id === id) || { name: 'TBD', emoji: '⚽' };

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`🏆  ${tournament.name} — Knockout Bracket`)
    .setTimestamp();

  if (!matches.length) {
    embed.setDescription('No knockout matches yet. Complete group stage first.');
    return embed;
  }

  const rounds = {};
  for (const m of matches) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  }

  const roundNames = { 1: 'Final', 2: 'Semi-Finals', 4: 'Quarter-Finals', 8: 'Round of 16', 16: 'Round of 32', 32: 'Round of 64' };

  for (const [round, rMatches] of Object.entries(rounds).sort((a, b) => b[0] - a[0])) {
    const roundLabel = roundNames[round] || `Round ${round}`;
    const lines = rMatches.map(m => {
      const home = getTeam(m.home_team_id);
      const away = getTeam(m.away_team_id);
      const score = m.status === 'played' ? ` **${m.home_score}–${m.away_score}**` : ' *(pending)*';
      return `${home.emoji} ${home.name} vs ${away.emoji} ${away.name}${score}`;
    });
    embed.addFields({ name: `🔵 ${roundLabel}`, value: lines.join('\n'), inline: false });
  }

  return embed;
}

module.exports = { buildGroupStandingsEmbed, buildKnockoutBracketEmbed };
