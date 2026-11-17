// Viste: funzioni che ricevono i dati e restituiscono l'HTML di una pagina.
// Non modificano dati: le azioni dell'utente sono gestite in app.js.

import { esc, euro, ord, fmtDate, fmtShort, countdown, firstName } from './util.js';
import { I, LOGO, ORN } from './icons.js';
import { WHEELS, THEMES, OFFICIAL_URL, wheelName, wheelLabel, winPhrase, ticketOf, byNum, lotStats, outcome,
  decodeTicket, decodeResult } from './domain.js';
import { S, ui, lots, getLot } from './state.js';

export function topBar(title, {back, menu} = {}){
  return `<header class="bar">${back ? `<a class="icon-btn" href="${back}" aria-label="Indietro">${I.back}</a>` : LOGO}<h1>${esc(title)}</h1>${menu ? `<button class="icon-btn" data-act="${menu}" aria-label="Altre azioni">${I.more}</button>` : ''}</header>`;
}
export function errorPage(title, text){
  return topBar(title, {back:'#/'}) + `<main class="wrap"><div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p><a class="btn primary" href="#/">Vai alla home</a></div></main>`;
}

/* ---------- Accesso ---------- */
export function viewLoading(){
  return topBar('Lotteria dei cesti') + `<main class="wrap"><p class="intro" role="status">Caricamento…</p></main>`;
}
export function viewStoreError(){
  return topBar('Lotteria dei cesti') + `<main class="wrap"><div class="empty"><h2>Non riesco a collegarmi</h2>
    <p>Per il primo avvio serve la connessione a internet, per scaricare la parte che salva i dati online. Controlla la rete e riprova.</p>
    <button class="btn primary" data-act="reload">Riprova</button></div></main>`;
}
export function viewLogin(){
  return topBar('Lotteria dei cesti') + `<main class="wrap"><div class="empty"><h2>Accedi per gestire le estrazioni</h2>
    <p>Le estrazioni e i biglietti sono salvati online e protetti dal tuo account Google: li ritrovi su ogni telefono o computer, anche se cambi dispositivo.</p>
    <button class="btn red" data-act="sign-in">Accedi con Google</button>
    <p class="err" id="login-err" role="alert"></p>
    <p class="help">Chi riceve un biglietto non deve accedere: apre il link e basta.</p></div></main>`;
}

/* ---------- Elenco estrazioni ---------- */
function ticksHtml(lot){
  let s = '';
  for(let n = 1; n <= 90; n++){ const t = ticketOf(lot, n); s += `<i class="${t ? (t.paid ? 's' : 'u') : ''}"></i>`; }
  return `<div class="ticks" aria-hidden="true">${s}</div>`;
}
export function viewHome(){
  const store = S.store;
  const list = [...lots()].sort((a, b) => (b.drawDate || '').localeCompare(a.drawDate || ''));
  const needBackup = store.kind === 'local' && list.some(l => l.tickets.length) && store.lastChange > store.lastBackup && Date.now() - store.lastBackup > 3 * 864e5;
  let body;
  if(!store.loaded){
    body = `<p class="intro" role="status">Carico le tue estrazioni…</p>`;
  } else if(!list.length){
    body = `<div class="empty"><h2>Nessuna estrazione, per ora</h2>
      <p>Crea un'estrazione: scegli il premio, la data e la ruota del Lotto. Poi cedi i biglietti dal tabellone: ogni biglietto è un numero da 1 a 90 e vince chi ha il numero estratto.</p>
      <a class="btn red" href="#/nuova">Crea un'estrazione</a></div>`;
  } else {
    body = (needBackup ? `<div class="notice" role="note"><div><p>I dati sono salvati solo su questo telefono. Scarica un backup ogni tanto, così non perdi nulla se cambi telefono o cancelli i dati del browser.</p><button class="link-btn" data-act="export">Scarica il backup</button></div></div>` : '') +
      list.map(l => {
        const st = lotStats(l), o = l.result ? outcome(l) : null;
        const status = o && !o.pending ? `<span class="pill done">${o.winner ? 'Vinto dal ' + o.number : 'Estratta'}</span>` : `<span class="pill ${l.theme}">${THEMES[l.theme] || ''}</span>`;
        return `<a class="lot-row" href="#/l/${l.id}"><div class="lot-top"><h2>${esc(l.name)}</h2>${status}</div>
          <p class="lot-meta">${esc(l.prize)}</p>
          <p class="lot-meta">${esc(fmtDate(l.drawDate))}, ${ord(l.pos)} estratto, ${esc(wheelLabel(l.wheel))}</p>
          ${ticksHtml(l)}
          <div class="lot-foot"><span>${st.sold} biglietti su 90</span><span>${euro(st.paid)} incassati</span></div></a>`;
      }).join('') +
      `<a class="btn red fab" href="#/nuova">Nuova estrazione</a>`;
  }
  return topBar('Lotteria dei cesti', {menu:'home-menu'}) + `<main class="wrap">${body}</main>`;
}

