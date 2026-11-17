// Funzioni di supporto senza dipendenze: DOM, testo, date, numeri, condivisione.

export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function rid(n = 6){ const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, x => ALPH[x & 31]).join(''); }
export function randInt(max){ const a = new Uint32Array(1), lim = Math.floor(0x100000000 / max) * max; do { crypto.getRandomValues(a); } while(a[0] >= lim); return a[0] % max; }

export const euro = n => (Number(n) || 0).toLocaleString('it-IT', {style:'currency', currency:'EUR'});
export const ord = n => n + '°';
export function parsePrice(v){ const n = parseFloat(String(v || '').replace(',', '.')); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; }
export function firstName(n){ return String(n || '').trim().split(/\s+/)[0] || ''; }
export const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
export function baseUrl(){ return location.href.split('#')[0]; }

/* ---------- Date ---------- */
export function parseD(d){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
export function fmtDate(d){ const x = parseD(d); return x ? x.toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) : 'data da definire'; }
export function fmtShort(d){ const x = parseD(d); return x ? x.toLocaleDateString('it-IT', {day:'numeric', month:'long', year:'numeric'}) : 'data da definire'; }
export function isDrawDay(d){ const x = parseD(d); return !!x && [2, 4, 5, 6].includes(x.getDay()); }
function drawMoment(d, tm){ const x = parseD(d); if(!x) return null; const [h, m] = (tm || '20:00').split(':').map(Number); x.setHours(h || 0, m || 0, 0, 0); return x; }
export function countdown(d, tm){
  const t = drawMoment(d, tm); if(!t) return '';
  const diff = t - Date.now(); if(diff <= 0) return '';
  const days = Math.floor(diff / 864e5);
  if(days >= 1) return days === 1 ? "Manca 1 giorno all'estrazione" : `Mancano ${days} giorni all'estrazione`;
  const h = Math.floor(diff / 36e5);
  if(h >= 1) return h === 1 ? "Manca 1 ora all'estrazione" : `Mancano ${h} ore all'estrazione`;
  const m = Math.max(1, Math.floor(diff / 6e4));
  return m === 1 ? "Manca 1 minuto all'estrazione" : `Mancano ${m} minuti all'estrazione`;
}

/* ---------- Condivisione ---------- */
export function waPhone(p){
  const raw = String(p || '').trim(); if(!raw) return '';
  const d = raw.replace(/\D/g, '');
  if(raw.startsWith('+')) return d;
  if(d.startsWith('00')) return d.slice(2);
  if(d.length === 10 && d.startsWith('3')) return '39' + d;
  return d.length >= 8 ? d : '';
}
export async function copyText(s){
  try{ await navigator.clipboard.writeText(s); return true; }
  catch(e){
    const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try{ ok = document.execCommand('copy'); }catch(_){}
    ta.remove(); return ok;
  }
}
export function openWhatsApp(phone, text){ window.open('https://wa.me/' + (waPhone(phone) || '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); }
export async function shareAny(title, text, url){
  if(navigator.share){ try{ await navigator.share(url ? {title, text, url} : {title, text}); return; }catch(e){ if(e && e.name === 'AbortError') return; } }
  if(await copyText(url ? text + '\n' + url : text)) toast('Messaggio copiato: incollalo dove vuoi');
}
export function download(name, content, type){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type})); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg){
  let el = $('.toast'); if(!el){ el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 3200);
}
