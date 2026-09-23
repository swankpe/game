// Particules du combat : éclats de sang (ou de bave, ou d'eau croupie pour le
// boss), poussière et étincelles là où la balle frappe le sol ou un mur,
// douilles éjectées, bouffées de fumée, flaques laissées par les zombies. Réserves fixes d'InstancedMesh : un
// appel de dessin par famille, rien n'est créé pendant la partie. Les
// particules rebondissent sur le sol de la carte en cours.

import * as THREE from 'three';
import { lumineux } from './geometrie.js';
import { carte } from './monde.js';

const GRAVITE = 9.8;

// Une famille : un maillage instancié et l'état de chaque particule.
function famille(scene, geo, mat, max, { couleurs = false, ombre = false } = {}) {
  const maillage = new THREE.InstancedMesh(geo, mat, max);
  maillage.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  maillage.frustumCulled = false;
  maillage.castShadow = ombre;
  if (couleurs) {
    for (let i = 0; i < max; i++) maillage.setColorAt(i, new THREE.Color());
  }
  const vide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < max; i++) maillage.setMatrixAt(i, vide);
  scene.add(maillage);
  return {
    maillage, max, prochaine: 0,
    p: new Float32Array(max * 3), v: new Float32Array(max * 3), axe: new Float32Array(max * 3),
    vie: new Float32Array(max), duree: new Float32Array(max), taille: new Float32Array(max),
    rebond: new Float32Array(max), grossit: new Float32Array(max), freine: new Float32Array(max), gravite: new Float32Array(max),
  };
}

function lancer(f, [x, y, z], [vx, vy, vz], { duree, taille, rebond = 0.3, grossit = 0, freine = 0, gravite = 1, couleur = null }) {
  const i = f.prochaine;
  f.prochaine = (i + 1) % f.max;
  f.p.set([x, y, z], i * 3);
  f.v.set([vx, vy, vz], i * 3);
  f.axe.set([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5], i * 3);
  f.vie[i] = duree;
  f.duree[i] = duree;
  f.taille[i] = taille;
  f.rebond[i] = rebond;
  f.grossit[i] = grossit;
  f.freine[i] = freine;
  f.gravite[i] = gravite;
  if (couleur) f.maillage.setColorAt(i, couleur);
}

const matrice = new THREE.Matrix4();
const rotation = new THREE.Quaternion();
const axe = new THREE.Vector3();
const position = new THREE.Vector3();
const echelle = new THREE.Vector3();

function avancer(f, dt) {
  let bouge = false;
  const c = carte();
  for (let i = 0; i < f.max; i++) {
    if (f.vie[i] <= 0) continue;
    bouge = true;
    f.vie[i] -= dt;
    const k = i * 3;
    if (f.vie[i] <= 0) {
      f.maillage.setMatrixAt(i, matrice.makeScale(0, 0, 0));
      continue;
    }
    const frein = Math.exp(-f.freine[i] * dt);
    f.v[k] *= frein;
    f.v[k + 2] *= frein;
    f.v[k + 1] = f.v[k + 1] * frein - GRAVITE * f.gravite[i] * dt;
    f.p[k] += f.v[k] * dt;
    f.p[k + 1] += f.v[k + 1] * dt;
    f.p[k + 2] += f.v[k + 2] * dt;
    const sol = c.hauteurSol(f.p[k], f.p[k + 2]) + 0.01;
    if (f.p[k + 1] < sol && f.gravite[i] > 0) {
      f.p[k + 1] = sol;
      f.v[k + 1] = Math.abs(f.v[k + 1]) * f.rebond[i];
      f.v[k] *= 0.5;
      f.v[k + 2] *= 0.5;
    }
    const age = f.duree[i] - f.vie[i];
    const fin = Math.min(1, f.vie[i] / Math.min(0.35, f.duree[i] * 0.5));
    if (f.plat) {
      // Une flaque s'étale vite, reste, puis se résorbe.
      const s = f.taille[i] * Math.min(1, age * 2.5) * Math.min(1, f.vie[i] / 1.5);
      matrice.compose(position.set(f.p[k], sol + 0.012 + (i % 7) * 0.002, f.p[k + 2]), rotation.identity(), echelle.set(s, 1, s));
      f.maillage.setMatrixAt(i, matrice);
      continue;
    }
    const s = f.taille[i] * (1 + f.grossit[i] * age) * fin;
    axe.set(f.axe[k], f.axe[k + 1], f.axe[k + 2]).normalize();
    // Au sol, ça ne tourne plus.
    const tour = f.p[k + 1] <= sol + 0.005 ? 0 : age * 12;
    rotation.setFromAxisAngle(axe, tour + f.axe[k] * 6);
    matrice.compose(position.set(f.p[k], f.p[k + 1], f.p[k + 2]), rotation, echelle.set(s, s, s));
    f.maillage.setMatrixAt(i, matrice);
  }
  if (bouge) {
    f.maillage.instanceMatrix.needsUpdate = true;
    if (f.maillage.instanceColor) f.maillage.instanceColor.needsUpdate = true;
  }
}

