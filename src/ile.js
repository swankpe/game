// Rendu de l'île et de l'environnement commun à toutes les cartes (ciel,
// étoiles, lune, ambiances). Tout le décor est fusionné par grandes familles
// (troncs, palmes, rochers, herbes…) : quelques appels de dessin au lieu de
// centaines. La cour du château (rendu-chateau.js) est construite aussi, et
// l'on montre l'une ou l'autre selon la carte de la manche.

import * as THREE from 'three';
import { creerBraises, creerBrume, creerLucioles } from './ambiance.js';
import { creerModeleArme } from './armes.js';
import { colorer, fusionner, hachage, lumineux, place } from './geometrie.js';
import { CABANE, CARTES, DECOR, PONTON, distanceRelative, estHerbe, hauteurTerrain, rayonIle, surPonton } from './monde.js';
import { caisses, creerChateau } from './rendu-chateau.js';
import { creerVegetation, souffler } from './vegetation.js';

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

function creerPalmiers(liste = DECOR.palmiers, sol = hauteurTerrain) {
  const troncs = [], palmes = [], noix = [];
  const haut = new THREE.Vector3(0, 1, 0);
  for (const [indice, p] of liste.entries()) {
    const segments = 7;
    const longueur = p.hauteur / segments;
    const penche = new THREE.Vector3(Math.cos(p.direction), 0, Math.sin(p.direction));
    let point = new THREE.Vector3(p.x, sol(p.x, p.z) - 0.2, p.z);
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
  const ampoule = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd98a').multiplyScalar(8) }));
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

// La barque échouée : un demi-tube effilé aux deux bouts, couché sur le
// flanc et à moitié ensablé, ses membrures, ses bancs, une rame à côté.
function coqueBarque() {
  const long = 1.7, bois = [];
  const coque = new THREE.CylinderGeometry(0.75, 0.75, long * 2, 12, 10, true, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
  const effiler = (x) => 1 - (x / long) ** 2 * 0.92;
  const pos = coque.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = effiler(pos.getX(i));
    pos.setY(i, pos.getY(i) * f * 0.62);
    pos.setZ(i, pos.getZ(i) * f);
  }
  coque.computeVertexNormals();
  const maillageCoque = new THREE.Mesh(colorer(coque, '#7a6248', 0.14), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, side: THREE.DoubleSide }));
  maillageCoque.castShadow = maillageCoque.receiveShadow = true;
  for (const x of [-1.1, -0.4, 0.3, 1]) {
    const f = effiler(x);
    const membrure = new THREE.TorusGeometry(0.72 * f, 0.035, 3, 8, Math.PI).rotateZ(Math.PI).rotateY(Math.PI / 2).scale(1, 0.62, 1).translate(x, 0, 0);
    bois.push(colorer(membrure, TEINTES.boisSombre, 0.1));
  }
  for (const x of [-0.6, 0.65]) bois.push(colorer(place(new THREE.BoxGeometry(0.28, 0.05, 1.3 * effiler(x)), { x, y: -0.12 }), TEINTES.bois[1], 0.1));
  bois.push(colorer(place(new THREE.BoxGeometry(long * 2 + 0.1, 0.06, 0.08), { y: -0.44 }), TEINTES.boisSombre, 0.1));
  // Planches arrachées.
  return { maillageCoque, bois };
}

function creerEpave(e) {
  const { maillageCoque, bois } = coqueBarque();
  for (const [x, rz, ry] of [[1.35, 0.8, 0.3], [-1.45, -0.5, -0.4]]) bois.push(colorer(place(new THREE.BoxGeometry(0.7, 0.03, 0.12), { x, y: 0.05, z: 0.35, rz, ry }), '#8a7054', 0.1));
  const groupe = new THREE.Group();
  groupe.add(maillageCoque, fusionner(bois));
  groupe.position.set(e.x, hauteurTerrain(e.x, e.z) + 0.12, e.z);
  groupe.rotation.order = 'YXZ';
  groupe.rotation.set(e.gite, -e.cap, 0);
  // La rame et un cordage enroulé, sur le sable.
  const sable = [];
  const cote = [Math.cos(e.cap + Math.PI / 2), Math.sin(e.cap + Math.PI / 2)];
  const [rx, rz] = [e.x + cote[0] * 1.5, e.z + cote[1] * 1.5];
  sable.push(colorer(place(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), { x: rx, y: hauteurTerrain(rx, rz) + 0.04, z: rz, rz: Math.PI / 2, ry: -e.cap + 0.3 }), TEINTES.bois[0], 0.1));
  const [px, pz] = [rx + Math.cos(e.cap - 0.3) * 1.2, rz + Math.sin(e.cap - 0.3) * 1.2];
  sable.push(colorer(place(new THREE.BoxGeometry(0.5, 0.025, 0.16), { x: px, y: hauteurTerrain(px, pz) + 0.04, z: pz, ry: -e.cap + 0.3 }), TEINTES.bois[0], 0.1));
  for (let k = 0; k < 3; k++) {
    const [cx, cz] = [e.x - cote[0] * 1.6, e.z - cote[1] * 1.6];
    sable.push(colorer(place(new THREE.TorusGeometry(0.22 - k * 0.05, 0.03, 3, 10), { x: cx, y: hauteurTerrain(cx, cz) + 0.04 + k * 0.04, z: cz, rx: Math.PI / 2 }), '#b8a47a', 0.1));
  }
  return new THREE.Group().add(groupe, fusionner(sable));
}

