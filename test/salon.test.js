import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererCode, normaliserCode, membreDepuisMeta, ordonnerMembres, repartir, JOUEURS_MAX } from '../src/salon.js';

test('un code généré est toujours accepté tel quel', () => {
  for (let i = 0; i < 500; i++) {
    const code = genererCode();
    assert.equal(normaliserCode(code), code);
  }
});

test('le code saisi est nettoyé, les caractères ambigus refusés', () => {
  assert.equal(normaliserCode(' ab-cd '), 'ABCD');
  assert.equal(normaliserCode('abc'), null);
  assert.equal(normaliserCode('ABCDE'), null);
  assert.equal(normaliserCode('AB0D'), null);
  assert.equal(normaliserCode('ABID'), null);
  assert.equal(normaliserCode(undefined), null);
});

test("un membre mal formé reçoit des valeurs sûres, jamais inventées", () => {
  const m = membreDepuisMeta('x', { nom: '  <b>Léa</b>  ', apparence: { tete: 'licorne', peau: 'rouge' }, arrivee: 'hier' });
  assert.equal(m.nom, '<b>Léa</b>');
  assert.equal(m.apparence.tete, 'cacahuete');
  assert.equal(m.apparence.peau, '#e3bf86');
  assert.equal(m.arrivee, Infinity);
  assert.equal(m.installe, false);
  assert.equal(membreDepuisMeta('y', null).nom, 'Pêcheur');
});

const membre = (id, arrivee, installe = false) => ({ id, arrivee, installe });

test('les premiers arrivés sont admis, le cinquième refusé', () => {
  const membres = [membre('e', 5), membre('b', 2), membre('d', 4), membre('a', 1), membre('c', 3)];
  const r = repartir(membres, 'e');
  assert.equal(JOUEURS_MAX, 4);
  assert.deepEqual(r.admis.map((m) => m.id), ['a', 'b', 'c', 'd']);
  assert.equal(r.statut, 'refuse');
  assert.equal(repartir(membres, 'a').statut, 'admis');
  assert.equal(repartir(membres, 'z').statut, 'absent');
});

test("un nouveau venu à l'horloge en retard n'évince pas un joueur installé", () => {
  const membres = [membre('a', 100, true), membre('b', 200, true), membre('c', 300, true), membre('d', 400, true), membre('retard', 1)];
  const r = repartir(membres, 'retard');
  assert.equal(r.statut, 'refuse');
  assert.deepEqual(r.admis.map((m) => m.id), ['a', 'b', 'c', 'd']);
});

test("à égalité d'arrivée, l'identifiant départage : tous les clients concluent pareil", () => {
  const liste = [membre('b', 1), membre('a', 1), membre('c', Infinity), membre('d', Infinity)];
  const attendu = ['a', 'b', 'c', 'd'];
  assert.deepEqual(ordonnerMembres(liste).map((m) => m.id), attendu);
  assert.deepEqual(ordonnerMembres([...liste].reverse()).map((m) => m.id), attendu);
});
