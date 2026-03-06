// ============================================================
// DIGITALE SOLUTION — Supabase Client
// Script classique (pas de import/export ES module)
// Le SDK Supabase UMD est chargé avant ce fichier via CDN
// ============================================================

(function () {
  const SUPABASE_URL = "https://zjkivdgkdrjifciuogws.supabase.co"
const SUPABASE_KEY = "sb_publishable_BBO5Bmp2DkKjRZPayHbOZA_tS2owBZz";

  if (typeof supabase !== 'undefined' && supabase.createClient) {
    window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase client initialisé');
  } else {
    console.warn('⚠️ Supabase SDK non trouvé — vérifiez le CDN dans index.html');
  }
})();
