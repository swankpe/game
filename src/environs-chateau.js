// Ce qui fait vivre la cour du château (marché, forge, mannequins, table,
// sacs, bûches, braseros, jardinières) et ce qui l'entoure (champ d'herbes
// hautes, forêt de sapins, chemins bordés de clôtures, village aux fenêtres
// éclairées, moulin, chapelle). Au-delà des bornes de la carte, rien ne
// bloque : c'est un décor qu'on ne peut pas atteindre.

import * as THREE from 'three';
import { BORNE, COUR, EPAISSEUR_MUR, OBSTACLES } from './chateau.js';
import { colorer, fusionner, hachage, place } from './geometrie.js';
import { creerVegetation } from './vegetation.js';

const EXT = COUR + EPAISSEUR_MUR;
const BOIS = ['#6b4a33', '#7a5638', '#5e412c'];
const PIERRES = ['#8b857a', '#7f796f', '#958f84', '#77726a'];
const FER = '#2c2e33';
const TOILE = '#cbbd94';
const JUTE = ['#a08a60', '#8e7a52', '#b09a6a'];
const PLATRE = ['#e8dfc8', '#ddd2b8', '#efe6d2'];
const TUILES = ['#8a3a2a', '#7a3426', '#94442e'];
const FLEURS = ['#e84a5f', '#ffd166', '#f4f1de', '#b388eb', '#ff8c42'];

// Applique une matrice (position, rotation y, échelle) à une géométrie.
const poser = (geo, x, y, z, ry = 0, s = 1) => geo.applyMatrix4(new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s),
));

// Un fabricant de pièces dans un repère local (x, z, ry) : on construit
// l'objet autour de (0, 0), il est posé ensuite.
function atelier(o, ry = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(o.x, 0, o.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
  return (geo, pos, couleur, variation = 0.08) => colorer(place(geo, pos).applyMatrix4(m), couleur, variation);
}

function citrouille(p, x, y, z, s = 1) {
  const orange = ['#d9792a', '#c8651f', '#e58a36'];
  return [
    p(new THREE.IcosahedronGeometry(0.22 * s, 1), { x, y: y + 0.15 * s, z, sy: 0.7 }, orange[Math.floor(hachage(x, z) * 3)], 0.12),
    p(new THREE.CylinderGeometry(0.02 * s, 0.03 * s, 0.1 * s, 4), { x, y: y + 0.32 * s, z, rz: 0.3 }, '#4d6a2a'),
  ];
}

// Le marché : un étal sous une toile rayée, des citrouilles, des paniers de
// pommes, des choux, des sacs.
function marche(m, o) {
  const p = atelier(o, 0.3);
  for (const [a, b] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) m.bois.push(p(new THREE.BoxGeometry(0.1, 2.5 + (b < 0 ? 0.3 : 0), 0.1), { x: a, y: 1.25 + (b < 0 ? 0.15 : 0), z: b }, BOIS[0]));
  for (let k = 0; k < 6; k++) m.tissu.push(p(new THREE.BoxGeometry(3.1, 0.04, 0.38), { x: 0, y: 2.62 + (2.5 - k) * 0.06, z: -1.05 + k * 0.38 + 0.12, rx: 0.16 }, k % 2 ? '#e8dcc0' : '#2f5a8a'));
  // Lambrequin festonné sur le devant.
  for (let k = 0; k < 8; k++) m.tissu.push(p(new THREE.ConeGeometry(0.2, 0.25, 3), { x: -1.4 + k * 0.4, y: 2.35, z: 1.2, rx: Math.PI }, k % 2 ? '#e8dcc0' : '#2f5a8a'));
  m.bois.push(p(new THREE.BoxGeometry(2.5, 0.08, 1.1), { y: 0.9, z: 0.1 }, BOIS[1]));
  for (const [a, b] of [[-1.15, -0.4], [1.15, -0.4], [-1.15, 0.6], [1.15, 0.6]]) m.bois.push(p(new THREE.BoxGeometry(0.08, 0.9, 0.08), { x: a, y: 0.45, z: b }, BOIS[2]));
  m.paille.push(...citrouille(p, -0.8, 0.94, 0.2), ...citrouille(p, -0.35, 0.94, 0.35, 0.8), ...citrouille(p, 1.6, 0, 1.1, 1.3), ...citrouille(p, 1.9, 0, 0.5));
  // Paniers de pommes et de choux.
  for (const [k, [x, couleur]] of [[0.2, '#b8261f'], [0.75, '#6b9a3a']].entries()) {
    m.bois.push(p(new THREE.CylinderGeometry(0.24, 0.18, 0.2, 8, 1, true), { x, y: 1.04, z: 0.15 }, '#a07844'));
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + k;
      m.paille.push(p(new THREE.IcosahedronGeometry(k ? 0.1 : 0.065, 0), { x: x + Math.cos(a) * 0.1, y: 1.13 + (i % 2) * 0.05, z: 0.15 + Math.sin(a) * 0.1 }, couleur, 0.15));
    }
  }
  for (const [i, [x, z]] of [[-1.7, -0.3], [-1.9, 0.3]].entries()) {
    m.paille.push(p(new THREE.IcosahedronGeometry(0.3, 1), { x, y: 0.28, z, sx: 0.9, sy: 1.1, sz: 0.8 }, JUTE[i], 0.1));
  }
}

