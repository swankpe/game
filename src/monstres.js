// Les zombies à l'écran. Chaque zombie ne compte que 6 maillages (corps,
// yeux, deux bras, deux jambes) dont les géométries sont partagées : on peut
// en afficher des dizaines sans ralentir. Les positions viennent de l'hôte ;
// ici on ne fait que lisser, animer et tester les tirs.
//
// Quatre silhouettes, une par type (TYPES_ZOMBIES) : on doit reconnaître un
// coureur ou un bouffi de loin, dans la pénombre, à sa seule allure.

import * as THREE from 'three';
import { colorer, fusionnerGeometries, place } from './geometrie.js';
import { hauteurTerrain } from './monde.js';
import { HAUTEUR_MONSTRE, RAYON_MONSTRE, TYPES_ZOMBIES, premierTouche } from './regles.js';

const PROFIL_TETE = [[0, 0], [0.13, 0.02], [0.19, 0.09], [0.205, 0.19], [0.185, 0.3], [0.195, 0.41], [0.18, 0.51], [0.12, 0.59], [0, 0.63]];
const PROFONDEUR_MAX = -2.2;
const DUREE_CHUTE = 0.7;

const cylindre = (rh, rb, h, cotes, pos, couleur, variation = 0.1) =>
  colorer(place(new THREE.CylinderGeometry(rh, rb, h, cotes), pos), couleur, variation);
const boite = (x, y, z, pos, couleur, variation = 0) => colorer(place(new THREE.BoxGeometry(x, y, z), pos), couleur, variation);
const bosse = (r, pos, couleur, variation = 0.1) => colorer(place(new THREE.IcosahedronGeometry(r, 0), pos), couleur, variation);
const tete = (pos, couleur, variation = 0.1) =>
  colorer(place(new THREE.LatheGeometry(PROFIL_TETE.map(([r, y]) => new THREE.Vector2(r, y)), 7), pos), couleur, variation);
const oeil = (r, pos) => place(new THREE.IcosahedronGeometry(r, 0), pos);

// Penche tout le haut du corps vers l'avant autour des hanches (pivot en y),
// en reculant le bassin de recul : la tête reste au-dessus des pieds, là où
// le tir la cherche.
function incliner(geos, angle, pivot, recul) {
  const m = new THREE.Matrix4().makeTranslation(0, pivot, recul)
    .multiply(new THREE.Matrix4().makeRotationX(angle))
    .multiply(new THREE.Matrix4().makeTranslation(0, -pivot, 0));
  for (const g of geos) g.applyMatrix4(m);
  return m;
}

function finir(parties) {
  return {
    ...parties,
    tronc: fusionnerGeometries(parties.tronc),
    yeux: fusionnerGeometries(parties.yeux),
    jambe: fusionnerGeometries(parties.jambe),
    bras: fusionnerGeometries(parties.bras),
  };
}

// Rôdeur : le zombie ordinaire, bras tendus, pas traînant.
function construireRodeur(v) {
  return finir({
    tronc: [
      cylindre(0.23, 0.22, 0.3, 7, { y: 0.99 }, v.bas, 0.08),
      cylindre(0.19, 0.23, 0.52, 7, { y: 1.28 }, v.haut, 0.12),
      boite(0.12, 0.1, 0.03, { x: 0.07, y: 1.2, z: 0.215, rz: 0.4 }, v.trou),
      boite(0.09, 0.14, 0.03, { x: -0.1, y: 1.36, z: 0.2, rz: -0.3 }, v.trou),
      cylindre(0.085, 0.095, 0.1, 6, { y: 1.57 }, v.peau),
      tete({ y: 1.6, rz: 0.12, rx: 0.1 }, v.peau),
      // Bouche béante.
      boite(0.1, 0.06, 0.04, { y: 1.8, z: 0.17 }, '#1a0f0f'),
    ],
    yeux: [-1, 1].map((c) => oeil(0.034, { x: c * 0.075 + 0.02, y: 2.01, z: 0.165 })),
    jambe: [
      cylindre(0.11, 0.095, 0.74, 6, { y: -0.37 }, v.bas),
      boite(0.18, 0.14, 0.28, { y: -0.79, z: 0.04 }, '#26221f'),
    ],
    bras: [
      cylindre(0.07, 0.062, 0.5, 6, { y: -0.25 }, v.haut),
      bosse(0.08, { y: -0.56 }, v.peau, 0),
    ],
    hanches: [0.12, 0.86, 0],
    epaules: [0.27, 1.47, 0],
  });
}

