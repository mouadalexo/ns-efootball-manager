const {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { db } = require('../utils/database');
const { COLORS } = require('../utils/embeds');

function buildPendingMatchesSelect(tournamentId) {
  const matches = db.get('matches').filter(m => m.tournament_id === tournamentId && m.status === 'pending');
  if (!matches.length) return null;

  const teams = db.get('teams');
  const getTeam = id => teams.find(t => t.id === id) || { name: 'Unknown', emoji: '⚽' };

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`match_select_${tournamentId}`)
      .setPlaceholder('Select a match to add result...')
      .addOptions(matches.slice(0, 25).map(m => {
        const home = getTeam(m.home_team_id);
        const away = getTeam(m.away_team_id);
        return {
          label: `${home.name} vs ${away.name}`,
          value: String(m.id),
          description: `${m.stage} | Round ${m.round} | Leg ${m.leg}`,
          emoji: '⚽',
        };
      }))
  );
}

function buildResultModal(matchId) {
  return new ModalBuilder()
    .setCustomId(`result_modal_${matchId}`)
    .setTitle('Enter Match Result')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('home_score').setLabel('Home Team Score').setStyle(TextInputStyle.Short).setPlaceholder('0').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('away_score').setLabel('Away Team Score').setStyle(TextInputStyle.Short).setPlaceholder('0').setRequired(true)
      ),
    );
}

function buildResultEmbed(match, tournament) {
  const teams = db.get('teams');
  const home = teams.find(t => t.id === match.home_team_id) || { name: 'Home', emoji: '⚽' };
  const away = teams.find(t => t.id === match.away_team_id) || { name: 'Away', emoji: '⚽' };

  const homeWon = match.home_score > match.away_score;
  const awayWon = match.away_score > match.home_score;
  const draw = match.home_score === match.away_score;

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle('⚽  Match Result')
    .setDescription(`**${tournament.name}** — ${match.stage.toUpperCase()} Round ${match.round}${match.leg > 1 ? ` (Leg ${match.leg})` : ''}`)
    .addFields(
      { name: `${home.emoji} ${home.name}`, value: `**${match.home_score}**${homeWon ? ' 🏆' : ''}`, inline: true },
      { name: draw ? '🤝 Draw' : '⚡', value: '—', inline: true },
      { name: `${away.emoji} ${away.name}`, value: `**${match.away_score}**${awayWon ? ' 🏆' : ''}`, inline: true },
    )
    .setTimestamp();
}

module.exports = { buildPendingMatchesSelect, buildResultModal, buildResultEmbed };
