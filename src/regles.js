// Règles et réglages du Protégé. Tout l'équilibrage tient ici : changer une
// durée ou une cadence ne demande de toucher à rien d'autre.

// Le déroulé d'une carte : les zombies arrivent en continu pendant un assaut,
// puis la lumière revient pour une accalmie (la carte s'illumine, les zombies
// restants fuient) : le temps de se ravitailler à l'armurerie et de manger.
// On arrive sur chaque carte par une accalmie. Le boss, lui, ne vient que
// si l'on pose le protégé sur l'autel de la carte (voir BOSS).
export const CYCLE = { accalmie: 30, assaut: 100 };
export const DUREE_VICTOIRE = 10;
export const DUREE_DEFAITE = 8;

// Réglages d'essai, pour tester vite : assauts et accalmies courts, boss
// fragile (part de ses points de vie), de l'argent au départ de chaque
// partie. Ils ne touchent que le jeu (jeu.js les donne à la simulation) ;
// les tests vérifient le jeu normal. actif: false pour revenir au jeu normal.
export const ESSAI = { actif: true, accalmie: 20, assaut: 60, pvBoss: 0.1, argentDepart: 10000 };

// Le protégé n'est jamais un joueur : une villageoise ligotée au poteau, qui
// porte la lanterne. Tout le jeu consiste à la garder en vie.
export const NOM_PROTEGE = 'Lucie';
export const PV_PROTEGE = 100;
export const PV_MONSTRE = 30;
export const MULTIPLICATEUR_TETE = 2;

// Les armes, dans l'ordre des touches 1 à 4. degats : par balle (par
// explosion pour le lance-grenades, au centre) ; cadence : secondes entre deux
// tirs ; dispersion : écart maximal du tir au repos, en radians ; chargeur et
// rechargement (secondes) : les munitions sont illimitées, pas le chargeur.
//
// Recul, à chaque tir : le regard monte de recul (radians) et s'écarte au
// hasard de reculLateral ; il revient de lui-même au rythme retour (par
// seconde). En rafale, le recul s'accumule : l'Uzi et le fusil grimpent, il
// faut tirer la souris vers le bas. evasement : dispersion ajoutée par tir,
// plafonnée à evasementMax, qui se résorbe au même rythme.
export const ARMES = [
  {
    id: 'pistolet', nom: 'Pistolet', prix: 0,
    degats: 10, cadence: 0.28, dispersion: 0.004, portee: 60,
    chargeur: 12, rechargement: 1.2,
    recul: 0.035, reculLateral: 0.008, retour: 7, evasement: 0.004, evasementMax: 0.012,
    description: 'Fidèle et précis. Trois balles pour un zombie, deux dans la tête.',
  },
  {
    id: 'uzi', nom: 'Mini Uzi', prix: 250,
    degats: 7, cadence: 0.07, dispersion: 0.02, portee: 40,
    chargeur: 32, rechargement: 1.6,
    recul: 0.012, reculLateral: 0.014, retour: 5, evasement: 0.003, evasementMax: 0.035,
    description: 'Compact et nerveux : une pluie de balles, mais qui s’écarte et grimpe en rafale.',
  },
  {
    id: 'fusil', nom: 'Fusil d’assaut', prix: 600,
    degats: 16, cadence: 0.11, dispersion: 0.006, portee: 70,
    chargeur: 30, rechargement: 2,
    recul: 0.02, reculLateral: 0.009, retour: 5, evasement: 0.002, evasementMax: 0.02,
    description: 'Puissant et précis au coup par coup ; en rafale, il faut tenir le recul.',
  },
  {
    id: 'lance', nom: 'Lance-grenades', prix: 1200,
    degats: 90, cadence: 0.85, dispersion: 0.005, portee: 80,
    chargeur: 6, rechargement: 2.8,
    recul: 0.09, reculLateral: 0.015, retour: 4, evasement: 0, evasementMax: 0,
    projectile: true, vitesse: 24, rayon: 4.5,
    description: 'Six grenades dans le barillet : chacune explose au contact et balaie un groupe.',
  },
];

// Dispersion ajoutée par mètre par seconde de déplacement : en courant
// (7,5 m/s), le tir s'écarte de 0,012 rad de plus.
export const DISPERSION_MOUVEMENT = 0.0016;
// En l'air, on tire au jugé.
export const DISPERSION_SAUT = 0.015;

export const indiceArme = (id) => ARMES.findIndex((a) => a.id === id);

