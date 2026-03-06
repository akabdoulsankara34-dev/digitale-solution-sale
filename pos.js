// ---- POS ----
let cart = [];
let currentSaleWA = '';
let currentSaleName = '';
let currentPrintFmt = 'a4';

function renderPOS() {
  const m = Auth.current(); if (!m) return;
  const prods = DB.forM('products', m.id), q = (document.getElementById('pos-srch')?.value || '').toLowerCase();
  const f = prods.filter(p => p.nom.toLowerCase().includes(q));
  const dev = getConfig().devise || 'FCFA';
  const catEmos = {boisson:'🥤',plat:'🍽️',dessert:'🍰',pain:'🥖',viande:'🥩',poisson:'🐟',légume:'🥦',électronique:'📱',vêtement:'👕',médicament:'💊',chambre:'🛏️'};
  const grid = document.getElementById('pos-grid');
  grid.innerHTML = f.length ? f.map(p => {
    const oos = p.stock !== null && p.stock === 0;
    const cat = (p.categorie || '').toLowerCase();
    const emo = Object.entries(catEmos).find(([k]) => cat.includes(k))?.[1] || '📦';
    return '<div class="ppc' + (oos ? ' oos' : '') + '" data-pid="' + p.id + '"><span class="ppc-emo">' + emo + '</span><div class="ppc-name">' + p.nom + '</div><div class="ppc-price">' + fmtMoney(p.prix, dev) + '</div>' + (p.stock !== null ? '<div class="ppc-stk">Stock: ' + p.stock + '</div>' : '') + '</div>';
  }).join('') : '<p class="empty">Aucun produit. Ajoutez-en dans Produits.</p>';
  grid.onclick = e => { const c = e.target.closest('.ppc'); if (c && !c.classList.contains('oos')) addToCart(c.dataset.pid); };
  // Fill client select
  fillCliSelect();
}

function fillCliSelect() {
  const m = Auth.current(); if (!m) return;
  const clis = DB.forM('clients', m.id);
  const sel = document.getElementById('cart-cli-sel');
  if (!sel) return;
  const cv = sel.value;
  sel.innerHTML = '<option value="">+ Nouveau client / Saisir manuellement</option>' +
    clis.map(c => '<option value="' + c.id + '">' + c.nom + (c.whatsapp ? ' 📲' : '') + '</option>').join('');
  sel.value = cv;
}

function onCliSelect() {
  const m = Auth.current(); if (!m) return;
  const sel = document.getElementById('cart-cli-sel');
  const cid = sel.value;
  if (!cid) {
    document.getElementById('cart-cli-nom').value = '';
    document.getElementById('cart-cli-wa').value = '';
    return;
  }
  const cli = DB.forM('clients', m.id).find(c => c.id === cid);
  if (cli) {
    document.getElementById('cart-cli-nom').value = cli.nom;
    document.getElementById('cart-cli-wa').value = cli.whatsapp || '';
  }
}

function addToCart(pid) {
  const m = Auth.current(), ps = DB.forM('products', m.id), p = ps.find(x => x.id === pid); if (!p) return;
  const ex = cart.find(i => i.pid === pid);
  ex ? ex.qty++ : cart.push({pid, nom:p.nom, prix:p.prix, qty:1});
  renderCart();
}
function updCartQty(pid, d) { const i = cart.find(x => x.pid === pid); if (!i) return; i.qty = Math.max(0, i.qty + d); if (i.qty === 0) cart = cart.filter(x => x.pid !== pid); renderCart(); }
function rmFromCart(pid) { cart = cart.filter(i => i.pid !== pid); renderCart(); }
function clearCart() { cart = []; renderCart(); }
function cartTotal() { return cart.reduce((s, i) => s + i.prix * i.qty, 0); }
function renderCart() {
  const cfg = getConfig(), dev = cfg.devise || 'FCFA', tot = cartTotal();
  document.getElementById('cart-cnt').textContent = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cart-sub').textContent = fmtMoney(tot, dev);
  document.getElementById('cart-total').textContent = fmtMoney(tot, dev);
  const list = document.getElementById('cart-items');
  if (!cart.length) { list.innerHTML = '<p class="empty">Panier vide</p>'; return; }
  list.innerHTML = cart.map(i =>
    '<div class="ci"><span class="ci-name">' + i.nom + '</span><div class="ci-ctrls"><button class="ci-qbtn" data-qpid="' + i.pid + '" data-qd="-1">−</button><span class="ci-q">' + i.qty + '</span><button class="ci-qbtn" data-qpid="' + i.pid + '" data-qd="1">+</button></div><span class="ci-price">' + fmtMoney(i.prix * i.qty, dev) + '</span><button class="ci-rm" data-rmpid="' + i.pid + '">✕</button></div>'
  ).join('');
  list.querySelectorAll('[data-qpid]').forEach(b => b.onclick = () => updCartQty(b.dataset.qpid, parseInt(b.dataset.qd)));
  list.querySelectorAll('[data-rmpid]').forEach(b => b.onclick = () => rmFromCart(b.dataset.rmpid));
}


