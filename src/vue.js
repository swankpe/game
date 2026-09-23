// Vue à la première personne : la souris est verrouillée (Pointer Lock) après
// un clic sur la scène, Échap la libère. Si le navigateur refuse le
// verrouillage, on se rabat sur le clic-glisser et le clic tire directement.
//
// Le recul des armes décale le regard (reculV vers le haut, reculH sur le
// côté) par-dessus l'orientation voulue par la souris ; le décalage revient à
// zéro de lui-même. Caméra et tirs suivent le regard décalé.

const SENSIBILITE = 0.0022;
const TANGAGE_MAX = 1.45;
// Chrome envoie parfois, souris verrouillée, un déplacement géant d'un seul
// coup (au verrouillage, ou au clic) : la vue sauterait vers le ciel.
const SAUT_ABERRANT = 250;

export function creerVue(canvas) {
  const etat = { lacet: 0, tangage: 0, reculV: 0, reculH: 0, verrouille: false, impossible: false, actif: false, gachette: false };
  let glisse = null;

  const tourner = (dx, dy) => {
    etat.lacet -= dx * SENSIBILITE;
    etat.tangage = Math.max(-TANGAGE_MAX, Math.min(TANGAGE_MAX, etat.tangage - dy * SENSIBILITE));
  };

  function verrouiller() {
    try {
      const promesse = canvas.requestPointerLock();
      promesse?.catch?.(() => (etat.impossible = true));
    } catch {
      etat.impossible = true;
    }
    // Certains navigateurs ignorent la demande sans erreur : sans verrou au
    // bout d'une seconde, on passe au clic-glisser plutôt que de bloquer le tir.
    setTimeout(() => {
      if (!etat.verrouille) etat.impossible = true;
    }, 1000);
  }

  document.addEventListener('pointerlockchange', () => {
    etat.verrouille = document.pointerLockElement === canvas;
    if (!etat.verrouille) etat.gachette = false;
  });
  document.addEventListener('pointerlockerror', () => (etat.impossible = true));

  canvas.addEventListener('mousedown', (e) => {
    if (!etat.actif || e.button !== 0) return;
    if (etat.verrouille || etat.impossible) {
      etat.gachette = true;
      if (etat.impossible) glisse = { x: e.clientX, y: e.clientY };
    } else {
      verrouiller();
    }
  });
  addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    etat.gachette = false;
    glisse = null;
  });
  addEventListener('mousemove', (e) => {
    if (!etat.actif) return;
    if (etat.verrouille) {
      if (Math.abs(e.movementX) > SAUT_ABERRANT || Math.abs(e.movementY) > SAUT_ABERRANT) return;
      tourner(e.movementX, e.movementY);
    } else if (glisse) {
      tourner(e.clientX - glisse.x, e.clientY - glisse.y);
      glisse.x = e.clientX;
      glisse.y = e.clientY;
    }
  });
  addEventListener('blur', () => (etat.gachette = false));

  return {
    etat,
    activer(oui) {
      etat.actif = oui;
      etat.gachette = false;
      if (!oui && etat.verrouille) document.exitPointerLock();
    },
    orienter(lacet, tangage = 0) {
      etat.lacet = lacet;
      etat.tangage = tangage;
      etat.reculV = etat.reculH = 0;
    },
    reculer(haut, cote) {
      etat.reculV += haut;
      etat.reculH += cote;
    },
    // retour : vitesse à laquelle le recul se résorbe (par seconde).
    stabiliser(dt, retour) {
      const k = Math.exp(-dt * retour);
      etat.reculV *= k;
      etat.reculH *= k;
    },
    // Regard effectif, recul compris.
    get lacet() {
      return etat.lacet + etat.reculH;
    },
    get tangage() {
      return Math.max(-TANGAGE_MAX, Math.min(TANGAGE_MAX, etat.tangage + etat.reculV));
    },
    appliquer(camera, x, y, z) {
      camera.position.set(x, y, z);
      camera.rotation.set(this.tangage, this.lacet, 0, 'YXZ');
    },
    // Direction du regard [x, y, z], normée.
    direction() {
      const c = Math.cos(this.tangage);
      return [-Math.sin(this.lacet) * c, Math.sin(this.tangage), -Math.cos(this.lacet) * c];
    },
  };
}
