// Rendu de la forêt noire (foret.js) : une clairière et son feu de camp, la
// cabane du chasseur qui sert d'armurerie, un étang aux roseaux, le cercle de
// pierres levées autour de l'autel, des sapins serrés, des troncs couchés,
// des champignons qui luisent la nuit. Chaque obstacle de foret.js est
// dessiné ici, à sa place.

import * as THREE from 'three';
import { creerBrume, creerLucioles } from './ambiance.js';
import { creerModeleArme } from './armes.js';
import { creerAutel } from './autel.js';
import {
  BOIS, FER, PIERRES, arbresDeCarte, assise, atelier, creerFeux, creerSol, creerVegetation, enseigne, foretLointaine,
  fusionnerMatieres, fusionnerPositions, matieres, rocher, tronc,
} from './decor-commun.js';
import { colorer, hachage, lumineux, place } from './geometrie.js';
import { dansObstacle } from './carte-ouverte.js';
import { AUTEL_FORET, BORNE_FORET, CABANE_CHASSEUR, CERCLE, CLAIRIERE, ETANG, FEU, FORET } from './foret.js';

const relief = FORET.hauteurSol;
const MOUSSUS = ['#6f7468', '#62675c', '#7a7f70'];
const RONDINS = ['#6a4a30', '#5e4029', '#74533a'];

function versAutel(x, z) {
  const t = Math.max(0, Math.min(1, (x * AUTEL_FORET.x + z * AUTEL_FORET.z) / (AUTEL_FORET.x ** 2 + AUTEL_FORET.z ** 2)));
  return Math.hypot(x - AUTEL_FORET.x * t, z - AUTEL_FORET.z * t);
}

function teinte(x, z) {
  const loin = Math.max(Math.abs(x), Math.abs(z)) - BORNE_FORET;
  if (loin > 1.5) return hachage(Math.floor(x / 3), Math.floor(z / 3)) > 0.5 ? '#232d1c' : '#29331f';
  const r = Math.hypot(x, z);
  if (Math.hypot(x - FEU.x, z - FEU.z) < 1.6) return '#3a3026';
  if (Math.hypot(x - ETANG.x, z - ETANG.z) < ETANG.rayon + 1.2) return '#3f3a2a';
  if (Math.hypot(x - AUTEL_FORET.x, z - AUTEL_FORET.z) < CERCLE.rayon + 1) return hachage(Math.floor(x), Math.floor(z)) > 0.5 ? '#4a5240' : '#434a3a';
  if (versAutel(x, z) < 1.4 && r > 3) return hachage(x, z) > 0.5 ? '#5e4d36' : '#54452f';
  if (r < CLAIRIERE - 1) return hachage(Math.floor(x / 2), Math.floor(z / 2)) > 0.4 ? '#577a36' : '#4f7031';
  const aiguilles = hachage(Math.floor(x / 2.5), Math.floor(z / 2.5));
  return aiguilles > 0.66 ? '#4d4030' : aiguilles > 0.33 ? '#3b4a2a' : '#34422a';
}

