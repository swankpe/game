// Rendu de la cour du château, à partir des blocs et rampes de chateau.js :
// ce qu'on voit est exactement ce qui bloque. Tout est fusionné par matière
// (pierre, bois, ardoise, tissu, flammes) : une poignée d'appels de dessin.
// Les torches brillent sans éclairer (pas de lumière ajoutée) : seule la
// lampe de l'armurier en est une, créée avec les autres (voir ile.js).

import * as THREE from 'three';
import { creerBraises, creerBrume } from './ambiance.js';
import { creerModeleArme } from './armes.js';
import {
  BLOCS, BOUTIQUE, COUR, DEMI_PORTE, EPAISSEUR_MUR, ETAL, H_PARAPET, H_RONDE, H_TERRASSE, H_TOUR, OBSTACLES, RAMPES, TERRASSE, TOURS,
} from './chateau.js';
import { colorer, fusionner, hachage, lumineux, place } from './geometrie.js';

const PIERRES = ['#8b857a', '#7f796f', '#958f84', '#77726a', '#8f887c'];
const PAVES = ['#6e6a63', '#78736b', '#65615b', '#827c73'];
const BOIS = ['#6b4a33', '#7a5638', '#5e412c'];
const HERBE = ['#35412c', '#3c4a30', '#2f3a27', '#46512f'];
const FEUILLES = ['#3f5a2a', '#4a6b30', '#35502a', '#56733a'];
const ECORCE = '#3a332c';
const EXT = COUR + EPAISSEUR_MUR;
const ASSISE = 0.9;
const LONGUEUR_PIERRE = 1.6;

// Une muraille en pierres de taille : rangées décalées, chaque pierre un peu
// plus claire ou plus sombre, légèrement en relief ou en retrait.
function appareiller(parties, x0, x1, z0, z1, y0, y1, graine = 0) {
  const selonX = x1 - x0 >= z1 - z0;
  const [a0, a1] = selonX ? [x0, x1] : [z0, z1];
  const [b0, b1] = selonX ? [z0, z1] : [x0, x1];
  const epaisseur = b1 - b0;
  let rang = 0;
  for (let y = y0; y < y1 - 0.01; y += ASSISE, rang++) {
    const haut = Math.min(ASSISE, y1 - y);
    let a = a0 - (rang % 2 ? LONGUEUR_PIERRE / 2 : 0);
    while (a < a1 - 0.01) {
      const l = LONGUEUR_PIERRE * (0.75 + hachage(a + graine, y) * 0.5);
      const debut = Math.max(a, a0), fin = Math.min(a + l, a1);
      if (fin - debut > 0.05) {
        const relief = (hachage(y, a + graine) - 0.5) * 0.06;
        const milieu = (debut + fin) / 2;
        const geo = new THREE.BoxGeometry(selonX ? fin - debut - 0.03 : epaisseur + relief, haut - 0.03, selonX ? epaisseur + relief : fin - debut - 0.03);
        const pos = selonX ? { x: milieu, y: y + haut / 2, z: (b0 + b1) / 2 } : { x: (b0 + b1) / 2, y: y + haut / 2, z: milieu };
        parties.push(colorer(place(geo, pos), PIERRES[Math.floor(hachage(milieu + graine, y * 3) * PIERRES.length)], 0.05));
      }
      a += l;
    }
  }
}

// Créneaux : merlons pleins et embrasures basses, le long du grand côté.
function creneler(parties, x0, x1, z0, z1, y0, y1) {
  const selonX = x1 - x0 >= z1 - z0;
  const [a0, a1] = selonX ? [x0, x1] : [z0, z1];
  const [b0, b1] = selonX ? [z0, z1] : [x0, x1];
  const muret = y0 + (y1 - y0) * 0.4;
  appareiller(parties, x0, x1, z0, z1, y0, muret, 7);
  for (let a = a0; a < a1 - 0.3; a += 1.7) {
    const fin = Math.min(a + 1, a1);
    const geo = new THREE.BoxGeometry(selonX ? fin - a : b1 - b0, y1 - muret, selonX ? b1 - b0 : fin - a);
    const m = (a + fin) / 2;
    const pos = selonX ? { x: m, y: (muret + y1) / 2, z: (b0 + b1) / 2 } : { x: (b0 + b1) / 2, y: (muret + y1) / 2, z: m };
    parties.push(colorer(place(geo, pos), PIERRES[Math.floor(hachage(m, y1) * PIERRES.length)], 0.05));
  }
}

function sol(parties, demi, pas, couleurs, y = 0, dedans = () => true) {
  for (let x = -demi; x < demi; x += pas) {
    for (let z = -demi; z < demi; z += pas) {
      if (!dedans(x + pas / 2, z + pas / 2)) continue;
      const geo = new THREE.PlaneGeometry(pas * 0.97, pas * 0.97);
      geo.rotateX(-Math.PI / 2);
      parties.push(colorer(place(geo, { x: x + pas / 2, y: y + hachage(x, z) * 0.02, z: z + pas / 2 }), couleurs[Math.floor(hachage(z, x) * couleurs.length)], 0.12));
    }
  }
}

