const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildTournamentListEmbed, buildTournamentButtons } = require('../panels/tournamentPanel');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Post the Tournament management panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      await interaction.channel.send({
        embeds: [buildTournamentListEmbed()],
        components: [buildTournamentButtons()],
      });
      await interaction.editReply({ content: '✅ Tournament panel posted.', ephemeral: true });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Error', err.message)] });
    }
  },
};