// La forge : un foyer de pierre aux braises vives, une hotte et sa cheminée,
// une enclume, un soufflet, un baquet. Rend le point d'où montent les braises.
function forge(m, o) {
  const p = atelier(o, Math.PI / 2);
  m.pierre.push(p(new THREE.BoxGeometry(2.2, 0.9, 1.4), { y: 0.45 }, PIERRES[1], 0.1));
  m.braises.push(p(new THREE.BoxGeometry(1.3, 0.08, 0.8), { y: 0.93 }, '#ffffff'));
  for (let k = 0; k < 7; k++) m.pierre.push(p(new THREE.IcosahedronGeometry(0.12, 0), { x: -0.5 + k * 0.17, y: 0.95, z: (hachage(k, 2) - 0.5) * 0.5, sy: 0.5 }, '#2a2420'));
  m.pierre.push(p(new THREE.CylinderGeometry(0.45, 1.15, 1.2, 4), { y: 2.15, ry: Math.PI / 4 }, PIERRES[3], 0.08));
  m.pierre.push(p(new THREE.BoxGeometry(0.75, 2.6, 0.75), { y: 4, z: 0 }, PIERRES[0], 0.08));
  for (const a of [-1, 1]) m.pierre.push(p(new THREE.BoxGeometry(0.2, 0.9, 1.2), { x: a * 1.0, y: 1.35 }, PIERRES[2]));
  // Enclume sur son billot.
  m.bois.push(p(new THREE.CylinderGeometry(0.28, 0.32, 0.55, 8), { x: 1.9, y: 0.28, z: 0.2 }, BOIS[2], 0.1));
  m.fer.push(p(new THREE.BoxGeometry(0.55, 0.18, 0.25), { x: 1.9, y: 0.66, z: 0.2 }, FER));
  m.fer.push(p(new THREE.ConeGeometry(0.1, 0.3, 5), { x: 2.28, y: 0.68, z: 0.2, rz: -Math.PI / 2 }, FER));
  m.fer.push(p(new THREE.BoxGeometry(0.3, 0.16, 0.18), { x: 1.9, y: 0.49, z: 0.2 }, FER));
  // Marteau posé, soufflet, baquet d'eau.
  m.bois.push(p(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), { x: 1.85, y: 0.8, z: 0.05, rz: Math.PI / 2, ry: 0.4 }, BOIS[1]));
  m.fer.push(p(new THREE.BoxGeometry(0.1, 0.07, 0.07), { x: 2.02, y: 0.8, z: -0.02, ry: 0.4 }, FER));
  m.bois.push(p(new THREE.BoxGeometry(0.5, 0.2, 0.7), { x: -1.4, y: 0.75, z: -0.2, rz: 0.15 }, '#5a3a24'));
  m.fer.push(p(new THREE.ConeGeometry(0.06, 0.5, 5), { x: -1.05, y: 0.8, z: -0.2, rz: Math.PI / 2 }, FER));
  m.bois.push(p(new THREE.CylinderGeometry(0.35, 0.32, 0.6, 9), { x: -1.4, y: 0.3, z: 0.7 }, BOIS[1], 0.1));
  m.fer.push(p(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 9), { x: -1.4, y: 0.45, z: 0.7 }, FER));
  m.fer.push(p(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 9), { x: -1.4, y: 0.58, z: 0.7 }, '#3a5a7a'));
  // Outils accrochés.
  for (let k = 0; k < 3; k++) {
    m.bois.push(p(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), { x: -0.5 + k * 0.5, y: 1.55, z: 0.75 }, BOIS[1]));
    m.fer.push(p(new THREE.BoxGeometry(0.12, 0.08, 0.03), { x: -0.5 + k * 0.5, y: 1.2, z: 0.75 }, FER));
  }
  return [o.x, 1.0, o.z];
}

