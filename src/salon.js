// Règles du salon, sans réseau ni navigateur. Chaque client applique les mêmes
// règles à la même liste de présents : ils arrivent tous à la même conclusion
// sans serveur qui arbitre.

import { nettoyerNom, normaliserApparence } from './apparence.js';

export const JOUEURS_MAX = 4;
export const LONGUEUR_CODE = 4;

// Ni I, L, O, 0 ni 1 : un code se dicte au téléphone sans ambiguïté.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function genererCode(aleatoire = Math.random) {
  let code = '';
  for (let i = 0; i < LONGUEUR_CODE; i++) {
    code += ALPHABET[Math.floor(aleatoire() * ALPHABET.length) % ALPHABET.length];
  }
  return code;
}

export function normaliserCode(texte) {
  const code = String(texte ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== LONGUEUR_CODE) return null;
  return [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

export function membreDepuisMeta(id, meta) {
  const m = meta && typeof meta === 'object' ? meta : {};
  return {
    id: String(id),
    nom: nettoyerNom(m.nom) || 'Pêcheur',
    apparence: normaliserApparence(m.apparence),
    arrivee: Number.isFinite(m.arrivee) ? m.arrivee : Infinity,
    installe: m.installe === true,
  };
}

// Les joueurs déjà installés passent devant : un nouveau venu dont l'horloge
// retarde ne peut pas évincer quelqu'un qui joue déjà.
export function ordonnerMembres(membres) {
  return [...membres].sort(
    (a, b) =>
      Number(b.installe) - Number(a.installe) ||
      (a.arrivee === b.arrivee ? 0 : a.arrivee < b.arrivee ? -1 : 1) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export function repartir(membres, monId) {
  const ordre = ordonnerMembres(membres);
  const admis = ordre.slice(0, JOUEURS_MAX);
  const refuses = ordre.slice(JOUEURS_MAX);
  let statut = 'absent';
  if (admis.some((m) => m.id === monId)) statut = 'admis';
  else if (refuses.some((m) => m.id === monId)) statut = 'refuse';
  return { admis, refuses, statut };
}
