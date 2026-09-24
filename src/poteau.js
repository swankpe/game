// Le poteau : mât, cordes, lanterne orientable, et Lucie, la villageoise
// qu'on protège, ligotée dessus. Repère local : elle regarde vers +z, le mât
// est dans son dos. Au-dessus d'elle, son nom et sa vie.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { animerPersonnage, creerPersonnage } from './personnage.js';
import { LANTERNE, NOM_PROTEGE } from './regles.js';

const LUCIE = {
  tete: 'oeuf', yeux: 'ronds', chapeau: 'aucun',
  peau: '#f0d2b0', haut: '#e9e4d8', salopette: '#7a2e3a', bottes: '#4a3527', couleurChapeau: '#d8443a',
};

// Ce qui fait d'elle une villageoise : une robe, un tablier, un fichu noué
// sur la tête, deux tresses.
function habillerLucie(lucie) {
  const { corps, tete } = lucie.userData.parties;
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85 });
  const robe = mat('#7a2e3a'), tablier = mat('#f2ecdc'), fichu = mat('#d8443a'), cheveux = mat('#6b3f22');
  const ajouter = (parent, geo, m, x, y, z) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  };
  ajouter(corps, new THREE.CylinderGeometry(0.25, 0.42, 0.62, 9), robe, 0, 0.78, 0);
  ajouter(corps, new THREE.BoxGeometry(0.34, 0.5, 0.04), tablier, 0, 0.86, 0.3).rotation.x = -0.22;
  ajouter(corps, new THREE.BoxGeometry(0.26, 0.16, 0.04), tablier, 0, 1.2, 0.2);
  const dessus = ajouter(tete, new THREE.SphereGeometry(0.235, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), fichu, 0, 0.3, -0.02);
  dessus.scale.set(1, 0.85, 1.05);
  ajouter(tete, new THREE.ConeGeometry(0.07, 0.16, 5), fichu, 0, 0.3, -0.25).rotation.x = -1.2;
  for (const c of [-1, 1]) {
    const tresse = ajouter(tete, new THREE.CylinderGeometry(0.045, 0.03, 0.42, 5), cheveux, c * 0.19, 0.08, -0.06);
    tresse.rotation.z = c * 0.15;
    ajouter(tete, new THREE.IcosahedronGeometry(0.045, 0), fichu, c * 0.22, -0.14, -0.06);
  }
}

export const HAUTEUR_LANTERNE = 2.35;
// Intensité du faisceau et du halo (en candelas, unités physiques de
// Three.js), au niveau 0 de la lanterne (LANTERNE dans regles.js). Le halo
// tombe de haut, sur Lucie et tout autour d'elle (LANTERNE.rayon) : c'est
// elle qui éclaire les environs.
const FAISCEAU = 170;
const HALO = 34;

export function creerPoteau(scene) {
  const bois = new THREE.MeshStandardMaterial({ color: '#5a3d2b', flatShading: true, roughness: 0.95 });
  const corde = new THREE.MeshStandardMaterial({ color: '#b08a55', flatShading: true, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: '#2d2f36', flatShading: true, roughness: 0.6, metalness: 0.3 });
  const verre = new THREE.MeshBasicMaterial({ color: '#ffd98a' });
  // Vitre allumée : assez vive pour rayonner.
  const vitreAllumee = new THREE.Color('#ffd98a').multiplyScalar(8);

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

  // Le halo : haut au-dessus d'elle, pour que la lumière tombe large et
  // régulière (sans éblouir à ses pieds), jusqu'au rayon de la lanterne.
  const lueur = new THREE.PointLight('#ffe2b0', 0, LANTERNE.rayon[0], 1);
  lueur.position.set(0, 5.5, 0.4);
  groupe.add(lueur);

  let allumage = 0;
  let puissance = 1;

  const lucie = creerPersonnage(LUCIE);
  habillerLucie(lucie);
  lucie.visible = false;
  groupe.add(lucie);

  // Son nom et sa vie, au-dessus d'elle.
  const etiquette = document.createElement('div');
  etiquette.className = 'etiquette etiquette-protege';
  const nom = document.createElement('span');
  nom.textContent = NOM_PROTEGE;
  const jauge = document.createElement('i');
  const barre = document.createElement('b');
  jauge.append(barre);
  etiquette.append(nom, jauge);
  const bulle = new CSS2DObject(etiquette);
  bulle.position.set(0, 2.95, 0);
  bulle.visible = false;
  groupe.add(bulle);

  // Le brouillard de la nuit ne l'avale jamais : de loin, Lucie et son
  // poteau restent visibles, éclairés par leur lueur.
  groupe.traverse((o) => {
    if (o.isMesh) o.material.fog = false;
  });

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
      allumage = niveau;
      faisceau.intensity = FAISCEAU * niveau * puissance;
      lueur.intensity = HALO * niveau * puissance;
      if (niveau > 0) verre.color.copy(vitreAllumee);
      else verre.color.set('#8a7a5a');
    },
    // Niveau de la lanterne achetée à l'armurerie : plus loin, plus large, plus fort.
    ameliorer(niveau) {
      const n = Math.min(Math.max(niveau | 0, 0), LANTERNE.portee.length - 1);
      if (faisceau.userData.niveau === n) return;
      faisceau.userData.niveau = n;
      faisceau.distance = LANTERNE.portee[n];
      faisceau.angle = LANTERNE.angle[n];
      faisceau.shadow.camera.far = LANTERNE.portee[n];
      faisceau.shadow.camera.updateProjectionMatrix();
      lueur.distance = LANTERNE.rayon[n];
      puissance = LANTERNE.puissance[n];
      vitre.scale.setScalar(1 + n * 0.12);
      this.allumer(allumage);
    },
    // present : Lucie est-elle au poteau (faux quand on quitte le salon).
    occuper(present) {
      lucie.visible = present;
      cordes.visible = present;
    },
    // Sa vie au-dessus d'elle (part : de 0 à 1) ; visible : en partie.
    vie(part, visible) {
      bulle.visible = visible && lucie.visible;
      barre.style.width = `${Math.max(0, Math.min(1, part)) * 100}%`;
      etiquette.dataset.danger = String(part < 0.35);
    },
    animer(dt) {
      if (lucie.visible) animerPersonnage(lucie, dt, { pose: 'attache' });
    },
  };
}