// Mannequin d'entraînement : un poteau, un corps de paille, une tête de toile,
// une cible peinte sur la poitrine.
function mannequin(m, o, i) {
  const p = atelier(o, -0.4 + i * 0.7);
  m.bois.push(p(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 6), { y: 0.95 }, BOIS[0]));
  m.bois.push(p(new THREE.BoxGeometry(1.1, 0.07, 0.07), { y: 1.45 }, BOIS[1]));
  m.paille.push(p(new THREE.CylinderGeometry(0.2, 0.24, 0.8, 8), { y: 1.2 }, '#d1b064', 0.15));
  m.paille.push(p(new THREE.IcosahedronGeometry(0.17, 1), { y: 1.78 }, TOILE, 0.08));
  m.tissu.push(p(new THREE.CylinderGeometry(0.21, 0.23, 0.05, 8), { y: 0.95 }, '#5a3a24'));
  for (const [k, [r, c]] of [[0.17, '#c8453a'], [0.11, '#f5f2ea'], [0.05, '#c8453a']].entries()) {
    m.tissu.push(p(new THREE.CylinderGeometry(r, r, 0.01, 12), { y: 1.25, z: 0.215 + k * 0.004, rx: Math.PI / 2 }, c));
  }
  // Des flèches plantées.
  for (let k = 0; k < 2; k++) m.bois.push(p(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 3), { x: -0.05 + k * 0.1, y: 1.3 - k * 0.12, z: 0.35, rx: Math.PI / 2 + 0.2 }, '#c9b07a'));
}

// Table de banquet : plateau, bancs, chopes et écuelles, une bougie.
function table(m, o) {
  const p = atelier(o, 0.15);
  m.bois.push(p(new THREE.BoxGeometry(2.3, 0.07, 0.9), { y: 0.78 }, BOIS[1], 0.1));
  for (const [a, b] of [[-1, -0.35], [1, -0.35], [-1, 0.35], [1, 0.35]]) m.bois.push(p(new THREE.BoxGeometry(0.08, 0.76, 0.08), { x: a, y: 0.38, z: b }, BOIS[2]));
  for (const b of [-0.75, 0.75]) {
    m.bois.push(p(new THREE.BoxGeometry(2.2, 0.06, 0.3), { y: 0.45, z: b }, BOIS[0], 0.1));
    for (const a of [-0.9, 0.9]) m.bois.push(p(new THREE.BoxGeometry(0.06, 0.44, 0.24), { x: a, y: 0.22, z: b }, BOIS[2]));
  }
  for (let k = 0; k < 4; k++) {
    const x = -0.8 + k * 0.52, z = k % 2 ? 0.22 : -0.2;
    m.bois.push(p(new THREE.CylinderGeometry(0.05, 0.045, 0.12, 7), { x, y: 0.88, z }, '#7a5638'));
    m.fer.push(p(new THREE.CylinderGeometry(0.1, 0.08, 0.02, 9), { x: x + 0.2, y: 0.83, z: -z }, '#8a8f96'));
  }
  m.paille.push(p(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), { y: 0.88 }, '#efe6d2'));
  m.braises.push(p(new THREE.ConeGeometry(0.02, 0.05, 4), { y: 0.97 }, '#ffffff'));
}

function sacs(m, o) {
  const p = atelier(o);
  for (const [k, [x, y, z, ry]] of [[0, 0.3, 0, 0], [0.55, 0.3, 0.15, 0.6], [-0.5, 0.3, 0.2, 1.2], [0.1, 0.3, -0.5, 2], [0.2, 0.78, -0.1, 0.4]].entries()) {
    m.paille.push(p(new THREE.IcosahedronGeometry(0.3, 1), { x, y, z, sx: 0.85, sy: 1, sz: 0.75, ry }, JUTE[k % 3], 0.1));
    m.paille.push(p(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 5), { x, y: y + 0.3, z }, JUTE[(k + 1) % 3]));
  }
}

