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
  `src/regles.js`, et nulle part ailleurs. Les réglages d'essai (`ESSAI` :
  manches courtes, boss fragile, argent au départ) y sont aussi : `jeu.js` les
  passe à la simulation de l'hôte, les tests vérifient le jeu normal.

## Qui décide quoi

Le premier membre du salon (`membres[0]`, voir `salon.js`) est **l'hôte** : son
navigateur fait tourner `src/simulation.js` (préparation et manches, carte de
chaque manche, zombies, vie du protégé, poteau, Illumination) et diffuse `instantane()` 6 fois par seconde (1 fois au
camp). Les autres affichent l'état reçu et envoient leurs actions ; l'hôte les
valide.

| Message (broadcast `jeu`) | Émetteur | Contenu |
| --- | --- | --- |
| `etat` | chaque joueur | position, orientation du corps `r`, regard `vp`, arme en main `ar` |
| `monde` | l'hôte | l'instantané complet : zombies et leur type `k`, explosions de bouffis `ex`, boss `bo` (id, points de vie max, nombre de cris), niveau de lanterne `la`, étoiles `et`, coups et relève des défenseurs `vi`, argent, armes et niveaux d'armes `jo` (voir `normaliserMonde`) |
| `tirs` | le tireur | paquet de balles (100 ms) : trajectoires, et `m`, `dg` si un zombie est touché |
| `grenade` | le tireur | départ et vitesse : chaque navigateur simule la même trajectoire |
| `explosion` | le tireur | zombies touchés par sa grenade et dégâts |
| `porter`, `poser`, `illuminer`, `lancer`, `acheter`, `lanterne`, `pret` | un joueur | demande que seul l'hôte applique |
| `relever` | un joueur | début (`cible` : l'allié à terre) ou fin (`cible: null`) d'une relève, E maintenu |

Le tireur détecte lui-même l'impact (sur les zombies tels qu'il les voit) : entre
amis, on fait confiance, l'hôte ne fait que borner les dégâts et crédite
l'argent au tireur. Les achats sont validés par l'hôte (argent suffisant, joueur
devant le comptoir `BOUTIQUE`). Si l'hôte part, le suivant appelle
`sim.charger(dernier instantané)` et continue.

Les bouffis explosent **chez l'hôte** (au contact du poteau, ou abattus) : la
simulation compte les dégâts, réaction en chaîne comprise, et range
l'explosion dans `ex` pendant 1,5 s avec un numéro. Chaque navigateur la
montre une fois (`explosionsVues` dans `jeu.js`).

Le boss est un zombie comme les autres (type `boss`, jamais tiré au sort),
avec en plus `s.boss` dans la simulation. Après `BOSS.apparition` secondes
de manche (la fin du chrono en jeu normal, 60 s pendant les essais), l'hôte
le fait apparaître ; la manche n'est gagnée que lorsqu'il a disparu de la liste. Ses
cris (renforts) sont un compteur dans `bo` : chaque navigateur rugit quand il
augmente ; la rage se déduit de ses points de vie. Barre de vie, musique et
annonces se déduisent donc de l'instantané, sans message à part.