// La cabane du chasseur : murs de rondins, toit de planches qui déborde
// devant (un auvent), un guichet où l'on achète, les armes au mur, des bois
// de cerf, des peaux, un tas de bûches. Son +z local regarde la clairière.
function cabane(m, groupe, y) {
  const C = CABANE_CHASSEUR;
  const p = atelier(C, C.ry, y);
  const L = 4.4, P = 3.6, H = 2.3;
  m.pierre.push(p(new THREE.BoxGeometry(L + 0.3, 0.9, P + 0.3), { y: -0.2 }, PIERRES[1], 0.1));
  // Rondins empilés, qui dépassent aux angles. Devant, un guichet ouvert.
  for (let k = 0; k < 8; k++) {
    const h = 0.4 + k * 0.28;
    for (const f of [-1, 1]) {
      m.bois.push(p(new THREE.CylinderGeometry(0.15, 0.15, P + 0.5, 7), { x: f * L / 2, y: h + 0.14, rx: Math.PI / 2 }, RONDINS[(k + (f > 0 ? 1 : 0)) % 3], 0.1));
    }
    m.bois.push(p(new THREE.CylinderGeometry(0.15, 0.15, L + 0.5, 7), { z: -P / 2, y: h, rz: Math.PI / 2 }, RONDINS[k % 3], 0.1));
    // Façade : pleine sous le guichet et au-dessus, porte à gauche.
    if (k < 3 || k > 5) m.bois.push(p(new THREE.CylinderGeometry(0.15, 0.15, L - 1.2, 7), { x: 0.6, z: P / 2, y: h, rz: Math.PI / 2 }, RONDINS[(k + 2) % 3], 0.1));
    else for (const x of [-0.25, 1.95]) m.bois.push(p(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 7), { x, z: P / 2, y: h, rz: Math.PI / 2 }, RONDINS[k % 3], 0.1));
  }
  // Le fond sombre du guichet, la tablette où l'on pose l'argent.
  m.pierre.push(p(new THREE.BoxGeometry(1.7, 0.85, 0.05), { x: 0.85, y: 1.6, z: P / 2 - 0.2 }, '#1b1612'));
  m.bois.push(p(new THREE.BoxGeometry(1.9, 0.08, 0.6), { x: 0.85, y: 1.18, z: P / 2 + 0.2 }, BOIS[2]));
  m.bois.push(p(new THREE.BoxGeometry(0.9, 1.9, 0.08), { x: -1.55, y: 1.25, z: P / 2 + 0.05 }, '#4a3020', 0.05));
  // Le toit : deux pans de planches, l'un débordant sur le devant.
  for (const f of [-1, 1]) {
    const demi = P / 2 + (f > 0 ? 1.2 : 0.4);
    m.tuiles.push(p(new THREE.BoxGeometry(L + 0.9, 0.14, demi / Math.cos(0.5)), { y: 2.9 + (Math.tan(0.5) * demi) / 2 - (f > 0 ? 0.35 : 0), z: (f * demi) / 2, rx: f * 0.5 }, f > 0 ? '#5a4632' : '#4e3d2b', 0.12));
  }
  for (const f of [-1, 1]) m.bois.push(p(new THREE.BoxGeometry(0.1, 0.9, 1.2), { x: f * (L / 2 + 0.05), y: 2.9, rz: 0 }, RONDINS[1]));
  for (const x of [-L / 2 - 0.1, L / 2 + 0.1]) m.bois.push(p(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 6), { x, y: 1.2, z: P / 2 + 1.1 }, RONDINS[0]));
  m.pierre.push(p(new THREE.BoxGeometry(0.7, 3.8, 0.7), { x: -L / 2 + 0.6, y: 2.4, z: -P / 2 + 0.2 }, PIERRES[3], 0.08));
  // Bois de cerf au-dessus de la porte, peaux tendues sur le mur.
  m.pierre.push(p(new THREE.BoxGeometry(0.25, 0.3, 0.2), { x: -1.55, y: 2.45, z: P / 2 + 0.2 }, '#e0d6bd'));
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) m.pierre.push(p(new THREE.CylinderGeometry(0.02, 0.035, 0.45 - k * 0.1, 4), { x: -1.55 + s * (0.18 + k * 0.08), y: 2.7 + k * 0.1, z: P / 2 + 0.22, rz: -s * (0.5 + k * 0.3) }, '#e0d6bd'));
  }
  m.tissu.push(p(new THREE.PlaneGeometry(0.8, 1.1), { x: 2.3, y: 1.5, z: 0.9, ry: Math.PI / 2 }, '#8a6242', 0.08));
  m.tissu.push(p(new THREE.PlaneGeometry(0.7, 0.9), { x: -2.3, y: 1.4, z: -0.4, ry: -Math.PI / 2 }, '#6e4c34', 0.08));
  // Les vivres : pommes et marmite sur la tablette, jambons pendus.
  for (let i = 0; i < 6; i++) m.paille.push(p(new THREE.IcosahedronGeometry(0.075, 0), { x: 0.3 + Math.cos(i) * 0.1, y: 1.28 + (i % 2) * 0.05, z: P / 2 + 0.25 + Math.sin(i) * 0.1 }, '#b8261f', 0.15));
  m.fer.push(p(new THREE.CylinderGeometry(0.2, 0.17, 0.22, 10), { x: 1.4, y: 1.33, z: P / 2 + 0.25 }, '#3a3a3e'));
  for (const x of [0.4, 1.3]) m.paille.push(p(new THREE.IcosahedronGeometry(0.14, 0), { x, y: 2.3, z: P / 2 + 0.55, sy: 1.5 }, '#9a4a32', 0.1));
  // Bûches et billot à côté.
  for (let rang = 0; rang < 3; rang++) {
    for (let k = 0; k < 4 - rang; k++) m.bois.push(p(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 7), { x: L / 2 + 0.45, y: 0.12 + rang * 0.22, z: -1.2 + k * 0.26 + rang * 0.13, rx: 0, rz: 0 }, RONDINS[(k + rang) % 3], 0.12));
  }
  const panneau = enseigne('ARMURERIE', 2, 0.62);
  const v = (x, h, z) => new THREE.Vector3(x, h, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), C.ry);
  const q = v(0.85, 2.35, P / 2 + 0.2);
  panneau.position.set(C.x + q.x, y + q.y, C.z + q.z);
  panneau.rotation.y = C.ry;
  groupe.add(panneau);
  // Les armes en vente, accrochées au fond du guichet.
  for (const [id, h, dx] of [['fusil', 1.85, 0.85], ['uzi', 1.45, 0.3], ['lance', 1.45, 1.4]]) {
    const arme = creerModeleArme(id);
    const w = v(dx, h, P / 2 - 0.12);
    arme.position.set(C.x + w.x, y + w.y, C.z + w.z);
    arme.rotation.y = C.ry - Math.PI / 2;
    arme.scale.setScalar(1.1);
    groupe.add(arme);
  }
  // Une lanterne sous l'auvent, et sa lampe.
  const l = v(0.85, 2.45, P / 2 + 0.75);
  const lampe = new THREE.PointLight('#ffcf85', 9, 12, 1.5);
  lampe.position.set(C.x + l.x, y + l.y, C.z + l.z);
  const ampoule = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: lumineux('#ffd98a', 8) }));
  ampoule.position.copy(lampe.position);
  groupe.add(ampoule, lampe);
}