// Bûcher : des rondins empilés, un billot et sa hache.
function buches(m, o) {
  const p = atelier(o, 0.5);
  for (let rang = 0; rang < 3; rang++) {
    for (let k = 0; k < 5 - rang; k++) {
      m.bois.push(p(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 7), { x: -0.45 + k * 0.23 + rang * 0.115, y: 0.11 + rang * 0.2, rx: Math.PI / 2 }, ['#7a5a3c', '#6a4a30', '#8a6a48'][(k + rang) % 3], 0.12));
    }
  }
  m.bois.push(p(new THREE.CylinderGeometry(0.28, 0.3, 0.45, 9), { x: 1.1, y: 0.22, z: 0.3 }, '#8a6a48', 0.1));
  m.bois.push(p(new THREE.CylinderGeometry(0.02, 0.025, 0.75, 5), { x: 1.1, y: 0.7, z: 0.3, rz: 0.4 }, BOIS[1]));
  m.fer.push(p(new THREE.BoxGeometry(0.2, 0.14, 0.03), { x: 1.02, y: 0.48, z: 0.3, rz: 0.4 }, '#8a8f96'));
}

// Brasero sur trépied, rempli de charbons ardents.
function brasero(m, o) {
  const p = atelier(o);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    m.fer.push(p(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 4), { x: Math.cos(a) * 0.2, y: 0.45, z: Math.sin(a) * 0.2, rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3 }, FER));
  }
  m.fer.push(p(new THREE.CylinderGeometry(0.38, 0.22, 0.28, 9, 1, true), { y: 1.0 }, FER));
  m.fer.push(p(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 9), { y: 0.87 }, FER));
  m.braises.push(p(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 9), { y: 1.06 }, '#ffffff'));
  return [o.x, 1.1, o.z];
}

// Jardinières au pied des murs : une caisse de bois, des feuilles, des fleurs.
function jardinieres(m) {
  const places = [[-5, -COUR + 0.3, 0], [5, COUR - 0.3, 0], [9, COUR - 0.3, 0], [COUR - 0.3, -9, Math.PI / 2], [COUR - 0.3, 13, Math.PI / 2], [-COUR + 0.3, 3, Math.PI / 2]];
  for (const [i, [x, z, ry]] of places.entries()) {
    const p = atelier({ x, z }, ry);
    m.bois.push(p(new THREE.BoxGeometry(1.4, 0.4, 0.5), { y: 0.2 }, BOIS[1], 0.1));
    for (let k = 0; k < 9; k++) {
      const dx = -0.55 + k * 0.14;
      m.feuilles.push(p(new THREE.IcosahedronGeometry(0.1, 0), { x: dx, y: 0.45 + hachage(k, i) * 0.08, z: (hachage(i, k) - 0.5) * 0.25 }, '#4a6b30', 0.15));
      if (k % 2) m.paille.push(p(new THREE.IcosahedronGeometry(0.05, 0), { x: dx, y: 0.56, z: (hachage(k + 3, i) - 0.5) * 0.2 }, FLEURS[(i + k) % FLEURS.length], 0.1));
    }
  }
}

// Meuble la cour : m rassemble les listes de pièces par matière (pierre,
// bois, fer, tissu, paille, feuilles, braises). Rend les foyers (braises qui
// montent) et les flammes à allumer.
export function meublerCour(m) {
  const foyers = [], flammes = [];
  let n = 0;
  for (const o of OBSTACLES) {
    if (o.genre === 'marche') marche(m, o);
    else if (o.genre === 'forge') foyers.push(forge(m, o));
    else if (o.genre === 'mannequin') mannequin(m, o, n++);
    else if (o.genre === 'table') table(m, o);
    else if (o.genre === 'sacs') sacs(m, o);
    else if (o.genre === 'buches') buches(m, o);
    else if (o.genre === 'brasero') {
      const f = brasero(m, o);
      foyers.push(f);
      flammes.push(f);
    }
  }
  jardinieres(m);
  return { foyers, flammes };
}

// ——— Au-delà des murailles ———

// Les trois chemins partent des portes ; axe : (dx, dz) vers l'extérieur.
const CHEMINS = [{ dx: 0, dz: -1 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 }];
const LOIN = 78;
// Écart latéral d'un point au chemin le plus proche (au-delà de la cour).
function ecartChemin(x, z) {
  let e = Infinity;
  for (const c of CHEMINS) {
    const d = x * c.dx + z * c.dz;
    if (d < COUR - 1) continue;
    const lateral = x * c.dz - z * c.dx - serpente(d);
    e = Math.min(e, Math.abs(lateral));
  }
  return e;
}
// Le chemin serpente un peu, une fois sorti du champ.
const serpente = (d) => (d > 32 ? Math.sin((d - 32) * 0.09) * 2 : 0);

