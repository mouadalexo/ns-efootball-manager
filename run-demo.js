// no dotenv
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { db } = require('./src/utils/database');
const { COLORS, E } = require('./src/utils/embeds');
const { buildTeamListEmbed, buildTeamManageButtons } = require('./src/panels/teamListPanel');
const { buildGroupStandingsEmbed } = require('./src/panels/standingsPanel');

const GUILD_ID     = '1462978668241621158';
const MCL_CHANNELS = {
  teamList:      '1463154002660429885',
  results:       '1463162354656088188',
  matchSchedule: '1463153753078108180',
};

function generateRounds(teamIds) {
  const t = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, null];
  const half = t.length / 2;
  const rounds = [];
  for (let r = 0; r < t.length - 1; r++) {
    const round = [];
    for (let i = 0; i < half; i++) {
      const home = t[i]; const away = t[t.length - 1 - i];
      if (home !== null && away !== null) round.push({ home, away });
    }
    rounds.push(round);
    t.splice(1, 0, t.pop());
  }
  return rounds;
}

async function postScheduleByRound(channel, tournament, matchesByRound) {
  const teams = db.get('teams');
  const getTeam = id => teams.find(t => t.id === id) || { name: 'TBD', emoji: '⚽', short_name: '???' };
  const totalRounds = Object.keys(matchesByRound).length;
  for (const [roundNum, rMatches] of Object.entries(matchesByRound).sort((a,b)=>Number(a[0])-Number(b[0]))) {
    const byGroup = {};
    for (const m of rMatches) { const g = m.group_name||'?'; if(!byGroup[g]) byGroup[g]=[]; byGroup[g].push(m); }
    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle(`${E.hashtag}  GROUP STAGE  ·  ROUND ${roundNum} / ${totalRounds}`)
      .setDescription(`**${tournament.name}**  ·  ${tournament.template}\n${'━'.repeat(32)}`)
      .setTimestamp();
    for (const [groupLetter, gMatches] of Object.entries(byGroup).sort()) {
      const lines = gMatches.map((m, i) => {
        const home = getTeam(m.home_team_id); const away = getTeam(m.away_team_id);
        return `\`${String(i+1).padStart(2,'0')}\`  ${home.emoji} **${home.short_name}**  \`vs\`  **${away.short_name}** ${away.emoji}`;
      });
      embed.addFields({ name: `⬦  Group ${groupLetter}`, value: ' ' + lines.join('\n'), inline: true });
    }
    embed.setFooter({ text: `Round ${roundNum} of ${totalRounds}  •  ${rMatches.length} matches` });
    await channel.send({ embeds: [embed] });
  }
}

async function postResult(match, homeScore, awayScore, tournament, resultsCh) {
  const teams = db.get('teams');
  const home  = teams.find(t => t.id === match.home_team_id) || { name: 'Home', emoji: '⚽', short_name: 'HME' };
  const away  = teams.find(t => t.id === match.away_team_id) || { name: 'Away', emoji: '⚽', short_name: 'AWY' };
  db.update('matches', match.id, { home_score: homeScore, away_score: awayScore, status: 'played', played_at: new Date().toISOString() });
  const homeWon = homeScore > awayScore; const awayWon = awayScore > homeScore; const draw = homeScore === awayScore;
  const homeTT = db.findOne('tournament_teams', tt => tt.tournament_id === match.tournament_id && tt.team_id === match.home_team_id);
  const awayTT = db.findOne('tournament_teams', tt => tt.tournament_id === match.tournament_id && tt.team_id === match.away_team_id);
  if (homeTT) db.update('tournament_teams', homeTT.id, { goals_for:(homeTT.goals_for||0)+homeScore, goals_against:(homeTT.goals_against||0)+awayScore, wins:(homeTT.wins||0)+(homeWon?1:0), draws:(homeTT.draws||0)+(draw?1:0), losses:(homeTT.losses||0)+(awayWon?1:0), points:(homeTT.points||0)+(homeWon?3:draw?1:0) });
  if (awayTT) db.update('tournament_teams', awayTT.id, { goals_for:(awayTT.goals_for||0)+awayScore, goals_against:(awayTT.goals_against||0)+homeScore, wins:(awayTT.wins||0)+(awayWon?1:0), draws:(awayTT.draws||0)+(draw?1:0), losses:(awayTT.losses||0)+(homeWon?1:0), points:(awayTT.points||0)+(awayWon?3:draw?1:0) });
  const outcomeColor = draw ? 0x5865F2 : 0xF1C40F;
  const outcomeLabel = draw ? `🤝  **DRAW**` : `${E.crown}  **${homeWon ? home.name : away.name}** wins!`;
  const embed = new EmbedBuilder()
    .setColor(outcomeColor)
    .setAuthor({ name: `${tournament.name}  ·  Group Stage — Round ${match.round}` })
    .setTitle(`${E.fire}  FULL TIME`)
    .addFields(
      { name: homeWon ? `${E.crown}  ${home.emoji}  ${home.name}` : `${home.emoji}  ${home.name}`, value: `# ${homeScore}`, inline: true },
      { name: '⠀', value: `**\`VS\`**\n${draw ? '🤝' : homeWon ? '◀' : '▶'}`, inline: true },
      { name: awayWon ? `${E.crown}  ${away.emoji}  ${away.name}` : `${away.emoji}  ${away.name}`, value: `# ${awayScore}`, inline: true },
      { name: '━━━━━━━━━━━━━━━━━━━━━━━━', value: outcomeLabel, inline: false },
    )
    .setFooter({ text: `${home.short_name}  ${homeScore} — ${awayScore}  ${away.short_name}  •  eFootball NS Tournament` })
    .setTimestamp();
  await resultsCh.send({ embeds: [embed] });
}

