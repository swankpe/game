// Une partie du Protégé, côté navigateur : rôles, vue à la première personne,
// tirs, poteau, lanterne, ambiance et interface de jeu. Le navigateur hôte
// (premier du salon) fait en plus tourner la simulation et diffuse l'état du
// monde ; les autres l'affichent et envoient leurs actions.

import * as THREE from 'three';
import { creerArme } from './arme.js';
import { hauteurSol, hauteurTerrain } from './monde.js';
import { creerMonstresVue } from './monstres.js';
import { HAUTEUR_LANTERNE, creerPoteau } from './poteau.js';
import {
  CADENCE_TIR, DEGATS_TIR, DISTANCE_PORTER, MULTIPLICATEUR_TETE, PORTEE_TIR, POTEAU_DEPART, PV_PROTEGE, positionPortee,
} from './regles.js';
import { creerSimulation, normaliserMonde } from './simulation.js';
import { sonMort, sonTir, sonTouche } from './sons.js';
import { creerVue } from './vue.js';

const HAUTEUR_YEUX = 1.62;
const LEVEE_POTEAU = 0.3;
const FACTEUR_PORTEUR = 0.6;
const INTERVALLE_MONDE = 1 / 6;
const INTERVALLE_MONDE_CALME = 1;
const INTERVALLE_ETAT = 0.1;
const BATTEMENT_ETAT = 4;
const PORTEE_MANNEQUIN = 32;

const $ = (id) => document.getElementById(id);
const arrondi = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const vers = (depart, arrivee, pasMax) => {
  const d = angle(arrivee - depart);
  return depart + Math.max(-pasMax, Math.min(pasMax, d));
};
const minutes = (s) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const nombreValide = (v) => Number.isFinite(v) && Math.abs(v) < 1000;
const vecteurValide = (v) => Array.isArray(v) && v.length === 3 && v.every(nombreValide);

function mondeVide() {
  return {
    phase: 'attente', manche: 0, reste: 0, pv: PV_PROTEGE, protege: null,
    poteau: { x: POTEAU_DEPART.x, z: POTEAU_DEPART.z, porteur: null },
    illumination: 0, recharge: 0, tues: 0, monstres: [],
  };
}

// Distance jusqu'au sol le long d'un tir (les dunes arrêtent les balles).
function distanceSol(o, d, max) {
  for (let t = 0.5; t <= max; t += 0.5) {
    if (o.y + d[1] * t < hauteurTerrain(o.x + d[0] * t, o.z + d[2] * t)) return t;
  }
  return null;
}

