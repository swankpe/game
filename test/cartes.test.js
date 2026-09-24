import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARTES, carteDEtape } from '../src/monde.js';
import { RAYON_JOUEUR, dansObstacle } from '../src/carte-ouverte.js';
import { PAS_MAX } from '../src/navigation.js';
import { ARMURERIE, MAISONS, VILLAGE } from '../src/village.js';
import { AUTEL_FORET, CABANE_CHASSEUR, ETANG, FORET } from '../src/foret.js';

// Les genres que rendu-village.js et rendu-foret.js savent dessiner : un
// obstacle d'un autre genre bloquerait sans se voir.
const DESSINES = {
  village: ['moulin', 'marche', 'puits', 'forge', 'charrette', 'caisses', 'tombe', 'croix', 'meule', 'feuillu', 'sapin', 'rocher'],
  foret: ['etang', 'feu', 'menhir', 'sapin', 'feuillu', 'rocher', 'tronc'],
};

test('le parcours : l’île, le village, la forêt, puis on recommence', () => {
  assert.deepEqual(CARTES.map((c) => c.id), ['ile', 'village', 'foret']);
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(carteDEtape), [0, 1, 2, 0, 1, 1]);
});

test('chaque obstacle des cartes ouvertes est d’un genre dessiné', () => {
  for (const c of [VILLAGE, FORET]) {
    for (const o of c.obstacles) assert.ok(DESSINES[c.id].includes(o.genre), `${c.id} : genre ${o.genre}`);
  }
});

test('les maisons et l’étal bloquent, par le côté le plus proche ; la place est libre', () => {
  const h = MAISONS[0];
  const r = VILLAGE.resoudreCollisions(h.x, h.z);
  assert.ok(Math.hypot(r.x - h.x, r.z - h.z) >= Math.min(h.l, h.p) / 2, 'sorti de la maison');
  assert.ok(!dansObstacle(VILLAGE, r.x, r.z, RAYON_JOUEUR - 0.01), 'et pas dans une autre');
  assert.ok(dansObstacle(VILLAGE, ARMURERIE.x, ARMURERIE.z));
  assert.ok(!dansObstacle(VILLAGE, 0, 0, 1), 'la place');
  assert.deepEqual(VILLAGE.resoudreCollisions(0.5, 0.5), { x: 0.5, z: 0.5 });
});

test('la lisière borne les déplacements', () => {
  for (const c of [VILLAGE, FORET]) {
    assert.equal(c.resoudreCollisions(c.borne + 20, 0).x, c.borne);
    assert.ok(!c.estPraticable(c.borne + 1, 0));
    assert.ok(c.estPraticable(c.borne - 1, 0));
  }
});

test('un tronc couché bloque sur toute sa longueur', () => {
  const t = FORET.obstacles.find((o) => o.genre === 'tronc');
  for (const s of [-1, 0, 1]) {
    const x = t.x + Math.cos(t.cap) * t.demi * s, z = t.z + Math.sin(t.cap) * t.demi * s;
    assert.ok(dansObstacle(FORET, x, z), `au point ${s}`);
    const r = FORET.resoudreCollisions(x + 0.01, z + 0.01);
    assert.ok(Math.hypot(r.x - x, r.z - z) >= t.rayon, 'repoussé hors du tronc');
  }
});

test('l’étang et la cabane bloquent ; de la clairière à l’autel, le chemin est libre', () => {
  assert.ok(dansObstacle(FORET, ETANG.x, ETANG.z));
  assert.ok(dansObstacle(FORET, CABANE_CHASSEUR.x, CABANE_CHASSEUR.z));
  for (let t = 0.25; t <= 0.8; t += 0.05) {
    const x = AUTEL_FORET.x * t, z = AUTEL_FORET.z * t;
    assert.ok(!dansObstacle(FORET, x, z, RAYON_JOUEUR), `(${x.toFixed(1)}, ${z.toFixed(1)})`);
  }
});

test('le relief reste doux : aucune marche infranchissable sur la carte', () => {
  for (const c of [VILLAGE, FORET]) {
    for (let x = -c.borne; x < c.borne; x += 0.5) {
      for (let z = -c.borne; z < c.borne; z += 0.5) {
        if (dansObstacle(c, x, z)) continue;
        const h = c.hauteurSol(x, z);
        assert.ok(Math.abs(c.hauteurSol(x + 0.5, z) - h) < PAS_MAX && Math.abs(c.hauteurSol(x, z + 0.5) - h) < PAS_MAX, `${c.id} (${x}, ${z})`);
      }
    }
  }
});

test('les zombies contournent une maison : le champ de distances passe à côté', () => {
  const nav = VILLAGE.navigation();
  assert.equal(VILLAGE.navigation(), nav, 'construit une seule fois');
  // Derrière la première maison, en visant la place.
  const h = MAISONS[0];
  const derriere = { x: h.x - Math.sin(h.ry) * (h.p / 2 + 1.5), z: h.z - Math.cos(h.ry) * (h.p / 2 + 1.5) };
  const cible = { x: h.x + Math.sin(h.ry) * (h.p / 2 + 3), z: h.z + Math.cos(h.ry) * (h.p / 2 + 3) };
  const droit = Math.hypot(cible.x - derriere.x, cible.z - derriere.z);
  const trajet = nav.distance(derriere.x, derriere.z, cible.x, cible.z);
  assert.ok(Number.isFinite(trajet) && trajet > droit + 1, `le détour (${trajet.toFixed(1)} m au lieu de ${droit.toFixed(1)})`);
  // Pas à pas, on arrive sans jamais traverser la maison.
  let p = derriere;
  for (let i = 0; i < 60 && Math.hypot(p.x - cible.x, p.z - cible.z) > 1.5; i++) {
    p = nav.vers(p.x, p.z, cible.x, cible.z);
    assert.ok(!dansObstacle(VILLAGE, p.x, p.z), `(${p.x}, ${p.z}) dans un obstacle`);
  }
  assert.ok(Math.hypot(p.x - cible.x, p.z - cible.z) <= 1.5);
  assert.equal(CARTES[0].navigation(), null, 'sur l’île, on va droit');
});
