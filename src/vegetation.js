// Végétation instanciée : herbes hautes, buissons, sapins, feuillus,
// bananiers. Une géométrie par espèce (colorée par sommet, plus sombre au
// pied), puis un InstancedMesh par espèce : des milliers de touffes en un
// appel de dessin. Le vent les fait onduler, dans le shader (rien à
// recalculer côté JavaScript).

import * as THREE from 'three';
import { colorer, fusionnerGeometries, hachage, place } from './geometrie.js';

const temps = { value: 0 };

// Avance le vent (une fois par image, pour toutes les espèces).
export function souffler(dt) {
  temps.value = (temps.value + dt) % 1000;
}

// Le haut de la géométrie (y > 0) balance avec le vent, d'autant plus qu'il
// est haut ; chaque plante a sa phase, tirée de sa position.
function onduler(materiau, force) {
  materiau.onBeforeCompile = (shader) => {
    shader.uniforms.tempsVent = temps;
    shader.vertexShader = `uniform float tempsVent;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 socle = vec3(0.0);
        #ifdef USE_INSTANCING
          socle = instanceMatrix[3].xyz;
        #endif
        float h = max(position.y, 0.0);
        float o = sin(tempsVent * 1.6 + socle.x * 0.35 + socle.z * 0.27) + 0.5 * sin(tempsVent * 2.7 + socle.z * 0.6 + socle.x * 0.1);
        transformed.x += o * h * h * ${force.toFixed(4)};
        transformed.z += o * h * h * ${(force * 0.6).toFixed(4)};
      }`);
  };
  materiau.customProgramCacheKey = () => `onduler-${force}`;
  return materiau;
}

// Décale chaque sommet selon sa position (deux sommets confondus bougent
// ensemble : pas de fente entre les faces).
function bosseler(geo, force) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = Math.round(x * 97) + Math.round(y * 57) * 3 + Math.round(z * 31) * 7;
    p.setXYZ(i, x + (hachage(k, 1) - 0.5) * force, y + (hachage(k, 2) - 0.5) * force, z + (hachage(k, 3) - 0.5) * force);
  }
  return geo;
}

// Assombrit le pied d'une géométrie colorée (lumière qui ne passe pas).
function ombrerPied(geo, bas, haut, f = 0.55) {
  const p = geo.attributes.position, c = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, (p.getY(i) - bas) / (haut - bas)));
    const k = f + (1 - f) * t;
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return geo;
}

