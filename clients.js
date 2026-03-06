// ---- CLIENTS ----
let editCliId = null;
function openClientModal(c) {
  editCliId = c ? c.id : null;
  document.getElementById('mo-cli-title').textContent = c ? 'Modifier' : 'Nouveau client';
  document.getElementById('c-nom').value = c ? c.nom : '';
  document.getElementById('c-wa').value = c ? (c.whatsapp || '') : '';
  document.getElementById('mo-cli').classList.remove('hidden');
}
function saveClient() {
  const m = Auth.current(); if (!m) return;
  const nom = document.getElementById('c-nom').value.trim();
  if (!nom) { showToast('⚠️ Nom requis', 'error'); return; }
  const rec = {nom, whatsapp: document.getElementById('c-wa').value.trim().replace(/\D/g,'')};
  editCliId ? DB.update('clients', editCliId, rec, m.id) : DB.insert('clients', rec, m.id);
  showToast('✅ Client ' + (editCliId ? 'mis à jour' : 'enregistré'), 'success');
  closeMo('mo-cli'); renderClients(); fillCliSelect();
}
function deleteClient(id) {
  const m = Auth.current(); if (!confirm('Supprimer ce client ?')) return;
  DB.delete('clients', id, m.id); showToast('🗑️ Supprimé', 'success'); renderClients();
}
function renderClients() {
  const m = Auth.current(); if (!m) return;
  const clis = DB.forM('clients', m.id), q = (document.getElementById('cli-srch')?.value || '').toLowerCase();
  const f = clis.filter(c => c.nom.toLowerCase().includes(q) || (c.whatsapp || '').includes(q));
  const sales = DB.forM('sales', m.id), dev = getConfig().devise || 'FCFA';
  document.getElementById('cli-tbody').innerHTML = f.length ? f.map(c => {
    const cs = sales.filter(s => s.client_id === c.id), tot = cs.reduce((s, v) => s + v.total, 0);
    const waBtn = c.whatsapp ? '<button class="tbtn wa" data-wa-cli="' + c.id + '">💬 WA</button>' : '<span style="color:var(--text-dim);font-size:.75rem">—</span>';
    return '<tr><td><strong>' + c.nom + '</strong></td><td>' + (c.whatsapp ? '<a href="https://wa.me/' + c.whatsapp + '" target="_blank" style="color:#25D366">+' + c.whatsapp + '</a>' : '—') + '</td><td>' + cs.length + '</td><td><strong style="color:var(--accent)">' + fmtMoney(tot, dev) + '</strong></td><td><div class="tacts">' + waBtn + '<button class="tbtn" data-edit-cid="' + c.id + '">✏️</button><button class="tbtn d" data-del-cid="' + c.id + '">🗑️</button></div></td></tr>';
  }).join('') : '<tr><td colspan="5" class="empty">Aucun client trouvé.</td></tr>';
  document.querySelectorAll('[data-wa-cli]').forEach(b => b.onclick = () => sendWAMarketing(b.dataset.waCli));
  document.querySelectorAll('[data-edit-cid]').forEach(b => {
    b.onclick = () => { const c = DB.forM('clients', m.id).find(x => x.id === b.dataset.editCid); if (c) openClientModal(c); };
  });
  document.querySelectorAll('[data-del-cid]').forEach(b => b.onclick = () => deleteClient(b.dataset.delCid));
}

