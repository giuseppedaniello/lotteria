// Punto di ingresso: sceglie il repository (locale o Firebase), gestisce il router,
// i fogli a scomparsa, le azioni dei pulsanti e i form. Le viste sono in views.js.

import { FIREBASE_CONFIG } from './config.js';
import { $, esc, euro, ord, randInt, fmtDate, parsePrice, firstName, sameName, isDrawDay,
  copyText, openWhatsApp, shareAny, download, toast } from './util.js';
import { I } from './icons.js';
import { ticketOf, byNum, outcome, ticketSig, ticketLink, resultLink, decodeTicket, okPos,
  ticketMessage, bundleMessage, winnerMessage, resultMessage, newSecret, newTicketCode, isValidBackupLottery } from './domain.js';
import { S, ui, lots, getLot } from './state.js';
import * as V from './views.js';

const app = $('#app');
const PUBLIC = new Set(['t', 'r']);
const parts = () => location.hash.replace(/^#\/?/, '').split('/');

/* ---------- Repository ---------- */
let storePromise = null, renderQueued = false;
const hooks = {
  onChange(){ if(renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; liveRender(); }); },
  onError(e){ toast(errorText(e)); }
};
function errorText(e){
  const c = e && e.code || '';
  if(c === 'permission-denied' || c === 'firestore/permission-denied') return 'Il database ha rifiutato l’operazione: controlla le regole di Firestore.';
  if(c === 'auth/unauthorized-domain') return `Accesso bloccato: aggiungi ${location.hostname} ai domini autorizzati in Firebase Authentication.`;
  if(c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return 'Accesso annullato.';
  if(c === 'auth/network-request-failed' || c === 'unavailable') return 'Connessione assente: riprova quando sei online.';
  return (e && e.message) ? e.message : 'Qualcosa non ha funzionato.';
}
function ensureStore(){
  if(storePromise) return storePromise;
  const make = FIREBASE_CONFIG
    ? import('./store-firebase.js').then(m => m.createFirebaseStore(FIREBASE_CONFIG, hooks))
    : import('./store-local.js').then(m => m.createLocalStore(hooks));
  storePromise = make.then(s => { S.store = s; S.storeError = null; render(); return s; })
    .catch(e => { console.error(e); S.storeError = e; storePromise = null; render(); });
  return storePromise;
}
const ready = () => S.store && S.store.authKnown && (S.store.kind === 'local' || S.store.user);

/* Prima volta con Firebase: carica online le estrazioni salvate prima solo sul telefono */
let migrationChecked = false;
async function migrateLocalData(){
  const s = S.store;
  if(migrationChecked || s.kind !== 'firebase' || !s.user || !s.loaded) return;
  migrationChecked = true;
  const flag = 'lotteria-cesti.migrated.' + s.user.uid;
  if(localStorage.getItem(flag)) return;
  const { readLocalData } = await import('./store-local.js');
  const local = readLocalData().lotteries.filter(l => !getLot(l.id));
  if(local.length){
    const n = s.importLotteries(local, {replace:false});
    toast(n === 1 ? 'Ho caricato online l’estrazione salvata su questo telefono' : `Ho caricato online ${n} estrazioni salvate su questo telefono`);
  }
  localStorage.setItem(flag, String(Date.now()));
}

/* ---------- Router ---------- */
function route(){
  const p = parts(); const key = p.slice(0, 3).join('/');
  if(key !== ui.lastRoute){ ui.q = ''; window.scrollTo(0, 0); }
  ui.lastRoute = key;
  closeSheet();
  if(!PUBLIC.has(p[0])) ensureStore();
  render();
}
function render(){
  const p = parts();
  document.body.className = '';
  document.title = 'Lotteria dei cesti';
  let html;
  if(p[0] === 't' && p[1]) html = V.viewTicket(p[1]);
  else if(p[0] === 'r' && p[1]) html = V.viewResult(p[1]);
  else if(!S.store) html = S.storeError ? V.viewStoreError() : V.viewLoading();
  else if(!S.store.authKnown) html = V.viewLoading();
  else if(S.store.kind === 'firebase' && !S.store.user) html = V.viewLogin();
  else if(p[0] === 'nuova') html = V.viewEditor(null);
  else if(p[0] === 'modifica' && getLot(p[1])) html = V.viewEditor(getLot(p[1]));
  else if(p[0] === 'l' && getLot(p[1])){ ui.lotId = p[1]; html = V.viewLottery(getLot(p[1]), p[2] || 'tabellone'); }
  else if((p[0] === 'l' || p[0] === 'modifica') && !S.store.loaded) html = V.viewLoading();
  else if(p[0] === 'verifica') html = V.viewVerify();
  else html = V.viewHome();
  app.innerHTML = html;
}
/* Ridisegna quando cambiano i dati (anche da un altro dispositivo) senza disturbare chi sta scrivendo */
function liveRender(){
  if(S.store && S.store.loaded) migrateLocalData();
  const p = parts();
  if(PUBLIC.has(p[0])) return;
  if($('form[data-form=lottery]', app) || $('form[data-form=verify]', app) || $('form[data-form=draw] input:focus', app)) return;
  const y = window.scrollY, search = $('.search', app), focused = search && document.activeElement === search, pos = focused ? search.selectionStart : 0;
  render();
  window.scrollTo(0, y);
  if(focused){ const s = $('.search', app); if(s){ s.focus(); try{ s.setSelectionRange(pos, pos); }catch(_){} } }
}
const rerender = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
window.addEventListener('hashchange', route);

/* ---------- Fogli (bottom sheet) ---------- */
function openSheet(html, label){
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-back" data-act="sheet-back"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label || '')}"><div class="sheet-in"><div class="sheet-grip"></div>
    <button class="icon-btn x" data-act="sheet-close" aria-label="Chiudi">${I.close}</button>${html}</div></div></div>`;
  const sh = $('.sheet', root); sh.tabIndex = -1;
  setTimeout(() => ($('[data-autofocus]', root) || sh).focus({preventScroll: true}), 30);
}
function closeSheet(){
  $('#sheet-root').innerHTML = '';
  if(confirmResolve){ const r = confirmResolve; confirmResolve = null; r(false); }
}
/* Conferma in un foglio stilizzato (al posto di confirm() del browser) */
let confirmResolve = null;
function confirmSheet({title, text = '', ok = 'Conferma', cancel = 'Annulla', danger = false}){
  return new Promise(resolve => {
    closeSheet();
    openSheet(`<h2>${esc(title)}</h2>${text ? `<p class="sub">${esc(text)}</p>` : ''}
      <div class="confirm-actions"><button class="btn ghost" data-act="confirm-no">${esc(cancel)}</button><button class="btn ${danger ? 'danger-fill' : 'primary'}" data-act="confirm-yes">${esc(ok)}</button></div>`, title);
    confirmResolve = resolve;
  });
}
function answerConfirm(v){ const r = confirmResolve; confirmResolve = null; $('#sheet-root').innerHTML = ''; if(r) r(v); }
document.addEventListener('keydown', e => { if(e.key === 'Escape' && $('#sheet-root').innerHTML) closeSheet(); });

function sheetHomeMenu(){
  const s = S.store;
  const account = s.kind === 'firebase' && s.user
    ? `<li class="menu-sep" role="separator"></li><li><button data-act="sign-out">${I.logout}<span>Esci<small>Connesso come ${esc(s.user.name || s.user.email)}${s.user.name && s.user.email ? ' (' + esc(s.user.email) + ')' : ''}</small></span></button></li>` : '';
  openSheet(`<h2>Altre azioni</h2>${s.kind === 'firebase' ? `<p class="sub">${I.cloud.replace('<svg', '<svg width="16" height="16" style="vertical-align:-3px"')} I dati sono salvati online sul tuo account.</p>` : ''}<ul class="menu-list">
    <li><a href="#/verifica">${I.shield}<span>Verifica un biglietto<small>Controlla link o codice di un partecipante</small></span></a></li>
    <li><button data-act="export">${I.down}<span>Scarica il backup<small>Un file con tutte le estrazioni e i biglietti</small></span></button></li>
    <li><button data-act="import">${I.up}<span>Ripristina da backup<small>Carica un file di backup scaricato prima</small></span></button></li>
    <li><button data-act="about">${I.help}<span>Come funziona</span></button></li>${account}</ul>`, 'Altre azioni');
}
function sheetAbout(){
  const online = S.store && S.store.kind === 'firebase';
  openSheet(`<h2>Come funziona</h2>
    <p>Crei un'estrazione con il suo premio e scegli quale numero del Lotto decide il vincitore, per esempio il 1° estratto sulla ruota di Napoli.</p>
    <p>I biglietti sono i numeri da 1 a 90: ognuno si cede a una persona sola. Chi compra tre biglietti ha tre numeri, quindi tre possibilità. Ogni biglietto è un link da mandare su WhatsApp.</p>
    <p>Dopo l'estrazione scrivi il numero uscito: vince il biglietto con quel numero.</p>
    <p>${online ? 'I dati sono salvati online sul tuo account Google, con una copia sul dispositivo: funziona anche senza rete e si sincronizza appena torna la connessione.' : 'I dati restano su questo telefono, non su un server: scarica un backup dal menu ogni tanto.'} Il link del biglietto contiene una firma: con «Verifica un biglietto» capisci se qualcuno l'ha modificato.</p>
    <p class="help">Per installare l'app su Android: menu del browser, poi «Installa app» o «Aggiungi a schermata Home».</p>`, 'Come funziona');
}
function sheetLotMenu(lot){
  openSheet(`<h2>${esc(lot.name)}</h2><ul class="menu-list">
    <li><a href="#/modifica/${lot.id}">${I.edit}<span>Modifica l'estrazione<small>Premio, data, ruota, prezzo</small></span></a></li>
    <li><button data-act="csv">${I.table}<span>Esporta l'elenco<small>File per Excel con numeri, nomi e pagamenti</small></span></button></li>
    <li><button data-act="duplicate">${I.dup}<span>Duplica per la prossima volta<small>Stesse impostazioni, tabellone vuoto</small></span></button></li>
    <li><button data-act="delete-lot" class="danger">${I.trash}<span>Elimina l'estrazione</span></button></li></ul>`, 'Azioni estrazione');
}
function namesDatalist(lot){
  const seen = new Map(); lot.tickets.forEach(t => { const k = t.name.trim().toLowerCase(); if(!seen.has(k)) seen.set(k, t.name.trim()); });
  return `<datalist id="names">${[...seen.values()].sort((a, b) => a.localeCompare(b, 'it')).map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
}
function sheetSell(lot, n){
  ui.n = n; ui.ticket = null;
  openSheet(`<div class="sheet-hero"><span class="tok">${n}</span><div><h2>Biglietto n. ${n}</h2><p class="sub">${lot.price ? euro(lot.price) : 'Gratuito'}</p></div></div>
    <form data-form="sell" novalidate>
      <label class="f" for="a-name">A chi lo cedi</label><input class="field" id="a-name" name="name" maxlength="60" autocomplete="off" list="names" placeholder="Nome e cognome" data-autofocus data-input="aname">${namesDatalist(lot)}
      <label class="f" for="a-phone">Telefono (facoltativo)</label><input class="field" id="a-phone" name="phone" type="tel" maxlength="20" placeholder="Per mandargli il biglietto su WhatsApp">
      <label class="check"><input type="checkbox" name="paid" ${lot.price ? '' : 'checked'}> Ha già pagato</label>
      <p class="err" id="a-err" role="alert"></p>
      <div class="form-actions"><button class="btn red">Cedi il biglietto ${n}</button></div></form>`, 'Cedi biglietto');
}
function sheetShare(lot, t, fresh){
  ui.n = t.n; ui.ticket = t;
  const others = [...lot.tickets.filter(x => x.n !== t.n), t].filter(x => sameName(x.name, t.name));
  openSheet(`<div class="sheet-hero"><span class="tok ${t.paid ? '' : 'unpaid-tok'}">${t.n}</span><div><h2>${fresh ? 'Biglietto ' + t.n + ' ceduto' : esc(t.name)}</h2><p class="sub">${fresh ? esc(t.name) + ', ' : ''}codice ${esc(t.code)}${t.paid ? '' : ', da pagare'}</p></div></div>
    <button class="btn wa block" data-act="send-wa">${I.wa} Invia su WhatsApp${t.phone ? ' a ' + esc(firstName(t.name)) : ''}</button>
    ${others.length > 1 ? `<button class="link-btn" data-act="send-all" style="margin-top:8px">Invia tutti i ${others.length} biglietti di ${esc(firstName(t.name))} in un messaggio</button>` : ''}
    <div class="quick">
      <button data-act="send-share">${I.share}Altra app</button>
      <button data-act="send-copy">${I.copy}Copia link</button>
      <a href="${esc(ticketLink(lot, t))}">${I.eye}Anteprima</a>
    </div>
    <div class="sheet-foot"><button class="link-btn" data-act="ticket" data-n="${t.n}">Modifica il biglietto</button>${t.paid ? '<span class="muted">Pagato</span>' : `<button class="btn ghost small" data-act="mark-paid">Segna pagato</button>`}</div>`, 'Invia biglietto');
}
function sheetTicket(lot, t){
  ui.n = t.n; ui.ticket = t;
  openSheet(`<div class="sheet-hero"><span class="tok">${t.n}</span><div><h2>Biglietto n. ${t.n}</h2><p class="sub">Codice ${esc(t.code)}</p></div></div>
    <form data-form="ticket" novalidate>
      <label class="f" for="p-name">Intestato a</label><input class="field" id="p-name" name="name" value="${esc(t.name)}" maxlength="60" list="names">${namesDatalist(lot)}
      <label class="f" for="p-phone">Telefono</label><input class="field" id="p-phone" name="phone" type="tel" value="${esc(t.phone || '')}" maxlength="20">
      <label class="check"><input type="checkbox" name="paid" ${t.paid ? 'checked' : ''}> Ha pagato</label>
      <label class="f" for="p-note">Nota (solo per te)</label><input class="field" id="p-note" name="note" value="${esc(t.note || '')}" maxlength="120">
      <p class="err" id="p-err" role="alert"></p>
      <div class="btn-row"><button type="button" class="btn ghost small" data-act="share-menu" data-n="${t.n}">${I.share} Invia biglietto</button>${lot.result ? '' : `<button type="button" class="btn danger small" data-act="free-num">${I.trash} Annulla il biglietto</button>`}</div>
      <div class="form-actions"><button class="btn primary">Salva</button></div>
    </form>`, 'Biglietto');
}

/* ---------- Verifica di un biglietto ---------- */
function verify(input){
  const s = input.trim(); if(!s) return '<p class="err">Incolla un link o scrivi un codice.</p>';
  const m = /#\/t\/([A-Za-z0-9_-]+)/.exec(s);
  const box = (ok, title, text) => `<div class="notice ${ok ? 'ok' : 'ko'}" style="margin-top:18px"><div><p><strong>${title}</strong></p><p>${text}</p></div></div>`;
  const desc = (lot, t) => `Biglietto ${t.n} di ${esc(t.name)}, «${esc(lot.name)}». ${t.paid ? 'Pagato.' : 'Da pagare.'}`;
  if(m){
    const p = decodeTicket(m[1]); if(!p) return box(false, 'Link non valido', 'Il link è incompleto o modificato.');
    const lot = getLot(p.i); if(!lot) return box(false, 'Estrazione non trovata', `Il biglietto è di «${esc(p.l)}», che non risulta tra le tue estrazioni.`);
    const t = lot.tickets.find(x => x.code === p.c);
    if(!t) return box(false, 'Biglietto non registrato', `Il codice ${esc(p.c)} non esiste in «${esc(lot.name)}». Forse il biglietto è stato annullato.`);
    if(ticketSig(lot, {code:p.c, n:p.n, name:p.h}) !== p.s) return box(false, 'Biglietto alterato', `I dati del link non corrispondono alla firma. Con questo codice risulta il biglietto ${t.n} di ${esc(t.name)}.`);
    if(t.n !== p.n || t.name.trim() !== p.h.trim()) return box(false, 'Biglietto non aggiornato', `Il link è autentico ma superato. Ora risulta: ${desc(lot, t)}`);
    return box(true, 'Biglietto valido', desc(lot, t));
  }
  const code = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for(const lot of lots()){ const t = lot.tickets.find(x => x.code === code); if(t) return box(true, 'Codice trovato', desc(lot, t)); }
  return box(false, 'Codice non trovato', 'Nessun biglietto con questo codice nelle tue estrazioni.');
}

/* ---------- Backup ed esportazioni ---------- */
function exportBackup(){
  const d = new Date().toISOString().slice(0, 10);
  const data = lots().map(l => ({...l, tickets: byNum(l)}));
  download(`lotteria-backup-${d}.json`, JSON.stringify({app:'lotteria-cesti', v:2, exportedAt:new Date().toISOString(), lotteries:data}, null, 1), 'application/json');
  S.store.markBackup();
  closeSheet(); toast('Backup scaricato'); if(!location.hash || location.hash === '#/') rerender();
}
function importBackup(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try{
      const data = JSON.parse(await inp.files[0].text());
      if(!data || data.app !== 'lotteria-cesti' || data.v !== 2 || !Array.isArray(data.lotteries)) throw 0;
      const valid = data.lotteries.filter(isValidBackupLottery);
      const clash = valid.filter(l => getLot(l.id)).length;
      if(clash && !await confirmSheet({title: 'Sostituire con il backup?', text: `${clash === 1 ? '1 estrazione è già presente' : clash + ' estrazioni sono già presenti'}: verranno sostituite dalla versione del backup.`, ok: 'Sostituisci'})) return;
      const n = S.store.importLotteries(valid, {replace:true});
      closeSheet(); toast(n === 1 ? '1 estrazione ripristinata' : n + ' estrazioni ripristinate');
    }catch(e){ toast('Il file non è un backup di questa app.'); }
  };
  inp.click();
}
function exportCsv(lot){
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Numero','Intestato a','Telefono','Pagato','Codice','Nota']];
  byNum(lot).forEach(t => rows.push([t.n, t.name, t.phone || '', t.paid ? 'sì' : 'no', t.code, t.note || '']));
  const slug = lot.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'estrazione';
  download(`${slug}-biglietti.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv');
  closeSheet();
}

/* ---------- Azioni dei pulsanti (data-act) ---------- */
const curLot = () => getLot(ui.lotId);
const curTicket = () => ticketOf(curLot(), ui.n) || ui.ticket;
const actions = {
  'reload': () => { S.storeError = null; route(); },
  'confirm-yes': () => answerConfirm(true),
  'confirm-no': () => answerConfirm(false),
  'ticket-image': async el => {
    const p = decodeTicket(parts()[1]); if(!p) return;
    el.disabled = true;
    try{
      const { ticketImage } = await import('./ticket-image.js');
      const blob = await ticketImage(p);
      const name = `biglietto-${p.n}.png`;
      const file = new File([blob], name, {type: 'image/png'});
      if(navigator.canShare && navigator.canShare({files: [file]})){
        try{ await navigator.share({files: [file], title: `Biglietto ${p.n}`}); }catch(e){ if(e.name !== 'AbortError') download(name, blob, 'image/png'); }
      } else { download(name, blob, 'image/png'); toast('Immagine salvata nei download'); }
    }catch(e){ console.error(e); toast('Non sono riuscito a creare l’immagine.'); }
    el.disabled = false;
  },
  'sign-in': async () => {
    const err = $('#login-err'); if(err) err.textContent = '';
    try{ await S.store.signIn(); }catch(e){ const m = errorText(e); const el = $('#login-err'); if(el) el.textContent = m; else toast(m); }
  },
  'sign-out': async () => {
    if(!await confirmSheet({title: 'Uscire dall’account?', text: 'I dati restano salvati online: li ritrovi al prossimo accesso.', ok: 'Esci'})) return;
    migrationChecked = false; await S.store.signOut(); location.hash = '#/';
  },
  'home-menu': () => sheetHomeMenu(),
  'lot-menu': () => sheetLotMenu(curLot()),
  'about': () => sheetAbout(),
  'export': () => exportBackup(),
  'import': () => importBackup(),
  'csv': () => exportCsv(curLot()),
  'sheet-close': () => closeSheet(),
  'sheet-back': (el, e) => { if(e.target === el) closeSheet(); },
  'cell': el => {
    const lot = curLot(), n = +el.dataset.n, t = ticketOf(lot, n);
    if(t){ sheetShare(lot, t); return; }
    if(lot.result){ toast('Estrazione già registrata: cancellala per cedere altri biglietti.'); return; }
    sheetSell(lot, n);
  },
  'rand': () => {
    const lot = curLot(); const free = []; for(let n = 1; n <= 90; n++) if(!ticketOf(lot, n)) free.push(n);
    if(!free.length){ toast('Tutti i 90 biglietti sono già ceduti.'); return; }
    const n = free[randInt(free.length)];
    const el = $(`.cell[data-n="${n}"]`); if(el){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    sheetSell(lot, n);
  },
  'ticket': el => sheetTicket(curLot(), ticketOf(curLot(), +el.dataset.n) || ui.ticket),
  'toggle-paid': el => { const t = ticketOf(curLot(), +el.dataset.n); S.store.updateTicket(ui.lotId, t.n, {paid: !t.paid}); toast(`Biglietto ${t.n}: ${!t.paid ? 'pagato' : 'da pagare'}`); },
  'mark-paid': () => { const t = curTicket(); S.store.updateTicket(ui.lotId, t.n, {paid: true}); sheetShare(curLot(), {...t, paid: true}); toast(`Biglietto ${t.n}: pagato`); },
  'share-menu': el => { const lot = curLot(); sheetShare(lot, ticketOf(lot, +el.dataset.n) || ui.ticket); },
  'send-wa': () => { const lot = curLot(), t = curTicket(); openWhatsApp(t.phone, ticketMessage(lot, t) + '\n' + ticketLink(lot, t)); },
  'send-all': () => {
    const lot = curLot(), t = curTicket();
    const list = [...lot.tickets.filter(x => x.n !== t.n), t].filter(x => sameName(x.name, t.name)).sort((a, b) => a.n - b.n);
    openWhatsApp(t.phone || (list.find(x => x.phone) || {}).phone, bundleMessage(lot, list));
  },
  'send-share': () => { const lot = curLot(), t = curTicket(); shareAny(`Biglietto ${t.n}, ${lot.name}`, ticketMessage(lot, t), ticketLink(lot, t)); },
  'send-copy': async () => { const lot = curLot(), t = curTicket(); toast(await copyText(ticketLink(lot, t)) ? 'Link copiato' : 'Copia non riuscita'); },
  'share-self': () => shareAny(document.title, 'Il mio biglietto', location.href),
  'free-num': async () => {
    const t = curTicket();
    if(!await confirmSheet({title: `Annullare il biglietto ${t.n}?`, text: `È di ${t.name}. Il numero torna libero e il link già inviato non sarà più valido.`, ok: 'Sì, annullalo', cancel: 'No', danger: true})) return;
    S.store.cancelTicket(ui.lotId, t.n); toast(`Biglietto ${t.n} annullato`);
  },
  'live-draw': () => {
    const inputs = [...document.querySelectorAll('[name=ex]')];
    const used = new Set(inputs.map(i => parseInt(i.value)).filter(Boolean));
    const slot = inputs.find(i => !i.value); if(!slot){ toast('Non servono altri numeri.'); return; }
    const pool = []; for(let n = 1; n <= 90; n++) if(!used.has(n)) pool.push(n);
    const n = pool[randInt(pool.length)]; slot.value = n;
    slot.classList.remove('pop'); void slot.offsetWidth; slot.classList.add('pop'); toast('Estratto il ' + n);
  },
  'clear-draw': async () => { if(!await confirmSheet({title: 'Cancellare l’estrazione?', text: 'Il numero estratto e il vincitore vengono tolti: potrai riscriverli.', ok: 'Cancella', danger: true})) return; S.store.setResult(ui.lotId, null); },
  'notify': () => { const lot = curLot(), o = outcome(lot); if(o.winner) openWhatsApp(o.winner.phone, winnerMessage(lot, o)); },
  'share-result': () => { const lot = curLot(); shareAny('Esito ' + lot.name, resultMessage(lot), resultLink(lot, ui.nameInResult)); },
  'wa-result': () => { const lot = curLot(); openWhatsApp('', resultMessage(lot) + '\n' + resultLink(lot, ui.nameInResult)); },
  'duplicate': () => {
    const lot = curLot();
    const { id, tickets, result, ...settings } = lot;
    const nid = S.store.createLottery({...settings, secret: newSecret(), name: lot.name + ' (copia)', drawDate: '', result: null, createdAt: Date.now()});
    closeSheet(); location.hash = '#/modifica/' + nid; toast('Estrazione duplicata: scegli la nuova data');
  },
  'delete-lot': async () => {
    const lot = curLot();
    if(!await confirmSheet({title: `Eliminare «${lot.name}»?`, text: `Vengono eliminati anche i ${lot.tickets.length} biglietti ceduti. Non si può annullare.`, ok: 'Elimina', danger: true})) return;
    S.store.deleteLottery(lot.id); location.hash = '#/'; toast('Estrazione eliminata');
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if(!el) return;
  const fn = actions[el.dataset.act]; if(fn) fn(el, e);
});
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.input; if(!k) return;
  if(k === 'search'){ ui.q = e.target.value; const pos = e.target.selectionStart; rerender(); const s = $('.search'); if(s){ s.focus(); try{ s.setSelectionRange(pos, pos); }catch(_){} } }
  if(k === 'names') ui.nameInResult = e.target.checked;
  if(k === 'aname'){ // stesso partecipante di un altro biglietto: ripropone il telefono
    const t = curLot().tickets.find(x => sameName(x.name, e.target.value) && x.phone); const ph = $('#a-phone');
    if(t && ph && !ph.value) ph.value = t.phone;
  }
});