// ---- CHECKOUT ----
function processCheckout() {
  const m = Auth.current(); if (!m) return;
  const licSt = getLicStatus(m).st;
  if (licSt === 'expired' || licSt === 'suspended') { 
    showToast('⚠️ Licence expirée. Renouvelez votre abonnement.', 'error'); 
    openPaymentPage();
    return; 
  }
  if (!cart.length) { showToast('⚠️ Panier vide', 'error'); return; }
  const cfg = getConfig(), dev = cfg.devise || 'FCFA';
  const cliSel = document.getElementById('cart-cli-sel').value;
  let cliNom = document.getElementById('cart-cli-nom').value.trim() || 'Client';
  let cliWA = document.getElementById('cart-cli-wa').value.trim().replace(/\D/g, '');
  // Save/update client if has name
  let cliId = cliSel;
  if (cliNom && cliNom !== 'Client') {
    if (!cliSel) {
      // Create new client
      const newCli = DB.insert('clients', {nom:cliNom, whatsapp:cliWA}, m.id);
      cliId = newCli.id;
    } else {
      // Update existing
      DB.update('clients', cliSel, {nom:cliNom, whatsapp:cliWA}, m.id);
    }
  }
  const tot = cartTotal();
  const sale = DB.insert('sales', {client_id:cliId, client_nom:cliNom, client_wa:cliWA, items:JSON.parse(JSON.stringify(cart)), total:tot, devise:dev}, m.id);
  // Update stocks
  const allP = DB.get('products');
  cart.forEach(ci => { const idx = allP.findIndex(p => p.id === ci.pid && p.merchant_id === m.id); if (idx !== -1 && allP[idx].stock !== null) allP[idx].stock = Math.max(0, allP[idx].stock - ci.qty); });
  DB.set('products', allP);
  // Store for WA button
  currentSaleWA = cliWA;
  currentSaleName = cliNom;
  // Show invoice
  setPrintFmt('a4');
  showInvoice(sale, m, cfg);
  // Marketing toast
  showToast('🎉 ' + (cfg.message_accueil || 'Merci pour votre achat chez ' + m.nom_commerce + ' !'), 'success');
  clearCart();
  // Reset client fields
  document.getElementById('cart-cli-sel').value = '';
  document.getElementById('cart-cli-nom').value = '';
  document.getElementById('cart-cli-wa').value = '';
  renderPOS();
  renderDashboard();
}


// ---- PRINT FORMAT ----
function setPrintFmt(fmt) {
  currentPrintFmt = fmt;
  document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('fmt-' + fmt)?.classList.add('active');
  // Rebuild invoice content if already open
  const lastSale = window._lastSale;
  if (lastSale) showInvoice(lastSale.sale, lastSale.m, lastSale.cfg);
}


