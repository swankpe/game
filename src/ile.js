// Rendu de l'île et de l'environnement commun à toutes les cartes (ciel,
// étoiles, lune, ambiances). Tout le décor est fusionné par grandes familles
// (troncs, palmes, rochers, herbes…) : quelques appels de dessin au lieu de
// centaines. La cour du château (rendu-chateau.js) est construite aussi, et
// l'on montre l'une ou l'autre selon la carte de la manche.

import * as THREE from 'three';
import { creerModeleArme } from './armes.js';
import { colorer, fusionner, hachage, place } from './geometrie.js';
import { CABANE, CARTES, DECOR, PONTON, estHerbe, hauteurTerrain } from './monde.js';
import { creerChateau } from './rendu-chateau.js';

const TEINTES = {
  herbe: '#8dba58',
  sable: '#f0dfb2',
  sableMouille: '#d9c28c',
  fond: '#c3ab78',
  tronc: '#74443a',
  palmes: ['#6cb33f', '#5aa334', '#4d9130'],
  noix: '#6b4a2b',
  rochers: ['#8c8479', '#7a736b', '#9a9186'],
  bois: ['#a07c56', '#94704c', '#aa865f'],
  boisSombre: '#6b4a33',
  planches: ['#cbb89e', '#bea98d'],
  toit: '#e6e0d4',
  comptoir: '#8a6a4c',
};

function creerCiel() {
  const geo = new THREE.SphereGeometry(600, 24, 12);
  const haut = new THREE.Color('#5d9fe6'), horizon = new THREE.Color('#cfe7f7');
  const pos = geo.attributes.position;
  const couleurs = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 600);
    c.copy(horizon).lerp(haut, Math.pow(t, 0.6));
    couleurs.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  const ciel = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  return ciel;
}

