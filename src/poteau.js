// Le poteau : mât, cordes, lanterne orientable et, faute de protégé humain,
// le mannequin de paille. Repère local : le protégé regarde vers +z, le mât
// est dans son dos.

import * as THREE from 'three';
import { animerPersonnage, creerPersonnage } from './personnage.js';

const MANNEQUIN = {
  tete: 'patate', yeux: 'petits', chapeau: 'paille',
  peau: '#d9b56c', haut: '#8a6a4c', salopette: '#b59560', bottes: '#4a3527', couleurChapeau: '#c9a45a',
};

export const HAUTEUR_LANTERNE = 2.35;
// Intensité du faisceau et de la lueur (en candelas, unités physiques de Three.js).
const FAISCEAU = 170;
const LUEUR = 7;

export function creerPoteau(scene) {
  const bois = new THREE.MeshStandardMaterial({ color: '#5a3d2b', flatShading: true, roughness: 0.95 });
  const corde = new THREE.MeshStandardMaterial({ color: '#b08a55', flatShading: true, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: '#2d2f36', flatShading: true, roughness: 0.6, metalness: 0.3 });
  const verre = new THREE.MeshBasicMaterial({ color: '#ffd98a' });

  const groupe = new THREE.Group();
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 2.75, 6), bois);
  mat.position.set(0, 1.37, -0.3);
  groupe.add(mat);
  const traverse = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.45), bois);
  traverse.position.set(0, 2.62, -0.12);
  groupe.add(traverse);

  const cordes = new THREE.Group();
  for (const y of [1.05, 1.38]) {
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 4, 10), corde);
    anneau.position.set(0, y, -0.13);
    anneau.rotation.x = Math.PI / 2;
    cordes.add(anneau);
  }
  groupe.add(cordes);

  // La lanterne tourne sur elle-même (lacet puis tangage) sous la traverse.
  const lanterne = new THREE.Group();
  lanterne.rotation.order = 'YXZ';
  lanterne.position.set(0, HAUTEUR_LANTERNE, 0.08);
  const boitier = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 6), metal);
  boitier.rotation.x = Math.PI / 2;
  lanterne.add(boitier);
  const vitre = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 6), verre);
  vitre.rotation.x = Math.PI / 2;
  vitre.position.z = 0.115;
  lanterne.add(vitre);
  groupe.add(lanterne);

  const faisceau = new THREE.SpotLight('#ffe2a8', 0, 42, 0.5, 0.45, 1.3);
  faisceau.position.set(0, 0, 0.12);
  faisceau.castShadow = true;
  faisceau.shadow.mapSize.set(1024, 1024);
  faisceau.shadow.camera.near = 0.4;
  faisceau.shadow.camera.far = 42;
  faisceau.shadow.bias = -0.0008;
  faisceau.shadow.normalBias = 0.02;
  const visee = new THREE.Object3D();
  visee.position.set(0, 0, 10);
  lanterne.add(faisceau, visee);
  faisceau.target = visee;

  const lueur = new THREE.PointLight('#ffcf85', 0, 9, 1.6);
  lueur.position.set(0, HAUTEUR_LANTERNE - 0.2, 0.3);
  groupe.add(lueur);

  const mannequin = creerPersonnage(MANNEQUIN);
  mannequin.visible = false;
  groupe.add(mannequin);

  scene.add(groupe);

  return {
    groupe,
    lanterne,
    // leve : hauteur supplémentaire quand un défenseur porte le poteau.
    placer(x, y, z, orientation, leve = 0) {
      groupe.position.set(x, y + leve, z);
      groupe.rotation.y = orientation;
    },
    // Direction du faisceau en repère monde : lacet (même convention que
    // l'orientation des corps, avant = (sin, cos)) et tangage (vers le haut > 0).
    orienter(lacet, tangage) {
      lanterne.rotation.y = lacet - groupe.rotation.y;
      lanterne.rotation.x = -tangage;
    },
    // 0 : éteinte (le jour), 1 : allumée.
    allumer(niveau) {
      faisceau.intensity = FAISCEAU * niveau;
      lueur.intensity = LUEUR * niveau;
      verre.color.set(niveau > 0 ? '#ffd98a' : '#8a7a5a');
    },
    // occupant : 'personne' (lobby), 'mannequin' ou 'humain' (dessiné par avatars.js).
    occuper(occupant) {
      mannequin.visible = occupant === 'mannequin';
      cordes.visible = occupant !== 'personne';
    },
    animer(dt) {
      if (mannequin.visible) animerPersonnage(mannequin, dt, { pose: 'attache' });
    },
  };
}
