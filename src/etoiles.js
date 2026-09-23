// Les étoiles d'amélioration posées au sol : une étoile dorée qui tourne,
// un halo et une colonne de lumière qui se voient de loin dans le noir. Aucune
// lumière n'est ajoutée (le nombre de lumières reste fixe) : tout est en
// matières qui brillent d'elles-mêmes. Une réserve fixe de modèles suffit.

import * as THREE from 'three';
import { carte } from './monde.js';
import { ETOILES } from './regles.js';

const CLIGNOTE = 5;

function formeEtoile(branches = 5, grand = 0.26, petit = 0.11) {
  const f = new THREE.Shape();
  for (let i = 0; i < branches * 2; i++) {
    const a = (i / (branches * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? petit : grand;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) f.lineTo(x, y);
    else f.moveTo(x, y);
  }
  f.closePath();
  return f;
}

// Dégradé radial dessiné dans un canvas : le halo.
function textureHalo() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255, 236, 150, 1)');
  d.addColorStop(0.35, 'rgba(255, 200, 60, 0.45)');
  d.addColorStop(1, 'rgba(255, 180, 40, 0)');
  g.fillStyle = d;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function creerEtoilesVue(scene) {
  const geo = new THREE.ExtrudeGeometry(formeEtoile(), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  geo.center();
  const matiere = new THREE.MeshStandardMaterial({
    color: '#ffd24a', emissive: '#ffb300', emissiveIntensity: 5, roughness: 0.35, metalness: 0.4, flatShading: true, fog: false,
  });
  const halo = new THREE.SpriteMaterial({ map: textureHalo(), color: new THREE.Color(3, 3, 3), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true });
  const geoColonne = new THREE.CylinderGeometry(0.03, 0.1, 7, 8, 1, true);
  geoColonne.translate(0, 3.5, 0);
  const matColonne = new THREE.MeshBasicMaterial({
    color: '#ffcf5a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });

  const reserve = Array.from({ length: ETOILES.max }, () => {
    const groupe = new THREE.Group();
    const etoile = new THREE.Mesh(geo, matiere);
    const lueur = new THREE.Sprite(halo);
    lueur.scale.setScalar(1.6);
    const colonne = new THREE.Mesh(geoColonne, matColonne);
    groupe.add(etoile, lueur, colonne);
    groupe.visible = false;
    scene.add(groupe);
    return { groupe, etoile, lueur, colonne, id: null, age: 0 };
  });
  let temps = 0;

  return {
    // liste : [{ id, x, z, age }], comme dans l'instantané.
    appliquer(liste) {
      const ids = new Set(liste.map((e) => e.id));
      for (const r of reserve) {
        if (r.id !== null && !ids.has(r.id)) {
          r.id = null;
          r.groupe.visible = false;
        }
      }
      for (const e of liste) {
        let r = reserve.find((x) => x.id === e.id);
        if (!r) {
          r = reserve.find((x) => x.id === null);
          if (!r) continue;
          r.id = e.id;
          r.groupe.position.set(e.x, carte().hauteurSol(e.x, e.z), e.z);
          r.phase = Math.random() * 6;
          r.groupe.visible = true;
        }
        r.age = e.age;
      }
    },

    mettreAJour(dt) {
      temps += dt;
      for (const r of reserve) {
        if (r.id === null) continue;
        r.age += dt;
        r.etoile.rotation.y = temps * 2.4 + r.phase;
        r.etoile.position.y = 0.75 + Math.sin(temps * 2.6 + r.phase) * 0.12;
        r.lueur.position.y = r.etoile.position.y;
        // Les dernières secondes, elle clignote : vite, avant qu'elle s'éteigne.
        const fin = ETOILES.duree - r.age;
        r.groupe.visible = fin > CLIGNOTE || Math.sin(temps * 18) > -0.3;
      }
    },

    vider() {
      for (const r of reserve) {
        r.id = null;
        r.groupe.visible = false;
      }
    },
  };
}