Phases : `attente` (camp, sur l'île) → `preparation` (30 s, carte de la
manche, poteau à son départ, pas de zombie ; tous prêts : on passe) →
`manche` → `pause` (8 s, encore sur l'ancienne carte) → `preparation` de la
manche suivante… Les cartes (`CARTES` dans `monde.js`) partagent une même
interface ; la simulation lit `CARTES[s.carte]`, le navigateur `carte()`,
activée quand l'instantané annonce une autre carte (`ca`) : chacun se
téléporte alors à son entrée.

Les zombies visent aussi les défenseurs : l'hôte les connaît par les
positions reçues (`joueurs` passé à `pas()`, avec l'arme en main `ar`), donne
les coups, met à terre et relève (`s.vies`). Les étoiles tombent, se
ramassent et améliorent les armes chez l'hôte aussi ; le tireur applique
lui-même le niveau de son arme (`armeAmelioree`) à ses dégâts, son chargeur
et son rechargement, et l'hôte borne les dégâts reçus en conséquence
(`BONUS_DEGATS_MAX`).

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
| `src/monde.js` | registre des cartes (`CARTES`, `carteDeManche`, `carte()`), et relief, décor, collisions de l'île |
| `src/chateau.js` | la cour du château : blocs et rampes (carte de hauteurs), obstacles, sorties, sans Three.js |
| `src/navigation.js` | champ de distances (Dijkstra sur une grille de 1 m) : les zombies passent les portes et prennent les rampes |
| `src/rendu-chateau.js` | rendu de la cour (mêmes blocs que la carte) : lierre, fissures, meurtrières, fenêtres éclairées, cimetière, arbres morts |
| `src/environs-chateau.js` | la cour meublée (marché, forge, mannequins, braseros…) et ses environs hors d'atteinte : chemins, clôtures, village, moulin, chapelle, forêt |
| `src/vegetation.js` | herbes hautes, buissons, sapins, feuillus, bananiers : un `InstancedMesh` par espèce, ondulant au vent dans le shader |
| `src/ile.js` | rendu de l'île (végétation, camp, tour de guet, réverbères, barque, écume, îlots…), ciel (halo de lune, nuages, étoiles filantes), ambiances (jour, crépuscule de la préparation, nuit, Illumination), bascule d'une carte à l'autre |
| `src/ambiance.js` | vie de la nuit : lucioles, braises des torches, brume au ras du sol |
| `src/post.js` | post-traitement : halo lumineux (bloom) réglé sur `ile.jour`, vignettage, étalonnage de nuit, grain |
| `src/particules.js` | sang, bave, poussière, étincelles, fumée, douilles, flaques : réserves fixes d'`InstancedMesh` |
| `src/geometrie.js` | pièces low-poly colorées par sommet puis fusionnées ; `lumineux()` pour ce qui doit rayonner |
| `src/personnage.js` | perso des joueurs, poses (libre, arme, porte, attache), arme en main |
| `src/armes.js` | modèles des 4 armes et de la grenade (profils extrudés, biseautés) |
| `src/apercus.js` | vignettes des armes photographiées au démarrage, pour la boutique et la barre d'armes |
| `src/projectiles.js` | grenades en vol, découpées en pas de 20 ms |
| `src/etoiles.js` | étoiles d'amélioration au sol : étoile, halo, colonne de lumière, sans lumière ajoutée |
| `src/monstres.js` | zombies à l'écran, 5 silhouettes détaillées (visage, dents, mains, lambeaux…) et allures : 6 maillages chacun, géométries partagées |
| `src/poteau.js` | mât, cordes, lanterne orientable, mannequin de paille |
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

`node:test` couvre la cour du château (`chateau.test.js` : murailles, portes,
rampes, chemin de ronde joignable, sorties), la simulation (préparation, vote
« prêt », rotation des cartes, zombies qui montent sur la terrasse, écarts de
hauteur, manches, défaite, tirage, poteau,
Illumination, argent, achats, types de zombies, explosions de bouffis en
chaîne, boss (apparition, renforts, rage, victoire, reprise), coups sur les
joueurs et relève, étoiles, lanterne, contournement des obstacles, reprise par un nouvel hôte), les règles,
le salon et un salon
complet sur `BroadcastChannel` (qui existe dans Node). Aucun test n'appelle
Supabase.

Le jeu lui-même ne se vérifie qu'avec Playwright, dans Chromium lancé avec
`--use-angle=swiftshader --enable-unsafe-swiftshader`. Ouvrir l'adresse avec
`?debug` expose `window.leProtege` : `etat()` (munitions, `progression` du
rechargement, `ids` des zombies et `boss` compris), `viser(x, y, z)`, `teleporter(x, z)`, `acheter(id)`,
`equiper(id)`, `recharger()`, `boutique()`, et pour l'hôte `crediter(n, id)`,
`illuminer()`, `passerPreparation()`, `finirChrono()` (le boss arrive),
`blesser(id, degats)`,
`poserEtoile(x, z)`, `ameliorerLanterne()` et
`poserZombie(type, x, z, vitesse, pv)` (immobile par défaut : pratique pour
photographier un modèle). `etat()` donne aussi `vie`, `vies`, `etoiles`,
`lanterne` et `niveaux` ; `window.leProtege.jour()` dit où en est le fondu
(0 : nuit noire, 1 : plein jour) et `rendu()` les compteurs de Three.js.
Pièges :
- `#hud` mesure 0×0 (enfants en `position: fixed`) : attendre `#hud .salon`.
- Cliquer sur une zone libre de la scène : dans une petite fenêtre, le centre
  tombe sur la carte du salon et la souris n'est jamais verrouillée.
- Au clic souris verrouillée, Playwright injecte un faux déplacement de la
  moitié de la fenêtre : réappeler `viser()` juste après `mouse.down()`.
- Plusieurs pages WebGL en rendu logiciel font tomber les images par seconde ;
  le pas de temps étant plafonné à 0,1 s, le temps de jeu ralentit d'autant.
  Les 30 s d'Illumination durent alors plusieurs minutes : pour une capture
  de nuit, attendre `jour() < 0.01` sans avoir illuminé.
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
- La barre d'armes est à gauche : à droite, elle recouvrait l'arme en main.
- **Relief à étages** : une carte est une carte de hauteurs (blocs, rampes).
  Joueurs et zombies ne montent pas une marche de plus de 0,55 m (joueur) ou
  `PAS_MAX` (zombie, navigation) : c'est ce qui fait des murailles des murs.
  On peut sauter en bas. Tout ce qui se touche (attaque, poteau porté,
  étoile) vérifie aussi l'écart de hauteur, sinon on frappe à travers la
  terrasse.
- Navigation : les distances de Dijkstra doivent rester en 64 bits. En
  `Float32Array`, une distance arrondie ne se reconnaît plus en sortant de la
  file (`d > dist[b]`) et presque toute la carte devenait injoignable.
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
- Le décor vient d'une graine fixe (`generateur(20260922)` dans `monde.js`) :
  tous les joueurs voient la même île sans rien échanger. Ajouter un élément
  de décor **après** les autres tirages, sinon toute l'île change de place.
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
- Les fenêtres des tours, les torches et les braises n'éclairent rien : ce
  sont des matières lumineuses, pas des lumières (nombre de lumières constant).
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
- Le linteau des portes du château est un décor sans relief : la carte de
  hauteurs ne le connaît pas (sinon le passage serait bouché) ; il est posé
  assez haut pour que le boss passe dessous.
