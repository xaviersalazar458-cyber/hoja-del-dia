// Inicio de sesión con Google y sincronización (Firebase Auth + Firestore).
import { firebaseConfig } from './firebase-config.js';

const V = '10.12.2';
const $ = id => document.getElementById(id);
const btn = $('authBtn'), label = $('authLabel'), photo = $('accPhoto'), nameEl = $('accName'), sub = $('accSub');

function showSignedOut(){
  photo.hidden = true; nameEl.textContent = 'Sin cuenta';
  sub.textContent = 'Los datos se guardan solo en este dispositivo.';
  label.textContent = 'Entrar con Google'; btn.classList.add('primary'); btn.hidden = false;
}
function showSignedIn(u){
  if (u.photoURL) { photo.src = u.photoURL; photo.hidden = false; } else photo.hidden = true;
  nameEl.textContent = u.displayName || u.email || 'Tu cuenta';
  sub.textContent = (u.email ? u.email + ' · ' : '') + 'sincronizado';
  label.textContent = 'Cerrar sesión'; btn.classList.remove('primary'); btn.hidden = false;
}

async function start(){
  if (!firebaseConfig) return;               // sin configurar: la app sigue en modo local
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  auth.languageCode = 'es';
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { db = F.getFirestore(app); }

  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  A.getRedirectResult(auth).catch(err => window.hdd?.toast('No se pudo iniciar sesión: ' + (err.code || err.message)));

  let signedIn = false;
  btn.onclick = async () => {
    if (signedIn) { await A.signOut(auth); return; }
    try { await A.signInWithPopup(auth, provider); }
    catch (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        await A.signInWithRedirect(auth, provider);
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        window.hdd?.toast('No se pudo iniciar sesión: ' + (err.code || err.message));
      }
    }
  };
  showSignedOut();

  A.onAuthStateChanged(auth, user => {
    if (user) {
      signedIn = true; showSignedIn(user);
      const ref = k => F.doc(db, 'users', user.uid, 'days', k);
      window.hdd.connect({
        load: async k => { const s = await F.getDoc(ref(k)); return s.exists() ? s.data() : null; },
        save: (k, v) => F.setDoc(ref(k), { ...v, updatedAt: Date.now() }),
        watch: (k, cb) => F.onSnapshot(ref(k), s => { if (!s.metadata.hasPendingWrites) cb(s.exists() ? s.data() : null); }, () => {}),
        all: async () => {
          const snap = await F.getDocs(F.collection(db, 'users', user.uid, 'days'));
          const out = {}; snap.forEach(d => { out[d.id] = d.data(); }); return out;
        }
      });
    } else {
      if (signedIn) { window.hdd.disconnect(); window.hdd.toast('Sesión cerrada'); }
      signedIn = false; showSignedOut();
    }
  });
}
start().catch(() => { /* sin conexión al cargar Firebase: la app sigue en modo local */ });
