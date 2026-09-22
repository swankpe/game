// Le pistolet vu à la première personne et les effets de tir : recul, éclair
// de bouche, traînée de balle. Le nombre de lumières reste fixe (réserve de
// NB_ECLAIRS) : en ajouter ou en retirer forcerait Three.js à recompiler
// tous les shaders, d'où une saccade à chaque tir.

import * as THREE from 'three';
import { BOUCHE_PISTOLET, creerPistolet } from './personnage.js';

const NB_ECLAIRS = 4;
const NB_TRAINEES = 12;
const DUREE_ECLAIR = 0.06;
const DUREE_TRAINEE = 0.08;

export function creerArme(scene, camera) {
  const vue = new THREE.Group();
  const repos = new THREE.Vector3(0.22, -0.22, -0.46);
  vue.position.copy(repos);
  vue.scale.setScalar(0.8);
  const pistolet = creerPistolet();
  pistolet.rotation.y = Math.PI;
  vue.add(pistolet);
  const peau = new THREE.MeshStandardMaterial({ color: '#e3bf86', flatShading: true, roughness: 0.85 });
  const tissu = new THREE.MeshStandardMaterial({ color: '#343d6b', flatShading: true, roughness: 0.9 });
  const main = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), peau);
  main.position.set(0, -0.07, 0.03);
  main.scale.set(1, 1.2, 1.3);
  const manche = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.4, 6), tissu);
  manche.rotation.x = Math.PI / 2 - 0.35;
  manche.position.set(0.01, -0.14, 0.24);
  vue.add(main, manche);
  const flamme = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.05, 0),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.9 }),
  );
  flamme.position.copy(BOUCHE_PISTOLET).setZ(BOUCHE_PISTOLET.z + 0.03);
  flamme.visible = false;
  pistolet.add(flamme);
  camera.add(vue);

  const eclairs = Array.from({ length: NB_ECLAIRS }, () => {
    const l = new THREE.PointLight('#ffc873', 0, 9, 2);
    scene.add(l);
    return { l, reste: 0 };
  });
  let prochainEclair = 0;

  const matTrainee = () => new THREE.LineBasicMaterial({ color: '#ffe6a0', transparent: true, opacity: 0 });
  const trainees = Array.from({ length: NB_TRAINEES }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const ligne = new THREE.Line(geo, matTrainee());
    ligne.frustumCulled = false;
    scene.add(ligne);
    return { ligne, reste: 0 };
  });
  let prochaineTrainee = 0;

  let recul = 0;
  let flammeReste = 0;
  let balancement = 0;
  const tampon = new THREE.Vector3();

  return {
    definirCouleurs(couleurPeau, couleurHaut) {
      peau.color.set(couleurPeau);
      tissu.color.set(couleurHaut);
    },
    afficher(oui) {
      vue.visible = oui;
    },
    // Recul et flamme ; renvoie la position monde de la bouche du canon.
    tirer() {
      recul = 1;
      flammeReste = 0.05;
      flamme.rotation.z = Math.random() * Math.PI;
      pistolet.updateWorldMatrix(true, false);
      return pistolet.localToWorld(tampon.copy(BOUCHE_PISTOLET)).clone();
    },
    eclair(position) {
      const e = eclairs[prochainEclair];
      prochainEclair = (prochainEclair + 1) % NB_ECLAIRS;
      e.l.position.copy(position);
      e.reste = DUREE_ECLAIR;
    },
    trainee(debut, fin) {
      const t = trainees[prochaineTrainee];
      prochaineTrainee = (prochaineTrainee + 1) % NB_TRAINEES;
      const pos = t.ligne.geometry.attributes.position;
      pos.setXYZ(0, debut.x, debut.y, debut.z);
      pos.setXYZ(1, fin.x, fin.y, fin.z);
      pos.needsUpdate = true;
      t.reste = DUREE_TRAINEE;
    },
    // marche : vitesse du joueur, pour le balancement de l'arme.
    mettreAJour(dt, marche = 0) {
      recul = Math.max(0, recul - dt * 9);
      balancement += dt * (4 + marche * 1.6);
      const ampleur = Math.min(marche / 6, 1);
      vue.position.set(
        repos.x + Math.sin(balancement) * 0.012 * ampleur,
        repos.y + Math.abs(Math.cos(balancement)) * 0.014 * ampleur,
        repos.z + recul * 0.06,
      );
      vue.rotation.x = recul * 0.18;
      flammeReste -= dt;
      flamme.visible = flammeReste > 0;
      for (const e of eclairs) {
        e.reste = Math.max(0, e.reste - dt);
        e.l.intensity = e.reste > 0 ? 28 * (e.reste / DUREE_ECLAIR) : 0;
      }
      for (const t of trainees) {
        t.reste = Math.max(0, t.reste - dt);
        t.ligne.material.opacity = (t.reste / DUREE_TRAINEE) * 0.85;
        t.ligne.visible = t.reste > 0;
      }
    },
  };
}
