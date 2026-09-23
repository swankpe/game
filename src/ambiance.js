// Vie du décor la nuit : lucioles qui clignotent au-dessus de l'herbe, braises
// qui montent des torches, brume au ras du sol. Chaque famille est un seul
// appel de dessin (points additifs ou plans instanciés) dont on déplace les
// sommets à chaque image. Rien ne s'allume le jour : nuit va de 0 (plein
// jour) à 1 (nuit noire), voir ile.js.

import * as THREE from 'three';
import { hachage, lumineux } from './geometrie.js';

// Un point doux : blanc au centre, transparent au bord.
function texturePoint() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255, 255, 255, 1)');
  d.addColorStop(0.25, 'rgba(255, 255, 255, 0.6)');
  d.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function nuagePoints(n, couleur, taille) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    map: texturePoint(), color: couleur, vertexColors: true, size: taille, sizeAttenuation: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  points.frustumCulled = false;
  return points;
}

// Lucioles : chacune flotte autour d'un point d'attache et s'allume par
// brefs éclats. socle(i) → [x, y, z] : le point d'attache de la i-ième.
export function creerLucioles(n, socle) {
  const points = nuagePoints(n, lumineux('#d6ff72', 4.5), 0.16);
  const bases = [], phases = [];
  for (let i = 0; i < n; i++) {
    bases.push(socle(i));
    phases.push([hachage(i, 1) * 50, hachage(i, 2) * 50, 0.6 + hachage(i, 3) * 0.9, 0.8 + hachage(i, 4) * 1.6]);
  }
  const pos = points.geometry.attributes.position, col = points.geometry.attributes.color;
  let t = 0;
  points.userData.animer = (dt, nuit) => {
    t += dt;
    points.visible = nuit > 0.02;
    if (!points.visible) return;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = bases[i], [a, b, v, f] = phases[i];
      pos.setXYZ(i,
        x + Math.sin(t * 0.37 * v + a) * 1.2 + Math.sin(t * 0.9 * v + b) * 0.3,
        y + Math.sin(t * 0.5 * v + b) * 0.35,
        z + Math.cos(t * 0.31 * v + b) * 1.2 + Math.cos(t * 1.1 * v + a) * 0.3);
      // De brefs éclats, puis presque rien.
      const eclat = Math.pow(Math.max(0, Math.sin(t * f + a)), 8) * 0.9 + 0.08;
      const e = eclat * nuit;
      col.setXYZ(i, e, e, e);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  };
  return points;
}

