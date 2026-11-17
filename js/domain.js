// Regole del gioco e formati dei dati: vincitore, firme, link di biglietto ed esito, messaggi.
// Non sa nulla di dove sono salvati i dati né di come vengono mostrati.

import { hmac, bytesB64u, b64e, b64d } from './crypto.js';
import { rid, ord, fmtDate, fmtShort, firstName, baseUrl } from './util.js';

export const OFFICIAL_URL = 'https://www.sisal.it/lotto/ultima-estrazione'; // dove controllare i numeri estratti
export const WHEELS = ['Bari','Cagliari','Firenze','Genova','Milano','Napoli','Palermo','Roma','Torino','Venezia','Nazionale'];
export const THEMES = {natale:'Natale', pasqua:'Pasqua', altro:'Altro'};

export const newLotteryId = () => rid(8);
export const newSecret = () => rid(24);
export function newTicketCode(lotteries){ let c; do { c = rid(6); } while(lotteries.some(l => l.tickets.some(t => t.code === c))); return c; }

export function wheelName(w){ return w === 'Nazionale' ? 'ruota Nazionale' : 'ruota di ' + w; }
export function wheelLabel(w){ return w === 'live' ? 'estrazione dal vivo' : 'Lotto, ' + wheelName(w); }
/* "il 45 esce come 1° estratto sulla ruota di Napoli" */
export function winPhrase(n, pos, w){ return w === 'live' ? `il ${n} è il ${pos === 1 ? 'primo numero estratto' : ord(pos) + ' numero estratto'}` : `il ${n} esce come ${ord(pos)} estratto sulla ${wheelName(w)}`; }

/* ---------- Biglietti ed esito ---------- */
export const ticketOf = (lot, n) => lot.tickets.find(t => t.n === n);
export const byNum = lot => [...lot.tickets].sort((a, b) => a.n - b.n);
export function lotStats(lot){
  let paid = 0, due = 0;
  lot.tickets.forEach(t => { if(t.paid) paid += lot.price || 0; else due += lot.price || 0; });
  return {sold: lot.tickets.length, paid, due};
}
/* Parte dall'estratto scelto (es. 1°); se il numero non è venduto e la regola lo prevede, passa al successivo */
export function outcome(lot){
  const ex = (lot.result && lot.result.extracted) || [];
  const skipped = [];
  for(let k = lot.pos; k <= 5; k++){
    const n = ex[k - 1];
    if(!n) return {winner:null, skipped, pending:true, nextPos:k};
    const t = ticketOf(lot, n);
    if(t) return {winner:t, number:n, from:k, skipped};
    skipped.push({n, pos:k});
    if(lot.rule === 'none') return {winner:null, skipped, pending:false};
  }
  return {winner:null, skipped, pending:false};
}

/* ---------- Firma ---------- */
function sigMsg(lid, t){ return [lid, t.code, t.n, String(t.name).trim()].join('|'); }
export function ticketSig(lot, t){ return bytesB64u(hmac(lot.secret, sigMsg(lot.id, t)).slice(0, 9)); }

/* ---------- Link ---------- */
function ticketPayload(lot, t){
  return {v:2, i:lot.id, c:t.code, h:t.name, n:t.n, l:lot.name, z:lot.prize, o:lot.organizer || '', k:lot.contact || '',
    th:lot.theme, d:lot.drawDate || '', tm:lot.drawTime || '', w:lot.wheel, ps:lot.pos, r:lot.rule, q:lot.price || 0,
    x:(lot.notes || '').slice(0, 400), s:ticketSig(lot, t)};
}
export const ticketLink = (lot, t) => baseUrl() + '#/t/' + b64e(JSON.stringify(ticketPayload(lot, t)));
function resultPayload(lot, withName){
  const o = outcome(lot);
  return {v:2, l:lot.name, z:lot.prize, o:lot.organizer || '', th:lot.theme, d:lot.drawDate || '', tm:lot.drawTime || '', w:lot.wheel, ps:lot.pos,
    e:(lot.result.extracted || []).map(n => n || 0), n:o.winner ? o.number : 0, f:o.winner ? o.from : 0, h:(withName && o.winner) ? o.winner.name : ''};
}
export const resultLink = (lot, nm) => baseUrl() + '#/r/' + b64e(JSON.stringify(resultPayload(lot, nm)));