function creerTerrain() {
  const demi = 48, n = 84, pas = (demi * 2) / n;
  const sommet = (i, j) => {
    // Grille légèrement déformée : des triangles irréguliers, plus naturels.
    const bord = i === 0 || j === 0 || i === n || j === n;
    const x = -demi + i * pas + (bord ? 0 : (hachage(i, j) - 0.5) * pas * 0.6);
    const z = -demi + j * pas + (bord ? 0 : (hachage(j + 17, i) - 0.5) * pas * 0.6);
    return [x, hauteurTerrain(x, z), z];
  };
  const positions = [], couleurs = [];
  const c = new THREE.Color();
  const triangle = (a, b, d) => {
    positions.push(...a, ...b, ...d);
    const cx = (a[0] + b[0] + d[0]) / 3, cz = (a[2] + b[2] + d[2]) / 3;
    const h = (a[1] + b[1] + d[1]) / 3;
    let teinte = TEINTES.fond;
    if (h > 0.45 && estHerbe(cx, cz)) teinte = TEINTES.herbe;
    else if (h > 0.2) teinte = TEINTES.sable;
    else if (h > -0.2) teinte = TEINTES.sableMouille;
    c.set(teinte).multiplyScalar(0.96 + hachage(cx, cz) * 0.08);
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

function creerMer() {
  const geo = new THREE.PlaneGeometry(360, 360, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const base = Float32Array.from(geo.attributes.position.array);
  const mat = new THREE.MeshStandardMaterial({
    color: '#3f95d8', flatShading: true, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.84,
  });
  const mer = new THREE.Mesh(geo, mat);
  mer.receiveShadow = true;
  const pos = geo.attributes.position;
  mer.userData.animer = (t) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      pos.array[i * 3 + 1] =
        Math.sin(x * 0.18 + t * 1.1) * 0.07 + Math.cos(z * 0.23 + t * 0.9) * 0.06 + Math.sin((x + z) * 0.41 + t * 1.7) * 0.03;
    }
    pos.needsUpdate = true;
  };
  return mer;
}

function geometriePalme(longueur) {
  const n = 7, rangs = [];
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    const x = longueur * s;
    const y = longueur * (0.38 * s - 0.8 * s * s);
    // Bords dentelés : un rang sur deux est plus étroit.
    const w = longueur * 0.21 * Math.sin(Math.PI * Math.min(1, s * 1.1 + 0.05)) * (k % 2 ? 0.7 : 1);
    rangs.push([[x, y - w * 0.25, -w], [x, y + w * 0.3, 0], [x, y - w * 0.25, w]]);
  }
  const p = [];
  for (let k = 0; k < n; k++) {
    const [g0, c0, d0] = rangs[k], [g1, c1, d1] = rangs[k + 1];
    p.push(...g0, ...c0, ...g1, ...c0, ...c1, ...g1, ...c0, ...d0, ...c1, ...d0, ...d1, ...c1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return geo;
}

function creerPalmiers() {
  const troncs = [], palmes = [], noix = [];
  const haut = new THREE.Vector3(0, 1, 0);
  for (const [indice, p] of DECOR.palmiers.entries()) {
    const segments = 7;
    const longueur = p.hauteur / segments;
    const penche = new THREE.Vector3(Math.cos(p.direction), 0, Math.sin(p.direction));
    let point = new THREE.Vector3(p.x, hauteurTerrain(p.x, p.z) - 0.2, p.z);
    let direction = haut.clone();
    for (let s = 0; s < segments; s++) {
      const f = (s + 1) / segments;
      direction = haut.clone().addScaledVector(penche, p.inclinaison * Math.pow(f, 1.4) * 1.6).normalize();
      const geo = new THREE.CylinderGeometry(0.2 - f * 0.07, 0.26 - f * 0.07, longueur * 1.04, 5);
      const q = new THREE.Quaternion().setFromUnitVectors(haut, direction);
      const milieu = point.clone().addScaledVector(direction, longueur / 2);
      geo.applyQuaternion(q);
      geo.translate(milieu.x, milieu.y, milieu.z);
      troncs.push(colorer(geo, s % 2 ? TEINTES.tronc : '#81503f', 0.05));
      point = point.addScaledVector(direction, longueur);
    }
    const nbPalmes = 8;
    for (let i = 0; i < nbPalmes; i++) {
      const angle = p.rotation + (i / nbPalmes) * Math.PI * 2 + hachage(indice, i) * 0.4;
      const geo = geometriePalme(2.4 + hachage(i, indice) * 1.1);
      place(geo, { x: point.x, y: point.y, z: point.z, ry: angle, rz: 0.15 + hachage(indice + 3, i) * 0.35 });
      palmes.push(colorer(geo, TEINTES.palmes[(i + indice) % 3], 0.08));
    }
    for (let i = 0; i < 3; i++) {
      const a = p.rotation + i * 2.1;
      noix.push(colorer(place(new THREE.IcosahedronGeometry(0.16, 0), {
        x: point.x + Math.cos(a) * 0.22, y: point.y - 0.18, z: point.z + Math.sin(a) * 0.22,
      }), TEINTES.noix));
    }
  }
  const groupe = new THREE.Group();
  groupe.add(fusionner(troncs), fusionner(palmes, { side: THREE.DoubleSide }), fusionner(noix));
  return groupe;
}

function creerRochers() {
  const parties = DECOR.rochers.map((r) => {
    const t = r.taille;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    place(geo, { x: r.x, y: hauteurTerrain(r.x, r.z) - t * 0.2, z: r.z, ry: r.rotation, rx: r.teinte, sx: t * 1.2, sy: t * 0.7, sz: t });
    return colorer(geo, TEINTES.rochers[Math.floor(r.teinte * 3) % 3], 0.1);
  });
  return fusionner(parties);
}

function creerHerbes() {
  const parties = [];
  for (const [i, t] of DECOR.touffes.entries()) {
    const y = hauteurTerrain(t.x, t.z);
    for (let b = 0; b < 4; b++) {
      const a = t.rotation + b * 1.7;
      const geo = new THREE.ConeGeometry(0.045 * t.taille, 0.42 * t.taille, 3);
      place(geo, {
        x: t.x + Math.cos(a) * 0.08, y: y + 0.22 * t.taille, z: t.z + Math.sin(a) * 0.08,
        rx: Math.sin(a) * 0.35, rz: Math.cos(a) * 0.35,
      });
      parties.push(colorer(geo, TEINTES.palmes[(i + b) % 3], 0.12));
    }
  }
  return fusionner(parties, { ombre: false });
}

function creerCabane() {
  const { x: cx, z: cz, largeur, profondeur } = CABANE;
  const parties = [];
  const bloc = (l, h, p, couleur, pose) => parties.push(colorer(place(new THREE.BoxGeometry(l, h, p), pose), couleur, 0.06));

  let sol = -Infinity;
  for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
    sol = Math.max(sol, hauteurTerrain(cx + (dx * profondeur) / 2, cz + (dz * largeur) / 2));
  }
  const y = sol + 0.25;
  const hMur = 2.5, avant = cx + profondeur / 2, arriere = cx - profondeur / 2;

  for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
    const px = cx + dx * (profondeur / 2 - 0.1), pz = cz + dz * (largeur / 2 - 0.1);
    const bas = hauteurTerrain(px, pz) - 0.3;
    parties.push(colorer(place(new THREE.CylinderGeometry(0.1, 0.1, y - bas, 5), { x: px, y: (y + bas) / 2, z: pz }), TEINTES.boisSombre));
  }
  bloc(profondeur + 0.9, 0.18, largeur + 0.3, TEINTES.bois[0], { x: cx + 0.35, y, z: cz });
  bloc(0.6, 0.12, 1.4, TEINTES.bois[1], { x: avant + 1.05, y: y - 0.22, z: cz });

  const nbPlanches = 10;
  for (let i = 0; i < nbPlanches; i++) {
    const z = cz - largeur / 2 + (i + 0.5) * (largeur / nbPlanches);
    bloc(0.12, hMur, largeur / nbPlanches - 0.02, TEINTES.planches[i % 2], { x: arriere, y: y + hMur / 2, z });
    // Façade : bas du comptoir seulement, le haut est ouvert.
    bloc(0.12, 1.05, largeur / nbPlanches - 0.02, TEINTES.planches[(i + 1) % 2], { x: avant, y: y + 0.52, z });
  }
  for (const cote of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = arriere + (i + 0.5) * (profondeur / 8);
      bloc(profondeur / 8 - 0.02, hMur, 0.12, TEINTES.planches[i % 2], { x, y: y + hMur / 2, z: cz + cote * (largeur / 2) });
    }
    bloc(0.16, hMur, 0.16, TEINTES.boisSombre, { x: avant, y: y + hMur / 2, z: cz + cote * (largeur / 2) });
    // Pans du toit, faîte d'avant en arrière.
    bloc(profondeur + 0.8, 0.12, largeur / 2 + 0.55, TEINTES.toit, {
      x: cx, y: y + hMur + 0.55, z: cz + cote * (largeur / 4 + 0.12), rx: cote * 0.42,
    });
  }
  bloc(0.7, 0.08, largeur + 0.1, TEINTES.comptoir, { x: avant + 0.1, y: y + 1.08, z: cz });
  bloc(0.14, 0.3, largeur + 0.3, TEINTES.toit, { x: avant + 0.05, y: y + hMur - 0.05, z: cz });

  // Pignon triangulaire en façade.
  const forme = new THREE.Shape();
  forme.moveTo(-largeur / 2, 0);
  forme.lineTo(largeur / 2, 0);
  forme.lineTo(0, 1.05);
  forme.closePath();
  const pignon = new THREE.ExtrudeGeometry(forme, { depth: 0.1, bevelEnabled: false });
  parties.push(colorer(place(pignon, { x: avant - 0.05, y: y + hMur, z: cz, ry: Math.PI / 2 }), TEINTES.planches[0]));

  // Caisses de munitions sur le comptoir, râtelier au mur du fond.
  for (const [i, dz] of [-1.7, -1.05, 1.3].entries()) {
    parties.push(colorer(place(new THREE.BoxGeometry(0.34, 0.2, 0.26), { x: avant + 0.1, y: y + 1.22, z: cz + dz, ry: i * 0.2 }), '#4f5a34'));
    parties.push(colorer(place(new THREE.BoxGeometry(0.345, 0.04, 0.265), { x: avant + 0.1, y: y + 1.24, z: cz + dz, ry: i * 0.2 }), '#c9a227'));
  }
  bloc(0.06, 1.2, largeur - 0.6, TEINTES.boisSombre, { x: arriere + 0.1, y: y + 1.45, z: cz });

  const groupe = new THREE.Group();
  groupe.add(fusionner(parties));
  groupe.add(creerEnseigne(avant + 0.14, y + hMur + 0.35, cz));
  // Les armes en vente, accrochées de profil au râtelier.
  for (const [id, hauteur, dz] of [['fusil', 1.85, -0.2], ['lance', 1.35, -0.6], ['uzi', 1.35, 1.1]]) {
    const arme = creerModeleArme(id);
    arme.position.set(arriere + 0.2, y + hauteur, cz + dz);
    arme.scale.setScalar(1.3);
    groupe.add(arme);
  }
  // Une lampe au-dessus du comptoir : on retrouve l'armurerie dans le noir.
  const ampoule = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), new THREE.MeshBasicMaterial({ color: '#ffd98a' }));
  ampoule.position.set(avant + 0.25, y + hMur - 0.3, cz);
  const lampe = new THREE.PointLight('#ffcf85', 9, 11, 1.5);
  lampe.position.copy(ampoule.position);
  groupe.add(ampoule, lampe);
  return groupe;
}

