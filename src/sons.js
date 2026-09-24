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

// Pour la musique (musique.js) : même contexte, même bruit blanc.
export const contexteAudio = audio;
export const bruitBlanc = () => bruit;

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

// Rugissement du boss : un grondement qui monte puis retombe, voilé de souffle.
export function sonRugissement(volume = 1) {
  const ctx = audio();
  if (!ctx || volume <= 0.01) return;
  const t = ctx.currentTime;
  const voix = ctx.createOscillator();
  voix.type = 'sawtooth';
  voix.frequency.setValueAtTime(55, t);
  voix.frequency.linearRampToValueAtTime(95, t + 0.4);
  voix.frequency.exponentialRampToValueAtTime(40, t + 1.5);
  // Tremblement de gorge.
  const gorge = ctx.createOscillator();
  gorge.frequency.value = 23;
  const ampleur = ctx.createGain();
  ampleur.gain.value = 14;
  gorge.connect(ampleur).connect(voix.frequency);
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.setValueAtTime(500, t);
  filtre.frequency.linearRampToValueAtTime(1100, t + 0.4);
  filtre.frequency.exponentialRampToValueAtTime(200, t + 1.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.7 * volume, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  g.connect(ctx.destination);
  voix.connect(filtre).connect(g);
  const souffle = ctx.createBufferSource();
  souffle.buffer = bruit;
  souffle.loop = true;
  const filtreSouffle = ctx.createBiquadFilter();
  filtreSouffle.type = 'bandpass';
  filtreSouffle.frequency.value = 700;
  souffle.connect(filtreSouffle).connect(g);
  for (const n of [voix, gorge, souffle]) {
    n.start(t);
    n.stop(t + 1.7);
  }
}

// Fanfare de victoire : un arpège qui monte et un accord tenu.
export function sonVictoire() {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const notes = [64, 68, 71, 76, 80, 83];
  const frequence = (n) => 440 * 2 ** ((n - 69) / 12);
  notes.forEach((n, i) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = frequence(n);
    const g = ctx.createGain();
    const debut = t + i * 0.09;
    const tenu = i >= notes.length - 3 ? 1.4 : 0.14;
    g.gain.setValueAtTime(0.0001, debut);
    g.gain.exponentialRampToValueAtTime(0.07, debut + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, debut + tenu);
    const filtre = ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = 3200;
    o.connect(filtre).connect(g).connect(ctx.destination);
    o.start(debut);
    o.stop(debut + tenu + 0.05);
  });
}

// Coup encaissé : un choc sourd et un souffle court.
export function sonCoupRecu() {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
  o.connect(enveloppe(ctx, 0.9, 0.3));
  o.start(t);
  o.stop(t + 0.32);
  const b = ctx.createBufferSource();
  b.buffer = bruit;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  b.connect(f).connect(enveloppe(ctx, 0.4, 0.18));
  b.start(t);
  b.stop(t + 0.2);
}

// Étoile ramassée : un arpège scintillant.
export function sonEtoile() {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [84, 88, 91, 96].forEach((n, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 440 * 2 ** ((n - 69) / 12);
    const g = ctx.createGain();
    const debut = t + i * 0.06;
    g.gain.setValueAtTime(0.0001, debut);
    g.gain.exponentialRampToValueAtTime(0.14, debut + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, debut + 0.35);
    g.connect(ctx.destination);
    o.connect(g);
    o.start(debut);
    o.stop(debut + 0.4);
  });
}

// On mange : trois croquées (bruit filtré, de plus en plus sourdes).
export function sonManger() {
  const ctx = audio();
  if (!ctx) return;
  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * 0.16;
    const s = ctx.createBufferSource();
    s.buffer = bruit;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400 - i * 500;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    s.connect(f).connect(g).connect(ctx.destination);
    s.start(t, Math.random() * 0.2, 0.1);
  }
}

// Le rituel commence : un gong grave qui résonne.
export function sonRituel() {
  const ctx = audio();
  if (!ctx) return;
  for (const [f, v] of [[98, 0.3], [147, 0.16], [233, 0.08]]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f * 0.97, ctx.currentTime + 3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(v, ctx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 3.3);
  }
}
