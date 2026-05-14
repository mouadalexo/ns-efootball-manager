'use strict';
const fs = require('fs');
const path = require('path');
const BOT = '/home/ubuntu/goatsi';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. imageGen.js — full targeted patches
// ═══════════════════════════════════════════════════════════════════════════════
let img = fs.readFileSync(BOT + '/src/utils/imageGen.js', 'utf8');

// 1a. Color palette — make text white, score white
img = img.replace(
  `  sub:      '#FF7070',`,
  `  sub:      '#FFFFFF',`
);
img = img.replace(
  `  textMid:  '#CC5555',`,
  `  textMid:  '#CCCCCC',`
);
img = img.replace(
  `  textSub:  '#FF9999',`,
  `  textSub:  '#AAAAAA',`
);
img = img.replace(
  `  score:    '#FF1A1A',`,
  `  score:    '#FFFFFF',`
);

// 1b. Replace every "NS eFootball Tournament" / "eFootball NS Tournament" → "Night Stars"
img = img.replace(/NS eFootball Tournament/g, 'Night Stars');
img = img.replace(/eFootball NS Tournament/g, 'Night Stars');
img = img.replace(/NS eFootball/g, 'Night Stars');

// 1c. drawTeamLogoAsync — no crest clipping, draw logo directly (pro football style)
const oldLogoFn = img.indexOf('async function drawTeamLogoAsync(');
const oldLogoEnd = img.indexOf('\n// ─── UCL decoration', oldLogoFn);
const newLogoFn = `async function drawTeamLogoAsync(ctx, cx, cy, rw, rh, team, isWinner) {
  if (team && team.logo_url) {
    try {
      const img = await loadImage(team.logo_url);
      ctx.save();
      // Winner glow (no crest shape — just a radial behind the logo)
      if (isWinner) {
        const glow = ctx.createRadialGradient(cx, cy, rw * 0.2, cx, cy, rw * 2.0);
        glow.addColorStop(0, 'rgba(255,215,0,0.50)');
        glow.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(cx, cy, rw * 2.0, 0, Math.PI * 2); ctx.fill();
      }
      // Drop shadow for depth
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 5;
      // Draw logo at natural proportions, no background, no clipping
      const scale = Math.min((rw * 2) / img.width, (rh * 2) / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.restore();
      return;
    } catch (_) {}
  }
  drawCrest(ctx, cx, cy, rw, rh, team, isWinner);
}
`;
img = img.slice(0, oldLogoFn) + newLogoFn + img.slice(oldLogoEnd);

