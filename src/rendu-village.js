// Rendu du village abandonné (village.js) : une place pavée, des maisons à
// colombages aux fenêtres éclairées et aux torches, la chapelle et son
// cimetière, le moulin, le marché, le puits, l'étal de l'armurier et sa
// forge, des champs et des meules ; la forêt ferme l'horizon. Chaque obstacle
// de village.js est dessiné ici, à sa place : ce qu'on voit est ce qui bloque.

import * as THREE from 'three';
import { creerBrume, creerLucioles } from './ambiance.js';
import { creerModeleArme } from './armes.js';
import { creerAutel } from './autel.js';
import {
  BOIS, FER, FLEURS, PIERRES, arbresDeCarte, assise, atelier, caisses, chapelle, charrette, creerFeux, creerSol, creerVegetation,
  croix, enseigne, foretLointaine, forge, fusionnerMatieres, maison, marche, matieres, meule, moulin, puits, rocher, tombe,
} from './decor-commun.js';
import { colorer, hachage, lumineux, place } from './geometrie.js';
import { dansObstacle } from './carte-ouverte.js';
import { ARMURERIE, BORNE_VILLAGE, CHAPELLE, FORGE, MAISONS, MOULIN, VILLAGE } from './village.js';

const relief = VILLAGE.hauteurSol;
const PLACE = 9.5;

// Les chemins de terre : de la place vers les quatre lisières, la chapelle
// et le moulin (segments [x0, z0, x1, z1]).
const CHEMINS = [[0, 0, 0, -44], [0, 0, -1, 44], [0, 0, 44, 1], [-9, 0, -44, -2], [0, 0, 17, -24], [17, -24, 22, -24], [0, 0, -28, 24]];
function surChemin(x, z, largeur = 1.4) {
  for (const [x0, z0, x1, z1] of CHEMINS) {
    const dx = x1 - x0, dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - x0 - dx * t, z - z0 - dz * t) < largeur) return true;
  }
  return false;
}
// Deux champs labourés, en sillons.
const CHAMPS = [{ x0: 19, x1: 36, z0: -3, z1: 18 }, { x0: -37, x1: -21, z0: -14, z1: 3 }];
const dansChamp = (x, z) => CHAMPS.find((c) => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1);
const CIMETIERE = { x0: 22.5, x1: 35, z0: -17.5, z1: -12 };
const auCimetiere = (x, z) => x > CIMETIERE.x0 && x < CIMETIERE.x1 && z > CIMETIERE.z0 && z < CIMETIERE.z1;

function teinte(x, z, h) {
  const loin = Math.max(Math.abs(x), Math.abs(z)) - BORNE_VILLAGE;
  if (loin > 1.5) return hachage(Math.floor(x / 3), Math.floor(z / 3)) > 0.5 ? '#2e3a24' : '#34402a';
  const r = Math.hypot(x, z);
  if (r < PLACE) return hachage(Math.floor(x * 1.3), Math.floor(z * 1.3)) > 0.5 ? '#8d8272' : '#7a7163';
  if (Math.hypot(x - VILLAGE.autel.x, z - VILLAGE.autel.z) < VILLAGE.autel.rayon + 1.2) return '#6f685c';
  if (surChemin(x, z)) return hachage(x, z) > 0.5 ? '#7a6446' : '#6e5a3e';
  const champ = dansChamp(x, z);
  if (champ) return Math.floor((x - champ.x0) * 1.1) % 2 ? '#6b5334' : '#7e6440';
  if (auCimetiere(x, z)) return '#4a6b33';
  return h > 0.55 ? '#6a9442' : hachage(Math.floor(x / 2), Math.floor(z / 2)) > 0.4 ? '#5d8a3a' : '#557f35';
}