// Braises : elles montent des foyers en tourbillonnant, rougissent et
// s'éteignent. foyers : [[x, y, z]].
export function creerBraises(foyers, n = 60) {
  const points = nuagePoints(n, lumineux('#ff8a2a', 6), 0.11);
  const etat = [];
  const pos = points.geometry.attributes.position, col = points.geometry.attributes.color;
  const renaitre = (e, i, age = 0) => {
    const [x, y, z] = foyers[Math.floor(Math.random() * foyers.length)];
    Object.assign(e, {
      x: x + (Math.random() - 0.5) * 0.15, y: y + 0.1, z: z + (Math.random() - 0.5) * 0.15,
      vie: 1.2 + Math.random() * 1.8, age, monte: 0.5 + Math.random() * 0.7, phase: Math.random() * 10, i,
    });
  };
  for (let i = 0; i < n; i++) {
    const e = {};
    renaitre(e, i, Math.random() * 2);
    etat.push(e);
  }
  points.userData.animer = (dt, nuit) => {
    points.visible = nuit > 0.02;
    if (!points.visible) return;
    for (const e of etat) {
      e.age += dt;
      if (e.age >= e.vie) renaitre(e, e.i);
      e.y += e.monte * dt;
      e.x += Math.sin(e.age * 3 + e.phase) * 0.25 * dt;
      e.z += Math.cos(e.age * 2.6 + e.phase) * 0.25 * dt;
      pos.setXYZ(e.i, e.x, e.y, e.z);
      // Vive au départ, puis elle rougit et pâlit ; elle scintille un peu.
      const reste = 1 - e.age / e.vie;
      const s = reste * reste * (0.75 + Math.sin(e.age * 25 + e.phase) * 0.25) * nuit;
      col.setXYZ(e.i, s, s * (0.4 + reste * 0.6), s * reste * 0.5);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  };
  return points;
}

// Motif de brume qui se répète sans raccord : des taches floues, recopiées
// de part et d'autre des bords.
function textureBrume() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255, 255, 255, 0.2)';
  g.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 14; k++) {
    const x = hachage(k, 7) * 128, y = hachage(k, 9) * 128, r = 14 + hachage(k, 11) * 30;
    for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) {
      const d = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      d.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      d.addColorStop(1, 'rgba(255, 255, 255, 0)');
      g.fillStyle = d;
      g.fillRect(0, 0, 128, 128);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Brume : des nappes au ras du sol, qui en épousent le relief (un plan
// posé à plat trancherait net dans les pentes). Leurs bords s'effacent
// (transparence par sommet) et le motif glisse avec le vent : la brume
// passe au travers des nappes. Elle ne brille pas : on ne la voit que dans
// la lumière (lanterne, lampes, lune). Un seul maillage pour toutes.
// sol(x, z) : hauteur du sol ; carre : zone carrée plutôt que ronde.
export function creerBrume({ n = 26, rayon, sol, carre = false, couleur = '#c3cbdb', opacite = 0.7 }) {
  const cotes = 7;
  const positions = [], couleurs = [], uvs = [], indices = [];
  for (let i = 0; i < n; i++) {
    const a = hachage(i, 21) * Math.PI * 2, r = Math.sqrt(hachage(i, 23)) * rayon;
    const [cx, cz] = carre ? [(hachage(i, 21) * 2 - 1) * rayon, (hachage(i, 23) * 2 - 1) * rayon] : [Math.cos(a) * r, Math.sin(a) * r];
    const taille = 7 + hachage(i, 25) * 7, hauteur = 0.25 + hachage(i, 27) * 0.45, tour = hachage(i, 29) * 6;
    const densite = 0.6 + hachage(i, 31) * 0.4;
    const debut = positions.length / 3;
    for (let u = 0; u <= cotes; u++) for (let v = 0; v <= cotes; v++) {
      const su = u / cotes - 0.5, sv = v / cotes - 0.5;
      const x = cx + (su * Math.cos(tour) - sv * Math.sin(tour)) * taille;
      const z = cz + (su * Math.sin(tour) + sv * Math.cos(tour)) * taille;
      positions.push(x, sol(x, z) + hauteur, z);
      const bord = Math.hypot(su, sv) * 2;
      const alpha = Math.max(0, 1 - bord) ** 1.5 * densite;
      couleurs.push(1, 1, 1, alpha);
      uvs.push(x / 11, z / 11);
    }
    for (let u = 0; u < cotes; u++) for (let v = 0; v < cotes; v++) {
      const k = debut + u * (cotes + 1) + v;
      indices.push(k, k + 1, k + cotes + 1, k + 1, k + cotes + 2, k + cotes + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 4));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const map = textureBrume();
  const mat = new THREE.MeshLambertMaterial({
    color: couleur, map, vertexColors: true, transparent: true, opacity: opacite, depthWrite: false, side: THREE.DoubleSide,
  });
  const nappes = new THREE.Mesh(geo, mat);
  nappes.renderOrder = 1;
  nappes.userData.animer = (dt, nuit) => {
    nappes.visible = nuit > 0.02;
    if (!nappes.visible) return;
    mat.opacity = opacite * nuit;
    // Le vent pousse vers l'est.
    map.offset.x -= dt * 0.035;
    map.offset.y -= dt * 0.012;
  };
  return nappes;
}
