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
  davantage, plus rapides et plus résistants ; certains courent. Survivre
  jusqu'au bout gagne la manche ; si le protégé meurt, c'est la défaite et tout
  le monde retourne au camp.
- **La nuit**, on ne voit bien que ce qu'éclaire la lanterne du protégé.
- **Le protégé** ne bouge pas : il dirige la lanterne avec la souris.
  **F** lance l'**Illumination** : toute l'île éclairée pendant 30 secondes,
  puis 3 minutes de recharge.
- **Les défenseurs** tirent et peuvent **porter le poteau** (**E**) pour le
  déplacer, avec le protégé dessus. En portant, on ne tire pas et on avance
  moins vite.

### Argent et armurerie

Chaque zombie tué rapporte **10 $** à celui qui l'a abattu, et chaque manche
gagnée **150 $** à tout le monde. L'argent repart à zéro à chaque nouvelle
partie.

L'**armurerie** est la cabane éclairée à l'ouest de l'île : approche-toi du
comptoir et appuie sur **E**. Aller acheter, c'est laisser le poteau sans toi
quelques instants.

| Arme | Prix | En deux mots |
| --- | --- | --- |
| Pistolet | offert | précis ; 3 balles par zombie, 2 dans la tête |
| Mini Uzi | 250 $ | rafale très rapide, dispersion de loin |
| Fusil d'assaut | 600 $ | puissant et précis |
| Lance-grenades | 1 200 $ | explose au contact, dégâts de zone |

Munitions illimitées. Tous les réglages (prix, dégâts, cadence…) sont dans
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
| 1 à 4, molette | changer d'arme |
| E | porter / poser le poteau, ouvrir l'armurerie |
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
