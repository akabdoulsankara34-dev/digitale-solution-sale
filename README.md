# Digitale Solution POS — Guide de Déploiement

## Structure des fichiers

```
/
├── index.html          ← Application principale (corrigée)
├── sw.js               ← Service Worker PWA (corrigé)
├── manifest.json       ← Manifest PWA (corrigé)
├── vercel.json         ← Configuration Vercel (corrigée)
├── package.json        ← Dépendances Node.js
└── api/
    ├── _firebase.js    ← Initialisation Firebase Admin (partagée)
    ├── login.js        ← Route POST /api/login
    ├── register.js     ← Route POST /api/register
    ├── sync.js         ← Route POST /api/sync
    ├── data.js         ← Route GET /api/data
    └── admin.js        ← Route POST /api/admin
```

⚠️ **CRITIQUE** : Les fichiers API DOIVENT être dans le dossier `api/` pour Vercel.

---

## Variables d'environnement Vercel

Dans **Vercel Dashboard → Settings → Environment Variables**, ajoutez :

```
FIREBASE_SERVICE_ACCOUNT = { "type": "service_account", "project_id": "...", ... }
ADMIN_SECRET = votre_token_secret_admin
```

Le `FIREBASE_SERVICE_ACCOUNT` est le JSON complet de votre clé de service Firebase
(Firebase Console → Paramètres du projet → Comptes de service → Générer une nouvelle clé).

---

## Bugs corrigés

### 🔴 PWA ne fonctionnait pas (CRITIQUE)
1. **`<link rel="manifest">` absent** → Ajouté dans `<head>`
2. **Service Worker non enregistré** → Script d'enregistrement ajouté
3. **`</head>` manquant** → Corrigé
4. **Icônes PNG inexistantes** → Remplacées par SVG data URIs
5. **vercel.json mauvais format** → Remplacé par format `rewrites` v2

### 🟡 Responsive insuffisant
- Sidebar mobile avec overlay pour fermer
- POS layout flex colonne sur mobile
- Tableaux scrollables horizontalement
- Modals bottom-sheet sur mobile
- Touch targets min 44px
- Safe area insets pour encoche/barre nav
- Admin sidebar avec bouton mobile + overlay
- Grilles adaptatives jusqu'à 380px
- Landscape mobile optimisé pour POS

### 🟢 Performance
- `rel="preconnect"` pour Google Fonts
- `font-display=swap` dans l'URL des fonts
- `will-change` sur éléments animés
- SW v2 avec timeout, stale-while-revalidate pour fonts
- Headers Cache-Control sur Vercel
- GPU layers CSS pour animations fluides

---

## Déploiement sur Vercel

```bash
# 1. Installer Vercel CLI
npm i -g vercel

# 2. Déployer
vercel --prod

# 3. Configurer les variables d'environnement dans le dashboard Vercel
```

---

## URL Admin

Accès panneau admin : `https://votre-domaine.vercel.app/?admin=DIGITALE`

(Changez le token dans Admin → Configuration → Sécurité)
