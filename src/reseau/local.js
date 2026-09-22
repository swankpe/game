// Transport de secours sans Supabase : BroadcastChannel relie les onglets
// d'un même navigateur. Sert au développement et aux tests ; ne traverse pas
// Internet. La présence est simulée par des battements périodiques.

export function transportLocal({ battement = 1000, delaiAbsence = 5000, delaiDecouverte = 300 } = {}) {
  return {
    mode: 'local',
    ouvrir(code, monId, rappels) {
      const canal = new BroadcastChannel(`salon:${code}`);
      const membres = new Map();
      let maMeta = null;
      let ferme = false;
      // Comme Supabase, qui envoie l'état complet avant toute mise à jour : on
      // ne publie pas une liste où l'on serait seul faute d'avoir entendu les
      // autres, sinon un cinquième joueur se croirait admis un instant.
      let decouvert = false;
      let decouverte = null;

      const publier = () => {
        if (!decouvert) return;
        const liste = [...membres].map(([id, { meta }]) => ({ id, meta }));
        rappels.surMembres(liste);
      };
      const annoncer = () => {
        if (maMeta && !ferme) canal.postMessage({ type: 'presence', id: monId, meta: maMeta });
      };

      canal.onmessage = ({ data }) => {
        if (ferme || !data || typeof data.id !== 'string' || data.id === monId) return;
        if (data.type === 'presence') {
          const nouveau = !membres.has(data.id);
          membres.set(data.id, { meta: data.meta, vu: Date.now() });
          // Répondre au nouveau venu pour qu'il nous voie sans attendre.
          if (nouveau) annoncer();
          publier();
        } else if (data.type === 'depart') {
          if (membres.delete(data.id)) publier();
        } else if (data.type === 'message') {
          rappels.surMessage(data.id, data.donnees);
        }
      };

      const minuterie = setInterval(() => {
        annoncer();
        const limite = Date.now() - delaiAbsence;
        let change = false;
        for (const [id, m] of membres) {
          if (id !== monId && m.vu < limite) {
            membres.delete(id);
            change = true;
          }
        }
        if (change) publier();
      }, battement);

      queueMicrotask(() => !ferme && rappels.surStatut?.('connecte'));

      return {
        suivre(meta) {
          maMeta = meta;
          membres.set(monId, { meta, vu: Infinity });
          annoncer();
          publier();
          decouverte ??= setTimeout(() => {
            decouvert = true;
            publier();
          }, delaiDecouverte);
        },
        envoyer(donnees) {
          if (!ferme) canal.postMessage({ type: 'message', id: monId, donnees });
        },
        fermer() {
          if (ferme) return;
          canal.postMessage({ type: 'depart', id: monId });
          ferme = true;
          clearInterval(minuterie);
          clearTimeout(decouverte);
          canal.close();
        },
      };
    },
  };
}
