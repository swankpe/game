// Règles et réglages du Protégé. Tout l'équilibrage tient ici : changer une
// durée ou une cadence ne demande de toucher à rien d'autre.

export const DUREE_MANCHE = 300;
export const DUREE_PAUSE = 10;
export const DUREE_DEFAITE = 8;

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
// Armes possédées : un bit par arme, le pistolet (bit 0) toujours présent.
export const ARMES_DEPART = 1;

export const BONUS_MANCHE = 150;
export const DISTANCE_BOUTIQUE = 3.2;

export const DUREE_ILLUMINATION = 30;
export const RECHARGE_ILLUMINATION = 180;

// Un zombie au contact retire DEGATS_MONSTRE points par seconde (multiplié
// par les degats de son type).
export const PORTEE_ATTAQUE = 1.1;
export const DEGATS_MONSTRE = 6;
export const MONSTRES_MAX = 60;

// Les types de zombies, dans l'ordre de leur indice k (instantanés). pv,
// vitesse et degats multiplient les valeurs de la manche ; largeur et hauteur,
// la silhouette (et donc la zone à toucher) ; recompense : argent du tueur.
// max : nombre de ce type en même temps sur l'île.
export const TYPES_ZOMBIES = [
  {
    id: 'rodeur', nom: 'Rôdeur', pv: 1, vitesse: 1, degats: 1, largeur: 1, hauteur: 1, recompense: 10,
    alerte: '',
  },
  {
    id: 'coureur', nom: 'Coureur', pv: 0.6, vitesse: 1.6, degats: 0.7, largeur: 0.9, hauteur: 0.95, recompense: 15,
    alerte: 'Coureurs : rapides mais fragiles.',
  },
  {
    id: 'colosse', nom: 'Colosse', pv: 6, vitesse: 0.6, degats: 2.5, largeur: 1.5, hauteur: 1.45, recompense: 60, max: 4,
    alerte: 'Un colosse ! Lent, mais il encaisse : visez la tête.',
  },
  {
    id: 'bouffi', nom: 'Bouffi', pv: 1.5, vitesse: 0.85, degats: 0, largeur: 1.4, hauteur: 0.95, recompense: 25, explosif: true,
    alerte: 'Un bouffi ! Il explose : abattez-le loin du poteau.',
  },
  // Le boss de fin de manche (voir BOSS) : jamais tiré au sort, ses points de
  // vie viennent de pvBoss.
  {
    id: 'boss', nom: 'Le Roi Noyé', pv: 1, vitesse: 0.42, degats: 4, largeur: 3, hauteur: 3, recompense: 250, boss: true,
    alerte: '',
  },
];
export const indiceType = (id) => TYPES_ZOMBIES.findIndex((t) => t.id === id);

// Le bouffi explose au contact du poteau ou quand on l'abat : il blesse le
// protégé (s'il est à portée) et les zombies autour, avec un bonus au tireur
// pour chaque zombie emporté.
export const EXPLOSION_BOUFFI = { rayon: 3.5, degats: 80, protege: 25 };

// Part de chaque type parmi les apparitions (poids relatifs, dans l'ordre de
// TYPES_ZOMBIES ; le boss, sans poids, n'est jamais tiré). Les colosses attendent la deuxième minute de la première
// manche ; les types spéciaux gagnent du terrain de manche en manche.
export function poidsTypes(manche, ecoule) {
  const avance = ecoule / DUREE_MANCHE;
  const m = manche - 1;
  return [
    1,
    0.22 + 0.05 * m,
    manche === 1 && ecoule < 60 ? 0 : 0.03 + 0.025 * m + 0.03 * avance,
    0.06 + 0.03 * m + 0.03 * avance,
  ];
}

// Le boss de fin de manche. Quand le chrono tombe à zéro, il sort de la mer :
// la manche n'est gagnée qu'à sa mort. Pendant le combat, les zombies
// continuent d'arriver (apparitions : part de la cadence de début de manche)
// et il appelle des coureurs en renfort toutes les invocation secondes. Sous
// la moitié de sa vie (enrage), il accélère.
export const BOSS = {
  nom: 'Le Roi Noyé',
  pv: 1500, parManche: 0.6, parDefenseur: 0.8,
  apparitions: 0.5,
  invocation: 12, premiereInvocation: 8, renforts: 3,
  enrage: 0.5, vitesseEnrage: 1.5,
};

// Ses points de vie montent de manche en manche et avec le nombre de
// défenseurs (au moins un : le joueur seul face au mannequin).
export function pvBoss(manche, defenseurs) {
  const d = Math.max(1, defenseurs);
  return Math.round(BOSS.pv * (1 + BOSS.parManche * (manche - 1)) * (1 + BOSS.parDefenseur * (d - 1)));
}

// Renforts appelés à chaque cri : un de plus toutes les deux manches.
export const renfortsBoss = (manche) => BOSS.renforts + Math.floor((manche - 1) / 2);

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

// La cadence d'apparition monte pendant la manche (×2,5 à la fin) et d'une
// manche à l'autre.
export function monstresParMinute(manche, ecoule) {
  const base = 18 + 8 * (manche - 1);
  return base * (1 + (1.5 * ecoule) / DUREE_MANCHE);
}

export function vitesseMonstre(manche) {
  return Math.min(2.3 + 0.2 * (manche - 1), 4);
}

export function pvMonstre(manche) {
  return Math.round(PV_MONSTRE * (1 + 0.15 * (manche - 1)));
}

// Dégâts d'une explosion selon la distance au centre (40 % au bord).
// source : { degats, rayon } (une arme, ou EXPLOSION_BOUFFI).
export function degatsExplosion(source, distance, degats = source.degats) {
  if (distance > source.rayon) return 0;
  return Math.round(degats * (1 - 0.6 * (distance / source.rayon)));
}

// En solo, le joueur choisit son rôle ; sinon tirage au sort, en évitant de
// désigner deux fois de suite la même personne.
export function tirerProtege(membres, { aleatoire = Math.random, roleSolo = 'defenseur', precedent = null } = {}) {
  if (membres.length === 0) return null;
  if (membres.length === 1) return roleSolo === 'protege' ? membres[0].id : null;
  const candidats = membres.filter((m) => m.id !== precedent);
  return candidats[Math.floor(aleatoire() * candidats.length) % candidats.length].id;
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
