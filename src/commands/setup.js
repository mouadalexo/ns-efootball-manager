const {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
} = require('discord.js');
const { buildTeamListEmbed, buildTeamManageButtons } = require('../panels/teamListPanel');
const { buildTournamentListEmbed, buildTournamentButtons } = require('../panels/tournamentPanel');
const { db } = require('../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../utils/embeds');

// Hardcoded channel/category IDs provided by server owner
const TEMPLATE_CHANNELS = {
  NSEL: {
    category: '1462982041703547023',
    teamList:      '1462982588661628938',
    results:       '1463162274192556072',
    matchSchedule: '1462982363267993672',
  },
  MCL: {
    category: '1463153310943936532',
    // MCL channels resolved by name within the MCL category
    teamListName:      'team-list',
    resultsName:       'results',
    matchScheduleName: 'match-schedule',
  },
};

async function resolveChannel(guild, templateKey, type) {
  const cfg = TEMPLATE_CHANNELS[templateKey];
  if (!cfg) return null;

  // NSEL: use hardcoded IDs
  if (templateKey === 'NSEL') {
    const ids = { teamList: cfg.teamList, results: cfg.results, matchSchedule: cfg.matchSchedule };
    return guild.channels.cache.get(ids[type]) || null;
  }

  // MCL (and others): find channel by name inside the category
  const nameMap = {
    teamList:      cfg.teamListName      || 'team-list',
    results:       cfg.resultsName       || 'results',
    matchSchedule: cfg.matchScheduleName || 'match-schedule',
  };
  const targetName = nameMap[type];
  return guild.channels.cache.find(c =>
    c.parentId === cfg.category &&
    c.name.toLowerCase().includes(targetName.toLowerCase()) &&
    c.type === ChannelType.GuildText
  ) || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Post panels for a tournament template in their designated channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt.setName('template')
        .setDescription('Tournament template to set up (default: all)')
        .setRequired(false)
        .addChoices(
          { name: 'NSEL', value: 'NSEL' },
          { name: 'MCL',  value: 'MCL'  },
          { name: 'All',  value: 'ALL'  },
        )
    ),

  resolveChannel,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const template = (interaction.options.getString('template') || 'ALL').toUpperCase();
    const templates = template === 'ALL' ? ['NSEL', 'MCL'] : [template];
    const results = [];

    for (const tmpl of templates) {
      const cfg = TEMPLATE_CHANNELS[tmpl];
      if (!cfg) {
        results.push(`❌ Unknown template: ${tmpl}`);
        continue;
      }

      let teamListCh, resultsCh, scheduleCh;

      if (tmpl === 'NSEL') {
        teamListCh    = interaction.guild.channels.cache.get(cfg.teamList);
        resultsCh     = interaction.guild.channels.cache.get(cfg.results);
        scheduleCh    = interaction.guild.channels.cache.get(cfg.matchSchedule);
      } else {
        // Resolve by name inside category
        const chans = interaction.guild.channels.cache.filter(c => c.parentId === cfg.category && c.type === ChannelType.GuildText);
        teamListCh  = chans.find(c => c.name.includes('team') || c.name.includes('list') || c.name.includes('équipe'));
        resultsCh   = chans.find(c => c.name.includes('result') || c.name.includes('score'));
        scheduleCh  = chans.find(c => c.name.includes('match') || c.name.includes('schedule') || c.name.includes('fixture'));
      }

      // Store channel config in db
      db.setConfig(`${tmpl}_teamList`,      teamListCh?.id  || null);
      db.setConfig(`${tmpl}_results`,       resultsCh?.id   || null);
      db.setConfig(`${tmpl}_matchSchedule`, scheduleCh?.id  || null);

      const posted = [];

      // Post team list panel
      if (teamListCh) {
        try {
          await teamListCh.send({ embeds: [buildTeamListEmbed()], components: [buildTeamManageButtons()] });
          posted.push(`✅ Team list → <#${teamListCh.id}>`);
        } catch (e) {
          posted.push(`❌ Team list: ${e.message}`);
        }
      } else {
        // fallback: post in current channel
        await interaction.channel.send({ embeds: [buildTeamListEmbed()], components: [buildTeamManageButtons()] });
        posted.push(`✅ Team list → (this channel, no dedicated channel found)`);
        db.setConfig(`${tmpl}_teamList`, interaction.channelId);
      }

      // Post tournament panel in current channel (management channel)
      try {
        await interaction.channel.send({ embeds: [buildTournamentListEmbed()], components: [buildTournamentButtons()] });
        posted.push(`✅ Tournament panel → <#${interaction.channelId}>`);
        db.setConfig(`${tmpl}_management`, interaction.channelId);
      } catch (e) {
        posted.push(`❌ Tournament panel: ${e.message}`);
      }

      // Post placeholder header in results + schedule channels
      if (resultsCh) {
        try {
          const { infoEmbed } = require('../utils/embeds');
          const { EmbedBuilder } = require('discord.js');
          const { COLORS } = require('../utils/embeds');
          await resultsCh.send({
            embeds: [new EmbedBuilder()
              .setColor(COLORS.gold)
              .setTitle(`📊  ${tmpl} — Match Results`)
              .setDescription('Match results will be posted here automatically when a manager enters a score.')
              .setTimestamp()],
          });
          posted.push(`✅ Results → <#${resultsCh.id}>`);
        } catch (e) { posted.push(`❌ Results: ${e.message}`); }
      } else { posted.push(`⚠️ Results channel not found (will post in management channel)`); }

      if (scheduleCh) {
        try {
          const { EmbedBuilder } = require('discord.js');
          const { COLORS } = require('../utils/embeds');
          await scheduleCh.send({
            embeds: [new EmbedBuilder()
              .setColor(COLORS.info)
              .setTitle(`📅  ${tmpl} — Match Schedule`)
              .setDescription('Fixtures will be posted here automatically when a tournament\'s match schedule is generated.')
              .setTimestamp()],
          });
          posted.push(`✅ Match schedule → <#${scheduleCh.id}>`);
        } catch (e) { posted.push(`❌ Match schedule: ${e.message}`); }
      } else { posted.push(`⚠️ Match schedule channel not found (will post in management channel)`); }

      results.push(`\n**${tmpl}**\n${posted.join('\n')}`);
    }

    await interaction.editReply({
      embeds: [successEmbed('Setup Complete', results.join('\n\n'))],
    });
  },
};
