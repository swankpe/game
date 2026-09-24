# Notes pour Claude Code

**Le Protégé** : jeu coopératif en 3D pour 4 amis, dans le navigateur. Lucie,
une villageoise ligotée à un poteau (un personnage, jamais un joueur), porte la
lanterne ; les joueurs la défendent contre des zombies qui arrivent en
continu, de nuit, sur un parcours de cartes ouvertes. Vite + Three.js, multijoueur par
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
  `src/regles.js`, et nulle part ailleurs. Les réglages d'essai (`ESSAI` :
  accalmies et assauts courts, boss fragile, argent au départ) y sont aussi : `jeu.js` les
  passe à la simulation de l'hôte, les tests vérifient le jeu normal.

## Qui décide quoi

Le premier membre du salon (`membres[0]`, voir `salon.js`) est **l'hôte** : son
navigateur fait tourner `src/simulation.js` (phases, carte de l'étape,
zombies, vie de Lucie et des défenseurs, poteau, autel et boss, nourriture)
et diffuse `instantane()` 6 fois par seconde (1 fois au camp). Les autres
affichent l'état reçu et envoient leurs actions ; l'hôte les valide.

| Message (broadcast `jeu`) | Émetteur | Contenu |
| --- | --- | --- |
| `etat` | chaque joueur | position, orientation du corps `r`, regard `vp`, arme en main `ar` |
| `monde` | l'hôte | l'instantané complet : phase `ph`, étape `ep` (bosses abattus), assaut `cy`, carte `ca`, cause d'une défaite `ce`, zombies et leur type `k`, explosions de bouffis `ex`, boss `bo` (id, points de vie max, nombre de cris), lanterne `la`, étoiles `et`, vie, mise à terre, relève et repas des défenseurs `vi`, argent, armes, niveaux d'armes et vivres `jo` (voir `normaliserMonde`) |
| `tirs` | le tireur | paquet de balles (100 ms) : trajectoires, et `m`, `dg` si un zombie est touché |
| `grenade` | le tireur | départ et vitesse : chaque navigateur simule la même trajectoire |
| `explosion` | le tireur | zombies touchés par sa grenade et dégâts |
| `porter`, `poser`, `lancer`, `acheter`, `vivre`, `manger`, `lanterne` | un joueur | demande que seul l'hôte applique (`vivre`, `manger` : `vivre` = `pomme` ou `ragout`) |
| `relever` | un joueur | début (`cible` : l'allié à terre) ou fin (`cible: null`) d'une relève, E maintenu |

Le tireur détecte lui-même l'impact (sur les zombies tels qu'il les voit) et
affiche ses chiffres de dégâts : entre amis, on fait confiance, l'hôte ne fait
que borner les dégâts et crédite l'argent au tireur. Les achats sont validés
par l'hôte (argent suffisant, joueur devant le comptoir `boutique` de la carte
en cours). Si l'hôte part, le suivant appelle `sim.charger(dernier
instantané)` et continue.

Les bouffis explosent **chez l'hôte** (au contact de Lucie, ou abattus) : la
simulation compte les dégâts, réaction en chaîne comprise, et range
l'explosion dans `ex` pendant 1,5 s avec un numéro. Chaque navigateur la
montre une fois (`explosionsVues` dans `jeu.js`).

Phases (`PHASES` dans `simulation.js`) : `attente` (camp, sur l'île) →
`accalmie` (carte illuminée, aucun zombie, on se ravitaille) ⇄ `assaut` (les
zombies arrivent en continu, de plus en plus vite) ; posée sur l'autel de la
carte (`autel` : `{ x, z, rayon }`) pendant une accalmie ou un assaut, Lucie
lance le `rituel` (`BOSS.rituel` s), puis le `boss` (chrono `BOSS.duree`) ;
le boss abattu, `victoire` (10 s), puis l'accalmie de la carte suivante
(`carteDEtape(etape)` : l'île, le village, la forêt, et on boucle). `defaite`
(Lucie morte, cause `protege`, ou chrono du boss écoulé, cause `temps`) →
`attente`. `PHASES_ECLAIREES` (accalmie, victoire) règle l'ambiance.

Le danger (`danger(etape, cycle)` dans `regles.js`) monte avec l'étape et,
moins, avec les assauts sur la même carte : il règle la cadence, la vitesse,
la vie et le mélange des zombies.

Le boss est un zombie comme les autres (type `boss`, jamais tiré au sort),
avec en plus `s.boss` dans la simulation. Ses cris (renforts) sont un
compteur dans `bo` : chaque navigateur rugit quand il augmente ; la rage se
déduit de ses points de vie. Barre de vie, chrono, musique et annonces se
déduisent donc de l'instantané, sans message à part.

Les cartes (`CARTES` dans `monde.js`) partagent une même interface
(`hauteurSol`, `hauteurPieds`, `resoudreCollisions`, `pointDeSortie`,
`navigation`, `boutique`, `apparition`, `poteau`, `autel`, `conseil`…) ; la
simulation lit `CARTES[s.carte]`, le navigateur `carte()`, activée quand
l'instantané annonce une autre carte (`ca`) : chacun se téléporte alors à son
entrée.

Les zombies visent aussi les défenseurs : l'hôte les connaît par les
positions reçues (`joueurs` passé à `pas()`, avec l'arme en main `ar`), donne
les coups (`JOUEUR.coup` points de vie), met à terre et relève (`s.vies`). Pas
de soin passif : un repas (`manger`) soigne peu à peu (`soin`,
`vitesseSoin`). Les étoiles tombent, se ramassent et améliorent les armes
chez l'hôte aussi ; le tireur applique lui-même le niveau de son arme
(`armeAmelioree`) à ses dégâts, son chargeur et son rechargement, et l'hôte
borne les dégâts reçus en conséquence (`BONUS_DEGATS_MAX`).

Chargeurs, rechargement et recul ne concernent que le tireur : rien ne passe
par le réseau ni par l'hôte.

Les tirs partent **par paquets** : un Uzi tire 14 balles par seconde, un
message par balle épuiserait le quota Supabase. Les autres rejouent le paquet
étalé sur 100 ms.

## Architecture

| Fichier | Rôle |
| --- | --- |
| `src/main.js` | écrans (création, jeu, édition), connexion au salon, boucle de rendu |
| `src/jeu.js` | une partie côté navigateur : tirs et chiffres de dégâts, Lucie et son poteau, autel, nourriture, messages, interface de jeu (inventaire, chrono du boss) |
| `src/simulation.js` | la partie chez l'hôte, sans Three.js : testable dans Node |
| `src/regles.js` | réglages (cycle accalmie / assaut, armes, vivres, types de zombies, boss, `danger`…), test de tir `premierTouche`, position du poteau porté |
| `src/salon.js` | code du salon, ordre des joueurs, admission ou refus (4 maximum) |
| `src/partie.js` | entrée dans un salon au-dessus d'un transport |
| `src/reseau/` | transports : Supabase (en ligne) ou `BroadcastChannel` (onglets, sans configuration) |
| `src/monde.js` | registre des cartes (`CARTES`, `carteDEtape`, `carte()`), et relief, décor, collisions, autel de l'île |
| `src/carte-ouverte.js` | fabrique des cartes ouvertes : relief, obstacles ronds, en gélule ou rectangulaires tournés, lisière d'où sortent les zombies |
| `src/village.js`, `src/foret.js` | les deux cartes ouvertes, en données pures (graines fixes) : obstacles, armurerie, autel |
| `src/navigation.js` | champ de distances (Dijkstra sur une grille de 1 m) : sur les cartes ouvertes, les zombies contournent maisons, troncs et étang |
| `src/rendu-village.js`, `src/rendu-foret.js` | rendu des deux cartes ouvertes : chaque obstacle dessiné à sa place, plus ce qu'on enjambe (herbe, fleurs, fougères, champignons) et la forêt hors d'atteinte |
| `src/decor-commun.js` | pièces de décor partagées : sol en relief, maisons, moulin, chapelle, étals, forge, puits, feux, tombes, caisses, arbres lointains |
| `src/autel.js` | l'autel de chaque carte : disque de runes, bougies, colonne de lumière ; repos, rituel, boss |
| `src/chiffres.js` | chiffres de dégâts au-dessus des zombies touchés (étiquettes CSS2D recyclées) |
| `src/vegetation.js` | herbes hautes, buissons, sapins, feuillus, bananiers : un `InstancedMesh` par espèce, ondulant au vent dans le shader |
| `src/ile.js` | rendu de l'île (végétation, camp, tour de guet, réverbères, barque, écume, îlots…), ciel (halo de lune, nuages, étoiles filantes), ambiances (jour, nuit, illumination des accalmies), bascule d'une carte à l'autre, état des autels |
| `src/ambiance.js` | vie de la nuit : lucioles, braises des torches, brume au ras du sol |
| `src/post.js` | post-traitement : halo lumineux (bloom) réglé sur `ile.jour`, vignettage, étalonnage de nuit, grain |
| `src/particules.js` | sang, bave, poussière, étincelles, fumée, douilles, flaques : réserves fixes d'`InstancedMesh` |
| `src/geometrie.js` | pièces low-poly colorées par sommet puis fusionnées ; `lumineux()` pour ce qui doit rayonner |
| `src/personnage.js` | perso des joueurs et de Lucie, poses (libre, arme, porte, attache, terre), arme en main |
| `src/armes.js` | modèles des 4 armes et de la grenade (profils extrudés, biseautés) |
| `src/apercus.js` | vignettes des armes photographiées au démarrage, pour la boutique et la barre d'armes |
| `src/projectiles.js` | grenades en vol, découpées en pas de 20 ms |
| `src/etoiles.js` | étoiles d'amélioration au sol : étoile, halo, colonne de lumière, sans lumière ajoutée |
| `src/monstres.js` | zombies à l'écran, 5 silhouettes détaillées (visage, dents, mains, lambeaux…) et allures : 6 maillages chacun, géométries partagées |
| `src/poteau.js` | mât, cordes, lanterne orientable, Lucie (robe, tablier, fichu, tresses) et son étiquette de vie |
| `src/arme.js` | arme à la première personne (mains, changement d'arme, rechargement), éclairs, traînées, explosions |
| `src/vue.js` | souris verrouillée, regard à la première personne, recul |
| `src/joueur.js` | clavier et déplacements |
| `src/avatars.js` | les autres joueurs : modèles, étiquettes, lissage |
| `src/camera.js` | caméra en orbite de l'écran de création |
| `src/sons.js` | bruitages Web Audio |
| `src/musique.js` | musique du boss, programmée note à note sur l'horloge audio |

## Tests

```bash
npm test
```

`node:test` couvre les cartes (`cartes.test.js` : parcours, genres
d'obstacles tous dessinés, maisons et troncs qui bloquent, relief sans marche
infranchissable, champ de distances qui contourne), la simulation (accalmies
et assauts, zombies en continu, danger qui monte, autel, rituel, boss et son
chrono, victoire et carte suivante, parcours complet, défaite, poteau porté,
argent, achats, vivres et repas, types de zombies, explosions de bouffis en
chaîne, renforts et rage du boss, coups sur les joueurs et relève, étoiles,
lanterne, zombies qui rejoignent Lucie de toute la lisière, sur chaque carte,
reprise par un nouvel hôte), les règles, le salon et un salon complet sur
`BroadcastChannel` (qui existe dans Node). Aucun test n'appelle Supabase.

Le jeu lui-même ne se vérifie qu'avec Playwright, dans Chromium lancé avec
`--use-angle=swiftshader --enable-unsafe-swiftshader`. Ouvrir l'adresse avec
`?debug` expose `window.leProtege` : `etat()` (phase, étape, carte, `autel`,
munitions, `progression` du rechargement, `ids` des zombies, `boss`, `vie`,
`vivres`, nombre de `chiffres` de dégâts à l'écran), `viser(x, y, z)`,
`teleporter(x, z)`, `acheter(id)`, `acheterVivre(id)`, `manger(id)`,
`equiper(id)`, `recharger()`, `boutique()`, `ameliorerLanterne()`, et pour
l'hôte `crediter(n, id)`, `finirPhase()` (abrège l'accalmie, l'assaut, la
victoire ou le chrono du boss), `poserSurAutel()` (le rituel commence),
`blesser(id, degats)`, `blesserJoueur(pv, id)`, `poserEtoile(x, z)` et
`poserZombie(type, x, z, vitesse, pv)` (immobile par défaut, seulement en
assaut, rituel ou boss). `etat()` donne aussi `vies`, `etoiles`, `lanterne`
et `niveaux` ; `window.leProtege.jour()` dit où en est le fondu
(0 : nuit noire, 1 : plein jour) et `rendu()` les compteurs de Three.js.
Pièges :
- `#hud` mesure 0×0 (enfants en `position: fixed`) : attendre `#hud .salon`.
- Cliquer sur une zone libre de la scène : dans une petite fenêtre, le centre
  tombe sur la carte du salon et la souris n'est jamais verrouillée.
