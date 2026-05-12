const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildTeamListEmbed, buildTeamManageButtons } = require('../panels/teamListPanel');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('teamlist')
    .setDescription('Post the Team List management panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      await interaction.channel.send({
        embeds: [buildTeamListEmbed()],
        components: [buildTeamManageButtons()],
      });
      await interaction.editReply({ content: '✅ Team List panel posted.', ephemeral: true });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Error', err.message)] });
    }
  },
};
