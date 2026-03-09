// api/sync.js — Sauvegarde données marchand vers Firestore
const { getDb, cors } = require('./_firebase');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { merchant_id, collection: col, items, item } = req.body || {};

  if (!merchant_id || !col) {
    return res.status(400).json({ error: 'merchant_id et collection requis.' });
  }

  // Collections autorisées
  const ALLOWED = ['products', 'sales', 'clients', 'configs'];
  if (!ALLOWED.includes(col)) {
    return res.status(400).json({ error: 'Collection non autorisée: ' + col });
  }

  try {
    const db = getDb();

    // Mode 1 — sauvegarder un seul item
    if (item) {
      const id = item.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
      await db.collection(col).doc(id).set({ ...item, merchant_id });
      return res.status(200).json({ success: true, id });
    }

    // Mode 2 — sauvegarder plusieurs items (batch)
    if (items && items.length > 0) {
      const BATCH_SIZE = 400;
      let saved = 0;

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = items.slice(i, i + BATCH_SIZE);
        chunk.forEach(it => {
          const id = it.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
          batch.set(db.collection(col).doc(id), { ...it, merchant_id });
          saved++;
        });
        await batch.commit();
      }
      return res.status(200).json({ success: true, saved });
    }

    // Mode 3 — supprimer un document
    const { delete: deleteId } = req.body;
    if (deleteId) {
      await db.collection(col).doc(deleteId).delete();
      return res.status(200).json({ success: true, deleted: deleteId });
    }

    return res.status(400).json({ error: 'Aucune donnée à synchroniser.' });

  } catch(e) {
    console.error('Sync error:', e);
    return res.status(500).json({ error: 'Erreur sync: ' + e.message });
  }
};
// api/register.js — Inscription nouveau marchand
const { getDb, hash, cors } = require('./_firebase');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { nom_commerce, proprietaire, telephone, ville, password, type } = req.body || {};

  if (!nom_commerce || !proprietaire || !telephone || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  try {
    const db = getDb();

    // Vérifier si téléphone déjà utilisé
    const existing = await db.collection('merchants')
      .where('telephone', '==', telephone.trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ error: 'Ce numéro est déjà utilisé.' });
    }

    // Créer le marchand
    const mid = 'merchant_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    const merchant = {
      id: mid,
      nom_commerce: nom_commerce.trim(),
      proprietaire: proprietaire.trim(),
      telephone: telephone.trim(),
      ville: (ville || '').trim(),
      type: type || 'boutique',
      password: hash(password),
      licence: 'active',
      licence_expiry: expiry.toISOString(),
      actif: true,
      created_at: new Date().toISOString()
    };

    const config = {
      id: 'cfg_' + mid,
      merchant_id: mid,
      couleur_theme: '#E8730C',
      devise: 'FCFA',
      message_accueil: 'Bienvenue chez ' + nom_commerce + ' !',
      wa_message: 'Merci {nom} pour votre achat de {total} chez {commerce} 🙏 Revenez bientôt !',
      pin: '',
      created_at: new Date().toISOString()
    };

    // Sauvegarder dans Firestore
    await Promise.all([
      db.collection('merchants').doc(mid).set(merchant),
      db.collection('configs').doc(config.id).set(config),
    ]);

    return res.status(201).json({ success: true, merchant, config });

  } catch(e) {
    console.error('Register error:', e);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez.' });
  }
};
// api/login.js — Connexion marchand
const { getDb, hash, cors } = require('./_firebase');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { telephone, password } = req.body || {};
  if (!telephone || !password) {
    return res.status(400).json({ error: 'Téléphone et mot de passe requis.' });
  }

  try {
    const db = getDb();

    // Chercher le marchand par téléphone
    const snap = await db.collection('merchants')
      .where('telephone', '==', telephone.trim())
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(401).json({ error: 'Compte introuvable. Vérifiez votre numéro.' });
    }

    const merchant = snap.docs[0].data();

    // Vérifier mot de passe
    if (merchant.password !== hash(password)) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    // Vérifier compte actif
    if (merchant.actif === false) {
      return res.status(403).json({ error: 'Compte désactivé. Contactez l\'administrateur.' });
    }

    // Charger les données du marchand
    const mid = merchant.id;
    const [products, sales, clients, configs] = await Promise.all([
      db.collection('products').where('merchant_id', '==', mid).get(),
      db.collection('sales').where('merchant_id', '==', mid).get(),
      db.collection('clients').where('merchant_id', '==', mid).get(),
      db.collection('configs').where('merchant_id', '==', mid).get(),
    ]);

    return res.status(200).json({
      success: true,
      merchant,
      data: {
        products: products.docs.map(d => d.data()),
        sales:    sales.docs.map(d => d.data()),
        clients:  clients.docs.map(d => d.data()),
        configs:  configs.docs.map(d => d.data()),
      }
    });

  } catch(e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez.' });
  }
};
// api/login.js — Connexion marchand
const { getDb, hash, cors } = require('./_firebase');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { telephone, password } = req.body || {};
  if (!telephone || !password) {
    return res.status(400).json({ error: 'Téléphone et mot de passe requis.' });
  }

  try {
    const db = getDb();

    // Chercher le marchand par téléphone
    const snap = await db.collection('merchants')
      .where('telephone', '==', telephone.trim())
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(401).json({ error: 'Compte introuvable. Vérifiez votre numéro.' });
    }

    const merchant = snap.docs[0].data();

    // Vérifier mot de passe
    if (merchant.password !== hash(password)) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    // Vérifier compte actif
    if (merchant.actif === false) {
      return res.status(403).json({ error: 'Compte désactivé. Contactez l\'administrateur.' });
    }

    // Charger les données du marchand
    const mid = merchant.id;
    const [products, sales, clients, configs] = await Promise.all([
      db.collection('products').where('merchant_id', '==', mid).get(),
      db.collection('sales').where('merchant_id', '==', mid).get(),
      db.collection('clients').where('merchant_id', '==', mid).get(),
      db.collection('configs').where('merchant_id', '==', mid).get(),
    ]);

    return res.status(200).json({
      success: true,
      merchant,
      data: {
        products: products.docs.map(d => d.data()),
        sales:    sales.docs.map(d => d.data()),
        clients:  clients.docs.map(d => d.data()),
        configs:  configs.docs.map(d => d.data()),
      }
    });

  } catch(e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez.' });
  }
};// api/admin.js — Actions admin (sync global, gestion marchands)
const { getDb, hash, cors } = require('./_firebase');

