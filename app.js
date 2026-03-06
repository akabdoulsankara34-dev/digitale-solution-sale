// ============================================================
// APP.JS — Init & Routing (chargé en dernier)
// showPage est définie dans ui.js
// ============================================================

// ---- INIT APP ----
function initApp() {
  const m = Auth.current();
  if (!m) { showPage('page-login'); return; }

  document.getElementById('sb-cname').textContent = m.nom_commerce;
  document.getElementById('mm-name').textContent = m.proprietaire;
  document.getElementById('mm-city').textContent = m.ville;
  document.getElementById('mm-av').textContent = m.proprietaire.charAt(0).toUpperCase();
  document.getElementById('cb-name').textContent = m.nom_commerce;

  const icons = { restaurant:'🍽️', boutique:'🛍️', hotel:'🏨', pharmacie:'💊', autre:'📦' };
  document.getElementById('cb-ico').textContent = icons[m.type] || '🏪';

  checkLicense(m);
  showSection('pos');

  const pending = ADB.getPayReqs().filter(r => r.merchant_id === m.id && r.statut === 'pending');
  if (pending.length) showToast('⏳ Votre demande de paiement est en cours de vérification...', 'success');
}

// ---- RENEW LICENCE ----
function renewLicense() { openPaymentPage(); }

// ---- DÉMARRAGE ----
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Démarrage de Digitale Solution...');

  // Thème
  const savedTheme = localStorage.getItem('ds_theme') || 'dark';
  setTheme(savedTheme, null);

  // Routing
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('admin');

  if (urlToken) {
    const validToken = ADB.getCfg()?.token || 'DIGITALE';
    if (urlToken === validToken) {
      if (AdminAuth.isLogged()) {
        showPage('page-admin');
      } else {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-admin-login')?.classList.add('active');
      }
    } else {
      showPage('page-landing');
    }
  } else {
    const m = Auth.current();
    if (m) {
      showPage('page-app');
      renderDashboard();
    } else {
      showPage('page-landing');
    }
    if (typeof renderCart === 'function') renderCart();
  }
});

// ---- Enregistrement des vraies fonctions dans le proxy ----
(function(){
  var fns = {
    showPage, demoLogin, setTheme, showSection, toggleSidebar,
    reqPin, closeMo, closeMoOv, logout, registerMerchant, loginMerchant,
    saveProduct, deleteProduct, openProductModal, addToCart, updCartQty,
    rmFromCart, clearCart, checkout, setPrintFmt, doPrint, sendWA,
    viewSaleInvoice, sendWAMarketing, openClientModal, saveClient, deleteClient,
    renderSales, deleteSale, saveWelcome, saveMerchantInfo, savePin,
    confirmReset, pinKey, pinDel, adminLogin, adminLogout, adminSection,
    openMerchantDetail, saveMerchantAdmin, toggleMerchantStatus,
    deleteMerchantAdmin, validatePayReq, rejectPayReq, savePlans,
    saveAdminConfig, saveOperators, openPaymentPage, goToPayStep,
    selectPlan, selectOperator, submitPayment, renewLicense
  };
  Object.keys(fns).forEach(function(n){
    if(typeof fns[n]==='function') window['_fn_'+n] = fns[n];
  });
  if(window.__flushProxy) window.__flushProxy();
})();
