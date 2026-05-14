'use strict';
// Standalone demo script — posts directly to Discord channels without a slash command interaction
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');

const env = fs.readFileSync('/home/ubuntu/goatsi/.env', 'utf8');
const TOKEN   = env.match(/DISCORD_TOKEN=(.+)/)?.[1]?.trim();
const GUILD   = env.match(/DISCORD_GUILD_ID=(.+)/)?.[1]?.trim();

const { db } = require('/home/ubuntu/goatsi/src/utils/database');
const { generateScheduleImage, generateResultImage, generateStandingsImage } = require('/home/ubuntu/goatsi/src/utils/imageGen');

const CHANNELS = {
  NSEL: { schedule: '1462982363267993672', results: '1463162274192556072' },
  MCL:  { schedule: '1463153753078108180', results: '1463162354656088188' },
};

function generateRounds(teamIds) {
  const t = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, null];
  const half = t.length / 2;
  const rounds = [];
  for (let r = 0; r < t.length - 1; r++) {
    const round = [];
    for (let i = 0; i < half; i++) {
      const home = t[i], away = t[t.length - 1 - i];
      if (home !== null && away !== null) round.push({ home, away });
    }
    rounds.push(round);
    t.splice(1, 0, t.pop());
  }
  return rounds;
}

async function runDemo(guild, template) {
  const cfg = CHANNELS[template];
  const scheduleCh = await guild.channels.fetch(cfg.schedule);
  const resultsCh  = await guild.channels.fetch(cfg.results);

  const teamCount = template === 'MCL' ? 8 : 8;
  const groupSize = 4;
  const allTeams  = db.get('teams').sort(() => Math.random() - 0.5).slice(0, teamCount);
  if (allTeams.length < teamCount) { console.log('Not enough teams'); return; }

  // Create tournament
  const season = db.get('tournaments').filter(t => t.template === template).length + 1;
  const tournament = db.insert('tournaments', {
    name: `${template} Season ${season} (Demo)`,
    template, season, type: 'group+knockout',
    team_count: teamCount, group_size: groupSize,
    status: 'active', channel_id: scheduleCh.id,
  });

  // Enroll + draw groups
  for (const team of allTeams) {
    db.insert('tournament_teams', { tournament_id: tournament.id, team_id: team.id, group_name: null, points:0, wins:0, draws:0, losses:0, goals_for:0, goals_against:0 });
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const ttEntries = db.get('tournament_teams').filter(tt => tt.tournament_id === tournament.id);
  const shuffledTT = [...ttEntries].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffledTT.length; i++) {
    db.update('tournament_teams', shuffledTT[i].id, { group_name: letters[Math.floor(i / groupSize)] });
  }

  // Build matches
  const updatedTT = db.get('tournament_teams').filter(tt => tt.tournament_id === tournament.id);
  const groupMap = {};
  for (const tt of updatedTT) { const g = tt.group_name||'A'; if(!groupMap[g]) groupMap[g]=[]; groupMap[g].push(tt.team_id); }
  const allMatches = [], matchesByRound = {};
  for (const [gLetter, teamIds] of Object.entries(groupMap)) {
    generateRounds(teamIds).forEach((pairs, ri) => {
      const rn = ri+1;
      if (!matchesByRound[rn]) matchesByRound[rn] = [];
      for (const { home, away } of pairs) {
        const m = db.insert('matches', { tournament_id:tournament.id, home_team_id:home, away_team_id:away, stage:'group', round:rn, leg:1, status:'pending', home_score:null, away_score:null, group_name:gLetter });
        allMatches.push(m);
        matchesByRound[rn].push({ ...m, group_name: gLetter });
      }
    });
  }

  const allTeamsById = Object.fromEntries(db.get('teams').map(t => [t.id, t]));
  const totalRounds  = Object.keys(matchesByRound).length;

  console.log(`[${template}] Posting schedule (${totalRounds} rounds)...`);
  for (const [rn, rMatches] of Object.entries(matchesByRound).sort((a,b)=>+a[0]-+b[0])) {
    const byGroup = {};
    for (const m of rMatches) { const g=m.group_name||'A'; if(!byGroup[g]) byGroup[g]=[]; byGroup[g].push(m); }
    const buf = await generateScheduleImage(+rn, totalRounds, byGroup, allTeamsById, tournament);
    await scheduleCh.send({ files: [new AttachmentBuilder(buf, { name: `schedule_r${rn}.png` })] });
  }

  console.log(`[${template}] Posting 3 results...`);
  const sample = allMatches.slice(0, 3);
  for (const match of sample) {
    const hs = Math.floor(Math.random()*5), as_ = Math.floor(Math.random()*5);
    const home = allTeamsById[match.home_team_id], away = allTeamsById[match.away_team_id];
    db.update('matches', match.id, { home_score:hs, away_score:as_, status:'played', played_at:new Date().toISOString() });
    const homeTT = db.findOne('tournament_teams', tt=>tt.tournament_id===match.tournament_id&&tt.team_id===match.home_team_id);
    const awayTT = db.findOne('tournament_teams', tt=>tt.tournament_id===match.tournament_id&&tt.team_id===match.away_team_id);
    const hw=hs>as_, aw=as_>hs, dr=hs===as_;
    if(homeTT) db.update('tournament_teams',homeTT.id,{ goals_for:(homeTT.goals_for||0)+hs, goals_against:(homeTT.goals_against||0)+as_, wins:(homeTT.wins||0)+(hw?1:0), draws:(homeTT.draws||0)+(dr?1:0), losses:(homeTT.losses||0)+(aw?1:0), points:(homeTT.points||0)+(hw?3:dr?1:0) });
    if(awayTT) db.update('tournament_teams',awayTT.id,{ goals_for:(awayTT.goals_for||0)+as_, goals_against:(awayTT.goals_against||0)+hs, wins:(awayTT.wins||0)+(aw?1:0), draws:(awayTT.draws||0)+(dr?1:0), losses:(awayTT.losses||0)+(hw?1:0), points:(awayTT.points||0)+(aw?3:dr?1:0) });
    const fullMatch = db.findById('matches', match.id);
    const buf = await generateResultImage(fullMatch, home, away, tournament);
    await resultsCh.send({ files: [new AttachmentBuilder(buf, { name: 'result.png' })] });
  }

  console.log(`[${template}] Posting standings...`);
  const ttAll = db.get('tournament_teams').filter(tt=>tt.tournament_id===tournament.id);
  const groupedStandings = {};
  for (const tt of ttAll) {
    const g=tt.group_name||'A'; if(!groupedStandings[g]) groupedStandings[g]=[];
    const team = allTeamsById[tt.team_id]||{name:'TBD',emoji:'⚽',short_name:'???'};
    groupedStandings[g].push({...team,...tt});
  }
  for (const g of Object.keys(groupedStandings)) groupedStandings[g].sort((a,b)=>(b.points||0)-(a.points||0));
  const sBuf = generateStandingsImage(tournament, groupedStandings);
  await resultsCh.send({ files: [new AttachmentBuilder(sBuf, { name: 'standings.png' })] });

  console.log(`[${template}] Demo complete!`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', async () => {
  console.log('Bot ready, running demo...');
  const guild = await client.guilds.fetch(GUILD);
  await runDemo(guild, 'NSEL');
  await runDemo(guild, 'MCL');
  console.log('All demos posted!');
  process.exit(0);
});
client.login(TOKEN);
