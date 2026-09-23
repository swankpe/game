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
| `etat` | chaque joueur | position, orientation du corps `r`, regard `vp`, arme en main `ar` |
| `monde` | l'hôte | l'instantané complet : zombies et leur type `k`, explosions de bouffis `ex`, argent et armes (voir `normaliserMonde`) |
| `tirs` | le tireur | paquet de balles (100 ms) : trajectoires, et `m`, `dg` si un zombie est touché |
| `grenade` | le tireur | départ et vitesse : chaque navigateur simule la même trajectoire |
| `explosion` | le tireur | zombies touchés par sa grenade et dégâts |
| `porter`, `poser`, `illuminer`, `lancer`, `acheter` | un joueur | demande que seul l'hôte applique |

Le tireur détecte lui-même l'impact (sur les zombies tels qu'il les voit) : entre
amis, on fait confiance, l'hôte ne fait que borner les dégâts et crédite
l'argent au tireur. Les achats sont validés par l'hôte (argent suffisant, joueur
devant le comptoir `BOUTIQUE`). Si l'hôte part, le suivant appelle
`sim.charger(dernier instantané)` et continue.

Les bouffis explosent **chez l'hôte** (au contact du poteau, ou abattus) : la
simulation compte les dégâts, réaction en chaîne comprise, et range
l'explosion dans `ex` pendant 1,5 s avec un numéro. Chaque navigateur la
montre une fois (`explosionsVues` dans `jeu.js`).

Chargeurs, rechargement et recul ne concernent que le tireur : rien ne passe
par le réseau ni par l'hôte.

Les tirs partent **par paquets** : un Uzi tire 14 balles par seconde, un
message par balle épuiserait le quota Supabase. Les autres rejouent le paquet
étalé sur 100 ms.

## Architecture

| Fichier | Rôle |
| --- | --- |
| `src/main.js` | écrans (création, jeu, édition), connexion au salon, boucle de rendu |
| `src/jeu.js` | une partie côté navigateur : rôles, tirs, poteau, lanterne, messages, interface de jeu |
| `src/simulation.js` | la partie chez l'hôte, sans Three.js : testable dans Node |
| `src/regles.js` | réglages (armes, types de zombies…), tirage du protégé, test de tir `premierTouche`, position du poteau porté |
| `src/salon.js` | code du salon, ordre des joueurs, admission ou refus (4 maximum) |
| `src/partie.js` | entrée dans un salon au-dessus d'un transport |
| `src/reseau/` | transports : Supabase (en ligne) ou `BroadcastChannel` (onglets, sans configuration) |
| `src/monde.js` | relief, décor, collisions : partagés par rendu, physique et simulation |
| `src/ile.js` | rendu de l'île et des trois ambiances (jour, nuit, Illumination) |
| `src/geometrie.js` | pièces low-poly colorées par sommet puis fusionnées |
| `src/personnage.js` | perso des joueurs, poses (libre, arme, porte, attache), arme en main |
| `src/armes.js` | modèles des 4 armes et de la grenade (profils extrudés, biseautés) |
| `src/apercus.js` | vignettes des armes photographiées au démarrage, pour la boutique et la barre d'armes |
| `src/projectiles.js` | grenades en vol, découpées en pas de 20 ms |
| `src/monstres.js` | zombies à l'écran, 4 silhouettes et allures : 6 maillages chacun, géométries partagées |
| `src/poteau.js` | mât, cordes, lanterne orientable, mannequin de paille |
| `src/arme.js` | arme à la première personne (mains, changement d'arme, rechargement), éclairs, traînées, explosions |
| `src/vue.js` | souris verrouillée, regard à la première personne, recul |
| `src/joueur.js` | clavier et déplacements |
| `src/avatars.js` | les autres joueurs : modèles, étiquettes, lissage |
| `src/camera.js` | caméra en orbite de l'écran de création |
| `src/sons.js` | bruitages Web Audio |

## Tests

```bash
npm test
```

`node:test` couvre la simulation (manches, défaite, tirage, poteau,
Illumination, argent, achats, types de zombies, explosions de bouffis en
chaîne, contournement des obstacles, reprise par un nouvel hôte), les règles,
le salon et un salon
complet sur `BroadcastChannel` (qui existe dans Node). Aucun test n'appelle
Supabase.

Le jeu lui-même ne se vérifie qu'avec Playwright, dans Chromium lancé avec
`--use-angle=swiftshader --enable-unsafe-swiftshader`. Ouvrir l'adresse avec
`?debug` expose `window.leProtege` : `etat()` (munitions et `progression` du
rechargement comprises), `viser(x, y, z)`, `teleporter(x, z)`, `acheter(id)`,
`equiper(id)`, `recharger()`, `boutique()`, et pour l'hôte `crediter(n, id)`,
`illuminer()` et `poserZombie(type, x, z, vitesse, pv)` (immobile par défaut :
pratique pour photographier un modèle). Pièges :
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
- Zombies : seul le tronc projette une ombre (60 zombies × 6 maillages ×
  2 sources d'ombre, sinon). Bloqués par un obstacle, ils glissent sur le côté
  (`c` : côté de contournement).
- Métal sans environnement à refléter = noir. Les vignettes ont un
  `RoomEnvironment` ; en jeu, le métal garde une faible `metalness` et une
  lumière d'appoint accrochée à la caméra éclaire l'arme en main la nuit.
- La barre d'armes est à gauche : à droite, elle recouvrait l'arme en main.
- Recul : `vue.etat.lacet`/`tangage` sont le regard voulu par la souris (il
  oriente le corps et les pas) ; `vue.lacet`/`vue.tangage` y ajoutent le recul
  (caméra et tirs). Ne pas écrire le recul dans `vue.etat`, il ne reviendrait
  plus.
- Zone de tir d'un zombie : un cylindre droit (`premierTouche`, agrandi par
  `largeur`/`hauteur` du type). Un modèle voûté (le coureur) est penché
  depuis les hanches avec le bassin reculé (`incliner` dans `monstres.js`) :
  la tête doit rester au-dessus des pieds, sinon on la vise sans la toucher.
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
