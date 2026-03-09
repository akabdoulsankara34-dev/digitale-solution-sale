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
