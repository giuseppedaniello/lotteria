// Disegna il biglietto su un canvas e lo restituisce come immagine PNG (da salvare o mandare su WhatsApp).
// Riceve i dati già decodificati dal link del biglietto.

import { euro, fmtDate } from './util.js';
import { winPhrase } from './domain.js';

const THEME = {
  natale: {accent:'#1E5B45', accent2:'#C8102E', tint:'#E6EFEA', orn:'star'},
  pasqua: {accent:'#5E4596', accent2:'#E9B100', tint:'#F0ECF8', orn:'egg'},
  altro:  {accent:'#1D2A6B', accent2:'#C8102E', tint:'#ECEEF7', orn:'token'}
};
const INK = '#1D2A6B', MUTED = '#5A607E', PAPER = '#FFFDF8', LINE = '#DCD9CF';
const COND = '"Barlow Condensed", "Roboto Condensed", "Arial Narrow", sans-serif';
const BODY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const W = 1080, PAD = 70, CW = W - PAD * 2;

function wrap(ctx, text, max){
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  for(const w of words){
    const test = line ? line + ' ' + w : w;
    if(ctx.measureText(test).width > max && line){ lines.push(line); line = w; } else line = test;
  }
  if(line) lines.push(line);
  return lines;
}
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function dots(ctx, x, y, w, h, step, r, color){
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = color;
  for(let yy = y; yy < y + h + step; yy += step) for(let xx = x + ((yy - y) / step % 2 ? step / 2 : 0); xx < x + w + step; xx += step){ ctx.beginPath(); ctx.arc(xx, yy, r, 0, 7); ctx.fill(); }
  ctx.restore();
}
function ornament(ctx, kind, x, y, size, th){
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
  if(kind === 'star'){ ctx.fillStyle = '#E0A526'; ctx.fill(new Path2D('M12 1.8l2.9 6.4 7 .7-5.3 4.7 1.5 6.9L12 16.9l-6.1 3.6 1.5-6.9L2.1 8.9l7-.7z')); }
  else if(kind === 'egg'){
    ctx.fillStyle = th.accent2; ctx.fill(new Path2D('M12 1.5C8 1.5 4.6 8.6 4.6 14a7.4 7.4 0 0014.8 0c0-5.4-3.4-12.5-7.4-12.5z'));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(new Path2D('M5.2 12.4l2.3-1.8 2.3 1.8 2.2-1.8 2.3 1.8 2.3-1.8 2.2 1.8'));
  } else { ctx.fillStyle = '#E3B877'; ctx.beginPath(); ctx.arc(12, 12, 10, 0, 7); ctx.fill(); ctx.strokeStyle = '#A9773A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(12, 12, 6.5, 0, 7); ctx.stroke(); }
  ctx.restore();
}
function token(ctx, cx, cy, r, n, ring){
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 26, 0, 7); ctx.fillStyle = ring; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, 7); ctx.fillStyle = PAPER; ctx.fill();
  ctx.shadowColor = 'rgba(59,36,16,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  const g = ctx.createRadialGradient(cx - r * .3, cy - r * .4, r * .05, cx, cy, r * 1.05);
  g.addColorStop(0, '#F7E0B5'); g.addColorStop(.5, '#E3B877'); g.addColorStop(1, '#A9773A');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#3B2410'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${n > 9 ? r * 1.2 : r * 1.35}px ${COND}`; ctx.fillText(String(n), cx, cy + r * .06);
  ctx.restore();
}