function creerBoisFlotte() {
  const parties = [];
  for (const [i, b] of DECOR.bois.entries()) {
    const y = hauteurTerrain(b.x, b.z) + b.rayon * 0.6;
    parties.push(colorer(place(new THREE.CylinderGeometry(b.rayon * 0.8, b.rayon, b.longueur, 6), { x: b.x, y, z: b.z, rz: Math.PI / 2, ry: b.cap }), '#b5a58a', 0.12));
    // Un chicot de branche.
    const d = (hachage(i, 3) - 0.5) * b.longueur * 0.6;
    parties.push(colorer(place(new THREE.CylinderGeometry(0.02, b.rayon * 0.5, 0.35, 4), {
      x: b.x + Math.cos(b.cap) * d, y: y + 0.12, z: b.z - Math.sin(b.cap) * d, rx: 0.6, ry: b.cap,
    }), '#a8987c', 0.1));
  }
  return fusionner(parties);
}

// Torches de bambou : leurs flammes brillent (sans éclairer), des braises
// s'en échappent.
function creerTorchesTiki() {
  const bois = [], flammes = [], foyers = [];
  for (const t of DECOR.torches) {
    const sol = hauteurTerrain(t.x, t.z);
    for (let k = 0; k < 3; k++) {
      bois.push(colorer(place(new THREE.CylinderGeometry(0.045, 0.05, 0.62, 6), { x: t.x, y: sol + 0.31 + k * 0.62, z: t.z }), k % 2 ? '#b89a5a' : '#a88a4c', 0.08));
      bois.push(colorer(place(new THREE.CylinderGeometry(0.056, 0.056, 0.04, 6), { x: t.x, y: sol + 0.62 + k * 0.62, z: t.z }), '#7a6238'));
    }
    bois.push(colorer(place(new THREE.CylinderGeometry(0.13, 0.06, 0.26, 7), { x: t.x, y: sol + 1.98, z: t.z }), '#6b4a2b', 0.12));
    flammes.push(place(new THREE.ConeGeometry(0.13, 0.42, 5), { x: t.x, y: sol + 2.3, z: t.z }));
    foyers.push([t.x, sol + 2.35, t.z]);
  }
  const matFlamme = new THREE.MeshBasicMaterial({ color: '#ffb347', fog: false });
  const geoFlammes = new THREE.BufferGeometry();
  geoFlammes.setAttribute('position', new THREE.Float32BufferAttribute(flammes.flatMap((g) => [...g.toNonIndexed().attributes.position.array]), 3));
  const halos = new THREE.BufferGeometry();
  halos.setAttribute('position', new THREE.Float32BufferAttribute(foyers.flat(), 3));
  const matHalos = new THREE.PointsMaterial({
    map: textureHalo(), color: new THREE.Color(1.8, 1.8, 1.8), size: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const braises = creerBraises(foyers, 36);
  const groupe = new THREE.Group().add(fusionner(bois), new THREE.Mesh(geoFlammes, matFlamme), new THREE.Points(halos, matHalos), braises);
  let temps = 0;
  groupe.userData.animer = (dt, nuit) => {
    temps += dt;
    const v = 0.85 + Math.sin(temps * 12) * 0.08 + Math.sin(temps * 7.9) * 0.07;
    matFlamme.color.setRGB(1, 0.62 + v * 0.1, 0.25 + v * 0.05).multiplyScalar(7);
    matHalos.size = 1.25 + v * 0.3;
    // Le jour, le halo s'efface : il ne se voit que dans la pénombre.
    matHalos.opacity = 0.15 + 0.85 * nuit;
    braises.userData.animer(dt, nuit);
  };
  return groupe;
}

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

const PETALES = ['#e84a5f', '#ffd166', '#f4f1de', '#b388eb', '#ff8c42'];

// Fougères, fleurs, coquillages, étoiles de mer, caisses : les petites choses.
function creerPetitDecor() {
  const plantes = [], sable = [], bois = [];
  for (const [i, p] of DECOR.plantes.entries()) {
    const y = hauteurTerrain(p.x, p.z);
    if (p.genre === 'fougere') {
      for (let k = 0; k < 7; k++) {
        const geo = geometriePalme(0.55 * p.taille * (0.8 + hachage(i, k) * 0.4));
        place(geo, { x: p.x, y: y + 0.05, z: p.z, ry: p.rotation + k * 0.9, rz: 0.55 + hachage(k, i) * 0.4 });
        plantes.push(colorer(geo, TEINTES.palmes[(i + k) % 3], 0.12));
      }
    } else {
      const h = 0.25 + p.taille * 0.2;
      plantes.push(colorer(place(new THREE.CylinderGeometry(0.008, 0.012, h, 3), { x: p.x, y: y + h / 2, z: p.z }), '#4d9130'));
      const couleur = PETALES[Math.floor(p.teinte * PETALES.length)];
      for (let k = 0; k < 5; k++) {
        const a = p.rotation + (k / 5) * Math.PI * 2;
        plantes.push(colorer(place(new THREE.IcosahedronGeometry(0.04, 0), { x: p.x + Math.cos(a) * 0.045, y: y + h, z: p.z + Math.sin(a) * 0.045, sy: 0.35 }), couleur, 0.1));
      }
      plantes.push(colorer(place(new THREE.IcosahedronGeometry(0.025, 0), { x: p.x, y: y + h + 0.01, z: p.z }), '#f2c14e'));
    }
  }
  for (const [i, c] of DECOR.coquillages.entries()) {
    const y = hauteurTerrain(c.x, c.z);
    if (c.genre === 'etoile') {
      for (let k = 0; k < 5; k++) {
        const a = c.rotation + (k / 5) * Math.PI * 2;
        sable.push(colorer(place(new THREE.ConeGeometry(0.025 * c.taille, 0.1 * c.taille, 3), {
          x: c.x + Math.cos(a) * 0.045 * c.taille, y: y + 0.015, z: c.z + Math.sin(a) * 0.045 * c.taille, rx: Math.PI / 2, rz: a - Math.PI / 2, sz: 0.4,
        }), c.teinte > 0.5 ? '#e0703a' : '#c8453a', 0.1));
      }
    } else {
      sable.push(colorer(place(new THREE.ConeGeometry(0.05 * c.taille, 0.06 * c.taille, 7), { x: c.x, y: y + 0.02, z: c.z, rx: 1.2, ry: c.rotation }), ['#f3e6d0', '#f2c9b8', '#e8d2a6'][i % 3], 0.1));
    }
  }
  for (const c of DECOR.caisses) {
    // Les caisses sont dessinées sur un sol en y = 0 : on les pose sur le sable.
    const debut = bois.length;
    caisses(bois, { x: c.x, z: c.z });
    for (const g of bois.slice(debut)) g.translate(0, hauteurTerrain(c.x, c.z) - 0.05, 0);
  }
  return new THREE.Group().add(fusionner(plantes, { ombre: false, side: THREE.DoubleSide }), fusionner(sable, { ombre: false }), fusionner(bois));
}

// L'écume au bord de l'eau : un ruban blanc sur la ligne du rivage, qui
// avance et recule avec les vagues. Deux rubans, en décalé.
function creerEcume() {
  const n = 160;
  const rivage = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Le rayon où le sable passe sous l'eau, par dichotomie.
    let bas = rayonIle(a) * 0.8, haut = rayonIle(a) * 1.3;
    for (let k = 0; k < 20; k++) {
      const m = (bas + haut) / 2;
      if (hauteurTerrain(Math.cos(a) * m, Math.sin(a) * m) > 0.03) bas = m;
      else haut = m;
    }
    rivage.push([a, bas]);
  }
  const rubans = [0, 1].map((r) => {
    const positions = [], couleurs = [], indices = [];
    for (const [i, [a, rayon]] of rivage.entries()) {
      for (const [k, d] of [-0.7, 0.2 + r * 0.5, 1.1 + r * 0.6].entries()) {
        const x = Math.cos(a) * (rayon + d), z = Math.sin(a) * (rayon + d);
        positions.push(x, Math.max(hauteurTerrain(x, z), 0) + 0.06, z);
        const alpha = k === 1 ? 0.35 + 0.65 * hachage(i * 0.37, r) ** 2 : 0;
        couleurs.push(1, 1, 1, alpha);
      }
      if (i < n) {
        const b = i * 3;
        indices.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 4));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, opacity: 0.8 }));
    m.renderOrder = 1;
    return m;
  });
  const groupe = new THREE.Group().add(...rubans);
  groupe.userData.animer = (t) => {
    for (const [r, m] of rubans.entries()) {
      const vague = Math.sin(t * 0.9 + r * 2.2);
      m.scale.set(1 + vague * 0.01, 1, 1 + vague * 0.01);
      m.material.opacity = 0.45 + 0.35 * Math.max(0, -vague);
    }
  };
  return groupe;
}

