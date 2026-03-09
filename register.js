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
