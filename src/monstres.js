// Les zombies à l'écran. Chaque zombie ne compte que 6 maillages (corps,
// yeux, deux bras, deux jambes) dont les géométries sont partagées : on peut
// en afficher des dizaines sans ralentir. Les positions viennent de l'hôte ;
// ici on ne fait que lisser, animer et tester les tirs.
//
// Une silhouette par type (TYPES_ZOMBIES) : on doit reconnaître un coureur ou
// un bouffi de loin, dans la pénombre, à sa seule allure. Le boss a en plus
// sa propre lumière, créée d'avance et éteinte tant qu'il n'est pas là : le
// nombre de lumières ne change jamais (voir arme.js).

import * as THREE from 'three';
import { colorer, fusionnerGeometries, hachage, lumineux, place } from './geometrie.js';
import { carte } from './monde.js';
import { HAUTEUR_MONSTRE, RAYON_MONSTRE, TYPES_ZOMBIES, premierTouche } from './regles.js';

const PROFIL_TETE = [[0, 0], [0.13, 0.02], [0.19, 0.09], [0.205, 0.19], [0.185, 0.3], [0.195, 0.41], [0.18, 0.51], [0.12, 0.59], [0, 0.63]];
const DUREE_CHUTE = 0.7;
const OS = '#d6cdb0';
const SANG = '#4e1010';
const CHAIR = '#8a2c24';
const NOIR = '#1a0f0f';

const cylindre = (rh, rb, h, cotes, pos, couleur, variation = 0.1) =>
  colorer(place(new THREE.CylinderGeometry(rh, rb, h, cotes), pos), couleur, variation);
const boite = (x, y, z, pos, couleur, variation = 0) => colorer(place(new THREE.BoxGeometry(x, y, z), pos), couleur, variation);
const bosse = (r, pos, couleur, variation = 0.1) => colorer(place(new THREE.IcosahedronGeometry(r, 0), pos), couleur, variation);
const cone = (r, h, cotes, pos, couleur, variation = 0.05) => colorer(place(new THREE.ConeGeometry(r, h, cotes), pos), couleur, variation);
const oeil = (r, pos) => place(new THREE.IcosahedronGeometry(r, 0), pos);
// Pièce lumineuse quelconque (même matière que les yeux).
const lueur = (geo, pos) => place(geo.index ? geo.toNonIndexed() : geo, pos);
const sombre = (couleur, f = 0.7) => new THREE.Color(couleur).multiplyScalar(f);
// Applique une même pose à des pièces construites dans leur propre repère.
const poser = (geos, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 }) => {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz),
  );
  for (const g of geos) g.applyMatrix4(m);
  return geos;
};
// Cône dont la pointe suit la direction d, la base posée en (x, y, z).
function pointe(r, h, [x, y, z], d, couleur, variation = 0.1) {
  const sens = new THREE.Vector3(...d).normalize();
  const geo = new THREE.ConeGeometry(r, h, 3).translate(0, h / 2, 0);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sens)).translate(x, y, z);
  return colorer(geo, couleur, variation);
}
// Tige de a à b (veine, tendon).
function tige(a, b, r, couleur) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const geo = new THREE.CylinderGeometry(r, r, d.length(), 4);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  geo.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
  return colorer(geo, couleur, 0.1);
}
// Un détail à plat sur un torse à n pans (un sommet devant) de rayon r, à
// l'écart x de l'axe : sa profondeur z et l'orientation du pan.
const facette = (r, x, n = 7) => ({ z: r - Math.abs(x) * Math.tan(Math.PI / n), ry: Math.sign(x) * (Math.PI / n) });

// Penche tout le haut du corps vers l'avant autour des hanches (pivot en y),
// en reculant le bassin de recul : la tête reste au-dessus des pieds, là où
// le tir la cherche.
function incliner(geos, angle, pivot, recul) {
  const m = new THREE.Matrix4().makeTranslation(0, pivot, recul)
    .multiply(new THREE.Matrix4().makeRotationX(angle))
    .multiply(new THREE.Matrix4().makeTranslation(0, -pivot, 0));
  for (const g of geos) g.applyMatrix4(m);
  return m;
}

// Bandes de tissu déchiré qui pendent d'un ourlet (chemise, manche, bas de
// pantalon, cape), de longueurs inégales : autour d'un cercle de rayon r, à la
// hauteur y, sur l'arc qui commence à debut (0 : devant).
function lambeaux(r, y, n, longueur, couleur, graine, { arc = Math.PI * 2, debut = 0, largeur = 0.07, cz = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const a = debut + ((i + 0.5) / n) * arc;
    const l = longueur * (0.35 + hachage(i, graine) * 0.9);
    return boite(largeur * (0.7 + hachage(graine, i) * 0.6), l, 0.014, {
      x: Math.sin(a) * r, y: y - l / 2, z: cz + Math.cos(a) * r, ry: a, rz: (hachage(i + 3, graine) - 0.5) * 0.4,
    }, couleur, 0.2);
  });
}

// Côtes à nu : des arcs sur le devant du torse, au-dessus d'un creux sombre.
function cotes(r, y0, n, ecart, cz = 0, arc = 1.5) {
  return [
    boite(r * 1.05, n * ecart + 0.04, 0.02, { y: y0 + ((n - 1) * ecart) / 2, z: cz + r * 0.9 }, '#2a1212'),
    ...Array.from({ length: n }, (_, i) => colorer(place(new THREE.TorusGeometry(r - i * 0.004, 0.011, 3, 7, arc - i * 0.08), {
      y: y0 + i * ecart, z: cz, rx: Math.PI / 2, rz: Math.PI / 2 - (arc - i * 0.08) / 2,
    }), OS, 0.08)),
    boite(0.022, n * ecart, 0.02, { y: y0 + ((n - 1) * ecart) / 2, z: cz + r + 0.004 }, OS),
  ];
}

// Plaie ouverte : un creux sombre et de la chair à vif qui dépasse.
function plaie(pos, taille, peau) {
  return [
    boite(taille * 1.3, taille, 0.02, pos, SANG, 0.1),
    bosse(taille * 0.35, { ...pos, x: (pos.x ?? 0) + taille * 0.15, z: (pos.z ?? 0) + 0.008 }, CHAIR, 0.15),
    boite(taille * 1.5, 0.012, 0.022, { ...pos, y: (pos.y ?? 0) + taille * 0.55 }, sombre(peau, 0.6)),
  ];
}