function creerChemins() {
  const positions = [], couleurs = [], indices = [];
  const c = new THREE.Color();
  for (const ch of CHEMINS) {
    const debut = positions.length / 3;
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const d = COUR + ((LOIN - COUR) * i) / n;
      const off = serpente(d);
      for (const [k, l] of [-2.2, -1.2, 0, 1.2, 2.2].entries()) {
        const lat = l + off;
        const x = ch.dx * d + ch.dz * lat, z = ch.dz * d - ch.dx * lat;
        positions.push(x, 0.015 + (k === 0 || k === 4 ? -0.01 : 0), z);
        // Terre battue, deux ornières plus sombres, bords qui se fondent dans l'herbe.
        c.set(k === 1 || k === 3 ? '#5a4430' : '#6e5638').multiplyScalar(0.9 + hachage(i, k) * 0.2);
        if (k === 0 || k === 4) c.lerp(new THREE.Color('#3a4a2a'), 0.6);
        couleurs.push(c.r, c.g, c.b);
      }
      if (i < n) {
        const b = debut + i * 5;
        for (let k = 0; k < 4; k++) indices.push(b + k, b + k + 1, b + k + 5, b + k + 1, b + k + 6, b + k + 5);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Le chemin est tracé dans un sens ou dans l'autre selon la porte : on le
  // dessine des deux côtés.
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  return m;
}

// Clôtures de part et d'autre des chemins, hors des bornes.
function clotures(bois) {
  for (const ch of CHEMINS) {
    for (const cote of [-3.2, 3.2]) {
      let precedent = null;
      for (let d = BORNE + 2; d < LOIN - 4; d += 2.6) {
        const lat = cote + serpente(d);
        const x = ch.dx * d + ch.dz * lat, z = ch.dz * d - ch.dx * lat;
        bois.push(colorer(place(new THREE.BoxGeometry(0.12, 1.1, 0.12), { x, y: 0.5, z, rz: (hachage(d, cote) - 0.5) * 0.15 }), BOIS[hachage(cote, d) > 0.5 ? 0 : 2], 0.1));
        if (precedent && hachage(d, cote * 3) > 0.12) {
          const [px, pz] = precedent;
          const l = Math.hypot(x - px, z - pz), a = Math.atan2(x - px, z - pz);
          for (const y of [0.4, 0.85]) bois.push(colorer(place(new THREE.BoxGeometry(0.06, 0.1, l), { x: (x + px) / 2, y, z: (z + pz) / 2, ry: a }), BOIS[1], 0.1));
        }
        precedent = [x, z];
      }
    }
  }
}

// Une maison à colombages : soubassement de pierre, murs de plâtre, poutres,
// toit à deux pans, cheminée, porte, fenêtres (certaines éclairées).
function maison(m, { x, z, ry, l = 5.5, p = 4.2, h = 3.2, chaume = false }, i) {
  const pose = (geo, pos, couleur, variation = 0.06) => colorer(poser(place(geo, pos), x, 0, z, ry), couleur, variation);
  m.pierre.push(pose(new THREE.BoxGeometry(l + 0.2, 0.6, p + 0.2), { y: 0.3 }, PIERRES[i % 4], 0.1));
  m.platre.push(pose(new THREE.BoxGeometry(l, h - 0.6, p), { y: 0.6 + (h - 0.6) / 2 }, PLATRE[i % 3], 0.04));
  // Colombages : poteaux, sablière, croix de Saint-André sur les pignons.
  for (const f of [-1, 1]) {
    for (let k = 0; k <= 4; k++) m.bois.push(pose(new THREE.BoxGeometry(0.14, h - 0.6, 0.05), { x: -l / 2 + (k * l) / 4, y: 0.6 + (h - 0.6) / 2, z: f * (p / 2 + 0.02) }, BOIS[0], 0.08));
    m.bois.push(pose(new THREE.BoxGeometry(l, 0.14, 0.05), { y: 1.9, z: f * (p / 2 + 0.02) }, BOIS[0], 0.08));
    m.bois.push(pose(new THREE.BoxGeometry(l, 0.14, 0.05), { y: h - 0.05, z: f * (p / 2 + 0.02) }, BOIS[0], 0.08));
    for (const s of [-1, 1]) m.bois.push(pose(new THREE.BoxGeometry(0.05, h - 0.8, 0.12), { x: f * (l / 2 + 0.02), y: 0.6 + (h - 0.6) / 2, rx: s * 0.6 }, BOIS[0], 0.08));
  }
  // Toit : deux pans débordants et les pignons triangulaires.
  const pente = 0.62, demi = p / 2 + 0.45;
  for (const f of [-1, 1]) {
    (chaume ? m.paille : m.tuiles).push(pose(new THREE.BoxGeometry(l + 0.8, 0.18, demi / Math.cos(pente)), {
      y: h + (Math.tan(pente) * demi) / 2 - 0.05, z: (f * demi) / 2, rx: f * pente,
    }, chaume ? '#b89a58' : TUILES[i % 3], 0.12));
  }
  const forme = new THREE.Shape();
  forme.moveTo(-p / 2, 0);
  forme.lineTo(p / 2, 0);
  forme.lineTo(0, Math.tan(pente) * (p / 2));
  forme.closePath();
  for (const f of [-1, 1]) m.platre.push(pose(new THREE.ExtrudeGeometry(forme, { depth: 0.1, bevelEnabled: false }), { x: f * (l / 2) - (f > 0 ? 0.1 : 0), y: h, ry: Math.PI / 2 }, PLATRE[(i + 1) % 3], 0.04));
  m.pierre.push(pose(new THREE.BoxGeometry(0.6, 1.6, 0.6), { x: l / 2 - 1, y: h + 1.2, z: -0.6 }, PIERRES[2], 0.08));
  // Porte au milieu de la façade (+z), fenêtres de part et d'autre, une à l'étage des pignons.
  m.bois.push(pose(new THREE.BoxGeometry(0.95, 1.9, 0.08), { y: 1.25, z: p / 2 + 0.04 }, '#4a3020', 0.05));
  m.fer.push(pose(new THREE.BoxGeometry(0.08, 0.08, 0.05), { x: 0.3, y: 1.25, z: p / 2 + 0.1 }, FER));
  const fenetres = [[-l / 4 - 0.3, 1.7, p / 2, 0], [l / 4 + 0.3, 1.7, p / 2, 0], [-l / 4, 1.7, -p / 2, Math.PI], [l / 2, h + 0.5, 0, Math.PI / 2]];
  for (const [k, [fx, fy, fz, fry]] of fenetres.entries()) {
    const allumee = hachage(i, k) > 0.35;
    const cadre = new THREE.BoxGeometry(0.8, 0.8, 0.08);
    m.bois.push(pose(cadre, { x: fx + Math.sin(fry) * 0.05, y: fy, z: fz + Math.cos(fry) * 0.05, ry: fry }, BOIS[2]));
    const vitre = poser(place(new THREE.BoxGeometry(0.6, 0.6, 0.1), { x: fx + Math.sin(fry) * 0.07, y: fy, z: fz + Math.cos(fry) * 0.07, ry: fry }), x, 0, z, ry);
    if (allumee) m.fenetres.push(vitre);
    else m.pierre.push(colorer(vitre, '#1a1c22'));
    // Meneaux en croix.
    m.bois.push(pose(new THREE.BoxGeometry(0.05, 0.62, 0.12), { x: fx + Math.sin(fry) * 0.08, y: fy, z: fz + Math.cos(fry) * 0.08, ry: fry }, BOIS[2]));
    m.bois.push(pose(new THREE.BoxGeometry(0.62, 0.05, 0.12), { x: fx + Math.sin(fry) * 0.08, y: fy, z: fz + Math.cos(fry) * 0.08, ry: fry }, BOIS[2]));
    if (fz > 0) m.feuilles.push(pose(new THREE.BoxGeometry(0.8, 0.14, 0.2), { x: fx, y: fy - 0.5, z: fz + 0.12 }, FLEURS[(i + k) % FLEURS.length], 0.2));
  }
  // Un tonneau près de la porte.
  m.bois.push(pose(new THREE.CylinderGeometry(0.32, 0.28, 0.8, 8), { x: 0.95, y: 0.4, z: p / 2 + 0.5 }, BOIS[1], 0.1));
}

// Le moulin : une tour de pierre, un toit conique, quatre ailes qui tournent.
function moulin(m, x, z) {
  m.pierre.push(colorer(place(new THREE.CylinderGeometry(2.1, 2.8, 9, 10), { x, y: 4.5, z }), PIERRES[0], 0.08));
  m.tuiles.push(colorer(place(new THREE.ConeGeometry(2.6, 2.8, 10), { x, y: 10.4, z }), '#5a3a2a', 0.1));
  m.bois.push(colorer(place(new THREE.BoxGeometry(1, 2, 0.1), { x, y: 1, z: z + 2.75, rx: -0.05 }), '#4a3020'));
  for (const y of [4, 6.5]) m.fenetres.push(place(new THREE.BoxGeometry(0.5, 0.7, 0.1), { x, y, z: z + 2.55 - (y - 4) * 0.08 }));
  const ailes = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const g = new THREE.BoxGeometry(0.2, 6, 0.12).translate(0, 3.2, 0).rotateZ(a);
    ailes.push(colorer(g, BOIS[0], 0.08));
    for (let j = 1; j < 6; j++) ailes.push(colorer(new THREE.BoxGeometry(1.3, 0.05, 0.05).translate(0.55, 0.6 + j, 0).rotateZ(a), BOIS[1]));
    ailes.push(colorer(new THREE.BoxGeometry(1.1, 5, 0.02).translate(0.65, 3.6, -0.04).rotateZ(a), '#d8cfb0', 0.05));
  }
  ailes.push(colorer(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8).rotateX(Math.PI / 2), BOIS[2]));
  const rotor = fusionner(ailes, { side: THREE.DoubleSide });
  rotor.position.set(x, 8.6, z + 2.9);
  return rotor;
}

