// Règles et réglages du Protégé. Tout l'équilibrage tient ici : changer une
// durée ou une cadence ne demande de toucher à rien d'autre.

export const DUREE_MANCHE = 300;
export const DUREE_PAUSE = 10;
export const DUREE_DEFAITE = 8;

export const PV_PROTEGE = 100;
export const PV_MONSTRE = 30;
export const DEGATS_TIR = 10;
export const MULTIPLICATEUR_TETE = 2;
export const CADENCE_TIR = 0.28;
export const PORTEE_TIR = 60;

export const DUREE_ILLUMINATION = 30;
export const RECHARGE_ILLUMINATION = 180;

// Un zombie au contact retire DEGATS_MONSTRE points par seconde.
export const PORTEE_ATTAQUE = 1.1;
export const DEGATS_MONSTRE = 6;
export const MONSTRES_MAX = 40;

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

export function monstresParMinute(manche, ecoule) {
  const base = 8 + 4 * (manche - 1);
  return base * (1 + ecoule / DUREE_MANCHE);
}

export function vitesseMonstre(manche) {
  return Math.min(1.4 + 0.12 * (manche - 1), 2.8);
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
export function premierTouche(origine, direction, cibles, portee = PORTEE_TIR) {
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