// 1d. generateScheduleImage — dynamic row height, no match index, VS white, clean layout
const schedStart = img.indexOf('async function generateScheduleImage(');
const schedEnd   = img.indexOf('\n// ─── 2. Result image', schedStart);
const newSched = `async function generateScheduleImage(roundNum, totalRounds, matchesByGroup, teams, tournament) {
  const getTeam = id => (Array.isArray(teams) ? teams.find(t => t.id === id) : teams[id]) || { name: 'TBD', short_name: 'TBD', emoji: '⚽' };
  const allMatches = [];
  for (const [, ms] of Object.entries(matchesByGroup).sort()) for (const m of ms) allMatches.push(m);

  const W    = 1080;
  const HDR_H = 274;
  const FOOT_H = 80;
  const BAND   = 210;
  const cardX  = BAND + 8, cardW = W - (BAND + 8) * 2;
  // Dynamic row height — fewer matches → bigger rows, more matches → tighter
  const n = allMatches.length || 1;
  const ROW_H = n <= 3 ? 130 : n <= 5 ? 112 : n <= 8 ? 96 : 82;
  const CRW = Math.round(ROW_H * 0.32), CRH = Math.round(ROW_H * 0.38);
  const H = HDR_H + n * ROW_H + FOOT_H + 20;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawPortraitBg(ctx, W, H);
  drawPortraitHeader(ctx, W, 'SCHEDULE',
    \`ROUND \${roundNum} OF \${totalRounds}  —  \${tournament.name.toUpperCase()}\`);

  // Card backing
  rr(ctx, cardX, HDR_H - 8, cardW, n * ROW_H + 16, 18, C.card);

  const MID_X = W / 2;

  for (let i = 0; i < allMatches.length; i++) {
    const m    = allMatches[i];
    const home = getTeam(m.home_team_id);
    const away = getTeam(m.away_team_id);
    const rowY = HDR_H + i * ROW_H;
    const midY = rowY + ROW_H / 2;

    // Alternating row tint
    if (i % 2 === 1) {
      ctx.fillStyle = C.cardAlt;
      ctx.fillRect(cardX + 1, rowY, cardW - 2, ROW_H);
    }

    // Group label (subtle, top-left of row)
    if (m.group_name) {
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.font = \`bold 11px "DejaVu Sans", Arial, sans-serif\`;
      ctx.textAlign = 'left';
      ctx.fillText(\`GRP \${m.group_name}\`, cardX + 14, rowY + 18);
    }

    // HOME: name right-aligned → logo
    const homeCX = MID_X - 148;
    await drawTeamLogoAsync(ctx, homeCX, midY, CRW, CRH, home, false);
    ctx.fillStyle = '#FFFFFF';
    const homeFont = (home.name || '').length > 13 ? 16 : (home.name || '').length > 9 ? 19 : 22;
    ctx.font = \`bold \${homeFont}px "DejaVu Sans", Arial, sans-serif\`;
    ctx.textAlign = 'right';
    ctx.fillText((home.name || 'TBD').toUpperCase().slice(0, 15), homeCX - CRW - 10, midY + 7);

    // VS — white, bold, centered
    ctx.fillStyle = '#FFFFFF';
    ctx.font = \`bold \${Math.round(ROW_H * 0.26)}px "DejaVu Sans", Arial, sans-serif\`;
    ctx.textAlign = 'center';
    ctx.fillText('VS', MID_X, midY + 10);

    // AWAY: logo → name left-aligned
    const awayCX = MID_X + 148;
    await drawTeamLogoAsync(ctx, awayCX, midY, CRW, CRH, away, false);
    ctx.fillStyle = '#FFFFFF';
    const awayFont = (away.name || '').length > 13 ? 16 : (away.name || '').length > 9 ? 19 : 22;
    ctx.font = \`bold \${awayFont}px "DejaVu Sans", Arial, sans-serif\`;
    ctx.textAlign = 'left';
    ctx.fillText((away.name || 'TBD').toUpperCase().slice(0, 15), awayCX + CRW + 10, midY + 7);

    // Row divider
    if (i < allMatches.length - 1) {
      ctx.strokeStyle = C.div;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 22, rowY + ROW_H);
      ctx.lineTo(cardX + cardW - 22, rowY + ROW_H);
      ctx.stroke();
    }
  }

  // Footer
  ctx.fillStyle = '#CCCCCC';
  ctx.font = '15px "DejaVu Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Night Stars  —  ' + tournament.name, W / 2, HDR_H + n * ROW_H + 46);

  // Bottom accent
  ctx.fillStyle = '#8B0000';
  ctx.fillRect(0, H - 8, W, 8);

  return canvas.toBuffer('image/png');
}
`;
img = img.slice(0, schedStart) + newSched + img.slice(schedEnd);

// 1e. Result image — white score text
img = img.replace(
  `ctx.fillStyle = C.score;\n  ctx.font = \`bold \${scoreFontSize}px "DejaVu Sans", Arial, sans-serif\`;\n  ctx.textAlign = 'center';\n  ctx.fillText(scoreStr, MID_X, MATCH_CY + scoreFontSize * 0.35 + 24);`,
  `ctx.fillStyle = '#FFFFFF';\n  ctx.font = \`bold \${scoreFontSize}px "DejaVu Sans", Arial, sans-serif\`;\n  ctx.textAlign = 'center';\n  ctx.fillText(scoreStr, MID_X, MATCH_CY + scoreFontSize * 0.35 + 24);`
);

