const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildTeamListEmbed, buildTeamManageButtons } = require('../panels/teamListPanel');
const { buildTournamentListEmbed, buildTournamentButtons } = require('../panels/tournamentPanel');
const { getDB } = require('../utils/database');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Initial bot setup — creates all panels in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = interaction.channel;

      // Team List Panel
      await channel.send({
        embeds: [buildTeamListEmbed()],
        components: [buildTeamManageButtons()],
      });

      // Tournament Panel
      await channel.send({
        embeds: [buildTournamentListEmbed()],
        components: [buildTournamentButtons()],
      });

      // Save channel config
      const db = getDB();
      db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('panel_channel', ?)").run(channel.id);

      await interaction.editReply({
        embeds: [successEmbed('Setup Complete', `All panels have been created in <#${channel.id}>.\n\nManagers can now use the buttons to manage teams and tournaments.`)],
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ embeds: [errorEmbed('Setup Failed', err.message)] });
    }
  },
};