// La chapelle : une nef, un clocher à flèche, une rosace éclairée.
function chapelle(m, x, z) {
  const pose = (geo, pos, couleur, v = 0.06) => colorer(poser(place(geo, pos), x, 0, z, -Math.PI / 2), couleur, v);
  m.pierre.push(pose(new THREE.BoxGeometry(5, 4.5, 9), { y: 2.25 }, PIERRES[2], 0.08));
  for (const f of [-1, 1]) m.tuiles.push(pose(new THREE.BoxGeometry(0.2, 3.6, 9.6), { x: f * 1.45, y: 5.6, rz: f * 0.9 }, '#3b4152', 0.1));
  m.pierre.push(pose(new THREE.BoxGeometry(2.4, 9, 2.4), { y: 4.5, z: 5.4 }, PIERRES[0], 0.08));
  m.tuiles.push(pose(new THREE.ConeGeometry(1.9, 4.5, 4), { y: 11.25, z: 5.4, ry: Math.PI / 4 }, '#3b4152', 0.1));
  m.fer.push(pose(new THREE.BoxGeometry(0.08, 1, 0.08), { y: 14, z: 5.4 }, '#b08a3a'));
  m.fer.push(pose(new THREE.BoxGeometry(0.5, 0.08, 0.08), { y: 14.2, z: 5.4 }, '#b08a3a'));
  m.fenetres.push(poser(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 12).rotateX(Math.PI / 2).translate(0, 5.8, 6.62), x, 0, z, -Math.PI / 2));
  for (const d of [-2.5, 0, 2.5]) for (const f of [-1, 1]) m.fenetres.push(poser(new THREE.BoxGeometry(0.1, 1.6, 0.5).translate(f * 2.52, 2.6, d), x, 0, z, -Math.PI / 2));
  m.bois.push(pose(new THREE.BoxGeometry(1.2, 2.2, 0.1), { y: 1.1, z: 6.62 }, '#4a3020'));
}

