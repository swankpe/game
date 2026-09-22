// Joueur local : clavier et déplacements. Les touches sont lues par position
// physique (event.code) : ZQSD sur un clavier AZERTY, WASD en QWERTY.

import { APPARITION, estPraticable, hauteurSol, resoudreCollisions } from './monde.js';

const MARCHE = 4.2;
const COURSE = 7.5;
const SAUT = 5.4;
const GRAVITE = 15;

export function creerClavier() {
  const enfoncees = new Set();
  // Appuis pas encore traités (E pour porter, F pour l'Illumination…).
  const appuis = new Set();
  const enSaisie = (e) => e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]');
  addEventListener('keydown', (e) => {
    if (enSaisie(e)) return;
    enfoncees.add(e.code);
    if (!e.repeat) appuis.add(e.code);
    // Espace ne doit ni faire défiler la page ni recliquer le dernier bouton.
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => enfoncees.delete(e.code));
  addEventListener('blur', () => {
    enfoncees.clear();
    appuis.clear();
  });
  const une = (...codes) => codes.some((c) => enfoncees.has(c));
  return {
    // Vrai une seule fois par appui.
    consommer(code) {
      return appuis.delete(code);
    },
    oublier() {
      appuis.clear();
    },
    commandes() {
      return {
        avant: Number(une('KeyW', 'ArrowUp')) - Number(une('KeyS', 'ArrowDown')),
        lateral: Number(une('KeyD', 'ArrowRight')) - Number(une('KeyA', 'ArrowLeft')),
        course: une('ShiftLeft', 'ShiftRight'),
        saut: une('Space'),
      };
    },
  };
}

function angleVers(depart, arrivee, t) {
  const d = Math.atan2(Math.sin(arrivee - depart), Math.cos(arrivee - depart));
  return depart + d * t;
}

export function creerJoueur() {
  const decalage = (Math.random() - 0.5) * 6;
  const etat = {
    x: APPARITION.x,
    z: APPARITION.z + decalage,
    y: hauteurSol(APPARITION.x, APPARITION.z + decalage),
    vx: 0, vz: 0, vy: 0,
    auSol: true,
    orientation: APPARITION.orientation,
    vitesse: 0,
  };

  function deplacer(nx, nz) {
    const libre = resoudreCollisions(nx, nz);
    // Glisser le long du rivage : on garde l'axe qui reste praticable.
    if (estPraticable(libre.x, libre.z)) return libre;
    if (estPraticable(libre.x, etat.z)) return { x: libre.x, z: etat.z };
    if (estPraticable(etat.x, libre.z)) return { x: etat.x, z: libre.z };
    return { x: etat.x, z: etat.z };
  }

  return {
    etat,
    teleporter(x, z, orientation = etat.orientation) {
      etat.x = x;
      etat.z = z;
      etat.y = hauteurSol(x, z);
      etat.vx = etat.vz = etat.vy = 0;
      etat.orientation = orientation;
    },
    // lacet : angle horizontal de la caméra, pour avancer « vers l'écran ».
    // orientation : impose le sens du corps (vue à la première personne) ;
    // facteur : vitesse réduite, par exemple en portant le poteau.
    mettreAJour(dt, commandes, lacet, { orientation = null, facteur = 1 } = {}) {
      const { avant, lateral, course, saut } = commandes;
      const fx = -Math.sin(lacet), fz = -Math.cos(lacet);
      const rx = Math.cos(lacet), rz = -Math.sin(lacet);
      let dx = fx * avant + rx * lateral, dz = fz * avant + rz * lateral;
      const norme = Math.hypot(dx, dz);
      const voulue = norme > 0 ? (course ? COURSE : MARCHE) * facteur : 0;
      if (norme > 0) {
        dx /= norme;
        dz /= norme;
      }
      const reactivite = 1 - Math.exp(-dt * (etat.auSol ? 12 : 3));
      etat.vx += (dx * voulue - etat.vx) * reactivite;
      etat.vz += (dz * voulue - etat.vz) * reactivite;

      const suivant = deplacer(etat.x + etat.vx * dt, etat.z + etat.vz * dt);
      const vitesseReelle = dt > 0 ? Math.hypot(suivant.x - etat.x, suivant.z - etat.z) / dt : 0;
      etat.x = suivant.x;
      etat.z = suivant.z;
      etat.vitesse = vitesseReelle;
      if (orientation !== null) etat.orientation = orientation;
      else if (norme > 0) etat.orientation = angleVers(etat.orientation, Math.atan2(dx, dz), 1 - Math.exp(-dt * 12));

      const sol = hauteurSol(etat.x, etat.z);
      if (etat.auSol && saut) {
        etat.vy = SAUT;
        etat.auSol = false;
      }
      etat.vy -= GRAVITE * dt;
      etat.y += etat.vy * dt;
      // En descente, on reste collé au sol au lieu de rebondir sur chaque pente.
      if (etat.y <= sol || (etat.auSol && etat.vy <= 0 && etat.y - sol < 0.3)) {
        etat.y = sol;
        etat.vy = 0;
        etat.auSol = true;
      } else {
        etat.auSol = false;
      }
    },
  };
}
