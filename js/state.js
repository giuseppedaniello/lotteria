// Stato condiviso dell'interfaccia: il repository attivo e le scelte temporanee dell'utente.

export const S = {
  store: null,       // repository attivo (locale o Firebase), creato da app.js
  storeError: null   // errore di caricamento del repository, se c'è
};
export const ui = {lotId: null, n: null, q: '', nameInResult: false, lastRoute: ''};

export const lots = () => (S.store ? S.store.lotteries : []);
export const getLot = id => lots().find(l => l.id === id);