/* ---------- Editor ---------- */
export function viewEditor(lot){
  const isNew = !lot;
  const y = new Date().getFullYear();
  const L = lot || {name:'', prize:'', theme:(new Date().getMonth() >= 6 ? 'natale' : 'pasqua'), organizer:'', contact:'', price:2, drawDate:'', drawTime:'20:00', wheel:'Napoli', pos:1, rule:'next', notes:''};
  const wheelOpts = WHEELS.map(w => `<option value="${w}" ${L.wheel === w ? 'selected' : ''}>${w}</option>`).join('') +
    `<option value="live" ${L.wheel === 'live' ? 'selected' : ''}>Estrazione dal vivo (sacchetto)</option>`;
  let posOpts = ''; for(let k = 1; k <= 5; k++) posOpts += `<option value="${k}" ${L.pos == k ? 'selected' : ''}>${ord(k)} estratto</option>`;
  const sw = k => k === 'natale' ? 'repeating-linear-gradient(-45deg,#C8102E 0 6px,#1E5B45 6px 12px)' : k === 'pasqua' ? 'repeating-linear-gradient(-45deg,#5E4596 0 6px,#E9B100 6px 12px)' : 'repeating-linear-gradient(-45deg,#1D2A6B 0 6px,#E3B877 6px 12px)';
  const themes = Object.entries(THEMES).map(([k, v]) => `<label><input type="radio" name="theme" value="${k}" ${L.theme === k ? 'checked' : ''}><i style="background:${sw(k)}"></i>${v}</label>`).join('');
  const locked = !isNew && lot.tickets.length;
  return topBar(isNew ? 'Nuova estrazione' : 'Modifica estrazione', {back: isNew ? '#/' : '#/l/' + lot.id}) + `<main class="wrap">
  <form data-form="lottery" data-id="${lot ? lot.id : ''}" novalidate>
    <label class="f" for="f-name">Nome dell'estrazione</label>
    <input class="field" id="f-name" name="name" value="${esc(L.name)}" placeholder="es. Cesto di Natale ${y}" maxlength="80">
    <p class="help">Il motivo per cui la organizzi: compare in grande sul biglietto.</p>
    <label class="f" for="f-prize">Premio</label>
    <input class="field" id="f-prize" name="prize" value="${esc(L.prize)}" placeholder="es. Cesto con panettone, spumante e salumi" maxlength="160">
    <label class="f">Tema del biglietto</label>
    <div class="theme-pick">${themes}</div>
    <div class="two">
      <div><label class="f" for="f-date">Data estrazione</label><input class="field" type="date" id="f-date" name="drawDate" value="${esc(L.drawDate)}"></div>
      <div><label class="f" for="f-time">Ora</label><input class="field" type="time" id="f-time" name="drawTime" value="${esc(L.drawTime || '20:00')}"></div>
    </div>
    <div class="two">
      <div><label class="f" for="f-pos">Numero vincente</label><select class="field" id="f-pos" name="pos">${posOpts}</select></div>
      <div><label class="f" for="f-wheel">Ruota</label><select class="field" id="f-wheel" name="wheel">${wheelOpts}</select></div>
    </div>
    <p class="help">Il Lotto estrae il martedì, giovedì, venerdì e sabato alle 20:00. Controlla le festività sul calendario ufficiale.</p>
    <label class="f" for="f-rule">Se il numero estratto non è stato venduto</label>
    <select class="field" id="f-rule" name="rule">
      <option value="next" ${L.rule === 'next' ? 'selected' : ''}>Vale l'estratto successivo</option>
      <option value="none" ${L.rule === 'none' ? 'selected' : ''}>Nessun vincitore, il premio resta all'organizzatore</option>
    </select>
    <div class="two">
      <div><label class="f" for="f-price">Prezzo del biglietto (€)</label><input class="field" id="f-price" name="price" inputmode="decimal" value="${esc(String(L.price ?? '').replace('.', ','))}"></div>
      <div><label class="f" for="f-org">Organizzatore</label><input class="field" id="f-org" name="organizer" value="${esc(L.organizer)}" maxlength="60" placeholder="Il tuo nome"></div>
    </div>
    <label class="f" for="f-contact">Contatto sul biglietto (facoltativo)</label>
    <input class="field" id="f-contact" name="contact" value="${esc(L.contact)}" maxlength="60" placeholder="es. 333 1234567">
    <label class="f" for="f-notes">Note per i partecipanti (facoltative)</label>
    <textarea class="field" id="f-notes" name="notes" maxlength="400" placeholder="es. Il cesto si ritira in parrocchia entro il 6 gennaio.">${esc(L.notes)}</textarea>
    ${locked ? '<p class="help">Hai già ceduto dei biglietti? Se cambi premio, data o ruota, rimanda il link: i biglietti già inviati mostrano i dati vecchi.</p>' : ''}
    <p class="err" id="f-err" role="alert"></p>
    <div class="form-actions"><button class="btn primary">${isNew ? "Crea l'estrazione" : 'Salva le modifiche'}</button></div>
  </form></main>`;
}

