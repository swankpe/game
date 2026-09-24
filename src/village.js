// Deuxième carte du parcours : le village abandonné. Des maisons à colombages
// autour d'une place, une chapelle et son autel à l'est, des champs et des
// meules, un moulin ; la forêt tout autour, d'où sortent les zombies.
// Données pures : rendu-village.js dessine exactement ces obstacles.

import { bruit, creerCarteOuverte, dansObstacle, generateur } from './carte-ouverte.js';

export const BORNE_VILLAGE = 40;

// Terrain doux, un peu plus plat sur la place.
function relief(x, z) {
  const place = Math.min(1, Math.hypot(x, z) / 18);
  return (0.9 * bruit(x * 0.045 + 3, z * 0.045) + 0.35 * bruit(x * 0.12, z * 0.12 + 7)) * (0.35 + 0.65 * place);
}

// Tournée pour regarder la place : son +z local pointe vers l'origine.
const versPlace = (x, z) => Math.atan2(-x, -z);

export const MAISONS = [
  [-13, -7], [-6, -15, { l: 6.5 }], [6, -16], [15, -6, { chaume: true }], [15, 8],
  [6, 17, { chaume: true }], [-8, 17], [-17, 8, { l: 6.5 }], [-26, -20, { chaume: true }], [27, 25],
].map(([x, z, o = {}]) => ({ x, z, ry: versPlace(x, z), l: 5.5, p: 4.2, ...o }));

export const CHAPELLE = { x: 28, z: -24, ry: -Math.PI / 2 };
export const MOULIN = { x: -30, z: 26 };
export const ARMURERIE = { x: -8, z: 3, ry: Math.PI / 2 };
export const MARCHE = { x: 6, z: -6 };
export const PUITS = { x: -1, z: -3 };
// La forge de l'armurier, juste derrière son étal : une gélule le long de z.
export const FORGE = { x: -9.4, z: -2.4, rayon: 1, demi: 1.3, cap: Math.PI / 2 };
export const AUTEL_VILLAGE = { x: 17, z: -24, rayon: 2 };

function genererVillage() {
  const alea = generateur(20260924);
  const rectangles = [
    ...MAISONS.map((m) => ({ x: m.x, z: m.z, ry: m.ry, l: m.l / 2 + 0.15, p: m.p / 2 + 0.15, genre: 'maison' })),
    // La nef et le clocher de la chapelle (son +z local pointe vers la place).
    { x: CHAPELLE.x, z: CHAPELLE.z, ry: CHAPELLE.ry, l: 2.6, p: 4.6, genre: 'chapelle' },
    { x: CHAPELLE.x - 5.4, z: CHAPELLE.z, ry: CHAPELLE.ry, l: 1.3, p: 1.3, genre: 'clocher' },
    // L'étal de l'armurier : un comptoir sous auvent.
    { x: ARMURERIE.x, z: ARMURERIE.z, ry: ARMURERIE.ry, l: 1.5, p: 0.6, genre: 'armurerie' },
  ];
  const obstacles = [
    { x: MOULIN.x, z: MOULIN.z, rayon: 2.9, genre: 'moulin' },
    { x: MARCHE.x, z: MARCHE.z, rayon: 1.6, genre: 'marche' },
    { x: PUITS.x, z: PUITS.z, rayon: 1.3, genre: 'puits' },
    { ...FORGE, genre: 'forge' },
    { x: -3, z: 9, rayon: 1.3, genre: 'charrette', ry: 0.4 },
    { x: 11, z: 2, rayon: 0.8, genre: 'caisses' },
  ];
  // Le cimetière, derrière la chapelle.
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 5; j++) {
      obstacles.push({ x: 24 + j * 2.2, z: -15.5 + i * 2, rayon: 0.4, genre: (i + j) % 3 ? 'tombe' : 'croix', penche: ((j * 7 + i * 3) % 5 - 2) * 0.04 });
    }
  }
  const temp = { obstacles, rectangles };
  const libre = (x, z, marge) => !dansObstacle(temp, x, z, marge)
    && Math.hypot(x - AUTEL_VILLAGE.x, z - AUTEL_VILLAGE.z) > 5 && Math.abs(x) < BORNE_VILLAGE - 2 && Math.abs(z) < BORNE_VILLAGE - 2;
  // Meules de foin dans les champs, arbres épars.
  for (let essai = 0, n = 0; n < 10 && essai < 300; essai++) {
    const a = alea() * Math.PI * 2, d = 20 + alea() * 16, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!libre(x, z, 2)) continue;
    obstacles.push({ x, z, rayon: 0.85, genre: 'meule', ry: alea() * 3 });
    n++;
  }
  for (let essai = 0, n = 0; n < 34 && essai < 800; essai++) {
    const a = alea() * Math.PI * 2, d = 18 + alea() * 20, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!libre(x, z, 2.6)) continue;
    const taille = 0.9 + alea() * 0.6;
    obstacles.push({ x, z, rayon: 0.32 * taille, genre: alea() < 0.6 ? 'feuillu' : 'sapin', taille, ry: alea() * 6.3 });
    n++;
  }
  for (let essai = 0, n = 0; n < 12 && essai < 300; essai++) {
    const a = alea() * Math.PI * 2, d = 14 + alea() * 24, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!libre(x, z, 1.5)) continue;
    const taille = 0.4 + alea() * 0.6;
    obstacles.push({ x, z, rayon: taille * 0.9, genre: 'rocher', taille, ry: alea() * 6.3 });
    n++;
  }
  return { obstacles, rectangles };
}

const { obstacles, rectangles } = genererVillage();

export const VILLAGE = creerCarteOuverte({
  id: 'village',
  nom: 'Le village abandonné',
  conseil: 'Posez Lucie sur l’autel, devant la chapelle : il appelle le boss.',
  sortieBoss: 'Il sort de la forêt !',
  borne: BORNE_VILLAGE,
  relief,
  obstacles,
  rectangles,
  boutique: { x: ARMURERIE.x + 1.8, z: ARMURERIE.z },
  apparition: { x: 1, z: 12, orientation: Math.PI },
  poteau: { x: 4, z: 3 },
  autel: AUTEL_VILLAGE,
});
