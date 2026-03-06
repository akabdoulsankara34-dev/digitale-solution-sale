// ============================================================
// DIGITALE SOLUTION — ADMIN SYSTEM
// ============================================================

// ---- ADMIN DB (separate namespace 'dsa_') ----
const ADB = {
  get(k){try{return JSON.parse(localStorage.getItem('dsa_'+k)||'null')}catch{return null}},
  set(k,v){localStorage.setItem('dsa_'+k,JSON.stringify(v))},
  getArr(k){const v=this.get(k);return Array.isArray(v)?v:[]},

  // Default admin config
  initDefaults(){
    if(!this.get('config')){
      this.set('config',{
        password_hash: DB._hash('admin2024'),
        token: 'DIGITALE',
        orange_num: '22670000000',
        orange_name: 'DIGITALE SOLUTION',
        moov_num: '22675000000',
        moov_name: 'DIGITALE SOLUTION',
        wa_support: '22670000000',
        plans:{
          mensuel:{prix:5000,jours:30,label:'Mensuel'},
          annuel:{prix:45000,jours:365,label:'Annuel',badge:'-25%'}
        }
      });
    }
    if(!this.get('activity')) this.set('activity',[]);
    if(!this.get('payment_requests')) this.set('payment_requests',[]);
  },

  getCfg(){return this.get('config')||{}},
  getPlans(){return (this.getCfg().plans)||{mensuel:{prix:5000,jours:30,label:'Mensuel'},annuel:{prix:45000,jours:365,label:'Annuel',badge:'-25%'}}},
  getPayReqs(){return this.getArr('payment_requests')},

  addActivity(type,txt){
    const log=this.getArr('activity');
    log.unshift({type,txt,ts:new Date().toISOString()});
    if(log.length>100) log.pop();
    this.set('activity',log);
  },

  addPayReq(req){
    const list=this.getPayReqs();
    const r={...req,id:'PAY-'+Date.now().toString(36).toUpperCase(),created_at:new Date().toISOString(),statut:'pending'};
    list.unshift(r); this.set('payment_requests',list); return r;
  },

  updatePayReq(id,ups){
    const list=this.getPayReqs(),i=list.findIndex(r=>r.id===id);
    if(i!==-1){list[i]={...list[i],...ups,updated_at:new Date().toISOString()}; this.set('payment_requests',list);return list[i];}
    return null;
  }
};

// ---- ADMIN SESSION ----
const AdminAuth = {
  login(pwd){
    const cfg=ADB.getCfg();
    if(DB._hash(pwd)!==cfg.password_hash) throw new Error('Mot de passe incorrect.');
    sessionStorage.setItem('dsa_session','1');
  },
  isLogged(){return sessionStorage.getItem('dsa_session')==='1'},
  logout(){sessionStorage.removeItem('dsa_session')}
};

// ---- ADMIN NAV ----
let currentMerchDetailId = null;
let currentPayFilter = 'pending';

function adminSection(name){
  document.querySelectorAll('.adm-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.adm-ni').forEach(n=>n.classList.remove('active'));
  document.getElementById('as-'+name)?.classList.add('active');
  document.querySelector('[data-as="'+name+'"]')?.classList.add('active');
  const titles={overview:'Vue d\'ensemble',merchants:'Gestion des commerces',payments:'Demandes de paiement',plans:'Plans & Tarifs',config:'Configuration',activity:'Journal d\'activité'};
  document.getElementById('adm-title').textContent = titles[name]||name;
  const renders={overview:renderAdminOverview,merchants:renderAdminMerchants,payments:renderAdminPayments,plans:renderAdminPlans,config:renderAdminConfig,activity:renderAdminActivity};
  renders[name]?.();
}

function adminLogin(){
  const pwd=document.getElementById('adm-pwd').value;
  const err=document.getElementById('adm-login-err');
  err.textContent='';
  try{
    AdminAuth.login(pwd);
    document.getElementById('adm-pwd').value='';
    showPage('page-admin');
    adminSection('overview');
    startAdminClock();
    ADB.addActivity('login','Connexion admin effectuée');
    updatePayBadge();
  } catch(e){ err.textContent=e.message; }
}