// Étoiles d'amélioration, lâchées parfois par un zombie abattu (chance : voir
// TYPES_ZOMBIES ; le boss en lâche boss). Celui qui marche dessus améliore
// l'arme qu'il tient (sinon une autre des siennes, sinon il touche prime).
// Chaque niveau : +25 % de dégâts, +20 % de chargeur, rechargement 12 % plus
// court. Une étoile disparaît au bout de duree secondes.
export const ETOILES = {
  niveauMax: 3,
  degats: 0.25, chargeur: 0.2, rechargement: 0.12,
  duree: 30, max: 8, rayon: 1.3, boss: 3, prime: 100,
};

// Une arme à un niveau d'amélioration donné (0 : telle qu'achetée).
export function armeAmelioree(arme, niveau = 0) {
  const n = Math.min(Math.max(niveau | 0, 0), ETOILES.niveauMax);
  if (!n) return arme;
  return {
    ...arme,
    niveau: n,
    degats: arme.degats * (1 + ETOILES.degats * n),
    chargeur: Math.round(arme.chargeur * (1 + ETOILES.chargeur * n)),
    rechargement: arme.rechargement * (1 - ETOILES.rechargement * n),
  };
}

// Multiplicateur de dégâts au plus haut niveau : l'hôte borne les dégâts
// reçus du réseau avec.
export const BONUS_DEGATS_MAX = 1 + ETOILES.degats * ETOILES.niveauMax;
// Armes possédées : un bit par arme, le pistolet (bit 0) toujours présent.
export const ARMES_DEPART = 1;

// Prime de chacun quand le boss d'une carte tombe.
export const BONUS_BOSS = 200;
export const DISTANCE_BOUTIQUE = 3.2;

// La nourriture, à l'armurerie : elle rend des points de vie peu à peu (soin
// en duree secondes). max : combien on peut en porter.
export const VIVRES = [
  { id: 'pomme', nom: 'Pomme', prix: 40, soin: 30, duree: 2, max: 6, description: 'Croquante et vite avalée : 30 points de vie en 2 secondes.' },
  { id: 'ragout', nom: 'Ragoût', prix: 110, soin: 80, duree: 5, max: 3, description: 'Un vrai repas : 80 points de vie, le temps de le finir (5 secondes).' },
];
export const indiceVivre = (id) => VIVRES.findIndex((v) => v.id === id);

// La lanterne de Lucie, améliorable à l'armurerie pour toute l'équipe :
// prix du niveau suivant, puis par niveau (0 à 3) la portée du faisceau (m),
// son demi-angle (rad), sa puissance, la distance où la nuit avale tout
// (brouillard, m), et le rayon du halo qu'elle répand tout autour d'elle
// (rayon, m). Dans ce halo, la nuit recule encore (jusqu'à recul fois plus
// loin, tout près d'elle) : on voit venir les zombies en restant près d'elle.
export const LANTERNE = {
  prix: [300, 600, 1000],
  portee: [36, 46, 56, 68],
  angle: [0.45, 0.55, 0.65, 0.76],
  puissance: [1, 1.2, 1.45, 1.7],
  brouillard: [22, 28, 35, 44],
  rayon: [16, 20, 24, 28],
  recul: 1.6,
};

// Jusqu'où l'on voit la nuit (m), selon le niveau de la lanterne et la
// distance à Lucie : plus loin dans son halo, au mieux recul fois plus loin
// à moins de la moitié du rayon.
export function visionNocturne(niveau, distance) {
  const n = Math.min(Math.max(niveau | 0, 0), LANTERNE.rayon.length - 1);
  const r = LANTERNE.rayon[n];
  const proche = Math.min(1, Math.max(0, (r - distance) / (r * 0.5)));
  return LANTERNE.brouillard[n] * (1 + (LANTERNE.recul - 1) * proche);
}
export const NIVEAU_LANTERNE_MAX = LANTERNE.prix.length;

// Les joueurs aussi sont attaqués. Un zombie à moins de aggro mètres d'un
// défenseur (et plus près de lui que du poteau) se jette sur lui ; il frappe
// toutes les cadence secondes (multipliées par celle de son type), coup
// points de vie par coup (fois les coups de son type) : deux coups d'un
// rôdeur et l'on est à terre. Un allié relève en restant près, E maintenu,
// pendant dureeReleve ; seul dans la partie, on se relève au bout de
// releveSeul. On se relève avec pvReleve points de vie. Pas de soin tout
// seul : il faut manger (VIVRES). repit : invulnérable juste après un coup.
// Un bouffi qui éclate à moins de explosion mètres fait un coup.
export const JOUEUR = {
  pv: 100,
  coup: 50,
  pvReleve: 50,
  aggro: 6,
  cadence: 1.1,
  repit: 1,
  distanceReleve: 1.8,
  dureeReleve: 3,
  releveSeul: 15,
  explosion: 2.5,
};