// Main crochue au bout du bras (y) : paume, quatre doigts qui pendent vers
// l'avant quand le bras est tendu, un pouce ; s : taille.
function main(y, peau, s = 1) {
  const parties = [boite(0.085 * s, 0.075 * s, 0.045 * s, { y }, peau, 0.06)];
  for (let i = 0; i < 4; i++) {
    const l = (i === 0 || i === 3 ? 0.055 : 0.072) * s;
    parties.push(cylindre(0.0105 * s, 0.008 * s, l, 4, { x: (i - 1.5) * 0.021 * s, y: y - 0.03 * s - l * 0.45, z: -0.012 * s, rx: 0.5 }, peau, 0.05));
  }
  parties.push(cylindre(0.012 * s, 0.009 * s, 0.05 * s, 4, { x: 0.05 * s, y: y - 0.01 * s, z: 0.012 * s, rz: 0.8 }, peau, 0.05));
  return parties;
}

// Poing fermé : une masse et une rangée de jointures.
function poing(y, r, peau) {
  return [
    bosse(r, { y }, peau, 0.05),
    ...[-1.5, -0.5, 0.5, 1.5].map((i) => bosse(r * 0.28, { x: i * r * 0.42, y: y - r * 0.55, z: -r * 0.55 }, sombre(peau, 0.9), 0.05)),
    cylindre(r * 0.2, r * 0.17, r * 0.7, 4, { x: r * 0.8, y: y + r * 0.1, rz: 0.5 }, peau, 0.05),
  ];
}

// Pied nu : un pied et cinq orteils.
function piedNu(y, peau, s = 1) {
  return [
    boite(0.12 * s, 0.07 * s, 0.22 * s, { y, z: 0.04 * s }, peau, 0.1),
    ...[-2, -1, 0, 1, 2].map((i) => boite(0.02 * s, 0.03 * s, 0.035 * s, { x: i * 0.024 * s, y: y - 0.02 * s, z: 0.165 * s }, sombre(peau, 0.85))),
  ];
}

// Chaussure éculée, semelle à part.
function chaussure(y, couleur = '#26221f', s = 1) {
  return [
    boite(0.17 * s, 0.11 * s, 0.27 * s, { y, z: 0.04 * s }, couleur, 0.1),
    boite(0.175 * s, 0.03 * s, 0.28 * s, { y: y - 0.065 * s, z: 0.04 * s }, '#141210'),
  ];
}

// Maillon de chaîne ; tour : un sur deux est tourné d'un quart.
const maillon = (pos, tour, r = 0.035) => colorer(place(new THREE.TorusGeometry(r, r * 0.3, 3, 6), { ...pos, ry: tour ? Math.PI / 2 : 0 }), '#4a4d54', 0.1);

// Tête dans son propre repère (base du crâne en 0, le visage vers +z) :
// crâne, orbites creusées, arcade, nez rongé, bouche, dents, oreilles,
// cheveux. Les yeux vont dans leur liste (ils brillent).
function visage(peau, { oeil: r = 0.034, bouche = 1, cheveux = null, meches = 7, oreilles = [1, 1], joue = false, graine = 0 } = {}) {
  const tete = [colorer(new THREE.LatheGeometry(PROFIL_TETE.map(([a, b]) => new THREE.Vector2(a, b)), 7), peau, 0.1)];
  const yeux = [];
  for (const c of [-1, 1]) {
    yeux.push(oeil(r, { x: c * 0.075, y: 0.41, z: 0.168 }));
    tete.push(boite(0.078, 0.058, 0.03, { x: c * 0.075, y: 0.41, z: 0.176, rz: c * 0.15 }, '#1c1614'));
    if (oreilles[c < 0 ? 0 : 1]) tete.push(bosse(0.05, { x: c * 0.195, y: 0.37, z: -0.01, sx: 0.35, sy: 1, sz: 0.75 }, sombre(peau, 0.9), 0.1));
  }
  tete.push(
    // Arcade lourde, nez rongé.
    boite(0.21, 0.035, 0.05, { y: 0.465, z: 0.172 }, sombre(peau, 0.85), 0.05),
    boite(0.035, 0.045, 0.03, { y: 0.33, z: 0.184 }, '#2a1a18'),
    // Bouche béante, dents du haut et du bas, quelques-unes manquent.
    boite(0.12 * bouche, 0.075 * bouche, 0.04, { y: 0.2, z: 0.186 }, NOIR),
  );
  for (let i = 0; i < 6; i++) {
    const x = (i / 5 - 0.5) * 0.1 * bouche;
    if (hachage(i, graine) > 0.2) tete.push(boite(0.014, 0.022, 0.012, { x, y: 0.2 + 0.03 * bouche, z: 0.205 }, OS));
    if (hachage(graine, i + 7) > 0.35) tete.push(boite(0.014, 0.02, 0.012, { x, y: 0.2 - 0.03 * bouche, z: 0.205 }, OS));
  }
  if (joue) {
    // Joue arrachée : la mâchoire se voit.
    tete.push(boite(0.07, 0.07, 0.03, { x: 0.13, y: 0.22, z: 0.145, ry: 0.7 }, SANG), boite(0.05, 0.012, 0.03, { x: 0.135, y: 0.2, z: 0.155, ry: 0.7 }, OS));
  }
  if (cheveux) {
    // Mèches raides, clairsemées, surtout à l'arrière du crâne.
    for (let i = 0; i < meches; i++) {
      const a = Math.PI * (0.55 + hachage(i, graine + 3) * 0.9) * (i % 2 ? 1 : -1);
      const h = 0.47 + hachage(graine + 5, i) * 0.12;
      const rayon = h < 0.53 ? 0.16 : 0.11;
      tete.push(pointe(0.022, 0.14 + hachage(i, graine + 9) * 0.1, [Math.sin(a) * rayon, h, Math.cos(a) * rayon], [Math.sin(a) * 0.7, -0.55, Math.cos(a) * 0.7], cheveux, 0.2));
    }
  }
  return { tete, yeux };
}

function finir(parties) {
  return {
    ...parties,
    tronc: fusionnerGeometries(parties.tronc),
    yeux: fusionnerGeometries(parties.yeux),
    jambe: fusionnerGeometries(parties.jambe),
    bras: fusionnerGeometries(parties.bras),
    // Bras droit différent (le boss y tient son ancre) ; sinon, le même.
    brasD: parties.brasD ? fusionnerGeometries(parties.brasD) : null,
  };
}