export function creerJeu({ scene, camera, canvas, ile, clavier, joueur, avatars, envoyer }) {
  scene.add(camera);
  const vue = creerVue(canvas);
  const arme = creerArme(scene, camera);
  const monstres = creerMonstresVue(scene);
  const poteau = creerPoteau(scene);

  let monId = null;
  let membres = [];
  let sim = null;
  let dernierInstantane = null;
  let monde = mondeVide();
  let fps = false;
  let roleSolo = 'defenseur';
  let prochainMonde = 0;
  let urgent = false;
  let cadence = 0;
  let horloge = 0;
  let dernierEnvoi = -Infinity;
  let dernierEtat = null;
  let precedent = { phase: 'attente', manche: 0, protege: null, pv: PV_PROTEGE, illumination: 0 };
  let orientationPoteau = 0;
  const visee = { lacet: 0, tangage: -0.2 };
  let annonceFin = 0;
  let marqueurFin = 0;
  let degats = 0;

  const estHote = () => membres.length > 0 && membres[0].id === monId;
  const nomDe = (id) => membres.find((m) => m.id === id)?.nom ?? 'Quelqu’un';
  const role = () => (monde.phase === 'attente' ? 'libre' : monde.protege === monId ? 'protege' : 'defenseur');
  const jePorte = () => monde.poteau.porteur === monId;

  function positionsJoueurs() {
    const carte = avatars.positions();
    const e = joueur.etat;
    carte.set(monId, { x: e.x, z: e.z, r: e.orientation });
    return carte;
  }

  function annoncer(titre, detail = '', duree = 3.5) {
    $('annonce-titre').textContent = titre;
    $('annonce-detail').textContent = detail;
    $('annonce').hidden = false;
    annonceFin = horloge + duree;
  }

  // --- Actions du joueur local ---------------------------------------------

  function action(type, surHote) {
    if (sim) {
      if (surHote()) urgent = true;
    } else {
      envoyer({ type });
    }
  }

  function lancer() {
    if (monde.phase !== 'attente') return;
    if (sim) {
      sim.definirMembres(membres, { roleSolo });
      if (sim.demarrer()) urgent = true;
    } else {
      envoyer({ type: 'lancer' });
    }
  }

  function tirer() {
    cadence = CADENCE_TIR;
    const o = camera.getWorldPosition(new THREE.Vector3());
    const d = vue.direction();
    const portee = distanceSol(o, d, PORTEE_TIR) ?? PORTEE_TIR;
    const touche = monstres.toucher([o.x, o.y, o.z], d, portee);
    const distance = touche ? touche.distance : portee;
    const fin = new THREE.Vector3(o.x + d[0] * distance, o.y + d[1] * distance, o.z + d[2] * distance);
    const bouche = arme.tirer();
    arme.eclair(bouche);
    arme.trainee(bouche, fin);
    sonTir(1);
    const message = { type: 'tir', o: [bouche.x, bouche.y, bouche.z].map((v) => arrondi(v)), f: [fin.x, fin.y, fin.z].map((v) => arrondi(v)) };
    if (touche) {
      const dg = DEGATS_TIR * (touche.tete ? MULTIPLICATEUR_TETE : 1);
      monstres.secouer(touche.id);
      sonTouche(touche.tete);
      $('viseur').dataset.touche = touche.tete ? 'tete' : 'corps';
      marqueurFin = horloge + 0.15;
      if (sim) {
        if (sim.toucher(touche.id, dg)) urgent = true;
      } else {
        message.m = touche.id;
        message.dg = dg;
      }
    }
    envoyer(message);
  }

  function commandesLocales(dt) {
    const r = role();
    if (r !== 'protege' && clavier.consommer('KeyE')) {
      if (jePorte()) action('poser', () => sim.poser(monId));
      else if (pretAPorter()) action('porter', () => sim.demanderPorter(monId, positionsJoueurs()));
    }
    if (r === 'protege' && clavier.consommer('KeyF')) action('illuminer', () => sim.demanderIllumination(monId));
    if (monde.phase === 'attente' && clavier.consommer('Enter')) lancer();
    cadence -= dt;
    if (vue.etat.gachette && r !== 'protege' && !jePorte() && cadence <= 0) tirer();
  }

  function pretAPorter() {
    const e = joueur.etat;
    return (
      role() !== 'protege' && !monde.poteau.porteur && monde.phase !== 'defaite' &&
      Math.hypot(e.x - monde.poteau.x, e.z - monde.poteau.z) <= DISTANCE_PORTER
    );
  }

  // --- Envoi de sa position -----------------------------------------------

  function envoyerEtat(force) {
    if (!force && horloge - dernierEnvoi < INTERVALLE_ETAT) return;
    const e = joueur.etat;
    const etat = {
      type: 'etat',
      p: [arrondi(e.x), arrondi(e.y), arrondi(e.z)],
      r: arrondi(angle(e.orientation)),
      v: arrondi(e.vitesse, 1),
      vp: arrondi(vue.etat.tangage),
    };
    const inchange =
      dernierEtat && etat.p.every((v, i) => v === dernierEtat.p[i]) &&
      etat.r === dernierEtat.r && etat.v === dernierEtat.v && etat.vp === dernierEtat.vp;
    // Immobile : un simple rappel de temps en temps suffit.
    if (!force && inchange && horloge - dernierEnvoi < BATTEMENT_ETAT) return;
    envoyer(etat);
    dernierEnvoi = horloge;
    dernierEtat = etat;
  }

  // --- Poteau et lanterne --------------------------------------------------

  function placerPoteau(dt) {
    const { porteur } = monde.poteau;
    let x = monde.poteau.x, z = monde.poteau.z;
    if (porteur === monId) {
      const e = joueur.etat;
      ({ x, z } = positionPortee(e.x, e.z, e.orientation));
      orientationPoteau = e.orientation;
    } else if (porteur) {
      const p = avatars.positionDe(porteur);
      if (p) {
        ({ x, z } = positionPortee(p.x, p.z, p.r));
        orientationPoteau = p.r;
      }
    }
    const leve = porteur ? LEVEE_POTEAU : 0;
    const y = hauteurSol(x, z);
    const { protege } = monde;
    const distant = protege && protege !== monId ? avatars.positionDe(protege) : null;
    if (protege === monId) orientationPoteau = vue.etat.lacet + Math.PI;
    else if (distant) orientationPoteau = distant.r;
    poteau.placer(x, y, z, orientationPoteau, leve);
    poteau.occuper(monde.phase === 'attente' ? 'personne' : protege ? 'humain' : 'mannequin');

    // Lanterne : le protégé la dirige du regard, le mannequin suit le zombie
    // le plus proche.
    if (protege === monId) {
      poteau.orienter(vue.etat.lacet + Math.PI, vue.etat.tangage);
    } else if (distant) {
      poteau.orienter(distant.r, distant.vp);
      avatars.placer(protege, x, y + leve, z, distant.r);
    } else {
      let plus = null;
      for (const m of monstres.vivants()) {
        const d = Math.hypot(m.x - x, m.z - z);
        if (d < PORTEE_MANNEQUIN && (!plus || d < plus.d)) plus = { d, m };
      }
      if (plus) {
        const lacet = Math.atan2(plus.m.x - x, plus.m.z - z);
        const tangage = Math.atan2(plus.m.y + 1.2 - (y + HAUTEUR_LANTERNE), plus.d);
        visee.lacet = vers(visee.lacet, lacet, dt * 2.2);
        visee.tangage += (tangage - visee.tangage) * (1 - Math.exp(-dt * 4));
      } else {
        visee.lacet += dt * 0.4;
        visee.tangage += (-0.22 - visee.tangage) * (1 - Math.exp(-dt * 2));
      }
      poteau.orienter(visee.lacet, visee.tangage);
    }
    poteau.allumer(monde.phase === 'attente' ? 0 : 1);
    poteau.animer(dt);
    return { x, y, z, leve };
  }

  // --- Changements de phase ------------------------------------------------

  function suivreChangements() {
    const { phase, manche, protege, pv, illumination } = monde;
    if (phase !== precedent.phase || manche !== precedent.manche) {
      if (sim) urgent = true;
      if (phase === 'manche') {
        const detail =
          protege === monId ? "Tu es le protégé : dirige la lanterne, F pour l'Illumination."
            : protege ? `Protège ${nomDe(protege)} !` : 'Protège le mannequin !';
        annoncer(`Manche ${manche}`, detail);
      } else if (phase === 'pause') {
        const suivant = protege === monId ? 'toi' : protege ? nomDe(protege) : 'le mannequin';
        annoncer(`Manche ${manche - 1} gagnée !`, `Prochain protégé : ${suivant}`, 5);
      } else if (phase === 'defaite') {
        annoncer('Le protégé est tombé…', `Défaite à la manche ${manche}. ${monde.tues} zombies éliminés.`, 7);
      } else if (phase === 'attente' && precedent.phase === 'defaite') {
        annoncer('Retour au camp', 'Appuie sur Entrée pour relancer une partie.');
      }
    }
    // Libéré du poteau : on repart d'un pas devant lui.
    if (precedent.protege === monId && protege !== monId) {
      const o = orientationPoteau;
      joueur.teleporter(monde.poteau.x + Math.sin(o) * 1.6, monde.poteau.z + Math.cos(o) * 1.6, o);
    }
    if (protege === monId && precedent.protege !== monId) vue.orienter(orientationPoteau - Math.PI, 0);
    if (illumination > 0 && precedent.illumination <= 0 && phase === 'manche') {
      annoncer('Illumination !', "Toute l'île est éclairée pendant 30 secondes.", 2.5);
    }
    if (pv < precedent.pv && protege === monId) degats = 1;
    precedent = { phase, manche, protege, pv, illumination };
  }

  // --- Interface -----------------------------------------------------------

  function afficherInterface(dt) {
    const r = role();
    const enPartie = monde.phase !== 'attente';
    $('partie').hidden = !enPartie;
    $('vie').hidden = !enPartie;
    $('lancement').hidden = enPartie;
    $('modifier').hidden = enPartie;
    if (enPartie) {
      const chrono = monde.phase === 'manche' ? minutes(monde.reste) : monde.phase === 'pause' ? `reprise dans ${Math.ceil(monde.reste)} s` : '';
      $('manche').textContent = `Manche ${monde.phase === 'pause' ? monde.manche - 1 : monde.manche}`;
      $('chrono').textContent = chrono;
      $('tues').textContent = `${monde.tues} zombie${monde.tues > 1 ? 's' : ''} éliminé${monde.tues > 1 ? 's' : ''}`;
      $('vie-nom').textContent = monde.protege === monId ? 'Toi (protégé)' : monde.protege ? nomDe(monde.protege) : 'Mannequin';
      $('vie-barre').style.width = `${(monde.pv / PV_PROTEGE) * 100}%`;
      $('vie').dataset.danger = String(monde.pv < 35);
    } else {
      const seul = membres.length <= 1;
      $('texte-lancement').textContent = seul
        ? 'Tu es seul : parfait pour tester. Choisis ton rôle.'
        : `${membres.length} joueurs au camp. Le protégé sera tiré au sort.`;
      $('role-solo').hidden = !seul;
      for (const b of document.querySelectorAll('[data-role]')) b.setAttribute('aria-pressed', String(b.dataset.role === roleSolo));
    }

    const illum = $('illumination');
    if (r === 'protege' && monde.phase === 'manche') {
      illum.hidden = false;
      illum.textContent = monde.illumination > 0 ? `Illumination : ${Math.ceil(monde.illumination)} s`
        : monde.recharge > 0 ? `Illumination dans ${minutes(monde.recharge)}` : 'F : Illumination prête';
      illum.dataset.pret = String(monde.illumination <= 0 && monde.recharge <= 0);
    } else if (monde.illumination > 0 && enPartie) {
      illum.hidden = false;
      illum.textContent = `Illumination : ${Math.ceil(monde.illumination)} s`;
      illum.dataset.pret = 'false';
    } else {
      illum.hidden = true;
    }

    $('viseur').hidden = !fps || r === 'protege';
    if (horloge > marqueurFin) delete $('viseur').dataset.touche;
    $('reprendre').hidden = !fps || vue.etat.verrouille || vue.etat.impossible;
    $('annonce').hidden = horloge > annonceFin;

    const indication = $('indication');
    const indice = r === 'protege' ? '' : jePorte() ? 'E : poser le poteau' : pretAPorter() ? 'E : porter le poteau' : '';
    indication.textContent = indice;
    indication.hidden = !fps || !indice;

    $('aide').textContent =
      r === 'protege' ? 'Souris : diriger la lanterne · F : Illumination'
        : jePorte() ? 'Tu portes le poteau : pas de tir, tu avances moins vite'
          : 'ZQSD : marcher · Souris : viser · Clic : tirer · E : porter le poteau · Maj : courir · Échap : libérer la souris';

    degats = Math.max(0, degats - dt * 2.5);
    $('degats').style.opacity = String(degats * 0.8);
  }

  for (const b of document.querySelectorAll('[data-role]')) {
    b.addEventListener('click', () => (roleSolo = b.dataset.role));
  }
  $('lancer').addEventListener('click', lancer);

  return {
    get phase() {
      return monde.phase;
    },

    entrer() {
      fps = true;
      vue.activer(true);
      vue.orienter(joueur.etat.orientation - Math.PI, 0);
      clavier.oublier();
      envoyerEtat(true);
    },

    sortir() {
      fps = false;
      vue.activer(false);
      arme.afficher(false);
    },

    quitter() {
      this.sortir();
      sim = null;
      dernierInstantane = null;
      monde = mondeVide();
      precedent = { phase: 'attente', manche: 0, protege: null, pv: PV_PROTEGE, illumination: 0 };
      membres = [];
      monstres.vider();
      poteau.occuper('personne');
      poteau.allumer(0);
      ile.ambiance('jour');
    },

    // liste : membres admis, dans l'ordre du salon (le premier est l'hôte).
    surMembres(liste, id) {
      monId = id;
      membres = liste;
      if (estHote() && !sim) {
        sim = creerSimulation();
        // Nouvel hôte en cours de partie : on reprend le dernier état reçu.
        if (dernierInstantane) sim.charger(dernierInstantane);
        urgent = true;
      } else if (!estHote() && sim) {
        sim = null;
      }
      if (sim) {
        sim.definirMembres(liste, { roleSolo });
        urgent = true;
      }
    },

    surMessage(de, d) {
      if (!d || typeof d !== 'object') return;
      if (d.type === 'monde') {
        if (sim) return;
        const n = normaliserMonde(d);
        if (!n) return;
        dernierInstantane = d;
        monde = n;
        const vivants = monstres.nombre;
        monstres.appliquer(n.monstres);
        if (monstres.nombre < vivants && n.phase === 'manche') sonMort();
      } else if (d.type === 'tir') {
        if (!vecteurValide(d.o) || !vecteurValide(d.f)) return;
        const o = new THREE.Vector3(...d.o), f = new THREE.Vector3(...d.f);
        arme.eclair(o);
        arme.trainee(o, f);
        sonTir(Math.max(0, 0.6 - o.distanceTo(camera.position) / 70));
        if (Number.isInteger(d.m)) monstres.secouer(d.m);
        if (sim && Number.isInteger(d.m) && Number.isFinite(d.dg)) {
          if (sim.toucher(d.m, Math.min(d.dg, DEGATS_TIR * MULTIPLICATEUR_TETE))) urgent = true;
        }
      } else if (sim) {
        const faits = {
          porter: () => sim.demanderPorter(de, positionsJoueurs()),
          poser: () => sim.poser(de),
          illuminer: () => sim.demanderIllumination(de),
          lancer: () => {
            sim.definirMembres(membres, { roleSolo });
            return sim.demarrer();
          },
        };
        if (faits[d.type]?.()) urgent = true;
      }
    },

    envoyerEtat,

    // La main et la manche de l'arme prennent les couleurs du perso.
    definirApparence(apparence) {
      arme.definirCouleurs(apparence.peau, apparence.haut);
    },

    // Accès de test (adresse avec ?debug) : lire l'état, viser, se déplacer.
    debug() {
      return {
        etat: () => ({
          phase: monde.phase, manche: monde.manche, reste: monde.reste, pv: monde.pv, protege: monde.protege,
          porteur: monde.poteau.porteur, poteau: [monde.poteau.x, monde.poteau.z], tues: monde.tues,
          illumination: monde.illumination, recharge: monde.recharge, monId, hote: estHote(), role: role(),
          zombies: [...monstres.vivants()].map((p) => [p.x, p.y, p.z]),
          joueur: [joueur.etat.x, joueur.etat.y, joueur.etat.z],
          vue: { ...vue.etat },
        }),
        viser(x, y, z) {
          const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z;
          vue.orienter(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
        },
        teleporter: (x, z) => joueur.teleporter(x, z),
      };
    },

    // Appelé à chaque image tant qu'on est dans un salon. fps est faux quand
    // on retouche son perso : le monde continue, mais sans contrôle du joueur.
    mettreAJour(dt, { enJeu }) {
      horloge += dt;
      if (sim) {
        sim.pas(dt, positionsJoueurs());
        monde = sim.etat;
        const vivants = monstres.nombre;
        monstres.appliquer(monde.monstres, true);
        if (monstres.nombre < vivants && monde.phase === 'manche') sonMort();
        prochainMonde -= dt;
        if (urgent || prochainMonde <= 0) {
          const calme = monde.phase === 'attente' && !monde.poteau.porteur;
          envoyer(sim.instantane());
          prochainMonde = calme ? INTERVALLE_MONDE_CALME : INTERVALLE_MONDE;
          urgent = false;
        }
      } else {
        monde.reste = Math.max(0, monde.reste - dt);
        monde.illumination = Math.max(0, monde.illumination - dt);
        monde.recharge = Math.max(0, monde.recharge - dt);
      }
      suivreChangements();

      if (fps !== enJeu) enJeu ? this.entrer() : this.sortir();
      if (fps) commandesLocales(dt);
      else clavier.oublier();

      const r = role();
      if (fps && r !== 'protege') {
        joueur.mettreAJour(dt, clavier.commandes(), vue.etat.lacet, {
          orientation: vue.etat.lacet + Math.PI,
          facteur: jePorte() ? FACTEUR_PORTEUR : 1,
        });
      }
      const porteur = monde.poteau.porteur;
      avatars.mettreAJour(dt, (id) => {
        if (monde.phase !== 'attente' && id === monde.protege) return 'attache';
        if (id === porteur) return 'porte';
        return 'arme';
      });
      const p = placerPoteau(dt);
      if (r === 'protege') {
        // Ligoté : on suit le poteau, même quand un défenseur le porte.
        const e = joueur.etat;
        e.x = p.x;
        e.z = p.z;
        e.y = p.y + p.leve;
        e.vitesse = 0;
        e.orientation = vue.etat.lacet + Math.PI;
      }
      if (fps) {
        const e = joueur.etat;
        vue.appliquer(camera, e.x, e.y + HAUTEUR_YEUX, e.z);
      }
      arme.afficher(fps && r !== 'protege' && !jePorte());
      arme.mettreAJour(dt, joueur.etat.vitesse);
      monstres.mettreAJour(dt, !!sim);

      ile.ambiance(monde.phase === 'attente' ? 'jour' : monde.illumination > 0 ? 'illumination' : 'nuit');
      if (fps || r === 'protege') envoyerEtat(false);
      afficherInterface(dt);
    },
  };
}
