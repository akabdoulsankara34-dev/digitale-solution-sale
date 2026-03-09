// api/data.js — Chargement données marchand depuis Firestore
const { getDb, cors } = require('./_firebase');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { merchant_id, collection: col } = req.query;

  if (!merchant_id) {
    return res.status(400).json({ error: 'merchant_id requis.' });
  }

  try {
    const db = getDb();

    // Charger une collection spécifique
    if (col) {
      const ALLOWED = ['products', 'sales', 'clients', 'configs'];
      if (!ALLOWED.includes(col)) {
        return res.status(400).json({ error: 'Collection non autorisée.' });
      }
      const snap = await db.collection(col)
        .where('merchant_id', '==', merchant_id)
        .get();
      return res.status(200).json({
        success: true,
        items: snap.docs.map(d => d.data())
      });
    }

    // Charger toutes les collections en parallèle
    const [products, sales, clients, configs] = await Promise.all([
      db.collection('products').where('merchant_id', '==', merchant_id).get(),
      db.collection('sales').where('merchant_id', '==', merchant_id).get(),
      db.collection('clients').where('merchant_id', '==', merchant_id).get(),
      db.collection('configs').where('merchant_id', '==', merchant_id).get(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        products: products.docs.map(d => d.data()),
        sales:    sales.docs.map(d => d.data()),
        clients:  clients.docs.map(d => d.data()),
        configs:  configs.docs.map(d => d.data()),
      }
    });

  } catch(e) {
    console.error('Data error:', e);
    return res.status(500).json({ error: 'Erreur chargement: ' + e.message });
  }
};