function creerEnseigne(x, y, z) {
  const toile = document.createElement('canvas');
  toile.width = 512;
  toile.height = 128;
  const ctx = toile.getContext('2d');
  ctx.fillStyle = '#2f6b4f';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#e9e4d8';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = '#f7f1e3';
  ctx.font = 'bold 60px "Fredoka", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ARMURERIE', 256, 68);
  const texture = new THREE.CanvasTexture(toile);
  texture.colorSpace = THREE.SRGBColorSpace;
  const enseigne = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.55),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }),
  );
  enseigne.position.set(x, y, z);
  enseigne.rotation.y = Math.PI / 2;
  return enseigne;
}

function creerPonton() {
  const { x0, x1, z, largeur, hauteur } = PONTON;
  const parties = [];
  let i = 0;
  for (let x = x0 + 0.2; x < x1; x += 0.42, i++) {
    parties.push(colorer(place(new THREE.BoxGeometry(0.36, 0.08, largeur), { x, y: hauteur - 0.04, z, ry: (hachage(i, 2) - 0.5) * 0.03 }), TEINTES.bois[i % 3], 0.05));
  }
  for (const cote of [-1, 1]) {
    const zc = z + cote * (largeur / 2 - 0.15);
    parties.push(colorer(place(new THREE.BoxGeometry(x1 - x0, 0.14, 0.14), { x: (x0 + x1) / 2, y: hauteur - 0.16, z: zc }), TEINTES.boisSombre));
    for (let x = x0 + 0.3; x <= x1; x += 2.4) {
      const bas = Math.min(hauteurTerrain(x, zc), -0.2) - 0.8;
      parties.push(colorer(place(new THREE.CylinderGeometry(0.12, 0.13, hauteur + 0.3 - bas, 5), { x, y: (hauteur + 0.3 + bas) / 2, z: zc }), TEINTES.boisSombre));
    }
  }
  return fusionner(parties);
}

