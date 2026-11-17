// Repository online: login con Google e dati su Cloud Firestore, con copia offline sul dispositivo.
// Struttura dei dati:
//   users/{uid}/lotteries/{idEstrazione}            impostazioni, chiave segreta, numeri estratti
//   users/{uid}/lotteries/{idEstrazione}/tickets/{n} un documento per biglietto (n = 1…90)
// Le regole di sicurezza (firestore.rules) permettono a ogni utente di leggere e scrivere solo sotto users/{suo uid}.

import { FIREBASE_SDK } from './config.js';
import { newLotteryId, cleanLottery, cleanTicket, isValidBackupLottery } from './domain.js';

const SDK = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}/`;

export async function createFirebaseStore(config, {onChange, onError}){
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')
  ]);
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  let db;
  try{ db = F.initializeFirestore(app, {localCache: F.persistentLocalCache({tabManager: F.persistentMultipleTabManager()})}); }
  catch(e){ db = F.getFirestore(app); } // browser senza IndexedDB: funziona solo online

  const lots = new Map();      // id -> dati dell'estrazione (senza biglietti)
  const tickets = new Map();   // id -> [biglietti]
  const ticketUnsubs = new Map();
  let lotUnsub = null, uid = null, lotsLoaded = false;
  const fail = e => { console.error(e); onError(e); };

  const store = {
    kind: 'firebase',
    authKnown: false, user: null, loaded: false,
    lotteries: [],
    lastBackup: 0, lastChange: 0,

    async signIn(){
      const provider = new A.GoogleAuthProvider();
      provider.setCustomParameters({prompt: 'select_account'});
      try{ await A.signInWithPopup(auth, provider); }
      catch(e){
        if(e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return A.signInWithRedirect(auth, provider);
        throw e;
      }
    },
    signOut(){ return A.signOut(auth); },

    createLottery(d){
      const id = d.id || newLotteryId();
      F.setDoc(lotRef(id), {...cleanLottery(d), createdAt: d.createdAt || Date.now()}).catch(fail);
      return id;
    },
    updateLottery(id, patch){ F.updateDoc(lotRef(id), patch).catch(fail); },
    deleteLottery(id){
      const b = F.writeBatch(db);
      (tickets.get(id) || []).forEach(t => b.delete(ticketRef(id, t.n)));
      b.delete(lotRef(id));
      b.commit().catch(fail);
    },
    async sellTicket(id, t){
      if(navigator.onLine){
        // Online: una transazione garantisce che lo stesso numero non venga ceduto due volte da due dispositivi.
        await F.runTransaction(db, async tx => {
          const snap = await tx.get(ticketRef(id, t.n));
          if(snap.exists()) throw new Error('taken');
          tx.set(ticketRef(id, t.n), t);
        });
      } else {
        // Offline: si scrive nella copia locale; Firestore la invia appena torna la rete.
        if((tickets.get(id) || []).some(x => x.n === t.n)) throw new Error('taken');
        F.setDoc(ticketRef(id, t.n), t).catch(fail);
      }
    },
    updateTicket(id, n, patch){ F.updateDoc(ticketRef(id, n), patch).catch(fail); },
    cancelTicket(id, n){ F.deleteDoc(ticketRef(id, n)).catch(fail); },
    setResult(id, result){ F.updateDoc(lotRef(id), {result}).catch(fail); },
    importLotteries(list, {replace = true} = {}){
      let count = 0;
      list.filter(isValidBackupLottery).forEach(src => {
        if(lots.has(src.id) && !replace) return;
        const b = F.writeBatch(db);
        (tickets.get(src.id) || []).forEach(t => b.delete(ticketRef(src.id, t.n)));
        b.set(lotRef(src.id), cleanLottery(src));
        src.tickets.map(cleanTicket).filter(t => t.n).forEach(t => b.set(ticketRef(src.id, t.n), t));
        b.commit().catch(fail);
        count++;
      });
      return count;
    },
    markBackup(){ store.lastBackup = Date.now(); }
  };

  const lotCol = () => F.collection(db, 'users', uid, 'lotteries');
  const lotRef = id => F.doc(db, 'users', uid, 'lotteries', id);
  const ticketRef = (id, n) => F.doc(db, 'users', uid, 'lotteries', id, 'tickets', String(n));

  function emit(){
    store.lotteries = [...lots.entries()].map(([id, d]) => ({...d, id, tickets: tickets.get(id) || []}));
    store.loaded = lotsLoaded && [...lots.keys()].every(id => tickets.has(id));
    onChange();
  }
  function stopAll(){
    if(lotUnsub){ lotUnsub(); lotUnsub = null; }
    ticketUnsubs.forEach(u => u()); ticketUnsubs.clear();
    lots.clear(); tickets.clear(); lotsLoaded = false;
  }
  function watchTickets(id){
    ticketUnsubs.set(id, F.onSnapshot(F.collection(db, 'users', uid, 'lotteries', id, 'tickets'), snap => {
      tickets.set(id, snap.docs.map(d => d.data()));
      emit();
    }, fail));
  }
  function start(){
    lotUnsub = F.onSnapshot(lotCol(), snap => {
      const seen = new Set();
      snap.forEach(d => { seen.add(d.id); lots.set(d.id, d.data()); if(!ticketUnsubs.has(d.id)) watchTickets(d.id); });
      [...lots.keys()].forEach(id => { if(!seen.has(id)){ lots.delete(id); tickets.delete(id); ticketUnsubs.get(id)?.(); ticketUnsubs.delete(id); } });
      lotsLoaded = true;
      emit();
    }, fail);
  }

  A.getRedirectResult(auth).catch(fail);
  A.onAuthStateChanged(auth, u => {
    stopAll();
    uid = u ? u.uid : null;
    store.user = u ? {uid: u.uid, name: u.displayName || '', email: u.email || ''} : null;
    store.authKnown = true;
    if(u) start();
    emit();
  });
  return store;
}
