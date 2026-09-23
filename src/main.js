import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { creerPostTraitement } from './post.js';
import { apparenceAleatoire, nettoyerNom, normaliserApparence } from './apparence.js';
import { creerAvatars } from './avatars.js';
import { creerOrbite } from './camera.js';
import { creerIle } from './ile.js';
import { creerJeu } from './jeu.js';
import { creerClavier, creerJoueur } from './joueur.js';
import { ouvrirPartie } from './partie.js';
import { animerPersonnage, creerPersonnage, libererPersonnage } from './personnage.js';
import { choisirTransport } from './reseau/index.js';
import { JOUEURS_MAX, genererCode, normaliserCode } from './salon.js';
import { construireOptions } from './ui.js';

const $ = (id) => document.getElementById(id);

const CLE_PROFIL = 'le-protege/profil';
const DELAI_CONNEXION = 10000;
const FOV_CREATION = 55;
const FOV_JEU = 72;

function identifiant() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function chargerProfil() {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_PROFIL));
    if (p) return { nom: nettoyerNom(p.nom), apparence: normaliserApparence(p.apparence) };
  } catch {
    // Stockage indisponible (navigation privée) : on repart d'un profil neuf.
  }
  return { nom: '', apparence: apparenceAleatoire() };
}

function enregistrerProfil(p) {
  try {
    localStorage.setItem(CLE_PROFIL, JSON.stringify(p));
  } catch {
    // Sans stockage, le perso sera simplement à refaire la prochaine fois.
  }
}

// --- Rendu -----------------------------------------------------------------