// Le village, la forêt, le champ : tout ce qui entoure les murailles.
// Rend { groupe, rotor } (rotor : les ailes du moulin, à faire tourner).
export function creerEnvirons() {
  const m = { pierre: [], platre: [], bois: [], fer: [], tuiles: [], paille: [], feuilles: [], fenetres: [] };
  const maisons = [
    { x: 9, z: 42, ry: -Math.PI / 2 }, { x: -9.5, z: 47, ry: Math.PI / 2, chaume: true }, { x: 9.5, z: 55, ry: -Math.PI / 2, l: 6.5 },
    { x: -9.5, z: 60, ry: Math.PI / 2 }, { x: -44, z: 9.5, ry: Math.PI }, { x: -53, z: -9.5, ry: 0, chaume: true },
    { x: -62, z: 10, ry: Math.PI, l: 6.5 }, { x: 8.5, z: -46, ry: -Math.PI / 2, chaume: true }, { x: -9, z: -53, ry: Math.PI / 2 },
  ];
  for (const [i, h] of maisons.entries()) maison(m, h, i);
  const rotor = moulin(m, -42, 36);
  chapelle(m, 46, 2);
  clotures(m.bois);
  // Meules de foin rondes dans les prés.
  for (const [k, [x, z]] of [[20, 44], [25, 48], [-24, 40], [-45, -26], [-50, -32], [22, -44]].entries()) {
    m.paille.push(colorer(place(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 10), { x, y: 0.8, z, rz: Math.PI / 2, ry: k * 0.9 }), '#c9a45a', 0.12));
  }
  // Rochers épars.
  for (let k = 0; k < 30; k++) {
    const a = hachage(k, 41) * Math.PI * 2, d = 24 + hachage(k, 43) * 40;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (ecartChemin(x, z) < 3 || OBSTACLES.some((o) => Math.hypot(o.x - x, o.z - z) < o.rayon + 1)) continue;
    const t = 0.3 + hachage(k, 47) * 0.8;
    m.pierre.push(colorer(place(new THREE.IcosahedronGeometry(t, 0), { x, y: t * 0.2, z, sx: 1.3, sy: 0.7, ry: k }), PIERRES[k % 4], 0.1));
  }

  // Végétation : herbes hautes du champ, buissons, forêt au-delà des bornes.
  const plantes = [];
  const pres = (x, z, marge) => maisons.some((h) => Math.hypot(h.x - x, h.z - z) < marge) || Math.hypot(x + 42, z - 36) < marge || Math.hypot(x - 46, z - 2) < marge + 2;
  const bloque = (x, z, marge) => OBSTACLES.some((o) => Math.hypot(o.x - x, o.z - z) < o.rayon + marge);
  const pas = 0.8;
  for (let i = -80; i <= 80; i++) {
    for (let j = -80; j <= 80; j++) {
      const x = i * pas + (hachage(i, j) - 0.5) * pas, z = j * pas + (hachage(j + 13, i) - 0.5) * pas;
      const n = Math.max(Math.abs(x), Math.abs(z));
      if (n < EXT + 0.8 || n > 64) continue;
      const chance = n < BORNE ? 0.5 : 0.13;
      if (hachage(i * 2.3, j * 1.9) > chance || ecartChemin(x, z) < 2.4 || bloque(x, z, 0.2) || pres(x, z, 5)) continue;
      plantes.push({ espece: hachage(j, i * 7) > 0.35 ? 'herbeSombre' : 'herbe', x, y: -0.03, z, rotation: hachage(i, j + 3) * 6.3, echelle: 0.8 + hachage(j, i + 1) * 0.8, teinte: 0.8 + hachage(i + 9, j) * 0.3 });
    }
  }
  for (let k = 0; k < 160; k++) {
    const x = (hachage(k, 51) * 2 - 1) * 64, z = (hachage(k, 53) * 2 - 1) * 64;
    const n = Math.max(Math.abs(x), Math.abs(z));
    if (n < EXT + 1.5 || ecartChemin(x, z) < 3 || bloque(x, z, 0.8) || pres(x, z, 5)) continue;
    plantes.push({ espece: k % 3 ? 'buissonSombre' : 'buisson', x, y: -0.1, z, rotation: k * 2.3, echelle: 0.7 + hachage(k, 55) * 0.8, teinte: 0.8 + hachage(k, 57) * 0.3 });
  }
  // La forêt : des sapins serrés et quelques feuillus, en couronne autour du champ.
  let arbres = 0;
  for (let k = 0; k < 1200 && arbres < 320; k++) {
    const x = (hachage(k, 61) * 2 - 1) * 68, z = (hachage(k, 63) * 2 - 1) * 68;
    const n = Math.max(Math.abs(x), Math.abs(z));
    if (n < BORNE + 3 || ecartChemin(x, z) < 12 || pres(x, z, 8)) continue;
    arbres++;
    plantes.push({ espece: hachage(k, 65) > 0.25 ? 'sapin' : 'feuilluSombre', x, y: -0.1, z, rotation: hachage(k, 67) * 6.3, echelle: 1 + hachage(k, 69) * 0.9, teinte: 0.8 + hachage(k, 71) * 0.3 });
  }
  // Ce qui est au-delà des bornes ne projette pas d'ombre.
  const loin = (p) => Math.max(Math.abs(p.x), Math.abs(p.z)) > BORNE + 4;
  const groupe = new THREE.Group().add(
    creerChemins(), creerVegetation(plantes.filter((p) => !loin(p))), creerVegetation(plantes.filter(loin), { ombres: false }), rotor,
    fusionner(m.pierre), fusionner(m.platre), fusionner(m.bois), fusionner(m.fer, { metalness: 0.3, roughness: 0.6 }),
    fusionner(m.tuiles), fusionner(m.paille), fusionner(m.feuilles, { ombre: false }),
  );
  return { groupe, rotor, fenetres: m.fenetres };
}