// Le ciel de nuit : halo de la lune, nuages qui dérivent, étoiles filantes.
function textureDouce(couleur, doux = 0.4) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  d.addColorStop(0, couleur);
  d.addColorStop(doux, couleur.replace(/[\d.]+\)$/, '0.35)'));
  d.addColorStop(1, couleur.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = d;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function textureNuage(graine) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  for (let k = 0; k < 16; k++) {
    const x = 50 + hachage(k, graine) * 156, y = 48 + hachage(graine, k) * 32, r = 16 + hachage(k + 9, graine) * 26;
    const d = g.createRadialGradient(x, y, 0, x, y, r);
    d.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    d.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = d;
    g.fillRect(0, 0, 256, 128);
  }
  // Bords toujours fondus : on ne garde que l'intérieur d'une ellipse floue.
  g.globalCompositeOperation = 'destination-in';
  g.setTransform(2, 0, 0, 1, 0, 0);
  const masque = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  masque.addColorStop(0.6, 'rgba(255, 255, 255, 1)');
  masque.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = masque;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function creerCielNocturne(lune) {
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textureDouce('rgba(200, 215, 255, 1)', 0.12), color: '#9fb2e6', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.setScalar(150);
  halo.position.copy(lune.position);
  const nuages = new THREE.Group();
  const matieres = [];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.SpriteMaterial({ map: textureNuage(i + 1), color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false });
    matieres.push(mat);
    const nuage = new THREE.Sprite(mat);
    const a = (i / 9) * Math.PI * 2 + hachage(i, 2), h = 70 + hachage(i, 3) * 120;
    nuage.position.set(Math.cos(a) * 430, h, Math.sin(a) * 430);
    nuage.scale.set(170 + hachage(i, 4) * 120, 60 + hachage(i, 5) * 30, 1);
    nuages.add(nuage);
  }
  // Étoile filante : un trait lumineux, de temps en temps.
  const trainee = new THREE.BufferGeometry();
  trainee.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  trainee.setAttribute('color', new THREE.Float32BufferAttribute([4, 4, 4.5, 0, 0, 0], 3));
  const filante = new THREE.Line(trainee, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  filante.frustumCulled = false;
  filante.visible = false;
  const vol = { attente: 6, t: 0, depart: new THREE.Vector3(), sens: new THREE.Vector3() };
  const nuit = new THREE.Color('#1c2436'), jour = new THREE.Color('#ffffff');
  const groupe = new THREE.Group().add(halo, nuages, filante);
  groupe.userData.animer = (dt, noirceur, opaciteLune) => {
    halo.material.opacity = opaciteLune * 0.55;
    halo.visible = opaciteLune > 0.01;
    nuages.rotation.y += dt * 0.004;
    for (const m of matieres) {
      m.color.copy(jour).lerp(nuit, noirceur);
      m.opacity = 0.75;
    }
    // Une étoile filante toutes les quinze à quarante secondes, la nuit.
    vol.attente -= dt;
    if (vol.attente <= 0 && noirceur > 0.8) {
      vol.attente = 15 + Math.random() * 25;
      vol.t = 0.9;
      const a = Math.random() * Math.PI * 2;
      vol.depart.set(Math.cos(a) * 380, 160 + Math.random() * 120, Math.sin(a) * 380);
      vol.sens.set(-Math.sin(a) * (Math.random() < 0.5 ? 1 : -1), -0.35, Math.cos(a)).normalize();
    }
    filante.visible = vol.t > 0;
    if (!filante.visible) return;
    vol.t -= dt;
    const avance = (0.9 - vol.t) * 260;
    const tete = vol.depart.clone().addScaledVector(vol.sens, avance);
    const queue = tete.clone().addScaledVector(vol.sens, -Math.min(avance, 45));
    trainee.attributes.position.setXYZ(0, tete.x, tete.y, tete.z);
    trainee.attributes.position.setXYZ(1, queue.x, queue.y, queue.z);
    trainee.attributes.position.needsUpdate = true;
    const e = Math.min(1, vol.t / 0.3) * 4;
    trainee.attributes.color.setXYZ(0, e, e, e * 1.1);
    trainee.attributes.color.needsUpdate = true;
  };
  return groupe;
}

// Herbes hautes, buissons, feuillus et bananiers : toute la végétation
// basse de l'île, instanciée. Les herbes sont tirées sur une grille décalée
// (hachage : la même île pour tous), denses dans l'herbe, rares sur le sable.
function creerVegetationIle() {
  const plantes = [];
  const genes = [
    ...DECOR.rochers.map((r) => ({ x: r.x, z: r.z, r: r.taille })),
    ...DECOR.palmiers.map((p) => ({ x: p.x, z: p.z, r: 0.35 })),
    ...DECOR.arbres.map((a) => ({ x: a.x, z: a.z, r: 0.4 })),
    ...(DECOR.camp ? [{ x: DECOR.camp.x, z: DECOR.camp.z, r: 1.3 }, { x: DECOR.camp.x + Math.cos(DECOR.camp.tente) * 3.2, z: DECOR.camp.z + Math.sin(DECOR.camp.tente) * 3.2, r: 1.6 }] : []),
    { x: 6, z: -3, r: 1.2 },
  ];
  const pas = 0.45;
  for (let i = -70; i <= 70; i++) {
    for (let j = -70; j <= 70; j++) {
      const x = i * pas + (hachage(i, j) - 0.5) * pas, z = j * pas + (hachage(j + 31, i) - 0.5) * pas;
      const h = hauteurTerrain(x, z);
      if (h < 0.28 || surPonton(x, z)) continue;
      if (Math.abs(x - CABANE.x) < CABANE.profondeur / 2 + 0.3 && Math.abs(z - CABANE.z) < CABANE.largeur / 2 + 0.3) continue;
      const herbe = estHerbe(x, z), t = distanceRelative(x, z);
      const chance = herbe ? 0.8 : t < 0.62 ? 0.14 : 0.035;
      if (hachage(i * 3.1, j * 1.7) > chance) continue;
      if (genes.some((g) => Math.hypot(g.x - x, g.z - z) < g.r)) continue;
      plantes.push({
        espece: herbe ? 'herbe' : 'herbeSeche', x, y: h - 0.03, z, rotation: hachage(i, j + 7) * 6.3,
        echelle: 0.7 + hachage(j, i + 3) * 0.7, teinte: 0.85 + hachage(i + 5, j) * 0.3,
      });
    }
  }
  for (const b of DECOR.buissons) {
    plantes.push({ espece: b.sombre ? 'buissonSombre' : 'buisson', x: b.x, y: hauteurTerrain(b.x, b.z) - 0.1, z: b.z, rotation: b.rotation, echelle: b.taille, teinte: 0.9 + hachage(b.x, b.z) * 0.2 });
  }
  for (const a of DECOR.arbres) {
    plantes.push({ espece: a.espece, x: a.x, y: hauteurTerrain(a.x, a.z) - 0.1, z: a.z, rotation: a.rotation, echelle: a.taille, teinte: 0.9 + hachage(a.z, a.x) * 0.2 });
  }
  return creerVegetation(plantes);
}

// Des flammes qui brillent sans éclairer, un halo, des braises : pour le feu
// de camp et les lanternes. foyers : [[x, y, z, taille]].
function creerFeux(foyers, braisesParFoyer = 6) {
  const flammes = [];
  for (const [x, y, z, t] of foyers) {
    flammes.push(place(new THREE.ConeGeometry(0.13 * t, 0.42 * t, 5), { x, y: y + 0.2 * t, z }));
    if (t > 1.5) for (const [dx, dz] of [[0.18, 0.1], [-0.15, 0.12], [0.02, -0.18]]) flammes.push(place(new THREE.ConeGeometry(0.1 * t * 0.6, 0.35 * t * 0.6, 5), { x: x + dx * t * 0.5, y: y + 0.1 * t, z: z + dz * t * 0.5 }));
  }
  const matFlamme = new THREE.MeshBasicMaterial({ color: '#ffb347', fog: false });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(flammes.flatMap((g) => [...g.toNonIndexed().attributes.position.array]), 3));
  const halos = new THREE.BufferGeometry();
  halos.setAttribute('position', new THREE.Float32BufferAttribute(foyers.flatMap(([x, y, z, t]) => [x, y + 0.2 * t, z]), 3));
  const matHalos = new THREE.PointsMaterial({
    map: textureHalo(), color: new THREE.Color(1.8, 1.8, 1.8), size: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const braises = creerBraises(foyers.map(([x, y, z, t]) => [x, y + 0.3 * t, z]), foyers.length * braisesParFoyer);
  const groupe = new THREE.Group().add(new THREE.Mesh(geo, matFlamme), new THREE.Points(halos, matHalos), braises);
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

const TOILE = '#d9cba3';

// Le camp des naufragés : cercle de pierres, bûches, sièges, tente de toile,
// totems sculptés. Rend { groupe, foyers } (foyers pour creerFeux).
function creerCamp(c) {
  const parties = [], toile = [];
  const sol = (x, z) => hauteurTerrain(x, z);
  const y = sol(c.x, c.z);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    parties.push(colorer(place(new THREE.IcosahedronGeometry(0.16, 0), { x: c.x + Math.cos(a) * 0.55, y: y + 0.05, z: c.z + Math.sin(a) * 0.55, sy: 0.7 }), TEINTES.rochers[k % 3], 0.1));
  }
  for (let k = 0; k < 4; k++) {
    parties.push(colorer(place(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 5), { x: c.x, y: y + 0.18, z: c.z, rz: 1.1, ry: k * 0.8 }), k % 2 ? '#3a2a1c' : TEINTES.boisSombre, 0.1));
  }
  // Trois bûches pour s'asseoir autour.
  for (let k = 0; k < 3; k++) {
    const a = c.tente + 1.2 + k * 1.3, d = 1.7;
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    parties.push(colorer(place(new THREE.CylinderGeometry(0.18, 0.2, 1.1, 7), { x, y: sol(x, z) + 0.15, z, rz: Math.PI / 2, ry: -a + Math.PI / 2 }), '#7a5a3c', 0.12));
  }
  // La tente : deux pans de toile sur un faîtage, des piquets, des cordes.
  const tx = c.x + Math.cos(c.tente) * 3.2, tz = c.z + Math.sin(c.tente) * 3.2, ty = sol(tx, tz);
  // Le faîtage suit la direction du feu : l'entrée de la tente lui fait face.
  const ry = -c.tente + Math.PI / 2;
  const pan = (cote) => {
    const g = new THREE.BoxGeometry(1.45, 0.03, 2.4);
    g.rotateZ(cote * 0.95);
    g.translate(cote * 0.52, 0.62, 0);
    g.rotateY(ry);
    g.translate(tx, ty, tz);
    return colorer(g, cote > 0 ? TOILE : '#cbbd94', 0.08);
  };
  toile.push(pan(-1), pan(1));
  for (const b of [-1.2, 1.2]) {
    const g = new THREE.CylinderGeometry(0.03, 0.03, 1.35, 5);
    g.translate(0, 0.67, b);
    g.rotateY(ry);
    g.translate(tx, ty, tz);
    parties.push(colorer(g, TEINTES.boisSombre));
  }
  const faite = new THREE.CylinderGeometry(0.025, 0.025, 2.6, 5).rotateX(Math.PI / 2).translate(0, 1.3, 0).rotateY(ry).translate(tx, ty, tz);
  parties.push(colorer(faite, TEINTES.boisSombre));
  // Un sac et une caisse devant la tente, une lanterne posée.
  const [dx, dz] = [Math.cos(c.tente + Math.PI), Math.sin(c.tente + Math.PI)];
  parties.push(colorer(place(new THREE.IcosahedronGeometry(0.28, 1), { x: tx + dx * 1.7 + dz * 0.7, y: sol(tx, tz) + 0.22, z: tz + dz * 1.7 - dx * 0.7, sy: 0.8 }), '#8a7a58', 0.1));
  parties.push(colorer(place(new THREE.BoxGeometry(0.5, 0.4, 0.4), { x: tx + dx * 1.6 - dz * 0.8, y: sol(tx, tz) + 0.2, z: tz + dz * 1.6 + dx * 0.8, ry }), TEINTES.bois[1], 0.1));
  // Totems : des poteaux sculptés de visages, plantés en arc.
  for (let k = 0; k < 2; k++) {
    const a = c.tente + Math.PI + (k ? 0.9 : -0.9), x = c.x + Math.cos(a) * 3.3, z = c.z + Math.sin(a) * 3.3, y0 = sol(x, z);
    for (let e = 0; e < 3; e++) {
      const h = y0 + 0.45 + e * 0.8;
      parties.push(colorer(place(new THREE.BoxGeometry(0.5, 0.78, 0.45), { x, y: h, z, ry: -a }), ['#8a5a3a', '#6e4a30', '#9a6a42'][e], 0.08));
      for (const cote of [-1, 1]) parties.push(colorer(place(new THREE.BoxGeometry(0.1, 0.1, 0.05), { x: x - Math.cos(a) * 0.23 + Math.sin(a) * cote * 0.11, y: h + 0.12, z: z - Math.sin(a) * 0.23 - Math.cos(a) * cote * 0.11, ry: -a }), e === 1 ? '#e8d27a' : '#1c1410'));
      parties.push(colorer(place(new THREE.BoxGeometry(0.28, 0.08, 0.05), { x: x - Math.cos(a) * 0.23, y: h - 0.15, z: z - Math.sin(a) * 0.23, ry: -a }), '#c8453a'));
    }
    parties.push(colorer(place(new THREE.BoxGeometry(0.9, 0.12, 0.2), { x, y: y0 + 2.5, z, ry: -a }), '#6e4a30', 0.1));
  }
  return { groupe: new THREE.Group().add(fusionner(parties), fusionner(toile, { side: THREE.DoubleSide })), foyers: [[c.x, y + 0.1, c.z, 2.2]] };
}

// Tour de guet sur pilotis : quatre pieds, des croisillons, une plate-forme à
// garde-corps, un toit de palmes, une échelle.
function creerTourDeGuet(t) {
  const parties = [], chaume = [];
  const y0 = Math.min(...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => hauteurTerrain(t.x + a * 1.2, t.z + b * 1.2)));
  const plancher = y0 + 3.4;
  const pose = (geo, x, y, z, ry = 0) => {
    geo.rotateY(ry);
    geo.translate(x, y, z);
    geo.rotateY(t.rotation);
    geo.translate(t.x, 0, t.z);
    return geo;
  };
  for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    parties.push(colorer(pose(new THREE.CylinderGeometry(0.1, 0.13, plancher - y0 + 2.2, 6), a * 1.2, (y0 + plancher + 2.2) / 2 - 0.3, b * 1.2), TEINTES.boisSombre, 0.1));
  }
  // Croisillons sur deux faces.
  for (const b of [-1, 1]) {
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.07, 3.3, 0.07).rotateZ(s * 0.62);
      parties.push(colorer(pose(g, 0, y0 + 1.7, b * 1.2), TEINTES.bois[2], 0.1));
      const h = new THREE.BoxGeometry(0.07, 3.3, 0.07).rotateX(s * 0.62);
      parties.push(colorer(pose(h, b * 1.2, y0 + 1.7, 0), TEINTES.bois[2], 0.1));
    }
  }
  for (let k = 0; k < 7; k++) parties.push(colorer(pose(new THREE.BoxGeometry(2.8, 0.08, 0.38), 0, plancher, -1.2 + k * 0.4), TEINTES.bois[k % 3], 0.08));
  for (const b of [-1, 1]) {
    parties.push(colorer(pose(new THREE.BoxGeometry(2.6, 0.07, 0.07), 0, plancher + 0.9, b * 1.25), TEINTES.bois[0], 0.08));
    parties.push(colorer(pose(new THREE.BoxGeometry(0.07, 0.07, 2.6), b * 1.25, plancher + 0.9, 0), TEINTES.bois[0], 0.08));
    for (let k = -2; k <= 2; k++) parties.push(colorer(pose(new THREE.BoxGeometry(0.05, 0.9, 0.05), k * 0.55, plancher + 0.45, b * 1.25), TEINTES.bois[1], 0.08));
  }
  // Toit à quatre pans de palmes, et son bord effrangé.
  chaume.push(colorer(pose(new THREE.ConeGeometry(2.3, 1.2, 4), 0, plancher + 2.55, 0, Math.PI / 4), '#b89a58', 0.15));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    chaume.push(colorer(pose(new THREE.BoxGeometry(0.4, 0.35, 0.03), Math.cos(a) * 1.55, plancher + 1.85, Math.sin(a) * 1.55, -a + Math.PI / 2), '#a88a4c', 0.2));
  }
  // Échelle.
  for (const c of [-0.25, 0.25]) parties.push(colorer(pose(new THREE.BoxGeometry(0.06, 3.9, 0.06).rotateX(-0.25), c, y0 + 1.8, 1.7), TEINTES.bois[0]));
  for (let k = 0; k < 9; k++) parties.push(colorer(pose(new THREE.BoxGeometry(0.5, 0.05, 0.05), 0, y0 + 0.3 + k * 0.4, 2.12 - k * 0.1), TEINTES.bois[1]));
  // Une lanterne pendue sous le toit, au centre.
  return { groupe: new THREE.Group().add(fusionner(parties), fusionner(chaume, { side: THREE.DoubleSide })), foyers: [[t.x, plancher + 1.5, t.z, 0.7]] };
}

