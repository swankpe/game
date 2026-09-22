import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerSimulation, normaliserMonde } from '../src/simulation.js';
import {
  DISTANCE_PORTER, DUREE_DEFAITE, DUREE_ILLUMINATION, DUREE_MANCHE, DUREE_PAUSE, PV_MONSTRE, PV_PROTEGE,
  POTEAU_DEPART, RECHARGE_ILLUMINATION, positionPortee, premierTouche, tirerProtege,
} from '../src/regles.js';
import { estPraticable, resoudreCollisions } from '../src/monde.js';

const graine = (n) => () => {
  n = (n * 16807) % 2147483647;
  return n / 2147483647;
};
const membres = (...ids) => ids.map((id) => ({ id }));
const joueurs = (entrees = {}) => new Map(Object.entries(entrees));

function lancer(ids = ['a', 'b', 'c', 'd'], options) {
  const sim = creerSimulation({ aleatoire: graine(42) });
  sim.definirMembres(membres(...ids), options);
  assert.ok(sim.demarrer());
  return sim;
}

function avancer(sim, secondes, j = joueurs(), pas = 0.1) {
  for (let t = 0; t < secondes; t += pas) sim.pas(pas, j);
}

// Défenseurs parfaits : chaque zombie meurt dès son apparition.
function avancerDefendu(sim, secondes) {
  for (let t = 0; t < secondes; t += 0.1) {
    sim.pas(0.1, joueurs());
    for (const m of [...sim.etat.monstres]) sim.toucher(m.id, 100);
  }
}

test('le poteau de départ est sur la terre ferme, hors des obstacles', () => {
  assert.ok(estPraticable(POTEAU_DEPART.x, POTEAU_DEPART.z));
  assert.deepEqual(resoudreCollisions(POTEAU_DEPART.x, POTEAU_DEPART.z), POTEAU_DEPART);
});

test('une manche démarre avec un protégé tiré parmi les joueurs', () => {
  const sim = lancer();
  const s = sim.etat;
  assert.equal(s.phase, 'manche');
  assert.equal(s.manche, 1);
  assert.equal(s.reste, DUREE_MANCHE);
  assert.equal(s.pv, PV_PROTEGE);
  assert.ok(['a', 'b', 'c', 'd'].includes(s.protege));
  assert.ok(!sim.demarrer(), 'on ne relance pas une partie en cours');
});

test('en solo, le joueur choisit son rôle ; en défenseur, le mannequin est attaché', () => {
  assert.equal(lancer(['a'], { roleSolo: 'protege' }).etat.protege, 'a');
  assert.equal(lancer(['a'], { roleSolo: 'defenseur' }).etat.protege, null);
});

test('le tirage évite de désigner deux fois de suite la même personne', () => {
  for (let i = 0; i < 50; i++) {
    assert.notEqual(tirerProtege(membres('a', 'b'), { precedent: 'a' }), 'a');
  }
  assert.equal(tirerProtege([], {}), null);
});

test("les zombies sortent de l'eau, marchent vers le poteau et blessent le protégé", () => {
  const sim = lancer();
  avancer(sim, 3);
  const s = sim.etat;
  assert.ok(s.monstres.length >= 1, 'un premier zombie dans les premières secondes');
  const premier = s.monstres[0];
  const depart = Math.hypot(premier.x - s.poteau.x, premier.z - s.poteau.z);
  assert.ok(depart > 15, 'apparition loin du poteau');
  avancer(sim, 25);
  const apres = s.monstres.find((m) => m.id === premier.id);
  assert.ok(Math.hypot(apres.x - s.poteau.x, apres.z - s.poteau.z) < depart - 10, 'il se rapproche');
  avancer(sim, 20);
  assert.ok(s.pv < PV_PROTEGE, 'le protégé perd de la vie au contact');
});

