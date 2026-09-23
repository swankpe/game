// Les grenades en vol. Chaque navigateur simule toutes les grenades, les
// siennes comme celles des autres (même trajectoire, mêmes lois) : l'effet est
// identique partout. Seul le tireur calcule les dégâts de la sienne.

import * as THREE from 'three';
import { creerGrenade, libererModele } from './armes.js';
import { carte } from './monde.js';
import { HAUTEUR_MONSTRE } from './regles.js';

const GRAVITE = 9.8;
const DUREE_MAX = 5;
const RAYON_CONTACT = 0.5;
// Pas de simulation : à 24 m/s, une grenade avance de 0,5 m par pas. Sans ce
// découpage, une image lente la ferait passer à travers un zombie.
const PAS_MAX = 0.02;

export function creerProjectiles(scene) {
  const actifs = [];
  const avant = new THREE.Vector3();

  return {
    // locale : lancée par ce navigateur (c'est lui qui comptera les dégâts).
    lancer(origine, vitesse, locale) {
      const modele = creerGrenade();
      modele.position.copy(origine);
      scene.add(modele);
      actifs.push({ modele, v: vitesse.clone(), t: 0, locale });
    },

    // zombies : [{ x, y, z, l, h }] (pieds et taille, voir monstres.cibles()).
    // Renvoie les explosions de l'image.
    mettreAJour(dt, zombies) {
      const explosions = [];
      const pas = Math.ceil(dt / PAS_MAX);
      for (let i = actifs.length - 1; i >= 0; i--) {
        const g = actifs[i];
        const p = g.modele.position;
        let impact = false;
        for (let k = 0; k < pas && !impact; k++) {
          const h = dt / pas;
          g.v.y -= GRAVITE * h;
          p.addScaledVector(g.v, h);
          g.t += h;
          // Le sol, un mur, ou la surface de la mer arrêtent la grenade.
          impact = p.y <= carte().solGrenades(p.x, p.z) || g.t > DUREE_MAX;
          for (const z of zombies) {
            if (impact) break;
            impact = Math.hypot(z.x - p.x, z.z - p.z) < RAYON_CONTACT * (z.l ?? 1) && p.y > z.y && p.y < z.y + HAUTEUR_MONSTRE * (z.h ?? 1);
          }
        }
        g.modele.lookAt(avant.copy(p).add(g.v));
        if (impact) {
          explosions.push({ position: p.clone(), locale: g.locale });
          libererModele(g.modele);
          actifs.splice(i, 1);
        }
      }
      return explosions;
    },

    vider() {
      for (const g of actifs) libererModele(g.modele);
      actifs.length = 0;
    },
  };
}
