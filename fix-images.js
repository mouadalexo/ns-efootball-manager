'use strict';
const fs = require('fs');
const path = '/home/ubuntu/goatsi/src/utils/imageGen.js';
let src = fs.readFileSync(path, 'utf8');

// ── FIX 1: generateScheduleImage – remove Math.max(1350, ...) ────────────────
src = src.replace(
  /const H = Math\.max\(1350, HDR_H \+ allMatches\.length \* ROW_H \+ FOOT_H\);/,
  'const H = HDR_H + allMatches.length * ROW_H + FOOT_H + 20;'
);

// ── FIX 2: generateResultImage – dynamic score font size ─────────────────────
src = src.replace(
  /\/\/ Score box — big red center\s*\n\s*rr\(ctx, MID_X - 130, MATCH_CY - 76, 260, 140, 20, 'rgba\(100,0,0,0\.55\)'\);\s*\n\s*ctx\.fillStyle = C\.score;\s*\n\s*ctx\.font = 'bold 104px "DejaVu Sans", Arial, sans-serif';\s*\n\s*ctx\.textAlign = 'center';\s*\n\s*ctx\.fillText\(`\$\{hs\} – \$\{as_\}`, MID_X, MATCH_CY \+ 50\);/,
  `// Score box — dynamic font size so long scores (10-10) don't overflow
  const scoreStr = \`\${hs} – \${as_}\`;
  const scoreFontSize = scoreStr.length <= 5 ? 104 : scoreStr.length <= 7 ? 86 : 72;
  const boxW = 280, boxH = Math.max(140, scoreFontSize + 36);
  rr(ctx, MID_X - boxW/2, MATCH_CY - boxH/2 + 24, boxW, boxH, 20, 'rgba(100,0,0,0.55)');
  ctx.fillStyle = C.score;
  ctx.font = \`bold \${scoreFontSize}px "DejaVu Sans", Arial, sans-serif\`;
  ctx.textAlign = 'center';
  ctx.fillText(scoreStr, MID_X, MATCH_CY + scoreFontSize * 0.35 + 24);`
);

// ── FIX 3: generateStandingsImage – remove forced 1350px min, scale up layout
// Remove the entire function and replace with corrected version
const standingsStart = src.indexOf('function generateStandingsImage(tournament, groupedStandings) {');
const standingsEnd = src.indexOf('\n// ─── 6. Group Draw image', standingsStart);
if (standingsStart === -1 || standingsEnd === -1) {
  console.error('Could not find generateStandingsImage bounds');
  process.exit(1);
}