// Un zombie au contact retire DEGATS_MONSTRE points par seconde (multiplié
// par les degats de son type).
export const PORTEE_ATTAQUE = 1.1;
export const DEGATS_MONSTRE = 6;
export const MONSTRES_MAX = 60;

// Les types de zombies, dans l'ordre de leur indice k (instantanés). pv,
// vitesse et degats multiplient les valeurs du moment (danger) ; largeur et hauteur,
// la silhouette (et donc la zone à toucher) ; recompense : argent du tueur.
// max : nombre de ce type en même temps sur l'île ; etoile : chance de lâcher
// une étoile ; coups : coups portés à un joueur par attaque (1 par défaut) ;
// cadence : lenteur de ses attaques (1 par défaut).
export const TYPES_ZOMBIES = [
  {
    id: 'rodeur', nom: 'Rôdeur', pv: 1, vitesse: 1, degats: 1, largeur: 1, hauteur: 1, recompense: 10, etoile: 0.04,
    alerte: '',
  },
  {
    id: 'coureur', nom: 'Coureur', pv: 0.6, vitesse: 1.6, degats: 0.7, largeur: 0.9, hauteur: 0.95, recompense: 15, etoile: 0.05,
    alerte: 'Coureurs : rapides mais fragiles.',
  },
  {
    id: 'colosse', nom: 'Colosse', pv: 6, vitesse: 0.6, degats: 2.5, largeur: 1.5, hauteur: 1.45, recompense: 60, max: 4,
    etoile: 0.35, cadence: 1.6,
    alerte: 'Un colosse ! Lent, mais il encaisse : visez la tête.',
  },
  {
    id: 'bouffi', nom: 'Bouffi', pv: 1.5, vitesse: 0.85, degats: 0, largeur: 1.4, hauteur: 0.95, recompense: 25, explosif: true,
    etoile: 0.06,
    alerte: 'Un bouffi ! Il explose : abattez-le loin du poteau (et de vous).',
  },
  // Le boss (voir BOSS) : jamais tiré au sort, ses points de vie viennent de
  // pvBoss.
  {
    id: 'boss', nom: 'Le Roi Noyé', pv: 1, vitesse: 0.42, degats: 4, largeur: 3, hauteur: 3, recompense: 250, boss: true,
    etoile: 1, coups: 2, cadence: 1.8,
    alerte: '',
  },
];
export const indiceType = (id) => TYPES_ZOMBIES.findIndex((t) => t.id === id);

// Le bouffi explose au contact du poteau ou quand on l'abat : il blesse le
// protégé (s'il est à portée) et les zombies autour, avec un bonus au tireur
// pour chaque zombie emporté.
export const EXPLOSION_BOUFFI = { rayon: 3.5, degats: 80, protege: 25 };

// Le danger monte d'une carte à l'autre (etape : bosses déjà abattus) et
// d'un assaut à l'autre sur la même carte (cycle : 1 pour le premier). Il
// règle la cadence, la vitesse, la vie et le mélange des zombies.
export const danger = (etape, cycle) => 1 + 0.9 * etape + 0.3 * Math.max(0, cycle - 1);

// Part de chaque type parmi les apparitions (poids relatifs, dans l'ordre de
// TYPES_ZOMBIES ; le boss, sans poids, n'est jamais tiré). Au tout premier
// assaut, les colosses attendent un peu ; les types spéciaux gagnent du
// terrain avec le danger et au fil de l'assaut (avance : de 0 à 1).
export function poidsTypes(niveau, ecoule, avance = 0) {
  const m = niveau - 1;
  return [
    1,
    0.22 + 0.05 * m,
    m < 0.25 && ecoule < 45 ? 0 : 0.03 + 0.025 * m + 0.03 * avance,
    0.06 + 0.03 * m + 0.03 * avance,
  ];
}

// Le boss de chaque carte. Il ne vient que si l'on pose le protégé sur
// l'autel : un rituel de rituel secondes, puis il surgit. Il faut l'abattre
// en duree secondes, sinon c'est perdu. Pendant le combat, les zombies
// continuent d'arriver (apparitions : part de la cadence d'un assaut) et il
// appelle des coureurs en renfort toutes les invocation secondes. Sous la
// moitié de sa vie (enrage), il accélère.
export const BOSS = {
  nom: 'Le Roi Noyé',
  duree: 150, rituel: 4,
  pv: 1500, parEtape: 0.6, parDefenseur: 0.8,
  apparitions: 0.5,
  invocation: 12, premiereInvocation: 8, renforts: 3,
  enrage: 0.5, vitesseEnrage: 1.5,
};

