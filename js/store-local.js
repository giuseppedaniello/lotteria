// Repository locale: i dati restano nel browser di questo dispositivo (localStorage).
// Ha la stessa interfaccia di store-firebase.js, così il resto dell'app non sa quale sta usando.

import { newLotteryId, cleanLottery, cleanTicket, isValidBackupLottery } from './domain.js';

export const LOCAL_KEY = 'lotteria-cesti.v2';

export function readLocalData(){
  try{ const s = JSON.parse(localStorage.getItem(LOCAL_KEY)); if(s && Array.isArray(s.lotteries)) return s; }catch(e){}
  return {v:2, lotteries:[], lastBackup:0, lastChange:0};
}

export function createLocalStore({onChange, onError}){
  const data = readLocalData();
  const find = id => data.lotteries.find(l => l.id === id);
  function persist(changed = true){
    if(changed) data.lastChange = Date.now();
    try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); }
    catch(e){ onError(new Error('Salvataggio non riuscito: la memoria del browser è piena.')); }
    onChange();
  }
  return {
    kind: 'local',
    authKnown: true, user: null, loaded: true,
    get lotteries(){ return data.lotteries; },
    get lastBackup(){ return data.lastBackup || 0; },
    get lastChange(){ return data.lastChange || 0; },

    createLottery(d){
      const id = d.id || newLotteryId();
      data.lotteries.push({...cleanLottery(d), id, tickets:[], createdAt: d.createdAt || Date.now()});
      persist(); return id;
    },
    updateLottery(id, patch){ const l = find(id); if(l){ Object.assign(l, patch); persist(); } },
    deleteLottery(id){ data.lotteries = data.lotteries.filter(l => l.id !== id); persist(); },
    async sellTicket(id, t){
      const l = find(id); if(!l) throw new Error('missing');
      if(l.tickets.some(x => x.n === t.n)) throw new Error('taken');
      l.tickets.push(t); persist();
    },
    updateTicket(id, n, patch){ const t = find(id)?.tickets.find(x => x.n === n); if(t){ Object.assign(t, patch); persist(); } },
    cancelTicket(id, n){ const l = find(id); if(l){ l.tickets = l.tickets.filter(x => x.n !== n); persist(); } },
    setResult(id, result){ const l = find(id); if(l){ l.result = result; persist(); } },
    importLotteries(list, {replace = true} = {}){
      let count = 0;
      list.filter(isValidBackupLottery).forEach(src => {
        const i = data.lotteries.findIndex(x => x.id === src.id);
        if(i >= 0 && !replace) return;
        const l = {...cleanLottery(src), id: src.id, tickets: src.tickets.map(cleanTicket).filter(t => t.n)};
        if(i >= 0) data.lotteries[i] = l; else data.lotteries.push(l);
        count++;
      });
      persist(); return count;
    },
    markBackup(){ data.lastBackup = Date.now(); persist(false); }
  };
}