// Coureur : maigre, voûté, côtes à l'air, grandes enjambées.
function construireCoureur(v) {
  const haut = [
    cylindre(0.15, 0.14, 0.24, 6, { y: 1.02 }, v.bas, 0.08),
    cylindre(0.14, 0.16, 0.44, 6, { y: 1.3 }, v.haut, 0.18),
    // Chemise en lambeaux : les côtes dépassent.
    ...[0, 1, 2].map((i) => boite(0.17 - i * 0.02, 0.022, 0.03, { y: 1.22 + i * 0.07, z: 0.14 }, v.peau)),
    boite(0.08, 0.16, 0.03, { x: 0.08, y: 1.08, z: 0.13, rz: 0.5 }, v.trou),
    cylindre(0.055, 0.065, 0.12, 6, { y: 1.55 }, v.peau),
    tete({ y: 1.58, sx: 0.88, sy: 0.9, sz: 0.9, rx: -0.25 }, v.peau),
    // Mâchoire décrochée, deux dents.
    boite(0.1, 0.09, 0.05, { y: 1.72, z: 0.15 }, '#1a0f0f'),
    ...[-1, 1].map((c) => boite(0.018, 0.03, 0.02, { x: c * 0.025, y: 1.755, z: 0.175 }, '#e8e0c8')),
    // Mèches de cheveux.
    ...[-0.08, 0, 0.07].map((x, i) => colorer(place(new THREE.TetrahedronGeometry(0.05), { x, y: 2.1 - i * 0.02, z: -0.05, rz: x * 3 }), '#2a2622')),
  ];
  const yeux = [-1, 1].map((c) => oeil(0.03, { x: c * 0.065, y: 1.93, z: 0.14 }));
  const penche = incliner([...haut, ...yeux], 0.42, 0.95, -0.14);
  const epaule = new THREE.Vector3(0.21, 1.43, 0).applyMatrix4(penche);
  return finir({
    tronc: haut,
    yeux,
    jambe: [
      cylindre(0.08, 0.065, 0.78, 6, { y: -0.39 }, v.bas),
      boite(0.12, 0.08, 0.24, { y: -0.82, z: 0.05 }, v.peau, 0.1),
    ],
    bras: [
      cylindre(0.048, 0.042, 0.58, 6, { y: -0.29 }, v.peau),
      // Griffes.
      ...[-1, 0, 1].map((c) => colorer(place(new THREE.ConeGeometry(0.018, 0.09, 4), { x: c * 0.025, y: -0.63, rx: Math.PI }), '#d9d2b8')),
    ],
    hanches: [0.1, 0.86, -0.14],
    epaules: [epaule.x, epaule.y, epaule.z],
  });
}

