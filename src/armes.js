// Les modèles 3D des armes, dessinés en code. Les grandes pièces (carcasse,
// crosse, poignée…) sont des profils de côté extrudés aux arêtes biseautées :
// la silhouette reste low-poly mais lisible, et les détails (stries, organes
// de visée phosphorescents, culots en laiton) font le reste.
//
// Repère commun : canon vers +z, haut vers +y, en mètres. Chaque modèle donne
// dans userData la bouche du canon, la poignée (main droite), la garde (main
// gauche) et le chargeur : un groupe qu'on peut sortir de l'arme pendant le
// rechargement (le barillet du lance-grenades, lui, tourne). Une instance a
// ses propres matières : on peut la jeter sans toucher aux autres.

import * as THREE from 'three';

function std(color, roughness, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function matieres() {
  return {
    acier: std('#4d545f', 0.42, 0.4),
    acierClair: std('#9aa1ab', 0.32, 0.45),
    argent: std('#b9bec6', 0.28, 0.5),
    noir: std('#1e2025', 0.72, 0.1),
    caoutchouc: std('#131417', 0.95),
    bois: std('#7a4322', 0.7),
    boisClair: std('#955629', 0.62),
    boisFonce: std('#552d16', 0.75),
    laiton: std('#d7ab4b', 0.3, 0.85),
    bakelite: std('#9a4524', 0.5, 0.05),
    olive: std('#5b6a3b', 0.68, 0.05),
    oliveFonce: std('#3e4828', 0.75, 0.05),
    trou: new THREE.MeshBasicMaterial({ color: '#060607' }),
    // Visée phosphorescente : elle se voit dans la nuit.
    lueur: new THREE.MeshBasicMaterial({ color: '#8dffa6' }),
    point: new THREE.MeshBasicMaterial({ color: '#ff3b3b' }),
    verre: new THREE.MeshStandardMaterial({ color: '#7fb6d6', transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.2 }),
  };
}

function maille(geo, mat, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// Profil de côté : points [z, y], extrudé sur l'épaisseur (axe x), centré.
function forme(points) {
  const f = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? f.lineTo(z, y) : f.moveTo(z, y)));
  f.closePath();
  return f;
}

function profil(points, epaisseur, mat, { biseau = 0.003, trous = [] } = {}) {
  const f = forme(points);
  for (const t of trous) f.holes.push(forme(t));
  const geo = new THREE.ExtrudeGeometry(f, {
    depth: epaisseur - 2 * biseau,
    bevelEnabled: biseau > 0,
    bevelThickness: biseau,
    bevelSize: biseau,
    bevelSegments: 1,
    curveSegments: 3,
  });
  geo.translate(0, 0, -(epaisseur - 2 * biseau) / 2);
  geo.rotateY(-Math.PI / 2);
  return maille(geo, mat);
}

const boite = (x, y, z, mat, pos, rot) => maille(new THREE.BoxGeometry(x, y, z), mat, pos, rot);

// Cylindre couché le long de z.
function tube(rayon, longueur, mat, pos, cotes = 8, rot = [0, 0, 0]) {
  const geo = new THREE.CylinderGeometry(rayon, rayon, longueur, cotes);
  geo.rotateX(Math.PI / 2);
  return maille(geo, mat, pos, rot);
}

const bille = (rayon, mat, pos) => maille(new THREE.IcosahedronGeometry(rayon, 1), mat, pos);

// Pontet : un anneau plat, extrudé depuis un contour et son trou.
function pontet(z0, z1, y0, y1, epaisseur, mat, bord = 0.007) {
  return profil(
    [[z0, y0], [z1, y0], [z1, y1 + 0.006], [z1 - 0.008, y1], [z0 + 0.004, y1]],
    epaisseur, mat,
    { biseau: 0.002, trous: [[[z0 + bord, y0 - 0.002], [z1 - bord, y0 - 0.002], [z1 - bord, y1 + bord], [z0 + bord, y1 + bord]]] },
  );
}

// Groupe du chargeur, accroché à l'arme.
function chargeurDe(groupe) {
  const c = new THREE.Group();
  groupe.add(c);
  return c;
}

function finaliser(groupe, { bouche, poignee, garde, chargeur, barillet = false }) {
  groupe.userData = {
    bouche: new THREE.Vector3(...bouche),
    poignee: new THREE.Vector3(...poignee),
    garde: garde ? new THREE.Vector3(...garde) : null,
    chargeur,
    barillet,
  };
  return groupe;
}

