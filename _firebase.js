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
