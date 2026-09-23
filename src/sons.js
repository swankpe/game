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

// Timbre de chaque arme : souffle filtré (aigu → grave) et coup sourd.
const TIMBRES = {
  pistolet: { volume: 0.5, aigu: 4200, grave: 300, duree: 0.22, coup: 140, force: 0.45 },
  uzi: { volume: 0.32, aigu: 6500, grave: 600, duree: 0.1, coup: 190, force: 0.25 },
  fusil: { volume: 0.55, aigu: 5200, grave: 220, duree: 0.28, coup: 110, force: 0.55 },
  lance: { volume: 0.25, aigu: 900, grave: 120, duree: 0.2, coup: 230, force: 0.6 },
};

// volume : 1 pour son propre tir, moins pour les tirs lointains des autres.
export function sonTir(volume = 1, arme = 'pistolet') {
  const ctx = audio();
  if (!ctx || volume <= 0.01) return;
  const t = TIMBRES[arme] ?? TIMBRES.pistolet;
  const source = ctx.createBufferSource();
  source.buffer = bruit;
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.setValueAtTime(t.aigu, ctx.currentTime);
  filtre.frequency.exponentialRampToValueAtTime(t.grave, ctx.currentTime + t.duree * 0.8);
  source.connect(filtre).connect(enveloppe(ctx, t.volume * volume, t.duree));
  source.start();
  source.stop(ctx.currentTime + t.duree + 0.03);
  const coup = ctx.createOscillator();
  coup.frequency.setValueAtTime(t.coup, ctx.currentTime);
  coup.frequency.exponentialRampToValueAtTime(t.coup / 3, ctx.currentTime + 0.12);
  coup.connect(enveloppe(ctx, t.force * volume, 0.14));
  coup.start();
  coup.stop(ctx.currentTime + 0.15);
}

export function sonExplosion(volume = 1) {
  const ctx = audio();
  if (!ctx || volume <= 0.01) return;
  const source = ctx.createBufferSource();
  source.buffer = bruit;
  source.loop = true;
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.setValueAtTime(1600, ctx.currentTime);
  filtre.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.9);
  source.connect(filtre).connect(enveloppe(ctx, 0.8 * volume, 1));
  source.start();
  source.stop(ctx.currentTime + 1.05);
  const grondement = ctx.createOscillator();
  grondement.frequency.setValueAtTime(75, ctx.currentTime);
  grondement.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.8);
  grondement.connect(enveloppe(ctx, 0.7 * volume, 0.85));
  grondement.start();
  grondement.stop(ctx.currentTime + 0.9);
}

export function sonCaisse() {
  const ctx = audio();
  if (!ctx) return;
  for (const [i, f] of [1320, 1760].entries()) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = enveloppe(ctx, 0.12, 0.25);
    o.connect(g);
    o.start(ctx.currentTime + i * 0.08);
    o.stop(ctx.currentTime + i * 0.08 + 0.3);
  }
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
