// La partie telle que la fait tourner l'hôte : manches, zombies, boss de fin
// de manche, vie du protégé, poteau, Illumination. Aucun Three.js ni réseau :
// l'hôte appelle pas() à chaque image et diffuse instantane() ; si l'hôte
// s'en va, le suivant reprend avec charger(dernier instantané reçu).

import { BOUTIQUE, estPraticable, rayonIle, resoudreCollisions } from './monde.js';
import {
  ARMES, ARMES_DEPART, BONUS_MANCHE, BOSS, DEGATS_MONSTRE, DISTANCE_BOUTIQUE, DISTANCE_PORTER, DUREE_DEFAITE,
  DUREE_ILLUMINATION, DUREE_MANCHE, DUREE_PAUSE, EXPLOSION_BOUFFI, MONSTRES_MAX, PORTEE_ATTAQUE, POTEAU_DEPART,
  PV_PROTEGE, RAYON_MONSTRE, RECHARGE_ILLUMINATION, TYPES_ZOMBIES, degatsExplosion, indiceArme, monstresParMinute,
  poidsTypes, positionPortee, pvBoss, pvMonstre, renfortsBoss, tirerProtege, tirerType, vitesseMonstre,
} from './regles.js';

export const PHASES = ['attente', 'manche', 'pause', 'defaite'];

const ESPACEMENT = 0.7;
// Une explosion reste dans les instantanés le temps que tous la reçoivent.
const DUREE_EXPLOSION = 1.5;
const EXPLOSIONS_MAX = 12;
const arrondi = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const fini = (v, defaut = 0) => (Number.isFinite(v) ? v : defaut);

function etatInitial() {
  return {
    phase: 'attente',
    manche: 0,
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
    // Argent et armes de chaque joueur : { id: { argent, armes } }.
    comptes: {},
  };
}

// Plafond de dégâts par coup reçu du réseau : une grenade au centre.
const DEGATS_MAX = Math.max(...ARMES.map((a) => a.degats * 2));

