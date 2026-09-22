// Transport en ligne : un canal Supabase Realtime par salon. La présence dit
// qui est là (et avec quel perso), le broadcast porte les positions. Aucune
// table, aucune donnée enregistrée : rien ne survit au départ des joueurs.

import { createClient } from '@supabase/supabase-js';

export function transportSupabase(url, cle) {
  // worker : le battement de cœur tourne dans un Web Worker, sinon le
  // navigateur le ralentit quand l'onglet passe en arrière-plan et la
  // connexion tombe.
  const client = createClient(url, cle, { realtime: { worker: true } });

  return {
    mode: 'supabase',
    ouvrir(code, monId, rappels) {
      const canal = client.channel(`salon:${code}`, {
        config: { presence: { key: monId }, broadcast: { self: false } },
      });
      let maMeta = null;
      let abonne = false;
      let ferme = false;

      canal
        .on('presence', { event: 'sync' }, () => {
          const etat = canal.presenceState();
          const liste = Object.entries(etat).map(([id, metas]) => ({ id, meta: metas.at(-1) }));
          rappels.surMembres(liste);
        })
        .on('broadcast', { event: 'jeu' }, ({ payload }) => {
          if (payload && typeof payload.de === 'string') rappels.surMessage(payload.de, payload.donnees);
        })
        .subscribe((statut) => {
          if (ferme) return;
          abonne = statut === 'SUBSCRIBED';
          if (abonne) {
            // Après une reconnexion, la présence doit être redéclarée.
            if (maMeta) canal.track(maMeta);
            rappels.surStatut?.('connecte');
          } else if (statut === 'CLOSED') {
            rappels.surStatut?.('ferme');
          } else {
            rappels.surStatut?.('erreur');
          }
        });

      return {
        suivre(meta) {
          maMeta = meta;
          if (abonne) canal.track(meta);
        },
        envoyer(donnees) {
          if (abonne) canal.send({ type: 'broadcast', event: 'jeu', payload: { de: monId, donnees } });
        },
        fermer() {
          if (ferme) return;
          ferme = true;
          client.removeChannel(canal);
        },
      };
    },
  };
}
