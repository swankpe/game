// Navigation des zombies sur une carte à murailles : un champ de distances
// calculé sur une grille (1 m) depuis la cible, en respectant la règle des
// marches (on descend de n'importe quelle hauteur, on ne monte pas plus de
// PAS_MAX d'un coup). Un zombie va toujours vers la case voisine la plus
// proche de sa cible : il passe les portes et prend les rampes tout seul.
// Les champs sont gardés en mémoire par case cible, et recalculés quand la
// cible change de case.

export const PAS_MAX = 0.7;
const MEMOIRE = 12;
const VOISINS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

// carte : { borne, hauteurSol(x, z), bloque(x, z) }.
export function creerNavigation(carte, pas = 1) {
  const n = Math.round((carte.borne * 2) / pas) + 1;
  const centre = (i) => -carte.borne + i * pas;
  const hauteurs = new Float32Array(n * n);
  const bloquees = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = centre(i), z = centre(j);
      hauteurs[j * n + i] = carte.hauteurSol(x, z);
      bloquees[j * n + i] = carte.bloque(x, z) ? 1 : 0;
    }
  }
  const indice = (x, z) => {
    const i = Math.round((x + carte.borne) / pas), j = Math.round((z + carte.borne) / pas);
    return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i;
  };
  // Passage de la case a à la case voisine b (écart di, dj).
  const passe = (a, b, di, dj) => {
    if (bloquees[b] || hauteurs[b] - hauteurs[a] > PAS_MAX) return false;
    if (di && dj) {
      // En diagonale, les deux cases de côté doivent passer aussi (pas de coin coupé).
      const c1 = a + di, c2 = a + dj * n;
      if (bloquees[c1] || bloquees[c2] || hauteurs[c1] - hauteurs[a] > PAS_MAX || hauteurs[c2] - hauteurs[a] > PAS_MAX) return false;
    }
    return true;
  };

  const champs = new Map();

  // Dijkstra à rebours depuis la cible : distance de chaque case jusqu'à elle.
  function calculer(cible) {
    // En 64 bits : arrondie en 32 bits, une distance ne se reconnaîtrait plus
    // en sortant de la file (d > dist[b]) et la case serait sautée.
    const dist = new Float64Array(n * n).fill(Infinity);
    dist[cible] = 0;
    // File de priorité simple (tas binaire sur des paires [distance, case]).
    const tas = [[0, cible]];
    const pousser = (e) => {
      tas.push(e);
      let k = tas.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (tas[p][0] <= tas[k][0]) break;
        [tas[p], tas[k]] = [tas[k], tas[p]];
        k = p;
      }
    };
    const retirer = () => {
      const haut = tas[0];
      const dernier = tas.pop();
      if (tas.length) {
        tas[0] = dernier;
        let k = 0;
        for (;;) {
          const g = 2 * k + 1, d = g + 1;
          let m = k;
          if (g < tas.length && tas[g][0] < tas[m][0]) m = g;
          if (d < tas.length && tas[d][0] < tas[m][0]) m = d;
          if (m === k) break;
          [tas[m], tas[k]] = [tas[k], tas[m]];
          k = m;
        }
      }
      return haut;
    };
    while (tas.length) {
      const [d, b] = retirer();
      if (d > dist[b]) continue;
      const bi = b % n, bj = (b - bi) / n;
      for (const [di, dj, cout] of VOISINS) {
        const ai = bi - di, aj = bj - dj;
        if (ai < 0 || aj < 0 || ai >= n || aj >= n) continue;
        const a = aj * n + ai;
        // On cherche qui peut venir en b : le passage va de a vers b.
        if (!passe(a, b, di, dj)) continue;
        const nd = d + cout * pas;
        if (nd < dist[a]) {
          dist[a] = nd;
          pousser([nd, a]);
        }
      }
    }
    return dist;
  }

  function champ(tx, tz) {
    const cible = indice(tx, tz);
    if (cible < 0) return null;
    let c = champs.get(cible);
    if (!c) {
      c = calculer(cible);
      champs.set(cible, c);
      if (champs.size > MEMOIRE) champs.delete(champs.keys().next().value);
    } else {
      // Récemment servi : on le remet en fin de file.
      champs.delete(cible);
      champs.set(cible, c);
    }
    return c;
  }

  return {
    // Distance à parcourir de (x, z) jusqu'à la cible (Infinity : injoignable).
    distance(x, z, tx, tz) {
      const c = champ(tx, tz);
      const a = indice(x, z);
      return c && a >= 0 ? c[a] : Infinity;
    },

    // Prochain point de passage vers la cible, ou la cible elle-même quand
    // on y est presque (ou quand la grille ne sait pas mieux faire).
    vers(x, z, tx, tz) {
      const c = champ(tx, tz);
      const a = indice(x, z);
      if (!c || a < 0 || !Number.isFinite(c[a]) || c[a] <= pas * 1.5) return { x: tx, z: tz };
      const ai = a % n, aj = (a - ai) / n;
      let meilleur = -1, dMin = c[a];
      for (const [di, dj] of VOISINS) {
        const bi = ai + di, bj = aj + dj;
        if (bi < 0 || bj < 0 || bi >= n || bj >= n) continue;
        const b = bj * n + bi;
        if (c[b] < dMin && passe(a, b, di, dj)) {
          dMin = c[b];
          meilleur = b;
        }
      }
      if (meilleur < 0) return { x: tx, z: tz };
      const bi = meilleur % n;
      return { x: centre(bi), z: centre((meilleur - bi) / n) };
    },
  };
}
