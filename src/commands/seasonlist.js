const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../utils/database');
const { E } = require('../utils/embeds');
const { getTargetChannel } = require('../utils/channelRouter');

const ACCENT_COLOR = 0xff0000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seasonlist')
    .setDescription('Post the season team list using Discord Components V2 with real dividers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt.setName('template')
        .setDescription('Tournament template')
        .setRequired(false)
        .addChoices(
          { name: 'MCL', value: 'MCL' },
          { name: 'NSEL', value: 'NSEL' },
        )
    )
    .addIntegerOption(opt =>
      opt.setName('tournament_id')
        .setDescription('Specific tournament ID (optional — defaults to latest active)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      let tournament;
      const tid = interaction.options.getInteger('tournament_id');
      const tmplFilter = interaction.options.getString('template');

      if (tid) tournament = db.findById('tournaments', tid);
      if (!tournament) {
        tournament = db.get('tournaments')
          .filter(t => t.status !== 'finished')
          .filter(t => !tmplFilter || t.template === tmplFilter)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      }
      if (!tournament) {
        return interaction.editReply({ content: '❌ No active tournament found. Create one first.' });
      }

      const teams     = db.get('teams');
      const players   = db.get('players');
      const ttEntries = db.get('tournament_teams').filter(tt => tt.tournament_id === tournament.id);

      if (!ttEntries.length) {
        return interaction.editReply({ content: '❌ No teams enrolled in this tournament yet.' });
      }

      const enrolledTeams = [];
      for (const tt of ttEntries) {
        const team = teams.find(t => t.id === tt.team_id);
        if (!team) continue;
        const teamPlayers = players.filter(p => p.team_id === tt.team_id);
        enrolledTeams.push({ team, players: teamPlayers });
      }

      const isDuo     = tournament.type === 'duo' || tournament.template === 'MCL';
      const typeLabel = isDuo ? 'duos' : 'players';
      const targetCh  = await getTargetChannel(interaction.guild, tournament.template, 'teamList') || interaction.channel;

      const DIVIDER = { type: 14, spacing: 1, divider: true };
      const innerComponents = [];

      // Header
      innerComponents.push({
        type: 10,
        content: `## ${E.cup}  ${tournament.name}  —  Teams List\n${E.channel}  **${enrolledTeams.length} ${typeLabel}** registered for this season`,
      });

      for (let i = 0; i < enrolledTeams.length; i++) {
        const { team, players: tp } = enrolledTeams[i];

        innerComponents.push(DIVIDER);

        // Arrow at column 0 on every line so they stack perfectly
        // Line 1: big arrow → team name (bold)
        // Line 2+: small arrow → player mention
        const lines = [`${E.arrow}  **${i + 1}. ${team.name}**`];

        // \u2007 is a figure space (same width as a digit) — keeps arrows aligned
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

      // Footer
      innerComponents.push(DIVIDER);
      innerComponents.push({
        type: 10,
        content: `-# © ${new Date().getFullYear()} NS eFootball  •  ${tournament.template} Season ${tournament.season}`,
      });

      const container = {
        type: 17,
        accent_color: ACCENT_COLOR,
        spoiler: false,
        components: innerComponents,
      };

      const { REST } = require('@discordjs/rest');
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

      await rest.post(`/channels/${targetCh.id}/messages`, {
        body: { components: [container], flags: 32768 },
      });

      await interaction.editReply({
        content: `✅ Season list posted to <#${targetCh.id}> — **${enrolledTeams.length} teams**.`,
      });

    } catch (err) {
      console.error('[SEASONLIST ERROR]', err);
      await interaction.editReply({ content: `❌ Error: ${err.message}` });
    }
  },
};
