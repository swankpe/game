import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARTES, carteDeManche } from '../src/monde.js';
import { PAS_MAX } from '../src/navigation.js';
import * as chateau from '../src/chateau.js';

const C = CARTES[1];

test('les manches alternent : l’île, puis la cour du château, puis l’île', () => {
  assert.equal(CARTES[carteDeManche(1)].id, 'ile');
  assert.equal(CARTES[carteDeManche(2)].id, 'chateau');
  assert.equal(CARTES[carteDeManche(3)].id, 'ile');
  assert.equal(carteDeManche(0), 0, 'le camp est sur l’île');
});

test('les murailles arrêtent, les portes laissent passer, la cour est plate', () => {
  assert.equal(C.hauteurSol(-10, 10), 0);
  // Face intérieure d'une muraille : bien plus haut qu'une marche.
  assert.ok(C.hauteurSol(-10, -19) - C.hauteurSol(-10, -17) > PAS_MAX * 3);
  for (const [x, z] of [[0, -20], [0, 20], [-20, 0]]) assert.equal(C.hauteurSol(x, z), 0, `porte en (${x}, ${z})`);
  assert.ok(C.hauteurSol(20, 0) >= chateau.H_RONDE, 'pas de porte à l’est');
  assert.ok(C.hauteurSol(21.5, 0) > chateau.H_RONDE, 'parapet côté champ');
});

test('rampes et escaliers montent en pente douce jusqu’à la terrasse et au chemin de ronde', () => {
  for (const r of chateau.RAMPES) {
    let precedente = C.hauteurSol(...r.a);
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const x = r.a[0] + (r.b[0] - r.a[0]) * t, z = r.a[1] + (r.b[1] - r.a[1]) * t;
      const h = C.hauteurSol(x, z);
      assert.ok(h - precedente <= PAS_MAX, `marche de ${(h - precedente).toFixed(2)} m`);
      precedente = h;
    }
    assert.ok(precedente >= r.hb - 0.01);
  }
  assert.equal(C.hauteurSol(0, 0), chateau.H_TERRASSE);
  assert.ok(C.hauteurSol(0, -4.3) - chateau.H_TERRASSE > PAS_MAX, 'un muret entoure la terrasse');
});

test('tout le chemin de ronde est joignable, et la terrasse depuis chaque porte', () => {
  const nav = C.navigation();
  for (const [x, z] of [[-10, -19.5], [10, -19.5], [-10, 19.5], [10, 19.5], [-19.5, -10], [-19.5, 10], [19.5, -10], [19.5, 10]]) {
    assert.ok(Number.isFinite(nav.distance(0, 30, x, z)), `chemin de ronde en (${x}, ${z})`);
  }
  for (const [x, z] of [[0, -30], [0, 30], [-30, 0], [30, 0]]) {
    const d = nav.distance(x, z, 0, 0);
    assert.ok(Number.isFinite(d) && d < 90, `terrasse depuis (${x}, ${z}) : ${d}`);
  }
  // Suivre les points de passage mène bien en haut, sans escalader.
  let x = -30, z = 0, h = 0, pas = 0;
  while (Math.hypot(x, z) > 1.2 && pas++ < 1000) {
    const p = nav.vers(x, z, 0, 0);
    const d = Math.hypot(p.x - x, p.z - z) || 1;
    x += ((p.x - x) / d) * Math.min(0.3, d);
    z += ((p.z - z) / d) * Math.min(0.3, d);
    const nh = C.hauteurSol(x, z);
    assert.ok(nh - h <= PAS_MAX + 1e-9);
    h = nh;
  }
  assert.equal(h, chateau.H_TERRASSE);
});

test('les zombies sortent du champ, hors des murailles ; boutique, arrivée et poteau sont dans la cour', () => {
  let n = 0;
  const alea = () => ((n = (n * 16807 + 11) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const p = C.pointDeSortie(alea);
    assert.ok(Math.max(Math.abs(p.x), Math.abs(p.z)) > 25 && C.estPraticable(p.x, p.z));
  }
  for (const p of [C.boutique, C.apparition, C.poteau]) {
    assert.ok(Math.max(Math.abs(p.x), Math.abs(p.z)) < chateau.COUR);
    assert.equal(C.hauteurSol(p.x, p.z), 0);
    assert.deepEqual(C.resoudreCollisions(p.x, p.z), { x: p.x, z: p.z });
  }
});

test('le cimetière et les arbres morts bloquent, sans couper le chemin des zombies', () => {
  const nav = C.navigation();
  const tombes = chateau.OBSTACLES.filter((o) => o.genre === 'tombe' || o.genre === 'croix');
  assert.ok(tombes.length >= 10);
  for (const o of chateau.OBSTACLES) {
    const p = C.resoudreCollisions(o.x + 0.05, o.z);
    assert.ok(Math.hypot(p.x - o.x, p.z - o.z) >= o.rayon, `${o.genre} en (${o.x}, ${o.z}) bloque`);
  }
  // Depuis les sorties longeant le cimetière, la terrasse reste joignable.
  for (const z of [-30, -12, -5, 0, 5, 12, 30]) {
    const d = nav.distance(30, z, 0, 0);
    assert.ok(Number.isFinite(d) && d < 110, `terrasse depuis (30, ${z}) : ${d}`);
  }
  // Aucun point de sortie ne tombe dans un obstacle.
  let n = 7;
  const alea = () => ((n = (n * 16807 + 11) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) {
    const p = C.pointDeSortie(alea);
    assert.ok(chateau.OBSTACLES.every((o) => Math.hypot(p.x - o.x, p.z - o.z) > o.rayon), `sortie (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  }
});
