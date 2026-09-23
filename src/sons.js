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

// Petit bruit métallique : un clic, filtré autour de frequence.
function clic(ctx, frequence, volume, duree = 0.05, delai = 0) {
  const source = ctx.createBufferSource();
  source.buffer = bruit;
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'bandpass';
  filtre.frequency.value = frequence;
  filtre.Q.value = 6;
  const g = ctx.createGain();
  const debut = ctx.currentTime + delai;
  g.gain.setValueAtTime(volume, debut);
  g.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  g.connect(ctx.destination);
  source.connect(filtre).connect(g);
  source.start(debut);
  source.stop(debut + duree + 0.02);
}

// Chargeur vide : la détente claque dans le vide.
export function sonVide() {
  const ctx = audio();
  if (!ctx) return;
  clic(ctx, 2600, 0.35, 0.04);
}

// Étapes du rechargement : 0 chargeur sorti, 1 chargeur engagé, 2 culasse
// armée. Le barillet du lance-grenades cliquette en tournant.
export function sonRecharge(etape, arme = 'pistolet') {
  const ctx = audio();
  if (!ctx) return;
  if (arme === 'lance') {
    if (etape === 2) clic(ctx, 900, 0.5, 0.09);
    else for (let i = 0; i < 3; i++) clic(ctx, 1800, 0.22, 0.03, i * 0.09);
    return;
  }
  const grave = arme === 'fusil' ? 0.8 : arme === 'uzi' ? 1.15 : 1;
  if (etape === 0) clic(ctx, 1200 * grave, 0.3, 0.07);
  else if (etape === 1) clic(ctx, 700 * grave, 0.45, 0.08);
  else {
    clic(ctx, 1500 * grave, 0.4, 0.05);
    clic(ctx, 1000 * grave, 0.35, 0.06, 0.07);
  }
}

// Un bouffi qui éclate : un souffle mou et un bruit mouillé.
export function sonEclatement(volume = 1) {
  const ctx = audio();
  if (!ctx || volume <= 0.01) return;
  const source = ctx.createBufferSource();
  source.buffer = bruit;
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.setValueAtTime(900, ctx.currentTime);
  filtre.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.5);
  source.connect(filtre).connect(enveloppe(ctx, 0.7 * volume, 0.6));
  source.start();
  source.stop(ctx.currentTime + 0.4);
  const bulle = ctx.createOscillator();
  bulle.type = 'sine';
  bulle.frequency.setValueAtTime(260, ctx.currentTime);
  bulle.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);
  bulle.connect(enveloppe(ctx, 0.8 * volume, 0.45));
  bulle.start();
  bulle.stop(ctx.currentTime + 0.5);
}
