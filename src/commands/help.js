const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Full guide for the NS eFootball Manager bot'),

  async execute(interaction) {
    const embeds = [

      new EmbedBuilder()
        .setColor(COLORS.gold)
        .setTitle('🏟️  NS eFootball Manager — Bot Guide')
        .setDescription(
          'Welcome to the **NS eFootball Manager** — a full Discord-based tournament system.\n\n' +
          'Everything runs through **panels and buttons**. No need to type commands for daily operations.'
        )
        .addFields(
          {
            name: '⚡ Quick Start',
            value:
              '1. Run `/setup nsel` in your NSEL management channel\n' +
              '2. Run `/setup mcl` in your MCL management channel\n' +
              '3. Use the posted panels to manage everything\n' +
              '4. Run `/demo mcl` to see a full live demo with random players',
          }
        )
        .setFooter({ text: 'Page 1/4 — Commands' }),

      new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle('📋  Slash Commands')
        .addFields(
          { name: '`/setup [template]`', value: 'Posts all panels for a tournament template (nsel / mcl / nsliga / nsf) in the configured channels. Run this once to get started.', inline: false },
          { name: '`/teamlist`', value: 'Re-posts the Team Database panel in the current channel.', inline: false },
          { name: '`/tournament`', value: 'Re-posts the Tournament Management panel in the current channel.', inline: false },
          { name: '`/standings [template]`', value: 'View live group standings and knockout bracket for any tournament.', inline: false },
          { name: '`/demo [template]`', value: 'Creates a demo tournament with random server members to preview how everything looks. Use `mcl` or `nsel`.', inline: false },
          { name: '`/help`', value: 'Shows this guide.', inline: false },
        )
        .setFooter({ text: 'Page 2/4 — Team System' }),

      new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle('👥  Team & Player System')
        .addFields(
          {
            name: '📋 Add from List',
            value: 'Opens a dropdown with all predefined clubs (international, Moroccan, Saudi). Select up to 10 at once — they appear instantly in the team list channel.',
          },
          {
            name: '➕ Add Custom Team',
            value: 'Opens a form to add any team by name, short code, and emoji. Good for community or custom clubs.',
          },
          {
            name: '👤 Add Player',
            value: 'Select a team → enter the player\'s Discord ID or @mention. The player is assigned to that team and the list updates in real time.',
          },
          {
            name: '🗑️ Remove Team',
            value: 'Removes a team and all its players from the database. Use with caution.',
          },
        )
        .setFooter({ text: 'Page 3/4 — Tournaments' }),

      new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('🏆  Tournament System')
        .addFields(
          {
            name: '➕ Create Tournament',
            value: 'Choose a template (NSEL / MCL / NSLIGA / NSF) → fill in the name, team count, and group size. Seasons increment automatically (Season 1, 2, 3...).',
          },
          {
            name: '⚙️ Manage Tournament',
            value:
              '**Add Teams** — select teams from the database to enroll.\n' +
              '**Generate Groups** — randomly splits teams into groups (A, B, C...). ✅ marks the top 2 qualifiers.\n' +
              '**Generate Matches** — creates all group stage fixtures automatically.\n' +
              '**Start Knockout** — takes top 2 from each group, draws the bracket. Finals are Home & Away (2 legs).',
          },
          {
            name: '📊 Add Result',
            value: 'Select tournament → select match → enter scores. Group standings update instantly. A result card is posted in the results channel.',
          },
          {
            name: '📋 View Bracket',
            value: 'Shows the knockout bracket with all match results and remaining fixtures.',
          },
          {
            name: '🏟️  Tournament Templates',
            value:
              '🏆 **NSEL** — Solo | Group + Knockout | Finals Home & Away\n' +
              '⚡ **MCL** — Duo | Group + Knockout | Finals Home & Away\n' +
              '🥇 **NSLIGA** — Official league (expandable)\n' +
              '🏅 **NSF** — Official cup (expandable)',
          },
        )
        .setFooter({ text: 'Page 4/4 — Channel Setup' }),

      new EmbedBuilder()
        .setColor(COLORS.purple)
        .setTitle('📡  Channel Configuration')
        .setDescription(
          'The bot posts to **specific channels per template**. Each template (NSEL, MCL) can have its own set of channels.\n\n' +
          'Run `/setup nsel` or `/setup mcl` to post panels. The bot auto-detects channels by searching your configured category.\n\n' +
          '**Expected channel names inside each category:**\n' +
          '```\n' +
          '📋  team-list     → Team Database panel\n' +
          '📅  match-schedule → Match fixtures\n' +
          '📊  results        → Match result cards\n' +
          '🏆  standings      → Group tables & bracket\n' +
          '```\n' +
          'If your channels have different names, use `/setup` in any channel and the bot will post there directly.'
        )
        .addFields({
          name: '⚠️ Manager Permissions',
          value: 'Buttons that modify data (add teams, enter results, create tournaments) require the **Manage Server** permission, **Administrator**, or a role named **manager**, **admin**, or **tournament**.',
        })
        .setFooter({ text: 'NS eFootball Manager — Built by Replit' }),
    ];

    await interaction.reply({ embeds: embeds, ephemeral: false });
  },
};