async function runDemo() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise(r => client.once('ready', r));
  console.log('[DEMO] Ready as', client.user.tag);

  const guild       = await client.guilds.fetch(GUILD_ID);
  const teamListCh  = await guild.channels.fetch(MCL_CHANNELS.teamList);
  const scheduleCh  = await guild.channels.fetch(MCL_CHANNELS.matchSchedule);
  const resultsCh   = await guild.channels.fetch(MCL_CHANNELS.results);

  // Pick 8 random teams
  const allTeams  = db.get('teams').sort(() => Math.random() - 0.5).slice(0, 8);
  const letters   = 'AB';
  const groupSize = 4;

  // Create tournament
  const existing   = db.get('tournaments').filter(t => t.template === 'MCL');
  const season     = existing.length + 1;
  const tournament = db.insert('tournaments', {
    name: `MCL Season ${season} (Demo)`, template: 'MCL', season,
    type: 'duo', team_count: 8, group_size: groupSize, status: 'active',
    channel_id: MCL_CHANNELS.matchSchedule,
  });
  console.log('[DEMO] Tournament:', tournament.name);

  // Enroll & draw groups
  const shuffled = [...allTeams].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length; i++) {
    db.insert('tournament_teams', {
      tournament_id: tournament.id, team_id: shuffled[i].id,
      group_name: letters[Math.floor(i / groupSize)],
      points: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0,
    });
  }

  // Build group map & generate matches per round
  const ttEntries = db.get('tournament_teams').filter(tt => tt.tournament_id === tournament.id);
  const groupMap  = {};
  for (const tt of ttEntries) { if (!groupMap[tt.group_name]) groupMap[tt.group_name]=[]; groupMap[tt.group_name].push(tt.team_id); }

  const allMatches    = [];
  const matchesByRound = {};
  for (const [grp, teamIds] of Object.entries(groupMap)) {
    generateRounds(teamIds).forEach((roundPairs, rIdx) => {
      const roundNum = rIdx + 1;
      if (!matchesByRound[roundNum]) matchesByRound[roundNum] = [];
      for (const { home, away } of roundPairs) {
        const m = db.insert('matches', { tournament_id: tournament.id, home_team_id: home, away_team_id: away, stage: 'group', round: roundNum, leg: 1, status: 'pending', home_score: null, away_score: null, group_name: grp });
        allMatches.push(m);
        matchesByRound[roundNum].push({ ...m, group_name: grp });
      }
    });
  }

  // 1. Team list
  console.log('[DEMO] Posting team list...');
  await teamListCh.send({ embeds: [buildTeamListEmbed()], components: [buildTeamManageButtons()] });

  // 2. Schedule per round
  console.log('[DEMO] Posting schedule...');
  await postScheduleByRound(scheduleCh, tournament, matchesByRound);

  // 3. Example results (fixed scores: 3-1, 2-2, 0-1)
  console.log('[DEMO] Posting results...');
  const fixedScores = [[3,1],[2,2],[0,1]];
  for (let i = 0; i < Math.min(3, allMatches.length); i++) {
    await postResult(allMatches[i], fixedScores[i][0], fixedScores[i][1], tournament, resultsCh);
  }

  // 4. Standings
  console.log('[DEMO] Posting standings...');
  const standingsEmbed = buildGroupStandingsEmbed(tournament.id);
  if (standingsEmbed) await resultsCh.send({ embeds: [standingsEmbed] });

  console.log('[DEMO] ✅ Done!');
  await client.destroy();
  process.exit(0);
}

runDemo().catch(err => { console.error('[DEMO ERROR]', err); process.exit(1); });
