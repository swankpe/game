import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerSimulation, normaliserMonde } from '../src/simulation.js';
import {
  ARMES, ARMES_DEPART, BONUS_MANCHE, DISTANCE_PORTER, DUREE_DEFAITE, DUREE_ILLUMINATION, DUREE_MANCHE, DUREE_PAUSE,
  BOSS, DUREE_PREPARATION, ETOILES, EXPLOSION_BOUFFI, HAUTEUR_TETE, JOUEUR, LANTERNE, NIVEAU_LANTERNE_MAX, armeAmelioree, PV_MONSTRE, PV_PROTEGE, POTEAU_DEPART, RECHARGE_ILLUMINATION, TYPES_ZOMBIES,
  degatsExplosion, indiceArme, indiceType, monstresParMinute, poidsTypes, positionPortee, premierTouche, pvBoss,
  pvMonstre, renfortsBoss, tirerProtege, tirerType, vitesseMonstre,
} from '../src/regles.js';
import { BOUTIQUE, CABANE, CARTES, estPraticable, rayonIle, resoudreCollisions } from '../src/monde.js';

const graine = (n) => () => {
  n = (n * 16807) % 2147483647;
  return n / 2147483647;
};
const membres = (...ids) => ids.map((id) => ({ id }));
const joueurs = (entrees = {}) => new Map(Object.entries(entrees));

function lancer(ids = ['a', 'b', 'c', 'd'], options) {
  // Le boss à la fin du chrono, comme en jeu normal (BOSS.apparition peut
  // être avancé pour les essais).
  // Sans préparation (testée à part) : la manche commence tout de suite.
  const sim = creerSimulation({ aleatoire: graine(42), apparitionBoss: DUREE_MANCHE, dureePreparation: 0 });
  sim.definirMembres(membres(...ids), options);
  assert.ok(sim.demarrer());
  return sim;
}

function avancer(sim, secondes, j = joueurs(), pas = 0.1) {
  for (let t = 0; t < secondes; t += pas) sim.pas(pas, j);
}

// Un zombie posé à la main, sans autres apparitions.
function seul(sim, type, x, z, extra = {}) {
  const k = indiceType(type);
  sim.etat.cumul = -1e9;
  const m = { id: 900 + sim.etat.monstres.length, k, x, z, r: 0, pv: Math.round(pvMonstre(sim.etat.manche) * TYPES_ZOMBIES[k].pv), v: 1, a: false, c: 1, ...extra };
  sim.etat.monstres.push(m);
  return m;
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
  let t = 3;
  while (!s.monstres.some((m) => m.k === 0) && t < 30) {
    sim.pas(0.1, joueurs());
    t += 0.1;
  }
  // Un rôdeur : un bouffi exploserait au poteau avant la fin du test.
  const premier = s.monstres.find((m) => m.k === 0);
  const depart = Math.hypot(premier.x - s.poteau.x, premier.z - s.poteau.z);
  assert.ok(depart > 15, 'apparition loin du poteau');
  avancer(sim, 6);
  const apres = s.monstres.find((m) => m.id === premier.id);
  assert.ok(Math.hypot(apres.x - s.poteau.x, apres.z - s.poteau.z) < depart - 8, 'il se rapproche');
  avancer(sim, 20);
  assert.ok(s.pv < PV_PROTEGE, 'le protégé perd de la vie au contact');
});

