// L'arme vue à la première personne et les effets de tir : recul, éclair de
// bouche, traînées de balles, explosions. Le nombre de lumières reste fixe
// (réserves d'éclairs et d'explosions) : en ajouter ou en retirer forcerait
// Three.js à recompiler tous les shaders, d'où une saccade à chaque tir.

import * as THREE from 'three';
import { creerModeleArme } from './armes.js';
import { ARMES } from './regles.js';

const NB_ECLAIRS = 4;
const NB_TRAINEES = 24;
const NB_EXPLOSIONS = 3;
const DUREE_ECLAIR = 0.06;
const DUREE_TRAINEE = 0.07;
const DUREE_EXPLOSION = 0.9;
const DUREE_BASCULE = 0.16;

// Place de chaque arme dans le champ de vision (repère caméra) et force du
// recul visuel.
const CADRAGE = {
  pistolet: { position: [0.2, -0.2, -0.42], recul: 1 },
  uzi: { position: [0.19, -0.19, -0.4], recul: 0.35 },
  fusil: { position: [0.17, -0.19, -0.36], recul: 0.55 },
  lance: { position: [0.18, -0.21, -0.42], recul: 1.4 },
};

function std(color, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
}

// Cylindre tendu entre deux points (une manche, de la main vers l'épaule).
function segment(a, b, rayon, mat) {
  const d = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rayon * 0.92, rayon, d.length(), 7), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