const newStandings = `function generateStandingsImage(tournament, groupedStandings) {
  const groupEntries = Object.entries(groupedStandings).sort();
  const PER_ROW = 2;
  const W = 1080;
  const BAND = 180;           // reduced from 210 → wider group cards
  const PAD = 24;
  const GRP_GAP = 20;
  const GRP_W = Math.floor((W - BAND * 2 - PAD * 2 - GRP_GAP) / PER_ROW); // 326
  const HDR_H = 274;
  const GRP_HDR = 64;         // increased from 48
  const COL_HDR = 36;         // increased from 28
  const ROW_H = 76;           // increased from 58
  const FOOT_H = 80;
  const maxTeams = Math.max(...groupEntries.map(([, g]) => g.length));
  const numRows = Math.ceil(groupEntries.length / PER_ROW);
  const grpH = GRP_HDR + COL_HDR + maxTeams * ROW_H + 24;
  // Fit content exactly — no arbitrary 1350 minimum
  const H = HDR_H + numRows * (grpH + GRP_GAP) + FOOT_H + PAD;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawPortraitBg(ctx, W, H);
  drawPortraitHeader(ctx, W, 'STANDINGS',
    tournament.name.toUpperCase() + '  —  GROUP STAGE');

  const startX = BAND + PAD;

  ctx.fillStyle = C.textMid;
  ctx.font = '16px "DejaVu Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Top 2 from each group advance to Knockout Stage', W / 2, 252);

  // Column header X offsets relative to gx (GRP_W=326)
  const SX = { P: GRP_W-196, W: GRP_W-160, D: GRP_W-124, L: GRP_W-88, GD: GRP_W-48, PTS: GRP_W-10 };

  let rowIdx = 0, colIdx = 0;
  for (const [groupName, gTeams] of groupEntries) {
    const gx = startX + colIdx * (GRP_W + GRP_GAP);
    const gy = HDR_H + rowIdx * (grpH + GRP_GAP) + PAD;

    // Group card bg
    rr(ctx, gx, gy, GRP_W, grpH, 14, C.card);

    // Group header bar
    rr(ctx, gx, gy, GRP_W, GRP_HDR, 14, C.cardAlt);
    ctx.fillStyle = C.cardAlt;
    ctx.fillRect(gx, gy + GRP_HDR - 14, GRP_W, 14);

    // Red left accent
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(gx, gy, 4, GRP_HDR);

    ctx.fillStyle = C.title;
    ctx.font = 'bold 22px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(\`GROUP \${groupName}\`, gx + GRP_W / 2, gy + GRP_HDR / 2 + 8);

    // Column headers
    const hY = gy + GRP_HDR + COL_HDR - 8;
    ctx.fillStyle = C.textMid;
    ctx.font = 'bold 11px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TEAM', gx + 52, hY);
    for (const [k, ox] of Object.entries(SX)) {
      ctx.textAlign = 'center';
      ctx.fillText(k, gx + ox, hY);
    }
    ctx.strokeStyle = C.div; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx + 2, hY + 6); ctx.lineTo(gx + GRP_W - 2, hY + 6); ctx.stroke();

    gTeams.forEach((team, i) => {
      const qualified = i < 2;
      const ry = gy + GRP_HDR + COL_HDR + i * ROW_H;

      // Row bg
      ctx.fillStyle = qualified ? 'rgba(139,0,0,0.22)' : 'rgba(0,0,0,0.0)';
      ctx.fillRect(gx + 2, ry, GRP_W - 4, ROW_H - 1);

      // Left qualification bar
      ctx.fillStyle = qualified ? C.win : C.loss;
      ctx.fillRect(gx + 2, ry, 3, ROW_H - 1);

      // Rank number
      ctx.fillStyle = qualified ? C.win : C.textMid;
      ctx.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), gx + 14, ry + ROW_H / 2 + 5);

      // Team dot (initial circle)
      dot(ctx, gx + 30, ry + ROW_H / 2, 14, team.name);

      // Team name — truncated to fit before first stat column
      const nameMaxChars = 12;
      ctx.fillStyle = qualified ? C.title : C.textSub;
      ctx.font = \`\${qualified ? 'bold ' : ''}13px "DejaVu Sans", Arial, sans-serif\`;
      ctx.textAlign = 'left';
      ctx.fillText((team.name || 'TBD').slice(0, nameMaxChars), gx + 50, ry + ROW_H / 2 + 5);

      // Stats
      const gd = (team.goals_for || 0) - (team.goals_against || 0);
      const mp = (team.wins || 0) + (team.draws || 0) + (team.losses || 0);
      const stats = {
        P: mp,
        W: team.wins || 0,
        D: team.draws || 0,
        L: team.losses || 0,
        GD: (gd >= 0 ? '+' : '') + gd,
        PTS: team.points || 0,
      };
      for (const [k, ox] of Object.entries(SX)) {
        ctx.fillStyle = k === 'PTS' ? (qualified ? C.win : C.title) : C.textSub;
        ctx.font = k === 'PTS' ? 'bold 16px "DejaVu Sans", Arial, sans-serif' : '12px "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(stats[k]), gx + ox, ry + ROW_H / 2 + 5);
      }

      // Row divider
      if (i < gTeams.length - 1) {
        ctx.strokeStyle = C.div; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gx + 8, ry + ROW_H - 1); ctx.lineTo(gx + GRP_W - 8, ry + ROW_H - 1); ctx.stroke();
      }
    });

    colIdx++;
    if (colIdx >= PER_ROW) { colIdx = 0; rowIdx++; }
  }

  // Footer
  ctx.fillStyle = C.textMid;
  ctx.font = '15px "DejaVu Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NS eFootball Tournament  —  ' + tournament.name, W / 2, H - 38);

  // Bottom accent
  ctx.fillStyle = '#8B0000';
  ctx.fillRect(0, H - 10, W, 10);

  return canvas.toBuffer('image/png');
}
`;

src = src.slice(0, standingsStart) + newStandings + src.slice(standingsEnd);

fs.writeFileSync(path, src, 'utf8');
console.log('Patch written.');

// Syntax check
const { execSync } = require('child_process');
try {
  execSync('node --check ' + path);
  console.log('Syntax OK ✅');
} catch (e) {
  console.error('Syntax ERROR:', e.stderr?.toString());
  process.exit(1);
}
