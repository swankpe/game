// Les zombies à l'écran. Chaque zombie ne compte que 6 maillages (corps,
// yeux, deux bras, deux jambes) dont les géométries sont partagées : on peut
// en afficher des dizaines sans ralentir. Les positions viennent de l'hôte ;
// ici on ne fait que lisser, animer et tester les tirs.

import * as THREE from 'three';
import { colorer, fusionnerGeometries, place } from './geometrie.js';
import { hauteurTerrain } from './monde.js';
import { premierTouche } from './regles.js';

const VARIANTES = [
  { peau: '#8fa878', haut: '#4b4f5c', bas: '#3a3440', trou: '#252830' },
  { peau: '#9aa58a', haut: '#6b4a3a', bas: '#2f3a33', trou: '#3a281f' },
  { peau: '#7f9c8e', haut: '#5a5f3a', bas: '#3b3b46', trou: '#2f321e' },
];

const PROFIL_TETE = [[0, 0], [0.13, 0.02], [0.19, 0.09], [0.205, 0.19], [0.185, 0.3], [0.195, 0.41], [0.18, 0.51], [0.12, 0.59], [0, 0.63]];
const PROFONDEUR_MAX = -2.2;
const DUREE_CHUTE = 0.7;

function construireVariante(v) {
  const tronc = [
    colorer(place(new THREE.CylinderGeometry(0.23, 0.22, 0.3, 7), { y: 0.99 }), v.bas, 0.08),
    colorer(place(new THREE.CylinderGeometry(0.19, 0.23, 0.52, 7), { y: 1.28 }), v.haut, 0.12),
    colorer(place(new THREE.BoxGeometry(0.12, 0.1, 0.03), { x: 0.07, y: 1.2, z: 0.215, rz: 0.4 }), v.trou),
    colorer(place(new THREE.BoxGeometry(0.09, 0.14, 0.03), { x: -0.1, y: 1.36, z: 0.2, rz: -0.3 }), v.trou),
    colorer(place(new THREE.CylinderGeometry(0.085, 0.095, 0.1, 6), { y: 1.57 }), v.peau),
  ];
  const tete = new THREE.LatheGeometry(PROFIL_TETE.map(([r, y]) => new THREE.Vector2(r, y)), 7);
  tronc.push(colorer(place(tete, { y: 1.6, rz: 0.12, rx: 0.1 }), v.peau, 0.1));
  // Bouche béante.
  tronc.push(colorer(place(new THREE.BoxGeometry(0.1, 0.06, 0.04), { y: 1.8, z: 0.17 }), '#1a0f0f'));

  const yeux = [-1, 1].map((c) => place(new THREE.IcosahedronGeometry(0.034, 0), { x: c * 0.075 + 0.02, y: 2.01, z: 0.165 }));
  const jambe = [
    colorer(place(new THREE.CylinderGeometry(0.11, 0.095, 0.74, 6), { y: -0.37 }), v.bas, 0.1),
    colorer(place(new THREE.BoxGeometry(0.18, 0.14, 0.28), { y: -0.79, z: 0.04 }), '#26221f'),
  ];
  const bras = [
    colorer(place(new THREE.CylinderGeometry(0.07, 0.062, 0.5, 6), { y: -0.25 }), v.haut, 0.1),
    colorer(place(new THREE.IcosahedronGeometry(0.08, 0), { y: -0.56 }), v.peau),
  ];
  return {
    tronc: fusionnerGeometries(tronc),
    yeux: fusionnerGeometries(yeux),
    jambe: fusionnerGeometries(jambe),
    bras: fusionnerGeometries(bras),
  };
}

