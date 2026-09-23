// Carte de la cour du château (manche 2) : relief, obstacles, portes et
// points de sortie des zombies. Fonctions pures, comme monde.js pour l'île :
// le rendu (rendu-chateau.js), les déplacements et la simulation lisent les
// mêmes blocs.
//
// Le relief est une carte de hauteurs faite de blocs (murailles, tours,
// terrasse) et de rampes (escaliers). On ne franchit pas une marche de plus de
// PAS_MAX : c'est ce qui fait des murailles des murs, et des rampes le seul
// moyen de monter. On peut sauter en bas, pas grimper.

export const COUR = 18;
export const EPAISSEUR_MUR = 4;
export const H_RONDE = 4.5;
// Parapet assez haut pour qu'on ne saute pas par-dessus (saut ≈ 1 m, plus une marche).
export const H_PARAPET = 6.1;
export const H_TOUR = 8;
export const DEMI_PORTE = 2.6;
export const BORNE = 34;
export const H_TERRASSE = 4;
export const DEMI_TERRASSE = 4.5;
const PARAPET = 1.2;
const EXT = COUR + EPAISSEUR_MUR;
const RONDE = EXT - PARAPET;

// Blocs : { x0, x1, z0, z1, h, genre } ; genre sert au rendu.
const BLOCS = [];
const bloc = (x0, x1, z0, z1, h, genre) => BLOCS.push({ x0, x1, z0, z1, h, genre });

// Une muraille le long d'un côté, coupée par une porte si porte est vrai.
// cote : 'nord' (z < 0), 'sud', 'ouest' (x < 0), 'est'.
function muraille(cote, porte) {
  const s = cote === 'nord' || cote === 'ouest' ? -1 : 1;
  const troncons = porte ? [[-EXT, -DEMI_PORTE], [DEMI_PORTE, EXT]] : [[-EXT, EXT]];
  for (const [a, b] of troncons) {
    // Chemin de ronde côté cour, parapet crénelé côté champ.
    const [r0, r1] = s < 0 ? [-RONDE, -COUR] : [COUR, RONDE];
    const [p0, p1] = s < 0 ? [-EXT, -RONDE] : [RONDE, EXT];
    if (cote === 'nord' || cote === 'sud') {
      bloc(a, b, r0, r1, H_RONDE, 'ronde');
      bloc(a, b, p0, p1, H_PARAPET, 'parapet');
    } else {
      bloc(r0, r1, a, b, H_RONDE, 'ronde');
      bloc(p0, p1, a, b, H_PARAPET, 'parapet');
    }
  }
  if (!porte) return;
  // Deux tourelles encadrent la porte : on ne tombe pas du chemin de ronde
  // dans le passage.
  for (const c of [-1, 1]) {
    const [a, b] = c < 0 ? [-DEMI_PORTE - 1.4, -DEMI_PORTE] : [DEMI_PORTE, DEMI_PORTE + 1.4];
    const [m0, m1] = s < 0 ? [-EXT - 0.6, -COUR + 0.4] : [COUR - 0.4, EXT + 0.6];
    if (cote === 'nord' || cote === 'sud') bloc(a, b, m0, m1, H_TOUR - 1, 'tourelle');
    else bloc(m0, m1, a, b, H_TOUR - 1, 'tourelle');
  }
}

muraille('nord', true);
muraille('sud', true);
muraille('ouest', true);
muraille('est', false);
// Tours d'angle, sur l'extérieur des coins : le chemin de ronde passe
// devant elles, on fait le tour des murailles d'une porte à l'autre.
export const TOURS = [];
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  const [x0, x1] = sx < 0 ? [-EXT - 1.5, -RONDE] : [RONDE, EXT + 1.5];
  const [z0, z1] = sz < 0 ? [-EXT - 1.5, -RONDE] : [RONDE, EXT + 1.5];
  bloc(x0, x1, z0, z1, H_TOUR, 'tour');
  TOURS.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, rayon: (x1 - x0) / 2 + 0.3 });
}