/* ---------- Form (data-form) ---------- */
const forms = {
  async lottery(f){
    const err = $('#f-err'), d = Object.fromEntries(new FormData(f));
    if(!d.name.trim()){ err.textContent = "Dai un nome all'estrazione."; f.elements['name'].focus(); return; }
    if(!d.prize.trim()){ err.textContent = 'Scrivi qual è il premio.'; f.elements['prize'].focus(); return; }
    if(!d.drawDate){ err.textContent = "Scegli la data dell'estrazione."; f.elements['drawDate'].focus(); return; }
    if(d.wheel !== 'live' && !isDrawDay(d.drawDate) && !await confirmSheet({title: 'In quel giorno non c’è il Lotto', text: `${fmtDate(d.drawDate)} non c'è estrazione: il Lotto estrae martedì, giovedì, venerdì e sabato. Salvare lo stesso?`, ok: 'Salva lo stesso'})) return;
    const data = {name:d.name.trim(), prize:d.prize.trim(), theme:d.theme || 'altro', drawDate:d.drawDate, drawTime:d.drawTime || '20:00', wheel:d.wheel, pos:okPos(d.pos),
      rule:d.rule === 'none' ? 'none' : 'next', price:parsePrice(d.price), organizer:d.organizer.trim(), contact:d.contact.trim(), notes:d.notes.trim()};
    let id = f.dataset.id;
    if(id && getLot(id)) S.store.updateLottery(id, data);
    else id = S.store.createLottery({...data, secret: newSecret(), result: null, createdAt: Date.now()});
    location.hash = '#/l/' + id; toast(f.dataset.id ? 'Modifiche salvate' : 'Estrazione creata: cedi il primo biglietto');
  },
  async sell(f){
    const lot = curLot(), n = ui.n, err = $('#a-err'), d = Object.fromEntries(new FormData(f)), btn = $('button.red', f);
    if(ticketOf(lot, n)){ err.textContent = `Il biglietto ${n} è già stato ceduto.`; return; }
    let name = (d.name || '').trim(); if(!name){ err.textContent = 'Scrivi a chi cedi il biglietto.'; $('#a-name').focus(); return; }
    const same = lot.tickets.find(x => sameName(x.name, name)); if(same) name = same.name;
    const t = {n, code: newTicketCode(lots()), name, phone: (d.phone || '').trim(), paid: !!f.paid.checked, note: '', createdAt: Date.now()};
    btn.disabled = true;
    try{ await S.store.sellTicket(lot.id, t); }
    catch(e){
      btn.disabled = false;
      err.textContent = e.message === 'taken' ? `Il biglietto ${n} è appena stato ceduto da un altro dispositivo.` : errorText(e);
      return;
    }
    sheetShare(curLot(), t, true);
  },
  ticket(f){
    const t = curTicket(), err = $('#p-err'), d = Object.fromEntries(new FormData(f));
    const name = d.name.trim(); if(!name){ err.textContent = 'Il nome non può essere vuoto.'; return; }
    const patch = {name, phone: d.phone.trim(), paid: !!f.paid.checked, note: d.note.trim()};
    S.store.updateTicket(ui.lotId, t.n, patch);
    closeSheet();
    if(name !== t.name){ sheetShare(curLot(), {...t, ...patch}); toast('Nome cambiato: rimanda il biglietto'); } else toast('Salvato');
  },
  draw(f){
    const lot = curLot(), err = $('#d-err');
    const ex = [null, null, null, null, null];
    for(const i of f.querySelectorAll('[name=ex]')){
      const v = i.value.trim(); if(v === '') continue;
      const n = parseInt(v); if(!(n >= 1 && n <= 90)){ err.textContent = 'Ogni numero deve essere tra 1 e 90.'; return; }
      ex[+i.dataset.pos - 1] = n;
    }
    if(!ex[lot.pos - 1]){ err.textContent = `Scrivi il ${ord(lot.pos)} estratto.`; return; }
    const filled = ex.filter(Boolean);
    if(new Set(filled).size !== filled.length){ err.textContent = 'Sulla stessa ruota un numero esce una volta sola: controlla i doppioni.'; return; }
    document.activeElement && document.activeElement.blur();
    S.store.setResult(lot.id, {extracted: ex, at: Date.now()});
    rerender();
    const r = $('.winner, .notice', app); if(r) r.scrollIntoView({behavior: 'smooth', block: 'center'});
  },
  verify(f){ $('#v-out').innerHTML = verify(f.v.value); }
};
document.addEventListener('submit', e => { const h = forms[e.target.dataset.form]; if(h){ e.preventDefault(); h(e.target); } });

/* ---------- Avvio ---------- */
route();
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