function creerBouees() {
  const bouees = [];
  for (const [i, [x, z]] of [[PONTON.x1 + 4, -5], [PONTON.x1 - 6, 7], [PONTON.x1 + 2, 9]].entries()) {
    const b = new THREE.Group();
    const rouge = new THREE.MeshStandardMaterial({ color: '#d8443a', flatShading: true, roughness: 0.6 });
    const blanc = new THREE.MeshStandardMaterial({ color: '#f5f2ea', flatShading: true, roughness: 0.6 });
    b.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), rouge));
    const haut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.6, 5), blanc);
    haut.position.y = 0.45;
    b.add(haut);
    b.position.set(x, 0, z);
    b.userData.phase = i * 2.1;
    b.traverse((o) => o.isMesh && (o.castShadow = true));
    bouees.push(b);
  }
  return bouees;
}

// Trois ambiances : le jour pour créer son perso, la nuit pendant les
// manches, et l'Illumination du protégé qui éclaire toute la carte.
const AMBIANCES = {
  jour: {
    ciel: '#ffffff', brouillard: '#cfe7f7', pres: 70, loin: 300,
    hemi: 1.5, hemiCiel: '#e2f2ff', hemiSol: '#e8d7a8',
    astre: 2.6, astreCouleur: '#fff3dc', etoiles: 0, lune: 0, mer: '#3f95d8',
  },
  // Nuit noire : au-delà de quelques mètres, seule la lanterne fait voir. La
  // distance du brouillard dépend de son niveau (voir vision()).
  nuit: {
    ciel: '#03050b', brouillard: '#010207', pres: 2, loin: 22,
    hemi: 0.04, hemiCiel: '#5a6fae', hemiSol: '#0d0d14',
    astre: 0.09, astreCouleur: '#8fa6f0', etoiles: 0.75, lune: 0.8, mer: '#06131f',
  },
  illumination: {
    ciel: '#3c5580', brouillard: '#2b3b5a', pres: 35, loin: 230,
    hemi: 1.05, hemiCiel: '#d4e0ff', hemiSol: '#3b3d4a',
    astre: 1.4, astreCouleur: '#e2ebff', etoiles: 0.3, lune: 0.7, mer: '#2a6aa8',
  },
};