export function creerMonstresVue(scene) {
  const variantes = VARIANTES.map(construireVariante);
  const matiere = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  // Des yeux qui brillent faiblement : on devine les zombies avant de les voir.
  const matiereYeux = new THREE.MeshBasicMaterial({ color: '#ff4a2e' });
  const vues = new Map();

  function creer(id) {
    const g = variantes[id % variantes.length];
    const racine = new THREE.Group();
    const corps = new THREE.Group();
    racine.add(corps);
    const maille = (geo, mat = matiere) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      return m;
    };
    corps.add(maille(g.tronc), maille(g.yeux, matiereYeux));
    const membre = (geo, x, y) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      pivot.add(maille(geo));
      corps.add(pivot);
      return pivot;
    };
    const parties = {
      corps,
      jambeG: membre(g.jambe, 0.12, 0.86),
      jambeD: membre(g.jambe, -0.12, 0.86),
      brasG: membre(g.bras, 0.27, 1.47),
      brasD: membre(g.bras, -0.27, 1.47),
    };
    scene.add(racine);
    return { racine, parties, cible: null, phase: Math.random() * 6, mort: -1, choc: 0, vitesse: 0 };
  }

  function hauteur(x, z) {
    return Math.max(hauteurTerrain(x, z), PROFONDEUR_MAX);
  }

  return {
    // liste : [{ id, x, z, r, a }]. immediat : l'hôte affiche sa propre simulation.
    appliquer(liste, immediat = false) {
      const presents = new Set();
      for (const m of liste) {
        presents.add(m.id);
        let v = vues.get(m.id);
        if (!v) {
          v = creer(m.id);
          vues.set(m.id, v);
          v.racine.position.set(m.x, hauteur(m.x, m.z), m.z);
          v.racine.rotation.y = m.r;
        }
        if (v.mort >= 0) continue;
        v.cible = m;
        if (immediat) {
          const d = Math.hypot(m.x - v.racine.position.x, m.z - v.racine.position.z);
          v.vitesse = d;
          v.racine.position.set(m.x, hauteur(m.x, m.z), m.z);
          v.racine.rotation.y = m.r;
        }
      }
      // Disparu de la liste : il est mort (ou la manche est finie), il tombe.
      for (const [id, v] of vues) {
        if (v.mort < 0 && !presents.has(id)) v.mort = 0;
      }
    },

    mettreAJour(dt, immediat = false) {
      const suivi = 1 - Math.exp(-dt * 6);
      for (const [id, v] of vues) {
        const { racine, parties: p } = v;
        if (v.mort >= 0) {
          v.mort += dt;
          const t = Math.min(v.mort / DUREE_CHUTE, 1);
          racine.rotation.x = -t * t * Math.PI * 0.48;
          racine.position.y -= dt * 0.25 * t;
          if (v.mort > DUREE_CHUTE + 0.8) {
            racine.removeFromParent();
            vues.delete(id);
          }
          continue;
        }
        let vitesse = immediat && dt > 0 ? v.vitesse / dt : 0;
        if (!immediat && v.cible) {
          const avant = racine.position.clone();
          racine.position.x += (v.cible.x - racine.position.x) * suivi;
          racine.position.z += (v.cible.z - racine.position.z) * suivi;
          racine.position.y = hauteur(racine.position.x, racine.position.z);
          const d = Math.atan2(Math.sin(v.cible.r - racine.rotation.y), Math.cos(v.cible.r - racine.rotation.y));
          racine.rotation.y += d * suivi;
          vitesse = dt > 0 ? avant.distanceTo(racine.position) / dt : 0;
        }
        const attaque = v.cible?.a;
        v.phase += dt * (attaque ? 9 : 2 + vitesse * 2.2);
        const pas = attaque ? 0 : Math.sin(v.phase) * 0.35;
        p.jambeG.rotation.x = pas;
        p.jambeD.rotation.x = -pas;
        // Bras tendus ; au contact, ils frappent.
        const frappe = attaque ? Math.sin(v.phase) * 0.5 : Math.sin(v.phase * 0.5) * 0.08;
        p.brasG.rotation.x = -1.45 + frappe;
        p.brasD.rotation.x = -1.45 - frappe;
        p.corps.rotation.x = 0.12 + v.choc;
        p.corps.rotation.z = Math.sin(v.phase * 0.5) * 0.06;
        v.choc = Math.min(0, v.choc + dt * 2.5);
      }
    },

    // Recul visible à l'impact, avant même la réponse de l'hôte.
    secouer(id) {
      const v = vues.get(id);
      if (v) v.choc = -0.35;
    },

    // origine, direction : tableaux [x, y, z]. Renvoie { id, distance, tete } ou null.
    toucher(origine, direction, portee) {
      const cibles = [];
      for (const [id, v] of vues) {
        if (v.mort < 0) cibles.push({ id, x: v.racine.position.x, y: v.racine.position.y, z: v.racine.position.z });
      }
      return premierTouche(origine, direction, cibles, portee);
    },

    // Zombies vivants, pour la lanterne du mannequin.
    *vivants() {
      for (const v of vues.values()) if (v.mort < 0) yield v.racine.position;
    },

    vider() {
      for (const v of vues.values()) v.racine.removeFromParent();
      vues.clear();
    },

    get nombre() {
      let n = 0;
      for (const v of vues.values()) if (v.mort < 0) n += 1;
      return n;
    },
  };
}