// L'étal de l'armurier : un comptoir sous un auvent rayé, un râtelier
// d'armes, un panier de pommes et une marmite (on y vend aussi à manger),
// l'enseigne, une lanterne. Son +z local regarde la place.
function etal(m, groupe, y) {
  const p = atelier(ARMURERIE, ARMURERIE.ry, y);
  m.bois.push(p(new THREE.BoxGeometry(3, 1.05, 1.1), { y: 0.52 }, BOIS[1], 0.08));
  m.bois.push(p(new THREE.BoxGeometry(3.3, 0.08, 1.35), { y: 1.08, z: 0.1 }, BOIS[2]));
  for (const x of [-1.45, 1.45]) {
    m.bois.push(p(new THREE.BoxGeometry(0.14, 3.2, 0.14), { x, y: 1.6, z: -0.5 }, BOIS[0]));
    m.bois.push(p(new THREE.BoxGeometry(0.12, 2.6, 0.12), { x, y: 1.3, z: 0.52 }, BOIS[0]));
  }
  for (let i = 0; i < 7; i++) {
    m.tissu.push(p(new THREE.BoxGeometry(3.4 / 7, 0.05, 2), { x: -1.7 + (i + 0.5) * (3.4 / 7), y: 2.95, z: 0.2, rx: 0.3 }, i % 2 ? '#e8dcc0' : '#8e1f24'));
  }
  // Le râtelier : une planche au fond, entre les poteaux.
  m.bois.push(p(new THREE.BoxGeometry(2.8, 1.4, 0.08), { y: 2, z: -0.52 }, BOIS[2], 0.06));
  // Pommes, marmite de ragoût sur un trépied, caisses de munitions.
  m.bois.push(p(new THREE.CylinderGeometry(0.26, 0.2, 0.2, 8, 1, true), { x: 0.9, y: 1.22, z: 0.2 }, '#a07844'));
  for (let i = 0; i < 7; i++) m.paille.push(p(new THREE.IcosahedronGeometry(0.075, 0), { x: 0.9 + Math.cos(i) * 0.12, y: 1.3 + (i % 2) * 0.05, z: 0.2 + Math.sin(i) * 0.12 }, '#b8261f', 0.15));
  m.fer.push(p(new THREE.CylinderGeometry(0.24, 0.2, 0.26, 10), { x: 0.2, y: 1.25, z: 0.25 }, '#3a3a3e'));
  m.paille.push(p(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 10), { x: 0.2, y: 1.37, z: 0.25 }, '#8a4a22'));
  for (const [i, x] of [-1.1, -0.6].entries()) {
    m.bois.push(p(new THREE.BoxGeometry(0.34, 0.2, 0.26), { x, y: 1.22, z: 0.2, ry: i * 0.2 }, '#4f5a34'));
    m.fer.push(p(new THREE.BoxGeometry(0.345, 0.04, 0.265), { x, y: 1.3, z: 0.2, ry: i * 0.2 }, '#c9a227'));
  }
  // Tonneau de flèches et caisses au pied.
  m.bois.push(p(new THREE.CylinderGeometry(0.32, 0.28, 0.8, 8), { x: 1.9, y: 0.4, z: -0.2 }, BOIS[1], 0.1));
  const panneau = enseigne('ARMURERIE');
  const q = new THREE.Vector3(0, 3.35, 0.95).applyAxisAngle(new THREE.Vector3(0, 1, 0), ARMURERIE.ry);
  panneau.position.set(ARMURERIE.x + q.x, y + q.y, ARMURERIE.z + q.z);
  panneau.rotation.y = ARMURERIE.ry;
  groupe.add(panneau);
  // Les armes en vente, de profil sur le râtelier.
  for (const [id, h, dx] of [['fusil', 2.35, -0.3], ['lance', 1.75, -0.7], ['uzi', 1.8, 0.9]]) {
    const arme = creerModeleArme(id);
    const v = new THREE.Vector3(dx, h, -0.42).applyAxisAngle(new THREE.Vector3(0, 1, 0), ARMURERIE.ry);
    arme.position.set(ARMURERIE.x + v.x, y + v.y, ARMURERIE.z + v.z);
    arme.rotation.y = ARMURERIE.ry - Math.PI / 2;
    arme.scale.setScalar(1.3);
    groupe.add(arme);
  }
  // La lanterne de l'étal et sa lampe (ile.js garde les lampes dans la scène).
  const l = new THREE.Vector3(0, 2.5, 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), ARMURERIE.ry);
  const lampe = new THREE.PointLight('#ffcf85', 9, 12, 1.5);
  lampe.position.set(ARMURERIE.x + l.x, y + l.y, ARMURERIE.z + l.z);
  const ampoule = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: lumineux('#ffd98a', 8) }));
  ampoule.position.copy(lampe.position);
  m.fer.push(colorer(place(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), { x: lampe.position.x, y: lampe.position.y + 0.3, z: lampe.position.z }), FER));
  groupe.add(ampoule, lampe);
}