function escalier(parties, r) {
  const [ax, az] = r.a, [bx, bz] = r.b;
  const longueur = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.round((r.hb - r.ha) / 0.3));
  const angle = Math.atan2(bx - ax, bz - az);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const h = r.ha + ((r.hb - r.ha) * (i + 1)) / n;
    const geo = new THREE.BoxGeometry(r.largeur, h, longueur / n + 0.02);
    parties.push(colorer(place(geo, { x: ax + (bx - ax) * t, y: h / 2, z: az + (bz - az) * t, ry: angle }), PIERRES[i % PIERRES.length], 0.05));
  }
}

function tour(parties, ardoises, t) {
  const rayon = t.rayon - 0.1;
  parties.push(colorer(place(new THREE.CylinderGeometry(rayon, rayon * 1.08, H_TOUR, 10), { x: t.x, y: H_TOUR / 2, z: t.z }), PIERRES[1], 0.08));
  // Couronne de merlons, toit d'ardoise en cône.
  parties.push(colorer(place(new THREE.CylinderGeometry(rayon + 0.25, rayon + 0.25, 0.5, 10), { x: t.x, y: H_TOUR + 0.25, z: t.z }), PIERRES[2], 0.06));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parties.push(colorer(place(new THREE.BoxGeometry(0.7, 0.8, 0.5), { x: t.x + Math.sin(a) * (rayon + 0.1), y: H_TOUR + 0.9, z: t.z + Math.cos(a) * (rayon + 0.1), ry: a }), PIERRES[i % PIERRES.length], 0.05));
  }
  ardoises.push(colorer(place(new THREE.ConeGeometry(rayon + 0.4, 4, 10), { x: t.x, y: H_TOUR + 3.2, z: t.z }), '#3b4152', 0.1));
}

function porte(bois, fer, cote) {
  // Deux vantaux ouverts contre la face intérieure de la muraille.
  const s = cote === 'nord' || cote === 'ouest' ? -1 : 1;
  for (const c of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const d = DEMI_PORTE * 0.2 * (i + 0.5);
      const geo = new THREE.BoxGeometry(0.1, 3.6, DEMI_PORTE * 0.2 - 0.02);
      const surX = cote === 'nord' || cote === 'sud';
      const pos = surX
        ? { x: c * (DEMI_PORTE + 0.1), y: 1.8, z: s * (COUR - d - 0.1), ry: 0 }
        : { x: s * (COUR - d - 0.1), y: 1.8, z: c * (DEMI_PORTE + 0.1), ry: Math.PI / 2 };
      bois.push(colorer(place(geo, pos), BOIS[i % BOIS.length], 0.08));
    }
    for (const y of [0.8, 2.8]) {
      const surX = cote === 'nord' || cote === 'sud';
      const pos = surX
        ? { x: c * (DEMI_PORTE + 0.16), y, z: s * (COUR - DEMI_PORTE / 2 - 0.1) }
        : { x: s * (COUR - DEMI_PORTE / 2 - 0.1), y, z: c * (DEMI_PORTE + 0.16), ry: Math.PI / 2 };
      fer.push(colorer(place(new THREE.BoxGeometry(0.04, 0.12, DEMI_PORTE), pos), '#2c2e33'));
    }
  }
}

function enseigne(x, y, z) {
  const toile = document.createElement('canvas');
  toile.width = 512;
  toile.height = 160;
  const ctx = toile.getContext('2d');
  ctx.fillStyle = '#5b3b24';
  ctx.fillRect(0, 0, 512, 160);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, i * 27, 512, 27);
  }
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 488, 136);
  ctx.fillStyle = '#f0c75a';
  ctx.font = 'bold 66px "Fredoka", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ARMURERIE', 256, 84);
  const texture = new THREE.CanvasTexture(toile);
  texture.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
  m.position.set(x, y, z);
  m.rotation.y = Math.PI / 2;
  return m;
}

// Halo des torches : un dégradé radial, en points additifs (un seul appel).
function textureHalo() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255, 210, 130, 1)');
  d.addColorStop(0.3, 'rgba(255, 150, 60, 0.5)');
  d.addColorStop(1, 'rgba(255, 120, 40, 0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Un rameau (tronc, branche, os) de a à b, plus fin au bout.
function rameau(parties, a, b, r0, r1, couleur) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const geo = new THREE.CylinderGeometry(r1, r0, d.length(), 5);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  geo.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
  parties.push(colorer(geo, couleur, 0.1));
}

