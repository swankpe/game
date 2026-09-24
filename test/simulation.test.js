import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES_ECLAIREES, creerSimulation, normaliserMonde } from '../src/simulation.js';
import {
  ARMES, ARMES_DEPART, BONUS_BOSS, BOSS, CYCLE, DISTANCE_PORTER, DUREE_DEFAITE, DUREE_VICTOIRE, ESSAI, ETOILES,
  EXPLOSION_BOUFFI, HAUTEUR_TETE, JOUEUR, LANTERNE, NIVEAU_LANTERNE_MAX, PV_MONSTRE, PV_PROTEGE, POTEAU_DEPART,
  TYPES_ZOMBIES, VIVRES, armeAmelioree, danger, degatsExplosion, indiceArme, indiceType, indiceVivre, monstresParMinute,
  poidsTypes, positionPortee, premierTouche, pvBoss, pvMonstre, renfortsBoss, tirerType, visionNocturne, vitesseMonstre,
} from '../src/regles.js';
import { BOUTIQUE, CABANE, CARTES, carteDEtape, estPraticable, rayonIle, resoudreCollisions } from '../src/monde.js';
import { dansObstacle } from '../src/carte-ouverte.js';

const graine = (n) => () => {
  n = (n * 16807) % 2147483647;
  return n / 2147483647;
};
const membres = (...ids) => ids.map((id) => ({ id }));
const joueurs = (entrees = {}) => new Map(Object.entries(entrees));
const VIDE = { argent: 0, armes: ARMES_DEPART, niveaux: [0, 0, 0, 0], vivres: [0, 0] };

// Une partie lancée : on arrive sur l'île par une accalmie.
function lancer(ids = ['a', 'b', 'c'], options = {}) {
  const sim = creerSimulation({ aleatoire: graine(42), ...options });
  sim.definirMembres(membres(...ids));
  assert.ok(sim.demarrer());
  return sim;
}

// Une partie lancée, l'accalmie écourtée : le premier assaut commence.
function assaut(ids, options) {
  const sim = lancer(ids, options);
  sim.etat.reste = 0;
  sim.pas(0.01, joueurs());
  assert.equal(sim.etat.phase, 'assaut');
  return sim;
}

function avancer(sim, secondes, j = joueurs(), pas = 0.1) {
  for (let t = 0; t < secondes - 1e-9; t += pas) sim.pas(pas, j);
}

// Un zombie posé à la main, sans autres apparitions.
function seul(sim, type, x, z, extra = {}) {
  const s = sim.etat;
  const k = indiceType(type);
  s.cumul = -1e9;
  const m = { id: 900 + s.monstres.length, k, x, z, r: 0, pv: Math.round(pvMonstre(danger(s.etape, s.cycle)) * TYPES_ZOMBIES[k].pv), v: 1, a: false, c: 1, ...extra };
  s.monstres.push(m);
  return m;
}

// Défenseurs parfaits : chaque zombie ordinaire tombe dès son arrivée.
function defendre(sim, secondes, j = joueurs()) {
  for (let t = 0; t < secondes - 1e-9; t += 0.1) {
    sim.pas(0.1, j);
    for (const m of [...sim.etat.monstres]) if (m.id !== sim.etat.boss?.id) sim.toucher(m.id, 999);
  }
}

// Le protégé posé sur l'autel de la carte : rituel, puis le boss.
function appelerBoss(sim, j = joueurs()) {
  const s = sim.etat;
  const { autel } = CARTES[s.carte];
  Object.assign(s.poteau, { x: autel.x, z: autel.z, porteur: null });
  sim.pas(0.1, j);
  assert.equal(s.phase, 'rituel');
  avancer(sim, BOSS.rituel + 0.2, j);
  assert.equal(s.phase, 'boss');
  return s.monstres.find((m) => m.id === s.boss.id);
}

// Boss abattu, victoire passée : on arrive sur la carte suivante.
function franchirLaCarte(sim, tueur = null) {
  const boss = appelerBoss(sim);
  while (!sim.toucher(boss.id, 300, tueur));
  sim.pas(0.1, joueurs());
  assert.equal(sim.etat.phase, 'victoire');
  avancer(sim, DUREE_VICTOIRE + 0.2);
}

test('le poteau de départ est sur la terre ferme, hors des obstacles', () => {
  assert.ok(estPraticable(POTEAU_DEPART.x, POTEAU_DEPART.z));
  assert.deepEqual(resoudreCollisions(POTEAU_DEPART.x, POTEAU_DEPART.z), POTEAU_DEPART);
});

test('on arrive par une accalmie : la carte est éclairée, aucun zombie, puis l’assaut commence', () => {
  const sim = lancer();
  const s = sim.etat;
  assert.equal(s.phase, 'accalmie');
  assert.equal(s.reste, CYCLE.accalmie);
  assert.equal(s.carte, 0);
  assert.equal(s.cycle, 0);
  assert.equal(s.pv, PV_PROTEGE);
  assert.ok(!sim.demarrer(), 'on ne relance pas une partie en cours');
  assert.ok(PHASES_ECLAIREES.includes('accalmie') && !PHASES_ECLAIREES.includes('assaut') && !PHASES_ECLAIREES.includes('boss'));
  avancer(sim, CYCLE.accalmie - 0.5);
  assert.equal(s.phase, 'accalmie');
  assert.equal(s.monstres.length, 0);
  avancer(sim, 1);
  assert.equal(s.phase, 'assaut');
  assert.equal(s.cycle, 1);
  assert.ok(Math.abs(s.reste - CYCLE.assaut) < 1);
});

test("les zombies sortent de l'eau en continu, marchent vers le poteau et blessent le protégé", () => {
  const sim = assaut();
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
  assert.ok(!estPraticable(premier.x, premier.z) || depart > 20, 'dans l’eau');
  avancer(sim, 6);
  const apres = s.monstres.find((m) => m.id === premier.id);
  assert.ok(Math.hypot(apres.x - s.poteau.x, apres.z - s.poteau.z) < depart - 8, 'il se rapproche');
  avancer(sim, 20);
  assert.ok(s.pv < PV_PROTEGE, 'le protégé perd de la vie au contact');
});