// Rôdeur : le zombie ordinaire, chemise en lambeaux, bras tendus, pas traînant.
function construireRodeur(v, i) {
  const g = 11 + i * 7;
  const { tete, yeux } = visage(v.peau, { cheveux: v.cheveux, meches: 5 + i * 2, oreilles: [1, i !== 1], joue: i === 1, graine: g });
  poser([...tete, ...yeux], { y: 1.6, rz: 0.12, rx: 0.1 });
  return finir({
    tronc: [
      cylindre(0.23, 0.22, 0.3, 7, { y: 0.99 }, v.bas, 0.08),
      cylindre(0.235, 0.235, 0.05, 8, { y: 1.1 }, '#2a211a', 0.05),
      boite(0.05, 0.04, 0.02, { y: 1.1, z: 0.238 }, '#8a7a4a'),
      cylindre(0.19, 0.23, 0.52, 7, { y: 1.28 }, v.haut, 0.12),
      ...lambeaux(0.236, 1.06, 11, 0.17, v.haut, g),
      // Boutons (il en manque), col, trous dans la chemise.
      ...[1.2, 1.3, 1.4].filter((_, k) => k !== i).map((y) => boite(0.02, 0.02, 0.01, { y, z: 0.235 - (y - 1.02) * 0.08 }, '#cfc6a8')),
      cylindre(0.12, 0.15, 0.05, 7, { y: 1.53 }, sombre(v.haut, 0.8), 0.05),
      ...plaie({ x: 0.08, y: 1.22, ...facette(0.222, 0.08), rz: 0.4 }, 0.1, v.haut),
      boite(0.09, 0.14, 0.03, { x: -0.1, y: 1.36, ...facette(0.212, -0.1), rz: -0.3 }, v.trou),
      ...[0, 1].map((k) => boite(0.08, 0.012, 0.02, { x: -0.1, y: 1.33 + k * 0.05, ...facette(0.222, -0.1), rz: -0.3 }, OS)),
      cylindre(0.085, 0.095, 0.1, 6, { y: 1.57 }, v.peau),
      ...tete,
    ],
    yeux,
    jambe: [
      cylindre(0.11, 0.097, 0.6, 6, { y: -0.3 }, v.bas),
      ...lambeaux(0.1, -0.58, 6, 0.1, v.bas, g + 1, { largeur: 0.05 }),
      boite(0.08, 0.07, 0.02, { y: -0.36, z: 0.102 }, v.peau),
      cylindre(0.058, 0.052, 0.18, 6, { y: -0.67 }, v.peau),
      ...(i === 2 ? piedNu(-0.82, v.peau) : chaussure(-0.79)),
    ],
    bras: [
      cylindre(0.072, 0.066, 0.28, 6, { y: -0.14 }, v.haut),
      ...lambeaux(0.07, -0.26, 5, 0.08, v.haut, g + 2, { largeur: 0.035 }),
      cylindre(0.055, 0.046, 0.25, 6, { y: -0.39 }, v.peau),
      cylindre(0.014, 0.014, 0.1, 4, { x: 0.04, y: -0.36, z: 0.03, rz: 0.2 }, OS, 0),
      ...main(-0.54, v.peau),
    ],
    hanches: [0.12, 0.86, 0],
    epaules: [0.27, 1.47, 0],
  });
}

// Coureur : maigre, voûté, côtes et colonne à l'air, grandes enjambées.
function construireCoureur(v, i) {
  const g = 31 + i * 5;
  const { tete, yeux } = visage(v.peau, { oeil: 0.03, bouche: 1.3, cheveux: '#2a2622', meches: 11, graine: g, oreilles: [i === 0, 1] });
  poser([...tete, ...yeux], { y: 1.58, sx: 0.88, sy: 0.9, sz: 0.9, rx: -0.25 });
  const haut = [
    cylindre(0.15, 0.14, 0.24, 6, { y: 1.02 }, v.bas, 0.08),
    cylindre(0.14, 0.16, 0.44, 6, { y: 1.3 }, v.haut, 0.18),
    ...lambeaux(0.163, 1.1, 8, 0.2, v.haut, g, { arc: Math.PI * 1.4, debut: Math.PI * 0.8 }),
    // La chemise ouverte sur les côtes ; la colonne dépasse dans le dos.
    ...cotes(0.152, 1.19, 4, 0.065, 0.004),
    ...Array.from({ length: 6 }, (_, k) => boite(0.04, 0.035, 0.03, { y: 1.12 + k * 0.075, z: -0.155 + k * 0.004 }, OS, 0.05)),
    boite(0.08, 0.16, 0.03, { x: 0.08, y: 1.08, ...facette(0.165, 0.08, 6), rz: 0.5 }, v.trou),
    // Clavicules saillantes.
    ...[-1, 1].map((c) => cylindre(0.012, 0.012, 0.16, 4, { x: c * 0.08, y: 1.5, z: 0.1, rz: Math.PI / 2 + c * 0.25 }, OS, 0)),
    cylindre(0.055, 0.065, 0.12, 6, { y: 1.55 }, v.peau),
    ...tete,
  ];
  const penche = incliner([...haut, ...yeux], 0.42, 0.95, -0.14);
  const epaule = new THREE.Vector3(0.21, 1.43, 0).applyMatrix4(penche);
  return finir({
    tronc: haut,
    yeux,
    jambe: [
      cylindre(0.08, 0.07, 0.42, 6, { y: -0.21 }, v.bas),
      ...lambeaux(0.075, -0.4, 5, 0.12, v.bas, g + 1, { largeur: 0.04 }),
      cylindre(0.042, 0.036, 0.36, 5, { y: -0.6 }, v.peau),
      bosse(0.035, { y: -0.43, z: 0.03 }, OS, 0.05),
      ...piedNu(-0.82, v.peau, 0.9),
    ],
    bras: [
      cylindre(0.056, 0.05, 0.1, 6, { y: -0.05 }, v.haut),
      ...lambeaux(0.054, -0.09, 4, 0.06, v.haut, g + 2, { largeur: 0.03 }),
      cylindre(0.042, 0.034, 0.28, 5, { y: -0.2 }, v.peau),
      bosse(0.032, { y: -0.34, z: -0.02 }, OS, 0.05),
      cylindre(0.034, 0.028, 0.24, 5, { y: -0.47 }, v.peau),
      boite(0.06, 0.05, 0.035, { y: -0.6 }, v.peau, 0.05),
      // Griffes.
      ...[-1, 0, 1].map((c) => cone(0.016, 0.11, 4, { x: c * 0.022, y: -0.67, z: -0.01, rx: Math.PI - 0.3 }, '#d9d2b8')),
    ],
    hanches: [0.1, 0.86, -0.14],
    epaules: [epaule.x, epaule.y, epaule.z],
  });
}