// Arbre mort : un tronc tordu, des branches nues qui griffent le ciel.
function arbreMort(parties, x, z, graine) {
  const h = 4 + hachage(graine, 1) * 2.5;
  const cime = [x + (hachage(graine, 2) - 0.5) * 1.2, h, z + (hachage(graine, 3) - 0.5) * 1.2];
  rameau(parties, [x, -0.2, z], cime, 0.32, 0.1, ECORCE);
  for (let k = 0; k < 6; k++) {
    const t = 0.35 + k * 0.11;
    const p = [x + (cime[0] - x) * t, -0.2 + (h + 0.2) * t, z + (cime[2] - z) * t];
    const a = graine * 1.7 + k * 2.4;
    const l = (1.8 - k * 0.2) * (0.8 + hachage(k, graine) * 0.4);
    const q = [p[0] + Math.cos(a) * l, p[1] + l * 0.55, p[2] + Math.sin(a) * l];
    rameau(parties, p, q, 0.1 - k * 0.012, 0.03, ECORCE);
    for (const d of [-0.9, 0.7]) {
      const b = a + d;
      rameau(parties, q, [q[0] + Math.cos(b) * l * 0.45, q[1] + l * (0.3 + hachage(d, k) * 0.3), q[2] + Math.sin(b) * l * 0.45], 0.03, 0.01, ECORCE);
    }
  }
  // Racines qui sortent de terre.
  for (let k = 0; k < 4; k++) {
    const a = graine + k * 1.6;
    rameau(parties, [x, 0.3, z], [x + Math.cos(a) * 0.9, -0.1, z + Math.sin(a) * 0.9], 0.12, 0.04, ECORCE);
  }
}

// Tombe : stèle arrondie gravée d'une croix, tertre devant, mousse dessus.
// Elle regarde la muraille (vers -x).
function tombe(pierre, herbe, o, i) {
  const pose = { x: o.x, z: o.z, rz: o.penche, rx: o.penche * 0.5 };
  const piece = (geo, pos, couleur, v = 0.06) => {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(pos.rx ?? 0, 0, pos.rz ?? 0)), new THREE.Vector3(1, 1, 1)));
    place(geo, pose);
    pierre.push(colorer(geo, couleur, v));
  };
  const teinte = PIERRES[i % PIERRES.length];
  piece(new THREE.BoxGeometry(0.16, 0.62, 0.62), { y: 0.3 }, teinte);
  piece(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 10), { y: 0.6, rz: Math.PI / 2 }, teinte);
  piece(new THREE.BoxGeometry(0.02, 0.36, 0.06), { x: -0.085, y: 0.52 }, '#3e3a35');
  piece(new THREE.BoxGeometry(0.02, 0.06, 0.24), { x: -0.085, y: 0.6 }, '#3e3a35');
  piece(new THREE.BoxGeometry(0.22, 0.08, 0.72), { y: 0.02 }, PIERRES[(i + 2) % PIERRES.length]);
  pierre.push(colorer(place(new THREE.IcosahedronGeometry(0.5, 0), { x: o.x - 0.8, y: -0.18, z: o.z, sx: 1.4, sy: 0.4, sz: 0.7 }), '#3a2e24', 0.1));
  if (i % 2) herbe.push(colorer(place(new THREE.IcosahedronGeometry(0.12, 0), { x: o.x, y: 0.88, z: o.z + 0.1, sy: 0.4 }), FEUILLES[i % 4], 0.1));
}

// Croix de bois plantée de travers.
function croix(bois, o) {
  const pose = (pos) => ({ ...pos, x: o.x + (pos.x ?? 0), z: o.z + (pos.z ?? 0), rz: o.penche * 2 });
  bois.push(colorer(place(new THREE.BoxGeometry(0.1, 1.25, 0.1), pose({ y: 0.55 })), BOIS[1], 0.1));
  bois.push(colorer(place(new THREE.BoxGeometry(0.09, 0.1, 0.6), pose({ y: 0.85 })), BOIS[0], 0.1));
  bois.push(colorer(place(new THREE.IcosahedronGeometry(0.45, 0), { x: o.x - 0.75, y: -0.15, z: o.z, sx: 1.4, sy: 0.4, sz: 0.7 }), '#3a2e24', 0.1));
}

// Pile de caisses cerclées.
export function caisses(bois, o) {
  for (const [dx, dy, dz, c, ry] of [[-0.35, 0, -0.2, 0.8, 0.2], [0.45, 0, 0.15, 0.7, -0.3], [-0.2, 0.8, -0.1, 0.62, 0.5]]) {
    const pose = { x: o.x + dx, y: dy + c / 2, z: o.z + dz, ry };
    bois.push(colorer(place(new THREE.BoxGeometry(c, c, c), pose), BOIS[1], 0.12));
    // Arêtes renforcées.
    for (const [sx, sy, sz, ex, ey, ez] of [[1.02, 0.08, 1.02, 0, 0.46, 0], [1.02, 0.08, 1.02, 0, -0.46, 0], [0.08, 1, 1.03, 0.47, 0, 0], [0.08, 1, 1.03, -0.47, 0, 0]]) {
      const geo = new THREE.BoxGeometry(c * sx, c * sy, c * sz).translate(c * ex, c * ey, c * ez);
      bois.push(colorer(place(geo, pose), BOIS[2], 0.05));
    }
  }
}

