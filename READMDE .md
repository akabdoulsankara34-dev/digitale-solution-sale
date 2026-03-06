# 🚀 Digitale Solution — Guide Firebase + Vercel

## 📦 Fichiers du projet

```
digitale-solution/
├── index.html              ← Application (renommer digitale-solution.html)
├── firebase_client.js      ← Couche DB Firebase (remplace LocalStorage)
├── vercel.json             ← Config déploiement Vercel
└── README.md               ← Ce guide
```

---

## ⚡ ÉTAPE 1 — Créer le projet Firebase (10 min)

### 1.1 Créer le projet
1. Allez sur **[console.firebase.google.com](https://console.firebase.google.com)**
2. Cliquez **"Ajouter un projet"**
3. Nom du projet : `digitale-solution`
4. Google Analytics : désactivez (pas nécessaire)
5. Cliquez **"Créer le projet"** ✅

### 1.2 Activer Firestore
1. Dans le menu gauche → **Build → Firestore Database**
2. Cliquez **"Créer une base de données"**
3. Choisissez **"Mode production"**
4. Région : `europe-west1` (recommandé pour l'Afrique de l'Ouest)
5. Cliquez **"Activer"** ✅

### 1.3 Récupérer vos clés
1. ⚙️ Paramètres du projet (roue dentée en haut à gauche)
2. Onglet **"Général"** → Faites défiler jusqu'à **"Vos applications"**
3. Cliquez **"</>** (Web)"
4. Nom : `digitale-solution-web`
5. **Ne cochez PAS** Firebase Hosting (on utilise Vercel)
6. Cliquez **"Enregistrer l'application"**
7. Copiez le bloc `firebaseConfig` affiché :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "digitale-solution-xxxxx.firebaseapp.com",
  projectId: "digitale-solution-xxxxx",
  storageBucket: "digitale-solution-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## ⚡ ÉTAPE 2 — Configurer l'application (5 min)

### 2.1 Modifier firebase_client.js
Ouvrez `firebase_client.js` et remplacez :
```javascript
const firebaseConfig = {
  apiKey:            "VOTRE_API_KEY",           // ← votre vraie clé
  authDomain:        "VOTRE_PROJECT_ID.firebaseapp.com",
  projectId:         "VOTRE_PROJECT_ID",
  storageBucket:     "VOTRE_PROJECT_ID.appspot.com",
  messagingSenderId: "VOTRE_MESSAGING_SENDER_ID",
  appId:             "VOTRE_APP_ID"
};
```

### 2.2 Modifier index.html
Ouvrez `index.html` et ajoutez **juste avant la balise `</body>`** :
```html
<script type="module" src="firebase_client.js"></script>
```

Puis dans la même balise `<script>` principale, ajoutez au tout début du DOMContentLoaded :
```javascript
// Charger la config admin en cache
ADB.loadPlansCache().catch(console.error);
// Activer l'écoute temps réel si connecté
const _m = Auth.current();
if (_m) initRealtimeSubscriptions();
```

### 2.3 Configurer les règles Firestore
1. Firebase Console → **Firestore → Onglet "Règles"**
2. Remplacez tout par ces règles de base :
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
> ⚠️ Ces règles sont ouvertes pour le développement.
> En production, copiez les règles complètes depuis `firebase_client.js` (en bas du fichier, dans les commentaires).

---

## ⚡ ÉTAPE 3 — Déployer sur Vercel (5 min)

### 3.1 Préparer GitHub
```bash
# Sur votre ordinateur, dans le dossier du projet :
git init
git add .
git commit -m "🚀 Digitale Solution v1"
git branch -M main
```

Créez un repo sur **[github.com](https://github.com)** → **"New repository"**
- Nom : `digitale-solution`
- Visibilité : **Private** (recommandé)

```bash
git remote add origin https://github.com/VOTRE_USERNAME/digitale-solution.git
git push -u origin main
```

### 3.2 Déployer sur Vercel
1. Allez sur **[vercel.com](https://vercel.com)** → **Sign up with GitHub**
2. Cliquez **"Add New → Project"**
3. Importez `digitale-solution`
4. Configuration :
   - Framework Preset : **Other**
   - Root Directory : `.`
   - Build Command : *(laisser vide)*
   - Output Directory : `.`
5. Cliquez **"Deploy"** ✅

**🎉 Votre app est en ligne sur :** `https://digitale-solution.vercel.app`

### 3.3 Variables d'environnement (sécurité)
Dans Vercel → Settings → Environment Variables :

| Nom | Valeur |
|-----|--------|
| `FIREBASE_API_KEY` | votre apiKey |
| `FIREBASE_PROJECT_ID` | votre projectId |

> Pour les utiliser dans le HTML statique, vous aurez besoin d'un build step.
> Pour l'instant, les clés dans `firebase_client.js` sont sûres — ce sont des clés publiques Firebase, protégées par les Security Rules.

### 3.4 Auto-déploiement
```bash
# Chaque modification → git push → Vercel redéploie automatiquement
git add .
git commit -m "Update"
git push
# → En ligne en ~30 secondes
```

---

## ⚡ ÉTAPE 4 — Accès admin (2 min)

### URL admin
```
https://digitale-solution.vercel.app?admin=DIGITALE
```
Mot de passe par défaut : **`admin2024`**

### ⚠️ À changer immédiatement
1. Connectez-vous au panel admin
2. **Configuration → Sécurité**
3. Changez le token URL et le mot de passe admin
4. Configurez les numéros Orange Money / Moov Money
5. Configurez le WhatsApp support

---

## 🔥 Structure Firestore créée automatiquement

```
Firestore
├── merchants/
│   └── {merchantId}/
│       ├── (fields: nom_commerce, telephone, licence_expiry...)
│       ├── products/       ← sous-collection
│       ├── clients/        ← sous-collection
│       ├── sales/          ← sous-collection
│       ├── config/main     ← document unique
│       └── notifications/  ← temps réel
├── payment_requests/       ← demandes de paiement
├── admin_config/main       ← config admin unique
└── activity_log/           ← journal
```

---

## 📊 Quotas Firebase gratuits (Spark plan)

| Ressource | Gratuit/jour | Suffisant pour |
|-----------|-------------|----------------|
| Lectures Firestore | 50 000 | ~500 utilisateurs actifs |
| Écritures Firestore | 20 000 | ~1000 ventes/jour |
| Stockage | 1 GB | Toutes vos données |
| Bande passante | 10 GB/mois | Largement suffisant |

> Pour une croissance au-delà de 500 marchands actifs → passer au plan Blaze (pay-as-you-go, très peu coûteux).

---

## 🛡️ Checklist avant mise en production

- [ ] `firebaseConfig` configuré dans `firebase_client.js`
- [ ] Fichier renommé `index.html`
- [ ] `firebase_client.js` importé dans `index.html`
- [ ] Règles Firestore appliquées
- [ ] Token admin changé
- [ ] Mot de passe admin changé
- [ ] Numéros Mobile Money configurés
- [ ] WhatsApp support configuré
- [ ] Tarifs vérifiés (Mensuel / Annuel)
- [ ] Démo testée
- [ ] Testé sur mobile
- [ ] Repo GitHub créé (Private)
- [ ] Déployé sur Vercel ✅

---

## 🗺️ Roadmap

```
Phase actuelle — HTML + LocalStorage (local)
         ↓
Phase 2  — HTML + Firebase Firestore (cloud) ← VOUS ÊTES ICI
         ↓
Phase 3  — Firebase Auth (SMS OTP pour les marchands)
         ↓
Phase 4  — Firebase Functions (API paiement Orange/Moov officielle)
         ↓
Phase 5  — React Native app mobile
```