// apparitionBoss : secondes de manche avant le boss (BOSS.apparition par défaut).
export function creerSimulation({ aleatoire = Math.random, apparitionBoss = BOSS.apparition } = {}) {
  let s = etatInitial();
  let membres = [];
  let roleSolo = 'defenseur';

  const compte = (id) => (s.comptes[id] ??= { argent: 0, armes: ARMES_DEPART });

  // Point de sortie de l'eau, du côté opposé au poteau de préférence : le
  // plus loin parmi quelques essais, ou le premier assez loin. large : plus
  // loin du rivage (le boss sort des eaux profondes).
  function pointDeSortie({ large = 1.16, essais = 6, assezLoin = 18 } = {}) {
    let meilleur = null;
    for (let essai = 0; essai < essais; essai++) {
      const angle = aleatoire() * Math.PI * 2;
      const r = rayonIle(angle) * large;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      const d = Math.hypot(x - s.poteau.x, z - s.poteau.z);
      if (!meilleur || d > meilleur.d) meilleur = { x, z, d };
      if (d > assezLoin) break;
    }
    return meilleur;
  }

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
      const p = resoudreCollisions(boss.x + Math.cos(a) * 2.6, boss.z + Math.sin(a) * 2.6);
      ajouterMonstre(K_COUREUR, p.x, p.z);
    }
  }

  function gagnerManche() {
    s.phase = 'pause';
    s.reste = DUREE_PAUSE;
    s.monstres = [];
    s.boss = null;
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
    if (type.explosif) exploser(m, auteur, false);
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
    }
    // Les zombies autour, parfois d'autres bouffis : réaction en chaîne.
    for (const autre of [...s.monstres]) {
      if (!s.monstres.includes(autre)) continue;
      const dg = degatsExplosion(E, Math.hypot(autre.x - m.x, autre.z - m.z));
      if (dg > 0) blesser(autre, dg, auteur);
    }
  }

  function commencerManche() {
    s.phase = 'manche';
    s.reste = DUREE_MANCHE;
    s.pv = PV_PROTEGE;
    s.monstres = [];
    s.boss = null;
    // Un premier zombie arrive vite, pour que la manche démarre vraiment.
    s.cumul = 0.7;
  }

  function avancerMonstres(dt) {
    const vitesse = vitesseMonstre(s.manche);
    const { x: px, z: pz } = s.poteau;
    const auContact = [];
    for (const m of s.monstres) {
      const type = typeDe(m);
      const portee = PORTEE_ATTAQUE + RAYON_MONSTRE * (type.largeur - 1);
      const dx = px - m.x, dz = pz - m.z;
      const d = Math.hypot(dx, dz);
      m.r = Math.atan2(dx, dz);
      if (d > portee) {
        const pas = Math.min(vitesse * m.v * dt, d - portee * 0.9);
        const ux = dx / d, uz = dz / d;
        let suivant = resoudreCollisions(m.x + ux * pas, m.z + uz * pas);
        // Bloqué contre un mur ou un tronc : il glisse sur le côté.
        const progres = (suivant.x - m.x) * ux + (suivant.z - m.z) * uz;
        if (progres < pas * 0.3) {
          const cote = m.c ?? 1;
          suivant = resoudreCollisions(m.x - uz * cote * pas + ux * pas * 0.2, m.z + ux * cote * pas + uz * pas * 0.2);
        }
        m.x = suivant.x;
        m.z = suivant.z;
        m.a = false;
      } else if (type.explosif) {
        auContact.push(m);
      } else {
        m.a = true;
        s.pv -= DEGATS_MONSTRE * type.degats * dt;
      }
    }
    // Un bouffi au contact explose : personne n'est crédité.
    for (const m of auContact) {
      const i = s.monstres.indexOf(m);
      if (i < 0) continue;
      s.monstres.splice(i, 1);
      exploser(m, null, true);
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
    for (const m of s.monstres) Object.assign(m, resoudreCollisions(m.x, m.z));
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
    if (estPraticable(x, z)) {
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
      const { poteau, prochaineExplosion } = s;
      s = etatInitial();
      s.poteau = { ...poteau, porteur: null };
      // Les numéros d'explosion continuent : les autres ont gardé les anciens.
      s.prochaineExplosion = prochaineExplosion;
      s.manche = 1;
      s.protege = tirerProtege(membres, { aleatoire, roleSolo });
      s.precedent = s.protege;
      commencerManche();
      return true;
    },

    // joueurs : Map id → { x, z, r } (r = orientation du corps).
    pas(dt, joueurs) {
      if (s.protege && s.poteau.porteur === s.protege) s.poteau.porteur = null;
      suivrePorteur(joueurs);
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
        } else if (!s.boss && DUREE_MANCHE - s.reste >= apparitionBoss) {
          // L'heure du boss : il sort de la mer ; sa mort gagne la manche.
          appelerBoss();
        } else if (s.boss && !bossEnJeu()) {
          gagnerManche();
        }
      } else if (s.phase === 'pause') {
        s.reste -= dt;
        if (s.reste <= 0) commencerManche();
      } else if (s.phase === 'defaite') {
        s.reste -= dt;
        if (s.reste <= 0) {
          const { poteau, comptes, prochaineExplosion } = s;
          s = etatInitial();
          s.poteau = poteau;
          s.prochaineExplosion = prochaineExplosion;
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
      if (!j || Math.hypot(j.x - BOUTIQUE.x, j.z - BOUTIQUE.z) > DISTANCE_BOUTIQUE) return false;
      const c = compte(id);
      const bit = 1 << indice;
      if (c.armes & bit || c.argent < ARMES[indice].prix) return false;
      c.argent -= ARMES[indice].prix;
      c.armes |= bit;
      return true;
    },

    demanderPorter(id, joueurs) {
      if (s.poteau.porteur || id === s.protege || s.phase === 'defaite') return false;
      const j = joueurs.get(id);
      if (!j || Math.hypot(j.x - s.poteau.x, j.z - s.poteau.z) > DISTANCE_PORTER) return false;
      s.poteau.porteur = id;
      return true;
    },

    poser(id) {
      if (s.poteau.porteur !== id) return false;
      s.poteau.porteur = null;
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
        re: arrondi(s.reste, 1),
        pv: arrondi(s.pv, 1),
        pr: s.protege,
        po: [arrondi(s.poteau.x), arrondi(s.poteau.z), s.poteau.porteur],
        il: [arrondi(s.illumination, 1), arrondi(s.recharge, 1)],
        tu: s.tues,
        jo: Object.fromEntries(Object.entries(s.comptes).map(([id, c]) => [id, [c.argent, c.armes]])),
        m: s.monstres.map((m) => [m.id, arrondi(m.x), arrondi(m.z), arrondi(m.r), m.a ? 1 : 0, arrondi(m.pv, 1), arrondi(m.v), m.k ?? 0]),
        ex: s.explosions.map((e) => [e.id, arrondi(e.x), arrondi(e.z)]),
        bo: s.boss ? [s.boss.id, s.boss.pvMax, s.boss.cris] : null,
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
  };
}

function normaliserComptes(jo) {
  const comptes = {};
  if (!jo || typeof jo !== 'object') return comptes;
  for (const [id, v] of Object.entries(jo).slice(0, 8)) {
    if (id.length > 64 || !Array.isArray(v)) continue;
    const [argent, armes] = v;
    if (!Number.isInteger(argent) || argent < 0 || !Number.isInteger(armes)) continue;
    comptes[id] = { argent, armes: (armes & ((1 << ARMES.length) - 1)) | ARMES_DEPART };
  }
  return comptes;
}
