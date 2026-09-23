# Le Protégé

Jeu coopératif en 3D, dans le navigateur, pour 4 amis. L'un de vous, ligoté à
un poteau, sert de lanterne à l'équipe ; les trois autres le défendent contre
des vagues de zombies qui sortent de la mer. Rien à installer : on s'envoie un
lien.

## Règles

- **4 joueurs** : 1 protégé, 3 défenseurs. Le protégé est tiré au sort à
  chaque manche.
- **Manche de 5 minutes**. Les zombies arrivent de plus en plus vite pendant
  la manche (2,5 fois plus à la fin qu'au début), et chaque manche en amène
  davantage, plus rapides et plus résistants. Au bout des 5 minutes, **le boss**
  sort de la mer : l'abattre gagne la manche. Si le protégé meurt, c'est la
  défaite et tout le monde retourne au camp.
- **La nuit est noire** : au-delà de quelques mètres, on ne voit que ce
  qu'éclaire la lanterne du protégé (et les yeux des zombies qui luisent).
- **Le protégé** ne bouge pas : il dirige la lanterne avec la souris.
  **F** lance l'**Illumination** : toute l'île éclairée pendant 30 secondes,
  puis 3 minutes de recharge.
- **Les défenseurs** tirent et peuvent **porter le poteau** (**E**) pour le
  déplacer, avec le protégé dessus. En portant, on ne tire pas et on avance
  moins vite.
- **Les zombies attaquent aussi les défenseurs** : celui qui passe à moins de
  6 m d'un joueur (et plus près de lui que du poteau) se jette dessus. **Deux
  coups et on est à terre** (un seul pour le boss ; un bouffi qui éclate tout
  près en donne un). Un coup s'efface après 12 secondes sans être touché ;
  les deux cœurs en bas à gauche montrent où tu en es.
- **À terre**, on ne bouge plus et on ne tire plus. Un allié te **relève** en
  restant près de toi, **E maintenu**, pendant 3 secondes. Sans autre
  défenseur dans la partie (seul, ou à deux avec le protégé), on se relève
  tout seul au bout de 15 secondes. Tout le monde est relevé à la fin de la
  manche.

### Les zombies

| Type | Prime | À quoi le reconnaître |
| --- | --- | --- |
| Rôdeur | 10 $ | le zombie ordinaire, bras tendus, yeux rouges |
| Coureur | 15 $ | maigre et voûté, yeux jaunes : 1,6 fois plus rapide, mais tombe en deux balles |
| Colosse | 60 $ | énorme, épaulière de fer : 6 fois plus résistant, lent, frappe 2,5 fois plus fort. Arrive après la première minute, 4 au plus à la fois |
| Bouffi | 25 $ | ventre couvert de pustules vertes qui luisent : il **explose** |

Le bouffi éclate au contact du poteau (25 points de vie en moins pour le
protégé) ou quand on l'abat. L'explosion emporte aussi les zombies autour,
bouffis compris (réaction en chaîne), et leurs primes vont à celui qui l'a
abattu. Abattu trop près du poteau, il blesse quand même le protégé : tire-le
de loin. La part des coureurs, colosses et bouffis grandit de manche en
manche ; un message prévient à la première apparition de chaque type.

### Le boss : le Roi Noyé

Quand le chrono tombe à zéro, un géant couronné sort des flots en traînant
une ancre, sur une musique qui ne laisse pas souffler. Sa barre de vie
s'affiche en haut de l'écran.

- Il résiste d'autant plus qu'il y a de défenseurs et que la manche avance
  (1 500 points de vie seul en manche 1, 2 700 à deux défenseurs, 3 900 à
  trois), et vise la tête : dégâts doublés.
- Il marche lentement vers le poteau ; au contact, son ancre tue le protégé
  en quelques secondes. Porter le poteau pour le fuir est une option.
- Toutes les 12 secondes, il hurle et fait surgir des coureurs autour de lui ;
  la horde continue d'arriver, moins vite.
- À mi-vie, il **enrage** : yeux rouges, il accélère, la musique aussi.
- L'abattre rapporte **250 $** au tireur, en plus des 150 $ de la manche pour
  tout le monde.

### Étoiles

Un zombie abattu lâche parfois une **étoile** dorée (4 % pour un rôdeur,
35 % pour un colosse ; le boss en lâche trois). Elle se voit de loin, même
de nuit. **Marche dessus** pour la ramasser : l'arme que tu tiens gagne un
niveau (★ à ★★★), soit +25 % de dégâts, +20 % de chargeur et un
rechargement plus rapide, et son chargeur se remplit. Arme déjà au plus
haut : l'étoile améliore une autre de tes armes, ou rapporte 100 $. Une
étoile s'éteint au bout de 30 secondes (elle clignote avant). Les niveaux
repartent à zéro à chaque nouvelle partie.

### Argent et armurerie

Chaque zombie tué rapporte sa prime (de 10 à 60 $) à celui qui l'a abattu,
et chaque manche gagnée **150 $** à tout le monde. L'argent repart à zéro à
chaque nouvelle partie.

L'**armurerie** est la cabane éclairée à l'ouest de l'île : approche-toi du
comptoir et appuie sur **E**. Aller acheter, c'est laisser le poteau sans toi
quelques instants.

| Arme | Prix | Chargeur | En deux mots |
| --- | --- | --- | --- |
| Pistolet | offert | 12 (1,2 s) | précis ; 3 balles par rôdeur, 2 dans la tête |
| Mini Uzi | 250 $ | 32 (1,6 s) | rafale très rapide, qui s'écarte et grimpe |
| Fusil d'assaut | 600 $ | 30 (2 s) | puissant et précis au coup par coup |
| Lance-grenades | 1 200 $ | 6 (2,8 s) | explose au contact, dégâts de zone |

L'armurerie vend aussi la **lanterne du protégé**, pour toute l'équipe :
trois niveaux (300, 600 puis 1 000 $), chacun rend le faisceau plus long,
plus large et plus fort, et repousse la nuit (on voit à 22 m au départ,
44 m au niveau 3).

Munitions illimitées, mais il faut **recharger** : **R**, ou tout seul quand le
chargeur est vide. Changer d'arme interrompt le rechargement ; chaque manche
repart chargeurs pleins.

**Recul** : chaque tir relève le regard et l'écarte un peu ; il revient de
lui-même, mais en rafale le recul s'accumule (l'Uzi et le fusil grimpent :
tire la souris vers le bas). La dispersion grandit aussi pendant une rafale,
en courant et en sautant : les quatre traits du viseur montrent l'écart réel
du prochain tir. Tous les réglages (prix, dégâts, cadence, recul…) sont dans
`src/regles.js`.

