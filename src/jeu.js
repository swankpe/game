// Une partie du Protégé, côté navigateur : rôles, vue à la première personne,
// tirs, poteau, lanterne, ambiance et interface de jeu. Le navigateur hôte
// (premier du salon) fait en plus tourner la simulation et diffuse l'état du
// monde ; les autres l'affichent et envoient leurs actions.

import * as THREE from 'three';
import { genererApercus } from './apercus.js';
import { creerArme } from './arme.js';
import { BOUTIQUE, hauteurSol, hauteurTerrain } from './monde.js';
import { creerMonstresVue } from './monstres.js';
import { creerMusique } from './musique.js';
import { HAUTEUR_LANTERNE, creerPoteau } from './poteau.js';
import { creerProjectiles } from './projectiles.js';
import {
  ARMES, ARMES_DEPART, BONUS_MANCHE, BOSS, DISPERSION_MOUVEMENT, DISPERSION_SAUT, DISTANCE_BOUTIQUE, DISTANCE_PORTER,
  EXPLOSION_BOUFFI, MULTIPLICATEUR_TETE, POTEAU_DEPART, PV_PROTEGE, TYPES_ZOMBIES, degatsExplosion, indiceArme,
  positionPortee,
} from './regles.js';
import { creerSimulation, normaliserMonde } from './simulation.js';
import {
  sonCaisse, sonEclatement, sonExplosion, sonMort, sonRecharge, sonRugissement, sonTir, sonTouche, sonVictoire, sonVide,
} from './sons.js';
import { creerVue } from './vue.js';

const HAUTEUR_YEUX = 1.62;
const LEVEE_POTEAU = 0.3;
const FACTEUR_PORTEUR = 0.6;
const INTERVALLE_MONDE = 1 / 6;
const INTERVALLE_MONDE_CALME = 1;
const INTERVALLE_ETAT = 0.1;
const BATTEMENT_ETAT = 4;
const PORTEE_MANNEQUIN = 32;
// Les tirs partent en paquets : un Uzi tire 14 balles par seconde, un message
// par balle épuiserait vite le quota de Supabase.
const INTERVALLE_TIRS = 0.1;
const TIRS_MAX = 24;
const DEGATS_BALLE_MAX = Math.max(...ARMES.filter((a) => !a.projectile).map((a) => a.degats)) * MULTIPLICATEUR_TETE;
const GRENADE = ARMES[indiceArme('lance')];
// Bruits du rechargement, en fraction de sa durée : chargeur sorti, chargeur
// engagé, culasse armée.
const ETAPES_RECHARGE = [0.22, 0.62, 0.86];
// Une explosion déjà montrée n'est plus rejouée (elle reste 1,5 s dans les
// instantanés) ; on l'oublie un peu après.
const MEMOIRE_EXPLOSION = 2.5;
const pleins = () => Object.fromEntries(ARMES.map((a) => [a.id, a.chargeur]));
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
    illumination: 0, recharge: 0, tues: 0, monstres: [], comptes: {}, explosions: [], boss: null,
  };
}

