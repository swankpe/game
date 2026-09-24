// Pièces de décor partagées par les cartes : sol en relief, maisons à
// colombages, moulin, chapelle, étals, puits, charrette, feux, tombes,
// caisses, rochers, forêt lointaine. Chaque pièce est colorée par sommet et
// rangée par matière (matieres()) ; fusionnerMatieres() en fait un maillage
// par matière : quelques appels de dessin pour toute une carte.

import * as THREE from 'three';
import { creerBraises } from './ambiance.js';
import { colorer, fusionner, fusionnerGeometries, hachage, lumineux, place } from './geometrie.js';
import { creerVegetation } from './vegetation.js';

export const BOIS = ['#6b4a33', '#7a5638', '#5e412c'];
export const PIERRES = ['#8b857a', '#7f796f', '#958f84', '#77726a', '#8f887c'];
export const FER = '#2c2e33';
export const TOILE = '#cbbd94';
export const JUTE = ['#a08a60', '#8e7a52', '#b09a6a'];
export const PLATRE = ['#e8dfc8', '#ddd2b8', '#efe6d2'];
export const TUILES = ['#8a3a2a', '#7a3426', '#94442e'];
export const FLEURS = ['#e84a5f', '#ffd166', '#f4f1de', '#b388eb', '#ff8c42'];
export const FEUILLES = ['#3f5a2a', '#4a6b30', '#35502a', '#56733a'];
const ECORCE = '#3a332c';

// Les listes de pièces, par matière.
export const matieres = () => ({
  pierre: [], platre: [], bois: [], fer: [], tuiles: [], paille: [], tissu: [], feuilles: [], fenetres: [], braises: [],
});

// Positions seules (pour les matières qui ne s'éclairent pas).
export function fusionnerPositions(geos) {
  const tout = new THREE.BufferGeometry();
  const positions = [];
  for (const g of geos) positions.push(...(g.index ? g.toNonIndexed() : g).attributes.position.array);
  tout.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return tout;
}

// Un maillage par matière non vide. Les fenêtres éclairées et les braises
// brillent de loin, à travers la nuit (halo de post.js).
export function fusionnerMatieres(m) {
  const sortie = [];
  const si = (liste, f) => liste.length && sortie.push(f(liste));
  si(m.pierre, (l) => fusionner(l));
  si(m.platre, (l) => fusionner(l));
  si(m.bois, (l) => fusionner(l));
  si(m.fer, (l) => fusionner(l, { metalness: 0.35, roughness: 0.55 }));
  si(m.tuiles, (l) => fusionner(l));
  si(m.paille, (l) => fusionner(l));
  si(m.tissu, (l) => fusionner(l, { side: THREE.DoubleSide }));
  si(m.feuilles, (l) => fusionner(l, { ombre: false, side: THREE.DoubleSide }));
  si(m.fenetres, (l) => new THREE.Mesh(fusionnerPositions(l), new THREE.MeshBasicMaterial({ color: lumineux('#ffae4a', 3.2), fog: false })));
  si(m.braises, (l) => new THREE.Mesh(fusionnerPositions(l), new THREE.MeshBasicMaterial({ color: lumineux('#ff5a1f', 4), fog: false })));
  return sortie;
}