// Touffe d'herbe haute : des brins effilés, courbés vers l'extérieur, sombres
// au pied et clairs à la pointe. Normales vers le haut : les brins
// s'éclairent comme le sol, sans face noire.
function geometrieTouffe({ brins = 7, hauteur = 0.55, bas = '#2c5219', haut = '#9ccf52', etalement = 0.13 } = {}) {
  const positions = [], couleurs = [];
  const cb = new THREE.Color(bas), ch = new THREE.Color(haut), cm = new THREE.Color();
  for (let i = 0; i < brins; i++) {
    const a = hachage(i, 3) * Math.PI * 2, r = hachage(i, 5) * etalement;
    const h = hauteur * (0.55 + hachage(i, 7) * 0.7), l = 0.03 + hachage(i, 9) * 0.02;
    const penche = 0.12 + hachage(i, 11) * 0.35;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, dx = Math.cos(a), dz = Math.sin(a);
    const point = (t, s) => [x + dx * penche * h * t * t - dz * l * s * (1 - t), h * t, z + dz * penche * h * t * t + dx * l * s * (1 - t)];
    const b0 = point(0, -1), b1 = point(0, 1), m0 = point(0.55, -1), m1 = point(0.55, 1), s = point(1, 0);
    cm.copy(cb).lerp(ch, 0.55);
    for (const [p, c] of [[b0, cb], [b1, cb], [m1, cm], [b0, cb], [m1, cm], [m0, cm], [m0, cm], [m1, cm], [s, ch]]) {
      positions.push(...p);
      couleurs.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return geo;
}

// Buisson : quelques boules de feuillage bosselées, serrées.
function geometrieBuisson(teintes) {
  const parties = [];
  for (let k = 0; k < 5; k++) {
    const a = k * 2.4, r = k ? 0.35 : 0;
    const s = k ? 0.42 + hachage(k, 1) * 0.2 : 0.6;
    const geo = bosseler(new THREE.IcosahedronGeometry(1, 1), 0.25);
    place(geo, { x: Math.cos(a) * r, y: s * 0.75 + (k ? 0 : 0.1), z: Math.sin(a) * r, sx: s, sy: s * 0.8, sz: s });
    parties.push(colorer(geo, teintes[k % teintes.length], 0.12));
  }
  const geo = fusionnerGeometries(parties);
  return ombrerPied(geo, 0, 1, 0.5);
}

// Sapin : un tronc et des étages de branches dentelées, du plus large au
// plus étroit.
function geometrieSapin(teintes) {
  const parties = [colorer(place(new THREE.CylinderGeometry(0.1, 0.17, 1.6, 6), { y: 0.8 }), '#4a3526', 0.1)];
  const etages = 5;
  for (let k = 0; k < etages; k++) {
    const rayon = 1.55 - k * 0.27, h = 1.35 - k * 0.1;
    const geo = new THREE.ConeGeometry(rayon, h, 9, 1, true);
    // Bord dentelé : une pointe sur deux remonte et rentre.
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > -h / 2 + 0.01) continue;
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const pair = Math.round(((a + Math.PI) / (Math.PI * 2)) * 9) % 2;
      const f = pair ? 0.72 : 1.08;
      p.setXYZ(i, p.getX(i) * f, p.getY(i) + (pair ? 0.18 : -0.08), p.getZ(i) * f);
    }
    place(geo, { y: 1.1 + k * 0.72 + h / 2, ry: k * 0.7 });
    parties.push(colorer(geo, teintes[k % teintes.length], 0.1));
  }
  const geo = fusionnerGeometries(parties);
  return ombrerPied(geo, 0.8, 4.8, 0.55);
}

// Feuillu : tronc tordu, deux branches, un houppier de boules bosselées.
function geometrieFeuillu(teintes, ecorce = '#5a4030') {
  const parties = [];
  const rameau = (a, b, r0, r1) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va);
    const geo = new THREE.CylinderGeometry(r1, r0, d.length(), 6);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    geo.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
    parties.push(colorer(geo, ecorce, 0.12));
  };
  rameau([0, -0.2, 0], [0.15, 1.6, 0.05], 0.24, 0.17);
  rameau([0.15, 1.6, 0.05], [-0.1, 2.7, 0], 0.17, 0.1);
  rameau([0.15, 1.5, 0.05], [0.9, 2.5, 0.3], 0.1, 0.05);
  rameau([0.1, 1.9, 0], [-0.7, 2.6, -0.4], 0.09, 0.04);
  const boules = [[0, 3.3, 0, 1.25], [0.9, 2.9, 0.3, 0.9], [-0.8, 2.9, -0.4, 0.95], [0.2, 3.1, -0.9, 0.85], [-0.3, 3.2, 0.9, 0.85], [0.3, 4.0, 0.1, 0.8]];
  for (const [k, [x, y, z, s]] of boules.entries()) {
    const geo = bosseler(new THREE.IcosahedronGeometry(1, 1), 0.3);
    place(geo, { x, y, z, sx: s, sy: s * 0.82, sz: s });
    parties.push(colorer(geo, teintes[k % teintes.length], 0.12));
  }
  const geo = fusionnerGeometries(parties);
  return ombrerPied(geo, 1.8, 4.6, 0.5);
}