function creerEtoiles() {
  const positions = [];
  const alea = (i) => hachage(i, i * 0.37 + 11);
  for (let i = 0; i < 700; i++) {
    const theta = alea(i) * Math.PI * 2;
    const hauteur = 0.08 + alea(i + 999) * 0.92;
    const r = Math.sqrt(1 - hauteur * hauteur) * 520;
    positions.push(Math.cos(theta) * r, hauteur * 520, Math.sin(theta) * r);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: '#dfe6ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
  }));
}

export function creerIle(scene) {
  scene.fog = new THREE.Fog('#cfe7f7', 70, 300);
  scene.background = scene.fog.color;
  const ciel = creerCiel();
  const etoiles = creerEtoiles();
  scene.add(ciel, etoiles);

  const hemi = new THREE.HemisphereLight('#e2f2ff', '#e8d7a8', 1.5);
  scene.add(hemi);
  const soleil = new THREE.DirectionalLight('#fff3dc', 2.6);
  soleil.position.set(28, 42, 18);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  Object.assign(soleil.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 140 });
  soleil.shadow.bias = -0.0005;
  soleil.shadow.normalBias = 0.03;
  scene.add(soleil);

  // La lune se lève dans la direction de la lumière : les ombres de la nuit
  // viennent bien d'elle.
  const lune = new THREE.Mesh(
    new THREE.IcosahedronGeometry(14, 1),
    new THREE.MeshBasicMaterial({ color: '#f4f0dc', fog: false, transparent: true, opacity: 0 }),
  );
  lune.position.copy(soleil.position).normalize().multiplyScalar(480);
  scene.add(lune);

  const mer = creerMer();
  const bouees = creerBouees();
  const decors = {
    ile: new THREE.Group().add(creerTerrain(), mer, creerPalmiers(), creerRochers(), creerHerbes(), creerCabane(), creerPonton(), ...bouees),
    chateau: creerChateau(),
  };
  // Les lampes des décors restent dans la scène, même quand leur décor est
  // caché (éteintes) : le nombre de lumières ne change pas d'une carte à
  // l'autre, donc aucun shader à recompiler au changement de carte.
  const lampes = [];
  for (const [id, decor] of Object.entries(decors)) {
    decor.updateMatrixWorld(true);
    const lumieres = [];
    decor.traverse((o) => o.isLight && lumieres.push(o));
    for (const l of lumieres) {
      scene.attach(l);
      lampes.push({ id, lumiere: l, intensite: l.intensity });
    }
    scene.add(decor);
  }
  let carteVue = null;
  function montrerCarte(indice) {
    const id = (CARTES[indice] ?? CARTES[0]).id;
    if (id === carteVue) return;
    carteVue = id;
    for (const [nom, decor] of Object.entries(decors)) decor.visible = nom === id;
    for (const l of lampes) l.lumiere.intensity = l.id === id ? l.intensite : 0;
  }
  montrerCarte(0);

  // La nuit de cette île : sa portée change avec la lanterne.
  const nuit = { ...AMBIANCES.nuit };
  const ambiances = { ...AMBIANCES, nuit };
  let cible = ambiances.jour;
  const actuelle = { ...AMBIANCES.jour };
  const couleurs = Object.fromEntries(
    Object.entries(AMBIANCES.jour).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, new THREE.Color(v)]),
  );
  const tampon = new THREE.Color();

  function appliquer() {
    ciel.material.color.copy(couleurs.ciel);
    scene.fog.color.copy(couleurs.brouillard);
    scene.fog.near = actuelle.pres;
    scene.fog.far = actuelle.loin;
    hemi.intensity = actuelle.hemi;
    hemi.color.copy(couleurs.hemiCiel);
    hemi.groundColor.copy(couleurs.hemiSol);
    soleil.intensity = actuelle.astre;
    soleil.color.copy(couleurs.astreCouleur);
    etoiles.material.opacity = actuelle.etoiles;
    lune.material.opacity = actuelle.lune;
    lune.visible = actuelle.lune > 0.01;
    mer.material.color.copy(couleurs.mer);
  }

  return {
    // nom : 'jour' | 'nuit' | 'illumination'. instantane : sans fondu.
    ambiance(nom, instantane = false) {
      cible = ambiances[nom] ?? ambiances.jour;
      if (!instantane) return;
      Object.assign(actuelle, cible);
      for (const [k, c] of Object.entries(couleurs)) c.set(cible[k]);
      appliquer();
    },
    // Décor de la carte d'indice donné (CARTES dans monde.js).
    carte: montrerCarte,
    // Jusqu'où l'on voit la nuit (mètres) : la lanterne améliorée repousse le noir.
    vision(loin) {
      nuit.loin = loin;
      nuit.pres = Math.max(2, loin / 11);
    },
    mettreAJour(t, dt = 0) {
      mer.userData.animer(t);
      if (decors.chateau.visible) decors.chateau.userData.animer(dt);
      for (const b of bouees) {
        b.position.y = Math.sin(t * 1.3 + b.userData.phase) * 0.12;
        b.rotation.z = Math.sin(t * 0.9 + b.userData.phase) * 0.12;
      }
      const f = 1 - Math.exp(-dt * 2.2);
      for (const [k, v] of Object.entries(cible)) {
        if (typeof v === 'number') actuelle[k] += (v - actuelle[k]) * f;
        else couleurs[k].lerp(tampon.set(v), f);
      }
      appliquer();
    },
  };
}