test('trois balles tuent un rôdeur, deux suffisent dans la tête', () => {
  const sim = assaut();
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
  const sim = assaut();
  let t = 0;
  while (sim.etat.phase === 'assaut' && t < CYCLE.assaut + 1) {
    sim.pas(0.1, joueurs());
    t += 0.1;
  }
  assert.equal(sim.etat.phase, 'defaite');
  assert.equal(sim.etat.cause, 'protege');
  assert.equal(sim.etat.pv, 0);
  assert.equal(sim.instantane().ce, 'protege');
  avancer(sim, DUREE_DEFAITE + 0.5);
  assert.equal(sim.etat.phase, 'attente');
  assert.equal(sim.etat.monstres.length, 0);
});

test('au bout de l’assaut, la lumière revient : les zombies fuient, puis un assaut plus fort', () => {
  const sim = assaut(['a', 'b']);
  const s = sim.etat;
  let apparus1 = s.prochainId;
  defendre(sim, 10);
  avancer(sim, 3);
  assert.ok(s.monstres.length > 0, 'des zombies en route');
  while (s.phase === 'assaut') defendre(sim, 0.1);
  apparus1 = s.prochainId - apparus1;
  assert.equal(s.phase, 'accalmie');
  assert.equal(s.monstres.length, 0, 'les zombies restants fuient');
  assert.equal(s.cycle, 1);
  const avant = s.prochainId;
  avancer(sim, CYCLE.accalmie - 0.5);
  assert.equal(s.prochainId, avant, 'aucune apparition pendant l’accalmie');
  avancer(sim, 1);
  assert.equal(s.phase, 'assaut');
  assert.equal(s.cycle, 2);
  assert.ok(danger(s.etape, 2) > danger(s.etape, 1));
  const debut = s.prochainId;
  while (s.phase === 'assaut') defendre(sim, 0.1);
  assert.ok(s.prochainId - debut > apparus1, `plus de zombies au deuxième assaut (${apparus1} puis ${s.prochainId - debut})`);
});

test('poser le protégé sur l’autel appelle le boss : un rituel, puis un chrono', () => {
  const sim = lancer(['a', 'b', 'c']);
  const s = sim.etat;
  const { autel } = CARTES[0];
  // Porté au-dessus de l'autel, rien ne se passe : il faut l'y poser.
  const pres = { x: s.poteau.x + 1, z: s.poteau.z, r: 0 };
  assert.ok(sim.demanderPorter('a', joueurs({ a: pres })));
  const surAutel = joueurs({ a: { x: autel.x, z: autel.z - 1, r: 0 } });
  sim.pas(0.1, surAutel);
  assert.ok(Math.hypot(s.poteau.x - autel.x, s.poteau.z - autel.z) < autel.rayon);
  assert.equal(s.phase, 'accalmie');
  assert.ok(sim.poser('a'));
  sim.pas(0.1, surAutel);
  assert.equal(s.phase, 'rituel');
  assert.equal(s.reste, BOSS.rituel);
  assert.ok(!sim.demanderPorter('a', surAutel), 'pendant le rituel, le protégé reste sur l’autel');
  avancer(sim, BOSS.rituel + 0.2, surAutel);
  assert.equal(s.phase, 'boss');
  const boss = s.monstres.find((m) => m.id === s.boss.id);
  assert.equal(boss.k, indiceType('boss'));
  assert.equal(boss.pv, pvBoss(0, 3), 'trois défenseurs');
  assert.equal(s.boss.pvMax, boss.pv);
  assert.ok(Math.abs(s.reste - BOSS.duree) < 0.5);
  assert.ok(Math.hypot(boss.x - s.poteau.x, boss.z - s.poteau.z) > 20, 'il arrive de loin');
  // Les zombies ordinaires continuent d'arriver, moins vite.
  const avant = s.prochainId;
  defendre(sim, 20);
  assert.equal(s.phase, 'boss');
  assert.ok(s.prochainId > avant, 'la horde ne s’arrête pas');
  assert.ok(Math.abs(s.reste - (BOSS.duree - 20)) < 0.5, 'le chrono tourne');
});

test('pendant un assaut aussi, l’autel appelle le boss', () => {
  const sim = assaut(['a']);
  const { autel } = CARTES[0];
  Object.assign(sim.etat.poteau, { x: autel.x + 0.5, z: autel.z });
  sim.pas(0.1, joueurs());
  assert.equal(sim.etat.phase, 'rituel');
});

test('le boss abattu : victoire, prime pour tous, puis la carte suivante', () => {
  const sim = lancer(['a', 'b']);
  const s = sim.etat;
  sim.etat.comptes.a.argent = 40;
  const boss = appelerBoss(sim);
  while (!sim.toucher(boss.id, 300, 'b'));
  sim.pas(0.1, joueurs());
  assert.equal(s.phase, 'victoire');
  assert.ok(PHASES_ECLAIREES.includes('victoire'));
  assert.equal(s.boss, null);
  assert.equal(s.monstres.length, 0);
  assert.equal(s.comptes.a.argent, 40 + BONUS_BOSS);
  assert.equal(s.comptes.b.argent, TYPES_ZOMBIES[indiceType('boss')].recompense + BONUS_BOSS);
  assert.equal(s.etoiles.length, ETOILES.boss, 'ses étoiles restent à ramasser');
  avancer(sim, DUREE_VICTOIRE + 0.2);
  assert.equal(s.phase, 'accalmie');
  assert.equal(s.etape, 1);
  assert.equal(CARTES[s.carte].id, 'village');
  assert.equal(sim.instantane().ca, 1);
  assert.deepEqual({ x: s.poteau.x, z: s.poteau.z }, CARTES[1].poteau);
  assert.equal(s.pv, PV_PROTEGE);
  assert.equal(s.etoiles.length, 0);
});

