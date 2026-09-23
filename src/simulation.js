// La partie telle que la fait tourner l'hôte : préparation et manches (une
// carte par manche), zombies, boss de fin de manche, vie du protégé et des
// défenseurs, poteau, lanterne, étoiles, Illumination. Aucun Three.js ni réseau :
// l'hôte appelle pas() à chaque image et diffuse instantane() ; si l'hôte
// s'en va, le suivant reprend avec charger(dernier instantané reçu).

import { CARTES, carteDeManche } from './monde.js';
import { PAS_MAX } from './navigation.js';
import {
  ARMES, ARMES_DEPART, BONUS_DEGATS_MAX, BONUS_MANCHE, BOSS, DEGATS_MONSTRE, DISTANCE_BOUTIQUE, DISTANCE_PORTER,
  DUREE_DEFAITE, DUREE_ILLUMINATION, DUREE_MANCHE, DUREE_PAUSE, DUREE_PREPARATION, ETOILES, EXPLOSION_BOUFFI, JOUEUR, LANTERNE,
  MONSTRES_MAX, NIVEAU_LANTERNE_MAX, PORTEE_ATTAQUE, POTEAU_DEPART, PV_PROTEGE, RAYON_MONSTRE, RECHARGE_ILLUMINATION,
  TYPES_ZOMBIES, degatsExplosion, indiceArme, monstresParMinute, poidsTypes, positionPortee, pvBoss, pvMonstre,
  renfortsBoss, tirerProtege, tirerType, vitesseMonstre,
} from './regles.js';

export const PHASES = ['attente', 'preparation', 'manche', 'pause', 'defaite'];

const ESPACEMENT = 0.7;
// Écart de hauteur au-delà duquel on ne s'atteint plus (zombie au pied de la
// terrasse, joueur sur le chemin de ronde…).
const ECART_ATTEINTE = 1.6;
// Le poteau porté ne saute pas d'un étage à l'autre.
const ECART_POTEAU = 1;
// Une explosion reste dans les instantanés le temps que tous la reçoivent.
const DUREE_EXPLOSION = 1.5;
const EXPLOSIONS_MAX = 12;
const arrondi = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const fini = (v, defaut = 0) => (Number.isFinite(v) ? v : defaut);

function etatInitial() {
  return {
    phase: 'attente',
    manche: 0,
    // Indice de la carte (CARTES dans monde.js) ; l'île au camp.
    carte: 0,
    // Joueurs prêts pendant la préparation.
    prets: [],
    reste: 0,
    pv: PV_PROTEGE,
    protege: null,
    precedent: null,
    poteau: { x: POTEAU_DEPART.x, z: POTEAU_DEPART.z, porteur: null },
    illumination: 0,
    recharge: 0,
    tues: 0,
    monstres: [],
    prochainId: 1,
    cumul: 0,
    // Explosions de bouffis récentes : { id, x, z, age }.
    explosions: [],
    prochaineExplosion: 1,
    // Boss de fin de manche : { id, pvMax, cris, invocation, enrage }, ou null.
    boss: null,
    // Argent, armes et niveau d'amélioration de chaque arme, par joueur :
    // { id: { argent, armes, niveaux: [n, n, n, n] } }.
    comptes: {},
    // Niveau de la lanterne (0 à NIVEAU_LANTERNE_MAX), pour toute la partie.
    lanterne: 0,
    // Étoiles au sol : { id, x, z, age }.
    etoiles: [],
    prochaineEtoile: 1,
    // Défenseurs touchés ou à terre : { id: { coups, terre, releve, repit, calme, seul } }.
    vies: {},
    // Qui relève qui (E maintenu) : { releveur: cible }.
    releves: {},
  };
}

// Plafond de dégâts par coup reçu du réseau : une grenade au centre, arme au
// plus haut niveau.
const DEGATS_MAX = Math.max(...ARMES.map((a) => a.degats * 2)) * BONUS_DEGATS_MAX;
const niveauxVides = () => ARMES.map(() => 0);

