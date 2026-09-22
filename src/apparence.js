// Catalogue du personnage. Toute apparence reçue du réseau passe par
// normaliserApparence : on n'affiche jamais une valeur hors catalogue.

export const TETES = [
  { id: 'cacahuete', libelle: 'Cacahuète' },
  { id: 'oeuf', libelle: 'Œuf' },
  { id: 'haricot', libelle: 'Haricot' },
  { id: 'patate', libelle: 'Patate' },
];

export const YEUX = [
  { id: 'globuleux', libelle: 'Globuleux' },
  { id: 'ronds', libelle: 'Ronds' },
  { id: 'petits', libelle: 'Petits' },
  { id: 'endormis', libelle: 'Endormis' },
];

export const CHAPEAUX = [
  { id: 'aucun', libelle: 'Aucun' },
  { id: 'bob', libelle: 'Bob' },
  { id: 'casquette', libelle: 'Casquette' },
  { id: 'bonnet', libelle: 'Bonnet' },
  { id: 'paille', libelle: 'Paille' },
];

export const FORMES = { tete: TETES, yeux: YEUX, chapeau: CHAPEAUX };

export const COULEURS = {
  peau: ['#e3bf86', '#f0d2b0', '#c8955f', '#94603f', '#5e3b28', '#a7d68f', '#9fc3ee'],
  haut: ['#343d6b', '#5a5f6b', '#e9e4d8', '#7a2e3a', '#2f6b4f', '#c9a227', '#1f1f24'],
  salopette: ['#f07c1e', '#f2c230', '#d8443a', '#3d7fd1', '#4c9c4a', '#8a5ad8', '#e8e0cf'],
  bottes: ['#1f1f24', '#4a3527', '#f2c230', '#2f6b4f', '#d8443a'],
  couleurChapeau: ['#f2c230', '#f07c1e', '#d8443a', '#343d6b', '#e9e4d8', '#4c9c4a', '#d9b56c'],
};

export const APPARENCE_PAR_DEFAUT = {
  tete: 'cacahuete',
  yeux: 'globuleux',
  chapeau: 'aucun',
  peau: '#e3bf86',
  haut: '#343d6b',
  salopette: '#f07c1e',
  bottes: '#1f1f24',
  couleurChapeau: '#f2c230',
};

export const NOM_MAX = 16;

const HEX = /^#[0-9a-f]{6}$/i;

export function nettoyerNom(texte) {
  if (typeof texte !== 'string') return '';
  const propre = texte.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  // Array.from découpe par caractère : un emoji n'est pas coupé en deux.
  return Array.from(propre).slice(0, NOM_MAX).join('').trim();
}

export function normaliserApparence(brute) {
  const a = brute && typeof brute === 'object' ? brute : {};
  const resultat = {};
  for (const [champ, liste] of Object.entries(FORMES)) {
    resultat[champ] = liste.some((o) => o.id === a[champ]) ? a[champ] : APPARENCE_PAR_DEFAUT[champ];
  }
  for (const champ of Object.keys(COULEURS)) {
    const valeur = a[champ];
    resultat[champ] = typeof valeur === 'string' && HEX.test(valeur) ? valeur.toLowerCase() : APPARENCE_PAR_DEFAUT[champ];
  }
  return resultat;
}

export function apparenceAleatoire(aleatoire = Math.random) {
  const tirer = (liste) => liste[Math.floor(aleatoire() * liste.length) % liste.length];
  const resultat = {};
  for (const [champ, liste] of Object.entries(FORMES)) resultat[champ] = tirer(liste).id;
  for (const [champ, liste] of Object.entries(COULEURS)) resultat[champ] = tirer(liste);
  return resultat;
}
