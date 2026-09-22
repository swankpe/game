// Personnage low-poly, construit entièrement en code à partir d'une apparence
// (aucun fichier 3D à charger). Pieds à y = 0, regard vers +z.

import * as THREE from 'three';
import { normaliserApparence } from './apparence.js';

// Profils de révolution (rayon, hauteur) : LatheGeometry à 8 faces donne
// l'aspect facetté.
const TETES = {
  cacahuete: {
    profil: [[0, 0], [0.13, 0.02], [0.19, 0.09], [0.205, 0.19], [0.185, 0.3], [0.195, 0.41], [0.18, 0.51], [0.12, 0.59], [0, 0.63]],
    yeux: 0.64, bouche: 0.33, chapeau: 0.84, bosses: 0.02,
  },
  oeuf: {
    profil: [[0, 0], [0.15, 0.03], [0.215, 0.14], [0.225, 0.27], [0.2, 0.39], [0.13, 0.48], [0, 0.52]],
    yeux: 0.56, bouche: 0.3, chapeau: 0.8, bosses: 0.02,
  },
  haricot: {
    profil: [[0, 0], [0.12, 0.03], [0.165, 0.15], [0.175, 0.33], [0.16, 0.52], [0.1, 0.64], [0, 0.68]],
    yeux: 0.62, bouche: 0.32, chapeau: 0.84, bosses: 0.02,
  },
  patate: {
    profil: [[0, 0], [0.18, 0.03], [0.25, 0.13], [0.245, 0.25], [0.2, 0.37], [0.11, 0.44], [0, 0.46]],
    yeux: 0.56, bouche: 0.3, chapeau: 0.78, bosses: 0.07,
  },
};

const YEUX = {
  globuleux: { rayon: 0.085, pupille: 0.032, saillie: 0.8, ecart: 0.44 },
  ronds: { rayon: 0.066, pupille: 0.03, saillie: 0.65, ecart: 0.42 },
  petits: { rayon: 0.045, pupille: 0.024, saillie: 0.6, ecart: 0.38 },
  endormis: { rayon: 0.07, pupille: 0.03, saillie: 0.65, ecart: 0.42, paupiere: true },
};

const Y_COU = 1.6;

function matiere(couleur) {
  return new THREE.MeshStandardMaterial({ color: couleur, flatShading: true, roughness: 0.85 });
}

function assombrir(couleur, facteur) {
  return '#' + new THREE.Color(couleur).multiplyScalar(facteur).getHexString();
}

function maillage(geometrie, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometrie, mat);
  m.position.set(x, y, z);
  return m;
}

function rayonA(profil, y) {
  for (let i = 1; i < profil.length; i++) {
    const [r0, y0] = profil[i - 1], [r1, y1] = profil[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1);
  }
  return 0;
}

function hachage(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

// Bosses dépendantes de la position : les sommets doublés de la couture
// reçoivent la même valeur et la tête reste fermée.
function cabosser(geometrie, force) {
  const pos = geometrie.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + (hachage(x.toFixed(3), y.toFixed(3), z.toFixed(3)) - 0.5) * 2 * force;
    pos.setXYZ(i, x * k, y, z * k);
  }
  geometrie.computeVertexNormals();
}

