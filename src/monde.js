// Les cartes du jeu et, d'abord, celle de l'île : relief, décor et zones
// praticables. Fonctions pures, partagées par le rendu (ile.js), les
// déplacements (joueur.js) et la simulation, pour que ce qu'on voit et ce qui
// bloque soient toujours la même chose.
//
// La partie est un parcours de cartes ouvertes (carteDEtape) : l'île, le
// village (village.js), la forêt (foret.js), puis on recommence, plus fort.
// Chaque boss abattu fait passer à la suivante. Les fonctions exportées sous
// leur nom (hauteurSol, resoudreCollisions…) sont celles de l'île ; pour la
// carte en cours, passer par carte() (navigateur) ou CARTES[s.carte]
// (simulation).

import { FORET } from './foret.js';
import { VILLAGE } from './village.js';

export const RAYON_ILE = 30;
export const RAYON_JOUEUR = 0.35;

export function lisse(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hachage(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function bruit(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hachage(xi, zi), b = hachage(xi + 1, zi);
  const c = hachage(xi, zi + 1), d = hachage(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function rayonIle(angle) {
  return RAYON_ILE + Math.sin(angle * 3) * 2.5 + Math.sin(angle * 5 + 1.3) * 1.5;
}

// t = 0 au centre, 1 sur le rivage.
export function distanceRelative(x, z) {
  return Math.hypot(x, z) / rayonIle(Math.atan2(z, x));
}

export function hauteurTerrain(x, z) {
  const t = distanceRelative(x, z);
  let h = t <= 0.6 ? 0.7 : 0.7 * (1 - (t - 0.6) / 0.4);
  if (t > 1.08) h -= (t - 1.08) * 15;
  h += lisse(0.65, 0.15, t) * (1.1 + 0.9 * bruit(x * 0.07, z * 0.07));
  h += (bruit(x * 0.35, z * 0.35) - 0.5) * (t < 1.05 ? 0.14 : 0.04);
  return Math.max(h, -4);
}

export function estHerbe(x, z) {
  const t = distanceRelative(x, z);
  return t < 0.34 + bruit(x * 0.15 + 7, z * 0.15) * 0.16;
}

// Ponton vers l'est (+x), là où l'on regarde en arrivant.
export const PONTON = (() => {
  const r = rayonIle(0);
  return { x0: r * 0.62, x1: r + 11, z: 0, largeur: 2.4, hauteur: 0.74 };
})();

export function surPonton(x, z) {
  return x >= PONTON.x0 && x <= PONTON.x1 && Math.abs(z - PONTON.z) <= PONTON.largeur / 2;
}

export function hauteurSol(x, z) {
  const h = hauteurTerrain(x, z);
  return surPonton(x, z) ? Math.max(h, PONTON.hauteur) : h;
}

// On peut patauger, pas nager.
export function estPraticable(x, z) {
  return surPonton(x, z) || hauteurTerrain(x, z) > -0.45;
}

export const CABANE = { x: -15, z: -5, largeur: 5, profondeur: 4 };

// Devant le comptoir de la cabane, qui sert d'armurerie.
export const BOUTIQUE = { x: CABANE.x + CABANE.profondeur / 2 + 1.3, z: CABANE.z };

// Sur le sable, face au ponton et à la mer.
export const APPARITION = { x: 16.5, z: 0, orientation: Math.PI / 2 };

// L'autel de l'île : y poser le protégé appelle le boss.
export const AUTEL_ILE = { x: -1, z: 13, rayon: 2 };

function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loinDe(x, z, points, distance) {
  return points.every((p) => Math.hypot(p.x - x, p.z - z) >= distance);
}

function presDuPonton(x, z, marge) {
  return x > PONTON.x0 - marge && Math.abs(z - PONTON.z) < PONTON.largeur / 2 + marge;
}

function presDeLaCabane(x, z, marge) {
  return (
    Math.abs(x - CABANE.x) < CABANE.profondeur / 2 + marge &&
    Math.abs(z - CABANE.z) < CABANE.largeur / 2 + marge
  );
}

function genererDecor() {
  const alea = generateur(20260922);
  const palmiers = [];
  for (let essai = 0; palmiers.length < 18 && essai < 500; essai++) {
    const angle = alea() * Math.PI * 2;
    const t = 0.5 + alea() * 0.36;
    const r = rayonIle(angle) * t;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (presDuPonton(x, z, 2) || presDeLaCabane(x, z, 3)) continue;
    if (Math.hypot(x - APPARITION.x, z - APPARITION.z) < 5) continue;
    if (!loinDe(x, z, palmiers, 4.5)) continue;
    palmiers.push({
      x, z,
      hauteur: 5 + alea() * 3,
      // Les palmiers penchent vers la mer.
      inclinaison: 0.25 + alea() * 0.3,
      direction: angle + (alea() - 0.5) * 0.8,
      rotation: alea() * Math.PI * 2,
    });
  }

  const rochers = [];
  for (let essai = 0; rochers.length < 22 && essai < 500; essai++) {
    const angle = alea() * Math.PI * 2;
    const t = 0.9 + alea() * 0.3;
    const r = rayonIle(angle) * t;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (presDuPonton(x, z, 1.5)) continue;
    if (!loinDe(x, z, rochers, 1.6)) continue;
    rochers.push({ x, z, taille: 0.3 + alea() * alea() * 1.4, rotation: alea() * Math.PI * 2, teinte: alea() });
  }

  const touffes = [];
  for (let essai = 0; touffes.length < 170 && essai < 3000; essai++) {
    const x = (alea() - 0.5) * RAYON_ILE * 1.6, z = (alea() - 0.5) * RAYON_ILE * 1.6;
    if (!estHerbe(x, z) && alea() > 0.08) continue;
    if (distanceRelative(x, z) > 0.8 || presDeLaCabane(x, z, 0.3)) continue;
    touffes.push({ x, z, taille: 0.6 + alea() * 0.8, rotation: alea() * Math.PI * 2 });
  }

  const libre = (x, z, marge) => !presDuPonton(x, z, marge) && !presDeLaCabane(x, z, marge) && loinDe(x, z, palmiers, marge) && loinDe(x, z, rochers, marge)
    && Math.hypot(x - APPARITION.x, z - APPARITION.z) > 4;
  // Une barque échouée sur la plage, à l'ouest ; cap : direction de sa quille.
  let epave = null;
  for (let essai = 0; !epave && essai < 300; essai++) {
    const angle = 2.2 + alea() * 1.6;
    const r = rayonIle(angle) * (0.88 + alea() * 0.06);
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (libre(x, z, 2.5)) epave = { x, z, cap: angle + Math.PI / 2 + (alea() - 0.5) * 0.6, gite: 0.3 + alea() * 0.15 };
  }
  // Bois flotté sur le sable (on l'enjambe).
  const bois = [];
  for (let essai = 0; bois.length < 7 && essai < 400; essai++) {
    const angle = alea() * Math.PI * 2;
    const r = rayonIle(angle) * (0.84 + alea() * 0.14);
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (!libre(x, z, 1.5) || (epave && Math.hypot(x - epave.x, z - epave.z) < 3.5)) continue;
    bois.push({ x, z, longueur: 1.2 + alea() * 1.3, rayon: 0.08 + alea() * 0.07, cap: alea() * Math.PI });
  }
  // Torches de bambou : de part et d'autre du comptoir et du ponton, et deux
  // sur l'île.
  const torches = [
    { x: CABANE.x + CABANE.profondeur / 2 + 0.9, z: CABANE.z - CABANE.largeur / 2 - 0.4 },
    { x: CABANE.x + CABANE.profondeur / 2 + 0.9, z: CABANE.z + CABANE.largeur / 2 + 0.4 },
    // Au ponton, un peu en avant : la caméra de l'écran de création se tient
    // à son entrée, les torches ne doivent pas lui boucher la vue.
    { x: PONTON.x0 + 2.5, z: PONTON.z - PONTON.largeur / 2 - 0.5 },
    { x: PONTON.x0 + 2.5, z: PONTON.z + PONTON.largeur / 2 + 0.5 },
  ];
  for (const angle of [1.9, 4.4]) {
    for (let t = 0.66; t < 0.8; t += 0.03) {
      const r = rayonIle(angle) * t, x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      if (libre(x, z, 1.2)) {
        torches.push({ x, z });
        break;
      }
    }
  }
  // Caisses près de la cabane, assez loin des murs pour qu'un zombie passe
  // entre les deux (sinon il s'y coince).
  const caisses = [{ x: CABANE.x - 0.6, z: CABANE.z + CABANE.largeur / 2 + 2.2 }, { x: CABANE.x - CABANE.profondeur / 2 - 2.3, z: CABANE.z - 1.2 }];
  // Fougères et fleurs dans l'herbe, coquillages et étoiles de mer sur le sable.
  const plantes = [];
  for (let essai = 0; plantes.length < 70 && essai < 3000; essai++) {
    const x = (alea() - 0.5) * RAYON_ILE * 1.4, z = (alea() - 0.5) * RAYON_ILE * 1.4;
    if (!estHerbe(x, z) || presDeLaCabane(x, z, 0.6) || !loinDe(x, z, palmiers, 0.8)) continue;
    plantes.push({ x, z, genre: alea() < 0.4 ? 'fougere' : 'fleur', taille: 0.6 + alea() * 0.7, teinte: alea(), rotation: alea() * Math.PI * 2 });
  }
  const coquillages = [];
  for (let essai = 0; coquillages.length < 45 && essai < 1000; essai++) {
    const angle = alea() * Math.PI * 2;
    const r = rayonIle(angle) * (0.72 + alea() * 0.3);
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (presDuPonton(x, z, 0.3)) continue;
    coquillages.push({ x, z, genre: alea() < 0.25 ? 'etoile' : 'coquille', teinte: alea(), rotation: alea() * Math.PI * 2, taille: 0.7 + alea() * 0.6 });
  }

  // De quoi remplir l'île. Le poteau part de (6, -3) : on lui laisse de la
  // place, et aux abords de l'armurerie et de l'arrivée.
  const POTEAU_ILE = { x: 6, z: -3 };
  const degage = (x, z, marge) => libre(x, z, marge) && Math.hypot(x - POTEAU_ILE.x, z - POTEAU_ILE.z) > 6.5
    && Math.hypot(x - AUTEL_ILE.x, z - AUTEL_ILE.z) > 4 + marge
    && Math.hypot(x - BOUTIQUE.x, z - BOUTIQUE.z) > 3 && loinDe(x, z, torches, 1.5) && loinDe(x, z, caisses, 1.5)
    && (!epave || Math.hypot(x - epave.x, z - epave.z) > 3);
  // Le camp des naufragés : un feu de camp, une tente, des totems.
  let camp = null;
  for (let essai = 0; !camp && essai < 300; essai++) {
    const angle = 0.9 + alea() * 1.4, t = 0.38 + alea() * 0.2;
    const r = rayonIle(angle) * t, x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (degage(x, z, 4)) camp = { x, z, tente: angle + Math.PI + (alea() - 0.5) * 0.5 };
  }
  // La tour de guet, sur pilotis, au sud.
  let tour = null;
  for (let essai = 0; !tour && essai < 300; essai++) {
    const angle = 4.4 + alea() * 1, t = 0.55 + alea() * 0.15;
    const r = rayonIle(angle) * t, x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (degage(x, z, 3.5) && (!camp || Math.hypot(x - camp.x, z - camp.z) > 8)) tour = { x, z, rotation: angle };
  }
  // Réverbères (lanternes pendues à une potence) le long du chemin de
  // l'arrivée à l'armurerie, un panneau indicateur, des filets à sécher.
  const reverberes = [[12, 3.5], [1, 4.2], [-6.5, -0.8], [-3, -9.5]].map(([x, z]) => ({ x, z }));
  const panneau = { x: 11.5, z: -4.2 };
  const filets = { x: PONTON.x0 - 2.2, z: 4.2 };
  const occupe = [...(camp ? [camp] : []), ...(tour ? [tour] : []), ...reverberes, panneau, filets];
  // Encore des palmiers sur la plage, des feuillus et des bananiers dans les
  // terres, des buissons partout.
  for (let essai = 0; palmiers.length < 30 && essai < 800; essai++) {
    const angle = alea() * Math.PI * 2, t = 0.55 + alea() * 0.35;
    const r = rayonIle(angle) * t, x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (!degage(x, z, 2.5) || !loinDe(x, z, palmiers, 3.5) || !loinDe(x, z, occupe, 4)) continue;
    palmiers.push({ x, z, hauteur: 5 + alea() * 3, inclinaison: 0.25 + alea() * 0.3, direction: angle + (alea() - 0.5) * 0.8, rotation: alea() * Math.PI * 2 });
  }
  const arbres = [];
  for (let essai = 0; arbres.length < 26 && essai < 1500; essai++) {
    const angle = alea() * Math.PI * 2, t = 0.22 + alea() * 0.5;
    const r = rayonIle(angle) * t, x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (!degage(x, z, 2.2) || !loinDe(x, z, palmiers, 2.5) || !loinDe(x, z, arbres, 3.2) || !loinDe(x, z, occupe, 4)) continue;
    arbres.push({ x, z, espece: alea() < 0.55 ? 'feuillu' : 'bananier', taille: 0.8 + alea() * 0.5, rotation: alea() * Math.PI * 2 });
  }
  const buissons = [];
  for (let essai = 0; buissons.length < 90 && essai < 2000; essai++) {
    const angle = alea() * Math.PI * 2, t = 0.15 + alea() * 0.75;
    const r = rayonIle(angle) * t, x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    if (!degage(x, z, 1) || !loinDe(x, z, buissons, 1.6) || !loinDe(x, z, occupe, 3)) continue;
    buissons.push({ x, z, taille: 0.6 + alea() * 0.7, rotation: alea() * Math.PI * 2, sombre: alea() < 0.4 });
  }
  // Îlots au loin, pour meubler l'horizon.
  const ilots = [];
  for (let k = 0; k < 6; k++) {
    const angle = (k / 6) * Math.PI * 2 + 0.4 + alea() * 0.5, d = 120 + alea() * 90;
    ilots.push({ x: Math.cos(angle) * d, z: Math.sin(angle) * d, taille: 6 + alea() * 10, palmiers: 2 + Math.floor(alea() * 4) });
  }

  return {
    palmiers, rochers, touffes, epave, bois, torches, caisses, plantes, coquillages,
    camp, tour, arbres, buissons, reverberes, panneau, filets, ilots,
  };
}

export const DECOR = genererDecor();

const OBSTACLES = [
  ...DECOR.palmiers.map((p) => ({ x: p.x, z: p.z, rayon: 0.3 })),
  ...DECOR.rochers.filter((r) => r.taille > 0.55).map((r) => ({ x: r.x, z: r.z, rayon: r.taille * 0.85 })),
  ...DECOR.torches.map((t) => ({ x: t.x, z: t.z, rayon: 0.15 })),
  ...DECOR.arbres.map((a) => ({ x: a.x, z: a.z, rayon: 0.3 * a.taille })),
  ...DECOR.reverberes.map((r) => ({ x: r.x, z: r.z, rayon: 0.12 })),
  { x: DECOR.panneau.x, z: DECOR.panneau.z, rayon: 0.12 },
  ...[-1, 1].map((c) => ({ x: DECOR.filets.x, z: DECOR.filets.z + c * 1.3, rayon: 0.1 })),
  // Le feu de camp et la tente ; les quatre pieds de la tour de guet.
  ...(DECOR.camp ? [
    { x: DECOR.camp.x, z: DECOR.camp.z, rayon: 0.7 },
    { x: DECOR.camp.x + Math.cos(DECOR.camp.tente) * 3.2, z: DECOR.camp.z + Math.sin(DECOR.camp.tente) * 3.2, rayon: 1.3 },
  ] : []),
  ...(DECOR.tour ? [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => ({ x: DECOR.tour.x + a * 1.2, z: DECOR.tour.z + b * 1.2, rayon: 0.14 })) : []),
  ...DECOR.caisses.map((c) => ({ x: c.x, z: c.z, rayon: 0.75 })),
  // La barque : une gélule le long de sa quille (deux cercles qui se
  // chevauchent se renverraient le joueur de l'un à l'autre).
  ...(DECOR.epave ? [{ x: DECOR.epave.x, z: DECOR.epave.z, rayon: 0.8, demi: 0.9, cap: DECOR.epave.cap }] : []),
];

// Repousse un point hors des obstacles (troncs, gros rochers, cabane).
export function resoudreCollisions(x, z) {
  for (const o of OBSTACLES) {
    // Point le plus proche de l'obstacle : son centre, ou sur son axe (gélule).
    let cx = o.x, cz = o.z;
    if (o.demi) {
      const ux = Math.cos(o.cap), uz = Math.sin(o.cap);
      const t = Math.max(-o.demi, Math.min(o.demi, (x - o.x) * ux + (z - o.z) * uz));
      cx += ux * t;
      cz += uz * t;
    }
    const dx = x - cx, dz = z - cz;
    const d = Math.hypot(dx, dz);
    const min = o.rayon + RAYON_JOUEUR;
    if (d < min && d > 1e-6) {
      x = cx + (dx / d) * min;
      z = cz + (dz / d) * min;
    }
  }
  const demiX = CABANE.profondeur / 2, demiZ = CABANE.largeur / 2;
  const px = Math.max(CABANE.x - demiX, Math.min(x, CABANE.x + demiX));
  const pz = Math.max(CABANE.z - demiZ, Math.min(z, CABANE.z + demiZ));
  const dx = x - px, dz = z - pz;
  const d = Math.hypot(dx, dz);
  if (d < RAYON_JOUEUR) {
    if (d > 1e-6) {
      x = px + (dx / d) * RAYON_JOUEUR;
      z = pz + (dz / d) * RAYON_JOUEUR;
    } else {
      // Centre dans la cabane : sortie par la face la plus proche.
      const sorties = [
        [CABANE.x - demiX - RAYON_JOUEUR - x, 0],
        [CABANE.x + demiX + RAYON_JOUEUR - x, 0],
        [0, CABANE.z - demiZ - RAYON_JOUEUR - z],
        [0, CABANE.z + demiZ + RAYON_JOUEUR - z],
      ].sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
      x += sorties[0][0];
      z += sorties[0][1];
    }
  }
  return { x, z };
}

// Point de sortie des zombies sur l'île : dans l'eau, du côté opposé au
// poteau de préférence (le plus loin parmi quelques essais, ou le premier
// assez loin). large : plus loin du rivage (le boss sort des eaux profondes).
function sortieIle(aleatoire, poteau, { large = 1.16, essais = 6, assezLoin = 18 } = {}) {
  let meilleur = null;
  for (let essai = 0; essai < essais; essai++) {
    const angle = aleatoire() * Math.PI * 2;
    const r = rayonIle(angle) * large;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    const d = Math.hypot(x - poteau.x, z - poteau.z);
    if (!meilleur || d > meilleur.d) meilleur = { x, z, d };
    if (d > assezLoin) break;
  }
  return { x: meilleur.x, z: meilleur.z };
}

export const PROFONDEUR_PIEDS = -2.2;

// Interface commune des cartes :
// - hauteurSol : où l'on marche ; hauteurPieds : où posent les pieds d'un
//   zombie (sur l'île, il marche au fond de l'eau) ;
// - solBalles, solGrenades : en dessous, c'est plein ;
// - autel : { x, z, rayon } ; y poser le protégé appelle le boss.
const ILE = {
  id: 'ile',
  nom: 'L’île',
  conseil: 'Posez Lucie sur l’autel, au nord de l’île : il appelle le boss.',
  sortieBoss: 'Il sort des flots !',
  hauteurTerrain,
  hauteurSol,
  hauteurPieds: (x, z) => Math.max(hauteurTerrain(x, z), PROFONDEUR_PIEDS),
  solBalles: hauteurTerrain,
  // La surface de la mer arrête aussi les grenades.
  solGrenades: (x, z) => Math.max(hauteurTerrain(x, z), -0.1),
  estPraticable,
  resoudreCollisions,
  pointDeSortie: sortieIle,
  // Sur l'île, les zombies vont droit et glissent le long des obstacles.
  navigation: () => null,
  boutique: BOUTIQUE,
  apparition: APPARITION,
  poteau: { x: 6, z: -3 },
  autel: AUTEL_ILE,
};

export const CARTES = [ILE, VILLAGE, FORET];

// La carte de l'étape (0 : la première) : on boucle sur le parcours.
export const carteDEtape = (etape) => ((etape % CARTES.length) + CARTES.length) % CARTES.length;

let active = ILE;
// La carte affichée dans ce navigateur (celle de l'instantané reçu).
export const carte = () => active;
export function activerCarte(indice) {
  active = CARTES[indice] ?? ILE;
  return active;
}
