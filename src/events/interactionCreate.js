const { errorEmbed } = require('../utils/embeds');
const { handleTeamInteraction } = require('../interactions/teamInteractions');
const { handleTournamentInteraction } = require('../interactions/tournamentInteractions');
const { handleResultInteraction } = require('../interactions/resultInteractions');
const { buildGroupStandingsEmbed, buildKnockoutBracketEmbed } = require('../panels/standingsPanel');

const TEAM_IDS = ['team_add_predefined', 'team_predefined_select', 'team_add_custom', 'custom_team_modal', 'team_add_player', 'team_select', 'team_remove', 'team_remove_select'];

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction, client);
        return;
      }

      const id = interaction.customId || '';

      if (TEAM_IDS.includes(id) || id.startsWith('player_add_modal_')) {
        return handleTeamInteraction(interaction, client);
      }

      if (id === 'tournament_results' || id === 'result_tournament_select' || id.startsWith('match_select_') || id.startsWith('result_modal_')) {
        return handleResultInteraction(interaction, client);
      }

      if (
        id === 'tournament_create' || id === 'template_select' || id.startsWith('tournament_create_modal_') ||
        id === 'tournament_manage' || id === 'tournament_bracket' ||
        id.startsWith('tmt_')
      ) {
        return handleTournamentInteraction(interaction, client);
      }

      // Standings: tournament selected from /standings command
      if (id === 'tournament_select') {
        const tournamentId = parseInt(interaction.values[0]);
        const groupEmbed = buildGroupStandingsEmbed(tournamentId);
        const bracketEmbed = buildKnockoutBracketEmbed(tournamentId);
        const embeds = [groupEmbed, bracketEmbed].filter(Boolean);
        return interaction.update({ content: null, embeds: embeds.length ? embeds : undefined, components: [] });
      }

      // Manage: tournament selected
      if (id === 'tournament_select_manage') {
        return handleTournamentInteraction({ ...interaction, customId: 'tournament_select' }, client);
      }

    } catch (err) {
      console.error('[Interaction Error]', err);
      const payload = { embeds: [errorEmbed('Something went wrong', err.message)], ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};
