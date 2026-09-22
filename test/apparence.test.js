import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPARENCE_PAR_DEFAUT, COULEURS, FORMES, NOM_MAX, apparenceAleatoire, nettoyerNom, normaliserApparence,
} from '../src/apparence.js';

test('une apparence valide passe sans changement (couleurs en minuscules)', () => {
  const a = { ...APPARENCE_PAR_DEFAUT, tete: 'patate', chapeau: 'bob', salopette: '#ABCDEF' };
  assert.deepEqual(normaliserApparence(a), { ...a, salopette: '#abcdef' });
});

test('les valeurs hors catalogue reprennent la valeur par défaut', () => {
  const a = normaliserApparence({ tete: 'dragon', yeux: 42, peau: 'url(javascript:1)', haut: '#12345' });
  assert.equal(a.tete, APPARENCE_PAR_DEFAUT.tete);
  assert.equal(a.yeux, APPARENCE_PAR_DEFAUT.yeux);
  assert.equal(a.peau, APPARENCE_PAR_DEFAUT.peau);
  assert.equal(a.haut, APPARENCE_PAR_DEFAUT.haut);
  assert.deepEqual(normaliserApparence('nimporte quoi'), APPARENCE_PAR_DEFAUT);
});

test("l'apparence aléatoire reste dans le catalogue", () => {
  for (let i = 0; i < 100; i++) {
    const a = apparenceAleatoire();
    assert.deepEqual(normaliserApparence(a), a);
    for (const [champ, liste] of Object.entries(FORMES)) assert.ok(liste.some((o) => o.id === a[champ]));
    for (const [champ, liste] of Object.entries(COULEURS)) assert.ok(liste.includes(a[champ]));
  }
  // Borne haute du générateur : pas de débordement de tableau.
  assert.deepEqual(normaliserApparence(apparenceAleatoire(() => 0.9999999)), apparenceAleatoire(() => 0.9999999));
});

test('le nom est nettoyé et limité sans couper un emoji', () => {
  assert.equal(nettoyerNom('  Jean   Michel \n'), 'Jean Michel');
  assert.equal(nettoyerNom('a\u0000b'), 'ab');
  assert.equal(nettoyerNom(12), '');
  const long = '🐟'.repeat(30);
  assert.equal(Array.from(nettoyerNom(long)).length, NOM_MAX);
  assert.ok(!nettoyerNom(long).includes('\ud83d\ud83d'));
});
