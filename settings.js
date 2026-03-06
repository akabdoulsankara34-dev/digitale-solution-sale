// ---- SETTINGS ----
function renderSettings() {
  const m = Auth.current(); if (!m) return;
  const cfg = getConfig();
  document.getElementById('s-nom').value = m.nom_commerce;
  document.getElementById('s-proprio').value = m.proprietaire;
  document.getElementById('s-ville').value = m.ville;
  document.getElementById('s-tel').value = m.telephone;
  document.getElementById('s-welcome').value = cfg.message_accueil || '';
  document.getElementById('s-wa-msg').value = cfg.wa_message || '';
  document.getElementById('s-devise').value = cfg.devise || 'FCFA';
  const lic = getLicStatus(m), exp = m.licence_expiry ? new Date(m.licence_expiry) : null;
  const days = exp ? Math.max(0, Math.ceil((exp - new Date()) / 86400000)) : 0;
  document.getElementById('l-status').textContent = lic.lbl;
  document.getElementById('l-status').className = 'bs ' + (lic.st === 'active' ? 'active' : 'expired');
  document.getElementById('l-expire').textContent = exp ? exp.toLocaleDateString('fr-FR') : '—';
  document.getElementById('l-days').textContent = days + ' jours';
}

function confirmReset() {
  const m = Auth.current(); if (!m) return;
  if (!confirm('⚠️ Supprimer TOUTES vos données ?')) return;
  if (!confirm('DERNIÈRE CONFIRMATION : action irréversible !')) return;
  ['products','sales','clients'].forEach(t => DB.set(t, DB.get(t).filter(r => r.merchant_id !== m.id)));
  showToast('🗑️ Données supprimées', 'success'); renderDashboard();
}


// ---- AUTH HANDLERS ----
function registerMerchant(e) {
  e.preventDefault();
  const er = document.getElementById('reg-err'); er.classList.add('hidden');
  const p = document.getElementById('reg-pwd').value, p2 = document.getElementById('reg-pwd2').value;
  if (p !== p2) { er.textContent = 'Les mots de passe ne correspondent pas.'; er.classList.remove('hidden'); return; }
  try {
    const m = Auth.register({
      nom_commerce: document.getElementById('reg-nom').value.trim(),
      proprietaire: document.getElementById('reg-proprio').value.trim(),
      telephone: document.getElementById('reg-tel').value.trim(),
      ville: document.getElementById('reg-ville').value.trim(),
      password: p, type: document.getElementById('reg-type').value
    });
    Auth.login(m.telephone, p);
    showPage('page-app');
    showToast('🎉 Bienvenue sur Digitale Solution !', 'success');
  } catch(err) { er.textContent = err.message; er.classList.remove('hidden'); }
}
function loginMerchant(e) {
  e.preventDefault();
  const er = document.getElementById('login-err'); er.classList.add('hidden');
  try { Auth.login(document.getElementById('login-tel').value.trim(), document.getElementById('login-pwd').value); showPage('page-app'); }
  catch(err) { er.textContent = err.message; er.classList.remove('hidden'); }
}
function demoLogin() {
  const ph = '0700000001';
  // Always wipe and recreate for clean demo
  const old = DB.get('merchants').find(m => m.telephone === ph);
  if (old) {
    ['products','sales','clients','configs'].forEach(t => DB.set(t, DB.get(t).filter(r => r.merchant_id !== old.id)));
    DB.set('merchants', DB.get('merchants').filter(m => m.telephone !== ph));
  }
  Auth.register({nom_commerce:'Restaurant Djolof',proprietaire:'Aminata Diallo',telephone:ph,ville:'Dakar',password:'demo1234',type:'restaurant'});
  const dm = DB.get('merchants').find(m => m.telephone === ph);
  if (dm) {
    [{nom:'Thiéboudienne',prix:3500,stock:50,categorie:'Plat'},{nom:'Yassa Poulet',prix:2800,stock:40,categorie:'Plat'},
     {nom:'Mafé',prix:3000,stock:35,categorie:'Plat'},{nom:'Jus de Bissap',prix:800,stock:100,categorie:'Boisson'},
     {nom:'Thiakry',prix:1200,stock:30,categorie:'Dessert'},{nom:'Eau minérale',prix:500,stock:200,categorie:'Boisson'}]
    .forEach(p => DB.insert('products', p, dm.id));
    [{nom:'Modou Gueye',whatsapp:'221770123456'},{nom:'Fatou Sow',whatsapp:'221760987654'},{nom:'Ibrahima Diallo',whatsapp:''}]
    .forEach(c => DB.insert('clients', c, dm.id));
    const c1 = DB.forM('clients', dm.id)[0];
    DB.insert('sales',{client_id:c1.id,client_nom:c1.nom,client_wa:c1.whatsapp,
      items:[{product_id:'d1',nom:'Thiéboudienne',prix:3500,qty:2},{product_id:'d2',nom:'Jus de Bissap',prix:800,qty:2}],
      total:8600,devise:'FCFA'},dm.id);
    const c2 = DB.forM('clients', dm.id)[1];
    DB.insert('sales',{client_id:c2.id,client_nom:c2.nom,client_wa:c2.whatsapp,
      items:[{product_id:'d3',nom:'Yassa Poulet',prix:2800,qty:1},{product_id:'d4',nom:'Thiakry',prix:1200,qty:2}],
      total:5200,devise:'FCFA'},dm.id);
  }
  Auth.login(ph, 'demo1234');
  showPage('page-app');
  showToast('👋 Démo Restaurant Djolof chargée !', 'success');
}
function logout() { Auth.logout(); cart = []; pinUnlocked = false; showPage('page-landing'); }