fs.writeFileSync(BOT + '/src/utils/imageGen.js', img, 'utf8');
console.log('imageGen.js patched');

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Delete unused commands
// ═══════════════════════════════════════════════════════════════════════════════
for (const f of ['setup.js', 'tournament.js', 'teamlist.js']) {
  const p = BOT + '/src/commands/' + f;
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('Deleted:', f); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. New /help command — ephemeral, full guide
// ═══════════════════════════════════════════════════════════════════════════════
const helpCode = `'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Full guide — how the Night Stars bot works'),

  async execute(interaction) {

    const e1 = new EmbedBuilder()
      .setColor(0x8B0000)
      .setTitle('🌟  Night Stars eFootball Manager')
      .setDescription(
        'Full Discord-based tournament system for **NSEL** and **MCL**.\\n' +
        'Everything runs through **panels and buttons** — managers just click.\\n\\n' +
        '**How to start a season:**\\n' +
        '\`\`\`\\n' +
        '1. /manage  →  New Season\\n' +
        '2. /manage  →  Register Teams\\n' +
        '3. /manage  →  Add Player (per team)\\n' +
        '4. /manage  →  Draw Groups\\n' +
        '5. /manage  →  Generate Matches\\n' +
        '6. /manage  →  Post Schedule  or  Auto-Schedule\\n' +
        '7. /manage  →  Add Result  (after each match)\\n' +
        '8. /manage  →  Start Knockout  (when group stage done)\\n' +
        '\`\`\`'
      )
      .setFooter({ text: 'Page 1 / 3  —  Quick Start' });

    const e2 = new EmbedBuilder()
      .setColor(0xAA0000)
      .setTitle('📋  Slash Commands')
      .addFields(
        {
          name: '\`/manage\`  🔒 Manager only',
          value:
            'All-in-one control panel with 3 rows of buttons:\\n' +
            '▸ **New Season** — create with name, teams, groups, deadline\\n' +
            '▸ **Register Teams** — search by name → multi-select dropdown\\n' +
            '▸ **Add Player** — type username → Discord member picker\\n' +
            '▸ **Close Season** — mark season closed\\n' +
            '▸ **Draw Groups** — randomly assign teams to groups\\n' +
            '▸ **Generate Matches** — build full round-robin per group\\n' +
            '▸ **Post Schedule** — post schedule image immediately\\n' +
            '▸ **Auto-Schedule** — schedule post after N hours\\n' +
            '▸ **Add Result** — pick match → enter score → auto-posts result image + standings\\n' +
            '▸ **Start Knockout** — draw bracket from top 2 per group\\n' +
            '▸ **View Bracket** — show current knockout bracket',
          inline: false,
        },
        {
          name: '\`/standings\`',
          value: 'View live group standings for any tournament.',
          inline: true,
        },
        {
          name: '\`/seasonlist\`',
          value: 'List all past and active seasons.',
          inline: true,
        },
        {
          name: '\`/groupdraw\`  🔒',
          value: 'Manually trigger group draw for a tournament.',
          inline: true,
        },
        {
          name: '\`/deadline\`  🔒',
          value: 'Set a match deadline and get a reminder.',
          inline: true,
        },
        {
          name: '\`/demo\`  🔒',
          value: 'Run a full demo with fake teams — posts schedule, result, and standings images to the correct channels.',
          inline: true,
        },
        {
          name: '\`/help\`',
          value: 'Shows this guide.',
          inline: true,
        },
      )
      .setFooter({ text: 'Page 2 / 3  —  Commands' });

    const e3 = new EmbedBuilder()
      .setColor(0xCC0000)
      .setTitle('🖼️  Auto-Posted Images')
      .addFields(
        {
          name: '📅 Schedule Image',
          value:
            'Posted to **match-schedule** channel after *Post Schedule* or *Auto-Schedule*.\\n' +
            'Shows every match in the round — team logos (from API-Football), team names, **VS** center.\\n' +
            'Scales automatically from 1 match to 10+.',
          inline: false,
        },
        {
          name: '📊 Result Image',
          value:
            'Posted to **results** channel after *Add Result*.\\n' +
            'Shows both team logos, final score (always fits the box), winner badge.',
          inline: false,
        },
        {
          name: '🏅 Standings Image',
          value:
            'Posted to **results** channel after every result.\\n' +
            'Shows all groups, W/D/L/GD/PTS, top-2 highlighted in green.',
          inline: false,
        },
        {
          name: '🔒 Manager Permission',
          value:
            'Buttons that change data require **Manage Server**, **Administrator**, or a role named **manager**, **admin**, or **tournament**.',
          inline: false,
        },
        {
          name: '📡 Channels',
          value:
            'NSEL and MCL each have their own channels configured in the bot:\\n' +
            '• **team-list** — team database\\n' +
            '• **match-schedule** — fixture images\\n' +
            '• **results** — result + standings images',
          inline: false,
        },
      )
      .setFooter({ text: 'Page 3 / 3  —  Night Stars eFootball Manager' });

    await interaction.reply({ embeds: [e1, e2, e3], ephemeral: true });
  },
};
`;
fs.writeFileSync(BOT + '/src/commands/help.js', helpCode, 'utf8');
console.log('help.js rewritten');

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Syntax checks
// ═══════════════════════════════════════════════════════════════════════════════
const { execSync } = require('child_process');
for (const f of ['src/utils/imageGen.js', 'src/commands/help.js']) {
  try {
    execSync(\`node --check \${BOT}/\${f}\`);
    console.log('✅', f);
  } catch(e) {
    console.error('❌', f, e.stderr?.toString().slice(0,200));
    process.exit(1);
  }
}
console.log('All patches applied successfully.');