function adminLogout(){
  AdminAuth.logout();
  ADB.addActivity('logout','Déconnexion admin');
  showPage('page-landing');
}

function startAdminClock(){
  function tick(){ const el=document.getElementById('adm-clock'); if(el) el.textContent=new Date().toLocaleTimeString('fr-FR'); }
  tick(); setInterval(tick,1000);
}

function updatePayBadge(){
  const pending=ADB.getPayReqs().filter(r=>r.statut==='pending').length;
  const b=document.getElementById('adm-pay-badge');
  if(!b) return;
  b.textContent=pending; b.style.display=pending>0?'inline':'none';
}

// ---- OVERVIEW ----
function renderAdminOverview(){
  const merchants=DB.get('merchants').filter(m=>m.actif!==false);
  const total=merchants.length;
  let active=0,expired=0,revenue=0;
  const plans=ADB.getPlans();
  merchants.forEach(m=>{
    const s=getLicStatus(m);
    if(s.st==='active') active++;
    else expired++;
    // Estimate revenue based on plan type
    revenue += m.plan_type==='annuel' ? plans.annuel.prix : plans.mensuel.prix;
  });
  document.getElementById('ak-total').textContent=total;
  document.getElementById('ak-active').textContent=active;
  document.getElementById('ak-expired').textContent=expired;
  document.getElementById('ak-revenue').textContent=fmtMoney(revenue,'FCFA');

  // Expiring soon (7 days)
  const expiring=merchants.filter(m=>{
    if(!m.licence_expiry) return false;
    const d=Math.ceil((new Date(m.licence_expiry)-new Date())/86400000);
    return d>=0&&d<=7;
  }).sort((a,b)=>new Date(a.licence_expiry)-new Date(b.licence_expiry));
  document.getElementById('ak-expiring').innerHTML=expiring.length?expiring.map(m=>{
    const d=Math.ceil((new Date(m.licence_expiry)-new Date())/86400000);
    return '<div class="activity-item"><div class="act-dot orange"></div><div class="act-txt"><strong>'+m.nom_commerce+'</strong> — '+m.ville+'<br/><span style="font-size:.73rem;color:#64748B">Expire dans '+d+' jour(s)</span></div><button class="btn-p sm" onclick="openMerchDetail(\''+m.id+'\')">Gérer</button></div>';
  }).join(''):'<p style="color:#374151;font-size:.82rem">Aucune expiration dans les 7 prochains jours.</p>';

  // Recent signups
  const recent=[...merchants].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  document.getElementById('ak-recent').innerHTML=recent.length?recent.map(m=>
    '<div class="activity-item"><div class="act-dot blue"></div><div class="act-txt"><strong>'+m.nom_commerce+'</strong><br/><span style="font-size:.73rem;color:#64748B">'+m.ville+' · '+new Date(m.created_at).toLocaleDateString('fr-FR')+'</span></div></div>'
  ).join(''):'<p style="color:#374151;font-size:.82rem">Aucun commerce.</p>';

  // Pay preview
  const payReqs=ADB.getPayReqs().filter(r=>r.statut==='pending').slice(0,3);
  document.getElementById('ak-pay-preview').innerHTML=payReqs.length?payReqs.map(r=>buildPayReqCard(r,true)).join('')+'<div style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.04)"><button class="btn-g sm" onclick="adminSection(\'payments\')">Voir toutes les demandes →</button></div>':'<p style="padding:16px;color:#374151;font-size:.82rem">Aucune demande en attente.</p>';
  updatePayBadge();
}

