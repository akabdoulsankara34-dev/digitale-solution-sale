// ---- VENTES ----
function renderSales() {
  const m = Auth.current(); if (!m) return;
  const sales = DB.forM('sales', m.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const q = (document.getElementById('sale-srch')?.value || '').toLowerCase();
  const f = sales.filter(s => s.client_nom.toLowerCase().includes(q) || (s.items || []).some(i => i.nom.toLowerCase().includes(q)));
  const dev = getConfig().devise || 'FCFA', tot = f.reduce((s, v) => s + v.total, 0);
  document.getElementById('sale-total').textContent = 'Total : ' + fmtMoney(tot, dev);
  document.getElementById('sale-tbody').innerHTML = f.length ? f.map((s, i) =>
    '<tr><td><span style="color:var(--text-dim);font-size:.75rem">' + (f.length - i) + '</span></td>' +
    '<td><strong>' + s.client_nom + '</strong></td>' +
    '<td>' + (s.client_wa ? '<a href="https://wa.me/' + s.client_wa + '" target="_blank" style="color:#25D366;font-size:.82rem">+' + s.client_wa + '</a>' : '<span style="color:var(--text-dim)">—</span>') + '</td>' +
    '<td><strong style="color:var(--accent)">' + fmtMoney(s.total, dev) + '</strong></td>' +
    '<td style="font-size:.8rem;color:var(--text-muted)">' + new Date(s.created_at).toLocaleDateString('fr-FR') + '</td>' +
    '<td><div class="tacts"><button class="tbtn" data-inv-sid="' + s.id + '">🧾 Facture</button>' +
    (s.client_wa ? '<button class="tbtn wa" data-wa-sid="' + s.id + '">💬 WA</button>' : '') +
    '</div></td></tr>'
  ).join('') : '<tr><td colspan="6" class="empty">Aucune vente.</td></tr>';
  document.querySelectorAll('[data-inv-sid]').forEach(b => b.onclick = () => viewSaleInvoice(b.dataset.invSid));
  document.querySelectorAll('[data-wa-sid]').forEach(b => {
    b.onclick = () => {
      const s = DB.forM('sales', m.id).find(x => x.id === b.dataset.waSid);
      if (!s) return;
      currentSaleWA = s.client_wa || ''; currentSaleName = s.client_nom;
      window._lastSale = {sale:s, m, cfg:getConfig()};
      sendWA();
    };
  });
}