// Colosse : une montagne voûtée, tête enfoncée dans les épaules, poings énormes,
// muselière et fers aux poignets.
function construireColosse() {
  const peau = '#6c7a62', cuir = '#3b2d24', fer = '#5d626b';
  const { tete, yeux } = visage(peau, { oeil: 0.03, bouche: 1.5, oreilles: [0, 1], graine: 51 });
  // Muselière de fer rivetée et crocs du bas qui dépassent.
  tete.push(
    boite(0.26, 0.03, 0.05, { y: 0.26, z: 0.2 }, fer, 0.1),
    boite(0.26, 0.03, 0.05, { y: 0.13, z: 0.2 }, fer, 0.1),
    ...[-0.1, 0, 0.1].map((x) => boite(0.02, 0.15, 0.02, { x, y: 0.195, z: 0.225 }, fer, 0.1)),
    ...[-1, 1].map((c) => cone(0.018, 0.08, 4, { x: c * 0.06, y: 0.2, z: 0.21 }, OS)),
  );
  poser([...tete, ...yeux], { y: 1.58, z: 0.12, sx: 0.95, sy: 0.8, sz: 0.9 });
  const haut = [
    cylindre(0.3, 0.27, 0.32, 8, { y: 0.98 }, cuir, 0.1),
    ...lambeaux(0.31, 0.88, 7, 0.3, cuir, 53, { arc: 1.3, debut: -0.65, largeur: 0.11 }),
    cylindre(0.36, 0.3, 0.62, 8, { y: 1.33 }, peau, 0.14),
    bosse(0.22, { x: 0.3, y: 1.62, z: 0 }, peau),
    bosse(0.22, { x: -0.3, y: 1.62, z: 0 }, peau),
    bosse(0.25, { y: 1.66, z: -0.14 }, peau),
    // Os pointus qui percent la bosse du dos.
    ...[[-0.08, 1.78], [0.06, 1.7], [0, 1.58]].map(([x, y], k) => pointe(0.035, 0.16 - k * 0.02, [x, y, -0.3], [0, 0.4, -1], OS)),
    // Collier de fer, sangle, épaulière à pointes, cicatrices recousues.
    cylindre(0.17, 0.2, 0.08, 8, { y: 1.72, z: 0.06 }, fer, 0.1),
    colorer(new THREE.TorusGeometry(0.335, 0.024, 3, 18).rotateX(Math.PI / 2).scale(1 / Math.cos(0.75), 1, 1).rotateZ(0.75).translate(0, 1.34, 0), cuir, 0.1),
    boite(0.3, 0.07, 0.3, { x: 0.34, y: 1.82, rz: -0.35 }, fer, 0.1),
    ...[[-0.08, 0.06], [0.06, -0.06], [0.08, 0.08]].map(([dx, dz]) => cone(0.03, 0.12, 4, { x: 0.34 + dx, y: 1.9 - dx * 0.35, z: dz, rz: -0.35 }, '#8a8f96')),
    ...[0, 1, 2].map((k) => boite(0.012, 0.07, 0.02, { x: -0.16 + k * 0.05, y: 1.2 + k * 0.04, ...facette(0.325, -0.16 + k * 0.05, 8), rz: 0.6 }, '#2a1a18')),
    boite(0.16, 0.01, 0.022, { x: -0.11, y: 1.25, ...facette(0.33, -0.11, 8), rz: 0.6 }, '#2a1a18'),
    ...plaie({ x: 0.2, y: 1.45, ...facette(0.35, 0.2, 8) }, 0.09, peau),
    // Une chaîne pend de la ceinture.
    ...Array.from({ length: 5 }, (_, k) => maillon({ x: -0.22 + k * 0.012, y: 0.95 - k * 0.055, z: 0.25 }, k % 2)),
    ...tete,
  ];
  incliner([...haut, ...yeux], 0.12, 0.95, -0.04);
  return finir({
    tronc: haut,
    yeux,
    jambe: [
      cylindre(0.15, 0.13, 0.72, 7, { y: -0.36 }, cuir),
      ...[-0.25, -0.5].map((y) => cylindre(0.148, 0.145, 0.04, 7, { y }, '#2a211a', 0)),
      ...chaussure(-0.74, '#1f1b18', 1.5),
      boite(0.2, 0.08, 0.08, { y: -0.75, z: 0.22 }, fer, 0.1),
    ],
    bras: [
      cylindre(0.12, 0.1, 0.62, 7, { y: -0.31 }, peau),
      bosse(0.07, { x: 0.05, y: -0.12, z: 0.08 }, peau, 0.1),
      cylindre(0.125, 0.125, 0.09, 7, { y: -0.52 }, fer, 0),
      ...Array.from({ length: 3 }, (_, k) => maillon({ x: 0.1, y: -0.6 - k * 0.055, z: 0.04 }, k % 2)),
      ...poing(-0.7, 0.15, peau),
    ],
    hanches: [0.17, 0.86, -0.04],
    epaules: [0.47, 1.6, 0.02],
  });
}

