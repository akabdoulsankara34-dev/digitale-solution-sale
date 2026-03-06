// ---- THEME ----
function setTheme(t, el) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('ds_theme', t);
  // Update all pill indicators
  document.querySelectorAll('.tsw-pill,.tp').forEach(p => {
    p.classList.toggle('active', p.dataset.t === t);
  });
}
// Apply saved theme on load
(function(){
  const saved = localStorage.getItem('ds_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.querySelectorAll('.tsw-pill,.tp').forEach(p => {
    p.classList.toggle('active', p.dataset.t === saved);
  });
})();


// ---- PIN SYSTEM ----
let pinBuffer = '';
let pinTarget = '';  // section to open after correct PIN
let pinUnlocked = false;
let pinUnlockTimer = null;

function reqPin(section) {
  const cfg = getConfig();
  // If no PIN set, or already unlocked → go directly
  const m2 = Auth.current();
  if (m2) {
    const lst = getLicStatus(m2).st;
    if ((lst === 'expired' || lst === 'suspended') && section !== 'settings') {
      openPaymentPage(); return;
    }
  }
  if (!cfg.pin || cfg.pin.length < 4 || pinUnlocked) {
    showSection(section);
    return;
  }
  pinTarget = section;
  pinBuffer = '';
  updatePinDots();
  document.getElementById('pin-err').textContent = '';
  document.getElementById('pin-modal-hint').textContent = 'Entrez votre PIN (4 chiffres) pour accéder à cette section.';
  document.getElementById('mo-pin').classList.remove('hidden');
}

function pinKey(k) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += k;
  updatePinDots();
  if (pinBuffer.length === 4) {
    const cfg = getConfig();
    if (DB._hash(pinBuffer) === cfg.pin) {
      closeMo('mo-pin');
      pinUnlocked = true;
      clearTimeout(pinUnlockTimer);
      pinUnlockTimer = setTimeout(() => { pinUnlocked = false; }, 5 * 60 * 1000); // 5min
      showSection(pinTarget);
    } else {
      document.getElementById('pin-err').textContent = '❌ PIN incorrect. Réessayez.';
      setTimeout(() => { pinBuffer = ''; updatePinDots(); document.getElementById('pin-err').textContent=''; }, 800);
    }
  }
}

function pinDel() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    document.getElementById('pd' + i).classList.toggle('filled', i < pinBuffer.length);
  }
}

function savePin() {
  const np = document.getElementById('s-pin-new').value;
  const nc = document.getElementById('s-pin-conf').value;
  if (np.length !== 4 || !/^\d{4}$/.test(np)) { showToast('⚠️ Le PIN doit être 4 chiffres', 'error'); return; }
  if (np !== nc) { showToast('⚠️ Les PINs ne correspondent pas', 'error'); return; }
  const m = Auth.current(); if (!m) return;
  const cfgs = DB.get('configs'), i = cfgs.findIndex(c => c.merchant_id === m.id);
  if (i !== -1) { cfgs[i].pin = DB._hash(np); DB.set('configs', cfgs); }
  document.getElementById('s-pin-new').value = '';
  document.getElementById('s-pin-conf').value = '';
  pinUnlocked = true;
  showToast('✅ PIN enregistré avec succès', 'success');
}


// ---- NAV ----
// [replaced by admin version below]
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  document.getElementById('s-' + name)?.classList.add('active');
  document.querySelector('[data-s="' + name + '"]')?.classList.add('active');
  const titles = {dashboard:'Dashboard',pos:'Point de Vente',products:'Produits',clients:'Clients',sales:'Ventes',settings:'Paramètres'};
  document.getElementById('tb-title').textContent = titles[name] || name;
  // Update expiry warning in topbar
  const curM = Auth.current();
  if(curM){
    const st=getLicStatus(curM);
    const warn=document.getElementById('lic-exp-warn');
    if(warn){
      if(st.st==='grace'){warn.textContent='⚠️ Mode grâce — '+st.lbl;warn.style.display='block';}
      else warn.style.display='none';
    }
  }
  document.getElementById('sidebar').classList.remove('mob-open');
  ({dashboard:renderDashboard,pos:renderPOS,products:renderProducts,clients:renderClients,sales:renderSales,settings:renderSettings})[name]?.();
}
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  window.innerWidth <= 900 ? sb.classList.toggle('mob-open') : sb.classList.toggle('coll');
}


