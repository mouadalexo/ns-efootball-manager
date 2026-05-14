'use strict';
const fs = require('fs');
const path = '/home/ubuntu/goatsi/src/utils/imageGen.js';
let src = fs.readFileSync(path, 'utf8');

// Replace the forEach loop in generateScheduleImage with a for...of loop
// Original forEach block:
const oldForEach = `  allMatches.forEach((m, i) => {
    const home = getTeam(m.home_team_id);
    const away = getTeam(m.away_team_id);
    const rowY = HDR_H + i * ROW_H;
    const midY = rowY + ROW_H / 2;

    if (i % 2 === 1) {
      ctx.fillStyle = C.cardAlt;
      ctx.fillRect(cardX + 1, rowY, cardW - 2, ROW_H);
    }

    // Match index + group tag
    ctx.fillStyle = C.textMid;
    ctx.font = '13px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(\`\${String(i + 1).padStart(2, '0')}\${m.group_name ? \`  GRP \${m.group_name}\` : ''}\`, cardX + 14, midY + 5);

    // HOME: name right-aligned → crest
    const homeCX = MID_X - 140;
    await drawTeamLogoAsync(ctx, homeCX, midY, CRW, CRH, home, false);
    ctx.fillStyle = C.title;
    ctx.font = 'bold 19px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((home.name || 'TBD').toUpperCase().slice(0, 14), homeCX - CRW - 12, midY + 7);

    // VS
    ctx.fillStyle = C.score;
    ctx.font = 'bold 30px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', MID_X, midY + 10);

    // AWAY: crest → name left-aligned
    const awayCX = MID_X + 140;
    await drawTeamLogoAsync(ctx, awayCX, midY, CRW, CRH, away, false);
    ctx.fillStyle = C.title;
    ctx.font = 'bold 19px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((away.name || 'TBD').toUpperCase().slice(0, 14), awayCX + CRW + 12, midY + 7);

    // Row divider
    if (i < allMatches.length - 1) {
      ctx.strokeStyle = C.div;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 22, rowY + ROW_H);
      ctx.lineTo(cardX + cardW - 22, rowY + ROW_H);
      ctx.stroke();
    }
  });`;

const newForOf = `  for (let i = 0; i < allMatches.length; i++) {
    const m    = allMatches[i];
    const home = getTeam(m.home_team_id);
    const away = getTeam(m.away_team_id);
    const rowY = HDR_H + i * ROW_H;
    const midY = rowY + ROW_H / 2;

    if (i % 2 === 1) {
      ctx.fillStyle = C.cardAlt;
      ctx.fillRect(cardX + 1, rowY, cardW - 2, ROW_H);
    }

    // Match index + group tag
    ctx.fillStyle = C.textMid;
    ctx.font = '13px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(\`\${String(i + 1).padStart(2, '0')}\${m.group_name ? \`  GRP \${m.group_name}\` : ''}\`, cardX + 14, midY + 5);

    // HOME: name right-aligned → crest
    const homeCX = MID_X - 140;
    await drawTeamLogoAsync(ctx, homeCX, midY, CRW, CRH, home, false);
    ctx.fillStyle = C.title;
    ctx.font = 'bold 19px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((home.name || 'TBD').toUpperCase().slice(0, 14), homeCX - CRW - 12, midY + 7);

    // VS
    ctx.fillStyle = C.score;
    ctx.font = 'bold 30px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', MID_X, midY + 10);

    // AWAY: crest → name left-aligned
    const awayCX = MID_X + 140;
    await drawTeamLogoAsync(ctx, awayCX, midY, CRW, CRH, away, false);
    ctx.fillStyle = C.title;
    ctx.font = 'bold 19px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((away.name || 'TBD').toUpperCase().slice(0, 14), awayCX + CRW + 12, midY + 7);

    // Row divider
    if (i < allMatches.length - 1) {
      ctx.strokeStyle = C.div;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 22, rowY + ROW_H);
      ctx.lineTo(cardX + cardW - 22, rowY + ROW_H);
      ctx.stroke();
    }
  }`;

if (src.includes(oldForEach)) {
  src = src.replace(oldForEach, newForOf);
  console.log('forEach → for...of replaced OK');
} else {
  // Fallback: find and replace just the forEach signature
  console.log('Exact match failed — trying fallback replace...');
  src = src.replace(
    /allMatches\.forEach\(\(m,\s*i\)\s*=>\s*\{/,
    'for (let i = 0; i < allMatches.length; i++) {\n    const m = allMatches[i];'
  );
  // Replace closing }); of forEach with just }
  // This is risky without exact context, so log a warning
  console.log('WARNING: fallback used — verify imageGen.js manually');
}

fs.writeFileSync(path, src);

// Verify syntax
const { execSync } = require('child_process');
try {
  execSync('node --check ' + path, { stdio: 'pipe' });
  console.log('Syntax OK');
} catch (e) {
  console.error('Syntax ERROR:', e.stderr.toString().slice(0, 300));
}