// Distance jusqu'au sol le long d'un tir (les dunes arrêtent les balles).
function distanceSol(o, d, max) {
  for (let t = 0.5; t <= max; t += 0.5) {
    if (o.y + d[1] * t < hauteurTerrain(o.x + d[0] * t, o.z + d[2] * t)) return t;
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
  const apercus = genererApercus(rendu, ARMES.map((a) => a.id));

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
  let armeEquipee = 'pistolet';
  let tirsEnAttente = [];
  let prochainEnvoiTirs = 0;
  // Tirs reçus en paquet, rejoués étalés sur l'intervalle d'envoi.
  let tirsDifferes = [];
  let boutiqueOuverte = false;
  let argentPrecedent = 0;
  let armesPrecedentes = ARMES_DEPART;
  let gainFin = 0;
  let infoTexte = '';
  let infoFin = 0;
  let secousse = 0;
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

  const estHote = () => membres.length > 0 && membres[0].id === monId;
  const nomDe = (id) => membres.find((m) => m.id === id)?.nom ?? 'Quelqu’un';
  const role = () => (monde.phase === 'attente' ? 'libre' : monde.protege === monId ? 'protege' : 'defenseur');
  const jePorte = () => monde.poteau.porteur === monId;
  const monCompte = () => monde.comptes?.[monId] ?? { argent: 0, armes: ARMES_DEPART };
  const possede = (id) => (monCompte().armes & (1 << indiceArme(id))) !== 0;
  const pretBoutique = () => {
    const e = joueur.etat;
    return role() !== 'protege' && !jePorte() && Math.hypot(e.x - BOUTIQUE.x, e.z - BOUTIQUE.z) <= DISTANCE_BOUTIQUE;
  };

  function informer(texte, duree = 1.8) {
    infoTexte = texte;
    infoFin = horloge + duree;
  }

  const armeEnMain = () => ARMES[indiceArme(armeEquipee)];

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
      munitions[rechargement.id] = ARMES[indiceArme(rechargement.id)].chargeur;
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
    const possedees = ARMES.filter((a) => possede(a.id));
    const i = possedees.findIndex((a) => a.id === armeEquipee);
    equiper(possedees[(i + sens + possedees.length) % possedees.length].id);
  }

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
    const portee = distanceSol(o, d, a.portee) ?? a.portee;
    const touche = monstres.toucher([o.x, o.y, o.z], d, portee);
    const distance = touche ? touche.distance : portee;
    const fin = new THREE.Vector3(o.x + d[0] * distance, o.y + d[1] * distance, o.z + d[2] * distance);
    arme.trainee(bouche, fin);
    const tir = [bouche.x, bouche.y, bouche.z, fin.x, fin.y, fin.z].map((x) => arrondi(x));
    if (touche) {
      const dg = a.degats * (touche.tete ? MULTIPLICATEUR_TETE : 1);
      monstres.secouer(touche.id);
      sonTouche(touche.tete);
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
    const distance = position.distanceTo(camera.position);
    const volume = Math.max(0.15, 1 - distance / 60);
    if (genre === 'bouffi') sonEclatement(volume);
    else sonExplosion(volume);
    secousse = Math.max(secousse, 1 - distance / 18);
  }

  function exploser(position, locale) {
    effetExplosion(position, GRENADE.rayon, 'grenade');
    if (!locale) return;
    // Seul le tireur compte les dégâts de sa grenade.
    const cibles = monstres.autourDe(position, GRENADE.rayon)
      .map(({ id, distance: d }) => [id, degatsExplosion(GRENADE, d)])
      .filter(([, dg]) => dg > 0)
      .slice(0, 30);
    for (const [id] of cibles) monstres.secouer(id);
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
      const y = Math.max(hauteurTerrain(e.x, e.z), -0.1) + 1;
      effetExplosion(new THREE.Vector3(e.x, y, e.z), EXPLOSION_BOUFFI.rayon, 'bouffi');
    }
    for (const [id, quand] of explosionsVues) if (horloge - quand > MEMOIRE_EXPLOSION) explosionsVues.delete(id);
  }

  // Premier colosse, premier bouffi de la partie : on prévient.
  function signalerNouveauxTypes() {
    if (monde.phase !== 'manche') {
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

  // --- Boss de fin de manche -------------------------------------------------

  // Le boss vivant et ses caractéristiques, ou null.
  function bossEnJeu() {
    const info = monde.boss;
    if (!info || monde.phase !== 'manche') return null;
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
      annoncer(BOSS.nom, 'Il sort des flots ! Abattez-le pour gagner la manche.', 4);
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
  function construireBoutique() {
    const liste = $('boutique-armes');
    const max = {
      puissance: Math.max(...ARMES.map((a) => a.degats / a.cadence)),
      cadence: Math.max(...ARMES.map((a) => 1 / a.cadence)),
      portee: Math.max(...ARMES.map((a) => a.portee)),
    };
    for (const a of ARMES) {
      const carte = document.createElement('article');
      carte.className = 'arme-carte';
      const image = document.createElement('img');
      image.src = apercus[a.id];
      image.alt = '';
      const titre = document.createElement('h3');
      titre.textContent = a.nom;
      const texte = document.createElement('p');
      texte.textContent = a.description;
      const chargeur = document.createElement('p');
      chargeur.className = 'chargeur';
      const secondes = String(a.rechargement).replace('.', ',');
      chargeur.textContent = `${a.projectile ? 'Barillet' : 'Chargeur'} de ${a.chargeur} · rechargement ${secondes} s`;
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
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'principal';
      bouton.addEventListener('click', () => acheterOuEquiper(a.id));
      carte.append(image, titre, texte, chargeur, stats, bouton);
      liste.append(carte);
      cartes.set(a.id, { carte, bouton });
    }
  }

  function rafraichirBoutique() {
    const { argent } = monCompte();
    $('boutique-argent').textContent = `${argent} $`;
    for (const a of ARMES) {
      const { carte, bouton } = cartes.get(a.id);
      const achetee = possede(a.id);
      carte.dataset.etat = armeEquipee === a.id ? 'equipee' : achetee ? 'achetee' : argent >= a.prix ? 'abordable' : 'chere';
      bouton.disabled = armeEquipee === a.id || (!achetee && argent < a.prix);
      bouton.textContent = armeEquipee === a.id ? 'En main' : achetee ? 'Prendre en main' : `Acheter · ${a.prix} $`;
    }
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
  const primes = TYPES_ZOMBIES.map((t) => t.recompense);
  $('boutique-regle').textContent = `${Math.min(...primes)} à ${Math.max(...primes)} $ par zombie selon le type, ${BONUS_MANCHE} $ par manche gagnée`;
  $('boutique-fermer').addEventListener('click', fermerBoutique);

  // Barre des armes, en bas à droite.
  const cases = new Map();
  for (const [i, a] of ARMES.entries()) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'case-arme';
    const image = document.createElement('img');
    image.src = apercus[a.id];
    image.alt = a.nom;
    const touche = document.createElement('span');
    touche.className = 'touche';
    touche.textContent = String(i + 1);
    const prix = document.createElement('span');
    prix.className = 'prix';
    prix.textContent = `${a.prix} $`;
    c.append(image, touche, prix);
    c.addEventListener('click', () => equiper(a.id));
    $('barre-armes').append(c);
    cases.set(a.id, c);
  }
  canvas.addEventListener('wheel', (e) => {
    if (fps && !boutiqueOuverte && role() !== 'protege') armeSuivante(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  function commandesLocales(dt) {
    const r = role();
    cadence -= dt;
    if (boutiqueOuverte) {
      if (clavier.consommer('KeyE') || clavier.consommer('Escape')) fermerBoutique();
      return;
    }
    if (r !== 'protege' && clavier.consommer('KeyE')) {
      if (jePorte()) action('poser', () => sim.poser(monId));
      else if (pretBoutique()) ouvrirBoutique();
      else if (pretAPorter()) action('porter', () => sim.demanderPorter(monId, positionsJoueurs()));
    }
    if (r !== 'protege') {
      for (const [i, a] of ARMES.entries()) if (clavier.consommer(`Digit${i + 1}`)) equiper(a.id);
    }
    if (r === 'protege' && clavier.consommer('KeyF')) action('illuminer', () => sim.demanderIllumination(monId));
    if (monde.phase === 'attente' && clavier.consommer('Enter')) lancer();
    const enMain = r !== 'protege' && !jePorte();
    if (enMain && clavier.consommer('KeyR')) recharger();
    // Chargeur vide (après un changement d'arme, par exemple) : on recharge.
    if (enMain && munitions[armeEquipee] <= 0 && arme.prete()) recharger();
    if (vue.etat.gachette && enMain && !rechargement && munitions[armeEquipee] > 0 && cadence <= 0 && arme.prete()) tirer();
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
        const detail = `+${BONUS_MANCHE} $ pour chacun · prochain protégé : ${suivant}`;
        if (bossVu.id !== null) {
          annoncer(`${BOSS.nom} est vaincu !`, `Manche ${manche - 1} gagnée · ${detail}`, 5);
          sonVictoire();
        } else {
          annoncer(`Manche ${manche - 1} gagnée !`, detail, 5);
        }
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
    if (phase !== 'manche') bossVu = { id: null, cris: 0, enrage: false };
    // Chaque manche repart chargeurs pleins ; une nouvelle partie oublie les
    // types déjà vus.
    if (phase === 'manche' && (precedent.phase !== 'manche' || manche !== precedent.manche)) {
      annulerRechargement();
      munitions = pleins();
      if (manche === 1) typesVus.clear();
    }
    precedent = { phase, manche, protege, pv, illumination };

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
    // Nouvelle partie : les armes achetées sont perdues, retour au pistolet.
    if (!possede(armeEquipee)) {
      armeEquipee = 'pistolet';
      arme.equiper('pistolet');
    }
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
      const chrono = monde.phase === 'manche' ? (monde.boss ? 'Boss !' : minutes(monde.reste))
        : monde.phase === 'pause' ? `reprise dans ${Math.ceil(monde.reste)} s` : '';
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

    // Barre de vie du boss, en haut de l'écran. La trace claire suit la barre
    // avec retard : on voit ce que la dernière rafale a enlevé.
    const b = bossEnJeu();
    $('boss').hidden = !b;
    if (b) {
      const part = `${Math.max(0, Math.min(1, b.pv / b.pvMax)) * 100}%`;
      $('boss-barre').style.width = part;
      $('boss-trace').style.width = part;
      const enrage = b.pv <= b.pvMax * BOSS.enrage;
      $('boss').dataset.enrage = String(enrage);
      $('boss-nom').textContent = BOSS.nom;
      $('boss-etat').textContent = enrage ? 'Enragé !' : `${Math.ceil(b.pv)} / ${b.pvMax}`;
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

    const enMain = fps && r !== 'protege' && !boutiqueOuverte && !jePorte();
    $('viseur').hidden = !fps || r === 'protege' || boutiqueOuverte;
    if (horloge > marqueurFin) delete $('viseur').dataset.touche;
    // Les traits du viseur s'écartent avec la dispersion réelle du tir.
    const demiChamp = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const ecart = (Math.tan(dispersionActuelle()) / demiChamp) * (innerHeight / 2);
    $('viseur').style.setProperty('--ecart', `${(4 + ecart).toFixed(1)}px`);
    const a = armeEnMain();
    const reste = munitions[a.id];
    $('munitions').hidden = !enMain;
    $('munitions-chargeur').textContent = String(reste);
    $('munitions-max').textContent = `/ ${a.chargeur}`;
    $('munitions').dataset.bas = String(reste <= Math.ceil(a.chargeur / 4));
    $('munitions-nom').textContent = a.nom;
    const recharge = $('recharge');
    recharge.hidden = !enMain || !rechargement;
    if (rechargement) recharge.style.setProperty('--progression', String(Math.min(1, (horloge - rechargement.debut) / rechargement.duree)));
    $('annonce').hidden = horloge > annonceFin;

    const indication = $('indication');
    const indice = horloge < infoFin ? infoTexte
      : r === 'protege' || boutiqueOuverte ? ''
        : jePorte() ? 'E : poser le poteau'
          : pretBoutique() ? 'E : ouvrir l’armurerie'
            : pretAPorter() ? 'E : porter le poteau' : '';
    indication.textContent = indice;
    indication.hidden = !fps || !indice;

    const { argent } = monCompte();
    $('argent').textContent = `${argent} $`;
    $('gain').hidden = horloge > gainFin;
    $('equipement').hidden = !fps || r === 'protege';
    for (const [id, c] of cases) {
      c.dataset.etat = armeEquipee === id ? 'equipee' : possede(id) ? 'achetee' : 'verrouillee';
    }
    if (boutiqueOuverte) rafraichirBoutique();
    $('reprendre').hidden = !fps || boutiqueOuverte || vue.etat.verrouille || vue.etat.impossible;

    $('aide').textContent =
      r === 'protege' ? 'Souris : diriger la lanterne · F : Illumination'
        : jePorte() ? 'Tu portes le poteau : pas de tir, tu avances moins vite'
          : 'ZQSD : marcher · Clic : tirer · R : recharger · 1-4 ou molette : arme · E : poteau / armurerie · Maj : courir · Échap : souris';

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
      precedent = { phase: 'attente', manche: 0, protege: null, pv: PV_PROTEGE, illumination: 0 };
      membres = [];
      monstres.vider();
      projectiles.vider();
      musique.arreter(0.3);
      bossVu = { id: null, cris: 0, enrage: false };
      tirsEnAttente = [];
      tirsDifferes = [];
      armeEquipee = 'pistolet';
      arme.equiper('pistolet');
      annulerRechargement();
      munitions = pleins();
      explosionsVues.clear();
      typesVus.clear();
      argentPrecedent = 0;
      armesPrecedentes = ARMES_DEPART;
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
            if (sim.toucher(c[0], Math.min(c[1], GRENADE.degats), de)) urgent = true;
          }
        }
      } else if (sim) {
        const faits = {
          porter: () => sim.demanderPorter(de, positionsJoueurs()),
          poser: () => sim.poser(de),
          illuminer: () => sim.demanderIllumination(de),
          acheter: () => typeof d.arme === 'string' && sim.acheter(de, d.arme, positionsJoueurs()),
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
          zombies: monstres.cibles().map((c) => [c.x, c.y, c.z]),
          types: monde.monstres.map((m) => TYPES_ZOMBIES[m.k ?? 0].id),
          munitions: { ...munitions },
          rechargement: rechargement ? rechargement.id : null,
          progression: rechargement ? (horloge - rechargement.debut) / rechargement.duree : null,
          explosions: [...explosionsVues.keys()],
          boss: bossEnJeu(),
          musique: musique.active,
          joueur: [joueur.etat.x, joueur.etat.y, joueur.etat.z],
          vue: { ...vue.etat },
        }),
        viser(x, y, z) {
          const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z;
          vue.orienter(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
        },
        teleporter: (x, z) => joueur.teleporter(x, z),
        // Hôte seulement : de l'argent pour tester la boutique.
        crediter(n, id = monId) {
          if (!sim) return false;
          sim.etat.comptes[id] ??= { argent: 0, armes: ARMES_DEPART };
          sim.etat.comptes[id].argent += n;
          urgent = true;
          return true;
        },
        // Hôte seulement : poser un zombie d'un type donné (immobile par défaut)
        // et éclairer l'île, pour regarder les modèles de près.
        poserZombie(type, x, z, vitesse = 0, pv = 999) {
          const k = TYPES_ZOMBIES.findIndex((t) => t.id === type);
          if (!sim || k < 0 || sim.etat.phase !== 'manche') return null;
          const id = 5000 + sim.etat.prochainId++;
          sim.etat.monstres.push({ id, k, x, z, r: 0, pv, v: vitesse, a: false, c: 1 });
          urgent = true;
          return id;
        },
        // Hôte seulement : blesser un zombie comme si on l'avait touché.
        blesser(id, degats) {
          if (!sim) return false;
          if (sim.toucher(id, degats, monId)) urgent = true;
          return true;
        },
        // Hôte seulement : le chrono tombe à zéro, le boss arrive.
        finirChrono() {
          if (!sim || sim.etat.phase !== 'manche') return false;
          sim.etat.reste = 0.05;
          return true;
        },
        illuminer() {
          if (!sim) return false;
          sim.etat.illumination = 30;
          urgent = true;
          return true;
        },
        equiper,
        recharger,
        boutique: () => ({ ouverte: boutiqueOuverte, arme: armeEquipee, compte: monCompte() }),
        acheter: acheterOuEquiper,
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
      jouerExplosions();
      signalerNouveauxTypes();
      suivreBoss();
      musique.mettreAJour();

      if (fps !== enJeu) enJeu ? this.entrer() : this.sortir();
      if (fps) commandesLocales(dt);
      else clavier.oublier();
      // Plus d'arme en main (poteau porté, boutique, protégé) : on arrête de recharger.
      if (!fps || role() === 'protege' || jePorte() || boutiqueOuverte) annulerRechargement();
      suivreRechargement();
      const enMain = armeEnMain();
      vue.stabiliser(dt, enMain.retour);
      evasement *= Math.exp(-dt * enMain.retour);

      const r = role();
      if (fps && r === 'protege') fermerBoutique();
      if (fps && r !== 'protege') {
        const commandes = boutiqueOuverte ? { avant: 0, lateral: 0, course: false, saut: false } : clavier.commandes();
        joueur.mettreAJour(dt, commandes, vue.etat.lacet, {
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
        // Une explosion proche secoue la vue.
        if (secousse > 0) {
          camera.position.x += (Math.random() - 0.5) * 0.12 * secousse;
          camera.position.y += (Math.random() - 0.5) * 0.12 * secousse;
        }
      }
      secousse = Math.max(0, secousse - dt * 2.5);
      arme.afficher(fps && r !== 'protege' && !jePorte());
      arme.mettreAJour(dt, joueur.etat.vitesse);
      monstres.mettreAJour(dt, !!sim);

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
          arme.eclair(o);
          arme.trainee(o, new THREE.Vector3(fx, fy, fz));
          sonTir(Math.max(0, 0.6 - o.distanceTo(camera.position) / 70), tir.idArme);
          if (Number.isInteger(m)) monstres.secouer(m);
        }
        tirsDifferes = restants;
      }
      for (const { position, locale } of projectiles.mettreAJour(dt, monstres.cibles())) exploser(position, locale);
      envoyerTirs();

      ile.ambiance(monde.phase === 'attente' ? 'jour' : monde.illumination > 0 ? 'illumination' : 'nuit');
      if (fps || r === 'protege') envoyerEtat(false);
      afficherInterface(dt);
    },
  };
}