// ---- LICENCE ----
function getLicStatus(m) {
  if (m.licence === 'suspendue') return {st:'suspended',css:'suspended',lbl:'Licence suspendue'};
  if (m.licence_expiry) {
    const exp = new Date(m.licence_expiry), now = new Date();
    const diffDays = Math.ceil((exp - now) / 86400000);
    if (now > exp) {
      // Grace period: 48h after expiry POS still works, rest locked
      const hoursAfter = (now - exp) / 3600000;
      if (hoursAfter <= 48) {
        Auth.refresh({licence:'grace'});
        return {st:'grace',css:'suspended',lbl:'Grâce ' + Math.ceil(48-hoursAfter) + 'h'};
      }
      Auth.refresh({licence:'expirée'});
      return {st:'expired',css:'expired',lbl:'Licence expirée'};
    }
    if (diffDays <= 3) return {st:'active',css:'',lbl:'⚠️ Expire dans ' + diffDays + 'j'};
    if (diffDays <= 7) return {st:'active',css:'',lbl:'Expire dans ' + diffDays + 'j'};
  }
  return {st:'active',css:'',lbl:'Licence active'};
}
function checkLicense(m) {
  const s = getLicStatus(m);
  document.getElementById('lic-badge').className = 'lic-badge ' + (s.css || '');
  document.getElementById('lic-text').textContent = s.lbl;
  document.getElementById('lic-exp').classList.toggle('hidden', s.st === 'active');
}
// [replaced by admin version below]


// ---- CONFIG ----
function getConfig() {
  const m = Auth.current(); if (!m) return {};
  return DB.get('configs').find(c => c.merchant_id === m.id) || {};
}
function saveSetting(k, v) {
  const m = Auth.current(); if (!m) return;
  const cfgs = DB.get('configs'), i = cfgs.findIndex(c => c.merchant_id === m.id);
  if (i !== -1) { cfgs[i][k] = v; DB.set('configs', cfgs); }
  showToast('✅ Sauvegardé', 'success');
}
function saveWelcome() {
  saveSetting('message_accueil', document.getElementById('s-welcome').value.trim());
  saveSetting('wa_message', document.getElementById('s-wa-msg').value.trim());
}
function saveMerchantInfo() {
  const u = {
    nom_commerce: document.getElementById('s-nom').value.trim(),
    proprietaire: document.getElementById('s-proprio').value.trim(),
    ville: document.getElementById('s-ville').value.trim(),
    telephone: document.getElementById('s-tel').value.trim()
  };
  if (!u.nom_commerce) { showToast('⚠️ Nom requis', 'error'); return; }
  Auth.refresh(u);
  document.getElementById('sb-cname').textContent = u.nom_commerce;
  document.getElementById('mm-name').textContent = u.proprietaire;
  document.getElementById('mm-city').textContent = u.ville;
  document.getElementById('mm-av').textContent = u.proprietaire.charAt(0).toUpperCase();
  document.getElementById('cb-name').textContent = u.nom_commerce;
  showToast('✅ Informations mises à jour', 'success');
}


// ---- MODALS ----
function closeMo(id) { document.getElementById(id)?.classList.add('hidden'); }
function closeMoOv(e, id) { if (e.target === document.getElementById(id)) closeMo(id); }


// ---- TOAST ----
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + (type || 'success'); t.classList.remove('hidden');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 4000);
}


// ---- UTILS ----
function fmtMoney(n, dev) {
  const f = (parseFloat(n) || 0).toLocaleString('fr-FR', {minimumFractionDigits:0,maximumFractionDigits:0});
  const syms = {USD:'$',EUR:'€',GBP:'£',NGN:'₦'};
  return syms[dev] ? syms[dev] + f : f + ' ' + (dev || 'FCFA');
}




// ---- SHOW PAGE ----
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  if (id === 'page-app') {
    if (typeof initApp === 'function') initApp();
  }

  if (id === 'page-admin') {
    if (typeof AdminAuth !== 'undefined' && !AdminAuth.isLogged()) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-admin-login')?.classList.add('active');
      setTimeout(() => document.getElementById('adm-pwd')?.focus(), 200);
    } else if (typeof adminSection === 'function') {
      adminSection('overview');
      if (typeof startAdminClock === 'function') startAdminClock();
      if (typeof updatePayBadge === 'function') updatePayBadge();
    }
  }

  if (id === 'page-payment') {
    const theme = localStorage.getItem('ds_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }
}
