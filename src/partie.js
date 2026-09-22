// Entrée dans un salon : on se déclare, on attend de se voir dans la liste,
// puis on est admis ou refusé selon les règles de salon.js. Indépendant du
// transport (Supabase ou local) et de Three.js, donc testable dans Node.

import { membreDepuisMeta, repartir } from './salon.js';

export function ouvrirPartie({ transport, code, monId, profil, rappels, maintenant = Date.now }) {
  let meta = { nom: profil.nom, apparence: profil.apparence, arrivee: maintenant(), installe: false };
  let statut = 'attente';

  const salon = transport.ouvrir(code, monId, {
    surMembres(liste) {
      if (statut === 'refuse') return;
      const membres = liste.map(({ id, meta: m }) => membreDepuisMeta(id, m));
      const r = repartir(membres, monId);
      if (r.statut === 'refuse') {
        statut = 'refuse';
        salon.fermer();
        rappels.surRefus?.();
        return;
      }
      if (r.statut === 'admis' && statut === 'attente') {
        statut = 'admis';
        meta = { ...meta, installe: true };
        // Admission annoncée avant de redéclarer la présence : cette
        // redéclaration peut rappeler surMembres aussitôt (transport local).
        rappels.surAdmission?.();
        salon.suivre(meta);
      }
      if (statut === 'admis') rappels.surMembres?.(r.admis);
    },
    surMessage(de, donnees) {
      if (statut === 'admis') rappels.surMessage?.(de, donnees);
    },
    surStatut(s) {
      rappels.surStatut?.(s);
    },
  });

  salon.suivre(meta);

  return {
    get statut() {
      return statut;
    },
    envoyer(donnees) {
      if (statut === 'admis') salon.envoyer(donnees);
    },
    changerProfil(p) {
      meta = { ...meta, nom: p.nom, apparence: p.apparence };
      if (statut !== 'refuse') salon.suivre(meta);
    },
    quitter() {
      salon.fermer();
    },
  };
}