// Bouffi : un ventre énorme, veiné, bandé, couvert de pustules qui luisent,
// prêt à éclater.
function construireBouffi() {
  const peau = '#a4ad5a', veine = '#4a2c4a', haillon = '#554c3c', bande = '#a89d7c';
  const ventre = { y: 1.14, z: 0.06 };
  const { tete, yeux: yeuxTete } = visage(peau, { oeil: 0.028, cheveux: '#3a3526', meches: 3, graine: 71 });
  // Bave qui coule du menton.
  tete.push(...[[-0.03, 0.1], [0.025, 0.16]].map(([x, l]) => boite(0.018, l, 0.012, { x, y: 0.17 - l / 2, z: 0.2 }, '#8fd13a')));
  poser([...tete, ...yeuxTete], { y: 1.5, sx: 0.85, sy: 0.78, sz: 0.85 });
  // Angles (autour, en hauteur) des pustules sur le ventre.
  const pustules = [[0.4, 0.3], [-0.5, 0.1], [0.1, -0.35], [0.75, -0.1], [-0.2, 0.55], [-0.8, -0.3], [0.35, 0.75], [1.3, 0.2], [-1.2, 0.35]];
  const surVentre = (a, b, r = 0.46) => ({ x: Math.sin(a) * Math.cos(b) * r, y: ventre.y + Math.sin(b) * r * 0.9, z: ventre.z + Math.cos(a) * Math.cos(b) * r * 1.05 });
  // Veines : des lignes sinueuses, avec une ramification, sur la peau tendue.
  const veines = [];
  const point = (a, b) => { const p = surVentre(a, b, 0.465); return [p.x, p.y, p.z]; };
  for (const [a0, b0, da, db] of [[-0.35, -0.55, 0.1, 0.16], [0.7, 0.55, -0.12, -0.13], [-1.0, 0.25, 0.15, -0.07], [0.25, -0.05, 0.12, 0.12], [1.1, -0.4, -0.06, 0.15]]) {
    const trace = Array.from({ length: 6 }, (_, k) => point(a0 + da * k + Math.sin(k * 2.1) * 0.05, b0 + db * k + Math.cos(k * 1.7) * 0.04));
    for (let k = 0; k < 5; k++) veines.push(tige(trace[k], trace[k + 1], 0.009 - k * 0.001, veine));
    veines.push(tige(trace[2], point(a0 + da * 2 + 0.18, b0 + db * 2 - 0.12), 0.006, veine));
  }
  // Bandage à la hauteur dy du centre du ventre : il en épouse le tour.
  const bandage = (dy, arc, debut) => {
    const f = Math.sqrt(1 - (dy / 0.41) ** 2) * 1.03;
    return colorer(new THREE.TorusGeometry(1, 0.045, 3, 18, arc).rotateX(Math.PI / 2).rotateY(debut).scale(0.45 * f, 1, 0.486 * f).translate(0, ventre.y + dy, ventre.z), bande, 0.15);
  };
  return finir({
    tronc: [
      cylindre(0.22, 0.2, 0.18, 7, { y: 0.8 }, haillon, 0.1),
      ...lambeaux(0.23, 0.78, 9, 0.14, haillon, 73),
      colorer(place(new THREE.IcosahedronGeometry(0.45, 1), { ...ventre, sx: 1, sy: 0.9, sz: 1.08 }), peau, 0.16),
      ...veines,
      // Nombril, bandages crasseux, déchirure d'où suinte la lueur.
      bosse(0.04, { ...surVentre(0, -0.15, 0.47) }, sombre(peau, 0.6), 0),
      bandage(-0.16, 3.6, 0.4),
      bandage(0.2, 2.4, 2.6),
      boite(0.05, 0.22, 0.03, { ...surVentre(-0.55, -0.1, 0.46), ry: -0.55, rz: 0.2 }, '#2a2a12'),
      cylindre(0.2, 0.32, 0.22, 7, { y: 1.47 }, peau, 0.12),
      ...tete,
    ],
    // Les pustules luisent avec les yeux : même matière, même maillage.
    yeux: [
      ...yeuxTete,
      ...pustules.map(([a, b], k) => oeil(0.035 + (k % 3) * 0.012, surVentre(a, b, 0.45))),
      lueur(new THREE.BoxGeometry(0.02, 0.17, 0.02), { ...surVentre(-0.55, -0.1, 0.475), ry: -0.55, rz: 0.2 }),
    ],
    jambe: [
      cylindre(0.12, 0.1, 0.44, 6, { y: -0.22 }, haillon),
      ...lambeaux(0.105, -0.42, 6, 0.1, haillon, 75, { largeur: 0.05 }),
      cylindre(0.08, 0.07, 0.16, 6, { y: -0.52 }, peau),
      ...piedNu(-0.65, peau, 1.2),
    ],
    bras: [
      cylindre(0.08, 0.07, 0.36, 6, { y: -0.18 }, peau),
      ...main(-0.42, peau, 1.25),
    ],
    hanches: [0.15, 0.7, 0],
    epaules: [0.42, 1.44, 0.02],
  });
}

