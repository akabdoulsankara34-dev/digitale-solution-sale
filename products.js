// ---- PRODUITS ----
let editProdId = null;
function openProductModal(p) {
  editProdId = p ? p.id : null;
  document.getElementById('mo-prod-title').textContent = p ? 'Modifier' : 'Nouveau produit';
  document.getElementById('p-nom').value = p ? p.nom : '';
  document.getElementById('p-prix').value = p ? p.prix : '';
  document.getElementById('p-stk').value = (p && p.stock != null) ? p.stock : '';
  document.getElementById('p-cat').value = p ? (p.categorie || '') : '';
  document.getElementById('mo-prod').classList.remove('hidden');
}
function saveProduct() {
  const m = Auth.current(); if (!m) return;
  const nom = document.getElementById('p-nom').value.trim(), prix = parseFloat(document.getElementById('p-prix').value);
  if (!nom || isNaN(prix)) { showToast('⚠️ Nom et prix requis', 'error'); return; }
  const stkVal = document.getElementById('p-stk').value;
  const rec = {nom, prix, stock: stkVal === '' ? null : parseInt(stkVal), categorie: document.getElementById('p-cat').value.trim()};
  editProdId ? DB.update('products', editProdId, rec, m.id) : DB.insert('products', rec, m.id);
  showToast('✅ Produit ' + (editProdId ? 'mis à jour' : 'ajouté'), 'success');
  closeMo('mo-prod'); renderProducts(); renderPOS();
}
function deleteProduct(id) {
  const m = Auth.current(); if (!confirm('Supprimer ce produit ?')) return;
  DB.delete('products', id, m.id); showToast('🗑️ Supprimé', 'success'); renderProducts(); renderPOS();
}
function renderProducts() {
  const m = Auth.current(); if (!m) return;
  const prods = DB.forM('products', m.id), q = (document.getElementById('prod-srch')?.value || '').toLowerCase();
  const f = prods.filter(p => p.nom.toLowerCase().includes(q));
  const dev = getConfig().devise || 'FCFA';
  document.getElementById('prod-tbody').innerHTML = f.length ? f.map(p => {
    const sb = p.stock === null ? '<span class="sbdg s-ok">∞</span>' : p.stock === 0 ? '<span class="sbdg s-zero">Rupture</span>' : p.stock <= 5 ? '<span class="sbdg s-low">' + p.stock + '</span>' : '<span class="sbdg s-ok">' + p.stock + '</span>';
    return '<tr><td><strong>' + p.nom + '</strong>' + (p.categorie ? '<br/><small style="color:var(--text-dim)">' + p.categorie + '</small>' : '') + '</td><td><strong style="color:var(--accent)">' + fmtMoney(p.prix, dev) + '</strong></td><td>' + sb + '</td><td><div class="tacts"><button class="tbtn" data-edit-pid="' + p.id + '">✏️ Modifier</button><button class="tbtn d" data-del-pid="' + p.id + '">🗑️</button></div></td></tr>';
  }).join('') : '<tr><td colspan="4" class="empty">Aucun produit trouvé.</td></tr>';
  // Bind events
  document.querySelectorAll('[data-edit-pid]').forEach(btn => {
    btn.onclick = () => { const p = DB.forM('products', m.id).find(x => x.id === btn.dataset.editPid); if (p) openProductModal(p); };
  });
  document.querySelectorAll('[data-del-pid]').forEach(btn => {
    btn.onclick = () => deleteProduct(btn.dataset.delPid);
  });
}