// Crâne et os épars.
function ossements(pierre, x, z, graine) {
  const os = '#d6cdb0';
  pierre.push(colorer(place(new THREE.IcosahedronGeometry(0.11, 1), { x, y: 0.09, z, sz: 1.15, ry: graine }), os, 0.05));
  for (const c of [-1, 1]) {
    pierre.push(colorer(place(new THREE.BoxGeometry(0.035, 0.03, 0.03), { x: x + Math.cos(graine) * 0.1 + Math.sin(graine) * c * 0.035, y: 0.12, z: z - Math.sin(graine) * 0.1 + Math.cos(graine) * c * 0.035, ry: graine }), '#1c1614'));
  }
  for (let k = 0; k < 3; k++) {
    const a = graine * 2 + k * 2.1, l = 0.35 + hachage(graine, k) * 0.2;
    const px = x + Math.cos(a) * 0.35, pz = z + Math.sin(a) * 0.35;
    rameau(pierre, [px, 0.03, pz], [px + Math.cos(a + 1.2) * l, 0.03, pz + Math.sin(a + 1.2) * l], 0.025, 0.025, os);
  }
}

// Lierre qui grimpe le long d'un mur : (x, z) le pied de la tige contre la
// face, (nx, nz) la normale de la face, h la hauteur atteinte.
function lierre(feuilles, x, z, nx, nz, h, graine) {
  const tx = -nz, tz = nx;
  let lateral = 0;
  const ry = Math.atan2(nx, nz);
  for (let y = 0.2; y < h; y += 0.16) {
    lateral += (hachage(y, graine) - 0.5) * 0.25;
    const largeur = 0.35 + Math.sin((y / h) * Math.PI) * 0.6;
    for (let k = 0; k < 3; k++) {
      const d = lateral + (hachage(k, y + graine) - 0.5) * largeur;
      const geo = new THREE.PlaneGeometry(0.2, 0.18);
      feuilles.push(colorer(place(geo, {
        x: x + tx * d + nx * (0.04 + k * 0.01), y: y + hachage(y, k) * 0.1, z: z + tz * d + nz * (0.04 + k * 0.01), ry, rz: hachage(k, y) * 3,
      }), FEUILLES[Math.floor(hachage(y * 3, k + graine) * 4)], 0.15));
    }
  }
}

// Fissure en zigzag sur une face.
function fissure(pierre, x, y, z, nx, nz, graine) {
  const tx = -nz, tz = nx;
  let d = 0, h = y;
  for (let k = 0; k < 5; k++) {
    const pas = 0.25 + hachage(k, graine) * 0.2;
    const dd = (hachage(graine, k) - 0.5) * 0.35;
    rameau(pierre, [x + tx * d + nx * 0.035, h, z + tz * d + nz * 0.035], [x + tx * (d + dd) + nx * 0.035, h - pas, z + tz * (d + dd) + nz * 0.035], 0.018 - k * 0.002, 0.012 - k * 0.002, '#2e2b27');
    d += dd;
    h -= pas;
  }
}

// Les faces des murailles : position le long du mur (a), face intérieure ou
// extérieure. Rend { x, z, nx, nz } au pied de la face.
function face(cote, a, dehors) {
  const s = cote === 'nord' || cote === 'ouest' ? -1 : 1;
  const d = dehors ? EXT : COUR;
  const n = dehors ? s : -s;
  return cote === 'nord' || cote === 'sud' ? { x: a, z: s * d, nx: 0, nz: n } : { x: s * d, z: a, nx: n, nz: 0 };
}

// Linteau au-dessus d'une porte, entre ses tourelles, avec un écu. Visuel
// seulement (le relief ne le connaît pas) : assez haut pour le boss.
function linteau(pierre, tissu, cote) {
  const s = cote === 'nord' || cote === 'ouest' ? -1 : 1;
  const surX = cote === 'nord' || cote === 'sud';
  const milieu = s * (COUR + EXT) / 2;
  const pose = (a, b, pos) => (surX ? { ...pos, x: a, z: milieu + b } : { ...pos, x: milieu + b, z: a, ry: Math.PI / 2 });
  pierre.push(colorer(place(new THREE.BoxGeometry(DEMI_PORTE * 2 + 0.3, 0.8, EPAISSEUR_MUR + 0.6), pose(0, 0, { y: 6.6 })), PIERRES[3], 0.06));
  for (let k = -2; k <= 2; k++) {
    for (const b of [-1, 1]) pierre.push(colorer(place(new THREE.BoxGeometry(0.6, 0.6, 0.5), pose(k * 1.1, b * (EPAISSEUR_MUR / 2 + 0.05), { y: 7.3 })), PIERRES[(k + 5) % PIERRES.length], 0.05));
  }
  // Écu rouge et or, côté champ.
  const b = s * (EPAISSEUR_MUR / 2 + 0.32);
  tissu.push(colorer(place(new THREE.BoxGeometry(0.9, 0.7, 0.05), pose(0, b, { y: 6.6 })), '#d9b54a'));
  tissu.push(colorer(place(new THREE.BoxGeometry(0.74, 0.56, 0.05), pose(0, b + s * 0.02, { y: 6.62 })), '#8e1f24'));
}