// Bananier : un stipe et de grandes feuilles en pagaie qui retombent.
function geometrieBananier(teintes) {
  const parties = [colorer(place(new THREE.CylinderGeometry(0.08, 0.13, 1.6, 6), { y: 0.8 }), '#6f7a3a', 0.12)];
  for (let k = 0; k < 7; k++) {
    const geo = new THREE.PlaneGeometry(0.45, 1.5, 1, 5);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + 0.75) / 1.5;
      // Une pagaie : large au milieu, pointue au bout, qui retombe.
      p.setX(i, p.getX(i) * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.08)));
      p.setZ(i, -t * t * 0.9 + Math.abs(p.getX(i)) * 0.3);
      p.setY(i, t * 1.5);
    }
    geo.rotateX(-0.6);
    place(geo, { y: 1.45 + (k % 3) * 0.1, ry: k * 0.9 + hachage(k, 2) });
    parties.push(colorer(geo, teintes[k % teintes.length], 0.1));
  }
  return fusionnerGeometries(parties);
}

const ESPECES = {
  herbe: () => ({ geo: geometrieTouffe(), vent: 0.35, ombre: false, cote: THREE.DoubleSide, lisse: true }),
  herbeSeche: () => ({ geo: geometrieTouffe({ brins: 6, hauteur: 0.5, bas: '#6b6036', haut: '#d8c98a' }), vent: 0.35, ombre: false, cote: THREE.DoubleSide, lisse: true }),
  herbeSombre: () => ({ geo: geometrieTouffe({ brins: 8, hauteur: 0.6, bas: '#1d2b14', haut: '#5f7a38' }), vent: 0.3, ombre: false, cote: THREE.DoubleSide, lisse: true }),
  buisson: () => ({ geo: geometrieBuisson(['#3f7a2a', '#4d8a30', '#35682a']), vent: 0.015, ombre: true }),
  buissonSombre: () => ({ geo: geometrieBuisson(['#2d4a23', '#35552a', '#263f1f']), vent: 0.015, ombre: true }),
  sapin: () => ({ geo: geometrieSapin(['#24452a', '#2b5230', '#1f3c25']), vent: 0.004, ombre: true }),
  feuillu: () => ({ geo: geometrieFeuillu(['#4f8a2e', '#5c9934', '#427a28']), vent: 0.006, ombre: true }),
  feuilluSombre: () => ({ geo: geometrieFeuillu(['#3a5a2a', '#44662e', '#2f4d24'], '#3f3024'), vent: 0.006, ombre: true }),
  bananier: () => ({ geo: geometrieBananier(['#5da83a', '#6fbf45', '#4f9832']), vent: 0.03, ombre: true, cote: THREE.DoubleSide }),
};

// plantes : [{ espece, x, y, z, rotation, echelle, teinte }] ; teinte ≈ 1
// (plus ou moins clair). Rend un groupe : un maillage instancié par espèce.
// ombres : faux pour ce qui est loin (hors de la carte d'ombres, inutile de
// le dessiner une deuxième fois pour elle).
export function creerVegetation(plantes, { ombres = true } = {}) {
  const groupe = new THREE.Group();
  const parEspece = new Map();
  for (const p of plantes) {
    if (!parEspece.has(p.espece)) parEspece.set(p.espece, []);
    parEspece.get(p.espece).push(p);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), haut = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), c = new THREE.Color();
  for (const [espece, liste] of parEspece) {
    const e = ESPECES[espece]();
    const materiau = onduler(new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, flatShading: !e.lisse, side: e.cote ?? THREE.FrontSide,
    }), e.vent);
    const maillage = new THREE.InstancedMesh(e.geo, materiau, liste.length);
    for (const [i, p] of liste.entries()) {
      const k = p.echelle ?? 1;
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromAxisAngle(haut, p.rotation ?? 0), s.set(k, k * (p.etire ?? 1), k));
      maillage.setMatrixAt(i, m);
      maillage.setColorAt(i, c.setScalar(p.teinte ?? 1));
    }
    maillage.castShadow = e.ombre && ombres;
    maillage.receiveShadow = true;
    maillage.computeBoundingSphere();
    groupe.add(maillage);
  }
  return groupe;
}
