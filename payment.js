// ============================================================
// PAYMENT FLOW (Merchant side)
// ============================================================
let payState = {plan:null, operator:null, ref:null, transRef:null};

function openPaymentPage(){
  payState = {plan:null, operator:null, ref:null, transRef:null};
  showPage('page-payment');
  goToPayStep('plan');
  renderPayPlanGrid();
  renderPayOpGrid();
}

function renderPayPlanGrid(){
  const plans=ADB.getPlans();
  const m=Auth.current();
  document.getElementById('pay-plan-grid').innerHTML=
    '<div class="plan-opt '+(payState.plan==='mensuel'?'selected':'')+'" data-plan="mensuel" onclick="selectPlan(\'mensuel\')">'+
      '<div class="po-name">'+plans.mensuel.label+'</div>'+
      '<div class="po-price">'+fmtMoney(plans.mensuel.prix,'FCFA')+'</div>'+
      '<div class="po-dur">'+plans.mensuel.jours+' jours d\'accès</div>'+
    '</div>'+
    '<div class="plan-opt '+(payState.plan==='annuel'?'selected':'')+'" data-plan="annuel" onclick="selectPlan(\'annuel\')">'+(plans.annuel.badge?'<div class="po-save">'+plans.annuel.badge+'</div>':'')+
      '<div class="po-name">'+plans.annuel.label+'</div>'+
      '<div class="po-price">'+fmtMoney(plans.annuel.prix,'FCFA')+'</div>'+
      '<div class="po-dur">'+plans.annuel.jours+' jours d\'accès</div>'+
    '</div>';
  if(!payState.plan) selectPlan('mensuel');
}

function renderPayOpGrid(){
  const grid=document.getElementById('pay-op-grid');
  grid.innerHTML=
    '<div class="op-opt '+(payState.operator==='orange'?'selected':'')+'" data-op="orange">'+
      '<div class="op-opt-ico">🟠</div>'+
      '<div class="op-opt-info"><div class="op-opt-name">Orange Money</div><div class="op-opt-hint">*144# Burkina Faso</div></div>'+
    '</div>'+
    '<div class="op-opt '+(payState.operator==='moov'?'selected':'')+'" data-op="moov">'+
      '<div class="op-opt-ico">🔵</div>'+
      '<div class="op-opt-info"><div class="op-opt-name">Moov Money</div><div class="op-opt-hint">*555# Burkina Faso</div></div>'+
    '</div>';
  grid.querySelectorAll('.op-opt').forEach(el=>{
    el.onclick=()=>selectOperator(el.dataset.op);
  });
}

function selectPlan(p){
  payState.plan=p;
  document.querySelectorAll('.plan-opt').forEach(el=>el.classList.toggle('selected',el.dataset.plan===p));
}

function selectOperator(op){
  payState.operator=op;
  renderPayOpGrid();
}

function goToPayStep(step){
  ['plan','operator','instructions','submitted'].forEach(s=>{
    const el=document.getElementById('pay-step-'+s);
    if(el) el.style.display=s===step?'block':'none';
  });
  // Update progress
  const steps=['plan','operator','instructions','submitted'];
  const idx=steps.indexOf(step);
  ['pp1','pp2','pp3','pp4'].forEach((id,i)=>{
    const el=document.getElementById(id); if(!el) return;
    el.className='pp-step'+(i<idx?' done':i===idx?' active':'');
    el.querySelector('.pp-dot').textContent=i<idx?'✓':(i+1);
  });
  if(step==='instructions') buildPayInstructions();
}

function confirmOperatorAndContinue(){
  if(!payState.operator){showToast('⚠️ Veuillez sélectionner un opérateur','error');return;}
  goToPayStep('instructions');
}
function buildPayInstructions(){
  if(!payState.plan){goToPayStep('plan');return;}
  if(!payState.operator){goToPayStep('operator');return;}
  const cfg=ADB.getCfg(), plans=ADB.getPlans();
  const plan=plans[payState.plan];
  const isOrange=payState.operator==='orange';
  const num  = isOrange ? (cfg.orange_num  || '') : (cfg.moov_num  || '');
  const ussd = isOrange ? (cfg.orange_ussd || '*144#') : (cfg.moov_ussd || '*555#');
  const name = isOrange ? (cfg.orange_name || 'DIGITALE SOLUTION') : (cfg.moov_name || 'DIGITALE SOLUTION');
  // Alerte si numéro non configuré
  if(!num){
    showToast('⚠️ Numéro '+( isOrange?'Orange':'Moov')+' Money non configuré. Contactez l\'administrateur.','error');
  }
  // Generate unique reference
  const m=Auth.current();
  const suffix=(m?.nom_commerce||'DS').replace(/\s/g,'').slice(0,3).toUpperCase();
  payState.ref='DS-'+Date.now().toString(36).toUpperCase().slice(-6)+'-'+suffix;
  document.getElementById('pay-op-ico').textContent=isOrange?'🟠':'🔵';
  document.getElementById('ussd-code').textContent=ussd;
  document.getElementById('pay-dest-num').textContent=num||'⚠️ Non configuré — contactez le support';
  document.getElementById('pay-amount-display').textContent=fmtMoney(plan.prix,'FCFA');
  document.getElementById('pay-ref-code').textContent=payState.ref;
  document.getElementById('pay-trans-ref').value='';
  // Show beneficiary name under number
  const destEl=document.getElementById('pay-dest-num');
  if(destEl && num) destEl.title='Bénéficiaire : '+name;
}

function submitPayment(){
  const m=Auth.current(); if(!m) return;
  const transRef=document.getElementById('pay-trans-ref').value.trim();
  if(!transRef){showToast('⚠️ Entrez la référence de votre transaction','error');return;}
  const plans=ADB.getPlans(), plan=plans[payState.plan];
  payState.transRef=transRef;
  const req=ADB.addPayReq({
    merchant_id:m.id, nom_commerce:m.nom_commerce, ville:m.ville,
    plan:payState.plan, montant:plan.prix, operateur:payState.operator,
    reference:payState.ref, trans_ref:transRef
  });
  ADB.addActivity('payment_request','Demande paiement de '+m.nom_commerce+' — '+fmtMoney(plan.prix,'FCFA')+' via '+payState.operator);
  // Show submitted screen
  goToPayStep('submitted');
  document.getElementById('pay-submitted-ref').textContent=payState.ref;
  // WA support button
  const cfg=ADB.getCfg();
  const waBtn=document.getElementById('pay-wa-support-btn');
  if(cfg.wa_support){
    const msg='Bonjour, j\'ai effectué un paiement pour Digitale Solution.\nCommerce: '+m.nom_commerce+'\nRéférence: '+payState.ref+'\nTransaction: '+transRef+'\nMontant: '+fmtMoney(plan.prix,'FCFA')+'\nOpérateur: '+payState.operator;
    waBtn.onclick=()=>window.open('https://wa.me/'+cfg.wa_support+'?text='+encodeURIComponent(msg),'_blank');
    waBtn.style.display='flex';
  } else {
    waBtn.style.display='none';
  }
  updatePayBadge();
  showToast('✅ Demande envoyée ! Vérification sous 24h.','success');
}

