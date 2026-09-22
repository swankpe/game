# Notes pour Claude Code

Petit jeu de pêche en 3D entre amis, dans le navigateur, 4 joueurs maximum.
Vite + Three.js, multijoueur par Supabase Realtime, hébergé sur Vercel. Le
style visé est low-poly façon « How to Fish » : formes à peu de faces,
`flatShading`, couleurs franches, personnages à tête de cacahuète et yeux
globuleux.

## Repères

- Node 20+, ESM, JavaScript simple (pas de TypeScript). Seule étape de build : Vite.
- **Le français visible à l'écran est accentué.** Identifiants et commentaires
  en français, commentaires sobres.
- **Tout est procédural** : aucun modèle 3D ni texture à charger (seule
  l'enseigne de la cabane est dessinée dans un canvas). Garder cette règle tant
  qu'elle tient : le jeu se charge instantanément et le dépôt reste léger.
- **Aucun serveur de jeu.** Pas de fonction Vercel, pas de table Supabase. Un
  salon = un canal Realtime `salon:CODE` : la présence dit qui est là et avec
  quel perso, le broadcast `jeu` porte les positions.
- 4 joueurs maximum : `JOUEURS_MAX` dans `src/salon.js`.
- **PC uniquement** (clavier + souris). Pas d'interface mobile ni tactile :
  ne pas en ajouter sans demande.

## Architecture

| Fichier | Rôle |
| --- | --- |
| `src/main.js` | chef d'orchestre : écrans (création, jeu, édition), boucle de rendu, envoi de la position |
| `src/salon.js` | règles pures : code du salon, ordre des joueurs, admission ou refus |
| `src/partie.js` | entrée dans un salon au-dessus d'un transport ; testable dans Node |
| `src/reseau/supabase.js` | transport en ligne (présence + broadcast) |
| `src/reseau/local.js` | transport de secours par `BroadcastChannel` (onglets d'un même navigateur) |
| `src/reseau/index.js` | choisit Supabase si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` existent, sinon local |
| `src/apparence.js` | catalogue du perso, validation de toute apparence reçue |
| `src/personnage.js` | modèle 3D du perso et son animation (marche, regard, clignement) |
| `src/monde.js` | relief, ponton, décor, collisions : fonctions pures partagées par rendu et physique |
| `src/ile.js` | rendu de l'île ; décor fusionné par familles pour limiter les appels de dessin |
| `src/joueur.js` | clavier et déplacements du joueur local |
| `src/camera.js` | caméra en orbite, suivi en douceur |
| `src/avatars.js` | les autres joueurs : modèles, étiquettes de nom, lissage des positions |
| `src/ui.js` | panneau de création généré depuis le catalogue |

## Salon sans arbitre

Chaque client applique `repartir` à la même liste de présence et arrive à la
même conclusion. Ordre : joueurs déjà installés, puis heure d'arrivée, puis
identifiant. Un nouveau venu ne peut donc pas évincer un joueur installé, même
si son horloge retarde.

On n'est admis qu'après s'être vu dans la liste. Supabase envoie l'état complet
avant toute mise à jour ; le transport local imite ce comportement avec
`delaiDecouverte`. Sans ce délai, un 5ᵉ joueur se voyait seul un instant et
entrait avant d'être éjecté (bug trouvé par `test/partie.test.js`).

Tout ce qui vient du réseau passe par `membreDepuisMeta`, `normaliserApparence`
ou `etatValide`. Les noms s'affichent par `textContent`, jamais `innerHTML`.

## Tests

```bash
npm test
```

`node:test` couvre les règles du salon, l'apparence, la carte et un salon
complet de bout en bout sur le transport local (`BroadcastChannel` existe dans
Node). Aucun test n'appelle Supabase.

Le rendu 3D ne se vérifie qu'avec Playwright, dans Chromium lancé avec
`--use-angle=swiftshader --enable-unsafe-swiftshader`. Trois pièges :
- `#hud` mesure 0×0 (ses enfants sont en `position: fixed`) : attendre
  `#hud .salon`, pas `#hud`.
- Plusieurs pages WebGL en rendu logiciel saturent le processeur : petites
  fenêtres et `waitUntil: 'domcontentloaded'` au-delà de deux joueurs.
- Toutes les pages d'un même contexte partagent le `localStorage` (donc le perso
  enregistré) et le `BroadcastChannel` : c'est ce qui permet de tester à 5.

## Pièges rencontrés

- Clavier : lire `event.code` (position physique), pas `event.key`. ZQSD sur
  AZERTY arrive comme `KeyW`/`KeyA`/`KeyS`/`KeyD`.
- Étiquettes CSS2D : retirer l'étiquette elle-même (`removeFromParent`) pour
  que son élément quitte le DOM. Retirer seulement le modèle parent laisse le
  nom affiché à l'écran.
- Supabase : redéclarer la présence (`track`) à chaque `SUBSCRIBED`, sinon on
  disparaît après une reconnexion. `realtime: { worker: true }` garde le
  battement de cœur vivant quand l'onglet est en arrière-plan.
- Variables `VITE_` : intégrées au build. Sur Vercel, une variable ajoutée
  après coup demande un redéploiement.
- Three.js r186 : `THREE.Timer` remplace `Clock` (déprécié) et
  `PCFSoftShadowMap` n'existe plus.
- Le décor vient d'une graine fixe (`generateur(20260922)` dans `monde.js`) :
  tous les joueurs voient la même île sans rien échanger. Changer la graine ou
  l'ordre des tirages change l'île de tout le monde.

## Suite prévue

La pêche : lancer, touche, ferrage, puis les poissons. Pour qu'un même poisson
ne soit pas attrapé deux fois, un seul client doit décider : le premier de
`ordonnerMembres` (joueur installé le plus ancien) fera office d'hôte.
