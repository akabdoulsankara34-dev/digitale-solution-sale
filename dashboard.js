// ---- INIT ----
// [replaced by admin version below]


// ---- DASHBOARD ----
function renderDashboard() {
  const m = Auth.current(); if (!m) return;
  const sales = DB.forM('sales', m.id), prods = DB.forM('products', m.id), clis = DB.forM('clients', m.id);
  const cfg = getConfig(), dev = cfg.devise || 'FCFA';
  const ca = sales.reduce((s, v) => s + (v.total || 0), 0);
  document.getElementById('k-ca').textContent = fmtMoney(ca, dev);
  document.getElementById('k-v').textContent = sales.length;
  document.getElementById('k-p').textContent = prods.length;
  document.getElementById('k-c').textContent = clis.length;
  document.getElementById('w-msg').textContent = cfg.message_accueil || 'Bienvenue, ' + m.proprietaire + ' !';
  document.getElementById('w-date').textContent = new Date().toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const recent = [...sales].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  document.getElementById('d-sales').innerHTML = recent.length ? recent.map(s =>
    '<div class="ri"><div><div class="ri-name">' + s.client_nom + '</div><div class="ri-date">' + new Date(s.created_at).toLocaleDateString('fr-FR') + '</div></div><div class="ri-amt">' + fmtMoney(s.total, dev) + '</div></div>'
  ).join('') : '<p class="empty">Aucune vente.</p>';
  const ps = {};
  sales.forEach(s => (s.items || []).forEach(i => { if (!ps[i.nom]) ps[i.nom] = {t:0,q:0}; ps[i.nom].t += i.prix * i.qty; ps[i.nom].q += i.qty; }));
  const top = Object.entries(ps).sort((a, b) => b[1].t - a[1].t).slice(0, 5);
  document.getElementById('d-top').innerHTML = top.length ? top.map(([n, d]) =>
    '<div class="ri"><div><div class="ri-name">' + n + '</div><div class="ri-date">' + d.q + ' vendu(s)</div></div><div class="ri-amt">' + fmtMoney(d.t, dev) + '</div></div>'
  ).join('') : '<p class="empty">Aucun produit vendu.</p>';
}