export function creerChateau() {
  const groupe = new THREE.Group();
  const pierre = [], bois = [], fer = [], ardoises = [], tissu = [], paille = [], herbe = [], feuilles = [], fenetres = [];

  // Le champ autour, puis les pavés de la cour.
  sol(herbe, 70, 2.5, HERBE, -0.02, (x, z) => Math.max(Math.abs(x), Math.abs(z)) > COUR - 0.5);
  // Sous les mottes, une terre sombre : entre elles, on ne voit pas le ciel.
  const terre = new THREE.PlaneGeometry(140, 140);
  terre.rotateX(-Math.PI / 2);
  herbe.push(colorer(place(terre, { y: -0.05 }), '#1f2619'));
  sol(pierre, COUR, 1, PAVES, 0, () => true);
  // Les joints entre les pavés : un fond sombre, sinon on voit le ciel au travers.
  const joints = new THREE.PlaneGeometry(COUR * 2, COUR * 2);
  joints.rotateX(-Math.PI / 2);
  pierre.push(colorer(place(joints, { y: -0.01 }), '#3a3733'));

  for (const b of BLOCS) {
    if (b.genre === 'ronde' || b.genre === 'palier') appareiller(pierre, b.x0, b.x1, b.z0, b.z1, 0, b.h, b.x0 * 3 + b.z0);
    else if (b.genre === 'parapet') {
      appareiller(pierre, b.x0, b.x1, b.z0, b.z1, 0, H_RONDE, b.z0 * 5 + b.x0);
      creneler(pierre, b.x0, b.x1, b.z0, b.z1, H_RONDE, H_PARAPET);
    } else if (b.genre === 'tourelle') {
      appareiller(pierre, b.x0, b.x1, b.z0, b.z1, 0, b.h - 0.8, b.x1 + b.z1);
      creneler(pierre, b.x0, b.x1, b.z0, b.z1, b.h - 0.8, b.h + 0.4);
    } else if (b.genre === 'terrasse') {
      appareiller(pierre, b.x0, b.x1, b.z0, b.z1, 0, b.h, 3);
      for (let x = b.x0; x < b.x1; x += 1.5) {
        for (let z = b.z0; z < b.z1; z += 1.5) {
          const geo = new THREE.PlaneGeometry(1.45, 1.45);
          geo.rotateX(-Math.PI / 2);
          pierre.push(colorer(place(geo, { x: x + 0.75, y: b.h + 0.02, z: z + 0.75 }), PAVES[Math.floor(hachage(x, z) * PAVES.length)], 0.1));
        }
      }
    } else if (b.genre === 'muret') {
      creneler(pierre, b.x0, b.x1, b.z0, b.z1, H_TERRASSE, b.h + 0.2);
    }
  }
  // Escaliers : des marches pleines, sans rambarde (on peut tomber du bord).
  for (const r of RAMPES) escalier(pierre, r);
  for (const t of TOURS) tour(pierre, ardoises, t);
  for (const cote of ['nord', 'sud', 'ouest']) porte(bois, fer, cote);

  // Oriflammes rouges sur les murailles, côté cour, et drapeaux sur les tours.
  for (const [x, z, ry] of [[-10, -COUR + 0.02, 0], [10, -COUR + 0.02, 0], [-COUR + 0.02, -10, Math.PI / 2], [COUR - 0.02, 8, -Math.PI / 2], [10, COUR - 0.02, Math.PI]]) {
    tissu.push(colorer(place(new THREE.PlaneGeometry(1.4, 2.6), { x, y: H_RONDE - 1.6, z, ry }), '#8e1f24', 0.05));
    tissu.push(colorer(place(new THREE.CircleGeometry(0.35, 6), { x: x + Math.sin(ry) * 0.01, y: H_RONDE - 1.4, z: z + Math.cos(ry) * 0.01, ry }), '#d9b54a'));
  }
  for (const t of TOURS) {
    bois.push(colorer(place(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), { x: t.x, y: H_TOUR + 6, z: t.z }), BOIS[0]));
    tissu.push(colorer(place(new THREE.PlaneGeometry(1.3, 0.7), { x: t.x + 0.65, y: H_TOUR + 6.7, z: t.z, ry: 0.3 }), '#8e1f24'));
  }

  // Le puits, la charrette, les tonneaux, le foin.
  for (const o of OBSTACLES) {
    if (o.genre === 'puits') {
      pierre.push(colorer(place(new THREE.CylinderGeometry(1.2, 1.25, 0.9, 10, 1, true), { x: o.x, y: 0.45, z: o.z }), PIERRES[0], 0.08));
      pierre.push(colorer(place(new THREE.TorusGeometry(1.15, 0.14, 4, 10), { x: o.x, y: 0.92, z: o.z, rx: Math.PI / 2 }), PIERRES[2]));
      for (const c of [-1, 1]) bois.push(colorer(place(new THREE.BoxGeometry(0.15, 2.2, 0.15), { x: o.x + c * 1.05, y: 1.1, z: o.z }), BOIS[0]));
      ardoises.push(colorer(place(new THREE.ConeGeometry(1.5, 0.9, 4), { x: o.x, y: 2.55, z: o.z, ry: Math.PI / 4 }), '#5a3a2a'));
      bois.push(colorer(place(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 6), { x: o.x, y: 1.75, z: o.z, rz: Math.PI / 2 }), BOIS[1]));
    } else if (o.genre === 'charrette') {
      bois.push(colorer(place(new THREE.BoxGeometry(2.4, 0.5, 1.4), { x: o.x, y: 0.8, z: o.z, ry: 0.4 }), BOIS[1], 0.1));
      for (const [dx, dz] of [[-0.8, 0.8], [0.8, 0.8], [-0.8, -0.8], [0.8, -0.8]]) {
        const rx = o.x + dx * Math.cos(0.4) + dz * Math.sin(0.4) * 0.9, rz = o.z - dx * Math.sin(0.4) + dz * Math.cos(0.4) * 0.9;
        bois.push(colorer(place(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8), { x: rx, y: 0.5, z: rz, rx: Math.PI / 2, rz: 0.4 }), BOIS[2]));
      }
      paille.push(colorer(place(new THREE.BoxGeometry(2, 0.6, 1.1), { x: o.x, y: 1.3, z: o.z, ry: 0.4 }), '#c9a45a', 0.15));
    } else if (o.genre === 'tonneaux') {
      for (const [dx, dz] of [[0, 0], [0.7, 0.3], [-0.4, 0.6]]) {
        bois.push(colorer(place(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 8), { x: o.x + dx, y: 0.45, z: o.z + dz }), BOIS[1], 0.1));
        fer.push(colorer(place(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 8), { x: o.x + dx, y: 0.7, z: o.z + dz }), '#2c2e33'));
      }
    } else if (o.genre === 'caisses') {
      caisses(bois, o);
    } else if (o.genre === 'tombe') {
      tombe(pierre, herbe, o, Math.round(o.z * 3 + o.x));
    } else if (o.genre === 'croix') {
      croix(bois, o);
    } else if (o.genre === 'arbre') {
      arbreMort(bois, o.x, o.z, Math.round(o.x * 7 + o.z * 3));
    } else if (o.genre === 'foin') {
      for (const [dx, dy, dz] of [[0, 0.35, 0], [0.9, 0.35, 0.2], [0.45, 1.05, 0.1]]) {
        paille.push(colorer(place(new THREE.BoxGeometry(1, 0.7, 0.7), { x: o.x + dx - 0.4, y: dy, z: o.z + dz }), '#d1b064', 0.15));
      }
    }
  }

  // L'étal de l'armurier : établi, auvent rayé, râtelier et enclume.
  const { x0, x1, z0, z1 } = ETAL;
  bois.push(colorer(place(new THREE.BoxGeometry(x1 - x0, 1.1, z1 - z0), { x: (x0 + x1) / 2, y: 0.55, z: (z0 + z1) / 2 }), BOIS[1], 0.08));
  bois.push(colorer(place(new THREE.BoxGeometry(x1 - x0 + 0.3, 0.1, z1 - z0 + 0.3), { x: (x0 + x1) / 2 + 0.1, y: 1.15, z: (z0 + z1) / 2 }), BOIS[2]));
  for (const z of [z0 + 0.1, z1 - 0.1]) bois.push(colorer(place(new THREE.BoxGeometry(0.14, 3.2, 0.14), { x: x1, y: 1.6, z }), BOIS[0]));
  for (let i = 0; i < 6; i++) {
    tissu.push(colorer(place(new THREE.BoxGeometry(x1 - x0 + 1, 0.05, (z1 - z0) / 6), { x: (x0 + x1) / 2 + 0.4, y: 3.1, z: z0 + ((i + 0.5) * (z1 - z0)) / 6, rz: -0.25 }), i % 2 ? '#e8dcc0' : '#8e1f24'));
  }
  fer.push(colorer(place(new THREE.BoxGeometry(0.5, 0.3, 0.9), { x: x1 + 0.9, y: 0.75, z: z0 - 0.6 }), '#2c2e33'));
  bois.push(colorer(place(new THREE.CylinderGeometry(0.25, 0.3, 0.6, 7), { x: x1 + 0.9, y: 0.3, z: z0 - 0.6 }), BOIS[0]));

  // Le temps a passé : lierre, fissures, meurtrières, linteaux des portes.
  for (const cote of ['nord', 'sud', 'ouest', 'est']) {
    const porteIci = cote !== 'est';
    for (const [k, a] of [-14, -9.5, -5, 6, 11, 15.5].entries()) {
      if (porteIci && Math.abs(a) < DEMI_PORTE + 1.5) continue;
      const graine = k * 5 + cote.length;
      const dedans = face(cote, a, false), dehors = face(cote, a + 1.3, true);
      if (hachage(graine, 1) > 0.35) lierre(feuilles, dedans.x, dedans.z, dedans.nx, dedans.nz, 1.8 + hachage(graine, 2) * 2.4, graine);
      if (hachage(graine, 3) > 0.45) lierre(feuilles, dehors.x, dehors.z, dehors.nx, dehors.nz, 2.5 + hachage(graine, 4) * 3, graine + 1);
      if (hachage(graine, 5) > 0.5) fissure(pierre, dedans.x + dedans.nz * 0.8, 3.6, dedans.z + dedans.nx * 0.8, dedans.nx, dedans.nz, graine);
      const fente = face(cote, a - 1.2, true);
      pierre.push(colorer(place(new THREE.BoxGeometry(fente.nz ? 0.16 : 0.06, 1.1, fente.nz ? 0.06 : 0.16), { x: fente.x + fente.nx * 0.03, y: 2.9, z: fente.z + fente.nz * 0.03 }), '#141312'));
    }
    if (porteIci) linteau(pierre, tissu, cote);
  }
  // Fenêtres des tours : quelques-unes éclairées, les autres noires.
  for (const [i, t] of TOURS.entries()) {
    for (const [k, y] of [2.8, 5.4].entries()) {
      for (let j = 0; j < 3; j++) {
        const a = ((j * 3 + i * 2 + k + 0.5) / 10) * Math.PI * 2;
        const r = (t.rayon - 0.1) * (1.08 - (0.08 * y) / H_TOUR) * Math.cos(Math.PI / 10) + 0.03;
        const pos = { x: t.x + Math.sin(a) * r, y, z: t.z + Math.cos(a) * r, ry: a };
        pierre.push(colorer(place(new THREE.BoxGeometry(0.5, 0.85, 0.06), pos), '#4a4640'));
        const allumee = hachage(i + j, k) > 0.4;
        const vitre = place(new THREE.BoxGeometry(0.34, 0.66, 0.08), pos);
        (allumee ? fenetres : pierre).push(allumee ? vitre : colorer(vitre, '#101014'));
      }
    }
  }
  // Paille au sol près du foin, de la charrette et de l'étal ; herbe entre
  // les pavés au pied des murs et hautes herbes dans le champ ; ossements.
  for (let k = 0; k < 70; k++) {
    const [cx, cz, r] = [[11, 9, 2.2], [-9, 7, 2.4], [-COUR + 3.5, 9, 2]][k % 3];
    const a = hachage(k, 3) * Math.PI * 2, d = Math.sqrt(hachage(k, 5)) * r;
    paille.push(colorer(place(new THREE.BoxGeometry(0.28, 0.012, 0.025), { x: cx + Math.cos(a) * d, y: 0.02, z: cz + Math.sin(a) * d, ry: hachage(k, 7) * 3 }), '#d1b064', 0.2));
  }
  const touffe = (x, z, taille, couleurs) => {
    for (let b = 0; b < 4; b++) {
      const a = hachage(x, z + b) * 6 + b * 1.7;
      herbe.push(colorer(place(new THREE.ConeGeometry(0.04 * taille, 0.4 * taille, 3), {
        x: x + Math.cos(a) * 0.07, y: 0.2 * taille, z: z + Math.sin(a) * 0.07, rx: Math.sin(a) * 0.35, rz: Math.cos(a) * 0.35,
      }), couleurs[b % couleurs.length], 0.15));
    }
  };
  for (let k = 0; k < 60; k++) {
    const cote = ['nord', 'sud', 'ouest', 'est'][k % 4];
    const a = (hachage(k, 11) * 2 - 1) * (COUR - 1);
    if (cote !== 'est' && Math.abs(a) < DEMI_PORTE + 0.5) continue;
    const f = face(cote, a, false);
    touffe(f.x - f.nx * -0.25, f.z - f.nz * -0.25, 0.6 + hachage(k, 13) * 0.5, FEUILLES);
  }
  for (let k = 0; k < 160; k++) {
    const a = hachage(k, 17) * Math.PI * 2, d = EXT + 1.5 + hachage(k, 19) * 11;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.max(Math.abs(x), Math.abs(z)) < EXT + 1 || OBSTACLES.some((o) => Math.hypot(o.x - x, o.z - z) < o.rayon + 0.3)) continue;
    touffe(x, z, 1 + hachage(k, 23) * 1.2, HERBE.map((c) => new THREE.Color(c).multiplyScalar(1.4)));
  }
  for (const [k, [x, z]] of [[25.4, -6], [25.2, 3.5], [27.3, 8], [-14, 14.5], [15.5, -15], [-9.8, -10.8]].entries()) ossements(pierre, x, z, k * 1.3 + 0.4);

  // Torches : sur le bord intérieur du chemin de ronde, aux portes et aux
  // coins de la terrasse. Flammes et halos brillent dans le noir.
  const torches = [];
  for (let a = -14; a <= 14; a += 7) {
    if (Math.abs(a) < DEMI_PORTE + 1.5) continue;
    torches.push([a, H_RONDE, -COUR + 0.2], [a, H_RONDE, COUR - 0.2], [-COUR + 0.2, H_RONDE, a], [COUR - 0.2, H_RONDE, a]);
  }
  for (const s of [-1, 1]) for (const c of [-1, 1]) torches.push([s * (TERRASSE.x1 - 0.3), H_TERRASSE + 1, c * (TERRASSE.z1 - 0.3)]);
  for (const c of [-1, 1]) torches.push([c * (DEMI_PORTE + 0.4), 3, COUR - 0.5], [c * (DEMI_PORTE + 0.4), 3, -COUR + 0.5], [-COUR + 0.5, 3, c * (DEMI_PORTE + 0.4)]);
  const flammes = [], halos = [];
  for (const [x, y, z] of torches) {
    bois.push(colorer(place(new THREE.CylinderGeometry(0.05, 0.04, 0.8, 5), { x, y: y + 0.4, z }), BOIS[0]));
    fer.push(colorer(place(new THREE.CylinderGeometry(0.11, 0.07, 0.14, 6), { x, y: y + 0.82, z }), '#2c2e33'));
    flammes.push(place(new THREE.ConeGeometry(0.12, 0.38, 5), { x, y: y + 1.05, z }));
    halos.push(x, y + 1.05, z);
  }
  const matFlamme = new THREE.MeshBasicMaterial({ color: '#ffb347', fog: false });
  const flamme = new THREE.Mesh(fusionnerFlammes(flammes), matFlamme);
  const geoHalos = new THREE.BufferGeometry();
  geoHalos.setAttribute('position', new THREE.Float32BufferAttribute(halos, 3));
  const matHalos = new THREE.PointsMaterial({
    map: textureHalo(), color: new THREE.Color(1.8, 1.8, 1.8), size: 1.4, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const lueurs = new THREE.Points(geoHalos, matHalos);
  // Des braises montent des torches ; la brume traîne dans le champ.
  const vie = [
    creerBraises(torches.map(([x, y, z]) => [x, y + 1.1, z]), 70),
    creerBrume({ n: 40, rayon: 34, carre: true, sol: () => 0 }),
  ];
  groupe.add(...vie);

  const maillages = [
    fusionner(pierre), fusionner(bois), fusionner(fer, { metalness: 0.4, roughness: 0.5 }), fusionner(ardoises), fusionner(tissu, { side: THREE.DoubleSide }),
    fusionner(paille), fusionner(herbe, { ombre: false }), fusionner(feuilles, { ombre: false, side: THREE.DoubleSide }),
  ];
  // Les fenêtres éclairées brillent de loin, à travers la nuit.
  const vitres = new THREE.Mesh(fusionnerFlammes(fenetres), new THREE.MeshBasicMaterial({ color: lumineux('#ffae4a', 3.2), fog: false }));
  maillages.push(vitres);
  groupe.add(...maillages, flamme, lueurs);
  groupe.add(enseigne(x1 + 0.05, 3.55, (z0 + z1) / 2));
  // Les armes en vente, au râtelier contre la muraille.
  for (const [id, y, dz] of [['fusil', 2.2, -1.6], ['lance', 1.75, 0], ['uzi', 1.75, 1.8]]) {
    const arme = creerModeleArme(id);
    // De profil, canon vers le sud, comme au râtelier de la cabane.
    arme.position.set(x0 + 0.15, y, (z0 + z1) / 2 + dz);
    arme.scale.setScalar(1.3);
    groupe.add(arme);
  }
  // La lampe de l'armurier : ile.js la sort du groupe pour garder le nombre
  // de lumières constant d'une carte à l'autre.
  const lampe = new THREE.PointLight('#ffcf85', 9, 12, 1.5);
  lampe.position.set(BOUTIQUE.x - 0.6, 2.7, BOUTIQUE.z);
  const ampoule = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd98a').multiplyScalar(8) }));
  ampoule.position.copy(lampe.position);
  groupe.add(ampoule, lampe);

  let temps = 0;
  groupe.userData.animer = (dt, nuit) => {
    temps += dt;
    for (const v of vie) v.userData.animer(dt, nuit);
    // Les flammes vacillent (toutes ensemble : une seule matière).
    const v = 0.85 + Math.sin(temps * 13) * 0.08 + Math.sin(temps * 7.3) * 0.07;
    matFlamme.color.setRGB(1, 0.62 + v * 0.1, 0.25 + v * 0.05).multiplyScalar(7);
    matHalos.size = 1.25 + v * 0.3;
  };
  return groupe;
}

function fusionnerFlammes(geos) {
  const tout = new THREE.BufferGeometry();
  const positions = [];
  for (const g of geos) {
    const p = (g.index ? g.toNonIndexed() : g).attributes.position.array;
    positions.push(...p);
  }
  tout.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return tout;
}