// La terrasse au centre de la cour : le meilleur point de vue, entouré d'un
// muret, avec une seule rampe au sud.
export const TERRASSE = { x0: -DEMI_TERRASSE, x1: DEMI_TERRASSE, z0: -DEMI_TERRASSE, z1: DEMI_TERRASSE, h: H_TERRASSE };
const MURET = 0.5;
const H_MURET = H_TERRASSE + 1;
const DEMI_ENTREE = 1.5;
bloc(TERRASSE.x0, TERRASSE.x1, TERRASSE.z0, TERRASSE.z1, H_TERRASSE, 'terrasse');
bloc(TERRASSE.x0, TERRASSE.x1, TERRASSE.z0, TERRASSE.z0 + MURET, H_MURET, 'muret');
bloc(TERRASSE.x0, TERRASSE.x0 + MURET, TERRASSE.z0, TERRASSE.z1, H_MURET, 'muret');
bloc(TERRASSE.x1 - MURET, TERRASSE.x1, TERRASSE.z0, TERRASSE.z1, H_MURET, 'muret');
bloc(TERRASSE.x0, -DEMI_ENTREE, TERRASSE.z1 - MURET, TERRASSE.z1, H_MURET, 'muret');
bloc(DEMI_ENTREE, TERRASSE.x1, TERRASSE.z1 - MURET, TERRASSE.z1, H_MURET, 'muret');

// L'étal de l'armurier, adossé à la muraille ouest : un bloc qu'on ne gravit pas.
export const ETAL = { x0: -COUR, x1: -COUR + 2.8, z0: 6, z1: 12 };
bloc(ETAL.x0, ETAL.x1, ETAL.z0, ETAL.z1, 2.6, 'etal');

// Rampes : de a (hauteur ha) à b (hauteur hb), sur largeur mètres. Les
// paliers en haut des escaliers rejoignent le chemin de ronde.
export const RAMPES = [
  { a: [0, 13], b: [0, TERRASSE.z1], ha: 0, hb: H_TERRASSE, largeur: DEMI_ENTREE * 2, genre: 'terrasse' },
  { a: [5, -COUR + 1.2], b: [13.5, -COUR + 1.2], ha: 0, hb: H_RONDE, largeur: 2.4, genre: 'escalier' },
  { a: [-5, COUR - 1.2], b: [-13.5, COUR - 1.2], ha: 0, hb: H_RONDE, largeur: 2.4, genre: 'escalier' },
  { a: [COUR - 1.2, 10], b: [COUR - 1.2, 1.5], ha: 0, hb: H_RONDE, largeur: 2.4, genre: 'escalier' },
  { a: [-COUR + 1.2, -5], b: [-COUR + 1.2, -13.5], ha: 0, hb: H_RONDE, largeur: 2.4, genre: 'escalier' },
];
bloc(13.5, COUR - 1.5, -COUR, -COUR + 2.4, H_RONDE, 'palier');
bloc(-COUR + 1.5, -13.5, COUR - 2.4, COUR, H_RONDE, 'palier');
bloc(COUR - 2.4, COUR, -1.5, 1.5, H_RONDE, 'palier');
bloc(-COUR, -COUR + 2.4, -COUR + 1.5, -13.5, H_RONDE, 'palier');

export { BLOCS };

function hauteurRampe(r, x, z) {
  const [ax, az] = r.a, [bx, bz] = r.b;
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = ((x - ax) * dx + (z - az) * dz) / l2;
  if (t < 0 || t > 1) return -Infinity;
  const lateral = Math.abs((x - ax) * dz - (z - az) * dx) / Math.sqrt(l2);
  if (lateral > r.largeur / 2) return -Infinity;
  return r.ha + (r.hb - r.ha) * t;
}

export function hauteurSol(x, z) {
  let h = 0;
  for (const b of BLOCS) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.h > h) h = b.h;
  for (const r of RAMPES) h = Math.max(h, hauteurRampe(r, x, z));
  return h;
}