- Au clic souris verrouillée, Playwright injecte un faux déplacement de la
  moitié de la fenêtre : réappeler `viser()` juste après `mouse.down()`.
- En rendu logiciel, l'île tourne à quelques images par seconde ; le pas de
  temps étant plafonné à 0,1 s, le temps de jeu ralentit d'autant (un rituel
  de 4 s en dure 10). Attendre les phases avec `etat()`, jamais avec un délai
  fixe, et abattre les zombies (`blesser`) pendant le boss, sinon Lucie meurt
  avant. À deux pages, donner 3 minutes au chargement de la seconde
  (`setDefaultTimeout`).
- Un tir ne part qu'à l'image suivante : laisser `mouse.down()` enfoncé au
  moins 250 ms.
- `viser()` part de la position de la caméra, mise à jour à l'image suivante :
  après `teleporter()`, attendre avant de viser.
- Les zombies sortent de l'eau : sous la surface, le fond marin arrête les
  balles. Viser ceux dont `y > 0`.
- Les pages d'un même contexte partagent `localStorage` et `BroadcastChannel` :
  c'est ce qui permet de tester à plusieurs. Une page en arrière-plan reçoit
  les messages mais ne dessine plus (ni interface ni musique) :
  `bringToFront()` avant de la vérifier.

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
- L'inventaire est au milieu, en bas (argent, vie, armes possédées, vivres) :
  les touches 1, 2… suivent l'ordre des armes **possédées**, pas celui de
  `ARMES`. À droite, il recouvrait l'arme en main.