// ---- MERCHANTS ----
function renderAdminMerchants(){
  const merchants=DB.get('merchants');
  const q=(document.getElementById('adm-merch-srch')?.value||'').toLowerCase();
  const sf=(document.getElementById('adm-merch-filter')?.value||'');
  const f=merchants.filter(m=>{
    const match=!q||(m.nom_commerce||'').toLowerCase().includes(q)||(m.ville||'').toLowerCase().includes(q)||(m.proprietaire||'').toLowerCase().includes(q);
    const s=getLicStatus(m).st;
    const statMatch=!sf||s===sf;
    return match&&statMatch;
  });
  const plans=ADB.getPlans();
  document.getElementById('adm-merch-tbody').innerHTML=f.length?f.map(m=>{
    const s=getLicStatus(m);
    const exp=m.licence_expiry?new Date(m.licence_expiry).toLocaleDateString('fr-FR'):'—';
    const planLabel=m.plan_type==='annuel'?plans.annuel.label:plans.mensuel.label;
    return '<tr><td><strong style="color:#E2E8F0">'+m.nom_commerce+'</strong><br/><span style="font-size:.72rem;color:#475569">'+m.telephone+'</span></td><td>'+m.proprietaire+'</td><td>'+m.ville+'</td><td><span style="font-size:.78rem;color:#64748B">'+planLabel+'</span></td><td><span class="sbadge '+s.st+'">'+s.lbl+'</span></td><td style="font-size:.8rem">'+exp+'</td><td><button class="btn-p sm" onclick="openMerchDetail(\''+m.id+'\')">Gérer</button></td></tr>';
  }).join(''):'<tr><td colspan="7" style="text-align:center;color:#374151;padding:32px">Aucun commerce trouvé.</td></tr>';
}

function openMerchDetail(mid){
  const m=DB.get('merchants').find(x=>x.id===mid); if(!m) return;
  currentMerchDetailId=mid;
  const s=getLicStatus(m);
  const exp=m.licence_expiry?new Date(m.licence_expiry).toLocaleDateString('fr-FR'):'—';
  const days=m.licence_expiry?Math.max(0,Math.ceil((new Date(m.licence_expiry)-new Date())/86400000)):0;
  document.getElementById('md-title').textContent=m.nom_commerce;
  document.getElementById('md-info').innerHTML=[
    ['Commerce',m.nom_commerce],['Propriétaire',m.proprietaire],
    ['Téléphone',m.telephone],['Ville',m.ville],
    ['Type',m.type],['Statut','<span class="sbadge '+s.st+'">'+s.lbl+'</span>'],
    ['Expiration',exp],['Jours restants',days+' j'],
    ['Plan',m.plan_type||'mensuel'],['Inscrit le',new Date(m.created_at).toLocaleDateString('fr-FR')]
  ].map(([l,v])=>'<div class="merch-detail-row"><label>'+l+'</label><span>'+v+'</span></div>').join('');
  const suspBtn=document.getElementById('md-suspend-btn');
  if(suspBtn) suspBtn.textContent=m.actif===false?'Réactiver':'Suspendre';
  document.getElementById('mo-merch-detail').classList.remove('hidden');
  // Custom days toggle
  document.getElementById('md-extend-plan').onchange=function(){
    const wrap=document.getElementById('md-custom-days-wrap');
    if(wrap) wrap.style.display=this.value==='custom'?'block':'none';
  };
}

function extendMerchant(){
  if(!currentMerchDetailId) return;
  const planSel=document.getElementById('md-extend-plan').value;
  let days=parseInt(planSel);
  if(planSel==='custom'){
    days=parseInt(document.getElementById('md-custom-days').value);
    if(isNaN(days)||days<1){showToast('⚠️ Entrez un nombre de jours valide','error');return;}
  }
  const ms=DB.get('merchants'),idx=ms.findIndex(m=>m.id===currentMerchDetailId);
  if(idx===-1) return;
  // Extend from today or from current expiry, whichever is later
  const base=ms[idx].licence_expiry&&new Date(ms[idx].licence_expiry)>new Date()?new Date(ms[idx].licence_expiry):new Date();
  base.setDate(base.getDate()+days);
  const planType=days>=300?'annuel':'mensuel';
  ms[idx].licence=ms[idx].actif=true;
  ms[idx].actif=true;
  ms[idx].licence='active';
  ms[idx].licence_expiry=base.toISOString();
  ms[idx].plan_type=planType;
  DB.set('merchants',ms);
  ADB.addActivity('extend','Abonnement '+ms[idx].nom_commerce+' prolongé de '+days+' jours (jusqu\'au '+base.toLocaleDateString('fr-FR')+')');
  showAdminToast('✅ Abonnement activé pour '+days+' jours','success');
  closeMo('mo-merch-detail');
  renderAdminMerchants();
  renderAdminOverview();
}