// Ses points de vie montent de carte en carte (etape : bosses déjà abattus)
// et avec le nombre de défenseurs.
export function pvBoss(etape, defenseurs) {
  const d = Math.max(1, defenseurs);
  return Math.round(BOSS.pv * (1 + BOSS.parEtape * etape) * (1 + BOSS.parDefenseur * (d - 1)));
}

// Renforts appelés à chaque cri : un de plus toutes les deux cartes.
export const renfortsBoss = (etape) => BOSS.renforts + Math.floor(etape / 2);

// Tirage d'un type selon les poids (tirage : nombre entre 0 et 1).
export function tirerType(poids, tirage) {
  const total = poids.reduce((a, b) => a + b, 0);
  let seuil = tirage * total;
  for (const [k, p] of poids.entries()) {
    if (seuil < p) return k;
    seuil -= p;
  }
  return 0;
}

export const DISTANCE_PORTER = 2.5;
// Le poteau porté est devant, un peu à droite : il ne bouche pas la vue.
export const AVANCE_POTEAU = 0.9;
export const DECALAGE_POTEAU = 0.6;

// Position du poteau porté par un joueur (x, z, orientation du corps r).
export function positionPortee(x, z, r) {
  return {
    x: x + Math.sin(r) * AVANCE_POTEAU - Math.cos(r) * DECALAGE_POTEAU,
    z: z + Math.cos(r) * AVANCE_POTEAU + Math.sin(r) * DECALAGE_POTEAU,
  };
}

export const POTEAU_DEPART = { x: 6, z: -3 };

// Cylindre de collision d'un zombie, pieds à y = 0.
export const RAYON_MONSTRE = 0.4;
export const HAUTEUR_MONSTRE = 1.95;
export const HAUTEUR_TETE = 1.55;

// La cadence d'apparition monte pendant un assaut (avance : de 0 à 1, ×1,8 à
// la fin) et avec le danger.
export function monstresParMinute(niveau, avance = 0) {
  const base = 18 + 8 * (niveau - 1);
  return base * (1 + 0.8 * avance);
}

export function vitesseMonstre(niveau) {
  return Math.min(2.3 + 0.2 * (niveau - 1), 4);
}

export function pvMonstre(niveau) {
  return Math.round(PV_MONSTRE * (1 + 0.15 * (niveau - 1)));
}

// Dégâts d'une explosion selon la distance au centre (40 % au bord).
// source : { degats, rayon } (une arme, ou EXPLOSION_BOUFFI).
export function degatsExplosion(source, distance, degats = source.degats) {
  if (distance > source.rayon) return 0;
  return Math.round(degats * (1 - 0.6 * (distance / source.rayon)));
}

// Premier zombie traversé par un tir. cibles : [{ id, x, y, z, l, h }], y aux
// pieds ; l et h (1 par défaut) agrandissent le cylindre d'un gros zombie.
export function premierTouche(origine, direction, cibles, portee = 80) {
  const [ox, oy, oz] = origine;
  const [dx, dy, dz] = direction;
  const horizontal = dx * dx + dz * dz;
  let meilleur = null;
  for (const c of cibles) {
    const rayon = RAYON_MONSTRE * (c.l ?? 1);
    const haut = HAUTEUR_MONSTRE * (c.h ?? 1);
    let t;
    if (horizontal < 1e-9) {
      // Tir vertical : touché seulement si l'on est dans le cylindre.
      if (Math.hypot(c.x - ox, c.z - oz) > rayon) continue;
      t = dy > 0 ? c.y - oy : oy - (c.y + haut);
      if (t < 0) continue;
    } else {
      const tProche = ((c.x - ox) * dx + (c.z - oz) * dz) / horizontal;
      const px = ox + dx * tProche - c.x, pz = oz + dz * tProche - c.z;
      const d2 = px * px + pz * pz;
      if (d2 > rayon * rayon) continue;
      t = tProche - Math.sqrt((rayon * rayon - d2) / horizontal);
    }
    if (t < 0 || t > portee) continue;
    const hauteur = oy + dy * t - c.y;
    if (hauteur < 0 || hauteur > haut) continue;
    if (!meilleur || t < meilleur.distance) {
      meilleur = { id: c.id, distance: t, tete: hauteur >= HAUTEUR_TETE * (c.h ?? 1) };
    }
  }
  return meilleur;
}