export async function ticketImage(p){
  try{ await Promise.all([document.fonts.load(`700 100px ${COND}`), document.fonts.load(`600 40px ${COND}`)]); }catch(e){}
  const th = THEME[p.th] || THEME.altro;
  const c = document.createElement('canvas'); c.width = W; c.height = 2400;
  const ctx = c.getContext('2d');
  ctx.fillStyle = th.tint; ctx.fillRect(0, 0, W, c.height);
  dots(ctx, 0, 0, W, c.height, 56, 4, 'rgba(0,0,0,.05)');

  const X = PAD, IW = CW - 120; // larghezza utile del testo nella testata
  // Testata
  ctx.font = `700 104px ${COND}`;
  const title = wrap(ctx, p.l, IW - 60).slice(0, 3);
  const headH = 90 + title.length * 98 + (p.o ? 70 : 10) + 50;
  const top = PAD;
  // Corpo: misure
  ctx.font = `700 84px ${COND}`; const nameLines = wrap(ctx, p.h, CW - 420).slice(0, 2);
  ctx.font = `600 40px ${BODY}`;
  const facts = [];
  if(p.z) facts.push(['Premio', p.z]);
  facts.push(['Estrazione', `${fmtDate(p.d)}, ore ${p.tm || '20:00'}`]);
  facts.push(['Vinci se', winPhrase(p.n, p.ps, p.w)]);
  const factLines = facts.map(([k, v]) => [k, wrap(ctx, v, CW - 2 * 60 - 230)]);
  ctx.font = `400 36px ${BODY}`; const noteLines = p.x ? wrap(ctx, p.x, CW - 120).slice(0, 4) : [];
  const heroH = 400;
  const factsH = factLines.reduce((h, [, l]) => h + l.length * 54 + 26, 0);
  const notesH = noteLines.length ? noteLines.length * 50 + 20 : 0;
  const stubH = 150;
  // stessi incrementi usati sotto per disegnare: testata, gettone, dati, note, strappo, matrice
  const perfY = top + headH + 60 + heroH + 20 + factsH + notesH + 40;
  const cardH = perfY + stubH - top;
  const H = top + cardH + 120;

  // Carta del biglietto
  ctx.save(); ctx.shadowColor = 'rgba(20,28,72,.28)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  roundRect(ctx, X, top, CW, cardH, 44); ctx.fillStyle = PAPER; ctx.fill(); ctx.restore();
  // Testata colorata
  ctx.save(); roundRect(ctx, X, top, CW, cardH, 44); ctx.clip();
  ctx.fillStyle = th.accent; ctx.fillRect(X, top, CW, headH);
  dots(ctx, X, top, CW, headH, 46, 4, 'rgba(255,255,255,.14)');
  const stripeY = top + headH - 22;
  ctx.save(); ctx.beginPath(); ctx.rect(X, stripeY, CW, 22); ctx.clip();
  for(let x = X - 40; x < X + CW + 40; x += 44){
    ctx.fillStyle = th.accent2; ctx.beginPath(); ctx.moveTo(x, stripeY + 22); ctx.lineTo(x + 22, stripeY); ctx.lineTo(x + 44, stripeY); ctx.lineTo(x + 22, stripeY + 22); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 22, stripeY + 22); ctx.lineTo(x + 44, stripeY); ctx.lineTo(x + 66, stripeY); ctx.lineTo(x + 44, stripeY + 22); ctx.fill();
  }
  ctx.restore(); ctx.restore();
  ornament(ctx, th.orn, X + CW - 60 - 120, top + 50, 120, th);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `700 104px ${COND}`;
  title.forEach((line, i) => ctx.fillText(line, X + 60, top + 150 + i * 98));
  if(p.o){ ctx.font = `400 40px ${BODY}`; ctx.globalAlpha = .9; ctx.fillText(`Organizzata da ${p.o}${p.k ? ', ' + p.k : ''}`, X + 60, top + 150 + (title.length - 1) * 98 + 76, IW); ctx.globalAlpha = 1; }

  // Gettone e intestatario
  let y = top + headH + 60;
  token(ctx, X + 60 + 150, y + 150, 150, p.n, th.accent2);
  const tx = X + 60 + 300 + 70;
  ctx.fillStyle = MUTED; ctx.font = `400 38px ${BODY}`; ctx.fillText('Biglietto intestato a', tx, y + 110 - (nameLines.length - 1) * 40);
  ctx.fillStyle = INK; ctx.font = `700 84px ${COND}`;
  nameLines.forEach((l, i) => ctx.fillText(l, tx, y + 190 + i * 80 - (nameLines.length - 1) * 40));
  if(p.q){ ctx.fillStyle = MUTED; ctx.font = `400 38px ${BODY}`; ctx.fillText(`Prezzo ${euro(p.q)}`, tx, y + 250 + (nameLines.length - 1) * 40); }
  y += heroH;

  // Dati dell'estrazione
  ctx.strokeStyle = LINE; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X + 60, y - 30); ctx.lineTo(X + CW - 60, y - 30); ctx.stroke();
  y += 20;
  factLines.forEach(([k, lines]) => {
    ctx.fillStyle = MUTED; ctx.font = `400 36px ${BODY}`; ctx.fillText(k, X + 60, y + 40);
    ctx.fillStyle = INK; ctx.font = `600 40px ${BODY}`;
    lines.forEach((l, i) => ctx.fillText(l, X + 60 + 230, y + 40 + i * 54));
    y += lines.length * 54 + 26;
  });
  if(noteLines.length){ ctx.fillStyle = MUTED; ctx.font = `400 36px ${BODY}`; noteLines.forEach((l, i) => ctx.fillText(l, X + 60, y + 40 + i * 50)); y += notesH; }
  y += 40;

  // Linea a strappo con le tacche
  ctx.save(); ctx.setLineDash([18, 14]); ctx.strokeStyle = LINE; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(X + 50, y); ctx.lineTo(X + CW - 50, y); ctx.stroke(); ctx.restore();
  ctx.fillStyle = th.tint; [X, X + CW].forEach(cx => { ctx.beginPath(); ctx.arc(cx, y, 30, 0, 7); ctx.fill(); });
  // Matrice
  ctx.textBaseline = 'middle';
  ctx.fillStyle = th.accent; ctx.font = `700 78px ${COND}`; ctx.fillText(`N. ${p.n}`, X + 60, y + stubH / 2 + 4);
  ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = `700 64px ${COND}`;
  const code = p.c.split('').join(String.fromCharCode(8202));
  ctx.fillText(code, X + CW - 60, y + stubH / 2 + 4);
  const cw = ctx.measureText(code).width;
  ctx.fillStyle = MUTED; ctx.font = `400 34px ${BODY}`; ctx.fillText('Codice', X + CW - 60 - cw - 22, y + stubH / 2 + 4);
  ctx.textAlign = 'left';
  // Piede
  ctx.fillStyle = 'rgba(29,42,107,.55)'; ctx.font = `400 30px ${BODY}`; ctx.textAlign = 'center';
  ctx.fillText('L’organizzatore può verificare il biglietto con il codice.', W / 2, top + cardH + 72, CW);

  // Ritaglia all'altezza effettiva
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  out.getContext('2d').drawImage(c, 0, 0);
  return new Promise(res => out.toBlob(res, 'image/png'));
}
