// La partie telle que la fait tourner l'hôte : manches, zombies, vie du
// protégé, poteau, Illumination. Aucun Three.js ni réseau : l'hôte appelle
// pas() à chaque image et diffuse instantane() ; si l'hôte s'en va, le
// suivant reprend avec charger(dernier instantané reçu).

import { estPraticable, rayonIle, resoudreCollisions } from './monde.js';
import {
  DEGATS_MONSTRE, DISTANCE_PORTER, DUREE_DEFAITE, DUREE_ILLUMINATION, DUREE_MANCHE, DUREE_PAUSE,
  MONSTRES_MAX, PORTEE_ATTAQUE, POTEAU_DEPART, PV_MONSTRE, PV_PROTEGE, RECHARGE_ILLUMINATION,
  monstresParMinute, positionPortee, tirerProtege, vitesseMonstre,
} from './regles.js';

export const PHASES = ['attente', 'manche', 'pause', 'defaite'];

const ESPACEMENT = 0.7;
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
  };
}

export function creerSimulation({ aleatoire = Math.random } = {}) {
  let s = etatInitial();
  let membres = [];
  let roleSolo = 'defenseur';

  function apparaitre() {
    // Sortie de l'eau, du côté opposé au poteau de préférence.
    let meilleur = null;
    for (let essai = 0; essai < 6; essai++) {
      const angle = aleatoire() * Math.PI * 2;
      const r = rayonIle(angle) * 1.16;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      const d = Math.hypot(x - s.poteau.x, z - s.poteau.z);
      if (!meilleur || d > meilleur.d) meilleur = { x, z, d };
      if (d > 18) break;
    }
    s.monstres.push({
      id: s.prochainId++,
      x: meilleur.x,
      z: meilleur.z,
      r: 0,
      pv: PV_MONSTRE,
      v: 0.85 + aleatoire() * 0.35,
      a: false,
    });
  }

  function commencerManche() {
    s.phase = 'manche';
    s.reste = DUREE_MANCHE;
    s.pv = PV_PROTEGE;
    s.monstres = [];
    // Un premier zombie arrive vite, pour que la manche démarre vraiment.
    s.cumul = 0.7;
  }

  function avancerMonstres(dt) {
    const vitesse = vitesseMonstre(s.manche);
    const { x: px, z: pz } = s.poteau;
    for (const m of s.monstres) {
      const dx = px - m.x, dz = pz - m.z;
      const d = Math.hypot(dx, dz);
      m.r = Math.atan2(dx, dz);
      if (d > PORTEE_ATTAQUE) {
        const pas = Math.min(vitesse * m.v * dt, d - PORTEE_ATTAQUE * 0.9);
        m.x += (dx / d) * pas;
        m.z += (dz / d) * pas;
        m.a = false;
      } else {
        m.a = true;
        s.pv -= DEGATS_MONSTRE * dt;
      }
    }
    // Les zombies se bousculent au lieu de s'empiler au même endroit.
    for (let i = 0; i < s.monstres.length; i++) {
      for (let j = i + 1; j < s.monstres.length; j++) {
        const a = s.monstres[i], b = s.monstres[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < ESPACEMENT && d > 1e-6) {
          const pousse = (ESPACEMENT - d) / 2;
          a.x -= (dx / d) * pousse;
          a.z -= (dz / d) * pousse;
          b.x += (dx / d) * pousse;
          b.z += (dz / d) * pousse;
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
      const poteau = s.poteau;
      s = etatInitial();
      s.poteau = { ...poteau, porteur: null };
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

      if (s.phase === 'manche') {
        s.reste -= dt;
        const ecoule = DUREE_MANCHE - s.reste;
        s.cumul += (monstresParMinute(s.manche, ecoule) / 60) * dt;
        while (s.cumul >= 1) {
          s.cumul -= 1;
          if (s.monstres.length < MONSTRES_MAX) apparaitre();
        }
        avancerMonstres(dt);
        if (s.pv <= 0) {
          s.pv = 0;
          s.phase = 'defaite';
          s.reste = DUREE_DEFAITE;
          s.poteau.porteur = null;
        } else if (s.reste <= 0) {
          s.phase = 'pause';
          s.reste = DUREE_PAUSE;
          s.monstres = [];
          s.manche += 1;
          s.protege = tirerProtege(membres, { aleatoire, roleSolo, precedent: s.precedent });
          s.precedent = s.protege;
          if (s.poteau.porteur === s.protege) s.poteau.porteur = null;
        }
      } else if (s.phase === 'pause') {
        s.reste -= dt;
        if (s.reste <= 0) commencerManche();
      } else if (s.phase === 'defaite') {
        s.reste -= dt;
        if (s.reste <= 0) {
          const poteau = s.poteau;
          s = etatInitial();
          s.poteau = poteau;
        }
      }
    },

    toucher(idMonstre, degats) {
      const i = s.monstres.findIndex((m) => m.id === idMonstre);
      if (i < 0 || !Number.isFinite(degats)) return false;
      const m = s.monstres[i];
      m.pv -= Math.min(Math.max(degats, 0), PV_MONSTRE * 2);
      if (m.pv > 0) return false;
      s.monstres.splice(i, 1);
      s.tues += 1;
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
        m: s.monstres.map((m) => [m.id, arrondi(m.x), arrondi(m.z), arrondi(m.r), m.a ? 1 : 0, arrondi(m.pv, 1), arrondi(m.v)]),
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
        monstres: i.monstres.map((m) => ({ ...m })),
        prochainId: i.monstres.reduce((max, m) => Math.max(max, m.id), 0) + 1,
      };
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
      pv: fini(m[5], PV_MONSTRE),
      v: fini(m[6], 1),
    }));
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
    monstres,
  };
}
