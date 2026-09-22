# Notes pour Claude Code

**Le Protégé** : jeu coopératif en 3D pour 4 amis, dans le navigateur. Un joueur
ligoté à un poteau sert de lanterne ; les trois autres le défendent contre des
vagues de zombies, de nuit, sur une île. Vite + Three.js, multijoueur par
Supabase Realtime, hébergé sur Vercel (projet `game`, déployé à chaque push sur
`main`). Style low-poly : formes à peu de faces, `flatShading`, couleurs
franches, personnages à tête de cacahuète et yeux globuleux.

## Repères

- Node 20+, ESM, JavaScript simple (pas de TypeScript). Seule étape de build : Vite.
- **Le français visible à l'écran est accentué.** Identifiants et commentaires
  en français, commentaires sobres.
- **PC uniquement** (clavier + souris), vue à la première personne pendant la
  partie. Pas d'interface mobile ni tactile : ne pas en ajouter sans demande.
- **Tout est procédural** : aucun modèle 3D, texture ni son à charger (sons
  synthétisés par Web Audio, enseigne dessinée dans un canvas). Le jeu se
  charge instantanément ; garder cette règle tant qu'elle tient.
- **Aucun serveur de jeu.** Pas de fonction Vercel, pas de table Supabase. Un
  salon = un canal Realtime `salon:CODE`.
- L'équilibrage (durées, dégâts, cadence d'apparition…) tient dans
  `src/regles.js`, et nulle part ailleurs.

## Qui décide quoi

Le premier membre du salon (`membres[0]`, voir `salon.js`) est **l'hôte** : son
navigateur fait tourner `src/simulation.js` (manches, zombies, vie du protégé,
poteau, Illumination) et diffuse `instantane()` 6 fois par seconde (1 fois au
camp). Les autres affichent l'état reçu et envoient leurs actions ; l'hôte les
valide.

| Message (broadcast `jeu`) | Émetteur | Contenu |
| --- | --- | --- |
| `etat` | chaque joueur | position, orientation du corps `r`, inclinaison du regard `vp` |
| `monde` | l'hôte | l'instantané complet (voir `normaliserMonde`) |
| `tir` | le tireur | trajectoire pour l'effet ; `m` et `dg` si un zombie est touché |
| `porter`, `poser`, `illuminer`, `lancer` | un joueur | demande que seul l'hôte applique |

Le tireur détecte lui-même l'impact (sur les zombies tels qu'il les voit) : entre
amis, on fait confiance, l'hôte ne fait que borner les dégâts. Si l'hôte part,
le suivant appelle `sim.charger(dernier instantané)` et continue.

## Architecture

| Fichier | Rôle |
| --- | --- |
| `src/main.js` | écrans (création, jeu, édition), connexion au salon, boucle de rendu |
| `src/jeu.js` | une partie côté navigateur : rôles, tirs, poteau, lanterne, messages, interface de jeu |
| `src/simulation.js` | la partie chez l'hôte, sans Three.js : testable dans Node |
| `src/regles.js` | réglages, tirage du protégé, test de tir `premierTouche`, position du poteau porté |
| `src/salon.js` | code du salon, ordre des joueurs, admission ou refus (4 maximum) |
| `src/partie.js` | entrée dans un salon au-dessus d'un transport |
| `src/reseau/` | transports : Supabase (en ligne) ou `BroadcastChannel` (onglets, sans configuration) |
| `src/monde.js` | relief, décor, collisions : partagés par rendu, physique et simulation |
| `src/ile.js` | rendu de l'île et des trois ambiances (jour, nuit, Illumination) |
| `src/geometrie.js` | pièces low-poly colorées par sommet puis fusionnées |
| `src/personnage.js` | perso des joueurs, poses (libre, arme, porte, attache), pistolet |
| `src/monstres.js` | zombies à l'écran : 6 maillages chacun, géométries partagées |
| `src/poteau.js` | mât, cordes, lanterne orientable, mannequin de paille |
| `src/arme.js` | pistolet à la première personne, éclairs et traînées de tir |
| `src/vue.js` | souris verrouillée, regard à la première personne |
| `src/joueur.js` | clavier et déplacements |
| `src/avatars.js` | les autres joueurs : modèles, étiquettes, lissage |
| `src/camera.js` | caméra en orbite de l'écran de création |
| `src/sons.js` | bruitages Web Audio |

## Tests

```bash
npm test
```

`node:test` couvre la simulation (manches, défaite, tirage, poteau,
Illumination, reprise par un nouvel hôte), les règles, le salon et un salon
complet sur `BroadcastChannel` (qui existe dans Node). Aucun test n'appelle
Supabase.

Le jeu lui-même ne se vérifie qu'avec Playwright, dans Chromium lancé avec
`--use-angle=swiftshader --enable-unsafe-swiftshader`. Ouvrir l'adresse avec
`?debug` expose `window.leProtege` : `etat()`, `viser(x, y, z)`,
`teleporter(x, z)`. Pièges :
- `#hud` mesure 0×0 (enfants en `position: fixed`) : attendre `#hud .salon`.
- Cliquer sur une zone libre de la scène : dans une petite fenêtre, le centre
  tombe sur la carte du salon et la souris n'est jamais verrouillée.
- Au clic souris verrouillée, Playwright injecte un faux déplacement de la
  moitié de la fenêtre : réappeler `viser()` juste après `mouse.down()`.
- Plusieurs pages WebGL en rendu logiciel font tomber les images par seconde ;
  le pas de temps étant plafonné à 0,1 s, le temps de jeu ralentit d'autant.
- Les zombies sortent de l'eau : sous la surface, le fond marin arrête les
  balles. Viser ceux dont `y > 0`.
- Les pages d'un même contexte partagent `localStorage` et `BroadcastChannel` :
  c'est ce qui permet de tester à plusieurs.

## Pièges rencontrés

- **Nombre de lumières constant.** Ajouter ou retirer une lumière recompile
  tous les shaders (saccade). Les éclairs de tir viennent d'une réserve fixe
  (`arme.js`), la lanterne est éteinte le jour au lieu d'être retirée.
- **Pointer Lock** : Chrome envoie parfois un déplacement géant d'un coup
  (filtré par `SAUT_ABERRANT` dans `vue.js`) ; certains navigateurs ignorent la
  demande sans erreur (repli sur le clic-glisser au bout d'une seconde).
- Clavier : lire `event.code` (position physique), pas `event.key`. ZQSD sur
  AZERTY arrive comme `KeyW`/`KeyA`/`KeyS`/`KeyD`.
- Orientation : le corps regarde vers `(sin r, cos r)` ; la caméra, de lacet
  `l`, vers `(-sin l, -cos l)`. D'où `r = l + π` partout.
- Le poteau porté est devant et à droite du porteur (`positionPortee`) : droit
  devant, il bouchait toute la vue.
- Étiquettes CSS2D : retirer l'étiquette elle-même (`removeFromParent`) pour
  que son élément quitte le DOM.
- Supabase : redéclarer la présence (`track`) à chaque `SUBSCRIBED`.
  `realtime: { worker: true }` garde la connexion quand l'onglet est en
  arrière-plan.
- Variables `VITE_` : intégrées au build. Sur Vercel, une variable ajoutée
  après coup demande un redéploiement ; et la protection doit être
  « Standard Protection », sinon les amis tombent sur une connexion Vercel.
- Three.js r186 : `THREE.Timer` remplace `Clock` ; `PCFSoftShadowMap` n'existe plus.
- Le décor vient d'une graine fixe (`generateur(20260922)` dans `monde.js`) :
  tous les joueurs voient la même île sans rien échanger.