// Réverbères : une potence et une lanterne. Rend { groupe, foyers }.
function creerReverberes() {
  const parties = [], foyers = [];
  for (const [i, r] of DECOR.reverberes.entries()) {
    const y = hauteurTerrain(r.x, r.z), a = hachage(i, 3) * Math.PI * 2;
    const [dx, dz] = [Math.cos(a) * 0.55, Math.sin(a) * 0.55];
    parties.push(colorer(place(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 6), { x: r.x, y: y + 1.3, z: r.z }), TEINTES.boisSombre, 0.1));
    parties.push(colorer(place(new THREE.BoxGeometry(0.7, 0.07, 0.07), { x: r.x + dx / 2, y: y + 2.5, z: r.z + dz / 2, ry: -a }), TEINTES.boisSombre));
    parties.push(colorer(place(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 6), { x: r.x + dx, y: y + 2.2, z: r.z + dz }), '#2c2e33'));
    parties.push(colorer(place(new THREE.ConeGeometry(0.13, 0.12, 6), { x: r.x + dx, y: y + 2.46, z: r.z + dz }), '#2c2e33'));
    parties.push(colorer(place(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 3), { x: r.x + dx, y: y + 2.46, z: r.z + dz }), '#2c2e33'));
    foyers.push([r.x + dx, y + 2.18, r.z + dz, 0.55]);
  }
  // Le panneau indicateur : trois flèches de bois.
  const p = DECOR.panneau, yp = hauteurTerrain(p.x, p.z);
  parties.push(colorer(place(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 6), { x: p.x, y: yp + 1.1, z: p.z }), TEINTES.boisSombre));
  for (const [k, a] of [0.3, 2.5, 4.4].entries()) {
    const g = new THREE.BoxGeometry(0.9, 0.2, 0.05).translate(0.4, 0, 0);
    g.rotateY(a);
    g.translate(p.x, yp + 1.85 - k * 0.3, p.z);
    parties.push(colorer(g, TEINTES.bois[k % 3], 0.1));
    const pointe = new THREE.ConeGeometry(0.1, 0.18, 3).rotateZ(-Math.PI / 2).scale(1, 1, 0.3).translate(0.94, 0, 0);
    pointe.rotateY(a);
    pointe.translate(p.x, yp + 1.85 - k * 0.3, p.z);
    parties.push(colorer(pointe, TEINTES.bois[k % 3], 0.1));
  }
  // Filets de pêche tendus entre deux perches, avec leurs flotteurs.
  const f = DECOR.filets, yf = hauteurTerrain(f.x, f.z);
  for (const c of [-1, 1]) parties.push(colorer(place(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 5), { x: f.x, y: yf + 1.1, z: f.z + c * 1.3 }), TEINTES.boisSombre));
  for (let k = 0; k < 7; k++) parties.push(colorer(place(new THREE.BoxGeometry(0.012, 0.012, 2.6), { x: f.x, y: yf + 0.6 + k * 0.22, z: f.z }), '#6a6250'));
  for (let k = 0; k < 11; k++) parties.push(colorer(place(new THREE.BoxGeometry(0.012, 1.35 - Math.abs(k - 5) * 0.03, 0.012), { x: f.x, y: yf + 1.26, z: f.z - 1.25 + k * 0.25 }), '#6a6250'));
  for (let k = 0; k < 6; k++) parties.push(colorer(place(new THREE.IcosahedronGeometry(0.06, 0), { x: f.x + 0.02, y: yf + 1.95, z: f.z - 1.1 + k * 0.44 }), k % 2 ? '#d8443a' : '#f5f2ea'));
  return { groupe: fusionner(parties), foyers };
}