// Un fabricant de pièces dans un repère local : on construit l'objet autour
// de (0, 0, 0), il est posé en (o.x, y, o.z), tourné de ry.
export function atelier(o, ry = 0, y = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(o.x, y, o.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
  const p = (geo, pos, couleur, variation = 0.08) => colorer(place(geo, pos).applyMatrix4(m), couleur, variation);
  // Sans couleur : pour les vitres et les flammes.
  p.nu = (geo, pos) => place(geo, pos).applyMatrix4(m);
  return p;
}

// Plus bas point du sol sous une emprise (demi-côtés l, p) : on y pose un
// bâtiment, ses fondations rattrapent la pente.
export function assise(relief, x, z, l = 1, p = 1) {
  let h = Infinity;
  for (const [a, b] of [[0, 0], [-l, -p], [l, -p], [-l, p], [l, p]]) h = Math.min(h, relief(x + a, z + b));
  return h;
}

// Le sol : une grille un peu déformée qui suit le relief, une couleur par
// triangle (teinte(x, z, h)).
export function creerSol({ relief, demi, n, teinte }) {
  const pas = (demi * 2) / n;
  const sommet = (i, j) => {
    const bord = i === 0 || j === 0 || i === n || j === n;
    const x = -demi + i * pas + (bord ? 0 : (hachage(i, j) - 0.5) * pas * 0.6);
    const z = -demi + j * pas + (bord ? 0 : (hachage(j + 17, i) - 0.5) * pas * 0.6);
    return [x, relief(x, z), z];
  };
  const positions = [], couleurs = [];
  const c = new THREE.Color();
  const triangle = (a, b, d) => {
    positions.push(...a, ...b, ...d);
    const cx = (a[0] + b[0] + d[0]) / 3, cz = (a[2] + b[2] + d[2]) / 3, h = (a[1] + b[1] + d[1]) / 3;
    c.set(teinte(cx, cz, h)).multiplyScalar(0.94 + hachage(cx, cz) * 0.12);
    for (let k = 0; k < 3; k++) couleurs.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = sommet(i, j), b = sommet(i, j + 1), d = sommet(i + 1, j), e = sommet(i + 1, j + 1);
      triangle(a, b, d);
      triangle(b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  m.receiveShadow = true;
  return m;
}

// Halo des feux : un dégradé radial, en points additifs (un seul appel).
export function textureHalo() {
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

// Flammes qui vacillent, halos et braises qui montent. foyers : [x, y, z, t]
// (t : taille, 1 pour une torche, 3 pour un feu de camp).
export function creerFeux(foyers, braisesParFoyer = 6) {
  const flammes = [];
  for (const [x, y, z, t] of foyers) {
    flammes.push(place(new THREE.ConeGeometry(0.13 * t, 0.42 * t, 5), { x, y: y + 0.2 * t, z }));
    if (t > 1.5) for (const [dx, dz] of [[0.18, 0.1], [-0.15, 0.12], [0.02, -0.18]]) flammes.push(place(new THREE.ConeGeometry(0.1 * t * 0.6, 0.35 * t * 0.6, 5), { x: x + dx * t * 0.5, y: y + 0.1 * t, z: z + dz * t * 0.5 }));
  }
  const matFlamme = new THREE.MeshBasicMaterial({ color: '#ffb347', fog: false });
  const halos = new THREE.BufferGeometry();
  halos.setAttribute('position', new THREE.Float32BufferAttribute(foyers.flatMap(([x, y, z, t]) => [x, y + 0.2 * t, z]), 3));
  const matHalos = new THREE.PointsMaterial({
    map: textureHalo(), color: new THREE.Color(1.8, 1.8, 1.8), size: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const braises = creerBraises(foyers.map(([x, y, z, t]) => [x, y + 0.3 * t, z]), foyers.length * braisesParFoyer);
  const groupe = new THREE.Group().add(new THREE.Mesh(fusionnerPositions(flammes), matFlamme), new THREE.Points(halos, matHalos), braises);
  let temps = 0;
  groupe.userData.animer = (dt, nuit) => {
    temps += dt;
    const v = 0.85 + Math.sin(temps * 11) * 0.08 + Math.sin(temps * 7.1) * 0.07;
    matFlamme.color.setRGB(1, 0.62 + v * 0.1, 0.25 + v * 0.05).multiplyScalar(7);
    matHalos.size = 1.3 + v * 0.35;
    // Le jour, le halo s'efface : il ne se voit que dans la pénombre.
    matHalos.opacity = 0.15 + 0.85 * nuit;
    braises.userData.animer(dt, nuit);
  };
  return groupe;
}

// Une torche de bois à tête de fer : rend le foyer de sa flamme.
export function torche(m, x, y, z) {
  m.bois.push(colorer(place(new THREE.CylinderGeometry(0.05, 0.04, 0.8, 5), { x, y: y + 0.4, z }), BOIS[0]));
  m.fer.push(colorer(place(new THREE.CylinderGeometry(0.11, 0.07, 0.14, 6), { x, y: y + 0.82, z }), FER));
  return [x, y + 0.88, z, 1];
}

// Un rameau (tronc, branche, os) de a à b, plus fin au bout.
export function rameau(parties, a, b, r0, r1, couleur, cotes = 5) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const geo = new THREE.CylinderGeometry(r1, r0, d.length(), cotes);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  geo.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
  parties.push(colorer(geo, couleur, 0.1));
}

// Arbre mort : un tronc tordu, des branches nues qui griffent le ciel.
export function arbreMort(parties, x, y, z, graine) {
  const h = 4 + hachage(graine, 1) * 2.5;
  const cime = [x + (hachage(graine, 2) - 0.5) * 1.2, y + h, z + (hachage(graine, 3) - 0.5) * 1.2];
  rameau(parties, [x, y - 0.2, z], cime, 0.32, 0.1, ECORCE);
  for (let k = 0; k < 6; k++) {
    const t = 0.35 + k * 0.11;
    const p = [x + (cime[0] - x) * t, y - 0.2 + (h + 0.2) * t, z + (cime[2] - z) * t];
    const a = graine * 1.7 + k * 2.4;
    const l = (1.8 - k * 0.2) * (0.8 + hachage(k, graine) * 0.4);
    const q = [p[0] + Math.cos(a) * l, p[1] + l * 0.55, p[2] + Math.sin(a) * l];
    rameau(parties, p, q, 0.1 - k * 0.012, 0.03, ECORCE);
    for (const d of [-0.9, 0.7]) {
      const b = a + d;
      rameau(parties, q, [q[0] + Math.cos(b) * l * 0.45, q[1] + l * (0.3 + hachage(d, k) * 0.3), q[2] + Math.sin(b) * l * 0.45], 0.03, 0.01, ECORCE);
    }
  }
}

// Tombe : stèle arrondie gravée d'une croix, tertre devant, mousse dessus.
export function tombe(m, o, y, i) {
  const p = atelier(o, o.ry ?? 0, y);
  const teinte = PIERRES[i % PIERRES.length];
  const penche = { rz: o.penche ?? 0, rx: (o.penche ?? 0) * 0.5 };
  m.pierre.push(p(new THREE.BoxGeometry(0.62, 0.62, 0.16), { y: 0.3, ...penche }, teinte, 0.06));
  m.pierre.push(p(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 10), { y: 0.6, rx: Math.PI / 2 + penche.rx, rz: penche.rz }, teinte, 0.06));
  m.pierre.push(p(new THREE.BoxGeometry(0.06, 0.36, 0.02), { y: 0.52, z: 0.085, ...penche }, '#3e3a35'));
  m.pierre.push(p(new THREE.BoxGeometry(0.24, 0.06, 0.02), { y: 0.6, z: 0.085, ...penche }, '#3e3a35'));
  m.pierre.push(p(new THREE.BoxGeometry(0.72, 0.08, 0.22), { y: 0.02 }, PIERRES[(i + 2) % PIERRES.length]));
  m.pierre.push(p(new THREE.IcosahedronGeometry(0.5, 0), { y: -0.18, z: 0.8, sx: 0.7, sy: 0.4, sz: 1.4 }, '#3a2e24', 0.1));
  if (i % 2) m.feuilles.push(p(new THREE.IcosahedronGeometry(0.12, 0), { y: 0.88, x: 0.1, sy: 0.4 }, FEUILLES[i % 4], 0.1));
}

// Croix de bois plantée de travers.
export function croix(m, o, y) {
  const p = atelier(o, o.ry ?? 0, y);
  const rz = (o.penche ?? 0) * 2;
  m.bois.push(p(new THREE.BoxGeometry(0.1, 1.25, 0.1), { y: 0.55, rz }, BOIS[1], 0.1));
  m.bois.push(p(new THREE.BoxGeometry(0.6, 0.1, 0.09), { y: 0.85, rz }, BOIS[0], 0.1));
  m.pierre.push(p(new THREE.IcosahedronGeometry(0.45, 0), { y: -0.15, z: 0.75, sx: 0.7, sy: 0.4, sz: 1.4 }, '#3a2e24', 0.1));
}

// Pile de caisses cerclées (y : le sol).
export function caisses(bois, o, y = 0) {
  for (const [dx, dy, dz, c, ry] of [[-0.35, 0, -0.2, 0.8, 0.2], [0.45, 0, 0.15, 0.7, -0.3], [-0.2, 0.8, -0.1, 0.62, 0.5]]) {
    const pose = { x: o.x + dx, y: y + dy + c / 2, z: o.z + dz, ry };
    bois.push(colorer(place(new THREE.BoxGeometry(c, c, c), pose), BOIS[1], 0.12));
    // Arêtes renforcées.
    for (const [sx, sy, sz, ex, ey, ez] of [[1.02, 0.08, 1.02, 0, 0.46, 0], [1.02, 0.08, 1.02, 0, -0.46, 0], [0.08, 1, 1.03, 0.47, 0, 0], [0.08, 1, 1.03, -0.47, 0, 0]]) {
      const geo = new THREE.BoxGeometry(c * sx, c * sy, c * sz).translate(c * ex, c * ey, c * ez);
      bois.push(colorer(place(geo, pose), BOIS[2], 0.05));
    }
  }
}

// Rocher bosselé, à moitié enterré.
export function rocher(m, o, y, couleurs = PIERRES, mousse = false) {
  const t = o.taille ?? 1;
  const geo = new THREE.IcosahedronGeometry(t, 0);
  m.pierre.push(colorer(place(geo, { x: o.x, y: y + t * 0.15, z: o.z, sx: 1.25, sy: 0.75, sz: 1.05, ry: o.ry ?? 0 }), couleurs[Math.floor(hachage(o.x, o.z) * couleurs.length)], 0.12));
  if (mousse) m.feuilles.push(colorer(place(new THREE.IcosahedronGeometry(t * 0.7, 0), { x: o.x + t * 0.1, y: y + t * 0.62, z: o.z, sx: 1.3, sy: 0.25, sz: 1.1, ry: o.ry ?? 0 }), '#4a6b30', 0.15));
}

// Une maison à colombages : soubassement de pierre (qui rattrape la pente),
// murs de plâtre, poutres, toit à deux pans, cheminée, porte au milieu de la
// façade (+z local), fenêtres (certaines éclairées), un tonneau. Rend les
// foyers des deux torches de part et d'autre de la porte.
export function maison(m, { x, z, ry, l = 5.5, p = 4.2, h = 3.2, chaume = false }, y, i) {
  const pose = atelier({ x, z }, ry, y);
  m.pierre.push(pose(new THREE.BoxGeometry(l + 0.2, 1.4, p + 0.2), { y: -0.1 }, PIERRES[i % 4], 0.1));
  m.platre.push(pose(new THREE.BoxGeometry(l, h - 0.6, p), { y: 0.6 + (h - 0.6) / 2 }, PLATRE[i % 3], 0.04));
  // Colombages : poteaux, sablières, croix de Saint-André sur les pignons.
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
  m.bois.push(pose(new THREE.BoxGeometry(0.95, 1.9, 0.08), { y: 1.25, z: p / 2 + 0.04 }, '#4a3020', 0.05));
  m.fer.push(pose(new THREE.BoxGeometry(0.08, 0.08, 0.05), { x: 0.3, y: 1.25, z: p / 2 + 0.1 }, FER));
  // Fenêtres de part et d'autre de la porte, une derrière, une au pignon.
  const fenetres = [[-l / 4 - 0.3, 1.7, p / 2, 0], [l / 4 + 0.3, 1.7, p / 2, 0], [-l / 4, 1.7, -p / 2, Math.PI], [l / 2, h + 0.5, 0, Math.PI / 2]];
  for (const [k, [fx, fy, fz, fry]] of fenetres.entries()) {
    const allumee = hachage(i, k) > 0.35;
    const sx = Math.sin(fry), sz = Math.cos(fry);
    m.bois.push(pose(new THREE.BoxGeometry(0.8, 0.8, 0.08), { x: fx + sx * 0.05, y: fy, z: fz + sz * 0.05, ry: fry }, BOIS[2]));
    const vitre = pose.nu(new THREE.BoxGeometry(0.6, 0.6, 0.1), { x: fx + sx * 0.07, y: fy, z: fz + sz * 0.07, ry: fry });
    if (allumee) m.fenetres.push(vitre);
    else m.pierre.push(colorer(vitre, '#1a1c22'));
    m.bois.push(pose(new THREE.BoxGeometry(0.05, 0.62, 0.12), { x: fx + sx * 0.08, y: fy, z: fz + sz * 0.08, ry: fry }, BOIS[2]));
    m.bois.push(pose(new THREE.BoxGeometry(0.62, 0.05, 0.12), { x: fx + sx * 0.08, y: fy, z: fz + sz * 0.08, ry: fry }, BOIS[2]));
    if (fz > 0) m.feuilles.push(pose(new THREE.BoxGeometry(0.8, 0.14, 0.2), { x: fx, y: fy - 0.5, z: fz + 0.12 }, FLEURS[(i + k) % FLEURS.length], 0.2));
  }
  m.bois.push(pose(new THREE.CylinderGeometry(0.32, 0.28, 0.8, 8), { x: 0.95, y: 0.4, z: p / 2 + 0.5 }, BOIS[1], 0.1));
  // Les torches de la porte, fichées dans le mur.
  const foyers = [];
  for (const c of [-1, 1]) {
    const lx = c * 0.85, lz = p / 2 + 0.22;
    m.fer.push(pose(new THREE.BoxGeometry(0.06, 0.06, 0.3), { x: lx, y: 2.05, z: lz - 0.1 }, FER));
    m.bois.push(pose(new THREE.CylinderGeometry(0.045, 0.035, 0.5, 5), { x: lx, y: 2.2, z: lz, rx: 0.25 }, BOIS[0]));
    const monde = new THREE.Vector3(lx, 2.5, lz + 0.06).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    foyers.push([x + monde.x, y + monde.y, z + monde.z, 0.8]);
  }
  return foyers;
}

// Le moulin : une tour de pierre, un toit conique, quatre ailes qui tournent
// (côté +z local). Rend le rotor, à faire tourner.
export function moulin(m, x, y, z, ry = 0) {
  const p = atelier({ x, z }, ry, y);
  m.pierre.push(p(new THREE.CylinderGeometry(2.1, 2.8, 10, 10), { y: 4 }, PIERRES[0], 0.08));
  m.tuiles.push(p(new THREE.ConeGeometry(2.6, 2.8, 10), { y: 10.4 }, '#5a3a2a', 0.1));
  m.bois.push(p(new THREE.BoxGeometry(1, 2, 0.1), { y: 1, z: 2.75, rx: -0.05 }, '#4a3020'));
  for (const h of [4, 6.5]) m.fenetres.push(p.nu(new THREE.BoxGeometry(0.5, 0.7, 0.1), { y: h, z: 2.55 - (h - 4) * 0.08 }));
  const ailes = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    ailes.push(colorer(new THREE.BoxGeometry(0.2, 6, 0.12).translate(0, 3.2, 0).rotateZ(a), BOIS[0], 0.08));
    for (let j = 1; j < 6; j++) ailes.push(colorer(new THREE.BoxGeometry(1.3, 0.05, 0.05).translate(0.55, 0.6 + j, 0).rotateZ(a), BOIS[1]));
    ailes.push(colorer(new THREE.BoxGeometry(1.1, 5, 0.02).translate(0.65, 3.6, -0.04).rotateZ(a), '#d8cfb0', 0.05));
  }
  ailes.push(colorer(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8).rotateX(Math.PI / 2), BOIS[2]));
  const rotor = fusionner(ailes, { side: THREE.DoubleSide });
  const pivot = new THREE.Group();
  pivot.position.set(x + Math.sin(ry) * 2.9, y + 8.6, z + Math.cos(ry) * 2.9);
  pivot.rotation.y = ry;
  pivot.add(rotor);
  pivot.userData.rotor = rotor;
  return pivot;
}

// La chapelle : une nef, un clocher à flèche (à +z local), une rosace
// éclairée, des vitraux. Rend le foyer de la lanterne du porche.
export function chapelle(m, x, y, z, ry) {
  const p = atelier({ x, z }, ry, y);
  m.pierre.push(p(new THREE.BoxGeometry(5, 5.5, 9), { y: 1.75 }, PIERRES[2], 0.08));
  for (const f of [-1, 1]) m.tuiles.push(p(new THREE.BoxGeometry(0.2, 3.6, 9.6), { x: f * 1.45, y: 5.6, rz: f * 0.9 }, '#3b4152', 0.1));
  m.pierre.push(p(new THREE.BoxGeometry(2.4, 10, 2.4), { y: 4, z: 5.4 }, PIERRES[0], 0.08));
  m.tuiles.push(p(new THREE.ConeGeometry(1.9, 4.5, 4), { y: 11.25, z: 5.4, ry: Math.PI / 4 }, '#3b4152', 0.1));
  m.fer.push(p(new THREE.BoxGeometry(0.08, 1, 0.08), { y: 14, z: 5.4 }, '#b08a3a'));
  m.fer.push(p(new THREE.BoxGeometry(0.5, 0.08, 0.08), { y: 14.2, z: 5.4 }, '#b08a3a'));
  // Les abat-sons du clocher, noirs.
  for (const [dx, dz, r] of [[0, 1.21, 0], [0, -1.21, 0], [1.21, 0, Math.PI / 2], [-1.21, 0, Math.PI / 2]]) m.pierre.push(p(new THREE.BoxGeometry(0.7, 1.1, 0.06), { x: dx, y: 7.6, z: 5.4 + dz, ry: r }, '#141312'));
  m.fenetres.push(p.nu(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 12).rotateX(Math.PI / 2), { y: 5.8, z: 6.62 }));
  for (const d of [-2.5, 0, 2.5]) for (const f of [-1, 1]) m.fenetres.push(p.nu(new THREE.BoxGeometry(0.1, 1.6, 0.5), { x: f * 2.52, y: 2.6, z: d }));
  m.bois.push(p(new THREE.BoxGeometry(1.2, 2.2, 0.1), { y: 1.1, z: 6.62 }, '#4a3020'));
  // Marches devant la porte.
  m.pierre.push(p(new THREE.BoxGeometry(2, 0.3, 0.8), { y: 0, z: 7 }, PIERRES[1], 0.08));
  m.fer.push(p(new THREE.BoxGeometry(0.1, 0.4, 0.1), { x: 0.9, y: 2.6, z: 6.7 }, FER));
  const lanterne = new THREE.Vector3(0.9, 2.3, 6.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  return [x + lanterne.x, y + lanterne.y, z + lanterne.z, 0.8];
}

// Une citrouille, sa tige.
function citrouille(p, x, y, z, s = 1) {
  const orange = ['#d9792a', '#c8651f', '#e58a36'];
  return [
    p(new THREE.IcosahedronGeometry(0.22 * s, 1), { x, y: y + 0.15 * s, z, sy: 0.7 }, orange[Math.floor(hachage(x, z) * 3)], 0.12),
    p(new THREE.CylinderGeometry(0.02 * s, 0.03 * s, 0.1 * s, 4), { x, y: y + 0.32 * s, z, rz: 0.3 }, '#4d6a2a'),
  ];
}

// Le marché : un étal sous une toile rayée, des citrouilles, des paniers de
// pommes et de choux, des sacs.
export function marche(m, o, y) {
  const p = atelier(o, o.ry ?? 0.3, y);
  for (const [a, b] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) m.bois.push(p(new THREE.BoxGeometry(0.1, 2.5 + (b < 0 ? 0.3 : 0), 0.1), { x: a, y: 1.25 + (b < 0 ? 0.15 : 0), z: b }, BOIS[0]));
  for (let k = 0; k < 6; k++) m.tissu.push(p(new THREE.BoxGeometry(3.1, 0.04, 0.38), { x: 0, y: 2.62 + (2.5 - k) * 0.06, z: -1.05 + k * 0.38 + 0.12, rx: 0.16 }, k % 2 ? '#e8dcc0' : '#2f5a8a'));
  for (let k = 0; k < 8; k++) m.tissu.push(p(new THREE.ConeGeometry(0.2, 0.25, 3), { x: -1.4 + k * 0.4, y: 2.35, z: 1.2, rx: Math.PI }, k % 2 ? '#e8dcc0' : '#2f5a8a'));
  m.bois.push(p(new THREE.BoxGeometry(2.5, 0.08, 1.1), { y: 0.9, z: 0.1 }, BOIS[1]));
  for (const [a, b] of [[-1.15, -0.4], [1.15, -0.4], [-1.15, 0.6], [1.15, 0.6]]) m.bois.push(p(new THREE.BoxGeometry(0.08, 0.9, 0.08), { x: a, y: 0.45, z: b }, BOIS[2]));
  m.paille.push(...citrouille(p, -0.8, 0.94, 0.2), ...citrouille(p, -0.35, 0.94, 0.35, 0.8), ...citrouille(p, 1.0, 0, 1.0, 1.3), ...citrouille(p, 1.35, 0, 0.55));
  for (const [k, [x, couleur]] of [[0.2, '#b8261f'], [0.75, '#6b9a3a']].entries()) {
    m.bois.push(p(new THREE.CylinderGeometry(0.24, 0.18, 0.2, 8, 1, true), { x, y: 1.04, z: 0.15 }, '#a07844'));
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + k;
      m.paille.push(p(new THREE.IcosahedronGeometry(k ? 0.1 : 0.065, 0), { x: x + Math.cos(a) * 0.1, y: 1.13 + (i % 2) * 0.05, z: 0.15 + Math.sin(a) * 0.1 }, couleur, 0.15));
    }
  }
  for (const [i, [x, z]] of [[-1.25, -0.3], [-1.3, 0.35]].entries()) {
    m.paille.push(p(new THREE.IcosahedronGeometry(0.3, 1), { x, y: 0.28, z, sx: 0.9, sy: 1.1, sz: 0.8 }, JUTE[i], 0.1));
  }
}

// La forge : un foyer de pierre aux braises vives, une hotte et sa cheminée,
// une enclume, un soufflet, un baquet. Le long de l'axe x local. Rend le
// foyer d'où montent les braises.
export function forge(m, o, ry, y) {
  const p = atelier(o, ry, y);
  m.pierre.push(p(new THREE.BoxGeometry(2.2, 0.9, 1.4), { y: 0.45 }, PIERRES[1], 0.1));
  m.braises.push(p.nu(new THREE.BoxGeometry(1.3, 0.08, 0.8), { y: 0.93 }));
  for (let k = 0; k < 7; k++) m.pierre.push(p(new THREE.IcosahedronGeometry(0.12, 0), { x: -0.5 + k * 0.17, y: 0.95, z: (hachage(k, 2) - 0.5) * 0.5, sy: 0.5 }, '#2a2420'));
  m.pierre.push(p(new THREE.CylinderGeometry(0.45, 1.15, 1.2, 4), { y: 2.15, ry: Math.PI / 4 }, PIERRES[3], 0.08));
  m.pierre.push(p(new THREE.BoxGeometry(0.75, 2.6, 0.75), { y: 4 }, PIERRES[0], 0.08));
  for (const a of [-1, 1]) m.pierre.push(p(new THREE.BoxGeometry(0.2, 0.9, 1.2), { x: a * 1.0, y: 1.35 }, PIERRES[2]));
  m.bois.push(p(new THREE.CylinderGeometry(0.28, 0.32, 0.55, 8), { x: 1.75, y: 0.28, z: 0.2 }, BOIS[2], 0.1));
  m.fer.push(p(new THREE.BoxGeometry(0.55, 0.18, 0.25), { x: 1.75, y: 0.66, z: 0.2 }, FER));
  m.fer.push(p(new THREE.ConeGeometry(0.1, 0.3, 5), { x: 2.13, y: 0.68, z: 0.2, rz: -Math.PI / 2 }, FER));
  m.fer.push(p(new THREE.BoxGeometry(0.3, 0.16, 0.18), { x: 1.75, y: 0.49, z: 0.2 }, FER));
  m.bois.push(p(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), { x: 1.7, y: 0.8, z: 0.05, rz: Math.PI / 2, ry: 0.4 }, BOIS[1]));
  m.bois.push(p(new THREE.BoxGeometry(0.5, 0.2, 0.7), { x: -1.4, y: 0.75, z: -0.2, rz: 0.15 }, '#5a3a24'));
  m.bois.push(p(new THREE.CylinderGeometry(0.35, 0.32, 0.6, 9), { x: -1.4, y: 0.3, z: 0.7 }, BOIS[1], 0.1));
  m.fer.push(p(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 9), { x: -1.4, y: 0.58, z: 0.7 }, '#3a5a7a'));
  const f = new THREE.Vector3(0, 1.0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  return [o.x + f.x, y + f.y, o.z + f.z];
}