export function creerVillage() {
  const groupe = new THREE.Group();
  const m = matieres();
  const foyers = [];
  groupe.add(creerSol({ relief, demi: BORNE_VILLAGE + 36, n: 104, teinte }));

  for (const [i, h] of MAISONS.entries()) foyers.push(...maison(m, h, assise(relief, h.x, h.z, h.l / 2, h.p / 2), i));
  foyers.push(chapelle(m, CHAPELLE.x, assise(relief, CHAPELLE.x, CHAPELLE.z, 4.5, 2.5), CHAPELLE.z, CHAPELLE.ry));
  const rotor = moulin(m, MOULIN.x, assise(relief, MOULIN.x, MOULIN.z, 2.5, 2.5), MOULIN.z, Math.atan2(-MOULIN.x, -MOULIN.z));
  groupe.add(rotor);
  etal(m, groupe, assise(relief, ARMURERIE.x, ARMURERIE.z, 1.5, 1.5));
  const foyerForge = forge(m, FORGE, -Math.PI / 2, assise(relief, FORGE.x, FORGE.z, 1, 2));
  foyers.push([...foyerForge, 0.9]);

  let tombes = 0;
  for (const o of VILLAGE.obstacles) {
    const y = relief(o.x, o.z);
    if (o.genre === 'marche') marche(m, o, y);
    else if (o.genre === 'puits') puits(m, o, y);
    else if (o.genre === 'charrette') charrette(m, o, y);
    else if (o.genre === 'caisses') caisses(m.bois, o, y);
    else if (o.genre === 'tombe') tombe(m, o, y, tombes++);
    else if (o.genre === 'croix') croix(m, o, y);
    else if (o.genre === 'meule') meule(m, o, y);
    else if (o.genre === 'rocher') rocher(m, o, y);
  }

  // Les torches qui bordent la place, plantées dans des socles de pierre.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.5, x = Math.cos(a) * (PLACE + 0.4), z = Math.sin(a) * (PLACE + 0.4);
    if (dansObstacle(VILLAGE, x, z, 0.8) || surChemin(x, z, 1.8)) continue;
    const y = relief(x, z);
    m.pierre.push(colorer(place(new THREE.CylinderGeometry(0.16, 0.22, 0.5, 6), { x, y: y + 0.2, z }), PIERRES[1], 0.08));
    m.bois.push(colorer(place(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 5), { x, y: y + 1, z }), BOIS[0]));
    m.fer.push(colorer(place(new THREE.CylinderGeometry(0.13, 0.08, 0.16, 6), { x, y: y + 1.75, z }), FER));
    foyers.push([x, y + 1.82, z, 1]);
  }
  // Petites choses qu'on enjambe : fleurs au pied des maisons, cailloux,
  // épis dans les champs.
  for (let k = 0; k < 260; k++) {
    const x = (hachage(k, 3) * 2 - 1) * BORNE_VILLAGE, z = (hachage(k, 5) * 2 - 1) * BORNE_VILLAGE;
    if (Math.hypot(x, z) < PLACE || surChemin(x, z) || dansChamp(x, z) || dansObstacle(VILLAGE, x, z, 0.3)) continue;
    const y = relief(x, z);
    if (k % 3) {
      for (let f = 0; f < 3; f++) {
        const fx = x + (hachage(k, f) - 0.5) * 0.5, fz = z + (hachage(f, k) - 0.5) * 0.5;
        m.feuilles.push(colorer(place(new THREE.ConeGeometry(0.02, 0.3, 3), { x: fx, y: y + 0.15, z: fz }), '#4a7a2a'));
        m.feuilles.push(colorer(place(new THREE.IcosahedronGeometry(0.07, 0), { x: fx, y: y + 0.32, z: fz }), FLEURS[(k + f) % FLEURS.length], 0.1));
      }
    } else {
      m.pierre.push(colorer(place(new THREE.IcosahedronGeometry(0.12 + hachage(k, 7) * 0.12, 0), { x, y: y + 0.03, z, sy: 0.5, ry: k }), PIERRES[k % 5], 0.1));
    }
  }

  // Végétation : les arbres de la carte, l'herbe, les épis, les buissons
  // contre les maisons, la forêt au-delà de la lisière.
  const plantes = arbresDeCarte(VILLAGE.obstacles, relief);
  for (let i = -52; i <= 52; i++) {
    for (let j = -52; j <= 52; j++) {
      const x = i * 0.8 + (hachage(i, j) - 0.5) * 0.8, z = j * 0.8 + (hachage(j + 13, i) - 0.5) * 0.8;
      if (Math.max(Math.abs(x), Math.abs(z)) > BORNE_VILLAGE + 3) continue;
      const champ = dansChamp(x, z);
      if (champ) {
        // Les épis, en rangs.
        if (Math.floor((x - champ.x0) * 1.1) % 2 && hachage(i * 3, j) < 0.7 && !dansObstacle(VILLAGE, x, z, 0.4)) {
          plantes.push({ espece: 'herbeSeche', x, y: relief(x, z) - 0.03, z, rotation: hachage(i, j + 3) * 6.3, echelle: 1.2 + hachage(j, i) * 0.5, teinte: 0.9 + hachage(i + 9, j) * 0.2 });
        }
        continue;
      }
      if (Math.hypot(x, z) < PLACE + 0.5 || surChemin(x, z, 1.6) || hachage(i * 2.3, j * 1.9) > 0.42 || dansObstacle(VILLAGE, x, z, 0.25)) continue;
      plantes.push({ espece: hachage(j, i * 7) > 0.7 ? 'herbeSombre' : 'herbe', x, y: relief(x, z) - 0.03, z, rotation: hachage(i, j + 3) * 6.3, echelle: 0.7 + hachage(j, i + 1) * 0.7, teinte: 0.8 + hachage(i + 9, j) * 0.3 });
    }
  }
  for (const [i, h] of MAISONS.entries()) {
    for (let k = 0; k < 3; k++) {
      const a = h.ry + Math.PI + (k - 1) * 0.5, d = h.p / 2 + 0.9;
      const x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
      plantes.push({ espece: (i + k) % 2 ? 'buisson' : 'buissonSombre', x, y: relief(x, z) - 0.1, z, rotation: k * 2, echelle: 0.55 + hachage(i, k) * 0.3, teinte: 1 });
    }
  }
  const loin = foretLointaine(BORNE_VILLAGE, relief, { graine: 3, especes: ['sapin', 'feuilluSombre', 'sapin', 'feuillu'] });
  groupe.add(creerVegetation(plantes), creerVegetation(loin, { ombres: false }));

  const feux = creerFeux(foyers, 4);
  const vie = [
    creerLucioles(56, (i) => {
      const a = hachage(i, 40) * Math.PI * 2, r = 12 + hachage(40, i) * 24;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      return [x, relief(x, z) + 0.6 + hachage(i, 2) * 1.4, z];
    }),
    creerBrume({ n: 36, rayon: BORNE_VILLAGE, carre: true, sol: relief }),
  ];
  const autel = creerAutel(VILLAGE.autel, relief(VILLAGE.autel.x, VILLAGE.autel.z));
  groupe.add(...fusionnerMatieres(m), feux, ...vie, autel);

  groupe.userData.autel = autel;
  groupe.userData.animer = (dt, nuit) => {
    rotor.userData.rotor.rotation.z += dt * 0.35;
    feux.userData.animer(dt, nuit);
    for (const v of vie) v.userData.animer(dt, nuit);
    autel.userData.animer(dt, nuit);
  };
  return groupe;
}