// Le feu de camp : un cercle de pierres, des bûches, une broche sur deux
// fourches, des rondins pour s'asseoir. Rend le foyer de ses flammes.
function feuDeCamp(m, y) {
  const { x, z } = FEU;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    m.pierre.push(colorer(place(new THREE.IcosahedronGeometry(0.18, 0), { x: x + Math.cos(a) * 0.6, y: y + 0.06, z: z + Math.sin(a) * 0.6, sy: 0.7 }), PIERRES[k % 5], 0.1));
  }
  for (let k = 0; k < 4; k++) {
    const a = k * 1.6;
    m.bois.push(colorer(place(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 5), { x: x + Math.cos(a) * 0.15, y: y + 0.18, z: z + Math.sin(a) * 0.15, rz: Math.PI / 2 - 0.5, ry: a }), RONDINS[k % 3]));
  }
  m.braises.push(place(new THREE.CylinderGeometry(0.35, 0.4, 0.05, 8), { x, y: y + 0.04, z }));
  for (const s of [-1, 1]) m.bois.push(colorer(place(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), { x: x + s * 0.8, y: y + 0.55, z }), BOIS[0]));
  m.bois.push(colorer(place(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 4), { x, y: y + 1.1, z, rz: Math.PI / 2 }), BOIS[2]));
  m.fer.push(colorer(place(new THREE.CylinderGeometry(0.15, 0.12, 0.2, 8), { x, y: y + 0.85, z }), '#3a3a3e'));
  for (const [a, l] of [[0.6, 1.4], [2.4, 1.2], [4.2, 1.3]]) {
    const bx = x + Math.cos(a) * 2.2, bz = z + Math.sin(a) * 2.2;
    m.bois.push(colorer(place(new THREE.CylinderGeometry(0.2, 0.2, l, 7), { x: bx, y: relief(bx, bz) + 0.15, z: bz, rz: Math.PI / 2, ry: -a + Math.PI / 2 }), RONDINS[1], 0.1));
  }
  return [x, y + 0.1, z, 3];
}

// Une pierre levée, taillée en biseau, gravée de runes qui luisent.
function menhir(m, runes, o, y) {
  const t = o.taille ?? 1;
  const p = atelier(o, -o.ry + Math.PI / 2, y);
  m.pierre.push(p(new THREE.CylinderGeometry(0.28 * t, 0.48, 2.6 * t, 5), { y: 1.1 * t, rz: 0.05 }, MOUSSUS[Math.floor(hachage(o.x, o.z) * 3)], 0.1));
  m.feuilles.push(p(new THREE.IcosahedronGeometry(0.4, 0), { y: 0.25, x: 0.1, sy: 0.4, sx: 1.2 }, '#3f5a2a', 0.15));
  for (let k = 0; k < 3; k++) runes.push(p.nu(new THREE.BoxGeometry(0.2 - k * 0.04, 0.06, 0.04), { y: (1.2 + k * 0.35) * t, z: 0.36 - k * 0.04 }));
}