/* ---------- Gestione di un'estrazione ---------- */
export function viewLottery(lot, tab){
  const st = lotStats(lot);
  const tabs = [['tabellone','Tabellone'],['biglietti',`Biglietti (${lot.tickets.length})`],['estrazione','Estrazione']];
  const content = tab === 'biglietti' ? listHtml(lot) : tab === 'estrazione' ? drawHtml(lot) : boardHtml(lot);
  return topBar(lot.name, {back:'#/', menu:'lot-menu'}) + `<main class="wrap">
    <div class="det-head"><p class="prize">${esc(lot.prize)}</p><p><strong>${esc(fmtDate(lot.drawDate))}</strong>, ore ${esc(lot.drawTime || '20:00')}</p><p>Vince il ${ord(lot.pos)} estratto, ${esc(wheelLabel(lot.wheel))}</p></div>
    <div class="stats"><div><b>${st.sold}<small> / 90</small></b><span>biglietti ceduti</span></div><div><b>${euro(st.paid)}</b><span>incassati</span></div><div><b>${euro(st.due)}</b><span>da incassare</span></div></div>
    <nav class="tabs">${tabs.map(([k, v]) => `<a href="#/l/${lot.id}/${k}" ${k === tab ? 'aria-current="page"' : ''}>${v}</a>`).join('')}</nav>
    ${content}</main>`;
}
function boardHtml(lot){
  const o = lot.result ? outcome(lot) : null;
  const win = o && o.winner ? o.number : 0;
  const out = new Set(o ? o.skipped.map(s => s.n) : []);
  let html = '';
  for(let b = 0; b < 6; b++){
    const rb = Math.floor(b / 2), cb = b % 2; let cells = '';
    for(let r = 0; r < 3; r++) for(let c = 0; c < 5; c++){
      const n = rb * 30 + r * 10 + cb * 5 + c + 1; const t = ticketOf(lot, n);
      const cls = ['cell']; if(t){ cls.push('sold'); if(!t.paid) cls.push('unpaid'); } if(n === win) cls.push('win'); if(out.has(n)) cls.push('out');
      const lab = t ? `Biglietto ${n}: ${t.name}${t.paid ? '' : ', da pagare'}` : `Biglietto ${n}: libero`;
      cells += `<button class="${cls.join(' ')}" data-act="cell" data-n="${n}" aria-label="${esc(lab)}">${n}</button>`;
    }
    html += `<div class="cartella">${cells}</div>`;
  }
  return `<div class="legend"><span><i class="lg-free"></i>Libero</span><span><i class="lg-sold"></i>Ceduto</span><span><i class="lg-unpaid"></i>Da pagare</span></div>
    <div class="tabellone" role="group" aria-label="Tabellone dei biglietti da 1 a 90">${html}</div>
    ${lot.result ? `<p class="hint">Estrazione registrata${win ? `: il biglietto vincente è il ${win}, in rosso` : ''}. Per cedere altri biglietti cancella prima l'estrazione.</p>` :
      `<div class="board-tools"><button class="btn ghost small" data-act="rand">${I.dice} Biglietto a caso</button></div>
       <p class="hint">Tocca un numero libero per cedere quel biglietto. Tocca un numero ceduto per rimandarlo o modificarlo.</p>`}`;
}
function listHtml(lot){
  if(!lot.tickets.length) return `<div class="empty"><h2>Nessun biglietto ceduto</h2><p>Vai al tabellone e tocca un numero: scrivi a chi lo dai e gli mandi il biglietto con un link.</p><a class="btn primary" href="#/l/${lot.id}/tabellone">Apri il tabellone</a></div>`;
  const o = lot.result ? outcome(lot) : null;
  const q = ui.q.trim().toLowerCase();
  const list = byNum(lot).filter(t => !q || t.name.toLowerCase().includes(q) || String(t.n) === q || t.code.toLowerCase() === q);
  const unpaid = lot.tickets.filter(t => !t.paid).length;
  return `<input class="search" type="search" data-input="search" value="${esc(ui.q)}" placeholder="Cerca per nome, numero o codice" aria-label="Cerca biglietto">
    <div class="list-tools"><span>${unpaid ? (unpaid === 1 ? '1 biglietto da pagare' : unpaid + ' biglietti da pagare') : 'Tutti i biglietti sono pagati'}</span><button class="link-btn" data-act="csv">Esporta elenco</button></div>
    <ul class="people">${list.map(t => `<li class="person">
      <button class="person-main tk-line" data-act="ticket" data-n="${t.n}"><span class="tok sm ${o && o.winner && o.number === t.n ? 'red' : ''}">${t.n}</span><span class="person-name">${esc(t.name)}</span></button>
      <button class="paid-tag ${t.paid ? '' : 'no'}" data-act="toggle-paid" data-n="${t.n}" aria-label="Biglietto ${t.n}: ${t.paid ? 'pagato, tocca per segnare da pagare' : 'da pagare, tocca per segnare pagato'}">${t.paid ? 'Pagato' : 'Da pagare'}</button>
      <button class="icon-btn" data-act="share-menu" data-n="${t.n}" aria-label="Invia il biglietto ${t.n} a ${esc(t.name)}">${I.share}</button></li>`).join('') ||
      '<li class="person"><span class="muted">Nessun risultato.</span></li>'}</ul>`;
}
function drawHtml(lot){
  const ex = (lot.result && lot.result.extracted) || [];
  const cd = countdown(lot.drawDate, lot.drawTime);
  const live = lot.wheel === 'live';
  const o = lot.result ? outcome(lot) : null;
  const last = lot.rule === 'next' ? 5 : lot.pos;
  let inputs = '';
  for(let k = lot.pos; k <= last; k++) inputs += `<div><label for="ex${k}">${ord(k)}</label><input id="ex${k}" name="ex" data-pos="${k}" type="number" inputmode="numeric" min="1" max="90" placeholder=" " value="${ex[k - 1] || ''}"></div>`;
  let res = '';
  if(o){
    const skip = o.skipped.length ? `<p class="note">${o.skipped.map(s => `Il ${s.n} (${ord(s.pos)} estratto) non era stato ceduto.`).join(' ')}</p>` : '';
    if(o.winner){
      res = `<section class="panel"><div class="winner big"><span class="tok xl red">${o.number}</span><div><h2>Vince il biglietto ${o.number}</h2><p><strong>${esc(o.winner.name)}</strong>${o.winner.paid ? '' : ', <span style="color:var(--red)">biglietto da pagare</span>'}</p><p class="muted">${ord(o.from)} estratto${live ? '' : ', ' + wheelName(lot.wheel)}</p>${skip}</div></div>
        <div class="btn-row"><button class="btn wa" data-act="notify">${I.wa} Avvisa ${esc(firstName(o.winner.name))}</button></div>
        <label class="check"><input type="checkbox" data-input="names" ${ui.nameInResult ? 'checked' : ''}> Mostra il nome del vincitore nel link</label>
        <div class="btn-row"><button class="btn primary" data-act="share-result">${I.share} Condividi</button><button class="btn ghost" data-act="wa-result">${I.wa} Su WhatsApp</button></div></section>`;
    } else if(o.pending){
      res = `<section class="panel"><div class="notice"><div><p><strong>Il ${o.skipped.map(s => s.n).join(', il ')} non era stato ceduto.</strong></p><p>Scrivi il ${ord(o.nextPos)} estratto per trovare il vincitore.</p></div></div></section>`;
    } else {
      res = `<section class="panel"><div class="winner big"><span class="tok xl empty">–</span><div><h2>Nessun vincitore</h2>${skip}<p>${lot.rule === 'none' ? "Il premio resta all'organizzatore." : 'Nessuno dei cinque estratti era stato ceduto: decidi tu come procedere.'}</p></div></div>
        <div class="btn-row"><button class="btn primary" data-act="share-result">${I.share} Condividi l'esito</button></div></section>`;
    }
  }
  return `<section class="panel"><h2>${live ? 'Estrazione dal vivo' : 'Numero vincente'}</h2>
    <p>${esc(fmtDate(lot.drawDate))}, ore ${esc(lot.drawTime || '20:00')}. ${live ? `Estrai un numero dal sacchetto, o fatti aiutare dall'app, e scrivilo qui.` : `Dopo le 20 scrivi il <strong>${ord(lot.pos)} estratto della ${esc(wheelName(lot.wheel))}</strong>.`}${lot.rule === 'next' && lot.pos < 5 ? ` Gli estratti successivi servono solo se quel numero non è stato ceduto.` : ''}</p>
    ${cd ? `<p class="muted">${cd}.</p>` : ''}
    ${live ? '' : `<a class="btn ghost small" href="${OFFICIAL_URL}" target="_blank" rel="noopener">Vedi le ultime estrazioni del Lotto</a>`}
    <form data-form="draw" novalidate><div class="ex-grid">${inputs}</div>
    <p class="err" id="d-err" role="alert"></p>
    <div class="btn-row">${live ? `<button type="button" class="btn ghost" data-act="live-draw">${I.dice} Estrai un numero</button>` : ''}<button class="btn primary">${lot.result ? 'Aggiorna' : 'Trova il vincitore'}</button></div>
    ${lot.result ? `<button type="button" class="link-btn" data-act="clear-draw">Cancella l'estrazione</button>` : ''}</form></section>${res}`;
}

/* ---------- Biglietto ed esito (pagine pubbliche, senza accesso) ---------- */
export function viewTicket(seg){
  const p = decodeTicket(seg);
  if(!p) return errorPage('Biglietto non leggibile', "Il link sembra incompleto. Chiedi all'organizzatore di rimandartelo, oppure copialo per intero dal messaggio.");
  document.body.className = 'th-' + p.th;
  document.title = `Biglietto ${p.n}, ${p.l}`;
  const cd = countdown(p.d, p.tm);
  const mine = getLot(p.i);
  return `<div class="tk-page"><article class="ticket" aria-label="Biglietto numero ${p.n}">
    <header class="tk-head">${ORN[p.th]}<h1>${esc(p.l)}</h1>${p.o ? `<p>Organizzata da ${esc(p.o)}${p.k ? ', ' + esc(p.k) : ''}</p>` : ''}</header>
    <div class="tk-body">
      <div class="tk-hero"><span class="tok xl" aria-hidden="true">${p.n}</span><div><p class="lbl">Biglietto intestato a</p><p class="who">${esc(p.h)}</p>${p.q ? `<p class="lbl">Prezzo ${euro(p.q)}</p>` : ''}</div></div>
      <dl class="facts">
        ${p.z ? `<div><dt>Premio</dt><dd>${esc(p.z)}</dd></div>` : ''}
        <div><dt>Estrazione</dt><dd>${esc(fmtDate(p.d))}, ore ${esc(p.tm || '20:00')}</dd></div>
        <div><dt>Vinci se</dt><dd>${esc(winPhrase(p.n, p.ps, p.w))}</dd></div>
      </dl>
      ${p.x ? `<p class="notes">${esc(p.x)}</p>` : ''}
    </div>
    <div class="tk-perf" aria-hidden="true"></div>
    <div class="tk-stub"><span class="tk-num">N. ${p.n}</span><span><span class="lbl">Codice </span><span class="tk-code">${esc(p.c)}</span></span></div>
  </article>
  <div class="tk-after">
    ${cd ? `<p class="tk-count">${cd}</p>` : ''}
    <button class="btn primary block" data-act="share-self">${I.share} Salva o condividi il biglietto</button>
    ${p.w !== 'live' ? `<a class="btn ghost block" href="${OFFICIAL_URL}" target="_blank" rel="noopener">Vedi le ultime estrazioni del Lotto</a>` : ''}
    <p class="tk-foot">Questo link è il tuo biglietto: conservalo. L'organizzatore può verificarlo con il codice.</p>
    ${mine ? `<a class="tk-admin" href="#/l/${esc(p.i)}/biglietti">Torna alla gestione</a>` : ''}
  </div></div>`;
}
export function viewResult(seg){
  const p = decodeResult(seg);
  if(!p) return errorPage('Esito non leggibile', "Il link sembra incompleto. Chiedi all'organizzatore di rimandartelo.");
  document.body.className = 'th-' + p.th;
  document.title = 'Esito ' + p.l;
  const live = p.w === 'live';
  const ex = p.e.map((n, i) => n ? `<figure><span class="tok ${n === p.n ? 'red' : ''}">${n}</span><figcaption>${ord(i + 1)}</figcaption></figure>` : '').join('');
  return `<div class="tk-page"><article class="ticket">
    <header class="tk-head">${ORN[p.th]}<h1>${esc(p.l)}</h1><p>Estrazione del ${esc(fmtShort(p.d))}</p></header>
    <div class="tk-body">
      ${p.n ? `<div class="tk-hero"><span class="tok xl red">${p.n}</span><div><p class="lbl">Biglietto vincente</p><p class="who">${p.h ? esc(p.h) : 'Numero ' + p.n}</p>${p.z ? `<p class="lbl">Vince: ${esc(p.z)}</p>` : ''}</div></div>`
        : `<div class="tk-hero"><span class="tok xl empty">–</span><div><p class="who">Nessun vincitore</p><p class="lbl">Il numero estratto non era stato ceduto.</p></div></div>`}
      <p class="muted" style="margin:0">${live ? 'Numeri estratti dal vivo' : 'Numeri estratti sulla ' + esc(wheelName(p.w))}</p>
      <div class="res-ex">${ex}</div>
    </div></article>
    <div class="tk-after"><p class="tk-foot">Se hai il biglietto ${p.n || 'vincente'}, contatta ${p.o ? esc(p.o) : "l'organizzatore"}.</p></div></div>`;
}

/* ---------- Verifica ---------- */
export function viewVerify(){
  return topBar('Verifica un biglietto', {back:'#/'}) + `<main class="wrap">
    <p class="intro">Incolla il link del biglietto che ti mostrano, o scrivi il codice. Controllo che corrisponda a quanto registrato.</p>
    <form data-form="verify"><label class="f" for="v-in">Link o codice</label>
    <textarea class="field" id="v-in" name="v" placeholder="https://…/#/t/… oppure K7P2QX"></textarea>
    <div class="btn-row"><button class="btn primary">Verifica</button></div></form>
    <div id="v-out" aria-live="polite"></div></main>`;
}
