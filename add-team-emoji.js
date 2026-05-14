const https = require('https');
const { db } = require('./src/utils/database');

const GUILD_ID = '1462978668241621158';
const TOKEN    = process.env.DISCORD_TOKEN;

// ESPN CDN: https://a.espncdn.com/i/teamlogos/soccer/500/{id}.png
// All verified working
const TEAM_ESPN = {
  'Real Madrid':        86,
  'FC Barcelona':       83,
  'Manchester City':    382,
  'Manchester United':  360,
  'Liverpool FC':       364,
  'Chelsea FC':         363,
  'Arsenal FC':         359,
  'Tottenham Hotspur':  362,
  'Bayern Munich':      132,
  'Borussia Dortmund':  124,
  'PSG':                160,
  'Juventus':           111,
  'AC Milan':           103,
  'Inter Milan':        110,
  'Atletico Madrid':    1068,
  'Sevilla FC':         243,
  'Ajax':               741,
  'Porto FC':           232,
  'Benfica':            3564,
  'Celtic FC':          259,
  'Bayer Leverkusen':   131,
  'Napoli':             3614,
  'Roma':               104,
  'Lazio':              113,
  'Valencia CF':        3740,
  'Real Sociedad':      3760,
  'RB Leipzig':         11420,
  'Galatasaray':        418,
  'Fenerbahce':         419,
  'Shakhtar Donetsk':   3396,
};

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks), ct: res.headers['content-type'] || 'image/png' }));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function discordRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(body);
    const opts = {
      hostname: 'discord.com',
      path: `/api/v10${path}`,
      method,
      headers: {
        'Authorization': `Bot ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json),
      },
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    req.write(json);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeEmojiName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 32).padEnd(2, 'x');
}

async function getExistingEmojis() {
  const res = await new Promise((resolve, reject) => {
    const opts = { hostname: 'discord.com', path: `/api/v10/guilds/${GUILD_ID}/emojis`, method: 'GET', headers: { 'Authorization': `Bot ${TOKEN}` } };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
    });
    req.on('error', reject);
    req.end();
  });
  return Array.isArray(res) ? res : [];
}

async function main() {
  const teams = db.get('teams');
  const existing = await getExistingEmojis();
  const existingNames = new Set(existing.map(e => e.name));

  console.log(`\n📥 Uploading logos for ${Object.keys(TEAM_ESPN).length} teams  (${existing.length} emoji already on server)\n`);

  let added = 0, skipped = 0, failed = 0;

  for (const [teamName, espnId] of Object.entries(TEAM_ESPN)) {
    const team = teams.find(t => t.name === teamName);
    if (!team) { console.log(`  ⚠️  Not in DB: ${teamName}`); skipped++; continue; }

    const eName = safeEmojiName(teamName);
    if (existingNames.has(eName)) {
      const ex = existing.find(e => e.name === eName);
      const emojiStr = `<:${ex.name}:${ex.id}>`;
      db.update('teams', team.id, { emoji: emojiStr });
      console.log(`  ♻️  Already exists: ${teamName} → ${emojiStr}`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ⬆️  ${teamName.padEnd(24)} `);
    try {
      const url = `https://a.espncdn.com/i/teamlogos/soccer/500/${espnId}.png`;
      const { buf, ct } = await fetchBuffer(url);
      if (buf.length > 256000) { console.log(`❌ too large (${buf.length})`); failed++; continue; }

      const imageData = `data:${ct};base64,${buf.toString('base64')}`;
      const res = await discordRequest('POST', `/guilds/${GUILD_ID}/emojis`, { name: eName, image: imageData });

      if (res.status === 201) {
        const emoji = res.body;
        const emojiStr = `<:${emoji.name}:${emoji.id}>`;
        db.update('teams', team.id, { emoji: emojiStr });
        console.log(`✅ ${emojiStr}`);
        added++;
      } else if (res.status === 429) {
        const wait = Math.ceil((res.body.retry_after || 5) * 1000);
        console.log(`⏳ rate limit, waiting ${wait}ms`);
        await sleep(wait);
        // retry
        const res2 = await discordRequest('POST', `/guilds/${GUILD_ID}/emojis`, { name: eName, image: imageData });
        if (res2.status === 201) {
          const emoji = res2.body;
          const emojiStr = `<:${emoji.name}:${emoji.id}>`;
          db.update('teams', team.id, { emoji: emojiStr });
          console.log(`✅ ${emojiStr}`);
          added++;
        } else { console.log(`❌ ${res2.status} ${JSON.stringify(res2.body).slice(0,80)}`); failed++; }
      } else if (res.status === 400 && res.body.code === 30008) {
        console.log(`\n❌  Server has reached max emoji slots!\n`);
        break;
      } else {
        console.log(`❌  ${res.status}: ${JSON.stringify(res.body).slice(0,80)}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌  ${err.message}`);
      failed++;
    }

    await sleep(1500); // ~40 per minute, well under rate limits
  }

  // Add a default "no logo" emoji using a generic football/shirt icon
  const defaultName = 'ns_team';
  if (!existingNames.has(defaultName)) {
    process.stdout.write(`\n  ⬆️  Default team emoji (ns_team)...  `);
    try {
      // Simple grey shirt SVG converted; use a plain ⚽ ball image from ESPN assets
      const { buf, ct } = await fetchBuffer('https://a.espncdn.com/i/teamlogos/soccer/500/default-team-logo-500.png');
      if (buf.length < 256000) {
        const imageData = `data:${ct};base64,${buf.toString('base64')}`;
        const res = await discordRequest('POST', `/guilds/${GUILD_ID}/emojis`, { name: defaultName, image: imageData });
        if (res.status === 201) { console.log(`✅ <:ns_team:${res.body.id}>`); added++; }
        else { console.log(`❌ skipped (${res.status})`); }
      }
    } catch { console.log('❌ skipped'); }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Added:   ${added}`);
  console.log(`♻️  Skipped: ${skipped} (already existed)`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`\n🔄 Restart the bot so it picks up the new emoji strings in the DB.`);
  process.exit(0);
}

main().catch(err => { console.error('[ERROR]', err); process.exit(1); });
