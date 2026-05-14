'use strict';
const fs = require('fs');
const src_path = '/home/ubuntu/goatsi/src/utils/imageGen.js';
let src = fs.readFileSync(src_path, 'utf8');

// 1. Add loadImage to canvas import
src = src.replace(
  "const { createCanvas } = require('canvas');",
  "const { createCanvas, loadImage } = require('canvas');"
);

// 2. Insert drawTeamLogoAsync after closing brace of drawCrest
const insertAnchor = "  ctx.textBaseline = 'alphabetic';\n  ctx.restore();\n}";
const logoFn = `

// ─── Async logo draw: real badge from URL, falls back to drawCrest ────────────
async function drawTeamLogoAsync(ctx, cx, cy, rw, rh, team, isWinner) {
  if (team && team.logo_url) {
    try {
      const img = await loadImage(team.logo_url);
      ctx.save();
      if (isWinner) {
        const glow = ctx.createRadialGradient(cx, cy, rw * 0.5, cx, cy, rw * 1.65);
        glow.addColorStop(0, 'rgba(255,210,0,0.5)');
        glow.addColorStop(1, 'rgba(255,210,0,0)');
        crestPath(ctx, cx, cy, rw * 1.55, rh * 1.55);
        ctx.fillStyle = glow; ctx.fill();
      }
      crestPath(ctx, cx, cy, rw, rh);
      ctx.fillStyle = '#111'; ctx.fill();
      ctx.save();
      crestPath(ctx, cx, cy, rw, rh);
      ctx.clip();
      const scale = Math.min((rw * 2 * 0.85) / img.width, (rh * 2 * 0.85) / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2 + rh * 0.04, dw, dh);
      ctx.restore();
      crestPath(ctx, cx, cy, rw, rh);
      ctx.strokeStyle = isWinner ? '#FFD700' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(2, rw * 0.05); ctx.stroke();
      ctx.restore();
      return;
    } catch (_) {}
  }
  drawCrest(ctx, cx, cy, rw, rh, team, isWinner);
}`;

// Only insert once
if (!src.includes('drawTeamLogoAsync')) {
  src = src.replace(insertAnchor, insertAnchor + logoFn);
}

// 3. Make generateScheduleImage async
src = src.replace(
  'function generateScheduleImage(',
  'async function generateScheduleImage('
);

// 4. Make generateResultImage async
src = src.replace(
  'function generateResultImage(',
  'async function generateResultImage('
);

// 5. Replace drawCrest in schedule (home & away row)
src = src.replace(
  '    drawCrest(ctx, homeCX, midY, CRW, CRH, home, false);',
  '    await drawTeamLogoAsync(ctx, homeCX, midY, CRW, CRH, home, false);'
);
src = src.replace(
  '    drawCrest(ctx, awayCX, midY, CRW, CRH, away, false);',
  '    await drawTeamLogoAsync(ctx, awayCX, midY, CRW, CRH, away, false);'
);

// 6. Replace drawCrest in result (home & away large crests)
src = src.replace(
  '  drawCrest(ctx, HOME_CX, MATCH_CY, CRW, CRH, homeTeam, homeWon);',
  '  await drawTeamLogoAsync(ctx, HOME_CX, MATCH_CY, CRW, CRH, homeTeam, homeWon);'
);
src = src.replace(
  '  drawCrest(ctx, AWAY_CX, MATCH_CY, CRW, CRH, awayTeam, awayWon);',
  '  await drawTeamLogoAsync(ctx, AWAY_CX, MATCH_CY, CRW, CRH, awayTeam, awayWon);'
);

fs.writeFileSync(src_path, src);

// Verify
const out = fs.readFileSync(src_path, 'utf8');
console.log('loadImage import:         ', out.includes("const { createCanvas, loadImage }"));
console.log('drawTeamLogoAsync defined: ', out.includes('async function drawTeamLogoAsync'));
console.log('async generateSchedule:   ', out.includes('async function generateScheduleImage'));
console.log('async generateResult:     ', out.includes('async function generateResultImage'));
console.log('schedule home logo:       ', out.includes('await drawTeamLogoAsync(ctx, homeCX'));
console.log('schedule away logo:       ', out.includes('await drawTeamLogoAsync(ctx, awayCX'));
console.log('result home logo:         ', out.includes('await drawTeamLogoAsync(ctx, HOME_CX'));
console.log('result away logo:         ', out.includes('await drawTeamLogoAsync(ctx, AWAY_CX'));
console.log('DONE');