function creerPistolet() {
  const m = matieres();
  const g = new THREE.Group();
  // Culasse et ses stries de préhension.
  g.add(profil([[-0.095, 0], [0.105, 0], [0.115, 0.008], [0.115, 0.036], [0.104, 0.046], [-0.088, 0.046], [-0.095, 0.038]], 0.03, m.argent));
  for (let i = 0; i < 5; i++) g.add(boite(0.0322, 0.028, 0.003, m.acier, [0, 0.022, -0.084 + i * 0.008]));
  g.add(boite(0.004, 0.012, 0.034, m.trou, [-0.0152, 0.032, 0.03]));
  g.add(tube(0.0088, 0.012, m.acierClair, [0, 0.024, 0.114]));
  g.add(tube(0.0055, 0.014, m.trou, [0, 0.024, 0.116]));
  // Carcasse polymère, poignée inclinée et ses rainures.
  g.add(profil([[-0.09, 0.001], [0.1, 0.001], [0.1, -0.014], [0.092, -0.022], [-0.06, -0.022], [-0.09, -0.012]], 0.028, m.noir));
  g.add(profil([[-0.1, -0.004], [-0.035, -0.018], [-0.048, -0.128], [-0.056, -0.138], [-0.098, -0.138], [-0.104, -0.13], [-0.102, -0.03]], 0.031, m.noir));
  for (const y of [-0.05, -0.075, -0.1]) g.add(boite(0.0335, 0.006, 0.046, m.caoutchouc, [0, y, -0.068 + y * 0.12], [0.12, 0, 0]));
  // Chargeur : la semelle dépasse de la poignée, le corps est caché dedans.
  const chargeur = chargeurDe(g);
  chargeur.add(boite(0.027, 0.008, 0.05, m.acierClair, [0, -0.141, -0.077], [0.12, 0, 0]));
  chargeur.add(boite(0.022, 0.118, 0.04, m.acier, [0, -0.08, -0.07], [0.12, 0, 0]));
  chargeur.add(boite(0.008, 0.008, 0.024, m.laiton, [0, -0.018, -0.063], [0.12, 0, 0]));
  g.add(pontet(-0.032, 0.036, -0.02, -0.058, 0.012, m.noir));
  g.add(boite(0.006, 0.022, 0.008, m.acier, [0, -0.036, 0.002], [0.3, 0, 0]));
  g.add(boite(0.003, 0.004, 0.022, m.acier, [0.0162, 0.004, 0.0]));
  // Organes de visée, points phosphorescents.
  g.add(boite(0.028, 0.008, 0.01, m.noir, [0, 0.05, -0.08]));
  for (const c of [-1, 1]) {
    g.add(boite(0.009, 0.007, 0.01, m.noir, [c * 0.0095, 0.057, -0.08]));
    g.add(bille(0.0022, m.lueur, [c * 0.0095, 0.058, -0.0748]));
  }
  g.add(boite(0.006, 0.011, 0.008, m.noir, [0, 0.051, 0.098]));
  g.add(bille(0.0022, m.lueur, [0, 0.054, 0.1025]));
  return finaliser(g, { bouche: [0, 0.024, 0.122], poignee: [0, -0.07, -0.072], garde: [0.022, -0.088, -0.058], chargeur });
}

