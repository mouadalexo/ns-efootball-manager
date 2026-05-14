// Run on VPS: node post-teamlist.js
// Posts team list embed to NSEL and MCL channels
'use strict';
const { Client, GatewayIntentBits } = require('/home/ubuntu/goatsi/node_modules/discord.js');
const fs = require('fs');

const envContent = fs.readFileSync('/home/ubuntu/goatsi/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const idx = line.indexOf('=');
  if (idx < 0) return;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const { db } = require('/home/ubuntu/goatsi/src/utils/database');
const { buildTeamListEmbed, buildTeamManageButtons } = require('/home/ubuntu/goatsi/src/panels/teamListPanel');

const CHANNELS = {
  NSEL: '1462982588661628938',
  MCL:  '1463154002660429885',
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  for (const [tmpl, channelId] of Object.entries(CHANNELS)) {
    try {
      const ch = await client.channels.fetch(channelId);
      await ch.send({ embeds: [buildTeamListEmbed()], components: [buildTeamManageButtons()] });
      console.log(`[OK] Posted team list to ${tmpl} (${channelId})`);
    } catch (err) {
      console.error(`[ERR] ${tmpl}:`, err.message);
    }
  }
  client.destroy();
});

client.login(env.DISCORD_TOKEN);