// Colosse : une montagne voûtée, tête enfoncée dans les épaules, poings énormes.
function construireColosse() {
  const peau = '#6c7a62', cuir = '#3b2d24', fer = '#5d626b';
  const haut = [
    cylindre(0.3, 0.27, 0.32, 8, { y: 0.98 }, cuir, 0.1),
    cylindre(0.36, 0.3, 0.62, 8, { y: 1.33 }, peau, 0.14),
    bosse(0.22, { x: 0.3, y: 1.62, z: 0 }, peau),
    bosse(0.22, { x: -0.3, y: 1.62, z: 0 }, peau),
    bosse(0.25, { y: 1.66, z: -0.14 }, peau),
    tete({ y: 1.58, z: 0.12, sx: 0.95, sy: 0.8, sz: 0.9 }, peau),
    // Mâchoire lourde, crocs.
    boite(0.22, 0.09, 0.12, { y: 1.68, z: 0.26 }, '#1a0f0f'),
    ...[-1, 1].map((c) => boite(0.03, 0.05, 0.03, { x: c * 0.07, y: 1.74, z: 0.31 }, '#e3dcc2')),
    // Sangle de cuir, épaulière de fer, cicatrices recousues.
    boite(0.08, 0.8, 0.05, { y: 1.34, z: 0.31, rz: 0.75, rx: -0.1 }, cuir),
    boite(0.3, 0.07, 0.3, { x: 0.34, y: 1.82, rz: -0.35 }, fer, 0.1),
    ...[0, 1, 2].map((i) => boite(0.012, 0.07, 0.02, { x: -0.16 + i * 0.05, y: 1.2 + i * 0.04, z: 0.33, rz: 0.6 }, '#2a1a18')),
  ];
  const yeux = [-1, 1].map((c) => oeil(0.03, { x: c * 0.08, y: 1.86, z: 0.3 }));
  incliner([...haut, ...yeux], 0.12, 0.95, -0.04);
  return finir({
    tronc: haut,
    yeux,
    jambe: [
      cylindre(0.15, 0.13, 0.72, 7, { y: -0.36 }, cuir),
      boite(0.26, 0.16, 0.34, { y: -0.78, z: 0.05 }, '#1f1b18'),
    ],
    bras: [
      cylindre(0.12, 0.1, 0.62, 7, { y: -0.31 }, peau),
      cylindre(0.12, 0.12, 0.08, 7, { y: -0.52 }, fer, 0),
      bosse(0.15, { y: -0.7 }, peau, 0.05),
    ],
    hanches: [0.17, 0.86, -0.04],
    epaules: [0.47, 1.6, 0.02],
  });
}

// Bouffi : un ventre énorme couvert de pustules qui luisent, prêt à éclater.
function construireBouffi() {
  const peau = '#a4ad5a', veine = '#6a4a64', haillon = '#554c3c';
  const ventre = { y: 1.14, z: 0.06 };
  // Angles (autour, en hauteur) des pustules sur le ventre.
  const pustules = [[0.4, 0.3], [-0.5, 0.1], [0.1, -0.35], [0.75, -0.1], [-0.2, 0.55], [-0.8, -0.3], [0.35, 0.75]];
  return finir({
    tronc: [
      cylindre(0.22, 0.2, 0.18, 7, { y: 0.8 }, haillon, 0.1),
      colorer(place(new THREE.IcosahedronGeometry(0.45, 1), { ...ventre, sx: 1, sy: 0.9, sz: 1.08 }), peau, 0.16),
      ...[[0.2, 0.9], [-0.3, 1.25], [0.05, 1.35]].map(([x, y], i) => boite(0.012, 0.22, 0.02, { x, y, z: 0.49, rz: 0.6 - i * 0.5 }, veine)),
      cylindre(0.2, 0.32, 0.22, 7, { y: 1.47 }, peau, 0.12),
      tete({ y: 1.5, sx: 0.85, sy: 0.78, sz: 0.85 }, peau),
      // Bave verdâtre.
      boite(0.08, 0.05, 0.04, { y: 1.66, z: 0.16 }, '#1a0f0f'),
      boite(0.03, 0.08, 0.03, { x: 0.02, y: 1.6, z: 0.175 }, '#8fd13a'),
    ],
    // Les pustules luisent avec les yeux : même matière, même maillage.
    yeux: [
      ...[-1, 1].map((c) => oeil(0.028, { x: c * 0.06, y: 1.84, z: 0.145 })),
      ...pustules.map(([a, b], i) => oeil(0.035 + (i % 3) * 0.012, {
        x: Math.sin(a) * Math.cos(b) * 0.45,
        y: ventre.y + Math.sin(b) * 0.4,
        z: ventre.z + Math.cos(a) * Math.cos(b) * 0.48,
      })),
    ],
    jambe: [
      cylindre(0.12, 0.1, 0.56, 6, { y: -0.28 }, haillon),
      boite(0.17, 0.12, 0.26, { y: -0.64, z: 0.04 }, peau, 0.1),
    ],
    bras: [
      cylindre(0.08, 0.07, 0.4, 6, { y: -0.2 }, peau),
      bosse(0.085, { y: -0.44 }, peau, 0),
    ],
    hanches: [0.15, 0.7, 0],
    epaules: [0.42, 1.44, 0.02],
  });
}

