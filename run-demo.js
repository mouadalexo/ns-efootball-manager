// no dotenv
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { db } = require('./src/utils/database');
const { buildTeamManageButtons } = require('./src/panels/teamListPanel');
const { buildStandingsRow } = require('./src/panels/standingsPanel');
const {
  generateScheduleImage, generateResultImage,
  generateRosterImage, generateStandingsImage,
} = require('./src/utils/imageGen');

const GUILD_ID     = '1462978668241621158';
const MCL_CHANNELS = {
  teamList:      '1463154002660429885',
  results:       '1463162354656088188',
  matchSchedule: '1463153753078108180',
};

const FAKE_PLAYERS = [
  'Ronaldo7','Messi10','Neymar11','Mbappe7','Salah11',
  'Benzema9','DeGea1','Modric10','Kroos8','Haaland9',
  'Alisson1','Kante7','Pogba6','Griezmann7','Rashford10',
  'Suarez9','Firmino9','Jota20','Diaz23','Nunez9',
];

function img(buf, name) { return new AttachmentBuilder(buf, { name }); }

function generateRounds(teamIds) {
  const t = teamIds.length%2===0?[...teamIds]:[...teamIds,null];
  const half=t.length/2, rounds=[];
  for (let r=0;r<t.length-1;r++) {
    const round=[];
    for (let i=0;i<half;i++) {
      const h=t[i],a=t[t.length-1-i];
      if (h!==null&&a!==null) round.push({home:h,away:a});
    }
    rounds.push(round); t.splice(1,0,t.pop());
  }
  return rounds;
}