function creerUzi() {
  const m = matieres();
  const g = new THREE.Group();
  g.add(profil([[-0.12, 0], [0.11, 0], [0.12, 0.01], [0.12, 0.05], [0.105, 0.062], [-0.11, 0.062], [-0.12, 0.052]], 0.048, m.acier));
  // Couvercle strié et levier d'armement.
  for (let z = -0.09; z <= 0.07; z += 0.028) g.add(boite(0.044, 0.004, 0.007, m.noir, [0, 0.0635, z]));
  g.add(boite(0.012, 0.013, 0.02, m.acierClair, [0, 0.07, 0.035]));
  g.add(boite(0.004, 0.018, 0.04, m.trou, [-0.0245, 0.038, 0.04]));
  // Canon court fileté.
  g.add(tube(0.02, 0.018, m.acier, [0, 0.03, 0.127], 10));
  g.add(tube(0.011, 0.07, m.acier, [0, 0.03, 0.165]));
  for (const z of [0.181, 0.189, 0.197]) g.add(tube(0.0128, 0.004, m.acierClair, [0, 0.03, z]));
  g.add(tube(0.006, 0.01, m.trou, [0, 0.03, 0.2]));
  // Hausse et guidon protégé.
  for (const c of [-1, 1]) g.add(boite(0.006, 0.02, 0.012, m.acier, [c * 0.012, 0.072, 0.1]));
  g.add(boite(0.003, 0.012, 0.004, m.noir, [0, 0.069, 0.1]));
  g.add(bille(0.0022, m.lueur, [0, 0.075, 0.1025]));
  g.add(boite(0.03, 0.014, 0.012, m.acier, [0, 0.069, -0.1]));
  for (const c of [-1, 1]) g.add(bille(0.0022, m.lueur, [c * 0.007, 0.076, -0.0935]));
  // Poignée centrale : le chargeur passe dedans.
  g.add(profil([[-0.035, 0.001], [0.02, 0.001], [0.015, -0.13], [0.008, -0.14], [-0.035, -0.14], [-0.04, -0.13]], 0.04, m.noir));
  g.add(boite(0.0425, 0.1, 0.04, m.caoutchouc, [0, -0.072, -0.012], [0.04, 0, 0]));
  for (let y = -0.04; y > -0.12; y -= 0.02) g.add(boite(0.0445, 0.004, 0.036, m.noir, [0, y, -0.012], [0.04, 0, 0]));
  g.add(boite(0.02, 0.05, 0.008, m.acierClair, [0, -0.035, -0.041]));
  const chargeur = chargeurDe(g);
  chargeur.add(boite(0.028, 0.07, 0.034, m.acier, [0, -0.172, -0.012]));
  chargeur.add(boite(0.034, 0.01, 0.042, m.noir, [0, -0.21, -0.012]));
  chargeur.add(boite(0.024, 0.12, 0.03, m.acier, [0, -0.08, -0.012]));
  chargeur.add(boite(0.008, 0.008, 0.02, m.laiton, [0, -0.016, -0.008]));
  g.add(pontet(0.022, 0.078, 0.001, -0.046, 0.012, m.noir));
  g.add(boite(0.005, 0.02, 0.007, m.acierClair, [0, -0.02, 0.04], [0.3, 0, 0]));
  // Crosse métallique repliée le long du flanc gauche.
  g.add(boite(0.05, 0.034, 0.02, m.acier, [0, 0.026, -0.13]));
  for (const y of [0.012, 0.048]) g.add(tube(0.0038, 0.225, m.acierClair, [0.028, y, -0.02]));
  g.add(boite(0.012, 0.052, 0.012, m.caoutchouc, [0.028, 0.03, 0.094]));
  return finaliser(g, { bouche: [0, 0.03, 0.205], poignee: [0, -0.062, -0.01], garde: [0.012, -0.014, 0.088], chargeur });
}

