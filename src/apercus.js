// Vignettes des armes pour la boutique et la barre d'armes : chaque modèle
// est photographié une fois, en studio, par le moteur de rendu du jeu, dans
// une image à fond transparent. Aucune image à télécharger.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { creerModeleArme, libererModele } from './armes.js';

const LARGEUR = 640;
const HAUTEUR = 320;

export function genererApercus(rendu, ids) {
  const scene = new THREE.Scene();
  // Un studio virtuel à refléter : sans lui, le métal paraît noir.
  const pmrem = new THREE.PMREMGenerator(rendu);
  const studio = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = studio.texture;
  scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight('#f2f5ff', '#3a3226', 1.2));
  const cle = new THREE.DirectionalLight('#fff4e0', 3.2);
  cle.position.set(-1.5, 2, 2.5);
  const contre = new THREE.DirectionalLight('#9fc4ff', 2.4);
  contre.position.set(2, 1, -2.5);
  scene.add(cle, contre);

  const camera = new THREE.PerspectiveCamera(24, LARGEUR / HAUTEUR, 0.01, 20);
  const cible = new THREE.WebGLRenderTarget(LARGEUR, HAUTEUR, { samples: 4 });
  cible.texture.colorSpace = THREE.SRGBColorSpace;
  const pixels = new Uint8Array(LARGEUR * HAUTEUR * 4);
  const toile = document.createElement('canvas');
  toile.width = LARGEUR;
  toile.height = HAUTEUR;
  const ctx = toile.getContext('2d');

  const fond = new THREE.Color();
  rendu.getClearColor(fond);
  const alphaFond = rendu.getClearAlpha();
  const ombres = rendu.shadowMap.enabled;
  rendu.shadowMap.enabled = false;
  rendu.setClearColor(0x000000, 0);

  const images = {};
  for (const id of ids) {
    const modele = creerModeleArme(id);
    // Vue de trois quarts, canon vers la droite, légèrement plongeante.
    modele.rotation.set(-0.1, Math.PI / 2 - 0.38, 0);
    scene.add(modele);
    const boite = new THREE.Box3().setFromObject(modele);
    const centre = boite.getCenter(new THREE.Vector3());
    const taille = boite.getSize(new THREE.Vector3());
    modele.position.sub(centre);
    const rayon = Math.max(taille.x, taille.y * 2, taille.z) * 0.55;
    const distance = rayon / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect * 1.25;
    camera.position.set(0, rayon * 0.15, distance);
    camera.lookAt(0, 0, 0);

    rendu.setRenderTarget(cible);
    rendu.clear();
    rendu.render(scene, camera);
    rendu.readRenderTargetPixels(cible, 0, 0, LARGEUR, HAUTEUR, pixels);
    rendu.setRenderTarget(null);

    // Les pixels arrivent la tête en bas.
    const image = ctx.createImageData(LARGEUR, HAUTEUR);
    for (let y = 0; y < HAUTEUR; y++) {
      image.data.set(pixels.subarray((HAUTEUR - 1 - y) * LARGEUR * 4, (HAUTEUR - y) * LARGEUR * 4), y * LARGEUR * 4);
    }
    ctx.putImageData(image, 0, 0);
    images[id] = toile.toDataURL('image/png');
    libererModele(modele);
  }

  rendu.setClearColor(fond, alphaFond);
  rendu.shadowMap.enabled = ombres;
  cible.dispose();
  studio.dispose();
  pmrem.dispose();
  return images;
}
