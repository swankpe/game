// Panneau de création du perso, généré depuis le catalogue d'apparence :
// ajouter une option dans apparence.js suffit à la faire apparaître ici.

import { COULEURS, FORMES } from './apparence.js';

const RUBRIQUES = [
  { champ: 'tete', titre: 'Tête' },
  { champ: 'peau', titre: 'Peau' },
  { champ: 'yeux', titre: 'Yeux' },
  { champ: 'haut', titre: 'Haut' },
  { champ: 'salopette', titre: 'Salopette' },
  { champ: 'bottes', titre: 'Bottes' },
  { champ: 'chapeau', titre: 'Chapeau' },
  { champ: 'couleurChapeau', titre: 'Couleur du chapeau' },
];

export function construireOptions(conteneur, surChoix) {
  const boutons = new Map();
  const rubriques = new Map();
  for (const { champ, titre } of RUBRIQUES) {
    const bloc = document.createElement('fieldset');
    bloc.className = 'rubrique';
    const legende = document.createElement('legend');
    legende.textContent = titre;
    const choix = document.createElement('div');
    choix.className = 'choix';
    const couleurs = COULEURS[champ];
    const valeurs = couleurs ? couleurs.map((c) => ({ id: c, libelle: c })) : FORMES[champ];
    for (const { id, libelle } of valeurs) {
      const b = document.createElement('button');
      b.type = 'button';
      if (couleurs) {
        b.className = 'pastille';
        b.style.setProperty('--couleur', id);
        b.setAttribute('aria-label', `${titre} ${id}`);
      } else {
        b.className = 'forme';
        b.textContent = libelle;
      }
      b.addEventListener('click', () => surChoix(champ, id));
      choix.append(b);
      boutons.set(`${champ}:${id}`, b);
    }
    bloc.append(legende, choix);
    conteneur.append(bloc);
    rubriques.set(champ, bloc);
  }

  return {
    afficher(apparence) {
      for (const [cle, b] of boutons) {
        const [champ, id] = cle.split(':');
        b.setAttribute('aria-pressed', String(apparence[champ] === id));
      }
      rubriques.get('couleurChapeau').hidden = apparence.chapeau === 'aucun';
    },
  };
}