// apparitionBoss : secondes de manche avant le boss (BOSS.apparition par
// défaut) ; dureePreparation : 0 pour passer directement à la manche.
export function creerSimulation({ aleatoire = Math.random, apparitionBoss = BOSS.apparition, dureePreparation = DUREE_PREPARATION } = {}) {
  let s = etatInitial();
  let membres = [];
  let roleSolo = 'defenseur';
  // Positions reçues au dernier pas (les explosions de bouffis, déclenchées
  // hors du pas par un tir, en ont besoin pour toucher les joueurs).
  let joueursConnus = new Map();

  const carte = () => CARTES[s.carte] ?? CARTES[0];
  const compte = (id) => (s.comptes[id] ??= { argent: 0, armes: ARMES_DEPART, niveaux: niveauxVides() });
  const vie = (id) => (s.vies[id] ??= { coups: 0, terre: false, releve: 0, repit: 0, calme: 0, seul: 0 });
  const estMembre = (id) => membres.some((j) => j.id === id);
  // Défenseurs debout, présents sur l'île : les cibles des zombies.
  const defenseursDebout = () => [...joueursConnus]
    .filter(([id]) => id !== s.protege && estMembre(id) && !s.vies[id]?.terre)
    .map(([id, j]) => ({ id, ...j }));

  const pointDeSortie = (options) => carte().pointDeSortie(aleatoire, s.poteau, options);

  function ajouterMonstre(k, x, z, pv = null) {
    const type = TYPES_ZOMBIES[k];
    const m = {
      id: s.prochainId++,
      k,
      x,
      z,
      r: 0,
      pv: pv ?? Math.round(pvMonstre(s.manche) * type.pv),
      v: type.vitesse * (0.85 + aleatoire() * 0.3),
      a: false,
      // Côté par lequel il contourne un obstacle.
      c: aleatoire() < 0.5 ? -1 : 1,
    };
    s.monstres.push(m);
    return m;
  }

  function apparaitre() {
    const { x, z } = pointDeSortie();
    let k = tirerType(poidsTypes(s.manche, DUREE_MANCHE - s.reste), aleatoire());
    const { max } = TYPES_ZOMBIES[k];
    if (max && s.monstres.filter((m) => m.k === k).length >= max) k = 0;
    ajouterMonstre(k, x, z);
  }

  const K_BOSS = TYPES_ZOMBIES.findIndex((t) => t.boss);
  const K_COUREUR = TYPES_ZOMBIES.findIndex((t) => t.id === 'coureur');

  function appelerBoss() {
    const { x, z } = pointDeSortie({ large: 1.3, essais: 12, assezLoin: Infinity });
    const defenseurs = membres.filter((m) => m.id !== s.protege).length;
    const pvMax = pvBoss(s.manche, defenseurs);
    const m = ajouterMonstre(K_BOSS, x, z, pvMax);
    m.v = TYPES_ZOMBIES[K_BOSS].vitesse;
    s.boss = { id: m.id, pvMax, cris: 0, invocation: BOSS.premiereInvocation, enrage: false };
  }

  const bossEnJeu = () => (s.boss ? s.monstres.find((m) => m.id === s.boss.id) ?? null : null);

  // Le boss hurle : des coureurs surgissent autour de lui.
  function invoquer(boss) {
    s.boss.cris += 1;
    const n = renfortsBoss(s.manche);
    for (let i = 0; i < n && s.monstres.length < MONSTRES_MAX; i++) {
      const a = (i / n) * Math.PI * 2 + aleatoire();
      const p = carte().resoudreCollisions(boss.x + Math.cos(a) * 2.6, boss.z + Math.sin(a) * 2.6);
      ajouterMonstre(K_COUREUR, p.x, p.z);
    }
  }

  // Avant chaque manche : sa carte, le poteau à son point de départ, pas de
  // zombie. On achète, on place le poteau, et l'on se déclare prêt.
  function commencerPreparation() {
    s.carte = carteDeManche(s.manche);
    s.poteau = { ...carte().poteau, porteur: null };
    s.monstres = [];
    s.boss = null;
    s.etoiles = [];
    s.explosions = [];
    s.vies = {};
    s.releves = {};
    s.prets = [];
    s.pv = PV_PROTEGE;
    s.phase = 'preparation';
    s.reste = dureePreparation;
    if (dureePreparation <= 0) commencerManche();
  }

  function gagnerManche() {
    s.phase = 'pause';
    s.reste = DUREE_PAUSE;
    s.monstres = [];
    s.boss = null;
    // Tout le monde se relève pour la manche suivante.
    s.vies = {};
    s.releves = {};
    s.manche += 1;
    for (const m of membres) compte(m.id).argent += BONUS_MANCHE;
    s.protege = tirerProtege(membres, { aleatoire, roleSolo, precedent: s.precedent });
    s.precedent = s.protege;
    if (s.poteau.porteur === s.protege) s.poteau.porteur = null;
  }

  const typeDe = (m) => TYPES_ZOMBIES[m.k ?? 0] ?? TYPES_ZOMBIES[0];

  // Retire un zombie abattu ; un bouffi explose en tombant.
  function abattre(m, auteur) {
    const i = s.monstres.indexOf(m);
    if (i < 0) return;
    s.monstres.splice(i, 1);
    s.tues += 1;
    const type = typeDe(m);
    if (auteur && membres.some((j) => j.id === auteur)) compte(auteur).argent += type.recompense;
    if (type.boss) {
      for (let i = 0; i < ETOILES.boss; i++) {
        const a = (i / ETOILES.boss) * Math.PI * 2;
        poserEtoile(m.x + Math.cos(a) * 2, m.z + Math.sin(a) * 2);
      }
    } else if (aleatoire() < (type.etoile ?? 0)) {
      poserEtoile(m.x, m.z);
    }
    if (type.explosif) exploser(m, auteur, false);
  }

  // Une étoile tombe là où le zombie est mort ; s'il est mort dans l'eau
  // profonde, elle glisse vers le poteau jusqu'à la terre ferme.
  function poserEtoile(x, z) {
    let p = null;
    for (let t = 0; t <= 1 && !p; t += 0.05) {
      const px = x + (s.poteau.x - x) * t, pz = z + (s.poteau.z - z) * t;
      if (carte().estPraticable(px, pz)) p = carte().resoudreCollisions(px, pz);
    }
    if (!p) return;
    s.etoiles.push({ id: s.prochaineEtoile++, x: p.x, z: p.z, age: 0 });
    if (s.etoiles.length > ETOILES.max) s.etoiles.shift();
  }

  // Étoile ramassée : l'arme en main monte d'un niveau ; déjà au plus haut,
  // une autre des siennes ; toutes au plus haut, une prime.
  function ramasser(id, indiceEnMain) {
    const c = compte(id);
    c.niveaux ??= niveauxVides();
    const possede = (i) => (c.armes & (1 << i)) !== 0;
    const ameliorable = (i) => possede(i) && c.niveaux[i] < ETOILES.niveauMax;
    const i = ameliorable(indiceEnMain) ? indiceEnMain : ARMES.findIndex((_, k) => ameliorable(k));
    if (i >= 0) c.niveaux[i] += 1;
    else c.argent += ETOILES.prime;
  }

  // Un coup porté à un défenseur ; au bout de JOUEUR.coups, il est à terre.
  function frapperJoueur(id, n = 1) {
    const v = vie(id);
    if (v.terre || v.repit > 0) return;
    v.coups = Math.min(JOUEUR.coups, v.coups + n);
    v.repit = JOUEUR.repit;
    v.calme = 0;
    if (v.coups >= JOUEUR.coups) {
      v.terre = true;
      v.releve = 0;
      v.seul = 0;
      if (s.poteau.porteur === id) s.poteau.porteur = null;
      delete s.releves[id];
    }
  }

  function relever(id) {
    s.vies[id] = { coups: 0, terre: false, releve: 0, repit: 2, calme: 0, seul: 0 };
    for (const [r, c] of Object.entries(s.releves)) if (c === id) delete s.releves[r];
  }

  // Blessures qui guérissent, relève par un allié (ou seul, faute d'allié).
  function suivreVies(dt) {
    const debout = defenseursDebout();
    for (const [id, v] of Object.entries(s.vies)) {
      v.repit = Math.max(0, v.repit - dt);
      if (!v.terre) {
        if (v.coups > 0 && (v.calme += dt) >= JOUEUR.soin) {
          v.coups -= 1;
          v.calme = 0;
        }
        continue;
      }
      const ici = joueursConnus.get(id);
      const aide = ici && debout.some((j) => s.releves[j.id] === id && Math.hypot(j.x - ici.x, j.z - ici.z) <= JOUEUR.distanceReleve);
      v.releve = aide ? v.releve + dt / JOUEUR.dureeReleve : Math.max(0, v.releve - dt / JOUEUR.dureeReleve);
      // Aucun autre défenseur dans la partie : personne ne viendra.
      const allies = membres.filter((m) => m.id !== id && m.id !== s.protege).length;
      if (!allies) v.seul += dt;
      if (v.releve >= 1 || v.seul >= JOUEUR.releveSeul) relever(id);
    }
  }

  function blesser(m, degats, auteur) {
    m.pv -= degats;
    // Le boss à moitié mort enrage : il accélère.
    if (s.boss?.id === m.id && !s.boss.enrage && m.pv > 0 && m.pv <= s.boss.pvMax * BOSS.enrage) {
      s.boss.enrage = true;
      m.v *= BOSS.vitesseEnrage;
    }
    if (m.pv > 0) return false;
    abattre(m, auteur);
    return true;
  }

  // Explosion d'un bouffi (déjà retiré de la liste). contact : il a atteint
  // le poteau, le protégé prend tout.
  function exploser(m, auteur, contact) {
    const E = EXPLOSION_BOUFFI;
    s.explosions.push({ id: s.prochaineExplosion++, x: m.x, z: m.z, age: 0 });
    if (s.explosions.length > EXPLOSIONS_MAX) s.explosions.shift();
    if (s.phase === 'manche') {
      const d = contact ? 0 : Math.hypot(m.x - s.poteau.x, m.z - s.poteau.z);
      s.pv -= degatsExplosion(E, d, E.protege);
      // Les défenseurs trop près prennent un coup.
      for (const j of defenseursDebout()) {
        if (Math.hypot(j.x - m.x, j.z - m.z) <= JOUEUR.explosion) frapperJoueur(j.id, 1);
      }
    }
    // Les zombies autour, parfois d'autres bouffis : réaction en chaîne.
    for (const autre of [...s.monstres]) {
      if (!s.monstres.includes(autre)) continue;
      const dg = degatsExplosion(E, Math.hypot(autre.x - m.x, autre.z - m.z));
      if (dg > 0) blesser(autre, dg, auteur);
    }
  }

  function commencerManche() {
    s.prets = [];
    s.phase = 'manche';
    s.reste = DUREE_MANCHE;
    s.pv = PV_PROTEGE;
    s.monstres = [];
    s.boss = null;
    s.vies = {};
    s.releves = {};
    // Un premier zombie arrive vite, pour que la manche démarre vraiment.
    s.cumul = 0.7;
  }

  function avancerMonstres(dt) {
    const vitesse = vitesseMonstre(s.manche);
    const auContact = [];
    const c = carte();
    // Sur une carte à murailles, les zombies suivent le champ de distances ;
    // sinon, ils vont droit et glissent le long des obstacles.
    const nav = c.navigation();
    const cibles = defenseursDebout().map((j) => ({ ...j, h: c.hauteurSol(j.x, j.z) }));
    const hPoteau = c.hauteurSol(s.poteau.x, s.poteau.z);
    const avant = new Map();
    for (const m of s.monstres) {
      const type = typeDe(m);
      const portee = PORTEE_ATTAQUE + RAYON_MONSTRE * (type.largeur - 1);
      const hm = c.hauteurPieds(m.x, m.z);
      avant.set(m, { x: m.x, z: m.z, h: hm });
      // Distance à parcourir (par les portes et les rampes s'il le faut).
      const trajet = (x, z) => (nav ? nav.distance(m.x, m.z, x, z) : Math.hypot(x - m.x, z - m.z));
      // Cible : le poteau, ou un défenseur proche (plus proche que le poteau).
      let px = s.poteau.x, pz = s.poteau.z, hCible = hPoteau;
      let proie = null;
      let dCible = trajet(px, pz);
      for (const j of cibles) {
        if (Math.hypot(j.x - m.x, j.z - m.z) >= JOUEUR.aggro) continue;
        const dj = trajet(j.x, j.z);
        if (dj < JOUEUR.aggro && dj < dCible) {
          proie = j;
          dCible = dj;
        }
      }
      if (proie) {
        px = proie.x;
        pz = proie.z;
        hCible = proie.h;
      }
      if (m.j !== (proie?.id ?? null)) {
        // Nouvelle cible : un temps d'élan avant le premier coup.
        m.j = proie?.id ?? null;
        m.t = 0.4;
      }
      const d = Math.hypot(px - m.x, pz - m.z);
      const atteint = d <= portee && Math.abs(hm - hCible) < ECART_ATTEINTE;
      if (!atteint) {
        // Prochain point de passage ; tout près de la cible, la cible elle-même.
        const but = nav ? nav.vers(m.x, m.z, px, pz) : { x: px, z: pz };
        const versCible = but.x === px && but.z === pz;
        const dx = but.x - m.x, dz = but.z - m.z;
        const db = Math.hypot(dx, dz) || 1e-6;
        m.r = Math.atan2(dx, dz);
        const pas = Math.max(0, Math.min(vitesse * m.v * dt, versCible ? db - portee * 0.9 : db));
        const ux = dx / db, uz = dz / db;
        // On ne monte pas plus d'une marche : les murs arrêtent, on les longe.
        const libre = (p) => c.hauteurPieds(p.x, p.z) - hm <= PAS_MAX;
        let suivant = c.resoudreCollisions(m.x + ux * pas, m.z + uz * pas);
        const progres = libre(suivant) ? (suivant.x - m.x) * ux + (suivant.z - m.z) * uz : -1;
        if (progres < pas * 0.3) {
          // Bloqué contre un mur ou un tronc : il glisse sur le côté.
          const cote = m.c ?? 1;
          suivant = c.resoudreCollisions(m.x - uz * cote * pas + ux * pas * 0.2, m.z + ux * cote * pas + uz * pas * 0.2);
          if (!libre(suivant)) suivant = { x: m.x, z: m.z };
        }
        m.x = suivant.x;
        m.z = suivant.z;
        m.a = false;
      } else if (type.explosif) {
        m.r = Math.atan2(px - m.x, pz - m.z);
        auContact.push({ m, poteau: !proie });
      } else if (proie) {
        m.r = Math.atan2(px - m.x, pz - m.z);
        m.a = true;
        m.t = (m.t ?? 0) - dt;
        if (m.t <= 0) {
          frapperJoueur(proie.id, type.coups ?? 1);
          m.t = JOUEUR.cadence * (type.cadence ?? 1);
        }
      } else {
        m.r = Math.atan2(px - m.x, pz - m.z);
        m.a = true;
        s.pv -= DEGATS_MONSTRE * type.degats * dt;
      }
    }
    // Un bouffi au contact (du poteau ou d'un joueur) explose : personne
    // n'est crédité.
    for (const { m, poteau } of auContact) {
      const i = s.monstres.indexOf(m);
      if (i < 0) continue;
      s.monstres.splice(i, 1);
      exploser(m, null, poteau);
    }
    // Les zombies se bousculent au lieu de s'empiler au même endroit ; un
    // colosse pousse les autres plus qu'il n'est poussé.
    for (let i = 0; i < s.monstres.length; i++) {
      for (let j = i + 1; j < s.monstres.length; j++) {
        const a = s.monstres[i], b = s.monstres[j];
        const la = typeDe(a).largeur, lb = typeDe(b).largeur;
        const espace = ESPACEMENT * (la + lb) / 2;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < espace && d > 1e-6) {
          const pousse = espace - d;
          const pa = (lb * lb) / (la * la + lb * lb);
          a.x -= (dx / d) * pousse * pa;
          a.z -= (dz / d) * pousse * pa;
          b.x += (dx / d) * pousse * (1 - pa);
          b.z += (dz / d) * pousse * (1 - pa);
        }
      }
    }
    for (const m of s.monstres) {
      Object.assign(m, c.resoudreCollisions(m.x, m.z));
      // Poussé contre un mur par la foule : il reste où il était.
      const p = avant.get(m);
      if (p && c.hauteurPieds(m.x, m.z) - p.h > PAS_MAX) Object.assign(m, { x: p.x, z: p.z });
    }
  }

  function suivrePorteur(joueurs) {
    const { porteur } = s.poteau;
    if (!porteur) return;
    const j = joueurs.get(porteur);
    if (!j || porteur === s.protege) {
      s.poteau.porteur = null;
      return;
    }
    const { x, z } = positionPortee(j.x, j.z, j.r);
    const c = carte();
    // Le poteau reste au niveau du porteur : pas de chute du haut d'une rampe.
    if (c.estPraticable(x, z) && Math.abs(c.hauteurSol(x, z) - c.hauteurSol(j.x, j.z)) < ECART_POTEAU) {
      s.poteau.x = x;
      s.poteau.z = z;
    }
  }

  return {
    get etat() {
      return s;
    },

    // membres : joueurs admis, dans l'ordre du salon.
    definirMembres(liste, options = {}) {
      membres = liste;
      if (options.roleSolo) roleSolo = options.roleSolo;
      const ids = new Set(liste.map((m) => m.id));
      // Protégé parti en cours de manche : le mannequin prend sa place.
      if (s.protege && !ids.has(s.protege)) s.protege = null;
      if (s.poteau.porteur && !ids.has(s.poteau.porteur)) s.poteau.porteur = null;
    },

    demarrer() {
      if (s.phase !== 'attente') return false;
      const { poteau, prochaineExplosion, prochaineEtoile } = s;
      s = etatInitial();
      s.poteau = { ...poteau, porteur: null };
      // Les numéros d'explosion continuent : les autres ont gardé les anciens.
      s.prochaineExplosion = prochaineExplosion;
      s.prochaineEtoile = prochaineEtoile;
      s.manche = 1;
      s.protege = tirerProtege(membres, { aleatoire, roleSolo });
      s.precedent = s.protege;
      commencerPreparation();
      return true;
    },

    // joueurs : Map id → { x, z, r, ar } (r = orientation du corps, ar =
    // indice de l'arme en main).
    pas(dt, joueurs) {
      joueursConnus = joueurs;
      if (s.protege && s.poteau.porteur === s.protege) s.poteau.porteur = null;
      suivrePorteur(joueurs);
      // Étoiles : elles s'éteignent avec le temps ; on les ramasse en marchant dessus.
      for (const e of s.etoiles) e.age += dt;
      s.etoiles = s.etoiles.filter((e) => e.age < ETOILES.duree);
      if (s.phase === 'manche' || s.phase === 'pause') {
        const c = carte();
        for (const j of defenseursDebout()) {
          const hj = c.hauteurSol(j.x, j.z);
          const e = s.etoiles.find((x) => Math.hypot(x.x - j.x, x.z - j.z) <= ETOILES.rayon && Math.abs(c.hauteurSol(x.x, x.z) - hj) < ECART_ATTEINTE);
          if (!e) continue;
          s.etoiles.splice(s.etoiles.indexOf(e), 1);
          ramasser(j.id, Number.isInteger(j.ar) ? j.ar : 0);
        }
      }
      s.illumination = Math.max(0, s.illumination - dt);
      s.recharge = Math.max(0, s.recharge - dt);
      for (const e of s.explosions) e.age += dt;
      s.explosions = s.explosions.filter((e) => e.age < DUREE_EXPLOSION);

      if (s.phase === 'manche') {
        s.reste = Math.max(0, s.reste - dt);
        const ecoule = DUREE_MANCHE - s.reste;
        // Pendant le combat contre le boss, la horde ralentit sans s'arrêter.
        const cadence = s.boss ? monstresParMinute(s.manche, 0) * BOSS.apparitions : monstresParMinute(s.manche, ecoule);
        s.cumul += (cadence / 60) * dt;
        while (s.cumul >= 1) {
          s.cumul -= 1;
          if (s.monstres.length < MONSTRES_MAX) apparaitre();
        }
        suivreVies(dt);
        const boss = bossEnJeu();
        if (boss) {
          s.boss.invocation -= dt;
          if (s.boss.invocation <= 0) {
            s.boss.invocation = BOSS.invocation;
            invoquer(boss);
          }
        }
        avancerMonstres(dt);
        if (s.pv <= 0) {
          s.pv = 0;
          s.phase = 'defaite';
          s.reste = DUREE_DEFAITE;
          s.poteau.porteur = null;
          s.releves = {};
        } else if (!s.boss && DUREE_MANCHE - s.reste >= apparitionBoss) {
          // L'heure du boss : il sort de la mer ; sa mort gagne la manche.
          appelerBoss();
        } else if (s.boss && !bossEnJeu()) {
          gagnerManche();
        }
      } else if (s.phase === 'preparation') {
        s.reste -= dt;
        const tousPrets = membres.length > 0 && membres.every((m) => s.prets.includes(m.id));
        if (s.reste <= 0 || tousPrets) commencerManche();
      } else if (s.phase === 'pause') {
        s.reste -= dt;
        if (s.reste <= 0) commencerPreparation();
      } else if (s.phase === 'defaite') {
        s.reste -= dt;
        if (s.reste <= 0) {
          const { poteau, comptes, prochaineExplosion, prochaineEtoile } = s;
          s = etatInitial();
          s.poteau = poteau;
          s.prochaineExplosion = prochaineExplosion;
          s.prochaineEtoile = prochaineEtoile;
          // On garde ses économies au camp ; elles repartent à zéro au lancement.
          s.comptes = comptes;
        }
      }
    },

    // auteur : celui qui a tiré, crédité s'il est dans le salon.
    toucher(idMonstre, degats, auteur = null) {
      const m = s.monstres.find((x) => x.id === idMonstre);
      if (!m || !Number.isFinite(degats)) return false;
      return blesser(m, Math.min(Math.max(degats, 0), DEGATS_MAX), auteur);
    },

    // Achat à l'armurerie : il faut être devant le comptoir et avoir de quoi payer.
    acheter(id, idArme, joueurs) {
      const indice = indiceArme(idArme);
      if (indice <= 0 || !membres.some((j) => j.id === id) || id === s.protege) return false;
      const j = joueurs.get(id);
      const boutique = carte().boutique;
      if (!j || Math.hypot(j.x - boutique.x, j.z - boutique.z) > DISTANCE_BOUTIQUE) return false;
      const c = compte(id);
      const bit = 1 << indice;
      if (c.armes & bit || c.argent < ARMES[indice].prix) return false;
      c.argent -= ARMES[indice].prix;
      c.armes |= bit;
      return true;
    },

    // Amélioration de la lanterne, payée par un défenseur pour toute l'équipe.
    ameliorerLanterne(id, joueurs) {
      if (!estMembre(id) || id === s.protege || s.lanterne >= NIVEAU_LANTERNE_MAX) return false;
      const j = joueurs.get(id);
      const boutique = carte().boutique;
      if (!j || Math.hypot(j.x - boutique.x, j.z - boutique.z) > DISTANCE_BOUTIQUE) return false;
      const c = compte(id);
      const prix = LANTERNE.prix[s.lanterne];
      if (c.argent < prix) return false;
      c.argent -= prix;
      s.lanterne += 1;
      return true;
    },

    // releveur maintient E près de cible (à terre) ; cible null : il lâche.
    demanderRelever(releveur, cible) {
      if (cible === null || cible === undefined) {
        delete s.releves[releveur];
        return true;
      }
      if (!estMembre(releveur) || releveur === s.protege || s.vies[releveur]?.terre) return false;
      if (typeof cible !== 'string' || !s.vies[cible]?.terre) return false;
      s.releves[releveur] = cible;
      return true;
    },

    demanderPorter(id, joueurs) {
      if (s.poteau.porteur || id === s.protege || s.phase === 'defaite' || s.vies[id]?.terre) return false;
      const j = joueurs.get(id);
      if (!j || Math.hypot(j.x - s.poteau.x, j.z - s.poteau.z) > DISTANCE_PORTER) return false;
      const c = carte();
      if (Math.abs(c.hauteurSol(j.x, j.z) - c.hauteurSol(s.poteau.x, s.poteau.z)) > ECART_POTEAU) return false;
      s.poteau.porteur = id;
      return true;
    },

    poser(id) {
      if (s.poteau.porteur !== id) return false;
      s.poteau.porteur = null;
      return true;
    },

    // Pendant la préparation, chacun se déclare prêt (Entrée).
    pret(id) {
      if (s.phase !== 'preparation' || !estMembre(id)) return false;
      if (!s.prets.includes(id)) s.prets.push(id);
      return true;
    },

    demanderIllumination(id) {
      if (s.phase !== 'manche' || id !== s.protege || s.recharge > 0) return false;
      s.illumination = DUREE_ILLUMINATION;
      s.recharge = RECHARGE_ILLUMINATION;
      return true;
    },

    instantane() {
      return {
        type: 'monde',
        ph: s.phase,
        ma: s.manche,
        ca: s.carte,
        rd: [...s.prets],
        re: arrondi(s.reste, 1),
        pv: arrondi(s.pv, 1),
        pr: s.protege,
        po: [arrondi(s.poteau.x), arrondi(s.poteau.z), s.poteau.porteur],
        il: [arrondi(s.illumination, 1), arrondi(s.recharge, 1)],
        tu: s.tues,
        jo: Object.fromEntries(Object.entries(s.comptes).map(([id, c]) => [id, [c.argent, c.armes, c.niveaux ?? niveauxVides()]])),
        m: s.monstres.map((m) => [m.id, arrondi(m.x), arrondi(m.z), arrondi(m.r), m.a ? 1 : 0, arrondi(m.pv, 1), arrondi(m.v), m.k ?? 0]),
        ex: s.explosions.map((e) => [e.id, arrondi(e.x), arrondi(e.z)]),
        bo: s.boss ? [s.boss.id, s.boss.pvMax, s.boss.cris] : null,
        la: s.lanterne,
        et: s.etoiles.map((e) => [e.id, arrondi(e.x), arrondi(e.z), arrondi(e.age, 1)]),
        // Relève : la plus avancée des deux (par un allié, ou seul).
        vi: Object.fromEntries(Object.entries(s.vies).map(([id, v]) => [
          id, [v.coups, v.terre ? 1 : 0, arrondi(Math.max(v.releve, v.seul / JOUEUR.releveSeul))],
        ])),
      };
    },

    // Reprise par un nouvel hôte. Les valeurs reçues sont vérifiées une à une.
    charger(inst) {
      const i = normaliserMonde(inst);
      if (!i) return false;
      s = {
        ...etatInitial(),
        phase: i.phase,
        manche: i.manche,
        reste: i.reste,
        pv: i.pv,
        protege: i.protege,
        precedent: i.protege,
        poteau: { ...i.poteau },
        illumination: i.illumination,
        recharge: i.recharge,
        tues: i.tues,
        comptes: structuredClone(i.comptes),
        monstres: i.monstres.map((m) => ({ ...m })),
        prochainId: i.monstres.reduce((max, m) => Math.max(max, m.id), 0) + 1,
        explosions: i.explosions.map((e) => ({ ...e, age: 0 })),
        prochaineExplosion: i.explosions.reduce((max, e) => Math.max(max, e.id), 0) + 1,
      };
      s.carte = i.carte;
      s.prets = [...i.prets];
      s.lanterne = i.lanterne;
      s.etoiles = i.etoiles.map((e) => ({ ...e }));
      s.prochaineEtoile = i.etoiles.reduce((max, e) => Math.max(max, e.id), 0) + 1;
      // Les blessures reprennent ; une relève en cours repart de zéro.
      s.vies = Object.fromEntries(Object.entries(i.vies).map(([id, v]) => [id, { coups: v.coups, terre: v.terre, releve: 0, repit: 0, calme: 0, seul: 0 }]));
      if (i.boss) {
        const boss = s.monstres.find((m) => m.id === i.boss.id);
        s.boss = { ...i.boss, invocation: BOSS.invocation, enrage: !!boss && boss.pv <= i.boss.pvMax * BOSS.enrage };
      }
      return true;
    },
  };
}

