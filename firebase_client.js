// ============================================================
// DIGITALE SOLUTION — Firebase Firestore DB Layer
// Version CORRIGÉE pour déploiement Vercel
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc,
         getDocs, getDoc, addDoc, setDoc,
         updateDoc, deleteDoc, query,
         where, orderBy, limit, onSnapshot,
         serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────
// 🔧 VOTRE CONFIGURATION FIREBASE
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBE-sFGW1Fio-mT3Ike96eWv1WTWoWDYAY",
  authDomain: "gare-colis-staf.firebaseapp.com",
  projectId: "gare-colis-staf",
  storageBucket: "gare-colis-staf.firebasestorage.app",
  messagingSenderId: "75079002863",
  appId: "1:75079002863:web:f34245de60941e0495491a"
};

// Initialisation Firebase
const _app = initializeApp(firebaseConfig);
const _db = getFirestore(_app);

// ─────────────────────────────────────────────
// Helpers Firestore
// ─────────────────────────────────────────────
function _col(name) { return collection(_db, name); }
function _doc(name, id) { return doc(_db, name, id); }
function _now() { return serverTimestamp(); }
function _docToObj(snap) {
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
function _snapsToArr(snap) {
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────
// HASH utilitaire (pour compatibilité)
// ─────────────────────────────────────────────
function _hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { 
    h = Math.imul(31, h) + s.charCodeAt(i) | 0; 
  }
  return 'h' + Math.abs(h).toString(36);
}

// ════════════════════════════════════════════
// DB — Firebase version
// ════════════════════════════════════════════
const DB = {
  _hash: _hash,

  // ── SOUS-COLLECTIONS ──
  async forM(table, merchantId) {
    try {
      const snap = await getDocs(_col(`merchants/${merchantId}/${table}`));
      return _snapsToArr(snap);
    } catch (error) {
      console.error(`Erreur forM ${table}:`, error);
      return [];
    }
  },

  async insert(table, record, merchantId) {
    try {
      const data = { ...record, merchant_id: merchantId, created_at: _now() };
      const ref = await addDoc(_col(`merchants/${merchantId}/${table}`), data);
      return { id: ref.id, ...data, created_at: new Date().toISOString() };
    } catch (error) {
      console.error(`Erreur insert ${table}:`, error);
      throw error;
    }
  },

  async update(table, id, updates, merchantId) {
    try {
      const ref = _doc(`merchants/${merchantId}/${table}`, id);
      await updateDoc(ref, { ...updates, updated_at: _now() });
      return true;
    } catch (error) {
      console.error(`Erreur update ${table}:`, error);
      throw error;
    }
  },

  async delete(table, id, merchantId) {
    try {
      await deleteDoc(_doc(`merchants/${merchantId}/${table}`, id));
      return true;
    } catch (error) {
      console.error(`Erreur delete ${table}:`, error);
      throw error;
    }
  },

  // ── MERCHANTS ──
  async getMerchants() {
    try {
      const snap = await getDocs(_col('merchants'));
      return _snapsToArr(snap);
    } catch (error) {
      console.error('Erreur getMerchants:', error);
      return [];
    }
  },

  async getMerchantByTel(telephone) {
    try {
      const q = query(_col('merchants'), where('telephone', '==', telephone), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (error) {
      console.error('Erreur getMerchantByTel:', error);
      return null;
    }
  },

  async getMerchantById(id) {
    try {
      const snap = await getDoc(_doc('merchants', id));
      return _docToObj(snap);
    } catch (error) {
      console.error('Erreur getMerchantById:', error);
      return null;
    }
  },

  async insertMerchant(merchant) {
    try {
      const data = { ...merchant, created_at: _now() };
      const ref = await addDoc(_col('merchants'), data);
      return { id: ref.id, ...data, created_at: new Date().toISOString() };
    } catch (error) {
      console.error('Erreur insertMerchant:', error);
      throw error;
    }
  },

  async updateMerchant(id, updates) {
    try {
      await updateDoc(_doc('merchants', id), { ...updates, updated_at: _now() });
      return { id, ...updates };
    } catch (error) {
      console.error('Erreur updateMerchant:', error);
      throw error;
    }
  },

  // ── CONFIG ──
  async getConfig(merchantId) {
    try {
      const snap = await getDoc(_doc(`merchants/${merchantId}/config`, 'main'));
      return _docToObj(snap) || { merchant_id: merchantId };
    } catch (error) {
      console.error('Erreur getConfig:', error);
      return { merchant_id: merchantId };
    }
  },

  async upsertConfig(merchantId, updates) {
    try {
      const ref = _doc(`merchants/${merchantId}/config`, 'main');
      await setDoc(ref, { ...updates, merchant_id: merchantId, updated_at: _now() }, { merge: true });
      return updates;
    } catch (error) {
      console.error('Erreur upsertConfig:', error);
      throw error;
    }
  }
};

// ════════════════════════════════════════════
// Auth — Version Firebase
// ════════════════════════════════════════════
const Auth = {
  async register({ nom_commerce, proprietaire, telephone, ville, password, type }) {
    try {
      const existing = await DB.getMerchantByTel(telephone);
      if (existing) throw new Error('Ce téléphone est déjà utilisé.');

      const exp = new Date(); 
      exp.setDate(exp.getDate() + 30);
      
      const merchant = {
        nom_commerce, 
        proprietaire, 
        telephone, 
        ville,
        type: type || 'boutique',
        password_hash: _hash(password),
        licence: 'active',
        licence_expiry: exp.toISOString(),
        plan_type: 'mensuel',
        actif: true,
      };
      
      const m = await DB.insertMerchant(merchant);
      
      await DB.upsertConfig(m.id, {
        devise: 'FCFA',
        message_accueil: `Bienvenue chez ${nom_commerce} !`,
        wa_message: 'Merci {nom} pour votre achat de {total} chez {commerce} 🙏 Revenez bientôt !',
        pin_hash: '',
      });
      
      return m;
    } catch (error) {
      console.error('Erreur register:', error);
      throw error;
    }
  },

  async login(telephone, password) {
    try {
      const m = await DB.getMerchantByTel(telephone);
      if (!m || m.password_hash !== _hash(password))
        throw new Error('Numéro ou mot de passe incorrect.');
      if (!m.actif)
        throw new Error('Compte désactivé. Contactez le support.');
      
      sessionStorage.setItem('ds_m', JSON.stringify(m));
      return m;
    } catch (error) {
      console.error('Erreur login:', error);
      throw error;
    }
  },

  current() {
    try { 
      return JSON.parse(sessionStorage.getItem('ds_m') || 'null'); 
    } catch { 
      return null; 
    }
  },

  async refresh(updates) {
    const c = this.current(); 
    if (!c) return null;
    
    const u = { ...c, ...updates };
    sessionStorage.setItem('ds_m', JSON.stringify(u));
    await DB.updateMerchant(c.id, updates);
    return u;
  },

  logout() { 
    sessionStorage.removeItem('ds_m'); 
  }
};

// ════════════════════════════════════════════
// ADB — Admin Firebase version
// ════════════════════════════════════════════
const ADB = {
  _defaultCfg() {
    return {
      password_hash: _hash('admin2024'),
      token: 'DIGITALE',
      orange_num: '', 
      orange_name: 'DIGITALE SOLUTION',
      moov_num: '', 
      moov_name: 'DIGITALE SOLUTION',
      wa_support: '',
      plans: {
        mensuel: { prix: 5000, jours: 30, label: 'Mensuel' },
        annuel: { prix: 45000, jours: 365, label: 'Annuel', badge: '-25%' },
      }
    };
  },

  async getCfg() {
    try {
      const snap = await getDoc(_doc('admin_config', 'main'));
      if (!snap.exists()) {
        await this._seedDefaults();
        return this._defaultCfg();
      }
      return snap.data();
    } catch (error) {
      console.error('Erreur getCfg:', error);
      return this._defaultCfg();
    }
  },

  async _seedDefaults() {
    try {
      const cfg = this._defaultCfg();
      await setDoc(_doc('admin_config', 'main'), { ...cfg, created_at: _now() });
    } catch (error) {
      console.error('Erreur _seedDefaults:', error);
    }
  },

  async set(key, value) {
    try {
      if (key === 'config') {
        await setDoc(_doc('admin_config', 'main'), { ...value, updated_at: _now() }, { merge: true });
      }
    } catch (error) {
      console.error('Erreur set:', error);
    }
  },

  getPlans() {
    try {
      const cached = sessionStorage.getItem('dsa_plans');
      return cached ? JSON.parse(cached) : this._defaultCfg().plans;
    } catch { 
      return this._defaultCfg().plans; 
    }
  },

  async loadPlansCache() {
    try {
      const cfg = await this.getCfg();
      sessionStorage.setItem('dsa_plans', JSON.stringify(cfg.plans || this._defaultCfg().plans));
      sessionStorage.setItem('dsa_cfg_cache', JSON.stringify(cfg));
    } catch (error) {
      console.error('Erreur loadPlansCache:', error);
    }
  },

  getCfgSync() {
    try {
      const c = sessionStorage.getItem('dsa_cfg_cache');
      return c ? JSON.parse(c) : this._defaultCfg();
    } catch { 
      return this._defaultCfg(); 
    }
  },

  // ── PAYMENT REQUESTS ──
  async getPayReqs() {
    try {
      const q = query(_col('payment_requests'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      return _snapsToArr(snap);
    } catch (error) {
      console.error('Erreur getPayReqs:', error);
      return [];
    }
  },

  async getPayReqsByStatus(statut) {
    try {
      const q = query(
        _col('payment_requests'),
        where('statut', '==', statut),
        orderBy('created_at', 'desc')
      );
      const snap = await getDocs(q);
      return _snapsToArr(snap);
    } catch (error) {
      console.error('Erreur getPayReqsByStatus:', error);
      return [];
    }
  },

  async addPayReq(req) {
    try {
      const data = { ...req, statut: 'pending', created_at: _now() };
      const ref = await addDoc(_col('payment_requests'), data);
      
      await setDoc(_doc(`merchants/${req.merchant_id}/notifications`, ref.id), {
        type: 'payment_pending',
        ref_id: ref.id,
        created_at: _now(),
      });
      
      return { id: ref.id, ...data, created_at: new Date().toISOString() };
    } catch (error) {
      console.error('Erreur addPayReq:', error);
      throw error;
    }
  },

  async updatePayReq(id, updates) {
    try {
      await updateDoc(_doc('payment_requests', id), { ...updates, updated_at: _now() });
      return { id, ...updates };
    } catch (error) {
      console.error('Erreur updatePayReq:', error);
      throw error;
    }
  },

  async addActivity(type, txt, metadata = {}) {
    try {
      await addDoc(_col('activity_log'), {
        type, message: txt, metadata, created_at: _now()
      });
    } catch (error) {
      console.error('Erreur addActivity:', error);
    }
  },

  async getArr(key) {
    try {
      if (key === 'activity') {
        const q = query(_col('activity_log'), orderBy('created_at', 'desc'), limit(100));
        const snap = await getDocs(q);
        return _snapsToArr(snap).map(r => ({
          type: r.type, 
          txt: r.message, 
          ts: r.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
        }));
      }
      if (key === 'payment_requests') return this.getPayReqs();
      return [];
    } catch (error) {
      console.error('Erreur getArr:', error);
      return [];
    }
  },

  async initDefaults() {
    await this._seedDefaults();
  }
};

// ════════════════════════════════════════════
// REALTIME Subscriptions
// ════════════════════════════════════════════
function initRealtimeSubscriptions() {
  const m = Auth.current(); 
  if (!m) return;

  // Écoute des paiements validés
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
          const updated = await DB.getMerchantById(m.id);
          if (updated) {
            sessionStorage.setItem('ds_m', JSON.stringify(updated));
            checkLicense(updated);
            showToast('🎉 Votre abonnement a été activé ! Bon business !', 'success');
          }
        }
      }
    });
  });
}

// ════════════════════════════════════════════
// Initialisation Firebase
// ════════════════════════════════════════════
async function initializeFirebase() {
  try {
    console.log('🔄 Initialisation Firebase...');
    await getDocs(collection(_db, 'admin_config'), limit(1));
    console.log('✅ Firebase connecté avec succès');
    
    await ADB.loadPlansCache();
    
    const m = Auth.current();
    if (m) {
      initRealtimeSubscriptions();
      console.log('✅ Subscriptions temps réel activées');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion Firebase:', error);
    showToast('⚠️ Problème de connexion au serveur', 'error');
    return false;
  }
}

// Auto-initialisation
initializeFirebase().catch(console.error);

// Export pour utilisation dans index.html
window.DB = DB;
window.Auth = Auth;
window.ADB = ADB;
window.initRealtimeSubscriptions = initRealtimeSubscriptions;
window.initializeFirebase = initializeFirebase;
window._hash = _hash;

console.log('🔥 Firebase Client chargé');