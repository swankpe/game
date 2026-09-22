// Les autres joueurs : un modèle et une étiquette de nom par membre admis,
// positions lissées entre deux messages (qui arrivent environ 10 fois par
// seconde au plus).

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { APPARITION } from './monde.js';
import { animerPersonnage, creerPersonnage, libererPersonnage } from './personnage.js';

const LIMITE = 500;

function etatValide(e) {
  if (!e || !Array.isArray(e.p) || e.p.length !== 3) return null;
  const [x, y, z] = e.p;
  if (![x, y, z, e.r].every(Number.isFinite)) return null;
  if ([x, y, z].some((v) => Math.abs(v) > LIMITE)) return null;
  const v = Number.isFinite(e.v) ? Math.min(Math.max(e.v, 0), 20) : 0;
  return { x, y, z, r: e.r, v };
}

export function creerAvatars(scene) {
  const avatars = new Map();

  function habiller(avatar, membre) {
    const ancien = avatar.modele;
    const modele = creerPersonnage(membre.apparence);
    if (ancien) {
      modele.position.copy(ancien.position);
      modele.rotation.y = ancien.rotation.y;
      libererPersonnage(ancien);
    } else {
      modele.position.set(APPARITION.x, 0, APPARITION.z);
      modele.rotation.y = APPARITION.orientation;
    }
    avatar.etiquette.removeFromParent();
    avatar.etiquette.position.set(0, modele.userData.sommet + 0.32, 0);
    modele.add(avatar.etiquette);
    scene.add(modele);
    avatar.modele = modele;
    avatar.cleApparence = JSON.stringify(membre.apparence);
  }

  return {
    // Renvoie les arrivées et départs, pour les notifications.
    synchroniser(membres, monId) {
      const arrives = [], partis = [];
      const presents = new Set();
      for (const membre of membres) {
        if (membre.id === monId) continue;
        presents.add(membre.id);
        let avatar = avatars.get(membre.id);
        if (!avatar) {
          const div = document.createElement('div');
          div.className = 'etiquette';
          avatar = { etiquette: new CSS2DObject(div), cible: null, vitesse: 0, nom: '' };
          avatars.set(membre.id, avatar);
          arrives.push(membre.nom);
        }
        if (avatar.cleApparence !== JSON.stringify(membre.apparence)) habiller(avatar, membre);
        avatar.nom = membre.nom;
        avatar.etiquette.element.textContent = membre.nom;
      }
      for (const [id, avatar] of avatars) {
        if (presents.has(id)) continue;
        partis.push(avatar.nom);
        // Retirer l'étiquette elle-même : c'est ce qui ôte son élément du DOM.
        avatar.etiquette.removeFromParent();
        libererPersonnage(avatar.modele);
        avatars.delete(id);
      }
      return { arrives, partis };
    },

    appliquerEtat(id, brut) {
      const avatar = avatars.get(id);
      const e = etatValide(brut);
      if (!avatar || !e) return;
      // Premier message : on place directement, sans glisser depuis l'apparition.
      if (!avatar.cible) {
        avatar.modele.position.set(e.x, e.y, e.z);
        avatar.modele.rotation.y = e.r;
      }
      avatar.cible = e;
    },

    mettreAJour(dt) {
      const t = 1 - Math.exp(-dt * 10);
      for (const avatar of avatars.values()) {
        const { modele, cible } = avatar;
        if (cible) {
          modele.position.x += (cible.x - modele.position.x) * t;
          modele.position.y += (cible.y - modele.position.y) * t;
          modele.position.z += (cible.z - modele.position.z) * t;
          const d = Math.atan2(Math.sin(cible.r - modele.rotation.y), Math.cos(cible.r - modele.rotation.y));
          modele.rotation.y += d * t;
          avatar.vitesse += (cible.v - avatar.vitesse) * t;
        }
        animerPersonnage(modele, dt, { vitesse: avatar.vitesse });
      }
    },

    get nombre() {
      return avatars.size;
    },
  };
}
