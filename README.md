# Pêche entre potes

Petit jeu de pêche en 3D, dans le navigateur, entre amis (4 joueurs maximum).
Rien à installer pour jouer : on s'envoie un lien.

**État actuel :** l'île, la création du perso et le salon multijoueur. La pêche
elle-même est la prochaine étape.

## Jouer

1. Un joueur ouvre le jeu, crée son perso, clique **Créer un salon**.
2. Il clique **Copier le lien** et l'envoie aux autres (ou leur dicte le code à 4 caractères).
3. Les autres ouvrent le lien, créent leur perso, cliquent **Rejoindre**.

| Commande | Action |
| --- | --- |
| ZQSD (AZERTY) ou WASD (QWERTY), flèches | marcher |
| Maj | courir |
| Espace | sauter |
| clic-glisser | tourner la caméra |
| molette | zoomer |

Le perso est gardé dans le navigateur : pas besoin de le refaire à chaque partie.

## Développer

```bash
npm install
npm run dev      # http://localhost:5173
npm test
```

Sans configuration Supabase, le jeu passe en **mode local** : le salon relie
seulement les onglets du même navigateur. Ouvre deux onglets pour tester à deux.

## Mettre en ligne (Supabase + Vercel)

### 1. Supabase

1. Crée un projet (l'offre gratuite suffit).
2. **Rien à créer dans la base** : le jeu n'utilise que Realtime (présence et
   broadcast), sans aucune table.
3. Dans *Project Settings → API*, copie l'URL du projet et la clé publique
   (`sb_publishable_…` ou l'ancienne clé `anon`).

Le jeu utilise des canaux Realtime publics. Si tu as restreint Realtime aux
canaux privés dans les réglages du projet, rouvre l'accès public.

### 2. Vercel

1. Importe le dépôt GitHub dans Vercel : Vite est détecté tout seul
   (`npm run build`, dossier `dist`).
2. Ajoute les variables d'environnement (Production et Preview) :

   | Variable | Valeur |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | la clé publique |

3. Dans *Settings → Deployment Protection → Vercel Authentication*, choisis
   **Standard Protection** : l'adresse de production reste publique, seuls les
   aperçus demandent un compte Vercel. Avec « All Deployments », tes amis
   tomberaient sur une page de connexion Vercel.
4. Redéploie : les variables `VITE_` sont intégrées au moment du build, une
   variable ajoutée après coup n'est prise en compte qu'au déploiement suivant.

Pour jouer en ligne depuis ton poste, copie `.env.example` en `.env.local` et
remplis les deux valeurs.

## Bon à savoir

- **Pause Supabase :** un projet gratuit est mis en pause après une semaine sans
  activité. Si le salon ne se connecte plus, réactive le projet depuis le
  tableau de bord Supabase.
- **Quota de messages :** chaque joueur qui bouge envoie sa position au plus
  10 fois par seconde ; immobile, un simple rappel toutes les 4 secondes. Le
  suivi se fait dans l'onglet *Usage* de Supabase.
- **Accès :** qui connaît le code peut entrer (environ 920 000 codes
  possibles). Suffisant entre amis, ce n'est pas un contrôle d'accès.
