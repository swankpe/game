// Post-traitement : la scène est rendue en HDR (demi-flottants, MSAA), puis un
// halo (bloom) fait rayonner ce qui dépasse la lumière du jour (yeux des
// zombies, torches, lanterne, étoiles, éclairs), un grain léger et un
// assombrissement des bords donnent du corps à la nuit, et OutputPass
// applique le tone mapping du rendu.
//
// Le seuil du halo suit l'ambiance : en plein jour, tout le sable dépasse 1
// et rayonnerait ; la nuit, seuls les objets lumineux le font.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// De la nuit (0) au plein jour (1) : seuil et force du halo. Le seuil de nuit
// laisse de côté le sol éclairé par la lanterne : seuls les objets lumineux
// (couleurs « lumineux » de geometrie.js) rayonnent.
const HALO = { seuil: [2.2, 6], force: [0.6, 0.1], rayon: 0.35 };

const Finition = {
  uniforms: { tDiffuse: { value: null }, temps: { value: 0 }, nuit: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float temps;
    uniform float nuit;
    varying vec2 vUv;
    float bruit(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Bords assombris, un peu plus la nuit.
      vec2 d = vUv - 0.5;
      float bord = smoothstep(0.85, 0.25, length(d * vec2(1.15, 1.0)));
      c.rgb *= mix(1.0, bord, 0.35 + 0.25 * nuit);
      // Nuit : ombres tirées vers le bleu, lumières un peu plus chaudes.
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += nuit * (vec3(-0.008, 0.0, 0.02) * (1.0 - l) + vec3(0.02, 0.008, -0.015) * l);
      // Grain de pellicule, très léger.
      c.rgb += (bruit(vUv * 1000.0 + temps) - 0.5) * 0.035;
      gl_FragColor = c;
    }`,
};

export function creerPostTraitement(rendu, scene, camera) {
  const taille = rendu.getSize(new THREE.Vector2());
  const cible = new THREE.WebGLRenderTarget(taille.x, taille.y, { type: THREE.HalfFloatType, samples: 4 });
  const composeur = new EffectComposer(rendu, cible);
  composeur.addPass(new RenderPass(scene, camera));
  const halo = new UnrealBloomPass(new THREE.Vector2(taille.x, taille.y), HALO.force[0], HALO.rayon, HALO.seuil[0]);
  composeur.addPass(halo);
  composeur.addPass(new OutputPass());
  const finition = new ShaderPass(Finition);
  composeur.addPass(finition);

  return {
    // jour : de 0 (nuit noire) à 1 (plein jour), d'après l'ambiance.
    rendre(dt, jour) {
      const t = Math.min(Math.max(jour, 0), 1);
      halo.threshold = HALO.seuil[0] + (HALO.seuil[1] - HALO.seuil[0]) * t;
      halo.strength = HALO.force[0] + (HALO.force[1] - HALO.force[0]) * t;
      finition.uniforms.temps.value = (finition.uniforms.temps.value + dt) % 100;
      finition.uniforms.nuit.value = 1 - t;
      composeur.render(dt);
    },
    taille(w, h) {
      composeur.setPixelRatio(rendu.getPixelRatio());
      composeur.setSize(w, h);
    },
  };
}