// Couleurs des éclats selon ce qui est touché.
const TEINTES = {
  sang: ['#5e0d0d', '#7a1512', '#4a0909'],
  bave: ['#7fbf2e', '#5a8f22', '#a8d94a'],
  noye: ['#2f5d57', '#3f7a6f', '#1f3d3a'],
  sol: ['#6d6255', '#857a6a', '#5a5046'],
  sable: ['#d9c28c', '#c9b07a', '#e6d3a3'],
  pierre: ['#8b857a', '#6e6a63', '#a09a8e'],
};

// Une flaque : un disque aux bords irréguliers, à plat.
function geometrieFlaque() {
  const forme = new THREE.Shape();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.75 + 0.25 * Math.sin(a * 3 + 1) * Math.cos(a * 2);
    if (i === 0) forme.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else forme.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(forme).rotateX(-Math.PI / 2);
}

export function creerParticules(scene) {
  const eclats = famille(scene, new THREE.TetrahedronGeometry(1), new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), 260, { couleurs: true });
  const flaques = famille(
    scene,
    geometrieFlaque(),
    new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    24,
    { couleurs: true },
  );
  flaques.plat = true;
  const etincelles = famille(scene, new THREE.BoxGeometry(0.4, 0.4, 2.2), new THREE.MeshBasicMaterial({ color: lumineux('#ffc36b', 7) }), 90);
  const douilles = famille(
    scene,
    new THREE.CylinderGeometry(1, 1, 3.4, 7).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#d7ab4b', roughness: 0.3, metalness: 0.85 }),
    40,
  );
  const fumees = famille(
    scene,
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.28, depthWrite: false }),
    60,
    { couleurs: true },
  );
  const gris = new THREE.Color('#8f8f96');
  const couleur = new THREE.Color();
  const teinte = (nom) => couleur.set(TEINTES[nom][Math.floor(Math.random() * TEINTES[nom].length)]).multiplyScalar(0.85 + Math.random() * 0.3);
  const hasard = (a) => (Math.random() - 0.5) * 2 * a;

  return {
    // point : où la balle frappe ; direction : d'où elle vient (normée) ;
    // genre : 'sang', 'bave', 'noye' (zombies) ou 'sol', 'sable', 'pierre'.
    impact(point, direction, genre) {
      const p = [point.x, point.y, point.z];
      const zombie = genre === 'sang' || genre === 'bave' || genre === 'noye';
      const n = zombie ? 9 : 6;
      for (let i = 0; i < n; i++) {
        // Les éclats repartent vers le tireur et vers le haut, ou traversent.
        const recul = zombie && i % 3 === 0 ? 1 : -1;
        lancer(eclats, p, [direction.x * 2.2 * recul + hasard(1.6), 1 + Math.random() * 2.2, direction.z * 2.2 * recul + hasard(1.6)], {
          duree: zombie ? 1.6 + Math.random() : 0.7 + Math.random() * 0.4,
          taille: (zombie ? 0.05 : 0.03) * (0.6 + Math.random() * 0.8),
          rebond: 0.15,
          couleur: teinte(genre),
        });
      }
      if (zombie) {
        // Un nuage fin de la même couleur, là où la balle est entrée.
        lancer(fumees, p, [direction.x * 0.6, 0.15, direction.z * 0.6], { duree: 0.5, taille: 0.08, grossit: 3, freine: 4, gravite: 0.05, couleur: teinte(genre) });
      } else {
        for (let i = 0; i < 3; i++) {
          lancer(etincelles, p, [-direction.x * 3 + hasard(3), 1.5 + Math.random() * 3, -direction.z * 3 + hasard(3)], {
            duree: 0.18 + Math.random() * 0.15, taille: 0.012, rebond: 0.4, gravite: 0.6,
          });
        }
        lancer(fumees, p, [hasard(0.2), 0.35, hasard(0.2)], { duree: 0.9, taille: 0.1, grossit: 2.2, freine: 2, gravite: -0.02, couleur: couleur.copy(teinte(genre)).lerp(gris, 0.5) });
      }
    },

    // Gros jet (un zombie qui tombe, un bouffi qui éclate).
    eclabousser(point, genre, quantite = 14) {
      const p = [point.x, point.y, point.z];
      for (let i = 0; i < quantite; i++) {
        lancer(eclats, p, [hasard(3), 1.5 + Math.random() * 3, hasard(3)], {
          duree: 1.8 + Math.random(), taille: 0.055 * (0.6 + Math.random()), rebond: 0.12, couleur: teinte(genre),
        });
      }
    },

    // Flaque au sol, là où un zombie est tombé ; taille : rayon en mètres.
    flaque(point, genre, taille = 0.6) {
      lancer(flaques, [point.x, 0, point.z], [0, 0, 0], { duree: 14, taille: taille * (0.8 + Math.random() * 0.4), gravite: 0, couleur: teinte(genre).multiplyScalar(0.7) });
    },

    douille(point, vitesse) {
      lancer(douilles, [point.x, point.y, point.z], [vitesse.x, vitesse.y, vitesse.z], { duree: 2.2, taille: 0.0065, rebond: 0.35, freine: 0.4 });
    },

    fumee(point, taille = 0.05) {
      lancer(fumees, [point.x, point.y, point.z], [hasard(0.1), 0.25, hasard(0.1)], { duree: 0.7, taille, grossit: 3, freine: 3, gravite: -0.03, couleur: gris });
    },

    mettreAJour(dt) {
      for (const f of [eclats, etincelles, douilles, fumees, flaques]) avancer(f, dt);
    },
  };
}
