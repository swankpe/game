import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPARITION, BOUTIQUE, CABANE, CARTES, DECOR, PONTON, RAYON_JOUEUR, estPraticable, hauteurSol, hauteurTerrain, rayonIle, resoudreCollisions,
} from '../src/monde.js';

test("le rivage est au niveau de l'eau, le large en dessous", () => {
  for (const angle of [0, 1, 2, 3, 4, 5]) {
    const r = rayonIle(angle);
    const au = (t) => hauteurTerrain(Math.cos(angle) * r * t, Math.sin(angle) * r * t);
    assert.ok(au(0.5) > 0.4, `intérieur émergé (angle ${angle})`);
    assert.ok(Math.abs(au(1)) < 0.2, `rivage vers 0 (angle ${angle})`);
    assert.ok(au(1.3) < -2, `large profond (angle ${angle})`);
  }
});

test("on marche sur le ponton au-dessus de l'eau, pas dans l'eau profonde à côté", () => {
  const bout = PONTON.x1 - 0.5;
  assert.ok(hauteurTerrain(bout, 0) < -2);
  assert.ok(estPraticable(bout, 0));
  assert.equal(hauteurSol(bout, 0), PONTON.hauteur);
  assert.ok(!estPraticable(bout, PONTON.largeur));
});

test("le point d'apparition est praticable et dégagé", () => {
  assert.ok(estPraticable(APPARITION.x, APPARITION.z));
  const libre = resoudreCollisions(APPARITION.x, APPARITION.z);
  assert.deepEqual(libre, { x: APPARITION.x, z: APPARITION.z });
});

test('les troncs et la cabane repoussent le joueur', () => {
  const p = DECOR.palmiers[0];
  const r = resoudreCollisions(p.x + 0.1, p.z);
  assert.ok(Math.hypot(r.x - p.x, r.z - p.z) >= 0.3 + RAYON_JOUEUR - 1e-9);
  const c = resoudreCollisions(CABANE.x, CABANE.z);
  const dedans = Math.abs(c.x - CABANE.x) < CABANE.profondeur / 2 && Math.abs(c.z - CABANE.z) < CABANE.largeur / 2;
  assert.ok(!dedans);
});

test('le décor est identique à chaque chargement (même graine pour tous les joueurs)', async () => {
  const autre = await import(`../src/monde.js?rechargement=${Date.now()}`);
  assert.deepEqual(autre.DECOR, DECOR);
});

test('la barque, les torches et les caisses bloquent, sans gêner la boutique ni le poteau', () => {
  assert.ok(DECOR.epave, 'une barque échouée');
  assert.ok(DECOR.torches.length >= 4 && DECOR.caisses.length >= 1);
  const e = DECOR.epave;
  const r = resoudreCollisions(e.x + 0.05, e.z);
  // Repoussé hors de la coque (0,75 m de demi-largeur au milieu).
  assert.ok(Math.hypot(r.x - e.x, r.z - e.z) >= 0.75, 'on ne traverse pas la barque');
  assert.ok(hauteurTerrain(e.x, e.z) > -0.2, 'elle est échouée sur le sable');
  for (const t of DECOR.torches) {
    const p = resoudreCollisions(t.x + 0.01, t.z);
    assert.ok(Math.hypot(p.x - t.x, p.z - t.z) >= 0.15 + RAYON_JOUEUR - 1e-9);
  }
  const poteau = CARTES[0].poteau;
  for (const p of [BOUTIQUE, poteau]) assert.deepEqual(resoudreCollisions(p.x, p.z), { x: p.x, z: p.z });
});
