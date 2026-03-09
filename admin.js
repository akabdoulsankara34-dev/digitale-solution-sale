// api/admin.js — Actions admin (sync global, gestion marchands)
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
