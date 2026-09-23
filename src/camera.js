// Caméra en orbite autour d'une cible : clic-glisser pour tourner, molette
// pour s'approcher. La position suit en douceur, d'où les transitions fluides
// entre l'écran de création et le jeu.

import * as THREE from 'three';
import { carte } from './monde.js';

export function creerOrbite(camera, element) {
  const reglage = { lacet: 0, tangage: 0.3, distance: 5, min: 2.2, max: 10, tangageMin: -0.15, tangageMax: 1.25 };
  const cible = new THREE.Vector3();
  const regard = new THREE.Vector3();
  const voulue = new THREE.Vector3();
  let glisse = null;

  element.addEventListener('pointerdown', (e) => {
    // Souris verrouillée (vue à la première personne) : l'orbite ne sert pas.
    if (document.pointerLockElement) return;
    glisse = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try {
      element.setPointerCapture(e.pointerId);
    } catch {
      // Capture refusée : le glissé marche quand même tant que la souris reste sur la scène.
    }
  });
  element.addEventListener('pointermove', (e) => {
    if (!glisse || e.pointerId !== glisse.id) return;
    reglage.lacet -= (e.clientX - glisse.x) * 0.006;
    reglage.tangage = THREE.MathUtils.clamp(reglage.tangage + (e.clientY - glisse.y) * 0.004, reglage.tangageMin, reglage.tangageMax);
    glisse.x = e.clientX;
    glisse.y = e.clientY;
  });
  const lacher = () => (glisse = null);
  element.addEventListener('pointerup', lacher);
  element.addEventListener('pointercancel', lacher);
  element.addEventListener('wheel', (e) => {
    e.preventDefault();
    reglage.distance = THREE.MathUtils.clamp(reglage.distance * (1 + e.deltaY * 0.001), reglage.min, reglage.max);
  }, { passive: false });

  return {
    reglage,
    cadrer(options) {
      Object.assign(reglage, options);
    },
    // instantane : pas de glissé (premier affichage).
    mettreAJour(dt, point, instantane = false) {
      cible.copy(point);
      const { lacet, tangage, distance } = reglage;
      voulue.set(
        Math.sin(lacet) * Math.cos(tangage),
        Math.sin(tangage),
        Math.cos(lacet) * Math.cos(tangage),
      ).multiplyScalar(distance).add(cible);
      voulue.y = Math.max(voulue.y, carte().hauteurSol(voulue.x, voulue.z) + 0.35, 0.4);
      const t = instantane ? 1 : 1 - Math.exp(-dt * 7);
      camera.position.lerp(voulue, t);
      regard.lerp(cible, instantane ? 1 : 1 - Math.exp(-dt * 10));
      camera.lookAt(regard);
    },
  };
}
