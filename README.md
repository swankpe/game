# Le Protégé

Jeu coopératif en 3D, dans le navigateur, pour 4 amis. **Lucie**, une
villageoise ligotée à un poteau, porte la lanterne ; vous la défendez contre
les zombies qui sortent de partout, de nuit, de carte en carte. Rien à
installer : on s'envoie un lien.

## Règles

- **Jusqu'à 4 joueurs**, tous défenseurs. Lucie n'est pas un joueur : si elle
  meurt, c'est perdu.
- **Un parcours de cartes ouvertes** : l'île, le village abandonné, la forêt
  noire, puis l'île à nouveau, plus dangereuse. Chaque boss abattu ouvre la
  carte suivante.
- **Les zombies arrivent en continu** pendant un **assaut** (100 s), de plus
  en plus vite. Puis la lumière revient : **l'accalmie** (30 s). La carte
  s'illumine, les zombies restants fuient, ceux qui étaient à terre se
  relèvent : c'est le moment de passer à l'armurerie, de manger et de
  déplacer Lucie. On arrive sur chaque carte par une accalmie.
- **L'autel** : chaque carte a le sien (une colonne de lumière le signale de
  loin, et sa distance s'affiche). **Portez Lucie** (E) et **posez-la sur
  l'autel** : un rituel de 4 secondes commence, puis **le boss** surgit.
  Vous avez **2 min 30** pour l'abattre (le chrono s'affiche en grand sous sa
  barre de vie) ; sinon, c'est perdu. Pendant le combat, la horde continue
  d'arriver, moins vite.
- **Le danger monte** d'un assaut à l'autre sur une même carte, et bien plus
  d'une carte à l'autre : zombies plus nombreux, plus rapides, plus
  résistants, davantage de types spéciaux. Traîner avant d'appeler le boss,
  c'est gagner de l'argent mais affronter des assauts plus durs.