// Le puits : margelle, deux montants, un petit toit, le treuil.
export function puits(m, o, y) {
  const p = atelier(o, 0, y);
  m.pierre.push(p(new THREE.CylinderGeometry(1.2, 1.25, 1.3, 10, 1, true), { y: 0.25 }, PIERRES[0], 0.08));
  m.pierre.push(p(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 10), { y: 0.3 }, '#141312'));
  m.pierre.push(p(new THREE.TorusGeometry(1.15, 0.14, 4, 10), { y: 0.92, rx: Math.PI / 2 }, PIERRES[2]));
  for (const c of [-1, 1]) m.bois.push(p(new THREE.BoxGeometry(0.15, 2.2, 0.15), { x: c * 1.05, y: 1.1 }, BOIS[0]));
  m.tuiles.push(p(new THREE.ConeGeometry(1.5, 0.9, 4), { y: 2.55, ry: Math.PI / 4 }, '#5a3a2a'));
  m.bois.push(p(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 6), { y: 1.75, rz: Math.PI / 2 }, BOIS[1]));
  m.bois.push(p(new THREE.CylinderGeometry(0.16, 0.13, 0.25, 7), { x: 0.3, y: 1.3 }, BOIS[2]));
}

// La charrette : caisse, quatre roues, foin.
export function charrette(m, o, y) {
  const p = atelier(o, o.ry ?? 0, y);
  m.bois.push(p(new THREE.BoxGeometry(2.4, 0.5, 1.4), { y: 0.8 }, BOIS[1], 0.1));
  for (const [dx, dz] of [[-0.8, 0.75], [0.8, 0.75], [-0.8, -0.75], [0.8, -0.75]]) {
    m.bois.push(p(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8), { x: dx, y: 0.5, z: dz, rx: Math.PI / 2 }, BOIS[2]));
    m.fer.push(p(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 6), { x: dx, y: 0.5, z: dz, rx: Math.PI / 2 }, FER));
  }
  m.bois.push(p(new THREE.BoxGeometry(1.6, 0.08, 0.08), { x: 2, y: 0.65, z: 0.3, rz: 0.1 }, BOIS[0]));
  m.bois.push(p(new THREE.BoxGeometry(1.6, 0.08, 0.08), { x: 2, y: 0.65, z: -0.3, rz: 0.1 }, BOIS[0]));
  m.paille.push(p(new THREE.BoxGeometry(2, 0.6, 1.1), { y: 1.3 }, '#c9a45a', 0.15));
}