test('trois balles tuent un zombie, deux suffisent dans la tête', () => {
  const sim = lancer();
  avancer(sim, 3);
  const [m] = sim.etat.monstres;
  assert.equal(m.pv, PV_MONSTRE);
  assert.ok(!sim.toucher(m.id, 10));
  assert.ok(!sim.toucher(m.id, 10));
  assert.ok(sim.toucher(m.id, 10));
  assert.equal(sim.etat.tues, 1);
  assert.ok(!sim.etat.monstres.some((x) => x.id === m.id));
  assert.ok(!sim.toucher(m.id, 10), 'un zombie mort ne meurt pas deux fois');
});

test('sans défense, le protégé meurt : défaite, puis retour au camp', () => {
  const sim = lancer();
  let t = 0;
  while (sim.etat.phase === 'manche' && t < DUREE_MANCHE) {
    sim.pas(0.1, joueurs());
    t += 0.1;
  }
  assert.equal(sim.etat.phase, 'defaite');
  assert.equal(sim.etat.pv, 0);
  avancer(sim, DUREE_DEFAITE + 0.5);
  assert.equal(sim.etat.phase, 'attente');
  assert.equal(sim.etat.monstres.length, 0);
});

test('survivre 5 minutes gagne la manche ; la suivante a un nouveau protégé et plus de zombies', () => {
  const sim = lancer(['a', 'b']);
  const premierProtege = sim.etat.protege;
  let apparus1 = 0;
  let dernierId = 0;
  // Défenseurs parfaits : chaque zombie meurt dès son apparition.
  const nettoyer = () => {
    for (const m of [...sim.etat.monstres]) {
      if (m.id > dernierId) apparus1 += 1;
      dernierId = Math.max(dernierId, m.id);
      sim.toucher(m.id, 100);
    }
  };
  for (let t = 0; t < DUREE_MANCHE + 1 && sim.etat.phase === 'manche'; t += 0.1) {
    sim.pas(0.1, joueurs());
    nettoyer();
  }
  assert.equal(sim.etat.phase, 'pause');
  assert.equal(sim.etat.manche, 2);
  assert.notEqual(sim.etat.protege, premierProtege);
  avancer(sim, DUREE_PAUSE + 0.2);
  assert.equal(sim.etat.phase, 'manche');
  assert.equal(sim.etat.pv, PV_PROTEGE);
  let apparus2 = 0;
  for (let t = 0; t < DUREE_MANCHE - 1; t += 0.1) {
    sim.pas(0.1, joueurs());
    for (const m of [...sim.etat.monstres]) {
      if (m.id > dernierId) apparus2 += 1;
      dernierId = Math.max(dernierId, m.id);
      sim.toucher(m.id, 100);
    }
  }
  assert.ok(apparus2 > apparus1 * 1.3, `plus de zombies en manche 2 (${apparus1} puis ${apparus2})`);
});

test('porter le poteau : de près seulement, un porteur à la fois, jamais le protégé', () => {
  const sim = lancer(['a', 'b', 'c'], {});
  const s = sim.etat;
  const protege = s.protege;
  const [d1, d2] = ['a', 'b', 'c'].filter((id) => id !== protege);
  const pres = { x: s.poteau.x + 1, z: s.poteau.z, r: 0 };
  const loin = { x: s.poteau.x + DISTANCE_PORTER + 1, z: s.poteau.z, r: 0 };
  const j = joueurs({ [d1]: loin, [d2]: pres, [protege]: pres });
  assert.ok(!sim.demanderPorter(d1, j), 'trop loin');
  assert.ok(!sim.demanderPorter(protege, j), 'le protégé est ligoté');
  assert.ok(sim.demanderPorter(d2, j));
  j.set(d1, pres);
  assert.ok(!sim.demanderPorter(d1, j), 'déjà porté');

  // Le poteau suit le porteur, devant lui et un peu à sa droite.
  j.set(d2, { x: 0, z: 0, r: 0 });
  sim.pas(0.1, j);
  const attendu = positionPortee(0, 0, 0);
  assert.ok(Math.abs(s.poteau.x - attendu.x) < 1e-9 && Math.abs(s.poteau.z - attendu.z) < 1e-9);
  assert.ok(attendu.z > 0.8 && attendu.x < -0.5, 'devant (+z) et à droite (−x pour qui regarde +z)');
  assert.ok(!sim.poser(d1));
  assert.ok(sim.poser(d2));
  assert.equal(s.poteau.porteur, null);

  // Un porteur qui quitte le salon lâche le poteau.
  assert.ok(sim.demanderPorter(d2, joueurs({ [d2]: { x: 0, z: 0.5, r: 0 } })));
  sim.definirMembres(membres(protege, d1));
  assert.equal(s.poteau.porteur, null);
});