test('le chrono du boss fini, c’est perdu', () => {
  const sim = lancer(['a']);
  const s = sim.etat;
  const boss = appelerBoss(sim);
  boss.v = 0;
  s.cumul = -1e9;
  s.boss.invocation = 1e9;
  avancer(sim, BOSS.duree - 1);
  assert.equal(s.phase, 'boss');
  avancer(sim, 1.5);
  assert.equal(s.phase, 'defaite');
  assert.equal(s.cause, 'temps');
  assert.ok(s.pv > 0, 'le protégé vit encore');
  assert.equal(normaliserMonde(JSON.parse(JSON.stringify(sim.instantane()))).cause, 'temps');
});

test('le parcours : l’île, le village, la forêt, puis l’île à nouveau, plus dangereuse', () => {
  const sim = lancer(['a']);
  const s = sim.etat;
  assert.equal(CARTES[s.carte].id, 'ile');
  for (const attendu of ['village', 'foret', 'ile']) {
    franchirLaCarte(sim, 'a');
    assert.equal(s.phase, 'accalmie');
    assert.equal(CARTES[s.carte].id, attendu);
    assert.equal(s.cycle, 0);
    assert.deepEqual({ x: s.poteau.x, z: s.poteau.z }, CARTES[s.carte].poteau);
  }
  assert.equal(s.etape, 3);
  assert.equal(carteDEtape(3), 0);
  assert.ok(danger(3, 1) > danger(0, 1) * 3);
  // Le boss de la quatrième carte résiste bien davantage.
  const boss = appelerBoss(sim);
  assert.equal(boss.pv, pvBoss(3, 1));
  assert.ok(boss.pv > pvBoss(0, 1) * 2);
});

test('porter le poteau : de près seulement, un porteur à la fois', () => {
  const sim = lancer(['a', 'b', 'c']);
  const s = sim.etat;
  const pres = { x: s.poteau.x + 1, z: s.poteau.z, r: 0 };
  const loin = { x: s.poteau.x + DISTANCE_PORTER + 1, z: s.poteau.z, r: 0 };
  const j = joueurs({ a: loin, b: pres, c: pres });
  assert.ok(!sim.demanderPorter('a', j), 'trop loin');
  assert.ok(!sim.demanderPorter('intrus', j), 'hors du salon');
  assert.ok(sim.demanderPorter('b', j));
  assert.ok(!sim.demanderPorter('c', j), 'déjà porté');

  // Le poteau suit le porteur, devant lui et un peu à sa droite.
  j.set('b', { x: 0, z: 0, r: 0 });
  sim.pas(0.1, j);
  const attendu = positionPortee(0, 0, 0);
  assert.ok(Math.abs(s.poteau.x - attendu.x) < 1e-9 && Math.abs(s.poteau.z - attendu.z) < 1e-9);
  assert.ok(attendu.z > 0.8 && attendu.x < -0.5, 'devant (+z) et à droite (−x pour qui regarde +z)');
  assert.ok(!sim.poser('a'));
  assert.ok(sim.poser('b'));
  assert.equal(s.poteau.porteur, null);

  // Un porteur qui quitte le salon lâche le poteau.
  assert.ok(sim.demanderPorter('b', joueurs({ b: { x: 0, z: 0.5, r: 0 } })));
  sim.definirMembres(membres('a', 'c'));
  assert.equal(s.poteau.porteur, null);
});

