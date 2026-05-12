const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../utils/database');
const { COLORS, successEmbed, errorEmbed } = require('../utils/embeds');
const { buildTeamListEmbed, buildTeamManageButtons } = require('../panels/teamListPanel');
const { buildTournamentListEmbed, buildTournamentButtons } = require('../panels/tournamentPanel');
const { buildGroupStandingsEmbed, buildKnockoutBracketEmbed } = require('../panels/standingsPanel');
const { TEMPLATES } = require('../panels/tournamentPanel');
const { getTargetChannel } = require('../utils/channelRouter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demo')
    .setDescription('Creates a demo tournament with random server members to preview everything')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt.setName('template')
        .setDescription('Which tournament to demo')
        .setRequired(false)
        .addChoices(
          { name: 'MCL (Duo)', value: 'MCL' },
          { name: 'NSEL (Solo)', value: 'NSEL' },
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const template = (interaction.options.getString('template') || 'MCL').toUpperCase();
    const tmpl = TEMPLATES[template];

    try {
      // ─── Step 1: fetch random server members ───────────────────────────────
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🔄  Demo Running...').setDescription('**Step 1/6** — Fetching server members...')]
      });

      const members = await interaction.guild.members.fetch({ limit: 100 });
      const humans = members.filter(m => !m.user.bot).map(m => m);
      const shuffled = [...humans].sort(() => Math.random() - 0.5).slice(0, 16);

      // ─── Step 2: pick 8 teams for MCL (16 teams for NSEL) ──────────────────
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🔄  Demo Running...').setDescription('**Step 2/6** — Selecting teams and registering players...')]
      });

      const teamCount = template === 'MCL' ? 8 : 16;
      const groupSize = 4;
      const allTeams = db.get('teams').sort(() => Math.random() - 0.5).slice(0, teamCount);

      if (allTeams.length < teamCount) {
        return interaction.editReply({ embeds: [errorEmbed('Not Enough Teams', `Need ${teamCount} teams in the database. Add more teams first.`)] });
      }

      // Register players to teams (2 players per team for MCL, 1 for NSEL)
      const playersPerTeam = template === 'MCL' ? 2 : 1;
      let memberIdx = 0;
      for (const team of allTeams) {
        for (let i = 0; i < playersPerTeam && memberIdx < shuffled.length; i++, memberIdx++) {
          const member = shuffled[memberIdx];
          const existing = db.findOne('players', p => p.discord_id === member.id);
          if (existing) {
            db.update('players', existing.id, { team_id: team.id, discord_username: member.user.username });
          } else {
            db.insert('players', { team_id: team.id, discord_id: member.id, discord_username: member.user.username });
          }
        }
      }

      // ─── Step 3: create tournament ─────────────────────────────────────────
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🔄  Demo Running...').setDescription('**Step 3/6** — Creating tournament and drawing groups...')]
      });

      const existing = db.get('tournaments').filter(t => t.template === template);
      const season = existing.length + 1;
      const tournament = db.insert('tournaments', {
        name: `${template} Season ${season} (Demo)`,
        template, season,
        type: tmpl.type,
        team_count: teamCount,
        group_size: groupSize,
        status: 'active',
        channel_id: interaction.channelId,
      });

      // Enroll teams
      for (const team of allTeams) {
        db.insert('tournament_teams', { tournament_id: tournament.id, team_id: team.id, group_name: null, points: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 });
      }

      // Draw groups
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const ttEntries = db.get('tournament_teams').filter(tt => tt.tournament_id === tournament.id);
      const shuffledTT = [...ttEntries].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffledTT.length; i++) {
        db.update('tournament_teams', shuffledTT[i].id, { group_name: letters[Math.floor(i / groupSize)] });
      }

      // Generate group matches
      const ttByGroup = {};
      for (const tt of db.get('tournament_teams').filter(tt2 => tt2.tournament_id === tournament.id)) {
        const g = tt.group_name || 'A';
        if (!ttByGroup[g]) ttByGroup[g] = [];
        ttByGroup[g].push(tt);
      }
      const allMatches = [];
      for (const groupTeams of Object.values(ttByGroup)) {
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            const m = db.insert('matches', {
              tournament_id: tournament.id,
              home_team_id: groupTeams[i].team_id,
              away_team_id: groupTeams[j].team_id,
              stage: 'group', round: 1, leg: 1, status: 'pending',
              home_score: null, away_score: null,
            });
            allMatches.push(m);
          }
        }
      }

      // ─── Step 4: post team list ────────────────────────────────────────────
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🔄  Demo Running...').setDescription('**Step 4/6** — Posting team list...')]
      });

      const teamListCh = await getTargetChannel(interaction.guild, template, 'teamList') || interaction.channel;
      await teamListCh.send({ embeds: [buildTeamListEmbed()], components: [buildTeamManageButtons()] });

      // ─── Step 5: post match schedule ───────────────────────────────────────
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🔄  Demo Running...').setDescription('**Step 5/6** — Posting match schedule...')]
      });

      const scheduleCh = await getTargetChannel(interaction.guild, template, 'matchSchedule') || interaction.channel;
      await postMatchSchedule(scheduleCh, tournament, allMatches);

      // ─── Step 6: simulate some results and post standings ─────────────────
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🔄  Demo Running...').setDescription('**Step 6/6** — Simulating 3 example results...')]
      });

      const resultsCh = await getTargetChannel(interaction.guild, template, 'results') || interaction.channel;
      const sample = allMatches.slice(0, 3);
      for (const match of sample) {
        const hs = Math.floor(Math.random() * 5);
        const as = Math.floor(Math.random() * 5);
        await simulateResult(match, hs, as, tournament, resultsCh);
      }

      // Post group standings
      const standingsCh = await getTargetChannel(interaction.guild, template, 'matchSchedule') || interaction.channel;
      const standingsEmbed = buildGroupStandingsEmbed(tournament.id);
      if (standingsEmbed) await standingsCh.send({ embeds: [standingsEmbed] });

      // Post updated tournament panel in current channel
      await interaction.channel.send({ embeds: [buildTournamentListEmbed()], components: [buildTournamentButtons()] });

      // ─── Done ─────────────────────────────────────────────────────────────
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.success)
          .setTitle(`✅  ${template} Demo Complete!`)
          .setDescription(
            `Here's what was created:\n\n` +
            `${tmpl.emoji} **${tournament.name}**\n` +
            `• **${allTeams.length} teams** enrolled from the database\n` +
            `• **${shuffled.length} random members** registered as players\n` +
            `• **${allMatches.length} group matches** generated\n` +
            `• **3 example results** simulated with standings\n\n` +
            `📋 Team list → <#${teamListCh.id}>\n` +
            `📅 Match schedule → <#${scheduleCh.id}>\n` +
            `📊 Results → <#${resultsCh.id}>\n\n` +
            `This is a live tournament — managers can now enter real results using the **Add Result** button.`
          )
          .setTimestamp()
        ],
      });

    } catch (err) {
      console.error('[DEMO ERROR]', err);
      await interaction.editReply({ embeds: [errorEmbed('Demo Failed', err.message)] });
    }
  },
};

