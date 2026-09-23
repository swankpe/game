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
// tirs ; dispersion : écart maximal du tir, en radians ; recul : à-coup du
// regard vers le haut. Munitions illimitées.
export const ARMES = [
  {
    id: 'pistolet', nom: 'Pistolet', prix: 0,
    degats: 10, cadence: 0.28, dispersion: 0.004, portee: 60, recul: 0.012,
    description: 'Fidèle et précis. Trois balles pour un zombie, deux dans la tête.',
  },
  {
    id: 'uzi', nom: 'Mini Uzi', prix: 250,
    degats: 7, cadence: 0.07, dispersion: 0.03, portee: 40, recul: 0.005,
    description: 'Compact et nerveux : une pluie de balles, mais qui s’écarte de loin.',
  },
  {
    id: 'fusil', nom: 'Fusil d’assaut', prix: 600,
    degats: 16, cadence: 0.11, dispersion: 0.01, portee: 70, recul: 0.009,
    description: 'Puissant, précis, rapide : l’arme pour tenir la ligne.',
  },
  {
    id: 'lance', nom: 'Lance-grenades', prix: 1200,
    degats: 90, cadence: 0.85, dispersion: 0.005, portee: 80, recul: 0.03,
    projectile: true, vitesse: 24, rayon: 4.5,
    description: 'La grenade explose au contact et balaie tout un groupe.',
  },
];

export const indiceArme = (id) => ARMES.findIndex((a) => a.id === id);
// Armes possédées : un bit par arme, le pistolet (bit 0) toujours présent.
export const ARMES_DEPART = 1;

export const RECOMPENSE_ZOMBIE = 10;
export const BONUS_MANCHE = 150;
export const DISTANCE_BOUTIQUE = 3.2;

export const DUREE_ILLUMINATION = 30;
export const RECHARGE_ILLUMINATION = 180;

// Un zombie au contact retire DEGATS_MONSTRE points par seconde.
export const PORTEE_ATTAQUE = 1.1;
export const DEGATS_MONSTRE = 6;
export const MONSTRES_MAX = 60;
// Une part des zombies court : ils arrivent en premier.
export const PART_COUREURS = 0.18;

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

// Dégâts d'une grenade selon la distance au point d'impact (40 % au bord).
export function degatsExplosion(arme, distance) {
  if (distance > arme.rayon) return 0;
  return Math.round(arme.degats * (1 - 0.6 * (distance / arme.rayon)));
}

// En solo, le joueur choisit son rôle ; sinon tirage au sort, en évitant de
// désigner deux fois de suite la même personne.
export function tirerProtege(membres, { aleatoire = Math.random, roleSolo = 'defenseur', precedent = null } = {}) {
  if (membres.length === 0) return null;
  if (membres.length === 1) return roleSolo === 'protege' ? membres[0].id : null;
  const candidats = membres.filter((m) => m.id !== precedent);
  return candidats[Math.floor(aleatoire() * candidats.length) % candidats.length].id;
}

// Premier zombie traversé par un tir. cibles : [{ id, x, y, z }], y aux pieds.
export function premierTouche(origine, direction, cibles, portee = 80) {
  const [ox, oy, oz] = origine;
  const [dx, dy, dz] = direction;
  const horizontal = dx * dx + dz * dz;
  let meilleur = null;
  for (const c of cibles) {
    let t;
    if (horizontal < 1e-9) {
      // Tir vertical : touché seulement si l'on est dans le cylindre.
      if (Math.hypot(c.x - ox, c.z - oz) > RAYON_MONSTRE) continue;
      t = dy > 0 ? c.y - oy : oy - (c.y + HAUTEUR_MONSTRE);
      if (t < 0) continue;
    } else {
      const tProche = ((c.x - ox) * dx + (c.z - oz) * dz) / horizontal;
      const px = ox + dx * tProche - c.x, pz = oz + dz * tProche - c.z;
      const d2 = px * px + pz * pz;
      if (d2 > RAYON_MONSTRE * RAYON_MONSTRE) continue;
      t = tProche - Math.sqrt((RAYON_MONSTRE * RAYON_MONSTRE - d2) / horizontal);
    }
    if (t < 0 || t > portee) continue;
    const hauteur = oy + dy * t - c.y;
    if (hauteur < 0 || hauteur > HAUTEUR_MONSTRE) continue;
    if (!meilleur || t < meilleur.distance) meilleur = { id: c.id, distance: t, tete: hauteur >= HAUTEUR_TETE };
  }
  return meilleur;
}
