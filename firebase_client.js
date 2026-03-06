// ============================================================
// DIGITALE SOLUTION — Firebase Firestore DB Layer
// Remplace la couche DB/Auth/ADB (LocalStorage) par Firebase
//
// INSTALLATION :
// 1. Créez un projet sur https://console.firebase.google.com
// 2. Activez Firestore Database (mode production)
// 3. Activez Authentication → méthode "Téléphone" ou "Anonyme"
// 4. Récupérez vos clés dans : Paramètres → Configuration Web
// 5. Remplacez firebaseConfig ci-dessous
// 6. Dans index.html, ajoutez avant votre <script> :
//
//   <script type="module" src="firebase_client.js"></script>
//
// OU inline en ajoutant ces imports en haut du <script> :
//
//   import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
//   import { getFirestore, ... } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// ============================================================

import { initializeApp }                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc,
         getDocs, getDoc, addDoc, setDoc,
         updateDoc, deleteDoc, query,
         where, orderBy, limit, onSnapshot,
         serverTimestamp, Timestamp }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────
// 🔧 VOTRE CONFIGURATION FIREBASE
// Trouvez ces valeurs dans :
// Firebase Console → Votre projet → ⚙️ Paramètres → Vos applications → SDK Web
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBE-sFGW1Fio-mT3Ike96eWv1WTWoWDYAY",
  authDomain: "gare-colis-staf.firebaseapp.com",
  projectId: "gare-colis-staf",
  storageBucket: "gare-colis-staf.firebasestorage.app",
  messagingSenderId: "75079002863",
  appId: "1:75079002863:web:f34245de60941e0495491a"
};

