// Configurazione del progetto Firebase.
// Dove trovarla: console.firebase.google.com → il tuo progetto → Impostazioni progetto
// → "Le tue app" → app web → "Configurazione SDK" (scegli "Config").
// Questi valori non sono segreti: la protezione dei dati la fanno le regole di Firestore.
//
// Lasciala a null per usare l'app solo su questo dispositivo, senza account (come prima).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCNb-GOmqEtr813YYUdWHvxrh1eqbLQ5G0",
  authDomain: "lotteria-9519b.firebaseapp.com",
  projectId: "lotteria-9519b",
  storageBucket: "lotteria-9519b.firebasestorage.app",
  messagingSenderId: "807653941528",
  appId: "1:807653941528:web:a110d6aec4c763165c7e6d"
};
/* Esempio:
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "lotteria-xxxx.firebaseapp.com",
  projectId: "lotteria-xxxx",
  storageBucket: "lotteria-xxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/

// Versione dell'SDK Firebase caricata da www.gstatic.com
export const FIREBASE_SDK = '13.4.0';
