// La musique du combat contre le boss, jouée note à note par Web Audio : rien
// à charger. Mi mineur, 152 battements par minute : basse au galop, grosse
// caisse à chaque temps, arpège en doubles croches et un thème qui revient
// toutes les quatre mesures. Quand le boss enrage, le tempo monte et l'arpège
// se double à l'octave.
//
// Les notes sont programmées un peu en avance sur l'horloge audio, à chaque
// image : mettreAJour() doit être appelé par la boucle de rendu.

import { bruitBlanc, contexteAudio } from './sons.js';

const TEMPO = 152;
const TEMPO_RAGE = 164;
const AVANCE = 0.2;
const VOLUME = 0.28;
const frequence = (n) => 440 * 2 ** ((n - 69) / 12);

// Une mesure par accord : Mi mineur, Do, Ré, Si (la dominante, pour la tension).
const BASSES = [40, 36, 38, 35];
const ACCORDS = [[64, 67, 71], [60, 64, 67], [62, 66, 69], [59, 63, 66]];
// Le thème, en croches (null : silence).
const THEME = [
  [76, null, 76, 74, 76, null, 79, null],
  [76, null, 76, 74, 72, null, 71, null],
  [74, null, 74, 72, 74, null, 78, null],
  [75, null, 78, null, 83, null, 81, 79],
];

export function creerMusique() {
  let ctx = null;
  let sortie = null;
  let actif = false;
  let rage = false;
  let pas = 0;
  let prochain = 0;

  function gain(volume, debut, duree) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, debut);
    g.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
    g.connect(sortie);
    return g;
  }

  function oscillateur(type, n, debut, duree, volume, coupure = 0) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = frequence(n);
    let noeud = o;
    if (coupure) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(coupure, debut);
      f.frequency.exponentialRampToValueAtTime(coupure * 0.3, debut + duree);
      o.connect(f);
      noeud = f;
    }
    noeud.connect(gain(volume, debut, duree));
    o.start(debut);
    o.stop(debut + duree + 0.02);
  }

  function souffle(type, frequenceFiltre, debut, duree, volume) {
    const b = ctx.createBufferSource();
    b.buffer = bruitBlanc();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequenceFiltre;
    b.connect(f).connect(gain(volume, debut, duree));
    b.start(debut, Math.random() * 0.2);
    b.stop(debut + duree + 0.02);
  }

  function grosseCaisse(t) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(gain(0.9, t, 0.16));
    o.start(t);
    o.stop(t + 0.18);
  }

  function caisseClaire(t, volume = 0.4) {
    souffle('bandpass', 1900, t, 0.13, volume);
    oscillateur('triangle', 55, t, 0.07, volume * 0.5);
  }

  // Une double croche : i dans la mesure (0 à 15), mesure dans la boucle.
  function jouerPas(n, t, d) {
    const i = n % 16;
    const mesure = Math.floor(n / 16) % 4;
    const boucle = Math.floor(n / 64);
    // Batterie : grosse caisse à chaque temps, caisse claire sur 2 et 4,
    // roulement à la fin de la quatrième mesure.
    if (i % 4 === 0) grosseCaisse(t);
    if (i === 4 || i === 12) caisseClaire(t);
    if (mesure === 3 && i >= 13) caisseClaire(t, 0.25 + (i - 13) * 0.08);
    souffle('highpass', 7500, t, 0.03, i % 2 ? 0.05 : 0.09);
    // Basse au galop : une croche, deux doubles.
    if (i % 4 !== 1) {
      const octave = i === 6 || i === 7 || i === 14 || i === 15 ? 12 : 0;
      oscillateur('sawtooth', BASSES[mesure] + octave, t, d * 0.9, 0.32, 900);
    }
    // Arpège : montée et descente sur l'accord, sur deux octaves.
    const accord = ACCORDS[mesure];
    const note = accord[[0, 1, 2, 1][i % 4]] + 12 * (Math.floor(i / 4) % 2);
    oscillateur('square', note, t, d * 0.8, 0.045, 3500);
    if (rage) oscillateur('square', note + 12, t, d * 0.6, 0.03, 4000);
    // Le thème entre à la deuxième boucle.
    if (boucle >= 1 && i % 2 === 0) {
      const t8 = THEME[mesure][i / 2];
      if (t8 !== null) {
        oscillateur('sawtooth', t8, t, d * 1.8, 0.08, 2600);
        oscillateur('sawtooth', t8 + 0.08, t, d * 1.8, 0.05, 2600);
      }
    }
  }

  return {
    get active() {
      return actif;
    },

    jouer() {
      if (actif) return;
      ctx = contexteAudio();
      if (!ctx) return;
      actif = true;
      sortie = ctx.createGain();
      const compresseur = ctx.createDynamicsCompressor();
      sortie.connect(compresseur).connect(ctx.destination);
      sortie.gain.setValueAtTime(0.0001, ctx.currentTime);
      sortie.gain.exponentialRampToValueAtTime(VOLUME, ctx.currentTime + 0.8);
      pas = 0;
      prochain = ctx.currentTime + 0.05;
    },

    // Fondu de sortie, puis on débranche.
    arreter(duree = 1.2) {
      if (!actif) return;
      actif = false;
      const s = sortie;
      const t = ctx.currentTime;
      s.gain.cancelScheduledValues(t);
      s.gain.setValueAtTime(Math.max(s.gain.value, 0.0001), t);
      s.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      setTimeout(() => s.disconnect(), duree * 1000 + 300);
      rage = false;
    },

    enrager(oui) {
      rage = oui;
    },

    mettreAJour() {
      if (!actif) return;
      const d = 60 / (rage ? TEMPO_RAGE : TEMPO) / 4;
      // Onglet resté en arrière-plan : on reprend au présent plutôt que de
      // jouer d'un coup toutes les notes en retard.
      if (prochain < ctx.currentTime - 0.1) prochain = ctx.currentTime + 0.05;
      while (prochain < ctx.currentTime + AVANCE) {
        jouerPas(pas, prochain, d);
        prochain += d;
        pas += 1;
      }
    },
  };
}