const str = (v, max = 200) => typeof v === 'string' ? v.slice(0, max) : '';
const okNum = v => { v = parseInt(v); return v >= 1 && v <= 90 ? v : 0; };
export const okPos = v => Math.min(5, Math.max(1, parseInt(v) || 1));
const okWheel = w => (w === 'live' || WHEELS.includes(w)) ? w : 'Napoli';
export function decodeTicket(seg){
  try{
    const p = JSON.parse(b64d(seg));
    if(!p || p.v !== 2 || !okNum(p.n)) return null;
    return {i:str(p.i,40), c:str(p.c,20), h:str(p.h,80), n:okNum(p.n), l:str(p.l,120) || 'Lotteria', z:str(p.z,160), o:str(p.o,80), k:str(p.k,80),
      th: THEMES[p.th] ? p.th : 'altro', d:str(p.d,10), tm:str(p.tm,5), w:okWheel(p.w), ps:okPos(p.ps),
      r: p.r === 'none' ? 'none' : 'next', q: Math.max(0, Number(p.q) || 0), x:str(p.x,400), s:str(p.s,40)};
  }catch(e){ return null; }
}
export function decodeResult(seg){
  try{
    const p = JSON.parse(b64d(seg)); if(!p || p.v !== 2 || !Array.isArray(p.e)) return null;
    return {l:str(p.l,120) || 'Lotteria', z:str(p.z,160), o:str(p.o,80), th: THEMES[p.th] ? p.th : 'altro', d:str(p.d,10), tm:str(p.tm,5),
      w:okWheel(p.w), ps:okPos(p.ps), e:p.e.slice(0,5).map(okNum), n:okNum(p.n), f:okPos(p.f), h:str(p.h,80)};
  }catch(e){ return null; }
}

/* ---------- Messaggi da inviare ---------- */
const themeEmoji = th => th === 'natale' ? '🎄 ' : th === 'pasqua' ? '🐣 ' : '';
export function ticketMessage(lot, t){
  const nm = firstName(t.name);
  return `${themeEmoji(lot.theme)}Ciao${nm ? ' ' + nm : ''}! Ecco il tuo biglietto n. ${t.n} per «${lot.name}». ` +
    `Vinci ${lot.prize ? '«' + lot.prize + '» ' : ''}se ${winPhrase(t.n, lot.pos, lot.wheel)}. Estrazione: ${fmtDate(lot.drawDate)}, ore ${lot.drawTime || '20:00'}.\nConserva questo link, è il tuo biglietto:`;
}
export function bundleMessage(lot, list){
  const nm = firstName(list[0].name);
  return `${themeEmoji(lot.theme)}Ciao${nm ? ' ' + nm : ''}! Ecco i tuoi ${list.length} biglietti per «${lot.name}»: ${list.map(t => t.n).join(', ')}. ` +
    `Vinci ${lot.prize ? '«' + lot.prize + '» ' : ''}se uno dei tuoi numeri è il ${ord(lot.pos)} estratto ${lot.wheel === 'live' ? 'dal vivo' : 'sulla ' + wheelName(lot.wheel)}. Estrazione: ${fmtDate(lot.drawDate)}, ore ${lot.drawTime || '20:00'}.\n` +
    list.map(t => `Biglietto n. ${t.n}: ${ticketLink(lot, t)}`).join('\n');
}
export function winnerMessage(lot, o){
  return `${themeEmoji(lot.theme)}Complimenti ${firstName(o.winner.name)}! È uscito il ${o.number}: con il tuo biglietto hai vinto ${lot.prize ? '«' + lot.prize + '»' : 'il premio'} di «${lot.name}». Ci sentiamo per la consegna!`;
}
export function resultMessage(lot){
  const o = outcome(lot);
  const line = o.winner ? `Il numero vincente è il ${o.number} (${ord(o.from)} estratto${lot.wheel === 'live' ? '' : ', ' + wheelName(lot.wheel)}).` : 'Il numero estratto non era stato venduto: nessun vincitore.';
  return `${themeEmoji(lot.theme)}Estrazione di «${lot.name}» del ${fmtShort(lot.drawDate)}. ${line}\nDettagli:`;
}

/* ---------- Pulizia dei dati in ingresso (backup, migrazione) ---------- */
const LOT_FIELDS = ['name','prize','theme','drawDate','drawTime','wheel','pos','rule','price','organizer','contact','notes','secret','result','createdAt'];
export function cleanLottery(l){
  const out = {}; LOT_FIELDS.forEach(k => { if(l[k] !== undefined) out[k] = l[k]; });
  out.result = l.result && Array.isArray(l.result.extracted) ? {extracted: l.result.extracted.slice(0,5).map(n => okNum(n) || null), at: l.result.at || Date.now()} : null;
  return out;
}
export function cleanTicket(t){
  return {n: okNum(t.n), code: String(t.code || ''), name: String(t.name || ''), phone: String(t.phone || ''), paid: !!t.paid, note: String(t.note || ''), createdAt: t.createdAt || Date.now()};
}
export const isValidBackupLottery = l => l && typeof l.id === 'string' && l.secret && Array.isArray(l.tickets);
