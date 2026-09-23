import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerSimulation, normaliserMonde } from '../src/simulation.js';
import {
  ARMES, ARMES_DEPART, BONUS_MANCHE, DISTANCE_PORTER, DUREE_DEFAITE, DUREE_ILLUMINATION, DUREE_MANCHE, DUREE_PAUSE,
  EXPLOSION_BOUFFI, HAUTEUR_TETE, PV_MONSTRE, PV_PROTEGE, POTEAU_DEPART, RECHARGE_ILLUMINATION, TYPES_ZOMBIES,
  degatsExplosion, indiceArme, indiceType, monstresParMinute, poidsTypes, positionPortee, premierTouche, pvMonstre,
  tirerProtege, tirerType, vitesseMonstre,
} from '../src/regles.js';
import { BOUTIQUE, CABANE, estPraticable, resoudreCollisions } from '../src/monde.js';

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

test('un zombie coincé derrière la cabane la contourne et atteint le poteau', () => {
  const sim = lancer();
  const s = sim.etat;
  s.cumul = -1e9; // pas d'autres apparitions
  s.monstres = [{ id: 999, k: 0, x: CABANE.x - CABANE.profondeur / 2 - 1.5, z: CABANE.z, r: 0, pv: 30, v: 1, a: false, c: 1 }];
  avancer(sim, 40);
  const m = s.monstres[0];
  assert.ok(Math.hypot(m.x - s.poteau.x, m.z - s.poteau.z) < 2, `arrivé au poteau (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
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
  avancerDefendu(sim, DUREE_MANCHE + 0.5);
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
  assert.deepEqual(sim.etat.comptes, {});
});

test("argent et armes survivent au départ de l'hôte", () => {
  const ancien = lancer(['a', 'b']);
  ancien.etat.comptes.a = { argent: 320, armes: 5 };
  const nouveau = creerSimulation();
  assert.ok(nouveau.charger(JSON.parse(JSON.stringify(ancien.instantane()))));
  assert.deepEqual(nouveau.etat.comptes.a, { argent: 320, armes: 5 });
  const tordu = normaliserMonde({ ph: 'manche', jo: { x: [-5, 1], y: [10, 999], z: 'rien' } });
  assert.deepEqual(tordu.comptes, { y: { argent: 10, armes: 999 & 15 } });
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
