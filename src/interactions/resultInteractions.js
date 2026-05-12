const { db } = require('../utils/database');
const { requireManager } = require('../utils/permissions');
const { successEmbed, errorEmbed, warningEmbed } = require('../utils/embeds');
const { buildPendingMatchesSelect, buildResultModal, buildResultEmbed } = require('../panels/resultsPanel');
const { buildTournamentSelectMenu } = require('../panels/tournamentPanel');
const { buildGroupStandingsEmbed } = require('../panels/standingsPanel');
const { getTargetChannel } = require('../utils/channelRouter');

async function handleResultInteraction(interaction, client) {
  const id = interaction.customId;

  if (id === 'tournament_results') {
    if (!requireManager(interaction.member)) return noPermission(interaction);
    const menu = buildTournamentSelectMenu('Select a tournament to add result...', 'result_tournament_select');
    if (!menu) return interaction.reply({ embeds: [warningEmbed('No Tournaments', 'No active tournaments found.')], ephemeral: true });
    return interaction.reply({ content: '📊 Select a tournament:', components: [menu], ephemeral: true });
  }

  if (id === 'result_tournament_select') {
    const tournamentId = parseInt(interaction.values[0]);
    const matchMenu = buildPendingMatchesSelect(tournamentId);
    if (!matchMenu) return interaction.update({ content: '✅ No pending matches in this tournament.', components: [] });
    return interaction.update({ content: '⚽ Select a match:', components: [matchMenu] });
  }

  if (id.startsWith('match_select_')) {
    const matchId = parseInt(interaction.values[0]);
    return interaction.showModal(buildResultModal(matchId));
  }

  if (id.startsWith('result_modal_')) {
    if (!requireManager(interaction.member)) return noPermission(interaction);
    const matchId = parseInt(id.replace('result_modal_', ''));
    const homeScore = parseInt(interaction.fields.getTextInputValue('home_score'));
    const awayScore = parseInt(interaction.fields.getTextInputValue('away_score'));

    if (isNaN(homeScore) || isNaN(awayScore)) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Score', 'Scores must be numbers.')], ephemeral: true });
    }

    const match = db.findById('matches', matchId);
    if (!match) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Match not found.')], ephemeral: true });

    const tournament = db.findById('tournaments', match.tournament_id);
    db.update('matches', matchId, { home_score: homeScore, away_score: awayScore, status: 'played', played_at: new Date().toISOString() });

    if (match.stage === 'group') {
      const homeWon = homeScore > awayScore;
      const awayWon = awayScore > homeScore;
      const draw = homeScore === awayScore;

      const homeTT = db.findOne('tournament_teams', tt => tt.tournament_id === match.tournament_id && tt.team_id === match.home_team_id);
      const awayTT = db.findOne('tournament_teams', tt => tt.tournament_id === match.tournament_id && tt.team_id === match.away_team_id);

      if (homeTT) db.update('tournament_teams', homeTT.id, {
        goals_for: (homeTT.goals_for || 0) + homeScore,
        goals_against: (homeTT.goals_against || 0) + awayScore,
        wins: (homeTT.wins || 0) + (homeWon ? 1 : 0),
        draws: (homeTT.draws || 0) + (draw ? 1 : 0),
        losses: (homeTT.losses || 0) + (awayWon ? 1 : 0),
        points: (homeTT.points || 0) + (homeWon ? 3 : draw ? 1 : 0),
      });
      if (awayTT) db.update('tournament_teams', awayTT.id, {
        goals_for: (awayTT.goals_for || 0) + awayScore,
        goals_against: (awayTT.goals_against || 0) + homeScore,
        wins: (awayTT.wins || 0) + (awayWon ? 1 : 0),
        draws: (awayTT.draws || 0) + (draw ? 1 : 0),
        losses: (awayTT.losses || 0) + (homeWon ? 1 : 0),
        points: (awayTT.points || 0) + (awayWon ? 3 : draw ? 1 : 0),
      });
    }

    // Post result to the correct results channel for this template
    const updatedMatch = db.findById('matches', matchId);
    const resultEmbed = buildResultEmbed(updatedMatch, tournament);

    const resultsCh = await getTargetChannel(interaction.guild, tournament.template, 'results');
    const postCh = resultsCh || interaction.channel;
    await postCh.send({ embeds: [resultEmbed] });

    // Post updated standings to match schedule channel
    if (match.stage === 'group') {
      const standingsEmbed = buildGroupStandingsEmbed(match.tournament_id);
      if (standingsEmbed) {
        const scheduleCh = await getTargetChannel(interaction.guild, tournament.template, 'matchSchedule') || interaction.channel;
        await scheduleCh.send({ embeds: [standingsEmbed] });
      }
    }

    return interaction.reply({
      embeds: [successEmbed('Result Added',
        `Score recorded: **${homeScore}–${awayScore}**\n` +
        `Posted to <#${postCh.id}>`
      )],
      ephemeral: true,
    });
  }
}

function noPermission(interaction) {
  return interaction.reply({ embeds: [warningEmbed('No Permission', 'Only managers can add results.')], ephemeral: true });
}

module.exports = { handleResultInteraction };