// Lecture sûre d'un instantané reçu du réseau (hôte ou non).
export function normaliserMonde(inst) {
  if (!inst || typeof inst !== 'object' || !PHASES.includes(inst.ph)) return null;
  const po = Array.isArray(inst.po) ? inst.po : [];
  const il = Array.isArray(inst.il) ? inst.il : [];
  const id = (v) => (typeof v === 'string' && v.length <= 64 ? v : null);
  const monstres = (Array.isArray(inst.m) ? inst.m : [])
    .slice(0, MONSTRES_MAX)
    .filter((m) => Array.isArray(m) && Number.isInteger(m[0]) && [m[1], m[2]].every(Number.isFinite))
    .map((m) => ({
      id: m[0],
      x: m[1],
      z: m[2],
      r: fini(m[3]),
      a: m[4] === 1,
      pv: fini(m[5], 30),
      v: fini(m[6], 1),
      k: Number.isInteger(m[7]) && m[7] >= 0 && m[7] < TYPES_ZOMBIES.length ? m[7] : 0,
    }));
  const explosions = (Array.isArray(inst.ex) ? inst.ex : [])
    .slice(0, EXPLOSIONS_MAX)
    .filter((e) => Array.isArray(e) && Number.isInteger(e[0]) && [e[1], e[2]].every(Number.isFinite))
    .map(([id, x, z]) => ({ id, x, z }));
  const etoiles = (Array.isArray(inst.et) ? inst.et : [])
    .slice(0, ETOILES.max)
    .filter((e) => Array.isArray(e) && Number.isInteger(e[0]) && [e[1], e[2]].every(Number.isFinite))
    .map(([id, x, z, age]) => ({ id, x, z, age: Math.min(Math.max(fini(age), 0), ETOILES.duree) }));
  const vies = {};
  if (inst.vi && typeof inst.vi === 'object') {
    for (const [id, v] of Object.entries(inst.vi).slice(0, 8)) {
      if (id.length > 64 || !Array.isArray(v) || !Number.isInteger(v[0])) continue;
      vies[id] = { coups: Math.min(Math.max(v[0], 0), JOUEUR.coups), terre: v[1] === 1, releve: Math.min(Math.max(fini(v[2]), 0), 1) };
    }
  }
  const bo = inst.bo;
  const boss = Array.isArray(bo) && Number.isInteger(bo[0]) && Number.isFinite(bo[1]) && bo[1] > 0 && Number.isInteger(bo[2]) && bo[2] >= 0
    ? { id: bo[0], pvMax: bo[1], cris: bo[2] }
    : null;
  return {
    phase: inst.ph,
    manche: Number.isInteger(inst.ma) ? inst.ma : 0,
    reste: fini(inst.re),
    pv: Math.min(Math.max(fini(inst.pv, PV_PROTEGE), 0), PV_PROTEGE),
    protege: id(inst.pr),
    poteau: { x: fini(po[0], POTEAU_DEPART.x), z: fini(po[1], POTEAU_DEPART.z), porteur: id(po[2]) },
    illumination: fini(il[0]),
    recharge: fini(il[1]),
    tues: Number.isInteger(inst.tu) ? inst.tu : 0,
    comptes: normaliserComptes(inst.jo),
    monstres,
    explosions,
    boss,
    lanterne: Number.isInteger(inst.la) ? Math.min(Math.max(inst.la, 0), NIVEAU_LANTERNE_MAX) : 0,
    carte: Number.isInteger(inst.ca) && inst.ca >= 0 && inst.ca < CARTES.length ? inst.ca : 0,
    prets: (Array.isArray(inst.rd) ? inst.rd : []).filter(id).slice(0, 8),
    etoiles,
    vies,
  };
}

function normaliserComptes(jo) {
  const comptes = {};
  if (!jo || typeof jo !== 'object') return comptes;
  for (const [id, v] of Object.entries(jo).slice(0, 8)) {
    if (id.length > 64 || !Array.isArray(v)) continue;
    const [argent, armes, niveaux] = v;
    if (!Number.isInteger(argent) || argent < 0 || !Number.isInteger(armes)) continue;
    comptes[id] = {
      argent,
      armes: (armes & ((1 << ARMES.length) - 1)) | ARMES_DEPART,
      niveaux: ARMES.map((_, i) => {
        const n = Array.isArray(niveaux) ? niveaux[i] : 0;
        return Number.isInteger(n) ? Math.min(Math.max(n, 0), ETOILES.niveauMax) : 0;
      }),
    };
  }
  return comptes;
}
