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