function creerFusil() {
  const m = matieres();
  const g = new THREE.Group();
  // Boîte de culasse et couvercle.
  g.add(profil([[-0.14, 0], [0.13, 0], [0.14, 0.012], [0.14, 0.05], [0.12, 0.06], [-0.1, 0.066], [-0.14, 0.058]], 0.044, m.acier));
  for (const z of [-0.06, -0.02, 0.02]) g.add(boite(0.046, 0.003, 0.004, m.acierClair, [0, 0.066, z]));
  g.add(boite(0.003, 0.012, 0.12, m.acierClair, [-0.0235, 0.03, -0.01], [0.06, 0, 0]));
  g.add(boite(0.004, 0.02, 0.05, m.trou, [-0.0225, 0.042, 0.06]));
  g.add(boite(0.022, 0.012, 0.04, m.acier, [0, 0.07, 0.12]));
  for (const c of [-1, 1]) g.add(bille(0.0022, m.lueur, [c * 0.006, 0.077, 0.1]));
  // Crosse en bois et plaque de couche.
  g.add(profil([[-0.14, 0.056], [-0.47, 0.03], [-0.49, 0.028], [-0.49, -0.1], [-0.46, -0.1], [-0.3, -0.035], [-0.14, -0.002]], 0.036, m.bois));
  g.add(boite(0.038, 0.13, 0.012, m.acier, [0, -0.036, -0.495]));
  g.add(maille(new THREE.TorusGeometry(0.012, 0.003, 4, 8), m.acierClair, [0.02, -0.07, -0.42], [0, Math.PI / 2, 0]));
  // Poignée pistolet, pontet, queue de détente.
  g.add(profil([[-0.065, 0.001], [-0.02, 0.001], [-0.04, -0.115], [-0.05, -0.124], [-0.085, -0.12], [-0.09, -0.11], [-0.075, -0.02]], 0.032, m.boisFonce));
  g.add(pontet(-0.02, 0.05, 0.001, -0.045, 0.01, m.acier));
  g.add(boite(0.005, 0.022, 0.007, m.acierClair, [0, -0.02, 0.015], [0.3, 0, 0]));
  // Chargeur « banane » en bakélite, segment par segment.
  const chargeur = chargeurDe(g);
  let cz = 0.068, cy = -0.012;
  for (let k = 0; k < 6; k++) {
    const t = 0.12 + k * 0.075;
    chargeur.add(boite(0.028, 0.036, 0.066, m.bakelite, [0, cy, cz], [-t, 0, 0]));
    chargeur.add(boite(0.0295, 0.004, 0.068, m.boisFonce, [0, cy - 0.018 * Math.cos(t), cz + 0.018 * Math.sin(t)], [-t, 0, 0]));
    cz += Math.sin(t + 0.037) * 0.034;
    cy -= Math.cos(t + 0.037) * 0.034;
  }
  // Garde-main inférieur (bois clair, rainures) et supérieur.
  g.add(profil([[0.14, 0.046], [0.14, 0.002], [0.155, -0.012], [0.35, -0.012], [0.365, 0.002], [0.365, 0.046]], 0.05, m.boisClair));
  for (const c of [-1, 1]) g.add(boite(0.004, 0.005, 0.16, m.boisFonce, [c * 0.0255, 0.018, 0.255]));
  g.add(profil([[0.15, 0.046], [0.33, 0.046], [0.335, 0.06], [0.325, 0.074], [0.16, 0.074], [0.15, 0.064]], 0.036, m.bois));
  g.add(tube(0.011, 0.1, m.acier, [0, 0.062, 0.38]));
  // Canon, bloc d'emprunt, guidon, frein de bouche, baguette.
  g.add(tube(0.0105, 0.28, m.acier, [0, 0.03, 0.47]));
  g.add(boite(0.03, 0.05, 0.025, m.acier, [0, 0.045, 0.43]));
  g.add(boite(0.026, 0.02, 0.03, m.acier, [0, 0.044, 0.555]));
  for (const c of [-1, 1]) g.add(boite(0.005, 0.03, 0.02, m.acier, [c * 0.011, 0.066, 0.555]));
  g.add(boite(0.003, 0.018, 0.003, m.noir, [0, 0.063, 0.555]));
  g.add(bille(0.0022, m.lueur, [0, 0.072, 0.557]));
  g.add(tube(0.016, 0.046, m.acier, [0, 0.03, 0.626], 10));
  for (const z of [0.617, 0.632]) g.add(boite(0.034, 0.005, 0.009, m.trou, [0, 0.04, z]));
  g.add(tube(0.006, 0.01, m.trou, [0, 0.03, 0.648]));
  g.add(tube(0.004, 0.24, m.acierClair, [0, 0.008, 0.49]));
  return finaliser(g, { bouche: [0, 0.03, 0.652], poignee: [0, -0.058, -0.055], garde: [0, -0.008, 0.27], chargeur });
}

