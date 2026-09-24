// Une partie du Protégé, côté navigateur : vue à la première personne, tirs
// et chiffres de dégâts, Lucie sur son poteau (on la porte, on la pose sur
// l'autel), lanterne, coups reçus et relève, nourriture, étoiles, ambiance et
// interface de jeu. Le navigateur hôte (premier du salon) fait en plus
// tourner la simulation et diffuse l'état du monde ; les autres l'affichent
// et envoient leurs actions.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { genererApercus } from './apercus.js';
import { creerArme } from './arme.js';
import { creerChiffres } from './chiffres.js';
import { creerEtoilesVue } from './etoiles.js';
import { creerParticules } from './particules.js';
import { CARTES, activerCarte, carte, carteDEtape } from './monde.js';
import { creerMonstresVue } from './monstres.js';
import { creerMusique } from './musique.js';
import { HAUTEUR_LANTERNE, creerPoteau } from './poteau.js';
import { creerProjectiles } from './projectiles.js';
import {
  ARMES, ARMES_DEPART, BONUS_BOSS, BONUS_DEGATS_MAX, BOSS, ESSAI, DISPERSION_MOUVEMENT, DISPERSION_SAUT, DISTANCE_BOUTIQUE,
  DISTANCE_PORTER, ETOILES, EXPLOSION_BOUFFI, JOUEUR, LANTERNE, MULTIPLICATEUR_TETE, NIVEAU_LANTERNE_MAX, NOM_PROTEGE,
  POTEAU_DEPART, PV_PROTEGE, TYPES_ZOMBIES, VIVRES, armeAmelioree, degatsExplosion, indiceArme, indiceVivre, positionPortee,
} from './regles.js';
import { PHASES_ECLAIREES, creerSimulation, normaliserMonde } from './simulation.js';
import {
  sonCaisse, sonCoupRecu, sonEclatement, sonEtoile, sonExplosion, sonManger, sonMort, sonRecharge, sonRituel, sonRugissement,
  sonTir, sonTouche, sonVictoire, sonVide,
} from './sons.js';
import { creerVue } from './vue.js';

const HAUTEUR_YEUX = 1.62;
// À terre : les yeux au ras du sol, la vue penchée.
const HAUTEUR_YEUX_TERRE = 0.38;
const LEVEE_POTEAU = 0.3;
const FACTEUR_PORTEUR = 0.6;
const INTERVALLE_MONDE = 1 / 6;
const INTERVALLE_MONDE_CALME = 1;
const INTERVALLE_ETAT = 0.1;
const BATTEMENT_ETAT = 4;
const PORTEE_LANTERNE = 32;
// Hauteur du disque de l'autel : Lucie s'y tient debout.
const HAUTEUR_AUTEL = 0.12;
// Les tirs partent en paquets : un Uzi tire 14 balles par seconde, un message
// par balle épuiserait vite le quota de Supabase.
const INTERVALLE_TIRS = 0.1;
const TIRS_MAX = 24;
// Plafonds des dégâts reçus du réseau : balle dans la tête, arme au plus haut niveau.
const DEGATS_BALLE_MAX = Math.max(...ARMES.filter((a) => !a.projectile).map((a) => a.degats)) * MULTIPLICATEUR_TETE * BONUS_DEGATS_MAX;
const GRENADE = ARMES[indiceArme('lance')];
// Bruits du rechargement, en fraction de sa durée : chargeur sorti, chargeur
// engagé, culasse armée.
const ETAPES_RECHARGE = [0.22, 0.62, 0.86];
// Une explosion déjà montrée n'est plus rejouée (elle reste 1,5 s dans les
// instantanés) ; on l'oublie un peu après.
const MEMOIRE_EXPLOSION = 2.5;
// Phases où les zombies attaquent.
const COMBAT = ['assaut', 'rituel', 'boss'];
// Chargeurs pleins, à la taille de chaque arme améliorée.
const pleins = (niveaux = []) => Object.fromEntries(ARMES.map((a, i) => [a.id, armeAmelioree(a, niveaux[i]).chargeur]));
const NIVEAUX_VIDES = ARMES.map(() => 0);
const VIVRES_VIDES = VIVRES.map(() => 0);
const etoilesTexte = (n) => '★'.repeat(n);
const svg = (contenu) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160">${contenu}</svg>`)}`;
// Vignettes de l'armurerie, dessinées en SVG : la lanterne, les vivres.
const IMAGE_LANTERNE = svg(`<defs><radialGradient id="h"><stop offset="0" stop-color="#ffe7a3" stop-opacity=".9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
<linearGradient id="f" x1="0" x2="1"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".75"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></linearGradient></defs>
<path d="M150 80 L320 20 L320 140 Z" fill="url(#f)"/><circle cx="118" cy="80" r="62" fill="url(#h)"/>
<rect x="96" y="44" width="44" height="72" rx="8" fill="#2d2f36"/><rect x="104" y="56" width="28" height="48" rx="4" fill="#ffd98a"/>
<rect x="92" y="36" width="52" height="10" rx="4" fill="#1e2025"/><rect x="92" y="114" width="52" height="10" rx="4" fill="#1e2025"/>
<path d="M104 36 Q118 14 132 36" stroke="#1e2025" stroke-width="6" fill="none"/>`);
const IMAGES_VIVRES = {
  pomme: svg(`<ellipse cx="160" cy="140" rx="60" ry="8" fill="#000" opacity=".25"/>
<path d="M160 52 C120 30 88 60 96 98 C102 128 128 146 160 136 C192 146 218 128 224 98 C232 60 200 30 160 52 Z" fill="#c8302a"/>
<path d="M118 70 C110 84 112 100 120 110" stroke="#f0786a" stroke-width="8" fill="none" stroke-linecap="round"/>
<path d="M160 52 C160 40 164 30 172 22" stroke="#5a3a22" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M170 34 C186 18 208 20 214 30 C198 42 182 42 170 34 Z" fill="#5a9a3a"/>`),
  ragout: svg(`<ellipse cx="160" cy="146" rx="76" ry="8" fill="#000" opacity=".25"/>
<path d="M112 34 C104 22 120 16 112 4 M160 30 C152 18 168 12 160 0 M208 34 C200 22 216 16 208 4" stroke="#e8e0cf" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>
<path d="M84 64 H236 L224 128 C220 140 208 144 196 144 H124 C112 144 100 140 96 128 Z" fill="#3a3a3e"/>
<ellipse cx="160" cy="64" rx="76" ry="16" fill="#2a2a2e"/><ellipse cx="160" cy="64" rx="66" ry="11" fill="#9a4a22"/>
<circle cx="138" cy="62" r="7" fill="#e58a36"/><circle cx="170" cy="66" r="6" fill="#6b9a3a"/><circle cx="186" cy="60" r="7" fill="#d9b56c"/>
<path d="M76 78 H62 M244 78 H258" stroke="#2a2a2e" stroke-width="10" stroke-linecap="round"/>`),
};
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
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const nombreValide = (v) => Number.isFinite(v) && Math.abs(v) < 1000;
const vecteurValide = (v) => Array.isArray(v) && v.length === 3 && v.every(nombreValide);

// Réglages d'essai (regles.js) passés à la simulation de l'hôte.
function optionsSimulation() {
  if (!ESSAI.actif) return {};
  return { accalmie: ESSAI.accalmie, assaut: ESSAI.assaut, facteurPvBoss: ESSAI.pvBoss, argentDepart: ESSAI.argentDepart };
}

function mondeVide() {
  return {
    phase: 'attente', etape: 0, cycle: 0, carte: 0, reste: 0, pv: PV_PROTEGE, cause: null,
    poteau: { x: POTEAU_DEPART.x, z: POTEAU_DEPART.z, porteur: null },
    tues: 0, monstres: [], comptes: {}, explosions: [], boss: null, lanterne: 0, etoiles: [], vies: {},
  };
}

// Distance jusqu'au sol le long d'un tir (les dunes arrêtent les balles).
function distanceSol(o, d, max) {
  for (let t = 0.5; t <= max; t += 0.5) {
    if (o.y + d[1] * t < carte().solBalles(o.x + d[0] * t, o.z + d[2] * t)) return t;
  }
  return null;
}

