// Troisième carte du parcours : la forêt noire. Une clairière au centre avec
// la cabane du chasseur (l'armurerie) et un feu de camp, des sapins serrés
// tout autour, un étang, et au nord-est un cercle de pierres levées dont le
// centre est l'autel. Données pures : rendu-foret.js les dessine.

import { bruit, creerCarteOuverte, dansObstacle, generateur } from './carte-ouverte.js';

export const BORNE_FORET = 38;
export const CLAIRIERE = 12;
export const AUTEL_FORET = { x: 20, z: -20, rayon: 2 };
export const ETANG = { x: -18, z: -15, rayon: 5.5 };
export const CABANE_CHASSEUR = { x: -7, z: 5, ry: Math.atan2(7, -5) };
export const FEU = { x: 1.5, z: 2.5 };
export const CERCLE = { rayon: 4.6, pierres: 9 };

// Des collines douces ; le creux de l'étang.
function relief(x, z) {
  const h = 1.3 * bruit(x * 0.04 + 11, z * 0.04) + 0.45 * bruit(x * 0.11, z * 0.11 + 3);
  const clairiere = Math.min(1, Math.hypot(x, z) / CLAIRIERE);
  const etang = Math.min(1, Math.hypot(x - ETANG.x, z - ETANG.z) / (ETANG.rayon + 3));
  return h * (0.4 + 0.6 * clairiere) - (1 - etang * etang) * 1.2;
}

// Le chemin de la clairière à l'autel reste dégagé : les arbres s'en écartent.
function surChemin(x, z) {
  const t = Math.max(0, Math.min(1, (x * AUTEL_FORET.x + z * AUTEL_FORET.z) / (AUTEL_FORET.x ** 2 + AUTEL_FORET.z ** 2)));
  return Math.hypot(x - AUTEL_FORET.x * t, z - AUTEL_FORET.z * t) < 3;
}

function genererForet() {
  const alea = generateur(20260925);
  const rectangles = [{ x: CABANE_CHASSEUR.x, z: CABANE_CHASSEUR.z, ry: CABANE_CHASSEUR.ry, l: 2.3, p: 1.9, genre: 'cabane' }];
  const obstacles = [
    { x: ETANG.x, z: ETANG.z, rayon: ETANG.rayon, genre: 'etang' },
    { x: FEU.x, z: FEU.z, rayon: 0.7, genre: 'feu' },
  ];
  // Les pierres levées, en cercle, avec deux passages (vers la clairière et
  // vers la forêt).
  for (let k = 0; k < CERCLE.pierres; k++) {
    const a = (k / CERCLE.pierres) * Math.PI * 2 + 0.2;
    const versClairiere = Math.atan2(-AUTEL_FORET.z, -AUTEL_FORET.x);
    const ecart = Math.abs(Math.atan2(Math.sin(a - versClairiere), Math.cos(a - versClairiere)));
    if (ecart < 0.45 || Math.abs(ecart - Math.PI) < 0.35) continue;
    obstacles.push({ x: AUTEL_FORET.x + Math.cos(a) * CERCLE.rayon, z: AUTEL_FORET.z + Math.sin(a) * CERCLE.rayon, rayon: 0.5, genre: 'menhir', ry: a, taille: 0.8 + ((k * 37) % 5) * 0.1 });
  }
  const temp = { obstacles, rectangles };
  const loinDe = (x, z, cx, cz, d) => Math.hypot(x - cx, z - cz) > d;
  const libre = (x, z, marge) => !dansObstacle(temp, x, z, marge) && loinDe(x, z, 0, 0, CLAIRIERE)
    && loinDe(x, z, AUTEL_FORET.x, AUTEL_FORET.z, CERCLE.rayon + 2.5) && !surChemin(x, z)
    && Math.abs(x) < BORNE_FORET - 1.5 && Math.abs(z) < BORNE_FORET - 1.5;
  // Les arbres : espacés d'au moins 3 m, pour qu'un zombie passe entre eux.
  for (let essai = 0, n = 0; n < 150 && essai < 4000; essai++) {
    const x = (alea() * 2 - 1) * BORNE_FORET, z = (alea() * 2 - 1) * BORNE_FORET;
    if (!libre(x, z, 2.4)) continue;
    const taille = 0.9 + alea() * 0.8;
    obstacles.push({ x, z, rayon: 0.3 * taille, genre: alea() < 0.75 ? 'sapin' : 'feuillu', taille, ry: alea() * 6.3 });
    n++;
  }
  for (let essai = 0, n = 0; n < 16 && essai < 600; essai++) {
    const x = (alea() * 2 - 1) * BORNE_FORET, z = (alea() * 2 - 1) * BORNE_FORET;
    if (!libre(x, z, 2)) continue;
    const taille = 0.5 + alea() * 0.7;
    obstacles.push({ x, z, rayon: taille * 0.9, genre: 'rocher', taille, ry: alea() * 6.3 });
    n++;
  }
  // Troncs couchés : des gélules.
  for (let essai = 0, n = 0; n < 7 && essai < 400; essai++) {
    const x = (alea() * 2 - 1) * (BORNE_FORET - 4), z = (alea() * 2 - 1) * (BORNE_FORET - 4);
    const cap = alea() * Math.PI;
    if (!libre(x, z, 3.2)) continue;
    obstacles.push({ x, z, rayon: 0.35, demi: 1.6, cap, genre: 'tronc' });
    n++;
  }
  return { obstacles, rectangles };
}

const { obstacles, rectangles } = genererForet();

export const FORET = creerCarteOuverte({
  id: 'foret',
  nom: 'La forêt noire',
  conseil: 'Portez Lucie au cercle de pierres, au nord-est : son autel appelle le boss.',
  sortieBoss: 'Il surgit d’entre les arbres !',
  borne: BORNE_FORET,
  relief,
  obstacles,
  rectangles,
  boutique: (() => {
    const { x, z, ry } = CABANE_CHASSEUR;
    return { x: x + Math.sin(ry) * 3.2, z: z + Math.cos(ry) * 3.2 };
  })(),
  apparition: { x: 0, z: 8, orientation: Math.PI },
  poteau: { x: 4, z: -2 },
  autel: AUTEL_FORET,
});
