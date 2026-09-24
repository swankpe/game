// L'autel de chaque carte : un disque de pierre à fleur de sol, un cercle de
// runes, quatre bougies, et une colonne de lumière qui monte vers le ciel
// pour qu'on le trouve de loin. Y poser le protégé appelle le boss : les runes
// s'embrasent pendant le rituel, virent au rouge pendant le combat.

import * as THREE from 'three';
import { colorer, fusionner, hachage, lumineux, place } from './geometrie.js';
import { fusionnerPositions, PIERRES } from './decor-commun.js';

// Réglages de chaque état : couleur, force des runes, opacité de la colonne,
// intensité de la lampe, vitesse du battement.
const ETATS = {
  repos: { couleur: '#9a7bff', runes: 1.6, colonne: 0.05, lampe: 2, battement: 1.2 },
  rituel: { couleur: '#c9b6ff', runes: 6, colonne: 0.34, lampe: 14, battement: 6 },
  boss: { couleur: '#ff4a3a', runes: 4.5, colonne: 0.22, lampe: 9, battement: 3 },
  eteint: { couleur: '#6b5a8a', runes: 0.4, colonne: 0, lampe: 0, battement: 0.5 },
};

// Dégradé vertical de la colonne : vive au pied, qui se perd en hauteur.
function textureColonne() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const g = c.getContext('2d');
  const d = g.createLinearGradient(0, 0, 0, 128);
  d.addColorStop(0, 'rgba(255, 255, 255, 0)');
  d.addColorStop(0.7, 'rgba(255, 255, 255, 0.35)');
  d.addColorStop(1, 'rgba(255, 255, 255, 1)');
  g.fillStyle = d;
  g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// autel : { x, z, rayon } ; y : hauteur du sol au centre.
export function creerAutel({ x, z, rayon }, y) {
  const groupe = new THREE.Group();
  groupe.position.set(x, y, z);
  const pierre = [];
  // Le disque, à peine surélevé : le protégé s'y tient debout. Ses fondations
  // descendent pour rattraper la pente.
  pierre.push(colorer(new THREE.CylinderGeometry(rayon + 0.35, rayon + 0.55, 0.7, 18).translate(0, -0.25, 0), PIERRES[1], 0.08));
  pierre.push(colorer(new THREE.CylinderGeometry(rayon - 0.1, rayon + 0.05, 0.06, 18).translate(0, 0.12, 0), '#5d5850', 0.06));
  // Dalles du pourtour.
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    pierre.push(colorer(place(new THREE.BoxGeometry(0.9, 0.08, 0.34), { x: Math.cos(a) * (rayon + 0.15), y: 0.1, z: Math.sin(a) * (rayon + 0.15), ry: -a + Math.PI / 2 }), PIERRES[k % PIERRES.length], 0.1));
  }
  // Quatre bougeoirs de pierre sur le bord, et leurs bougies.
  const bougies = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, r = rayon + 0.2;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    pierre.push(colorer(place(new THREE.CylinderGeometry(0.14, 0.2, 0.45, 6), { x: bx, y: 0.32, z: bz }), PIERRES[(k + 2) % PIERRES.length], 0.08));
    pierre.push(colorer(place(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), { x: bx, y: 0.66, z: bz }), '#efe6d2', 0.04));
    bougies.push(place(new THREE.ConeGeometry(0.045, 0.14, 5), { x: bx, y: 0.84, z: bz }));
  }
  const socle = fusionner(pierre);
  // Les runes : un cercle et huit signes gravés, qui brillent.
  const runes = [];
  const anneau = new THREE.RingGeometry(rayon - 0.42, rayon - 0.3, 40, 1);
  anneau.rotateX(-Math.PI / 2);
  anneau.translate(0, 0.16, 0);
  runes.push(anneau);
  const interieur = new THREE.RingGeometry(0.5, 0.58, 24, 1);
  interieur.rotateX(-Math.PI / 2);
  interieur.translate(0, 0.16, 0);
  runes.push(interieur);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, r = (rayon - 0.36 + 0.55) / 2;
    const traits = 2 + Math.floor(hachage(k, 3) * 2);
    for (let t = 0; t < traits; t++) {
      const g = new THREE.PlaneGeometry(0.05, 0.28 - t * 0.05);
      g.rotateX(-Math.PI / 2);
      g.rotateY(-a + (t - 1) * 0.7 + hachage(k, t) * 0.4);
      g.translate(Math.cos(a) * r, 0.161, Math.sin(a) * r);
      runes.push(g);
    }
  }
  const matRunes = new THREE.MeshBasicMaterial({ color: '#9a7bff', fog: false, side: THREE.DoubleSide });
  const maillageRunes = new THREE.Mesh(fusionnerPositions(runes), matRunes);
  const matBougies = new THREE.MeshBasicMaterial({ color: lumineux('#ffb347', 6), fog: false });
  const flammes = new THREE.Mesh(fusionnerPositions(bougies), matBougies);
  // La colonne de lumière, ouverte, visible des deux côtés.
  const matColonne = new THREE.MeshBasicMaterial({
    map: textureColonne(), color: '#9a7bff', transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const colonne = new THREE.Mesh(new THREE.CylinderGeometry(rayon * 0.55, rayon * 0.75, 60, 20, 1, true).translate(0, 30, 0), matColonne);
  // La lampe : ile.js la sort du groupe (nombre de lumières constant).
  const lampe = new THREE.PointLight('#9a7bff', 2, 16, 1.6);
  lampe.position.set(0, 1.4, 0);
  groupe.add(socle, maillageRunes, flammes, colonne, lampe);

  let etat = ETATS.repos, temps = 0;
  const couleur = new THREE.Color(etat.couleur), cible = new THREE.Color();
  let force = etat.runes, opacite = etat.colonne, intensite = etat.lampe;
  groupe.userData.lampe = lampe;
  // mode : 'repos' | 'rituel' | 'boss' | 'eteint'.
  groupe.userData.regler = (mode) => {
    etat = ETATS[mode] ?? ETATS.repos;
  };
  // allumee : faux quand la carte n'est pas affichée (la lampe reste éteinte).
  groupe.userData.animer = (dt, nuit, allumee = true) => {
    temps += dt;
    const f = 1 - Math.exp(-dt * 3);
    couleur.lerp(cible.set(etat.couleur), f);
    force += (etat.runes - force) * f;
    opacite += (etat.colonne - opacite) * f;
    intensite += (etat.lampe - intensite) * f;
    const battement = 0.75 + 0.25 * Math.sin(temps * etat.battement);
    matRunes.color.copy(couleur).multiplyScalar(force * battement);
    matColonne.color.copy(couleur);
    // Le jour, la colonne se voit moins ; pendant le rituel, toujours.
    matColonne.opacity = opacite * (0.5 + 0.5 * battement) * (0.45 + 0.55 * nuit);
    colonne.visible = matColonne.opacity > 0.005;
    lampe.color.copy(couleur);
    lampe.intensity = allumee ? intensite * battement : 0;
    const v = 0.85 + Math.sin(temps * 12) * 0.1;
    matBougies.color.setRGB(1, 0.62 + v * 0.1, 0.25).multiplyScalar(6 * v);
  };
  return groupe;
}
