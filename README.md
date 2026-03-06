# 🌐 Digitale Solution

Plateforme de gestion de commerce pour commerçants africains.

## Stack
- **Frontend** : HTML / CSS / JavaScript vanilla
- **Backend** : Supabase (BDD + Auth)
- **Déploiement** : Vercel via GitHub (CI/CD automatique)

---

## 📁 Structure du projet

```
digitale-solution/
├── index.html                  ← Page principale (SPA)
├── supabase_client.js          ← Init Supabase (module ES)
├── vercel.json                 ← Config déploiement Vercel
├── .gitignore
├── .env.example                ← Modèle de variables d'env
│
└── assets/
    ├── css/
    │   └── main.css            ← Tous les styles (4 thèmes)
    │
    └── js/
        ├── db.js               ← DB localStorage + Auth
        ├── ui.js               ← Thème, PIN, navigation, toast
        ├── dashboard.js        ← Dashboard & KPI
        ├── products.js         ← Gestion produits
        ├── clients.js          ← Gestion clients
        ├── sales.js            ← Historique ventes
        ├── pos.js              ← Point de vente + caisse + factures
        ├── settings.js         ← Paramètres + compte
        ├── admin.js            ← Panneau admin (super-admin)
        ├── payment.js          ← Flux paiement abonnement
        └── app.js              ← Init, routing, overrides Supabase
```

---

## 🚀 Déploiement

### 1. Cloner & configurer
```bash
git clone https://github.com/TON_USER/digitale-solution.git
cd digitale-solution
cp .env.example .env
# Remplir .env avec tes clés Supabase
```

### 2. Connecter à Vercel
1. Push sur GitHub
2. Aller sur [vercel.com](https://vercel.com) → **New Project**
3. Importer le repo GitHub
4. Ajouter les variables d'env :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Déployer ✅

Chaque `git push` sur `main` déclenche un déploiement automatique.

---

## 🔒 Sécurité Supabase

Activer **Row Level Security** sur toutes les tables :

```sql
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Chaque marchand ne voit que ses données
CREATE POLICY "merchant_own_data" ON products
  FOR ALL USING (auth.uid()::text = merchant_id);
```

---

## 🎨 Thèmes disponibles
- `dark` (défaut)
- `light`
- `neon`
- `ocean`