## Jouer

1. Crée ton perso (le camp est en plein jour), puis **Créer un salon**.
2. **Copier le lien** et envoie-le (ou dicte le code à 4 caractères).
3. Quand tout le monde est là : **Lancer la partie** (ou Entrée).

**Tester seul :** lance la partie sans attendre personne et choisis ton rôle.
En défenseur, un mannequin de paille est attaché au poteau et sa lanterne suit
le zombie le plus proche. En protégé, personne ne te défend : de quoi essayer
la lanterne et l'Illumination.

| Commande | Action |
| --- | --- |
| clic sur la scène | prendre la souris (Échap pour la libérer) |
| ZQSD (AZERTY) ou WASD (QWERTY) | marcher |
| souris | viser / diriger la lanterne |
| clic gauche (maintenu) | tirer |
| R | recharger |
| 1 à 4, molette | changer d'arme |
| E | porter / poser le poteau, ouvrir l'armurerie |
| E maintenu | relever un allié à terre |
| F | Illumination (protégé) |
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

## Bon à savoir

- **Qui fait tourner les zombies ?** Le navigateur du premier joueur du salon
  (l'hôte). S'il part, le suivant reprend la partie là où elle en était.
- **Pause Supabase :** un projet gratuit est mis en pause après une semaine sans
  activité. Si le salon ne se connecte plus, réactive le projet depuis le
  tableau de bord Supabase.
- **Quota de messages :** pendant une manche, l'hôte envoie l'état du monde
  6 fois par seconde, chaque joueur sa position jusqu'à 10 fois par seconde et
  ses tirs par paquets de 100 ms. Une manche à 4 représente quelques dizaines
  de milliers de messages ; le quota gratuit de Supabase est mensuel, surveille
  l'onglet *Usage*.
- **Accès :** qui connaît le code peut entrer (environ 920 000 codes
  possibles). Suffisant entre amis, ce n'est pas un contrôle d'accès.