function suspendMerchant(){
  if(!currentMerchDetailId) return;
  const ms=DB.get('merchants'),idx=ms.findIndex(m=>m.id===currentMerchDetailId);
  if(idx===-1) return;
  const isSuspended=ms[idx].actif===false;
  ms[idx].actif=isSuspended?true:false;
  if(!isSuspended) ms[idx].licence='suspendue';
  else ms[idx].licence='active';
  DB.set('merchants',ms);
  ADB.addActivity(isSuspended?'reactivate':'suspend',(isSuspended?'Réactivation':'Suspension')+' de '+ms[idx].nom_commerce);
  showAdminToast(isSuspended?'✅ Commerce réactivé':'🔒 Commerce suspendu','success');
  closeMo('mo-merch-detail');
  renderAdminMerchants();
}

// ---- PAYMENTS ----
function renderAdminPayments(){
  filterPayments(currentPayFilter, document.getElementById('pf-'+currentPayFilter));
}

function filterPayments(f, btn){
  currentPayFilter=f;
  document.querySelectorAll('.fmt-btn[id^="pf-"]').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
  let reqs=ADB.getPayReqs();
  if(f!=='all') reqs=reqs.filter(r=>r.statut===f);
  const container=document.getElementById('adm-pay-list');
  container.innerHTML=reqs.length?reqs.map(r=>buildPayReqCard(r,false)).join(''):'<div style="text-align:center;padding:40px;color:#374151;font-size:.85rem">Aucune demande '+(f==='pending'?'en attente':f==='validated'?'validée':'rejetée')+'.</div>';
  // Bind action buttons
  container.querySelectorAll('[data-validate]').forEach(b=>b.onclick=()=>validatePayment(b.dataset.validate));
  container.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>rejectPayment(b.dataset.reject));
}