// Obstacles ronds : dans la cour, puits, charrette, tonneaux, foin, caisses ;
// dans le champ, le cimetière devant la muraille est (celle sans porte) et
// des arbres morts, en deçà des points de sortie des zombies.
export const OBSTACLES = [
  { x: -8, z: -9, rayon: 1.3, genre: 'puits' },
  { x: -9, z: 7, rayon: 1.4, genre: 'charrette' },
  { x: 10, z: -8, rayon: 0.9, genre: 'tonneaux' },
  { x: 11, z: 9, rayon: 0.9, genre: 'foin' },
  { x: 13, z: 4, rayon: 0.8, genre: 'caisses' },
  { x: -12, z: -2, rayon: 0.7, genre: 'caisses' },
  // La vie de la cour : marché, forge, mannequins d'entraînement, table,
  // sacs, bûches, braseros.
  { x: 7, z: -12.5, rayon: 1.6, genre: 'marche' },
  { x: -11, z: -14, rayon: 1.5, genre: 'forge' },
  { x: 12.5, z: -3.2, rayon: 0.4, genre: 'mannequin' },
  { x: 14, z: -5.4, rayon: 0.4, genre: 'mannequin' },
  { x: -5.5, z: -13.5, rayon: 1.1, genre: 'table' },
  { x: -8.5, z: 14.5, rayon: 0.7, genre: 'sacs' },
  { x: 15, z: -12, rayon: 0.8, genre: 'buches' },
  { x: -4, z: 8.5, rayon: 0.35, genre: 'brasero' },
  { x: 5, z: -7.5, rayon: 0.35, genre: 'brasero' },
];
for (const [i, x] of [24.4, 26.3].entries()) {
  for (let j = 0; j < 11; j++) {
    if ((i * 7 + j * 3) % 5 === 0) continue;
    const z = -11 + j * 2.2 + (i ? 0.9 : 0);
    OBSTACLES.push({ x: x + ((j * 37) % 7) * 0.05, z, rayon: 0.4, genre: (i + j) % 3 ? 'tombe' : 'croix', penche: (((j * 13 + i * 5) % 9) - 4) * 0.03 });
  }
}
for (const [x, z] of [[-25.5, -12], [-26, 13], [12, 26], [-13, -25.5], [8, -26], [26, 19], [-24.5, 25], [25, -20]]) {
  OBSTACLES.push({ x, z, rayon: 0.35, genre: 'arbre' });
}

const RAYON_JOUEUR = 0.35;

export function resoudreCollisions(x, z) {
  for (const o of OBSTACLES) {
    const dx = x - o.x, dz = z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.rayon + RAYON_JOUEUR;
    if (d < min && d > 1e-6) {
      x = o.x + (dx / d) * min;
      z = o.z + (dz / d) * min;
    }
  }
  const b = BORNE - 1;
  return { x: Math.max(-b, Math.min(b, x)), z: Math.max(-b, Math.min(b, z)) };
}

export function estPraticable(x, z) {
  return Math.abs(x) <= BORNE - 1 && Math.abs(z) <= BORNE - 1;
}

// Les zombies sortent de la nuit, dans le champ autour des murailles.
export function pointDeSortie(aleatoire) {
  const cote = Math.floor(aleatoire() * 4) % 4;
  const leLong = (aleatoire() * 2 - 1) * (BORNE - 4);
  const loin = BORNE - 6 + aleatoire() * 4;
  const points = [[leLong, -loin], [leLong, loin], [-loin, leLong], [loin, leLong]];
  const [x, z] = points[cote];
  return { x, z };
}

export const BOUTIQUE = { x: ETAL.x1 + 1.3, z: (ETAL.z0 + ETAL.z1) / 2 };
export const APPARITION = { x: -3, z: 15, orientation: Math.PI };
export const POTEAU = { x: 7, z: 11 };
