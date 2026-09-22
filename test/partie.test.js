// Salon complet de bout en bout, sur le transport local (BroadcastChannel
// existe dans Node), avec des battements accélérés.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ouvrirPartie } from '../src/partie.js';
import { transportLocal } from '../src/reseau/local.js';
import { APPARENCE_PAR_DEFAUT } from '../src/apparence.js';

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function joueur(t, code, nom, arrivee) {
  const journal = { admis: false, refuse: false, membres: [], messages: [] };
  const partie = ouvrirPartie({
    transport: transportLocal({ battement: 30, delaiAbsence: 150, delaiDecouverte: 60 }),
    code,
    monId: `id-${nom}`,
    profil: { nom, apparence: APPARENCE_PAR_DEFAUT },
    maintenant: () => arrivee,
    rappels: {
      surAdmission: () => (journal.admis = true),
      surRefus: () => (journal.refuse = true),
      surMembres: (m) => (journal.membres = m),
      surMessage: (de, d) => journal.messages.push({ de, d }),
    },
  });
  // Fermer même si une assertion échoue, sinon le canal garde Node en vie.
  t.after(() => partie.quitter());
  return { partie, journal };
}

test('quatre joueurs se voient, le cinquième est refusé sans jamais entrer', async (t) => {
  const code = 'TST' + Math.floor(Math.random() * 9);
  const joueurs = [];
  for (const [i, nom] of ['Ana', 'Bob', 'Cal', 'Dan'].entries()) {
    joueurs.push(joueur(t, code, nom, 1000 + i));
    await attendre(60);
  }
  await attendre(120);
  for (const { journal } of joueurs) {
    assert.ok(journal.admis);
    assert.deepEqual(journal.membres.map((m) => m.nom), ['Ana', 'Bob', 'Cal', 'Dan']);
  }

  const cinquieme = joueur(t, code, 'Eve', 2000);
  await attendre(200);
  assert.ok(cinquieme.journal.refuse);
  assert.ok(!cinquieme.journal.admis);
  assert.equal(joueurs[0].journal.membres.length, 4);

  joueurs[0].partie.envoyer({ type: 'etat', p: [1, 2, 3] });
  await attendre(50);
  assert.deepEqual(joueurs[1].journal.messages.at(-1), { de: 'id-Ana', d: { type: 'etat', p: [1, 2, 3] } });

  // Un départ libère une place : la liste se met à jour chez les autres.
  joueurs[3].partie.quitter();
  await attendre(80);
  assert.deepEqual(joueurs[0].journal.membres.map((m) => m.nom), ['Ana', 'Bob', 'Cal']);
});

test('un changement de perso est vu par les autres', async (t) => {
  const code = 'PRS' + Math.floor(Math.random() * 9);
  const a = joueur(t, code, 'Ana', 1);
  const b = joueur(t, code, 'Bob', 2);
  await attendre(200);
  a.partie.changerProfil({ nom: 'Anaïs', apparence: { ...APPARENCE_PAR_DEFAUT, chapeau: 'bob' } });
  await attendre(80);
  const vueParBob = b.journal.membres.find((m) => m.id === 'id-Ana');
  assert.equal(vueParBob.nom, 'Anaïs');
  assert.equal(vueParBob.apparence.chapeau, 'bob');
});