// Le Roi Noyé : un géant sorti de la mer, couronne rouillée, cape en
// lambeaux, coraux, algues et coquillages, qui traîne une ancre. Dessiné à
// taille de rôdeur, agrandi par sa hauteur (×3).
function construireBoss() {
  const peau = '#648a84', pale = '#8fb0a4', haillon = '#3a4150', algue = '#3a7038', cape = '#2a2f3d';
  const rouille = '#7a4a2e', or = '#b08a3a', coquille = '#d9d0b4', fer = '#3a3d44', corail = '#c8553d';
  const { tete, yeux: yeuxTete } = visage(peau, { oeil: 0.038, bouche: 1.4, oreilles: [0, 0], cheveux: algue, meches: 9, graine: 91 });
  // Couronne rouillée : un bandeau, sept pointes, trois joyaux (qui brillent).
  tete.push(cylindre(0.2, 0.21, 0.09, 8, { y: 0.54 }, or, 0.15));
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    tete.push(cone(0.04, 0.17, 4, { x: Math.sin(a) * 0.19, y: 0.66, z: Math.cos(a) * 0.19 }, or, 0.1));
  }
  yeuxTete.push(...[-1, 0, 1].map((c) => oeil(0.026, { x: c * 0.1, y: 0.55, z: 0.2 })));
  poser([...tete, ...yeuxTete], { y: 1.55, z: 0.07, sx: 1.05, sy: 0.82, sz: 1 });
  // Branches de corail : un tronc, deux rameaux.
  const branche = (x, y, z, ry) => [
    cone(0.03, 0.22, 4, { x, y: y + 0.1, z, ry, rz: 0.2 }, corail, 0.15),
    cone(0.02, 0.14, 4, { x: x + 0.05, y: y + 0.16, z, ry, rz: -0.6 }, '#e07a4f', 0.15),
    cone(0.02, 0.12, 4, { x: x - 0.04, y: y + 0.14, z: z + 0.03, ry, rz: 0.8 }, corail, 0.15),
  ];
  const haut = [
    cylindre(0.3, 0.27, 0.3, 8, { y: 0.98 }, haillon, 0.1),
    ...lambeaux(0.31, 0.88, 12, 0.28, haillon, 93),
    cylindre(0.4, 0.3, 0.62, 9, { y: 1.32 }, peau, 0.14),
    // Ventre plus pâle, gonflé d'eau.
    colorer(place(new THREE.IcosahedronGeometry(0.28, 0), { y: 1.2, z: 0.14, sx: 1.1, sy: 0.9, sz: 0.7 }), pale, 0.1),
    bosse(0.22, { x: 0.32, y: 1.62 }, peau),
    bosse(0.22, { x: -0.32, y: 1.62 }, peau),
    bosse(0.24, { y: 1.64, z: -0.15 }, peau),
    // Cape en lambeaux dans le dos, retenue par un fermoir.
    ...lambeaux(0.43, 1.7, 13, 1.05, cape, 95, { arc: 2.6, debut: Math.PI - 1.3, largeur: 0.14, cz: -0.05 }),
    cylindre(0.05, 0.05, 0.03, 6, { x: -0.22, y: 1.7, z: 0.3, rx: Math.PI / 2 }, or, 0.1),
    // Chaîne en travers du torse.
    ...Array.from({ length: 9 }, (_, k) => {
      const x = -0.3 + k * 0.075, y = 1.08 + k * 0.06;
      return maillon({ x, y, z: facette(0.3 + ((y - 1.01) / 0.62) * 0.1, x, 9).z + 0.03, rz: 0.65 }, k % 2, 0.04);
    }),
    // Étoile de mer collée au ventre.
    ...Array.from({ length: 5 }, (_, k) => cone(0.025, 0.09, 3, { x: 0.12 + Math.sin((k / 5) * Math.PI * 2) * 0.04, y: 1.2 + Math.cos((k / 5) * Math.PI * 2) * 0.04, z: 0.335, rz: -(k / 5) * Math.PI * 2 }, '#e07a3a', 0.1)),
    // Coraux sur les épaules, bernacles.
    ...branche(0.36, 1.72, 0.05, 0.3), ...branche(-0.34, 1.74, -0.05, 2), ...branche(0.05, 1.82, -0.2, 1),
    ...[[0.36, 1.72, 0.08], [-0.3, 1.75, 0.1], [0.2, 1.45, 0.3], [-0.25, 1.3, 0.3], [0.05, 1.8, -0.2], [-0.38, 1.55, -0.05], [0.3, 1.2, 0.28], [-0.1, 1.5, 0.37]]
      .map(([x, y, z], k) => colorer(place(new THREE.ConeGeometry(0.04 + (k % 2) * 0.015, 0.06, 5), { x, y, z, rx: -0.6 + x, rz: -x * 2 }), coquille)),
    // Algues pendantes.
    ...[[0.34, 1.52, 0.1, 0.3], [-0.36, 1.5, 0.05, 0.36], [0.12, 1.86, 0.18, 0.22], [-0.1, 1.84, 0.2, 0.26], [0.26, 1.0, 0.24, 0.34], [-0.2, 1.0, 0.26, 0.4]]
      .map(([x, y, z, l], k) => boite(0.035, l, 0.015, { x, y: y - l / 2, z, rz: k % 2 ? 0.1 : -0.1 }, algue, 0.2)),
    ...tete,
  ];
  const yeux = [
    ...yeuxTete,
    // Plaie lumineuse au torse.
    lueur(new THREE.BoxGeometry(0.03, 0.2, 0.02), { x: 0.02, y: 1.38, z: 0.4, rz: 0.3 }),
    lueur(new THREE.BoxGeometry(0.03, 0.13, 0.02), { x: 0.05, y: 1.27, z: 0.39, rz: -0.5 }),
  ];
  incliner([...haut, ...yeux], 0.1, 0.95, -0.03);
  const bras = () => [
    cylindre(0.12, 0.1, 0.62, 7, { y: -0.31 }, peau),
    ...lambeaux(0.12, -0.05, 6, 0.2, haillon, 97, { largeur: 0.06 }),
    ...poing(-0.7, 0.14, peau),
    colorer(place(new THREE.ConeGeometry(0.045, 0.06, 5), { x: 0.09, y: -0.22, z: 0.06, rz: -1.2 }), coquille),
    boite(0.03, 0.28, 0.012, { x: -0.1, y: -0.35, z: 0.07 }, algue, 0.2),
    ...branche(0.08, -0.45, -0.08, 0.5),
  ];
  // L'ancre, tenue au poing : verge, jas, bras recourbés et pattes, anneau.
  const bras2 = new THREE.TorusGeometry(0.28, 0.035, 4, 10, Math.PI);
  const ancre = [
    boite(0.06, 1.0, 0.06, { y: -1.15 }, rouille, 0.15),
    boite(0.52, 0.05, 0.06, { y: -0.82 }, rouille, 0.1),
    colorer(place(bras2, { y: -1.37, rz: Math.PI }), rouille, 0.15),
    ...[-1, 1].map((c) => colorer(place(new THREE.ConeGeometry(0.07, 0.16, 4), { x: c * 0.29, y: -1.33, rz: -c * 0.5 }), rouille, 0.1)),
    ...Array.from({ length: 3 }, (_, k) => bosse(0.03, { x: 0.02, y: -0.95 - k * 0.22, z: 0.035 }, algue, 0.2)),
  ];
  return finir({
    tronc: haut,
    yeux,
    jambe: [
      cylindre(0.16, 0.14, 0.62, 7, { y: -0.31 }, haillon),
      ...lambeaux(0.15, -0.58, 8, 0.14, haillon, 99, { largeur: 0.07 }),
      cylindre(0.1, 0.09, 0.14, 7, { y: -0.66 }, peau),
      ...piedNu(-0.8, peau, 1.5),
      boite(0.04, 0.3, 0.015, { x: 0.1, y: -0.3, z: 0.15 }, algue, 0.2),
    ],
    bras: bras(),
    brasD: [...bras(), ...ancre],
    hanches: [0.18, 0.86, -0.03],
    epaules: [0.5, 1.58, 0.02],
  });
}

// Allure de chaque type : amplitude des pas, cadence, penchant et roulis.
const ALLURES = {
  rodeur: { foulee: 0.35, cadence: 2.2, penche: 0.12, roulis: 0.06, frappe: 9 },
  coureur: { foulee: 0.85, cadence: 2.4, penche: 0.06, roulis: 0.05, frappe: 12 },
  colosse: { foulee: 0.32, cadence: 1.1, penche: 0.06, roulis: 0.1, frappe: 4.5 },
  bouffi: { foulee: 0.3, cadence: 2.6, penche: -0.05, roulis: 0.17, frappe: 9 },
  boss: { foulee: 0.3, cadence: 1, penche: 0.08, roulis: 0.08, frappe: 3.2 },
};
// Le boss sort de l'eau en quelques secondes, et met plus longtemps à tomber.
const DUREE_LEVEE = 2.5;
const PROFONDEUR_LEVEE = 6;
const DUREE_CHUTE_BOSS = 1.6;

