// Rendu de la cour du château, à partir des blocs et rampes de chateau.js :
// ce qu'on voit est exactement ce qui bloque. Tout est fusionné par matière
// (pierre, bois, ardoise, tissu, flammes) : une poignée d'appels de dessin.
// Les torches brillent sans éclairer (pas de lumière ajoutée) : seule la
// lampe de l'armurier en est une, créée avec les autres (voir ile.js).

import * as THREE from 'three';
import { creerModeleArme } from './armes.js';
import {
  BLOCS, BOUTIQUE, COUR, DEMI_PORTE, ETAL, H_PARAPET, H_RONDE, H_TERRASSE, H_TOUR, OBSTACLES, RAMPES, TERRASSE, TOURS,
} from './chateau.js';
import { colorer, fusionner, hachage, place } from './geometrie.js';

const PIERRES = ['#8b857a', '#7f796f', '#958f84', '#77726a', '#8f887c'];
const PAVES = ['#6e6a63', '#78736b', '#65615b', '#827c73'];
const BOIS = ['#6b4a33', '#7a5638', '#5e412c'];
const HERBE = ['#35412c', '#3c4a30', '#2f3a27', '#46512f'];
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

export function creerChateau() {
  const groupe = new THREE.Group();
  const pierre = [], bois = [], fer = [], ardoises = [], tissu = [], paille = [], herbe = [];

  // Le champ autour, puis les pavés de la cour.
  sol(herbe, 70, 2.5, HERBE, -0.02, (x, z) => Math.max(Math.abs(x), Math.abs(z)) > COUR - 0.5);
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
    map: textureHalo(), size: 2.4, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const lueurs = new THREE.Points(geoHalos, matHalos);

  const maillages = [fusionner(pierre), fusionner(bois), fusionner(fer, { metalness: 0.4, roughness: 0.5 }), fusionner(ardoises), fusionner(tissu, { side: THREE.DoubleSide }), fusionner(paille), fusionner(herbe, { ombre: false })];
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
  const ampoule = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: '#ffd98a' }));
  ampoule.position.copy(lampe.position);
  groupe.add(ampoule, lampe);

  let temps = 0;
  groupe.userData.animer = (dt) => {
    temps += dt;
    // Les flammes vacillent (toutes ensemble : une seule matière).
    const v = 0.85 + Math.sin(temps * 13) * 0.08 + Math.sin(temps * 7.3) * 0.07;
    matFlamme.color.setRGB(1, 0.62 + v * 0.1, 0.25 + v * 0.05);
    matHalos.size = 2.2 + v * 0.5;
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