export function creerForet() {
  const groupe = new THREE.Group();
  const m = matieres();
  const runes = [], champignons = [];
  groupe.add(creerSol({ relief, demi: BORNE_FORET + 36, n: 100, teinte }));

  cabane(m, groupe, assise(relief, CABANE_CHASSEUR.x, CABANE_CHASSEUR.z, 2.3, 2.3));
  const foyers = [feuDeCamp(m, relief(FEU.x, FEU.z))];
  for (const o of FORET.obstacles) {
    const y = relief(o.x, o.z);
    if (o.genre === 'rocher') rocher(m, o, y, MOUSSUS, true);
    else if (o.genre === 'tronc') tronc(m, o, y);
    else if (o.genre === 'menhir') menhir(m, runes, o, y);
  }
  // L'étang : une eau noire et lisse, des nénuphars, des roseaux.
  const niveau = relief(ETANG.x + ETANG.rayon, ETANG.z) - 0.25;
  const eau = new THREE.Mesh(new THREE.CircleGeometry(ETANG.rayon + 0.6, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
    color: '#1d3a44', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.9,
  }));
  eau.position.set(ETANG.x, niveau, ETANG.z);
  eau.receiveShadow = true;
  groupe.add(eau);
  for (let k = 0; k < 14; k++) {
    const a = hachage(k, 3) * Math.PI * 2, r = 1 + hachage(k, 5) * (ETANG.rayon - 1.5);
    m.feuilles.push(colorer(place(new THREE.CircleGeometry(0.28 + hachage(k, 7) * 0.15, 7).rotateX(-Math.PI / 2), { x: ETANG.x + Math.cos(a) * r, y: niveau + 0.02, z: ETANG.z + Math.sin(a) * r, ry: k }), '#3f6a2a', 0.15));
    if (k % 4 === 0) m.paille.push(colorer(place(new THREE.IcosahedronGeometry(0.07, 0), { x: ETANG.x + Math.cos(a) * r, y: niveau + 0.08, z: ETANG.z + Math.sin(a) * r }), '#f4f1de'));
  }
  for (let k = 0; k < 70; k++) {
    const a = hachage(k, 11) * Math.PI * 2, r = ETANG.rayon + (hachage(k, 13) - 0.5) * 1.2;
    const x = ETANG.x + Math.cos(a) * r, z = ETANG.z + Math.sin(a) * r;
    const h = 0.9 + hachage(k, 17) * 0.8;
    m.feuilles.push(colorer(place(new THREE.ConeGeometry(0.03, h, 3), { x, y: relief(x, z) + h / 2 - 0.1, z, rx: (hachage(k, 19) - 0.5) * 0.3 }), k % 3 ? '#5a6a2e' : '#7a7a3a'));
    if (k % 5 === 0) m.bois.push(colorer(place(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 5), { x, y: relief(x, z) + h - 0.05, z }), '#5a3a22'));
  }
  // Champignons au pied des arbres ; près du cercle de pierres, ils luisent.
  for (let k = 0; k < 120; k++) {
    const x = (hachage(k, 23) * 2 - 1) * BORNE_FORET, z = (hachage(k, 29) * 2 - 1) * BORNE_FORET;
    if (dansObstacle(FORET, x, z, 0.2) || Math.hypot(x, z) < 4) continue;
    const y = relief(x, z);
    const luit = Math.hypot(x - AUTEL_FORET.x, z - AUTEL_FORET.z) < 14 || hachage(k, 31) < 0.2;
    for (let c = 0; c < 3; c++) {
      const cx = x + (hachage(k, c) - 0.5) * 0.4, cz = z + (hachage(c, k) - 0.5) * 0.4, h = 0.1 + hachage(k + c, 3) * 0.12;
      m.platre.push(colorer(place(new THREE.CylinderGeometry(0.025, 0.03, h, 5), { x: cx, y: y + h / 2, z: cz }), '#e8dfc8'));
      const chapeau = place(new THREE.SphereGeometry(0.07 + h * 0.3, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), { x: cx, y: y + h, z: cz, sy: 0.6 });
      if (luit) champignons.push(chapeau);
      else m.paille.push(colorer(chapeau, k % 2 ? '#b8261f' : '#9a6a3a', 0.1));
    }
  }
  // Fougères : des frondes en éventail.
  for (let k = 0; k < 150; k++) {
    const x = (hachage(k, 37) * 2 - 1) * BORNE_FORET, z = (hachage(k, 41) * 2 - 1) * BORNE_FORET;
    if (dansObstacle(FORET, x, z, 0.4) || Math.hypot(x, z) < CLAIRIERE - 3 || versAutel(x, z) < 1.8) continue;
    const y = relief(x, z), s = 0.7 + hachage(k, 43) * 0.6;
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2 + k;
      m.feuilles.push(colorer(place(new THREE.PlaneGeometry(0.22 * s, 0.9 * s), { x: x + Math.cos(a) * 0.3 * s, y: y + 0.28 * s, z: z + Math.sin(a) * 0.3 * s, ry: -a + Math.PI / 2, rx: 1.0 }), f % 2 ? '#3f6a2a' : '#4a7a30', 0.12));
    }
  }

  // Végétation : les arbres de la carte, sous-bois, herbe de la clairière, la
  // forêt au-delà.
  const plantes = arbresDeCarte(FORET.obstacles, relief, true);
  for (let i = -50; i <= 50; i++) {
    for (let j = -50; j <= 50; j++) {
      const x = i * 0.8 + (hachage(i, j) - 0.5) * 0.8, z = j * 0.8 + (hachage(j + 13, i) - 0.5) * 0.8;
      if (Math.max(Math.abs(x), Math.abs(z)) > BORNE_FORET + 3 || dansObstacle(FORET, x, z, 0.3) || versAutel(x, z) < 1.2) continue;
      const r = Math.hypot(x, z);
      const clairiere = r < CLAIRIERE;
      if (hachage(i * 2.3, j * 1.9) > (clairiere ? 0.5 : 0.22) || Math.hypot(x - FEU.x, z - FEU.z) < 2) continue;
      plantes.push({ espece: clairiere ? (hachage(j, i) > 0.3 ? 'herbe' : 'herbeSombre') : 'herbeSombre', x, y: relief(x, z) - 0.03, z, rotation: hachage(i, j + 3) * 6.3, echelle: 0.7 + hachage(j, i + 1) * 0.7, teinte: 0.75 + hachage(i + 9, j) * 0.3 });
    }
  }
  for (let k = 0; k < 110; k++) {
    const x = (hachage(k, 51) * 2 - 1) * BORNE_FORET, z = (hachage(k, 53) * 2 - 1) * BORNE_FORET;
    if (Math.hypot(x, z) < CLAIRIERE || dansObstacle(FORET, x, z, 0.6) || versAutel(x, z) < 2) continue;
    plantes.push({ espece: k % 3 ? 'buissonSombre' : 'buisson', x, y: relief(x, z) - 0.1, z, rotation: k * 2.3, echelle: 0.6 + hachage(k, 55) * 0.7, teinte: 0.75 + hachage(k, 57) * 0.25 });
  }
  const loin = foretLointaine(BORNE_FORET, relief, { n: 700, loin: 32, graine: 7, especes: ['sapin', 'sapin', 'sapin', 'feuilluSombre'] });
  groupe.add(creerVegetation(plantes), creerVegetation(loin, { ombres: false }));

  const matRunes = new THREE.MeshBasicMaterial({ color: lumineux('#9a7bff', 1.4), fog: false });
  const matChampignons = new THREE.MeshBasicMaterial({ color: lumineux('#5ad7ff', 1.8), fog: false });
  const feux = creerFeux(foyers, 12);
  // La lueur du feu de camp, qui danse.
  const lueur = new THREE.PointLight('#ff9a4a', 10, 16, 1.6);
  lueur.position.set(FEU.x, relief(FEU.x, FEU.z) + 1.2, FEU.z);
  const vie = [
    creerLucioles(90, (i) => {
      const autour = i % 3 === 0 ? ETANG : i % 3 === 1 ? { x: 0, z: 0 } : AUTEL_FORET;
      const a = hachage(i, 40) * Math.PI * 2, r = 2 + hachage(40, i) * 9;
      const x = autour.x + Math.cos(a) * r, z = autour.z + Math.sin(a) * r;
      return [x, relief(x, z) + 0.5 + hachage(i, 2) * 1.6, z];
    }),
    creerBrume({ n: 44, rayon: BORNE_FORET, carre: true, sol: relief, opacite: 0.8 }),
  ];
  const autel = creerAutel(FORET.autel, relief(FORET.autel.x, FORET.autel.z));
  groupe.add(
    ...fusionnerMatieres(m), new THREE.Mesh(fusionnerPositions(runes), matRunes), new THREE.Mesh(fusionnerPositions(champignons), matChampignons),
    feux, lueur, ...vie, autel,
  );

  let temps = 0;
  groupe.userData.autel = autel;
  groupe.userData.animer = (dt, nuit) => {
    temps += dt;
    feux.userData.animer(dt, nuit);
    for (const v of vie) v.userData.animer(dt, nuit);
    autel.userData.animer(dt, nuit);
    lueur.intensity = 8 + Math.sin(temps * 9) * 1.2 + Math.sin(temps * 13.7) * 0.8;
    const lueurChampignons = 1.2 + 1.2 * nuit + Math.sin(temps * 1.3) * 0.2;
    matChampignons.color.set('#5ad7ff').multiplyScalar(lueurChampignons);
  };
  return groupe;
}
