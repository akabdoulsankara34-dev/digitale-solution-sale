const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ─── Firebase ───────────────────────────────────────────────
let db = null;
function getDb() {
  if (db) return db;
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  db = getFirestore();
  return db;
}
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return 'h' + Math.abs(h).toString(36);
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ─── Router principal ────────────────────────────────────────
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const route = req.url.replace(/^\/api\/?/, '').split('?')[0];

  try {
    // ── REGISTER ──
    if (route === 'register') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });
      const { nom_commerce, proprietaire, telephone, ville, password, type } = req.body || {};
      if (!nom_commerce || !proprietaire || !telephone || !password)
        return res.status(400).json({ error: 'Tous les champs sont requis.' });

      const db = getDb();
      const existing = await db.collection('merchants').where('telephone','==',telephone.trim()).limit(1).get();
      if (!existing.empty) return res.status(409).json({ error: 'Ce numéro est déjà utilisé.' });

      const mid = 'merchant_' + Date.now() + '_' + Math.random().toString(36).substr(2,8);
      const expiry = new Date(); expiry.setDate(expiry.getDate() + 30);
      const merchant = {
        id: mid, nom_commerce: nom_commerce.trim(), proprietaire: proprietaire.trim(),
        telephone: telephone.trim(), ville: (ville||'').trim(), type: type||'boutique',
        password: hash(password), licence: 'active', licence_expiry: expiry.toISOString(),
        actif: true, created_at: new Date().toISOString()
      };
      const config = {
        id: 'cfg_'+mid, merchant_id: mid, devise: 'FCFA',
        message_accueil: 'Bienvenue chez '+nom_commerce+' !',
        wa_message: 'Merci {nom} pour votre achat de {total} chez {commerce} 🙏',
        pin: '', created_at: new Date().toISOString()
      };
      await Promise.all([
        db.collection('merchants').doc(mid).set(merchant),
        db.collection('configs').doc(config.id).set(config)
      ]);
      return res.status(201).json({ success: true, merchant, config });
    }

    // ── LOGIN ──
    if (route === 'login') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });
      const { telephone, password } = req.body || {};
      if (!telephone || !password) return res.status(400).json({ error: 'Téléphone et mot de passe requis.' });

      const db = getDb();
      const snap = await db.collection('merchants').where('telephone','==',telephone.trim()).limit(1).get();
      if (snap.empty) return res.status(401).json({ error: 'Compte introuvable.' });

      const merchant = snap.docs[0].data();
      if (merchant.password !== hash(password)) return res.status(401).json({ error: 'Mot de passe incorrect.' });
      if (merchant.actif === false) return res.status(403).json({ error: 'Compte désactivé.' });

      const mid = merchant.id;
      const [products, sales, clients, configs] = await Promise.all([
        db.collection('products').where('merchant_id','==',mid).get(),
        db.collection('sales').where('merchant_id','==',mid).get(),
        db.collection('clients').where('merchant_id','==',mid).get(),
        db.collection('configs').where('merchant_id','==',mid).get(),
      ]);
      return res.status(200).json({
        success: true, merchant,
        data: {
          products: products.docs.map(d=>d.data()),
          sales:    sales.docs.map(d=>d.data()),
          clients:  clients.docs.map(d=>d.data()),
          configs:  configs.docs.map(d=>d.data()),
        }
      });
    }

    // ── SYNC ──
    if (route === 'sync') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });
      const { merchant_id, collection: col, items, item, delete: deleteId } = req.body || {};
      if (!merchant_id || !col) return res.status(400).json({ error: 'merchant_id et collection requis.' });
      if (!['products','sales','clients','configs'].includes(col))
        return res.status(400).json({ error: 'Collection non autorisée.' });

      const db = getDb();
      if (deleteId) {
        await db.collection(col).doc(deleteId).delete();
        return res.status(200).json({ success: true, deleted: deleteId });
      }
      if (item) {
        const id = item.id || 'doc_'+Date.now();
        await db.collection(col).doc(id).set({ ...item, merchant_id });
        return res.status(200).json({ success: true, id });
      }
      if (items?.length) {
        const batch = db.batch(); let saved = 0;
        items.forEach(it => {
          const id = it.id || 'doc_'+Date.now()+Math.random().toString(36).substr(2,4);
          batch.set(db.collection(col).doc(id), { ...it, merchant_id });
          saved++;
        });
        await batch.commit();
        return res.status(200).json({ success: true, saved });
      }
      return res.status(400).json({ error: 'Aucune donnée.' });
    }

    // ── DATA ──
    if (route === 'data') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'GET requis' });
      const merchant_id = req.query?.merchant_id;
      if (!merchant_id) return res.status(400).json({ error: 'merchant_id requis.' });

      const db = getDb();
      const [products, sales, clients, configs] = await Promise.all([
        db.collection('products').where('merchant_id','==',merchant_id).get(),
        db.collection('sales').where('merchant_id','==',merchant_id).get(),
        db.collection('clients').where('merchant_id','==',merchant_id).get(),
        db.collection('configs').where('merchant_id','==',merchant_id).get(),
      ]);
      return res.status(200).json({
        success: true,
        data: {
          products: products.docs.map(d=>d.data()),
          sales:    sales.docs.map(d=>d.data()),
          clients:  clients.docs.map(d=>d.data()),
          configs:  configs.docs.map(d=>d.data()),
        }
      });
    }

    // ── ADMIN ──
    if (route === 'admin') {
      const ADMIN_TOKEN = process.env.ADMIN_SECRET || 'DIGITALE_ADMIN';
      const token = req.headers['authorization']?.replace('Bearer ','') || req.body?.token;
      if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Non autorisé.' });

      const { action } = req.body || req.query;
      const db = getDb();

      if (action === 'list_merchants') {
        const snap = await db.collection('merchants').get();
        return res.status(200).json({
          success: true,
          merchants: snap.docs.map(d => { const m=d.data(); delete m.password; return m; })
        });
      }
      if (action === 'extend') {
        const { merchant_id, days, plan_type } = req.body;
        const mDoc = await db.collection('merchants').doc(merchant_id).get();
        if (!mDoc.exists) return res.status(404).json({ error: 'Marchand introuvable.' });
        const base = mDoc.data().licence_expiry && new Date(mDoc.data().licence_expiry) > new Date()
          ? new Date(mDoc.data().licence_expiry) : new Date();
        base.setDate(base.getDate() + parseInt(days));
        await db.collection('merchants').doc(merchant_id).update({
          licence: 'active', actif: true, licence_expiry: base.toISOString(),
          plan_type: plan_type||(days>=300?'annuel':'mensuel'), updated_at: new Date().toISOString()
        });
        return res.status(200).json({ success: true, expiry: base.toISOString() });
      }
      if (action === 'suspend') {
        const { merchant_id, suspend } = req.body;
        await db.collection('merchants').doc(merchant_id).update({
          actif: !suspend, licence: suspend?'suspendue':'active', updated_at: new Date().toISOString()
        });
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ error: 'Action inconnue: ' + action });
    }

    return res.status(404).json({ error: 'Route introuvable: ' + route });

  } catch(e) {
    console.error('API Error:', e);
    return res.status(500).json({ error: 'Erreur serveur: ' + e.message });
  }
};
