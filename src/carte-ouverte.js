// Fabrique des cartes ouvertes (le village, la forêt) : un relief doux, des
// obstacles ronds (arbres, rochers, meules), en gélule (troncs couchés) ou
// rectangulaires et tournés (maisons), et une lisière carrée d'où sortent les
// zombies. Fonctions pures, partagées par la simulation, les déplacements et
// le rendu, comme monde.js pour l'île : ce qu'on voit est ce qui bloque.

import { creerNavigation } from './navigation.js';

export const RAYON_JOUEUR = 0.35;

// Bruit de valeur lissé, entre 0 et 1.
function hachage(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function bruit(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hachage(xi, zi), b = hachage(xi + 1, zi);
  const c = hachage(xi, zi + 1), d = hachage(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Tirages reproductibles : tous les joueurs voient la même carte.
export function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Point le plus proche d'un obstacle rond ou en gélule (demi : demi-longueur
// de l'axe, cap : sa direction).
function pointProche(o, x, z) {
  if (!o.demi) return [o.x, o.z];
  const ux = Math.cos(o.cap), uz = Math.sin(o.cap);
  const t = Math.max(-o.demi, Math.min(o.demi, (x - o.x) * ux + (z - o.z) * uz));
  return [o.x + ux * t, o.z + uz * t];
}

// Repère d'un rectangle tourné de ry (même convention que Three.js : son +z
// local pointe vers (sin ry, cos ry)).
function versLocal(r, x, z) {
  const dx = x - r.x, dz = z - r.z, c = Math.cos(r.ry ?? 0), s = Math.sin(r.ry ?? 0);
  return [dx * c - dz * s, dx * s + dz * c];
}
function versMonde(r, lx, lz) {
  const c = Math.cos(r.ry ?? 0), s = Math.sin(r.ry ?? 0);
  return [r.x + lx * c + lz * s, r.z - lx * s + lz * c];
}

// Vrai si (x, z) est dans un obstacle, marge comprise.
export function dansObstacle(carte, x, z, marge = 0) {
  for (const o of carte.obstacles) {
    const [cx, cz] = pointProche(o, x, z);
    if (Math.hypot(x - cx, z - cz) < o.rayon + marge) return true;
  }
  for (const r of carte.rectangles) {
    const [lx, lz] = versLocal(r, x, z);
    if (Math.abs(lx) < r.l + marge && Math.abs(lz) < r.p + marge) return true;
  }
  return false;
}

// def : { id, nom, conseil, sortieBoss, borne, relief(x, z), obstacles,
// rectangles, boutique, apparition, poteau, autel }. borne : demi-côté du
// carré où l'on marche ; au-delà, la forêt (décor seulement).
export function creerCarteOuverte(def) {
  const { borne, relief, obstacles = [], rectangles = [] } = def;
  const estPraticable = (x, z) => Math.abs(x) <= borne && Math.abs(z) <= borne;

  function resoudreCollisions(x, z) {
    for (const o of obstacles) {
      const [cx, cz] = pointProche(o, x, z);
      const dx = x - cx, dz = z - cz;
      const d = Math.hypot(dx, dz);
      const min = o.rayon + RAYON_JOUEUR;
      if (d < min && d > 1e-6) {
        x = cx + (dx / d) * min;
        z = cz + (dz / d) * min;
      }
    }
    for (const r of rectangles) {
      const [lx, lz] = versLocal(r, x, z);
      const ex = r.l + RAYON_JOUEUR, ez = r.p + RAYON_JOUEUR;
      if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) continue;
      // Sortie par le côté le plus proche.
      const [nx, nz] = ex - Math.abs(lx) < ez - Math.abs(lz) ? [Math.sign(lx || 1) * ex, lz] : [lx, Math.sign(lz || 1) * ez];
      [x, z] = versMonde(r, nx, nz);
    }
    return { x: Math.max(-borne, Math.min(borne, x)), z: Math.max(-borne, Math.min(borne, z)) };
  }

  // Les zombies sortent de la lisière, du côté opposé au poteau de
  // préférence, jamais dans un obstacle.
  function pointDeSortie(aleatoire, poteau, { essais = 8, assezLoin = 28 } = {}) {
    let meilleur = null;
    for (let essai = 0; essai < essais * 3 && (!meilleur || meilleur.d < assezLoin || essai < 2); essai++) {
      const cote = Math.floor(aleatoire() * 4) % 4;
      const long = (aleatoire() * 2 - 1) * (borne - 2);
      const bord = borne - 0.5;
      const [x, z] = [[long, -bord], [long, bord], [-bord, long], [bord, long]][cote];
      if (dansObstacle(carte, x, z, RAYON_JOUEUR)) continue;
      const d = Math.hypot(x - poteau.x, z - poteau.z);
      if (!meilleur || d > meilleur.d) meilleur = { x, z, d };
    }
    return meilleur ? { x: meilleur.x, z: meilleur.z } : { x: 0, z: -borne + 0.5 };
  }

  // Le champ de distances des zombies, construit au premier besoin.
  let nav = null;

  const carte = {
    ...def,
    obstacles,
    rectangles,
    hauteurTerrain: relief,
    hauteurSol: relief,
    hauteurPieds: relief,
    solBalles: relief,
    solGrenades: relief,
    estPraticable,
    resoudreCollisions,
    pointDeSortie,
    navigation: () => (nav ??= creerNavigation({ borne, hauteurSol: relief, bloque: (x, z) => dansObstacle(carte, x, z, RAYON_JOUEUR) })),
  };
  return carte;
}