- Joueurs et zombies ne montent pas une marche de plus de 0,55 m (joueur) ou
  `PAS_MAX` (zombie, navigation). Le relief des cartes ouvertes reste doux
  (test « aucune marche infranchissable ») ; tout ce qui se touche (attaque,
  poteau porté, étoile) vérifie quand même l'écart de hauteur.
- **Zombies sur les cartes ouvertes** : aller droit et glisser le long des
  obstacles ne suffit pas (coincés derrière une maison, ou d'avant en
  arrière contre un tronc en biais). Ils suivent le champ de distances vers
  Lucie (`navigation()` de la carte, un champ par case cible, gardés en
  mémoire, préparé dès l'arrivée sur la carte). Un joueur à moins de 6 m, ils
  le chargent tout droit : un champ par joueur coûterait un Dijkstra à
  chacun de ses pas. Sur l'île, `navigation()` rend `null`.
- En glissant contre un obstacle, un zombie choisit le côté où l'obstacle le
  pousse déjà, et s'y tient 0,6 s (`m.g`) ; sinon, contre un tronc en biais,
  il allait et venait sans avancer.
- Navigation : les distances de Dijkstra doivent rester en 64 bits. En
  `Float32Array`, une distance arrondie ne se reconnaît plus en sortant de la
  file (`d > dist[b]`) et presque toute la carte devenait injoignable. Une
  case bloquée (zombie collé à un obstacle) rejoint la voisine la mieux
  placée.
- Changer de carte ne change pas le nombre de lumières : les lampes des
  décors sont sorties de leur groupe (`scene.attach`) et éteintes quand leur
  décor est caché. Un groupe invisible retire ses lumières du compte, et tous
  les shaders se recompilent.
- Une lumière placée à l'intérieur d'un maillage n'éclaire que ce qui
  l'entoure : le halo du boss est devant son torse, sinon il restait noir.
- La nuit est un brouillard presque noir (22 m au départ, repoussé par la
  lanterne : `ile.vision()`). Ce qui doit se voir de loin dans le noir (yeux
  des zombies, étoiles) a `fog: false`, sinon le brouillard l'avale aussi.
- Le passage du jour à la nuit est un fondu de quelques secondes : en rendu
  logiciel (quelques images par seconde), une capture prise juste après le
  lancement montre encore le crépuscule.
- Musique : les notes sont programmées 0,2 s en avance à chaque image. Après
  un onglet en arrière-plan, on repart du présent (sinon tout le retard sort
  d'un coup).
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
- Sans `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, le jeu passe **sans
  bruit** en mode local (`BroadcastChannel`) : tout marche sur un seul poste,
  et l'ami qui ouvre le lien se retrouve seul dans « son » salon. D'où le
  bandeau orange `#mode-local` / `#salon-local`, à garder bien visible.
- Variables `VITE_` : intégrées au build. Sur Vercel, une variable ajoutée
  après coup demande un redéploiement ; et la protection doit être
  « Standard Protection », sinon les amis tombent sur une connexion Vercel.
- Three.js r186 : `THREE.Timer` remplace `Clock` ; `PCFSoftShadowMap` n'existe plus.
- Le décor vient de graines fixes (`generateur(20260922)` dans `monde.js`,
  20260924 pour le village, 20260925 pour la forêt) : tous les joueurs voient
  les mêmes cartes sans rien échanger. Ajouter un élément de décor **après**
  les autres tirages, sinon toute la carte change de place.
- **Ce qu'on voit est ce qui bloque** : chaque obstacle de `village.js` et
  `foret.js` est dessiné par son `genre` dans `rendu-village.js` /
  `rendu-foret.js`, et `cartes.test.js` liste les genres dessinés. Ce qu'on
  enjambe (herbe, fleurs, fougères, champignons, rondins du feu de camp)
  n'est pas un obstacle.
- L'autel ne bloque rien et la simulation ne connaît pas son disque de
  pierre : `jeu.js` relève Lucie de `HAUTEUR_AUTEL` quand elle y est posée,
  pour qu'elle s'y tienne debout.
- Les chiffres de dégâts sont des étiquettes CSS2D recyclées (`chiffres.js`),
  jamais créées puis retirées à chaque balle : un Uzi en afficherait 14 par
  seconde.
- **Halo lumineux (bloom)** : la scène est rendue en HDR, et seul ce qui
  dépasse le seuil (2,2 la nuit, 6 le jour) rayonne. Une matière qui doit
  briller (yeux, flammes, fenêtres, lanterne, traceurs) prend une couleur
  `lumineux(couleur, force)` avec une force de 3 à 8 ; une couleur normale ne
  brille jamais. Un seuil plus bas faisait baver tout le sable éclairé.
- Brume, écume : pas de plans à plat posés sur une pente (ils tranchent net
  dans le sol), mais des nappes qui épousent le relief, bords transparents
  par sommet (attribut `color` à 4 composantes).
- Un obstacle ajouté près d'un autre (caisses contre la cabane) crée une
  poche où les zombies, qui glissent le long des obstacles, restent coincés :
  laisser au moins un mètre et demi entre deux obstacles, ou les coller.
  Le test « contourne la cabane » le vérifie.
- Les fenêtres, les torches, les runes et les braises n'éclairent rien : ce
  sont des matières lumineuses, pas des lumières (nombre de lumières
  constant). Chaque carte n'a que quelques lampes (armurerie, autel, feu de
  camp), sorties de leur groupe par `ile.js`.
- **Végétation** : des milliers de touffes d'herbe, c'est un `InstancedMesh`
  par espèce, jamais un maillage par plante. Le vent est dans le shader
  (`onBeforeCompile`, phase tirée de `instanceMatrix`) : rien à recalculer
  en JavaScript. Les brins ont des normales vers le haut (sinon une face sur
  deux est noire) et pas de `flatShading`, qui les ignorerait. Ce qui est
  au-delà des bornes ne projette pas d'ombre (`creerVegetation(…, { ombres:
  false })`) : il serait dessiné une seconde fois pour rien.
- Arbres, tour de guet, camp, réverbères de l'île sont dans `DECOR` (et dans
  les obstacles) ; herbes et buissons ne bloquent rien et sont tirés au
  rendu, par `hachage`. Le test « de tous les côtés de l'île » vérifie qu'un
  zombie parti de la mer atteint toujours le poteau.