// ---- INVOICE ----
function showInvoice(sale, m, cfg) {
  window._lastSale = {sale, m, cfg};
  const dev = cfg?.devise || sale.devise || 'FCFA';
  const num = 'DS-' + sale.id.substr(-8).toUpperCase();
  const ds = new Date(sale.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'});
  const waNum = sale.client_wa || currentSaleWA || '';
  const waBtn = document.getElementById('wa-send-btn');
  if (waBtn) waBtn.style.display = waNum ? 'inline-flex' : 'none';
  currentSaleWA = waNum;
  currentSaleName = sale.client_nom;
  const fmt = currentPrintFmt;
  let html = '';
  if (fmt === 'a4') {
    html = buildA4Invoice(sale, m, cfg, num, ds, dev, waNum);
  } else {
    html = buildThermalInvoice(sale, m, cfg, num, ds, dev, waNum, fmt);
  }
  document.getElementById('inv-content').innerHTML = html;
  document.getElementById('mo-inv').classList.remove('hidden');
}

function buildA4Invoice(sale, m, cfg, num, ds, dev, waNum) {
  return '<div class="inv-print-wrap"><div class="inv">' +
    '<div class="inv-hdr"><div class="inv-brand"><h2>🌐 ' + m.nom_commerce + '</h2><p>' + m.proprietaire + ' · ' + m.ville + '</p><p>📞 ' + m.telephone + '</p></div>' +
    '<div class="inv-meta"><strong>FACTURE ' + num + '</strong><p>Date : ' + ds + '</p><p style="margin-top:8px;padding:6px 10px;background:#fff3e0;border-radius:6px;color:#E8730C;font-weight:700">Digitale Solution</p></div></div>' +
    '<div class="inv-info"><div><label>Client</label><span>' + sale.client_nom + '</span>' + (waNum ? '<div class="inv-wa">📲 +' + waNum + '</div>' : '') + '</div><div><label>Référence</label><span>' + num + '</span></div></div>' +
    '<table class="inv-tbl"><thead><tr><th>Description</th><th style="text-align:center">Qté</th><th>P.U.</th><th style="text-align:right">Total</th></tr></thead><tbody>' +
    (sale.items || []).map(i => '<tr><td>' + i.nom + '</td><td style="text-align:center">' + i.qty + '</td><td>' + fmtMoney(i.prix, dev) + '</td><td style="text-align:right"><strong>' + fmtMoney(i.prix * i.qty, dev) + '</strong></td></tr>').join('') +
    '</tbody></table><div class="inv-total"><span>TOTAL À PAYER</span><span>' + fmtMoney(sale.total, dev) + '</span></div>' +
    '<div class="inv-foot">Merci pour votre confiance · ' + m.nom_commerce + ' · Digitale Solution</div></div></div>';
}

function buildThermalInvoice(sale, m, cfg, num, ds, dev, waNum, fmt) {
  const w = fmt === '58' ? '58mm' : '80mm';
  const items = (sale.items || []).map(i =>
    '<div class="therm-row"><span>' + i.nom + ' x' + i.qty + '</span><span>' + fmtMoney(i.prix * i.qty, dev) + '</span></div>'
  ).join('');
  return '<div class="therm-wrap" style="width:' + w + '">' +
    '<div class="therm-center therm-bold" style="font-size:1.1em">🌐 ' + m.nom_commerce + '</div>' +
    '<div class="therm-center therm-sm">' + m.ville + ' · ' + m.telephone + '</div>' +
    '<hr class="therm-sep"/>' +
    '<div class="therm-center therm-sm">FACTURE ' + num + '</div>' +
    '<div class="therm-center therm-sm">' + ds + '</div>' +
    '<hr class="therm-sep"/>' +
    '<div class="therm-sm">Client : ' + sale.client_nom + '</div>' +
    (waNum ? '<div class="therm-sm">WA : +' + waNum + '</div>' : '') +
    '<hr class="therm-sep"/>' +
    items +
    '<hr class="therm-sep"/>' +
    '<div class="therm-row therm-bold"><span>TOTAL</span><span>' + fmtMoney(sale.total, dev) + '</span></div>' +
    '<hr class="therm-sep"/>' +
    '<div class="therm-center therm-sm">Merci pour votre achat !</div>' +
    '<div class="therm-center therm-sm">Digitale Solution</div>' +
    '</div>';
}

function doPrint() {
  const fmt = currentPrintFmt;
  document.body.className = 'print-' + fmt;
  window.print();
  setTimeout(() => { document.body.className = ''; }, 500);
}

function viewSaleInvoice(sid) {
  const m = Auth.current(), s = DB.forM('sales', m.id).find(x => x.id === sid); if (!s) return;
  currentSaleWA = s.client_wa || '';
  currentSaleName = s.client_nom;
  setPrintFmt('a4');
  showInvoice(s, m, getConfig());
}


// ---- WHATSAPP ----
function sendWA() {
  const m = Auth.current(); if (!m) return;
  const cfg = getConfig(), dev = cfg.devise || 'FCFA';
  if (!currentSaleWA) { showToast('⚠️ Pas de numéro WhatsApp pour ce client', 'error'); return; }
  const sale = window._lastSale?.sale;
  let msg = cfg.wa_message || 'Merci {nom} pour votre achat de {total} chez {commerce} 🙏 Revenez bientôt !';
  msg = msg.replace('{nom}', currentSaleName || 'cher client')
            .replace('{total}', sale ? fmtMoney(sale.total, dev) : '')
            .replace('{commerce}', m.nom_commerce);
  const waUrl = 'https://wa.me/' + currentSaleWA + '?text=' + encodeURIComponent(msg);
  window.open(waUrl, '_blank');
  showToast('📲 WhatsApp ouvert pour ' + currentSaleName, 'wa');
}

function sendWAMarketing(cliId) {
  const m = Auth.current(); if (!m) return;
  const cfg = getConfig(), dev = cfg.devise || 'FCFA';
  const cli = DB.forM('clients', m.id).find(c => c.id === cliId);
  if (!cli || !cli.whatsapp) { showToast('⚠️ Pas de WhatsApp pour ce client', 'error'); return; }
  let msg = cfg.wa_message || 'Bonjour {nom}, nous avons des offres spéciales chez {commerce} ! Revenez nous voir 😊';
  msg = msg.replace('{nom}', cli.nom).replace('{total}', '').replace('{commerce}', m.nom_commerce);
  window.open('https://wa.me/' + cli.whatsapp + '?text=' + encodeURIComponent(msg), '_blank');
  showToast('📲 Message marketing envoyé à ' + cli.nom, 'wa');
}

