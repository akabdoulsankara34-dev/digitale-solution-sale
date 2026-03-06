// ============================================================
// MODIFIED FUNCTIONS — override existing ones
// ============================================================

// Override initApp to check licence and show payment page if expired
const _origInitApp = typeof initApp === 'function' ? initApp : null;
function initApp(){
  const m = Auth.current(); if(!m){showPage('page-login');return;}
  document.getElementById('sb-cname').textContent = m.nom_commerce;
  document.getElementById('mm-name').textContent = m.proprietaire;
  document.getElementById('mm-city').textContent = m.ville;
  document.getElementById('mm-av').textContent = m.proprietaire.charAt(0).toUpperCase();
  document.getElementById('cb-name').textContent = m.nom_commerce;
  const icons = {restaurant:'🍽️',boutique:'🛍️',hotel:'🏨',pharmacie:'💊',autre:'📦'};
  document.getElementById('cb-ico').textContent = icons[m.type]||'🏪';
  checkLicense(m);
  showSection('pos');
  // Check if there's a pending payment request for this merchant
  const pending=ADB.getPayReqs().filter(r=>r.merchant_id===m.id&&r.statut==='pending');
  if(pending.length){
    showToast('⏳ Votre demande de paiement est en cours de vérification...','success');
  }
}

// Override showPage to handle admin routes
const _origShowPage = showPage;
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const target = document.getElementById(id);
  if(target) target.classList.add('active');
  if(id==='page-app') initApp();
  if(id==='page-admin'){
    if(!AdminAuth.isLogged()){
      // Redirige vers login admin sans boucle
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      document.getElementById('page-admin-login')?.classList.add('active');
      setTimeout(()=>document.getElementById('adm-pwd')?.focus(),200);
    } else {
      adminSection('overview');
      startAdminClock();
      updatePayBadge();
    }
  }
  if(id==='page-payment') {
    const theme = localStorage.getItem('ds_theme')||'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Check URL for admin token on load
function checkAdminToken(){
  const params=new URLSearchParams(window.location.search);
  const token=params.get('admin');
  const cfg=ADB.getCfg();
  if(token&&token===cfg.token){
    if(AdminAuth.isLogged()){
      showPage('page-admin');
      adminSection('overview');
      startAdminClock();
      updatePayBadge();
    } else {
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      document.getElementById('page-admin-login')?.classList.add('active');
    }
  }
}

// Expose openPaymentPage on the renewal button (modify checkLicense banner)
function renewLicense(){
  openPaymentPage();
}

// --- FINAL INIT SUPABASE OVERRIDE ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Démarrage de Digitale Solution (Supabase)...');

  // 1. Appliquer le thème
  const savedTheme = localStorage.getItem('ds_theme') || 'dark';
  if (window.setTheme) setTheme(savedTheme, null);

  // 2. Attendre que supabase_client.js soit chargé (max 2 secondes)
  let retry = 0;
  while (!window.Auth && retry < 20) {
    await new Promise(r => setTimeout(r, 100));
    retry++;
  }

  // 3. Gestion de l'accès Admin ou Utilisateur
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('admin');

  if (urlToken) {
    // Logique Admin (On simplifie pour Supabase)
    const validToken = 'DIGITALE'; // Ton token par défaut
    if (urlToken === validToken) {
      if (window.AdminAuth && AdminAuth.isLogged()) {
        showPage('page-admin');
      } else {
        showPage('page-admin-login');
      }
    } else {
      showPage('page-landing');
    }
  } else {
    // Route normale utilisateur
    if (window.Auth) {
      const m = Auth.current();
      if (m) {
        showPage('page-app');
        if (window.renderDashboard) renderDashboard();
      } else {
        showPage('page-landing');
      }
    }
    if (window.renderCart) renderCart();
  }
});