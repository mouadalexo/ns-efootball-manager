const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../utils/database');
const { COLORS, E } = require('../utils/embeds');

function buildGroupStandingsEmbed(tournamentId) {
  const tournament = db.findById('tournaments', tournamentId);
  if (!tournament) return null;

  const ttRows = db.get('tournament_teams').filter(tt => tt.tournament_id === tournamentId);
  const teams  = db.get('teams');

  const rows = ttRows.map(tt => ({
    ...tt,
    ...teams.find(t => t.id === tt.team_id),
  }));

  const groups = {};
  for (const r of rows) {
    const g = r.group_name || 'A';
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  }

  for (const g of Object.keys(groups)) {
    groups[g].sort((a, b) => {
      const pd = (b.points || 0) - (a.points || 0);
      if (pd !== 0) return pd;
      return ((b.goals_for || 0) - (b.goals_against || 0)) - ((a.goals_for || 0) - (a.goals_against || 0));
    });
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${E.cup}  ${tournament.name}  —  Group Standings`)
    .setDescription(`✅  Top 2 advance to Knockout Stage     ❌  Eliminated`)
    .setTimestamp();

  for (const [groupName, gTeams] of Object.entries(groups).sort()) {
    const lines = gTeams.map((t, i) => {
      const gd    = (t.goals_for || 0) - (t.goals_against || 0);
      const gdStr = (gd >= 0 ? '+' : '') + gd;
      const qual  = i < 2 ? '✅' : '❌';
      const pts   = t.points || 0;
      const w = t.wins || 0, d = t.draws || 0, l = t.losses || 0;
      return `${qual}  **${i + 1}.  ${t.name || 'Unknown'}**\n　　\`${pts} pts\`  ·  ${w}W  ${d}D  ${l}L  ·  GD  \`${gdStr}\``;
    });
    embed.addFields({
      name: `${E.hashtag}  GROUP ${groupName}`,
      value: lines.join('\n\n'),
      inline: false,
    });
  }

  return embed;
}

function buildStandingsRow(tournamentId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`view_results_${tournamentId}`)
      .setLabel('View All Results')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: '1501741159557500971', name: 'cup', animated: true }),
  );
}

function buildKnockoutBracketEmbed(tournamentId) {
  const tournament = db.findById('tournaments', tournamentId);
  if (!tournament) return null;

  const matches = db.get('matches').filter(m => m.tournament_id === tournamentId && m.stage === 'knockout');
  const teams   = db.get('teams');
  const getTeam = id => teams.find(t => t.id === id) || { name: 'TBD' };

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`${E.crown}  ${tournament.name}  —  Knockout Bracket`)
    .setTimestamp();

  if (!matches.length) {
    embed.setDescription('No knockout matches yet. Complete the group stage first.');
    return embed;
  }

  const rounds = {};
  for (const m of matches) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  }

  const roundNames = { 1: 'Final', 2: 'Semi-Finals', 4: 'Quarter-Finals', 8: 'Round of 16' };

  for (const [round, rMatches] of Object.entries(rounds).sort((a, b) => b[0] - a[0])) {
    const label = roundNames[round] || `Round ${round}`;
    const lines = rMatches.map(m => {
      const home  = getTeam(m.home_team_id);
      const away  = getTeam(m.away_team_id);
      const score = m.status === 'played' ? `  **${m.home_score} — ${m.away_score}**` : '  *(pending)*';
      return `${E.arrow}  **${home.name}**  vs  **${away.name}**${score}`;
    });
    embed.addFields({ name: `${E.channel}  ${label}`, value: lines.join('\n'), inline: false });
  }

  return embed;
}

module.exports = { buildGroupStandingsEmbed, buildStandingsRow, buildKnockoutBracketEmbed };
