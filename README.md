# Lotteria dei cesti

Web app (PWA, installabile su Android) per organizzare le estrazioni a premi dei cesti di Natale e Pasqua.
Ogni biglietto è un numero da 1 a 90 e si invia con un link; vince il biglietto con lo stesso numero
dell'estratto di riferimento (es. il 1° estratto sulla ruota di Napoli).

Funziona in due modi:
- **solo su questo dispositivo** (`FIREBASE_CONFIG = null` in `js/config.js`): dati nel browser, con backup in JSON;
- **con Firebase**: accesso con Google per l'organizzatore, dati su Cloud Firestore con copia offline,
  sincronizzati su tutti i dispositivi. Chi riceve un biglietto non deve accedere.

## Struttura

```
index.html              pagina che carica stile e script
css/app.css             stile
js/app.js               avvio, router, azioni dei pulsanti, form
js/views.js             viste: funzioni che restituiscono l'HTML delle pagine
js/domain.js            regole del gioco: vincitore, firma dei biglietti, link, messaggi
js/store-local.js       repository locale (localStorage)
js/store-firebase.js    repository Firebase (login Google + Firestore)
js/state.js             stato condiviso dell'interfaccia
js/util.js              funzioni di supporto (date, testo, condivisione)
js/crypto.js            SHA-256 / HMAC per firmare i biglietti
js/icons.js             icone SVG
js/config.js            configurazione Firebase
firestore.rules         regole di sicurezza da incollare nella console Firebase
sw.js                   service worker (offline e aggiornamenti)
manifest.webmanifest    installazione come app
```

I due repository hanno la stessa interfaccia (`createLottery`, `updateLottery`, `deleteLottery`, `sellTicket`,
`updateTicket`, `cancelTicket`, `setResult`, `importLotteries`): il resto dell'app non sa quale sta usando.

Dati su Firestore:
```
users/{uid}/lotteries/{idEstrazione}              impostazioni, chiave segreta, numeri estratti
users/{uid}/lotteries/{idEstrazione}/tickets/{n}  un documento per biglietto (n = 1…90)
```

## Attivare Firebase

1. Su https://console.firebase.google.com crea un progetto (Google Analytics non serve).
2. **Authentication** → Inizia → Metodo di accesso → **Google** → Attiva → Salva.
3. Authentication → Impostazioni → **Domini autorizzati** → aggiungi `TUO-UTENTE.github.io`.
4. **Firestore Database** → Crea database → modalità produzione → località `eur3 (europe-west)`.
5. Firestore → **Regole** → incolla il contenuto di `firestore.rules` → Pubblica.
6. Impostazioni progetto (ingranaggio) → Le tue app → icona **</>** (Web) → registra l'app
   (Firebase Hosting non serve) → copia l'oggetto `firebaseConfig` in `js/config.js` al posto di `null`.
7. Pubblica su GitHub (`git add . && git commit && git push`).

Al primo accesso, le estrazioni già salvate sul telefono vengono caricate online automaticamente.

## Aggiornamenti

Quando pubblichi una nuova versione cambia `VERSION` in `sw.js`, così chi ha l'app installata la riceve.
Il backup JSON dal menu ⋮ resta disponibile anche con Firebase.