// Barque amarrée au bout du ponton, qui danse sur l'eau.
function creerBarqueAmarree() {
  const { maillageCoque, bois } = coqueBarque();
  bois.push(colorer(place(new THREE.CylinderGeometry(0.03, 0.03, 2, 5), { x: 0.2, y: 0.02, z: 0.3, rz: Math.PI / 2, ry: 0.15 }), TEINTES.bois[0]));
  const barque = new THREE.Group().add(maillageCoque, fusionner(bois));
  barque.position.set(PONTON.x1 - 1.5, 0.15, PONTON.z + PONTON.largeur / 2 + 1.1);
  barque.userData.animer = (t) => {
    barque.position.y = 0.2 + Math.sin(t * 1.2) * 0.08;
    barque.rotation.set(Math.sin(t * 0.9) * 0.06, 0.1, Math.sin(t * 1.1 + 1) * 0.05);
  };
  return barque;
}

// Îlots sur l'horizon : un monticule de sable, une touffe d'herbe, des palmiers.
function creerIlots() {
  const parties = [], palmiers = [];
  for (const [i, o] of DECOR.ilots.entries()) {
    parties.push(colorer(place(new THREE.IcosahedronGeometry(1, 1), { x: o.x, y: -o.taille * 0.12, z: o.z, sx: o.taille, sy: o.taille * 0.22, sz: o.taille * 0.8 }), TEINTES.sable, 0.06));
    parties.push(colorer(place(new THREE.IcosahedronGeometry(1, 1), { x: o.x, y: o.taille * 0.02, z: o.z, sx: o.taille * 0.6, sy: o.taille * 0.12, sz: o.taille * 0.45 }), TEINTES.herbe, 0.1));
    for (let k = 0; k < o.palmiers; k++) {
      const a = hachage(i, k) * Math.PI * 2, d = hachage(k, i) * o.taille * 0.4;
      palmiers.push({ x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d * 0.7, hauteur: 5 + hachage(i + k, 3) * 3, inclinaison: 0.3, direction: a, rotation: a * 3 });
    }
  }
  // Les palmiers poussent sur le haut de leur îlot.
  const hauteurIlot = (x, z) => {
    const o = DECOR.ilots.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a));
    return o.taille * 0.12;
  };
  return new THREE.Group().add(fusionner(parties, { ombre: false }), creerPalmiers(palmiers, hauteurIlot));
}