// Couleur des yeux (et des pustules) : rouge, jaune, rouge sang, vert acide.
const LUEURS = { rodeur: '#ff4a2e', coureur: '#ffd23a', colosse: '#ff1f10', bouffi: '#9dff4a', boss: '#62e6ff' };
const LUEUR_RAGE = '#ff3a2a';
// Intensité des yeux : assez pour rayonner (halo de post.js).
const ECLAT_YEUX = 6;

export function creerMonstresVue(scene) {
  const modeles = {
    rodeur: [
      { peau: '#8fa878', haut: '#4b4f5c', bas: '#3a3440', trou: '#252830', cheveux: '#2e2a25' },
      { peau: '#9aa58a', haut: '#6b4a3a', bas: '#2f3a33', trou: '#3a281f', cheveux: '#8a8478' },
      { peau: '#7f9c8e', haut: '#5a5f3a', bas: '#3b3b46', trou: '#2f321e', cheveux: '#4a3322' },
    ].map(construireRodeur),
    coureur: [
      { peau: '#a9b3a2', haut: '#6e3b3b', bas: '#33343c', trou: '#1f1d22' },
      { peau: '#9fae9a', haut: '#3f5566', bas: '#2e2a26', trou: '#1c2228' },
    ].map(construireCoureur),
    colosse: [construireColosse()],
    bouffi: [construireBouffi()],
    boss: [construireBoss()],
  };
  const matiere = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  // Des yeux qui brillent, même à travers le noir de la nuit (fog: false) :
  // on devine les zombies bien avant de les voir.
  const lueurs = Object.fromEntries(Object.entries(LUEURS).map(([id, c]) => [id, new THREE.MeshBasicMaterial({ color: lumineux(c, ECLAT_YEUX), fog: false })]));
  const pulsation = [lumineux('#6fdc2c', ECLAT_YEUX), lumineux('#d6ff7a', ECLAT_YEUX)];
  const vues = new Map();
  let temps = 0;
  // Lumière du boss : toujours dans la scène, allumée seulement pendant le combat.
  const halo = new THREE.PointLight(LUEURS.boss, 0, 22, 1.4);
  scene.add(halo);
  let enrage = false;
  // Appelé quand un zombie tombe (ou éclate) : position de son torse, type.
  let surMort = null;

  function creer(id, k) {
    const type = TYPES_ZOMBIES[k] ?? TYPES_ZOMBIES[0];
    const liste = modeles[type.id];
    const g = liste[id % liste.length];
    const racine = new THREE.Group();
    // Le coureur est déjà plus bas, voûté : pas besoin de le réduire.
    racine.scale.setScalar(type.id === 'coureur' ? 1 : type.hauteur);
    const corps = new THREE.Group();
    racine.add(corps);
    // Seul le tronc projette une ombre : six fois moins de travail pour les
    // ombres quand la horde est là.
    const maille = (geo, mat = matiere, ombre = false) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = ombre;
      return m;
    };
    const tronc = maille(g.tronc, matiere, true);
    corps.add(tronc, maille(g.yeux, lueurs[type.id]));
    const membre = (geo, [x, y, z]) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      pivot.add(maille(geo));
      corps.add(pivot);
      return pivot;
    };
    const [hx, hy, hz] = g.hanches, [ex, ey, ez] = g.epaules;
    const parties = {
      corps,
      tronc,
      jambeG: membre(g.jambe, [hx, hy, hz]),
      jambeD: membre(g.jambe, [-hx, hy, hz]),
      brasG: membre(g.bras, [ex, ey, ez]),
      brasD: membre(g.brasD ?? g.bras, [-ex, ey, ez]),
    };
    scene.add(racine);
    return {
      racine, parties, type, allure: ALLURES[type.id], cible: null, phase: Math.random() * 6, mort: -1, choc: 0, vitesse: 0,
      levee: type.boss ? DUREE_LEVEE : 0, cri: 0,
    };
  }

  function hauteur(x, z) {
    return carte().hauteurPieds(x, z);
  }

  function retirer(id, v) {
    v.racine.removeFromParent();
    vues.delete(id);
  }

  function animer(v, dt, vitesse) {
    const { parties: p, allure, type } = v;
    const attaque = v.cible?.a;
    v.phase += dt * (attaque ? allure.frappe : 2 + (vitesse / v.racine.scale.y) * allure.cadence);
    const s = Math.sin(v.phase);
    const pas = attaque ? 0 : s * allure.foulee;
    p.jambeG.rotation.x = pas;
    p.jambeD.rotation.x = -pas;
    p.corps.position.y = 0;
    if (type.id === 'coureur') {
      // Bras qui battent en courant ; au contact, les griffes lacèrent.
      p.brasG.rotation.x = attaque ? -1.35 + s * 0.7 : -0.35 - s * 0.9;
      p.brasD.rotation.x = attaque ? -1.35 - s * 0.7 : -0.35 + s * 0.9;
    } else if (type.id === 'colosse') {
      // Il marche en martelant ; au contact, les deux poings s'abattent.
      if (attaque) {
        const coup = (1 - Math.cos(v.phase)) / 2;
        p.brasG.rotation.x = p.brasD.rotation.x = -2.7 + coup * 2.3;
      } else {
        p.brasG.rotation.x = -0.35 - s * 0.35;
        p.brasD.rotation.x = -0.35 + s * 0.35;
        p.corps.position.y = -Math.abs(Math.cos(v.phase)) * 0.035;
      }
    } else if (type.boss) {
      p.brasG.rotation.z = p.brasD.rotation.z = 0;
      if (v.cri > 0) {
        // Il rugit, bras levés, pour appeler la horde.
        p.brasG.rotation.x = -2.5 + Math.sin(temps * 18) * 0.06;
        p.brasD.rotation.x = -2.2;
        p.brasG.rotation.z = 0.45;
        p.brasD.rotation.z = -0.45;
      } else if (attaque) {
        // L'ancre s'abat sur le poteau.
        const coup = (1 - Math.cos(v.phase)) / 2;
        p.brasD.rotation.x = -2.9 + coup * 2.6;
        p.brasG.rotation.x = -1.1 - s * 0.4;
      } else {
        // Il marche lourdement en traînant son ancre.
        p.brasG.rotation.x = -0.3 - s * 0.35;
        p.brasD.rotation.x = -0.2 + s * 0.08;
        p.corps.position.y = -Math.abs(Math.cos(v.phase)) * 0.03;
      }
    } else if (type.id === 'bouffi') {
      p.brasG.rotation.x = -0.8 + s * 0.15;
      p.brasD.rotation.x = -0.8 - s * 0.15;
      p.brasG.rotation.z = 0.5;
      p.brasD.rotation.z = -0.5;
      // Le ventre gonfle et dégonfle.
      const souffle = 1 + Math.sin(temps * 5 + v.phase) * 0.035;
      p.tronc.scale.set(souffle, 1, souffle);
    } else {
      // Bras tendus ; au contact, ils frappent.
      const frappe = attaque ? s * 0.5 : Math.sin(v.phase * 0.5) * 0.08;
      p.brasG.rotation.x = -1.45 + frappe;
      p.brasD.rotation.x = -1.45 - frappe;
    }
    p.corps.rotation.x = (v.cri > 0 ? -0.22 : allure.penche) + v.choc;
    v.cri = Math.max(0, v.cri - dt);
    // Dandinement : le bouffi bascule à chaque pas, les autres oscillent.
    p.corps.rotation.z = type.id === 'bouffi' ? s * allure.roulis : Math.sin(v.phase * 0.5) * allure.roulis;
    v.choc = Math.min(0, v.choc + dt * 2.5);
  }

  return {
    // liste : [{ id, k, x, z, r, a }]. immediat : l'hôte affiche sa propre simulation.
    appliquer(liste, immediat = false) {
      const presents = new Set();
      for (const m of liste) {
        presents.add(m.id);
        let v = vues.get(m.id);
        if (!v) {
          v = creer(m.id, m.k ?? 0);
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
      // Un bouffi, lui, a éclaté : l'explosion le cache, il disparaît d'un coup.
      for (const [id, v] of vues) {
        if (v.mort >= 0 || presents.has(id)) continue;
        surMort?.(v.racine.position.clone().setY(v.racine.position.y + 1.2 * v.racine.scale.y), v.type);
        if (v.type.explosif) retirer(id, v);
        else v.mort = 0;
      }
    },

    mettreAJour(dt, immediat = false) {
      temps += dt;
      lueurs.bouffi.color.lerpColors(pulsation[0], pulsation[1], (Math.sin(temps * 5) + 1) / 2);
      const suivi = 1 - Math.exp(-dt * 6);
      let boss = null;
      for (const [id, v] of vues) {
        const { racine } = v;
        if (v.mort >= 0) {
          v.mort += dt;
          const duree = v.type.boss ? DUREE_CHUTE_BOSS : DUREE_CHUTE;
          const t = Math.min(v.mort / duree, 1);
          racine.rotation.x = -t * t * Math.PI * 0.48;
          racine.position.y -= dt * 0.25 * t * racine.scale.y;
          if (v.type.boss) boss = v;
          if (v.mort > duree + 0.8) retirer(id, v);
          continue;
        }
        if (v.type.boss) boss = v;
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
        // Le boss monte des profondeurs.
        if (v.levee > 0) {
          v.levee = Math.max(0, v.levee - dt);
          const f = v.levee / DUREE_LEVEE;
          racine.position.y = hauteur(racine.position.x, racine.position.z) - f * f * PROFONDEUR_LEVEE;
        }
        animer(v, dt, vitesse);
      }
      // Le halo suit le boss, devant son torse (dedans, il n'éclairerait que
      // le sol), et s'éteint à sa mort.
      if (boss && boss.mort < 0) {
        const { position, rotation } = boss.racine;
        halo.position.set(position.x + Math.sin(rotation.y) * 2.6, position.y + 4, position.z + Math.cos(rotation.y) * 2.6);
        halo.intensity = 22 * (1 - boss.levee / DUREE_LEVEE);
      } else {
        halo.intensity = boss ? Math.max(0, halo.intensity - dt * 22) : 0;
      }
    },

    quandMeurt(fn) {
      surMort = fn;
    },

    // Type d'un zombie à l'écran (TYPES_ZOMBIES), ou null.
    typeDe(id) {
      return vues.get(id)?.type ?? null;
    },

    // Le boss rugit (il appelle ses renforts).
    rugir(id) {
      const v = vues.get(id);
      if (v) v.cri = 1.6;
    },

    // Boss enragé : yeux et halo virent au rouge.
    enrager(oui) {
      if (oui === enrage) return;
      enrage = oui;
      lueurs.boss.color.copy(lumineux(oui ? LUEUR_RAGE : LUEURS.boss, ECLAT_YEUX));
      halo.color.set(oui ? LUEUR_RAGE : LUEURS.boss);
    },

    // Recul visible à l'impact, avant même la réponse de l'hôte. Un colosse
    // bronche à peine.
    secouer(id) {
      const v = vues.get(id);
      if (v) v.choc = -0.35 / v.type.largeur ** 2;
    },

    // Zombies vivants et leur taille : [{ id, x, y, z, l, h }], y aux pieds.
    cibles() {
      const liste = [];
      for (const [id, v] of vues) {
        if (v.mort >= 0) continue;
        const p = v.racine.position;
        liste.push({ id, x: p.x, y: p.y, z: p.z, l: v.type.largeur, h: v.type.hauteur });
      }
      return liste;
    },

    // origine, direction : tableaux [x, y, z]. Renvoie { id, distance, tete } ou null.
    toucher(origine, direction, portee) {
      return premierTouche(origine, direction, this.cibles(), portee);
    },

    // Zombies vivants (positions des pieds), pour la lanterne du mannequin.
    *vivants() {
      for (const v of vues.values()) if (v.mort < 0) yield v.racine.position;
    },

    // Types présents à l'écran (indices k), pour prévenir des nouveaux venus.
    *types() {
      for (const v of vues.values()) if (v.mort < 0) yield TYPES_ZOMBIES.indexOf(v.type);
    },

    // Zombies à portée d'une explosion : [{ id, distance }].
    autourDe(point, rayon) {
      const touches = [];
      for (const c of this.cibles()) {
        // Distance au corps (entre les pieds et la tête), pas aux pieds.
        const y = Math.min(Math.max(point.y, c.y), c.y + HAUTEUR_MONSTRE * c.h);
        const d = Math.max(0, Math.hypot(c.x - point.x, y - point.y, c.z - point.z) - RAYON_MONSTRE * (c.l - 1));
        if (d <= rayon) touches.push({ id: c.id, distance: d });
      }
      return touches;
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
