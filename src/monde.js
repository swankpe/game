// Carte de l'île : relief, décor et zones praticables. Fonctions pures,
// partagées par le rendu (ile.js) et les déplacements (joueur.js), pour que
// ce qu'on voit et ce qui bloque soient toujours la même chose.

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

  return { palmiers, rochers, touffes };
}

export const DECOR = genererDecor();

const OBSTACLES = [
  ...DECOR.palmiers.map((p) => ({ x: p.x, z: p.z, rayon: 0.3 })),
  ...DECOR.rochers.filter((r) => r.taille > 0.55).map((r) => ({ x: r.x, z: r.z, rayon: r.taille * 0.85 })),
];

// Repousse un point hors des obstacles (troncs, gros rochers, cabane).
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
