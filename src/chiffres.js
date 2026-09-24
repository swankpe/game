// Les dégâts qui s'affichent au-dessus d'un zombie touché : un chiffre qui
// saute, monte et s'efface. Doré pour un tir dans la tête, orange pour une
// grenade. Des étiquettes CSS (calque de main.js), recyclées.

import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const DUREE = 0.9;
const MAX = 40;

export function creerChiffres(scene) {
  const libres = [];
  const actifs = [];

  function prendre() {
    const recycle = libres.pop() ?? actifs.shift();
    if (recycle) return recycle;
    const element = document.createElement('div');
    element.className = 'chiffre-degats';
    const objet = new CSS2DObject(element);
    scene.add(objet);
    return { objet, element, age: 0, vitesse: 0, derive: 0 };
  }

  return {
    // position : Vector3 (le point touché) ; genre : 'corps' | 'tete' | 'grenade'.
    montrer(position, valeur, genre = 'corps') {
      if (!(valeur > 0)) return;
      const c = actifs.length >= MAX ? actifs.shift() : prendre();
      c.objet.position.copy(position);
      c.objet.position.y += 0.25;
      c.age = 0;
      c.vitesse = 1.6 + Math.random() * 0.5;
      c.derive = (Math.random() - 0.5) * 0.6;
      c.element.textContent = String(Math.round(valeur));
      c.element.dataset.genre = genre;
      // Relancer l'animation d'apparition.
      c.element.classList.remove('saute');
      void c.element.offsetWidth;
      c.element.classList.add('saute');
      c.objet.visible = true;
      actifs.push(c);
    },
    mettreAJour(dt) {
      for (let i = actifs.length - 1; i >= 0; i--) {
        const c = actifs[i];
        c.age += dt;
        c.vitesse = Math.max(0.2, c.vitesse - dt * 2.4);
        c.objet.position.y += c.vitesse * dt;
        c.objet.position.x += c.derive * dt;
        c.element.style.opacity = String(Math.min(1, 2.5 * (1 - c.age / DUREE)));
        if (c.age >= DUREE) {
          c.objet.visible = false;
          actifs.splice(i, 1);
          libres.push(c);
        }
      }
    },
    vider() {
      for (const c of actifs.splice(0)) {
        c.objet.visible = false;
        libres.push(c);
      }
    },
  };
}