// Quatre ambiances : le jour pour créer son perso, le crépuscule de la
// préparation, la nuit pendant les manches, et l'Illumination du protégé qui
// éclaire toute la carte.
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
  // Crépuscule : les 30 secondes de préparation, pour voir où l'on pose le
  // poteau avant que la nuit tombe.
  crepuscule: {
    ciel: '#e0907a', brouillard: '#4a3848', pres: 14, loin: 120,
    hemi: 0.5, hemiCiel: '#ffb08a', hemiSol: '#3a2e38',
    astre: 1.1, astreCouleur: '#ff9a5a', etoiles: 0.2, lune: 0.5, mer: '#2b4a70',
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
  const cielNocturne = creerCielNocturne(lune);
  scene.add(cielNocturne);

  const mer = creerMer();
  const bouees = creerBouees();
  const ecume = creerEcume();
  const tiki = creerTorchesTiki();
  const barque = creerBarqueAmarree();
  // Tout ce qui brûle sur l'île (hors torches de bambou) : feu de camp,
  // lanterne de la tour de guet, réverbères.
  const camp = DECOR.camp ? creerCamp(DECOR.camp) : null;
  const tour = DECOR.tour ? creerTourDeGuet(DECOR.tour) : null;
  const reverberes = creerReverberes();
  const feux = creerFeux([...(camp?.foyers ?? []), ...(tour?.foyers ?? []), ...reverberes.foyers]);
  // La nuit sur l'île : lucioles au-dessus de l'herbe, brume sur le sable.
  const vieIle = [
    creerLucioles(64, (i) => {
      for (let k = 0; ; k++) {
        const a = hachage(i, k + 40) * Math.PI * 2, r = 3 + hachage(k + 40, i) * 22;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (estHerbe(x, z) || k > 20) return [x, hauteurTerrain(x, z) + 0.5 + hachage(i, k) * 1.4, z];
      }
    }),
    creerBrume({ rayon: 36, sol: (x, z) => Math.max(hauteurTerrain(x, z), 0.05) }),
  ];
  const decors = {
    ile: new THREE.Group().add(
      creerTerrain(), mer, ecume, creerPalmiers(), creerRochers(), creerHerbes(), creerCabane(), creerPonton(), ...bouees, ...vieIle,
      tiki, creerBoisFlotte(), creerPetitDecor(), ...(DECOR.epave ? [creerEpave(DECOR.epave)] : []),
      creerVegetationIle(), barque, feux, reverberes.groupe, creerIlots(), ...(camp ? [camp.groupe] : []), ...(tour ? [tour.groupe] : []),
    ),
    chateau: creerChateau(),
  };
  let tempsIle = 0;
  decors.ile.userData.animer = (dt, nuit) => {
    tempsIle += dt;
    for (const v of vieIle) v.userData.animer(dt, nuit);
    tiki.userData.animer(dt, nuit);
    feux.userData.animer(dt, nuit);
    ecume.userData.animer(tempsIle);
    barque.userData.animer(tempsIle);
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

  const clarte = () => Math.min(Math.max((actuelle.hemi - AMBIANCES.nuit.hemi) / (AMBIANCES.jour.hemi - AMBIANCES.nuit.hemi), 0), 1);

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
    // De 0 (nuit noire) à 1 (plein jour), d'après la lumière du ciel : le
    // halo de post.js s'y règle.
    get jour() {
      return clarte();
    },
    // Jusqu'où l'on voit la nuit (mètres) : la lanterne améliorée repousse le noir.
    vision(loin) {
      nuit.loin = loin;
      nuit.pres = Math.max(2, loin / 11);
    },
    mettreAJour(t, dt = 0) {
      mer.userData.animer(t);
      souffler(dt);
      // Lucioles, braises et brume ne vivent que la nuit.
      const nuit = Math.min(1, actuelle.etoiles / AMBIANCES.nuit.etoiles);
      for (const decor of Object.values(decors)) if (decor.visible) decor.userData.animer(dt, nuit);
      cielNocturne.userData.animer(dt, 1 - clarte(), actuelle.lune);
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