// Meule de foin roulée, couchée.
export function meule(m, o, y) {
  const p = atelier(o, o.ry ?? 0, y);
  m.paille.push(p(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 12), { y: 0.72, rz: Math.PI / 2 }, '#c9a45a', 0.12));
  m.paille.push(p(new THREE.CylinderGeometry(0.55, 0.55, 1.22, 12), { y: 0.72, rz: Math.PI / 2 }, '#b8924a', 0.08));
}

// Tronc couché le long de son axe (cap), avec quelques moignons de branches
// et de la mousse.
export function tronc(m, o, y) {
  const l = o.demi * 2 + o.rayon * 1.6;
  const p = atelier(o, -o.cap, y);
  m.bois.push(p(new THREE.CylinderGeometry(o.rayon, o.rayon * 1.1, l, 8), { y: o.rayon * 0.8, rz: Math.PI / 2 }, '#5a4030', 0.1));
  for (const s of [-1, 1]) m.bois.push(p(new THREE.CylinderGeometry(o.rayon * 0.92, o.rayon * 0.92, 0.04, 8), { x: s * l / 2, y: o.rayon * 0.8, rz: Math.PI / 2 }, '#b0915f'));
  for (let k = 0; k < 3; k++) m.bois.push(p(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 5), { x: -l / 3 + k * l / 3, y: o.rayon * 1.3, z: (k % 2 ? 1 : -1) * 0.2, rx: (k % 2 ? 1 : -1) * 0.9 }, '#5a4030'));
  m.feuilles.push(p(new THREE.BoxGeometry(l * 0.6, 0.06, o.rayon * 1.2), { x: 0.2, y: o.rayon * 1.72 }, '#4a6b30', 0.2));
}

