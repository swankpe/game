// Outils de construction low-poly partagés par le décor et les zombies :
// chaque pièce reçoit sa couleur par sommet, puis tout est fusionné en un seul
// maillage, donc un seul appel de dessin.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function hachage(a, b) {
  const s = Math.sin(a * 91.345 + b * 47.853) * 23421.631;
  return s - Math.floor(s);
}

export function colorer(geometrie, couleur, variation = 0) {
  const g = geometrie.index ? geometrie.toNonIndexed() : geometrie;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const couleurs = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i += 3) {
    c.set(couleur).multiplyScalar(1 + (hachage(i, n) - 0.5) * variation);
    for (let k = 0; k < 3 && i + k < n; k++) couleurs.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  return g;
}

export function place(geometrie, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  return geometrie.applyMatrix4(m);
}

export function fusionnerGeometries(parties) {
  for (const g of parties) if (!g.attributes.normal) g.computeVertexNormals();
  return mergeGeometries(parties);
}

// parties : [géométrie colorée déjà placée]. Une seule matière pour tout.
export function fusionner(parties, { ombre = true, ...options } = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, ...options });
  const m = new THREE.Mesh(fusionnerGeometries(parties), mat);
  m.castShadow = ombre;
  m.receiveShadow = true;
  return m;
}