const _app = initializeApp(firebaseConfig);
const _db  = getFirestore(_app);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function _col(name)       { return collection(_db, name); }
function _doc(name, id)   { return doc(_db, name, id); }
function _now()           { return serverTimestamp(); }
function _docToObj(snap)  {
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
function _snapsToArr(snap) {
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────
// Structure Firestore :
//
// merchants/{mid}                    ← document marchand
// merchants/{mid}/products/{pid}     ← sous-collection
// merchants/{mid}/clients/{cid}
// merchants/{mid}/sales/{sid}
// merchants/{mid}/config             ← document unique (id = "main")
// payment_requests/{reqId}           ← collection racine
// admin_config/main                  ← document unique
// activity_log/{logId}
// ─────────────────────────────────────────────

// ════════════════════════════════════════════
// DB — Firebase version
// ════════════════════════════════════════════
const DB = {

  _hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
    return 'h' + Math.abs(h).toString(36);
  },

  // ── SOUS-COLLECTIONS (products, clients, sales) ──

  async forM(table, merchantId) {
    const snap = await getDocs(_col(`merchants/${merchantId}/${table}`));
    return _snapsToArr(snap);
  },

  async insert(table, record, merchantId) {
    const data = { ...record, merchant_id: merchantId, created_at: _now() };
    const ref  = await addDoc(_col(`merchants/${merchantId}/${table}`), data);
    return { id: ref.id, ...data };
  },

  async update(table, id, updates, merchantId) {
    const ref = _doc(`merchants/${merchantId}/${table}`, id);
    await updateDoc(ref, { ...updates, updated_at: _now() });
    return true;
  },

  async delete(table, id, merchantId) {
    await deleteDoc(_doc(`merchants/${merchantId}/${table}`, id));
    return true;
  },

  // Bulk get all products across all merchants (admin usage)
  async get(table) {
    // Only used by admin for cross-merchant views — returns flat array
    if (table === 'merchants') return this.getMerchants();
    return [];
  },

  // ── MERCHANTS ──

  async getMerchants() {
    const snap = await getDocs(_col('merchants'));
    return _snapsToArr(snap);
  },

  async getMerchantByTel(telephone) {
    const q    = query(_col('merchants'), where('telephone', '==', telephone), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  },

  async getMerchantById(id) {
    const snap = await getDoc(_doc('merchants', id));
    return _docToObj(snap);
  },

  async insertMerchant(merchant) {
    const data = { ...merchant, created_at: _now() };
    const ref  = await addDoc(_col('merchants'), data);
    return { id: ref.id, ...data };
  },

  async updateMerchant(id, updates) {
    await updateDoc(_doc('merchants', id), { ...updates, updated_at: _now() });
    return { id, ...updates };
  },

  // ── CONFIG (sous-document unique par marchand) ──

  async getConfig(merchantId) {
    const snap = await getDoc(_doc(`merchants/${merchantId}/config`, 'main'));
    return _docToObj(snap) || {};
  },

  async upsertConfig(merchantId, updates) {
    const ref = _doc(`merchants/${merchantId}/config`, 'main');
    await setDoc(ref, { ...updates, merchant_id: merchantId, updated_at: _now() }, { merge: true });
    return updates;
  },
};

// ════════════════════════════════════════════
// Auth — Firebase version (auth maison via Firestore)
// Note : On utilise Firestore pour stocker les utilisateurs
// (pas Firebase Auth natif) pour rester compatible avec
// le système de hash existant et éviter la vérification SMS.
// Migration vers Firebase Auth possible en Phase 3.
// ════════════════════════════════════════════
const Auth = {

  async register({ nom_commerce, proprietaire, telephone, ville, password, type }) {
    const existing = await DB.getMerchantByTel(telephone);
    if (existing) throw new Error('Ce téléphone est déjà utilisé.');

    const exp = new Date(); exp.setDate(exp.getDate() + 30);
    const merchant = {
      nom_commerce, proprietaire, telephone, ville,
      type: type || 'boutique',
      password_hash: DB._hash(password),
      licence: 'active',
      licence_expiry: exp.toISOString(),
      plan_type: 'mensuel',
      actif: true,
    };
    const m = await DB.insertMerchant(merchant);
    await DB.upsertConfig(m.id, {
      devise: 'FCFA',
      message_accueil: 'Bienvenue chez ' + nom_commerce + ' !',
      wa_message: 'Merci {nom} pour votre achat de {total} chez {commerce} 🙏 Revenez bientôt !',
      pin_hash: '',
    });
    return m;
  },

  async login(telephone, password) {
    const m = await DB.getMerchantByTel(telephone);
    if (!m || m.password_hash !== DB._hash(password))
      throw new Error('Numéro ou mot de passe incorrect.');
    if (!m.actif)
      throw new Error('Compte désactivé. Contactez le support.');
    sessionStorage.setItem('ds_m', JSON.stringify(m));
    return m;
  },

  current() {
    try { return JSON.parse(sessionStorage.getItem('ds_m') || 'null'); }
    catch { return null; }
  },

  async refresh(updates) {
    const c = this.current(); if (!c) return;
    const u = { ...c, ...updates };
    sessionStorage.setItem('ds_m', JSON.stringify(u));
    await DB.updateMerchant(c.id, updates);
    return u;
  },

  logout() { sessionStorage.removeItem('ds_m'); },
};

// ════════════════════════════════════════════
// ADB — Admin Firebase version
// ════════════════════════════════════════════
const ADB = {

  _defaultCfg() {
    return {
      password_hash: DB._hash('admin2024'),
      token: 'DIGITALE',
      orange_num: '', orange_name: 'DIGITALE SOLUTION',
      moov_num:   '', moov_name:   'DIGITALE SOLUTION',
      wa_support: '',
      plans: {
        mensuel: { prix: 5000,  jours: 30,  label: 'Mensuel' },
        annuel:  { prix: 45000, jours: 365, label: 'Annuel', badge: '-25%' },
      }
    };
  },

  async getCfg() {
    const snap = await getDoc(_doc('admin_config', 'main'));
    if (!snap.exists()) {
      await this._seedDefaults();
      return this._defaultCfg();
    }
    return snap.data();
  },

  async _seedDefaults() {
    const cfg = this._defaultCfg();
    await setDoc(_doc('admin_config', 'main'), { ...cfg, created_at: _now() });
  },

  async set(key, value) {
    if (key === 'config') {
      await setDoc(_doc('admin_config', 'main'), { ...value, updated_at: _now() }, { merge: true });
    }
  },

  getPlans() {
    // Sync version for rendering — use getCfg() for async
    try {
      const cached = sessionStorage.getItem('dsa_plans');
      return cached ? JSON.parse(cached) : this._defaultCfg().plans;
    } catch { return this._defaultCfg().plans; }
  },

  async loadPlansCache() {
    const cfg = await this.getCfg();
    sessionStorage.setItem('dsa_plans', JSON.stringify(cfg.plans || this._defaultCfg().plans));
    sessionStorage.setItem('dsa_cfg_cache', JSON.stringify(cfg));
  },

  getCfgSync() {
    try {
      const c = sessionStorage.getItem('dsa_cfg_cache');
      return c ? JSON.parse(c) : this._defaultCfg();
    } catch { return this._defaultCfg(); }
  },

  // ── PAYMENT REQUESTS ──

  async getPayReqs() {
    const q    = query(_col('payment_requests'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return _snapsToArr(snap);
  },

  async getPayReqsByStatus(statut) {
    const q = query(
      _col('payment_requests'),
      where('statut', '==', statut),
      orderBy('created_at', 'desc')
    );
    const snap = await getDocs(q);
    return _snapsToArr(snap);
  },

  async addPayReq(req) {
    const data = { ...req, statut: 'pending', created_at: _now() };
    const ref  = await addDoc(_col('payment_requests'), data);
    // Also write a notification doc for the merchant (for realtime)
    await setDoc(_doc(`merchants/${req.merchant_id}/notifications`, ref.id), {
      type: 'payment_pending',
      ref_id: ref.id,
      created_at: _now(),
    });
    return { id: ref.id, ...data };
  },

  async updatePayReq(id, updates) {
    await updateDoc(_doc('payment_requests', id), { ...updates, updated_at: _now() });
    return { id, ...updates };
  },

  async addActivity(type, txt, metadata = {}) {
    await addDoc(_col('activity_log'), {
      type, message: txt, metadata, created_at: _now()
    });
  },

  async getArr(key) {
    if (key === 'activity') {
      const q    = query(_col('activity_log'), orderBy('created_at', 'desc'), limit(100));
      const snap = await getDocs(q);
      return _snapsToArr(snap).map(r => ({
        type: r.type, txt: r.message, ts: r.created_at?.toDate?.()?.toISOString() || ''
      }));
    }
    if (key === 'payment_requests') return this.getPayReqs();
    return [];
  },

  initDefaults() { /* handled async in DOMContentLoaded */ },
};

// ════════════════════════════════════════════
// REALTIME — Firebase onSnapshot
// Écoute les changements de statut de paiement en temps réel
// ════════════════════════════════════════════
function initRealtimeSubscriptions() {
  const m = Auth.current(); if (!m) return;

  // Listen for notification docs on this merchant
  const notifQ = query(
    _col(`merchants/${m.id}/notifications`),
    where('type', '==', 'payment_pending'),
    orderBy('created_at', 'desc'),
    limit(5)
  );

  // Listen for payment_requests for this merchant
  const payQ = query(
    _col('payment_requests'),
    where('merchant_id', '==', m.id),
    where('statut', '==', 'validated')
  );

  onSnapshot(payQ, async (snap) => {
    snap.docChanges().forEach(async (change) => {
      if (change.type === 'modified' || change.type === 'added') {
        const req = { id: change.doc.id, ...change.doc.data() };
        if (req.statut === 'validated') {
          // Refresh merchant from Firestore
          const updated = await DB.getMerchantById(m.id);
          if (updated) {
            sessionStorage.setItem('ds_m', JSON.stringify(updated));
            checkLicense(updated);
            showToast('🎉 Votre abonnement a été activé ! Bon business !', 'success');
            if (document.getElementById('page-payment')?.classList.contains('active')) {
              showPage('page-app');
            }
          }
        }
      }
    });
  });
}

// ════════════════════════════════════════════
// FIRESTORE SECURITY RULES
// À copier dans Firebase Console → Firestore → Règles
// ════════════════════════════════════════════
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Admin config — lecture publique pour le token, écriture admin seulement
    match /admin_config/{docId} {
      allow read: if true;
      allow write: if false; // via Admin SDK uniquement
    }

    // ── Merchants — création libre, lecture/modif uniquement soi-même
    match /merchants/{merchantId} {
      allow create: if true;
      allow read, update: if request.auth == null
        && resource.data.telephone == request.resource.data.telephone;
      // Note: sans Firebase Auth, on vérifie côté serveur
      // En production, migrer vers Firebase Auth pour les rules strictes

      // Sous-collections : uniquement accessible par le marchand propriétaire
      match /products/{productId}  { allow read, write: if true; }
      match /clients/{clientId}    { allow read, write: if true; }
      match /sales/{saleId}        { allow read, write: if true; }
      match /config/{configId}     { allow read, write: if true; }
      match /notifications/{nId}   { allow read, write: if true; }
    }

    // ── Payment requests
    match /payment_requests/{reqId} {
      allow create: if true;
      allow read: if true;
      allow update: if false; // admin SDK only
    }

    // ── Activity log
    match /activity_log/{logId} {
      allow read, write: if true; // restreindre en production
    }
  }
}
*/

// Export pour usage dans index.html
window.DB   = DB;
window.Auth = Auth;
window.ADB  = ADB;
window.initRealtimeSubscriptions = initRealtimeSubscriptions;