test("un nouvel hôte reprend exactement là où l'ancien s'est arrêté", () => {
  const ancien = assaut();
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
  assert.equal(normaliserMonde({ ph: 'manche' }), null, 'l’ancien déroulé en manches n’existe plus');
  const i = normaliserMonde({ ph: 'assaut', pv: 9999, ca: 99, ce: 'autre', po: ['x'], m: [[1, 2, 3], ['a', 1, 1], [2, NaN, 1]] });
  assert.equal(i.pv, PV_PROTEGE);
  assert.equal(i.carte, CARTES.length - 1);
  assert.equal(i.cause, null);
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

// Un rôdeur seul, parti de depart, sur la carte indice ; rend sa distance
// au poteau quand il l'a atteint (ou au bout de 90 s).
function rejoindre(indice, depart, poteau = CARTES[indice].poteau) {
  const sim = assaut(['a']);
  const s = sim.etat;
  s.carte = indice;
  s.reste = 1e9;
  s.monstres = [];
  Object.assign(s.poteau, { x: poteau.x, z: poteau.z, porteur: null });
  const m = seul(sim, 'rodeur', depart.x, depart.z);
  const distance = () => Math.hypot(m.x - s.poteau.x, m.z - s.poteau.z);
  for (let t = 0; t < 90 && distance() > 2; t += 0.1) sim.pas(0.1, joueurs());
  return { m, d: distance() };
}

test('un zombie coincé derrière la cabane la contourne et atteint le poteau', () => {
  const { m, d } = rejoindre(0, { x: CABANE.x - CABANE.profondeur / 2 - 1.5, z: CABANE.z });
  assert.ok(d < 2, `arrivé au poteau (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
});

test('de tous les côtés de l’île, un zombie traverse arbres, camp et tour de guet jusqu’au poteau', () => {
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, r = rayonIle(a) * 1.1;
    const { m, d } = rejoindre(0, { x: Math.cos(a) * r, z: Math.sin(a) * r });
    assert.ok(d < 2, `parti de l’angle ${a.toFixed(2)}, arrêté en (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
  }
});

test('sur chaque carte, poteau, armurerie, arrivée et autel sont dégagés', () => {
  for (const c of CARTES) {
    for (const [nom, p] of Object.entries({ poteau: c.poteau, boutique: c.boutique, apparition: c.apparition, autel: c.autel })) {
      assert.ok(c.estPraticable(p.x, p.z), `${c.id} : ${nom} praticable`);
      const r = c.resoudreCollisions(p.x, p.z);
      assert.ok(Math.hypot(r.x - p.x, r.z - p.z) < 1e-9, `${c.id} : ${nom} hors des obstacles`);
    }
    assert.ok(Math.hypot(c.autel.x - c.poteau.x, c.autel.z - c.poteau.z) > 12, `${c.id} : l’autel est à une petite marche du départ`);
    assert.ok(c.nom && c.conseil && c.sortieBoss);
  }
});

test('village et forêt : les zombies sortent de la lisière, loin du poteau', () => {
  for (const c of CARTES.slice(1)) {
    for (let k = 1; k <= 30; k++) {
      const p = c.pointDeSortie(graine(k), c.poteau);
      assert.ok(Math.max(Math.abs(p.x), Math.abs(p.z)) > c.borne - 1, `${c.id} : (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) sur la lisière`);
      assert.ok(!dansObstacle(c, p.x, p.z, 0.35), `${c.id} : sortie hors des obstacles`);
      assert.ok(Math.hypot(p.x - c.poteau.x, p.z - c.poteau.z) > 20, `${c.id} : loin du poteau`);
    }
  }
});

test('village et forêt : de toute la lisière, un zombie trouve son chemin jusqu’au poteau et jusqu’à l’autel', () => {
  for (const indice of [1, 2]) {
    const c = CARTES[indice];
    // Le poteau posé près de l'autel (sans le toucher, ce qui appellerait le boss).
    const vers = Math.atan2(-c.autel.z, -c.autel.x);
    const presAutel = { x: c.autel.x + Math.cos(vers) * 2.5, z: c.autel.z + Math.sin(vers) * 2.5 };
    for (const poteau of [c.poteau, presAutel]) {
      for (let k = 1; k <= 12; k++) {
        const depart = c.pointDeSortie(graine(100 + k), poteau, { assezLoin: 0 });
        const { m, d } = rejoindre(indice, depart, poteau);
        assert.ok(d < 2, `${c.id} : parti de (${depart.x.toFixed(1)}, ${depart.z.toFixed(1)}) vers (${poteau.x.toFixed(1)}, ${poteau.z.toFixed(1)}), arrêté en (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
      }
    }
  }
});

test('chaque zombie tué rapporte au tireur, pas aux autres, selon son type', () => {
  const sim = assaut(['a', 'b']);
  sim.etat.monstres = [];
  const rodeur = seul(sim, 'rodeur', 30, 0);
  const colosse = seul(sim, 'colosse', -30, 0);
  const coureur = seul(sim, 'coureur', 0, 30);
  assert.ok(sim.toucher(rodeur.id, 100, 'a'));
  assert.equal(sim.etat.comptes.a.argent, TYPES_ZOMBIES[indiceType('rodeur')].recompense);
  assert.equal(sim.etat.comptes.b.argent, 0);
  while (!sim.toucher(colosse.id, 100, 'b'));
  assert.equal(sim.etat.comptes.b.argent, TYPES_ZOMBIES[indiceType('colosse')].recompense);
  assert.ok(sim.toucher(coureur.id, 100, 'intrus'), 'un inconnu tue, mais ne gagne rien');
  assert.equal(sim.etat.comptes.intrus, undefined);
});

test("on n'achète qu'au comptoir de l'armurerie de la carte, avec assez d'argent, et une seule fois", () => {
  const sim = lancer(['a', 'b']);
  const auComptoir = joueurs({ a: { x: BOUTIQUE.x, z: BOUTIQUE.z, r: 0 } });
  const loin = joueurs({ a: { x: 0, z: 0, r: 0 } });
  assert.ok(!sim.acheter('a', 'uzi', auComptoir), 'pas assez d’argent');
  sim.etat.comptes.a.argent = 1000;
  assert.ok(!sim.acheter('a', 'uzi', loin), 'trop loin du comptoir');
  assert.ok(!sim.acheter('a', 'pistolet', auComptoir), 'le pistolet ne s’achète pas');
  assert.ok(!sim.acheter('a', 'bazooka', auComptoir), 'arme inconnue');
  assert.ok(!sim.acheter('intrus', 'uzi', joueurs({ intrus: { x: BOUTIQUE.x, z: BOUTIQUE.z, r: 0 } })), 'hors du salon');
  assert.ok(sim.acheter('a', 'uzi', auComptoir));
  const uzi = ARMES[indiceArme('uzi')];
  assert.equal(sim.etat.comptes.a.argent, 1000 - uzi.prix);
  assert.equal(sim.etat.comptes.a.armes, ARMES_DEPART | (1 << indiceArme('uzi')));
  assert.ok(!sim.acheter('a', 'uzi', auComptoir), 'déjà achetée');
  // Au village, le comptoir est celui de l'armurier.
  sim.etat.carte = 1;
  const { boutique } = CARTES[1];
  assert.ok(!sim.acheter('a', 'fusil', auComptoir), 'le comptoir de l’île n’est plus là');
  assert.ok(sim.acheter('a', 'fusil', joueurs({ a: { x: boutique.x, z: boutique.z, r: 0 } })));
});

test('la nourriture s’achète à l’armurerie et soigne peu à peu ; sans elle, pas de soin', () => {
  const sim = assaut(['a', 'b']);
  const s = sim.etat;
  const auComptoir = joueurs({ a: { x: BOUTIQUE.x, z: BOUTIQUE.z, r: 0 } });
  const pomme = VIVRES[indiceVivre('pomme')], ragout = VIVRES[indiceVivre('ragout')];
  assert.ok(!sim.acheterVivre('a', 'pomme', auComptoir), 'pas d’argent');
  s.comptes.a.argent = 2000;
  assert.ok(!sim.acheterVivre('a', 'pomme', joueurs({ a: { x: 0, z: 0, r: 0 } })), 'loin du comptoir');
  assert.ok(!sim.acheterVivre('a', 'caviar', auComptoir), 'inconnu');
  for (let n = 0; n < pomme.max; n++) assert.ok(sim.acheterVivre('a', 'pomme', auComptoir));
  assert.ok(!sim.acheterVivre('a', 'pomme', auComptoir), 'on ne porte pas plus');
  assert.ok(sim.acheterVivre('a', 'ragout', auComptoir));
  assert.equal(s.comptes.a.argent, 2000 - pomme.prix * pomme.max - ragout.prix);
  assert.deepEqual(sim.instantane().jo.a[3], [pomme.max, 1]);

  assert.ok(!sim.manger('a', 'pomme'), 'à pleine santé, on ne mange pas');
  s.monstres = [];
  s.cumul = -1e9;
  s.vies.a = { pv: 40, terre: false, releve: 0, repit: 0, seul: 0, soin: 0, vitesseSoin: 0 };
  const j = joueurs({ a: { x: 0, z: 0, r: 0 } });
  avancer(sim, 10, j);
  assert.equal(s.vies.a.pv, 40, 'pas de soin tout seul');
  assert.ok(sim.manger('a', 'pomme'));
  assert.equal(s.comptes.a.vivres[0], pomme.max - 1);
  avancer(sim, pomme.duree / 2, j);
  assert.ok(Math.abs(s.vies.a.pv - (40 + pomme.soin / 2)) < 1.5, `à mi-repas : ${s.vies.a.pv}`);
  assert.equal(sim.instantane().vi.a[3], 1, 'en train de manger');
  avancer(sim, pomme.duree / 2 + 0.2, j);
  assert.ok(Math.abs(s.vies.a.pv - (40 + pomme.soin)) < 1e-6);
  assert.equal(sim.instantane().vi.a[3], 0);
  // Le ragoût remonte au plus à la vie pleine.
  assert.ok(sim.manger('a', 'ragout'));
  assert.ok(!sim.manger('a', 'pomme'), 'le repas en cours suffit à remplir la vie');
  avancer(sim, ragout.duree + 0.5, j);
  assert.equal(s.vies.a.pv, JOUEUR.pv);
  assert.ok(!sim.manger('a', 'ragout'), 'plus de ragoût');
  assert.ok(!sim.manger('intrus', 'pomme'));
});

test('à terre, on ne mange pas', () => {
  const sim = assaut(['a', 'b']);
  sim.etat.comptes.a.vivres = [1, 0];
  sim.etat.vies.a = { pv: 0, terre: true, releve: 0, repit: 0, seul: 0, soin: 0, vitesseSoin: 0 };
  assert.ok(!sim.manger('a', 'pomme'));
});

test('le boss abattu rapporte à tous ; une nouvelle partie remet les comptes à zéro', () => {
  const sim = lancer(['a', 'b']);
  const s = sim.etat;
  s.comptes.a = { argent: 40, armes: 3, niveaux: [0, 0, 0, 0], vivres: [2, 0] };
  franchirLaCarte(sim);
  assert.equal(s.comptes.a.argent, 40 + BONUS_BOSS);
  assert.equal(s.comptes.b.argent, BONUS_BOSS);
  // Défaite au village : les économies restent jusqu'au prochain lancement.
  s.reste = 0;
  sim.pas(0.01, joueurs());
  s.pv = 0;
  sim.pas(0.1, joueurs());
  assert.equal(s.phase, 'defaite');
  avancer(sim, DUREE_DEFAITE + 0.5);
  assert.equal(sim.etat.phase, 'attente');
  assert.equal(sim.etat.comptes.a.armes, 3);
  assert.ok(sim.demarrer());
  assert.deepEqual(sim.etat.comptes, { a: VIDE, b: VIDE });
  assert.equal(sim.etat.carte, 0, 'on repart de l’île');
});

test("argent, armes et nourriture survivent au départ de l'hôte", () => {
  const ancien = lancer(['a', 'b']);
  ancien.etat.comptes.a = { argent: 320, armes: 5, niveaux: [0, 0, 0, 0], vivres: [3, 1] };
  const nouveau = creerSimulation();
  assert.ok(nouveau.charger(JSON.parse(JSON.stringify(ancien.instantane()))));
  assert.deepEqual(nouveau.etat.comptes.a, { argent: 320, armes: 5, niveaux: [0, 0, 0, 0], vivres: [3, 1] });
  const tordu = normaliserMonde({ ph: 'assaut', jo: { x: [-5, 1], y: [10, 999, [3, 9, -1, 'a'], [2, 99]], z: 'rien' } });
  assert.deepEqual(tordu.comptes, { y: { argent: 10, armes: 999 & 15, niveaux: [3, ETOILES.niveauMax, 0, 0], vivres: [2, VIVRES[1].max] } });
});

test('le danger monte de carte en carte et d’assaut en assaut', () => {
  assert.equal(danger(0, 1), 1);
  assert.equal(danger(0, 0), 1, 'avant le premier assaut');
  assert.ok(danger(1, 1) > danger(0, 3), 'une carte de plus pèse plus que deux assauts');
  assert.equal(pvMonstre(1), 30);
  assert.ok(pvMonstre(danger(2, 1)) > pvMonstre(danger(1, 1)));
  assert.ok(vitesseMonstre(1) >= 2.3 && vitesseMonstre(10) <= 4);
  assert.ok(monstresParMinute(1, 1) > monstresParMinute(1, 0) * 1.7, 'la cadence monte au fil de l’assaut');
  assert.ok(monstresParMinute(danger(1, 1)) > monstresParMinute(1));
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
  // Le colosse frappe plus fort.
  const sim = assaut();
  sim.etat.monstres = [];
  const c = seul(sim, 'colosse', sim.etat.poteau.x + 1, sim.etat.poteau.z);
  const pv = sim.etat.pv;
  for (let i = 0; i < 10; i++) sim.pas(0.1, joueurs());
  assert.ok(c.a, 'au contact');
  assert.ok(Math.abs(pv - sim.etat.pv - 6 * colosse.degats) < 0.01, `${pv - sim.etat.pv} points perdus en une seconde`);
});

test('des coureurs dès le début, des colosses après la première minute, et plus de spéciaux ensuite', () => {
  const partDe = (niveau, ecoule, k, avance = 0) => poidsTypes(niveau, ecoule, avance)[k] / poidsTypes(niveau, ecoule, avance).reduce((a, b) => a + b);
  assert.equal(partDe(1, 30, indiceType('colosse')), 0);
  assert.ok(partDe(1, 60, indiceType('colosse')) > 0);
  assert.ok(partDe(1, 0, indiceType('rodeur')) > 0.6, 'surtout des rôdeurs au premier assaut');
  for (const k of [1, 2, 3]) assert.ok(partDe(danger(2, 1), 150, k) > partDe(1, 150, k));
  for (const k of [2, 3]) assert.ok(partDe(1, 60, k, 1) > partDe(1, 60, k, 0), 'plus de spéciaux en fin d’assaut');
  assert.equal(tirerType([1, 1, 0, 1], 0), 0);
  assert.equal(tirerType([1, 1, 0, 1], 0.4), 1);
  assert.equal(tirerType([1, 1, 0, 1], 0.9), 3);

  // Un assaut entier défendu, deux cartes plus loin : les quatre types se montrent.
  const sim = assaut();
  sim.etat.etape = 2;
  const vus = new Set();
  let colossesMax = 0;
  for (let t = 0; sim.etat.phase === 'assaut'; t += 0.1) {
    sim.pas(0.1, joueurs());
    colossesMax = Math.max(colossesMax, sim.etat.monstres.filter((m) => m.k === indiceType('colosse')).length);
    for (const m of [...sim.etat.monstres]) {
      vus.add(m.k);
      // Les colosses ne sont pas abattus tout de suite : le plafond doit tenir.
      if (m.k !== indiceType('colosse') || t % 20 < 0.1) sim.toucher(m.id, 999);
    }
  }
  assert.deepEqual([...vus].sort(), [0, 1, 2, 3]);
  assert.ok(colossesMax <= TYPES_ZOMBIES[indiceType('colosse')].max);
});

test('un bouffi au contact du poteau explose : le protégé perd 25 points, les zombies voisins aussi', () => {
  const sim = assaut();
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
  const sim = assaut(['a', 'b']);
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
  const sim = assaut();
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
  const bizarre = normaliserMonde({ ph: 'assaut', m: [[1, 0, 0, 0, 0, 30, 1, 99], [2, 0, 0, 0, 0, 30, 1, 1.5]], ex: [[1, 2], ['a', 1, 1], [3, 1, 1], 'x'] });
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

test('le boss appelle des coureurs en renfort, puis enrage à mi-vie', () => {
  const sim = lancer();
  const s = sim.etat;
  const boss = appelerBoss(sim);
  const nombre = () => s.monstres.filter((m) => m.k === indiceType('coureur')).length;
  s.cumul = -1e9;
  for (const m of [...s.monstres]) if (m.id !== boss.id) sim.toucher(m.id, 999);
  avancer(sim, BOSS.premiereInvocation + 0.2);
  assert.equal(s.boss.cris, 1);
  assert.equal(nombre(), renfortsBoss(0));
  const proches = s.monstres.filter((m) => m.id !== boss.id).every((m) => Math.hypot(m.x - boss.x, m.z - boss.z) < 5);
  assert.ok(proches, 'les renforts surgissent autour de lui');
  assert.ok(renfortsBoss(4) > renfortsBoss(0));

  const vitesse = boss.v;
  assert.ok(!s.boss.enrage);
  while (boss.pv > s.boss.pvMax * BOSS.enrage) sim.toucher(boss.id, 100);
  assert.ok(s.boss.enrage);
  assert.ok(Math.abs(boss.v - vitesse * BOSS.vitesseEnrage) < 1e-9);
});

test('le boss résiste davantage à chaque carte et face à plus de défenseurs', () => {
  assert.equal(pvBoss(0, 1), BOSS.pv);
  assert.equal(pvBoss(0, 0), BOSS.pv, 'personne : comme un défenseur');
  assert.ok(pvBoss(2, 1) > pvBoss(0, 1));
  assert.ok(pvBoss(0, 3) > pvBoss(0, 2));
  const boss = TYPES_ZOMBIES[indiceType('boss')];
  assert.ok(boss.boss && boss.largeur >= 3 && boss.hauteur >= 3);
  assert.ok(poidsTypes(9, 200).length < TYPES_ZOMBIES.length, 'le boss n’est jamais tiré au sort');
});

test('au contact du poteau, le boss tue vite : une défaite reste possible', () => {
  const sim = lancer();
  const s = sim.etat;
  const boss = appelerBoss(sim);
  s.cumul = -1e9;
  s.boss.invocation = 1e9;
  Object.assign(boss, { x: s.poteau.x + 1.5, z: s.poteau.z });
  let t = 0;
  while (s.phase === 'boss' && t < 30) {
    sim.pas(0.1, joueurs());
    t += 0.1;
  }
  assert.equal(s.phase, 'defaite');
  assert.equal(s.cause, 'protege');
  assert.ok(t < 6, `le protégé tient ${t.toFixed(1)} s`);
});

test('un nouvel hôte reprend le combat contre le boss', () => {
  const sim = lancer();
  const boss = appelerBoss(sim);
  while (!sim.etat.boss.enrage) sim.toucher(boss.id, 100);
  sim.etat.boss.cris = 2;
  const inst = JSON.parse(JSON.stringify(sim.instantane()));
  assert.deepEqual(inst.bo, [boss.id, sim.etat.boss.pvMax, 2]);
  const repris = creerSimulation();
  assert.ok(repris.charger(inst));
  assert.deepEqual(repris.instantane(), sim.instantane());
  assert.ok(repris.etat.boss.enrage, 'déjà enragé, il ne le redevient pas');
  assert.equal(repris.etat.phase, 'boss');
  assert.equal(normaliserMonde({ ph: 'boss', bo: [1, -5, 0] }).boss, null);
  assert.equal(normaliserMonde({ ph: 'boss', bo: 'x' }).boss, null);
  assert.equal(normaliserMonde({ ph: 'boss' }).boss, null);
});

// --- Attaques contre les joueurs ------------------------------------------

// Un assaut sans apparitions, avec un défenseur d et un zombie posé à côté.
function duel(type = 'rodeur', ids = ['a', 'b']) {
  const sim = assaut(ids);
  const s = sim.etat;
  s.monstres = [];
  s.cumul = -1e9;
  const [d, allie] = ids;
  // Loin du poteau, pour que le zombie préfère le joueur.
  const j = joueurs({ [d]: { x: -20, z: 20, r: 0, ar: 0 }, ...(allie ? { [allie]: { x: 20, z: -20, r: 0, ar: 0 } } : {}) });
  const m = seul(sim, type, -21, 20);
  return { sim, s, d, allie, j, m };
}

test('un zombie proche se jette sur le défenseur : 50 points par coup, deux coups et il est à terre', () => {
  const { sim, s, d, j, m } = duel();
  avancer(sim, 0.3, j);
  assert.equal(m.a, true, 'au contact du joueur');
  assert.equal(s.pv, PV_PROTEGE, 'le protégé ne perd rien');
  avancer(sim, 0.3, j);
  assert.equal(s.vies[d].pv, JOUEUR.pv - JOUEUR.coup);
  avancer(sim, JOUEUR.cadence * 0.5, j);
  assert.equal(s.vies[d].pv, JOUEUR.pv - JOUEUR.coup, 'pas deux coups coup sur coup');
  avancer(sim, JOUEUR.cadence, j);
  assert.equal(s.vies[d].terre, true);
  assert.deepEqual(sim.instantane().vi[d].slice(0, 2), [0, 1]);
  // À terre, on n'intéresse plus les zombies : celui-ci repart vers le poteau.
  const avant = Math.hypot(m.x - s.poteau.x, m.z - s.poteau.z);
  avancer(sim, 2, j);
  assert.ok(Math.hypot(m.x - s.poteau.x, m.z - s.poteau.z) < avant - 2);
  assert.ok(!sim.demanderPorter(d, joueurs({ [d]: { x: s.poteau.x, z: s.poteau.z, r: 0 } })), 'à terre, on ne porte rien');
});

test('pas de soin tout seul ; le boss met à terre d’un seul coup', () => {
  const { sim, s, d, j } = duel();
  avancer(sim, 0.7, j);
  assert.equal(s.vies[d].pv, JOUEUR.pv - JOUEUR.coup);
  s.monstres = [];
  avancer(sim, 30, j);
  assert.equal(s.vies[d].pv, JOUEUR.pv - JOUEUR.coup, 'il faut manger pour guérir');

  const autre = duel('boss');
  autre.m.pv = 5000;
  avancer(autre.sim, 1, autre.j);
  assert.equal(autre.s.vies[autre.d].terre, true);
});

test('un allié relève en restant près, E maintenu ; seul, on se relève tout seul', () => {
  const { sim, s, d, allie, j } = duel();
  avancer(sim, 2, j);
  assert.equal(s.vies[d].terre, true);
  s.monstres = [];
  // Trop loin : la demande est enregistrée mais n'avance pas.
  assert.ok(sim.demanderRelever(allie, d));
  avancer(sim, 1, j);
  assert.equal(s.vies[d].releve, 0);
  j.set(allie, { x: -19, z: 20.5, r: 0 });
  avancer(sim, JOUEUR.dureeReleve * 0.5, j);
  assert.ok(s.vies[d].releve > 0.4 && s.vies[d].terre);
  // Il lâche E : la relève retombe.
  sim.demanderRelever(allie, null);
  avancer(sim, 0.5, j);
  assert.ok(s.vies[d].releve < 0.4);
  sim.demanderRelever(allie, d);
  avancer(sim, JOUEUR.dureeReleve + 0.2, j);
  assert.equal(s.vies[d].terre, false);
  assert.equal(s.vies[d].pv, JOUEUR.pvReleve);
  assert.ok(!sim.demanderRelever(allie, d), 'debout : plus rien à relever');
  assert.ok(!sim.demanderRelever('intrus', d), 'hors du salon');

  // Seul dans la partie : relève automatique.
  const solo = duel('rodeur', ['a']);
  avancer(solo.sim, 2, solo.j);
  assert.equal(solo.s.vies[solo.d].terre, true);
  solo.s.monstres = [];
  avancer(solo.sim, JOUEUR.releveSeul - 1, solo.j);
  assert.equal(solo.s.vies[solo.d].terre, true);
  avancer(solo.sim, 1.2, solo.j);
  assert.equal(solo.s.vies[solo.d].terre, false);
});

test('un bouffi qui éclate près d’un défenseur lui retire un coup', () => {
  const { sim, s, d, j } = duel();
  s.monstres = [];
  avancer(sim, 0.1, j);
  const b = seul(sim, 'bouffi', -19, 20);
  sim.toucher(b.id, 999);
  assert.equal(s.vies[d].pv, JOUEUR.pv - JOUEUR.coup);
});

test('fin d’assaut : ceux à terre se relèvent ; victoire : tout le monde en pleine forme', () => {
  const { sim, s, d, j } = duel();
  avancer(sim, 2, j);
  assert.equal(s.vies[d].terre, true);
  s.monstres = [];
  s.reste = 0.05;
  avancer(sim, 0.2, j);
  assert.equal(s.phase, 'accalmie');
  assert.equal(s.vies[d].terre, false);
  assert.equal(s.vies[d].pv, JOUEUR.pvReleve);
  franchirLaCarte(sim);
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
  avancer(sim, 0.3, j);
  assert.equal(s.etoiles.length, 1, 'personne dessus');
  j.set(d, { x: e.x + 0.5, z: e.z, r: 0, ar: 0 });
  avancer(sim, 0.1, j);
  assert.equal(s.etoiles.length, 0);
  assert.deepEqual(s.comptes[d].niveaux, [1, 0, 0, 0]);
  assert.deepEqual(sim.instantane().jo[d][2], [1, 0, 0, 0]);
});

test('arme déjà au plus haut : l’étoile va à une autre arme, sinon elle rapporte une prime', () => {
  const { sim, s, d, j } = duel();
  s.monstres = [];
  s.comptes[d] = { argent: 0, armes: 0b11, niveaux: [ETOILES.niveauMax, 0, 0, 0], vivres: [0, 0] };
  const deposer = () => s.etoiles.push({ id: s.prochaineEtoile++, x: -20, z: 20, age: 0 });
  deposer();
  avancer(sim, 0.1, j);
  assert.deepEqual(s.comptes[d].niveaux, [3, 1, 0, 0], 'l’Uzi en profite');
  s.comptes[d].niveaux = [3, 3, 0, 0];
  deposer();
  avancer(sim, 0.1, j);
  assert.equal(s.comptes[d].argent, ETOILES.prime, 'fusil et lance-grenades pas achetés : prime');
});

test('une étoile dans l’eau glisse jusqu’à la terre ; elle s’éteint au bout de 30 s', () => {
  const sim = assaut();
  const s = sim.etat;
  s.monstres = [];
  s.cumul = -1e9;
  const boss = seul(sim, 'boss', 60, 0);
  sim.toucher(boss.id, 999999);
  assert.equal(s.etoiles.length, ETOILES.boss, 'le boss en lâche trois');
  for (const e of s.etoiles) assert.ok(estPraticable(e.x, e.z), `étoile en (${e.x.toFixed(1)}, ${e.z.toFixed(1)})`);
  avancer(sim, ETOILES.duree + 0.2);
  assert.equal(s.etoiles.length, 0);
});

// --- Lanterne ----------------------------------------------------------------

test('la lanterne s’améliore à l’armurerie, pour toute l’équipe, trois fois au plus', () => {
  const sim = lancer(['a', 'b']);
  const s = sim.etat;
  const auComptoir = joueurs({ a: { x: BOUTIQUE.x, z: BOUTIQUE.z, r: 0 } });
  assert.ok(!sim.ameliorerLanterne('a', auComptoir), 'pas d’argent');
  s.comptes.a.argent = 5000;
  assert.ok(!sim.ameliorerLanterne('a', joueurs({ a: { x: 0, z: 0, r: 0 } })), 'loin du comptoir');
  for (let n = 0; n < NIVEAU_LANTERNE_MAX; n++) assert.ok(sim.ameliorerLanterne('a', auComptoir));
  assert.ok(!sim.ameliorerLanterne('a', auComptoir), 'déjà au plus haut');
  assert.equal(s.comptes.a.argent, 5000 - LANTERNE.prix.reduce((a, b) => a + b));
  assert.equal(sim.instantane().la, NIVEAU_LANTERNE_MAX);
  assert.ok(LANTERNE.brouillard.every((v, i, t) => i === 0 || v > t[i - 1]), 'chaque niveau fait voir plus loin');
});

test('Lucie éclaire les environs : dans son halo, la nuit recule', () => {
  assert.equal(visionNocturne(0, 0), LANTERNE.brouillard[0] * LANTERNE.recul, 'tout près d’elle');
  assert.equal(visionNocturne(0, LANTERNE.rayon[0] * 0.5), LANTERNE.brouillard[0] * LANTERNE.recul);
  assert.equal(visionNocturne(0, LANTERNE.rayon[0]), LANTERNE.brouillard[0], 'au bord du halo');
  assert.equal(visionNocturne(0, 80), LANTERNE.brouillard[0], 'loin d’elle : la nuit ordinaire');
  const milieu = visionNocturne(0, LANTERNE.rayon[0] * 0.75);
  assert.ok(milieu > LANTERNE.brouillard[0] && milieu < LANTERNE.brouillard[0] * LANTERNE.recul);
  assert.ok(visionNocturne(3, 0) > visionNocturne(0, 0), 'la lanterne améliorée voit plus loin');
  assert.ok(LANTERNE.rayon.every((v, i, t) => i === 0 || v > t[i - 1]), 'et son halo s’élargit');
});

test('lanterne, étoiles et blessures passent d’un hôte à l’autre, vérifiées', () => {
  const { sim, s, d, j } = duel();
  avancer(sim, 0.7, j);
  s.lanterne = 2;
  s.etoiles.push({ id: 4, x: 1, z: 2, age: 3 });
  const inst = JSON.parse(JSON.stringify(sim.instantane()));
  const repris = creerSimulation();
  assert.ok(repris.charger(inst));
  assert.deepEqual(repris.instantane(), sim.instantane());
  assert.equal(repris.etat.vies[d].pv, JOUEUR.pv - JOUEUR.coup);
  const n = normaliserMonde({ ph: 'assaut', la: 42, et: [[1, 0, 0, -3], ['x', 1, 1]], vi: { a: [900, 1, 7, 1], b: 'rien' } });
  assert.equal(n.lanterne, NIVEAU_LANTERNE_MAX);
  assert.deepEqual(n.etoiles, [{ id: 1, x: 0, z: 0, age: 0 }]);
  assert.deepEqual(n.vies, { a: { pv: JOUEUR.pv, terre: true, releve: 1, mange: true } });
});

test('réglages d’essai : cycles courts, boss fragile, argent au départ', () => {
  assert.ok(ESSAI.accalmie > 0 && ESSAI.assaut > 0 && ESSAI.pvBoss > 0 && ESSAI.pvBoss <= 1);
  const sim = creerSimulation({ aleatoire: graine(9), accalmie: 20, assaut: 60, dureeBoss: 90, facteurPvBoss: 0.1, argentDepart: 10000 });
  sim.definirMembres(membres('a'));
  sim.demarrer();
  const s = sim.etat;
  assert.equal(s.reste, 20);
  assert.equal(s.comptes.a.argent, 10000, 'dans la poche dès le départ');
  assert.deepEqual(sim.instantane().jo.a, [10000, ARMES_DEPART, [0, 0, 0, 0], [0, 0]]);
  sim.definirMembres(membres('a', 'b'));
  assert.equal(s.comptes.b.argent, 10000, 'arrivé en cours de partie');
  avancer(sim, 20.1);
  assert.equal(s.phase, 'assaut');
  defendre(sim, 59);
  assert.equal(s.phase, 'assaut');
  defendre(sim, 1.2);
  assert.equal(s.phase, 'accalmie', 'l’assaut court est fini');
  const boss = appelerBoss(sim);
  assert.equal(boss.pv, Math.round(pvBoss(0, 2) * 0.1), 'deux défenseurs, un dixième des points de vie');
  assert.ok(Math.abs(s.reste - 90) < 0.5);
});