test("l'Illumination : 30 secondes, pour le protégé seulement, 3 minutes de recharge", () => {
  const sim = lancer(['a', 'b']);
  const { protege } = sim.etat;
  const autre = protege === 'a' ? 'b' : 'a';
  assert.ok(!sim.demanderIllumination(autre));
  assert.ok(sim.demanderIllumination(protege));
  assert.equal(sim.etat.illumination, DUREE_ILLUMINATION);
  assert.ok(!sim.demanderIllumination(protege), 'en recharge');
  avancerDefendu(sim, DUREE_ILLUMINATION + 0.5);
  assert.equal(sim.etat.illumination, 0);
  assert.ok(!sim.demanderIllumination(protege), 'toujours en recharge');
  avancerDefendu(sim, RECHARGE_ILLUMINATION - DUREE_ILLUMINATION);
  assert.equal(sim.etat.phase, 'manche');
  assert.ok(sim.demanderIllumination(protege));
});

test('un protégé qui part est remplacé par le mannequin, la manche continue', () => {
  const sim = lancer(['a', 'b']);
  const { protege } = sim.etat;
  sim.definirMembres(membres(protege === 'a' ? 'b' : 'a'));
  assert.equal(sim.etat.protege, null);
  assert.equal(sim.etat.phase, 'manche');
});

test("un nouvel hôte reprend exactement là où l'ancien s'est arrêté", () => {
  const ancien = lancer();
  avancer(ancien, 20);
  const inst = JSON.parse(JSON.stringify(ancien.instantane()));
  const nouveau = creerSimulation({ aleatoire: graine(7) });
  assert.ok(nouveau.charger(inst));
  assert.deepEqual(nouveau.instantane(), ancien.instantane());
  // Les identifiants continuent sans collision.
  avancer(nouveau, 10);
  const ids = nouveau.etat.monstres.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('un instantané malformé est refusé ou nettoyé, jamais appliqué tel quel', () => {
  assert.equal(normaliserMonde(null), null);
  assert.equal(normaliserMonde({ ph: 'fete' }), null);
  const i = normaliserMonde({ ph: 'manche', pv: 9999, pr: 42, po: ['x'], m: [[1, 2, 3], ['a', 1, 1], [2, NaN, 1]] });
  assert.equal(i.pv, PV_PROTEGE);
  assert.equal(i.protege, null);
  assert.equal(i.poteau.x, POTEAU_DEPART.x);
  assert.deepEqual(i.monstres.map((m) => m.id), [1]);
});

test('un tir touche le premier zombie sur sa trajectoire, et reconnaît la tête', () => {
  const cibles = [
    { id: 1, x: 0, y: 0, z: -10 },
    { id: 2, x: 0, y: 0, z: -5 },
    { id: 3, x: 3, y: 0, z: -3 },
  ];
  const corps = premierTouche([0, 1.2, 0], [0, 0, -1], cibles);
  assert.equal(corps.id, 2);
  assert.ok(!corps.tete);
  assert.ok(Math.abs(corps.distance - 4.6) < 1e-9);
  assert.ok(premierTouche([0, 1.7, 0], [0, 0, -1], cibles).tete);
  assert.equal(premierTouche([0, 1.2, 0], [0, 0, 1], cibles), null, 'derrière soi');
  assert.equal(premierTouche([0, 3, 0], [0, 0, -1], cibles), null, 'au-dessus des têtes');
  assert.equal(premierTouche([0, 1.2, 0], [0, 0, -1], cibles, 3), null, 'hors de portée');
});