async function postMatchSchedule(channel, tournament, matches) {
  const teams = db.get('teams');
  const getTeam = id => teams.find(t => t.id === id) || { name: 'TBD', emoji: '⚽', short_name: '???' };

  // Group matches by group
  const ttEntries = db.get('tournament_teams').filter(tt => tt.tournament_id === tournament.id);
  const groupOfTeam = {};
  for (const tt of ttEntries) groupOfTeam[tt.team_id] = tt.group_name;

  const byGroup = {};
  for (const m of matches) {
    const g = groupOfTeam[m.home_team_id] || 'A';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(m);
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📅  ${tournament.name} — Match Schedule`)
    .setDescription(`**${tournament.template}** Group Stage | ${matches.length} fixtures`)
    .setTimestamp();

  for (const [group, gMatches] of Object.entries(byGroup).sort()) {
    const lines = gMatches.map((m, i) => {
      const home = getTeam(m.home_team_id);
      const away = getTeam(m.away_team_id);
      return `\`${String(i + 1).padStart(2, '0')}\` ${home.emoji} **${home.short_name}** vs **${away.short_name}** ${away.emoji}`;
    });
    embed.addFields({ name: `Group ${group}`, value: lines.join('\n'), inline: true });
  }

  await channel.send({ embeds: [embed] });
}

async function simulateResult(match, homeScore, awayScore, tournament, resultsCh) {
  const teams = db.get('teams');
  const home = teams.find(t => t.id === match.home_team_id) || { name: 'Home', emoji: '⚽' };
  const away = teams.find(t => t.id === match.away_team_id) || { name: 'Away', emoji: '⚽' };

  db.update('matches', match.id, { home_score: homeScore, away_score: awayScore, status: 'played', played_at: new Date().toISOString() });

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

  const resultEmbed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle('⚽  Match Result')
    .setDescription(`**${tournament.name}** — GROUP STAGE`)
    .addFields(
      { name: `${home.emoji} ${home.name}`, value: `**${homeScore}**${homeWon ? ' 🏆' : ''}`, inline: true },
      { name: draw ? '🤝 Draw' : homeWon ? '→' : '←', value: '—', inline: true },
      { name: `${away.emoji} ${away.name}`, value: `**${awayScore}**${awayWon ? ' 🏆' : ''}`, inline: true },
    )
    .setTimestamp();

  await resultsCh.send({ embeds: [resultEmbed] });
}