function creerLanceGrenades() {
  const m = matieres();
  const g = new THREE.Group();
  // Barillet à six chambres, cannelures et culots en laiton : il tourne sur
  // son axe (z) pendant le rechargement.
  const barillet = chargeurDe(g);
  barillet.add(tube(0.075, 0.15, m.noir, [0, 0, 0.02], 12));
  g.add(tube(0.016, 0.17, m.acierClair, [0, 0, 0.02]));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    barillet.add(boite(0.016, 0.012, 0.13, m.acierClair, [Math.sin(a) * 0.074, Math.cos(a) * 0.074, 0.02], [0, 0, -a]));
    const b = (i / 6) * Math.PI * 2;
    const x = Math.sin(b) * 0.046, y = Math.cos(b) * 0.046;
    barillet.add(tube(0.02, 0.006, m.laiton, [x, y, -0.057], 10));
    barillet.add(tube(0.006, 0.008, m.acierClair, [x, y, -0.059], 6));
    barillet.add(tube(0.02, 0.004, m.oliveFonce, [x, y, 0.096], 10));
  }
  // Carcasse : flasques, sangles, rail et viseur à point rouge.
  g.add(profil([[-0.135, -0.075], [-0.07, -0.075], [-0.07, 0.1], [-0.135, 0.085]], 0.05, m.acier));
  g.add(boite(0.07, 0.19, 0.02, m.acier, [0, 0.01, 0.106]));
  g.add(boite(0.032, 0.02, 0.22, m.acier, [0, 0.1, 0.02]));
  g.add(boite(0.032, 0.02, 0.18, m.acier, [0, -0.085, 0.02]));
  g.add(boite(0.024, 0.008, 0.2, m.noir, [0, 0.114, 0.02]));
  for (let z = -0.07; z <= 0.11; z += 0.02) g.add(boite(0.026, 0.004, 0.008, m.acierClair, [0, 0.12, z]));
  g.add(boite(0.03, 0.012, 0.05, m.noir, [0, 0.126, -0.01]));
  for (const c of [-1, 1]) g.add(boite(0.005, 0.045, 0.03, m.noir, [c * 0.018, 0.154, -0.01]));
  g.add(boite(0.041, 0.006, 0.03, m.noir, [0, 0.178, -0.01]));
  g.add(boite(0.03, 0.038, 0.002, m.verre, [0, 0.154, -0.004]));
  g.add(bille(0.0032, m.point, [0, 0.154, -0.012]));
  // Gros canon olive et ses bagues.
  g.add(tube(0.04, 0.34, m.olive, [0, 0.05, 0.27], 10));
  for (const z of [0.125, 0.425]) g.add(tube(0.043, 0.022, m.oliveFonce, [0, 0.05, z], 10));
  g.add(tube(0.032, 0.012, m.trou, [0, 0.05, 0.44], 10));
  // Poignée avant verticale, rainurée.
  g.add(maille(new THREE.CylinderGeometry(0.018, 0.017, 0.11, 8), m.noir, [0, -0.015, 0.3]));
  for (const y of [-0.03, -0.045, -0.06]) g.add(maille(new THREE.TorusGeometry(0.018, 0.003, 4, 8), m.caoutchouc, [0, y, 0.3], [Math.PI / 2, 0, 0]));
  // Poignée pistolet et pontet.
  g.add(profil([[-0.1, -0.07], [-0.055, -0.07], [-0.07, -0.19], [-0.08, -0.2], [-0.115, -0.195], [-0.12, -0.185], [-0.108, -0.08]], 0.034, m.noir));
  g.add(boite(0.036, 0.08, 0.036, m.caoutchouc, [0, -0.135, -0.085], [0.12, 0, 0]));
  g.add(pontet(-0.058, 0.004, -0.07, -0.112, 0.012, m.noir));
  g.add(boite(0.006, 0.022, 0.008, m.acierClair, [0, -0.086, -0.03], [0.3, 0, 0]));
  // Crosse télescopique.
  g.add(tube(0.013, 0.26, m.acierClair, [0, 0.06, -0.26]));
  g.add(tube(0.01, 0.23, m.acierClair, [0, -0.02, -0.25]));
  g.add(profil([[-0.4, 0.09], [-0.37, 0.09], [-0.37, -0.075], [-0.4, -0.085]], 0.046, m.noir));
  g.add(boite(0.048, 0.17, 0.014, m.caoutchouc, [0, 0.003, -0.405]));
  return finaliser(g, { bouche: [0, 0.05, 0.445], poignee: [0, -0.125, -0.085], garde: [0, -0.05, 0.3], chargeur: barillet, barillet: true });
}

const CONSTRUCTEURS = { pistolet: creerPistolet, uzi: creerUzi, fusil: creerFusil, lance: creerLanceGrenades };

export function creerModeleArme(id) {
  return (CONSTRUCTEURS[id] ?? creerPistolet)();
}

export function libererModele(objet) {
  objet.removeFromParent();
  objet.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
}

// Grenade de 40 mm en vol : corps olive, ogive en laiton.
export function creerGrenade() {
  const m = matieres();
  const g = new THREE.Group();
  g.add(tube(0.02, 0.05, m.olive, [0, 0, 0], 10));
  g.add(tube(0.0205, 0.008, m.laiton, [0, 0, -0.022], 10));
  const ogive = new THREE.ConeGeometry(0.02, 0.03, 10);
  ogive.rotateX(Math.PI / 2);
  g.add(maille(ogive, m.laiton, [0, 0, 0.04]));
  g.add(tube(0.021, 0.006, m.noir, [0, 0, 0.012], 10));
  return g;
}
