// Bruitages synthétisés avec Web Audio : aucun fichier son à charger.
// Le navigateur n'autorise le son qu'après une action du joueur ; le contexte
// est donc créé au premier tir, jamais au chargement.

let contexte = null;
let bruit = null;

function audio() {
  if (!contexte) {
    const Contexte = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Contexte) return null;
    contexte = new Contexte();
    bruit = contexte.createBuffer(1, contexte.sampleRate * 0.4, contexte.sampleRate);
    const d = bruit.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (contexte.state === 'suspended') contexte.resume();
  return contexte;
}

function enveloppe(ctx, volume, duree) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duree);
  g.connect(ctx.destination);
  return g;
}

// volume : 1 pour son propre tir, moins pour les tirs lointains des autres.
export function sonTir(volume = 1) {
  const ctx = audio();
  if (!ctx || volume <= 0.01) return;
  const source = ctx.createBufferSource();
  source.buffer = bruit;
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.setValueAtTime(4200, ctx.currentTime);
  filtre.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.18);
  source.connect(filtre).connect(enveloppe(ctx, 0.5 * volume, 0.22));
  source.start();
  source.stop(ctx.currentTime + 0.25);
  const coup = ctx.createOscillator();
  coup.frequency.setValueAtTime(140, ctx.currentTime);
  coup.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.12);
  coup.connect(enveloppe(ctx, 0.45 * volume, 0.14));
  coup.start();
  coup.stop(ctx.currentTime + 0.15);
}

export function sonTouche(tete = false) {
  const ctx = audio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = tete ? 1500 : 900;
  o.connect(enveloppe(ctx, 0.06, 0.05));
  o.start();
  o.stop(ctx.currentTime + 0.06);
}

export function sonMort() {
  const ctx = audio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(180, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.5);
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.value = 600;
  o.connect(filtre).connect(enveloppe(ctx, 0.14, 0.55));
  o.start();
  o.stop(ctx.currentTime + 0.6);
}