export function creerArme(scene, camera) {
  const peau = std('#e3bf86');
  const tissu = std('#343d6b', 0.9);
  const vues = {};

  for (const { id } of ARMES) {
    const groupe = new THREE.Group();
    groupe.position.set(...CADRAGE[id].position);
    groupe.scale.setScalar(0.85);
    groupe.visible = false;
    const modele = creerModeleArme(id);
    // Canon vers l'avant de la caméra (-z).
    modele.rotation.y = Math.PI;
    groupe.add(modele);
    const { poignee, garde, bouche } = modele.userData;
    // Repère du modèle retourné : l'épaule droite est en (-x, -y, -z). Les
    // manches plongent vers le bas de l'écran pour ne pas masquer la vue.
    const mains = [[poignee, new THREE.Vector3(-0.04, -0.24, -0.3), 0.042]];
    if (garde) mains.push([garde, new THREE.Vector3(0.05, -0.34, -0.1), 0.036]);
    for (const [point, vers, rayon] of mains) {
      const main = new THREE.Mesh(new THREE.IcosahedronGeometry(0.036, 0), peau);
      main.position.copy(point);
      main.scale.set(1, 1.15, 1.4);
      modele.add(main);
      modele.add(segment(point.clone().add(new THREE.Vector3(0, -0.02, -0.01)), point.clone().add(vers), rayon, tissu));
    }
    const flamme = new THREE.Mesh(
      new THREE.OctahedronGeometry(id === 'lance' ? 0.07 : 0.05, 0),
      new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.9 }),
    );
    flamme.position.copy(bouche).setZ(bouche.z + 0.03);
    flamme.visible = false;
    modele.add(flamme);
    groupe.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    camera.add(groupe);
    vues[id] = { groupe, modele, flamme, repos: new THREE.Vector3(...CADRAGE[id].position) };
  }

  // Petite lumière d'appoint : on voit son arme même en pleine nuit.
  const appoint = new THREE.PointLight('#fff1dc', 0.25, 1.3, 2);
  appoint.position.set(0.05, 0.25, -0.1);
  camera.add(appoint);

  const eclairs = Array.from({ length: NB_ECLAIRS }, () => {
    const l = new THREE.PointLight('#ffc873', 0, 9, 2);
    scene.add(l);
    return { l, reste: 0 };
  });
  let prochainEclair = 0;

  const trainees = Array.from({ length: NB_TRAINEES }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const ligne = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffe6a0', transparent: true, opacity: 0 }));
    ligne.frustumCulled = false;
    ligne.visible = false;
    scene.add(ligne);
    return { ligne, reste: 0 };
  });
  let prochaineTrainee = 0;

  const explosions = Array.from({ length: NB_EXPLOSIONS }, () => {
    const boule = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    const fumee = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: '#2b2b2e', transparent: true, opacity: 0, depthWrite: false, flatShading: true }),
    );
    const eclats = Array.from({ length: 10 }, () => {
      const e = new THREE.Mesh(new THREE.TetrahedronGeometry(0.07), std('#2a2522'));
      e.userData.v = new THREE.Vector3();
      return e;
    });
    const lumiere = new THREE.PointLight('#ffa14a', 0, 18, 1.6);
    for (const o of [boule, fumee, ...eclats]) {
      o.visible = false;
      scene.add(o);
    }
    scene.add(lumiere);
    return { boule, fumee, eclats, lumiere, t: -1 };
  });
  let prochaineExplosion = 0;

  let affichee = 'pistolet';
  let voulue = 'pistolet';
  let abaisse = 0;
  let recul = 0;
  let flammeReste = 0;
  let balancement = 0;
  let visible = false;
  vues.pistolet.groupe.visible = true;
  const tampon = new THREE.Vector3();

  return {
    definirCouleurs(couleurPeau, couleurHaut) {
      peau.color.set(couleurPeau);
      tissu.color.set(couleurHaut);
    },
    afficher(oui) {
      visible = oui;
    },
    equiper(id) {
      if (vues[id]) voulue = id;
    },
    // Vrai quand l'arme voulue est en main (pas pendant le changement).
    prete() {
      return affichee === voulue && abaisse < 0.2;
    },
    // Recul et flamme ; renvoie la position monde de la bouche du canon.
    tirer() {
      const v = vues[affichee];
      recul = Math.min(recul + CADRAGE[affichee].recul, 1.6);
      flammeReste = 0.05;
      v.flamme.rotation.z = Math.random() * Math.PI;
      v.modele.updateWorldMatrix(true, false);
      return v.modele.localToWorld(tampon.copy(v.modele.userData.bouche)).clone();
    },
    eclair(position, force = 1) {
      const e = eclairs[prochainEclair];
      prochainEclair = (prochainEclair + 1) % NB_ECLAIRS;
      e.l.position.copy(position);
      e.reste = DUREE_ECLAIR;
      e.force = force;
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
    explosion(position, rayon) {
      const e = explosions[prochaineExplosion];
      prochaineExplosion = (prochaineExplosion + 1) % NB_EXPLOSIONS;
      e.t = 0;
      e.rayon = rayon;
      for (const o of [e.boule, e.fumee, e.lumiere]) o.position.copy(position);
      e.fumee.position.y += 0.4;
      for (const eclat of e.eclats) {
        eclat.position.copy(position);
        eclat.userData.v.set(Math.random() - 0.5, Math.random() * 0.9 + 0.3, Math.random() - 0.5).normalize().multiplyScalar(6 + Math.random() * 5);
        eclat.visible = true;
      }
      e.boule.visible = e.fumee.visible = true;
    },
    // marche : vitesse du joueur, pour le balancement de l'arme.
    mettreAJour(dt, marche = 0) {
      // Changement d'arme : l'ancienne descend, la nouvelle remonte.
      if (affichee !== voulue) {
        abaisse = Math.min(1, abaisse + dt / DUREE_BASCULE);
        if (abaisse >= 1) {
          vues[affichee].groupe.visible = false;
          affichee = voulue;
        }
      } else {
        abaisse = Math.max(0, abaisse - dt / DUREE_BASCULE);
      }
      for (const [id, v] of Object.entries(vues)) v.groupe.visible = visible && id === affichee;

      recul = Math.max(0, recul - dt * 9);
      balancement += dt * (4 + marche * 1.6);
      const ampleur = Math.min(marche / 6, 1);
      const v = vues[affichee];
      v.groupe.position.set(
        v.repos.x + Math.sin(balancement) * 0.012 * ampleur,
        v.repos.y + Math.abs(Math.cos(balancement)) * 0.014 * ampleur - abaisse * 0.25,
        v.repos.z + recul * 0.05,
      );
      v.groupe.rotation.x = recul * 0.16 - abaisse * 0.7;
      flammeReste -= dt;
      v.flamme.visible = flammeReste > 0;

      for (const e of eclairs) {
        e.reste = Math.max(0, e.reste - dt);
        e.l.intensity = e.reste > 0 ? 28 * (e.force ?? 1) * (e.reste / DUREE_ECLAIR) : 0;
      }
      for (const t of trainees) {
        t.reste = Math.max(0, t.reste - dt);
        t.ligne.material.opacity = (t.reste / DUREE_TRAINEE) * 0.85;
        t.ligne.visible = t.reste > 0;
      }
      for (const e of explosions) {
        if (e.t < 0) continue;
        e.t += dt;
        const f = e.t / DUREE_EXPLOSION;
        if (f >= 1) {
          e.t = -1;
          e.lumiere.intensity = 0;
          for (const o of [e.boule, e.fumee, ...e.eclats]) o.visible = false;
          continue;
        }
        const r = e.rayon * (0.25 + 0.75 * Math.sqrt(Math.min(f * 3, 1)));
        e.boule.scale.setScalar(r * 0.8);
        e.boule.material.opacity = Math.max(0, 0.9 - f * 2.2);
        e.boule.material.color.setHSL(0.09 - f * 0.06, 1, 0.65 - f * 0.3);
        e.fumee.scale.setScalar(r * (0.6 + f * 0.6));
        e.fumee.position.y += dt * 0.8;
        e.fumee.material.opacity = Math.sin(Math.min(f * 1.2, 1) * Math.PI) * 0.55;
        e.lumiere.intensity = 160 * Math.max(0, 1 - f * 2.5);
        for (const eclat of e.eclats) {
          eclat.userData.v.y -= 14 * dt;
          eclat.position.addScaledVector(eclat.userData.v, dt);
          eclat.rotation.x += dt * 9;
          eclat.rotation.y += dt * 7;
        }
      }
    },
  };
}