const canvas = $('scene');
let rendu;
try {
  rendu = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (erreur) {
  $('sans-webgl').hidden = false;
  $('creation').hidden = true;
  throw erreur;
}
rendu.setPixelRatio(Math.min(devicePixelRatio, 2));
rendu.shadowMap.enabled = true;
rendu.shadowMap.type = THREE.PCFShadowMap;
rendu.toneMapping = THREE.NeutralToneMapping;
rendu.toneMappingExposure = 1.05;
// Plusieurs passes par image (post.js) : on remet les compteurs à zéro
// nous-mêmes, une fois par image, pour qu'ils les comptent toutes.
rendu.info.autoReset = false;

const etiquettes = new CSS2DRenderer();
etiquettes.domElement.className = 'calque-etiquettes';
canvas.after(etiquettes.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV_CREATION, 1, 0.05, 1200);
const ile = creerIle(scene);
const post = creerPostTraitement(rendu, scene, camera);
const orbite = creerOrbite(camera, canvas);
const clavier = creerClavier();
const joueur = creerJoueur();
const avatars = creerAvatars(scene);
// partie n'est lue qu'au moment d'envoyer, bien après son initialisation.
const jeu = creerJeu({
  scene, camera, canvas, rendu, ile, clavier, joueur, avatars,
  envoyer: (donnees) => partie?.envoyer(donnees),
});

let profil = chargerProfil();
let modele = null;

function habiller() {
  if (modele) libererPersonnage(modele);
  modele = creerPersonnage(profil.apparence);
  scene.add(modele);
  jeu.definirApparence(profil.apparence);
}
habiller();

// --- État de l'écran -------------------------------------------------------

let mode = 'creation'; // 'creation' | 'jeu' | 'edition'
let partie = null;

let monId = null;
let codeSalon = null;
let membres = [];
let dejaSynchronise = false;

function ajusterVue() {
  const w = innerWidth, h = innerHeight;
  if (mode === 'jeu') {
    camera.clearViewOffset();
    return;
  }
  // Le perso se place au centre de l'espace laissé libre par le panneau.
  const cadre = $('creation').getBoundingClientRect();
  camera.setViewOffset(w, h, -cadre.right / 2, 0, w, h);
}

function redimensionner() {
  const w = innerWidth, h = innerHeight;
  rendu.setSize(w, h, false);
  post.taille(w, h);
  etiquettes.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  ajusterVue();
}
addEventListener('resize', redimensionner);

function cadrerCreation() {
  orbite.cadrer({ lacet: joueur.etat.orientation, tangage: 0.12, distance: 3.6 });
}

function afficherErreur(texte) {
  $('erreur').textContent = texte;
  $('erreur').hidden = !texte;
}

function notifier(texte) {
  const div = document.createElement('div');
  div.className = 'notification';
  div.textContent = texte;
  $('notifications').append(div);
  setTimeout(() => div.remove(), 3500);
}

function occupe(oui) {
  $('creer').disabled = oui;
  $('rejoindre').disabled = oui;
  $('attente').hidden = !oui;
}

function afficherJoueurs() {
  const liste = $('joueurs');
  liste.replaceChildren(
    ...membres.map((m) => {
      const li = document.createElement('li');
      const point = document.createElement('span');
      point.className = 'point';
      point.style.setProperty('--couleur', m.apparence.salopette);
      const nom = document.createElement('span');
      nom.textContent = m.nom;
      li.append(point, nom);
      if (m.id === monId) {
        const toi = document.createElement('span');
        toi.className = 'toi';
        toi.textContent = '(toi)';
        li.append(toi);
      }
      return li;
    }),
  );
  $('nb-joueurs').textContent = String(membres.length);
}

// --- Panneau de création ---------------------------------------------------

const options = construireOptions($('options'), (champ, valeur) => {
  profil = { ...profil, apparence: normaliserApparence({ ...profil.apparence, [champ]: valeur }) };
  options.afficher(profil.apparence);
  habiller();
  enregistrerProfil(profil);
});
options.afficher(profil.apparence);

$('nom').value = profil.nom;
$('nom').addEventListener('input', () => {
  profil = { ...profil, nom: nettoyerNom($('nom').value) };
  enregistrerProfil(profil);
});

$('aleatoire').addEventListener('click', () => {
  profil = { ...profil, apparence: apparenceAleatoire() };
  options.afficher(profil.apparence);
  habiller();
  enregistrerProfil(profil);
});

$('nb-max').textContent = String(JOUEURS_MAX);

const codeInvitation = normaliserCode(new URLSearchParams(location.search).get('salon'));
if (codeInvitation) {
  $('code').value = codeInvitation;
  $('creer').classList.remove('principal');
  $('rejoindre').classList.add('principal');
  $('actions-accueil').prepend($('actions-accueil').querySelector('.rejoindre'));
  $('creer').textContent = 'Créer un autre salon';
  document.querySelector('.accroche').textContent = `Tu es invité dans le salon ${codeInvitation}. Crée ton perso, puis rejoins-le.`;
}

if (new URLSearchParams(location.search).has('debug')) {
  window.leProtege = { ...jeu.debug(), rendu: () => ({ ...rendu.info.render, ...rendu.info.memory }), jour: () => ile.jour };
}

const transport = await choisirTransport();
if (transport.mode === 'local') {
  $('mode-local').hidden = false;
  $('salon-local').hidden = false;
}

// --- Salon -----------------------------------------------------------------

function nomSaisi() {
  const nom = nettoyerNom($('nom').value);
  if (!nom) {
    afficherErreur('Choisis un nom pour ton perso.');
    $('nom').focus();
    return null;
  }
  return nom;
}

function entrer(code) {
  const nom = nomSaisi();
  if (!nom) return;
  profil = { ...profil, nom };
  enregistrerProfil(profil);
  afficherErreur('');
  occupe(true);
  monId = identifiant();
  dejaSynchronise = false;

  const delai = setTimeout(() => {
    if (partie?.statut !== 'attente') return;
    partie.quitter();
    partie = null;
    occupe(false);
    afficherErreur('Impossible de rejoindre le salon. Vérifie ta connexion et réessaie.');
  }, DELAI_CONNEXION);

  partie = ouvrirPartie({
    transport,
    code,
    monId,
    profil,
    rappels: {
      surAdmission() {
        clearTimeout(delai);
        occupe(false);
        codeSalon = code;
        demarrerJeu();
      },
      surRefus() {
        clearTimeout(delai);
        occupe(false);
        if (mode !== 'creation') retourAccueil();
        partie = null;
        afficherErreur(`Le salon ${code} est complet (${JOUEURS_MAX} joueurs maximum).`);
      },
      surMembres(liste) {
        membres = liste;
        const { arrives, partis } = avatars.synchroniser(liste, monId);
        if (dejaSynchronise) {
          for (const nom of arrives) notifier(`${nom} a rejoint le salon`);
          for (const nom of partis) notifier(`${nom} a quitté le salon`);
        }
        dejaSynchronise = true;
        jeu.surMembres(liste, monId);
        // Un nouveau venu doit voir tout de suite où l'on se trouve.
        if (arrives.length) jeu.envoyerEtat(true);
        afficherJoueurs();
      },
      surMessage(de, donnees) {
        if (donnees?.type === 'etat') avatars.appliquerEtat(de, donnees);
        else jeu.surMessage(de, donnees);
      },
      surStatut(statut) {
        $('reseau').hidden = !(statut === 'erreur' && mode !== 'creation');
      },
    },
  });
}

function demarrerJeu() {
  mode = 'jeu';
  $('creation').hidden = true;
  $('hud').hidden = false;
  $('code-salon').textContent = codeSalon;
  history.replaceState(null, '', `${location.pathname}?salon=${codeSalon}`);
  ajusterVue();
  document.activeElement?.blur();
  canvas.focus();
}

function retourAccueil() {
  partie?.quitter();
  partie = null;
  jeu.quitter();
  membres = [];
  avatars.synchroniser([], monId);
  mode = 'creation';
  $('hud').hidden = true;
  $('reseau').hidden = true;
  $('creation').hidden = false;
  $('actions-accueil').hidden = false;
  $('actions-edition').hidden = true;
  history.replaceState(null, '', location.pathname);
  cadrerCreation();
  ajusterVue();
}

$('creer').addEventListener('click', () => entrer(genererCode()));

function rejoindre() {
  const code = normaliserCode($('code').value);
  if (!code) {
    afficherErreur('Code invalide : 4 caractères, par exemple K7PX.');
    $('code').focus();
    return;
  }
  entrer(code);
}
$('rejoindre').addEventListener('click', rejoindre);
$('code').addEventListener('keydown', (e) => e.key === 'Enter' && rejoindre());
$('nom').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (mode === 'edition') $('retour').click();
  else if (codeInvitation) rejoindre();
  else $('creer').click();
});