function buildPayReqCard(r, compact){
  const plans=ADB.getPlans();
  const plan=plans[r.plan]||{label:r.plan,prix:r.montant};
  const opColor=r.operateur==='orange'?'#FF8C00':'#0064C8';
  const opIco=r.operateur==='orange'?'🟠':'🔵';
  const actions=r.statut==='pending'&&!compact?
    '<button class="btn-p sm" data-validate="'+r.id+'">✅ Valider</button><button style="background:rgba(231,76,60,.15);color:#E74C3C;border:1px solid rgba(231,76,60,.3);padding:5px 12px;border-radius:6px;font-size:.78rem;cursor:pointer" data-reject="'+r.id+'">❌ Rejeter</button>':
    compact&&r.statut==='pending'?'<button class="btn-p sm" onclick="adminSection(\'payments\')">Traiter</button>':'';
  return '<div class="pay-req '+r.statut+'">'+
    '<div class="pay-req-info">'+
      '<div class="pay-req-name">'+r.nom_commerce+'</div>'+
      '<div class="pay-req-meta">'+
        '<span>'+opIco+' '+r.operateur.charAt(0).toUpperCase()+r.operateur.slice(1)+'</span>'+
        '<span style="color:#E8730C;font-weight:700">'+fmtMoney(r.montant,'FCFA')+'</span>'+
        '<span>'+plan.label+'</span>'+
        '<span>'+new Date(r.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+'</span>'+
      '</div>'+
      '<div class="pay-req-ref">Réf: '+r.reference+'</div>'+
      (r.trans_ref?'<div class="pay-req-ref" style="color:#4FC3F7">Trans: '+r.trans_ref+'</div>':'')+
    '</div>'+
    '<div class="pay-req-acts" style="align-items:center;gap:8px;display:flex">'+
      '<span class="sbadge '+r.statut+'">'+{pending:'En attente',validated:'Validé',rejected:'Rejeté'}[r.statut]+'</span>'+
      actions+
    '</div>'+
  '</div>';
}

function validatePayment(id){
  const req=ADB.getPayReqs().find(r=>r.id===id); if(!req) return;
  // Activate merchant subscription
  const ms=DB.get('merchants'),idx=ms.findIndex(m=>m.id===req.merchant_id);
  if(idx!==-1){
    const plans=ADB.getPlans(), plan=plans[req.plan]||{jours:30};
    const base=ms[idx].licence_expiry&&new Date(ms[idx].licence_expiry)>new Date()?new Date(ms[idx].licence_expiry):new Date();
    base.setDate(base.getDate()+plan.jours);
    ms[idx].licence='active'; ms[idx].actif=true; ms[idx].licence_expiry=base.toISOString(); ms[idx].plan_type=req.plan;
    DB.set('merchants',ms);
  }
  ADB.updatePayReq(id,{statut:'validated',validated_at:new Date().toISOString()});
  ADB.addActivity('validated','Paiement validé — '+req.nom_commerce+' ('+fmtMoney(req.montant,'FCFA')+')');
  // Refresh session if current logged-in merchant is the one being activated
  const cm=Auth.current();
  if(cm&&cm.id===req.merchant_id){
    const updated=DB.get('merchants').find(m=>m.id===req.merchant_id);
    if(updated) sessionStorage.setItem('ds_m',JSON.stringify(updated));
  }
  showAdminToast('✅ Abonnement activé pour '+req.nom_commerce,'success');
  renderAdminPayments(); renderAdminOverview(); updatePayBadge();
}

function rejectPayment(id){
  if(!confirm('Rejeter cette demande de paiement ?')) return;
  const req=ADB.getPayReqs().find(r=>r.id===id); if(!req) return;
  ADB.updatePayReq(id,{statut:'rejected',rejected_at:new Date().toISOString()});
  ADB.addActivity('rejected','Paiement rejeté — '+req.nom_commerce);
  showAdminToast('❌ Demande rejetée','error');
  renderAdminPayments(); updatePayBadge();
}

// ---- PLANS ----
function renderAdminPlans(){
  const plans=ADB.getPlans();
  document.getElementById('plan-m-prix').value=plans.mensuel.prix;
  document.getElementById('plan-m-jours').value=plans.mensuel.jours;
  document.getElementById('plan-m-label').value=plans.mensuel.label;
  document.getElementById('plan-a-prix').value=plans.annuel.prix;
  document.getElementById('plan-a-jours').value=plans.annuel.jours;
  const palEl=document.getElementById('plan-a-label');
  if(palEl) palEl.value=plans.annuel.label||'Annuel';
  document.getElementById('plan-a-badge').value=plans.annuel.badge||'';
  document.getElementById('plan-preview-cards').innerHTML=
    '<div class="plan-card"><h4>'+plans.mensuel.label+'</h4><div class="plan-price">'+fmtMoney(plans.mensuel.prix,'FCFA')+'</div><div class="plan-duration">'+plans.mensuel.jours+' jours</div></div>'+
    '<div class="plan-card" style="border-color:rgba(232,115,12,.3)"><h4>'+plans.annuel.label+'</h4>'+(plans.annuel.badge?'<span style="background:#E8730C;color:white;font-size:.65rem;padding:2px 8px;border-radius:100px">'+plans.annuel.badge+'</span>':'')+'<div class="plan-price">'+fmtMoney(plans.annuel.prix,'FCFA')+'</div><div class="plan-duration">'+plans.annuel.jours+' jours</div></div>';
}

function savePlans(){
  const cfg=ADB.getCfg();
  cfg.plans={
    mensuel:{prix:parseInt(document.getElementById('plan-m-prix').value)||5000, jours:parseInt(document.getElementById('plan-m-jours').value)||30, label:document.getElementById('plan-m-label').value||'Mensuel'},
    annuel:{prix:parseInt(document.getElementById('plan-a-prix').value)||45000, jours:parseInt(document.getElementById('plan-a-jours').value)||365, label:document.getElementById('plan-a-label')?document.getElementById('plan-a-label').value:'Annuel', badge:document.getElementById('plan-a-badge').value}
  };
  ADB.set('config',cfg);
  ADB.addActivity('config','Plans tarifaires mis à jour');
  showAdminToast('✅ Plans enregistrés','success');
  renderAdminPlans();
}

// ---- CONFIG ----
function renderAdminConfig(){
  const cfg=ADB.getCfg();
  // Orange
  document.getElementById('cfg-orange-num').value  = cfg.orange_num  || '';
  document.getElementById('cfg-orange-name').value = cfg.orange_name || 'DIGITALE SOLUTION';
  document.getElementById('cfg-orange-ussd').value = cfg.orange_ussd || '*144#';
  document.getElementById('cfg-moov-num').value    = cfg.moov_num    || '';
  document.getElementById('cfg-moov-name').value   = cfg.moov_name   || 'DIGITALE SOLUTION';
  document.getElementById('cfg-moov-ussd').value   = cfg.moov_ussd   || '*555#';
  document.getElementById('cfg-wa-support').value  = cfg.wa_support  || '';
  document.getElementById('cfg-adm-token').value   = cfg.token       || 'DIGITALE';
  // Country selects
  if(cfg.orange_country) document.getElementById('cfg-orange-country').value = cfg.orange_country;
  if(cfg.moov_country)   document.getElementById('cfg-moov-country').value   = cfg.moov_country;
  // Token preview
  const tp = document.getElementById('cfg-token-preview');
  if(tp) tp.textContent = '?admin=' + (cfg.token || 'DIGITALE');
  // Status indicators
  updateOpStatus();
  // Cards preview
  renderOpCardsPreview(cfg);
}

function renderOpCardsPreview(cfg){
  const el = document.getElementById('op-cards-preview');
  if(!el) return;
  const orange = cfg.orange_num || '';
  const moov   = cfg.moov_num   || '';
  const wa     = cfg.wa_support || '';
  el.innerHTML =
    '<div class="op-card" style="background:#0A0E16;border:1px solid rgba(255,140,0,'+(orange?'.3':'.1')+');border-radius:9px;padding:14px 16px;display:flex;align-items:center;gap:12px">'+
      '<div style="width:40px;height:40px;border-radius:10px;background:rgba(255,140,0,.12);display:flex;align-items:center;justify-content:center;font-size:1.2rem">🟠</div>'+
      '<div><div style="font-weight:700;font-size:.85rem;color:#E2E8F0">Orange Money</div>'+
      '<div style="font-family:monospace;font-size:.82rem;color:'+(orange?'#FF8C00':'#374151')+'">'+(orange||'Non configuré')+'</div></div>'+
    '</div>'+
    '<div class="op-card" style="background:#0A0E16;border:1px solid rgba(0,100,200,'+(moov?'.3':'.1')+');border-radius:9px;padding:14px 16px;display:flex;align-items:center;gap:12px">'+
      '<div style="width:40px;height:40px;border-radius:10px;background:rgba(0,100,200,.12);display:flex;align-items:center;justify-content:center;font-size:1.2rem">🔵</div>'+
      '<div><div style="font-weight:700;font-size:.85rem;color:#E2E8F0">Moov Money</div>'+
      '<div style="font-family:monospace;font-size:.82rem;color:'+(moov?'#4FC3F7':'#374151')+'">'+(moov||'Non configuré')+'</div></div>'+
    '</div>'+
    '<div class="op-card" style="background:#0A0E16;border:1px solid rgba(37,211,102,'+(wa?'.25':'.08')+');border-radius:9px;padding:14px 16px;display:flex;align-items:center;gap:12px">'+
      '<div style="width:40px;height:40px;border-radius:10px;background:rgba(37,211,102,.1);display:flex;align-items:center;justify-content:center;font-size:1.2rem">💬</div>'+
      '<div><div style="font-weight:700;font-size:.85rem;color:#E2E8F0">WhatsApp Support</div>'+
      '<div style="font-family:monospace;font-size:.82rem;color:'+(wa?'#25D366':'#374151')+'">'+(wa||'Non configuré')+'</div></div>'+
    '</div>';
}

function updateOpStatus(){
  const on = document.getElementById('cfg-orange-num').value.trim();
  const mn = document.getElementById('cfg-moov-num').value.trim();
  const os = document.getElementById('cfg-orange-status');
  const ms = document.getElementById('cfg-moov-status');
  if(os) { os.textContent = on ? '✅ Configuré — ' + on : '⚠️ Non configuré'; os.style.color = on ? '#2ECC71' : '#64748B'; }
  if(ms) { ms.textContent = mn ? '✅ Configuré — ' + mn : '⚠️ Non configuré'; ms.style.color = mn ? '#2ECC71' : '#64748B'; }
  // Token preview
  const tok = document.getElementById('cfg-adm-token');
  const tp  = document.getElementById('cfg-token-preview');
  if(tok && tp) tp.textContent = '?admin=' + (tok.value || 'DIGITALE');
}

function previewOrange(){ updateOpStatus(); }
function previewMoov()  { updateOpStatus(); }

// USSD auto-fill par pays
const USSD_CODES = {
  orange: {bf:'*144#', ci:'*144#', sn:'*144#', ml:'*144#', gn:'*144#'},
  moov:   {bf:'*555#', ci:'*155#', tg:'*155#', bj:'*155#'}
};
function onOrangeCountryChange(){
  const c = document.getElementById('cfg-orange-country').value;
  const u = USSD_CODES.orange[c] || '*144#';
  document.getElementById('cfg-orange-ussd').value = u;
}
function onMoovCountryChange(){
  const c = document.getElementById('cfg-moov-country').value;
  const u = USSD_CODES.moov[c] || '*555#';
  document.getElementById('cfg-moov-ussd').value = u;
}

// Test via WhatsApp
function testOrangeWA(){
  const num = document.getElementById('cfg-orange-num').value.trim();
  if(!num){ showAdminToast('⚠️ Entrez d\'abord le numéro Orange Money','error'); return; }
  const ussd = document.getElementById('cfg-orange-ussd').value || '*144#';
  const msg = '🧪 TEST Digitale Solution\n\nCeci est un test de configuration Orange Money.\nNuméro marchand : ' + num + '\nCode USSD : ' + ussd;
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank');
}
function testMoovWA(){
  const num = document.getElementById('cfg-moov-num').value.trim();
  if(!num){ showAdminToast('⚠️ Entrez d\'abord le numéro Moov Money','error'); return; }
  const ussd = document.getElementById('cfg-moov-ussd').value || '*555#';
  const msg = '🧪 TEST Digitale Solution\n\nCeci est un test de configuration Moov Money.\nNuméro marchand : ' + num + '\nCode USSD : ' + ussd;
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank');
}
function testSupportWA(){
  const num = document.getElementById('cfg-wa-support').value.trim();
  if(!num){ showAdminToast('⚠️ Entrez d\'abord le numéro WhatsApp support','error'); return; }
  const msg = '🧪 TEST Digitale Solution\n\nCeci est un test du numéro de support.\nSi vous recevez ce message, la configuration est correcte ✅';
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank');
}

function saveAdminConfig(){
  const cfg = ADB.getCfg();
  const orange_num  = document.getElementById('cfg-orange-num').value.trim();
  const moov_num    = document.getElementById('cfg-moov-num').value.trim();
  const wa_support  = document.getElementById('cfg-wa-support').value.trim();

  // Validation numéros
  if(orange_num && !/^\d{8,15}$/.test(orange_num)){
    showAdminToast('⚠️ Numéro Orange invalide (chiffres uniquement, 8-15 caractères)','error'); return;
  }
  if(moov_num && !/^\d{8,15}$/.test(moov_num)){
    showAdminToast('⚠️ Numéro Moov invalide (chiffres uniquement, 8-15 caractères)','error'); return;
  }
  if(wa_support && !/^\d{8,15}$/.test(wa_support)){
    showAdminToast('⚠️ Numéro WhatsApp invalide (chiffres uniquement, 8-15 caractères)','error'); return;
  }

  cfg.orange_num     = orange_num;
  cfg.orange_name    = document.getElementById('cfg-orange-name').value.trim() || 'DIGITALE SOLUTION';
  cfg.orange_ussd    = document.getElementById('cfg-orange-ussd').value.trim() || '*144#';
  cfg.orange_country = document.getElementById('cfg-orange-country').value;
  cfg.moov_num       = moov_num;
  cfg.moov_name      = document.getElementById('cfg-moov-name').value.trim() || 'DIGITALE SOLUTION';
  cfg.moov_ussd      = document.getElementById('cfg-moov-ussd').value.trim() || '*555#';
  cfg.moov_country   = document.getElementById('cfg-moov-country').value;
  cfg.wa_support     = wa_support;

  ADB.set('config', cfg);
  ADB.addActivity('config', 'Numéros de paiement configurés — Orange:' + (orange_num||'—') + ' Moov:' + (moov_num||'—'));

  // Feedback visuel
  const fb = document.getElementById('cfg-save-feedback');
  if(fb){ fb.style.display='inline'; setTimeout(()=>fb.style.display='none', 3000); }
  showAdminToast('✅ Numéros sauvegardés avec succès !', 'success');
  renderAdminConfig();
}

function saveAdminSecurity(){
  const cfg=ADB.getCfg();
  const newPwd=document.getElementById('cfg-adm-pwd').value;
  const newToken=document.getElementById('cfg-adm-token').value.trim();
  if(newPwd&&newPwd.length>=6) cfg.password_hash=DB._hash(newPwd);
  else if(newPwd) {showAdminToast('⚠️ Mot de passe min. 6 caractères','error');return;}
  if(newToken) cfg.token=newToken;
  ADB.set('config',cfg);
  document.getElementById('cfg-adm-pwd').value='';
  ADB.addActivity('security','Paramètres de sécurité admin mis à jour');
  showAdminToast('✅ Sécurité mise à jour. Nouveau token : ?admin='+cfg.token,'success');
}

// ---- ACTIVITY ----
function renderAdminActivity(){
  const log=ADB.getArr('activity');
  const icons={login:'🔐',logout:'⏻',extend:'✅',suspend:'🔒',reactivate:'🔓',validated:'💰',rejected:'❌',config:'⚙️',security:'🛡️'};
  const colors={login:'blue',logout:'orange',extend:'green',suspend:'red',reactivate:'green',validated:'green',rejected:'red',config:'blue',security:'orange'};
  document.getElementById('activity-log').innerHTML=log.length?log.map(item=>
    '<div class="activity-item"><div class="act-dot '+(colors[item.type]||'blue')+'"></div><div class="act-txt">'+(icons[item.type]||'·')+' '+item.txt+'</div><div class="act-time">'+new Date(item.ts).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+'</div></div>'
  ).join(''):'<p style="color:#374151;font-size:.82rem">Journal vide.</p>';
}
function clearActivity(){if(!confirm('Vider le journal ?'))return; ADB.set('activity',[]); renderAdminActivity();}

// ---- ADMIN TOAST (dark theme) ----
function showAdminToast(msg, type){
  showToast(msg, type); // reuse existing toast
}

