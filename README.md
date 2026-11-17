# Lotteria dei cesti

Web app (PWA, installabile su Android) per gestire le lotterie dei cesti di Natale e Pasqua:
90 biglietti numerati da 1 a 90, ognuno inviato con un link, pagamenti, e vincitore preso
da una ruota del Lotto (o da un'estrazione dal vivo).

Nessun server e nessun account: i dati restano sul telefono dell'organizzatore
(con backup scaricabile), i biglietti sono link che chiunque apre nel browser.

## Pubblicarla gratis

Serve un indirizzo HTTPS perché si installi come app e perché i link dei biglietti funzionino.

**GitHub Pages**
1. Crea un repository (es. `lotteria`) e carica tutti i file di questa cartella.
2. Settings → Pages → Source: *Deploy from a branch*, branch `main`, cartella `/ (root)`.
3. Dopo un minuto l'app è su `https://<tuo-utente>.github.io/lotteria/`.

**Netlify Drop** (ancora più veloce): trascina la cartella su https://app.netlify.com/drop.

Poi dal telefono apri l'indirizzo con Chrome → menu ⋮ → *Installa app* (o *Aggiungi a schermata Home*).

> Usa sempre lo stesso indirizzo: i link dei biglietti puntano all'indirizzo da cui li hai creati.

## Come si usa

Ogni biglietto è un numero da 1 a 90. C'è un solo premio: vince il biglietto con lo stesso numero
dell'estratto di riferimento (es. il 1° estratto sulla ruota di Napoli). Chi prende più biglietti
ha più numeri, quindi più possibilità.

1. **Nuova estrazione**: nome (il motivo), premio, tema del biglietto (Natale/Pasqua/Altro), data e ora,
   estratto di riferimento (1°–5°) e ruota (Bari … Nazionale, oppure estrazione dal vivo), prezzo del biglietto.
2. **Tabellone**: tocca un numero libero, scrivi a chi lo cedi e il telefono: il biglietto parte su
   WhatsApp, con un'altra app o come link copiato. Se la stessa persona ha più biglietti puoi mandarglieli
   tutti in un messaggio.
3. **Biglietti**: cerca, segna chi ha pagato, rimanda il link, annulla un biglietto, esporta l'elenco (CSV per Excel).
4. **Estrazione**: dopo le 20 scrivi il numero uscito. Se quel biglietto non è stato ceduto, a seconda della
   regola scelta vale l'estratto successivo oppure il premio resta all'organizzatore. Poi avvisi il vincitore
   e condividi l'esito con un link.

## Sicurezza dei biglietti

Ogni lotteria ha una chiave segreta salvata solo sul telefono dell'organizzatore. Il link del
biglietto contiene una firma HMAC-SHA256 di codice, nome e numero: da *Menu → Verifica un biglietto*
l'organizzatore capisce se un link è autentico, superato o modificato.

## File

- `index.html`: tutta l'app (HTML, CSS, JS, nessuna dipendenza esterna)
- `manifest.webmanifest`, `sw.js`, `icons/`: installazione e funzionamento offline

Per cambiare il sito dove controllare i numeri estratti modifica `OFFICIAL_URL` in `index.html`.
Quando pubblichi una nuova versione cambia `VERSION` in `sw.js` per aggiornare la cache.