export function creerJeu({ scene, camera, canvas, rendu, ile, clavier, joueur, avatars, envoyer }) {
  scene.add(camera);
  const vue = creerVue(canvas);
  const arme = creerArme(scene, camera);
  const monstres = creerMonstresVue(scene);
  const poteau = creerPoteau(scene);
  const projectiles = creerProjectiles(scene);
  const musique = creerMusique();
  const etoiles = creerEtoilesVue(scene);
  const particules = creerParticules(scene);
  const chiffres = creerChiffres(scene);
  // Ce qui gicle d'un zombie : du sang, de la bave pour un bouffi, de l'eau
  // croupie pour le Roi Noyé ; au sol, du sable sur l'île, de la terre ailleurs.
  const giclee = (type) => (type?.explosif ? 'bave' : type?.boss ? 'noye' : 'sang');
  const matiereSol = () => (carte().id === 'ile' ? 'sable' : 'sol');
  monstres.quandMeurt((position, type) => {
    particules.eclabousser(position, giclee(type), type.explosif ? 26 : 12);
    particules.flaque(position, giclee(type), 0.35 + type.largeur * 0.3);
  });
  const apercus = genererApercus(rendu, ARMES.map((a) => a.id));
  // La marque de l'autel, visible de loin : on sait où porter Lucie.
  const marqueAutel = document.createElement('div');
  marqueAutel.className = 'etiquette marque-autel';
  const objetAutel = new CSS2DObject(marqueAutel);
  objetAutel.visible = false;
  scene.add(objetAutel);

  let monId = null;
  let membres = [];
  let sim = null;
  let dernierInstantane = null;
  let monde = mondeVide();
  let fps = false;
  let prochainMonde = 0;
  let urgent = false;
  let cadence = 0;
  let horloge = 0;
  let dernierEnvoi = -Infinity;
  let dernierEtat = null;
  const neuf = () => ({ phase: 'attente', etape: 0, cycle: 0, pv: PV_PROTEGE, pvJoueur: JOUEUR.pv, terre: false });
  let precedent = neuf();
  let orientationPoteau = 0;
  const visee = { lacet: 0, tangage: -0.2 };
  let annonceFin = 0;
  let marqueurFin = 0;
  let degats = 0;
  let armeEquipee = 'pistolet';
  let tirsEnAttente = [];
  let prochainEnvoiTirs = 0;
  // Tirs reçus en paquet, rejoués étalés sur l'intervalle d'envoi.
  let tirsDifferes = [];
  let boutiqueOuverte = false;
  let argentPrecedent = 0;
  let armesPrecedentes = ARMES_DEPART;
  let vivresPrecedents = VIVRES_VIDES;
  let gainFin = 0;
  let infoTexte = '';
  let infoFin = 0;
  let secousse = 0;
  // Lucie attaquée : on prévient, pas plus d'une fois toutes les quelques secondes.
  let alerteLucie = 0;
  let lucieFrappee = 0;
  // Balles dans chaque chargeur, rechargement en cours { id, debut, duree, etape }.
  let munitions = pleins();
  let rechargement = null;
  // Dispersion ajoutée par la rafale en cours, qui se résorbe.
  let evasement = 0;
  const explosionsVues = new Map();
  const typesVus = new Set();
  // Alertes en attente (nouveaux types), montrées l'une après l'autre.
  let alertes = [];
  // Le boss tel qu'on l'a vu : pour annoncer son arrivée, ses cris, sa rage.
  let bossVu = { id: null, cris: 0, enrage: false };
  // Relève en cours d'un allié (id) telle qu'annoncée à l'hôte.
  let releveEnvoye = null;
  let niveauxPrecedents = NIVEAUX_VIDES;
  let lanternePrecedente = 0;
  // Vue à terre, de 0 (debout) à 1 (au sol), lissée.
  let chuteVue = 0;
  // Carte affichée (indice dans CARTES), et dernière position valable du
  // poteau porté.
  let carteAffichee = 0;
  let poteauPorte = null;

  const estHote = () => membres.length > 0 && membres[0].id === monId;
  const nomDe = (id) => membres.find((m) => m.id === id)?.nom ?? 'Quelqu’un';
  const enCombat = () => COMBAT.includes(monde.phase);
  const jePorte = () => monde.poteau.porteur === monId;
  const monCompte = () => monde.comptes?.[monId] ?? { argent: 0, armes: ARMES_DEPART, niveaux: NIVEAUX_VIDES, vivres: VIVRES_VIDES };
  const niveauDe = (id) => monCompte().niveaux?.[indiceArme(id)] ?? 0;
  const vivresDe = () => monCompte().vivres ?? VIVRES_VIDES;
  // La vie d'un défenseur, telle que l'hôte la tient ou que l'instantané la donne.
  const vieDe = (id) => {
    const v = monde.vies?.[id];
    if (!v) return { pv: JOUEUR.pv, terre: false, releve: 0, mange: false };
    return { pv: v.pv, terre: v.terre, releve: Math.max(v.releve ?? 0, (v.seul ?? 0) / JOUEUR.releveSeul), mange: v.mange ?? v.soin > 0 };
  };
  const aTerre = () => monde.phase !== 'attente' && vieDe(monId).terre;
  // Autres défenseurs dans la partie : sans eux, on se relève seul.
  const allies = () => membres.filter((m) => m.id !== monId).length;
  const possede = (id) => (monCompte().armes & (1 << indiceArme(id))) !== 0;
  const armesPossedees = () => ARMES.filter((a) => possede(a.id));
  const pretBoutique = () => {
    const e = joueur.etat;
    const { boutique } = carte();
    return monde.phase !== 'attente' && !jePorte() && Math.hypot(e.x - boutique.x, e.z - boutique.z) <= DISTANCE_BOUTIQUE;
  };
  const surAutel = (x, z) => {
    const { autel } = carte();
    return Math.hypot(x - autel.x, z - autel.z) <= autel.rayon;
  };

  function informer(texte, duree = 1.8) {
    infoTexte = texte;
    infoFin = horloge + duree;
  }

  // L'arme en main, avec ses améliorations (étoiles).
  const armeEnMain = () => armeAmelioree(ARMES[indiceArme(armeEquipee)], niveauDe(armeEquipee));

  function equiper(id) {
    if (!possede(id)) {
      const a = ARMES[indiceArme(id)];
      informer(`${a.nom} : à acheter à l’armurerie (${a.prix} $)`);
      return;
    }
    if (armeEquipee === id) return;
    // Changer d'arme interrompt le rechargement : le chargeur reste tel quel.
    rechargement = null;
    evasement = 0;
    armeEquipee = id;
    arme.equiper(id);
    envoyerEtat(true);
  }

  function recharger() {
    const a = armeEnMain();
    if (rechargement || munitions[a.id] >= a.chargeur) return;
    rechargement = { id: a.id, debut: horloge, duree: a.rechargement, etape: 0 };
    arme.recharger(a.rechargement);
  }

  function annulerRechargement() {
    if (!rechargement) return;
    rechargement = null;
    arme.annulerRecharge();
  }

  function suivreRechargement() {
    if (!rechargement) return;
    const f = (horloge - rechargement.debut) / rechargement.duree;
    while (rechargement.etape < ETAPES_RECHARGE.length && f >= ETAPES_RECHARGE[rechargement.etape]) {
      sonRecharge(rechargement.etape, rechargement.id);
      rechargement.etape += 1;
    }
    if (f >= 1) {
      munitions[rechargement.id] = armeAmelioree(ARMES[indiceArme(rechargement.id)], niveauDe(rechargement.id)).chargeur;
      rechargement = null;
    }
  }

  // Dispersion du prochain tir : l'arme, la rafale, le mouvement.
  function dispersionActuelle() {
    const a = armeEnMain();
    const e = joueur.etat;
    return a.dispersion + evasement + e.vitesse * DISPERSION_MOUVEMENT + (e.auSol === false ? DISPERSION_SAUT : 0);
  }

  function armeSuivante(sens) {
    const possedees = armesPossedees();
    const i = possedees.findIndex((a) => a.id === armeEquipee);
    equiper(possedees[(i + sens + possedees.length) % possedees.length].id);
  }

  // --- Nourriture ------------------------------------------------------------

  // Le repas qui convient : une pomme pour une égratignure, le ragoût pour
  // une vraie blessure (s'il en reste).
  function choisirRepas() {
    const vivres = vivresDe();
    const manque = JOUEUR.pv - vieDe(monId).pv;
    const pomme = indiceVivre('pomme'), ragout = indiceVivre('ragout');
    if (manque > VIVRES[pomme].soin && vivres[ragout] > 0) return 'ragout';
    if (vivres[pomme] > 0) return 'pomme';
    if (vivres[ragout] > 0) return 'ragout';
    return null;
  }

  function manger(id = choisirRepas()) {
    const v = vieDe(monId);
    if (v.pv >= JOUEUR.pv) {
      informer('Tu es en pleine forme.');
      return;
    }
    if (v.mange) {
      informer('Tu manges déjà…');
      return;
    }
    if (!id || !vivresDe()[indiceVivre(id)]) {
      informer('Rien à manger : achète des vivres à l’armurerie.');
      return;
    }
    if (sim) {
      if (sim.manger(monId, id)) urgent = true;
    } else {
      envoyer({ type: 'manger', vivre: id });
    }
  }

  function acheterVivre(id) {
    if (sim) {
      if (sim.acheterVivre(monId, id, positionsJoueurs())) urgent = true;
    } else {
      envoyer({ type: 'vivre', vivre: id });
    }
  }

  function positionsJoueurs() {
    const positions = avatars.positions();
    const e = joueur.etat;
    positions.set(monId, { x: e.x, z: e.z, r: e.orientation, ar: indiceArme(armeEquipee) });
    return positions;
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
      sim.definirMembres(membres);
      if (sim.demarrer()) urgent = true;
    } else {
      envoyer({ type: 'lancer' });
    }
  }

  // Direction du regard (recul compris), écartée au hasard dans le cône de
  // dispersion : un disque, comme les quatre traits du viseur.
  function directionTir(dispersion) {
    const angle = Math.random() * Math.PI * 2;
    const ecart = Math.sqrt(Math.random()) * dispersion;
    const l = vue.lacet + Math.cos(angle) * ecart;
    const t = vue.tangage + Math.sin(angle) * ecart;
    const c = Math.cos(t);
    return [-Math.sin(l) * c, Math.sin(t), -Math.cos(l) * c];
  }

  function tirer() {
    const a = armeEnMain();
    const dispersion = dispersionActuelle();
    cadence = a.cadence;
    munitions[a.id] -= 1;
    const bouche = arme.tirer();
    arme.eclair(bouche, a.projectile ? 1.6 : 1);
    sonTir(1, a.id);
    particules.fumee(bouche, a.projectile ? 0.1 : 0.035);
    const ejection = arme.ejection();
    if (ejection) particules.douille(ejection.position, ejection.vitesse);
    // Le recul relève le regard et l'écarte : en rafale, il s'accumule.
    vue.reculer(a.recul * (0.8 + Math.random() * 0.4), (Math.random() - 0.5) * 2 * a.reculLateral);
    evasement = Math.min(evasement + a.evasement, a.evasementMax);
    // Dernière balle : clic à vide, et le rechargement part tout seul.
    if (munitions[a.id] <= 0) {
      sonVide();
      recharger();
    }

    if (a.projectile) {
      const d = directionTir(dispersion);
      const v = new THREE.Vector3(d[0], d[1], d[2]).multiplyScalar(a.vitesse).add(new THREE.Vector3(0, 1.5, 0));
      projectiles.lancer(bouche, v, true);
      envoyer({ type: 'grenade', o: [bouche.x, bouche.y, bouche.z].map((x) => arrondi(x)), v: [v.x, v.y, v.z].map((x) => arrondi(x)) });
      return;
    }

    const o = camera.getWorldPosition(new THREE.Vector3());
    const d = directionTir(dispersion);
    const sol = distanceSol(o, d, a.portee);
    const portee = sol ?? a.portee;
    const touche = monstres.toucher([o.x, o.y, o.z], d, portee);
    const distance = touche ? touche.distance : portee;
    const fin = new THREE.Vector3(o.x + d[0] * distance, o.y + d[1] * distance, o.z + d[2] * distance);
    arme.trainee(bouche, fin);
    const sens = new THREE.Vector3(d[0], d[1], d[2]);
    if (touche) particules.impact(fin, sens, giclee(monstres.typeDe(touche.id)));
    else if (sol !== null) particules.impact(fin, sens, matiereSol());
    const tir = [bouche.x, bouche.y, bouche.z, fin.x, fin.y, fin.z].map((x) => arrondi(x));
    if (touche) {
      const dg = a.degats * (touche.tete ? MULTIPLICATEUR_TETE : 1);
      monstres.secouer(touche.id);
      sonTouche(touche.tete);
      chiffres.montrer(fin, dg, touche.tete ? 'tete' : 'corps');
      $('viseur').dataset.touche = touche.tete ? 'tete' : 'corps';
      marqueurFin = horloge + 0.15;
      if (sim) {
        if (sim.toucher(touche.id, dg, monId)) urgent = true;
      } else {
        tir.push(touche.id, dg);
      }
    }
    if (tirsEnAttente.length < TIRS_MAX) tirsEnAttente.push(tir);
  }

  function envoyerTirs() {
    if (!tirsEnAttente.length || horloge < prochainEnvoiTirs) return;
    envoyer({ type: 'tirs', ar: indiceArme(armeEquipee), l: tirsEnAttente });
    tirsEnAttente = [];
    prochainEnvoiTirs = horloge + INTERVALLE_TIRS;
  }

  // Effet d'une explosion, grenade ou bouffi : lumière, son, secousse.
  function effetExplosion(position, rayon, genre) {
    arme.explosion(position, rayon, genre);
    particules.eclabousser(position, genre === 'bouffi' ? 'bave' : matiereSol(), genre === 'bouffi' ? 30 : 20);
    for (let i = 0; i < 4; i++) particules.fumee(position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.3, (Math.random() - 0.5) * 2)), 0.5);
    const distance = position.distanceTo(camera.position);
    const volume = Math.max(0.15, 1 - distance / 60);
    if (genre === 'bouffi') sonEclatement(volume);
    else sonExplosion(volume);
    secousse = Math.max(secousse, 1 - distance / 18);
  }

  function exploser(position, locale) {
    effetExplosion(position, GRENADE.rayon, 'grenade');
    if (!locale) return;
    // Seul le tireur compte les dégâts de sa grenade (améliorée par ses étoiles).
    const lance = armeAmelioree(GRENADE, niveauDe('lance'));
    const cibles = monstres.autourDe(position, GRENADE.rayon)
      .map(({ id, distance: d }) => [id, degatsExplosion(lance, d)])
      .filter(([, dg]) => dg > 0)
      .slice(0, 30);
    const ou = new Map(monstres.cibles().map((c) => [c.id, c]));
    for (const [id, dg] of cibles) {
      monstres.secouer(id);
      const c = ou.get(id);
      if (c) chiffres.montrer(new THREE.Vector3(c.x, c.y + 1.7 * (c.h ?? 1), c.z), dg, 'grenade');
    }
    if (sim) {
      for (const [id, dg] of cibles) if (sim.toucher(id, dg, monId)) urgent = true;
    } else if (cibles.length) {
      envoyer({ type: 'explosion', c: cibles });
    }
  }

  // Bouffis éclatés : l'hôte les annonce dans l'instantané, chacun les montre
  // une fois. Les dégâts, eux, sont déjà comptés par la simulation.
  function jouerExplosions() {
    for (const e of monde.explosions ?? []) {
      if (explosionsVues.has(e.id)) continue;
      explosionsVues.set(e.id, horloge);
      if (sim) urgent = true;
      const y = carte().solGrenades(e.x, e.z) + 1;
      effetExplosion(new THREE.Vector3(e.x, y, e.z), EXPLOSION_BOUFFI.rayon, 'bouffi');
    }
    for (const [id, quand] of explosionsVues) if (horloge - quand > MEMOIRE_EXPLOSION) explosionsVues.delete(id);
  }

  // Premier colosse, premier bouffi de la partie : on prévient.
  function signalerNouveauxTypes() {
    if (!enCombat()) {
      alertes = [];
      return;
    }
    for (const k of monstres.types()) {
      if (typesVus.has(k)) continue;
      typesVus.add(k);
      if (TYPES_ZOMBIES[k]?.alerte) alertes.push(TYPES_ZOMBIES[k].alerte);
    }
    if (alertes.length && horloge >= infoFin) informer(alertes.shift(), 3);
  }

  // --- Boss de chaque carte -------------------------------------------------

  // Le boss vivant et ses caractéristiques, ou null.
  function bossEnJeu() {
    const info = monde.boss;
    if (!info || monde.phase !== 'boss') return null;
    const m = monde.monstres.find((x) => x.id === info.id);
    return m ? { ...info, pv: Math.max(0, m.pv), x: m.x, z: m.z } : null;
  }

  // Arrivée, cris et rage du boss ; sa musique tant qu'il vit.
  function suivreBoss() {
    const b = bossEnJeu();
    if (!b) {
      musique.arreter();
      monstres.enrager(false);
      return;
    }
    const proximite = Math.max(0.35, 1 - Math.hypot(b.x - camera.position.x, b.z - camera.position.z) / 80);
    if (bossVu.id !== b.id) {
      bossVu = { id: b.id, cris: b.cris, enrage: false };
      annoncer(BOSS.nom, `${carte().sortieBoss} Abattez-le en ${minutes(monde.reste)}, sinon tout est perdu.`, 4);
      sonRugissement(proximite);
      secousse = Math.max(secousse, 0.7);
      if (sim) urgent = true;
    }
    if (b.cris > bossVu.cris) {
      bossVu.cris = b.cris;
      monstres.rugir(b.id);
      sonRugissement(proximite * 0.8);
      informer(`${BOSS.nom} appelle la horde !`, 2.5);
    }
    const enrage = b.pv <= b.pvMax * BOSS.enrage;
    if (enrage && !bossVu.enrage) {
      bossVu.enrage = true;
      sonRugissement(proximite);
      informer(`${BOSS.nom} enrage !`, 2.5);
    }
    monstres.enrager(enrage);
    musique.enrager(enrage);
    musique.jouer();
  }

  // --- Armurerie -----------------------------------------------------------

  const cartes = new Map();
  function carteBoutique(image, nom, description, detail, surClic, classe = '') {
    const carte = document.createElement('article');
    carte.className = `arme-carte ${classe}`;
    const img = document.createElement('img');
    img.src = image;
    img.alt = '';
    const titre = document.createElement('h3');
    titre.textContent = nom;
    const texte = document.createElement('p');
    texte.textContent = description;
    const ligne = document.createElement('p');
    ligne.className = 'chargeur';
    ligne.textContent = detail;
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'principal';
    bouton.addEventListener('click', surClic);
    carte.append(img, titre, texte, ligne);
    $('boutique-armes').append(carte);
    return { carte, bouton, titre, ligne };
  }

  function construireBoutique() {
    const max = {
      puissance: Math.max(...ARMES.map((a) => a.degats / a.cadence)),
      cadence: Math.max(...ARMES.map((a) => 1 / a.cadence)),
      portee: Math.max(...ARMES.map((a) => a.portee)),
    };
    for (const a of ARMES) {
      const secondes = String(a.rechargement).replace('.', ',');
      const c = carteBoutique(apercus[a.id], a.nom, a.description, `${a.projectile ? 'Barillet' : 'Chargeur'} de ${a.chargeur} · rechargement ${secondes} s`, () => acheterOuEquiper(a.id));
      const stats = document.createElement('dl');
      for (const [nom, valeur] of [
        ['Puissance', a.degats / a.cadence / max.puissance],
        ['Cadence', 1 / a.cadence / max.cadence],
        ['Précision', 1 - a.dispersion / 0.035],
        ['Portée', a.portee / max.portee],
      ]) {
        const ligne = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = nom;
        const dd = document.createElement('dd');
        const barre = document.createElement('span');
        barre.style.setProperty('--valeur', String(Math.max(0.08, Math.min(1, valeur))));
        dd.append(barre);
        ligne.append(dt, dd);
        stats.append(ligne);
      }
      c.carte.append(stats, c.bouton);
      cartes.set(a.id, c);
    }
    // Les vivres : de quoi se soigner entre deux vagues.
    for (const v of VIVRES) {
      const c = carteBoutique(IMAGES_VIVRES[v.id], v.nom, v.description, '', () => acheterVivre(v.id), 'carte-vivre');
      c.carte.append(c.bouton);
      cartes.set(v.id, c);
    }
    // La lanterne de Lucie : une amélioration pour toute l'équipe.
    const l = carteBoutique(IMAGE_LANTERNE, `Lanterne de ${NOM_PROTEGE}`, 'Pour toute l’équipe : un faisceau plus long, plus large, plus fort, et la nuit recule.', '', ameliorerLanterne, 'carte-lanterne');
    l.carte.append(l.bouton);
    cartes.set('lanterne', l);
  }

  function ameliorerLanterne() {
    if (sim) {
      if (sim.ameliorerLanterne(monId, positionsJoueurs())) urgent = true;
    } else {
      envoyer({ type: 'lanterne' });
    }
  }

  function rafraichirBoutique() {
    const { argent } = monCompte();
    $('boutique-argent').textContent = `${argent} $`;
    for (const a of ARMES) {
      const { carte, bouton, titre } = cartes.get(a.id);
      const achetee = possede(a.id);
      carte.dataset.etat = armeEquipee === a.id ? 'equipee' : achetee ? 'achetee' : argent >= a.prix ? 'abordable' : 'chere';
      bouton.disabled = armeEquipee === a.id || (!achetee && argent < a.prix);
      bouton.textContent = armeEquipee === a.id ? 'En main' : achetee ? 'Prendre en main' : `Acheter · ${a.prix} $`;
      const n = niveauDe(a.id);
      titre.textContent = n ? `${a.nom} ${etoilesTexte(n)}` : a.nom;
    }
    const vivres = vivresDe();
    for (const [i, v] of VIVRES.entries()) {
      const { carte, bouton, ligne } = cartes.get(v.id);
      const n = vivres[i] ?? 0;
      ligne.textContent = `Dans ton sac : ${n} / ${v.max} · F pour manger`;
      carte.dataset.etat = n >= v.max ? 'equipee' : argent >= v.prix ? 'abordable' : 'chere';
      bouton.disabled = n >= v.max || argent < v.prix;
      bouton.textContent = n >= v.max ? 'Sac plein' : `Acheter · ${v.prix} $`;
    }
    const l = cartes.get('lanterne');
    const n = monde.lanterne ?? 0;
    const prix = LANTERNE.prix[n];
    l.ligne.textContent = `Niveau ${n} / ${NIVEAU_LANTERNE_MAX} · la nuit s’ouvre à ${LANTERNE.brouillard[n]} m`;
    l.carte.dataset.etat = n >= NIVEAU_LANTERNE_MAX ? 'equipee' : argent >= prix ? 'abordable' : 'chere';
    l.bouton.disabled = n >= NIVEAU_LANTERNE_MAX || argent < prix;
    l.bouton.textContent = n >= NIVEAU_LANTERNE_MAX ? 'Au plus haut' : `Améliorer · ${prix} $`;
  }

  function acheterOuEquiper(id) {
    if (possede(id)) {
      equiper(id);
    } else if (sim) {
      if (sim.acheter(monId, id, positionsJoueurs())) urgent = true;
    } else {
      envoyer({ type: 'acheter', arme: id });
    }
  }

  function ouvrirBoutique() {
    boutiqueOuverte = true;
    vue.activer(false);
    $('boutique').hidden = false;
    rafraichirBoutique();
  }

  function fermerBoutique() {
    if (!boutiqueOuverte) return;
    boutiqueOuverte = false;
    $('boutique').hidden = true;
    if (fps) vue.activer(true);
  }

  construireBoutique();
  const primes = TYPES_ZOMBIES.filter((t) => !t.boss).map((t) => t.recompense);
  $('boutique-regle').textContent = `${Math.min(...primes)} à ${Math.max(...primes)} $ par zombie selon le type, ${BONUS_BOSS} $ par boss abattu`;
  $('boutique-fermer').addEventListener('click', fermerBoutique);

  // L'inventaire, au milieu en bas : les armes qu'on possède, puis les vivres.
  const cases = new Map();
  function caseInventaire(parent, image, nom, surClic) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'case-arme';
    const img = document.createElement('img');
    img.src = image;
    img.alt = nom;
    const touche = document.createElement('span');
    touche.className = 'touche';
    const niveau = document.createElement('span');
    niveau.className = 'niveau';
    c.append(img, touche, niveau);
    c.addEventListener('click', surClic);
    parent.append(c);
    return c;
  }
  for (const a of ARMES) cases.set(a.id, caseInventaire($('barre-armes'), apercus[a.id], a.nom, () => equiper(a.id)));
  for (const v of VIVRES) {
    const c = caseInventaire($('barre-vivres'), IMAGES_VIVRES[v.id], v.nom, () => manger(v.id));
    c.classList.add('case-vivre');
    c.querySelector('.touche').textContent = 'F';
    cases.set(v.id, c);
  }
  canvas.addEventListener('wheel', (e) => {
    if (fps && !boutiqueOuverte) armeSuivante(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  // Allié à terre à portée de relève, ou null.
  function allieARelever() {
    if (aTerre() || jePorte() || !enCombat()) return null;
    const e = joueur.etat;
    let proche = null;
    for (const [id, v] of Object.entries(monde.vies ?? {})) {
      if (!v.terre || id === monId) continue;
      const p = avatars.positionDe(id);
      const d = p ? Math.hypot(p.x - e.x, p.z - e.z) : Infinity;
      if (d <= JOUEUR.distanceReleve && (!proche || d < proche.d)) proche = { id, d };
    }
    return proche?.id ?? null;
  }

  // On relève tant que E reste enfoncé : l'hôte est prévenu au début et à la fin.
  function annoncerReleve(cible) {
    if (cible === releveEnvoye) return;
    releveEnvoye = cible;
    if (sim) sim.demanderRelever(monId, cible);
    else envoyer({ type: 'relever', cible });
  }

  function commandesLocales(dt) {
    cadence -= dt;
    if (boutiqueOuverte) {
      if (clavier.consommer('KeyE') || clavier.consommer('Escape')) fermerBoutique();
      if (clavier.consommer('KeyF')) manger();
      return;
    }
    // À terre : plus rien d'autre que regarder autour de soi.
    if (aTerre()) {
      for (const code of ['KeyE', 'KeyR', 'KeyF', 'Enter']) clavier.consommer(code);
      annoncerReleve(null);
      return;
    }
    const aRelever = allieARelever();
    annoncerReleve(aRelever && clavier.enfoncee('KeyE') ? aRelever : null);
    if (aRelever) clavier.consommer('KeyE');
    if (clavier.consommer('KeyE')) {
      if (jePorte()) action('poser', () => sim.poser(monId));
      else if (pretBoutique()) ouvrirBoutique();
      else if (pretAPorter()) action('porter', () => sim.demanderPorter(monId, positionsJoueurs()));
    }
    // Les touches 1, 2… vont aux armes possédées, dans l'ordre.
    const possedees = armesPossedees();
    for (let i = 0; i < ARMES.length; i++) {
      if (clavier.consommer(`Digit${i + 1}`) && possedees[i]) equiper(possedees[i].id);
    }
    if (clavier.consommer('KeyF') && monde.phase !== 'attente') manger();
    if (monde.phase === 'attente' && clavier.consommer('Enter')) lancer();
    const enMain = !jePorte();
    if (enMain && clavier.consommer('KeyR')) recharger();
    // Chargeur vide (après un changement d'arme, par exemple) : on recharge.
    if (enMain && munitions[armeEquipee] <= 0 && arme.prete()) recharger();
    if (vue.etat.gachette && enMain && !rechargement && munitions[armeEquipee] > 0 && cadence <= 0 && arme.prete()) tirer();
  }

  function pretAPorter() {
    const e = joueur.etat;
    const c = carte();
    return (
      !monde.poteau.porteur && !['attente', 'defaite', 'rituel', 'victoire'].includes(monde.phase) &&
      Math.hypot(e.x - monde.poteau.x, e.z - monde.poteau.z) <= DISTANCE_PORTER &&
      Math.abs(c.hauteurSol(e.x, e.z) - c.hauteurSol(monde.poteau.x, monde.poteau.z)) < 1
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
      ar: indiceArme(armeEquipee),
    };
    const inchange =
      dernierEtat && etat.p.every((v, i) => v === dernierEtat.p[i]) &&
      etat.r === dernierEtat.r && etat.v === dernierEtat.v && etat.vp === dernierEtat.vp && etat.ar === dernierEtat.ar;
    // Immobile : un simple rappel de temps en temps suffit.
    if (!force && inchange && horloge - dernierEnvoi < BATTEMENT_ETAT) return;
    envoyer(etat);
    dernierEnvoi = horloge;
    dernierEtat = etat;
  }

  // --- Lucie, son poteau et sa lanterne ------------------------------------

  function placerPoteau(dt) {
    const { porteur } = monde.poteau;
    let x = monde.poteau.x, z = monde.poteau.z;
    // Le poteau porté suit son porteur, à son niveau (même règle que l'hôte).
    const porte = (px, pz, r) => {
      const p = positionPortee(px, pz, r);
      const c = carte();
      if (c.estPraticable(p.x, p.z) && Math.abs(c.hauteurSol(p.x, p.z) - c.hauteurSol(px, pz)) < 1) poteauPorte = p;
      orientationPoteau = r;
      return poteauPorte ?? { x, z };
    };
    if (porteur === monId) {
      const e = joueur.etat;
      ({ x, z } = porte(e.x, e.z, e.orientation));
    } else if (porteur) {
      const p = avatars.positionDe(porteur);
      if (p) ({ x, z } = porte(p.x, p.z, p.r));
    } else {
      poteauPorte = null;
    }
    const leve = porteur ? LEVEE_POTEAU : 0;
    // Sur l'autel, elle se tient sur le disque de pierre.
    const y = carte().hauteurSol(x, z) + (!porteur && surAutel(x, z) ? HAUTEUR_AUTEL : 0);
    poteau.placer(x, y, z, orientationPoteau, leve);
    poteau.occuper(true);
    poteau.vie(monde.pv / PV_PROTEGE, monde.phase !== 'attente');

    // La lanterne suit le zombie le plus proche ; sans zombie, elle balaie.
    let plus = null;
    for (const m of monstres.vivants()) {
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < PORTEE_LANTERNE && (!plus || d < plus.d)) plus = { d, m };
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
    poteau.allumer(monde.phase === 'attente' ? 0 : 1);
    poteau.animer(dt);
    return { x, y, z, leve };
  }

  // La marque de l'autel : visible de loin, tant qu'il reste à y porter Lucie.
  function placerMarqueAutel() {
    const { autel } = carte();
    const e = joueur.etat;
    const d = Math.hypot(e.x - autel.x, e.z - autel.z);
    const visible = fps && (monde.phase === 'accalmie' || monde.phase === 'assaut') && d > 6;
    objetAutel.visible = visible;
    if (!visible) return;
    objetAutel.position.set(autel.x, carte().hauteurSol(autel.x, autel.z) + 3.4, autel.z);
    marqueAutel.textContent = `Autel · ${Math.round(d)} m`;
  }

  function changerCarte(indice) {
    carteAffichee = indice;
    activerCarte(indice);
    ile.carte(indice);
    monstres.vider();
    etoiles.vider();
    projectiles.vider();
    chiffres.vider();
    poteauPorte = null;
    const a = carte().apparition;
    joueur.teleporter(a.x + (Math.random() - 0.5) * 4, a.z + (Math.random() - 0.5) * 2, a.orientation);
    if (fps) vue.orienter(a.orientation - Math.PI, 0);
    envoyerEtat(true);
  }

  // --- Changements de phase ------------------------------------------------

  function suivreChangements() {
    const { phase, etape, cycle, pv } = monde;
    if (phase !== precedent.phase || etape !== precedent.etape) {
      if (sim) urgent = true;
      const nouvelleCarte = phase === 'accalmie' && (precedent.phase === 'attente' || precedent.phase === 'victoire' || etape !== precedent.etape);
      if (nouvelleCarte) {
        annoncer(carte().nom, `Étape ${etape + 1} · ${carte().conseil}`, 5.5);
        alertes = [];
        informer(`Accalmie : ${Math.round(monde.reste)} s pour vous préparer à l’armurerie.`, 4);
        if (etape === 0) typesVus.clear();
      } else if (phase === 'accalmie') {
        annoncer('Accalmie', `La lumière revient, les zombies fuient : ${Math.round(monde.reste)} s pour vous ravitailler.`, 4);
      } else if (phase === 'assaut') {
        annoncer('Les zombies arrivent !', `Assaut ${cycle} · protégez ${NOM_PROTEGE}. Posée sur l’autel, elle appelle le boss.`, 3.5);
      } else if (phase === 'rituel') {
        annoncer('Le rituel commence…', `${NOM_PROTEGE} est sur l’autel : ${BOSS.nom} arrive !`, 3);
        sonRituel();
      } else if (phase === 'victoire') {
        const suite = CARTES[carteDEtape(etape + 1)].nom;
        annoncer(`${BOSS.nom} est vaincu !`, `+${BONUS_BOSS} $ pour chacun · en route vers ${suite}…`, 5);
        sonVictoire();
      } else if (phase === 'defaite') {
        const bilan = `${pluriel(monde.tues, 'zombie')} éliminé${monde.tues > 1 ? 's' : ''}.`;
        if (monde.cause === 'temps') annoncer('Trop tard…', `${BOSS.nom} n’a pas été abattu à temps. ${bilan}`, 7);
        else annoncer(`${NOM_PROTEGE} est tombée…`, `Défaite sur ${carte().nom}. ${bilan}`, 7);
      } else if (phase === 'attente' && precedent.phase === 'defaite') {
        annoncer('Retour au camp', 'Appuie sur Entrée pour relancer une partie.');
      }
      // Chaque accalmie : chargeurs pleins, on repart ravitaillé.
      if (phase === 'accalmie') {
        annulerRechargement();
        munitions = pleins(monCompte().niveaux);
      }
    }
    // Lucie attaquée : sa barre clignote, et l'on prévient de temps en temps.
    if (pv < precedent.pv - 0.05 && enCombat()) {
      lucieFrappee = horloge + 0.25;
      if (horloge > alerteLucie) {
        informer(`${NOM_PROTEGE} est attaquée !`, 1.6);
        alerteLucie = horloge + 8;
      }
    }
    // Coups reçus, mise à terre, relève.
    const v = vieDe(monId);
    if (v.pv < precedent.pvJoueur - 0.5 && enCombat()) {
      degats = 1;
      secousse = Math.max(secousse, 0.5);
      sonCoupRecu();
      if (!v.terre) informer(`Touché ! Il te reste ${Math.round(v.pv)} PV · F : manger pour te soigner.`, 2.4);
    }
    if (v.terre && !precedent.terre) {
      annulerRechargement();
      fermerBoutique();
      infoFin = 0;
    }
    if (!v.terre && precedent.terre && monde.phase !== 'attente') informer('Te revoilà debout !', 2);
    if (phase !== 'boss') bossVu = { id: null, cris: 0, enrage: false };
    precedent = { phase, etape, cycle, pv, pvJoueur: v.pv, terre: v.terre };

    // Argent gagné, arme achetée : on le montre, et la nouvelle arme passe en main.
    const { argent, armes } = monCompte();
    if (argent > argentPrecedent) {
      $('gain').textContent = `+${argent - argentPrecedent} $`;
      $('gain').classList.remove('anime');
      void $('gain').offsetWidth;
      $('gain').classList.add('anime');
      gainFin = horloge + 1;
    }
    const nouvelles = armes & ~armesPrecedentes;
    if (nouvelles) {
      sonCaisse();
      const achetee = ARMES.findLast((a, i) => nouvelles & (1 << i));
      if (achetee) {
        munitions[achetee.id] = achetee.chargeur;
        equiper(achetee.id);
        informer(`${achetee.nom} achetée !`);
      }
    }
    argentPrecedent = argent;
    armesPrecedentes = armes;
    // Vivres achetés ou mangés.
    const vivres = vivresDe();
    for (const [i, vivre] of VIVRES.entries()) {
      const avant = vivresPrecedents[i] ?? 0, apres = vivres[i] ?? 0;
      if (apres > avant) sonCaisse();
      if (apres < avant) {
        sonManger();
        informer(`Miam ! ${vivre.nom} : +${vivre.soin} PV`, 2);
      }
    }
    vivresPrecedents = [...vivres];
    // Étoile ramassée : l'arme monte d'un niveau, chargeur plein offert.
    const niveaux = monCompte().niveaux ?? NIVEAUX_VIDES;
    for (const [i, a] of ARMES.entries()) {
      if ((niveaux[i] ?? 0) <= (niveauxPrecedents[i] ?? 0)) continue;
      sonEtoile();
      const ameliore = armeAmelioree(a, niveaux[i]);
      munitions[a.id] = ameliore.chargeur;
      if (rechargement?.id === a.id) annulerRechargement();
      informer(`${etoilesTexte(niveaux[i])} ${a.nom} amélioré : niveau ${niveaux[i]} / ${ETOILES.niveauMax}`, 3);
    }
    niveauxPrecedents = niveaux;
    // Lanterne améliorée par quelqu'un de l'équipe.
    const lanterne = monde.lanterne ?? 0;
    if (lanterne > lanternePrecedente) {
      sonCaisse();
      informer(`Lanterne améliorée : niveau ${lanterne} / ${NIVEAU_LANTERNE_MAX}`, 3);
    }
    lanternePrecedente = lanterne;
    // Nouvelle partie : les armes achetées sont perdues, retour au pistolet.
    if (!possede(armeEquipee)) {
      armeEquipee = 'pistolet';
      arme.equiper('pistolet');
    }
  }

  // --- Interface -----------------------------------------------------------

  // Le bandeau du haut : où l'on est, ce qui se passe, combien de temps.
  function textePhase() {
    const { phase, reste, cycle } = monde;
    if (phase === 'accalmie') return `Accalmie · assaut dans ${minutes(reste)}`;
    if (phase === 'assaut') return `Assaut ${cycle} · accalmie dans ${minutes(reste)}`;
    if (phase === 'rituel') return 'Rituel : le boss arrive…';
    if (phase === 'boss') return `Boss · ${minutes(reste)}`;
    if (phase === 'victoire') return `Carte suivante dans ${Math.ceil(reste)} s`;
    return '';
  }

  function afficherInterface(dt) {
    const enPartie = monde.phase !== 'attente';
    $('partie').hidden = !enPartie;
    $('vie').hidden = !enPartie;
    $('lancement').hidden = enPartie;
    $('modifier').hidden = enPartie;
    if (enPartie) {
      $('manche').textContent = carte().nom;
      $('chrono').textContent = textePhase();
      $('partie').dataset.phase = monde.phase;
      $('tues').textContent = `${pluriel(monde.tues, 'zombie')} éliminé${monde.tues > 1 ? 's' : ''}`;
      $('vie-nom').textContent = NOM_PROTEGE;
      $('vie-barre').style.width = `${(monde.pv / PV_PROTEGE) * 100}%`;
      $('vie').dataset.danger = String(monde.pv < 35);
      $('vie').dataset.frappe = String(horloge < lucieFrappee);
    } else {
      const seul = membres.length <= 1;
      $('texte-lancement').textContent = `${seul ? 'Tu es seul : parfait pour tester.' : `${membres.length} joueurs au camp.`} Protégez ${NOM_PROTEGE} ; posez-la sur l’autel pour appeler le boss.`;
      $('essai-lancement').hidden = !ESSAI.actif;
      $('essai-lancement').textContent = `Mode essai : accalmies de ${ESSAI.accalmie} s, assauts de ${ESSAI.assaut} s, boss fragile, ${ESSAI.argentDepart.toLocaleString('fr-FR')} $ au départ.`;
    }

    // Barre de vie du boss et son chrono, en haut de l'écran. La trace claire
    // suit la barre avec retard : on voit ce que la dernière rafale a enlevé.
    const b = bossEnJeu();
    $('boss').hidden = !b;
    if (b) {
      const part = `${Math.max(0, Math.min(1, b.pv / b.pvMax)) * 100}%`;
      $('boss-barre').style.width = part;
      $('boss-trace').style.width = part;
      const enrage = b.pv <= b.pvMax * BOSS.enrage;
      $('boss').dataset.enrage = String(enrage);
      $('boss').dataset.presse = String(monde.reste <= 30);
      $('boss-nom').textContent = BOSS.nom;
      $('boss-etat').textContent = enrage ? 'Enragé !' : `${Math.ceil(b.pv)} / ${b.pvMax}`;
      $('boss-chrono').textContent = minutes(monde.reste);
    }
    // Au milieu, sous le bandeau : l'accalmie, le rituel.
    const phaseInfo = $('bandeau-phase');
    const texte = monde.phase === 'accalmie' ? `La carte est éclairée : ravitaillez-vous · ${minutes(monde.reste)}`
      : monde.phase === 'rituel' ? `Le rituel s’achève dans ${Math.ceil(monde.reste)} s` : '';
    phaseInfo.hidden = !texte || !enPartie;
    phaseInfo.textContent = texte;
    phaseInfo.dataset.phase = monde.phase;

    const aLaMain = fps && !boutiqueOuverte && !jePorte() && !aTerre();
    $('viseur').hidden = !fps || boutiqueOuverte || aTerre();
    if (horloge > marqueurFin) delete $('viseur').dataset.touche;
    // Les traits du viseur s'écartent avec la dispersion réelle du tir.
    const demiChamp = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const ecart = (Math.tan(dispersionActuelle()) / demiChamp) * (innerHeight / 2);
    $('viseur').style.setProperty('--ecart', `${(4 + ecart).toFixed(1)}px`);
    const a = armeEnMain();
    const reste = munitions[a.id];
    $('munitions').hidden = !aLaMain;
    $('munitions-chargeur').textContent = String(reste);
    $('munitions-max').textContent = `/ ${a.chargeur}`;
    $('munitions').dataset.bas = String(reste <= Math.ceil(a.chargeur / 4));
    $('munitions-nom').textContent = a.niveau ? `${a.nom} ${etoilesTexte(a.niveau)}` : a.nom;
    const recharge = $('recharge');
    recharge.hidden = !aLaMain || !rechargement;
    if (rechargement) recharge.style.setProperty('--progression', String(Math.min(1, (horloge - rechargement.debut) / rechargement.duree)));
    $('annonce').hidden = horloge > annonceFin;

    const indication = $('indication');
    const aRelever = allieARelever();
    const e = joueur.etat;
    const indice = releveEnvoye ? `Relève de ${nomDe(releveEnvoye)}…`
      : horloge < infoFin ? infoTexte
        : boutiqueOuverte || aTerre() ? ''
          : aRelever ? `Maintiens E : relever ${nomDe(aRelever)}`
            : jePorte() ? (surAutel(monde.poteau.x, monde.poteau.z) ? `E : poser ${NOM_PROTEGE} sur l’autel (le boss viendra)` : `E : poser ${NOM_PROTEGE}`)
              : pretBoutique() ? 'E : ouvrir l’armurerie'
                : pretAPorter() ? `E : porter ${NOM_PROTEGE}`
                  : monde.phase === 'rituel' && Math.hypot(e.x - monde.poteau.x, e.z - monde.poteau.z) < 4 ? `${NOM_PROTEGE} ne quitte pas l’autel pendant le rituel` : '';
    indication.textContent = indice;
    indication.hidden = !fps || !indice;

    // Sa propre vie : la barre de l'inventaire, et l'écran « à terre ».
    const v = vieDe(monId);
    const defenseur = fps && enPartie;
    $('pv-joueur').hidden = !defenseur;
    $('pv-barre').style.width = `${(v.pv / JOUEUR.pv) * 100}%`;
    $('pv-texte').textContent = String(Math.round(v.pv));
    $('pv-joueur').dataset.danger = String(v.pv <= JOUEUR.coup);
    $('pv-joueur').dataset.mange = String(!!v.mange);
    $('terre').hidden = !(defenseur && v.terre);
    if (v.terre) {
      $('terre-texte').textContent = allies()
        ? 'Un allié peut te relever : il doit rester près de toi, E maintenu.'
        : 'Personne pour te relever : tu te relèves seul dans un instant…';
      $('terre').style.setProperty('--progression', String(v.releve));
    }
    const releve = releveEnvoye ? vieDe(releveEnvoye) : null;
    $('releve').hidden = !releve;
    if (releve) $('releve').style.setProperty('--progression', String(releve.releve));

    const { argent } = monCompte();
    $('argent').textContent = `${argent} $`;
    $('gain').hidden = horloge > gainFin;
    $('equipement').hidden = !fps || !enPartie;
    // Seules les armes possédées s'affichent, numérotées dans l'ordre.
    let rang = 0;
    for (const a of ARMES) {
      const c = cases.get(a.id);
      const la = possede(a.id);
      c.hidden = !la;
      if (!la) continue;
      rang += 1;
      c.dataset.etat = armeEquipee === a.id ? 'equipee' : 'achetee';
      c.querySelector('.touche').textContent = String(rang);
      c.querySelector('.niveau').textContent = etoilesTexte(niveauDe(a.id));
    }
    const vivres = vivresDe();
    let aManger = false;
    for (const [i, vivre] of VIVRES.entries()) {
      const c = cases.get(vivre.id);
      const n = vivres[i] ?? 0;
      c.hidden = n <= 0;
      aManger ||= n > 0;
      c.querySelector('.niveau').textContent = `×${n}`;
      c.dataset.etat = v.mange ? 'mange' : 'achetee';
    }
    $('barre-vivres').hidden = !aManger;
    if (boutiqueOuverte) rafraichirBoutique();
    $('reprendre').hidden = !fps || boutiqueOuverte || vue.etat.verrouille || vue.etat.impossible;
    $('reprendre').dataset.camp = String(!enPartie);

    $('aide').textContent = jePorte()
      ? `Tu portes ${NOM_PROTEGE} : pas de tir, tu avances moins vite · E : la poser`
      : `ZQSD : marcher · Clic : tirer · R : recharger · ${rang > 1 ? `1-${rang} ou molette` : '1'} : arme · F : manger · E : porter ${NOM_PROTEGE} / armurerie · Maj : courir · Échap : souris`;

    degats = Math.max(0, degats - dt * 2.5);
    // À terre, le voile rouge reste.
    $('degats').style.opacity = String(Math.max(degats * 0.8, aTerre() ? 0.45 : 0));
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
      fermerBoutique();
      fps = false;
      vue.activer(false);
      arme.afficher(false);
    },

    quitter() {
      this.sortir();
      sim = null;
      dernierInstantane = null;
      monde = mondeVide();
      precedent = neuf();
      membres = [];
      monstres.vider();
      projectiles.vider();
      etoiles.vider();
      chiffres.vider();
      releveEnvoye = null;
      niveauxPrecedents = NIVEAUX_VIDES;
      vivresPrecedents = VIVRES_VIDES;
      lanternePrecedente = 0;
      musique.arreter(0.3);
      bossVu = { id: null, cris: 0, enrage: false };
      tirsEnAttente = [];
      tirsDifferes = [];
      armeEquipee = 'pistolet';
      arme.equiper('pistolet');
      annulerRechargement();
      munitions = pleins(NIVEAUX_VIDES);
      explosionsVues.clear();
      typesVus.clear();
      argentPrecedent = 0;
      armesPrecedentes = ARMES_DEPART;
      poteau.occuper(false);
      poteau.allumer(0);
      objetAutel.visible = false;
      ile.ambiance('jour');
      ile.autel('repos');
      if (carteAffichee !== 0) changerCarte(0);
    },

    // liste : membres admis, dans l'ordre du salon (le premier est l'hôte).
    surMembres(liste, id) {
      monId = id;
      membres = liste;
      if (estHote() && !sim) {
        sim = creerSimulation(optionsSimulation());
        // Nouvel hôte en cours de partie : on reprend le dernier état reçu.
        if (dernierInstantane) sim.charger(dernierInstantane);
        urgent = true;
      } else if (!estHote() && sim) {
        sim = null;
      }
      if (sim) {
        sim.definirMembres(liste);
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
        if (monstres.nombre < vivants && COMBAT.includes(n.phase)) sonMort();
      } else if (d.type === 'tirs') {
        if (!Array.isArray(d.l)) return;
        const idArme = ARMES[Number.isInteger(d.ar) ? d.ar : 0]?.id ?? 'pistolet';
        const tirs = d.l.slice(0, TIRS_MAX).filter((t) => Array.isArray(t) && t.slice(0, 6).every(nombreValide) && t.length >= 6);
        tirs.forEach((t, i) => {
          tirsDifferes.push({ quand: horloge + (i * INTERVALLE_TIRS) / tirs.length, t, idArme });
          const [, , , , , , m, dg] = t;
          if (sim && Number.isInteger(m) && Number.isFinite(dg)) {
            if (sim.toucher(m, Math.min(dg, DEGATS_BALLE_MAX), de)) urgent = true;
          }
        });
      } else if (d.type === 'grenade') {
        if (!vecteurValide(d.o) || !vecteurValide(d.v)) return;
        const o = new THREE.Vector3(...d.o);
        projectiles.lancer(o, new THREE.Vector3(...d.v), false);
        arme.eclair(o, 1.6);
        sonTir(Math.max(0, 0.6 - o.distanceTo(camera.position) / 70), 'lance');
      } else if (d.type === 'explosion') {
        if (!sim || !Array.isArray(d.c)) return;
        for (const c of d.c.slice(0, 30)) {
          if (Array.isArray(c) && Number.isInteger(c[0]) && Number.isFinite(c[1])) {
            if (sim.toucher(c[0], Math.min(c[1], GRENADE.degats * BONUS_DEGATS_MAX), de)) urgent = true;
          }
        }
      } else if (sim) {
        const faits = {
          porter: () => sim.demanderPorter(de, positionsJoueurs()),
          poser: () => sim.poser(de),
          acheter: () => typeof d.arme === 'string' && sim.acheter(de, d.arme, positionsJoueurs()),
          vivre: () => typeof d.vivre === 'string' && sim.acheterVivre(de, d.vivre, positionsJoueurs()),
          manger: () => typeof d.vivre === 'string' && sim.manger(de, d.vivre),
          lanterne: () => sim.ameliorerLanterne(de, positionsJoueurs()),
          relever: () => sim.demanderRelever(de, typeof d.cible === 'string' ? d.cible : null),
          lancer: () => {
            sim.definirMembres(membres);
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
      const hote = (f) => (...args) => {
        if (!sim) return false;
        const r = f(...args);
        urgent = true;
        return r;
      };
      return {
        etat: () => ({
          phase: monde.phase, etape: monde.etape, cycle: monde.cycle, reste: monde.reste, pv: monde.pv, cause: monde.cause,
          porteur: monde.poteau.porteur, poteau: [monde.poteau.x, monde.poteau.z], tues: monde.tues, monId, hote: estHote(),
          zombies: monstres.cibles().map((c) => [c.x, c.y, c.z, c.id]),
          types: monde.monstres.map((m) => TYPES_ZOMBIES[m.k ?? 0].id),
          ids: monde.monstres.map((m) => m.id),
          munitions: { ...munitions },
          rechargement: rechargement ? rechargement.id : null,
          progression: rechargement ? (horloge - rechargement.debut) / rechargement.duree : null,
          explosions: [...explosionsVues.keys()],
          carte: carte().id,
          autel: carte().autel,
          vie: vieDe(monId),
          vies: monde.vies,
          vivres: vivresDe(),
          etoiles: (monde.etoiles ?? []).map((e) => [e.x, e.z]),
          lanterne: monde.lanterne ?? 0,
          niveaux: monCompte().niveaux,
          boss: bossEnJeu(),
          musique: musique.active,
          joueur: [joueur.etat.x, joueur.etat.y, joueur.etat.z],
          vue: { ...vue.etat },
          chiffres: document.querySelectorAll('.chiffre-degats').length,
        }),
        viser(x, y, z) {
          const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z;
          vue.orienter(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
        },
        teleporter: (x, z) => joueur.teleporter(x, z),
        // Hôte seulement : de l'argent pour tester la boutique.
        crediter: hote((n, id = monId) => {
          sim.etat.comptes[id] ??= { argent: 0, armes: ARMES_DEPART, niveaux: [...NIVEAUX_VIDES], vivres: [...VIVRES_VIDES] };
          sim.etat.comptes[id].argent += n;
          return true;
        }),
        // Hôte seulement : poser un zombie d'un type donné (immobile par défaut).
        poserZombie: hote((type, x, z, vitesse = 0, pv = 999) => {
          const k = TYPES_ZOMBIES.findIndex((t) => t.id === type);
          if (k < 0 || !COMBAT.includes(sim.etat.phase)) return null;
          const id = 5000 + sim.etat.prochainId++;
          sim.etat.monstres.push({ id, k, x, z, r: 0, pv, v: vitesse, a: false, c: 1 });
          return id;
        }),
        // Hôte seulement : blesser un zombie comme si on l'avait touché.
        blesser: hote((id, degats) => sim.toucher(id, degats, monId)),
        // Hôte seulement : poser une étoile.
        poserEtoile: hote((x, z) => {
          sim.etat.etoiles.push({ id: sim.etat.prochaineEtoile++, x, z, age: 0 });
          return true;
        }),
        // Hôte seulement : abréger l'accalmie ou l'assaut en cours.
        finirPhase: hote(() => {
          if (!['accalmie', 'assaut', 'victoire', 'boss'].includes(sim.etat.phase)) return false;
          sim.etat.reste = 0.05;
          return true;
        }),
        // Hôte seulement : Lucie posée sur l'autel (le rituel commence).
        poserSurAutel: hote(() => {
          const { autel } = CARTES[sim.etat.carte];
          Object.assign(sim.etat.poteau, { x: autel.x, z: autel.z, porteur: null });
          return true;
        }),
        // Hôte seulement : des vivres dans le sac, et des blessures à soigner.
        blesserJoueur: hote((pv, id = monId) => {
          sim.etat.vies[id] = { pv, terre: false, releve: 0, repit: 0, seul: 0, soin: 0, vitesseSoin: 0 };
          return true;
        }),
        equiper,
        recharger,
        manger,
        acheterVivre,
        boutique: () => ({ ouverte: boutiqueOuverte, arme: armeEquipee, compte: monCompte() }),
        acheter: acheterOuEquiper,
        ameliorerLanterne,
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
        if (monstres.nombre < vivants && enCombat()) sonMort();
        prochainMonde -= dt;
        if (urgent || prochainMonde <= 0) {
          const calme = monde.phase === 'attente' && !monde.poteau.porteur;
          envoyer(sim.instantane());
          prochainMonde = calme ? INTERVALLE_MONDE_CALME : INTERVALLE_MONDE;
          urgent = false;
        }
      } else {
        monde.reste = Math.max(0, monde.reste - dt);
      }
      // Nouvelle carte (boss abattu, retour au camp) : on y arrive par son entrée.
      const indiceCarte = monde.phase === 'attente' ? 0 : monde.carte ?? 0;
      if (indiceCarte !== carteAffichee) changerCarte(indiceCarte);
      suivreChangements();
      jouerExplosions();
      signalerNouveauxTypes();
      suivreBoss();
      musique.mettreAJour();

      if (fps !== enJeu) enJeu ? this.entrer() : this.sortir();
      if (fps) commandesLocales(dt);
      else clavier.oublier();
      // Plus d'arme en main (Lucie portée, boutique, à terre) : on arrête de recharger.
      if (!fps || jePorte() || boutiqueOuverte || aTerre()) annulerRechargement();
      if (!fps) annoncerReleve(null);
      suivreRechargement();
      const enMain = armeEnMain();
      vue.stabiliser(dt, enMain.retour);
      evasement *= Math.exp(-dt * enMain.retour);

      if (fps) {
        const immobile = boutiqueOuverte || aTerre();
        const commandes = immobile ? { avant: 0, lateral: 0, course: false, saut: false } : clavier.commandes();
        joueur.mettreAJour(dt, commandes, vue.etat.lacet, {
          orientation: vue.etat.lacet + Math.PI,
          facteur: jePorte() ? FACTEUR_PORTEUR : 1,
        });
      }
      const porteur = monde.poteau.porteur;
      avatars.mettreAJour(dt, (id) => {
        if (monde.phase !== 'attente' && vieDe(id).terre) return 'terre';
        if (id === porteur) return 'porte';
        return 'arme';
      });
      placerPoteau(dt);
      placerMarqueAutel();
      chuteVue += ((aTerre() ? 1 : 0) - chuteVue) * (1 - Math.exp(-dt * 6));
      if (fps) {
        const e = joueur.etat;
        vue.appliquer(camera, e.x, e.y + HAUTEUR_YEUX + (HAUTEUR_YEUX_TERRE - HAUTEUR_YEUX) * chuteVue, e.z);
        camera.rotation.z = chuteVue * 0.35;
        // Une explosion proche secoue la vue.
        if (secousse > 0) {
          camera.position.x += (Math.random() - 0.5) * 0.12 * secousse;
          camera.position.y += (Math.random() - 0.5) * 0.12 * secousse;
        }
      }
      secousse = Math.max(0, secousse - dt * 2.5);
      arme.afficher(fps && !jePorte() && !aTerre());
      arme.mettreAJour(dt, joueur.etat.vitesse, { lacet: vue.lacet, tangage: vue.tangage });
      monstres.mettreAJour(dt, !!sim);
      particules.mettreAJour(dt);
      chiffres.mettreAJour(dt);
      etoiles.appliquer(monde.phase === 'attente' ? [] : monde.etoiles ?? []);
      etoiles.mettreAJour(dt);
      // La lanterne améliorée éclaire plus loin, et la nuit recule d'autant.
      const niveauLanterne = monde.lanterne ?? 0;
      poteau.ameliorer(niveauLanterne);
      ile.vision(LANTERNE.brouillard[niveauLanterne]);

      // Tirs des autres, rejoués au fil de l'eau.
      if (tirsDifferes.length) {
        const restants = [];
        for (const tir of tirsDifferes) {
          if (tir.quand > horloge) {
            restants.push(tir);
            continue;
          }
          const [ox, oy, oz, fx, fy, fz, m] = tir.t;
          const o = new THREE.Vector3(ox, oy, oz);
          const f = new THREE.Vector3(fx, fy, fz);
          arme.eclair(o);
          arme.trainee(o, f);
          sonTir(Math.max(0, 0.6 - o.distanceTo(camera.position) / 70), tir.idArme);
          const sens = f.clone().sub(o).normalize();
          if (Number.isInteger(m)) {
            monstres.secouer(m);
            particules.impact(f, sens, giclee(monstres.typeDe(m)));
          } else if (fy - carte().solBalles(fx, fz) < 0.3) {
            particules.impact(f, sens, matiereSol());
          }
        }
        tirsDifferes = restants;
      }
      for (const { position, locale } of projectiles.mettreAJour(dt, monstres.cibles())) exploser(position, locale);
      envoyerTirs();

      // Pendant l'accalmie (et la victoire), la carte s'illumine ; l'autel
      // s'embrase pendant le rituel et le combat.
      ile.ambiance(monde.phase === 'attente' ? 'jour' : PHASES_ECLAIREES.includes(monde.phase) ? 'illumination' : 'nuit');
      ile.autel(monde.phase === 'rituel' ? 'rituel' : monde.phase === 'boss' ? 'boss' : monde.phase === 'victoire' ? 'eteint' : 'repos');
      if (fps) envoyerEtat(false);
      afficherInterface(dt);
    },
  };
}