async function runDemo() {
  const client = new Client({ intents:[GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise(r=>client.once('clientReady',r));
  console.log('[DEMO] Ready as', client.user.tag);

  const guild      = await client.guilds.fetch(GUILD_ID);
  const teamListCh = await guild.channels.fetch(MCL_CHANNELS.teamList);
  const scheduleCh = await guild.channels.fetch(MCL_CHANNELS.matchSchedule);
  const resultsCh  = await guild.channels.fetch(MCL_CHANNELS.results);

  const allTeams = db.get('teams').sort(()=>Math.random()-0.5).slice(0,8);
  const existing = db.get('tournaments').filter(t=>t.template==='MCL');
  const season   = existing.length+1;
  const tournament = db.insert('tournaments',{
    name:`MCL Season ${season} (Demo)`,template:'MCL',season,
    type:'duo',team_count:8,group_size:4,status:'active',
    channel_id:MCL_CHANNELS.matchSchedule,
  });
  console.log('[DEMO] Tournament:', tournament.name);

  const shuffled = [...allTeams].sort(()=>Math.random()-0.5);
  const fakeNames = [...FAKE_PLAYERS].sort(()=>Math.random()-0.5);
  let pi=0;
  for (let i=0;i<shuffled.length;i++) {
    const team=shuffled[i];
    db.insert('tournament_teams',{
      tournament_id:tournament.id,team_id:team.id,
      group_name:i<4?'A':'B',
      points:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,
    });
    for (let p=0;p<2&&pi<fakeNames.length;p++,pi++) {
      const ex=db.findOne('players',pl=>pl.discord_username===fakeNames[pi]);
      if (ex) db.update('players',ex.id,{team_id:team.id});
      else db.insert('players',{team_id:team.id,discord_id:`fake_${pi}`,discord_username:fakeNames[pi]});
    }
  }

  // Build group map
  const ttEntries = db.get('tournament_teams').filter(tt=>tt.tournament_id===tournament.id);
  const teams     = db.get('teams');
  const players   = db.get('players');

  const groupMap={};
  for (const tt of ttEntries) {
    if (!groupMap[tt.group_name]) groupMap[tt.group_name]=[];
    groupMap[tt.group_name].push(tt.team_id);
  }

  const allMatches=[], matchesByRound={};
  for (const [grp,teamIds] of Object.entries(groupMap)) {
    generateRounds(teamIds).forEach((pairs,ri)=>{
      const rn=ri+1; if (!matchesByRound[rn]) matchesByRound[rn]=[];
      for (const {home,away} of pairs) {
        const m=db.insert('matches',{tournament_id:tournament.id,home_team_id:home,away_team_id:away,
          stage:'group',round:rn,leg:1,status:'pending',home_score:null,away_score:null,group_name:grp});
        allMatches.push(m); matchesByRound[rn].push({...m,group_name:grp});
      }
    });
  }

  // 1. Roster image
  console.log('[DEMO] Posting roster image...');
  const groupedRoster={};
  for (const tt of ttEntries) {
    const g=tt.group_name;
    if (!groupedRoster[g]) groupedRoster[g]=[];
    const team=teams.find(t=>t.id===tt.team_id)||{name:'Unknown',short_name:'???'};
    const tp=players.filter(p=>p.team_id===tt.team_id);
    groupedRoster[g].push({team,players:tp});
  }
  const rosterBuf = generateRosterImage(tournament, groupedRoster);
  await teamListCh.send({ files:[img(rosterBuf,'roster.png')], components:[buildTeamManageButtons()] });

  // 2. Schedule images (per round)
  console.log('[DEMO] Posting schedule images...');
  const totalRounds=Object.keys(matchesByRound).length;
  for (const [rn,rMs] of Object.entries(matchesByRound).sort((a,b)=>Number(a[0])-Number(b[0]))) {
    const byGroup={};
    for (const m of rMs) { const g=m.group_name||'?'; if (!byGroup[g]) byGroup[g]=[]; byGroup[g].push(m); }
    const buf=generateScheduleImage(Number(rn),totalRounds,byGroup,teams,tournament);
    await scheduleCh.send({ files:[img(buf,`schedule_r${rn}.png`)] });
  }

  // 3. Result images (3 sample matches)
  console.log('[DEMO] Posting result images...');
  const fixedScores=[[3,1],[2,2],[0,1]];
  for (let i=0;i<Math.min(3,allMatches.length);i++) {
    const match=allMatches[i];
    const hs=fixedScores[i][0], as_=fixedScores[i][1];
    const home=teams.find(t=>t.id===match.home_team_id)||{name:'Home',short_name:'HME'};
    const away=teams.find(t=>t.id===match.away_team_id)||{name:'Away',short_name:'AWY'};
    db.update('matches',match.id,{home_score:hs,away_score:as_,status:'played',played_at:new Date().toISOString()});
    const hWon=hs>as_,aWon=as_>hs,draw=hs===as_;
    const hTT=db.findOne('tournament_teams',tt=>tt.tournament_id===match.tournament_id&&tt.team_id===match.home_team_id);
    const aTT=db.findOne('tournament_teams',tt=>tt.tournament_id===match.tournament_id&&tt.team_id===match.away_team_id);
    if(hTT) db.update('tournament_teams',hTT.id,{goals_for:(hTT.goals_for||0)+hs,goals_against:(hTT.goals_against||0)+as_,wins:(hTT.wins||0)+(hWon?1:0),draws:(hTT.draws||0)+(draw?1:0),losses:(hTT.losses||0)+(aWon?1:0),points:(hTT.points||0)+(hWon?3:draw?1:0)});
    if(aTT) db.update('tournament_teams',aTT.id,{goals_for:(aTT.goals_for||0)+as_,goals_against:(aTT.goals_against||0)+hs,wins:(aTT.wins||0)+(aWon?1:0),draws:(aTT.draws||0)+(draw?1:0),losses:(aTT.losses||0)+(hWon?1:0),points:(aTT.points||0)+(aWon?3:draw?1:0)});
    const updated={...match,home_score:hs,away_score:as_,status:'played'};
    const buf=generateResultImage(updated,home,away,tournament);
    await resultsCh.send({ files:[img(buf,`result_${i+1}.png`)] });
  }

  // 4. Standings image + button
  console.log('[DEMO] Posting standings image + button...');
  const freshTT=db.get('tournament_teams').filter(tt=>tt.tournament_id===tournament.id);
  const groupedStandings={};
  for (const tt of freshTT) {
    const g=tt.group_name;
    if (!groupedStandings[g]) groupedStandings[g]=[];
    const team=teams.find(t=>t.id===tt.team_id)||{name:'Unknown',short_name:'???'};
    groupedStandings[g].push({...team,...tt});
  }
  for (const g of Object.values(groupedStandings)) {
    g.sort((a,b)=>{
      const pd=(b.points||0)-(a.points||0); if(pd!==0) return pd;
      return ((b.goals_for||0)-(b.goals_against||0))-((a.goals_for||0)-(a.goals_against||0));
    });
  }
  const standingsBuf = generateStandingsImage(tournament, groupedStandings);
  await resultsCh.send({
    files:[img(standingsBuf,'standings.png')],
    components:[buildStandingsRow(tournament.id)],
  });

  console.log('[DEMO] Done!');
  await client.destroy();
  process.exit(0);
}

runDemo().catch(err=>{console.error('[DEMO ERROR]',err);process.exit(1);});
