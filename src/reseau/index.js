import { transportLocal } from './local.js';

// Sans variables Supabase, le jeu reste utilisable entre onglets du même
// navigateur : pratique pour développer, inutile pour jouer à distance.
export async function choisirTransport() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const cle = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && cle) {
    const { transportSupabase } = await import('./supabase.js');
    return transportSupabase(url, cle);
  }
  return transportLocal();
}