test('trois balles tuent un rôdeur, deux suffisent dans la tête', () => {
  const sim = lancer();
  sim.etat.monstres = [];
  const m = seul(sim, 'rodeur', 30, 0);
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

test('survivre 5 minutes puis abattre le boss gagne la manche ; la suivante a un nouveau protégé et plus de zombies', () => {
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
  for (let t = 0; t < DUREE_MANCHE + 30 && sim.etat.phase === 'manche'; t += 0.1) {
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
  const nouveau = creerSimulation({ aleatoire: graine(7), apparitionBoss: DUREE_MANCHE });
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

test('un zombie coincé derrière la cabane la contourne et atteint le poteau', () => {
  const sim = lancer();
  const s = sim.etat;
  s.cumul = -1e9; // pas d'autres apparitions
  s.monstres = [{ id: 999, k: 0, x: CABANE.x - CABANE.profondeur / 2 - 1.5, z: CABANE.z, r: 0, pv: 30, v: 1, a: false, c: 1 }];
  avancer(sim, 40);
  const m = s.monstres[0];
  assert.ok(Math.hypot(m.x - s.poteau.x, m.z - s.poteau.z) < 2, `arrivé au poteau (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
});

test('de tous les côtés de l’île, un zombie traverse arbres, camp et tour de guet jusqu’au poteau', () => {
  for (let k = 0; k < 16; k++) {
    const sim = lancer();
    const s = sim.etat;
    s.cumul = -1e9;
    const a = (k / 16) * Math.PI * 2, r = rayonIle(a) * 1.1;
    s.monstres = [{ id: 999, k: 0, x: Math.cos(a) * r, z: Math.sin(a) * r, r: 0, pv: 30, v: 1, a: false, c: 1 }];
    avancer(sim, 60);
    const m = s.monstres[0];
    assert.ok(Math.hypot(m.x - s.poteau.x, m.z - s.poteau.z) < 2, `parti de l’angle ${a.toFixed(2)}, arrêté en (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
  }
});

test('chaque zombie tué rapporte au tireur, pas aux autres, selon son type', () => {
  const sim = lancer(['a', 'b']);
  sim.etat.monstres = [];
  const rodeur = seul(sim, 'rodeur', 30, 0);
  const colosse = seul(sim, 'colosse', -30, 0);
  const coureur = seul(sim, 'coureur', 0, 30);
  assert.ok(sim.toucher(rodeur.id, 100, 'a'));
  assert.equal(sim.etat.comptes.a.argent, TYPES_ZOMBIES[indiceType('rodeur')].recompense);
  assert.equal(sim.etat.comptes.b?.argent ?? 0, 0);
  while (!sim.toucher(colosse.id, 100, 'b'));
  assert.equal(sim.etat.comptes.b.argent, TYPES_ZOMBIES[indiceType('colosse')].recompense);
  assert.ok(sim.toucher(coureur.id, 100, 'intrus'), 'un inconnu tue, mais ne gagne rien');
  assert.equal(sim.etat.comptes.intrus, undefined);
});

test("on n'achète qu'au comptoir de l'armurerie, avec assez d'argent, et une seule fois", () => {
  const sim = lancer(['a', 'b']);
  const acheteur = sim.etat.protege === 'a' ? 'b' : 'a';
  const auComptoir = joueurs({ [acheteur]: { x: BOUTIQUE.x, z: BOUTIQUE.z, r: 0 } });
  const loin = joueurs({ [acheteur]: { x: 0, z: 0, r: 0 } });
  assert.ok(!sim.acheter(acheteur, 'uzi', auComptoir), 'pas assez d’argent');
  sim.etat.comptes[acheteur].argent = 1000;
  assert.ok(!sim.acheter(acheteur, 'uzi', loin), 'trop loin du comptoir');
  assert.ok(!sim.acheter(acheteur, 'pistolet', auComptoir), 'le pistolet ne s’achète pas');
  assert.ok(!sim.acheter(acheteur, 'bazooka', auComptoir), 'arme inconnue');
  assert.ok(sim.acheter(acheteur, 'uzi', auComptoir));
  const uzi = ARMES[indiceArme('uzi')];
  assert.equal(sim.etat.comptes[acheteur].argent, 1000 - uzi.prix);
  assert.equal(sim.etat.comptes[acheteur].armes, ARMES_DEPART | (1 << indiceArme('uzi')));
  assert.ok(!sim.acheter(acheteur, 'uzi', auComptoir), 'déjà achetée');
  assert.ok(!sim.acheter(sim.etat.protege, 'fusil', joueurs({ [sim.etat.protege]: { x: BOUTIQUE.x, z: BOUTIQUE.z, r: 0 } })), 'le protégé est ligoté');
});

test('une manche gagnée rapporte un bonus à tous ; une nouvelle partie remet les comptes à zéro', () => {
  const sim = lancer(['a', 'b']);
  sim.etat.comptes.a = { argent: 40, armes: 3 };
  for (let t = 0; t < DUREE_MANCHE + 30 && sim.etat.phase === 'manche'; t += 0.1) avancerDefendu(sim, 0.1);
  assert.equal(sim.etat.phase, 'pause');
  assert.equal(sim.etat.comptes.a.argent, 40 + BONUS_MANCHE);
  assert.equal(sim.etat.comptes.b.argent, BONUS_MANCHE);
  // Défaite, retour au camp : les économies restent jusqu'au prochain lancement.
  avancer(sim, DUREE_PAUSE + 0.5);
  while (sim.etat.phase === 'manche') sim.pas(0.2, joueurs());
  avancer(sim, DUREE_DEFAITE + 0.5);
  assert.equal(sim.etat.phase, 'attente');
  assert.equal(sim.etat.comptes.a.armes, 3);
  assert.ok(sim.demarrer());
  const neuf = { argent: 0, armes: ARMES_DEPART, niveaux: [0, 0, 0, 0] };
  assert.deepEqual(sim.etat.comptes, { a: neuf, b: neuf });
});

test("argent et armes survivent au départ de l'hôte", () => {
  const ancien = lancer(['a', 'b']);
  ancien.etat.comptes.a = { argent: 320, armes: 5 };
  const nouveau = creerSimulation();
  assert.ok(nouveau.charger(JSON.parse(JSON.stringify(ancien.instantane()))));
  assert.deepEqual(nouveau.etat.comptes.a, { argent: 320, armes: 5, niveaux: [0, 0, 0, 0] });
  const tordu = normaliserMonde({ ph: 'manche', jo: { x: [-5, 1], y: [10, 999, [3, 9, -1, 'a']], z: 'rien' } });
  assert.deepEqual(tordu.comptes, { y: { argent: 10, armes: 999 & 15, niveaux: [3, ETOILES.niveauMax, 0, 0] } });
});

test('les zombies résistent mieux et courent plus vite de manche en manche', () => {
  assert.equal(pvMonstre(1), 30);
  assert.ok(pvMonstre(4) > pvMonstre(2));
  assert.ok(vitesseMonstre(1) >= 2.3 && vitesseMonstre(10) <= 4);
  assert.ok(monstresParMinute(1, DUREE_MANCHE) > monstresParMinute(1, 0) * 2);
});

test("la grenade blesse moins au bord de l'explosion, pas du tout au-delà", () => {
  const lance = ARMES[indiceArme('lance')];
  assert.equal(degatsExplosion(lance, 0), lance.degats);
  assert.ok(degatsExplosion(lance, lance.rayon) < lance.degats * 0.5);
  assert.equal(degatsExplosion(lance, lance.rayon + 0.1), 0);
});

test('les types de zombies : le coureur file, le colosse encaisse, le bouffi explose', () => {
  const [rodeur, coureur, colosse, bouffi] = ['rodeur', 'coureur', 'colosse', 'bouffi'].map((id) => TYPES_ZOMBIES[indiceType(id)]);
  assert.ok(coureur.vitesse > rodeur.vitesse && coureur.pv < rodeur.pv);
  assert.ok(colosse.pv >= 5 && colosse.vitesse < rodeur.vitesse && colosse.degats > rodeur.degats);
  assert.ok(colosse.hauteur > 1.3 && colosse.largeur > 1.3);
  assert.ok(bouffi.explosif && !rodeur.explosif);
  // Plus il est dur à abattre, plus il rapporte.
  assert.ok(rodeur.recompense < coureur.recompense && coureur.recompense < bouffi.recompense && bouffi.recompense < colosse.recompense);
  // Le colosse se hisse sur la terre plus lentement mais frappe plus fort.
  const sim = lancer();
  sim.etat.monstres = [];
  const c = seul(sim, 'colosse', sim.etat.poteau.x + 1, sim.etat.poteau.z);
  const pv = sim.etat.pv;
  for (let i = 0; i < 10; i++) sim.pas(0.1, joueurs());
  assert.ok(c.a, 'au contact');
  assert.ok(Math.abs(pv - sim.etat.pv - 6 * colosse.degats) < 0.01, `${pv - sim.etat.pv} points perdus en une seconde`);
});

test('des coureurs dès le début, des colosses après la première minute, et plus de spéciaux ensuite', () => {
  const partDe = (manche, ecoule, k) => poidsTypes(manche, ecoule)[k] / poidsTypes(manche, ecoule).reduce((a, b) => a + b);
  assert.equal(partDe(1, 30, indiceType('colosse')), 0);
  assert.ok(partDe(1, 120, indiceType('colosse')) > 0);
  assert.ok(partDe(1, 0, indiceType('rodeur')) > 0.6, 'surtout des rôdeurs en manche 1');
  for (const k of [1, 2, 3]) assert.ok(partDe(4, 150, k) > partDe(1, 150, k));
  assert.equal(tirerType([1, 1, 0, 1], 0), 0);
  assert.equal(tirerType([1, 1, 0, 1], 0.4), 1);
  assert.equal(tirerType([1, 1, 0, 1], 0.9), 3);

  // Une manche entière défendue : les quatre types se montrent.
  const sim = lancer();
  const vus = new Set();
  let colossesMax = 0;
  for (let t = 0; t < DUREE_MANCHE - 1; t += 0.1) {
    sim.pas(0.1, joueurs());
    colossesMax = Math.max(colossesMax, sim.etat.monstres.filter((m) => m.k === indiceType('colosse')).length);
    for (const m of [...sim.etat.monstres]) {
      vus.add(m.k);
      // Les colosses ne sont pas abattus tout de suite : le plafond doit tenir.
      if (m.k !== indiceType('colosse') || t % 20 < 0.1) sim.toucher(m.id, 200);
    }
  }
  assert.deepEqual([...vus].sort(), [0, 1, 2, 3]);
  assert.ok(colossesMax <= TYPES_ZOMBIES[indiceType('colosse')].max);
});

test('un bouffi au contact du poteau explose : le protégé perd 25 points, les zombies voisins aussi', () => {
  const sim = lancer();
  const s = sim.etat;
  s.monstres = [];
  const b = seul(sim, 'bouffi', s.poteau.x + 3, s.poteau.z);
  const voisin = seul(sim, 'rodeur', s.poteau.x - 1.2, s.poteau.z, { v: 0 });
  let t = 0;
  while (s.monstres.includes(b) && t < 5) {
    sim.pas(0.05, joueurs());
    t += 0.05;
  }
  assert.ok(!s.monstres.includes(b), 'le bouffi a disparu');
  assert.equal(s.tues, 1, 'seul le rôdeur compte parmi les éliminés');
  assert.ok(PV_PROTEGE - s.pv >= EXPLOSION_BOUFFI.protege, `${PV_PROTEGE - s.pv} points perdus`);
  assert.ok(!s.monstres.includes(voisin), 'le rôdeur collé au poteau est emporté');
  const [ex] = sim.instantane().ex;
  assert.equal(ex.length, 3);
  assert.ok(Math.hypot(ex[1] - s.poteau.x, ex[2] - s.poteau.z) < 2);
  // L'explosion reste dans les instantanés un court moment, puis s'efface.
  avancer(sim, 2);
  assert.deepEqual(sim.instantane().ex, []);
});

test('abattre un bouffi fait exploser ses voisins, bouffis compris, et le tireur touche les primes', () => {
  const sim = lancer(['a', 'b']);
  const s = sim.etat;
  s.monstres = [];
  const [x, z] = [s.poteau.x + 25, s.poteau.z];
  const b1 = seul(sim, 'bouffi', x, z);
  const b2 = seul(sim, 'bouffi', x + 2, z);
  const r1 = seul(sim, 'rodeur', x + 4.5, z);
  const loin = seul(sim, 'rodeur', x + 12, z);
  const pv = s.pv;
  while (!sim.toucher(b1.id, 30, 'a'));
  assert.ok(!s.monstres.includes(b2), 'le second bouffi explose à son tour');
  assert.ok(!s.monstres.includes(r1), 'le rôdeur près du second bouffi y passe');
  assert.ok(s.monstres.includes(loin), 'trop loin pour être touché');
  assert.equal(s.pv, pv, 'loin du poteau, le protégé ne sent rien');
  assert.equal(s.tues, 3);
  const prime = (id) => TYPES_ZOMBIES[indiceType(id)].recompense;
  assert.equal(s.comptes.a.argent, 2 * prime('bouffi') + prime('rodeur'));
  assert.equal(sim.instantane().ex.length, 2);

  // Un bouffi abattu trop près du poteau blesse quand même le protégé.
  const proche = seul(sim, 'bouffi', s.poteau.x + 2, s.poteau.z);
  while (!sim.toucher(proche.id, 30, 'a'));
  assert.ok(s.pv < pv && s.pv > pv - EXPLOSION_BOUFFI.protege);
});

test('les instantanés transmettent types et explosions, bornés et vérifiés', () => {
  const sim = lancer();
  sim.etat.monstres = [];
  seul(sim, 'colosse', 20, 0);
  const b = seul(sim, 'bouffi', -20, 0);
  sim.toucher(b.id, 100);
  const inst = JSON.parse(JSON.stringify(sim.instantane()));
  const n = normaliserMonde(inst);
  assert.deepEqual(n.monstres.map((m) => m.k), [indiceType('colosse')]);
  assert.equal(n.explosions.length, 1);
  const repris = creerSimulation();
  assert.ok(repris.charger(inst));
  assert.deepEqual(repris.instantane(), sim.instantane());
  const bizarre = normaliserMonde({ ph: 'manche', m: [[1, 0, 0, 0, 0, 30, 1, 99], [2, 0, 0, 0, 0, 30, 1, 1.5]], ex: [[1, 2], ['a', 1, 1], [3, 1, 1], 'x'] });
  assert.deepEqual(bizarre.monstres.map((m) => m.k), [0, 0]);
  assert.deepEqual(bizarre.explosions, [{ id: 3, x: 1, z: 1 }]);
});

test('un colosse est plus facile à toucher, et sa tête est plus haute', () => {
  const colosse = TYPES_ZOMBIES[indiceType('colosse')];
  const cibles = [{ id: 1, x: 0.5, y: 0, z: -10, l: colosse.largeur, h: colosse.hauteur }];
  assert.ok(premierTouche([0, 1.2, 0], [0, 0, -1], cibles), 'touché à 0,5 m du centre');
  assert.equal(premierTouche([0, 1.2, 0], [0, 0, -1], [{ ...cibles[0], l: 1, h: 1 }]), null, 'un rôdeur au même endroit est manqué');
  assert.ok(!premierTouche([0, HAUTEUR_TETE + 0.1, 0], [0, 0, -1], cibles).tete, 'à hauteur de tête de rôdeur : le torse');
  assert.ok(premierTouche([0, HAUTEUR_TETE * colosse.hauteur + 0.1, 0], [0, 0, -1], cibles).tete);
});

// Jusqu'à la fin du chrono, en abattant chaque zombie ordinaire dès son arrivée.
function jusquAuBoss(sim) {
  while (!sim.etat.boss && sim.etat.phase === 'manche') {
    sim.pas(0.1, joueurs());
    for (const m of [...sim.etat.monstres]) if (m.id !== sim.etat.boss?.id) sim.toucher(m.id, 200);
  }
  return sim.etat.monstres.find((m) => m.id === sim.etat.boss.id);
}

test('à la fin du chrono, le boss sort de la mer : la manche continue tant qu’il vit', () => {
  const sim = lancer(['a', 'b', 'c'], {});
  const s = sim.etat;
  const boss = jusquAuBoss(sim);
  assert.equal(s.reste, 0);
  assert.equal(boss.k, indiceType('boss'));
  // Deux défenseurs (le protégé ne compte pas).
  assert.equal(boss.pv, pvBoss(1, 2));
  assert.equal(s.boss.pvMax, boss.pv);
  assert.ok(Math.hypot(boss.x - s.poteau.x, boss.z - s.poteau.z) > 20, 'il arrive de loin');
  // Les zombies ordinaires continuent d'arriver, moins vite ; la manche attend.
  const avant = s.prochainId;
  for (let t = 0; t < 20; t += 0.1) {
    sim.pas(0.1, joueurs());
    for (const m of [...s.monstres]) if (m.id !== boss.id) sim.toucher(m.id, 200);
  }
  assert.equal(s.phase, 'manche');
  assert.ok(s.prochainId > avant, 'la horde ne s’arrête pas');
  // L'abattre gagne la manche et paie le tueur.
  const tueur = ['a', 'b', 'c'].find((id) => id !== s.protege);
  while (!sim.toucher(boss.id, 150, tueur));
  sim.pas(0.1, joueurs());
  assert.equal(s.phase, 'pause');
  assert.equal(s.boss, null);
  assert.equal(s.manche, 2);
  assert.equal(s.comptes[tueur].argent, TYPES_ZOMBIES[indiceType('boss')].recompense + BONUS_MANCHE);
});

test('le boss appelle des coureurs en renfort, puis enrage à mi-vie', () => {
  const sim = lancer();
  const s = sim.etat;
  const boss = jusquAuBoss(sim);
  const nombre = () => s.monstres.filter((m) => m.k === indiceType('coureur')).length;
  s.cumul = -1e9;
  for (const m of [...s.monstres]) if (m.id !== boss.id) sim.toucher(m.id, 200);
  for (let t = 0; t < BOSS.premiereInvocation + 0.2; t += 0.1) sim.pas(0.1, joueurs());
  assert.equal(s.boss.cris, 1);
  assert.equal(nombre(), renfortsBoss(1));
  const proches = s.monstres.filter((m) => m.id !== boss.id).every((m) => Math.hypot(m.x - boss.x, m.z - boss.z) < 5);
  assert.ok(proches, 'les renforts surgissent autour de lui');
  assert.ok(renfortsBoss(5) > renfortsBoss(1));

  const vitesse = boss.v;
  assert.ok(!s.boss.enrage);
  while (boss.pv > s.boss.pvMax * BOSS.enrage) sim.toucher(boss.id, 100);
  assert.ok(s.boss.enrage);
  assert.ok(Math.abs(boss.v - vitesse * BOSS.vitesseEnrage) < 1e-9);
});

test('le boss résiste davantage à chaque manche et face à plus de défenseurs', () => {
  assert.equal(pvBoss(1, 1), BOSS.pv);
  assert.equal(pvBoss(1, 0), BOSS.pv, 'seul en protégé : comme un défenseur');
  assert.ok(pvBoss(3, 1) > pvBoss(1, 1));
  assert.ok(pvBoss(1, 3) > pvBoss(1, 2));
  const boss = TYPES_ZOMBIES[indiceType('boss')];
  assert.ok(boss.boss && boss.largeur >= 3 && boss.hauteur >= 3);
  assert.ok(poidsTypes(9, 200).length < TYPES_ZOMBIES.length, 'le boss n’est jamais tiré au sort');
});

test('au contact du poteau, le boss tue vite : une défaite reste possible', () => {
  const sim = lancer();
  const s = sim.etat;
  const boss = jusquAuBoss(sim);
  s.cumul = -1e9;
  s.boss.invocation = 1e9;
  Object.assign(boss, { x: s.poteau.x + 1.5, z: s.poteau.z });
  let t = 0;
  while (s.phase === 'manche' && t < 30) {
    sim.pas(0.1, joueurs());
    t += 0.1;
  }
  assert.equal(s.phase, 'defaite');
  assert.ok(t < 6, `le protégé tient ${t.toFixed(1)} s`);
});

test('un nouvel hôte reprend le combat contre le boss', () => {
  const sim = lancer();
  const boss = jusquAuBoss(sim);
  while (!sim.etat.boss.enrage) sim.toucher(boss.id, 100);
  sim.etat.boss.cris = 2;
  const inst = JSON.parse(JSON.stringify(sim.instantane()));
  assert.deepEqual(inst.bo, [boss.id, sim.etat.boss.pvMax, 2]);
  const repris = creerSimulation();
  assert.ok(repris.charger(inst));
  assert.deepEqual(repris.instantane(), sim.instantane());
  assert.ok(repris.etat.boss.enrage, 'déjà enragé, il ne le redevient pas');
  assert.equal(normaliserMonde({ ph: 'manche', bo: [1, -5, 0] }).boss, null);
  assert.equal(normaliserMonde({ ph: 'manche', bo: 'x' }).boss, null);
  assert.equal(normaliserMonde({ ph: 'manche' }).boss, null);
});

test('le boss peut arriver plus tôt : sa chute gagne la manche sans attendre le chrono', () => {
  const sim = creerSimulation({ aleatoire: graine(3), apparitionBoss: 60, dureePreparation: 0 });
  sim.definirMembres(membres('a'));
  assert.ok(sim.demarrer());
  const s = sim.etat;
  for (let t = 0; t < 59; t += 0.1) avancerDefendu(sim, 0.1);
  assert.equal(s.boss, null, 'pas avant la première minute');
  const boss = jusquAuBoss(sim);
  assert.ok(Math.abs(s.reste - (DUREE_MANCHE - 60)) < 0.2, `chrono à ${s.reste.toFixed(1)} s`);
  while (!sim.toucher(boss.id, 150, 'a'));
  sim.pas(0.1, joueurs());
  assert.equal(s.phase, 'pause');
  assert.equal(s.manche, 2);
});

// --- Attaques contre les joueurs ------------------------------------------

// Une manche sans apparitions, avec un défenseur d et un zombie posé à côté.
function duel(type = 'rodeur', ids = ['a', 'b', 'c']) {
  const sim = lancer(ids);
  const s = sim.etat;
  s.monstres = [];
  s.cumul = -1e9;
  const [d, allie] = ids.filter((id) => id !== s.protege);
  // Loin du poteau, pour que le zombie préfère le joueur.
  const j = joueurs({ [d]: { x: -20, z: 20, r: 0, ar: 0 }, ...(allie ? { [allie]: { x: 20, z: -20, r: 0, ar: 0 } } : {}) });
  const m = seul(sim, type, -21, 20);
  return { sim, s, d, allie, j, m };
}

function pendant(sim, secondes, j) {
  for (let t = 0; t < secondes - 1e-9; t += 0.1) sim.pas(0.1, j);
}

test('un zombie proche se jette sur le défenseur : deux coups et il est à terre', () => {
  const { sim, s, d, j, m } = duel();
  pendant(sim, 0.3, j);
  assert.equal(m.a, true, 'au contact du joueur');
  assert.equal(s.pv, PV_PROTEGE, 'le protégé ne perd rien');
  pendant(sim, 0.3, j);
  assert.equal(s.vies[d].coups, 1);
  pendant(sim, JOUEUR.cadence * 0.5, j);
  assert.equal(s.vies[d].coups, 1, 'pas deux coups coup sur coup');
  pendant(sim, JOUEUR.cadence, j);
  assert.equal(s.vies[d].terre, true);
  assert.deepEqual(sim.instantane().vi[d].slice(0, 2), [2, 1]);
  // À terre, on n'intéresse plus les zombies : celui-ci repart vers le poteau.
  const avant = Math.hypot(m.x - s.poteau.x, m.z - s.poteau.z);
  pendant(sim, 2, j);
  assert.ok(Math.hypot(m.x - s.poteau.x, m.z - s.poteau.z) < avant - 2);
  assert.ok(!sim.demanderPorter(d, joueurs({ [d]: { x: s.poteau.x, z: s.poteau.z, r: 0 } })), 'à terre, on ne porte rien');
});

test('un coup s’efface avec le temps ; le boss met à terre d’un seul coup', () => {
  const { sim, s, d, j, m } = duel();
  pendant(sim, 0.7, j);
  assert.equal(s.vies[d].coups, 1);
  s.monstres = [];
  pendant(sim, JOUEUR.soin + 0.2, j);
  assert.equal(s.vies[d].coups, 0);
  assert.ok(m);

  const autre = duel('boss');
  autre.m.pv = 5000;
  pendant(autre.sim, 1, autre.j);
  assert.equal(autre.s.vies[autre.d].terre, true);
});

test('un allié relève en restant près, E maintenu ; seul, on se relève tout seul', () => {
  const { sim, s, d, allie, j } = duel();
  pendant(sim, 2, j);
  assert.equal(s.vies[d].terre, true);
  s.monstres = [];
  // Trop loin : la demande est enregistrée mais n'avance pas.
  assert.ok(sim.demanderRelever(allie, d));
  pendant(sim, 1, j);
  assert.equal(s.vies[d].releve, 0);
  j.set(allie, { x: -19, z: 20.5, r: 0 });
  pendant(sim, JOUEUR.dureeReleve * 0.5, j);
  assert.ok(s.vies[d].releve > 0.4 && s.vies[d].terre);
  // Il lâche E : la relève retombe.
  sim.demanderRelever(allie, null);
  pendant(sim, 0.5, j);
  assert.ok(s.vies[d].releve < 0.4);
  sim.demanderRelever(allie, d);
  pendant(sim, JOUEUR.dureeReleve + 0.2, j);
  assert.equal(s.vies[d].terre, false);
  assert.equal(s.vies[d].coups, 0);
  assert.ok(!sim.demanderRelever(allie, d), 'debout : plus rien à relever');
  assert.ok(!sim.demanderRelever(s.protege, d), 'le protégé est ligoté');

  // Seul défenseur (l'autre joueur est le protégé) : relève automatique.
  const solo = duel('rodeur', ['a', 'b']);
  pendant(solo.sim, 2, solo.j);
  assert.equal(solo.s.vies[solo.d].terre, true);
  solo.s.monstres = [];
  pendant(solo.sim, JOUEUR.releveSeul - 1, solo.j);
  assert.equal(solo.s.vies[solo.d].terre, true);
  pendant(solo.sim, 1.2, solo.j);
  assert.equal(solo.s.vies[solo.d].terre, false);
});

test('un bouffi qui éclate près d’un défenseur lui donne un coup', () => {
  const { sim, s, d, j } = duel();
  s.monstres = [];
  pendant(sim, 0.1, j);
  const b = seul(sim, 'bouffi', -19, 20);
  sim.toucher(b.id, 999);
  assert.equal(s.vies[d].coups, 1);
});

test('fin de manche ou défaite : tout le monde est relevé', () => {
  const { sim, s, d, j } = duel();
  pendant(sim, 2, j);
  assert.equal(s.vies[d].terre, true);
  s.monstres = [];
  s.reste = 0.05;
  pendant(sim, 0.2, j);
  const boss = s.monstres.find((m) => m.id === s.boss.id);
  Object.assign(boss, { x: 40, z: 40 });
  while (!sim.toucher(boss.id, 150));
  sim.pas(0.1, j);
  assert.equal(s.phase, 'pause');
  assert.deepEqual(s.vies, {});
});

// --- Étoiles d'amélioration ------------------------------------------------

test('une étoile améliore l’arme : dégâts, chargeur et rechargement', () => {
  const fusil = ARMES[indiceArme('fusil')];
  assert.equal(armeAmelioree(fusil, 0), fusil);
  const n3 = armeAmelioree(fusil, 3);
  assert.ok(Math.abs(n3.degats - fusil.degats * 1.75) < 1e-9);
  assert.equal(n3.chargeur, Math.round(fusil.chargeur * 1.6));
  assert.ok(n3.rechargement < fusil.rechargement * 0.7);
  assert.equal(armeAmelioree(fusil, 9).niveau, ETOILES.niveauMax);
});

test('les zombies lâchent parfois une étoile ; on la ramasse en marchant dessus', () => {
  const { sim, s, d, j } = duel();
  s.monstres = [];
  // Assez de rôdeurs abattus : au moins une étoile tombe.
  for (let i = 0; i < 200 && !s.etoiles.length; i++) sim.toucher(seul(sim, 'rodeur', 5, 5).id, 999);
  assert.ok(s.etoiles.length > 0);
  const [e] = s.etoiles;
  assert.ok(Math.hypot(e.x - 5, e.z - 5) < 1);
  pendant(sim, 0.3, j);
  assert.equal(s.etoiles.length, 1, 'personne dessus');
  j.set(d, { x: e.x + 0.5, z: e.z, r: 0, ar: 0 });
  pendant(sim, 0.1, j);
  assert.equal(s.etoiles.length, 0);
  assert.deepEqual(s.comptes[d].niveaux, [1, 0, 0, 0]);
  assert.deepEqual(sim.instantane().jo[d][2], [1, 0, 0, 0]);
});

test('arme déjà au plus haut : l’étoile va à une autre arme, sinon elle rapporte une prime', () => {
  const { sim, s, d, j } = duel();
  s.monstres = [];
  s.comptes[d] = { argent: 0, armes: 0b11, niveaux: [ETOILES.niveauMax, 0, 0, 0] };
  const deposer = () => s.etoiles.push({ id: s.prochaineEtoile++, x: -20, z: 20, age: 0 });
  deposer();
  pendant(sim, 0.1, j);
  assert.deepEqual(s.comptes[d].niveaux, [3, 1, 0, 0], 'l’Uzi en profite');
  s.comptes[d].niveaux = [3, 3, 0, 0];
  deposer();
  pendant(sim, 0.1, j);
  assert.equal(s.comptes[d].argent, ETOILES.prime, 'fusil et lance-grenades pas achetés : prime');
});

test('une étoile dans l’eau glisse jusqu’à la terre ; elle s’éteint au bout de 30 s', () => {
  const sim = lancer();
  const s = sim.etat;
  s.monstres = [];
  s.cumul = -1e9;
  const boss = seul(sim, 'boss', 60, 0);
  sim.toucher(boss.id, 999999);
  assert.equal(s.etoiles.length, ETOILES.boss, 'le boss en lâche trois');
  for (const e of s.etoiles) assert.ok(estPraticable(e.x, e.z), `étoile en (${e.x.toFixed(1)}, ${e.z.toFixed(1)})`);
  pendant(sim, ETOILES.duree + 0.2, joueurs());
  assert.equal(s.etoiles.length, 0);
});

// --- Lanterne ----------------------------------------------------------------

test('la lanterne s’améliore à l’armurerie, pour toute l’équipe, trois fois au plus', () => {
  const sim = lancer(['a', 'b']);
  const s = sim.etat;
  const d = s.protege === 'a' ? 'b' : 'a';
  const auComptoir = joueurs({ [d]: { x: BOUTIQUE.x, z: BOUTIQUE.z, r: 0 }, [s.protege]: { x: BOUTIQUE.x, z: BOUTIQUE.z, r: 0 } });
  assert.ok(!sim.ameliorerLanterne(d, auComptoir), 'pas d’argent');
  s.comptes[d] = { argent: 5000, armes: 1, niveaux: [0, 0, 0, 0] };
  assert.ok(!sim.ameliorerLanterne(d, joueurs({ [d]: { x: 0, z: 0, r: 0 } })), 'loin du comptoir');
  s.comptes[s.protege] = { argent: 5000, armes: 1, niveaux: [0, 0, 0, 0] };
  assert.ok(!sim.ameliorerLanterne(s.protege, auComptoir), 'le protégé est ligoté');
  for (let n = 0; n < NIVEAU_LANTERNE_MAX; n++) assert.ok(sim.ameliorerLanterne(d, auComptoir));
  assert.ok(!sim.ameliorerLanterne(d, auComptoir), 'déjà au plus haut');
  assert.equal(s.comptes[d].argent, 5000 - LANTERNE.prix.reduce((a, b) => a + b));
  assert.equal(sim.instantane().la, NIVEAU_LANTERNE_MAX);
  assert.ok(LANTERNE.brouillard.every((v, i, t) => i === 0 || v > t[i - 1]), 'chaque niveau fait voir plus loin');
});

test('lanterne, étoiles et blessures passent d’un hôte à l’autre, vérifiées', () => {
  const { sim, s, d, j } = duel();
  pendant(sim, 0.7, j);
  s.lanterne = 2;
  s.etoiles.push({ id: 4, x: 1, z: 2, age: 3 });
  const inst = JSON.parse(JSON.stringify(sim.instantane()));
  const repris = creerSimulation();
  assert.ok(repris.charger(inst));
  assert.deepEqual(repris.instantane(), sim.instantane());
  assert.equal(repris.etat.vies[d].coups, 1);
  const n = normaliserMonde({ ph: 'manche', la: 42, et: [[1, 0, 0, -3], ['x', 1, 1]], vi: { a: [9, 1, 7], b: 'rien' } });
  assert.equal(n.lanterne, NIVEAU_LANTERNE_MAX);
  assert.deepEqual(n.etoiles, [{ id: 1, x: 0, z: 0, age: 0 }]);
  assert.deepEqual(n.vies, { a: { coups: JOUEUR.coups, terre: true, releve: 1 } });
});

// --- Préparation et cartes -------------------------------------------------

test('chaque manche commence par une préparation sans zombie, sur la carte de la manche', () => {
  const sim = creerSimulation({ aleatoire: graine(5), apparitionBoss: DUREE_MANCHE });
  sim.definirMembres(membres('a', 'b'));
  assert.ok(sim.demarrer());
  const s = sim.etat;
  assert.equal(s.phase, 'preparation');
  assert.equal(s.reste, DUREE_PREPARATION);
  assert.equal(s.carte, 0);
  assert.ok(s.protege, 'le protégé est déjà désigné : on place son poteau');
  // On porte le poteau pendant la préparation.
  const d = s.protege === 'a' ? 'b' : 'a';
  assert.ok(sim.demanderPorter(d, joueurs({ [d]: { x: s.poteau.x + 1, z: s.poteau.z, r: 0 } })));
  const j = joueurs({ [d]: { x: 0, z: 0, r: 0 } });
  for (let t = 0; t < DUREE_PREPARATION - 1; t += 0.1) sim.pas(0.1, j);
  assert.equal(s.phase, 'preparation');
  assert.equal(s.monstres.length, 0, 'aucun zombie pendant la préparation');
  assert.ok(Math.hypot(s.poteau.x, s.poteau.z) < 2, 'le poteau a suivi son porteur');
  for (let t = 0; t < 1.5; t += 0.1) sim.pas(0.1, j);
  assert.equal(s.phase, 'manche');
  assert.ok(!sim.pret(d), 'on ne se dit prêt que pendant la préparation');
});

test('tout le monde prêt : la manche commence sans attendre', () => {
  const sim = creerSimulation({ aleatoire: graine(5) });
  sim.definirMembres(membres('a', 'b'));
  sim.demarrer();
  assert.ok(sim.pret('a'));
  assert.ok(!sim.pret('intrus'));
  sim.pas(0.1, joueurs());
  assert.equal(sim.etat.phase, 'preparation', 'un seul des deux');
  assert.deepEqual(sim.instantane().rd, ['a']);
  sim.pret('b');
  sim.pas(0.1, joueurs());
  assert.equal(sim.etat.phase, 'manche');
});

test('la manche 2 se joue dans la cour du château : poteau à son départ, zombies venus du champ', () => {
  const sim = lancer(['a', 'b']);
  const s = sim.etat;
  avancerDefendu(sim, 1);
  s.reste = 0.05;
  while (s.phase === 'manche') avancerDefendu(sim, 0.1);
  avancer(sim, DUREE_PAUSE + 0.2);
  assert.equal(s.phase, 'manche');
  assert.equal(s.manche, 2);
  assert.equal(CARTES[s.carte].id, 'chateau');
  assert.deepEqual({ x: s.poteau.x, z: s.poteau.z }, CARTES[1].poteau);
  assert.equal(sim.instantane().ca, 1);
  avancer(sim, 3);
  assert.ok(s.monstres.length > 0);
  for (const m of s.monstres) assert.ok(Math.max(Math.abs(m.x), Math.abs(m.z)) > 22, 'sortis dans le champ, hors des murailles');
  const repris = creerSimulation();
  assert.ok(repris.charger(JSON.parse(JSON.stringify(sim.instantane()))));
  assert.equal(repris.etat.carte, 1);
});

// Une manche dans la cour du château, sans apparitions.
function auChateau(ids = ['a', 'b', 'c']) {
  const sim = lancer(ids);
  const s = sim.etat;
  s.carte = 1;
  s.monstres = [];
  s.cumul = -1e9;
  return { sim, s };
}

test('au château, un zombie du champ passe une porte et monte la rampe jusqu’au poteau sur la terrasse', () => {
  const { sim, s } = auChateau();
  Object.assign(s.poteau, { x: 0, z: 0 });
  const m = seul(sim, 'rodeur', -2, -30);
  let t = 0;
  while (s.pv === PV_PROTEGE && t < 90) {
    sim.pas(0.1, joueurs());
    t += 0.1;
  }
  assert.ok(s.pv < PV_PROTEGE, `le protégé est atteint (zombie en ${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
  assert.equal(CARTES[1].hauteurSol(m.x, m.z), 4, 'sur la terrasse');
});

test('au pied de la terrasse, un zombie n’atteint pas le poteau posé en haut', () => {
  const { sim, s } = auChateau();
  Object.assign(s.poteau, { x: 3.6, z: 0 });
  const m = seul(sim, 'rodeur', 5.4, 0, { v: 0 });
  for (let i = 0; i < 20; i++) sim.pas(0.1, joueurs());
  assert.equal(s.pv, PV_PROTEGE);
  assert.equal(m.a, false);
});

test('sur le chemin de ronde, on est hors d’atteinte d’en bas ; il faut monter par l’escalier', () => {
  const { sim, s } = auChateau();
  const [d] = ['a', 'b', 'c'].filter((id) => id !== s.protege);
  const j = joueurs({ [d]: { x: 19.3, z: -8, r: 0 } });
  const m = seul(sim, 'rodeur', 16.9, -8);
  for (let i = 0; i < 30; i++) sim.pas(0.1, j);
  assert.equal(s.vies[d]?.coups ?? 0, 0, 'le zombie en bas ne touche pas');
  assert.ok(m);
});

test('le poteau porté ne dégringole pas du bord d’une rampe', () => {
  const { sim, s } = auChateau();
  const [d] = ['a', 'b', 'c'].filter((id) => id !== s.protege);
  const C = CARTES[1];
  // Porteur au milieu de la rampe de la terrasse, le poteau le suit.
  Object.assign(s.poteau, { x: 0.4, z: 9 });
  assert.ok(sim.demanderPorter(d, joueurs({ [d]: { x: 0, z: 9.5, r: Math.PI } })));
  sim.pas(0.1, joueurs({ [d]: { x: 0, z: 8.5, r: Math.PI } }));
  const surRampe = { x: s.poteau.x, z: s.poteau.z };
  assert.ok(C.hauteurSol(surRampe.x, surRampe.z) > 0.5);
  // Collé au bord : le poteau tomberait dans la cour, il reste où il est.
  sim.pas(0.1, joueurs({ [d]: { x: -1.3, z: 8, r: -Math.PI / 2 } }));
  assert.deepEqual({ x: s.poteau.x, z: s.poteau.z }, surRampe);
  // D'en bas, on ne saisit pas le poteau posé sur la terrasse.
  sim.poser(d);
  Object.assign(s.poteau, { x: 3.5, z: 0 });
  assert.ok(!sim.demanderPorter(d, joueurs({ [d]: { x: 5.2, z: 0, r: 0 } })));
});

test('réglages d’essai : manche courte, boss fragile, argent au départ', () => {
  const sim = creerSimulation({ aleatoire: graine(9), dureeManche: 120, facteurPvBoss: 0.1, argentDepart: 10000, dureePreparation: 0 });
  sim.definirMembres(membres('a'));
  sim.demarrer();
  const s = sim.etat;
  assert.equal(s.reste, 120);
  assert.equal(s.comptes.a.argent, 10000, 'dans la poche dès le départ');
  assert.deepEqual(sim.instantane().jo.a, [10000, ARMES_DEPART, [0, 0, 0, 0]]);
  sim.definirMembres(membres('a', 'b'));
  assert.equal(s.comptes.b.argent, 10000, 'arrivé en cours de partie');
  for (let t = 0; t < 119.9; t += 0.1) avancerDefendu(sim, 0.1);
  assert.equal(s.boss, null, 'pas avant la fin des deux minutes');
  const boss = jusquAuBoss(sim);
  assert.equal(boss.pv, Math.round(pvBoss(1, 2) * 0.1), 'deux défenseurs, un dixième des points de vie');
  // La cadence monte jusqu'au bout de la manche courte.
  assert.ok(monstresParMinute(1, 120, 120) > monstresParMinute(1, 0, 120) * 2);
});