- **La nuit est noire, Lucie l'éclaire** : sa lanterne ne s'éteint jamais.
  Elle répand un halo tout autour d'elle (16 m au départ) et son faisceau
  suit le zombie le plus proche. Dans son halo, on voit bien plus loin (la
  nuit recule jusqu'à 1,6 fois) : restez près d'elle pour voir venir les
  zombies. Loin d'elle, on ne voit que les yeux des zombies qui luisent.
- **Porter Lucie** : en la portant, on ne tire pas et on avance moins vite.
  Pendant le rituel, elle ne quitte pas l'autel.
- **Les zombies attaquent aussi les défenseurs** : celui qui passe à moins de
  6 m d'un joueur (et plus près de lui que de Lucie) se jette dessus. Tu as
  **100 points de vie**, un coup en retire **50** (le boss met à terre d'un
  seul coup ; un bouffi qui éclate tout près en retire 50 aussi). **Pas de
  soin tout seul** : il faut **manger** (F), voir l'armurerie.
- **À terre**, on ne bouge plus et on ne tire plus. Un allié te **relève** en
  restant près de toi, **E maintenu**, pendant 3 secondes. Seul dans la
  partie, on se relève tout seul au bout de 15 secondes. On se relève avec
  50 points de vie ; tout le monde se relève à l'accalmie, et repart en
  pleine forme après un boss.
- **Les dégâts s'affichent** au-dessus du zombie touché : blanc pour le
  corps, doré pour la tête (dégâts doublés), orange pour une grenade.

### Les zombies

| Type | Prime | À quoi le reconnaître |
| --- | --- | --- |
| Rôdeur | 10 $ | le zombie ordinaire, bras tendus, yeux rouges |
| Coureur | 15 $ | maigre et voûté, yeux jaunes : 1,6 fois plus rapide, mais tombe en deux balles |
| Colosse | 60 $ | énorme, épaulière de fer : 6 fois plus résistant, lent, frappe 2,5 fois plus fort. Pas avant 45 s au premier assaut, 4 au plus à la fois |
| Bouffi | 25 $ | ventre couvert de pustules vertes qui luisent : il **explose** |

Le bouffi éclate au contact de Lucie (25 points de vie en moins pour elle) ou
quand on l'abat. L'explosion emporte aussi les zombies autour, bouffis compris
(réaction en chaîne), et leurs primes vont à celui qui l'a abattu. Abattu trop
près de Lucie, il la blesse quand même : tire-le de loin. Un message prévient
à la première apparition de chaque type.

### Les cartes

- **L'île** : la plage, le ponton, les palmiers, le camp des naufragés, la
  tour de guet. Les zombies sortent de la mer. L'armurerie est la cabane à
  l'ouest, l'autel au nord.
- **Le village abandonné** : une place pavée, des maisons à colombages aux
  fenêtres éclairées, le marché, le puits, le moulin, des champs et des
  meules. L'armurerie est un étal (avec sa forge) à l'ouest de la place ;
  l'autel est devant la chapelle et son cimetière, au nord-est. Les zombies
  sortent de la forêt qui entoure le village.
- **La forêt noire** : une clairière, un feu de camp, la cabane du chasseur
  qui sert d'armurerie, un étang, des sapins serrés, des troncs couchés, des
  champignons qui luisent la nuit. L'autel est au centre d'un cercle de
  pierres levées, au nord-est, au bout d'un chemin.

Sur le village et la forêt, les zombies contournent maisons, troncs et étang
pour rejoindre Lucie, où qu'on l'ait posée.

### Le boss : le Roi Noyé

Un géant couronné qui traîne une ancre, sur une musique qui ne laisse pas
souffler. Sa barre de vie et son chrono s'affichent en haut de l'écran.

- Il résiste d'autant plus qu'il y a de défenseurs et que le parcours avance
  (1 500 points de vie seul sur la première carte, 2 700 à deux, 3 900 à
  trois ; 60 % de plus à chaque carte), et vise la tête : dégâts doublés.
- Il marche lentement vers Lucie ; au contact, son ancre la tue en quelques
  secondes.
- Toutes les 12 secondes, il hurle et fait surgir des coureurs autour de lui.
- À mi-vie, il **enrage** : yeux rouges, il accélère, la musique aussi.
- L'abattre rapporte **250 $** au tireur, et **200 $** à tout le monde.

### Étoiles

Un zombie abattu lâche parfois une **étoile** dorée (4 % pour un rôdeur,
35 % pour un colosse ; le boss en lâche trois). Elle se voit de loin, même
de nuit. **Marche dessus** pour la ramasser : l'arme que tu tiens gagne un
niveau (★ à ★★★), soit +25 % de dégâts, +20 % de chargeur et un
rechargement plus rapide, et son chargeur se remplit. Arme déjà au plus
haut : l'étoile améliore une autre de tes armes, ou rapporte 100 $. Une
étoile s'éteint au bout de 30 secondes (elle clignote avant). Les niveaux
repartent à zéro à chaque nouvelle partie.

### Argent, armurerie et inventaire

Chaque zombie tué rapporte sa prime (de 10 à 60 $) à celui qui l'a abattu,
et chaque boss abattu **200 $** à tout le monde. L'argent repart à zéro à
chaque nouvelle partie.

Chaque carte a son **armurerie** : approche-toi du comptoir et appuie sur
**E**. Aller acheter, c'est laisser Lucie sans toi quelques instants : mieux
vaut y aller pendant l'accalmie.

| Arme | Prix | Chargeur | En deux mots |
| --- | --- | --- | --- |
| Pistolet | offert | 12 (1,2 s) | précis ; 3 balles par rôdeur, 2 dans la tête |
| Mini Uzi | 250 $ | 32 (1,6 s) | rafale très rapide, qui s'écarte et grimpe |
| Fusil d'assaut | 600 $ | 30 (2 s) | puissant et précis au coup par coup |
| Lance-grenades | 1 200 $ | 6 (2,8 s) | explose au contact, dégâts de zone |

| Vivres | Prix | Soin | Dans le sac |
| --- | --- | --- | --- |
| Pomme | 40 $ | 30 points de vie en 2 s | 6 au plus |
| Ragoût | 110 $ | 80 points de vie en 5 s | 3 au plus |

L'armurerie vend aussi la **lanterne de Lucie**, pour toute l'équipe : trois
niveaux (300, 600 puis 1 000 $), chacun rend le faisceau plus long, plus
large et plus fort, élargit son halo (16 m au départ, 28 m au niveau 3) et
repousse la nuit (on voit à 22 m au départ, 44 m au niveau 3, et plus loin
encore près d'elle).

**L'inventaire**, au milieu en bas de l'écran, ne montre que ce que tu
possèdes : tes armes (touches **1**, **2**… dans l'ordre, ou la molette),
puis tes vivres. **F** mange : une pomme pour une égratignure, le ragoût pour
une vraie blessure. Au-dessus : ton argent et ta vie.

Munitions illimitées, mais il faut **recharger** : **R**, ou tout seul quand le
chargeur est vide. Changer d'arme interrompt le rechargement ; chaque accalmie
remplit les chargeurs.

**Recul** : chaque tir relève le regard et l'écarte un peu ; il revient de
lui-même, mais en rafale le recul s'accumule (l'Uzi et le fusil grimpent :
tire la souris vers le bas). La dispersion grandit aussi pendant une rafale,
en courant et en sautant : les quatre traits du viseur montrent l'écart réel
du prochain tir. Tous les réglages (prix, dégâts, cadence, recul…) sont dans
`src/regles.js`.

> **Mode essai en cours** : accalmies de 20 s, assauts de 60 s, boss à un
> dixième de ses points de vie, 10 000 $ au départ de chaque partie. Pour
> revenir au jeu normal : `actif: false` dans `ESSAI`, en haut de
> `src/regles.js`.

## Jouer

1. Crée ton perso (le camp est en plein jour), puis **Créer un salon**.
2. **Copier le lien** et envoie-le (ou dicte le code à 4 caractères).
3. Quand tout le monde est là : **Lancer la partie** (ou Entrée).

**Tester seul :** lance la partie sans attendre personne. À terre, tu te
relèves tout seul au bout de 15 secondes.

| Commande | Action |
| --- | --- |
| clic sur la scène | prendre la souris (Échap pour la libérer) |
| ZQSD (AZERTY) ou WASD (QWERTY) | marcher |
| souris | viser |
| clic gauche (maintenu) | tirer |
| R | recharger |
| 1, 2…, molette | changer d'arme (parmi celles que tu possèdes) |
| F | manger |
| E | porter / poser Lucie, ouvrir l'armurerie |
| E maintenu | relever un allié à terre |
| Entrée | lancer la partie (au camp) |
| Maj | courir |
| Espace | sauter |

PC uniquement (clavier + souris).

## Développer

```bash
npm install
npm run dev      # http://localhost:5173
npm test
```

Sans configuration Supabase, le jeu passe en **mode local** : le salon relie
seulement les onglets du même navigateur. Ouvre deux onglets pour tester à deux.

## Mettre en ligne (Supabase + Vercel)

Le projet Vercel `game` est déjà relié à ce dépôt : chaque push sur `main`
redéploie.

### 1. Supabase

1. Crée un projet (l'offre gratuite suffit).
2. **Rien à créer dans la base** : le jeu n'utilise que Realtime (présence et
   broadcast), sans aucune table.
3. Dans *Project Settings → API*, copie l'URL du projet et la clé publique
   (`sb_publishable_…` ou l'ancienne clé `anon`).

Le jeu utilise des canaux Realtime publics. Si tu as restreint Realtime aux
canaux privés dans les réglages du projet, rouvre l'accès public.

### 2. Vercel

1. Ajoute les variables d'environnement (Production et Preview) :

   | Variable | Valeur |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | la clé publique |

2. Dans *Settings → Deployment Protection → Vercel Authentication*, choisis
   **Standard Protection** : l'adresse de production reste publique, seuls les
   aperçus demandent un compte Vercel. Avec « All Deployments », tes amis
   tomberaient sur une page de connexion Vercel.
3. Redéploie : les variables `VITE_` sont intégrées au moment du build, une
   variable ajoutée après coup n'est prise en compte qu'au déploiement suivant.

Pour jouer en ligne depuis ton poste, copie `.env.example` en `.env.local` et
remplis les deux valeurs.

### Ton ami ne te rejoint pas ?

- **Un bandeau orange « Mode local » s'affiche** (accueil et carte du salon) :
  les deux variables Supabase manquent dans ce déploiement. Le jeu marche
  alors entre les onglets de ton navigateur, mais pas entre deux ordinateurs :
  ton ami se retrouve seul dans un salon qui porte le même code. Ajoute les
  variables (étape 2 ci-dessus), puis redéploie (*Deployments → ⋯ →
  Redeploy*).
- **Ton ami tombe sur une page de connexion Vercel** : tu lui as envoyé
  l'adresse d'un aperçu, ou la protection est sur « All Deployments ».
  Envoie l'adresse de production (*Settings → Domains*).
- **« Connexion perdue »** : le projet Supabase gratuit s'est peut-être mis
  en pause (voir plus bas).

## Bon à savoir

- **Tout est dessiné par le code** : pas un modèle 3D, pas une texture, pas un
  son à télécharger. Les torches, les fenêtres, les runes des autels, les
  yeux des zombies et les étoiles rayonnent dans la nuit (halo lumineux) ; lucioles,
  braises, brume, sang et douilles sont des particules. Herbes hautes,
  buissons et arbres (des milliers) ondulent au vent. Sur une petite carte
  graphique, ce sont le halo et la végétation qui coûtent le plus.

- **Qui fait tourner les zombies ?** Le navigateur du premier joueur du salon
  (l'hôte). S'il part, le suivant reprend la partie là où elle en était.
- **Pause Supabase :** un projet gratuit est mis en pause après une semaine sans
  activité. Si le salon ne se connecte plus, réactive le projet depuis le
  tableau de bord Supabase.
- **Quota de messages :** pendant une partie, l'hôte envoie l'état du monde
  6 fois par seconde, chaque joueur sa position jusqu'à 10 fois par seconde et
  ses tirs par paquets de 100 ms. Une carte à 4 représente quelques dizaines
  de milliers de messages ; le quota gratuit de Supabase est mensuel, surveille
  l'onglet *Usage*.
- **Accès :** qui connaît le code peut entrer (environ 920 000 codes
  possibles). Suffisant entre amis, ce n'est pas un contrôle d'accès.