const ADMIN_TOKEN = process.env.ADMIN_SECRET || 'DIGITALE_ADMIN';

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vérifier token admin
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.body?.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Non autorisé.' });
  }

  const { action } = req.body || req.query;

  try {
    const db = getDb();

    // Lister tous les marchands
    if (action === 'list_merchants') {
      const snap = await db.collection('merchants').get();
      return res.status(200).json({
        success: true,
        merchants: snap.docs.map(d => {
          const m = d.data();
          delete m.password; // ne jamais exposer le hash
          return m;
        })
      });
    }

    // Activer / prolonger abonnement
    if (action === 'extend') {
      const { merchant_id, days, plan_type } = req.body;
      const mDoc = await db.collection('merchants').doc(merchant_id).get();
      if (!mDoc.exists) return res.status(404).json({ error: 'Marchand introuvable.' });

      const m = mDoc.data();
      const base = m.licence_expiry && new Date(m.licence_expiry) > new Date()
        ? new Date(m.licence_expiry) : new Date();
      base.setDate(base.getDate() + parseInt(days));

      await db.collection('merchants').doc(merchant_id).update({
        licence: 'active',
        actif: true,
        licence_expiry: base.toISOString(),
        plan_type: plan_type || (days >= 300 ? 'annuel' : 'mensuel'),
        updated_at: new Date().toISOString()
      });
      return res.status(200).json({ success: true, expiry: base.toISOString() });
    }

    // Suspendre / réactiver
    if (action === 'suspend') {
      const { merchant_id, suspend } = req.body;
      await db.collection('merchants').doc(merchant_id).update({
        actif: !suspend,
        licence: suspend ? 'suspendue' : 'active',
        updated_at: new Date().toISOString()
      });
      return res.status(200).json({ success: true });
    }

    // Sync global — push localStorage → Firestore
    if (action === 'sync_all') {
      const { data } = req.body; // { merchants:[], products:[], sales:[], clients:[], configs:[] }
      const results = {};
      for (const [col, items] of Object.entries(data || {})) {
        if (!items?.length) { results[col] = 0; continue; }
        const ALLOWED = ['merchants', 'products', 'sales', 'clients', 'configs'];
        if (!ALLOWED.includes(col)) continue;
        const BATCH_SIZE = 400;
        let saved = 0;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = db.batch();
          items.slice(i, i + BATCH_SIZE).forEach(item => {
            const id = item.id || item.merchant_id || ('doc_' + Date.now());
            batch.set(db.collection(col).doc(id), item);
            saved++;
          });
          await batch.commit();
        }
        results[col] = saved;
      }
      return res.status(200).json({ success: true, results });
    }

    return res.status(400).json({ error: 'Action inconnue: ' + action });

  } catch(e) {
    console.error('Admin error:', e);
    return res.status(500).json({ error: 'Erreur serveur: ' + e.message });
  }
};
// api/_firebase.js — Initialisation Firebase Admin partagée
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db = null;

function getDb() {
  if (db) return db;

  if (!getApps().length) {
    // La clé de service est stockée en variable d'environnement Vercel
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }

  db = getFirestore();
  return db;
}

// Hash simple identique à celui du frontend (DB._hash)
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return 'h' + Math.abs(h).toString(36);
}

// Headers CORS pour autoriser le frontend
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = { getDb, hash, cors };

