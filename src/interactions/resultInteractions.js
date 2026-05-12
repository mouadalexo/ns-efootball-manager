const { db } = require('../utils/database');
const { requireManager } = require('../utils/permissions');
const { successEmbed, errorEmbed, warningEmbed, E } = require('../utils/embeds');
const { buildPendingMatchesSelect, buildResultModal, buildAllResultsEmbed } = require('../panels/resultsPanel');
const { buildTournamentSelectMenu } = require('../panels/tournamentPanel');
const { buildGroupStandingsEmbed, buildStandingsRow } = require('../panels/standingsPanel');
const { getTargetChannel } = require('../utils/channelRouter');

async function handleResultInteraction(interaction, client) {
  const id = interaction.customId;

  // ── View All Results button (ephemeral) ────────────────────────────────────
  if (id.startsWith('view_results_')) {
    const tournamentId = parseInt(id.replace('view_results_', ''));
    const embed = buildAllResultsEmbed(tournamentId);
    if (!embed) return interaction.reply({ embeds: [warningEmbed('No Results', 'No results recorded yet.')], ephemeral: true });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── Select tournament to add result ───────────────────────────────────────
  if (id === 'tournament_results') {
    if (!requireManager(interaction.member)) return noPermission(interaction);
    const menu = buildTournamentSelectMenu('Select a tournament to add result...', 'result_tournament_select');
    if (!menu) return interaction.reply({ embeds: [warningEmbed('No Tournaments', 'No active tournaments found.')], ephemeral: true });
    return interaction.reply({ content: `${E.cup}  Select a tournament:`, components: [menu], ephemeral: true });
  }

  if (id === 'result_tournament_select') {
    const tournamentId = parseInt(interaction.values[0]);
    const matchMenu = buildPendingMatchesSelect(tournamentId);
    if (!matchMenu) return interaction.update({ content: '✅  No pending matches in this tournament.', components: [] });
    return interaction.update({ content: `${E.arrow}  Select a match:`, components: [matchMenu] });
  }

  if (id.startsWith('match_select_')) {
    const matchId = parseInt(interaction.values[0]);
    return interaction.showModal(buildResultModal(matchId));
  }

  // ── Submit result modal ────────────────────────────────────────────────────
  if (id.startsWith('result_modal_')) {
    if (!requireManager(interaction.member)) return noPermission(interaction);

    const matchId   = parseInt(id.replace('result_modal_', ''));
    const homeScore = parseInt(interaction.fields.getTextInputValue('home_score'));
    const awayScore = parseInt(interaction.fields.getTextInputValue('away_score'));

    if (isNaN(homeScore) || isNaN(awayScore)) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Score', 'Scores must be numbers.')], ephemeral: true });
    }

    const match = db.findById('matches', matchId);
    if (!match) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Match not found.')], ephemeral: true });

    const tournament = db.findById('tournaments', match.tournament_id);

    db.update('matches', matchId, {
      home_score: homeScore,
      away_score: awayScore,
      status: 'played',
      played_at: new Date().toISOString(),
    });

    // Update tournament_teams standings
    if (match.stage === 'group') {
      const homeWon = homeScore > awayScore;
      const awayWon = awayScore > homeScore;
      const draw    = homeScore === awayScore;

      for (const [teamId, scored, conceded, won, lost] of [
        [match.home_team_id, homeScore, awayScore, homeWon, awayWon],
        [match.away_team_id, awayScore, homeScore, awayWon, homeWon],
      ]) {
        const tt = db.findOne('tournament_teams', r => r.tournament_id === match.tournament_id && r.team_id === teamId);
        if (tt) db.update('tournament_teams', tt.id, {
          goals_for:     (tt.goals_for     || 0) + scored,
          goals_against: (tt.goals_against || 0) + conceded,
          wins:          (tt.wins          || 0) + (won  ? 1 : 0),
          draws:         (tt.draws         || 0) + (draw ? 1 : 0),
          losses:        (tt.losses        || 0) + (lost ? 1 : 0),
          points:        (tt.points        || 0) + (won ? 3 : draw ? 1 : 0),
        });
      }

      // Post updated standings (with View Results button) to results channel
      const resultsCh = await getTargetChannel(interaction.guild, tournament.template, 'results');
      if (resultsCh) {
        const standingsEmbed = buildGroupStandingsEmbed(match.tournament_id);
        const row            = buildStandingsRow(match.tournament_id);

        // Try to edit pinned standings message; otherwise post new
        const storedMsgId = db.getConfig(`standings_msg_${match.tournament_id}`);
        let posted = false;
        if (storedMsgId) {
          try {
            const old = await resultsCh.messages.fetch(storedMsgId);
            await old.edit({ embeds: [standingsEmbed], components: [row] });
            posted = true;
          } catch (_) {}
        }
        if (!posted) {
          const msg = await resultsCh.send({ embeds: [standingsEmbed], components: [row] });
          db.setConfig(`standings_msg_${match.tournament_id}`, msg.id);
        }
      }
    }

    const home = db.get('teams').find(t => t.id === match.home_team_id) || { name: 'Home' };
    const away = db.get('teams').find(t => t.id === match.away_team_id) || { name: 'Away' };

    return interaction.reply({
      embeds: [successEmbed('Result Recorded',
        `${E.fire}  **${home.name}  ${homeScore} — ${awayScore}  ${away.name}**\nStandings updated in results channel.`
      )],
      ephemeral: true,
    });
  }
}

function noPermission(interaction) {
  return interaction.reply({ embeds: [warningEmbed('No Permission', 'Only managers can add results.')], ephemeral: true });
}

module.exports = { handleResultInteraction };