function creerTete(a, mats) {
  const forme = TETES[a.tete];
  const hauteur = forme.profil.at(-1)[1];
  const tete = new THREE.Group();
  tete.position.y = Y_COU;

  const geo = new THREE.LatheGeometry(forme.profil.map(([r, y]) => new THREE.Vector2(r, y)), 8);
  cabosser(geo, forme.bosses);
  tete.add(maillage(geo, mats.peau));

  const oeil = YEUX[a.yeux];
  const yYeux = hauteur * forme.yeux;
  const rTete = rayonA(forme.profil, yYeux);
  const yeux = [];
  for (const cote of [-1, 1]) {
    const x = cote * rTete * oeil.ecart;
    const zSurface = Math.sqrt(Math.max(rTete * rTete - x * x, 0));
    const groupe = new THREE.Group();
    groupe.position.set(x, yYeux, zSurface - oeil.rayon * (1 - oeil.saillie));
    groupe.add(maillage(new THREE.IcosahedronGeometry(oeil.rayon, 1), mats.blanc));
    groupe.add(maillage(new THREE.IcosahedronGeometry(oeil.pupille, 1), mats.noir, 0, 0, oeil.rayon * 0.88));
    tete.add(groupe);
    yeux.push(groupe);
    if (oeil.paupiere) {
      const paupiere = maillage(
        new THREE.SphereGeometry(oeil.rayon * 1.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        mats.peau, groupe.position.x, groupe.position.y, groupe.position.z,
      );
      paupiere.rotation.x = 0.45;
      tete.add(paupiere);
    }
  }

  const yBouche = hauteur * forme.bouche;
  const rBouche = rayonA(forme.profil, yBouche);
  tete.add(maillage(new THREE.BoxGeometry(0.075, 0.014, 0.02), mats.bouche, 0, yBouche, rBouche - 0.004));

  const yChapeau = hauteur * forme.chapeau;
  const hautChapeau = creerChapeau(a.chapeau, rayonA(forme.profil, yChapeau), yChapeau, mats, tete);
  return { tete, yeux, sommet: Y_COU + Math.max(hauteur, hautChapeau) };
}

// Renvoie la hauteur du haut du chapeau, relative à la base de la tête.
function creerChapeau(type, r, y, mats, tete) {
  const m = mats.chapeau;
  if (type === 'bob') {
    tete.add(maillage(new THREE.CylinderGeometry(r * 0.95, r * 1.12, 0.17, 9), m, 0, y + 0.07, 0));
    tete.add(maillage(new THREE.CylinderGeometry(r * 1.15, r * 1.6, 0.05, 12), m, 0, y - 0.02, 0));
    return y + 0.16;
  }
  if (type === 'casquette') {
    const dome = maillage(new THREE.SphereGeometry(r * 1.12, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, y - 0.03, 0);
    dome.scale.y = 0.8;
    tete.add(dome);
    const visiere = maillage(new THREE.BoxGeometry(r * 1.3, 0.025, 0.2), m, 0, y - 0.02, r * 1.05 + 0.07);
    visiere.rotation.x = 0.15;
    tete.add(visiere);
    tete.add(maillage(new THREE.IcosahedronGeometry(0.022, 0), m, 0, y - 0.03 + r * 0.9, 0));
    return y + r * 0.9;
  }
  if (type === 'bonnet') {
    tete.add(maillage(new THREE.CylinderGeometry(r * 1.13, r * 1.13, 0.1, 9), mats.chapeauSombre, 0, y + 0.02, 0));
    tete.add(maillage(new THREE.ConeGeometry(r * 1.06, 0.24, 9), m, 0, y + 0.19, 0));
    tete.add(maillage(new THREE.IcosahedronGeometry(0.06, 0), mats.blanc, 0, y + 0.32, 0));
    return y + 0.36;
  }
  if (type === 'paille') {
    tete.add(maillage(new THREE.CylinderGeometry(r * 2.05, r * 2.05, 0.025, 14), m, 0, y, 0));
    tete.add(maillage(new THREE.CylinderGeometry(r * 0.95, r * 1.05, 0.15, 10), m, 0, y + 0.08, 0));
    tete.add(maillage(new THREE.CylinderGeometry(r * 1.07, r * 1.08, 0.04, 10), mats.ruban, 0, y + 0.03, 0));
    return y + 0.16;
  }
  return 0;
}

function creerJambe(cote, mats) {
  const pivot = new THREE.Group();
  pivot.position.set(cote * 0.12, 0.86, 0);
  pivot.add(maillage(new THREE.CylinderGeometry(0.115, 0.1, 0.74, 6), mats.salopette, 0, -0.37, 0));
  pivot.add(maillage(new THREE.BoxGeometry(0.19, 0.16, 0.3), mats.bottes, 0, -0.78, 0.04));
  return pivot;
}

function creerBras(cote, mats) {
  const pivot = new THREE.Group();
  pivot.position.set(cote * 0.28, 1.47, 0);
  pivot.rotation.z = cote * 0.12;
  pivot.userData.cote = cote;
  pivot.add(maillage(new THREE.CylinderGeometry(0.075, 0.068, 0.52, 6), mats.haut, 0, -0.26, 0));
  pivot.add(maillage(new THREE.IcosahedronGeometry(0.08, 0), mats.peau, 0, -0.57, 0));
  return pivot;
}

// Pistolet low-poly, canon vers +z, crosse vers le bas. La bouche du canon
// est en BOUCHE_PISTOLET, pour placer l'éclair du tir.
export const BOUCHE_PISTOLET = new THREE.Vector3(0, 0.035, 0.21);

export function creerPistolet() {
  const metal = new THREE.MeshStandardMaterial({ color: '#2b2e35', flatShading: true, roughness: 0.45, metalness: 0.4 });
  const crosse = new THREE.MeshStandardMaterial({ color: '#1c1d21', flatShading: true, roughness: 0.8 });
  const pistolet = new THREE.Group();
  pistolet.add(maillage(new THREE.BoxGeometry(0.05, 0.06, 0.24), metal, 0, 0.03, 0.07));
  const poignee = maillage(new THREE.BoxGeometry(0.045, 0.13, 0.07), crosse, 0, -0.05, -0.02);
  poignee.rotation.x = 0.25;
  pistolet.add(poignee);
  const canon = maillage(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 6), crosse, 0, 0.035, 0.195);
  canon.rotation.x = Math.PI / 2;
  pistolet.add(canon);
  pistolet.add(maillage(new THREE.BoxGeometry(0.012, 0.04, 0.05), crosse, 0, -0.015, 0.04));
  return pistolet;
}

export function creerPersonnage(apparenceBrute) {
  const a = normaliserApparence(apparenceBrute);
  const mats = {
    peau: matiere(a.peau),
    haut: matiere(a.haut),
    salopette: matiere(a.salopette),
    poche: matiere(assombrir(a.salopette, 0.8)),
    bottes: matiere(a.bottes),
    chapeau: matiere(a.couleurChapeau),
    chapeauSombre: matiere(assombrir(a.couleurChapeau, 0.75)),
    ruban: matiere('#7a2e3a'),
    blanc: matiere('#f7f5ee'),
    noir: matiere('#141414'),
    bouche: matiere('#3b2a22'),
  };

  const racine = new THREE.Group();
  const corps = new THREE.Group();
  racine.add(corps);

  const jambeG = creerJambe(1, mats), jambeD = creerJambe(-1, mats);
  const brasG = creerBras(1, mats), brasD = creerBras(-1, mats);
  corps.add(jambeG, jambeD, brasG, brasD);

  // Dans la main droite, canon dans le prolongement du bras.
  const pistolet = creerPistolet();
  pistolet.position.set(0, -0.6, 0.02);
  pistolet.rotation.x = Math.PI / 2;
  pistolet.visible = false;
  brasD.add(pistolet);

  corps.add(maillage(new THREE.CylinderGeometry(0.24, 0.235, 0.32, 7), mats.salopette, 0, 0.99, 0));
  corps.add(maillage(new THREE.CylinderGeometry(0.2, 0.235, 0.52, 7), mats.haut, 0, 1.29, 0));
  corps.add(maillage(new THREE.BoxGeometry(0.3, 0.3, 0.08), mats.salopette, 0, 1.26, 0.19));
  corps.add(maillage(new THREE.BoxGeometry(0.13, 0.09, 0.02), mats.poche, 0, 1.28, 0.235));
  for (const cote of [-1, 1]) {
    const devant = maillage(new THREE.BoxGeometry(0.055, 0.28, 0.05), mats.salopette, cote * 0.11, 1.44, 0.17);
    devant.rotation.x = -0.3;
    corps.add(devant);
    corps.add(maillage(new THREE.BoxGeometry(0.055, 0.42, 0.05), mats.salopette, cote * 0.1, 1.34, -0.2));
  }
  corps.add(maillage(new THREE.CylinderGeometry(0.085, 0.095, 0.1, 6), mats.peau, 0, 1.58, 0));

  const { tete, yeux, sommet } = creerTete(a, mats);
  corps.add(tete);

  racine.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  racine.userData = {
    parties: { corps, tete, jambeG, jambeD, brasG, brasD, yeux, pistolet },
    sommet,
    anim: { phase: 0, intensite: 0, regard: [0, 0], cible: [0, 0], prochainRegard: 0, clignement: 0, prochainClignement: 2, temps: 0 },
  };
  return racine;
}

export function libererPersonnage(racine) {
  racine.removeFromParent();
  racine.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
}

// Position des bras [rotation x, rotation z vers l'extérieur] selon la pose.
// Le balancement de la marche s'y ajoute, sauf pour le protégé ligoté.
const POSES = {
  libre: { g: [0, 0.12], d: [0, 0.12], balance: 0.9 },
  arme: { g: [-1.3, -0.45], d: [-1.5, 0.02], balance: 0.08 },
  porte: { g: [-1.25, -0.2], d: [-1.25, -0.2], balance: 0.1 },
  attache: { g: [0.55, -0.12], d: [0.55, -0.12], balance: 0 },
};

// vitesse en m/s ; regardFixe : les yeux fixent l'avant (écran de création).
// pose : 'libre' | 'arme' (pistolet en main) | 'porte' (porte le poteau) | 'attache'.
export function animerPersonnage(racine, dt, { vitesse = 0, regardFixe = false, pose = 'libre' } = {}) {
  const { parties: p, anim: e } = racine.userData;
  const reglage = POSES[pose] ?? POSES.libre;
  e.temps += dt;
  const cible = pose === 'attache' ? 0 : Math.min(vitesse / 4.2, 1.5);
  e.intensite += (cible - e.intensite) * (1 - Math.exp(-dt * 10));
  e.phase += dt * (3 + vitesse * 1.9);

  const pas = Math.sin(e.phase) * 0.55 * Math.min(e.intensite, 1.2);
  const souple = 1 - Math.exp(-dt * 14);
  p.jambeG.rotation.x = pas;
  p.jambeD.rotation.x = -pas;
  for (const [bras, [rx, rz], signe] of [[p.brasG, reglage.g, -1], [p.brasD, reglage.d, 1]]) {
    const cibleX = rx + signe * pas * reglage.balance;
    bras.rotation.x += (cibleX - bras.rotation.x) * souple;
    bras.rotation.z += (bras.userData.cote * rz - bras.rotation.z) * souple;
  }
  p.pistolet.visible = pose === 'arme';
  const respiration = Math.sin(e.temps * 2.2) * 0.008;
  p.corps.position.y = Math.abs(Math.cos(e.phase)) * 0.05 * e.intensite + respiration;
  p.tete.rotation.z = Math.sin(e.phase) * 0.04 * e.intensite;
  // Ligoté, on se débat un peu.
  p.corps.rotation.z = pose === 'attache' ? Math.sin(e.temps * 1.7) * 0.035 : 0;

  // Regard : coups d'œil au hasard, et pupilles qui ballottent en marchant.
  if (regardFixe) {
    e.cible = [0, 0];
  } else if (e.temps > e.prochainRegard) {
    e.cible = [(Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.5];
    e.prochainRegard = e.temps + 1.2 + Math.random() * 2.5;
  }
  const suivi = 1 - Math.exp(-dt * 12);
  e.regard[0] += (e.cible[0] - e.regard[0]) * suivi;
  e.regard[1] += (e.cible[1] - e.regard[1]) * suivi;

  if (e.temps > e.prochainClignement) {
    e.clignement = 0.14;
    e.prochainClignement = e.temps + 2 + Math.random() * 4;
  }
  e.clignement = Math.max(0, e.clignement - dt);
  const paupiere = e.clignement > 0 ? 0.15 : 1;

  p.yeux.forEach((oeil, i) => {
    const ballotte = Math.sin(e.phase * 2 + i * 1.7) * 0.25 * e.intensite;
    oeil.rotation.y = e.regard[0] + ballotte;
    oeil.rotation.x = e.regard[1] + ballotte * 0.5;
    oeil.scale.y = paupiere;
  });
}