// Une enseigne peinte (canvas) : texte en lettres dorées sur planche.
export function enseigne(texte, largeur = 2.6, hauteur = 0.8) {
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
  ctx.fillText(texte, 256, 84);
  const texture = new THREE.CanvasTexture(toile);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(largeur, hauteur), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, side: THREE.DoubleSide }));
}

// La forêt au-delà des bornes : on ne l'atteint pas, elle ferme l'horizon.
// Rend des plantes pour creerVegetation (sans ombres).
export function foretLointaine(borne, relief, { n = 520, loin = 34, graine = 1, especes = ['sapin', 'sapin', 'feuilluSombre'] } = {}) {
  const plantes = [];
  for (let k = 0; k < n * 3 && plantes.length < n; k++) {
    const x = (hachage(k, 61 + graine) * 2 - 1) * (borne + loin), z = (hachage(k, 63 + graine) * 2 - 1) * (borne + loin);
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < borne + 1.5) continue;
    plantes.push({
      espece: especes[Math.floor(hachage(k, 65 + graine) * especes.length)], x, y: relief(x, z) - 0.1, z,
      rotation: hachage(k, 67) * 6.3, echelle: 1.1 + hachage(k, 69) * 0.9 + Math.min(1, (d - borne) / 20) * 0.5, teinte: 0.7 + hachage(k, 71) * 0.3,
    });
  }
  return plantes;
}

// Les arbres d'une carte (obstacles sapin / feuillu) : végétation instanciée.
export function arbresDeCarte(obstacles, relief, sombre = false) {
  return obstacles.filter((o) => o.genre === 'sapin' || o.genre === 'feuillu').map((o) => ({
    espece: o.genre === 'sapin' ? 'sapin' : sombre ? 'feuilluSombre' : 'feuillu',
    x: o.x, y: relief(o.x, o.z) - 0.1, z: o.z, rotation: o.ry ?? 0, echelle: o.taille ?? 1, teinte: 0.85 + hachage(o.x, o.z) * 0.3,
  }));
}

export { creerVegetation, fusionnerGeometries };