// Allure de chaque type : amplitude des pas, cadence, penchant et roulis.
const ALLURES = {
  rodeur: { foulee: 0.35, cadence: 2.2, penche: 0.12, roulis: 0.06, frappe: 9 },
  coureur: { foulee: 0.85, cadence: 2.4, penche: 0.06, roulis: 0.05, frappe: 12 },
  colosse: { foulee: 0.32, cadence: 1.1, penche: 0.06, roulis: 0.1, frappe: 4.5 },
  bouffi: { foulee: 0.3, cadence: 2.6, penche: -0.05, roulis: 0.17, frappe: 9 },
};

// Couleur des yeux (et des pustules) : rouge, jaune, rouge sang, vert acide.
const LUEURS = { rodeur: '#ff4a2e', coureur: '#ffd23a', colosse: '#ff1f10', bouffi: '#9dff4a' };

export function creerMonstresVue(scene) {
  const modeles = {
    rodeur: [
      { peau: '#8fa878', haut: '#4b4f5c', bas: '#3a3440', trou: '#252830' },
      { peau: '#9aa58a', haut: '#6b4a3a', bas: '#2f3a33', trou: '#3a281f' },
      { peau: '#7f9c8e', haut: '#5a5f3a', bas: '#3b3b46', trou: '#2f321e' },
    ].map(construireRodeur),
    coureur: [
      { peau: '#a9b3a2', haut: '#6e3b3b', bas: '#33343c', trou: '#1f1d22' },
      { peau: '#9fae9a', haut: '#3f5566', bas: '#2e2a26', trou: '#1c2228' },
    ].map(construireCoureur),
    colosse: [construireColosse()],
    bouffi: [construireBouffi()],
  };
  const matiere = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  // Des yeux qui brillent faiblement : on devine les zombies avant de les voir.
  const lueurs = Object.fromEntries(Object.entries(LUEURS).map(([id, c]) => [id, new THREE.MeshBasicMaterial({ color: c })]));
  const pulsation = [new THREE.Color('#6fdc2c'), new THREE.Color('#d6ff7a')];
  const vues = new Map();
  let temps = 0;

  function creer(id, k) {
    const type = TYPES_ZOMBIES[k] ?? TYPES_ZOMBIES[0];
    const liste = modeles[type.id];
    const g = liste[id % liste.length];
    const racine = new THREE.Group();
    // Le coureur est déjà plus bas, voûté : pas besoin de le réduire.
    racine.scale.setScalar(type.id === 'coureur' ? 1 : type.hauteur);
    const corps = new THREE.Group();
    racine.add(corps);
    // Seul le tronc projette une ombre : six fois moins de travail pour les
    // ombres quand la horde est là.
    const maille = (geo, mat = matiere, ombre = false) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = ombre;
      return m;
    };
    const tronc = maille(g.tronc, matiere, true);
    corps.add(tronc, maille(g.yeux, lueurs[type.id]));
    const membre = (geo, [x, y, z]) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      pivot.add(maille(geo));
      corps.add(pivot);
      return pivot;
    };
    const [hx, hy, hz] = g.hanches, [ex, ey, ez] = g.epaules;
    const parties = {
      corps,
      tronc,
      jambeG: membre(g.jambe, [hx, hy, hz]),
      jambeD: membre(g.jambe, [-hx, hy, hz]),
      brasG: membre(g.bras, [ex, ey, ez]),
      brasD: membre(g.bras, [-ex, ey, ez]),
    };
    scene.add(racine);
    return { racine, parties, type, allure: ALLURES[type.id], cible: null, phase: Math.random() * 6, mort: -1, choc: 0, vitesse: 0 };
  }

  function hauteur(x, z) {
    return Math.max(hauteurTerrain(x, z), PROFONDEUR_MAX);
  }

  function retirer(id, v) {
    v.racine.removeFromParent();
    vues.delete(id);
  }

  function animer(v, dt, vitesse) {
    const { parties: p, allure, type } = v;
    const attaque = v.cible?.a;
    v.phase += dt * (attaque ? allure.frappe : 2 + (vitesse / v.racine.scale.y) * allure.cadence);
    const s = Math.sin(v.phase);
    const pas = attaque ? 0 : s * allure.foulee;
    p.jambeG.rotation.x = pas;
    p.jambeD.rotation.x = -pas;
    p.corps.position.y = 0;
    if (type.id === 'coureur') {
      // Bras qui battent en courant ; au contact, les griffes lacèrent.
      p.brasG.rotation.x = attaque ? -1.35 + s * 0.7 : -0.35 - s * 0.9;
      p.brasD.rotation.x = attaque ? -1.35 - s * 0.7 : -0.35 + s * 0.9;
    } else if (type.id === 'colosse') {
      // Il marche en martelant ; au contact, les deux poings s'abattent.
      if (attaque) {
        const coup = (1 - Math.cos(v.phase)) / 2;
        p.brasG.rotation.x = p.brasD.rotation.x = -2.7 + coup * 2.3;
      } else {
        p.brasG.rotation.x = -0.35 - s * 0.35;
        p.brasD.rotation.x = -0.35 + s * 0.35;
        p.corps.position.y = -Math.abs(Math.cos(v.phase)) * 0.035;
      }
    } else if (type.id === 'bouffi') {
      p.brasG.rotation.x = -0.8 + s * 0.15;
      p.brasD.rotation.x = -0.8 - s * 0.15;
      p.brasG.rotation.z = 0.5;
      p.brasD.rotation.z = -0.5;
      // Le ventre gonfle et dégonfle.
      const souffle = 1 + Math.sin(temps * 5 + v.phase) * 0.035;
      p.tronc.scale.set(souffle, 1, souffle);
    } else {
      // Bras tendus ; au contact, ils frappent.
      const frappe = attaque ? s * 0.5 : Math.sin(v.phase * 0.5) * 0.08;
      p.brasG.rotation.x = -1.45 + frappe;
      p.brasD.rotation.x = -1.45 - frappe;
    }
    p.corps.rotation.x = allure.penche + v.choc;
    // Dandinement : le bouffi bascule à chaque pas, les autres oscillent.
    p.corps.rotation.z = type.id === 'bouffi' ? s * allure.roulis : Math.sin(v.phase * 0.5) * allure.roulis;
    v.choc = Math.min(0, v.choc + dt * 2.5);
  }

  return {
    // liste : [{ id, k, x, z, r, a }]. immediat : l'hôte affiche sa propre simulation.
    appliquer(liste, immediat = false) {
      const presents = new Set();
      for (const m of liste) {
        presents.add(m.id);
        let v = vues.get(m.id);
        if (!v) {
          v = creer(m.id, m.k ?? 0);
          vues.set(m.id, v);
          v.racine.position.set(m.x, hauteur(m.x, m.z), m.z);
          v.racine.rotation.y = m.r;
        }
        if (v.mort >= 0) continue;
        v.cible = m;
        if (immediat) {
          const d = Math.hypot(m.x - v.racine.position.x, m.z - v.racine.position.z);
          v.vitesse = d;
          v.racine.position.set(m.x, hauteur(m.x, m.z), m.z);
          v.racine.rotation.y = m.r;
        }
      }
      // Disparu de la liste : il est mort (ou la manche est finie), il tombe.
      // Un bouffi, lui, a éclaté : l'explosion le cache, il disparaît d'un coup.
      for (const [id, v] of vues) {
        if (v.mort >= 0 || presents.has(id)) continue;
        if (v.type.explosif) retirer(id, v);
        else v.mort = 0;
      }
    },

    mettreAJour(dt, immediat = false) {
      temps += dt;
      lueurs.bouffi.color.lerpColors(pulsation[0], pulsation[1], (Math.sin(temps * 5) + 1) / 2);
      const suivi = 1 - Math.exp(-dt * 6);
      for (const [id, v] of vues) {
        const { racine } = v;
        if (v.mort >= 0) {
          v.mort += dt;
          const t = Math.min(v.mort / DUREE_CHUTE, 1);
          racine.rotation.x = -t * t * Math.PI * 0.48;
          racine.position.y -= dt * 0.25 * t;
          if (v.mort > DUREE_CHUTE + 0.8) retirer(id, v);
          continue;
        }
        let vitesse = immediat && dt > 0 ? v.vitesse / dt : 0;
        if (!immediat && v.cible) {
          const avant = racine.position.clone();
          racine.position.x += (v.cible.x - racine.position.x) * suivi;
          racine.position.z += (v.cible.z - racine.position.z) * suivi;
          racine.position.y = hauteur(racine.position.x, racine.position.z);
          const d = Math.atan2(Math.sin(v.cible.r - racine.rotation.y), Math.cos(v.cible.r - racine.rotation.y));
          racine.rotation.y += d * suivi;
          vitesse = dt > 0 ? avant.distanceTo(racine.position) / dt : 0;
        }
        animer(v, dt, vitesse);
      }
    },

    // Recul visible à l'impact, avant même la réponse de l'hôte. Un colosse
    // bronche à peine.
    secouer(id) {
      const v = vues.get(id);
      if (v) v.choc = -0.35 / v.type.largeur ** 2;
    },

    // Zombies vivants et leur taille : [{ id, x, y, z, l, h }], y aux pieds.
    cibles() {
      const liste = [];
      for (const [id, v] of vues) {
        if (v.mort >= 0) continue;
        const p = v.racine.position;
        liste.push({ id, x: p.x, y: p.y, z: p.z, l: v.type.largeur, h: v.type.hauteur });
      }
      return liste;
    },

    // origine, direction : tableaux [x, y, z]. Renvoie { id, distance, tete } ou null.
    toucher(origine, direction, portee) {
      return premierTouche(origine, direction, this.cibles(), portee);
    },

    // Zombies vivants (positions des pieds), pour la lanterne du mannequin.
    *vivants() {
      for (const v of vues.values()) if (v.mort < 0) yield v.racine.position;
    },

    // Types présents à l'écran (indices k), pour prévenir des nouveaux venus.
    *types() {
      for (const v of vues.values()) if (v.mort < 0) yield TYPES_ZOMBIES.indexOf(v.type);
    },

    // Zombies à portée d'une explosion : [{ id, distance }].
    autourDe(point, rayon) {
      const touches = [];
      for (const c of this.cibles()) {
        // Distance au corps (entre les pieds et la tête), pas aux pieds.
        const y = Math.min(Math.max(point.y, c.y), c.y + HAUTEUR_MONSTRE * c.h);
        const d = Math.max(0, Math.hypot(c.x - point.x, y - point.y, c.z - point.z) - RAYON_MONSTRE * (c.l - 1));
        if (d <= rayon) touches.push({ id: c.id, distance: d });
      }
      return touches;
    },

    vider() {
      for (const v of vues.values()) v.racine.removeFromParent();
      vues.clear();
    },

    get nombre() {
      let n = 0;
      for (const v of vues.values()) if (v.mort < 0) n += 1;
      return n;
    },
  };
}