$('modifier').addEventListener('click', () => {
  mode = 'edition';
  $('hud').hidden = true;
  $('creation').hidden = false;
  $('actions-accueil').hidden = true;
  $('actions-edition').hidden = false;
  afficherErreur('');
  cadrerCreation();
  ajusterVue();
});

$('retour').addEventListener('click', () => {
  const nom = nomSaisi();
  if (!nom) return;
  profil = { ...profil, nom };
  enregistrerProfil(profil);
  afficherErreur('');
  partie?.changerProfil(profil);
  demarrerJeu();
});

$('quitter').addEventListener('click', retourAccueil);

$('copier').addEventListener('click', async () => {
  const lien = `${location.origin}${location.pathname}?salon=${codeSalon}`;
  try {
    await navigator.clipboard.writeText(lien);
    notifier(transport.mode === 'local'
      ? 'Lien copié, mais en mode local il ne marche que dans ce navigateur.'
      : 'Lien copié : envoie-le à tes amis.');
  } catch {
    prompt('Copie ce lien et envoie-le à tes amis :', lien);
  }
});

addEventListener('pagehide', () => partie?.quitter());

// --- Boucle ----------------------------------------------------------------

const horloge = new THREE.Timer();
// Au retour d'un onglet masqué, pas de pas de temps géant.
horloge.connect(document);
const pointVise = new THREE.Vector3();
const immobile = { avant: 0, lateral: 0, course: false, saut: false };
let temps = 0;
let premiereImage = true;

cadrerCreation();
redimensionner();

rendu.setAnimationLoop((instant) => {
  horloge.update(instant);
  rendu.info.reset();
  const dt = Math.min(horloge.getDelta(), 0.1);
  temps += dt;

  const fov = mode === 'jeu' ? FOV_JEU : FOV_CREATION;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  document.body.classList.toggle('en-jeu', mode === 'jeu');

  // Dans un salon, la partie avance même pendant qu'on retouche son perso.
  if (partie?.statut === 'admis') jeu.mettreAJour(dt, { enJeu: mode === 'jeu' });

  // À la première personne, son propre perso n'est pas dessiné.
  const e = joueur.etat;
  modele.visible = mode !== 'jeu';
  if (mode !== 'jeu') {
    joueur.mettreAJour(dt, immobile, orbite.reglage.lacet);
    modele.position.set(e.x, e.y, e.z);
    modele.rotation.y = e.orientation;
    animerPersonnage(modele, dt, { vitesse: e.vitesse, regardFixe: true });
    pointVise.set(e.x, e.y + 1.25, e.z);
    orbite.mettreAJour(dt, pointVise, premiereImage);
    premiereImage = false;
  }
  ile.mettreAJour(temps, dt);

  post.rendre(dt, ile.jour);
  etiquettes.render(scene, camera);
});
